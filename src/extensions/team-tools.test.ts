/**
 * team 工具四件套测试（spec: add-team-foundations 批 5）。
 * 执行本体在 daemon（注入 deps），这里钉编排与回传契约：
 * 开关门、team_create 的投影与预算路径、team_send 的寻址转述、状态/解散。
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getResourcesDir } from "../core/config-paths.ts";
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
		readMemberOutput: async (to) => ({ member: to, output: `${to} 的产出正文`, status: "idle" }),
		// 缺省零成本路径：没有待送达产出（既有用例的期望值因此逐字节不变）。
		readPendingOutputs: () => undefined,
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

	it("isEnabled=true → 八件套齐（含拉模式的 team_read）", () => {
		const { tools } = mount();
		expect([...tools.keys()].sort()).toEqual([
			"team_create",
			"team_delegate_mode",
			"team_delete",
			"team_plan_review",
			"team_read",
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

describe("team_read（spec: add-team-pull-model 批次 ③ 领导主动拉产出）", () => {
	it("成员有产出 → 原样返回正文（产出不自动送达，这是唯一的取回路径）", async () => {
		const asked: string[] = [];
		const { tools } = mount({
			readMemberOutput: async (to) => {
				asked.push(to);
				return { member: to, output: "## 调查报告\n\n三条来源……", status: "idle" };
			},
		});
		const text = (await tools.get("team_read")!.execute("t1", { to: "a" })).content[0]?.text ?? "";
		expect(asked).toEqual(["a"]);
		expect(text).toContain("成员「a」的产出");
		expect(text).toContain("## 调查报告");
		expect(text).toContain("三条来源");
	});

	it("无团队 → 提示当前会话没有团队（不做成员名猜测）", async () => {
		const { tools } = mount({ readMemberOutput: async () => undefined });
		const text = (await tools.get("team_read")!.execute("t1", { to: "a" })).content[0]?.text ?? "";
		expect(text).toContain("没有团队");
	});

	it("产出还没落盘 → 按状态分原因：running 说还在跑", async () => {
		const { tools } = mount({
			readMemberOutput: async (to) => ({ member: to, output: undefined, status: "running" }),
		});
		const text = (await tools.get("team_read")!.execute("t1", { to: "a" })).content[0]?.text ?? "";
		expect(text).toContain("还在跑");
	});

	it("产出还没落盘 → interrupted 说那一轮没跑完、可稍后再取", async () => {
		const { tools } = mount({
			readMemberOutput: async (to) => ({ member: to, output: undefined, status: "interrupted" }),
		});
		const text = (await tools.get("team_read")!.execute("t1", { to: "a" })).content[0]?.text ?? "";
		expect(text).toContain("中断");
		expect(text).toContain("a");
	});

	it("产出还没落盘 → failed 说跑失败了、看它的会话记录找原因", async () => {
		const { tools } = mount({
			readMemberOutput: async (to) => ({ member: to, output: undefined, status: "failed" }),
		});
		const text = (await tools.get("team_read")!.execute("t1", { to: "a" })).content[0]?.text ?? "";
		expect(text).toContain("失败");
	});

	it("未知成员名的报错原样透传（注册表层 requireMember 大声拒绝）", async () => {
		const { tools } = mount({
			readMemberOutput: async () => {
				throw new Error("团队里没有成员「x」；现有成员：a、b");
			},
		});
		await expect(tools.get("team_read")!.execute("t1", { to: "x" })).rejects.toThrow(/没有成员「x」/);
	});

	it("to 为空串被 schema 拦下（minLength 1）", async () => {
		const { tools } = mount();
		const def = tools.get("team_read") as unknown as { parameters?: unknown } | undefined;
		expect(def?.parameters, "team_read 应带参数 schema").toBeDefined();
	});
});

describe("team_status 的产出可读提示（spec: add-team-pull-model 批次 ③）", () => {
	it("outputAvailable → 明说「有产出可读、用 team_read 取回」", async () => {
		const { tools } = mount({
			getTeamState: () => ({
				name: "攻坚队",
				members: [
					{ name: "a", agentName: "scout", status: "closed", turns: 2, lastActivity: "已完成 2 轮", outputAvailable: true },
				],
			}),
		});
		const text = (await tools.get("team_status")!.execute("t1", {})).content[0]?.text ?? "";
		expect(text).toContain("有产出可读");
		expect(text).toContain("team_read");
	});

	it("没有产出 → 不出现「有产出可读」（别让领导白跑一趟）", async () => {
		const { tools } = mount({
			getTeamState: () => ({
				name: "攻坚队",
				members: [{ name: "a", agentName: "scout", status: "running", turns: 1, lastActivity: "正在 read x" }],
			}),
		});
		const text = (await tools.get("team_status")!.execute("t1", {})).content[0]?.text ?? "";
		expect(text).not.toContain("有产出可读");
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

describe("team_status 的等待时长（spec: add-team-interrupt-diagnostics 批次 ②）", () => {
	it("等待 < 5 分钟 → 只报时长，不催办", async () => {
		const { tools } = mount({
			getTeamState: () => ({
				name: "攻坚队",
				members: [{ name: "a", agentName: "scout", status: "running", turns: 1, lastActivity: "正在 read x", waitedMinutes: 2 }],
			}),
		});
		const text = (await tools.get("team_status")!.execute("t1", {})).content[0]?.text ?? "";
		expect(text).toContain("你已等 2 分钟");
		expect(text).not.toContain("偏久");
	});

	it("等待 ≥ 5 分钟 → 附催办提示（领导自己不知道时间流逝）", async () => {
		const { tools } = mount({
			getTeamState: () => ({
				name: "攻坚队",
				members: [{ name: "a", agentName: "scout", status: "running", turns: 1, lastActivity: "正在 read x", waitedMinutes: 9 }],
			}),
		});
		const text = (await tools.get("team_status")!.execute("t1", {})).content[0]?.text ?? "";
		expect(text).toContain("你已等 9 分钟");
		expect(text).toContain("偏久");
	});

	it("waitingSince 为 0 → 不显示等待（已交回产出/失败/没起跑都不算在等）", async () => {
		const { tools } = mount({
			getTeamState: () => ({
				name: "攻坚队",
				members: [{ name: "a", agentName: "scout", status: "idle", turns: 2, lastActivity: "已完成 2 轮" }],
			}),
		});
		const text = (await tools.get("team_status")!.execute("t1", {})).content[0]?.text ?? "";
		expect(text).not.toContain("你已等");
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

describe("待送达的成员产出块（单点包装，spec: deliver-team-output-via-tools）", () => {
	/** 一段只在「待送达」时才会出现的文本（含指纹，形状同 team-output-snapshot 的块）。 */
	const PENDING =
		'<team_output team="攻坚队">\n- a（scout）：idle，已完成 2 轮 [fp a1b2c3d4]\n\n<member_output member="a">\n产出正文\n</member_output>\n</team_output>';

	it("team_create：块只加在 content 末尾，details 与不接该 dep 时逐字节一致", async () => {
		const params = { name: "攻坚队", members: [{ name: "scout-a", agent: "scout", task: "调研" }] };
		const withPending = await mount({ readPendingOutputs: () => PENDING })
			.tools.get("team_create")!
			.execute("t1", params);
		const baseline = await mount().tools.get("team_create")!.execute("t2", params);
		// content 结尾恰好多出读取器给的那一段，前缀与基线逐字节相同。
		expect(withPending.content).toEqual([...baseline.content, { type: "text", text: PENDING }]);
		// details 原样保留（team_create 的成员投影走 details，渲染层靠它）。
		expect(withPending.details).toEqual(baseline.details);
	});

	it("team_status 与 team_delete 都附同一段块（单点包装，不是只挂一个工具）", async () => {
		for (const name of ["team_status", "team_delete"]) {
			const mounted = mount({ readPendingOutputs: () => PENDING });
			const result = await mounted.tools.get(name)!.execute("t1", {});
			const baseline = await mount().tools.get(name)!.execute("t1", {});
			expect(result.content.at(-1)?.text, `${name} 的结果末尾应附待送达块`).toBe(PENDING);
			expect(result.details, `${name} 的 details 不该被包装动过`).toEqual(baseline.details);
		}
	});

	it("读取器返回 undefined → content 与不接该 dep 时完全一致（零成本路径）", async () => {
		const explicitNone = await mount({ readPendingOutputs: () => undefined })
			.tools.get("team_status")!
			.execute("t1", {});
		const baseline = await mount().tools.get("team_status")!.execute("t1", {});
		expect(explicitNone.content).toEqual(baseline.content);
		expect(explicitNone.details).toEqual(baseline.details);
	});
});

