/**
 * team 工具四件套测试（spec: add-team-foundations 批 5）。
 * 执行本体在 daemon（注入 deps），这里钉编排与回传契约：
 * 开关门、team_create 的投影与预算路径、team_send 的寻址转述、状态/解散。
 */

import { describe, expect, it } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CHILD_AGENTS_DETAILS_KEY } from "../shared/child-agents.ts";
import { teamExtensionFactory, type TeamStartPlan, type TeamToolDeps } from "./team-tools.ts";

interface FakeDetails {
	readonly teamName: string;
	readonly [CHILD_AGENTS_DETAILS_KEY]: readonly unknown[];
}

interface FakeToolResult {
	readonly content: ReadonlyArray<{ type: "text"; text: string }>;
	readonly details: FakeDetails;
}

interface FakeToolDef {
	readonly name: string;
	execute: (
		toolCallId: string,
		params: Record<string, unknown>,
		signal?: AbortSignal,
		onUpdate?: (partial: unknown) => void,
	) => Promise<FakeToolResult>;
}

/** 装好扩展，按名取工具。 */
function mount(deps: Partial<TeamToolDeps> = {}): {
	tools: Map<string, FakeToolDef>;
	deps: TeamToolDeps;
} {
	const tools = new Map<string, FakeToolDef>();
	const fakePi = {
		registerTool: (def: { name: string }) => {
			tools.set(def.name, def as unknown as FakeToolDef);
		},
	} as unknown as ExtensionAPI;
	const fullDeps: TeamToolDeps = {
		isEnabled: () => true,
		listAgents: () => [{ name: "scout", description: "侦察", tools: ["read"], model: undefined, body: "b" }],
		startTeam: async (plan) => plan.members.map((m) => ({ name: m.name, sessionId: `sid-${m.name}` })),
		sendToMembers: async (to) => (to === "@all" ? ["a", "b"] : [to]),
		getTeamState: () => ({
			name: "攻坚队",
			members: [{ name: "a", agentName: "scout", status: "running", turns: 2, lastActivity: "正在 read x" }],
		}),
		shutdownMember: async (to) => `已向成员「${to}」发出收尾请求`,
		setDelegateMode: async (enabled) => (enabled ? "已开启委派模式" : "已关闭委派模式"),
		reviewPlan: async () => "已记录计划裁决",
		closeTeam: async () => {},
		...deps,
	};
	teamExtensionFactory(fullDeps)(fakePi);
	return { tools, deps: fullDeps };
}

describe("开关门（agentTeamsEnabled）", () => {
	it("isEnabled=false → 一个工具都不注册（白名单名对 pi 静默忽略）", () => {
		const { tools } = mount({ isEnabled: () => false });
		expect(tools.size).toBe(0);
	});

	it("isEnabled=true → 七件套齐", () => {
		const { tools } = mount();
		expect([...tools.keys()].sort()).toEqual([
			"team_create",
			"team_delegate_mode",
			"team_delete",
			"team_plan_review",
			"team_send",
			"team_shutdown",
			"team_status",
		]);
	});
});

describe("team_plan_review（批次 ④ 计划裁决）", () => {
	it("approve / reject 的裁决与反馈原样转给实现层", async () => {
		const calls: { member: string; decision: string; feedback: string | undefined }[] = [];
		const { tools } = mount({
			reviewPlan: async (member, decision, feedback) => {
				calls.push({ member, decision, feedback });
				return decision === "approve" ? "已批准并通知开工" : "已驳回，反馈已发";
			},
		});
		const approved = await tools.get("team_plan_review")!.execute("t1", { member: "a", decision: "approve" });
		expect(approved.content[0]?.text).toContain("已批准");
		const rejected = await tools.get("team_plan_review")!.execute("t1", {
			member: "a",
			decision: "reject",
			feedback: "来源不足，先补到 5 个",
		});
		expect(rejected.content[0]?.text).toContain("已驳回");
		expect(calls).toEqual([
			{ member: "a", decision: "approve", feedback: undefined },
			{ member: "a", decision: "reject", feedback: "来源不足，先补到 5 个" },
		]);
	});

	it("驳回缺反馈的报错原样透传（注册表层拦下）", async () => {
		const { tools } = mount({
			reviewPlan: async () => {
				throw new Error("驳回计划必须给 feedback —— 否则成员只能重猜，等于白跑一轮");
			},
		});
		await expect(tools.get("team_plan_review")!.execute("t1", { member: "a", decision: "reject" })).rejects.toThrow(
			/必须给 feedback/,
		);
	});
});

