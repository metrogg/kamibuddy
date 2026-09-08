/**
 * preload 暴露给 renderer 的桥接口。
 *
 * renderer 只认识这个接口和 shared/ 里的类型（AGENTS.md §1.3），
 * 不知道 ipcRenderer、不知道通道名、更不知道 pi。
 */

import type {
	DaemonStatus,
	ArtifactContent,
	CompletionData,
	PermissionRequest,
	PermissionResponse,
	PromptRequest,
	SaveArtifactRequest,
	UiRequest,
	UiResponse,
	WorkspaceSnapshot,
} from "./ipc.ts";
import type { ObservabilitySnapshot } from "./observability.ts";
import type { PermissionInfo, PermissionSettings } from "./permissions.ts";
import type { SessionEvent, SessionSnapshot } from "./session-events.ts";
import type {
	CustomProviderInput,
	SettingsSnapshot,
	SkillsSnapshot,
	SkillInfo,
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
	readonly snapshot: () => Promise<SessionSnapshot>;
	readonly prompt: (request: PromptRequest) => Promise<void>;
	readonly abort: () => Promise<void>;
	/** 新建任务：作废旧会话、开一个全新会话（在当前工作空间语义下）。 */
	readonly newTask: () => Promise<void>;
	/** 输入框补全数据源（@ 文件 + / 命令）。 */
	readonly completions: () => Promise<CompletionData>;
	/** 切换场景（work / code / design）。 */
	readonly setScene: (sceneId: string) => Promise<void>;
	/** 切换交互模式（ask / craft / plan / expert）。 */
	readonly setInteraction: (interactionId: string) => Promise<void>;
	readonly setModel: (modelId: string) => Promise<void>;

	/** 拉取当前工作空间与可选列表。 */
	readonly workspaceSnapshot: () => Promise<WorkspaceSnapshot>;
	/** 在默认根下新建工作空间并切换。名称非法或重名时 reject 原因。 */
	readonly createWorkspace: (name: string) => Promise<string>;
	/** 切换到指定目录。危险目录（配置/应用目录）会 reject 原因。传空串 = 不使用工作空间（playground）。 */
	readonly setWorkspace: (path: string) => Promise<string | undefined>;
	/** 系统目录选择框。取消返回 undefined。 */
	readonly pickWorkspaceDirectory: () => Promise<string | undefined>;

	readonly respondToUi: (response: UiResponse) => Promise<void>;
	readonly respondToPermission: (response: PermissionResponse) => Promise<void>;

	readonly openArtifact: (path: string) => Promise<void>;
	/** 读产物文件内容（预览面板用）。 */
	readonly readArtifact: (path: string) => Promise<ArtifactContent>;
	readonly saveArtifactAs: (
		request: SaveArtifactRequest,
	) => Promise<string | undefined>;

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
	readonly refreshCatalog: () => Promise<void>;

	/* ── 联网搜索 ─────────────────────────────────────────────────── */

	/** 读回配置（不含 key 本身，界面上只显示「已保存」）。 */
	readonly getWebSearchConfig: () => Promise<WebSearchConfigInfo>;
	readonly setWebSearchConfig: (input: WebSearchConfigInput) => Promise<void>;
	readonly clearWebSearchConfig: () => Promise<void>;
	readonly testWebSearch: () => Promise<WebSearchTestResult>;

	/* ── 权限 ─────────────────────────────────────────────────────── */

	readonly getPermissions: () => Promise<PermissionInfo>;
	/** 保存后返回规范化的结果（presetId 由 daemon 按旋钮反算）。 */
	readonly setPermissions: (settings: PermissionSettings) => Promise<PermissionInfo>;

	/* ── 技能 ─────────────────────────────────────────────────────── */

	readonly skillsSnapshot: () => Promise<SkillsSnapshot>;
	readonly importSkill: (sourcePath: string) => Promise<SkillInfo>;
	readonly pickSkillDirectory: () => Promise<string | undefined>;

	/* ── 诊断 ─────────────────────────────────────────────────────── */

	/** 可观测性快照（用量、缓存命中率、run 记录、工具统计、上下文成分）。 */
	readonly statsSnapshot: () => Promise<ObservabilitySnapshot>;

	readonly onSessionEvent: (
		listener: (event: SessionEvent) => void,
	) => Unsubscribe;
	readonly onUiRequest: (listener: (request: UiRequest) => void) => Unsubscribe;
	readonly onPermissionRequest: (
		listener: (request: PermissionRequest) => void,
	) => Unsubscribe;
	readonly onDaemonReady: (listener: () => void) => Unsubscribe;
	readonly onDaemonDown: (
		listener: (info: { readonly reason: string }) => void,
	) => Unsubscribe;
}

declare global {
	interface Window {
		readonly kami: KamiBridge;
	}
}