/*
 * 漏登记护栏（2026-09-19 真机事故）。
 *
 * 事故形状：`team_read` 在 spec: add-team-pull-model 批次③ 落地时**只加了工厂注册，
 * 忘了加进 craft 的模式白名单**。pi 只激活白名单里的名字 —— 注册了但不在白名单里
 * 等于没注册，而**方向相反的那种漏（白名单里的名字没有对应注册）pi 是静默忽略**，
 * 所以两头都不报错。真机表现是领导调 `team_read` 得到 `Tool team_read not found`，
 * 于是自己判断「工具面里没有产出回传通道」、降级成"让成员落盘再读文件"。
 *
 * 为什么放在这个测试里而不是门禁脚本：本文件的八条注册名就是团队工具的权威清单，
 * 两边一起改才叫改对了；门禁脚本（check:model-experience 等）看的是别的契约面。
 * 注意本护栏只覆盖团队工具这一组 —— 别的工厂若也漏登记，仍需各自的护栏。
 */
describe("craft 白名单覆盖（漏登记 ⇒ 静默失效）", () => {
	it("八个团队工具都在 craft.md 的工具白名单里", () => {
		const source = readFileSync(join(getResourcesDir(), "modes", "craft.md"), "utf8");
		const match = /^tools:\s*\[(.+)\]$/m.exec(source);
		expect(match).not.toBeNull();
		const allowed = new Set((match?.[1] ?? "").split(",").map((entry) => entry.trim()));
		for (const name of [
			"team_create",
			"team_send",
			"team_status",
			"team_read",
			"team_shutdown",
			"team_plan_review",
			"team_delegate_mode",
			"team_delete",
		]) {
			expect(
				allowed.has(name),
				`${name} 不在 resources/modes/craft.md 的白名单里：pi 只激活白名单里的名字，注册了也调不到（2026-09-19 team_read 就是这么丢的）`,
			).toBe(true);
		}
	});
});
