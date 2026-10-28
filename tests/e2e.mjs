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

  // Report sanity check: a normal sample is not covered in warnings, and no family history is assumed
  check(`[${label}] built-in sample shows no warning region`, (await page.locator("#report-out .sanity").count()) === 0);
  check(`[${label}] questions for the doctor do not assume a family history`, !/my family history/i.test(await page.locator("#report-out .questions").innerText()));

  // An impossible report: the whole decoded report is still shown, with the warning first
  await page.fill("#report-text", "Mass in the left breast at 14 o'clock measuring 35 cm. BI-RADS 5. Impression: BI-RADS 2.");
  await page.click("#report-go");
  await page.waitForSelector("#report-out .sanity");
  const sane = page.locator("#report-out .sanity");
  check(`[${label}] warning is the first thing in the decoded report`, await page.evaluate(() => document.querySelector("#report-out").firstElementChild.classList.contains("sanity")));
  check(`[${label}] warning is a labeled region`, (await sane.getAttribute("role")) === "region" && /double check/i.test(await page.locator("#sanity-h").innerText()) && (await sane.getAttribute("aria-labelledby")) === "sanity-h");
  const sText = await sane.innerText();
  check(`[${label}] warning uses text labels, not color alone`, /(Needs checking|Possible conflict|Could not interpret)/.test(sText));
  check(`[${label}] warning quotes the original values exactly`, sText.includes("14 o'clock") && sText.includes("35 cm"));
  check(`[${label}] warning says it may be real and not to panic`, /may really have written|not saying it is wrong/i.test(sText) && /does not mean you have cancer/i.test(sText));
  check(`[${label}] focus moves to the warning heading`, await page.evaluate(() => document.activeElement && document.activeElement.id === "sanity-h"));
  check(`[${label}] both BI-RADS numbers still get a card`, (await page.locator("#report-out .birads .num").allInnerTexts()).sort().join(",") === "2,5");
  const shortV = await page.locator("#report-out .card:has(h3:text('The short version'))").innerText();
  check(`[${label}] summary does not pick one BI-RADS number`, /more than one BI-RADS number/i.test(shortV) && !/Your report gives a BI-RADS 5/.test(shortV));
  check(`[${label}] invalid position is listed as not placed`, /Positions we could not place/.test(await page.locator("#report-out").innerText()));
  check(`[${label}] flagged text is marked in the report`, (await page.locator("#report-out mark.flag").count()) >= 1);
  check(`[${label}] questions start with the warning's question and assume no family history`, /14 o'clock/.test(await page.locator("#report-out .questions li").first().innerText()) && !/my family history/i.test(await page.locator("#report-out .questions").innerText()));
  check(`[${label}] no sideways scrolling with warnings showing`, !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)));
  await page.screenshot({ path: `${process.env.OUT || process.env.TEMP || "."}/secondlook-sanity-${label}.png`, fullPage: true });
  // Back to the normal sample for the chat steps below
  await page.click("[data-ex='2']");
  await page.waitForSelector("#report-out .card");
  check(`[${label}] choosing a normal sample clears the warning`, (await page.locator("#report-out .sanity").count()) === 0);

  // Privacy gate: nothing can be typed or sent until the person agrees
  check(`[${label}] privacy box is shown first and chat is locked`, (await page.locator("#chat-gate").isVisible()) && !(await page.locator("#chat-main").isVisible()));
  check(`[${label}] privacy box says who gets the words`, /OpenAI/.test(await page.locator("#chat-gate").innerText()) && /report/.test(await page.locator("#gate-report").innerText()));
  let sent = false;
  page.on("request", (r) => { if (r.url().includes("/api/chat")) sent = true; });
  await page.click("#tailor-questions");
  check(`[${label}] "tailor" button does not send anything before agreeing`, !sent && (await page.locator("#chat-gate").isVisible()));
  await page.click("#gate-accept");
  check(`[${label}] agreeing unlocks the chat`, await page.locator("#chat-main").isVisible());

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

  // Feature link in a reply really navigates, and the demo is labeled as research
  await page.fill("#chat-input", "Can I upload my own ultrasound picture here?");
  await page.click("#chat-send");
  await page.waitForSelector(".msg.assistant .chip", { timeout: 45000 });
  check(`[${label}] reply shows the research-demo note`, /not a clinical tool/i.test(await page.locator(".msg.assistant").last().innerText()));
  await page.click(".msg.assistant .chip");
  check(`[${label}] feature link opens the ultrasound tab`, await page.locator("#scan").isVisible());
  await page.click(".tabs a[data-tab=report]");
  await page.click("#chat-clear");

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

  // Browser model matches the Python reference on the 6 sample images
  const par = await page.evaluate(async () => {
    const ml = await import("/js/ml.js");
    const model = await ml.loadModel("models/busi_effnet_b0.onnx", "models/busi_model.json");
    const samples = await (await fetch("samples/samples.json")).json();
    let worst = 0, sameTop = true;
    for (const s of samples) {
      const r = await ml.classify(model, await ml.loadImage(s.file));
      worst = Math.max(worst, ...s.python_probs.map((v, i) => Math.abs(v - r.probs[i])));
      sameTop = sameTop && s.python_probs.indexOf(Math.max(...s.python_probs)) === r.probs.indexOf(Math.max(...r.probs));
    }
    return { worst, sameTop };
  });
  check(`[${label}] browser model matches Python reference`, par.worst < 0.03 && par.sameTop, `largest difference ${par.worst.toFixed(4)}`);

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
// Optional: a second server started without a key (OPENAI_API_KEY="" PORT=8001 node dev-server.mjs)
if (process.env.NOKEY) {
  const c = await browser.newContext(); const pg = await c.newPage();
  await pg.goto(process.env.NOKEY + "/#report");
  await pg.click("[data-ex='1']");
  await pg.click("#gate-accept");
  await pg.fill("#chat-input", "What does this mean?");
  await pg.click("#chat-send");
  await pg.waitForSelector(".msg.error");
  check("[no key] clear error and no made-up answer", /not set up/i.test(await pg.locator(".msg.error").innerText()) && (await pg.locator(".msg.assistant").count()) === 0);
  await c.close();
}
await run("desktop", { width: 1280, height: 900 });
await run("mobile", { width: 390, height: 800 });
await browser.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
