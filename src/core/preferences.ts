/**
 * 用户偏好的持久化（当前只有「选中的模型」）。
 *
 * 为什么单独一个文件而不塞进 models.json：
 * models.json 是 pi 的格式、由 pi 解析，往里加我们的私有键虽然不会报错
 * （schema 不是 additionalProperties:false），但会让两套语义混在一个文件里，
 * 用户手工编辑时容易误删。偏好是我们自己的东西，放自己的文件。
 *
 * 不 import pi，纯 fs + JSON，可单测。
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getConfigDir } from "./config-paths.ts";

export interface Preferences {
	/** 选中的模型，形如 `provider/model`。未选则 undefined。 */
	readonly activeModelKey: string | undefined;
}

const EMPTY: Preferences = { activeModelKey: undefined };

function getPath(): string {
	return join(getConfigDir(), "preferences.json");
}

/**
 * 读取偏好。
 *
 * 与 models.json 不同，这里**坏了就当空**而不抛错：
 * 偏好是可再生的（用户重选一次即可），不值得因此阻塞应用启动。
 * models.json 那边抛错是因为里面有用户手写的、丢了就没了的配置。
 */
export function readPreferences(): Preferences {
	let raw: string;
	try {
		raw = readFileSync(getPath(), "utf8");
	} catch {
		return EMPTY;
	}

	try {
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed !== "object" || parsed === null) return EMPTY;
		const key = (parsed as { activeModelKey?: unknown }).activeModelKey;
		return { activeModelKey: typeof key === "string" && key !== "" ? key : undefined };
	} catch {
		return EMPTY;
	}
}

export function writePreferences(preferences: Preferences): void {
	const path = getPath();
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(preferences, null, 2)}\n`, "utf8");
}
