# Model card: SecondLook ultrasound demo

**This is a research demo. It is not a medical test, and it must not be used to make health decisions.**

## What it does

It looks at one breast ultrasound image and says which of three groups the image looks most like: normal, benign (not cancer) or malignant (cancer). It also draws a highlight map of the parts of the image that pushed the score up the most.

## What we did not build

We did not invent or train the image model. Please credit the original work:

| Part | Original work | Who made it | License (as we understand it) |
|---|---|---|---|
| Image reader (backbone) | EfficientNet-B0, ImageNet weights `efficientnet_b0.ra_in1k` from the `timm` library | Architecture: Tan and Le, 2019. Library and weights: Ross Wightman and the `timm` contributors | Apache-2.0 (from the project README). We have not re-read the license text for these exact weights, so please check it before relying on it. |
| Training photos for the backbone | ImageNet | ImageNet team | Research use terms apply. We only use the finished weights. |
| Breast ultrasound images | BUSI: 780 images, 600 women aged 25 to 75, Baheya Hospital, Cairo | Al-Dhabyani, Gomaa, Khaled, Fahmy (Data in Brief, 2020) | CC BY 4.0 (from the project README, via a Hugging Face copy of the data) |
| Browser runtime | ONNX Runtime Web | Microsoft | MIT |
| Duplicate-image audit we followed | Pawłowska et al., Data in Brief, 2023 | Pawłowska and co-authors | Paper |

## What we did

- Froze the backbone and trained a small final step on top of it (logistic regression on the backbone's features). This is called a linear probe.
- Looked for copies of the same image in BUSI with a pixel hash and a similarity check, kept each group of copies on one side of every test split, and removed 22 images (9 groups) whose copies carried conflicting labels. That left 758 images.
- Tested with 5-fold cross-validation, with copies kept together. The regularization strength was chosen inside each training fold.
- Compared three backbones on the same protocol: EfficientNet-B0, ConvNeXt-Tiny and DINOv2 ViT-S/14.
- Exported to ONNX and checked that the exported model gives the same answers as the original (largest difference about 3 in a million).
- Built the in-browser inference, the highlight map, the upload checks (file type, size, color images), and the plain-language wording around the results.

The training and test code is in `training/`. The numbers below come from `training/results/busi_metrics.json`.

## Our own results

Average over 5 test rounds, plus or minus the spread between rounds.

| Measure | Result |
|---|---|
| Cancer vs not, AUC (1.0 is perfect, 0.5 is guessing) | 0.904 ± 0.014 (likely range 0.876 to 0.925) |
| Cancer images found (sensitivity) | 0.750 ± 0.080 |
| Non-cancer images cleared (specificity) | 0.877 ± 0.028 |
| Right group out of three (accuracy) | 0.777 ± 0.032 |

The three backbones scored within one spread of each other (AUC 0.904, 0.888 and 0.914), so we shipped the smallest one that supports an exact highlight map.

## Limits you should know about

1. **We cannot show that no patient appears on both sides of the test.** BUSI does not say which images belong to the same woman. Our copy check also caught only about 5% of artificially altered copies in a calibration test (`augmented_copies_caught` in the metrics file). So images from one woman may sit in both the training and test sets, and the true accuracy on new patients may be lower than the numbers above.
2. **One hospital, one country, and (we believe) one kind of machine.** We have not tested on any outside data. Other researchers report drops to about 86 to 88 percent on images from other hospitals for a different model.
3. **The app model is from the first test round**, not a model retrained on all the data.
4. **It misses about 1 in 4 cancer images** in our own test.
5. **The highlight map shows where the model looked.** It does not show where a cancer is and it does not prove one is there. We use a class activation map, which is an exact method for this kind of model, and we only show it for this model.
6. **It looks at a whole image only.** It does not measure or outline lumps.
7. **A "normal" answer never rules out cancer.**

## Not done yet

- We did not re-run the BUSI training in this session. The numbers above are the ones already stored in the repository.
- No outside test set (for example BUS-BRA or BrEaST) has been run.
- No clinician has reviewed the app or its wording.

## Where the assistant fits in

The chat assistant is separate. It is a general language model from OpenAI. We did not train or fine-tune it. See `assistant/prompt.mjs` for the instructions we gave it and `eval/` for how we test it.
