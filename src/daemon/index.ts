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
	readFileSync,
	renameSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
/*
 * pi 的值为什么全部走首用时动态 import（勿改回静态）：pi 整包实测热态 1809ms
 * （冷态 4.7s），而 daemon 的启动关键路径（post ready 之前）只做 loadResources /
 * 偏好 / 权限规则这类 ms 级同步读 —— 技能清单、会话文件、模型目录一个都不碰。
 * 静态 import 会在本模块的模块体**之前**求值，于是 ready 必须等完整包装配完，
 * 首屏的四个加载文案全被这一个闸门卡住（实测 ready 在 uptime 2562~4029ms）。
 * 这里只保留 `import type`（编译期擦除，不产生运行时依赖）。
 */
import type { SessionInfo, SessionManager } from "@earendil-works/pi-coding-agent";
import { AutomationStore } from "../core/automation-store.ts";
import { SessionArchive } from "../core/session-archive.ts";
import { ensureBuiltinMemoryTask } from "../core/builtin-memory-task.ts";
import { ensureBuiltinProviders } from "../core/builtin-providers.ts";
import {
	getAppDir,
	getAuthPath,
	getBuiltinSkillDirs,
	getConfigDir,
	getModelsPath,
	getResourcesDir,
	getSessionsDir,
	getSpillsDir,
	getTempTasksDir,
} from "../core/config-paths.ts";
import {
	clearAuditRecords,
	exportAuditRecords,
	readAuditRecords,
	writeAuditRecord,
} from "../core/audit-log.ts";
import { EventLog } from "../core/event-log.ts";
import {
	AUDIT_PANEL_LIMIT,
	clipAuditDetail,
	isAuditCategory,
	type AuditCategory,
	type AuditQueryResult,
} from "../shared/audit.ts";
import { optionalBoolean, parseFrontmatter, type ParsedDocument } from "../core/frontmatter.ts";
import { ensureUserMemoryFiles, loadMemorySystemPrompt, profilePath, userMemoryPath } from "../core/memory.ts";
import { loadAgents } from "../core/agents.ts";
import { loadExperts, type ExpertDefinition } from "../core/experts.ts";
import {
	McpConfigError,
	readMcpConfigSource,
	toggleMcpServer,
	writeMcpConfig,
} from "../core/mcp-config.ts";
import { ModelCatalog, parseModelKey } from "../core/model-catalog.ts";
import { ObservabilityStore } from "../core/observability.ts";
import {
	appendPermissionRule,
	loadPermissionRules,
	savePermissionRules,
} from "../core/permission-rules-store.ts";
import {
	getEffectiveWorkspaceRoot,
	readPreferences,
	writePreferences,
} from "../core/preferences.ts";
import { PreviewServers } from "../core/preview-server.ts";
import { buildPromptPreview } from "./prompt-preview.ts";
import {
	buildSessionMemorySection,
	listSessionPromptTemplates,
	readSessionArtifact,
	readSessionMcpConfig,
	statSessionArtifact,
} from "./session-cwd-reads.ts";
import {
	formatRuntimeContext,
	requireExpertPersona,
	resolveSessionExpert,
	sessionSkillPaths,
	type PersonalizationSection,
	type SkillDescriptor,
} from "../core/prompt-composer.ts";
import { DEFAULT_STYLE_ID, loadResources, toDescriptors } from "../core/resources.ts";
import { createSystemPromptComposerFromDefaults } from "../core/system-prompt-composer.ts";
import { importSkill, readInstalledMeta, userSkillsDir } from "../core/skill-install.ts";
import { filterEnabledSkills, isSkillEnabled, SKILL_NAME_PATTERN, type SkillOverride } from "../core/skill-status.ts";
import { computeSkillsCost } from "../core/skills-cost.ts";
import { buildExportPath } from "../core/session-export.ts";
import { restoredToolLabel, SessionHost } from "../core/session-host.ts";
import {
	buildConversationEntries,
	countSkippedLines,
	normalizeLegacyInteraction,
	validateSessionFilePath,
} from "../core/session-rebuild.ts";
import { ledgerFileName, listLedgerFiles, readLedgerEntries, RunLedger } from "../core/run-ledger.ts";
import { SessionMailbox } from "./mailbox.ts";
import { spawnMember, type MemberHandle } from "./member-runner.ts";
import { TeamRegistry } from "./team-runtime.ts";
import { createWorkspace, listWorkspaces, validateWorkspacePath } from "../core/workspace.ts";
import {
	readDisplayNames,
	removeDisplayName,
	setDisplayName,
	validateDisplayName,
} from "../core/workspace-registry.ts";
import {
	createWorktree,
	getBranchList,
	isGitRepo,
	worktreeInfoFromCwd,
} from "../core/worktree.ts";
import { indexFiles } from "../core/file-index.ts";
import { automationExtensionFactory } from "../extensions/automation-tools.ts";
import { conversationSearchExtensionFactory } from "../extensions/conversation-search-tool.ts";
import { createPermissionGate } from "../extensions/permission-gate.ts";
import { defaultProtectedDirs, isPathInside } from "../extensions/permission-policy.ts";
import { rememberRuleFromApproval } from "../extensions/permission-rules.ts";
import { createProjectTrust } from "../extensions/project-trust.ts";
import { questionnaireExtensionFactory } from "../extensions/questionnaire-tool.ts";
import { powershellExtensionFactory, runCommand } from "../extensions/powershell-tool.ts";
import {
	createSandboxedRunner,
	warmUpSandbox,
	type SandboxDiagnostics,
	type SandboxPrepareReport,
} from "./sandbox-runner.ts";
import { taskExtensionFactory } from "../extensions/task-tool.ts";
import { teamExtensionFactory } from "../extensions/team-tools.ts";
import { todoExtensionFactory } from "../extensions/todo-tool.ts";
import { createUseSkillTool, type UseSkillTarget } from "../extensions/use-skill-tool.ts";
import { visualizerExtensionFactory } from "../extensions/visualizer-tools.ts";
import {
	DEFAULT_PERMISSIONS,
	isApprovalPolicy,
	isGranted,
	isSandboxMode,
	normalizeApprovalOutcome,
	presetIdFor,
	type PermissionInfo,
	type PermissionRule,
	type PermissionSettings,
	type SandboxUnavailableReason,
} from "../shared/permissions.ts";
import { createDocReadTool } from "../extensions/doc-read-tool.ts";
import { createDocxConvertTool } from "../extensions/docx-convert-tool.ts";
import { createDocxExtractTool } from "../extensions/docx-extract-tool.ts";
import { createMcpClient, type McpClientHandle } from "../extensions/mcp-client.ts";
import { createPresentFiles } from "../extensions/present-files.ts";
import { createPromptSwitch } from "../extensions/prompt-switch.ts";
import { spillExtensionFactory } from "../extensions/spill-hook.ts";
import { createWebTools } from "../extensions/web-tools.ts";
import type { WebSearchConfig } from "../core/web-search.ts";
import { parseBuiltinCommand } from "../shared/builtin-commands.ts";
import { SKILL_COMMAND_PREFIX } from "../shared/skill-block.ts";
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
import {
	allocatePendingCwd,
	isRevealableCwd,
	isSelectableWorkspaceDir,
	isTaskCwd,
	isTaskPrivateCwd,
} from "./workspace-model.ts";
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
	type PersonalizationPatch,
	type PromptPreviewRequest,
	type PromptRequest,
	type QuestionnaireRequest,
	type QuestionnaireResponse,
	type RunLedgerResult,
	type SessionBranchResult,
	type SessionSummary,
	type WorkspaceGroupMeta,
} from "../shared/ipc.ts";
import { nextRunAfter, validateSchedule } from "../shared/automation.ts";
import type { AutomationTask } from "../shared/automation.ts";
import type { QueuedMessages } from "../shared/session-events.ts";
import { defaultSpawn } from "../documents/docx-env.ts";
import {
	defaultPythonRuntimeOptions,
	inspectPythonRuntime,
	type RuntimeOptions,
} from "../core/runtimes/python.ts";
import {
	collectRuntimeDiagnosticsText,
	collectRuntimeInventory,
	installManagedRuntime,
	planRuntimeShellInjection,
	resetManagedRuntime,
	writeRuntimeEnabled,
	writeRuntimeMaster,
} from "../core/runtime-inventory.ts";
import type { RuntimeInstallProgress, RuntimeInventory } from "../shared/runtimes.ts";
import {
	isWebSearchProviderId,
	type ModelProbeResult,
	type WebSearchConfigInfo,
	type WebSearchConfigInput,
	type WebSearchTestResult,
} from "../shared/settings.ts";
import { readApiKey } from "../core/api-keys.ts";
import { ensureAgentTools } from "../core/agent-tools.ts";
import { probeModel } from "../core/model-probe.ts";
import { searchWeb } from "../core/web-search.ts";
import {
	isStreamingEvent,
	isThinkingLevel,
	type ConversationEntry,
	type ModeDescriptor,
	type SessionEvent,
	type SessionEventEnvelope,
	type SessionState,
	type SubagentStatus,
} from "../shared/session-events.ts";
import { requireBranchName } from "../shared/worktree.ts";
import type { CustomModelInput, CustomProviderInput, SkillInfo, SkillsSnapshot } from "../shared/settings.ts";
import { deriveContextUsageDetail } from "./context-usage-detail.ts";
import { deriveSessionTitle, searchSessionFiles } from "./conversation-search.ts";
import {
	createBranchedSessionFile,
	createEmptySessionFile,
	createSessionFileFromPrefix,
	readSessionHeader,
	setSessionName,
	setSessionParentSession,
	truncateSessionTo,
	truncateSessionToStart,
} from "../core/session-file.ts";
import {
	branchFail,
	branchOk,
	buildBranchTitle,
	endOfTurn,
	decideExtract,
	resolveAnchorForIndex,
} from "./session-branch.ts";
import type { ContextUsageDetail } from "../shared/context-usage.ts";
import { readUsageStats } from "./usage-stats.ts";
import { createAutomationRunExecutor } from "./automation-runner.ts";
import { AutomationScheduler } from "./automation-scheduler.ts";
import { createSubagentRunner } from "./subagent-runner.ts";
import { isInternalSessionFile } from "./session-visibility.ts";

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
/** 首页预设（能力胶囊 + 最佳实践案例）。静态资源，随快照下发。 */
const WELCOME = RESOURCES.welcome;

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
 * 当前持久前缀规则集（spec: add-permission-rules-engine）。启动时从
 * permissions.rules.json 读入模块级变量，之后每次判定读内存不读盘 ——
 * 与 activePermissions 同范式：权限门每次工具调用都要读它，IO 不能进热路径。
 * 坏文件按空规则集降级（store 的口径），warn 落 daemon 日志。
 */
let activePermissionRules: readonly PermissionRule[] = loadPermissionRules((message) => {
	console.error(message);
});

/**
 * 批准写回（Task 3）：把一条规则并入内存规则集并落盘。
 * 幂等：同 tool+prefix+action 已存在时不重写文件（appendPermissionRule 返回
 * 原数组引用，据此短路）。内存先更新再落盘 —— 门经 getRules 读内存，
 * 「即刻生效」不依赖写盘完成。
 */
export function appendRule(rule: PermissionRule): void {
	const next = appendPermissionRule(rule, activePermissionRules);
	if (next === activePermissionRules) return;
	activePermissionRules = next;
	savePermissionRules(next);
}

/**
 * 受保护的凭据目录，进程启动时算一次。
 *
 * 家目录在进程生命周期内不会变，没必要每次判定都调 homedir()。
 * 这批目录**读写都拒且任何权限模式都不能越过**（见 permission-policy.ts 阶段 1）。
 */
const PROTECTED_DIRS = defaultProtectedDirs(homedir());

/*
 * 启动即保证两个用户级记忆文件存在（空文件）：模型按提示词 read 固定路径，
 * 文件不存在会被它误述成「访问不了记忆」（2026-09-14 实测）。建文件失败
 * 不炸启动（ensure 内部已降级，见 core/memory.ts）。
 */
ensureUserMemoryFiles();

/**
 * 随包预装的技能根（我们自己写的 skills/ + 照搬的市场插件 plugins/）。
 * 路径的真源在 core/config-paths.ts 的 getBuiltinSkillDirs —— session-host 给 pi
 * 的 additionalSkillPaths 用的是同一份，两边分家就会出现「模型能用、界面看不见」。
 */
const BUILTIN_SKILL_DIRS = getBuiltinSkillDirs();

/** 技能列表需要、而 pi 的 loader 不提供的 frontmatter 字段。 */
interface SkillMeta {
	readonly userInvocable: boolean;
	readonly version: string | undefined;
}

/**
 * 读 `version`（缺省 = 不带该字段）。
 *
 * 只认非空字符串：写成裸数字（`version: 1.0`）会被我们的 frontmatter 解析器当数字
 * （值变成 1，`.0` 丢掉）——拿它当版本号是**静默改值**，宁可显式记日志 + 不带。
 * 单独判它而不是并进 readSkillMeta 的解析失败兜底：一个字段写坏不该连带
 * 把 `user-invocable` 一起降级（那会让技能莫名从 `/` 菜单消失）。
 */
function readSkillVersion(doc: ParsedDocument, filePath: string): string | undefined {
	const value = doc.frontmatter["version"];
	if (value === undefined) return undefined;
	if (typeof value === "string" && value !== "") return value;
	console.error(`技能「${filePath}」的 frontmatter 字段 version 应为非空字符串（写裸数字会丢精度，如 1.0 → 1），已忽略：`, value);
	return undefined;
}

/**
 * 读一个技能的 `user-invocable`（缺省 true）与 `version`（缺省不带）。
 *
 * 为什么要**多读一次盘**：真正加载技能的是 pi 的 `loadSkills`，而它只认
 * name / description / disable-model-invocation，未知键（含 `user-invocable`、`version`）直接丢弃
 * （pi core/skills.js 的 frontmatter 映射表）—— 这些字段根本到不了我们手上。
 * 选择再解析一次而不是改 pi 的加载器或自己接管加载：只补这几个字段，路径发现、
 * 优先级、name 校验、正文装载仍全由 pi 决定（AGENTS.md §1.2 的适配层口径），
 * 代价是一次小文件读取，技能列表本来就是现读不缓存的。
 * **两个字段共用这一次读盘**，不要为新增字段再开一次读取。
 *
 * 解析失败（我们的解析器是真 YAML 的子集，pi 能读、我们读不了的文件是可能的）：
 * 响亮记日志，但**逐文件降级**（`user-invocable` 为 true、无 version）。两条理由：
 * ① 整个列表接口不能因为一个坏 SKILL.md 打挂（`listSkills` 外层 catch 的既有口径是
 * 「页面照常打开」）；② 降级成 false 更糟 —— 技能会从 `/` 菜单静默消失，用户连手动
 * `/skill:name` 都补不出来，故障被藏进「看不见」。默认可见 + 日志里的报错，坏文件是能被发现的。
 */
function readSkillMeta(filePath: string): SkillMeta {
	try {
		const doc = parseFrontmatter(readFileSync(filePath, "utf8"), filePath);
		return {
			userInvocable: optionalBoolean(doc, "user-invocable", true),
			version: readSkillVersion(doc, filePath),
		};
	} catch (error) {
		console.error(`技能「${filePath}」的 frontmatter 解析失败，暂按可在 / 菜单调用处理：`, error);
		return { userInvocable: true, version: undefined };
	}
}

/**
 * `listSkills` 的产物：`SkillInfo` 去掉 `enabled`。
 *
 * 为什么少了那个字段：`enabled` 是**用户级覆盖**（`preferences.json` 的 skillOverrides），
 * 与技能自身的元数据无关，只能由 skillSets() 在读偏好之后统一标注 —— 一个技能的
 * 「全量」与「启用」两面必须来自同一次读盘、同一份 overrides，否则两次读之间用户
 * 正好改了开关，就会出现「列表里显示启用、过滤集合里却没有」的瞬时错位。
 */
type SkillEntry = Omit<SkillInfo, "enabled">;

/**
 * 技能清单。技能页展示与提示词组装共用这一个来源，且**每次现读** ——
 * 导入新技能后下一轮对话即生效，无需重启应用。
 *
 * 可选 expertSkillsDir：会话绑定的专家私有技能目录，追加进加载路径 ——
 * 专家的专业技能因此只在该专家被绑定时可见（spec: 专家私有技能预加载）。
 * 技能页（skillsSnapshot）不传它，展示的是全局技能池；全局在前、专家在后，
 * 顺序即优先级（见 core/prompt-composer.ts sessionSkillPaths）。
 *
 * 独立于 SessionHost 的加载（宿主懒建，技能页要在第一次发消息前就能看）。
 * 加载失败不抛：页面不能因为一个坏 SKILL.md 打不开，记日志、列表为空。
 */
