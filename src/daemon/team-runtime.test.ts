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

describe("中断恢复（spec: add-team-interrupt-diagnostics 批次 ①）", () => {
	function stored(status: string, turns = 1) {
		return {
			name: "谭溯源",
			agentName: "topic-researcher",
			task: "初调",
			sessionId: "dead-session",
			status,
			turns,
			toolCalls: 77,
			tokens: 1324249,
			cost: 0.027,
		};
	}

	it("落盘时 running → 恢复为 interrupted（不是 closed）", () => {
		const registry = new TeamRegistry();
		registry.restoreTeam(LEADER, "队", [stored("running")]);
		const member = registry.requireMember(LEADER, "谭溯源");
		expect(member.status).toBe("interrupted");
		// 提示要说清「中断了、产出得去会话记录里找」—— 这是用户的行动指引。
		// 拉模式下措辞不再提「回投」（那套已删），改为「读不到完整产出」。
		expect(member.lastActivity).toContain("中断");
		expect(member.lastActivity).toContain("会话记录");
	});

	it("spawning / closing 同样是中断候选（手里有活）", () => {
		for (const status of ["spawning", "closing"]) {
			const registry = new TeamRegistry();
			registry.restoreTeam(LEADER, "队", [stored(status)]);
			expect(registry.requireMember(LEADER, "谭溯源").status).toBe("interrupted");
		}
	});

	it("idle / closed / failed 恢复为 closed（上次已是终态，没丢未回投的产出）", () => {
		for (const status of ["idle", "closed", "failed"]) {
			const registry = new TeamRegistry();
			registry.restoreTeam(LEADER, "队", [stored(status)]);
			const member = registry.requireMember(LEADER, "谭溯源");
			expect(member.status).toBe("closed");
			expect(member.lastActivity).toBe("进程重启后成员需重建");
		}
	});

	it("落盘 status 缺失或认不出 → 按非中断处理（不凭空报「活丢了」）", () => {
		const registry = new TeamRegistry();
		registry.restoreTeam(LEADER, "队", [{ ...stored("running"), status: undefined }]);
		expect(registry.requireMember(LEADER, "谭溯源").status).toBe("closed");
	});

	it("恢复的计数与轮数原样保留（诊断时要知道它跑到哪了）", () => {
		const registry = new TeamRegistry();
		registry.restoreTeam(LEADER, "队", [stored("running", 3)]);
		const member = registry.requireMember(LEADER, "谭溯源");
		expect(member).toMatchObject({ turns: 3, toolCalls: 77, tokens: 1324249 });
	});

	it("恢复时保留落盘的 sessionId —— 拉模式读产出只认会话文件，不认宿主（2026-09-19 回归）", () => {
		const registry = new TeamRegistry();
		registry.restoreTeam(LEADER, "队", [
			{ ...stored("idle"), sessionId: "01a0b7eb-616a-76ef-8015-bbbcf29d840a" },
		]);
		// 丢了它，重启后 getTeamState 的 outputAvailable 与 team_read 就都读不到东西，
		// 而 team_send 的拒绝文案仍在承诺「产出可用 team_read 取回」。
		expect(registry.requireMember(LEADER, "谭溯源").sessionId).toBe(
			"01a0b7eb-616a-76ef-8015-bbbcf29d840a",
		);
		// 但发消息那侧照样拒绝（宿主确实没了）—— 恢复 id 不等于恢复会话。
		expect(() => registry.resolveMemberSessions(LEADER, ["谭溯源"])).toThrow(/已关闭/);
	});

	it("interrupted 成员不再接收消息（宿主已随进程消失）", () => {
		const registry = new TeamRegistry();
		registry.restoreTeam(LEADER, "队", [stored("running")]);
		// 这条落盘快照不带 sessionId（旧文件就是如此）→ 会先撞「还在启动中」；
		// 手动补一个会话 id 走到 interrupted 分支。
		const member = registry.requireMember(LEADER, "谭溯源");
		member.sessionId = "sid";
		expect(() => registry.resolveMemberSessions(LEADER, ["谭溯源"])).toThrow(/进程中断/);
	});
});

