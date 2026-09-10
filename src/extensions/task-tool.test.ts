/**
 * task 工具的测试。
 *
 * 执行器（daemon/subagent-runner.ts）与装配（daemon/index.ts）各有归属，
 * 这里钉工具本体的编排契约：
 *   - schema 边界（tasks/chain 1-8 个、非空字段）—— pi 执行前按 schema 校验
 *     （pi-ai 的 validateToolArguments），边界全在 schema 层、直接测 schema；
 *   - 「恰好一种用法」的运行时判定（混合/缺半/全缺 → 用法指导，不调执行器）；
 *   - agent 不存在 → 可用清单（name + description）回给模型改选，且不消耗预算；
 *   - spawn 预算：每个子任务消耗 1，耗尽给预算文案（单发/并行/链式口径一致）；
 *   - 并行并发派发与汇总文案；链式 {previous} 替换与失败即停；
 *   - runSubagent 抛错 → 诊断文本（不是工具异常）。
 */

import { describe, expect, it } from "vitest";
import { Compile } from "typebox/compile";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AgentDefinition } from "../core/agents.ts";
import {
	taskExtensionFactory,
	type SubagentRunOutcome,
	type SubagentRunRequest,
} from "./task-tool.ts";

interface SubtaskReport {
	readonly agent: string;
	readonly ok: boolean;
	readonly text: string;
	readonly turns: number;
}

interface FakeToolResult {
	readonly content: ReadonlyArray<{ type: "text"; text: string }>;
	readonly details: {
		readonly mode: "single" | "parallel" | "chain";
		readonly results: readonly SubtaskReport[];
	};
}

interface FakeToolDef {
	readonly name: string;
	readonly label: string;
	readonly description: string;
	readonly parameters: unknown;
	readonly execute: (
		toolCallId: string,
		params: Record<string, unknown>,
		signal?: AbortSignal,
		onUpdate?: (partial: unknown) => void,
	) => Promise<FakeToolResult>;
}

const SCOUT: AgentDefinition = {
	name: "scout",
	description: "只读侦察",
	tools: ["read", "ls"],
	body: "你是侦察子代理。",
};

const WORKER: AgentDefinition = {
	name: "worker",
	description: "全工具执行",
	tools: ["read", "write"],
	body: "你是执行子代理。",
};

interface MountOptions {
	readonly agents?: readonly AgentDefinition[];
	/** 每个子任务的执行结果（成功值）或抛出的错误。 */
	readonly behavior?: (request: SubagentRunRequest) => Promise<SubagentRunOutcome>;
	/** 预算份数：checkBudget 前 N 次返回 true，之后 false。缺省不限。 */
	readonly budget?: number;
}

/** 装好扩展，返回注册到的 task 工具定义与 runSubagent 调用记录。 */
function mount(options: MountOptions = {}): {
	readonly tool: FakeToolDef;
	readonly calls: SubagentRunRequest[];
} {
	const calls: SubagentRunRequest[] = [];
	let budgetLeft = options.budget ?? Number.POSITIVE_INFINITY;
	let tool: FakeToolDef | undefined;
	const fakePi = {
		registerTool: (def: FakeToolDef) => {
			tool = def;
		},
	} as unknown as ExtensionAPI;

	taskExtensionFactory({
		listAgents: () => options.agents ?? [SCOUT, WORKER],
		checkBudget: () => {
			if (budgetLeft <= 0) return false;
			budgetLeft -= 1;
			return true;
		},
		runSubagent: async (request) => {
			calls.push(request);
			if (options.behavior !== undefined) return options.behavior(request);
			return { output: `输出：${request.task}`, turns: 2 };
		},
	})(fakePi);

	if (tool === undefined) throw new Error("task 工具没有注册");
	return { tool, calls };
}

describe("schema 边界（pi 执行前校验，工具不再重复校验）", () => {
	const { tool } = mount();
	const check = Compile(tool.parameters as Parameters<typeof Compile>[0]);

	it("三种用法的合法入参都通过", () => {
		expect(check.Check({ agent: "scout", task: "看看目录里有什么" })).toBe(true);
		expect(
			check.Check({ tasks: [{ agent: "scout", task: "甲" }, { agent: "worker", task: "乙" }] }),
		).toBe(true);
		expect(check.Check({ chain: [{ agent: "scout", task: "先查 {previous}" }] })).toBe(true);
	});

	it("tasks / chain 空数组或超过 8 个都拒", () => {
		expect(check.Check({ tasks: [] })).toBe(false);
		expect(check.Check({ chain: [] })).toBe(false);
		const nine = Array.from({ length: 9 }, (_, i) => ({ agent: "scout", task: `任务 ${i + 1}` }));
		expect(check.Check({ tasks: nine })).toBe(false);
		expect(check.Check({ chain: nine })).toBe(false);
	});

	it("空 agent / 空 task 拒", () => {
		expect(check.Check({ agent: "", task: "做点什么" })).toBe(false);
		expect(check.Check({ agent: "scout", task: "" })).toBe(false);
		expect(check.Check({ tasks: [{ agent: "scout", task: "" }] })).toBe(false);
	});
});

