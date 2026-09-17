/**
 * 技能导入：把「含 SKILL.md 的文件夹」或「单个 .md」装进用户技能目录。
 *
 * 为什么校验从紧：pi 按 frontmatter 的 name 注册 /skill:name 命令、
 * 按 description 做自动路由 —— 缺了就是「列表里有但永远不会被用」的死技能，
 * 不如导入时就报清楚。name 规则同 pi 的 validateName（小写 a-z/0-9/连字符）。
 *
 * 同名拒绝而不覆盖：目标可能是用户手工改过的技能，静默覆盖 = 丢改动
 * （与 custom-providers 的归属守卫同一原则）。
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { SkillInfo } from "../shared/settings.ts";
import { getConfigDir } from "./config-paths.ts";
import { parseFrontmatter, optionalBoolean, optionalString, requireString } from "./frontmatter.ts";
import { readPreferences } from "./preferences.ts";
import { isSkillEnabled, SKILL_NAME_PATTERN } from "./skill-status.ts";

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

/** `_installed.json` 的形状（只在导入时写，见 importSkill）。 */
interface InstalledMetaFile {
	readonly name: string;
	/** 来源 SKILL.md 的 frontmatter 值；缺失则不带该键（不写 null 占位）。 */
	readonly version?: string;
	/** 固定值。将来接市场/云端分发时，这里分流来源（届时是联合类型而非字符串）。 */
	readonly source: "local-import";
	readonly sourcePath: string;
	readonly installedAt: number;
}

/** 读回来的安装元数据。字段缺失即 undefined，与 `SkillInfo` 的可选字段一一对应。 */
export interface InstalledSkillMeta {
	readonly version: string | undefined;
	readonly sourcePath: string | undefined;
	readonly installedAt: number | undefined;
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
	};
}

/**
 * 导入技能，返回安装后的信息。
 *
 * 目标目录名 = frontmatter 的 name（pi 按它注册命令，目录名只是容器）。
 */
export function importSkill(sourcePath: string): SkillInfo {
	const source = resolve(sourcePath);
	const parsed = parseSource(source);

	if (parsed.name.length > NAME_MAX) throw new Error(`技能名过长（上限 ${NAME_MAX} 字符）：${parsed.name}`);
	if (!SKILL_NAME_PATTERN.test(parsed.name)) {
		throw new Error(`技能名「${parsed.name}」不合法：只能用小写字母、数字和连字符（如 meeting-notes）`);
	}
	if (parsed.description.trim() === "") throw new Error("SKILL.md 缺少 description —— 没有它模型无法判断何时使用该技能");

	const destDir = join(userSkillsDir(), parsed.name);
	if (existsSync(destDir)) {
		throw new Error(`技能「${parsed.name}」已存在。如需替换，请先到技能目录手动删除旧的（${destDir}）`);
	}

	mkdirSync(destDir, { recursive: true });
	if (parsed.sourceDir !== null) cpSync(parsed.sourceDir, destDir, { recursive: true });
	else cpSync(parsed.skillMdPath, join(destDir, "SKILL.md"));

	/*
	 * 写 sidecar 是**无条件覆盖**：来源里若本来就带 `_installed.json`（例如从一个已装技能目录
	 * 再导入一次），cpSync 会把它一起复制过来，而那份记录的是**上一处**的安装信息 ——
	 * 本目录的导入时间必须以本次为准。
	 */
	const installedAt = Date.now();
	const metaFile: InstalledMetaFile = {
		name: parsed.name,
		...(parsed.version === undefined ? {} : { version: parsed.version }),
		source: "local-import",
		sourcePath: source,
		installedAt,
	};
	try {
		writeFileSync(join(destDir, INSTALLED_META_FILE), `${JSON.stringify(metaFile, null, 2)}\n`, "utf8");
	} catch (error) {
		/*
		 * 回滚而不是留下「有技能没元数据」的半装状态：半装后卡片永远缺来源/导入时间，
		 * 且同名再来一次会被上面的「已存在」挡住 —— 用户除了手动删目录没有别的出路。
		 * destDir 是本次刚建的（上面 existsSync 已挡掉同名），删掉即回到导入前的状态。
		 */
		rmSync(destDir, { recursive: true, force: true });
		const reason = error instanceof Error ? error.message : String(error);
		throw new Error(`技能「${parsed.name}」复制完成但写入安装信息失败，已回滚本次导入：${reason}`);
	}

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
