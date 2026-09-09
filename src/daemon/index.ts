/**
 * Daemon：跑在 Electron utilityProcess 里的业务进程。
 *
 * 本文件只做两件事：帧循环（收 DaemonRequest → 派发 → 回 DaemonResponse）
 * 和进程级诊断。会话编排在 core/ 里，pi 的类型止步于那一层（AGENTS.md §1.2）。
 *
 * 为什么不 import electron：daemon 跑在 utilityProcess 里，用不到多数 Electron API，
 * 而与父进程通信只需要 process.parentPort 这个全局。保持零 electron 依赖后，
 * 这一层可以脱离 Electron 单独跑（比如将来做 CLI 形态或集成测试）。
 */

import { randomUUID } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { loadSkills, SessionManager, type SessionInfo } from "@earendil-works/pi-coding-agent";
import { AutomationStore } from "../core/automation-store.ts";
import {
	getConfigDir,
	getResourcesDir,
	getSessionsDir,
	getTempTasksDir,
	getWorkspaceDir,
} from "../core/config-paths.ts";
import { EventLog } from "../core/event-log.ts";
import { ModelCatalog } from "../core/model-catalog.ts";
import { estimateTokens, ObservabilityStore } from "../core/observability.ts";
import {
	getEffectiveWorkspaceRoot,
	readPreferences,
	writePreferences,
} from "../core/preferences.ts";
import { PreviewServer } from "../core/preview-server.ts";
import {
	composePrompt,
	formatSkillsSection,
	type PromptContextOptions,
	type SkillDescriptor,
} from "../core/prompt-composer.ts";
import { loadResources, toDescriptors } from "../core/resources.ts";
import { importSkill, userSkillsDir } from "../core/skill-install.ts";
import { buildExportPath } from "../core/session-export.ts";
import { restoredToolLabel, SessionHost } from "../core/session-host.ts";
import { buildConversationEntries, validateSessionFilePath } from "../core/session-rebuild.ts";
import { createWorkspace, listWorkspaces, validateWorkspacePath } from "../core/workspace.ts";
import {
	readDisplayNames,
	removeDisplayName,
	setDisplayName,
	validateDisplayName,
} from "../core/workspace-registry.ts";
import { indexFiles } from "../core/file-index.ts";
import { listPromptTemplates } from "../core/prompt-templates.ts";
import { automationExtensionFactory } from "../extensions/automation-tools.ts";
import { createPermissionGate } from "../extensions/permission-gate.ts";
import { defaultProtectedDirs, isPathInside } from "../extensions/permission-policy.ts";
import { createProjectTrust } from "../extensions/project-trust.ts";
import {
	DEFAULT_PERMISSIONS,
	isApprovalPolicy,
	isSandboxMode,
	presetIdFor,
	type PermissionInfo,
	type PermissionSettings,
} from "../shared/permissions.ts";
import { createDocReadTool } from "../extensions/doc-read-tool.ts";
import { createPresentFiles } from "../extensions/present-files.ts";
import { createPromptSwitch } from "../extensions/prompt-switch.ts";
import { createWebTools } from "../extensions/web-tools.ts";
import type { WebSearchConfig } from "../core/web-search.ts";
import { parseBuiltinCommand } from "../shared/builtin-commands.ts";
import {
	artifactsFromEntries,
	conversationReducer,
	type ConversationView,
} from "../shared/conversation.ts";
import type {
	DaemonOutbound,
	DaemonRequest,
} from "../shared/daemon-protocol.ts";
import { isDaemonRequest } from "../shared/daemon-protocol.ts";
import {
	INVOKE,
	PUSH,
	type AutomationSaveInput,
	type PermissionRequest,
	type PermissionResponse,
	type ArtifactContent,
	type PromptRequest,
	type SessionSummary,
	type WorkspaceGroupMeta,
} from "../shared/ipc.ts";
import { nextRunAfter, validateSchedule } from "../shared/automation.ts";
import type { AutomationTask } from "../shared/automation.ts";
import {
	isWebSearchProviderId,
	type WebSearchConfigInfo,
	type WebSearchConfigInput,
	type WebSearchTestResult,
} from "../shared/settings.ts";
import { searchWeb } from "../core/web-search.ts";
import type {
	ModeDescriptor,
	SessionEvent,
	SessionState,
} from "../shared/session-events.ts";
import type { CustomProviderInput, SkillInfo } from "../shared/settings.ts";
import { deriveContextUsageDetail } from "./context-usage-detail.ts";
import { createAutomationRunExecutor } from "./automation-runner.ts";
import { AutomationScheduler } from "./automation-scheduler.ts";

/* ── 与父进程的通道 ───────────────────────────────────────────────── */

/**
 * process.parentPort 是 Electron 注入的全局，类型来自 electron 包。
 * 这里手写最小结构以避免 import electron（见文件头注释）。
 */
interface ParentPort {
	on(event: "message", listener: (message: { data: unknown }) => void): void;
	postMessage(message: unknown): void;
}

/**
 * 取父进程端口。写成函数而不是「const + if 抛错」，是因为后者的类型窄化
 * 不会穿透到 post() 这类函数声明里（函数声明会提升，TS 保守处理）。
 * 这里直接返回非可选类型，调用方无需再窄化。
 */
function requireParentPort(): ParentPort {
	const port = (process as unknown as { parentPort?: ParentPort }).parentPort;
	if (port === undefined) {
		// 直接用 node 跑本文件会走到这里。不静默降级——这属于用错了入口。
		throw new Error(
			"daemon 必须在 Electron utilityProcess 中启动（process.parentPort 不存在）",
		);
	}
	return port;
}

const parentPort = requireParentPort();

function post(frame: DaemonOutbound): void {
	parentPort.postMessage(frame);
}

/* ── 会话状态 ─────────────────────────────────────────────────────── */

/**
 * 两轴资源：场景骨架 + 交互模式，全部来自 resources/（AGENTS.md §3 能力即数据）。
 *
 * **顶层加载、失败即崩**：这是 daemon 里唯一一个「起不来比起来好」的失败——
 * 资源缺失意味着提示词退回 pi 的「coding assistant」默认值，产品身份整个错了，
 * 静默运行比崩溃难排查得多。
 *
 * 加场景 / 加模式 = 在 resources/ 下加目录或文件，零行代码改动。
 */
const RESOURCES = loadResources(getResourcesDir());

const SCENES: readonly ModeDescriptor[] = toDescriptors(RESOURCES).scenes;
const INTERACTIONS: readonly ModeDescriptor[] = toDescriptors(RESOURCES).modes;

/* ── 模型目录 ─────────────────────────────────────────────────────── */

/**
 * 懒加载的模型目录。
 *
 * 不在 start() 里初始化：ModelCatalog 会读 models.json，
 * 用户手写坏了就该在打开设置页时报错，而不是让整个 daemon 起不来
 * （界面卡在「正在启动」是最难排查的失败方式）。
 *
 * **只缓存成功的结果**：失败的 promise 不缓存，用户修好文件后重试才有效。
 */
let catalogPromise: Promise<ModelCatalog> | undefined;

function getCatalog(): Promise<ModelCatalog> {
	if (catalogPromise === undefined) {
		const attempt = ModelCatalog.create();
		catalogPromise = attempt;
		attempt.catch(() => {
			if (catalogPromise === attempt) catalogPromise = undefined;
		});
	}
	return catalogPromise;
}

/**
 * 当前选中的模型，形如 `provider/model`。
 * 启动时从偏好文件恢复。
 */
let activeModelKey: string | undefined = readPreferences().activeModelKey;

/**
 * 当前权限设置（沙箱模式 + 审批策略）。启动时从偏好恢复，缺省 = 引入模式前的行为。
 *
 * 与 activeModelKey 同样用模块级变量而非每次读盘：权限门在**每次工具调用**时都要读它，
 * 读盘会把 IO 放进热路径。改动经 setPermissions 通道走，写盘与内存同步更新。
 */
let activePermissions: PermissionSettings = readPreferences().permissions ?? DEFAULT_PERMISSIONS;

/**
 * 受保护的凭据目录，进程启动时算一次。
 *
 * 家目录在进程生命周期内不会变，没必要每次判定都调 homedir()。
 * 这批目录**读写都拒且任何权限模式都不能越过**（见 permission-policy.ts 阶段 1）。
 */
const PROTECTED_DIRS = defaultProtectedDirs(homedir());

/** 内置技能目录（resources/skills/，随应用分发）。 */
const BUILTIN_SKILLS_DIR = join(getResourcesDir(), "skills");

/**
 * 技能清单。技能页展示与提示词组装共用这一个来源，且**每次现读** ——
 * 导入新技能后下一轮对话即生效，无需重启应用。
 *
 * 独立于 SessionHost 的加载（宿主懒建，技能页要在第一次发消息前就能看）。
 * 加载失败不抛：页面不能因为一个坏 SKILL.md 打不开，记日志、列表为空。
 */
function listSkills(): SkillInfo[] {
	try {
		const { skills } = loadSkills({
			cwd: getWorkspaceDir(),
			agentDir: getConfigDir(),
			skillPaths: [BUILTIN_SKILLS_DIR],
			includeDefaults: true,
		});
		return skills.map((s) => ({
			name: s.name,
			description: s.description,
			filePath: s.filePath,
			origin: s.filePath.startsWith(BUILTIN_SKILLS_DIR) ? "builtin" : "user",
			disableModelInvocation: s.disableModelInvocation,
		}));
	} catch (error) {
		console.error("技能加载失败（设置页列表为空）：", error);
		return [];
	}
}

/**
 * 联网搜索配置。用户会话与定时任务 run 会话共用这一份读取逻辑。
 * 偏好文件可能被手工编辑出非法值：按「未配置」处理，工具会引导用户去设置页 ——
 * 不静默用错服务商打 API。
 */
function getWebSearchConfig(): WebSearchConfig | undefined {
	const webSearch = readPreferences().webSearch;
	if (webSearch === undefined || !isWebSearchProviderId(webSearch.providerId)) {
		return undefined;
	}
	return { providerId: webSearch.providerId, apiKey: webSearch.apiKey };
}

/**
 * 组装指定 cwd 与两轴下的系统提示词。用户会话与定时任务 run 会话共用 ——
 * 提示词是产品身份，两条会话形态必须同一份组装逻辑，不能各写一遍漂移。
 * token 估算随返回值带出，由调用方决定记不记（用户会话要喂上下文成分统计，
 * run 会话没有诊断视图、直接丢弃）。
 */