describe("注册形态", () => {
	it("工具名与面向用户的标题", () => {
		const { tool } = mount();
		expect(tool.name).toBe("task");
		expect(tool.label).toBe("子任务");
	});

	it("描述里的子代理简介从 listAgents 动态生成（用户可覆盖，不写死）", () => {
		const { tool } = mount();
		expect(tool.description).toContain("- scout：只读侦察");
		expect(tool.description).toContain("- worker：全工具执行");
		expect(tool.description).toContain("自包含");
	});
});

describe("「恰好一种用法」的运行时判定", () => {
	it("混合用法 → 用法指导，不调执行器", async () => {
		const { tool, calls } = mount();
		const result = await tool.execute("t1", {
			agent: "scout",
			task: "单发",
			tasks: [{ agent: "scout", task: "并行" }],
		});
		expect(calls).toHaveLength(0);
		expect(result.content[0]?.text).toContain("只能选择一种");
		expect(result.details.results).toHaveLength(0);
	});

	it("agent/task 只给一半 → 用法指导", async () => {
		const { tool, calls } = mount();
		const result = await tool.execute("t1", { agent: "scout" });
		expect(calls).toHaveLength(0);
		expect(result.content[0]?.text).toContain("只能选择一种");
	});

	it("什么都不给 → 用法指导", async () => {
		const { tool, calls } = mount();
		const result = await tool.execute("t1", {});
		expect(calls).toHaveLength(0);
		expect(result.content[0]?.text).toContain("只能选择一种");
	});
});

describe("单发模式", () => {
	it("执行结果含 agent 名、输出与轮数；details 带完整结构", async () => {
		const { tool, calls } = mount();
		const result = await tool.execute("t1", { agent: "scout", task: "查一下" });

		expect(calls).toHaveLength(1);
		expect(calls[0]?.agent.name).toBe("scout");
		expect(calls[0]?.task).toBe("查一下");
		expect(result.details.mode).toBe("single");
		expect(result.details.results[0]).toMatchObject({ agent: "scout", ok: true, turns: 2 });
		expect(result.content[0]?.text).toContain("scout");
		expect(result.content[0]?.text).toContain("2 轮");
		expect(result.content[0]?.text).toContain("输出：查一下");
	});

	it("agent 不存在 → 可用清单回给模型改选，不消耗预算", async () => {
		const { tool, calls } = mount({ budget: 1 });
		const result = await tool.execute("t1", { agent: "ghost", task: "查一下" });

		expect(calls).toHaveLength(0);
		expect(result.details.results[0]?.ok).toBe(false);
		expect(result.content[0]?.text).toContain("没有名为「ghost」的子代理");
		expect(result.content[0]?.text).toContain("- scout：只读侦察");
		expect(result.content[0]?.text).toContain("- worker：全工具执行");

		// 预算没被那次失败消耗：紧接着的合法调用照常执行。
		const next = await tool.execute("t2", { agent: "scout", task: "再来" });
		expect(next.details.results[0]?.ok).toBe(true);
	});

	it("runSubagent 抛错 → 诊断文本而非工具异常", async () => {
		const { tool } = mount({
			behavior: async () => {
				throw new Error("timeout");
			},
		});
		const result = await tool.execute("t1", { agent: "scout", task: "查一下" });
		expect(result.details.results[0]?.ok).toBe(false);
		expect(result.content[0]?.text).toContain("诊断：timeout");
	});

	it("预算耗尽 → 预算文案，告诉模型按现有信息继续", async () => {
		const { tool, calls } = mount({ budget: 0 });
		const result = await tool.execute("t1", { agent: "scout", task: "查一下" });
		expect(calls).toHaveLength(0);
		expect(result.details.results[0]?.ok).toBe(false);
		expect(result.content[0]?.text).toContain("预算已耗尽");
		expect(result.content[0]?.text).toContain("按现有信息继续");
	});
});

