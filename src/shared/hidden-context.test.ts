import { describe, expect, it } from "vitest";
import {
	composeHiddenBlock,
	formatRunTime,
	HIDDEN_CONTEXT_MARKER,
	shouldAppendSnapshot,
	SNAPSHOT_SUPERSEDE_NOTE,
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

describe("composeHiddenBlock", () => {
	/**
	 * 环境块 / 时间块**各一条消息**（spec: add-supersede-note-and-time-split 的 B）：
	 * 同一条消息里挤着「每分钟变的 20 字符」与「逐字节没变的 1,000 字符」时，时间一变
	 * 整条重发；按 role 各出一条后两条消息各自去重。下面的用例就是这条的形状钉子。
	 */
	const sections: readonly HiddenSection[] = [
		{ tag: "workspace_context", role: "user-context", body: "工作目录：D:\\proj" },
		{ tag: "empty", role: "user-context", body: "   " },
		{ tag: "current_time", role: "additional-data", body: "2026-09-16 10:35" },
	];

	it("user-context 块只含该 role 的段，取代声明在容器内第一行", () => {
		expect(composeHiddenBlock(sections, "user-context")).toBe(
			[
				'<system-reminder data-role="user-context">',
				SNAPSHOT_SUPERSEDE_NOTE,
				"",
				"<workspace_context>",
				"工作目录：D:\\proj",
				"</workspace_context>",
				"</system-reminder>",
			].join("\n"),
		);
	});

	it("additional-data 块同理（时间只在这一块里，不再和环境块同一条消息）", () => {
		expect(composeHiddenBlock(sections, "additional-data")).toBe(
			[
				'<system-reminder data-role="additional-data">',
				SNAPSHOT_SUPERSEDE_NOTE,
				"",
				"<current_time>",
				"2026-09-16 10:35",
				"</current_time>",
				"</system-reminder>",
			].join("\n"),
		);
	});

	it("两个 role 的块互不包含（时间块里没有环境段，环境块里没有时间）", () => {
		const env = composeHiddenBlock(sections, "user-context") ?? "";
		const time = composeHiddenBlock(sections, "additional-data") ?? "";
		expect(env).not.toContain("<current_time>");
		expect(env).not.toContain("2026-09-16 10:35");
		expect(time).not.toContain("<workspace_context>");
		// 容器契约不变：data-role 取值即 role，包裹形式仍是 <tag>…</tag>。
		expect(env).toContain('data-role="user-context"');
		expect(time).toContain('data-role="additional-data"');
	});

	it("该 role 下一个非空段都没有 → undefined（零成本跳过注入）", () => {
		expect(composeHiddenBlock([], "user-context")).toBeUndefined();
		expect(composeHiddenBlock(sections, "additional-data")).not.toBeUndefined();
		expect(
			composeHiddenBlock([{ tag: "a", role: "user-context", body: "" }], "user-context"),
		).toBeUndefined();
		expect(
			composeHiddenBlock([{ tag: "a", role: "additional-data", body: "  \n " }], "additional-data"),
		).toBeUndefined();
	});

	it("取代声明逐字节稳定（同输入两次渲染字节相等 ⇒ 去重不会被声明破坏）", () => {
		expect(composeHiddenBlock(sections, "user-context")).toBe(
			composeHiddenBlock(sections, "user-context"),
		);
		expect(composeHiddenBlock(sections, "user-context")).toContain(SNAPSHOT_SUPERSEDE_NOTE);
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

/**
 * 追加判据（spec: persist-context-snapshots Task 1.3）。
 *
 * 快照要「落盘 + 按需追加」才有缓存意义：内容没变还追加一条，双倍代价里
 * 只解决了一半（位置固定了，但每 run 仍多付一条）。这里的两种形态就是判据的全部。
 */
describe("shouldAppendSnapshot", () => {
	it("会话里还没有同类型快照（previous === undefined）→ 追加", () => {
		// 新会话、或上一轮那条被压缩遮蔽 —— 模型这一轮看不到任何基线。
		expect(shouldAppendSnapshot(undefined, "")).toBe(true);
		expect(shouldAppendSnapshot(undefined, "任意内容")).toBe(true);
	});

	it("与上一条逐字节相同 → 不追加（这正是每 run 重付的止血点）", () => {
		const block = composeHiddenBlock(
			[{ tag: "workspace_context", role: "user-context", body: "工作目录：D:\\proj" }],
			"user-context",
		);
		expect(block).toBeDefined();
		expect(shouldAppendSnapshot(block, block ?? "")).toBe(false);
	});

	it("有任何字节差异 → 追加（含仅时间变了这种最常见的形态）", () => {
		expect(shouldAppendSnapshot("2026-09-18 10:00", "2026-09-18 10:01")).toBe(true);
		// 空串 vs 有内容：内容其实变了，必须追加。
		expect(shouldAppendSnapshot("", "x")).toBe(true);
		// 只差一个空白字符也是差异 —— provider 的前缀缓存比的是字节。
		expect(shouldAppendSnapshot("a b", "a  b")).toBe(true);
	});
});

describe("HIDDEN_CONTEXT_MARKER", () => {
	it("标记即容器前缀（导出过滤与测试钉子共用同一份常量）", () => {
		expect(HIDDEN_CONTEXT_MARKER).toContain('data-role="');
		expect(
			composeHiddenBlock([{ tag: "t", role: "additional-data", body: "x" }], "additional-data"),
		).toContain(HIDDEN_CONTEXT_MARKER);
	});
});