async function composeSystemPrompt(
	cwd: string,
	sceneId: string,
	interactionId: string,
	piContext: PromptContextOptions,
): Promise<{ prompt: string; systemTokens: number; skillsTokens: number }> {
	const scene = RESOURCES.scenes.find((s) => s.id === sceneId);
	const mode = RESOURCES.modes.find((m) => m.id === interactionId);
	if (scene === undefined || mode === undefined) {
		throw new Error(`场景或交互模式不存在：${sceneId} / ${interactionId}`);
	}
	// 每轮现读技能清单：导入新技能后下一轮对话即生效，无需重启。
	const skills: SkillDescriptor[] = listSkills().map((s) => ({
		name: s.name,
		description: s.description,
		filePath: s.filePath,
	}));
	// 与 pi 的 buildSystemPrompt 对齐：模式白名单里没有能读技能文件
	// 的工具（read / bash）时，不注入技能段 —— 否则会让模型去调用
	// 一个并不存在的 read 工具（plan 模式就是这个坑）。
	const hasSkillReader = mode.tools.some((t) => t === "read" || t === "bash");
	const skillsSection = hasSkillReader ? formatSkillsSection(skills) : "";
	const prompt = composePrompt({
		sceneBody: scene.body,
		modeBody: mode.body,
		skillsSection,
		cwd,
		piContext,
	});
	return {
		prompt,
		systemTokens: estimateTokens(prompt),
		skillsTokens: estimateTokens(skillsSection),
	};
}

/* ── 会话 ─────────────────────────────────────────────────────────── */

/**
 * 当前工作空间（会话 cwd）。临时任务模型下**必有值**：
 * 新建任务默认 = 临时任务，cwd 是生效根下的共享临时目录（`<根>/临时任务`），
 * 工具集、权限门、预览服务与正式工作空间完全同待遇。
 *
 * 会话与 cwd 终身绑定（cwd 在建会话时一次性注入 pi 的工具集），
 * 所以换空间 = 作废当前会话重开，见 applyWorkspace。
 */
let workspaceDir: string = tempTasksDir();

/**
 * 临时任务的共享目录。**现算不缓存**：生效根 = env > 设置项 > 内置默认
 * （getEffectiveWorkspaceRoot 每次现读偏好文件），用户改默认存储路径后，
 * 下一次新建/切换临时任务即刻用新根。
 */
function tempTasksDir(): string {
	return getTempTasksDir(getEffectiveWorkspaceRoot());
}

/**
 * 「该 cwd 归任务区（临时任务）」的判定。三种 true：
 *
 *   1. 临时任务共享目录（<生效根>/临时任务）—— 新模型的默认任务形态；
 *   2. 生效根本身 —— 根目录是「任务区」不是空间组（WorkBuddy 同：根不成组）；
 *   3. 配置目录下的 playground 旧占位目录 —— playground 时代存量会话的技术 cwd，
 *      归类到任务区（resume 时会把 cwd 迁移到临时目录，见 resumeSession）。
 *
 * 用**当前**生效根判定（WorkBuddy isClawRuntimeCwd 同款局限）：
 * 用户改默认根后，旧根下的临时会话不再识别为临时、归空间区 —— 可接受的归类漂移。
 */
function isTempCwd(cwd: string): boolean {
	const root = getEffectiveWorkspaceRoot();
	return (
		cwd === getTempTasksDir(root) ||
		cwd === root ||
		// 旧 playground 占位目录：只用于**存量会话归类**，新会话不再产生这个 cwd。
		cwd === join(getConfigDir(), "playground")
	);
}

/**
 * 会话历史。用 shared 的 reducer 折叠，与渲染进程**同一份实现** ——
 * 各写一份会漂移，症状是「重开界面后内容变了」，极难排查（shared/conversation.ts 的注释）。
 *
 * daemon 持有它是为了让渲染进程重新挂载时能经 snapshot 拿回完整历史。
 */
let conversation: ConversationView = {
	state: {
		sessionId: "",
		// 启动即临时任务：cwd 是共享临时目录（真实路径），不再是「无目录」。
		cwd: workspaceDir,
		isTempTask: true,
		sceneId: "work",
		interactionId: "craft",
		modelId: activeModelKey,
		isStreaming: false,
	},
	entries: [],
	availableScenes: SCENES,
	availableModes: INTERACTIONS,
	cancelledTurns: [],
	artifacts: [],
};

/* ── 可观测性 ─────────────────────────────────────────────────────── */

/**
 * 结构化事件日志（JSONL 落盘）+ 诊断页统计聚合。
 *
 * daemon 没有界面，console 只打到终端，终端一关现场就没了——
 * 这两件是「出问题时唯一的现场证据」（WorkBuddy 把启动即可观测列为 P0）。
 * 聚合口径是进程内累计，不做历史持久化（core/observability.ts 的注释）。
 */
const eventLog = new EventLog(join(getConfigDir(), "logs"));
const observability = new ObservabilityStore();

/**
 * 产物预览静态服务（根 = 当前工作区，core/preview-server.ts 的注释是安全契约）。
 * 临时任务也起服务（根 = 共享临时目录）—— 有产物就该能预览。
 * 换工作空间时随 applyWorkspace 换根。
 */
const previewServer = new PreviewServer();

/* ── 定时任务 ─────────────────────────────────────────────────────── */

/**
 * 定时任务库与调度器。
 *
 * daemon 是单一业务判断点：五个 IPC handler 与对话内 automation 工具都落在这一个
 * store 上，调度器的 tick/队列也只读它 —— 不存在第二份任务状态。
 * load() 在 start() 里显式调（库损坏暴露在启动时刻，而不是第一次读写时才炸）。
 */
const automationStore = new AutomationStore();

const automationScheduler = new AutomationScheduler({
	store: automationStore,
	execute: createAutomationRunExecutor({
		getCatalog,
		getModelKey: () => activeModelKey,
		resources: RESOURCES,
		compose: async (cwd, sceneId, interactionId, piContext) =>
			(await composeSystemPrompt(cwd, sceneId, interactionId, piContext)).prompt,
		getPermissions: () => activePermissions,
		protectedDirs: PROTECTED_DIRS,
		isTempCwd,
		isOwnWorkspace: (dir) =>
			isPathInside(getEffectiveWorkspaceRoot(), dir) || isPathInside(getConfigDir(), dir),
		getWebSearchConfig,
	}),
	push: (event) => {
		post({ kind: "push", channel: PUSH.automationEvent, payload: event });
	},
});

/** 任务数据变更的统一推送（handler 与调度器共用这一个出口）。 */
function pushAutomationChanged(): void {
	post({ kind: "push", channel: PUSH.automationEvent, payload: { kind: "changed" } });
}

/**
 * 新建/编辑定时任务的统一入口（automationSave 通道）。
 * 状态机归位规则：paused 编辑保持 paused；其余按「还有没有下一次」归位 ——
 * 算不出下一次（一次性已过期）就是 missed，有就是 active。
 */
function saveAutomation(input: AutomationSaveInput): AutomationTask {
	const name = input.name.trim();
	if (name === "") throw new Error("任务名称不能为空");
	const prompt = input.prompt.trim();
	if (prompt === "") throw new Error("任务内容不能为空");
	const scheduleError = validateSchedule(input.schedule);
	if (scheduleError !== undefined) throw new Error(scheduleError);
	const cwd = input.cwd.trim();
	if (cwd === "") throw new Error("工作目录不能为空");
	// 任务 cwd 就是运行时权限门的放行边界，与工作空间同规则把关（配置目录/应用目录拒）。
	const cwdError = validateWorkspacePath(cwd, {
		configDir: getConfigDir(),
		appDir: process.cwd(),
	});
	if (cwdError !== undefined) throw new Error(cwdError);

	const now = Date.now();
	const existing = input.id === undefined ? undefined : automationStore.get(input.id);
	if (input.id !== undefined && existing === undefined) {
		throw new Error("定时任务不存在，可能已被删除");
	}

	const nextRunAt = nextRunAfter(input.schedule, now);
	const status =
		existing?.status === "paused" ? "paused" : nextRunAt === undefined ? "missed" : "active";

	const task: AutomationTask = {
		id: existing?.id ?? randomUUID(),
		name,
		prompt,
		schedule: input.schedule,
		cwd,
		status,
		runs: existing?.runs ?? [],
		createdAt: existing?.createdAt ?? now,
		updatedAt: now,
		nextRunAt,
		lastRunAt: existing?.lastRunAt,
	};
	automationStore.upsert(task);
	pushAutomationChanged();
	return task;
}

/**
 * 启停切换（automationToggle 通道）。active → paused；
 * paused / missed → 按当前时间重算下一次启用，算不出来（一次性已过期）仍是 missed。
 */
function toggleAutomation(id: string): AutomationTask {
	const task = automationStore.get(id);
	if (task === undefined) throw new Error("定时任务不存在");
	const now = Date.now();
	let next: AutomationTask;
	if (task.status === "active") {
		next = { ...task, status: "paused", updatedAt: now };
	} else {
		const nextRunAt = nextRunAfter(task.schedule, now);
		next = {
			...task,
			status: nextRunAt === undefined ? "missed" : "active",
			nextRunAt,
			updatedAt: now,
		};
	}
	automationStore.upsert(next);
	pushAutomationChanged();
	return next;
}

/** 预览文本的上限：超过按二进制处理（面板只读展示，不做大文件）。 */
const ARTIFACT_TEXT_MAX = 512 * 1024;

/**
 * 读产物文件内容（readArtifact 通道）。路径限当前工作区内：
 * 相对路径对工作区 resolve；绝对路径必须落在工作区里——
 * 预览面板能看的文件与权限门放行的写范围必须同界（配置目录里的密钥
 * 绝不能经这条通道被读出来）。
 */
function readArtifactContent(path: string): ArtifactContent {
	const abs = resolve(workspaceDir, path);
	if (abs !== workspaceDir && !abs.startsWith(workspaceDir + sep)) {
		throw new Error("路径超出当前工作区");
	}
	const stat = statSync(abs); // 不存在让 ENOENT 直接抛给调用方（响亮失败）
	const size = stat.size;
	if (size > ARTIFACT_TEXT_MAX) return { size, text: undefined };
	const buf = readFileSync(abs);
	if (buf.includes(0)) return { size, text: undefined }; // NUL = 二进制
	return { size, text: buf.toString("utf8") };
}

