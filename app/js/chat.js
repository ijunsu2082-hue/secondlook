// Conversation panel under the report decoder. It sends the decoded report as
// context to /api/chat (a server function that holds the API key).
// Nothing is sent until the person has read the privacy box and agreed.
const $ = (s) => document.querySelector(s);

const GENERAL_PROMPTS = [
  "What does BI-RADS mean?",
  "What is breast density?",
  "What happens after a mammogram callback?",
];
const APPOINTMENT_PROMPT = "Help me write questions to ask at my appointment.";
const FEATURE_LINKS = {
  report: ["report", "Read a report"],
  scan: ["scan", "Try the ultrasound demo"],
  check: ["check", "When to see a doctor"],
  lab: ["lab", "Open the biopsy lab"],
};
const MAX_SENT = 18;

let report = null;          // { text, parsed } from the decoder, or null
let messages = [];          // what the server sees: { role, content }
let busy = false;
let lastUser = null;
let consented = false;      // lasts for this page visit only, so a reload asks again
const explained = new Set(); // medical words whose meaning we have already shown, so we do not repeat them

export function setReportContext(ctx) {
  report = ctx && ctx.text && ctx.text.trim() ? ctx : null;
  if (!$("#chat-log")) return;
  renderContext();
  renderSuggestions();
}

function renderContext() {
  const el = $("#chat-context");
  const b = report?.parsed?.birads?.length ? ` It shows BI-RADS ${report.parsed.birads.join(" and ")}.` : "";
  el.textContent = report
    ? "I can see the report you explained above." + b + " I will use it when I answer."
    : "You have not explained a report yet. I can still answer general questions. For answers about your own report, explain it above first.";
  $("#gate-report").textContent = report
    ? `The report you explained above (${report.text.length.toLocaleString()} characters) will be sent along with your questions.`
    : "No report text will be sent unless you explain a report above first.";
}

function renderSuggestions() {
  const prompts = report
    ? ["What does my report mean in simple words?", "What can this report not tell me?",
       report.parsed?.birads?.[0] ? `What usually happens next after BI-RADS ${report.parsed.birads[0]}?` : "What should I look at first?",
       APPOINTMENT_PROMPT]
    : [...GENERAL_PROMPTS, APPOINTMENT_PROMPT];
  const box = $("#chat-suggest");
  box.replaceChildren(...prompts.map((p) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn small";
    b.textContent = p;
    b.addEventListener("click", () => send(p));
    return b;
  }));
}

function bubble(role, content) {
  const d = document.createElement("div");
  d.className = "msg " + role;
  const who = document.createElement("span");
  who.className = "who";
  who.textContent = role === "user" ? "You" : "SecondLook";
  d.append(who);
  if (content) addText(d, content);
  $("#chat-log").append(d);
  d.scrollIntoView({ block: "nearest" });
  return d;
}

// Paragraphs and "- " lists, built with text nodes so nothing from the server is parsed as HTML.
function addText(parent, text) {
  let list = null;
  for (const line of text.split(/\n+/)) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("- ")) {
      if (!list) { list = document.createElement("ul"); parent.append(list); }
      const li = document.createElement("li");
      li.textContent = t.slice(2);
      list.append(li);
    } else {
      list = null;
      const p = document.createElement("p");
      p.textContent = t;
      parent.append(p);
    }
  }
}

function note(parent, text) {
  const n = document.createElement("div");
  n.className = "msg-note";
  n.setAttribute("role", "alert");
  n.textContent = text;
  parent.prepend(n);
}

// "Words in this answer": fixed definitions the server adds for medical words the reply did not explain.
function wordsBox(parent, words) {
  const fresh = (words || []).filter((w) => !explained.has(w.term));
  if (!fresh.length) return;
  const box = document.createElement("div");
  box.className = "msg-words";
  const title = document.createElement("b");
  title.textContent = "Words in this answer";
  const dl = document.createElement("dl");
  for (const w of fresh) {
    explained.add(w.term);
    const dt = document.createElement("dt");
    dt.textContent = w.term;
    const dd = document.createElement("dd");
    dd.textContent = w.def;
    dl.append(dt, dd);
  }
  box.append(title, dl);
  parent.append(box);
}

