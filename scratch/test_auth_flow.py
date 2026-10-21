import gc
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import app as app_module

app = app_module.app


class KalaamGPTAuthTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original_db_path = app_module.DB_PATH
        cls.temp_dir = tempfile.TemporaryDirectory()
        app_module.DB_PATH = os.path.join(cls.temp_dir.name, "auth-test.db")
        app_module.ensure_db()

    @classmethod
    def tearDownClass(cls):
        app_module.DB_PATH = cls.original_db_path
        gc.collect()
        cls.temp_dir.cleanup()

    def setUp(self):
        app.config["TESTING"] = True
        app.config["SECRET_KEY"] = "test-secret"
        self.client = app.test_client()
        self.email = "testuser_kalaam@example.com"

    def tearDown(self):
        with app.app_context():
            db = app_module.get_db()
            db.execute("DELETE FROM users WHERE email = ?", (self.email,))
            db.commit()
        self.client = None

    def signup(self):
        return self.client.post(
            "/api/auth/signup",
            json={
                "full_name": "Test User Kalam",
                "email": self.email,
                "password": "Password123!",
                "confirm_password": "Password123!",
            },
        )

    def test_public_pages_and_protected_chat(self):
        self.assertEqual(self.client.get("/").status_code, 200)
        self.assertEqual(self.client.get("/signup").status_code, 200)
        self.assertEqual(self.client.get("/login").status_code, 200)
        response = self.client.get("/chat")
        self.assertEqual(response.status_code, 302)
        self.assertIn("/login", response.headers["Location"])

    def test_signup_creates_password_account_without_verification(self):
        response = self.signup()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()["email"], self.email)

        with app.app_context():
            user = app_module.get_db().execute(
                "SELECT email, password_hash FROM users WHERE email = ?",
                (self.email,),
            ).fetchone()
            self.assertIsNotNone(user)
            self.assertEqual(user["email"], self.email)
            self.assertNotEqual(user["password_hash"], "Password123!")

        signup_page = self.client.get("/signup").get_data(as_text=True)
        self.assertIn("window.location.href = '/login'", signup_page)
        self.assertNotIn("/verify-otp", signup_page)

    def test_login_requires_correct_password_and_creates_session(self):
        self.assertEqual(self.signup().status_code, 201)

        bad_login = self.client.post(
            "/api/auth/login",
            json={"email": self.email, "password": "wrong-password"},
        )
        self.assertEqual(bad_login.status_code, 401)
        with self.client.session_transaction() as session:
            self.assertNotIn("user_id", session)

        login = self.client.post(
            "/api/auth/login",
            json={"email": self.email, "password": "Password123!", "remember": True},
        )
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.get_json()["user"]["email"], self.email)
        self.assertEqual(self.client.get("/chat").status_code, 200)

        logout = self.client.post("/api/auth/logout")
        self.assertEqual(logout.status_code, 200)
        self.assertEqual(self.client.get("/chat").status_code, 302)

    def test_removed_verification_pages_and_endpoints_are_unavailable(self):
        self.assertEqual(self.client.get("/verify-otp").status_code, 404)
        self.assertEqual(self.client.get("/static/otp.js").status_code, 404)
        self.assertEqual(
            self.client.post("/api/auth/verify-otp", json={}).status_code,
            404,
        )
        self.assertEqual(
            self.client.post("/api/auth/resend-otp", json={}).status_code,
            404,
        )

    def test_signup_validation_is_preserved(self):
        response = self.client.post(
            "/api/auth/signup",
            json={
                "full_name": "Test User",
                "email": self.email,
                "password": "short",
                "confirm_password": "short",
            },
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("at least 8 characters", response.get_json()["error"])


if __name__ == "__main__":
    unittest.main()
