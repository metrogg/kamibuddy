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

/*
 * 预热 pi 的惰性装配（业务见 daemon/index.ts 顶部的惰性说明）：被测的
 * buildPromptPreview → assembleSystemPrompt → 技能段首用时才 `await import("pi")`，
 * 而本文件没有静态 import 它 —— 不预热的话第一个用例会替整个 vitest worker 付一次
 * 整包装配（本机实测 2~8s），撞 vitest 默认 5s 的用例超时。顶层 await 发生在
 * 收集阶段（无超时预算），装好后用例只测逻辑。
 */
await import("@earendil-works/pi-coding-agent");

/** 内存 fixtures：LoadedResources 是纯接口，预览逻辑不读盘，无需临时目录。 */
function makeResources(): LoadedResources {
	return {
		scenes: [
			{
				id: "work",
				label: "日常办公",
				description: "办公",
				ready: true,
				body: "办公骨架\n\n{{interaction}}\n\n{{skills}}",
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
			// plan 的工具白名单没有 read / bash / use_skill —— 技能段门控的反侧用例。
			{ id: "plan", label: "计划", description: "", ready: true, tools: ["grep"], body: "计划行为段" },
			// 只有 use_skill（没有 read / bash）：门控扩到三词后的正侧用例。
			{ id: "skill-only", label: "技能", description: "", ready: true, tools: ["use_skill"], body: "技能行为段" },
		],
		styles: [
			{ id: "professional", label: "专业严谨", body: "专业风格正文" },
			{ id: "sarcastic", label: "毒舌", body: "毒舌风格正文" },
		],
		fragments: new Map([["delivery-rules", "交付纪律内容"]]),
		welcome: { chips: [], cases: [] },
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
		expertType: "expert",
		agents: [],
		body: "你是工作汇报专家，先问清受众再搭结构。",
	},
];

function makeEnv(overrides: Partial<PromptPreviewEnvironment> = {}): PromptPreviewEnvironment {
	return {
		skills: SKILLS,
		experts: EXPERTS,
		preferredStyleId: undefined,
		...overrides,
	};
}

describe("分段映射", () => {
	it("chars 与 totalChars 自洽，分段顺序拼接即完整提示词", async () => {
		const result = await buildPromptPreview(
			makeResources(),
			{ sceneId: "work", modeId: "craft", styleId: "professional" },
			makeEnv(),
		);
		const joined = result.segments.map((s) => s.text).join("");
		for (const seg of result.segments) expect(seg.chars).toBe(seg.text.length);
		expect(result.totalChars).toBe(joined.length);
		// 结构骨架：skeleton 开头、skills 收尾（craft 白名单含 read，技能段注入）。
		expect(result.segments[0]?.source).toBe("skeleton");
		expect(result.segments[result.segments.length - 1]?.source).toBe("skills");
	});

	it("预览只产出系统提示词分段：逐轮可变事实与 cwd 都不在里面", async () => {
		// 记忆内容 / 个性化走 prompt-switch 的 `context` 事件注入，时间与时区行、
		// 工作目录走会话侧 hidden context（current_time / workspace_context）——
		// 预览（= 系统提示词）里都不该出现（spec: stabilize-prompt-prefix）。
		// 末尾那条是旧格式（曾有过的英文时间行）的回归钉子：时间不许以任何形态回来。
		const result = await buildPromptPreview(
			makeResources(),
			{ sceneId: "work", modeId: "craft", styleId: "" },
			makeEnv(),
		);
		for (const seg of result.segments) {
			expect(seg.source).not.toBe("time");
			expect(seg.source).not.toBe("memory");
			expect(seg.source).not.toBe("personalization");
		}
		expect(result.segments.map((s) => s.text).join("")).not.toMatch(/Current time:/);
	});

	it("片段引用产出 fragment:<名> 段", async () => {
		const result = await buildPromptPreview(
			makeResources(),
			{ sceneId: "code", modeId: "ask", styleId: "" },
			makeEnv(),
		);
		const fragment = result.segments.find((s) => s.source === "fragment:delivery-rules");
		expect(fragment?.text).toContain("交付纪律内容");
	});
});

describe("styleId 三态", () => {
	it("指定 id 注入对应风格段", async () => {
		const result = await buildPromptPreview(
			makeResources(),
			{ sceneId: "work", modeId: "craft", styleId: "sarcastic" },
			makeEnv(),
		);
		expect(result.segments.some((s) => s.source === "style:sarcastic")).toBe(true);
	});

	it("空串 = 关闭，无风格段", async () => {
		const result = await buildPromptPreview(
			makeResources(),
			{ sceneId: "work", modeId: "craft", styleId: "" },
			makeEnv(),
		);
		expect(result.segments.some((s) => s.source.startsWith("style:"))).toBe(false);
	});

	it("缺省 = 跟随当前偏好（偏好 sarcastic → style:sarcastic）", async () => {
		const result = await buildPromptPreview(
			makeResources(),
			{ sceneId: "work", modeId: "craft" },
			makeEnv({ preferredStyleId: "sarcastic" }),
		);
		expect(result.segments.some((s) => s.source === "style:sarcastic")).toBe(true);
	});

	it("缺省且偏好未配置 → 回落默认风格 professional", async () => {
		const result = await buildPromptPreview(
			makeResources(),
			{ sceneId: "work", modeId: "craft" },
			makeEnv({ preferredStyleId: undefined }),
		);
		expect(result.segments.some((s) => s.source === "style:professional")).toBe(true);
	});
});

describe("技能段门控（与真实组装同一条 read/bash/use_skill 规则）", () => {
	it("craft（含 read）注入技能段", async () => {
		const result = await buildPromptPreview(
			makeResources(),
			{ sceneId: "work", modeId: "craft", styleId: "" },
			makeEnv(),
		);
		const skills = result.segments.find((s) => s.source === "skills");
		expect(skills?.text).toContain("meeting-notes");
	});

	it("只有 use_skill（无 read/bash）也注入 —— 镜像口径与 skillsSectionForMode 一致", async () => {
		const result = await buildPromptPreview(
			makeResources(),
			{ sceneId: "work", modeId: "skill-only", styleId: "" },
			makeEnv(),
		);
		const skills = result.segments.find((s) => s.source === "skills");
		expect(skills?.text).toContain("meeting-notes");
		// 与真实组装同一句调用约定（同一条 formatSkillsSection）。
		expect(skills?.text).toContain("优先调用 use_skill");
	});

	it("plan（无 read/bash/use_skill）不注入技能段", async () => {
		const result = await buildPromptPreview(
			makeResources(),
			{ sceneId: "work", modeId: "plan", styleId: "" },
			makeEnv(),
		);
		expect(result.segments.some((s) => s.source === "skills")).toBe(false);
	});

	it("disable-model-invocation 的技能不进预览技能段（与真实组装同一过滤）", async () => {
		const result = await buildPromptPreview(
			makeResources(),
			{ sceneId: "work", modeId: "craft", styleId: "" },
			makeEnv({
				skills: [
					...SKILLS,
					{
						name: "typeset",
						description: "内部排版子技能",
						filePath: "/skills/typeset/SKILL.md",
						disableModelInvocation: true,
					},
				],
			}),
		);
		const skills = result.segments.find((s) => s.source === "skills");
		expect(skills?.text).toContain("meeting-notes");
		expect(skills?.text).not.toContain("typeset");
	});
});

describe("专家人格注入（与真实组装同一条路径）", () => {
	it("传 expertId 注入人格段（前部 expert 段 + 末尾钉子段），风格让位于人格", async () => {
		const result = await buildPromptPreview(
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

	it("缺省 expertId 不注入人格段", async () => {
		const result = await buildPromptPreview(
			makeResources(),
			{ sceneId: "work", modeId: "craft", styleId: "" },
			makeEnv(),
		);
		expect(result.segments.some((s) => s.source === "expert")).toBe(false);
	});

	it("expertId 指向不存在的专家 → 响亮报错（预览不做漂移容忍）", async () => {
		await expect(
			buildPromptPreview(
				makeResources(),
				{ sceneId: "work", modeId: "craft", expertId: "ghost" },
				makeEnv(),
			),
		).rejects.toThrow(/不在专家库中/);
	});
});

describe("专家私有技能进预览技能段（daemon 需把专家的 skillsDir 传给 listSkills）", () => {
	/*
	 * 专家带私有技能目录时，daemon 的 listSkills(expert.skillsDir) 会在全局池后追加
	 * 该目录（同 core/prompt-composer.ts sessionSkillPaths）。env.skills 是 daemon 现读的
	 * 受控产物：绑定专家 = 全局 + 私有，未绑定 = 仅全局。这里钉住预览在该输入下的表现
	 * —— 曾经 daemon 漏传 skillsDir，预览就看不到专家的 3 个私有技能。
	 */
	const EXPERT_WITH_SKILLS: readonly ExpertDefinition[] = [
		{
			name: "stock-research-report",
			description: "写证券研报",
			displayName: "证券研报专家",
			profession: "证券研究",
			displayDescription: "从财务数据到估值结论出研报",
			quickPrompts: ["出一份研报", "做同业对比", "给个估值结论"],
			tags: ["研报", "估值", "券商"],
		source: "builtin",
		expertType: "expert",
		agents: [],
		// 专家私有技能目录：daemon 绑定该专家时应把它追加进 listSkills 的加载路径。
		skillsDir: "/experts/stock-research-report/skills",
			body: "你是证券研报专家，结论必须能追溯到数据。",
		},
	];
	const SKILLS_WITH_PRIVATE: readonly SkillDescriptor[] = [
		...SKILLS,
		{ name: "dcf-model-builder", description: "DCF 估值建模", filePath: "/experts/stock-research-report/skills/dcf-model-builder/SKILL.md" },
	];

	it("绑定专家：技能段含该专家的私有技能（人格段同现）", async () => {
		const result = await buildPromptPreview(
			makeResources(),
			{ sceneId: "work", modeId: "craft", styleId: "", expertId: "stock-research-report" },
			makeEnv({ experts: EXPERT_WITH_SKILLS, skills: SKILLS_WITH_PRIVATE }),
		);
		const skills = result.segments.find((s) => s.source === "skills");
		expect(skills?.text).toContain("dcf-model-builder");
		expect(result.segments.some((s) => s.source === "expert")).toBe(true);
	});

	it("未绑定专家：技能段不含私有技能（daemon 只现读全局池）", async () => {
		const result = await buildPromptPreview(
			makeResources(),
			{ sceneId: "work", modeId: "craft", styleId: "" },
			makeEnv({ experts: EXPERT_WITH_SKILLS, skills: SKILLS }),
		);
		const skills = result.segments.find((s) => s.source === "skills");
		expect(skills?.text).not.toContain("dcf-model-builder");
	});
});

describe("非法输入响亮报错", () => {
	it("未知场景", async () => {
		await expect(
			buildPromptPreview(makeResources(), { sceneId: "nope", modeId: "craft" }, makeEnv()),
		).rejects.toThrow(/未知场景/);
	});

	it("未知交互模式", async () => {
		await expect(
			buildPromptPreview(makeResources(), { sceneId: "work", modeId: "nope" }, makeEnv()),
		).rejects.toThrow(/未知交互模式/);
	});

	it("未知回复风格（指定 id 不做漂移容忍）", async () => {
		await expect(
			buildPromptPreview(
				makeResources(),
				{ sceneId: "work", modeId: "craft", styleId: "nope" },
				makeEnv(),
			),
		).rejects.toThrow(/未知回复风格/);
	});
});
