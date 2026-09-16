/**
 * preload 暴露给 renderer 的桥接口。
 *
 * renderer 只认识这个接口和 shared/ 里的类型（AGENTS.md §1.3），
 * 不知道 ipcRenderer、不知道通道名、更不知道 pi。
 */

import type { AutomationTask } from "./automation.ts";
import type {
	AutomationEvent,
	AutomationSaveInput,
	DaemonStatus,
	DocxEnvStatus,
	GlobalShortcutStatus,
	ArtifactContent,
	CompletionData,
	ExpertListItem,
	McpConfigSnapshot,
	PermissionRequest,
	PermissionResponse,
	PathStat,
	PersonalizationInfo,
	PersonalizationPatch,
	PickedInputFiles,
	PromptPreviewRequest,
	PromptPreviewResult,
	PromptRequest,
	QuestionnaireRequest,
	QuestionnaireResponse,
	RunLedgerResult,
	SaveArtifactRequest,
	SessionSummary,
	UiRequest,
	UiResponse,
	WorkspaceGroupMeta,
	WorkspaceSnapshot,
} from "./ipc.ts";
import type { ObservabilitySnapshot } from "./observability.ts";
import type { UsageStats } from "./usage-stats.ts";
import type { PermissionInfo, PermissionSettings } from "./permissions.ts";
import type { SessionEventEnvelope, SessionSnapshot, ThinkingLevel, QueuedMessages } from "./session-events.ts";
import type { WorktreeBranchList } from "./worktree.ts";
import type {
	CustomModelInput,
	CustomProviderInput,
	ModelProbeResult,
	SettingsSnapshot,
	SkillsSnapshot,
	SkillInfo,
	StyleConfigInfo,
	WebSearchConfigInfo,
	WebSearchConfigInput,
	WebSearchTestResult,
} from "./settings.ts";

/** 订阅函数统一返回取消订阅的闭包，配合 React useEffect 的清理约定。 */
export type Unsubscribe = () => void;

export interface KamiBridge {
	/**
	 * 主动查询 daemon 状态。渲染进程挂载后必须调一次——
	 * 只依赖 onDaemonReady 推送会漏掉「推送早于监听器注册」的情况。
	 */
	readonly daemonStatus: () => Promise<DaemonStatus>;
	/** 拉取完整会话状态。sessionId 缺省 = 当前活动会话；指定 id 拉对应会话（后台会话视图恢复用）。 */
	readonly snapshot: (sessionId?: string) => Promise<SessionSnapshot>;
	readonly prompt: (request: PromptRequest) => Promise<void>;
	readonly abort: () => Promise<void>;
	/**
	 * 重排 steer / followUp 等待队列（排队 chips 的删除/编辑底层动作）。
	 * 传入的是**重排后**的完整队列：daemon 清空后按序重入队。
	 * 仅在 run 进行中有意义；run 已结束时清空即完成、重入队挂到下一轮（不丢）。
	 */
	readonly rewriteQueue: (queued: QueuedMessages) => Promise<void>;
	/**
	 * 新建任务：作废旧会话、开一个全新会话。
	 * cwd 缺省 = 未选工作空间（待分配，首次执行才分配自动目录）——「新建任务」重置选择；
	 * 显式传 cwd 用于空间组「+」（就在该空间里开新活）。语义见 ipc.ts 的 INVOKE.newTask。
	 */
	readonly newTask: (cwd?: string) => Promise<void>;
	/** 输入框补全数据源（@ 文件 + / 命令）。 */
	readonly completions: () => Promise<CompletionData>;
	/**
	 * 系统文件选择框（图片 + 文档多选）。图片由 main 读出内容返回；
	 * 文档只回路径不读内容（模型经 read_document 自取）。取消返回 undefined。
	 */
	readonly pickInputFiles: () => Promise<PickedInputFiles | undefined>;
	/**
	 * 取 File 的磁盘绝对路径。必须在 preload 实现：Electron ≥32 起 renderer 的
	 * File 不再带 .path，webUtils.getPathForFile 只能在 preload 侧调用
	 * （File 经 contextBridge 传入）。无磁盘来源的 File（内存位图）返回空串。
	 */
	readonly getFilePath: (file: File) => string;
	/** 切换场景（work / code / design）。 */
	readonly setScene: (sceneId: string) => Promise<void>;
	/** 切换交互模式（ask / craft / plan）。 */
	readonly setInteraction: (interactionId: string) => Promise<void>;
	/**
	 * 选择专家（绑定人格）；传 undefined 清除专家。专家与交互模式正交 ——
	 * 不改交互模式。专家不存在时 daemon reject 原因。
	 */
	readonly setExpert: (expertId: string | undefined) => Promise<void>;
	/** 专家列表（「专家 ▸」子菜单与对话头部显示的数据源）。 */
	readonly listExperts: () => Promise<readonly ExpertListItem[]>;
	readonly setModel: (modelId: string) => Promise<void>;
	/**
	 * 切换当前会话的推理强度。pi 恒 clamp 不抛错；
	 * 生效档位与可用档位随下一条 session_state 下发（renderer 不本地乐观改）。
	 */
	readonly setThinkingLevel: (level: ThinkingLevel) => Promise<void>;

