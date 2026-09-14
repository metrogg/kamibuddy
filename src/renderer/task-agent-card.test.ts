/**
 * task-agent-card 纯函数测试：分组行展示模型派生（queued/running/done/failed
 * 四态的动作行与可展开输出）、默认展开判定（运行中展开、终态折叠）。
 *
 * renderer 无组件测试基建（只有纯函数测试先例），钉的是「每行显示什么」；
 * 开合交互（override 优先）与 ToolEntry/TodoListCard 同模式，不重复覆盖。
 */

import { describe, expect, it } from "vitest";
import type { SubagentStatus } from "@shared/session-events.ts";
import { defaultOpenOf, deriveAgentRow } from "./task-agent-card.tsx";

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
