#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Chat Bot — a self-hosted, ChatGPT-style web chat powered by a FREE local LLM
(Gemma 3) served through Ollama. 100% local, 100% free, no API keys.

Endpoints:
    GET  /            -> web UI (templates/index.html)
    GET  /api/models  -> list models installed in the local Ollama instance
    POST /api/chat    -> NDJSON stream of {"content": "...", "done": bool}
    GET  /api/health  -> quick status of the web app + Ollama service

Environment variables:
    OLLAMA_HOST   default: http://localhost:11434
    CHAT_MODEL    default: gemma3:4b
    PORT          default: 8000
    SYSTEM_PROMPT default: bilingual-friendly helpful assistant
    CHAT_HISTORY_TURNS  default: 8      (older turns are dropped -> faster answers)
    OLLAMA_NUM_CTX      default: 3072   (context window; smaller = much faster on CPU)
    OLLAMA_NUM_PREDICT  default: 1024   (max tokens per answer)
    OLLAMA_KEEP_ALIVE   default: 30m    (keep the model in RAM so the next answer starts fast)

Author : samaneh-IT-rose
Repo   : https://github.com/samaneh-IT-rose/chat_bot
License: MIT
"""
import json
import os

import requests
from flask import (Flask, Response, jsonify, render_template, request,
                   stream_with_context)

APP_NAME = "Chat Bot"

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
DEFAULT_MODEL = os.environ.get("CHAT_MODEL", "gemma3:4b")
PORT = int(os.environ.get("PORT", "8000"))

# ── speed tuning (CPU-friendly defaults) ─────────────────────
# A small history + small context window is the #1 CPU speed-up:
# prefill time grows with every token sent to the model.
MAX_HISTORY_TURNS = int(os.environ.get("CHAT_HISTORY_TURNS", "8"))
NUM_CTX = int(os.environ.get("OLLAMA_NUM_CTX", "3072"))
NUM_PREDICT = int(os.environ.get("OLLAMA_NUM_PREDICT", "1024"))
KEEP_ALIVE = os.environ.get("OLLAMA_KEEP_ALIVE", "30m")  # model stays warm in RAM

MAX_IMAGES = 4                          # per message (Gemma 3 is multimodal)
MAX_IMAGE_B64 = 8 * 1024 * 1024         # ~6 MB per image after base64

SYSTEM_PROMPT = os.environ.get(
    "SYSTEM_PROMPT",
    "You are a helpful, friendly and knowledgeable assistant. Always answer "
    "in the same language the user writes in (e.g. Persian/Farsi or English). "
    "Be accurate, concise and well-structured. Use Markdown formatting when "
    "it improves readability.",
)

app = Flask(__name__)


def ollama_url(path: str) -> str:
    return f"{OLLAMA_HOST.rstrip('/')}{path}"


@app.get("/")
def index():
    return render_template("index.html", default_model=DEFAULT_MODEL)


@app.get("/api/health")
def health():
    """Quick status check used by the frontend to show a service indicator."""
    try:
        requests.get(ollama_url("/api/tags"), timeout=3)
        ollama_ok = True
    except requests.RequestException:
        ollama_ok = False
    return jsonify({"ok": True, "ollama": ollama_ok, "model": DEFAULT_MODEL})


@app.get("/api/models")
def models():
    """Proxy to Ollama /api/tags -> names of installed models."""
    try:
        r = requests.get(ollama_url("/api/tags"), timeout=5)
        r.raise_for_status()
        data = r.json()
        names = [m.get("name") for m in data.get("models", []) if m.get("name")]
        return jsonify({"ok": True, "models": names})
    except (requests.RequestException, ValueError):
        return jsonify({"ok": False, "models": [], "error": "ollama-unreachable"})


@app.post("/api/chat")
def chat():
    """Stream a chat completion from Ollama to the browser (NDJSON lines)."""
    payload = request.get_json(silent=True) or {}
    message = (payload.get("message") or "").strip()
    history = payload.get("history") or []
    model = (payload.get("model") or DEFAULT_MODEL).strip()
    images = payload.get("images") or []  # base64 images for multimodal models

    if not message and not images:
        return jsonify({"ok": False, "error": "empty-message"}), 400

    # keep only small, valid base64 strings (protects the local server)
    clean_images = [str(i) for i in images
                    if i and len(str(i)) <= MAX_IMAGE_B64][:MAX_IMAGES]

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for item in history[-MAX_HISTORY_TURNS:]:
        role = item.get("role")
        content = (item.get("content") or "").strip()
        # NOTE: images of past turns are intentionally NOT re-sent (speed)
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    last = {"role": "user", "content": message}
    if clean_images:
        last["images"] = clean_images
    messages.append(last)

    def generate():
        try:
            with requests.post(
                ollama_url("/api/chat"),
                json={
                    "model": model,
                    "messages": messages,
                    "stream": True,
                    "keep_alive": KEEP_ALIVE,   # no cold reload between questions
                    "options": {
                        "num_ctx": NUM_CTX,
                        "num_predict": NUM_PREDICT,
                    },
                },
                stream=True,
                timeout=(5, 300),
            ) as upstream:
                if upstream.status_code != 200:
                    try:
                        detail = upstream.json().get("error", f"HTTP {upstream.status_code}")
                    except ValueError:
                        detail = f"HTTP {upstream.status_code}"
                    yield json.dumps({"error": "ollama-error", "detail": detail},
                                     ensure_ascii=False) + "\n"
                    return

                for raw in upstream.iter_lines(decode_unicode=True):
                    if not raw:
                        continue
                    try:
                        chunk = json.loads(raw)
                    except json.JSONDecodeError:
                        continue
                    piece = chunk.get("message", {}).get("content", "")
                    done = bool(chunk.get("done", False))
                    yield json.dumps({"content": piece, "done": done},
                                     ensure_ascii=False) + "\n"
                    if done:
                        break
        except requests.RequestException as exc:
            yield json.dumps({"error": "ollama-unreachable", "detail": str(exc)},
                             ensure_ascii=False) + "\n"

    resp = Response(stream_with_context(generate()), mimetype="application/x-ndjson")
    resp.headers["Cache-Control"] = "no-cache"
    resp.headers["X-Accel-Buffering"] = "no"
    return resp


if __name__ == "__main__":
    print(f" * {APP_NAME}  ->  http://localhost:{PORT}")
    print(f" * Ollama host: {OLLAMA_HOST}  |  default model: {DEFAULT_MODEL}")
    app.run(host="0.0.0.0", port=PORT, threaded=True)
