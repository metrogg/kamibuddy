/**
 * MetaFold 过程折叠的行为测试。
 *
 * 钉住五类行为：
 *   1. 回合分组边界（无 user、连续 user、工具开头）
 *   2. 连续段拆分（assistant 打断连续性：工具-文本-工具 = 两段）
 *   3. 进行中的回合不折叠（历史回合照常折叠）
 *   4. 摘要文案（归类计数 / 带主题 / 单位区分 / 未知工具 / 兜底）
 *   5. 主导工具 leadIcon（次数最多者 / 平局稳定 / 命令类不合并）
 */

import { describe, expect, it } from "vitest";
import type {
	AssistantMessage,
	ConversationEntry,
	ErrorEntry,
	ToolCard,
	UserMessage,
} from "./session-events.ts";
import { buildRenderBlocks, leadToolName, summarizeToolRun, type RenderBlock } from "./metafold.ts";

function user(id: string): UserMessage {
	return { id, role: "user", text: `消息 ${id}`, at: 1 };
}

function assistant(id: string): AssistantMessage {
	return { id, role: "assistant", text: `回答 ${id}`, at: 1 };
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

function error(id: string, runId = `r-${id}`): ErrorEntry {
	return { id, role: "error", message: `错误 ${id}`, runId, at: 1 };
}

/** 块流压成 kind 序列，断言结构时一眼看清。 */
function kinds(blocks: readonly RenderBlock[]): string[] {
	return blocks.map((b) => b.kind);
}

function folds(blocks: readonly RenderBlock[]): Extract<RenderBlock, { kind: "fold" }>[] {
	return blocks.filter((b): b is Extract<RenderBlock, { kind: "fold" }> => b.kind === "fold");
}

describe("回合分组边界", () => {
	it("无 user 消息：整段作为前缀回合，非流式下照常折叠", () => {
		const blocks = buildRenderBlocks([tool("t1"), tool("t2")], { streaming: false });
		expect(kinds(blocks)).toEqual(["fold"]);
		expect(folds(blocks)[0]?.cards).toHaveLength(2);
	});

	it("无 user 消息且流式中：没有回合锚点，不豁免折叠（字面口径）", () => {
		const blocks = buildRenderBlocks([tool("t1")], { streaming: true });
		expect(kinds(blocks)).toEqual(["fold"]);
	});

	it("连续 user：空回合不产生折叠单元，各自的回合头部各自跟随", () => {
		const blocks = buildRenderBlocks([user("u1"), user("u2"), tool("t1")], { streaming: false });
		expect(kinds(blocks)).toEqual(["entry", "turn-header", "entry", "turn-header", "fold"]);
	});

	it("工具开头（首个 user 之前）：前缀段独立折叠，不并入后续回合", () => {
		const blocks = buildRenderBlocks([tool("t0"), user("u1"), tool("t1")], { streaming: false });
		expect(kinds(blocks)).toEqual(["fold", "entry", "turn-header", "fold"]);
		expect(folds(blocks)[0]?.cards[0]?.id).toBe("t0");
	});

	it("空回合（user 是最后一条）：头部落在流尾，无折叠块", () => {
		const blocks = buildRenderBlocks([user("u1")], { streaming: true });
		expect(kinds(blocks)).toEqual(["entry", "turn-header"]);
	});
});

describe("连续段拆分", () => {
	it("assistant 消息打断连续性：工具-文本-工具 = 两个折叠单元", () => {
		const blocks = buildRenderBlocks(
			[user("u1"), tool("t1"), tool("t2"), assistant("a1"), tool("t3")],
			{ streaming: false },
		);
		expect(kinds(blocks)).toEqual(["entry", "turn-header", "fold", "entry", "fold"]);
		const units = folds(blocks);
		expect(units[0]?.cards.map((c) => c.id)).toEqual(["t1", "t2"]);
		expect(units[1]?.cards.map((c) => c.id)).toEqual(["t3"]);
	});

	it("跨回合的工具段各自折叠，互不合并", () => {
		const blocks = buildRenderBlocks(
			[user("u1"), tool("t1"), user("u2"), tool("t2")],
			{ streaming: false },
		);
		const units = folds(blocks);
		expect(units).toHaveLength(2);
		expect(units[0]?.cards[0]?.id).toBe("t1");
		expect(units[1]?.cards[0]?.id).toBe("t2");
	});

	it("show_widget 不进折叠：打断工具连续性并单独成块（图表折进去就消失了）", () => {
		const blocks = buildRenderBlocks(
			[user("u1"), tool("t1"), tool("w1", "show_widget", ""), tool("t2")],
			{ streaming: false },
		);
		expect(kinds(blocks)).toEqual(["entry", "turn-header", "fold", "entry", "fold"]);
		const units = folds(blocks);
		expect(units[0]?.cards.map((c) => c.id)).toEqual(["t1"]);
		expect(units[1]?.cards.map((c) => c.id)).toEqual(["t2"]);
		// 单独成块的就是那张 show_widget 卡（entry 块携原卡片 id）。
		const entryIds = blocks.filter((b) => b.kind === "entry").map((b) => b.entry.id);
		expect(entryIds).toContain("w1");
	});

	it("todo_write 不进折叠：清单卡是活面板，折进墓碑单元就从消息流消失", () => {
		const blocks = buildRenderBlocks(
			[user("u1"), tool("t1"), tool("d1", "todo_write", ""), tool("t2")],
			{ streaming: false },
		);
		expect(kinds(blocks)).toEqual(["entry", "turn-header", "fold", "entry", "fold"]);
		const units = folds(blocks);
		expect(units[0]?.cards.map((c) => c.id)).toEqual(["t1"]);
		expect(units[1]?.cards.map((c) => c.id)).toEqual(["t2"]);
		const entryIds = blocks.filter((b) => b.kind === "entry").map((b) => b.entry.id);
		expect(entryIds).toContain("d1");
	});
});

describe("进行中的回合不折叠", () => {
	it("流式中：最后 user 所在回合的工具原样平铺，历史回合照常折叠", () => {
		const entries: ConversationEntry[] = [
			user("u1"),
			tool("t1"),
			assistant("a1"),
			user("u2"),
			tool("t2"),
			tool("t3"),
		];
		const blocks = buildRenderBlocks(entries, { streaming: true });
		expect(kinds(blocks)).toEqual([
			"entry",
			"turn-header",
			"fold",
			"entry",
			"entry",
			"turn-header",
			"entry",
			"entry",
		]);
		expect(folds(blocks)).toHaveLength(1);
	});

	it("同一份 entries 流式结束后折叠生效", () => {
		const entries: ConversationEntry[] = [user("u1"), tool("t1"), tool("t2")];
		expect(kinds(buildRenderBlocks(entries, { streaming: true }))).toEqual([
			"entry",
			"turn-header",
			"entry",
			"entry",
		]);
		expect(kinds(buildRenderBlocks(entries, { streaming: false }))).toEqual([
			"entry",
			"turn-header",
			"fold",
		]);
	});
});

describe("回合头部与取消占位", () => {
	it("被取消回合的末尾补 cancelled 块，新回合开始后仍留在历史回合末尾", () => {
		const blocks = buildRenderBlocks(
			[user("u1"), tool("t1"), user("u2"), assistant("a1")],
			{ streaming: false, cancelledTurns: ["u1"] },
		);
		expect(kinds(blocks)).toEqual([
			"entry",
			"turn-header",
			"fold",
			"cancelled",
			"entry",
			"turn-header",
			"entry",
		]);
		expect(blocks[3]).toEqual({ kind: "cancelled", userId: "u1" });
	});

	it("cancelled 块在折叠单元之后（先 flush 工具，再落取消标记）", () => {
		const blocks = buildRenderBlocks([user("u1"), tool("t1")], {
			streaming: false,
			cancelledTurns: ["u1"],
		});
		expect(kinds(blocks)).toEqual(["entry", "turn-header", "fold", "cancelled"]);
	});
});

describe("错误块", () => {
	it("错误条目落成 error 块，并打断前面的工具连续段", () => {
		const blocks = buildRenderBlocks([user("u1"), tool("t1"), tool("t2"), error("e1")], {
			streaming: false,
		});
		expect(kinds(blocks)).toEqual(["entry", "turn-header", "fold", "error"]);
		const err = blocks[3];
		expect(err).toMatchObject({ kind: "error", entry: { id: "e1", runId: "r-e1" } });
	});

	it("新回合开始后错误卡留在历史回合原位", () => {
		const blocks = buildRenderBlocks(
			[user("u1"), error("e1"), user("u2"), assistant("a1")],
			{ streaming: false },
		);
		expect(kinds(blocks)).toEqual([
			"entry",
			"turn-header",
			"error",
			"entry",
			"turn-header",
			"entry",
		]);
	});

	it("错误前后的工具段各自成折叠单元，互不合并", () => {
		const blocks = buildRenderBlocks(
			[user("u1"), tool("t1"), error("e1"), tool("t2")],
			{ streaming: false },
		);
		expect(kinds(blocks)).toEqual(["entry", "turn-header", "fold", "error", "fold"]);
		expect(folds(blocks)[0]?.cards[0]?.id).toBe("t1");
		expect(folds(blocks)[1]?.cards[0]?.id).toBe("t2");
	});
});

describe("摘要文案", () => {
	it("归类计数：多类型按首次出现序拼接", () => {
		expect(
			summarizeToolRun([
				tool("t1", "read"),
				tool("t2", "read"),
				tool("t3", "read"),
				tool("t4", "write"),
				tool("t5", "write"),
			]),
		).toBe("读取 3 个文件、写入 2 个文件");
	});

	it("计数单位按类型区分：命令/次/目录/网页/产物各归各位", () => {
		expect(summarizeToolRun([tool("t1", "bash", "ls"), tool("t2", "powershell", "dir")])).toBe(
			"运行 2 个命令",
		);
		expect(summarizeToolRun([tool("t1", "grep", "foo")])).toBe("搜索内容 1 次");
		expect(summarizeToolRun([tool("t1", "ls", "src")])).toBe("列出 1 个目录");
		expect(summarizeToolRun([tool("t1", "web_fetch", "https://a.dev")])).toBe("读取 1 个网页");
		expect(summarizeToolRun([tool("t1", "present_files", "snake.html")])).toBe("交付 1 个产物");
	});

	it("bash 与 powershell 合并为同一「运行命令」归类", () => {
		expect(summarizeToolRun([tool("t1", "bash", "a"), tool("t2", "powershell", "b")])).toBe(
			"运行 2 个命令",
		);
	});

	it("单一文件类型带主题：多张「等 N」，单张直呼其名", () => {
		expect(summarizeToolRun([tool("t1", "write", "docs/snake.html"), tool("t2", "write", "a.html")])).toBe(
			"写入 snake.html 等 2 个文件",
		);
		expect(summarizeToolRun([tool("t1", "write", "docs\\snake.html")])).toBe("写入 snake.html");
	});

	it("主题只对「个文件」单位生效：命令类不带路径主题", () => {
		expect(summarizeToolRun([tool("t1", "bash", "npm test"), tool("t2", "bash", "npm run build")])).toBe(
			"运行 2 个命令",
		);
	});

	it("未知工具与已知混合：计作「使用工具 N 次」殿后，已知部分不带主题", () => {
		expect(summarizeToolRun([tool("t1", "read"), tool("t2", "mcp__xx"), tool("t3", "mcp__yy")])).toBe(
			"读取 1 个文件、使用工具 2 次",
		);
	});

	it("全是未知工具：兜底「N 个工具调用」", () => {
		expect(summarizeToolRun([tool("t1", "mcp__a"), tool("t2", "mcp__b"), tool("t3", "mcp__c")])).toBe(
			"3 个工具调用",
		);
	});

	it("摘要为空的首卡不抢主题位", () => {
		expect(summarizeToolRun([tool("t1", "write", ""), tool("t2", "write", "real.html")])).toBe(
			"写入 real.html 等 2 个文件",
		);
	});
});

describe("主导工具（leadIcon）", () => {
	it("fold 块带 leadIcon：段内调用次数最多的工具名", () => {
		const blocks = buildRenderBlocks(
			[user("u1"), tool("t1", "read"), tool("t2", "write"), tool("t3", "read")],
			{ streaming: false },
		);
		expect(folds(blocks)[0]?.leadIcon).toBe("read");
	});

	it("leadToolName 取次数最多者，与摘要的主题位规则无关", () => {
		expect(leadToolName([tool("t1", "bash", "a"), tool("t2", "read"), tool("t3", "read")])).toBe(
			"read",
		);
	});

	it("平局保留先达到最高次数者", () => {
		expect(leadToolName([tool("t1", "write"), tool("t2", "read")])).toBe("write");
		expect(leadToolName([tool("t1", "read"), tool("t2", "write")])).toBe("read");
	});

	it("bash 与 powershell 不合并计数（渲染侧把二者映射成同一图标）", () => {
		expect(
			leadToolName([
				tool("t1", "bash", "a"),
				tool("t2", "powershell", "b"),
				tool("t3", "read"),
				tool("t4", "read"),
			]),
		).toBe("read");
	});

	it("全是未知工具时 leadIcon 是首个未知工具名（图标兜底在渲染侧）", () => {
		expect(leadToolName([tool("t1", "mcp__a"), tool("t2", "mcp__b")])).toBe("mcp__a");
	});
});
