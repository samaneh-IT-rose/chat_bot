/* ═══════════════════════════════════════════════════════════════
   Chat Bot — frontend logic (bilingual FA/EN, streaming, history)
   ═══════════════════════════════════════════════════════════════ */
"use strict";

/* ─────────────── i18n ─────────────── */
const I18N = {
  fa: {
    dir: "rtl",
    app_title: "چت‌بات هوشمند",
    new_chat: "گفتگوی جدید",
    conversations: "گفتگوها",
    no_convs: "هنوز گفتگویی ندارید",
    footer_note: "قدرت‌گرفته از Ollama + Gemma 3 • کاملاً محلی و رایگان",
    model_label: "مدل",
    hero_title: "سلام! چطور می‌توانم کمک کنم؟",
    hero_sub: "یک چت‌بات محلی و رایگان با مدل Gemma 3 — همه‌چیز روی سیستم خودتان اجرا می‌شود و هیچ داده‌ای از سیستم شما خارج نمی‌شود.",
    chip1: "سلام! خودت را معرفی کن",
    chip2: "یک برنامه سفر سه‌روزه به اصفهان بنویس",
    chip3: "یک تابع پایتون برای مرتب‌سازی سریع (Quicksort) بنویس",
    composer_ph: "پیام خود را بنویسید… (Enter برای ارسال، Shift+Enter خط جدید)",
    disclaimer: "مدل به‌صورت محلی اجرا می‌شود؛ پاسخ‌ها را حتماً بررسی کنید.",
    thinking: "در حال نوشتن",
    stop_title: "توقف تولید پاسخ",
    send_title: "ارسال",
    stopped_note: "⏹ تولید پاسخ متوقف شد",
    err_ollama: "اتصال به Ollama برقرار نشد. سرویس را اجرا کنید: <code>sudo systemctl start ollama</code>",
    err_nomodel: "هیچ مدلی نصب نیست. ابتدا <code>bash install.sh</code> را اجرا کنید تا مدل رایگان Gemma 3 دانلود شود.",
    err_generic: "خطایی رخ داد. لطفاً دوباره تلاش کنید.",
    delete_confirm: "این گفتگو حذف شود؟",
    status_ok: "متصل",
    status_bad: "قطع",
    lang_btn: "EN",
  },
  en: {
    dir: "ltr",
    app_title: "AI Chat Bot",
    new_chat: "New chat",
    conversations: "Conversations",
    no_convs: "No conversations yet",
    footer_note: "Powered by Ollama + Gemma 3 • Fully local & free",
    model_label: "Model",
    hero_title: "Hi! How can I help you today?",
    hero_sub: "A free, fully local chatbot powered by Gemma 3 — everything runs on your own machine and no data ever leaves it.",
    chip1: "Hi! Introduce yourself",
    chip2: "Plan a 3-day trip to Isfahan",
    chip3: "Write a Python quicksort function",
    composer_ph: "Type your message… (Enter to send, Shift+Enter for newline)",
    disclaimer: "The model runs locally — always double-check the answers.",
    thinking: "Thinking",
    stop_title: "Stop generating",
    send_title: "Send",
    stopped_note: "⏹ Generation stopped",
    err_ollama: "Cannot reach Ollama. Start the service: <code>sudo systemctl start ollama</code>",
    err_nomodel: "No model installed. Run <code>bash install.sh</code> first to download the free Gemma 3 model.",
    err_generic: "Something went wrong. Please try again.",
    delete_confirm: "Delete this conversation?",
    status_ok: "Online",
    status_bad: "Offline",
    lang_btn: "فارسی",
  },
};

/* ─────────────── State ─────────────── */
const LS = { convs: "cb_convs", active: "cb_active", lang: "cb_lang", model: "cb_model" };

let state = {
  convs: load(LS.convs, []),
  activeId: load(LS.active, null),
  lang: load(LS.lang, "fa"),
  model: load(LS.model, null),
};
let streaming = false;
let aborter = null;

