/**
 * agents 加载器的测试。
 *
 * 与 resources.test.ts 同款思路：加载器若静默吞错，task 工具会以残缺的
 * agent 集运行（甚至一个都没有），每条报错路径都有测试压着。
 * 末尾一组走真实 resources/agents/ 目录，防「内置四员」被重构改坏。
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadAgents } from "./agents.ts";

let root: string;
let builtinDir: string;
let userDir: string;

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "kami-agents-"));
	builtinDir = join(root, "resources-agents");
	userDir = join(root, "user-agents");
	mkdirSync(builtinDir, { recursive: true });
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

function agentFile(name: string, frontmatter: string, body = "正文"): string {
	return `---\n${frontmatter}\n---\n${body}`;
}

function writeBuiltin(name: string, frontmatter?: string, body?: string): void {
	writeFileSync(
		join(builtinDir, `${name}.md`),
		agentFile(name, frontmatter ?? `name: ${name}\ndescription: 内置${name}\ntools: [read, grep]`, body),
	);
}

function writeUser(name: string, frontmatter?: string, body?: string): void {
	mkdirSync(userDir, { recursive: true });
	writeFileSync(
		join(userDir, `${name}.md`),
		agentFile(name, frontmatter ?? `name: ${name}\ndescription: 用户${name}\ntools: [read]`, body),
	);
}

describe("正常加载", () => {
	it("内置按文件名序加载，字段齐全", () => {
		writeBuiltin("scout");
		writeBuiltin("planner");

		const agents = loadAgents(builtinDir, userDir);
		expect(agents.map((a) => a.name)).toEqual(["planner", "scout"]);
		expect(agents[1]).toMatchObject({ description: "内置scout", tools: ["read", "grep"], body: "正文" });
	});

	it("内置 + 用户合并：用户独有的追加在后", () => {
		writeBuiltin("scout");
		writeUser("my-agent");

		const agents = loadAgents(builtinDir, userDir);
		expect(agents.map((a) => a.name)).toEqual(["scout", "my-agent"]);
	});

	it("同名用户级覆盖内置：工具面与提示词以用户文件为准", () => {
		writeBuiltin("scout", undefined, "内置版正文");
		writeUser("scout", `name: scout\ndescription: 我的侦察\ntools: [read, ls, web_fetch]`, "用户版正文");

		const agents = loadAgents(builtinDir, userDir);
		expect(agents).toHaveLength(1);
		expect(agents[0]).toMatchObject({ description: "我的侦察", tools: ["read", "ls", "web_fetch"], body: "用户版正文" });
	});

	it("用户目录不存在 = 空，只返回内置", () => {
		writeBuiltin("scout");
		const agents = loadAgents(builtinDir, join(root, "不存在的目录"));
		expect(agents.map((a) => a.name)).toEqual(["scout"]);
	});
});

describe("报错路径", () => {
	it("内置目录缺失 → 抛错（打包错误）", () => {
		expect(() => loadAgents(join(root, "没有"), userDir)).toThrow(/内置子代理目录缺失/);
	});

	it("内置目录为空 → 抛错", () => {
		expect(() => loadAgents(builtinDir, userDir)).toThrow(/内置子代理目录为空/);
	});

	it("缺 name → 抛错并带文件路径", () => {
		writeBuiltin("scout", "description: D\ntools: [read]");
		expect(() => loadAgents(builtinDir, userDir)).toThrow(/scout\.md.*name/);
	});

	it("缺 description → 抛错", () => {
		writeBuiltin("scout", "name: scout\ntools: [read]");
		expect(() => loadAgents(builtinDir, userDir)).toThrow(/description/);
	});

	it("缺 tools → 抛错（无白名单等于给全部工具，不可默认）", () => {
		writeBuiltin("scout", "name: scout\ndescription: D");
		expect(() => loadAgents(builtinDir, userDir)).toThrow(/tools/);
	});

	it("tools 为空数组 → 抛错（没有工具的子代理无法工作）", () => {
		writeBuiltin("scout", "name: scout\ndescription: D\ntools: []");
		expect(() => loadAgents(builtinDir, userDir)).toThrow(/tools 不能为空数组/);
	});

	it("name 与文件名不一致 → 抛错（防改名漏改引用）", () => {
		writeBuiltin("scout", "name: 改名了\ndescription: D\ntools: [read]");
		expect(() => loadAgents(builtinDir, userDir)).toThrow(/name「改名了」与文件名不一致/);
	});

	it("用户目录里的坏文件同样抛错，不因为是用户级就放宽", () => {
		writeBuiltin("scout");
		writeUser("bad", "name: bad\ndescription: 只有描述");
		expect(() => loadAgents(builtinDir, userDir)).toThrow(/bad\.md.*tools/);
	});
});

describe("真实 resources/agents/ 的回归约束", () => {
	// 走真实目录而不是 mkdtemp 样例：防未来重构改坏内置四员的工具面
	// （与 resources.test.ts 里 craft 白名单回归测试同款防护）。
	const realBuiltin = resolve(import.meta.dirname, "..", "..", "resources", "agents");
	// 用户目录传一个必不存在的路径（root 由 beforeEach 建好，收集期拿不到，故在 it 内求值）。
	const noUser = () => join(root, "无用户目录");

	it("内置四员齐全：scout / planner / reviewer / worker", () => {
		const names = loadAgents(realBuiltin, noUser()).map((a) => a.name);
		expect(names).toEqual(["planner", "reviewer", "scout", "worker"]);
	});

	it("scout / planner / reviewer 是只读工具面", () => {
		const agents = loadAgents(realBuiltin, noUser());
		for (const name of ["scout", "planner", "reviewer"]) {
			const agent = agents.find((a) => a.name === name);
			expect(agent, `${name} 应存在`).toBeDefined();
			expect(agent?.tools, `${name} 应是只读`).toEqual(["read", "read_document", "find", "grep", "ls", "web_search", "web_fetch"]);
		}
	});

	it("worker 有写与命令工具，但没有 task / questionnaire / automation_*", () => {
		const worker = loadAgents(realBuiltin, noUser()).find((a) => a.name === "worker");
		expect(worker, "worker 应存在").toBeDefined();
		for (const tool of ["write", "edit", "powershell", "present_files"]) {
			expect(worker?.tools, `worker 应含 ${tool}`).toContain(tool);
		}
		for (const tool of ["task", "questionnaire", "automation_create", "automation_list", "automation_delete"]) {
			expect(worker?.tools, `worker 不应含 ${tool}`).not.toContain(tool);
		}
	});
});
