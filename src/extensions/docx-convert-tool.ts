/**
 * docx 生成工具扩展：docx_convert。
 *
 * 与 web-tools.ts / doc-read-tool.ts 同一套两层结构：documents/ 是纯函数层
 * （状态机、CLI 契约、错误分类全在那边，可单测），本文件只做三件事 ——
 * 注册工具、把调用参数译成 documents 层请求、把结果与错误排成模型可读的文本。
 *
 * 转换调用受控（spec Requirement: 转换调用受控）：引擎由 daemon 进程内
 * 受控 spawn 调起（命令与参数写死在 documents/docx-convert.ts，模型只能给
 * HTML 输入路径与产物路径），不经 agent 的 powershell 自由 shell ——
 * WorkBuddy 链路里模型直接 bash 调 venv python，我们没有 bash 那条路，
 * 这是平台约束不是合规约束（spec.md「What Changes」）。
 *
 * 环境准备（2026-09-18 阶段 7 改口径）：Python 运行时**纯按需** —— 不会自动下载，
 * 未安装时 ensure 会如实返回失败，本工具据此报出「到设置 → 内置运行时点安装」的引导。
 * 解释器来自**托管运行时**（core/runtimes/python.ts：托管根
 * `<configDir>/runtimes/python/<version>/` + current 指针，兼容 HTML_TO_DOCX_VENV
 * 覆盖口与既有 ~/.venv-html-to-docx 的复用），本文件不自己拼 venv 路径。
 * 环境装不上（无外网等）如实报错并建议 Markdown 降级交付，
 * 不静默吞（spec Scenario: 无外网/安装失败时返回明确降级）。
 *
 * ── 模型体验契约（scripts/check-model-experience.ts 机械校验；改行为必须同步改这里）──
 * What the model sees: docx_convert 的名称、description（含「Python 环境按需安装、不会自动下载」的如实说明）与
 * 参数 schema；成功时返回一条 JSON 文本（docx_path / warnings / 下一步提示），失败时报错文案
 * 可能附带引擎给的 Markdown 降级内容（上限 FALLBACK_MESSAGE_CAP = 16k 字符，超出截断并标注）。
 * Token effect: 定义常驻；成功返回很短（路径 + 警告）；**失败路径可能一次带上万字符**的降级正文
 * （那是刻意给的救援内容 —— 让模型能存成 .md 交付，而不是空手报错）。
 * KV Cache effect: 定义字面量会话内恒定 ⇒ 前缀稳定；结果追加在历史之后，不动既有前缀。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
	classifyEnsureError,
	convertHtmlToDocx,
	defaultRun,
	DocxConvertError,
	type ConvertCliOptions,
	type ConvertRequest,
	type ConvertSuccess,
	type RunFn,
} from "../documents/docx-convert.ts";
import { defaultSpawn, type EnsureResult, type SpawnFn } from "../documents/docx-env.ts";
import {
	defaultPythonRuntimeOptions,
	ensurePythonRuntime,
	type RuntimeOptions,
} from "../core/runtimes/python.ts";
import { clipAuditDetail, type AuditSink } from "../shared/audit.ts";

export interface DocxConvertToolOptions {
	/** 引擎目录（resources/docx-engine）。 */
	readonly engineDir: string;
	readonly homeDir: string;
	/** 缺省 process.platform；测试注入。 */
	readonly platform?: string;
	/** 测试注入（状态机全分支在 documents 层已测，这里只测接缝）。 */
	readonly ensure?: (options: RuntimeOptions, spawn: SpawnFn) => Promise<EnsureResult>;
	/** 测试注入。 */
	readonly convert?: (req: ConvertRequest, run: RunFn) => Promise<ConvertSuccess>;
	/**
	 * 审计写入通道 —— 运行时一类的写入点之一（spec: add-managed-runtimes 阶段 4）：
	 * 环境装不上是用户真会遇到的那种「运行时失败」，只记启动预热的话，
	 * 「预热时好好的、用着用着环境没了」这条路径在审计里就是空白。
	 * 注入而非直接写盘：本文件的单测会跑 ensure 失败分支（污染真实配置目录）。
	 */
	readonly onAudit?: AuditSink;
}

/** 降级 Markdown 附进错误消息的上限：够模型救回内容交付 .md，又不糊满上下文。 */
const FALLBACK_MESSAGE_CAP = 16_000;

