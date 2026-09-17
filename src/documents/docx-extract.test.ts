/**
 * docx 版式提取调用的测试。
 *
 * CLI 契约（引擎 __main__.py 自述）：exit 0 stdout JSON（含 images / not_restorable）/
 * exit 1 stderr JSON。这里钉住四件事：
 *   - 参数组装（cwd=引擎目录、PYTHONPATH、--assets-dir 只在给出时传）
 *   - JSON 契约解析（成功清单 / 失败带 warnings / 非 JSON 输出兜底）
 *   - 错误五分类（env-not-ready / input-invalid / extract-failed / timeout / output-too-large）
 *   - 每类的建议文案可行动（输入类明说「重试无用」）
 */

import { resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import {
	buildExtractArgs,
	classifyEnsureError,
	DEFAULT_EXTRACT_TIMEOUT_MS,
	DocxExtractError,
	extractDocxToHtml,
	type ExtractRequest,
	type RunFn,
	type RunOutcome,
	type RunRequest,
} from "./docx-extract.ts";

const ENGINE = resolve(sep, "app", "resources", "docx-engine");
const VENV_PY = resolve(sep, "users", "foo", ".venv-html-to-docx", "Scripts", "python.exe");
const DOCX = resolve(sep, "ws", "原文.docx");
const HTML = resolve(sep, "ws", "out", "原文.html");

function req(overrides: Partial<ExtractRequest> = {}): ExtractRequest {
	return {
		python: VENV_PY,
		engineDir: ENGINE,
		docxPath: DOCX,
		outputPath: HTML,
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
	html_path: HTML,
	assets_dir: resolve(sep, "ws", "out", "原文_assets"),
	images: [
		{
			src: "原文_assets/images/image1.png",
			file: resolve(sep, "ws", "out", "原文_assets", "images", "image1.png"),
			source: "word/media/image1.png",
		},
	],
	warnings: ["图片格式 .emf 浏览器不能直接显示（已原样复制）"],
	not_restorable: ["页眉页脚", "页码"],
});

describe("参数组装", () => {
	it("最小调用：-m docx_to_html extract in -o out，不带 --assets-dir", () => {
		expect(buildExtractArgs(req())).toEqual([
			"-m",
			"docx_to_html",
			"extract",
			DOCX,
			"-o",
			HTML,
		]);
	});

	it("--assets-dir 只在给出时传，缺省由引擎的 `<html 目录>/<stem>_assets` 接管", () => {
		const assets = resolve(sep, "ws", "assets");
		const args = buildExtractArgs(req({ assetsDir: assets }));
		expect(args[args.indexOf("--assets-dir") + 1]).toBe(assets);
	});

	it("spawn 形状：command=venv python，cwd=引擎目录，env 带 PYTHONPATH，默认超时 120s", async () => {
		const { requests, run } = runReturning({ code: 0, stdout: SUCCESS_JSON, stderr: "" });
		await extractDocxToHtml(req(), run);

		const spawned = requests[0];
		expect(spawned?.command).toBe(VENV_PY);
		expect(spawned?.cwd).toBe(ENGINE);
		expect(spawned?.env?.["PYTHONPATH"]).toBe(ENGINE);
		expect(spawned?.timeoutMs).toBe(DEFAULT_EXTRACT_TIMEOUT_MS);
		expect(spawned?.timeoutMs).toBe(120_000);
	});
});

describe("JSON 契约解析", () => {
	it("exit 0 + 契约 JSON → 成功：HTML/图片目录/清单/警告/不可复原项都带出", async () => {
		const { run } = runReturning({ code: 0, stdout: `${SUCCESS_JSON}\n`, stderr: "" });
		const result = await extractDocxToHtml(req(), run);

		expect(result.htmlPath).toBe(HTML);
		expect(result.assetsDir).toContain("原文_assets");
		expect(result.images).toEqual([
			{
				src: "原文_assets/images/image1.png",
				file: resolve(sep, "ws", "out", "原文_assets", "images", "image1.png"),
				source: "word/media/image1.png",
			},
		]);
		expect(result.warnings).toHaveLength(1);
		expect(result.notRestorable).toEqual(["页眉页脚", "页码"]);
	});

	it("images 里字段不全的条目丢弃，不编空串", async () => {
		const stdout = JSON.stringify({
			success: true,
			html_path: HTML,
			assets_dir: "x",
			images: [{ src: "a.png" }, { src: "b.png", file: "f", source: "s" }],
			warnings: [],
			not_restorable: [],
		});
		const { run } = runReturning({ code: 0, stdout, stderr: "" });
		const result = await extractDocxToHtml(req(), run);

		expect(result.images).toHaveLength(1);
		expect(result.images[0]?.src).toBe("b.png");
	});

	it("exit 1 + 契约 JSON（输入类文案）→ input-invalid，警告如实带出且提示重试无用", async () => {
		const stderr = JSON.stringify({
			success: false,
			error: `不是有效的 .docx：${DOCX} 不是 zip 容器（旧版 .doc 或文件损坏）`,
			warnings: ["已读取 3 个段落"],
		});
		const { run } = runReturning({ code: 1, stdout: "", stderr });

		const error = await extractDocxToHtml(req(), run).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(DocxExtractError);
		const extractError = error as DocxExtractError;
		expect(extractError.kind).toBe("input-invalid");
		expect(extractError.message).toContain("不是 zip 容器");
		expect(extractError.warnings).toEqual(["已读取 3 个段落"]);
		expect(extractError.message).toContain("重试无用");
	});

	it("exit 1 + 契约 JSON（解析类文案）→ extract-failed，建议改用 read_document", async () => {
		const stderr = JSON.stringify({
			success: false,
			error: "提取失败（AttributeError）：段落结构异常",
			warnings: [],
		});
		const { run } = runReturning({ code: 1, stdout: "", stderr });

		const error = await extractDocxToHtml(req(), run).catch((e: unknown) => e);
		const extractError = error as DocxExtractError;
		expect(extractError.kind).toBe("extract-failed");
		expect(extractError.message).toContain("段落结构异常");
		expect(extractError.message).toContain("read_document");
	});

	it("exit 0 但 stdout 不是 JSON → extract-failed（契约破坏，不静默猜）", async () => {
		const { run } = runReturning({ code: 0, stdout: "一些意料之外的日志", stderr: "" });
		const error = await extractDocxToHtml(req(), run).catch((e: unknown) => e);

		expect((error as DocxExtractError).kind).toBe("extract-failed");
		expect((error as DocxExtractError).message).toContain("契约 JSON");
	});

	it("exit 1 且 stderr 不是 JSON → extract-failed，原始摘要进消息", async () => {
		const { run } = runReturning({ code: 1, stdout: "", stderr: "Traceback (most recent call last): ..." });
		const error = await extractDocxToHtml(req(), run).catch((e: unknown) => e);

		expect((error as DocxExtractError).kind).toBe("extract-failed");
		expect((error as DocxExtractError).message).toContain("Traceback");
	});
});

describe("错误分类", () => {
	it("超时被杀 → timeout", async () => {
		const { run } = runReturning({ code: null, stdout: "", stderr: "", timedOut: true });
		const error = await extractDocxToHtml(req(), run).catch((e: unknown) => e);

		expect((error as DocxExtractError).kind).toBe("timeout");
	});

	it("输出超上限被杀 → output-too-large", async () => {
		const { run } = runReturning({ code: null, stdout: "", stderr: "", outputTruncated: true });
		const error = await extractDocxToHtml(req(), run).catch((e: unknown) => e);

		expect((error as DocxExtractError).kind).toBe("output-too-large");
	});

	it("解释器起不来 → extract-failed（提示重试会重新 ensure）", async () => {
		const { run } = runReturning({ code: null, stdout: "", stderr: "", error: "spawn ENOENT" });
		const error = await extractDocxToHtml(req(), run).catch((e: unknown) => e);

		expect((error as DocxExtractError).kind).toBe("extract-failed");
		expect((error as DocxExtractError).message).toContain("ENOENT");
	});

	it("ensure 失败 → env-not-ready（带阶段归因，且不承诺不存在的降级产物）", () => {
		const error = classifyEnsureError({
			status: "failed",
			phase: "install-deps",
			error: "依赖安装失败：connection refused",
		});

		expect(error.kind).toBe("env-not-ready");
		expect(error.message).toContain("install-deps");
		expect(error.message).toContain("read_document");
	});
});
