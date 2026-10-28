# How SecondLook maps to the judging rubric

This is our own reading of the rubric. It is not a score. We make no claims about real-world impact because we have no user data, and no clinician has reviewed the project.

## Prototype and technical execution (10 points)

**A connected product.** Paste a report, see it explained, ask questions about it, get questions for the doctor, and find the right feature. Each step feeds the next.

**Our own machine-learning work** (verified against `training/` and `app/models/`; details in `MODEL_CARD.md`):
- A breast ultrasound classifier built on a frozen, pretrained EfficientNet-B0, with our own trained classification layer (a logistic regression on 1,280 image features).
- Our own data pipeline: perceptual-hash and feature-similarity duplicate detection (312 of 780 images had a near-copy), removal of 22 images whose copies had different labels, and 5-fold testing in which groups of copies never cross between training and testing.
- Our own conversion to ONNX (checked against the original to 2.5 in a million) and a browser version (checked against the Python reference on 6 samples to within 0.015).
- An exact highlight map, with its limits stated.
- We did not train the image model from scratch and we did not fine-tune it. We say so.

**A deliberate mix of rules and AI.** Rules extract findings from the report because that is predictable and testable. A language model explains the findings and answers questions because that is what it is good at. A trained image classifier handles pixels. Nothing was added just to look more like AI.

**Engineering for safety and reliability.**
- Server-side chat function. The API key never reaches the browser.
- The chat is locked until the person reads and accepts what is sent to OpenAI, and the server refuses requests that skipped that step.
- Fixed safety notes (urgent symptoms, "a good result is not proof", privacy) and a reply guard that stops false reassurance and diagnosis. None of these depend on the AI.
- Clear errors. A failed request never turns into a made-up answer.
- 146 unit tests, a browser test, an interaction audit, a live smoke test, and 135 test conversations with every run recorded, including failures.
- **Report Sanity Check.** A fixed-rule layer (`app/js/sanity.js`) that checks a report for values that cannot be right and statements that disagree. It runs in the browser and on the server, has 41 tests of its own (25 adversarial cases plus fuzz), and never picks which of two statements is right.

**Honest about the sanity layer.** It is heuristic. It uses fixed rules, so it can miss things. It cannot catch every contradiction. Two descriptions of one lesion only count as a conflict when the side, the clock position or a back-reference such as "the mass" lets us tell they are about the same lesion. Small unit slips, such as 1.2 mm where 1.2 cm was meant, are missed. Clock positions written as words, such as "fourteen o'clock", are not detected.

**Honest about what is not done:** no clinician review, no test on outside ultrasound data, no check on real patient reports.

## Feasibility and potential impact (4 points)

- Runs as a plain static site plus one small function. Low cost to run.
- Most of the app works with no server and sends nothing out.
- Next steps are concrete: clinician review, de-identified real reports for the rule-based reader, outside ultrasound data, and more languages.
- The sanity layer is plain code with no extra service, so it adds no running cost. Its real-world value is untested. We have no data on how often real reports contain these problems.
- No impact numbers are claimed.

## Pain point and problem relevance (3 points)

- The problem is the wait between a result and a doctor's explanation, and reports written for doctors, not patients.
- The app answers the questions people have at that point and helps them prepare for the visit.
- Reports can contain typing or copy mistakes, or two statements that disagree, and a person reading alone cannot tell. The sanity layer points these out as things to ask about, without saying who is right. We have not measured how common this is.

## Alignment with the cancer and oncology category (3 points)

- Built around breast imaging reports, biopsy results and early warning signs.
- Uses BI-RADS and published advice from the CDC, American Cancer Society, NHS, NICE and USPSTF.
- The sanity layer works on breast imaging reports (BI-RADS, clock positions, sizes, left and right) and sends the person back to the imaging team.
- The ultrasound and biopsy demos are labeled as research or learning tools, never as diagnosis.
