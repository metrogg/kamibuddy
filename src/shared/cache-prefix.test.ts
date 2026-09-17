import { describe, expect, it } from "vitest";
import { inferCachePrefixBreak } from "./cache-prefix.ts";
import type { MessageRef } from "./observability.ts";

/** 造一条逐条明细：只给本文件关心的字段（id / token / 指纹）。 */
function ref(id: string, tokens: number, fp = 1): MessageRef {
	return { id, role: "user", chars: tokens * 4, tokens, fp };
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

		expect(boundary).toEqual({
			kind: "before_messages",
			prefixTokens: 900,
			cacheRead: 400,
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
