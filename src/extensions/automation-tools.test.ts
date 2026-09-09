/**
 * 对话内 automation 工具的接缝测试。
 *
 * 调度计算与存储已分别由 shared/automation.test.ts 与 core/automation-store.test.ts
 * 钉住，这里测工具层自己的逻辑：
 *   - 三个工具的注册（名字必须与 craft.md 白名单一字不差）
 *   - 入参校验的错误文案（模型据此自我纠正，必须指明怎么改）
 *   - once 的 ISO 字符串 → 毫秒戳转换（含 date-only 的本地时区归一）
 *   - delete 的「无命中 / 多名命中」返回候选清单而不是抛错
 *
 * store 用真实的 AutomationStore + 临时文件：这层与 store 的接缝
 * （upsert/get/remove 的调用方式）也是要被测试钉住的部分。
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { AutomationStore } from "../core/automation-store.ts";
import { automationExtensionFactory } from "./automation-tools.ts";

interface FakeToolDef {
	readonly name: string;
	readonly description: string;
	readonly parameters: unknown;
	readonly execute: (
		toolCallId: string,
		params: Record<string, unknown>,
	) => Promise<{ content: Array<{ type: "text"; text: string }>; details: unknown }>;
}

let dir: string;
let store: AutomationStore;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "kami-automation-tools-"));
	store = new AutomationStore(join(dir, "automations.json"));
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

/** 装好扩展，返回按名称索引的工具表。cwd 缺省模拟「会话有工作目录」。 */
function mount(cwd = "D:\\workspaces\\demo"): Map<string, FakeToolDef> {
	const tools = new Map<string, FakeToolDef>();
	const fakePi = {
		registerTool: (def: FakeToolDef) => {
			tools.set(def.name, def);
		},
	} as unknown as ExtensionAPI;
	automationExtensionFactory(store, () => cwd)(fakePi);
	return tools;
}

function createTool(tools: Map<string, FakeToolDef>): FakeToolDef["execute"] {
	const execute = tools.get("automation_create")?.execute;
	expect(execute).toBeDefined();
	return execute!;
}

/** 建一个 daily 任务并返回工具结果文本。 */
async function createDaily(
	tools: Map<string, FakeToolDef>,
	name: string,
	prompt = "汇总昨天 09:00 到今天 09:00 的 git 提交，写入 D:\\workspaces\\demo\\reports 目录",
): Promise<string> {
	const result = await createTool(tools)("t", {
		name,
		prompt,
		schedule: { type: "daily", time: "09:00" },
	});
	return result.content[0]?.text ?? "";
}

describe("注册", () => {
	it("三个工具都在场，名字与 craft.md 白名单一致", () => {
		const tools = mount();
		expect(tools.has("automation_create")).toBe(true);
		expect(tools.has("automation_list")).toBe(true);
		expect(tools.has("automation_delete")).toBe(true);
	});
});

describe("automation_create", () => {
	it("daily 任务：落库为 active，返回调度摘要与下次运行时间", async () => {
		const tools = mount();
		const text = await createDaily(tools, "工作日早报");

		expect(text).toContain("每天 09:00");
		expect(text).toContain("下次运行时间");
		expect(text).toContain("定时任务已创建");

		const tasks = store.list();
		expect(tasks).toHaveLength(1);
		const task = tasks[0];
		expect(task?.status).toBe("active");
		expect(task?.name).toBe("工作日早报");
		expect(task?.cwd).toBe("D:\\workspaces\\demo"); // 缺省取当前会话 cwd
		expect(task?.runs).toEqual([]);
		expect(task?.nextRunAt).toBeTypeOf("number");
		expect(task?.id).toBeTypeOf("string");
	});

	it("显式 cwd 覆盖缺省值", async () => {
		const tools = mount();
		await createTool(tools)("t", {
			name: "n",
			prompt: "p",
			schedule: { type: "interval", everyMinutes: 30 },
			cwd: "D:\\other",
		});
		expect(store.list()[0]?.cwd).toBe("D:\\other");
	});

	it("once 的 ISO 字符串转成毫秒戳（本地时区）", async () => {
		const tools = mount();
		await createTool(tools)("t", {
			name: "n",
			prompt: "p",
			schedule: { type: "once", at: "2099-01-01T09:00:00" },
		});
		const task = store.list()[0];
		expect(task?.schedule).toEqual({ type: "once", at: new Date("2099-01-01T09:00:00").getTime() });
		expect(task?.nextRunAt).toBe(new Date("2099-01-01T09:00:00").getTime());
	});

	it("once 的 date-only 形式按本地零点解析（ES 规范里 date-only 本按 UTC）", async () => {
		const tools = mount();
		await createTool(tools)("t", {
			name: "n",
			prompt: "p",
			schedule: { type: "once", at: "2099-01-01" },
		});
		expect(store.list()[0]?.schedule).toEqual({
			type: "once",
			at: new Date("2099-01-01T00:00:00").getTime(),
		});
	});

	it("name / prompt 为空 → 报错并指明改法", async () => {
		const tools = mount();
		const execute = createTool(tools);
		await expect(
			execute("t", { name: "  ", prompt: "p", schedule: { type: "daily", time: "09:00" } }),
		).rejects.toThrow("任务名称不能为空");
		await expect(
			execute("t", { name: "n", prompt: "  ", schedule: { type: "daily", time: "09:00" } }),
		).rejects.toThrow("prompt）不能为空");
		expect(store.list()).toHaveLength(0);
	});

	it("会话无工作目录且未传 cwd → 报错要求显式传 cwd", async () => {
		const tools = mount(""); // playground：无工作目录
		await expect(
			createTool(tools)("t", {
				name: "n",
				prompt: "p",
				schedule: { type: "daily", time: "09:00" },
			}),
		).rejects.toThrow("cwd");
	});

	it("once 的时刻已过 → 报错让模型改成将来时刻（不建永不运行的任务）", async () => {
		const tools = mount();
		await expect(
			createTool(tools)("t", {
				name: "n",
				prompt: "p",
				schedule: { type: "once", at: "2020-01-01T00:00:00" },
			}),
		).rejects.toThrow("不会补跑");
		expect(store.list()).toHaveLength(0);
	});

	it("once 的 at 无法解析 → 报错并给出 ISO 8601 示例", async () => {
		const tools = mount();
		await expect(
			createTool(tools)("t", {
				name: "n",
				prompt: "p",
				schedule: { type: "once", at: "明天上午" },
			}),
		).rejects.toThrow("ISO 8601");
	});

	it("weekly 的 weekdays 越界 → 报错指明 0-6 值域", async () => {
		const tools = mount();
		await expect(
			createTool(tools)("t", {
				name: "n",
				prompt: "p",
				schedule: { type: "weekly", time: "09:00", weekdays: [1, 7] },
			}),
		).rejects.toThrow("0-6");
	});

	it("weekly 的 weekdays 为空 / interval 间隔为 0 → 走 validateSchedule 的文案", async () => {
		const tools = mount();
		await expect(
			createTool(tools)("t", {
				name: "n",
				prompt: "p",
				schedule: { type: "weekly", time: "09:00", weekdays: [] },
			}),
		).rejects.toThrow("请至少选择一个星期");
		await expect(
			createTool(tools)("t", {
				name: "n",
				prompt: "p",
				schedule: { type: "interval", everyMinutes: 0 },
			}),
		).rejects.toThrow("间隔分钟数必须是正整数");
	});
});

