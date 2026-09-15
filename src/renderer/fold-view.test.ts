/**
 * fold-view 纯函数层的行为测试（spec: add-turn-fold-and-anchor Task 1）。
 *
 * 钉住三类行为：
 *   1. 锚点选举（最长/最后/并列/空文本/全空/非正文不参与）
 *   2. 段折叠分组（≥2 成批/孤立不批/正文断批/思考不断批/豁免断批）
 *   3. 轮折叠计划（完成/进行中/错误/豁免恒外/无正文/无工具/双锚点/末锚点尾巴）
 *   4. 进行中轮的顶层分组与折叠时机（shouldFold：其后出现过正文 / 执行中尾批平铺 /
 *      组 id 稳定）
 *   5. 批次主题的相邻正文兜底（批前优先 → 批后兜底；入参主题优先）
 */

import { describe, expect, it } from "vitest";
import { summarizeToolRun } from "@shared/metafold.ts";
import type {
	ArtifactsPresentedEntry,
	AssistantMessage,
	ConversationEntry,
	ErrorEntry,
	ToolCard,
	UserMessage,
} from "@shared/session-events.ts";
import {
	buildFoldPlan,
	electAnchors,
	groupToolBatches,
	type FoldPlanItem,
	type ToolBatchItem,
} from "./fold-view.ts";

function user(id: string): UserMessage {
	return { id, role: "user", text: `消息 ${id}`, at: 1 };
}

function assistant(id: string, text: string, thinking?: string): AssistantMessage {
	return thinking === undefined
		? { id, role: "assistant", text, at: 1 }
		: { id, role: "assistant", text, thinking, at: 1 };
}

function tool(id: string, toolName = "read", summary = `src/${id}.ts`): ToolCard {
	return {
		id,
		role: "tool",
		toolName,
		label: "工具",
		summary,
		outcome: "ok",
		detail: undefined,
		at: 1,
	};
}

function error(id: string): ErrorEntry {
	return { id, role: "error", message: `错误 ${id}`, runId: `r-${id}`, at: 1 };
}

function artifacts(id: string): ArtifactsPresentedEntry {
	return { id, role: "artifacts_presented", files: [], focusFile: undefined, at: 1 };
}

/** 锚点集转有序数组，断言时一眼看清。 */
function anchorIds(blocks: readonly ConversationEntry[]): string[] {
	return [...electAnchors(blocks)].sort();
}

function planKinds(items: readonly FoldPlanItem[]): string[] {
	return items.map((item) => item.kind);
}

/** 计划项覆盖的条目 id 序列（折叠段/顶层组展开、单块取自身）。 */
function itemIds(item: FoldPlanItem | undefined): string[] {
	if (item === undefined) return [];
	if (item.kind === "turn-folded" || item.kind === "process-fold" || item.kind === "tool-group") {
		return item.entries.map((e) => e.id);
	}
	return [item.entry.id];
}

/** 顶层工具组项（断言时避免逐处窄化）。 */
function groups(items: readonly FoldPlanItem[]): Extract<FoldPlanItem, { kind: "tool-group" }>[] {
	return items.filter((i): i is Extract<FoldPlanItem, { kind: "tool-group" }> => i.kind === "tool-group");
}

function batches(items: readonly ToolBatchItem[]): Extract<ToolBatchItem, { kind: "batch" }>[] {
	return items.filter((i): i is Extract<ToolBatchItem, { kind: "batch" }> => i.kind === "batch");
}

describe("锚点选举", () => {
	it("最长即最后：唯一锚点", () => {
		expect(anchorIds([assistant("a1", "短"), assistant("a2", "x".repeat(40))])).toEqual(["a2"]);
	});

	it("最长与最后不同：两者都是锚点（过程文本比终答长也保留）", () => {
		expect(anchorIds([assistant("a1", "x".repeat(40)), assistant("a2", "终答")])).toEqual([
			"a1",
			"a2",
		]);
	});

	it("并列最长全保留，且最后一条永远当选", () => {
		expect(
			anchorIds([
				assistant("a1", "x".repeat(20)),
				assistant("a2", "y".repeat(20)),
				assistant("a3", "短"),
			]),
		).toEqual(["a1", "a2", "a3"]);
	});

	it("空文本（含纯空白）不参与：既不当最长，也不占「最后一条」", () => {
		expect(anchorIds([assistant("a1", "终答"), assistant("a2", "   ")])).toEqual(["a1"]);
		expect(anchorIds([assistant("a1", "  "), assistant("a2", "终答")])).toEqual(["a2"]);
	});

	it("全空正文：无锚点", () => {
		expect(electAnchors([assistant("a1", ""), assistant("a2", "  ")])).toHaveLength(0);
	});

	it("工具卡与思考内容不参与选举", () => {
		const blocks = [
			tool("t1"),
			assistant("a1", "", "很长的思考".repeat(50)),
			assistant("a2", "正文"),
		];
		expect(anchorIds(blocks)).toEqual(["a2"]);
	});
});

