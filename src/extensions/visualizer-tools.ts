/**
 * 内联可视化扩展：read_me + show_widget（对齐 WorkBuddy 的 visualizer 双工具，
 * 机制证据见 docs/workbuddy分析/08-builtin-tools-reference.md §2；
 * spec：.trae/specs/add-inline-widgets/spec.md）。
 *
 * 三个设计点：
 *
 * 1. **指南即数据**（AGENTS.md §3）：设计指南在 resources/visualizer/*.md，
 *    read_me 按模块拼装返回；加模块 = 加一个指南文件 + MODULE_GUIDE_FILES
 *    登记一行。指南只随 read_me 进上下文，不占常驻提示词。
 *
 * 2. **校验失败是业务结果，不是程序故障**：show_widget 的硬校验拦的是模型的
 *    产出，模型能看着原因自我纠正——所以不抛异常（抛异常在 pi 里 = 环境错误），
 *    返回 success:false + 中文原因的同构 JSON。这也保证 renderer 拿到的永远
 *    是结构一致的 payload，校验失败走错误视图而不是渲染半成品。
 *
 * 3. **边界只在本层**：resources 目录经 core/config-paths.ts 的 getResourcesDir()
 *    取（extensions → core 是合法依赖方向）；指南文件缺失抛错响亮失败
 *    （AGENTS.md §7），不静默降级成空指南——没有指南的产出必然跑偏。
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { getResourcesDir } from "../core/config-paths.ts";

/** v1 支持的可视化模块（spec：mockup/interactive/art 明确不做）。 */
type VisualizerModule = "diagram" | "chart";

/** core 与 colors 恒含——任何模块的产出都要守通用规则与配色表。 */
const BASE_GUIDE_FILES = ["core.md", "colors.md"] as const;

/** 各模块追加的指南文件；diagram 依赖 SVG 坐标管线，svg-setup 必须排在 diagram 前面。 */
const MODULE_GUIDE_FILES: Record<VisualizerModule, readonly string[]> = {
	diagram: ["svg-setup.md", "diagram.md"],
	chart: ["chart.md"],
};

type RenderMode = "svg" | "html";

/**
 * show_widget 的结果 payload：成功与失败共用同一形状（字段可选），
 * pi 的 AgentToolResult<TDetails> 按分支联合推断，形状不一会编不过；
 * details 原样携带整个 payload，renderer 的工具卡直接从 detail 取数渲染。
 */
interface ShowWidgetPayload {
	readonly type: "visualizer_show_widget_result";
	readonly success: boolean;
	readonly title?: string;
	readonly widget_code?: string;
	readonly loading_messages?: readonly string[];
	readonly render_mode?: RenderMode;
	readonly message?: string;
}

interface ReadMePayload {
	readonly type: "visualizer_read_me_result";
	readonly content: string;
}

/**
 * 解析 modules 入参：接受字符串数组、逗号分隔串、JSON 数组串三种形态
 * （模型对同一 schema 的产出形态不稳定，宽容解析能把可救的调用救回来）。
 * 非法值与重复项静默丢弃——合法集合就两个，报错不如直接给能用的结果。
 */
function parseModules(raw: unknown): VisualizerModule[] {
	const modules: VisualizerModule[] = [];
	const push = (value: unknown): void => {
		if ((value === "diagram" || value === "chart") && !modules.includes(value)) {
			modules.push(value);
		}
	};
	if (Array.isArray(raw)) {
		for (const item of raw) push(item);
	} else if (typeof raw === "string") {
		const trimmed = raw.trim();
		if (trimmed.startsWith("[")) {
			// JSON 数组串形态；解析失败按逗号串兜底，不因此拒绝整个调用。
			try {
				const parsed: unknown = JSON.parse(trimmed);
				if (Array.isArray(parsed)) {
					for (const item of parsed) push(item);
					return modules;
				}
			} catch {
				// 落进下面的逗号分隔解析。
			}
		}
		for (const piece of trimmed.split(",")) push(piece.trim());
	}
	return modules;
}

