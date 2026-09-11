/**
 * MetaFold 摘要词汇表的行为测试。
 *
 * 钉住两类行为：
 *   1. 摘要文案（归类计数 / 带主题 / 单位区分 / 未知工具 / 兜底）
 *   2. 主导工具 leadToolName（次数最多者 / 平局稳定 / 命令类不合并）
 *
 * v1 渲染块流（buildRenderBlocks）已随轮折叠落地退役（见 metafold.ts 头注），
 * 其切轮/分段行为由 renderer/fold-view.test.ts 与 renderer/turn-fold.test.ts 接管。
 */

import { describe, expect, it } from "vitest";
import type { ToolCard } from "./session-events.ts";
import { leadToolName, summarizeToolRun } from "./metafold.ts";

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

describe("主导工具（leadToolName）", () => {
	it("取次数最多者，与摘要的主题位规则无关", () => {
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

	it("全是未知工具时是首个未知工具名（图标兜底在渲染侧）", () => {
		expect(leadToolName([tool("t1", "mcp__a"), tool("t2", "mcp__b")])).toBe("mcp__a");
	});
});
