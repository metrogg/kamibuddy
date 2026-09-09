/**
 * 空间显示名注册表（~/.kamibuddy/workspaces.json）。
 *
 * 侧栏「空间」区按 cwd 分组显示会话；「重命名」只改显示名、不动真实目录
 * （WorkBuddy 同款：「仅修改显示名称，不会改变实际文件夹路径」）。
 * 所以显示名是一张**视图层覆盖表**：path → displayName，放配置目录下
 * 自己的文件 —— 不写进目录名（重命名不该移动用户文件），也不写进
 * 会话文件（分组键是 cwd，写进去会让「按 cwd 分组」与「按显示名分组」漂移）。
 *
 * 不 import pi 与 electron，纯 fs + JSON，可单测（AGENTS.md §1）。
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getConfigDir } from "./config-paths.ts";

function getPath(): string {
	return join(getConfigDir(), "workspaces.json");
}

/**
 * 读取显示名覆盖表。文件不存在或坏 JSON 一律按空表处理：
 * 显示名丢了只是回退到目录名显示，不是数据灾难，不该让整个空间功能崩掉 ——
 * 与 api-keys 的「坏文件拒绝一切」刻意不同（那是凭据，这不是）。
 */
export function readDisplayNames(): Record<string, string> {
	let raw: string;
	try {
		raw = readFileSync(getPath(), "utf8");
	} catch {
		return {};
	}
	try {
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
		// 逐条过滤而非整体拒绝：一次手滑编辑不该拖垮其他空间的显示名。
		const record = parsed as Record<string, unknown>;
		const result: Record<string, string> = {};
		for (const [key, value] of Object.entries(record)) {
			if (typeof value === "string" && value !== "") result[key] = value;
		}
		return result;
	} catch {
		return {};
	}
}

function writeDisplayNames(names: Record<string, string>): void {
	const path = getPath();
	mkdirSync(dirname(path), { recursive: true });
	// 0600 不需要：这不是凭据，被读了也没有安全问题。
	writeFileSync(path, `${JSON.stringify(names, null, 2)}\n`, "utf8");
}

/**
 * 设置某空间的显示名（读改写后写回）。
 * 合法性不在这里校验 —— 由调用方（daemon）先过 validateDisplayName，
 * 这层只管持久化，与 preferences.ts 的分工一致。
 */
export function setDisplayName(path: string, name: string): void {
	const names = readDisplayNames();
	names[path] = name;
	writeDisplayNames(names);
}

/** 移除某空间的显示名（读改写）。键不存在同样正常返回 —— 删除应该是幂等的。 */
export function removeDisplayName(path: string): void {
	const names = readDisplayNames();
	if (!(path in names)) return;
	delete names[path];
	writeDisplayNames(names);
}

/** Windows 目录名非法字符。显示名语义等同目录名，规则保持一致。 */
const ILLEGAL_NAME_CHARS = /[\\/:*?"<>|]/;

/** Windows 保留设备名（小写）。 */
const RESERVED_NAMES: ReadonlySet<string> = new Set([
	"con", "prn", "aux", "nul",
	"com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9",
	"lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
]);

/**
 * 校验显示名。返回 undefined 表示合法，否则返回给用户看的原因
 * （与 validateWorkspacePath 同风格：原因由调用方变成 IPC 错误消息）。
 *
 * 为什么一个「只是给人看」的名字要按 Windows 目录名规则校验：
 * 显示名在界面上顶替目录名出现，用户会拿它当文件夹名字理解 ——
 * 两个空间显示成同一个名字就是「看起来是同一个目录」的混淆。
 * 重名与保留名比较都大小写不敏感，因为 Windows 目录名就是如此
 * （WorkBuddy 对空间名有同款同名校验）。
 */
export function validateDisplayName(name: string, siblings: readonly string[]): string | undefined {
	const trimmed = name.trim();
	if (trimmed === "") return "名称不能为空";
	if (ILLEGAL_NAME_CHARS.test(trimmed)) {
		return "名称不能包含以下字符：\\ / : * ? \" < > |";
	}
	if (trimmed.length > 255) return "名称过长（最多 255 字符）";
	const lowered = trimmed.toLowerCase();
	if (siblings.some((s) => s.toLowerCase() === lowered)) {
		return `已存在同名空间「${trimmed}」`;
	}
	if (RESERVED_NAMES.has(lowered)) return `「${trimmed}」是系统保留名称，不能使用`;
	return undefined;
}
