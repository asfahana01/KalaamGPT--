import gc
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import app as app_module

app = app_module.app

class KalaamGPTRAGChatTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original_db_path = app_module.DB_PATH
        cls.temp_dir = tempfile.TemporaryDirectory()
        app_module.DB_PATH = os.path.join(cls.temp_dir.name, "rag-test.db")
        app_module.ensure_db()

    @classmethod
    def tearDownClass(cls):
        app_module.DB_PATH = cls.original_db_path
        gc.collect()
        cls.temp_dir.cleanup()

    def setUp(self):
        app.config['TESTING'] = True
        app.config['SECRET_KEY'] = 'test-secret'
        self.client = app.test_client()

        # Create a test user in the isolated database.
        with app.app_context():
            db = app_module.get_db()
            cursor = db.execute(
                "INSERT INTO users (name, email, password_hash, created_at, updated_at, is_active) VALUES (?, ?, ?, ?, ?, 1)",
                ("RAG Test User", "rag_test_user@example.com", "hash", "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z")
            )
            db.commit()
            self.user_id = cursor.lastrowid

    def tearDown(self):
        with app.app_context():
            db = app_module.get_db()
            db.execute("DELETE FROM users WHERE id = ?", (self.user_id,))
            db.commit()
        self.client = None

    @unittest.mock.patch("app.ask_kalam", return_value="A grounded answer about Dr. Kalam.")
    def test_01_chat_creates_capsule_and_returns_rag_response(self, ask_kalam):
        with self.client.session_transaction() as sess:
            sess['user_id'] = self.user_id
            sess['user_name'] = "RAG Test User"

        res = self.client.post('/chat', json={
            "message": "What is Dr. Kalam's vision for Indian youth?"
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("response", data)
        self.assertIn("conversation_id", data)
        self.assertIn("conversation", data)
        self.assertTrue(len(data["response"]) > 10)

        conversation_id = data["conversation_id"]

        # Check messages endpoint
        msgs_res = self.client.get(f'/api/conversations/{conversation_id}/messages')
        self.assertEqual(msgs_res.status_code, 200)
        msgs = msgs_res.get_json()["messages"]
        self.assertEqual(len(msgs), 2)
        self.assertEqual(msgs[0]["role"], "user")
        self.assertEqual(msgs[1]["role"], "assistant")

if __name__ == "__main__":
    unittest.main()