/** 全非法时返回的说明文案：必须写清合法值与调用示例，模型才知道怎么重试。 */
const NO_VALID_MODULE_TEXT =
	"本次 read_me 没有命中任何有效模块。v1 支持的模块：" +
	"diagram（SVG 流程图/结构图/示意图）、chart（Chart.js 数据图表）。" +
	'请用 modules: ["diagram"] 或 modules: ["chart"]（也可两个都传）重新调用。';

/**
 * 按模块拼装指南文本。文件缺失抛错（AGENTS.md §7 响亮失败）：
 * 指南缺了还放行，模型只会在没有规则的情况下产出跑偏的 widget。
 */
function readGuides(modules: readonly VisualizerModule[]): string {
	const dir = join(getResourcesDir(), "visualizer");
	const files = [...BASE_GUIDE_FILES, ...modules.flatMap((m) => MODULE_GUIDE_FILES[m])];
	return files
		.map((name) => {
			const path = join(dir, name);
			try {
				return readFileSync(path, "utf8").trim();
			} catch {
				throw new Error(
					`可视化设计指南缺失或不可读：${path}。` +
						"resources/visualizer/ 应随应用一起分发；" +
						"若设置了 KAMIBUDDY_RESOURCES_DIR，请检查其指向。",
				);
			}
		})
		.join("\n\n---\n\n");
}

/**
 * title 规范化：title 同时是卡片标题与下载文件名，必须收敛到文件名安全字符。
 * 空格/连字符转下划线 → 只留 Unicode 字母数字下划线 → 压连续下划线、去首尾 →
 * 空兜底 "widget"。
 */
function normalizeTitle(raw: string): string {
	const underscored = raw.trim().replace(/[\s-]+/g, "_");
	const kept = underscored.replace(/[^\p{L}\p{N}_]/gu, "");
	const collapsed = kept.replace(/_+/g, "_").replace(/^_+|_+$/g, "");
	return collapsed === "" ? "widget" : collapsed;
}

/**
 * loading_messages 规范化：schema 声明为 string（JSON 数组串），但模型常直接给
 * 数组或逗号串，三种形态都收。返回 undefined 表示无法解析成字符串列表。
 * 条数边界（1-4）由调用方检查，这里只管解析。
 */
function normalizeLoadingMessages(raw: unknown): string[] | undefined {
	let list: unknown[];
	if (Array.isArray(raw)) {
		list = raw;
	} else if (typeof raw === "string") {
		const trimmed = raw.trim();
		if (trimmed.startsWith("[")) {
			try {
				const parsed: unknown = JSON.parse(trimmed);
				if (!Array.isArray(parsed)) return undefined;
				list = parsed;
			} catch {
				return undefined;
			}
		} else {
			list = trimmed.split(",");
		}
	} else {
		return undefined;
	}
	// 非字符串项与空白项直接丢弃：它们是格式噪声，不该变成卡片上轮播的文案。
	return list
		.filter((item): item is string => typeof item === "string")
		.map((item) => item.trim())
		.filter((item) => item !== "");
}

