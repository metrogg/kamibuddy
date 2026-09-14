/**
 * prompt:preview 纯逻辑（buildPromptPreview）的测试。
 *
 * 钉住的是预览与真实组装的**差异面**与**校验面**（daemon 组装路径本身由
 * prompt-composer 的测试压着）：非法 id 响亮报错、styleId 三态、
 * 技能段门控、专家人格注入（传 expertId 注入 / 不传不注入 / 不存在报错）、
 * 分段字数映射。
 */

import { describe, expect, it } from "vitest";
import type { LoadedResources } from "../core/resources.ts";
import type { ExpertDefinition } from "../core/experts.ts";
import type { SkillDescriptor } from "../core/prompt-composer.ts";
import {
	buildPromptPreview,
	type PromptPreviewEnvironment,
} from "./prompt-preview.ts";

/** 内存 fixtures：LoadedResources 是纯接口，预览逻辑不读盘，无需临时目录。 */
function makeResources(): LoadedResources {
	return {
		scenes: [
			{
				id: "work",
				label: "日常办公",
				description: "办公",
				ready: true,
				body: "办公骨架\n\n{{interaction}}\n\n{{skills}}\n\n目录：{{cwd}}",
			},
			{
				id: "code",
				label: "代码开发",
				description: "代码",
				ready: true,
				body: "代码骨架\n\n{{> delivery-rules}}\n\n{{interaction}}",
			},
		],
		// modes/ 已无 expert（专家是与模式正交的会话绑定，spec:
		// rework-expert-orthogonal-and-skills），这里只留 ask / craft / plan。
		modes: [
			{ id: "ask", label: "问答", description: "", ready: true, tools: ["read"], body: "问答行为段" },
			{ id: "craft", label: "创作", description: "", ready: true, tools: ["read", "write"], body: "创作行为段" },
			// plan 的工具白名单没有 read / bash —— 技能段门控的反侧用例。
			{ id: "plan", label: "计划", description: "", ready: true, tools: ["grep"], body: "计划行为段" },
		],
		styles: [
			{ id: "professional", label: "专业严谨", body: "专业风格正文" },
			{ id: "sarcastic", label: "毒舌", body: "毒舌风格正文" },
		],
		fragments: new Map([["delivery-rules", "交付纪律内容"]]),
	};
}

const SKILLS: readonly SkillDescriptor[] = [
	{ name: "meeting-notes", description: "会议纪要", filePath: "/skills/meeting-notes/SKILL.md" },
];

/** 专家库 fixture：预览按 expertId 从它解析人格（与 daemon loadExpertsNow 同结构）。 */
const EXPERTS: readonly ExpertDefinition[] = [
	{
		name: "work-report",
		description: "写工作汇报",
		displayName: "工作汇报专家",
		profession: "职场写作",
		displayDescription: "把零散进展整理成结构清晰的汇报",
		quickPrompts: ["写周报", "写月报", "写述职"],
		tags: ["汇报", "周报", "职场"],
		source: "builtin",
		body: "你是工作汇报专家，先问清受众再搭结构。",
	},
];

function makeEnv(overrides: Partial<PromptPreviewEnvironment> = {}): PromptPreviewEnvironment {
	return { cwd: "/tmp/work", skills: SKILLS, experts: EXPERTS, preferredStyleId: undefined, ...overrides };
}

describe("分段映射", () => {
	it("chars 与 totalChars 自洽，分段顺序拼接即完整提示词", () => {
		const result = buildPromptPreview(
			makeResources(),
			{ sceneId: "work", modeId: "craft", styleId: "professional" },
			makeEnv(),
		);
		const joined = result.segments.map((s) => s.text).join("");
		for (const seg of result.segments) expect(seg.chars).toBe(seg.text.length);
		expect(result.totalChars).toBe(joined.length);
		// 结构骨架：skeleton 开头、time 收尾（prompt-composer 的位序语义）。
		expect(result.segments[0]?.source).toBe("skeleton");
		expect(result.segments[result.segments.length - 1]?.source).toBe("time");
	});

	it("片段引用产出 fragment:<名> 段", () => {
		const result = buildPromptPreview(
			makeResources(),
			{ sceneId: "code", modeId: "ask", styleId: "" },
			makeEnv(),
		);
		const fragment = result.segments.find((s) => s.source === "fragment:delivery-rules");
		expect(fragment?.text).toContain("交付纪律内容");
	});
});

