import { describe, expect, it } from "vitest";
import { HIDDEN_CONTEXT_CUSTOM_TYPE } from "./observability.ts";
import {
	appendHiddenContext,
	composeHiddenContext,
	formatRunTime,
	HIDDEN_CONTEXT_MARKER,
	wrapHiddenContextXml,
	type HiddenSection,
} from "./hidden-context.ts";

describe("wrapHiddenContextXml", () => {
	it("缺省 role 是 user-context，格式与 WorkBuddy 的 wrapHiddenContextXml 逐字节一致", () => {
		expect(wrapHiddenContextXml("<a>1</a>")).toBe(
			'<system-reminder data-role="user-context">\n<a>1</a>\n</system-reminder>',
		);
	});

	it("additional-data 显式落在 data-role 上", () => {
		expect(wrapHiddenContextXml("<current_time>x</current_time>", "additional-data")).toBe(
			'<system-reminder data-role="additional-data">\n<current_time>x</current_time>\n</system-reminder>',
		);
	});
});

describe("composeHiddenContext", () => {
	it("按 role 分两块，user-context 在前；空 body 段整段跳过", () => {
		const sections: readonly HiddenSection[] = [
			{ tag: "workspace_context", role: "user-context", body: "工作目录：D:\\proj" },
			{ tag: "empty", role: "user-context", body: "   " },
			{ tag: "current_time", role: "additional-data", body: "2026-09-16 10:35" },
		];
		expect(composeHiddenContext(sections)).toBe(
			[
				'<system-reminder data-role="user-context">\n<workspace_context>\n工作目录：D:\\proj\n</workspace_context>\n</system-reminder>',
				'<system-reminder data-role="additional-data">\n<current_time>\n2026-09-16 10:35\n</current_time>\n</system-reminder>',
			].join("\n"),
		);
	});

	it("只有 additional-data 时只出 additional-data 块", () => {
		const text = composeHiddenContext([
			{ tag: "current_time", role: "additional-data", body: "t" },
		]);
		expect(text).toContain('data-role="additional-data"');
		expect(text).not.toContain('data-role="user-context"');
	});

	it("全部为空返回 undefined（零成本跳过注入）", () => {
		expect(composeHiddenContext([])).toBeUndefined();
		expect(
			composeHiddenContext([{ tag: "a", role: "user-context", body: "" }]),
		).toBeUndefined();
	});
});

describe("formatRunTime", () => {
	it("固定时区下逐字节稳定（不依赖 locale 数据）", () => {
		// 2026-09-16 是周三；10:35 本地时间（测试跑在 +08:00 机器上）
		const date = new Date(2026, 8, 16, 10, 35);
		expect(formatRunTime(date)).toMatch(/^2026-09-16 10:35（周三，GMT\+8）$/);
	});

	it("半小时偏移时区带分钟（如 GMT+5:30）", () => {
		// 用 Date 构造的本地时间在测试机上固定 +08:00；这里只验格式容得下分钟偏移
		const date = new Date(2026, 0, 2, 3, 5);
		const text = formatRunTime(date);
		expect(text).toMatch(/^2026-01-02 03:05（周五，GMT[+-]\d+(?::\d{2})?）$/);
	});
});

describe("appendHiddenContext", () => {
	const block = '<system-reminder data-role="user-context">\nx\n</system-reminder>';

	it("作为尾部独立消息追加：形态与 prompt-switch 的 context 注入同构", () => {
		const messages = [
			{ role: "user", content: "第一条" },
			{ role: "assistant", content: "回复" },
			{ role: "user", content: "第二条" },
		];
		const out = appendHiddenContext(messages, block, 1000);
		expect(out).toHaveLength(4);
		expect(out[3]).toEqual({
			role: "custom",
			customType: HIDDEN_CONTEXT_CUSTOM_TYPE,
			content: block,
			display: false,
			timestamp: 1000,
		});
	});

	it("不改写任何既有消息：逐条同一引用、内容逐字节不变", () => {
		// 这是跨轮 cache 不变量的前提：注入落在所有已落盘内容之后，
		// 上一轮的 user 消息在下一轮请求里逐字节不变（否则前缀在那里断掉）。
		const messages = [
			{ role: "user", content: "第一条" },
			{ role: "assistant", content: "回复" },
			{ role: "user", content: "第二条" },
		];
		const out = appendHiddenContext(messages, block, 1000);
		for (let i = 0; i < messages.length; i += 1) expect(out[i]).toBe(messages[i]);
		expect(out[2]?.content).toBe("第二条");
	});

	it("数组 content（带图片的 user 消息）同样一个字节都不动", () => {
		const parts = [{ type: "image", mimeType: "image/png", data: "aa" }];
		const messages = [{ role: "user", content: parts }];
		const out = appendHiddenContext(messages, block, 1);
		expect(out[0]).toBe(messages[0]);
		expect((out[0] as { content: unknown }).content).toBe(parts);
	});

	it("没有 user 消息也能注入（尾部追加不依赖任何锚点）", () => {
		const messages = [{ role: "assistant", content: "hi" }];
		const out = appendHiddenContext(messages, block, 1);
		expect(out).toHaveLength(2);
		expect(out[0]).toBe(messages[0]);
	});

	it("已含标记就不再注入（防 pi 未来持久化注入结果）", () => {
		const injected = { role: "user", content: `${block}\n\n原文` };
		const messages = [injected];
		expect(appendHiddenContext(messages, block, 1)).toBe(messages);
	});

	it("标记判定用共享常量，两处不会漂移", () => {
		expect(HIDDEN_CONTEXT_MARKER).toContain('data-role="');
	});
});

