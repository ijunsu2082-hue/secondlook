# How SecondLook lines up with the judging rubric

This section is just both of us evaluating the rubric:

Prototype and Technical Execution (10), Feasibility and Potential Impact (4), Pain Point and Problem Relevance (3), and Alignment with Category (3). 

## Prototype and technical execution (10 points)

**It's one connected product.** You paste a report, see it explained, ask questions about it, get questions to bring to your doctor, and find the right feature. Each logically progresses to the next one.

**The machine-learning aspect:** We checked it against `training/` and `app/models/` and the details are in `MODEL_CARD.md`.

- The breast ultrasound classifier is built on a frozen, pretrained EfficientNet-B0. The classification layer on top is ours: a logistic regression on 1,280 image features.
- We built our own data pipeline. It finds duplicates using perceptual hashes and feature similarity (312 of 780 images had a near-copy somehow). It removes 22 images whose copies had different labels. It also runs 5-fold testing where groups of copies never cross between training and testing.
- We did our own conversion to ONNX, checked against the original to 2.5 in a million. The browser version was checked against the Python reference on 6 samples, to within 0.015.
- The highlight map + limits.
- We did not train the image model from scratch and we did not fine-tune it.

**Why we mixed rules and AI.** Rules pull the findings out of the report, because that's predictable and testable. A language model explains the findings and answers questions, because that's what it's good at. A trained image classifier handles the pixels. We didn't add anything just to look more like AI.

**Safety and reliability.**

- The chat runs in a server-side function, so the API key never reaches the browser. (also more privacy)
- The chat stays locked until the person reads and accepts what gets sent to OpenAI. The server also refuses requests that skipped that step.
- We wrote fixed safety notes (urgent symptoms, "a good result is not proof", privacy) and a reply guard that blocks false reassurance and diagnosis. None of it depends on the AI too!!!
- Errors are quite clear. And failed requests never turns into a made-up answer.
- For testing we have 152 unit tests, a browser test, an interaction audit, a live smoke test, and 135 test conversations. We have recorded every run + failures and our latest live run passed 129 of 135.

**The Report's Sanity Check.** This is a fixed-rule layer in `app/js/sanity.js`. It basically checks a report for values that can't be right and for statements that disagree/contradict each other. It runs in the browser and on the server, and it has 41 tests of its own (25 adversarial cases plus fuzz). We made sure it never picks which of two statements is right and it still gives a report but heavily flags/informs the user about the issue.

**Photo and PDF reading.** You can upload a photo or PDF of a report. The text is read in your browser, and you can fix mistakes before anything is explained. If a photo was blurry, nothing gets explained until you've checked the text.

## Shorcomings

Some things we'd like you guys, the users/judges to know.

The sanity layer is heuristic and it uses fixed rules, so it can miss things, and it can't catch every contradiction. Although, we felt it was the best method for our project's goals. The two descriptions of one lesion only count as a conflict when the side, the clock position or a back-reference like "the mass" shows they're about the same lesion. Small unit slips, like 1.2 mm where 1.2 cm was meant, are missed. Clock positions written as words, like "fourteen o'clock", aren't detected too.

The ultrasound model misses about 1 in 4 cancers in our test.

As you may probably have known, no clinician has reviewed it, we haven't tested on outside ultrasound data, and we haven't checked it on an exhaustive amount of real patient reports, although a decent amount have been done (a dozen or so).

## Feasibility and potential impact (4 points)

- It runs as a plain static site plus one small function, so it's very cheap to run.
- Most of the app works with no server and sends nothing out.
- The sanity layer is plain code with no extra service, so it adds no running cost. Its real-world value is not fully tested, and we have no data on how often real reports contain these problems.
- Here are some next steps we are looking forward to (let us know if you have any ideas!): clinician review, de-identified real reports for the rule-based reader, outside ultrasound data, and more languages.
- We also don't claim any impact numbers.

## Pain point and problem relevance (3 points)

This started with David's grandma, and with the wait between getting a result and hearing a doctor explain it. Reports are written for doctors, not patients.

SecondLook answers the questions people have in that gap and helps them get ready for the visit.

There's one more thing. Reports can contain typing or copy mistakes, or two statements that disagree, and someone reading alone can't tell. The sanity layer points these out as things to ask about, without saying who is right. We haven't measured how common this is, but we felt it's a good feature to add, just in case.

## Alignment with the cancer and oncology category (3 points)

- It's built around breast imaging reports, biopsy results and early warning signs.
- It uses BI-RADS and published advice from the CDC, American Cancer Society, NHS, NICE and USPSTF.
- The sanity layer works on breast imaging reports (BI-RADS, clock positions, sizes, left and right) and sends the person back to the imaging team.
- The ultrasound and biopsy demos are labeled as research or learning tools, never as diagnosis.