import { describe, expect, it } from "vitest";
import { activePendingAlign, decideScrollAction } from "./send-anchor.ts";
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
