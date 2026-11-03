# 🤖 Chat Bot — چت‌بات محلی و رایگان با Gemma 3

<div dir="rtl">

## فارسی

یک چت‌بات کامل شبیه ChatGPT که **کاملاً رایگان و کاملاً محلی** روی لینوکس (اوبونتو) اجرا می‌شود. هیچ کلید API، هزینه یا اینترنت (بعد از نصب) لازم ندارد — تمام پردازش روی سیستم خودتان انجام می‌شود و هیچ داده‌ای از سیستم‌تان خارج نمی‌شود.

### ✨ امکانات

| امکانات | توضیح |
|---|---|
| 🌐 رابط وب دوزبانه | فارسی (راست‌چین) و انگلیسی با یک کلیک |
| ⚡ استریم پاسخ | نمایش پاسخ کلمه‌به‌کلمه مثل ChatGPT |
| 💾 تاریخچه گفتگوها | ذخیره در مرورگر + سایدبار گفتگوها + دکمه گفتگوی جدید |
| 📝 رندر مارک‌داون | نمایش کد، جدول، لیست و بولد داخل پاسخ‌ها |
| 🛑 توقف تولید | دکمه توقف در وسط تولید پاسخ |
| 🔀 انتخاب مدل | لیست مدل‌های نصب‌شده به‌صورت خودکار شناسایی می‌شود |
| 🧠 مغز رایگان | مدل **Gemma 3 4B** گوگل (متن‌باز، پشتیبانی از ۱۴۰+ زبان از جمله فارسی) |

### 🏗 معماری

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────────┐
│   مرورگر وب      │ ───▶ │  Flask (app.py)  │ ───▶ │  Ollama (localhost) │
│  templates/ +   │ ◀─── │  استریم NDJSON   │ ◀─── │  مدل gemma3:4b      │
│  static/        │      │  روی پورت 8000   │      │  روی پورت 11434     │
└─────────────────┘      └──────────────────┘      └─────────────────────┘
```

- **مدل LLM (رایگان و متن‌باز):** [Gemma 3 4B](https://ollama.com/library/gemma3) از گوگل — حجم دانلود ≈ ۳.۴ گیگابایت، کانتکست ۱۲۸K
- **موتور اجرا:** [Ollama](https://ollama.com) — ساده‌ترین راه اجرای LLM روی لینوکس
- **وب‌سرویس:** Python + Flask

### 🚀 نصب خودکار روی اوبونتو (روش پیشنهادی)

روی **Ubuntu 22.04 / 24.04 / 26.04** فقط دو دستور لازم است:

```bash
git clone https://github.com/samaneh-IT-rose/chat_bot.git
cd chat_bot && bash install.sh
```

اسکریپت `install.sh` به‌صورت خودکار این کارها را انجام می‌دهد:

1. نصب پیش‌نیازهای سیستمی (curl ،python3 ،venv)
2. نصب **Ollama** (موتور اجرای مدل)
3. اجرای سرویس Ollama
4. دانلود مدل رایگان **gemma3:4b** (حدود ۳.۴ گیگ — فقط بار اول)
5. ساخت محیط مجازی پایتون و نصب وابستگی‌های وب‌اپ

سپس اجرا:

```bash
bash run.sh
```

و در مرورگر باز کنید: **http://localhost:8000** 🎉

### 🔧 نصب دستی (گام‌به‌گام)

اگر می‌خواهید خودتان مرحله‌به‌مرحله نصب کنید:

```bash
# 1) پیش‌نیازهای سیستم
sudo apt update
sudo apt install -y curl ca-certificates python3 python3-venv python3-pip git

# 2) نصب Ollama (موتور اجرای مدل محلی)
curl -fsSL https://ollama.com/install.sh | sh

# 3) اجرای سرویس Ollama
sudo systemctl enable --now ollama

# 4) دانلود مدل رایگان Gemma 3 (حدود ۳.۴ گیگابایت)
ollama pull gemma3:4b

# 5) دریافت پروژه و راه‌اندازی وب‌اپ
git clone https://github.com/samaneh-IT-rose/chat_bot.git
cd chat_bot
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

### ⚙️ تنظیمات (متغیرهای محیطی)

| متغیر | پیش‌فرض | توضیح |
|---|---|---|
| `CHAT_MODEL` | `gemma3:4b` | مدل پیش‌فرض چت |
| `PORT` | `8000` | پورت وب‌اپ |
| `OLLAMA_HOST` | `http://localhost:11434` | آدرس سرویس Ollama |
| `SYSTEM_PROMPT` | دستیار دوزبانه | شخصیت/دستورالعمل مدل |

مثال تغییر مدل و پورت:

```bash
CHAT_MODEL=gemma3:1b PORT=9000 bash run.sh
```

### 🔄 مدل‌های رایگان جایگزین

| مدل | دستور دانلود | حجم | مناسب برای |
|---|---|---|---|
| Gemma 3 4B (پیش‌فرض) | `ollama pull gemma3:4b` | ~۳.۴ گیگ | تعادل کیفیت/سرعت، چندزبانه |
| Gemma 3 1B | `ollama pull gemma3:1b` | ~۰.۸ گیگ | سیستم‌های ضعیف (رم ۴ گیگ) |
| Qwen 3 4B | `ollama pull qwen3:4b` | ~۲.۶ گیگ | کیفیت بالاتر، چندزبانه |
| Llama 3.2 3B | `ollama pull llama3.2:3b` | ~۲ گیگ | سریع، انگلیسی‌محور |