function featureChip(parent, feature) {
  const f = FEATURE_LINKS[feature];
  if (!f) return;
  const a = document.createElement("a");
  a.href = "#" + f[0];
  a.dataset.tab = f[0];
  a.className = "btn small chip";
  a.textContent = f[1];
  parent.append(a);
}

// Other parts of the page call this (for example "Ask the assistant to tailor these").
// If the person has not agreed yet, take them to the privacy box instead of sending anything.
export function ask(text) {
  $("#chat")?.scrollIntoView({ behavior: "smooth", block: "start" });
  if (!consented) {
    const gate = $("#chat-gate");
    gate.classList.add("flash");
    setTimeout(() => gate.classList.remove("flash"), 1600);
    $("#gate-accept").focus({ preventScroll: true });
    return Promise.resolve();
  }
  return send(text);
}

async function send(text) {
  text = (text || "").trim();
  if (!text || busy || !consented) return;
  busy = true;
  lastUser = text;
  setBusy(true);
  bubble("user", text);
  messages.push({ role: "user", content: text });
  const pending = bubble("assistant pending", "");
  pending.append(Object.assign(document.createElement("p"), { textContent: "Looking at your question..." }));

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consent: true, known: [...explained], messages: messages.slice(-MAX_SENT), report: report && { text: report.text, parsed: summarize(report.parsed) } }),
    });
    let data = null;
    try { data = await res.json(); } catch { /* not JSON */ }
    pending.remove();
    if (res.ok && data?.reply) {
      messages.push({ role: "assistant", content: data.reply });
      const b = bubble("assistant", data.reply);
      if (data.note) note(b, data.note);
      wordsBox(b, data.words);
      if (data.feature) featureChip(b, data.feature);
    } else {
      messages.pop();
      showError(data?.error || unavailableText(res.status), data?.note);
    }
  } catch {
    pending.remove();
    messages.pop();
    showError("I could not reach the assistant. Check your internet connection and try again.");
  } finally {
    busy = false;
    setBusy(false);
  }
}

const unavailableText = (status) => status === 404 || status === 405 || status === 501
  ? "The assistant is not available on this copy of SecondLook. The report explainer, ultrasound demo and symptom check still work."
  : "Something went wrong. Please try again.";

function showError(text, safetyNote) {
  const b = bubble("error", text);
  b.querySelector(".who").textContent = "Problem";
  if (safetyNote) note(b, safetyNote);
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "btn small";
  retry.textContent = "Try again";
  retry.addEventListener("click", () => { b.remove(); send(lastUser); });
  b.append(retry);
}

function setBusy(on) {
  $("#chat-send").disabled = on;
  $("#chat-input").disabled = on;
  $("#chat-log").setAttribute("aria-busy", String(on));
  if (!on) $("#chat-input").focus({ preventScroll: true });
}

// Only the parts the server prompt uses, so the request stays small.
function summarize(p) {
  if (!p) return null;
  return { birads: p.birads, density: p.density, findings: (p.findings || []).map(({ side, hour, distCm, sizeCm }) => ({ side, hour, distCm, sizeCm })) };
}

export function initChat() {
  renderContext();
  renderSuggestions();
  $("#gate-accept").addEventListener("click", () => {
    consented = true;
    $("#chat-gate").hidden = true;
    $("#chat-main").hidden = false;
    $("#chat-input").focus({ preventScroll: true });
  });
  $("#chat-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = $("#chat-input").value;
    if (!v.trim()) return;
    $("#chat-input").value = "";
    send(v);
  });
  $("#chat-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#chat-form").requestSubmit(); }
  });
  $("#chat-clear").addEventListener("click", () => {
    messages = [];
    $("#chat-log").replaceChildren();
    $("#chat-input").value = "";
  });
}
