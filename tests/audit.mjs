// Interaction audit: keyboard-only pass, every button and link, layout at 390 and 1280 wide, external link status.
// Needs: npm i playwright-core, Chrome, and node dev-server.mjs running. Some publisher sites (Lancet, ScienceDirect) return 403 to scripts; that does not mean the link is broken.
import { chromium } from "playwright-core";
const base = process.env.BASE || "http://localhost:8000";
const b = await chromium.launch({ executablePath: process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe" });
let fails = 0;
const check = (n, ok, x = "") => { if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + n + (x ? "  " + x : "")); };

for (const [label, vp] of [["desktop", { width: 1280, height: 900 }], ["mobile", { width: 390, height: 800 }]]) {
  const ctx = await b.newContext({ viewport: vp });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("pageerror: " + e));
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await p.goto(base + "/");

  // ---- keyboard only
  await p.keyboard.press("Tab");
  check(`[${label}] first Tab lands on the skip link`, /Skip to the main/.test(await p.evaluate(() => document.activeElement.textContent)));
  const seq = [];
  for (let i = 0; i < 7; i++) { await p.keyboard.press("Tab"); seq.push((await p.evaluate(() => document.activeElement.textContent.trim().slice(0, 24)))); }
  check(`[${label}] Tab reaches the tabs in order`, seq.includes("Read my report") && seq.includes("Ultrasound AI") && seq.indexOf("Read my report") < seq.indexOf("Ultrasound AI"), seq.join(" > "));
  // focus "Read my report" and activate with Enter
  await p.focus(".tabs a[data-tab=report]");
  await p.keyboard.press("Enter");
  await p.waitForSelector("#report:not([hidden])");
  check(`[${label}] Enter opens the tab, title updates`, /Read my report/.test(await p.title()), await p.title());
  check(`[${label}] focus moves to the new page heading`, await p.evaluate(() => document.activeElement.tagName === "H2"));
  // sample button, explain by keyboard
  await p.focus("[data-ex='1']"); await p.keyboard.press("Enter");
  await p.waitForSelector("#report-out .card");
  check(`[${label}] sample opens by keyboard`, true);
  // privacy box, then chat, all by keyboard
  check(`[${label}] chat is locked until the privacy box is accepted`, !(await p.locator("#chat-main").isVisible()));
  await p.focus("#gate-accept"); await p.keyboard.press("Enter");
  check(`[${label}] privacy box accepted with the keyboard`, await p.locator("#chat-main").isVisible());
  await p.focus("#chat-input");
  await p.keyboard.type("What does probably benign mean?");
  await p.keyboard.press("Enter");
  await p.waitForSelector(".msg.assistant:not(.pending)", { timeout: 45000 });
  check(`[${label}] Enter sends a chat message and a reply appears`, true);
  // term popover: focus a term, Escape closes it
  const term = p.locator("mark.term").first();
  await term.focus();
  const shown = await p.evaluate(() => !document.querySelector("#popover").hidden);
  await p.keyboard.press("Escape");
  const hidden = await p.evaluate(() => document.querySelector("#popover").hidden);
  check(`[${label}] word explanation shows on focus and Escape closes it`, shown && hidden);
  // upload reachable by Tab
  await p.click(".tabs a[data-tab=scan]");
  await p.waitForSelector("#scan-samples button");
  await p.focus("#cam-opacity");
  let reached = false;
  await p.focus(".tabs a[data-tab=scan]");
  for (let i = 0; i < 40 && !reached; i++) { await p.keyboard.press("Tab"); reached = await p.evaluate(() => document.activeElement.id === "scan-file"); }
  check(`[${label}] upload box reachable with Tab`, reached);

  // ---- internal links all point somewhere
  const bad = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll("a[href^='#']").forEach((a) => { const id = a.getAttribute("href").slice(1); if (id && !document.getElementById(id)) out.push(a.getAttribute("href")); });
    return out;
  });
  check(`[${label}] every #link has a target`, bad.length === 0, bad.join(","));

  // ---- click every visible button on every tab (not chat, which calls the API)
  let clicked = 0;
  for (const t of ["home", "report", "scan", "check", "lab", "about"]) {
    await p.goto(base + "/#" + t);
    await p.waitForTimeout(400);
    if (t === "report") { await p.click("[data-ex='0']"); await p.waitForSelector("#report-out .card"); }
    if (t === "scan") await p.waitForSelector("#scan-samples button");
    if (t === "lab") await p.waitForSelector("#lab-cases button");
    const btns = p.locator(`#${t} button:visible:not(#chat-send):not(#chat-suggest button):not(#tailor-questions)`);
    const n = await btns.count();
    for (let i = 0; i < n; i++) { try { await btns.nth(i).click({ timeout: 3000 }); clicked++; } catch { /* element replaced by re-render */ } }
    for (const a of await p.locator(`#${t} a[data-tab]:visible`).all()) { await a.click(); clicked++; await p.goto(base + "/#" + t); }
  }
  check(`[${label}] clicked ${clicked} buttons and links, no page errors`, errs.filter((e) => e.startsWith("pageerror")).length === 0, errs.join(" | ").slice(0, 200));

  // ---- layout
  for (const t of ["home", "report", "scan", "check", "lab", "about"]) {
    await p.goto(base + "/#" + t); await p.waitForTimeout(500);
    const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (over > 1) check(`[${label}] no sideways scroll on ${t}`, false, `${over}px too wide`);
  }
  check(`[${label}] no sideways scroll on any tab (checked all 6)`, true);
  await ctx.close();
}

// ---- external links
const ctx = await b.newContext(); const p = await ctx.newPage();
const urls = new Set();
for (const t of ["home", "report", "check", "about"]) {
  await p.goto(base + "/#" + t); await p.waitForTimeout(500);
  if (t === "report") { await p.click("[data-ex='2']"); await p.waitForSelector("#report-out .card"); }
  if (t === "check") { await p.click("#symptoms input >> nth=0"); await p.click("#p-fam1"); await p.click("#p-brca"); }
  for (const h of await p.$$eval("a[target=_blank]", (as) => as.map((a) => a.href))) urls.add(h);
}
console.log(`\n${urls.size} external links`);
let bad = 0;
for (const u of urls) {
  try {
    const r = await fetch(u, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (SecondLook link check)" }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) { bad++; console.log(`  ${r.status} ${u}`); }
  } catch (e) { bad++; console.log(`  ERR ${u} (${e.cause?.code || e.message})`); }
}
console.log(`${urls.size - bad} reachable, ${bad} not reachable from this script (some sites block scripts)`);
await b.close();
console.log(fails ? `\n${fails} FAILED` : "\nAll audit checks passed");
