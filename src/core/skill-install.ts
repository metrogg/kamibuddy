/**
 * 技能导入 / 删除：把「含 SKILL.md 的文件夹」或「单个 .md」装进用户技能目录，
 * 以及把**模型自己创建的**技能移出去。
 *
 * 为什么校验从紧：pi 按 frontmatter 的 name 注册 /skill:name 命令、
 * 按 description 做自动路由 —— 缺了就是「列表里有但永远不会被用」的死技能，
 * 不如导入时就报清楚。name 规则同 pi 的 validateName（小写 a-z/0-9/连字符）。
 *
 * 同名默认拒绝（目标可能是用户手工改过的技能，静默覆盖 = 丢改动，与
 * custom-providers 的归属守卫同一原则）；**唯一的例外**是带 `agentCreated`
 * 标记的技能（模型经 skill_install 装的，对齐 WorkBuddy 的 `agent_created: true`）——
 * 那条链路要支持「改一下我上次建的那个技能」，否则模型每次都得让用户先去手工删目录。
 * 判定只认 sidecar 里的标记，不认目录长相：用户手工放进来的同名技能永远走拒绝分支。
 *
 * 覆盖是**两段式换名**（装到暂存目录 → 旧目录改名备份 → 新目录上位 → 删备份），
 * 中途失败会把备份改回去 —— 模型能触发的这条路径上，不能出现「复制到一半，
 * 用户原来的技能没了」。
 */

import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { SkillInfo } from "../shared/settings.ts";
import { getConfigDir } from "./config-paths.ts";
import { parseFrontmatter, optionalBoolean, optionalString, requireString } from "./frontmatter.ts";
import { readPreferences, writePreferences } from "./preferences.ts";
import { isSkillEnabled, SKILL_NAME_PATTERN, type SkillOverride } from "./skill-status.ts";

/** pi 的技能名校验规则额外还有长度上限（skills.ts validateName），一并照抄。 */
const NAME_MAX = 64;

/**
 * 安装元数据的落盘文件名。
 *
 * 落在**技能目录内**（每个技能一份）而不是集中索引，对齐 WorkBuddy 的
 * `_skillhub_meta.json`：元数据跟着技能走 —— 用户手工搬动/整包复制技能文件夹时不会丢，
 * 而集中索引在这两种操作下会指向已失效的路径。也顺带解释了它为什么不出现在
 * 技能列表里：pi 只认 SKILL.md，目录内的其它文件既不是技能也不进技能清单段。
 */
const INSTALLED_META_FILE = "_installed.json";

export function userSkillsDir(): string {
	return join(getConfigDir(), "skills");
}

/** importSkill 的可选入参。 */
export interface ImportSkillOptions {
	/**
	 * 本次安装由**模型**发起（skill_install 工具）。写入 sidecar 后，该技能才允许
	 * 被模型覆盖安装或删除（对齐 WorkBuddy 的 `agent_created: true` 语义）。
	 * 用户经技能页导入时不传 —— 那些技能是用户的，模型不许改。
	 */
	readonly agentCreated?: boolean;
}

/** `_installed.json` 的形状（只在导入时写，见 importSkill）。 */
interface InstalledMetaFile {
	readonly name: string;
	/** 来源 SKILL.md 的 frontmatter 值；缺失则不带该键（不写 null 占位）。 */
	readonly version?: string;
	/** 固定值。将来接市场/云端分发时，这里分流来源（届时是联合类型而非字符串）。 */
	readonly source: "local-import";
	readonly sourcePath: string;
	readonly installedAt: number;
	/**
	 * 模型装的（对齐 WorkBuddy 写入 SKILL.md 的 `agent_created: true`）。
	 * 只在为 true 时写键：用户经技能页导入的技能不带这个键，读取侧归一 false。
	 */
	readonly agentCreated?: true;
}