function load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v === null ? fallback : v; }
  catch { return fallback; }
}
function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function persistAll() {
  save(LS.convs, state.convs);
  save(LS.active, state.activeId);
  save(LS.lang, state.lang);
  save(LS.model, state.model);
}

const t = () => I18N[state.lang];
const activeConv = () => state.convs.find(c => c.id === state.activeId) || null;

/* ─────────────── DOM ─────────────── */
const $ = (id) => document.getElementById(id);
const els = {
  sidebar: $("sidebar"), backdrop: $("backdrop"), sideOpen: $("sideOpen"),
  sideClose: $("sideClose"), newChatBtn: $("newChatBtn"), convList: $("convList"),
  chat: $("chat"), input: $("input"), sendBtn: $("sendBtn"),
  sendIcon: $("sendIcon"), stopIcon: $("stopIcon"),
  modelSel: $("modelSel"), langBtn: $("langBtn"),
  banner: $("banner"), statusDot: $("statusDot"), statusText: $("statusText"),
};

/* ─────────────── Language ─────────────── */
function applyLang() {
  const L = t();
  document.documentElement.lang = state.lang;
  document.documentElement.dir = L.dir;
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const v = L[el.dataset.i18n];
    if (typeof v === "string") el.textContent = v;
  });
  els.langBtn.textContent = L.lang_btn;
  els.input.placeholder = L.composer_ph;
  els.sendBtn.title = L.send_title;
  document.title = `${L.app_title} | ${state.lang === "fa" ? "AI Chat Bot" : "چت‌بات هوشمند"}`;
  setStatus(lastStatus);
  renderChat();
}

els.langBtn.addEventListener("click", () => {
  state.lang = state.lang === "fa" ? "en" : "fa";
  persistAll();
  applyLang();
});

/* ─────────────── Markdown ─────────────── */
function renderMD(text) {
  if (window.marked && window.DOMPurify) {
    try {
      const html = window.marked.parse(text, { breaks: true, gfm: true });
      return `<div class="md">${window.DOMPurify.sanitize(html)}</div>`;
    } catch { /* fall through */ }
  }
  const esc = document.createElement("div");
  esc.textContent = text;
  return `<div class="md plain">${esc.innerHTML}</div>`;
}

/* ─────────────── Sidebar / conversations ─────────────── */
function newConversation() {
  const conv = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), title: "…", messages: [] };
  state.convs.unshift(conv);
  state.activeId = conv.id;
  persistAll();
  renderSidebar();
  renderChat();
  els.input.focus();
  closeSidebar();
}

els.newChatBtn.addEventListener("click", newConversation);

function renderSidebar() {
  els.convList.innerHTML = "";
  if (!state.convs.length) {
    const d = document.createElement("div");
    d.className = "conv-empty";
    d.textContent = t().no_convs;
    els.convList.appendChild(d);
    return;
  }
  for (const conv of state.convs) {
    const item = document.createElement("div");
    item.className = "conv-item" + (conv.id === state.activeId ? " active" : "");

    const title = document.createElement("span");
    title.className = "conv-title";
    title.textContent = conv.title || "…";
    title.addEventListener("click", () => {
      state.activeId = conv.id;
      persistAll();
      renderSidebar();
      renderChat();
      closeSidebar();
    });

    const del = document.createElement("button");
    del.className = "conv-del";
    del.textContent = "🗑";
    del.title = "delete";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!confirm(t().delete_confirm)) return;
      state.convs = state.convs.filter(c => c.id !== conv.id);
      if (state.activeId === conv.id) state.activeId = state.convs[0]?.id || null;
      persistAll();
      renderSidebar();
      renderChat();
    });

    item.append(title, del);
    els.convList.appendChild(item);
  }
}

/* ─────────────── Chat rendering ─────────────── */
function scrollBottom() { els.chat.scrollTop = els.chat.scrollHeight; }

