import chromadb
from sentence_transformers import SentenceTransformer
from groq import Groq
from dotenv import load_dotenv
import os

# --- Load API key ---
load_dotenv()
api_key = os.getenv("GROQ_API_KEY")

if not api_key:
    raise ValueError("❌ GROQ_API_KEY not found! Check your .env file")

# --- Setup Groq client ---
client_groq = Groq(api_key=api_key)

# --- Load embedding model ---
print("🧠 Loading embedding model...")
embedder = SentenceTransformer("all-MiniLM-L6-v2")

# --- Connect to ChromaDB ---
client = chromadb.PersistentClient(path="./chroma_db")
collection = client.get_collection("kalam_knowledge")

print("✅ KalaamGPT pipeline ready!")

# ============================================
# MAIN FUNCTION
# ============================================
def ask_kalam(user_question):

    # Step A: Convert question to embedding
    question_embedding = embedder.encode(user_question).tolist()

    # Step B: Search ChromaDB for top 3 relevant chunks
    results = collection.query(
        query_embeddings=[question_embedding],
        n_results=3
    )

    # Step C: Extract relevant chunks
    relevant_chunks = results["documents"][0]
    context = "\n\n---\n\n".join(relevant_chunks)

    # Step D: Build prompt
    prompt = f"""You are KalaamGPT, an intelligent conversational AI inspired by 
Dr. A.P.J. Abdul Kalam — scientist, President of India, and visionary leader.

Your responses must:
- Be grounded in Dr. Kalam's actual words, vision, and values
- Be motivational, scientific, and forward-thinking
- Reflect his love for youth, education, science, and national development
- Be honest — if the answer is not in the context, say so gracefully

Context from Dr. Kalam's books and speeches:
{context}

User's Question: {user_question}

Answer as KalaamGPT:"""

    # Step E: Send to Groq
    response = client_groq.chat.completions.create(
        model="llama-3.3-70b-versatile",  # free and fast
        messages=[
            {"role": "user", "content": prompt}
        ]
    )

    return response.choices[0].message.content


# ============================================
# TEST
# ============================================
if __name__ == "__main__":
    print("\n" + "="*50)
    print("🚀 Testing KalaamGPT RAG Pipeline")
    print("="*50)

    test_questions = [
        "What is Dr. Kalam's vision for Indian youth?",
        "What did Kalam say about failure?",
        "How should India become a developed nation?"
    ]

    for question in test_questions:
        print(f"\n❓ Question: {question}")
        print(f"💬 KalaamGPT: {ask_kalam(question)}")
        print("-"*50)