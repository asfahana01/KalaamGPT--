import os
import sys
import unittest

# Ensure base dir in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import app, get_db, ensure_db, generate_otp, iso_after_minutes

class KalaamGPTAuthTestCase(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        app.config['SECRET_KEY'] = 'test-secret'
        self.client = app.test_client()

    def test_01_health_and_public_landing(self):
        res = self.client.get('/')
        self.assertEqual(res.status_code, 200)
        self.assertIn(b'DR. A.P.J. ABDUL KALAM', res.data)

    def test_02_chat_page_requires_auth(self):
        res = self.client.get('/chat')
        self.assertEqual(res.status_code, 302)
        self.assertIn('/login', res.headers['Location'])

    def test_03_signup_creates_unverified_account_and_otp(self):
        test_email = "testuser_kalaam@example.com"
        # Cleanup if exists
        with app.app_context():
            db = get_db()
            db.execute("DELETE FROM users WHERE email = ?", (test_email,))
            db.commit()

        signup_payload = {
            "full_name": "Test User Kalam",
            "email": test_email,
            "password": "Password123!",
            "confirm_password": "Password123!"
        }
        res = self.client.post('/api/auth/signup', json=signup_payload)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data["email"], test_email)

        # Verify DB state
        with app.app_context():
            db = get_db()
            user = db.execute("SELECT * FROM users WHERE email = ?", (test_email,)).fetchone()
            self.assertIsNotNone(user)
            self.assertEqual(user["email_verified"], 0)
            self.assertIsNotNone(user["otp_hash"])
            self.assertEqual(user["otp_attempts"], 0)

    def test_04_unverified_user_cannot_login(self):
        test_email = "testuser_kalaam@example.com"
        login_payload = {
            "email": test_email,
            "password": "Password123!"
        }
        res = self.client.post('/api/auth/login', json=login_payload)
        self.assertEqual(res.status_code, 403)
        data = res.get_json()
        self.assertIn("verify your email", data["error"].lower())

    def test_05_otp_verification_flow(self):
        test_email = "testuser_kalaam@example.com"
        
        # Test wrong OTP
        wrong_res = self.client.post('/api/auth/verify-otp', json={"email": test_email, "otp": "000000"})
        self.assertEqual(wrong_res.status_code, 400)
        self.assertIn("Incorrect", wrong_res.get_json()["error"])

        # Retrieve valid OTP from DB for testing
        with app.app_context():
            db = get_db()
            # Set a known OTP for test
            from werkzeug.security import generate_password_hash
            known_otp = "482731"
            db.execute(
                "UPDATE users SET otp_hash = ?, otp_expires_at = ? WHERE email = ?",
                (generate_password_hash(known_otp), iso_after_minutes(5), test_email)
            )
            db.commit()

        # Submit correct OTP
        valid_res = self.client.post('/api/auth/verify-otp', json={"email": test_email, "otp": known_otp})
        self.assertEqual(valid_res.status_code, 200)
        self.assertIn("verified successfully", valid_res.get_json()["message"].lower())

        # Verify user is now email_verified = 1
        with app.app_context():
            db = get_db()
            user = db.execute("SELECT * FROM users WHERE email = ?", (test_email,)).fetchone()
            self.assertEqual(user["email_verified"], 1)
            self.assertIsNone(user["otp_hash"])

    def test_06_verified_user_can_login(self):
        test_email = "testuser_kalaam@example.com"
        login_payload = {
            "email": test_email,
            "password": "Password123!"
        }
        res = self.client.post('/api/auth/login', json=login_payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["user"]["email"], test_email)

        # Clean up test user
        with app.app_context():
            db = get_db()
            db.execute("DELETE FROM users WHERE email = ?", (test_email,))
            db.commit()

if __name__ == "__main__":
    unittest.main()
