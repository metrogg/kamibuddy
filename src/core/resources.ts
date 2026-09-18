/**
 * resources/ 目录的加载器：场景骨架 + 交互模式 + 回复风格 + 提示词片段 → 结构化资源。
 *
 * 这是「能力即数据」的入口（AGENTS.md §3）：加一个场景 = scenes/ 下加一个目录，
 * 加一个交互模式 = modes/ 下加一个 .md 文件，零行代码改动。
 *
 * 校验从紧（坏文件抛错而非忽略）：
 *   - frontmatter 的 id 必须与目录名/文件名一致（防改名字漏改引用）
 *   - ready 缺省为 false（漏写 = 不可选，比漏写 = 可选安全）
 *   - 目录为空或缺失直接抛错 —— 没有提示词的产品是错的，静默回落到 pi 默认
 *     提示词等于把「coding assistant」身份带回来
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ModeDescriptor } from "../shared/session-events.ts";
import type { WelcomeCase, WelcomeChip, WelcomePresets } from "../shared/welcome.ts";
import { optionalBoolean, parseFrontmatter, requireString, requireStringArray } from "./frontmatter.ts";

/**
 * 一个场景：骨架正文含 {{interaction}} / {{skills}} 槽位。
 *
 * cwd 不再是槽位（工作目录改由 hidden context 的 `workspace_context` 唯一提供，
 * 理由见 core/prompt-composer.ts 文件头：提示词位于整段历史之前，cwd 行在提示词
 * 里会让换工作区即断掉 provider 前缀缓存）；骨架里写 {{cwd}} 会被组装器响亮拒掉。
 */
export interface SceneResource {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly ready: boolean;
	readonly body: string;
}

/** 一个交互模式：tools 是工具白名单（含禁用未列出工具的语义）。 */
export interface ModeResource {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly ready: boolean;
	readonly tools: readonly string[];
	readonly body: string;
}

/** 一个回复风格：body 是文件全文（无 frontmatter，整篇即提示段）。 */
export interface StyleResource {
	readonly id: string;
	/** 中文名（设置页展示），唯一出处是下方 STYLE_LABELS。 */
	readonly label: string;
	readonly body: string;
}

/**
 * 默认回复风格。偏好里没存 styleId 时由读取方（daemon）回落到它 ——
 * 与 thinkingLevel 的「未配置回 medium」同款：偏好文件保持「没写就是没写」，
 * 默认值集中在这一处，不在 preferences.ts 里提前填。
 */
export const DEFAULT_STYLE_ID = "professional";

/**
 * 风格 id → 中文名。集中这一处（resources/styles/README.md 的对照表是它的
 * 文档镜像，改一边必须改另一边）。风格文件没有 frontmatter（WorkBuddy 原样
 * 搬用，整篇都是提示正文），label 无从解析，只能在这里配——文件名能带来的
 * id 从文件名取，带来不了的中文名在这里钉死；文件没有对应映射即抛错。
 */
const STYLE_LABELS: Readonly<Record<string, string>> = {
	professional: "专业严谨",
	friendly: "亲和",
	efficient: "高效",
	creative: "创意",
	sarcastic: "毒舌",
	socratic: "苏格拉底",
	straightforward: "直白",
};

export interface LoadedResources {
	readonly scenes: readonly SceneResource[];
	readonly modes: readonly ModeResource[];
	readonly styles: readonly StyleResource[];
	/**
	 * 提示词片段库（resources/prompts/fragments/<name>.md 的 name → 正文），
	 * 供 composer 的 resolveFragment 查表。目录可能整个不存在（F1 内容面
	 * 尚未落地的仓库形态）——缺目录 = 无片段，空 Map，不抛错；
	 * 但骨架引了片段就会响亮失败（composer 侧），两条语义不混。
	 */
	readonly fragments: ReadonlyMap<string, string>;
	/**
	 * 首页预设（能力胶囊 + 最佳实践案例）。目录不存在 = 空预设（首页不显示这两块），
	 * 与 fragments 同口径：它是 UI 内容面，缺失不改变产品身份，只是少一块展示；
	 * 但目录在、文件坏必须响亮抛错。
	 */
	readonly welcome: WelcomePresets;
}

