/**
 * 会话读侧「待分配 cwd（空串）」收口的测试。
 *
 * 回归背景（spec: align-per-task-dirs）：未选工作空间的新任务，cwd 从共享临时目录
 * （真实路径）改成了空串 `""`（待分配，首次发消息才分配目录）。空串不是相对路径，
 * 但 path.join / path.resolve 会把它按 **daemon 进程的 cwd**（应用目录）解析 ——
 * 「没有工作目录」被误读成「应用目录下的工作目录」。这里钉住：空串传给读入口只跳过
 * 项目级（用户级 / 全局照常保留）、无用户级可言的部分返回空语义 / 明确报错，绝不落到
 * 进程 cwd 去读同名文件。
 *
 * 怎么模拟「进程 cwd 下有同名文件」（选最稳的方式）：造一个临时目录当诱饵，里面放
 * 上会被误读的文件（.mcp.json / .pi/prompts / .kamibuddy/memory / artifact.txt），
 * 再 process.chdir 进去，afterEach 还原。vitest 默认 forks 池（每个测试文件独立
 * 进程），chdir 不会串到别的测试文件，且 afterEach 兜底还原，比只断言「返回空」
 * 更能证明「没有按相对路径去读进程 cwd」。
 * 用户级配置（~/.kamibuddy 的记忆 / MCP）用 KAMIBUDDY_CONFIG_DIR 指向空临时目录隔离，
 * 否则本机真实的用户级内容会污染断言。
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	buildSessionMemorySection,
	listSessionPromptTemplates,
	readSessionArtifact,
	readSessionMcpConfig,
	statSessionArtifact,
} from "./session-cwd-reads.ts";

let originalCwd: string;
/** 扮演「daemon 进程 cwd」的诱饵目录：空串若被当相对路径，这里的东西就会被读到。 */
let processCwdDir: string;
/** 隔离的全局模板目录（listPromptTemplates 的 agentDir）。 */
let agentDir: string;

const tempRoots: string[] = [];
const tempDir = (label: string): string => {
	const dir = mkdtempSync(join(tmpdir(), `kami-cwdreads-${label}-`));
	tempRoots.push(dir);
	return dir;
};

beforeEach(() => {
	originalCwd = process.cwd();
	processCwdDir = tempDir("procwd");
	agentDir = tempDir("agent");
	const configDir = join(tempDir("cfg"), "config");
	mkdirSync(configDir, { recursive: true });
	// 用户级配置隔离：否则本机 ~/.kamibuddy 的记忆 / MCP 会混进断言。
	process.env["KAMIBUDDY_CONFIG_DIR"] = configDir;
	// 用户级 MCP：空 cwd 时它必须仍然可见（空串只代表「没有项目级」，不是「全空」）。
	writeFileSync(
		join(configDir, "mcp.json"),
		`{ "mcpServers": { "user-level": { "url": "https://user.example/mcp" } } }`,
		"utf8",
	);
	// 全局模板：空 cwd 时它也必须仍然可见。
	mkdirSync(join(agentDir, "prompts"), { recursive: true });
	writeFileSync(join(agentDir, "prompts", "global.md"), "全局模板", "utf8");

	// 诱饵文件：读入口若没守住空串，这些会被当「会话工作目录下的东西」读到。
	writeFileSync(
		join(processCwdDir, ".mcp.json"),
		`{ "mcpServers": { "decoy": { "url": "https://decoy.invalid" } } }`,
		"utf8",
	);
	mkdirSync(join(processCwdDir, ".pi", "prompts"), { recursive: true });
	writeFileSync(
		join(processCwdDir, ".pi", "prompts", "decoy.md"),
		"---\ndescription: 诱饵模板\n---\n正文",
		"utf8",
	);
	mkdirSync(join(processCwdDir, ".kamibuddy", "memory"), { recursive: true });
	writeFileSync(join(processCwdDir, ".kamibuddy", "memory", "MEMORY.md"), "诱饵项目记忆", "utf8");
	writeFileSync(join(processCwdDir, "artifact.txt"), "诱饵产物正文", "utf8");

	process.chdir(processCwdDir);
});

afterEach(() => {
	process.chdir(originalCwd);
	delete process.env["KAMIBUDDY_CONFIG_DIR"];
	for (const dir of tempRoots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("readSessionMcpConfig（空串 = 待分配 → 只跳过项目级）", () => {
	it("空串时用户级仍可见，且不读进程 cwd 下的诱饵 .mcp.json", () => {
		const { servers } = readSessionMcpConfig("");
		expect(servers["user-level"]).toEqual({ transport: "http", url: "https://user.example/mcp" });
		expect(servers["decoy"]).toBeUndefined();
	});

	it("给定真实 cwd 时项目级配置照常生效（证明诱饵确实可读）", () => {
		expect(readSessionMcpConfig(processCwdDir).servers["decoy"]).toBeDefined();
	});
});

describe("listSessionPromptTemplates（空串 = 待分配 → 只跳过项目级）", () => {
	it("空串时全局模板仍可见，且不扫进程 cwd 下的诱饵 .pi/prompts", () => {
		const names = listSessionPromptTemplates("", agentDir).map((t) => t.name);
		expect(names).toContain("global");
		expect(names).not.toContain("decoy");
	});

	it("给定真实 cwd 时项目级模板照常被发现", () => {
		const names = listSessionPromptTemplates(processCwdDir, agentDir).map((t) => t.name);
		expect(names).toContain("decoy");
	});
});

describe("buildSessionMemorySection（空串 = 待分配 → 无工作区记忆）", () => {
	it("空串不读进程 cwd 下的 .kamibuddy/memory", () => {
		expect(buildSessionMemorySection("")).toBeUndefined();
	});

	it("给定真实 cwd 时项目记忆照常注入", () => {
		expect(buildSessionMemorySection(processCwdDir)).toContain("诱饵项目记忆");
	});
});

describe("statSessionArtifact（空串 = 待分配 → 相对路径视作不存在）", () => {
	it("空串时相对路径不落到进程 cwd 探测（诱饵文件存在也报 missing）", () => {
		expect(statSessionArtifact("", "artifact.txt")).toEqual({ kind: "missing" });
	});

	it("空串时绝对路径不受影响（徽章要服务工作区外路径）", () => {
		expect(statSessionArtifact("", join(processCwdDir, "artifact.txt"))).toEqual({ kind: "file" });
	});

	it("给定真实 cwd 时相对路径正常探测", () => {
		expect(statSessionArtifact(processCwdDir, "artifact.txt")).toEqual({ kind: "file" });
	});
});

describe("readSessionArtifact（空串 = 待分配 → 明确报错，不静默返回空）", () => {
	it("空串时拒绝读取（没有工作目录就没有可读区间）", () => {
		expect(() => readSessionArtifact("", "artifact.txt")).toThrow(/工作目录/);
	});

	it("给定真实 cwd 时正常读到内容", () => {
		expect(readSessionArtifact(processCwdDir, "artifact.txt").text).toBe("诱饵产物正文");
	});

	it("越过工作区边界的路径仍拒", () => {
		expect(() => readSessionArtifact(processCwdDir, "../escape.txt")).toThrow(/超出当前工作区/);
	});
});
