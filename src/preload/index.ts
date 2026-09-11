/**
 * preload：把 IPC 收敛成一个白名单桥。
 *
 * contextIsolation 开着，所以 renderer 拿不到 ipcRenderer 本体，
 * 只能调这里显式列出的方法 —— 通道名不会泄到 renderer，
 * renderer 里也就不可能出现字符串字面量（AGENTS.md §4）。
 */

import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from "electron";
import type { KamiBridge, Unsubscribe } from "../shared/bridge.ts";
import { INVOKE, PUSH } from "../shared/ipc.ts";

/** 订阅一个推送通道，剥掉 IpcRendererEvent —— renderer 不需要它。 */
function subscribe<T>(
	channel: string,
	listener: (payload: T) => void,
): Unsubscribe {
	const wrapped = (_event: IpcRendererEvent, payload: T): void =>
		listener(payload);
	ipcRenderer.on(channel, wrapped);
	return () => ipcRenderer.off(channel, wrapped);
}

const bridge: KamiBridge = {
	daemonStatus: () => ipcRenderer.invoke(INVOKE.daemonStatus),
	snapshot: (sessionId) => ipcRenderer.invoke(INVOKE.snapshot, sessionId),
	prompt: (request) => ipcRenderer.invoke(INVOKE.prompt, request),
	abort: () => ipcRenderer.invoke(INVOKE.abort),
	newTask: () => ipcRenderer.invoke(INVOKE.newTask),
	completions: () => ipcRenderer.invoke(INVOKE.completions),
	pickInputFiles: () => ipcRenderer.invoke(INVOKE.pickInputFiles),
	// File 的路径只能在 preload 取（webUtils 不进 renderer），同步返回。
	getFilePath: (file) => webUtils.getPathForFile(file),
	setScene: (sceneId) => ipcRenderer.invoke(INVOKE.setScene, sceneId),
	setInteraction: (interactionId) =>
		ipcRenderer.invoke(INVOKE.setInteraction, interactionId),
	setExpert: (expertId) => ipcRenderer.invoke(INVOKE.setExpert, expertId),
	listExperts: () => ipcRenderer.invoke(INVOKE.listExperts),
	setModel: (modelId) => ipcRenderer.invoke(INVOKE.setModel, modelId),
	setThinkingLevel: (level) =>
		ipcRenderer.invoke(INVOKE.setThinkingLevel, level),

	listSessions: () => ipcRenderer.invoke(INVOKE.sessionList),
	resumeSession: (path) => ipcRenderer.invoke(INVOKE.sessionResume, path),
	renameSession: (path, name) =>
		ipcRenderer.invoke(INVOKE.sessionRename, path, name),
	deleteSession: (path) => ipcRenderer.invoke(INVOKE.sessionDelete, path),
	exportSession: (path) => ipcRenderer.invoke(INVOKE.sessionExport, path),
	saveToWorkspace: (name) => ipcRenderer.invoke(INVOKE.saveToWorkspace, name),

	workspaceSnapshot: () => ipcRenderer.invoke(INVOKE.workspaceSnapshot),
	createWorkspace: (name) => ipcRenderer.invoke(INVOKE.createWorkspace, name),
	setWorkspace: (path) => ipcRenderer.invoke(INVOKE.setWorkspace, path),
	pickWorkspaceDirectory: () =>
		ipcRenderer.invoke(INVOKE.pickWorkspaceDirectory),
	listWorkspaceGroups: () => ipcRenderer.invoke(INVOKE.workspaceGroups),
	renameWorkspace: (cwd, name) =>
		ipcRenderer.invoke(INVOKE.workspaceRename, cwd, name),
	removeWorkspace: (cwd) => ipcRenderer.invoke(INVOKE.workspaceRemove, cwd),
	revealWorkspace: (cwd) => ipcRenderer.invoke(INVOKE.workspaceReveal, cwd),

	respondToUi: (response) => ipcRenderer.invoke(INVOKE.uiResponse, response),
	respondToPermission: (response) =>
		ipcRenderer.invoke(INVOKE.permissionResponse, response),
	questionnaireResponse: (response) =>
		ipcRenderer.invoke(INVOKE.questionnaireResponse, response),

	openArtifact: (path) => ipcRenderer.invoke(INVOKE.openArtifact, path),
	readArtifact: (path) => ipcRenderer.invoke(INVOKE.readArtifact, path),
	statPath: (path) => ipcRenderer.invoke(INVOKE.statPath, path),
	saveArtifactAs: (request) =>
		ipcRenderer.invoke(INVOKE.saveArtifactAs, request),
	previewBaseUrl: (cwd) => ipcRenderer.invoke(INVOKE.previewBaseUrl, cwd),

	settingsSnapshot: () => ipcRenderer.invoke(INVOKE.settingsSnapshot),
	setApiKey: (providerId, apiKey) =>
		ipcRenderer.invoke(INVOKE.setApiKey, providerId, apiKey),
	removeApiKey: (providerId) =>
		ipcRenderer.invoke(INVOKE.removeApiKey, providerId),
	saveCustomProvider: (input, apiKey) =>
		ipcRenderer.invoke(INVOKE.saveCustomProvider, input, apiKey),
	deleteCustomProvider: (providerId) =>
		ipcRenderer.invoke(INVOKE.deleteCustomProvider, providerId),
	readCustomProvider: (providerId) =>
		ipcRenderer.invoke(INVOKE.readCustomProvider, providerId),
	refreshCatalog: () => ipcRenderer.invoke(INVOKE.refreshCatalog),

	getWebSearchConfig: () => ipcRenderer.invoke(INVOKE.getWebSearchConfig),
	setWebSearchConfig: (input) =>
		ipcRenderer.invoke(INVOKE.setWebSearchConfig, input),
	clearWebSearchConfig: () => ipcRenderer.invoke(INVOKE.clearWebSearchConfig),
	testWebSearch: () => ipcRenderer.invoke(INVOKE.testWebSearch),

	getDefaultWorkspacePath: () =>
		ipcRenderer.invoke(INVOKE.getDefaultWorkspacePath),
	setDefaultWorkspacePath: (path) =>
		ipcRenderer.invoke(INVOKE.setDefaultWorkspacePath, path),

	getThinkingLevelDefault: () =>
		ipcRenderer.invoke(INVOKE.getThinkingLevelDefault),
	setThinkingLevelDefault: (level) =>
		ipcRenderer.invoke(INVOKE.setThinkingLevelDefault, level),

	getPermissions: () => ipcRenderer.invoke(INVOKE.getPermissions),
	setPermissions: (settings) => ipcRenderer.invoke(INVOKE.setPermissions, settings),

	skillsSnapshot: () => ipcRenderer.invoke(INVOKE.skillsSnapshot),
	importSkill: (sourcePath) => ipcRenderer.invoke(INVOKE.importSkill, sourcePath),
	pickSkillDirectory: () => ipcRenderer.invoke(INVOKE.pickSkillDirectory),

	mcpConfigGet: () => ipcRenderer.invoke(INVOKE.mcpConfigGet),
	mcpConfigSet: (configJson) => ipcRenderer.invoke(INVOKE.mcpConfigSet, configJson),
	mcpServerToggle: (serverName, enabled) =>
		ipcRenderer.invoke(INVOKE.mcpServerToggle, serverName, enabled),

	statsSnapshot: () => ipcRenderer.invoke(INVOKE.statsSnapshot),
	globalShortcutStatus: () => ipcRenderer.invoke(INVOKE.globalShortcutStatus),
	docxEnvStatus: () => ipcRenderer.invoke(INVOKE.docxEnvStatus),

	listAutomations: () => ipcRenderer.invoke(INVOKE.automationList),
	saveAutomation: (input) => ipcRenderer.invoke(INVOKE.automationSave, input),
	deleteAutomation: (id) => ipcRenderer.invoke(INVOKE.automationDelete, id),
	toggleAutomation: (id) => ipcRenderer.invoke(INVOKE.automationToggle, id),
	runAutomationNow: (id) => ipcRenderer.invoke(INVOKE.automationRunNow, id),

	onSessionEvent: (listener) => subscribe(PUSH.sessionEvent, listener),
	onTaskListChanged: (listener) => subscribe(PUSH.taskListChanged, listener),
	onUiRequest: (listener) => subscribe(PUSH.uiRequest, listener),
	onPermissionRequest: (listener) =>
		subscribe(PUSH.permissionRequest, listener),
	onQuestionnaireRequest: (listener) =>
		subscribe(PUSH.questionnaireRequest, listener),
	onDaemonReady: (listener) => subscribe(PUSH.daemonReady, () => listener()),
	onDaemonDown: (listener) => subscribe(PUSH.daemonDown, listener),
	onAutomationEvent: (listener) => subscribe(PUSH.automationEvent, listener),
};

contextBridge.exposeInMainWorld("kami", bridge);
