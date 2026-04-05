import chromadb
from sentence_transformers import SentenceTransformer
import os

# ============================================
# WHAT THIS FILE DOES:
# Reads kalam_data.txt → splits into chunks
# → converts to embeddings → stores in ChromaDB
# Run this ONCE to build your vector database
# ============================================

# --- Step 1: Load the knowledge base file ---
print("📖 Loading knowledge base...")
with open("knowledge_base/kalam_data.txt", "r", encoding="utf-8") as f:
    full_text = f.read()

print(f"   → Loaded {len(full_text):,} characters")

# --- Step 2: Split text into chunks ---
# Why chunks? LLMs can't process 1.7M chars at once
# We split into small pieces and search only relevant ones

def split_into_chunks(text, chunk_size=300, overlap=50):
    """
    Split text into overlapping word chunks.
    chunk_size = words per chunk
    overlap = shared words between chunks (keeps context)
    """
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i:i+chunk_size])
        chunks.append(chunk)
        i += chunk_size - overlap  # overlap keeps context
    return chunks

print("\n✂️  Splitting into chunks...")
chunks = split_into_chunks(full_text, chunk_size=300, overlap=50)
print(f"   → Created {len(chunks):,} chunks")

# --- Step 3: Load embedding model ---
# This model converts text into numbers (vectors)
# Similar texts will have similar vectors
print("\n🧠 Loading embedding model...")
print("   → This may take 1-2 minutes on first run...")
model = SentenceTransformer("all-MiniLM-L6-v2")
print("   → Model loaded! ✅")

# --- Step 4: Connect to ChromaDB ---
# ChromaDB stores our vectors locally in a folder
print("\n🗄️  Connecting to ChromaDB...")
client = chromadb.PersistentClient(path="./chroma_db")

# Delete existing collection if rebuilding
try:
    client.delete_collection("kalam_knowledge")
    print("   → Cleared old collection")
except:
    pass

# Create fresh collection
collection = client.create_collection(
    name="kalam_knowledge",
    metadata={"hnsw:space": "cosine"}  # cosine similarity for better search
)
print("   → Collection created! ✅")

# --- Step 5: Generate embeddings and store ---
print(f"\n⚡ Generating embeddings for {len(chunks):,} chunks...")
print("   → This is the slow part, grab a chai! ☕")
print("   → Usually takes 3-7 minutes...")

# Process in batches of 100 to avoid memory issues
batch_size = 100
total_batches = (len(chunks) // batch_size) + 1

for i in range(0, len(chunks), batch_size):
    batch = chunks[i:i+batch_size]
    batch_num = (i // batch_size) + 1
    
    # Generate embeddings for this batch
    embeddings = model.encode(batch).tolist()
    
    # Create unique IDs for each chunk
    ids = [f"chunk_{i+j}" for j in range(len(batch))]
    
    # Store in ChromaDB
    collection.add(
        documents=batch,
        embeddings=embeddings,
        ids=ids
    )
    
    print(f"   → Batch {batch_num}/{total_batches} done ✅")

# --- Step 6: Verify everything worked ---
print(f"\n🎉 Ingestion Complete!")
print(f"\n📊 ChromaDB Summary:")
print(f"   → Total chunks stored : {collection.count():,}")
print(f"   → Saved to            : ./chroma_db/")
print(f"\n✅ Your KalaamGPT knowledge base is ready!")
print(f"   → Now run: python rag_pipeline.py")