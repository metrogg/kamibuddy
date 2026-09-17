/**
 * docx 版式提取工具扩展：docx_extract。
 *
 * 与 docx-convert-tool.ts 同一套两层结构：documents/docx-extract.ts 是纯函数层
 * （CLI 契约、错误分类全在那边，可单测），本文件只做三件事 —— 注册工具、
 * 把调用参数译成 documents 层请求、把结果与错误排成模型可读的文本。
 *
 * 与 read_document 的分工（描述里必须写清，否则模型会拿错工具）：
 *   read_document 把文档解析成**文本**给模型读；
 *   docx_extract 产出**HTML 文件 + 图片目录**，用于分析/复用原文档的版式。
 * 「照这份 .docx 的版式写新内容」走这里，只是要读内容走 read_document。
 *
 * 调用受控：引擎由 daemon 进程内受控 spawn 调起（命令与参数写死在
 * documents/docx-extract.ts，模型只能给输入 .docx 与产物路径），不经 agent 的
 * powershell 自由 shell —— 与 docx_convert 同档：受控 spawn、不经 powershell。
 *
 * 环境准备：与正向共用 docx-env 的幂等 ensure（已就绪秒退）；首次冷启动
 * 约 1-3 分钟，描述里如实说明，失败时响亮报错并给可执行建议，不静默返回空 HTML。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
	classifyEnsureError,
	defaultRun,
	DocxExtractError,
	extractDocxToHtml,
	type ExtractRequest,
	type ExtractSuccess,
	type RunFn,
} from "../documents/docx-extract.ts";
import {
	createEnvContext,
	defaultSpawn,
	ensureDocxEnv,
	type EnvContext,
	type EnsureResult,
	type SpawnFn,
} from "../documents/docx-env.ts";

export interface DocxExtractToolOptions {
	/** 引擎目录（resources/docx-engine）。 */
	readonly engineDir: string;
	readonly homeDir: string;
	/** 缺省 process.platform；测试注入。 */
	readonly platform?: string;
	/** 测试注入（状态机全分支在 documents 层已测，这里只测接缝）。 */
	readonly ensure?: (ctx: EnvContext, spawn: SpawnFn) => Promise<EnsureResult>;
	/** 测试注入。 */
	readonly extract?: (req: ExtractRequest, run: RunFn) => Promise<ExtractSuccess>;
}

/** 失败时把引擎已发出的警告一并带出的上限：够模型如实转述，又不糊满上下文。 */
const WARNINGS_MESSAGE_CAP = 20;

function describeWarnings(warnings: readonly string[]): string {
	if (warnings.length === 0) return "";
	const shown = warnings.slice(0, WARNINGS_MESSAGE_CAP);
	const more = warnings.length > shown.length ? `\n（另有 ${warnings.length - shown.length} 条警告未列出）` : "";
	return `\n\n引擎已发出的警告（如实转述给用户）：\n- ${shown.join("\n- ")}${more}`;
}

export function createDocxExtractTool(options: DocxExtractToolOptions) {
	return (pi: ExtensionAPI): void => {
		pi.registerTool({
			name: "docx_extract",
			label: "提取文档版式",
			description:
				"把一份 .docx 提取成 HTML 文件 + 图片目录，用于**分析或复用原文档的版式**（标题层级、段落缩进、字体字号、" +
				"表格、列表、图片）。用途是「照这份 .docx 的版式写新内容」；只是想读文档里的文字请用 read_document" +
				"（read_document 给文本，本工具给 HTML 文件）。" +
				"输出是**语义化近似**，不是 1:1 还原：页码、页眉页脚、分节、浮动对象、域代码、图表无法复原，" +
				"结果里的 not_restorable 字段列出该文档实际命中的不可复原项。" +
				"首次使用会自动准备 Python 环境（需联网，约 1-3 分钟）。" +
				"提取失败或环境不可用时会返回原因与处理建议。",
			promptSnippet:
				"docx_extract: 把一份 .docx 提取成 HTML + 图片（docxPath → outputPath），用来复用原文档版式；只读文字用 read_document",
			promptGuidelines: [
				"不要承诺 1:1 还原：页码/页眉页脚/分节/浮动对象/域代码/图表不可复原，结果里的 not_restorable 必须如实转述给用户。",
				"同一处失败不要反复重试：环境类按错误里的引导告知用户，输入类如实说明文件名与原因（重试无用）。",
			],
			parameters: Type.Object({
				docxPath: Type.String({ description: "输入 .docx 文件的绝对路径。" }),
				outputPath: Type.String({
					description: "输出 HTML 的绝对路径（写工作区产物文件档位判定；图片默认落在同目录的 <名>_assets/ 下）。",
				}),
				assetsDir: Type.Optional(
					Type.String({ description: "图片目录的绝对路径；缺省为 <HTML 所在目录>/<HTML 名去扩展名>_assets。" }),
				),
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

				const extract = options.extract ?? extractDocxToHtml;
				try {
					const result = await extract(
						{
							python: env.python,
							engineDir: options.engineDir,
							docxPath: params.docxPath,
							outputPath: params.outputPath,
							...(params.assetsDir !== undefined ? { assetsDir: params.assetsDir } : {}),
						},
						defaultRun,
					);
					return {
						content: [
							{
								type: "text" as const,
								text: JSON.stringify({
									type: "docx_extract_result",
									html_path: result.htmlPath,
									assets_dir: result.assetsDir,
									images: result.images,
									warnings: result.warnings,
									not_restorable: result.notRestorable,
									message:
										"提取完成：HTML 与图片都在上述路径下，图片引用是相对 HTML 文件的路径。" +
										"not_restorable 里的不可复原项要如实转述给用户，不要承诺 1:1 还原。",
								}),
							},
						],
						details: {
							htmlPath: result.htmlPath,
							assetsDir: result.assetsDir,
							images: result.images,
							warnings: result.warnings,
							notRestorable: result.notRestorable,
						},
					};
				} catch (err) {
					// DocxExtractError 的 message 就是写给模型的可行动文案（documents 层契约）；
					// 引擎失败前的警告照样带出去（不静默吞）。
					if (err instanceof DocxExtractError) {
						throw new Error(err.message + describeWarnings(err.warnings));
					}
					throw err;
				}
			},
		});
	};
}
