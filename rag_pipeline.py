import chromadb
from sentence_transformers import SentenceTransformer
from groq import Groq
from dotenv import load_dotenv
import os

# --- Load API key ---
load_dotenv()
api_key = os.getenv("GROQ_API_KEY")

if not api_key:
    raise ValueError("GROQ_API_KEY not found! Check your .env file")

# --- Setup Groq client ---
client_groq = Groq(api_key=api_key)

# --- Load embedding model ---
print("Loading embedding model...")
embedder = SentenceTransformer("all-MiniLM-L6-v2")

# --- Connect to ChromaDB ---
client = chromadb.PersistentClient(path="./chroma_db")
collection = client.get_collection("kalam_knowledge")

print("KalaamGPT pipeline ready!")

# ============================================
# MAIN FUNCTION
# ============================================
def _retrieve_context(user_question):
    question_embedding = embedder.encode(user_question).tolist()
    results = collection.query(
        query_embeddings=[question_embedding],
        n_results=3
    )
    return "\n\n---\n\n".join(results["documents"][0])


def _generate_answer(messages):
    response = client_groq.chat.completions.create(
        model=os.getenv("GROQ_MODEL", "openai/gpt-oss-20b"),
        messages=messages
    )
    return response.choices[0].message.content


def ask_kalam(user_question):
    context = _retrieve_context(user_question)
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

    return _generate_answer([{"role": "user", "content": prompt}])


def ask_kalam_avatar(user_question, conversation_history=None):
    context = _retrieve_context(user_question)
    system_prompt = f"""You are KALAM-GPT, an intelligent conversational AI inspired by Dr. A.P.J. Abdul Kalam.

Ground factual answers in the retrieved context and the conversation. Be honest when the answer is not supported; do not invent facts or quotations.
For the Avatar's spoken conversation, answer naturally and concisely: usually one short sentence for greetings or casual conversation, and 1–3 short sentences (about 15–50 words) for ordinary questions. For complex questions, summarize the essential information briefly. Avoid unnecessary introductions, repeated information, and long lists. If the user explicitly requests detail, provide a reasonably concise detailed answer. Do not omit essential safety information to shorten an answer.
Use plain spoken prose without markdown, headings, or bullet lists. Use conversation history to resolve references and maintain continuity.

Retrieved context from Dr. Kalam's books and speeches:
{context}"""
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(conversation_history or [])
    messages.append({"role": "user", "content": user_question})
    return _generate_answer(messages)


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