describe("automation_list", () => {
	it("空库返回明确文案", async () => {
		const tools = mount();
		const execute = tools.get("automation_list")?.execute;
		const result = await execute!("t", {});
		expect(result.content[0]?.text).toContain("没有任何定时任务");
	});

	it("返回各任务的摘要字段，不含 prompt 全文", async () => {
		const tools = mount();
		await createDaily(tools, "任务甲", "这是一段很长的任务指令全文，不该出现在 list 里");
		await createDaily(tools, "任务乙");

		const execute = tools.get("automation_list")?.execute;
		const result = await execute!("t", {});
		const text = result.content[0]?.text ?? "";
		const parsed = JSON.parse(text) as Array<Record<string, unknown>>;
		expect(parsed).toHaveLength(2);
		expect(parsed[0]).toMatchObject({
			name: "任务甲",
			schedule: "每天 09:00",
			status: "active",
			runs: 0,
		});
		expect(parsed[0]?.id).toBeTypeOf("string");
		expect(parsed[0]?.nextRunAt).toBeTypeOf("string");
		expect(text).not.toContain("不该出现在 list 里");
	});
});

describe("automation_delete", () => {
	it("按 id 删除，返回含任务名的确认", async () => {
		const tools = mount();
		await createDaily(tools, "要删的任务");
		const id = store.list()[0]?.id ?? "";

		const result = await tools.get("automation_delete")?.execute!("t", { id });
		expect(result?.content[0]?.text).toContain("已删除定时任务「要删的任务」");
		expect(store.list()).toHaveLength(0);
	});

	it("id 不存在 → 报错并指引 automation_list", async () => {
		const tools = mount();
		await expect(
			tools.get("automation_delete")?.execute!("t", { id: "不存在的id" }),
		).rejects.toThrow("automation_list");
	});

	it("name 唯一命中 → 删除", async () => {
		const tools = mount();
		await createDaily(tools, "唯一的名字");
		const result = await tools.get("automation_delete")?.execute!("t", { name: "唯一的名字" });
		expect(result?.content[0]?.text).toContain("已删除");
		expect(store.list()).toHaveLength(0);
	});

	it("name 多名命中 → 返回候选清单（不抛错、不删任何任务）", async () => {
		const tools = mount();
		await createDaily(tools, "同名");
		await createDaily(tools, "同名");

		const result = await tools.get("automation_delete")?.execute!("t", { name: "同名" });
		const text = result?.content[0]?.text ?? "";
		expect(text).toContain("2 个");
		expect(text).toContain("用 id 指定");
		// 两个候选的 id 都列出来，模型才能接着删。
		for (const task of store.list()) expect(text).toContain(task.id);
		expect(store.list()).toHaveLength(2);
	});

	it("name 无命中 → 返回现有任务清单（不抛错、不删任何任务）", async () => {
		const tools = mount();
		await createDaily(tools, "现存任务");

		const result = await tools.get("automation_delete")?.execute!("t", { name: "不存在" });
		const text = result?.content[0]?.text ?? "";
		expect(text).toContain("没有找到名为「不存在」");
		expect(text).toContain("现存任务");
		expect(store.list()).toHaveLength(1);
	});

	it("id 与 name 都不给 → 报错要求提供其一", async () => {
		const tools = mount();
		await expect(tools.get("automation_delete")?.execute!("t", {})).rejects.toThrow(
			"id 或名称",
		);
	});
});
