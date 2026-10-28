// Report sanity check: fixed rules that look for values that cannot be right, parts of a report that
// may disagree, and text we could not read. It runs on the raw report text.
//
// It never diagnoses, never decides which of two conflicting findings is correct, never changes a unit,
// a side or a category, and never throws away a valid finding. The labels it uses describe the TEXT
// ("Needs checking", "Possible conflict", "Could not interpret"). They say nothing about anyone's health.
// When something looks impossible we still show it, and we give the doctor the benefit of the doubt.
//
// Pure functions only, so the same code runs in the browser and on the server.
import { TERMS } from "./knowledge.js";

export const LEVELS = { check: "Needs checking", conflict: "Possible conflict", unreadable: "Could not interpret" };

const MAX_CHARS = 20000;
const LEVEL_ORDER = { check: 0, conflict: 1, unreadable: 2 };
// "BI-RADS 0-6" or "0 to 6" describes the scale. Built from a string so the dash characters stay as escapes.
const RANGE_AFTER = new RegExp("^\\s*(?:-|\\u2013|\\u2014|to\\b|through\\b)\\s*\\d", "i");

// ------------------------------------------------------------------ small helpers
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const TERM_RE = new RegExp("\\b(?:" + TERMS.map((t) => escapeRe(t[0])).sort((a, b) => b.length - a.length).join("|") + ")", "i");
const tidy = (n) => String(Number(Number(n).toFixed(2)));
const joinAnd = (items) => (items.length <= 1 ? items.join("") : items.slice(0, -1).join(", ") + " and " + items[items.length - 1]);
const uniq = (items) => [...new Set(items)];

const LESION_NOUN = /\b(?:mass(?:es)?|lesions?|nodules?|cysts?|cystic|tumou?rs?|asymmetr(?:y|ies)|calcifications?|distortion|fibroadenomas?|lumps?|foci|focus|findings?|abnormalit(?:y|ies)|lymph nodes?)\b/gi;
const BREAST_CONTEXT = /\b(?:breasts?|nipple|areola|axilla(?:ry)?|retroareolar|subareolar|quadrant|FN)\b/i;
const TIME_CUE = /\b(?:a\.?m\.?|p\.?m\.?|morning|afternoon|evening|night|appointment|scheduled|tomorrow|today|clinic hours|opens?|closes?)\b/i;

const BENEFIT = "This should not normally be possible. It may be a typing or copy mistake, but it may also be exactly what your doctor wrote, so we are not saying it is wrong. Please double check that it was copied correctly, and ask your imaging team to confirm.";

// ------------------------------------------------------------------ sentences
function normalizeSection(label) {
  const u = label.trim().toUpperCase();
  if (/COMPOSITION|DENSITY/.test(u)) return "COMPOSITION";
  if (/^(?:EXAM|EXAMINATION|PROCEDURE|STUDY|TECHNIQUE)/.test(u)) return "EXAM";
  if (/^COMPARISON/.test(u)) return "COMPARISON";
  if (/^(?:HISTORY|INDICATION|CLINICAL|REASON)/.test(u)) return "HISTORY";
  if (/^FINDINGS?/.test(u)) return "FINDINGS";
  if (/^(?:IMPRESSION|ASSESSMENT|CONCLUSION|SUMMARY)/.test(u)) return "IMPRESSION";
  return null;
}

export function splitSentences(input) {
  const t = String(input == null ? "" : input).slice(0, MAX_CHARS);
  const parts = [];
  const re = /(?<=[.!?])[ \t]+|[\r\n]+/g;
  let last = 0;
  let m;
  while ((m = re.exec(t)) !== null) {
    if (m.index > last) parts.push({ text: t.slice(last, m.index), start: last });
    last = m.index + m[0].length;
  }
  if (last < t.length) parts.push({ text: t.slice(last), start: last });
  let section = null;
  const out = [];
  for (const p of parts) {
    if (!p.text.trim()) continue;
    const lab = p.text.match(/^\s*([A-Za-z][A-Za-z /&-]{2,40}):/);
    if (lab) {
      const s = normalizeSection(lab[1]);
      if (s) section = s;
    }
    out.push({ text: p.text, start: p.start, end: p.start + p.text.length, section });
    // Background sections apply only to the sentence that carries their label, so a
    // BI-RADS number written later in the report is not mistaken for an earlier exam.
    if (section === "COMPARISON" || section === "HISTORY") section = null;
  }
  return out;
}

function sentenceIndexAt(sents, idx) {
  for (let i = 0; i < sents.length; i++) if (idx >= sents[i].start && idx <= sents[i].end) return i;
  return -1;
}