describe("team_delegate_mode（批次 ③ 委派模式）", () => {
	it("开启 → 回执说明「从下一轮起只协调」", async () => {
		const calls: boolean[] = [];
		const { tools } = mount({
			setDelegateMode: async (enabled) => {
				calls.push(enabled);
				return enabled ? "已开启委派模式：从下一轮起你只能协调" : "已关闭委派模式";
			},
		});
		const on = await tools.get("team_delegate_mode")!.execute("t1", { enabled: true, reason: "这次只编排" });
		expect(calls).toEqual([true]);
		expect(on.content[0]?.text).toContain("只能协调");
		const off = await tools.get("team_delegate_mode")!.execute("t1", { enabled: false });
		expect(calls).toEqual([true, false]);
		expect(off.content[0]?.text).toContain("已关闭");
	});
});

describe("team_shutdown（批次 ② 单成员优雅关闭）", () => {
	it("默认路径是发收尾请求，回执说明成员会交回报告后关闭", async () => {
		const calls: { to: string; reason: string | undefined; force: boolean }[] = [];
		const { tools } = mount({
			shutdownMember: async (to, reason, force) => {
				calls.push({ to, reason, force });
				return `已向成员「${to}」发出收尾请求`;
			},
		});
		const result = await tools.get("team_shutdown")!.execute("t1", { to: "a", reason: "这维度够用了" });
		expect(calls).toEqual([{ to: "a", reason: "这维度够用了", force: false }]);
		expect(result.content[0]?.text).toContain("已向成员「a」发出收尾请求");
	});

	it("force=true 透传到实现层（走中止而不是收尾请求）", async () => {
		const calls: boolean[] = [];
		const { tools } = mount({
			shutdownMember: async (_to, _reason, force) => {
				calls.push(force);
				return "已强制关闭";
			},
		});
		await tools.get("team_shutdown")!.execute("t1", { to: "a", force: true });
		expect(calls).toEqual([true]);
	});

	it("@all 的拒绝原样透传（整队要走 team_delete）", async () => {
		const { tools } = mount({
			shutdownMember: async () => {
				throw new Error('team_shutdown 一次只关一个成员；整队中止请用 team_delete');
			},
		});
		await expect(tools.get("team_shutdown")!.execute("t1", { to: "@all" })).rejects.toThrow(/整队中止请用 team_delete/);
	});
});

describe("team_create", () => {
	it("建团返回 ack 摘要；details 带 kind:team 投影（批 4 通道）", async () => {
		const { tools } = mount();
		const result = await tools.get("team_create")!.execute("t1", {
			name: "攻坚队",
			members: [
				{ name: "scout-a", agent: "scout", task: "调研" },
				{ name: "worker-b", agent: "scout", task: "执行" },
			],
		});
		expect(result.content[0]?.text).toContain("攻坚队");
		expect(result.content[0]?.text).toContain("scout-a、worker-b");
		const members = result.details[CHILD_AGENTS_DETAILS_KEY];
		expect(members).toHaveLength(2);
		for (const entry of members) {
			expect((entry as { kind?: string }).kind).toBe("team");
			expect((entry as { status?: string }).status).toBe("running");
		}
	});

	it("部分结果流经 onUpdate：初始化骨架（queued）先于终态", async () => {
		const partials: FakeDetails[] = [];
		const { tools } = mount({
			startTeam: async (plan, hooks) => {
				hooks.onProgress("a", "正在 read x");
				return plan.members.map((m) => ({ name: m.name, sessionId: `sid-${m.name}` }));
			},
		});
		await tools.get("team_create")!.execute(
			"t1",
			{ name: "队", members: [{ name: "a", agent: "scout", task: "t" }] },
			undefined,
			(partial) => partials.push((partial as { details: FakeDetails }).details),
		);
		expect(partials.length).toBeGreaterThanOrEqual(2);
		expect((partials[0]?.[CHILD_AGENTS_DETAILS_KEY][0] as { status?: string }).status).toBe("queued");
		expect((partials.at(-1)?.[CHILD_AGENTS_DETAILS_KEY][0] as { status?: string }).status).toBe("running");
	});

	it("spawn 中失败 → 该成员投影 failed 且带诊断；成功成员不受影响", async () => {
		const { tools } = mount({
			startTeam: async (plan, hooks) => {
				hooks.onFailed("b", "配额不足");
				return plan.members
					.filter((m) => m.name !== "b")
					.map((m) => ({ name: m.name, sessionId: `sid-${m.name}` }));
			},
		});
		const result = await tools.get("team_create")!.execute("t1", {
			name: "队",
			members: [
				{ name: "a", agent: "scout", task: "t" },
				{ name: "b", agent: "scout", task: "t" },
			],
		});
		const members = result.details[CHILD_AGENTS_DETAILS_KEY];
		const failed = members.find((m) => (m as { agent: string }).agent === "b") as { status?: string; output?: string };
		expect(failed.status).toBe("failed");
		expect(failed.output).toContain("配额不足");
	});

	it("startTeam 抛错（如单团队约束/预算）→ 工具异常上抛，由 pi 记错误卡", async () => {
		const { tools } = mount({
			startTeam: async () => {
				throw new Error("本会话已存在团队「旧队」");
			},
		});
		await expect(
			tools.get("team_create")!.execute("t1", { name: "队", members: [{ name: "a", agent: "scout", task: "t" }] }),
		).rejects.toThrow("已存在团队");
	});
});

