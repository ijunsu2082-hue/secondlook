// Server-side logic for the chat assistant. No browser code lives here and the
// API key is only ever read from the environment.
import { SYSTEM_PROMPT, buildContext } from "./prompt.mjs";

export const LIMITS = { messages: 20, messageChars: 2000, reportChars: 12000 };
const FEATURES = new Set(["report", "scan", "check", "lab"]);

// Plain words that mean "get help soon or now". Checked on the person's words,
// not on the model's, so the safety message never depends on the model.
const EMERGENCY = [
  /chest pain/i, /can'?t breathe|cannot breathe|trouble breathing|short(ness)? of breath/i,
  /faint(ed|ing)?|passed out/i, /soaking .*(pad|bandage)|won'?t stop bleeding|heavy bleeding/i,
  /kill myself|end my life|suicid|hurt myself|self[- ]harm|don'?t want to (live|be here)/i,
];
const SOON = [
  /(new|found|feel|felt|noticed).{0,30}\blump\b/i, /\blump\b.{0,30}(new|growing|bigger|appeared)/i,
  /(bloody|blood).{0,30}(nipple|discharge)|nipple.{0,30}blood/i,
  /(red|hot|swollen|warm).{0,40}breast|breast.{0,40}(red|hot|swollen|warm)/i,
  /dimpl|orange peel|nipple.{0,30}(pulling|pulled|inverted|turn(ed|ing)? in|turn(ed|ing)? inward|retract)/i,
];

export const EMERGENCY_NOTE =
  "If you have chest pain, trouble breathing, heavy bleeding, or you feel faint, please call your local emergency number now (911 in the US). If you are having thoughts of hurting yourself, you can call or text 988 in the US at any time. Please do that before anything else.";
export const SOON_NOTE =
  "What you describe is worth getting checked soon. Please contact a doctor or clinic in the next few days. You do not need to wait for your next routine screening.";

export const NO_GUARANTEE_NOTE =
  "One thing to keep in mind: no scan or test can promise that someone does not have cancer. A normal result is a good sign, but if you notice a new change in your breast, please have it checked.";
