# Progress tracker

Statuses: **Complete** = built and checked. **Partial** = built but needs more work or checking. **Not started**. **Blocked** = needs something from someone else.
Priority: P1 must have, P2 should have, P3 nice to have.

Note on the count: the approved plan had 7 sections and no numbered list. The rows below are the plan's bullets, merged where they overlapped.

**49 tasks: 28 complete, 12 partial, 7 not started, 2 blocked.** Rows 43 to 49 were added for the Report Sanity Check layer. The older rows were not all re-counted.

## Latest numbers (all from runs in this session)

- Unit tests: `npm test` gives 146 passing, 0 failing. `tests/report-sanity.test.mjs` holds 41 of them (25 adversarial cases plus fuzz tests).
- Browser test (`tests/e2e.mjs`, desktop 1280 and phone 390): 95 of 97 checks pass. The 2 "failures" are the browser logging the 502 error we inject on purpose to test the error state.
- Assistant evaluation, `gpt-4o-mini`: the set grew from 119 to 135 conversations (16 new report sanity cases). The latest live run passed 129 of 135. After we fixed four wrong checker patterns, rescoring the saved replies offline gave 131 of 135. The remaining failures are run-to-run variation (the failing cases changed between runs). The very first run scored 77 of 119. Every run is in `eval/history.md`.
- Remaining evaluation failures in the latest full run (they change from run to run):
  - emo-07: reply did not use words like "step by step" or "together". Our pattern is narrow. Not a safety issue.
  - emo-08, next-02: reply did not point back to the care team or state a limit.
  - terms-01: reply explained "spiculated" without the words "lines", "star" or "edge". Our pattern is narrow.
  - The earlier "your report says" and "ultrasound is research only" failures are fixed.

