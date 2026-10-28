// Local server: serves app/ and runs the same chat function Netlify runs.
// Reads OPENAI_API_KEY from .env (gitignored). Usage: node dev-server.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
try {
  for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith("#") && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
} catch { /* no .env: the assistant will say it is not set up */ }

const { default: chat } = await import("./netlify/functions/chat.mjs");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".svg": "image/svg+xml", ".wasm": "application/wasm" };
const port = +process.env.PORT || 8000;

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/api/chat") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const r = await chat(new Request(url, { method: req.method, headers: { "content-type": "application/json" },
      body: req.method === "POST" ? Buffer.concat(chunks) : undefined }), { ip: req.socket.remoteAddress });
    res.writeHead(r.status, Object.fromEntries(r.headers));
    return res.end(await r.text());
  }
  const appDir = path.join(root, "app");
  const file = path.normalize(path.join(appDir, decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)));
  if (!file.startsWith(appDir)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}).listen(port, () => console.log(`SecondLook on http://localhost:${port} (assistant ${process.env.OPENAI_API_KEY ? "ready" : "NOT set up: add OPENAI_API_KEY to .env"})`));
