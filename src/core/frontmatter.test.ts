/**
 * frontmatter 解析的行为测试。
 *
 * 这是「双面文件」机制的地基：解析错了会静默用错工具白名单
 * （比如把 `tools: [read, write]` 读成空数组 → 模型一个工具都没有，
 * 表现为「它说自己做不到」，极难联想到是解析问题）。
 * 所以每条报错路径都要有测试压着。
 *
 * 2026-09-19：解析器换成 pi 那份（真 YAML）。**期望一律以加载器的行为为准** ——
 * 原先钉着自研解析器「宽容行为」的 6 处期望按实测结果翻转，每处都在用例名或注释里
 * 标了旧解析器的原行为，便于回溯为什么会变（详见 docs/ARCHITECTURE.md §4.26）。
 */

import { describe, expect, it } from "vitest";
import {
	optionalBoolean,
	parseFrontmatter,
	requireString,
	requireStringArray,
	type ParsedDocument,
} from "./frontmatter.ts";

const LABEL = "test.md";

function parse(source: string): ParsedDocument {
	return parseFrontmatter(source, LABEL);
}

describe("无 frontmatter", () => {
	it("纯正文原样返回，frontmatter 为空", () => {
		const doc = parse("这是一个提示片段。\n\n第二段。");
		expect(doc.frontmatter).toEqual({});
		expect(doc.body).toBe("这是一个提示片段。\n\n第二段。");
	});

	it("正文以 --- 开头但不是分隔线时不当 frontmatter", () => {
		// "---abc" 不是合法分隔线（我们要求 `---\n`）。
		const doc = parse("---abc\n内容");
		expect(doc.frontmatter).toEqual({});
	});

	it("空文件不报错", () => {
		expect(parse("")).toEqual({ frontmatter: {}, body: "" });
	});
});

describe("标量解析", () => {
	it("字符串、布尔、数字各按类型", () => {
		const doc = parse(`---
id: craft
ready: true
disabled: false
maxTurns: 40
---
正文`);

		expect(doc.frontmatter).toEqual({ id: "craft", ready: true, disabled: false, maxTurns: 40 });
		expect(doc.body).toBe("正文");
	});

	it("版本号一类的多点字符串不会被误转成数字", () => {
		// "1.2.3" 用 Number() 会得到 NaN，若不加正则限制就会静默变成 NaN。
		const doc = parse(`---
version: 1.2.3
---
x`);
		expect(doc.frontmatter["version"]).toBe("1.2.3");
	});

	it("负数与小数按数字", () => {
		const doc = parse(`---
offset: -3
ratio: 0.75
---
x`);
		expect(doc.frontmatter["offset"]).toBe(-3);
		expect(doc.frontmatter["ratio"]).toBe(0.75);
	});

	it("引号内的冒号不影响切分", () => {
		const doc = parse(`---
label: "写入：覆盖已有文件"
---
x`);
		expect(doc.frontmatter["label"]).toBe("写入：覆盖已有文件");
	});

	it("值里含冒号必须加引号 —— 不加就是 YAML 错误，不再宽容切分", () => {
		// 旧的自研解析器按第一个冒号切分，那是它独有的宽松；真 YAML 里 `: ` 属于映射语法，
		// 不加引号会报 BLOCK_AS_IMPLICIT_KEY。这条变化记在 docs/ARCHITECTURE.md §4.26。
		expect(() =>
			parse(`---
note: 参见 docs/ARCHITECTURE.md §4.6: 能力即数据
---
x`),
		).toThrow(/不是合法 YAML/);

		const quoted = parse(`---
note: "参见 docs/ARCHITECTURE.md §4.6: 能力即数据"
---
x`);
		expect(quoted.frontmatter["note"]).toBe("参见 docs/ARCHITECTURE.md §4.6: 能力即数据");
	});
});

describe("行内数组", () => {
	it("解析工具白名单", () => {
		const doc = parse(`---
tools: [read, write, edit]
---
x`);
		expect(doc.frontmatter["tools"]).toEqual(["read", "write", "edit"]);
	});

	it("空数组表示「不给任何工具」", () => {
		// ask 模式就是这种：只读也不给，纯问答。空数组与「字段缺失」语义不同。
		const doc = parse(`---
tools: []
---
x`);
		expect(doc.frontmatter["tools"]).toEqual([]);
	});

	it("容忍多余空格与尾随逗号", () => {
		const doc = parse(`---
tools: [ read ,  write , ]
---
x`);
		expect(doc.frontmatter["tools"]).toEqual(["read", "write"]);
	});

	it("数组元素保真：数字还是数字（旧解析器会一律转成字符串）", () => {
		// 与 pi 的加载器同一语义，不再自作主张 stringify；白名单类字段因此会被
		// requireStringArray 响亮拒绝，而不是悄悄变成 ["1","2"] 再被当成工具名用。
		const doc = parse(`---
codes: [1, 2]
---
x`);
		expect(doc.frontmatter["codes"]).toEqual([1, 2]);
	});
});

