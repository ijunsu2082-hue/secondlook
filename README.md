# SecondLook — breast imaging, explained

**CodeTheCure Hacks 2026 · Category A: Detection & Diagnosis** · **Live demo: https://secondlook-codethecure.netlify.app**

SecondLook helps people understand breast imaging results and act on them early. It runs entirely in the browser, so no image or report ever leaves the device.

| Feature | What it does | How |
|---|---|---|
| **Read my report** | Paste a mammogram or ultrasound report. You get the BI-RADS category on a risk-of-cancer scale, breast density (A–D) as a picture, the finding drawn on a clock-face breast diagram, every medical term explained, and questions to ask your doctor. | Deterministic parser plus a glossary of 72 terms built from the ACR BI-RADS Atlas and ACS. Detects negation ("no calcifications"). No text is generated. |
| **Ultrasound AI** | Sorts a breast ultrasound into normal, benign or malignant and highlights the region that drove the answer. | EfficientNet-B0 linear probe exported to ONNX, running in the browser (≈0.2 s per image), with an exact Class Activation Map. |
| **When to see a doctor** | A warning-sign checklist (including the signs of inflammatory breast cancer) and a screening planner that takes age, sex, family history, BRCA status and chest radiation. | Rules from the CDC, ACS, NHS, NICE NG12, USPSTF 2024 (breast screening) and USPSTF 2019 (BRCA). |
| **Biopsy lab** | Shows how a model reads the cell measurements from a needle biopsy (FNA). Includes what-if sliders and an exact explanation of each feature's contribution. | Logistic regression on the Wisconsin Diagnostic Breast Cancer dataset. |

## Results

### Ultrasound AI

**Data.** BUSI (Al-Dhabyani et al., 2020): 780 images from 600 women.

**Cleaning.**
- A published audit (Pawłowska et al., 2023) found duplicates in BUSI, including images filed as both benign and malignant.
- We find near-duplicates two ways: a pixel hash and deep-feature cosine similarity.
- We remove **22 images in 9 groups whose copies carry conflicting labels**, leaving 758 images.
- We keep every duplicate group on one side of each split.

**Protocol.** 5-fold stratified, duplicate-grouped cross-validation. The regularisation strength is chosen by an inner grouped cross-validation, so the test fold is never seen.

| Metric (mean ± SD over 5 folds) | Value |
|---|---|
| Malignant vs not, AUC | **0.904 ± 0.014** (pooled 95% CI 0.876–0.925) |
| Malignant sensitivity / specificity | 0.750 ± 0.080 / 0.877 ± 0.028 |
| 3-class macro AUC | 0.917 ± 0.016 |
| 3-class accuracy | 0.777 ± 0.032 |

**Backbone comparison** (same protocol, malignant AUC):

| Backbone | Malignant AUC |
|---|---|
| EfficientNet-B0 | 0.904 |
| ConvNeXt-Tiny | 0.888 |
| DINOv2 ViT-S/14 | 0.914 |

All three are within one standard deviation of each other. We ship EfficientNet-B0 because it is 4× smaller than DINOv2 (16 MB) and supports exact CAM.

These numbers are honestly lower than the 95–98% many BUSI papers report. Those papers often let duplicates cross the train/test split, and models tested on other hospitals' data fall to about 86–88%. Our result matches the clean BreastMNIST benchmark (ResNet-18 AUC 0.901).

### Biopsy lab

**Data.** WDBC: 569 fine-needle aspirates.

**Protocol.** 5 × repeated stratified 10-fold cross-validation.

| Model | Accuracy | AUC |
|---|---|---|
| **Logistic regression (deployed)** | **97.9%** | **0.995** |
| SVM (RBF) | 98.1% | 0.996 |
| Random forest | 96.0% | 0.991 |
| Gradient boosting | 96.2% | 0.992 |

**Deployed model on the held-out 20%:** 96.5% accuracy, AUC 0.996, sensitivity 92.9%, specificity 98.6%.

## Run it

```bash
cd app
python3 -m http.server 8000
# open http://localhost:8000
```

Any static file server works, and so does any static host such as GitHub Pages or Netlify. ONNX Runtime Web 1.20.1 is bundled in `app/vendor/ort`, so the app works offline.

## Reproduce the models

```bash
cd training
python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
python train_wdbc.py --out ../app                       # seconds; data ships with scikit-learn
python train_busi.py --data /path/to/Dataset_BUSI_with_GT --out ../app --compare   # ~10 min on an M1
```

BUSI can be downloaded without a login from the Hugging Face mirror `gymprathap/Breast-Cancer-Ultrasound-Images-Dataset` (CC BY 4.0). Results are written to `training/results/`, and the logs are kept there.

## Architecture

```
app/
  index.html, styles.css      single-page app, 5 tabs, no framework, no build step
  js/report.js + knowledge.js BI-RADS / density / clock-face parser, 72-term glossary, sources
  js/scan.js + ml.js          ONNX Runtime Web inference, CAM rendering, colour sanity check
  js/check.js                 symptom + screening + family-history rules
  js/lab.js                   WDBC logistic regression with exact per-feature contributions
  models/                     busi_effnet_b0.onnx (16 MB), busi_model.json, wdbc_model.json
  samples/                    6 held-out BUSI test images (never seen in training)
training/                     Python: data cleaning, CV, ONNX export with parity check
```

## Data and licences

- **BUSI:** Al-Dhabyani W, Gomaa M, Khaled H, Fahmy A. *Dataset of breast ultrasound images.* Data in Brief 28:104863 (2020). doi:10.1016/j.dib.2019.104863. CC BY 4.0.
- **WDBC:** Wolberg WH, Street WN, Mangasarian OL. *Breast Cancer Wisconsin (Diagnostic).* UCI ML Repository (1995). doi:10.24432/C5DW2B. CC BY 4.0.
- **Duplicate audit:** Pawłowska A et al. Data in Brief (2023). PMC10293973.
- **ONNX Runtime Web:** MIT licence. **timm / EfficientNet-B0 weights:** Apache-2.0.

## Background research

[RESEARCH.md](RESEARCH.md) is our research report on which AI models detect and diagnose cancer best (clinical trials, pathology foundation models, radiology AI, blood tests), with every figure checked against its source. It also reports our own experiments for both of our projects.

## Limitations

- SecondLook is an educational prototype, not a medical device. It must never be used to decide to see a doctor *less*.
- The ultrasound model was trained on one hospital's images from one country, so performance on other machines will be lower. It classifies whole images and does not locate lesions for clinical use.
- The report parser handles common U.S. report wording. The original report and the radiologist's advice always come first.
