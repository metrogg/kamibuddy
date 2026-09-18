/**
 * 提示词组装的测试。
 *
 * 组装器是「模型看到什么」的唯一来源，错一处就是产品身份错一处。
 * 重点钉住：槽位替换、未知槽位抛错（防 {{xxx}} 空洞上线）、
 * 残留槽位抛错（防模式正文里误写槽位）、空技能段零残留。
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSkills } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	composePrompt,
	composePromptWithMeta,
	composeSubagentPrompt,
	formatRuntimeContext,
	formatSkillsSection,
	requireExpertPersona,
	resolveSessionExpert,
	sessionSkillPaths,
	skillsSectionForMode,
	toExpertPersona,
	type SkillDescriptor,
} from "./prompt-composer.ts";
import type { ExpertDefinition } from "./experts.ts";
import { SNAPSHOT_SUPERSEDE_NOTE } from "../shared/hidden-context.ts";

const BASE = {
	sceneBody: "你是 KamiBuddy。\n\n# 模式\n{{interaction}}\n{{skills}}",
	modeBody: "创作模式行为段。",
	skillsSection: "",
};

describe("槽位替换", () => {
	it("两个槽位全部替换", () => {
		const out = composePrompt({ ...BASE, skillsSection: "可用技能：\n- a：测试" });
		expect(out).toContain("创作模式行为段。");
		expect(out).toContain("可用技能：\n- a：测试");
		expect(out).not.toContain("{{");
	});

	it("骨架未使用某槽位（如 {{skills}}）不报错", () => {
		// 骨架用多少槽位是场景作者的自由；composer 只要求「出现的都能填」。
		expect(() => composePrompt({ ...BASE, sceneBody: "只有骨架 {{interaction}}" })).not.toThrow();
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

	it("已删的槽位 {{cwd}} / {{model}} / {{pythonPath}} 同样响亮抛错（护栏不放松）", () => {
		/*
		 * 三个槽位都是有意删掉的：工作目录归 hidden context 的 workspace_context；
		 * {{model}} 无使用者；{{pythonPath}} 曾是「托管解释器路径」的入口，但它
		 * **随机器变**（homedir / 安装位置 / HTML_TO_DOCX_VENV），进系统提示词就是
		 * 「换机 / 重建 venv 即断前缀」—— 改由 hidden context 的 python_env 段注入
		 * （spec: stabilize-prompt-prefix）。骨架/片段里再写出来就是拼错的模板 ——
		 * 不能静默留成空洞给模型看，也不能让某个片段把它悄悄带回提示词。
		 */
		expect(() => composePrompt({ ...BASE, sceneBody: "当前工作目录：{{cwd}}" })).toThrow(
			/未支持的槽位/,
		);
		expect(() => composePrompt({ ...BASE, sceneBody: "模型：{{model}}" })).toThrow(
			/未支持的槽位/,
		);
		expect(() =>
			composePrompt({ ...BASE, sceneBody: "解释器：{{pythonPath}}" }),
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

describe("运行时上下文注入块（formatRuntimeContext）", () => {
	/*
	 * 这两段（记忆内容 / 个性化）是逐轮会变的事实，**不进系统提示词**：
	 * 系统提示词在整段对话历史之前，它变一个字节就让其后的一切（含历史）在
	 * provider 前缀缓存里失配。它们由 formatRuntimeContext 组装成注入消息，
	 * 经 prompt-switch 的 `context` 事件落在对话历史之后
	 * （spec: stabilize-prompt-prefix）。
	 *
	 * 时间**不在这里**：会话内的时间只有 session-host 的 hidden context
	 * `current_time` 一个来源（run 开始冻结，用例见 session-host.test.ts 的
	 * hidden context 一组）—— 两份时间来源并存时值会漂移。
	 */
	const MEMORY = "## 长期记忆（用户级）\n\n报告一律用表格呈现数据。";

	it("记忆内容与个性化有值时按「记忆 → 个性化」追加", () => {
		const out = formatRuntimeContext({
			memoryContent: MEMORY,
			personalization: { userNickname: "老王" },
		});
		expect(out).toContain(MEMORY);
		expect(out).toContain("用户希望被称为「老王」。");
		expect(out.indexOf("## 长期记忆")).toBeLessThan(out.indexOf("用户希望被称为"));
	});

	it("正文第一行是取代声明（单点常量，三条快照通道共用）", () => {
		/*
		 * 画像/个性化是 append-only 的：内容一变就追加一条新的、旧的原样留档，
		 * 而旧那条里写着「最后更新：…」这类会过期的事实 —— 模型必须知道冲突时
		 * 以最新那条为准（spec: add-supersede-note-and-time-split 的 A）。
		 * 声明是常量 ⇒ 同内容两次渲染逐字节相等，去重（shouldAppendSnapshot）
		 * 不被它破坏。
		 */
		const out = formatRuntimeContext({ memoryContent: MEMORY });
		expect(out.startsWith(`${SNAPSHOT_SUPERSEDE_NOTE}\n\n`)).toBe(true);
		expect(formatRuntimeContext({ memoryContent: MEMORY })).toBe(out);
		// 无内容时零 token：不白发一句声明出去。
		expect(formatRuntimeContext({})).toBe("");
	});

	it("记忆为空 / 全空白不注入（零 token 口径不变）；个性化四项全空同理", () => {
		const bare = formatRuntimeContext({});
		expect(formatRuntimeContext({ memoryContent: undefined })).toBe(bare);
		expect(formatRuntimeContext({ memoryContent: "   \n " })).toBe(bare);
		expect(formatRuntimeContext({ personalization: {} })).toBe(bare);
	});

	it("注入块与时间无关：两次不同时刻现算的结果字节相等", () => {
		/*
		 * 「每个模型调用前现读」是这条路径的设计（run 内记忆会被模型自己写、
		 * 个性化会被用户改），所以用两次相隔一整天、且跨过分钟边界的调用表达
		 * 「两个不同的时刻」。
		 *
		 * 若有人把时间塞回注入块（它曾经带过分钟精度的 `Current time: …` 行），
		 * 这条立刻红 —— 时间在会话内只有一个出口：session-host 的 hidden context
		 * `current_time`（run 开始时冻结，正侧断言见 session-host.test.ts 的
		 * hidden context 一组）。两条时间来源并存时值还会漂移。
		 */
		const input = {
			memoryContent: MEMORY,
			personalization: { userNickname: "老王", customInstructions: "回复开头先给结论。" },
		};
		vi.useFakeTimers();
		try {
			vi.setSystemTime(new Date("2026-09-17T09:59:59"));
			const first = formatRuntimeContext(input);
			vi.setSystemTime(new Date("2026-09-18T11:01:00"));
			const second = formatRuntimeContext(input);
			expect(second).toBe(first);
		} finally {
			vi.useRealTimers();
		}
	});

	it("注入块不含任何时间格式（时间只有 hidden context 的 current_time 一个出口）", () => {
		const out = formatRuntimeContext({
			memoryContent: MEMORY,
			personalization: { customInstructions: "回复开头先给结论。" },
		});
		// 旧英文时间行。
		expect(out).not.toMatch(/Current time:/);
		// 冒号分隔的时刻形态（HH:mm）—— 时间行回来时必然撞上。
		expect(out).not.toMatch(/\d{2}:\d{2}/);
		// 中文形态的时间行同样不许回来。
		expect(out).not.toContain("现在时间");
		expect(out).not.toContain("当前时间");
	});

	it("无内容时（缺省入参 = 子代理路径的调用形态）产出空串，调用方零 token 跳过注入", () => {
		expect(formatRuntimeContext()).toBe("");
	});

	it("用户数据里的 {{...}} 原样保留（不经 composer 的残留检查）", () => {
		// 残留检查管的是骨架/片段/模式的笔误，不管用户数据 —— 注入块不经过 composer，
		// 天然保持这个性质：用户往 MEMORY.md 写「{{示例}}」不该让会话组装抛错。
		const out = formatRuntimeContext({
			memoryContent: "笔记：模板写作 {{示例}} 的用法",
			personalization: { customInstructions: "引用 {{占位}} 时先说清用途" },
		});
		expect(out).toContain("{{示例}}");
		expect(out).toContain("{{占位}}");
	});

	it("逐轮可变事实都不在系统提示词里（改了位置不能改回：留在提示词里等于每轮断前缀）", () => {
		const prompt = composePrompt({
			...BASE,
			memorySystemBody: "三层记忆的结构与写入纪律。",
		});
		expect(prompt).not.toContain("## 长期记忆");
		expect(prompt).not.toContain("用户希望被称为");
		// 时间行（曾以 `Current time: …` 形态进过提示词）不许以任何形态回来；
		// 现在的落地形态是 hidden context 的 current_time。
		expect(prompt).not.toMatch(/Current time:/);
		// provenance 里也不该再有这三类来源。
		const sources = composePromptWithMeta(BASE).segments.map((s) => s.source);
		for (const banned of ["time", "memory", "personalization"]) {
			expect(sources).not.toContain(banned);
		}
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

	it("人格全文位于前部槽位：骨架之后、模式行为段之前（压过通用身份）", () => {
		const out = composePrompt({ ...BASE, expert: EXPERT });
		expect(out.indexOf("你是 KamiBuddy。")).toBeLessThan(out.indexOf("## 当前专家"));
		expect(out.indexOf("## 当前专家")).toBeLessThan(out.indexOf("创作模式行为段。"));
		// 前移的是人格本体，不只是标题。
		expect(out.indexOf("你是一位高管教练。")).toBeLessThan(out.indexOf("创作模式行为段。"));
	});

	it("人格前带 Role Override 声明，且紧邻人格正文（中间不隔别的段落）", () => {
		const out = composePrompt({ ...BASE, expert: EXPERT });
		expect(out).toContain(
			"身份覆盖：以下是你在本会话中的专家身份定义。它与此前任何通用身份描述冲突时，以本段为准——这是本会话中你的权威角色。\n\n# 工作汇报写作专家",
		);
	});

	it("钉子段 <current-expert> 只钉名字：在提示词最末，不含人格正文", () => {
		const out = composePrompt({ ...BASE, expert: EXPERT });
		expect(out).toContain("<current-expert>工作周报</current-expert>");
		expect(out.trimEnd().endsWith("请始终以该专家的角色与工作流推进本会话。")).toBe(true);
		// 钉子段只出现一次（人格段不含该标签）。
		expect(out.match(/<current-expert>/g)).toHaveLength(1);
		// 钉子段起直到结尾没有人格本体 —— 人格只在前部槽位出现一次（独特句反证）。
		expect(out.slice(out.indexOf("<current-expert>"))).not.toContain("你是一位高管教练。");
	});

	it("骨架没有 {{interaction}} 槽位时，人格段落在核心段末尾", () => {
		const { text, segments } = composePromptWithMeta({
			...BASE,
			sceneBody: "只有骨架",
			expert: { displayName: "工作周报", profession: "职场汇报写作专家", body: "人格正文" },
		});
		expect(segments.map((s) => s.text).join("")).toBe(text);
		// 前一个是人格本体（核心段末尾），后一个是末尾的钉子段 —— 两者同源但不同段
		//（钉子段在 finalizeCore 之后追加，不参与合并）。
		expect(segments.map((s) => s.source)).toEqual(["skeleton", "expert", "expert"]);
		expect(text).toContain("## 当前专家");
	});

	it("未提供 expert：无人格段、无钉子段（三模式现状兼容）", () => {
		const out = composePrompt(BASE);
		expect(out).not.toContain("## 当前专家");
		expect(out).not.toContain("<current-expert>");
	});
});

describe("正交组合：交互模式 × 专家绑定（spec: rework-expert-orthogonal-and-skills）", () => {
	// 专家与交互模式是两个正交的轴：{ask, craft, plan} × {无专家, 有专家} 六种
	// 组合都必须可达。这里逐一断言模式行为段按模式出现、人格段与 <current-expert>
	// 钉子段只在绑专家时出现 —— 覆盖「计划/问答 + 专家」这两条曾经不可达的组合。
	const MODES = [
		{ id: "craft", body: "创作模式行为段。" },
		{ id: "ask", body: "问答模式行为段。" },
		{ id: "plan", body: "计划模式行为段。" },
	] as const;
	const EXPERT = {
		displayName: "工作周报",
		profession: "职场汇报写作专家",
		body: "# 工作汇报写作专家\n\n## 角色定义\n\n你是一位高管教练。",
	};

	for (const mode of MODES) {
		for (const bound of [false, true]) {
			const label = bound ? "绑专家" : "不绑专家";
			it(`${mode.id} × ${label}：模式行为段按模式出现，人格段/钉子段仅在绑专家时出现`, () => {
				const { text, segments } = composePromptWithMeta({
					...BASE,
					modeBody: mode.body,
					modeId: mode.id,
					...(bound ? { expert: EXPERT } : {}),
				});

				// 模式轴独立生效：本模式行为段在位、其它模式段不混入，provenance 标注本模式。
				expect(text).toContain(mode.body);
				for (const other of MODES) {
					if (other.id !== mode.id) expect(text).not.toContain(other.body);
				}
				expect(segments.some((s) => s.source === `mode:${mode.id}`)).toBe(true);

				if (bound) {
					// 人格段仅在绑专家时出现，且仍在前部槽位（模式行为段之前）。
					expect(text).toContain("## 当前专家");
					expect(text).toContain("工作周报（职场汇报写作专家）");
					expect(text.indexOf("## 当前专家")).toBeLessThan(text.indexOf(mode.body));
					// 钉子段仅在绑专家时出现，只钉名字、且在提示词最末。
					expect(text).toContain("<current-expert>工作周报</current-expert>");
					expect(text.match(/<current-expert>/g)).toHaveLength(1);
					expect(text.trimEnd().endsWith("请始终以该专家的角色与工作流推进本会话。")).toBe(true);
				} else {
					expect(text).not.toContain("## 当前专家");
					expect(text).not.toContain("<current-expert>");
				}
			});
		}
	}
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

	it("骨架没有 {{interaction}} 槽位时，风格段落在核心段末尾", () => {
		const { text, segments } = composePromptWithMeta({
			...BASE,
			sceneBody: "只有骨架",
			style: STYLE,
		});
		expect(segments.map((s) => s.text).join("")).toBe(text);
		expect(segments.map((s) => s.source)).toEqual(["skeleton", "style:socratic"]);
	});

	it("provenance：style:<id> 段紧跟 mode:<id> 段，拼接与 text 字节一致", () => {
		const { text, segments } = composePromptWithMeta({
			...BASE,
			modeId: "craft",
			skillsSection: "技能清单X",
			style: STYLE,
		});
		expect(segments.map((s) => s.text).join("")).toBe(text);
		const sources = segments.map((s) => s.source);
		expect(sources).toEqual(["skeleton", "mode:craft", "style:socratic", "skeleton", "skills"]);
		expect(segments[2]?.text).toBe(
			"\n\n## 回复风格\n\n苏格拉底式提问，逐步引导。\n\n风格只影响表达方式（HOW），不改变事实与内容（WHAT）。",
		);
	});

	it("绑定专家时风格让位：不注入风格段；同一份风格在未绑专家的 craft 模式照常注入", () => {
		// WorkBuddy user-context-expert-identity 的精简语义：选定专家后表达层
		// 的唯一权威是人格，用户自定义风格让位（spec: align-expert-system-workbuddy）。
		// 让位只取决于是否绑定 expert，与交互模式（modeId）无关。
		const EXPERT = { displayName: "工作周报", profession: "职场汇报写作专家", body: "人格正文" };
		const expertOut = composePrompt({ ...BASE, modeId: "craft", style: STYLE, expert: EXPERT });
		expect(expertOut).not.toContain("## 回复风格");
		expect(expertOut).not.toContain("风格只影响表达方式");
		expect(expertOut).toContain("## 当前专家");
		// 未绑专家对照（同为 craft 模式）：让位只发生在绑专家时，风格段本身不受影响。
		const craftOut = composePrompt({ ...BASE, modeId: "craft", style: STYLE });
		expect(craftOut).toContain("## 回复风格");
	});
});

describe("记忆段注入（spec: add-memory-system）", () => {
	const MEMORY_SYSTEM = "\n三层记忆的结构与写入纪律。\n";

	it("memorySystemBody 固定注入为「## 记忆系统」段，正文剥首尾换行", () => {
		const out = composePrompt({ ...BASE, memorySystemBody: MEMORY_SYSTEM });
		expect(out).toContain("## 记忆系统\n\n三层记忆的结构与写入纪律。");
	});

	it("记忆行为纪律段在核心段（含人格）之后 —— 它是「怎么写」不是「写了什么」", () => {
		const { text, segments } = composePromptWithMeta({
			...BASE,
			memorySystemBody: MEMORY_SYSTEM,
			expert: { displayName: "工作周报", profession: "职场汇报写作专家", body: "人格正文" },
		});
		expect(segments.map((s) => s.text).join("")).toBe(text);
		const sources = segments.map((s) => s.source);
		// 人格上了前部槽位（spec: align-expert-system-workbuddy），纪律段排在人格之后。
		expect(sources.indexOf("expert")).toBeLessThan(sources.indexOf("memory-system"));
		expect(text.indexOf("创作模式行为段。")).toBeLessThan(text.indexOf("## 记忆系统"));
	});

	it("记忆**内容**不进系统提示词（改走 formatRuntimeContext 的注入路径）", () => {
		// 内容三段逐轮都可能变（模型自己会写记忆），留在提示词里等于每轮自伤
		// （spec: stabilize-prompt-prefix）。类型上已无对应入参，这里钉运行期输出。
		const { text, segments } = composePromptWithMeta({
			...BASE,
			memorySystemBody: MEMORY_SYSTEM,
		});
		expect(text).toContain("## 记忆系统");
		expect(text).not.toContain("## 长期记忆");
		expect(text).not.toContain("## 用户画像");
		expect(text).not.toContain("## 本项目记忆");
		const sources = segments.map((s) => s.source);
		expect(sources).not.toContain("memory");
	});

	it("缺省 → 无任何记忆段（向后兼容：既有调用点零改动）", () => {
		const out = composePrompt(BASE);
		expect(out).not.toContain("## 记忆系统");
		expect(out).not.toContain("## 长期记忆");
	});
});

describe("子代理提示词不注入风格与时间块", () => {
	// 子代理身份由 agent 定义自声明，不套产品风格（spec: systematize-prompt-architecture）。
	// ComposeSubagentPromptInput 类型上没有 style / now 字段（编译期钉死），这里钉运行期输出。
	it("composeSubagentPrompt 输出不含风格段与元规则", () => {
		const out = composeSubagentPrompt({
			agentBody: "你是侦察员。",
			cwd: "C:\\ws",
		});
		expect(out).not.toContain("## 回复风格");
		expect(out).not.toContain("风格只影响表达方式");
	});

	it("composeSubagentPrompt 输出不含时间块（时间由 hidden context 送达，留在提示词里会逐轮断前缀）", () => {
		const out = composeSubagentPrompt({ agentBody: "你是侦察员。", cwd: "C:\\ws" });
		expect(out).not.toMatch(/Current time:/);
		// 工作目录仍在（子代理不接 pi 内置 section，它是自包含身份）。
		expect(out).toContain("当前工作目录：C:\\ws");
	});
});

describe("requireExpertPersona", () => {
	const EXPERTS: readonly ExpertDefinition[] = [
		{
			name: "work-report",
			description: "周报月报等汇报材料",
			displayName: "工作周报",
			profession: "职场汇报写作专家",
			displayDescription: "用数据讲清你的贡献",
			quickPrompts: ["问题一", "问题二", "问题三"],
			tags: ["标签一", "标签二", "标签三"],
			source: "builtin",
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

	it("expertId 缺失 → 响亮抛错（必有专家的调用点不该传空）", () => {
		expect(() => requireExpertPersona(EXPERTS, undefined)).toThrow(/缺少 expertId/);
	});

	it("专家不在库中 → 响亮抛错（文件可能被手删，state 与专家库漂移）", () => {
		expect(() => requireExpertPersona(EXPERTS, "ghost")).toThrow(/不在专家库中/);
	});
});

describe("resolveSessionExpert / toExpertPersona", () => {
	const EXPERT: ExpertDefinition = {
		name: "stock-research-report",
		description: "证券研报",
		displayName: "证券研报",
		profession: "证券分析师",
		displayDescription: "写有据可依的研报",
		quickPrompts: ["问题一", "问题二", "问题三"],
		tags: ["标签一", "标签二", "标签三"],
		source: "builtin",
		skillsDir: "C:\\experts\\stock-research-report\\skills",
		body: "人格正文",
	};

	it("绑定专家 → 返回完整定义（含私有技能目录），供人格与技能目录共用", () => {
		expect(resolveSessionExpert([EXPERT], "stock-research-report")).toBe(EXPERT);
		expect(toExpertPersona(EXPERT)).toEqual({
			displayName: "证券研报",
			profession: "证券分析师",
			body: "人格正文",
		});
	});

	it("未绑定专家（expertId 缺失）→ undefined，不抛错", () => {
		expect(resolveSessionExpert([EXPERT], undefined)).toBeUndefined();
	});

	it("expertId 有值但不在库中 → 响亮抛错（恢复会话后 state 与专家库漂移）", () => {
		expect(() => resolveSessionExpert([EXPERT], "ghost")).toThrow(/不在专家库中/);
	});
});

describe("formatSkillsSection", () => {
	it("无技能返回空串（零 token）", async () => {
		expect(await formatSkillsSection([])).toBe("");
	});

	it("委托 pi 的规范格式：含名称、描述与文件路径（模型按需 read 的入口）", async () => {
		const section = await formatSkillsSection([
			{ name: "meeting-notes", description: "整理会议纪要", filePath: "C:\\skills\\meeting-notes\\SKILL.md" },
		]);
		// 断言关键信息存在而不是整段文本：格式归 pi（agentskills.io 规范），升级零改动。
		expect(section).toContain("<name>meeting-notes</name>");
		expect(section).toContain("整理会议纪要");
		expect(section).toContain("meeting-notes\\SKILL.md");
		// 保守检查：不该出现我们自己旧格式的痕迹。
		expect(section).not.toContain("可用技能：");
	});

	it("清单段含本会话的调用约定一句：优先 use_skill，无该工具时 read + <location>", async () => {
		const section = await formatSkillsSection([
			{ name: "meeting-notes", description: "整理会议纪要", filePath: "C:\\skills\\meeting-notes\\SKILL.md" },
		]);
		expect(section).toContain("优先调用 use_skill");
		expect(section).toContain("<location>");
		// 「技能名不许凭记忆编」的约束语义必须保留。
		expect(section).toContain("不要凭记忆拼写");
		// 约定句在 pi 的清单之后（追加，不是重写）。
		expect(section.indexOf("</available_skills>")).toBeLessThan(section.indexOf("优先调用 use_skill"));
	});

	it("disableModelInvocation 的技能不进清单段（pi 的过滤依赖这个字段）", async () => {
		const section = await formatSkillsSection([
			{ name: "meeting-notes", description: "整理会议纪要", filePath: "C:\\skills\\meeting-notes\\SKILL.md" },
			{
				name: "typeset",
				description: "内部排版子技能",
				filePath: "C:\\skills\\typeset\\SKILL.md",
				disableModelInvocation: true,
			},
		]);
		expect(section).toContain("meeting-notes");
		expect(section).not.toContain("typeset");
	});

	it("技能全被 disable-model-invocation 过滤掉 → 空串（不留孤零零的调用约定）", async () => {
		expect(
			await formatSkillsSection([
				{
					name: "typeset",
					description: "内部排版子技能",
					filePath: "C:\\skills\\typeset\\SKILL.md",
					disableModelInvocation: true,
				},
			]),
		).toBe("");
	});
});

describe("会话技能路径（专家私有技能预加载）", () => {
	let root: string;

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "kami-session-skills-"));
	});

	afterEach(() => {
		rmSync(root, { recursive: true, force: true });
	});

	/** 造一个技能：<dir>/SKILL.md，name 取目录名（够 pi loadSkills 认出来）。 */
	function writeSkill(dir: string, name: string): void {
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: ${name} 技能\n---\n正文`);
	}

	/** 走真实 pi loadSkills（同 daemon listSkills 的加载路径），取清单段可直接用的描述符。 */
	function loadDescriptors(skillPaths: readonly string[]): SkillDescriptor[] {
		return loadSkills({ cwd: root, agentDir: root, skillPaths: [...skillPaths], includeDefaults: false }).skills.map(
			(s) => ({ name: s.name, description: s.description, filePath: s.filePath }),
		);
	}

	it("绑定专家：私有技能进清单段；未绑定：不含（全局技能两态都在）", async () => {
		const globalSkillsDir = join(root, "resources-skills");
		const expertSkillsDir = join(root, "experts", "stock-research-report", "skills");
		writeSkill(join(globalSkillsDir, "meeting-notes"), "meeting-notes");
		writeSkill(join(expertSkillsDir, "dcf-model-builder"), "dcf-model-builder");

		const bound = await formatSkillsSection(loadDescriptors(sessionSkillPaths([globalSkillsDir], expertSkillsDir)));
		expect(bound).toContain("meeting-notes");
		expect(bound).toContain("dcf-model-builder");

		const unbound = await formatSkillsSection(loadDescriptors(sessionSkillPaths([globalSkillsDir])));
		expect(unbound).toContain("meeting-notes");
		expect(unbound).not.toContain("dcf-model-builder");
	});

	it("路径顺序：随包技能根在前、专家私有在后（pi 先注册者胜出，随包优先）", () => {
		expect(sessionSkillPaths(["/resources/skills", "/resources/plugins"], "/experts/x/skills")).toEqual([
			"/resources/skills",
			"/resources/plugins",
			"/experts/x/skills",
		]);
		expect(sessionSkillPaths(["/resources/skills", "/resources/plugins"])).toEqual([
			"/resources/skills",
			"/resources/plugins",
		]);
	});
});

describe("skillsSectionForMode（技能段门控）", () => {
	const SKILLS: readonly SkillDescriptor[] = [
		{ name: "meeting-notes", description: "整理会议纪要", filePath: "C:\\skills\\meeting-notes\\SKILL.md" },
	];

	it("白名单含 read / bash → 注入技能段", async () => {
		expect(await skillsSectionForMode(["read", "write"], SKILLS)).toContain("meeting-notes");
		expect(await skillsSectionForMode(["bash"], SKILLS)).toContain("meeting-notes");
	});

	it("白名单只有 use_skill（无 read / bash）→ 也注入（技能加载工具算数）", async () => {
		// use_skill 自带「读 SKILL.md」的能力，模型据此能兑现清单里的每个技能名。
		expect(await skillsSectionForMode(["use_skill"], SKILLS)).toContain("meeting-notes");
	});

	it("白名单 read / bash / use_skill 一个都没有 → 不注入（注入等于留坑）", async () => {
		expect(await skillsSectionForMode(["grep", "write"], SKILLS)).toBe("");
		// 无技能时同样是空串（零 token），两态不靠字面量区分。
		expect(await skillsSectionForMode(["read"], [])).toBe("");
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
			sceneBody: "头部\n{{> rules}}\n尾部 {{interaction}}",
			resolveFragment: frags({ rules: "交付纪律三条" }),
		});
		expect(out).toContain("头部\n交付纪律三条\n尾部 创作模式行为段。");
	});

	it("嵌套展开：片段里再 include，且片段内可用槽位", () => {
		const out = composePrompt({
			...BASE,
			sceneBody: "{{> a}}",
			resolveFragment: frags({ a: "A-{{> b}}", b: "B 模式={{interaction}}" }),
		});
		expect(out).toContain("A-B 模式=创作模式行为段。");
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
	const join = (segments: readonly { text: string }[]): string =>
		segments.map((s) => s.text).join("");

	it("composePrompt 是薄封装：与 meta 版 text 相同", () => {
		const input = { ...BASE, skillsSection: "技能段" };
		expect(composePrompt(input)).toBe(composePromptWithMeta(input).text);
	});

	it("segments 顺序拼接与 text 字节一致（含空 skills 压平场景）", () => {
		const { text, segments } = composePromptWithMeta({
			...BASE,
			sceneBody: "头\n\n{{skills}}\n\n尾 {{interaction}}",
			skillsSection: "",
		});
		expect(join(segments)).toBe(text);
		expect(text).toContain("头\n\n尾 创作模式行为段。");
		expect(text).not.toMatch(/\n{3,}/);
		// 空技能段被丢弃：不存在 skills 来源的分段。
		expect(segments.some((s) => s.source === "skills")).toBe(false);
	});

	it("来源标注：skeleton / mode:<id> / skills", () => {
		const { text, segments } = composePromptWithMeta({
			...BASE,
			modeId: "craft",
			skillsSection: "技能清单X",
		});
		expect(join(segments)).toBe(text);
		expect(segments[0]).toEqual({ source: "skeleton", text: "你是 KamiBuddy。\n\n# 模式\n" });
		expect(segments[1]).toEqual({ source: "mode:craft", text: "创作模式行为段。" });
		expect(segments.find((s) => s.source === "skills")?.text).toBe("技能清单X");
		expect(segments.at(-1)?.source).toBe("skills");
	});

	it("modeId 缺省时标 mode:unknown（daemon 接线是后续任务）", () => {
		const { segments } = composePromptWithMeta({ ...BASE });
		expect(segments.some((s) => s.source === "mode:unknown")).toBe(true);
	});

	it("片段段标 fragment:<名>，骨架被片段与槽位切开的各段分别标注", () => {
		const { text, segments } = composePromptWithMeta({
			...BASE,
			modeId: "craft",
			sceneBody: "开头\n{{> rules}}\n# 模式\n{{interaction}}",
			resolveFragment: () => "纪律A\n纪律B",
		});
		expect(join(segments)).toBe(text);
		expect(segments.map((s) => s.source)).toEqual([
			"skeleton",
			"fragment:rules",
			"skeleton",
			"mode:craft",
		]);
		expect(segments[1]?.text).toBe("纪律A\n纪律B");
	});

	it("expert / pi-context 段齐全且顺序正确；钉子段在最末", () => {
		const { text, segments } = composePromptWithMeta({
			...BASE,
			expert: {
				displayName: "工作周报",
				profession: "职场汇报写作专家",
				body: "人格正文",
			},
			piContext: { promptGuidelines: ["一条指引"] },
		});
		expect(join(segments)).toBe(text);
		const sources = segments.map((s) => s.source);
		// 人格前部槽位在骨架与模式段之间；核心段之后：pi-context → 钉子段。
		expect(sources.slice(0, 3)).toEqual(["skeleton", "expert", "mode:unknown"]);
		expect(sources.slice(3)).toEqual(["pi-context", "expert"]);
		expect(segments.at(-1)?.text).toBe(
			"\n\n<current-expert>工作周报</current-expert>\n请始终以该专家的角色与工作流推进本会话。",
		);
	});
});
