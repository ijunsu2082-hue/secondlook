# SecondLook

Live demo: https://secondlook-codethecure.netlify.app
Built for Code the Cure Hacks 2026 by David Lee and Ajay Sriram Sankar.

So the story starts with David's grandma. She found a lump and got diagnosed with stage III breast cancer in her 50s. When you get a report back after a scan, it's full of words nobody explains, and you're left googling "BI-RADS 4A" at 11pm. We wanted something that tells you what the words mean and what to ask your doctor next.

SecondLook is a learning tool. It can't tell anyone if they have cancer and it never tries to.

## What's in it

- **Read my report**: paste a mammogram, ultrasound or biopsy report (or simply upload a photo or PDF of it). It breaks down the BI-RADS number, breast density, where the finding is, and explains every hard/potentially confusing word. This part is just rules and a hand-written glossary, no AI, so it can't make stuff up.
- **Sanity check**: a warning box above the results if the report looks off. Stuff like "14 o'clock" (clocks stop at 12), a 35 cm mass, two different BI-RADS numbers, or left and right getting mixed up. It never decides which part is right. It just says "hey, double check your copy and paste and ask the imaging team."
- **Chat**: ask follow-up questions about your report, or get a list of questions for your appointment. This one is an OpenAI model with our own instructions and safety rules on top.
- **Ultrasound AI**: a research demo. It looks at an ultrasound and says whether it looks most like normal, benign or malignant images, and shows a heat map of where it looked.
- **When to see a doctor**: warning signs checklist and a screening planner, based on CDC, ACS, NHS, NICE and USPSTF advice.
- **Biopsy lab**: a tiny model that shows how cell measurements turn into a score.

## Why it's a mix of rules and AI

We didn't want to throw AI at everything. Pulling facts out of a report is something rules do better, because the same report always gives the same answer. Explaining things in plain words and answering follow-ups is where a language model actually helps, so that's where we use one, with guardrails. The ultrasound picture stuff needs an image model, so that's what that part uses.

## Reading photos and PDFs

Upload a photo or PDF and it reads the text right in your browser (Tesseract for photos, PDF.js for PDFs). Nothing gets uploaded anywhere. It shows you the text so you can fix mistakes, and if the photo was blurry it won't explain anything until you've checked it. Clear, straight-on photos work best. English only, first 6 pages, under 20 MB. We tried a clean picture, a text PDF, a scanned PDF and a blurry tilted photo. We haven't tried real patient photos or handwriting.

## Privacy

- Decoder, sanity check, photo reading, ultrasound demo, symptom check and biopsy lab all stay in your browser.
- The chat is the one thing that leaves. It sends your question and your report text to our server, which passes it to OpenAI. We don't store it. OpenAI has its own rules about what it keeps. You have to click "I understand" before any of that happens.
- Please only use made-up or anonymous reports when you try it.

## Run it

Needs Node 20+. For the chat, copy `.env.example` to `.env` and put your OpenAI key in it.

```bash
node dev-server.mjs
# then open http://localhost:8000
```

Even if you have no api key, everything will still work except the chat.

To deploy, publish `app` and `netlify/functions` on Netlify and set `OPENAI_API_KEY` in the site settings. On a plain static host like GitHub Pages the chat just says it isn't available.

## Tests

```bash
npm test                       # unit tests, no network
node eval/run.mjs              # 135 chat conversations against the real assistant (costs API credit so pls dont abuse. Rate limiting is in place though)
node tests/e2e.mjs             # browser test of the whole thing (needs playwright-core and Chrome)
node tests/audit.mjs           # keyboard pass, every button and link, layout
node tests/live-check.mjs      # quick check of a running copy
```

More detail in [docs/TEST_PLAN.md](docs/TEST_PLAN.md) and [docs/PROGRESS.md](docs/PROGRESS.md). So please check that out as all these md files are our main documentation/explanations.

## How the ultrasound model did

Numbers are from the public BUSI image set, saved in `training/results/busi_metrics.json`.

- 758 usable images (we dropped 22 that had copies with conflicting labels)
- 5-fold test, with copies of the same image kept together

| What | Result |
|---|---|
| Cancer vs not, AUC (1.0 perfect, 0.5 guessing) | 0.904 ± 0.014 |
| Cancer images found | 0.750 ± 0.080 |
| Non-cancer images cleared | 0.877 ± 0.028 |
| Right group out of three | 0.777 ± 0.032 |

So it misses about 1 in 4 cancers. A lot of papers report 95 to 98 percent on this dataset, but those can be inflated when copies of the same image end up in both train and test. BUSI doesn't tell you which images are from the same person, so ours could be a bit high too. Full details and limits are in [MODEL_CARD.md](MODEL_CARD.md).

**Biopsy lab:** 569 samples (WDBC). 96.5% accuracy on the 20% we held out, 92.9% of cancers found, 98.6% of benign cleared. But this is a learning demo, not a diagnosis tool.

## Retrain the models

```bash
cd training
python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
python train_wdbc.py --out ../app
python train_busi.py --data /path/to/Dataset_BUSI_with_GT --out ../app --compare
```

BUSI is on Hugging Face as `gymprathap/Breast-Cancer-Ultrasound-Images-Dataset` (CC BY 4.0). note: We haven't re-run this training since the last round of changes.

## Folders

```
app/         the website (plain HTML, CSS, JS, no build step)
assistant/   chat instructions and server logic
netlify/     the chat function
eval/        135 test conversations and the runner
tests/       unit tests and browser tests
training/    Python code for the small models
docs/        test plan, progress, deploy notes
```

## Where our AI came from

- The **chat** is an OpenAI model. We wrote the instructions and the safety code around it. We didn't train or fine-tune it.
- The **ultrasound model** is a pretrained EfficientNet-B0 that we froze, with our own small classifier trained on top of it.
- We also used an AI coding assistant (Claude) while building this, but only for checking code, a little test writing/fixes and formatting some of these large tables you may see in these docs, although we did type them out and Claude only did formatting of tables that we told it to do.

## Credits

- BUSI: Al-Dhabyani W, Gomaa M, Khaled H, Fahmy A. Dataset of breast ultrasound images. Data in Brief 28:104863 (2020). CC BY 4.0.
- WDBC: Wolberg WH, Street WN, Mangasarian OL. Breast Cancer Wisconsin (Diagnostic). UCI (1995). CC BY 4.0.
- Duplicate audit: Pawłowska A et al. Data in Brief (2023).
- EfficientNet: Tan M, Le Q (2019), weights from `timm` (Apache-2.0).
- ONNX Runtime Web (MIT), Tesseract.js and its English data (Apache-2.0), PDF.js (Apache-2.0). Licenses are in `app/vendor`.

[RESEARCH.md](RESEARCH.md) is our early notes (not part of the app, and the numbers weren't rechecked). [MODEL_CARD.md](MODEL_CARD.md) is the one to trust for the ultrasound model.

## Limitations

- It's a learning tool, not a medical device. Please don't use it to wait longer to see a doctor.
- The ultrasound model has only seen one hospital's images and misses about 1 in 4 cancers in our test.
- The report reader knows common U.S. wording and can miss unusual stuff.
- The sanity check is fixed rules, so it will miss some problems. Its warnings are not a diagnosis.
- The chat can be wrong, and no doctor has reviewed this project yet.