/**
 * 回归钉子（spec: 待决策「hidden context 的插入位置让上一轮整段每轮重付」）。
 *
 * 只断言「块被追加了」拦不住回归：早先的实现把块前置进**最后一条 user 消息的
 * 正文**，形状上同样「注入成功」，代价是下一轮那条消息恢复原文、缓存最长公共
 * 前缀在上一轮内部断掉（实测会话级命中率 94.6% vs 本应 97.1%）。这里直接断言
 * **相邻两轮请求的首条差异落在上一轮尾部那条注入上** —— 改回贴 user 消息必红。
 */
describe("跨轮缓存不变量：首条差异不在上一轮的已落盘消息里", () => {
	const block = (turn: number): string =>
		`<system-reminder data-role="user-context">\n第 ${turn} 轮\n</system-reminder>`;

	/** 两个请求的首条差异下标（-1 = 逐条相同）；用 JSON 表达「逐字节」。 */
	function firstDifference(a: readonly unknown[], b: readonly unknown[]): number {
		const shared = Math.min(a.length, b.length);
		for (let i = 0; i < shared; i += 1) {
			if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) return i;
		}
		return a.length === b.length ? -1 : shared;
	}

	/** 第 1 轮请求：已落盘历史（多轮会话里轮边界处的真实形态），注入追加在其后。 */
	const history1 = [
		{ role: "user", content: "第一问", timestamp: 1 },
		{ role: "assistant", content: "回答一", timestamp: 2 },
		{
			role: "toolResult",
			toolCallId: "c1",
			toolName: "read",
			content: [{ type: "text", text: "文件一" }],
			isError: false,
			timestamp: 3,
		},
		{ role: "user", content: "第二问", timestamp: 4 },
	];
	const turn1 = appendHiddenContext(history1, block(1), 1000);

	/**
	 * 第 2 轮请求的历史：transformContext 的返回值不落会话，所以第 1 轮那条注入
	 * 不在其中；落盘的是助手回复、工具结果与新一条 user。
	 */
	const history2 = [
		...history1,
		{ role: "assistant", content: "回答二", timestamp: 5 },
		{
			role: "toolResult",
			toolCallId: "c2",
			toolName: "write",
			content: [{ type: "text", text: "文件二" }],
			isError: false,
			timestamp: 6,
		},
		{ role: "user", content: "第三问", timestamp: 7 },
	];
	const turn2 = appendHiddenContext(history2, block(2), 2000);

	it("上一轮所有已落盘消息在下一轮请求里逐字节不变", () => {
		for (let i = 0; i < history1.length; i += 1) {
			expect(turn1[i]).toBe(history1[i]);
			expect(turn2[i]).toBe(history1[i]);
			expect(JSON.stringify(turn2[i])).toBe(JSON.stringify(turn1[i]));
		}
	});

	it("首条差异 = 上一轮尾部那条注入（命中前缀覆盖上一轮整段）", () => {
		// turn1 = [历史…, hidden1]，turn2 = [同样历史…, a2, t2, u3, hidden2]：
		// 首个差异落在 hidden1 的位置，说明历史（含上一轮那条 user）全部命中缓存。
		// 「贴进最后一条 user 消息」的旧形态下这里会是 history1.length - 2 —— 红。
		expect(firstDifference(turn1, turn2)).toBe(turn1.length - 1);
		// 与「前缀到上一轮最后一条已落盘消息为止」等价：差异点必须是那条注入，
		// 不是任何已落盘的历史条目。
		expect(turn1[turn1.length - 1]?.role).toBe("custom");
	});
});
