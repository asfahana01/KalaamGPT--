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

 📚 Knowledge Base

| Source | Count |
|---|---|
| Books by Dr. Kalam | 8 |
| Speeches & Addresses | 33 |
| **Total Words** | **2,76,000+** |

**Books included:**
- Wings of Fire
- Ignited Minds
- India 2020
- Turning Points
- My Journey
- Transcendence
- You Are Born to Blossom
- A Vision for the New Millennium

---

 ⚙️ Setup & Installation

 Prerequisites
- Python 3.10+
- Git

 1. Clone the Repository
```bash
git clone https://github.com/asfahana01/KalaamGPT--.git
cd KalaamGPT
```

 2. Create Virtual Environment
```bash
python -m venv venv
venv\Scripts\activate         Windows
source venv/bin/activate      Mac/Linux
```

 3. Install Dependencies
```bash
pip install -r requirements.txt
```

 4. Set Up API Keys

Create a `.env` file in the root directory:
```
GROQ_API_KEY=your_groq_api_key_here
```

Get a free Groq API key at: https://console.groq.com

 5. Add Your Knowledge Base

Place PDF books in `raw_data/` and run:
```bash
python convertPDF.py
python add_speeches.py
```

 6. Build the Vector Database
```bash
python ingest.py
```
> ⚠️ This takes 3–7 minutes on first run.

 7. Run KalaamGPT
```bash
python app.py
```

Open your browser at: **http://localhost:5000** 🚀

---

💬 Example Conversations

**Q: What is Dr. Kalam's vision for Indian youth?**
> *"Dr. Kalam believed the youth of India are the nation's greatest asset. He emphasized the importance of dreaming big, working hard, and combining scientific temper with strong values..."*

**Q: What did Kalam say about failure?**
> *"Dr. Kalam saw failure as a stepping stone to success. Drawing from his own experience with ISRO's early rocket failures, he taught that leaders must absorb failure and share success..."*

**Q: How should India become a developed nation?**
> *"Dr. Kalam outlined five key areas: agriculture & food processing, infrastructure, education & healthcare, information technology, and self-reliance in critical technologies..."*

---🗺️ Roadmap

- ✅Knowledge base creation (books + speeches)
- ✅ RAG pipeline with ChromaDB
- ✅ Groq LLaMA integration
- ✅ Flask backend
- ✅ Chat UI
- [ ] Image classification (multimodal support)
- [ ] Ethical alignment layer
- [ ] Deployment on HuggingFace Spaces
- [ ] Mobile responsive design
- [ ] Voice input/output

---

 🙏 Acknowledgements

This project is built as a tribute to **Dr. Avul Pakir Jainulabdeen Abdul Kalam** (1931–2015) — whose life, words, and vision continue to inspire millions of young Indians and people around the world.

> *"You have to dream before your dreams can come true."*

---

 📄 License

This project is licensed under the MIT License.

---

<p align="center">Built with ❤️ inspired by the Missile Man of India</p>