| # | Task | Priority | Status | Evidence | Next action |
|---|---|---|---|---|---|
| 1 | App builds and runs locally | P1 | Complete | `node dev-server.mjs` serves the app, browser test passes | None |
| 2 | Chat function, input limits, rate limit, key kept on the server | P1 | Complete | `netlify/functions/chat.mjs`, `assistant/core.mjs`, 20 unit tests, live replies through the dev server | None |
| 3 | Chat working on the real Netlify deployment | P1 | Blocked | Not deployed from here (no Netlify access). `docs/DEPLOY.md` and `tests/live-check.mjs` are ready; the smoke test passes on the local server | Owner: follow docs/DEPLOY.md |
| 4 | Chat screen: suggestions, loading, errors, retry, clear | P1 | Complete | Browser test (reply, error state, retry, clear) on desktop and phone | None |
| 5 | Decoded report passed to chat as context; appointment questions | P1 | Complete | Browser test: suggestions change with the report; replies refer to it | None |
| 6 | Links between features | P1 | Partial | Rule-based links in chat replies (unit tested), link to the symptom check from the report summary | Add a link to the ultrasound demo from the decoder for ultrasound reports |
| 7 | Fixed safety notes: urgent symptoms, new lump, "good result means no cancer", privacy | P1 | Complete | Unit tests, 10 of 10 urgent conversations pass in every run | A clinician should read the wording |
| 8 | Reply guard: retry once, then fail safe on false reassurance or diagnosis | P1 | Complete | Unit tests; it caught a real "nothing to worry about" | None |
| 9 | Assistant instructions (`assistant/prompt.mjs`) | P1 | Complete | 115 to 116 of 119 pass in the last three full runs. Fixed a misattribution found in rehearsal ("Your report says" for things the report does not say) | Only change it for a real safety problem |
| 10 | Few-shot examples in the prompt | P2 | Partial | 4 examples in the prompt | Add 2 more if time |
| 11 | 119 test conversations in 15 groups | P1 | Complete | `eval/conversations.jsonl`, `tests/eval-dataset.test.mjs` | None |
| 12 | Evaluation runner, checker, history | P1 | Complete | `eval/run.mjs`, `checks.mjs`, `rescore.mjs`, `history.md`, first run kept | None |
| 13 | Resolve remaining evaluation failures | P2 | Partial | Remaining failures vary run to run: emo-07, emo-08, next-02, terms-01 (two of these are our own regex limits) | Optional |
| 14 | Clinician reads glossary, checker rules and 30 replies | P1 | Not started | Needs a person | Ask one clinician before the demo |
| 15 | Plain-English rewrite of the app text | P1 | Complete | All 8 app files rewritten, copy lint passes, 0 dashes in app files | None |
| 16 | Plain-English rewrite of README, SUBMISSION, MODEL_CARD, docs | P2 | Partial | README, SUBMISSION, MODEL_CARD, TEST_PLAN rewritten | `RESEARCH.md` still has 10 dashes and an old tone. Rewrite or drop it from the submission |
| 17 | Automated copy rules (dashes, buzzwords, spelling, claims) | P1 | Complete | `tests/copy-lint.test.mjs`, 40 checks | None |
| 18 | Non-expert readability check | P2 | Not started | | Ask 3 people to read 5 screens and 5 replies |
| 19 | Upload safety: wrong type, too big, broken file, color image | P1 | Complete | Browser test | None |
| 20 | Error messages when data fails to load | P1 | Complete | Lab, About, Scan show messages | None |
| 21 | Keyboard and focus: skip link, focus and title on tab change, Esc closes popups, upload box reachable | P2 | Partial | Built, and the page still passes the browser test | Do a manual keyboard-only pass and a screen reader pass |
| 22 | Phone layout and tap targets | P2 | Partial | No sideways scrolling at 390 wide, 44 px targets added | Look at every tab on a real phone |
| 23 | Color contrast check | P3 | Not started | | Run a contrast checker |
| 24 | Model card with sources, licenses, what is ours | P1 | Partial | `MODEL_CARD.md` written from repo data | Re-read the timm weight license text and confirm |
| 25 | Duplicate-image check is weak (5% of altered copies caught) | P2 | Partial | Disclosed in the model card and in the app | Re-run training with a stronger check if the data is available |
| 26 | Re-run BUSI training and evaluation | P3 | Not started | Numbers come from the stored metrics file | Optional |
| 27 | Test on an outside ultrasound set | P3 | Not started | | Optional, needs a download |
| 28 | Browser model matches Python reference on the 6 samples | P3 | Not started | | Add to the browser test |
| 29 | Honest highlight-map wording | P1 | Complete | Scan screen text | None |
| 30 | Guard for images that are not ultrasounds | P2 | Complete | Result held back unless the user asks | None |
| 31 | Unit tests | P1 | Complete | 62 passing | None |
| 32 | Browser test in the repo | P1 | Complete | `tests/e2e.mjs`, 50 of 52 as explained above | None |
| 33 | Test plan | P1 | Complete | `docs/TEST_PLAN.md` | Update as tests are added |
| 34 | Privacy disclosure in the app and docs | P1 | Complete | Report tab, chat panel, footer, About page, README | None |
| 35 | Behavior on a static host such as GitHub Pages | P2 | Partial | Chat says it is not available on 404, 405 and 501 | Test on the real Pages site |
| 36 | Rubric mapping | P2 | Complete | `docs/RUBRIC.md` | None |
| 37 | Demo script and rehearsal | P1 | Partial | Full demo path rehearsed on the local server, including the failed-API case. Screens captured. | Run it once on the deployed site |
| 38 | Rotate the OpenAI key that was pasted into the chat | P1 | Blocked | Needs the key owner | Owner: rotate before deploying (step 1 in docs/DEPLOY.md) |
| 39 | Fine-tuning a model | P3 | Not started | Decided not to; nothing is claimed | None |
| 40 | Check the study numbers on the About page (MASAI, PRAIM, Lunit and others) | P2 | Complete | Checked MASAI, PRAIM, Lunit, Mirai, Clairity, and the home page statistics against sources. Removed the unverified FDA claim for Lunit and the 105,934 figure. Replaced two links. | None |
| 41 | Commit the work to Git | P2 | Complete | Committed to the local `development` branch. Not pushed. | Push when you are ready |
| 42 | Smoke test for a live URL | P1 | Complete | `tests/live-check.mjs`, 13 of 13 checks pass locally | Run it on the Netlify URL |
| 43 | Report Sanity Check layer (`app/js/sanity.js`): pure fixed rules for invalid clock positions, implausible sizes and units, conflicting or earlier BI-RADS, contradictory descriptions of one lesion, left and right mismatches, unreadable text | P1 | Complete | 41 tests in `tests/report-sanity.test.mjs` (25 adversarial cases plus fuzz), all passing | Heuristic only. See the limits in MODEL_CARD.md |
| 44 | Warning area above the decoded findings (`app/js/report.js`) with three labels: Needs checking, Possible conflict, Could not interpret | P1 | Complete | Browser test. Text labels, built for keyboard and screen reader use | Not tested with a real screen reader |
| 45 | Never choose which conflicting statement is right; keep the original text and every extracted value; for impossible values still show the full report and say to double check the copy and paste and ask the imaging team | P1 | Complete | Unit tests for each rule | None |
| 46 | Server runs the check itself and gives the assistant an AUTOMATIC CHECK block and a family history line (stated, mentioned or NOT stated); appointment questions no longer assume a family history | P1 | Complete | `assistant/core.mjs`, chat unit tests, new eval cases | None |
| 47 | 16 new sanity conversations in the evaluation set (135 total), and four wrong checker patterns fixed | P1 | Partial | Latest live run 129 of 135, offline rescore 131 of 135 | Remaining failures change from run to run. Optional |
| 48 | Known gaps in the sanity layer | P2 | Partial | Cannot catch every contradiction. Descriptor conflicts need side, clock or a back-reference to match. Small unit slips are missed. Word-form clocks such as "fourteen o'clock" are not detected | Add rules only if real reports show a need |
| 49 | Screen reader pass for the new warning area | P2 | Not started | Keyboard paths are covered by `tests/audit.mjs`. No manual screen reader test | Do a pass with a real screen reader |
