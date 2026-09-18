import { describe, expect, it } from "vitest";
import { inferCachePrefixBreak } from "./cache-prefix.ts";
import type { MessageRef, SystemSegmentStat } from "./observability.ts";

/** 造一条逐条明细：只给本文件关心的字段（id / token / 指纹）。 */
function ref(id: string, tokens: number, fp = 1): MessageRef {
	return { id, role: "user", chars: tokens * 4, tokens, fp };
}

/**
 * 造一条上下文快照条目（pi 落的持久 `custom_message`，role 归 other）。
 * 快照落盘那一刻 id（`custom:<timestamp>`）与位置就定下，相邻两轮同一条快照
 * 得到同一个 id；内容变了才在末尾追加一条新的（append-only）。
 */
function snapshotRef(id: string, tokens: number): MessageRef {
	return { ...ref(id, tokens, 99), role: "other" };
}

/** 造一个系统提示词分段（fp 缺省给「同一段内容」的稳定值）。 */
function seg(source: string, chars: number, fp = 1): SystemSegmentStat {
	return { source, chars, fp };
}

describe("inferCachePrefixBreak（命中前缀边界反推）", () => {
	it("命中若干条：断点落在第一条新增的消息上", () => {
		// 上一轮真实 prompt 总量 1600 = 前缀 1000 + 消息 600 → 定标出前缀 1000。
		const previous = [ref("u:1", 100), ref("a:2", 200), ref("t:c1", 300)];
		const current = [...previous, ref("u:9", 400, 2)];
		const boundary = inferCachePrefixBreak({
			previous,
			previousPromptTokens: 1600,
			current,
			cacheRead: 1600,
		});

		expect(boundary).toEqual({
			kind: "message",
			hitCount: 3,
			message: ref("u:9", 400, 2),
			change: "appended",
			uncertain: undefined,
		});
	});

	it("同一条消息内容变了：id 不变、指纹变 → 断点归因「内容变了」", () => {
		const previous = [ref("u:1", 100, 11), ref("a:2", 200, 22)];
		// 前缀 500 = 800（上一轮真实总量）− 300（上一轮消息估算）
		const current = [ref("u:1", 100, 11), ref("a:2", 200, 99)];
		const boundary = inferCachePrefixBreak({
			previous,
			previousPromptTokens: 800,
			current,
			cacheRead: 600,
		});

		expect(boundary).toMatchObject({ kind: "message", hitCount: 1, change: "changed" });
	});

	it("同一条消息位置变了（压缩后前移）→ 断点归因「位置变了」", () => {
		const previous = [ref("A", 100), ref("B", 100), ref("C", 100)];
		const current = [ref("A", 100), ref("C", 100), ref("B", 100)];
		const boundary = inferCachePrefixBreak({
			previous,
			previousPromptTokens: 700, // 前缀 400
			current,
			cacheRead: 500,
		});

		expect(boundary).toMatchObject({
			kind: "message",
			hitCount: 1,
			message: ref("C", 100),
			change: "moved",
		});
	});

	it("第 0 条就断：cacheRead 只够消息之前的前缀，一条都没命中", () => {
		const previous = [ref("A", 200)];
		const current = [ref("A", 200, 5)];
		const boundary = inferCachePrefixBreak({
			previous,
			previousPromptTokens: 1200, // 前缀 1000
			current,
			cacheRead: 1050,
		});

		expect(boundary).toMatchObject({ kind: "message", hitCount: 0, change: "changed" });
	});

	it("全部命中", () => {
		const previous = [ref("A", 100), ref("B", 200)];
		const current = [ref("A", 100), ref("B", 200)];
		const boundary = inferCachePrefixBreak({
			previous,
			previousPromptTokens: 800, // 前缀 500
			current,
			cacheRead: 800,
		});

		expect(boundary).toEqual({ kind: "all_hit", hitCount: 2, uncertain: undefined });
	});

	it("断点在消息列表之前（系统提示词 / 工具定义变了）—— 一个消息条数都不编", () => {
		const previous = [ref("A", 100)];
		const current = [ref("A", 100)];
		const boundary = inferCachePrefixBreak({
			previous,
			previousPromptTokens: 1000, // 前缀 900
			current,
			cacheRead: 400,
		});

		expect(boundary).toMatchObject({
			kind: "before_messages",
			prefixTokens: 900,
			cacheRead: 400,
			// 没给分段清单（旧台账 / 不走组装）→ 段级归因如实说判不出来。
			systemChange: { kind: "undetermined" },
			uncertain: undefined,
		});
	});

	it("无数据：没逐条明细 / 没 cacheRead 都如实返回不确定，不编边界", () => {
		const none = inferCachePrefixBreak({
			previous: undefined,
			previousPromptTokens: undefined,
			current: [],
			cacheRead: 100,
		});
		expect(none.kind).toBe("unknown");

		const noCache = inferCachePrefixBreak({
			previous: undefined,
			previousPromptTokens: undefined,
			current: [ref("A", 100)],
			cacheRead: undefined,
		});
		expect(noCache.kind).toBe("unknown");
	});

	it("没有上一轮：能给出边界，但变化原因只能是 unknown，并附上说明", () => {
		const boundary = inferCachePrefixBreak({
			previous: undefined,
			previousPromptTokens: undefined,
			current: [ref("A", 100)],
			cacheRead: 50,
		});

		expect(boundary).toMatchObject({ kind: "message", hitCount: 0, change: "unknown" });
		expect(boundary.kind === "message" && boundary.uncertain).toContain("缺少上一轮");
	});

	it("估算对齐超过与上一轮的首个差异处时收敛到差异点（不编更大的命中量）", () => {
		const previous = [ref("A", 100), ref("B", 100)];
		const current = [ref("A", 100), ref("B", 100), ref("C", 100)];
		const boundary = inferCachePrefixBreak({
			previous,
			previousPromptTokens: 1200, // 前缀 1000
			current,
			// cacheRead 声称三条都命中 —— 但 C 是新增的，与上一轮不可能有公共前缀。
			cacheRead: 1300,
		});

		expect(boundary).toMatchObject({ kind: "message", hitCount: 2, change: "appended" });
		expect(boundary.kind === "message" && boundary.uncertain).toContain("收敛到首个差异处");
	});

	it("断点那条与上一轮完全相同：归因 unknown，并说明原因在更前面", () => {
		const previous = [ref("A", 100), ref("B", 100)];
		const current = [ref("A", 100), ref("B", 100)];
		const boundary = inferCachePrefixBreak({
			previous,
			previousPromptTokens: 1200, // 前缀 1000
			current,
			cacheRead: 1100,
		});

		expect(boundary).toMatchObject({ kind: "message", hitCount: 1, change: "unknown" });
		expect(boundary.kind === "message" && boundary.uncertain).toContain("与上一轮完全相同");
	});
});

