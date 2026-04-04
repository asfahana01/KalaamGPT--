import os

# ============================================
# Folders
# ============================================
speeches_folder = "raw_speeches"    # Put all your .txt files here
output_file = "knowledge_base/kalam_data.txt"

# ============================================
# Find all .txt files
# ============================================
txt_files = [f for f in os.listdir(speeches_folder) if f.endswith(".txt")]

print(f"🎤 Found {len(txt_files)} speech/thought files:")
for f in txt_files:
    print(f"   → {f}")

# ============================================
# Append each .txt to kalam_data.txt
# ============================================
with open(output_file, "a", encoding="utf-8") as out:

    for i, filename in enumerate(txt_files):
        txt_path = os.path.join(speeches_folder, filename)

        print(f"\n⏳ Adding ({i+1}/{len(txt_files)}): {filename}")

        try:
            with open(txt_path, "r", encoding="utf-8") as f:
                content = f.read().strip()

            # Clean name for label
            speech_name = filename.replace(".txt", "").replace("_", " ").title()

            # Append to main knowledge base
            out.write(f"\n{'='*60}\n")
            out.write(f"[SOURCE: {speech_name}]\n")
            out.write(f"[TYPE: Speech/Thoughts]\n")
            out.write(f"{'='*60}\n\n")
            out.write(content)
            out.write("\n\n")

            print(f"   ✅ Added: {filename}")

        except Exception as e:
            print(f"   ❌ Failed: {filename} — Error: {e}")
            continue

# ============================================
# Final summary
# ============================================
with open(output_file, "r", encoding="utf-8") as f:
    content = f.read()
    word_count = len(content.split())
    char_count = len(content)

print(f"\n🎉 Speeches added successfully!")
print(f"\n📊 Updated Knowledge Base Summary:")
print(f"   → Total words  : {word_count:,}")
print(f"   → Total chars  : {char_count:,}")
print(f"   → Saved to     : {output_file}")