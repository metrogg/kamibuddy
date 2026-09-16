/**
 * team 工具四件套测试（spec: add-team-foundations 批 5）。
 * 执行本体在 daemon（注入 deps），这里钉编排与回传契约：
 * 开关门、team_create 的投影与预算路径、team_send 的寻址转述、状态/解散。
 */

import { describe, expect, it } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CHILD_AGENTS_DETAILS_KEY } from "../shared/child-agents.ts";
import { teamExtensionFactory, type TeamToolDeps } from "./team-tools.ts";

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

	it("isEnabled=true → 四件套齐", () => {
		const { tools } = mount();
		expect([...tools.keys()].sort()).toEqual(["team_create", "team_delete", "team_send", "team_status"]);
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
