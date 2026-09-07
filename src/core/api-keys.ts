/**
 * auth.json 的读写：API Key 的持久化。
 *
 * 为什么自己写文件（此前注释声称「从不自己读写这个文件」，那条已作废）：
 * 实测发现 `ModelRuntime.setRuntimeApiKey()` 走的是 RuntimeCredentials，
 * pi 源码自述 "overlay for **non-persistent** runtime API keys" —— 只写进程内 Map，
 * daemon 一重启 key 就丢（用户实测踩到：设置页填的 key 重开后消失）。
 * 而真正落盘的 AuthStorage 类**没有从包根导出**（只导出了只读的 readStoredCredential）。
 *
 * 所以：按 pi 的文件格式自己维护，格式契约（auth-storage.ts:17-25）：
 *   AuthStorageData = Record<string, Credential>   —— 扁平，无包装字段
 *   序列化 JSON.stringify(data, null, 2)，文件权限 0600
 *
 * 两条硬规则与 custom-providers.ts 一致：
 *   1. 坏文件抛错不静默重置（里面可能有用户 / pi CLI 写的 oauth 凭据，丢了就没了）
 *   2. 读改写保留我们不认识的条目（如将来的 oauth 登录态）
 *
 * 并发说明：pi 用 lockfile 防多进程并发写；我们只有一个 daemon 进程在写，
 * 不引入锁依赖。若将来出现多写者（如内置 pi CLI），再补锁。
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** pi 的 Credential 中我们写入的那一种。其余形状（oauth 等）只保留不解析。 */
interface ApiKeyCredential {
	type: "api_key";
	key: string;
}

function readAuthFile(path: string): Record<string, unknown> {
	let raw: string;
	try {
		raw = readFileSync(path, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
		throw error;
	}
	if (raw.trim() === "") return {};

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw.replace(/^﻿/, ""));
	} catch (error) {
		throw new Error(
			`${path} 不是合法 JSON，已停止操作以免覆盖你的凭据。` +
				`请修好或删除该文件后重试。原始错误：${error instanceof Error ? error.message : String(error)}`,
		);
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		throw new Error(`${path} 的顶层应为对象，实际是 ${parsed === null ? "null" : typeof parsed}`);
	}
	return parsed as Record<string, unknown>;
}

/**
 * 写入一个 API Key（读改写，保留其他条目）。
 *
 * 写完调用方应紧接着调 `runtime.setRuntimeApiKey()` 同步本进程，
 * 否则 `getProviderAuthStatus()` 在本次运行里看不到新 key（快照不刷新）。
 */
export function writeApiKey(path: string, providerId: string, apiKey: string): void {
	const data = readAuthFile(path);
	const credential: ApiKeyCredential = { type: "api_key", key: apiKey };
	const next = { ...data, [providerId]: credential };
	save(path, next);
}

/** 删除一个 provider 的凭据。不存在则幂等返回。 */
export function removeApiKey(path: string, providerId: string): void {
	const data = readAuthFile(path);
	if (!(providerId in data)) return;
	const next = { ...data };
	delete next[providerId];
	save(path, next);
}

function save(path: string, data: Record<string, unknown>): void {
	mkdirSync(dirname(path), { recursive: true });
	// 缩进 2 空格与 pi 一致（用户可能手工查看/编辑该文件）；0600 是 pi 的约定。
	writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf-8", mode: 0o600 });
}