describe("等待计时（spec: add-team-interrupt-diagnostics 批次 ②）", () => {
	const T0 = 1_700_000_000_000;

	it("spawn ack 起算等待；idle 清零", () => {
		const registry = registryWithTeam();
		registry.markSpawned(LEADER, "scout-a", "s1");
		const member = registry.requireMember(LEADER, "scout-a");
		expect(member.waitingSince).toBeGreaterThan(0);

		registry.markStatus(LEADER, "scout-a", "idle");
		expect(member.waitingSince).toBe(0);
	});

	it("翻回 running 会刷新起点（新的一轮派活，上次等待作废）", () => {
		const registry = registryWithTeam();
		registry.markSpawned(LEADER, "scout-a", "s1");
		registry.markStatus(LEADER, "scout-a", "running", "", T0);
		expect(registry.requireMember(LEADER, "scout-a").waitingSince).toBe(T0);
		registry.markStatus(LEADER, "scout-a", "running", "", T0 + 60_000);
		expect(registry.requireMember(LEADER, "scout-a").waitingSince).toBe(T0 + 60_000);
	});

	it("closing / spawning 不动等待起点（closing 仍是「在等它交报告」）", () => {
		const registry = registryWithTeam();
		registry.markSpawned(LEADER, "scout-a", "s1");
		const before = registry.requireMember(LEADER, "scout-a").waitingSince;
		registry.markStatus(LEADER, "scout-a", "closing", "已请求收尾");
		expect(registry.requireMember(LEADER, "scout-a").waitingSince).toBe(before);
	});

	it("failed / interrupted / closed 都清零（不用再等了）", () => {
		for (const status of ["failed", "interrupted", "closed"] as const) {
			const registry = registryWithTeam();
			registry.markSpawned(LEADER, "scout-a", "s1");
			registry.markStatus(LEADER, "scout-a", status);
			expect(registry.requireMember(LEADER, "scout-a").waitingSince).toBe(0);
		}
	});

	it("恢复的成员不在等待中（宿主都没了，等也没意义）", () => {
		const registry = new TeamRegistry();
		registry.restoreTeam(LEADER, "队", [
			{ name: "m", agentName: "scout", task: "t", status: "running", turns: 1, toolCalls: 0, tokens: 0, cost: 0 },
		]);
		expect(registry.requireMember(LEADER, "m").waitingSince).toBe(0);
	});
});

/*
 * 旧的两组（「待回投产出」批次 ③ / 「送达确认」批次 ③.3）在拉模式改造里**整体删除**
 * （spec: add-team-pull-model 批次 ④）—— 它们断言的是推模式的留痕与销账协议，
 * 而那条协议连同它的失败面（入队即 resolve、进程死在投递中、标记被过早擦掉）
 * 一起被删掉了。留在这里的东西换成两组新的：
 *   ① 「旧落盘文件仍能读」—— 升级兼容，别让老用户打开旧团队就炸；
 *   ② 「拉模式语义」—— 状态与「有没有产出」解耦、文案指向 team_read。
 */
describe("旧落盘文件的升级兼容（spec: add-team-pull-model 批次 ④）", () => {
	/** 升级前写下的成员快照：带着已被删除的 pendingDelivery 字段。 */
	function legacyStoredMember() {
		return {
			name: "谭溯源",
			agentName: "topic-researcher",
			task: "初调",
			status: "running",
			turns: 2,
			toolCalls: 56,
			tokens: 100,
			cost: 0.01,
			// 这两个键在类型上已不存在 —— 用 any 绕过去模拟真实的旧文件内容。
			pendingDelivery: true,
			pendingDeliveryTurns: 2,
		} as never;
	}

	it("旧文件带 pendingDelivery → 忽略该键、不抛错（升级不能炸在启动路径上）", () => {
		const registry = new TeamRegistry();
		expect(() => {
			registry.restoreTeam(LEADER, "队", [legacyStoredMember()]);
		}).not.toThrow();
		// 旧标记没了，但成员本身照常恢复（派生不出 → 落盘 running → interrupted）。
		const member = registry.requireMember(LEADER, "谭溯源");
		expect(member.status).toBe("interrupted");
		expect(member.turns).toBe(2);
	});

	it("恢复了成员但派生不出产出 → 文案只讲中断，不再提「产出待捞」", () => {
		const registry = new TeamRegistry();
		registry.restoreTeam(LEADER, "队", [legacyStoredMember()]);
		const member = registry.requireMember(LEADER, "谭溯源");
		expect(member.lastActivity).toContain("中断");
		// 「产出在会话记录里」这类推模式承诺不该再凭空出现。
		expect(member.lastActivity).not.toContain("产出在它的会话记录里");
	});
});

