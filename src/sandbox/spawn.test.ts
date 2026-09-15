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
