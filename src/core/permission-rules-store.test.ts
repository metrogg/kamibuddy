/**
 * 权限规则文件 store 的测试。
 *
 * 用 KAMIBUDDY_CONFIG_DIR 隔离到临时目录（与 memory.test.ts 同范式），
 * 重点钉住降级口径：规则文件是用户数据，不存在/读坏都按空规则集降级，
 * 不抛错 —— 但「存在却坏了」必须经 warn 回调留痕，降级不沉默。
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PermissionRule } from "../shared/permissions.ts";
import {
	appendPermissionRule,
	loadPermissionRules,
	permissionRulesPath,
	savePermissionRules,
} from "./permission-rules-store.ts";

const GIT_ALLOW: PermissionRule = { tool: "powershell", prefix: "git", action: "allow" };
const RM_DENY: PermissionRule = { tool: "powershell", prefix: "Remove-Item", action: "deny" };

let configDir: string;

beforeEach(() => {
	const stamp = `kbrules-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	configDir = join(tmpdir(), stamp, "config");
	mkdirSync(configDir, { recursive: true });
	process.env["KAMIBUDDY_CONFIG_DIR"] = configDir;
});

afterEach(() => {
	delete process.env["KAMIBUDDY_CONFIG_DIR"];
	rmSync(join(configDir, ".."), { recursive: true, force: true });
});

describe("loadPermissionRules", () => {
	it("文件不存在 → []（常态：用户从未写回过规则），且不 warn", () => {
		const warnings: string[] = [];
		expect(loadPermissionRules((m) => warnings.push(m))).toEqual([]);
		expect(warnings).toEqual([]);
	});

	it("坏 JSON → [] 且 warn 留痕（降级不沉默，但不抛错阻断判定）", () => {
		writeFileSync(permissionRulesPath(), "{not json", "utf8");
		const warnings: string[] = [];
		expect(loadPermissionRules((m) => warnings.push(m))).toEqual([]);
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain("permissions.rules.json");
	});

	it("合法文件 → 解析出规则（行级降级由 parseRulesFile 负责，store 不重复）", () => {
		savePermissionRules([GIT_ALLOW, RM_DENY]);
		expect(loadPermissionRules()).toEqual([GIT_ALLOW, RM_DENY]);
	});
});

describe("appendPermissionRule", () => {
	it("新规则追加到末尾", () => {
		expect(appendPermissionRule(RM_DENY, [GIT_ALLOW])).toEqual([GIT_ALLOW, RM_DENY]);
	});

	it("同 tool+prefix+action 已存在 → 返回原数组引用（调用方凭引用判断别落盘）", () => {
		const rules: readonly PermissionRule[] = [GIT_ALLOW];
		expect(appendPermissionRule({ ...GIT_ALLOW }, rules)).toBe(rules);
	});

	it("action 不同不算重复（git allow 与 git deny 是两条规则）", () => {
		const rules: readonly PermissionRule[] = [GIT_ALLOW];
		const next = appendPermissionRule({ tool: "powershell", prefix: "git", action: "deny" }, rules);
		expect(next).toHaveLength(2);
	});
});

describe("savePermissionRules", () => {
	it("写出 version:1、2 空格缩进的 JSON", () => {
		savePermissionRules([GIT_ALLOW]);
		const text = readFileSync(permissionRulesPath(), "utf8");
		expect(JSON.parse(text)).toEqual({ version: 1, rules: [GIT_ALLOW] });
		expect(text).toContain('{\n  "version": 1,');
	});

	it("配置目录不存在时先建目录", () => {
		rmSync(configDir, { recursive: true, force: true });
		savePermissionRules([GIT_ALLOW]);
		expect(loadPermissionRules()).toEqual([GIT_ALLOW]);
	});

	it("save → load 回环：写回的文件下次启动读得回来", () => {
		savePermissionRules([GIT_ALLOW, RM_DENY]);
		expect(loadPermissionRules()).toEqual([GIT_ALLOW, RM_DENY]);
	});
});
