// Re-checks the saved replies in results.json with the current rules. No API calls.
import fs from "node:fs";
import { checkReply } from "./checks.mjs";
const here = new URL(".", import.meta.url);
const entries = new Map(fs.readFileSync(new URL("conversations.jsonl", here), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).map((e) => [e.id, e]));
const saved = JSON.parse(fs.readFileSync(new URL("results.json", here), "utf8"));
const rows = saved.results.map((r) => ({ id: r.id, fails: checkReply(entries.get(r.id), r) }));
const bad = rows.filter((r) => r.fails.length);
console.log(`${rows.length - bad.length}/${rows.length} pass with the current rules (replies from ${saved.date.slice(0, 16)})`);
for (const r of bad) console.log("- " + r.id + ": " + r.fails.join("; "));
