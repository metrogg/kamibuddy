/**
 * frontmatter 解析的行为测试。
 *
 * 这是「双面文件」机制的地基：解析错了会静默用错工具白名单
 * （比如把 `tools: [read, write]` 读成空数组 → 模型一个工具都没有，
 * 表现为「它说自己做不到」，极难联想到是解析问题）。
 * 所以每条报错路径都要有测试压着。
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

	it("值里含冒号且未加引号时，只在第一个冒号处切分", () => {
		const doc = parse(`---
note: 参见 docs/ARCHITECTURE.md §4.6: 能力即数据
---
x`);
		expect(doc.frontmatter["note"]).toBe("参见 docs/ARCHITECTURE.md §4.6: 能力即数据");
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

	it("数组元素一律是字符串，数字样式的 id 不被转换", () => {
		const doc = parse(`---
codes: [1, 2]
---
x`);
		expect(doc.frontmatter["codes"]).toEqual(["1", "2"]);
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

	it("值为空 → 报错，而不是当空串", () => {
		// 关键用例：把工具白名单写成 YAML 缩进列表时会命中这里。
		// 若静默当空串，白名单会变成「没有工具」，症状是模型说自己做不到。
		expect(() =>
			parse(`---
tools:
  - read
  - write
---
x`),
		).toThrow(/不支持多行值/);
	});

	it("没有冒号的行 → 报错", () => {
		expect(() => parse("---\n这行没有冒号\n---\nx")).toThrow(/无法解析的 frontmatter 行/);
	});

	it("键为空 → 报错", () => {
		expect(() => parse("---\n: 只有值\n---\nx")).toThrow(/无法解析/);
	});

	it("报错信息带文件标识与行号，便于定位", () => {
		// 「坏行」在第 3 行（第 1 行是 ---，第 2 行是 id: craft）。
		expect(() => parse("---\nid: craft\n坏行\n---\nx")).toThrow(/test\.md:3/);
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