/** 供 daemon 下发 UI 的描述符列表（工具白名单不下发——UI 不需要知道）。 */
export function toDescriptors(
	resources: LoadedResources,
): { scenes: ModeDescriptor[]; modes: ModeDescriptor[] } {
	const toDescriptor = <T extends { id: string; label: string; description: string; ready: boolean }>(r: T): ModeDescriptor => ({
		id: r.id,
		label: r.label,
		description: r.description,
		ready: r.ready,
	});
	return {
		scenes: resources.scenes.map(toDescriptor),
		modes: resources.modes.map(toDescriptor),
	};
}

export function loadResources(resourcesDir: string): LoadedResources {
	const scenesDir = join(resourcesDir, "scenes");
	const modesDir = join(resourcesDir, "modes");
	const stylesDir = join(resourcesDir, "styles");
	if (!existsSync(scenesDir) || !existsSync(modesDir) || !existsSync(stylesDir)) {
		throw new Error(
			`资源目录不完整：需要 ${scenesDir}、${modesDir} 与 ${stylesDir}。` +
				`若设置了 KAMIBUDDY_RESOURCES_DIR，请检查其指向。`,
		);
	}

	const scenes = readdirSync(scenesDir)
		.filter((name) => !name.startsWith("."))
		.sort()
		.flatMap((name): SceneResource[] => {
			const dir = join(scenesDir, name);
			if (!statSync(dir).isDirectory()) return [];
			const file = join(dir, "prompt.md");
			if (!existsSync(file)) throw new Error(`场景「${name}」缺少 prompt.md（${dir}）`);
			const doc = parseFrontmatter(readFileSync(file, "utf8"), file);
			const id = requireString(doc, "id", file);
			if (id !== name) throw new Error(`${file}: frontmatter id「${id}」与目录名「${name}」不一致`);
			return [
				{
					id,
					label: requireString(doc, "label", file),
					description: requireString(doc, "description", file),
					ready: optionalBoolean(doc, "ready", false),
					body: doc.body,
				},
			];
		});
	if (scenes.length === 0) throw new Error(`scenes/ 下没有任何场景（${scenesDir}）`);

	const modes = readdirSync(modesDir)
		.filter((name) => name.endsWith(".md") && !name.startsWith("."))
		.sort()
		.map((name): ModeResource => {
			const file = join(modesDir, name);
			const doc = parseFrontmatter(readFileSync(file, "utf8"), file);
			const id = requireString(doc, "id", file);
			if (id !== name.replace(/\.md$/, "")) throw new Error(`${file}: frontmatter id「${id}」与文件名不一致`);
			return {
				id,
				label: requireString(doc, "label", file),
				description: requireString(doc, "description", file),
				ready: optionalBoolean(doc, "ready", false),
				tools: requireStringArray(doc, "tools", file),
				body: doc.body,
			};
		});
	if (modes.length === 0) throw new Error(`modes/ 下没有任何交互模式（${modesDir}）`);

	/*
	 * 风格文件命名 style-<id>.md，id 从文件名取；README.md 等其它文件跳过
	 * （命名不匹配的当文档，不当风格）。无 frontmatter 可校验，能钉的校验：
	 * id 必须在 STYLE_LABELS 有中文名（漏配映射 = 界面出现无名风格）、
	 * 正文非空（空文件注入提示词等于埋一个空洞）。
	 */
	const styles = readdirSync(stylesDir)
		.filter((name) => name.startsWith("style-") && name.endsWith(".md"))
		.sort()
		.map((name): StyleResource => {
			const file = join(stylesDir, name);
			const id = name.replace(/^style-/, "").replace(/\.md$/, "");
			const label = STYLE_LABELS[id];
			if (label === undefined) {
				throw new Error(`${file}: 未知风格「${id}」（STYLE_LABELS 中没有对应中文名）`);
			}
			const body = readFileSync(file, "utf8");
			if (body.trim() === "") throw new Error(`${file}: 风格文件为空`);
			return { id, label, body };
		});
	if (styles.length === 0) throw new Error(`styles/ 下没有任何回复风格（${stylesDir}）`);

	return { scenes, modes, styles, fragments: loadFragments(resourcesDir), welcome: loadWelcome(resourcesDir, scenes) };
}

/**
 * include 指令能引用的片段名（与 prompt-composer 的 INCLUDE 正则同字符集）。
 * 文件名落不进这个字符集的片段**永远无法被引用**（如「交付纪律.md」），
 * 留着是死文件还让人以为它生效了 —— 加载时响亮抛错。
 */
const FRAGMENT_NAME = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

