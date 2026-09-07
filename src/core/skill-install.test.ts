/**
 * 技能导入的测试。重点钉住三类会造成「貌似装成功实际被忽略」的行为：
 *   1. frontmatter 缺 name / description → 拒（没有它们模型无法路由到该技能）
 *   2. 同名已存在 → 拒（目标可能是用户手工改过的，静默覆盖 = 丢改动）
 *   3. 非法技能名 → 拒（pi 按 name 注册 /skill:name 命令，名字错了命令也注册不上）
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { importSkill } from "./skill-install.ts";

let dir: string;
let source: string;
let configDir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "kami-skill-"));
	source = join(dir, "source");
	configDir = join(dir, "config");
	process.env["KAMIBUDDY_CONFIG_DIR"] = configDir;
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
	delete process.env["KAMIBUDDY_CONFIG_DIR"];
});

/** 建一个标准的技能文件夹。 */
function makeSkillFolder(name: string, frontmatter = `name: ${name}\ndescription: 把会议记录整理成纪要`): string {
	const folder = join(source, name);
	mkdirSync(folder, { recursive: true });
	writeFileSync(join(folder, "SKILL.md"), `---\n${frontmatter}\n---\n# 正文`);
	writeFileSync(join(folder, "helpers.md"), "辅助正文");
	return folder;
}

function readText(path: string): string {
	return readFileSync(path, "utf8");
}

describe("文件夹导入", () => {
	it("复制整个文件夹到用户技能目录，SKILL.md 完整", () => {
		const folder = makeSkillFolder("meeting-notes");
		const imported = importSkill(folder);

		expect(imported.name).toBe("meeting-notes");
		expect(imported.origin).toBe("user");
		expect(imported.filePath).toBe(join(configDir, "skills", "meeting-notes", "SKILL.md"));
		// 同目录的辅助文件（references 机制）必须一并复制。
		expect(existsSync(join(configDir, "skills", "meeting-notes", "helpers.md"))).toBe(true);
	});

	it("单 .md 文件也可导入", () => {
		mkdirSync(source, { recursive: true });
		const file = join(source, "solo.md");
		writeFileSync(file, "---\nname: solo-skill\ndescription: 独立技能\n---\n正文");
		const imported = importSkill(file);
		expect(imported.filePath).toBe(join(configDir, "skills", "solo-skill", "SKILL.md"));
		expect(existsSync(imported.filePath)).toBe(true);
	});
});

describe("校验拒绝", () => {
	it("文件夹缺 SKILL.md → 拒绝", () => {
		const folder = join(source, "no-skill");
		mkdirSync(folder, { recursive: true });
		expect(() => importSkill(folder)).toThrow(/SKILL\.md/);
	});

	it("frontmatter 缺 name → 拒绝", () => {
		const folder = join(source, "x");
		mkdirSync(folder, { recursive: true });
		writeFileSync(join(folder, "SKILL.md"), "---\ndescription: 只有描述\n---\n正文");
		expect(() => importSkill(folder)).toThrow(/name/);
	});

	it("frontmatter 缺 description → 拒绝（模型无法判断何时使用）", () => {
		const folder = join(source, "x");
		mkdirSync(folder, { recursive: true });
		writeFileSync(join(folder, "SKILL.md"), "---\nname: x\n---\n正文");
		expect(() => importSkill(folder)).toThrow(/description/);
	});

	it("非法技能名（大写）→ 拒绝", () => {
		const folder = join(source, "weird");
		mkdirSync(folder, { recursive: true });
		writeFileSync(join(folder, "SKILL.md"), "---\nname: Bad_Name\ndescription: 非法\n---\n正文");
		expect(() => importSkill(folder)).toThrow(/不合法/);
	});

	it("同名已存在 → 拒绝且不覆盖", () => {
		const folder = makeSkillFolder("meeting-notes");
		importSkill(folder);
		// 用户手工改过目标目录……
		const target = join(configDir, "skills", "meeting-notes", "SKILL.md");
		writeFileSync(target, "# 用户改过");
		// ……导入应拒绝，不许覆盖。
		expect(() => importSkill(folder)).toThrow(/已存在/);
		expect(readText(target)).toBe("# 用户改过");
	});
});