describe("拉模式语义（spec: add-team-pull-model 批次 ④）", () => {
	it("中断成员被喊话 → 报错指向 team_read（不再说「产出待捞」）", () => {
		const registry = new TeamRegistry();
		registry.restoreTeam(LEADER, "队", [
			{ name: "谭溯源", agentName: "topic-researcher", task: "初调", status: "running", turns: 2, toolCalls: 0, tokens: 0, cost: 0 },
		]);
		// 补一个会话 id 让它走到 interrupted 分支（恢复时不带 sessionId）。
		registry.requireMember(LEADER, "谭溯源").sessionId = "dead";
		expect(() => registry.resolveMemberSessions(LEADER, ["谭溯源"])).toThrow(/没有跑完/);
		// 拉模式的关键差别：告诉领导「用 team_read 取回」，而不是含糊的「去文件里找」。
		expect(() => registry.resolveMemberSessions(LEADER, ["谭溯源"])).toThrow(/team_read/);
	});

	it("已关闭成员被喊话 → 报错也说「产出可用 team_read 取回」", () => {
		const registry = registryWithTeam();
		// 得先有会话 id，否则先撞上「还在启动中」那条更早的守卫。
		registry.markSpawned(LEADER, "scout-a", "sid-a");
		registry.markStatus(LEADER, "scout-a", "closed");
		expect(() => registry.resolveMemberSessions(LEADER, ["scout-a"])).toThrow(/已关闭/);
		expect(() => registry.resolveMemberSessions(LEADER, ["scout-a"])).toThrow(/team_read/);
	});

	it("成员对象上不再有 pendingDelivery 字段（推模式遗物已清干净）", () => {
		const member = registryWithTeam().requireMember(LEADER, "scout-a") as unknown as Record<string, unknown>;
		expect("pendingDelivery" in member).toBe(false);
		expect("pendingDeliveryTurns" in member).toBe(false);
	});
});

describe("recordCompletion（批次 ③.4：轮数权威回填）", () => {
	it("直接赋值而不是累加（它是绝对值）", () => {
		const registry = registryWithTeam();
		registry.recordCompletion(LEADER, "scout-a", 3, "已完成 3 轮");
		expect(registry.requireMember(LEADER, "scout-a").turns).toBe(3);
		// 重复回调不该把数字顶飞 —— 这正是「recordProgress 累加」做不到的。
		registry.recordCompletion(LEADER, "scout-a", 3, "已完成 3 轮");
		expect(registry.requireMember(LEADER, "scout-a").turns).toBe(3);
	});

	it("同时写动作行", () => {
		const registry = registryWithTeam();
		registry.recordCompletion(LEADER, "scout-a", 2, "已完成 2 轮");
		expect(registry.requireMember(LEADER, "scout-a").lastActivity).toBe("已完成 2 轮");
	});

	it("事件增量累加与收尾绝对值收敛到同一个数（两个来源口径必须一致）", () => {
		// 2026-09-19 实测反例：长 run 期间 team_status 显示「已完成 0 轮」，
		// 而同一条的「最近」写着「已完成 57 轮」—— 因为 turns 只由收尾赋值。
		// 现在成员执行器按 assistant_done 逐轮 +1（见 MemberHooks.onProgress 第三参），
		// 收尾再用绝对值对齐；两者口径相同，所以不会顶飞也不会跳变。
		const registry = registryWithTeam();
		for (let round = 1; round <= 53; round += 1) {
			registry.recordProgress(LEADER, "scout-a", 1, `已完成 ${round} 轮`);
			expect(registry.requireMember(LEADER, "scout-a").turns).toBe(round);
		}
		// 收尾前（run 仍在跑）就该是真值：这正是修复的目的。
		expect(registry.requireMember(LEADER, "scout-a").turns).toBe(53);
		registry.recordCompletion(LEADER, "scout-a", 53, "已完成 53 轮");
		expect(registry.requireMember(LEADER, "scout-a").turns).toBe(53);
	});
});

