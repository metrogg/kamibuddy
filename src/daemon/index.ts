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
import { ensureBuiltinMemoryTask } from "../core/builtin-memory-task.ts";
import {
	getConfigDir,
	getResourcesDir,
	getSessionsDir,
	getTempTasksDir,
	getWorkspaceDir,
} from "../core/config-paths.ts";
import { EventLog } from "../core/event-log.ts";
import { buildMemorySection, loadMemorySystemPrompt, profilePath } from "../core/memory.ts";
import { loadAgents } from "../core/agents.ts";
import { loadExperts, type ExpertDefinition } from "../core/experts.ts";
import {
	McpConfigError,
	readMcpConfig,
	readMcpConfigSource,
	toggleMcpServer,
	writeMcpConfig,
} from "../core/mcp-config.ts";
import { ModelCatalog } from "../core/model-catalog.ts";
import { estimateTokens, ObservabilityStore } from "../core/observability.ts";
import {
	getEffectiveWorkspaceRoot,
	readPreferences,
	writePreferences,
} from "../core/preferences.ts";
import { PreviewServers } from "../core/preview-server.ts";
import { buildPromptPreview } from "./prompt-preview.ts";
import {
	composePrompt,
	formatSkillsSection,
	requireExpertPersona,
	type ExpertPersona,
	type PromptContextOptions,
	type SkillDescriptor,
} from "../core/prompt-composer.ts";
import { DEFAULT_STYLE_ID, loadResources, resolveStyle, toDescriptors } from "../core/resources.ts";
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
import { conversationSearchExtensionFactory } from "../extensions/conversation-search-tool.ts";
import { createPermissionGate } from "../extensions/permission-gate.ts";
import { defaultProtectedDirs, isPathInside } from "../extensions/permission-policy.ts";
import { createProjectTrust } from "../extensions/project-trust.ts";
import { questionnaireExtensionFactory } from "../extensions/questionnaire-tool.ts";
import { powershellExtensionFactory } from "../extensions/powershell-tool.ts";
import { taskExtensionFactory } from "../extensions/task-tool.ts";
import { todoExtensionFactory } from "../extensions/todo-tool.ts";
import { visualizerExtensionFactory } from "../extensions/visualizer-tools.ts";
import {
	DEFAULT_PERMISSIONS,
	isApprovalPolicy,
	isSandboxMode,
	presetIdFor,
	type PermissionInfo,
	type PermissionSettings,
} from "../shared/permissions.ts";
import { createDocReadTool } from "../extensions/doc-read-tool.ts";
import { createDocxConvertTool } from "../extensions/docx-convert-tool.ts";
import { createMcpClient, type McpClientHandle } from "../extensions/mcp-client.ts";
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
import {
	createBucket,
	enqueue,
	pickEvictions,
	type SessionBucket,
} from "./session-registry.ts";
import type {
	DaemonOutbound,
	DaemonRequest,
} from "../shared/daemon-protocol.ts";
import { isDaemonRequest } from "../shared/daemon-protocol.ts";
import {
	INVOKE,
	PUSH,
	type AutomationSaveInput,
	type DocxEnvStatus,
	type McpConfigSnapshot,
	type PermissionRequest,
	type PermissionResponse,
	type ArtifactContent,
	type PathStat,
	type PromptPreviewRequest,
	type PromptRequest,
	type QuestionnaireRequest,
	type QuestionnaireResponse,
	type SessionSummary,
	type WorkspaceGroupMeta,
} from "../shared/ipc.ts";
import { nextRunAfter, validateSchedule } from "../shared/automation.ts";
import type { AutomationTask } from "../shared/automation.ts";
import {
	createEnvContext,
	defaultSpawn,
	ensureDocxEnv,
	inspectVenv,
	type EnvContext,
} from "../documents/docx-env.ts";
import {
	isWebSearchProviderId,
	type WebSearchConfigInfo,
	type WebSearchConfigInput,
	type WebSearchTestResult,
} from "../shared/settings.ts";
import { searchWeb } from "../core/web-search.ts";
import {
	isThinkingLevel,
	type ModeDescriptor,
	type SessionEvent,
	type SessionEventEnvelope,
	type SessionState,
} from "../shared/session-events.ts";
import type { CustomProviderInput, SkillInfo } from "../shared/settings.ts";
import { deriveContextUsageDetail } from "./context-usage-detail.ts";
import { deriveSessionTitle, searchSessionFiles } from "./conversation-search.ts";
import { createAutomationRunExecutor } from "./automation-runner.ts";
import { AutomationScheduler } from "./automation-scheduler.ts";
import { createSubagentRunner } from "./subagent-runner.ts";

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
 * 专家库（内置 resources/experts/ + 用户级 getConfigDir()/experts/ 同名覆盖）。
 *
 * 每次现载不缓存 —— 与 listSkills 同一口径：用户级新增/覆盖专家，
 * 下一次选择与下一轮 compose 即生效，无需重启。加载从紧（坏文件 /
 * 内置目录缺失直接抛错，见 core/experts.ts）；只有 expert 链路会调它，
 * 三模式的 compose 不走这条读路径。
 */