/** 断点在消息列表之前的构造：前缀 900（上一轮总量 1000 − 消息 100），cacheRead 400。 */
const BEFORE_MESSAGES_ARGS = {
	previous: [ref("A", 100)],
	previousPromptTokens: 1000,
	current: [ref("A", 100)],
	cacheRead: 400,
} as const;

describe("inferCachePrefixBreak 的系统提示词分段 diff（CACHE6 的 before_messages 归因）", () => {
	it("某一段内容变了：指认 source 名与两轮字符数，并给出「前 N 段命中」", () => {
		const boundary = inferCachePrefixBreak({
			...BEFORE_MESSAGES_ARGS,
			previousSegments: [seg("skeleton", 500, 11), seg("mode:craft", 120, 22), seg("skills", 1200, 33)],
			currentSegments: [seg("skeleton", 500, 11), seg("mode:craft", 120, 22), seg("skills", 1180, 34)],
		});

		expect(boundary).toMatchObject({
			kind: "before_messages",
			systemChange: {
				kind: "segment_changed",
				source: "skills",
				previousChars: 1200,
				chars: 1180,
				hitSegments: 2,
			},
		});
	});

	it("首段就变：hitSegments 为 0", () => {
		const boundary = inferCachePrefixBreak({
			...BEFORE_MESSAGES_ARGS,
			previousSegments: [seg("skeleton", 500, 11), seg("skills", 1200, 33)],
			currentSegments: [seg("skeleton", 480, 12), seg("skills", 1200, 33)],
		});

		expect(boundary).toMatchObject({
			kind: "before_messages",
			systemChange: { kind: "segment_changed", source: "skeleton", hitSegments: 0 },
		});
	});

	it("分段新增（顺序或集合变化）：报多出来的那一段与它之前命中的段数", () => {
		const boundary = inferCachePrefixBreak({
			...BEFORE_MESSAGES_ARGS,
			previousSegments: [seg("skeleton", 500, 11), seg("mode:craft", 120, 22)],
			currentSegments: [
				seg("skeleton", 500, 11),
				seg("mode:craft", 120, 22),
				seg("memory-system", 300, 44),
			],
		});

		expect(boundary).toMatchObject({
			kind: "before_messages",
			systemChange: { kind: "segment_appended", source: "memory-system", hitSegments: 2 },
		});
	});

	it("分段消失：报少掉的那一段", () => {
		const boundary = inferCachePrefixBreak({
			...BEFORE_MESSAGES_ARGS,
			previousSegments: [
				seg("skeleton", 500, 11),
				seg("mode:craft", 120, 22),
				seg("skills", 1200, 33),
			],
			currentSegments: [seg("skeleton", 500, 11), seg("mode:craft", 120, 22)],
		});

		expect(boundary).toMatchObject({
			kind: "before_messages",
			systemChange: { kind: "segment_removed", source: "skills", hitSegments: 2 },
		});
	});

	it("两轮分段逐段一致：说明断点在系统提示词**之前**（工具集 / 模型），不乱指一段", () => {
		const boundary = inferCachePrefixBreak({
			...BEFORE_MESSAGES_ARGS,
			previousSegments: [seg("skeleton", 500, 11), seg("skills", 1200, 33)],
			currentSegments: [seg("skeleton", 500, 11), seg("skills", 1200, 33)],
		});

		expect(boundary).toMatchObject({
			kind: "before_messages",
			systemChange: { kind: "unchanged" },
		});
	});

	it("旧台账没有分段指纹：字符数也相同 → 如实返回不确定，不编「某段变了」", () => {
		const boundary = inferCachePrefixBreak({
			...BEFORE_MESSAGES_ARGS,
			previousSegments: [{ source: "skills", chars: 1200 }],
			currentSegments: [{ source: "skills", chars: 1200 }],
		});

		const change = boundary.kind === "before_messages" ? boundary.systemChange : undefined;
		expect(change?.kind).toBe("undetermined");
		expect(change?.kind === "undetermined" && change.note).toContain("没有分段指纹");
	});

	it("旧台账没有分段指纹但字符数不同：字符数已足以说「内容变了」", () => {
		const boundary = inferCachePrefixBreak({
			...BEFORE_MESSAGES_ARGS,
			previousSegments: [{ source: "skills", chars: 1200 }],
			currentSegments: [{ source: "skills", chars: 1180 }],
		});

		expect(boundary).toMatchObject({
			kind: "before_messages",
			systemChange: { kind: "segment_changed", source: "skills", hitSegments: 0 },
		});
	});

	it("两轮分段集合相同但顺序不同：指认不出哪一段 → 不确定", () => {
		const boundary = inferCachePrefixBreak({
			...BEFORE_MESSAGES_ARGS,
			previousSegments: [seg("mode:craft", 120, 22), seg("skills", 1200, 33)],
			currentSegments: [seg("skills", 1200, 33), seg("mode:craft", 120, 22)],
		});

		expect(boundary).toMatchObject({
			kind: "before_messages",
			systemChange: { kind: "undetermined" },
		});
	});
});

