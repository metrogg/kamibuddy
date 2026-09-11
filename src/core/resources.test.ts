/**
 * resources/ 加载器的测试。
 *
 * 加载器是「能力即数据」的入口；它若静默吞错，产品会以错误身份运行
 * （回落到 pi 的 coding assistant 提示词）。每条报错路径都有测试压着。
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { composePromptWithMeta } from "./prompt-composer.ts";
import { loadResources, resolveStyle, toDescriptors, type StyleResource } from "./resources.ts";

let dir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "kami-res-"));
	// styles/ 基线 fixture（理由见 writeStyle 注释）。
	writeStyle();
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

function writeScene(id: string, body = "骨架 {{interaction}}"): void {
	mkdirSync(join(dir, "scenes", id), { recursive: true });
	writeFileSync(
		join(dir, "scenes", id, "prompt.md"),
		`---\nid: ${id}\nlabel: 场景${id}\ndescription: 描述\nready: true\n---\n${body}`,
	);
}

function writeMode(id: string, tools = "[read]", body = "行为段"): void {
	mkdirSync(join(dir, "modes"), { recursive: true });
	writeFileSync(
		join(dir, "modes", `${id}.md`),
		`---\nid: ${id}\nlabel: 模式${id}\ndescription: 描述\nready: true\ntools: ${tools}\n---\n${body}`,
	);
}

/**
 * styles/ 与 scenes、modes 同是资源目录完整性的必需成员（缺了启动即抛错），
 * 所以每个 fixture 默认带一个合法风格；要测 styles 自身的报错路径时
 * 各用例自己清掉/改写这个基线。
 */
function writeStyle(id = "professional", body = "风格正文"): void {
	mkdirSync(join(dir, "styles"), { recursive: true });
	writeFileSync(join(dir, "styles", `style-${id}.md`), body);
}

describe("正常加载", () => {
	it("扫描场景与模式，ready 与工具白名单正确", () => {
		writeScene("work");
		writeMode("craft", "[read, write, edit]");
		writeMode("ask");

		const resources = loadResources(dir);
		expect(resources.scenes).toHaveLength(1);
		expect(resources.scenes[0]).toMatchObject({ id: "work", ready: true, body: "骨架 {{interaction}}" });
		expect(resources.modes.map((m) => m.id)).toEqual(["ask", "craft"]);
		expect(resources.modes.find((m) => m.id === "craft")?.tools).toEqual(["read", "write", "edit"]);
	});

	it("toDescriptors 只下发展示字段，工具白名单不下发", () => {
		writeScene("work");
		writeMode("craft", "[read]");
		const { scenes, modes } = toDescriptors(loadResources(dir));

		expect(scenes[0]).toEqual({ id: "work", label: "场景work", description: "描述", ready: true });
		const mode = modes[0];
		expect(mode).toEqual({ id: "craft", label: "模式craft", description: "描述", ready: true });
		// ModeDescriptor 上不应存在 tools —— UI 不需要也不该知道。
		expect(mode === undefined ? [] : Object.keys(mode)).not.toContain("tools");
	});

	it("ready 缺省为 false（漏写 = 不可选，安全侧默认）", () => {
		mkdirSync(join(dir, "scenes", "work"), { recursive: true });
		writeFileSync(
			join(dir, "scenes", "work", "prompt.md"),
			"---\nid: work\nlabel: L\ndescription: D\n---\n正文",
		);
		writeMode("craft");

		expect(loadResources(dir).scenes[0]?.ready).toBe(false);
	});
});

describe("报错路径", () => {
	it("目录缺失 → 抛错并提示 KAMIBUDDY_RESOURCES_DIR", () => {
		expect(() => loadResources(join(dir, "不存在"))).toThrow(/KAMIBUDDY_RESOURCES_DIR/);
	});

	it("场景目录缺 prompt.md → 抛错", () => {
		mkdirSync(join(dir, "scenes", "work"), { recursive: true });
		mkdirSync(join(dir, "modes"), { recursive: true });
		writeMode("craft");
		expect(() => loadResources(dir)).toThrow(/缺少 prompt\.md/);
	});

	it("frontmatter id 与目录名不一致 → 抛错", () => {
		mkdirSync(join(dir, "scenes", "work"), { recursive: true });
		writeFileSync(join(dir, "scenes", "work", "prompt.md"), "---\nid: 其他\nlabel: L\ndescription: D\n---\nx");
		mkdirSync(join(dir, "modes"), { recursive: true });
		writeMode("craft");
		// 报错里会带目录名（与目录名「work」不一致），所以断言两段而不是连续子串。
		expect(() => loadResources(dir)).toThrow(/id「其他」与目录名/);
	});

	it("模式缺 tools 字段 → 抛错（无白名单等于给全部工具，不可默认）", () => {
		writeScene("work");
		mkdirSync(join(dir, "modes"), { recursive: true });
		writeFileSync(join(dir, "modes", "craft.md"), "---\nid: craft\nlabel: L\ndescription: D\n---\nx");
		expect(() => loadResources(dir)).toThrow(/tools/);
	});

	it("空 scenes / 空 modes → 抛错", () => {
		mkdirSync(join(dir, "scenes"), { recursive: true });
		mkdirSync(join(dir, "modes"), { recursive: true });
		expect(() => loadResources(dir)).toThrow(/没有任何场景/);

		writeScene("work");
		expect(() => loadResources(dir)).toThrow(/没有任何交互模式/);
	});
});

