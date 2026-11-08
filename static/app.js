/* ═══════════════════════════════════════════════════════════════
   Chat Bot — frontend logic (bilingual FA/EN, streaming, history,
   file attachments, HTML preview, xlsx/docx/pdf/pptx export)
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
    chip3: "یک صفحه HTML رنگی برای جشن تولد بساز",
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
    /* attachments */
    attach_title: "پیوست فایل (متن، کد، HTML یا عکس)",
    file_too_big: "فایل «{n}» بزرگ‌تر از حد مجاز است",
    file_unsupported: "نوع فایل «{n}» پشتیبانی نمی‌شود",
    too_many_files: "حداکثر ۴ فایل در هر پیام",
    read_fail: "خواندن فایل «{n}» ممکن نشد",
    /* export */
    export_title: "خروجی گرفتن از گفتگو",
    export_xlsx: "اکسل (Excel)",
    export_docx: "وورد (Word)",
    export_pdf: "PDF (چاپ)",
    export_pptx: "پاورپوینت",
    nothing_to_export: "چیزی برای خروجی گرفتن نیست",
    user_label: "کاربر",
    assistant_label: "دستیار",
    conv_label: "گفتگو",
    /* html preview */
    run_html: "اجرای HTML",
    preview_title: "پیش‌نمایش HTML",
    open_tab: "باز کردن در تب جدید",
    close: "بستن",
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
    chip3: "Build a colorful HTML birthday page",
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
    /* attachments */
    attach_title: "Attach a file (text, code, HTML or image)",
    file_too_big: "“{n}” is larger than the allowed size",
    file_unsupported: "Unsupported file type: “{n}”",
    too_many_files: "Max 4 files per message",
    read_fail: "Could not read “{n}”",
    /* export */
    export_title: "Export conversation",
    export_xlsx: "Excel (.xlsx)",
    export_docx: "Word (.docx)",
    export_pdf: "PDF (print)",
    export_pptx: "PowerPoint (.pptx)",
    nothing_to_export: "Nothing to export yet",
    user_label: "User",
    assistant_label: "Assistant",
    conv_label: "Conversation",
    /* html preview */
    run_html: "Run HTML",
    preview_title: "HTML preview",
    open_tab: "Open in new tab",
    close: "Close",
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

/* attachments (pending files for the next message) */
const MAX_FILES = 4;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;   // 4 MB per image
const MAX_TEXT_BYTES = 512 * 1024;          // 512 KB per text file
const INLINE_TEXT_CHARS = 6000;             // max chars inlined into the prompt
const IMAGE_EXT = ["png", "jpg", "jpeg", "webp", "bmp", "gif"];
const TEXT_EXT = ["txt","md","markdown","csv","tsv","json","js","mjs","ts","py","css","scss",
                  "xml","yaml","yml","html","htm","svg","log","ini","conf","sh","bat","ps1",
                  "c","cpp","h","java","cs","go","rb","php","sql","tex","srt","vtt"];
let pending = [];   // {name, kind:"image"|"text"|"html", b64?, text?, size}

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
const isFa = (s) => /[\u0600-\u06FF]/.test(s || "");
const fmt = (tmpl, n) => (tmpl || "").replace("{n}", n);

/* ─────────────── DOM ─────────────── */
const $ = (id) => document.getElementById(id);
const els = {
  sidebar: $("sidebar"), backdrop: $("backdrop"), sideOpen: $("sideOpen"),
  sideClose: $("sideClose"), newChatBtn: $("newChatBtn"), convList: $("convList"),
  chat: $("chat"), input: $("input"), sendBtn: $("sendBtn"),
  sendIcon: $("sendIcon"), stopIcon: $("stopIcon"),
  modelSel: $("modelSel"), langBtn: $("langBtn"),
  banner: $("banner"), statusDot: $("statusDot"), statusText: $("statusText"),
  attachBtn: $("attachBtn"), fileInput: $("fileInput"), attachBar: $("attachBar"),
  exportBtn: $("exportBtn"), exportMenu: $("exportMenu"),
  previewModal: $("previewModal"), previewFrame: $("previewFrame"),
  previewTitle: $("previewTitle"), previewClose: $("previewClose"),
  previewOpenTab: $("previewOpenTab"),
  toast: $("toast"),
};

