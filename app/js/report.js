// Report decoder: fixed rules (regular expressions and a hand-written glossary), no AI.
// The chat panel (chat.js) receives the parsed result as context.
import { initChat, setReportContext, ask } from "./chat.js";
import { BIRADS, DENSITY, TERMS, QUESTIONS, EXAMPLES, SOURCES } from "./knowledge.js";

const $ = (s) => document.querySelector(s);
export const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ------------------------------------------------------------------ parsing
export function parseReport(text) {
  const birads = [];
  const add = (n, l) => {
    const key = n === "4" && l ? "4" + l.toUpperCase() : n;
    if (!birads.includes(key)) birads.push(key);
  };
  for (const m of text.matchAll(/BI-?RADS\s*®?\s*(?:assessment\s*)?(?:category\s*)?[:#-]?\s*([0-6])\s*([ABC])?(?![0-9A-Za-z])/gi)) add(m[1], m[2]);
  for (const m of text.matchAll(/\bcategory\s*[:#-]?\s*([0-6])([ABC])?(?![0-9A-Za-z])/gi)) add(m[1], m[2]);

  let density = null;
  const phrases = [[/almost entirely fatty/i, "A"], [/scattered (?:areas of )?fibroglandular/i, "B"],
    [/heterogeneously dense/i, "C"], [/extremely dense/i, "D"]];
  for (const [re, d] of phrases) if (re.test(text)) { density = d; break; }
  if (!density) {
    const m = text.match(/\b(?:density|composition)\s*(?:category|type)?\s*[:-]?\s*\(?([ABCD])\)?(?=[\s.,;)]|$)/) ||
      text.match(/(?:density|composition)[^.\n]*\(\s*(?:density\s*)?([ABCD])\s*\)/i);
    if (m) density = m[1].toUpperCase();
  }

  // Locations: sentence by sentence so side, clock, distance and size belong together.
  const findings = [];
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    const clock = sentence.match(/\b(1[0-2]|[1-9])(?::(00|30))?\s*o['’]?\s*clock\b/i);
    if (!clock) continue;
    const side = (sentence.match(/\b(right|left)\b/i) || [])[1];
    const dist = sentence.match(/(\d+(?:\.\d+)?)\s*cm\s*(?:from (?:the )?nipple|FN)\b/i);
    const size = sentence.match(/measur\w*\s+(\d+(?:\.\d+)?(?:\s*x\s*\d+(?:\.\d+)?){0,2})\s*(cm|mm)\b/i);
    const hour = +clock[1] + (clock[2] === "30" ? 0.5 : 0);
    let sizeCm = null;
    if (size) {
      const dims = size[1].split(/\s*x\s*/).map(Number);
      sizeCm = Math.max(...dims) / (size[2].toLowerCase() === "mm" ? 10 : 1);
    }
    findings.push({ side: side ? side.toLowerCase() : null, hour, clockText: clock[0],
      distCm: dist ? +dist[1] : null, sizeCm, sentence: sentence.trim() });
  }
  return { birads, density, findings, terms: findTerms(text) };
}

const TERM_RE = new RegExp("\\b(" + TERMS.map((t) => t[0]).sort((a, b) => b.length - a.length)
  .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+")).join("|") + ")(?:es|s)?\\b", "gi");
const TERM_INDEX = new Map(TERMS.map(([t, tone, def]) => [t.toLowerCase(), { term: t, tone, def }]));

function findTerms(text) {
  const hits = [];
  for (const m of text.matchAll(TERM_RE)) {
    const info = TERM_INDEX.get(m[1].toLowerCase().replace(/\s+/g, " "));
    if (!info) continue;
    const before = text.slice(Math.max(0, m.index - 40), m.index);
    // Anatomy and procedure words ("lymph node") are never "absent". Only findings are.
    const negated = info.tone !== "info" && info.term !== "not parallel" && /\b(no|without|negative for)\b[^.;:\n]*$/i.test(before);
    hits.push({ start: m.index, end: m.index + m[0].length, ...info, negated });
  }
  return hits;
}

// ------------------------------------------------------------------ rendering
const TONE_LABEL = { ok: "usually a good sign", watch: "depends on the situation", act: "often leads to more tests", info: "a test or a body part" };

function scaleSvg(key) {
  const b = BIRADS[key];
  if (!b.range) return "";
  // Log-like axis so the small ranges (0-2%, 2-10%) are visible.
  const pos = (v) => (v <= 0 ? 0 : (Math.log10(v + 1) / Math.log10(101)) * 100);
  const left = pos(b.range[0]);
  const width = Math.max(pos(b.range[1]) - left, 1.6);
  return `<div class="scale" role="img" aria-label="How often this category turns out to be cancer: ${esc(b.risk)}">
      <div class="scale-bar"></div>
      <div class="scale-band" style="left:calc(${left}% - 3px);width:calc(${width}% + 6px)"></div>
      <div class="scale-ticks">${[0, 2, 10, 50, 95].map((v) => `<span style="left:${pos(v)}%">${v}%</span>`).join("")}</div>
    </div>`;
}

function biradsCard(key) {
  const b = BIRADS[key];
  return `<div class="birads tone-${b.tone}">
    <div class="cat"><span class="num">${key}</span><div><div class="muted" style="font-size:13px">BI-RADS number</div><b style="font-size:19px">${esc(b.name)}</b></div></div>
    ${scaleSvg(key)}
    <dl class="kv">
      <dt>How often this turns out to be cancer</dt><dd>${esc(b.risk)}</dd>
      <dt>What usually happens next</dt><dd>${esc(b.next)}</dd>
      <dt>In plain words</dt><dd>${esc(b.plain)}</dd>
    </dl>
    ${b.note ? `<p class="fine">${esc(b.note)}</p>` : ""}
  </div>`;
}

function densityCard(d) {
  const dots = { A: 4, B: 14, C: 34, D: 60 };
  const tiles = Object.keys(DENSITY).map((k) => {
    let circles = "";
    let seed = k.charCodeAt(0) * 97;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < dots[k]; i++) circles += `<circle cx="${10 + rnd() * 80}" cy="${8 + rnd() * 40}" r="${3 + rnd() * 4}" fill="#fff" opacity=".85"/>`;
    return `<div class="${k === d ? "on" : ""}"><svg viewBox="0 0 100 56" aria-hidden="true"><rect width="100" height="56" rx="8" fill="#3a3330"/>${circles}</svg><b>${k}</b> · ${esc(DENSITY[k].name)}</div>`;
  }).join("");
  const dense = d === "C" || d === "D";
  return `<div class="card"><h3>Breast density: ${d}, ${esc(DENSITY[d].name)}</h3>
    <p class="muted" style="margin:0">${esc(DENSITY[d].plain)} ${dense ? "About half of women over 40 have dense breasts. It is common, but it makes mammograms harder to read, and it is linked to a slightly higher chance of breast cancer." : ""}</p>
    <div class="density">${tiles}</div>
    <p class="fine">On a mammogram, dense tissue looks white, and so can a tumor. That is why dense tissue can hide a lump. Since September 10, 2024, U.S. mammogram centers have to tell every patient their breast density.
      <a href="${SOURCES.fdaDensity.url}" target="_blank" rel="noopener">FDA</a></p></div>`;
}

function breastSvg(side, findings) {
  // Clock face as the radiologist sees it, facing the patient: 12 = top, 3 = viewer's right.
  // For the RIGHT breast, 9 o'clock is the outer side; for the LEFT breast, 3 o'clock is outer.
  const R = 70, cx = 90, cy = 90;
  let marks = "";
  for (const f of findings) {
    const a = (f.hour / 12) * 2 * Math.PI;
    const r = f.distCm != null ? Math.min(f.distCm / 8, 1) * R : 0.6 * R;
    const x = cx + r * Math.sin(a), y = cy - r * Math.cos(a);
    const size = f.sizeCm ? Math.max(5, Math.min(f.sizeCm / 8 * R, 18)) : 7;
    marks += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${size.toFixed(1)}" fill="var(--act)" fill-opacity=".25" stroke="var(--act)" stroke-width="2.5"/>
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="var(--act)"/>`;
  }
  const outerLeft = side === "right";
  let ticks = "";
  for (let h = 1; h <= 12; h++) {
    const a = (h / 12) * 2 * Math.PI;
    ticks += `<text x="${(cx + (R + 12) * Math.sin(a)).toFixed(1)}" y="${(cy - (R + 12) * Math.cos(a) + 4).toFixed(1)}" font-size="10" text-anchor="middle" fill="var(--muted)">${h}</text>`;
  }
  return `<svg viewBox="0 0 180 200" role="img" aria-label="Clock diagram of the ${side} breast">
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="var(--surface-2)" stroke="var(--line)" stroke-width="2"/>
    <line x1="${cx}" y1="${cy - R}" x2="${cx}" y2="${cy + R}" stroke="var(--line)" stroke-dasharray="3 4"/>
    <line x1="${cx - R}" y1="${cy}" x2="${cx + R}" y2="${cy}" stroke="var(--line)" stroke-dasharray="3 4"/>
    <circle cx="${cx}" cy="${cy}" r="6" fill="#c98f86"/>
    ${ticks}${marks}
    <text x="${outerLeft ? 8 : 172}" y="196" font-size="10" text-anchor="${outerLeft ? "start" : "end"}" fill="var(--muted)">outer</text>
    <text x="${outerLeft ? 172 : 8}" y="196" font-size="10" text-anchor="${outerLeft ? "end" : "start"}" fill="var(--muted)">inner</text>
  </svg>`;
}

function locationCard(findings) {
  const bySide = { right: findings.filter((f) => f.side === "right"), left: findings.filter((f) => f.side === "left") };
  const rows = findings.map((f) => `<li><b>${f.side ? f.side[0].toUpperCase() + f.side.slice(1) + " breast" : "Breast"}, ${esc(f.clockText)}</b>${f.distCm != null ? `, ${f.distCm} cm from the nipple` : ""}${f.sizeCm ? `, about ${f.sizeCm} cm across (${(f.sizeCm * 10).toFixed(0)} mm)` : ""}</li>`).join("");
  return `<div class="card"><h3>Where is the finding?</h3>
    <div class="diagram">
      <figure>${breastSvg("right", bySide.right)}<figcaption>Your <b>right</b> breast</figcaption></figure>
      <figure>${breastSvg("left", bySide.left)}<figcaption>Your <b>left</b> breast</figcaption></figure>
    </div>
    <ul>${rows}</ul>
    <p class="fine">This is drawn the way radiologists describe positions, as if you are facing your doctor. 12 o’clock points toward your head.
      The spots are only a rough guide.</p></div>`;
}

function annotate(text, hits) {
  let html = "", last = 0;
  for (const h of hits) {
    if (h.start < last) continue;
    html += esc(text.slice(last, h.start));
    const cls = h.negated ? "t-info" : "t-" + h.tone;
    html += `<mark class="term ${cls}" tabindex="0" data-term="${esc(h.term)}" data-neg="${h.negated ? 1 : 0}"${h.negated ? ' style="text-decoration:line-through;text-decoration-color:var(--muted)"' : ""}>${esc(text.slice(h.start, h.end))}</mark>`;
    last = h.end;
  }
  return html + esc(text.slice(last));
}

export function renderReport(text) {
  const out = $("#report-out");
  if (!text.trim()) {
    out.innerHTML = `<div class="empty">Please paste a report first, or pick an example above.</div>`;
    setReportContext(null);
    return;
  }
  const r = parseReport(text);
  setReportContext({ text, parsed: r });
  const parts = [];

  // Summary sentence.
  const worst = [...r.birads].sort((a, b) => order(b) - order(a))[0];
  let summary = "";
  if (worst) summary += `Your report gives a <b>BI-RADS ${worst}</b> (“${esc(BIRADS[worst].name)}”). What usually happens next: ${esc(BIRADS[worst].next)} `;
  else summary += "I could not find a BI-RADS number in this text. If this is a biopsy report, look at the words explained below and ask your doctor what they mean for you. ";
  if (r.findings.length) summary += `It describes ${r.findings.length === 1 ? "one finding" : r.findings.length + " findings"}. You can see where below. `;
  summary += `<br><span class="fine">Only your doctor can tell you what this means for you. Have a question? Ask in the chat under the report. If you notice any change in your breasts, see <a href="#check" data-tab="check">When to see a doctor</a>.</span>`;
  parts.push(`<div class="card"><h3>The short version</h3><p style="margin:0">${summary}</p></div>`);

  for (const k of r.birads.sort((a, b) => order(b) - order(a))) parts.push(biradsCard(k));
  if (r.density) parts.push(densityCard(r.density));
  if (r.findings.length) parts.push(locationCard(r.findings));

  // Annotated report + glossary of words found.
  const seen = new Map();
  // A word counts as "absent" only if every mention of it is negated.
  for (const h of r.terms) if (!seen.has(h.term) || (seen.get(h.term).negated && !h.negated)) seen.set(h.term, h);
  const legend = Object.entries(TONE_LABEL).map(([t, l]) => `<span><i style="background:var(--${t})"></i>${l}</span>`).join("");
  parts.push(`<div class="card"><h3>Your report with the words explained</h3><div class="legend">${legend}<span><s>crossed out</s> = your report says it was not seen</span></div>
    <div class="annotated" style="margin-top:10px">${annotate(text, r.terms)}</div></div>`);
  if (seen.size) {
    parts.push(`<div class="card"><h3>Words from your report (${seen.size})</h3><div class="terms">${[...seen.values()].map((h) =>
      `<div class="term-row"><div><b>${esc(h.term)}</b>${h.negated ? '<span class="pill info">not seen</span>' : `<span class="pill ${h.tone}">${TONE_LABEL[h.tone]}</span>`}</div><div>${esc(h.def)}${h.negated ? " <i>Your report says this was not seen.</i>" : ""}</div></div>`).join("")}</div></div>`);
  }

  // Questions to ask.
  const qs = [];
  for (const k of r.birads) qs.push(...(QUESTIONS[k[0]] || []));
  if (r.density === "C" || r.density === "D") qs.push(...QUESTIONS.dense);
  qs.push(...QUESTIONS.family, "Can I have a copy of the full report and the images?");
  parts.push(`<div class="card"><h3>Questions to bring to your appointment</h3><ol class="questions">${[...new Set(qs)].map((q) => `<li>${esc(q)}</li>`).join("")}</ol>
    <div class="row"><button class="btn small" id="copy-questions">Copy these questions</button>
    <button class="btn small" id="tailor-questions">Ask the assistant to tailor these</button></div></div>`);
  parts.push(`<p class="src">Where the BI-RADS meanings and percentages come from: <a href="${SOURCES.acr.url}" target="_blank" rel="noopener">${esc(SOURCES.acr.label)}</a>;
    <a href="${SOURCES.acsBirads.url}" target="_blank" rel="noopener">${esc(SOURCES.acsBirads.label)}</a>. What your radiologist and doctor tell you always comes first.</p>`);

  out.innerHTML = parts.join("");
  $("#tailor-questions")?.addEventListener("click", () => ask("Help me write questions to ask at my appointment."));
  const btn = $("#copy-questions");
  btn?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText([...new Set(qs)].map((q, i) => `${i + 1}. ${q}`).join("\n"));
      btn.textContent = "Copied";
    } catch {
      btn.textContent = "Could not copy. Please select the text and copy it yourself.";
    }
  });
}

const order = (k) => ({ "1": 0, "2": 1, "3": 2, "0": 3, "4A": 4, "4": 5, "4B": 5, "4C": 6, "5": 7, "6": 8 }[k] ?? 0);

export function initReport() {
  initChat();
  const ta = $("#report-text");
  $("#report-examples").innerHTML = EXAMPLES.map((e, i) => `<button class="btn small" data-ex="${i}">Sample: ${esc(e.title)}</button>`).join("");
  $("#report-examples").addEventListener("click", (e) => {
    const b = e.target.closest("[data-ex]");
    if (!b) return;
    ta.value = EXAMPLES[+b.dataset.ex].text;
    renderReport(ta.value);
  });
  $("#report-go").addEventListener("click", () => renderReport(ta.value));
  $("#report-clear").addEventListener("click", () => {
    ta.value = "";
    setReportContext(null);
    $("#report-out").innerHTML = `<div class="empty">Pick an example above, or paste a report, then press <b>Explain this report</b>.</div>`;
  });

  // Term popovers (hover, focus or tap).
  const pop = $("#popover");
  const show = (el) => {
    const info = TERM_INDEX.get(el.dataset.term.toLowerCase());
    if (!info) return;
    pop.innerHTML = `<b>${esc(info.term)}</b>${el.dataset.neg === "1" ? "<i>Your report says this was not seen.</i> " : ""}${esc(info.def)}`;
    pop.hidden = false;
    const r = el.getBoundingClientRect();
    const w = Math.min(320, window.innerWidth - 24);
    pop.style.left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12)) + "px";
    pop.style.top = (r.bottom + 8 + pop.offsetHeight > window.innerHeight ? r.top - pop.offsetHeight - 8 : r.bottom + 8) + "px";
  };
  const out = $("#report-out");
  out.addEventListener("mouseover", (e) => e.target.matches("mark.term") && show(e.target));
  out.addEventListener("focusin", (e) => e.target.matches("mark.term") && show(e.target));
  out.addEventListener("click", (e) => e.target.matches("mark.term") && show(e.target));
  out.addEventListener("mouseout", (e) => e.target.matches("mark.term") && (pop.hidden = true));
  out.addEventListener("focusout", () => (pop.hidden = true));
  window.addEventListener("scroll", () => (pop.hidden = true), { passive: true });
  document.addEventListener("keydown", (e) => e.key === "Escape" && (pop.hidden = true));
}
