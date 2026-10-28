# SecondLook: breast imaging results, explained

Made for Code the Cure Hacks 2026. Live demo: https://secondlook-codethecure.netlify.app

SecondLook helps people who just got a breast imaging result. It explains the report in plain words, answers follow-up questions, and helps people get ready to talk with their doctor. It is a learning tool. It cannot tell anyone whether they have cancer.

## What is in it

| Part | What it does | How it works |
|---|---|---|
| **Read my report** | Paste a mammogram, ultrasound or biopsy report. See what the BI-RADS number means, breast density, where the finding is, and what each word means. | Fixed rules and a hand-written glossary of 72 terms. No AI. It also notices "no calcifications" style wording. |
| **Ask a question** (chat under the report) | Ask follow-up questions about the report. Ask for questions to bring to an appointment. | A language model from OpenAI, called from our server. It gets the decoded report as context. We wrote its instructions. We did not train or fine-tune it. |
| **Ultrasound AI** | A research demo. Says whether an ultrasound image looks most like normal, benign or malignant images, and shows a highlight map. | EfficientNet-B0 (made by others) with a small final step we trained. Runs in your browser. See [MODEL_CARD.md](MODEL_CARD.md). |
| **When to see a doctor** | A warning sign checklist and a screening planner. | Rules from the CDC, American Cancer Society, NHS, NICE and the U.S. Preventive Services Task Force. |
| **Biopsy lab** | A learning tool that shows how a small model reads cell measurements. | Logistic regression on the Wisconsin Diagnostic Breast Cancer data. |

## What leaves your device

- The report explainer, ultrasound demo, symptom check and biopsy lab run in your browser and send nothing out.
- The chat sends your question and your report text to our server, which sends them to OpenAI. Our server does not store them. OpenAI may keep them for a short time under its own rules. The OpenAI key lives only on the server.
- Please use made-up or anonymous text when demonstrating.

## Run it

You need Node 20 or newer. For the chat, put your key in a file named `.env` (copy `.env.example`).

```bash
node dev-server.mjs
# open http://localhost:8000
```

Without a key, everything works except the chat, which says it is not set up.

To deploy, publish the `app` folder and the `netlify/functions` folder on Netlify and set `OPENAI_API_KEY` in the site settings. On a plain static host such as GitHub Pages the chat shows a message that it is not available there.

## Test it

```bash
npm test             # unit tests, no network
node eval/run.mjs    # 119 conversations against the real assistant (uses API credit)
node tests/e2e.mjs   # browser test, needs: npm i playwright-core, and Chrome
```

See [docs/TEST_PLAN.md](docs/TEST_PLAN.md) for what has and has not been tested, and [docs/PROGRESS.md](docs/PROGRESS.md) for project status.

## Ultrasound model results

These are our own results on the public BUSI image set. They are stored in `training/results/busi_metrics.json`.

- 758 usable images after we removed 22 images whose copies had conflicting labels.
- 5-fold test with copies of the same image kept together.

| Measure (average over 5 rounds, plus or minus spread) | Result |
|---|---|
| Cancer vs not, AUC (1.0 perfect, 0.5 guessing) | 0.904 ± 0.014 (likely range 0.876 to 0.925) |
| Cancer images found | 0.750 ± 0.080 |
| Non-cancer images cleared | 0.877 ± 0.028 |
| Right group out of three | 0.777 ± 0.032 |

Many papers report 95 to 98 percent on this image set. Those numbers can be too high when copies of one image land in both the practice and test sets. BUSI does not say which images come from the same woman, so our numbers could also be too high. Read [MODEL_CARD.md](MODEL_CARD.md) for the limits.

## Biopsy lab results

569 needle samples (WDBC). Repeated 10-fold testing: logistic regression 97.9% accuracy. On the 20% we kept aside: 96.5% accuracy, 92.9% of cancers found, 98.6% of benign cases cleared. This is a learning demo, not a diagnostic tool.

## Reproduce the models

```bash
cd training
python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
python train_wdbc.py --out ../app
python train_busi.py --data /path/to/Dataset_BUSI_with_GT --out ../app --compare
```

BUSI is on Hugging Face as `gymprathap/Breast-Cancer-Ultrasound-Images-Dataset` (CC BY 4.0). We have not re-run this training in the latest session.

## Folders

```
app/            the website (plain HTML, CSS and JavaScript, no build step)
assistant/      the assistant's instructions and server logic
netlify/        the chat function
eval/           119 test conversations and the runner
tests/          unit tests and the browser test
training/       Python code that trained the small models
docs/           test plan and progress tracker
```

## Credits and licenses

- **BUSI:** Al-Dhabyani W, Gomaa M, Khaled H, Fahmy A. Dataset of breast ultrasound images. Data in Brief 28:104863 (2020). CC BY 4.0.
- **WDBC:** Wolberg WH, Street WN, Mangasarian OL. Breast Cancer Wisconsin (Diagnostic). UCI (1995). CC BY 4.0.
- **Duplicate audit:** Pawłowska A et al. Data in Brief (2023).
- **EfficientNet:** Tan M, Le Q (2019). Weights from the `timm` library, listed as Apache-2.0.
- **ONNX Runtime Web:** MIT.
- **Chat model:** OpenAI, used through its API under its terms.

## Limits

- This is a learning tool, not a medical device. Please never use it to see a doctor later than you would have.
- The ultrasound model has only seen images from one hospital. It misses about 1 in 4 cancers in our test.
- The report explainer handles common U.S. wording and can miss unusual wording.
- The chat can be wrong. No clinician has reviewed this project yet.
