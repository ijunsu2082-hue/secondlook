// Adversarial tests for the report sanity check (app/js/sanity.js). Every report below is fictional.
// The layer finds values that cannot be right, parts of a report that may disagree, and text it could not read.
// It must never diagnose, never pick a winner between conflicting findings, never change a unit, side or
// category, and never throw away a valid finding. Run with: node --test "tests/*.test.mjs"
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { checkReport, familyHistory, describeBirads, splitSentences, LEVELS } from "../app/js/sanity.js";
import { parseReport } from "../app/js/report.js";
import { EXAMPLES } from "../app/js/knowledge.js";

const ids = (r) => r.warnings.map((w) => w.id);
const noteIds = (r) => r.notes.map((n) => n.id);
const get = (r, id) => r.warnings.find((w) => w.id === id);
// Spans must point at the original text, character for character.
const verbatim = (text, r) => {
  for (const w of r.warnings) {
    assert.equal(w.spans.length, w.evidence.length, w.id);
    w.spans.forEach((s, i) => assert.equal(text.slice(s.start, s.end), w.evidence[i], `${w.id} span ${i}`));
  }
};
const BANNED = [/\bleverag/i, /\butiliz/i, /\bseamless/i, /\bcutting[- ]edge/i, /\brevolution/i, /\bempower/i, /\brobust\b/i, /\bsynerg/i, /\bholistic/i, /\bgame[- ]chang/i, /\bfacilitat/i];

const NORMAL = "EXAM: Targeted ultrasound of the right breast.\nFINDINGS: At the right breast 10 o'clock, 3 cm from the nipple, there is an oval, circumscribed mass measuring 0.9 x 0.5 cm.\nIMPRESSION: Probably benign.\nBI-RADS 3: Probably benign.";

// ---------------------------------------------------------------- 1 normal report
test("1. a normal report with one BI-RADS category and one valid clock position raises nothing", () => {
  const r = checkReport(NORMAL);
  assert.deepEqual(r.warnings, []);
  assert.deepEqual(r.notes, []);
  assert.equal(r.hasIssues, false);
  assert.deepEqual(r.facts.birads.map((b) => [b.category, b.current, b.historical]), [["3", true, false]]);
  assert.deepEqual(r.facts.clock.map((c) => [c.raw, c.hours, c.valid]), [["10 o'clock", [10], true]]);
  assert.equal(r.facts.family.stated, false);
  const d = describeBirads(r);
  assert.equal(d.sentence, null, "the caller keeps its own sentence when there is nothing to add");
  assert.equal(d.ambiguous, false);
  assert.deepEqual(d.categories, ["3"]);
  const p = parseReport(NORMAL);
  assert.deepEqual(p.findings.map((f) => [f.side, f.hour, f.distCm, f.sizeCm]), [["right", 10, 3, 0.9]]);
});