async function listSkills(expertSkillsDir?: string): Promise<SkillEntry[]> {
	/*
	 * pi 首用时才装配（见文件顶的惰性说明）：技能清单只在「打开技能页 / 组装提示词 /
	 * 调 use_skill」时才需要。**放在 try 之外**：pi 装载失败是基础设施故障，
	 * 不能与「某个 SKILL.md 坏了」共用同一条「列表为空」的降级路径（AGENTS.md §7）。
	 */
	const { loadSkills } = await import("@earendil-works/pi-coding-agent");
	try {
		const { skills } = loadSkills({
			/*
			 * cwd 只决定「项目级技能」的发现目录（pi 取 `<cwd>/.pi/skills`，见
			 * pi core/skills.ts）：内置技能走 skillPaths 的绝对路径、用户级技能走
			 * agentDir=getConfigDir()，都不受 cwd 影响。用生效根而非内置默认根：
			 * 用户改了「默认存储路径」后，新根下放的项目级技能要能被发现，
			 * 与设置项口径一致（否则改完路径技能就找不到了）。
			 */
			cwd: getEffectiveWorkspaceRoot(),
			agentDir: getConfigDir(),
			skillPaths: sessionSkillPaths(BUILTIN_SKILL_DIRS, expertSkillsDir),
			includeDefaults: true,
		});
		return skills.map((s): SkillEntry => {
			// origin 只分「随包」与「用户自装」两类：插件技能也是随包分发的，
			// 归 builtin（它的来龙去脉在 resources/plugins/README.md，不在这个字段里）。
			const origin = BUILTIN_SKILL_DIRS.some((dir) => s.filePath.startsWith(dir)) ? "builtin" : "user";
			const meta = readSkillMeta(s.filePath);
			/*
			 * 安装元数据只对**自装且经技能页导入**的技能存在（sidecar 写在技能目录里）。
			 * 内置技能不该有、手工放进技能目录的技能没有 —— 两种都没有 sidecar，
			 * 于是 installedAt / sourcePath 不带字段，卡片按「手工放置」呈现。
			 */
			const installed = origin === "user" ? readInstalledMeta(dirname(s.filePath)) : undefined;
			/*
			 * version 以 SKILL.md 为准（技能自身的真源，用户可能手改过），
			 * sidecar 里那份安装时的记录只在 SKILL.md 没声明时兜底。
			 */
			const version = meta.version ?? installed?.version;
			return {
				name: s.name,
				description: s.description,
				filePath: s.filePath,
				origin,
				disableModelInvocation: s.disableModelInvocation,
				userInvocable: meta.userInvocable,
				// 元数据缺失即不带字段（不填默认值）——UI 据此留白，不显示伪造值。
				...(version === undefined ? {} : { version }),
				...(installed?.installedAt === undefined ? {} : { installedAt: installed.installedAt }),
				...(installed?.sourcePath === undefined ? {} : { sourcePath: installed.sourcePath }),
			};
		});
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
	// 第三个参数是全局技能根（我们自己写的 + 照搬的插件技能）：私有技能与它们重名
	// 要在加载期拦下（spec: 专家技能重名防护）。
	return loadExperts(join(getResourcesDir(), "experts"), join(getConfigDir(), "experts"), BUILTIN_SKILL_DIRS);
}

/**
 * 会话技能来源的**单一出口**：语义 = `listSkills(绑定专家的私有技能目录)`，
 * 未绑定专家时就是全局技能池。
 *
 * 为什么必须同源：清单段是模型看到的「有哪些技能」，use_skill 是它唯一能兑现这句话
 * 的手段 —— 两处各读一份盘，模型就会看到清单里有、工具却加载不了的技能（或反之）。
 *
 * 为什么**不**用 SessionHost 自持的 `resourceLoader.getSkills()`（其 skillDescriptors
 * getter，当前无消费方）：那份是宿主按自己的加载路径发现的第三个技能集，与清单段走的
 * listSkills（内置 + 用户 + 可选专家私有）并不一致 —— 用它等于再制造一个来源，
 * 与「工具与提示词一致」正好相反。该 getter 保持无消费方。
 *
 * 每次现读不缓存：与 listSkills 同一口径，导入新技能后下一次工具调用/下一轮对话即生效。
 */
async function sessionSkills(expertId: string | undefined): Promise<SkillEntry[]> {
	// expertId 缺失时**短路**：未绑专家的会话不该走专家库读路径（专家库加载从紧，
	// 坏专家文件抛错——与 composeSystemPrompt 里那次短路同一个理由）。
	if (expertId === undefined) return listSkills();
	return listSkills(resolveSessionExpert(loadExpertsNow(), expertId)?.skillsDir);
}

/**
 * 会话技能的两面视图（spec: add-skill-management）：
 *   all     —— 全量，逐项标注用户级启停（技能页/快照口径）
 *   enabled —— 过了用户开关的集合（清单段 / `/` 菜单 / use_skill 判定口径）
 *
 * 一次读盘、一份 overrides 同时算出两面：分两次读会出现「读盘 A 时启用、过滤时已被关掉」
 * 的瞬时错位；两次读偏好同理（每轮 compose 都在走这条路径）。
 */
async function skillSets(expertId: string | undefined): Promise<{
	readonly all: readonly SkillInfo[];
	readonly enabled: readonly SkillInfo[];
}> {
	const overrides = readPreferences().skillOverrides;
	const all: SkillInfo[] = (await sessionSkills(expertId)).map((skill) => ({
		...skill,
		enabled: isSkillEnabled(skill.name, overrides),
	}));
	return { all, enabled: filterEnabledSkills(all, overrides) };
}

/**
 * 已启用技能的**单一出口**。清单段、`/` 菜单、use_skill 的可加载集合都必须从这里取
 * —— 三处各写一份过滤，迟早出现「菜单里有但 use_skill 加载不了」。
 *
 * 技能页与 `skills:snapshot` **不走这里**（它们要全量，包括被停用的，否则开关没有落点）。
 */
async function enabledSkills(expertId: string | undefined): Promise<readonly SkillInfo[]> {
	return (await skillSets(expertId)).enabled;
}

/**
 * SkillInfo → use_skill 工具的技能描述符（工具认五个字段，不关心 origin / userInvocable）。
 * 两个注册点（用户会话 / 定时 run 会话）共用，字段集不会各自漂移。
 *
 * 传的是**全量**（含停用，逐项带 enabled）：工具要能分辨「没有这个技能」与
 * 「这个技能被停用了」，两者给用户的行动项不同（见 extensions/use-skill-tool.ts）。
 * 同源没有被破坏 —— enabled 与 enabledSkills() 出自 skillSets() 的同一次判定。
 */
async function toUseSkills(expertId: string | undefined): Promise<UseSkillTarget[]> {
	return (await skillSets(expertId)).all.map((s) => ({
		name: s.name,
		description: s.description,
		filePath: s.filePath,
		disableModelInvocation: s.disableModelInvocation,
		enabled: s.enabled,
	}));
}

/**
 * SkillInfo → 提示词组装用的技能描述符。三个调用点（真实组装 / 提示词预览 / 快照成本）
 * 共用同一份映射：字段集一旦分叉，就会出现「预览漏字段」「成本算少一截」这类静默漂移。
 */
function toSkillDescriptors(
	skills: readonly Pick<SkillInfo, "name" | "description" | "filePath" | "disableModelInvocation">[],
): SkillDescriptor[] {
	return skills.map((s) => ({
		name: s.name,
		description: s.description,
		filePath: s.filePath,
		// 这一项不能省：pi 的 formatSkillsForPrompt 靠它把 disable-model-invocation
		// 的技能从清单段过滤掉 —— 曾经在这里降维成三字段丢掉它 = 过滤整条失效，
		// 声明「模型不可调用」的内部技能照样进提示词。
		disableModelInvocation: s.disableModelInvocation,
	}));
}

/**
 * 技能快照的**唯一组装点**：`skills:snapshot`（打开技能页）与 `skills:set-enabled`
 * （切开关后返回新快照）共用同一份，免得两处各算一遍、算出不同的数字
 * （spec: 技能快照契约 —— 列表、开关状态、成本数字都来自同一次拉取）。
 *
 * 口径 = **全量**（含被停用的，逐项带 enabled）：技能页是开关的落点，
 * 只给已启用的会让用户再也打不开。
 *
 * 成本用 computeSkillsCost（= formatSkillsSection + estimateTokens，与真实注入同一份
 * 组装逻辑）对**已启用**技能算 —— 渲染层不另算一套，否则两个数字会慢慢分家。
 */
async function buildSkillsSnapshot(): Promise<SkillsSnapshot> {
	const { all, enabled } = await skillSets(undefined);
	const cost = await computeSkillsCost(toSkillDescriptors(enabled));
	return {
		skills: all,
		userSkillsDir: userSkillsDir(),
		enabledCount: cost.enabledCount,
		skillsTokens: cost.skillsTokens,
		// 未超阈值就不带这个字段（渲染层据此决定有没有提示条），而不是带一个空串。
		...(cost.warning === undefined ? {} : { warning: cost.warning }),
	};
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
 * 个性化注入段单点现读（buildRuntimeContext 的唯一读点）。
 * 只投 4 个注入字段：两个 boolean 是 UI 开关不进模型可见文本
 * （core/prompt-composer.ts PersonalizationSection 的注释钉住了这条）。
 * 每轮现读偏好：设置页改完下一次模型调用即生效（同技能清单/风格口径）。
 */
function readPersonalizationSection(): PersonalizationSection {
	const prefs = readPreferences();
	return {
		...(prefs.customInstructions !== undefined ? { customInstructions: prefs.customInstructions } : {}),
		...(prefs.userNickname !== undefined ? { userNickname: prefs.userNickname } : {}),
		...(prefs.assistantName !== undefined ? { assistantName: prefs.assistantName } : {}),
		...(prefs.personaDescription !== undefined ? { personaDescription: prefs.personaDescription } : {}),
	};
}

/**
 * 逐轮可变事实注入块单点现读（prompt-switch 的 `context` 事件每请求取一次，
 * 见 extensions/prompt-switch.ts 的 composeRuntimeContext）：三层记忆内容 + 个性化。
 * 两段都走读侧既有的降级口径（记忆读不出当没有、偏好读不出当未配置），
 * 因为 `context` handler 抛错会被 pi 吞掉 —— 这里不制造会被吞的异常。
 *
 * 时间**不在这里**：会话内时间只有 hidden context 的 `current_time` 一个来源
 * （session-host.ts，run 开始冻结；spec: stabilize-prompt-prefix 的时间收敛）。
 *
 * 与 composeSystemPrompt 同源现读：设置页改完个性化、模型自己写完记忆，
 * 下一次模型调用就带上新值（run 内的后续回合同样如此，这正是「逐请求注入」
 * 比「每 run 冻结一份」更准的地方）。
 */
function buildRuntimeContext(cwd: string): string {
	return formatRuntimeContext({
		memoryContent: buildSessionMemorySection(cwd),
		personalization: readPersonalizationSection(),
	});
}

/**
 * 系统提示词的**唯一组装入口**。用户会话与定时任务 run 会话共用 ——
 * 提示词是产品身份，两条会话形态必须同一份组装逻辑，不能各写一遍漂移。
 * token 估算随返回值带出，由调用方决定记不记（用户会话要喂上下文成分统计，
 * run 会话没有诊断视图、直接丢弃）。
 *
 * 组装**本体**（骨架 / 片段 / 模式 / 风格 / 人格 / 技能清单 / 记忆纪律段的段序
 * 与护栏）在 core/system-prompt-composer.ts —— 这里只把 daemon 侧的三样来源接上
 * 去（专家库现载 / 已启用技能 / 风格漂移落事件日志），**返回值不得再加工**：
 * 系统提示词位于整段对话历史之前，多拼一处逐轮可变的事实就等于每轮断掉
 * provider 的前缀缓存（spec: stabilize-prompt-prefix），而 daemon 这层门禁测试
 * 看不见（daemon 顶层要 process.parentPort，import 不进来）——所以「能加工的
 * 只有组装本体」本身就是护栏。
 *
 * **组装产物不含逐轮会变的事实**：运行时间、三层记忆内容、个性化都不进系统
 * 提示词 —— 记忆内容与个性化由 buildRuntimeContext 组装、经 prompt-switch 的
 * `context` 事件作为消息注入，时间由会话侧 hidden context 的 `current_time`
 * 每轮注入（session-host.ts）。工作目录同样不进提示词：工作目录的唯一来源是
 * hidden context 的 workspace_context。
 *
 * **随机器变的事实同样不在这里**：托管运行时的清单与状态（venv 重建 / 换机器 /
 * 换安装位置 / 用户切开关都会改字节）由会话侧 hidden context 的 `python_env` 段送达
 * —— 见 SessionHost.create 的 `getRuntimeInventory` 入参与其注释。
 */
const composeSystemPrompt = createSystemPromptComposerFromDefaults({
	resourcesDir: getResourcesDir(),
	loadExperts: loadExpertsNow,
	// 每轮现读技能清单：导入新技能后下一轮对话即生效，无需重启。
	enabledSkills: async (expertId) => toSkillDescriptors(await enabledSkills(expertId)),
	// 风格配置漂移记进事件日志：降级可以是体验取舍，但不能无痕。
	onStyleDrift: ({ requested, fallback }) => {
		eventLog.append({ kind: "style_drift", requested, fallback });
	},
});

/* ── 会话 ─────────────────────────────────────────────────────────── */

/**
 * 新建任务的默认 cwd 来源（applyWorkspace 的唯一语义）。
 *
 * 多任务并发后「当前工作空间」不再等于「当前会话的 cwd」：会话与 cwd 终身
 * 绑定（cwd 在建会话时一次性注入 pi 的工具集），切换工作空间只决定**后续
 * 新建任务**落在哪，既有会话原地不动（WorkBuddy 同模型）。
 *
 * 空串 = **待分配**：未选工作空间的新任务不预设目录，首次执行（真正建宿主）时
 * 才在生效根下分配独立时间戳目录（spec: align-per-task-dirs）。不再默认指向
 * 共享临时目录 `<根>/临时任务`（已退役为历史目录）。
 */
let defaultWorkspaceDir: string = "";

/**
 * 新建任务的 worktree 基准分支（INVOKE.setWorktreeBranch 的唯一语义，对齐清单 C22/L27）。
 *
 * 与 defaultWorkspaceDir 同构 —— 两者都只决定**后续新建任务**怎么起，既有会话
 * 原地不动。两处差异：
 *
 *   1. 工作空间是「落在哪」，worktree 是「怎么落」；后者依赖前者（没有仓库目录
 *      就无从建副本），所以只有在新任务同时具备非空 cwd 且该 cwd 是 git 仓库时才
 *      真建副本，见 createHost。
 *   2. 新建任务**不重置它**（与 defaultWorkspaceDir 相反）：空间选择在「新建任务」
 *      时清空是产品语义（不绑定空间），而副本开关是「我习惯在隔离副本里干活」的
 *      偏好，连续开几个任务都该沿用。用户主动关掉才归 undefined。
 */
let pendingWorktreeBranch: string | undefined;

/**
 * 历史共享临时目录 `<根>/临时任务`。**现算不缓存**：生效根 = env > 设置项 > 内置
 * 默认（getEffectiveWorkspaceRoot 每次现读偏好文件），用户改默认存储路径后即刻用新根。
 *
 * 新任务不再落这里（改用自动分配目录，见 defaultWorkspaceDir）；唯一保留的用途是
 * resume 时把旧 playground 占位会话迁移到这个历史任务目录（见 resumeSessionOnce）。
 */
function tempTasksDir(): string {
	return getTempTasksDir(getEffectiveWorkspaceRoot());
}

/**
 * docx 引擎 Python 运行时的装配四元组（托管根 / 家目录 / 平台 / 引擎目录）。
 * 现算不缓存：KAMIBUDDY_CONFIG_DIR、KAMIBUDDY_RESOURCES_DIR 等 env 覆盖在测试与
 * 多环境下可换。拼法只有 core/runtimes/python.ts 一处（防重复）。
 */
function pythonRuntimeOptions(): RuntimeOptions {
	return defaultPythonRuntimeOptions();
}

/**
 * 托管运行时清单 → 会话 hidden context 的 `python_env` 段（模型侧可见性，
 * spec: add-managed-runtimes 阶段 5）。**函数形态**：宿主按会话建一次，取函数
 * 才能让设置页的开关切换在下一次 run 的注入里立即生效（无需重启会话）。
 *
 * 清单的判据只有一处（core/runtime-inventory.ts）：开关读同一份偏好、
 * 状态看同一份磁盘事实 —— 「被用户禁用」与「找不到」在那里就已区分。
 */
function runtimeInventoryForSession(): RuntimeInventory {
	return collectRuntimeInventory();
}

/**
 * 模型 shell 的环境补丁（SubTask 2.1.3）：启用且就绪的运行时 → PATH 前置目录 +
 * `KAMIBUDDY_*` 变量。判据在核心侧一处（`planRuntimeShellInjection`，读的是
 * 设置页同一份开关与各描述符的落点），本函数只把它交给执行器。
 *
 * **函数形态**：执行器每次执行现算，设置页改开关后下一次命令即生效
 * （与 `runtimeInventoryForSession` 同一条理由）。补丁只进**子进程**环境
 * —— 沙箱路径与降级直连 spawn 都从这里取，daemon 自己的 `process.env` 不变。
 */
function runtimeShellEnv(): Readonly<Record<string, string>> {
	return planRuntimeShellInjection().env;
}

/**
 * 「该 cwd 归任务区（临时任务）」的判定。口径收在 workspace-model.ts 的 isTaskCwd：
 * 待分配空串 / 自动分配目录 / 历史共享临时目录 / 旧 playground 占位。
 *
 * 两点口径注意：
 *   - **不比对生效根**（spec: align-per-task-dirs）：用户改默认存储路径后，旧任务
 *     （cwd 在原根下）依旧归任务区，不再整体漂到空间区。
 *   - **生效根本身不算任务区**（2026-09-15）：cwd = 根归空间区成组 —— 对齐 WorkBuddy
 *     （论证见 isTaskCwd 注释）。【2026-09-15 订正】该状态现在只来自「打开本地文件夹…」
 *     或旧会话 —— picker 里指向根的固定项已删（WorkBuddy 没有那项）。
 * 这里只负责现读配置目录（可能因设置变更而变），形态规则本身在纯函数里（可单测）。
 */
function isTempCwd(cwd: string): boolean {
	return isTaskCwd(cwd, getConfigDir());
}

/**
 * resume 之后「新建任务」的默认落点：工作空间会话沿用其 cwd（同一空间开新活），
 * 任务私有目录（自动分配目录 / 历史共享临时目录 / 旧 playground）一律回到**待分配**
 *（空串）—— 否则新任务会落进某个具体任务的目录，既破坏「每任务独立目录」，
 * 也让转正 rename 会连带新任务。生效根本身仍是工作空间语义，照旧沿用。
 */
function defaultCwdAfterResume(cwd: string): string {
	return isTaskPrivateCwd(cwd, getConfigDir()) ? "" : cwd;
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
	// 历史会话归一：旧会话的 interactionId 可能是已删除的 "expert" 模式，
	// 落到 craft 并用原 expertId 保留专家身份（见 normalizeLegacyInteraction）。
	const axes = normalizeLegacyInteraction(interactionId, expertId);
	return {
		state: {
			sessionId: "",
			// 未选工作空间时 cwd 为空串 = 待分配：首次执行（建宿主）时才分配独立时间戳
			// 目录（见 createHost），此刻不落盘。空串同样被 isTempCwd 判为任务区。
			cwd,
			isTempTask: isTempCwd(cwd),
			sceneId,
			interactionId: axes.interactionId,
			// 专家绑定与交互模式正交：无专家时不占字段（可选契约）。
			...(axes.expertId === undefined ? {} : { expertId: axes.expertId }),
			modelId: activeModelKey,
			isStreaming: false,
		},
		entries: [],
		availableScenes: SCENES,
		availableModes: INTERACTIONS,
		welcome: WELCOME,
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
	spawnBudget: readPreferences().spawnBudget,
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
		// 领导桶逐出即解散团队（spec: add-team-foundations 批 5 v1 决策）：
		// 成员产出要回投领导，领导宿主没了就是断了回投线 —— 留着只会烧钱。
		void disbandTeamOf(bucket.sessionId);
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
 * 聚合口径是台账全历史累计（启动回放重建，重启不清零，
 * 见 core/observability.ts 的文件头；spec: add-observability-ledger Task 3）。
 */
const eventLog = new EventLog(join(getConfigDir(), "logs"));
const observability = new ObservabilityStore();

/**
 * 运行台账目录（每会话一份 NDJSON，spec: add-observability-ledger）。
 * 启动即做中断合成闭合：上次进程死在一个开着的 run 上（含冷会话——
 * 它们等不到 resume 才补），补一条合成 run_end{reason:"interrupted"}，
 * 否则投影回放会把那些 run 当成「至今仍在跑」（dsh：中断闭合优于截断）。
 */
const runLedgerDir = join(eventLog.dir, "runs");
RunLedger.sealOrphans(runLedgerDir, (file, message) => {
	eventLog.append({ kind: "run_ledger_error", file, message });
});
// 启动回放重建聚合（重启不清零）。必须在 sealOrphans 之后：中断的 run 先补
// 合成闭合，回放才不会把它们当成「至今仍在跑」（observability.replayLedgerDir 注释）。
observability.replayLedgerDir(runLedgerDir, (message) => {
	eventLog.append({ kind: "run_ledger_error", message });
});

/**
 * 诊断页单次下发的台账条目上限（stats:run-ledger）：文件只增不减，
 * 不设上限全量回读会随会话变长越拉越大；截尾保留最新（时间线看的就是近况）。
 */
const RUN_LEDGER_IPC_LIMIT = 500;

/** 台账会话选择器列表（stats:run-ledger）：按文件 mtime 新的在前。 */
function listLedgerSessionIds(): string[] {
	return listLedgerFiles(runLedgerDir)
		.map((path) => {
			let mtime = 0;
			try {
				mtime = statSync(path).mtimeMs;
			} catch {
				// 读到一半文件被清走的竞态：mtime 按 0 排尾，不炸整个列表。
			}
			return { id: basename(path, ".jsonl"), mtime };
		})
		.sort((a, b) => b.mtime - a.mtime)
		.map((s) => s.id);
}

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
/** 会话归档索引（L28）：path → 归档时刻；会话文件不动，列表标注与恢复走它。 */
const sessionArchive = new SessionArchive();

const automationScheduler = new AutomationScheduler({
	store: automationStore,
	execute: createAutomationRunExecutor({
		getCatalog,
		getModelKey: () => activeModelKey,
		resources: RESOURCES,
		// 定时任务 run 会话保持 work+craft 不起专家（spec: rework-expert-orthogonal-and-skills
		// —— 专家绑定是会话级 UI 状态，无人值守会话没有人格入口），expertId 恒 undefined。
		compose: async (_cwd, sceneId, interactionId, piContext) =>
			(await composeSystemPrompt({ sceneId, interactionId, expertId: undefined, piContext })).prompt,
		// run 会话同样是多轮会话，逐轮可变事实走注入（提示词里不再有它们）——
		// 注入块按 run 的 cwd 现读记忆与个性化，与用户会话同一个组装函数。
		composeRuntimeContext: buildRuntimeContext,
		getPermissions: () => activePermissions,
		// 全局默认推理强度现读偏好不缓存：run 会话建宿主才走这条读路径，
		// 不在热路径上（与 activePermissions 的模块级缓存不同 —— 那个每次
		// 工具调用都要读）。用户在设置页改完，下一次 run 即刻生效。
		getThinkingLevel: () => readPreferences().thinkingLevel,
		// 托管运行时清单 → run 会话 hidden context 的 python_env 段。run 会话的
		// 提示词同样是 work 骨架（含 python-env 片段），模型需要这条才知道该用
		// 哪个解释器（值与用户会话同一处取值：collectRuntimeInventory）。
		getRuntimeInventory: runtimeInventoryForSession,
		protectedDirs: PROTECTED_DIRS,
		isTempCwd,
		isOwnWorkspace: (dir) =>
			isPathInside(getEffectiveWorkspaceRoot(), dir) || isPathInside(getConfigDir(), dir),
		getWebSearchConfig,
		// run 会话恒不绑专家，技能就是全局池 —— 但仍走技能单一出口 skillSets
		//（与它自己的提示词技能清单段同源，见 skillSets / enabledSkills 注释）。
		resolveSkills: () => toUseSkills(undefined),
		// 工具结果落盘失败的上报：run 会话与用户会话同一个 spill 钩子，
		// 失败口径也必须一致（否则「无人值守下结果丢了」在 event-log 里没有痕迹）。
		reportSpill: (message) => eventLog.append({ kind: "tool_result_spill_error", message }),
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
	// 与工作空间同一条判定（绝对路径 + 存在时要是可访问的目录；无目录黑名单）。
	const cwdError = validateWorkspacePath(cwd);
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

/**
 * 「prompt 已受理」的等待者（按桶）：prompt IPC 改为受理即回后，
 * emitSessionEvent 见到 run_started 就解闸该桶上等待的提交方
 * （见 INVOKE.prompt 的 accepted 注释）。
 */
const runStartWaiters = new WeakMap<SessionBucket<SessionHost>, Set<() => void>>();

function emitSessionEvent(bucket: SessionBucket<SessionHost>, event: SessionEvent): void {
	// resume 降级打开的桶：把 skippedLines 并入该桶发出的每个 session_state ——
	// 宿主侧的 emitState 不知道这回事（它是桶级事实不是会话状态），
	// 而 state 是整体替换语义，不并入的话下一次 emitState 就把提示抹掉。
	if (
		event.type === "session_state" &&
		bucket.skippedLines !== undefined &&
		event.state.skippedLines === undefined
	) {
		event = {
			type: "session_state",
			state: { ...event.state, skippedLines: bucket.skippedLines },
		};
	}
	/*
	 * worktree 副本身份同口径并入（对齐清单 C22 / L27）：它是桶级事实
	 *（建宿主时定下），宿主侧的 emitState 不知道有这回事，而 state 是整体替换
	 * 语义 —— 不并入的话下一次 emitState 就把副本身份抹掉，界面会在对话中途
	 * 突然显示「不在副本里」，而文件其实一直在副本里改。
	 */
	if (event.type === "session_state" && bucket.worktree !== undefined) {
		event = {
			type: "session_state",
			state: { ...event.state, worktree: bucket.worktree },
		};
	}
	// 折叠进**该会话**的桶：多任务并发后后台会话的事件不能污染当前视图
	//（renderer 按信封 sessionId 折叠进各自的缓存，daemon 侧同口径）。
	bucket.conversation = conversationReducer(bucket.conversation, { type: "event", event });
	// 运行态以折叠结果为准（reducer 在 run 边界与 session_state 上维护 isStreaming，
	// 宿主又是从自家 run 记账算的 —— 两条路径同一个真相，取折叠值不另开口径）。
	bucket.running = bucket.conversation.state.isStreaming;
	observability.record(bucket.sessionId, event);
	eventLog.append({
		kind: "session_event",
		sessionId: bucket.sessionId,
		event: sanitizeForLog(event),
	});
	const envelope: SessionEventEnvelope = { sessionId: bucket.sessionId, event };
	post({ kind: "push", channel: PUSH.sessionEvent, payload: envelope });

	// run 边界推全量任务列表：侧栏的 running 标记靠它即时刷新（契约见 shared/ipc.ts）。
	// run_error 也是 run 边界（出错同样终止流式态）—— 漏了它侧栏的转圈会一直转到
	// 下一次 run 边界（2026-09-17 用户实测：中断出错后任务行一直在转）。
	if (event.type === "run_started" || event.type === "run_finished" || event.type === "run_error") {
		pushTaskListChanged();
		if (event.type !== "run_started") evictIdleHosts();
	}
	// prompt IPC 的「受理即回」：run_started 解闸对应桶上等待受理的提交方
	//（见 INVOKE.prompt 的 accepted 注释）。
	if (event.type === "run_started") {
		const waiters = runStartWaiters.get(bucket);
		if (waiters !== undefined) {
			for (const waiter of waiters) waiter();
		}
	}

	// 带用量的 session_state 到达后补发明细：used/total 是 pi 的精确值（刚折叠进
	// 桶的 conversation.state），分类所需的系统提示词/技能段 token 只有这里知道。
	// context_usage 自身不会再触发本分支，无递归。
	if (event.type === "session_state" && event.state.contextUsage !== undefined) {
		emitContextUsageDetail(bucket, event.state.contextUsage);
	}

	/*
	 * 会话统计也在 session_state 到达时补推一条。
	 *
	 * session_state 是「会话身份变更」的信号（切换 / 重挂载 / 新建都走它），
	 * 而 reducer 在 sessionId 变化时会清掉旧会话的统计 —— 没有这条补推，
	 * 切回一个有历史台账的会话要等到下一次 llm_call 才有数字，用户看到的是
	 * 指标条一直空着。用 event.state.sessionId（权威 state）而不是
	 * bucket.sessionId：adoptHost 换桶的时序不保证两者此刻已经一致。
	 *
	 * 与 context_usage 同款：递归调用一次 emitSessionEvent，但事件类型已成
	 * session_stats，不会再进本分支，无递归。session_state 每天只有几十条
	 *（实测 87/天），不必节流。
	 */
	if (event.type === "session_state") emitSessionStats(bucket, event.state.sessionId);
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
 * 推一条会话统计（聊天页底部常驻指标条的数据源）。
 *
 * 取数只有这一处：session_state 的补推与台账 fold 钩子都走它，
 * 免得两个调用点各取一次、日后口径漂移。
 *
 * 没有台账（新会话还没跑过任何一轮）时**不推** —— reducer 与组件都按
 * undefined 整行不渲染，推一张全零卡会让界面显示「0 轮 · 0 步」。
 */
function emitSessionStats(bucket: SessionBucket<SessionHost>, sessionId: string): void {
	const stats = observability.sessionCard(sessionId);
	if (stats === undefined) return;
	emitSessionEvent(bucket, { type: "session_stats", stats });
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
	/*
	 * 基础文案（任何情况都成立）：权限判定发生在工具调用前，不是 OS 隔离。
	 * 沙箱只加固了 powershell 的**写**范围，不改变这条的性质。
	 */
	const base =
		"权限由 KamiBuddy 在工具调用前判定：" +
		"它能拦住助手主动的读写与命令，但不能约束已运行程序的行为。" +
		"凭据目录（.ssh/.gnupg/.aws 等）在任何档位下都禁止读写。";

	/*
	 * 沙箱状态：读**最近一次**的结论，与具体档位无关。
	 *
	 * 为什么这里只能是「最近一次」而不是「当前工作区」：权限设置是全局的，
	 * 设置页也不属于任何一个会话 —— 本函数没有「当前是哪个工作区」的上下文。
	 * 多工作区并存时（切换工作区、临时任务），这段文案可能说的是另一个工作区
	 * 的情况。这是**展示文案**可以接受的近似。
	 *
	 * **判据不能这么读**：审批放松一律走 isSandboxReadyFor(cwd) 按工作区问 ——
	 * 读全局值就是 2026-09-16 修掉的那个 bug 的形状（陈旧的 available:true
	 * = 在没有写约束的工作区里免审批执行命令）。
	 */
	const sandbox = latestSandboxDiagnostics?.diagnostics;
	let sandboxNote = "";
	if (sandbox !== undefined) {
		sandboxNote = sandbox.available
			? // 说清「加固了什么」也说清「没加固什么」——只讲前半句会让用户
				// 以为这是完整隔离，那正是 pi security.md 警告的错误安全感。
				"　命令执行（PowerShell）已受操作系统级写入约束：" +
				"工作目录之外的写入会被系统拒绝，即使你批准了该操作。" +
				"读取与联网**不受**此约束。"
			: `　命令执行未受操作系统级写入约束（${describeSandboxReason(sandbox.reason)}），` +
				"写入范围仅由上述权限判定把关。";
	}

	return {
		settings,
		/*
		 * **恒为 partial，不因沙箱生效而改成 full。**
		 * WRITE_RESTRICTED 机制上只约束写：读与网络完全不受约束（已实测），
		 * 且存在 Everyone 环境写 ACE 与 NTFS 硬链接两个已知缺口
		 * （见 docs/ARCHITECTURE.md §4.4b 的已知边界）。
		 */
		enforcement: "partial",
		// 沙箱状态并进这段文案（设置页整段渲染）；机器可读的诊断在事件日志的
		// sandbox_status 里，不另开没有读取方的结构化字段。
		enforcementNote: `${base}${sandboxNote}`,
		// 授权成本单列一段：它只进设置页，**不进 chip 的 hover 提示**
		//（permission-menu 也读 enforcementNote，那里塞一串数字是噪音）。
		...(latestSandboxDiagnostics?.diagnostics.prepare === undefined
			? {}
			: {
					sandboxPrepareNote: sandboxPrepareNoteOf(
						latestSandboxDiagnostics.workspace,
						latestSandboxDiagnostics.diagnostics.prepare,
					),
				}),
	};
}

/**
 * 「首次授权为什么要等」那段文案。
 *
 * 用户 2026-09-17 报的现象是「发送后白好一会才动」（实测 19.7 秒），
 * 而这句话要回答两件事：**这次等了多少**、**为什么**（目录条目数）、
 * 以及**会不会每次都这样**（不会：ACE 常驻，之后是幂等命中）。
 * 三件事缺一件，用户就会以为「这个应用很慢」而不是「这个大目录第一次要准备一下」。
 *
 * 用秒而不是毫秒：这一段讲的是「几十秒」量级的等待，1,547ms 这种精度没有意义。
 */
function sandboxPrepareNoteOf(workspace: string, prepare: SandboxPrepareReport): string {
	const seconds = Math.max(0, prepare.elapsedMs) / 1000;
	const cost = seconds >= 10 ? `${Math.round(seconds)} 秒` : `${seconds.toFixed(1)} 秒`;
	/*
	 * entries 缺省 = 这次授权没走 worker（进程内直调，测试/冒烟路径），
	 * 那就只说耗时 —— 编不出条目数，也不该编。
	 */
	const scale =
		prepare.entries === undefined
			? ""
			: `（目录内约 ${prepare.entries.toLocaleString("zh-CN")} 个条目${prepare.capped === true ? "，已达扫描上限，实际更多" : ""}）`;
	const state = prepare.fastPath
		? "幂等命中，未重新传播"
		: "首次为该目录传播写入权限";
	return (
		`　最近一次沙箱授权：${workspace} —— ${state}，耗时 ${cost}${scale}。` +
		"同一目录此后每次都是毫秒级（权限标记常驻）。"
	);
}

/**
 * 沙箱可用性诊断，**按工作区**记。
 *
 * 【2026-09-16 修一个真 bug】这里原本是一个模块级单值，注释写着「『这台机器能不能
 * 用受限令牌』与会话无关」—— 那句话**不成立**：可用性还取决于工作区所在卷能不能
 * 承载 ACL（FAT/exFAT 上授权会「成功」但毫无效果），以及该目录的 ACL 授权是否
 * 真的成功。而 daemon 里同时存在多个工作区（切换工作区、临时任务会话、子代理），
 * 于是后一个会话的结论会覆盖前一个。
 * （`sandbox/index.ts` 的 probe 缓存是同一个根源的同一个 bug，一起修的。）
 *
 * 当时的后果只是设置页显示不准。但**审批放松要拿这个事实当判据** —— 那时读到
 * 跨工作区的陈旧 `available: true`，就等于「在没有写约束的工作区里免审批执行命令」。
 *
 * 键按小写路径（Windows 大小写不敏感）。条目数由用户行为界定（几个工作区）。
 */
const sandboxDiagnosticsByWorkspace = new Map<string, SandboxDiagnostics>();

/**
 * 最近一次的诊断结论**与它对应的工作区**，**仅供设置页的全局文案**。
 *
 * 为什么还留一个全局值：`buildPermissionInfo` 没有「当前是哪个工作区」的上下文
 * （权限设置是全局的，设置页也不属于某个会话）。所以那段文案只能表达
 * 「最近一次探测到的情况」—— 多工作区并存时它可能指的是另一个工作区。
 * 这只是**展示**的近似；执行层的沙箱可用性由 runner 执行时现场探测决定
 * （对齐 dsh 的 confine 同构），不依赖这个全局值。
 *
 * 工作区路径与结论**存在同一个对象里**（而不是两个模块级变量）：成本文案
 * 必须说清「是哪个目录花了 19 秒」，两者一旦分开存，就会出现「A 的耗时配 B 的路径」。
 */
let latestSandboxDiagnostics:
	| { readonly diagnostics: SandboxDiagnostics; readonly workspace: string }
	| undefined;

/** 原因枚举 → 给用户看的一句话。不把枚举名直接抛给界面。 */
function describeSandboxReason(reason: SandboxUnavailableReason | undefined): string {
	switch (reason) {
		case "not-windows":
			return "当前系统不是 Windows";
		case "ffi-load-failed":
			return "系统调用组件加载失败";
		case "token-creation-failed":
			return "受限令牌创建失败";
		case "acl-grant-failed":
			return "工作目录授权失败";
		case "unsupported-filesystem":
			return "工作目录所在磁盘不支持权限控制";
		case "process-start-failed":
			// 说「启动自检未通过」而不是「进程起不来」：后者像是用户的命令有问题，
			// 而这其实是沙箱环境的问题，且此时命令仍可正常执行（已降级）。
			return "命令执行环境的启动自检未通过";
		case "prepare-worker-failed":
			// 「授权组件」= 跑授权那条 worker（见 sandbox-prepare-client.ts）。
			// 说清是「组件没起来」而不是「授权被拒」——两者的排查方向完全不同。
			return "授权组件未能启动";
		case "disabled-by-setting":
			return "已被设置关闭";
		default:
			return "原因未知";
	}
}

/**
 * 记录沙箱诊断。同一结论只落一次日志 —— 每个会话都装一个执行器，
 * 各自去重也会在多会话时重复刷日志。
 */
function recordSandboxDiagnostics(diagnostics: SandboxDiagnostics, cwd: string): void {
	const key = cwd.toLowerCase();
	/*
	 * 去重也按工作区（原先是全局比较）：否则工作区 A 的结论会把工作区 B 的
	 * 首次结论压掉 —— 而那两条恰恰可能不同（一个 NTFS、一个 U 盘），
	 * 日志里就永远看不到后者。
	 */
	const previous = sandboxDiagnosticsByWorkspace.get(key);
	sandboxDiagnosticsByWorkspace.set(key, diagnostics);
	latestSandboxDiagnostics = { diagnostics, workspace: cwd };
	if (
		previous !== undefined &&
		previous.available === diagnostics.available &&
		previous.reason === diagnostics.reason &&
		// 授权成本也是「有新东西可看」的一种：首次授权（几十秒）与幂等命中（毫秒）
		// 的 available/reason 完全一样，只看那两个字段的话这次测量就永远不进日志。
		previous.prepare === undefined
	) {
		return;
	}
	eventLog.append({
		kind: "sandbox_status",
		available: diagnostics.available,
		...(diagnostics.reason === undefined ? {} : { reason: diagnostics.reason }),
		...(diagnostics.detail === undefined ? {} : { detail: diagnostics.detail }),
		...(diagnostics.prepare === undefined
			? {}
			: {
					prepare: {
						elapsedMs: diagnostics.prepare.elapsedMs,
						fastPath: diagnostics.prepare.fastPath,
						...(diagnostics.prepare.entries === undefined
							? {}
							: { entries: diagnostics.prepare.entries }),
						...(diagnostics.prepare.capped === undefined
							? {}
							: { capped: diagnostics.prepare.capped }),
					},
				}),
		cwd,
	});
}

/**
 * 落盘前把流式增量的正文收成长度——逐字 / 逐块全记会把日志撑爆且没有信息量，
 * 真正要查的是事件序列与终态，不是每个字符。
 *
 * 「哪些事件要收」由 shared 的 `isStreamingEvent` 给（**名单唯一处**）：这份
 * 名单曾在本文件与 renderer 的两个页面里各写一遍，且都漏了
 * `tool_stream_progress` —— 它的 `rawArgs` 是**累积**的参数全文
 *（`core/session-host.ts` 每来一个参数 delta 就 emit 一次全文），逐条全记是
 * 平方级字节量，实测单日 3 万条把 events-*.jsonl 撑到 26 MB。
 *
 * 字段处理各按类型：三种带 `delta` 的收成 `(N chars)`；
 * `tool_stream_progress` 只收 `rawArgs` —— `path` / `added` / `changeType`
 * 是有信息量的小字段，照留。
 */
function sanitizeForLog(event: SessionEvent): unknown {
	if (!isStreamingEvent(event)) return event;
	if (event.type === "tool_stream_progress") {
		return event.rawArgs === undefined
			? event
			: { ...event, rawArgs: `(${event.rawArgs.length} chars)` };
	}
	return { ...event, delta: `(${event.delta.length} chars)` };
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
	{
		/**
		 * 原始审批请求的工具名。批准写回（Task 3）要用它复核：
		 * rememberPrefix 只有附着在 powershell / read 家族审批上才有意义 ——
		 * 响应来自 IPC，渲染层给 write 审批附个 prefix 不该产生任何规则。
		 */
		readonly toolName: string;
		readonly resolve: (response: PermissionResponse) => void;
	}
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
	 * asked 半边的审计（dsh 的 approval/asked）。出了事要能还原「当时问过什么、
	 * 用户批了什么」。不记 details 全文 —— 路径/命令已随工具卡的 session_event
	 * 日志落盘，这里再抄一遍只会让审计日志体积翻倍；id 足够把两边对上
	 * （decided 半边见本函数末尾的失败分支与 INVOKE.permissionResponse）。
	 */
	eventLog.append({
		kind: "permission_request",
		id,
		toolName: request.toolName,
		risk: request.risk,
		summary: request.summary,
	});
	return new Promise<PermissionResponse>((resolve, reject) => {
		pendingApprovals.set(id, { toolName: request.toolName, resolve });
		try {
			post({
				kind: "push",
				channel: PUSH.permissionRequest,
				payload: { id, sessionId, ...request },
			});
		} catch (error) {
			/*
			 * 请求根本发不出去 = 这次审批**没有应答者**。按闭集降级为 unavailable
			 * 并补上 decided 半边（asked/decided 对不能只落一半：事后还原时
			 * 「问了没人答」与「根本没问」必须分得开），异常照旧抛给调用方 ——
			 * 权限门按 unavailable 拒绝执行，绝不因为通道坏了就放行。
			 */
			pendingApprovals.delete(id);
			eventLog.append({
				kind: "permission_response",
				id,
				toolName: request.toolName,
				outcome: "unavailable",
				error: error instanceof Error ? error.message : String(error),
			});
			reject(error);
		}
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
 * 临时任务 / 待分配 → undefined（写用户级 ~/.kamibuddy/mcp.json）——
 * 任务目录是任务私有的（且转正时会被改名），往里落配置文件既串味也无稳定落点。
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
	getModelKey: () => activeModelKey,	resources: RESOURCES,
	getPermissions: () => activePermissions,
	// 全局默认推理强度（现读偏好，理由同 automation 装配处）：子代理会话
	// 每次新建、逐会话还原不适用，全局默认即口径。
	getThinkingLevel: () => readPreferences().thinkingLevel,
	// 超时可配置（spec: add-team-foundations 防线参数化）：现读偏好，
	// 未配置由 runner 侧回编译期缺省（10 分钟）。
	getTimeoutMs: () => readPreferences().subagentTimeoutMs,
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
 * 成员会话执行器的装配（与上方 subagentRunner 的 deps 同源同值）——
 * 两者的隔离语义一致，差异在宿主生命周期。字面量各写一份是接线配置不是逻辑；
 * 若第三个执行器出现，再抽共享 deps 对象（与 automation-runner 一起，批 6）。
 */
const memberRunnerDeps = {
	getCatalog,
	getModelKey: () => activeModelKey,
	resources: RESOURCES,
	getPermissions: () => activePermissions,
	getThinkingLevel: () => readPreferences().thinkingLevel,
	protectedDirs: PROTECTED_DIRS,
	isTempCwd,
	isOwnWorkspace: (dir: string) =>
		isPathInside(getEffectiveWorkspaceRoot(), dir) || isPathInside(getConfigDir(), dir),
	getWebSearchConfig,
	requestApproval: (request: Omit<PermissionRequest, "id" | "sessionId">) =>
		requestApproval(request, ""),
};

/* ── 会话间消息信箱（spec: add-team-foundations 批 3） ────────────────
   原语在 daemon/mailbox.ts（纯逻辑、有单测）。本批没有 IPC 通道也没有
   调用方：消费方是批 5 的 send_message 工具与成员路由 —— 原语先行接线，
   到时候只需在这层函数上加工具/UI 壳。 */

const teamMailbox = new SessionMailbox();

/**
 * 向目标会话投递一条消息并排队唤醒它。
 *
 * 通路分两条，都是 followUp 语义（不打断、排队消费），差异只在排哪儿：
 * - 目标**正在 run 中** → 走 run 中旁路直呼 `host.prompt(composed, "followUp")`，
 *   消息进入当前 run 的下一轮 —— 与 INVOKE.prompt 的 run 中分支、用户的
 *   「排队消息」同一通道。冒烟实测（2026-09-16）的教训：回投若排互斥链，
 *   会被压到领导整个 run 结束后才投（实测延迟 3-4 分钟，被模型误判为
 *   「未回投」）—— 旁路消掉这个人为延迟。
 * - 目标空闲 → 排进目标桶互斥链（链上消费可能攒到多条，合成一条投递）。
 *
 * 两条路的终点都是 `host.prompt(·, "followUp")`：session-host 对流式中的
 * 会话自动入 followUp 队列，所以「检查时空闲、进链前恰好起跑」的竞态
 * 也是安全的 —— 不会出现绕过互斥链的裸 run。
 *
 * @param fromLabel 来源显示名（成员名/会话标题，批 5 的路由层有这个知识）；
 *        缺省回落 fromSessionId。
 * @throws 目标会话不在注册表、或从未建过宿主（pristine 桶没有可接收消息的
 *         对话）—— 响亮失败，不静默丢消息。
 */
function deliverSessionMessage(
	fromSessionId: string,
	toSessionId: string,
	text: string,
	fromLabel?: string,
): Promise<void> {
	const target = bucketsById.get(toSessionId);
	if (target === undefined) {
		throw new Error(`目标会话不存在：${toSessionId}`);
	}
	if (target.hostPromise === undefined) {
		throw new Error("目标会话还没有建立对话，无法接收消息");
	}
	teamMailbox.deliver(toSessionId, fromSessionId, text, fromLabel);
	const composeFromMailbox = async (): Promise<string> => {
		const messages = teamMailbox.drain(toSessionId);
		return messages
			.map((message) => `[来自会话「${message.fromLabel ?? message.fromSessionId}」的消息]\n${message.text}`)
			.join("\n\n---\n\n");
	};
	// run 中旁路：见函数头注释。信箱只作记账（deliver/drain 配对保均衡），
	// 本条消息的正文以入参为准，不依赖箱内攒批。
	if (target.running) {
		return (async () => {
			const host = await target.hostPromise;
			if (host === undefined) return; // 不可达（上方已判），窄化守卫
			teamMailbox.drain(toSessionId);
			const composed = `[来自会话「${fromLabel ?? fromSessionId}」的消息]\n${text}`;
			await host.prompt(composed, "followUp");
		})();
	}
	return enqueue(target, async () => {
		const composed = await composeFromMailbox();
		if (composed === "") return;
		const host = await target.hostPromise;
		if (host === undefined) return; // 不可达（上方已判），窄化守卫
		await host.prompt(composed, "followUp");
	});
}

/**
 * 批 5（send_message 工具 / 成员路由）的消费锚点：原语与接线在这里就位，
 * 到时候从对象上取用，不再各自拼装。导出是为了过 noUnusedLocals ——
 * 本批刻意没有调用方（spec: add-team-foundations 批 3「无 IPC 通道」决策）。
 */
export const teamMessaging = { mailbox: teamMailbox, deliver: deliverSessionMessage };

/* ── 团队运行时（spec: add-team-foundations 批 5） ─────────────────── */

const teamRegistry = new TeamRegistry();
/** 成员会话句柄（sessionId → handle）。宿主生命周期在接线层，注册表只管身份。 */
const memberHandlesBySession = new Map<string, MemberHandle>();

/**
 * 把当前团队成员状态折成投影并推给领导会话（spec: add-team-foundations 批 7）。
 *
 * 归位协议见 session-events.ts 的 team_member_progress 注释：不带 toolCallId、
 * reducer 找最近一张 team 卡整体替换。注册表（TeamMember）→ 投影（SubagentStatus）
 * 的字段映射：spawning→queued / running→running / idle→done（已完成，可被
 * team_send 唤醒）/ failed→failed / closed→done（解散中，卡即将随团队消失）。
 */
function emitTeamProgress(leaderSessionId: string): void {
	const team = teamRegistry.getTeam(leaderSessionId);
	if (team === undefined) return;
	const statusMap: Record<string, SubagentStatus["status"]> = {
		spawning: "queued",
		running: "running",
		idle: "done",
		failed: "failed",
		closed: "done",
	};
	const members = [...team.members.values()].map(
		(member): SubagentStatus => ({
			kind: "team",
			agent: member.name,
			task: member.task,
			status: statusMap[member.status] ?? "running",
			activity: member.lastActivity,
			turns: member.turns,
			...(member.sessionId === undefined ? {} : { sessionId: member.sessionId }),
			...(member.toolCalls > 0 ? { toolCalls: member.toolCalls } : {}),
			...(member.tokens > 0 ? { tokens: member.tokens } : {}),
			...(member.cost > 0 ? { cost: member.cost } : {}),
		}),
	);
	const bucket = bucketsById.get(leaderSessionId);
	if (bucket === undefined) return;
	emitSessionEvent(bucket, { type: "team_member_progress", members });
}

/**
 * 成员会话事件的裸推送（spec: add-team-foundations 批 8 焦点导航）：
 * 信封键 = 成员自己的 sessionId，renderer 按后台会话管线折叠进成员桶，
 * 聚焦成员时复用既有的会话切换机制上屏。不走 emitSessionEvent —— 成员
 * 没有桶，daemon 侧不折叠、不进观测聚合（成员消耗已在注册表按投影回填）。
 */
function emitMemberEvent(memberSessionId: string, event: SessionEvent): void {
	const envelope: SessionEventEnvelope = { sessionId: memberSessionId, event };
	post({ kind: "push", channel: PUSH.sessionEvent, payload: envelope });
}

/** 团队开关（缺省关闭：对齐 WorkBuddy 把 Agent Teams 当实验特性的立场）。 */
function isAgentTeamsEnabled(): boolean {
	return readPreferences().agentTeamsEnabled ?? false;
}

/**
 * 解散领导的团队：中止 + dispose 全部成员宿主，清注册表与句柄。
 * 三个触发点：team_delete 工具、领导桶被 LRU 逐出、领导会话被删除 ——
 * v1 决策是「逐出即解散」（防幽灵、防白烧钱；WorkBuddy 的无恢复语义同款），
 * 「豁免逐出」留批 6 评估。
 */
async function disbandTeamOf(leaderSessionId: string): Promise<void> {
	const team = teamRegistry.getTeam(leaderSessionId);
	if (team === undefined) return;
	for (const member of team.members.values()) {
		if (member.sessionId === undefined) continue;
		const handle = memberHandlesBySession.get(member.sessionId);
		if (handle !== undefined) {
			await handle.abort().catch(() => {});
			handle.dispose();
			memberHandlesBySession.delete(member.sessionId);
		}
	}
	teamRegistry.disband(leaderSessionId);
	// 豁免随团队解除：领导桶重新参与 LRU 回收。
	const bucket = bucketsById.get(leaderSessionId);
	if (bucket !== undefined) bucket.hasTeam = false;
}

/**
 * 懒建宿主。第一次发消息时才创建 —— 建会话需要一个可用模型，
 * 而用户可能先打开应用、再去设置里填 Key。
 *
 * 沿用旧 hostPromise 的缓存语义，只是从单例升级为按桶：同一桶只建一次，
 * 并发取宿主拿到同一个 promise；失败的 promise 不缓存（清回 undefined），
 * 用户配好模型后重试才有效。
 *
 * 建成即 adoptHost 注册（pristine 桶唯一的注册点，resume 有自己的注册
 * 路径）：不入表则信封 sessionId 全程空串、listSessions 的
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

	/*
	 * 分配时机：待分配（cwd 为空串，见 newTask / 初始桶）在**首次真正建宿主**时才落成
	 * 真实目录 —— 用户可能点了「新建任务」却没发消息就切走，那一刻不该留下空目录
	 *（spec: align-per-task-dirs）。目录名 = 生效根下 `<YYYY-MM-DD-HH-mm-ss>`，
	 * 会话 header 的 cwd 由下面 SessionHost.create 从这里带进去。
	 *
	 * 不在这里发 session_state：本函数约定不发事件（见文件上方注释），分配结果写回
	 * bucket.cwd，随 adoptHost 的权威 session_state（host.state.cwd）同步给 UI。
	 */
	if (bucket.cwd === "") {
		bucket.cwd = allocatePendingCwd(bucket.cwd, getEffectiveWorkspaceRoot());
		// 新分配的目录没有既存预览服务（旧模型的临时任务共用 <根>/临时任务，启动时
		// 预热过）；按新 cwd 懒建，失败不阻断会话 —— 预览是增强能力，聊天主链路不该
		// 被它拖死，记日志留现场（与启动预热同一口径）。
		void previewServers.ensure(bucket.cwd).catch((error: unknown) => {
			const message = error instanceof Error ? error.message : String(error);
			console.error(`预览服务启动失败：${message}`);
			eventLog.append({ kind: "ipc_error", channel: "preview:ensure", message });
		});
	}

	/*
	 * worktree 副本（对齐清单 C22 / L27）：意图在这里消费**一次**并清空
	 *（见 SessionBucket.pendingWorktreeBranch 的注释）。
	 *
	 * 位置必须在 cwd 分配之后、建宿主之前 —— 副本路径就是本轮会话的 cwd，
	 * 工具集、权限门、预览服务、注入块里的工作目录全都按它注入，
	 * 晚一步就白建了。
	 *
	 * 失败**降级回原目录继续**（对齐 WorkBuddy 的 createFailedFallback）：
	 * 副本是隔离增强，不是会话前提。最常见的失败是「cwd 不是 git 仓库」
	 *（用户选了普通文件夹）或 git 不在 PATH，两者都不该让用户连消息都发不出去。
	 * 但**必须响亮记日志** —— 静默降级会让用户以为自己在副本里，实际在主仓库
	 * 目录上改文件，而这正是这个功能存在的理由。
	 */
	if (bucket.pendingWorktreeBranch !== undefined) {
		const baseBranch = bucket.pendingWorktreeBranch;
		bucket.pendingWorktreeBranch = undefined;
		const repoCwd = bucket.cwd;
		if (repoCwd !== "" && (await isGitRepo(repoCwd))) {
			try {
				const worktree = await createWorktree({ repoCwd, baseBranch });
				bucket.worktree = worktree;
				bucket.cwd = worktree.worktreePath;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				console.error(`worktree 副本创建失败，回退到原目录继续：${message}`);
				eventLog.append({ kind: "ipc_error", channel: "worktree:create", message });
			}
		} else {
			console.error(
				`worktree 意图未生效：${repoCwd === "" ? "会话还没有工作目录" : `不是 git 仓库：${repoCwd}`}`,
			);
		}
	}

	// 会话与 cwd 终身绑定：桶在建任务/恢复时定好 cwd（或上面刚分配好/换成副本），这里只读取。
	// 建会话前确保目录存在（SessionHost.create 里也会 mkdir，
	// 但权限门要先拿到一个已确定存在的目录）。
	const cwd = bucket.cwd;
	mkdirSync(cwd, { recursive: true });

	/*
	 * 沙箱预热：**此刻开始**给工作区授权，不 await（spec: add-windows-acl-sandbox）。
	 *
	 * 为什么不能懒到首次 powershell 调用：实测首次 ACL 授权随文件数略超线性
	 * （5000 文件 3134ms，外推几万文件即几十秒），拖到模型第一条命令时才做，
	 * 用户会看到命令莫名挂住几十秒且毫无解释。
	 * 为什么也不 await：那会让新建会话卡住同样的时长。折中是现在开始跑，
	 * 让第一次调用 await 剩余部分 —— 模型思考与流式输出通常足够它跑完。
	 * ACE 是常驻的，所以只有「该工作区第一次运行」付这个钱，之后都是 1ms。
	 */
	void warmUpSandbox({
		workspaceDir: cwd,
		mode: activePermissions.sandbox,
		onDiagnostics: (diagnostics) => recordSandboxDiagnostics(diagnostics, cwd),
	});

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
	 * resume 重建路径（带 sessionManager）绝不传 ——
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
		// MCP 工具的初次激活（扩展加载期 action 方法不可用，工厂自己激活不了）。
		extraActiveTools: () => mcpClient.registeredToolNames(),
		// 专家绑定与两轴正交，随会话状态一起进宿主（resume/newTask 沿用口径同两轴）。
		...(bucket.conversation.state.expertId === undefined
			? {}
			: { expertId: bucket.conversation.state.expertId }),
		emit: (event) => emitSessionEvent(bucket, event),
		resources: RESOURCES,
		// 运行台账按真值 sessionId 建（工厂语义见 SessionHostOptions.createLedger）。
		// 写入失败只进 event-log 不炸 run —— 台账是观测不是业务（run-ledger.ts 文件头）。
		createLedger: (sessionId) =>
			new RunLedger(
				runLedgerDir,
				sessionId,
				(message) => {
					eventLog.append({ kind: "run_ledger_error", sessionId, message });
				},
				Date.now,
				// 增量投影：条目落盘即 fold 进诊断页聚合（会话级统计 / 缓存浪费），
				// 不必等下次启动回放（observability.foldLedgerEntry 注释）。
				(entry) => {
					observability.foldLedgerEntry(sessionId, entry);
					/*
					 * fold 完再推会话统计（聊天页底部的常驻指标条）。只在
					 * llm_call / run_end 上推：前者改变轮次 / 耗时 / 首字 / 解码 /
					 * 用量，后者收束该 run 的工具耗时；tool_call 一个 run 有几十条，
					 * 跟着推只会让 IPC 与事件日志（本已偏大）继续膨胀。
					 */
					if (entry.kind === "llm_call" || entry.kind === "run_end") {
						emitSessionStats(bucket, sessionId);
					}
				},
			),
		// request_snapshot 的 system 分段 provenance：prompt-switch 的 compose 现记现取。
		getSystemPromptSegments: () => bucket.systemPromptSegments,
		// hidden context（F5）expert 行的显示名：现载专家库查 displayName，
		// 查不到回落 undefined（宿主侧再回落 expertId）。专家库本身可能因打包
		// 问题抛错 —— 这里必须自吞（钉子拿不到名字不该炸 run）。
		getExpertLabel: () => {
			const expertId = bucket.conversation.state.expertId;
			if (expertId === undefined) return undefined;
			try {
				return loadExpertsNow().find((e) => e.name === expertId)?.displayName;
			} catch {
				return undefined;
			}
		},
		// 专家追加工具白名单（spec: add-team-foundations）：与 getExpertLabel
		// 同款注入——现载专家库查 extraTools，坏库自吞退回「不追加」（工具面
		// 退回模式白名单，比炸掉整个会话装配温和且可预期）。
		getExpertExtraTools: () => {
			const expertId = bucket.conversation.state.expertId;
			if (expertId === undefined) return undefined;
			try {
				return loadExpertsNow().find((e) => e.name === expertId)?.extraTools;
			} catch {
				return undefined;
			}
		},
		/*
		 * 托管运行时清单 + 状态 → hidden context 的 python_env 段（spec:
		 * add-managed-runtimes 阶段 5）。照 WorkBuddy 的 client-info-env 做法
		 * （把托管运行时交给模型），但位置从系统提示词挪到了注入块
		 * （spec: stabilize-prompt-prefix）：
		 *
		 * 为什么必须让模型知道：它拿系统 Python 写脚本时，缺库的第一反应就是
		 * `pip install` —— 而那在沙箱里**必定失败**（2026-09-17 现场，见
		 * docs/ARCHITECTURE.md 已知边界第 8 条）。给出真实路径，Python 任务才会
		 * 落在我们受控且已备依赖的环境上。运行时清单还负责把「被用户禁用」
		 * 与「未就绪」分开告知（不许静默降级成「找不到」）。
		 *
		 * 为什么不能在系统提示词里：它随机器变（homedir / 安装位置 /
		 * HTML_TO_DOCX_VENV），而系统提示词位于整段对话历史之前 —— venv 一重建、
		 * 一换机器、私有化部署换个安装位置，该处之后的整段提示词与整段历史一起
		 * 在 provider 前缀缓存里失配。清单是纯读磁盘的函数，每建宿主给的是**取值
		 * 函数**（每次 run 现读），与会话内字节稳定不冲突（注入块在历史之后）。
		 */
		getRuntimeInventory: runtimeInventoryForSession,
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
					// dev 是项目根、打包后是应用目录 —— 由主进程经 KAMIBUDDY_APP_DIR 精准传入，
					// 不读 daemon 的 cwd（见 config-paths.ts getAppDir 的踩坑注释）。
					appDir: getAppDir(),
					// 内置资源只读放行（技能渐进加载全靠 read 这里）。
					resourcesDir: getResourcesDir(),
				},
				cwd,
				// getter 而非快照：用户改了预设，下一次工具调用即生效。
				// 权限档是全局设置（spec A）：一改对所有会话的后续工具调用生效。
				getSettings: () => activePermissions,
				// 前缀规则同 getSettings 的 getter 范式：批准写回（appendRule）后，
				// 已建好的宿主下一次工具调用即按新规则免问/直拒。
				getRules: () => activePermissionRules,
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
			 * 工具结果 spill（spec: adopt-dsh-disciplines Task 2.1）：**所有会话都装**，
			 * 紧跟在权限门之后读起来最顺 —— 权限门管「这条调用能不能跑」，
			 * 本钩子管「跑完的结果回给模型多少」（超限落盘 + 给路径，不再丢信息）。
			 *
			 * 落盘目录按会话 cwd 走：模型要用 read/grep 把结果读回去，
			 * 放配置目录会被文件工具的禁读规则挡住（见 config-paths.getSpillsDir）。
			 * 失败进 event-log，不炸 run —— 与 run-ledger 的观测纪律同出口。
			 */
			spillExtensionFactory({
				dir: getSpillsDir(cwd),
				report: (message) => eventLog.append({ kind: "tool_result_spill_error", message }),
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
					const composed = await composeSystemPrompt({ sceneId, interactionId, expertId, piContext });
					// 成分统计的 system 部分从这里取——只有这里见过组装完的真身。
					// 技能段单独记一份：上下文用量明细要把「技能」从系统提示词里拆出来单列。
					// 记进所属桶：并发会话各组各的提示词，token 估算不互相覆盖。
					bucket.systemPromptTokens = composed.systemTokens;
					bucket.skillsTokens = composed.skillsTokens;
					// 分段 provenance 同记：台账 request_snapshot 的 system 部分
					//（transformContext 钩子按轮读取，见 SessionHostOptions.getSystemPromptSegments）。
					bucket.systemPromptSegments = composed.segments;
					return composed.prompt;
				},
				// 逐轮可变事实（记忆内容/个性化）的注入块：每请求现读本会话 cwd。
				// 提示词里已不含它们（见 composeSystemPrompt 注释）；时间不走这里，
				// 由本会话 SessionHost 的 hidden context `current_time` 送达。
				composeRuntimeContext: () => buildRuntimeContext(cwd),
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
			/*
			 * shell 能力：craft 白名单含 powershell。三道**独立**防线，缺一不可：
			 *   权限门   —— 要不要问人（balanced 高风险询问、read-only 拒，
			 *                见 permission-policy 的 SHELL 分支）；
			 *   检查器   —— 这条命令能不能跑（command-guard 的五类拦截）；
			 *   沙箱     —— 跑起来能碰到什么（受限令牌把写约束在工作区内）。
			 *
			 * 沙箱**不替代**检查器：WRITE_RESTRICTED 机制上只约束写，读与网络
			 * 完全不受约束（已实测），`type ~\.ssh\id_rsa` 这条路仍然只有
			 * 检查器的 credential-access 拦得住（spec: add-windows-acl-sandbox）。
			 */
			powershellExtensionFactory({
				/*
				 * 检查器拦下的命令进审计中心（spec: add-managed-runtimes 阶段 4 的
				 * 「命令安全」一类）。审计写入点在本层注入：工具层不认识审计目录，
				 * 且它自己的单测不该在真实配置目录里落文件。
				 */
				onAudit: writeAuditRecord,
				runner: createSandboxedRunner({
					getSettings: () => activePermissions,
					// 快照与权限门同口径：cwd 在宿主存活期间不会变（见 sandbox-runner 注释）。
					workspaceDir: cwd,
					// 降级路径就是今天在跑的那条 spawn，不另写一遍。
					fallback: runCommand,
					/*
					 * 运行时注入补丁（SubTask 2.1.3）：启用且就绪的托管运行时进
					 * 模型 shell 子进程的 PATH（沙箱与降级两条路径共用这一份）。
					 * 每次执行现算 ⇒ 设置页改开关后无需重启即生效。
					 */
					runtimeEnv: runtimeShellEnv,
					onDiagnostics: (diagnostics) => recordSandboxDiagnostics(diagnostics, cwd),
					// 沙箱拒绝执行与提权决定同样进审计（「沙箱」一类，写入点在 sandbox-runner）。
					onAudit: writeAuditRecord,
					/*
					 * 一次性提权审批（spec: add-windows-acl-sandbox 二阶段）。
					 *
					 * 走**与权限门同一条** requestApproval 通道：用户面对的是同一种弹窗，
					 * 审计日志里也是同一类记录。sessionId 与 pendingApprovals 的处理
					 * 照抄权限门那边（见下方 createPermissionGate 的注释）——
					 * 有待答审批的桶必须豁免 LRU 回收，否则用户正在看的框会随宿主消失。
					 *
					 * `risk: "high"` 不只是显示强调：审批弹窗对高风险**不提供**
					 * 「本次会话记住」选项（permission-dialog.tsx），而权限门回程也
					 * 对高风险忽略 remember —— 正好落实「提权只对本次调用有效」。
					 * 跳过沙箱是我们能给出的最宽授权，不该有任何形式的免检。
					 */
					requestEscalation: async ({ toMode, justification, command }) => {
						const sessionId = adoptedSessionId(bucket);
						bucket.pendingApprovals += 1;
						try {
							const response = await requestApproval(
								{
									toolName: "powershell",
									summary:
										toMode === "danger-full-access"
											? "跳过沙箱写入约束执行这条命令（本次有效）"
											: `把这条命令的权限放宽到「${toMode}」（本次有效）`,
									// 理由与命令原文都要给：用户得知道模型想干什么、以及为什么。
									details: `模型给出的理由：${justification}\n\n命令：${command}`,
									risk: "high",
								},
								sessionId,
							);
							/*
							 * 与权限门**同一份规范化**地消费闭集：只有 allowed-once 放行，
							 * 不合契约的应答（未知 decision）归 unavailable，一律按「没批准」
							 * 处理（这里只需布尔，但判据必须与门同源 —— 两处各判一遍就会
							 * 出现「门放行、提权拒」这类对不上的组合）。
							 */
							return isGranted(normalizeApprovalOutcome(response));
						} finally {
							bucket.pendingApprovals -= 1;
							evictIdleHosts();
						}
					},
				}),
			}),
			// 文档读取：所有会话都装。read_document 已登记权限门只读工具
			// （与 read 同语义），区外读取走通用的低风险询问，这里无需额外接线。
			createDocReadTool(),
			/*
			 * 技能加载（三模式白名单都含 use_skill）：模型**自动**命中技能时用它取
			 * SKILL.md 全文 —— pi 只有手动 /skill: 的展开，自动路径本来没有工具
			 * （旧约定是让模型 read 技能文件，界面上只显示成一堆「读取文件」）。
			 * 技能来源经回调注入、且与技能清单段**同源**（skillSets）；闭包在
			 * 工具调用时才求值：会话中途换绑专家后，工具看到的技能集立刻跟上同出口
			 * 产出的清单段，不会出现「清单里有、工具查不到」。
			 * 传的是全量 + enabled 标记：被停用的技能要能被工具分辨出来并报出
			 * 「已在技能页停用」（与「没这个技能」区分开），见 toUseSkills。
			 */
			createUseSkillTool({
				resolveSkills: () => toUseSkills(bucket.conversation.state.expertId),
			}),
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
				// 运行时装不上要进审计中心（「运行时」一类，写入点在工具层）。
				onAudit: writeAuditRecord,
			}),
			/*
			 * docx 版式提取：craft 白名单含 docx_extract，所有用户会话都装。
			 * 与 docx_convert 同档：daemon 进程内受控 spawn venv python
			 * （命令与参数写死在 documents/docx-extract.ts），不经 powershell；
			 * 权限按「写工作区产物文件」档，写侧判定锚定 outputPath。
			 */
			createDocxExtractTool({
				engineDir: join(getResourcesDir(), "docx-engine"),
				homeDir: homedir(),
				// 运行时装不上要进审计中心（「运行时」一类，写入点在工具层）。
				onAudit: writeAuditRecord,
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
				 * 换桶即新预算，同一只桶内不复位（会话切 cwd 不换桶）。
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
		/*
		 * 团队工具四件套（spec: add-team-foundations 批 5）：agentTeamsEnabled
		 * 开启时才注册（缺省关闭，白名单名静默忽略）。只挂用户会话 ——
		 * automation run 会话有自己的装配（不含 team 工厂），无人值守下建团
		 * 与「无人值守下递归委派」是同一条不做决策。成员 spawn 逐个消耗
		 * 同一份桶预算；完成/失败经批 3 的 deliverSessionMessage 回投本会话；
		 * 领导桶逐出/删除时由 disbandTeamOf 解散（防幽灵成员）。
		 */
		teamExtensionFactory({
			isEnabled: isAgentTeamsEnabled,
			listAgents: () => agents,
			startTeam: async (plan, hooks) => {
				const leaderId = adoptedSessionId(bucket);
				// 注册表校验先行（单团队/重名/数量）；预算逐成员扣，失败即解散
				// —— 不留半支队伍（半死的成员产出无处回投，只会烧钱）。
				teamRegistry.createTeam(leaderId, plan.name, plan.members);
				// 领导桶豁免 LRU 逐出（spec 批 6 v1 决策修订）：团队存续期间
				// 领导宿主不可回收——逐出即解散会静默杀掉正在跑的成员，且用户
				// 切走任务回不来就发现队伍没了。豁免的风险面 = 多占一个宿主，
				// team_delete / 删除会话随时可释放。
				bucket.hasTeam = true;
				emitTeamProgress(leaderId);
				const acks: { name: string; sessionId: string }[] = [];
				try {
					for (const member of plan.members) {
						if (bucket.spawnBudgetRemaining <= 0) {
							throw new Error("spawn 预算已耗尽，无法启动全部成员");
						}
						bucket.spawnBudgetRemaining -= 1;
						const agent = agents.find((a) => a.name === member.agentName);
						if (agent === undefined) {
							throw new Error(`没有名为「${member.agentName}」的子代理定义`);
						}
						const handle = await spawnMember(
							memberRunnerDeps,
							{ cwd, agent, memberName: member.name, task: member.task },
							{
								onProgress: (name, text) => {
									teamRegistry.recordProgress(leaderId, name, 0, text);
									emitTeamProgress(leaderId);
									hooks.onProgress(name, text);
								},
								onComplete: (name, output, turns) => {
									teamRegistry.markStatus(leaderId, name, "idle", `已完成 ${turns} 轮`);
									emitTeamProgress(leaderId);
									void deliverSessionMessage(
										teamRegistry.getTeam(leaderId)?.members.get(name)?.sessionId ?? "",
										leaderId,
										output,
										name,
									).catch((error: unknown) => {
										eventLog.append({
											kind: "team_member_delivery_failed",
											sessionId: leaderId,
											message: error instanceof Error ? error.message : String(error),
										});
									});
								},
								onFailed: (name, message) => {
									teamRegistry.markStatus(leaderId, name, "failed", message);
									emitTeamProgress(leaderId);
									const memberSession = teamRegistry.getTeam(leaderId)?.members.get(name)?.sessionId;
									if (memberSession === undefined) return;
									void deliverSessionMessage(memberSession, leaderId, `成员任务失败：${message}`, name).catch(
										(error: unknown) => {
											eventLog.append({
												kind: "team_member_delivery_failed",
												sessionId: leaderId,
												message: error instanceof Error ? error.message : String(error),
											});
										},
									);
								},
								// 事件转发（焦点导航）+ 计数回填（批 8）：转发以成员 sessionId
								// 为信封键，renderer 按后台会话折叠；计数增量回注册表后推投影。
								onEvent: (memberSessionId, event) => {
									emitMemberEvent(memberSessionId, event);
									let toolCalls = 0;
									let tokens = 0;
									let cost = 0;
									if (event.type === "tool_started") toolCalls = 1;
									if (event.type === "assistant_done" && event.message.usage !== undefined) {
										tokens = event.message.usage.totalTokens;
										cost = event.message.usage.cost;
									}
									const leader = teamRegistry.recordCountersBySession(memberSessionId, {
										toolCalls,
										tokens,
										cost,
									});
									if (leader !== undefined && (toolCalls > 0 || tokens > 0)) emitTeamProgress(leader);
								},
							},
						);
						memberHandlesBySession.set(handle.sessionId, handle);
						teamRegistry.markSpawned(leaderId, member.name, handle.sessionId);
						emitTeamProgress(leaderId);
						acks.push({ name: member.name, sessionId: handle.sessionId });
					}
				} catch (error) {
					void disbandTeamOf(leaderId);
					throw error;
				}
				return acks;
			},
			sendToMembers: async (to, text) => {
				const leaderId = adoptedSessionId(bucket);
				const team = teamRegistry.getTeam(leaderId);
				if (team === undefined) throw new Error("本会话没有团队，先 team_create 建团");
				const names =
					to.toLowerCase() === "@all"
						? [...team.members.keys()]
						: [to.replace(/^@/, "")];
				const sessionIds = teamRegistry.resolveMemberSessions(leaderId, names);
				const composed = `[来自领导的消息]\n${text}`;
				for (const sessionId of sessionIds) {
					const handle = memberHandlesBySession.get(sessionId);
					if (handle === undefined) throw new Error(`成员会话丢失：${sessionId}`);
					void handle.prompt(composed).catch(() => {});
				}
				return names;
			},
			getTeamState: () => {
				const team = teamRegistry.getTeam(adoptedSessionId(bucket));
				if (team === undefined) return undefined;
				return {
					name: team.name,
					members: [...team.members.values()].map((member) => ({
						name: member.name,
						agentName: member.agentName,
						status: member.status,
						turns: member.turns,
						lastActivity: member.lastActivity,
					})),
				};
			},
			closeTeam: () => disbandTeamOf(adoptedSessionId(bucket)),
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
 * 其 run 不受切换影响（WorkBuddy 同模型）。空串表示「临时任务」，即**待分配** ——
 * 不预设目录，首次执行时才分配独立时间戳目录（spec: align-per-task-dirs）。
 *
 * 安全前提：与其余两个入口同一条判定（绝对路径 + 存在时要是可访问的目录）。
 * 用户选哪个目录就是哪个目录 —— 不做目录黑名单（密钥保护在 permission-policy
 * 阶段 1，按路径判定、与 cwd 无关；理由见 core/workspace.ts 文件头）。
 * 待分配（空串）不是真实目录，不过校验；生效根下的自动目录是自家构造，也不经这里。
 */
async function applyWorkspace(dir: string): Promise<string> {
	// 空串 = 临时任务 = 待分配：不建目录、不起预览（没有目录可服务）。真目录才校验 + 建 + 起服务。
	if (dir !== "") {
		const error = validateWorkspacePath(dir);
		if (error !== undefined) throw new Error(error);
		mkdirSync(dir, { recursive: true });

		// 多根预览池：按 cwd 各起一个实例，不再关旧根。仍 await —— 服务起不来时
		// 工作区切换应该响亮失败（沿用旧 setRoot 的口径），而不是带病继续。
		await previewServers.ensure(dir);

		/*
		 * 沙箱预热：**选定工作空间/目录的这一刻**就开始授权，不等第一条消息。
		 *
		 * 为什么提前到这里：授权在大目录上是几十秒的同步 ACE 传播
		 *（实测 43,723 个条目 19.3 秒）。用户从「选目录」到「按下发送」通常还要
		 * 写一段话，这段时间刚好够它跑完 —— 而此前预热挂在会话建立（= 首次发送）
		 * 那一刻，用户就得盯着空屏等（2026-09-17 报的那个现象）。
		 *
		 * 为什么可以放心提前：授权本身跑在 worker_thread 里
		 *（见 sandbox-prepare-client.ts），不堵 daemon 主线程，所以这一步
		 * 既不会卡住「切空间」这个动作，也不会影响别的会话的 IPC。
		 * 非 workspace-write 档位在 warmUpSandbox 里秒退（不留 ACE、不起线程）。
		 */
		void warmUpSandbox({
			workspaceDir: dir,
			mode: activePermissions.sandbox,
			onDiagnostics: (diagnostics) => recordSandboxDiagnostics(diagnostics, dir),
		});
	}
	defaultWorkspaceDir = dir;

	// 既有会话一律不动。唯一例外：pristine 桶（还没建宿主、没有任何历史）
	// 换绑到新默认空间 —— 它还不算「一个既有会话」，用户切完空间发首条消息
	// 理应落在新空间（待分配时则是首次执行分配），而不是旧默认目录。
	if (currentBucket.hostPromise === undefined && currentBucket.cwd !== dir) {
		currentBucket.cwd = dir;
		updateStateLocally(currentBucket, { cwd: dir, isTempTask: isTempCwd(dir) });
	}
	return dir;
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

/* ── 内部会话过滤（spec: add-team-foundations / 记忆整理分离） ─────────
   判定逻辑在 session-visibility.ts（可单测；本文件顶层 requireParentPort()
   在非 utilityProcess 环境 import 即抛，同 workspace-model.ts 的抽法）。 */

async function listSessions(): Promise<SessionSummary[]> {
	// pi 首用时才装配（见文件顶的惰性说明）。
	const { SessionManager } = await import("@earendil-works/pi-coding-agent");
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
	/*
	 * 内部会话过滤的 builtin 集合现读自动化库：内置任务的 id 会随用户停用/删除
	 * 内置任务而变，不能在模块加载时快照一次。库很小（本地 JSON），逐次列表读
	 * 的代价可忽略；过滤谓词本身对头部扫描结果有缓存，不重复读会话文件。
	 */
	const builtinTaskIds = new Set(
		automationStore.list().filter((task) => task.builtin === true).map((task) => task.id),
	);
	const visible: SessionInfo[] = [];
	for (const info of infos) {
		// 子代理会话与内置任务的运行会话都不进侧栏（见 isInternalSessionFile 头注释）。
		if (isInternalSessionFile(info.path, builtinTaskIds)) continue;
		visible.push(info);
	}
	/*
	 * 尚未落盘的已注册会话要补进来。
	 *
	 * pi 在「会话里还没有助手消息」之前**不写文件**（session-manager.js 的 _persist
	 * 守卫：首条 assistant 消息到达时才一次性写出全部条目）。而本列表是磁盘扫描
	 * （SessionManager.listAll），于是新建任务的第一条消息发出后、首响应到达前，
	 * 这个任务在侧栏**缺席** —— 用户实测「任务已经在跑了，过一会才出现」
	 * （2026-09-17）。桶里什么都有（路径、cwd、running、首条用户消息），补一条
	 * 合成摘要即可；文件一落盘，磁盘那条自然接管（同一 path，不会重复）。
	 */
	const onDiskPaths = new Set(visible.map((info) => resolve(info.path)));
	const pending: SessionSummary[] = [];
	for (const bucket of bucketsById.values()) {
		const file = bucket.sessionFilePath;
		if (file === undefined || onDiskPaths.has(resolve(file))) continue;
		if (isInternalSessionFile(file, builtinTaskIds)) continue;
		const firstUser = bucket.conversation.entries.find((entry) => entry.role === "user");
		pending.push({
			id: bucket.sessionId,
			path: file,
			title: deriveSessionTitle(undefined, firstUser?.text ?? ""),
			cwd: bucket.cwd,
			isTempTask: isTempCwd(bucket.cwd),
			// 没落盘就没有文件时间戳；用桶的最近使用时刻，排序上落在最新（它就是最新的）。
			createdAt: bucket.lastUsedAt,
			modifiedAt: bucket.lastUsedAt,
			messageCount: bucket.conversation.entries.filter((entry) => entry.role === "user" || entry.role === "assistant").length,
			current: bucket === currentBucket,
			running: bucket.running,
			archived: false,
		});
	}
	return [...visible
		.map((info): SessionSummary => {
			const bucket = byFile.get(resolve(info.path));
			return {
				id: info.id,
				path: info.path,
				title: deriveSessionTitle(info.name, info.firstMessage),
				name: info.name,
				cwd: info.cwd,
				// 任务区判定收在 isTempCwd 一处（自动目录 / 历史共享临时目录 / 旧 playground 占位；
				// 生效根本身归空间区，2026-09-15）。
				isTempTask: isTempCwd(info.cwd),
				// 分支来源：pi 的 listAll 已经从 header.parentSession 读出（SessionInfo.parentSessionPath），
				// 不必为此再读一遍文件首行 —— 列表是热路径（每次 run 边界都推）。
				parentSession: info.parentSessionPath,
				createdAt: info.created.getTime(),
				modifiedAt: info.modified.getTime(),
				messageCount: info.messageCount,
				current: bucket !== undefined && bucket === currentBucket,
				running: bucket?.running ?? false,
				archived: sessionArchive.isArchived(resolve(info.path)),
			};
		}), ...pending]
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
 * 空间组集合：非临时任务会话的 cwd 去重，合并显示名覆盖。
 *
 * 临时任务（自动分配目录、历史共享临时目录、旧 playground 占位）归任务区、不成组 ——
 * 它们不是用户经营的空间。生效根本身反而**会**成组：cwd = 根只来自用户显式选过
 * 「默认工作空间」，那是一个真实的用户空间（2026-09-15 对齐 WorkBuddy：root 作为 cwd
 * 非 playground，按 cwd 成组）。组由会话文件派生（磁盘真相）：没有会话的目录
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
		defaultWorkspaceDir = defaultCwdAfterResume(existing.cwd);
		setCurrentBucket(existing);
		await previewServers.ensure(existing.cwd);
		pushTaskListChanged(); // current 标记易主
		return;
	}

	/* ── 建宿主前：做完所有可能失败的验证，此刻一切毫发无损 ── */

	/*
	 * 损坏降级（spec: add-observability-ledger）：会话 JSONL 中间的坏行不再
	 * 拒绝打开 —— pi 的 loadEntriesFromFile 逐行跳过坏行容错打开（它本就
	 * 如此，是我们曾把异常上抛给用户）。pi 不暴露跳过计数，这里预扫同口径
	 * 数一遍（countSkippedLines 注释），经桶的 skippedLines 透给 renderer
	 * 提示「有 N 行损坏已跳过」。文件本身不可读（ENOENT 等）让它抛 ——
	 * 与 open 的失败语义一致（响亮），预扫只是多读一遍（会话文件量级 MB，
	 * resume 不在热路径）。
	 * 头部损坏 / 全文无有效条目仍是拒绝：没有 header 就没有 sessionId 与
	 * cwd，不存在「降级打开」的形态（open 的 "not a valid session" 错误）。
	 */
	const skippedLines = countSkippedLines(readFileSync(path, "utf8"));

	// open 是同步的（dist 类型：static open(...) : SessionManager），
	// 文件损坏/不可读在此抛出。pi 首用时才装配（见文件顶的惰性说明）。
	const { SessionManager } = await import("@earendil-works/pi-coding-agent");
	const manager = SessionManager.open(path, sessionsDir);
	const header = manager.getHeader();
	if (header === null) throw new Error("会话文件缺少头部，无法恢复");

	// 从 header.cwd 推导会话工作目录，只算值不赋值：
	//   - 旧 playground 占位目录（playground 时代的技术 cwd）→ 迁移到共享临时目录。
	//     占位目录里本就不可能有产物（当时不注册文件工具），映射只改归类、不丢数据；
	//     会话文件 header 不改写 —— 下次 resume 仍走这条映射，判定收在 isTempCwd 一处。
	//   - 其余按工作空间同一条判定（绝对路径 + 存在时要是可访问的目录）。
	//     **不做目录黑名单**：历史 cwd 是既成事实，用「能不能被选作工作空间」去审它
	//     会把合法会话判成打不开（2026-09-18 前的症状：配置目录禁令一旦加上，
	//     所有 cwd 指向配置目录的旧会话永久不可打开，而那条禁令并非安全边界 ——
	//     见 core/workspace.ts 文件头）。目录可能已被用户删掉，补建与新建会话同口径
	//     —— mkdir 幂等且不碰任何会话状态，可安全提前。
	let nextCwd: string;
	if (header.cwd === join(getConfigDir(), "playground")) {
		nextCwd = tempTasksDir();
		mkdirSync(nextCwd, { recursive: true });
	} else {
		const wsError = validateWorkspacePath(header.cwd);
		if (wsError !== undefined) throw new Error(`会话的工作目录不可用：${wsError}`);
		mkdirSync(header.cwd, { recursive: true });
		nextCwd = header.cwd;
	}

	// 两轴沿用当前会话的选择（与 newTask 同口径：恢复历史不改用户偏好）。
	// 专家绑定同属这套沿用口径 —— resume 后专家身份不丢（state.expertId
	// 随 freshConversation 进新桶，compose 时按 expertId 重新解析人格注入）。
	// 历史归一（旧 "expert" 模式 → craft）也在 freshConversation 内完成。
	const { bucket, contextUsage } = await mountSessionFile({
		manager,
		cwd: nextCwd,
		sceneId: currentBucket.conversation.state.sceneId,
		interactionId: currentBucket.conversation.state.interactionId,
		expertId: currentBucket.conversation.state.expertId,
		lastNonPlanInteraction: currentBucket.lastNonPlanInteraction,
		skippedLines,
	});

	defaultWorkspaceDir = defaultCwdAfterResume(nextCwd);
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

/* ── 会话文件的挂载（resume / fork / restart 共用，Task 5.4）────────── */

/**
 * 在既有桶上按一份已打开的会话文件重建宿主。
 *
 * hostPromise 先占位再创建（createHost 的扩展闭包会读它），失败清回 —— 与
 * getHost 的缓存语义一致。此处失败时：新桶未注册、指针未切（resume/fork）或
 * 母桶正被截断（restart，见调用处的顺序），都由调用方按各自的失败语义收尾。
 */
async function remountHostInBucket(
	bucket: SessionBucket<SessionHost>,
	manager: SessionManager,
): Promise<SessionHost> {
	const attempt = createHost(bucket, manager);
	bucket.hostPromise = attempt;
	attempt.catch(() => {
		if (bucket.hostPromise === attempt) bucket.hostPromise = undefined;
	});
	const host = await attempt;
	adoptHost(bucket, host);
	return host;
}

/** 桶内历史的重建结果；赋值时机由调用方决定（时序理由见 applyRebuiltConversation）。 */
interface RebuiltConversation {
	readonly entries: readonly ConversationEntry[];
	readonly usageDetail: ContextUsageDetail | undefined;
	/**
	 * pi 的精确用量（used/total）。调用方在重建结果**已进桶之后**补发
	 * context_usage（reducer 对它直接覆盖 usageDetail，后发胜出）。
	 */
	readonly contextUsage:
		| { readonly usedTokens: number; readonly maxTokens: number }
		| undefined;
}

/**
 * 按已打开的 manager 重建桶内历史：entries + 用量明细 + 系统提示词估算。
 * **只算不赋值** —— 赋值的时序由调用方掌握（见 applyRebuiltConversation）。
 *
 * entries 来自落盘条目（buildContextEntries 已完成压缩裁剪，恢复视图与模型
 * 实际看到的上下文一致）；artifacts 从落盘的 artifacts_presented custom 条目
 * 恢复（assign 时折叠，清成 [] 会让恢复出的会话丢掉产物卡）。
 *
 * 量与 entries 的先后是**踩过的坑**：adoptHost 那次 session_state 已触发过一轮
 * emitContextUsageDetail，彼时桶内 entries 还是空/旧的 —— 那轮派生的是空历史
 * 成分。所以派生必须等 entries 重建之后，且调用方要在赋值后补发一次覆盖它。
 */
async function buildConversationForBucket(
	bucket: SessionBucket<SessionHost>,
	manager: SessionManager,
	host: SessionHost,
): Promise<RebuiltConversation> {
	const entries = buildConversationEntries(manager.buildContextEntries(), restoredToolLabel);
	const contextUsage = host.state.contextUsage;
	/*
	 * 系统提示词估算必须在这里现算（2026-09-16 实证修的 bug）：compose 只在
	 * before_agent_start（下一次发消息）跑，而新桶的 systemPromptTokens 默认 0
	 * —— 不补算，补发的 context_usage 会把 sys/skills 记成 0，并且 renderer 是
	 * 「后到覆盖」，把运行期桶推的正确值盖成 ~0（面板分类里「系统提示词 ~0」就是它）。
	 * piContext 置空与 prompt:preview 同口径（缺 pi 上下文段，估算略低——比例尺
	 * 可接受）；组装失败降级为 0（估算缺席好过炸掉整条恢复路径）。
	 */
	try {
		const state = bucket.conversation.state;
		const composed = await composeSystemPrompt({
			sceneId: state.sceneId,
			interactionId: state.interactionId,
			expertId: state.expertId,
			piContext: undefined,
		});
		bucket.systemPromptTokens = composed.systemTokens;
		bucket.skillsTokens = composed.skillsTokens;
		bucket.systemPromptSegments = composed.segments;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		eventLog.append({ kind: "ipc_error", channel: "session:compose-estimate", message });
	}
	const usageDetail = deriveContextUsageDetail({
		entries,
		contextUsage,
		systemPromptTokens: bucket.systemPromptTokens,
		skillsTokens: bucket.skillsTokens,
	});
	return { entries, usageDetail, contextUsage };
}

/**
 * 把重建结果整体赋给桶（turn / cancelledTurns 属旧 run 的瞬态，一律清空）。
 *
 * 为什么与「计算」拆开（**顺序敏感**）：「重新开始」要在 history_reset
 * （两端同步清空，见 shared/conversation.ts）之后**同步**填回重建结果 ——
 * renderer 收到 history_reset 就去重拉 snapshot，中间只要有一个 await，它
 * 拉到的就是空视图，且此后不会再拉（用户看到历史凭空消失）。所以赋值必须是
 * 一个不含 await 的动作。
 *
 * state 也必须在这里用权威值覆盖：history_reset 会把 state.sessionId 复位成
 * 空串（reducer 的口径），不覆盖回去，renderer 按快照重指的可见指针就会失位。
 */
function applyRebuiltConversation(
	bucket: SessionBucket<SessionHost>,
	host: SessionHost,
	rebuilt: RebuiltConversation,
): void {
	bucket.conversation = {
		...bucket.conversation,
		state: host.state,
		entries: rebuilt.entries,
		usageDetail: rebuilt.usageDetail,
		turn: undefined,
		cancelledTurns: [],
		artifacts: artifactsFromEntries(rebuilt.entries),
	};
}

/**
 * 按一份会话文件建桶 + 建宿主 + 重建历史（resume / fork 共用的完整流程）。
 *
 * 为什么两轴显式入参而不读 currentBucket：fork 的分支必须继承**母会话**的
 * 场景/模式/专家（母桶未必是当前桶），resume 才是「沿用当前会话的选择」。
 * 除这一处差异，时序只有这一份 —— 复制第二份的代价是「先条目、后用量」这类
 * 踩坑只会被修在一条路径上。
 */
async function mountSessionFile(options: {
	readonly manager: SessionManager;
	readonly cwd: string;
	readonly sceneId: string;
	readonly interactionId: string;
	readonly expertId: string | undefined;
	readonly lastNonPlanInteraction: string;
	readonly skippedLines: number;
}): Promise<{ readonly bucket: SessionBucket<SessionHost>; readonly contextUsage: RebuiltConversation["contextUsage"] }> {
	const bucket = createBucket<SessionHost>({
		cwd: options.cwd,
		conversation: freshConversation(
			options.cwd,
			options.sceneId,
			options.interactionId,
			options.expertId,
		),
		spawnBudget: readPreferences().spawnBudget,
	});
	bucket.lastNonPlanInteraction = options.lastNonPlanInteraction;
	/*
	 * 副本身份从 cwd 反推（副本路径就是会话 cwd，形态可逆）。baseBranch 与
	 * sourceCwd 反推不出 —— 副本目录名里的 slug 是**不可逆**的清洗结果
	 *（`origin/main` 与 `origin-main` 都成了 `origin-main`），原仓库路径更是
	 * 完全不在里面。按类型缺省留空，硬凑一个假的基准分支比不显示更糟。
	 */
	bucket.worktree = worktreeInfoFromCwd(options.cwd);
	// 降级打开的跳过计数进桶：emitSessionEvent 把它并入该桶发出的 session_state。
	if (options.skippedLines > 0) bucket.skippedLines = options.skippedLines;

	const host = await remountHostInBucket(bucket, options.manager);
	const rebuilt = await buildConversationForBucket(bucket, options.manager, host);
	applyRebuiltConversation(bucket, host, rebuilt);
	return { bucket, contextUsage: rebuilt.contextUsage };
}

/* ── 请求派发 ─────────────────────────────────────────────────────── */

type Handler = (args: readonly unknown[]) => Promise<unknown>;

/**
 * 新建任务。INVOKE.newTask 与内置命令 /new 共用。
 *
 * 不再作废旧会话（spec B：切换语义翻转）—— 旧桶留在注册表里后台保活，
 * 其 run 照跑；新任务开一个 pristine 桶（宿主懒建，首次 prompt 才占资源）。
 *
 * 工作空间选择**重置为未选**（默认 targetCwd = 空串 = 待分配），对齐 WorkBuddy
 * 侧栏「新建任务」：其 onClick → handleNewConversation() 不传 groupKey（ui-docs-viewer:201817）
 * → `const targetCwd = groupKey || ""`（:209034）→ `taskStarterCwd$.next(targetCwd)`（:209049）
 * → home 订阅 `setCwd("")`（home-DrgzoIb-.js:937）→ chip 落回提示语。
 * **不要改成「保留上次选择」**：那看着更友好，但会让「回不到未选态」成为暗坑 ——
 * 用户想开一个不落任何空间的临时任务时，只能先去 picker 手动点「不使用工作空间」。
 * 「就在某个空间里开新活」由空间组「+」承担（显式传 cwd，见 newTaskInSpace；
 * WorkBuddy 同款：:210585-210588 的 onClick 传 `groupKey`）。
 *
 * 待分配（空串）时这里**不建任何目录**，首次执行（建宿主）时才分配独立时间戳
 * 目录（见 createHost）；两轴沿用旧会话的选择（开新活不是改偏好）。
 */
async function newTask(targetCwd = ""): Promise<void> {
	/*
	 * 落点先落定。显式指定 cwd（空间组「+」）时复用 applyWorkspace 把关：它做
	 * 校验（配置目录 / 应用目录一律拒）+ 建目录 + 起预览服务，并把 defaultWorkspaceDir
	 * 设成该目录。**为什么必须过这道守**：cwd 一旦进会话，该目录内的写操作就被权限门
	 * 直接放行（core/workspace.ts 开头），增一个能写 cwd 的入口就得走同一道校验 ——
	 * 不为新入口抄第二份判定。
	 *
	 * 空串 = 未选 / 待分配，不是真实目录，不走守卫也不建目录。
	 * defaultWorkspaceDir 同步跟着走：它同时是 workspaceSnapshot().current（「下一次
	 * 新建任务落在哪」的权威值），只改桶不改它会让快照与界面各说各话。
	 */
	if (targetCwd === "") defaultWorkspaceDir = "";
	else await applyWorkspace(targetCwd);

	if (currentBucket.hostPromise === undefined) {
		// pristine 桶没有可保留的现场（无宿主无历史）：直接换绑，不另开新桶 ——
		// 否则首开应用连点两次「新建任务」会留下一串空桶。
		// （显式 cwd 那条路上面已被 applyWorkspace 换绑过，这里通常是 no-op。）
		// worktree 意图随全局偏好带进来（与工作空间选择相反，它不在新建任务时重置，
		// 见 pendingWorktreeBranch 的注释）。
		currentBucket.pendingWorktreeBranch = pendingWorktreeBranch;
		if (currentBucket.cwd !== targetCwd) {
			currentBucket.cwd = targetCwd;
			updateStateLocally(currentBucket, {
				cwd: targetCwd,
				isTempTask: isTempCwd(targetCwd),
			});
		}
		return;
	}
	const bucket = createBucket<SessionHost>({
		cwd: targetCwd,
		conversation: freshConversation(
			targetCwd,
			currentBucket.conversation.state.sceneId,
			currentBucket.conversation.state.interactionId,
			// 专家绑定与两轴正交，同口径沿用（开新活不是改偏好）。
			currentBucket.conversation.state.expertId,
		),
		spawnBudget: readPreferences().spawnBudget,
	});
	bucket.lastNonPlanInteraction = currentBucket.lastNonPlanInteraction;
	bucket.pendingWorktreeBranch = pendingWorktreeBranch;
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

/* ── 会话分支（spec: add-session-branching Task 5）────────────────────── */

/**
 * 抽枝：把母文件「root→entryId 全量条目」写成一条新会话文件（母文件不动），
 * 返回新路径。
 *
 * 为什么先试 pi 的 createBranchedSession、再兜底自己的前缀写入器：header 的形状
 *（version / id 生成规则）属于 pi，能由它生成就不要手写（抗格式漂移）；但 pi 的
 * 落盘守卫让「抽出的内容不含 assistant」时**只返回路径、不写文件**（探针 1d），
 * 而侧栏读的是磁盘真相 —— 这种情况由 session-file 的前缀写入器补齐（header 仍由
 * pi 生成，见 createSessionFileFromPrefix 的注释）。
 */
async function extractBranchFile(motherPath: string, entryId: string): Promise<string> {
	const branched = await createBranchedSessionFile(motherPath, entryId);
	if (branched !== undefined && existsSync(branched)) return branched;
	const fallback = await createSessionFileFromPrefix(motherPath, entryId);
	if (fallback === undefined) throw new Error("分叉点的条目不在会话文件里，无法抽枝");
	return fallback;
}

/**
 * 分支会话标题：`母标题 · 分支`（重名递增）。
 *
 * 母标题取**会话列表的同一条口径**（deriveSessionTitle，renderer 侧栏同源），
 * 不另写一份推导 —— 否则分支名里的母标题可能与侧栏显示的不一致。
 */
async function branchTitleFor(motherPath: string): Promise<string> {
	const sessions = await listSessions();
	const resolved = resolve(motherPath);
	const motherTitle = sessions.find((session) => resolve(session.path) === resolved)?.title ?? "";
	return buildBranchTitle(motherTitle, sessions.map((session) => session.title));
}

/** pi 未写 parentSession 时补写（来源标记是列表与侧栏的数据源）。 */
function ensureParentSession(branchPath: string, motherPath: string): void {
	const header = readSessionHeader(branchPath);
	if (header === undefined) throw new Error("分支会话缺少头部，无法写入来源会话");
	if (header.parentSession === undefined) setSessionParentSession(branchPath, motherPath);
}

/**
 * 分支会话落盘的全部动作：抽枝（或建空历史）→ 命名 → 补来源标记。
 * entryId 为 null = 分叉点在首条用户消息之前（新会话历史为空）。
 *
 * 为什么空历史单独一条路：pi 的 `createBranchedSession(null)` 实测无效（静默回落
 * 到当前叶子、抽出全量历史，探针 1f），空历史必须走 createEmptySessionFile。
 */
async function materializeBranch(
	motherPath: string,
	motherCwd: string,
	entryId: string | null,
): Promise<{ readonly path: string; readonly title: string }> {
	const path =
		entryId === null
			? await createEmptySessionFile(motherCwd, motherPath)
			: await extractBranchFile(motherPath, entryId);
	const title = await branchTitleFor(motherPath);
	await setSessionName(path, title);
	ensureParentSession(path, motherPath);
	return { path, title };
}

/** resolveBranchAnchor 的结果：ok 带锚点，其余两种直接把 reason 交回调用方。 */
type BranchAnchor =
	| {
			readonly kind: "ok";
			readonly host: SessionHost;
			readonly anchorEntryId: string;
			/** 分叉点（该用户消息）的父条目 id；null = 分叉点是首条消息。 */
			readonly parentId: string | null;
			readonly entries: readonly { readonly id: string; readonly parentId: string | null }[];
	  }
	| { readonly kind: "no-file" }
	| { readonly kind: "no-such-entry" };

/**
 * 链内解析锚点：取宿主 → 用户消息序号 → 落盘条目 id → 分叉点的父条目。
 *
 * 入参是**用户消息序号（0 基）**而不是条目 id（spec 的实测修订）：在线路径下
 * 渲染层的 user 消息 id 是 session-host 的 nextId("user") 造的，与落盘条目 id
 * 不一致；序号在这里经宿主桥接成真 id。序号越界 / 条目查不到一律 no-such-entry，
 * 此刻**一个字节都还没写**（Task 5.7 的一致性守卫）。
 */
async function resolveBranchAnchor(
	bucket: SessionBucket<SessionHost>,
	userIndex: number,
): Promise<BranchAnchor> {
	const hostPromise = bucket.hostPromise;
	if (hostPromise === undefined) return { kind: "no-file" };
	const host = await hostPromise;
	const anchor = resolveAnchorForIndex(host.listForkableUserMessages(), userIndex);
	if (anchor === undefined) return { kind: "no-such-entry" };
	const entries = host.listEntryRefs();
	// 条目树里查不到锚点 = 宿主与文件不同步（理论不发生）。按「找不到这条消息」
	// 拒绝，绝不用猜出来的 parentId 去截断历史。
	const ref = entries.find((entry) => entry.id === anchor.entryId);
	if (ref === undefined) return { kind: "no-such-entry" };
	return { kind: "ok", host, anchorEntryId: anchor.entryId, parentId: ref.parentId, entries };
}

/**
 * 「重新开始」：把当前会话回退到某条用户消息**之前**并继续，被放弃的后续抽成
 * 一条新会话（内容一点不丢）。
 *
 * options.saveBranch = false 时跳过抽枝（重试/重新生成的路径）：旧回答就地丢弃，
 * 不往侧栏塞分支会话 —— regenerate 与分支是两个功能，竞品（TRAE/ChatGPT）的重试
 * 都不产生新会话（2026-09-17 用户实测反馈，spec 已修订）。
 *
 * 顺序敏感，每一步的理由：
 *   ① 抽枝（仅当分叉点之后确有内容）：**先写分支文件、再动母文件**。顺序反了就是
 *      数据丢失 —— 母文件已截断而分支没写成，被放弃的那段内容就没有第二份了。
 *   ② dispose 母宿主 → 截断母文件 → 同文件重建：session-file 的写契约是「写入前
 *      宿主必须已 dispose」（resumeSession 同一套重建次序）。
 *   ③ 历史清空只能走 history_reset（session_state 不动 entries），且要**同步**填回
 *      重建结果 —— 理由见 applyRebuiltConversation。
 *
 * 为什么母文件要**物理截断**（而不是在内存里 branch）：pi 的叶子位置不落盘，不截断
 * 的话重开时叶子仍指向旧尾部，回退就退回旧历史（spec 的实测修订 2）。
 */
async function restartSession(
	path: string,
	userIndex: number,
	options?: { saveBranch?: boolean },
): Promise<SessionBranchResult> {
	const target = resolve(path);
	const bucket = findBucketByFile(target);
	// 未注册 / 未落盘 = 这条路径没有会话文件。分支只作用于 daemon 已打开的会话
	//（渲染层的入口也只出现在当前会话的用户消息上），未注册就没有宿主可重建。
	if (bucket === undefined || !existsSync(target)) return branchFail("no-file");
	// 流式守卫在链外先判：链上是「等上一棒结束」，而 prompt 那一棒就是整段 run
	// —— 排进去要等 run 收尾才轮到，用户这次点击会被静默吞掉（他要的是「稍后再试」）。
	if (bucket.running) return branchFail("busy");
	return enqueue(bucket, async () => {
		// 链上不变式断言（同 compact）：run 在链上占整段，走到这里
		// 仍 running 说明存在绕过互斥链的起 run 路径。
		if (bucket.running) return branchFail("busy");
		const anchor = await resolveBranchAnchor(bucket, userIndex);
		if (anchor.kind !== "ok") return branchFail(anchor.kind);

		/* ── ① 抽枝（此处失败：母会话一个字节都没动；saveBranch=false 的重试路径整段跳过）── */
		const leafId = anchor.host.currentLeafId();
		let branch: { readonly path: string; readonly title: string } | undefined;
		try {
			// saveBranch=false（重试）：不抽枝，旧内容就地丢弃 —— regenerate 与分支是
			// 两个功能，竞品的重试都不产生新会话（spec 修订 2026-09-17）。
			// 「分叉点之后没有内容」也不抽枝：抽一条只含前缀的会话只是往侧栏塞噪声
			//（spec 的「分叉点之后没有内容」场景：可执行但不产生分支会话）。
			if (
				options?.saveBranch !== false &&
				leafId !== null &&
				decideExtract(anchor.entries, anchor.anchorEntryId)
			) {
				branch = await materializeBranch(target, bucket.cwd, leafId);
			}
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			eventLog.append({ kind: "ipc_error", channel: INVOKE.sessionRestart, message: detail });
			return branchFail("write-failed");
		}

		/* ── ② 母文件回退（从 dispose 起，失败恢复的语义与上一步不同）── */
		anchor.host.dispose();
		try {
			// 分叉点是首条用户消息（父条目为 null）时清空历史、只留 header
			//（会话文件与目录保留）—— 没有 id 可传给 truncateSessionTo。
			let truncated = true;
			if (anchor.parentId === null) truncateSessionToStart(target);
			else truncated = truncateSessionTo(target, anchor.parentId);
			// 分叉点的父条目不在文件里 = 宿主与文件不同步。此刻 truncateSessionTo
			// 一个字节都没写（它返回 false 前不落盘），母文件仍是原样。
			if (!truncated) {
				bucketsById.delete(bucket.sessionId);
				bucket.hostPromise = undefined;
				return branchFail("no-such-entry");
			}
			// pi 首用时才装配（见文件顶的惰性说明）。
			const { SessionManager } = await import("@earendil-works/pi-coding-agent");
			const manager = SessionManager.open(target, getSessionsDir());
			const host = await remountHostInBucket(bucket, manager);
			const rebuilt = await buildConversationForBucket(bucket, manager, host);
			// ③ 先清空（两端同步）、**紧接着同步**填回重建结果 —— 中间不能有 await，
			// renderer 收到 history_reset 就去重拉 snapshot（App.tsx 的同名分支）。
			emitSessionEvent(bucket, { type: "history_reset" });
			applyRebuiltConversation(bucket, host, rebuilt);
			if (rebuilt.contextUsage !== undefined) emitContextUsageDetail(bucket, rebuilt.contextUsage);
			pushTaskListChanged();
			return branchOk(branch);
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			eventLog.append({ kind: "ipc_error", channel: INVOKE.sessionRestart, message: detail });
			/*
			 * 母文件已是「回退后」的形态、分支文件也已在盘（内容不丢），但宿主没能重建：
			 * 出表让会话回到「未打开」态（文件与历史都在盘上），下次 resume 可正常
			 * 重开。留着「注册了却没有宿主」的僵尸桶，下次 prompt 会在旧 id 名下
			 * 静默开出新会话文件。
			 */
			bucketsById.delete(bucket.sessionId);
			bucket.hostPromise = undefined;
			return branchFail("write-failed", `已回退到这一轮之前，但重新打开会话失败：${detail}`);
		}
	});
}

/**
 * 「分支出新会话」：派生一条新会话并切过去，母会话原样不动（连文件字节都不变
 * —— 抽枝是「另写一个新文件」，实测见探针 1b）。
 *
 * 两种分叉点（options.includeTurn）：
 *   - 缺省（false，「分支出新会话」入口）：**该用户消息之前** —— 新会话只带前缀，
 *     原文由渲染层回填输入框，供用户改问法重发；
 *   - true（回答操作条的「分支」按钮）：**带上这一轮**（复制到该轮末尾的回答为止），
 *     输入框不填 —— 对齐 TRAE 的分支语义：点了就从这里接着往下聊，
 *     不用把问题再打一遍（2026-09-17 用户选定）。
 *
 * 与「重新开始」的关键差异：
 *   - **显式拷贝母桶的会话级状态**（sceneId / interactionId / expertId /
 *     lastNonPlanInteraction）：这四项不落会话文件，resume 的「沿用当前会话」口径
 *     在这里是错的（母桶未必是当前桶），不拷贝分支会漂到别的模式/专家；
 *   - cwd 沿用母会话的（不分配新目录，spec 的「同一工作目录」）；
 *   - thinkingLevel 绝不传：createHost 只在全新会话注入它，传了会覆盖会话文件里的
 *     逐会话还原（spec 的「推理强度沿用会话文件」）。
 */
async function forkSession(
	path: string,
	userIndex: number,
	options?: { includeTurn?: boolean },
): Promise<SessionBranchResult> {
	const target = resolve(path);
	const mother = findBucketByFile(target);
	if (mother === undefined || !existsSync(target)) return branchFail("no-file");
	if (mother.running) return branchFail("busy");
	return enqueue(mother, async () => {
		if (mother.running) return branchFail("busy");
		const anchor = await resolveBranchAnchor(mother, userIndex);
		if (anchor.kind !== "ok") return branchFail(anchor.kind);
		try {
			// includeTurn：叶子取「这一轮末尾」而非「锚点的父条目」——抽出来的是
			// 前缀 + 本轮问答（见 endOfTurn）。缺省模式下分叉点在首条用户消息之前
			// 时 → 新会话为空历史（materializeBranch 的 entryId=null）。
			const leaf = options?.includeTurn === true
				? endOfTurn(anchor.entries, anchor.anchorEntryId)
				: anchor.parentId;
			const branch = await materializeBranch(target, mother.cwd, leaf);
			const axes = mother.conversation.state;
			// pi 首用时才装配（见文件顶的惰性说明）。
			const { SessionManager } = await import("@earendil-works/pi-coding-agent");
			const branchManager = SessionManager.open(branch.path, getSessionsDir());
			const { bucket } = await mountSessionFile({
				manager: branchManager,
				cwd: mother.cwd,
				sceneId: axes.sceneId,
				interactionId: axes.interactionId,
				expertId: axes.expertId,
				lastNonPlanInteraction: mother.lastNonPlanInteraction,
				skippedLines: 0,
			});
			defaultWorkspaceDir = defaultCwdAfterResume(bucket.cwd);
			setCurrentBucket(bucket);
			await previewServers.ensure(bucket.cwd);
			pushTaskListChanged();
			return branchOk(branch);
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			eventLog.append({ kind: "ipc_error", channel: INVOKE.sessionBranch, message: detail });
			// 母会话一个字节都没动（抽枝不动源文件），失败可安全重试。分支文件可能
			// 已写出（成宿主失败）—— 它是一条合法会话，留在盘上比删掉更安全。
			return branchFail("write-failed", `创建分支会话失败，母会话未改动：${detail}`);
		}
	});
}

/**
 * 进行中的运行时安装（每个 id 一个取消信号）。按需安装要联网下载几分钟，
 * 用户点「取消」时 daemon 需要在**下一次推进前**让它停下 —— 这就是唯一落点。
 * 放在 daemon（不放 core）：它是进程级生命周期，且终态只有 daemon 能推给 renderer。
 */
const runtimeInstalls = new Map<string, AbortController>();

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

	// 技能页口径 = 全局技能池（不传专家技能目录）—— 专家私有技能只在会话组装
	//（composeSystemPrompt 按绑定专家追加）时进入提示词，不进技能页清单。
	// 组装逻辑收在 buildSkillsSnapshot 一处（与 setSkillEnabled 共用，见其注释）。
	[INVOKE.skillsSnapshot]: async () => buildSkillsSnapshot(),

	/**
	 * 开关一个技能（技能页卡片上的启停）。返回**新的完整快照**：切换后列表、
	 * 已启用数与 token 数字一次到位，渲染层不必再拉一次（spec: 数字随开关即时更新）。
	 *
	 * 写入走「读改写」（`writePreferences` 是整存覆盖，直接写会清掉模型选择等其它键，
	 * 同 setMemoryEnabled 的写法）。
	 */
	[INVOKE.setSkillEnabled]: async ([name, enabled]) => {
		// 双端校验（同 setPermissions）：渲染层只可能传已列出的技能名，
		// 这里防的是绕过 —— 键名非法会被读取层忽略并记日志，不如当场拒掉。
		if (typeof name !== "string" || !SKILL_NAME_PATTERN.test(name)) {
			throw new Error(`技能名不合法：${String(name)}`);
		}
		const preferences = readPreferences();
		const overrides: Record<string, SkillOverride> = { ...preferences.skillOverrides };
		/*
		 * 开启 = **删键**，不是写 "on"：「缺省 = 启用」只有这一种表示，
		 * 文件里不会出现两套等价写法（见 core/skill-status.ts 的 SkillOverride 注释）。
		 */
		if (enabled === true) delete overrides[name];
		else overrides[name] = "off";

		// 没有任何覆盖时把整个键删掉（同 setDefaultWorkspacePath 清键的写法）：
		// 空对象与「没写过」在读取层都归一 undefined，写出后者才是唯一表示。
		const { skillOverrides: _dropped, ...rest } = preferences;
		writePreferences(
			Object.keys(overrides).length === 0 ? rest : { ...rest, skillOverrides: overrides },
		);
		return buildSkillsSnapshot();
	},

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
			const config = readSessionMcpConfig(currentBucket.cwd);
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

	[INVOKE.addProviderModel]: async ([providerId, model]) => {
		await (await getCatalog()).addProviderModel(providerId as string, model as CustomModelInput);
	},

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

	/*
	 * 跨会话使用统计（统计页）。读会话文件全历史 —— 与 conversation_search 同例：
	 * daemon 读自己的数据，不经权限门。坏文件跳过并记 event-log，不让统计页整页报错。
	 * 每次 assistant_done 之类的事件都会触发一次重拉，重读靠 usage-stats 内部的
	 * mtime 缓存挡住（只重解析改动过的会话文件）。
	 */
	[INVOKE.usageStats]: async () =>
		readUsageStats(getSessionsDir(), (message) => {
			eventLog.append({ kind: "usage_stats_error", message });
		}),

	/*
	 * 台账条目级读取（诊断页会话时间线）。sessionId 缺省 = 当前活动会话；
	 * pristine 桶（sessionId 还是 ""，宿主未建）或活动会话没记过台账时
	 * 退最新台账文件 —— 诊断页打开总该有点什么可看。
	 * renderer 给的 sessionId 经 ledgerFileName 安全化（路径穿越在写侧
	 * 已断，读侧同一条防线不依赖对端自律）。
	 */
	[INVOKE.runLedger]: async ([sessionId]): Promise<RunLedgerResult> => {
		const sessions = listLedgerSessionIds();
		const requested =
			typeof sessionId === "string" && sessionId !== "" ? sessionId : undefined;
		const target = requested ?? (currentBucket.sessionId || sessions[0]);
		if (target === undefined || target === "") {
			return { sessions, sessionId: undefined, entries: [] };
		}
		// 读口与投影回放同一条（run-ledger.ts 的读侧容忍：坏行跳过、文件缺失回空），
		// 这里只加 IPC 截尾。
		const all = readLedgerEntries(
			join(runLedgerDir, ledgerFileName(target)),
			(message) => {
				eventLog.append({ kind: "run_ledger_error", sessionId: target, message });
			},
		);
		return {
			sessions,
			sessionId: target,
			entries:
				all.length > RUN_LEDGER_IPC_LIMIT
					? all.slice(-RUN_LEDGER_IPC_LIMIT)
					: all,
		};
	},

	// docx venv 四态：只探测不安装（诊断页不该有环境副作用，
	// 见 shared/ipc.ts 该通道注释）。探测的落点由托管根解析决定（Python 已迁入托管运行时）。
	[INVOKE.docxEnvStatus]: async (): Promise<DocxEnvStatus> =>
		inspectPythonRuntime(pythonRuntimeOptions(), defaultSpawn),

	/* ── 托管运行时（设置页「内置运行时」一级分区，spec: add-managed-runtimes 阶段 3）── */

	/*
	 * 清单与开关都走 core/runtime-inventory.ts 这一个模块：状态口径与模型侧
	 * `python_env` 段同一份（不 spawn，只读磁盘事实 + 落盘失败日志），开关写的是
	 * preferences.runtimes 这一处 —— 于是「设置页看到被禁用」与「模型看到被禁用」
	 * 不可能分叉。写开关后立刻重新采集：返回的清单即生效后的状态（开关无需重启）。
	 */
	[INVOKE.runtimesSnapshot]: async (): Promise<RuntimeInventory> => collectRuntimeInventory(),

	[INVOKE.setRuntimeMaster]: async ([enabled]): Promise<RuntimeInventory> => {
		writeRuntimeMaster(enabled as boolean);
		/*
		 * 审计留痕（spec: add-managed-runtimes 阶段 4 的「运行时」一类：被禁用）。
		 * 关掉总开关 = 三个运行时都不再注入，模型侧也拿不到路径 —— 这是用户显式
		 * 收回能力的动作，属审计要记的「谁把什么关掉了」，而不是普通的偏好变更。
		 */
		if (enabled === false) {
			writeAuditRecord({
				category: "runtime",
				outcome: "disabled",
				detail: "用户关闭了「内置运行时」总开关：全部托管运行时都不再注入",
			});
		}
		return collectRuntimeInventory();
	},

	[INVOKE.setRuntimeEnabled]: async ([id, enabled]): Promise<RuntimeInventory> => {
		writeRuntimeEnabled(id as string, enabled as boolean);
		// 逐项关闭同样留痕（重新开启不记）：审计要回答的是「什么时候少了什么能力」。
		if (enabled === false) {
			writeAuditRecord({
				category: "runtime",
				outcome: "disabled",
				detail: clipAuditDetail(`用户禁用了运行时「${String(id)}」：路径与托管目录不再注入`),
			});
		}
		return collectRuntimeInventory();
	},

	// 诊断按需 spawn（深度四态：版本不符 / 缺依赖只有真跑一次才知道），
	// 与清单的浅判据分工见 core/runtime-inventory.ts 文件头。
	[INVOKE.runtimeDiagnostics]: async ([id]) =>
		collectRuntimeDiagnosticsText(id as string, defaultSpawn),

	/*
	 * 按需安装（阶段 7：三运行时纯按需，没有任何静默自动下载）。安装要联网下载
	 * 几十到几百 MB，所以进度走 PUSH（用户切走设置页再切回来仍看得到），
	 * 取消走 runtimeInstalls 里那个 AbortSignal。失败**响亮 reject**：界面据此给
	 * 可执行原因，并同时落一条审计（与重置失败同口径）。
	 */
	[INVOKE.runtimeInstall]: async ([id]): Promise<RuntimeInventory> => {
		const runtimeId = id as string;
		if (runtimeInstalls.has(runtimeId)) throw new Error(`「${runtimeId}」的安装已在进行中`);
		const controller = new AbortController();
		runtimeInstalls.set(runtimeId, controller);
		const pushProgress = (progress: RuntimeInstallProgress): void => {
			post({ kind: "push", channel: PUSH.runtimeInstallProgress, payload: progress });
		};
		pushProgress({ id: runtimeId, kind: "running", message: "正在下载并安装…需联网。" });
		try {
			const inventory = await installManagedRuntime(runtimeId, defaultSpawn, controller.signal, {}, pushProgress);
			pushProgress({ id: runtimeId, kind: "done", message: "安装完成。" });
			return inventory;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			// 取消是用户的动作，不是失败：不写审计、终态标 cancelled（界面据此静默收尾）。
			if (controller.signal.aborted) {
				pushProgress({ id: runtimeId, kind: "cancelled", message });
				throw error;
			}
			pushProgress({ id: runtimeId, kind: "failed", message });
			writeAuditRecord({
				category: "runtime",
				outcome: "failed",
				detail: clipAuditDetail(`安装运行时「${runtimeId}」失败：${message}`),
			});
			throw error;
		} finally {
			runtimeInstalls.delete(runtimeId);
		}
	},

	/** 取消进行中的安装（在**下一次推进前**生效，见 core/runtime-inventory.ts 的取消语义）。 */
	[INVOKE.runtimeCancelInstall]: async ([id]): Promise<void> => {
		runtimeInstalls.get(id as string)?.abort();
	},

	// 重置走内核的幂等链路（清残留 → 安装 → 校验 → 进位 → 发布）。失败 reject，
	// 原因带相位与底层错误 —— 用户主动点的修复不许静默失败。
	[INVOKE.runtimeReset]: async ([id]): Promise<RuntimeInventory> => {
		try {
			return await resetManagedRuntime(id as string, defaultSpawn);
		} catch (error) {
			// 重置失败也进审计（「运行时」一类的安装失败）：这是用户主动点的修复，
			// 失败了必须留下可查的痕迹，否则只剩一个弹窗里闪过的报错。
			const message = error instanceof Error ? error.message : String(error);
			writeAuditRecord({
				category: "runtime",
				outcome: "failed",
				detail: clipAuditDetail(`重置运行时「${String(id)}」失败：${message}`),
			});
			throw error;
		}
	},

	/* ── 审计中心（spec: add-managed-runtimes 阶段 4） ─────────────── */

	// 面板拉取。/ 清空后的回读 / 导出全文三者共用下面的 auditSnapshot ——
	// 「导出与面板同源」靠这条共用，而不是靠约定。
	[INVOKE.auditList]: async ([category]) => auditSnapshot(category),

	[INVOKE.auditClear]: async () => {
		// 清空由 core/audit-log 先删后补（留痕），返回新状态省掉一次往返。
		clearAuditRecords();
		return auditSnapshot(undefined);
	},

	[INVOKE.auditExport]: async () => exportAuditRecords(),

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
		//
		// **例外：run 进行中的 prompt 不进链**（2026-09-16 修「插入任务没反应」）。
		// steer 是信号不是写操作 —— 链上前一个 prompt await 的就是整段 run，
		// 第二条消息排进去要等 run 收尾才轮得到；那时流式已结束，session-host
		// 的 steer 分支永远走不到，插入退化为「跑完后当作新一轮」，用户看到的
		// 就是发了没反应。与 abort 同一条豁免理由：pi 本就设计为 run 进行中
		// 从外部调用 steer。
		const bucket = currentBucket;
		bucket.lastUsedAt = Date.now();
		if (bucket.running) {
			// 缺省 followUp = **排队**：补一句的常规意图是「等当前任务跑完再接着做」，
			// 立刻插进这一轮（steer）要用户显式点「立即插入」才发生。
			// 两个入口共用这一个缺省值，写在这里而不是 session-host，是为了让
			// 「哪条路是默认」只有一个地方说了算。
			// pi 的 steer/followUp 入队即返回（agent-session.js：push 进队列 +
			// emitQueueUpdate，不等 run），所以这条路的 IPC 本来就快。
			const host = await getHost(bucket);
			await host.prompt(text, whileStreaming ?? "followUp", images);
			return;
		}
		/*
		 * **受理即回**（2026-09-16 修「带图发送后图片 chip 挂满整个 run」）：
		 * 下面这行原本 `await enqueue(...)` 到 run 结束，IPC promise 也就挂到
		 * run 结束 —— 而 renderer 的附件清除挂在 promise 成功分支上（composer
		 * submit 的注释），结果是输入区的图片要等整个任务跑完才消失（实测 48s）。
		 * 把「提交成功」与「run 结束」拆开：**run_started 即 resolve**（实测
		 * IPC→run_started 仅 ~12ms），run 本体留在链上串行语义不变。
		 *
		 * 失败语义分两段保真：
		 *   - 起跑前（getHost 抛 / pi 预检抛：没配模型、密钥失效）→ reject，
		 *     renderer 照旧收到错误：附件留在输入区、错误可重试 —— 原语义；
		 *   - run 中途失败 → run_error 事件折叠成消息流里的错误卡（独立通路，
		 *     从不依赖本 IPC 的 reject），附件此时已清 —— 本就已被 run 消费。
		 */
		let settleAccepted!: () => void;
		let failAccepted!: (error: unknown) => void;
		const accepted = new Promise<void>((resolve, reject) => {
			settleAccepted = resolve;
			failAccepted = reject;
		});
		let acceptedSettled = false;
		// 先挂空分支吃掉 rejected 态，末尾的 await 才不会变成 unhandled rejection。
		void accepted.then(
			() => {
				acceptedSettled = true;
			},
			() => {
				acceptedSettled = true;
			},
		);
		const onRunStarted = (): void => settleAccepted();
		let waiters = runStartWaiters.get(bucket);
		if (waiters === undefined) {
			waiters = new Set();
			runStartWaiters.set(bucket, waiters);
		}
		waiters.add(onRunStarted);
		try {
			await enqueue(bucket, async () => {
				let host: SessionHost;
				try {
					host = await getHost(bucket);
				} catch (error) {
					if (!acceptedSettled) failAccepted(error);
					throw error;
				}
				try {
					await host.prompt(text, whileStreaming, images);
					// 兜底：run 收尾却从未见过 run_started（理论不发生）也别把提交方吊死。
					if (!acceptedSettled) settleAccepted();
				} catch (error) {
					// 起跑前的抛错（pi 预检）从这里回给提交方；run 已开始后的抛错
					// 说明 accepted 已 resolve，这里 rethrow 只为链的 tail 记账。
					if (!acceptedSettled) failAccepted(error);
					throw error;
				} finally {
					waiters?.delete(onRunStarted);
				}
			}).catch(() => {
				/* 失败已经由 accepted 传给提交方；链上 promise 不接会变 unhandled rejection */
			});
		} catch {
			/* enqueue 本身不 reject（见 session-registry.ts），守一道纯防御 */
		}
		await accepted;
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

	// 最近一次注入的 hidden context 全文（任务诊断面板 ② 的「实际内容」块）。
	// 宿主未建（还没发过消息）直接 undefined，不为此建宿主 —— 建宿主会产生
	// 目录与模型校验副作用，展示口不该有这些代价。
	[INVOKE.hiddenContext]: async () => {
		const hostPromise = currentBucket.hostPromise;
		if (hostPromise === undefined) return undefined;
		return (await hostPromise).peekHiddenContext();
	},

	/**
	 * 重排 steer / followUp 等待队列（排队 chips 的删除/编辑底层动作）。
	 * 不进互斥链 —— 与 prompt 的 run 中旁路、abort 同一理由：它操作的是
	 * 「正在跑的那一轮」的队列，排在整段 run 后面就永远轮不到。
	 * run 已结束时 clearQueue 即完成、重入队挂到下一轮（消息不丢，chips 仍在）。
	 */
	[INVOKE.queueRewrite]: async ([queued]) => {
		const hostPromise = currentBucket.hostPromise;
		if (hostPromise === undefined) return;
		const { steering, followUp } = queued as QueuedMessages;
		await (await hostPromise).rewriteQueue(steering, followUp);
	},

	/**
	 * 新建任务：旧会话后台保活（宿主留注册表，run 照跑），开一个全新
	 * pristine 桶为当前会话（见 newTask）。
	 */
	[INVOKE.newTask]: async ([cwd]) => newTask(cwd as string | undefined),

	/* ── 历史会话 ─────────────────────────────────────────────────── */

	[INVOKE.sessionList]: async () => listSessions(),

	// 归档 / 取消归档（L28）：只动 archive.json 索引，会话文件与宿主不动 ——
	// 归档 ≠ 下线，正在聊的会话归档后照常可用（WB 同语义）。列表变化推
	// taskListChanged 让侧栏即时收起。
	[INVOKE.sessionArchive]: async ([path, archived]) => {
		sessionArchive.setArchived(resolve(path as string), archived as boolean, Date.now());
		pushTaskListChanged();
	},

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
		// pi 首用时才装配（见文件顶的惰性说明）。
		const { SessionManager } = await import("@earendil-works/pi-coding-agent");
		SessionManager.open(target, getSessionsDir()).appendSessionInfo(trimmed);
		pushTaskListChanged();
	},

	// 会话分支（spec: add-session-branching）：两条流程都排进该会话的互斥链，
	// 与 prompt / rename / delete 串行（见 restartSession /
	// forkSession 的顺序注释）。拒绝走返回值而不是 reject（reason 是界面文案的
	// 分支依据，契约见 shared/ipc.ts 的 SessionBranchResult）。
	[INVOKE.sessionRestart]: async ([path, userIndex, options]) =>
		restartSession(path as string, userIndex as number, options as { saveBranch?: boolean } | undefined),

	[INVOKE.sessionBranch]: async ([path, userIndex, options]) =>
		forkSession(path as string, userIndex as number, options as { includeTurn?: boolean } | undefined),

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
			// 信箱随会话一起销毁：未投出的消息没有存在的意义（spec: add-team-foundations）。
			teamMailbox.clear(bucket.sessionId);
			// 团队随会话一起解散（同逐出决策，spec 批 5）。
			void disbandTeamOf(bucket.sessionId);
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
		 * 输出固定落**生效根**的 exports/（getEffectiveWorkspaceRoot()，不是当前会话 cwd）：
		 * 临时任务的 cwd 是各任务自己的目录，导出物落在其下会散落到各处；
		 * 固定落点让用户总能在一个地方找到自己的导出物，不用记「当时用的哪个工作区」。
		 * 用生效根而非内置默认根：用户在设置里改「默认存储路径」改的就是生效根，
		 * 导出物应随之落到新根，否则「改完路径后部分数据仍落旧位置」的口径不一致
		 * （core/session-export.ts 文件头是同一决策）。
		 */
		const exportsDir = join(getEffectiveWorkspaceRoot(), "exports");
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

	/*
	 * worktree（对齐清单 C22 / L27）。两者都不碰既有会话：
	 * 列分支是只读查询；设基准分支只改「下一个新任务在哪个分支上建副本」，
	 * 副本一经创建就与会话终身绑定，换分支意味着换工作副本（那要重建会话，
	 * 属另一件事）。当前会话还没建宿主时顺带写进桶，好让 createHost 读到。
	 */
	[INVOKE.worktreeBranches]: async ([cwd]) => getBranchList(cwd as string),
	[INVOKE.setWorktreeBranch]: async ([branch]) => {
		if (branch === undefined || branch === null) {
			pendingWorktreeBranch = undefined;
		} else if (typeof branch === "string") {
			const trimmed = branch.trim();
			// 走与 daemon 侧创建时同一个校验器：设的时候拦住非法分支名，
			// 比建副本时才失败好（那时用户已经发完消息了）。
			pendingWorktreeBranch = trimmed === "" ? undefined : requireBranchName(trimmed);
		} else {
			throw new Error("基准分支必须是字符串或 undefined");
		}
		if (currentBucket.hostPromise === undefined) {
			currentBucket.pendingWorktreeBranch = pendingWorktreeBranch;
		}
	},

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
	 * 选择 / 清除专家。专家是与交互模式**正交**的会话绑定：本通道只读写
	 * expertId，绝不改 interactionId（目标 = 当前桶，A 会话的专家不影响 B 会话）。
	 */
	[INVOKE.setExpert]: async ([expertId]) => {
		const id = expertId as string | undefined;
		// 选择前校验专家真实存在：renderer 的菜单项可能落后于用户删文件，
		// 放过去会建成「没有人格」的专家会话（compose 时照样炸，但那时用户
		// 已经把选择落下了 —— 在选择的这一刻报错）。校验与 compose 期同一条
		// 专家查找（requireExpertPersona 包着 compose 也用的 resolveSessionExpert）
		// —— 单一出处，专家被删/改名立刻响亮失败。
		if (id !== undefined) requireExpertPersona(loadExpertsNow(), id);
		const bucket = currentBucket;
		const hostPromise = bucket.hostPromise;
		if (hostPromise === undefined) {
			// 清除语义必须显式写 undefined：updateStateLocally 是浅合并，
			// 不带 expertId 键会把旧值留在 state 里。
			updateStateLocally(bucket, { expertId: id });
			return;
		}
		(await hostPromise).setExpert(id);
	},

	/**
	 * 专家列表：renderer「专家 ▸」子菜单、对话头部与起手 chips 的展示数据源。
	 * 每次现载不缓存（与 setExpert 的校验同一条读路径，用户级覆盖即时生效）；
	 * 只映射展示字段，人格正文不下发 —— compose 时 daemon 自取。
	 */
	[INVOKE.listExperts]: async () =>
		loadExpertsNow().map((e) => ({
			name: e.name,
			displayName: e.displayName,
			profession: e.profession,
			description: e.description,
			displayDescription: e.displayDescription,
			quickPrompts: e.quickPrompts,
			tags: e.tags,
			source: e.source,
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

	/*
	 * 模型连通性测试（设置-模型页卡片上的「测试」按钮）。
	 *
	 * 不 throw、用返回值表达失败：测试的意义就是把失败原因带回来展示，
	 * throw 会被 IPC 层裹成通用错误文案，丢掉 probeModel 精心归类的单行原因。
	 * 凭据获取的三条路径：auth.json（我们自己写的）→ 环境变量（label 是变量名）→
	 * 订阅/命令注入拿不到明文，明确报不支持；fallback（无凭据，本地服务）直接
	 * 发无鉴权探测，结果由服务端如实回答。
	 */
	[INVOKE.testModel]: async ([modelKey]): Promise<ModelProbeResult> => {
		const key = modelKey as string;
		const parsed = parseModelKey(key);
		const catalog = await getCatalog();
		const model = parsed === undefined ? undefined : catalog.resolveModel(key);
		if (parsed === undefined || model === undefined) {
			return { ok: false, error: "目录里找不到该模型，请刷新模型目录后重试" };
		}

		const status = catalog.modelRuntime.getProviderAuthStatus(parsed.providerId);
		let apiKey = readApiKey(getAuthPath(), parsed.providerId);
		if (apiKey === undefined && status.source === "environment" && status.label !== undefined) {
			const fromEnv = process.env[status.label];
			if (fromEnv !== undefined && fromEnv !== "") apiKey = fromEnv;
		}
		if (apiKey === undefined && status.configured && status.source !== "fallback") {
			return { ok: false, error: "该服务商凭据来自订阅登录或命令注入，拿不到明文，暂不支持测试" };
		}

		// 外层硬超时与 testWebSearch 同因：Windows DNS 解析不可中断，
		// probeModel 自己的 AbortSignal.timeout 停不掉它，测试按钮必须永远有返回。
		try {
			return await withHardTimeout(
				probeModel({
					api: model.api,
					baseUrl: model.baseUrl,
					modelId: model.id,
					apiKey,
					extraHeaders: model.headers,
					// 认证头形态与真实会话同源（models.json 的 authHeader 标记）。
					authHeader: catalog.readCustomProvider(parsed.providerId)?.authHeader === true,
				}),
				15_000,
			);
		} catch (error) {
			return { ok: false, error: error instanceof Error ? error.message : String(error) };
		}
	},

	/*
	 * 表单内测试（自定义服务商表单的「测试」按钮）。
	 *
	 * 与上面 testModel 的关键差别：**不查已保存的目录**。表单里刚填的
	 * baseUrl / 模型 id 在保存前不在目录里，走 testModel 只会得到
	 * 「目录里找不到该模型」——而这条通道存在的意义正是「填完就试」。
	 * 因此探测目标完全由入参构造，只借用 probeModel 这一份协议实现（不另写一份）。
	 *
	 * 凭据优先取表单里刚敲的那个：用户点测试往往正是因为「怀疑刚才那把 key
	 * 不对」，此时读已存的反而测的不是他想测的东西。表单留空才回落到已存凭据，
	 * 好让「编辑既有服务商、只改 baseUrl」不必重打密钥。
	 */
	[INVOKE.testDraftModel]: async ([draft, modelId, apiKey]): Promise<ModelProbeResult> => {
		const form = draft as {
			providerId: string;
			api: string;
			baseUrl: string;
			authHeader?: boolean;
		};
		const target = (modelId as string).trim();
		if (form.baseUrl.trim() === "") return { ok: false, error: "请先填写接口地址" };
		if (target === "") return { ok: false, error: "请先填写模型 ID" };

		const typed = (apiKey as string | undefined)?.trim();
		const key =
			typed === undefined || typed === ""
				? readApiKey(getAuthPath(), form.providerId)
				: typed;

		try {
			return await withHardTimeout(
				probeModel({
					api: form.api,
					baseUrl: form.baseUrl,
					modelId: target,
					apiKey: key,
					authHeader: form.authHeader === true,
				}),
				15_000,
			);
		} catch (error) {
			return { ok: false, error: error instanceof Error ? error.message : String(error) };
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

	/* ── 团队协作开关（spec: add-team-foundations 批 5） ──────────── */

	// 未配置回 false（缺省关闭）：实验特性缺省不可见，对齐 WorkBuddy 的立场；
	// 缺省语义收在这一个出口（读偏好处不填默认值，同 memoryEnabled）。
	[INVOKE.getAgentTeamsEnabled]: async () => ({
		enabled: readPreferences().agentTeamsEnabled ?? false,
	}),

	// 读改写（同上）。只影响之后新建的会话：团队工具注册发生在 SessionHost
	// 建立时（teamExtensionFactory 的 isEnabled 现读偏好），既有会话不补注册。
	[INVOKE.setAgentTeamsEnabled]: async ([enabled]) => {
		const value = enabled === true;
		writePreferences({ ...readPreferences(), agentTeamsEnabled: value });
	},

	/* ── 团队成员会话操作（spec: add-team-foundations 批 8） ───────── */

	// 聚焦成员视图的发送与 @直接路由共用：按成员 sessionId 找句柄直投
	// （followUp 语义在 handle.prompt 内部）。找不到句柄 = 成员已解散，
	// 响亮报错让上层的错误卡如实呈现，不静默丢消息。
	[INVOKE.memberPrompt]: async ([memberSessionId, text]) => {
		const handle = memberHandlesBySession.get(memberSessionId as string);
		if (handle === undefined) {
			throw new Error("该成员已不在团队中（可能已解散），无法接收消息");
		}
		const textValue = text as string;
		if (textValue.trim() === "") throw new Error("消息不能为空");
		await handle.prompt(textValue);
	},

	[INVOKE.memberAbort]: async ([memberSessionId]) => {
		const handle = memberHandlesBySession.get(memberSessionId as string);
		if (handle === undefined) return; // 已解散 = 无可中止，空操作（同 abort 对无宿主桶）
		await handle.abort();
	},

	/* ── 用户画像（spec: add-memory-system） ────────────────────── */

	// 文件不存在回空串：设置页 textarea 从空白开始。「还没生成过画像」是新用户
	// 的常态，不是错误（同 memory.ts 的降级口径：用户数据缺席不该响亮失败）。
	[INVOKE.getProfile]: async () => ({
		content: existsSync(profilePath()) ? readFileSync(profilePath(), "utf8") : "",
	}),

	// 覆盖写全文。画像在 compose 时现读现拼（buildSessionMemorySection），
	// 所以写完下一轮对话即生效，无需通知任何运行中的会话。
	[INVOKE.setProfile]: async ([content]) => {
		writeFileSync(profilePath(), content as string, "utf8");
	},

	// 清空内容但保留文件本身：蒸馏任务每晚照常往里写，删文件反而多一条
	// 「不存在 → 重建」的分支要维护。
	[INVOKE.resetProfile]: async () => {
		writeFileSync(profilePath(), "", "utf8");
	},

	/* ── 个性化（spec: rework-settings-layout） ──────────────────── */

	// 合并缺省后下发：字符串四键空串 = 未设置（renderer 显示用），两个 boolean
	// 缺省 true —— 缺省语义收在这一个出口（读偏好处不填默认值，同 memoryEnabled）。
	[INVOKE.getPersonalization]: async () => {
		const prefs = readPreferences();
		return {
			customInstructions: prefs.customInstructions ?? "",
			userNickname: prefs.userNickname ?? "",
			assistantName: prefs.assistantName ?? "",
			personaDescription: prefs.personaDescription ?? "",
			welcomeGreeting: prefs.welcomeGreeting ?? true,
			showChangeDetails: prefs.showChangeDetails ?? true,
		};
	},

	// 部分更新合并：只动传入的键（读改写不丢其他键）；字符串 trim 后为空 =
	// 删该键（空 = 未设置，与读取层的空串归一化口径一致）；非字符串响亮抛错。
	[INVOKE.setPersonalization]: async ([patch]) => {
		const input = patch as PersonalizationPatch;
		const next: Record<string, unknown> = { ...readPreferences() };
		const stringKeys = ["customInstructions", "userNickname", "assistantName", "personaDescription"] as const;
		for (const key of stringKeys) {
			const value = input[key];
			if (value === undefined) continue;
			if (typeof value !== "string") throw new Error(`个性化字段 ${key} 应为字符串`);
			const trimmed = value.trim();
			if (trimmed === "") delete next[key];
			else next[key] = value;
		}
		if (input.welcomeGreeting !== undefined) next["welcomeGreeting"] = input.welcomeGreeting === true;
		if (input.showChangeDetails !== undefined) next["showChangeDetails"] = input.showChangeDetails === true;
		// 逐键操作走 Record（delete 需要）；形状回到 Preferences 由上面的键清单保证。
		writePreferences(next as unknown as Parameters<typeof writePreferences>[0]);
	},

	/* ── 长期记忆记录（MEMORY.md，spec: rework-settings-layout） ──── */

	// 不存在回空串：「还没任何长期记忆」是常态不是错误（同 getProfile 口径）。
	// 写入前确保目录在（新机器上 ~/.kamibuddy 可能还没建过）。
	[INVOKE.getMemory]: async () => ({
		content: existsSync(userMemoryPath()) ? readFileSync(userMemoryPath(), "utf8") : "",
	}),

	[INVOKE.setMemory]: async ([content]) => {
		mkdirSync(getConfigDir(), { recursive: true });
		writeFileSync(userMemoryPath(), content as string, "utf8");
	},

	/* ── 提示词预览（设置页，spec: systematize-prompt-architecture Task 5） ── */

	// 纯逻辑在 ./prompt-preview.ts（可测）；这里只负责现取环境：
	// 技能清单 / 专家库 / 风格偏好现读（与 composeSystemPrompt 同一口径）。
	// 预览只组装系统提示词，不产出逐轮可变事实（时间/记忆内容/个性化 —— 它们走
	// prompt-switch 的注入，不在提示词里）与工作目录（hidden context 的
	// workspace_context）、托管解释器路径（hidden context 的 python_env）。
	[INVOKE.promptPreview]: async ([request]) => {
		const preview = request as PromptPreviewRequest;
		/*
		 * 专家库只现载一次：人格（buildPromptPreview 内的 requireExpertPersona 走同一
		 * experts）与私有技能目录同源于这一次查找（与 composeSystemPrompt 同口径）。
		 * 绑定专家时把它的 skillsDir 追加进技能加载路径 —— 否则预览会漏掉专家的私有
		 * 技能，与「此刻发消息看到的提示词」静默漂移；未绑定时与全局技能池完全一致。
		 */
		const experts = loadExpertsNow();
		const expert = resolveSessionExpert(experts, preview.expertId);
		return buildPromptPreview(RESOURCES, preview, {
			/*
			 * 技能清单要过**同一份**启用过滤（enabledSkills 用的也是这个纯函数）：
			 * 预览里出现一个「此刻发消息根本看不到」的技能，就是与真实组装的静默漂移。
			 * 这里直接调 filterEnabledSkills 而不是 enabledSkills(preview.expertId)，
			 * 是因为上面已经把专家解析过一次了 —— 再调一次会把专家库整库重载一遍
			 * （列表同源：同一份 listSkills 结果 + 同一份 overrides + 同一个过滤函数）。
			 */
			skills: toSkillDescriptors(
				filterEnabledSkills(
					await listSkills(expert?.skillsDir),
					readPreferences().skillOverrides,
				),
			),
			// 预览按请求里的 expertId 解析人格（同一条 requireExpertPersona 路径）。
			experts,
			preferredStyleId: readPreferences().styleId,
			// 与 composeSystemPrompt 同一来源现读（含降级口径），预览不静默漂移。
			memorySystemBody: loadMemorySystemPrompt(getResourcesDir()),
		});
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
		files: indexFiles(currentBucket.cwd),
		commands: [
			// 技能：/skill:name 由 pi 的 prompt 自动展开（_expandSkillCommand），
			// renderer 只需把名字补全出来，原样传给 session.prompt 即可。
			// `user-invocable: false` 的（纯内部技能）不进菜单 —— 面板是给用户手动选的地方；
			// 手动敲 /skill:<name> 仍然照旧可用（可见性只收菜单，不拦 pi 的展开）。
			// 技能集必须走 enabledSkills（与清单段、use_skill 同一个出口）：
			// 各写一份过滤就会出现「菜单里有但 use_skill 加载不了」。
			// 不传专家 id = 与今日行为一致的全局池口径（专家私有技能只在绑定该专家的
			// 会话里可见，那条差异与本轮的启停过滤无关）。
			...(await enabledSkills(undefined))
				.filter((s) => s.userInvocable)
				.map((s) => ({
					// 前缀用共享常量（渲染层要按它切出裸技能名去渲染 chip）。
					name: `${SKILL_COMMAND_PREFIX}${s.name}`,
					description: s.description,
					source: "skill" as const,
				})),
			// 提示词模板：/模板名 由 pi 的 expandPromptTemplate 展开。
			// 发现目录必须与会话实际生效的一致 —— cwd 取当前会话桶的 cwd
			//（会话与 cwd 终身绑定，桶即真相）。空串 = 待分配（还没工作目录）由
			// listSessionPromptTemplates 收口为空列表，不落到 daemon 进程 cwd 去扫。
			...listSessionPromptTemplates(currentBucket.cwd, getConfigDir()).map((t) => ({
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
		// 过滤掉每任务的自动分配目录与历史共享临时目录：它们躺在根下，但不是
		// 可切换的工作空间（切进去等于和别的任务共用 cwd），混进下拉就是噪音
		// —— WorkBuddy 的 picker 用 isManualWorkspaceCwd 做同一件事。
		// 只在这里过滤（不改 listWorkspaces）：那是「列出根下子目录」的通用原语，
		// 保留全部目录，过滤是选择器自己的口径（谓词见 workspace-model.ts）。
		workspaces: listWorkspaces(getEffectiveWorkspaceRoot()).filter(isSelectableWorkspaceDir),
		previewBaseUrl: previewServers.baseUrlFor(defaultWorkspaceDir),
		// worktree 意图与 current 同源（都是「下一个新任务怎么起」）：
		// 芯片据此显示自己是否已启用，见 WorkspaceSnapshot.worktreeBranch 的注释。
		worktreeBranch: pendingWorktreeBranch,
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
	 *
	 * 白名单 = 已知工作空间 ∪ 任一已知会话的 cwd（后者是为任务区放开，见
	 * isRevealableCwd）：任务区会话不成组（listWorkspaceGroups 只收非临时会话），
	 * 不把它们的 cwd 纳入，任务行「打开文件夹」就找不到自己的时间戳目录。
	 * 未知路径（家目录、系统目录）不在任一列表中，仍一律拒。
	 */
	[INVOKE.workspaceReveal]: async ([cwd]) => {
		const known = [
			...(await listWorkspaceGroups()).map((g) => g.cwd),
			...(await listSessions()).map((s) => s.cwd),
		];
		if (!isRevealableCwd(cwd as string, known)) {
			throw new Error("不是已知的工作空间");
		}
	},

	/* ── 产物 ─────────────────────────────────────────────────────── */

	// 预览面板的文本读取。HTML 预览不走这里（走静态服务），这里管文本类。
	[INVOKE.readArtifact]: async ([path]) => readSessionArtifact(currentBucket.cwd, path as string),
	[INVOKE.statPath]: async ([path]) => statSessionArtifact(currentBucket.cwd, path as string),

	/* ── 权限审批回程 ─────────────────────────────────────────────── */

	[INVOKE.permissionResponse]: async ([response]) => {
		const answer = response as PermissionResponse;
		const pending = pendingApprovals.get(answer.id);
		// 找不到通常是重复应答（用户连点两下）。静默忽略即可，不是错误 ——
		// 也不落审计日志：那不是一次真实的选择，记上只会污染事后还原。
		if (pending === undefined) return;
		pendingApprovals.delete(answer.id);
		/*
		 * 批准写回（spec: add-permission-rules-engine Task 3 /
		 * extend-permission-rules-to-paths Task 2）：用户勾了「以后都允许…」时，
		 * 把 allow 规则并入内存规则集并落盘（appendRule 幂等，内存先更新 ——
		 * 门经 getRules 读内存，下一次同类调用即免问）。校验全在
		 * rememberRuleFromApproval：不信任 IPC 载荷 —— powershell 走首词校验
		 * （解释器/含分隔符/含空白一律忽略），read 家族走「绝对路径且不在
		 * 凭据/配置目录内」校验（禁区内规则是死规则，判定链阶段 1 永远先拒）；
		 * 其余工具上附着的 prefix 一律忽略，不炸不拒。
		 */
		const rule = rememberRuleFromApproval(pending.toolName, answer, [getConfigDir(), ...PROTECTED_DIRS]);
		if (rule !== undefined) appendRule(rule);
		/*
		 * 以用户实际作出选择的位置为准落 decided 半边（而非 resolve 包装）：
		 * 审计要的是「用户批了什么」，重复应答与悬空 id 都不算选择。
		 *
		 * outcome 记**闭集值**（shared/permissions 的 normalizeApprovalOutcome）：
		 * 不合契约的应答在这里就落成 unavailable，与权限门的消费是同一份规范化，
		 * 于是「日志说放行了、门却拒了」这种对不上的情况在结构上不可能出现。
		 */
		const outcome = normalizeApprovalOutcome(answer);
		eventLog.append({
			kind: "permission_response",
			id: answer.id,
			toolName: pending.toolName,
			outcome,
			remember: answer.remember === true,
			// 写回成功的规则前缀一并入档：审计要能还原「这次批准留下了什么持久影响」。
			...(rule === undefined ? {} : { rulePrefix: rule.prefix }),
		});
		pending.resolve(answer);
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
 * 面板形态的审计快照：类别过滤 + 展示上限 + 过滤后的总数。
 *
 * 类别值来自 IPC（半可信）：非法值**响亮拒绝**，不当成「不过滤」——
 * 静默忽略会让面板显示全量而用户以为筛过了。
 * 过滤与截断都走 core/audit-log.ts 的同一条查询（导出走同一条、只是不给 limit）。
 */
function auditSnapshot(category: unknown): AuditQueryResult {
	if (category !== undefined && !isAuditCategory(category)) {
		throw new Error(`未知的审计类别：${String(category)}`);
	}
	const { records, total } = readAuditRecords({
		...(category === undefined ? {} : { category: category as AuditCategory }),
		limit: AUDIT_PANEL_LIMIT,
	});
	return { records, total, limit: AUDIT_PANEL_LIMIT };
}

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
 * 交互模式切换的统一入口：setInteraction 通道与 /plan 内置命令都走这里。
 *
 * 只切模式轴 —— 专家绑定（expertId）与模式正交，不在这里读也不在这里写
 *（spec: rework-expert-orthogonal-and-skills）。
 *
 * 任何切到非 plan 模式的切换都刷新**该会话**的记忆 —— 用户从切换器切走后
 * 再发 /plan，回到的必须是刚切走的那个模式，而不是一条过时记忆。
 * 记忆按桶存：A 会话的 /plan 不该切回 B 会话记下的模式。
 */
async function applyInteraction(
	bucket: SessionBucket<SessionHost>,
	id: string,
): Promise<void> {
	const readyId = requireReady(INTERACTIONS, id, "交互模式");
	if (readyId !== "plan") bucket.lastNonPlanInteraction = readyId;
	if (bucket.hostPromise === undefined) {
		updateStateLocally(bucket, { interactionId: readyId });
		return;
	}
	(await bucket.hostPromise).setInteraction(readyId);
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

/**
 * pi 的外部二进制（fd / rg）就位检查。
 *
 * 为什么必须做：pi 的 find/grep 工具靠这两个 exe，找不到它就去 GitHub 下 ——
 * 国内网络下那条路不通，而且**每次调用白等 10 秒**、失败原因还被 pi 吞掉
 * （实测 2026-09-17，详见 core/agent-tools.ts 的文件头）。所以二进制随包带，
 * 这里补到 pi 的 bin 目录；命中之后 pi 一次网络都不会发。
 *
 * 为什么放在 ready **之后** fire-and-forget（原来在 start() 里同步跑）：它需要
 * pi 的 `getAgentDir()`，而 pi 整包实测热态 1809ms（冷态 4.7s）是启动开销里最大
 * 的一笔。这两个 exe 只有 pi 的内置 find/grep 用得上，第一次会话才可能碰到 ——
 * 让首屏（四个加载文案全挂在 ready 这个闸门上）替「可能永远不发生的工具调用」
 * 买单是纯亏。`getAgentDir()` 只读一个环境变量推导路径，几十毫秒内就跑完，
 * 远早于任何会话建立。
 *
 * 幂等：已就位时零输出（连日志都不写），只有真的补了、或随包资产本身缺失才记一笔。
 *
 * 失败口径的变化（有意为之）：原来是 start() 里同步调用，抛错 → 启动失败 → 进程退出。
 * 现在不能再用「退出」表达 —— daemon 已经 ready、用户可能正在用。改成**响亮记日志**
 * （stderr + 事件日志），实际后果只落在 find/grep 可用性上，不值得让整个应用不可用。
 */
async function prepareAgentTools(): Promise<void> {
	try {
		const agentTools = await ensureAgentTools();
		if (agentTools.installed.length > 0 || agentTools.missing.length > 0) {
			eventLog.append({
				kind: "agent_tools",
				target: agentTools.targetDir,
				installed: [...agentTools.installed],
				present: [...agentTools.present],
				missing: [...agentTools.missing],
			});
		}
		if (agentTools.missing.length > 0) {
			// 响亮：缺了就是 find/grep 不可用（模型会每轮白等 10 秒的联网下载），
			// 这必须在启动日志里看得见，不能只体现在工具报错上。
			console.error(
				`pi 的外部二进制缺失（find/grep 将不可用）：${agentTools.missing.join(", ")} —— 检查 resources/bin/`,
			);
		}
		if (agentTools.installed.length > 0) {
			console.log(
				`已就位 pi 外部二进制：${agentTools.installed.join(", ")} → ${agentTools.targetDir}`,
			);
		}
	} catch (error) {
		// 不吞：拷贝失败 / pi 装配失败都要在日志里看得见（AGENTS.md §7）。
		const message = error instanceof Error ? error.message : String(error);
		console.error(`pi 外部二进制就位检查失败（find/grep 可能不可用）：${message}`);
		eventLog.append({ kind: "agent_tools", error: message });
	}
}

function start(): void {
	// pi 不再在模块顶部静态导入（见文件顶的惰性说明）：走到这里时它**一次都没被装配**，
	// 而 Electron 内的 Node-API 兼容性已在 D2 实测确认（ARCHITECTURE.md §4.1）。
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

	// 初始默认落点的预览服务（多根池里第一个实例）。默认落点可能是空串（待分配，
	// 未选工作空间的新任务首次执行时才分配目录）—— 没有目录可服务，跳过；那种 cwd 的
	// 预览由 createHost 在分配后按真 cwd 懒建。
	// 失败不阻断启动 —— 预览是增强能力，聊天主链路不该被它拖死；记日志留现场。
	if (defaultWorkspaceDir !== "") {
		void previewServers.ensure(defaultWorkspaceDir).catch((error: unknown) => {
			const message = error instanceof Error ? error.message : String(error);
			console.error(`预览服务启动失败：${message}`);
			eventLog.append({ kind: "ipc_error", channel: "preview:ensure", message });
		});
	}

	/*
	 * docx 引擎运行时**不做启动预热**（2026-09-18 变更，原 SessionStart 式预热已删）。
	 *
	 * 为什么删：三个运行时改成**纯按需**（用户到「设置 → 内置运行时」点「安装」才联网），
	 * 而预热挂在 daemon 启动这种用户没点任何东西的时刻 —— 它一跑就等于静默自动下载
	 * 几十到几百 MB。用户的取舍是「安装包不能臃肿」，但同样明确过「不做任何静默自动
	 * 下载/安装」；两条一起守的办法就是**启动时什么都不装**。
	 *
	 * 代价（如实记下）：首次用 docx 生成/提取前，用户要先在设置页装一次 Python 运行时。
	 * 环境未就绪时工具层会拿到 not-installed 并把「请用户去安装」如实交给模型/用户
	 * （core/runtimes/registry.ts 的 notInstalledMessage），不静默降级。
	 */

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

	/*
	 * 预装服务商（公司中转）：让同事机器一装上就能选到它，不必手填标识 / 地址 /
	 * 协议 / 认证头（见 core/builtin-providers.ts 的规则 1~3：只补不存在的、
	 * 不含凭据、模型留空）。**放在 ready 之前** —— 它决定「设置 → 模型」第一眼
	 * 看到什么，放到 ready 之后的杂活里会让首次打开设置偶发看不到它。
	 *
	 * 与上面 automationStore.load() 的响亮抛错**有意不同**：automations.json
	 * 只由我们写、坏了是我们的事；models.json 是 pi 文档教用户手编的文件，
	 * 一份手编坏的它不该让整个 daemon 起不来（界面会永久卡在「正在启动」，
	 * 而设置页本来就会把解析错误显示出来 —— snapshot.error）。所以这里
	 * 捕获、记事件日志、继续启动：**不静默，但不致命**。
	 */
	try {
		ensureBuiltinProviders(getModelsPath());
	} catch (error) {
		eventLog.append({
			kind: "builtin_provider_error",
			message: error instanceof Error ? error.message : String(error),
		});
	}

	post({ kind: "ready" });

	/*
	 * ready 之后的启动期杂活：都不属于「用户能开始用」的前置条件，一律
	 * fire-and-forget —— ready 只等启动必需的那几项 ms 级同步读。
	 */
	void prepareAgentTools();
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