function loadExpertsNow(): readonly ExpertDefinition[] {
	return loadExperts(join(getResourcesDir(), "experts"), join(getConfigDir(), "experts"));
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
	expertId: string | undefined,
	piContext: PromptContextOptions,
): Promise<{ prompt: string; systemTokens: number; skillsTokens: number }> {
	const scene = RESOURCES.scenes.find((s) => s.id === sceneId);
	const mode = RESOURCES.modes.find((m) => m.id === interactionId);
	if (scene === undefined || mode === undefined) {
		throw new Error(`场景或交互模式不存在：${sceneId} / ${interactionId}`);
	}
	// expert 模式才解析人格：expertId 缺失 / 专家不在库中都在这里响亮抛错
	// （不可达防御的语义见 requireExpertPersona 注释）。三模式不碰专家库。
	const expert: ExpertPersona | undefined =
		interactionId === "expert" ? requireExpertPersona(loadExpertsNow(), expertId) : undefined;
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
	/*
	 * 回复风格每轮现读偏好（同技能清单的「现读」口径：设置页改完下一轮即生效，
	 * 无需重启）。三态：未配置 = 默认专业 / 空串 = 关闭 / 某 id = 指定。
	 * 指定 id 不在资源库 = 配置漂移（风格被改名/删除）—— resolveStyle 降级
	 * 默认风格，这里把漂移记进事件日志：降级可以是体验取舍，但不能无痕。
	 */
	const { style, driftedFrom } = resolveStyle(RESOURCES.styles, readPreferences().styleId);
	if (driftedFrom !== undefined) {
		eventLog.append({
			kind: "style_drift",
			requested: driftedFrom,
			fallback: style?.id ?? DEFAULT_STYLE_ID,
		});
	}
	// 记忆段每轮现读（同技能清单口径：模型用 edit 改了 MEMORY.md，下一轮即生效）。
	// 读取失败单份降级为空、不抛错 —— 记忆是增强不是门槛（core/memory.ts 文件头）。
	const memorySystemBody = loadMemorySystemPrompt(getResourcesDir());
	const memoryContent = buildMemorySection(cwd);
	const prompt = composePrompt({
		sceneBody: scene.body,
		modeBody: mode.body,
		skillsSection,
		cwd,
		modeId: interactionId,
		// 片段库查表：找不到返回 undefined → composer 抛错（不静默留洞上线）。
		resolveFragment: (name) => RESOURCES.fragments.get(name),
		...(style === undefined ? {} : { style: { id: style.id, body: style.body } }),
		...(memorySystemBody === undefined ? {} : { memorySystemBody }),
		...(memoryContent === undefined ? {} : { memoryContent }),
		...(expert === undefined ? {} : { expert }),
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
 * 新建任务的默认 cwd 来源（applyWorkspace 的唯一语义）。
 *
 * 多任务并发后「当前工作空间」不再等于「当前会话的 cwd」：会话与 cwd 终身
 * 绑定（cwd 在建会话时一次性注入 pi 的工具集），切换工作空间只决定**后续
 * 新建任务**落在哪，既有会话原地不动（WorkBuddy 同模型）。
 * 临时任务模型下必有值：默认 = 生效根下的共享临时目录（`<根>/临时任务`）。
 */
let defaultWorkspaceDir: string = tempTasksDir();

/**
 * 临时任务的共享目录。**现算不缓存**：生效根 = env > 设置项 > 内置默认
 * （getEffectiveWorkspaceRoot 每次现读偏好文件），用户改默认存储路径后，
 * 下一次新建/切换临时任务即刻用新根。
 */
function tempTasksDir(): string {
	return getTempTasksDir(getEffectiveWorkspaceRoot());
}

/**
 * docx 引擎环境上下文（ensure / 预热 / 诊断探测共用同一个三元组）。
 * 现算不缓存：KAMIBUDDY_RESOURCES_DIR 等 env 覆盖在测试与多环境下可换。
 */
function docxEnvContext(): EnvContext {
	return createEnvContext(join(getResourcesDir(), "docx-engine"), homedir(), process.platform);
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
 * 全新会话的初始视图（ pristine 桶的 conversation）。
 * 用 shared 的 reducer 折叠，与渲染进程**同一份实现** —— 各写一份会漂移，
 * 症状是「重开界面后内容变了」，极难排查（shared/conversation.ts 的注释）。
 *
 * daemon 每会话折叠一份（注册表桶持有），渲染进程重新挂载时按 sessionId
 * 经 snapshot 拉回对应会话的完整历史。
 */
function freshConversation(
	cwd: string,
	sceneId: string,
	interactionId: string,
	expertId?: string,
): ConversationView {
	return {
		state: {
			sessionId: "",
			// 启动即临时任务：cwd 是共享临时目录（真实路径），不再是「无目录」。
			cwd,
			isTempTask: isTempCwd(cwd),
			sceneId,
			interactionId,
			// 仅 expert 模式有值（沿用旧会话选择时带过来）；三模式缺省不占字段。
			...(expertId === undefined ? {} : { expertId }),
			modelId: activeModelKey,
			isStreaming: false,
		},
		entries: [],
		availableScenes: SCENES,
		availableModes: INTERACTIONS,
		cancelledTurns: [],
		artifacts: [],
	};
}

/* ── 会话注册表（多任务并发核心，纯逻辑在 session-registry.ts） ────── */

/**
 * 已注册会话桶：sessionId → 桶。 pristine 桶（宿主未建、sessionId 未定）
 * 不入表，只被 currentBucket 持有 —— 它没有文件、没有历史，切走即丢弃。
 */
const bucketsById = new Map<string, SessionBucket<SessionHost>>();

/**
 * 当前会话指针。指向桶而不是 sessionId：pristine 桶还没有 id，
 * 但已经是「用户正在看的会话」，必须可被指针表达。
 */
let currentBucket: SessionBucket<SessionHost> = createBucket({
	cwd: defaultWorkspaceDir,
	conversation: freshConversation(defaultWorkspaceDir, "work", "craft"),
});

/** 按会话文件查注册表（resume/rename/delete/export 守「同文件单写者」不变式）。 */
function findBucketByFile(path: string): SessionBucket<SessionHost> | undefined {
	const resolved = resolve(path);
	for (const bucket of bucketsById.values()) {
		if (bucket.sessionFilePath !== undefined && resolve(bucket.sessionFilePath) === resolved) {
			return bucket;
		}
	}
	return undefined;
}

/**
 * 切换当前会话指针。被切走的 pristine 桶随之丢弃（无宿主无历史，
 * 没有任何可保留的现场）；其余旧桶留在注册表里后台保活。
 * 每次指针变更都可能让旧当前桶变成可回收的空闲桶，顺手检查一轮。
 */
function setCurrentBucket(bucket: SessionBucket<SessionHost>): void {
	currentBucket = bucket;
	bucket.lastUsedAt = Date.now();
	evictIdleHosts();
}

/** 空闲宿主 LRU 回收：dispose + 出表。历史在 JSONL，resume 可完整重开。 */
function evictIdleHosts(): void {
	for (const bucket of pickEvictions(bucketsById.values(), currentBucket)) {
		bucketsById.delete(bucket.sessionId);
		// pickEvictions 已排除 pristine（无 hostPromise）与 running / 审批待答 /
		// 链上有活的桶 —— 这里拿到的必然是空闲宿主，dispose 不会杀到任何 run。
		const hostPromise = bucket.hostPromise;
		if (hostPromise === undefined) continue;
		eventLog.append({ kind: "session_evicted", sessionId: bucket.sessionId });
		// 已注册桶的 hostPromise 必然已 resolve（adoptHost 赋的 Promise.resolve(host)），
		// dispose 在紧随的微任务里同步完成；任何后续 resume 走 IPC 消息（更晚的
		// 宏任务），到得了 SessionManager.open 时旧宿主必已销毁 —— 无双写窗口。
		void hostPromise.then((host) => host.dispose());
	}
}

/* ── 可观测性 ─────────────────────────────────────────────────────── */

/**
 * 结构化事件日志（JSONL 落盘）+ 诊断页统计聚合。
 *
 * daemon 没有界面，console 只打到终端，终端一关现场就没了——
 * 这两件是「出问题时唯一的现场证据」（WorkBuddy 把启动即可观测列为 P0）。
 * 聚合口径是进程内累计，不做历史持久化（core/observability.ts 的注释）。
 *
 * 多任务并发后口径不变：**进程级聚合，不按会话分桶**（spec：
 * support-concurrent-tasks E —— 诊断页看的是「daemon 整体花了多少」，
 * 按会话拆桶的收益不抵复杂度，YAGNI）。
 */
const eventLog = new EventLog(join(getConfigDir(), "logs"));
const observability = new ObservabilityStore();

/**
 * 产物预览静态服务池：按 cwd 多实例（每 cwd 一个端口，懒建，
 * core/preview-server.ts 的注释是安全契约与回收决策）。
 * 会话切走不再断预览 —— 旧根的服务继续跑。
 */
const previewServers = new PreviewServers();

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
		// 定时任务 run 会话保持 work+craft 不起专家（spec: add-expert-mode ——
		// 专家选择是会话级 UI 状态，无人值守会话没有人格入口），expertId 恒 undefined。
		compose: async (cwd, sceneId, interactionId, piContext) =>
			(await composeSystemPrompt(cwd, sceneId, interactionId, undefined, piContext)).prompt,
		getPermissions: () => activePermissions,
		// 全局默认推理强度现读偏好不缓存：run 会话建宿主才走这条读路径，
		// 不在热路径上（与 activePermissions 的模块级缓存不同 —— 那个每次
		// 工具调用都要读）。用户在设置页改完，下一次 run 即刻生效。
		getThinkingLevel: () => readPreferences().thinkingLevel,
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
 * 读产物文件内容（readArtifact 通道）。路径限**当前会话**的工作区内：
 * 相对路径对该会话 cwd resolve；绝对路径必须落在其内——
 * 预览面板能看的文件与权限门放行的写范围必须同界（配置目录里的密钥
 * 绝不能经这条通道被读出来）。
 */
function readArtifactContent(path: string): ArtifactContent {
	const cwd = currentBucket.cwd;
	const abs = resolve(cwd, path);
	if (abs !== cwd && !abs.startsWith(cwd + sep)) {
		throw new Error("路径超出当前工作区");
	}
	const stat = statSync(abs); // 不存在让 ENOENT 直接抛给调用方（响亮失败）
	const size = stat.size;
	if (size > ARTIFACT_TEXT_MAX) return { size, text: undefined };
	const buf = readFileSync(abs);
	if (buf.includes(0)) return { size, text: undefined }; // NUL = 二进制
	return { size, text: buf.toString("utf8") };
}

/**
 * 路径存在性探测（statPath 通道）：对话正文行内 code 路径徽章的高亮依据。
 * 与 readArtifact 不同界 —— 它只报存在性与类型、不报内容，所以不套工作区
 * 边界：徽章要服务工作区外的路径（如 Downloads 里的附件）；读内容仍由
 * readArtifact / preview-server 的边界把守，工作区外文件点击后落外部打开。
 * 相对路径按当前会话 cwd resolve（WorkBuddy resolveConversationFilePath 同口径）。
 */
function statArtifactPath(path: string): PathStat {
	const abs = resolve(currentBucket.cwd, path);
	try {
		return { kind: statSync(abs).isDirectory() ? "directory" : "file" };
	} catch {
		// 探测的意义就是回答「在不在」——不存在/不可达都是 missing，不是错误。
		return { kind: "missing" };
	}
}

function emitSessionEvent(bucket: SessionBucket<SessionHost>, event: SessionEvent): void {
	// 折叠进**该会话**的桶：多任务并发后后台会话的事件不能污染当前视图
	//（renderer 按信封 sessionId 折叠进各自的缓存，daemon 侧同口径）。
	bucket.conversation = conversationReducer(bucket.conversation, { type: "event", event });
	// 运行态以折叠结果为准（reducer 在 run 边界与 session_state 上维护 isStreaming，
	// 宿主又是从自家 run 记账算的 —— 两条路径同一个真相，取折叠值不另开口径）。
	bucket.running = bucket.conversation.state.isStreaming;
	observability.record(event);
	eventLog.append({
		kind: "session_event",
		sessionId: bucket.sessionId,
		event: sanitizeForLog(event),
	});
	const envelope: SessionEventEnvelope = { sessionId: bucket.sessionId, event };
	post({ kind: "push", channel: PUSH.sessionEvent, payload: envelope });

	// run 边界推全量任务列表：侧栏的 running 标记靠它即时刷新（契约见 shared/ipc.ts）。
	if (event.type === "run_started" || event.type === "run_finished") {
		pushTaskListChanged();
		if (event.type === "run_finished") evictIdleHosts();
	}

	// 带用量的 session_state 到达后补发明细：used/total 是 pi 的精确值（刚折叠进
	// 桶的 conversation.state），分类所需的系统提示词/技能段 token 只有这里知道。
	// context_usage 自身不会再触发本分支，无递归。
	if (event.type === "session_state" && event.state.contextUsage !== undefined) {
		emitContextUsageDetail(bucket, event.state.contextUsage);
	}
}

/** 组装并发出上下文用量明细（分类是估算值，UI 必须标注，见 shared/context-usage.ts）。 */
function emitContextUsageDetail(
	bucket: SessionBucket<SessionHost>,
	contextUsage: { usedTokens: number; maxTokens: number },
): void {
	const usage = deriveContextUsageDetail({
		entries: bucket.conversation.entries,
		contextUsage,
		systemPromptTokens: bucket.systemPromptTokens,
		skillsTokens: bucket.skillsTokens,
	});
	if (usage === undefined) return;
	emitSessionEvent(bucket, { type: "context_usage", usage });
}

/**
 * 任务列表变更的统一推送（全量，契约理由见 shared/ipc.ts 的 PUSH.taskListChanged）。
 * daemon 是列表真相的持有者：run 边界、会话增删改都从这里推，renderer 不拉。
 */
function pushTaskListChanged(): void {
	void listSessions().then(
		(sessions) => {
			post({ kind: "push", channel: PUSH.taskListChanged, payload: sessions });
		},
		(error: unknown) => {
			// 推送失败不致命（列表下次变更还会推），但现场必须留（AGENTS.md §7）。
			const message = error instanceof Error ? error.message : String(error);
			console.error(`任务列表推送失败：${message}`);
			eventLog.append({ kind: "ipc_error", channel: PUSH.taskListChanged, message });
		},
	);
}
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

/**
 * 取桶的真值 sessionId（问卷/审批请求的注入值）。
 *
 * 问卷与审批只在 run 期间产生，此时宿主已 adopt（getHost 建成即注册），
 * 桶 id 恒为真值；空串说明 adopt 顺序变了 —— 按 AGENTS.md §7 响亮抛错，
 * 不向 renderer 推空 id 误导归属路由。
 */
function adoptedSessionId(bucket: SessionBucket<SessionHost>): string {
	if (bucket.sessionId === "") {
		throw new Error("问卷/审批请求的桶 sessionId 为空：宿主尚未 adopt，adopt 顺序已变");
	}
	return bucket.sessionId;
}

function requestApproval(
	request: Omit<PermissionRequest, "id" | "sessionId">,
	sessionId: string,
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
			payload: { id, sessionId, ...request },
		});
	});
}

/* ── 结构化提问（questionnaire 工具）：daemon 发问 → 渲染进程作答 ──────── */

/**
 * 在途的问卷请求。与审批同语义（见 pendingApprovals 注释）：
 * 工具的 execute 被 await 挂住直到用户作答或整卡跳过，无超时。
 *
 * 挂起期间的回收豁免由接线处维护（createHost 里按桶计数 pendingApprovals，
 * 问卷与审批共用同一个豁免计数 —— 用户在答的框不能随宿主一起消失），
 * 所以这里不需要单宿主时代 resetSession 的「会话作废拒掉全部在途」兜底：
 * 桶只要还有未答问卷就不会被 LRU 回收，答案始终送得到。
 */
