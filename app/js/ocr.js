// Turns a photo or a PDF of a report into text, on this device.
// The libraries and the English language file are served from our own site (app/vendor),
// so the picture is never sent anywhere and no outside site is contacted.
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_PAGES = 6;
const MAX_SIDE = 2400;   // larger photos are shrunk first so reading stays fast
const MIN_PDF_TEXT = 80; // fewer characters than this and we treat the PDF as a scan

const base = (p) => new URL(p, import.meta.url).href;

let tessLoad = null;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  tessLoad ||= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = base("../vendor/ocr/tesseract.min.js");
    s.onload = () => resolve(window.Tesseract);
    s.onerror = () => { tessLoad = null; reject(new Error("load")); };
    document.head.append(s);
  });
  return tessLoad;
}

async function makeWorker(onProgress) {
  const T = await loadTesseract();
  return T.createWorker("eng", 1, {
    workerPath: base("../vendor/ocr/worker.min.js"),
    corePath: base("../vendor/ocr/core/"),
    langPath: base("../vendor/ocr/lang/"),
    gzip: false,
    workerBlobURL: false,
    logger: (m) => { if (m.status === "recognizing text") onProgress?.(m.progress); },
  });
}

function toCanvas(source, w, h) {
  const k = Math.min(1, MAX_SIDE / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(source, 0, 0, c.width, c.height);
  return c;
}

async function imageToCanvas(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return toCanvas(img, img.naturalWidth, img.naturalHeight);
  } finally { URL.revokeObjectURL(url); }
}

// Joins the text pieces of one PDF page into lines.
function pageText(content) {
  let out = "", lastY = null;
  for (const it of content.items) {
    if (!("str" in it)) continue;
    const y = it.transform ? it.transform[5] : null;
    if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) out += "\n";
    else if (out && !out.endsWith(" ") && !out.endsWith("\n") && it.str && !it.str.startsWith(" ")) out += " ";
    out += it.str;
    if (it.hasEOL) out += "\n";
    if (y !== null) lastY = y;
  }
  return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Returns { text, method: "pdf-text" | "ocr", pages, confidence (0 to 100 or null), truncated }.
export async function extractText(file, onStatus = () => {}) {
  if (!file) throw new Error("none");
  if (file.size > MAX_BYTES) throw Object.assign(new Error("big"), { code: "big" });
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const isImage = /^image\//.test(file.type);
  if (!isPdf && !isImage) throw Object.assign(new Error("type"), { code: "type" });

  if (isPdf) {
    const pdfjs = await import(base("../vendor/pdf/pdf.min.mjs"));
    pdfjs.GlobalWorkerOptions.workerSrc = base("../vendor/pdf/pdf.worker.min.mjs");
    onStatus("Opening the PDF...");
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages = Math.min(pdf.numPages, MAX_PAGES);
    const truncated = pdf.numPages > MAX_PAGES;
    const texts = [];
    for (let i = 1; i <= pages; i++) texts.push(pageText(await (await pdf.getPage(i)).getTextContent()));
    const joined = texts.join("\n\n").trim();
    if (joined.replace(/\s/g, "").length >= MIN_PDF_TEXT) {
      return { text: joined, method: "pdf-text", pages, confidence: null, truncated };
    }
    // A scanned PDF has no text inside, so draw each page and read it like a photo.
    const canvases = [];
    for (let i = 1; i <= pages; i++) {
      onStatus(`Preparing page ${i} of ${pages}...`);
      const page = await pdf.getPage(i);
      const vp = page.getViewport({ scale: 2 });
      const c = document.createElement("canvas");
      c.width = Math.round(vp.width);
      c.height = Math.round(vp.height);
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      canvases.push(toCanvas(c, c.width, c.height));
    }
    return { ...(await recognize(canvases, onStatus)), pages, truncated };
  }

  onStatus("Preparing the picture...");
  return { ...(await recognize([await imageToCanvas(file)], onStatus)), pages: 1, truncated: false };
}

async function recognize(canvases, onStatus) {
  onStatus("Loading the reader (first time only)...");
  const worker = await makeWorker();
  try {
    const parts = [];
    let conf = 0, n = 0;
    for (let i = 0; i < canvases.length; i++) {
      onStatus(`Reading ${canvases.length > 1 ? `page ${i + 1} of ${canvases.length}` : "the picture"}...`);
      const { data } = await worker.recognize(canvases[i]);
      parts.push((data.text || "").trim());
      if (typeof data.confidence === "number") { conf += data.confidence; n++; }
    }
    return { text: parts.join("\n\n").trim(), method: "ocr", confidence: n ? Math.round(conf / n) : null };
  } finally {
    worker.terminate().catch(() => {});
  }
}
