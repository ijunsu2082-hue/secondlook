# Which AI models detect and diagnose cancer best? Research report for CodeTheCure Hacks 2026

> **Read this first.** These are background notes from the early research phase of the hackathon. They are not part of the app. They cover more than breast cancer, and they mention a second project. The numbers were **not re-checked in the final audit**. Where this file and `MODEL_CARD.md` or the About page disagree, trust those two. Please check each source before quoting anything here.

*Compiled October 26, 2026. Every figure was opened at its source, and the DOIs/PMIDs were checked against Crossref and PubMed. Anything we could not verify is marked as such. The section on our own experiments reports results we measured ourselves.*

---

## Part A, Breast cancer

### A1. Screening mammography: what is used in clinics today

| System | Evidence | Key results | Regulatory |
|---|---|---|---|
| **Transpara** (ScreenPoint), **MASAI randomised trial**, Sweden | 105,934 women randomised: AI-supported vs standard double reading | Cancer detection 6.4 vs 5.0 per 1,000 (ratio 1.29, 95% CI 1.09 to 1.51); screen-reading workload −44.2% (Lancet Digit Health 2025, PMID 39904652). Final results: sensitivity 80.5% vs 73.8% (p = 0.031); specificity 98.5% in both arms; interval cancers 1.55 vs 1.76 per 1,000 (ratio 0.88, CI 0.65 to 1.18, non-inferior but not significant) (Lancet 2026, PMID 41620232) | FDA 510(k), first K181704 (2018) |
| **Vara**, **PRAIM** real-world study, Germany | 463,094 women, 12 sites; observational | Detection 6.7 vs 5.7 per 1,000 (+17.6%); recall rate not inferior (37.4 vs 38.3 per 1,000); PPV of recall 17.9% vs 14.9% (Nat Med 2025, PMC11922743) | No FDA 510(k) found |
| **Lunit INSIGHT MMG** | 170,230 exams plus a 14-reader study | Standalone AUROC 0.959; radiologists improved from 0.810 to 0.881 with AI (Lancet Digit Health 2020, PMID 33334578) | FDA K211678 (2021) |
| **Lunit, ScreenTrustCAD** (prospective) | 55,581 women | One radiologist + AI found 261 vs 250 cancers for two radiologists (non-inferior) (PMID 37690911) | None |
| **iCAD ProFound AI** (3D/DBT) | Reader study: 24 radiologists | Reader AUC 0.795 to 0.852; reading time −52.7% (PMC6677281) | FDA cleared (2018 to 2024) |
| **Google / McKinney et al.**, Nature 2020 | UK and US datasets | False positives −5.7% / −1.2%; false negatives −9.4% / −2.7% (PMID 31894144) | Licensed to iCAD |

**Do not overstate:**
- MASAI's interval-cancer reduction (ratio 0.88) is *not* statistically significant.
- PRAIM is observational, not randomised.

### A2. Forecasting future breast cancer from a mammogram ("risk AI")

- **Mirai** (Yala et al., Sci Transl Med 2021):
  - C-index 0.76 (MGH), 0.81 (Karolinska), 0.79 (Chang Gung).
  - Across 7 sites in 5 countries: C-index 0.75 to 0.84 (JCO 2022, PMC9148689).
  - Mayo Clinic biobank: 5-year C-index 0.71 vs 0.59 to 0.68 for the Gail, Tyrer-Cuzick and BCSC models (JNCI 2026).
  - Code and weights are MIT-licensed, research use only.
  - Needs four "For Presentation" DICOM views at 1664×2048; tested on Hologic machines.
- **Clairity Breast**: the first FDA De Novo authorisation for AI that predicts 5-year risk from a mammogram (DEN240047, May 30, 2025). Commercial.
- **Systematic review** (41 retrospective studies, JNCI 2026): median AUC about 0.71 across prediction horizons.

### A3. Open datasets and what honest performance looks like

