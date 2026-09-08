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
import {
	isApprovalPolicy,
	isSandboxMode,
	presetIdFor,
	type PermissionSettings,
} from "../shared/permissions.ts";

export interface Preferences {
	/** 选中的模型，形如 `provider/model`。未选则 undefined。 */
	readonly activeModelKey: string | undefined;
	/** 联网搜索配置（服务商 + API Key）。未配置则 undefined。 */
	readonly webSearch?: WebSearchPrefs;
	/**
	 * 权限设置（沙箱模式 + 审批策略）。未设置则 undefined，
	 * 调用方用 DEFAULT_PERMISSIONS —— 不在这里填默认值，
	 * 免得「文件里没写」和「用户显式选了默认档」两件事看起来一样。
	 */
	readonly permissions?: PermissionSettings;
}

export interface WebSearchPrefs {
	readonly providerId: string;
	readonly apiKey: string;
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
		const record = parsed as {
			activeModelKey?: unknown;
			webSearch?: unknown;
			permissions?: unknown;
		};
		const key =
			typeof record.activeModelKey === "string" && record.activeModelKey !== ""
				? record.activeModelKey
				: undefined;
		const ws = record.webSearch;
		const webSearch =
			typeof ws === "object" && ws !== null
				? {
						providerId:
							typeof (ws as WebSearchPrefs).providerId === "string"
								? (ws as WebSearchPrefs).providerId
								: "",
						apiKey:
							typeof (ws as WebSearchPrefs).apiKey === "string"
								? (ws as WebSearchPrefs).apiKey
								: "",
					}
				: undefined;
		const permissions = readPermissions(record.permissions);
		return {
			activeModelKey: key,
			...(webSearch !== undefined && webSearch.providerId !== ""
				? { webSearch }
				: {}),
			...(permissions !== undefined ? { permissions } : {}),
		};
	} catch {
		return EMPTY;
	}
}

/**
 * 解析权限设置。任一旋钮非法 → 整块作废（调用方回落 DEFAULT_PERMISSIONS）。
 *
 * 「非法就回落到默认」在方向上是**放宽**权限（比如坏掉的 read-only 变成
 * workspace-write），一般来说安全设置该 fail-closed。这里之所以可以这样：
 *
 *   1. 这个文件由我们自己 JSON.stringify 写出，非法值只可能来自手工编辑；
 *   2. **模型改不了它** —— 权限门对 configDir 读写都拒（见 permission-policy.ts），
 *      所以这不是模型可利用的提权路径；
 *   3. 能写用户家目录的攻击者，本来就比 agent 权限更大，这条防线没有意义。
 *
 * 所以这里是**可用性取舍，不是安全边界** —— 写清楚免得后人误以为它是。
 * 反过来若哪天权限设置改为可被模型/远端写入，这个回落方向必须改成 fail-closed。
 */
function readPermissions(value: unknown): PermissionSettings | undefined {
	if (typeof value !== "object" || value === null) return undefined;
	const record = value as { sandbox?: unknown; approval?: unknown; presetId?: unknown };
	if (typeof record.sandbox !== "string" || !isSandboxMode(record.sandbox)) return undefined;
	if (typeof record.approval !== "string" || !isApprovalPolicy(record.approval)) return undefined;

	/*
	 * presetId 只是「用户当时选的哪一档」这个意图记录，**旋钮才是真相**
	 * （照 dsh 的 permission-presets 分工）。所以存的 id 与旋钮不一致时
	 * （手工编辑过），按旋钮重算 —— 界面显示的档位必须与实际执行一致，
	 * 否则就是在骗用户。
	 */
	const derived = presetIdFor(record.sandbox, record.approval);
	const presetId = typeof record.presetId === "string" && record.presetId === derived
		? record.presetId
		: derived;

	return { sandbox: record.sandbox, approval: record.approval, presetId };
}

export function writePreferences(preferences: Preferences): void {
	const path = getPath();
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(preferences, null, 2)}\n`, "utf8");
}