const pendingQuestionnaires = new Map<
	string,
	{
		resolve: (response: QuestionnaireResponse) => void;
		reject: (error: Error) => void;
	}
>();

function requestQuestionnaireAnswers(
	request: QuestionnaireRequest,
): Promise<QuestionnaireResponse> {
	/*
	 * id 用工具生成的那一个（questionnaire-tool 的契约：id 由工具生成后传入），
	 * 不许在这里另发 —— 曾经另发并按 { id, ...request } 推 payload，展开时
	 * request.id 把新 id 盖掉：renderer 按工具 id 应答，在 pendingQuestionnaires
	 * （键是另发的 id）里查无此项被静默丢弃，工具 execute 永久悬挂，
	 * 用户看到工具卡永远「正在处理」（2026-09-10 实踩，日志里
	 * questionnaire_request 之后没有 questionnaire_response 就是它）。
	 */
	eventLog.append({
		kind: "questionnaire_request",
		id: request.id,
		questionCount: request.questions.length,
	});
	return new Promise<QuestionnaireResponse>((resolve, reject) => {
		pendingQuestionnaires.set(request.id, { resolve, reject });
		post({
			kind: "push",
			channel: PUSH.questionnaireRequest,
			payload: request,
		});
	});
}

/* ── MCP 连接器 ───────────────────────────────────────────────────── */

/**
 * 各会话桶的 MCP 连接器 handle（建宿主时随扩展一起组装）。
 *
 * 每桶一个：不同会话的 cwd 不同，项目级 .mcp.json 是各自工作区的配置。
 * WeakMap 键随桶回收自然失效；宿主 dispose 时扩展 teardown 断开连接，
 * handle 同步死亡 —— 不需要手动清理。
 * MCP 设置的 IPC handler 经它查运行态（当前桶）与触发热重载（全部活桶）。
 */
const mcpHandleByBucket = new WeakMap<SessionBucket<SessionHost>, McpClientHandle>();

/**
 * MCP 配置编辑的目标层级：当前会话是正式工作区 → 项目级 <工作区>/.mcp.json；
 * 临时任务 → undefined（写用户级 ~/.kamibuddy/mcp.json）——
 * 共享临时目录是所有临时任务共用的 cwd，往里落配置文件会串味到别的任务。
 */
function mcpEditCwd(): string | undefined {
	return isTempCwd(currentBucket.cwd) ? undefined : currentBucket.cwd;
}

/** 全部活桶的 MCP handle（配置变更时热重载：后台会话不该留在旧配置上）。 */
function liveMcpHandles(): McpClientHandle[] {
	const handles: McpClientHandle[] = [];
	const collect = (bucket: SessionBucket<SessionHost>): void => {
		const handle = mcpHandleByBucket.get(bucket);
		if (handle !== undefined && !handles.includes(handle)) handles.push(handle);
	};
	collect(currentBucket);
	for (const bucket of bucketsById.values()) collect(bucket);
	return handles;
}

/* ── 子代理（task 工具） ──────────────────────────────────────────── */

/**
 * 子代理执行器，进程级单例。
 *
 * 单例而非随 createHost 重建：并发闸（同时最多 4 个）要管住的是整机压力，
 * 不是单会话；在途子代理表也要在宿主之外够得到。deps 全是 getter，cwd 随
 * 每次调用传入，所以跨会话复用没有任何状态残留。
 *
 * 中断传播按会话隔离：主会话 abort → pi 断 task 工具 execute 的 signal →
 * 杀该会话的子代理（subagent-runner 的 signal 接线），所以 INVOKE.abort 不再
 * 调 abortAll —— 多任务并发下 abortAll 会误杀后台会话的子代理。
 */
const subagentRunner = createSubagentRunner({
	getCatalog,
	getModelKey: () => activeModelKey,
	resources: RESOURCES,
	getPermissions: () => activePermissions,
	// 全局默认推理强度（现读偏好，理由同 automation 装配处）：子代理会话
	// 每次新建、逐会话还原不适用，全局默认即口径。
	getThinkingLevel: () => readPreferences().thinkingLevel,
	protectedDirs: PROTECTED_DIRS,
	isTempCwd,
	isOwnWorkspace: (dir) =>
		isPathInside(getEffectiveWorkspaceRoot(), dir) || isPathInside(getConfigDir(), dir),
	getWebSearchConfig,
	/*
	 * 子代理审批的归属：subagentRunner 是进程级单例、无桶上下文，拿不到
	 * 发起它的会话 id —— 传空串，渲染层把空串当「全局」（badge 不落任何行、
	 * 弹窗全局），不推会误导归属的假 id。已知近似：子代理审批占少数，
	 * 待 subagent-runner 带桶上下文后再精确化。
	 */
	requestApproval: (request) => requestApproval(request, ""),
});

/**
 * 懒建宿主。第一次发消息时才创建 —— 建会话需要一个可用模型，
 * 而用户可能先打开应用、再去设置里填 Key。
 *
 * 沿用旧 hostPromise 的缓存语义，只是从单例升级为按桶：同一桶只建一次，
 * 并发取宿主拿到同一个 promise；失败的 promise 不缓存（清回 undefined），
 * 用户配好模型后重试才有效。
 *
 * 建成即 adoptHost 注册（pristine 桶唯一的注册点，resume/saveToWorkspace
 * 有自己的注册路径）：不入表则信封 sessionId 全程空串、listSessions 的
 * current/running 标不上、resume 同一文件还会开出第二个宿主
 * （同文件双写禁区）（2026-09-10 实踩：并发版首日这个注册点就缺失）。
 */
function getHost(bucket: SessionBucket<SessionHost>): Promise<SessionHost> {
	if (bucket.hostPromise === undefined) {
		const attempt = createHost(bucket).then((host) => {
			adoptHost(bucket, host);
			return host;
		});
		bucket.hostPromise = attempt;
		attempt.catch(() => {
			if (bucket.hostPromise === attempt) bucket.hostPromise = undefined;
		});
	}
	return bucket.hostPromise;
}

/**
 * 宿主建好后的注册：赋 sessionId / 文件路径、入注册表、推权威状态。
 *
 * 顺序敏感：必须先赋 sessionId 再发 session_state —— 事件信封的路由键
 * 取桶的 sessionId（emitSessionEvent），顺序反了这次事件会打着空 id 上路。
 */
function adoptHost(bucket: SessionBucket<SessionHost>, host: SessionHost): void {
	bucket.hostPromise = Promise.resolve(host);
	bucket.sessionId = host.state.sessionId;
	bucket.sessionFilePath = host.sessionFilePath;
	bucketsById.set(bucket.sessionId, bucket);
	bucket.lastUsedAt = Date.now();
	// 会话建好后 sessionId / cwd 才有真值，推一次让 UI 同步。
	emitSessionEvent(bucket, { type: "session_state", state: host.state });
	evictIdleHosts();
}

/**
 * 组装会话宿主的唯一入口。恢复历史会话时传入 open 出来的 SessionManager，
 * 其余（扩展、两轴、权限门、预览、当前模型选择）与新会话完全一致 ——
 * 恢复会话不改模型选择与权限设置（spec 决策）。
 *
 * 扩展工厂的闭包 getter 全部读**所属桶**（模式 / cwd / 产物出口），
 * 只有全局设置（模型、权限档）读模块级 —— 两个并发会话的模式与
 * 工作目录不会张冠李戴（spec：support-concurrent-tasks A）。
 *
 * 本函数不发事件：sessionId 要建好后才有真值，由调用方 adoptHost 统一注册。
 */
