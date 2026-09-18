/**
 * 专家定义加载器：resources/experts/（内置）+ 用户级 getConfigDir()/experts/。
 *
 * 「能力即数据」（AGENTS.md §3）：加一个专家 = experts/ 下加一个 <name>/ 目录，
 * 零行代码改动。与 agents.ts 同族，但专家是**主会话级人格**（spec:
 * add-expert-mode，WorkBuddy PluginAgentPrompt 的等价物），不是子代理——
 * 工具面默认由交互模式统一分配。
 *
 * 立场修订（2026-09-16，spec: add-team-foundations）：新增可选 `extraTools`
 * （frontmatter `extraTools: [a, b]`）——**白名单追加**语义，生效工具集 =
 * mode.tools ∪ extraTools。WorkBuddy 用 expertType:"team" 联动 env 开关给
 * 专家团会话加团队工具四件套，我们是同构的声明式落点。专家只能增不能删
 * 模式给的工具（删工具是模式轴的职责）。内置专家不声明，行为不变。
 *
 * 目录布局（spec: rework-expert-orthogonal-and-skills）：专家是一个包，
 * `<name>/expert.md` 是人设，可选的 `<name>/skills/` 装该专家私有的技能——
 * 对齐 WorkBuddy 专家包 `agents/ + skills/` 的形状，让「估值、建模、研报流程」
 * 这类专业方法有处安放，且只在绑定该专家时可见。
 *
 * 合并语义：用户级与内置按 name 对齐，同名用户级覆盖内置。项目级专家明确不做。
 *
 * 校验从紧（坏文件抛错而非忽略）：
 *   - frontmatter 的 name 必须与目录名一致（防改名漏改引用，与 agents/modes 同款）
 *   - 专家根目录出现游离的顶层 .md 文件 → 抛错：那是旧扁平布局（<name>.md）的残留，
 *     只遍历目录会把它静默漏掉，等于专家凭空消失
 *   - 专家目录缺 expert.md → 抛错
 *   - name/description/displayName/profession/displayDescription/quickPrompts/tags 缺失 → 抛错
 *     （displayName/profession/displayDescription 是模式菜单与对话头部的展示字段，
 *     quickPrompts 是对话页起手 chips 的数据源，tags 是专家市场页卡片 chips
 *     与分类行的数据源，缺了 UI 无可显示）
 *   - quickPrompts 不是恰好 3 个字符串的数组 → 抛错（chips 固定 3 个，
 *     少了排不满、多了放不下，宽严都会让 UI 静默变形）
 *   - tags 不是恰好 3 个字符串的数组 → 抛错（与 quickPrompts 同理：
 *     卡片固定排 3 个 tag chip）
 *   - skills/ 存在但没有任何技能子目录 → 抛错（空目录是打包/放置错误，
 *     静默跳过会让「专家带了技能」这个承诺失效）
 *   - 技能子目录缺 SKILL.md，或 SKILL.md 缺 name → 抛错
 *   - 私有技能名与全局技能（resources/skills/）或其它专家的私有技能重名 → 抛错
 *     （技能名是模型调用技能的唯一键，重名会让两边互相覆盖）
 *   - 内置目录缺失或为空 → 抛错：没有内置专家是打包错误，静默空跑等于
 *     专家菜单在真实会话里一片空白
 *   - 用户目录不存在 = 空（用户没有自定义是正常状态，不是错误）
 *
 * 立场修订（2026-09-18，spec: fix-team-expert-assets）：专家目录新增可选
 * `agents/`（成员人格）与 frontmatter `expertType: expert | team`。起因是照搬的
 * 团队型专家正文指挥 `TeamCreate` / `Agent(subagent_type)` 而成员人格根本不存在
 * （`resources/agents/` 只有四个通用角色），`team_create` 必然在 spawn 校验处
 * 失败并整队解散。「专家包自带成员」是 WorkBuddy 专家团包的形状，也是让团队
 * 专家自包含的唯一落点。
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { loadSkills } from "@earendil-works/pi-coding-agent";
import { loadAgentsDir, type AgentDefinition } from "./agents.ts";
import { optionalString, optionalStringArray, parseFrontmatter, requireString, requireStringArray } from "./frontmatter.ts";

/** 专家人设文件名（目录布局：<name>/expert.md）。 */
const EXPERT_FILE = "expert.md";
/** 专家私有技能目录名（<name>/skills/）。 */
const SKILLS_DIR = "skills";
/** 技能入口文件名（<name>/skills/<skill>/SKILL.md）。 */
const SKILL_FILE = "SKILL.md";
/** 专家私有成员人格目录名（<name>/agents/）。 */
const AGENTS_DIR = "agents";

