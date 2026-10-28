// Baseline tests for the report decoder, written before any changes so we can
// tell if later edits broke it. Run with: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseReport, buildQuestions } from "../app/js/report.js";
import { checkReport, describeBirads } from "../app/js/sanity.js";
import { EXAMPLES, BIRADS, TERMS, QUESTIONS } from "../app/js/knowledge.js";

test("example reports parse to the expected BI-RADS category", () => {
  const want = [["0"], ["3"], ["4B"]];
  EXAMPLES.forEach((ex, i) => assert.deepEqual(parseReport(ex.text).birads, want[i], ex.title));
});

test("density is read from words and from letters", () => {
  assert.equal(parseReport("The breasts are heterogeneously dense.").density, "C");
  assert.equal(parseReport("Breast density: B").density, "B");
  assert.equal(parseReport("Nothing about density here, just BI-RADS 2").density, null);
});

test("clock position, side, distance and size are pulled out together", () => {
  const f = parseReport("A mass in the left breast at 2 o'clock, 5 cm from the nipple, measuring 1.4 cm.").findings[0];
  assert.equal(f.side, "left");
  assert.equal(f.hour, 2);
  assert.equal(f.distCm, 5);
  assert.equal(f.sizeCm, 1.4);
});

test("a negated finding is marked as absent", () => {
  const hits = parseReport("There is a cyst. No suspicious calcifications.").terms;
  const calc = hits.find((h) => /calcification/i.test(h.term));
  assert.ok(calc, "calcifications found");
  assert.equal(calc.negated, true);
});

test("every BI-RADS key used by the parser has content", () => {
  for (const k of ["0", "1", "2", "3", "4A", "4B", "4C", "5", "6"]) assert.ok(BIRADS[k], k);
});

test("glossary entries all have a plain definition", () => {
  for (const [term, tone, def] of TERMS) {
    assert.ok(term && def && def.length >= 5, term);
    assert.ok(["ok", "watch", "act", "info"].includes(tone), term);
  }
});

test("imaging and lab model files are present and the ONNX file is non-trivial", () => {
  for (const f of ["busi_effnet_b0.onnx", "busi_model.json", "wdbc_model.json"]) {
    assert.ok(fs.statSync(new URL("../app/models/" + f, import.meta.url)).size > 1000, f);
  }
  const s = JSON.parse(fs.readFileSync(new URL("../app/samples/samples.json", import.meta.url)));
  assert.ok(s.length >= 6);
  for (const x of s) assert.ok(fs.existsSync(new URL("../app/" + x.file, import.meta.url)), x.file);
});

// ---- several positions in one sentence (regression: only the first used to be kept)
test("every valid clock position in a sentence becomes its own finding, with its own side", () => {
  const f = parseReport("A cyst at the right breast 3 o'clock and a mass at the left breast 9 o'clock, 4 cm from the nipple, measuring 1.1 cm.").findings;
  assert.equal(f.length, 2);
  assert.deepEqual([f[0].side, f[0].hour, f[1].side, f[1].hour], ["right", 3, "left", 9]);
  // Distance and size belong to the second finding only.
  assert.equal(f[0].distCm, null);
  assert.equal(f[0].sizeCm, null);
  assert.equal(f[1].distCm, 4);
  assert.equal(f[1].sizeCm, 1.1);
});

test("a sentence with one clock position still reads the whole sentence, as before", () => {
  const f = parseReport("There is an oval mass in the left breast, measuring 0.9 cm, 3 cm from the nipple, at 10 o'clock.").findings;
  assert.equal(f.length, 1);
  assert.deepEqual([f[0].side, f[0].hour, f[0].distCm, f[0].sizeCm], ["left", 10, 3, 0.9]);
});

test("a position outside 1 to 12 is not turned into a finding, and valid ones next to it are kept", () => {
  const f = parseReport("A mass at the left breast 14 o'clock and a cyst at the left breast 3 o'clock.").findings;
  assert.deepEqual(f.map((x) => x.hour), [3]);
  assert.equal(f[0].side, "left");
  assert.equal(parseReport("A cyst at 0 o'clock.").findings.length, 0);
});

// ---- what the page shows, built from the parser and the sanity check
const questionsFor = (text) => { const r = parseReport(text); return buildQuestions(r, checkReport(text)); };

test("the built-in sample reports raise no warnings, so normal reports are not covered in alerts", () => {
  for (const ex of EXAMPLES) {
    const c = checkReport(ex.text);
    assert.equal(c.hasIssues, false, `${ex.title}: ${c.warnings.map((w) => w.title).join(" | ")}`);
  }
});

test("appointment questions never say the person has a family history unless the report states one", () => {
  for (const ex of EXAMPLES) {
    const qs = questionsFor(ex.text).join(" ");
    assert.ok(!/my family history/i.test(qs), ex.title);
    assert.ok(qs.includes(QUESTIONS.family[0]), "the neutral question is still offered");
  }
  // A question about family history is not a family history.
  const asked = questionsFor("HISTORY: Family history questionnaire not yet completed. Is there a family history of breast cancer?\nBI-RADS 1: Negative.");
  assert.ok(!asked.join(" ").toLowerCase().includes("my family history"));
  assert.ok(!asked.includes(QUESTIONS.familyStated[0]));
});

test("a stated family history switches to the question that refers to the report", () => {
  const qs = questionsFor("HISTORY: The patient reports that her grandmother had breast cancer.\nBI-RADS 1: Negative.");
  assert.ok(qs.includes(QUESTIONS.familyStated[0]));
  assert.ok(!qs.includes(QUESTIONS.family[0]));
});

test("a warning's own question comes first in the list for the doctor", () => {
  const text = "Mass in the left breast at 14 o'clock. BI-RADS 4B.";
  const check = checkReport(text);
  assert.ok(check.warnings.length >= 1);
  const qs = buildQuestions(parseReport(text), check);
  assert.equal(qs[0], check.warnings[0].question);
  assert.equal(new Set(qs).size, qs.length, "no repeats");
});

test("an earlier exam's BI-RADS number does not add its own next-step questions", () => {
  const text = "COMPARISON: Prior exam was assessed as BI-RADS 5.\nFINDINGS: The previously seen mass is no longer visible.\nIMPRESSION: No suspicious findings.\nBI-RADS 2: Benign.";
  const qs = questionsFor(text).join(" ");
  assert.ok(!/biopsy/i.test(qs), "category 5 questions would be about a biopsy");
});

test("two conflicting current numbers are described without choosing one", () => {
  const text = "FINDINGS: An irregular mass in the left breast at 2 o'clock.\nBI-RADS 5: Highly suggestive of malignancy.\nBI-RADS 2: Benign.";
  const d = describeBirads(checkReport(text));
  assert.ok(d.ambiguous);
  assert.match(d.sentence, /more than one BI-RADS number/);
  assert.ok(d.sentence.includes("5") && d.sentence.includes("2"));
  assert.ok(!/Your report gives a BI-RADS 5/.test(d.sentence));
  // Both numbers are still extracted from the text.
  assert.deepEqual(parseReport(text).birads.sort(), ["2", "5"]);
});
