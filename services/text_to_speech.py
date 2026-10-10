import re

def clean_text_for_speech(raw_text: str) -> str:
    """
    Cleans markdown formatting, citations, URLs, code blocks, and special characters
    from RAG responses so that Text-to-Speech (TTS) engine reads a smooth, natural spoken text.
    """
    if not raw_text:
        return ""

    text = raw_text

    # Remove code blocks ```code```
    text = re.sub(r"```[\s\S]*?```", " Code block omitted. ", text)

    # Remove inline code `code`
    text = re.sub(r"`([^`]+)`", r"\1", text)

    # Remove URLs
    text = re.sub(r"https?://\S+|www\.\S+", "", text)

    # Remove markdown headers (# Title)
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)

    # Remove bold, italic, strikethrough (*, **, __, ~~)
    text = re.sub(r"\*{1,3}(.*?)\*{1,3}", r"\1", text)
    text = re.sub(r"_{1,3}(.*?)_{1,3}", r"\1", text)
    text = re.sub(r"~~(.*?)~~", r"\1", text)

    # Remove markdown blockquotes (> text)
    text = re.sub(r"^>\s+", "", text, flags=re.MULTILINE)

    # Remove horizontal rules (--- or ***)
    text = re.sub(r"^[\*\-_]{3,}$", "", text, flags=re.MULTILINE)

    # Remove bullet points (- Item or * Item)
    text = re.sub(r"^[\*\-]\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\d+\.\s+", "", text, flags=re.MULTILINE)

    # Remove markdown links [text](url) -> text
    text = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", text)

    # Remove markdown table structures
    text = re.sub(r"\|", " ", text)
    text = re.sub(r"^[:\-\s|]+$", "", text, flags=re.MULTILINE)

    # Clean up excess whitespace & newlines
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    cleaned = " ".join(lines)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    return cleaned
