# SecondLook — Devpost submission kit

## 1. Project abstract (max 300 words; this one is 268)

> **SecondLook: a second look at breast imaging, earlier and more clearly.**
>
> One in eight U.S. women will be diagnosed with breast cancer. Found while localized, 5-year survival is 100%; after distant spread, 33.8% (SEER). Early detection depends on imaging, but imaging reports are written for doctors, and patients spend the anxious days between a callback and a biopsy decoding "BI-RADS 4B" or "spiculated" alone. My grandmother went through this, and it inspired SecondLook.
>
> SecondLook is a private, browser-only toolkit with four parts:
> (1) A report decoder that turns a mammogram or ultrasound report into a BI-RADS risk scale, a breast-density picture, the finding's location on a clock-face diagram, 72 explained terms with negation detection, and questions for the doctor.
> (2) An on-device ultrasound AI (EfficientNet-B0, about 0.2 seconds) that classifies normal, benign or malignant and draws a heat map of its evidence.
> (3) A symptom and screening checker built on CDC, ACS, NICE and USPSTF 2024 guidance, including family-history and BRCA rules.
> (4) A biopsy lab that explains a 97.9%-accurate cell-measurement model feature by feature.
>
> We treated accuracy as a safety issue. The public BUSI ultrasound dataset contains duplicates, some labeled both benign and malignant. We removed 22 conflicting images and kept duplicate groups out of the test folds. With 5-fold grouped cross-validation, our model reaches a malignant-vs-not AUC of 0.90 (95% CI 0.88–0.93). That is lower than the 95–98% claimed with leaky splits, but it is defensible. Every rule cites its source, no text is AI-generated, and no data leaves the device.
>
> SecondLook serves patients and families waiting on results, and communities where ultrasound is the most available breast imaging tool.

## 2. Demo video script (target 2:45; max 3:00)

| Time | On screen | Voice-over |
|---|---|---|
| 0:00–0:15 | Home page; slow scroll over the stats | "One in eight women will face breast cancer. Found early, 5-year survival is 100%. Found late, it is 34%. My grandmother's experience showed me that the hardest part often isn't the scan. It's understanding the result." |
| 0:15–0:55 | **Read my report**. Click "Ultrasound — biopsy recommended". Hover over "spiculated" and "not parallel". Scroll to the diagram. | "Paste any mammogram or ultrasound report. SecondLook finds the BI-RADS category, here 4B, and shows what it means: a 10 to 50% chance of cancer, and a biopsy is the next step. It shows density as a picture and places the finding on a clock-face diagram of the left breast. Every term is explained, and terms the report says are absent are struck through. It ends with questions to bring to the appointment." |
| 0:55–1:40 | **Ultrasound AI**. Click a malignant test image, then a benign one. Move the heat-map slider. Scroll to "How good is this model?". | "This model runs entirely in the browser, so the image never leaves your device. In 0.2 seconds it estimates normal, benign or malignant and highlights the region behind its answer. These test images were never used in training. And we're honest about accuracy. The public dataset has duplicates labeled both benign and malignant, so we removed them and kept duplicates out of the test set. The result is an AUC of 0.90, lower than many papers but real." |
| 1:40–2:15 | **When to see a doctor**. Tick "a new lump", set age 45, tick "grandparent had breast cancer". | "Have you noticed a change? The checklist uses CDC and American Cancer Society warning signs. A new lump means 'book an appointment now; don't wait for your next screening.' The planner applies the 2024 USPSTF guideline. A grandmother's breast cancer leads to the USPSTF advice on family-risk assessment: plan, don't panic." |
| 2:15–2:35 | **Biopsy lab**. Case 6 shows "the model gets this one wrong". Drag a slider. | "For learners, the biopsy lab shows how a 98%-accurate model reads cell measurements, and it shows a case it gets wrong." |
| 2:35–2:50 | **How it works**, then the footer | "Static web app, on-device AI, every rule sourced. SecondLook: a second look, earlier and more clearly." |

**Recording tips:**
- Record at 1280×800 with browser zoom at 100%.
- Pre-load the page so the model is warm.
- Read the voice-over at a calm pace (about 150 words per minute).

## 3. Five-minute pitch (finalists)

1. **Hook (0:30).** Start with the grandmother story, then the statistic: 1 in 8; 100% vs 33.8% survival by stage.
2. **Problem (0:40).**
   - Reports are written for radiologists, and callbacks cause anxiety.
   - Patients search jargon at midnight.
   - Warning signs get ignored.
   - Since September 2024 the FDA has required mammography facilities to tell every patient their breast density, but few patients know what it means.
3. **Solution walkthrough (1:30).** Show the three main features live: report, then AI, then checker.
4. **Methodology (0:50).**
   - BUSI audit and duplicate removal.
   - Grouped 5-fold cross-validation.
   - Backbone comparison: EfficientNet-B0 0.904, DINOv2 0.914, ConvNeXt 0.888, all within noise. We picked the smallest.
   - Exact CAM.
   - ONNX parity check (difference under 3×10⁻⁶).
   - Rule engine with sources.
5. **Architecture (0:30).** Static HTML/JS with ONNX Runtime Web (WASM). No server, so it is private by design, deploys anywhere and works offline.
6. **Impact and feasibility (0:40).**
   - Target users: patients awaiting results, caregivers, and clinics in places where ultrasound is the main imaging tool.
   - The tool costs nothing to run.
   - Next steps: validate the parser on real de-identified reports, add Spanish and Korean, and run an external ultrasound test set (BUS-BRA, BrEaST).
7. **Close (0:20).** "Clinical AI like Transpara already finds 29% more cancers in randomized trials (MASAI). SecondLook brings the explanation half of that future to patients today."

## 4. Likely Q&A

**Why is your accuracy lower than published papers?**
Duplicate leakage. A 2023 audit found duplicates in BUSI, some labeled both benign and malignant. We removed the conflicting ones and grouped the rest. Papers that test on other hospitals drop to 86–88%. Our 0.90 AUC matches the clean BreastMNIST baseline of 0.901.

**Why not fine-tune, or use Mirai?**
- We had an 8 GB laptop, so we used a linear probe on frozen features. It takes one forward pass per image.
- We tested a self-supervised DINOv2 backbone too: 0.914 vs 0.904, not a significant gain.
- Mirai needs four full-resolution DICOM mammogram views (1664×2048) and is for research use only. We cite it as the forecasting future.

**Could the heat map mislead?**
It explains the model, not the anatomy. The app says so next to every heat map.

**Is the report parser reliable?**
It is deterministic and auditable, and it handles common U.S. wording (BI-RADS 0–6 and 4A–C, density A–D, clock positions, cm/mm, negation). It never invents text. Unknown phrasing is simply not highlighted.

**What about privacy?**
Nothing is uploaded. Everything runs in the browser tab, and there are no accounts or analytics.

**Is this safe?**
It only ever escalates: it tells people when to see a doctor, never that they are fine. Every page says it is not a medical device.