async function createHost(
	bucket: SessionBucket<SessionHost>,
	sessionManager?: SessionManager,
): Promise<SessionHost> {
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

	// 会话与 cwd 终身绑定：桶在建任务/恢复时定好 cwd，这里只读取。
	// 建会话前确保目录存在（SessionHost.create 里也会 mkdir，
	// 但权限门要先拿到一个已确定存在的目录）。
	const cwd = bucket.cwd;
	mkdirSync(cwd, { recursive: true });

	/*
	 * 子代理定义随会话现载（不是进程级单例）：agents 是用户可覆盖的数据
	 * （~/.kamibuddy/agents/ 同名覆盖内置），编辑后新会话生效，无需重启应用
	 * （与技能清单同一哲学）。内置目录缺失/为空是打包错误，在这里抛出让
	 * 建会话响亮失败（agents 只挂在 task 工具链上，一次坏文件不该杀掉
	 * 整个进程）。
	 */
	const agents = loadAgents(join(getResourcesDir(), "agents"), join(getConfigDir(), "agents"));

	/*
	 * MCP 连接器：读 mcp.json（用户级 + 项目级）连 MCP server，
	 * 工具以 mcp__<server>__<tool> 注册。连接失败的 server 不阻塞会话
	 * （扩展内部降级 + 日志）。未配置 mcp.json 时零开销秒退。
	 * handle 按桶登记（mcpHandleByBucket）：MCP 设置的 IPC handler 经它
	 * 查运行态与热重载；宿主 dispose 时扩展 teardown 断开连接，handle 同步失效。
	 */
	const mcpClient = createMcpClient({ cwd });

	/*
	 * 推理强度初始档，**仅全新会话**（无 sessionManager）注入：
	 * 会话内已选档（pristine 桶经 setThinkingLevel 记档）优先于全局默认
	 *（preferences.thinkingLevel）；都未配置时不带该键，pi 走自己的
	 * medium 默认链。
	 * resume / saveToWorkspace 重建路径（带 sessionManager）绝不传 ——
	 * pi 的 options.thinkingLevel 优先级高于会话文件里的
	 * thinking_level_change 条目，传了会毁掉逐会话还原
	 *（core/session-host.ts 该选项的同源注释）。
	 * 档位现读偏好不缓存：建宿主才走这条读路径，不在热路径上
	 *（与 activePermissions 的模块级缓存不同，那个每次工具调用都要读）。
	 */
	const initialThinkingLevel =
		sessionManager === undefined
			? (bucket.conversation.state.thinkingLevel ?? readPreferences().thinkingLevel)
			: undefined;

	const host = await SessionHost.create({
		catalog,
		modelKey: activeModelKey,
		cwd,
		isTempTask: isTempCwd(cwd),
		sceneId: bucket.conversation.state.sceneId,
		interactionId: bucket.conversation.state.interactionId,
		// expert 模式的绑定随两轴一起进宿主（resume/newTask 沿用口径与两轴相同）。
		...(bucket.conversation.state.expertId === undefined
			? {}
			: { expertId: bucket.conversation.state.expertId }),
		emit: (event) => emitSessionEvent(bucket, event),
		resources: RESOURCES,
		...(sessionManager === undefined ? {} : { sessionManager }),
		...(initialThinkingLevel !== undefined ? { thinkingLevel: initialThinkingLevel } : {}),
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
					// 内置资源只读放行（技能渐进加载全靠 read 这里）。
					resourcesDir: getResourcesDir(),
				},
				cwd,
				// getter 而非快照：用户改了预设，下一次工具调用即生效。
				// 权限档是全局设置（spec A）：一改对所有会话的后续工具调用生效。
				getSettings: () => activePermissions,
				// 审批按桶计数：有待答审批的桶豁免 LRU 回收 ——
				// 用户在答的框不能随宿主一起消失。
				// sessionId 在此注入（唯一注入点）：审批归属发起它的会话桶，
				// 渲染层按它路由与归属「待确认」badge。
				requestApproval: (request) => {
					const sessionId = adoptedSessionId(bucket);
					bucket.pendingApprovals += 1;
					return requestApproval(request, sessionId).finally(() => {
						bucket.pendingApprovals -= 1;
						evictIdleHosts();
					});
				},
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
				getWorkspaceDir: () => bucket.cwd,
				onPresent: ({ files, focusFile }) => {
					emitSessionEvent(bucket, { type: "artifacts_presented", files, focusFile });
					// 产物清单持久化到会话文件（appendCustomEntry），恢复历史会话时
					// buildConversationEntries 把它翻译回 artifacts_presented 事件，
					// 产物卡与交付时状态一致。
					const hostPromise = bucket.hostPromise;
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
			// 两轴与 expert 绑定的权威状态读**所属桶**的折叠镜像；技能段取自宿主的 loader 发现结果。
			createPromptSwitch({
				getCurrent: () => ({
					sceneId: bucket.conversation.state.sceneId,
					interactionId: bucket.conversation.state.interactionId,
					expertId: bucket.conversation.state.expertId,
				}),
				compose: async (sceneId, interactionId, expertId, piContext) => {
					const composed = await composeSystemPrompt(cwd, sceneId, interactionId, expertId, piContext);
					// 成分统计的 system 部分从这里取——只有这里见过组装完的真身。
					// 技能段单独记一份：上下文用量明细要把「技能」从系统提示词里拆出来单列。
					// 记进所属桶：并发会话各组各的提示词，token 估算不互相覆盖。
					bucket.systemPromptTokens = composed.systemTokens;
					bucket.skillsTokens = composed.skillsTokens;
					return composed.prompt;
				},
			}),
			// 联网工具：所有会话都装。
			// 配置读偏好文件；权限门里 web_search/web_fetch 已登记放行，不再弹窗。
			createWebTools({ getSearchConfig: getWebSearchConfig }),
			// 结构化提问：所有用户会话都装（三模式白名单都含 questionnaire）。
			// 阻塞等答走上面的 pendingQuestionnaires，与审批同一套挂起/应答语义，
			// 豁免计数也共用（pendingApprovals：用户在答的框不随宿主被 LRU 回收）；
			// 权限门登记放行（不触文件系统，见 permission-policy 的 READ_ONLY）。
			questionnaireExtensionFactory({
				// sessionId 在此注入（唯一注入点）：问卷归属发起它的会话桶，
				// 渲染层按它路由（只在查看该会话时上屏）与归属「待确认」badge。
				requestAnswers: (request) => {
					const sessionId = adoptedSessionId(bucket);
					bucket.pendingApprovals += 1;
					return requestQuestionnaireAnswers({ ...request, sessionId }).finally(() => {
						bucket.pendingApprovals -= 1;
						evictIdleHosts();
					});
				},
			}),
			/*
			 * 历史会话检索（四模式白名单都含 conversation_search）：只读工具，
			 * 权限门登记放行（读的是 KamiBuddy 自己的会话库，与 automation_list 同档）。
			 * 只挂用户会话 —— 定时任务 run 会话（automation-runner）不注册：
			 * 无人值守下没有「用户回忆上次讨论」的场景（v1 从简）。
			 * excludeSessionId 读桶的当前 id：闭包在工具**调用时**才求值，
			 * pristine 桶 adopt 后拿到的就是真值。
			 */
			conversationSearchExtensionFactory({
				searchSessions: (query, limit) =>
					searchSessionFiles(query, limit, {
						sessionsDir: getSessionsDir(),
						...(bucket.sessionId === "" ? {} : { excludeSessionId: bucket.sessionId }),
					}),
			}),
			// shell 能力：craft 白名单含 powershell。命令先过工具层危险命令检查器，
			// 权限门另管「要不要问人」（balanced 高风险询问、read-only 拒，
			// 见 permission-policy 的 SHELL 分支）——门与检查器是两道独立防线。
			powershellExtensionFactory(),
			// 文档读取：所有会话都装。read_document 已登记权限门只读工具
			// （与 read 同语义），区外读取走通用的低风险询问，这里无需额外接线。
			createDocReadTool(),
			/*
			 * docx 生成：craft 白名单含 docx_convert，所有用户会话都装。
			 * 转换是 daemon 进程内受控 spawn venv python（命令与参数写死在
			 * documents/docx-convert.ts），不经 agent 的 powershell 自由 shell ——
			 * 这是「转换调用受控」的落点（spec Requirement）。权限按「写工作区
			 * 产物文件」档：写侧判定锚定 outputPath（permission-policy 的 MUTATING）。
			 */
			createDocxConvertTool({
				engineDir: join(getResourcesDir(), "docx-engine"),
				homeDir: homedir(),
			}),
			// 内联可视化（read_me + show_widget）：无副作用、无用户交互，
			// 所有用户会话注册（run 会话的 widget 随历史可见）。
			visualizerExtensionFactory(),
			// MCP 连接器（handle 按桶登记，见上方 mcpClient 的注释）。
			mcpClient.extension,
			// 对话内 automation 工具（craft 白名单）：模型在对话里建/查/删定时任务。
			// cwd 缺省取**所属会话**的 cwd —— 会话与 cwd 终身绑定，读桶即真相。
			automationExtensionFactory(automationStore, () => bucket.cwd),
			/*
			 * 待办清单（craft/expert 白名单含 todo_write）：无副作用、无用户交互，
			 * 所有用户会话注册。工具本体只是载体 —— 清单状态由 renderer 从消息流
			 * 聚合，历史恢复靠消息回放（见 extensions/todo-tool.ts 文件头）。
			 */
			todoExtensionFactory(),
			/*
			 * 子代理委派（craft 白名单）：只挂在用户会话——定时任务 run 会话
			 * （automation-runner）不注册 task（无人值守下的递归委派明确不做）。
				 * cwd 在此注入：子代理与主会话同一工作空间，产物落在用户看得见的地方。
				 * spawn 预算按桶计（session-registry 的 SPAWN_BUDGET_PER_SESSION）：
				 * 换桶即新预算，saveToWorkspace 原地换 cwd 不换桶、不复位。
				 */
			taskExtensionFactory({
				runSubagent: (request) => subagentRunner.run({ ...request, cwd }),
				listAgents: () => agents,
				checkBudget: () => {
					if (bucket.spawnBudgetRemaining <= 0) return false;
					bucket.spawnBudgetRemaining -= 1;
					return true;
				},
			}),
		],
	});

	mcpHandleByBucket.set(bucket, mcpClient);
	return host;
}

/**
 * 切换工作空间 = 只改「新建任务的默认 cwd 来源」（spec MODIFIED：工作空间切换语义）。
 *
 * 不再作废旧会话：既有会话 cwd 终身绑定，旧宿主留在注册表里后台保活，
 * 其 run 不受切换影响（WorkBuddy 同模型）。空串表示「临时任务」
 * （共享临时目录，新建任务的默认态）。
 *
 * 安全前提：工作空间内的写操作会被权限门直接放行，所以「设为哪个目录」
 * 必须先过 validateWorkspacePath（配置目录 / 应用目录一律拒，见 core/workspace.ts）。
 * 临时目录是自家构造（生效根下），不过这道校验 —— 同 getEffectiveWorkspaceRoot
 * 的回退语义，非法根在那一层已被忽略。
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
	mkdirSync(next, { recursive: true });
	defaultWorkspaceDir = next;

	// 多根预览池：按 cwd 各起一个实例，不再关旧根。仍 await —— 服务起不来时
	// 工作区切换应该响亮失败（沿用旧 setRoot 的口径），而不是带病继续。
	await previewServers.ensure(next);

	// 既有会话一律不动。唯一例外：pristine 桶（还没建宿主、没有任何历史）
	// 换绑到新默认空间 —— 它还不算「一个既有会话」，用户切完空间发首条消息
	// 理应落在新空间，而不是旧默认目录。
	if (currentBucket.hostPromise === undefined && currentBucket.cwd !== next) {
		currentBucket.cwd = next;
		updateStateLocally(currentBucket, { cwd: next, isTempTask: isTempCwd(next) });
	}
	return next;
}

/* ── 历史会话管理（list / resume / rename / delete） ────────────── */

