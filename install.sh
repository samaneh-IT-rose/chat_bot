#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  Chat Bot — automatic installer for Ubuntu 22.04 / 24.04 / 26.04
#  Installs: Ollama + free Gemma 3 model + Python web app
#  Usage:  bash install.sh
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

MODEL="${CHAT_MODEL:-gemma3:4b}"
APP_PORT="${PORT:-8000}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
step() { echo -e "${GREEN}==>${NC} $1"; }
warn() { echo -e "${YELLOW}==>${NC} $1"; }
fail() { echo -e "${RED}==>${NC} $1"; exit 1; }

SUDO=""
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then SUDO="sudo"; fi

echo ""
echo "  ╭──────────────────────────────────────────────╮"
echo "  │   🤖  Chat Bot installer (Ollama + Gemma 3)   │"
echo "  ╰──────────────────────────────────────────────╯"
echo ""

step "1/5 — Installing system prerequisites (curl, python3, venv)…"
export DEBIAN_FRONTEND=noninteractive
$SUDO apt-get update -y
$SUDO apt-get install -y curl ca-certificates python3 python3-venv python3-pip

step "2/5 — Installing Ollama (engine that runs the LLM locally)…"
if command -v ollama >/dev/null 2>&1; then
    warn "Ollama already installed — skipping ($(ollama --version 2>/dev/null | head -n1))."
else
    curl -fsSL https://ollama.com/install.sh | sh
fi

step "3/5 — Making sure the Ollama service is running…"
if ! curl -fsS http://localhost:11434/api/tags >/dev/null 2>&1; then
    if command -v systemctl >/dev/null 2>&1; then
        $SUDO systemctl enable --now ollama 2>/dev/null || true
        sleep 3
    fi
    if ! curl -fsS http://localhost:11434/api/tags >/dev/null 2>&1; then
        warn "API still unreachable — starting 'ollama serve' in background…"
        nohup ollama serve >/dev/null 2>&1 &
        sleep 3
    fi
fi
curl -fsS http://localhost:11434/api/tags >/dev/null 2>&1 \
    || fail "Ollama API is not reachable on port 11434. Try manually:  ollama serve"

step "4/5 — Downloading the FREE LLM:  $MODEL  (~3.4 GB, one time only)…"
if ollama list 2>/dev/null | grep -q "${MODEL%%:*}"; then
    warn "A '$MODEL' model is already present — skipping download."
else
    ollama pull "$MODEL"
fi

step "5/5 — Setting up the Python web app…"
cd "$(dirname "$0")"
[ -d .venv ] || python3 -m venv .venv
# shellcheck disable=SC1091
. .venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

echo ""
echo -e "${GREEN}─────────────────────────────────────────────────${NC}"
echo -e "${GREEN} ✔ Installation finished successfully!${NC}"
echo -e "${GREEN}─────────────────────────────────────────────────${NC}"
echo ""
echo -e "  Start the chat bot :  ${YELLOW}bash run.sh${NC}"
echo -e "  Then open in browser: ${YELLOW}http://localhost:${APP_PORT}${NC}"
echo ""
echo -e "  Chat in terminal (optional): ${YELLOW}ollama run ${MODEL}${NC}"
echo ""
