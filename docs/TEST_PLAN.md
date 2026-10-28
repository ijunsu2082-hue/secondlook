# Test plan

Status values: **Run** means we ran it and the result is recorded. **Not run** means it is planned only.

| Area | What we check | How | Status | Result |
|---|---|---|---|---|
| Report explainer | BI-RADS, density, clock position, size, "not seen" words | `tests/decoder.test.mjs` | Run | Passing |
| Main journey | Open report sample, explain it, ask the chat, get a reply, clear chat, try again after an error | Browser script (`tests/e2e.mjs`), desktop 1280 wide and phone 390 wide | Run | Prior run: 95 of 97 checks. Two checks flagged console errors from an intentionally injected HTTP 502 response. |
| Every tab and key button | Tabs, samples, upload, symptom box, lab case | Same browser script | Run | Passing |
| Upload safety | Text file, over 15 MB file, broken image, real image | Same browser script | Run | Passing |
| Chat server code | Input limits, urgent words, fake OpenAI failures, empty answers, rate limit, reply guard | `tests/chat.test.mjs` (no real API calls) | Run | Passing |
| Assistant style and safety | 135 conversations in 17 groups | `node eval/run.mjs` (real API calls) | Run | See `eval/results.md`. Results vary a little between runs. |
| Readability | No dashes, no buzzwords, US spelling, short safety sentences | `tests/copy-lint.test.mjs` | Run | Passing |
| Readability by a person | A non-expert reads the screens and the replies | Ask 3 people outside the team | Not run | |
| Medical accuracy | A clinician reads the glossary, the checker rules and 30 sample replies | Needs a clinician | Not run | |
| Model results | Numbers in the app match the stored metrics file | Read from `busi_model.json` at run time | Run (by design) | |
| Model on new data | Outside ultrasound set | BUS-BRA or BrEaST | Not run | |
| Browser model matches Python | Probabilities on the 6 samples within 0.02 | Needs a script in the browser | Not run | |
| Accessibility basics | Keyboard use, labels, focus order, contrast | Manual pass | Partly run | Upload keyboard access, skip link, tab roles and focus after tab change are implemented. A complete manual pass and contrast measurements are still pending. |
| Screen reader | NVDA or VoiceOver pass | Manual | Not run | |
| Reliability | Chat fails kindly when the server is down, when the key is missing, and on a static host | Unit tests and one browser test with a fake 502 | Partly run | Not tested on the real Netlify deployment yet. |
| Privacy | Key never in the repo or the browser code | `git grep` for the key pattern, read `app/js/chat.js` | Run | No key found in tracked files |

## How to run

```bash
npm test                  # unit tests, no network, a few seconds
node dev-server.mjs       # then open http://localhost:8000
node eval/run.mjs         # live assistant evaluation, needs OPENAI_API_KEY in .env
```

## About the evaluation

- The rule checks look for style and safety slips. They do not judge medical truth.
- We fixed mistakes in our own checks after the first run (it flagged sentences like "does not mean you have cancer"). The first run is kept in `eval/results-run1-before-fixes.md`.
- The assistant gives slightly different answers each time, so we ran the full set several times and report all runs.
| Report Sanity Check | Invalid clock positions, odd sizes and units, conflicting or earlier BI-RADS, contradictory descriptions, left and right mismatches, unreadable text, original text kept, no crash on odd input | `tests/report-sanity.test.mjs`: 41 tests, including 25 adversarial cases and fuzz tests | Run | Passing. Part of the 146 passing in `npm test` |
| Server side check | The server runs the check itself and tells the assistant, with a family history line (stated, mentioned, NOT stated) | `tests/chat.test.mjs` | Run | Passing |
| Sanity warning in the browser | The warning area shows above the findings, with text labels and keyboard access | `tests/e2e.mjs` (95 of 97; the 2 are deliberate 502 console errors) and `tests/audit.mjs` | Run | Passing |
| Photo and PDF upload | Clean picture, text PDF, scanned PDF, wrong type, blurry tilted photo | `tests/ocr-check.mjs` in Chrome | Run | Clean picture and both PDFs gave the right report text and BI-RADS 4A. A wrong type was refused. A blurry tilted photo gave wrong words, was marked low confidence and was not explained until checked. No outside requests were made |
| Screen reader | The warning area read aloud | A real screen reader | Not run | Built with headings, a labeled region and text labels, but not tested |
| Sanity cases in the assistant evaluation | 16 sanity conversations among the 135 | `node eval/run.mjs` | Run | Latest live run 129 of 135. Offline rescore 131 of 135 after fixing four wrong checker patterns. See `eval/results.md` and `eval/history.md` |
| Deployed copy | The Netlify site | `tests/live-check.mjs [url]` | Not run | We did not verify the Netlify deploy |