describe("段折叠分组", () => {
	it("连续 ≥2 工具块成批：主工具名 + 总数 + 归类摘要", () => {
		const items = groupToolBatches([
			tool("t1", "read"),
			tool("t2", "write"),
			tool("t3", "read"),
		]);
		expect(items).toHaveLength(1);
		const batch = batches(items)[0];
		expect(batch?.cards.map((c) => c.id)).toEqual(["t1", "t2", "t3"]);
		expect(batch?.leadName).toBe("read");
		expect(batch?.totalCount).toBe(3);
		// 摘要措辞归 shared/metafold 的词汇表（意图标题那一版在那边的测试里钉），
		// 这里只钉「分组直连那份词汇表、不自己拼文案」。
		expect(batch?.summary).toBe(summarizeToolRun(batch?.cards ?? []));
		expect(batch?.summary).not.toBe("");
	});

	it("孤立单块不成批：原样平铺", () => {
		expect(groupToolBatches([tool("t1")])).toEqual([
			{ kind: "block", entry: expect.objectContaining({ id: "t1" }) },
		]);
		// 前后都是正文时单卡同样不批。
		const items = groupToolBatches([assistant("a1", "前"), tool("t1"), assistant("a2", "后")]);
		expect(items.map((i) => i.kind)).toEqual(["block", "block", "block"]);
	});

	it("交错正文断批：工具-正文-工具 = 两段各自成批", () => {
		const items = groupToolBatches([
			tool("t1"),
			tool("t2"),
			assistant("a1", "中间说明"),
			tool("t3"),
			tool("t4"),
		]);
		expect(items.map((i) => i.kind)).toEqual(["batch", "block", "batch"]);
		expect(batches(items)[0]?.cards.map((c) => c.id)).toEqual(["t1", "t2"]);
		expect(batches(items)[1]?.cards.map((c) => c.id)).toEqual(["t3", "t4"]);
	});

	it("纯思考块不断批：跨消息边界连续仍成批，思考被批次吸收", () => {
		const thinking = assistant("a1", "", "推导过程");
		const items = groupToolBatches([tool("t1"), thinking, tool("t2")]);
		expect(items).toHaveLength(1);
		const batch = batches(items)[0];
		expect(batch?.cards.map((c) => c.id)).toEqual(["t1", "t2"]);
		// 展开批次时思考块原位可见。
		expect(batch?.entries.map((e) => e.id)).toEqual(["t1", "a1", "t2"]);
	});

	it("不足两块时思考与工具按原序平铺", () => {
		const items = groupToolBatches([assistant("a1", "", "思考"), tool("t1")]);
		expect(items.map((i) => i.kind)).toEqual(["block", "block"]);
	});

	it("豁免卡断批且单独通过（show_widget/todo_write 不进批次）", () => {
		const items = groupToolBatches([
			tool("t1"),
			tool("w1", "show_widget", ""),
			tool("t2"),
			tool("d1", "todo_write", ""),
			tool("t3"),
		]);
		expect(items.map((i) => i.kind)).toEqual(["block", "block", "block", "block", "block"]);
	});
});

