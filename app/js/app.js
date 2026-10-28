// Tab router and lazy initialisation of each section.
import { initReport } from "./report.js";
import { initScan } from "./scan.js";
import { initCheck } from "./check.js";
import { initLab } from "./lab.js";
import { initAbout } from "./about.js";

const TABS = ["home", "report", "scan", "check", "lab", "about"];
const INIT = { report: initReport, scan: initScan, check: initCheck, lab: initLab, about: initAbout };
const started = new Set();

function show(tab) {
  if (!TABS.includes(tab)) tab = "home";
  for (const t of TABS) document.getElementById(t).hidden = t !== tab;
  document.querySelectorAll(".tabs a").forEach((a) => a.toggleAttribute("aria-current", a.dataset.tab === tab));
  const active = document.querySelector(".tabs a[aria-current]");
  if (active) {
    active.setAttribute("aria-current", "page");
    const nav = active.parentElement;  // keep the active tab visible in the scrollable phone tab bar
    nav.scrollLeft = active.offsetLeft - nav.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
  }
  if (INIT[tab] && !started.has(tab)) {
    started.add(tab);
    Promise.resolve(INIT[tab]()).catch((e) => console.error(e));
  }
  const heading = document.querySelector("#" + tab + " h2");
  document.title = (heading ? heading.textContent.replace(/for learning/, "").trim() + " | " : "") + "SecondLook";
  if (started.has("navigated")) {
    const target = heading || document.getElementById("main");
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }
  started.add("navigated");
  window.scrollTo({ top: 0 });
}

document.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-tab]");
  if (!a) return;
  e.preventDefault();
  history.pushState(null, "", "#" + a.dataset.tab);
  show(a.dataset.tab);
});
window.addEventListener("popstate", () => show(location.hash.slice(1)));
show(location.hash.slice(1));
// Get the model ready in the background so the first result is quick.
setTimeout(() => { if (!started.has("scan")) { started.add("scan"); initScan(); } }, 800);
