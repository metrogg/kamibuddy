/**
 * MetaFold 词汇表的行为测试。
 *
 * 钉住三类行为：
 *   1. 意图标题（三种形态 / 无主题降级 / 主题压缩 / 运行中前缀 / 降级类别）
 *   2. 相邻正文关键词（主题三级降级链的中间一级：填充词剥离 / 首句 / 截断 / 不覆盖入参）
 *   3. 主导工具 leadToolName（次数最多者 / 平局稳定 / 命令类不合并）
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

/** 未完成的卡（工具执行还没回填 outcome）—— 「正在」前缀的唯一判据。 */
function runningCard(id: string, toolName = "read", summary = `src/${id}.ts`): ToolCard {
	return { ...tool(id, toolName, summary), outcome: undefined };
}

describe("意图标题", () => {
	it("单工具：{动作} {主题}", () => {
		expect(summarizeToolRun([tool("t1", "read", "README.md")])).toBe("查看 README.md");
		expect(summarizeToolRun([tool("t1", "write", "snake.html")])).toBe("写入 snake.html");
		expect(summarizeToolRun([tool("t1", "edit", "src/a.ts")])).toBe("修改 a.ts");
		expect(summarizeToolRun([tool("t1", "bash", "npm test")])).toBe("运行命令 npm test");
	});

	it("同类别多工具：类别模板（不是类型计数）", () => {
		expect(
			summarizeToolRun([tool("t1", "grep", "*.py"), tool("t2", "grep", "src/a.py")]),
		).toBe("定位 *.py 相关代码");
		// 读取类：read 与 ls 同属读取，主题取组内首张有主题的卡。
		expect(summarizeToolRun([tool("t1", "read", "README.md"), tool("t2", "ls", "src")])).toBe(
			"查看 README.md",
		);
		// write 与 edit 同属写入，模板是「修改 {topic}」。
		expect(summarizeToolRun([tool("t1", "write", "a.html"), tool("t2", "edit", "b.html")])).toBe(
			"修改 a.html",
		);
		expect(summarizeToolRun([tool("t1", "bash", "npm test"), tool("t2", "powershell", "dir")])).toBe(
			"运行 npm test",
		);
	});

	it("跨类别多工具：{动词1}、{动词2}：{主题}", () => {
		expect(summarizeToolRun([tool("t1", "grep", "*.py"), tool("t2", "bash", "npm test")])).toBe(
			"定位代码、运行校验：*.py",
		);
		// 动词按调用次数排序（多者在前），平局保留先出现者。
		expect(
			summarizeToolRun([
				tool("t1", "read", "a.ts"),
				tool("t2", "read", "b.ts"),
				tool("t3", "bash", "npm test"),
			]),
		).toBe("查看文件、运行校验：a.ts");
	});

	it("取不到主题：只留动词，不留悬空冒号/分隔符", () => {
		expect(summarizeToolRun([tool("t1", "read", "")])).toBe("查看");
		expect(summarizeToolRun([tool("t1", "read", ""), tool("t2", "read", "")])).toBe("查看相关文件");
		expect(summarizeToolRun([tool("t1", "grep", ""), tool("t2", "bash", "")])).toBe("定位代码、运行校验");
	});

	it("摘要为空的首卡不抢主题位", () => {
		expect(summarizeToolRun([tool("t1", "write", ""), tool("t2", "write", "real.html")])).toBe(
			"修改 real.html",
		);
	});

	it("主题压缩：路径取 basename（正/反斜杠、尾分隔符都兼容）", () => {
		expect(summarizeToolRun([tool("t1", "write", "docs/snake.html")])).toBe("写入 snake.html");
		expect(summarizeToolRun([tool("t1", "write", "docs\\snake.html")])).toBe("写入 snake.html");
		expect(summarizeToolRun([tool("t1", "ls", "src/")])).toBe("查看文件列表 src");
		// 带空白的命令行不按路径压缩：拆 basename 会把参数整段切掉。
		expect(summarizeToolRun([tool("t1", "bash", "ls -la src/")])).toBe("运行命令 ls -la src/");
	});

	it("主题压缩：URL 取域名", () => {
		expect(summarizeToolRun([tool("t1", "read", "https://example.com/a/b.md")])).toBe("查看 example.com");
	});

	it("主题压缩：超长截断（中文按字数、英文按词数）", () => {
		expect(summarizeToolRun([tool("t1", "read", "文".repeat(20))])).toBe(`查看 ${"文".repeat(16)}…`);
		expect(summarizeToolRun([tool("t1", "read", "one two three four five six seven")])).toBe(
			"查看 one two three four five six…",
		);
		// 未超阈值不动刀。
		expect(summarizeToolRun([tool("t1", "read", "一二三四五六")])).toBe("查看 一二三四五六");
	});

	it("运行中的组加「正在」前缀", () => {
		expect(summarizeToolRun([runningCard("t1", "read", "README.md")])).toBe("正在查看 README.md");
		expect(
			summarizeToolRun([tool("t1", "grep", "*.py"), runningCard("t2", "bash", "npm test")]),
		).toBe("正在定位代码、运行校验：*.py");
	});

	it("表外工具归入「其它」降级（MCP 工具 / 网页工具 / 空数组）", () => {
		expect(summarizeToolRun([])).toBe("");
		expect(summarizeToolRun([tool("t1", "mcp__xx", "")])).toBe("执行操作");
		expect(summarizeToolRun([tool("t1", "web_search", "KamiBuddy 架构")])).toBe(
			"执行操作 KamiBuddy 架构",
		);
		expect(summarizeToolRun([tool("t1", "mcp__a", "x"), tool("t2", "mcp__b", "y")])).toBe("处理 x");
	});
});