/**
 * 加载 prompts/fragments/*.md → name → 正文。
 *
 * 与 scenes/modes/styles 的「目录缺失即抛错」口径不同：fragments 是骨架的
 * 可选复用层，目录不存在 = 没有共享片段（空库），骨架只要不写 {{> }} 就
 * 完全合法；真引了不存在的片段，composer 的 resolveFragment 会抛错。
 * 但目录存在而文件读不出（坏编码 / 权限 / 空文件）必须抛 —— 那是
 * 「有片段但坏了」，静默忽略等于让骨架引用一个个落空成运行时错误。
 */
function loadFragments(resourcesDir: string): ReadonlyMap<string, string> {
	const fragmentsDir = join(resourcesDir, "prompts", "fragments");
	if (!existsSync(fragmentsDir)) return new Map();

	const fragments = new Map<string, string>();
	for (const name of readdirSync(fragmentsDir).sort()) {
		if (!name.endsWith(".md") || name.startsWith(".")) continue;
		const id = name.replace(/\.md$/, "");
		const file = join(fragmentsDir, name);
		if (!FRAGMENT_NAME.test(id)) {
			throw new Error(
				`${file}: 片段名「${id}」无法被 {{> }} 指令引用（须匹配 ${FRAGMENT_NAME.source}）——改名或删除`,
			);
		}
		const body = readFileSync(file, "utf8");
		if (body.trim() === "") throw new Error(`${file}: 片段文件为空（引用它就是埋一个空洞）`);
		fragments.set(id, body);
	}
	return fragments;
}

/**
 * 加载 welcome/{chips,cases}.json → 首页预设（能力胶囊 + 最佳实践案例）。
 *
 * 坏数据必须响亮抛错，别让首页静默少一块 —— 校验的都是「错了也不会报错、
 * 只是永远不出现」的形态：
 *   - chip.scene 必须是已存在的场景 id（写错场景 = 该胶囊永不出现）
 *   - chipKind=playbook 的胶囊至少要有一条案例（否则点开是空列表 = 假入口）
 *   - chipKind=scene 必须有非空 prompts（同上）
 *   - case.chipId 必须指向已存在的胶囊；两边的 id 各自唯一（UI 拿它们做 key 与查表）
 */
function loadWelcome(resourcesDir: string, scenes: readonly SceneResource[]): WelcomePresets {
	const dir = join(resourcesDir, "welcome");
	if (!existsSync(dir)) return { chips: [], cases: [] };

	const chipsFile = join(dir, "chips.json");
	const casesFile = join(dir, "cases.json");
	const rawChips = readJsonArray(chipsFile);
	const rawCases = readJsonArray(casesFile);

	const sceneIds = new Set(scenes.map((s) => s.id));
	const chips: WelcomeChip[] = rawChips.map((raw, index) => {
		const at = `${chipsFile}[${index}]`;
		const kind = requireStringField(raw, "chipKind", at);
		if (kind !== "playbook" && kind !== "scene") {
			throw new Error(`${at}: chipKind 只能是 playbook 或 scene（实际「${kind}」）`);
		}
		const scene = requireStringField(raw, "scene", at);
		if (!sceneIds.has(scene)) {
			throw new Error(`${at}: scene「${scene}」不在 scenes/ 中（写错的场景让这个胶囊永远不出现）`);
		}
		const prompts =
			kind === "scene" ? requireStringListField(raw, "prompts", at) : undefined;
		return {
			id: requireStringField(raw, "id", at),
			scene,
			label: requireStringField(raw, "label", at),
			description: requireStringField(raw, "description", at),
			icon: requireStringField(raw, "icon", at),
			chipKind: kind,
			...(prompts === undefined ? {} : { prompts }),
		};
	});
	requireUniqueIds(chips.map((c) => c.id), chipsFile);

	const chipIds = new Set(chips.map((c) => c.id));
	const cases: WelcomeCase[] = rawCases.map((raw, index) => {
		const at = `${casesFile}[${index}]`;
		const chipId = requireStringField(raw, "chipId", at);
		if (!chipIds.has(chipId)) {
			throw new Error(`${at}: chipId「${chipId}」没有对应胶囊（这条案例永远不会显示）`);
		}
		return {
			id: requireStringField(raw, "id", at),
			chipId,
			title: requireStringField(raw, "title", at),
			subtitle: requireStringField(raw, "subtitle", at),
			prompt: requireStringField(raw, "prompt", at),
			// 绑定的专家是 resources/experts/ 的目录名；存在性由测试跨资源校验
			// （加载器这里只有 welcome 一个目录的视野，看不到 experts/）。
			expert: requireStringField(raw, "expert", at),
			cover: requireStringField(raw, "cover", at),
		};
	});
	requireUniqueIds(cases.map((c) => c.id), casesFile);

	// playbook 胶囊的下钻列表就是它的案例：一条都没有时点开是空面板，那是假入口。
	for (const chip of chips) {
		if (chip.chipKind === "playbook" && !cases.some((c) => c.chipId === chip.id)) {
			throw new Error(`${chipsFile}: 胶囊「${chip.id}」是 playbook 类型但没有任何案例`);
		}
	}

	return { chips, cases };
}