/** 读回来的安装元数据。字段缺失即 undefined，与 `SkillInfo` 的可选字段一一对应。 */
export interface InstalledSkillMeta {
	readonly version: string | undefined;
	readonly sourcePath: string | undefined;
	readonly installedAt: number | undefined;
	/** 是否模型创建（决定模型能不能覆盖/删除它）。缺键 = false，不是 undefined。 */
	readonly agentCreated: boolean;
}

interface ParsedSkill {
	readonly name: string;
	readonly description: string;
	/** 与 listSkills 同一口径地读一次 `user-invocable`（缺省 true），导入结果如实返回。 */
	readonly userInvocable: boolean;
	/**
	 * 同一条口径读 `disable-model-invocation`（缺省 false），导入结果如实返回。
	 *
	 * 曾经这里是不读的、返回值里硬写 `false`：导完那一刻卡片/调用方看到的是假话，
	 * 下一轮 listSkills 现读又变 true —— 与之前修过的 `userInvocable` 是同一类 bug。
	 */
	readonly disableModelInvocation: boolean;
	/** frontmatter 声明的版本；没写即 undefined（不填默认值）。 */
	readonly version: string | undefined;
	/** SKILL.md 在来源中的路径（导入后成为目标路径的参照）。 */
	readonly skillMdPath: string;
	/** 需要复制的根：文件夹来源是来源目录，单文件来源是 null（只复制一个文件）。 */
	readonly sourceDir: string | null;
}

/** 从来源解析出技能名与描述，不做任何写操作。 */
function parseSource(sourcePath: string): ParsedSkill {
	const source = resolve(sourcePath);
	if (!existsSync(source)) throw new Error("路径不存在");

	const stat = statSync(source);
	if (stat.isFile()) {
		if (!source.endsWith(".md")) throw new Error("请选择含 SKILL.md 的文件夹，或单个 .md 技能文件");
		const doc = parseFrontmatter(readFileSync(source, "utf8"), source);
		return {
			name: requireString(doc, "name", source),
			description: requireString(doc, "description", source),
			userInvocable: optionalBoolean(doc, "user-invocable", true),
			disableModelInvocation: optionalBoolean(doc, "disable-model-invocation", false),
			version: optionalString(doc, "version", source),
			skillMdPath: source,
			sourceDir: null,
		};
	}

	const skillMd = join(source, "SKILL.md");
	if (!existsSync(skillMd)) throw new Error("所选文件夹里没有 SKILL.md —— 技能必须包含 SKILL.md");
	const doc = parseFrontmatter(readFileSync(skillMd, "utf8"), skillMd);
	return {
		name: requireString(doc, "name", skillMd),
		description: requireString(doc, "description", skillMd),
		userInvocable: optionalBoolean(doc, "user-invocable", true),
		disableModelInvocation: optionalBoolean(doc, "disable-model-invocation", false),
		version: optionalString(doc, "version", skillMd),
		skillMdPath: skillMd,
		sourceDir: source,
	};
}

/**
 * 读一个技能目录下的 `_installed.json`（导入时写的安装元数据）。
 *
 * 文件不存在是**正常情况**（用户手工把技能文件夹放进技能目录），返回 undefined 且不记日志。
 * 存在但坏了（读不动 / JSON 语法错 / 根不是对象）则响亮记日志 + 降级为「无元数据」——
 * 与 daemon 里 `readSkillMeta` 对坏 SKILL.md 的取舍同口径（src/daemon/index.ts）：
 * 一个坏 sidecar 不能让整个技能列表打挂，卡片上少一行元数据远好过页面打不开。
 *
 * 逐字段校验类型，present-but-invalid 一律当缺失（不静默纠正成别的值）。
 */