export function createDocxConvertTool(options: DocxConvertToolOptions) {
	return (pi: ExtensionAPI): void => {
		pi.registerTool({
			name: "docx_convert",
			label: "生成 Word 文档",
			description:
				"把 HTML 文件转换为 Word .docx 文档。输入是已经写好的 HTML 文件（文档排版流程的产物），" +
				"输出 .docx。可选页面参数：A4/Letter/A3、纵向/横向、页边距（厘米）。" +
				"Python 环境按需安装、不会自动下载：尚未安装时本工具会返回原因与「到设置 → 内置运行时点安装」的引导。" +
				"环境不可用或转换失败时会返回原因，转换失败可能附带 Markdown 降级内容 —— 应保存为 .md 交付并说明原因。",
			promptSnippet:
				"docx_convert: 把排版好的 HTML 转成 .docx（htmlPath → outputPath），成功后用 present_files 交付",
			promptGuidelines: [
				"转换成功后必须经 present_files 把 .docx 交付给用户；中间态 HTML 不交付。",
				"同一处失败不要反复重试：环境类失败按错误里的引导告知用户，转换类失败用附带的 Markdown 降级交付。",
			],
			parameters: Type.Object({
				htmlPath: Type.String({ description: "输入 HTML 文件的绝对路径。" }),
				outputPath: Type.String({ description: "输出 .docx 的绝对路径（写工作区产物文件档位判定）。" }),
				pageSize: Type.Optional(
					Type.Union([Type.Literal("A4"), Type.Literal("Letter"), Type.Literal("A3")], {
						description: "页面大小，缺省 A4。",
					}),
				),
				orientation: Type.Optional(
					Type.Union([Type.Literal("portrait"), Type.Literal("landscape")], {
						description: "页面方向，缺省 portrait（纵向）。",
					}),
				),
				marginTop: Type.Optional(Type.Number({ description: "上边距，厘米（缺省 2.54）。" })),
				marginBottom: Type.Optional(Type.Number({ description: "下边距，厘米（缺省 2.54）。" })),
				marginLeft: Type.Optional(Type.Number({ description: "左边距，厘米（缺省 3.17）。" })),
				marginRight: Type.Optional(Type.Number({ description: "右边距，厘米（缺省 3.17）。" })),
			}),
			async execute(_toolCallId, params) {
				const runtimeOptions = defaultPythonRuntimeOptions({
					engineDir: options.engineDir,
					homeDir: options.homeDir,
					platform: options.platform ?? process.platform,
				});
				const ensure = options.ensure ?? ensurePythonRuntime;
				// 幂等**探测**（2026-09-18 起只探不装）：已就绪秒退；未安装 / 不可用抛
				// env-not-ready，文案里带「请用户到设置页点安装」——运行时纯按需，绝不自动下载。
				const env = await ensure(runtimeOptions, defaultSpawn);
				if (env.status !== "ready") {
					options.onAudit?.({
						category: "runtime",
						outcome: "failed",
						detail: clipAuditDetail(`docx 生成运行时未就绪（${env.phase}）：${env.error}`),
					});
					throw classifyEnsureError(env);
				}

				const convert = options.convert ?? convertHtmlToDocx;
				const cliOptions: ConvertCliOptions = {
					...(params.pageSize !== undefined ? { pageSize: params.pageSize } : {}),
					...(params.orientation !== undefined ? { orientation: params.orientation } : {}),
					...(params.marginTop !== undefined ? { marginTop: params.marginTop } : {}),
					...(params.marginBottom !== undefined ? { marginBottom: params.marginBottom } : {}),
					...(params.marginLeft !== undefined ? { marginLeft: params.marginLeft } : {}),
					...(params.marginRight !== undefined ? { marginRight: params.marginRight } : {}),
				};
				try {
					const result = await convert(
						{
							python: env.python,
							engineDir: options.engineDir,
							inputPath: params.htmlPath,
							outputPath: params.outputPath,
							options: cliOptions,
						},
						defaultRun,
					);
					return {
						content: [
							{
								type: "text" as const,
								text: JSON.stringify({
									type: "docx_convert_result",
									docx_path: result.docxPath,
									warnings: result.warnings,
									message: "转换成功，请用 present_files 把该 docx 交付给用户。",
								}),
							},
						],
						details: { docxPath: result.docxPath, warnings: result.warnings },
					};
				} catch (err) {
					// DocxConvertError 的 message 就是写给模型的可行动文案（documents 层契约）；
					// 降级内容如实附上（不静默），让模型能保存为 .md 交付。
					if (err instanceof DocxConvertError) {
						let message = err.message;
						if (err.markdownFallback !== undefined) {
							const fallback =
								err.markdownFallback.length > FALLBACK_MESSAGE_CAP
									? `${err.markdownFallback.slice(0, FALLBACK_MESSAGE_CAP)}\n（降级内容过长，已截断）`
									: err.markdownFallback;
							message +=
								"\n\n引擎附带的 Markdown 降级内容如下，请保存为 .md 文件交付并说明 docx 转换失败的原因：\n\n" +
								fallback;
						}
						throw new Error(message);
					}
					throw err;
				}
			},
		});
	};
}
