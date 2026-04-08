 🚀 KalaamGPT
 *An Intelligent Conversational AI Inspired by Dr. A.P.J. Abdul Kalam*

> *"Dream, Dream, Dream. Dreams transform into thoughts and thoughts result in action."*
> — Dr. A.P.J. Abdul Kalam

---

 📌 Overview

**KalaamGPT** is a domain-specific conversational AI grounded in the vision, values, and scientific legacy of Dr. A.P.J. Abdul Kalam — scientist, missile man, and 11th President of India.

Unlike generic AI chatbots, KalaamGPT uses a **Retrieval Augmented Generation (RAG)** architecture to answer questions directly from Dr. Kalam's books, speeches, and writings — ensuring every response is authentic, grounded, and value-aligned.

---

 ✨ Features

- 🧠 **RAG Pipeline** — Retrieves relevant content from Dr. Kalam's actual writings before generating answers
- 📚 **Rich Knowledge Base** — 8 books + 33 speeches (2,76,000+ words)
- 🔍 **Semantic Search** — ChromaDB vector database with sentence embeddings
- 💬 **Beautiful Chat UI** — Dark-themed, responsive web interface
- ⚡ **Fast Responses** — Powered by Groq's LLaMA 3.3 70B model
- 🛡️ **Value-Aligned** — Responses reflect Dr. Kalam's spirit of motivation, science, and nation-building

---

 🏗️ Architecture

```
User Question
      ↓
Flask Backend (app.py)
      ↓
RAG Pipeline (rag_pipeline.py)
      ↓
┌─────────────────────────────────┐
│  1. Embed question               │
│     (sentence-transformers)      │
│                                  │
│  2. Search ChromaDB              │
│     (top 3 relevant chunks)      │
│                                  │
│  3. Build prompt with context    │
│                                  │
│  4. Send to Groq LLaMA 3.3       │
│                                  │
│  5. Return grounded response     │
└─────────────────────────────────┘
      ↓
Chat UI Response
```

---

 📂 Project Structure

```
KalaamGPT/
├── app.py                   Flask backend server
├── rag_pipeline.py          RAG logic (embed → search → generate)
├── ingest.py                Load knowledge base into ChromaDB
├── convertPDF.py            Convert PDF books to text
├── add_speeches.py          Add speech .txt files to knowledge base
├── requirements.txt         Python dependencies
├── .env                     API keys (not pushed to GitHub)
├── .gitignore               Ignores venv, chroma_db, .env
│
├── knowledge_base/
│   └── kalam_data.txt       Combined knowledge base (books + speeches)
│
├── raw_speeches/            33 Dr. Kalam speeches (.txt format)
│
├── templates/
│   └── index.html           Chat UI
│
└── static/
    ├── style.css            Dark theme styling
    └── script.js            Frontend logic
```

---

 🛠️ Tech Stack

| Component | Technology |
|---|---|
| **Backend** | Python, Flask |
| **LLM** | Groq API (LLaMA 3.3 70B) |
| **Vector DB** | ChromaDB |
| **Embeddings** | sentence-transformers (all-MiniLM-L6-v2) |
| **PDF Parsing** | PyMuPDF4LLM |
| **Frontend** | HTML, CSS, Vanilla JavaScript |

---
