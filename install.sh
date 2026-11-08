#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  Chat Bot — automatic installer for Ubuntu 22.04 / 24.04 / 26.04
#  Installs: Ollama + free Gemma 3 model + Python web app
#
#  Sanctions-friendly: if ollama.com is blocked (HTTP 403, e.g. Iran),
#  it automatically falls back to GitHub Releases for Ollama and to
#  HF/ModelScope mirrors for the model GGUF — no VPN needed.
#
#  Usage:  bash install.sh
#          (with a VPN/proxy:  https_proxy=http://127.0.0.1:PORT bash install.sh)
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

MODEL="${CHAT_MODEL:-gemma3:4b}"
APP_PORT="${PORT:-8000}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
step() { echo -e "${GREEN}==>${NC} $1"; }
warn() { echo -e "${YELLOW}==>${NC} $1"; }
info() { echo -e "${CYAN}  →${NC} $1"; }
fail() { echo -e "${RED}==>${NC} $1"; exit 1; }

# never die silently — always print WHERE the install stopped
trap 'echo; fail "Install stopped unexpectedly (around line $LINENO). Scroll up — the real error is the last line above this banner."' ERR

SUDO=""
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then SUDO="sudo"; fi

# ─────────────────────────────────────────────────────────────
# ask for the sudo password ONCE, up-front, with a clear failure message
if [ -n "$SUDO" ]; then
    echo "  🔑 sudo password is needed for apt/firewall (typing is INVISIBLE —"
    echo "     check your keyboard layout is English, then press Enter):"
    if ! $SUDO -v; then
        fail "sudo authentication FAILED. Run 'bash install.sh' again and retype your login password carefully."
    fi
fi

# detect architecture (for the GitHub Releases fallback)
case "$(uname -m)" in
  x86_64)          OARCH="amd64" ;;
  aarch64|arm64)   OARCH="arm64" ;;
  *) fail "Unsupported architecture: $(uname -m)" ;;
esac

echo ""
echo "  ╭──────────────────────────────────────────────╮"
echo "  │   🤖  Chat Bot installer (Ollama + Gemma 3)   │"
echo "  ╰──────────────────────────────────────────────╯"
echo ""

# ─────────────────────────────────────────────────────────────
step "1/5 — Installing system prerequisites (curl, python3, venv, zstd)…"
export DEBIAN_FRONTEND=noninteractive
$SUDO apt-get update -y
$SUDO apt-get install -y curl ca-certificates python3 python3-venv python3-pip zstd tar

# open the web-app port in the firewall so other devices (laptop/phone on the
# same network) can reach the chat bot via http://<server-ip>:<port>
if command -v ufw >/dev/null 2>&1; then
    if [ "$($SUDO ufw status 2>/dev/null | head -n1)" != "inactive" ] && [ -n "$($SUDO ufw status 2>/dev/null)" ]; then
        info "Firewall (ufw) is active — opening port ${APP_PORT}/tcp for LAN access…"
        $SUDO ufw allow "${APP_PORT}/tcp" comment 'chat-bot web app' >/dev/null 2>&1 || true
    fi
fi

# ─────────────────────────────────────────────────────────────
install_ollama_from_github() {
    local TGZ="/tmp/ollama-linux-${OARCH}.tar.zst"
    local URL="https://github.com/ollama/ollama/releases/latest/download/ollama-linux-${OARCH}.tar.zst"
    step "Downloading Ollama from GitHub Releases (~1.5 GB — accessible from Iran)…"
    curl -fL --retry 3 --retry-delay 2 -o "$TGZ" "$URL"
    info "Extracting to /usr …"
    $SUDO tar --use-compress-program=zstd -C /usr -xf "$TGZ"
    rm -f "$TGZ"
    [ -x /usr/bin/ollama ] || fail "Ollama binary not found after extraction."
    # dedicated service user (same as the official installer)
    $SUDO useradd -r -s /usr/sbin/nologin -U -m -d /usr/share/ollama ollama 2>/dev/null || true
    $SUDO chown -R ollama:ollama /usr/share/ollama 2>/dev/null || true
    if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
        if [ ! -f /etc/systemd/system/ollama.service ]; then
            info "Creating systemd service (ollama starts on boot)…"
            $SUDO tee /etc/systemd/system/ollama.service >/dev/null <<'UNIT'
[Unit]
Description=Ollama Service
After=network-online.target

[Service]
ExecStart=/usr/bin/ollama serve
User=ollama
Group=ollama
Restart=always
RestartSec=3
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

[Install]
WantedBy=default.target
UNIT
        fi
        $SUDO systemctl daemon-reload
        $SUDO systemctl enable --now ollama 2>/dev/null || true
    else
        warn "systemd not available — starting 'ollama serve' in background…"
        nohup ollama serve >/dev/null 2>&1 &
        disown || true
    fi
}

