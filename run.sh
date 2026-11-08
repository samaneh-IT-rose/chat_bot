#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  Chat Bot — start the web app
#  Usage:  bash run.sh          (default port 8000)
#          PORT=9000 bash run.sh
#
#  The app listens on 0.0.0.0, so it is reachable from any device
#  on your network:  http://<this-machine-ip>:8000
#  (SSH tunnel alternative:  ssh -L 8000:localhost:8000 user@host)
# ═══════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-8000}"
YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

if [ ! -d .venv ]; then
    echo "❌ Not installed yet. First run:  bash install.sh"
    exit 1
fi

# friendly pre-check: is the port already taken? (old SSH tunnel / stale app instance)
if command -v ss >/dev/null 2>&1 && ss -tln 2>/dev/null | awk '{print $4}' | grep -q ":${PORT}$"; then
    echo "⚠  Port ${PORT} is already in use — probably an old SSH tunnel or a previous app instance."
    echo "     See who holds it :  ss -tlnp | grep :${PORT}"
    echo "     Free the port    :  sudo fuser -k ${PORT}/tcp     ← then run 'bash run.sh' again"
    echo "     Or another port  :  PORT=9000 bash run.sh"
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

LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"

echo ""
echo "  ╭─────────────────────────────────────────────────╮"
echo "  │  🤖  Chat Bot                                    │"
echo "  ╰─────────────────────────────────────────────────╯"
echo ""
echo "  Open in browser:"
echo -e "    • this machine :  ${YELLOW}http://localhost:${PORT}${NC}"
if [ -n "${LAN_IP}" ]; then
    echo -e "    • your network :  ${YELLOW}http://${LAN_IP}:${PORT}${NC}   ← from laptop / phone on same LAN"
    echo ""
    echo "  SSH tunnel alternative (if firewall blocks the port):"
    echo "    ssh -L ${PORT}:localhost:${PORT} \$USER@${LAN_IP}   →  then open http://localhost:${PORT}"
fi
echo ""
echo "  Stop with Ctrl+C"
echo ""
python app.py
