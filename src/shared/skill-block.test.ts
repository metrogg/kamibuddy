/**
 * 技能块的拆（splitSkillBlocks）与拼（skillInvocationText）的单元测试
 * （spec: rework-skill-ux-workbuddy）。
 *
 * 输入一律是 pi 展开后的用户消息文本形状（dist/core/agent-session.js:983-1007）：
 * `<skill name="…" location="…">\nReferences are relative to …\n\n<body>\n</skill>`，
 * 有补充文本时后面接 `\n\n<args>`。
 */

import { describe, expect, it } from "vitest";
import {
	bareSkillName,
	SKILL_COMMAND_PREFIX,
	skillInvocationText,
	splitSkillBlocks,
} from "./skill-block.ts";

/** 拼一个 pi 形状的技能块，location 可指定（默认走 Windows 反斜杠 + 中文路径）。 */
function skillBlock(
	name: string,
	location = `C:\\Users\\我 的文档\\.kamibuddy\\skills\\${name}\\SKILL.md`,
	body = `做 ${name} 相关的事。`,
): string {
	return `<skill name="${name}" location="${location}">\nReferences are relative to ${location.replace(/\\[^\\]+$/, "")}.\n\n${body}\n</skill>`;
}

describe("splitSkillBlocks", () => {
	it("单块 + 补充文本：剥出技能名，text 只剩用户自己打的那句", () => {
		const out = splitSkillBlocks(`${skillBlock("docx")}\n\n帮我做一份周报`);
		expect(out.skillNames).toEqual(["docx"]);
		expect(out.text).toBe("帮我做一份周报");
		// 正文与内部绝对路径不许漏进展示文本。
		expect(out.text).not.toContain("References are relative");
		expect(out.text).not.toContain("SKILL.md");
	});

	it("连续多块：名字按出现顺序收集，text 只剩末尾的补充文本", () => {
		const out = splitSkillBlocks(`${skillBlock("docx")}\n\n${skillBlock("xlsx")}\n\n两份都要`);
		expect(out.skillNames).toEqual(["docx", "xlsx"]);
		expect(out.text).toBe("两份都要");
	});

	it("无块：skillNames 为空数组，text 原样返回（不做 trim、不动一个字符）", () => {
		const raw = " 你好，这是普通消息 \n";
		const out = splitSkillBlocks(raw);
		expect(out.skillNames).toEqual([]);
		expect(out.text).toBe(raw);
	});

	it("`<skill` 出现在正文中部：不剥，整条按普通文本展示", () => {
		const raw = "我在文档里看到 <skill name=\"docx\" location=\"D:\\a\\SKILL.md\"> 这个标签，是什么意思？";
		const out = splitSkillBlocks(raw);
		expect(out.skillNames).toEqual([]);
		expect(out.text).toBe(raw);
	});

	it("`</skill>` 之后没有补充文本：text 为空串（调用方据此只渲染胶囊行）", () => {
		const out = splitSkillBlocks(skillBlock("docx"));
		expect(out.skillNames).toEqual(["docx"]);
		expect(out.text).toBe("");
	});

	it("location 含 Windows 反斜杠、中文与空格：照常剥出（属性值用 [^\\\"]* 匹配）", () => {
		const out = splitSkillBlocks(
			`<skill name="equity-research" location="C:\\Program Files\\KamiBuddy\\技能 库\\equity-research\\SKILL.md">\n参考路径以技能目录为基准。\n\n正文\n</skill>\n\n看看这家公司`,
		);
		expect(out.skillNames).toEqual(["equity-research"]);
		expect(out.text).toBe("看看这家公司");
	});

	it("属性顺序无关：location 写在 name 前面同样剥得出", () => {
		const out = splitSkillBlocks(
			'<skill location="D:\\s\\SKILL.md" name="typeset">\n基准行\n\n正文\n</skill>\n\n排版一下',
		);
		expect(out.skillNames).toEqual(["typeset"]);
		expect(out.text).toBe("排版一下");
	});

	it("缺 name 属性 / 未闭合的开标签：不当技能块，原样返回（宁可显示也不能吃掉用户文字）", () => {
		const noName = '<skill location="D:\\s\\SKILL.md">\n正文\n</skill>\n\n补充';
		expect(splitSkillBlocks(noName)).toEqual({ skillNames: [], text: noName });

		const unclosed = '<skill name="docx" location="D:\\s\\SKILL.md">\n没闭合';
		expect(splitSkillBlocks(unclosed)).toEqual({ skillNames: [], text: unclosed });
	});

	it("`<skills>` 这类同前缀文本不算技能块", () => {
		const raw = "<skills>readme</skills>\n\n正文";
		expect(splitSkillBlocks(raw)).toEqual({ skillNames: [], text: raw });
	});
});

describe("bareSkillName", () => {
	it("去掉 skill: 命名空间前缀，得到 chip 上要显示的裸名", () => {
		expect(bareSkillName(`${SKILL_COMMAND_PREFIX}docx`)).toBe("docx");
		// 名字本身可含连字符（skill-install 的 NAME_RE 允许），只切前缀那一段。
		expect(bareSkillName(`${SKILL_COMMAND_PREFIX}frontend-design`)).toBe("frontend-design");
	});

	it("不是技能形态的名字原样返回（宁可显示原值也不静默吞掉）", () => {
		expect(bareSkillName("weekly")).toBe("weekly");
	});
});

describe("skillInvocationText", () => {
	it("无技能：原样返回文本（重试/复制在普通消息上行为不变）", () => {
		expect(skillInvocationText([], "帮我做一份周报")).toBe("帮我做一份周报");
	});

	it("单技能 + 补充文本：拼回 /skill:<name> <文本>，分隔用空格", () => {
		expect(skillInvocationText(["docx"], "帮我做一份周报")).toBe("/skill:docx 帮我做一份周报");
	});

	it("只有技能、没有补充文本：只拼命令本身（复制不再是空串）", () => {
		expect(skillInvocationText(["docx"], "")).toBe("/skill:docx");
	});

	it("拆分与拼回互为逆运算，且拼出来的串必须能被 pi 按第一个空格切出技能名", () => {
		const raw = `${skillBlock("docx")}\n\n帮我做一份周报`;
		const split = splitSkillBlocks(raw);
		const rebuilt = skillInvocationText(split.skillNames, split.text);

		// pi 的切法（agent-session.js:986-988）：第一个空格前是名字，其后是参数。
		const space = rebuilt.indexOf(" ");
		expect(rebuilt.slice(7, space)).toBe("docx");
		expect(rebuilt.slice(space + 1)).toBe("帮我做一份周报");
	});
});