describe("styleId 三态", () => {
	it("指定 id 注入对应风格段", () => {
		const result = buildPromptPreview(
			makeResources(),
			{ sceneId: "work", modeId: "craft", styleId: "sarcastic" },
			makeEnv(),
		);
		expect(result.segments.some((s) => s.source === "style:sarcastic")).toBe(true);
	});

	it("空串 = 关闭，无风格段", () => {
		const result = buildPromptPreview(
			makeResources(),
			{ sceneId: "work", modeId: "craft", styleId: "" },
			makeEnv(),
		);
		expect(result.segments.some((s) => s.source.startsWith("style:"))).toBe(false);
	});

	it("缺省 = 跟随当前偏好（偏好 sarcastic → style:sarcastic）", () => {
		const result = buildPromptPreview(
			makeResources(),
			{ sceneId: "work", modeId: "craft" },
			makeEnv({ preferredStyleId: "sarcastic" }),
		);
		expect(result.segments.some((s) => s.source === "style:sarcastic")).toBe(true);
	});

	it("缺省且偏好未配置 → 回落默认风格 professional", () => {
		const result = buildPromptPreview(
			makeResources(),
			{ sceneId: "work", modeId: "craft" },
			makeEnv({ preferredStyleId: undefined }),
		);
		expect(result.segments.some((s) => s.source === "style:professional")).toBe(true);
	});
});

describe("技能段门控（与真实组装同一条 read/bash 规则）", () => {
	it("craft（含 read）注入技能段", () => {
		const result = buildPromptPreview(
			makeResources(),
			{ sceneId: "work", modeId: "craft", styleId: "" },
			makeEnv(),
		);
		const skills = result.segments.find((s) => s.source === "skills");
		expect(skills?.text).toContain("meeting-notes");
	});

	it("plan（无 read/bash）不注入技能段", () => {
		const result = buildPromptPreview(
			makeResources(),
			{ sceneId: "work", modeId: "plan", styleId: "" },
			makeEnv(),
		);
		expect(result.segments.some((s) => s.source === "skills")).toBe(false);
	});
});

describe("专家人格注入（与真实组装同一条路径）", () => {
	it("传 expertId 注入人格段（前部 expert 段 + 末尾钉子段），风格让位于人格", () => {
		const result = buildPromptPreview(
			makeResources(),
			{ sceneId: "work", modeId: "craft", styleId: "sarcastic", expertId: "work-report" },
			makeEnv(),
		);
		const expertSegs = result.segments.filter((s) => s.source === "expert");
		expect(expertSegs.length).toBeGreaterThan(0);
		expect(expertSegs.some((s) => s.text.includes("工作汇报专家"))).toBe(true);
		expect(expertSegs.some((s) => s.text.includes("current-expert"))).toBe(true);
		// 选定专家后风格让位（composer 语义），预览与真实会话一致。
		expect(result.segments.some((s) => s.source.startsWith("style:"))).toBe(false);
	});

	it("缺省 expertId 不注入人格段", () => {
		const result = buildPromptPreview(
			makeResources(),
			{ sceneId: "work", modeId: "craft", styleId: "" },
			makeEnv(),
		);
		expect(result.segments.some((s) => s.source === "expert")).toBe(false);
	});

	it("expertId 指向不存在的专家 → 响亮报错（预览不做漂移容忍）", () => {
		expect(() =>
			buildPromptPreview(
				makeResources(),
				{ sceneId: "work", modeId: "craft", expertId: "ghost" },
				makeEnv(),
			),
		).toThrow(/不在专家库中/);
	});
});

describe("非法输入响亮报错", () => {
	it("未知场景", () => {
		expect(() =>
			buildPromptPreview(makeResources(), { sceneId: "nope", modeId: "craft" }, makeEnv()),
		).toThrow(/未知场景/);
	});

	it("未知交互模式", () => {
		expect(() =>
			buildPromptPreview(makeResources(), { sceneId: "work", modeId: "nope" }, makeEnv()),
		).toThrow(/未知交互模式/);
	});

	it("未知回复风格（指定 id 不做漂移容忍）", () => {
		expect(() =>
			buildPromptPreview(
				makeResources(),
				{ sceneId: "work", modeId: "craft", styleId: "nope" },
				makeEnv(),
			),
		).toThrow(/未知回复风格/);
	});
});
