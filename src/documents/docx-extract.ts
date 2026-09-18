/**
 * docx 版式提取调用：spawn venv Python 跑反向引擎 CLI，解析 JSON 契约。
 *
 * CLI 契约（引擎 __main__.py 自述，与正向同形）：
 *   python -m docx_to_html extract input.docx -o out.html [--assets-dir DIR]
 *   exit 0 → stdout 一行 JSON：
 *            { success:true, html_path, assets_dir, images:[{src,file,source}], warnings, not_restorable }
 *   exit 1 → stderr 一行 JSON：{ success:false, error, warnings }
 *
 * cwd 必须是引擎目录（resources/docx-engine）：docx_to_html 包不 pip 安装、
 * 随应用分发，`python -m` 靠 cwd（外加 PYTHONPATH 双保险）找到它 —— 与正向同法，
 * 两个模块共用同一个托管 venv（docx-env.ts），本层不新增任何依赖。
 *
 * 错误五分类（kind 给上层做呈现分支，message 一律中文、可行动）：
 *   env-not-ready     环境没就绪（ensure 失败，带阶段归因与联网/镜像引导）
 *   input-invalid     输入不可提取（路径不存在 / 不是 .docx / 不是 zip / 主文档缺失 /
 *                     python-docx 解析失败）—— 这类**重试无用**，只能换文件
 *   extract-failed    引擎其他失败（含写产物失败）—— 文档里有引擎未覆盖的结构
 *   timeout           超 120s（默认；大文档 + 大量图片可能慢）
 *   output-too-large  stdout/stderr 超过上限 —— JSON 契约是一行，超出即引擎行为异常
 *
 * 分类靠引擎 failure JSON 的 error 文案前缀（真是跨语言契约的一处脆弱点）：
 * 前缀取自 docx_to_html/package.py 与 extractor.py 的 `DocxExtractError` 消息。
 * 引擎改措辞时最坏退化成 extract-failed —— error 原文照样原样上抛给模型，
 * 只是建议文案退回通用那条，不会把失败说成成功。
 */

import { type RunFn } from "./docx-convert.ts";
import type { EnsureResult } from "./docx-env.ts";

/**
 * spawn 那一层（RunFn / RunRequest / RunOutcome / defaultRun）不重写：两个方向跑的
 * 是同一个 venv、同一种「受控 spawn + 超时 + 输出上限」，抄一遍只会多一份要同步维护
 * 的实现。这里重导出，让工具层的 import 与正向同形（都从自己的 documents 层入口拿）。
 */
export { defaultRun, type RunFn, type RunOutcome, type RunRequest } from "./docx-convert.ts";

/* ── 错误类型与分类 ───────────────────────────────────────────────── */

export type DocxExtractErrorKind =
	| "env-not-ready"
	| "input-invalid"
	| "extract-failed"
	| "timeout"
	| "output-too-large";

export class DocxExtractError extends Error {
	constructor(
		readonly kind: DocxExtractErrorKind,
		message: string,
		/** 引擎在失败前已发出的警告（契约里 failure JSON 也带 warnings），如实上抛不吞。 */
		readonly warnings: readonly string[] = [],
	) {
		super(message);
		this.name = "DocxExtractError";
	}
}

/**
 * ensure 失败 → env-not-ready。归因阶段 + 联网/镜像引导。
 *
 * 与正向的差别：这里没有 Markdown 降级产物可交付，建议改成「先按 read_document
 * 读文本继续任务的其余部分」—— 不能承诺一个本就不存在的东西。
 */
export function classifyEnsureError(
	failed: Extract<EnsureResult, { status: "failed" }>,
): DocxExtractError {
	return new DocxExtractError(
		"env-not-ready",
		`docx 提取环境未就绪（${failed.phase}）：${failed.error}\n` +
			"请如实告知用户环境准备失败的原因，不要反复重试（每次都会重跑安装）。" +
			"需要继续原任务时，可改用 read_document 读取该文档的文本内容。",
	);
}

/** 输入类失败的文案前缀（取自引擎 package.py / extractor.py 的 DocxExtractError）。 */
const INPUT_ERROR_PREFIXES: readonly string[] = [
	"输入路径不存在",
	"输入路径不是文件",
	"输入不是 .docx",
	"不是有效的 .docx",
	"无法读取",
	"无法解析",
	"缺少输出 HTML 路径",
];

function classifyEngineError(error: string): DocxExtractErrorKind {
	return INPUT_ERROR_PREFIXES.some((prefix) => error.startsWith(prefix))
		? "input-invalid"
		: "extract-failed";
}

function failureMessage(kind: DocxExtractErrorKind, error: string): string {
	const detail = error === "" ? "引擎未给出原因" : error;
	if (kind === "input-invalid") {
		return (
			`docx 提取失败（输入不可用）：${detail}\n` +
			"请向用户如实说明是哪个文件、什么问题；只支持 .docx（旧版 .doc 请先另存为 .docx）。" +
			"这类失败重试无用，不要反复调用。"
		);
	}
	return (
		`docx 提取失败：${detail}\n` +
		"请如实把原因转述给用户；可改用 read_document 读取文本内容继续任务的其余部分，不要重复调用。"
	);
}

/* ── 提取 ─────────────────────────────────────────────────────────── */

/** 默认 120s：本地读取，但大文档 + 大量图片落盘可能偏慢（与正向同一档）。 */
export const DEFAULT_EXTRACT_TIMEOUT_MS = 120_000;
/** JSON 契约是一行：1MB 都嫌多，超出即引擎行为异常。 */
export const DEFAULT_MAX_OUTPUT_BYTES = 1_048_576;