// Someone treating a good result as proof they are cancer free.
const ASSUMES_CLEAR = /(definitely|certainly|for sure|100%|totally|completely)[^.?!]{0,20}(don'?t|do not|doesn'?t|no) (have|cancer)|means? (i|that i) (don'?t|do not|am not|have no)[^.?!]{0,12}cancer|cancer[- ]free|in the clear/i;
export const needsCaution = (text) => ASSUMES_CLEAR.test(text);

export const SCAN_NOTE =
  "The ultrasound feature is a research demonstration. It is not a clinical tool or a medical test, and it should not be used to make health decisions.";
export const PRIVACY_NOTE =
  "About your privacy: when you send a message here, your message and any report text you pasted go to our server, and then to OpenAI, an outside company, so it can write an answer. Our server does not store them. OpenAI may keep them for a short time under its own rules. Please leave out your name and birth date.";
export const asksAboutPrivacy = (text) =>
  /(do you|will you|are you|is it|does it)[^.?!]{0,20}(save|store|keep|record|log|share|private|safe|secure)|privacy|is (my|the)[^.?!]{0,25}(private|safe|secure)|who (sees|can see|reads|has access)|where does (my|what i)[^.?!]{0,30}go|delete my/i.test(text);

export function urgency(text) {
  if (EMERGENCY.some((r) => r.test(text))) return "emergency";
  if (SOON.some((r) => r.test(text))) return "soon";
  return null;
}

export function validate(body) {
  if (!body || typeof body !== "object") return "Request was empty.";
  const { messages, report } = body;
  if (!Array.isArray(messages) || messages.length === 0) return "No message was sent.";
  if (messages.length > LIMITS.messages) return "This chat has gotten long. Please clear it and start a new one.";
  for (const m of messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") return "A message was not in the right format.";
    if (m.content.length === 0 || m.content.length > LIMITS.messageChars) return `Messages must be between 1 and ${LIMITS.messageChars} characters.`;
  }
  if (messages[messages.length - 1].role !== "user") return "The last message must come from you.";
  if (report != null) {
    if (typeof report !== "object" || typeof report.text !== "string") return "The report was not in the right format.";
    if (report.text.length > LIMITS.reportChars) return `The report is too long. The limit is ${LIMITS.reportChars} characters.`;
  }
  return null;
}

// Fix style slips from the model without changing meaning, and pull out the feature tag.
export function cleanReply(raw) {
  let text = String(raw || "");
  let feature = null;
  text = text.replace(/\[\[feature:(\w+)\]\]/g, (_, f) => { if (FEATURES.has(f)) feature = f; return ""; });
  text = text.replace(/\s*[—–]\s*/g, ", ").replace(/,\s*,/g, ",").replace(/ ,/g, ",").trim();
  return { text, feature };
}

// Phrases that break the rules no matter what the question was. Checked on every reply.
const FALSE_REASSURANCE = /nothing to worry about|no need to (worry|panic)|you(?:'| a)re (fine|in the clear|ok(ay)?)\b|don'?t worry|do not worry|this is not serious|nothing serious|it will be (ok|okay|fine)/i;
const DIAGNOSIS = /(?<!(not|n't|whether|if|cannot|can't) )\byou (do not|don'?t)? ?have (breast )?cancer\b(?! or)/i;
export function violations(text) {
  const bad = [];
  if (FALSE_REASSURANCE.test(text)) bad.push("false reassurance");
  const m = text.match(DIAGNOSIS);
  if (m && !/\b(not|n't|whether|if|cannot|can't|never)\b[^.]{0,30}$/i.test(text.slice(0, m.index))) bad.push("diagnosis");
  return bad;
}

// Links to other parts of the app are chosen by plain rules, so they work even if the model forgets the tag.
const FEATURE_RULES = [
  ["lab", /biopsy lab|the lab\b|cell measurements/i],
  ["scan", /upload[^.?!]{0,40}(ultrasound|image|picture|scan)|ultrasound (ai|demo|image|picture)|(ultrasound|image|picture)[^.?!]{0,30}(ai|computer)/i],
  ["check", /symptom|should i see a doctor|need (to see )?a doctor|screening planner|when to see/i],
  ["report", /paper|paste|use (this|the) (site|app|tool)[^.?!]{0,30}report|how do i (use|read)[^.?!]{0,30}report/i],
];
export function suggestFeature(text) {
  const hit = FEATURE_RULES.find(([, re]) => re.test(text));
  return hit ? hit[0] : null;
}

export function buildMessages(body, extra) {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: buildContext(body.report) },
    ...body.messages.map((m) => ({ role: m.role, content: m.content })),
    ...(extra ? [{ role: "system", content: extra }] : []),
  ];
}

export async function respond(body, { apiKey, model = "gpt-4o-mini", fetchImpl = fetch } = {}) {
  const bad = validate(body);
  if (bad) return { status: 400, json: { error: bad } };
  const last = body.messages[body.messages.length - 1].content;
  const level = urgency(last);
  const note = level === "emergency" ? EMERGENCY_NOTE : level === "soon" ? SOON_NOTE : needsCaution(last) ? NO_GUARANTEE_NOTE : asksAboutPrivacy(last) ? PRIVACY_NOTE : null;

  if (!apiKey) return { status: 503, json: { error: "The assistant is not set up on this server yet.", note } };

  const ask = async (extra) => {
    let res;
    try {
      res = await fetchImpl("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages: buildMessages(body, extra), temperature: 0.3, max_tokens: 500 }),
        signal: AbortSignal.timeout(25000),
      });
    } catch {
      return { error: "I could not reach the assistant service. Please try again in a moment." };
    }
    if (!res.ok) return { error: "The assistant service had a problem. Please try again in a moment." };
    const data = await res.json().catch(() => null);
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw || !raw.trim()) return { error: "The assistant did not give an answer. Please try again." };
    return cleanReply(raw);
  };

  let out = await ask();
  if (!out.error && violations(out.text).length) {
    out = await ask("Your last draft broke a rule: do not reassure the person, and never say whether they have cancer. Write the answer again without that. Stay warm and plain.");
    if (!out.error && violations(out.text).length) out = { error: "I could not write a safe answer to that. Please try asking in a different way, or ask your care team." };
  }
  if (out.error) return { status: 502, json: { error: out.error, note } };
  const feature = out.feature || suggestFeature(last);
  return { status: 200, json: { reply: out.text, feature, note: note || (feature === "scan" ? SCAN_NOTE : null), urgency: level } };
}

// Simple per-address limit. In-memory, so it resets when the function restarts.
const hits = new Map();
export function rateLimited(key, max = 20, windowMs = 60000, now = Date.now()) {
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > max;
}
