// Clinical reference content. Every entry paraphrases a published source listed
// in SOURCES; nothing here is generated at runtime.

export const SOURCES = {
  acr: {
    label: "ACR BI-RADS® Atlas, 5th edition (American College of Radiology, 2013)",
    url: "https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/BI-RADS",
  },
  acsBirads: {
    label: "American Cancer Society — Understanding your mammogram report",
    url: "https://www.cancer.org/cancer/types/breast-cancer/screening-tests-and-early-detection/mammograms/understanding-your-mammogram-report.html",
  },
  fdaDensity: {
    label: "U.S. FDA — Mammography Quality Standards Act final rule: breast density notification (effective Sept 10, 2024)",
    url: "https://www.fda.gov/radiation-emitting-products/mammography-quality-standards-act-and-program/important-information-final-rule-amend-mammography-quality-standards-act-mqsa",
  },
  acsSigns: {
    label: "American Cancer Society — Breast cancer signs and symptoms",
    url: "https://www.cancer.org/cancer/types/breast-cancer/screening-tests-and-early-detection/breast-cancer-signs-and-symptoms.html",
  },
  cdcSigns: {
    label: "CDC — What are the symptoms of breast cancer?",
    url: "https://www.cdc.gov/breast-cancer/symptoms/index.html",
  },
  uspstf: {
    label: "USPSTF — Breast Cancer: Screening (final recommendation, April 30, 2024)",
    url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/breast-cancer-screening",
  },
  uspstfBrca: {
    label: "USPSTF — BRCA-Related Cancer: Risk Assessment, Genetic Counseling, and Genetic Testing (2019)",
    url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/brca-related-cancer-risk-assessment-genetic-counseling-and-genetic-testing",
  },
  acsRisk: {
    label: "American Cancer Society — Breast cancer risk factors you cannot change (family history)",
    url: "https://www.cancer.org/cancer/types/breast-cancer/risk-and-prevention/breast-cancer-risk-factors-you-cannot-change.html",
  },
  acsIbc: {
    label: "American Cancer Society — Inflammatory breast cancer",
    url: "https://www.cancer.org/cancer/types/breast-cancer/about/types-of-breast-cancer/inflammatory-breast-cancer.html",
  },
};

// ACR BI-RADS assessment categories (5th ed.). Likelihood of malignancy ranges
// and management are as defined by the ACR atlas.
export const BIRADS = {
  "0": {
    name: "Incomplete — need more imaging",
    risk: "Not yet assigned",
    range: null,
    next: "Come back for extra mammogram views and/or an ultrasound, or the radiologist needs older mammograms to compare.",
    plain: "The picture is not finished yet. This is common: most people called back for more images do not have cancer.",
    tone: "follow",
  },
  "1": {
    name: "Negative",
    risk: "Essentially 0%",
    range: [0, 0],
    next: "Continue routine screening.",
    plain: "Nothing to comment on was seen.",
    tone: "ok",
  },
  "2": {
    name: "Benign",
    risk: "Essentially 0%",
    range: [0, 0],
    next: "Continue routine screening.",
    plain: "Something was seen, but it is definitely not cancer (for example a simple cyst or a stable lymph node). It is recorded so future readers know about it.",
    tone: "ok",
  },
  "3": {
    name: "Probably benign",
    risk: "More than 0% but 2% or less",
    range: [0, 2],
    next: "Short-interval follow-up imaging (usually about 6 months) instead of a biopsy.",
    plain: "The finding is very likely harmless. Checking that it stays the same over time is safer than an immediate needle biopsy.",
    tone: "watch",
    note: "Category 3 is used after a full diagnostic work-up, not directly from a screening mammogram.",
  },
  "4": {
    name: "Suspicious",
    risk: "More than 2% but less than 95%",
    range: [2, 95],
    next: "Tissue diagnosis — usually a needle biopsy.",
    plain: "The finding needs a small sample of tissue to know what it is. Many category 4 biopsies come back benign.",
    tone: "act",
  },
  "4A": {
    name: "Low suspicion for malignancy",
    risk: "More than 2% up to 10%",
    range: [2, 10],
    next: "Tissue diagnosis — usually a needle biopsy.",
    plain: "A biopsy is recommended, but the large majority of 4A findings turn out benign.",
    tone: "act",
  },
  "4B": {
    name: "Moderate suspicion for malignancy",
    risk: "More than 10% up to 50%",
    range: [10, 50],
    next: "Tissue diagnosis — usually a needle biopsy.",
    plain: "A biopsy is recommended to find out what this is.",
    tone: "act",
  },
  "4C": {
    name: "High suspicion for malignancy",
    risk: "More than 50% but less than 95%",
    range: [50, 95],
    next: "Tissue diagnosis — usually a needle biopsy.",
    plain: "A biopsy is recommended soon; the radiologist is concerned about this finding.",
    tone: "act",
  },
  "5": {
    name: "Highly suggestive of malignancy",
    risk: "95% or more",
    range: [95, 100],
    next: "Tissue diagnosis — needle biopsy.",
    plain: "The finding looks very much like cancer. A biopsy confirms it and gives the details doctors need to plan treatment.",
    tone: "act",
  },
  "6": {
    name: "Known biopsy-proven malignancy",
    risk: "Already confirmed by biopsy",
    range: null,
    next: "Treatment planning with your care team (for example surgery when clinically appropriate).",
    plain: "Used for imaging done after cancer has already been diagnosed, for example to plan or check treatment.",
    tone: "act",
  },
};

