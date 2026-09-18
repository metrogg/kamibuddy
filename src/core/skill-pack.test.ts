/**
 * 技能打包（packSkillDir）的测试。
 *
 * 钉三件事：
 *   1. **zip 里带技能目录名作根**（`<name>/SKILL.md`）—— 平铺的话用户解包后还得自己
 *      建一层目录才能放进技能目录（WorkBuddy 的 package_skill.py 同款布局）；
 *   2. 子目录（references/ 等）与分隔符：zip 内一律 `/`，Windows 的 `\` 会让解包工具建出怪名字；
 *   3. 安装台账 `_installed.json` **不进包**（它含本机绝对路径，跟着分享出去是泄露且无用）。
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { packSkillDir } from "./skill-pack.ts";

let dir: string;
let skillDir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "kami-skill-pack-"));
	skillDir = join(dir, "weekly-report");
	mkdirSync(join(skillDir, "references"), { recursive: true });
	writeFileSync(join(skillDir, "SKILL.md"), "# 周报整理", "utf8");
	writeFileSync(join(skillDir, "references", "format.md"), "格式说明", "utf8");
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

/** 读回 zip 的**文件**条目名（JSZip 会为每层补目录条目，末位带 `/`；这里只看文件）。 */
async function entriesOf(zipPath: string): Promise<string[]> {
	const zip = await JSZip.loadAsync(readFileSync(zipPath));
	return Object.keys(zip.files)
		.filter((name) => !name.endsWith("/"))
		.sort();
}

describe("packSkillDir", () => {
	it("以技能目录名为根打进 zip，子目录一并收进去（路径用 / 分隔）", async () => {
		const out = join(dir, "weekly-report.zip");
		const bytes = await packSkillDir(skillDir, out);

		expect(existsSync(out)).toBe(true);
		expect(bytes).toBeGreaterThan(0);
		expect(await entriesOf(out)).toEqual(["weekly-report/SKILL.md", "weekly-report/references/format.md"]);
	});

	it("zip 内文件内容与源文件逐字节一致", async () => {
		const out = join(dir, "packed.zip");
		await packSkillDir(skillDir, out);
		const zip = await JSZip.loadAsync(readFileSync(out));
		const body = await zip.file("weekly-report/references/format.md")?.async("string");
		expect(body).toBe("格式说明");
	});

	it("安装台账 _installed.json 不进包（本机安装事实，不该跟着分享出去）", async () => {
		writeFileSync(join(skillDir, "_installed.json"), '{"name":"weekly-report","sourcePath":"D:/ws/x"}', "utf8");
		const out = join(dir, "packed.zip");
		await packSkillDir(skillDir, out);

		expect(await entriesOf(out)).toEqual(["weekly-report/SKILL.md", "weekly-report/references/format.md"]);
	});

	it("重复打包覆盖旧 zip（产物路径是确定的，不留一堆带时间戳的包）", async () => {
		const out = join(dir, "weekly-report.zip");
		await packSkillDir(skillDir, out);
		writeFileSync(join(skillDir, "new.md"), "新增", "utf8");
		await packSkillDir(skillDir, out);

		expect(await entriesOf(out)).toContain("weekly-report/new.md");
	});

	it("打包对象不是目录 → 响亮报错（不生成空包）", async () => {
		const file = join(dir, "not-a-dir.md");
		writeFileSync(file, "x", "utf8");
		await expect(packSkillDir(file, join(dir, "out.zip"))).rejects.toThrow(/不是目录/);
		expect(existsSync(join(dir, "out.zip"))).toBe(false);
	});

	it("空目录 → 响亮报错（空技能包没有意义，别让用户拿到手才发现）", async () => {
		const empty = join(dir, "empty");
		mkdirSync(empty, { recursive: true });
		await expect(packSkillDir(empty, join(dir, "empty.zip"))).rejects.toThrow(/没有可打包的文件/);
	});
});
