// Browser test of the whole journey. Needs: npm i playwright-core, Chrome, and the server running (node dev-server.mjs).
// Expected: the two "no console errors" checks fail only because we inject a 502 on purpose to test the error state.
import { chromium } from "playwright-core";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.BASE || "http://localhost:8000";
const browser = await chromium.launch({ executablePath: process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const results = [];
const check = (name, ok, extra = "") => { results.push(ok); console.log((ok ? "PASS " : "FAIL ") + name + (extra ? "  " + extra : "")); };

async function run(label, viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(base + "/#home");
  check(`[${label}] home loads`, (await page.title()).length > 0);

  // Every tab opens
  for (const t of ["report", "scan", "check", "lab", "about", "home"]) {
    await page.click(t === "home" ? "a.brand" : `.tabs a[data-tab=${t}]`);
    check(`[${label}] tab ${t} visible`, await page.locator(`#${t}`).isVisible());
  }

  // Report decoder (existing feature)
  await page.click(".tabs a[data-tab=report]");
  await page.click("[data-ex='2']");
  await page.waitForSelector("#report-out .card");
  check(`[${label}] decoder shows BI-RADS 4B`, /BI-RADS 4B/.test(await page.locator("#report-out").innerText()));

  // Chat uses the report
  const sugg = await page.locator("#chat-suggest button").allInnerTexts();
  check(`[${label}] suggestions use the report`, sugg.some((s) => /BI-RADS 4B/.test(s)), JSON.stringify(sugg));
  await page.click("#chat-suggest button >> nth=0");
  await page.waitForSelector(".msg.assistant:not(.pending)", { timeout: 45000 });
  const reply = await page.locator(".msg.assistant").last().innerText();
  check(`[${label}] assistant replied`, reply.length > 40, reply.slice(0, 120).replace(/\n/g, " "));
  check(`[${label}] reply has no em dash`, !/[—–]/.test(reply));
  await page.fill("#chat-input", "I just felt a new lump under my arm");
  await page.click("#chat-send");
  await page.waitForSelector(".msg-note", { timeout: 45000 });
  check(`[${label}] urgent note shown`, true);
  await page.click("#chat-clear");
  check(`[${label}] clear chat empties log`, (await page.locator(".msg").count()) === 0);

  // Failure state: server error must not look like an answer
  await page.route("**/api/chat", (r) => r.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "The assistant service had a problem. Please try again in a moment." }) }));
  await page.fill("#chat-input", "hello");
  await page.click("#chat-send");
  await page.waitForSelector(".msg.error");
  check(`[${label}] error shown, no fake answer`, (await page.locator(".msg.assistant").count()) === 0);
  await page.unroute("**/api/chat");
  await page.click(".msg.error button");
  await page.waitForSelector(".msg.assistant:not(.pending)", { timeout: 45000 });
  check(`[${label}] retry works`, true);

  // Scan (existing feature)
  await page.click(".tabs a[data-tab=scan]");
  await page.waitForSelector("#scan-samples button", { timeout: 30000 });
  await page.click("#scan-samples button >> nth=3");
  await page.waitForFunction(() => /malignant|benign|normal/i.test(document.querySelector("#scan-out").innerText) && !/Loading model/.test(document.querySelector("#scan-out").innerText), null, { timeout: 30000 });
  check(`[${label}] scan classifies a sample`, true, (await page.locator("#scan-out").innerText()).slice(0, 80).replace(/\n/g, " "));


  // Upload handling
  await page.click(".tabs a[data-tab=scan]");
  await page.waitForSelector("#scan-samples button");
  await page.setInputFiles("#scan-file", { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  check(`[${label}] text file rejected kindly`, /not an image/i.test(await page.locator("#scan-out").innerText()));
  await page.setInputFiles("#scan-file", { name: "big.png", mimeType: "image/png", buffer: Buffer.alloc(16 * 1024 * 1024) });
  check(`[${label}] huge file rejected`, /too large/i.test(await page.locator("#scan-out").innerText()));
  await page.setInputFiles("#scan-file", { name: "corrupt.png", mimeType: "image/png", buffer: Buffer.from("not a png") });
  await page.waitForFunction(() => /could not read/i.test(document.querySelector("#scan-out").innerText), null, { timeout: 10000 });
  check(`[${label}] corrupt image rejected`, true);
  await page.setInputFiles("#scan-file", (process.env.SAMPLE || path.join(root, "app/samples/benign_1.png")));
  await page.waitForFunction(() => /Closest match/i.test(document.querySelector("#scan-out").innerText), null, { timeout: 20000 });
  check(`[${label}] uploaded real image classified`, true);
  check(`[${label}] file input reachable by keyboard`, await page.evaluate(() => document.querySelector("#scan-file").tabIndex >= 0 && !document.querySelector("#scan-file").hidden));
  await page.click(".tabs a[data-tab=about]");
  await page.waitForFunction(() => document.querySelector("#about-body").innerText.length > 500);
  const about = await page.locator("#about-body").innerText();
  check(`[${label}] about page renders`, /ultrasound demo/i.test(about) && !/undefined|NaN/.test(about));

  // Symptom check (existing feature)
  await page.click(".tabs a[data-tab=check]");
  await page.click("#symptoms input >> nth=0");
  check(`[${label}] symptom check gives advice`, (await page.locator("#check-out").innerText()).length > 50);

  // Lab (existing feature)
  await page.click(".tabs a[data-tab=lab]");
  await page.waitForSelector("#lab-cases button", { timeout: 15000 });
  await page.click("#lab-cases button >> nth=1");
  check(`[${label}] lab shows result`, (await page.locator("#lab-out").innerText()).length > 50);

  // No horizontal scroll
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(`[${label}] no sideways scrolling`, !overflow);
  check(`[${label}] no console errors`, errors.length === 0, errors.slice(0, 3).join(" | "));
  await page.screenshot({ path: `${process.env.OUT || process.env.TEMP || "."}/secondlook-shot-${label}.png`, fullPage: false });
  await ctx.close();
}
await run("desktop", { width: 1280, height: 900 });
await run("mobile", { width: 390, height: 800 });
await browser.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
