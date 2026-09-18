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
import { SKILL_NAME_PATTERN, type SkillOverride, type SkillOverrides } from "./skill-status.ts";

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
	/**
	 * 回复风格（resources/styles/ 里的风格 id）。未设置则 undefined ——
	 * 调用方回 DEFAULT_STYLE_ID（professional，见 core/resources.ts）。
	 * **空串是合法值，语义 = 关闭风格注入** —— 与其它键「空串归一化为
	 * undefined」的口径不同：这里 undefined 与 "" 是三态中的两态
	 * （未配置=默认风格 / 空串=关闭 / 某 id=指定风格），不能合并。
	 */
	readonly styleId?: string;
	/**
	 * 记忆系统开关（spec: add-memory-system）：控制内置「记忆整理」蒸馏任务的
	 * 启停。未设置则 undefined，调用方按 true 处理 —— 与 permissions 的
	 * 「不在这里填默认值」同口径，缺省语义收在调用方一处（daemon 的
	 * getMemoryEnabled / 启动 ensure）。
	 */
	readonly memoryEnabled?: boolean;
	/**
	 * 团队协作开关（spec: add-team-foundations）：批 3 的团队工具四件套按它启停。
	 * 未设置 undefined，调用方按 false 处理 —— 缺省关闭，对齐 WorkBuddy 把
	 * Agent Teams 当实验特性默认禁用的立场。缺省语义收在调用方（daemon 装配）。
	 */
	readonly agentTeamsEnabled?: boolean;
	/**
	 * 每会话的子代理 spawn 预算（task 工具防失控循环）。未设置 undefined，
	 * 调用方回 SPAWN_BUDGET_PER_SESSION（20，原编译期常量现值）。
	 * 非正整数读取层归一 undefined（手改文件的容错，同 thinkingLevel 口径）。
	 */
	readonly spawnBudget?: number;
	/**
	 * 单个子代理的执行超时毫秒。未设置 undefined，调用方回 SUBAGENT_TIMEOUT_MS
	 * 缺省（600000，10 分钟）。非正整数归一 undefined，同上。
	 */
	readonly subagentTimeoutMs?: number;
	/**
	 * 个性化六字段（spec: rework-settings-layout）。
	 * 字符串四键空串归一化为 undefined（与 styleId 三态特例不同：这些键没有
	 * 「显式关闭」语义，空就是没设）；两个 boolean 缺省 true 的语义收在调用方
	 * 一处（daemon 的 getPersonalization `?? true` 合并），这里不填默认值。
	 */
	/** 自定义指令（compose 注入为独立「用户规则」段，≤1500 字）。 */
	readonly customInstructions?: string;
	/** 对用户的称呼（compose 注入一行）。 */
	readonly userNickname?: string;
	/** AI 的名字（缺省 = 骨架品牌名，不注入）。 */
	readonly assistantName?: string;
	/** 人设/人格描述（WB SOUL 的轻量字段版，不建文件体系）。 */
	readonly personaDescription?: string;
	/** 加载欢迎语：会话载入/首轮等待慢时显示一句问候。缺省 true。 */
	readonly welcomeGreeting?: boolean;
	/** 展示文件变更过程详情：write/edit 卡「生成中」实时计数显隐。缺省 true。 */
	readonly showChangeDetails?: boolean;
	/**
	 * 技能启停的用户级覆盖（spec: add-skill-management）。
	 *
	 * 键名与语义对齐 WorkBuddy 的 `skillOverrides`，当前只实现两态：**缺省启用**，
	 * `"off"` = 用户在技能页关掉了它（从 `/` 菜单、模型技能清单段、use_skill 加载集合
	 * 一起消失）。将来加 `name-only` 等态是加联合成员，键名与文件形状不变，零迁移
	 * —— 详见 core/skill-status.ts 的 SkillOverride 注释。
	 *
	 * 语义边界：这是**用户级覆盖**，不改技能自身的 SKILL.md；与 frontmatter 的
	 * `user-invocable` / `disable-model-invocation` 各自生效，互不覆盖。
	 */
	readonly skillOverrides?: SkillOverrides;
	/**
	 * 托管运行时的开关（spec: add-managed-runtimes）。
	 *
	 * 缺省语义收在调用方一处（core/runtime-inventory.ts 的 readRuntimeSwitch：
	 * 总开关与逐项都按**开启**处理 —— 开关只管「是否注入 / 是否可用」，与
	 * 「装没装」无关：阶段 7 起三个运行时纯按需，不会自动下载，装不装由用户在
	 * 设置页显式点）。这里只存用户的**显式决定**：关闭写 false、
	 * 打开写 true，于是「已禁用」与「从没设置过」在文件里可区分，
	 * 将来改缺省值不会悄悄推翻用户的选择。
	 */
	readonly runtimes?: RuntimePrefs;
}

