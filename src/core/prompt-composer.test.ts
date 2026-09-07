/**
 * 提示词组装的测试。
 *
 * 组装器是「模型看到什么」的唯一来源，错一处就是产品身份错一处。
 * 重点钉住：槽位替换、未知槽位抛错（防 {{xxx}} 空洞上线）、
 * 残留槽位抛错（防模式正文里误写槽位）、空技能段零残留。
 */

import { describe, expect, it } from "vitest";
import { composePrompt, formatSkillsSection } from "./prompt-composer.ts";

const BASE = {
	sceneBody: "你是 KamiBuddy。\n\n# 模式\n{{interaction}}\n{{skills}}\n目录：{{cwd}}",
	modeBody: "创作模式行为段。",
	skillsSection: "",
	cwd: "C:\\ws",
};

describe("槽位替换", () => {
	it("四个槽位全部替换", () => {
		const out = composePrompt({ ...BASE, skillsSection: "可用技能：\n- a：测试", model: "GLM" });
		expect(out).toContain("创作模式行为段。");
		expect(out).toContain("可用技能：\n- a：测试");
		expect(out).toContain("目录：C:\\ws");
		expect(out).not.toContain("{{");
	});

	it("骨架未使用某槽位（如 {{model}}）不报错", () => {
		// 骨架用多少槽位是场景作者的自由；composer 只要求「出现的都能填」。
		expect(() => composePrompt(BASE)).not.toThrow();
		expect(composePrompt(BASE)).not.toContain("GLM");
	});

	it("空技能段压平多余空行，不留 {{skills}} 痕迹", () => {
		const out = composePrompt(BASE);
		expect(out).not.toContain("{{skills}}");
		// 压平后不应出现三个以上连续换行。
		expect(out).not.toMatch(/\n{3,}/);
	});
});

describe("报错路径", () => {
	it("骨架里出现未支持的 ASCII 槽位 → 抛错并列出支持项", () => {
		expect(() =>
			composePrompt({ ...BASE, sceneBody: "你好 {{user_name}}" }),
		).toThrow(/未支持的槽位/);
	});

	it("非 ASCII 的花括号写法（{{中文}}）也必须被拦下", () => {
		// 这类写法不匹配替换正则，但同样不能活着到达模型 —— 由残留检查兜住。
		expect(() => composePrompt({ ...BASE, sceneBody: "你好 {{用户名字}}" })).toThrow(/槽位/);
	});

	it("模式正文里误写槽位 → 残留检查抛错", () => {
		// 正文是行为指令，不是模板；出现 {{...}} 就是笔误，不能放给模型。
		expect(() =>
			composePrompt({ ...BASE, modeBody: "记得 {{cwd}} 就是工作目录" }),
		).toThrow(/残留槽位/);
	});
});

describe("formatSkillsSection", () => {
	it("无技能返回空串（零 token）", () => {
		expect(formatSkillsSection([])).toBe("");
	});

	it("有技能输出清单", () => {
		const section = formatSkillsSection([
			{ name: "周报生成", description: "把要点整理成周报" },
		]);
		expect(section).toBe("可用技能：\n- 周报生成：把要点整理成周报");
	});
});