describe("空行与注释", () => {
	it("允许空行和 # 注释，便于在资源文件里写说明", () => {
		const doc = parse(`---
# 这个模式对应 WorkBuddy 的 interactionmode/craft
id: craft

tools: [read, write]
---
x`);
		expect(doc.frontmatter).toEqual({ id: "craft", tools: ["read", "write"] });
	});
});

describe("换行与编码", () => {
	it("处理 CRLF（Windows 上编辑过的文件）", () => {
		const doc = parse("---\r\nid: craft\r\n---\r\n正文");
		expect(doc.frontmatter["id"]).toBe("craft");
		expect(doc.body).toBe("正文");
	});

	it("处理 BOM", () => {
		const doc = parse("﻿---\nid: craft\n---\n正文");
		expect(doc.frontmatter["id"]).toBe("craft");
	});
});

describe("报错路径", () => {
	it("缺少结束分隔线 → 报错", () => {
		expect(() => parse("---\nid: craft\n正文没有结束线")).toThrow(/缺少结束的 ---/);
	});

	it("键后跟缩进列表 → 按数组读，不再是「不支持多行值」", () => {
		// 本次换解析器最直接的收益：白名单写成 YAML 缩进列表是常见写法。
		const doc = parse(`---
tools:
  - read
  - write
---
x`);
		expect(doc.frontmatter["tools"]).toEqual(["read", "write"]);
	});

	it("整块不是映射（裸标量）→ 报错，不放行", () => {
		// 真 YAML 会把「整块只有一行文本」解析成一个字符串文档；frontmatter 必须是映射。
		expect(() => parse("---\n这行没有冒号\n---\nx")).toThrow(/必须是 key: value 形式/);
	});

	it("键为空 → 报错", () => {
		// YAML 接受 `: 值` 并把它解析成空串键；那是写坏了的策略文件，不能当合法字段放过。
		expect(() => parse("---\n: 只有值\n---\nx")).toThrow(/空的键名/);
	});

	it("报错信息带文件标识与行号，便于定位", () => {
		// 「坏行」在第 3 行（第 1 行是 ---，第 2 行是 id: craft）。
		expect(() => parse("---\nid: craft\n坏行\n---\nx")).toThrow(/test\.md:3/);
	});
});

describe("块标量", () => {
	// 从 WorkBuddy 原样搬入的技能用 `description: |` 写多行（含独立的「触发词：」行），
	// 值本身有语义，不能被折叠或丢掉换行。

	it("| literal：多行保留换行，末尾保留一个换行（clip）", () => {
		const doc = parse(`---
description: |
  可比公司估值分析工具。
  触发词：可比估值、comps
---
正文`);

		expect(doc.frontmatter["description"]).toBe("可比公司估值分析工具。\n触发词：可比估值、comps\n");
	});

	it("|- literal strip：去掉结尾换行", () => {
		const doc = parse(`---
description: |-
  第一行
  第二行
---
正文`);

		expect(doc.frontmatter["description"]).toBe("第一行\n第二行");
	});

	it("块内各行缩进必须对齐 —— 不齐是 YAML 错误（旧解析器宽容取最小缩进）", () => {
		// 旧实现取「块内非空行的最小缩进」当基准，缩进不齐的文件也能读；真 YAML 要求同列。
		expect(() =>
			parse(`---
note: |
    缩进四
  缩进二
---
x`),
		).toThrow(/不是合法 YAML/);

		const aligned = parse(`---
note: |
  缩进二
  还是缩进二
---
x`);
		expect(aligned.frontmatter["note"]).toBe("缩进二\n还是缩进二\n");
	});

	it("> folded：同一段落的换行折成空格（clip 保留结尾换行）", () => {
		const doc = parse(`---
description: >
  第一行
  第二行
---
正文`);

		expect(doc.frontmatter["description"]).toBe("第一行 第二行\n");
	});

	it(">- folded strip：折叠后去掉结尾换行", () => {
		const doc = parse(`---
description: >-
  第一行
  第二行
---
正文`);

		expect(doc.frontmatter["description"]).toBe("第一行 第二行");
	});

	it("> folded：空行折成一个换行，段落因此分开", () => {
		const doc = parse(`---
description: >
  第一段
  仍属第一段

  第二段
---
正文`);

		expect(doc.frontmatter["description"]).toBe("第一段 仍属第一段\n第二段\n");
	});

	it("| literal：块内空行原样保留", () => {
		const doc = parse(`---
note: |
  第一行

  第三行
---
x`);

		expect(doc.frontmatter["note"]).toBe("第一行\n\n第三行\n");
	});

	it("块结束后的普通字段照常解析（key: value 与 key: [a, b]）", () => {
		const doc = parse(`---
name: comps-valuation
description: |
  多行
  描述
ready: true
tools: [read, write]
---
正文`);

		expect(doc.frontmatter).toEqual({
			name: "comps-valuation",
			description: "多行\n描述\n",
			ready: true,
			tools: ["read", "write"],
		});
		expect(doc.body).toBe("正文");
	});

	it("块标量的值归为 string", () => {
		const doc = parse(`---
note: |
  内容
---
x`);

		expect(typeof doc.frontmatter["note"]).toBe("string");
	});

	it("keep 修饰符 |+ → 能读，保留结尾换行（旧解析器报错）", () => {
		const doc = parse(`---
description: |+
  内容
---
x`);
		expect(doc.frontmatter["description"]).toBe("内容\n");
	});

	it("keep 修饰符 >+ → 能读（旧解析器报错）", () => {
		const doc = parse(`---
description: >+
  内容
---
x`);
		expect(doc.frontmatter["description"]).toBe("内容\n");
	});
});

