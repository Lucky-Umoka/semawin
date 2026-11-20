import os
import socket

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request


load_dotenv()

GROQ_URL = "https://api.groq.com/openai/v1"
GROQ_KEY = os.environ.get("GROQ_API_KEY")
WHISPER_MODEL = "whisper-large-v3"
PHANTOM_TEXTS = ["you", "thank you", "thanks for watching"]

app = Flask(__name__)
app.config["Max_CONTENT_LENGTH"] = 10 * 1024 * 1024

@app.route("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "server": socket.gethostname(),
    })

@app.errorhandler(413)
def too_big(error):
    return jsonify({"error": "That recording is too large."}), 413


@app.route("/api/transcribe", methods=["POST"])
def transcribe():
    if not GROQ_KEY:
        return jsonify({"error": "The server has no Groq key set."}), 500

    audio = request.files.get("audio")
    if audio is None:
        return jsonify({"error": "No audio was sent."}), 400

    audio_bytes = audio.read()
    if len(audio_bytes) < 2000:
        return jsonify({"error": "The recording is too short. Please try again."}), 400

    try:
        reply = requests.post(
            GROQ_URL + "/audio/transcriptions",
            headers={"Authorization": "Bearer " + GROQ_KEY},
            files={"file": (audio.filename or "voice.webm", audio_bytes, audio.mimetype)},
            data={"model": WHISPER_MODEL, "response_format": "json"},
            timeout=60, 
        )
        
    except requests.exceptions.RequestException as error:
        print("Groq call failed:", error)
        return jsonify({"error": "Could not reach the speech service. You can type the entry instead."}), 502

    if reply.status_code == 429:
        return jsonify({"error": "Too many request right now. Wait a minute or type the entry."}), 429

    if reply.status_code != 200:
        return jsonify({"error": "The speech service had a problem. You can type the entry instead."}), 502

    text = reply.json().get("text", "").strip()
    cleaned = text.lower().strip(" .!")
    if cleaned == "" or cleaned in PHANTOM_TEXTS:
        return jsonify({"error": "I could not hear anything clearly. Please try again."}), 422

    return jsonify({"text": text})


if __name__ == "__main__":
    app.run(debug=True, port=5000)