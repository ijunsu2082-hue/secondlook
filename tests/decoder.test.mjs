// Baseline tests for the report decoder, written before any changes so we can
// tell if later edits broke it. Run with: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseReport } from "../app/js/report.js";
import { EXAMPLES, BIRADS, TERMS } from "../app/js/knowledge.js";

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
