# Progress/our build journal

This is where we (David Lee and Ajay Sriram Sankar) keep track of how SecondLook is going. 

 **Complete** means built and checked it, **Partial** means built but it needs more work or more checking, amd **Not started** is exactly what it means. Also **Blocked** means we are waiting on something from someone else.

Our priority labelling is as follows:  P1 must have, P2 should have, P3 nice to have.

Below is our original plan's bullets (we had 7 sections)

Currently we have 50 tasks, 28 complete, 12 partial, 8 not started, 2 blocked. The Rows 43 to 50 is from when we added the Report Sanity Check layer and photo and PDF upload later on. Thats why our earlier header said 49, so we recounted just now and it's 50, which is accurate.

## The latest statistics

Everything here is from runs we did ourselves in this stretch of the build.

- **Unit tests:** `npm test` gives 152 passing and 0 failing. 41 of those are in `tests/report-sanity.test.mjs` (25 adversarial cases plus fuzz tests).
- **Browser test** (`tests/e2e.mjs`, desktop at 1280 wide and phone is at 390): 95/97 checks pass. The 2 that don't pass seem to be the browser logging the 502 error we inject on purpose to test the error screen. So they are expected, not actually real bugs.
- **Assistant evaluation** (`gpt-4o-mini`): the set grew from 119 to 135 conversations when we added the 16 sanity-check cases (fake/imposible info). Our latest live run passed 129 of 135. We then fixed four wrong checker patterns, and rescoring the saved replies offline gave 131 of 135. The leftover failures move around between runs (different cases fail each time), which tells us it's run-to-run wobble. Our very first run scored 77 of 119, and every run is in `eval/history.md`.
- **Photo and PDF upload:** tested on 4 kinds of file (a clean picture, a text PDF, a scanned PDF and a blurry tilted photo), plus a wrong file type that doesnt go through/gets refused.

Here are some of our failures from the latest full run. These change each time but we felt it is good to document. 

- emo-07: the reply didn't use words like "step by step" or "together". Quite a narrow pattern, not really a safety issue.
- emo-08 and next-02: the reply didn't point back to the care team or state a limit.
- terms-01: the reply explained "spiculated" without the words "lines", "star" or "edge". Again, our pattern is narrow.
- The earlier "your report says" and "ultrasound is research only" failures are fixed.

## What it is still missing.

We are aware that however much we have done our research, no real clinician has reviewed any of this yet. We also haven't done a screen reader pass where visual impairment may be common in older individuals which is our target audience.

## Our task list

