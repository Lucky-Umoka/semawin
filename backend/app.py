import os
import socket
import json

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request


load_dotenv()

GROQ_URL = "https://api.groq.com/openai/v1"
GROQ_KEY = os.environ.get("GROQ_API_KEY")
WHISPER_MODEL = "whisper-large-v3"
CHAT_MODEL = "openai/gpt-oss-20b"
SYSTEM_PROMPT = (
    "You read what a small shop owner said and turn it into one ledger entry. "
    "Reply with JSON only, using exactly these keys: "
    "type (sale, purchase or expense), item (a short lowercase name), "
    "quantity (a number), unit_price (a number), customer (a name, or empty text) "
    "and paid (true or false). "
    "A purchase is stock bought for the shop. An expense is money spent on something else, "
    "like transport or rent; for an expense use quantity 1 and put the amount in unit_price. "
    "Set paid to false only if a customer took goods on credit and has not paid yet. "
    "Write money as plain numbers: 3k means 3000. Leave out currency signs."
)
PHANTOM_TEXTS = ["you", "thank you", "thanks for watching"]

app = Flask(__name__)
app.config["Max_CONTENT_LENGTH"] = 10 * 1024 * 1024

UNIT_WORDS = ["crate", "crates", "bag", "bags", "kg", "tray", "trays",
              "bottle", "bottles", "piece", "pieces", "pcs"]
SKIP_WORDS = UNIT_WORDS + ["of", "for", "at", "on", "the", "a", "an", "each"]
SALE_WORDS = ["sold", "sell", "sale"]
PURCHASE_WORDS = ["bought", "buy", "purchased", "restocked", "restock"]
EXPENSE_WORDS = ["paid", "spent", "expense", "pay"]
CREDIT_WORDS = ["credit", "owes", "owed", "later"]

def tidy(number):
    if number == int(number):
        return int(number)
    return round(number, 2)


def to_number(word):
    word = word.replace(",", "")
    multiplier = 1
    if word.lower().endswith("k"):
        multiplier = 1000
        word = word[:-1]
    if word == "" or not word[0].isdigit():
        return None
    try:
        number = float(word) * multiplier
    except ValueError:
        return None
    if number > 1000000000
        return None
    return tidy(number)


def make_entry(entry_type, item, quantity, unit_price, customer, paid):
    return {
        "type": entry_type,
        "item": item,
        "quantity": quantity,
        "unit_price": unit_price,
        "total": round(quantity * unit_price, 2),
        "customer": customer,
        "paid": paid,
    }


def simple_parse(text):
    words = [w.strip(".,!?") for w in text.split()]
    lowered = [w.lower() for w in words]

    entry_type = None
    if any(w in SALE_WORDS for w in lowered):
        entry_type = "sale"
    elif any(w in PURCHASE_WORDS for w in lowered):
        entry_type = "purchase"
    elif any(w in EXPENSE_WORDS for w in lowered):
        entry_type = "expense"
    if entry_type is None:
        return None

    numbers = []
    for position, word in enumerate(words):
        value = to_number(word)
        if value is not None:
            numbers.append((position, value))
    if len(numbers) == 0:
        return None

    if len(numbers) >= 2:
        quantity = numbers[0][1]
        unit_price = numbers[1][1]
    else:
        quantity = 1
        unit_price = numbers[0][1]

    item = "item"
    for word in lowered[numbers[0][0] + 1:]:
        if word in SKIP_WORDS or to_number(word) is not None:
            continue
        item = word
        break

    paid = True
    for word in lowered:
        if word in CREDIT_WORDS:
            paid = False

    return make_entry(entry_type, item, quantity, unit_price, "", paid)

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