const DOC_WRAPPER_RE = /<(!DOCTYPE|html|head|body)\b/i;
const WEB_STORAGE_RE = /\b(localStorage|sessionStorage)\b/;
const FIXED_POSITION_RE = /position\s*:\s*fixed/;
const FORM_RE = /<form\b/i;
const SVG_TAG_RE = /<svg\b/gi;
/** 680 是固定坐标管线基准（见 resources/visualizer/svg-setup.md），宽度不许改。 */
const SVG_VIEWBOX_RE = /viewBox\s*=\s*["']0\s+0\s+680\s+\d+["']/i;

/**
 * widget_code 硬校验（与 WorkBuddy 同口径）。返回错误文案；通过返回 undefined。
 * 文案必须写清违反哪条、为什么、怎么改——模型靠它自我纠正。
 */
function validateWidgetCode(code: string): string | undefined {
	if (DOC_WRAPPER_RE.test(code)) {
		return (
			"widget_code 只能是片段，不能含 <!DOCTYPE>、<html>、<head>、<body> 文档包裹标签" +
			"——片段会被注入宿主卡片容器，不是完整网页。请去掉这些标签后重新提交。"
		);
	}
	if (WEB_STORAGE_RE.test(code)) {
		return (
			"widget_code 不能使用 localStorage/sessionStorage：沙箱环境禁止访问，运行即抛异常。" +
			"请改用片段内的 JS 变量保存状态后重新提交。"
		);
	}
	if (FIXED_POSITION_RE.test(code)) {
		return (
			"widget_code 不能使用 position: fixed——卡片高度靠文档流随内容自适应，" +
			"固定定位会脱离文档流，导致高度测量失效并遮挡聊天界面。请改用文档流内布局后重新提交。"
		);
	}
	if (FORM_RE.test(code)) {
		return (
			"widget_code 不能使用 <form>——片段没有提交目标。" +
			"需要输入交互请改用普通控件（button / select / input）加事件监听。"
		);
	}
	if (code.toLowerCase().startsWith("<svg")) {
		const svgCount = code.match(SVG_TAG_RE)?.length ?? 0;
		if (svgCount !== 1) {
			return `SVG widget 必须恰好包含一个 <svg> 元素，当前检测到 ${svgCount} 个。请合并为一幅图后重新提交。`;
		}
		if (!SVG_VIEWBOX_RE.test(code)) {
			return (
				'SVG 的 viewBox 必须是 "0 0 680 <高度>"（680 是固定坐标基准宽度，根 svg 的 width 写 100%，' +
				"高度 = 最底部元素 + 20）。请按 680 宽坐标系重排后重新提交。"
			);
		}
	}
	return undefined;
}

function fail(message: string): { content: [{ type: "text"; text: string }]; details: ShowWidgetPayload } {
	const payload: ShowWidgetPayload = {
		type: "visualizer_show_widget_result",
		success: false,
		message,
	};
	return {
		content: [{ type: "text", text: JSON.stringify(payload) }],
		details: payload,
	};
}

export function visualizerExtensionFactory(): ExtensionFactory {
	return (pi: ExtensionAPI): void => {
		pi.registerTool({
			name: "read_me",
			label: "读取设计指南",
			description:
				"返回 show_widget 的设计指南：CSS 变量、配色、排版、SVG 布局管线或 Chart.js 规则与示例。" +
				"第一次调用 show_widget 之前必须先调用本工具加载对应模块；之后要换一种可视化类型时，按新模块再调一次。" +
				"这是内部准备步骤——不要向用户提及或叙述这次调用。",
			promptSnippet:
				"read_me: 首次 show_widget 前按模块（diagram | chart）加载设计指南；内部步骤，不要向用户提及",
			promptGuidelines: [
				"生成任何可视化之前先 read_me 加载对应模块的指南，产出的尺寸、配色、字号必须遵守指南。",
				"不要向用户叙述 read_me 这次调用本身；指南是给你看的，不是给用户的。",
			],
			parameters: Type.Object({
				modules: Type.Union([Type.Array(Type.String()), Type.String()], {
					description:
						'要加载的模块："diagram"（SVG 流程图/结构图/示意图）或 "chart"（Chart.js 数据图表）。' +
						'数组（["diagram"]）或字符串（"diagram,chart"）均可，可同时传两个。',
				}),
			}),
			async execute(_toolCallId, params) {
				const modules = parseModules(params.modules);
				const payload: ReadMePayload = {
					type: "visualizer_read_me_result",
					content: modules.length === 0 ? NO_VALID_MODULE_TEXT : readGuides(modules),
				};
				return {
					content: [{ type: "text" as const, text: JSON.stringify(payload) }],
					details: { type: "visualizer_read_me_result" as const },
				};
			},
		});

		pi.registerTool({
			name: "show_widget",
			label: "生成可视化",
			description:
				"把一段 SVG 或 HTML 片段作为可视化卡片内联渲染在文字回复旁边（图表、流程图、结构图等）。" +
				"第一次使用前必须先调用 read_me 加载对应模块的设计指南并严格遵守。" +
				"要点：只提交片段，不要完整 HTML 文档（禁 DOCTYPE/html/head/body/form，禁 localStorage，禁 position:fixed）；" +
				"SVG 的 viewBox 必须是 0 0 680 <高度>（680 为固定坐标基准，width 写 100%）；数据图表用 Chart.js（cdnjs 的 UMD 普通 script）。" +
				"校验失败会返回 success:false 与中文原因，按原因修正后重新提交。",
			promptSnippet:
				"show_widget: 提交 SVG/HTML 片段内联出图（先 read_me；SVG viewBox 固定 0 0 680 H）",
			promptGuidelines: [
				"第一次出图前必须先 read_me 对应模块；指南没加载就不要调用 show_widget。",
				"返回 success:false 时按 message 修正 widget_code 重新提交，不要把失败原因转述给用户。",
				"可视化只是补充：解释与结论照常写在文字回复里，不要用 widget 替代文字。",
			],
			parameters: Type.Object({
				title: Type.Optional(
					Type.String({
						description: "可视化标题，用作卡片标题与下载文件名；空格与连字符会转成下划线。",
					}),
				),
				widget_code: Type.Optional(
					Type.String({
						description:
							"SVG 或 HTML 片段本体。SVG：恰好一个 <svg>，viewBox 为 0 0 680 <高度>，width=100%。" +
							"HTML：定高容器 + 内容；Chart.js 用 cdnjs 的 UMD 普通 script 引入。",
					}),
				),
				loading_messages: Type.Optional(
					Type.Union([Type.String(), Type.Array(Type.String())], {
						description:
							'流式生成期间轮播的加载文案，1-4 条（如 "正在整理数据" "正在绘制图形"）。JSON 数组串或数组均可。',
					}),
				),
			}),
			async execute(_toolCallId, params) {
				// 硬校验失败一律走 success:false 同构 payload（见文件头设计点 2），
				// 顺序与 spec 一致：必填 → loading_messages → 内容禁令 → SVG 管线。
				const title = typeof params.title === "string" ? params.title : "";
				if (title.trim() === "") {
					return fail("缺少必填参数 title（可视化标题）。请补上 title 后重新提交。");
				}
				const widgetCode = typeof params.widget_code === "string" ? params.widget_code : "";
				if (widgetCode.trim() === "") {
					return fail("缺少必填参数 widget_code（SVG/HTML 片段本体）。");
				}
				const loadingMessages = normalizeLoadingMessages(params.loading_messages);
				if (loadingMessages === undefined) {
					return fail(
						"loading_messages 无法解析：请给 JSON 数组串或数组（1-4 条非空文案），" +
							'例如 ["正在整理数据","正在绘制图形"]。',
					);
				}
				if (loadingMessages.length < 1 || loadingMessages.length > 4) {
					return fail(
						`loading_messages 需要 1-4 条加载文案，当前为 ${loadingMessages.length} 条。请增减到区间内后重新提交。`,
					);
				}
				const trimmedCode = widgetCode.trim();
				const codeError = validateWidgetCode(trimmedCode);
				if (codeError !== undefined) {
					return fail(codeError);
				}

				const payload: ShowWidgetPayload = {
					type: "visualizer_show_widget_result",
					success: true,
					title: normalizeTitle(title),
					widget_code: widgetCode,
					loading_messages: loadingMessages,
					// render_mode 由内容形态推断（无类型枚举）：<svg 开头走 SVG 管线，其余按 HTML。
					render_mode: trimmedCode.toLowerCase().startsWith("<svg") ? "svg" : "html",
				};
				return {
					content: [{ type: "text" as const, text: JSON.stringify(payload) }],
					details: payload,
				};
			},
		});
	};
}