describe("相邻正文关键词（主题来源的第二级）", () => {
	it("入参取不到主题时，用相邻正文首句里的关键词补主题", () => {
		expect(
			summarizeToolRun(
				[tool("t1", "grep", ""), tool("t2", "bash", "")],
				"先跑一遍测试，看有没有挂。",
			),
		).toBe("定位代码、运行校验：跑一遍测试");
		expect(summarizeToolRun([tool("t1", "read", "")], "先梳理一下目录结构，再动手。")).toBe(
			"查看 梳理一下目录结构",
		);
	});

	it("入参有主题时相邻正文不覆盖它", () => {
		expect(summarizeToolRun([tool("t1", "read", "README.md")], "先跑一遍测试，看有没有挂。")).toBe(
			"查看 README.md",
		);
		// 入参主题在首卡为空、次卡有值时同样优先（主题位规则不因第二级而变）。
		expect(
			summarizeToolRun([tool("t1", "read", ""), tool("t2", "read", "src/a.ts")], "先跑一遍测试。"),
		).toBe("查看 a.ts");
	});

	it("无相邻正文 / 提不出关键词：退回只留动词（扩展签名前的行为）", () => {
		expect(summarizeToolRun([tool("t1", "read", "")])).toBe("查看");
		expect(summarizeToolRun([tool("t1", "read", "")], "")).toBe("查看");
		expect(summarizeToolRun([tool("t1", "read", "")], "   ")).toBe("查看");
		// 首句不足 2 字、或剥离填充词后什么都不剩 → 等同于取不到。
		expect(summarizeToolRun([tool("t1", "read", "")], "嗯。")).toBe("查看");
		expect(summarizeToolRun([tool("t1", "read", "")], "好的。")).toBe("查看");
		// 纯代码围栏（剥标记后为空）同样退回动词。
		expect(summarizeToolRun([tool("t1", "read", "")], "```js\nconst a = 1;\n```")).toBe("查看");
		// 多工具退回模板的无主题形态，不留悬空冒号。
		expect(summarizeToolRun([tool("t1", "read", ""), tool("t2", "read", "")], "好的。")).toBe(
			"查看相关文件",
		);
	});

	it("剥离句首填充词：长词优先，连缀最多剥三层", () => {
		// 「我先」要胜过「我」——否则会剥出「先梳理…」这种残片。
		expect(summarizeToolRun([tool("t1", "read", "")], "好的，我先梳理目录结构。")).toBe(
			"查看 梳理目录结构",
		);
		// 四层连缀（好的 / 我 / 现在 / 先）只剥前三层，第 4 层留在词里：
		// 上限与 WorkBuddy 同为 3 轮，防模型写散文时无限剥下去。
		expect(summarizeToolRun([tool("t1", "read", "")], "好的，我现在先梳理目录结构。")).toBe(
			"查看 先梳理目录结构",
		);
		expect(summarizeToolRun([tool("t1", "read", "")], "接下来对比两个方案。")).toBe("查看 对比两个方案");
		expect(summarizeToolRun([tool("t1", "read", "")], "让我看一下依赖文件。")).toBe("查看 看一下依赖文件");
	});

	it("只取首句，且不按空白切分关键词（中文夹 ASCII 不丢后半句）", () => {
		expect(summarizeToolRun([tool("t1", "read", "")], "依赖装好了。接下来改配置。")).toBe(
			"查看 依赖装好了",
		);
		expect(summarizeToolRun([tool("t1", "read", "")], "先看看 src 下的目录结构。")).toBe(
			"查看 看看 src 下的目录结构",
		);
	});

	it("markdown 标记先剥掉，不让 `*` `#` 之类粘进关键词", () => {
		expect(summarizeToolRun([tool("t1", "read", "")], "**先**对比两个方案的性能，选出更好的。")).toBe(
			"查看 对比两个方案的性能",
		);
	});

	it("关键词截断复用既有阈值（中文 16 字 / 英文 6 词）", () => {
		expect(summarizeToolRun([tool("t1", "read", "")], "梳理一下这个项目的整体目录结构和依赖关系。")).toBe(
			"查看 梳理一下这个项目的整体目录结构和…",
		);
		expect(summarizeToolRun([tool("t1", "read", "")], "Check the config file for missing entries")).toBe(
			"查看 Check the config file for missing…",
		);
		// 未超阈值不动刀。
		expect(summarizeToolRun([tool("t1", "read", "")], "先梳理目录结构。")).toBe("查看 梳理目录结构");
	});

	it("与「正在」前缀共存（相邻正文主题不干扰运行态判定）", () => {
		expect(summarizeToolRun([runningCard("t1", "read", "")], "先梳理目录结构。")).toBe(
			"正在查看 梳理目录结构",
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