بعد از دانلود، مدل را از منوی کشویی بالای صفحه انتخاب کنید.

### 🧪 استفاده از API (بدون رابط وب)

```bash
# بررسی وضعیت
curl http://localhost:8000/api/health

# لیست مدل‌های نصب‌شده
curl http://localhost:8000/api/models

# گفتگو (پاسخ به‌صورت استریم NDJSON)
curl -N http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "سلام! خودت را معرفی کن", "model": "gemma3:4b"}'
```

### 🩺 عیب‌یابی

| مشکل | راه‌حل |
|---|---|
| «اتصال به Ollama برقرار نشد» | `sudo systemctl start ollama` یا `ollama serve` |
| مدل در لیست نیست | `ollama pull gemma3:4b` و سپس رفرش صفحه |
| پورت 8000 اشغال است | `PORT=9000 bash run.sh` |
| پاسخ‌دهی کند | مدل سبک‌تر: `CHAT_MODEL=gemma3:1b bash run.sh` |
| کارت گرافیک ندارم | مشکلی نیست — روی CPU هم اجرا می‌شود (فقط کندتر) |
| `ollama.com` خطای 403 داد | نگران نباشید — اسکریپت خودکار از GitHub Releases و آینه‌های مدل ادامه می‌دهد |

**حداقل سخت‌افزار:** ۴ گیگ رم + ۶ گیگ فضای خالی (پیشنهادی: ۸ گیگ رم)

### 🇮🇷 نصب در ایران (کشورهای تحریم‌شده)

سایت `ollama.com` از ایران پاسخ **403** می‌دهد. `install.sh` به‌صورت **خودکار** این مشکل را دور می‌زند و به هیچ VPN نیازی نیست:

1. **موتور Ollama** → مستقیم از GitHub Releases دانلود و به‌صورت سرویس systemd نصب می‌شود
2. **مدل Gemma 3** → ابتدا از رجیستری رسمی تلاش می‌کند؛ اگر مسدود بود، از آینه‌های `modelscope.cn` و `hf-mirror.com` دانلود (تست‌شده: ۲.۴۹ گیگ، قابلیت Resume) و با `ollama create` به‌صورت `gemma3:4b` ایمپورت می‌شود

اگر VPN دارید، می‌توانید همه‌چیز را از منابع رسمی بگیرید:

```bash
https_proxy=http://127.0.0.1:PORT bash install.sh
```

</div>

---

## English

A complete ChatGPT-style chatbot that runs **100% free and 100% locally** on Linux (Ubuntu). No API keys, no costs, no internet needed after setup — all inference happens on your own machine.

### ✨ Features

- 🌐 **Bilingual web UI** — Persian (RTL) / English with one click
- ⚡ **Streaming responses** — token-by-token output like ChatGPT
- 💾 **Chat history** — saved in the browser, sidebar, new-chat button
- 📝 **Markdown rendering** — code blocks, tables, lists
- 🛑 **Stop generation** — abort mid-answer
- 🔀 **Model picker** — auto-detects installed Ollama models
- 🧠 **Free brain:** Google's **Gemma 3 4B** (open weights, 140+ languages)

### 🚀 Quick start (Ubuntu 22.04 / 24.04 / 26.04)

```bash
git clone https://github.com/samaneh-IT-rose/chat_bot.git
cd chat_bot && bash install.sh   # installs Ollama + gemma3:4b + web app
bash run.sh                      # start → http://localhost:8000
```

### 🏗 Architecture

```
Browser (templates/ + static/)
   │  fetch streaming (NDJSON)
   ▼
Flask app (app.py, port 8000)
   │  HTTP proxy, stream pass-through
   ▼
Ollama (localhost:11434)  ──▶  gemma3:4b (3.4 GB, free)
```

### ⚙️ Configuration

| Variable | Default | Description |
|---|---|---|
| `CHAT_MODEL` | `gemma3:4b` | default chat model |
| `PORT` | `8000` | web app port |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama service URL |
| `SYSTEM_PROMPT` | bilingual assistant | model persona |

### 🧪 API

```bash
curl http://localhost:8000/api/health
curl http://localhost:8000/api/models
curl -N http://localhost:8000/api/chat -H "Content-Type: application/json" \
  -d '{"message": "Hello!", "model": "gemma3:4b"}'
```

### 🩺 Troubleshooting

| Problem | Fix |
|---|---|
| "Cannot reach Ollama" | `sudo systemctl start ollama` or `ollama serve` |
| Model missing in list | `ollama pull gemma3:4b`, then refresh |
| Port 8000 busy | `PORT=9000 bash run.sh` |
| Slow answers | lighter model: `CHAT_MODEL=gemma3:1b bash run.sh` |
| `ollama.com` returns 403 (Iran / sanctioned regions) | Nothing to do — the installer auto-falls back to GitHub Releases + GGUF mirrors (hf-mirror.com / ModelScope). With a VPN: `https_proxy=http://127.0.0.1:PORT bash install.sh` |

**Minimum hardware:** 4 GB RAM + 6 GB free disk (8 GB RAM recommended). CPU-only works fine.

---

<div align="center">

**License:** MIT • Author: [samaneh-IT-rose](https://github.com/samaneh-IT-rose) • Model: [Gemma 3](https://ollama.com/library/gemma3) by Google DeepMind

</div>
