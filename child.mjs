const repo = "E:/project/kamibuddy";
console.log(JSON.stringify({
  type: process.type,
  electron: process.versions.electron,
  node: process.versions.node,
}));
const pdfPath = "C:/Users/wangzhendong/Documents/WXWork/1688858444876684/Cache/File/2026-09/PI-Codex-DSH代码调研分享.pdf";
try {
  const { extractDocument } = await import(`file:///${repo}/src/core/doc-extract.ts`);
  const r = await extractDocument(pdfPath);
  console.log("EXTRACT OK chars=" + String(r.text ?? "").length);
} catch (e) {
  console.log("EXTRACT FAIL: " + (e && e.message ? e.message : String(e)));
}
process.parentPort?.postMessage({ done: true });
