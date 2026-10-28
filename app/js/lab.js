// Biopsy lab: logistic regression on the Wisconsin Diagnostic Breast Cancer
// measurements, explained as exact per-feature contributions.
import { esc } from "./report.js";

const $ = (s) => document.querySelector(s);
const BASE = {
  radius: "average distance from the center of the nucleus to its edge",
  texture: "how uneven the shades of gray inside the nucleus are",
  perimeter: "the length of the outline of the nucleus",
  area: "how big the nucleus is",
  smoothness: "how much the width changes around the outline",
  compactness: "how tightly packed the shape is (rounder nuclei score lower)",
  concavity: "how deep the dents in the outline are",
  "concave points": "how many dents the outline has",
  symmetry: "how evenly matched the two halves of the nucleus are",
  "fractal dimension": "how jagged the outline is, like a rough coastline",
};
let M, values, caseIdx = 0;

const pretty = (f) => {
  const kind = f.startsWith("mean ") ? "average" : f.startsWith("worst ") ? "highest 3" : "spread";
  const base = f.replace(/^(mean |worst )/, "").replace(/ error$/, "");
  return { base, kind, label: `${base[0].toUpperCase() + base.slice(1)} (${kind})` };
};

export async function initLab() {
  try {
    const r = await fetch("models/wdbc_model.json");
    if (!r.ok) throw new Error("missing");
    M = await r.json();
  } catch {
    $("#lab-out").innerHTML = `<div class="warn">The lab could not load its data. Please refresh the page and try again.</div>`;
    return;
  }
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
  $("#lab-sliders").innerHTML = `<p class="muted" style="font-size:14px;margin:12px 0 4px">Try it: change one average measurement and watch the answer move.</p>` +
    means.map(([f, j]) => `<div class="slider"><label for="s${j}" title="${esc(BASE[pretty(f).base])}">${esc(pretty(f).base)}</label>
      <input type="range" id="s${j}" data-j="${j}" min="${M.min[j]}" max="${M.max[j]}" step="${(M.max[j] - M.min[j]) / 200}" value="${values[j]}">
      <output id="o${j}">${fmt(values[j])}</output></div>`).join("") +
    `<button class="btn small" id="lab-reset" style="margin-top:10px">Go back to the real case</button>`;
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
      <h3>The model leans toward ${p >= 0.5 ? "malignant (cancer)" : "benign (not cancer)"}</h3><p style="margin:0 0 6px;font-size:14px">Its score for malignant is ${p < 0.001 ? "under 0.1" : p > 0.999 ? "over 99.9" : (p * 100).toFixed(1)} out of 100. This is a score from a small model. It is not the chance that a real person has cancer.</p>
      <div class="gauge" aria-hidden="true"><i style="left:${(p * 100).toFixed(1)}%"></i></div>
      <p style="margin:0;font-size:14px">${edited ? "You changed this case, so this is a what-if and not real data."
        : `This is a real case that was not used to teach the model (case ${esc(ex.id)}). The pathologist said it was <b>${esc(ex.truth)}</b>. ${(p >= 0.5) === (ex.truth === "malignant") ? "The model agrees." : "<b>The model gets this one wrong.</b> Models make mistakes."}`}</p>
    </div>
    <div class="card">
      <h3>Why? The 10 measurements that changed the answer most</h3>
      <p class="muted" style="font-size:13.5px;margin-top:0">Bars to the right push toward <span style="color:var(--act)">malignant</span>. Bars to the left push toward <span style="color:var(--ok)">benign</span>.
        Together with a starting value, they add up to the score above.</p>
      <div class="contrib">${top.map(([c, j]) => {
        const w = (Math.abs(c) / maxAbs) * 50;
        const { label, base } = pretty(M.features[j]);
        return `<span title="${esc(BASE[base])}">${esc(label)}</span><div class="bar-wrap"><div class="mid"></div>
          <div class="bar" style="${c >= 0 ? `left:50%` : `left:${50 - w}%`};width:${w}%;background:${c >= 0 ? "var(--act)" : "var(--ok)"}"></div></div>`;
      }).join("")}</div>
      <p class="fine">“Average” is the average over all the nuclei in the image. “Highest 3” is the average of the three largest values. “Spread” shows how much the values vary.
        Some measurements go together (radius, outline length and size), so look at the bars as a group, not one by one.</p>
    </div>
    <div class="card" style="margin-top:14px">
      <h3>How well does this model work?</h3>
      <div class="metrics">
        <div class="metric"><b>${(t.accuracy * 100).toFixed(1)}%</b><span>of ${t.n} new cases answered correctly</span></div>
        <div class="metric"><b>${(t.sensitivity * 100).toFixed(1)}%</b><span>of cancers found</span></div>
        <div class="metric"><b>${(t.specificity * 100).toFixed(1)}%</b><span>of benign cases correctly cleared</span></div>
      </div>
      <p class="fine" style="margin:0">A simple model (logistic regression) trained on the Wisconsin Diagnostic Breast Cancer dataset, which has 569 needle samples (Wolberg, Street and Mangasarian, UCI, 1995).
        We kept 20% of the cases aside to test it. This is a learning tool. It is not used for real diagnosis.</p>
    </div>`;
}
