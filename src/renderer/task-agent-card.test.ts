/**
 * task-agent-card 纯函数测试：分组行展示模型派生（queued/running/done/failed
 * 四态的动作行与可展开输出）、默认展开判定（运行中展开、终态折叠）、
 * 行内展示位置（2026-09-19 与团队状态栏共用 AgentRow 后的口径：计数右对齐、
 * 动作行只在运行中当第二行）。
 *
 * renderer 无组件测试基建（只有纯函数测试先例），钉的是「每行显示什么」；
 * 开合交互（override 优先）与 ToolEntry/TodoListCard 同模式，不重复覆盖。
 */

import { describe, expect, it } from "vitest";
import type { SubagentStatus } from "@shared/session-events.ts";
import { agentActionPlacement, agentMetaLine, defaultOpenOf, deriveAgentRow } from "./task-agent-card-model.ts";

function agent(over: Partial<SubagentStatus> = {}): SubagentStatus {
	return {
		agent: "researcher",
		task: "调研竞品",
		status: "running",
		activity: "正在 web_search 竞品",
		turns: 0,
		...over,
	};
}

describe("deriveAgentRow：动作行文本", () => {
	it("queued 显示「等待中」，不扫光", () => {
		const row = deriveAgentRow(agent({ status: "queued", activity: "" }));
		expect(row).toEqual({ status: "queued", action: "等待中", live: false });
	});

	it("running 显示最新动作行并扫光", () => {
		const row = deriveAgentRow(agent({ status: "running", activity: "正在 web_search 竞品" }));
		expect(row).toEqual({ status: "running", action: "正在 web_search 竞品", live: true });
	});

	it("running 但 activity 为空串（无进展）：占位「执行中…」不留白", () => {
		const row = deriveAgentRow(agent({ status: "running", activity: "" }));
		expect(row.action).toBe("执行中…");
		expect(row.live).toBe(true);
	});

	it("done 显示「已完成 N 轮」，不扫光", () => {
		const row = deriveAgentRow(agent({ status: "done", activity: "", turns: 7, output: "结论正文" }));
		expect(row).toEqual({ status: "done", action: "已完成 7 轮", live: false, output: "结论正文" });
	});

	it("failed 显示诊断文本（output）", () => {
		const row = deriveAgentRow(agent({ status: "failed", activity: "", output: "子代理超时（600s）" }));
		expect(row).toEqual({ status: "failed", action: "子代理超时（600s）", live: false });
	});

	it("failed 但 output 缺席：交代「执行失败」不空行", () => {
		const row = deriveAgentRow(agent({ status: "failed", activity: "" }));
		expect(row.action).toBe("执行失败");
	});

	it("interrupted 说清「中断事实 + 跑了几轮」，不扫光", () => {
		const row = deriveAgentRow(agent({ status: "interrupted", activity: "", turns: 5 }));
		expect(row.status).toBe("interrupted");
		expect(row.live).toBe(false);
		// 拉模式下不再说「产出未回投」（产出一直是可以取回的，见
		// spec: add-team-pull-model 批次 ④）：有产出时由 outputAvailable 分支
		// 单独说，没产出时这句话只是噪音。
		expect(row.action).toContain("中断");
		expect(row.action).toContain("5 轮");
		expect(row.action).not.toContain("回投");
	});

	it("interrupted 但一轮都没跑完：不提轮数（别写「已跑 0 轮」）", () => {
		const row = deriveAgentRow(agent({ status: "interrupted", activity: "", turns: 0 }));
		expect(row.action).toContain("中断");
		expect(row.action).not.toContain("0 轮");
	});

	it("interrupted 不携带 output（它没有可展开的终态产出）", () => {
		expect(deriveAgentRow(agent({ status: "interrupted", output: "残留" })).output).toBeUndefined();
	});
});

describe("deriveAgentRow：done 组的可展开输出", () => {
	it("output 非空时携带 output（行可展开）", () => {
		const row = deriveAgentRow(agent({ status: "done", turns: 3, output: "输出文本" }));
		expect(row.output).toBe("输出文本");
	});

	it("output 缺席或空串时不携带（不挂展开入口）", () => {
		expect(deriveAgentRow(agent({ status: "done", turns: 3 })).output).toBeUndefined();
		expect(deriveAgentRow(agent({ status: "done", turns: 3, output: "" })).output).toBeUndefined();
	});

	it("非 done 态不携带 output（failed 的诊断走动作行，不是展开盒）", () => {
		expect(deriveAgentRow(agent({ status: "failed", output: "诊断" })).output).toBeUndefined();
		expect(deriveAgentRow(agent({ status: "running" })).output).toBeUndefined();
	});
});

