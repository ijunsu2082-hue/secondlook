// Clinical reference content. Every entry paraphrases a published source listed
// in SOURCES; nothing here is generated at runtime.

export const SOURCES = {
  acr: {
    label: "BI-RADS Atlas, 5th edition, from the American College of Radiology (2013)",
    url: "https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/BI-RADS",
  },
  acsBirads: {
    label: "American Cancer Society: Understanding your mammogram report",
    url: "https://www.cancer.org/cancer/types/breast-cancer/screening-tests-and-early-detection/mammograms/understanding-your-mammogram-report.html",
  },
  fdaDensity: {
    label: "U.S. FDA: breast density notice rule for mammogram centers (starts Sept 10, 2024)",
    url: "https://www.fda.gov/radiation-emitting-products/mammography-quality-standards-act-and-program/important-information-final-rule-amend-mammography-quality-standards-act-mqsa",
  },
  acsSigns: {
    label: "American Cancer Society: Breast cancer signs and symptoms",
    url: "https://www.cancer.org/cancer/types/breast-cancer/screening-tests-and-early-detection/breast-cancer-signs-and-symptoms.html",
  },
  cdcSigns: {
    label: "CDC: What are the symptoms of breast cancer?",
    url: "https://www.cdc.gov/breast-cancer/symptoms/index.html",
  },
  uspstf: {
    label: "U.S. Preventive Services Task Force: Breast cancer screening (final advice, April 30, 2024)",
    url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/breast-cancer-screening",
  },
  uspstfBrca: {
    label: "U.S. Preventive Services Task Force: BRCA gene risk checks, counseling and testing (2019)",
    url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/brca-related-cancer-risk-assessment-genetic-counseling-and-genetic-testing",
  },
  acsRisk: {
    label: "American Cancer Society: Breast cancer risk factors you cannot change (family history)",
    url: "https://www.cancer.org/cancer/types/breast-cancer/risk-and-prevention/breast-cancer-risk-factors-you-cannot-change.html",
  },
  acsIbc: {
    label: "American Cancer Society: Inflammatory breast cancer",
    url: "https://www.cancer.org/cancer/types/breast-cancer/about/types-of-breast-cancer/inflammatory-breast-cancer.html",
  },
};

// ACR BI-RADS assessment categories (5th ed.). Likelihood of malignancy ranges
// and management are as defined by the ACR atlas.
export const BIRADS = {
  "0": {
    name: "Incomplete, needs more imaging",
    risk: "Not yet assigned",
    range: null,
    next: "You come back for extra mammogram pictures or an ultrasound, or the radiologist asks for your older mammograms to compare.",
    plain: "The review is not finished yet. Being called back is common, and most people who are called back for more images do not have cancer.",
    tone: "follow",
  },
  "1": {
    name: "Negative",
    risk: "Essentially 0%",
    range: [0, 0],
    next: "Continue routine screening.",
    plain: "The radiologist saw nothing that needs to be pointed out.",
    tone: "ok",
  },
  "2": {
    name: "Benign",
    risk: "Essentially 0%",
    range: [0, 0],
    next: "Continue routine screening.",
    plain: "Something was seen, but it is a type of finding doctors know is not cancer, such as a simple cyst or a lymph node that has not changed. It is written down so future readers know about it.",
    tone: "ok",
  },
  "3": {
    name: "Probably benign",
    risk: "More than 0% but 2% or less",
    range: [0, 2],
    next: "Another scan soon, usually in about 6 months, instead of a biopsy.",
    plain: "The finding is very likely harmless. Doctors usually prefer to check that it stays the same over time, instead of doing a biopsy right away.",
    tone: "watch",
    note: "Doctors usually give a 3 only after extra pictures, not straight from a routine screening mammogram.",
  },
  "4": {
    name: "Suspicious",
    risk: "More than 2% but less than 95%",
    range: [2, 95],
    next: "A biopsy, which takes a small sample of tissue to find out what it is. This is usually done with a needle.",
    plain: "The only way to know what the finding is, is to take a small sample of tissue. Many biopsies after a category 4 result show something benign, which means not cancer.",
    tone: "act",
  },
  "4A": {
    name: "Low suspicion for cancer",
    risk: "More than 2% up to 10%",
    range: [2, 10],
    next: "A biopsy, which takes a small sample of tissue to find out what it is. This is usually done with a needle.",
    plain: "A biopsy is recommended. Most 4A findings turn out to be benign, which means not cancer.",
    tone: "act",
  },
  "4B": {
    name: "Moderate suspicion for cancer",
    risk: "More than 10% up to 50%",
    range: [10, 50],
    next: "A biopsy, which takes a small sample of tissue to find out what it is. This is usually done with a needle.",
    plain: "A biopsy is recommended to find out what this is.",
    tone: "act",
  },
  "4C": {
    name: "High suspicion for cancer",
    risk: "More than 50% but less than 95%",
    range: [50, 95],
    next: "A biopsy, which takes a small sample of tissue to find out what it is. This is usually done with a needle.",
    plain: "A biopsy is recommended soon. The radiologist is concerned about this finding.",
    tone: "act",
  },
  "5": {
    name: "Highly suggestive of cancer",
    risk: "95% or more",
    range: [95, 100],
    next: "A needle biopsy, which takes a small sample of tissue to find out what it is.",
    plain: "The finding looks very likely to be cancer. A biopsy is still needed to know for sure and to give doctors the details they need to plan treatment.",
    tone: "act",
  },
  "6": {
    name: "Known cancer, proven by biopsy",
    risk: "Already confirmed by biopsy",
    range: null,
    next: "Planning treatment with your care team.",
    plain: "Used for scans done after cancer has already been found, for example to plan or check treatment.",
    tone: "act",
  },
};

