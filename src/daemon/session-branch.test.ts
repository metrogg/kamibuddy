/**
 * session-branch（daemon 侧分支纯逻辑）的测试。
 *
 * 钉住四件事：序号 → 锚点（命中与越界）、抽枝判定（有未来 / 无未来 / 锚点是叶子）、
 * 分支标题的重名递增（母标题为空时取会话列表同一占位）、失败结果只出现契约里的
 * 四个 reason 且文案可直接展示。
 */

import { describe, expect, it } from "vitest";
import type { SessionBranchFailReason, SessionBranchResult } from "../shared/ipc.ts";
import {
	branchFail,
	branchOk,
	buildBranchTitle,
	decideExtract,
	endOfTurn,
	resolveAnchorForIndex,
	type BranchEntry,
	type ForkAnchor,
} from "./session-branch.ts";

const ANCHORS: readonly ForkAnchor[] = [
	{ entryId: "u1", text: "第一轮" },
	{ entryId: "u2", text: "第二轮" },
];

describe("resolveAnchorForIndex", () => {
	it("按 0 基序号命中锚点", () => {
		expect(resolveAnchorForIndex(ANCHORS, 0)?.entryId).toBe("u1");
		expect(resolveAnchorForIndex(ANCHORS, 1)).toEqual({ entryId: "u2", text: "第二轮" });
	});

	it("越界与非法序号返回 undefined（由调用方转 no-such-entry）", () => {
		expect(resolveAnchorForIndex(ANCHORS, 2)).toBeUndefined();
		expect(resolveAnchorForIndex(ANCHORS, 99)).toBeUndefined();
		expect(resolveAnchorForIndex(ANCHORS, -1)).toBeUndefined();
		expect(resolveAnchorForIndex(ANCHORS, 1.5)).toBeUndefined();
		expect(resolveAnchorForIndex([], 0)).toBeUndefined();
	});
});

/** 一条线性会话：u1 → a1 → u2 → a2（parentId 为 null 的是根）。 */
const LINEAR: readonly BranchEntry[] = [
	{ id: "u1", parentId: null },
	{ id: "a1", parentId: "u1" },
	{ id: "u2", parentId: "a1" },
	{ id: "a2", parentId: "u2" },
];

describe("decideExtract", () => {
	it("分叉点之后还有条目 → 抽枝", () => {
		expect(decideExtract(LINEAR, "u2")).toBe(true);
		expect(decideExtract(LINEAR, "u1")).toBe(true);
	});

	it("锚点就是末条（叶子）→ 不抽枝", () => {
		expect(decideExtract(LINEAR, "a2")).toBe(false);
	});

	it("锚点不在该会话里 → 不抽枝（不抛错）", () => {
		expect(decideExtract(LINEAR, "不存在")).toBe(false);
		expect(decideExtract([], "u1")).toBe(false);
	});

	it("后代经旁支间接挂上也算「有未来」，成环数据不卡死", () => {
		const forked: readonly BranchEntry[] = [
			{ id: "u1", parentId: null },
			{ id: "a1", parentId: "u1" },
			{ id: "u2", parentId: "a1" },
			{ id: "a2", parentId: "u2" },
		];
		expect(decideExtract(forked, "a1")).toBe(true);

		const cyclic: readonly BranchEntry[] = [
			{ id: "x", parentId: "y" },
			{ id: "y", parentId: "x" },
		];
		expect(decideExtract(cyclic, "x")).toBe(true);
	});
});