/* ─────────────── Toast ─────────────── */
let toastTimer = null;
function showToast(msg, isError) {
  els.toast.textContent = msg;
  els.toast.classList.toggle("error", !!isError);
  els.toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.add("hidden"), 3200);
}

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
  els.attachBtn.title = L.attach_title;
  els.exportBtn.title = L.export_title;
  els.previewClose.title = L.close;
  els.previewOpenTab.title = L.open_tab;
  document.title = `${L.app_title} | ${state.lang === "fa" ? "AI Chat Bot" : "چت‌بات هوشمند"}`;
  setStatus(lastStatus);
  renderAttachBar();
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

/* wrap HTML code blocks with a ▶ Run button */
function enhanceCodeBlocks(container) {
  if (!container) return;
  container.querySelectorAll("pre > code").forEach(code => {
    const cls = code.className || "";
    const src = code.textContent || "";
    const looksHtml = /(^|\s)(language-|lang-)?html/i.test(cls) ||
                      /^\s*(<!doctype html|<html[\s>])/i.test(src);
    if (!looksHtml) return;
    const pre = code.parentElement;
    if (!pre || pre.parentElement?.classList.contains("html-wrap")) return;
    const wrap = document.createElement("div");
    wrap.className = "html-wrap";
    pre.replaceWith(wrap);
    wrap.appendChild(pre);
    const bar = document.createElement("div");
    bar.className = "html-bar";
    const btn = document.createElement("button");
    btn.className = "html-run-btn";
    btn.type = "button";
    btn.textContent = "▶ " + t().run_html;
    btn.addEventListener("click", () => openPreview(src));
    bar.appendChild(btn);
    wrap.insertBefore(bar, pre);
  });
}

/* ─────────────── HTML preview modal ─────────────── */
let previewCode = "";
function openPreview(code) {
  previewCode = code || "";
  els.previewFrame.srcdoc = previewCode;
  els.previewModal.classList.remove("hidden");
}
function closePreview() {
  els.previewFrame.srcdoc = "";
  els.previewModal.classList.add("hidden");
}
els.previewClose.addEventListener("click", closePreview);
els.previewModal.addEventListener("click", (e) => {
  if (e.target === els.previewModal) closePreview();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { closePreview(); els.exportMenu.classList.add("hidden"); }
});
els.previewOpenTab.addEventListener("click", () => {
  if (!previewCode) return;
  const blob = new Blob([previewCode], { type: "text/html" });
  window.open(URL.createObjectURL(blob), "_blank");
});

/* ─────────────── Attachments ─────────────── */
const ext = (name) => (name.split(".").pop() || "").toLowerCase();

function addFiles(list) {
  for (const file of list) {
    if (pending.length >= MAX_FILES) { showToast(t().too_many_files, true); break; }
    const e = ext(file.name);
    if (IMAGE_EXT.includes(e)) {
      if (file.size > MAX_IMAGE_BYTES) { showToast(fmt(t().file_too_big, file.name) + " (۴MB)", true); continue; }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || "");
        const b64 = dataUrl.split(",")[1] || "";
        if (!b64) { showToast(fmt(t().read_fail, file.name), true); return; }
        pending.push({ name: file.name, kind: "image", b64, thumb: dataUrl, size: file.size });
        renderAttachBar();
      };
      reader.onerror = () => showToast(fmt(t().read_fail, file.name), true);
      reader.readAsDataURL(file);
    } else if (TEXT_EXT.includes(e)) {
      if (file.size > MAX_TEXT_BYTES) { showToast(fmt(t().file_too_big, file.name) + " (512KB)", true); continue; }
      const reader = new FileReader();
      reader.onload = () => {
        pending.push({ name: file.name, kind: e === "html" || e === "htm" ? "html" : "text",
                       text: String(reader.result || ""), size: file.size });
        renderAttachBar();
      };
      reader.onerror = () => showToast(fmt(t().read_fail, file.name), true);
      reader.readAsText(file);
    } else {
      showToast(fmt(t().file_unsupported, file.name), true);
    }
  }
}

