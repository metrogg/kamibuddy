/**
 * 提示词组装的测试。
 *
 * 组装器是「模型看到什么」的唯一来源，错一处就是产品身份错一处。
 * 重点钉住：槽位替换、未知槽位抛错（防 {{xxx}} 空洞上线）、
 * 残留槽位抛错（防模式正文里误写槽位）、空技能段零残留。
 */

import { describe, expect, it } from "vitest";
import {
	composePrompt,
	composePromptWithMeta,
	composeSubagentPrompt,
	formatRuntimeTime,
	formatSkillsSection,
	requireExpertPersona,
} from "./prompt-composer.ts";
import type { ExpertDefinition } from "./experts.ts";

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

describe("补回 pi 上下文与工具提示", () => {
	it("把 pi 已加载的项目上下文文件拼进最终提示词", () => {
		const out = composePrompt({
			...BASE,
			piContext: {
				contextFiles: [
					{ path: "C:\\project\\AGENTS.md", content: "这是项目约定" },
				],
			},
		});
		expect(out).toContain("<project_context>");
		expect(out).toContain('path="C:\\project\\AGENTS.md"');
		expect(out).toContain("这是项目约定");
		expect(out).toContain("</project_context>");
	});

	it("把工具 snippet 与 guidelines 拼进最终提示词", () => {
		const out = composePrompt({
			...BASE,
			piContext: {
				toolSnippets: { web_search: "需要实时信息时先搜索" },
				promptGuidelines: ["一次搜索失败可换措辞重试一次"],
			},
		});
		expect(out).toContain("Available tools:");
		expect(out).toContain("- web_search: 需要实时信息时先搜索");
		expect(out).toContain("Guidelines:");
		expect(out).toContain("- 一次搜索失败可换措辞重试一次");
	});

	it("没有上下文与工具提示时不追加任何段落（保持现状兼容）", () => {
		expect(composePrompt(BASE)).not.toContain("<project_context>");
		expect(composePrompt(BASE)).not.toContain("Available tools:");
	});
});

describe("运行时环境块", () => {
	// 时区名随测试机走（开发机 Asia/Shanghai、CI 可能 Asia/Hong_Kong），
	// 但同一天 GMT+8 内日期/星期/时刻/偏移的断言是确定的。
	const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
	it("固定 now：环境块含日期、分钟级时刻、星期、GMT 偏移与 IANA 时区名", () => {
		const out = composePrompt({ ...BASE, now: new Date("2026-09-09T23:18:30+08:00") });
		expect(out).toContain(
			`Current time: 2026-09-09 23:18 (Wednesday, GMT+8, ${localTz})`,
		);
	});

	it("环境块在整个提示词的末尾（前缀稳定利于 provider 缓存）", () => {
		const out = composePrompt({
			...BASE,
			now: new Date("2026-09-09T23:18:30+08:00"),
			piContext: { promptGuidelines: ["一条指引"] },
		});
		expect(out.trimEnd().endsWith(`(Wednesday, GMT+8, ${localTz})`)).toBe(true);
	});

	it("now 缺省时取当前时间（只断言形态，不钉值）", () => {
		expect(composePrompt(BASE)).toMatch(
			/Current time: \d{4}-\d{2}-\d{2} \d{2}:\d{2} \(\w+day, GMT[+-]\d+(:\d{2})?, .+\)/,
		);
	});

	it("分钟级精度：同一分钟内不同秒的两次组装字节相等（不炸缓存）", () => {
		const a = composePrompt({ ...BASE, now: new Date("2026-09-09T23:18:01+08:00") });
		const b = composePrompt({ ...BASE, now: new Date("2026-09-09T23:18:59+08:00") });
		expect(a).toBe(b);
	});

	it("formatRuntimeTime 直出与 composePrompt 内嵌文本一致", () => {
		const now = new Date("2026-09-09T23:18:30+08:00");
		expect(composePrompt({ ...BASE, now })).toContain(formatRuntimeTime(now));
	});
});