function heroHTML() {
  const L = t();
  return `
    <div class="hero">
      <div class="hero-logo">🤖</div>
      <div class="hero-title">${L.hero_title}</div>
      <div class="hero-sub">${L.hero_sub}</div>
      <div class="chips">
        <button class="chip" data-chip="chip1">${L.chip1}</button>
        <button class="chip" data-chip="chip2">${L.chip2}</button>
        <button class="chip" data-chip="chip3">${L.chip3}</button>
      </div>
    </div>`;
}

function messageHTML(role, content) {
  if (role === "user") {
    return `<div class="msg user"><div class="bubble"></div></div>`;
  }
  return `<div class="msg assistant">
            <div class="avatar">🤖</div>
            <div class="msg-body"></div>
          </div>`;
}

function renderChat() {
  const conv = activeConv();
  const inner = document.createElement("div");
  inner.className = "chat-inner";

  if (!conv || !conv.messages.length) {
    inner.innerHTML = heroHTML();
    inner.querySelectorAll(".chip").forEach(ch =>
      ch.addEventListener("click", () => {
        els.input.value = ch.textContent;
        autosize();
        els.input.focus();
      })
    );
  } else {
    for (const m of conv.messages) {
      const wrap = document.createElement("div");
      wrap.innerHTML = messageHTML(m.role, m.content);
      const node = wrap.firstElementChild;
      if (m.role === "user") node.querySelector(".bubble").textContent = m.content;
      else node.querySelector(".msg-body").innerHTML = renderMD(m.content);
      inner.appendChild(node);
    }
  }

  els.chat.innerHTML = "";
  els.chat.appendChild(inner);
  scrollBottom();
}

/* ─────────────── Status / banner ─────────────── */
let lastStatus = null;
function setStatus(ok) {
  lastStatus = ok;
  els.statusDot.classList.toggle("ok", ok === true);
  els.statusDot.classList.toggle("bad", ok === false);
  els.statusText.textContent = ok === true ? t().status_ok : ok === false ? t().status_bad : "…";
  const title = ok === true
    ? (state.lang === "fa" ? "سرویس Ollama در حال اجراست" : "Ollama service is running")
    : (state.lang === "fa" ? "سرویس Ollama در دسترس نیست" : "Ollama service is unreachable");
  els.statusDot.title = title;
}

function showBanner(html) {
  els.banner.innerHTML = html;
  els.banner.classList.remove("hidden");
}
function hideBanner() { els.banner.classList.add("hidden"); }

/* ─────────────── Models ─────────────── */
async function refreshModels() {
  let ok = false, models = [];
  try {
    const res = await fetch("/api/models");
    const data = await res.json();
    ok = !!data.ok;
    models = data.models || [];
  } catch { /* offline */ }

  els.modelSel.innerHTML = "";
  if (ok && models.length) {
    hideBanner();
    for (const name of models) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      els.modelSel.appendChild(opt);
    }
    if (!models.includes(state.model)) state.model = models[0];
    els.modelSel.value = state.model;
    setStatus(true);
  } else {
    const opt = document.createElement("option");
    opt.value = "gemma3:4b";
    opt.textContent = "gemma3:4b (default)";
    els.modelSel.appendChild(opt);
    els.modelSel.value = "gemma3:4b";
    setStatus(ok === false ? false : null);
    if (!ok) showBanner(t().err_ollama);
    else showBanner(t().err_nomodel);
  }
  persistAll();
}

els.modelSel.addEventListener("change", () => {
  state.model = els.modelSel.value;
  persistAll();
});

/* ─────────────── Sending / streaming ─────────────── */
function setStreamingUI(on) {
  streaming = on;
  els.sendIcon.classList.toggle("hidden", on);
  els.stopIcon.classList.toggle("hidden", !on);
  els.sendBtn.classList.toggle("stopping", on);
  els.sendBtn.title = on ? t().stop_title : t().send_title;
}