/** `expertType` 的合法取值（缺省按 expert 解释，见 ExpertDefinition.expertType）。 */
const EXPERT_TYPES = ["expert", "team"] as const;

export interface ExpertDefinition {
	readonly name: string;
	readonly description: string;
	readonly displayName: string;
	readonly profession: string;
	/** 一句话能力描述（专家菜单副行）。 */
	readonly displayDescription: string;
	/** 起手问题，恰好 3 个（对话页输入区上方的可点 chips）。 */
	readonly quickPrompts: readonly string[];
	/** 领域关键词，恰好 3 个（专家市场页卡片 tag chips 与分类行聚合的数据源）。 */
	readonly tags: readonly string[];
	/**
	 * 来源目录。加载器在合并时打点（加载单文件时来源未知，由目录级函数盖章）：
	 * 同名用户级覆盖内置后即为 "user" —— 专家市场页「我的专家」子页靠它筛选。
	 */
	readonly source: "builtin" | "user";
	/**
	 * 私有技能目录（<name>/skills/）的绝对路径；该专家没有私有技能时为 undefined。
	 * 会话绑定时 daemon 把它追加进 pi loadSkills 的 skillPaths（spec: 技能预加载）。
	 */
	readonly skillsDir?: string;
	/**
	 * 专家追加的工具白名单（mode.tools ∪ extraTools，spec: add-team-foundations）。
	 * 缺省 = 不追加，工具集与模式白名单完全一致。WorkBuddy expertType:"team"
	 * 的声明式等价物：专家包声明它需要哪些模式白名单之外的工具（如 task）。
	 */
	readonly extraTools?: readonly string[];
	/**
	 * 专家形态（spec: fix-team-expert-assets）。缺省 `"expert"`（单体人格）；
	 * `"team"` = 团队型专家（主理人），专家市场「专家团」子页按它筛选。
	 *
	 * 对齐 WorkBuddy 的 `expertType` 词汇，但**只取两值**：它的另两值
	 * （skill / plugin）在我们这里没有对应运行时，加了就是死字段（AGENTS.md §9）。
	 */
	readonly expertType: "expert" | "team";
	/**
	 * 专家私有的成员人格（`<name>/agents/*.md`，spec: fix-team-expert-assets）。
	 * 没有 `agents/` 目录时为空数组。
	 *
	 * 与 `skillsDir` 不同：技能交给 pi 按路径加载，成员人格由我们自己消费
	 * （daemon 装配时与全局 agents 库合并成 team 工具的可用成员清单），
	 * 所以这里直接带已解析的定义而不是目录路径。
	 */
	readonly agents: readonly AgentDefinition[];
	readonly body: string;
}

/** 一个技能名与它的 SKILL.md 绝对路径——重名报错要指名两边的文件。 */
interface SkillRef {
	readonly name: string;
	readonly file: string;
}

/** 加载中途的专家：def 连来源，skills 单独留一份供重名校验（不对外暴露）。 */
interface LoadedExpert {
	readonly def: Omit<ExpertDefinition, "source">;
	readonly source: "builtin" | "user";
	readonly skills: readonly SkillRef[];
}

/**
 * 专家根目录 / 专家目录里游离的顶层 .md。README.md 是文档、expert.md 是人设本体，
 * 都不算游离；只遍历目录（或只看 expert.md）会把这些残留静默漏掉。
 */
function strayMarkdown(dir: string, allowed: readonly string[]): readonly string[] {
	return readdirSync(dir, { withFileTypes: true })
		.filter(
			(entry) =>
				entry.isFile() &&
				entry.name.endsWith(".md") &&
				!entry.name.startsWith(".") &&
				entry.name !== "README.md" &&
				!allowed.includes(entry.name),
		)
		.map((entry) => entry.name)
		.sort();
}

