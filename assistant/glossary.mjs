// Fixed, hand-written definitions for medical words. If an assistant reply uses one of these
// words and does not explain it, the server adds the definition below to the answer.
// `re` finds the word, `cue` is what an explanation in the reply would look like.
export const TERM_DEFS = [
  { name: "mammogram", re: /\bmammogra(m|phy)s?\b/i, cue: /x-?ray/i,
    def: "An X-ray picture of the breast. It can show changes too small to feel." },
  { name: "ultrasound", re: /\bultrasounds?\b/i, cue: /sound/i,
    def: "A picture made with sound waves. It can show whether a lump is solid or filled with fluid." },
  { name: "biopsy", re: /\bbiops(y|ies)\b/i, cue: /(tiny|small|piece|sample|tissue)/i,
    def: "A test that takes a tiny piece of tissue, usually with a needle, so a doctor can look at it under a microscope." },
  { name: "radiologist", re: /\bradiologists?\b/i, cue: /(doctors?|reads?|pictures|images)/i,
    def: "A doctor who reads X-rays, ultrasounds and other pictures, and writes the report." },
  { name: "pathologist", re: /\bpathologists?\b/i, cue: /doctor/i,
    def: "A doctor who studies tissue from a biopsy under a microscope to find out what it is." },
  { name: "benign", re: /\bbenign\b/i, cue: /not cancer|harmless|non-?cancer/i,
    def: "Not cancer." },
  { name: "malignant", re: /\bmalignan(t|cy)\b/i, cue: /cancer/i,
    def: "Cancer." },
  { name: "BI-RADS", re: /\bBI-?RADS\b/i, cue: /(score|0 to 6|scale|sum up|rating)/i,
    def: "A score from 0 to 6 that radiologists use to sum up what they saw and what should happen next." },
  { name: "MRI", re: /\bMRI\b/i, cue: /(magnet|scan)/i,
    def: "A scan that uses magnets and radio waves to make detailed pictures." },
  { name: "calcifications", re: /\bcalcifications?\b/i, cue: /(calcium|specks|deposits)/i,
    def: "Tiny specks of calcium in the breast. Most are harmless. Some patterns need a closer look." },
  { name: "lymph node", re: /\blymph nodes?\b/i, cue: /(gland|immune)/i,
    def: "A small bean-shaped gland that is part of your immune system. Some are under the arm." },
  { name: "fibroadenoma", re: /\bfibroadenomas?\b/i, cue: /(lump|not cancer|harmless|benign)/i,
    def: "A common lump that is not cancer. It is made of gland and connective tissue." },
  { name: "tomosynthesis", re: /\btomosynthesis\b/i, cue: /(3D|slices|layers)/i,
    def: "A kind of mammogram that takes many thin X-ray slices of the breast. It is often called 3D mammography." },
  { name: "DCIS", re: /\bDCIS\b/, cue: /(milk duct|early|not spread|ductal)/i,
    def: "Short for ductal carcinoma in situ. These are abnormal cells that stay inside the milk ducts and have not spread." },
  { name: "BRCA", re: /\bBRCA/, cue: /gene/i,
    def: "BRCA1 and BRCA2 are genes that help protect against cancer. A harmful change in them raises the chance of breast and ovarian cancer." },
];

// Words used in `reply` that it never explained and that the person has not been shown yet.
export function missingDefinitions(reply, known = []) {
  const seen = new Set(known);
  return TERM_DEFS
    .filter((d) => d.re.test(reply) && !d.cue.test(reply) && !seen.has(d.name))
    .map((d) => ({ term: d.name, def: d.def }));
}