	/* ── 会话管理（历史会话） ────────────────────────────────────── */

	/** 历史会话列表（全部目录，含临时任务；current 标记活动会话）。 */
	readonly listSessions: () => Promise<SessionSummary[]>;
	/** 恢复指定历史会话为当前活动会话。path 来自 SessionSummary.path。 */
	readonly resumeSession: (path: string) => Promise<void>;
	/** 重命名会话（写入 pi 的 session_info 条目）。 */
	readonly renameSession: (path: string, name: string) => Promise<void>;
	/** 删除会话文件。当前活动会话会被 daemon 拒删（reject 原因）。 */
	readonly deleteSession: (path: string) => Promise<void>;
	/** 导出会话为单文件 HTML。空会话会 reject 原因；成功返回导出文件绝对路径。 */
	readonly exportSession: (path: string) => Promise<{ outputPath: string }>;
	/** 把当前临时任务「保存到工作空间」转正。名称非法/重名、或当前会话非临时任务时 reject 原因。 */
	readonly saveToWorkspace: (name: string) => Promise<void>;

	/** 拉取当前工作空间与可选列表。 */
	readonly workspaceSnapshot: () => Promise<WorkspaceSnapshot>;
	/** 在默认根下新建工作空间并切换。名称非法或重名时 reject 原因。 */
	readonly createWorkspace: (name: string) => Promise<string>;
	/** 切换到指定目录。危险目录（配置/应用目录）会 reject 原因。传空串 = 临时任务待分配（不建目录，首次执行才分配独立时间戳目录）。 */
	readonly setWorkspace: (path: string) => Promise<string | undefined>;
	/** 系统目录选择框。取消返回 undefined。 */
	readonly pickWorkspaceDirectory: () => Promise<string | undefined>;
	/** 空间分组元数据（侧栏「空间」区组头；组集合由会话 cwd 派生）。 */
	readonly listWorkspaceGroups: () => Promise<WorkspaceGroupMeta[]>;
	/** 重命名空间组（只写显示名覆盖，不动真实目录）。名称非法时 reject 原因。 */
	readonly renameWorkspace: (cwd: string, name: string) => Promise<void>;
	/** 从列表移除空间组（会话文件移入回收目录，不删真实目录）。 */
	readonly removeWorkspace: (cwd: string) => Promise<void>;
	/** 在系统文件管理器中打开空间目录。cwd 经 daemon 校验为已知工作空间，否则 reject。 */
	readonly revealWorkspace: (cwd: string) => Promise<void>;

	/* ── worktree 任务隔离（对齐清单 C22 / L27） ─────────────────── */