/**
 * 收集专家私有技能（<expertDir>/skills/ 下的子目录）；没有 skills/ 目录 → 空。
 *
 * 技能 frontmatter **交给 pi 的 `loadSkills` 解析**，不用我们自己的 parseFrontmatter：
 * 照搬来的上游技能会用嵌套映射（如 `metadata:`）这类真 YAML 构造，我们那个极简
 * 解析器刻意不支持；而运行时真正把技能喂给模型的就是 pi（真 yaml 包）。
 * 两边同源才不会出现「我们说这个技能没问题、pi 说不认」的错配。
 *
 * pi 的处置口径（`core/skills.ts` 的 loadSkillFromFile，已核对源码）：
 *   - `name` 缺省 → 取技能目录名兜底，技能照常加载；
 *   - name/description 不合规范（超长、非法字符）→ 只算 warning，**仍然加载**；
 *   - description 缺失/为空、或 frontmatter 解析失败 → 该技能不加载。
 * 所以「技能丢没丢」只认一件事：它有没有出现在 pi 返回的 skills 里 —— 这也是
 * 本函数唯一会抛错的判断（目录形状另算）。warning 不抛：那是内容侧的规范问题，
 * 改的是照搬资产，不该在加载器里拦停会话。
 */
function loadExpertSkills(expertDir: string): readonly SkillRef[] {
	const skillsDir = join(expertDir, SKILLS_DIR);
	if (!existsSync(skillsDir)) return [];
	const skillDirs = readdirSync(skillsDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
		.map((entry) => entry.name)
		.sort();
	if (skillDirs.length === 0) {
		throw new Error(
			`${skillsDir}: 专家的 skills/ 目录为空。技能必须放在 <技能名>/SKILL.md 下；没有私有技能就删掉该目录`,
		);
	}
	for (const dirName of skillDirs) {
		if (!existsSync(join(skillsDir, dirName, SKILL_FILE))) {
			throw new Error(`${join(skillsDir, dirName)}: 技能目录缺少 ${SKILL_FILE}`);
		}
	}

	const { skills } = loadSkills({
		cwd: skillsDir,
		agentDir: skillsDir,
		skillPaths: [skillsDir],
		includeDefaults: false,
	});

	const byDir = new Map(skills.map((skill) => [basename(dirname(skill.filePath)), skill]));
	return skillDirs.map((dirName) => {
		const skill = byDir.get(dirName);
		if (skill === undefined) {
			throw new Error(
				`${join(skillsDir, dirName, SKILL_FILE)}: pi 没有加载这个技能（frontmatter 不合法，或缺 description）—— 这样模型看不到它`,
			);
		}
		return { name: skill.name, file: skill.filePath };
	});
}

/**
 * 收集专家私有成员人格（`<expertDir>/agents/*.md`）；没有 `agents/` 目录 → 空。
 *
 * 解析与校验全部复用 `core/agents.ts` 的 `loadAgentsDir`（name 必须等于文件名、
 * description/tools 必填、tools 非空），不在这里另写一套：成员人格最终由
 * `team_create` 消费，加载器说合法、运行时就该认，两边同源才不会再出现
 * 「专家正文点名的成员实际不存在」这种错配（spec: fix-team-expert-assets）。
 */
function loadExpertAgents(expertDir: string): readonly AgentDefinition[] {
	const agentsDir = join(expertDir, AGENTS_DIR);
	if (!existsSync(agentsDir)) return [];
	const agents = loadAgentsDir(agentsDir);
	if (agents.length === 0) {
		throw new Error(
			`${agentsDir}: 专家的 ${AGENTS_DIR}/ 目录为空。成员人格必须放在 <成员id>.md；没有私有成员就删掉该目录`,
		);
	}
	return agents;
}

/** 加载一个专家目录（<dir>/expert.md + 可选 skills/ + 可选 agents/）。 */
function loadExpertDir(dir: string, dirName: string, source: "builtin" | "user"): LoadedExpert {
	const innerStray = strayMarkdown(dir, [EXPERT_FILE]);
	const stray = innerStray[0];
	if (stray !== undefined) {
		throw new Error(
			`${join(dir, stray)}: 专家已改为目录布局，请把 ${join(dir, stray)} 移到 ${join(dir, EXPERT_FILE)}`,
		);
	}
	const expertFile = join(dir, EXPERT_FILE);
	if (!existsSync(expertFile)) {
		throw new Error(`${dir}: 专家目录缺少 ${EXPERT_FILE}`);
	}
	const doc = parseFrontmatter(readFileSync(expertFile, "utf8"), expertFile);
	const name = requireString(doc, "name", expertFile);
	if (name !== dirName) {
		throw new Error(`${expertFile}: frontmatter name「${name}」与目录名「${dirName}」不一致`);
	}
	// 字段校验按声明顺序逐个进行：坏文件报错时从前往后指，人与测试都好定位。
	const description = requireString(doc, "description", expertFile);
	const displayName = requireString(doc, "displayName", expertFile);
	const profession = requireString(doc, "profession", expertFile);
	const displayDescription = requireString(doc, "displayDescription", expertFile);
	const quickPrompts = requireStringArray(doc, "quickPrompts", expertFile);
	if (quickPrompts.length !== 3) {
		throw new Error(`${expertFile}: frontmatter「quickPrompts」必须恰好 3 个起手问题，当前 ${quickPrompts.length} 个`);
	}
	const tags = requireStringArray(doc, "tags", expertFile);
	if (tags.length !== 3) {
		throw new Error(`${expertFile}: frontmatter「tags」必须恰好 3 个关键词，当前 ${tags.length} 个`);
	}
	const extraTools = optionalStringArray(doc, "extraTools", expertFile);
	// expertType 是白名单枚举：写错值必须响亮报错（静默回落 expert 会让
	// 团队专家从专家团页里凭空消失，而文件看起来完全正常）。
	const rawExpertType = optionalString(doc, "expertType", expertFile);
	if (rawExpertType !== undefined && !(EXPERT_TYPES as readonly string[]).includes(rawExpertType)) {
		throw new Error(
			`${expertFile}: frontmatter「expertType」只能是 ${EXPERT_TYPES.join(" 或 ")}，当前「${rawExpertType}」`,
		);
	}
	const skills = loadExpertSkills(dir);
	const agents = loadExpertAgents(dir);
	return {
		def: {
			name,
			description,
			displayName,
			profession,
			displayDescription,
			quickPrompts,
			tags,
			...(extraTools !== undefined ? { extraTools } : {}),
			expertType: rawExpertType === "team" ? "team" : "expert",
			agents,
			...(skills.length > 0 ? { skillsDir: join(dir, SKILLS_DIR) } : {}),
			body: doc.body,
		},
		source,
		skills,
	};
}

/** 按目录名序加载一个专家库目录下的全部专家，并盖上来源章。 */
function loadExpertsDir(dir: string, source: "builtin" | "user"): LoadedExpert[] {
	// 根级游离 .md = 旧扁平布局（<name>.md）残留，先响亮报错再遍历目录。
	const rootStray = strayMarkdown(dir, []);
	const stray = rootStray[0];
	if (stray !== undefined) {
		throw new Error(
			`${join(dir, stray)}: 专家已改为目录布局，请把 ${join(dir, stray)} 移到 ${join(dir, stray.replace(/\.md$/, ""), EXPERT_FILE)}`,
		);
	}
	return readdirSync(dir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
		.map((entry) => entry.name)
		.sort()
		.map((name) => loadExpertDir(join(dir, name), name, source));
}

/**
 * 全局技能（随包预装的全部技能根）的技能名与 SKILL.md 路径，供重名校验。
 *
 * 用 pi 的加载器发现，而不是自己扫目录：技能根不止一个（`resources/skills/` 是我们
 * 自己写的，`resources/plugins/` 是照搬的市场插件，层级为 `<市场>/<插件>/<版本>/skills/…`），
 * 且「哪个目录算一个技能」这套递归规则由 pi 定；两边同一套发现规则，
 * 重名校验拦的才是「模型真会同时看到的两个同名技能」。
 */
function loadGlobalSkills(globalSkillsDirs: readonly string[]): readonly SkillRef[] {
	const refs: SkillRef[] = [];
	for (const dir of globalSkillsDirs) {
		if (!existsSync(dir)) continue;
		const { skills } = loadSkills({ cwd: dir, agentDir: dir, skillPaths: [dir], includeDefaults: false });
		for (const skill of skills) refs.push({ name: skill.name, file: skill.filePath });
	}
	return refs;
}

/**
 * 加载内置 + 用户级专家定义。
 *
 * @param resourcesExpertsDir 内置目录（resources/experts），缺失或为空抛错
 * @param userExpertsDir 用户级目录（getConfigDir()/experts），不存在视为空
 * @param globalSkillsDirs 全局技能根（resources/skills + resources/plugins），
 *   用于私有技能重名校验 —— 传全部而不是只传第一个，否则专家技能可能撞上
 *   预装插件里的同名技能而不被发现（那两个根是同一个会话里同时加载的）
 * @param globalAgents 全局 agents 库（内置 + 用户级），用于私有成员人格重名校验
 *   （spec: fix-team-expert-assets）
 */
export function loadExperts(
	resourcesExpertsDir: string,
	userExpertsDir: string,
	globalSkillsDirs: readonly string[],
	globalAgents: readonly AgentDefinition[],
): readonly ExpertDefinition[] {
	if (!existsSync(resourcesExpertsDir)) {
		throw new Error(`内置专家目录缺失：${resourcesExpertsDir}。这是打包错误——没有内置专家，专家模式无可用人格`);
	}
	const builtin = loadExpertsDir(resourcesExpertsDir, "builtin");
	if (builtin.length === 0) {
		throw new Error(`内置专家目录为空：${resourcesExpertsDir}。这是打包错误`);
	}

	const user = existsSync(userExpertsDir) ? loadExpertsDir(userExpertsDir, "user") : [];

	// Map 保序：内置按目录名序先入，用户级同名覆盖（值替换、位置不变），
	// 用户独有的追加在后。
	const byName = new Map<string, LoadedExpert>();
	for (const loaded of builtin) byName.set(loaded.def.name, loaded);
	for (const loaded of user) byName.set(loaded.def.name, loaded);

	// 重名校验的边界（2026-09 修订，起因：照搬专家的技能池）：
	//   - 全局技能 vs 专家私有技能 → **必须唯一**。两者会同时进同一个会话的技能池
	//     （全局恒在，绑定专家时追加私有目录），重名会让 pi 静默取先者。
	//   - 专家之间 → **允许同名**。一个会话只可能绑定一个专家，两者的私有技能
	//     永不同时在场；而且上游专家包本身就共享技能池（equity-research 与
	//     market-researcher 都带 sector-overview / idea-generation），要求全局唯一
	//     就等于要求把技能从某个专家里删掉 —— 专家不再自包含。
	// 否决方案：把重名技能只留一份、另一处不复制。否掉的理由就是自包含 ——
	// 绑定 market-researcher 时它的 sector-overview 会凭空消失。
	const claimed = new Map<string, string>();
	for (const ref of loadGlobalSkills(globalSkillsDirs)) claimed.set(ref.name, ref.file);
	for (const loaded of byName.values()) {
		for (const ref of loaded.skills) {
			const other = claimed.get(ref.name);
			if (other !== undefined) {
				throw new Error(`技能名「${ref.name}」与全局技能重名：${ref.file} 与 ${other}`);
			}
		}
	}

	// 成员人格的重名边界，与技能的边界同构但理由不同：
	//   - 私有成员 vs 全局 agents 库 → **必须唯一**。两者会同时进同一个会话的
	//     成员清单（全局恒在，绑定专家时追加私有），而 team_create 是
	//     `agents.find(a => a.name === ...)`（daemon/index.ts:2556）——重名会让
	//     查找静默取先者，成员人格随机失效，且报错发生在建团那一刻而非加载期。
	//   - 专家之间 → **允许同名**。一个会话只绑定一个专家，两个专家的成员
	//     永不同时在场；要求全局唯一就等于不许另一个团队有同名角色。
	// 否决方案：撞名时让专家私有覆盖全局。否掉的理由是覆盖方向不可预期——
	// 用户级 agents 是先于专家加载的稳定定义，被专家包悄悄改写更糟。
	const globalAgentNames = new Set(globalAgents.map((agent) => agent.name));
	for (const loaded of byName.values()) {
		for (const agent of loaded.def.agents) {
			if (globalAgentNames.has(agent.name)) {
				throw new Error(
					`成员人格「${agent.name}」与全局 agents 库重名：${join(loaded.def.name, AGENTS_DIR)} 与 resources/agents 或用户级 agents 目录`,
				);
			}
		}
	}

	return [...byName.values()].map((loaded) => ({ ...loaded.def, source: loaded.source }));
}