describe("派生优先恢复（spec: add-team-pull-model 批次 ②）", () => {
	/** 造一条落盘成员（默认落盘说 running，即「杀进程时它在跑」）。 */
	function storedRunning() {
		return {
			name: "谭溯源",
			agentName: "topic-researcher",
			task: "初调",
			sessionId: "sid-dead",
			status: "running",
			turns: 1,
			toolCalls: 77,
			tokens: 1324249,
			cost: 0.027,
		};
	}

	it("派生出 completed → 落盘说 running 也要恢复成 closed（文件事实压过运行态）", () => {
		const registry = new TeamRegistry();
		registry.restoreTeam(LEADER, "队", [storedRunning()], () => "completed");
		const member = registry.requireMember(LEADER, "谭溯源");
		// 这是拉模式最关键的一条：成员其实跑完了，落盘来不及翻 idle 就死了。
		// 只看落盘会误判成 interrupted（用户以为要重跑），读文件才有确切答案。
		expect(member.status).toBe("closed");
		expect(member.lastActivity).toContain("会话记录");
	});

	it("派生出 killed → interrupted", () => {
		const registry = new TeamRegistry();
		registry.restoreTeam(LEADER, "队", [storedRunning()], () => "killed");
		expect(registry.requireMember(LEADER, "谭溯源").status).toBe("interrupted");
	});

	it("派生出 failed → failed", () => {
		const registry = new TeamRegistry();
		registry.restoreTeam(LEADER, "队", [storedRunning()], () => "failed");
		expect(registry.requireMember(LEADER, "谭溯源").status).toBe("failed");
	});

	it("派生不出（undefined）→ 回落落盘判据：running 算 interrupted", () => {
		const registry = new TeamRegistry();
		registry.restoreTeam(LEADER, "队", [storedRunning()], () => undefined);
		expect(registry.requireMember(LEADER, "谭溯源").status).toBe("interrupted");
	});

	it("派生不出 + 落盘是终态 → closed", () => {
		const registry = new TeamRegistry();
		registry.restoreTeam(
			LEADER,
			"队",
			[{ ...storedRunning(), status: "idle" }],
			() => undefined,
		);
		expect(registry.requireMember(LEADER, "谭溯源").status).toBe("closed");
	});

	it("没有 sessionId → 根本不调派生器（无从读起）", () => {
		const registry = new TeamRegistry();
		let called = 0;
		registry.restoreTeam(
			LEADER,
			"队",
			[{ ...storedRunning(), sessionId: undefined }],
			() => {
				called += 1;
				return "completed";
			},
		);
		expect(called).toBe(0);
		expect(registry.requireMember(LEADER, "谭溯源").status).toBe("interrupted");
	});

	it("派生器抛错时当作派生不出（读文件失败不该炸掉启动）", () => {
		const registry = new TeamRegistry();
		registry.restoreTeam(LEADER, "队", [storedRunning()], () => {
			throw new Error("EACCES");
		});
		expect(registry.requireMember(LEADER, "谭溯源").status).toBe("interrupted");
	});
});

describe("settleRunningMembers（spec: add-team-pull-model 批次 ②，对齐 settleAllRunning）", () => {
	it("父 terminated → running 成员收敛为 interrupted", () => {
		const registry = registryWithTeam();
		registry.markSpawned(LEADER, "scout-a", "sid-a");
		expect(registry.settleRunningMembers(LEADER, "terminated")).toEqual(["scout-a"]);
		const member = registry.requireMember(LEADER, "scout-a");
		expect(member.status).toBe("interrupted");
		expect(member.waitingSince).toBe(0);
	});

	it("父 error / failed → running 成员收敛为 failed", () => {
		for (const reason of ["error", "failed"] as const) {
			const registry = registryWithTeam();
			registry.markSpawned(LEADER, "scout-a", "sid-a");
			expect(registry.settleRunningMembers(LEADER, reason)).toEqual(["scout-a"]);
			expect(registry.requireMember(LEADER, "scout-a").status).toBe("failed");
		}
	});

	it("**只动 running**：已终态成员有自己的证据链，不被父状态覆盖", () => {
		const registry = registryWithTeam();
		registry.markSpawned(LEADER, "scout-a", "sid-a");
		registry.markStatus(LEADER, "scout-a", "failed", "自己炸了");
		// 父 terminated 不该把一个「自己失败」的成员改写成 interrupted。
		expect(registry.settleRunningMembers(LEADER, "terminated")).toEqual([]);
		expect(registry.requireMember(LEADER, "scout-a").status).toBe("failed");
	});

	it("已完成（closed）成员不受影响", () => {
		const registry = registryWithTeam();
		registry.markSpawned(LEADER, "scout-a", "sid-a");
		registry.markStatus(LEADER, "scout-a", "closed", "干完了");
		expect(registry.settleRunningMembers(LEADER, "terminated")).toEqual([]);
		expect(registry.requireMember(LEADER, "scout-a").status).toBe("closed");
	});

	it("没有团队 → 空操作，不抛", () => {
		const registry = new TeamRegistry();
		expect(registry.settleRunningMembers("no-such-leader", "terminated")).toEqual([]);
	});

	it("只收敛 running 的那些，混态里逐个判", () => {
		const registry = registryWithTeam();
		registry.markSpawned(LEADER, "scout-a", "sid-a");
		registry.markSpawned(LEADER, "worker-b", "sid-b");
		registry.markStatus(LEADER, "worker-b", "closed", "先交活了");
		expect(registry.settleRunningMembers(LEADER, "terminated")).toEqual(["scout-a"]);
	});
});
