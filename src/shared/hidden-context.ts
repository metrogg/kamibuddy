/**
 * hidden context（对齐清单 F5）的契约与纯函数层。
 *
 * 每条用户消息发出去之前，程序在它前面拼上一段用户看不见的隐藏说明——
 * 模型每轮都能看到，但不出现在界面上、不需要用户打字。逆向依据：
 * docs/workbuddy分析/11-hidden-context.md（WorkBuddy 的
 * WorkbuddyUserPromptService + prompt-context-xml 全套机制）。
 *
 * **容器契约就是 data-role 属性本身**（压缩协议挂在它上面）：
 *   - `user-context`      常态化内容（工作目录/场景/专家/记忆指针）——压缩时保留
 *   - `additional-data`   本轮触发的一次性内容（当前时间）——压缩时可整体剥离
 *
 * 与 WorkBuddy 的一个有意差异：它把 additional_data 作为子块插在唯一一个
 * user-context 块内的「原顺序位置」（占位法）；我们直接输出**两个独立块**
 * ——注入不落会话文件（pi transformContext 的返回值只在本次模型调用生效），
 * 不需要保序拼接，两个块各自按 data-role 剥离反而更简单。
 *
 * 依赖方向：本文件零运行时依赖（消息按结构匹配，不 import pi 类型），
 * core 与 shared 的测试都能直接跑。
 */

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
 * 把隐藏块前置到最后一条 user 消息的正文之前（WorkBuddy 同语义：
 * 隐藏块贴着用户消息，模型先看到环境说明再看用户正文）。
 *
 * content 两种形态都处理（pi 的 UserMessage.content 是
 * `string | (TextContent | ImageContent)[]`，带图片时是数组）：
 *   - string：`block + "\n\n" + 原文`（新对象，不动原消息）；
 *   - 数组：在最前面插入一个 text 块。
 *
 * 防御：目标已含 HIDDEN_CONTEXT_MARKER 就原样返回 —— pi 的 transformContext
 * 返回值不落会话文件，正常情况下每次调用都是未注入的原文；这层防御只防
 * 「pi 未来把改写结果持久化」之类的行为变化导致的双重注入。
 * 找不到 user 消息原样返回（不编造锚点）。
 */
export function prependHiddenContext<T extends { readonly role: unknown }>(
	messages: readonly T[],
	block: string,
): readonly T[] {
	let index = -1;
	for (let i = messages.length - 1; i >= 0; i--) {
		if ((messages[i] as { role?: unknown }).role === "user") {
			index = i;
			break;
		}
	}
	if (index === -1) return messages;

	const target = messages[index] as { content?: unknown };

	if (typeof target.content === "string") {
		if (target.content.includes(HIDDEN_CONTEXT_MARKER)) return messages;
		const next = { ...target, content: `${block}\n\n${target.content}` };
		return [...messages.slice(0, index), next as unknown as T, ...messages.slice(index + 1)];
	}

	if (Array.isArray(target.content)) {
		const parts = target.content as unknown[];
		const alreadyInjected = parts.some((part) => {
			const text = (part as { type?: unknown; text?: unknown }).text;
			return typeof text === "string" && text.includes(HIDDEN_CONTEXT_MARKER);
		});
		if (alreadyInjected) return messages;
		const next = {
			...target,
			content: [{ type: "text", text: block }, ...parts],
		};
		return [...messages.slice(0, index), next as unknown as T, ...messages.slice(index + 1)];
	}

	// content 形态不认识（pi 未来加类型）：宁可不注入也不改写坏消息。
	return messages;
}
