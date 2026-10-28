// "How it works": methods, model card and the research behind the design.
import { TERMS } from "./knowledge.js";
const $ = (s) => document.querySelector(s);
const pct = (v) => (v * 100).toFixed(1) + "%";
const pm = (o) => `${o.mean.toFixed(3)} ± ${o.std.toFixed(3)}`;
const a = (url, text) => `<a href="${url}" target="_blank" rel="noopener">${text}</a>`;

export async function initAbout() {
  const m = await fetch("models/busi_model.json").then((r) => r.json());
  const cv = m.cv_summary;
  const comp = m.backbone_comparison
    ? `<h3 style="margin-top:18px">Which image backbone works best?</h3>
       <p class="muted">Same data, same grouped 5-fold protocol, only the frozen feature extractor changes.</p>
       <table><thead><tr><th>Backbone</th><th>Malignant AUC</th><th>Balanced accuracy</th><th>Sensitivity</th></tr></thead><tbody>
       ${Object.entries(m.backbone_comparison).map(([k, v]) => `<tr><td>${k}</td><td class="num">${pm(v.malignant_auc)}</td>
         <td class="num">${pm(v.balanced_accuracy)}</td><td class="num">${pm(v.malignant_sensitivity)}</td></tr>`).join("")}
       </tbody></table>`
    : "";
  const cm = m.test_metrics.confusion_matrix;

  $("#about-body").innerHTML = `
  <div class="card">
    <h3>The pipeline</h3>
    <div class="flow"><span>Your image or text</span><b>→</b><span>Runs in this browser tab (ONNX Runtime Web / JavaScript)</span><b>→</b>
      <span>Plain-language result + sources</span><b>→</b><span>A clear next step</span></div>
    <p class="muted" style="margin-bottom:0">There is no server. Images and reports never leave the device, which matters for health data and lets the tool work on a low-cost phone or laptop.</p>
  </div>

  <div class="about-grid" style="margin-top:18px">
    <div class="card">
      <h3>Ultrasound AI — model card</h3>
      <table><tbody>
        <tr><th>Data</th><td>BUSI: 780 breast ultrasound images of 600 women aged 25–75, Baheya Hospital, Cairo (${a("https://doi.org/10.1016/j.dib.2019.104863", "Al-Dhabyani et al., 2020")}).</td></tr>
        <tr><th>Cleaning</th><td>A published audit found duplicates in BUSI, some filed as both benign and malignant (${a("https://pmc.ncbi.nlm.nih.gov/articles/PMC10293973/", "Pawłowska et al., 2023")}).
          We find near-duplicates with a pixel hash plus deep-feature similarity, keep each duplicate group on one side of every split, and remove
          ${m.n_label_conflict_images_removed} images whose copies have conflicting labels → ${m.n_images_clean} images.</td></tr>
        <tr><th>Model</th><td>EfficientNet-B0 pretrained on ImageNet (frozen) + logistic regression on its pooled features (“linear probe”). 16 MB, ~0.4 GFLOPs.</td></tr>
        <tr><th>Validation</th><td>5-fold stratified, duplicate-grouped cross-validation; regularisation chosen inside each training fold.</td></tr>
        <tr><th>Explainability</th><td>Class Activation Map computed exactly from the final feature map and classifier weights.</td></tr>
      </tbody></table>
      <h3 style="margin-top:18px">Results (mean ± SD over 5 folds)</h3>
      <table><tbody>
        <tr><td>Malignant vs not — AUC</td><td class="num">${pm(cv.malignant_auc)}</td></tr>
        <tr><td>Malignant sensitivity</td><td class="num">${pm(cv.malignant_sensitivity)}</td></tr>
        <tr><td>Malignant specificity</td><td class="num">${pm(cv.malignant_specificity)}</td></tr>
        <tr><td>3-class macro AUC</td><td class="num">${pm(cv.macro_auc_ovr)}</td></tr>
        <tr><td>3-class accuracy</td><td class="num">${pm(cv.accuracy)}</td></tr>
        <tr><td>Pooled malignant AUC, 95% bootstrap CI</td><td class="num">${m.pooled_malignant_auc_95ci.map((x) => x.toFixed(3)).join(" – ")}</td></tr>
      </tbody></table>
      <p class="fine">Deployed model = fold 1 (test n = ${m.test_metrics.n}). Confusion matrix (rows = truth normal/benign/malignant): ${cm.map((r) => "[" + r.join(", ") + "]").join(" ")}.
        The exported ONNX model reproduces the trained model to within ${m.onnx_parity_max_abs_diff.toExponential(1)}; the browser’s own image resizing shifts probabilities by at most 0.02 on the 6 demo images.</p>
      ${comp}
    </div>

    <div class="card">
      <h3>Why our accuracy is lower than many papers — on purpose</h3>
      <p>Single-dataset BUSI papers often report 95–98% accuracy, but when duplicates are allowed on both sides of a split, the test is partly a memory test.
        When one 2026 BUSI model was tested on other hospitals’ ultrasound data, it fell to about 86–88%. A cleaner public benchmark built from the same images, BreastMNIST,
        reports AUC 0.901 for ResNet-18 (${a("https://medmnist.com/", "MedMNIST v2")}). Our ${cv.malignant_auc.mean.toFixed(2)} AUC is in that honest range.</p>
      <h3 style="margin-top:18px">What clinical-grade breast AI looks like today</h3>
      <table><thead><tr><th>System</th><th>Evidence</th></tr></thead><tbody>
        <tr><td>Transpara — MASAI randomised trial, Sweden</td><td>105,934 women. AI-supported screening found 29% more cancers (6.4 vs 5.0 per 1,000) with 44% less radiologist reading work; sensitivity 80.5% vs 73.8% (${a("https://pubmed.ncbi.nlm.nih.gov/39904652/", "Lancet Digit Health 2025")}; ${a("https://pubmed.ncbi.nlm.nih.gov/41620232/", "Lancet 2026")}).</td></tr>
        <tr><td>Vara — PRAIM study, Germany</td><td>463,094 women in real-world screening: detection 6.7 vs 5.7 per 1,000 (+17.6%) without more recalls (${a("https://pmc.ncbi.nlm.nih.gov/articles/PMC11922743/", "Nature Medicine 2025")}; observational).</td></tr>
        <tr><td>Lunit INSIGHT MMG</td><td>Standalone AUROC 0.959; radiologists improved from 0.810 to 0.881 with AI (${a("https://pubmed.ncbi.nlm.nih.gov/33334578/", "Lancet Digit Health 2020")}). FDA-cleared.</td></tr>
        <tr><td>Mirai — forecasting future cancer</td><td>Predicts 5-year risk from one mammogram; C-index 0.75–0.84 across 7 sites in 5 countries (${a("https://pmc.ncbi.nlm.nih.gov/articles/PMC9148689/", "JCO 2022")}). Open-source (MIT), research use only.</td></tr>
        <tr><td>Clairity Breast</td><td>First FDA-authorised (De Novo DEN240047, May 30 2025) AI that predicts 5-year breast cancer risk from a mammogram.</td></tr>
      </tbody></table>
      <p class="fine">These systems need full-resolution mammograms (e.g. Mirai: four DICOM views at 1664×2048) and are commercial or research-only — SecondLook is designed for the
        step around them: understanding the report and knowing when to act.</p>
    </div>
  </div>

  <div class="about-grid" style="margin-top:18px">
    <div class="card">
      <h3>Report decoder &amp; symptom checker</h3>
      <p>Deterministic rules, not a chatbot: regular expressions find the BI-RADS category, density, clock-face location and size; a curated glossary of
        ${TERMS.length} terms explains each word, with negation detection (“no calcifications”). Every rule cites the ACR BI-RADS Atlas, ACS, CDC, NHS, NICE NG12,
        FDA or USPSTF. Nothing is generated, so nothing can be made up.</p>
    </div>
    <div class="card">
      <h3>Limits &amp; safety</h3>
      <ul>
        <li>Not a medical device; never use it to decide whether to see a doctor <i>less</i>.</li>
        <li>The ultrasound model saw one hospital’s images from one country; results on other machines will be worse.</li>
        <li>It classifies whole images; it does not measure or locate lesions for clinical use.</li>
        <li>Report parsing handles common U.S. report wording; unusual phrasing may be missed — the original report always wins.</li>
      </ul>
    </div>
  </div>`;
}
