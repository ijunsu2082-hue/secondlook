// "How it works": what each part does, where the data and models come from, and what the limits are.
import { TERMS } from "./knowledge.js";
const $ = (s) => document.querySelector(s);
const pm = (o) => `${o.mean.toFixed(3)} ± ${o.std.toFixed(3)}`;
const a = (url, text) => `<a href="${url}" target="_blank" rel="noopener">${text}</a>`;

export async function initAbout() {
  const body = $("#about-body");
  let m;
  try {
    const r = await fetch("models/busi_model.json");
    if (!r.ok) throw new Error("missing");
    m = await r.json();
  } catch {
    body.innerHTML = `<div class="warn">This page could not load its details. Please refresh the page and try again.</div>`;
    return;
  }
  const cv = m.cv_summary;
  const comp = m.backbone_comparison
    ? `<h3 style="margin-top:18px">We tried three ways of reading the images</h3>
       <p class="muted">Same images, same test method. Only the part that first looks at the image changes.</p>
       <table><thead><tr><th>Image reader</th><th>Cancer vs not (AUC)</th><th>Right group (balanced)</th><th>Cancers found</th></tr></thead><tbody>
       ${Object.entries(m.backbone_comparison).map(([k, v]) => `<tr><td>${k.replace(/ \S ?deployed/, " (the one we use)").replace(/�/g, "")}</td><td class="num">${pm(v.malignant_auc)}</td>
         <td class="num">${pm(v.balanced_accuracy)}</td><td class="num">${pm(v.malignant_sensitivity)}</td></tr>`).join("")}
       </tbody></table>`
    : "";
  const cm = m.test_metrics.confusion_matrix;

  body.innerHTML = `
  <div class="card">
    <h3>How the pieces fit together</h3>
    <div class="flow"><span>You paste a report</span><b>→</b><span>The page explains it in your browser</span><b>→</b>
      <span>You ask questions in the chat</span><b>→</b><span>You leave with questions for your doctor</span></div>
    <p class="muted" style="margin-bottom:0"><b>What stays on your device:</b> explaining a report, the ultrasound demo, the symptom check and the biopsy lab all run in your browser.
      <b>What is sent out:</b> only the chat. When you send a question, your message and your report text go to our server, which passes them to OpenAI to write an answer.
      Our server does not store them. OpenAI may keep them for a short time under its own rules.</p>
  </div>

  <div class="about-grid" style="margin-top:18px">
    <div class="card">
      <h3>The chat assistant</h3>
      <p>The assistant is a ready-made language model from OpenAI. We did not train it or fine-tune it. Our work is the instructions we give it, which tell it to use plain words,
        to keep "your report says" apart from general information, to say when it does not know, and never to say whether you have cancer.
        Urgent words such as chest pain or a new lump also trigger a fixed safety message that does not depend on the model.</p>
      <p class="fine" style="margin-bottom:0">We wrote more than 100 test conversations to check its style and safety. They are in the project's <code>eval</code> folder.
        The assistant can still make mistakes, so please check anything important with your care team.</p>
    </div>
    <div class="card">
      <h3>Report explainer and symptom check</h3>
      <p>The report explainer uses fixed rules, not AI. It finds the BI-RADS number, breast density, clock position and size, and it explains ${TERMS.length} common report words.
        It also notices when a word is used as "no" something, such as "no calcifications".
        The symptom check follows published advice from the CDC, the American Cancer Society, the NHS and the U.S. Preventive Services Task Force.</p>
      <p class="fine" style="margin-bottom:0">Rules can miss unusual wording. Your original report always comes first.</p>
    </div>
  </div>

  <div class="about-grid" style="margin-top:18px">
    <div class="card">
      <h3>Ultrasound demo: where it comes from</h3>
      <p class="fine"><b>This is a research demo. It is not a medical test.</b></p>
      <table><tbody>
        <tr><th>Image reader</th><td>EfficientNet-B0, a public image model made by Google researchers (Tan and Le, 2019). We use the version trained on ImageNet photos that is shared in the open-source <code>timm</code> library. We did not build or train it.</td></tr>
        <tr><th>Images</th><td>The public BUSI set: 780 breast ultrasound images from 600 women aged 25 to 75, at Baheya Hospital in Cairo (${a("https://doi.org/10.1016/j.dib.2019.104863", "Al-Dhabyani et al., 2020")}).</td></tr>
        <tr><th>What we added</th><td>A small final step trained on top of the image reader (a method called logistic regression), a cleanup of copied images, a repeated testing method, a conversion so the model runs inside your browser, and the highlight map.</td></tr>
        <tr><th>Cleanup</th><td>Other researchers found copies of the same image in BUSI, some labeled both benign and malignant (${a("https://pmc.ncbi.nlm.nih.gov/articles/PMC10293973/", "Pawłowska et al., 2023")}).
          We looked for copies, kept each group of copies together when testing, and removed ${m.n_label_conflict_images_removed} images with conflicting labels. That left ${m.n_images_clean} images.</td></tr>
        <tr><th>Highlight map</th><td>Shows which parts of the image raised the score for a group the most. It shows where the model looked. It does not prove that a cancer is there.</td></tr>
      </tbody></table>
      <h3 style="margin-top:18px">Test results (average over 5 rounds, with spread)</h3>
      <table><tbody>
        <tr><td>Cancer vs not (1.0 is perfect, 0.5 is guessing)</td><td class="num">${pm(cv.malignant_auc)}</td></tr>
        <tr><td>Share of cancer images found</td><td class="num">${pm(cv.malignant_sensitivity)}</td></tr>
        <tr><td>Share of non-cancer images cleared</td><td class="num">${pm(cv.malignant_specificity)}</td></tr>
        <tr><td>Normal, benign or malignant: score across all three</td><td class="num">${pm(cv.macro_auc_ovr)}</td></tr>
        <tr><td>Normal, benign or malignant: share put in the right group</td><td class="num">${pm(cv.accuracy)}</td></tr>
        <tr><td>Cancer vs not, likely range for the true score</td><td class="num">${m.pooled_malignant_auc_95ci.map((x) => x.toFixed(3)).join(" to ")}</td></tr>
      </tbody></table>
      <p class="fine">The model in this app is from the first test round (${m.test_metrics.n} test images). In its table of answers, each row is the true group
        (normal, benign, malignant) and each number is how many images got each answer: ${cm.map((r) => "[" + r.join(", ") + "]").join(" ")}.
        The browser copy of the model gives the same answers as the original to within ${m.onnx_parity_max_abs_diff.toExponential(1)}.</p>
      ${comp}
    </div>

    <div class="card">
      <h3>Why our numbers are lower than many papers</h3>
      <p>Many papers report 95 to 98 out of 100 on this image set. That can look better than it is, because copies of the same image can end up in both the
        practice set and the test set, so the model partly remembers the answers. We kept copies together. When one 2026 model for this image set was tested on images
        from other hospitals, it dropped to about 86 to 88 out of 100. A cleaner public test made from the same images, BreastMNIST,
        reports a score of 0.901 for a standard model (${a("https://medmnist.com/", "MedMNIST v2")}). Our ${cv.malignant_auc.mean.toFixed(2)} is in a similar range.</p>
      <p class="fine"><b>An honest limit:</b> BUSI does not tell us which images came from the same woman. Images from one person may be on both sides of our test, so real results on new patients may be lower.</p>
      <h3 style="margin-top:18px">What professional breast AI looks like today</h3>
      <p class="fine">We checked these numbers against the papers and summaries linked here, but they are not our results. Some come from studies paid for by the company that makes the tool.</p>
      <table><thead><tr><th>System</th><th>What the study found</th></tr></thead><tbody>
        <tr><td>Transpara, MASAI trial, Sweden</td><td>About 106,000 women were randomly given AI-supported screening or the usual two-doctor reading. AI-supported screening found 29% more cancers (6.4 vs 5.0 per 1,000) and cut the number of screen readings by 44% (${a("https://www.thelancet.com/journals/landig/article/PIIS2589-7500(24)00267-X/fulltext", "Lancet Digital Health 2025")}). A follow-up report found that cancers appearing between screenings were not more common with AI (${a("https://www.sciencedirect.com/science/article/abs/pii/S014067362502464X", "Lancet 2026")}). It still needs at least one human doctor.</td></tr>
        <tr><td>Vara, PRAIM study, Germany</td><td>463,094 women in real screening. Cancers found: 6.7 vs 5.7 per 1,000, with no extra call-backs (${a("https://pmc.ncbi.nlm.nih.gov/articles/PMC11922743/", "Nature Medicine 2025")}). This study only observed, it did not run a trial.</td></tr>
        <tr><td>Lunit INSIGHT MMG</td><td>In a reader study that Lunit paid for, doctors scored 0.810 alone and 0.881 with AI help (${a("https://www.thelancet.com/pdfs/journals/landig/PIIS2589-7500(20)30003-0.pdf", "Lancet Digital Health 2020")}).</td></tr>
        <tr><td>Mirai</td><td>Estimates the risk of breast cancer over the next 1 to 5 years from one mammogram. Scores ranged from 0.75 to 0.84 across 7 hospitals in 5 countries (${a("https://pmc.ncbi.nlm.nih.gov/articles/PMC9148689/", "JCO 2022")}). Research software.</td></tr>
        <tr><td>Clairity Breast</td><td>The first FDA-authorized AI that predicts 5-year breast cancer risk from a mammogram (May 2025).</td></tr>
      </tbody></table>
      <p class="fine">These tools need full-size mammograms from the hospital system. SecondLook helps with a different step: understanding your report and knowing when to act.</p>
    </div>
  </div>

  <div class="card" style="margin-top:18px">
    <h3>Limits and safety</h3>
    <ul>
      <li>SecondLook is not a medical device. Never use it as a reason to see a doctor later than you would have.</li>
      <li>The ultrasound model only saw images from one hospital in one country. It will do worse on other machines.</li>
      <li>It looks at a whole image. It does not measure or find lumps in a way a doctor could rely on.</li>
      <li>The report explainer handles common U.S. report wording. Unusual wording may be missed.</li>
      <li>The chat assistant can be wrong. It cannot diagnose you or say that you do not have cancer.</li>
    </ul>
  </div>`;
}
