/**
 * 探针：PDF 文本提取（read_document 的 pdf 分支）能不能跑通。
 *
 * 背景（2026-09-17 用户实测）：read_document 对 PDF 报
 * `No "GlobalWorkerOptions.workerSrc" specified.`（pdf.js 的 worker 加载失败），
 * 而 docx/xlsx 正常 —— 用户机器跑的是 dev，不是打包版本。
 *
 * 用法：npx tsx scripts/probe-pdf-extract.ts <某个 .pdf 的绝对路径>
 */
export {};

const path = process.argv[2];
if (path === undefined) {
	console.log("用法：npx tsx scripts/probe-pdf-extract.ts <pdf 绝对路径>");
	process.exit(2);
}

const { extractDocument } = await import("../src/core/doc-extract.ts");
try {
	const result = await extractDocument(path);
	const text = result.text ?? "";
	console.log(`OK：抽出 ${text.length} 字`);
	console.log("前 120 字：", text.slice(0, 120).replace(/\n/g, " "));
} catch (error) {
	console.log("FAIL：", error instanceof Error ? `${error.name}: ${error.message}` : String(error));
	if (error instanceof Error) console.log(error.stack?.split("\n").slice(0, 8).join("\n"));
	process.exitCode = 1;
}