export const DENSITY = {
  A: { name: "Almost entirely fatty", plain: "Mostly fatty tissue. Mammograms see through it easily." },
  B: { name: "Scattered areas of fibroglandular density", plain: "Mostly fatty with some scattered dense areas." },
  C: { name: "Heterogeneously dense", plain: "Many dense areas, which can hide small masses. Counts as “dense breasts”." },
  D: { name: "Extremely dense", plain: "Very dense tissue, which lowers how well a mammogram can find cancer. Counts as “dense breasts”." },
};

// Glossary of report words. tone: "ok" usually reassuring, "watch" depends on
// context, "act" often a reason for further tests, "info" neutral procedure word.
export const TERMS = [
  // Exams and procedures
  ["screening mammogram", "info", "A routine mammogram for someone with no symptoms."],
  ["diagnostic mammogram", "info", "A mammogram with extra views, done to look closely at a symptom or at something seen on a screening mammogram."],
  ["tomosynthesis", "info", "“3D mammography”: many thin X-ray slices of the breast, so overlapping tissue is less likely to hide or mimic a finding."],
  ["spot compression", "info", "An extra mammogram view that presses one small area flatter to see it more clearly."],
  ["magnification view", "info", "A zoomed-in mammogram view, often used to look at calcifications."],
  ["ultrasound", "info", "Sound waves make a picture of the breast. Good at telling fluid-filled cysts from solid lumps; no radiation."],
  ["MRI", "info", "Magnetic resonance imaging. Very sensitive; used for some high-risk people and to plan treatment."],
  ["core needle biopsy", "info", "A hollow needle removes a few thin cylinders of tissue for a pathologist to examine. Usually done with local numbing, no surgery."],
  ["stereotactic", "info", "A biopsy guided by mammogram images, often used for calcifications."],
  ["fine needle aspiration", "info", "A very thin needle removes fluid or cells. Can drain a cyst."],
  ["comparison", "info", "The radiologist compared these images with your older ones. Changes over time matter more than any single picture."],
  ["callback", "watch", "You are asked to return for more images. Most callbacks do not end in a cancer diagnosis."],
  ["recall", "watch", "Being asked to come back for more images after a screening mammogram."],
  // Mammogram findings
  ["mass", "watch", "A 3-dimensional lump seen on imaging. Its shape and edges help decide whether it is likely harmless."],
  ["asymmetry", "watch", "One area looks denser than the same area in the other breast. Often just overlapping normal tissue; extra views usually clarify it."],
  ["focal asymmetry", "watch", "A small asymmetric area seen on more than one view. Usually needs extra views or ultrasound."],
  ["developing asymmetry", "act", "An asymmetry that is new or larger than on older mammograms. Usually needs further work-up."],
  ["architectural distortion", "act", "The normal tissue lines look pulled toward a point, without a clear mass. Usually needs further work-up or biopsy."],
  ["calcifications", "watch", "Tiny calcium deposits. Very common and mostly harmless; certain shapes or patterns need a closer look."],
  ["microcalcifications", "watch", "Very small calcium specks. The pattern (shape and distribution) matters more than their presence."],
  ["coarse", "ok", "Coarse or “popcorn-like” calcifications are typically benign (often an old fibroadenoma)."],
  ["vascular calcifications", "ok", "Calcium in blood-vessel walls. Benign."],
  ["amorphous", "act", "Calcifications too small or hazy to see a clear shape. Depending on the pattern, they may need a biopsy."],
  ["fine pleomorphic", "act", "Tiny calcifications of varied shapes and sizes. A suspicious pattern that usually leads to biopsy."],
  ["fine linear", "act", "Thin, line-like or branching calcifications. A suspicious pattern that usually leads to biopsy."],
  ["segmental", "act", "Calcifications spread along a duct and its branches. A distribution that raises concern."],
  ["grouped", "watch", "A few calcifications close together in a small area."],
  ["clustered", "watch", "A few calcifications close together in a small area (older term for “grouped”)."],
  ["skin thickening", "watch", "The skin of the breast looks thicker than normal. Has many causes, including infection or inflammation."],
  ["nipple retraction", "watch", "The nipple is pulled inward. Important if it is new."],
  ["intramammary lymph node", "ok", "A normal lymph node inside the breast tissue. Usually benign."],
  ["axillary", "info", "In the armpit — where the breast's lymph nodes drain."],
  ["lymph node", "info", "Small bean-shaped immune organs. Doctors check them because cancer can spread to them."],
  ["fibroglandular", "info", "The milk glands, ducts and supporting tissue — the “dense” part of the breast."],
  // Shapes and margins (mammogram and ultrasound)
  ["oval", "ok", "Egg-shaped. Oval shapes are more often benign."],
  ["round", "ok", "Ball-shaped. Often benign, especially with smooth edges."],
  ["irregular", "act", "Neither round nor oval. An irregular shape is more concerning."],
  ["circumscribed", "ok", "Sharp, well-defined edges. Usually a reassuring feature."],
  ["indistinct", "act", "Edges that are hard to see clearly. A more concerning feature."],
  ["microlobulated", "act", "Edges with many tiny bumps. A more concerning feature."],
  ["angular", "act", "Edges with sharp corners. A more concerning feature."],
  ["spiculated", "act", "Thin lines radiating out from the edge, like a star. One of the most concerning features."],
  ["obscured", "watch", "Part of the edge is hidden by overlapping normal tissue."],
  // Ultrasound descriptors
  ["anechoic", "ok", "Completely black on ultrasound — typical of fluid, as in a simple cyst."],
  ["hypoechoic", "watch", "Darker than the surrounding fat on ultrasound. Many benign and malignant lumps look like this."],
  ["hyperechoic", "ok", "Brighter than the surrounding fat on ultrasound. Usually benign."],
  ["isoechoic", "info", "The same brightness as the surrounding fat on ultrasound."],
  ["heterogeneous", "watch", "Mixed brightness inside the finding."],
  ["parallel", "ok", "“Wider than tall” — lying along the skin. More often benign."],
  ["not parallel", "act", "“Taller than wide” — growing across tissue planes. A more concerning feature."],
  ["taller than wide", "act", "Growing across tissue planes rather than along them. A more concerning feature."],
  ["posterior acoustic shadowing", "act", "A dark shadow behind the finding on ultrasound. Can be a concerning feature."],
  ["shadowing", "watch", "A dark band behind a finding on ultrasound. Can happen with some cancers and with some benign scars."],
  ["posterior enhancement", "ok", "Brighter area behind the finding on ultrasound — typical of fluid-filled cysts."],
  ["vascularity", "info", "Blood flow inside or around a finding, seen with Doppler ultrasound."],
  ["cyst", "ok", "A fluid-filled sac. Simple cysts are benign and very common."],
  ["complicated cyst", "watch", "A cyst with some debris inside. Usually benign; often followed with imaging."],
  ["fibroadenoma", "ok", "A common benign solid lump made of gland and connective tissue."],
  ["solid", "watch", "Not fluid-filled. Many solid lumps are benign (like fibroadenomas)."],
  ["stable", "ok", "Unchanged compared with older images — usually reassuring."],
  // Pathology words that appear on follow-up reports
  ["probably benign", "watch", "Very likely not cancer (2% chance or less). Usually re-checked with imaging in about 6 months."],
  ["suspicious", "act", "The radiologist cannot call it harmless and recommends a biopsy to find out what it is."],
  ["highly suggestive of malignancy", "act", "Looks very much like cancer (95% or more). A biopsy confirms it."],
  ["malignancy", "act", "Cancer."],
  ["incomplete", "info", "The assessment is not finished; more images or older images are needed."],
  ["unremarkable", "ok", "Normal; nothing worth noting."],
  ["benign", "ok", "Not cancer."],
  ["malignant", "act", "Cancer."],
  ["carcinoma", "act", "Cancer that starts in the lining (epithelial) cells, as most breast cancers do."],
  ["ductal carcinoma in situ", "act", "DCIS: abnormal cells inside the milk ducts that have not spread into surrounding tissue (stage 0)."],
  ["DCIS", "act", "Ductal carcinoma in situ: abnormal cells confined to the milk ducts (stage 0)."],
  ["invasive", "act", "Cancer cells have grown beyond where they started into nearby tissue."],
];