| Dataset | Content | Typical reported performance | Pitfall |
|---|---|---|---|
| **BUSI** (ultrasound; Al-Dhabyani 2020) | 780 images, 600 women (437 benign / 210 malignant / 133 normal) | 95 to 98% accuracy in single-dataset papers; about 86 to 88% on external sets | 235 duplicates, 8 filed as both benign and malignant, plus axilla and needle images (Pawłowska 2023, PMC10293973) |
| **BreastMNIST** (BUSI-derived, official split) | 546 / 78 / 156 images | ResNet-18 AUC 0.901; best listed 0.919 | Small |
| **BreakHis** (histopathology) | 7,909 images, 82 patients | About 99% with image-level splits; 92 to 96% with patient-level splits | Patient leakage |
| **WDBC** (FNA cell features) | 569 samples, 30 features | 96 to 98% accuracy | Very clean; little room to improve |

---

## Part B, Cancer in general (multi-cancer)

### B1. Pathology foundation models (the current frontier)

| Model | Training scale | Headline result | Weights / licence |
|---|---|---|---|
| **CHIEF** (Wang et al., Nature 2024, doi:10.1038/s41586-024-07894-z) | 60,530 whole slides from 19 anatomical sites | Cancer-detection macro-AUROC 0.94 across 11 cancer types | On request; non-commercial; needs an NVIDIA GPU |
| **Virchow** (Vorontsov et al., Nat Med 2024, doi:10.1038/s41591-024-03141-0) | about 1.5M slides | Pan-cancer detection AUC 0.95 across 9 common and 7 rare cancers | HF gated |
| **UNI / UNI2-h** (Chen et al., Nat Med 2024, doi:10.1038/s41591-024-02857-3) | over 100M tiles (UNI2-h: 200M+) | 34 tasks, up to 108 cancer types | HF gated, CC-BY-NC-ND |
| **Prov-GigaPath** (Xu et al., Nature 2024, doi:10.1038/s41586-024-07441-w) | 1.3B tiles, 171k slides | Best result on 25 of 26 tasks | HF gated, Apache-2.0 |
| **CONCH**, **Virchow2**, **H-optimus** | None | Vision-language and larger successors | Mostly gated, non-commercial |

A 2026 benchmark of 32 foundation models (Nat Commun 2026) found that the differences between the top models are "often small and task dependent". There is no single winner.

### B2. Radiology / CT

- **PANDA** (Cao et al., Nat Med 2023, PMC10719100): pancreatic cancer on routine *non-contrast* CT.
  - AUC 0.986 to 0.996.
  - Real-world performance on 20,530 patients: sensitivity 92.9%, specificity 99.9%.
  - Code not public.
- **Sybil** (Mikhael et al., JCO 2023, doi:10.1200/JCO.22.01345): forecasts lung cancer from one low-dose CT.
  - 1-year AUC 0.92 / 0.86 / 0.94 across three cohorts.
  - Code is MIT-licensed.
- **GRAPE** (Nat Med 2025): gastric cancer on non-contrast CT; AUC 0.970 internal, 0.927 external.

### B3. Multi-cancer early-detection blood tests

**NHS-Galleri randomised trial** (NEJM 2026, doi:10.1056/NEJMoa2505723; 142,250 people):
- **The primary endpoint was not met.** Stage III to IV incidence ratio 1.03 (0.92 to 1.14).
- Test performance (Nat Med 2026):
  - PPV 46 to 58%
  - specificity about 99.5%
  - episode sensitivity 27 to 37%
  - cancer signal origin accuracy about 92%

Early detection at population scale is still unsolved.

### B4. The hackathon datasets

| Dataset | Facts | Fit |
|---|---|---|
| **Multi Cancer** (Naren, Kaggle 2022; CC BY-NC-SA 4.0) | 130,000 images; 26 classes; 8 cancer types (ALL blood smears, brain MRI, breast histology, cervical Pap cells, kidney CT, lung/colon histology, lymphoma, oral histology). **Each class was padded to 5,000 images by Keras augmentation from far fewer originals** (e.g. 3,256 ALL images, 1,224 oral). | Good for a demo. Random splits leak augmented copies. Best reported accuracy: 99.25% for the 8 types and 97.80% for the 26 subclasses (Bappi et al., IEEE Access 2024), with leakage unverified. |
| **Cervical Cancer (Risk Factors)** (UCI 383; CC BY 4.0) | 858 patients from Caracas; 32 features; 4 test targets; Biopsy positive 55 (6.4%); heavy missingness | Published 95 to 99% accuracies often oversample before splitting. Accuracy is misleading at 6% prevalence. |
| **Cancer Inhibitors** (Kaggle; CC BY-NC-SA) | Kinase-inhibitor molecules (8 kinases, Morgan fingerprints) | Drug discovery, not detection. No patient data. |

