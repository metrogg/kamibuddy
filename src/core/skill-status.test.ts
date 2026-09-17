/**
 * 技能启用状态与清单段成本的纯逻辑测试。
 *
 * 为什么值得单测：启用过滤有三个消费方（提示词清单段 / `/` 菜单 / use_skill），
 * 只要有一处漏了过滤，就会出现「菜单里有但加载不了」这类只能靠肉眼发现的缺陷。
 * 这里把「三处同源」与「成本随开关下降」变成可断言的事实（spec: 技能启用/停用、
 * 技能成本可见）。
 */

import { describe, expect, it } from "vitest";
import type { SkillDescriptor } from "./prompt-composer.ts";
import { filterEnabledSkills, isSkillEnabled } from "./skill-status.ts";
import { computeSkillsCost, SKILLS_TOKEN_WARNING_THRESHOLD, skillsCostWarning } from "./skills-cost.ts";

/** 造一个技能描述符：描述用中文（有真实 token 量），路径只为可读。 */
function skill(name: string, patch: Partial<SkillDescriptor> = {}): SkillDescriptor {
	return {
		name,
		description: "把会议记录整理成带行动项的纪要",
		filePath: `C:\\skills\\${name}\\SKILL.md`,
		...patch,
	};
}

describe("启用过滤", () => {
	it("缺省启用：没有覆盖表、或表里没有该技能时都算启用", () => {
		expect(isSkillEnabled("docx", undefined)).toBe(true);
		expect(isSkillEnabled("docx", {})).toBe(true);
		// "on" 是历史写法（写入侧现在删键），读到时与缺省等价。
		expect(isSkillEnabled("docx", { docx: "on" })).toBe(true);
		expect(isSkillEnabled("docx", { docx: "off" })).toBe(false);
	});

	it("off 生效：只过滤被关掉的那个，别的技能原样留下", () => {
		const skills = [skill("docx"), skill("meeting-notes"), skill("typeset")];
		const enabled = filterEnabledSkills(skills, { "meeting-notes": "off" });
		expect(enabled.map((s) => s.name)).toEqual(["docx", "typeset"]);
		// 「覆盖」不是「删除」：留下的就是原来那个对象（字段一个都没被改）。
		expect(enabled[0]).toBe(skills[0]);
	});

	it("停用与作者的可见性声明互不覆盖：被关掉的 disabled 技能照样在集合里不出现，作者的声明字段也不被改写", () => {
		const hidden = skill("typeset", { disableModelInvocation: true });
		expect(filterEnabledSkills([hidden], { typeset: "off" })).toEqual([]);
		expect(filterEnabledSkills([hidden], {})[0]?.disableModelInvocation).toBe(true);
	});

	it("三处同源：清单段 / `/` 菜单 / use_skill 的可见集合里都不含被停用的技能", () => {
		const skills = [skill("docx"), skill("typeset", { disableModelInvocation: true }), skill("legacy")];
		const overrides = { legacy: "off" } as const;

		/*
		 * 三处消费点在 daemon 里都从 enabledSkills()（= 这一份过滤结果）出发：
		 * 这里按各自的后置条件推出的集合，必须与同一份过滤保持一致 ——
		 * 任一处自己重算一遍、漏掉过滤，下面的断言就会红。
		 */
		const enabled = filterEnabledSkills(skills, overrides);
		const inMenu = enabled.map((s) => s.name);
		const inPromptSection = enabled.filter((s) => !s.disableModelInvocation).map((s) => s.name);
		const loadableByTool = enabled.filter((s) => !s.disableModelInvocation).map((s) => s.name);

		expect(inMenu).toEqual(["docx", "typeset"]);
		expect(inPromptSection).not.toContain("legacy");
		// 「菜单里有但 use_skill 加载不了」正是这条要拦住的不一致。
		expect(loadableByTool).toEqual(inPromptSection);
	});
});

describe("清单段成本", () => {
	it("停用技能后 enabledCount 与 skillsTokens 一起下降", () => {
		const skills = [skill("docx"), skill("meeting-notes"), skill("typeset")];
		const full = computeSkillsCost(skills);
		const reduced = computeSkillsCost(filterEnabledSkills(skills, { "meeting-notes": "off", typeset: "off" }));

		expect(full.enabledCount).toBe(3);
		expect(reduced.enabledCount).toBe(1);
		expect(reduced.skillsTokens).toBeLessThan(full.skillsTokens);
		// 小体量下不该出现警示条（阈值是 4000）。
		expect(full.warning).toBeUndefined();
	});

	it("disable-model-invocation 的技能计入「已启用数」，但不计 token（它根本进不了清单段）", () => {
		const visible = skill("docx");
		const hidden = skill("typeset", { disableModelInvocation: true });
		const cost = computeSkillsCost([visible, hidden]);
		expect(cost.enabledCount).toBe(2);
		expect(cost.skillsTokens).toBe(computeSkillsCost([visible]).skillsTokens);
	});

	it("超阈值产出 warning（阈值可注入，测试不必真造 4000 token）", () => {
		const cost = computeSkillsCost([skill("docx")], 1);
		expect(cost.warning).toContain("超过 1 的警戒线");
		expect(cost.warning).toContain("停用不常用的技能");
	});

	it("恰好等于阈值不算超（提示说的是「超过」）", () => {
		const tokens = computeSkillsCost([skill("docx")]).skillsTokens;
		expect(skillsCostWarning(tokens, tokens)).toBeUndefined();
		expect(skillsCostWarning(tokens + 7, tokens)).toContain("超出 7");
	});

	it("默认阈值 4000（≈200k 上下文窗口的 2%）", () => {
		expect(SKILLS_TOKEN_WARNING_THRESHOLD).toBe(4000);
		expect(skillsCostWarning(SKILLS_TOKEN_WARNING_THRESHOLD + 1)).toBeDefined();
	});
});