/** 最近一次组装的系统提示词 token 估算（compose 时更新），供上下文成分统计。 */
let lastSystemPromptTokens = 0;

/** 最近一次组装的技能段 token 估算（compose 时更新），供上下文用量明细拆分类。 */
let lastSkillsTokens = 0;

/** 事件出口：折叠进本地历史、推给渲染进程、喂给统计与日志。四件事都必须做。 */
/**
 * 并发竞速一个硬超时。
 *
 * 与 fetch 侧的 AbortSignal.timeout 不同，这是**结果层面**的最后防线：
 * Windows DNS 解析不可中断（nodejs/node#46549），信号超时拦不住它，
 * 只有从这里兜住「永不返回」。timer 不清理：超时后搜索仍会自然结束，
 * 无非多等十几秒，不值得为此引入清理逻辑。
 */
function withHardTimeout<T>(promise: Promise<T>, ms: number, message = "请求超时"): Promise<T> {
	return Promise.race([
		promise,
		new Promise<never>((_resolve, reject) => {
			setTimeout(() => reject(new Error(message)), ms).unref?.();
		}),
	]);
}

/**
 * 组装权限状态，**含强制力的诚实声明**。
 *
 * enforcement 恒为 `partial`，因为我们没有 OS 级沙箱：
 * `read-only` 靠权限门拦住已知的写工具（write/edit/bash/powershell），
 * 但拦不住"某个自定义工具或子进程绕过工具层去写文件"这类间接路径。
 *
 * 为什么必须说出来：pi 的 security.md 明确警告
 * "a partial in-process sandbox would be easy to misunderstand as a security boundary"。
 * 界面上写清楚，用户才不会拿它当隔离用。将来真接上 OS 沙箱时只改这一处。
 * 分析见 docs/workbuddy分析/09-sandbox-and-permissions.md。
 */
function buildPermissionInfo(settings: PermissionSettings): PermissionInfo {
	return {
		settings,
		enforcement: "partial",
		enforcementNote:
			"权限由 KamiBuddy 在工具调用前判定，不是操作系统级隔离：" +
			"它能拦住助手主动的读写与命令，但不能约束已运行程序的行为。" +
			"凭据目录（.ssh/.gnupg/.aws 等）在任何档位下都禁止读写。",
	};
}

function emitSessionEvent(event: SessionEvent): void {
	conversation = conversationReducer(conversation, { type: "event", event });
	observability.record(event);
	eventLog.append({ kind: "session_event", event: sanitizeForLog(event) });
	post({ kind: "push", channel: PUSH.sessionEvent, payload: event });

	// 带用量的 session_state 到达后补发明细：used/total 是 pi 的精确值（刚折叠进
	// conversation.state），分类所需的系统提示词/技能段 token 只有这里知道。
	// context_usage 自身不会再触发本分支，无递归。
	if (event.type === "session_state" && event.state.contextUsage !== undefined) {
		emitContextUsageDetail(event.state.contextUsage);
	}
}

/** 组装并发出上下文用量明细（分类是估算值，UI 必须标注，见 shared/context-usage.ts）。 */
function emitContextUsageDetail(contextUsage: { usedTokens: number; maxTokens: number }): void {
	const usage = deriveContextUsageDetail({
		entries: conversation.entries,
		contextUsage,
		systemPromptTokens: lastSystemPromptTokens,
		skillsTokens: lastSkillsTokens,
	});
	if (usage === undefined) return;
	emitSessionEvent({ type: "context_usage", usage });
}

/**
 * 落盘前把流式增量替换成长度——逐字 delta 全记会把日志撑爆且没有信息量，
 * 真正要查的是事件序列与终态，不是每个字符。
 */
function sanitizeForLog(event: SessionEvent): unknown {
	if (
		event.type === "assistant_text_delta" ||
		event.type === "assistant_thinking_delta" ||
		event.type === "tool_progress"
	) {
		return { ...event, delta: `(${event.delta.length} chars)` };
	}
	return event;
}

/* ── 权限审批：daemon 发问 → 渲染进程作答 ─────────────────────────── */

/**
 * 在途的审批请求。
 *
 * 工具执行被 await 挂住，直到用户点了按钮。没有超时是有意的：
 * 用户可能正好离开座位，超时自动拒绝会让长任务莫名失败，
 * 比让它等着更糟。窗口关闭时 Electron 会 quit 并杀掉 daemon，
 * 所以不存在「永久悬挂」的实际后果。
 */
const pendingApprovals = new Map<
	string,
	(response: PermissionResponse) => void
>();

function requestApproval(
	request: Omit<PermissionRequest, "id">,
): Promise<PermissionResponse> {
	const id = randomUUID();
	/*
	 * 审批请求落审计日志：出了事要能还原「当时问过什么、用户批了什么」。
	 * 不记 details 全文 —— 路径/命令已随工具卡的 session_event 日志落盘，
	 * 这里再抄一遍只会让审计日志体积翻倍；id 足够把两边对上。
	 */
	eventLog.append({
		kind: "permission_request",
		id,
		toolName: request.toolName,
		risk: request.risk,
		summary: request.summary,
	});
	return new Promise<PermissionResponse>((resolve) => {
		pendingApprovals.set(id, resolve);
		post({
			kind: "push",
			channel: PUSH.permissionRequest,
			payload: { id, ...request },
		});
	});
}

let hostPromise: Promise<SessionHost> | undefined;

/**
 * 最近一次非 plan 的交互模式。/plan 是进出开关：进入 plan 前记下当前模式，
 * 在 plan 中再发 /plan 就切回这里记的模式。缺省 craft（与初始 interactionId 一致）。
 * 只活在内存：重启后回 craft 可接受，不值得为它落盘。
 */
let lastNonPlanInteraction = "craft";

/**
 * 懒建会话。第一次发消息时才创建 —— 建会话需要一个可用模型，
 * 而用户可能先打开应用、再去设置里填 Key。
 *
 * 失败的 promise 不缓存，否则用户配好模型后仍然一直失败。
 */
function getHost(): Promise<SessionHost> {
	if (hostPromise === undefined) {
		const attempt = createHost();
		hostPromise = attempt;
		attempt.catch(() => {
			if (hostPromise === attempt) hostPromise = undefined;
		});
	}
	return hostPromise;
}

/**
 * 组装会话宿主的唯一入口。恢复历史会话时传入 open 出来的 SessionManager，
 * 其余（扩展、两轴、权限门、预览、当前模型选择）与新会话完全一致 ——
 * 恢复会话不改模型选择与权限设置（spec 决策）。
 */
async function createHost(sessionManager?: SessionManager): Promise<SessionHost> {
	const catalog = await getCatalog();

	// 没选模型时不擅自挑一个：用户不知道在用哪家、也不知道会产生谁的费用。
	// 明确指路比静默可用更好。
	if (activeModelKey === undefined) {
		throw new Error(
			"还没有选择模型。请点左下角设置，为任一服务商填写 API Key 并选择模型。",
		);
	}
	if (!catalog.isUsable(activeModelKey)) {
		throw new Error(
			"选中的模型当前不可用，请到设置里检查 API Key 或重新选择模型。",
		);
	}

	// 临时任务模型下 cwd 必有值（正式空间或共享临时目录）。建会话前确保目录存在
	//（SessionHost.create 里也会 mkdir，但权限门要先拿到一个已确定存在的目录）。
	const cwd = workspaceDir;
	mkdirSync(cwd, { recursive: true });

	const host = await SessionHost.create({
		catalog,
		modelKey: activeModelKey,
		cwd,
		isTempTask: isTempCwd(cwd),
		sceneId: conversation.state.sceneId,
		interactionId: conversation.state.interactionId,
		emit: emitSessionEvent,
		resources: RESOURCES,
		...(sessionManager === undefined ? {} : { sessionManager }),
		// 扩展由 daemon 组装：core/ 不许 import extensions/
		// （依赖方向是 extensions → core，见 AGENTS.md §1）。
		extensions: [
			/*
			 * 权限门：**所有会话全量装，含临时任务**。
			 *
			 * playground 时代曾有不装权限门的分支 —— 那时的安全前提是「不注册
			 * 文件工具即无可拦」。权限加固（权限门 + 项目信任）落地后这个前提
			 * 已消失：临时任务就是普通 cwd 会话，文件工具全量注册，写操作必须
			 * 与正式空间过同一道判定链，不存在「安全靠缺席」的第二种会话形态。
			 */
			createPermissionGate({
				paths: {
					workspaceDir: cwd,
					configDir: getConfigDir(),
					protectedDirs: PROTECTED_DIRS,
					// 写 KamiBuddy 自身目录永远高风险询问（policy 判定链里先于工作区放行）。
					// dev 是项目根，打包后是安装目录 —— 都以 daemon 进程的 cwd 为准。
					appDir: process.cwd(),
				},
				cwd,
				// getter 而非快照：用户改了预设，下一次工具调用即生效。
				getSettings: () => activePermissions,
				requestApproval,
			}),
			/*
			 * 项目信任：**所有会话都装**（与权限门同理）。
			 *
			 * 理由：项目级资源的加载发生在工具层之前 —— `.pi/extensions` 是
			 * TypeScript 模块，以本进程权限执行任意代码，权限门根本拦不到它
			 * （那不是工具调用）。所以临时任务也要把这道闸挂上。
			 *
			 * 自家目录（生效根及其下的一切，含临时目录，与配置目录）直接信任：
			 * 内容都由本机产出，没有"别人塞进来的扩展"这个来源；
			 * 每次新建任务都弹框会让用户条件反射点同意，那这道防线就废了。
			 * 生效根现读：用户改默认存储路径后，新根下的空间不该再弹信任框。
			 */
			createProjectTrust({
				isOwnWorkspace: (dir) =>
					isPathInside(getEffectiveWorkspaceRoot(), dir) || isPathInside(getConfigDir(), dir),
			}),
			// 产物交付：present_files 是产物的唯一入口（WorkBuddy 同构）。
			// 只读工具，所有会话都注册（区外路径不 stat，见 extensions/present-files.ts）。
			createPresentFiles({
				getWorkspaceDir: () => workspaceDir,
				onPresent: ({ files, focusFile }) => {
					emitSessionEvent({ type: "artifacts_presented", files, focusFile });
					// 产物清单持久化到会话文件（appendCustomEntry），恢复历史会话时
					// buildConversationEntries 把它翻译回 artifacts_presented 事件，
					// 产物卡与交付时状态一致。
					if (hostPromise !== undefined) {
						void hostPromise.then((host) => {
							host.persistArtifacts(files, focusFile);
						}).catch(() => {
							// 持久化失败不影响交付本身（产物已在内存里），日志走 eventLog。
						});
					}
				},
			}),
			// 提示词切换：每轮按当前 场景×模式 组装 systemPrompt（见 extensions/prompt-switch.ts）。
			// 两轴的权威状态经 conversation 折叠镜像读取；技能段取自宿主的 loader 发现结果。
			createPromptSwitch({
				getCurrent: () => ({
					sceneId: conversation.state.sceneId,
					interactionId: conversation.state.interactionId,
				}),
				compose: async (sceneId, interactionId, piContext) => {
					const composed = await composeSystemPrompt(cwd, sceneId, interactionId, piContext);
					// 成分统计的 system 部分从这里取——只有这里见过组装完的真身。
					// 技能段单独记一份：上下文用量明细要把「技能」从系统提示词里拆出来单列。
					lastSystemPromptTokens = composed.systemTokens;
					lastSkillsTokens = composed.skillsTokens;
					return composed.prompt;
				},
			}),
			// 联网工具：所有会话都装。
			// 配置读偏好文件；权限门里 web_search/web_fetch 已登记放行，不再弹窗。
			createWebTools({ getSearchConfig: getWebSearchConfig }),
			// 文档读取：所有会话都装。read_document 已登记权限门只读工具
			// （与 read 同语义），区外读取走通用的低风险询问，这里无需额外接线。
			createDocReadTool(),
			// 对话内 automation 工具（craft 白名单）：模型在对话里建/查/删定时任务。
			// cwd 缺省取当前会话 cwd —— 工厂闭包拿不到会话状态，由这里注入 getter。
			automationExtensionFactory(automationStore, () => workspaceDir),
		],
	});

	// 会话建好后 sessionId / cwd 才有真值，推一次让 UI 同步。
	emitSessionEvent({ type: "session_state", state: host.state });
	return host;
}