	/**
	 * 列某个目录的本地分支。非 git 仓库时回 isGitRepo=false 而不是 reject ——
	 * 用户选个普通文件夹是正常情形，芯片据此隐藏即可，不该弹错。
	 */
	readonly worktreeBranches: (cwd: string) => Promise<WorktreeBranchList>;
	/**
	 * 设置「下一次新建任务在哪个基准分支上建 worktree 副本」；传 undefined 关闭。
	 * 只影响之后新建的任务，既有会话的副本不动（同 setWorkspace 的语义）。
	 */
	readonly setWorktreeBranch: (branch: string | undefined) => Promise<void>;

	readonly respondToUi: (response: UiResponse) => Promise<void>;
	readonly respondToPermission: (response: PermissionResponse) => Promise<void>;
	/** 应答 questionnaire 工具的问卷卡（作答或整卡跳过）。 */
	readonly questionnaireResponse: (response: QuestionnaireResponse) => Promise<void>;

	readonly openArtifact: (path: string) => Promise<void>;
	/** 读产物文件内容（预览面板用）。 */
	readonly readArtifact: (path: string) => Promise<ArtifactContent>;
	/** 路径存在性探测（对话正文路径徽章的高亮依据；相对路径按当前会话 cwd resolve）。 */
	readonly statPath: (path: string) => Promise<PathStat>;
	readonly saveArtifactAs: (
		request: SaveArtifactRequest,
	) => Promise<string | undefined>;
	/**
	 * 查询指定 cwd 的预览服务 base URL（PreviewServer 按 cwd 多实例）。
	 * 该 cwd 的服务未启动时返回 undefined（面板显示引导文案，不是错误）。
	 */
	readonly previewBaseUrl: (cwd: string) => Promise<string | undefined>;

	/* ── 设置 ─────────────────────────────────────────────────────── */

	readonly settingsSnapshot: () => Promise<SettingsSnapshot>;
	readonly setApiKey: (providerId: string, apiKey: string) => Promise<void>;
	readonly removeApiKey: (providerId: string) => Promise<void>;
	/** apiKey 省略表示复用已存的凭据（编辑时只改 baseUrl，不必重输密钥）。 */
	readonly saveCustomProvider: (
		input: CustomProviderInput,
		apiKey?: string,
	) => Promise<void>;
	readonly deleteCustomProvider: (providerId: string) => Promise<void>;
	readonly readCustomProvider: (
		providerId: string,
	) => Promise<CustomProviderInput | undefined>;
	/** 往预置服务商追加/替换单个模型（「添加模型」弹层选预置的路径）。 */
	readonly addProviderModel: (providerId: string, model: CustomModelInput) => Promise<void>;
	readonly refreshCatalog: () => Promise<void>;
	/** 测试某个模型（`provider/model`）的连通性，结果直接展示在卡片上。 */
	readonly testModel: (modelKey: string) => Promise<ModelProbeResult>;

	/* ── 联网搜索 ─────────────────────────────────────────────────── */

	/** 读回配置（不含 key 本身，界面上只显示「已保存」）。 */
	readonly getWebSearchConfig: () => Promise<WebSearchConfigInfo>;
	readonly setWebSearchConfig: (input: WebSearchConfigInput) => Promise<void>;
	readonly clearWebSearchConfig: () => Promise<void>;
	readonly testWebSearch: () => Promise<WebSearchTestResult>;

	/* ── 默认存储路径 ─────────────────────────────────────────────── */

	/** 读默认存储路径（生效根 / 用户设置项 / 是否内置默认）。 */
	readonly getDefaultWorkspacePath: () => Promise<{
		effective: string;
		custom: string | undefined;
		isDefault: boolean;
	}>;
	/** 设置默认存储路径；传空串 = 还原内置默认。只影响之后新建的任务与工作空间。 */
	readonly setDefaultWorkspacePath: (path: string) => Promise<{ effective: string }>;

	/* ── 推理强度（全局默认） ────────────────────────────────────── */

