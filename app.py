from flask import Flask, request, jsonify, render_template
from rag_pipeline import ask_kalam
from dotenv import load_dotenv
import os

# ============================================
# WHAT THIS FILE DOES:
# Creates a web server that:
# - Serves the chat UI (index.html)
# - Accepts user questions via POST /chat
# - Returns KalaamGPT's answers as JSON
# ============================================

load_dotenv()

app = Flask(__name__)

# --- Route 1: Serve the chat UI ---
@app.route("/")
def home():
    return render_template("index.html")

# --- Route 2: Accept question, return answer ---
@app.route("/chat", methods=["POST"])
def chat():
    try:
        # Get the user's message from the request
        data = request.get_json()
        user_message = data.get("message", "").strip()

        # Validate input
        if not user_message:
            return jsonify({"error": "Message cannot be empty"}), 400

        # Get answer from RAG pipeline
        print(f"❓ Question: {user_message}")
        response = ask_kalam(user_message)
        print(f"💬 Answer generated successfully")

        return jsonify({"response": response})

    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({"error": "Something went wrong. Please try again."}), 500

# --- Run the app ---
if __name__ == "__main__":
    print("🚀 Starting KalaamGPT server...")
    print("📡 Open your browser at: http://localhost:5000")
    app.run(debug=True, port=5000)