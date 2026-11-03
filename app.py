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
MAX_HISTORY_TURNS = 40  # kept inside Gemma 3's 128K context window

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

    if not message:
        return jsonify({"ok": False, "error": "empty-message"}), 400

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for item in history[-MAX_HISTORY_TURNS:]:
        role = item.get("role")
        content = (item.get("content") or "").strip()
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": message})

    def generate():
        try:
            with requests.post(
                ollama_url("/api/chat"),
                json={"model": model, "messages": messages, "stream": True},
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
