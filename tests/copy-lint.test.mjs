// Checks the writing rules for everything a person reads: no em or en dashes,
// no buzzwords, no banned jargon, and US spelling. Run with: node --test "tests/*.test.mjs"
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { SYSTEM_PROMPT, buildContext } from "../assistant/prompt.mjs";
import { EMERGENCY_NOTE, SOON_NOTE } from "../assistant/core.mjs";
import { BIRADS, DENSITY, TERMS, QUESTIONS, EXAMPLES } from "../app/js/knowledge.js";

const read = (f) => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");
const FILES = ["app/index.html", "app/js/report.js", "app/js/scan.js", "app/js/check.js", "app/js/lab.js", "app/js/about.js", "app/js/chat.js", "app/js/knowledge.js"];

// Words that are fancy, vague or salesy. Add to this list when a new one shows up.
const BANNED = [/\bleverag/i, /\butiliz/i, /\bseamless/i, /\bcutting[- ]edge/i, /\brevolution/i, /\bempower/i, /\brobust\b/i,
  /\bstate[- ]of[- ]the[- ]art/i, /\bsynerg/i, /\bholistic/i, /\bgame[- ]chang/i, /\bnext[- ]gen/i, /\bfacilitat/i, /\bendeavo/i];
const BRITISH = [/\btumour/i, /\bcentre\b/i, /\bregularis/i, /\banalys(e|ing|ed)\b/i, /\bgrey\b/i];
const JARGON = [/Class Activation Map/i, /linear probe/i, /ONNX Runtime/i, /\bhallucinat/i];

// Visible text only: drop code comments and lines that are plain code.
const visible = (src) => src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

for (const f of FILES) {
  const txt = visible(read(f));
  test(`${f}: no em or en dashes`, () => assert.deepEqual(txt.match(/[—–]/g), null));
  test(`${f}: no buzzwords`, () => { for (const r of BANNED) assert.ok(!r.test(txt), String(r)); });
  test(`${f}: US spelling`, () => { for (const r of BRITISH) assert.ok(!r.test(txt), String(r)); });
  test(`${f}: no hard jargon in visible text`, () => { for (const r of JARGON) assert.ok(!r.test(txt), String(r)); });
}

test("no unverified accuracy claims on the page", () => {
  const html = read("app/index.html") + read("app/js/lab.js");
  assert.ok(!/98%/.test(html));
  assert.ok(!/100%/.test(html));
  assert.ok(!/better than random forest/i.test(html));
});

test("data in knowledge.js reads cleanly", () => {
  const all = JSON.stringify([BIRADS, DENSITY, TERMS, QUESTIONS, EXAMPLES]);
  assert.deepEqual(all.match(/[—–]/g), null);
});

test("assistant instructions and safety messages follow the same rules", () => {
  // The prompt mentions dashes only to forbid them, so skip those rule lines.
  const prompt = SYSTEM_PROMPT.split("\n").filter((l) => !/em dashes or en dashes|utilize/.test(l)).join("\n");
  for (const t of [prompt, EMERGENCY_NOTE, SOON_NOTE, buildContext(null)]) {
    assert.deepEqual(t.match(/[—–]/g), null);
    for (const r of BANNED) assert.ok(!r.test(t), String(r));
  }
});

test("sentences in the safety messages stay short", () => {
  for (const t of [EMERGENCY_NOTE, SOON_NOTE]) {
    for (const sentence of t.split(/(?<=[.!?])\s+/)) assert.ok(sentence.split(/\s+/).length <= 40, sentence);
  }
});