els.attachBtn.addEventListener("click", () => els.fileInput.click());
els.fileInput.addEventListener("change", () => {
  addFiles([...els.fileInput.files]);
  els.fileInput.value = "";   // allow re-adding the same file later
});

function renderAttachBar() {
  if (!pending.length) { els.attachBar.classList.add("hidden"); els.attachBar.innerHTML = ""; return; }
  els.attachBar.classList.remove("hidden");
  els.attachBar.innerHTML = "";
  for (const [i, f] of pending.entries()) {
    const chip = document.createElement("div");
    chip.className = "attach-chip";
    const icon = document.createElement("span");
    icon.className = "ac-icon";
    icon.textContent = f.kind === "image" ? "🖼" : f.kind === "html" ? "🌐" : "📎";
    if (f.kind === "image" && f.thumb) {
      const im = document.createElement("img");
      im.src = f.thumb; im.alt = "";
      icon.textContent = ""; icon.appendChild(im);
    }
    const name = document.createElement("span");
    name.className = "ac-name";
    name.textContent = f.name;
    name.title = f.name;
    chip.append(icon, name);

    if (f.kind === "html") {
      const eye = document.createElement("button");
      eye.type = "button"; eye.className = "ac-btn"; eye.textContent = "👁";
      eye.title = t().preview_title;
      eye.addEventListener("click", () => openPreview(f.text || ""));
      chip.appendChild(eye);
    }
    const del = document.createElement("button");
    del.type = "button"; del.className = "ac-btn"; del.textContent = "✕";
    del.title = "✕";
    del.addEventListener("click", () => { pending.splice(i, 1); renderAttachBar(); });
    chip.appendChild(del);
    els.attachBar.appendChild(chip);
  }
}

function buildApiMessage(text) {
  let msg = text;
  for (const f of pending) {
    if (f.kind === "text" || f.kind === "html") {
      let body = f.text || "";
      if (body.length > INLINE_TEXT_CHARS) body = body.slice(0, INLINE_TEXT_CHARS) + "\n…[truncated]";
      msg += `\n\n--- file: ${f.name} ---\n${body}\n--- end of file ---`;
    }
  }
  return msg.trim();
}

/* ─────────────── Export (xlsx / docx / pdf / pptx) ─────────────── */
function exportData() {
  const conv = activeConv();
  const msgs = (conv?.messages || []).filter(m => (m.content || "").trim());
  return { conv, msgs };
}
function stamp() {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function downloadBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

function exportXLSX(msgs) {
  const L = t();
  const rows = [["#", L.user_label + " / " + L.assistant_label, L.conv_label]];
  msgs.forEach((m, i) => rows.push([i + 1, m.role === "user" ? L.user_label : L.assistant_label, m.content]));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 5 }, { wch: 12 }, { wch: 100 }];
  XLSX.utils.book_append_sheet(wb, ws, L.conv_label.slice(0, 30));
  XLSX.writeFile(wb, `chat-${stamp()}.xlsx`);
}

