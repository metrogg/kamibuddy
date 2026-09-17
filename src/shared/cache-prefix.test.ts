import { describe, expect, it } from "vitest";
import { inferCachePrefixBreak } from "./cache-prefix.ts";
import type { MessageRef, SystemSegmentStat } from "./observability.ts";

/** 造一条逐条明细：只给本文件关心的字段（id / token / 指纹）。 */
function ref(id: string, tokens: number, fp = 1): MessageRef {
	return { id, role: "user", chars: tokens * 4, tokens, fp };
}

/** 造一条瞬态注入项（prompt-switch 的 context 事件那条，写入端会标 transient）。 */
function transient(id: string, tokens: number): MessageRef {
	return { ...ref(id, tokens, 99), role: "other", transient: true };
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

describe("inferCachePrefixBreak 对瞬态注入项的处理（不许每轮误报一次）", () => {
	/*
	 * prompt-switch 的 context 事件每请求注入一条 kamibuddy-runtime-context
	 * （不落会话，下一轮请求里就不在了）。它在 messageList 里表现为「上一轮尾部
	 * 有一条、这一轮换成了另一条」—— 若参与 diff，每轮都会把「其实历史全命中」
	 * 说成「断在最后一条」。这里的用例就是钉住它不被算成断点。
	 */
	it("新台账（有显式 transient 标记）：幽灵条目被剔除，真历史全命中就是 all_hit", () => {
		// 两轮的真历史逐条相同，只有尾部那条瞬态注入项换了一条（每请求现算的必然结果）。
		const previous = [ref("u:1", 100), ref("a:2", 50), transient("custom:111", 50)];
		const current = [ref("u:1", 100), ref("a:2", 50), transient("custom:222", 60)];
		const boundary = inferCachePrefixBreak({
			previous,
			// 前缀 = 300 − (100 + 50 + 50) = 100（定标用含瞬态项的上一轮名册）。
			previousPromptTokens: 300,
			current,
			cacheRead: 250, // 前缀 100 + u:1 100 + a:2 50 = 250
		});

		// 不剔除幽灵条目的话，边界会落在尾部那条（id 每轮都不同）→ 被说成「第 3 条新增」。
		expect(boundary).toEqual({ kind: "all_hit", hitCount: 2, uncertain: undefined });
	});

	it("旧台账（没有 transient 字段）：退到「role 归 other 的尾部条目」剔除", () => {
		const legacyGhost = (id: string, tokens: number): MessageRef => ({
			...ref(id, tokens, 99),
			role: "other",
		});
		const previous = [ref("u:1", 100), ref("a:2", 50), legacyGhost("custom:111", 50)];
		const current = [ref("u:1", 100), ref("a:2", 50), legacyGhost("custom:222", 60)];
		const boundary = inferCachePrefixBreak({
			previous,
			previousPromptTokens: 300,
			current,
			cacheRead: 250,
		});

		expect(boundary).toMatchObject({ kind: "all_hit", hitCount: 2 });
	});

	it("真历史条目不会被误伤（新台账里没有标记的条目照常参与 diff）", () => {
		const previous = [ref("u:1", 100), transient("custom:111", 50)];
		const current = [ref("u:1", 100), ref("a:2", 50, 7), transient("custom:222", 60)];
		const boundary = inferCachePrefixBreak({
			previous,
			previousPromptTokens: 300,
			current,
			cacheRead: 200, // 前缀 150 + u:1 100 = 250 > 200 → 只够前缀 + 一部分
		});

		// 边界落在 u:1（命中 0 条），不是尾部那条幽灵。
		expect(boundary).toMatchObject({
			kind: "message",
			hitCount: 0,
			message: { id: "u:1" },
		});
	});
});
