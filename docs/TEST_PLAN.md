# Test plan, how we check SecondLook

This is our running list of what we test and how it went. We (David Lee and I, Ajay Sriram Sankar) wrote it so we don't fool ourselves about what's actually been checked. If we haven't run something, it says Not run, and we haven't filled in a result we don't have.

Status values: **Run** means we ran it and the result is recorded. **Partly run** means some of it is done. **Not run** means it's only planned.

## What we've covered so far

Most of the code-level stuff is in good shape. The unit tests give 152 passing, and the browser test passes 95 of 97 checks. The 2 that don't pass are the expected 502 console messages, because we make the chat server fail on purpose to see the error screen. The gaps are mostly things that need other people or other setups: a clinician, a real screen reader, outside readers and the live Netlify site.

| Area | What we check | How | Status | Result |
|---|---|---|---|---|
| Report explainer | BI-RADS, density, clock position, size, "not seen" words | `tests/decoder.test.mjs` | Run | Passing |
| Main journey | Open a report sample, explain it, ask the chat, get a reply, clear the chat, try again after an error | Browser script (`tests/e2e.mjs`), desktop 1280 wide and phone 390 wide | Run | 95 of 97 pass. The 2 are the expected 502 console messages. See PROGRESS.md |
| Every tab and key button | Tabs, samples, upload, symptom box, lab case | Same browser script | Run | Passing |
| Upload safety | Text file, over 15 MB file, broken image, real image | Same browser script | Run | Passing |
| Chat server code | Input limits, urgent words, fake OpenAI failures, empty answers, rate limit, reply guard | `tests/chat.test.mjs` (no real API calls) | Run | Passing |
| Assistant style and safety | 135 conversations in 17 groups | `node eval/run.mjs` (real API calls) | Run | See `eval/results.md`. Results vary a little between runs |
| Readability | No dashes, no buzzwords, US spelling, short safety sentences | `tests/copy-lint.test.mjs` | Run | Passing |
| Readability by a person | A non-expert reads the screens and the replies | Ask 3 people outside the team | Not run | Nobody outside the team has read it yet |
| Medical accuracy | A clinician reads the glossary, the checker rules and 30 sample replies | Needs a clinician | Not run | No clinician has reviewed it |
| Model results | Numbers in the app match the stored metrics file | Read from `busi_model.json` at run time | Run (by design) | The app reads the file itself, so there's nothing separate to compare |
| Model on new data | Outside ultrasound set | BUS-BRA or BrEaST | Not run | |
| Browser model matches Python | Probabilities on the 6 samples within 0.02 | Needs a script in the browser | Not run | |
| Accessibility basics | Keyboard use, labels, focus order, contrast | Manual pass | Partly run | The upload box is reachable by keyboard. The skip link, tab roles and focus after a tab change are not done. Contrast not measured |
| Reliability | Chat fails kindly when the server is down, when the key is missing, and on a static host | Unit tests and one browser test with a fake 502 | Partly run | Not tested on the real Netlify deployment yet |
| Privacy | Key never in the repo or the browser code | `git grep` for the key pattern, read `app/js/chat.js` | Run | No key found in tracked files |

## The newer pieces

These came later, when we added the sanity check and photo and PDF upload.

| Area | What we check | How | Status | Result |
|---|---|---|---|---|
| Report Sanity Check | Invalid clock positions, odd sizes and units, conflicting or earlier BI-RADS, contradictory descriptions, left and right mismatches, unreadable text, original text kept, no crash on odd input | `tests/report-sanity.test.mjs`: 41 tests, including 25 adversarial cases and fuzz tests | Run | Passing. Part of the 152 passing in `npm test` |
| Server side check | The server runs the check itself and tells the assistant, with a family history line (stated, mentioned, NOT stated) | `tests/chat.test.mjs` | Run | Passing |
| Sanity warning in the browser | The warning area shows above the findings, with text labels and keyboard access | `tests/e2e.mjs` (95 of 97, and the 2 are deliberate 502 console errors) and `tests/audit.mjs` | Run | Passing |
| Photo and PDF upload | Clean picture, text PDF, scanned PDF, wrong type, blurry tilted photo (4 kinds of file, plus the wrong type) | `tests/ocr-check.mjs` in Chrome | Run | The clean picture and both PDFs gave the right report text and BI-RADS 4A. The wrong type was refused. The blurry tilted photo gave wrong words, was marked low confidence and wasn't explained until checked. No outside requests were made |
| Screen reader | The warning area read aloud | A real screen reader | Not run | It's built with headings, a labeled region and text labels, but not tested |
| Sanity cases in the assistant evaluation | 16 sanity conversations among the 135 | `node eval/run.mjs` | Run | Latest live run 129 of 135. Offline rescore 131 of 135 after we fixed four wrong checker patterns. See `eval/results.md` and `eval/history.md` |
| Deployed copy | The Netlify site | `tests/live-check.mjs [url]` | Not run | We did not verify the Netlify deploy |

## How to run it all

```bash
npm test                  # unit tests, no network & just takes a few seconds
node dev-server.mjs       # then open http://localhost:8000
node eval/run.mjs         # live assistant evaluation. YOU NEED OPENAI_API_KEY in .env
```

## A few notes on the evaluation

- The rule checks look for style and safety slips, they don't judge whether the medicine is true.
- We fixed mistakes in our own checks after the first run, because it flagged harmless sentences like "does not mean you have cancer". The first run is kept in `eval/results-run1-before-fixes.md` if you want to see.
- The assistant gives slightly different answers each time, so we ran the full set several times and reported all the runs.
