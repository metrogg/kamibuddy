/**
 * 工具结果 spill 的测试。
 *
 * 两条硬要求各有断言：
 *   1. **阈值内行为与改动前完全一致** —— 原文照返、不落盘（目录里一个文件都没有）；
 *   2. **超限时去读那个文件**（验证世界，不是只看返回值自述）—— 落盘文件真实存在
 *      且内容与原始输出逐字节相同，提示里同时给出省略字符数、路径与取回方式。
 */

import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SPILL_MAX_CHARS, spillOversizedText } from "./spill.ts";

function tempDir(): string {
	return mkdtempSync(join(tmpdir(), "kamibuddy-spill-test-"));
}

describe("阈值内：与改动前逐字节一致", () => {
	it("恰好等于阈值 → 原样返回，不落盘、不加任何提示", () => {
		const dir = tempDir();
		const text = "A".repeat(SPILL_MAX_CHARS);
		const result = spillOversizedText(text, { dir, name: "powershell" });

		expect(result.text).toBe(text);
		expect(result.spilled).toBe(false);
		expect(result.spillPath).toBeUndefined();
		// 不落盘是真的没写：目录里空无一物
		expect(readdirSync(dir)).toEqual([]);
	});

	it("短文本 → 原样返回，不落盘", () => {
		const dir = tempDir();
		const result = spillOversizedText("hello", { dir, name: "web_fetch" });

		expect(result.text).toBe("hello");
		expect(result.spilled).toBe(false);
		expect(readdirSync(dir)).toEqual([]);
	});

	it("阈值可覆盖（测试用的窄口），覆盖时判定按新阈值", () => {
		const dir = tempDir();
		const result = spillOversizedText("12345678901", { dir, name: "t", maxChars: 10 });

		expect(result.spilled).toBe(true);
		expect(result.text.startsWith("1234567890")).toBe(true);
		expect(result.text).toContain("已省略 1 个字符");
	});
});

describe("超限：落盘 + 响亮提示", () => {
	it("省略字符数、完整路径、read/grep 取回提示都在；文件真实存在且内容完整", () => {
		const dir = tempDir();
		// 头部 24k 之外还有可见内容，用来验证落盘的是**完整**原文（含尾部）。
		const text = `${"头".repeat(SPILL_MAX_CHARS)}尾部内容`;
		const result = spillOversizedText(text, { dir, name: "web_fetch" });

		expect(result.spilled).toBe(true);
		expect(result.spillPath).toBeDefined();
		// 头部与改动前逐字节一致（改动前是 slice(0, 24_000)）
		expect(result.text.startsWith(text.slice(0, SPILL_MAX_CHARS))).toBe(true);
		// 提示三要素：省略多少 / 完整结果在哪 / 怎么取回
		expect(result.text).toContain(`已省略 ${text.length - SPILL_MAX_CHARS} 个字符`);
		expect(result.text).toContain(result.spillPath ?? "");
		expect(result.text).toContain("read");
		expect(result.text).toContain("grep");

		// 验证世界：去读那个文件，内容必须是完整原文
		expect(readFileSync(result.spillPath ?? "", "utf8")).toBe(text);
	});

	it("落盘目录不存在时按需创建（首次调用）", () => {
		const dir = join(tempDir(), "nested", "spills");
		const text = "B".repeat(50);
		const result = spillOversizedText(text, { dir, name: "mcp__server__tool", maxChars: 10 });

		expect(result.spilled).toBe(true);
		expect(readFileSync(result.spillPath ?? "", "utf8")).toBe(text);
	});

	it("文件名安全化：MCP 工具名里的路径分隔符不构成目录穿越", () => {
		const dir = tempDir();
		spillOversizedText("C".repeat(50), { dir, name: "../../evil", maxChars: 10 });

		const files = readdirSync(dir);
		expect(files).toHaveLength(1);
		// 路径分隔符与点都压成下划线，落点只能是本目录
		expect(files[0]).toMatch(/^_+evil-\d+-\d+\.txt$/);
	});
});

describe("落盘失败：响亮但不改变调用成败", () => {
	it("目录位置被同名文件占住 → 文本里点明失败原因、上报一次、不上抛", () => {
		const dir = tempDir();
		const blocked = join(dir, "occupied");
		writeFileSync(blocked, "x", "utf8");
		const reported: string[] = [];
		const text = "D".repeat(100);
		const result = spillOversizedText(text, {
			dir: blocked,
			name: "powershell",
			maxChars: 10,
			report: (message) => reported.push(message),
		});

		expect(result.spilled).toBe(false);
		expect(result.spillPath).toBeUndefined();
		expect(result.text).toContain("已省略 90 个字符");
		expect(result.text).toContain("落盘失败");
		expect(reported).toHaveLength(1);
	});
});