export const DENSITY = {
  A: { name: "Almost entirely fatty", plain: "Mostly fatty tissue. Mammograms can see through fatty tissue easily." },
  B: { name: "Scattered areas of fibroglandular density", plain: "Mostly fatty with some scattered dense areas. Dense tissue is made of milk glands and the tissue that holds them, which doctors call fibroglandular tissue." },
  C: { name: "Heterogeneously dense", plain: "Many dense areas, which can hide small lumps. This counts as “dense breasts”." },
  D: { name: "Extremely dense", plain: "Very dense tissue, which makes it harder for a mammogram to find cancer. This counts as “dense breasts”." },
};

// Glossary of report words. tone: "ok" usually reassuring, "watch" depends on
// context, "act" often a reason for further tests, "info" neutral procedure word.
export const TERMS = [
  // Exams and procedures
  ["mammogram", "info", "An X-ray picture of the breast. It can show changes too small to feel."],
  ["radiologist", "info", "A doctor who reads X-rays, ultrasounds and other pictures, and writes the report."],
  ["pathologist", "info", "A doctor who studies tissue from a biopsy under a microscope to find out what it is."],
  ["biopsy", "info", "A test that takes a tiny piece of tissue, usually with a needle, so a doctor can look at it under a microscope."],
  ["BI-RADS", "info", "A score from 0 to 6 that radiologists use to sum up what they saw and what should happen next."],
  ["screening mammogram", "info", "A routine mammogram for someone with no symptoms."],
  ["diagnostic mammogram", "info", "A mammogram with extra pictures, done to look closely at a symptom or at something seen on a routine mammogram."],
  ["tomosynthesis", "info", "Often called 3D mammography. It takes many thin X-ray slices of the breast, so overlapping tissue is less likely to hide or copy a finding."],
  ["spot compression", "info", "An extra mammogram picture that presses one small area flatter so it is easier to see."],
  ["magnification view", "info", "A zoomed-in mammogram picture, often used to look at calcifications (tiny calcium specks)."],
  ["ultrasound", "info", "Sound waves make a picture of the breast. It is good at telling fluid-filled cysts from solid lumps, and it uses no radiation."],
  ["MRI", "info", "A scan that uses magnets and radio waves. It picks up very small changes. It is used for some people at high risk and to plan treatment."],
  ["core needle biopsy", "info", "A hollow needle takes a few thin pieces of tissue for a doctor called a pathologist to study. It is usually done with numbing medicine and no surgery."],
  ["stereotactic", "info", "A biopsy guided by mammogram pictures. It is often used for calcifications."],
  ["fine needle aspiration", "info", "A very thin needle takes fluid or a few cells. It can also drain a cyst."],
  ["comparison", "info", "The radiologist compared these pictures with your older ones. Changes over time matter more than any one picture."],
  ["callback", "watch", "You are asked to come back for more pictures. Most callbacks do not end in a cancer diagnosis."],
  ["recall", "watch", "Being asked to come back for more pictures after a routine mammogram."],
  // Mammogram findings
  ["mass", "watch", "A lump with a 3D shape seen on imaging. Its shape and edges help show whether it is likely harmless."],
  ["asymmetry", "watch", "One area looks denser than the same area in the other breast. This is often just normal tissue overlapping, and extra pictures usually make it clear."],
  ["focal asymmetry", "watch", "A small uneven area seen in more than one picture. It usually needs extra pictures or an ultrasound."],
  ["developing asymmetry", "act", "An uneven area that is new or bigger than on older mammograms. It usually needs more tests."],
  ["architectural distortion", "act", "The normal lines of tissue look pulled toward one spot, without a clear lump. It usually needs more tests or a biopsy."],
  ["calcifications", "watch", "Tiny calcium specks in the breast. They are very common and mostly harmless. Some shapes or patterns need a closer look."],
  ["microcalcifications", "watch", "Very small calcium specks. Their shape and how they are spread out matter more than the fact that they are there."],
  ["coarse", "ok", "Larger, “popcorn-like” calcium specks. These are usually benign (not cancer) and often come from an old, harmless lump called a fibroadenoma."],
  ["vascular calcifications", "ok", "Calcium in the walls of blood vessels. This is benign, which means not cancer."],
  ["amorphous", "act", "Calcium specks too small or hazy to show a clear shape. Depending on the pattern, they may need a biopsy."],
  ["fine pleomorphic", "act", "Tiny calcium specks of many shapes and sizes. This pattern is a reason for concern and usually leads to a biopsy."],
  ["fine linear", "act", "Thin calcium specks that look like lines or branches. This pattern is a reason for concern and usually leads to a biopsy."],
  ["segmental", "act", "Calcium specks spread along a milk duct and its branches. This pattern raises concern."],
  ["grouped", "watch", "A few calcium specks close together in a small area."],
  ["clustered", "watch", "A few calcium specks close together in a small area. This is an older word for “grouped”."],
  ["skin thickening", "watch", "The skin of the breast looks thicker than normal. This has many causes, including infection or swelling."],
  ["nipple retraction", "watch", "The nipple is pulled inward. This matters most if it is new for you."],
  ["intramammary lymph node", "ok", "A normal lymph node inside the breast. It is usually benign, which means not cancer."],
  ["axillary", "info", "In the armpit. This is where lymph from the breast drains."],
  ["lymph node", "info", "Small bean-shaped parts of your immune system. Doctors check them because cancer can spread to them."],
  ["fibroglandular", "info", "The milk glands, milk ducts and the tissue that holds them. This is the “dense” part of the breast."],
  // Shapes and margins (mammogram and ultrasound)
  ["oval", "ok", "Egg-shaped. Oval shapes are more often benign, which means not cancer."],
  ["round", "ok", "Ball-shaped. Often benign, especially with smooth edges."],
  ["irregular", "act", "Not round or oval. An uneven shape is more concerning."],
  ["circumscribed", "ok", "Sharp, clear edges. This is usually a good sign."],
  ["indistinct", "act", "Edges that are hard to make out. This is more concerning."],
  ["microlobulated", "act", "Edges with many tiny bumps. This is more concerning."],
  ["angular", "act", "Edges with sharp corners. This is more concerning."],
  ["spiculated", "act", "Thin lines spreading out from the edge, like a star. This is one of the more concerning features."],
  ["obscured", "watch", "Part of the edge is hidden by overlapping normal tissue."],
  // Ultrasound descriptors
  ["anechoic", "ok", "Completely black on an ultrasound. This is typical of fluid, as in a simple cyst."],
  ["hypoechoic", "watch", "Darker than the nearby fat on an ultrasound. Many lumps that are not cancer, and some that are, look like this."],
  ["hyperechoic", "ok", "Brighter than the nearby fat on an ultrasound. This is usually benign, which means not cancer."],
  ["isoechoic", "info", "The same brightness as the nearby fat on an ultrasound."],
  ["heterogeneous", "watch", "Mixed brightness inside the finding."],
  ["parallel", "ok", "Wider than it is tall, lying along the skin. This is more often benign, which means not cancer."],
  ["not parallel", "act", "Taller than it is wide, growing across the layers of tissue. This is more concerning."],
  ["taller than wide", "act", "Growing across the layers of tissue instead of along them. This is more concerning."],
  ["posterior acoustic shadowing", "act", "A dark shadow behind the finding on an ultrasound. This can be a concerning sign."],
  ["shadowing", "watch", "A dark band behind a finding on an ultrasound. It can happen with some cancers and also with some harmless scars."],
  ["posterior enhancement", "ok", "A brighter area behind the finding on an ultrasound. This is typical of fluid-filled cysts."],
  ["vascularity", "info", "Blood flow inside or around a finding, seen with a special kind of ultrasound."],
  ["cyst", "ok", "A sac filled with fluid. Simple cysts are benign (not cancer) and very common."],
  ["complicated cyst", "watch", "A cyst with some small particles inside. It is usually benign, and doctors often watch it with another scan."],
  ["fibroadenoma", "ok", "A common solid lump that is not cancer. It is made of gland and connective tissue."],
  ["solid", "watch", "Not filled with fluid. Many solid lumps are benign (not cancer), such as fibroadenomas."],
  ["stable", "ok", "Has not changed compared with older pictures. This is usually a good sign."],
  // Pathology words that appear on follow-up reports
  ["probably benign", "watch", "Very likely not cancer (a 2 in 100 chance of cancer or less). Doctors usually check again with a scan in about 6 months."],
  ["suspicious", "act", "The radiologist cannot say it is harmless and recommends a biopsy to find out what it is."],
  ["highly suggestive of malignancy", "act", "Looks very likely to be cancer (95 in 100 or more). A biopsy is needed to know for sure."],
  ["malignancy", "act", "Cancer."],
  ["incomplete", "info", "The review is not finished. More pictures or older pictures are needed."],
  ["unremarkable", "ok", "Normal. Nothing that needs to be pointed out."],
  ["benign", "ok", "Not cancer."],
  ["malignant", "act", "Cancer."],
  ["carcinoma", "act", "Cancer that starts in the cells that line the body's surfaces. Most breast cancers start this way."],
  ["ductal carcinoma in situ", "act", "DCIS stands for ductal carcinoma in situ. These are abnormal cells inside the milk ducts that have not spread into the tissue around them. Doctors call this stage 0."],
  ["DCIS", "act", "Short for ductal carcinoma in situ. These are abnormal cells that stay inside the milk ducts (stage 0)."],
  ["invasive", "act", "Cancer cells have grown out of the place where they started and into nearby tissue."],
];

