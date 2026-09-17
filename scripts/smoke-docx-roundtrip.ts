/**
 * docx 反向往返冒烟：正向 HTML → .docx，再用反向引擎 .docx → HTML + 图片，断言内容没丢。
 *
 * 为什么单独一个脚本：两个方向各自单测全绿也证明不了「串起来成立」——
 * `<h1>` 在正向被写成哪种 OOXML（Heading 样式？outlineLvl？），反向认不认；
 * 正向按 CJK/西文切分 run 之后，反向能不能把同一句话拼回原样；图片引用的
 * 相对基准（相对 HTML 目录）两个方向是不是同一套约定。这些只有在真 venv +
 * 真引擎上跑一遍才成立。
 *
 * 与既有冒烟的分工：
 *   smoke:docx                 —— 钉「正向 + 托管环境」（转换 + python-docx 读回）
 *   smoke:docx-roundtrip（本脚本）—— 钉「反向 + 两端契约对齐」（提取 + 内容断言）
 * 与 Python 侧往返测试（resources/docx-engine/docx_to_html/tests）的分工：
 * 那条在 Python 进程内跑，走不到 TS 这一层（venv 定位、PYTHONPATH 注入、
 * 一行 JSON 契约的解析与错误分类）；这条从 scripts/ 出发，跑的是 daemon
 * 真实调用的那条链，且用的是与生产**同一份**参数拼装（src/documents/docx-*.ts）。
 *
 * 用法：npm run smoke:docx-roundtrip
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

export {};

/*
 * 不写字节码：仓里 html_to_docx/__pycache__/*.pyc 是被入库的（搬用资产时一并带进来），
 * 而 docx_to_html/ 是本轮新包 —— 不关掉缓存，跑一次冒烟就在仓里留下未跟踪的
 * __pycache__/（本脚本的验收条件之一是「跑完 git status 干净」）。
 * 只影响字节码落盘，不改变 import 行为。
 */
process.env["PYTHONDONTWRITEBYTECODE"] = "1";

const { createEnvContext, defaultSpawn, ensureDocxEnv } = await import("../src/documents/docx-env.ts");
const { convertHtmlToDocx, defaultRun } = await import("../src/documents/docx-convert.ts");
const { extractDocxToHtml } = await import("../src/documents/docx-extract.ts");

/* ── 断言设施（照 smoke-docx.ts 的收尾口径） ───────────────────────── */

const results: { name: string; ok: boolean; detail: string }[] = [];
const skips: { name: string; detail: string }[] = [];

function check(name: string, ok: boolean, detail: string): void {
	results.push({ name, ok, detail });
	console.log(`${ok ? "PASS" : "FAIL"}  ${name}\n      ${detail}`);
}

/** 断言不适用时用它，且必须在收尾显式列出 —— 不许当成 PASS 混进统计。 */
function skip(name: string, detail: string): void {
	skips.push({ name, detail });
	console.log(`SKIP  ${name}\n      ${detail}`);
}

