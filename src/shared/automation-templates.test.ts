import { describe, expect, it } from "vitest";
import { AUTOMATION_TEMPLATES } from "./automation-templates.ts";
import { scheduleSummary, validateSchedule } from "./automation.ts";

describe("AUTOMATION_TEMPLATES（内置模板库）", () => {
	it("至少 5 个模板，id 唯一", () => {
		expect(AUTOMATION_TEMPLATES.length).toBeGreaterThanOrEqual(5);
		const ids = AUTOMATION_TEMPLATES.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("每个模板的调度都合法（选下来就能存，不用先修参数）", () => {
		for (const template of AUTOMATION_TEMPLATES) {
			expect(validateSchedule(template.schedule), template.id).toBeUndefined();
		}
	});

	it("每个模板的提示词自包含：非空且不引用对话上下文", () => {
		for (const template of AUTOMATION_TEMPLATES) {
			expect(template.prompt.trim().length, template.id).toBeGreaterThan(10);
			// 任务独立运行看不到对话 —— 提示词里不该出现这类指代。
			expect(template.prompt, template.id).not.toMatch(/当前对话|我们的对话|上面提到/);
		}
	});

	it("描述与调度摘要非空（选择浮层的卡片文案）", () => {
		for (const template of AUTOMATION_TEMPLATES) {
			expect(template.description.trim()).not.toBe("");
			expect(scheduleSummary(template.schedule).trim()).not.toBe("");
		}
	});
});