export interface ExtractRequest {
	/** venv 解释器（ensurePythonRuntime 的产出）。 */
	readonly python: string;
	/** 引擎目录（resources/docx-engine）——CLI 的 cwd 与 PYTHONPATH。 */
	readonly engineDir: string;
	readonly docxPath: string;
	/** 产出 HTML 的路径。引擎不猜落点，缺它引擎会响亮报错。 */
	readonly outputPath: string;
	/** 图片目录；省略时引擎按 `<html 目录>/<stem>_assets` 落。 */
	readonly assetsDir?: string;
	readonly timeoutMs?: number;
	readonly maxOutputBytes?: number;
}

export interface ExtractedImage {
	/** HTML 里的引用（相对 HTML 文件所在目录，由引擎算好）。 */
	readonly src: string;
	/** 落盘绝对路径。 */
	readonly file: string;
	/** docx 包内条目名，如 word/media/image1.png。 */
	readonly source: string;
}

export interface ExtractSuccess {
	readonly htmlPath: string;
	readonly assetsDir: string;
	readonly images: readonly ExtractedImage[];
	readonly warnings: readonly string[];
	/** 已知不可复原项（页码/页眉页脚/分节/浮动对象/域代码/图表），必须如实转述。 */
	readonly notRestorable: readonly string[];
}

/** CLI 参数组装。可选参数缺省时不传，引擎用自己的默认值。 */
export function buildExtractArgs(req: ExtractRequest): readonly string[] {
	const args: string[] = ["-m", "docx_to_html", "extract", req.docxPath, "-o", req.outputPath];
	if (req.assetsDir !== undefined) args.push("--assets-dir", req.assetsDir);
	return args;
}

function excerpt(text: string, max = 400): string {
	const trimmed = text.trim();
	return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`;
}

function parseStringArray(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/** 契约 JSON 解析：成功行与失败行分开，非 JSON 输出兜底成 extract-failed。 */
function parseSuccessJson(stdout: string): ExtractSuccess {
	try {
		const parsed: unknown = JSON.parse(stdout.trim());
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			"html_path" in parsed &&
			typeof (parsed as { html_path: unknown }).html_path === "string"
		) {
			const record = parsed as {
				html_path: string;
				assets_dir?: unknown;
				images?: unknown;
				warnings?: unknown;
				not_restorable?: unknown;
			};
			return {
				htmlPath: record.html_path,
				assetsDir: typeof record.assets_dir === "string" ? record.assets_dir : "",
				images: parseImages(record.images),
				warnings: parseStringArray(record.warnings),
				notRestorable: parseStringArray(record.not_restorable),
			};
		}
	} catch {
		// fallthrough
	}
	throw new DocxExtractError(
		"extract-failed",
		`引擎成功退出但 stdout 不是契约 JSON：${excerpt(stdout)}`,
	);
}

/** images 条目里三个字段都是字符串才算数；缺字段的条目丢弃而不是编空串。 */
function parseImages(value: unknown): ExtractedImage[] {
	if (!Array.isArray(value)) return [];
	const images: ExtractedImage[] = [];
	for (const item of value) {
		if (typeof item !== "object" || item === null) continue;
		const { src, file, source } = item as Record<string, unknown>;
		if (typeof src !== "string" || typeof file !== "string" || typeof source !== "string") continue;
		images.push({ src, file, source });
	}
	return images;
}

function parseFailureJson(stderr: string, code: number | null): DocxExtractError {
	try {
		const parsed: unknown = JSON.parse(stderr.trim());
		if (typeof parsed === "object" && parsed !== null && "error" in parsed) {
			const record = parsed as { error: unknown; warnings?: unknown };
			const error = typeof record.error === "string" ? record.error : "";
			const kind = classifyEngineError(error);
			return new DocxExtractError(kind, failureMessage(kind, error), parseStringArray(record.warnings));
		}
	} catch {
		// fallthrough
	}
	return new DocxExtractError(
		"extract-failed",
		`引擎以退出码 ${String(code)} 失败且 stderr 不是契约 JSON：${excerpt(stderr)}`,
	);
}

/**
 * 跑一次提取。成功返回产物路径、图片清单、警告与不可复原项；
 * 失败一律抛 DocxExtractError（带分类与可执行建议）。
 * 调用前必须先 ensurePythonRuntime 就绪（或走工具层的组合入口）。
 */
export async function extractDocxToHtml(
	req: ExtractRequest,
	run: RunFn,
): Promise<ExtractSuccess> {
	const outcome = await run({
		command: req.python,
		args: buildExtractArgs(req),
		cwd: req.engineDir,
		env: { PYTHONPATH: req.engineDir },
		timeoutMs: req.timeoutMs ?? DEFAULT_EXTRACT_TIMEOUT_MS,
		maxOutputBytes: req.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES,
	});

	if (outcome.timedOut === true) {
		throw new DocxExtractError(
			"timeout",
			`docx 提取超时（>${String(req.timeoutMs ?? DEFAULT_EXTRACT_TIMEOUT_MS)}ms）。` +
				"大文档或含大量图片时可能偏慢，可重试一次；反复超时请如实告知用户。",
		);
	}
	if (outcome.outputTruncated === true) {
		throw new DocxExtractError(
			"output-too-large",
			`引擎输出超过上限（${String(req.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES)} 字节），` +
				"不符合一行 JSON 的契约，按引擎行为异常处理。",
		);
	}
	if (outcome.code === null) {
		throw new DocxExtractError(
			"extract-failed",
			`venv Python 未能启动：${outcome.error ?? "未知原因"}（${req.python}）。` +
				"环境可能在 ensure 之后被破坏，请重试（会先重新 ensure）。",
		);
	}
	if (outcome.code === 0) return parseSuccessJson(outcome.stdout);
	throw parseFailureJson(outcome.stderr, outcome.code);
}
