/**
 * 目录归属判定的行为测试。
 *
 * 这里的每一条都对应一个安全边界或一个曾经写错的地方：
 *   - 链接穿越（junction/symlink）必须被看穿 —— 2026-09-16 实测的缺口本体；
 *   - 纯大小写差异必须**保留词法形式** —— 否则 details/rememberKey 会随
 *     「祖先目录恰好存在与否」变形（同一目标两次调用得到不同的会话记忆键）；
 *   - 盘符根的剩余段拼接 —— 手工切字符串会吃掉一个字符（真踩过：`E:\` → `E:\\sers`）。
 *
 * 链接用例在两个平台都跑：Windows 用 junction（**不需要管理员权限**，
 * 所以这是模型真走得通的路径），POSIX 用目录 symlink。
 */

import {
	mkdirSync,
	mkdtempSync,
	realpathSync,
	rmSync,
	symlinkSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canonicalizePath, isPathContained } from "./path-containment.ts";

/** junction 是 Windows 的机制；POSIX 上用等效的目录 symlink 覆盖同一语义。 */
const LINK_TYPE = process.platform === "win32" ? "junction" : "dir";

describe("canonicalizePath — 不涉及链接时的行为", () => {
	it("完全不存在的路径按词法 resolve 返回（判定发生在写入之前，目标通常还不存在）", () => {
		const fake = join(resolve(sep, "users", "someone"), "KamiBuddy", "未命名.md");
		expect(canonicalizePath(fake)).toBe(fake);
	});

	it("相对路径按进程 cwd 解析成绝对路径", () => {
		expect(canonicalizePath("a.md")).toBe(resolve("a.md"));
	});

	it("把 .. 段折叠掉", () => {
		const base = resolve(sep, "data");
		expect(canonicalizePath(join(base, "docs", "..", "x.txt"))).toBe(join(base, "x.txt"));
	});
});

describe("isPathContained — 词法边界", () => {
	const base = join(resolve(sep, "users", "someone"), "KamiBuddy");

	it("目录自身算在内", () => {
		expect(isPathContained(base, base)).toBe(true);
	});

	it("子路径算在内", () => {
		expect(isPathContained(base, join(base, "报告", "周报.md"))).toBe(true);
	});

	it("同名前缀的兄弟目录**不算**在内（这条最容易写错）", () => {
		expect(isPathContained(base, `${base}-backup`)).toBe(false);
	});

	it("父目录不算在内", () => {
		expect(isPathContained(join(base, "报告"), base)).toBe(false);
	});

	it("穿出去的 .. 不算在内", () => {
		expect(isPathContained(base, join(base, "..", "别处.md"))).toBe(false);
	});
});

describe("链接穿越（安全边界本体）", () => {
	let root: string;
	let workspace: string;
	let outside: string;
	let link: string;

	beforeAll(() => {
		// 真实文件系统：链接语义没法用假路径验证。
		root = mkdtempSync(join(tmpdir(), "kami-containment-"));
		workspace = join(root, "workspace");
		outside = join(root, "outside");
		mkdirSync(workspace);
		mkdirSync(outside);
		writeFileSync(join(outside, "secret.txt"), "x");
		link = join(workspace, "escape");
		symlinkSync(outside, link, LINK_TYPE);
	});

	afterAll(() => {
		/*
		 * 先拆链接再删树。顺序要紧：递归删一个含链接的目录，若实现跟随了链接
		 * 就会连**链接指向的真实目录**一起删 —— 这里是临时目录无所谓，
		 * 但这个手法会被复制到别处，所以从一开始就写对。
		 */
		try {
			unlinkSync(link);
		} catch {
			// 已经不在就算了。
		}
		rmSync(root, { recursive: true, force: true });
	});

	it("经链接的既有文件归一化到真实位置", () => {
		expect(canonicalizePath(join(link, "secret.txt"))).toBe(
			join(canonicalizePath(outside), "secret.txt"),
		);
	});

	it("经链接的**尚不存在**的文件也归一化（写入前判定的正是这种路径）", () => {
		expect(canonicalizePath(join(link, "还没建.txt"))).toBe(
			join(canonicalizePath(outside), "还没建.txt"),
		);
	});

	it("经链接写到工作区之外**不算**工作区内 — 缺口本体", () => {
		expect(isPathContained(workspace, join(link, "x.txt"))).toBe(false);
	});

	it("指向区外的链接**自身**也判定为区外", () => {
		/*
		 * 这条容易凭直觉写反（第一版就写反了）：链接确实是工作区目录列表里的
		 * 一个条目，但判定要回答的不是「列表里有什么」，而是**效果落在哪** ——
		 * 任何工具作用于这个路径，读写都发生在 outside。所以它是区外。
		 */
		expect(isPathContained(workspace, link)).toBe(false);
	});

	it("工作区内的普通路径不受影响", () => {
		expect(isPathContained(workspace, join(workspace, "正常.md"))).toBe(true);
	});

	it("base 侧经链接给出时也判定正确（工作区本身可能就是个链接）", () => {
		// 从链接看过去，outside 下的文件既在真实目录内、也在链接路径内。
		expect(isPathContained(link, join(outside, "secret.txt"))).toBe(true);
		expect(isPathContained(link, join(link, "secret.txt"))).toBe(true);
	});
});

describe("大小写：必须保留词法形式，不跟随磁盘的规范形态", () => {
	let root: string;

	beforeAll(() => {
		/*
		 * 布景必须从**已展开**的根建起，这一点第一版写错了：Windows 的
		 * `os.tmpdir()` 返回 8.3 短名（`C:\Users\WANGZH~1\...`，实测），
		 * 把它小写之后与真实路径的差异**不只是大小写**，还有短名展开 ——
		 * 那会走真实路径分支（短名展开是有意义的归一化，实现正是为此才用
		 * `.native`），于是测不到「纯大小写」这条规则。
		 *
		 * 用 node 原语 realpathSync.native 搭布景，而不是用被测函数自己：
		 * 拿被测对象给自己搭台子，它错了测试会跟着一起错。
		 */
		root = realpathSync.native(mkdtempSync(join(tmpdir(), "kami-case-")));
		mkdirSync(join(root, "Docs"));
	});

	afterAll(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("只差大小写的既有目录保留调用方给的写法", () => {
		/*
		 * 为什么这条重要：`realpathSync.native` 会把路径改写成磁盘上的规范大小写。
		 * 而这个返回值会流到 details（弹窗文本）、writeBackPath 与 rememberKey，
		 * 让它随「祖先目录恰好存在与否」变形，会让同一个目标在两次调用间得到
		 * 不同的会话记忆键 —— 用户批准过的目录第二次又被问。
		 */
		const lower = join(root.toLowerCase(), "docs");
		expect(canonicalizePath(lower)).toBe(resolve(lower));
	});

	it("判定仍然大小写不敏感（Windows 上 path.relative 本就如此）", () => {
		if (process.platform !== "win32") return;
		expect(isPathContained(root, join(root.toUpperCase(), "Docs", "x.md"))).toBe(true);
	});
});
