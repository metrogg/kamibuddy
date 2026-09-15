/**
 * worktree 操作的集成测试：建真仓库、跑真 git 命令。
 *
 * 刻意不 mock git —— 这一层的全部风险都在「命令拼得对不对、输出解析得对不对」，
 * mock 掉 git 等于把被测对象换成自己写的假设，测试会全绿而功能全错。
 * 代价是依赖环境里有 git（开发机与 CI 都有）。
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	cleanupWorktrees,
	createWorktree,
	getBranchList,
	getCurrentBranch,
	getRepoStatus,
	isGitRepo,
	listLinkedWorktrees,
	listLocalBranches,
	removeWorktree,
	resolveRepoRoot,
} from "./worktree.ts";

/*
 * 本文件是全仓唯一跑真 git 进程的测试：Windows 上单条 git 命令含进程启动与
 * 杀软扫描约 1–2s（实测本机单用例 6–10s），默认 5s 的 testTimeout 会稳定误报；
 * 钩子里的 prepare 目录同样会超。CI（Linux）上快得多，但门槛得按最慢的机器设。
 */
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

/** 跑 git 并回 stdout。`commit.gpgsign=false` 防用户的全局签名配置让测试挂掉。 */
function git(args: readonly string[], cwd: string): string {
	return execFileSync(
		"git",
		["-c", "core.quotepath=false", "-c", "commit.gpgsign=false", ...args],
		{ cwd, encoding: "utf8" },
	);
}

let base: string;
let repo: string;
let root: string;

/** 测试仓库的当前分支名（不硬编码 main/master，随 git 的 init.defaultBranch 走）。 */
async function headBranch(): Promise<string> {
	const branch = await getCurrentBranch(repo);
	if (branch === undefined) throw new Error("测试仓库没有检出分支");
	return branch;
}

beforeEach(async () => {
	base = await mkdtemp(join(tmpdir(), "kami-worktree-"));
	repo = join(base, "repo");
	root = join(base, "worktrees");
	await mkdir(repo, { recursive: true });
	git(["init"], repo);
	git(["config", "user.email", "test@example.com"], repo);
	git(["config", "user.name", "Test"], repo);
	await writeFile(join(repo, "a.txt"), "hello\n", "utf8");
	git(["add", "."], repo);
	git(["commit", "-m", "init"], repo);
});

