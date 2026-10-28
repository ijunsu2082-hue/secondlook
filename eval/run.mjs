// Runs the conversation set against the real assistant and writes eval/results.md.
// Needs OPENAI_API_KEY (read from the environment or .env). Costs a small amount of API credit.
// Usage: node eval/run.mjs [--limit 20] [--cat urgent] [--id birads-01,unc-01]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { respond } from "../assistant/core.mjs";
import { parseReport } from "../app/js/report.js";
import { EXAMPLES } from "../app/js/knowledge.js";
import { checkReply } from "./checks.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
try {
  for (const line of fs.readFileSync(path.join(here, "..", ".env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith("#") && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
} catch { /* no .env */ }

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf("--" + name); return i >= 0 ? args[i + 1] : null; };
const reports = JSON.parse(fs.readFileSync(path.join(here, "reports.json"), "utf8"));
let entries = fs.readFileSync(path.join(here, "conversations.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
if (opt("cat")) entries = entries.filter((e) => e.cat === opt("cat"));
if (opt("id")) entries = entries.filter((e) => opt("id").split(",").includes(e.id));
if (opt("limit")) entries = entries.slice(0, +opt("limit"));

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) { console.error("OPENAI_API_KEY is not set. Add it to .env first."); process.exit(1); }
const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

function reportFor(e) {
  const text = e.reportText || (e.report?.startsWith("example:") ? EXAMPLES[+e.report.split(":")[1]].text : e.report ? reports[e.report] : null);
  return text ? { text, parsed: parseReport(text) } : null;
}

async function runOne(e) {
  const body = { messages: e.messages, report: reportFor(e) };
  let out = await respond(body, { apiKey, model });
  if (out.status === 502) out = await respond(body, { apiKey, model });
  const result = { status: out.status, reply: out.json.reply, note: out.json.note, feature: out.json.feature, error: out.json.error };
  return { id: e.id, cat: e.cat, fails: checkReply(e, result), ...result };
}

const results = [];
let next = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < entries.length) {
    const e = entries[next++];
    const r = await runOne(e);
    results.push(r);
    process.stdout.write(r.fails.length ? "x" : ".");
  }
}));
console.log();

results.sort((a, b) => a.id.localeCompare(b.id));
const passed = results.filter((r) => !r.fails.length).length;
const byCat = {};
for (const r of results) { (byCat[r.cat] ||= { n: 0, ok: 0 }).n++; if (!r.fails.length) byCat[r.cat].ok++; }

const md = [
  "# Assistant evaluation results",
  "",
  `Run on ${new Date().toISOString().slice(0, 10)} with model \`${model}\`. ${results.length} conversations. **${passed} passed, ${results.length - passed} failed.**`,
  "",
  "These are rule-based checks (style, safety, honesty markers). They do not prove the medical content is right. A person still needs to read the replies in `results.json`.",
  "",
  "| Category | Passed | Total |", "|---|---|---|",
  ...Object.entries(byCat).map(([c, v]) => `| ${c} | ${v.ok} | ${v.n} |`),
  "",
  "## Failures",
  "",
  ...(results.filter((r) => r.fails.length).map((r) => `- **${r.id}**: ${r.fails.join("; ")}\n  > ${(r.reply || "").replace(/\n+/g, " ").slice(0, 280)}`)),
  "",
].join("\n");
const partial = args.length > 0;   // filtered runs must not overwrite the latest full results
fs.writeFileSync(path.join(here, partial ? "results-partial.md" : "results.md"), md);
const failedIds = results.filter((x) => x.fails.length).map((x) => x.id).join(", ") || "none";
fs.appendFileSync(path.join(here, "history.md"), `| ${new Date().toISOString().slice(0, 16).replace("T", " ")} | ${model} | ${passed}/${results.length} | ${args.length ? "partial run: " + args.join(" ") : "full"} | ${failedIds} |
`);
fs.writeFileSync(path.join(here, partial ? "results-partial.json" : "results.json"), JSON.stringify({ model, date: new Date().toISOString(), results }, null, 1));
console.log(`${passed}/${results.length} passed. See eval/results.md`);
process.exit(passed === results.length ? 0 : 2);