describe("buildBranchTitle", () => {
	it("默认取「母标题 · 分支」", () => {
		expect(buildBranchTitle("写周报", [])).toBe("写周报 · 分支");
	});

	it("与现有标题重名时递增序号", () => {
		expect(buildBranchTitle("写周报", ["写周报 · 分支"])).toBe("写周报 · 分支 2");
		expect(buildBranchTitle("写周报", ["写周报 · 分支", "写周报 · 分支 2"])).toBe(
			"写周报 · 分支 3",
		);
	});

	it("序号中间有空缺时取最小可用的那个（与顺序无关）", () => {
		expect(buildBranchTitle("写周报", ["写周报 · 分支 2"])).toBe("写周报 · 分支");
		expect(buildBranchTitle("写周报", ["写周报 · 分支", "写周报 · 分支 3"])).toBe(
			"写周报 · 分支 2",
		);
	});

	it("母标题为空/只有空白时取会话列表的同一占位文案", () => {
		expect(buildBranchTitle("", [])).toBe("（空会话） · 分支");
		expect(buildBranchTitle("   ", [])).toBe("（空会话） · 分支");
	});

	it("母标题的首尾空白不入标题", () => {
		expect(buildBranchTitle("  写周报  ", [])).toBe("写周报 · 分支");
	});
});

/** 取出失败结果的 reason/message；若实际是成功结果则直接测试失败。 */
function failureOf(result: SessionBranchResult): {
	readonly reason: SessionBranchFailReason;
	readonly message: string;
} {
	if (result.ok) throw new Error("期望失败结果，实际是成功");
	return { reason: result.reason, message: result.message };
}

describe("branchOk / branchFail", () => {
	it("没抽枝时只报成功，不编造分支路径与标题", () => {
		expect(branchOk()).toEqual({ ok: true });
	});

	it("抽了枝时带上新会话的路径与标题", () => {
		expect(branchOk({ path: "C:\\s\\b.jsonl", title: "写周报 · 分支" })).toEqual({
			ok: true,
			branchPath: "C:\\s\\b.jsonl",
			branchTitle: "写周报 · 分支",
		});
	});

	it("失败 reason 只落在契约的四个值内，且默认文案非空", () => {
		const reasons: readonly SessionBranchFailReason[] = [
			"busy",
			"no-file",
			"no-such-entry",
			"write-failed",
		];
		for (const reason of reasons) {
			const failure = failureOf(branchFail(reason));
			expect(reasons).toContain(failure.reason);
			expect(failure.reason).toBe(reason);
			expect(failure.message.trim().length).toBeGreaterThan(0);
		}
		expect(failureOf(branchFail("busy")).message).toBe("正在生成，稍后再试");
	});

	it("需要补充细节时可覆盖文案", () => {
		expect(failureOf(branchFail("write-failed", "磁盘已满")).message).toBe("磁盘已满");
	});
});


describe("endOfTurn（「复制到这条回答为止」的叶子定位）", () => {
	/** 线性会话：u1 → a1 → u2 → a2 → 工具结果 → 续答。 */
	const linear: BranchEntry[] = [
		{ id: "u1", parentId: null, role: "user" },
		{ id: "a1", parentId: "u1", role: "assistant" },
		{ id: "u2", parentId: "a1", role: "user" },
		{ id: "a2", parentId: "u2", role: "assistant" },
		{ id: "t2", parentId: "a2", role: "toolResult" },
		{ id: "a3", parentId: "t2", role: "assistant" },
	];

	it("走完本轮：跨过回答之后的工具与续答，停在下一个用户消息之前", () => {
		expect(endOfTurn(linear, "u2")).toBe("a3");
	});

	it("本轮还没答完（锚点就是叶子）→ 返回锚点自己", () => {
		expect(endOfTurn([{ id: "u1", parentId: null, role: "user" }], "u1")).toBe("u1");
	});

	it("非消息条目不算轮末（model_change 也会被跨过）", () => {
		const withMeta: BranchEntry[] = [
			{ id: "u1", parentId: null, role: "user" },
			{ id: "m1", parentId: "u1" },
			{ id: "a1", parentId: "m1", role: "assistant" },
		];
		expect(endOfTurn(withMeta, "u1")).toBe("a1");
	});

	it("分叉树：取第一个孩子那条链（不抛错、不迷路）", () => {
		const forked: BranchEntry[] = [
			{ id: "u1", parentId: null, role: "user" },
			{ id: "a1", parentId: "u1", role: "assistant" },
			{ id: "a1b", parentId: "u1", role: "assistant" },
		];
		expect(endOfTurn(forked, "u1")).toBe("a1");
	});
});