describe("defaultOpenOf：默认展开规则", () => {
	it("运行中（outcome 未落定）默认展开", () => {
		expect(defaultOpenOf(undefined)).toBe(true);
	});

	it("终态（成功/失败/被拦/被取消）默认折叠", () => {
		expect(defaultOpenOf("ok")).toBe(false);
		expect(defaultOpenOf("error")).toBe(false);
		expect(defaultOpenOf("blocked")).toBe(false);
		expect(defaultOpenOf("aborted")).toBe(false);
	});
});

/*
 * 2026-09-19：行改成与团队状态栏共用的列行表（AgentRow），这两条是「一行里
 * 放什么」的判据 —— 计数右对齐、动作行只在运行中当第二行，最易回归。
 */
describe("agentMetaLine：右对齐计数", () => {
	it("普通子代理只有轮数：非零才给（0 轮是噪音，与 teamBarRows 同口径）", () => {
		expect(agentMetaLine(agent({ turns: 3 }))).toBe("3 轮");
		expect(agentMetaLine(agent({ turns: 0 }))).toBeUndefined();
	});

	it("成员带计数键时保持现状（轮/工具/tok/费用一起给）", () => {
		const meta = agentMetaLine(agent({ turns: 5, toolCalls: 12, tokens: 34560, cost: 0.1234 }));
		expect(meta).toBe("5 轮 · 12 次工具 · 34.6k tok · $0.12");
	});

	it("成员一轮没跑也照给（保持现状：计数行是成员行的固定位）", () => {
		expect(agentMetaLine(agent({ turns: 0, toolCalls: 0 }))).toBe("0 轮 · 0 次工具");
	});
});

describe("agentActionPlacement：动作行按「还有没有行动价值」落位", () => {
	it("运行中：动作行进行内第二行（它是「在做什么」的唯一可见处，不藏）", () => {
		const row = deriveAgentRow(agent({ status: "running", activity: "正在 web_search 竞品" }));
		expect(agentActionPlacement(row)).toEqual({ subline: "正在 web_search 竞品", detail: "" });
	});

	it("done：动作行收进展开区（「已完成 N 轮」与右对齐计数重复）", () => {
		const row = deriveAgentRow(agent({ status: "done", turns: 7 }));
		expect(agentActionPlacement(row)).toEqual({ detail: "已完成 7 轮" });
	});

	it("failed / interrupted：诊断**留在行内第二行**，不许藏进展开区", () => {
		// 这两句是「要动手」的诊断（超时诊断 / 产出还在、可去取回）。收进展开区等于
		// 把唯一的信号藏起来 —— 那正是「整卡默认折叠」时代被抱怨过的事。
		const failed = deriveAgentRow(agent({ status: "failed", output: "子代理超时（600s）" }));
		expect(agentActionPlacement(failed)).toEqual({ subline: "子代理超时（600s）", detail: "" });
		const interrupted = deriveAgentRow(agent({ status: "interrupted", turns: 5 }));
		expect(agentActionPlacement(interrupted)).toEqual({
			subline: "上次运行中随进程中断（已跑 5 轮）",
			detail: "",
		});
	});

	it("queued：「等待中」与状态短词「启动中」同义，两处都不放", () => {
		expect(agentActionPlacement(deriveAgentRow(agent({ status: "queued", activity: "" })))).toEqual({ detail: "" });
	});
});

describe("deriveAgentRow：产出还在（spec: add-team-pull-model 批次 ④，比 interrupted 更精确）", () => {
	it("带 outputAvailable 时文案说「跑完了 + 产出还在 + 可去取回」", () => {
		const row = deriveAgentRow(agent({ status: "interrupted", outputAvailable: true }));
		expect(row.status).toBe("interrupted");
		expect(row.action).toContain("跑完");
		expect(row.action).toContain("产出还在");
		expect(row.action).toContain("会话记录");
		expect(row.action).toContain("不必重跑");
	});

	it("outputAvailable 优先于 interrupted 文案（两者同真时取更有信息量的）", () => {
		const precise = deriveAgentRow(agent({ status: "interrupted", turns: 5, outputAvailable: true }));
		// 若无此分支会输出「已跑 5 轮」；有它则说「产出还在…可去取回」——
		// 前者只报「丢了什么」，后者告诉用户「东西还在、怎么做」。
		expect(precise.action).not.toContain("已跑 5 轮");
		expect(precise.action).toContain("可去取回");
	});

	it("outputAvailable 缺席时走原中断文案（不误报「产出还在」）", () => {
		const row = deriveAgentRow(agent({ status: "interrupted", turns: 5 }));
		expect(row.action).toBe("上次运行中随进程中断（已跑 5 轮）");
	});
});