// ---------------------------------------------------------------- 2 to 4 clock positions
test("2. 14 o'clock is flagged with its original text, and the valid position next to it is kept", () => {
  const t = "FINDINGS: A mass in the left breast at 14 o'clock measuring 1.2 cm and a cyst in the left breast at 3 o'clock. BI-RADS 4B.";
  const r = checkReport(t);
  const w = get(r, "clock-invalid");
  assert.ok(w, ids(r).join());
  assert.equal(w.level, "check");
  assert.equal(w.label, "Needs checking");
  assert.ok(w.evidence.includes("14 o'clock"));
  assert.match(w.title, /14 o'clock/);
  assert.match(w.detail, /1 to 12/);
  assert.match(w.detail, /should not normally be possible/);
  assert.match(w.detail, /your doctor/);
  assert.match(w.question, /14 o'clock/);
  verbatim(t, r);
  assert.deepEqual(r.facts.clock.map((c) => [c.raw, c.valid]), [["14 o'clock", false], ["3 o'clock", true]]);
  assert.deepEqual(ids(r), ["clock-invalid"], "nothing else should be raised");
  assert.deepEqual(r.facts.birads.map((b) => b.category), ["4B"]);
  const hours = parseReport(t).findings.map((f) => f.hour);
  assert.ok(hours.includes(3) && !hours.includes(14), "the valid position still extracts and the invalid one is not invented");
});

test("3. 0 o'clock is flagged and the BI-RADS category is untouched", () => {
  const t = "FINDINGS: A cyst in the right breast at 0 o'clock. BI-RADS 2.";
  const r = checkReport(t);
  assert.ok(ids(r).includes("clock-invalid"));
  assert.ok(get(r, "clock-invalid").evidence.includes("0 o'clock"));
  assert.deepEqual(r.facts.birads.map((b) => b.category), ["2"]);
  assert.deepEqual(parseReport(t).birads, ["2"]);
  verbatim(t, r);
});

test("4. 25 o'clock and 100 o'clock are each flagged once, by their own text", () => {
  const t = "FINDINGS: A mass in the left breast at 25 o'clock and another mass in the left breast at 100 o'clock.";
  const r = checkReport(t);
  const w = r.warnings.filter((x) => x.id === "clock-invalid");
  assert.equal(w.length, 2);
  assert.deepEqual(w.map((x) => x.evidence[0]).sort(), ["100 o'clock", "25 o'clock"]);
  verbatim(t, r);
});

test("20. an ordinary time of day is not a clock position", () => {
  for (const t of ["The appointment is at 9 o'clock this morning.", "The clinic is open until 17 o'clock tomorrow."]) {
    const r = checkReport(t);
    assert.deepEqual(r.facts.clock, [], t);
    assert.ok(!ids(r).includes("clock-invalid"), t);
  }
});

test("21. a valid and an invalid position in one sentence keep the valid one", () => {
  const t = "FINDINGS: A mass at the left breast 2 o'clock and a cyst at 14 o'clock.";
  const r = checkReport(t);
  assert.deepEqual(r.facts.clock.map((c) => [c.hours[0], c.valid]), [[2, true], [14, false]]);
  assert.deepEqual(ids(r), ["clock-invalid"]);
  assert.deepEqual(parseReport(t).findings.map((f) => f.hour), [2]);
});

test("odd minutes, ranges and spelling variants of o'clock", () => {
  const odd = checkReport("FINDINGS: A mass in the left breast at 3:45 o'clock.");
  assert.deepEqual(ids(odd), ["clock-format"]);
  assert.equal(get(odd, "clock-format").level, "check");
  assert.deepEqual(checkReport("FINDINGS: A mass in the left breast at 2:30 o'clock.").warnings, []);
  // regression: a range such as 2-3 o'clock is two positions, both valid
  const range = checkReport("FINDINGS: A mass in the left breast at 2-3 o'clock.");
  assert.deepEqual(range.facts.clock.map((c) => [c.hours, c.valid]), [[[2, 3], true]]);
  const badRange = checkReport("FINDINGS: A mass in the left breast at 11 to 14 o'clock.");
  assert.deepEqual(ids(badRange), ["clock-invalid"]);
  for (const v of ["o’clock", "o clock", "oclock", "O'CLOCK"]) {
    const r = checkReport(`FINDINGS: A mass in the left breast at 3 ${v}.`);
    assert.deepEqual(r.facts.clock.map((c) => c.valid), [true], v);
  }
});

// ---------------------------------------------------------------- 5, 6, 22, 23 measurements
test("5. a 35 cm lesion is flagged for review, nothing is converted, and the finding is kept", () => {
  const t = "FINDINGS: Mass at the left breast 2 o'clock measuring 35 cm. BI-RADS 4C.";
  const r = checkReport(t);
  const w = get(r, "size-implausible");
  assert.ok(w);
  assert.equal(w.level, "check");
  assert.deepEqual(w.evidence, ["35 cm"]);
  assert.match(w.detail, /did not change or convert/);
  assert.match(w.detail, /your doctor/);
  assert.deepEqual(r.facts.measurements.map((m) => [m.raw, m.unit, m.maxCm, m.kind]), [["35 cm", "cm", 35, "size"]]);
  assert.deepEqual(r.facts.birads.map((b) => b.category), ["4C"]);
  assert.equal(parseReport(t).findings.length, 1);
  assert.ok(!ids(r).includes("size-no-unit"), "regression: an ordinary size with a unit is not 'missing a unit'");
  verbatim(t, r);
});

test("6. 35 mm and 35 cm in different places: the unit mismatch is a possible conflict, only 35 cm is implausible", () => {
  const t = "FINDINGS: A mass in the right breast at 3 o'clock measuring 35 mm. A separate cyst in the left breast at 9 o'clock measuring 35 cm.";
  const r = checkReport(t);
  const m = get(r, "size-unit-mismatch");
  assert.ok(m);
  assert.equal(m.level, "conflict");
  assert.equal(m.label, "Possible conflict");
  assert.deepEqual([...m.evidence].sort(), ["35 cm", "35 mm"]);
  assert.match(m.detail, /35 mm is 3\.5 cm/);
  assert.match(m.detail, /did not change either/);
  assert.deepEqual(get(r, "size-implausible").evidence, ["35 cm"], "35 mm alone is a normal size");
  verbatim(t, r);
});

test("a small number in two units is not a mismatch unless it is about the same spot", () => {
  const t = "FINDINGS: A 2 mm calcification in the right breast at 3 o'clock. A mass in the left breast at 9 o'clock measuring 2 cm.";
  assert.ok(!ids(checkReport(t)).includes("size-unit-mismatch"));
});

test("22. decimal commas and thousands separators are read as written, never silently fixed", () => {
  const dec = checkReport("FINDINGS: Mass in the left breast at 2 o'clock measuring 1,4 cm.");
  assert.deepEqual(dec.warnings, []);
  assert.equal(dec.facts.measurements[0].maxCm, 1.4);
  assert.equal(dec.facts.measurements[0].raw, "1,4 cm");
  const thou = checkReport("FINDINGS: Mass in the left breast at 2 o'clock measuring 1,400 cm.");
  assert.ok(ids(thou).includes("size-implausible"));
  assert.equal(thou.facts.measurements[0].raw, "1,400 cm");
  assert.equal(thou.facts.measurements[0].maxCm, 1400);
  const mm = checkReport("FINDINGS: Mass in the left breast at 2 o'clock measuring 350 mm.");
  assert.ok(ids(mm).includes("size-implausible"));
  assert.equal(mm.facts.measurements[0].unit, "mm");
  assert.equal(mm.facts.measurements[0].maxCm, 35);
});

test("sizes with several dimensions use the largest one, and zero or missing units are flagged", () => {
  assert.deepEqual(checkReport("FINDINGS: Mass in the left breast at 2 o'clock measuring 1.4 x 0.9 x 0.7 cm.").warnings, []);
  assert.ok(ids(checkReport("FINDINGS: Mass in the left breast at 2 o'clock measuring 12 x 3 x 2 cm.")).includes("size-large"));
  const zero = checkReport("FINDINGS: Mass in the left breast at 2 o'clock measuring 0 cm.");
  assert.ok(ids(zero).includes("size-zero"));
  const nounit = checkReport("FINDINGS: Mass in the left breast at 2 o'clock measuring 14.");
  assert.deepEqual(ids(nounit), ["size-no-unit"]);
  assert.equal(get(nounit, "size-no-unit").level, "unreadable");
  const far = checkReport("FINDINGS: Mass in the left breast at 2 o'clock, 30 cm from the nipple, measuring 1.2 cm.");
  assert.deepEqual(ids(far), ["distance-implausible"]);
  assert.deepEqual(checkReport("FINDINGS: Mass in the left breast at 2 o'clock, 4 cm from the nipple, measuring 1.2 cm.").warnings, []);
});

test("23. very different sizes for the same spot are a possible conflict, equal sizes in two units are not", () => {
  const t = "FINDINGS: Left breast 2 o'clock, there is a mass measuring 1.4 cm. At the left breast 2 o'clock the mass measures 14 cm.";
  const r = checkReport(t);
  assert.ok(ids(r).includes("size-disagree"));
  assert.equal(get(r, "size-disagree").level, "conflict");
  assert.deepEqual([...get(r, "size-disagree").evidence].sort(), ["1.4 cm", "14 cm"]);
  verbatim(t, r);
  const same = checkReport("FINDINGS: Left breast 2 o'clock, there is a mass measuring 1.4 cm. At the left breast 2 o'clock the mass measures 14 mm.");
  assert.ok(!ids(same).includes("size-disagree"));
  const different = checkReport("FINDINGS: A mass at the left breast 2 o'clock measuring 2 cm. A calcification at the left breast 2 o'clock measuring 3 mm.");
  assert.ok(!ids(different).includes("size-disagree"), "a speck inside a mass is not the same finding");
});

test("18. a valid but unusual finding is not rejected, and a very large one is only asked about", () => {
  const big = "FINDINGS: There is an irregular mass in the right breast at 12 o'clock measuring 6.5 cm.\nIMPRESSION: Highly suggestive of malignancy. BI-RADS 5.";
  const r = checkReport(big);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.facts.measurements[0].maxCm, 6.5);
  const f = parseReport(big).findings;
  assert.deepEqual(f.map((x) => [x.side, x.hour, x.sizeCm]), [["right", 12, 6.5]]);
  const huge = "FINDINGS: There is a mass in the left breast at 12 o'clock measuring 11 cm.";
  const h = checkReport(huge);
  assert.deepEqual(ids(h), ["size-large"]);
  assert.equal(h.warnings[0].level, "check");
  assert.equal(parseReport(huge).findings.length, 1, "the finding is still extracted");
});

// ---------------------------------------------------------------- 7 to 10 BI-RADS
test("7. different BI-RADS numbers for separate findings are a note, not a warning, and both are kept", () => {
  const t = "FINDINGS: Left breast 2 o'clock mass: BI-RADS 5. Right breast 9 o'clock cyst: BI-RADS 2.";
  const r = checkReport(t);
  assert.deepEqual(r.warnings, []);
  assert.deepEqual(noteIds(r), ["birads-separate"]);
  assert.deepEqual(r.facts.birads.map((b) => [b.category, b.target]), [["5", "left 2"], ["2", "right 9"]]);
  assert.deepEqual(parseReport(t).birads.sort(), ["2", "5"]);
  const d = describeBirads(r);
  assert.equal(d.ambiguous, true);
  assert.match(d.sentence, /different BI-RADS numbers for different findings/);
  assert.match(d.sentence, /5 \(for the left breast at 2 o'clock\)/);
  assert.match(d.sentence, /2 \(for the right breast at 9 o'clock\)/);
  assert.ok(!/^Your report gives a BI-RADS \d/.test(d.sentence));
});

test("8. an earlier BI-RADS 5 and a current BI-RADS 2 are not a conflict", () => {
  const t = "COMPARISON: Prior exam showed BI-RADS 5.\nFINDINGS: The previously seen mass in the right breast at 9 o'clock is no longer visible.\nIMPRESSION: BI-RADS 2.";
  const r = checkReport(t);
  assert.deepEqual(r.warnings, []);
  assert.ok(noteIds(r).includes("birads-history"));
  const byCat = Object.fromEntries(r.facts.birads.map((b) => [b.category, b]));
  assert.equal(byCat["5"].historical, true);
  assert.equal(byCat["5"].current, false);
  assert.equal(byCat["2"].current, true);
  const d = describeBirads(r);
  assert.match(d.sentence, /BI-RADS 2 for this exam/);
  assert.match(d.sentence, /earlier exam/);
  assert.deepEqual(d.categories, ["5", "2"], "nothing is discarded");
});

test("9. 'Previously BI-RADS 5, now BI-RADS 2' in one sentence is history plus a current number", () => {
  const r = checkReport("FINDINGS: A mass in the left breast at 2 o'clock. Previously BI-RADS 5, now BI-RADS 2.");
  assert.deepEqual(r.warnings, []);
  const byCat = Object.fromEntries(r.facts.birads.map((b) => [b.category, b]));
  assert.equal(byCat["5"].historical, true);
  assert.equal(byCat["2"].current, true);
  const down = checkReport("IMPRESSION: Mass at the left breast 2 o'clock, downgraded from BI-RADS 5 to BI-RADS 2.");
  assert.deepEqual(down.warnings, []);
  assert.equal(down.facts.birads.find((b) => b.category === "5").historical, true);
});

test("10. two apparently conflicting current categories with no explanation are a possible conflict", () => {
  const t = "FINDINGS: Mass at the left breast 2 o'clock. BI-RADS 5. Impression BI-RADS 2.";
  const r = checkReport(t);
  const w = get(r, "birads-conflict");
  assert.ok(w);
  assert.equal(w.level, "conflict");
  assert.deepEqual([...w.evidence].sort(), ["BI-RADS 2", "BI-RADS 5"]);
  assert.match(w.detail, /cannot tell which number is right/);
  assert.match(w.detail, /have not picked one/);
  assert.match(w.detail, /nothing about your health|anything about your health/);
  verbatim(t, r);
  assert.deepEqual(r.facts.birads.map((b) => b.category), ["5", "2"]);
  const d = describeBirads(r);
  assert.equal(d.ambiguous, true);
  assert.match(d.sentence, /more than one BI-RADS number \(5 and 2\)/);
  assert.match(d.sentence, /cannot tell which one is right/);
  assert.ok(!/^Your report gives a BI-RADS/.test(d.sentence), "an ambiguous report is never summarized as one certain category");
});

test("a conflict about the same finding says so, and a stated change is only a note", () => {
  const same = checkReport("FINDINGS: Left breast 2 o'clock mass BI-RADS 5. Left breast 2 o'clock mass BI-RADS 2.");
  assert.match(get(same, "birads-conflict").detail, /same finding/);
  const changed = checkReport("IMPRESSION: Mass at the left breast 2 o'clock, BI-RADS 4 upgraded to BI-RADS 5 after biopsy.");
  assert.deepEqual(changed.warnings, []);
  assert.deepEqual(noteIds(changed), ["birads-changed"]);
  assert.match(describeBirads(changed).sentence, /changed/);
  // 4 and 4B are the same family, not a conflict
  assert.deepEqual(checkReport("EXAM: Ultrasound of the left breast. FINDINGS: Mass at the left breast 2 o'clock. BI-RADS 4. IMPRESSION: BI-RADS 4B.").warnings, []);
  // 4A and 4B are different
  assert.ok(ids(checkReport("Mass at the left breast 2 o'clock. BI-RADS 4A. Impression BI-RADS 4B.")).includes("birads-conflict"));
});

test("19. impossible BI-RADS values are flagged, kept as text, and left out of the valid categories", () => {
  const t = "FINDINGS: Mass at the left breast 2 o'clock. BI-RADS 7. Also BI-RADS 4D and BI-RADS 3A.";
  const r = checkReport(t);
  const w = r.warnings.filter((x) => x.id === "birads-invalid");
  assert.equal(w.length, 3);
  assert.deepEqual(w.map((x) => x.evidence[0]).sort(), ["BI-RADS 3A", "BI-RADS 4D", "BI-RADS 7"]);
  assert.ok(w.every((x) => x.level === "check" && /your doctor/.test(x.detail)));
  assert.deepEqual(r.facts.birads, []);
  assert.equal(r.facts.biradsInvalid.length, 3);
  verbatim(t, r);
  const mixed = checkReport("FINDINGS: Mass at the left breast 2 o'clock. BI-RADS 7. IMPRESSION: BI-RADS 2.");
  assert.deepEqual(mixed.facts.birads.map((b) => b.category), ["2"]);
  assert.deepEqual(ids(mixed), ["birads-invalid"]);
  // regression: the scale itself is not a category
  assert.deepEqual(checkReport("FINDINGS: Mass at the left breast 2 o'clock. BI-RADS 0-6 is the scale radiologists use.").facts.birads, []);
  assert.ok(ids(checkReport("The BI-RADS category is pending.")).includes("birads-unreadable"));
});

// ---------------------------------------------------------------- 11 to 13 descriptions of one finding
test("11. a simple cyst and a solid vascular mass at the same position may be one finding described two ways", () => {
  const t = "FINDINGS: At the left breast 2 o'clock there is a simple cyst. At the left breast 2 o'clock there is also a solid vascular mass.";
  const r = checkReport(t);
  const w = get(r, "finding-cyst-solid");
  assert.ok(w);
  assert.equal(w.level, "conflict");
  assert.match(w.detail, /may be the same finding/);
  assert.match(w.detail, /have not picked one/);
  assert.ok(w.evidence.some((e) => /cyst/i.test(e)) && w.evidence.some((e) => /solid/i.test(e)));
  verbatim(t, r);
  assert.deepEqual(checkReport("FINDINGS: At the left breast 2 o'clock there is a simple cyst with a solid vascular mass.").warnings.map((x) => x.id), ["finding-cyst-solid"]);
  // a complex cyst with a solid part is a real thing, not a contradiction
  for (const ok of ["FINDINGS: At the left breast 2 o'clock there is a complex cystic and solid mass.", "FINDINGS: At the left breast 2 o'clock there is a complicated cyst with a solid component."]) {
    assert.deepEqual(checkReport(ok).warnings, [], ok);
  }
});

test("when we cannot tell whether two descriptions are the same finding, we say that", () => {
  const r = checkReport("FINDINGS: There is a simple cyst in the breast. The same lesion is a solid vascular mass.");
  const w = get(r, "finding-cyst-solid");
  assert.ok(w);
  assert.match(w.detail, /could not tell whether they describe the same finding/);
  assert.ok(!/may be the same finding\b/.test(w.detail));
});

test("12. two different lesions, one cystic and one solid, raise nothing", () => {
  for (const t of [
    "FINDINGS: Left breast 2 o'clock: simple cyst. Right breast 9 o'clock: solid mass.",
    "FINDINGS: A simple cyst in the left breast at 2 o'clock and a solid vascular mass in the left breast at 9 o'clock.",
    "FINDINGS: Lesion 1 is a simple cyst. Lesion 2 is a solid vascular mass.",
  ]) assert.deepEqual(checkReport(t).warnings, [], t);
});

test("benign and suspicious for one finding is a possible conflict unless the report explains it", () => {
  const r = checkReport("FINDINGS: At the left breast 2 o'clock there is a benign mass. At the left breast 2 o'clock there is a suspicious mass.");
  assert.ok(ids(r).includes("finding-benign-suspicious"));
  const explained = checkReport("FINDINGS: At the left breast 2 o'clock there is a suspicious mass. After biopsy, the left breast 2 o'clock mass is benign.");
  assert.ok(!ids(explained).includes("finding-benign-suspicious"));
  const apart = checkReport("FINDINGS: A benign cyst at the left breast 3 o'clock. A suspicious mass at the right breast 9 o'clock.");
  assert.deepEqual(apart.warnings, []);
});

test("13. negation: 'no suspicious mass' and 'no vascularity' are not findings", () => {
  for (const t of [
    "FINDINGS: No suspicious mass. No vascularity. A benign cyst at 3 o'clock in the left breast.",
    "FINDINGS: A benign fibroadenoma at the left breast 2 o'clock. No suspicious features. No solid component. No internal vascularity.",
    "FINDINGS: At the left breast 2 o'clock there is a simple cyst. No solid masses.",
    "FINDINGS: At the left breast 2 o'clock there is a simple cyst, but not a solid vascular mass.",
    "IMPRESSION: Probably benign. BI-RADS 3: Probably benign (less than 2% likelihood of malignancy).",
    "FINDINGS: No evidence of malignancy. The mass at the left breast 2 o'clock is benign.",
  ]) assert.deepEqual(checkReport(t).warnings, [], t);
});

// ---------------------------------------------------------------- 14, 15 family history
test("14. a family history question gives no family history, and 'history' alone is not one", () => {
  const t = "EXAM: Screening mammogram.\nHISTORY: Family history questionnaire not yet completed. Is there a family history of breast cancer?\nBI-RADS 1: Negative.";
  const f = familyHistory(t);
  assert.equal(f.stated, false);
  assert.deepEqual(f.relatives, []);
  assert.equal(f.mentionedOnly, true);
  assert.equal(checkReport(t).facts.family.stated, false);
  const plain = familyHistory("HISTORY: History of prior breast surgery. Surgical history noted.");
  assert.equal(plain.stated, false);
  assert.equal(plain.mentionedOnly, false, "the word history alone never counts");
  const cond = familyHistory("Please tell us if there is a family history of breast cancer.");
  assert.equal(cond.stated, false);
  assert.equal(cond.mentionedOnly, true);
});

test("15. an explicit family history is picked up, a negated one is not", () => {
  const yes = familyHistory("HISTORY: Her grandmother had breast cancer.");
  assert.equal(yes.stated, true);
  assert.ok(yes.relatives.includes("grandmother"));
  assert.equal(yes.mentionedOnly, false);
  assert.match(yes.snippets[0], /grandmother/);
  assert.equal(familyHistory("HISTORY: Strong family history of breast cancer.").stated, true);
  const two = familyHistory("The patient's mother and sister had breast cancer.");
  assert.deepEqual(two.relatives.sort(), ["mother", "sister"]);
  const no = familyHistory("HISTORY: No family history of breast cancer.");
  assert.equal(no.stated, false);
  assert.equal(no.negated, true);
  assert.equal(familyHistory("HISTORY: Mother had ovarian cancer.").stated, true);
  assert.equal(familyHistory("Mass is dense relative to the surrounding tissue.").stated, false);
});

// ---------------------------------------------------------------- 16 left and right
test("16a. an exam line that names one breast while a finding names the other is a possible conflict", () => {
  const t = "EXAM: Targeted ultrasound of the right breast.\nFINDINGS: There is a 1.1 cm mass in the left breast at 2 o'clock.\nIMPRESSION: Probably benign mass. BI-RADS 3.";
  const r = checkReport(t);
  const w = get(r, "laterality-exam");
  assert.ok(w);
  assert.equal(w.level, "conflict");
  assert.match(w.detail, /did not change either side/);
  verbatim(t, r);
  // not flagged: bilateral exams, matching sides, and a normal other breast
  assert.ok(!ids(checkReport("EXAM: Bilateral screening mammogram.\nFINDINGS: Mass in the left breast at 2 o'clock. The right breast is unremarkable.")).includes("laterality-exam"));
  assert.deepEqual(checkReport("EXAM: Targeted ultrasound of the right breast.\nFINDINGS: Mass in the right breast at 10 o'clock.\nIMPRESSION: Right breast mass.").warnings, []);
  assert.deepEqual(checkReport("EXAM: Diagnostic mammogram of the left breast.\nFINDINGS: Mass in the left breast at 2 o'clock. The right breast is unremarkable.").warnings, []);
});

test("16b. findings and impression that name different breasts are a possible conflict", () => {
  const t = "FINDINGS: Mass in the left breast at 2 o'clock.\nIMPRESSION: Suspicious mass in the right breast.";
  const r = checkReport(t);
  assert.ok(ids(r).includes("laterality-impression"));
  verbatim(t, r);
  assert.ok(!ids(checkReport("FINDINGS: Mass in the left breast at 2 o'clock.\nIMPRESSION: Mass in the left breast. The right breast is clear.")).includes("laterality-impression"));
});

test("16c. one finding put in both breasts in one sentence is a possible conflict", () => {
  const t = "FINDINGS: There is a 1.2 cm mass in the left breast at 2 o'clock in the right breast.";
  const r = checkReport(t);
  assert.ok(ids(r).includes("laterality-both"));
  assert.equal(get(r, "laterality-both").level, "conflict");
  verbatim(t, r);
  for (const ok of [
    "FINDINGS: Mass in the left breast at 2 o'clock compared with the right breast.",
    "FINDINGS: Mass in the left breast at 2 o'clock while the right breast is clear.",
    "FINDINGS: Left breast 2 o'clock mass, right breast is unremarkable.",
  ]) assert.ok(!ids(checkReport(ok)).includes("laterality-both"), ok);
});

// ---------------------------------------------------------------- 17 malformed
test("17. malformed text, odd spacing and stray characters never throw and still yield what is valid", () => {
  const t = "mass   left breast at 3 oclock   BI-RADS   4a  measuring 1,4 cm\n\n\n   cyst right  9 O'CLOCK";
  const r = checkReport(t);
  assert.deepEqual(r.facts.clock.map((c) => [c.hours[0], c.valid]), [[3, true], [9, true]]);
  assert.deepEqual(r.facts.birads.map((b) => b.category), ["4A"]);
  assert.equal(r.facts.measurements[0].maxCm, 1.4);
  verbatim(t, r);
  for (const junk of ["", "   ", "\n\n\n", "@@@ ### !!! ???", "​ mass left breast at 3 o’clock BI‑RADS 3", "o'clock o'clock o'clock 12 12 12", "BI-RADS BI-RADS BI-RADS", "1,4 cm 1,4 cm x x x cm", null, undefined, 42, {}]) {
    assert.doesNotThrow(() => checkReport(junk), String(junk));
    const out = checkReport(junk);
    assert.ok(Array.isArray(out.warnings) && Array.isArray(out.notes) && out.facts && typeof out.hasIssues === "boolean");
  }
  const curly = checkReport("FINDINGS: mass left breast at 3 o’clock.");
  assert.deepEqual(curly.facts.clock.map((c) => c.valid), [true]);
});

test("text with nothing we can read says so, and a normal report does not", () => {
  const r = checkReport("The quick brown fox jumps over the lazy dog again and again.");
  assert.deepEqual(ids(r), ["nothing-readable"]);
  assert.equal(r.warnings[0].level, "unreadable");
  assert.equal(r.warnings[0].label, "Could not interpret");
  assert.ok(r.warnings[0].evidence.length && r.warnings[0].evidence[0].length > 0);
  assert.ok(!ids(checkReport("Hello")).includes("nothing-readable"), "very short text is left alone");
  assert.ok(!ids(checkReport(NORMAL)).includes("nothing-readable"));
});

// ---------------------------------------------------------------- 24 fuzz and speed
test("24. fuzzing: random report-like strings never throw and are fast, and large inputs are capped", () => {
  const tokens = ["12", "0", "13", "14", "25", "100", "o'clock", "oclock", "BI-RADS", "BI-RADS 4B", "BIRADS 7", "category 3", "cm", "mm", "35", "1.4", "1,400", "x", "left", "right", "breast", "mass", "cyst", "solid", "vascular", "simple", "benign", "suspicious", "no", "not", ".", ",", ":", "\n", "  ", "measuring", "prior", "now", "family history", "grandmother", "breast cancer", "?", "’", "#", "FINDINGS:", "IMPRESSION:", "EXAM:", "previously", "upgraded", "lesion 1", "mass A"];
  let seed = 12345;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const start = performance.now();
  for (let i = 0; i < 300; i++) {
    const n = 3 + Math.floor(rand() * 28);
    const text = Array.from({ length: n }, () => tokens[Math.floor(rand() * tokens.length)]).join(rand() < 0.5 ? " " : "");
    const r = checkReport(text);
    verbatim(text.slice(0, 20000), r);
    for (const w of r.warnings) assert.ok(LEVELS[w.level] === w.label && w.title && w.detail && w.question && w.evidence.length, `${w.id} in: ${JSON.stringify(text)}`);
    familyHistory(text);
    describeBirads(r);
  }
  assert.ok(performance.now() - start < 2000, "300 random strings took " + (performance.now() - start) + " ms");
  const sentence = "FINDINGS: There is an oval mass in the left breast at 2 o'clock, 3 cm from the nipple, measuring 1.4 x 0.9 cm. BI-RADS 3. ";
  const big = sentence.repeat(Math.ceil(30000 / sentence.length));
  const t0 = performance.now();
  const r = checkReport(big);
  assert.ok(performance.now() - t0 < 500, "20000 characters took " + (performance.now() - t0) + " ms");
  assert.ok(r.facts.clock.every((c) => c.end <= 20000), "input is capped at 20000 characters");
  for (const nasty of ["1".repeat(20000), "o'clock ".repeat(2500), "BI-RADS ".repeat(2500), "1,".repeat(10000), "mass ".repeat(4000)]) {
    const t1 = performance.now();
    checkReport(nasty);
    assert.ok(performance.now() - t1 < 500, "nasty input was slow");
  }
});

// ---------------------------------------------------------------- 25 the built-in samples
test("25. the three built-in sample reports raise nothing", () => {
  EXAMPLES.forEach((e, i) => {
    const r = checkReport(e.text);
    assert.deepEqual(r.warnings, [], `example ${i}: ${ids(r).join()}`);
    assert.deepEqual(r.notes, [], `example ${i}`);
  });
});

// ---------------------------------------------------------------- cross-cutting rules
const CORPUS = [
  NORMAL,
  "FINDINGS: A mass in the left breast at 14 o'clock measuring 1.2 cm. BI-RADS 4B.",
  "FINDINGS: Mass at the left breast 2 o'clock measuring 35 cm. BI-RADS 4C.",
  "FINDINGS: A mass in the right breast at 3 o'clock measuring 35 mm. A separate cyst in the left breast at 9 o'clock measuring 35 cm.",
  "FINDINGS: Mass at the left breast 2 o'clock. BI-RADS 5. Impression BI-RADS 2.",
  "FINDINGS: Mass at the left breast 2 o'clock. BI-RADS 7. Also BI-RADS 4D.",
  "FINDINGS: At the left breast 2 o'clock there is a simple cyst. At the left breast 2 o'clock there is also a solid vascular mass.",
  "EXAM: Targeted ultrasound of the right breast.\nFINDINGS: There is a 1.1 cm mass in the left breast at 2 o'clock.\nIMPRESSION: Probably benign mass. BI-RADS 3.",
  "FINDINGS: Mass in the left breast at 2 o'clock measuring 14.",
  "FINDINGS: There is a mass in the left breast at 3:45 o'clock.",
  "The BI-RADS category is pending.",
  "The quick brown fox jumps over the lazy dog again and again.",
  "FINDINGS: Left breast 2 o'clock, there is a mass measuring 1.4 cm. At the left breast 2 o'clock the mass measures 14 cm.",
  "FINDINGS: A mass in the left breast at 2 o'clock, 30 cm from the nipple, measuring 1.2 cm.",
  "FINDINGS: Mass in the left breast at 2 o'clock measuring 0 cm.",
];

test("every warning and note is written in plain words: no dashes, no buzzwords, a question and evidence", () => {
  const seen = new Set();
  for (const t of CORPUS) {
    const r = checkReport(t);
    verbatim(t, r);
    for (const w of r.warnings) {
      seen.add(w.id);
      for (const s of [w.title, w.detail, w.question, w.label, ...w.evidence.map(() => "")]) {
        assert.ok(!/[—–]/.test(s), `${w.id}: dash in "${s}"`);
        for (const b of BANNED) assert.ok(!b.test(s), `${w.id}: ${b}`);
      }
      assert.ok(w.question.length > 10 && w.evidence.length >= 1 && w.title.length > 5 && w.detail.length > 40, w.id);
      assert.ok(["check", "conflict", "unreadable"].includes(w.level));
      assert.equal(w.label, LEVELS[w.level]);
      assert.ok(!/cancer risk|you have cancer|you do not have cancer|probability of cancer/i.test(w.detail), `${w.id} must not talk about the person's risk`);
    }
    for (const n of r.notes) for (const s of [n.title, n.detail]) { assert.ok(!/[—–]/.test(s)); for (const b of BANNED) assert.ok(!b.test(s)); }
  }
  for (const id of ["clock-invalid", "clock-format", "birads-invalid", "birads-conflict", "size-implausible", "size-unit-mismatch", "size-disagree", "size-large", "size-zero", "size-no-unit", "distance-implausible", "finding-cyst-solid", "laterality-exam", "birads-unreadable", "nothing-readable"]) {
    assert.ok(seen.has(id), `corpus never produced ${id}`);
  }
});

test("impossible values come with the benefit of the doubt, not a verdict", () => {
  for (const t of ["FINDINGS: A mass in the left breast at 14 o'clock.", "FINDINGS: Mass at the left breast 2 o'clock measuring 35 cm.", "FINDINGS: Mass at the left breast 2 o'clock. BI-RADS 7."]) {
    const w = checkReport(t).warnings[0];
    assert.match(w.detail, /should not normally be possible/);
    assert.match(w.detail, /may also be exactly what your doctor wrote/);
    assert.match(w.detail, /double check that it was copied correctly/);
    assert.match(w.detail, /ask your imaging team to confirm/);
  }
});

test("warnings are sorted by group, then by where they appear in the report", () => {
  const t = "FINDINGS: A mass in the left breast at 14 o'clock measuring 14. BI-RADS 5. Impression BI-RADS 2. A mass in the left breast at 13 o'clock.";
  const levels = checkReport(t).warnings.map((w) => w.level);
  const order = { check: 0, conflict: 1, unreadable: 2 };
  assert.deepEqual(levels, [...levels].sort((a, b) => order[a] - order[b]));
  const checks = checkReport(t).warnings.filter((w) => w.level === "check").map((w) => w.spans[0].start);
  assert.deepEqual(checks, [...checks].sort((a, b) => a - b));
});

test("the layer never invents patient details", () => {
  for (const t of CORPUS) {
    const r = checkReport(t);
    assert.equal(r.facts.family.stated, false, t);
    assert.deepEqual(r.facts.family.relatives, [], t);
    for (const w of r.warnings) assert.ok(!/family|mother|grandmother|sister|symptom/i.test(w.detail + w.title), w.id);
  }
});

test("a report with problems still shows every valid finding", () => {
  const t = "FINDINGS: Left breast 2 o'clock mass measuring 1.4 cm, 4 cm from the nipple. A cyst in the right breast at 14 o'clock. A mass in the right breast at 9 o'clock measuring 35 cm.\nIMPRESSION: BI-RADS 7. BI-RADS 4B.";
  const r = checkReport(t);
  assert.deepEqual(r.facts.clock.filter((c) => c.valid).map((c) => c.hours[0]), [2, 9]);
  assert.deepEqual(r.facts.birads.map((b) => b.category), ["4B"]);
  assert.equal(r.facts.measurements.length, 3);
  const p = parseReport(t);
  assert.ok(p.findings.some((f) => f.hour === 2 && f.sizeCm === 1.4));
  assert.ok(p.findings.some((f) => f.hour === 9 && f.sizeCm === 35), "a doubtful value is shown, not dropped");
});

test("splitSentences never splits on decimals and tracks sections", () => {
  const s = splitSentences("EXAM: Ultrasound of the left breast.\nFINDINGS: A mass measuring 0.9 x 0.5 cm. It is oval.\nIMPRESSION: BI-RADS 3.");
  assert.deepEqual(s.map((x) => x.section), ["EXAM", "FINDINGS", "FINDINGS", "IMPRESSION"]);
  assert.ok(s[1].text.includes("0.9 x 0.5 cm"));
  const text = "FINDINGS: A mass.  \r\n  IMPRESSION: Benign.";
  for (const x of splitSentences(text)) assert.equal(text.slice(x.start, x.end), x.text);
});

test("the module is pure: no DOM, no network, and its own source has no dash characters", () => {
  const src = fs.readFileSync(new URL("../app/js/sanity.js", import.meta.url), "utf8");
  assert.ok(!/document\.|window\.|fetch\(|XMLHttpRequest/.test(src.replace(/^\s*\/\/.*$/gm, "")));
  for (const line of src.split("\n")) {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
    assert.ok(!/[—–]/.test(line), "dash character in: " + line.trim().slice(0, 80));
  }
  assert.ok(!src.includes("\b"), "no backspace characters from shell mangling");
});

test("a HISTORY or COMPARISON label does not turn later BI-RADS numbers into earlier exams", () => {
  for (const t of [
    "HISTORY: 45 year old with a lump.\nMammogram shows a mass in the right breast. BI-RADS 4.",
    "Comparison: none. The right breast has a mass. BI-RADS 3.",
    "INDICATION: screening.\nThe breasts are fatty. No mass.\nBI-RADS 1.",
  ]) {
    const r = checkReport(t);
    assert.equal(r.facts.birads.filter((b) => b.current).length, 1, t);
    assert.equal(r.notes.some((n) => n.id === "birads-history"), false, t);
  }
});

test("unreadable BI-RADS evidence covers the whole word", () => {
  const r = checkReport("BI-RADS assessment pending.");
  const w = r.warnings.find((x) => x.id === "birads-unreadable");
  assert.equal(w.evidence[0], "BI-RADS");
});
