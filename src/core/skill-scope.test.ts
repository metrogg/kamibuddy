/**
 * 技能作用域判定的测试。
 *
 * 三批：
 *   1. **落点分类**（内置 / 本项目 / 用户级）—— 按路径判，不按目录名猜；
 *   2. **边界与归一** —— 前缀兄弟目录（`D:\ws` vs `D:\ws2`）、正反斜杠、Windows
 *      大小写、无工作区（playground），这几条是裸 `startsWith` 会漏掉的全部情形；
 *   3. **真实入口** —— 用 pi 自己的 `loadSkills` 证明"项目级技能真的会被发现，
 *      且换个工作区就看不到"。这条是本 spec 的核心前提：纯函数判得再对，若 pi
 *      根本不加载工作区里的技能根，功能就是假的（AGENTS.md §8 的"证据要打真入口"）。
 *
 * 第 3 条走的是 daemon `listSkills` 的同一条调用形态（`loadSkills` + `cwd` +
 * `agentDir`），不另搭只有测试用的旁路。
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSkills } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { skillScopeOf, type SkillScope } from "./skill-scope.ts";

/** 随包技能根（真源是 config-paths.ts 的 getBuiltinSkillDirs，测试里固定两个假目录）。 */
const BUILTIN = ["D:\\app\\resources\\skills", "D:\\app\\resources\\plugins"] as const;

const WS = "D:\\ws";

/** 造一个「有工作区（D:\ws）」的判定入参（绝大多数用例）。 */
function scope(filePath: string): SkillScope {
	return skillScopeOf(filePath, { builtinDirs: BUILTIN, workspaceDir: WS });
}

describe("落点分类", () => {
	it("随包技能根下的技能 → builtin", () => {
		expect(scope("D:\\app\\resources\\skills\\docx\\SKILL.md")).toBe("builtin");
	});

	it("照搬的市场插件技能（plugins/ 下递归）→ builtin", () => {
		expect(scope("D:\\app\\resources\\plugins\\market\\plugin\\1.0.0\\skills\\x\\SKILL.md")).toBe("builtin");
	});

	it("工作区内的 .pi/skills/x/SKILL.md → project", () => {
		expect(scope("D:\\ws\\.pi\\skills\\weekly-report\\SKILL.md")).toBe("project");
	});

	it("工作区内的 .agents/skills/x/SKILL.md → project", () => {
		expect(scope("D:\\ws\\.agents\\skills\\weekly-report\\SKILL.md")).toBe("project");
	});

	it("<configDir>/skills/x/SKILL.md → user", () => {
		expect(scope("C:\\Users\\me\\.kamibuddy\\skills\\demo\\SKILL.md")).toBe("user");
	});

	it("~/.agents/skills/x/SKILL.md（区外）→ user", () => {
		expect(scope("C:\\Users\\me\\.agents\\skills\\demo\\SKILL.md")).toBe("user");
	});

	it("~/.pi/agent/skills/x/SKILL.md（pi 的全局位置）→ user", () => {
		expect(scope("C:\\Users\\me\\.pi\\agent\\skills\\demo\\SKILL.md")).toBe("user");
	});

	it("内置目录恰好落在工作区内时仍判 builtin（顺序：先判随包）", () => {
		expect(
			skillScopeOf("D:\\app\\resources\\skills\\docx\\SKILL.md", {
				builtinDirs: BUILTIN,
				workspaceDir: "D:\\app",
			}),
		).toBe("builtin");
	});
});

describe("边界与归一", () => {
	it("工作区根自身 → project", () => {
		expect(scope("D:\\ws")).toBe("project");
	});

	it("工作区根的同名前缀兄弟目录 → user（分量边界，不是字符串前缀）", () => {
		expect(scope("D:\\ws2\\.pi\\skills\\x\\SKILL.md")).toBe("user");
	});

	it("正斜杠写法同样判 project", () => {
		expect(scope("D:/ws/.pi/skills/x/SKILL.md")).toBe("project");
	});

	it("大小写不同（d:\\WS）仍判 project", () => {
		expect(scope("d:\\WS\\.pi\\skills\\x\\SKILL.md")).toBe("project");
	});

	it("workspaceDir 为 undefined（playground）→ 不会是 project", () => {
		const noWorkspace = (p: string): SkillScope => skillScopeOf(p, { builtinDirs: BUILTIN, workspaceDir: undefined });
		expect(noWorkspace("D:\\ws\\.pi\\skills\\x\\SKILL.md")).toBe("user");
		expect(noWorkspace("D:\\ws\\note.md")).toBe("user");
	});
});

describe("真实入口：pi 的 loadSkills 按 cwd 发现项目级技能", () => {
	it("工作区里的 .pi/skills 被发现；换个工作区就看不到", () => {
		const root = mkdtempSync(join(tmpdir(), "kami-skill-scope-"));
		try {
			const ws = join(root, "ws");
			const otherWs = join(root, "ws2");
			const config = join(root, "config");
			mkdirSync(join(ws, ".pi", "skills", "demo"), { recursive: true });
			mkdirSync(otherWs, { recursive: true });
			mkdirSync(config, { recursive: true });
			writeFileSync(
				join(ws, ".pi", "skills", "demo", "SKILL.md"),
				"---\nname: demo\ndescription: 项目级技能用例\n---\n# 正文",
			);

			/*
			 * includeDefaults 必须为 true：pi 0.85.1 的 loadSkills 里，**用户级与项目级默认目录
			 * 是同一个开关**（skills.js: if (includeDefaults) { <agentDir>/skills; <cwd>/.pi/skills }）。
			 * 传 false 会连项目级一起关掉，用例就测不到想测的东西。skillPaths 传空数组：
			 * agentDir 是空 config 目录，不会带进用户级技能，结果里只有项目级这一个。
			 */
			const first = loadSkills({ cwd: ws, agentDir: config, skillPaths: [], includeDefaults: true });
			const demo = first.skills.find((s) => s.name === "demo");
			expect(demo).toBeDefined();
			expect(skillScopeOf(demo?.filePath ?? "", { builtinDirs: [], workspaceDir: ws })).toBe("project");

			const second = loadSkills({ cwd: otherWs, agentDir: config, skillPaths: [], includeDefaults: true });
			expect(second.skills.some((s) => s.name === "demo")).toBe(false);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});
