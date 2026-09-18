/**
 * 首页预设选取逻辑的行为契约（WorkBuddy 移植后的语义）。
 *
 * 钉住三件事：胶囊按场景分、playbook 胶囊的下钻列表 = 它的案例、
 * 案例筛选与「换一批」的分页边界（环绕、取不满、空集）。
 */

import { describe, expect, it } from "vitest";
import type { WelcomeCase, WelcomeChip } from "@shared/welcome.ts";
import { casesForChip, casesForScene, chipsForScene, itemsForChip, page } from "./home-presets.ts";

const CHIPS: readonly WelcomeChip[] = [
	{ id: "doc", scene: "work", label: "文档处理", description: "d", icon: "doc", chipKind: "playbook" },
	{ id: "slides", scene: "work", label: "幻灯片", description: "d", icon: "slide", chipKind: "playbook" },
	{ id: "daily", scene: "code", label: "日常开发", description: "d", icon: "code", chipKind: "scene", prompts: ["加功能", "修 Bug"] },
];

const CASES: readonly WelcomeCase[] = [
	{ id: "c1", chipId: "doc", title: "订单接口文档", subtitle: "s", prompt: "写接口文档", cover: "https://x/1.png" },
	{ id: "c2", chipId: "doc", title: "读书笔记卡", subtitle: "s", prompt: "做读书笔记", cover: "https://x/2.png" },
	{ id: "c3", chipId: "slides", title: "品牌介绍 PPT", subtitle: "s", prompt: "做 PPT", cover: "https://x/3.png" },
];

describe("chipsForScene", () => {
	it("只留当前场景的胶囊（代码场景不该看到办公胶囊）", () => {
		expect(chipsForScene(CHIPS, "work").map((c) => c.id)).toEqual(["doc", "slides"]);
		expect(chipsForScene(CHIPS, "code").map((c) => c.id)).toEqual(["daily"]);
	});
});

describe("itemsForChip", () => {
	it("playbook 胶囊：下钻列表 = 它名下的案例（标题 + 提示词）", () => {
		const items = itemsForChip(CHIPS[0]!, CASES);
		expect(items.map((i) => i.title)).toEqual(["订单接口文档", "读书笔记卡"]);
		expect(items.map((i) => i.prompt)).toEqual(["写接口文档", "做读书笔记"]);
	});

	it("scene 胶囊：内联提示词，没有标题（WorkBuddy 的本地场景模板就没有）", () => {
		const items = itemsForChip(CHIPS[2]!, CASES);
		expect(items.map((i) => i.title)).toEqual([undefined, undefined]);
		expect(items.map((i) => i.prompt)).toEqual(["加功能", "修 Bug"]);
		// key 必须唯一：同一胶囊下无标题的提示词只能靠序号区分。
		expect(new Set(items.map((i) => i.key)).size).toBe(2);
	});
});

describe("casesForChip / casesForScene", () => {
	it("未选胶囊给全部，选中只给它的（胶囊即筛选器）", () => {
		expect(casesForChip(CASES, undefined)).toHaveLength(3);
		expect(casesForChip(CASES, "doc").map((c) => c.id)).toEqual(["c1", "c2"]);
	});

	it("案例跟着所属胶囊的场景走：代码场景看不到办公案例", () => {
		expect(casesForScene(CASES, chipsForScene(CHIPS, "code"))).toHaveLength(0);
		expect(casesForScene(CASES, chipsForScene(CHIPS, "work"))).toHaveLength(3);
	});
});

describe("page", () => {
	const items = ["a", "b", "c", "d", "e"];

	it("按 offset 取一屏", () => {
		expect(page(items, 0, 4)).toEqual(["a", "b", "c", "d"]);
		expect(page(items, 4, 4)).toEqual(["e", "a", "b", "c"]);
	});

	it("取不满时只给这么多，不重复填充（最后一批不该出现重复卡）", () => {
		expect(page(items, 3, 4)).toEqual(["d", "e", "a", "b"]);
		expect(page(["a"], 0, 4)).toEqual(["a"]);
	});

	it("空集给空数组（卡片区据此整块不渲染）", () => {
		expect(page([], 0, 4)).toEqual([]);
	});
});