function readJsonArray(file: string): readonly unknown[] {
	if (!existsSync(file)) throw new Error(`缺少 ${file}`);
	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(file, "utf8"));
	} catch (error) {
		throw new Error(`${file}: JSON 解析失败（${error instanceof Error ? error.message : String(error)}）`);
	}
	if (!Array.isArray(parsed)) throw new Error(`${file}: 顶层必须是数组`);
	return parsed;
}

function requireStringField(source: unknown, key: string, at: string): string {
	const value = (source as Record<string, unknown> | null)?.[key];
	if (typeof value !== "string" || value.trim() === "") {
		throw new Error(`${at}: ${key} 缺失或不是非空字符串`);
	}
	return value;
}

/** 提示词列表（chipKind=scene 用）：必须存在、非空、且每项都是非空字符串。 */
function requireStringListField(source: unknown, key: string, at: string): readonly string[] {
	const value = (source as Record<string, unknown> | null)?.[key];
	if (!Array.isArray(value) || value.length === 0) {
		throw new Error(`${at}: ${key} 必须是非空数组`);
	}
	return value.map((item, index) => {
		if (typeof item !== "string" || item.trim() === "") {
			throw new Error(`${at}: ${key}[${index}] 不是非空字符串`);
		}
		return item;
	});
}

function requireUniqueIds(ids: readonly string[], file: string): void {
	const seen = new Set<string>();
	for (const id of ids) {
		if (seen.has(id)) throw new Error(`${file}: id「${id}」重复`);
		seen.add(id);
	}
}

/**
 * 风格三态解析（Preferences.styleId 的三态 → 注入用的风格）。
 *
 *   - undefined（未配置）→ 默认风格 DEFAULT_STYLE_ID；
 *   - ""（用户显式关闭）→ style 为 undefined，调用方不传 style、不注入；
 *   - 某 id → 指定风格。
 *
 * 指定 id 不在 styles 中 = 配置漂移（风格被改名/删除、偏好文件手工编辑）：
 * 降级到默认风格并把原 id 放在 driftedFrom 里让调用方记日志。降级方向
 * 选「默认风格」而不是「关闭」：用户存过 id 说明意图是「要某种风格」，
 * 回默认比静默关掉更接近原意图；且漂移必须留痕（事件日志），不是静默。
 *
 * 默认风格本身缺失 → 抛错：styles/ 是随应用分发的资源，professional 没了
 * 是安装损坏或被手删，静默无风格上线等于产品身份缺一块（同 loader 的
 * 「空 styles 抛错」口径）。
 */
export interface ResolvedStyle {
	/** undefined = 关闭风格注入。 */
	readonly style: StyleResource | undefined;
	/** 配置漂移的原 styleId（调用方记事件日志）；未漂移时缺省。 */
	readonly driftedFrom?: string;
}

export function resolveStyle(
	styles: readonly StyleResource[],
	styleId: string | undefined,
): ResolvedStyle {
	if (styleId === "") return { style: undefined };
	const fallback = styles.find((s) => s.id === DEFAULT_STYLE_ID);
	if (styleId === undefined) {
		if (fallback === undefined) {
			throw new Error(`默认回复风格「${DEFAULT_STYLE_ID}」不在 styles/ 中（安装损坏或被手删）`);
		}
		return { style: fallback };
	}
	const found = styles.find((s) => s.id === styleId);
	if (found !== undefined) return { style: found };
	if (fallback === undefined) {
		throw new Error(`默认回复风格「${DEFAULT_STYLE_ID}」不在 styles/ 中（安装损坏或被手删）`);
	}
	return { style: fallback, driftedFrom: styleId };
}
