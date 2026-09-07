/**
 * preload：把 IPC 收敛成一个白名单桥。
 *
 * contextIsolation 开着，所以 renderer 拿不到 ipcRenderer 本体，
 * 只能调这里显式列出的方法 —— 通道名不会泄到 renderer，
 * renderer 里也就不可能出现字符串字面量（AGENTS.md §4）。
 */

import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { KamiBridge, Unsubscribe } from "../shared/bridge.ts";
import { INVOKE, PUSH } from "../shared/ipc.ts";

/** 订阅一个推送通道，剥掉 IpcRendererEvent —— renderer 不需要它。 */
function subscribe<T>(channel: string, listener: (payload: T) => void): Unsubscribe {
	const wrapped = (_event: IpcRendererEvent, payload: T): void => listener(payload);
	ipcRenderer.on(channel, wrapped);
	return () => ipcRenderer.off(channel, wrapped);
}

const bridge: KamiBridge = {
	daemonStatus: () => ipcRenderer.invoke(INVOKE.daemonStatus),
	snapshot: () => ipcRenderer.invoke(INVOKE.snapshot),
	prompt: (request) => ipcRenderer.invoke(INVOKE.prompt, request),
	abort: () => ipcRenderer.invoke(INVOKE.abort),
	setScene: (sceneId) => ipcRenderer.invoke(INVOKE.setScene, sceneId),
	setInteraction: (interactionId) => ipcRenderer.invoke(INVOKE.setInteraction, interactionId),
	setModel: (modelId) => ipcRenderer.invoke(INVOKE.setModel, modelId),

	workspaceSnapshot: () => ipcRenderer.invoke(INVOKE.workspaceSnapshot),
	createWorkspace: (name) => ipcRenderer.invoke(INVOKE.createWorkspace, name),
	setWorkspace: (path) => ipcRenderer.invoke(INVOKE.setWorkspace, path),
	pickWorkspaceDirectory: () => ipcRenderer.invoke(INVOKE.pickWorkspaceDirectory),

	respondToUi: (response) => ipcRenderer.invoke(INVOKE.uiResponse, response),
	respondToPermission: (response) => ipcRenderer.invoke(INVOKE.permissionResponse, response),

	openArtifact: (path) => ipcRenderer.invoke(INVOKE.openArtifact, path),
	saveArtifactAs: (request) => ipcRenderer.invoke(INVOKE.saveArtifactAs, request),

	settingsSnapshot: () => ipcRenderer.invoke(INVOKE.settingsSnapshot),
	setApiKey: (providerId, apiKey) => ipcRenderer.invoke(INVOKE.setApiKey, providerId, apiKey),
	removeApiKey: (providerId) => ipcRenderer.invoke(INVOKE.removeApiKey, providerId),
	saveCustomProvider: (input, apiKey) => ipcRenderer.invoke(INVOKE.saveCustomProvider, input, apiKey),
	deleteCustomProvider: (providerId) => ipcRenderer.invoke(INVOKE.deleteCustomProvider, providerId),
	readCustomProvider: (providerId) => ipcRenderer.invoke(INVOKE.readCustomProvider, providerId),
	refreshCatalog: () => ipcRenderer.invoke(INVOKE.refreshCatalog),

	onSessionEvent: (listener) => subscribe(PUSH.sessionEvent, listener),
	onUiRequest: (listener) => subscribe(PUSH.uiRequest, listener),
	onPermissionRequest: (listener) => subscribe(PUSH.permissionRequest, listener),
	onDaemonReady: (listener) => subscribe(PUSH.daemonReady, () => listener()),
	onDaemonDown: (listener) => subscribe(PUSH.daemonDown, listener),
};

contextBridge.exposeInMainWorld("kami", bridge);
