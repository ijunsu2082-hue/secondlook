# How SecondLook maps to the judging rubric

This is our own reading of the rubric. It is not a score, and we make no claims about real-world impact because we have no user data yet.

## Prototype and technical execution (10 points)

- One connected journey: paste a report, see it explained, ask questions about it, get questions for the doctor, find the right feature.
- Server-side chat function that keeps the API key off the browser, with input limits, a rate limit, and clear error states.
- Fixed safety notes and a reply guard that do not depend on the AI.
- 62 unit tests, a browser test, and 119 test conversations with every run recorded, including failures.
- An existing open-source image model, honestly credited, with our own cleanup, testing, in-browser version and interface. See `MODEL_CARD.md`.
- Honest about what is not done: no clinician review, no outside data test, chat not yet tested on the live Netlify site.

## Feasibility and potential impact (4 points)

- Runs on a plain static site plus one small function. Low cost to run.
- Most of the app works with no server at all and no data leaving the device.
- Next steps are concrete: clinician review, real de-identified reports for the parser, outside ultrasound data, more languages.
- No impact numbers are claimed.

## Pain point and problem relevance (3 points)

- The problem is the wait between a result and a doctor's explanation, and reports written for doctors.
- The app answers the exact questions people have at that point and helps them prepare for the visit.

## Alignment with the cancer and oncology category (3 points)

- Built around breast imaging reports, biopsy results and early warning signs.
- Uses BI-RADS, CDC, American Cancer Society, NHS, NICE and USPSTF sources.
- The ultrasound and biopsy demos are labeled as research or learning tools, not diagnosis.