describe("team_send / team_status / team_delete", () => {
	it("team_send 转述投递对象清单", async () => {
		const { tools } = mount();
		const result = await tools.get("team_send")!.execute("t1", { to: "@all", text: "汇总进度" });
		expect(result.content[0]?.text).toContain("已投递给：a、b");
	});

	it("team_status 无团队 → 指引建团；有团队 → 逐成员状态行", async () => {
		const none = await mount({ getTeamState: () => undefined }).tools.get("team_status")!.execute("t1", {});
		expect(none.content[0]?.text).toContain("没有团队");

		const withTeam = mount({
			getTeamState: () => ({
				name: "攻坚队",
				members: [{ name: "a", agentName: "scout", status: "running", turns: 2, lastActivity: "正在 read x" }],
			}),
		});
		const result = await withTeam.tools.get("team_status")!.execute("t1", {});
		expect(result.content[0]?.text).toContain("团队「攻坚队」");
		expect(result.content[0]?.text).toContain("a（scout）：running，已完成 2 轮");
	});

	it("team_delete 调 closeTeam 并回执", async () => {
		let closed = false;
		const { tools } = mount({ closeTeam: async () => { closed = true; } });
		const result = await tools.get("team_delete")!.execute("t1", {});
		expect(closed).toBe(true);
		expect(result.content[0]?.text).toContain("已解散");
	});
});

describe("成员级模型（spec: add-team-collaboration-parity 批次 ⑥）", () => {
	it("members[].model 原样透传给 startTeam（缺省不带该键）", async () => {
		const plans: TeamStartPlan[] = [];
		const { tools } = mount({
			startTeam: async (plan) => {
				plans.push(plan);
				return plan.members.map((m) => ({ name: m.name, sessionId: `sid-${m.name}` }));
			},
		});
		await tools.get("team_create")!.execute("t1", {
			name: "队",
			members: [
				{ name: "a", agent: "scout", task: "调研", model: "deepseek/deepseek-chat" },
				{ name: "b", agent: "scout", task: "执行" },
			],
		});
		const first = plans[0];
		expect(first, "startTeam 应被调用").toBeDefined();
		expect(first?.members[0]).toEqual({
			name: "a",
			agentName: "scout",
			task: "调研",
			model: "deepseek/deepseek-chat",
		});
		expect(first?.members[1]).toEqual({ name: "b", agentName: "scout", task: "执行" });
		// 第二个成员不该凭空多出 model 键（缺省 = 跟随领导模型，由执行器解析）
		expect("model" in (first?.members[1] ?? {})).toBe(false);
	});

	it("team_status 显示成员模型（有则显示、无则省略）", async () => {
		const { tools } = mount({
			getTeamState: () => ({
				name: "队",
				members: [
					{ name: "a", agentName: "scout", status: "running", turns: 1, lastActivity: "", model: "deepseek/deepseek-chat" },
					{ name: "b", agentName: "scout", status: "idle", turns: 0, lastActivity: "" },
				],
			}),
		});
		const out = await tools.get("team_status")!.execute("t1", {});
		expect(out.content[0]?.text).toContain("模型：deepseek/deepseek-chat");
		expect(out.content[0]?.text).not.toContain("模型：，");
	});
});