async function send() {
  if (streaming) { aborter?.abort(); return; }

  const text = els.input.value.trim();
  if (!text) return;

  if (!activeConv()) {
    const conv = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), title: "…", messages: [] };
    state.convs.unshift(conv);
    state.activeId = conv.id;
  }
  const conv = activeConv();
  conv.messages.push({ role: "user", content: text });
  if (conv.title === "…") {
    conv.title = text.length > 34 ? text.slice(0, 34) + "…" : text;
  }
  els.input.value = "";
  autosize();
  persistAll();
  renderSidebar();
  renderChat();

  // Live assistant bubble
  const inner = els.chat.querySelector(".chat-inner");
  const wrap = document.createElement("div");
  wrap.innerHTML = messageHTML("assistant", "");
  const node = wrap.firstElementChild;
  const body = node.querySelector(".msg-body");
  body.innerHTML = `<div class="thinking">${t().thinking}<span class="dots"><span>.</span><span>.</span><span>.</span></span></div>`;
  inner.appendChild(node);
  scrollBottom();

  let acc = "";
  let first = true;
  aborter = new AbortController();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        history: conv.messages.filter(m => m.role === "user" || m.role === "assistant"),
        model: state.model || "gemma3:4b",
      }),
      signal: aborter.signal,
    });

    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        let data;
        try { data = JSON.parse(line); } catch { continue; }

        if (data.error) {
          const msg = data.error === "ollama-unreachable" ? t().err_ollama
                    : data.error === "ollama-error" ? (data.detail || t().err_generic)
                    : t().err_generic;
          if (first) node.remove();
          else { conv.messages.push({ role: "assistant", content: acc }); }
          body.innerHTML = "";
          const eb = document.createElement("div");
          eb.className = "error-bubble";
          eb.innerHTML = msg;
          inner.appendChild(eb);
          refreshModels();
          scrollBottom();
          setStreamingUI(false);
          aborter = null;
          return;
        }

        if (data.content) {
          if (first) { body.innerHTML = ""; first = false; }
          acc += data.content;
          body.innerHTML = renderMD(acc) + `<span class="cursor"></span>`;
          scrollBottom();
        }
      }
    }
  } catch (err) {
    if (err.name === "AbortError") {
      body.innerHTML = renderMD(acc) + `<div class="thinking">${t().stopped_note}</div>`;
    } else {
      if (first) node.remove();
      const eb = document.createElement("div");
      eb.className = "error-bubble";
      eb.innerHTML = t().err_ollama;
      inner.appendChild(eb);
      refreshModels();
    }
    scrollBottom();
    if (acc) conv.messages.push({ role: "assistant", content: acc });
    persistAll();
    setStreamingUI(false);
    aborter = null;
    return;
  }

  if (acc) conv.messages.push({ role: "assistant", content: acc });
  body.innerHTML = renderMD(acc);
  persistAll();
  setStreamingUI(false);
  aborter = null;
  scrollBottom();
}

els.sendBtn.addEventListener("click", send);

/* ─────────────── Composer behaviour ─────────────── */
function autosize() {
  els.input.style.height = "auto";
  els.input.style.height = Math.min(els.input.scrollHeight, 180) + "px";
}
els.input.addEventListener("input", autosize);
els.input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

/* ─────────────── Mobile sidebar ─────────────── */
function openSidebar() { els.sidebar.classList.add("open"); els.backdrop.classList.add("show"); }
function closeSidebar() { els.sidebar.classList.remove("open"); els.backdrop.classList.remove("show"); }
els.sideOpen.addEventListener("click", openSidebar);
els.sideClose.addEventListener("click", closeSidebar);
els.backdrop.addEventListener("click", closeSidebar);

/* ─────────────── Boot ─────────────── */
applyLang();
renderSidebar();
refreshModels();
autosize();
els.input.focus();
