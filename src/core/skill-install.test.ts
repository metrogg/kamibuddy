/**
 * 技能导入的测试。重点钉住三类会造成「貌似装成功实际被忽略」的行为：
 *   1. frontmatter 缺 name / description → 拒（没有它们模型无法路由到该技能）
 *   2. 同名已存在 → 拒（目标可能是用户手工改过的，静默覆盖 = 丢改动）
 *   3. 非法技能名 → 拒（pi 按 name 注册 /skill:name 命令，名字错了命令也注册不上）
 *
 * 第二批是安装元数据（sidecar `_installed.json`）：卡片上的「版本 / 来源 / 导入时间」
 * 全靠它，写歪了不会报错、只会让卡片静默少一行，故形状与降级分支都要钉住。
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writePreferences } from "./preferences.ts";
import { importSkill, readInstalledMeta } from "./skill-install.ts";

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

/** 导入后目标技能目录下的 sidecar 路径。 */
function installedMetaPath(name: string): string {
	return join(configDir, "skills", name, "_installed.json");
}

describe("安装元数据（_installed.json）", () => {
	it("导入成功后写入完整 sidecar，并把三个字段随 SkillInfo 返回", () => {
		const folder = makeSkillFolder(
			"meeting-notes",
			"name: meeting-notes\ndescription: 把会议记录整理成纪要\nversion: 1.2.0",
		);
		const before = Date.now();
		const imported = importSkill(folder);
		const after = Date.now();

		expect(JSON.parse(readText(installedMetaPath("meeting-notes")))).toEqual({
			name: "meeting-notes",
			version: "1.2.0",
			source: "local-import",
			sourcePath: folder,
			installedAt: imported.installedAt,
		});
		expect(imported.version).toBe("1.2.0");
		expect(imported.sourcePath).toBe(folder);
		expect(imported.installedAt).toBeGreaterThanOrEqual(before);
		expect(imported.installedAt).toBeLessThanOrEqual(after);
	});

	it("SKILL.md 没声明 version → sidecar 不带 version 键（不写 null / 空串占位）", () => {
		const folder = makeSkillFolder("meeting-notes");
		const imported = importSkill(folder);

		const raw = JSON.parse(readText(installedMetaPath("meeting-notes"))) as Record<string, unknown>;
		expect("version" in raw).toBe(false);
		expect(imported.version).toBeUndefined();
	});

	it("来源里自带的 _installed.json 被本次导入覆盖（导入时间以本次为准）", () => {
		const folder = makeSkillFolder("meeting-notes");
		// 模拟「从一个已装技能目录再导入一次」：来源里带着上一处的安装记录。
		writeFileSync(
			join(folder, "_installed.json"),
			`${JSON.stringify({ name: "meeting-notes", source: "local-import", sourcePath: "D:/old-place", installedAt: 1 })}\n`,
			"utf8",
		);

		const imported = importSkill(folder);
		const meta = readInstalledMeta(join(configDir, "skills", "meeting-notes"));
		expect(meta?.sourcePath).toBe(folder);
		expect(meta?.installedAt).toBe(imported.installedAt);
		expect(meta?.installedAt).not.toBe(1);
	});

	it("写 sidecar 失败 → 整个导入失败并回滚（不留半装状态）", () => {
		const folder = makeSkillFolder("meeting-notes");
		// 让目标位置的 _installed.json 是个**目录**：cpSync 会把它复制过去，
		// 随后的 writeFileSync 必然失败 —— 这是不依赖权限/平台就能造出写失败的办法。
		mkdirSync(join(folder, "_installed.json"), { recursive: true });

		expect(() => importSkill(folder)).toThrow(/回滚/);
		// 回滚 = 目标目录整体消失，用户重试一次仍然走得通。
		expect(existsSync(join(configDir, "skills", "meeting-notes"))).toBe(false);
	});

	it("导入的辅助文件照样一并复制，sidecar 不影响技能内容", () => {
		const folder = makeSkillFolder("meeting-notes");
		importSkill(folder);
		expect(existsSync(join(configDir, "skills", "meeting-notes", "helpers.md"))).toBe(true);
		expect(readText(join(configDir, "skills", "meeting-notes", "SKILL.md"))).toBe(readText(join(folder, "SKILL.md")));
	});
});

