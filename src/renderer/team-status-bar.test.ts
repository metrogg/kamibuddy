/**
 * 团队常驻状态栏的纯函数测试（spec: add-team-ux-parity 批次 ①②）。
 *
 * renderer 没有组件测试基建（项目先例：只测纯函数），所以「每枚 chip 显示什么」与
 * 「↓ 该切到谁」这两层最易回归的逻辑都抽成了纯函数钉在这里。
 */

import { describe, expect, it } from "vitest";
import type { SubagentStatus } from "@shared/session-events.ts";
import { formatWaiting, nextMemberTarget, teamBarRows, teamBarStats, WAITING_ALERT_MS } from "./team-status-bar.tsx";

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

	it("四态各有符号与色档（… 启动中 / ● 运行中 / ✓ 已完成 / ✗ 失败）", () => {		const rows = teamBarRows(
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

	it("中断态有自己的符号与标记（! / interrupted），不折成 done 或 failed", () => {
		const rows = teamBarRows(
			[member({ agent: "谭溯源", status: "interrupted" })],
			undefined,
		);
		expect(rows[0]?.mark).toBe("!");
		expect(rows[0]?.tone).toBe("interrupted");
		expect(rows[0]?.interrupted).toBe(true);
		expect(rows[0]?.statusText).toContain("中断");
		// 中断不是活动态，也不该被当成「运行中」去强调。
		expect(rows[0]?.live).toBe(false);
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

describe("等待可见性（spec: add-team-interrupt-diagnostics 批次 ②）", () => {
	const T0 = 1_700_000_000_000;

	it("waitingSince 缺席 = 不在等，不显示等待文案", () => {
		const rows = teamBarRows([member({ agent: "a", turns: 2 })], undefined, T0);
		expect(rows[0]?.waiting).toBe("");
		expect(rows[0]?.waitingAlert).toBe(false);
		expect(rows[0]?.count).toBe("2 轮");
	});

	it("不足 1 分钟不显示（「等了 0 分钟」是噪音）", () => {
		const rows = teamBarRows([member({ agent: "a", waitingSince: T0 - 30_000 })], undefined, T0);
		expect(rows[0]?.waiting).toBe("");
		expect(rows[0]?.waitingAlert).toBe(false);
	});

	it("分钟级显示「已等 N 分钟」，并追加进 count 摘要", () => {
		const rows = teamBarRows(
			[member({ agent: "a", turns: 1, waitingSince: T0 - 3 * 60_000 })],
			undefined,
			T0,
		);
		expect(rows[0]?.waiting).toBe("3 分钟");
		expect(rows[0]?.count).toBe("1 轮 · 已等 3 分钟");
	});

	it("恰好 5 分钟触发告警色（阈值含等号）", () => {
		const at = teamBarRows([member({ agent: "a", waitingSince: T0 - WAITING_ALERT_MS })], undefined, T0);
		expect(at[0]?.waitingAlert).toBe(true);
		const justUnder = teamBarRows(
			[member({ agent: "b", waitingSince: T0 - WAITING_ALERT_MS + 1 })],
			undefined,
			T0,
		);
		expect(justUnder[0]?.waitingAlert).toBe(false);
	});

	it("超 1 小时进位到小时", () => {
		const rows = teamBarRows(
			[member({ agent: "a", waitingSince: T0 - 2 * 60 * 60_000 - 30 * 60_000 })],
			undefined,
			T0,
		);
		expect(rows[0]?.waiting).toBe("2 小时");
		expect(rows[0]?.waitingAlert).toBe(true);
	});

	it("formatWaiting 的边界：59 分钟仍按分钟", () => {
		expect(formatWaiting(0)).toBe("");
		expect(formatWaiting(59_999)).toBe("");
		expect(formatWaiting(60_000)).toBe("1 分钟");
		expect(formatWaiting(59 * 60_000)).toBe("59 分钟");
		expect(formatWaiting(60 * 60_000)).toBe("1 小时");
	});
});

describe("产出可读（spec: add-team-pull-model 批次 ④：文件是唯一真源）", () => {
	const T0 = 1_700_000_000_000;

	it("outputAvailable 透传到行上", () => {
		const rows = teamBarRows([member({ agent: "谭溯源", outputAvailable: true })], undefined, T0);
		expect(rows[0]?.outputAvailable).toBe(true);
	});

	it("缺席 outputAvailable 时按 false（常态，不是「不知道」）", () => {
		const rows = teamBarRows([member({ agent: "a" })], undefined, T0);
		expect(rows[0]?.outputAvailable).toBe(false);
	});

	it("文案说清「产出还在 + 可去取回」而不是笼统的「已中断」", () => {
		const rows = teamBarRows(
			[member({ agent: "谭溯源", status: "interrupted", outputAvailable: true })],
			undefined,
			T0,
		);
		const text = rows[0]?.statusText ?? "";
		expect(text).toContain("已中断");
		expect(text).toContain("产出还在");
		expect(text).toContain("会话记录");
		expect(text).toContain("可去取回");
	});

	it("与 status 正交：运行中也可以带着已落盘的产出（前一轮的）", () => {
		const rows = teamBarRows([member({ agent: "a", status: "running", outputAvailable: true })], undefined, T0);
		expect(rows[0]?.statusText).toContain("运行中");
		expect(rows[0]?.statusText).toContain("产出还在");
	});

	it("没有产出可读时仍走原 STATUS_TEXT（不误报）", () => {
		const rows = teamBarRows([member({ agent: "a", status: "interrupted" })], undefined, T0);
		expect(rows[0]?.statusText).toBe("已中断（那一轮没有回音）");
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

/*
 * 2026-09-19 重排（用户实测：一行里塞 20 多字的摘要句 + 横滚 chip，第 4 枚被切一半）。
 * 头部的「总数 + 状态簇」与「计数只在运行中画」两条判据都抽成纯函数钉在这里 ——
 * renderer 没有组件测试基建，这层是最易回归的部分。
 */
describe("统计簇（总数 + 只列非零）", () => {
	const T0 = 1_700_000_000_000;

	it("总数就是团队人数（摘要句不再自带文案）", () => {
		const rows = teamBarRows([member({ agent: "a" }), member({ agent: "b" })], undefined, T0);
		expect(teamBarStats(rows).total).toBe(2);
	});

	it("全员完成 ⇒ 一个簇都不显示（0 是噪音）", () => {
		const rows = teamBarRows(
			[member({ agent: "a", status: "done" }), member({ agent: "b", status: "done" })],
			undefined,
			T0,
		);
		expect(teamBarStats(rows).parts).toEqual([]);
	});

	it("运行中与中断各成一簇，次序「越需要动手越靠前」", () => {
		const rows = teamBarRows(
			[
				member({ agent: "a", status: "interrupted" }),
				member({ agent: "b", status: "running" }),
				member({ agent: "c", status: "running" }),
				member({ agent: "d", status: "done" }),
			],
			undefined,
			T0,
		);
		expect(teamBarStats(rows).parts).toEqual([
			{ text: "2 人工作中", tone: "live" },
			{ text: "1 人已中断", tone: "warn" },
		]);
	});

	it("等待超时只报最久的那个（不随数据顺序漂）", () => {
		const rows = teamBarRows(
			[
				member({ agent: "a", waitingSince: T0 - 6 * 60_000 }),
				member({ agent: "b", waitingSince: T0 - 40 * 60_000 }),
			],
			undefined,
			T0,
		);
		const waitingParts = teamBarStats(rows).parts.filter((part) => part.text.startsWith("已等"));
		expect(waitingParts).toEqual([{ text: "已等 40 分钟", tone: "warn" }]);
	});

	it("有产出可读**不进**簇 —— 跑完有产出是常态，琥珀只留给真要动手的状态", () => {
		const rows = teamBarRows(
			[member({ agent: "a", status: "done", outputAvailable: true })],
			undefined,
			T0,
		);
		expect(teamBarStats(rows).parts).toEqual([]);
	});
});

describe("列行表的状态词（statusShort）", () => {
	it("五态各有一个行内短词（长句留给 statusText 给 title / 读屏）", () => {
		const rows = teamBarRows(
			[
				member({ agent: "a", status: "queued" }),
				member({ agent: "b", status: "running" }),
				member({ agent: "c", status: "done" }),
				member({ agent: "d", status: "failed" }),
				member({ agent: "e", status: "interrupted" }),
			],
			undefined,
		);
		expect(rows.map((row) => row.statusShort)).toEqual(["启动中", "运行中", "已完成", "失败", "已中断"]);
	});

	it("短词是行内一个词；带行动指引的长句只留给 title / 读屏", () => {
		// 有产出可读时 statusText 会追加「产出还在…可去取回」——那类句子进不了行内。
		const rows = teamBarRows([member({ agent: "a", status: "done", outputAvailable: true })], undefined);
		expect(rows[0]?.statusShort).toBe("已完成");
		expect(rows[0]?.mark).toBe("✓");
		expect(rows[0]?.statusText).toContain("产出还在");
		expect(rows[0]?.statusText).not.toBe(rows[0]?.statusShort);
	});

	it("计数在列行里始终可用（不再按状态门控 —— 空间问题由折叠解决，不靠削信息）", () => {
		for (const status of ["running", "done", "interrupted", "failed"] as const) {
			const rows = teamBarRows([member({ agent: "a", status, turns: 26, toolCalls: 73 })], undefined);
			expect(rows[0]?.count).toBe("26 轮 · 73 工具");
		}
	});
});
