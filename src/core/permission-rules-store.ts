/**
 * 权限规则文件的读写（spec: add-permission-rules-engine）。
 *
 * 文件是 ~/.kamibuddy/permissions.rules.json：{ version: 1, rules: [...] }。
 * 规则类型与解析（parseRulesFile）在 shared/permissions.ts —— 为什么不放
 * extensions/ 见该处注释（core/ 不许 import extensions/，依赖方向机械校验）。
 * 本模块只负责路径、IO 与降级口径。
 *
 * 降级口径与 memory.ts 同例：规则文件是**用户数据**（手改、同步冲突、
 * 写一半断电都可能碰坏它），不存在（用户从未写回过）或读坏都不能阻断
 * 权限判定 —— 按空规则集降级后，判定自然回落到「无命中 → 询问」这个
 * fail-closed 默认，不会因为文件坏了就变成全放行。
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseRulesFile, type PermissionRule } from "../shared/permissions.ts";
import { getConfigDir } from "./config-paths.ts";

/** 规则文件路径（~/.kamibuddy/permissions.rules.json）。 */
export function permissionRulesPath(): string {
	return join(getConfigDir(), "permissions.rules.json");
}

/**
 * 读入规则集。不存在 / 读不出 / 坏 JSON 一律按空规则集降级，不抛错；
 * 「存在却坏了」经 warn 回调留痕（daemon 日志）—— 降级不沉默：
 * 用户手改坏了文件时，日志里至少有一笔可查，否则他永远不知道规则没生效。
 */
export function loadPermissionRules(warn: (message: string) => void = () => undefined): readonly PermissionRule[] {
	const path = permissionRulesPath();
	let text: string;
	try {
		text = readFileSync(path, "utf8");
	} catch (error) {
		// ENOENT 是常态（从未写回过规则），静默当空集；其余读错要留痕。
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
		warn(`权限规则文件读取失败，本次按空规则集降级：${path}`);
		return [];
	}
	/*
	 * 自己先 JSON.parse 一遍只为「要不要 warn」：parseRulesFile 对坏 JSON
	 * 静默返回 []（它的契约是行级降级），而文件级损坏值得在日志里留一笔。
	 * 行级校验不在这里重复 —— parseRulesFile 是唯一的行校验权威，
	 * 两处各写一遍过滤条件迟早漂移。
	 */
	try {
		JSON.parse(text);
	} catch {
		warn(`权限规则文件不是合法 JSON，本次按空规则集降级：${path}`);
		return [];
	}
	return parseRulesFile(text);
}

/**
 * 追加一条规则（纯函数，不落盘）。
 *
 * 同 tool+prefix+action 已存在时返回**原数组引用** —— 调用方（daemon 的
 * 写回路径）据此引用比较判断「没变化，别重写文件」，幂等且不制造 IO。
 */
export function appendPermissionRule(
	rule: PermissionRule,
	rules: readonly PermissionRule[],
): readonly PermissionRule[] {
	const exists = rules.some(
		(r) => r.tool === rule.tool && r.prefix === rule.prefix && r.action === rule.action,
	);
	return exists ? rules : [...rules, rule];
}

/**
 * 写回规则文件（version 固定 1，2 空格缩进）。
 *
 * 配置目录可能还没建（全新用户第一次写回规则时），先 mkdir -p。
 * 调用频率是「用户点一次批准写一回」，同步写足够，不引入原子落盘机制。
 */
export function savePermissionRules(rules: readonly PermissionRule[]): void {
	mkdirSync(getConfigDir(), { recursive: true });
	writeFileSync(permissionRulesPath(), `${JSON.stringify({ version: 1, rules }, null, 2)}\n`, "utf8");
}