describe("expert 人格注入", () => {
	const EXPERT = {
		displayName: "工作周报",
		profession: "职场汇报写作专家",
		body: "# 工作汇报写作专家\n\n## 角色定义\n\n你是一位高管教练。",
	};

	it("注入人格段：displayName / profession / 正文全文都在输出里", () => {
		const out = composePrompt({ ...BASE, expert: EXPERT });
		expect(out).toContain("## 当前专家");
		expect(out).toContain("工作周报（职场汇报写作专家）");
		expect(out).toContain("你是一位高管教练。");
	});

	it("钉住段 <current-expert> 存在且在整个提示词最末（环境块之后）", () => {
		const out = composePrompt({ ...BASE, expert: EXPERT, now: new Date("2026-09-09T23:18:30+08:00") });
		expect(out.trimEnd().endsWith("<current-expert>工作周报</current-expert>")).toBe(true);
		// 钉住段只出现一次（人格段不含该标签）。
		expect(out.match(/<current-expert>/g)).toHaveLength(1);
	});

	it("人格段在骨架模式段之后（OS + 人格 APP 的顺序）", () => {
		const out = composePrompt({ ...BASE, expert: EXPERT });
		expect(out.indexOf("创作模式行为段。")).toBeLessThan(out.indexOf("## 当前专家"));
	});

	it("未提供 expert：无人格段、无钉住段（三模式现状兼容）", () => {
		const out = composePrompt(BASE);
		expect(out).not.toContain("## 当前专家");
		expect(out).not.toContain("<current-expert>");
	});
});

describe("回复风格注入（F8）", () => {
	const STYLE = { id: "socratic", body: "\n苏格拉底式提问，逐步引导。\n" };

	it("风格段在交互段之后、技能段之前；正文剥首尾换行", () => {
		const out = composePrompt({ ...BASE, skillsSection: "技能清单X", style: STYLE });
		expect(out).toContain("## 回复风格\n\n苏格拉底式提问，逐步引导。");
		expect(out.indexOf("创作模式行为段。")).toBeLessThan(out.indexOf("## 回复风格"));
		expect(out.indexOf("## 回复风格")).toBeLessThan(out.indexOf("技能清单X"));
	});

	it("风格段带元规则：只影响 HOW，不改变 WHAT（组装层附加，不在风格文件里）", () => {
		const out = composePrompt({ ...BASE, style: STYLE });
		expect(out).toContain("风格只影响表达方式（HOW），不改变事实与内容（WHAT）。");
		// 元规则在风格正文之后（收尾护栏，不是开场白）。
		expect(out.indexOf("苏格拉底式提问")).toBeLessThan(out.indexOf("风格只影响表达方式"));
	});

	it("不提供 style：无风格段（偏好「关闭」态由调用方不传字段表达）", () => {
		expect(composePrompt(BASE)).not.toContain("## 回复风格");
		expect(composePrompt(BASE)).not.toContain("风格只影响表达方式");
	});

	it("风格正文里的残留槽位（{{乱写}}）也被拦下", () => {
		expect(() =>
			composePrompt({ ...BASE, style: { id: "socratic", body: "含有 {{乱写}} 的风格" } }),
		).toThrow(/残留槽位/);
	});

	it("骨架没有 {{interaction}} 槽位时，风格段落在核心段末尾（expert 之前）", () => {
		const { text, segments } = composePromptWithMeta({
			...BASE,
			sceneBody: "只有骨架 {{cwd}}",
			style: STYLE,
			expert: { displayName: "工作周报", profession: "职场汇报写作专家", body: "人格正文" },
			now: new Date("2026-09-09T23:18:30+08:00"),
		});
		expect(segments.map((s) => s.text).join("")).toBe(text);
		const sources = segments.map((s) => s.source);
		expect(sources.indexOf("style:socratic")).toBeLessThan(sources.indexOf("expert"));
		expect(text.indexOf("## 回复风格")).toBeLessThan(text.indexOf("## 当前专家"));
	});

	it("provenance：style:<id> 段紧跟 mode:<id> 段，拼接与 text 字节一致", () => {
		const { text, segments } = composePromptWithMeta({
			...BASE,
			modeId: "craft",
			skillsSection: "技能清单X",
			style: STYLE,
			now: new Date("2026-09-09T23:18:30+08:00"),
		});
		expect(segments.map((s) => s.text).join("")).toBe(text);
		const sources = segments.map((s) => s.source);
		expect(sources).toEqual(["skeleton", "mode:craft", "style:socratic", "skeleton", "skills", "skeleton", "time"]);
		expect(segments[2]?.text).toBe(
			"\n\n## 回复风格\n\n苏格拉底式提问，逐步引导。\n\n风格只影响表达方式（HOW），不改变事实与内容（WHAT）。",
		);
	});

	it("风格与 expert 共存：interaction → style → … → expert 位序", () => {
		const { segments } = composePromptWithMeta({
			...BASE,
			modeId: "expert",
			style: STYLE,
			expert: { displayName: "工作周报", profession: "职场汇报写作专家", body: "人格正文" },
			now: new Date("2026-09-09T23:18:30+08:00"),
		});
		const sources = segments.map((s) => s.source);
		expect(sources.indexOf("mode:expert")).toBeLessThan(sources.indexOf("style:socratic"));
		expect(sources.indexOf("style:socratic")).toBeLessThan(sources.indexOf("expert"));
	});
});

