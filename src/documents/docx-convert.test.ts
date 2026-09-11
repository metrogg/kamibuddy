/**
 * docx 转换调用的测试。
 *
 * CLI 契约（引擎 __main__.py 自述）：exit 0 stdout JSON / exit 1 stderr JSON
 * 含 markdown_fallback。这里钉住三件事：
 *   - 参数组装（cwd=引擎目录、PYTHONPATH、可选页面参数只在给出时传）
 *   - JSON 契约解析（成功 / 失败含 markdown_fallback / 非 JSON 输出兜底）
 *   - 错误四分类（env-not-ready / convert-failed / timeout / output-too-large）
 */

import { resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import {
	buildConvertArgs,
	classifyEnsureError,
	convertHtmlToDocx,
	DEFAULT_CONVERT_TIMEOUT_MS,
	DocxConvertError,
	type ConvertRequest,
	type RunFn,
	type RunOutcome,
	type RunRequest,
} from "./docx-convert.ts";

const ENGINE = resolve(sep, "app", "resources", "docx-engine");
const VENV_PY = resolve(sep, "users", "foo", ".venv-html-to-docx", "Scripts", "python.exe");
const INPUT = resolve(sep, "ws", "report.html");
const OUTPUT = resolve(sep, "ws", "report.docx");

function req(overrides: Partial<ConvertRequest> = {}): ConvertRequest {
	return {
		python: VENV_PY,
		engineDir: ENGINE,
		inputPath: INPUT,
		outputPath: OUTPUT,
		...overrides,
	};
}

/** fake run：固定返回一个 outcome，同时捕获请求。 */
function runReturning(outcome: RunOutcome): { requests: RunRequest[]; run: RunFn } {
	const requests: RunRequest[] = [];
	const run: RunFn = (r) => {
		requests.push(r);
		return Promise.resolve(outcome);
	};
	return { requests, run };
}

const SUCCESS_JSON = JSON.stringify({
	success: true,
	docx_path: OUTPUT,
	warnings: ["图片 x 超出页宽已缩放"],
	fields: [],
});

describe("参数组装", () => {
	it("最小调用：-m html_to_docx convert in -o out，不带可选参数", () => {
		expect(buildConvertArgs(req())).toEqual([
			"-m",
			"html_to_docx",
			"convert",
			INPUT,
			"-o",
			OUTPUT,
		]);
	});

	it("页面参数只在给出时传，缺省由引擎默认接管", () => {
		const args = buildConvertArgs(
			req({
				options: {
					pageSize: "Letter",
					orientation: "landscape",
					marginTop: 2,
					marginBottom: 2,
					marginLeft: 3,
					marginRight: 3,
				},
			}),
		);
		expect(args).toContain("--page-size");
		expect(args[args.indexOf("--page-size") + 1]).toBe("Letter");
		expect(args[args.indexOf("--orientation") + 1]).toBe("landscape");
		expect(args[args.indexOf("--margin-top") + 1]).toBe("2");
		expect(args[args.indexOf("--margin-right") + 1]).toBe("3");
	});

	it("spawn 形状：command=venv python，cwd=引擎目录，env 带 PYTHONPATH，默认超时 120s", async () => {
		const { requests, run } = runReturning({ code: 0, stdout: SUCCESS_JSON, stderr: "" });
		await convertHtmlToDocx(req(), run);

		const spawned = requests[0];
		expect(spawned?.command).toBe(VENV_PY);
		expect(spawned?.cwd).toBe(ENGINE);
		expect(spawned?.env?.["PYTHONPATH"]).toBe(ENGINE);
		// 默认 120s 的理由：首转含图片下载可能慢（WB 调研结论）。
		expect(spawned?.timeoutMs).toBe(DEFAULT_CONVERT_TIMEOUT_MS);
		expect(spawned?.timeoutMs).toBe(120_000);
	});
});

describe("JSON 契约解析", () => {
	it("exit 0 + 契约 JSON → 成功，docx_path 与 warnings 带出", async () => {
		const { run } = runReturning({ code: 0, stdout: `${SUCCESS_JSON}\n`, stderr: "" });
		const result = await convertHtmlToDocx(req(), run);

		expect(result.docxPath).toBe(OUTPUT);
		expect(result.warnings).toEqual(["图片 x 超出页宽已缩放"]);
	});

	it("exit 1 + 契约 JSON → convert-failed，markdown_fallback 如实带出", async () => {
		const stderr = JSON.stringify({
			success: false,
			error: "HTML 解析失败：标签未闭合",
			markdown_fallback: "# 周报\n\n本周内容……",
			warnings: [],
		});
		const { run } = runReturning({ code: 1, stdout: "", stderr });

		const error = await convertHtmlToDocx(req(), run).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(DocxConvertError);
		const convertError = error as DocxConvertError;
		expect(convertError.kind).toBe("convert-failed");
		expect(convertError.message).toContain("标签未闭合");
		expect(convertError.markdownFallback).toBe("# 周报\n\n本周内容……");
	});

	it("exit 0 但 stdout 不是 JSON → convert-failed（契约破坏，不静默猜）", async () => {
		const { run } = runReturning({ code: 0, stdout: "一些意料之外的日志", stderr: "" });
		const error = await convertHtmlToDocx(req(), run).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(DocxConvertError);
		expect((error as DocxConvertError).kind).toBe("convert-failed");
		expect((error as DocxConvertError).message).toContain("契约 JSON");
	});

	it("exit 1 且 stderr 不是 JSON → convert-failed，原始摘要进消息", async () => {
		const { run } = runReturning({ code: 1, stdout: "", stderr: "Traceback (most recent call last): ..." });
		const error = await convertHtmlToDocx(req(), run).catch((e: unknown) => e);

		expect((error as DocxConvertError).kind).toBe("convert-failed");
		expect((error as DocxConvertError).message).toContain("Traceback");
		expect((error as DocxConvertError).markdownFallback).toBeUndefined();
	});
});

describe("错误分类", () => {
	it("超时被杀 → timeout", async () => {
		const { run } = runReturning({ code: null, stdout: "", stderr: "", timedOut: true });
		const error = await convertHtmlToDocx(req(), run).catch((e: unknown) => e);

		expect((error as DocxConvertError).kind).toBe("timeout");
	});

	it("输出超上限被杀 → output-too-large", async () => {
		const { run } = runReturning({ code: null, stdout: "", stderr: "", outputTruncated: true });
		const error = await convertHtmlToDocx(req(), run).catch((e: unknown) => e);

		expect((error as DocxConvertError).kind).toBe("output-too-large");
	});

	it("解释器起不来 → convert-failed（提示重试会重新 ensure）", async () => {
		const { run } = runReturning({ code: null, stdout: "", stderr: "", error: "spawn ENOENT" });
		const error = await convertHtmlToDocx(req(), run).catch((e: unknown) => e);

		expect((error as DocxConvertError).kind).toBe("convert-failed");
		expect((error as DocxConvertError).message).toContain("ENOENT");
	});

	it("ensure 失败 → env-not-ready（带阶段归因与 Markdown 降级建议）", () => {
		const error = classifyEnsureError({
			status: "failed",
			phase: "install-deps",
			error: "依赖安装失败：connection refused",
		});

		expect(error.kind).toBe("env-not-ready");
		expect(error.message).toContain("install-deps");
		expect(error.message).toContain("Markdown");
	});
});
