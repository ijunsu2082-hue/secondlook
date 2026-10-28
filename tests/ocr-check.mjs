// Browser check for photo and PDF upload. Run: OUT=<empty dir> BASE=http://localhost:8000 node tests/ocr-check.mjs
// Needs playwright-core and Chrome. It makes its own fictional report picture and PDFs.
import { chromium } from "playwright-core";
import fs from "node:fs";
const dir = process.env.OUT;
const BASE = process.env.BASE || "http://localhost:8000";
const R = "SECOND LOOK IMAGING CENTER\nEXAM: Diagnostic ultrasound, right breast\nFINDINGS: Irregular hypoechoic mass, 9 mm, right breast, 2 o'clock, with posterior shadowing.\nIMPRESSION: BI-RADS 4A. Tissue sampling is suggested.";
const html = `<body style="font:22px Arial;padding:40px;width:900px">${R.split("\n").map((l) => `<p>${l}</p>`).join("")}</body>`;
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const mk = await (await b.newContext({ viewport: { width: 1000, height: 420 } })).newPage();
await mk.setContent(html);
await mk.screenshot({ path: dir + "/rep.png" });
await mk.pdf({ path: dir + "/rep-text.pdf" });
const png = fs.readFileSync(dir + "/rep.png").toString("base64");
await mk.setContent(`<body style="margin:0"><img src="data:image/png;base64,${png}" width="700"></body>`);
await mk.pdf({ path: dir + "/rep-scan.pdf" });
fs.writeFileSync(dir + "/not.txt", "hello");
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const ext = [], errs = [];
p.on("request", (r) => { if (!r.url().startsWith(BASE)) ext.push(r.url().slice(0, 60)); });
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
p.on("pageerror", (e) => errs.push(String(e)));
await p.goto(BASE + "/#report");
for (const f of ["rep.png", "rep-text.pdf", "rep-scan.pdf", "not.txt"]) {
  const t0 = Date.now();
  await p.setInputFiles("#report-file", dir + "/" + f);
  await p.waitForFunction(() => { const s = document.querySelector("#report-file-status"); return !s.hidden && !/\.\.\.$/.test(s.textContent); }, null, { timeout: 120000 });
  console.log("\n== " + f + " (" + ((Date.now() - t0) / 1000).toFixed(1) + "s)");
  console.log("STATUS:", await p.locator("#report-file-status").innerText());
  console.log("TEXT:", (await p.inputValue("#report-text")).replace(/\n+/g, " | ").slice(0, 300));
  console.log("BIRADS card:", /4A/.test(await p.locator("#report-out").innerText()), " warnings:", await p.locator("#sanity-h").count());
  if (f === "rep.png") await p.screenshot({ path: dir + "/ocr-shot.png", fullPage: true });
}
console.log("\nEXTERNAL REQUESTS:", ext.length, ext.slice(0, 5));
console.log("CONSOLE ERRORS:", errs);
await b.close();
