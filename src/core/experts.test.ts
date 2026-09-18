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
import { loadAgents, type AgentDefinition } from "./agents.ts";
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

/**
 * 样例用例的全局 agents 库：默认空（专家私有成员不与任何全局人格冲突）。
 * 专属的重名用例自己造一个传进去 —— 见「成员人格」describe。
 */
const NO_GLOBAL_AGENTS: readonly AgentDefinition[] = [];

function load(globalAgents: Parameters<typeof loadExperts>[3] = NO_GLOBAL_AGENTS): ReturnType<
	typeof loadExperts
> {
	return loadExperts(builtinDir, userDir, [globalSkillsDir], globalAgents);
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

/**
 * 造一个专家私有成员人格：<base>/<expert>/agents/<id>.md。
 * 格式与全局 agents 库一致（name/description/tools，tools 非空）。
 */
function writeExpertAgent(base: string, expert: string, id: string, tools = "[read, web_search]"): void {
	const agentsDir = join(base, expert, "agents");
	mkdirSync(agentsDir, { recursive: true });
	writeFileSync(join(agentsDir, `${id}.md`), expertDoc(`name: ${id}\ndescription: 成员${id}\ntools: ${tools}`));
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
		const experts = loadExperts(builtinDir, join(root, "不存在的目录"), [globalSkillsDir], NO_GLOBAL_AGENTS);
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

		expect(() => load()).toThrow(/技能名「docx」与全局技能重名/);
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
		expect(() => loadExperts(join(root, "没有"), userDir, [globalSkillsDir], NO_GLOBAL_AGENTS)).toThrow(
			/内置专家目录缺失/,
		);
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

	it("SKILL.md 缺 name → pi 用目录名兜底，技能仍加载（不报错）", () => {
		// 这条与旧行为相反：旧解析器要求 name 必填，而 pi（真正的加载方）在 name
		// 缺省时用技能目录名兜底并照常加载。加载器的口径跟着 pi 走，否则会出现
		// 「我们说这个技能坏了、模型却看得到它」。
		writeBuiltin("work-report");
		const skillDir = join(builtinDir, "work-report", "skills", "no-name");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(join(skillDir, "SKILL.md"), expertDoc("description: 只有描述"));

		const expert = load().find((e) => e.name === "work-report");
		expect(expert?.skillsDir).toBeDefined();
	});

	it("SKILL.md 缺 description → pi 不加载它，加载器报错（模型看不到 = 技能丢了）", () => {
		writeBuiltin("work-report");
		const skillDir = join(builtinDir, "work-report", "skills", "no-desc");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(join(skillDir, "SKILL.md"), "---\nname: no-desc\n---\n\n正文");

		expect(() => load()).toThrow(/SKILL\.md.*没有加载这个技能/);
	});

	it("私有技能与全局技能重名 → 抛错且含两边路径", () => {
		writeGlobalSkill("docx");
		writeBuiltin("work-report");
		writeExpertSkill(builtinDir, "work-report", "docx");

		const message = errorMessage(load);
		expect(message).toContain(join(globalSkillsDir, "docx", "SKILL.md"));
		expect(message).toContain(join(builtinDir, "work-report", "skills", "docx", "SKILL.md"));
	});

	it("两个专家的私有技能重名 → 允许（上游专家包共享技能池，且一会话只绑一个专家）", () => {
		writeBuiltin("expert-a");
		writeBuiltin("expert-b");
		writeExpertSkill(builtinDir, "expert-a", "shared");
		writeExpertSkill(builtinDir, "expert-b", "shared-dir", "shared");

		const experts = load();
		// 各自保留自己的那份（专家必须自包含：绑定谁都拿得到它的技能）。
		const a = experts.find((e) => e.name === "expert-a");
		const b = experts.find((e) => e.name === "expert-b");
		expect(a?.skillsDir).toBeDefined();
		expect(b?.skillsDir).toBeDefined();
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
	// 用户目录传一个必不存在的路径（root 由 beforeEach 建好，收集期拿不到）。
	const noUserDir = join(realBuiltin, "__不存在的用户目录__");
	/**
	 * 只加载一次，三个用例共用：loadExperts 现在会走 pi 的技能加载器（真 YAML 解析
	 * 每个 SKILL.md，14 个专家约 40 份），每处各调一次等于把这份开销乘三 ——
	 * 并行跑测试时会顶到别的用例的 5s 超时线（实测 doc-extract 因此偶发超时）。
	 * 写在 describe 体里 = 只在收集期付一次。
	 */
	const realExperts = loadExperts(
		realBuiltin,
		noUserDir,
		[
			realSkills,
			// 生产里全局技能有两个根（我们自己写的 + 照搬的插件），重名校验要按真实形态跑。
			resolve(realBuiltin, "..", "plugins"),
		],
		// 成员人格重名校验同样按真实形态跑：专家私有成员撞上全局 agents 库必须是
		// 真错误，这条断言就是「团队专家点名的成员真的都在它自己包里」的护栏。
		loadAgents(resolve(realBuiltin, "..", "agents"), noUserDir),
	);

	it("内置十六员齐全（目录布局），身份字段与 WorkBuddy 专家包一致", () => {
		// 后 9 员是「最佳实践案例」绑定的专家，从 WorkBuddy 专家中心照搬
		// （来源见各目录 README.md）；它们必须能被专家菜单正常列出。
		const experts = realExperts;
		expect(experts.map((e) => e.name)).toEqual([
			"data-analytics-reporter",
			"deep-research",
			"developer-evangelist",
			"equity-research",
			"gpt-researcher-team",
			"long-manuscript-expert",
			"market-researcher",
			"mvp-dev-expert-team",
			"openspec-doc-team",
			"ppt-creation-expert",
			"stock-partner-team",
			"technical-documentation-engineer",
			"trend-researcher",
			"ui-designer",
			"visual-storytelling-expert",
			"workspace-builder",
		]);
		// displayName/profession 是模式菜单与对话头部的展示字段，逐个钉死：
		// 少一个专家或错一个名字都要亮红，不用「非空」这类宽松断言。
		expect(Object.fromEntries(experts.map((e) => [e.name, e.displayName]))).toEqual({
			"data-analytics-reporter": "舒明析",
			"deep-research": "深研研",
			"developer-evangelist": "布道道",
			"equity-research": "严估深",
			"gpt-researcher-team": "深度研究团队",
			"long-manuscript-expert": "福帮手",
			"market-researcher": "严研行",
			"mvp-dev-expert-team": "MVP开发专家团",
			"openspec-doc-team": "专业文档生成团队",
			"ppt-creation-expert": "腾讯云知（乐享）",
			"stock-partner-team": "腾讯自选股股票投研专家团",
			"technical-documentation-engineer": "文通通",
			"trend-researcher": "风向标",
			"ui-designer": "像素君",
			"visual-storytelling-expert": "图说说",
			"workspace-builder": "小台",
		});
		expect(Object.fromEntries(experts.map((e) => [e.name, e.profession]))).toEqual({
			"data-analytics-reporter": "数据分析报告师",
			"deep-research": "深度研究专家",
			"developer-evangelist": "开发者布道师",
			"equity-research": "股票研究专家",
			"gpt-researcher-team": "多源深度研究报告工坊",
			"long-manuscript-expert": "长文档写作与改稿专家",
			"market-researcher": "行业研究员",
			"mvp-dev-expert-team": "MVP开发专家团",
			"openspec-doc-team": "专业文档生成团队",
			"ppt-creation-expert": "腾讯云PPT制作专家",
			"stock-partner-team": "腾讯自选股股票投研专家团",
			"technical-documentation-engineer": "技术文档工程师",
			"trend-researcher": "行业趋势专家",
			"ui-designer": "UI设计师",
			"visual-storytelling-expert": "视觉叙事专家",
			"workspace-builder": "工作台搭建师",
		});
	});

	it("四个团队型专家声明 expertType: team 且自带成员人格（spec: fix-team-expert-assets）", () => {
		const byName = new Map(realExperts.map((e) => [e.name, e]));
		expect(byName.get("gpt-researcher-team")?.expertType).toBe("team");
		expect(byName.get("gpt-researcher-team")?.agents.map((a) => a.name)).toEqual([
			"draft-reviewer",
			"draft-reviser",
			"report-publisher",
			"report-writer",
			"research-planner",
			"topic-researcher",
		]);
		expect(byName.get("openspec-doc-team")?.expertType).toBe("team");
		expect(byName.get("openspec-doc-team")?.agents.map((a) => a.name)).toEqual([
			"doc-auditor",
			"doc-generator",
			"doc-researcher",
		]);
		// 后两个是 2026-09-18 从本机 WorkBuddy 专家市场包搬来的真团队包
		expect(byName.get("mvp-dev-expert-team")?.expertType).toBe("team");
		expect(byName.get("mvp-dev-expert-team")?.agents.map((a) => a.name)).toEqual([
			"mvp-dev-expert-team-architect",
			"mvp-dev-expert-team-backend",
			"mvp-dev-expert-team-designer",
			"mvp-dev-expert-team-devops",
			"mvp-dev-expert-team-frontend",
			"mvp-dev-expert-team-pm",
			"mvp-dev-expert-team-qa",
		]);
		expect(byName.get("stock-partner-team")?.expertType).toBe("team");
		expect(byName.get("stock-partner-team")?.agents.map((a) => a.name)).toEqual([
			"contrarian-investor",
			"fundamental-researcher",
			"industry-strategist",
			"shortterm-surfer",
			"signal-chief",
			"valuation-analyst",
		]);
		// 其余 12 员是单体人格：不声明类型、不自带成员（声明了就会混进专家团页）
		for (const expert of realExperts) {
			if (expert.name.endsWith("-team")) continue;
			expect(expert.expertType, `${expert.name} 应为单体专家`).toBe("expert");
			expect(expert.agents, `${expert.name} 不应自带成员`).toEqual([]);
		}
	});

	it("私有技能分布：数量精确（技能 frontmatter 由 pi 的加载器判定，不是我们自解析）", () => {
		const experts = realExperts;
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
			"data-analytics-reporter": 0,
			// 它的 wechat-article-search 已在 resources/plugins/ 全局预装，故专家目录里不再放一份
			"deep-research": 0,
			"developer-evangelist": 0,
			"equity-research": 15,
			"gpt-researcher-team": 0,
			"long-manuscript-expert": 9,
			"market-researcher": 7,
			"mvp-dev-expert-team": 0,
			"openspec-doc-team": 0,
			// 同 deep-research：ppt-implement 技能已全局预装
			"ppt-creation-expert": 0,
			// 源包自带 3 个：westock-data / westock-tool / md-to-html
			"stock-partner-team": 3,
			"technical-documentation-engineer": 5,
			"trend-researcher": 3,
			"ui-designer": 1,
			"visual-storytelling-expert": 3,
			"workspace-builder": 0,
		});
	});

	it("每员的展示字段与正文人格齐全，且不顺带与全局技能重名", () => {
		const experts = realExperts;
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

describe("成员人格 agents/（spec: fix-team-expert-assets）", () => {
	it("有 agents/ → 解析为成员定义（与全局 agents 库同源）", () => {
		writeBuiltin("research-team");
		writeExpertAgent(builtinDir, "research-team", "topic-researcher", "[read, web_search, web_fetch]");

		const experts = load();
		const agents = experts.find((e) => e.name === "research-team")?.agents;
		expect(agents?.map((a) => a.name)).toEqual(["topic-researcher"]);
		expect(agents?.[0]).toMatchObject({
			description: "成员topic-researcher",
			tools: ["read", "web_search", "web_fetch"],
		});
	});

	it("没有 agents/ 目录 → 空数组（单体专家的常态）", () => {
		writeBuiltin("fin");
		expect(load().find((e) => e.name === "fin")?.agents).toEqual([]);
	});

	it("agents/ 为空目录 → 抛错（空壳会让「团队专家自带成员」的承诺静默失效）", () => {
		writeBuiltin("research-team");
		mkdirSync(join(builtinDir, "research-team", "agents"), { recursive: true });
		expect(errorMessage(() => load())).toContain("agents/ 目录为空");
	});

	it("成员文件 tools 为空 → 抛错（沿用全局库的校验，没有工具的成员无法工作）", () => {
		writeBuiltin("research-team");
		writeExpertAgent(builtinDir, "research-team", "idle-one", "[]");
		expect(errorMessage(() => load())).toContain("tools 不能为空数组");
	});

	it("成员名与全局 agents 库重名 → 抛错（team_create 的 find 会静默取先者）", () => {
		writeBuiltin("research-team");
		writeExpertAgent(builtinDir, "research-team", "scout");
		expect(errorMessage(() =>
			load([{ name: "scout", description: "全局侦察", tools: ["read"], model: undefined, body: "正文" }]),
		)).toContain("与全局 agents 库重名");
	});

	it("专家之间成员同名 → 允许（一个会话只绑定一个专家，成员永不同时在场）", () => {
		writeBuiltin("team-a");
		writeBuiltin("team-b");
		writeExpertAgent(builtinDir, "team-a", "reviewer-role");
		writeExpertAgent(builtinDir, "team-b", "reviewer-role");

		const experts = load();
		expect(experts.find((e) => e.name === "team-a")?.agents.map((a) => a.name)).toEqual(["reviewer-role"]);
		expect(experts.find((e) => e.name === "team-b")?.agents.map((a) => a.name)).toEqual(["reviewer-role"]);
	});
});

describe("expertType（spec: fix-team-expert-assets）", () => {
	it("声明 team → 解析为 team", () => {
		writeBuiltin("research-team", validFrontmatter("research-team") + "\nexpertType: team");
		expect(load().find((e) => e.name === "research-team")?.expertType).toBe("team");
	});

	it("未声明 → expert（缺省口径，12 个内置专家行为不变）", () => {
		writeBuiltin("fin");
		expect(load().find((e) => e.name === "fin")?.expertType).toBe("expert");
	});

	it("声明 expert → 解析为 expert", () => {
		writeBuiltin("fin", validFrontmatter("fin") + "\nexpertType: expert");
		expect(load().find((e) => e.name === "fin")?.expertType).toBe("expert");
	});

	it("非法值 → 抛错（静默回落 expert 会让团队专家从专家团页凭空消失）", () => {
		writeBuiltin("fin", validFrontmatter("fin") + "\nexpertType: squad");
		expect(errorMessage(() => load())).toContain("expertType");
	});
});
