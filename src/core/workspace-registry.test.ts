/**
 * workspace-registry 测试。
 *
 * 读写部分用 KAMIBUDDY_CONFIG_DIR 指向临时目录隔离（同 preferences.test.ts）。
 * 校验部分是纯函数，直接断言错误串 / undefined。
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	readDisplayNames,
	removeDisplayName,
	setDisplayName,
	validateDisplayName,
} from "./workspace-registry.ts";

let dir: string;

beforeEach(() => {
	dir = join(tmpdir(), `kbw-test-${process.pid}-${Date.now()}`);
	mkdirSync(dir, { recursive: true });
	process.env["KAMIBUDDY_CONFIG_DIR"] = dir;
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
	delete process.env["KAMIBUDDY_CONFIG_DIR"];
});

describe("validateDisplayName", () => {
	it.each(["", "   ", "\t\n"])("空或空白：%j", (name) => {
		expect(validateDisplayName(name, [])).toBe("名称不能为空");
	});

	it.each(["\\", "/", ":", "*", "?", '"', "<", ">", "|"])("非法字符：%s", (ch) => {
		expect(validateDisplayName(`a${ch}b`, [])).toBe(
			"名称不能包含以下字符：\\ / : * ? \" < > |",
		);
	});

	it("256 字符超长", () => {
		expect(validateDisplayName("a".repeat(256), [])).toBe("名称过长（最多 255 字符）");
	});

	it("255 字符合法", () => {
		expect(validateDisplayName("a".repeat(255), [])).toBeUndefined();
	});

	it("与 siblings 重名（大小写不敏感）", () => {
		expect(validateDisplayName("Notes", ["notes"])).toBe("已存在同名空间「Notes」");
		expect(validateDisplayName("notes", ["NOTES"])).toBe("已存在同名空间「notes」");
	});

	it.each(["CON", "con", "PRN", "aux", "NUL", "com1", "COM9", "lpt1", "LPT9"])(
		"保留名：%s",
		(name) => {
			expect(validateDisplayName(name, [])).toBe(`「${name}」是系统保留名称，不能使用`);
		},
	);

	it("合法中文名（含前后空白被 trim）", () => {
		expect(validateDisplayName("工作文档", [])).toBeUndefined();
		expect(validateDisplayName("  工作文档  ", [])).toBeUndefined();
	});
});

describe("显示名读写", () => {
	it("文件不存在返回空表", () => {
		expect(readDisplayNames()).toEqual({});
	});

	it("坏 JSON 兜底为空表（显示名可再生，不阻塞功能）", () => {
		writeFileSync(join(dir, "workspaces.json"), "this is { not json", "utf8");
		expect(readDisplayNames()).toEqual({});
	});

	it("非对象 JSON 兜底为空表", () => {
		writeFileSync(join(dir, "workspaces.json"), '["not", "an", "object"]', "utf8");
		expect(readDisplayNames()).toEqual({});
	});

	it("set → read 往返一致", () => {
		setDisplayName("D:\\work\\a", "空间 A");
		setDisplayName("D:\\work\\b", "空间 B");
		expect(readDisplayNames()).toEqual({
			"D:\\work\\a": "空间 A",
			"D:\\work\\b": "空间 B",
		});
	});

	it("覆盖已有键不丢其他键（读改写语义）", () => {
		setDisplayName("D:\\work\\a", "空间 A");
		setDisplayName("D:\\work\\b", "空间 B");
		setDisplayName("D:\\work\\a", "改名后");
		expect(readDisplayNames()).toEqual({
			"D:\\work\\a": "改名后",
			"D:\\work\\b": "空间 B",
		});
	});

	it("removeDisplayName 删除键", () => {
		setDisplayName("D:\\work\\a", "空间 A");
		setDisplayName("D:\\work\\b", "空间 B");
		removeDisplayName("D:\\work\\a");
		expect(readDisplayNames()).toEqual({ "D:\\work\\b": "空间 B" });
	});

	it("removeDisplayName 键不存在也正常返回（幂等）", () => {
		setDisplayName("D:\\work\\a", "空间 A");
		removeDisplayName("D:\\work\\nonexistent");
		expect(readDisplayNames()).toEqual({ "D:\\work\\a": "空间 A" });
	});

	it("过滤非字符串值（手工编辑容错，逐条而非整体拒绝）", () => {
		writeFileSync(
			join(dir, "workspaces.json"),
			JSON.stringify({ a: "ok", b: 123, c: null }),
			"utf8",
		);
		expect(readDisplayNames()).toEqual({ a: "ok" });
	});
});
