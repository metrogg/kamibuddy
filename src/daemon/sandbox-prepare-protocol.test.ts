/**
 * 目录规模扫描的行为测试。
 *
 * 这个数字只用来回答用户的「为什么这次授权等这么久」，所以测试钉三件事：
 *   1. 数得对（文件 + 子目录都算条目）；
 *   2. **两个上限都真的会生效**（条目数、耗时）—— 上限是设计的一部分，
 *      不是兜底：数完 4 万条目自己也要十几秒，不能在一次授权里再付一遍；
 *   3. 不跟符号链接 / junction（防御环，也避免把别的卷算进来）。
 */

import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { countTreeEntries } from "./sandbox-prepare-protocol.ts";

let root = "";

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "kami-scan-"));
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

/** 造一棵确定形状的树：dirs 个目录，每个 filesPerDir 个文件。 */
function makeTree(dirs: number, filesPerDir: number): void {
	for (let d = 0; d < dirs; d += 1) {
		const dir = join(root, `d${d}`);
		mkdirSync(dir, { recursive: true });
		for (let f = 0; f < filesPerDir; f += 1) {
			writeFileSync(join(dir, `f${f}.txt`), "x");
		}
	}
}

describe("countTreeEntries", () => {
	it("文件与子目录都算一个条目", () => {
		makeTree(3, 4);
		// 3 个文件 + 3 个子目录 = 15（根目录自身不算）
		expect(countTreeEntries(root)).toEqual({ entries: 15, capped: false });
	});

	it("空目录是 0 个条目，不是 1", () => {
		expect(countTreeEntries(root)).toEqual({ entries: 0, capped: false });
	});

	it("达到条目上限即收工，并如实标 capped（数字退化为下界）", () => {
		makeTree(4, 5);
		expect(countTreeEntries(root, { limit: 7 })).toEqual({ entries: 7, capped: true });
	});

	it("达到耗时上限即收工，并如实标 capped", () => {
		makeTree(3, 3);
		// 每次取时钟都跳 10 秒：第一层目录扫完就到点。
		let clock = 0;
		const now = (): number => (clock += 10_000);
		expect(countTreeEntries(root, { timeLimitMs: 5_000, now })).toEqual({
			entries: 3,
			capped: true,
		});
	});

	it("不跟符号链接 / junction（防环，也不把别的卷算进来）", () => {
		makeTree(1, 1);
		const outside = mkdtempSync(join(tmpdir(), "kami-scan-out-"));
		try {
			writeFileSync(join(outside, "deep.txt"), "x");
			symlinkSync(outside, join(root, "link"), "junction");
			// 链接本身算 1 个条目，但链接指向的那棵树不算 —— 否则数字会虚高，
			// 且在环上会一直转。
			expect(countTreeEntries(root)).toEqual({ entries: 3, capped: false });
		} finally {
			rmSync(outside, { recursive: true, force: true });
		}
	});

	it("路径不存在时返回 0 而不是抛错（授权失败会由 prepare 自己响亮报出来）", () => {
		expect(countTreeEntries(join(root, "不存在"))).toEqual({ entries: 0, capped: false });
	});
});
