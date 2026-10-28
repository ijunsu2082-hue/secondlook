// Ultrasound AI tab: on-device classification + Class Activation Map.
import { loadModel, classify, cam, drawCam, colourfulness, loadImage, drawImageFit } from "./ml.js";
import { esc } from "./report.js";

const $ = (s) => document.querySelector(s);
const COLORS = { normal: "var(--ok)", benign: "var(--watch)", malignant: "var(--act)" };
const LABEL = { normal: "Normal tissue", benign: "Benign lesion", malignant: "Malignant lesion" };
let model, samples, current = null;

export async function initScan() {
  const status = $("#scan-status");
  try {
    [model, samples] = await Promise.all([
      loadModel("models/busi_effnet_b0.onnx", "models/busi_model.json"),
      fetch("samples/samples.json").then((r) => r.json()),
    ]);
  } catch (e) {
    status.innerHTML = `Could not load the model (${esc(e.message)}). Serve this folder over http, e.g. <code>python3 -m http.server</code>.`;
    return;
  }
  status.textContent = "Model ready. Pick an image on the left.";
  $("#scan-samples").innerHTML = samples.map((s, i) =>
    `<button data-i="${i}" aria-pressed="false" title="Held-out test image ${i + 1}"><img src="${s.file}" alt="Test ultrasound ${i + 1}"></button>`).join("");
  $("#scan-samples").addEventListener("click", (e) => {
    const b = e.target.closest("[data-i]");
    if (!b) return;
    document.querySelectorAll("#scan-samples button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    run(samples[+b.dataset.i].file, samples[+b.dataset.i]);
  });

  const drop = $("#scan-drop"), file = $("#scan-file");
  const handle = (f) => {
    if (!f || !f.type.startsWith("image/")) return;
    document.querySelectorAll("#scan-samples button").forEach((x) => x.setAttribute("aria-pressed", false));
    const url = URL.createObjectURL(f);
    run(url, null).finally(() => URL.revokeObjectURL(url));
  };
  file.addEventListener("change", () => handle(file.files[0]));
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); handle(e.dataTransfer.files[0]); });
  $("#cam-opacity").addEventListener("input", () => current && paint());
}

async function run(src, sample) {
  const out = $("#scan-out");
  out.innerHTML = `<div class="empty">Analysing on this device…</div>`;
  let img;
  try {
    img = await loadImage(src);
  } catch (e) {
    out.innerHTML = `<div class="warn">${esc(e.message)}</div>`;
    return;
  }
  const t0 = performance.now();
  const res = await classify(model, img);
  const ms = performance.now() - t0;
  const classes = model.meta.classes;
  const top = res.probs.indexOf(Math.max(...res.probs));
  current = { img, res, k: top };
  paint();

  const colourful = colourfulness(img) > 0.12;
  const name = classes[top];
  const tone = name === "malignant" ? "act" : name === "benign" ? "watch" : "ok";
  const msg = {
    malignant: "The model found patterns that resemble the malignant lesions in its training images. Only a biopsy can tell whether a lesion is cancer.",
    benign: "The model found patterns that resemble benign lesions (for example cysts or fibroadenomas) in its training images.",
    normal: "The model did not find a lesion-like pattern. A normal-looking single image never rules out cancer.",
  }[name];

  let parity = "";
  if (sample) {
    const diff = Math.max(...sample.python_probs.map((p, i) => Math.abs(p - res.probs[i])));
    parity = `<p class="fine">Dataset label for this held-out test image: <b>${esc(sample.truth)}</b> (${esc(sample.source)}).
      The model never saw it during training. Browser result matches the Python reference within ${diff.toFixed(3)}.</p>`;
  }

  const m = model.meta;
  out.innerHTML = `
    ${colourful ? `<div class="warn"><b>This doesn’t look like a greyscale ultrasound.</b> The model was trained only on breast ultrasound images, so its answer for other pictures is meaningless.</div>` : ""}
    <div class="verdict ${tone}"><h3>Model’s best match: ${LABEL[name]}</h3><p style="margin:0">${msg}</p></div>
    <div class="probs">${classes.map((c, i) => `
      <div class="prob"><span>${c[0].toUpperCase() + c.slice(1)}</span>
        <div class="track"><div class="fill" style="width:${(res.probs[i] * 100).toFixed(1)}%;background:${COLORS[c]}"></div></div>
        <span class="val">${(res.probs[i] * 100).toFixed(1)}%</span></div>`).join("")}
    </div>
    <div class="row" role="group" aria-label="Heat map shows evidence for">
      <span class="muted" style="font-size:14px">Heat map shows evidence for:</span>
      ${classes.map((c, i) => `<button class="btn small" data-k="${i}" aria-pressed="${i === top}">${c}</button>`).join("")}
    </div>
    <p class="fine">The heat map (a Class Activation Map) shows which regions most increased the score for the selected class. It explains the model, not the anatomy.
      Analysed in ${ms.toFixed(0)} ms on this device.</p>
    ${parity}
    <div class="card" style="margin-top:14px">
      <h3>How good is this model?</h3>
      <div class="metrics">
        <div class="metric"><b>${m.cv_summary.malignant_auc.mean.toFixed(2)}</b><span>AUC, malignant vs not (5-fold CV)</span></div>
        <div class="metric"><b>${(m.cv_summary.malignant_sensitivity.mean * 100).toFixed(0)}%</b><span>of malignant images caught (sensitivity)</span></div>
        <div class="metric"><b>${(m.cv_summary.malignant_specificity.mean * 100).toFixed(0)}%</b><span>of non-malignant correctly cleared (specificity)</span></div>
      </div>
      <p class="fine" style="margin:0">Trained on ${m.n_images_clean} images from the public BUSI dataset (Cairo, 2018) after removing ${m.n_label_conflict_images_removed} duplicate images
        whose copies carried conflicting labels. Tested with grouped cross-validation so no duplicate crosses train and test.
        It would miss about ${Math.round((1 - m.cv_summary.malignant_sensitivity.mean) * 100)} in 100 malignant images — that is why it is a learning tool, not a screening test.
        See <a href="#about" data-tab="about">How it works</a>.</p>
    </div>`;
  out.querySelectorAll("[data-k]").forEach((b) => b.addEventListener("click", () => {
    current.k = +b.dataset.k;
    out.querySelectorAll("[data-k]").forEach((x) => x.setAttribute("aria-pressed", x === b));
    paint();
  }));
}

function paint() {
  const canvas = $("#scan-canvas");
  drawImageFit(canvas, current.img);
  drawCam(canvas, cam(model, current.res, current.k), +$("#cam-opacity").value);
}
