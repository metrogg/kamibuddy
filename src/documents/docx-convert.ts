/**
 * docx 转换调用：spawn venv Python 跑引擎 CLI，解析 JSON 契约。
 *
 * CLI 契约（引擎 __main__.py 自述，与 WorkBuddy tencent-docx 同款）：
 *   python -m html_to_docx convert input.html -o out.docx [--page-size A4] ...
 *   exit 0 → stdout 一行 JSON：{ success:true, docx_path, warnings, fields }
 *   exit 1 → stderr 一行 JSON：{ success:false, error, markdown_fallback, warnings }
 *
 * cwd 必须是引擎目录（resources/docx-engine）：html_to_docx 包不 pip 安装、
 * 随应用分发，`python -m` 靠 cwd（外加 PYTHONPATH 双保险）找到它。
 *
 * 错误四分类（kind 给上层做呈现分支，message 一律中文、可行动）：
 *   env-not-ready     环境没就绪（ensure 失败，带阶段归因与联网/镜像引导）
 *   convert-failed    引擎非零退出（markdown_fallback 附在 error.markdownFallback，
 *                     工具层如实上抛不静默 —— spec Requirement: docx 转换引擎）
 *   timeout           超 120s（默认；首转含图片下载可能慢，WB 调研结论）
 *   output-too-large  stdout/stderr 超过上限 —— JSON 契约是一行，超出即引擎行为异常
 */

import { spawn } from "node:child_process";
import type { EnsureResult } from "./docx-env.ts";

/* ── run 抽象（带超时与输出上限的 spawn；测试注入点） ───────────────── */

export interface RunRequest {
	readonly command: string;
	readonly args: readonly string[];
	readonly cwd: string;
	readonly env?: Record<string, string>;
	readonly timeoutMs: number;
	readonly maxOutputBytes: number;
}

export interface RunOutcome {
	readonly code: number | null;
	readonly stdout: string;
	readonly stderr: string;
	/** 超时被杀。 */
	readonly timedOut?: boolean;
	/** 输出超上限被杀。 */
	readonly outputTruncated?: boolean;
	/** 进程没能启动（ENOENT 等）。 */
	readonly error?: string;
}

export type RunFn = (req: RunRequest) => Promise<RunOutcome>;

/**
 * 生产 run：与 docx-env 的 defaultSpawn 同源，多两个旋钮 ——
 * 超时杀进程（转换可能因引擎 bug 挂死，不能拖住整个 agent run）、
 * 输出超上限杀进程（契约是一行 JSON，超出即异常）。
 */
export function defaultRun(req: RunRequest): Promise<RunOutcome> {
	return new Promise((resolvePromise) => {
		const child = spawn(req.command, [...req.args], {
			cwd: req.cwd,
			env: req.env === undefined ? process.env : { ...process.env, ...req.env },
			windowsHide: true,
			shell: false,
		});
		let stdout = "";
		let stderr = "";
		let bytes = 0;
		let timedOut = false;
		let outputTruncated = false;
		let settled = false;
		const settle = (outcome: RunOutcome): void => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolvePromise(outcome);
		};
		const onData = (chunk: string, isStdout: boolean): void => {
			bytes += Buffer.byteLength(chunk, "utf8");
			if (bytes > req.maxOutputBytes) {
				outputTruncated = true;
				child.kill();
				return;
			}
			if (isStdout) stdout += chunk;
			else stderr += chunk;
		};
		const timer = setTimeout(() => {
			timedOut = true;
			child.kill();
		}, req.timeoutMs);
		child.stdout.setEncoding("utf8").on("data", (d: string) => onData(d, true));
		child.stderr.setEncoding("utf8").on("data", (d: string) => onData(d, false));
		child.on("error", (err) => {
			settle({ code: null, stdout, stderr, error: err.message });
		});
		child.on("close", (code) => {
			settle({ code, stdout, stderr, timedOut, outputTruncated });
		});
	});
}

/* ── 错误类型与分类 ───────────────────────────────────────────────── */

export type DocxConvertErrorKind =
	| "env-not-ready"
	| "convert-failed"
	| "timeout"
	| "output-too-large";

export class DocxConvertError extends Error {
	constructor(
		readonly kind: DocxConvertErrorKind,
		message: string,
		/** 引擎降级产物（convert-failed 且引擎给了 markdown_fallback 时有值）。 */
		readonly markdownFallback?: string,
	) {
		super(message);
		this.name = "DocxConvertError";
	}
}

/** ensure 失败 → env-not-ready。归因阶段 + 联网/镜像引导 + Markdown 降级建议。 */
export function classifyEnsureError(
	failed: Extract<EnsureResult, { status: "failed" }>,
): DocxConvertError {
	return new DocxConvertError(
		"env-not-ready",
		`docx 生成环境未就绪（${failed.phase}）：${failed.error}\n` +
			"环境修复前请先把内容以 Markdown 形式交付（保存为 .md），并告知用户 docx 环境未就绪的原因。",
	);
}

/* ── 转换 ─────────────────────────────────────────────────────────── */

/** 默认 120s：首次转换可能含图片下载（引擎 image_handler 经 httpx 拉图），偏慢。 */
export const DEFAULT_CONVERT_TIMEOUT_MS = 120_000;
/** JSON 契约是一行：1MB 都嫌多，超出即引擎行为异常。 */
export const DEFAULT_MAX_OUTPUT_BYTES = 1_048_576;