describe("真 YAML 才能读的构造（2026-09-19 换解析器的直接动因）", () => {
	/*
	 * 两个真实样本：都是「技能页导入被拒」的现场。旧解析器对 `key:` 后跟缩进内容
	 * 一律抛「值为空；本解析器不支持多行值」，而 pi 的加载器读得动 ——
	 * 校验器比加载器弱，症状就是好端端的技能导不进来。
	 */

	it("嵌套 map：官方 easyeda-api 技能的 metadata.openclaw.requires", () => {
		const doc = parse(`---
name: easyeda-api
description: >-
  EasyEDA Pro API skill for AI agents.
metadata:
  author: JLCEDA
  version: "1.1.28"
  openclaw:
    requires:
      bins:
        - node
      env:
        - CLAUDE_SKILL_DIR
---
正文`);

		expect(doc.frontmatter["name"]).toBe("easyeda-api");
		expect(doc.frontmatter["description"]).toBe("EasyEDA Pro API skill for AI agents.");
		expect(doc.frontmatter["metadata"]).toEqual({
			author: "JLCEDA",
			version: "1.1.28",
			openclaw: { requires: { bins: ["node"], env: ["CLAUDE_SKILL_DIR"] } },
		});
	});

	it("嵌套 map + 嵌套数组：用户技能 ppt-master 的 metadata.sponsors", () => {
		const doc = parse(`---
name: ppt-master
description: >
  第一行
  第二行
metadata:
  version: "6.6.0"
  sponsors:
    - "SPONSORS.md"
    - "SPONSORS_CN.md"
---
正文`);

		expect(doc.frontmatter["description"]).toBe("第一行 第二行\n");
		expect(doc.frontmatter["metadata"]).toEqual({
			version: "6.6.0",
			sponsors: ["SPONSORS.md", "SPONSORS_CN.md"],
		});
	});

	it("嵌套结构不影响其它字段的取用（技能名与描述照常拿到）", () => {
		const doc = parse(`---
name: ppt-master
description: 演示文稿工作流
metadata:
  version: "6.6.0"
---
正文`);

		expect(requireString(doc, "name", LABEL)).toBe("ppt-master");
		expect(requireString(doc, "description", LABEL)).toBe("演示文稿工作流");
		// 版本号在 metadata 里（不在顶层）：技能页那一栏读的是顶层 version，故取不到 —— 如实为 undefined。
		expect(doc.frontmatter["version"]).toBeUndefined();
	});
});

describe("取值辅助", () => {
	const doc = parse(`---
id: craft
label: 创作
ready: true
tools: [read, write]
---
正文`);

	it("requireString 取到值", () => {
		expect(requireString(doc, "id", LABEL)).toBe("craft");
	});

	it("requireString 缺字段时报错 —— 不静默回落", () => {
		expect(() => requireString(doc, "missing", LABEL)).toThrow(/缺少字符串字段/);
	});

	it("requireString 遇到非字符串时报错", () => {
		expect(() => requireString(doc, "ready", LABEL)).toThrow(/缺少字符串字段/);
	});

	it("optionalBoolean 取到值 / 用默认值", () => {
		expect(optionalBoolean(doc, "ready", false)).toBe(true);
		expect(optionalBoolean(doc, "missing", true)).toBe(true);
	});

	it("requireStringArray 取到数组", () => {
		expect(requireStringArray(doc, "tools", LABEL)).toEqual(["read", "write"]);
	});

	it("requireStringArray 缺字段时报错", () => {
		expect(() => requireStringArray(doc, "missing", LABEL)).toThrow(/缺少数组字段/);
	});
});

describe("正文", () => {
	it("去掉 frontmatter 后的前导空行", () => {
		const doc = parse("---\nid: x\n---\n\n\n正文开始");
		expect(doc.body).toBe("正文开始");
	});

	it("正文内部的空行保留", () => {
		const doc = parse("---\nid: x\n---\n第一段\n\n第二段");
		expect(doc.body).toBe("第一段\n\n第二段");
	});

	it("正文里可以有 --- 分隔线", () => {
		// Markdown 正文中的水平线不该被当成 frontmatter 边界。
		const doc = parse("---\nid: x\n---\n上文\n\n---\n\n下文");
		expect(doc.body).toBe("上文\n\n---\n\n下文");
	});
});
