/**
 * hidden context（对齐清单 F5）的契约与纯函数层。
 *
 * 每次模型调用前，程序在请求的消息数组**末尾**追加一段用户看不见的隐藏说明——
 * 模型每轮都能看到，但不出现在界面上、不需要用户打字。逆向依据：
 * docs/workbuddy分析/11-hidden-context.md（WorkBuddy 的
 * WorkbuddyUserPromptService + prompt-context-xml 全套机制）。
 *
 * **容器契约就是 data-role 属性本身**（压缩协议挂在它上面）：
 *   - `user-context`      常态化内容（工作目录/场景/专家/记忆指针）——压缩时保留
 *   - `additional-data`   本轮触发的一次性内容（当前时间）——压缩时可整体剥离
 *
 * 剥离本身是尚未动工的「第二批」（对齐清单 F5：压缩时按 data-role 剥离
 * additional-data）；**本仓库现在没有消费这份协议的实现** —— 读它的只有本文件、
 * `core/session-host.ts` 的组装/注入与诊断面板的展示。所以下面这次注入位置的
 * 变化不牵动任何压缩逻辑。
 *
 * 与 WorkBuddy 的另一处有意差异：它把 additional_data 作为子块插在唯一一个
 * user-context 块内的「原顺序位置」（占位法）；我们直接输出**两个独立块**
 * ——注入不落会话文件（pi transformContext 的返回值只在本次模型调用生效），
 * 不需要保序拼接，两个块各自按 data-role 剥离反而更简单。
 *
 * ## 为什么是「尾部独立消息」而不是「贴进用户消息」（本条是有意偏离 WorkBuddy）
 *
 * WorkBuddy 把隐藏块**前置在用户消息正文之前**（模型先读环境说明再读用户正文），
 * 我们早先照做。代价是提示词前缀缓存：注入经 pi 的 transformContext 生效、
 * **返回值不落会话文件**，所以下一轮那条 user 消息恢复原文、隐藏块改贴到新的
 * 最后一条 user —— **差异落在上一轮那条 user 消息内部**，provider 的最长公共
 * 前缀就在那里断掉，上一轮整段（user + 助手回复 + 全部工具结果）在下一轮被
 * 全价重计费。
 *
 * 实测（3 轮 / 45 步真实会话台账）：轮 2 首步 cacheRead 只占 prompt 的 21.5%
 * （上一步 96.6%），轮 3 首步 65.6%（上一步 99.7%），合计约 102K tokens 从命中价
 * 掉成全价，把会话级命中率从本应约 97.1% 压到实测 94.6%（轮内 13 步仍连续
 * 99.7~99.9%，所以断点只在轮边界）。
 *
 * 改成「**作为尾部独立消息追加**」后：请求 N 的数组尾部是
 * `[…已落盘历史…, hidden_N]`，请求 N+1 是
 * `[…同样历史…, a_N, t_N, u_{N+1}, hidden_{N+1}]` —— 首个差异落在 hidden_N 与
 * a_N 之间，命中前缀 = 上一轮最后一条**已落盘**消息之前，上一轮整段回收。轮内
 * 行为不变（差异仍落在新增内容处，那些本来就是要新付的）。
 *
 * 「贴进用户消息」的唯一好处是 WorkBuddy 的阅读顺序（环境说明在读用户正文之前），
 * 我们用它换掉的是每轮作废上一轮整段的代价 —— 这笔账不值得，故有意偏离。
 * 形态与 `extensions/prompt-switch.ts` 的 `context` 事件注入**同构**
 * （`role:"custom"` + 具名 `customType` + `display:false`），渲染字节不变。
 *
 * 依赖方向：本文件零运行时依赖（消息按结构匹配，不 import pi 类型），
 * core 与 shared 的测试都能直接跑。
 */

import { HIDDEN_CONTEXT_CUSTOM_TYPE } from "./observability.ts";

export type HiddenContextRole = "user-context" | "additional-data";

/** 防御重复注入的标记前缀：目标消息里已含它就不再包一层。 */
export const HIDDEN_CONTEXT_MARKER = `<system-reminder data-role="`;

/** 一个隐藏说明段：渲染成 `<tag>\nbody\n</tag>`，body 为空串则整段跳过。 */
export interface HiddenSection {
	readonly tag: string;
	readonly role: HiddenContextRole;
	readonly body: string;
}

/**
 * 把隐藏块包成 system-reminder。格式照抄 WorkBuddy 的 wrapHiddenContextXml：
 * `<system-reminder data-role="user-context">\n…\n</system-reminder>`。
 */
export function wrapHiddenContextXml(xml: string, role: HiddenContextRole = "user-context"): string {
	return `<system-reminder data-role="${role}">\n${xml}\n</system-reminder>`;
}