describe("风格加载", () => {
	it("id 从文件名取，label 来自集中映射，body 是文件全文", () => {
		writeScene("work");
		writeMode("craft");
		const { styles } = loadResources(dir);
		expect(styles).toEqual([{ id: "professional", label: "专业严谨", body: "风格正文" }]);
	});

	it("非 style-*.md 命名的文件跳过（README 等文档不当风格）", () => {
		writeScene("work");
		writeMode("craft");
		writeFileSync(join(dir, "styles", "README.md"), "# 说明");
		expect(loadResources(dir).styles).toHaveLength(1);
	});

	it("styles/ 目录缺失 → 抛「资源目录不完整」（与 scenes/modes 同口径）", () => {
		rmSync(join(dir, "styles"), { recursive: true, force: true });
		writeScene("work");
		writeMode("craft");
		expect(() => loadResources(dir)).toThrow(/资源目录不完整/);
	});

	it("styles/ 为空 → 抛错（没有风格的产品是错的，同空 scenes 口径）", () => {
		rmSync(join(dir, "styles"), { recursive: true, force: true });
		mkdirSync(join(dir, "styles"), { recursive: true });
		writeScene("work");
		writeMode("craft");
		expect(() => loadResources(dir)).toThrow(/没有任何回复风格/);
	});

	it("风格文件在 STYLE_LABELS 无映射 → 抛错（不静默带无名风格上线）", () => {
		writeScene("work");
		writeMode("craft");
		writeStyle("unknown-style");
		expect(() => loadResources(dir)).toThrow(/未知风格「unknown-style」/);
	});

	it("风格文件为空 → 抛错（空段注入提示词等于埋空洞）", () => {
		writeScene("work");
		writeMode("craft");
		writeStyle("professional", "  \n");
		expect(() => loadResources(dir)).toThrow(/风格文件为空/);
	});
});

describe("片段加载（prompts/fragments）", () => {
	function writeFragment(name: string, body: string): void {
		mkdirSync(join(dir, "prompts", "fragments"), { recursive: true });
		writeFileSync(join(dir, "prompts", "fragments", name), body);
	}

	it("目录不存在 → 空 Map（缺目录 = 无片段，不抛错）", () => {
		writeScene("work");
		writeMode("craft");
		const { fragments } = loadResources(dir);
		expect(fragments.size).toBe(0);
	});

	it("name → 正文；非 .md 与点开头文件跳过", () => {
		writeScene("work");
		writeMode("craft");
		writeFragment("delivery-rules.md", "交付纪律三条\n");
		writeFragment("identity.md", "身份段");
		writeFragment("notes.txt", "不是片段");
		writeFragment(".hidden.md", "隐藏文件");
		const { fragments } = loadResources(dir);
		expect([...fragments.keys()].sort()).toEqual(["delivery-rules", "identity"]);
		expect(fragments.get("delivery-rules")).toBe("交付纪律三条\n");
	});

	it("片段名无法被 {{> }} 引用（中文名）→ 抛错（死文件不许留着）", () => {
		writeScene("work");
		writeMode("craft");
		writeFragment("交付纪律.md", "内容");
		expect(() => loadResources(dir)).toThrow(/无法被 \{\{> \}\} 指令引用/);
	});

	it("片段文件为空 → 抛错（引用它就是埋一个空洞）", () => {
		writeScene("work");
		writeMode("craft");
		writeFragment("empty.md", "  \n");
		expect(() => loadResources(dir)).toThrow(/片段文件为空/);
	});
});