function exportDOCX(msgs, title, dateStr) {
  const { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } = window.docx;
  const L = t();
  const children = [
    new Paragraph({ alignment: AlignmentType.CENTER, heading: HeadingLevel.TITLE,
                    children: [new TextRun({ text: `${L.conv_label}: ${title}`, bold: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 },
                    children: [new TextRun({ text: dateStr, italics: true, color: "888888" })] }),
  ];
  for (const m of msgs) {
    const fa = isFa(m.content);
    const label = m.role === "user" ? L.user_label : L.assistant_label;
    children.push(new Paragraph({
      bidirectional: fa, alignment: fa ? AlignmentType.RIGHT : AlignmentType.LEFT,
      spacing: { before: 240, after: 60 },
      children: [new TextRun({ text: (m.role === "user" ? "👤 " : "🤖 ") + label, bold: true, color: m.role === "user" ? "0E8A6C" : "2F5496" })],
    }));
    for (const line of m.content.split("\n")) {
      children.push(new Paragraph({
        bidirectional: fa, alignment: fa ? AlignmentType.RIGHT : AlignmentType.LEFT,
        spacing: { after: 40 },
        children: [new TextRun({ text: line })],
      }));
    }
  }
  const doc = new Document({ sections: [{ children }] });
  Packer.toBlob(doc).then(b => downloadBlob(b, `chat-${stamp()}.docx`))
    .catch(() => showToast(t().err_generic, true));
}

function exportPPTX(msgs, title, dateStr) {
  const L = t();
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: "151823" };
  titleSlide.addText(`🤖 ${L.conv_label}: ${title}`, { x: 0.5, y: 1.6, w: 9, h: 1, fontSize: 30, bold: true,
    color: "10A37F", align: "center" });
  titleSlide.addText(dateStr, { x: 0.5, y: 2.7, w: 9, h: 0.5, fontSize: 14, color: "8B93A7", align: "center" });

  const chunk = (s, n = 800) => {
    const parts = [];
    let rest = s;
    while (rest.length > n) {
      let cut = rest.lastIndexOf("\n", n);
      if (cut < n * 0.5) cut = rest.lastIndexOf(" ", n);
      if (cut < 1) cut = n;
      parts.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    parts.push(rest);
    return parts;
  };

  for (const m of msgs) {
    const fa = isFa(m.content);
    const label = m.role === "user" ? "👤 " + L.user_label : "🤖 " + L.assistant_label;
    const pieces = chunk(m.content);
    pieces.forEach((part, idx) => {
      const slide = pptx.addSlide();
      slide.background = { color: "FFFFFF" };
      slide.addText(label + (pieces.length > 1 ? `  (${idx + 1}/${pieces.length})` : ""), {
        x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 13, bold: true,
        color: m.role === "user" ? "0E8A6C" : "2F5496", align: "right", rtlMode: fa,
      });
      slide.addText(part, { x: 0.5, y: 0.9, w: 9, h: 4.5, fontSize: 14, color: "222222",
        align: "right", rtlMode: fa, valign: "top", fontFace: "Tahoma" });
    });
  }
  pptx.writeFile({ fileName: `chat-${stamp()}.pptx` }).catch(() => showToast(t().err_generic, true));
}

function exportPDF(msgs, title, dateStr) {
  const L = t();
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const blocks = msgs.map(m => {
    const fa = isFa(m.content);
    const label = (m.role === "user" ? "👤 " + L.user_label : "🤖 " + L.assistant_label);
    return `<div class="msgblk" dir="${fa ? "rtl" : "ltr"}">
      <div class="lbl ${m.role}">${esc(label)}</div>
      <div class="txt">${esc(m.content).replace(/\n/g, "<br>")}</div>
    </div>`;
  }).join("\n");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
  <style>
    @page { size: A4; margin: 18mm 16mm; }
    body { font-family: "Vazirmatn", Tahoma, "Segoe UI", sans-serif; color: #1a1a1a; font-size: 12.5px; line-height: 1.9; }
    h1 { font-size: 19px; text-align: center; margin: 0 0 4px; }
    .date { text-align: center; color: #777; font-size: 11px; margin-bottom: 22px; }
    .msgblk { margin: 0 0 16px; }
    .lbl { font-weight: 700; font-size: 12px; margin-bottom: 3px; }
    .lbl.user { color: #0e8a6c; } .lbl.assistant { color: #2f5496; }
    .txt { background: #f5f6f8; border-radius: 8px; padding: 10px 14px; overflow-wrap: anywhere; }
  </style></head><body>
  <h1>${esc(title)}</h1><div class="date">${esc(dateStr)}</div>
  ${blocks}
  </body></html>`;
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(frame);
  frame.srcdoc = html;
  frame.onload = () => {
    setTimeout(() => {
      try { frame.contentWindow.focus(); frame.contentWindow.print(); }
      catch { /* popup/print blocked */ }
      setTimeout(() => frame.remove(), 60000);
    }, 250);
  };
}

els.exportBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const open = els.exportMenu.classList.toggle("hidden");
  els.exportBtn.setAttribute("aria-expanded", String(!open));
});
document.addEventListener("click", (e) => {
  if (!els.exportMenu.classList.contains("hidden") &&
      !e.target.closest(".export-wrap")) {
    els.exportMenu.classList.add("hidden");
    els.exportBtn.setAttribute("aria-expanded", "false");
  }
});
els.exportMenu.addEventListener("click", (e) => {
  const btn = e.target.closest(".export-item");
  if (!btn) return;
  els.exportMenu.classList.add("hidden");
  const { conv, msgs } = exportData();
  if (!msgs.length) { showToast(t().nothing_to_export, true); return; }
  const L = t();
  const title = (conv?.title || L.conv_label).trim();
  const dateStr = new Date().toLocaleString(state.lang === "fa" ? "fa-IR" : "en-GB");
  try {
    if (btn.dataset.x === "xlsx") exportXLSX(msgs);
    else if (btn.dataset.x === "docx") exportDOCX(msgs, title, dateStr);
    else if (btn.dataset.x === "pptx") exportPPTX(msgs, title, dateStr);
    else if (btn.dataset.x === "pdf") exportPDF(msgs, title, dateStr);
    showToast("✔ " + (btn.dataset.x || "").toUpperCase());
  } catch (err) {
    showToast(t().err_generic, true);
  }
});

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

function messageHTML(role) {
  if (role === "user") {
    return `<div class="msg user"><div class="u-col"><div class="bubble"></div><div class="u-files"></div></div></div>`;
  }
  return `<div class="msg assistant">
            <div class="avatar">🤖</div>
            <div class="msg-body"></div>
          </div>`;
}

function fillUserFiles(node, files) {
  const box = node.querySelector(".u-files");
  if (!box || !files?.length) return;
  for (const f of files) {
    const chip = document.createElement("span");
    chip.className = "sent-file";
    chip.textContent = (f.kind === "image" ? "🖼 " : f.kind === "html" ? "🌐 " : "📎 ") + f.name;
    box.appendChild(chip);
  }
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
      wrap.innerHTML = messageHTML(m.role);
      const node = wrap.firstElementChild;
      if (m.role === "user") {
        node.querySelector(".bubble").textContent = m.content;
        fillUserFiles(node, m.files);
      } else {
        const body = node.querySelector(".msg-body");
        body.innerHTML = renderMD(m.content);
        enhanceCodeBlocks(body);
      }
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
  const files = pending.slice();
  if (!text && !files.length) return;

  if (!activeConv()) {
    const conv = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), title: "…", messages: [] };
    state.convs.unshift(conv);
    state.activeId = conv.id;
  }
  const conv = activeConv();

  const displayText = text || files.map(f => f.name).join(", ");
  conv.messages.push({ role: "user", content: displayText, files: files.map(f => ({ name: f.name, kind: f.kind })) });
  if (conv.title === "…") {
    conv.title = displayText.length > 34 ? displayText.slice(0, 34) + "…" : displayText;
  }
  els.input.value = "";
  pending = [];
  renderAttachBar();
  autosize();
  persistAll();
  renderSidebar();
  renderChat();

  // Live assistant bubble
  const inner = els.chat.querySelector(".chat-inner");
  const wrap = document.createElement("div");
  wrap.innerHTML = messageHTML("assistant");
  const node = wrap.firstElementChild;
  const body = node.querySelector(".msg-body");
  body.innerHTML = `<div class="thinking">${t().thinking}<span class="dots"><span>.</span><span>.</span><span>.</span></span></div>`;
  inner.appendChild(node);
  scrollBottom();

  const images = files.filter(f => f.kind === "image").map(f => f.b64);
  const apiMessage = buildApiMessage(text);

  let acc = "";
  let first = true;
  aborter = new AbortController();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: apiMessage,
        images,
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
          enhanceCodeBlocks(body);
          scrollBottom();
        }
      }
    }
  } catch (err) {
    if (err.name === "AbortError") {
      body.innerHTML = renderMD(acc) + `<div class="thinking">${t().stopped_note}</div>`;
      enhanceCodeBlocks(body);
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
  enhanceCodeBlocks(body);
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

/* paste images directly into the composer */
els.input.addEventListener("paste", (e) => {
  const items = [...(e.clipboardData?.files || [])];
  if (items.length) { e.preventDefault(); addFiles(items); }
});

/* drag & drop attachments */
["dragover", "drop"].forEach(ev => document.addEventListener(ev, (e) => {
  if (!e.dataTransfer?.files?.length) return;
  e.preventDefault();
  if (ev === "drop") addFiles([...e.dataTransfer.files]);
}));

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
