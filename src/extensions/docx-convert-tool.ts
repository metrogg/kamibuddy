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
 * 环境准备：每次转换前幂等 ensure（已就绪秒退），daemon 启动时的后台预热
 * 只是省首次等待，这里的 ensure 才是兜底 —— 与 WB「每次转换前重跑 setup
 * 脚本」同语义。环境装不上（无外网等）如实报错并建议 Markdown 降级交付，
 * 不静默吞（spec Scenario: 无外网/安装失败时返回明确降级）。
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
import {
	createEnvContext,
	defaultSpawn,
	ensureDocxEnv,
	type EnvContext,
	type EnsureResult,
	type SpawnFn,
} from "../documents/docx-env.ts";

export interface DocxConvertToolOptions {
	/** 引擎目录（resources/docx-engine）。 */
	readonly engineDir: string;
	readonly homeDir: string;
	/** 缺省 process.platform；测试注入。 */
	readonly platform?: string;
	/** 测试注入（状态机全分支在 documents 层已测，这里只测接缝）。 */
	readonly ensure?: (ctx: EnvContext, spawn: SpawnFn) => Promise<EnsureResult>;
	/** 测试注入。 */
	readonly convert?: (req: ConvertRequest, run: RunFn) => Promise<ConvertSuccess>;
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
				"首次使用会自动准备 Python 环境（需联网，约 1-3 分钟）。" +
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
				const ctx = createEnvContext(
					options.engineDir,
					options.homeDir,
					options.platform ?? process.platform,
				);
				const ensure = options.ensure ?? ensureDocxEnv;
				// 幂等 ensure：已就绪秒退；装不上抛 env-not-ready（带阶段归因与联网/镜像引导）。
				const env = await ensure(ctx, defaultSpawn);
				if (env.status !== "ready") throw classifyEnsureError(env);

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