/**
 * 组装一次注入的完整文本：按 role 分两桶（user-context 在前、additional-data
 * 在后），桶内保持传入顺序；两桶全空返回 undefined（调用方零成本跳过注入）。
 */
export function composeHiddenContext(sections: readonly HiddenSection[]): string | undefined {
	const render = (role: HiddenContextRole): string =>
		sections
			.filter((s) => s.role === role && s.body.trim() !== "")
			.map((s) => `<${s.tag}>\n${s.body.trim()}\n</${s.tag}>`)
			.join("\n");

	const userContext = render("user-context");
	const additionalData = render("additional-data");
	const blocks: string[] = [];
	if (userContext !== "") blocks.push(wrapHiddenContextXml(userContext, "user-context"));
	if (additionalData !== "") blocks.push(wrapHiddenContextXml(additionalData, "additional-data"));
	return blocks.length === 0 ? undefined : blocks.join("\n");
}

/**
 * 运行时刻的稳定文本：`2026-09-16 10:35（周三，GMT+8）`。
 *
 * 手工拼接而不用 toLocaleString：注入内容要可单测、跨机器逐字节一致
 * （locale 数据随机器变）。分钟级精度就够——注入内容按 run 冻结
 * （session-host 的缓存纪律），秒在冻结语义下是假精确。
 */
export function formatRunTime(date: Date): string {
	const pad = (n: number): string => String(n).padStart(2, "0");
	const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] as const;
	const offsetMinutes = -date.getTimezoneOffset();
	const sign = offsetMinutes >= 0 ? "+" : "-";
	const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
	const offsetRest = Math.abs(offsetMinutes) % 60;
	const zone = `GMT${sign}${offsetHours}${offsetRest === 0 ? "" : `:${pad(offsetRest)}`}`;
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}（${weekdays[date.getDay()]}，${zone}）`;
}

/**
 * 把隐藏块作为**尾部一条独立消息**追加到消息数组末尾（形态与 prompt-switch 的
 * `context` 事件注入同构：`role:"custom"` + 具名 `customType` + `display:false`）。
 *
 * 为什么是追加而不是改写最后一条 user 消息 —— 见文件头「为什么是尾部独立消息」：
 * 改写发生在**已落盘的历史消息内部**，而注入不落盘 ⇒ 下一轮该条恢复原文，
 * 缓存的最长公共前缀就在那里断掉，上一轮整段作废。追加在所有已落盘内容之后，
 * 它落在（跨轮也稳定的）历史之后，且 **不触碰任何既有消息**（逐条引用不变、
 * 内容逐字节不变）—— 这是缓存命中的前提。
 *
 * 不改写既有消息带来的另一个结果：pi 的 UserMessage.content 是
 * `string | (TextContent | ImageContent)[]`（带图片时是数组），本函数不必再
 * 分两种形态处理，也不需要「找不到 user 消息」这种锚点假设。
 *
 * 防御：数组里已有任何一条含 HIDDEN_CONTEXT_MARKER 就原样返回 —— pi 的
 * transformContext 返回值不落会话文件，正常情况下每次调用都是未注入的原文；
 * 这层防御只防「pi 未来把改写结果持久化」之类的行为变化导致的双重注入。
 *
 * `timestamp` 由调用方给（本文件是纯函数层，不读时钟）：它进的是 pi 的
 * 消息 id（`custom:<timestamp>`），而这条消息标了瞬态、不参与缓存断点归因
 * （见 shared/observability.ts 的 `TRANSIENT_INJECTION_CUSTOM_TYPES`）。
 */
export function appendHiddenContext<T extends { readonly role: unknown }>(
	messages: readonly T[],
	block: string,
	timestamp: number,
): readonly T[] {
	if (messages.some(containsHiddenContextMarker)) return messages;
	const injected = {
		role: "custom",
		customType: HIDDEN_CONTEXT_CUSTOM_TYPE,
		content: block,
		// 不上界面：注入块是实现细节不是会话内容（它也不落会话文件）。
		display: false,
		timestamp,
	};
	return [...messages, injected as unknown as T];
}

/** 这条消息的文本里是否已有隐藏块标记（string 正文与数组正文的 text 块都看）。 */
function containsHiddenContextMarker(message: unknown): boolean {
	const content = (message as { content?: unknown }).content;
	if (typeof content === "string") return content.includes(HIDDEN_CONTEXT_MARKER);
	if (!Array.isArray(content)) return false;
	return content.some((part) => {
		const text = (part as { text?: unknown }).text;
		return typeof text === "string" && text.includes(HIDDEN_CONTEXT_MARKER);
	});
}
