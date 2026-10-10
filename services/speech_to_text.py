"""
Speech-to-Text helper module.
Primary STT is handled natively in the browser via Web Speech API (webkitSpeechRecognition).
This module provides backend validation, transcript sanitization, and fallback helpers.
"""

def sanitize_transcript(transcript: str) -> str:
    if not transcript:
        return ""
    cleaned = transcript.strip()
    # Remove unwanted control characters
    cleaned = "".join(ch for ch in cleaned if ord(ch) >= 32 or ch in "\n\r\t")
    return cleaned
