/**
 * 工作区与私有 temp 的**路径边界**（对照 dsh
 * `packages/sandbox/sandbox-windows-acl/tests/path-boundary.spec.ts`）。
 *
 * 为什么这个维度要单独钉：两块区域各有自己的 capability（工作区 / 私有 temp），
 * 一旦派生出的路径互相包含，两个 capability 就会在继承上合并成一块 ——
 * 「撤销工作区授权」会顺带影响 temp、或反之；而症状是「换台机器就写不出临时文件」
 * 这种查不出来的假边界。我们与 dsh 的实现形态不同（dsh 有一对显式的
 * assertXxx 守卫；我们是确定性派生 + 两套盐），所以等价物是：
 *
 *   A. 派生位置：私有 temp 落在系统 temp 下、与工作区**两向都不相交**，
 *      同一工作区恒定（幂等授权快路径的前提）、不同工作区互不共享；
 *   B. capability 边界：即便路径恰好相同，工作区 SID 与 temp SID 也必须分开
 *      （盐不同）—— 两块授权要能独立撤销。
 *
 * 只测**现有实现已经被测得到的性质**（本任务约束：只加测试、不改实现）。
 * 实现里**没有** dsh 那对守卫：工作区若被设成系统 temp（或其下的
 * `kamibuddy-sandbox` 树），派生出的私有 temp 会落在工作区内部 —— 该残余
 * 已如实记进 `.trae/specs/adopt-dsh-disciplines/tasks.md` 的 Fix 2 条目，
 * 不在这里用断言把缺口说成正常行为。
 *
 * ffi 打桩（对照 probe.test.ts 的做法）：派生只需 `GetTempPathW` 一个调用，
 * 于是整份用例不碰真 Win32，任何平台都能跑。
 */

import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { describe, expect, it, vi } from "vitest";

import type { Win32Bindings } from "./ffi.ts";

vi.mock("./ffi.ts", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./ffi.ts")>();
	return {
		...actual,
		// 私有 temp 的根指向 CI/开发机的真实系统 temp；其余 Win32 调用一概不走。
		loadWin32: async () =>
			({
				getTempPathW: (_length: number, buffer: Buffer) => {
					buffer.write(tmpdir(), "utf16le");
					return tmpdir().length;
				},
			}) as unknown as Win32Bindings,
	};
});

import { sandboxPrivateTempDir } from "./index.ts";
import { tempWriteSid, workspaceWriteSid } from "./workspace-sid.ts";

/** 私有 temp 的根（`privateTempDir` 的父目录）：kamibuddy 自己的子目录。 */
const TEMP_ROOT = join(tmpdir(), "kamibuddy-sandbox");

/**
 * `root` 是 `candidate` 本身或它上层的目录（与 dsh path-boundary.ts 的
 * containsDirectory 同判据；不取 realpath —— 用例里的路径不必真实存在）。
 */
function contains(root: string, candidate: string): boolean {
	const relation = relative(resolve(root), resolve(candidate));
	return (
		relation === "" || (!isAbsolute(relation) && relation !== ".." && !relation.startsWith(`..${sep}`))
	);
}

/** 系统 temp 的兄弟目录：一个「在系统 temp 之外」的工作区（跨平台可解析）。 */
const OUTSIDE_WORKSPACE = join(dirname(tmpdir()), "kami-path-boundary-ws");

describe("私有 temp 的派生位置（A）", () => {
	it("落在系统 temp 的 kamibuddy-sandbox/<16 位摘要> 下，且与工作区两向不相交", async () => {
		// 工作区在系统 temp 下的普通情形（集成测试用的就是这种：scratch 下 mkdtemp）。
		const workspace = join(tmpdir(), "kami-path-boundary-known");
		const temp = await sandboxPrivateTempDir(workspace);

		expect(temp.toLowerCase().startsWith(TEMP_ROOT.toLowerCase())).toBe(true);
		expect(temp.slice(TEMP_ROOT.length + 1)).toMatch(/^[0-9a-f]{16}$/u);
		// 两个方向都要判：任一侧包含另一侧 = 两块 capability 在继承上合并。
		expect(contains(workspace, temp), "私有 temp 落在了工作区内部").toBe(false);
		expect(contains(temp, workspace), "工作区落在了私有 temp 内部").toBe(false);
	});

	it("工作区在系统 temp 之外时同样不相交（路径边界与工作区选在哪里无关）", async () => {
		const temp = await sandboxPrivateTempDir(OUTSIDE_WORKSPACE);
		expect(contains(OUTSIDE_WORKSPACE, temp)).toBe(false);
		expect(contains(temp, OUTSIDE_WORKSPACE)).toBe(false);
	});

	it("同一工作区恒定、大小写不同拼法同值（否则每次会话都重新授权）", async () => {
		const workspace = join(tmpdir(), "Kami-Path-Boundary-Case");
		expect(await sandboxPrivateTempDir(workspace)).toBe(await sandboxPrivateTempDir(workspace));
		expect(await sandboxPrivateTempDir(workspace.toLowerCase())).toBe(
			await sandboxPrivateTempDir(workspace),
		);
	});

	it("不同工作区互不共享私有 temp，也不会把对方的 temp 包进自己里面", async () => {
		const a = join(tmpdir(), "kami-path-boundary-a");
		const b = join(tmpdir(), "kami-path-boundary-b");
		const tempA = await sandboxPrivateTempDir(a);
		const tempB = await sandboxPrivateTempDir(b);

		expect(tempA).not.toBe(tempB);
		expect(contains(a, tempB)).toBe(false);
		expect(contains(b, tempA)).toBe(false);
		expect(contains(tempA, tempB)).toBe(false);
	});
});

describe("两块 capability 的边界（B）", () => {
	it("派生对的 SID 必定不同：授权工作区不会顺带授权私有 temp", async () => {
		const workspace = join(tmpdir(), "kami-path-boundary-sids");
		const temp = await sandboxPrivateTempDir(workspace);
		expect(workspaceWriteSid(workspace)).not.toBe(tempWriteSid(temp));
	});

	it("路径恰好相同时两个 SID 也必须不同（盐不同）—— 撤销工作区授权不得影响 temp", () => {
		/*
		 * 这是 dsh `assertPrivateTempDisjoint` 在我们这侧的等价判据：路径边界在
		 * SID 上的体现。盐一旦被改成同一个，两块区域的 ACE 就会撞成同一枚受托者，
		 * 「独立撤销」不再成立 —— 而单看派生对的路径（B1）永远看不出这一点。
		 */
		const same = join(tmpdir(), "kami-path-boundary-same");
		expect(tempWriteSid(same)).not.toBe(workspaceWriteSid(same));
	});
});