step "2/5 — Installing Ollama (engine that runs the LLM locally)…"
if command -v ollama >/dev/null 2>&1; then
    warn "Ollama already installed — skipping ($(ollama --version 2>/dev/null | head -n1))."
else
    if curl -fsSL --max-time 30 https://ollama.com/install.sh | sh; then
        info "Ollama installed via the official script."
    else
        warn "ollama.com is not reachable from your region (HTTP 403 — sanctions)."
        warn "Falling back to GitHub Releases — no VPN needed."
        install_ollama_from_github
    fi
fi

# ─────────────────────────────────────────────────────────────
step "3/5 — Making sure the Ollama service is running…"
for i in $(seq 1 20); do
    curl -fsS http://localhost:11434/api/tags >/dev/null 2>&1 && break
    if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
        $SUDO systemctl start ollama 2>/dev/null || true
    fi
    if [ "$i" = "1" ]; then
        warn "API not up yet — trying 'ollama serve' in background…"
        (nohup ollama serve >/dev/null 2>&1 & disown || true) 2>/dev/null
    fi
    sleep 2
done
curl -fsS http://localhost:11434/api/tags >/dev/null 2>&1 \
    || fail "Ollama API is not reachable on port 11434. Try manually:  ollama serve"

# ─────────────────────────────────────────────────────────────
install_model_from_mirrors() {
    # gemma3:4b == Gemma 3 4B (Q4_K_M) — identical weights, imported from GGUF
    local GGUF="gemma-3-4b-it-Q4_K_M.gguf"
    # ModelScope (China) delivers real files and is reachable from Iran;
    # hf-mirror.com may redirect to huggingface.co; huggingface.co works with a VPN.
    local URLS=(
        "https://modelscope.cn/models/unsloth/gemma-3-4b-it-GGUF/resolve/master/$GGUF"
        "https://hf-mirror.com/unsloth/gemma-3-4b-it-GGUF/resolve/main/$GGUF"
        "https://huggingface.co/unsloth/gemma-3-4b-it-GGUF/resolve/main/$GGUF"
    )
    mkdir -p .models
    local ok=0
    for u in "${URLS[@]}"; do
        info "Mirror: $u"
        if curl -fL --retry 3 --retry-delay 2 -C - -o ".models/$GGUF" "$u"; then ok=1; break; fi
        warn "Mirror failed — trying the next one…"
    done
    [ "$ok" = "1" ] || fail "All model mirrors failed. If you have a VPN:  https_proxy=http://127.0.0.1:PORT bash install.sh"

    info "Importing GGUF into Ollama as '$MODEL'…"
    printf 'FROM ./%s\n' "$GGUF" > .models/Modelfile
    ollama create "$MODEL" -f .models/Modelfile
    rm -f ".models/$GGUF" .models/Modelfile   # weights are copied into Ollama storage
    info "Import done — temporary files cleaned."
}

step "4/5 — Downloading the FREE LLM:  $MODEL  (~2.5 GB, one time only)…"
if ollama list 2>/dev/null | awk '{print $1}' | grep -qx "$MODEL"; then
    warn "Model '$MODEL' is already present — skipping."
elif ollama pull "$MODEL"; then
    info "Model pulled from the official registry."
else
    warn "Direct download from registry.ollama.com failed (blocked in your region)."
    warn "Falling back to GGUF mirrors (hf-mirror.com / ModelScope) — no VPN needed."
    install_model_from_mirrors
fi

# ─────────────────────────────────────────────────────────────
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
echo -e "  Installed models:  $(ollama list 2>/dev/null | tail -n +2 | awk '{print $1}' | tr '\n' ' ')"
echo ""
echo -e "  Start the chat bot :  ${YELLOW}bash run.sh${NC}"
echo -e "  Then open in browser: ${YELLOW}http://localhost:${APP_PORT}${NC}"
echo ""
echo -e "  Chat in terminal (optional): ${YELLOW}ollama run ${MODEL}${NC}"
echo ""