/**
 * 作废当前会话并清空本地历史。换空间与新建任务共用这一步：
 * 会话与 cwd 终身绑定，不存在「换目录/换任务继续聊」。
 */
async function resetSession(): Promise<void> {
	if (hostPromise !== undefined) {
		(await hostPromise).dispose();
		hostPromise = undefined;
	}
	/*
	 * 走事件而不是直接改 conversation：reducer 两端共用（shared/conversation.ts），
	 * daemon 本地折叠与 renderer 折叠的是同一个 history_reset，历史同步清零。
	 * 此前只清本地再发 session_state —— reducer 对 session_state 不动 entries，
	 * renderer 一直显示旧历史（/new 命令的幽灵历史就是这么来的）。
	 */
	emitSessionEvent({ type: "history_reset" });
}

/**
 * 切换工作空间。空串表示「临时任务」（共享临时目录，新建任务的默认态）。
 *
 * 安全前提：工作空间内的写操作会被权限门直接放行，所以「设为哪个目录」
 * 必须先过 validateWorkspacePath（配置目录 / 应用目录一律拒，见 core/workspace.ts）。
 * 临时目录是自家构造（生效根下），不过这道校验 —— 同 getEffectiveWorkspaceRoot
 * 的回退语义，非法根在那一层已被忽略。
 *
 * 换空间 = 作废当前会话：cwd 在建会话时一次性注入 pi 的工具集，
 * 不存在「换目录继续聊」（WorkBuddy 同样如此，它的 cwd 在 session.create 时绑定）。
 * 旧会话的本地历史一并清掉——它属于上一个空间，留着会让 UI 显示别处的对话。
 */
async function applyWorkspace(dir: string): Promise<string> {
	// 空串 = 临时任务。现算不缓存：改默认存储路径后，下一次切临时任务即刻用新根。
	const next = dir === "" ? tempTasksDir() : dir;
	if (dir !== "") {
		const error = validateWorkspacePath(next, {
			configDir: getConfigDir(),
			appDir: process.cwd(),
		});
		if (error !== undefined) throw new Error(error);
	}
	if (next === workspaceDir) return workspaceDir;
	if (conversation.state.isStreaming)
		throw new Error("任务进行中，请先停止当前任务再切换工作空间");

	mkdirSync(next, { recursive: true });
	workspaceDir = next;

	// 预览服务随工作区换根（临时任务同样起服务：有产物就该能预览）。先于 resetSession：
	// 服务换根失败（如端口异常）时工作区切换应该响亮失败，而不是带病继续。
	await previewServer.setRoot(next);

	await resetSession();
	updateStateLocally({ cwd: next, isTempTask: isTempCwd(next) });
	return next;
}

/* ── 历史会话管理（list / resume / rename / delete） ────────────── */

/**
 * 列表标题的截断上限。renderer 的 taskTitle 另有 24 字符的展示截断，
 * 这里截的是数据上限：firstMessage 原文可能整段上千字，不能原样进列表契约。
 */
const SESSION_TITLE_MAX = 40;

/** 列表标题：命名优先，否则首条消息压单行截断。空会话给占位，不留空白行。 */
function sessionTitle(name: string | undefined, firstMessage: string): string {
	if (name !== undefined && name !== "") return name;
	const oneLine = firstMessage.replace(/\s+/g, " ").trim();
	if (oneLine === "") return "（空会话）";
	return oneLine.length > SESSION_TITLE_MAX
		? `${oneLine.slice(0, SESSION_TITLE_MAX)}…`
		: oneLine;
}

/** 只容忍「目录不存在」：首次使用还没有 sessions 目录是正常情况，列表为空。 */
function isEnoent(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		(error as { code?: unknown }).code === "ENOENT"
	);
}

/** 当前活动宿主持有的会话文件。host 未建（还没发过消息）为 undefined。 */
async function currentSessionFile(): Promise<string | undefined> {
	if (hostPromise === undefined) return undefined;
	return (await hostPromise).sessionFilePath;
}

async function listSessions(): Promise<SessionSummary[]> {
	let infos: SessionInfo[];
	try {
		infos = await SessionManager.listAll(getSessionsDir());
	} catch (error) {
		// 只容忍 ENOENT（见 isEnoent）。其余错误必须抛 —— 静默返回空列表
		// 会让用户以为历史丢了，那比报错更难排查（AGENTS.md §7）。
		if (isEnoent(error)) return [];
		throw error;
	}
	const currentFile = await currentSessionFile();
	return infos
		.map((info): SessionSummary => {
			return {
				id: info.id,
				path: info.path,
				title: sessionTitle(info.name, info.firstMessage),
				name: info.name,
				cwd: info.cwd,
				// 任务区判定收在 isTempCwd 一处（临时目录 / 生效根本身 / 旧 playground 占位）。
				isTempTask: isTempCwd(info.cwd),
				createdAt: info.created.getTime(),
				modifiedAt: info.modified.getTime(),
				messageCount: info.messageCount,
				current:
					currentFile !== undefined &&
					resolve(currentFile) === resolve(info.path),
			};
		})
		.sort((a, b) => b.modifiedAt - a.modifiedAt);
}

/**
 * 把一个会话文件移入 trash（不真删：可人工找回，对齐 pi 避免永久删除的取向）。
 * sessionDelete 与 workspaceRemove 共用，别在调用点各写一遍。
 *
 * 时间戳前缀防同名覆盖（同一会话删两次、不同会话同文件名）。批量移除空间时
 * 同一毫秒可能连移多个同名文件，Date.now() 前缀会撞 —— libuv 的 rename 带
 * MOVEFILE_REPLACE_EXISTING，直接覆盖就把先移进去的抹掉了，trash 是找回兜底，
 * 被覆盖等于真丢。撞名时追加序号，序号本身不需要持久语义。
 */
function moveToTrash(filePath: string): void {
	const trashDir = join(getConfigDir(), "trash");
	mkdirSync(trashDir, { recursive: true });
	const stamp = Date.now();
	let candidate = join(trashDir, `${stamp}-${basename(filePath)}`);
	for (let i = 1; existsSync(candidate); i++) {
		candidate = join(trashDir, `${stamp}-${i}-${basename(filePath)}`);
	}
	renameSync(filePath, candidate);
}

/**
 * 改写会话文件头部（首行 JSON）的 cwd —— 转正后归组的前提。
 *
 * 空间分组派生自会话文件 header.cwd（listSessions → listWorkspaceGroups），
 * 而 pi 的 SessionManager.open(cwdOverride) 只改内存值、不落盘：不改首行，
 * 侧栏刷新后该会话仍挂任务区，「归入空间区」不成立。首行即 SessionHeader
 * （pi docs/session-format.md），整文件重写只动这一个键，其余条目原样保留。
 *
 * 调用时持有该文件的宿主必须已 dispose：pi 的 SessionManager 各自缓存
 * entries，同一文件两个活写者会互相覆盖（sessionRename 注释的同一结论）。
 */
function rewriteSessionHeaderCwd(filePath: string, cwd: string): void {
	const content = readFileSync(filePath, "utf8");
	const newline = content.indexOf("\n");
	const firstLine = newline === -1 ? content : content.slice(0, newline);
	const header: unknown = JSON.parse(firstLine);
	if (
		typeof header !== "object" ||
		header === null ||
		(header as { type?: unknown }).type !== "session"
	) {
		throw new Error("会话文件缺少头部，无法保存到工作空间");
	}
	// newline === -1（文件只有一行头）时补一个换行，保持 JSONL 行尾约定。
	const rest = newline === -1 ? "\n" : content.slice(newline);
	writeFileSync(
		filePath,
		JSON.stringify({ ...(header as Record<string, unknown>), cwd }) + rest,
		"utf8",
	);
}

/**
 * 空间组集合：非临时任务会话的 cwd 去重，合并显示名覆盖。
 *
 * 临时任务（临时目录、生效根本身、旧 playground 占位）归任务区、不成组 ——
 * 它们不是用户经营的空间。组由会话文件派生（磁盘真相）：没有会话的目录
 * 不形成组，被移除的空间若再开任务会自然重现。显示名只是视图层覆盖
 * （workspaces.json），注册表里没有的键不回补。
 * 组顺序无所谓 —— 排序是 renderer 的事（契约注释）。
 */
