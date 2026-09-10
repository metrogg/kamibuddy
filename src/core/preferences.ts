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
import { dirname, isAbsolute, join } from "node:path";
import { getConfigDir, getWorkspaceDir } from "./config-paths.ts";
import {
	isApprovalPolicy,
	isSandboxMode,
	presetIdFor,
	type PermissionSettings,
} from "../shared/permissions.ts";
import { isThinkingLevel, type ThinkingLevel } from "../shared/session-events.ts";

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
	/**
	 * 默认存储路径（工作空间根）。未设置则 undefined，走内置默认 ~/KamiBuddy。
	 * 生效根的分层合成见 getEffectiveWorkspaceRoot()；
	 * 修改只影响之后新建的任务与工作空间，已有会话 cwd 不变
	 * （对齐 WorkBuddy「修改后不影响已有数据」语义）。
	 */
	readonly defaultWorkspacePath?: string;
	/**
	 * 全局默认推理强度（之后新建会话的初始档位，含定时任务 run 与子代理会话）。
	 * 未设置则 undefined —— 调用方回 medium 兜底（pi 的内置默认即 medium，
	 * 两处不漂移）。既有会话以各自会话内选择为准，不被本键回溯修改。
	 */
	readonly thinkingLevel?: ThinkingLevel;
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
			defaultWorkspacePath?: unknown;
			thinkingLevel?: unknown;
		};
		const key =
			typeof record.activeModelKey === "string" && record.activeModelKey !== ""
				? record.activeModelKey
				: undefined;
		/*
		 * 这里只验「是非空字符串」，不验路径合法性（绝对性、存在性）：
		 * 读取层保持原样透传，合法性判定集中在 getEffectiveWorkspaceRoot() 一处，
		 * 免得两处校验规则漂移。
		 */
		const defaultWorkspacePath =
			typeof record.defaultWorkspacePath === "string" && record.defaultWorkspacePath !== ""
				? record.defaultWorkspacePath
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
		/*
		 * 非法值按「未配置」处理，与 webSearch 的防御口径一致：
		 * 偏好文件可能被手工编辑，坏掉的可再生字段不值得阻塞启动。
		 * 回落方向是 pi 内置默认（medium），既不是放宽也不是收紧，无安全取向。
		 */
		const thinkingLevel = isThinkingLevel(record.thinkingLevel)
			? record.thinkingLevel
			: undefined;
		return {
			activeModelKey: key,
			...(webSearch !== undefined && webSearch.providerId !== ""
				? { webSearch }
				: {}),
			...(permissions !== undefined ? { permissions } : {}),
			...(defaultWorkspacePath !== undefined ? { defaultWorkspacePath } : {}),
			...(thinkingLevel !== undefined ? { thinkingLevel } : {}),
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

/**
 * 生效工作空间根 = env KAMIBUDDY_WORKSPACE_DIR > 设置项 defaultWorkspacePath > 内置默认。
 *
 * 对齐 WorkBuddy 的 resolveDefaultWorkspaceRoot()（main/server.js：
 * 「所有生成临时任务 / 工作空间子目录的点都应使用 resolveDefaultWorkspaceRoot()……
 * 兜底策略：~/{getWorkbuddyAppName()}」）——设置项优先、兜底家目录下可见目录。
 * 我们在设置项之上多一层 env（测试与多环境并存用，与 getConfigDir 的 env 同风格）。
 *
 * 为什么这个函数在本文件而不在 config-paths.ts：
 * 分层合成需要同时摸得到 env、设置项、内置默认三处。config-paths 被本文件
 * import（getConfigDir），若 config-paths 再反向 import 本文件即成循环依赖；
 * 放在依赖下游（本文件）一侧，getWorkspaceDir 从 config-paths 正向引入。
 *
 * 设置项非法（trim 后为空、非绝对路径）时**忽略并回退**下一层。
 * WorkBuddy 对坏配置的策略是「清掉再回退系统默认」；我们只忽略、不主动改
 * 用户的文件 —— 静默回退 vs 主动清除，选更少惊喜的那个：用户手工编辑出错时
 * 文件里的值还在，改对即生效，不会被悄悄抹掉。
 */
export function getEffectiveWorkspaceRoot(): string {
	const env = process.env["KAMIBUDDY_WORKSPACE_DIR"];
	if (env !== undefined && env !== "") return env;
	const custom = readPreferences().defaultWorkspacePath;
	if (custom !== undefined && custom.trim() !== "" && isAbsolute(custom)) return custom;
	// env 已在上面确认缺省，此处 getWorkspaceDir() 等价于取内置默认 ——
	// 复用同一出处，免得 ~/KamiBuddy 这个字面量在两处各写一遍。
	return getWorkspaceDir();
}
