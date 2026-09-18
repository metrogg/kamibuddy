/**
 * 团队常驻状态栏的纯函数测试（spec: add-team-ux-parity 批次 ①②）。
 *
 * renderer 没有组件测试基建（项目先例：只测纯函数），所以「每枚 chip 显示什么」与
 * 「↓ 该切到谁」这两层最易回归的逻辑都抽成了纯函数钉在这里。
 */

import { describe, expect, it } from "vitest";
import type { SubagentStatus } from "@shared/session-events.ts";
import { nextMemberTarget, teamBarRows } from "./team-status-bar.tsx";

function member(overrides: Partial<SubagentStatus> & { agent: string }): SubagentStatus {
	return {
		task: "任务",
		status: "running",
		activity: "",
		turns: 0,
		kind: "team",
		...overrides,
	};
}

describe("teamBarRows", () => {
	it("只要团队成员（kind 缺省或 subagent 的投影不进状态栏）", () => {
		const rows = teamBarRows(
			[
				member({ agent: "谭溯源", sessionId: "s1" }),
				{ ...member({ agent: "scout" }), kind: "subagent" },
				{ ...member({ agent: "旧格式" }), kind: undefined },
			],
			undefined,
		);
		expect(rows.map((row) => row.name)).toEqual(["谭溯源"]);
	});

	it("四态各有符号与色档（… 启动中 / ● 运行中 / ✓ 已完成 / ✗ 失败）", () => {
		const rows = teamBarRows(
			[
				member({ agent: "a", status: "queued" }),
				member({ agent: "b", status: "running" }),
				member({ agent: "c", status: "done" }),
				member({ agent: "d", status: "failed" }),
			],
			undefined,
		);
		expect(rows.map((row) => `${row.mark}${row.tone}`)).toEqual(["…queued", "●running", "✓done", "✗failed"]);
		expect(rows.map((row) => row.live)).toEqual([false, true, false, false]);
	});

	it("计数只显示有内容的项（0 轮 0 工具是噪音）", () => {
		const rows = teamBarRows(
			[
				member({ agent: "刚起步" }),
				member({ agent: "干活的", turns: 3, toolCalls: 12 }),
				member({ agent: "只有轮数", turns: 2 }),
			],
			undefined,
		);
		expect(rows.map((row) => row.count)).toEqual(["", "3 轮 · 12 工具", "2 轮"]);
	});

	it("没有 sessionId 的成员不可点（会话还没建好，聚焦它只会看到空白）", () => {
		const rows = teamBarRows([member({ agent: "启动中" }), member({ agent: "就绪", sessionId: "s1" })], undefined);
		expect(rows.map((row) => row.clickable)).toEqual([false, true]);
	});

	it("currentName 命中的那枚标记为 current（状态栏高亮当前查看的成员）", () => {
		const rows = teamBarRows(
			[member({ agent: "a", sessionId: "s1" }), member({ agent: "b", sessionId: "s2" })],
			"b",
		);
		expect(rows.map((row) => row.current)).toEqual([false, true]);
	});

	it("空团队 → 空行（调用方据此不渲染整条状态栏）", () => {
		expect(teamBarRows([], undefined)).toEqual([]);
		expect(teamBarRows([{ ...member({ agent: "scout" }), kind: "subagent" }], undefined)).toEqual([]);
	});
});

describe("nextMemberTarget（↓ 的轮转目标）", () => {
	const members = [
		member({ agent: "甲", sessionId: "s1" }),
		member({ agent: "乙", sessionId: "s2" }),
		member({ agent: "丙", sessionId: "s3" }),
	];

	it("主理人视图 → 第一个成员", () => {
		expect(nextMemberTarget(members, undefined)).toEqual({ kind: "member", sessionId: "s1", name: "甲" });
	});

	it("成员视图 → 下一个成员", () => {
		expect(nextMemberTarget(members, "乙")).toEqual({ kind: "member", sessionId: "s3", name: "丙" });
	});

	it("最后一个成员 → 回主理人视图（末尾即回领导，与 Ctrl+O 同路）", () => {
		expect(nextMemberTarget(members, "丙")).toEqual({ kind: "leader" });
	});

	it("当前成员已从投影里消失（团队重建/成员被收）→ 回第一个成员，不卡死", () => {
		expect(nextMemberTarget(members, "已关闭的成员")).toEqual({ kind: "member", sessionId: "s1", name: "甲" });
	});

	it("跳过没有 sessionId 的成员（聚焦空壳会白屏）", () => {
		const withStarting = [member({ agent: "还没好" }), member({ agent: "甲", sessionId: "s1" })];
		expect(nextMemberTarget(withStarting, undefined)).toEqual({ kind: "member", sessionId: "s1", name: "甲" });
	});

	it("没有团队成员 → undefined（调用方不拦截该按键，保持原生 ↓）", () => {
		expect(nextMemberTarget([], undefined)).toBeUndefined();
		expect(nextMemberTarget([member({ agent: "无会话成员" })], undefined)).toBeUndefined();
	});
});
