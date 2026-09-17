/**
 * 探针：pdf 提取在「Electron 类环境」下的 worker 装配。
 *
 * 背景（2026-09-17 用户实测）：read_document 对 PDF 报
 * `No "GlobalWorkerOptions.workerSrc" specified.`，而同一份 PDF 在纯 Node 下
 * （scripts/probe-pdf-extract.ts）抽得好好的。
 *
 * 根因（pdfjs-dist 6.3.289 legacy/build/pdf.mjs:6277）：
 *   isNodeJS = typeof process === "object" && … && !process.versions.nw &&
 *              !(process.versions.electron && process.type && process.type !== "browser")
 * 我们的 daemon 跑在 Electron **utilityProcess** 里（process.versions.electron 有值、
 * process.type === "utility"）→ isNodeJS 为 false → 静态块里
 * `GlobalWorkerOptions.workerSrc ||= "./pdf.worker.mjs"` 不执行 →
 * PDFWorker 走「真 Worker」分支，第一句 `let { workerSrc } = PDFWorker`
 * 就抛这个错（同文件 22935-22945）。
 *
 * 本探针在纯 Node 里把这两个条件伪装出来，等价复现 daemon 环境（不依赖 Electron
 * 进程模型，CI 也能跑）。修法生效后本探针应当 OK。
 *
 * 用法：npx tsx scripts/probe-pdf-worker.ts [pdf 路径]
 */

export {};

const pdfPath =
	process.argv[2] ?? "C:/Users/wangzhendong/Documents/WXWork/1688858444876684/Cache/File/2026-09/PI-Codex-DSH代码调研分享.pdf";

// 必须在 import pdfjs 之前伪装：isNodeJS 在模块加载的静态块里算一次。
Object.defineProperty(process.versions, "electron", { value: "44.2.0", configurable: true });
Object.defineProperty(process, "type", { value: "utility", configurable: true });
console.log(`伪装环境：versions.electron=${process.versions.electron} type=${String(process.type)}`);

const { extractDocument } = await import("../src/core/doc-extract.ts");
try {
	const result = await extractDocument(pdfPath);
	const text = result.text ?? "";
	console.log(`OK：抽出 ${text.length} 字`);
	console.log("前 80 字：", text.slice(0, 80).replace(/\n/g, " "));
} catch (error) {
	console.log("FAIL：", error instanceof Error ? `${error.name}: ${error.message}` : String(error));
	process.exitCode = 1;
}