async function listWorkspaceGroups(): Promise<WorkspaceGroupMeta[]> {
	const names = readDisplayNames();
	const cwds = new Set<string>();
	for (const session of await listSessions()) {
		if (!session.isTempTask) cwds.add(session.cwd);
	}
	return [...cwds].map((cwd): WorkspaceGroupMeta => ({ cwd, displayName: names[cwd] }));
}

/**
 * 恢复历史会话为当前活动会话。编排与 applyWorkspace 同构：
 * 守卫 → 作废旧宿主 → 恢复工作空间语义 → 重建宿主 → 重建本地历史。
 *
 * 失败原子性：先验证，后切换。open / header 校验 / 工作目录校验全部在
 * dispose 旧宿主之前完成 —— 这些步骤都可能失败（文件损坏、缺头部、目录
 * 不合法），失败时旧会话必须原样保留（宿主、本地历史、工作目录、预览服务
 * 都不动），错误经 IPC 抛回 renderer toast 即可。若先 dispose 再验证，
 * 用户看到错误 toast 之后会发现当前会话已被静默清空（验收确证过的坑）。
 *
 * dispose 之后仍留一段非原子窗口：setRoot 换根、createHost 组装（如模型
 * 不可用）失败时，旧宿主已销毁、新宿主未建。这与 applyWorkspace 的失败
 * 语义一致（那里同样先 setRoot 再 resetSession，见该函数注释）——setRoot
 * 是「先 close 旧服务再 listen 新根」，前移它救不了 createHost，反而把
 * 预览服务也拖进中间态；要彻底关闭窗口需要「先建好后切换」的两阶段宿主
 * 交换，超出本次修复范围。
 *
 * 与 resetSession 的关键差别：**不发 history_reset**。renderer 在 resume
 * 返回后 resyncSnapshot 整体替换视图；若先发 history_reset，界面会先闪
 * 一下空屏再出内容。本地 conversation 也由重建结果整体赋值，不经事件。
 */
async function resumeSession(path: string): Promise<void> {
	if (conversation.state.isStreaming)
		throw new Error("任务进行中，请先停止当前任务");
	const sessionsDir = getSessionsDir();
	const pathError = validateSessionFilePath(path, sessionsDir);
	if (pathError !== undefined) throw new Error(pathError);

	/* ── 切换前：做完所有可能失败的验证，此刻旧会话毫发无损 ── */

	// open 是同步的（dist 类型：static open(...) : SessionManager），
	// 不依赖旧宿主销毁；文件损坏/不可读在此抛出。
	const manager = SessionManager.open(path, sessionsDir);
	const header = manager.getHeader();
	if (header === null) throw new Error("会话文件缺少头部，无法恢复");

	// 从 header.cwd 推导目标工作空间，只算值不赋值：
	//   - 旧 playground 占位目录（playground 时代的技术 cwd）→ 迁移到共享临时目录。
	//     占位目录里本就不可能有产物（当时不注册文件工具），映射只改归类、不丢数据；
	//     会话文件 header 不改写 —— 下次 resume 仍走这条映射，判定收在 isTempCwd 一处。
	//   - 其余按工作空间校验同一套规则把关（会话本身没问题但目录不合法时拒，
	//     如指向配置目录的旧会话）。目录可能已被用户删掉，补建与新建会话同口径
	//     —— mkdir 幂等且不碰任何会话状态，可安全提前。
	let nextWorkspaceDir: string;
	if (header.cwd === join(getConfigDir(), "playground")) {
		nextWorkspaceDir = tempTasksDir();
		mkdirSync(nextWorkspaceDir, { recursive: true });
	} else {
		const wsError = validateWorkspacePath(header.cwd, {
			configDir: getConfigDir(),
			appDir: process.cwd(),
		});
		if (wsError !== undefined) throw new Error(`会话的工作目录不可用：${wsError}`);
		mkdirSync(header.cwd, { recursive: true });
		nextWorkspaceDir = header.cwd;
	}

	/* ── 切换点：此后失败即进入上文的非原子窗口 ── */

	if (hostPromise !== undefined) {
		(await hostPromise).dispose();
		hostPromise = undefined;
	}

	workspaceDir = nextWorkspaceDir;

	// 预览服务随工作区换根（临时任务同样起服务），与 applyWorkspace 同口径。
	await previewServer.setRoot(workspaceDir);

	// 复用 createHost 的全部组装（扩展、两轴、权限门、当前模型选择），
	// 只换 sessionManager。createHost 末尾会发 session_state，
	// cwd / isTempTask / sessionId 随之同步给 UI。
	const host = await createHost(manager);
	hostPromise = Promise.resolve(host);

	// 本地历史整体重建：entries 来自落盘条目（buildContextEntries 已完成
	// 压缩裁剪，恢复视图与模型实际看到的上下文一致）。turn / cancelledTurns
	// 属于旧 run 的瞬态，清空；artifacts 从落盘的 artifacts_presented
	// custom 条目恢复（buildConversationEntries 翻译 → artifactsFromEntries 折叠，
	// 清成 [] 会让恢复出的会话丢掉产物卡）；state 保留现值 ——
	// 它刚被 createHost 的 session_state 换成新会话的权威值。
	//
	// usageDetail 不在清空之列：它描述「当前上下文占用多少」而不是旧 run 的
	// 瞬态 —— resume 后 pi 从落盘消息重建了上下文，getContextUsage() 仍然
	// 有效，圆环理应立即恢复（曾经无条件 undefined，恢复后圆环消失、要等
	// 下一次模型响应才回来）。contextUsage 缺失（压缩后无响应的空窗）时派生
	// 结果为 undefined，圆环隐藏才是正确语义（shared/conversation.ts 的
	// reducer 对 session_state 同口径）。派生必须等 entries 重建之后：
	// createHost 末尾那次 session_state 已触发过一轮 emitContextUsageDetail，
	// 彼时 conversation.entries 还是旧会话的 —— 那轮派生出的是旧会话成分
	// （时序坑），下方补发的事件在顺序上后发覆盖它。
	const rebuilt = buildConversationEntries(manager.buildContextEntries(), restoredToolLabel);
	const contextUsage = host.state.contextUsage;
	const usageDetail = deriveContextUsageDetail({
		entries: rebuilt,
		contextUsage,
		systemPromptTokens: lastSystemPromptTokens,
		skillsTokens: lastSkillsTokens,
	});
	conversation = {
		...conversation,
		entries: rebuilt,
		usageDetail,
		turn: undefined,
		cancelledTurns: [],
		artifacts: artifactsFromEntries(rebuilt),
	};

	// 补发一次 context_usage：reducer 对它直接覆盖 usageDetail（事件顺序上
	// 后发的胜出），把 createHost 早发那轮旧会话成分派生顶掉，renderer 不必
	// 等 resyncSnapshot 圆环就位。emitContextUsageDetail 读闭包里的
	// conversation.entries —— 此刻已是重建结果，派生值与上面这份 usageDetail
	// 一致（同一纯函数、同一输入）。
	if (contextUsage !== undefined) {
		emitContextUsageDetail(contextUsage);
	}
}

/**
 * 「保存到工作空间」：临时任务转正为命名空间。
 *
 * 编排与 resumeSession 同构（守卫 → 验证全做完 → dispose → 换 cwd 重建宿主），
 * 但有一个关键差别：**这不是 open 别人的会话文件，而是当前会话原地换 cwd** ——
 * 会话文件不动位置、消息历史不动、sessionId 不变，只重写 header.cwd（归组键）
 * 并以新 cwd 重建宿主（cwd 在建会话时一次性注入工具集，见 applyWorkspace 注释）。
 * 所以本地 conversation 视图原样保留，不需要 resume 那套 entries 重建。
 *
 * 失败原子性与 resumeSession 同口径：守卫 / 名称校验 / 目录占用检查全部在
 * dispose 之前完成；dispose 之后进入同款非原子窗口（setRoot / createHost
 * 失败时旧宿主已销毁，见 resumeSession 注释）。
 *
 * 已生成文件留在临时目录不动（spec 决策）：共享临时目录是所有临时任务共用的，
 * 无法干净归属单个任务的文件，强行搬迁会带走别的任务的产物 ——
 * WorkBuddy 同为共享目录结构（spec：align-temp-task-workspace-model）。
 */
async function saveToWorkspace(name: string): Promise<void> {
	if (conversation.state.isStreaming)
		throw new Error("任务进行中，请先停止当前任务");
	if (hostPromise === undefined)
		throw new Error("还没有会话，请先开始任务");
	// 会话与 cwd 终身绑定，当前 cwd 即会话身份；临时判定用 reducer 折叠出的权威值。
	if (!isTempCwd(conversation.state.cwd ?? workspaceDir))
		throw new Error("只有临时任务可以保存到工作空间");

	const root = getEffectiveWorkspaceRoot();

	/*
	 * siblings = 生效根下现有子目录名 + 现有外部空间组名（显示名覆盖优先）。
	 * 复用显示名校验是因为命名规则同族（非空/非法字符/255/重名/保留名），
	 * 但这里创建的是**真实目录**不是显示名覆盖 —— 所以根下子目录必须在
	 * siblings 里（显示名校验只看组名的话，根下已有的非组目录会漏网）。
	 * 根不存在按空数组：走到这里临时目录已建过（createHost 的 mkdir），根
	 * 理应存在，ENOENT 只可能是用户刚手删 —— 按「还没有任何兄弟」继续，
	 * 下面的 mkdir 会把根连带补建。
	 */
	let dirNames: string[] = [];
	try {
		dirNames = readdirSync(root, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name);
	} catch (error) {
		if (!isEnoent(error)) throw error;
	}
	const groupNames = (await listWorkspaceGroups()).map(
		(g) => g.displayName ?? basename(g.cwd),
	);
	const trimmed = name.trim();
	const nameError = validateDisplayName(trimmed, [...dirNames, ...groupNames]);
	if (nameError !== undefined) throw new Error(nameError);

	/*
	 * 「存在即拒」而非静默复用：validateDisplayName 的重名只查 sibling 名，
	 * 根下存在同名**文件**（不是目录，readdir 过滤掉了）或校验后竞态冒出的
	 * 占用都会漏过去。静默复用别人/别的任务的目录比报错更糟 —— 产物会
	 * 混进一堆陌生文件里，用户以为是自己任务的成果。
	 */
	const target = join(root, trimmed);
	if (existsSync(target)) throw new Error("该名称的目录已存在");

	/* ── 切换前：做完所有可能失败的验证，此刻会话毫发无损 ── */

	const host = await hostPromise;
	const sessionFile = host.sessionFilePath;
	// 本应用的会话都是持久化的（SessionManager.create 走 sessions 目录），
	// undefined 只出现在 pi 的 in-memory 形态 —— 真遇到就是上游语义变了，响亮失败。
	if (sessionFile === undefined)
		throw new Error("会话尚未落盘，无法保存到工作空间");

	mkdirSync(target, { recursive: true });

	/* ── 切换点：此后失败即进入 resumeSession 注释所述的非原子窗口 ── */

	host.dispose();
	hostPromise = undefined;

	// 归组键改写必须先于 open：open 读 header 定内存 cwd，分组读 header 定归组。
	rewriteSessionHeaderCwd(sessionFile, target);

	workspaceDir = target;

	// 预览服务随工作区换根，与 applyWorkspace / resumeSession 同口径。
	await previewServer.setRoot(target);

	// 复用 createHost 的全部组装（扩展、两轴、权限门、当前模型选择），
	// 只换 cwd（createHost 读模块级 workspaceDir，上面已赋值）。
	// SessionManager.open 重新打开同一文件：header 已是新 cwd，内存值随之正确。
	const manager = SessionManager.open(sessionFile, getSessionsDir());
	const nextHost = await createHost(manager);
	hostPromise = Promise.resolve(nextHost);

	// createHost 末尾的 session_state 已带权威值（cwd=target、isTempTask=false），
	// 这里再显式声明一次落点，与 applyWorkspace 末尾同口径 —— 工作空间语义的
	// 落点不依赖 createHost 那次顺带同步。
	updateStateLocally({ cwd: target, isTempTask: false });
}

