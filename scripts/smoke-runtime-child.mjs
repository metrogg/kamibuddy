/**
 * 真运行时冒烟 · 子进程侧：在**Electron utilityProcess** 里跑关键库链路。
 *
 * 为什么必须有这一层（2026-09-17 的事故）：
 * daemon 跑在 utilityProcess 里（process.type === "utility"），而我们的单测与探针
 * 全跑在纯 Node（tsx / vitest）—— 两者对「嗅探 process.versions.electron 的库」
 * 是**不同环境**。pdfjs 就是受害者：它的 isNodeJS 判定把 Electron 非 browser 进程
 * 排除在外，于是既不给 workerSrc 填默认值又按浏览器路径走，PDF 提取整体报
 * `No "GlobalWorkerOptions.workerSrc" specified.`（详见 scripts/probe-pdf-worker.ts）。
 * 该功能从上线起就是坏的，而所有测试都是绿的 —— 因为测试环境不是交付环境。
 *
 * 本脚本只做「环境敏感的库」的可用性验证，不碰业务语义（那些有各自的 smoke）。
 * 由 scripts/smoke-runtime-main.mjs 用 utilityProcess.fork 拉起（execArgv 挂 tsx），
 * 结果经 parentPort 回报，退出码即结论。
 */

import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

const results = [];
function check(name, ok, detail) {
	results.push({ name, ok, detail: String(detail) });
	console.log(`${ok ? "PASS" : "FAIL"}  ${name}\n      ${String(detail)}`);
}

console.log(
	`环境指纹：process.type=${String(process.type)} electron=${String(process.versions.electron)} node=${String(process.versions.node)}`,
);

/* ── 1. 文档提取：pdf（pdfjs）+ office（officeparser）───────────────────── */

const fixtures = join(repoRoot, "src", "core", "test-fixtures", "docs");
try {
	const { extractDocument } = await import(pathToFileURL(join(repoRoot, "src", "core", "doc-extract.ts")).href);
	const pdf = await extractDocument(join(fixtures, "cn-text.pdf"));
	check("pdf 文本提取（pdfjs 的 worker 装配）", (pdf.text ?? "").length > 20, `抽出 ${String(pdf.text ?? "").length} 字`);

	const docx = await extractDocument(join(fixtures, "cn.docx"));
	check("docx 文本提取（officeparser）", (docx.text ?? "").length > 5, `抽出 ${String(docx.text ?? "").length} 字`);

	const xlsx = await extractDocument(join(fixtures, "cn.xlsx"));
	check("xlsx 文本提取（officeparser）", (xlsx.text ?? "").length > 0, `抽出 ${String(xlsx.text ?? "").length} 字`);
} catch (error) {
	check("文档提取（pdf/docx/xlsx）", false, error instanceof Error ? `${error.name}: ${error.message}` : String(error));
}

/* ── 2. koffi FFI：沙箱的底座（受限令牌全靠它）─────────────────────────── */

try {
	const koffi = (await import("koffi")).default ?? (await import("koffi"));
	const kernel32 = koffi.load("kernel32.dll");
	const getCurrentProcessId = kernel32.func("uint32 __stdcall GetCurrentProcessId()");
	const pid = getCurrentProcessId();
	check("koffi 加载 kernel32 并调用（沙箱 FFI 链路）", typeof pid === "number" && pid > 0, `GetCurrentProcessId() = ${String(pid)}`);
} catch (error) {
	check("koffi FFI（沙箱底座）", false, error instanceof Error ? `${error.name}: ${error.message}` : String(error));
}

/* ── 3. pi SDK：能加载（ESM/原生依赖的加载期问题在这里暴露）────────────── */

try {
	const pi = await import("@earendil-works/pi-coding-agent");
	check("pi SDK 可加载", typeof pi.createAgentSession === "function", `createAgentSession=${typeof pi.createAgentSession}`);
} catch (error) {
	check("pi SDK 可加载", false, error instanceof Error ? `${error.name}: ${error.message}` : String(error));
}

/* ── 汇总回报 ─────────────────────────────────────────────────────────── */

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
process.parentPort?.postMessage({ failed: failed.length, total: results.length });
process.exit(failed.length === 0 ? 0 : 1);
