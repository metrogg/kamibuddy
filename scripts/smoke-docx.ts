/**
 * docx 引擎冒烟：托管 venv ensure + 真实转换 + python-docx 读回校验。
 *
 * 为什么单独一个脚本：这条链跨四个边界 —— TS 状态机 → uv/venv（Windows
 * Scripts/ 布局）→ Python 引擎（PYTHONPATH 注入）→ OOXML 产物。类型检查
 * 全过不代表运行时成立：venv 路径错一节、PYTHONIOENCODING 缺一个、
 * PYTHONPATH 没指向引擎目录，每一个都是「测试全绿但用户机器上挂」。
 *
 * 与单测的分工：单测 mock spawn 钉状态机与契约解析；本脚本真跑一遍。
 * 首次执行会装 uv 管理的 Python 3.12 与依赖（1-2min），之后幂等秒退。
 *
 * 用法：npm run smoke:docx
 */

import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";

export {};

const { createEnvContext, defaultSpawn, ensureDocxEnv } = await import("../src/documents/docx-env.ts");
const { convertHtmlToDocx, defaultRun } = await import("../src/documents/docx-convert.ts");

const results: { name: string; ok: boolean; detail: string }[] = [];
function check(name: string, ok: boolean, detail: string): void {
	results.push({ name, ok, detail });
	console.log(`${ok ? "PASS" : "FAIL"}  ${name}\n      ${detail}`);
}

const engineDir = resolve("resources/docx-engine");
const ctx = createEnvContext(engineDir, homedir(), process.platform);
const outDir = mkdtempSync(join(tmpdir(), "kami-docx-smoke-"));

try {
	// 1. 环境：幂等 ensure（已就绪约 5 次探测秒退；缺啥装啥）
	const ensured = await ensureDocxEnv(ctx, defaultSpawn);
	check(
		"venv 环境就绪",
		ensured.status === "ready",
		ensured.status === "ready" ? ensured.python : `${ensured.phase}: ${ensured.error}`,
	);
	if (ensured.status !== "ready") {
		throw new Error("环境未就绪，跳过后续检查");
	}

	// 2. 转换：样例 HTML（周报形态：封面/标题/表格/列表/CSS 变量/段落底纹）
	const sample = join(engineDir, "examples", "report-sample.html");
	const outPath = join(outDir, "out.docx");
	const converted = await convertHtmlToDocx(
		{ python: ensured.python, engineDir, inputPath: sample, outputPath: outPath },
		defaultRun,
	);
	const size = existsSync(outPath) ? statSync(outPath).size : 0;
	check(
		"样例转换成功",
		existsSync(outPath) && size > 10_000,
		`${converted.docxPath}（${size} 字节，warnings: ${converted.warnings.length}）`,
	);

	// 3. 读回：python-docx 打开产物，标题文本必须在（OOXML 合法性实证）
	const readBack = await defaultSpawn({
		command: ensured.python,
		args: [
			"-c",
			"import sys; from docx import Document; d = Document(sys.argv[1]); "
				+ "texts = [p.text for p in d.paragraphs if p.text.strip()]; "
				+ "print('PARA_COUNT=' + str(len(texts))); print('FIRST=' + (texts[0] if texts else ''))",
			outPath,
		],
		env: { PYTHONIOENCODING: "utf-8" },
	});
	const ok = readBack.code === 0 && readBack.stdout.includes("PARA_COUNT=") && readBack.stdout.includes("FIRST=");
	check(
		"python-docx 读回校验",
		ok,
		readBack.code === 0
			? readBack.stdout.trim().replaceAll("\n", "；")
			: `exit ${readBack.code}: ${readBack.stderr.trim().slice(0, 200)}`,
	);
} finally {
	rmSync(outDir, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
process.exit(failed.length === 0 ? 0 : 1);