export const QUESTIONS = {
  "0": [
    "What extra pictures do I need (more mammogram pictures or an ultrasound), and how soon?",
    "Do you need my older mammograms? Where should I ask for them to be sent?",
  ],
  "3": [
    "When exactly is my follow-up scan, and who will schedule it?",
    "What would make you suggest a biopsy instead of waiting?",
  ],
  "4": [
    "What kind of biopsy do I need, and how will they find the exact spot?",
    "How soon can it be done, and when and how will I get the results?",
    "Who should I call if I have not heard back?",
  ],
  "5": [
    "How soon can the biopsy be done, and who will explain the results with me?",
    "Should I ask for a referral to a breast specialist or a cancer center now?",
  ],
  "6": [
    "Who is on my care team, and what are the next steps in treatment planning?",
  ],
  dense: [
    "My breasts are dense. Would extra screening, such as an ultrasound or MRI, make sense for me?",
  ],
  // Neutral on purpose: it does not say the person has a family history. Their report did not necessarily mention one.
  family: [
    "If breast or ovarian cancer runs in my family, should I have a risk check or talk to a genetic counselor?",
  ],
  // Used only when the report itself states a family history.
  familyStated: [
    "Given the family history in my report, should I have a risk check or talk to a genetic counselor?",
  ],
};

