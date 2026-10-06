import os
import re
import sqlite3
from datetime import datetime, timezone
from functools import wraps
from typing import Any
from urllib.parse import urlparse

from flask import Flask, g, jsonify, redirect, render_template, request, session
from werkzeug.security import check_password_hash, generate_password_hash

from dotenv import load_dotenv
from rag_pipeline import ask_kalam

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///kalamgpt.db")


def get_db_path(url: str) -> str:
    if not url.startswith("sqlite://"):
        return os.path.join(BASE_DIR, "kalamgpt.db")

    relative_path = url.replace("sqlite:///", "", 1)
    if not relative_path:
        return os.path.join(BASE_DIR, "kalamgpt.db")

    if relative_path.startswith("/") or re.match(r"^[A-Za-z]:[\\/]", relative_path):
        return relative_path

    return os.path.normpath(os.path.join(BASE_DIR, relative_path))


DB_PATH = get_db_path(DATABASE_URL)


app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", "dev-secret-key-change-me")
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = False
app.config["PERMANENT_SESSION_LIFETIME"] = 86400


def get_db() -> sqlite3.Connection:
    ensure_db()
    if "db" not in g:
        connection = sqlite3.connect(DB_PATH)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        g.db = connection
    return g.db


@app.teardown_appcontext
def close_db(_: BaseException | None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def ensure_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                last_login TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                role TEXT NOT NULL DEFAULT 'user'
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                last_message_preview TEXT,
                message_count INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id INTEGER NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(user_id, updated_at DESC)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id, created_at ASC)"
        )
        conn.commit()


