import { describe, expect, it } from "vitest";
import type { RenderBlock } from "@shared/metafold.ts";
import { activePendingAlign, decideScrollAction, groupTurnBlocks } from "./send-anchor.ts";
import type { PendingSentAlign } from "./send-anchor.ts";

/** 快捷构造一条待吸顶记录。 */
function pendingOf(overrides: Partial<PendingSentAlign> = {}): PendingSentAlign {
	return { sessionId: "s1", baselineUserId: "u1", aligned: false, ...overrides };
}

describe("decideScrollAction —— 新发送→吸顶（WorkBuddy useFirstMessageAlign）", () => {
	it("本会话新发送的 user 消息上屏 → 吸顶这条消息", () => {
		expect(
			decideScrollAction({
				pending: pendingOf(),
				sessionId: "s1",
				lastUserEntryId: "u2",
				isFollowing: true,
			}),
		).toEqual({ kind: "align-top", entryId: "u2" });
	});

	it("首条消息（发送时还没有任何 user 基线）上屏 → 吸顶", () => {
		expect(
			decideScrollAction({
				pending: pendingOf({ baselineUserId: undefined }),
				sessionId: "s1",
				lastUserEntryId: "u1",
				isFollowing: true,
			}),
		).toEqual({ kind: "align-top", entryId: "u1" });
	});

	it("吸顶不看跟随状态：发送时上翻阅读中，回显上屏照样吸顶（发送是明确的「带我去看」手势）", () => {
		expect(
			decideScrollAction({
				pending: pendingOf(),
				sessionId: "s1",
				lastUserEntryId: "u2",
				isFollowing: false,
			}),
		).toEqual({ kind: "align-top", entryId: "u2" });
	});

	it("回显还没上屏（lastUser 仍是发送时的基线）→ 不动，等回显", () => {
		expect(
			decideScrollAction({
				pending: pendingOf(),
				sessionId: "s1",
				lastUserEntryId: "u1",
				isFollowing: true,
			}),
		).toEqual({ kind: "none" });
	});

	it("回显还没上屏（连 user 消息都没有）→ 不动", () => {
		expect(
			decideScrollAction({
				pending: pendingOf({ baselineUserId: undefined }),
				sessionId: "s1",
				lastUserEntryId: undefined,
				isFollowing: true,
			}),
		).toEqual({ kind: "none" });
	});

	it("吸顶已发出（aligned）→ 不再重复吸顶，转入既有跟随语义", () => {
		expect(
			decideScrollAction({
				pending: pendingOf({ aligned: true }),
				sessionId: "s1",
				lastUserEntryId: "u2",
				isFollowing: true,
			}),
		).toEqual({ kind: "stick-bottom" });
	});
});

describe("decideScrollAction —— 既有吸底跟随语义不被破坏", () => {
	it("streaming 事件且跟随中（无待吸顶）→ 吸底", () => {
		expect(
			decideScrollAction({
				pending: undefined,
				sessionId: "s1",
				lastUserEntryId: "u1",
				isFollowing: true,
			}),
		).toEqual({ kind: "stick-bottom" });
	});

	it("用户上翻解除跟随后 → 不动", () => {
		expect(
			decideScrollAction({
				pending: undefined,
				sessionId: "s1",
				lastUserEntryId: "u1",
				isFollowing: false,
			}),
		).toEqual({ kind: "none" });
	});
});

describe("decideScrollAction —— 切会话/恢复历史不触发吸顶", () => {
	it("待吸顶属于别的会话 → 不吸顶，走既有跟随（切会话后展示最新消息）", () => {
		expect(
			decideScrollAction({
				pending: pendingOf({ sessionId: "s1" }),
				sessionId: "s2",
				lastUserEntryId: "u9",
				isFollowing: true,
			}),
		).toEqual({ kind: "stick-bottom" });
	});

	it("待吸顶属于别的会话且用户上翻中 → 不动", () => {
		expect(
			decideScrollAction({
				pending: pendingOf({ sessionId: "s1" }),
				sessionId: "s2",
				lastUserEntryId: "u9",
				isFollowing: false,
			}),
		).toEqual({ kind: "none" });
	});

	it("恢复历史/加载旧消息（没有待吸顶记录）→ 只按跟随语义走，永不吸顶", () => {
		const action = decideScrollAction({
			pending: undefined,
			sessionId: "s2",
			lastUserEntryId: "u9",
			isFollowing: true,
		});
		expect(action.kind).not.toBe("align-top");
	});
});

describe("activePendingAlign —— 按会话过滤待吸顶记录", () => {
	it("同会话 → 记录有效", () => {
		const pending = pendingOf();
		expect(activePendingAlign(pending, "s1")).toBe(pending);
	});

	it("跨会话 → 作废", () => {
		expect(activePendingAlign(pendingOf(), "s2")).toBeUndefined();
	});

	it("没有记录 → undefined", () => {
		expect(activePendingAlign(undefined, "s1")).toBeUndefined();
	});
});

/* ── 回合分组 ─────────────────────────────────────────────────── */

function userBlock(id: string): RenderBlock {
	return { kind: "entry", entry: { id, role: "user", text: `消息 ${id}`, at: 0 } };
}

describe("groupTurnBlocks —— WorkBuddy groupedMessages 同构", () => {
	it("空块流 → 空分组", () => {
		expect(groupTurnBlocks([])).toEqual([]);
	});

	it("每个 user 块开启一组，同回合的回合头/折叠/取消块跟随其后", () => {
		const groups = groupTurnBlocks([
			userBlock("u1"),
			{ kind: "turn-header", userId: "u1" },
			{ kind: "fold", id: "fold-t1", summary: "读取 1 个文件", leadIcon: "read", cards: [] },
			{ kind: "cancelled", userId: "u1" },
			userBlock("u2"),
			{ kind: "turn-header", userId: "u2" },
		]);
		expect(groups.map((g) => g.key)).toEqual(["turn-u1", "turn-u2"]);
		expect(groups.every((g) => g.startsWithUser)).toBe(true);
		expect(groups[0]?.blocks.map((b) => b.kind)).toEqual(["entry", "turn-header", "fold", "cancelled"]);
		expect(groups[1]?.blocks.map((b) => b.kind)).toEqual(["entry", "turn-header"]);
	});

	it("首个 user 之前的块归入前缀组（startsWithUser=false，不挂锚定空间）", () => {
		const groups = groupTurnBlocks([
			{ kind: "fold", id: "fold-t0", summary: "读取 2 个文件", leadIcon: "read", cards: [] },
			userBlock("u1"),
		]);
		expect(groups.map((g) => [g.key, g.startsWithUser])).toEqual([
			["turn-prefix", false],
			["turn-u1", true],
		]);
	});

	it("组边界稳定：追加新回合不改变老回合的分组", () => {
		const base = [userBlock("u1"), { kind: "turn-header", userId: "u1" } as RenderBlock];
		const before = groupTurnBlocks(base);
		const after = groupTurnBlocks([...base, userBlock("u2")]);
		expect(after[0]?.blocks).toEqual(before[0]?.blocks);
		expect(after.map((g) => g.key)).toEqual(["turn-u1", "turn-u2"]);
	});
});