// Fictional example reports for the demo (not real patients).
export const EXAMPLES = [
  {
    title: "Routine mammogram, called back",
    text: `EXAM: Bilateral screening mammogram with tomosynthesis.
COMPARISON: Prior exams from 2023 and 2024.
BREAST COMPOSITION: The breasts are heterogeneously dense, which may obscure small masses (density C).
FINDINGS: There is a focal asymmetry in the left breast at 2 o'clock, middle depth, seen on the CC and MLO views. No suspicious calcifications. No architectural distortion. The right breast is unremarkable.
IMPRESSION: Incomplete. Additional diagnostic mammographic views and possible ultrasound of the left breast are recommended.
BI-RADS 0: Incomplete. Need additional imaging evaluation.`,
  },
  {
    title: "Ultrasound, probably benign",
    text: `EXAM: Targeted ultrasound of the right breast.
FINDINGS: At the right breast 10 o'clock, 3 cm from the nipple, there is an oval, circumscribed, hypoechoic solid mass with parallel orientation measuring 0.9 x 0.5 x 0.7 cm. No posterior acoustic shadowing. No internal vascularity. Findings are most consistent with a fibroadenoma.
No suspicious axillary lymph nodes.
IMPRESSION: Probably benign right breast mass. Recommend short-interval follow-up ultrasound in 6 months.
BI-RADS 3: Probably benign.`,
  },
  {
    title: "Ultrasound, biopsy recommended",
    text: `EXAM: Diagnostic mammogram and ultrasound of the left breast.
BREAST COMPOSITION: Scattered areas of fibroglandular density (B).
FINDINGS: Ultrasound demonstrates an irregular hypoechoic mass with indistinct and angular margins in the left breast at 2 o'clock, 5 cm from the nipple, measuring 1.4 cm. The mass is not parallel to the skin and shows posterior acoustic shadowing. The left axillary lymph nodes appear normal.
IMPRESSION: Suspicious left breast mass. Ultrasound-guided core needle biopsy is recommended.
BI-RADS 4B: Moderate suspicion for malignancy.`,
  },
];
