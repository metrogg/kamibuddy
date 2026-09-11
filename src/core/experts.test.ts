/**
 * experts 加载器的测试。
 *
 * 与 agents.test.ts 同款思路：加载器若静默吞错，专家模式会以残缺的人格集
 * 运行（甚至一个都没有），每条报错路径都有测试压着。
 * 末尾一组走真实 resources/experts/ 目录，防「内置六员」被重构改坏。
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadExperts } from "./experts.ts";

let root: string;
let builtinDir: string;
let userDir: string;

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "kami-experts-"));
	builtinDir = join(root, "resources-experts");
	userDir = join(root, "user-experts");
	mkdirSync(builtinDir, { recursive: true });
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

function expertFile(frontmatter: string, body = "正文"): string {
	return `---\n${frontmatter}\n---\n${body}`;
}

function validFrontmatter(name: string, description = `内置${name}`): string {
	return `name: ${name}\ndescription: ${description}\ndisplayName: ${name}显示名\nprofession: ${name}头衔`;
}

function writeBuiltin(name: string, frontmatter?: string, body?: string): void {
	writeFileSync(join(builtinDir, `${name}.md`), expertFile(frontmatter ?? validFrontmatter(name), body));
}

function writeUser(name: string, frontmatter?: string, body?: string): void {
	mkdirSync(userDir, { recursive: true });
	writeFileSync(join(userDir, `${name}.md`), expertFile(frontmatter ?? validFrontmatter(name, `用户${name}`), body));
}

describe("正常加载", () => {
	it("内置按文件名序加载，字段齐全", () => {
		writeBuiltin("tech-blog");
		writeBuiltin("legal-contract");

		const experts = loadExperts(builtinDir, userDir);
		expect(experts.map((e) => e.name)).toEqual(["legal-contract", "tech-blog"]);
		expect(experts[0]).toMatchObject({
			description: "内置legal-contract",
			displayName: "legal-contract显示名",
			profession: "legal-contract头衔",
			body: "正文",
		});
	});

	it("内置 + 用户合并：用户独有的追加在后", () => {
		writeBuiltin("work-report");
		writeUser("my-expert");

		const experts = loadExperts(builtinDir, userDir);
		expect(experts.map((e) => e.name)).toEqual(["work-report", "my-expert"]);
	});

	it("同名用户级覆盖内置：身份与正文以用户文件为准", () => {
		writeBuiltin("work-report", undefined, "内置版正文");
		writeUser("work-report", validFrontmatter("work-report", "我的周报"), "用户版正文");

		const experts = loadExperts(builtinDir, userDir);
		expect(experts).toHaveLength(1);
		expect(experts[0]).toMatchObject({ description: "我的周报", body: "用户版正文" });
	});

	it("用户目录不存在 = 空，只返回内置", () => {
		writeBuiltin("work-report");
		const experts = loadExperts(builtinDir, join(root, "不存在的目录"));
		expect(experts.map((e) => e.name)).toEqual(["work-report"]);
	});
});

describe("报错路径", () => {
	it("内置目录缺失 → 抛错（打包错误）", () => {
		expect(() => loadExperts(join(root, "没有"), userDir)).toThrow(/内置专家目录缺失/);
	});

	it("内置目录为空 → 抛错", () => {
		expect(() => loadExperts(builtinDir, userDir)).toThrow(/内置专家目录为空/);
	});

	it("缺 name → 抛错并带文件路径", () => {
		writeBuiltin("work-report", "description: D\ndisplayName: 显示\nprofession: 头衔");
		expect(() => loadExperts(builtinDir, userDir)).toThrow(/work-report\.md.*name/);
	});

	it("缺 description → 抛错", () => {
		writeBuiltin("work-report", "name: work-report\ndisplayName: 显示\nprofession: 头衔");
		expect(() => loadExperts(builtinDir, userDir)).toThrow(/work-report\.md.*description/);
	});

	it("缺 displayName → 抛错（模式菜单无可显示）", () => {
		writeBuiltin("work-report", "name: work-report\ndescription: D\nprofession: 头衔");
		expect(() => loadExperts(builtinDir, userDir)).toThrow(/work-report\.md.*displayName/);
	});

	it("缺 profession → 抛错（模式菜单无可显示）", () => {
		writeBuiltin("work-report", "name: work-report\ndescription: D\ndisplayName: 显示");
		expect(() => loadExperts(builtinDir, userDir)).toThrow(/work-report\.md.*profession/);
	});

	it("name 与文件名不一致 → 抛错（防改名漏改引用）", () => {
		writeBuiltin("work-report", "name: 改名了\ndescription: D\ndisplayName: 显示\nprofession: 头衔");
		expect(() => loadExperts(builtinDir, userDir)).toThrow(/name「改名了」与文件名不一致/);
	});

	it("用户目录里的坏文件同样抛错，不因为是用户级就放宽", () => {
		writeBuiltin("work-report");
		writeUser("bad", "name: bad\ndescription: 只有描述");
		expect(() => loadExperts(builtinDir, userDir)).toThrow(/bad\.md.*displayName/);
	});
});

describe("真实 resources/experts/ 的回归约束", () => {
	// 走真实目录而不是 mkdtemp 样例：防未来重构改坏内置六员的人格文件
	// （与 agents.test.ts 里内置四员回归测试同款防护）。
	const realBuiltin = resolve(import.meta.dirname, "..", "..", "resources", "experts");
	// 用户目录传一个必不存在的路径（root 由 beforeEach 建好，收集期拿不到，故在 it 内求值）。
	const noUser = () => join(root, "无用户目录");

	it("内置六员齐全", () => {
		const names = loadExperts(realBuiltin, noUser()).map((e) => e.name);
		expect(names).toEqual([
			"academic-paper",
			"business-copy",
			"general-writer",
			"legal-contract",
			"tech-blog",
			"work-report",
		]);
	});

	it("每员的 displayName / profession / 正文人格齐全", () => {
		const experts = loadExperts(realBuiltin, noUser());
		for (const expert of experts) {
			expect(expert.displayName, `${expert.name} 应有 displayName`).not.toBe("");
			expect(expert.profession, `${expert.name} 应有 profession`).not.toBe("");
			expect(expert.description, `${expert.name} 应有 description`).not.toBe("");
			// 正文人格是注入提示词的主体，空正文等于人格丢失。
			expect(expert.body.length, `${expert.name} 应有正文人格`).toBeGreaterThan(0);
		}
	});
});
