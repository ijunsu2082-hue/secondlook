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
    "off-topic-injection", "report-fidelity", "multi-turn", "navigation", "general", "pathology"]) assert.ok(cats.has(c), c);
  assert.ok(entries.filter((e) => e.cat === "urgent").length >= 8);
  assert.ok(entries.filter((e) => e.messages.length > 1).length >= 8, "needs multi-turn cases");
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