	/** 读全局默认推理强度（未配置时 daemon 回 medium，与 pi 内置默认一致）。 */
	readonly getThinkingLevelDefault: () => Promise<{ level: ThinkingLevel }>;
	/** 写全局默认推理强度。只影响之后新建的会话，既有会话不回溯。 */
	readonly setThinkingLevelDefault: (level: ThinkingLevel) => Promise<void>;

	/* ── 回复风格 ─────────────────────────────────────────────────── */

	/** 读回复风格配置（可选项 + 当前值；未配置时 daemon 回默认风格 professional）。 */
	readonly getStyle: () => Promise<StyleConfigInfo>;
	/** 写回复风格；传空串 = 关闭风格注入。只影响之后的新 run。 */
	readonly setStyle: (styleId: string) => Promise<void>;

	/* ── 记忆（spec: add-memory-system） ─────────────────────────── */

	/** 读记忆系统开关（未配置时 daemon 回 true —— 缺省开启）。 */
	readonly getMemoryEnabled: () => Promise<{ enabled: boolean }>;
	/** 写记忆系统开关；daemon 同步内置「记忆整理」任务的启停。 */
	readonly setMemoryEnabled: (enabled: boolean) => Promise<void>;
	/** 读用户画像全文（PROFILE.md；文件不存在回空串）。 */
	readonly getProfile: () => Promise<{ content: string }>;
	/** 覆盖写用户画像全文；下一轮对话生效。 */
	readonly setProfile: (content: string) => Promise<void>;
	/** 清空用户画像（内置任务下一轮蒸馏会重新生成）。 */
	readonly resetProfile: () => Promise<void>;
	/**
	 * 弹出系统文件框选 .md 并读出内容（main 本地应答；不写 PROFILE.md，
	 * 写入走 setProfile）。取消返回 undefined。
	 */
	readonly importProfile: () => Promise<{ content: string } | undefined>;

	/* ── 个性化（spec: rework-settings-layout） ──────────────────── */

	/** 读个性化六键（daemon 合并缺省后下发）。 */
	readonly getPersonalization: () => Promise<PersonalizationInfo>;
	/** 部分更新个性化（只动传入的键；字符串 trim 空 = 删键）。 */
	readonly setPersonalization: (patch: PersonalizationPatch) => Promise<void>;
	/** 读长期记忆全文（MEMORY.md；不存在回空串）。 */
	readonly getMemory: () => Promise<{ content: string }>;
	/** 覆盖写长期记忆全文；下一轮对话生效。 */
	readonly setMemory: (content: string) => Promise<void>;

	/* ── 提示词预览 ─────────────────────────────────────────────── */

	/**
	 * 按 {场景, 模式, 风格} 现场组装系统提示词（设置页预览用，不需要活会话）。
	 * styleId 传空串 = 关闭风格；省略 = 跟随当前偏好。id 非法时 reject 原因。
	 */
	readonly promptPreview: (request: PromptPreviewRequest) => Promise<PromptPreviewResult>;

	/* ── 权限 ─────────────────────────────────────────────────────── */

	readonly getPermissions: () => Promise<PermissionInfo>;
	/** 保存后返回规范化的结果（presetId 由 daemon 按旋钮反算）。 */
	readonly setPermissions: (settings: PermissionSettings) => Promise<PermissionInfo>;

	/* ── 技能 ─────────────────────────────────────────────────────── */

	readonly skillsSnapshot: () => Promise<SkillsSnapshot>;
	readonly importSkill: (sourcePath: string) => Promise<SkillInfo>;
	readonly pickSkillDirectory: () => Promise<string | undefined>;

	/* ── MCP 连接器 ─────────────────────────────────────────────── */