ensure_db()


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def serialise_user(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "role": row["role"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "last_login": row["last_login"],
        "is_active": bool(row["is_active"]),
    }


def serialise_conversation(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "title": row["title"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "last_message_preview": row["last_message_preview"],
        "message_count": row["message_count"],
    }


def serialise_message(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {
        "id": row["id"],
        "conversation_id": row["conversation_id"],
        "role": row["role"],
        "content": row["content"],
        "created_at": row["created_at"],
    }


def generate_title_from_message(message: str) -> str:
    cleaned = re.sub(r"\s+", " ", message or "").strip()
    if not cleaned:
        return "New Conversation"

    lowered = cleaned.lower()
    rules = {
        "what was dr. kalam's vision for indian youth": "Kalam's Vision for Youth",
        "what did kalam say about failure": "Kalam on Failure",
        "what did he think about failure": "Kalam on Failure",
        "what is kalam's pura vision": "PURA Vision",
        "what is pura": "PURA Vision",
        "what was kalam's vision for india": "Kalam's Vision for India",
        "how can youth contribute to nation building": "Youth and Nation Building",
        "what did kalam say about education": "Kalam on Education",
        "what did kalam say about science": "Kalam on Science",
        "what is dr. kalam's vision": "Kalam's Vision",
    }
    for phrase, title in rules.items():
        if phrase in lowered:
            return title

    title = cleaned[:55].strip()
    title = re.sub(r"\s+\S*$", "", title)
    if not title:
        return "New Conversation"
    return title[:55]


def api_login_required(func):
    @wraps(func)
    def wrapped(*args, **kwargs):
        if not session.get("user_id"):
            return jsonify({"error": "Authentication required."}), 401
        return func(*args, **kwargs)

    return wrapped


def login_required(func):
    @wraps(func)
    def wrapped(*args, **kwargs):
        if not session.get("user_id"):
            return redirect("/login")
        return func(*args, **kwargs)

    return wrapped


def get_current_user() -> dict[str, Any] | None:
    user_id = session.get("user_id")
    if not user_id:
        return None
    row = get_db().execute(
        "SELECT * FROM users WHERE id = ? AND is_active = 1",
        (user_id,),
    ).fetchone()
    return serialise_user(row)


def require_user_ownership(conversation_id: int, user_id: int | None = None):
    if user_id is None:
        user_id = session.get("user_id")
    row = get_db().execute(
        "SELECT * FROM conversations WHERE id = ? AND user_id = ?",
        (conversation_id, user_id),
    ).fetchone()
    if row is None:
        return None
    return row


def append_message(conversation_id: int, role: str, content: str) -> None:
    db = get_db()
    created = now_iso()
    db.execute(
        "INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)",
        (conversation_id, role, content, created),
    )
    message_count = db.execute(
        "SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?",
        (conversation_id,),
    ).fetchone()["count"]
    preview = content.strip()
    if len(preview) > 120:
        preview = preview[:117] + "..."
    db.execute(
        "UPDATE conversations SET updated_at = ?, message_count = ?, last_message_preview = ? WHERE id = ?",
        (created, message_count, preview, conversation_id),
    )
    db.commit()


@app.route("/")
@login_required
def home():
    return render_template("index.html")


@app.route("/login")
def login_page():
    if session.get("user_id"):
        return redirect("/")
    return render_template("login.html")


@app.route("/signup")
def signup_page():
    if session.get("user_id"):
        return redirect("/")
    return render_template("signup.html")


@app.route("/logout", methods=["POST"])
def logout_route():
    session.clear()
    return redirect("/login")


@app.route("/api/auth/signup", methods=["POST"])
def signup():
    data = request.get_json(silent=True) or {}
    name = str(data.get("full_name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    confirm_password = str(data.get("confirm_password", ""))

    if not name or not email or not password or not confirm_password:
        return jsonify({"error": "All fields are required."}), 400
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        return jsonify({"error": "Please enter a valid email address."}), 400
    if password != confirm_password:
        return jsonify({"error": "Passwords do not match."}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters long."}), 400

    db = get_db()
    existing = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        return jsonify({"error": "An account with this email already exists."}), 409

    password_hash = generate_password_hash(password)
    now = now_iso()
    cursor = db.execute(
        "INSERT INTO users (name, email, password_hash, created_at, updated_at, last_login, is_active, role) VALUES (?, ?, ?, ?, ?, ?, 1, 'user')",
        (name, email, password_hash, now, now, now),
    )
    user_id = cursor.lastrowid
    db.commit()
    session["user_id"] = user_id
    session["user_name"] = name
    user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return jsonify({"message": "Signup successful.", "user": serialise_user(user)}), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    db = get_db()
    user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid email or password."}), 401

    db.execute(
        "UPDATE users SET last_login = ?, updated_at = ? WHERE id = ?",
        (now_iso(), now_iso(), user["id"]),
    )
    db.commit()
    session["user_id"] = user["id"]
    session["user_name"] = user["name"]
    return jsonify({"message": "Login successful.", "user": serialise_user(user)})


@app.route("/api/auth/logout", methods=["POST"])
@api_login_required
def logout_api():
    session.clear()
    return jsonify({"message": "Logged out successfully."})


@app.route("/api/auth/me")
@api_login_required
def auth_me():
    user = get_current_user()
    return jsonify({"user": user})


@app.route("/api/conversations", methods=["GET"])
@api_login_required
def list_conversations():
    db = get_db()
    rows = db.execute(
        "SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC, id DESC",
        (session["user_id"],),
    ).fetchall()
    return jsonify({"conversations": [serialise_conversation(row) for row in rows]})


@app.route("/api/conversations", methods=["POST"])
@api_login_required
def create_conversation():
    data = request.get_json(silent=True) or {}
    title = str(data.get("title", "")).strip() or "New Conversation"
    user_id = session["user_id"]
    now = now_iso()
    db = get_db()
    cursor = db.execute(
        "INSERT INTO conversations (user_id, title, created_at, updated_at, last_message_preview, message_count) VALUES (?, ?, ?, ?, ?, 0)",
        (user_id, title, now, now, ""),
    )
    db.commit()
    row = db.execute("SELECT * FROM conversations WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return jsonify({"conversation": serialise_conversation(row)}), 201


@app.route("/api/conversations/<int:conversation_id>", methods=["GET"])
@api_login_required
def get_conversation(conversation_id: int):
    row = require_user_ownership(conversation_id)
    if row is None:
        return jsonify({"error": "Conversation not found."}), 404
    db = get_db()
    messages = db.execute(
        "SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC",
        (conversation_id,),
    ).fetchall()
    return jsonify({
        "conversation": serialise_conversation(row),
        "messages": [serialise_message(item) for item in messages],
    })


@app.route("/api/conversations/<int:conversation_id>", methods=["PUT"])
@api_login_required
def rename_conversation(conversation_id: int):
    row = require_user_ownership(conversation_id)
    if row is None:
        return jsonify({"error": "Conversation not found."}), 404

    data = request.get_json(silent=True) or {}
    title = str(data.get("title", "")).strip() or row["title"]
    db = get_db()
    db.execute(
        "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
        (title, now_iso(), conversation_id),
    )
    db.commit()
    updated = db.execute("SELECT * FROM conversations WHERE id = ?", (conversation_id,)).fetchone()
    return jsonify({"conversation": serialise_conversation(updated)})


@app.route("/api/conversations/<int:conversation_id>", methods=["DELETE"])
@api_login_required
def delete_conversation(conversation_id: int):
    row = require_user_ownership(conversation_id)
    if row is None:
        return jsonify({"error": "Conversation not found."}), 404

    db = get_db()
    db.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
    db.commit()
    return jsonify({"message": "Conversation deleted."})


@app.route("/api/conversations/<int:conversation_id>/messages", methods=["GET"])
@api_login_required
def get_messages(conversation_id: int):
    row = require_user_ownership(conversation_id)
    if row is None:
        return jsonify({"error": "Conversation not found."}), 404

    db = get_db()
    messages = db.execute(
        "SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC",
        (conversation_id,),
    ).fetchall()
    return jsonify({"messages": [serialise_message(item) for item in messages]})


@app.route("/chat", methods=["POST"])
@api_login_required
def chat():
    data = request.get_json(silent=True) or {}
    user_message = str(data.get("message", "")).strip()
    conversation_id = data.get("conversation_id")

    if not user_message:
        return jsonify({"error": "Message cannot be empty."}), 400

    db = get_db()
    if conversation_id:
        conversation = require_user_ownership(int(conversation_id))
        if conversation is None:
            return jsonify({"error": "Conversation not found."}), 404
        active_id = int(conversation_id)
    else:
        active_id = db.execute(
            "INSERT INTO conversations (user_id, title, created_at, updated_at, last_message_preview, message_count) VALUES (?, ?, ?, ?, ?, 0)",
            (session["user_id"], "New Conversation", now_iso(), now_iso(), ""),
        ).lastrowid
        db.commit()
        conversation = db.execute("SELECT * FROM conversations WHERE id = ?", (active_id,)).fetchone()

    if conversation["message_count"] == 0:
        title = generate_title_from_message(user_message)
        db.execute(
            "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
            (title, now_iso(), active_id),
        )

    append_message(active_id, "user", user_message)
    ai_response = ask_kalam(user_message)
    append_message(active_id, "assistant", ai_response)

    db.commit()
    updated = db.execute("SELECT * FROM conversations WHERE id = ?", (active_id,)).fetchone()
    return jsonify({
        "response": ai_response,
        "conversation_id": active_id,
        "conversation": serialise_conversation(updated),
    })


@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    print("🚀 Starting KalaamGPT server...")
    print(f"📡 Open your browser at: http://localhost:5000")
    app.run(debug=True, host="0.0.0.0", port=5000)