export function readInstalledMeta(skillDir: string): InstalledSkillMeta | undefined {
	const file = join(skillDir, INSTALLED_META_FILE);
	if (!existsSync(file)) return undefined;

	let text: string;
	try {
		text = readFileSync(file, "utf8");
	} catch (error) {
		console.error(`技能元数据「${file}」读取失败，暂按手工放置处理：`, error);
		return undefined;
	}

	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch (error) {
		console.error(`技能元数据「${file}」不是合法 JSON，暂按手工放置处理：`, error);
		return undefined;
	}
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
		console.error(`技能元数据「${file}」应为 JSON 对象，暂按手工放置处理：`, raw);
		return undefined;
	}

	const record = raw as Record<string, unknown>;
	const version = record["version"];
	const sourcePath = record["sourcePath"];
	const installedAt = record["installedAt"];
	return {
		version: typeof version === "string" && version !== "" ? version : undefined,
		sourcePath: typeof sourcePath === "string" && sourcePath !== "" ? sourcePath : undefined,
		installedAt: typeof installedAt === "number" && Number.isFinite(installedAt) ? installedAt : undefined,
		// 只认 true：写歪的值（"true" / 1）当没标记 —— 授权判定上，读不懂就是不给权限。
		agentCreated: record["agentCreated"] === true,
	};
}

/**
 * 覆盖安装时的暂存根。**必须放在 skills/ 之外**：技能加载器会把
 * `<skills>/<每个一级子目录>/SKILL.md` 当技能发现，暂存目录（点前缀、名字也不是
 * 合法技能名）会在安装的中间态被扫成一个不存在的技能。同盘改名仍然成立
 * （暂存根与技能目录都在 configDir 下）。
 */
function stagingRoot(): string {
	return join(getConfigDir(), ".skill-staging");
}

/**
 * 导入技能，返回安装后的信息。
 *
 * 目标目录名 = frontmatter 的 name（pi 按它注册命令，目录名只是容器）。
 * 同名且是模型创建时**覆盖**（见文件头），其余同名一律拒。
 */
export function importSkill(sourcePath: string, options: ImportSkillOptions = {}): SkillInfo {
	const source = resolve(sourcePath);
	const parsed = parseSource(source);

	if (parsed.name.length > NAME_MAX) throw new Error(`技能名过长（上限 ${NAME_MAX} 字符）：${parsed.name}`);
	if (!SKILL_NAME_PATTERN.test(parsed.name)) {
		throw new Error(`技能名「${parsed.name}」不合法：只能用小写字母、数字和连字符（如 meeting-notes）`);
	}
	if (parsed.description.trim() === "") throw new Error("SKILL.md 缺少 description —— 没有它模型无法判断何时使用该技能");

	const destDir = join(userSkillsDir(), parsed.name);
	const existing = existsSync(destDir);
	if (existing && readInstalledMeta(destDir)?.agentCreated !== true) {
		throw new Error(`技能「${parsed.name}」已存在。如需替换，请先到技能目录手动删除旧的（${destDir}）`);
	}

	const stagingDir = join(stagingRoot(), `${parsed.name}-${process.pid}-${Date.now()}`);
	const installedAt = Date.now();
	try {
		// 技能目录本身可能还不存在（首次安装）：改名要落在已存在的父目录下，
		// 少了这一句 ENOENT 会在最后一步换名时才炸出来。
		mkdirSync(userSkillsDir(), { recursive: true });
		mkdirSync(stagingDir, { recursive: true });
		if (parsed.sourceDir !== null) cpSync(parsed.sourceDir, stagingDir, { recursive: true });
		else cpSync(parsed.skillMdPath, join(stagingDir, "SKILL.md"));

		/*
		 * 写 sidecar 是**无条件覆盖**：来源里若本来就带 `_installed.json`（例如从一个已装技能目录
		 * 再导入一次），cpSync 会把它一起复制过来，而那份记录的是**上一处**的安装信息 ——
		 * 本目录的安装时间必须以本次为准。
		 */
		const metaFile: InstalledMetaFile = {
			name: parsed.name,
			...(parsed.version === undefined ? {} : { version: parsed.version }),
			source: "local-import",
			sourcePath: source,
			installedAt,
			...(options.agentCreated === true ? { agentCreated: true as const } : {}),
		};
		writeFileSync(join(stagingDir, INSTALLED_META_FILE), `${JSON.stringify(metaFile, null, 2)}\n`, "utf8");
	} catch (error) {
		// 暂存目录半装（有技能没元数据）就删掉：留着只会让下次同名安装撞上「已存在」。
		rmSync(stagingDir, { recursive: true, force: true });
		const reason = error instanceof Error ? error.message : String(error);
		throw new Error(`技能「${parsed.name}」安装失败，技能目录未被改动：${reason}`);
	}

	/*
	 * 两段式换名：旧目录先改名让位（**不是删掉**），新的上位成功后才删备份。
	 * 任何一步失败都能把旧的改回去 —— 覆盖是模型能触发的路径，
	 * 不能出现「装上新的、旧的没了，而新的其实是半成品」。
	 */
	const backupDir = join(stagingRoot(), `${parsed.name}.old-${process.pid}-${Date.now()}`);
	let backedUp = false;
	try {
		if (existing) {
			renameSync(destDir, backupDir);
			backedUp = true;
		}
		renameSync(stagingDir, destDir);
	} catch (error) {
		if (backedUp) renameSync(backupDir, destDir);
		rmSync(stagingDir, { recursive: true, force: true });
		const reason = error instanceof Error ? error.message : String(error);
		throw new Error(`技能「${parsed.name}」安装失败，已恢复原状：${reason}`);
	}
	if (backedUp) rmSync(backupDir, { recursive: true, force: true });

	return {
		name: parsed.name,
		description: parsed.description,
		filePath: join(destDir, "SKILL.md"),
		origin: "user",
		// 如实读来源声明（不再硬写 false）：返回值与下一轮 listSkills 现读的结果必须一致。
		disableModelInvocation: parsed.disableModelInvocation,
		userInvocable: parsed.userInvocable,
		// 启用状态是用户级覆盖：新导入的技能名字上若留着旧的「停用」记录（用户先停用、
		// 再手工删目录、然后重新导入同名技能），如实回报 —— 硬写 true 会骗调用方。
		enabled: isSkillEnabled(parsed.name, readPreferences().skillOverrides),
		...(parsed.version === undefined ? {} : { version: parsed.version }),
		installedAt,
		sourcePath: source,
	};
}