/** 只容忍「目录不存在」：首次使用还没有 sessions 目录是正常情况，列表为空。 */
function isEnoent(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		(error as { code?: unknown }).code === "ENOENT"
	);
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
	// 会话文件 → 注册表桶：current / running 都以桶为准（daemon 是运行态真相，
	// 后台会话的 run 也要在列表上可见 —— 不再只有当前会话可能 running）。
	const byFile = new Map<string, SessionBucket<SessionHost>>();
	for (const bucket of bucketsById.values()) {
		if (bucket.sessionFilePath !== undefined) {
			byFile.set(resolve(bucket.sessionFilePath), bucket);
		}
	}
	return infos
		.map((info): SessionSummary => {
			const bucket = byFile.get(resolve(info.path));
			return {
				id: info.id,
				path: info.path,
				title: deriveSessionTitle(info.name, info.firstMessage),
				name: info.name,
				cwd: info.cwd,
				// 任务区判定收在 isTempCwd 一处（临时目录 / 生效根本身 / 旧 playground 占位）。
				isTempTask: isTempCwd(info.cwd),
				createdAt: info.created.getTime(),
				modifiedAt: info.modified.getTime(),
				messageCount: info.messageCount,
				current: bucket !== undefined && bucket === currentBucket,
				running: bucket?.running ?? false,
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
 * 恢复历史会话为当前活动会话。
 *
 * 多任务并发后语义简化：**不再作废旧会话** —— 旧宿主留在注册表里后台
 * 保活（spec B：切换语义翻转）。编排为：查注册表 →（未注册时）验证 →
 * 建桶建宿主 → 重建桶内历史 → 切指针。
 *
 * 同文件单写者不变式：已注册的会话**绝不 open 第二个宿主**（pi 的
 * SessionManager 各自缓存 entries，同文件双写者互相覆盖），命中注册表
 * 直接切指针返回 —— 视图由 renderer 的 snapshot 重拉与既有事件缓存供给。
 *
 * 失败原子性：open / header 校验 / 工作目录校验全部在建宿主之前完成，
 * 失败时旧会话（宿主、历史、工作空间默认值、预览服务）毫发无损；
 * 建宿主失败时桶未注册、指针未切，等价于没动过。
 *
 * 与旧 resetSession 模型的差别：**不发 history_reset**。renderer 在 resume
 * 返回后按会话重拉 snapshot 整体替换该会话视图；桶内 conversation 由
 * 重建结果整体赋值，不经事件。
 *
 * 并发护栏：dispatch 是即发即忘（无全局串行），两个并发 resume 同一文件
 * 会双双通过「查注册表」再各建一个宿主 —— 同文件双写禁区。入口按文件
 * 串一行（resumeChainByFile）：后到的等先到的落完，落完后它就能在
 * 注册表里查到桶、直接切指针。本体在 resumeSessionOnce。
 */
const resumeChainByFile = new Map<string, Promise<unknown>>();

async function resumeSession(path: string): Promise<void> {
	const resolved = resolve(path);
	const previous = resumeChainByFile.get(resolved) ?? Promise.resolve();
	const attempt = previous.then(
		() => resumeSessionOnce(path),
		() => resumeSessionOnce(path),
	);
	const tracked = attempt.finally(() => {
		if (resumeChainByFile.get(resolved) === tracked) resumeChainByFile.delete(resolved);
	});
	resumeChainByFile.set(resolved, tracked);
	return attempt;
}

async function resumeSessionOnce(path: string): Promise<void> {
	const sessionsDir = getSessionsDir();
	const pathError = validateSessionFilePath(path, sessionsDir);
	if (pathError !== undefined) throw new Error(pathError);

	// 同文件单写者：已注册的会话直接切过去（含正在后台运行的）。
	const existing = findBucketByFile(path);
	if (existing !== undefined) {
		defaultWorkspaceDir = existing.cwd;
		setCurrentBucket(existing);
		await previewServers.ensure(existing.cwd);
		pushTaskListChanged(); // current 标记易主
		return;
	}

	/* ── 建宿主前：做完所有可能失败的验证，此刻一切毫发无损 ── */

	// open 是同步的（dist 类型：static open(...) : SessionManager），
	// 文件损坏/不可读在此抛出。
	const manager = SessionManager.open(path, sessionsDir);
	const header = manager.getHeader();
	if (header === null) throw new Error("会话文件缺少头部，无法恢复");

	// 从 header.cwd 推导会话工作目录，只算值不赋值：
	//   - 旧 playground 占位目录（playground 时代的技术 cwd）→ 迁移到共享临时目录。
	//     占位目录里本就不可能有产物（当时不注册文件工具），映射只改归类、不丢数据；
	//     会话文件 header 不改写 —— 下次 resume 仍走这条映射，判定收在 isTempCwd 一处。
	//   - 其余按工作空间校验同一套规则把关（会话本身没问题但目录不合法时拒，
	//     如指向配置目录的旧会话）。目录可能已被用户删掉，补建与新建会话同口径
	//     —— mkdir 幂等且不碰任何会话状态，可安全提前。
	let nextCwd: string;
	if (header.cwd === join(getConfigDir(), "playground")) {
		nextCwd = tempTasksDir();
		mkdirSync(nextCwd, { recursive: true });
	} else {
		const wsError = validateWorkspacePath(header.cwd, {
			configDir: getConfigDir(),
			appDir: process.cwd(),
		});
		if (wsError !== undefined) throw new Error(`会话的工作目录不可用：${wsError}`);
		mkdirSync(header.cwd, { recursive: true });
		nextCwd = header.cwd;
	}

	// 两轴沿用当前会话的选择（与 newTask 同口径：恢复历史不改用户偏好）。
	// expert 绑定同属这套沿用口径 —— resume 后专家身份不丢（state.expertId
	// 随 freshConversation 进新桶，compose 时重新解析人格正文注入）。
	const bucket = createBucket<SessionHost>({
		cwd: nextCwd,
		conversation: freshConversation(
			nextCwd,
			currentBucket.conversation.state.sceneId,
			currentBucket.conversation.state.interactionId,
			currentBucket.conversation.state.expertId,
		),
	});
	bucket.lastNonPlanInteraction = currentBucket.lastNonPlanInteraction;

	// hostPromise 先占位（createHost 的扩展闭包会读它），失败清回 ——
	// 与 getHost 的缓存语义一致。此处失败：桶未注册、指针未切，会话原样可重试。
	const attempt = createHost(bucket, manager);
	bucket.hostPromise = attempt;
	attempt.catch(() => {
		if (bucket.hostPromise === attempt) bucket.hostPromise = undefined;
	});
	const host = await attempt;
	adoptHost(bucket, host);

	// 桶内历史整体重建：entries 来自落盘条目（buildContextEntries 已完成
	// 压缩裁剪，恢复视图与模型实际看到的上下文一致）。turn / cancelledTurns
	// 属于旧 run 的瞬态，清空；artifacts 从落盘的 artifacts_presented
	// custom 条目恢复（buildConversationEntries 翻译 → artifactsFromEntries 折叠，
	// 清成 [] 会让恢复出的会话丢掉产物卡）；state 保留现值 ——
	// 它刚被 adoptHost 的 session_state 换成新会话的权威值。
	//
	// usageDetail 不在清空之列：它描述「当前上下文占用多少」而不是旧 run 的
	// 瞬态 —— resume 后 pi 从落盘消息重建了上下文，getContextUsage() 仍然
	// 有效，圆环理应立即恢复。contextUsage 缺失（压缩后无响应的空窗）时派生
	// 结果为 undefined，圆环隐藏才是正确语义（shared/conversation.ts 的
	// reducer 对 session_state 同口径）。派生必须等 entries 重建之后：
	// adoptHost 那次 session_state 已触发过一轮 emitContextUsageDetail，
	// 彼时桶内 entries 还是空的 —— 那轮派生的是空历史成分（时序坑），
	// 下方补发的事件在顺序上后发覆盖它。
	const rebuilt = buildConversationEntries(manager.buildContextEntries(), restoredToolLabel);
	const contextUsage = host.state.contextUsage;
	const usageDetail = deriveContextUsageDetail({
		entries: rebuilt,
		contextUsage,
		systemPromptTokens: bucket.systemPromptTokens,
		skillsTokens: bucket.skillsTokens,
	});
	bucket.conversation = {
		...bucket.conversation,
		entries: rebuilt,
		usageDetail,
		turn: undefined,
		cancelledTurns: [],
		artifacts: artifactsFromEntries(rebuilt),
	};

	defaultWorkspaceDir = nextCwd;
	setCurrentBucket(bucket);

	// 预览服务按 cwd 懒建（多根池，临时任务同样起服务）。
	await previewServers.ensure(nextCwd);

	// 补发一次 context_usage：reducer 对它直接覆盖 usageDetail（事件顺序上
	// 后发的胜出），把 adoptHost 早发那轮空历史成分派生顶掉，renderer 不必
	// 等 resyncSnapshot 圆环就位。emitContextUsageDetail 读桶内
	// conversation.entries —— 此刻已是重建结果，派生值与上面这份 usageDetail
	// 一致（同一纯函数、同一输入）。
	if (contextUsage !== undefined) {
		emitContextUsageDetail(bucket, contextUsage);
	}
	pushTaskListChanged(); // current 标记易主
}

/**
 * 「保存到工作空间」：临时任务转正为命名空间。
 *
 * 这不是 open 别人的会话文件，而是**当前会话原地换 cwd** —— 会话文件
 * 不动位置、消息历史不动、sessionId 不变，只重写 header.cwd（归组键）
 * 并以新 cwd 重建宿主（cwd 在建会话时一次性注入工具集，见 createHost）。
 * 所以桶与桶内 conversation 原样保留，不需要 resume 那套 entries 重建。
 *
 * 同会话写操作：整个流程排进当前桶的互斥链（session-registry.ts），
 * 与该会话的 prompt / compact 串行 —— dispose/重建宿主绝不能与 run 并发。
 * 链上执行时上一 run 必已收尾（prompt 在链上是整段 run）；流式守卫保留
 * 为不变式断言 —— 若它触发说明存在绕过互斥链的起 run 路径，
 * 响亮失败好过带着流式态拆宿主（pi 的 compact/重建对流式会话语义不明）。
 *
 * 失败原子性：守卫 / 名称校验 / 目录占用检查全部在 dispose 之前完成。
 * dispose 之后重建失败（如模型被删）时旧宿主已销毁 —— 会话文件与历史
 * 完好（JSONL 在盘），下次操作经 resume 可完整重开。
 *
 * 已生成文件留在临时目录不动（spec 决策）：共享临时目录是所有临时任务共用的，
 * 无法干净归属单个任务的文件，强行搬迁会带走别的任务的产物 ——
 * WorkBuddy 同为共享目录结构（spec：align-temp-task-workspace-model）。
 */
async function saveToWorkspace(name: string): Promise<void> {
	const bucket = currentBucket;
	await enqueue(bucket, async () => {
		if (bucket.running)
			throw new Error("任务进行中，请先停止当前任务");
		const hostPromise = bucket.hostPromise;
		if (hostPromise === undefined)
			throw new Error("还没有会话，请先开始任务");
		// 会话与 cwd 终身绑定，当前 cwd 即会话身份；临时判定读桶的权威 cwd。
		if (!isTempCwd(bucket.cwd))
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

		/* ── 切换点：dispose → 改写归组键 → 同文件同 id 重建宿主 ── */

		host.dispose();

		// 归组键改写必须先于 open：open 读 header 定内存 cwd，分组读 header 定归组。
		rewriteSessionHeaderCwd(sessionFile, target);

		bucket.cwd = target;

		// 预览服务按 cwd 懒建（多根池），与 applyWorkspace / resumeSession 同口径。
		await previewServers.ensure(target);

		// 复用 createHost 的全部组装（扩展、两轴、权限门、当前模型选择）。
		// SessionManager.open 重新打开同一文件：header 已是新 cwd，sessionId 不变
		//（adoptHost 按同 id 重新入注册表，覆盖同一只桶）。
		const manager = SessionManager.open(sessionFile, getSessionsDir());
		const attempt = createHost(bucket, manager);
		bucket.hostPromise = attempt;
		try {
			adoptHost(bucket, await attempt);
		} catch (error) {
			// 重建失败时旧宿主已 dispose：出表让会话回到「未打开」态
			//（文件与历史在盘，resume 可完整重开）—— 不留「注册了却没有宿主」
			// 的僵尸桶，否则下次 prompt 会在旧 id 名下静默开出新会话文件。
			bucketsById.delete(bucket.sessionId);
			bucket.hostPromise = undefined;
			throw error;
		}
		pushTaskListChanged(); // isTempTask / 归组变了
	});
}

/* ── 请求派发 ─────────────────────────────────────────────────────── */

type Handler = (args: readonly unknown[]) => Promise<unknown>;

/**
 * 新建任务。INVOKE.newTask 与内置命令 /new 共用。
 *
 * 不再作废旧会话（spec B：切换语义翻转）—— 旧桶留在注册表里后台保活，
 * 其 run 照跑；新任务开一个 pristine 桶（宿主懒建，首次 prompt 才占资源）。
 * 工作空间选择保留：新任务落在 defaultWorkspaceDir（applyWorkspace 设定的
 * 默认 cwd 来源）；两轴沿用旧会话的选择（开新活不是改偏好）。
 */
async function newTask(): Promise<void> {
	if (currentBucket.hostPromise === undefined) {
		// pristine 桶没有可保留的现场（无宿主无历史）：直接换绑到默认空间，
		// 不另开新桶 —— 否则首开应用连点两次「新建任务」会留下一串空桶。
		const next = defaultWorkspaceDir;
		if (currentBucket.cwd !== next) {
			currentBucket.cwd = next;
			updateStateLocally(currentBucket, { cwd: next, isTempTask: isTempCwd(next) });
		}
		return;
	}
	const bucket = createBucket<SessionHost>({
		cwd: defaultWorkspaceDir,
		conversation: freshConversation(
			defaultWorkspaceDir,
			currentBucket.conversation.state.sceneId,
			currentBucket.conversation.state.interactionId,
			// expert 绑定与两轴同口径沿用（开新活不是改偏好）。
			currentBucket.conversation.state.expertId,
		),
	});
	bucket.lastNonPlanInteraction = currentBucket.lastNonPlanInteraction;
	setCurrentBucket(bucket);
	/*
	 * 走事件而不是直接改 conversation：reducer 两端共用（shared/conversation.ts），
	 * daemon 本地折叠与 renderer 折叠的是同一个 history_reset，该会话的历史
	 * 同步清零。对新桶它是 no-op（本来就是空的），但 renderer 侧按信封折叠的
	 * 当前视图随之清零，不会出现旧会话的幽灵历史。
	 */
	emitSessionEvent(bucket, { type: "history_reset" });
	updateStateLocally(bucket, {});
}

const handlers: Record<string, Handler> = {
	// 返回折叠后的真实历史。ConversationView 与 SessionSnapshot 结构一致。
	// sessionId 缺省 = 当前会话；指定 id 时按注册表查桶 —— 未注册
	//（被 LRU 回收 / 从没打开）响亮报错，renderer 用自己的事件缓存兜底。
	[INVOKE.snapshot]: async ([sessionId]) => {
		if (sessionId === undefined) return currentBucket.conversation;
		const bucket = bucketsById.get(sessionId as string);
		if (bucket === undefined) {
			throw new Error(`会话未在 daemon 打开（可能已被空闲回收）：${sessionId as string}`);
		}
		return bucket.conversation;
	},

	/* ── 设置：已可用 ─────────────────────────────────────────────── */

	[INVOKE.settingsSnapshot]: async () => (await getCatalog()).snapshot(activeModelKey),

	/* ── 技能 ─────────────────────────────────────────────────────── */

	[INVOKE.skillsSnapshot]: async () => ({ skills: listSkills(), userSkillsDir: userSkillsDir() }),

	[INVOKE.importSkill]: async ([sourcePath]) => importSkill(sourcePath as string),

	/* ── MCP 连接器 ─────────────────────────────────────────────── */

	[INVOKE.mcpConfigGet]: async (): Promise<McpConfigSnapshot> => {
		// configJson 读原文不解析：文件坏了编辑器也要能打开（否则用户没法修）。
		const configJson = readMcpConfigSource(mcpEditCwd());
		// 当前会话有活宿主：运行态以扩展为准（真实连接状态 + 工具数）。
		const handle = mcpHandleByBucket.get(currentBucket);
		if (handle !== undefined) {
			return { servers: handle.getServerStates(), configJson };
		}
		// 还没建会话（宿主懒建）：从配置推导列表。enabled 的 server 尚无运行态，
		// 标 connecting（首个会话建立即真实连接）；disabled 标 disabled。
		// 配置坏了（JSONC / schema）servers 给空 —— configJson 照返，编辑器仍能修错，
		// 解析错误在会话建立时的日志与保存时的校验里都会响亮报出。
		try {
			const config = readMcpConfig(currentBucket.cwd);
			return {
				servers: Object.entries(config.servers).map(([name, serverConfig]) => ({
					name,
					status: serverConfig.disabled === true ? ("disabled" as const) : ("connecting" as const),
					toolCount: 0,
				})),
				configJson,
			};
		} catch (error) {
			if (error instanceof McpConfigError) return { servers: [], configJson };
			throw error;
		}
	},

	[INVOKE.mcpConfigSet]: async ([configJson]) => {
		// schema 校验在 writeMcpConfig 里（坏了拒写抛 McpConfigError，响亮回给 UI）。
		writeMcpConfig(configJson as string, mcpEditCwd());
		// 热应用：全部活桶一起重载（后台会话不该留在旧配置上）；
		// 无会话时为空操作，下个会话自然读到新配置。
		await Promise.all(liveMcpHandles().map((handle) => handle.reload()));
	},

	[INVOKE.mcpServerToggle]: async ([serverName, enabled]) => {
		toggleMcpServer(serverName as string, enabled as boolean, mcpEditCwd());
		await Promise.all(liveMcpHandles().map((handle) => handle.reload()));
	},

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
			entries: currentBucket.conversation.entries,
			systemPromptTokens: currentBucket.systemPromptTokens,
			contextUsage: currentBucket.conversation.state.contextUsage,
			logDir: eventLog.dir,
		}),

	// docx venv 四态：只探测不安装（诊断页不该有环境副作用，
	// 见 shared/ipc.ts 该通道注释）。
	[INVOKE.docxEnvStatus]: async (): Promise<DocxEnvStatus> =>
		inspectVenv(docxEnvContext(), defaultSpawn),

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
				const current = currentBucket.conversation.state.interactionId;
				await applyInteraction(
					currentBucket,
					current === "plan" ? currentBucket.lastNonPlanInteraction : "plan",
				);
				return;
			}
			/*
			 * compact 是同会话写操作：排进互斥链，与该会话的 prompt 串行。
			 * 决策（spec Task 2.3）：链上执行时上一 run 必已收尾（prompt 在链上
			 * 是整段 run），pi 的 compact() 对流式会话会先中断且不续跑 ——
			 * 排队执行天然避开那个语义；流式守卫保留为不变式断言，
			 * 触发说明存在绕过互斥链的起 run 路径，响亮失败。
			 */
			const hostPromise = currentBucket.hostPromise;
			if (hostPromise === undefined)
				throw new Error("还没有会话，没有可压缩的上下文");
			await enqueue(currentBucket, async () => {
				if (currentBucket.running)
					throw new Error("任务进行中，请先停止当前任务再压缩上下文");
				await (await hostPromise).compact(command.args === "" ? undefined : command.args);
			});
			return;
		}

		// 同会话写操作排互斥链（session-registry.ts）：同会话严格按到达顺序
		// 串行，跨会话互不阻塞。prompt 在链上是整段 run（await 到 agent 循环
		// 收尾），后续写操作执行时本 run 必然已结束。
		const bucket = currentBucket;
		bucket.lastUsedAt = Date.now();
		await enqueue(bucket, async () => {
			const host = await getHost(bucket);
			await host.prompt(text, whileStreaming, images);
		});
	},

	/**
	 * 中断。**不走 getHost** —— 没有会话时中断本就是空操作，
	 * 为了中断而去创建一个会话是荒谬的（还会因为没配模型而报错）。
	 *
	 * 不进互斥链：abort 是信号不是写操作，排在 prompt（整段 run）后面
	 * 会让停止键失效 —— run 不停、abort 永远轮不到执行。
	 * pi 的 abort 本就设计为 run 进行中从外部调用。
	 */
	[INVOKE.abort]: async () => {
		const hostPromise = currentBucket.hostPromise;
		if (hostPromise === undefined) return;
		await (await hostPromise).abort();
	},

	/**
	 * 新建任务：旧会话后台保活（宿主留注册表，run 照跑），开一个全新
	 * pristine 桶为当前会话（见 newTask）。
	 */
	[INVOKE.newTask]: async () => newTask(),

	/* ── 历史会话 ─────────────────────────────────────────────────── */

	[INVOKE.sessionList]: async () => listSessions(),

	[INVOKE.sessionResume]: async ([path]) => resumeSession(path as string),

	[INVOKE.sessionRename]: async ([path, name]) => {
		const target = path as string;
		const trimmed = (name as string).trim();
		if (trimmed === "") throw new Error("名称不能为空");

		// 已注册的会话（含后台保活的）必须走活实例：pi 的 SessionManager
		// 各自缓存 entries，同一文件出现两个活写者会互相覆盖。
		const bucket = findBucketByFile(target);
		if (bucket !== undefined) {
			const hostPromise = bucket.hostPromise;
			if (hostPromise !== undefined) {
				(await hostPromise).renameSession(trimmed);
				pushTaskListChanged();
				return;
			}
		}

		const pathError = validateSessionFilePath(target, getSessionsDir());
		if (pathError !== undefined) throw new Error(pathError);

		// 未注册会话：临时 open 写完即弃。实例不持有、不注册到任何地方 ——
		// 它若日后成为活会话，会经 resume 重新 open，不存在双写者窗口。
		SessionManager.open(target, getSessionsDir()).appendSessionInfo(trimmed);
		pushTaskListChanged();
	},

	[INVOKE.sessionDelete]: async ([path]) => {
		const target = path as string;

		/*
		 * 已注册会话分档处理（曾一律拒删：切过去变当前不能删、切走又是后台
		 * 保活不能删，死锁 —— 2026-09-10 用户实踩）：
		 *   - 当前会话：拒（不能把用户正看着的视图从脚下抽走，切走再来）；
		 *   - running：拒（dispose 等于杀 run，先停止再删）；
		 *   - 有待答审批/问卷或链上有活：拒（挂起的 execute 等不到答案会
		 *     永久悬置，先切换到它处理完）；
		 *   - 其余空闲桶：dispose 宿主 + 出注册表，然后按未注册会话同路径
		 *     删除 —— 活写者已销毁，不存在双写窗口（同 evictIdleHosts 的
		 *     微任务时序论证）。
		 */
		const bucket = findBucketByFile(target);
		if (bucket !== undefined) {
			if (bucket === currentBucket)
				throw new Error("这是当前任务，请先切换到其他任务再删除");
			if (bucket.running)
				throw new Error("该任务正在运行，请先在对话中停止它再删除");
			if (bucket.pendingApprovals > 0)
				throw new Error("该任务有等待回答的审批或提问，请先切换到它处理完再删除");
			if (bucket.pendingOps > 0)
				throw new Error("该任务还有正在执行的操作，请稍后再删除");
			bucketsById.delete(bucket.sessionId);
			const hostPromise = bucket.hostPromise;
			// 已注册桶的 hostPromise 必已 resolve（adoptHost 赋值），
			// await 在微任务内即刻拿到宿主。
			if (hostPromise !== undefined) (await hostPromise).dispose();
		}

		const pathError = validateSessionFilePath(target, getSessionsDir());
		if (pathError !== undefined) throw new Error(pathError);

		moveToTrash(target);
		pushTaskListChanged();
	},

	[INVOKE.sessionExport]: async ([path]) => {
		const target = path as string;

		// 与 resume / rename / delete 同一道防线：path 来自 renderer，不可信。
		const pathError = validateSessionFilePath(target, getSessionsDir());
		if (pathError !== undefined) throw new Error(pathError);

		/*
		 * 目标是未注册会话时「先恢复再导出」：pi 的导出能力只挂在活会话上
		 * （AgentSession.exportToHtml），独立入口 exportFromFile 没有从包根
		 * 导出（深引内部路径实测 ERR_PACKAGE_PATH_NOT_EXPORTED），包根导出
		 * 面下这是唯一正路。直接复用 resumeSession 而不复制它的逻辑 ——
		 * open+header 校验、失败原子性都随之生效；resume 失败则导出中止，
		 * 错误原样上抛。已注册（含后台保活）的会话直接用其宿主导出，
		 * 不打扰当前指针。
		 */
		let bucket = findBucketByFile(target);
		if (bucket === undefined) {
			await resumeSession(target);
			bucket = findBucketByFile(target);
		}
		// 走到这里目标必然已注册（resume 成功必入表）。这个分支现实中不可达，
		// 但类型需要窄化；真走到就说明 resume 的语义变了 —— 响亮失败，不静默兜底。
		if (bucket === undefined || bucket.hostPromise === undefined) {
			throw new Error("还没有会话，没有可导出的内容");
		}
		const host = await bucket.hostPromise;

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
		const title = summary?.title ?? bucket.sessionId;

		const outputPath = buildExportPath(exportsDir, title, new Date());
		// 空会话的「该会话还没有内容可导出」由 exportHtml 抛出，自然上抛给 UI。
		await host.exportHtml(outputPath);
		return { outputPath };
	},

	// 临时任务转正：命名 → 根下建目录 → 当前会话以新 cwd 重建（见 saveToWorkspace）。
	[INVOKE.saveToWorkspace]: async ([name]) => saveToWorkspace(name as string),

	[INVOKE.setScene]: async ([sceneId]) => {
		const id = requireReady(SCENES, sceneId as string, "场景");
		if (currentBucket.hostPromise === undefined) {
			// 会话还没建：只记住选择。建会话时会把它带进去（见 createHost）。
			updateStateLocally(currentBucket, { sceneId: id });
			return;
		}
		(await currentBucket.hostPromise).setScene(id);
	},

	[INVOKE.setInteraction]: async ([interactionId]) =>
		applyInteraction(currentBucket, interactionId as string),

	/**
	 * 选择 / 清除专家（单入口的另一半，applyInteraction 的注释是状态转移语义）。
	 * 目标 = 当前桶：专家选择是会话级 UI 状态，A 会话的专家不影响 B 会话。
	 */
	[INVOKE.setExpert]: async ([expertId]) => {
		const id = expertId as string | undefined;
		if (id === undefined) {
			// 清除专家：本就在三模式时本就没有可清的（no-op）；在 expert 模式
			// 则必须切走 —— 无专家的 expert 模式不可达。落点取 craft（新会话的默认模式）。
			if (currentBucket.conversation.state.interactionId === "expert") {
				await applyInteraction(currentBucket, "craft");
			}
			return;
		}
		// 选择前校验专家真实存在：renderer 的菜单项可能落后于用户删文件，
		// 放过去会建成「没有人格」的专家会话（compose 时照样炸，但那时
		// 用户已经把模式切过去了 —— 在选择的这一刻报错，UI 留在原模式）。
		const expert = loadExpertsNow().find((e) => e.name === id);
		if (expert === undefined) throw new Error(`未知的专家：${id}`);
		await applyInteraction(currentBucket, "expert", id);
	},

	/**
	 * 专家列表：renderer「专家 ▸」子菜单与对话头部的展示数据源。
	 * 每次现载不缓存（与 setExpert 的校验同一条读路径，用户级覆盖即时生效）；
	 * 只映射展示三字段，人格正文不下发 —— compose 时 daemon 自取。
	 */
	[INVOKE.listExperts]: async () =>
		loadExpertsNow().map((e) => ({
			name: e.name,
			displayName: e.displayName,
			profession: e.profession,
			description: e.description,
		})),

	/**
	 * 切换模型。不依赖会话 —— 设置界面在会话建立前就要能用。
	 *
	 * 全局设置（spec A）：写入 activeModelKey 后，**之后新建的宿主**都用它；
	 * 当前会话同步切过去（避免「设置里显示 A、实际还在用 B」）；
	 * 后台保活的宿主保留各自模型 —— 进行中的 run 不换引擎。
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

		if (currentBucket.hostPromise !== undefined)
			await (await currentBucket.hostPromise).setModel(key);
		else updateStateLocally(currentBucket, { modelId: key });
	},

	/**
	 * 切换当前会话的推理强度档位。目标 = 当前桶：多任务并发下档位按桶独立，
	 * A 会话的切换不影响 B 会话（spec：会话内推理强度切换）。
	 * 逐会话持久化与 resume 还原全由 pi 负责（thinking_level_change 条目），
	 * 这里不做第二份持久化。
	 */
	[INVOKE.setThinkingLevel]: async ([level]) => {
		// 双端校验（同 setModel / setPermissions 的做法）：UI 只列当前模型
		// 可用档，这里防绕过 —— 非法值响亮报错，不放行给 pi。
		if (!isThinkingLevel(level)) {
			throw new Error(`未知的推理强度档位：${String(level)}`);
		}
		const bucket = currentBucket;
		const hostPromise = bucket.hostPromise;
		if (hostPromise === undefined) {
			// pristine 桶（宿主未建）：参照 setScene 的 pristine 语义只记档 ——
			// availableThinkingLevels 此刻无从知晓（要问 pi 才知道），建宿主时
			// 由 createHost 的取值优先级（会话内选择 > 全局默认）把这个选择带进去。
			updateStateLocally(bucket, { thinkingLevel: level });
			return;
		}
		// pi 恒 clamp 到模型可用档位、不抛错；host.setThinkingLevel 会
		// emitState 重推权威值（clamp 后的实际生效值），UI 自动刷新，这里不另推。
		(await hostPromise).setThinkingLevel(level);
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

	/* ── 全局默认推理强度 ─────────────────────────────────────────── */

	// 未配置回 medium：pi 的内置默认就是 medium（createAgentSession 未传
	// thinkingLevel 时的取值链），兜底与 pi 不漂移。
	[INVOKE.getThinkingLevelDefault]: async () => ({
		level: readPreferences().thinkingLevel ?? "medium",
	}),

	[INVOKE.setThinkingLevelDefault]: async ([level]) => {
		// 双端校验（同 setPermissions）：设置页即时校验 + 这里防绕过。
		if (!isThinkingLevel(level)) {
			throw new Error(`未知的推理强度档位：${String(level)}`);
		}
		// 读改写：偏好文件里还有模型选择、权限设置等其他键，整存覆盖会清掉它们。
		// 语义：只影响**之后新建**的会话（含定时任务 run 会话与子代理会话，
		// 见 createHost 与两个 runner 的注入点）—— 既有会话以各自会话内
		// 选择为准，不被本键回溯修改（spec：全局默认不回溯既有会话）。
		writePreferences({ ...readPreferences(), thinkingLevel: level });
	},

	/* ── 回复风格 ─────────────────────────────────────────────────── */

	// 未配置回 DEFAULT_STYLE_ID（professional）：默认值的唯一出处在
	// core/resources.ts，偏好文件保持「没写就是没写」（同 thinkingLevel 口径）。
	[INVOKE.getStyle]: async () => ({
		styles: RESOURCES.styles.map((s) => ({ id: s.id, label: s.label })),
		styleId: readPreferences().styleId ?? DEFAULT_STYLE_ID,
	}),

	[INVOKE.setStyle]: async ([styleId]) => {
		// 双端校验（同 setThinkingLevelDefault）：空串 = 关闭，是合法值；
		// 其余必须是已加载的风格 id（RESOURCES 启动时已校验过文件名与映射）。
		if (typeof styleId !== "string" || (styleId !== "" && !RESOURCES.styles.some((s) => s.id === styleId))) {
			throw new Error(`未知的回复风格：${String(styleId)}`);
		}
		// 读改写（理由同 setThinkingLevelDefault）。语义：只影响之后的新 run ——
		// 系统提示词在 run 开始时组装，进行中的 run 不追回（spec：F8 风格系统）。
		writePreferences({ ...readPreferences(), styleId });
	},

	/* ── 记忆开关（spec: add-memory-system） ──────────────────────── */

	// 未配置回 true（缺省开启）：偏好文件保持「没写就是没写」，
	// 缺省语义收在这一个出口（读偏好处不填默认值，见 preferences.ts）。
	[INVOKE.getMemoryEnabled]: async () => ({
		enabled: readPreferences().memoryEnabled ?? true,
	}),

	[INVOKE.setMemoryEnabled]: async ([enabled]) => {
		const value = enabled === true;
		// 读改写：偏好文件里还有模型选择、权限设置等其他键，整存覆盖会清掉它们。
		writePreferences({ ...readPreferences(), memoryEnabled: value });
		// toggle 是内置任务启停的权威：立刻对齐，不等下次启动的 ensure。
		// ensure 返回是否真有变更 —— 重复设置同值时不推 changed，免得
		// 管理页为一个没发生的变更重拉列表。
		if (ensureBuiltinMemoryTask(automationStore, value)) {
			pushAutomationChanged();
		}
	},

	/* ── 用户画像（spec: add-memory-system） ────────────────────── */

	// 文件不存在回空串：设置页 textarea 从空白开始。「还没生成过画像」是新用户
	// 的常态，不是错误（同 memory.ts 的降级口径：用户数据缺席不该响亮失败）。
	[INVOKE.getProfile]: async () => ({
		content: existsSync(profilePath()) ? readFileSync(profilePath(), "utf8") : "",
	}),

	// 覆盖写全文。画像在 compose 时现读现拼（buildMemorySection），
	// 所以写完下一轮对话即生效，无需通知任何运行中的会话。
	[INVOKE.setProfile]: async ([content]) => {
		writeFileSync(profilePath(), content as string, "utf8");
	},

	// 清空内容但保留文件本身：蒸馏任务每晚照常往里写，删文件反而多一条
	// 「不存在 → 重建」的分支要维护。
	[INVOKE.resetProfile]: async () => {
		writeFileSync(profilePath(), "", "utf8");
	},

	/* ── 提示词预览（设置页，spec: systematize-prompt-architecture Task 5） ── */

	// 纯逻辑在 ./prompt-preview.ts（可测）；这里只负责现取环境：
	// cwd = 当前会话工作区（预览反映「此刻发消息会看到的提示词」），
	// 技能清单现读（同 composeSystemPrompt 口径），风格偏好现读。
	[INVOKE.promptPreview]: async ([request]) =>
		buildPromptPreview(RESOURCES, request as PromptPreviewRequest, {
			cwd: currentBucket.cwd,
			skills: listSkills().map((s) => ({
				name: s.name,
				description: s.description,
				filePath: s.filePath,
			})),
			preferredStyleId: readPreferences().styleId,
			// 与 composeSystemPrompt 同一来源现读（含降级口径），预览不静默漂移。
			memorySystemBody: loadMemorySystemPrompt(getResourcesDir()),
			memoryContent: buildMemorySection(currentBucket.cwd),
		}),

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
		files: indexFiles(currentBucket.cwd),
		commands: [
			// 技能：/skill:name 由 pi 的 prompt 自动展开（_expandSkillCommand），
			// renderer 只需把名字补全出来，原样传给 session.prompt 即可。
			...listSkills().map((s) => ({
				name: `skill:${s.name}`,
				description: s.description,
				source: "skill" as const,
			})),
			// 提示词模板：/模板名 由 pi 的 expandPromptTemplate 展开。
			// 发现目录必须与会话实际生效的一致 —— cwd 取当前会话桶的 cwd
			//（会话与 cwd 终身绑定，桶即真相）。
			...listPromptTemplates(currentBucket.cwd, getConfigDir()).map((t) => ({
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

	// current = 新建任务的默认 cwd 来源（applyWorkspace 设定）——
	// 多任务并发后「当前空间」不再等于「当前会话的 cwd」（会话 cwd 终身绑定）。
	[INVOKE.workspaceSnapshot]: async () => ({
		current: defaultWorkspaceDir,
		// 生效根现读（不缓存）：改默认存储路径后，空间列表即刻反映新根。
		defaultRoot: getEffectiveWorkspaceRoot(),
		workspaces: listWorkspaces(getEffectiveWorkspaceRoot()),
		previewBaseUrl: previewServers.baseUrlFor(defaultWorkspaceDir),
	}),

	// 按 cwd 查多根实例表（每 cwd 一个端口，懒建）；未启动返回 undefined ——
	// 面板显示引导文案即可，不视为错误（契约见 shared/ipc.ts）。
	[INVOKE.previewBaseUrl]: async ([cwd]) => previewServers.baseUrlFor(cwd as string),

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

		// 有活宿主在该空间的会话一律拒删：宿主还持有会话文件的活写者
		//（可能正在后台跑），移走文件后续写会失败（sessionDelete 拒删
		// 已注册会话的同一理由）。判定按桶的 cwd（= 会话 header.cwd）而不是
		// 文件位置 —— 会话文件全部平铺在 sessions/ 下，与空间目录没有位置关系。
		for (const bucket of bucketsById.values()) {
			if (bucket.hostPromise !== undefined && resolve(bucket.cwd) === resolvedTarget) {
				throw new Error("该空间有正在打开的任务，请先切换到它并停止运行后再移除");
			}
		}

		// 一份列表同时服务守卫与收集：cwd 来自会话文件头部（磁盘真相），
		// 与组的派生口径一致。
		const sessions = await listSessions();

		for (const session of sessions) {
			if (session.isTempTask || resolve(session.cwd) !== resolvedTarget) continue;
			moveToTrash(session.path);
		}

		// 空间目录本身不动：里面可能有用户自己的文件，我们只管会话文件。
		removeDisplayName(target);
		pushTaskListChanged();
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
	[INVOKE.statPath]: async ([path]) => statArtifactPath(path as string),

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

	/* ── 结构化提问回程 ─────────────────────────────────────────────── */

	[INVOKE.questionnaireResponse]: async ([response]) => {
		const answer = response as QuestionnaireResponse;
		const slot = pendingQuestionnaires.get(answer.id);
		if (slot === undefined) {
			// 重复应答（连点）是正常的，静默忽略；但查无此项也可能是契约错配
			// （2026-09-10 的 id 覆盖事故就是静默丢应答导致工具永久悬挂）——
			// 留一行证据，下次不用猜。
			eventLog.append({
				kind: "ipc_error",
				channel: "questionnaire:response",
				message: `问卷应答找不到在途请求（重复应答或契约错配）：${answer.id}`,
			});
			return;
		}
		pendingQuestionnaires.delete(answer.id);
		eventLog.append({
			kind: "questionnaire_response",
			id: answer.id,
			skipped: answer.skipped,
		});
		slot.resolve(answer);
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
function updateStateLocally(
	bucket: SessionBucket<SessionHost>,
	changes: Partial<SessionState>,
): void {
	emitSessionEvent(bucket, {
		type: "session_state",
		state: { ...bucket.conversation.state, ...changes },
	});
}

/**
 * 交互模式切换的统一入口：setInteraction 通道、setExpert 通道与 /plan
 * 内置命令都走这里。
 *
 * 选专家 = 切 expert 模式 + 绑定人格，是同一个状态转移（spec: add-expert-mode）：
 * expertId 随切换一并落 state，不存在「expert 模式但没人格」的中间态
 * （无专家的 expert 模式不可达 —— 模式菜单只列具体专家，不裸列「专家」）。
 * 切到 craft/ask/plan 一律清空 expertId。
 *
 * 任何切到非 plan 模式的切换都刷新**该会话**的记忆 —— 用户从切换器切走后
 * 再发 /plan，回到的必须是刚切走的那个模式，而不是一条过时记忆。
 * 记忆按桶存：A 会话的 /plan 不该切回 B 会话记下的模式。
 * expert 不入 /plan 记忆：回程需要 expertId，而切走时它已清空，
 * 记下「expert」会让 /plan 回程必然报错 —— 回到上一个三模式是安全回落。
 */
async function applyInteraction(
	bucket: SessionBucket<SessionHost>,
	id: string,
	expertId?: string,
): Promise<void> {
	const readyId = requireReady(INTERACTIONS, id, "交互模式");
	if (readyId === "expert" && expertId === undefined) {
		throw new Error("选择具体专家后才会进入专家模式");
	}
	if (readyId !== "plan" && readyId !== "expert") bucket.lastNonPlanInteraction = readyId;
	const nextExpertId = readyId === "expert" ? expertId : undefined;
	if (bucket.hostPromise === undefined) {
		// 清除语义必须显式写 undefined：updateStateLocally 是浅合并，
		// 不带 expertId 键会把旧值留在 state 里。
		updateStateLocally(bucket, { interactionId: readyId, expertId: nextExpertId });
		return;
	}
	(await bucket.hostPromise).setInteraction(readyId, nextExpertId);
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

	// 初始工作区（共享临时目录）的预览服务（多根池里第一个实例）。
	// 失败不阻断启动 —— 预览是增强能力，聊天主链路不该被它拖死；记日志留现场。
	void previewServers.ensure(defaultWorkspaceDir).catch((error: unknown) => {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`预览服务启动失败：${message}`);
		eventLog.append({ kind: "ipc_error", channel: "preview:ensure", message });
	});

	/*
	 * docx 引擎 venv 后台预热（对标 WorkBuddy 的 SessionStart hook：
	 * 会话开始就不阻塞地跑 setup-html-to-docx.sh，首次冷启动不卡会话）。
	 * fire-and-forget：不阻塞 ready（首装要联网拉 Python，可能几分钟）；
	 * 失败静默记事件日志 —— 转换前的幂等 ensure 才是兜底（docx_convert 工具层），
	 * 预热只是省首次等待，它的失败不该惊动用户。
	 */
	void ensureDocxEnv(docxEnvContext(), defaultSpawn)
		.then((result) => {
			if (result.status === "ready") {
				eventLog.append({ kind: "docx_env_warmup", outcome: "ready" });
			} else {
				eventLog.append({
					kind: "docx_env_warmup",
					outcome: "failed",
					phase: result.phase,
					error: result.error,
				});
			}
		})
		.catch((error: unknown) => {
			// ensure 自身抛出（状态机 bug / spawn 异常逃逸）：同口径记日志，不放任成 unhandledRejection。
			eventLog.append({
				kind: "docx_env_warmup",
				outcome: "error",
				message: error instanceof Error ? error.message : String(error),
			});
		});

	// 模型目录是懒加载的（见 getCatalog）：models.json 坏了应当在打开设置页时报错，
	// 而不是让 daemon 起不来、界面永久卡在「正在启动」。

	// 定时任务：库损坏在启动时暴露（store 契约：响亮报错不静默吞）；
	// 调度器 start 做启动恢复（过期 once 标 missed、周期任务重算下一次）并开 tick。
	automationStore.load();
	/*
	 * 内置「记忆整理」蒸馏任务（spec: add-memory-system）：确保存在并把启停
	 * 对齐 memoryEnabled（toggle 是权威）。必须赶在 scheduler.start 之前 ——
	 * 启动恢复会把对齐后的 active 任务一并重算 nextRunAt，顺序反了则刚启用
	 * 的内置任务要再等一个 tick 周期才被恢复逻辑看到（它只跑一次）。
	 */
	if (ensureBuiltinMemoryTask(automationStore, readPreferences().memoryEnabled ?? true)) {
		pushAutomationChanged();
	}
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
