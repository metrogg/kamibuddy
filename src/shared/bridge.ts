/**
 * preload 暴露给 renderer 的桥接口。
 *
 * renderer 只认识这个接口和 shared/ 里的类型（AGENTS.md §1.3），
 * 不知道 ipcRenderer、不知道通道名、更不知道 pi。
 */

import type {
	DaemonStatus,
	PermissionRequest,
	PermissionResponse,
	PromptRequest,
	SaveArtifactRequest,
	UiRequest,
	UiResponse,
} from "./ipc.ts";
import type { SessionEvent, SessionSnapshot } from "./session-events.ts";

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
	readonly setMode: (modeId: string) => Promise<void>;
	readonly setModel: (modelId: string) => Promise<void>;

	readonly respondToUi: (response: UiResponse) => Promise<void>;
	readonly respondToPermission: (response: PermissionResponse) => Promise<void>;

	readonly openArtifact: (path: string) => Promise<void>;
	readonly saveArtifactAs: (request: SaveArtifactRequest) => Promise<string | undefined>;

	readonly onSessionEvent: (listener: (event: SessionEvent) => void) => Unsubscribe;
	readonly onUiRequest: (listener: (request: UiRequest) => void) => Unsubscribe;
	readonly onPermissionRequest: (listener: (request: PermissionRequest) => void) => Unsubscribe;
	readonly onDaemonReady: (listener: () => void) => Unsubscribe;
	readonly onDaemonDown: (listener: (info: { readonly reason: string }) => void) => Unsubscribe;
}

declare global {
	interface Window {
		readonly kami: KamiBridge;
	}
}