describe("轮折叠计划", () => {
	it("完成轮：首锚点之前一切进轮折叠区，锚点常显", () => {
		const plan = buildFoldPlan(
			[user("u1"), tool("t1"), tool("t2"), assistant("a1", "终答")],
			"finished",
		);
		expect(planKinds(plan.items)).toEqual(["visible", "turn-folded", "anchor"]);
		expect(itemIds(plan.items[1])).toEqual(["t1", "t2"]);
		expect(plan.hasTurnFold).toBe(true);
		expect([...plan.anchors]).toEqual(["a1"]);
	});

	it("非锚点正文是过程文本：随工具一起进轮折叠区", () => {
		const plan = buildFoldPlan(
			[tool("t1"), assistant("a1", "过程说明"), tool("t2"), assistant("a2", "x".repeat(40))],
			"finished",
		);
		expect(planKinds(plan.items)).toEqual(["turn-folded", "anchor"]);
		expect(itemIds(plan.items[0])).toEqual(["t1", "a1", "t2"]);
	});

	it("过程文本比终答长：双锚点常显，锚点之间包过程消息段", () => {
		const plan = buildFoldPlan(
			[
				tool("t1"),
				assistant("a1", "x".repeat(40)),
				tool("t2"),
				tool("t3"),
				assistant("a2", "终答"),
			],
			"finished",
		);
		expect([...plan.anchors].sort()).toEqual(["a1", "a2"]);
		expect(planKinds(plan.items)).toEqual(["turn-folded", "anchor", "process-fold", "anchor"]);
		expect(itemIds(plan.items[0])).toEqual(["t1"]);
		expect(itemIds(plan.items[2])).toEqual(["t2", "t3"]);
	});

	it("末锚点之后的工具（终答后的交付卡）包过程消息段，产物卡豁免", () => {
		const plan = buildFoldPlan(
			[assistant("a1", "终答"), tool("t1", "present_files", "snake.html"), artifacts("p1")],
			"finished",
		);
		expect(planKinds(plan.items)).toEqual(["anchor", "process-fold", "exempt"]);
		expect(itemIds(plan.items[1])).toEqual(["t1"]);
		expect(plan.hasTurnFold).toBe(false);
	});

	it("进行中轮：其后出现过正文的批次收成顶层组，无正文时仍平铺", () => {
		const plan = buildFoldPlan(
			[user("u1"), tool("t1"), tool("t2"), assistant("a1", "写到一半")],
			"streaming",
		);
		expect(planKinds(plan.items)).toEqual(["visible", "tool-group", "visible"]);
		expect(itemIds(plan.items[1])).toEqual(["t1", "t2"]);
		expect(plan.hasTurnFold).toBe(false);
		expect(plan.anchors.size).toBe(0);
	});

	it("错误轮：过程仍折叠，错误卡豁免在外", () => {
		const plan = buildFoldPlan([tool("t1"), tool("t2"), error("e1")], "error");
		expect(planKinds(plan.items)).toEqual(["turn-folded", "exempt"]);
		expect(itemIds(plan.items[0])).toEqual(["t1", "t2"]);
		expect(itemIds(plan.items[1])).toEqual(["e1"]);
		expect(plan.hasTurnFold).toBe(true);
	});

	it("豁免卡恒在折叠区外且位置不动（把折叠区隔开也不挪位）", () => {
		const plan = buildFoldPlan(
			[tool("t1"), tool("w1", "show_widget", ""), tool("t2"), assistant("a1", "终答")],
			"finished",
		);
		expect(planKinds(plan.items)).toEqual(["turn-folded", "exempt", "turn-folded", "anchor"]);
		expect(itemIds(plan.items[0])).toEqual(["t1"]);
		expect(itemIds(plan.items[2])).toEqual(["t2"]);
	});

	it("无正文轮（全工具）：无锚点，一切进轮折叠区，头部仍可展开", () => {
		const plan = buildFoldPlan([tool("t1"), tool("t2"), tool("t3")], "finished");
		expect(planKinds(plan.items)).toEqual(["turn-folded"]);
		expect(itemIds(plan.items[0])).toEqual(["t1", "t2", "t3"]);
		expect(plan.anchors.size).toBe(0);
		expect(plan.hasTurnFold).toBe(true);
	});

	it("无工具纯文本轮：无折叠区（锚点照常标注）", () => {
		const plan = buildFoldPlan(
			[assistant("a1", "短"), assistant("a2", "x".repeat(40))],
			"finished",
		);
		expect(planKinds(plan.items)).toEqual(["visible", "anchor"]);
		expect(plan.hasTurnFold).toBe(false);
	});

	it("纯思考块随过程一起进轮折叠区", () => {
		const plan = buildFoldPlan(
			[assistant("a1", "", "推导过程"), tool("t1"), assistant("a2", "终答")],
			"finished",
		);
		expect(planKinds(plan.items)).toEqual(["turn-folded", "anchor"]);
		expect(itemIds(plan.items[0])).toEqual(["a1", "t1"]);
	});
});