export const QUESTIONS = {
  "0": [
    "What extra images do I need (more mammogram views, ultrasound), and how soon?",
    "Do you need my older mammograms? Where should I ask for them to be sent?",
  ],
  "3": [
    "When exactly is my follow-up scan, and who will schedule it?",
    "What would make you recommend a biopsy instead of waiting?",
  ],
  "4": [
    "What kind of biopsy do I need (ultrasound-guided, stereotactic, MRI-guided)?",
    "How soon can it be done, and when and how will I get the results?",
    "Who should I call if I have not heard back?",
  ],
  "5": [
    "How soon can the biopsy be done, and who will explain the results with me?",
    "Should I ask for a referral to a breast specialist or cancer centre now?",
  ],
  "6": [
    "Who is on my care team, and what are the next steps in treatment planning?",
  ],
  dense: [
    "My breasts are dense. Would supplemental screening such as ultrasound or MRI make sense for me?",
  ],
  family: [
    "Given my family history, should I have a formal risk assessment or genetic counseling?",
  ],
};

// Fictional example reports for the demo (not real patients).
export const EXAMPLES = [
  {
    title: "Screening mammogram — called back",
    text: `EXAM: Bilateral screening mammogram with tomosynthesis.
COMPARISON: Prior exams from 2023 and 2024.
BREAST COMPOSITION: The breasts are heterogeneously dense, which may obscure small masses (density C).
FINDINGS: There is a focal asymmetry in the left breast at 2 o'clock, middle depth, seen on the CC and MLO views. No suspicious calcifications. No architectural distortion. The right breast is unremarkable.
IMPRESSION: Incomplete. Additional diagnostic mammographic views and possible ultrasound of the left breast are recommended.
BI-RADS 0: Incomplete – Need additional imaging evaluation.`,
  },
  {
    title: "Ultrasound — probably benign",
    text: `EXAM: Targeted ultrasound of the right breast.
FINDINGS: At the right breast 10 o'clock, 3 cm from the nipple, there is an oval, circumscribed, hypoechoic solid mass with parallel orientation measuring 0.9 x 0.5 x 0.7 cm. No posterior acoustic shadowing. No internal vascularity. Findings are most consistent with a fibroadenoma.
No suspicious axillary lymph nodes.
IMPRESSION: Probably benign right breast mass. Recommend short-interval follow-up ultrasound in 6 months.
BI-RADS 3: Probably benign.`,
  },
  {
    title: "Ultrasound — biopsy recommended",
    text: `EXAM: Diagnostic mammogram and ultrasound of the left breast.
BREAST COMPOSITION: Scattered areas of fibroglandular density (B).
FINDINGS: Ultrasound demonstrates an irregular hypoechoic mass with indistinct and angular margins in the left breast at 2 o'clock, 5 cm from the nipple, measuring 1.4 cm. The mass is not parallel to the skin and shows posterior acoustic shadowing. The left axillary lymph nodes appear normal.
IMPRESSION: Suspicious left breast mass. Ultrasound-guided core needle biopsy is recommended.
BI-RADS 4B: Moderate suspicion for malignancy.`,
  },
];
