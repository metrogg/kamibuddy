/**
 * 命令行拼装与环境块构造的测试。
 *
 * 这些是纯函数，**不触发 koffi 加载**（ffi.ts 的 koffi 是动态 import），
 * 所以在任何平台都能跑 —— 与 documents/ 能脱离宿主单测同一个道理。
 *
 * 为什么值得逐例钉死：Windows 没有 argv 数组，CreateProcess 收的是一整条
 * 字符串、由被调进程自己按 CommandLineToArgvW 的规则解析。反斜杠规则很反直觉，
 * 写错的症状是「路径里带空格或引号时参数被切错」，而模型只会看到莫名的失败，
 * 很难归因到引号上。
 */

import { describe, expect, it } from "vitest";
import { buildCommandLine, buildEnvBlock, quoteArg } from "./spawn.ts";

describe("quoteArg", () => {
	it("无空格无引号时不加引号", () => {
		expect(quoteArg("abc")).toBe("abc");
		expect(quoteArg("-NoProfile")).toBe("-NoProfile");
		// 反斜杠本身不触发引号：C:\path 里没有空格，加引号纯属多余
		expect(quoteArg("C:\\Users\\foo")).toBe("C:\\Users\\foo");
	});

	it("空串必须成对引号，否则整个参数会消失", () => {
		expect(quoteArg("")).toBe('""');
	});

	it("含空格时包引号", () => {
		expect(quoteArg("a b")).toBe('"a b"');
		expect(quoteArg("C:\\my docs\\x.txt")).toBe('"C:\\my docs\\x.txt"');
	});

	it("内嵌引号：前导反斜杠翻倍再转义引号本身", () => {
		// a"b → "a\"b"
		expect(quoteArg('a"b')).toBe('"a\\"b"');
		// a\"b → 引号前有 1 个反斜杠 → 2*1+1 = 3 个反斜杠 + 引号
		expect(quoteArg('a\\"b')).toBe('"a\\\\\\"b"');
	});

	it("结尾反斜杠必须翻倍——它会与收尾引号相邻", () => {
		// 有空格才会加引号；结尾的 \ 紧邻收尾引号，不翻倍就把引号转义掉了
		expect(quoteArg("a b\\")).toBe('"a b\\\\"');
		expect(quoteArg("C:\\my dir\\")).toBe('"C:\\my dir\\\\"');
	});

	it("中间的反斜杠原样保留，不翻倍", () => {
		// 这条是最容易写错的方向：朴素实现会把所有反斜杠都翻倍
		expect(quoteArg("a\\b c")).toBe('"a\\b c"');
	});
});

describe("buildCommandLine", () => {
	it("按空格连接，逐个按规则引用", () => {
		expect(buildCommandLine("powershell.exe", ["-NoProfile", "-Command", "echo hi"])).toBe(
			'powershell.exe -NoProfile -Command "echo hi"',
		);
	});

	it("程序路径带空格时也被引用", () => {
		expect(buildCommandLine("C:\\Program Files\\x.exe", ["-a"])).toBe('"C:\\Program Files\\x.exe" -a');
	});

	it("无参数时只有程序名", () => {
		expect(buildCommandLine("cmd.exe", [])).toBe("cmd.exe");
	});
});

describe("buildEnvBlock", () => {
	/** 解回可读的 KEY=VALUE 列表，便于断言。 */
	function parse(block: Buffer): string[] {
		const text = block.toString("utf16le");
		// 末尾是双 NUL（最后一项的终止符 + 块终止符），切掉空段
		return text.split("\0").filter((entry) => entry !== "");
	}

	it("以双 NUL 结尾（Win32 环境块的终止约定）", () => {
		const block = buildEnvBlock({ FOO: "bar" });
		const text = block.toString("utf16le");
		expect(text.endsWith("\0\0")).toBe(true);
	});

	it("继承 process.env 而不是整体替换", () => {
		// 整体替换会缺 SystemRoot 之类基础变量，很多程序直接起不来（spike 踩过）
		const inherited = Object.keys(process.env)[0];
		expect(inherited).toBeDefined();
		const entries = parse(buildEnvBlock({ KAMI_TEST_MARKER: "1" }));
		expect(entries.length).toBeGreaterThan(1);
		expect(entries).toContain("KAMI_TEST_MARKER=1");
	});

	it("覆盖同名变量而不是追加两份", () => {
		const key = "KAMI_SANDBOX_OVERRIDE_PROBE";
		const entries = parse(buildEnvBlock({ [key]: "new" }));
		const matched = entries.filter((entry) => entry.startsWith(`${key}=`));
		expect(matched).toEqual([`${key}=new`]);
	});

	it("大小写不同的同名变量按同一个键覆盖（Windows 环境名不区分大小写）", () => {
		/*
		 * 实测踩坑（2026-09-18）：npm / pnpm 会在环境里放 `NPM_CONFIG_CACHE`，而我们往沙箱
		 * 注入的是小写的 `npm_config_cache`。两者是**不同的 JS 键**，于是同时进了环境块，
		 * 而 Windows 取哪一个取决于块内顺序 —— 同一份代码 `npx tsx` 起进程时我们赢、
		 * `npx vitest` 起进程时继承值赢。症状：沙箱里的 `npm install` 有时仍去写用户真实的
		 * `%LOCALAPPDATA%\npm-cache` 而被拒（confinement.win.test.ts 的 npm 缓存用例即因此变红）。
		 * 同一条路也威胁 `PATH`：Windows 上 `process.env` 常见 `Path` 拼写，与注入层的 `PATH` 撞两份。
		 */
		const entries = parse(
			buildEnvBlock(
				{ npm_config_cache: "私有temp\\npm-cache" },
				{ NPM_CONFIG_CACHE: "用户真实缓存", Path: "C:\\Windows" },
			),
		);
		expect(entries).toHaveLength(2);
		expect(entries).toContain("npm_config_cache=私有temp\\npm-cache");
		// 覆盖项没提到的键照常继承（大小写变体不误伤其它变量）。
		expect(entries).toContain("Path=C:\\Windows");
	});

	it("覆盖 PATH 时压过继承来的 Path 拼写（两份 PATH 会让注入失效）", () => {
		const entries = parse(buildEnvBlock({ PATH: "注入目录;基底" }, { Path: "基底" }));
		expect(entries).toHaveLength(1);
		expect(entries[0]).toBe("PATH=注入目录;基底");
	});

	it("UTF-16 编码——CREATE_UNICODE_ENVIRONMENT 与它配对", () => {
		// 不置那个标志时 Win32 会按 ANSI 解释这块内存并回 ERROR_INVALID_PARAMETER，
		// 这正是 dsh 误判为「显式环境块不可用」的根因
		const block = buildEnvBlock({ KAMI_UNICODE_PROBE: "值" });
		expect(parse(block)).toContain("KAMI_UNICODE_PROBE=值");
	});

	it("传入自定义基底时不再继承 process.env（诊断的最小环境对照用）", () => {
		const block = buildEnvBlock({ KAMI_OVERRIDE: "1" }, { ONLY: "base" });
		const entries = parse(block);
		expect(entries).toContain("ONLY=base");
		expect(entries).toContain("KAMI_OVERRIDE=1");
		// 白名单基底里没有的东西不该漏进来
		expect(entries.every((entry) => /^(ONLY|KAMI_OVERRIDE)=/.test(entry))).toBe(true);
	});
});