describe("批次主题的相邻正文兜底", () => {
	it("批前无正文（轮首批）：退回批后的正文，不丢唯一的线索", () => {
		const blocks = [
			tool("t1", "read", ""),
			tool("t2", "read", ""),
			assistant("a1", "先跑一遍测试，看有没有挂。"),
		];
		const batch = batches(groupToolBatches(blocks))[0];
		expect(batch?.summary).toBe("查看 跑一遍测试");
		// 对照组：抽掉那条正文就退回无主题形态（说明主题确实来自正文）。
		expect(batches(groupToolBatches(blocks.slice(0, 2)))[0]?.summary).toBe("查看相关文件");
	});

	it("批后没有正文：用批前最近的一条正文", () => {
		const blocks = [
			assistant("a0", "先梳理一下目录结构，再动手。"),
			tool("t1", "read", ""),
			tool("t2", "read", ""),
		];
		expect(batches(groupToolBatches(blocks))[0]?.summary).toBe("查看 梳理一下目录结构");
	});

	it("批前后都有正文：批前优先（有意偏离 WorkBuddy 的批后优先）", () => {
		const blocks = [
			assistant("a0", "先梳理目录结构。"),
			tool("t1", "read", ""),
			tool("t2", "read", ""),
			assistant("a1", "依赖检查完毕。"),
		];
		// 批前那句是下一批的引子/意图；批后那句读出来的是本批的「结果」，不当主题。
		expect(batches(groupToolBatches(blocks))[0]?.summary).toBe("查看 梳理目录结构");
	});

	it("豁免卡断批：批后取不到，用批前的正文", () => {
		const blocks = [
			assistant("a0", "先梳理目录结构。"),
			tool("t1", "read", ""),
			tool("t2", "read", ""),
			tool("w1", "show_widget", ""),
		];
		expect(batches(groupToolBatches(blocks))[0]?.summary).toBe("查看 梳理目录结构");
	});

	it("入参有主题时不被相邻正文覆盖", () => {
		const blocks = [
			tool("t1", "read", "README.md"),
			tool("t2", "read", "src/a.ts"),
			assistant("a1", "先跑一遍测试，看有没有挂。"),
		];
		expect(batches(groupToolBatches(blocks))[0]?.summary).toBe("查看 README.md");
	});

	it("进行中轮的顶层组同样接到相邻正文（streamingItems 走同一遍分组）", () => {
		const plan = buildFoldPlan(
			[tool("t1", "read", ""), tool("t2", "read", ""), assistant("a1", "先跑一遍测试，看有没有挂。")],
			"streaming",
		);
		expect(groups(plan.items)[0]?.summary).toBe("查看 跑一遍测试");
	});

	it("折叠段内的批次：段内的过程正文可用作主题", () => {
		const plan = buildFoldPlan(
			[
				tool("t1", "read", ""),
				tool("t2", "read", ""),
				assistant("a1", "先跑一遍测试，看有没有挂。"),
				assistant("a2", "x".repeat(40)),
			],
			"finished",
		);
		const segment = plan.items[0];
		expect(segment?.kind).toBe("turn-folded");
		const entries = segment?.kind === "turn-folded" ? segment.entries : [];
		expect(itemIds(segment)).toEqual(["t1", "t2", "a1"]);
		expect(batches(groupToolBatches(entries))[0]?.summary).toBe("查看 跑一遍测试");
	});
});

