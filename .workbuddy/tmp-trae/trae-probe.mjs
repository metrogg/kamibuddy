/*
 * 临时逆向探针：在 Trae 的 minified bundle 里查关键词并打印上下文。
 * 用法: node trae-probe.mjs <bundlePath> <keyword> [contextLen] [maxHits]
 */
import fs from "node:fs";

const [bundlePath, keyword, ctxArg = "300", maxArg = "12"] = process.argv.slice(2);
if (!bundlePath || !keyword) {
  console.error("usage: node trae-probe.mjs <bundle> <keyword> [ctx] [maxHits]");
  process.exit(1);
}
const ctx = Number(ctxArg);
const maxHits = Number(maxArg);
const text = fs.readFileSync(bundlePath, "utf8");
const lower = text.toLowerCase();
const needle = keyword.toLowerCase();
let idx = 0;
let hits = 0;
while (hits < maxHits) {
  idx = lower.indexOf(needle, idx);
  if (idx === -1) break;
  const start = Math.max(0, idx - ctx);
  const end = Math.min(text.length, idx + needle.length + ctx);
  const snippet = text.slice(start, end).replace(/\s+/g, " ");
  console.log(`--- hit @${idx} ---`);
  console.log(snippet);
  idx += needle.length;
  hits += 1;
}
if (hits === 0) console.log(`(no hits for "${keyword}")`);
