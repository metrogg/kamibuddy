/**
 * turn-fold 纯函数层的行为测试（spec: add-turn-fold-and-anchor Task 2）。
 *
 * 钉住三类行为：
 *   1. 开合状态机（缺省折叠 / 手点切换 / 新 run 收回 / sticky）
 *   2. 轮切分（user 边界 / 前缀轮 / 空轮保留 / key 稳定）
 *   3. 轮终态推导与计划接线（streaming 不折 / 完成轮折 / 错误轮 / 取消标记）
 */

import { describe, expect, it } from "vitest";
import type {
	AssistantMessage,
	ErrorEntry,
	ToolCard,
	UserMessage,
} from "@shared/session-events.ts";
import {
	EMPTY_TURN_FOLDS,
	buildTurnViews,
	collapseAllTurnFolds,
	toggleTurnFold,
	turnFoldExpanded,
} from "./turn-fold.ts";

function user(id: string): UserMessage {
	return { id, role: "user", text: `消息 ${id}`, at: 1 };
}

function assistant(id: string, text: string): AssistantMessage {
	return { id, role: "assistant", text, at: 1 };
}

function tool(id: string): ToolCard {
	return {
		id,
		role: "tool",
		toolName: "read",
		label: "工具",
		summary: `src/${id}.ts`,
		outcome: "ok",
		detail: undefined,
		at: 1,
	};
}

function error(id: string): ErrorEntry {
	return { id, role: "error", message: `错误 ${id}`, runId: `r-${id}`, at: 1 };
}

describe("开合状态机", () => {
	it("缺省即折叠：完成/历史轮无需任何写入", () => {
		expect(turnFoldExpanded(EMPTY_TURN_FOLDS, "t1")).toBe(false);
	});

	it("手点切换：展开 ↔ 收起往返，其他轮的记录不受影响", () => {
		const opened = toggleTurnFold(EMPTY_TURN_FOLDS, "t1");
		expect(turnFoldExpanded(opened, "t1")).toBe(true);
		const other = toggleTurnFold(opened, "t2");
		expect(turnFoldExpanded(other, "t2")).toBe(true);
		expect(turnFoldExpanded(other, "t1")).toBe(true);
		const closed = toggleTurnFold(other, "t1");
		expect(turnFoldExpanded(closed, "t1")).toBe(false);
		expect(turnFoldExpanded(closed, "t2")).toBe(true);
	});

	it("新 run 开始：所有手点展开一并收回（上一轮立即折叠）", () => {
		let map = toggleTurnFold(EMPTY_TURN_FOLDS, "t1");
		map = toggleTurnFold(map, "t2");
		const collapsed = collapseAllTurnFolds(map);
		expect(turnFoldExpanded(collapsed, "t1")).toBe(false);
		expect(turnFoldExpanded(collapsed, "t2")).toBe(false);
	});

	it("sticky：收回后保持折叠，只有再次手点才展开", () => {
		const map = collapseAllTurnFolds(toggleTurnFold(EMPTY_TURN_FOLDS, "t1"));
		// 状态抖动（重复读/重算）不产生展开。
		expect(turnFoldExpanded(map, "t1")).toBe(false);
		expect(turnFoldExpanded(map, "t1")).toBe(false);
		expect(turnFoldExpanded(toggleTurnFold(map, "t1"), "t1")).toBe(true);
	});

	it("空 Map 收回：返回原引用（不给渲染制造无意义的新对象）", () => {
		expect(collapseAllTurnFolds(EMPTY_TURN_FOLDS)).toBe(EMPTY_TURN_FOLDS);
	});
});

describe("轮切分", () => {
	it("空 entries → 空序列", () => {
		expect(buildTurnViews([], { streaming: false })).toEqual([]);
	});

	it("按 user 切轮：key 稳定，内容归到各自轮", () => {
		const views = buildTurnViews(
			[user("u1"), tool("t1"), assistant("a1", "终答"), user("u2"), tool("t2")],
			{ streaming: false },
		);
		expect(views.map((v) => v.key)).toEqual(["turn-u1", "turn-u2"]);
		expect(views.every((v) => v.startsWithUser)).toBe(true);
		expect(views.map((v) => v.turnId)).toEqual(["u1", "u2"]);
		expect(views[0]?.plan.items.map((i) => i.kind)).toEqual(["turn-folded", "anchor"]);
	});

	it("首个 user 之前的内容归前缀轮（无 turnId、不挂锚定空间）", () => {
		const views = buildTurnViews([tool("t0"), user("u1")], { streaming: false });
		expect(views.map((v) => [v.key, v.startsWithUser, v.turnId])).toEqual([
			["turn-prefix", false, undefined],
			["turn-u1", true, "u1"],
		]);
	});

	it("连续 user：空轮保留（回合头部照常落位）", () => {
		const views = buildTurnViews([user("u1"), user("u2"), tool("t1")], { streaming: false });
		expect(views.map((v) => v.key)).toEqual(["turn-u1", "turn-u2"]);
		expect(views[0]?.plan.items).toEqual([]);
		expect(views[0]?.plan.hasTurnFold).toBe(false);
	});
});

describe("轮终态推导与计划接线", () => {
	it("流式中：最后一条 user 所在轮 streaming（全展开），历史轮 finished（折叠）", () => {
		const views = buildTurnViews(
			[user("u1"), tool("t1"), tool("t2"), assistant("a1", "终答"), user("u2"), tool("t3")],
			{ streaming: true },
		);
		expect(views[0]?.state).toBe("finished");
		expect(views[0]?.plan.hasTurnFold).toBe(true);
		expect(views[1]?.state).toBe("streaming");
		expect(views[1]?.plan.hasTurnFold).toBe(false);
		expect(views[1]?.plan.items.every((i) => i.kind === "visible")).toBe(true);
	});

	it("同一份 entries 流式结束后该轮转入折叠计划", () => {
		const entries = [user("u1"), tool("t1"), tool("t2"), assistant("a1", "终答")];
		expect(buildTurnViews(entries, { streaming: true })[0]?.state).toBe("streaming");
		const finished = buildTurnViews(entries, { streaming: false })[0];
		expect(finished?.state).toBe("finished");
		expect(finished?.plan.items.map((i) => i.kind)).toEqual(["turn-folded", "anchor"]);
	});

	it("含错误条目的轮 → error（错误卡豁免在折叠区外）", () => {
		const views = buildTurnViews([user("u1"), tool("t1"), tool("t2"), error("e1")], {
			streaming: false,
		});
		expect(views[0]?.state).toBe("error");
		expect(views[0]?.plan.items.map((i) => i.kind)).toEqual(["turn-folded", "exempt"]);
	});

	it("没有任何 user 且流式中：前缀轮就是活轮（streaming，不折叠）", () => {
		const views = buildTurnViews([tool("t1")], { streaming: true });
		expect(views[0]?.state).toBe("streaming");
	});

	it("取消标记接线：被取消轮末尾补指示行，新轮不重置", () => {
		const views = buildTurnViews([user("u1"), tool("t1"), user("u2"), assistant("a2", "好")], {
			streaming: false,
			cancelledTurns: ["u1"],
		});
		expect(views[0]?.cancelled).toBe(true);
		expect(views[1]?.cancelled).toBe(false);
	});
});