### B5. Lightweight backbones for a laptop

| Backbone | Params | GFLOPs | ImageNet top-1 |
|---|---|---|---|
| EfficientNet-B0 | 5.3M | 0.39 | 77.7% |
| MobileNetV3-L | 5.5M | 0.22 | 74.0% |
| ConvNeXt-Tiny | 28.6M | 4.46 | 82.5% |
| DINOv2 ViT-S/14 | 22M | None | self-supervised; beats ImageNet pretraining on medical tasks (Huix et al., WACV 2024) |

---

## Part C, Our own experiments (reproducible; code in each repo's `training/`)

### C1. Breast ultrasound (BUSI)

- **Cleaning.** We found duplicates by pixel hash plus deep-feature similarity. We **removed 22 images (9 groups) whose copies carry conflicting labels** and grouped the remaining duplicates.
- **Protocol.** 5-fold stratified grouped cross-validation, with inner cross-validation to tune the model.

| Backbone (frozen) + logistic regression | Malignant AUC | Balanced accuracy | Sensitivity |
|---|---|---|---|
| **EfficientNet-B0 (deployed)** | **0.904 ± 0.014** | 0.784 ± 0.034 | 0.750 ± 0.080 |
| ConvNeXt-Tiny | 0.888 | 0.775 | 0.759 |
| DINOv2 ViT-S/14 | 0.914 | 0.799 | 0.764 |

**Conclusion:** the three backbones are statistically indistinguishable on clean data. The smallest model wins on deployability.

### C2. Breast FNA cells (WDBC), 5 × 10-fold cross-validation

| Model | Accuracy | AUC |
|---|---|---|
| Logistic regression | 97.9% | 0.995 |
| SVM (RBF) | 98.1% | 0.996 |
| Random forest | 96.0% | 0.991 |
| Gradient boosting | 96.2% | 0.992 |

**Conclusion:** simple linear models are as good as ensembles here, and they are fully explainable.

### C3. Cervical risk factors (UCI 383), 10 × 5-fold cross-validation, predicting Biopsy

| Features | Logistic regression AUC | Random forest AUC |
|---|---|---|
| Risk-factor questionnaire only | 0.633 ± 0.083 | 0.675 ± 0.062 |
| + Hinselmann, Schiller, cytology exams | 0.940 ± 0.041 | 0.955 ± 0.029 |

**Conclusion:** self-reported risk factors barely beat chance. Screening exams carry the signal, so a questionnaire must never replace screening.

### C4. Multi Cancer (26 classes, 700 per class, frozen EfficientNet-B0 + logistic regression)

| Split | 26-class accuracy | 8-type accuracy | Macro AUC |
|---|---|---|---|
| Random (as in most papers) | 96.0% | 99.7% | 0.999 |
| Duplicate-grouped (complete-linkage clustering + flip-invariant hash) | **93.4%** | 99.9% | 0.998 |

70.3% of the sampled images had a detected near-duplicate.

A pitfall we hit ourselves: our first grouping used plain union-find. It "chained" similar images into giant groups (665 of 700 images in one class), which left whole classes out of training and wrongly gave 76.8%. Complete-linkage clustering fixed this; the largest group is now 50 images.

The hardest classes are the lymphoma subtypes (recall 71 to 75%).

**Conclusion:** leakage inflates this benchmark by at least 2.6 points, and it is easy to get leakage control wrong in both directions.

---

## Part D, Recommendation

For a laptop-scale, honest hackathon demo:

1. **Images:** a frozen ImageNet EfficientNet-B0 with a logistic-regression head.
   - Exported to ONNX and run in the browser.
   - It gives an exact Class Activation Map.
   - Accuracy is within noise of a 4× larger DINOv2 on clean data.
2. **Tabular data:** logistic regression with transparent per-feature contributions.
3. **Symptoms and reports:** deterministic rules from NICE NG12, NHS, ACS, CDC, ACR BI-RADS and USPSTF, never a generative chatbot.
4. **Always** check for leakage (duplicates, augmentation, patient overlap), and report the conservative number.
5. Cite foundation models (CHIEF, Virchow, UNI) and trials (MASAI, PRAIM) as the clinical frontier. They are gated, huge or GPU-only, so not something to run here.