/**
 * 删除**模型创建**的技能（对齐 WorkBuddy `skill_manage(action="delete")` 的
 * `agent_created` 判定：市场 / 内置 / 用户手工放置的技能都不在模型可删范围内，
 * 它们该由用户自己在技能页处理）。
 *
 * 顺手清掉该技能残留的 `off` 覆盖：不清的话，将来重建同名技能会被那条陈旧记录
 * **静默停用** —— 表现是「新建的技能在 / 菜单里消失」，没有任何提示。
 */
export function removeAgentSkill(name: string): { readonly name: string; readonly dir: string } {
	if (!SKILL_NAME_PATTERN.test(name)) {
		throw new Error(`技能名「${name}」不合法：只能用小写字母、数字和连字符（如 meeting-notes）`);
	}
	const dir = join(userSkillsDir(), name);
	if (!existsSync(dir)) throw new Error(`用户技能目录里没有技能「${name}」（${dir}）`);
	if (readInstalledMeta(dir)?.agentCreated !== true) {
		throw new Error(
			`技能「${name}」不是模型创建的，不能由模型删除 —— 内置、市场安装与用户手工放置的技能都要用户自己在技能页处理`,
		);
	}
	rmSync(dir, { recursive: true, force: true });
	clearSkillOverride(name);
	return { name, dir };
}

/** 清掉某技能的用户级停用记录（缺省即启用，只有 "off" 一种表示 —— 同 setSkillEnabled）。 */
function clearSkillOverride(name: string): void {
	const preferences = readPreferences();
	const overrides = preferences.skillOverrides;
	if (overrides?.[name] === undefined) return;
	const next: Record<string, SkillOverride> = { ...overrides };
	delete next[name];
	// 空对象与「没写过」在读取层都归一 undefined，写出后者才是唯一表示。
	const { skillOverrides: _dropped, ...rest } = preferences;
	writePreferences(Object.keys(next).length === 0 ? rest : { ...rest, skillOverrides: next });
}