/* ── 请求派发 ─────────────────────────────────────────────────────── */

type Handler = (args: readonly unknown[]) => Promise<unknown>;

/** 新建任务：作废旧会话。INVOKE.newTask 与内置命令 /new 共用。 */
async function newTask(): Promise<void> {
	if (conversation.state.isStreaming)
		throw new Error("任务进行中，请先停止当前任务");
	await resetSession();
	updateStateLocally({});
}

const handlers: Record<string, Handler> = {
	// 返回折叠后的真实历史。ConversationView 与 SessionSnapshot 结构一致。
	[INVOKE.snapshot]: async () => conversation,

	/* ── 设置：已可用 ─────────────────────────────────────────────── */

	[INVOKE.settingsSnapshot]: async () => (await getCatalog()).snapshot(activeModelKey),

	/* ── 技能 ─────────────────────────────────────────────────────── */

	[INVOKE.skillsSnapshot]: async () => ({ skills: listSkills(), userSkillsDir: userSkillsDir() }),

	[INVOKE.importSkill]: async ([sourcePath]) => importSkill(sourcePath as string),

	[INVOKE.setApiKey]: async ([providerId, apiKey]) => {
		await (
			await getCatalog()
		).setApiKey(providerId as string, apiKey as string);
	},

	[INVOKE.removeApiKey]: async ([providerId]) => {
		await (await getCatalog()).removeApiKey(providerId as string);
	},

	[INVOKE.saveCustomProvider]: async ([input, apiKey]) => {
		await (
			await getCatalog()
		).saveCustomProvider(
			input as CustomProviderInput,
			apiKey as string | undefined,
		);
	},

	[INVOKE.deleteCustomProvider]: async ([providerId]) => {
		await (await getCatalog()).deleteCustomProvider(providerId as string);
	},

	[INVOKE.readCustomProvider]: async ([providerId]) =>
		(await getCatalog()).readCustomProvider(providerId as string),

	[INVOKE.refreshCatalog]: async () => {
		await (await getCatalog()).refreshCatalog();
	},

	/* ── 诊断 ─────────────────────────────────────────────────────── */

	[INVOKE.statsSnapshot]: async () =>
		observability.snapshot({
			entries: conversation.entries,
			systemPromptTokens: lastSystemPromptTokens,
			contextUsage: conversation.state.contextUsage,
			logDir: eventLog.dir,
		}),

	/* ── 定时任务 ─────────────────────────────────────────────────── */

	[INVOKE.automationList]: async () => automationStore.list(),

	[INVOKE.automationSave]: async ([input]) => saveAutomation(input as AutomationSaveInput),

	[INVOKE.automationDelete]: async ([id]) => {
		const taskId = id as string;
		// 正在运行（含排队中）的任务拒删：run 结束时要回写运行记录与
		// nextRunAt，任务没了会写成一笔找不到主儿的孤儿账（spec 同口径）。
		if (automationScheduler.isBusy(taskId)) {
			throw new Error("任务正在运行，请等运行结束后再删除");
		}
		automationStore.remove(taskId);
		pushAutomationChanged();
	},

	[INVOKE.automationToggle]: async ([id]) => toggleAutomation(id as string),

	[INVOKE.automationRunNow]: async ([id]) => automationScheduler.runNow(id as string),

	/* ── 会话 ─────────────────────────────────────────────────────── */

	[INVOKE.prompt]: async ([request]) => {
		const { text, whileStreaming, images } = request as PromptRequest;

		// 内置命令（/new、/compact、/plan）是操作不是消息：发给模型没有意义，
		// 在进会话之前拦下来执行（解析规则见 shared/builtin-commands.ts）。
		const command = parseBuiltinCommand(text.trim());
		if (command !== undefined) {
			if (command.name === "new") {
				await newTask();
				return;
			}
			if (command.name === "plan") {
				// 进出开关：非 plan 进 plan（applyInteraction 会记下当前模式）；
				// 已在 plan 则切回记下的模式。
				const current = conversation.state.interactionId;
				await applyInteraction(current === "plan" ? lastNonPlanInteraction : "plan");
				return;
			}
			// compact：pi 会先中断当前操作且不续跑，流式期间明确拒绝比被中断好。
			if (conversation.state.isStreaming)
				throw new Error("任务进行中，请先停止当前任务再压缩上下文");
			if (hostPromise === undefined)
				throw new Error("还没有会话，没有可压缩的上下文");
			await (await hostPromise).compact(command.args === "" ? undefined : command.args);
			return;
		}

		const host = await getHost();
		await host.prompt(text, whileStreaming, images);
	},

	/**
	 * 中断。**不走 getHost()** —— 没有会话时中断本就是空操作，
	 * 为了中断而去创建一个会话是荒谬的（还会因为没配模型而报错）。
	 */
	[INVOKE.abort]: async () => {
		if (hostPromise === undefined) return;
		await (await hostPromise).abort();
	},

	/**
	 * 新建任务：作废旧会话、在当前工作空间语义下开一个全新会话。
	 *
	 * 关键点：工作空间选择**保留**（用户在哪个空间就在哪个空间开新任务），
	 * 但会话上下文清零——这是「任务干扰」的根治：两个任务不再共享 pi 的消息历史。
	 * 会话本体是懒建的（getHost），这里只需作废 + 清空，下次 prompt 自然建新的。
	 */
	[INVOKE.newTask]: async () => newTask(),

	/* ── 历史会话 ─────────────────────────────────────────────────── */

	[INVOKE.sessionList]: async () => listSessions(),

	[INVOKE.sessionResume]: async ([path]) => resumeSession(path as string),

	[INVOKE.sessionRename]: async ([path, name]) => {
		const target = path as string;
		const trimmed = (name as string).trim();
		if (trimmed === "") throw new Error("名称不能为空");

		// 当前活动会话必须走活实例：pi 的 SessionManager 各自缓存 entries，
		// 同一文件出现两个活写者会互相覆盖。
		const host = hostPromise === undefined ? undefined : await hostPromise;
		const currentFile = host?.sessionFilePath;
		if (host !== undefined && currentFile !== undefined && resolve(currentFile) === resolve(target)) {
			host.renameSession(trimmed);
			return;
		}

		const pathError = validateSessionFilePath(target, getSessionsDir());
		if (pathError !== undefined) throw new Error(pathError);

		// 非当前会话：临时 open 写完即弃。实例不持有、不注册到任何地方 ——
		// 它若日后成为活会话，会经 resume 重新 open，不存在双写者窗口。
		SessionManager.open(target, getSessionsDir()).appendSessionInfo(trimmed);
	},

	[INVOKE.sessionDelete]: async ([path]) => {
		const target = path as string;

		// 当前活动会话拒删：宿主还持有这个文件的活写者，删掉后续写会失败，
		// 且用户正在看的对话会变成一个打不开的历史项。
		const host = hostPromise === undefined ? undefined : await hostPromise;
		const currentFile = host?.sessionFilePath;
		if (currentFile !== undefined && resolve(currentFile) === resolve(target)) {
			throw new Error("这是当前任务，请先新建任务再删除");
		}

		const pathError = validateSessionFilePath(target, getSessionsDir());
		if (pathError !== undefined) throw new Error(pathError);

		moveToTrash(target);
	},

	[INVOKE.sessionExport]: async ([path]) => {
		const target = path as string;

		// 与 resume / rename / delete 同一道防线：path 来自 renderer，不可信。
		const pathError = validateSessionFilePath(target, getSessionsDir());
		if (pathError !== undefined) throw new Error(pathError);

		/*
		 * 目标是历史会话时「先恢复再导出」：pi 的导出能力只挂在活会话上
		 * （AgentSession.exportToHtml），独立入口 exportFromFile 没有从包根
		 * 导出（深引内部路径实测 ERR_PACKAGE_PATH_NOT_EXPORTED），包根导出
		 * 面下这是唯一正路。直接复用 resumeSession 而不复制它的逻辑 ——
		 * 流式守卫、open+header 校验、失败原子性（验证全在 dispose 旧宿主
		 * 之前）都随之生效；resume 失败则导出中止，错误原样上抛。
		 */
		const currentFile = await currentSessionFile();
		if (currentFile === undefined || resolve(currentFile) !== resolve(target)) {
			await resumeSession(target);
		}

		// 此处目标必为当前会话：原本就是，或 resume 刚切过去（成功必设
		// hostPromise）。这个分支现实中不可达，但 hostPromise 的类型需要
		// 窄化；真走到就说明 resume 的语义变了 —— 响亮失败，不静默兜底。
		if (hostPromise === undefined) {
			throw new Error("还没有会话，没有可导出的内容");
		}
		const host = await hostPromise;

		/*
		 * 输出固定落默认根的 exports/（getWorkspaceDir()，不是当前工作区）：
		 * 临时任务的 cwd 是所有临时任务共享的目录，导出物落在其下会混进
		 * 别的任务的产物堆里；固定落点让用户总能在一个地方找到自己的导出物，
		 * 不用记「当时用的哪个工作区」（core/session-export.ts 文件头是同一决策）。
		 */
		const exportsDir = join(getWorkspaceDir(), "exports");
		mkdirSync(exportsDir, { recursive: true });

		// 文件名标题与会话列表同口径（命名 ?? 首条消息截断）。列表里查不到
		// 时回退会话 id —— 刚恢复的会话列表理应含它，回退只为不留裸时间戳。
		const resolvedTarget = resolve(target);
		const summary = (await listSessions()).find((s) => resolve(s.path) === resolvedTarget);
		const title = summary?.title ?? conversation.state.sessionId;

		const outputPath = buildExportPath(exportsDir, title, new Date());
		// 空会话的「该会话还没有内容可导出」由 exportHtml 抛出，自然上抛给 UI。
		await host.exportHtml(outputPath);
		return { outputPath };
	},

	// 临时任务转正：命名 → 根下建目录 → 当前会话以新 cwd 重建（见 saveToWorkspace）。
	[INVOKE.saveToWorkspace]: async ([name]) => saveToWorkspace(name as string),

	[INVOKE.setScene]: async ([sceneId]) => {
		const id = requireReady(SCENES, sceneId as string, "场景");
		if (hostPromise === undefined) {
			// 会话还没建：只记住选择。建会话时会把它带进去（见 createHost）。
			updateStateLocally({ sceneId: id });
			return;
		}
		(await hostPromise).setScene(id);
	},

	[INVOKE.setInteraction]: async ([interactionId]) =>
		applyInteraction(interactionId as string),

	/**
	 * 切换模型。不依赖会话 —— 设置界面在会话建立前就要能用。
	 * 会话已存在时同步切过去，避免「设置里显示 A、实际还在用 B」。
	 */
	[INVOKE.setModel]: async ([modelKey]) => {
		const key = modelKey as string;
		const catalog = await getCatalog();
		// 未配凭据的服务商其模型照样在目录里（probe 用例 B），所以必须显式把关，
		// 否则用户选完要等到真正发消息时才报错。
		if (!catalog.isUsable(key)) {
			throw new Error("该模型不可用：请先为其服务商配置 API Key");
		}
		activeModelKey = key;
		// 读改写：偏好文件里还有别的键（如联网搜索），整存覆盖会清掉它们。
		writePreferences({ ...readPreferences(), activeModelKey: key });

		if (hostPromise !== undefined) await (await hostPromise).setModel(key);
		else updateStateLocally({ modelId: key });
	},

	/* ── 联网搜索配置 ───────────────────────────────────────────────── */

	[INVOKE.getWebSearchConfig]: async (): Promise<WebSearchConfigInfo> => {
		const webSearch = readPreferences().webSearch;
		if (webSearch === undefined) return { providerId: undefined, hasKey: false };
		const providerId = isWebSearchProviderId(webSearch.providerId)
			? webSearch.providerId
			: undefined;
		return { providerId, hasKey: webSearch.apiKey !== "" };
	},

	[INVOKE.setWebSearchConfig]: async ([input]) => {
		const config = input as WebSearchConfigInput;
		// 与自定义服务商同样的双端校验：设置页即时校验 + 这里防绕过。
		if (!isWebSearchProviderId(config.providerId)) {
			throw new Error(`未知的搜索服务商：${config.providerId}`);
		}
		if (config.apiKey.trim() === "") {
			throw new Error("API Key 不能为空");
		}
		writePreferences({
			...readPreferences(),
			webSearch: { providerId: config.providerId, apiKey: config.apiKey.trim() },
		});
	},

	[INVOKE.clearWebSearchConfig]: async () => {
		const { webSearch: _dropped, ...rest } = readPreferences();
		writePreferences(rest);
	},

	[INVOKE.testWebSearch]: async (): Promise<WebSearchTestResult> => {
		const webSearch = readPreferences().webSearch;
		if (
			webSearch === undefined ||
			!isWebSearchProviderId(webSearch.providerId) ||
			webSearch.apiKey.trim() === ""
		) {
			return { ok: false, message: "尚未配置搜索服务商与 API Key，请先保存配置" };
		}
		// 真实搜索一次：返回码/额度/网络问题在这里全部现形，
		// 用户不用猜测「key 存上了没、服务商通没通」。
		// 外层再叠一层硬超时：Windows 的 DNS 解析不可中断（libuv GetAddrInfoW，
		// nodejs/node#46549），AbortSignal.timeout 在 DNS 卡死时停了它，
		// fetch 会无限挂起 —— 测试按钮必须**永远**有返回，不能一直转圈。
		try {
			const results = await withHardTimeout(
				searchWeb(
					{ providerId: webSearch.providerId, apiKey: webSearch.apiKey },
					"KamiBuddy 联网测试",
					{ limit: 2 },
				),
				15_000,
			);
			return {
				ok: true,
				message: `连接成功，返回 ${results.length} 条结果`,
				count: results.length,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			// 超时大概率是「服务商在国内网络不可达」，把选项告诉用户而不是让他猜。
			const hint = message.includes("超时")
				? "（Tavily 等海外服务在国内网络下常无法连接，建议换「博查」）"
				: "";
			return { ok: false, message: `${message}${hint}` };
		}
	},

	/* ── 权限设置 ───────────────────────────────────────────────────── */

	[INVOKE.getPermissions]: async (): Promise<PermissionInfo> =>
		buildPermissionInfo(activePermissions),

	[INVOKE.setPermissions]: async ([input]): Promise<PermissionInfo> => {
		const candidate = input as PermissionSettings;
		// 双端校验（同自定义服务商 / 联网搜索的做法）：设置页即时校验 + 这里防绕过。
		if (!isSandboxMode(candidate.sandbox)) {
			throw new Error(`未知的权限范围：${String(candidate.sandbox)}`);
		}
		if (!isApprovalPolicy(candidate.approval)) {
			throw new Error(`未知的审批策略：${String(candidate.approval)}`);
		}
		/*
		 * presetId 由旋钮反算，**不信任前端传来的值** ——
		 * 旋钮是真相（dsh 的 permission-presets 同一分工），
		 * 若前端传了个对不上的 id，界面就会显示成另一档，等于骗用户。
		 */
		const settings: PermissionSettings = {
			sandbox: candidate.sandbox,
			approval: candidate.approval,
			presetId: presetIdFor(candidate.sandbox, candidate.approval),
		};
		activePermissions = settings;
		// 读改写：偏好文件里还有模型选择与联网搜索配置，整存会清掉它们。
		writePreferences({ ...readPreferences(), permissions: settings });
		return buildPermissionInfo(settings);
	},

	/* ── 默认存储路径（工作空间根） ────────────────────────────────── */

	[INVOKE.getDefaultWorkspacePath]: async () => {
		// getter 现读偏好（不缓存）：设置页展示的生效根与下一次新任务用的根
		// 是同一份，不存在「界面显示 A、实际用 B」的窗口。
		const custom = readPreferences().defaultWorkspacePath;
		return {
			effective: getEffectiveWorkspaceRoot(),
			custom,
			isDefault: custom === undefined,
		};
	},

	[INVOKE.setDefaultWorkspacePath]: async ([path]) => {
		const trimmed = (path as string).trim();
		const preferences = readPreferences();
		if (trimmed === "") {
			// 空串 = 还原默认：清掉该键，回退到内置默认（读改写，不丢其他键）。
			const { defaultWorkspacePath: _dropped, ...rest } = preferences;
			writePreferences(rest);
		} else {
			// 合法性不在此拒：非绝对路径会被 getEffectiveWorkspaceRoot 忽略并回退，
			// 返回值里的 effective 如实告诉 UI 实际生效的是哪一层。
			writePreferences({ ...preferences, defaultWorkspacePath: trimmed });
		}
		// 全链路的根 getter（临时目录推导、空间列表）都现读偏好不缓存，
		// 所以新任务即刻用新根；已有会话的 cwd 不变（preferences.ts 注释的既定语义）。
		return { effective: getEffectiveWorkspaceRoot() };
	},

	/* ── 输入框补全数据源（@ 文件 + / 命令） ────────────────────────── */

	[INVOKE.completions]: async () => ({
		files: indexFiles(workspaceDir),
		commands: [
			// 技能：/skill:name 由 pi 的 prompt 自动展开（_expandSkillCommand），
			// renderer 只需把名字补全出来，原样传给 session.prompt 即可。
			...listSkills().map((s) => ({
				name: `skill:${s.name}`,
				description: s.description,
				source: "skill" as const,
			})),
			// 提示词模板：/模板名 由 pi 的 expandPromptTemplate 展开。
			// 发现目录必须与会话实际生效的一致 —— cwd 镜像 SessionHost 的取值
			//（临时任务模型下就是 workspaceDir 本身）。
			...listPromptTemplates(workspaceDir, getConfigDir()).map((t) => ({
				name: t.name,
				description: t.description,
				source: "template" as const,
			})),
			// 自有命令：daemon 在 INVOKE.prompt 里拦截执行（不经 pi），
			// 解析规则见 shared/builtin-commands.ts —— 两边必须一致。
			{ name: "new", description: "新建任务", source: "builtin" as const },
			{ name: "compact", description: "压缩上下文：总结历史，释放窗口", source: "builtin" as const },
			{ name: "plan", description: "计划模式：只读调研，先出计划再执行", source: "builtin" as const },
		],
	}),

	/* ── 工作空间 ───────────────────────────────────────────────────── */

	[INVOKE.workspaceSnapshot]: async () => ({
		current: workspaceDir,
		// 生效根现读（不缓存）：改默认存储路径后，空间列表即刻反映新根。
		defaultRoot: getEffectiveWorkspaceRoot(),
		workspaces: listWorkspaces(getEffectiveWorkspaceRoot()),
		previewBaseUrl: previewServer.baseUrl,
	}),

	[INVOKE.createWorkspace]: async ([name]) =>
		applyWorkspace(createWorkspace(getEffectiveWorkspaceRoot(), name as string)),

	[INVOKE.setWorkspace]: async ([path]) => applyWorkspace(path as string),

	[INVOKE.workspaceGroups]: async () => listWorkspaceGroups(),

	[INVOKE.workspaceRename]: async ([cwd, name]) => {
		const target = cwd as string;
		const trimmed = (name as string).trim();

		// siblings 取「用户眼里其他空间的名字」：显示名覆盖优先，没覆盖的用目录名。
		// 校验语义是界面上不许出现两个同名空间（validateDisplayName 注释同口径），
		// 与真实目录是否重名无关 —— 显示名只是覆盖表，不改目录。
		const groups = await listWorkspaceGroups();
		const resolvedTarget = resolve(target);
		const siblings = groups
			.filter((g) => resolve(g.cwd) !== resolvedTarget)
			.map((g) => g.displayName ?? basename(g.cwd));
		const error = validateDisplayName(trimmed, siblings);
		if (error !== undefined) throw new Error(error);

		setDisplayName(target, trimmed);
	},

	[INVOKE.workspaceRemove]: async ([cwd]) => {
		const target = cwd as string;
		const resolvedTarget = resolve(target);

		// 一份列表同时服务守卫与收集：listSessions 的 current 标记与 cwd
		// 都来自会话文件头部（磁盘真相），与组的派生口径一致。
		const sessions = await listSessions();

		// 当前任务所在空间拒删：宿主还持有该会话文件的活写者，移走后续写会失败，
		// 且用户正在看的对话会凭空消失（sessionDelete 拒删当前会话的同一理由）。
		// 判定按 header.cwd 而不是文件位置 —— 会话文件全部平铺在 sessions/ 下
		// （SessionManager.create 传的是显式 sessionDir），与空间目录没有位置关系。
		const current = sessions.find((s) => s.current);
		if (current !== undefined && resolve(current.cwd) === resolvedTarget) {
			throw new Error("这是当前任务所在空间，请先新建任务再移除");
		}

		for (const session of sessions) {
			if (session.isTempTask || resolve(session.cwd) !== resolvedTarget) continue;
			moveToTrash(session.path);
		}

		// 空间目录本身不动：里面可能有用户自己的文件，我们只管会话文件。
		removeDisplayName(target);
	},

	/**
	 * 只校验不执行：renderer 是半可信环境，「已知空间」的知识又只在 daemon
	 * （组由会话文件派生），所以校验放这里；真正的 shell.openPath 在 main 侧
	 * —— main 的本地 handler 先把本通道转发到这里，通过后才 openPath。
	 * 若不校验，任意网页/XSS 都能让 main 打开任意路径（~\.ssh、系统目录）。
	 */
	[INVOKE.workspaceReveal]: async ([cwd]) => {
		const resolvedTarget = resolve(cwd as string);
		const groups = await listWorkspaceGroups();
		if (!groups.some((g) => resolve(g.cwd) === resolvedTarget)) {
			throw new Error("不是已知的工作空间");
		}
	},

	/* ── 产物 ─────────────────────────────────────────────────────── */

	// 预览面板的文本读取。HTML 预览不走这里（走静态服务），这里管文本类。
	[INVOKE.readArtifact]: async ([path]) => readArtifactContent(path as string),

	/* ── 权限审批回程 ─────────────────────────────────────────────── */

	[INVOKE.permissionResponse]: async ([response]) => {
		const answer = response as PermissionResponse;
		const resolve = pendingApprovals.get(answer.id);
		// 找不到通常是重复应答（用户连点两下）。静默忽略即可，不是错误 ——
		// 也不落审计日志：那不是一次真实的选择，记上只会污染事后还原。
		if (resolve === undefined) return;
		pendingApprovals.delete(answer.id);
		// 以用户实际作出选择的位置为准落日志（而非 resolve 包装）：
		// 审计要的是「用户批了什么」，重复应答与悬空 id 都不算选择。
		eventLog.append({
			kind: "permission_response",
			id: answer.id,
			decision: answer.decision,
			remember: answer.remember === true,
		});
		resolve(answer);
	},

	/* ── pi 的 ctx.ui 桥：随需要落地 ──────────────────────────────── */

	// 权限弹窗走上面的自有通道（要展示工具入参、风险等级、「记住」选项，
	// ctx.ui.confirm 的纯文本承载不了）。这条通道留给将来扩展里真正用到
	// ctx.ui.select / input 的场景。
	[INVOKE.uiResponse]: async () => {
		throw new Error("暂无扩展使用 ctx.ui 交互通道");
	},
};

/**
 * 校验两轴的取值。
 *
 * 未实现的项（ready:false）仍在列表里显示 —— 那是对齐 WorkBuddy 的能力面，
 * 但真被选中时必须拒绝：静默接受会让用户以为切过去了，
 * 而实际提示词与工具集没变（AGENTS.md §7）。
 */
function requireReady(
	options: readonly ModeDescriptor[],
	id: string,
	kind: string,
): string {
	const found = options.find((o) => o.id === id);
	if (found === undefined) throw new Error(`未知${kind}：${id}`);
	if (!found.ready) throw new Error(`「${found.label}」${kind}还未实现`);
	return id;
}

/** 会话尚未建立时更新状态并推给 UI。会话建立后一律由 SessionHost 发权威状态。 */
function updateStateLocally(changes: Partial<SessionState>): void {
	emitSessionEvent({
		type: "session_state",
		state: { ...conversation.state, ...changes },
	});
}

/**
 * 交互模式切换的统一入口：setInteraction 通道与 /plan 内置命令都走这里。
 * 任何切到非 plan 模式的切换都刷新记忆 —— 用户从切换器切走后再发 /plan，
 * 回到的必须是刚切走的那个模式，而不是一条过时记忆。
 */
async function applyInteraction(id: string): Promise<void> {
	const readyId = requireReady(INTERACTIONS, id, "交互模式");
	if (readyId !== "plan") lastNonPlanInteraction = readyId;
	if (hostPromise === undefined) {
		updateStateLocally({ interactionId: readyId });
		return;
	}
	(await hostPromise).setInteraction(readyId);
}

async function dispatch(request: DaemonRequest): Promise<void> {
	// 每个请求记一行（终端 + 落盘）。daemon 没有界面，出问题时这是唯一的现场证据
	// （WorkBuddy 把「启动即可观测」列为 P0，同一个考虑）。
	// 只记通道名不记参数：参数里可能有 API Key（shared/ipc.ts 的 setApiKey 约定）。
	console.log(`← ${request.channel}`);
	eventLog.append({ kind: "ipc", channel: request.channel });

	const handler = handlers[request.channel];
	if (handler === undefined) {
		post({
			kind: "response",
			id: request.id,
			ok: false,
			error: `未知通道：${request.channel}`,
		});
		return;
	}
	try {
		const value = await handler(request.args);
		post({ kind: "response", id: request.id, ok: true, value });
	} catch (error) {
		// 只回一句给用户看的话；stack 留在 daemon 侧日志里（shared/daemon-protocol.ts 的约定）。
		const stack = error instanceof Error ? error.stack : undefined;
		if (stack !== undefined) console.error(stack);
		eventLog.append({
			kind: "ipc_error",
			channel: request.channel,
			message: error instanceof Error ? error.message : String(error),
			stack,
		});
		post({
			kind: "response",
			id: request.id,
			ok: false,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

parentPort.on("message", (message) => {
	const frame = message.data;
	if (!isDaemonRequest(frame)) {
		console.error(`收到无法识别的帧：${JSON.stringify(frame)}`);
		return;
	}
	void dispatch(frame);
});

/* ── 进程级崩溃取证 ───────────────────────────────────────────────── */

/*
 * 崩溃前的最后一条日志往往正是最需要的那条，所以这里同步落盘再退出
 * （EventLog 用同步 appendFileSync 就是为这个场景选的）。
 * 不吞异常：记完照样退出，让 main 的 PUSH.daemonDown 把「已断开」显示给用户
 * （AGENTS.md §7：让它响亮地失败）。
 */
process.on("uncaughtException", (error) => {
	eventLog.append({
		kind: "fatal",
		why: "uncaughtException",
		message: error.message,
		stack: error.stack,
	});
	console.error(error.stack ?? error.message);
	process.exit(1);
});

process.on("unhandledRejection", (reason) => {
	eventLog.append({
		kind: "fatal",
		why: "unhandledRejection",
		message: reason instanceof Error ? reason.message : String(reason),
		stack: reason instanceof Error ? reason.stack : undefined,
	});
	console.error(reason);
});

/* ── 启动 ─────────────────────────────────────────────────────────── */

function start(): void {
	// pi SDK 在模块顶部经 core/model-catalog.ts 静态导入，走到这里时已经加载完成。
	// Electron 内的 Node-API 兼容性已在 D2 实测确认（ARCHITECTURE.md §4.1），
	// 原先那段 dlopen 计数探针已移除 —— 静态导入先于模块体执行，钩子挂不上，
	// 读数恒为 0，留着只会误导人。
	console.log(
		`daemon 启动：node ${process.version} on ${process.platform}-${process.arch}`,
	);
	console.log(`配置目录：${getConfigDir()}`);
	eventLog.append({
		kind: "process",
		event: "daemon_start",
		node: process.version,
		platform: `${process.platform}-${process.arch}`,
	});

	// 初始工作区（共享临时目录）的预览服务。applyWorkspace / resumeSession 之外
	// 唯一一个换根点：启动时 workspaceDir 已是临时目录但还没有服务，不起服务
	// 则首个临时任务交付的 HTML 产物无法预览。失败不阻断启动 —— 预览是增强
	// 能力，聊天主链路不该被它拖死；记日志留现场。
	void previewServer.setRoot(workspaceDir).catch((error: unknown) => {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`预览服务启动失败：${message}`);
		eventLog.append({ kind: "ipc_error", channel: "preview:setRoot", message });
	});

	// 模型目录是懒加载的（见 getCatalog）：models.json 坏了应当在打开设置页时报错，
	// 而不是让 daemon 起不来、界面永久卡在「正在启动」。

	// 定时任务：库损坏在启动时暴露（store 契约：响亮报错不静默吞）；
	// 调度器 start 做启动恢复（过期 once 标 missed、周期任务重算下一次）并开 tick。
	automationStore.load();
	automationScheduler.start();

	post({ kind: "ready" });
}

try {
	start();
} catch (error) {
	// 启动失败不能静默：父进程会一直等 ready，UI 停在 loading。
	console.error("daemon 启动失败");
	console.error(
		error instanceof Error ? (error.stack ?? error.message) : String(error),
	);
	eventLog.append({
		kind: "fatal",
		why: "startup",
		message: error instanceof Error ? error.message : String(error),
		stack: error instanceof Error ? error.stack : undefined,
	});
	process.exit(1);
}