export interface ConvertCliOptions {
	readonly pageSize?: "A4" | "Letter" | "A3";
	readonly orientation?: "portrait" | "landscape";
	/** 页边距，厘米（引擎默认 上下 2.54 / 左右 3.17）。 */
	readonly marginTop?: number;
	readonly marginBottom?: number;
	readonly marginLeft?: number;
	readonly marginRight?: number;
}

export interface ConvertRequest {
	/** venv 解释器（ensureDocxEnv 的产出）。 */
	readonly python: string;
	/** 引擎目录（resources/docx-engine）——CLI 的 cwd 与 PYTHONPATH。 */
	readonly engineDir: string;
	readonly inputPath: string;
	readonly outputPath: string;
	readonly options?: ConvertCliOptions;
	readonly timeoutMs?: number;
	readonly maxOutputBytes?: number;
}

export interface ConvertSuccess {
	readonly docxPath: string;
	readonly warnings: readonly string[];
}

/** CLI 参数组装。可选参数缺省时不传，引擎用自己的默认值（__main__.py show_default）。 */
export function buildConvertArgs(req: ConvertRequest): readonly string[] {
	const args: string[] = ["-m", "html_to_docx", "convert", req.inputPath, "-o", req.outputPath];
	const opts = req.options;
	if (opts?.pageSize !== undefined) args.push("--page-size", opts.pageSize);
	if (opts?.orientation !== undefined) args.push("--orientation", opts.orientation);
	if (opts?.marginTop !== undefined) args.push("--margin-top", String(opts.marginTop));
	if (opts?.marginBottom !== undefined) args.push("--margin-bottom", String(opts.marginBottom));
	if (opts?.marginLeft !== undefined) args.push("--margin-left", String(opts.marginLeft));
	if (opts?.marginRight !== undefined) args.push("--margin-right", String(opts.marginRight));
	return args;
}

function excerpt(text: string, max = 400): string {
	const trimmed = text.trim();
	return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`;
}

/** 契约 JSON 解析：成功行与失败行分开，非 JSON 输出兜底成 convert-failed。 */
function parseSuccessJson(stdout: string): ConvertSuccess {
	try {
		const parsed: unknown = JSON.parse(stdout.trim());
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			"docx_path" in parsed &&
			typeof (parsed as { docx_path: unknown }).docx_path === "string"
		) {
			const record = parsed as { docx_path: string; warnings?: unknown };
			return {
				docxPath: record.docx_path,
				warnings: Array.isArray(record.warnings)
					? record.warnings.filter((w): w is string => typeof w === "string")
					: [],
			};
		}
	} catch {
		// fallthrough
	}
	throw new DocxConvertError(
		"convert-failed",
		`引擎成功退出但 stdout 不是契约 JSON：${excerpt(stdout)}`,
	);
}

function parseFailureJson(stderr: string, code: number | null): DocxConvertError {
	try {
		const parsed: unknown = JSON.parse(stderr.trim());
		if (typeof parsed === "object" && parsed !== null && "error" in parsed) {
			const record = parsed as { error: unknown; markdown_fallback?: unknown };
			const fallback =
				typeof record.markdown_fallback === "string" && record.markdown_fallback !== ""
					? record.markdown_fallback
					: undefined;
			return new DocxConvertError(
				"convert-failed",
				`docx 转换失败：${typeof record.error === "string" ? record.error : "引擎未给出原因"}`,
				fallback,
			);
		}
	} catch {
		// fallthrough
	}
	return new DocxConvertError(
		"convert-failed",
		`引擎以退出码 ${String(code)} 失败且 stderr 不是契约 JSON：${excerpt(stderr)}`,
	);
}

/**
 * 跑一次转换。成功返回产物路径与引擎警告；失败一律抛 DocxConvertError（带分类）。
 * 调用前必须先 ensureDocxEnv 就绪（或走工具层的组合入口）。
 */
export async function convertHtmlToDocx(req: ConvertRequest, run: RunFn): Promise<ConvertSuccess> {
	const outcome = await run({
		command: req.python,
		args: buildConvertArgs(req),
		cwd: req.engineDir,
		env: { PYTHONPATH: req.engineDir },
		timeoutMs: req.timeoutMs ?? DEFAULT_CONVERT_TIMEOUT_MS,
		maxOutputBytes: req.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES,
	});

	if (outcome.timedOut === true) {
		throw new DocxConvertError(
			"timeout",
			`docx 转换超时（>${String(req.timeoutMs ?? DEFAULT_CONVERT_TIMEOUT_MS)}ms）。` +
				"首次转换含图片下载可能较慢，可重试；反复超时请检查 HTML 里的远程图片是否可达。",
		);
	}
	if (outcome.outputTruncated === true) {
		throw new DocxConvertError(
			"output-too-large",
			`引擎输出超过上限（${String(req.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES)} 字节），` +
				"不符合一行 JSON 的契约，按引擎行为异常处理。",
		);
	}
	if (outcome.code === null) {
		throw new DocxConvertError(
			"convert-failed",
			`venv Python 未能启动：${outcome.error ?? "未知原因"}（${req.python}）。` +
				"环境可能在 ensure 之后被破坏，请重试（会先重新 ensure）。",
		);
	}
	if (outcome.code === 0) return parseSuccessJson(outcome.stdout);
	throw parseFailureJson(outcome.stderr, outcome.code);
}