	/** MCP 配置快照：server 运行态列表 + 生效层级 mcp.json 原文。连接器页打开时调用。 */
	readonly mcpConfigGet: () => Promise<McpConfigSnapshot>;
	/** 整体写入 mcp.json（JSON 编辑器 / 添加表单的保存）。非法配置 reject 原因、不落盘。 */
	readonly mcpConfigSet: (configJson: string) => Promise<void>;
	/** 启用 / 禁用单个 server（写回其所在层级 mcp.json 的 disabled 字段）。 */
	readonly mcpServerToggle: (serverName: string, enabled: boolean) => Promise<void>;

	/* ── 诊断 ─────────────────────────────────────────────────────── */

	/** 可观测性快照（用量、缓存命中率、run 记录、工具统计、上下文成分）。 */
	readonly statsSnapshot: () => Promise<ObservabilitySnapshot>;
	/**
	 * 跨会话使用统计（统计页的数据源）：全历史会话数/消息数/用量/连续活跃天数/
	 * 每日活动与 token/模型与工具排行。读会话文件全历史，与 statsSnapshot 的
	 * 运行侧聚合口径不同（见 shared/ipc.ts 的通道注释）。
	 */
	readonly usageStats: () => Promise<UsageStats>;
	/**
	 * 拉取运行台账条目（诊断页会话时间线的数据源）。
	 * sessionId 缺省 = 当前活动会话（无活动会话退最新台账）；返回带全部台账会话列表。
	 */
	readonly runLedger: (sessionId?: string) => Promise<RunLedgerResult>;
	/**
	 * 全局唤起热键的注册状态（main 本地应答；failed = 大概率被别的程序占用）。
	 * 状态静态（启动时注册一次），诊断页打开时查一次即可。
	 */
	readonly globalShortcutStatus: () => Promise<GlobalShortcutStatus | undefined>;
	/**
	 * docx 引擎 venv 的四态（诊断页状态行）。只探测不安装；
	 * 预热/首次转换可能改变它，跟随诊断页「刷新」重查。
	 */
	readonly docxEnvStatus: () => Promise<DocxEnvStatus>;

	/* ── 定时任务 ─────────────────────────────────────────────────── */

	/** 全部定时任务（管理页列表）。 */
	readonly listAutomations: () => Promise<AutomationTask[]>;
	/** 新建或编辑（input 带 id 即编辑）。名称/调度非法时 reject 原因。 */
	readonly saveAutomation: (input: AutomationSaveInput) => Promise<AutomationTask>;
	/** 删除任务。正在运行的任务会被 daemon 拒删（reject 原因）。 */
	readonly deleteAutomation: (id: string) => Promise<void>;
	/** 启停切换（active ↔ paused；missed 重新启用也走这里）。 */
	readonly toggleAutomation: (id: string) => Promise<AutomationTask>;
	/** 立即运行一次（进同一串行队列，不影响既有周期）。 */
	readonly runAutomationNow: (id: string) => Promise<void>;

	readonly onSessionEvent: (
		listener: (envelope: SessionEventEnvelope) => void,
	) => Unsubscribe;
	/** 任务列表变更（run 开始/结束等），携带 daemon 组装好的完整最新列表。 */
	readonly onTaskListChanged: (
		listener: (sessions: readonly SessionSummary[]) => void,
	) => Unsubscribe;
	readonly onUiRequest: (listener: (request: UiRequest) => void) => Unsubscribe;
	readonly onPermissionRequest: (
		listener: (request: PermissionRequest) => void,
	) => Unsubscribe;
	/** questionnaire 工具发起的结构化提问（问卷卡逐题作答或整卡跳过）。 */
	readonly onQuestionnaireRequest: (
		listener: (request: QuestionnaireRequest) => void,
	) => Unsubscribe;
	readonly onDaemonReady: (listener: () => void) => Unsubscribe;
	readonly onDaemonDown: (
		listener: (info: { readonly reason: string }) => void,
	) => Unsubscribe;
	/** 定时任务事件（数据变更 / 一次运行结束）。 */
	readonly onAutomationEvent: (
		listener: (event: AutomationEvent) => void,
	) => Unsubscribe;
}

declare global {
	interface Window {
		readonly kami: KamiBridge;
	}
}
