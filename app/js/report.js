// Report decoder: fixed rules (regular expressions and a hand-written glossary), no AI.
// The chat panel (chat.js) receives the parsed result as context.
import { initChat, setReportContext, ask } from "./chat.js";
import { BIRADS, DENSITY, TERMS, QUESTIONS, EXAMPLES, SOURCES } from "./knowledge.js";
import { checkReport, describeBirads, LEVELS } from "./sanity.js";

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
  // Every valid clock mention in a sentence becomes its own finding. Positions that are not 1 to 12 are
  // not matched here on purpose. sanity.js reports them so they are never dropped without a word.
  const findings = [];
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    const clocks = [...sentence.matchAll(/\b(1[0-2]|[1-9])(?::(00|30))?\s*o['’]?\s*clock\b/gi)];
    clocks.forEach((clock, i) => {
      const multi = clocks.length > 1;
      // One clock in the sentence: look at the whole sentence. Several: only the words around this one.
      const after = multi
        ? sentence.slice(clock.index + clock[0].length, i + 1 < clocks.length ? clocks[i + 1].index : sentence.length)
        : sentence;
      const sideWords = [...sentence.slice(0, clock.index).matchAll(/\b(right|left)\b/gi)];
      const firstSide = (sentence.match(/\b(right|left)\b/i) || [])[1];
      const side = multi ? (sideWords.length ? sideWords[sideWords.length - 1][1] : firstSide) : firstSide;
      const dist = after.match(/(\d+(?:\.\d+)?)\s*cm\s*(?:from (?:the )?nipple|FN)\b/i);
      const size = after.match(/measur\w*\s+(\d+(?:\.\d+)?(?:\s*x\s*\d+(?:\.\d+)?){0,2})\s*(cm|mm)\b/i);
      const hour = +clock[1] + (clock[2] === "30" ? 0.5 : 0);
      let sizeCm = null;
      if (size) {
        const dims = size[1].split(/\s*x\s*/).map(Number);
        sizeCm = Math.max(...dims) / (size[2].toLowerCase() === "mm" ? 10 : 1);
      }
      findings.push({ side: side ? side.toLowerCase() : null, hour, clockText: clock[0],
        distCm: dist ? +dist[1] : null, sizeCm, sentence: sentence.trim() });
    });
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

// The extra check never breaks the decoder. If it fails, say so instead of showing nothing.
function safeCheck(text) {
  try {
    return checkReport(text);
  } catch {
    return {
      warnings: [{ id: "check-failed", level: "unreadable", label: LEVELS.unreadable, title: "We could not finish checking this report",
        detail: "The extra check that looks for typing mistakes and parts that do not match did not finish. The explanation below was still made, but please read the original report carefully.",
        question: "Can you read my report with me and confirm that all the numbers and words are right?", evidence: [], spans: [] }],
      notes: [], facts: { birads: [], clock: [], measurements: [], family: { stated: false } }, hasIssues: true,
    };
  }
}

// BI-RADS numbers that only look like they come from an earlier exam are not "current" for this report.
function currentBirads(r, check) {
  const facts = (check && check.facts && check.facts.birads) || [];
  return r.birads.filter((k) => {
    const m = facts.filter((b) => b.category === k);
    return !m.length || m.some((b) => b.current);
  });
}

// Questions for the doctor. Questions that came from a warning come first. The family history question is
// neutral unless the report itself states a family history.
export function buildQuestions(r, check) {
  const qs = [];
  for (const w of (check && check.warnings) || []) if (w.question) qs.push(w.question);
  for (const k of currentBirads(r, check)) qs.push(...(QUESTIONS[k[0]] || []));
  if (r.density === "C" || r.density === "D") qs.push(...QUESTIONS.dense);
  const stated = !!(check && check.facts && check.facts.family && check.facts.family.stated);
  qs.push(...(stated ? QUESTIONS.familyStated : QUESTIONS.family), "Can I have a copy of the full report and the images?");
  return [...new Set(qs)];
}

function biradsCard(key, tag) {
  const b = BIRADS[key];
  const earlier = tag === "earlier";
  const tagHtml = tag === "earlier" ? `<span class="birads-tag">Looks like an earlier exam</span>`
    : tag === "several" ? `<span class="birads-tag">One of several numbers in this report</span>` : "";
  return `<div class="birads tone-${b.tone}">
    ${tagHtml}
    <div class="cat"><span class="num">${key}</span><div><div class="muted" style="font-size:13px">BI-RADS number</div><b style="font-size:19px">${esc(b.name)}</b></div></div>
    <p class="fine" style="margin:8px 0 0">BI-RADS is a score from 0 to 6 that radiologists (the doctors who read breast pictures) use to sum up what they saw and what should happen next.</p>
    ${scaleSvg(key)}
    <dl class="kv">
      <dt>How often this turns out to be cancer</dt><dd>${esc(b.risk)}</dd>
      <dt>What usually happens next</dt><dd>${earlier ? "This number looks like it is from an earlier exam, so these next steps may not apply now. " : ""}${esc(b.next)}</dd>
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

// Clock positions the diagram cannot use (not 1 to 12, or an odd format). They are listed, never dropped quietly.
function unplacedClocks(check) {
  const seen = new Set();
  const out = [];
  for (const c of (check && check.facts && check.facts.clock) || []) {
    if (c.valid) continue;
    const key = c.raw.toLowerCase();
    if (!seen.has(key)) { seen.add(key); out.push(c.raw); }
  }
  return out;
}

function locationCard(findings, check) {
  const bySide = { right: findings.filter((f) => f.side === "right"), left: findings.filter((f) => f.side === "left") };
  const rows = findings.map((f) => `<li><b>${f.side ? f.side[0].toUpperCase() + f.side.slice(1) + " breast" : "Breast"}, ${esc(f.clockText)}</b>${f.distCm != null ? `, ${f.distCm} cm from the nipple` : ""}${f.sizeCm ? `, about ${f.sizeCm} cm across (${(f.sizeCm * 10).toFixed(0)} mm)` : ""}${f.sizeCm >= 10 ? ' <span class="flag-chip">Check this size</span>' : ""}</li>`).join("");
  const unplaced = unplacedClocks(check);
  const unplacedHtml = unplaced.length
    ? `<div class="unplaced"><b>Positions we could not place</b>
        <p>These are not drawn on the diagram. Breast positions are described like the numbers on a clock, from 1 to 12, and these do not fit. They may be a typing or copy mistake. Your doctor may also have written them on purpose. Please check the original report.</p>
        <ul>${unplaced.map((raw) => `<li><code>${esc(raw)}</code></li>`).join("")}</ul></div>`
    : "";
  const diagrams = findings.length
    ? `<div class="diagram">
      <figure>${breastSvg("right", bySide.right)}<figcaption>Your <b>right</b> breast</figcaption></figure>
      <figure>${breastSvg("left", bySide.left)}<figcaption>Your <b>left</b> breast</figcaption></figure>
    </div>
    <ul>${rows}</ul>
    <p class="fine">This is drawn the way radiologists describe positions, as if you are facing your doctor. 12 o’clock points toward your head.
      The spots are only a rough guide.</p>`
    : "";
  return `<div class="card"><h3>Where is the finding?</h3>${diagrams}${unplacedHtml}</div>`;
}

// Warning area shown first when the text has a value that looks wrong or parts that do not seem to match.
function sanityCard(check) {
  const items = check.warnings.map((w) => `<li>
      <span class="lvl lvl-${esc(w.level)}">${esc(w.label || LEVELS[w.level] || "Needs checking")}</span>
      <b>${esc(w.title)}</b>
      <p>${esc(w.detail)}</p>
      ${(w.evidence || []).map((e) => `<q>${esc(e)}</q>`).join(" ")}
    </li>`).join("");
  const n = check.warnings.length;
  return `<section class="sanity" role="region" aria-labelledby="sanity-h" tabindex="-1">
    <h3 id="sanity-h" tabindex="-1"><span class="sanity-icon" aria-hidden="true">!</span>Please double check this report</h3>
    <p>Some parts of this report do not seem to match, or have a value that looks unusual. This can happen when text is copied incorrectly. Please check the original report, or ask your imaging team to explain it, before relying on this summary.</p>
    <p>Your doctor may really have written it that way, so we are not saying it is wrong. We just cannot tell. If something looks impossible, check your copy and paste first. Then ask your imaging team to confirm that the report says what it should. We kept everything and explained it below.</p>
    <p><b>${n} ${n === 1 ? "thing" : "things"} to check:</b> look for the CHECK tags in your report text further down.</p>
    <ul>${items}</ul>
    <p class="fine">These labels are about the text, not your health. A warning does not mean you have cancer, and a report without warnings is not proof that everything in it is right.</p>
  </section>`;
}

// Calm information lines. They are not warnings, so they carry no level badge.
function notesHtml(check) {
  return (check.notes || []).map((n) => `<div class="note-info"><b>${esc(n.title)}</b><p>${esc(n.detail)}</p></div>`).join("");
}

// Splits the text at the flagged stretches. Words explained by the glossary stay highlighted inside and outside the flags.
function mergeFlags(flags, len) {
  const sorted = flags.map((f) => ({ start: Math.max(0, f.start), end: Math.min(len, f.end), titles: [f.title] }))
    .filter((f) => f.end > f.start).sort((a, b) => a.start - b.start);
  const out = [];
  for (const f of sorted) {
    const last = out[out.length - 1];
    if (last && f.start <= last.end) { last.end = Math.max(last.end, f.end); last.titles.push(...f.titles); }
    else out.push({ ...f });
  }
  return out;
}

function annotateTerms(text, hits, from, to) {
  let html = "", last = from;
  for (const h of hits) {
    if (h.start < last || h.end > to) continue; // before this piece, or crossing its edge
    html += esc(text.slice(last, h.start));
    const cls = h.negated ? "t-info" : "t-" + h.tone;
    html += `<mark class="term ${cls}" tabindex="0" data-term="${esc(h.term)}" data-neg="${h.negated ? 1 : 0}"${h.negated ? ' style="text-decoration:line-through;text-decoration-color:var(--muted)"' : ""}>${esc(text.slice(h.start, h.end))}</mark>`;
    last = h.end;
  }
  return html + esc(text.slice(last, to));
}

function annotate(text, hits, flags = []) {
  const merged = mergeFlags(flags, text.length);
  let html = "", pos = 0;
  for (const f of merged) {
    html += annotateTerms(text, hits, pos, f.start);
    const title = [...new Set(f.titles)].join(" | ");
    html += `<mark class="flag" title="${esc(title)}">${annotateTerms(text, hits, f.start, f.end)}</mark>`;
    pos = f.end;
  }
  return html + annotateTerms(text, hits, pos, text.length);
}

export function renderReport(text) {
  const out = $("#report-out");
  if (!text.trim()) {
    out.innerHTML = `<div class="empty">Please paste a report first, or pick an example above.</div>`;
    setReportContext(null);
    return;
  }
  const r = parseReport(text);
  const check = safeCheck(text);
  setReportContext({ text, parsed: r });
  const parts = [];

  // Anything that looks wrong or does not match comes first, before anyone relies on the summary.
  if (check.hasIssues) parts.push(sanityCard(check));

  // Summary sentence. When the report gives several numbers we never pick one for the reader.
  const d = describeBirads(check);
  const current = currentBirads(r, check);
  const worst = [...current].sort((a, b) => order(b) - order(a))[0];
  let summary = "";
  if (d.sentence) {
    summary += esc(d.sentence) + " ";
    if (!d.ambiguous && current.length === 1 && worst) summary += `What usually happens next: ${esc(BIRADS[worst].next)} `;
  } else if (worst) summary += `Your report gives a <b>BI-RADS ${worst}</b> (“${esc(BIRADS[worst].name)}”). What usually happens next: ${esc(BIRADS[worst].next)} `;
  else summary += "I could not find a BI-RADS number in this text. If this is a biopsy report, look at the words explained below and ask your doctor what they mean for you. ";
  if (r.findings.length) summary += `It describes ${r.findings.length === 1 ? "one finding" : r.findings.length + " findings"}. You can see where below. `;
  summary += `<br><span class="fine">Only your doctor can tell you what this means for you. Have a question? Ask in the chat under the report. If you notice any change in your breasts, see <a href="#check" data-tab="check">When to see a doctor</a>.</span>`;
  parts.push(`<div class="card"><h3>The short version</h3><p style="margin:0">${summary}</p></div>`);
  const notes = notesHtml(check);
  if (notes) parts.push(notes);

  // One card for every BI-RADS number found, so nothing is hidden when they disagree.
  const factsBirads = (check.facts && check.facts.birads) || [];
  for (const k of r.birads.sort((a, b) => order(b) - order(a))) {
    const m = factsBirads.filter((b) => b.category === k);
    const tag = m.length && m.every((b) => b.historical && !b.current) ? "earlier" : d.ambiguous && current.length > 1 ? "several" : "";
    parts.push(biradsCard(k, tag));
  }
  if (r.density) parts.push(densityCard(r.density));
  if (r.findings.length || unplacedClocks(check).length) parts.push(locationCard(r.findings, check));

  // Annotated report + glossary of words found.
  const seen = new Map();
  // A word counts as "absent" only if every mention of it is negated.
  for (const h of r.terms) if (!seen.has(h.term) || (seen.get(h.term).negated && !h.negated)) seen.set(h.term, h);
  const legend = Object.entries(TONE_LABEL).map(([t, l]) => `<span><i style="background:var(--${t})"></i>${l}</span>`).join("");
  const flags = check.warnings.flatMap((w) => (w.spans || []).map((s) => ({ start: s.start, end: s.end, title: `${w.label || LEVELS[w.level]}: ${w.title}` })));
  const flagLegend = flags.length ? `<span><mark class="flag">like this</mark> = please check this part</span>` : "";
  parts.push(`<div class="card"><h3>Your report with the words explained</h3><div class="legend">${legend}<span><s>crossed out</s> = your report says it was not seen</span>${flagLegend}</div>
    <div class="annotated" style="margin-top:10px">${annotate(text, r.terms, flags)}</div></div>`);
  if (seen.size) {
    parts.push(`<div class="card"><h3>Words from your report (${seen.size})</h3><div class="terms">${[...seen.values()].map((h) =>
      `<div class="term-row"><div><b>${esc(h.term)}</b>${h.negated ? '<span class="pill info">not seen</span>' : `<span class="pill ${h.tone}">${TONE_LABEL[h.tone]}</span>`}</div><div>${esc(h.def)}${h.negated ? " <i>Your report says this was not seen.</i>" : ""}</div></div>`).join("")}</div></div>`);
  }

  // Questions to ask.
  const qs = buildQuestions(r, check);
  parts.push(`<div class="card"><h3>Questions to bring to your appointment</h3><ol class="questions">${qs.map((q) => `<li>${esc(q)}</li>`).join("")}</ol>
    <div class="row"><button class="btn small" id="copy-questions">Copy these questions</button>
    <button class="btn small" id="tailor-questions">Ask the assistant to tailor these</button></div></div>`);
  parts.push(`<p class="src">Where the BI-RADS meanings and percentages come from: <a href="${SOURCES.acr.url}" target="_blank" rel="noopener">${esc(SOURCES.acr.label)}</a>;
    <a href="${SOURCES.acsBirads.url}" target="_blank" rel="noopener">${esc(SOURCES.acsBirads.label)}</a>. What your radiologist and doctor tell you always comes first.</p>`);

  out.innerHTML = parts.join("");
  // Meet the warning first: keyboard and screen reader users land on it. No warning means focus stays where it was.
  if (check.hasIssues) $("#sanity-h")?.focus();
  $("#tailor-questions")?.addEventListener("click", () => ask("Help me write questions to ask at my appointment."));
  const btn = $("#copy-questions");
  btn?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(qs.map((q, i) => `${i + 1}. ${q}`).join("\n"));
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

  // Photo or PDF upload: read on this device, show the text so it can be checked, then explain it.
  const fileIn = $("#report-file"), fileStatus = $("#report-file-status"), drop = $("#report-drop");
  const say = (msg, kind = "") => { fileStatus.hidden = !msg; fileStatus.textContent = msg; fileStatus.dataset.kind = kind; };
  let reading = false;
  async function readFile(file) {
    if (!file || reading) return;
    reading = true;
    drop.setAttribute("aria-busy", "true");
    say("Starting...");
    try {
      const { extractText } = await import("./ocr.js");
      const r = await extractText(file, (m) => say(m));
      if (!r.text || r.text.replace(/\s/g, "").length < 20) {
        say("We could not find readable text in that file. Try a clearer, straight-on photo with good light, or paste the text instead.", "bad");
        return;
      }
      ta.value = r.text;
      const more = r.truncated ? " Only the first 6 pages were read." : "";
      if (r.method === "pdf-text") say("We copied the text out of your PDF. Check that it matches your report, then read the explanation below." + more, "ok");
      else {
        const low = r.confidence !== null && r.confidence < 85;
        say("We read this text from a picture. Reading pictures can make mistakes, such as a wrong number or a missing word. "
          + (low ? "This picture was hard to read, so the text probably has mistakes. " : "")
          + (low ? "We have not explained it yet. Fix anything that is wrong in the box, then press Explain this report." : "Compare it with your report and fix anything that is wrong, then press Explain this report again.") + more, low ? "bad" : "ok");
        if (low) { ta.focus(); return; }
      }
      renderReport(ta.value);
    } catch (err) {
      say(err?.code === "big" ? "That file is too big. Please use a file under 20 MB."
        : err?.code === "type" ? "Please choose a photo (JPG or PNG) or a PDF."
        : "We could not read that file on this device. Please paste the text instead.", "bad");
    } finally {
      reading = false;
      drop.removeAttribute("aria-busy");
      fileIn.value = "";
    }
  }
  fileIn.addEventListener("change", () => readFile(fileIn.files[0]));
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => readFile(e.dataTransfer?.files?.[0]));

  $("#report-clear").addEventListener("click", () => {
    say("");
    ta.value = "";
    setReportContext(null);
    $("#report-out").innerHTML = `<div class="empty">Pick an example above, or paste a report, then press <b>Explain this report</b>.</div>`;
  });

  // Term popovers (hover, focus or tap).
  const pop = $("#popover");
  let shownAt = 0;
  const show = (el) => {
    const info = TERM_INDEX.get(el.dataset.term.toLowerCase());
    if (!info) return;
    pop.innerHTML = `<b>${esc(info.term)}</b>${el.dataset.neg === "1" ? "<i>Your report says this was not seen.</i> " : ""}${esc(info.def)}`;
    pop.hidden = false;
    shownAt = Date.now();
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
  // Hide on scroll, but not for the scroll that focusing a word causes (that would hide it from keyboard users).
  window.addEventListener("scroll", () => { if (Date.now() - shownAt > 400) pop.hidden = true; }, { passive: true });
  document.addEventListener("keydown", (e) => e.key === "Escape" && (pop.hidden = true));
}