describe("导入结果如实回报可见性与启用状态", () => {
	it("disable-model-invocation 按来源 SKILL.md 如实返回（不再硬写 false）", () => {
		const folder = makeSkillFolder(
			"typeset",
			"name: typeset\ndescription: 内部排版子技能\ndisable-model-invocation: true",
		);
		expect(importSkill(folder).disableModelInvocation).toBe(true);
	});

	it("没声明 disable-model-invocation → false（缺省与 pi 的加载口径一致）", () => {
		const folder = makeSkillFolder("meeting-notes");
		expect(importSkill(folder).disableModelInvocation).toBe(false);
	});

	it("enabled 读用户级覆盖：名字上留着旧的停用记录时如实回报 false", () => {
		// 用户先停用了同名技能、又手工删掉目录再重新导入 —— 覆盖记录还在偏好里。
		writePreferences({ activeModelKey: undefined, skillOverrides: { "meeting-notes": "off" } });
		const imported = importSkill(makeSkillFolder("meeting-notes"));
		expect(imported.enabled).toBe(false);
	});

	it("无覆盖记录时 enabled 为 true（缺省启用）", () => {
		expect(importSkill(makeSkillFolder("meeting-notes")).enabled).toBe(true);
	});
});

describe("readInstalledMeta 的降级分支", () => {
	/** 造一个技能目录，可选写入 sidecar 内容。 */
	function makeDir(name: string, sidecar?: string): string {
		const skillDir = join(dir, name);
		mkdirSync(skillDir, { recursive: true });
		if (sidecar !== undefined) writeFileSync(join(skillDir, "_installed.json"), sidecar, "utf8");
		return skillDir;
	}

	it("没有 _installed.json（手工放置）→ undefined 且**不**记日志", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		try {
			expect(readInstalledMeta(makeDir("manual"))).toBeUndefined();
			expect(spy).not.toHaveBeenCalled();
		} finally {
			spy.mockRestore();
		}
	});

	it("JSON 坏了 → 响亮记日志 + 降级为无元数据（不打挂调用方）", () => {
		const skillDir = makeDir("broken", "{ 这不是 json");
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		try {
			expect(readInstalledMeta(skillDir)).toBeUndefined();
			expect(spy).toHaveBeenCalled();
		} finally {
			spy.mockRestore();
		}
	});

	it("根不是对象（数组 / 标量）→ 记日志 + 降级", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		try {
			expect(readInstalledMeta(makeDir("array", "[1, 2]"))).toBeUndefined();
			expect(readInstalledMeta(makeDir("scalar", '"1.0.0"'))).toBeUndefined();
			expect(spy).toHaveBeenCalledTimes(2);
		} finally {
			spy.mockRestore();
		}
	});

	it("字段类型不对 → 该字段当缺失（不静默纠正）", () => {
		const skillDir = makeDir(
			"shapes",
			// version 是数字、sourcePath 是空串、installedAt 是字符串：三种都不合法。
			JSON.stringify({ version: 2, sourcePath: "", installedAt: "2026-01-01" }),
		);
		expect(readInstalledMeta(skillDir)).toEqual({
			version: undefined,
			sourcePath: undefined,
			installedAt: undefined,
		});
	});

	it("installedAt 非有限数字（JSON 里的 1e999 → Infinity）→ 当缺失", () => {
		const skillDir = makeDir("infinity", '{"version": "1.0.0", "installedAt": 1e999}');
		expect(readInstalledMeta(skillDir)).toEqual({
			version: "1.0.0",
			sourcePath: undefined,
			installedAt: undefined,
		});
	});

	it("字段齐全 → 原样读回", () => {
		const skillDir = makeDir(
			"good",
			JSON.stringify({ name: "good", version: "1.0.0", source: "local-import", sourcePath: "C:/tmp/good", installedAt: 1750000000000 }),
		);
		expect(readInstalledMeta(skillDir)).toEqual({
			version: "1.0.0",
			sourcePath: "C:/tmp/good",
			installedAt: 1750000000000,
		});
	});
});
