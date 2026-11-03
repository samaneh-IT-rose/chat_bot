#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  Chat Bot — start the web app
#  Usage:  bash run.sh          (default port 8000)
#          PORT=9000 bash run.sh
# ═══════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-8000}"

if [ ! -d .venv ]; then
    echo "❌ Not installed yet. First run:  bash install.sh"
    exit 1
fi

# make sure Ollama is up (best effort)
if ! curl -fsS http://localhost:11434/api/tags >/dev/null 2>&1; then
    echo "⚠  Ollama is not reachable — trying to start the service…"
    (sudo systemctl start ollama 2>/dev/null || nohup ollama serve >/dev/null 2>&1 &) || true
    sleep 3
fi

# shellcheck disable=SC1091
. .venv/bin/activate

echo ""
echo "  🤖  Chat Bot  →  http://localhost:${PORT}   (stop with Ctrl+C)"
echo ""
python app.py