/** 去标签 + 折叠空白成纯文本视图。断言必须基于它：正向会按 CJK/西文把一句话切成多个 run（多个 span），拿原始 HTML 做子串匹配会把「同一句话被切段」误判成丢字。 */
function toText(html: string): string {
	return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

/** 取某标签的元素文本（不含标签本身）；用 toText 的同一套规整。 */
function tagTexts(html: string, tag: string): string[] {
	const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
	const out: string[] = [];
	for (const match of html.matchAll(pattern)) out.push(toText(match[1] ?? ""));
	return out;
}

function fileSize(path: string): number {
	return existsSync(path) ? statSync(path).size : 0;
}

/* ── 断言用的真实文案（逐字取自 examples/report-sample.html） ──────── */

const EXPECTED_H1: readonly string[] = ["一、本周工作进展", "二、数据一览"];
const EXPECTED_H2: readonly string[] = ["1.1 文档生成能力"];
const EXPECTED_TABLE_HEADERS: readonly string[] = ["指标", "本周", "环比"];
const EXPECTED_TABLE_CELLS: readonly string[] = ["转换成功率", "98.5%"];
/** 中英混排关键串：分别来自正文段落、列表项、末段，证明「整篇没丢字」而不是只看一处。 */
const EXPECTED_TEXT: readonly string[] = [
	"本周完成了 docx 生成引擎的搬用与端到端验证。",
	"docx_convert 工具",
	"复制 html_to_docx 引擎包至 resources/docx-engine/",
];

/* ── 工作区与上下文 ───────────────────────────────────────────────── */

const engineDir = resolve("resources/docx-engine");
const samplePath = join(engineDir, "examples", "report-sample.html");
const ctx = createEnvContext(engineDir, homedir(), process.platform);

// 全程只写系统临时目录，跑完整个删掉：不污染仓，也不碰用户文档目录。
const workDir = mkdtempSync(join(tmpdir(), "kami-docx-roundtrip-"));
const docxPath = join(workDir, "out.docx");
const htmlPath = join(workDir, "out.html");
const assetsDir = join(workDir, "assets");

let forwardWarnings: readonly string[] = [];
let reverseWarnings: readonly string[] = [];
let notRestorable: readonly string[] = [];
const startedAt = Date.now();

try {
	// 1. 环境：与生产同一条幂等状态机（venv 缺失/版本不符/缺依赖都在这里归因）
	const ensured = await ensureDocxEnv(ctx, defaultSpawn);
	check(
		"venv 环境就绪（docx-env 幂等 ensure）",
		ensured.status === "ready",
		ensured.status === "ready" ? ensured.python : `${ensured.phase}: ${ensured.error}`,
	);

	if (ensured.status !== "ready") {
		console.log(
			"\n环境未就绪，后续检查全部跳过（不静默当通过）。准备引导：\n" +
				"  1) 安装 uv（https://docs.astral.sh/uv/），或把 uv 可执行文件放到 ~/.local/bin/；\n" +
				"  2) 重跑本脚本：首轮会联网装独立 Python 3.12 与依赖（约 1-2 分钟），之后幂等秒退；\n" +
				"  3) 私有化/无外网：把 UV_INDEX_URL 与 UV_PYTHON_INSTALL_MIRROR 指向内网镜像，\n" +
				"     或用 HTML_TO_DOCX_VENV 指向运维预置好的 venv。",
		);
	} else {
		const python = ensured.python;

		// 2. 正向：复用 docx-convert 的 CLI 参数拼装与 cwd/PYTHONPATH 规则，不另写一份
		const converted = await convertHtmlToDocx(
			{ python, engineDir, inputPath: samplePath, outputPath: docxPath },
			defaultRun,
		);
		forwardWarnings = converted.warnings;
		const docxSize = fileSize(docxPath);
		check(
			"正向：样例 HTML → .docx",
			docxSize > 10_000,
			`${docxPath}（${docxSize} 字节，warnings: ${forwardWarnings.length}）`,
		);

		// 3. 反向：--assets-dir 显式落在同一临时工作区，图片与 HTML 的相对关系可断言
		const extracted = await extractDocxToHtml(
			{ python, engineDir, docxPath, outputPath: htmlPath, assetsDir },
			defaultRun,
		);
		reverseWarnings = extracted.warnings;
		notRestorable = extracted.notRestorable;
		const html = existsSync(htmlPath) ? readFileSync(htmlPath, "utf8") : "";
		check(
			"反向：.docx → HTML 且产物可读",
			html.trim().length > 0,
			`${extracted.htmlPath}（${html.length} 字符，assets: ${extracted.assetsDir}）`,
		);

		// 结构与文本只看正文：<head>/<style> 里的样式字面量不该撞上断言串
		const body = html
			.replace(/<style\b[\s\S]*?<\/style>/gi, "")
			.replace(/<head\b[\s\S]*?<\/head>/gi, "");
		const text = toText(body);

		// 4. 标题层级：断言样张真实文案，而不是「标签在不在」
		const h1Texts = tagTexts(body, "h1");
		const h2Texts = tagTexts(body, "h2");
		const missingH1 = EXPECTED_H1.filter((want) => !h1Texts.some((got) => got.includes(want)));
		check(
			"标题层级：<h1> 文案命中",
			missingH1.length === 0,
			`h1 ${h1Texts.length} 个［${h1Texts.join("｜")}］；未命中：${missingH1.length === 0 ? "无" : missingH1.join("、")}`,
		);
		const missingH2 = EXPECTED_H2.filter((want) => !h2Texts.some((got) => got.includes(want)));
		check(
			"标题层级：<h2> 文案命中",
			missingH2.length === 0,
			`h2 ${h2Texts.length} 个［${h2Texts.join("｜")}］；未命中：${missingH2.length === 0 ? "无" : missingH2.join("、")}`,
		);

		// 5. 表格：结构（table + th）与内容（表头/单元格文案）分开断言
		const table = /<table\b[\s\S]*?<\/table>/i.exec(body)?.[0] ?? "";
		const thTexts = tagTexts(table, "th");
		const tdTexts = tagTexts(table, "td");
		check(
			"表格：<table> 与 <th> 表头存在",
			table !== "" && thTexts.length > 0,
			table === ""
				? "反向 HTML 正文里没有 <table>"
				: `table ${table.length} 字符，th ${thTexts.length} 个［${thTexts.join("｜")}］`,
		);
		const hitTh = EXPECTED_TABLE_HEADERS.filter((want) => thTexts.some((got) => got.includes(want)));
		const hitTd = EXPECTED_TABLE_CELLS.filter((want) => tdTexts.some((got) => got.includes(want)));
		check(
			"表格：表头与单元格文案命中",
			hitTh.length > 0 && hitTd.length > 0,
			`td ${tdTexts.length} 个；表头命中［${hitTh.join("、")}］；单元格命中［${hitTd.join("、")}］`,
		);

		// 6. 关键文本：每条一行，缺哪条一目了然
		for (const want of EXPECTED_TEXT) {
			const hit = text.includes(want);
			check(
				`关键文本命中：「${want}」`,
				hit,
				hit ? "反向 HTML 正文里逐字命中" : `未命中；正文 ${text.length} 字符，开头 120 字：${text.slice(0, 120)}`,
			);
		}

		// 7. 图片：样张确实没图时如实跳过（不改示例 HTML 去凑断言）
		const sampleHasImages = /<img\b/i.test(readFileSync(samplePath, "utf8"));
		const resolvedImages = extracted.images.map((img) => ({
			src: img.src,
			resolved: resolve(dirname(htmlPath), img.src),
		}));
		const brokenImages = resolvedImages.filter((img) => fileSize(img.resolved) === 0);
		if (!sampleHasImages && extracted.images.length === 0) {
			skip(
				"图片：src 以 HTML 目录为基准可解析到真实文件",
				"本次样张无图片（resources/docx-engine/examples/report-sample.html 里没有 <img>），跳过图片断言；引擎 images 为 []。",
			);
		} else {
			check(
				"图片：src 以 HTML 目录为基准可解析到真实文件",
				brokenImages.length === 0 && (!sampleHasImages || extracted.images.length > 0),
				resolvedImages.length === 0
					? "引擎 images 为空，但样张有 <img> —— 图片丢了"
					: resolvedImages
							.map((img) => `${img.src} → ${img.resolved}（${fileSize(img.resolved)} 字节）`)
							.join("；"),
			);
		}

		// 8. 诚实性字段：内容照原样打印，别只报个「通过」
		check(
			"not_restorable 是数组",
			Array.isArray(notRestorable),
			`内容：${JSON.stringify(notRestorable)}（样张干净时预期 []）`,
		);
	}
} catch (err) {
	check("往返链路完整执行（未抛异常）", false, err instanceof Error ? err.message : String(err));
} finally {
	rmSync(workDir, { recursive: true, force: true });
}

console.log(`\n正向 warnings（${forwardWarnings.length} 条）：${forwardWarnings.length === 0 ? "无" : ""}`);
for (const warning of forwardWarnings) console.log(`  - ${warning}`);
console.log(`反向 warnings（${reverseWarnings.length} 条）：${reverseWarnings.length === 0 ? "无" : ""}`);
for (const warning of reverseWarnings) console.log(`  - ${warning}`);

const failed = results.filter((r) => !r.ok);
const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log(`\n${results.length - failed.length}/${results.length} 通过（耗时 ${elapsedSeconds}s）`);
if (skips.length > 0) {
	console.log(`跳过 ${skips.length} 条：${skips.map((s) => s.name).join("、")}`);
}
process.exit(failed.length === 0 ? 0 : 1);