afterEach(async () => {
	// maxRetries：Windows 上刚跑完的 git 进程交出目录句柄有延迟，
	// 直接 rm 会撞 EBUSY。Node 的 rm 对这组错误内置了退避重试，打开即可。
	await rm(base, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

describe("库识别", () => {
	it("真仓库返回 true", async () => {
		expect(await isGitRepo(repo)).toBe(true);
	});

	it("普通目录返回 false", async () => {
		const plain = join(base, "plain");
		await mkdir(plain, { recursive: true });
		expect(await isGitRepo(plain)).toBe(false);
	});

	it("空串返回 false（会话尚未绑定目录时不炸）", async () => {
		expect(await isGitRepo("")).toBe(false);
	});

	it("子目录也算仓库内", async () => {
		const sub = join(repo, "src", "deep");
		await mkdir(sub, { recursive: true });
		expect(await isGitRepo(sub)).toBe(true);
	});

	it("resolveRepoRoot 把子目录归到仓库根", async () => {
		const sub = join(repo, "src");
		await mkdir(sub, { recursive: true });
		// macOS 的 tmpdir 走 /var → /private/var 符号链接，git 回的是解析后的真路径，
		// 故断言「以仓库目录名结尾」而不是与 repo 全等。
		expect(await resolveRepoRoot(sub)).toMatch(/repo$/);
	});

	it("非仓库返回 undefined", async () => {
		const plain = join(base, "plain2");
		await mkdir(plain, { recursive: true });
		expect(await resolveRepoRoot(plain)).toBeUndefined();
	});
});

describe("分支与状态", () => {
	it("能列出本地分支且当前分支在里面", async () => {
		const current = await headBranch();
		expect(await listLocalBranches(repo)).toContain(current);
	});

	it("getBranchList 一次给出 isGitRepo / 分支 / 当前分支", async () => {
		const list = await getBranchList(repo);
		expect(list.isGitRepo).toBe(true);
		expect(list.branches.length).toBeGreaterThan(0);
		expect(list.currentBranch).toBeDefined();
	});

	it("非仓库的 getBranchList 回安全缺省而不是抛错", async () => {
		const plain = join(base, "plain3");
		await mkdir(plain, { recursive: true });
		const list = await getBranchList(plain);
		expect(list.isGitRepo).toBe(false);
		expect(list.branches).toEqual([]);
		expect(list.currentBranch).toBeUndefined();
	});

	it("干净仓库无未提交改动", async () => {
		const status = await getRepoStatus(repo);
		expect(status.isGitRepo).toBe(true);
		expect(status.hasUncommittedChanges).toBe(false);
	});

	it("改过文件后标为有未提交改动", async () => {
		await writeFile(join(repo, "a.txt"), "changed\n", "utf8");
		expect((await getRepoStatus(repo)).hasUncommittedChanges).toBe(true);
	});
});

describe("createWorktree", () => {
	it("建出副本目录与带 uid 的任务分支", async () => {
		const info = await createWorktree({
			repoCwd: repo,
			baseBranch: await headBranch(),
			rootDir: root,
			uid: "deadbeef",
		});

		expect(existsSync(info.worktreePath)).toBe(true);
		expect(info.taskBranch).toMatch(/^workbuddy\/.*-deadbeef$/);
		expect(basename(info.worktreePath)).toMatch(/-deadbeef$/);
		expect(await listLocalBranches(repo)).toContain(info.taskBranch);
	});

	it("副本按仓库目录名分目录（不是按子目录）", async () => {
		const info = await createWorktree({
			repoCwd: repo,
			baseBranch: await headBranch(),
			rootDir: root,
			uid: "aaaa1111",
		});
		expect(dirname(info.worktreePath)).toBe(join(root, "repo"));
	});

	it("副本从基准分支切出，内容与主仓库一致", async () => {
		const info = await createWorktree({
			repoCwd: repo,
			baseBranch: await headBranch(),
			rootDir: root,
			uid: "bbbb2222",
		});
		expect(existsSync(join(info.worktreePath, "a.txt"))).toBe(true);
	});

	it("传子目录时也归到仓库根下建副本", async () => {
		const sub = join(repo, "src");
		await mkdir(sub, { recursive: true });
		const info = await createWorktree({
			repoCwd: sub,
			baseBranch: await headBranch(),
			rootDir: root,
			uid: "cccc3333",
		});
		// 否则会建出 <副本根>/src/... 这种按子目录分的嵌套结构，
		// 同一个仓库的两条路径会分裂成两棵副本树。
		expect(dirname(info.worktreePath)).toBe(join(root, "repo"));
	});

	it("基准分支不存在时抛错**且回滚**（不留下半拉目录）", async () => {
		await expect(
			createWorktree({
				repoCwd: repo,
				baseBranch: "no-such-branch",
				rootDir: root,
				uid: "dddd4444",
			}),
		).rejects.toThrow();

		expect(existsSync(join(root, "repo", "no-such-branch-dddd4444"))).toBe(false);
	});
});

describe("removeWorktree / listLinkedWorktrees", () => {
	it("删掉副本后目录消失、元数据也清掉", async () => {
		const info = await createWorktree({
			repoCwd: repo,
			baseBranch: await headBranch(),
			rootDir: root,
			uid: "eeee5555",
		});
		await removeWorktree(repo, info.worktreePath);
		expect(existsSync(info.worktreePath)).toBe(false);

		const linked = await listLinkedWorktrees(repo);
		expect(linked.some((w) => w.path.includes("eeee5555"))).toBe(false);
	});

	it("列出的工作树含主树与副本，分支名解析正确", async () => {
		const info = await createWorktree({
			repoCwd: repo,
			baseBranch: await headBranch(),
			rootDir: root,
			uid: "ffff6666",
		});
		const linked = await listLinkedWorktrees(repo);
		expect(linked.length).toBe(2);
		expect(linked.some((w) => w.branch === info.taskBranch)).toBe(true);
	});
});

describe("cleanupWorktrees", () => {
	it("太新的副本被跳过（skippedRecentCount）", async () => {
		await createWorktree({
			repoCwd: repo,
			baseBranch: await headBranch(),
			rootDir: root,
			uid: "11223344",
		});
		const result = await cleanupWorktrees({ repoCwd: repo, olderThanDays: 7, rootDir: root });
		expect(result.cleanedCount).toBe(0);
		expect(result.skippedRecentCount).toBe(1);
	});

	it("够旧但有未提交改动的副本被跳过（skippedDirtyCount）", async () => {
		const info = await createWorktree({
			repoCwd: repo,
			baseBranch: await headBranch(),
			rootDir: root,
			uid: "12345678",
		});
		await writeFile(join(info.worktreePath, "a.txt"), "dirty\n", "utf8");
		// 把「现在」推到 30 天后，让年龄判据通过，只剩脏判据在起作用。
		const result = await cleanupWorktrees({
			repoCwd: repo,
			olderThanDays: 7,
			rootDir: root,
			now: Date.now() + 30 * 24 * 60 * 60 * 1000,
		});
		expect(result.skippedDirtyCount).toBe(1);
		expect(result.cleanedCount).toBe(0);
		expect(existsSync(info.worktreePath)).toBe(true);
	});

	it("够旧且干净的副本被清掉", async () => {
		const info = await createWorktree({
			repoCwd: repo,
			baseBranch: await headBranch(),
			rootDir: root,
			uid: "87654321",
		});
		const result = await cleanupWorktrees({
			repoCwd: repo,
			olderThanDays: 7,
			rootDir: root,
			now: Date.now() + 30 * 24 * 60 * 60 * 1000,
		});
		expect(result.cleanedCount).toBe(1);
		expect(result.cleanedPaths).toEqual([info.worktreePath]);
		expect(existsSync(info.worktreePath)).toBe(false);
	});

	it("不在副本根下的工作树一律不碰（用户自己建的 worktree）", async () => {
		const outside = join(base, "user-owned");
		git(["worktree", "add", "-b", "user-branch", outside, await headBranch()], repo);
		const result = await cleanupWorktrees({
			repoCwd: repo,
			olderThanDays: 0,
			rootDir: root,
			now: Date.now() + 30 * 24 * 60 * 60 * 1000,
		});
		expect(result.cleanedCount).toBe(0);
		expect(existsSync(outside)).toBe(true);
	});
});
