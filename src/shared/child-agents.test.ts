/**
 * child-agents 共享契约测试（spec: add-team-foundations 批 4）：
 * details 识别守卫 + 投影状态机（初始化/迁移/时间线封顶/快照拷贝）。
 */

import { describe, expect, it } from "vitest";
import {
	CHILD_AGENTS_DETAILS_KEY,
	ChildAgentsProjection,
	childAgentsOf,
} from "./child-agents.ts";

describe("childAgentsOf（details 识别守卫）", () => {
	const projection = [{ agent: "scout", task: "查", status: "queued", activity: "", turns: 0 }];

	it("details 带契约键的数组 → 原样返回", () => {
		expect(childAgentsOf({ [CHILD_AGENTS_DETAILS_KEY]: projection })).toEqual(projection);
	});

	it("details 非对象 / null / 缺键 / 值非数组 → undefined", () => {
		expect(childAgentsOf(undefined)).toBeUndefined();
		expect(childAgentsOf(null)).toBeUndefined();
		expect(childAgentsOf("text")).toBeUndefined();
		expect(childAgentsOf({})).toBeUndefined();
		expect(childAgentsOf({ [CHILD_AGENTS_DETAILS_KEY]: "不是数组" })).toBeUndefined();
	});

	it("契约键是常量：两侧从同一出处取（改键不漂移）", () => {
		expect(CHILD_AGENTS_DETAILS_KEY).toBe("subagents");
	});
});

describe("ChildAgentsProjection（投影状态机）", () => {
	it("初始化即全 queued 骨架；model 缺席则键缺席", () => {
		const projection = new ChildAgentsProjection([
			{ agent: "scout", task: "查一下", model: "deepseek/deepseek-chat" },
			{ agent: "worker", task: "执行" },
		]);
		expect(projection.snapshot()).toEqual([
			{ agent: "scout", task: "查一下", status: "queued", activity: "", turns: 0, model: "deepseek/deepseek-chat" },
			{ agent: "worker", task: "执行", status: "queued", activity: "", turns: 0 },
		]);
	});

	it("传入 kind 时逐项盖章（团队投影的标记通道）", () => {
		const projection = new ChildAgentsProjection([{ agent: "m", task: "t" }], "team");
		expect(projection.snapshot()[0]).toMatchObject({ kind: "team" });
	});

	it("不传 kind → kind 键缺席（task 工具与旧格式会话的兼容口径）", () => {
		const projection = new ChildAgentsProjection([{ agent: "s", task: "t" }]);
		expect("kind" in (projection.snapshot()[0] ?? {})).toBe(false);
	});

	it("patch 状态迁移；越界下标 no-op 不炸", () => {
		const projection = new ChildAgentsProjection([{ agent: "s", task: "t" }]);
		projection.patch(0, { status: "running" });
		expect(projection.snapshot()[0]?.status).toBe("running");
		expect(() => projection.patch(9, { status: "done" })).not.toThrow();
		expect(() => projection.patch(-1, { status: "done" })).not.toThrow();
	});

	it("pushActivity 同步 activity 与 timeline 末元素；空文本 no-op", () => {
		const projection = new ChildAgentsProjection([{ agent: "s", task: "t" }]);
		projection.pushActivity(0, "");
		expect(projection.snapshot()[0]?.activity).toBe("");
		projection.pushActivity(0, "正在 read a.md");
		const entry = projection.snapshot()[0];
		expect(entry?.activity).toBe("正在 read a.md");
		expect(entry?.timeline).toEqual(["正在 read a.md"]);
	});

	it("timeline 封顶 12 条真实行：溢出补「前 N 条已省略」首标记，标记不占槽位", () => {
		const projection = new ChildAgentsProjection([{ agent: "s", task: "t" }]);
		for (let i = 1; i <= 15; i += 1) projection.pushActivity(0, `动作 ${i}`);
		const timeline = projection.snapshot()[0]?.timeline;
		expect(timeline).toHaveLength(13); // 1 条省略标记 + 12 条保留
		expect(timeline?.[0]).toBe("（前 3 条已省略）");
		expect(timeline?.at(-1)).toBe("动作 15");
		// 标记之后继续追加，计数按累计丢弃数走（不把标记当动作行再挤掉一条）
		projection.pushActivity(0, "动作 16");
		const next = projection.snapshot()[0]?.timeline;
		expect(next?.[0]).toBe("（前 4 条已省略）");
		expect(next?.at(-1)).toBe("动作 16");
	});

	it("snapshot 是深拷贝：改快照不穿透内部状态", () => {
		const projection = new ChildAgentsProjection([{ agent: "s", task: "t" }]);
		const snap = [...projection.snapshot()];
		const first = snap[0];
		if (first === undefined) throw new Error("快照不应为空");
		snap[0] = { ...first, status: "done" };
		expect(projection.snapshot()[0]?.status).toBe("queued");
	});
});
