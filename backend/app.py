import os
import socket


from dotenv import load_dotenv
from flask import Flask, jsonify


load_dotenv()

app = Flask(__name__)


@app.route("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "server": socket.gethostname(),
    })

if __name__ == "__main__":
    app.run(debug=True, port=5000)