describe("resolveStyle（styleId 三态）", () => {
	const STYLES: readonly StyleResource[] = [
		{ id: "professional", label: "专业严谨", body: "专业正文" },
		{ id: "socratic", label: "苏格拉底", body: "苏格拉底正文" },
	];

	it("undefined（未配置）→ 默认风格 professional", () => {
		const { style, driftedFrom } = resolveStyle(STYLES, undefined);
		expect(style?.id).toBe("professional");
		expect(driftedFrom).toBeUndefined();
	});

	it("空串（显式关闭）→ style 为 undefined（不注入）", () => {
		const { style, driftedFrom } = resolveStyle(STYLES, "");
		expect(style).toBeUndefined();
		expect(driftedFrom).toBeUndefined();
	});

	it("指定存在的 id → 该风格", () => {
		const { style, driftedFrom } = resolveStyle(STYLES, "socratic");
		expect(style?.id).toBe("socratic");
		expect(driftedFrom).toBeUndefined();
	});

	it("指定 id 不存在 → 降级默认风格并带回 driftedFrom（调用方记日志）", () => {
		const { style, driftedFrom } = resolveStyle(STYLES, "ghost");
		expect(style?.id).toBe("professional");
		expect(driftedFrom).toBe("ghost");
	});

	it("默认风格本身缺失 → 抛错（安装损坏，不静默无风格上线）", () => {
		const broken: readonly StyleResource[] = [{ id: "socratic", label: "苏格拉底", body: "x" }];
		expect(() => resolveStyle(broken, undefined)).toThrow(/默认回复风格/);
		expect(() => resolveStyle(broken, "ghost")).toThrow(/默认回复风格/);
	});
});