| # | Task | Priority | Status | How we know | What's next |
|---|---|---|---|---|---|
| 1 | App builds and runs locally | P1 | Complete | `node dev-server.mjs` serves the app and the browser test passes | Nothing |
| 2 | Chat function, input limits, rate limit, key kept on the server | P1 | Complete | `netlify/functions/chat.mjs` and `assistant/core.mjs`, 20 unit tests, and live replies through the dev server | Nothing |
| 3 | Chat screen: suggestions, loading, errors, retry, clear | P1 | Complete | Browser test covers reply, error state, retry and clear on desktop and phone | Nothing |
| 4 | Decoded report passed to chat as context, plus appointment questions | P1 | Complete | Browser test shows suggestions change with the report and replies refer to it | Nothing |
| 5 | Links between features | P1 | Partial | Chat replies link to other features (unit tested), and the report summary links to the symptom check | Add a link to the ultrasound demo from the decoder when it's an ultrasound report |
| 6 | Fixed safety notes: urgent symptoms, new lump, "good result means no cancer", privacy | P1 | Complete | Unit tests, and all 10 urgent conversations pass in every run | A clinician should probably read the wording |
| 7 | Reply guard: retry once, then fail safe on false reassurance or diagnosis | P1 | Complete | Unit tests. It caught a real "nothing to worry about" | Nothing |
| 9 | Assistant instructions (`assistant/prompt.mjs`) | P1 | Complete | 115 to 116 of 119 passed in the last three full runs on the older set. We fixed a mix-up from rehearsal where it said "Your report says" about things the report doesn't say | Only touch it for a real safety problem |
| 10 | Few-shot examples in the prompt | P2 | Partial | 4 examples are in the prompt | Add 2 more if we have time |
| 11 | Test conversations in groups | P1 | Complete | 135 conversations now (we started with 119) in `eval/conversations.jsonl`, checked by `tests/eval-dataset.test.mjs` | Nothing |
| 12 | Evaluation runner, checker, history | P1 | Complete | `eval/run.mjs`, `checks.mjs`, `rescore.mjs` and `history.md`. We kept the first run | Nothing |
| 13 | Resolve remaining evaluation failures | P2 | Partial | The leftovers vary by run: emo-07, emo-08, next-02, terms-01. Two of these are limits in our own regex | Optional |
| 14 | Clinician reads glossary, checker rules and 30 replies | P1 | Not started | This needs a real person with training | Ask one clinician before the demo |
| 15 | Plain-English rewrite of the app text | P1 | Complete | All 8 app files rewritten, copy lint passes, 0 dashes in app files | Nothing |
| 16 | Plain-English rewrite of README, SUBMISSION, MODEL_CARD, docs | P2 | Partial | README, SUBMISSION, MODEL_CARD, PROGRESS and TEST_PLAN are rewritten | `RESEARCH.md` still has 10 dashes and an old tone. Rewrite it or drop it from the submission |
| 17 | Automated copy rules (dashes, buzzwords, spelling, claims) | P1 | Complete | `tests/copy-lint.test.mjs`, 40 checks | Nothing |
| 18 | Non-expert readability check | P2 | Not started | Nobody outside the team has read it yet | Ask 3 people to read 5 screens and 5 replies |
| 19 | Upload safety: wrong type, too big, broken file, color image | P1 | Complete | Browser test | Nothing |
| 20 | Error messages when data fails to load | P1 | Complete | Lab, About and Scan all show a message | Nothing |
| 21 | Keyboard and focus: skip link, focus and title on tab change, Esc closes popups, upload box reachable | P2 | Partial | It's built and the page still passes the browser test | Do a manual keyboard-only pass and a screen reader pass |
| 22 | Phone layout and tap targets | P2 | Partial | No sideways scrolling at 390 wide, and we added 44 px targets | Look at every tab on a real phone |
| 23 | Color contrast check | P3 | Not started | Haven't measured it | Run a contrast checker |
| 24 | Model card with sources, licenses, what is ours | P1 | Partial | `MODEL_CARD.md` is written from repo data | Re-read the timm weight license text and confirm |
| 25 | Duplicate-image check is weak (5% of altered copies caught) | P2 | Partial | We say so in the model card and in the app | Re-run training with a stronger check if we can get the data |
| 26 | Re-run BUSI training and evaluation | P3 | Not started | The numbers come from the stored metrics file | Optional |
| 27 | Test on an outside ultrasound set | P3 | Not started | Needs a download | Optional |
| 28 | Browser model matches Python reference on the 6 samples | P3 | Not started | Not written yet | Add it to the browser test |
| 29 | Honest highlight-map wording | P1 | Complete | Scan screen text | Nothing |
| 30 | Guard for images that are not ultrasounds | P2 | Complete | The result is held back unless the user asks for it | Nothing |
| 31 | Unit tests | P1 | Complete | 152 passing | Nothing |
| 32 | Browser test in the repo | P1 | Complete | `tests/e2e.mjs`, 95 of 97, and the 2 are the expected 502 console messages explained above | Nothing |
| 33 | Test plan | P1 | Complete | `docs/TEST_PLAN.md` | Update it as we add tests |
| 34 | Privacy disclosure in the app and docs | P1 | Complete | Report tab, chat panel, footer, About page and README | Nothing |
| 35 | Behavior on a static host such as GitHub Pages | P2 | Partial | Chat says it isn't available on 404, 405 and 501 | Test on the real Pages site |
| 36 | Rubric mapping | P2 | Complete | `docs/RUBRIC.md` | Nothing |
| 37 | Demo script and rehearsal | P1 | Partial | We rehearsed the full demo path on the local server, including the failed-API case, and captured screens | Run it once on the deployed site |
| 38 | Rotate the OpenAI key that was pasted into the chat | P1 | Blocked | Needs the key owner | Owner rotates it before deploying (step 1 in docs/DEPLOY.md) |
| 39 | Fine-tuning a model | P3 | Not started | We decided not to, and we don't claim it anywhere | Nothing |
| 40 | Check the study numbers on the About page (MASAI, PRAIM, Lunit and others) | P2 | Complete | We checked MASAI, PRAIM, Lunit, Mirai, Clairity and the home page statistics against sources. We removed the unverified FDA claim for Lunit and the 105,934 figure, and replaced two links | Nothing |
| 41 | Commit the work to Git | P2 | Complete | Committed to the local `development` branch. Not pushed | Push when we're ready |
| 42 | Smoke test for a live URL | P1 | Complete | `tests/live-check.mjs`, 13 of 13 checks pass locally | Run it on the Netlify URL |
| 43 | Report Sanity Check layer (`app/js/sanity.js`): fixed rules for invalid clock positions, implausible sizes and units, conflicting or earlier BI-RADS, contradictory descriptions of one lesion, left and right mismatches, unreadable text | P1 | Complete | 41 tests in `tests/report-sanity.test.mjs` (25 adversarial cases plus fuzz), all passing | It's a rules check only. Limits are in MODEL_CARD.md |
| 44 | Warning area above the decoded findings (`app/js/report.js`) with three labels: Needs checking, Possible conflict, Could not interpret | P1 | Complete | Browser test. Labels are text, and it's built for keyboard and screen reader use | We haven't tried it with a real screen reader |
| 45 | Never choose which conflicting statement is right. Keep the original text and every extracted value. For impossible values, still show the full report and say to double check the copy and paste and ask the imaging team | P1 | Complete | Unit tests for each rule | Nothing |
| 46 | Server runs the check itself and gives the assistant an AUTOMATIC CHECK block and a family history line (stated, mentioned or NOT stated). Appointment questions no longer assume a family history | P1 | Complete | `assistant/core.mjs`, chat unit tests, new eval cases | Nothing |
| 47 | 16 new sanity conversations in the evaluation set (135 total), and four wrong checker patterns fixed | P1 | Partial | Latest live run 129 of 135, offline rescore 131 of 135 | The failures change from run to run. Optional |
| 48 | Known gaps in the sanity layer | P2 | Partial | It can't catch every contradiction. Descriptor conflicts need a side, a clock position or a back-reference to match. Small unit slips are missed. Word-form clocks such as "fourteen o'clock" aren't detected | Add rules only if real reports show a need |
| 49 | Screen reader pass for the new warning area | P2 | Not started | `tests/audit.mjs` covers the keyboard paths, but nobody has done a manual screen reader test | Do a pass with a real screen reader |
| 50 | Photo and PDF upload on the report tab: PDF text is copied, photos and scanned PDFs are read on the device with Tesseract.js, the text is shown for checking, and low-confidence reads wait for the person to check | P1 | Complete | `tests/ocr-check.mjs` on a clean picture, a text PDF, a scanned PDF, a wrong file type and a blurry tilted photo. No requests left the site. The blurry photo gave wrong text and was held for review | Try more real-looking photos. English only |


PS, we Gave a summary of each of these and told claude to format it nicely, that is why the wording may be a bit weird but it is our own thoughts. We are also unsure of why it skipped a number earlier on.