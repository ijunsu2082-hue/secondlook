// Biopsy lab: logistic regression on the Wisconsin Diagnostic Breast Cancer
// measurements, explained as exact per-feature contributions.
import { esc } from "./report.js";

const $ = (s) => document.querySelector(s);
const BASE = {
  radius: "average distance from the centre of the nucleus to its edge",
  texture: "how uneven the grey levels inside the nucleus are",
  perimeter: "length of the nucleus outline",
  area: "size of the nucleus",
  smoothness: "how much the radius varies around the outline",
  compactness: "perimeter² ÷ area − 1 (rounder nuclei score lower)",
  concavity: "how deep the inward dents in the outline are",
  "concave points": "how many inward dents the outline has",
  symmetry: "how mirror-symmetric the nucleus is",
  "fractal dimension": "how jagged the outline is (“coastline” measure)",
};
let M, values, caseIdx = 0;

const pretty = (f) => {
  const kind = f.startsWith("mean ") ? "average" : f.startsWith("worst ") ? "worst 3" : "variability";
  const base = f.replace(/^(mean |worst )/, "").replace(/ error$/, "");
  return { base, kind, label: `${base[0].toUpperCase() + base.slice(1)} (${kind})` };
};

export async function initLab() {
  M = await fetch("models/wdbc_model.json").then((r) => r.json());
  $("#lab-cases").innerHTML = M.examples.map((e, i) =>
    `<button class="btn small" data-c="${i}" aria-pressed="${i === 0}">Case ${i + 1}</button>`).join("");
  $("#lab-cases").addEventListener("click", (e) => {
    const b = e.target.closest("[data-c]");
    if (!b) return;
    document.querySelectorAll("#lab-cases button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    pick(+b.dataset.c);
  });
  pick(0);
}

function pick(i) {
  caseIdx = i;
  values = [...M.examples[i].values];
  const means = M.features.map((f, j) => [f, j]).filter(([f]) => f.startsWith("mean "));
  $("#lab-sliders").innerHTML = `<p class="muted" style="font-size:14px;margin:12px 0 4px">What-if: change one average measurement and watch the result move.</p>` +
    means.map(([f, j]) => `<div class="slider"><label for="s${j}" title="${esc(BASE[pretty(f).base])}">${esc(pretty(f).base)}</label>
      <input type="range" id="s${j}" data-j="${j}" min="${M.min[j]}" max="${M.max[j]}" step="${(M.max[j] - M.min[j]) / 200}" value="${values[j]}">
      <output id="o${j}">${fmt(values[j])}</output></div>`).join("") +
    `<button class="btn small" id="lab-reset" style="margin-top:10px">Reset to real case</button>`;
  $("#lab-sliders").querySelectorAll("input").forEach((el) => el.addEventListener("input", () => {
    values[+el.dataset.j] = +el.value;
    $("#o" + el.dataset.j).textContent = fmt(+el.value);
    render();
  }));
  $("#lab-reset").addEventListener("click", () => pick(caseIdx));
  render();
}

const fmt = (v) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(2) : v.toFixed(4));

function render() {
  const contrib = values.map((v, j) => ((v - M.mean[j]) / M.scale[j]) * M.coef[j]);
  const z = contrib.reduce((a, b) => a + b, M.intercept);
  const p = 1 / (1 + Math.exp(-z));
  const ex = M.examples[caseIdx];
  const edited = values.some((v, j) => Math.abs(v - ex.values[j]) > 1e-9);
  const top = contrib.map((c, j) => [c, j]).sort((a, b) => Math.abs(b[0]) - Math.abs(a[0])).slice(0, 10);
  const maxAbs = Math.max(...top.map(([c]) => Math.abs(c)), 1e-6);
  const tone = p >= 0.5 ? "act" : "ok";
  const t = M.test_metrics;

  $("#lab-out").innerHTML = `
    <div class="verdict ${tone}">
      <h3>${p >= 0.5 ? "Leans malignant" : "Leans benign"} — ${p < 0.001 ? "<0.1" : p > 0.999 ? ">99.9" : (p * 100).toFixed(1)}% malignant</h3>
      <div class="gauge" aria-hidden="true"><i style="left:${(p * 100).toFixed(1)}%"></i></div>
      <p style="margin:0;font-size:14px">${edited ? "You changed this case — this is a what-if, not real data."
        : `Real held-out case ${esc(ex.id)}. Pathologist’s diagnosis: <b>${esc(ex.truth)}</b>. ${(p >= 0.5) === (ex.truth === "malignant") ? "The model agrees." : "<b>The model gets this one wrong</b> — a reminder that models make mistakes."}`}</p>
    </div>
    <div class="card">
      <h3>Why? The 10 measurements that moved the answer most</h3>
      <p class="muted" style="font-size:13.5px;margin-top:0">Bars to the right push toward <span style="color:var(--act)">malignant</span>, to the left toward <span style="color:var(--ok)">benign</span>.
        They add up (with a starting value) to the score above.</p>
      <div class="contrib">${top.map(([c, j]) => {
        const w = (Math.abs(c) / maxAbs) * 50;
        const { label, base } = pretty(M.features[j]);
        return `<span title="${esc(BASE[base])}">${esc(label)}</span><div class="bar-wrap"><div class="mid"></div>
          <div class="bar" style="${c >= 0 ? `left:50%` : `left:${50 - w}%`};width:${w}%;background:${c >= 0 ? "var(--act)" : "var(--ok)"}"></div></div>`;
      }).join("")}</div>
      <p class="fine">“Average” = mean over all nuclei in the image; “worst 3” = mean of the three largest values; “variability” = standard error.
        Several measurements are strongly related (radius, perimeter, area), so read the bars as a group, not one by one.</p>
    </div>
    <div class="card" style="margin-top:14px">
      <h3>Model card</h3>
      <div class="metrics">
        <div class="metric"><b>${(t.accuracy * 100).toFixed(1)}%</b><span>accuracy on ${t.n} held-out cases</span></div>
        <div class="metric"><b>${(t.sensitivity * 100).toFixed(1)}%</b><span>sensitivity (cancers caught)</span></div>
        <div class="metric"><b>${(t.specificity * 100).toFixed(1)}%</b><span>specificity (benign cleared)</span></div>
      </div>
      <p class="fine" style="margin:0">Logistic regression on the Wisconsin Diagnostic Breast Cancer dataset (569 fine-needle aspirates; Wolberg, Street &amp; Mangasarian, UCI 1995).
        AUC ${t.auc.toFixed(3)} on the held-out 20%; 97.9% mean accuracy in 5×10-fold cross-validation, comparable to an SVM and better than random forest or
        gradient boosting in our comparison.</p>
    </div>`;
}
