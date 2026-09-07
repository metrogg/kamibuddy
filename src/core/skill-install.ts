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

import { cpSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { SkillInfo } from "../shared/settings.ts";
import { getConfigDir } from "./config-paths.ts";
import { parseFrontmatter, requireString } from "./frontmatter.ts";

/** pi 的技能名校验规则（skills.ts validateName）。 */
const NAME_RE = /^[a-z0-9-]+$/;
const NAME_MAX = 64;

export function userSkillsDir(): string {
	return join(getConfigDir(), "skills");
}

interface ParsedSkill {
	readonly name: string;
	readonly description: string;
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
		return { name: requireString(doc, "name", source), description: requireString(doc, "description", source), skillMdPath: source, sourceDir: null };
	}

	const skillMd = join(source, "SKILL.md");
	if (!existsSync(skillMd)) throw new Error("所选文件夹里没有 SKILL.md —— 技能必须包含 SKILL.md");
	const doc = parseFrontmatter(readFileSync(skillMd, "utf8"), skillMd);
	return { name: requireString(doc, "name", skillMd), description: requireString(doc, "description", skillMd), skillMdPath: skillMd, sourceDir: source };
}

/**
 * 导入技能，返回安装后的信息。
 *
 * 目标目录名 = frontmatter 的 name（pi 按它注册命令，目录名只是容器）。
 */
export function importSkill(sourcePath: string): SkillInfo {
	const parsed = parseSource(sourcePath);

	if (parsed.name.length > NAME_MAX) throw new Error(`技能名过长（上限 ${NAME_MAX} 字符）：${parsed.name}`);
	if (!NAME_RE.test(parsed.name)) {
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

	return {
		name: parsed.name,
		description: parsed.description,
		filePath: join(destDir, "SKILL.md"),
		origin: "user",
		disableModelInvocation: false,
	};
}
