import { describe, expect, it } from "vitest";
import {
	composeHiddenContext,
	formatRunTime,
	HIDDEN_CONTEXT_MARKER,
	prependHiddenContext,
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

describe("prependHiddenContext", () => {
	const block = '<system-reminder data-role="user-context">\nx\n</system-reminder>';

	it("string content：块 + 空行 + 原文，其他消息原样", () => {
		const messages = [
			{ role: "user", content: "第一条" },
			{ role: "assistant", content: "回复" },
			{ role: "user", content: "第二条" },
		];
		const out = prependHiddenContext(messages, block);
		expect(out).toHaveLength(3);
		expect(out[0]).toBe(messages[0]); // 非目标消息是同一个引用
		expect(out[2]?.content).toBe(`${block}\n\n第二条`);
	});

	it("数组 content：text 块插在最前（图片在前也在图前）", () => {
		const messages = [
			{ role: "user", content: [{ type: "image", mimeType: "image/png", data: "aa" }] },
		];
		const out = prependHiddenContext(messages, block);
		const content = (out[0]?.content ?? []) as unknown[];
		expect(content).toHaveLength(2);
		expect(content[0]).toEqual({ type: "text", text: block });
		expect(content[1]).toBe((messages[0]?.content as unknown[])[0]);
	});

	it("没有 user 消息原样返回", () => {
		const messages = [{ role: "assistant", content: "hi" }];
		expect(prependHiddenContext(messages, block)).toBe(messages);
	});

	it("目标已含标记就不再注入（防 pi 未来持久化改写结果）", () => {
		const injected = { role: "user", content: `${block}\n\n原文` };
		const messages = [injected];
		expect(prependHiddenContext(messages, block)).toBe(messages);
	});

	it("标记判定用共享常量，两处不会漂移", () => {
		expect(HIDDEN_CONTEXT_MARKER).toContain('data-role="');
	});
});