describe("真实 resources/ 的回归约束", () => {
	it("7 个回复风格全部加载，id 与中文名对照正确", () => {
		// F8 风格系统的数据面（spec: systematize-prompt-architecture）：
		// 文件搬用 WorkBuddy 5.5.4，id/label 对照表见 resources/styles/README.md。
		const realDir = resolve(import.meta.dirname, "..", "..", "resources");
		const { styles } = loadResources(realDir);
		// readdir 排序后 id 序固定，钉住防漏文件。
		expect(styles.map((s) => s.id)).toEqual([
			"creative",
			"efficient",
			"friendly",
			"professional",
			"sarcastic",
			"socratic",
			"straightforward",
		]);
		expect(Object.fromEntries(styles.map((s) => [s.id, s.label]))).toEqual({
			professional: "专业严谨",
			friendly: "亲和",
			efficient: "高效",
			creative: "创意",
			sarcastic: "毒舌",
			socratic: "苏格拉底",
			straightforward: "直白",
		});
		for (const style of styles) {
			expect(style.body.trim().length, `风格 ${style.id} 应有正文`).toBeGreaterThan(0);
		}
	});

	it("craft 与 ask 的 tools 白名单必须含 present_files", () => {
		// 防未来重构时再次漏挂（2026-09-09 事故：注册进扩展但白名单没加，
		// 模型在真实会话里根本看不到 present_files，交付从来没发生过）。
		// 走 getResourcesDir() 读真实目录，不是 mkdtemp 的样例。
		const realDir = resolve(import.meta.dirname, "..", "..", "resources");
		const { modes } = loadResources(realDir);
		for (const id of ["craft", "ask"]) {
			const mode = modes.find((m) => m.id === id);
			expect(mode, `模式 ${id} 应存在`).toBeDefined();
			expect(mode?.tools, `模式 ${id} 的 tools 应含 present_files`).toContain("present_files");
		}
	});

	it("automation 三工具只在 craft 白名单，ask / plan 只读模式没有", () => {
		// 与 present_files 同款防护：扩展注册了但模式白名单漏加，模型就看不到工具。
		// ask / plan 是只读模式，不能建任务（spec：只读模式不加）。
		const realDir = resolve(import.meta.dirname, "..", "..", "resources");
		const { modes } = loadResources(realDir);
		const craft = modes.find((m) => m.id === "craft");
		expect(craft, "模式 craft 应存在").toBeDefined();
		for (const tool of ["automation_create", "automation_list", "automation_delete"]) {
			expect(craft?.tools, `craft 的 tools 应含 ${tool}`).toContain(tool);
		}
		for (const id of ["ask", "plan"]) {
			const mode = modes.find((m) => m.id === id);
			expect(mode?.tools, `${id} 不应有 automation_create`).not.toContain("automation_create");
		}
	});

	it("read_me / show_widget 在 craft 与 ask 白名单，plan 不加", () => {
		// 与 present_files 同款防护。plan 只读调研、产出是计划文本，
		// 不产出可视化交付，明确不加（spec: add-inline-widgets；
		// 取舍同步注释在 resources/modes/plan.md 的 frontmatter 里）。
		const realDir = resolve(import.meta.dirname, "..", "..", "resources");
		const { modes } = loadResources(realDir);
		for (const id of ["craft", "ask"]) {
			const mode = modes.find((m) => m.id === id);
			expect(mode, `模式 ${id} 应存在`).toBeDefined();
			for (const tool of ["read_me", "show_widget"]) {
				expect(mode?.tools, `模式 ${id} 的 tools 应含 ${tool}`).toContain(tool);
			}
		}
		const plan = modes.find((m) => m.id === "plan");
		for (const tool of ["read_me", "show_widget"]) {
			expect(plan?.tools, `plan 不应有 ${tool}`).not.toContain(tool);
		}
	});

	it("场景轴加载出 work + code 两个场景，code 已就绪（design 占位不在库中）", () => {
		// F3 场景矩阵第二轴（spec: systematize-prompt-architecture）：
		// code 骨架搬用 WorkBuddy welcomemode/code 的 prompt.tpl 适配；
		// ready:true 才会被 requireReady 放行、首页页签可切换。
		const realDir = resolve(import.meta.dirname, "..", "..", "resources");
		const { scenes } = loadResources(realDir);
		expect(scenes.map((s) => s.id)).toEqual(["code", "work"]);
		const code = scenes.find((s) => s.id === "code");
		expect(code, "场景 code 应存在").toBeDefined();
		expect(code?.ready, "code 应已就绪（首页「代码开发」页签可切换）").toBe(true);
		expect(scenes.find((s) => s.id === "work")?.ready).toBe(true);
	});

	it("code 骨架经 composePromptWithMeta × 四个真实模式组装：无抛错、关键段落存在、分段拼接与全文一致", () => {
		// 与 daemon 的 composeSystemPrompt 同款输入：真实骨架 + 真实模式行为段 +
		// 真实片段库查表。组装期抛错（残留槽位 / 片段缺失）在这里拦下，
		// 不等到用户切到「代码开发」才炸。
		const realDir = resolve(import.meta.dirname, "..", "..", "resources");
		const resources = loadResources(realDir);
		const code = resources.scenes.find((s) => s.id === "code");
		expect(code).toBeDefined();
		for (const mode of resources.modes) {
			const composed = composePromptWithMeta({
				sceneBody: code?.body ?? "",
				modeBody: mode.body,
				skillsSection: "",
				cwd: "C:\\ws",
				modeId: mode.id,
				resolveFragment: (name) => resources.fragments.get(name),
			});
			expect(composed.text, `code × ${mode.id} 不应有残留槽位`).not.toMatch(/\{\{[^{}]*\}\}/);
			expect(
				composed.segments.map((s) => s.text).join(""),
				`code × ${mode.id} 的分段拼接应与全文字节一致`,
			).toBe(composed.text);
			expect(composed.segments.some((s) => s.source === "skeleton")).toBe(true);
			expect(composed.segments.some((s) => s.source === `mode:${mode.id}`)).toBe(true);
		}
		// 关键段落钉住（craft / expert 模式正文引用「上方『交付』段」，骨架缺了引用就落空）。
		const craft = resources.modes.find((m) => m.id === "craft");
		const text = composePromptWithMeta({
			sceneBody: code?.body ?? "",
			modeBody: craft?.body ?? "",
			skillsSection: "",
			cwd: "C:\\ws",
			modeId: "craft",
			resolveFragment: (name) => resources.fragments.get(name),
		}).text;
		for (const section of ["# 交付", "# 个人文件安全", "# 当前模式", "present_files", "当前工作目录：C:\\ws"]) {
			expect(text, `code 骨架应含「${section}」`).toContain(section);
		}
	});

	it("questionnaire 三模式白名单都有；powershell 只在 craft", () => {
		// 与 present_files 同款防护。questionnaire 三模式都加（plan 尤其需要：
		// 调研阶段就该把方向问清，spec: add-questionnaire-and-powershell）；
		// powershell 只给 craft（ask / plan 是只读模式，不给 shell）。
		const realDir = resolve(import.meta.dirname, "..", "..", "resources");
		const { modes } = loadResources(realDir);
		for (const id of ["craft", "ask", "plan"]) {
			const mode = modes.find((m) => m.id === id);
			expect(mode?.tools, `模式 ${id} 的 tools 应含 questionnaire`).toContain("questionnaire");
		}
		const craft = modes.find((m) => m.id === "craft");
		expect(craft?.tools, "craft 的 tools 应含 powershell").toContain("powershell");
		for (const id of ["ask", "plan"]) {
			const mode = modes.find((m) => m.id === id);
			expect(mode?.tools, `${id} 不应有 powershell`).not.toContain("powershell");
		}
	});
});
