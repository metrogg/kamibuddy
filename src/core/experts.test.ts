/**
 * experts 加载器的测试。
 *
 * 与 agents.test.ts 同款思路：加载器若静默吞错，专家以残缺的人格集运行
 * （甚至一个都没有），每条报错路径都有测试压着。
 * 末尾一组走真实 resources/experts/ 目录，防「内置五员」被重构改坏。
 *
 * 目录布局（spec: rework-expert-orthogonal-and-skills）：专家是 <name>/ 目录，
 * 内含 expert.md 与可选的 skills/（私有技能），故 fixture 也按目录造。
 */

import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadExperts } from "./experts.ts";

let root: string;
let builtinDir: string;
let userDir: string;
let globalSkillsDir: string;

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "kami-experts-"));
	builtinDir = join(root, "resources-experts");
	userDir = join(root, "user-experts");
	globalSkillsDir = join(root, "resources-skills");
	mkdirSync(builtinDir, { recursive: true });
	mkdirSync(globalSkillsDir, { recursive: true });
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

function load(): ReturnType<typeof loadExperts> {
	return loadExperts(builtinDir, userDir, globalSkillsDir);
}

/** 取抛错信息，没抛错则让测试响亮失败（直接 expect(...).toThrow 拿不到文案）。 */
function errorMessage(fn: () => unknown): string {
	try {
		fn();
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
	throw new Error("期望抛错，但没有抛");
}

function expertDoc(frontmatter: string, body = "正文"): string {
	return `---\n${frontmatter}\n---\n${body}`;
}

function validFrontmatter(name: string, description = `内置${name}`): string {
	return `name: ${name}\ndescription: ${description}\ndisplayName: ${name}显示名\nprofession: ${name}头衔\ndisplayDescription: ${name}一句话\nquickPrompts: [问题一, 问题二, 问题三]\ntags: [标签一, 标签二, 标签三]`;
}

/** 造一个专家目录：<base>/<name>/expert.md。 */
function writeExpert(base: string, name: string, frontmatter?: string, body?: string): void {
	mkdirSync(join(base, name), { recursive: true });
	writeFileSync(join(base, name, "expert.md"), expertDoc(frontmatter ?? validFrontmatter(name), body));
}

function writeBuiltin(name: string, frontmatter?: string, body?: string): void {
	writeExpert(builtinDir, name, frontmatter, body);
}

function writeUser(name: string, frontmatter?: string, body?: string): void {
	writeExpert(userDir, name, frontmatter ?? validFrontmatter(name, `用户${name}`), body);
}

/** 造一个专家私有技能：<base>/<expert>/skills/<dir>/SKILL.md（name 默认取目录名）。 */
function writeExpertSkill(base: string, expert: string, dir: string, name = dir): void {
	const skillDir = join(base, expert, "skills", dir);
	mkdirSync(skillDir, { recursive: true });
	writeFileSync(join(skillDir, "SKILL.md"), expertDoc(`name: ${name}\ndescription: 技能${name}`));
}

/** 造一个全局技能：<globalSkillsDir>/<dir>/SKILL.md。 */
function writeGlobalSkill(dir: string, name = dir): void {
	const skillDir = join(globalSkillsDir, dir);
	mkdirSync(skillDir, { recursive: true });
	writeFileSync(join(skillDir, "SKILL.md"), expertDoc(`name: ${name}\ndescription: 全局技能${name}`));
}

describe("正常加载", () => {
	it("按目录名序加载，字段齐全，无技能时 skillsDir 缺省", () => {
		writeBuiltin("tech-blog");
		writeBuiltin("legal-contract");

		const experts = load();
		expect(experts.map((e) => e.name)).toEqual(["legal-contract", "tech-blog"]);
		expect(experts[0]).toMatchObject({
			description: "内置legal-contract",
			displayName: "legal-contract显示名",
			profession: "legal-contract头衔",
			displayDescription: "legal-contract一句话",
			quickPrompts: ["问题一", "问题二", "问题三"],
			tags: ["标签一", "标签二", "标签三"],
			body: "正文",
		});
		expect(experts[0]?.skillsDir).toBeUndefined();
	});

	it("内置 + 用户合并：用户独有的追加在后", () => {
		writeBuiltin("work-report");
		writeUser("my-expert");

		expect(load().map((e) => e.name)).toEqual(["work-report", "my-expert"]);
	});

	it("同名用户级覆盖内置：身份与正文以用户文件为准", () => {
		writeBuiltin("work-report", undefined, "内置版正文");
		writeUser("work-report", validFrontmatter("work-report", "我的周报"), "用户版正文");

		const experts = load();
		expect(experts).toHaveLength(1);
		expect(experts[0]).toMatchObject({ description: "我的周报", body: "用户版正文" });
	});

	it("用户目录不存在 = 空，只返回内置", () => {
		writeBuiltin("work-report");
		const experts = loadExperts(builtinDir, join(root, "不存在的目录"), globalSkillsDir);
		expect(experts.map((e) => e.name)).toEqual(["work-report"]);
	});

	it("用户目录存在但为空 = 允许（用户清空了自己的专家）", () => {
		writeBuiltin("work-report");
		mkdirSync(userDir, { recursive: true });
		expect(load().map((e) => e.name)).toEqual(["work-report"]);
	});

	it("来源打点：内置 builtin、用户 user，同名覆盖后翻转为 user", () => {
		writeBuiltin("work-report");
		writeBuiltin("tech-blog");
		writeUser("my-expert");
		writeUser("tech-blog", validFrontmatter("tech-blog", "我的技术博客"));

		// 「我的专家」子页按 source === "user" 筛选，覆盖内置的用户文件必须算用户级。
		expect(Object.fromEntries(load().map((e) => [e.name, e.source]))).toEqual({
			"tech-blog": "user",
			"work-report": "builtin",
			"my-expert": "user",
		});
	});
});

describe("私有技能收集", () => {
	it("收集 skills/ 下的技能子目录，skillsDir 指向该目录", () => {
		writeBuiltin("stock-research-report");
		writeExpertSkill(builtinDir, "stock-research-report", "comps-valuation");
		writeExpertSkill(builtinDir, "stock-research-report", "dcf-model-builder");

		const expert = load().find((e) => e.name === "stock-research-report");
		expect(expert?.skillsDir).toBe(join(builtinDir, "stock-research-report", "skills"));
	});

	it("技能名取 SKILL.md 的 name（目录名不参与重名判定）", () => {
		writeGlobalSkill("docx");
		writeBuiltin("work-report");
		// 目录名与全局技能不同名，但 frontmatter name 撞上全局 —— 证明用的是 frontmatter name。
		writeExpertSkill(builtinDir, "work-report", "some-dir", "docx");

		expect(() => load()).toThrow(/技能名「docx」重复/);
	});

	it("技能子目录的附带文件与子目录不影响加载", () => {
		writeBuiltin("stock-research-report");
		writeExpertSkill(builtinDir, "stock-research-report", "initiating-coverage");
		mkdirSync(join(builtinDir, "stock-research-report", "skills", "initiating-coverage", "references"), {
			recursive: true,
		});
		writeFileSync(
			join(builtinDir, "stock-research-report", "skills", "initiating-coverage", "references", "note.md"),
			"# 参考资料",
		);

		const expert = load().find((e) => e.name === "stock-research-report");
		expect(expert?.skillsDir).toBe(join(builtinDir, "stock-research-report", "skills"));
	});

	it("全局技能的目录没有 SKILL.md → 跳过，不因它报错", () => {
		writeBuiltin("work-report");
		mkdirSync(join(globalSkillsDir, "docx", "agents"), { recursive: true });
		expect(load().map((e) => e.name)).toEqual(["work-report"]);
	});
});

describe("报错路径", () => {
	it("内置目录缺失 → 抛错（打包错误）", () => {
		expect(() => loadExperts(join(root, "没有"), userDir, globalSkillsDir)).toThrow(/内置专家目录缺失/);
	});

	it("内置目录为空 → 抛错", () => {
		expect(() => load()).toThrow(/内置专家目录为空/);
	});

	it("专家目录缺 expert.md → 抛错", () => {
		mkdirSync(join(builtinDir, "work-report"), { recursive: true });
		expect(() => load()).toThrow(/专家目录缺少 expert\.md/);
	});

	it("根级游离 .md（旧扁平布局残留）→ 抛错并指明迁移目标", () => {
		writeBuiltin("work-report");
		writeFileSync(join(builtinDir, "leftover.md"), "旧布局残留");

		const message = errorMessage(load);
		expect(message).toContain(join(builtinDir, "leftover.md"));
		expect(message).toContain(join(builtinDir, "leftover", "expert.md"));
		expect(message).toMatch(/专家已改为目录布局/);
	});

	it("专家目录里的 README.md 不算游离文件", () => {
		writeBuiltin("work-report");
		writeFileSync(join(builtinDir, "work-report", "README.md"), "# 说明");
		expect(load().map((e) => e.name)).toEqual(["work-report"]);
	});

	it("expert.md 里的 name 与目录名不一致 → 抛错（防改名漏改引用）", () => {
		writeBuiltin("work-report", validFrontmatter("改名了"));
		expect(() => load()).toThrow(/与目录名「work-report」不一致/);
	});

	it("缺 name → 抛错并带文件路径", () => {
		writeBuiltin("work-report", "description: D\ndisplayName: 显示\nprofession: 头衔\ndisplayDescription: 一句话\nquickPrompts: [一, 二, 三]");
		expect(() => load()).toThrow(/expert\.md.*name/);
	});

	it("缺 description → 抛错", () => {
		writeBuiltin("work-report", "name: work-report\ndisplayName: 显示\nprofession: 头衔\ndisplayDescription: 一句话\nquickPrompts: [一, 二, 三]");
		expect(() => load()).toThrow(/expert\.md.*description/);
	});

	it("缺 displayName → 抛错（模式菜单无可显示）", () => {
		writeBuiltin("work-report", "name: work-report\ndescription: D\nprofession: 头衔\ndisplayDescription: 一句话\nquickPrompts: [一, 二, 三]");
		expect(() => load()).toThrow(/expert\.md.*displayName/);
	});

	it("缺 profession → 抛错（模式菜单无可显示）", () => {
		writeBuiltin("work-report", "name: work-report\ndescription: D\ndisplayName: 显示\ndisplayDescription: 一句话\nquickPrompts: [一, 二, 三]");
		expect(() => load()).toThrow(/expert\.md.*profession/);
	});

	it("缺 displayDescription → 抛错（菜单副行无可显示）", () => {
		writeBuiltin("work-report", "name: work-report\ndescription: D\ndisplayName: 显示\nprofession: 头衔\nquickPrompts: [一, 二, 三]");
		expect(() => load()).toThrow(/expert\.md.*displayDescription/);
	});

	it("缺 quickPrompts → 抛错（起手 chips 无数据）", () => {
		writeBuiltin("work-report", "name: work-report\ndescription: D\ndisplayName: 显示\nprofession: 头衔\ndisplayDescription: 一句话");
		expect(() => load()).toThrow(/expert\.md.*quickPrompts/);
	});

	it("quickPrompts 数量不为 3 → 抛错指明数量", () => {
		writeBuiltin("work-report", "name: work-report\ndescription: D\ndisplayName: 显示\nprofession: 头衔\ndisplayDescription: 一句话\nquickPrompts: [一, 二]");
		expect(() => load()).toThrow(/expert\.md.*quickPrompts.*恰好 3 个/);
	});

	it("缺 tags → 抛错（市场页卡片 chips 与分类行无数据）", () => {
		writeBuiltin("work-report", "name: work-report\ndescription: D\ndisplayName: 显示\nprofession: 头衔\ndisplayDescription: 一句话\nquickPrompts: [一, 二, 三]");
		expect(() => load()).toThrow(/expert\.md.*tags/);
	});

	it("tags 数量不为 3 → 抛错指明数量", () => {
		writeBuiltin("work-report", "name: work-report\ndescription: D\ndisplayName: 显示\nprofession: 头衔\ndisplayDescription: 一句话\nquickPrompts: [一, 二, 三]\ntags: [一, 二]");
		expect(() => load()).toThrow(/expert\.md.*tags.*恰好 3 个/);
	});

	it("skills/ 为空 → 抛错（打包/放置错误，不静默跳过）", () => {
		writeBuiltin("work-report");
		mkdirSync(join(builtinDir, "work-report", "skills"), { recursive: true });
		expect(() => load()).toThrow(/skills\/ 目录为空/);
	});

	it("技能子目录缺 SKILL.md → 抛错", () => {
		writeBuiltin("work-report");
		mkdirSync(join(builtinDir, "work-report", "skills", "bad"), { recursive: true });
		expect(() => load()).toThrow(/技能目录缺少 SKILL\.md/);
	});

	it("SKILL.md 缺 name → 抛错", () => {
		writeBuiltin("work-report");
		const skillDir = join(builtinDir, "work-report", "skills", "no-name");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(join(skillDir, "SKILL.md"), expertDoc("description: 只有描述"));
		expect(() => load()).toThrow(/SKILL\.md.*name/);
	});

	it("私有技能与全局技能重名 → 抛错且含两边路径", () => {
		writeGlobalSkill("docx");
		writeBuiltin("work-report");
		writeExpertSkill(builtinDir, "work-report", "docx");

		const message = errorMessage(load);
		expect(message).toContain(join(globalSkillsDir, "docx", "SKILL.md"));
		expect(message).toContain(join(builtinDir, "work-report", "skills", "docx", "SKILL.md"));
	});

	it("两个专家的私有技能重名 → 抛错且含两边路径", () => {
		writeBuiltin("expert-a");
		writeBuiltin("expert-b");
		writeExpertSkill(builtinDir, "expert-a", "shared");
		writeExpertSkill(builtinDir, "expert-b", "shared-dir", "shared");

		const message = errorMessage(load);
		expect(message).toContain(join(builtinDir, "expert-a", "skills", "shared", "SKILL.md"));
		expect(message).toContain(join(builtinDir, "expert-b", "skills", "shared-dir", "SKILL.md"));
	});

	it("用户目录里的坏文件同样抛错，不因为是用户级就放宽", () => {
		writeBuiltin("work-report");
		writeUser("bad", "name: bad\ndescription: 只有描述");
		expect(() => load()).toThrow(/bad[\\/]expert\.md.*displayName/);
	});
});

describe("真实 resources/experts/ 的回归约束", () => {
	// 走真实目录而不是 mkdtemp 样例：防未来重构改坏内置五员的人格文件
	// （与 agents.test.ts 里内置四员回归测试同款防护）。
	const realBuiltin = resolve(import.meta.dirname, "..", "..", "resources", "experts");
	const realSkills = resolve(import.meta.dirname, "..", "..", "resources", "skills");
	// 用户目录传一个必不存在的路径（root 由 beforeEach 建好，收集期拿不到，故在 it 内求值）。
	const noUser = () => join(root, "无用户目录");

	it("内置五员齐全（目录布局），身份字段与 WorkBuddy 专家包一致", () => {
		const experts = loadExperts(realBuiltin, noUser(), realSkills);
		expect(experts.map((e) => e.name)).toEqual([
			"equity-research",
			"gpt-researcher-team",
			"long-manuscript-expert",
			"ui-designer",
			"workspace-builder",
		]);
		// displayName/profession 是模式菜单与对话头部的展示字段，逐个钉死：
		// 少一个专家或错一个名字都要亮红，不用「非空」这类宽松断言。
		expect(Object.fromEntries(experts.map((e) => [e.name, e.displayName]))).toEqual({
			"equity-research": "严估深",
			"gpt-researcher-team": "深度研究团队",
			"long-manuscript-expert": "福帮手",
			"ui-designer": "像素君",
			"workspace-builder": "小台",
		});
		expect(Object.fromEntries(experts.map((e) => [e.name, e.profession]))).toEqual({
			"equity-research": "股票研究专家",
			"gpt-researcher-team": "多源深度研究报告工坊",
			"long-manuscript-expert": "长文档写作与改稿专家",
			"ui-designer": "UI设计师",
			"workspace-builder": "工作台搭建师",
		});
	});

	it("私有技能分布：只有三人带私有技能，数量精确", () => {
		const experts = loadExperts(realBuiltin, noUser(), realSkills);
		const counts = Object.fromEntries(
			experts.map((e) => [
				e.name,
				// skillsDir 缺省即无私有技能；有则数 skills/ 下的技能子目录数。
				e.skillsDir === undefined
					? 0
					: readdirSync(e.skillsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length,
			]),
		);
		expect(counts).toEqual({
			"equity-research": 15,
			"gpt-researcher-team": 0,
			"long-manuscript-expert": 9,
			"ui-designer": 1,
			"workspace-builder": 0,
		});
	});

	it("每员的展示字段与正文人格齐全，且不顺带与全局技能重名", () => {
		const experts = loadExperts(realBuiltin, noUser(), realSkills);
		for (const expert of experts) {
			expect(expert.displayName, `${expert.name} 应有 displayName`).not.toBe("");
			expect(expert.profession, `${expert.name} 应有 profession`).not.toBe("");
			expect(expert.description, `${expert.name} 应有 description`).not.toBe("");
			expect(expert.displayDescription, `${expert.name} 应有 displayDescription`).not.toBe("");
			// 起手 chips 固定 3 个，菜单与对话页按此排版。
			expect(expert.quickPrompts, `${expert.name} 应有 3 个 quickPrompts`).toHaveLength(3);
			for (const prompt of expert.quickPrompts) {
				expect(prompt, `${expert.name} 的 quickPrompts 不应有空项`).not.toBe("");
			}
			// 卡片 tag chips 与分类行固定按 3 个排版。
			expect(expert.tags, `${expert.name} 应有 3 个 tags`).toHaveLength(3);
			for (const tag of expert.tags) {
				expect(tag, `${expert.name} 的 tags 不应有空项`).not.toBe("");
			}
			// 正文人格是注入提示词的主体，空正文等于人格丢失。
			expect(expert.body.length, `${expert.name} 应有正文人格`).toBeGreaterThan(0);
		}
	});
});

describe("extraTools（spec: add-team-foundations）", () => {
	it("声明 extraTools → 解析为字符串数组", () => {
		writeBuiltin("fin", validFrontmatter("fin") + "\nextraTools: [task, web_search]");
		const experts = load();
		expect(experts.find((e) => e.name === "fin")?.extraTools).toEqual(["task", "web_search"]);
	});

	it("未声明 → undefined（缺省不追加，行为与现状一致）", () => {
		writeBuiltin("fin");
		expect(load().find((e) => e.name === "fin")?.extraTools).toBeUndefined();
	});

	it("空数组归一为 undefined（追加空集无语义，不留空壳）", () => {
		writeBuiltin("fin", validFrontmatter("fin") + "\nextraTools: []");
		expect(load().find((e) => e.name === "fin")?.extraTools).toBeUndefined();
	});

	it("非字符串数组 → 抛错（元素含非字符串同样不放过）", () => {
		writeBuiltin("fin", validFrontmatter("fin") + "\nextraTools: 不是数组");
		expect(errorMessage(() => load())).toContain("extraTools");
	});
});
