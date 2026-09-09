/**
 * 会话导出路径构造的测试。
 *
 * 这里守住的是「导出文件名永远合法且可预测」—— Windows 对文件名字符最严，
 * 标题来自模型生成的会话摘要，什么字符都可能出现。
 */

import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildExportPath, sanitizeExportTitle } from "./session-export.ts";

/** 固定时刻：2026-09-09 15:04:05（本地时区构造，与实现同口径）。 */
const NOW = new Date(2026, 8, 9, 15, 4, 5);
const STAMP = "20260909-150405";

describe("sanitizeExportTitle", () => {
	it("Windows 非法字符逐个替换为 -", () => {
		for (const ch of ["<", ">", ":", '"', "/", "\\", "|", "?", "*"]) {
			expect(sanitizeExportTitle(`周会${ch}纪要`)).toBe("周会-纪要");
		}
	});

	it("混合非法字符与空白：非法字符逐个换 -，连续空白压成单个空格", () => {
		// < 与 >" 是相邻的三个非法字符，各换一个 -，不合并。
		expect(sanitizeExportTitle('  a<b>"c"   d/e  ')).toBe("a-b--c- d-e");
	});

	it("超长标题截断到 40 字符（41 → 40）", () => {
		const title = "题".repeat(41);
		expect(sanitizeExportTitle(title)).toBe("题".repeat(40));
	});

	it("空标题与纯空白回退为 session", () => {
		expect(sanitizeExportTitle("")).toBe("session");
		expect(sanitizeExportTitle("   \t  ")).toBe("session");
	});

	it("中文标题原样保留", () => {
		expect(sanitizeExportTitle("三季度销售复盘")).toBe("三季度销售复盘");
	});

	it("控制字符替换为 -（含 \\x00-\\x1f 与 \\x7f）", () => {
		expect(sanitizeExportTitle("a\u0001b\u001fc\u007fd")).toBe("a-b-c-d");
	});
});

describe("buildExportPath", () => {
	it("文件名 = 清洗标题 + 时间戳，格式精确为 yyyyMMdd-HHmmss", () => {
		expect(buildExportPath("D:\\exports", "周会纪要", NOW)).toBe(
			join("D:\\exports", `周会纪要-${STAMP}.html`),
		);
	});

	it("exportsDir 结尾有无分隔符结果一致", () => {
		const withSep = buildExportPath(join("D:\\exports") + "\\", "周报", NOW);
		const withoutSep = buildExportPath("D:\\exports", "周报", NOW);
		expect(withSep).toBe(withoutSep);
		expect(withoutSep).toBe(join("D:\\exports", `周报-${STAMP}.html`));
	});
});
