# Model card: SecondLook ultrasound demo

**This is a research demo. It is not a medical test, and it must not be used to make health decisions.**

## What it does

It looks at one breast ultrasound image and says which of three groups the image looks most like: normal, benign (not cancer) or malignant (cancer). It also draws a highlight map of the parts of the image that pushed the score up the most.

## What our team built

In one sentence: our team built a breast ultrasound classifier on top of a pretrained EfficientNet-B0 image model, with our own trained classification layer, our own data cleanup and testing pipeline, and our own conversion so it runs in the browser.

Everything below was checked against `training/train_busi.py`, `training/common.py`, the saved log in `training/results/` and the files in `app/models/`.

1. **Data preparation.** We load 780 BUSI images (133 normal, 437 benign, 210 malignant) and leave out the mask images. Each image is shrunk to at most 288 pixels on its long side, then stretched to 224 by 224 for the model.
2. **Duplicate and conflicting-label handling.** We look for copies of the same picture in two ways: a perceptual hash (a short fingerprint of the picture), and the similarity of the model's image features. This found 65 hash pairs and 207 feature pairs, which join into 608 groups. 312 images have at least one near-copy. We remove the 9 groups (22 images) whose copies carry different labels, which leaves 758 images (129 normal, 426 benign, 203 malignant).
3. **The pretrained part (frozen).** EfficientNet-B0 with ImageNet weights (`efficientnet_b0.ra_in1k`). We did not change a single weight and we did not fine-tune it. There are no training epochs. We pass every image, and a mirrored copy of it, through the model once and average its last feature map into 1,280 numbers per image.
4. **The part we trained.** A logistic regression (a simple linear classifier) on those 1,280 numbers. It uses feature scaling, L2 regularization, balanced class weights, and training images doubled with their mirrored copies. The regularization strength is picked from 9 values by an inner 4-fold test that also keeps copies together. That is 3 x 1,280 weights plus 3 offsets, 3,843 trained numbers in all.
5. **Evaluation.** 5-fold cross-validation where groups of copies are never split between training and testing (the code asserts this). We report the average and spread over the 5 folds, an overall range from 1,000 resamples, and a comparison of three image models.
6. **Conversion and browser integration.** We fold the scaling step into the final layer so the whole model is one ONNX file (opset 17) with two outputs: the answer and the last feature map. We checked that it matches the original to within 2.5 in a million over 20 images. In the browser, ONNX Runtime Web runs it with the same preprocessing as training. On the 6 sample images the browser and the Python reference agree to within 0.015 and give the same top answer on all 6.
7. **The highlight map.** For the chosen group, we multiply each of the 1,280 feature maps by that group's weight, add them up, and keep only the positive part. See "What the highlight map can and cannot show" below.
8. **The interface.** Upload checks (file type, size, color images), clear research-demo labels, plain-language explanations, and a safe failure when anything goes wrong.

### Why we chose this approach

- BUSI is small (758 usable images). Training a whole network from scratch on that would mostly memorize it. A frozen image model with a small trained layer is a standard, sensible choice for this amount of data.
- It trains in minutes on a laptop with no GPU, so the work is easy to repeat and check.
- A linear layer on averaged features lets us draw an exact class activation map in the browser. A fully fine-tuned network would need a different, less exact method.
- The final model is 16 MB, small enough to run in a browser tab so the image never leaves the person's device.

### What it is not

- It was not trained from scratch.
- The EfficientNet-B0 weights were not fine-tuned. Only the final linear layer was trained.
- The deployed model is the one from the first test round (trained on 610 images, tested on 148). It was not retrained on all 758.

### What the highlight map can and cannot show

- **What it is:** a class activation map. It shows which parts of the picture pushed the score for the chosen group up the most.
- **It always shows a bright spot.** We scale each map so its strongest spot is the brightest, so the map looks equally strong whether the model is sure or not. Always read it together with the percentages.
- **It does not show where a cancer is,** and it does not prove that a cancer is there. It only shows where the model looked.
- **It is only exact for this kind of model** (a linear layer on averaged features), and we only show it for this model.

### Why copies of the same image matter

If a picture and a near-copy of it end up on both sides of a test, the model is partly tested on pictures it has already seen. That makes the score look better than it is. Many published results on BUSI may be affected. We kept copies together and removed conflicting labels, so our numbers are lower and, we think, more honest. We still cannot rule out leakage between different pictures of the same woman, because BUSI does not say who each image came from.

### What the numbers mean in plain English

- **AUC 0.90.** Pick one cancer image and one non-cancer image at random. About 90 times out of 100, the model gives the cancer image the higher cancer score. 0.5 would be guessing.
- **Sensitivity 0.75.** It finds about 3 out of every 4 cancer images and misses about 1 in 4.
- **Specificity 0.88.** It correctly clears about 88 out of every 100 images without cancer.
- **Accuracy 0.78.** When it must pick one of three groups, it picks the right one about 78 times out of 100.
- **These do not tell us how it would do in a clinic.** They come from one hospital's images, tested on that same collection.

### How the ultrasound demo fits into SecondLook

The report explainer and chat help with the written report. The ultrasound demo shows, separately, what a trained image model can do with the pixels of a picture. It does not feed into the report explainer or the chat, and it never gives a result that a person should act on.

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

0. **BUSI has known problems that we did not fully fix.** The 2023 audit (Pawłowska et al.) reports 70 images that show things other than the breast, at least 19 images with doubtful labels, and 235 duplicated lesion images. We handled duplicates and conflicting labels as described above. We did not remove the non-breast images or re-check the doubtful labels.
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
- No clinician has reviewed the app or its wording. This applies to the whole project, including the report explainer, the symptom rules and the chat assistant.

## Report Sanity Check (rules, no model)

This part has no machine learning. `app/js/sanity.js` is a set of fixed rules that read the report text and flag things that look wrong. The same code runs in the browser and on the chat server.

- **What it looks for:** clock positions that do not exist (0, 13, 14 and up), sizes or units that are unlikely, BI-RADS numbers that conflict or look like an earlier exam, two descriptions of one lesion that disagree, left and right mismatches, and text it could not read.
- **Labels:** Needs checking, Possible conflict, Could not interpret. They describe the text. They say nothing about anyone's health.
- **What it never does:** pick which of two conflicting statements is right, change a unit, side or category, or drop a value it found. It keeps the original text.
- **Benefit of the doubt:** for impossible values it still shows the full report, and tells the person to double check their copy and paste and ask the imaging team to confirm.
- **Testing:** 41 tests in `tests/report-sanity.test.mjs` (25 adversarial cases plus fuzz). Passing tests show the rules do what we wrote. They do not show the rules are right for every real report.
- **Limits:** It uses fixed rules, so it can miss things. It cannot catch every contradiction. Two descriptions of one lesion only count as a conflict when the side, the clock position or a back-reference such as "the mass" lets us tell they are about the same lesion. Small unit slips, such as 1.2 mm where 1.2 cm was meant, are missed. Clock positions written as words, such as "fourteen o'clock", are not detected. We have not tested the warning area with a real screen reader. No clinician has reviewed the rules or the wording.

## Where the assistant fits in

The chat assistant is separate. It is a general language model from OpenAI. We did not train or fine-tune it. The server runs the sanity check first and gives the assistant an AUTOMATIC CHECK block and a line saying whether a family history is stated, mentioned or NOT stated. See `assistant/prompt.mjs` for the instructions we gave it and `eval/` for how we test it.
