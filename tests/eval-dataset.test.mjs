// Checks the evaluation dataset itself and the reply checker. No API calls.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { checkReply, RULE_NAMES } from "../eval/checks.mjs";

const rd = (f) => fs.readFileSync(new URL("../eval/" + f, import.meta.url), "utf8");
const entries = rd("conversations.jsonl").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const reports = JSON.parse(rd("reports.json"));

test("there are at least 100 conversations with unique ids", () => {
  assert.ok(entries.length >= 100, `only ${entries.length}`);
  assert.equal(new Set(entries.map((e) => e.id)).size, entries.length);
});

test("every conversation is well formed", () => {
  for (const e of entries) {
    assert.ok(e.id && e.cat && Array.isArray(e.messages) && e.messages.length, e.id);
    assert.equal(e.messages[e.messages.length - 1].role, "user", e.id);
    for (const rule of e.expect || []) assert.ok(RULE_NAMES.includes(rule), `${e.id}: ${rule}`);
    for (const p of [...(e.mustMatch || []), ...(e.mustNotMatch || [])]) new RegExp(p, "i");
    if (e.report && !e.report.startsWith("example:")) assert.ok(reports[e.report], `${e.id}: ${e.report}`);
    for (const m of e.messages) assert.ok(!/[—–]/.test(m.content), `${e.id}: dash in message`);
  }
});

test("the set covers the situations that matter", () => {
  const cats = new Set(entries.map((e) => e.cat));
  for (const c of ["meaning-birads", "report-terms", "density", "next-steps", "biopsy", "uncertainty", "appointment", "emotional", "urgent",
    "off-topic-injection", "report-fidelity", "multi-turn", "navigation", "general", "pathology", "report-problems", "missing-info"]) assert.ok(cats.has(c), c);
  assert.ok(entries.filter((e) => e.cat === "report-problems").length >= 10, "needs report-problem cases");
  assert.ok(entries.filter((e) => e.cat === "missing-info").length >= 3, "needs missing-information cases");
  assert.ok(entries.filter((e) => e.cat === "urgent").length >= 8);
  assert.ok(entries.filter((e) => e.messages.length > 1).length >= 8, "needs multi-turn cases");
});

test("the report-problem conversations cover every situation we care about", () => {
  const ids = new Set(entries.map((e) => e.id));
  for (let i = 1; i <= 16; i++) assert.ok(ids.has("sanity-" + String(i).padStart(2, "0")), "sanity-" + i);
  const text = entries.filter((e) => e.cat === "report-problems" || e.cat === "missing-info").map((e) => e.messages.map((m) => m.content).join(" ") + " " + (e.report || "")).join(" | ").toLowerCase();
  for (const topic of ["14 o'clock", "35 cm", "35 mm", "bi-rads 5 and also bi-rads 2", "4c for one", "from before", "cyst or a solid", "family history", "does that mean i have cancer", "which one"]) {
    assert.ok(text.includes(topic), "missing topic: " + topic);
  }
  assert.ok(entries.some((e) => e.cat === "report-problems" && e.messages.length > 1), "needs a multi-turn problem case");
  assert.ok(entries.some((e) => e.cat === "report-problems" && e.expect.includes("list5")), "needs an appointment-question case for a flagged report");
  // Every case that must not pick a winner between two numbers says so explicitly.
  for (const id of ["sanity-05", "sanity-14"]) assert.ok(entries.find((e) => e.id === id).mustNotMatch.length, id);
});

test("the new fictional reports exist and describe what their conversations expect", () => {
  assert.match(reports.r11, /14 o'clock/);
  assert.match(reports.r12, /35 cm/);
  assert.ok(/BI-RADS 5/.test(reports.r13) && /BI-RADS 2/.test(reports.r13));
  assert.ok(/BI-RADS 4C/.test(reports.r14) && /BI-RADS 2/.test(reports.r14) && /right breast/.test(reports.r14) && /left breast/.test(reports.r14));
  assert.ok(/COMPARISON/.test(reports.r15) && /BI-RADS 5/.test(reports.r15) && /BI-RADS 2/.test(reports.r15));
  assert.ok(/simple cyst/.test(reports.r16) && /solid vascular mass/.test(reports.r16));
  assert.ok(/\?/.test(reports.r17) && !/grandmother|mother|sister|aunt/.test(reports.r17), "r17 has only a question about family history");
  assert.match(reports.r18, /grandmother had breast cancer/);
});

test("fictional reports contain no obvious personal details", () => {
  for (const t of Object.values(reports)) assert.ok(!/\b(MRN|DOB|SSN|\d{3}-\d{2}-\d{4}|@)\b/.test(String(t)));
});

test("the checker catches bad replies and passes good ones", () => {
  const e = { expect: ["short", "admits_limit"], mustMatch: ["biopsy"] };
  const ok = { status: 200, reply: "A biopsy is the only way to know. I cannot tell you what it shows, and only your doctor can." };
  assert.deepEqual(checkReply(e, ok), []);
  assert.ok(checkReply(e, { status: 200, reply: "You have cancer. Get a biopsy." }).length);
  assert.ok(checkReply(e, { status: 200, reply: "Don't worry, it is probably fine, a biopsy will tell." }).length);
  assert.ok(checkReply(e, { status: 200, reply: "A biopsy is the answer — I cannot say more." }).length);
  assert.ok(checkReply(e, { status: 502, error: "down" }).length);
  assert.ok(checkReply({ expect: ["list5"] }, { status: 200, reply: "- one\n- two" }).length);
  assert.deepEqual(checkReply({ expect: ["list5"] }, { status: 200, reply: "- a\n- b\n- c\n- d\n- e" }), []);
});