describe("进行中轮的顶层分组与折叠时机", () => {
	it("连续 ≥2 次调用且其后出现过正文：收成一个顶层组", () => {
		const blocks = [tool("t1", "read"), tool("t2", "grep"), assistant("a1", "查完了")];
		const plan = buildFoldPlan(blocks, "streaming");
		expect(planKinds(plan.items)).toEqual(["tool-group", "visible"]);
		const group = groups(plan.items)[0];
		expect(group?.entries.map((e) => e.id)).toEqual(["t1", "t2"]);
		expect(group?.cards.map((c) => c.id)).toEqual(["t1", "t2"]);
		expect(group?.leadName).toBe("read");
		expect(group?.totalCount).toBe(2);
		// 文案来自同一遍分组（词汇表只有一套）：不在这里钉措辞，钉「同源」。
		expect(group?.summary).toBe(batches(groupToolBatches(blocks))[0]?.summary);
		expect(group?.summary).not.toBe("");
	});

	it("正文断组：正文两侧各成一组，正文自身平铺", () => {
		const plan = buildFoldPlan(
			[tool("t1"), tool("t2"), assistant("a1", "先看看"), tool("t3"), tool("t4"), assistant("a2", "再看")],
			"streaming",
		);
		expect(planKinds(plan.items)).toEqual(["tool-group", "visible", "tool-group", "visible"]);
		expect(itemIds(plan.items[0])).toEqual(["t1", "t2"]);
		expect(itemIds(plan.items[2])).toEqual(["t3", "t4"]);
	});

	it("单个调用不成组：即使其后有正文也平铺为单卡", () => {
		const plan = buildFoldPlan([tool("t1"), assistant("a1", "说明")], "streaming");
		expect(planKinds(plan.items)).toEqual(["visible", "visible"]);
	});

	it("执行中尾批平铺：整轮还没结束且其后还没正文", () => {
		const plan = buildFoldPlan([tool("t1"), tool("t2"), tool("t3")], "streaming");
		expect(planKinds(plan.items)).toEqual(["visible", "visible", "visible"]);
	});

	it("正文之后新起的尾批仍平铺：只有等过正文的批才收起", () => {
		const plan = buildFoldPlan(
			[tool("t1"), tool("t2"), assistant("a1", "中途说明"), tool("t3"), tool("t4")],
			"streaming",
		);
		expect(planKinds(plan.items)).toEqual(["tool-group", "visible", "visible", "visible"]);
		expect(itemIds(plan.items[0])).toEqual(["t1", "t2"]);
	});

	it("纯思考块被组吸收：不单独平铺，随组展开原位可见", () => {
		const plan = buildFoldPlan(
			[tool("t1"), assistant("a1", "", "推导"), tool("t2"), assistant("a2", "结论")],
			"streaming",
		);
		expect(planKinds(plan.items)).toEqual(["tool-group", "visible"]);
		expect(itemIds(plan.items[0])).toEqual(["t1", "a1", "t2"]);
	});

	it("豁免卡断组且不入组：show_widget 原位平铺", () => {
		const plan = buildFoldPlan(
			[tool("t1"), tool("w1", "show_widget", ""), tool("t2"), tool("t3"), assistant("a1", "结论")],
			"streaming",
		);
		expect(planKinds(plan.items)).toEqual(["visible", "exempt", "tool-group", "visible"]);
		expect(itemIds(plan.items[2])).toEqual(["t2", "t3"]);
	});

	it("组 id 稳定：流式增量只加内容不改 id（手点展开态不被刷新重置）", () => {
		const live = buildFoldPlan([tool("t1"), tool("t2"), assistant("a1", "结论")], "streaming");
		const grown = buildFoldPlan(
			[tool("t1"), tool("t2"), tool("t3"), assistant("a1", "结论")],
			"streaming",
		);
		const liveId = groups(live.items)[0]?.id;
		expect(liveId).toBeDefined();
		expect(groups(grown.items)[0]?.id).toBe(liveId);
		// 且组随增量长大（同一个组，不是换了个新组）。
		expect(groups(grown.items)[0]?.totalCount).toBe(3);
	});

	it("组 id 不含易变下标、与折叠段内的批次同源（轮结束后同一批仍是同一 id）", () => {
		const blocks = [tool("t1"), tool("t2"), assistant("a1", "结论")];
		const liveId = groups(buildFoldPlan(blocks, "streaming").items)[0]?.id;
		expect(liveId).toBe("batch-t1");
		expect(liveId).toBe(batches(groupToolBatches(blocks))[0]?.id);
	});

	it("新轮的组 id 全新 → 天生默认收起（旧轮的手点展开不外溢）", () => {
		const first = groups(buildFoldPlan([tool("t1"), tool("t2"), assistant("a1", "结论")], "streaming").items)[0];
		const second = groups(buildFoldPlan([tool("t9"), tool("t10"), assistant("a9", "结论")], "streaming").items)[0];
		expect(second?.id).not.toBe(first?.id);
	});
});
