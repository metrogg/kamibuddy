/**
 * 团队注册表纯逻辑测试（spec: add-team-foundations 批 5）。
 */

import { describe, expect, it } from "vitest";
import { TeamRegistry } from "./team-runtime.ts";

const LEADER = "leader-1";
const MEMBERS = [
	{ name: "scout-a", agentName: "scout", task: "调研 A" },
	{ name: "worker-b", agentName: "worker", task: "实现 B" },
];

function registryWithTeam() {
	const registry = new TeamRegistry();
	registry.createTeam(LEADER, "攻坚队", MEMBERS);
	return registry;
}

describe("createTeam", () => {
	it("建团成功：成员 spawning 起步、sessionId 未定", () => {
		const team = registryWithTeam().getTeam(LEADER);
		expect(team?.name).toBe("攻坚队");
		expect(team?.members.get("scout-a")?.status).toBe("spawning");
		expect(team?.members.get("scout-a")?.sessionId).toBeUndefined();
	});

	it("单会话单团队：重复建团报错并报告现有团队名", () => {
		const registry = registryWithTeam();
		expect(() => registry.createTeam(LEADER, "第二队", MEMBERS)).toThrow(/已存在团队「攻坚队」/);
	});

	it("成员名重复 → 报错（@寻址的唯一键）", () => {
		const registry = new TeamRegistry();
		const first = { name: "scout-a", agentName: "scout", task: "x" };
		expect(() => registry.createTeam(LEADER, "队", [first, { ...first }])).toThrow(
			/成员名「scout-a」重复/,
		);
	});

	it("0 人 / 超 8 人 → 报错", () => {
		const registry = new TeamRegistry();
		expect(() => registry.createTeam(LEADER, "队", [])).toThrow(/至少需要一名成员/);
		const nine = Array.from({ length: 9 }, (_, i) => ({ name: `m${i}`, agentName: "scout", task: "t" }));
		expect(() => registry.createTeam(LEADER, "队", nine)).toThrow(/最多 8 名/);
	});

	it("空团队名 / 空成员名 / 空 agent 名 / 空任务 → 报错", () => {
		const registry = new TeamRegistry();
		expect(() => registry.createTeam(LEADER, "", MEMBERS)).toThrow(/团队名/);
		expect(() => registry.createTeam(LEADER, "队", [{ name: "", agentName: "scout", task: "t" }])).toThrow(/成员名/);
		expect(() => registry.createTeam(LEADER, "队", [{ name: "m", agentName: "", task: "t" }])).toThrow(/agent 名/);
		expect(() => registry.createTeam(LEADER, "队", [{ name: "m", agentName: "scout", task: "" }])).toThrow(/初始任务/);
	});
});

describe("spawn ack 与状态机", () => {
	it("markSpawned：sessionId 回填 + running + 反向索引生效", () => {
		const registry = registryWithTeam();
		registry.markSpawned(LEADER, "scout-a", "member-session-1");
		const member = registry.getTeam(LEADER)?.members.get("scout-a");
		expect(member?.status).toBe("running");
		expect(member?.sessionId).toBe("member-session-1");
		expect(registry.getTeamByMemberSession("member-session-1")?.name).toBe("攻坚队");
	});

	it("重复 spawn ack → 报错（一个成员一个会话）", () => {
		const registry = registryWithTeam();
		registry.markSpawned(LEADER, "scout-a", "s1");
		expect(() => registry.markSpawned(LEADER, "scout-a", "s2")).toThrow(/spawn ack 重复/);
	});

	it("markStatus / recordProgress 回填轮数与动作", () => {
		const registry = registryWithTeam();
		registry.markSpawned(LEADER, "worker-b", "s2");
		registry.recordProgress(LEADER, "worker-b", 1, "正在 read a.ts");
		registry.recordProgress(LEADER, "worker-b", 2, "");
		registry.markStatus(LEADER, "worker-b", "idle");
		const member = registry.getTeam(LEADER)?.members.get("worker-b");
		expect(member?.turns).toBe(3);
		expect(member?.status).toBe("idle");
		expect(member?.lastActivity).toBe("正在 read a.ts");
	});

	it("未知团队/成员 → 响亮抛错（带可读指引）", () => {
		const registry = registryWithTeam();
		expect(() => registry.markSpawned("ghost-leader", "scout-a", "s")).toThrow(/没有团队/);
		expect(() => registry.markSpawned(LEADER, "ghost", "s")).toThrow(/没有成员「ghost」/);
		expect(() => registry.recordProgress("ghost-leader", "x", 1, "")).toThrow(/没有团队/);
	});
});

