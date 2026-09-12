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
	return `name: ${name}\ndescription: ${description}\ndisplayName: ${name}显示名\nprofession: ${name}头衔\ndisplayDescription: ${name}一句话\nquickPrompts: [问题一, 问题二, 问题三]\ntags: [标签一, 标签二, 标签三]`;
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
			displayDescription: "legal-contract一句话",
			quickPrompts: ["问题一", "问题二", "问题三"],
			tags: ["标签一", "标签二", "标签三"],
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

	it("来源打点：内置 builtin、用户 user，同名覆盖后翻转为 user", () => {
		writeBuiltin("work-report");
		writeBuiltin("tech-blog");
		writeUser("my-expert");
		writeUser("tech-blog", validFrontmatter("tech-blog", "我的技术博客"));

		const experts = loadExperts(builtinDir, userDir);
		// 「我的专家」子页按 source === "user" 筛选，覆盖内置的用户文件必须算用户级。
		expect(Object.fromEntries(experts.map((e) => [e.name, e.source]))).toEqual({
			"tech-blog": "user",
			"work-report": "builtin",
			"my-expert": "user",
		});
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
		writeBuiltin("work-report", "description: D\ndisplayName: 显示\nprofession: 头衔\ndisplayDescription: 一句话\nquickPrompts: [一, 二, 三]");
		expect(() => loadExperts(builtinDir, userDir)).toThrow(/work-report\.md.*name/);
	});

	it("缺 description → 抛错", () => {
		writeBuiltin("work-report", "name: work-report\ndisplayName: 显示\nprofession: 头衔\ndisplayDescription: 一句话\nquickPrompts: [一, 二, 三]");
		expect(() => loadExperts(builtinDir, userDir)).toThrow(/work-report\.md.*description/);
	});

	it("缺 displayName → 抛错（模式菜单无可显示）", () => {
		writeBuiltin("work-report", "name: work-report\ndescription: D\nprofession: 头衔\ndisplayDescription: 一句话\nquickPrompts: [一, 二, 三]");
		expect(() => loadExperts(builtinDir, userDir)).toThrow(/work-report\.md.*displayName/);
	});

	it("缺 profession → 抛错（模式菜单无可显示）", () => {
		writeBuiltin("work-report", "name: work-report\ndescription: D\ndisplayName: 显示\ndisplayDescription: 一句话\nquickPrompts: [一, 二, 三]");
		expect(() => loadExperts(builtinDir, userDir)).toThrow(/work-report\.md.*profession/);
	});

	it("缺 displayDescription → 抛错（菜单副行无可显示）", () => {
		writeBuiltin("work-report", "name: work-report\ndescription: D\ndisplayName: 显示\nprofession: 头衔\nquickPrompts: [一, 二, 三]");
		expect(() => loadExperts(builtinDir, userDir)).toThrow(/work-report\.md.*displayDescription/);
	});

	it("缺 quickPrompts → 抛错（起手 chips 无数据）", () => {
		writeBuiltin("work-report", "name: work-report\ndescription: D\ndisplayName: 显示\nprofession: 头衔\ndisplayDescription: 一句话");
		expect(() => loadExperts(builtinDir, userDir)).toThrow(/work-report\.md.*quickPrompts/);
	});

	it("quickPrompts 数量不为 3 → 抛错指明数量", () => {
		writeBuiltin("work-report", "name: work-report\ndescription: D\ndisplayName: 显示\nprofession: 头衔\ndisplayDescription: 一句话\nquickPrompts: [一, 二]");
		expect(() => loadExperts(builtinDir, userDir)).toThrow(/work-report\.md.*quickPrompts.*恰好 3 个/);
	});

	it("缺 tags → 抛错（市场页卡片 chips 与分类行无数据）", () => {
		writeBuiltin("work-report", "name: work-report\ndescription: D\ndisplayName: 显示\nprofession: 头衔\ndisplayDescription: 一句话\nquickPrompts: [一, 二, 三]");
		expect(() => loadExperts(builtinDir, userDir)).toThrow(/work-report\.md.*tags/);
	});

	it("tags 数量不为 3 → 抛错指明数量", () => {
		writeBuiltin("work-report", "name: work-report\ndescription: D\ndisplayName: 显示\nprofession: 头衔\ndisplayDescription: 一句话\nquickPrompts: [一, 二, 三]\ntags: [一, 二]");
		expect(() => loadExperts(builtinDir, userDir)).toThrow(/work-report\.md.*tags.*恰好 3 个/);
	});

	it("name 与文件名不一致 → 抛错（防改名漏改引用）", () => {
		writeBuiltin("work-report", "name: 改名了\ndescription: D\ndisplayName: 显示\nprofession: 头衔\ndisplayDescription: 一句话\nquickPrompts: [一, 二, 三]");
		expect(() => loadExperts(builtinDir, userDir)).toThrow(/name「改名了」与文件名不一致/);
	});

	it("用户目录里的坏文件同样抛错，不因为是用户级就放宽", () => {
		writeBuiltin("work-report");
		writeUser("bad", "name: bad\ndescription: 只有描述");
		expect(() => loadExperts(builtinDir, userDir)).toThrow(/bad\.md.*displayName/);
	});
});

describe("真实 resources/experts/ 的回归约束", () => {
	// 走真实目录而不是 mkdtemp 样例：防未来重构改坏内置九员的人格文件
	// （与 agents.test.ts 里内置四员回归测试同款防护）。
	const realBuiltin = resolve(import.meta.dirname, "..", "..", "resources", "experts");
	// 用户目录传一个必不存在的路径（root 由 beforeEach 建好，收集期拿不到，故在 it 内求值）。
	const noUser = () => join(root, "无用户目录");

	it("内置九员齐全", () => {
		const names = loadExperts(realBuiltin, noUser()).map((e) => e.name);
		expect(names).toEqual([
			"academic-paper",
			"business-copy",
			"general-writer",
			"legal-contract",
			"poetry-prose",
			"science-writing",
			"stock-research-report",
			"tech-blog",
			"work-report",
		]);
	});

	it("每员的展示字段与正文人格齐全", () => {
		const experts = loadExperts(realBuiltin, noUser());
		for (const expert of experts) {
			expect(expert.displayName, `${expert.name} 应有 displayName`).not.toBe("");
			expect(expert.profession, `${expert.name} 应有 profession`).not.toBe("");
			expect(expert.description, `${expert.name} 应有 description`).not.toBe("");
			expect(expert.displayDescription, `${expert.name} 应有 displayDescription`).not.toBe("");
			// 起手 chips 固定 3 个，菜单与对话页按此排版。
			expect(expert.quickPrompts, `${expert.name} 应有 3 个 quickPrompts`).toHaveLength(3);
			for (const prompt of expert.quickPrompts) {
				expect(prompt, `${expert.name} 的 quickPrompts 不应有空项`).not.toBe("");
			}
			// 卡片 tag chips 与分类行固定按 3 个排版。
			expect(expert.tags, `${expert.name} 应有 3 个 tags`).toHaveLength(3);
			for (const tag of expert.tags) {
				expect(tag, `${expert.name} 的 tags 不应有空项`).not.toBe("");
			}
			// 正文人格是注入提示词的主体，空正文等于人格丢失。
			expect(expert.body.length, `${expert.name} 应有正文人格`).toBeGreaterThan(0);
		}
	});
});
