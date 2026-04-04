import pymupdf4llm
import os

# ============================================
# STEP 1: Set your folders
# ============================================
pdf_folder = "raw_data"        # Put ALL your PDFs here
output_file = "knowledge_base/kalam_data.txt"

# Create knowledge_base folder if it doesn't exist
os.makedirs("knowledge_base", exist_ok=True)

# ============================================
# STEP 2: Find all PDFs automatically
# ============================================
pdf_files = [f for f in os.listdir(pdf_folder) if f.endswith(".pdf")]

print(f"📚 Found {len(pdf_files)} PDF files:")
for f in pdf_files:
    print(f"   → {f}")

# ============================================
# STEP 3: Convert each PDF and save to one file
# ============================================
with open(output_file, "w", encoding="utf-8") as out:
    
    for i, filename in enumerate(pdf_files):
        pdf_path = os.path.join(pdf_folder, filename)
        
        print(f"\n⏳ Converting ({i+1}/{len(pdf_files)}): {filename}")
        
        try:
            # Extract text from PDF
            text = pymupdf4llm.to_markdown(pdf_path)
            
            # Clean the book name for the source label
            book_name = filename.replace(".pdf", "").replace("_", " ").title()
            
            # Write source label + content + divider
            out.write(f"\n{'='*60}\n")
            out.write(f"[SOURCE: {book_name}]\n")
            out.write(f"{'='*60}\n\n")
            out.write(text)
            out.write("\n\n")
            
            print(f"   ✅ Done: {filename}")
            
        except Exception as e:
            print(f"   ❌ Failed: {filename} — Error: {e}")
            continue

print(f"\n🎉 All done! Saved to: {output_file}")

# ============================================
# STEP 4: Show a summary
# ============================================
with open(output_file, "r", encoding="utf-8") as f:
    content = f.read()
    word_count = len(content.split())
    char_count = len(content)

print(f"\n📊 Knowledge Base Summary:")
print(f"   → Total words  : {word_count:,}")
print(f"   → Total chars  : {char_count:,}")
print(f"   → PDFs merged  : {len(pdf_files)}")
print(f"   → Saved to     : {output_file}")