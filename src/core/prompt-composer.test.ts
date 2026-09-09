/**
 * 提示词组装的测试。
 *
 * 组装器是「模型看到什么」的唯一来源，错一处就是产品身份错一处。
 * 重点钉住：槽位替换、未知槽位抛错（防 {{xxx}} 空洞上线）、
 * 残留槽位抛错（防模式正文里误写槽位）、空技能段零残留。
 */

import { describe, expect, it } from "vitest";
import { composePrompt, formatRuntimeTime, formatSkillsSection } from "./prompt-composer.ts";

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