describe("记忆段注入（spec: add-memory-system）", () => {
	const MEMORY_SYSTEM = "\n三层记忆的结构与写入纪律。\n";
	const MEMORY_CONTENT = "## 长期记忆（用户级）\n\n报告一律用表格呈现数据。";

	it("memorySystemBody 固定注入为「## 记忆系统」段，正文剥首尾换行", () => {
		const out = composePrompt({ ...BASE, memorySystemBody: MEMORY_SYSTEM });
		expect(out).toContain("## 记忆系统\n\n三层记忆的结构与写入纪律。");
	});

	it("memoryContent 有内容时注入内容段；两者都在骨架之后、expert 人格段之前", () => {
		const { text, segments } = composePromptWithMeta({
			...BASE,
			memorySystemBody: MEMORY_SYSTEM,
			memoryContent: MEMORY_CONTENT,
			expert: { displayName: "工作周报", profession: "职场汇报写作专家", body: "人格正文" },
			now: new Date("2026-09-09T23:18:30+08:00"),
		});
		expect(text).toContain(MEMORY_CONTENT);
		expect(segments.map((s) => s.text).join("")).toBe(text);
		const sources = segments.map((s) => s.source);
		expect(sources.indexOf("memory-system")).toBeLessThan(sources.indexOf("memory"));
		expect(sources.indexOf("memory")).toBeLessThan(sources.indexOf("expert"));
		expect(text.indexOf("创作模式行为段。")).toBeLessThan(text.indexOf("## 记忆系统"));
	});

	it("memoryContent 缺省（三层全空）→ 无内容段、零 token", () => {
		const out = composePrompt({ ...BASE, memorySystemBody: MEMORY_SYSTEM });
		expect(out).toContain("## 记忆系统");
		expect(out).not.toContain("## 长期记忆");
		const sources = composePromptWithMeta({ ...BASE, memorySystemBody: MEMORY_SYSTEM }).segments.map(
			(s) => s.source,
		);
		expect(sources).not.toContain("memory");
	});

	it("两者都缺省 → 无任何记忆段（向后兼容：既有调用点零改动）", () => {
		const out = composePrompt(BASE);
		expect(out).not.toContain("## 记忆系统");
		expect(out).not.toContain("## 长期记忆");
	});

	it("记忆内容里的 {{...}} 不触发残留检查（用户数据不是模板笔误）", () => {
		// 用户往 MEMORY.md 里写了「{{示例}}」不该让会话组装抛错 ——
		// 记忆段推在残留检查之后，管笔误的检查不管用户数据。
		const out = composePrompt({ ...BASE, memoryContent: "笔记：模板写作 {{示例}} 的用法" });
		expect(out).toContain("{{示例}}");
	});
});

describe("子代理提示词不注入风格", () => {
	// 子代理身份由 agent 定义自声明，不套产品风格（spec: systematize-prompt-architecture）。
	// ComposeSubagentPromptInput 类型上没有 style 字段（编译期钉死），这里钉运行期输出。
	it("composeSubagentPrompt 输出不含风格段与元规则", () => {
		const out = composeSubagentPrompt({
			agentBody: "你是侦察员。",
			cwd: "C:\\ws",
			now: new Date("2026-09-09T23:18:30+08:00"),
		});
		expect(out).not.toContain("## 回复风格");
		expect(out).not.toContain("风格只影响表达方式");
	});
});

