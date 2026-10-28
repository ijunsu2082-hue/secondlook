// Ultrasound demo tab: the image is classified in the browser and a highlight map shows where the model looked.
import { loadModel, classify, cam, drawCam, colourfulness, loadImage, drawImageFit } from "./ml.js";
import { esc } from "./report.js";

const $ = (s) => document.querySelector(s);
const COLORS = { normal: "var(--ok)", benign: "var(--watch)", malignant: "var(--act)" };
const LABEL = { normal: "Normal tissue", benign: "Benign (not cancer)", malignant: "Malignant (cancer)" };
const MAX_BYTES = 15 * 1024 * 1024;
let model, samples, current = null;

export async function initScan() {
  const status = $("#scan-status");
  try {
    [model, samples] = await Promise.all([
      loadModel("models/busi_effnet_b0.onnx", "models/busi_model.json"),
      fetch("samples/samples.json").then((r) => { if (!r.ok) throw new Error("sample list missing"); return r.json(); }),
    ]);
  } catch (e) {
    status.innerHTML = `The model could not load (${esc(e.message)}). Please refresh the page. If you are running this on your own computer, open it through a local web server, not by double-clicking the file.`;
    return;
  }
  status.textContent = "The model is ready. Pick a sample image or upload your own.";
  $("#scan-samples").innerHTML = samples.map((s, i) =>
    `<button data-i="${i}" aria-pressed="false" title="Sample ultrasound ${i + 1}"><img src="${s.file}" alt="Sample ultrasound ${i + 1}"></button>`).join("");
  $("#scan-samples").addEventListener("click", (e) => {
    const b = e.target.closest("[data-i]");
    if (!b) return;
    document.querySelectorAll("#scan-samples button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    run(samples[+b.dataset.i].file, samples[+b.dataset.i]);
  });

  const drop = $("#scan-drop"), file = $("#scan-file");
  const handle = (f) => {
    if (!f) return;
    const out = $("#scan-out");
    if (!f.type.startsWith("image/")) {
      out.innerHTML = `<div class="warn">That file is not an image. Please choose a picture file such as a PNG or JPG.</div>`;
      return;
    }
    if (f.size > MAX_BYTES) {
      out.innerHTML = `<div class="warn">That image is too large (over 15 MB). Please choose a smaller one.</div>`;
      return;
    }
    document.querySelectorAll("#scan-samples button").forEach((x) => x.setAttribute("aria-pressed", false));
    const url = URL.createObjectURL(f);
    run(url, null).finally(() => URL.revokeObjectURL(url));
  };
  file.addEventListener("change", () => { handle(file.files[0]); file.value = ""; });
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); handle(e.dataTransfer.files[0]); });
  $("#cam-opacity").addEventListener("input", () => current && paint());
}

async function run(src, sample, force = false) {
  const out = $("#scan-out");
  if (!model) {
    out.innerHTML = `<div class="warn">The model is not ready yet. Please wait a moment and try again.</div>`;
    return;
  }
  out.innerHTML = `<div class="empty">Looking at the image on your device...</div>`;
  let img;
  try {
    img = await loadImage(src);
  } catch {
    out.innerHTML = `<div class="warn">I could not read that image. Please try a different file.</div>`;
    return;
  }
  const colourful = colourfulness(img) > 0.12;
  if (colourful && !force) {
    drawImageFit($("#scan-canvas"), img);
    current = null;
    out.innerHTML = `<div class="warn"><b>This does not look like a black and white ultrasound.</b> The model only learned from breast ultrasound images, so its answer for other pictures would mean nothing.
      <div class="row" style="margin-top:8px"><button class="btn small" id="scan-force">Show the result anyway</button></div></div>`;
    $("#scan-force").addEventListener("click", () => run(src, sample, true));
    return;
  }
  const t0 = performance.now();
  let res;
  try {
    res = await classify(model, img);
  } catch {
    out.innerHTML = `<div class="warn">Something went wrong while the model looked at this image. Please try another image or refresh the page.</div>`;
    return;
  }
  const ms = performance.now() - t0;
  const classes = model.meta.classes;
  const top = res.probs.indexOf(Math.max(...res.probs));
  current = { img, res, k: top };
  paint();

  const name = classes[top];
  const tone = name === "malignant" ? "act" : name === "benign" ? "watch" : "ok";
  const msg = {
    malignant: "This image looks most like the cancer images the model learned from. Only a biopsy can show whether something is cancer.",
    benign: "This image looks most like the benign images the model learned from, such as fluid-filled sacs (cysts) or harmless lumps (fibroadenomas). Benign means not cancer.",
    normal: "The model did not see a lump-like pattern. One image that looks normal can never rule out cancer.",
  }[name];

  let parity = "";
  if (sample) {
    parity = `<p class="fine">This sample was set aside and not used to teach the model. The dataset labels it <b>${esc(sample.truth)}</b> (${esc(sample.source)}).</p>`;
  }

  const m = model.meta;
  const miss = Math.round((1 - m.cv_summary.malignant_sensitivity.mean) * 100);
  out.innerHTML = `
    <div class="verdict ${tone}"><h3>Closest match: ${LABEL[name]}</h3><p style="margin:0">${msg}</p></div>
    <div class="probs">${classes.map((c, i) => `
      <div class="prob"><span>${c[0].toUpperCase() + c.slice(1)}</span>
        <div class="track"><div class="fill" style="width:${(res.probs[i] * 100).toFixed(1)}%;background:${COLORS[c]}"></div></div>
        <span class="val">${(res.probs[i] * 100).toFixed(1)}%</span></div>`).join("")}
    </div>
    <p class="fine">These percentages show how much the image looks like each group. They are not the chance that you have cancer.</p>
    <div class="row" role="group" aria-label="Highlight map for">
      <span class="muted" style="font-size:14px">Show the highlight map for:</span>
      ${classes.map((c, i) => `<button class="btn small" data-k="${i}" aria-pressed="${i === top}">${c}</button>`).join("")}
    </div>
    <p class="fine">The colored highlight shows which parts of the image pushed the score for the chosen group up the most. It shows where the model looked.
      It does not show where a cancer is, and it does not prove that one is there. Took ${ms.toFixed(0)} ms on your device.</p>
    ${parity}
    <div class="card" style="margin-top:14px">
      <h3>How well does this model work?</h3>
      <div class="metrics">
        <div class="metric"><b>${(m.cv_summary.accuracy.mean * 100).toFixed(0)}%</b><span>of images put in the right group (normal, benign or malignant)</span></div>
        <div class="metric"><b>${(m.cv_summary.malignant_sensitivity.mean * 100).toFixed(0)}%</b><span>of cancer images it found. It missed about ${miss} in 100.</span></div>
        <div class="metric"><b>${(m.cv_summary.malignant_specificity.mean * 100).toFixed(0)}%</b><span>of images without cancer it correctly cleared</span></div>
      </div>
      <p class="fine" style="margin:0">These numbers come from our own test on the public BUSI image set, which has ${m.n_images_clean} usable images from one hospital in Cairo.
        We took out ${m.n_label_conflict_images_removed} images whose copies had different labels, and we kept copies of the same picture together when testing.
        BUSI does not say which images came from the same woman, so the real results on new patients could be lower.
        This is a research demo, not a medical test. See <a href="#about" data-tab="about">How it works</a> for the details.</p>
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
  canvas.setAttribute("aria-label", `Ultrasound image with a colored highlight map for the ${model.meta.classes[current.k]} group`);
}