describe("resolveMemberSessions 与解散", () => {
	it("按成员名解析会话 id；spawning 中 → 报错；未知 → 报错", () => {
		const registry = registryWithTeam();
		registry.markSpawned(LEADER, "scout-a", "s1");
		expect(registry.resolveMemberSessions(LEADER, ["scout-a"])).toEqual(["s1"]);
		expect(() => registry.resolveMemberSessions(LEADER, ["worker-b"])).toThrow(/还在启动中/);
		expect(() => registry.resolveMemberSessions(LEADER, ["ghost"])).toThrow(/没有成员「ghost」/);
	});

	it("disband：整队清除（团队 + 全部反向索引），返回成员名清单", () => {
		const registry = registryWithTeam();
		registry.markSpawned(LEADER, "scout-a", "s1");
		registry.markSpawned(LEADER, "worker-b", "s2");
		expect(registry.disband(LEADER)).toEqual(["scout-a", "worker-b"]);
		expect(registry.getTeam(LEADER)).toBeUndefined();
		expect(registry.getTeamByMemberSession("s1")).toBeUndefined();
		// 解散后可再建（单团队约束只针对存续中的团队）
		expect(() => registry.createTeam(LEADER, "新队", MEMBERS)).not.toThrow();
	});

	it("解散不存在的团队 → 空数组 no-op", () => {
		expect(new TeamRegistry().disband(LEADER)).toEqual([]);
	});
});

describe("已关闭成员不再接收消息（spec: add-team-collaboration-parity 批次 ②）", () => {
	it("resolveMemberSessions 对 closed 成员响亮拒绝（它的宿主已 dispose）", () => {
		const registry = registryWithTeam();
		registry.markSpawned(LEADER, "scout-a", "sid-a");
		registry.markStatus(LEADER, "scout-a", "closed", "已收尾");

		expect(() => registry.resolveMemberSessions(LEADER, ["scout-a"])).toThrow(/已关闭、不再接收消息/);
	});

	it("closing 期间仍可收消息（允许追加一句「就收到这里」）", () => {
		const registry = registryWithTeam();
		registry.markSpawned(LEADER, "scout-a", "sid-a");
		registry.markStatus(LEADER, "scout-a", "closing", "已请求收尾");

		expect(registry.resolveMemberSessions(LEADER, ["scout-a"])).toEqual(["sid-a"]);
	});
});

describe("计划裁决（spec: add-team-collaboration-parity 批次 ④）", () => {
	it("等候审 / 批准 / 驳回三值都记进成员状态", () => {
		const registry = registryWithTeam();
		registry.markSpawned(LEADER, "scout-a", "sid-a");
		expect(registry.requireMember(LEADER, "scout-a").planStatus).toBe("none");
		registry.reviewPlan(LEADER, "scout-a", "awaiting");
		expect(registry.requireMember(LEADER, "scout-a").planStatus).toBe("awaiting");
		registry.reviewPlan(LEADER, "scout-a", "reject", "缺来源");
		expect(registry.requireMember(LEADER, "scout-a")).toMatchObject({ planStatus: "rejected", planFeedback: "缺来源" });
		registry.reviewPlan(LEADER, "scout-a", "approve");
		expect(registry.requireMember(LEADER, "scout-a").planStatus).toBe("approved");
	});

	it("驳回必须给反馈（没有反馈的驳回等于让成员重猜）", () => {
		const registry = registryWithTeam();
		registry.markSpawned(LEADER, "scout-a", "sid-a");
		expect(() => registry.reviewPlan(LEADER, "scout-a", "reject")).toThrow(/必须给 feedback/);
		expect(() => registry.reviewPlan(LEADER, "scout-a", "reject", "   ")).toThrow(/必须给 feedback/);
	});


	it("未知成员 → 抛错", () => {
		const registry = registryWithTeam();
		expect(() => registry.reviewPlan(LEADER, "ghost", "approve")).toThrow(/没有成员「ghost」/);
	});
});