describe("requireExpertPersona", () => {
	const EXPERTS: readonly ExpertDefinition[] = [
		{
			name: "work-report",
			description: "周报月报等汇报材料",
			displayName: "工作周报",
			profession: "职场汇报写作专家",
			body: "人格正文",
		},
	];

	it("按 name 取出人格三件套", () => {
		expect(requireExpertPersona(EXPERTS, "work-report")).toEqual({
			displayName: "工作周报",
			profession: "职场汇报写作专家",
			body: "人格正文",
		});
	});

	it("expertId 缺失 → 响亮抛错（expert 模式必须绑定专家）", () => {
		expect(() => requireExpertPersona(EXPERTS, undefined)).toThrow(/必须绑定专家/);
	});

	it("专家不在库中 → 响亮抛错（文件可能被手删，state 与专家库漂移）", () => {
		expect(() => requireExpertPersona(EXPERTS, "ghost")).toThrow(/不在专家库中/);
	});
});

describe("formatSkillsSection", () => {
	it("无技能返回空串（零 token）", () => {
		expect(formatSkillsSection([])).toBe("");
	});

	it("委托 pi 的规范格式：含名称、描述与文件路径（模型按需 read 的入口）", () => {
		const section = formatSkillsSection([
			{ name: "meeting-notes", description: "整理会议纪要", filePath: "C:\\skills\\meeting-notes\\SKILL.md" },
		]);
		// 断言关键信息存在而不是整段文本：格式归 pi（agentskills.io 规范），升级零改动。
		expect(section).toContain("<name>meeting-notes</name>");
		expect(section).toContain("整理会议纪要");
		expect(section).toContain("meeting-notes\\SKILL.md");
		// 保守检查：不该出现我们自己旧格式的痕迹。
		expect(section).not.toContain("可用技能：");
	});
});

describe("片段 include 展开", () => {
	// 用 map 造 resolver：比逐条写 if 更贴近 loader「目录 → 回调」的形态。
	const frags =
		(map: Record<string, string>) =>
		(name: string): string | undefined =>
			map[name];

	it("基本展开：片段内容出现在指令位置", () => {
		const out = composePrompt({
			...BASE,
			sceneBody: "头部\n{{> rules}}\n尾部 {{cwd}}",
			resolveFragment: frags({ rules: "交付纪律三条" }),
		});
		expect(out).toContain("头部\n交付纪律三条\n尾部 C:\\ws");
	});

	it("嵌套展开：片段里再 include，且片段内可用槽位", () => {
		const out = composePrompt({
			...BASE,
			sceneBody: "{{> a}}",
			resolveFragment: frags({ a: "A-{{> b}}", b: "B 目录={{cwd}}" }),
		});
		expect(out).toContain("A-B 目录=C:\\ws");
	});

	it("片段缺失 → 抛错（不静默留洞上线）", () => {
		expect(() =>
			composePrompt({
				...BASE,
				sceneBody: "{{> ghost}}",
				resolveFragment: () => undefined,
			}),
		).toThrow(/片段「ghost」缺失/);
	});

	it("骨架含 {{> }} 但未提供 resolveFragment → 抛错", () => {
		expect(() => composePrompt({ ...BASE, sceneBody: "{{> rules}}" })).toThrow(
			/resolveFragment/,
		);
	});

	it("环检测：a → b → a 抛错并报出环路径", () => {
		expect(() =>
			composePrompt({
				...BASE,
				sceneBody: "{{> a}}",
				resolveFragment: frags({ a: "{{> b}}", b: "{{> a}}" }),
			}),
		).toThrow(/成环：a → b → a/);
	});

	it("自引用环 a → a 同样被拦", () => {
		expect(() =>
			composePrompt({
				...BASE,
				sceneBody: "{{> a}}",
				resolveFragment: frags({ a: "{{> a}}" }),
			}),
		).toThrow(/成环：a → a/);
	});

	it("不成环的嵌套超过 8 层 → 抛错", () => {
		expect(() =>
			composePrompt({
				...BASE,
				sceneBody: "{{> f1}}",
				resolveFragment: (name) => `{{> f${Number(name.slice(1)) + 1}}}`,
			}),
		).toThrow(/嵌套超过 8 层/);
	});

	it("片段正文里的残留槽位（{{乱写}}）也被拦下", () => {
		expect(() =>
			composePrompt({
				...BASE,
				sceneBody: "{{> a}}",
				resolveFragment: frags({ a: "含有 {{乱写}} 的片段" }),
			}),
		).toThrow(/残留槽位/);
	});
});

