import { describe, expect, it } from "vitest";
import {
	composeHiddenContext,
	formatRunTime,
	HIDDEN_CONTEXT_MARKER,
	shouldAppendSnapshot,
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
		const block = '<system-reminder data-role="user-context">\n<workspace_context>\n工作目录：D:\\proj\n</workspace_context>\n</system-reminder>';
		expect(shouldAppendSnapshot(block, block)).toBe(false);
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
		expect(composeHiddenContext([{ tag: "t", role: "additional-data", body: "x" }])).toContain(
			HIDDEN_CONTEXT_MARKER,
		);
	});
});