export interface RuntimePrefs {
	/** 总开关（「内置运行时」那一级）。缺省 true。 */
	readonly enabled?: boolean;
	/** 逐运行时开关（运行时 id → 是否启用）。`false` = 用户显式禁用；缺键 = 未设置（按启用）。 */
	readonly items?: Readonly<Record<string, boolean>>;
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
			styleId?: unknown;
			memoryEnabled?: unknown;
			agentTeamsEnabled?: unknown;
			spawnBudget?: unknown;
			subagentTimeoutMs?: unknown;
			runtimes?: unknown;
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
		/*
		 * styleId 保留空串（"" = 用户显式关闭风格），不做非空归一化 ——
		 * 三态语义见 Preferences.styleId 的注释。合法性（是否已知风格 id）
		 * 由 daemon 的写入入口校验，读取层原样透传（同 defaultWorkspacePath
		 * 的「读取不验、判定集中一处」口径）。
		 */
		const styleId = typeof record.styleId === "string" ? record.styleId : undefined;
		// 非法值（手改文件）按「未配置」处理，同 thinkingLevel 的口径。
		const memoryEnabled =
			typeof record.memoryEnabled === "boolean" ? record.memoryEnabled : undefined;
		const agentTeamsEnabled =
			typeof record.agentTeamsEnabled === "boolean" ? record.agentTeamsEnabled : undefined;
		/*
		 * 个性化六字段：字符串空串归一化为 undefined（无三态语义，空=未设），
		 * 非法类型按未配置；boolean 只验类型，缺省 true 语义在 daemon 合并。
		 */
		const rec = record as Record<string, unknown>;
		const optString = (k: string): string | undefined => {
			const v = rec[k];
			return typeof v === "string" && v !== "" ? v : undefined;
		};
		const optBoolean = (k: string): boolean | undefined => {
			const v = rec[k];
			return typeof v === "boolean" ? v : undefined;
		};
		const customInstructions = optString("customInstructions");
		const userNickname = optString("userNickname");
		const assistantName = optString("assistantName");
		const personaDescription = optString("personaDescription");
		const welcomeGreeting = optBoolean("welcomeGreeting");
		const showChangeDetails = optBoolean("showChangeDetails");
		// 防线参数（spec: add-team-foundations）：必须为正整数，否则按未配置处理
		//（缺省语义收在调用方：spawn 预算 20 / 超时 600000ms）。
		const optPositiveInt = (k: string): number | undefined => {
			const v = rec[k];
			return typeof v === "number" && Number.isInteger(v) && v > 0 ? v : undefined;
		};
		const spawnBudget = optPositiveInt("spawnBudget");
		const subagentTimeoutMs = optPositiveInt("subagentTimeoutMs");
		// 技能启停：逐条形状校验（坏键 / 坏值忽略并记日志），见 readSkillOverrides。
		const skillOverrides = readSkillOverrides(rec["skillOverrides"]);
		// 托管运行时开关：形状校验同 skillOverrides（手改的坏键只忽略那一条）。
		const runtimes = readRuntimePrefs(rec["runtimes"]);
		return {
			activeModelKey: key,
			...(webSearch !== undefined && webSearch.providerId !== ""
				? { webSearch }
				: {}),
			...(permissions !== undefined ? { permissions } : {}),
			...(defaultWorkspacePath !== undefined ? { defaultWorkspacePath } : {}),
			...(thinkingLevel !== undefined ? { thinkingLevel } : {}),
			...(styleId !== undefined ? { styleId } : {}),
			...(memoryEnabled !== undefined ? { memoryEnabled } : {}),
			...(agentTeamsEnabled !== undefined ? { agentTeamsEnabled } : {}),
			...(spawnBudget !== undefined ? { spawnBudget } : {}),
			...(subagentTimeoutMs !== undefined ? { subagentTimeoutMs } : {}),
			...(customInstructions !== undefined ? { customInstructions } : {}),
			...(userNickname !== undefined ? { userNickname } : {}),
			...(assistantName !== undefined ? { assistantName } : {}),
			...(personaDescription !== undefined ? { personaDescription } : {}),
			...(welcomeGreeting !== undefined ? { welcomeGreeting } : {}),
			...(showChangeDetails !== undefined ? { showChangeDetails } : {}),
			...(skillOverrides !== undefined ? { skillOverrides } : {}),
			...(runtimes !== undefined ? { runtimes } : {}),
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

/**
 * 解析技能启停覆盖。
 *
 * 容错口径同 spawnBudget（手改文件的容错）：坏数据不抛错 —— 偏好读取挂在应用启动
 * 与每轮 compose 的路径上，不值得为一个可再生字段打挂它们。但**响亮记日志**：
 * 静默丢掉一个用户显式关掉的技能，表现为「关了又自己开了」，故障被藏进「看不见」，
 * 比一行日志糟得多（同 daemon 里 readSkillMeta 对坏 frontmatter 的取舍）。
 *
 * 逐条过滤而不是整块作废：用户手改时通常只错一处，一条坏键不该连累其它键。
 * 全部条目都非法（或本来就是空对象）→ 归一 undefined，让「缺省 = 全启用」
 * 只有一种表示（写入侧同样在无键时删掉整个键）。
 */
function readSkillOverrides(value: unknown): SkillOverrides | undefined {
	if (value === undefined) return undefined;
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		console.error(`偏好文件的 skillOverrides 应为对象（技能名 → "on" | "off"），已整块忽略：`, value);
		return undefined;
	}

	const out: Record<string, SkillOverride> = {};
	for (const [name, state] of Object.entries(value as Record<string, unknown>)) {
		// 键是技能名：键名非法说明文件被手改过，按「忽略该条」处理（不纠正成别的名字）。
		if (!SKILL_NAME_PATTERN.test(name)) {
			console.error(`skillOverrides 的键「${name}」不是合法技能名（小写字母/数字/连字符），已忽略该条`);
			continue;
		}
		if (state !== "on" && state !== "off") {
			console.error(`skillOverrides["${name}"] 的值应为 "on" 或 "off"，实际是 ${JSON.stringify(state)}，已忽略该条`);
			continue;
		}
		out[name] = state;
	}
	return Object.keys(out).length === 0 ? undefined : out;
}

/**
 * 解析托管运行时开关。
 *
 * 容错口径同 skillOverrides（手改文件的可再生字段不值得打挂启动路径）：
 * 坏形状整块忽略并记一行日志，items 里坏值逐条忽略；一条都不剩 → 归一 undefined，
 * 让「没设置过」只有一种表示（写入侧同样在无内容时不写这个键）。
 */
function readRuntimePrefs(value: unknown): RuntimePrefs | undefined {
	if (value === undefined) return undefined;
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		console.error("偏好文件的 runtimes 应为对象（{ enabled, items }），已整块忽略：", value);
		return undefined;
	}
	const record = value as { enabled?: unknown; items?: unknown };
	const enabled = typeof record.enabled === "boolean" ? record.enabled : undefined;
	let items: Record<string, boolean> | undefined;
	if (record.items !== undefined) {
		if (typeof record.items !== "object" || record.items === null || Array.isArray(record.items)) {
			console.error("偏好文件的 runtimes.items 应为对象（运行时 id → 布尔），已忽略：", record.items);
		} else {
			const kept: Record<string, boolean> = {};
			for (const [id, state] of Object.entries(record.items as Record<string, unknown>)) {
				if (typeof state !== "boolean") {
					console.error(`runtimes.items["${id}"] 应为布尔值，实际是 ${JSON.stringify(state)}，已忽略该条`);
					continue;
				}
				kept[id] = state;
			}
			items = Object.keys(kept).length === 0 ? undefined : kept;
		}
	}
	if (enabled === undefined && items === undefined) return undefined;
	return {
		...(enabled === undefined ? {} : { enabled }),
		...(items === undefined ? {} : { items }),
	};
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