describe("provenance 分段（composePromptWithMeta）", () => {
	const NOW = new Date("2026-09-09T23:18:30+08:00");
	const join = (segments: readonly { text: string }[]): string =>
		segments.map((s) => s.text).join("");

	it("composePrompt 是薄封装：与 meta 版 text 相同", () => {
		const input = { ...BASE, skillsSection: "技能段", model: "GLM", now: NOW };
		expect(composePrompt(input)).toBe(composePromptWithMeta(input).text);
	});

	it("segments 顺序拼接与 text 字节一致（含空 skills 压平场景）", () => {
		const { text, segments } = composePromptWithMeta({
			...BASE,
			sceneBody: "头\n\n{{skills}}\n\n尾 {{cwd}}",
			skillsSection: "",
			now: NOW,
		});
		expect(join(segments)).toBe(text);
		expect(text).toContain("头\n\n尾 C:\\ws");
		expect(text).not.toMatch(/\n{3,}/);
		// 空技能段被丢弃：不存在 skills 来源的分段。
		expect(segments.some((s) => s.source === "skills")).toBe(false);
	});

	it("来源标注：skeleton / mode:<id> / skills / time；cwd 行内并入 skeleton", () => {
		const { text, segments } = composePromptWithMeta({
			...BASE,
			modeId: "craft",
			skillsSection: "技能清单X",
			now: NOW,
		});
		expect(join(segments)).toBe(text);
		expect(segments[0]).toEqual({ source: "skeleton", text: "你是 KamiBuddy。\n\n# 模式\n" });
		expect(segments[1]).toEqual({ source: "mode:craft", text: "创作模式行为段。" });
		expect(segments.find((s) => s.source === "skills")?.text).toBe("技能清单X");
		// cwd 是行内标量：与「目录：」同在 skeleton 段里，不独立成段。
		const tail = segments.find((s) => s.source === "skeleton" && s.text.includes("目录："));
		expect(tail?.text).toBe("\n目录：C:\\ws");
		expect(segments.at(-1)?.source).toBe("time");
	});

	it("modeId 缺省时标 mode:unknown（daemon 接线是后续任务）", () => {
		const { segments } = composePromptWithMeta({ ...BASE, now: NOW });
		expect(segments.some((s) => s.source === "mode:unknown")).toBe(true);
	});

	it("片段段标 fragment:<名>，骨架被片段与槽位切开的各段分别标注", () => {
		const { text, segments } = composePromptWithMeta({
			...BASE,
			modeId: "craft",
			sceneBody: "开头\n{{> rules}}\n# 模式\n{{interaction}}",
			resolveFragment: () => "纪律A\n纪律B",
			now: NOW,
		});
		expect(join(segments)).toBe(text);
		expect(segments.map((s) => s.source)).toEqual([
			"skeleton",
			"fragment:rules",
			"skeleton",
			"mode:craft",
			"time",
		]);
		expect(segments[1]?.text).toBe("纪律A\n纪律B");
	});

	it("expert / pi-context / time 段齐全且顺序正确；钉住段在最末", () => {
		const { text, segments } = composePromptWithMeta({
			...BASE,
			expert: {
				displayName: "工作周报",
				profession: "职场汇报写作专家",
				body: "人格正文",
			},
			piContext: { promptGuidelines: ["一条指引"] },
			now: NOW,
		});
		expect(join(segments)).toBe(text);
		const sources = segments.map((s) => s.source);
		// 骨架核心段之后：人格（expert）→ pi-context → time → 钉住段（expert）。
		expect(sources.slice(0, 3)).toEqual(["skeleton", "mode:unknown", "skeleton"]);
		expect(sources.slice(3)).toEqual(["expert", "pi-context", "time", "expert"]);
		expect(segments.at(-1)?.text).toBe("\n\n<current-expert>工作周报</current-expert>");
	});
});