describe("inferCachePrefixBreak 对上下文快照条目的归因（不得再掩盖尾部失配）", () => {
	it("断点落在快照条目上：如实报「末尾这条新增」，不再因剔除尾部 other 而误报历史全命中", () => {
		// 上一轮末尾已有当时那条快照（custom:111）；本轮快照内容变了 → append-only
		// 又在末尾追加一条新的（custom:222）。两轮的真历史部分逐条相同。
		const previous = [ref("u:1", 100), ref("a:2", 50), snapshotRef("custom:111", 80)];
		const current = [
			ref("u:1", 100),
			ref("a:2", 50),
			snapshotRef("custom:111", 80),
			snapshotRef("custom:222", 80),
		];
		const boundary = inferCachePrefixBreak({
			previous,
			// 前缀 = 380（上一轮真实 prompt 总量）− 230（上一轮消息估算）= 150。
			previousPromptTokens: 380,
			// 前缀 150 + 前三条消息 230 = 380：上一轮 prompt 全部命中，断在本轮新增的快照上。
			current,
			cacheRead: 380,
		});

		// 旧实现把尾部 other 条目（custom:222）剔掉后会返回 all_hit —— 正是本次要修的盲区。
		expect(boundary).toEqual({
			kind: "message",
			hitCount: 3,
			message: snapshotRef("custom:222", 80),
			change: "appended",
			uncertain: undefined,
		});
	});

	it("快照 id 稳定（落盘后不再变）：两轮逐条相同就是真命中，不是被剔除的假象", () => {
		const previous = [ref("u:1", 100), snapshotRef("custom:111", 80)];
		const current = [ref("u:1", 100), snapshotRef("custom:111", 80)];
		const boundary = inferCachePrefixBreak({
			previous,
			previousPromptTokens: 300, // 前缀 = 300 − 180 = 120
			current,
			cacheRead: 300,
		});

		expect(boundary).toEqual({ kind: "all_hit", hitCount: 2, uncertain: undefined });
	});

	it("中段/头部的快照条目照常参与 diff（不被当成尾部幽灵误伤）", () => {
		const previous = [ref("u:1", 100), snapshotRef("custom:111", 50), ref("a:2", 50)];
		const current = [ref("u:1", 100), snapshotRef("custom:111", 50), ref("a:2", 50, 7)];
		const boundary = inferCachePrefixBreak({
			previous,
			previousPromptTokens: 300, // 前缀 = 300 − 200 = 100
			// 前缀 100 + 前两条 150 = 250：命中 2 条，断在内容变了的 a:2 上。
			current,
			cacheRead: 250,
		});

		expect(boundary).toMatchObject({
			kind: "message",
			hitCount: 2,
			message: { id: "a:2" },
			change: "changed",
		});
	});
});
