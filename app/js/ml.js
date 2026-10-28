// In-browser inference with ONNX Runtime Web. Images never leave the device.
// Also renders Class Activation Maps (CAM) from the model's last feature map.

const ort = window.ort;
ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = new URL("../vendor/ort/", import.meta.url).href;

export async function loadModel(onnxUrl, metaUrl) {
  const [session, meta] = await Promise.all([
    ort.InferenceSession.create(onnxUrl, { executionProviders: ["wasm"] }),
    fetch(metaUrl).then((r) => r.json()),
  ]);
  return { session, meta };
}

// Same preprocessing as training: stretch to size x size, RGB, ImageNet normalisation.
export function toTensor(img, size, mean, std) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, size, size);
  const px = ctx.getImageData(0, 0, size, size).data;
  const n = size * size;
  const data = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    for (let ch = 0; ch < 3; ch++) {
      data[ch * n + i] = (px[i * 4 + ch] / 255 - mean[ch]) / std[ch];
    }
  }
  return new ort.Tensor("float32", data, [1, 3, size, size]);
}

export async function classify(model, img) {
  const { size, mean, std } = model.meta.input;
  const out = await model.session.run({ input: toTensor(img, size, mean, std) });
  const probs = Array.from(out.probs.data);
  const [, ch, h, w] = out.features.dims;
  return { probs, features: out.features.data, ch, h, w };
}

// CAM for class k: sum over channels of classifier weight x feature map (ReLU, 0..1).
export function cam(model, result, k) {
  const W = model.meta.classifier.weight[k];
  const { features: F, ch, h, w } = result;
  const hw = h * w;
  const m = new Float32Array(hw);
  for (let c = 0; c < ch; c++) {
    const wc = W[c];
    const off = c * hw;
    for (let i = 0; i < hw; i++) m[i] += wc * F[off + i];
  }
  let max = 0;
  for (let i = 0; i < hw; i++) {
    m[i] = Math.max(0, m[i]);
    max = Math.max(max, m[i]);
  }
  if (max > 0) for (let i = 0; i < hw; i++) m[i] /= max;
  return { map: m, h, w };
}

// Draw a heat overlay of a CAM onto `canvas` (already holding the image).
export function drawCam(canvas, camMap, opacity) {
  const { map, h, w } = camMap;
  const small = document.createElement("canvas");
  small.width = w;
  small.height = h;
  const sctx = small.getContext("2d");
  const id = sctx.createImageData(w, h);
  for (let i = 0; i < h * w; i++) {
    const v = Math.round(map[i] * 255);
    id.data.set([v, v, v, 255], i * 4);
  }
  sctx.putImageData(id, 0, 0);

  const big = document.createElement("canvas");
  big.width = canvas.width;
  big.height = canvas.height;
  const bctx = big.getContext("2d");
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = "high";
  bctx.drawImage(small, 0, 0, big.width, big.height);
  const g = bctx.getImageData(0, 0, big.width, big.height);
  for (let i = 0; i < g.data.length; i += 4) {
    const v = g.data[i] / 255;
    const [r, gg, b] = heat(v);
    g.data[i] = r;
    g.data[i + 1] = gg;
    g.data[i + 2] = b;
    g.data[i + 3] = Math.round(255 * opacity * Math.min(1, v * 1.4));
  }
  bctx.putImageData(g, 0, 0);
  canvas.getContext("2d").drawImage(big, 0, 0);
}

// Perceptual warm ramp: transparent -> amber -> orange -> deep red.
function heat(v) {
  const stops = [
    [0.0, [255, 237, 160]],
    [0.4, [254, 178, 76]],
    [0.7, [240, 59, 32]],
    [1.0, [165, 0, 38]],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const [a, ca] = stops[i - 1];
      const [b, cb] = stops[i];
      const t = (v - a) / (b - a);
      return ca.map((x, j) => Math.round(x + t * (cb[j] - x)));
    }
  }
  return stops[stops.length - 1][1];
}

// Mean HSV-style saturation in 0..1. Ultrasound and grayscale scans are close to 0.
export function colourfulness(img) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0, 64, 64);
  const d = ctx.getImageData(0, 0, 64, 64).data;
  let s = 0;
  for (let i = 0; i < d.length; i += 4) {
    const mx = Math.max(d[i], d[i + 1], d[i + 2]);
    const mn = Math.min(d[i], d[i + 1], d[i + 2]);
    s += mx === 0 ? 0 : (mx - mn) / mx;
  }
  return s / (d.length / 4);
}

export function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("Could not read that image file."));
    im.src = src;
  });
}

export function drawImageFit(canvas, img, maxSide = 448) {
  const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  canvas.width = Math.round(img.naturalWidth * s);
  canvas.height = Math.round(img.naturalHeight * s);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
}