const NEG_RE = /\b(?:no|not|without|negative for|absence of|free of|denies|nor|neither|never|no evidence of)\b|n['’]t\b/i;
// True when the word at `idx` is negated within its own clause ("No suspicious mass", "no cysts or solid masses").
function negated(segText, idx) {
  const before = segText.slice(Math.max(0, idx - 80), idx);
  const clause = before.split(/[.;:]|\b(?:but|however|although|except)\b/i).pop();
  return NEG_RE.test(clause);
}

function breastContext(sentText) {
  LESION_NOUN.lastIndex = 0;
  const hasLesion = LESION_NOUN.test(sentText);
  LESION_NOUN.lastIndex = 0;
  if (hasLesion || BREAST_CONTEXT.test(sentText) || /\bcm\s+from\b/i.test(sentText)) return true;
  return /\b(?:right|left)\b/i.test(sentText) && !TIME_CUE.test(sentText);
}

// ------------------------------------------------------------------ clock positions
const CLOCK_SRC = "(?<![\\d:.])(?:(\\d+)(?::(\\d{1,2}))?\\s*(?:-|\\u2013|\\u2014|to)\\s*)?(\\d+)(?::(\\d{1,2}))?\\s*(?:o['\\u2019\\u0060]\\s?clock|o\\s?clock|oclock)\\b";

function findClocks(text, sents) {
  const out = [];
  const re = new RegExp(CLOCK_SRC, "gi");
  let m;
  while ((m = re.exec(text)) !== null) {
    const si = sentenceIndexAt(sents, m.index);
    if (si < 0 || !breastContext(sents[si].text)) continue;   // "9 o'clock this morning" is a time, not a position
    const hours = [];
    if (m[1] !== undefined) hours.push(Number(m[1]));
    hours.push(Number(m[3]));
    const mins = [m[2], m[4]].filter((x) => x !== undefined);
    const hoursOk = hours.every((h) => Number.isInteger(h) && h >= 1 && h <= 12);
    const minsOk = mins.every((x) => x === "00" || x === "0" || x === "30");
    out.push({ raw: m[0], index: m.index, end: m.index + m[0].length, hours, valid: hoursOk && minsOk, hoursOk, minsOk, sIdx: si });
  }
  return out;
}

// ------------------------------------------------------------------ BI-RADS
function findBirads(text) {
  const pats = [
    /BI-?RADS\s*[®(]?\s*(?:assessment\s*)?(?:category\s*)?(?:is\s+|of\s+|[:#-]\s*)?(\d+)([A-Za-z])?(?![0-9A-Za-z])/gi,
    /\bcategory\s*[:#-]?\s*(\d+)([A-Za-z])?(?![0-9A-Za-z])/gi,
  ];
  const covered = [];
  const found = [];
  for (const re of pats) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const index = m.index;
      const end = index + m[0].length;
      if (covered.some(([a, b]) => index < b && end > a)) continue;
      // "BI-RADS 0-6" or "0 to 6" describes the scale, it is not a category
      if (RANGE_AFTER.test(text.slice(end, end + 12))) continue;
      covered.push([index, end]);
      const tok = m[1];
      const letter = m[2] || "";
      const digitOk = /^[0-6]$/.test(tok);
      const letterOk = !letter || (tok === "4" && /^[abc]$/i.test(letter));
      const valid = digitOk && letterOk;
      found.push({ raw: m[0], index, end, valid, category: valid ? tok + letter.toUpperCase() : null });
    }
  }
  return found.sort((a, b) => a.index - b.index);
}

const HIST_CUE = /\b(?:prior|previous(?:ly)?|earlier|last\s+(?:year|exam|mammogram|ultrasound|study|time)|older|formerly|history\s+of|(?:from|in|dated?)\s+(?:19|20)\d{2})\b/gi;
const NOW_CUE = /\b(?:now|currently|current|today|this\s+exam|this\s+study|at\s+this\s+time|presently|at\s+present)\b/i;
const CHANGE_CUE = /\b(?:upgraded|downgraded|reclassified|revised|updated|changed|re-?assessed|after\s+biopsy|addendum|final\s+assessment)\b/i;
const OVERALL_CUE = /\b(?:overall|final|combined|summary|composite)\b/i;

const compatible = (a, b) => a === b || (a === "4" && b[0] === "4") || (b === "4" && a[0] === "4");

// ------------------------------------------------------------------ finding segments
const ID_NUM_RE = /\b(lesion|mass|finding|nodule|cyst|focus|abnormality)\s*(?:#|no\.?\s*)?(\d+)\b(?!\s*(?:cm|mm|o['’]?clock|oclock|x\b|×|%)|[:.,]\d)/gi;
const ID_LET_RE = /\b([Ll]esion|[Mm]ass|[Ff]inding|[Nn]odule|[Cc]yst|[Ff]ocus|[Aa]bnormality)\s*#?\s*([A-D])\b(?![-'])/g;

function findIds(s) {
  const ids = [];
  for (const m of s.text.matchAll(ID_NUM_RE)) ids.push({ id: `${m[1].toLowerCase()} ${m[2]}`, pos: s.start + m.index });
  for (const m of s.text.matchAll(ID_LET_RE)) ids.push({ id: `${m[1].toLowerCase()} ${m[2].toLowerCase()}`, pos: s.start + m.index });
  return ids;
}

function headNoun(segText) {
  LESION_NOUN.lastIndex = 0;
  const m = LESION_NOUN.exec(segText);
  LESION_NOUN.lastIndex = 0;
  if (!m) return null;
  const w = m[0].toLowerCase();
  if (/^cyst/.test(w)) return "cyst";
  if (/^calcif/.test(w)) return "calc";
  if (/^asymm/.test(w)) return "asym";
  if (/^distort/.test(w)) return "distortion";
  if (/^lymph/.test(w)) return "node";
  return "mass";
}

function cutBetween(text, a, b) {
  const gap = text.slice(a, b);
  let cut = a;
  for (const m of gap.matchAll(/,|;|\band\b|\bwhile\b|\bwhereas\b|\bbut\b/gi)) cut = a + m.index;
  return cut;
}

function buildSegments(text, sents, clocks) {
  const segs = [];
  sents.forEach((s, si) => {
    const sides = [...s.text.matchAll(/\b(right|left)\b/gi)].map((m) => ({ side: m[1].toLowerCase(), pos: s.start + m.index }));
    const ids = findIds(s);
    const cl = clocks.filter((c) => c.sIdx === si && c.valid);
    const make = (start, end, clock) => {
      const segText = text.slice(start, end);
      const here = sides.filter((x) => x.pos >= start && x.pos < end);
      const sidesAll = uniq(here.map((x) => x.side));
      let side = null;
      if (clock) {
        const before = sides.filter((x) => x.pos < clock.index);
        side = before.length ? before[before.length - 1].side : sides.length ? sides[0].side : null;
      } else if (sidesAll.length === 1) side = sidesAll[0];
      const inSeg = ids.filter((x) => x.pos >= start && x.pos < end);
      const id = inSeg.length ? inSeg[0].id : ids.length === 1 ? ids[0].id : null;
      return { text: segText, start, end, sIdx: si, section: s.section, clock, side, sidesAll, hour: clock ? clock.hours[0] : null, id, noun: headNoun(segText) };
    };
    if (!cl.length) { segs.push(make(s.start, s.end, null)); return; }
    cl.forEach((c, i) => {
      const start = i === 0 ? s.start : cutBetween(text, cl[i - 1].end, c.index);
      const end = i === cl.length - 1 ? s.end : cutBetween(text, c.end, cl[i + 1].index);
      segs.push(make(start, end, c));
    });
  });
  return segs;
}

const segAt = (segs, idx) => segs.find((g) => idx >= g.start && idx < g.end) || segs.find((g) => idx === g.end) || null;
const locKey = (g) => (g && g.side && g.hour ? `${g.side} ${g.hour}` : null);

// ------------------------------------------------------------------ descriptors
const CYSTIC_RE = /\b(?:simple\s+cysts?|cysts?|cystic|fluid[- ]filled|anechoic)\b/gi;
const SOLID_RE = /\b(?:solid|hypervascular|vascular\s+(?:mass|tumou?r|lesion|nodule|component)|(?:internal|increased|marked|significant)\s+vascularity|vascularity\s+(?:is\s+)?(?:present|seen|noted|increased)|spiculated)\b/gi;
const BENIGN_RE = /\b(?:probably\s+benign|likely\s+benign|benign|fibroadenomas?)\b/gi;
const SUSP_RE = /\b(?:suspicious|malignan(?:t|cy)|highly\s+suggestive|concerning\s+for\s+(?:malignancy|cancer)|carcinoma)\b/gi;
const EXEMPT_RE = /\b(?:complex|complicated|septated|hemorrhagic|cystic\s+and\s+solid|solid\s+and\s+cystic|solid-cystic|cystic-solid|mixed)\b/i;

function scanWords(re, seg, skip) {
  const out = [];
  for (const m of seg.text.matchAll(re)) {
    if (negated(seg.text, m.index)) continue;
    if (skip && skip(seg.text, m.index)) continue;
    out.push({ start: seg.start + m.index, end: seg.start + m.index + m[0].length });
  }
  return out;
}

// "likelihood of malignancy" in a description of a BI-RADS category is not a finding.
const notAFinding = (segText, idx) => /\b(?:suspicion|likelihood|risk|chance|probability|rate)\s+(?:for|of)\s*$/i.test(segText.slice(Math.max(0, idx - 30), idx));

function describeSegment(seg) {
  const cystic = scanWords(CYSTIC_RE, seg);
  const solid = scanWords(SOLID_RE, seg);
  const benign = scanWords(BENIGN_RE, seg);
  const susp = scanWords(SUSP_RE, seg, notAFinding);
  let positive = false;
  for (const m of seg.text.matchAll(LESION_NOUN)) if (!negated(seg.text, m.index)) { positive = true; break; }
  return { ...seg, cystic, solid, benign, susp, exempt: EXEMPT_RE.test(seg.text), positive };
}

const BACK_REF = /\b(?:the|this|that|same|aforementioned|above|described)\b[^.]{0,25}\b(?:mass|lesion|cyst|nodule|finding|abnormality|area|tumou?r)\b/i;

// Do two finding mentions describe the same lesion? "same", "uncertain", "different" or "none" (no reason to compare).
function relate(a, b) {
  if (a === b) return "same";
  if (a.id && b.id) return a.id === b.id ? "same" : "different";
  if (a.side && b.side && a.side !== b.side) return "different";
  if (a.hour && b.hour && a.hour !== b.hour) return "different";
  const near = Math.abs(a.sIdx - b.sIdx) <= 2;
  if (a.side && a.hour && b.side && b.hour) {
    const da = a.dist, db = b.dist;
    if (da != null && db != null && Math.abs(da - db) > 2) return "different";
    return "same";
  }
  if (a.hour && b.hour) return near ? "uncertain" : "none";     // same hour, side unknown on one of them
  const later = a.sIdx <= b.sIdx ? b : a;
  if (near && (BACK_REF.test(later.text) || (a.noun && a.noun === b.noun))) return "uncertain";
  return "none";
}

// ------------------------------------------------------------------ measurements
const NUM = String.raw`\d+(?:[.,]\d+)?`;
const MEAS_SRC = String.raw`(?<![\d.,])(${NUM})(?:\s*(?:x|×|by)\s*(${NUM}))?(?:\s*(?:x|×|by)\s*(${NUM}))?\s*(mm|cm|millimet(?:er|re)s?|centimet(?:er|re)s?)\b`;
const NOUNIT_SRC = String.raw`measur\w*\s*(?:approximately\s+|about\s+|roughly\s+|up to\s+)?(\d+(?:[.,]\d+)?)(?!\d)(?![.,]\d)(?!\s*(?:[x×]|by\b|mm\b|cm\b|millimet|centimet))`;

function parseNum(tok) {
  if (/^\d{1,3}(?:,\d{3})+$/.test(tok)) return Number(tok.replace(/,/g, ""));
  return Number(tok.replace(",", "."));
}

function findMeasurements(text, sents, segs) {
  const out = [];
  const re = new RegExp(MEAS_SRC, "gi");
  let m;
  while ((m = re.exec(text)) !== null) {
    const si = sentenceIndexAt(sents, m.index);
    if (si < 0) continue;
    const st = sents[si].text;
    LESION_NOUN.lastIndex = 0;
    const hasLesion = LESION_NOUN.test(st);
    LESION_NOUN.lastIndex = 0;
    if (!hasLesion && !/measur/i.test(st)) continue;
    const nums = [m[1], m[2], m[3]].filter((x) => x !== undefined).map(parseNum);
    const unit = /^m/i.test(m[4]) && /^mm|^millimet/i.test(m[4]) ? "mm" : "cm";
    const end = m.index + m[0].length;
    const kind = /^\s*(?:from\s+(?:the\s+)?(?:nipple|skin|chest wall|areola)|FN\b|to the nipple)/i.test(text.slice(end, end + 30)) ? "distance" : "size";
    const maxCm = Math.max(...nums) / (unit === "mm" ? 10 : 1);
    const seg = segAt(segs, m.index);
    out.push({ raw: m[0], index: m.index, end, unit, kind, nums, maxCm, sIdx: si, key: locKey(seg), noun: seg ? seg.noun : null });
  }
  return out;
}

// ------------------------------------------------------------------ family history
const REL = "mother|sister|daughter|grandmother|grandma|aunt|cousin|father|brother|uncle|niece";
const REL_NEAR_CANCER = new RegExp(String.raw`\b(?:${REL})\b[^.?!]{0,60}?\b(?:breast|ovarian)\s+cancer\b|\b(?:breast|ovarian)\s+cancer\b[^.?!]{0,40}?\b(?:${REL})\b|\brelatives?\s+(?:had|have|has|with|diagnosed|who)\b[^.?!]{0,50}?\b(?:breast|ovarian)\s+cancer\b`, "i");
const FH_PHRASE = /\bfamil(?:y|ial)\s+history\b/i;
const FH_CANCER = /\bfamil(?:y|ial)\s+history\b[^.?!]{0,50}?\b(?:breast|ovarian)\s+cancer\b/i;
const FH_COND = /\b(?:if|whether|any|ask(?:ed)?|question(?:naire)?|unknown|unsure|not provided|not reported|not known|pending|to be)\b|\?/i;
const FH_NEG = /\b(?:no|none|denies|denied|without|negative|not)\b|n['’]t\b/i;

export function familyHistory(input) {
  const out = { stated: false, relatives: [], mentionedOnly: false, negated: false, snippets: [] };
  for (const s of splitSentences(input)) {
    const hasFh = FH_PHRASE.test(s.text);
    const near = REL_NEAR_CANCER.test(s.text) || FH_CANCER.test(s.text);
    if (!hasFh && !near) continue;
    const cond = FH_COND.test(s.text);
    const neg = FH_NEG.test(s.text);
    if (near && !cond && !neg) {
      out.stated = true;
      for (const m of s.text.matchAll(new RegExp(`\\b(?:${REL})\\b|\\brelatives?\\b`, "gi"))) out.relatives.push(m[0].toLowerCase());
      out.snippets.push(s.text.trim().slice(0, 200));
    } else if (hasFh || near) {
      out.mentionedOnly = true;
      if (neg && !cond && hasFh) out.negated = true;
    }
  }
  out.relatives = uniq(out.relatives);
  if (out.stated) { out.mentionedOnly = false; out.negated = false; }
  return out;
}

// ------------------------------------------------------------------ warnings
function makeWarning(text, id, level, title, detail, question, spans) {
  const clean = spans.filter((s) => s.end > s.start).sort((a, b) => a.start - b.start);
  return { id, level, label: LEVELS[level], title, detail, question, evidence: clean.map((s) => text.slice(s.start, s.end)), spans: clean };
}

const targetParts = (t) => {
  if (!t) return { type: null };
  if (t === "overall") return { type: "overall" };
  if (t.startsWith("id:")) return { type: "id", id: t.slice(3) };
  const [side, hour] = t.split(" ");
  return hour ? { type: "clock", side, hour } : { type: "side", side };
};

function relateTargets(x, y) {
  if (x && x === y) return "same";
  if (!x || !y) return "unclear";
  const a = targetParts(x), b = targetParts(y);
  if (a.type === "overall" || b.type === "overall") return "overall";
  if (a.type === "id" && b.type === "id") return "different";
  if (a.type === "id" || b.type === "id") return "unclear";
  if (a.side && b.side && a.side !== b.side) return "different";
  if (a.type === "clock" && b.type === "clock") return "different";
  return "unclear";                                // one is a side only, the other a position on that side
}

export function prettyTarget(t) {
  const p = targetParts(t);
  if (p.type === "id") return p.id;
  if (p.type === "overall") return "the overall assessment";
  if (p.type === "clock") return `the ${p.side} breast at ${p.hour} o'clock`;
  if (p.type === "side") return `the ${p.side} breast`;
  return "a finding the report does not locate";
}

// ------------------------------------------------------------------ main check
export function checkReport(input) {
  const text = String(input == null ? "" : input).slice(0, MAX_CHARS);
  const warnings = [];
  const notes = [];
  const sents = splitSentences(text);
  const clocks = findClocks(text, sents);
  const segs = buildSegments(text, sents, clocks);
  const mentions = segs.map(describeSegment);

  // ---------------- clock positions
  const badClocks = new Map();
  for (const c of clocks) {
    if (c.valid) continue;
    const key = c.raw.toLowerCase();
    if (!badClocks.has(key)) badClocks.set(key, { c, spans: [], format: c.hoursOk && !c.minsOk });
    badClocks.get(key).spans.push({ start: c.index, end: c.end });
  }
  for (const { c, spans, format } of badClocks.values()) {
    if (format) {
      warnings.push(makeWarning(text, "clock-format", "check", `“${c.raw}” has an unusual format`,
        `Clock positions are usually whole hours, like 2 o'clock, or half hours, like 2:30. “${c.raw}” does not fit that pattern, so we did not use it on the diagram. It may be a copy or typing mistake, or it may be what your doctor wrote. Please double check it against the original report. We kept the rest of the report as it is.`,
        `My report says “${c.raw}”. Which clock position was meant?`, spans));
    } else {
      warnings.push(makeWarning(text, "clock-invalid", "check", `“${c.raw}” is not a breast position we can use`,
        `Breast positions are described like the numbers on a clock face, from 1 to 12. “${c.raw}” is outside that range, so we could not place it on the diagram. ${BENEFIT} We kept the rest of the report as it is.`,
        `My report says “${c.raw}”. Breast clock positions go from 1 to 12. Which position was meant?`, spans));
    }
  }

  // ---------------- BI-RADS
  const birads = findBirads(text);
  const facts = { birads: [], biradsInvalid: [], clock: clocks.map(({ raw, index, end, hours, valid }) => ({ raw, index, end, hours, valid })), measurements: [], family: familyHistory(text) };
  for (const b of birads) {
    const si = sentenceIndexAt(sents, b.index);
    const s = sents[si] || { text: "", start: 0, section: null };
    if (!b.valid) { facts.biradsInvalid.push({ raw: b.raw, index: b.index, end: b.end }); continue; }
    const i = b.index - s.start;
    const before = s.text.slice(Math.max(0, i - 70), i);
    let historical = false;
    if (s.section === "COMPARISON" || s.section === "HISTORY") historical = true;
    else if (/\bfrom\s*$/i.test(before)) historical = true;
    else {
      let last = null;
      for (const m of before.matchAll(HIST_CUE)) last = m;
      if (last && !NOW_CUE.test(before.slice(last.index + last[0].length))) historical = true;
    }
    const seg = segAt(segs, b.index);
    let target = null;
    if (seg && seg.id) target = "id:" + seg.id;
    else if (seg && seg.clock && seg.side) target = `${seg.side} ${seg.hour}`;
    else if (seg && seg.clock) target = null;
    else if (OVERALL_CUE.test(s.text)) target = "overall";
    else if (seg && seg.sidesAll.length) {
      const sides = [...s.text.matchAll(/\b(right|left)\b/gi)].map((m) => ({ side: m[1].toLowerCase(), pos: s.start + m.index }));
      const prior = sides.filter((x) => x.pos < b.index);
      target = (prior.length ? prior[prior.length - 1] : sides[0]).side;
    }
    facts.birads.push({ category: b.category, current: !historical, historical, target, index: b.index, end: b.end, raw: b.raw, sIdx: si });
  }

  for (const b of facts.biradsInvalid) {
    warnings.push(makeWarning(text, "birads-invalid", "check", `“${b.raw}” is not a BI-RADS number we know`,
      `BI-RADS is a score from 0 to 6 that radiologists (the doctors who read breast pictures) use to sum up an exam. Only category 4 has the letters A, B and C. “${b.raw}” does not fit that, so we did not use it in the summary. ${BENEFIT}`,
      `My report says “${b.raw}”. BI-RADS goes from 0 to 6. Which number was meant?`, [{ start: b.index, end: b.end }]));
  }
  if (/BI-?RADS/i.test(text) && !birads.length) {
    const at = text.search(/BI-?RADS/i);
    warnings.push(makeWarning(text, "birads-unreadable", "unreadable", "We saw the word BI-RADS but could not read a number",
      "BI-RADS is a score from 0 to 6 that radiologists use to sum up an exam. The report mentions it, but we could not find a number next to it. Please check the original report. This says nothing about your health. It only means we could not read that part.",
      "My report mentions BI-RADS. What is the number?", [{ start: at, end: at + (text[at + 2] === "-" ? 7 : 6) }]));
  }

  const cur = facts.birads.filter((b) => b.current);
  const hist = facts.birads.filter((b) => b.historical);
  const conflictPairs = [], separatePairs = [], overallPairs = [], changedPairs = [];
  for (let i = 0; i < cur.length; i++) {
    for (let j = i + 1; j < cur.length; j++) {
      const a = cur[i], b = cur[j];
      if (compatible(a.category, b.category)) continue;
      const lo = Math.min(a.sIdx, b.sIdx), hi = Math.max(a.sIdx, b.sIdx);
      const changed = sents.slice(lo, hi + 1).some((s) => CHANGE_CUE.test(s.text));
      const rel = relateTargets(a.target, b.target);
      if (changed) changedPairs.push([a, b]);
      else if (rel === "same" || rel === "unclear") conflictPairs.push([a, b, rel]);
      else if (rel === "overall") overallPairs.push([a, b]);
      else separatePairs.push([a, b]);
    }
  }
  const flat = (pairs) => uniq(pairs.flatMap((p) => [p[0], p[1]]));
  const cats = (bs) => uniq(bs.map((b) => b.category));
  if (conflictPairs.length) {
    const involved = flat(conflictPairs);
    const list = joinAnd(cats(involved));
    const same = conflictPairs.some((p) => p[2] === "same");
    warnings.push(makeWarning(text, "birads-conflict", "conflict", `More than one BI-RADS number: ${list}`,
      `Your report gives ${list} ${same ? "for what looks like the same finding" : "and we could not tell which finding each number belongs to, or whether one of them is out of date"}. BI-RADS is a score from 0 to 6 that radiologists use to sum up an exam. We cannot tell which number is right, and we have not picked one. This does not tell you anything about your health. It only means the wording needs checking. Please look at the original report and ask your imaging team to explain.`,
      `My report gives BI-RADS ${list}. Which one applies to which finding?`, involved.map((b) => ({ start: b.index, end: b.end }))));
  } else if (changedPairs.length) {
    notes.push({ id: "birads-changed", title: "The report says the BI-RADS number changed",
      detail: `Your report gives ${joinAnd(cats(flat(changedPairs)))} and uses words that suggest the number was changed. Please check the original report to see which one is the current one.` });
  } else if (separatePairs.length || overallPairs.length) {
    const used = flat([...separatePairs, ...overallPairs]);
    const parts = uniq(used.map((b) => `${b.category} (for ${prettyTarget(b.target)})`));
    notes.push({ id: separatePairs.length ? "birads-separate" : "birads-overall", title: "Different BI-RADS numbers for different findings",
      detail: `Your report gives ${joinAnd(parts)}. These seem to belong to different findings, or one may be an overall summary, so this is not necessarily a problem. If you are not sure which number goes with which finding, please check the original report.` });
  }
  if (hist.length) {
    notes.push({ id: "birads-history", title: "An earlier BI-RADS number was found",
      detail: `${joinAnd(cats(hist))} looks like it is from an earlier exam, so we did not treat it as the current number. Please check the original report to be sure.` });
  }

  // ---------------- measurements
  const meas = findMeasurements(text, sents, segs);
  facts.measurements = meas.map(({ raw, index, end, unit, maxCm, kind }) => ({ raw, index, end, unit, maxCm, kind }));
  const seenSize = new Set();
  for (const m of meas) {
    const key = m.raw.toLowerCase();
    const span = [{ start: m.index, end: m.end }];
    if (m.kind === "distance") {
      if (m.maxCm >= 20 && !seenSize.has("d" + key)) {
        seenSize.add("d" + key);
        warnings.push(makeWarning(text, "distance-implausible", "check", `“${m.raw}” is a very long way from the nipple`,
          `A distance of 20 cm or more is longer than most breasts are wide, so a unit may have been mixed up (millimeters, mm, and centimeters, cm, are easy to swap), or a number may have been mistyped. We did not change anything. ${BENEFIT}`,
          `My report gives a distance of “${m.raw}”. Can you confirm the number and the unit?`, span));
      }
      continue;
    }
    if (seenSize.has(key)) continue;
    if (m.nums.some((n) => n === 0)) {
      seenSize.add(key);
      warnings.push(makeWarning(text, "size-zero", "check", `“${m.raw}” has a size of zero`,
        `A size of zero does not make sense for a finding that the report describes. A number may have been mistyped or lost when the text was copied. We did not change anything. ${BENEFIT}`,
        `My report gives a size of “${m.raw}”. What is the real size?`, span));
    } else if (m.maxCm >= 25) {
      seenSize.add(key);
      warnings.push(makeWarning(text, "size-implausible", "check", `“${m.raw}” is bigger than most whole breasts`,
        `A size like “${m.raw}” is bigger than the width of most breasts, so it is very unlikely for a single finding. A unit may have been mixed up (millimeters, mm, and centimeters, cm, are easy to swap, and 35 mm is only 3.5 cm), or a number may have been mistyped. We did not change or convert anything. ${BENEFIT}`,
        `My report gives a size of “${m.raw}”. Can you confirm the number and the unit?`, span));
    } else if (m.maxCm >= 10) {
      seenSize.add(key);
      warnings.push(makeWarning(text, "size-large", "check", `“${m.raw}” would be a very large finding`,
        `A finding this large is rare, although it can happen. Please check that the number and the unit (mm or cm) were copied correctly. We did not change anything. Your doctor may well have written exactly this, so you can ask your imaging team to confirm if you are not sure.`,
        `My report gives a size of “${m.raw}”. Can you confirm the number and the unit?`, span));
    }
  }
  // the same number with both mm and cm
  const sizes = meas.filter((m) => m.kind === "size");
  const byNumber = new Map();
  for (const m of sizes) for (const n of uniq(m.nums)) {
    if (!byNumber.has(n)) byNumber.set(n, { mm: [], cm: [] });
    byNumber.get(n)[m.unit].push(m);
  }
  for (const [n, u] of byNumber) {
    if (!u.mm.length || !u.cm.length) continue;
    const sameSpot = u.mm.some((a) => u.cm.some((b) => a.key && a.key === b.key));
    if (n < 10 && !sameSpot) continue;               // a 2 mm speck and a 2 cm mass can both be real
    const a = u.mm[0], b = u.cm[0];
    warnings.push(makeWarning(text, "size-unit-mismatch", "conflict", `The number ${tidy(n)} appears with both mm and cm`,
      `Your report uses ${tidy(n)} with two different units: “${a.raw}” and “${b.raw}”. ${tidy(n)} mm is ${tidy(n / 10)} cm, and ${tidy(n)} cm is ten times bigger. We cannot tell which one is right, and we did not change either. Please check the original report, and ask your imaging team to confirm the sizes.`,
      `My report has “${a.raw}” and “${b.raw}”. Which unit is right?`, [{ start: a.index, end: a.end }, { start: b.index, end: b.end }]));
  }
  // very different sizes for the same spot
  const groups = new Map();
  for (const m of sizes) if (m.key && m.maxCm > 0) { if (!groups.has(m.key)) groups.set(m.key, []); groups.get(m.key).push(m); }
  for (const [key, list] of groups) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (a.sIdx === b.sIdx || !a.noun || a.noun !== b.noun) continue;
      const dists = (x) => meas.find((d) => d.kind === "distance" && d.sIdx === x.sIdx);
      const da = dists(a), db = dists(b);
      if (da && db && Math.abs(da.maxCm - db.maxCm) > 2) continue;
      const ratio = Math.max(a.maxCm, b.maxCm) / Math.min(a.maxCm, b.maxCm);
      if (ratio >= 3 && !warnings.some((w) => w.id === "size-disagree" && w.evidence.includes(a.raw))) {
        warnings.push(makeWarning(text, "size-disagree", "conflict", "Two very different sizes for what may be the same finding",
          `The report gives “${a.raw}” and “${b.raw}” for what looks like the same spot (${prettyTarget(key)}). That is a big difference. We cannot tell which one is right, or whether they describe the same finding, and we did not change either. Please check the original report, and ask your imaging team to explain.`,
          `My report gives “${a.raw}” and “${b.raw}” for the same spot. Which size is right?`, [{ start: a.index, end: a.end }, { start: b.index, end: b.end }]));
      }
    }
  }
  for (const m of text.matchAll(new RegExp(NOUNIT_SRC, "gi"))) {
    const at = m.index + m[0].length - m[1].length;
    warnings.push(makeWarning(text, "size-no-unit", "unreadable", `“${m[1]}” has no unit`,
      `We could not tell whether this size is in millimeters (mm) or centimeters (cm), so we did not use it. Please check the original report. This says nothing about your health. It only means we could not read that part.`,
      `My report gives a size of “${m[1]}” with no unit. Is that mm or cm?`, [{ start: at, end: at + m[1].length }]));
  }

  // ---------------- contradictory descriptions of one finding
  const cap = mentions.slice(0, 200);
  for (const seg of cap) {                                     // distances per segment help tell two lesions apart
    const d = meas.find((x) => x.kind === "distance" && x.index >= seg.start && x.index < seg.end);
    seg.dist = d ? d.maxCm : null;
  }
  const kinds = [
    { id: "finding-cyst-solid", a: "cystic", b: "solid", skip: (x, y) => x.exempt || y.exempt, title: "One finding is described as both a cyst and solid",
      what: "A cyst is a sac filled with fluid. A solid lump is not. The report uses both kinds of description" },
    { id: "finding-benign-suspicious", a: "benign", b: "susp", skip: (x, y) => {
        const lo = Math.min(x.start, y.start), hi = Math.max(x.end, y.end);
        return /\b(?:biopsy|pathology|concordant|however|although|but|following|after|previously|prior)\b/i.test(text.slice(Math.max(0, lo - 120), Math.min(text.length, hi + 120)));
      }, title: "One finding is called both benign and suspicious",
      what: "Benign means not cancer. Suspicious means the doctors want a closer look. The report uses both words" },
  ];
  for (const k of kinds) {
    let certain = false, found = false, where = null;
    const spans = [];
    for (let i = 0; i < cap.length; i++) for (let j = i; j < cap.length; j++) {
      const x = cap[i], y = cap[j];
      for (const [p, q] of i === j ? [[x, y]] : [[x, y], [y, x]]) {
        if (!p[k.a].length || !q[k.b].length || k.skip(p, q)) continue;
        const rel = relate(p, q);
        if (rel !== "same" && rel !== "uncertain") continue;
        found = true;
        if (rel === "same") certain = true;
        if (!where) where = locKey(p) || locKey(q);
        spans.push(...p[k.a], ...q[k.b]);
      }
    }
    if (!found) continue;
    const loc = where ? ` (${prettyTarget(where)})` : "";
    warnings.push(makeWarning(text, k.id, "conflict", k.title,
      `${k.what} ${certain ? `for what may be the same finding${loc}` : "in places where we could not tell whether they describe the same finding"}. Different spots can have different descriptions, so this may not be a mistake. We cannot tell which description is right, and we have not picked one. Please check the original report and ask your imaging team to explain.`,
      "My report describes a finding in two ways that seem to disagree. Do both descriptions apply to the same finding?",
      uniq(spans.map((s) => s.start + ":" + s.end)).map((s) => ({ start: Number(s.split(":")[0]), end: Number(s.split(":")[1]) }))));
  }

  // ---------------- left and right
  const positive = mentions.filter((g) => g.positive && !/\b(?:unremarkable|normal|clear|negative)\b|\b(?:prior|previous|history of|status post|clip)\b/i.test(sents[g.sIdx].text));
  const sideOf = (g) => g.side || (g.sidesAll.length === 1 ? g.sidesAll[0] : null);
  const examSents = sents.filter((s) => s.section === "EXAM");
  const examSides = uniq(examSents.flatMap((s) => [...s.text.matchAll(/\b(right|left)\b/gi)].map((m) => m[1].toLowerCase())));
  const examBoth = examSents.some((s) => /\b(?:bilateral|both|right and left|left and right)\b/i.test(s.text));
  if (examSides.length === 1 && !examBoth) {
    const odd = positive.filter((g) => g.section !== "EXAM" && g.section !== "COMPARISON" && g.section !== "HISTORY" && sideOf(g) && sideOf(g) !== examSides[0]);
    if (odd.length) {
      const other = sideOf(odd[0]);
      const ex = examSents[0];
      warnings.push(makeWarning(text, "laterality-exam", "conflict", "The exam line and a finding mention different breasts",
        `The line about the exam mentions only the ${examSides[0]} breast, but a finding is described in the ${other} breast. It may be a second finding, or a copy or typing mistake. We cannot tell which, and we did not change either side. Please check the original report and ask your imaging team to confirm which breast was meant.`,
        `The exam line says ${examSides[0]} breast but a finding is in the ${other} breast. Which is right?`,
        [{ start: ex.start, end: ex.end }, ...odd.map((g) => ({ start: g.start, end: g.end }))]));
    }
  }
  const sideSet = (name) => uniq(positive.filter((g) => g.section === name).map(sideOf).filter(Boolean));
  const fs = sideSet("FINDINGS"), is = sideSet("IMPRESSION");
  if (fs.length && is.length && !fs.some((s) => is.includes(s))) {
    const f = positive.find((g) => g.section === "FINDINGS" && sideOf(g)), i = positive.find((g) => g.section === "IMPRESSION" && sideOf(g));
    warnings.push(makeWarning(text, "laterality-impression", "conflict", "The findings and the impression mention different breasts",
      `The findings describe the ${joinAnd(fs)} breast, but the impression describes the ${joinAnd(is)} breast. They may be separate findings, or one side may have been copied wrongly. We cannot tell which, and we did not change either side. Please check the original report and ask your imaging team to confirm.`,
      "The findings and the impression name different breasts. Which breast is each one about?",
      [{ start: f.start, end: f.end }, { start: i.start, end: i.end }]));
  }
  sents.forEach((s, si) => {
    if (!/\bleft\b/i.test(s.text) || !/\bright\b/i.test(s.text)) return;
    if (clocks.filter((c) => c.sIdx === si && c.valid).length !== 1) return;
    if (/\b(?:compared|versus|vs|than|contralateral|other breast|both|bilateral|while|whereas|unremarkable|normal|negative|clear)\b/i.test(s.text)) return;
    if (!mentions.some((g) => g.sIdx === si && g.positive)) return;
    warnings.push(makeWarning(text, "laterality-both", "conflict", "One finding is placed in both the left and the right breast",
      "One sentence puts a single finding in both the left and the right breast. It may be a copy or typing mistake, or two findings may have been squeezed into one sentence. We cannot tell which, and we did not change either side. Please check the original report and ask your imaging team to confirm.",
      "One sentence in my report names both the left and the right breast for one finding. Which breast is it?",
      [{ start: s.start, end: s.end }]));
  });

  // ---------------- nothing we can read
  const hasDensity = /\b(?:density|dense|fatty|fibroglandular)\b/i.test(text);
  if (text.trim().length >= 30 && !facts.birads.length && !facts.biradsInvalid.length && !hasDensity && !clocks.length && !TERM_RE.test(text) && !birads.length) {
    warnings.push(makeWarning(text, "nothing-readable", "unreadable", "We could not find anything we know how to read",
      "This text has no BI-RADS number, breast density, clock position or common report words that we recognize. Did the whole report paste? Please check that you copied the report itself, and try again. This says nothing about your health. It only means we could not read the text.",
      "Can you send me a clear copy of my full report?", [{ start: text.search(/\S/), end: Math.min(text.length, text.search(/\S/) + 60) }]));
  }

  // ---------------- order: severity group first, then position in the report
  const pos = (w) => (w.spans.length ? w.spans[0].start : Infinity);
  warnings.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || pos(a) - pos(b));
  return { warnings, notes, facts, hasIssues: warnings.length > 0 };
}

// ------------------------------------------------------------------ summary sentence for the BI-RADS part
export function describeBirads(check) {
  const all = (check && check.facts && check.facts.birads) || [];
  const categories = uniq(all.map((b) => b.category));
  const cur = all.filter((b) => b.current);
  const hist = all.filter((b) => b.historical);
  const curCats = uniq(cur.map((b) => b.category)).filter((c, _, arr) => !(c === "4" && arr.some((x) => x !== "4" && x[0] === "4")));
  const has = (list, id) => (list || []).some((x) => x.id === id);
  const conflict = has(check && check.warnings, "birads-conflict");
  const notes = (check && check.notes) || [];
  if (curCats.length > 1) {
    if (conflict) {
      return { sentence: `Your report gives more than one BI-RADS number (${joinAnd(curCats)}). We cannot tell which one is right for which finding, so please check the original report.`, ambiguous: true, categories };
    }
    if (has(notes, "birads-separate") || has(notes, "birads-overall")) {
      const parts = uniq(cur.map((b) => `${b.category} (for ${prettyTarget(b.target)})`));
      return { sentence: `Your report gives different BI-RADS numbers for different findings: ${joinAnd(parts)}.`, ambiguous: true, categories };
    }
    return { sentence: `Your report says the BI-RADS number changed (${joinAnd(curCats)}). Please check which one is the current one.`, ambiguous: true, categories };
  }
  if (curCats.length === 1 && hist.length) {
    return { sentence: `Your report gives BI-RADS ${curCats[0]} for this exam. It also mentions BI-RADS ${joinAnd(uniq(hist.map((b) => b.category)))}, which looks like it is from an earlier exam.`, ambiguous: false, categories };
  }
  if (!curCats.length && hist.length) {
    return { sentence: `The only BI-RADS number we found, ${joinAnd(uniq(hist.map((b) => b.category)))}, looks like it is from an earlier exam, so we could not tell what the number for this exam is.`, ambiguous: true, categories };
  }
  return { sentence: null, ambiguous: false, categories };
}