describe("并行模式", () => {
	it("多个子任务并发派发（都收到调用），汇总成功数", async () => {
		const { tool, calls } = mount({
			behavior: async (request) => {
				if (request.agent.name === "worker") throw new Error("磁盘写满");
				return { output: `输出：${request.task}`, turns: 1 };
			},
		});
		const result = await tool.execute("t1", {
			tasks: [
				{ agent: "scout", task: "甲" },
				{ agent: "worker", task: "乙" },
				{ agent: "scout", task: "丙" },
			],
		});

		expect(calls).toHaveLength(3);
		expect(result.details.mode).toBe("parallel");
		expect(result.content[0]?.text).toContain("并行执行 3 个子任务，成功 2 个");
		expect(result.content[0]?.text).toContain("诊断：磁盘写满");
	});

	it("每个子任务消耗一份预算：预算只够 2 个时第 3 个拿预算文案", async () => {
		const { tool, calls } = mount({ budget: 2 });
		const result = await tool.execute("t1", {
			tasks: [
				{ agent: "scout", task: "甲" },
				{ agent: "scout", task: "乙" },
				{ agent: "scout", task: "丙" },
			],
		});
		expect(calls).toHaveLength(2);
		expect(result.details.results.filter((r) => r.ok)).toHaveLength(2);
		expect(result.content[0]?.text).toContain("预算已耗尽");
	});
});

describe("链式模式", () => {
	it("{previous} 替换为上一步输出，首步替换为空串", async () => {
		const { tool, calls } = mount({
			behavior: async (request) => ({ output: `产出<${request.agent.name}>`, turns: 1 }),
		});
		const result = await tool.execute("t1", {
			chain: [
				{ agent: "scout", task: "先调研 {previous}" },
				{ agent: "worker", task: "基于 {previous} 写成文档" },
			],
		});

		expect(calls).toHaveLength(2);
		expect(calls[0]?.task).toBe("先调研 ");
		expect(calls[1]?.task).toBe("基于 产出<scout> 写成文档");
		expect(result.details.mode).toBe("chain");
		expect(result.content[0]?.text).toContain("链式执行完成 2 步");
	});

	it("任一步失败即停：后续步不执行，返回已完成步与失败诊断", async () => {
		const { tool, calls } = mount({
			behavior: async (request) => {
				if (request.agent.name === "worker") throw new Error("权限被拒");
				return { output: "第一步行", turns: 3 };
			},
		});
		const result = await tool.execute("t1", {
			chain: [
				{ agent: "scout", task: "第一步" },
				{ agent: "worker", task: "第二步" },
				{ agent: "scout", task: "第三步" },
			],
		});

		expect(calls).toHaveLength(2);
		expect(result.details.results).toHaveLength(2);
		expect(result.content[0]?.text).toContain("链式执行在第 2 步（worker）中止");
		expect(result.content[0]?.text).toContain("第一步行");
		expect(result.content[0]?.text).toContain("诊断：权限被拒");
		expect(result.content[0]?.text).not.toContain("第三步");
	});

	it("执行途中预算耗尽同样即停", async () => {
		const { tool, calls } = mount({ budget: 1 });
		const result = await tool.execute("t1", {
			chain: [
				{ agent: "scout", task: "第一步" },
				{ agent: "scout", task: "第二步" },
			],
		});
		expect(calls).toHaveLength(1);
		expect(result.details.results[1]?.ok).toBe(false);
		expect(result.content[0]?.text).toContain("预算已耗尽");
	});
});

describe("进度与中断接线", () => {
	it("execute 的 onUpdate 作为 onProgress 传给执行器（tool_progress 的源头）", async () => {
		const { tool, calls } = mount();
		const updates: string[] = [];
		await tool.execute("t1", { agent: "scout", task: "查一下" }, undefined, (partial) => {
			const p = partial as { content: Array<{ type: string; text: string }> };
			updates.push(p.content[0]?.text ?? "");
		});
		// 工具本身不造进展文案（那是执行器的职责），但通道必须接通：
		// 执行器拿到的 onProgress 调一次，onUpdate 就该收一次。
		expect(calls[0]?.onProgress).toBeDefined();
		calls[0]?.onProgress?.("scout：正在 read a.md");
		expect(updates).toEqual(["scout：正在 read a.md"]);
	});

	it("signal 原样传给执行器（主会话中断的传播链）", async () => {
		const { tool, calls } = mount();
		const controller = new AbortController();
		await tool.execute("t1", { agent: "scout", task: "查一下" }, controller.signal);
		expect(calls[0]?.signal).toBe(controller.signal);
	});
});
