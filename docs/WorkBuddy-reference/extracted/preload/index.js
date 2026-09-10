//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esmMin = (fn, res) => () => (fn && (res = fn(fn = 0)), res);
var __commonJSMin = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
let electron = require("electron");
//#region src/preload/frame-context.ts
/**
* Decide which preload branch should run for the current frame.
*
* Electron exposes `process.isMainFrame` in many preload environments, but in
* sandboxed subframes it may be absent depending on runtime/version. Falling
* back to `window.top === window` keeps document preview iframes on the
* subframe-only preload path instead of accidentally bootstrapping the full
* WorkBuddy renderer bridge.
*/
function resolveIsMainFramePreload(params) {
	if (typeof params.processIsMainFrame === "boolean") return params.processIsMainFrame;
	return params.isTopWindow;
}
function getIsTopWindow() {
	try {
		return window.top === window;
	} catch {
		return false;
	}
}
function getIsMainFramePreload() {
	const maybeProcess = globalThis.process;
	return resolveIsMainFramePreload({
		processIsMainFrame: maybeProcess?.isMainFrame,
		isTopWindow: getIsTopWindow()
	});
}
var init_frame_context = __esmMin((() => {}));
function isFiniteNumber(value) {
	return typeof value === "number" && Number.isFinite(value);
}
function isDragImageRect(value) {
	return Boolean(value && typeof value === "object" && isFiniteNumber(value.x) && isFiniteNumber(value.y) && isFiniteNumber(value.width) && isFiniteNumber(value.height));
}
function isBytesLike(value) {
	return value instanceof ArrayBuffer || ArrayBuffer.isView(value);
}
function isLocalFileDragInfo(value) {
	if (!value || typeof value !== "object") return false;
	const fileInfo = value;
	return typeof fileInfo.filePath === "string" || isBytesLike(fileInfo.bytes);
}
var LOCAL_FILE_DRAG_CHANNEL;
var init_local_file_drag = __esmMin((() => {
	LOCAL_FILE_DRAG_CHANNEL = "artifact:start-drag-local-file";
	electron.contextBridge.exposeInMainWorld("__workbuddyStartDragLocalFile", (fileInfo) => {
		if (!isLocalFileDragInfo(fileInfo)) return;
		electron.ipcRenderer.send(LOCAL_FILE_DRAG_CHANNEL, {
			filePath: typeof fileInfo.filePath === "string" ? fileInfo.filePath : void 0,
			fileName: typeof fileInfo.fileName === "string" ? fileInfo.fileName : void 0,
			bytes: isBytesLike(fileInfo.bytes) ? fileInfo.bytes : void 0,
			mimeType: typeof fileInfo.mimeType === "string" ? fileInfo.mimeType : void 0,
			cacheKey: typeof fileInfo.cacheKey === "string" ? fileInfo.cacheKey : void 0,
			dragImageRect: isDragImageRect(fileInfo.dragImageRect) ? fileInfo.dragImageRect : void 0
		});
	});
})), WORKBUDDY_DESKTOP_INVOKE_CHANNEL, WORKBUDDY_DESKTOP_EVENT_CHANNEL_PREFIX, LOCAL_DAEMON_TRANSPORT_PORT_CHANNEL, WORKBUDDY_WINDOW_MINIMIZE_CHANNEL, WORKBUDDY_WINDOW_MAXIMIZE_CHANNEL, WORKBUDDY_WINDOW_CLOSE_CHANNEL, WORKBUDDY_WINDOW_IS_MAXIMIZED_CHANNEL, WORKBUDDY_WINDOW_IS_FULLSCREEN_CHANNEL, WORKBUDDY_WINDOW_SET_FULLSCREEN_CHANNEL, WORKBUDDY_WINDOW_TOGGLE_FULLSCREEN_CHANNEL, WORKBUDDY_WINDOW_OPEN_STARTUP_ANALYSIS_CHANNEL, WORKBUDDY_WINDOW_GET_STARTUP_TRACE_ID_CHANNEL, WORKBUDDY_WINDOW_SYNC_NATIVE_THEME_CHANNEL, WORKBUDDY_WINDOW_START_DRAG_CHANNEL, WORKBUDDY_WINDOW_STOP_DRAG_CHANNEL, WORKBUDDY_MACHINE_ID_CHANNEL, WORKBUDDY_OPENER_OPEN_URL_CHANNEL, WORKBUDDY_LOCAL_FILE_OPEN_CHANNEL, WORKBUDDY_DIALOG_OPEN_CHANNEL, WORKBUDDY_CLIPBOARD_READ_TEXT_CHANNEL, WORKBUDDY_CLIPBOARD_WRITE_TEXT_CHANNEL, WORKBUDDY_CLIPBOARD_WRITE_IMAGE_CHANNEL, WORKBUDDY_NOTIFICATION_IS_SUPPORTED_CHANNEL, WORKBUDDY_NOTIFICATION_REQUEST_REGISTRATION_CHANNEL, WORKBUDDY_NOTIFICATION_SEND_CHANNEL, WORKBUDDY_WINDOW_MAXIMIZE_CHANGED_EVENT, WORKBUDDY_WINDOW_FOCUS_CHANGED_EVENT, WORKBUDDY_WINDOW_FULLSCREEN_CHANGED_EVENT, WORKBUDDY_GLOBAL_SHORTCUT_UPDATE_TOGGLE_WINDOW_CHANNEL, WORKBUDDY_GLOBAL_SHORTCUT_REGISTRATION_STATUS_EVENT;
var init_host = __esmMin((() => {
	WORKBUDDY_DESKTOP_INVOKE_CHANNEL = "workbuddy:invoke";
	WORKBUDDY_DESKTOP_EVENT_CHANNEL_PREFIX = "workbuddy:event:";
	LOCAL_DAEMON_TRANSPORT_PORT_CHANNEL = "workbuddy:local-daemon-transport:port";
	WORKBUDDY_WINDOW_MINIMIZE_CHANNEL = "workbuddy:window:minimize";
	WORKBUDDY_WINDOW_MAXIMIZE_CHANNEL = "workbuddy:window:maximize";
	WORKBUDDY_WINDOW_CLOSE_CHANNEL = "workbuddy:window:close";
	WORKBUDDY_WINDOW_IS_MAXIMIZED_CHANNEL = "workbuddy:window:isMaximized";
	WORKBUDDY_WINDOW_IS_FULLSCREEN_CHANNEL = "workbuddy:window:isFullscreen";
	WORKBUDDY_WINDOW_SET_FULLSCREEN_CHANNEL = "workbuddy:window:setFullscreen";
	WORKBUDDY_WINDOW_TOGGLE_FULLSCREEN_CHANNEL = "workbuddy:window:toggleFullscreen";
	WORKBUDDY_WINDOW_OPEN_STARTUP_ANALYSIS_CHANNEL = "workbuddy:window:openStartupAnalysis";
	WORKBUDDY_WINDOW_GET_STARTUP_TRACE_ID_CHANNEL = "workbuddy:window:getStartupTraceId";
	WORKBUDDY_WINDOW_SYNC_NATIVE_THEME_CHANNEL = "workbuddy:window:syncNativeTheme";
	WORKBUDDY_WINDOW_START_DRAG_CHANNEL = "workbuddy:window:startDrag";
	WORKBUDDY_WINDOW_STOP_DRAG_CHANNEL = "workbuddy:window:stopDrag";
	WORKBUDDY_MACHINE_ID_CHANNEL = "workbuddy:machineId";
	WORKBUDDY_OPENER_OPEN_URL_CHANNEL = "workbuddy:opener:openUrl";
	WORKBUDDY_LOCAL_FILE_OPEN_CHANNEL = "workbuddy:localFile:open";
	WORKBUDDY_DIALOG_OPEN_CHANNEL = "workbuddy:dialog:open";
	WORKBUDDY_CLIPBOARD_READ_TEXT_CHANNEL = "workbuddy:clipboard:readText";
	WORKBUDDY_CLIPBOARD_WRITE_TEXT_CHANNEL = "workbuddy:clipboard:writeText";
	WORKBUDDY_CLIPBOARD_WRITE_IMAGE_CHANNEL = "workbuddy:clipboard:writeImage";
	WORKBUDDY_NOTIFICATION_IS_SUPPORTED_CHANNEL = "workbuddy:notification:isSupported";
	WORKBUDDY_NOTIFICATION_REQUEST_REGISTRATION_CHANNEL = "workbuddy:notification:requestRegistration";
	WORKBUDDY_NOTIFICATION_SEND_CHANNEL = "workbuddy:notification:send";
	WORKBUDDY_WINDOW_MAXIMIZE_CHANGED_EVENT = "window:maximizeChanged";
	WORKBUDDY_WINDOW_FOCUS_CHANGED_EVENT = "window:focusChanged";
	WORKBUDDY_WINDOW_FULLSCREEN_CHANGED_EVENT = "window-fullscreen-changed";
	WORKBUDDY_GLOBAL_SHORTCUT_UPDATE_TOGGLE_WINDOW_CHANNEL = "workbuddy:globalShortcut:updateToggleWindow";
	WORKBUDDY_GLOBAL_SHORTCUT_REGISTRATION_STATUS_EVENT = "globalShortcut:registrationStatus";
}));
//#endregion
//#region ../../packages/workbuddy-app/src/desktop/clipboard.ts
var init_clipboard = __esmMin((() => {}));
//#endregion
//#region ../../packages/workbuddy-app/src/desktop/dialog.ts
var init_dialog = __esmMin((() => {}));
//#endregion
//#region ../../packages/workbuddy-app/src/desktop/host-platform.ts
var init_host_platform = __esmMin((() => {}));
//#endregion
//#region ../../packages/workbuddy-app/src/desktop/notification.ts
var init_notification = __esmMin((() => {}));
//#endregion
//#region ../../packages/workbuddy-app/src/desktop/opener.ts
var init_opener = __esmMin((() => {}));
//#endregion
//#region ../../packages/workbuddy-server/src/client/channel-map-helpers.ts
function invoke(channel, timeout) {
	return typeof timeout === "number" ? {
		type: "invoke",
		channel,
		timeout
	} : {
		type: "invoke",
		channel
	};
}
function listener(channel) {
	return {
		type: "listener",
		channel
	};
}
var init_channel_map_helpers = __esmMin((() => {}));
//#endregion
//#region ../../packages/workbuddy-server/src/agent-im/contract.ts
var AGENT_IM_RPC_CHANNELS;
var init_contract$53 = __esmMin((() => {
	AGENT_IM_RPC_CHANNELS = {
		LIST_BINDINGS: "agentIm:listBindings",
		GET_BINDING: "agentIm:getBinding",
		WECHATBOT_PREBIND_CHECK: "agentIm:wechatBotPrebindCheck",
		WECHATBOT_START_BIND: "agentIm:wechatBotStartBind",
		WECHATBOT_GET_BIND_STATUS: "agentIm:wechatBotGetBindStatus",
		WECHATBOT_UNBIND: "agentIm:wechatBotUnbind",
		QQ_START_BIND: "agentIm:qqStartBind",
		QQ_GET_BIND_STATUS: "agentIm:qqGetBindStatus",
		QQ_MANUAL_BIND: "agentIm:qqManualBind",
		QQ_CANCEL_BIND: "agentIm:qqCancelBind",
		QQ_UNBIND: "agentIm:qqUnbind",
		QQ_QR_UPDATE: "agentIm:qqQrUpdate",
		QQ_QR_EXPIRED: "agentIm:qqQrExpired",
		QQ_BIND_SUCCESS: "agentIm:qqBindSuccess",
		QQ_BIND_FAILED: "agentIm:qqBindFailed"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/agent-im/client.ts
var AGENT_IM_CHANNEL_MAP;
var init_client$39 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$53();
	AGENT_IM_CHANNEL_MAP = {
		agentImListBindings: invoke(AGENT_IM_RPC_CHANNELS.LIST_BINDINGS),
		agentImGetBinding: invoke(AGENT_IM_RPC_CHANNELS.GET_BINDING),
		agentImWechatBotPrebindCheck: invoke(AGENT_IM_RPC_CHANNELS.WECHATBOT_PREBIND_CHECK),
		agentImWechatBotStartBind: invoke(AGENT_IM_RPC_CHANNELS.WECHATBOT_START_BIND),
		agentImWechatBotGetBindStatus: invoke(AGENT_IM_RPC_CHANNELS.WECHATBOT_GET_BIND_STATUS),
		agentImWechatBotUnbind: invoke(AGENT_IM_RPC_CHANNELS.WECHATBOT_UNBIND)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/asr/contract.ts
var ASR_RPC_CHANNELS;
var init_contract$52 = __esmMin((() => {
	ASR_RPC_CHANNELS = { SPEECH_TO_TEXT: "asr:speechToText" };
}));
//#endregion
//#region ../../packages/workbuddy-server/src/asr/client.ts
var ASR_CHANNEL_MAP;
var init_client$38 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$52();
	ASR_CHANNEL_MAP = { speechToText: invoke(ASR_RPC_CHANNELS.SPEECH_TO_TEXT) };
}));
//#endregion
//#region ../../packages/workbuddy-server/src/auth/contract.ts
var AUTH_RPC_CHANNELS;
var init_contract$51 = __esmMin((() => {
	AUTH_RPC_CHANNELS = {
		LOGIN: "auth:login",
		LOGOUT: "auth:logout",
		GET_ACCOUNT: "auth:getAccount",
		GET_TOKEN: "auth:getToken",
		REFRESH_TOKEN: "auth:refreshToken",
		REFRESH_SESSION: "auth:refreshSession",
		STATUS_CHANGED: "auth:statusChanged",
		GET_USER_INFO: "auth:getUserInfo",
		GET_ACCOUNT_USAGE: "auth:getAccountUsage",
		UPDATE_ACCOUNT_NICKNAME: "auth:updateAccountNickname",
		GET_OAUTH_USER: "auth:getOauthUser",
		SAVE_OAUTH_TOKEN: "auth:saveOauthToken",
		REVOKE_ALL: "auth:revokeAll",
		GET_REPO_LIST: "auth:getRepoList",
		GET_FILE: "auth:getFile",
		GET_BRANCHES: "auth:getBranches",
		GET_REPOSITORIES: "auth:getRepositories",
		GET_ENTERPRISE_USAGE: "auth:getEnterpriseUsage",
		GET_CHECKIN_STATUS: "auth:getCheckinStatus",
		CLAIM_DAILY_CHECKIN: "auth:claimDailyCheckin",
		GET_ACTIVITY_BANNER: "auth:getActivityBanner",
		GET_AMBASSADOR_STATUS: "auth:getAmbassadorStatus",
		SAVE_PENDING_INPUT: "auth:savePendingInput",
		LOAD_PENDING_INPUT: "auth:loadPendingInput"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/auth/client.ts
var CHECKIN_RPC_TIMEOUT_MS, AUTH_CHANNEL_MAP;
var init_client$37 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$51();
	CHECKIN_RPC_TIMEOUT_MS = 15e3;
	AUTH_CHANNEL_MAP = {
		login: invoke(AUTH_RPC_CHANNELS.LOGIN),
		logout: invoke(AUTH_RPC_CHANNELS.LOGOUT),
		getAccount: invoke(AUTH_RPC_CHANNELS.GET_ACCOUNT),
		getToken: invoke(AUTH_RPC_CHANNELS.GET_TOKEN),
		getUserInfo: invoke(AUTH_RPC_CHANNELS.GET_USER_INFO),
		authRefreshToken: invoke(AUTH_RPC_CHANNELS.REFRESH_TOKEN),
		authRefreshSession: invoke(AUTH_RPC_CHANNELS.REFRESH_SESSION),
		authGetAccountUsage: invoke(AUTH_RPC_CHANNELS.GET_ACCOUNT_USAGE),
		authUpdateAccountNickname: invoke(AUTH_RPC_CHANNELS.UPDATE_ACCOUNT_NICKNAME),
		authGetOauthUser: invoke(AUTH_RPC_CHANNELS.GET_OAUTH_USER),
		authSaveOauthToken: invoke(AUTH_RPC_CHANNELS.SAVE_OAUTH_TOKEN),
		authRevokeAll: invoke(AUTH_RPC_CHANNELS.REVOKE_ALL),
		authGetRepoList: invoke(AUTH_RPC_CHANNELS.GET_REPO_LIST),
		authGetFile: invoke(AUTH_RPC_CHANNELS.GET_FILE),
		authGetBranches: invoke(AUTH_RPC_CHANNELS.GET_BRANCHES),
		authGetRepositories: invoke(AUTH_RPC_CHANNELS.GET_REPOSITORIES),
		authGetEnterpriseUsage: invoke(AUTH_RPC_CHANNELS.GET_ENTERPRISE_USAGE),
		authGetCheckinStatus: invoke(AUTH_RPC_CHANNELS.GET_CHECKIN_STATUS, CHECKIN_RPC_TIMEOUT_MS),
		authClaimDailyCheckin: invoke(AUTH_RPC_CHANNELS.CLAIM_DAILY_CHECKIN, CHECKIN_RPC_TIMEOUT_MS),
		authGetActivityBanner: invoke(AUTH_RPC_CHANNELS.GET_ACTIVITY_BANNER),
		authGetAmbassadorStatus: invoke(AUTH_RPC_CHANNELS.GET_AMBASSADOR_STATUS),
		authSavePendingInput: invoke(AUTH_RPC_CHANNELS.SAVE_PENDING_INPUT),
		authLoadPendingInput: invoke(AUTH_RPC_CHANNELS.LOAD_PENDING_INPUT)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/automation/contract.ts
var AUTOMATION_RPC_CHANNELS;
var init_contract$50 = __esmMin((() => {
	AUTOMATION_RPC_CHANNELS = {
		GET_SNAPSHOT: "automation:getSnapshot",
		UPDATE: "automation:update",
		DELETE: "automation:delete",
		TEST: "automation:test",
		ARCHIVE_INBOX_ITEM: "automation:archiveInboxItem",
		DELETE_INBOX_ITEM: "automation:deleteInboxItem",
		SNAPSHOT_UPDATE: "automation:snapshotUpdate"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/automation/client.ts
var AUTOMATION_CHANNEL_MAP;
var init_client$36 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$50();
	AUTOMATION_CHANNEL_MAP = {
		automationGetSnapshot: invoke(AUTOMATION_RPC_CHANNELS.GET_SNAPSHOT),
		automationUpdate: invoke(AUTOMATION_RPC_CHANNELS.UPDATE),
		automationDelete: invoke(AUTOMATION_RPC_CHANNELS.DELETE),
		automationTest: invoke(AUTOMATION_RPC_CHANNELS.TEST),
		automationArchiveInboxItem: invoke(AUTOMATION_RPC_CHANNELS.ARCHIVE_INBOX_ITEM),
		automationDeleteInboxItem: invoke(AUTOMATION_RPC_CHANNELS.DELETE_INBOX_ITEM),
		onAutomationSnapshotUpdate: listener(AUTOMATION_RPC_CHANNELS.SNAPSHOT_UPDATE)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/claw/contract.ts
var CLAW_RPC_CHANNELS;
var init_contract$49 = __esmMin((() => {
	CLAW_RPC_CHANNELS = {
		GET_IS_IOA_MACHINE: "claw:getIsIOAMachine",
		GET_IOA_IM_OVERRIDE: "claw:getIOAImOverride",
		GET_CHANNEL_STATUS: "claw:getChannelStatus",
		GET_SAVED_CHANNEL_CONFIGS: "claw:getSavedChannelConfigs",
		GET_SAVED_CHANNELS: "claw:getSavedChannels",
		REGISTER_CHANNEL: "claw:registerChannel",
		UNREGISTER_CHANNEL: "claw:unregisterChannel",
		GET_WECOM_ENABLED: "claw:getWecomEnabled",
		SET_WECOM_ENABLED: "claw:setWecomEnabled",
		GET_WECHATMP_ENABLED: "claw:getWechatmpEnabled",
		SET_WECHATMP_ENABLED: "claw:setWechatmpEnabled",
		GET_WECHATMP_ARTIFACT_UPLOAD_ENABLED: "claw:getWechatmpArtifactUploadEnabled",
		SET_WECHATMP_ARTIFACT_UPLOAD_ENABLED: "claw:setWechatmpArtifactUploadEnabled",
		WECHATKF_GET_LINK: "claw:wechatkfGetLink",
		WECHATKF_GET_BIND_STATUS: "claw:wechatkfGetBindStatus",
		WECHATKF_UNBIND: "claw:wechatkfUnbind",
		WEIXIN_QR_START: "claw:weixinQrStart",
		WEIXIN_QR_WAIT: "claw:weixinQrWait",
		WECHATMP_DEVICE_AUTH_CODE: "claw:wechatmpDeviceAuthCode",
		YUANBAO_SCAN_BIND_CODE: "claw:yuanbaoScanBindCode",
		YUANBAO_CHECK_SCAN_BIND_STATUS: "claw:yuanbaoCheckScanBindStatus",
		GET_AUTOMATION_WECOM_WEBHOOK_URL: "claw:getAutomationWecomWebhookUrl",
		SET_AUTOMATION_WECOM_WEBHOOK_URL: "claw:setAutomationWecomWebhookUrl",
		TEST_AUTOMATION_WECOM_WEBHOOK: "claw:testAutomationWecomWebhook",
		GET_AUTOMATION_WECOM_PUSH_CONFIG: "claw:getAutomationWecomPushConfig",
		SET_AUTOMATION_WECOM_PUSH_CONFIG: "claw:setAutomationWecomPushConfig",
		GET_LATEST_SESSION: "claw:getLatestSession",
		NOTIFY_SESSION_ACTIVE: "claw:notifySessionActive",
		CHANNEL_STATUS_CHANGE: "claw:channelStatusChange",
		CHANNEL_CONFIG_SAVED: "claw:channelConfigSaved",
		WECHATKF_BIND_SUCCESS: "claw:wechatkfBindSuccess"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/claw/client.ts
var CLAW_CHANNEL_MAP;
var init_client$35 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$49();
	CLAW_CHANNEL_MAP = {
		clawGetIsIOAMachine: invoke(CLAW_RPC_CHANNELS.GET_IS_IOA_MACHINE),
		clawGetIOAImOverride: invoke(CLAW_RPC_CHANNELS.GET_IOA_IM_OVERRIDE),
		clawGetChannelStatus: invoke(CLAW_RPC_CHANNELS.GET_CHANNEL_STATUS),
		clawGetSavedChannelConfigs: invoke(CLAW_RPC_CHANNELS.GET_SAVED_CHANNEL_CONFIGS),
		clawGetSavedChannels: invoke(CLAW_RPC_CHANNELS.GET_SAVED_CHANNELS),
		clawRegisterChannel: invoke(CLAW_RPC_CHANNELS.REGISTER_CHANNEL),
		clawUnregisterChannel: invoke(CLAW_RPC_CHANNELS.UNREGISTER_CHANNEL),
		clawGetWecomEnabled: invoke(CLAW_RPC_CHANNELS.GET_WECOM_ENABLED),
		clawSetWecomEnabled: invoke(CLAW_RPC_CHANNELS.SET_WECOM_ENABLED),
		clawGetWechatmpEnabled: invoke(CLAW_RPC_CHANNELS.GET_WECHATMP_ENABLED),
		clawSetWechatmpEnabled: invoke(CLAW_RPC_CHANNELS.SET_WECHATMP_ENABLED),
		clawGetWechatmpArtifactUploadEnabled: invoke(CLAW_RPC_CHANNELS.GET_WECHATMP_ARTIFACT_UPLOAD_ENABLED),
		clawSetWechatmpArtifactUploadEnabled: invoke(CLAW_RPC_CHANNELS.SET_WECHATMP_ARTIFACT_UPLOAD_ENABLED),
		clawWechatkfGetLink: invoke(CLAW_RPC_CHANNELS.WECHATKF_GET_LINK),
		clawWechatkfGetBindStatus: invoke(CLAW_RPC_CHANNELS.WECHATKF_GET_BIND_STATUS),
		clawWechatkfUnbind: invoke(CLAW_RPC_CHANNELS.WECHATKF_UNBIND),
		clawWeixinQrStart: invoke(CLAW_RPC_CHANNELS.WEIXIN_QR_START),
		clawWeixinQrWait: invoke(CLAW_RPC_CHANNELS.WEIXIN_QR_WAIT),
		clawWechatmpDeviceAuthCode: invoke(CLAW_RPC_CHANNELS.WECHATMP_DEVICE_AUTH_CODE),
		clawYuanbaoScanBindCode: invoke(CLAW_RPC_CHANNELS.YUANBAO_SCAN_BIND_CODE),
		clawYuanbaoCheckScanBindStatus: invoke(CLAW_RPC_CHANNELS.YUANBAO_CHECK_SCAN_BIND_STATUS),
		clawGetAutomationWecomWebhookUrl: invoke(CLAW_RPC_CHANNELS.GET_AUTOMATION_WECOM_WEBHOOK_URL),
		clawSetAutomationWecomWebhookUrl: invoke(CLAW_RPC_CHANNELS.SET_AUTOMATION_WECOM_WEBHOOK_URL),
		clawTestAutomationWecomWebhook: invoke(CLAW_RPC_CHANNELS.TEST_AUTOMATION_WECOM_WEBHOOK),
		clawGetAutomationWecomPushConfig: invoke(CLAW_RPC_CHANNELS.GET_AUTOMATION_WECOM_PUSH_CONFIG),
		clawSetAutomationWecomPushConfig: invoke(CLAW_RPC_CHANNELS.SET_AUTOMATION_WECOM_PUSH_CONFIG),
		clawGetLatestSession: invoke(CLAW_RPC_CHANNELS.GET_LATEST_SESSION),
		clawNotifySessionActive: invoke(CLAW_RPC_CHANNELS.NOTIFY_SESSION_ACTIVE),
		onClawChannelStatusChange: listener(CLAW_RPC_CHANNELS.CHANNEL_STATUS_CHANGE),
		onClawChannelConfigSaved: listener(CLAW_RPC_CHANNELS.CHANNEL_CONFIG_SAVED),
		onClawWechatkfBindSuccess: listener(CLAW_RPC_CHANNELS.WECHATKF_BIND_SUCCESS)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/cloud-agent/contract.ts
var CLOUD_AGENT_RPC_CHANNELS;
var init_contract$48 = __esmMin((() => {
	CLOUD_AGENT_RPC_CHANNELS = {
		INIT_ORCHESTRATOR: "cloudAgent:initOrchestrator",
		CREATE_AGENT: "cloudAgent:createAgent",
		GET_AGENT: "cloudAgent:getAgent",
		VALIDATE_FIELD: "cloudAgent:validateField",
		GET_QUOTA: "cloudAgent:getQuota",
		DELETE_AGENT: "cloudAgent:deleteAgent",
		PIN_AGENT: "cloudAgent:pinAgent",
		UNPIN_AGENT: "cloudAgent:unpinAgent",
		CLONE_AGENT: "cloudAgent:cloneAgent",
		PUBLISH_VERSION: "cloudAgent:publishVersion",
		LIST_GRANTED_AGENTS: "cloudAgent:listGrantedAgents",
		LIST_ENTERPRISE_PUBLISHED_AGENTS: "cloudAgent:listEnterprisePublishedAgents",
		GET_ENTERPRISE_AGENT_MARKET: "cloudAgent:getEnterpriseAgentMarket",
		LIST_AVAILABLE_MODELS: "cloudAgent:listAvailableModels",
		CREATE_INSTANCE: "cloudAgent:createInstance",
		GET_INSTANCE: "cloudAgent:getInstance",
		REBUILD_INSTANCE: "cloudAgent:rebuildInstance",
		LIST_INSTANCES: "cloudAgent:listInstances",
		DELETE_INSTANCE: "cloudAgent:deleteInstance",
		CREATE_CONVERSATION: "cloudAgent:createConversation",
		GET_CONVERSATION_DETAIL: "cloudAgent:getConversationDetail",
		LIST_CONVERSATIONS: "cloudAgent:listConversations",
		LIST_USER_CONVERSATIONS: "cloudAgent:listUserConversations",
		DELETE_CONVERSATION: "cloudAgent:deleteConversation",
		UNARCHIVE_CONVERSATION: "cloudAgent:unarchiveConversation",
		ARCHIVE_CONVERSATION: "cloudAgent:archiveConversation",
		UPDATE_CONVERSATION: "cloudAgent:updateConversation",
		GET_SANDBOX_SESSION: "cloudAgent:getSandboxSession",
		CREATE_CONVERSATION_SESSION: "cloudAgent:createConversationSession",
		DELETE_CONVERSATION_SESSION: "cloudAgent:deleteConversationSession",
		GET_CONVERSATION: "cloudAgent:getConversation",
		UPLOAD_AVATAR: "cloudAgent:uploadAvatar",
		CREATE_ENTERPRISE_CONVERSATION: "cloudAgent:createEnterpriseConversation"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/cloud-agent/client.ts
var CLOUD_AGENT_CHANNEL_MAP;
var init_client$34 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$48();
	CLOUD_AGENT_CHANNEL_MAP = {
		cloudAgentInitOrchestrator: invoke(CLOUD_AGENT_RPC_CHANNELS.INIT_ORCHESTRATOR),
		cloudAgentCreateAgent: invoke(CLOUD_AGENT_RPC_CHANNELS.CREATE_AGENT),
		cloudAgentGetAgent: invoke(CLOUD_AGENT_RPC_CHANNELS.GET_AGENT),
		cloudAgentValidateField: invoke(CLOUD_AGENT_RPC_CHANNELS.VALIDATE_FIELD),
		cloudAgentGetQuota: invoke(CLOUD_AGENT_RPC_CHANNELS.GET_QUOTA),
		cloudAgentDeleteAgent: invoke(CLOUD_AGENT_RPC_CHANNELS.DELETE_AGENT),
		cloudAgentPinAgent: invoke(CLOUD_AGENT_RPC_CHANNELS.PIN_AGENT),
		cloudAgentUnpinAgent: invoke(CLOUD_AGENT_RPC_CHANNELS.UNPIN_AGENT),
		cloudAgentCloneAgent: invoke(CLOUD_AGENT_RPC_CHANNELS.CLONE_AGENT),
		cloudAgentPublishVersion: invoke(CLOUD_AGENT_RPC_CHANNELS.PUBLISH_VERSION),
		cloudAgentListGrantedAgents: invoke(CLOUD_AGENT_RPC_CHANNELS.LIST_GRANTED_AGENTS),
		cloudAgentListEnterprisePublishedAgents: invoke(CLOUD_AGENT_RPC_CHANNELS.LIST_ENTERPRISE_PUBLISHED_AGENTS),
		cloudAgentGetEnterpriseAgentMarket: invoke(CLOUD_AGENT_RPC_CHANNELS.GET_ENTERPRISE_AGENT_MARKET),
		cloudAgentCreateInstance: invoke(CLOUD_AGENT_RPC_CHANNELS.CREATE_INSTANCE),
		cloudAgentGetInstance: invoke(CLOUD_AGENT_RPC_CHANNELS.GET_INSTANCE),
		cloudAgentRebuildInstance: invoke(CLOUD_AGENT_RPC_CHANNELS.REBUILD_INSTANCE),
		cloudAgentListInstances: invoke(CLOUD_AGENT_RPC_CHANNELS.LIST_INSTANCES),
		cloudAgentDeleteInstance: invoke(CLOUD_AGENT_RPC_CHANNELS.DELETE_INSTANCE),
		cloudAgentCreateConversation: invoke(CLOUD_AGENT_RPC_CHANNELS.CREATE_CONVERSATION),
		cloudAgentGetConversationDetail: invoke(CLOUD_AGENT_RPC_CHANNELS.GET_CONVERSATION_DETAIL),
		cloudAgentListConversations: invoke(CLOUD_AGENT_RPC_CHANNELS.LIST_CONVERSATIONS),
		cloudAgentListUserConversations: invoke(CLOUD_AGENT_RPC_CHANNELS.LIST_USER_CONVERSATIONS),
		cloudAgentDeleteConversation: invoke(CLOUD_AGENT_RPC_CHANNELS.DELETE_CONVERSATION),
		cloudAgentUnarchiveConversation: invoke(CLOUD_AGENT_RPC_CHANNELS.UNARCHIVE_CONVERSATION),
		cloudAgentArchiveConversation: invoke(CLOUD_AGENT_RPC_CHANNELS.ARCHIVE_CONVERSATION),
		cloudAgentUpdateConversation: invoke(CLOUD_AGENT_RPC_CHANNELS.UPDATE_CONVERSATION),
		cloudAgentGetSandboxSession: invoke(CLOUD_AGENT_RPC_CHANNELS.GET_SANDBOX_SESSION),
		cloudAgentCreateConversationSession: invoke(CLOUD_AGENT_RPC_CHANNELS.CREATE_CONVERSATION_SESSION),
		cloudAgentDeleteConversationSession: invoke(CLOUD_AGENT_RPC_CHANNELS.DELETE_CONVERSATION_SESSION),
		cloudAgentGetConversation: invoke(CLOUD_AGENT_RPC_CHANNELS.GET_CONVERSATION),
		cloudAgentUploadAvatar: invoke(CLOUD_AGENT_RPC_CHANNELS.UPLOAD_AVATAR),
		cloudAgentCreateEnterpriseConversation: invoke(CLOUD_AGENT_RPC_CHANNELS.CREATE_ENTERPRISE_CONVERSATION)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/cloud-assistant/contract.ts
var CLOUD_ASSISTANT_RPC_CHANNELS;
var init_contract$47 = __esmMin((() => {
	CLOUD_ASSISTANT_RPC_CHANNELS = {
		GET_ENTITLEMENT: "cloudAssistant:getEntitlement",
		INITIALIZE_ORCHESTRATOR: "cloudAssistant:initializeOrchestrator"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/cloud-assistant/client.ts
var CLOUD_ASSISTANT_CHANNEL_MAP;
var init_client$33 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$47();
	CLOUD_ASSISTANT_CHANNEL_MAP = {
		cloudAssistantGetEntitlement: invoke(CLOUD_ASSISTANT_RPC_CHANNELS.GET_ENTITLEMENT),
		cloudAssistantInitializeOrchestrator: invoke(CLOUD_ASSISTANT_RPC_CHANNELS.INITIALIZE_ORCHESTRATOR)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/app/contract.ts
var APP_RPC_CHANNELS;
var init_contract$46 = __esmMin((() => {
	APP_RPC_CHANNELS = {
		GET_VERSION: "app:getVersion",
		GET_PLATFORM: "app:getPlatform",
		GET_LOCALE: "app:getLocale",
		GET_CONFIG_DIR: "app:getConfigDir",
		GET_MACHINE_ID: "app:getMachineId",
		SET_MENU_LOCALE: "app:setMenuLocale",
		GET_AUTO_LAUNCH_ENABLED: "app:getAutoLaunchEnabled",
		SET_AUTO_LAUNCH_ENABLED: "app:setAutoLaunchEnabled"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/backend/contract.ts
var BACKEND_RPC_CHANNELS;
var init_contract$45 = __esmMin((() => {
	BACKEND_RPC_CHANNELS = {
		LIST: "backend:list",
		CALL: "backend:call",
		EXPERT_CENTER_INIT: "backend:expert-center-init",
		EXPERT_CENTER_CATEGORIES: "backend:expert-center-categories",
		EXPERT_CENTER_EXPERTS: "backend:expert-center-experts",
		EXPERT_CENTER_EXPERT: "backend:expert-center-expert",
		EXPERT_CENTER_REFRESH: "backend:expert-center-refresh",
		EXPERT_CENTER_RANKING: "backend:expert-center-ranking",
		EXPERT_HISTORY_RECENT: "backend:expert-history-recent",
		EXPERT_HISTORY_GET_RECENT: "backend:expert-history-get-recent",
		EXPERT_HISTORY_ADD: "backend:expert-history-add",
		EXPERT_HISTORY_REMOVE: "backend:expert-history-remove",
		EXPERT_HISTORY_CLEAR: "backend:expert-history-clear",
		INSPIRATION_LIST: "backend:inspiration-list",
		INSPIRATION_DETAIL: "backend:inspiration-detail",
		INSPIRATION_SETTINGS_GET: "backend:inspiration-settings-get",
		INSPIRATION_SETTINGS_SAVE: "backend:inspiration-settings-save",
		INSPIRATION_ONBOARDING_CHECK: "backend:inspiration-onboarding-check",
		INSPIRATION_ONBOARDING_COMPLETE: "backend:inspiration-onboarding-complete",
		INSPIRATION_FEEDBACK: "backend:inspiration-feedback",
		INSPIRATION_MARK_READ: "backend:inspiration-mark-read",
		INSPIRATION_MARK_ALL_READ: "backend:inspiration-mark-all-read",
		INSPIRATION_SAVE: "backend:inspiration-save",
		INSPIRATION_RECORD_TAB_VIEW: "backend:inspiration-record-tab-view",
		INSPIRATION_INJECT_DEMO: "backend:inspiration-inject-demo",
		INSPIRATION_CURATION_LIST: "backend:inspiration-curation-list",
		INSPIRATION_CURATION_ADD: "backend:inspiration-curation-add",
		INSPIRATION_CURATION_UPDATE: "backend:inspiration-curation-update",
		INSPIRATION_CURATION_DELETE: "backend:inspiration-curation-delete"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/binary/contract.ts
var BINARY_RPC_CHANNELS;
var init_contract$44 = __esmMin((() => {
	BINARY_RPC_CHANNELS = {
		LIST: "binary:list",
		STATUS: "binary:status"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/config/contract.ts
var CONFIG_RPC_CHANNELS;
var init_contract$43 = __esmMin((() => {
	CONFIG_RPC_CHANNELS = {
		GET: "config:get",
		SET: "config:set",
		GET_ALL: "config:getAll",
		GET_PRODUCT_SCENES: "config:getProductScenes",
		GET_PRODUCT_CONFIGURATION: "config:getProductConfiguration",
		PRODUCT_CONFIGURATION_CHANGED: "config:productConfigurationChanged",
		GET_CLIENT_MENUS: "config:getClientMenus",
		GET_LOCAL_CUSTOM_MODELS: "config:getLocalCustomModels",
		SAVE_LOCAL_CUSTOM_MODEL: "config:saveLocalCustomModel",
		DELETE_LOCAL_CUSTOM_MODEL: "config:deleteLocalCustomModel",
		TEST_LOCAL_CUSTOM_MODEL: "config:testLocalCustomModel"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/connector/contract.ts
var CONNECTOR_RPC_CHANNELS;
var init_contract$42 = __esmMin((() => {
	CONNECTOR_RPC_CHANNELS = {
		INIT: "connector:init",
		GET_CONFIGS: "connector:getConfigs",
		GET_STATES: "connector:getStates",
		CONNECT_CUSTOM_MCP_SERVER: "connector:connectCustomMcpServer",
		CONNECT: "connector:connect",
		REPAIR_CONNECT: "connector:repairConnect",
		DISCONNECT: "connector:disconnect",
		CANCEL_CONNECT: "connector:cancelConnect",
		UPDATE_HEADERS: "connector:updateHeaders",
		UPDATE_ENV: "connector:updateEnv",
		UNBIND: "connector:unbind",
		HAS_OAUTH_TOKEN: "connector:hasOAuthToken",
		GET_USER_CONNECTOR: "connector:getUserConnector",
		MODIFY_CONNECT_STATUS: "connector:modifyConnectStatus",
		MODIFY_REPO: "connector:modifyRepo",
		MODIFY_ACTIVE_STATUS: "connector:modifyActiveStatus",
		DELETE_USER_CONNECTOR: "connector:deleteUserConnector",
		SAVE_OAUTH_TOKEN: "connector:saveOauthToken",
		GET_REPO_LIST: "connector:getRepoList",
		GET_OAUTH_USER: "connector:getOauthUser",
		REVOKE_ALL: "connector:revokeAll",
		GET_FILE: "connector:getFile",
		ADD_TASK: "connector:addTask",
		GET_TASK_CONNECTOR: "connector:getTaskConnector",
		MODIFY_TASK_ACTIVE_STATUS: "connector:modifyTaskActiveStatus",
		MODIFY_TASK_REPO: "connector:modifyTaskRepo",
		OAUTH_START: "connector:oauthStart",
		OAUTH_STATUS: "connector:oauthStatus",
		OAUTH_ACCESS_TOKEN: "connector:oauthAccessToken",
		OAUTH_REVOKE: "connector:oauthRevoke",
		OAUTH_CONNECT: "connector:oauthConnect",
		OAUTH_REPOS: "connector:oauthRepos",
		OAUTH_TEMP_LOGIN_URL: "connector:oauthTempLoginUrl",
		OAUTH_ENTERPRISE_TEMP_LOGIN_URL: "connector:enterpriseTempLoginUrl",
		REGISTRY_2C_LIST: "connector:registry2cList",
		RESOLVE_POI_CONSENT: "connector:resolvePoiConsent",
		CALL_TOOL: "connector:callTool"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/credit-prediction/contract.ts
var CREDIT_PREDICTION_RPC_CHANNELS;
var init_contract$41 = __esmMin((() => {
	CREDIT_PREDICTION_RPC_CHANNELS = {
		PREDICT: "creditPrediction:predict",
		CANCEL: "creditPrediction:cancel"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/dialog/contract.ts
var DIALOG_RPC_CHANNELS;
var init_contract$40 = __esmMin((() => {
	DIALOG_RPC_CHANNELS = {
		SELECT_DIRECTORY: "window:selectDirectory",
		SELECT_FILE: "window:selectFile",
		SAVE_FILE: "window:saveFile",
		PICK_FILE: "dialog:pickFile",
		PICK_FOLDER: "dialog:pickFolder"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/docs/contract.ts
var DOCS_RPC_CHANNELS;
var init_contract$39 = __esmMin((() => {
	DOCS_RPC_CHANNELS = {
		GET_PREVIEW_URL: "docs:getPreviewUrl",
		PREVIEW_DOCUMENT_FROM_CONTENT: "docs:previewDocumentFromContent"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/expert/contract.ts
var EXPERT_RPC_CHANNELS, EXPERT_HISTORY_RPC_CHANNELS;
var init_contract$38 = __esmMin((() => {
	EXPERT_RPC_CHANNELS = {
		INIT: "expert:init",
		GET_CATEGORIES: "expert:getCategories",
		GET_EXPERTS: "expert:getExperts",
		GET_FEATURED_SCENES: "expert:getFeaturedScenes",
		GET_EXPERT: "expert:getExpert",
		GET_AGENT_TEMPLATES: "expert:getAgentTemplates",
		GET_USE_REQUIREMENTS: "expert:getUseRequirements",
		REFRESH: "expert:refresh",
		LOAD_STATE_CHANGED: "expert:loadStateChanged",
		ACTIVATE_PLUGIN: "expert:activatePlugin",
		DEACTIVATE_PLUGIN: "expert:deactivatePlugin",
		GET_ACTIVE_PLUGINS: "expert:getActivePlugins",
		SWITCH_PLUGIN_FOR_SESSION: "expert:switchPluginForSession",
		EXPORT_ZIP: "expert:exportZip",
		IMPORT_FROM_URL: "expert:importFromUrl",
		INSTALL_FROM_PATH: "expert:installFromPath",
		PREVIEW_FROM_URL: "expert:previewFromUrl",
		PRE_CHECK_SHARE: "expert:preCheckShare",
		QUERY_SHARE_SECURITY_SCAN: "expert:queryShareSecurityScan",
		SCAN_CUSTOM_EXPERTS: "expert:scanCustomExperts",
		GET_CUSTOM_EXPERT: "expert:getCustomExpert",
		DELETE_CUSTOM_EXPERT: "expert:deleteCustomExpert",
		ADD_USER_EXPERTS: "expert:addUserExperts",
		CLEAR_CUSTOM_EXPERT_SESSION_MARKER: "expert:clearCustomExpertSessionMarker"
	};
	EXPERT_HISTORY_RPC_CHANNELS = {
		GET_RECENT: "expert-history:getRecent",
		ADD: "expert-history:add",
		REMOVE: "expert-history:remove",
		CLEAR: "expert-history:clear"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/feedback/contract.ts
var FEEDBACK_RPC_CHANNELS;
var init_contract$37 = __esmMin((() => {
	FEEDBACK_RPC_CHANNELS = { SUBMIT: "feedback:submit" };
}));
//#endregion
//#region ../../packages/workbuddy-server/src/file-system/contract.ts
var FILE_RPC_CHANNELS, IO_RPC_CHANNELS;
var init_contract$36 = __esmMin((() => {
	FILE_RPC_CHANNELS = {
		READ: "file:read",
		WRITE: "file:write",
		WRITE_BATCH: "file:writeBatch",
		LIST_DIR: "file:listDir",
		EXISTS: "file:exists",
		MAKE_DIR: "file:makeDir",
		REMOVE: "file:remove",
		RENAME: "file:rename",
		GET_INFO: "file:getInfo",
		SEARCH: "file:search",
		UPLOAD: "file:upload",
		READ_CHUNKED: "file:readChunked"
	};
	IO_RPC_CHANNELS = { APPEND_RECORD: "io:appendRecord" };
}));
//#endregion
//#region ../../packages/workbuddy-server/src/growth/contract.ts
var GROWTH_RPC_CHANNELS;
var init_contract$35 = __esmMin((() => {
	GROWTH_RPC_CHANNELS = { GET_BUDDY: "growth:getBuddy" };
}));
//#endregion
//#region ../../packages/workbuddy-server/src/identity/contract.ts
var IDENTITY_RPC_CHANNELS;
var init_contract$34 = __esmMin((() => {
	IDENTITY_RPC_CHANNELS = {
		GET_NAME: "identity:getName",
		UPDATE_NAME: "identity:updateName",
		CHECK_MODERATION: "identity:checkModeration",
		CHANGED: "identity:changed",
		GET_LOCAL_MEMORY_FILES: "identity:getLocalMemoryFiles",
		UPDATE_USER_CALL_NAME: "identity:updateUserCallName",
		UPDATE_AI_NAME: "identity:updateAiName",
		UPDATE_SOUL_BODY: "identity:updateSoulBody",
		UPDATE_MEMORY_BODY: "identity:updateMemoryBody"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/idle-capability/contract.ts
var IDLE_CAPABILITY_RPC_CHANNELS;
var init_contract$33 = __esmMin((() => {
	IDLE_CAPABILITY_RPC_CHANNELS = {
		RECORD_USAGE: "idleCapability:recordUsage",
		RECORD_ACTIVE_DAY: "idleCapability:recordActiveDay",
		GET_IDLE_CARD_DATA: "idleCapability:getIdleCardData",
		MARK_SHOWN: "idleCapability:markShown",
		DISMISS: "idleCapability:dismiss",
		DISMISS_GLOBAL: "idleCapability:dismissGlobal",
		FORGET_CAPABILITY: "idleCapability:forgetCapability",
		LIST_CANDIDATES: "idleCapability:listCandidates"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/ima/contract.ts
var IMA_RPC_CHANNELS;
var init_contract$32 = __esmMin((() => {
	IMA_RPC_CHANNELS = {
		AUTH_START: "ima:auth:start",
		AUTH_STATUS: "ima:auth:status",
		AUTH_REFRESH: "ima:auth:refresh",
		AUTH_LOGOUT: "ima:auth:logout",
		KB_LIST: "ima:kb:list",
		KB_SEARCH: "ima:kb:search",
		KB_INFO_BY_SHARE_LINK: "ima:kb:info-by-share-link",
		FILES_LIST: "ima:files:list",
		FILES_SEARCH: "ima:files:search",
		FILES_VIEW_URL: "ima:files:view-url",
		FILES_DOWNLOAD_URL: "ima:files:download-url",
		FILES_CONTENT: "ima:files:content",
		FILES_BLOB: "ima:files:blob",
		FILES_UPLOAD: "ima:files:upload",
		FILES_CANCEL_UPLOAD: "ima:files:cancel-upload",
		FILES_UPLOAD_BY_PATH: "ima:files:upload-by-path",
		FILES_SDK_PREVIEW: "ima:files:sdk-preview",
		UPLOAD_PROGRESS: "ima:event:upload-progress"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/inspiration/contract.ts
var INSPIRATION_RPC_CHANNELS, INSPIRATION_CURATION_RPC_CHANNELS;
var init_contract$31 = __esmMin((() => {
	INSPIRATION_RPC_CHANNELS = {
		LIST: "inspiration:list",
		DETAIL: "inspiration:detail",
		SETTINGS_GET: "inspiration:settings-get",
		SETTINGS_SAVE: "inspiration:settings-save",
		ONBOARDING_CHECK: "inspiration:onboarding-check",
		ONBOARDING_COMPLETE: "inspiration:onboarding-complete",
		FEEDBACK: "inspiration:feedback",
		MARK_READ: "inspiration:mark-read",
		MARK_ALL_READ: "inspiration:mark-all-read",
		SAVE: "inspiration:save",
		RECORD_TAB_VIEW: "inspiration:record-tab-view",
		INJECT_DEMO: "backend:inspiration-inject-demo"
	};
	INSPIRATION_CURATION_RPC_CHANNELS = {
		LIST: "inspiration-curation:list",
		ADD: "inspiration-curation:add",
		UPDATE: "inspiration-curation:update",
		DELETE: "inspiration-curation:delete"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/marketplace/contract.ts
var MARKETPLACE_RPC_CHANNELS;
var init_contract$30 = __esmMin((() => {
	MARKETPLACE_RPC_CHANNELS = {
		LIST: "marketplace:list",
		INSTALL: "marketplace:install",
		CONTENT: "marketplace:content"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/mcp/connector-mcp/contract.ts
var MCP_RPC_CHANNELS;
var init_contract$29 = __esmMin((() => {
	MCP_RPC_CHANNELS = {
		LIST: "mcp:list",
		TOGGLE: "mcp:toggle",
		RECONNECT: "mcp:reconnect",
		DELETE: "mcp:delete",
		TOGGLE_TOOL: "mcp:toggleTool",
		OPEN_CONFIG: "mcp:openConfig",
		GET_CONFIG_CONTENT: "mcp:getConfigContent",
		SAVE_CONFIG_CONTENT: "mcp:saveConfigContent"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/memory/contract.ts
var MEMORY_RPC_CHANNELS;
var init_contract$28 = __esmMin((() => {
	MEMORY_RPC_CHANNELS = {
		GET_PROFILE: "memory:getProfile",
		SAVE_SETTINGS: "memory:saveSettings",
		SUBMIT_SUGGESTION: "memory:submitSuggestion",
		IMPORT_CONTENT: "memory:importContent",
		CLEAR_PROFILE: "memory:clearProfile",
		CHECK_UPDATING: "memory:checkUpdating"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/microphone/contract.ts
var MICROPHONE_RPC_CHANNELS;
var init_contract$27 = __esmMin((() => {
	MICROPHONE_RPC_CHANNELS = {
		GET_PERMISSION: "microphone:getPermission",
		REQUEST_PERMISSION: "microphone:requestPermission",
		OPEN_SYSTEM_SETTINGS: "microphone:openSystemSettings",
		PERMISSION_CHANGED: "microphone:permissionChanged"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/migration/contract.ts
var MIGRATION_RPC_CHANNELS;
var init_contract$26 = __esmMin((() => {
	MIGRATION_RPC_CHANNELS = {
		GET_HISTORY_STATUS: "migration:getHistoryStatus",
		GET_PENDING_LOCAL_STORAGE_MIGRATION: "migration:getPendingLocalStorageMigration",
		COMPLETE_LOCAL_STORAGE_MIGRATION: "migration:completeLocalStorageMigration",
		HISTORY_STATUS_UPDATE: "migration:historyStatusUpdate",
		HISTORY_PROGRESS: "migration:historyProgress"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/my-files/contract.ts
var MY_FILES_RPC_CHANNELS;
var init_contract$25 = __esmMin((() => {
	MY_FILES_RPC_CHANNELS = {
		GET_TASK_ARTIFACTS: "myFiles:getTaskArtifacts",
		GET_NETDRIVE_ACCESS_TOKEN: "myFiles:getNetDriveAccessToken",
		GET_NETDRIVE_NICKNAMES: "myFiles:getNetDriveNicknames",
		GET_NETDRIVE_PURCHASE_CODE: "myFiles:getNetDrivePurchaseCode",
		GET_NETDRIVE_ENTERPRISE_INFO: "myFiles:getNetDriveEnterpriseInfo",
		UPLOAD_TO_DRIVE: "myFiles:uploadToDrive",
		DOWNLOAD_FILE_TO_LOCAL: "myFiles:downloadFileToLocal",
		CLEANUP_DOWNLOADED_TEMPORARY_FILE: "myFiles:cleanupDownloadedTemporaryFile",
		REPORT_FILE_EVENTS: "myFiles:reportFileEvents",
		GET_FILE_PATHS: "myFiles:getFilePaths"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/perf/contract.ts
var PERF_RPC_CHANNELS;
var init_contract$24 = __esmMin((() => {
	PERF_RPC_CHANNELS = {
		APPEND_LINE: "perf:appendLine",
		FLUSH: "perf:flush",
		GET_LOG_FILE_PATH: "perf:getLogFilePath"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/plugin/contract.ts
var PLUGIN_RPC_CHANNELS;
var init_contract$23 = __esmMin((() => {
	PLUGIN_RPC_CHANNELS = {
		BATCH_TOGGLE: "plugin:batchToggle",
		GET_INSTALLED: "plugin:getInstalled",
		INSTALL: "plugin:install",
		UNINSTALL: "plugin:uninstall",
		UPDATE: "plugin:update",
		SET_MARKETPLACE_AUTO_UPDATE: "plugin:setMarketplaceAutoUpdate",
		GET_MARKETPLACES: "plugin:getMarketplaces",
		GET_MARKETPLACE_PLUGINS: "plugin:getMarketplacePlugins",
		GET_DETAIL: "plugin:getDetail",
		ADD_MARKETPLACE: "plugin:addMarketplace",
		REMOVE_MARKETPLACE: "plugin:removeMarketplace",
		REFRESH_MARKETPLACE: "plugin:refreshMarketplace",
		RECONCILE_WORKBUDDY_BUILTIN: "plugin:reconcileWorkbuddyBuiltin",
		REFRESH_RUNTIME_PLUGINS: "plugin:refreshRuntimePlugins",
		CHANGED: "plugin:changed"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/power/contract.ts
var POWER_RPC_CHANNELS;
var init_contract$22 = __esmMin((() => {
	POWER_RPC_CHANNELS = {
		SET_POWER_SAVE_BLOCKER: "window:setPowerSaveBlocker",
		GET_POWER_SAVE_BLOCKER_STATE: "window:getPowerSaveBlockerState"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/proxy-settings/contract.ts
var PROXY_SETTINGS_RPC_CHANNELS;
var init_contract$21 = __esmMin((() => {
	PROXY_SETTINGS_RPC_CHANNELS = {
		GET_SETTINGS: "proxySettings:getSettings",
		SAVE_SETTINGS: "proxySettings:saveSettings",
		TEST_CONNECTION: "proxySettings:testConnection"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/sandbox/contract.ts
var SANDBOX_RPC_CHANNELS;
var init_contract$20 = __esmMin((() => {
	SANDBOX_RPC_CHANNELS = {
		RESPOND_TO_INTERCEPT: "sandbox:respondToIntercept",
		INTERCEPT_REQUEST: "sandbox:interceptRequest",
		REGISTER_MOUNT: "sandboxPreview:registerMount"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/session/contract.ts
var SESSION_RPC_CHANNELS;
var init_contract$19 = __esmMin((() => {
	SESSION_RPC_CHANNELS = {
		CREATE: "session:create",
		DESTROY: "session:destroy",
		DELETE: "session:delete",
		LIST: "session:list",
		LOAD: "session:load",
		GET: "session:get",
		GET_TEAM_RUNTIME: "session:getTeamRuntime",
		UPSERTED: "session:upserted",
		DELETED: "session:deleted",
		SEND_MESSAGE: "session:sendMessage",
		CANCEL: "session:cancel",
		RESOLVE_PERMISSION: "session:resolvePermission",
		REJECT_PERMISSION: "session:rejectPermission",
		RESOLVE_INTERRUPTION: "session:resolveInterruption",
		ANSWER_QUESTION: "session:answerQuestion",
		CANCEL_QUESTION: "session:cancelQuestion",
		ANSWER_POI_QUESTION: "session:answerPoiQuestion",
		PUSH_SESSION_POI: "session:pushSessionPoi",
		RESPOND_ELICITATION: "session:respondElicitation",
		SET_MODE: "session:setMode",
		SET_MODEL: "session:setModel",
		SET_CONFIG_OPTION: "session:setConfigOption",
		UPDATE_CONFIG: "session:updateConfig",
		ARCHIVE: "session:archive",
		RENAME: "session:rename",
		MOVE: "session:move",
		UPDATE_STATUS: "session:updateStatus",
		GET_AVAILABLE_COMMANDS: "session:getAvailableCommands",
		GET_SUBAGENT_LIST: "session:getSubagentList",
		RESPOND_TO_SAMPLING: "session:respondToSampling",
		RESPOND_TO_ROOTS: "session:respondToRoots",
		REQUEST_YIELD: "session:requestYield",
		GET_MESSAGE_QUEUE: "session:getMessageQueue",
		SAVE_MESSAGE_QUEUE: "session:saveMessageQueue",
		ENQUEUE_MESSAGE: "session:enqueueMessage",
		REMOVE_QUEUE_ITEM: "session:removeQueueItem",
		POP_QUEUE_ITEM_FOR_EDIT: "session:popQueueItemForEdit",
		REORDER_QUEUE: "session:reorderQueue",
		SEND_QUEUE_ITEM_NOW: "session:sendQueueItemNow",
		ACTIVATE_QUEUE: "session:activateQueue",
		PAUSE_QUEUE: "session:pauseQueue",
		RESUME_QUEUE: "session:resumeQueue",
		CANCEL_QUEUE: "session:cancelQueue",
		GET_QUEUE_STATE: "session:getQueueState",
		REPORT_RUNTIME_EVENT: "session:reportRuntimeEvent",
		ACP_REQUEST: "session:acpRequest",
		EVENT: "session:event",
		NAVIGATE: "session:navigate",
		NOTIFY_PERMISSION_PENDING_APPROVAL: "session:notifyPermissionPendingApproval",
		NOTIFY_PERMISSION_RESOLVED_FROM_LOCAL: "session:notifyPermissionResolvedFromLocal",
		NOTIFY_LISTENER_READY: "session:notifyListenerReady",
		GET_PERSISTED_USAGE: "session:getPersistedUsage",
		GET_LAST_USAGE_EVENT: "session:getLastUsageEvent",
		ROLLBACK: "session:rollback"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/share/contract.ts
var SHARE_RPC_CHANNELS;
var init_contract$18 = __esmMin((() => {
	SHARE_RPC_CHANNELS = {
		UPLOAD_FILE: "share:uploadFile",
		UPLOAD_IMAGE: "share:uploadImage",
		UPLOAD_TO_KNOWLEDGE: "share:uploadToKnowledge",
		CREATE_LINK: "share:createLink",
		GET_LIST: "share:getList",
		DOWNLOAD_FILE: "share:downloadFile",
		SET_ENABLED: "share:setEnabled",
		GET_DETAIL: "share:getDetail",
		VERIFY: "share:verify",
		PREPARE_TASK: "share:prepareTask",
		UPLOAD_TASK_FILE: "share:uploadTaskFile",
		CONFIRM_TASK: "share:confirmTask",
		CANCEL_TASK: "share:cancelTask",
		GET_TASK_LIST: "share:getTaskList",
		DELETE_TASK: "share:deleteTask",
		GENERATE_WXMP_QRCODE: "share:generateWxMPQRCode",
		BATCH_MOVE_KNOWLEDGE_NODES: "share:batchMoveKnowledgeNodes",
		INVITE_PERMISSION: "share:invitePermission",
		SET_PERMISSION: "share:setPublicPermission",
		GET_COLLABORATORS: "share:getCollaborators",
		SET_MEMBER_PERMISSION: "share:setMemberPermission",
		QUERY_PAGE_INFO: "share:queryPageInfo",
		GET_NODE_INFO: "share:getNodeInfo",
		GET_PERMISSION: "share:getPublicPermission",
		PUBLISH_PAGE: "share:publishPage",
		UNPUBLISH_PAGE: "share:unpublishPage",
		UPLOAD_LOCAL_FILE_TO_COS: "share:uploadLocalFileToCos",
		QUERY_IMPORT_PROGRESS: "share:queryImportProgress",
		UPLOAD_SHARE_TEMPLATE: "share:uploadShareTemplate"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/sidecar/contract.ts
var SIDECAR_RPC_CHANNELS;
var init_contract$17 = __esmMin((() => {
	SIDECAR_RPC_CHANNELS = {
		LIST: "sidecar:list",
		RESIZE: "sidecar:resize"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/skill/contract.ts
var SKILL_RPC_CHANNELS, SKILLHUB_RPC_CHANNELS, KNOT_RPC_CHANNELS, BUILTIN_MARKET_RPC_CHANNELS, ENTERPRISE_SKILLS_RPC_CHANNELS;
var init_contract$16 = __esmMin((() => {
	SKILL_RPC_CHANNELS = {
		LIST: "skill:list",
		IMPORT: "skill:import",
		TOGGLE: "skill:toggle",
		BATCH_TOGGLE: "skill:batchToggle",
		DELETE: "skill:delete",
		CONTENT: "skill:content",
		INSTALL_BY_PATH: "skill:installByPath",
		PREPARE_FROM_URL: "skill:prepareFromUrl",
		GET_CONTENT: "skill:getContent",
		GET_MARKETPLACE: "skill:getMarketplace",
		GET_MARKETPLACE_CONTENT: "skill:getMarketplaceContent",
		INSTALL_MARKETPLACE: "skill:installMarketplace",
		QUERY_SCAN_RESULT: "skill:queryScanResult",
		INSTALL_FROM_URL: "skill:installFromUrl",
		RECOMMEND: "llm:skillRecommend",
		EXPORT_ZIP: "skill:exportZip"
	};
	SKILLHUB_RPC_CHANNELS = {
		LIST: "skillhub:list",
		CATEGORIES: "skillhub:categories",
		SEARCH: "skillhub:search",
		DETAIL: "skillhub:detail",
		EXISTS: "skillhub:exists",
		INSTALL: "skillhub:install",
		REPORT_STATS: "skillhub:reportStats",
		INSTALLED_METAS: "skillhub:installedMetas"
	};
	KNOT_RPC_CHANNELS = {
		LIST: "knot:list",
		CATEGORIES: "knot:categories",
		TAGS: "knot:tags",
		SEARCH: "knot:search",
		DETAIL: "knot:detail",
		EXISTS: "knot:exists",
		INSTALL: "knot:install",
		REPORT_STATS: "knot:reportStats",
		INSTALLED_METAS: "knot:installedMetas",
		GET_BY_IDS: "knot:getByIds"
	};
	BUILTIN_MARKET_RPC_CHANNELS = {
		LIST: "builtin-market:list",
		GET_BY_IDS: "builtin-market:getByIds",
		DOWNLOAD_URL: "builtin-market:downloadUrl",
		CATEGORIES: "builtin-market:categories",
		INSTALL: "builtin-market:install",
		INSTALLED_METAS: "builtin-market:installedMetas",
		BACKFILL_SKILL_ID: "builtin-market:backfillSkillId",
		BACKFILL_ICON_SOURCE: "builtin-market:backfillIconSource",
		BACKFILL_DESCRIPTION: "builtin-market:backfillDescription",
		MIGRATE_DIRS_TO_SKILL_ID: "builtin-market:migrateDirsToSkillId"
	};
	ENTERPRISE_SKILLS_RPC_CHANNELS = {
		LIST: "enterpriseSkills:list",
		GET_CATEGORIES: "enterpriseSkills:getCategories",
		PROBE_VISIBILITY: "enterpriseSkills:probeVisibility",
		INSTALL: "enterpriseSkills:install"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/storage/contract.ts
var STORAGE_RPC_CHANNELS;
var init_contract$15 = __esmMin((() => {
	STORAGE_RPC_CHANNELS = {
		GET_SESSIONS: "storage:getSessions",
		UPSERT_SESSION: "storage:upsertSession",
		DELETE_SESSION: "storage:deleteSession",
		GET_WORKSPACES: "storage:getWorkspaces",
		UPDATE_SESSION_PERMISSION_MODE: "storage:updateSessionPermissionMode",
		GET_RECOVERY_NOTICE: "storage:getRecoveryNotice"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/system/contract.ts
var SYSTEM_RPC_CHANNELS;
var init_contract$14 = __esmMin((() => {
	SYSTEM_RPC_CHANNELS = {
		OPEN_EXTERNAL: "window:openExternal",
		OPEN_PATH: "window:openPath",
		READ_CLIPBOARD: "window:readClipboard",
		SHOW_ITEM_IN_FOLDER: "window:showItemInFolder",
		CHECK_SYSTEM_PERMISSIONS: "system:checkPermissions",
		REQUEST_NOTIFICATION_REGISTRATION: "system:requestNotificationRegistration",
		OPEN_YUANBAO: "system:openYuanbao",
		HAS_IMA_APP: "system:hasImaApp",
		OPEN_IMA_APP: "system:openImaApp"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/telemetry/contract.ts
var TELEMETRY_RPC_CHANNELS;
var init_contract$13 = __esmMin((() => {
	TELEMETRY_RPC_CHANNELS = {
		REPORT: "telemetry:report",
		REPORT_SYNC: "telemetry:reportSync",
		LIFECYCLE_LOG: "telemetry:lifecycleLog"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/tencent-docs/contract.ts
var DOCS_RPC_EX_CHANNELS;
var init_contract$12 = __esmMin((() => {
	DOCS_RPC_EX_CHANNELS = {
		GET_PREVIEW_URL: "docs:getPreviewUrl",
		RELEASE_PREVIEW_CONTEXT: "docs:releasePreviewContext",
		RELEASE_PREVIEW_CONTEXT_IF_CLEAN: "docs:releasePreviewContextIfClean",
		SAVE_PREVIEW_CONTEXT: "docs:savePreviewContext",
		PREVIEW_DOCUMENT_FROM_CONTENT: "docs:previewDocumentFromContent",
		SELECTION_CHANGED: "docs:selectionChanged",
		SELECTION_SEND: "docs:selectionSend"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/tencent-lexiang/contract.ts
var TENCENT_LEXIANG_RPC_CHANNELS;
var init_contract$11 = __esmMin((() => {
	TENCENT_LEXIANG_RPC_CHANNELS = {
		GATEWAY_POST: "tencentLexiang:gatewayPost",
		UPLOAD_LEXIANG_FILE: "tencentLexiang:uploadLexiangFile",
		UPLOAD_LEXIANG_FOLDER: "tencentLexiang:uploadLexiangFolder",
		UPLOAD_LEXIANG_HTML: "tencentLexiang:uploadLexiangHtml",
		CLEAR_WEB_COOKIES: "tencentLexiang:clearWebCookies",
		CHECK_LICENSE: "tencentLexiang:checkLicense",
		CHECK_COMPANY_STATUS: "tencentLexiang:checkCompanyStatus",
		SP_API_REQUEST: "tencentLexiang:spApiRequest",
		INVALIDATE_ACCESS_TOKEN: "tencentLexiang:invalidateAccessToken"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/tts/contract.ts
var TTS_RPC_CHANNELS;
var init_contract$10 = __esmMin((() => {
	TTS_RPC_CHANNELS = {
		START_TTS: "tts:startTts",
		STOP_TTS: "tts:stopTts",
		EVENT: "tts:event"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/update/contract.ts
var UPDATE_RPC_CHANNELS;
var init_contract$9 = __esmMin((() => {
	UPDATE_RPC_CHANNELS = {
		CHECK: "update:check",
		DOWNLOAD: "update:download",
		ARCH_MISMATCH_DOWNLOAD: "update:archMismatchDownload",
		ARCH_MISMATCH_INSTALL: "update:archMismatchInstall",
		QUIT_AND_INSTALL: "update:quitAndInstall",
		GET_STATE: "update:getState",
		STATE_CHANGED: "update:stateChanged"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/window/contract.ts
var WINDOW_RPC_CHANNELS;
var init_contract$8 = __esmMin((() => {
	WINDOW_RPC_CHANNELS = {
		MINIMIZE: "window:minimize",
		MAXIMIZE: "window:maximize",
		CLOSE: "window:close",
		IS_MAXIMIZED: "window:isMaximized",
		CANCEL_PENDING_CLOSE: "window:cancelPendingClose",
		CONFIRM_CLOSE: "window:confirmClose",
		SET_TRAFFIC_LIGHTS_VISIBLE: "window:setTrafficLightsVisible",
		OPEN_LOCAL_FILE: "window:openLocalFile",
		RELOAD: "window:reload",
		SAVE_LOCALE: "window:saveLocale",
		SAVE_DEFAULT_WORKSPACE_PATH: "window:saveDefaultWorkspacePath",
		CLOSE_AGENT_MANAGER: "window:closeAgentManager",
		SAVE_BUNDLED_RUNTIME_CONFIG: "window:saveBundledRuntimeConfig",
		GET_BUNDLED_RUNTIME_CONFIG: "window:getBundledRuntimeConfig",
		SET_FULLSCREEN: "window:setFullscreen",
		TOGGLE_FULLSCREEN: "window:toggleFullscreen"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/workspace/contract.ts
var WORKSPACE_RPC_CHANNELS;
var init_contract$7 = __esmMin((() => {
	WORKSPACE_RPC_CHANNELS = {
		GET_CURRENT: "workspace:getCurrent",
		GENERATE_DEFAULT_CWD: "workspace:generateDefaultCwd",
		GET_CLAW_CWD: "workspace:getClawCwd",
		INITIALIZE: "workspace:initialize",
		OPEN: "workspace:open",
		OPEN_FOLDER: "workspace:openFolder",
		SEARCH_FILE: "workspace:searchFile",
		CHECK_PATH_EXISTS: "workspace:checkPathExists",
		CHECK_PATHS_EXIST: "workspace:checkPathsExist",
		CHECK_ACCESS: "workspace:checkAccess"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/shared/ipc.ts
var IPC_RPC_CHANNELS;
var init_ipc = __esmMin((() => {
	IPC_RPC_CHANNELS = { EMIT: "ipc:emit" };
}));
//#endregion
//#region ../../packages/workbuddy-server/src/shared/channels.ts
var init_channels = __esmMin((() => {
	init_contract$46();
	init_contract$45();
	init_contract$44();
	init_contract$40();
	init_contract$39();
	init_contract$36();
	init_contract$34();
	init_contract$30();
	init_contract$29();
	init_contract$24();
	init_contract$22();
	init_contract$19();
	init_contract$17();
	init_contract$16();
	init_contract$15();
	init_contract$14();
	init_contract$13();
	init_contract$12();
	init_contract$9();
	init_contract$8();
	init_contract$7();
	init_ipc();
}));
//#endregion
//#region ../../packages/workbuddy-server/src/shared/index.ts
var init_shared = __esmMin((() => {
	init_channels();
}));
//#endregion
//#region ../../packages/workbuddy-server/src/compat/client.ts
var COMPATIBILITY_CHANNEL_MAP;
var init_client$32 = __esmMin((() => {
	init_channel_map_helpers();
	init_shared();
	COMPATIBILITY_CHANNEL_MAP = {
		ipcEmit: invoke(IPC_RPC_CHANNELS.EMIT),
		perfAppendLine: invoke(PERF_RPC_CHANNELS.APPEND_LINE),
		perfFlush: invoke(PERF_RPC_CHANNELS.FLUSH),
		perfGetLogFilePath: invoke(PERF_RPC_CHANNELS.GET_LOG_FILE_PATH),
		listSidecarSessions: invoke(SIDECAR_RPC_CHANNELS.LIST),
		resizeSidecar: invoke(SIDECAR_RPC_CHANNELS.RESIZE),
		listBackends: invoke(BACKEND_RPC_CHANNELS.LIST),
		telemetryReport: invoke(TELEMETRY_RPC_CHANNELS.REPORT),
		telemetryReportSync: invoke(TELEMETRY_RPC_CHANNELS.REPORT_SYNC),
		appLifecycleLog: invoke(TELEMETRY_RPC_CHANNELS.LIFECYCLE_LOG)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/config/client.ts
var CONFIG_CHANNEL_MAP;
var init_client$31 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$43();
	CONFIG_CHANNEL_MAP = {
		configGet: invoke(CONFIG_RPC_CHANNELS.GET),
		configSet: invoke(CONFIG_RPC_CHANNELS.SET),
		configGetAll: invoke(CONFIG_RPC_CHANNELS.GET_ALL),
		getProductScenes: invoke(CONFIG_RPC_CHANNELS.GET_PRODUCT_SCENES, 3e4),
		getProductConfiguration: invoke(CONFIG_RPC_CHANNELS.GET_PRODUCT_CONFIGURATION, 3e4),
		onProductConfigurationChanged: listener(CONFIG_RPC_CHANNELS.PRODUCT_CONFIGURATION_CHANGED),
		getClientMenus: invoke(CONFIG_RPC_CHANNELS.GET_CLIENT_MENUS),
		configGetLocalCustomModels: invoke(CONFIG_RPC_CHANNELS.GET_LOCAL_CUSTOM_MODELS),
		configSaveLocalCustomModel: invoke(CONFIG_RPC_CHANNELS.SAVE_LOCAL_CUSTOM_MODEL),
		configDeleteLocalCustomModel: invoke(CONFIG_RPC_CHANNELS.DELETE_LOCAL_CUSTOM_MODEL),
		configTestLocalCustomModel: invoke(CONFIG_RPC_CHANNELS.TEST_LOCAL_CUSTOM_MODEL, 35e3)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/connector/client.ts
var CONNECTOR_CHANNEL_MAP;
var init_client$30 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$42();
	CONNECTOR_CHANNEL_MAP = {
		connectorGetConnectors: invoke("connector:getConnectors"),
		connectorListRegistry: invoke("connector:listRegistry"),
		connectorListProjectConnectors: invoke("connector:listProjectConnectors"),
		connectorAddProjectConnector: invoke("connector:addProjectConnector"),
		connectorUpdateProjectConnectors: invoke("connector:updateProjectConnectors"),
		connectorRemoveProjectConnector: invoke("connector:removeProjectConnector"),
		connectorListTaskConnectors: invoke("connector:listTaskConnectors"),
		connectorSetTaskConnectorActiveStatus: invoke("connector:setTaskConnectorActiveStatus"),
		connectorAuthStart: invoke("connector:authStart"),
		connectorAuthConnect: invoke("connector:authConnect"),
		connectorAuthStatus: invoke("connector:authStatus"),
		connectorAuthRevoke: invoke("connector:authRevoke"),
		connectorAuthAccessToken: invoke("connector:authAccessToken"),
		connectorAuthTempLoginUrl: invoke("connector:authTempLoginUrl"),
		connectorGetRepoList: invoke("connector:getRepoList"),
		connectorGetOauthUser: invoke("connector:getOauthUser"),
		connectorInit: invoke(CONNECTOR_RPC_CHANNELS.INIT),
		connectorGetConfigs: invoke(CONNECTOR_RPC_CHANNELS.GET_CONFIGS),
		connectorGetStates: invoke(CONNECTOR_RPC_CHANNELS.GET_STATES),
		connectorConnectCustomMcpServer: invoke(CONNECTOR_RPC_CHANNELS.CONNECT_CUSTOM_MCP_SERVER),
		connectorConnect: invoke(CONNECTOR_RPC_CHANNELS.CONNECT, 360 * 1e3),
		connectorRepairConnect: invoke(CONNECTOR_RPC_CHANNELS.REPAIR_CONNECT, 360 * 1e3),
		connectorDisconnect: invoke(CONNECTOR_RPC_CHANNELS.DISCONNECT),
		connectorCancelConnect: invoke(CONNECTOR_RPC_CHANNELS.CANCEL_CONNECT),
		connectorUpdateHeaders: invoke(CONNECTOR_RPC_CHANNELS.UPDATE_HEADERS),
		connectorUpdateEnv: invoke(CONNECTOR_RPC_CHANNELS.UPDATE_ENV),
		connectorUnbind: invoke(CONNECTOR_RPC_CHANNELS.UNBIND),
		connectorHasOAuthToken: invoke(CONNECTOR_RPC_CHANNELS.HAS_OAUTH_TOKEN),
		connectorGetUserConnector: invoke(CONNECTOR_RPC_CHANNELS.GET_USER_CONNECTOR),
		connectorModifyConnectStatus: invoke(CONNECTOR_RPC_CHANNELS.MODIFY_CONNECT_STATUS),
		connectorModifyRepo: invoke(CONNECTOR_RPC_CHANNELS.MODIFY_REPO),
		connectorModifyActiveStatus: invoke(CONNECTOR_RPC_CHANNELS.MODIFY_ACTIVE_STATUS),
		connectorDeleteUserConnector: invoke(CONNECTOR_RPC_CHANNELS.DELETE_USER_CONNECTOR),
		connectorSaveOauthToken: invoke(CONNECTOR_RPC_CHANNELS.SAVE_OAUTH_TOKEN),
		connectorRevokeAll: invoke(CONNECTOR_RPC_CHANNELS.REVOKE_ALL),
		connectorGetFile: invoke(CONNECTOR_RPC_CHANNELS.GET_FILE),
		connectorAddTask: invoke(CONNECTOR_RPC_CHANNELS.ADD_TASK),
		connectorGetTaskConnector: invoke(CONNECTOR_RPC_CHANNELS.GET_TASK_CONNECTOR),
		connectorModifyTaskActiveStatus: invoke(CONNECTOR_RPC_CHANNELS.MODIFY_TASK_ACTIVE_STATUS),
		connectorModifyTaskRepo: invoke(CONNECTOR_RPC_CHANNELS.MODIFY_TASK_REPO),
		connectorOauthStart: invoke(CONNECTOR_RPC_CHANNELS.OAUTH_START),
		connectorOauthStatus: invoke(CONNECTOR_RPC_CHANNELS.OAUTH_STATUS),
		connectorOauthAccessToken: invoke(CONNECTOR_RPC_CHANNELS.OAUTH_ACCESS_TOKEN),
		connectorOauthRevoke: invoke(CONNECTOR_RPC_CHANNELS.OAUTH_REVOKE),
		connectorOauthConnect: invoke(CONNECTOR_RPC_CHANNELS.OAUTH_CONNECT),
		connectorOauthRepos: invoke(CONNECTOR_RPC_CHANNELS.OAUTH_REPOS),
		connectorOauthTempLoginUrl: invoke(CONNECTOR_RPC_CHANNELS.OAUTH_TEMP_LOGIN_URL),
		connectorEnterpriseTempLoginUrl: invoke(CONNECTOR_RPC_CHANNELS.OAUTH_ENTERPRISE_TEMP_LOGIN_URL),
		connectorRegistry2cList: invoke(CONNECTOR_RPC_CHANNELS.REGISTRY_2C_LIST),
		connectorResolvePoiConsent: invoke(CONNECTOR_RPC_CHANNELS.RESOLVE_POI_CONSENT),
		connectorCallTool: invoke(CONNECTOR_RPC_CHANNELS.CALL_TOOL, 3e4)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/credit-prediction/client.ts
var CREDIT_PREDICTION_CHANNEL_MAP;
var init_client$29 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$41();
	CREDIT_PREDICTION_CHANNEL_MAP = {
		creditPredictionPredict: invoke(CREDIT_PREDICTION_RPC_CHANNELS.PREDICT),
		creditPredictionCancel: invoke(CREDIT_PREDICTION_RPC_CHANNELS.CANCEL)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/data-retention/contract.ts
var DATA_RETENTION_RPC_CHANNELS, DATA_RETENTION_CHANNEL_MAP;
var init_contract$6 = __esmMin((() => {
	init_channel_map_helpers();
	DATA_RETENTION_RPC_CHANNELS = {
		GET_STORAGE_USAGE: "dataRetention:getStorageUsage",
		GET_DISK_INFO: "dataRetention:getDiskInfo",
		GET_POLICY: "dataRetention:getPolicy",
		SET_POLICY: "dataRetention:setPolicy",
		GET_LAST_CLEANUP_RESULT: "dataRetention:getLastCleanupResult"
	};
	DATA_RETENTION_CHANNEL_MAP = {
		dataRetentionGetStorageUsage: invoke(DATA_RETENTION_RPC_CHANNELS.GET_STORAGE_USAGE),
		dataRetentionGetDiskInfo: invoke(DATA_RETENTION_RPC_CHANNELS.GET_DISK_INFO),
		dataRetentionGetPolicy: invoke(DATA_RETENTION_RPC_CHANNELS.GET_POLICY),
		dataRetentionSetPolicy: invoke(DATA_RETENTION_RPC_CHANNELS.SET_POLICY),
		dataRetentionGetLastCleanupResult: invoke(DATA_RETENTION_RPC_CHANNELS.GET_LAST_CLEANUP_RESULT)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/enterprise-policy/contract.ts
var ENTERPRISE_POLICY_RPC_CHANNELS;
var init_contract$5 = __esmMin((() => {
	ENTERPRISE_POLICY_RPC_CHANNELS = {
		GET_SKILL_UPLOAD_POLICY: "enterprisePolicy:getSkillUploadPolicy",
		REFRESH_SKILL_UPLOAD_POLICY: "enterprisePolicy:refreshSkillUploadPolicy",
		GET_MEMBER_CUSTOM_MODEL_POLICY: "enterprisePolicy:getMemberCustomModelPolicy",
		REFRESH_MEMBER_CUSTOM_MODEL_POLICY: "enterprisePolicy:refreshMemberCustomModelPolicy"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/enterprise-policy/client.ts
var ENTERPRISE_POLICY_CHANNEL_MAP;
var init_client$28 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$5();
	ENTERPRISE_POLICY_CHANNEL_MAP = {
		enterprisePolicyGetSkillUploadPolicy: invoke(ENTERPRISE_POLICY_RPC_CHANNELS.GET_SKILL_UPLOAD_POLICY),
		enterprisePolicyRefreshSkillUploadPolicy: invoke(ENTERPRISE_POLICY_RPC_CHANNELS.REFRESH_SKILL_UPLOAD_POLICY),
		enterprisePolicyGetMemberCustomModelPolicy: invoke(ENTERPRISE_POLICY_RPC_CHANNELS.GET_MEMBER_CUSTOM_MODEL_POLICY),
		enterprisePolicyRefreshMemberCustomModelPolicy: invoke(ENTERPRISE_POLICY_RPC_CHANNELS.REFRESH_MEMBER_CUSTOM_MODEL_POLICY)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/expert/client.ts
var EXPERT_CHANNEL_MAP;
var init_client$27 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$38();
	EXPERT_CHANNEL_MAP = {
		expertInit: invoke(EXPERT_RPC_CHANNELS.INIT),
		expertGetCategories: invoke(EXPERT_RPC_CHANNELS.GET_CATEGORIES),
		expertGetExperts: invoke(EXPERT_RPC_CHANNELS.GET_EXPERTS),
		expertGetFeaturedScenes: invoke(EXPERT_RPC_CHANNELS.GET_FEATURED_SCENES),
		expertGetExpert: invoke(EXPERT_RPC_CHANNELS.GET_EXPERT),
		expertGetUseRequirements: invoke(EXPERT_RPC_CHANNELS.GET_USE_REQUIREMENTS),
		expertGetAgentTemplates: invoke(EXPERT_RPC_CHANNELS.GET_AGENT_TEMPLATES),
		expertRefresh: invoke(EXPERT_RPC_CHANNELS.REFRESH),
		expertSummonExpert: invoke("expert:summonExpert"),
		expertHistoryGetRecent: invoke(EXPERT_HISTORY_RPC_CHANNELS.GET_RECENT),
		expertHistoryAdd: invoke(EXPERT_HISTORY_RPC_CHANNELS.ADD),
		expertHistoryRemove: invoke(EXPERT_HISTORY_RPC_CHANNELS.REMOVE),
		expertHistoryClear: invoke(EXPERT_HISTORY_RPC_CHANNELS.CLEAR),
		expertActivatePlugin: invoke(EXPERT_RPC_CHANNELS.ACTIVATE_PLUGIN),
		expertDeactivatePlugin: invoke(EXPERT_RPC_CHANNELS.DEACTIVATE_PLUGIN),
		expertGetActivePlugins: invoke(EXPERT_RPC_CHANNELS.GET_ACTIVE_PLUGINS),
		expertSwitchPluginForSession: invoke(EXPERT_RPC_CHANNELS.SWITCH_PLUGIN_FOR_SESSION),
		expertExportZip: invoke(EXPERT_RPC_CHANNELS.EXPORT_ZIP),
		expertPreCheckShare: invoke(EXPERT_RPC_CHANNELS.PRE_CHECK_SHARE),
		expertQueryShareSecurityScan: invoke(EXPERT_RPC_CHANNELS.QUERY_SHARE_SECURITY_SCAN),
		expertImportFromUrl: invoke(EXPERT_RPC_CHANNELS.IMPORT_FROM_URL),
		expertInstallFromPath: invoke(EXPERT_RPC_CHANNELS.INSTALL_FROM_PATH),
		expertPreviewFromUrl: invoke(EXPERT_RPC_CHANNELS.PREVIEW_FROM_URL),
		expertScanCustomExperts: invoke(EXPERT_RPC_CHANNELS.SCAN_CUSTOM_EXPERTS),
		expertGetCustomExpert: invoke(EXPERT_RPC_CHANNELS.GET_CUSTOM_EXPERT),
		expertDeleteCustomExpert: invoke(EXPERT_RPC_CHANNELS.DELETE_CUSTOM_EXPERT),
		expertAddUserExperts: invoke(EXPERT_RPC_CHANNELS.ADD_USER_EXPERTS),
		expertClearCustomExpertSessionMarker: invoke(EXPERT_RPC_CHANNELS.CLEAR_CUSTOM_EXPERT_SESSION_MARKER)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/feedback/client.ts
var FEEDBACK_CHANNEL_MAP;
var init_client$26 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$37();
	FEEDBACK_CHANNEL_MAP = { feedbackSubmit: invoke(FEEDBACK_RPC_CHANNELS.SUBMIT) };
}));
//#endregion
//#region ../../packages/workbuddy-server/src/file-system/client.ts
var FILE_SYSTEM_CHANNEL_MAP;
var init_client$25 = __esmMin((() => {
	init_channel_map_helpers();
	init_shared();
	FILE_SYSTEM_CHANNEL_MAP = {
		fileRead: invoke(FILE_RPC_CHANNELS.READ, 300 * 1e3),
		fileWrite: invoke(FILE_RPC_CHANNELS.WRITE),
		fileWriteBatch: invoke(FILE_RPC_CHANNELS.WRITE_BATCH),
		fileListDir: invoke(FILE_RPC_CHANNELS.LIST_DIR),
		fileExists: invoke(FILE_RPC_CHANNELS.EXISTS),
		fileMakeDir: invoke(FILE_RPC_CHANNELS.MAKE_DIR),
		fileRemove: invoke(FILE_RPC_CHANNELS.REMOVE),
		fileRename: invoke(FILE_RPC_CHANNELS.RENAME),
		fileGetInfo: invoke(FILE_RPC_CHANNELS.GET_INFO),
		fileSearch: invoke(FILE_RPC_CHANNELS.SEARCH),
		fileUpload: invoke(FILE_RPC_CHANNELS.UPLOAD),
		fileReadChunked: invoke(FILE_RPC_CHANNELS.READ_CHUNKED, 60 * 1e3),
		ioAppendRecord: invoke(IO_RPC_CHANNELS.APPEND_RECORD),
		workspaceInitialize: invoke(WORKSPACE_RPC_CHANNELS.INITIALIZE),
		workspaceGetCurrent: invoke(WORKSPACE_RPC_CHANNELS.GET_CURRENT),
		workspaceGenerateDefaultCwd: invoke(WORKSPACE_RPC_CHANNELS.GENERATE_DEFAULT_CWD),
		workspaceGetClawCwd: invoke(WORKSPACE_RPC_CHANNELS.GET_CLAW_CWD),
		workspaceOpen: invoke(WORKSPACE_RPC_CHANNELS.OPEN),
		workspaceOpenFolder: invoke(WORKSPACE_RPC_CHANNELS.OPEN_FOLDER),
		workspaceSearchFile: invoke(WORKSPACE_RPC_CHANNELS.SEARCH_FILE),
		workspaceCheckPathExists: invoke(WORKSPACE_RPC_CHANNELS.CHECK_PATH_EXISTS),
		workspaceCheckPathsExist: invoke(WORKSPACE_RPC_CHANNELS.CHECK_PATHS_EXIST),
		workspaceCheckAccess: invoke(WORKSPACE_RPC_CHANNELS.CHECK_ACCESS),
		storageGetSessions: invoke(STORAGE_RPC_CHANNELS.GET_SESSIONS),
		storageUpsertSession: invoke(STORAGE_RPC_CHANNELS.UPSERT_SESSION),
		storageDeleteSession: invoke(STORAGE_RPC_CHANNELS.DELETE_SESSION),
		storageGetWorkspaces: invoke(STORAGE_RPC_CHANNELS.GET_WORKSPACES),
		storageUpdateSessionPermissionMode: invoke(STORAGE_RPC_CHANNELS.UPDATE_SESSION_PERMISSION_MODE),
		storageGetRecoveryNotice: invoke(STORAGE_RPC_CHANNELS.GET_RECOVERY_NOTICE),
		reportRuntimeEvent: invoke(SESSION_RPC_CHANNELS.REPORT_RUNTIME_EVENT)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/growth/client.ts
var GROWTH_CHANNEL_MAP;
var init_client$24 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$35();
	GROWTH_CHANNEL_MAP = { growthGetBuddy: invoke(GROWTH_RPC_CHANNELS.GET_BUDDY) };
}));
//#endregion
//#region ../../packages/workbuddy-server/src/idle-capability/client.ts
var IDLE_CAPABILITY_CHANNEL_MAP;
var init_client$23 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$33();
	IDLE_CAPABILITY_CHANNEL_MAP = {
		idleCapabilityRecordUsage: invoke(IDLE_CAPABILITY_RPC_CHANNELS.RECORD_USAGE),
		idleCapabilityRecordActiveDay: invoke(IDLE_CAPABILITY_RPC_CHANNELS.RECORD_ACTIVE_DAY),
		idleCapabilityGetIdleCardData: invoke(IDLE_CAPABILITY_RPC_CHANNELS.GET_IDLE_CARD_DATA),
		idleCapabilityMarkShown: invoke(IDLE_CAPABILITY_RPC_CHANNELS.MARK_SHOWN),
		idleCapabilityDismiss: invoke(IDLE_CAPABILITY_RPC_CHANNELS.DISMISS),
		idleCapabilityDismissGlobal: invoke(IDLE_CAPABILITY_RPC_CHANNELS.DISMISS_GLOBAL),
		idleCapabilityForgetCapability: invoke(IDLE_CAPABILITY_RPC_CHANNELS.FORGET_CAPABILITY),
		idleCapabilityListCandidates: invoke(IDLE_CAPABILITY_RPC_CHANNELS.LIST_CANDIDATES)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/ima/client.ts
var IMA_CHANNEL_MAP;
var init_client$22 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$32();
	IMA_CHANNEL_MAP = {
		imaAuthStart: invoke(IMA_RPC_CHANNELS.AUTH_START),
		imaAuthStatus: invoke(IMA_RPC_CHANNELS.AUTH_STATUS),
		imaAuthRefresh: invoke(IMA_RPC_CHANNELS.AUTH_REFRESH),
		imaAuthLogout: invoke(IMA_RPC_CHANNELS.AUTH_LOGOUT),
		imaKbList: invoke(IMA_RPC_CHANNELS.KB_LIST),
		imaKbSearch: invoke(IMA_RPC_CHANNELS.KB_SEARCH),
		imaKbInfoByShareLink: invoke(IMA_RPC_CHANNELS.KB_INFO_BY_SHARE_LINK),
		imaFilesList: invoke(IMA_RPC_CHANNELS.FILES_LIST),
		imaFilesSearch: invoke(IMA_RPC_CHANNELS.FILES_SEARCH),
		imaFilesViewUrl: invoke(IMA_RPC_CHANNELS.FILES_VIEW_URL),
		imaFilesDownloadUrl: invoke(IMA_RPC_CHANNELS.FILES_DOWNLOAD_URL),
		imaFilesContent: invoke(IMA_RPC_CHANNELS.FILES_CONTENT),
		imaFilesBlob: invoke(IMA_RPC_CHANNELS.FILES_BLOB),
		imaFilesUpload: invoke(IMA_RPC_CHANNELS.FILES_UPLOAD),
		imaFilesCancelUpload: invoke(IMA_RPC_CHANNELS.FILES_CANCEL_UPLOAD),
		imaFilesUploadByPath: invoke(IMA_RPC_CHANNELS.FILES_UPLOAD_BY_PATH),
		imaFilesSdkPreview: invoke(IMA_RPC_CHANNELS.FILES_SDK_PREVIEW),
		imaOnUploadProgress: listener(IMA_RPC_CHANNELS.UPLOAD_PROGRESS)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/inspiration/client.ts
var INSPIRATION_CHANNEL_MAP;
var init_client$21 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$31();
	INSPIRATION_CHANNEL_MAP = {
		inspirationList: invoke(INSPIRATION_RPC_CHANNELS.LIST),
		inspirationDetail: invoke(INSPIRATION_RPC_CHANNELS.DETAIL),
		inspirationSettingsGet: invoke(INSPIRATION_RPC_CHANNELS.SETTINGS_GET),
		inspirationSettingsSave: invoke(INSPIRATION_RPC_CHANNELS.SETTINGS_SAVE),
		inspirationOnboardingCheck: invoke(INSPIRATION_RPC_CHANNELS.ONBOARDING_CHECK),
		inspirationOnboardingComplete: invoke(INSPIRATION_RPC_CHANNELS.ONBOARDING_COMPLETE),
		inspirationFeedback: invoke(INSPIRATION_RPC_CHANNELS.FEEDBACK),
		inspirationMarkRead: invoke(INSPIRATION_RPC_CHANNELS.MARK_READ),
		inspirationMarkAllRead: invoke(INSPIRATION_RPC_CHANNELS.MARK_ALL_READ),
		inspirationSave: invoke(INSPIRATION_RPC_CHANNELS.SAVE),
		inspirationRecordTabView: invoke(INSPIRATION_RPC_CHANNELS.RECORD_TAB_VIEW),
		inspirationInjectDemo: invoke(INSPIRATION_RPC_CHANNELS.INJECT_DEMO),
		inspirationCurationList: invoke(INSPIRATION_CURATION_RPC_CHANNELS.LIST),
		inspirationCurationAdd: invoke(INSPIRATION_CURATION_RPC_CHANNELS.ADD),
		inspirationCurationUpdate: invoke(INSPIRATION_CURATION_RPC_CHANNELS.UPDATE),
		inspirationCurationDelete: invoke(INSPIRATION_CURATION_RPC_CHANNELS.DELETE)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/mcp-apps/static-html-client.ts
var STATIC_HTML_RPC_CHANNELS, STATIC_HTML_CHANNEL_MAP;
var init_static_html_client = __esmMin((() => {
	init_channel_map_helpers();
	STATIC_HTML_RPC_CHANNELS = { REGISTER_DIR: "staticHtml:registerDir" };
	STATIC_HTML_CHANNEL_MAP = { staticHtmlRegisterDir: invoke(STATIC_HTML_RPC_CHANNELS.REGISTER_DIR) };
}));
//#endregion
//#region ../../packages/workbuddy-server/src/microphone/client.ts
var MICROPHONE_CHANNEL_MAP;
var init_client$20 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$27();
	MICROPHONE_CHANNEL_MAP = {
		getMicrophonePermission: invoke(MICROPHONE_RPC_CHANNELS.GET_PERMISSION),
		requestMicrophonePermission: invoke(MICROPHONE_RPC_CHANNELS.REQUEST_PERMISSION),
		openMicrophoneSystemSettings: invoke(MICROPHONE_RPC_CHANNELS.OPEN_SYSTEM_SETTINGS),
		onMicrophonePermissionChanged: listener(MICROPHONE_RPC_CHANNELS.PERMISSION_CHANGED)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/migration/client.ts
var MIGRATION_CHANNEL_MAP;
var init_client$19 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$26();
	MIGRATION_CHANNEL_MAP = {
		migrationGetHistoryStatus: invoke(MIGRATION_RPC_CHANNELS.GET_HISTORY_STATUS),
		onMigrationHistoryStatusUpdate: listener(MIGRATION_RPC_CHANNELS.HISTORY_STATUS_UPDATE),
		onMigrationHistoryProgress: listener(MIGRATION_RPC_CHANNELS.HISTORY_PROGRESS)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/my-files/client.ts
var MY_FILES_CHANNEL_MAP;
var init_client$18 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$25();
	MY_FILES_CHANNEL_MAP = {
		myFilesGetTaskArtifacts: invoke(MY_FILES_RPC_CHANNELS.GET_TASK_ARTIFACTS),
		getNetDriveAccessToken: invoke(MY_FILES_RPC_CHANNELS.GET_NETDRIVE_ACCESS_TOKEN),
		getNetDriveNicknames: invoke(MY_FILES_RPC_CHANNELS.GET_NETDRIVE_NICKNAMES),
		getNetDrivePurchaseCode: invoke(MY_FILES_RPC_CHANNELS.GET_NETDRIVE_PURCHASE_CODE),
		getNetDriveEnterpriseInfo: invoke(MY_FILES_RPC_CHANNELS.GET_NETDRIVE_ENTERPRISE_INFO),
		myFilesUploadToDrive: invoke(MY_FILES_RPC_CHANNELS.UPLOAD_TO_DRIVE),
		downloadFileToLocal: invoke(MY_FILES_RPC_CHANNELS.DOWNLOAD_FILE_TO_LOCAL),
		cleanupDownloadedTemporaryFile: invoke(MY_FILES_RPC_CHANNELS.CLEANUP_DOWNLOADED_TEMPORARY_FILE),
		reportFileEvents: invoke(MY_FILES_RPC_CHANNELS.REPORT_FILE_EVENTS),
		myFilesGetFilePaths: invoke(MY_FILES_RPC_CHANNELS.GET_FILE_PATHS)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/plugin/client.ts
var PLUGIN_CHANNEL_MAP;
var init_client$17 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$23();
	PLUGIN_CHANNEL_MAP = {
		batchTogglePlugins: invoke(PLUGIN_RPC_CHANNELS.BATCH_TOGGLE),
		getInstalledPlugins: invoke(PLUGIN_RPC_CHANNELS.GET_INSTALLED),
		installPlugins: invoke(PLUGIN_RPC_CHANNELS.INSTALL),
		uninstallPlugin: invoke(PLUGIN_RPC_CHANNELS.UNINSTALL),
		updatePlugin: invoke(PLUGIN_RPC_CHANNELS.UPDATE),
		getPluginMarketplaces: invoke(PLUGIN_RPC_CHANNELS.GET_MARKETPLACES),
		getMarketplacePlugins: invoke(PLUGIN_RPC_CHANNELS.GET_MARKETPLACE_PLUGINS),
		getPluginDetail: invoke(PLUGIN_RPC_CHANNELS.GET_DETAIL),
		addPluginMarketplace: invoke(PLUGIN_RPC_CHANNELS.ADD_MARKETPLACE),
		removePluginMarketplace: invoke(PLUGIN_RPC_CHANNELS.REMOVE_MARKETPLACE),
		refreshPluginMarketplace: invoke(PLUGIN_RPC_CHANNELS.REFRESH_MARKETPLACE),
		setMarketplaceAutoUpdate: invoke(PLUGIN_RPC_CHANNELS.SET_MARKETPLACE_AUTO_UPDATE),
		onPluginsChanged: listener(PLUGIN_RPC_CHANNELS.CHANGED)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/plugin-recommendation/contract.ts
var PLUGIN_RECOMMENDATION_RPC_CHANNELS;
var init_contract$4 = __esmMin((() => {
	PLUGIN_RECOMMENDATION_RPC_CHANNELS = { ANSWER: "session:answerPluginRecommendation" };
}));
//#endregion
//#region ../../packages/workbuddy-server/src/plugin-recommendation/client.ts
var PLUGIN_RECOMMENDATION_CHANNEL_MAP;
var init_client$16 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$4();
	PLUGIN_RECOMMENDATION_CHANNEL_MAP = { answerPluginRecommendation: invoke(PLUGIN_RECOMMENDATION_RPC_CHANNELS.ANSWER) };
}));
//#endregion
//#region ../../packages/workbuddy-server/src/poi/contract.ts
var POI_RPC_CHANNELS;
var init_contract$3 = __esmMin((() => {
	POI_RPC_CHANNELS = {
		IP_LOCATE: "poi:ipLocate",
		GEOCODE: "poi:geocode",
		SUGGESTION: "poi:suggestion",
		GET_ADDRESS_LIST: "poi:getAddressList",
		CREATE_ADDRESS: "poi:createAddress",
		UPDATE_ADDRESS: "poi:updateAddress",
		DELETE_ADDRESS: "poi:deleteAddress",
		SET_DEFAULT_ADDRESS: "poi:setDefaultAddress"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/poi/client.ts
var POI_CHANNEL_MAP;
var init_client$15 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$3();
	POI_CHANNEL_MAP = {
		poiIpLocate: invoke(POI_RPC_CHANNELS.IP_LOCATE),
		poiGeocode: invoke(POI_RPC_CHANNELS.GEOCODE),
		poiSuggestion: invoke(POI_RPC_CHANNELS.SUGGESTION),
		poiGetAddressList: invoke(POI_RPC_CHANNELS.GET_ADDRESS_LIST),
		poiCreateAddress: invoke(POI_RPC_CHANNELS.CREATE_ADDRESS),
		poiUpdateAddress: invoke(POI_RPC_CHANNELS.UPDATE_ADDRESS),
		poiDeleteAddress: invoke(POI_RPC_CHANNELS.DELETE_ADDRESS),
		poiSetDefaultAddress: invoke(POI_RPC_CHANNELS.SET_DEFAULT_ADDRESS)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/proxy-settings/client.ts
var PROXY_SETTINGS_CHANNEL_MAP;
var init_client$14 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$21();
	PROXY_SETTINGS_CHANNEL_MAP = {
		getProxySettings: invoke(PROXY_SETTINGS_RPC_CHANNELS.GET_SETTINGS),
		saveProxySettings: invoke(PROXY_SETTINGS_RPC_CHANNELS.SAVE_SETTINGS),
		testProxyConnection: invoke(PROXY_SETTINGS_RPC_CHANNELS.TEST_CONNECTION)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/sandbox/client.ts
var SANDBOX_CHANNEL_MAP;
var init_client$13 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$20();
	SANDBOX_CHANNEL_MAP = {
		sandboxRespondToIntercept: invoke(SANDBOX_RPC_CHANNELS.RESPOND_TO_INTERCEPT),
		onSandboxInterceptRequest: listener(SANDBOX_RPC_CHANNELS.INTERCEPT_REQUEST),
		sandboxPreviewRegisterMount: invoke(SANDBOX_RPC_CHANNELS.REGISTER_MOUNT)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/security-center/contract.ts
var SECURITY_CENTER_RPC_CHANNELS;
var init_contract$2 = __esmMin((() => {
	SECURITY_CENTER_RPC_CHANNELS = {
		GET_STATE: "securityCenter:getState",
		SAVE_SANDBOX_RULES_CONFIG: "securityCenter:saveSandboxRulesConfig",
		SAVE_SANDBOX_SAFETY_ENABLED: "securityCenter:saveSandboxSafetyEnabled",
		CLEAR_AUDIT_LOG: "securityCenter:clearAuditLog",
		QUERY_AUDIT_LOG: "securityCenter:queryAuditLog",
		EXPORT_AUDIT_LOG: "securityCenter:exportAuditLog",
		SAVE_EXPERIMENTAL_FEATURES_CONFIG: "securityCenter:saveExperimentalFeaturesConfig",
		GET_EXPERIMENTAL_FEATURES_CONFIG: "securityCenter:getExperimentalFeaturesConfig",
		OPEN_MODIFY_BACKUP_DIR: "securityCenter:openModifyBackupDir"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/security-center/client.ts
var SECURITY_CENTER_CHANNEL_MAP;
var init_client$12 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$2();
	SECURITY_CENTER_CHANNEL_MAP = {
		securityCenterGetState: invoke(SECURITY_CENTER_RPC_CHANNELS.GET_STATE),
		securityCenterSaveSandboxRulesConfig: invoke(SECURITY_CENTER_RPC_CHANNELS.SAVE_SANDBOX_RULES_CONFIG),
		securityCenterSaveSandboxSafetyEnabled: invoke(SECURITY_CENTER_RPC_CHANNELS.SAVE_SANDBOX_SAFETY_ENABLED),
		securityCenterClearAuditLog: invoke(SECURITY_CENTER_RPC_CHANNELS.CLEAR_AUDIT_LOG),
		securityCenterQueryAuditLog: invoke(SECURITY_CENTER_RPC_CHANNELS.QUERY_AUDIT_LOG),
		securityCenterExportAuditLog: invoke(SECURITY_CENTER_RPC_CHANNELS.EXPORT_AUDIT_LOG),
		securityCenterSaveExperimentalFeaturesConfig: invoke(SECURITY_CENTER_RPC_CHANNELS.SAVE_EXPERIMENTAL_FEATURES_CONFIG),
		securityCenterGetExperimentalFeaturesConfig: invoke(SECURITY_CENTER_RPC_CHANNELS.GET_EXPERIMENTAL_FEATURES_CONFIG),
		securityCenterOpenModifyBackupDir: invoke(SECURITY_CENTER_RPC_CHANNELS.OPEN_MODIFY_BACKUP_DIR)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/session/client.ts
var SESSION_CHANNEL_MAP;
var init_client$11 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$19();
	SESSION_CHANNEL_MAP = {
		createSession: invoke(SESSION_RPC_CHANNELS.CREATE),
		destroySession: invoke(SESSION_RPC_CHANNELS.DESTROY),
		deleteSession: invoke(SESSION_RPC_CHANNELS.DELETE),
		listSessions: invoke(SESSION_RPC_CHANNELS.LIST),
		loadSession: invoke(SESSION_RPC_CHANNELS.LOAD),
		prompt: invoke(SESSION_RPC_CHANNELS.SEND_MESSAGE),
		cancel: invoke(SESSION_RPC_CHANNELS.CANCEL),
		respondToPermission: invoke(SESSION_RPC_CHANNELS.RESOLVE_PERMISSION),
		rejectPermission: invoke(SESSION_RPC_CHANNELS.REJECT_PERMISSION),
		resolveInterruption: invoke(SESSION_RPC_CHANNELS.RESOLVE_INTERRUPTION),
		getSession: invoke(SESSION_RPC_CHANNELS.GET),
		getSessionTeamRuntime: invoke(SESSION_RPC_CHANNELS.GET_TEAM_RUNTIME),
		archiveSession: invoke(SESSION_RPC_CHANNELS.ARCHIVE),
		renameSession: invoke(SESSION_RPC_CHANNELS.RENAME),
		moveSession: invoke(SESSION_RPC_CHANNELS.MOVE),
		updateSessionStatus: invoke(SESSION_RPC_CHANNELS.UPDATE_STATUS),
		getAvailableCommands: invoke(SESSION_RPC_CHANNELS.GET_AVAILABLE_COMMANDS),
		getSubagentList: invoke(SESSION_RPC_CHANNELS.GET_SUBAGENT_LIST),
		respondToSampling: invoke(SESSION_RPC_CHANNELS.RESPOND_TO_SAMPLING),
		respondToRoots: invoke(SESSION_RPC_CHANNELS.RESPOND_TO_ROOTS),
		requestYield: invoke(SESSION_RPC_CHANNELS.REQUEST_YIELD),
		getMessageQueue: invoke(SESSION_RPC_CHANNELS.GET_MESSAGE_QUEUE),
		saveMessageQueue: invoke(SESSION_RPC_CHANNELS.SAVE_MESSAGE_QUEUE),
		enqueueMessage: invoke(SESSION_RPC_CHANNELS.ENQUEUE_MESSAGE),
		removeQueueItem: invoke(SESSION_RPC_CHANNELS.REMOVE_QUEUE_ITEM),
		popQueueItemForEdit: invoke(SESSION_RPC_CHANNELS.POP_QUEUE_ITEM_FOR_EDIT),
		reorderQueue: invoke(SESSION_RPC_CHANNELS.REORDER_QUEUE),
		sendQueueItemNow: invoke(SESSION_RPC_CHANNELS.SEND_QUEUE_ITEM_NOW),
		activateQueue: invoke(SESSION_RPC_CHANNELS.ACTIVATE_QUEUE),
		pauseQueue: invoke(SESSION_RPC_CHANNELS.PAUSE_QUEUE),
		resumeQueue: invoke(SESSION_RPC_CHANNELS.RESUME_QUEUE),
		cancelQueue: invoke(SESSION_RPC_CHANNELS.CANCEL_QUEUE),
		getQueueState: invoke(SESSION_RPC_CHANNELS.GET_QUEUE_STATE),
		setSessionMode: invoke(SESSION_RPC_CHANNELS.SET_MODE),
		setSessionModel: invoke(SESSION_RPC_CHANNELS.SET_MODEL),
		setSessionConfigOption: invoke(SESSION_RPC_CHANNELS.SET_CONFIG_OPTION),
		updateSessionConfig: invoke(SESSION_RPC_CHANNELS.UPDATE_CONFIG),
		answerQuestion: invoke(SESSION_RPC_CHANNELS.ANSWER_QUESTION),
		cancelQuestion: invoke(SESSION_RPC_CHANNELS.CANCEL_QUESTION),
		answerPoiQuestion: invoke(SESSION_RPC_CHANNELS.ANSWER_POI_QUESTION),
		pushSessionPoi: invoke(SESSION_RPC_CHANNELS.PUSH_SESSION_POI),
		respondElicitation: invoke(SESSION_RPC_CHANNELS.RESPOND_ELICITATION),
		onSessionUpserted: listener(SESSION_RPC_CHANNELS.UPSERTED),
		onSessionDeleted: listener(SESSION_RPC_CHANNELS.DELETED),
		onSessionEvent: listener(SESSION_RPC_CHANNELS.EVENT),
		onSessionNavigate: listener(SESSION_RPC_CHANNELS.NAVIGATE),
		notifyPermissionPendingApproval: invoke(SESSION_RPC_CHANNELS.NOTIFY_PERMISSION_PENDING_APPROVAL),
		notifyPermissionResolvedFromLocal: invoke(SESSION_RPC_CHANNELS.NOTIFY_PERMISSION_RESOLVED_FROM_LOCAL),
		notifyListenerReady: invoke(SESSION_RPC_CHANNELS.NOTIFY_LISTENER_READY),
		getPersistedUsage: invoke(SESSION_RPC_CHANNELS.GET_PERSISTED_USAGE),
		getLastUsageEvent: invoke(SESSION_RPC_CHANNELS.GET_LAST_USAGE_EVENT),
		sessionRollback: invoke(SESSION_RPC_CHANNELS.ROLLBACK)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/share/client.ts
var SHARE_CHANNEL_MAP;
var init_client$10 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$18();
	SHARE_CHANNEL_MAP = {
		shareUploadFile: invoke(SHARE_RPC_CHANNELS.UPLOAD_FILE),
		shareUploadImage: invoke(SHARE_RPC_CHANNELS.UPLOAD_IMAGE),
		shareUploadToKnowledge: invoke(SHARE_RPC_CHANNELS.UPLOAD_TO_KNOWLEDGE),
		shareCreateLink: invoke(SHARE_RPC_CHANNELS.CREATE_LINK),
		shareGetList: invoke(SHARE_RPC_CHANNELS.GET_LIST),
		shareDownloadFile: invoke(SHARE_RPC_CHANNELS.DOWNLOAD_FILE),
		shareSetEnabled: invoke(SHARE_RPC_CHANNELS.SET_ENABLED),
		shareGetDetail: invoke(SHARE_RPC_CHANNELS.GET_DETAIL),
		shareVerify: invoke(SHARE_RPC_CHANNELS.VERIFY),
		sharePrepareTask: invoke(SHARE_RPC_CHANNELS.PREPARE_TASK),
		shareUploadTaskFile: invoke(SHARE_RPC_CHANNELS.UPLOAD_TASK_FILE),
		shareConfirmTask: invoke(SHARE_RPC_CHANNELS.CONFIRM_TASK),
		shareCancelTask: invoke(SHARE_RPC_CHANNELS.CANCEL_TASK),
		shareGetTaskList: invoke(SHARE_RPC_CHANNELS.GET_TASK_LIST),
		shareDeleteTask: invoke(SHARE_RPC_CHANNELS.DELETE_TASK),
		shareGenerateWxMPQRCode: invoke(SHARE_RPC_CHANNELS.GENERATE_WXMP_QRCODE),
		shareBatchMoveKnowledgeNodes: invoke(SHARE_RPC_CHANNELS.BATCH_MOVE_KNOWLEDGE_NODES),
		shareInvitePermission: invoke(SHARE_RPC_CHANNELS.INVITE_PERMISSION),
		shareSetPermission: invoke(SHARE_RPC_CHANNELS.SET_PERMISSION),
		shareGetPermission: invoke(SHARE_RPC_CHANNELS.GET_PERMISSION),
		shareGetCollaborators: invoke(SHARE_RPC_CHANNELS.GET_COLLABORATORS),
		shareSetMemberPermission: invoke(SHARE_RPC_CHANNELS.SET_MEMBER_PERMISSION),
		shareQueryPageInfo: invoke(SHARE_RPC_CHANNELS.QUERY_PAGE_INFO),
		shareGetNodeInfo: invoke(SHARE_RPC_CHANNELS.GET_NODE_INFO),
		sharePublishPage: invoke(SHARE_RPC_CHANNELS.PUBLISH_PAGE),
		shareUnpublishPage: invoke(SHARE_RPC_CHANNELS.UNPUBLISH_PAGE),
		shareUploadLocalFileToCos: invoke(SHARE_RPC_CHANNELS.UPLOAD_LOCAL_FILE_TO_COS),
		shareQueryImportProgress: invoke(SHARE_RPC_CHANNELS.QUERY_IMPORT_PROGRESS),
		shareUploadShareTemplate: invoke(SHARE_RPC_CHANNELS.UPLOAD_SHARE_TEMPLATE)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/skill/client.ts
var SKILLS_CHANNEL_MAP;
var init_client$9 = __esmMin((() => {
	init_channel_map_helpers();
	init_shared();
	SKILLS_CHANNEL_MAP = {
		skillList: invoke(SKILL_RPC_CHANNELS.LIST),
		skillImport: invoke(SKILL_RPC_CHANNELS.IMPORT),
		skillToggle: invoke(SKILL_RPC_CHANNELS.TOGGLE),
		skillBatchToggle: invoke(SKILL_RPC_CHANNELS.BATCH_TOGGLE),
		skillDelete: invoke(SKILL_RPC_CHANNELS.DELETE),
		skillContent: invoke(SKILL_RPC_CHANNELS.CONTENT),
		skillInstallByPath: invoke(SKILL_RPC_CHANNELS.INSTALL_BY_PATH),
		skillPrepareFromUrl: invoke(SKILL_RPC_CHANNELS.PREPARE_FROM_URL),
		skillGetContent: invoke(SKILL_RPC_CHANNELS.GET_CONTENT),
		skillGetMarketplace: invoke(SKILL_RPC_CHANNELS.GET_MARKETPLACE),
		skillGetMarketplaceContent: invoke(SKILL_RPC_CHANNELS.GET_MARKETPLACE_CONTENT),
		skillInstallMarketplace: invoke(SKILL_RPC_CHANNELS.INSTALL_MARKETPLACE),
		skillQueryScanResult: invoke(SKILL_RPC_CHANNELS.QUERY_SCAN_RESULT),
		skillInstallFromUrl: invoke(SKILL_RPC_CHANNELS.INSTALL_FROM_URL),
		skillRecommend: invoke(SKILL_RPC_CHANNELS.RECOMMEND),
		skillExportZip: invoke(SKILL_RPC_CHANNELS.EXPORT_ZIP),
		skillhubList: invoke(SKILLHUB_RPC_CHANNELS.LIST),
		skillhubCategories: invoke(SKILLHUB_RPC_CHANNELS.CATEGORIES),
		skillhubSearch: invoke(SKILLHUB_RPC_CHANNELS.SEARCH),
		skillhubDetail: invoke(SKILLHUB_RPC_CHANNELS.DETAIL),
		skillhubExists: invoke(SKILLHUB_RPC_CHANNELS.EXISTS),
		skillhubInstall: invoke(SKILLHUB_RPC_CHANNELS.INSTALL),
		skillhubReportStats: invoke(SKILLHUB_RPC_CHANNELS.REPORT_STATS),
		skillhubInstalledMetas: invoke(SKILLHUB_RPC_CHANNELS.INSTALLED_METAS),
		knotList: invoke(KNOT_RPC_CHANNELS.LIST),
		knotCategories: invoke(KNOT_RPC_CHANNELS.CATEGORIES),
		knotTags: invoke(KNOT_RPC_CHANNELS.TAGS),
		knotSearch: invoke(KNOT_RPC_CHANNELS.SEARCH),
		knotDetail: invoke(KNOT_RPC_CHANNELS.DETAIL),
		knotExists: invoke(KNOT_RPC_CHANNELS.EXISTS),
		knotInstall: invoke(KNOT_RPC_CHANNELS.INSTALL),
		knotReportStats: invoke(KNOT_RPC_CHANNELS.REPORT_STATS),
		knotInstalledMetas: invoke(KNOT_RPC_CHANNELS.INSTALLED_METAS),
		knotGetByIds: invoke(KNOT_RPC_CHANNELS.GET_BY_IDS),
		builtinMarketList: invoke(BUILTIN_MARKET_RPC_CHANNELS.LIST),
		builtinMarketGetByIds: invoke(BUILTIN_MARKET_RPC_CHANNELS.GET_BY_IDS),
		builtinMarketDownloadUrl: invoke(BUILTIN_MARKET_RPC_CHANNELS.DOWNLOAD_URL),
		builtinMarketCategories: invoke(BUILTIN_MARKET_RPC_CHANNELS.CATEGORIES),
		builtinMarketInstall: invoke(BUILTIN_MARKET_RPC_CHANNELS.INSTALL),
		builtinMarketInstalledMetas: invoke(BUILTIN_MARKET_RPC_CHANNELS.INSTALLED_METAS),
		builtinMarketBackfillSkillId: invoke(BUILTIN_MARKET_RPC_CHANNELS.BACKFILL_SKILL_ID),
		builtinMarketBackfillIconSource: invoke(BUILTIN_MARKET_RPC_CHANNELS.BACKFILL_ICON_SOURCE),
		builtinMarketBackfillDescription: invoke(BUILTIN_MARKET_RPC_CHANNELS.BACKFILL_DESCRIPTION),
		builtinMarketMigrateDirsToSkillId: invoke(BUILTIN_MARKET_RPC_CHANNELS.MIGRATE_DIRS_TO_SKILL_ID),
		enterpriseSkillsList: invoke(ENTERPRISE_SKILLS_RPC_CHANNELS.LIST),
		enterpriseSkillsGetCategories: invoke(ENTERPRISE_SKILLS_RPC_CHANNELS.GET_CATEGORIES),
		enterpriseSkillsProbeVisibility: invoke(ENTERPRISE_SKILLS_RPC_CHANNELS.PROBE_VISIBILITY),
		enterpriseSkillsInstall: invoke(ENTERPRISE_SKILLS_RPC_CHANNELS.INSTALL),
		mcpList: invoke(MCP_RPC_CHANNELS.LIST),
		mcpToggle: invoke(MCP_RPC_CHANNELS.TOGGLE),
		mcpReconnect: invoke(MCP_RPC_CHANNELS.RECONNECT),
		mcpDelete: invoke(MCP_RPC_CHANNELS.DELETE),
		mcpToggleTool: invoke(MCP_RPC_CHANNELS.TOGGLE_TOOL),
		mcpOpenConfig: invoke(MCP_RPC_CHANNELS.OPEN_CONFIG),
		mcpGetConfigContent: invoke(MCP_RPC_CHANNELS.GET_CONFIG_CONTENT),
		mcpSaveConfigContent: invoke(MCP_RPC_CHANNELS.SAVE_CONFIG_CONTENT),
		marketplaceList: invoke(MARKETPLACE_RPC_CHANNELS.LIST),
		marketplaceInstall: invoke(MARKETPLACE_RPC_CHANNELS.INSTALL),
		marketplaceContent: invoke(MARKETPLACE_RPC_CHANNELS.CONTENT)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/support/client.ts
var SUPPORT_CHANNEL_MAP;
var init_client$8 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$28();
	SUPPORT_CHANNEL_MAP = {
		memoryGetProfile: invoke(MEMORY_RPC_CHANNELS.GET_PROFILE),
		memorySaveSettings: invoke(MEMORY_RPC_CHANNELS.SAVE_SETTINGS),
		memorySubmitSuggestion: invoke(MEMORY_RPC_CHANNELS.SUBMIT_SUGGESTION),
		memoryImportContent: invoke(MEMORY_RPC_CHANNELS.IMPORT_CONTENT),
		memoryClearProfile: invoke(MEMORY_RPC_CHANNELS.CLEAR_PROFILE),
		memoryCheckUpdating: invoke(MEMORY_RPC_CHANNELS.CHECK_UPDATING)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/tencent-docs/client.ts
var TENCENT_DOCS_CHANNEL_MAP;
var init_client$7 = __esmMin((() => {
	init_channel_map_helpers();
	TENCENT_DOCS_CHANNEL_MAP = {
		tencentDocsGetFileList: invoke("tencentDocs:getFileList"),
		tencentDocsSearchFiles: invoke("tencentDocs:searchFiles"),
		tencentDocsCreateFile: invoke("tencentDocs:createFile"),
		tencentDocsUploadFile: invoke("tencentDocs:uploadFile"),
		tencentDocsCancelUpload: invoke("tencentDocs:cancelUpload"),
		tencentDocsQueryUploadProgress: invoke("tencentDocs:queryUploadProgress"),
		tencentDocsDeleteFile: invoke("tencentDocs:deleteFile"),
		tencentDocsRenameFile: invoke("tencentDocs:renameFile"),
		tencentDocsGetUploadPageUrl: invoke("tencentDocs:getUploadPageUrl"),
		tencentDocsGetPreviewUrl: invoke("tencentDocs:getPreviewUrl"),
		tencentDocsGetFolderContents: invoke("tencentDocs:getFolderContents"),
		tencentDocsCheckAuthStatus: invoke("tencentDocs:checkAuthStatus"),
		tencentDocsStartAuth: invoke("tencentDocs:startAuth"),
		tencentDocsRevokeAuth: invoke("tencentDocs:revokeAuth"),
		tencentDocsCreateSaasImport: invoke("tencentDocs:createSaasImport"),
		tencentDocsQuerySaasImportProgress: invoke("tencentDocs:querySaasImportProgress"),
		tencentDocsBatchCreateSaasImport: invoke("tencentDocs:batchCreateSaasImport"),
		tencentDocsQueryBatchSaasImportProgress: invoke("tencentDocs:queryBatchSaasImportProgress"),
		tencentDocsGetPersonalTdocCookie: invoke("tencentDocs:getPersonalTdocCookie"),
		tencentDocsGetTdocsLicense: invoke("tencentDocs:getTdocsLicense"),
		tencentDocsVerifyPersonalLicense: invoke("tencentDocs:verifyPersonalLicense"),
		tencentDocsInitUploadByEnterprise: invoke("tencentDocs:initUploadByEnterprise"),
		tencentDocsPrepareEnterpriseDocPreview: invoke("tencentDocs:prepareEnterpriseDocPreview"),
		oneidListApplications: invoke("oneid:listApplications"),
		oneidGetSSOLoginLink: invoke("oneid:getSSOLoginLink")
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/tencent-lexiang/client.ts
var TENCENT_LEXIANG_CHANNEL_MAP;
var init_client$6 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$11();
	TENCENT_LEXIANG_CHANNEL_MAP = {
		lexiangGatewayPost: invoke(TENCENT_LEXIANG_RPC_CHANNELS.GATEWAY_POST),
		lexiangUploadFile: invoke(TENCENT_LEXIANG_RPC_CHANNELS.UPLOAD_LEXIANG_FILE),
		lexiangUploadFolder: invoke(TENCENT_LEXIANG_RPC_CHANNELS.UPLOAD_LEXIANG_FOLDER),
		lexiangUploadHtml: invoke(TENCENT_LEXIANG_RPC_CHANNELS.UPLOAD_LEXIANG_HTML),
		lexiangClearWebCookies: invoke(TENCENT_LEXIANG_RPC_CHANNELS.CLEAR_WEB_COOKIES),
		lexiangCheckLicense: invoke(TENCENT_LEXIANG_RPC_CHANNELS.CHECK_LICENSE),
		lexiangCheckCompanyStatus: invoke(TENCENT_LEXIANG_RPC_CHANNELS.CHECK_COMPANY_STATUS),
		lexiangSpApiRequest: invoke(TENCENT_LEXIANG_RPC_CHANNELS.SP_API_REQUEST),
		lexiangInvalidateAccessToken: invoke(TENCENT_LEXIANG_RPC_CHANNELS.INVALIDATE_ACCESS_TOKEN)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/tts/client.ts
var TTS_CHANNEL_MAP;
var init_client$5 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$10();
	TTS_CHANNEL_MAP = {
		startTts: invoke(TTS_RPC_CHANNELS.START_TTS),
		stopTts: invoke(TTS_RPC_CHANNELS.STOP_TTS),
		onTtsEvent: listener(TTS_RPC_CHANNELS.EVENT)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/wechat-chat-history/contract.ts
var WECHAT_CHAT_HISTORY_RPC_CHANNELS;
var init_contract$1 = __esmMin((() => {
	WECHAT_CHAT_HISTORY_RPC_CHANNELS = {
		PARSE_ZIP_METADATA: "wechatChatHistory:parseZipMetadata",
		START_EXTRACTION: "wechatChatHistory:startExtraction",
		GET_EXTRACTION_STATUS: "wechatChatHistory:getExtractionStatus",
		ENSURE_EXTRACTED: "wechatChatHistory:ensureExtracted"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/wechat-chat-history/client.ts
var WECHAT_CHAT_HISTORY_CHANNEL_MAP;
var init_client$4 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract$1();
	WECHAT_CHAT_HISTORY_CHANNEL_MAP = {
		wechatChatHistoryParseZipMetadata: invoke(WECHAT_CHAT_HISTORY_RPC_CHANNELS.PARSE_ZIP_METADATA),
		wechatChatHistoryStartExtraction: invoke(WECHAT_CHAT_HISTORY_RPC_CHANNELS.START_EXTRACTION),
		wechatChatHistoryGetExtractionStatus: invoke(WECHAT_CHAT_HISTORY_RPC_CHANNELS.GET_EXTRACTION_STATUS),
		wechatChatHistoryEnsureExtracted: invoke(WECHAT_CHAT_HISTORY_RPC_CHANNELS.ENSURE_EXTRACTED)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/worktree-task/contract.ts
var WORKTREE_TASK_RPC_CHANNELS;
var init_contract = __esmMin((() => {
	WORKTREE_TASK_RPC_CHANNELS = {
		IS_GIT_REPO: "worktreeTask:isGitRepo",
		LIST_LOCAL_BRANCHES: "worktreeTask:listLocalBranches",
		FETCH_BRANCHES: "worktreeTask:fetchBranches",
		COUNT_WORKTREES: "worktreeTask:countWorktrees",
		CLEANUP_WORKTREES: "worktreeTask:cleanupWorktrees",
		GET_WORKTREE_STATUS: "worktreeTask:getWorktreeStatus",
		CREATE_WORKTREE: "worktreeTask:createWorktree",
		DELETE_WORKTREE: "worktreeTask:deleteWorktree",
		CHECKOUT_BRANCH: "worktreeTask:checkoutBranch"
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/worktree-task/client.ts
var WORKTREE_TASK_CHANNEL_MAP;
var init_client$3 = __esmMin((() => {
	init_channel_map_helpers();
	init_contract();
	WORKTREE_TASK_CHANNEL_MAP = {
		worktreeTaskIsGitRepo: invoke(WORKTREE_TASK_RPC_CHANNELS.IS_GIT_REPO),
		worktreeTaskListLocalBranches: invoke(WORKTREE_TASK_RPC_CHANNELS.LIST_LOCAL_BRANCHES),
		worktreeTaskFetchBranches: invoke(WORKTREE_TASK_RPC_CHANNELS.FETCH_BRANCHES),
		worktreeTaskCountWorktrees: invoke(WORKTREE_TASK_RPC_CHANNELS.COUNT_WORKTREES),
		worktreeTaskCleanupWorktrees: invoke(WORKTREE_TASK_RPC_CHANNELS.CLEANUP_WORKTREES),
		worktreeTaskGetWorktreeStatus: invoke(WORKTREE_TASK_RPC_CHANNELS.GET_WORKTREE_STATUS),
		worktreeTaskCreateWorktree: invoke(WORKTREE_TASK_RPC_CHANNELS.CREATE_WORKTREE),
		worktreeTaskDeleteWorktree: invoke(WORKTREE_TASK_RPC_CHANNELS.DELETE_WORKTREE),
		worktreeTaskCheckoutBranch: invoke(WORKTREE_TASK_RPC_CHANNELS.CHECKOUT_BRANCH)
	};
}));
//#endregion
//#region ../../packages/workbuddy-server/src/client/desktop-host-channel-map.ts
var DESKTOP_HOST_CHANNEL_MAP;
var init_desktop_host_channel_map = __esmMin((() => {
	init_shared();
	init_channel_map_helpers();
	DESKTOP_HOST_CHANNEL_MAP = {
		minimizeWindow: invoke(WINDOW_RPC_CHANNELS.MINIMIZE),
		maximizeWindow: invoke(WINDOW_RPC_CHANNELS.MAXIMIZE),
		closeWindow: invoke(WINDOW_RPC_CHANNELS.CLOSE),
		isWindowMaximized: invoke(WINDOW_RPC_CHANNELS.IS_MAXIMIZED),
		setWindowFullscreen: invoke(WINDOW_RPC_CHANNELS.SET_FULLSCREEN),
		toggleWindowFullscreen: invoke(WINDOW_RPC_CHANNELS.TOGGLE_FULLSCREEN),
		windowCancelPendingClose: invoke(WINDOW_RPC_CHANNELS.CANCEL_PENDING_CLOSE),
		windowConfirmClose: invoke(WINDOW_RPC_CHANNELS.CONFIRM_CLOSE),
		windowSetTrafficLightsVisible: invoke(WINDOW_RPC_CHANNELS.SET_TRAFFIC_LIGHTS_VISIBLE),
		windowShowItemInFolder: invoke(SYSTEM_RPC_CHANNELS.SHOW_ITEM_IN_FOLDER),
		selectDirectory: invoke(DIALOG_RPC_CHANNELS.SELECT_DIRECTORY),
		selectFile: invoke(DIALOG_RPC_CHANNELS.SELECT_FILE),
		saveFile: invoke(DIALOG_RPC_CHANNELS.SAVE_FILE),
		openExternal: invoke(SYSTEM_RPC_CHANNELS.OPEN_EXTERNAL),
		openYuanbao: invoke(SYSTEM_RPC_CHANNELS.OPEN_YUANBAO),
		hasImaApp: invoke(SYSTEM_RPC_CHANNELS.HAS_IMA_APP),
		openImaApp: invoke(SYSTEM_RPC_CHANNELS.OPEN_IMA_APP),
		openPath: invoke(SYSTEM_RPC_CHANNELS.OPEN_PATH),
		readClipboard: invoke(SYSTEM_RPC_CHANNELS.READ_CLIPBOARD),
		checkSystemPermissions: invoke(SYSTEM_RPC_CHANNELS.CHECK_SYSTEM_PERMISSIONS),
		requestNotificationRegistration: invoke(SYSTEM_RPC_CHANNELS.REQUEST_NOTIFICATION_REGISTRATION),
		setPowerSaveBlocker: invoke(POWER_RPC_CHANNELS.SET_POWER_SAVE_BLOCKER),
		getPowerSaveBlockerState: invoke(POWER_RPC_CHANNELS.GET_POWER_SAVE_BLOCKER_STATE),
		pickFile: invoke(DIALOG_RPC_CHANNELS.PICK_FILE),
		pickFolder: invoke(DIALOG_RPC_CHANNELS.PICK_FOLDER),
		windowOpenLocalFile: invoke(WINDOW_RPC_CHANNELS.OPEN_LOCAL_FILE),
		windowReload: invoke(WINDOW_RPC_CHANNELS.RELOAD),
		windowSaveLocale: invoke(WINDOW_RPC_CHANNELS.SAVE_LOCALE),
		windowSaveDefaultWorkspacePath: invoke(WINDOW_RPC_CHANNELS.SAVE_DEFAULT_WORKSPACE_PATH),
		windowCloseAgentManager: invoke(WINDOW_RPC_CHANNELS.CLOSE_AGENT_MANAGER),
		windowSaveBundledRuntimeConfig: invoke(WINDOW_RPC_CHANNELS.SAVE_BUNDLED_RUNTIME_CONFIG),
		windowGetBundledRuntimeConfig: invoke(WINDOW_RPC_CHANNELS.GET_BUNDLED_RUNTIME_CONFIG),
		getAppVersion: invoke(APP_RPC_CHANNELS.GET_VERSION),
		getAppPlatform: invoke(APP_RPC_CHANNELS.GET_PLATFORM),
		getAppLocale: invoke(APP_RPC_CHANNELS.GET_LOCALE),
		getMachineId: invoke(APP_RPC_CHANNELS.GET_MACHINE_ID),
		getConfigDir: invoke(APP_RPC_CHANNELS.GET_CONFIG_DIR),
		setMenuLocale: invoke(APP_RPC_CHANNELS.SET_MENU_LOCALE),
		getAutoLaunchEnabled: invoke(APP_RPC_CHANNELS.GET_AUTO_LAUNCH_ENABLED),
		setAutoLaunchEnabled: invoke(APP_RPC_CHANNELS.SET_AUTO_LAUNCH_ENABLED),
		updateCheck: invoke(UPDATE_RPC_CHANNELS.CHECK),
		updateDownload: invoke(UPDATE_RPC_CHANNELS.DOWNLOAD),
		updateArchMismatchDownload: invoke(UPDATE_RPC_CHANNELS.ARCH_MISMATCH_DOWNLOAD),
		updateArchMismatchInstall: invoke(UPDATE_RPC_CHANNELS.ARCH_MISMATCH_INSTALL),
		updateQuitAndInstall: invoke(UPDATE_RPC_CHANNELS.QUIT_AND_INSTALL),
		updateGetState: invoke(UPDATE_RPC_CHANNELS.GET_STATE),
		onUpdateStateChanged: listener(UPDATE_RPC_CHANNELS.STATE_CHANGED),
		binaryList: invoke(BINARY_RPC_CHANNELS.LIST),
		binaryStatus: invoke(BINARY_RPC_CHANNELS.STATUS),
		getDocumentPreviewUrl: invoke(DOCS_RPC_EX_CHANNELS.GET_PREVIEW_URL),
		releaseDocumentPreviewContext: invoke(DOCS_RPC_EX_CHANNELS.RELEASE_PREVIEW_CONTEXT),
		releaseDocumentPreviewContextIfClean: invoke(DOCS_RPC_EX_CHANNELS.RELEASE_PREVIEW_CONTEXT_IF_CLEAN),
		saveDocumentPreviewContext: invoke(DOCS_RPC_EX_CHANNELS.SAVE_PREVIEW_CONTEXT),
		previewDocumentFromContent: invoke(DOCS_RPC_CHANNELS.PREVIEW_DOCUMENT_FROM_CONTENT),
		getIdentityName: invoke(IDENTITY_RPC_CHANNELS.GET_NAME),
		updateIdentityName: invoke(IDENTITY_RPC_CHANNELS.UPDATE_NAME),
		checkModeration: invoke(IDENTITY_RPC_CHANNELS.CHECK_MODERATION),
		getLocalMemoryFiles: invoke(IDENTITY_RPC_CHANNELS.GET_LOCAL_MEMORY_FILES),
		updateUserCallName: invoke(IDENTITY_RPC_CHANNELS.UPDATE_USER_CALL_NAME),
		updateAiName: invoke(IDENTITY_RPC_CHANNELS.UPDATE_AI_NAME),
		updateSoulBody: invoke(IDENTITY_RPC_CHANNELS.UPDATE_SOUL_BODY),
		updateMemoryBody: invoke(IDENTITY_RPC_CHANNELS.UPDATE_MEMORY_BODY),
		onIdentityChanged: listener(IDENTITY_RPC_CHANNELS.CHANGED)
	};
}));
var init_channel_map = __esmMin((() => {
	init_client$39();
	init_client$38();
	init_client$37();
	init_client$36();
	init_client$35();
	init_client$34();
	init_client$33();
	init_client$32();
	init_client$31();
	init_client$30();
	init_client$29();
	init_contract$6();
	init_client$28();
	init_client$27();
	init_client$26();
	init_client$25();
	init_client$24();
	init_client$23();
	init_client$22();
	init_client$21();
	init_static_html_client();
	init_client$20();
	init_client$19();
	init_client$18();
	init_client$17();
	init_client$16();
	init_client$15();
	init_client$14();
	init_client$13();
	init_client$12();
	init_client$11();
	init_client$10();
	init_client$9();
	init_client$8();
	init_client$7();
	init_client$6();
	init_client$5();
	init_client$4();
	init_client$3();
	init_desktop_host_channel_map();
	({
		...AGENT_IM_CHANNEL_MAP,
		...SESSION_CHANNEL_MAP,
		...AUTH_CHANNEL_MAP,
		...ASR_CHANNEL_MAP,
		...DESKTOP_HOST_CHANNEL_MAP,
		...CONFIG_CHANNEL_MAP,
		...EXPERT_CHANNEL_MAP,
		...FEEDBACK_CHANNEL_MAP,
		...GROWTH_CHANNEL_MAP,
		...IDLE_CAPABILITY_CHANNEL_MAP,
		...SKILLS_CHANNEL_MAP,
		...FILE_SYSTEM_CHANNEL_MAP,
		...AUTOMATION_CHANNEL_MAP,
		...CONNECTOR_CHANNEL_MAP,
		...CLOUD_AGENT_CHANNEL_MAP,
		...CLOUD_ASSISTANT_CHANNEL_MAP,
		...ENTERPRISE_POLICY_CHANNEL_MAP,
		...CREDIT_PREDICTION_CHANNEL_MAP,
		...DATA_RETENTION_CHANNEL_MAP,
		...CLAW_CHANNEL_MAP,
		...IMA_CHANNEL_MAP,
		...INSPIRATION_CHANNEL_MAP,
		...MICROPHONE_CHANNEL_MAP,
		...MIGRATION_CHANNEL_MAP,
		...PLUGIN_CHANNEL_MAP,
		...PLUGIN_RECOMMENDATION_CHANNEL_MAP,
		...PROXY_SETTINGS_CHANNEL_MAP,
		...POI_CHANNEL_MAP,
		...SANDBOX_CHANNEL_MAP,
		...STATIC_HTML_CHANNEL_MAP,
		...SECURITY_CENTER_CHANNEL_MAP,
		...SHARE_CHANNEL_MAP,
		...TENCENT_DOCS_CHANNEL_MAP,
		...TTS_CHANNEL_MAP,
		...TENCENT_LEXIANG_CHANNEL_MAP,
		...MY_FILES_CHANNEL_MAP,
		...SUPPORT_CHANNEL_MAP,
		...COMPATIBILITY_CHANNEL_MAP,
		...WECHAT_CHAT_HISTORY_CHANNEL_MAP,
		...WORKTREE_TASK_CHANNEL_MAP
	});
}));
//#endregion
//#region ../../packages/workbuddy-app/src/desktop/daemon/desktop-daemon-transport.ts
var init_desktop_daemon_transport = __esmMin((() => {}));
//#endregion
//#region ../../packages/workbuddy-app/src/desktop/daemon/client.ts
var init_client$2 = __esmMin((() => {
	init_channel_map();
}));
//#endregion
//#region ../../packages/workbuddy-core/src/conversations/common/core/conversation-event-types.ts
var ConversationEvent, ConversationAutomationEvent;
var init_conversation_event_types = __esmMin((() => {
	ConversationEvent = /* @__PURE__ */ function(ConversationEvent) {
		/** 流式 notification：`(requestId, messageId, chunk)`，chunk 为原始 session/update params。 */
		ConversationEvent["RequestUpdate"] = "requestUpdate";
		/** 会话状态机变迁：`(from, to, finalState?)`。 */
		ConversationEvent["StateChange"] = "stateChange";
		/**
		* 会话元信息（title 等**非 state 字段**）变化：`(info)`，传变化后的完整 `ConversationInfo` 快照。
		*
		* 与 {@link StateChange} 解耦：state 走状态机 StateChange，title 等静态元信息走本事件，
		* 避免把 title 塞进 StateChange payload 导致语义混杂（如 CLI turn 结束推送标题更新）。
		*/
		ConversationEvent["InfoChange"] = "infoChange";
		/** 队列变化（无 payload）。 */
		ConversationEvent["QueueUpdate"] = "queueUpdate";
		/** 服务端容量排队状态变化：`(snapshot)`。 */
		ConversationEvent["CapacityQueueUpdate"] = "capacityQueueUpdate";
		/** 产物变化（无 payload）。 */
		ConversationEvent["ArtifactUpdate"] = "artifactUpdate";
		/**
		* Agent 扩展单向通知的业务出口：仅承接 checkpoint / command / authUrl。
		* 回调接收 Conversation 语义枚举与对应业务参数，不暴露 ACP method 或 transport 字段。
		* `artifact` 保持独立的 ArtifactUpdate 投影；request/response 型扩展不属于此事件。
		*/
		ConversationEvent["ExtensionMethod"] = "extensionMethod";
		/** 告警（如 worker 无响应观测）：`(info)`，**不改** ConversationState。 */
		ConversationEvent["Warning"] = "warning";
		/**
		* worker launch-spec / MCP resolve 准备态：`(status)`。
		* `status` 为具体阶段与服务名；`null` 表示清除（resolve 结束）。不改 ConversationState。
		*/
		ConversationEvent["PrepareStatus"] = "prepareStatus";
		/**
		* 可用斜杠命令/skill 列表变化：`(commands)`。
		* CLI 推送 `available_commands_update` 时触发，UI 侧据此刷新输入框自动补全。
		*/
		ConversationEvent["CommandsUpdate"] = "commandsUpdate";
		/**
		* 当前权限模式变化：`(mode)`。
		* CLI 推送 `current_mode_update` 时触发，UI 据此刷新当前模式标签。
		*/
		ConversationEvent["ModeChange"] = "modeChange";
		/**
		* 配置选项变化：`(options)`。
		* CLI 推送 `config_option_update` 时触发。
		*/
		ConversationEvent["ConfigUpdate"] = "configUpdate";
		/**
		* 可用模型列表 + 当前模型变化：`(update)`。
		* CLI 推送 `model_update` 时触发，UI 据此刷新模型选择器。
		*/
		ConversationEvent["ModelChange"] = "modelChange";
		/** compact / session boundary 等非 Request 时间线事实。 */
		ConversationEvent["TimelineEvent"] = "timelineEvent";
		/**
		* 可用模式列表变化：`(modes)`。
		* CLI 推送 `mode_update` 时触发，UI 据此刷新模式选择器可选列表。
		*/
		ConversationEvent["ModesUpdate"] = "modesUpdate";
		/**
		* TODO 计划更新：`(plan)`。
		* CLI 推送 `plan` sessionUpdate 时触发，UI 据此渲染 plan/todo 面板。
		*/
		ConversationEvent["PlanUpdate"] = "planUpdate";
		/**
		* 权限/问答挂起请求：`(pendingRequest)`。
		*
		* **daemon 内部机制**，供 `ConversationPool` 转发到 eventBus 用。UI 侧**不订阅**此事件
		* （后台可能收不到 push），改用 pull 模式 `getPendingInfo()`。
		* @internal
		*/
		ConversationEvent["PendingRequest"] = "pendingRequest";
		/**
		* 产品级 Plugin/Expert 推荐快照变化：`(recommendation)`。
		* `undefined` 表示当前推荐已结算；不改变 ConversationState。
		*/
		ConversationEvent["PluginRecommendationChanged"] = "pluginRecommendationChanged";
		/**
		* 历史回放（`session/load`）完成信号（无 payload）。
		*
		* 表示回放已落地为终态（`endHistoryReplay` 已完成 unshift/排序）。属**内部里程碑信号**，
		* 也是 {@link RequestsChanged} 的触发点之一。UI 侧一般直接消费 {@link RequestsChanged}
		* 拿全量列表，不必单独订阅本事件。
		*/
		ConversationEvent["HistoryLoaded"] = "historyLoaded";
		/**
		* **全量 Request 列表快照变更**：`(requests)`，携带当前会话完整的 `Request[]`。
		*
		* 用途：解决「多监听空窗期」且**无需 UI 拼 chunk / 手动补拉**——SDK 内部在**里程碑**
		* （历史回放落地 / turn 终态完结）时自动冻结全量快照并派发。消费方（含后来打开同一
		* 会话的页面）收到即拿到**完整终态列表**，直接整体替换渲染，天然不漏历史、无空窗。
		*
		* 与 {@link RequestUpdate} 的分工：RequestUpdate 是**高频实时增量 chunk**（拼流式渲染）；
		* RequestsChanged 是**低频里程碑全量快照**（整体对账）。UI 可二选一或并用（全量替换 +
		* 增量续接）。SDK **不在每个 chunk** 上派发 RequestsChanged，避免 IPC 载荷放大。
		*/
		ConversationEvent["RequestsChanged"] = "requestsChanged";
		/** 指定 Request 的实际累计 Credit 变化：`(payload)`。 */
		ConversationEvent["CreditChanged"] = "creditChanged";
		/**
		* **会话级上下文用量快照变更**：`(payload)`。
		*
		* 与 {@link CreditChanged} 的分工：CreditChanged 是 **Request 维度的计费**事实；本事件是
		* **会话维度的上下文占用**事实，只携带 token / contextWindow / byCategory，**不含 cost**，
		* 不参与任何计费口径。
		*
		* 存在原因：`usage_update` 可能在 turn 终态之后迟到（CLI 于 `resume_session` /
		* `load_session` 补推），此时既无 `currentRequestId`、帧上也没有 requestId，无法归属到
		* 任何 Request；而它是 `usageByCategory`（用量明细）的唯一来源。这类帧不会派发
		* {@link RequestUpdate}（`usage_update` 不属 request content，且禁止伪造 requestId
		* 以免产生幽灵 Assistant），故单开会话维度事件承载，消费方按会话订阅即可。
		*/
		ConversationEvent["ContextUsageChanged"] = "contextUsageChanged";
		/** 指定 Request 的预计总消耗区间变化：`(payload)`。 */
		ConversationEvent["EstimatedCostChanged"] = "estimatedCostChanged";
		/** 自动化 Request 成功终结。 */
		ConversationEvent["AutomationCompleted"] = "automationCompleted";
		/** 自动化 Request 失败终结。 */
		ConversationEvent["AutomationFailed"] = "automationFailed";
		/** 自动化 Request 被显式取消。 */
		ConversationEvent["AutomationCancelled"] = "automationCancelled";
		/** 自动化 Request 超时并触发取消。 */
		ConversationEvent["AutomationTimedOut"] = "automationTimedOut";
		return ConversationEvent;
	}({});
	ConversationAutomationEvent = {
		Completed: ConversationEvent.AutomationCompleted,
		Failed: ConversationEvent.AutomationFailed,
		Cancelled: ConversationEvent.AutomationCancelled,
		TimedOut: ConversationEvent.AutomationTimedOut
	};
}));
//#endregion
//#region ../../packages/workbuddy-core/src/conversations/common/core/conversations-types.ts
var ConversationsEvent;
var init_conversations_types = __esmMin((() => {
	ConversationsEvent = /* @__PURE__ */ function(ConversationsEvent) {
		ConversationsEvent["RequestUpdated"] = "requestUpdated";
		ConversationsEvent["AgentTeamChanged"] = "agentTeamChanged";
		ConversationsEvent["StateChanged"] = "stateChanged";
		ConversationsEvent["InfoChanged"] = "infoChanged";
		ConversationsEvent["QueueUpdated"] = "queueUpdated";
		ConversationsEvent["ArtifactUpdated"] = "artifactUpdated";
		ConversationsEvent["Warning"] = "warning";
		ConversationsEvent["ListChange"] = "listChange";
		return ConversationsEvent;
	}({});
}));
//#endregion
//#region ../../packages/workbuddy-core/src/conversations/common/core/entity-types.ts
var init_entity_types = __esmMin((() => {
	init_conversation_event_types();
	init_conversations_types();
}));
//#endregion
//#region ../../packages/workbuddy-core/src/conversations/common/data-types.ts
var init_data_types = __esmMin((() => {}));
//#endregion
//#region ../../packages/workbuddy-core/src/conversations/common/core/channel-types.ts
var init_channel_types = __esmMin((() => {}));
//#endregion
//#region ../../packages/workbuddy-core/src/conversations/common/types.ts
var init_types$1 = __esmMin((() => {
	init_entity_types();
	init_data_types();
	init_channel_types();
	init_conversation_event_types();
}));
//#endregion
//#region ../../packages/workbuddy-core/src/conversations/common/event-names.ts
var WB_CONVERSATION_STATE_CHANGE, WB_CONVERSATION_INFO_CHANGE, WB_CONVERSATION_PERMISSION, WB_CONVERSATION_PLUGIN_RECOMMENDATION_CHANGED, WB_CONVERSATION_WARNING, WB_CONVERSATION_PREPARE_STATUS, WB_CONVERSATION_HISTORY_LOADED, WB_CONVERSATION_CREDIT_CHANGED, WB_CONVERSATION_CONTEXT_USAGE_CHANGED, WB_CONVERSATION_ESTIMATED_COST_CHANGED, WB_CONVERSATION_QUEUE_UPDATE, WB_CONVERSATION_CAPACITY_QUEUE_UPDATE, WB_CONVERSATION_ARTIFACT_UPDATE, WB_CONVERSATION_COMMANDS_UPDATE, WB_CONVERSATION_MODE_CHANGE, WB_CONVERSATION_CONFIG_UPDATE, WB_CONVERSATION_MODEL_CHANGE, WB_CONVERSATION_TIMELINE_EVENT, WB_CONVERSATION_MODES_UPDATE, WB_CONVERSATION_PLAN_UPDATE, WB_CONVERSATION_CHILD_AGENT_EVENT;
var init_event_names = __esmMin((() => {
	WB_CONVERSATION_STATE_CHANGE = "wb:conversation:stateChange";
	WB_CONVERSATION_INFO_CHANGE = "wb:conversation:infoChange";
	WB_CONVERSATION_PERMISSION = "wb:conversation:permission";
	WB_CONVERSATION_PLUGIN_RECOMMENDATION_CHANGED = "wb:conversation:pluginRecommendationChanged";
	WB_CONVERSATION_WARNING = "wb:conversation:warning";
	WB_CONVERSATION_PREPARE_STATUS = "wb:conversation:prepareStatus";
	WB_CONVERSATION_HISTORY_LOADED = "wb:conversation:historyLoaded";
	WB_CONVERSATION_CREDIT_CHANGED = "wb:conversation:creditChanged";
	WB_CONVERSATION_CONTEXT_USAGE_CHANGED = "wb:conversation:contextUsageChanged";
	WB_CONVERSATION_ESTIMATED_COST_CHANGED = "wb:conversation:estimatedCostChanged";
	WB_CONVERSATION_QUEUE_UPDATE = "wb:conversation:queueUpdate";
	WB_CONVERSATION_CAPACITY_QUEUE_UPDATE = "wb:conversation:capacityQueueUpdate";
	WB_CONVERSATION_ARTIFACT_UPDATE = "wb:conversation:artifactUpdate";
	WB_CONVERSATION_COMMANDS_UPDATE = "wb:conversation:commandsUpdate";
	WB_CONVERSATION_MODE_CHANGE = "wb:conversation:modeChange";
	WB_CONVERSATION_CONFIG_UPDATE = "wb:conversation:configUpdate";
	WB_CONVERSATION_MODEL_CHANGE = "wb:conversation:modelChange";
	WB_CONVERSATION_TIMELINE_EVENT = "wb:conversation:timelineEvent";
	WB_CONVERSATION_MODES_UPDATE = "wb:conversation:modesUpdate";
	WB_CONVERSATION_PLAN_UPDATE = "wb:conversation:planUpdate";
	WB_CONVERSATION_CHILD_AGENT_EVENT = "wb:conversation:childAgentEvent";
}));
var init_conversation_prompt_operations = __esmMin((() => {
	init_conversation_event_types();
	new Set(Object.values(ConversationAutomationEvent));
})), ExtensionMethod;
var init_types = __esmMin((() => {
	ExtensionMethod = {
		ARTIFACT: "_codebuddy.ai/artifact",
		ARTIFACT_BATCH: "_codebuddy.ai/artifactBatch",
		QUESTION: "_codebuddy.ai/question",
		CHECKPOINT: "_codebuddy.ai/checkpoint",
		COMMAND: "_codebuddy.ai/command",
		AUTH_URL: "_codebuddy.ai/authUrl",
		FILE_HISTORY_SNAPSHOT: "_codebuddy.ai/file_history_snapshot",
		DELEGATE_TOOL: "_codebuddy.ai/delegateTool",
		DELEGATE_TOOLS_CHANGED: "_codebuddy.ai/delegateToolsChanged",
		UI_CONTROL: "_codebuddy.ai/uiControl"
	};
	ExtensionMethod.ARTIFACT, ExtensionMethod.ARTIFACT_BATCH, ExtensionMethod.QUESTION, ExtensionMethod.CHECKPOINT, ExtensionMethod.COMMAND, ExtensionMethod.AUTH_URL, ExtensionMethod.FILE_HISTORY_SNAPSHOT, ExtensionMethod.DELEGATE_TOOL, ExtensionMethod.DELEGATE_TOOLS_CHANGED;
}));
var init_prompt_context_xml = __esmMin((() => {
	[
		"<project-tool-routing>",
		"Select tools by the user's actual intent:",
		"- Project shared files: use `tdrive.*` and search project files only when the user asks to access/list/search/read/write project assets, project drive, or shared project files. Do not search project files just to gather background for a report, plan, or task.",
		"- Project members: use `project_members` to resolve members.",
		"- Todos/tasks: use `todo_create` / `todo_list` / `todo_update` as needed.",
		"- Project messages: use `project_message_*` to list, view, add, reply, edit, or delete.",
		"</project-tool-routing>"
	].join("\n");
	[
		"There are two file systems (sandbox is the default):",
		"- Sandbox filesystem: for local/uploads/artifacts files.",
		"- Project Drive/assets (tdrive): a shared project file system (root below)."
	].join("\n");
	[
		"PROJECT DRIVE / ASSETS (tdrive) — MANDATORY WORKFLOW:",
		"- Any mutating operation on Project Drive (create, upload, modify, move, rename, delete, overwrite) MUST be confirmed with the user before execution.",
		"- For Drive file edits, follow this mandatory review-before-upload workflow:",
		"  1. Download the latest Drive file immediately before editing to avoid overwriting others' changes, then make changes locally.",
		"  2. Show the user what changed, ask for explicit confirmation, then STOP.",
		"  3. Resume the Project Drive mutation only after the user clearly approves the reviewed local version.",
		"- Never upload the locally modified file back to Project Drive directly after editing. MUST show the changes to the user and get explicit confirmation first."
	].join("\n");
}));
//#endregion
//#region ../../packages/agent-client-protocol/src/common/prompt-codec.ts
var init_prompt_codec = __esmMin((() => {
	init_prompt_context_xml();
}));
//#endregion
//#region ../../packages/agent-client-protocol/src/common/to-resolve-blocks.ts
var init_to_resolve_blocks = __esmMin((() => {
	init_prompt_codec();
}));
//#endregion
//#region ../../packages/agent-client-protocol/src/common/runtime-wire-authority.ts
var init_runtime_wire_authority = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-client-protocol/src/common/interactive-question-tools.ts
var init_interactive_question_tools = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-client-protocol/src/common/sdk.ts
var init_sdk = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-client-protocol/src/common/transport/streamable-http.ts
var init_streamable_http = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-client-protocol/src/common/client/constants.ts
var init_constants = __esmMin((() => {
	init_types();
}));
//#endregion
//#region ../../packages/agent-client-protocol/src/common/client/extensions.ts
var init_extensions = __esmMin((() => {
	init_constants();
}));
//#endregion
//#region ../../packages/agent-client-protocol/src/common/client/permissions.ts
var init_permissions = __esmMin((() => {
	init_constants();
}));
//#endregion
//#region ../../packages/agent-client-protocol/src/common/client/questions.ts
var init_questions = __esmMin((() => {
	init_constants();
}));
//#endregion
//#region ../../packages/agent-client-protocol/src/common/client/client.ts
var init_client$1 = __esmMin((() => {
	init_sdk();
	init_constants();
	init_extensions();
	init_permissions();
	init_questions();
}));
//#endregion
//#region ../../packages/agent-client-protocol/src/common/client/index.ts
var init_client = __esmMin((() => {
	init_client$1();
	init_constants();
	init_permissions();
	init_questions();
	init_extensions();
}));
//#endregion
//#region ../../packages/agent-client-protocol/src/common/index.ts
var init_common = __esmMin((() => {
	init_types();
	init_prompt_codec();
	init_prompt_context_xml();
	init_to_resolve_blocks();
	init_runtime_wire_authority();
	init_interactive_question_tools();
	init_sdk();
	init_streamable_http();
	init_client();
	init_prompt_codec();
	init_prompt_context_xml();
}));
//#endregion
//#region ../../packages/workbuddy-core/src/conversations/common/core/model/conversation-impl-helpers.ts
var init_conversation_impl_helpers = __esmMin((() => {
	init_common();
}));
var init_request_assembler = __esmMin((() => {
	init_conversation_impl_helpers();
	typeof process !== "undefined" && process.env?.WB_CONV_PERF_LOG;
}));
//#endregion
//#region ../../packages/workbuddy-core/src/conversations/common/core/model/request-projection/index.ts
var init_request_projection = __esmMin((() => {
	init_request_assembler();
}));
//#endregion
//#region ../../packages/workbuddy-core/src/conversations/wb/rehydrate-child-agents.ts
var init_rehydrate_child_agents = __esmMin((() => {
	init_request_projection();
	init_types$1();
}));
//#endregion
//#region ../../packages/workbuddy-core/src/conversations/wb/wire-descriptor.ts
/** 声明一个 `EventBind` 并锁定 payload 类型（工厂，保留类型联动）。 */
function eventBind(busEvent) {
	return { busEvent };
}
var METHOD_BINDS, WIRE_ONLY_METHOD_KEYS;
var init_wire_descriptor = __esmMin((() => {
	init_event_names();
	init_types$1();
	METHOD_BINDS = [
		{
			key: "sendPrompt",
			mode: "async",
			bridgeAuto: true
		},
		{
			key: "runPrompt",
			mode: "async",
			bridgeAuto: true
		},
		{
			key: "clear",
			mode: "async",
			bridgeAuto: true
		},
		{
			key: "compact",
			mode: "async",
			bridgeAuto: true
		},
		{
			key: "requests",
			mode: "async",
			bridgeAuto: true
		},
		{
			key: "requestEntries",
			mode: "async",
			bridgeAuto: true
		},
		{
			key: "userPrompts",
			mode: "async",
			bridgeAuto: true
		},
		{
			key: "updateEstimatedCost",
			mode: "async",
			bridgeAuto: true
		},
		{
			key: "loadToolDetail",
			mode: "async",
			bridgeAuto: true
		},
		{
			key: "artifacts",
			mode: "async",
			bridgeAuto: false
		},
		{
			key: "files",
			mode: "async",
			bridgeAuto: false
		},
		{
			key: "changes",
			mode: "async",
			bridgeAuto: false
		},
		{
			key: "changeManifests",
			mode: "async",
			bridgeAuto: false
		},
		{
			key: "changeDetail",
			mode: "async",
			bridgeAuto: false
		},
		{
			key: "cancel",
			mode: "async",
			bridgeAuto: true
		},
		{
			key: "getCapacityQueueState",
			mode: "async",
			bridgeAuto: true
		},
		{
			key: "cancelCapacityQueue",
			mode: "async",
			bridgeAuto: true
		},
		{
			key: "resend",
			mode: "async",
			bridgeAuto: true
		},
		{
			key: "getPendingInfo",
			mode: "async",
			bridgeAuto: true
		},
		{
			key: "getPluginRecommendation",
			mode: "async",
			bridgeAuto: true
		},
		{
			key: "rename",
			mode: "async",
			bridgeAuto: true
		},
		{
			key: "preload",
			mode: "fireAndForget",
			onReject: "silent",
			bridgeAuto: false
		},
		{
			key: "ensureRuntime",
			mode: "fireAndForget",
			onReject: "silent",
			bridgeAuto: false
		},
		{
			key: "retainRuntimeHold",
			mode: "fireAndForget",
			onReject: "silent",
			bridgeAuto: false
		},
		{
			key: "releaseRuntimeHold",
			mode: "fireAndForget",
			onReject: "silent",
			bridgeAuto: false
		},
		{
			key: "refreshContextUsage",
			mode: "async",
			bridgeAuto: true
		},
		{
			key: "resolvePending",
			mode: "syncVoid",
			onReject: "warn",
			bridgeAuto: true
		},
		{
			key: "rejectPending",
			mode: "syncVoid",
			onReject: "warn",
			bridgeAuto: true
		},
		{
			key: "log",
			mode: "fireAndForget",
			onReject: "silent",
			bridgeAuto: true
		},
		{
			key: "markExcludeLaunchSpecServers",
			mode: "async",
			bridgeAuto: true
		}
	];
	WIRE_ONLY_METHOD_KEYS = [
		"dispose",
		"queueItems",
		"queuePause",
		"queueResume",
		"queueDelete",
		"queueMove",
		"queueSendNow",
		"registerClientTools",
		"unregisterClientTools",
		"fileArtifacts",
		"fileFiles",
		"fileChanges",
		"childAgentSnapshots",
		"childAgentRequests",
		"childAgentLoadToolDetail",
		"configSetMode",
		"configSetModel",
		"configSetConnectors",
		"configSetPermissionMode",
		"configSetThoughtLevel",
		"configSetPreMessageCompactPct",
		"configSetContextWindow",
		"configSetExpert",
		"configSetExpertId"
	];
	ConversationEvent.StateChange, eventBind(WB_CONVERSATION_STATE_CHANGE), ConversationEvent.InfoChange, eventBind(WB_CONVERSATION_INFO_CHANGE), ConversationEvent.CapacityQueueUpdate, eventBind(WB_CONVERSATION_CAPACITY_QUEUE_UPDATE), ConversationEvent.ArtifactUpdate, eventBind(WB_CONVERSATION_ARTIFACT_UPDATE), ConversationEvent.Warning, eventBind(WB_CONVERSATION_WARNING), ConversationEvent.PrepareStatus, eventBind(WB_CONVERSATION_PREPARE_STATUS), ConversationEvent.PendingRequest, eventBind(WB_CONVERSATION_PERMISSION), ConversationEvent.PluginRecommendationChanged, eventBind(WB_CONVERSATION_PLUGIN_RECOMMENDATION_CHANGED), ConversationEvent.HistoryLoaded, eventBind(WB_CONVERSATION_HISTORY_LOADED), ConversationEvent.CreditChanged, eventBind(WB_CONVERSATION_CREDIT_CHANGED), ConversationEvent.ContextUsageChanged, eventBind(WB_CONVERSATION_CONTEXT_USAGE_CHANGED), ConversationEvent.EstimatedCostChanged, eventBind(WB_CONVERSATION_ESTIMATED_COST_CHANGED), ConversationEvent.CommandsUpdate, eventBind(WB_CONVERSATION_COMMANDS_UPDATE), ConversationEvent.ModeChange, eventBind(WB_CONVERSATION_MODE_CHANGE), ConversationEvent.ConfigUpdate, eventBind(WB_CONVERSATION_CONFIG_UPDATE), ConversationEvent.ModelChange, eventBind(WB_CONVERSATION_MODEL_CHANGE), ConversationEvent.TimelineEvent, eventBind(WB_CONVERSATION_TIMELINE_EVENT), ConversationEvent.ModesUpdate, eventBind(WB_CONVERSATION_MODES_UPDATE), ConversationEvent.PlanUpdate, eventBind(WB_CONVERSATION_PLAN_UPDATE);
	ConversationEvent.RequestUpdate, ConversationEvent.QueueUpdate, ConversationEvent.RequestsChanged, ConversationEvent.ExtensionMethod, ConversationEvent.AutomationCompleted, ConversationEvent.AutomationFailed, ConversationEvent.AutomationCancelled, ConversationEvent.AutomationTimedOut;
	ConversationsEvent.AgentTeamChanged, eventBind(WB_CONVERSATION_CHILD_AGENT_EVENT), ConversationsEvent.StateChanged, eventBind(WB_CONVERSATION_STATE_CHANGE), ConversationsEvent.InfoChanged, eventBind(WB_CONVERSATION_INFO_CHANGE), ConversationsEvent.QueueUpdated, eventBind(WB_CONVERSATION_QUEUE_UPDATE), ConversationsEvent.ArtifactUpdated, eventBind(WB_CONVERSATION_ARTIFACT_UPDATE), ConversationsEvent.Warning, eventBind(WB_CONVERSATION_WARNING);
	ConversationsEvent.ListChange, ConversationsEvent.RequestUpdated;
}));
//#endregion
//#region ../../packages/workbuddy-core/src/conversations/wb/rehydrate-events.ts
var init_rehydrate_events = __esmMin((() => {
	init_wire_descriptor();
}));
//#endregion
//#region ../../packages/workbuddy-core/src/conversations/wb/rehydrate-managers.ts
var init_rehydrate_managers = __esmMin((() => {
	init_rehydrate_events();
}));
//#endregion
//#region ../../packages/workbuddy-core/src/conversations/wb/rehydrate.ts
var init_rehydrate = __esmMin((() => {
	init_conversation_prompt_operations();
	init_types$1();
	init_rehydrate_child_agents();
	init_rehydrate_events();
	init_rehydrate_managers();
	init_wire_descriptor();
}));
var init_service = __esmMin((() => {
	init_types$1();
	init_wire_descriptor();
	[...METHOD_BINDS.map((bind) => bind.key).filter((key) => key !== "rename"), ...WIRE_ONLY_METHOD_KEYS];
}));
//#endregion
//#region ../../packages/workbuddy-core/src/conversations/wb/index.ts
var init_wb$2 = __esmMin((() => {
	init_types$1();
	init_rehydrate();
	init_wire_descriptor();
	init_service();
}));
//#endregion
//#region ../../packages/workbuddy-core/src/wb/core/wb.ts
var init_wb$1 = __esmMin((() => {
	init_types$1();
	init_wb$2();
}));
//#endregion
//#region ../../packages/workbuddy-core/src/wb/guest/proxy.ts
function readListThrottleMs() {
	if (typeof process === "undefined") return DEFAULT_LIST_THROTTLE_MS;
	const raw = process.env?.WB_GUEST_LIST_THROTTLE_MS;
	if (raw === void 0) return DEFAULT_LIST_THROTTLE_MS;
	const parsed = Number(raw);
	if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_LIST_THROTTLE_MS;
	return Math.floor(parsed);
}
var DEFAULT_LIST_THROTTLE_MS;
var init_proxy = __esmMin((() => {
	DEFAULT_LIST_THROTTLE_MS = 300;
	readListThrottleMs();
}));
//#endregion
//#region ../../packages/workbuddy-core/src/wb/host/bridge/index.ts
var init_bridge$1 = __esmMin((() => {
	init_proxy();
}));
//#endregion
//#region ../../packages/workbuddy-core/src/wb/host/platform-sdk.ts
var init_platform_sdk = __esmMin((() => {
	init_wb();
}));
//#endregion
//#region ../../packages/workbuddy-core/src/wb/guest/conversations.ts
var init_conversations = __esmMin((() => {
	init_types$1();
	init_wb$2();
	init_bridge$1();
}));
//#endregion
//#region ../../packages/workbuddy-core/src/wb/guest/sdk-from-invoke.ts
var init_sdk_from_invoke = __esmMin((() => {
	init_types$1();
	init_wb$2();
	init_bridge$1();
	init_platform_sdk();
	init_conversations();
})), BUILT_IN_NAMESPACES, CORE_NAMESPACES, DESKTOP_ONLY_NAMESPACES;
var init_namespace_manifest = __esmMin((() => {
	BUILT_IN_NAMESPACES = [
		"telemetry",
		"http",
		"feedback"
	];
	CORE_NAMESPACES = [
		"storage",
		"config",
		"account",
		"skills",
		"experts",
		"automations",
		"workspaces",
		"models",
		"notifications",
		"ops",
		"connectors",
		"conversations",
		"artifacts",
		"changes",
		"intentRecognition",
		"metrics",
		"netdrive",
		"inspirationCode",
		"cloud"
	];
	DESKTOP_ONLY_NAMESPACES = [
		"windows",
		"paths",
		"shell"
	];
	[...CORE_NAMESPACES, ...DESKTOP_ONLY_NAMESPACES];
	[
		...CORE_NAMESPACES,
		...DESKTOP_ONLY_NAMESPACES,
		...BUILT_IN_NAMESPACES
	];
}));
//#endregion
//#region ../../packages/workbuddy-core/src/wb/index.ts
var init_wb = __esmMin((() => {
	init_wb$1();
	init_wb$1();
	init_bridge$1();
	init_sdk_from_invoke();
	init_platform_sdk();
	init_namespace_manifest();
}));
//#endregion
//#region ../../packages/workbuddy-app/src/desktop/daemon/mcp-apps-wb-api.ts
var init_mcp_apps_wb_api = __esmMin((() => {
	init_wb();
}));
//#endregion
//#region ../../node_modules/.pnpm/react@18.3.1/node_modules/react/cjs/react.production.min.js
/**
* @license React
* react.production.min.js
*
* Copyright (c) Facebook, Inc. and its affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_react_production_min = /* @__PURE__ */ __commonJSMin(((exports) => {
	var l = Symbol.for("react.element"), n = Symbol.for("react.portal"), p = Symbol.for("react.fragment"), q = Symbol.for("react.strict_mode"), r = Symbol.for("react.profiler"), t = Symbol.for("react.provider"), u = Symbol.for("react.context"), v = Symbol.for("react.forward_ref"), w = Symbol.for("react.suspense"), x = Symbol.for("react.memo"), y = Symbol.for("react.lazy"), z = Symbol.iterator;
	function A(a) {
		if (null === a || "object" !== typeof a) return null;
		a = z && a[z] || a["@@iterator"];
		return "function" === typeof a ? a : null;
	}
	var B = {
		isMounted: function() {
			return !1;
		},
		enqueueForceUpdate: function() {},
		enqueueReplaceState: function() {},
		enqueueSetState: function() {}
	}, C = Object.assign, D = {};
	function E(a, b, e) {
		this.props = a;
		this.context = b;
		this.refs = D;
		this.updater = e || B;
	}
	E.prototype.isReactComponent = {};
	E.prototype.setState = function(a, b) {
		if ("object" !== typeof a && "function" !== typeof a && null != a) throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
		this.updater.enqueueSetState(this, a, b, "setState");
	};
	E.prototype.forceUpdate = function(a) {
		this.updater.enqueueForceUpdate(this, a, "forceUpdate");
	};
	function F() {}
	F.prototype = E.prototype;
	function G(a, b, e) {
		this.props = a;
		this.context = b;
		this.refs = D;
		this.updater = e || B;
	}
	var H = G.prototype = new F();
	H.constructor = G;
	C(H, E.prototype);
	H.isPureReactComponent = !0;
	var I = Array.isArray, J = Object.prototype.hasOwnProperty, K = { current: null }, L = {
		key: !0,
		ref: !0,
		__self: !0,
		__source: !0
	};
	function M(a, b, e) {
		var d, c = {}, k = null, h = null;
		if (null != b) for (d in void 0 !== b.ref && (h = b.ref), void 0 !== b.key && (k = "" + b.key), b) J.call(b, d) && !L.hasOwnProperty(d) && (c[d] = b[d]);
		var g = arguments.length - 2;
		if (1 === g) c.children = e;
		else if (1 < g) {
			for (var f = Array(g), m = 0; m < g; m++) f[m] = arguments[m + 2];
			c.children = f;
		}
		if (a && a.defaultProps) for (d in g = a.defaultProps, g) void 0 === c[d] && (c[d] = g[d]);
		return {
			$$typeof: l,
			type: a,
			key: k,
			ref: h,
			props: c,
			_owner: K.current
		};
	}
	function N(a, b) {
		return {
			$$typeof: l,
			type: a.type,
			key: b,
			ref: a.ref,
			props: a.props,
			_owner: a._owner
		};
	}
	function O(a) {
		return "object" === typeof a && null !== a && a.$$typeof === l;
	}
	function escape(a) {
		var b = {
			"=": "=0",
			":": "=2"
		};
		return "$" + a.replace(/[=:]/g, function(a) {
			return b[a];
		});
	}
	var P = /\/+/g;
	function Q(a, b) {
		return "object" === typeof a && null !== a && null != a.key ? escape("" + a.key) : b.toString(36);
	}
	function R(a, b, e, d, c) {
		var k = typeof a;
		if ("undefined" === k || "boolean" === k) a = null;
		var h = !1;
		if (null === a) h = !0;
		else switch (k) {
			case "string":
			case "number":
				h = !0;
				break;
			case "object": switch (a.$$typeof) {
				case l:
				case n: h = !0;
			}
		}
		if (h) return h = a, c = c(h), a = "" === d ? "." + Q(h, 0) : d, I(c) ? (e = "", null != a && (e = a.replace(P, "$&/") + "/"), R(c, b, e, "", function(a) {
			return a;
		})) : null != c && (O(c) && (c = N(c, e + (!c.key || h && h.key === c.key ? "" : ("" + c.key).replace(P, "$&/") + "/") + a)), b.push(c)), 1;
		h = 0;
		d = "" === d ? "." : d + ":";
		if (I(a)) for (var g = 0; g < a.length; g++) {
			k = a[g];
			var f = d + Q(k, g);
			h += R(k, b, e, f, c);
		}
		else if (f = A(a), "function" === typeof f) for (a = f.call(a), g = 0; !(k = a.next()).done;) k = k.value, f = d + Q(k, g++), h += R(k, b, e, f, c);
		else if ("object" === k) throw b = String(a), Error("Objects are not valid as a React child (found: " + ("[object Object]" === b ? "object with keys {" + Object.keys(a).join(", ") + "}" : b) + "). If you meant to render a collection of children, use an array instead.");
		return h;
	}
	function S(a, b, e) {
		if (null == a) return a;
		var d = [], c = 0;
		R(a, d, "", "", function(a) {
			return b.call(e, a, c++);
		});
		return d;
	}
	function T(a) {
		if (-1 === a._status) {
			var b = a._result;
			b = b();
			b.then(function(b) {
				if (0 === a._status || -1 === a._status) a._status = 1, a._result = b;
			}, function(b) {
				if (0 === a._status || -1 === a._status) a._status = 2, a._result = b;
			});
			-1 === a._status && (a._status = 0, a._result = b);
		}
		if (1 === a._status) return a._result.default;
		throw a._result;
	}
	var U = { current: null }, V = { transition: null }, W = {
		ReactCurrentDispatcher: U,
		ReactCurrentBatchConfig: V,
		ReactCurrentOwner: K
	};
	function X() {
		throw Error("act(...) is not supported in production builds of React.");
	}
	exports.Children = {
		map: S,
		forEach: function(a, b, e) {
			S(a, function() {
				b.apply(this, arguments);
			}, e);
		},
		count: function(a) {
			var b = 0;
			S(a, function() {
				b++;
			});
			return b;
		},
		toArray: function(a) {
			return S(a, function(a) {
				return a;
			}) || [];
		},
		only: function(a) {
			if (!O(a)) throw Error("React.Children.only expected to receive a single React element child.");
			return a;
		}
	};
	exports.Component = E;
	exports.Fragment = p;
	exports.Profiler = r;
	exports.PureComponent = G;
	exports.StrictMode = q;
	exports.Suspense = w;
	exports.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = W;
	exports.act = X;
	exports.cloneElement = function(a, b, e) {
		if (null === a || void 0 === a) throw Error("React.cloneElement(...): The argument must be a React element, but you passed " + a + ".");
		var d = C({}, a.props), c = a.key, k = a.ref, h = a._owner;
		if (null != b) {
			void 0 !== b.ref && (k = b.ref, h = K.current);
			void 0 !== b.key && (c = "" + b.key);
			if (a.type && a.type.defaultProps) var g = a.type.defaultProps;
			for (f in b) J.call(b, f) && !L.hasOwnProperty(f) && (d[f] = void 0 === b[f] && void 0 !== g ? g[f] : b[f]);
		}
		var f = arguments.length - 2;
		if (1 === f) d.children = e;
		else if (1 < f) {
			g = Array(f);
			for (var m = 0; m < f; m++) g[m] = arguments[m + 2];
			d.children = g;
		}
		return {
			$$typeof: l,
			type: a.type,
			key: c,
			ref: k,
			props: d,
			_owner: h
		};
	};
	exports.createContext = function(a) {
		a = {
			$$typeof: u,
			_currentValue: a,
			_currentValue2: a,
			_threadCount: 0,
			Provider: null,
			Consumer: null,
			_defaultValue: null,
			_globalName: null
		};
		a.Provider = {
			$$typeof: t,
			_context: a
		};
		return a.Consumer = a;
	};
	exports.createElement = M;
	exports.createFactory = function(a) {
		var b = M.bind(null, a);
		b.type = a;
		return b;
	};
	exports.createRef = function() {
		return { current: null };
	};
	exports.forwardRef = function(a) {
		return {
			$$typeof: v,
			render: a
		};
	};
	exports.isValidElement = O;
	exports.lazy = function(a) {
		return {
			$$typeof: y,
			_payload: {
				_status: -1,
				_result: a
			},
			_init: T
		};
	};
	exports.memo = function(a, b) {
		return {
			$$typeof: x,
			type: a,
			compare: void 0 === b ? null : b
		};
	};
	exports.startTransition = function(a) {
		var b = V.transition;
		V.transition = {};
		try {
			a();
		} finally {
			V.transition = b;
		}
	};
	exports.unstable_act = X;
	exports.useCallback = function(a, b) {
		return U.current.useCallback(a, b);
	};
	exports.useContext = function(a) {
		return U.current.useContext(a);
	};
	exports.useDebugValue = function() {};
	exports.useDeferredValue = function(a) {
		return U.current.useDeferredValue(a);
	};
	exports.useEffect = function(a, b) {
		return U.current.useEffect(a, b);
	};
	exports.useId = function() {
		return U.current.useId();
	};
	exports.useImperativeHandle = function(a, b, e) {
		return U.current.useImperativeHandle(a, b, e);
	};
	exports.useInsertionEffect = function(a, b) {
		return U.current.useInsertionEffect(a, b);
	};
	exports.useLayoutEffect = function(a, b) {
		return U.current.useLayoutEffect(a, b);
	};
	exports.useMemo = function(a, b) {
		return U.current.useMemo(a, b);
	};
	exports.useReducer = function(a, b, e) {
		return U.current.useReducer(a, b, e);
	};
	exports.useRef = function(a) {
		return U.current.useRef(a);
	};
	exports.useState = function(a) {
		return U.current.useState(a);
	};
	exports.useSyncExternalStore = function(a, b, e) {
		return U.current.useSyncExternalStore(a, b, e);
	};
	exports.useTransition = function() {
		return U.current.useTransition();
	};
	exports.version = "18.3.1";
}));
//#endregion
//#region ../../node_modules/.pnpm/react@18.3.1/node_modules/react/cjs/react.development.js
/**
* @license React
* react.development.js
*
* Copyright (c) Facebook, Inc. and its affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_react_development = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	if (process.env.NODE_ENV !== "production") (function() {
		"use strict";
		if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart === "function") __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(/* @__PURE__ */ new Error());
		var ReactVersion = "18.3.1";
		var REACT_ELEMENT_TYPE = Symbol.for("react.element");
		var REACT_PORTAL_TYPE = Symbol.for("react.portal");
		var REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
		var REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode");
		var REACT_PROFILER_TYPE = Symbol.for("react.profiler");
		var REACT_PROVIDER_TYPE = Symbol.for("react.provider");
		var REACT_CONTEXT_TYPE = Symbol.for("react.context");
		var REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref");
		var REACT_SUSPENSE_TYPE = Symbol.for("react.suspense");
		var REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list");
		var REACT_MEMO_TYPE = Symbol.for("react.memo");
		var REACT_LAZY_TYPE = Symbol.for("react.lazy");
		var REACT_OFFSCREEN_TYPE = Symbol.for("react.offscreen");
		var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
		var FAUX_ITERATOR_SYMBOL = "@@iterator";
		function getIteratorFn(maybeIterable) {
			if (maybeIterable === null || typeof maybeIterable !== "object") return null;
			var maybeIterator = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL];
			if (typeof maybeIterator === "function") return maybeIterator;
			return null;
		}
		/**
		* Keeps track of the current dispatcher.
		*/
		var ReactCurrentDispatcher = { current: null };
		/**
		* Keeps track of the current batch's configuration such as how long an update
		* should suspend for if it needs to.
		*/
		var ReactCurrentBatchConfig = { transition: null };
		var ReactCurrentActQueue = {
			current: null,
			isBatchingLegacy: false,
			didScheduleLegacyUpdate: false
		};
		/**
		* Keeps track of the current owner.
		*
		* The current owner is the component who should own any components that are
		* currently being constructed.
		*/
		var ReactCurrentOwner = { current: null };
		var ReactDebugCurrentFrame = {};
		var currentExtraStackFrame = null;
		function setExtraStackFrame(stack) {
			currentExtraStackFrame = stack;
		}
		ReactDebugCurrentFrame.setExtraStackFrame = function(stack) {
			currentExtraStackFrame = stack;
		};
		ReactDebugCurrentFrame.getCurrentStack = null;
		ReactDebugCurrentFrame.getStackAddendum = function() {
			var stack = "";
			if (currentExtraStackFrame) stack += currentExtraStackFrame;
			var impl = ReactDebugCurrentFrame.getCurrentStack;
			if (impl) stack += impl() || "";
			return stack;
		};
		var enableScopeAPI = false;
		var enableCacheElement = false;
		var enableTransitionTracing = false;
		var enableLegacyHidden = false;
		var enableDebugTracing = false;
		var ReactSharedInternals = {
			ReactCurrentDispatcher,
			ReactCurrentBatchConfig,
			ReactCurrentOwner
		};
		ReactSharedInternals.ReactDebugCurrentFrame = ReactDebugCurrentFrame;
		ReactSharedInternals.ReactCurrentActQueue = ReactCurrentActQueue;
		function warn(format) {
			for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) args[_key - 1] = arguments[_key];
			printWarning("warn", format, args);
		}
		function error(format) {
			for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) args[_key2 - 1] = arguments[_key2];
			printWarning("error", format, args);
		}
		function printWarning(level, format, args) {
			var stack = ReactSharedInternals.ReactDebugCurrentFrame.getStackAddendum();
			if (stack !== "") {
				format += "%s";
				args = args.concat([stack]);
			}
			var argsWithFormat = args.map(function(item) {
				return String(item);
			});
			argsWithFormat.unshift("Warning: " + format);
			Function.prototype.apply.call(console[level], console, argsWithFormat);
		}
		var didWarnStateUpdateForUnmountedComponent = {};
		function warnNoop(publicInstance, callerName) {
			var _constructor = publicInstance.constructor;
			var componentName = _constructor && (_constructor.displayName || _constructor.name) || "ReactClass";
			var warningKey = componentName + "." + callerName;
			if (didWarnStateUpdateForUnmountedComponent[warningKey]) return;
			error("Can't call %s on a component that is not yet mounted. This is a no-op, but it might indicate a bug in your application. Instead, assign to `this.state` directly or define a `state = {};` class property with the desired state in the %s component.", callerName, componentName);
			didWarnStateUpdateForUnmountedComponent[warningKey] = true;
		}
		/**
		* This is the abstract API for an update queue.
		*/
		var ReactNoopUpdateQueue = {
			isMounted: function(publicInstance) {
				return false;
			},
			enqueueForceUpdate: function(publicInstance, callback, callerName) {
				warnNoop(publicInstance, "forceUpdate");
			},
			enqueueReplaceState: function(publicInstance, completeState, callback, callerName) {
				warnNoop(publicInstance, "replaceState");
			},
			enqueueSetState: function(publicInstance, partialState, callback, callerName) {
				warnNoop(publicInstance, "setState");
			}
		};
		var assign = Object.assign;
		var emptyObject = {};
		Object.freeze(emptyObject);
		/**
		* Base class helpers for the updating state of a component.
		*/
		function Component(props, context, updater) {
			this.props = props;
			this.context = context;
			this.refs = emptyObject;
			this.updater = updater || ReactNoopUpdateQueue;
		}
		Component.prototype.isReactComponent = {};
		/**
		* Sets a subset of the state. Always use this to mutate
		* state. You should treat `this.state` as immutable.
		*
		* There is no guarantee that `this.state` will be immediately updated, so
		* accessing `this.state` after calling this method may return the old value.
		*
		* There is no guarantee that calls to `setState` will run synchronously,
		* as they may eventually be batched together.  You can provide an optional
		* callback that will be executed when the call to setState is actually
		* completed.
		*
		* When a function is provided to setState, it will be called at some point in
		* the future (not synchronously). It will be called with the up to date
		* component arguments (state, props, context). These values can be different
		* from this.* because your function may be called after receiveProps but before
		* shouldComponentUpdate, and this new state, props, and context will not yet be
		* assigned to this.
		*
		* @param {object|function} partialState Next partial state or function to
		*        produce next partial state to be merged with current state.
		* @param {?function} callback Called after state is updated.
		* @final
		* @protected
		*/
		Component.prototype.setState = function(partialState, callback) {
			if (typeof partialState !== "object" && typeof partialState !== "function" && partialState != null) throw new Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
			this.updater.enqueueSetState(this, partialState, callback, "setState");
		};
		/**
		* Forces an update. This should only be invoked when it is known with
		* certainty that we are **not** in a DOM transaction.
		*
		* You may want to call this when you know that some deeper aspect of the
		* component's state has changed but `setState` was not called.
		*
		* This will not invoke `shouldComponentUpdate`, but it will invoke
		* `componentWillUpdate` and `componentDidUpdate`.
		*
		* @param {?function} callback Called after update is complete.
		* @final
		* @protected
		*/
		Component.prototype.forceUpdate = function(callback) {
			this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
		};
		var deprecatedAPIs = {
			isMounted: ["isMounted", "Instead, make sure to clean up subscriptions and pending requests in componentWillUnmount to prevent memory leaks."],
			replaceState: ["replaceState", "Refactor your code to use setState instead (see https://github.com/facebook/react/issues/3236)."]
		};
		var defineDeprecationWarning = function(methodName, info) {
			Object.defineProperty(Component.prototype, methodName, { get: function() {
				warn("%s(...) is deprecated in plain JavaScript React classes. %s", info[0], info[1]);
			} });
		};
		for (var fnName in deprecatedAPIs) if (deprecatedAPIs.hasOwnProperty(fnName)) defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
		function ComponentDummy() {}
		ComponentDummy.prototype = Component.prototype;
		/**
		* Convenience component with default shallow equality check for sCU.
		*/
		function PureComponent(props, context, updater) {
			this.props = props;
			this.context = context;
			this.refs = emptyObject;
			this.updater = updater || ReactNoopUpdateQueue;
		}
		var pureComponentPrototype = PureComponent.prototype = new ComponentDummy();
		pureComponentPrototype.constructor = PureComponent;
		assign(pureComponentPrototype, Component.prototype);
		pureComponentPrototype.isPureReactComponent = true;
		function createRef() {
			var refObject = { current: null };
			Object.seal(refObject);
			return refObject;
		}
		var isArrayImpl = Array.isArray;
		function isArray(a) {
			return isArrayImpl(a);
		}
		function typeName(value) {
			return typeof Symbol === "function" && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
		}
		function willCoercionThrow(value) {
			try {
				testStringCoercion(value);
				return false;
			} catch (e) {
				return true;
			}
		}
		function testStringCoercion(value) {
			return "" + value;
		}
		function checkKeyStringCoercion(value) {
			if (willCoercionThrow(value)) {
				error("The provided key is an unsupported type %s. This value must be coerced to a string before before using it here.", typeName(value));
				return testStringCoercion(value);
			}
		}
		function getWrappedName(outerType, innerType, wrapperName) {
			var displayName = outerType.displayName;
			if (displayName) return displayName;
			var functionName = innerType.displayName || innerType.name || "";
			return functionName !== "" ? wrapperName + "(" + functionName + ")" : wrapperName;
		}
		function getContextName(type) {
			return type.displayName || "Context";
		}
		function getComponentNameFromType(type) {
			if (type == null) return null;
			if (typeof type.tag === "number") error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue.");
			if (typeof type === "function") return type.displayName || type.name || null;
			if (typeof type === "string") return type;
			switch (type) {
				case REACT_FRAGMENT_TYPE: return "Fragment";
				case REACT_PORTAL_TYPE: return "Portal";
				case REACT_PROFILER_TYPE: return "Profiler";
				case REACT_STRICT_MODE_TYPE: return "StrictMode";
				case REACT_SUSPENSE_TYPE: return "Suspense";
				case REACT_SUSPENSE_LIST_TYPE: return "SuspenseList";
			}
			if (typeof type === "object") switch (type.$$typeof) {
				case REACT_CONTEXT_TYPE: return getContextName(type) + ".Consumer";
				case REACT_PROVIDER_TYPE: return getContextName(type._context) + ".Provider";
				case REACT_FORWARD_REF_TYPE: return getWrappedName(type, type.render, "ForwardRef");
				case REACT_MEMO_TYPE:
					var outerName = type.displayName || null;
					if (outerName !== null) return outerName;
					return getComponentNameFromType(type.type) || "Memo";
				case REACT_LAZY_TYPE:
					var lazyComponent = type;
					var payload = lazyComponent._payload;
					var init = lazyComponent._init;
					try {
						return getComponentNameFromType(init(payload));
					} catch (x) {
						return null;
					}
			}
			return null;
		}
		var hasOwnProperty = Object.prototype.hasOwnProperty;
		var RESERVED_PROPS = {
			key: true,
			ref: true,
			__self: true,
			__source: true
		};
		var specialPropKeyWarningShown, specialPropRefWarningShown, didWarnAboutStringRefs = {};
		function hasValidRef(config) {
			if (hasOwnProperty.call(config, "ref")) {
				var getter = Object.getOwnPropertyDescriptor(config, "ref").get;
				if (getter && getter.isReactWarning) return false;
			}
			return config.ref !== void 0;
		}
		function hasValidKey(config) {
			if (hasOwnProperty.call(config, "key")) {
				var getter = Object.getOwnPropertyDescriptor(config, "key").get;
				if (getter && getter.isReactWarning) return false;
			}
			return config.key !== void 0;
		}
		function defineKeyPropWarningGetter(props, displayName) {
			var warnAboutAccessingKey = function() {
				if (!specialPropKeyWarningShown) {
					specialPropKeyWarningShown = true;
					error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", displayName);
				}
			};
			warnAboutAccessingKey.isReactWarning = true;
			Object.defineProperty(props, "key", {
				get: warnAboutAccessingKey,
				configurable: true
			});
		}
		function defineRefPropWarningGetter(props, displayName) {
			var warnAboutAccessingRef = function() {
				if (!specialPropRefWarningShown) {
					specialPropRefWarningShown = true;
					error("%s: `ref` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", displayName);
				}
			};
			warnAboutAccessingRef.isReactWarning = true;
			Object.defineProperty(props, "ref", {
				get: warnAboutAccessingRef,
				configurable: true
			});
		}
		function warnIfStringRefCannotBeAutoConverted(config) {
			if (typeof config.ref === "string" && ReactCurrentOwner.current && config.__self && ReactCurrentOwner.current.stateNode !== config.__self) {
				var componentName = getComponentNameFromType(ReactCurrentOwner.current.type);
				if (!didWarnAboutStringRefs[componentName]) {
					error("Component \"%s\" contains the string ref \"%s\". Support for string refs will be removed in a future major release. This case cannot be automatically converted to an arrow function. We ask you to manually fix this case by using useRef() or createRef() instead. Learn more about using refs safely here: https://reactjs.org/link/strict-mode-string-ref", componentName, config.ref);
					didWarnAboutStringRefs[componentName] = true;
				}
			}
		}
		/**
		* Factory method to create a new React element. This no longer adheres to
		* the class pattern, so do not use new to call it. Also, instanceof check
		* will not work. Instead test $$typeof field against Symbol.for('react.element') to check
		* if something is a React Element.
		*
		* @param {*} type
		* @param {*} props
		* @param {*} key
		* @param {string|object} ref
		* @param {*} owner
		* @param {*} self A *temporary* helper to detect places where `this` is
		* different from the `owner` when React.createElement is called, so that we
		* can warn. We want to get rid of owner and replace string `ref`s with arrow
		* functions, and as long as `this` and owner are the same, there will be no
		* change in behavior.
		* @param {*} source An annotation object (added by a transpiler or otherwise)
		* indicating filename, line number, and/or other information.
		* @internal
		*/
		var ReactElement = function(type, key, ref, self, source, owner, props) {
			var element = {
				$$typeof: REACT_ELEMENT_TYPE,
				type,
				key,
				ref,
				props,
				_owner: owner
			};
			element._store = {};
			Object.defineProperty(element._store, "validated", {
				configurable: false,
				enumerable: false,
				writable: true,
				value: false
			});
			Object.defineProperty(element, "_self", {
				configurable: false,
				enumerable: false,
				writable: false,
				value: self
			});
			Object.defineProperty(element, "_source", {
				configurable: false,
				enumerable: false,
				writable: false,
				value: source
			});
			if (Object.freeze) {
				Object.freeze(element.props);
				Object.freeze(element);
			}
			return element;
		};
		/**
		* Create and return a new ReactElement of the given type.
		* See https://reactjs.org/docs/react-api.html#createelement
		*/
		function createElement(type, config, children) {
			var propName;
			var props = {};
			var key = null;
			var ref = null;
			var self = null;
			var source = null;
			if (config != null) {
				if (hasValidRef(config)) {
					ref = config.ref;
					warnIfStringRefCannotBeAutoConverted(config);
				}
				if (hasValidKey(config)) {
					checkKeyStringCoercion(config.key);
					key = "" + config.key;
				}
				self = config.__self === void 0 ? null : config.__self;
				source = config.__source === void 0 ? null : config.__source;
				for (propName in config) if (hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) props[propName] = config[propName];
			}
			var childrenLength = arguments.length - 2;
			if (childrenLength === 1) props.children = children;
			else if (childrenLength > 1) {
				var childArray = Array(childrenLength);
				for (var i = 0; i < childrenLength; i++) childArray[i] = arguments[i + 2];
				if (Object.freeze) Object.freeze(childArray);
				props.children = childArray;
			}
			if (type && type.defaultProps) {
				var defaultProps = type.defaultProps;
				for (propName in defaultProps) if (props[propName] === void 0) props[propName] = defaultProps[propName];
			}
			if (key || ref) {
				var displayName = typeof type === "function" ? type.displayName || type.name || "Unknown" : type;
				if (key) defineKeyPropWarningGetter(props, displayName);
				if (ref) defineRefPropWarningGetter(props, displayName);
			}
			return ReactElement(type, key, ref, self, source, ReactCurrentOwner.current, props);
		}
		function cloneAndReplaceKey(oldElement, newKey) {
			return ReactElement(oldElement.type, newKey, oldElement.ref, oldElement._self, oldElement._source, oldElement._owner, oldElement.props);
		}
		/**
		* Clone and return a new ReactElement using element as the starting point.
		* See https://reactjs.org/docs/react-api.html#cloneelement
		*/
		function cloneElement(element, config, children) {
			if (element === null || element === void 0) throw new Error("React.cloneElement(...): The argument must be a React element, but you passed " + element + ".");
			var propName;
			var props = assign({}, element.props);
			var key = element.key;
			var ref = element.ref;
			var self = element._self;
			var source = element._source;
			var owner = element._owner;
			if (config != null) {
				if (hasValidRef(config)) {
					ref = config.ref;
					owner = ReactCurrentOwner.current;
				}
				if (hasValidKey(config)) {
					checkKeyStringCoercion(config.key);
					key = "" + config.key;
				}
				var defaultProps;
				if (element.type && element.type.defaultProps) defaultProps = element.type.defaultProps;
				for (propName in config) if (hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) if (config[propName] === void 0 && defaultProps !== void 0) props[propName] = defaultProps[propName];
				else props[propName] = config[propName];
			}
			var childrenLength = arguments.length - 2;
			if (childrenLength === 1) props.children = children;
			else if (childrenLength > 1) {
				var childArray = Array(childrenLength);
				for (var i = 0; i < childrenLength; i++) childArray[i] = arguments[i + 2];
				props.children = childArray;
			}
			return ReactElement(element.type, key, ref, self, source, owner, props);
		}
		/**
		* Verifies the object is a ReactElement.
		* See https://reactjs.org/docs/react-api.html#isvalidelement
		* @param {?object} object
		* @return {boolean} True if `object` is a ReactElement.
		* @final
		*/
		function isValidElement(object) {
			return typeof object === "object" && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;
		}
		var SEPARATOR = ".";
		var SUBSEPARATOR = ":";
		/**
		* Escape and wrap key so it is safe to use as a reactid
		*
		* @param {string} key to be escaped.
		* @return {string} the escaped key.
		*/
		function escape(key) {
			var escapeRegex = /[=:]/g;
			var escaperLookup = {
				"=": "=0",
				":": "=2"
			};
			return "$" + key.replace(escapeRegex, function(match) {
				return escaperLookup[match];
			});
		}
		/**
		* TODO: Test that a single child and an array with one item have the same key
		* pattern.
		*/
		var didWarnAboutMaps = false;
		var userProvidedKeyEscapeRegex = /\/+/g;
		function escapeUserProvidedKey(text) {
			return text.replace(userProvidedKeyEscapeRegex, "$&/");
		}
		/**
		* Generate a key string that identifies a element within a set.
		*
		* @param {*} element A element that could contain a manual key.
		* @param {number} index Index that is used if a manual key is not provided.
		* @return {string}
		*/
		function getElementKey(element, index) {
			if (typeof element === "object" && element !== null && element.key != null) {
				checkKeyStringCoercion(element.key);
				return escape("" + element.key);
			}
			return index.toString(36);
		}
		function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
			var type = typeof children;
			if (type === "undefined" || type === "boolean") children = null;
			var invokeCallback = false;
			if (children === null) invokeCallback = true;
			else switch (type) {
				case "string":
				case "number":
					invokeCallback = true;
					break;
				case "object": switch (children.$$typeof) {
					case REACT_ELEMENT_TYPE:
					case REACT_PORTAL_TYPE: invokeCallback = true;
				}
			}
			if (invokeCallback) {
				var _child = children;
				var mappedChild = callback(_child);
				var childKey = nameSoFar === "" ? SEPARATOR + getElementKey(_child, 0) : nameSoFar;
				if (isArray(mappedChild)) {
					var escapedChildKey = "";
					if (childKey != null) escapedChildKey = escapeUserProvidedKey(childKey) + "/";
					mapIntoArray(mappedChild, array, escapedChildKey, "", function(c) {
						return c;
					});
				} else if (mappedChild != null) {
					if (isValidElement(mappedChild)) {
						if (mappedChild.key && (!_child || _child.key !== mappedChild.key)) checkKeyStringCoercion(mappedChild.key);
						mappedChild = cloneAndReplaceKey(mappedChild, escapedPrefix + (mappedChild.key && (!_child || _child.key !== mappedChild.key) ? escapeUserProvidedKey("" + mappedChild.key) + "/" : "") + childKey);
					}
					array.push(mappedChild);
				}
				return 1;
			}
			var child;
			var nextName;
			var subtreeCount = 0;
			var nextNamePrefix = nameSoFar === "" ? SEPARATOR : nameSoFar + SUBSEPARATOR;
			if (isArray(children)) for (var i = 0; i < children.length; i++) {
				child = children[i];
				nextName = nextNamePrefix + getElementKey(child, i);
				subtreeCount += mapIntoArray(child, array, escapedPrefix, nextName, callback);
			}
			else {
				var iteratorFn = getIteratorFn(children);
				if (typeof iteratorFn === "function") {
					var iterableChildren = children;
					if (iteratorFn === iterableChildren.entries) {
						if (!didWarnAboutMaps) warn("Using Maps as children is not supported. Use an array of keyed ReactElements instead.");
						didWarnAboutMaps = true;
					}
					var iterator = iteratorFn.call(iterableChildren);
					var step;
					var ii = 0;
					while (!(step = iterator.next()).done) {
						child = step.value;
						nextName = nextNamePrefix + getElementKey(child, ii++);
						subtreeCount += mapIntoArray(child, array, escapedPrefix, nextName, callback);
					}
				} else if (type === "object") {
					var childrenString = String(children);
					throw new Error("Objects are not valid as a React child (found: " + (childrenString === "[object Object]" ? "object with keys {" + Object.keys(children).join(", ") + "}" : childrenString) + "). If you meant to render a collection of children, use an array instead.");
				}
			}
			return subtreeCount;
		}
		/**
		* Maps children that are typically specified as `props.children`.
		*
		* See https://reactjs.org/docs/react-api.html#reactchildrenmap
		*
		* The provided mapFunction(child, index) will be called for each
		* leaf child.
		*
		* @param {?*} children Children tree container.
		* @param {function(*, int)} func The map function.
		* @param {*} context Context for mapFunction.
		* @return {object} Object containing the ordered map of results.
		*/
		function mapChildren(children, func, context) {
			if (children == null) return children;
			var result = [];
			var count = 0;
			mapIntoArray(children, result, "", "", function(child) {
				return func.call(context, child, count++);
			});
			return result;
		}
		/**
		* Count the number of children that are typically specified as
		* `props.children`.
		*
		* See https://reactjs.org/docs/react-api.html#reactchildrencount
		*
		* @param {?*} children Children tree container.
		* @return {number} The number of children.
		*/
		function countChildren(children) {
			var n = 0;
			mapChildren(children, function() {
				n++;
			});
			return n;
		}
		/**
		* Iterates through children that are typically specified as `props.children`.
		*
		* See https://reactjs.org/docs/react-api.html#reactchildrenforeach
		*
		* The provided forEachFunc(child, index) will be called for each
		* leaf child.
		*
		* @param {?*} children Children tree container.
		* @param {function(*, int)} forEachFunc
		* @param {*} forEachContext Context for forEachContext.
		*/
		function forEachChildren(children, forEachFunc, forEachContext) {
			mapChildren(children, function() {
				forEachFunc.apply(this, arguments);
			}, forEachContext);
		}
		/**
		* Flatten a children object (typically specified as `props.children`) and
		* return an array with appropriately re-keyed children.
		*
		* See https://reactjs.org/docs/react-api.html#reactchildrentoarray
		*/
		function toArray(children) {
			return mapChildren(children, function(child) {
				return child;
			}) || [];
		}
		/**
		* Returns the first child in a collection of children and verifies that there
		* is only one child in the collection.
		*
		* See https://reactjs.org/docs/react-api.html#reactchildrenonly
		*
		* The current implementation of this function assumes that a single child gets
		* passed without a wrapper, but the purpose of this helper function is to
		* abstract away the particular structure of children.
		*
		* @param {?object} children Child collection structure.
		* @return {ReactElement} The first and only `ReactElement` contained in the
		* structure.
		*/
		function onlyChild(children) {
			if (!isValidElement(children)) throw new Error("React.Children.only expected to receive a single React element child.");
			return children;
		}
		function createContext(defaultValue) {
			var context = {
				$$typeof: REACT_CONTEXT_TYPE,
				_currentValue: defaultValue,
				_currentValue2: defaultValue,
				_threadCount: 0,
				Provider: null,
				Consumer: null,
				_defaultValue: null,
				_globalName: null
			};
			context.Provider = {
				$$typeof: REACT_PROVIDER_TYPE,
				_context: context
			};
			var hasWarnedAboutUsingNestedContextConsumers = false;
			var hasWarnedAboutUsingConsumerProvider = false;
			var hasWarnedAboutDisplayNameOnConsumer = false;
			var Consumer = {
				$$typeof: REACT_CONTEXT_TYPE,
				_context: context
			};
			Object.defineProperties(Consumer, {
				Provider: {
					get: function() {
						if (!hasWarnedAboutUsingConsumerProvider) {
							hasWarnedAboutUsingConsumerProvider = true;
							error("Rendering <Context.Consumer.Provider> is not supported and will be removed in a future major release. Did you mean to render <Context.Provider> instead?");
						}
						return context.Provider;
					},
					set: function(_Provider) {
						context.Provider = _Provider;
					}
				},
				_currentValue: {
					get: function() {
						return context._currentValue;
					},
					set: function(_currentValue) {
						context._currentValue = _currentValue;
					}
				},
				_currentValue2: {
					get: function() {
						return context._currentValue2;
					},
					set: function(_currentValue2) {
						context._currentValue2 = _currentValue2;
					}
				},
				_threadCount: {
					get: function() {
						return context._threadCount;
					},
					set: function(_threadCount) {
						context._threadCount = _threadCount;
					}
				},
				Consumer: { get: function() {
					if (!hasWarnedAboutUsingNestedContextConsumers) {
						hasWarnedAboutUsingNestedContextConsumers = true;
						error("Rendering <Context.Consumer.Consumer> is not supported and will be removed in a future major release. Did you mean to render <Context.Consumer> instead?");
					}
					return context.Consumer;
				} },
				displayName: {
					get: function() {
						return context.displayName;
					},
					set: function(displayName) {
						if (!hasWarnedAboutDisplayNameOnConsumer) {
							warn("Setting `displayName` on Context.Consumer has no effect. You should set it directly on the context with Context.displayName = '%s'.", displayName);
							hasWarnedAboutDisplayNameOnConsumer = true;
						}
					}
				}
			});
			context.Consumer = Consumer;
			context._currentRenderer = null;
			context._currentRenderer2 = null;
			return context;
		}
		var Uninitialized = -1;
		var Pending = 0;
		var Resolved = 1;
		var Rejected = 2;
		function lazyInitializer(payload) {
			if (payload._status === Uninitialized) {
				var ctor = payload._result;
				var thenable = ctor();
				thenable.then(function(moduleObject) {
					if (payload._status === Pending || payload._status === Uninitialized) {
						var resolved = payload;
						resolved._status = Resolved;
						resolved._result = moduleObject;
					}
				}, function(error) {
					if (payload._status === Pending || payload._status === Uninitialized) {
						var rejected = payload;
						rejected._status = Rejected;
						rejected._result = error;
					}
				});
				if (payload._status === Uninitialized) {
					var pending = payload;
					pending._status = Pending;
					pending._result = thenable;
				}
			}
			if (payload._status === Resolved) {
				var moduleObject = payload._result;
				if (moduleObject === void 0) error("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))\n\nDid you accidentally put curly braces around the import?", moduleObject);
				if (!("default" in moduleObject)) error("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))", moduleObject);
				return moduleObject.default;
			} else throw payload._result;
		}
		function lazy(ctor) {
			var lazyType = {
				$$typeof: REACT_LAZY_TYPE,
				_payload: {
					_status: Uninitialized,
					_result: ctor
				},
				_init: lazyInitializer
			};
			var defaultProps;
			var propTypes;
			Object.defineProperties(lazyType, {
				defaultProps: {
					configurable: true,
					get: function() {
						return defaultProps;
					},
					set: function(newDefaultProps) {
						error("React.lazy(...): It is not supported to assign `defaultProps` to a lazy component import. Either specify them where the component is defined, or create a wrapping component around it.");
						defaultProps = newDefaultProps;
						Object.defineProperty(lazyType, "defaultProps", { enumerable: true });
					}
				},
				propTypes: {
					configurable: true,
					get: function() {
						return propTypes;
					},
					set: function(newPropTypes) {
						error("React.lazy(...): It is not supported to assign `propTypes` to a lazy component import. Either specify them where the component is defined, or create a wrapping component around it.");
						propTypes = newPropTypes;
						Object.defineProperty(lazyType, "propTypes", { enumerable: true });
					}
				}
			});
			return lazyType;
		}
		function forwardRef(render) {
			if (render != null && render.$$typeof === REACT_MEMO_TYPE) error("forwardRef requires a render function but received a `memo` component. Instead of forwardRef(memo(...)), use memo(forwardRef(...)).");
			else if (typeof render !== "function") error("forwardRef requires a render function but was given %s.", render === null ? "null" : typeof render);
			else if (render.length !== 0 && render.length !== 2) error("forwardRef render functions accept exactly two parameters: props and ref. %s", render.length === 1 ? "Did you forget to use the ref parameter?" : "Any additional parameter will be undefined.");
			if (render != null) {
				if (render.defaultProps != null || render.propTypes != null) error("forwardRef render functions do not support propTypes or defaultProps. Did you accidentally pass a React component?");
			}
			var elementType = {
				$$typeof: REACT_FORWARD_REF_TYPE,
				render
			};
			var ownName;
			Object.defineProperty(elementType, "displayName", {
				enumerable: false,
				configurable: true,
				get: function() {
					return ownName;
				},
				set: function(name) {
					ownName = name;
					if (!render.name && !render.displayName) render.displayName = name;
				}
			});
			return elementType;
		}
		var REACT_MODULE_REFERENCE = Symbol.for("react.module.reference");
		function isValidElementType(type) {
			if (typeof type === "string" || typeof type === "function") return true;
			if (type === REACT_FRAGMENT_TYPE || type === REACT_PROFILER_TYPE || enableDebugTracing || type === REACT_STRICT_MODE_TYPE || type === REACT_SUSPENSE_TYPE || type === REACT_SUSPENSE_LIST_TYPE || enableLegacyHidden || type === REACT_OFFSCREEN_TYPE || enableScopeAPI || enableCacheElement || enableTransitionTracing) return true;
			if (typeof type === "object" && type !== null) {
				if (type.$$typeof === REACT_LAZY_TYPE || type.$$typeof === REACT_MEMO_TYPE || type.$$typeof === REACT_PROVIDER_TYPE || type.$$typeof === REACT_CONTEXT_TYPE || type.$$typeof === REACT_FORWARD_REF_TYPE || type.$$typeof === REACT_MODULE_REFERENCE || type.getModuleId !== void 0) return true;
			}
			return false;
		}
		function memo(type, compare) {
			if (!isValidElementType(type)) error("memo: The first argument must be a component. Instead received: %s", type === null ? "null" : typeof type);
			var elementType = {
				$$typeof: REACT_MEMO_TYPE,
				type,
				compare: compare === void 0 ? null : compare
			};
			var ownName;
			Object.defineProperty(elementType, "displayName", {
				enumerable: false,
				configurable: true,
				get: function() {
					return ownName;
				},
				set: function(name) {
					ownName = name;
					if (!type.name && !type.displayName) type.displayName = name;
				}
			});
			return elementType;
		}
		function resolveDispatcher() {
			var dispatcher = ReactCurrentDispatcher.current;
			if (dispatcher === null) error("Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\n1. You might have mismatching versions of React and the renderer (such as React DOM)\n2. You might be breaking the Rules of Hooks\n3. You might have more than one copy of React in the same app\nSee https://reactjs.org/link/invalid-hook-call for tips about how to debug and fix this problem.");
			return dispatcher;
		}
		function useContext(Context) {
			var dispatcher = resolveDispatcher();
			if (Context._context !== void 0) {
				var realContext = Context._context;
				if (realContext.Consumer === Context) error("Calling useContext(Context.Consumer) is not supported, may cause bugs, and will be removed in a future major release. Did you mean to call useContext(Context) instead?");
				else if (realContext.Provider === Context) error("Calling useContext(Context.Provider) is not supported. Did you mean to call useContext(Context) instead?");
			}
			return dispatcher.useContext(Context);
		}
		function useState(initialState) {
			return resolveDispatcher().useState(initialState);
		}
		function useReducer(reducer, initialArg, init) {
			return resolveDispatcher().useReducer(reducer, initialArg, init);
		}
		function useRef(initialValue) {
			return resolveDispatcher().useRef(initialValue);
		}
		function useEffect(create, deps) {
			return resolveDispatcher().useEffect(create, deps);
		}
		function useInsertionEffect(create, deps) {
			return resolveDispatcher().useInsertionEffect(create, deps);
		}
		function useLayoutEffect(create, deps) {
			return resolveDispatcher().useLayoutEffect(create, deps);
		}
		function useCallback(callback, deps) {
			return resolveDispatcher().useCallback(callback, deps);
		}
		function useMemo(create, deps) {
			return resolveDispatcher().useMemo(create, deps);
		}
		function useImperativeHandle(ref, create, deps) {
			return resolveDispatcher().useImperativeHandle(ref, create, deps);
		}
		function useDebugValue(value, formatterFn) {
			return resolveDispatcher().useDebugValue(value, formatterFn);
		}
		function useTransition() {
			return resolveDispatcher().useTransition();
		}
		function useDeferredValue(value) {
			return resolveDispatcher().useDeferredValue(value);
		}
		function useId() {
			return resolveDispatcher().useId();
		}
		function useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
			return resolveDispatcher().useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
		}
		var disabledDepth = 0;
		var prevLog;
		var prevInfo;
		var prevWarn;
		var prevError;
		var prevGroup;
		var prevGroupCollapsed;
		var prevGroupEnd;
		function disabledLog() {}
		disabledLog.__reactDisabledLog = true;
		function disableLogs() {
			if (disabledDepth === 0) {
				prevLog = console.log;
				prevInfo = console.info;
				prevWarn = console.warn;
				prevError = console.error;
				prevGroup = console.group;
				prevGroupCollapsed = console.groupCollapsed;
				prevGroupEnd = console.groupEnd;
				var props = {
					configurable: true,
					enumerable: true,
					value: disabledLog,
					writable: true
				};
				Object.defineProperties(console, {
					info: props,
					log: props,
					warn: props,
					error: props,
					group: props,
					groupCollapsed: props,
					groupEnd: props
				});
			}
			disabledDepth++;
		}
		function reenableLogs() {
			disabledDepth--;
			if (disabledDepth === 0) {
				var props = {
					configurable: true,
					enumerable: true,
					writable: true
				};
				Object.defineProperties(console, {
					log: assign({}, props, { value: prevLog }),
					info: assign({}, props, { value: prevInfo }),
					warn: assign({}, props, { value: prevWarn }),
					error: assign({}, props, { value: prevError }),
					group: assign({}, props, { value: prevGroup }),
					groupCollapsed: assign({}, props, { value: prevGroupCollapsed }),
					groupEnd: assign({}, props, { value: prevGroupEnd })
				});
			}
			if (disabledDepth < 0) error("disabledDepth fell below zero. This is a bug in React. Please file an issue.");
		}
		var ReactCurrentDispatcher$1 = ReactSharedInternals.ReactCurrentDispatcher;
		var prefix;
		function describeBuiltInComponentFrame(name, source, ownerFn) {
			if (prefix === void 0) try {
				throw Error();
			} catch (x) {
				var match = x.stack.trim().match(/\n( *(at )?)/);
				prefix = match && match[1] || "";
			}
			return "\n" + prefix + name;
		}
		var reentry = false;
		var componentFrameCache = new (typeof WeakMap === "function" ? WeakMap : Map)();
		function describeNativeComponentFrame(fn, construct) {
			if (!fn || reentry) return "";
			var frame = componentFrameCache.get(fn);
			if (frame !== void 0) return frame;
			var control;
			reentry = true;
			var previousPrepareStackTrace = Error.prepareStackTrace;
			Error.prepareStackTrace = void 0;
			var previousDispatcher = ReactCurrentDispatcher$1.current;
			ReactCurrentDispatcher$1.current = null;
			disableLogs();
			try {
				if (construct) {
					var Fake = function() {
						throw Error();
					};
					Object.defineProperty(Fake.prototype, "props", { set: function() {
						throw Error();
					} });
					if (typeof Reflect === "object" && Reflect.construct) {
						try {
							Reflect.construct(Fake, []);
						} catch (x) {
							control = x;
						}
						Reflect.construct(fn, [], Fake);
					} else {
						try {
							Fake.call();
						} catch (x) {
							control = x;
						}
						fn.call(Fake.prototype);
					}
				} else {
					try {
						throw Error();
					} catch (x) {
						control = x;
					}
					fn();
				}
			} catch (sample) {
				if (sample && control && typeof sample.stack === "string") {
					var sampleLines = sample.stack.split("\n");
					var controlLines = control.stack.split("\n");
					var s = sampleLines.length - 1;
					var c = controlLines.length - 1;
					while (s >= 1 && c >= 0 && sampleLines[s] !== controlLines[c]) c--;
					for (; s >= 1 && c >= 0; s--, c--) if (sampleLines[s] !== controlLines[c]) {
						if (s !== 1 || c !== 1) do {
							s--;
							c--;
							if (c < 0 || sampleLines[s] !== controlLines[c]) {
								var _frame = "\n" + sampleLines[s].replace(" at new ", " at ");
								if (fn.displayName && _frame.includes("<anonymous>")) _frame = _frame.replace("<anonymous>", fn.displayName);
								if (typeof fn === "function") componentFrameCache.set(fn, _frame);
								return _frame;
							}
						} while (s >= 1 && c >= 0);
						break;
					}
				}
			} finally {
				reentry = false;
				ReactCurrentDispatcher$1.current = previousDispatcher;
				reenableLogs();
				Error.prepareStackTrace = previousPrepareStackTrace;
			}
			var name = fn ? fn.displayName || fn.name : "";
			var syntheticFrame = name ? describeBuiltInComponentFrame(name) : "";
			if (typeof fn === "function") componentFrameCache.set(fn, syntheticFrame);
			return syntheticFrame;
		}
		function describeFunctionComponentFrame(fn, source, ownerFn) {
			return describeNativeComponentFrame(fn, false);
		}
		function shouldConstruct(Component) {
			var prototype = Component.prototype;
			return !!(prototype && prototype.isReactComponent);
		}
		function describeUnknownElementTypeFrameInDEV(type, source, ownerFn) {
			if (type == null) return "";
			if (typeof type === "function") return describeNativeComponentFrame(type, shouldConstruct(type));
			if (typeof type === "string") return describeBuiltInComponentFrame(type);
			switch (type) {
				case REACT_SUSPENSE_TYPE: return describeBuiltInComponentFrame("Suspense");
				case REACT_SUSPENSE_LIST_TYPE: return describeBuiltInComponentFrame("SuspenseList");
			}
			if (typeof type === "object") switch (type.$$typeof) {
				case REACT_FORWARD_REF_TYPE: return describeFunctionComponentFrame(type.render);
				case REACT_MEMO_TYPE: return describeUnknownElementTypeFrameInDEV(type.type, source, ownerFn);
				case REACT_LAZY_TYPE:
					var lazyComponent = type;
					var payload = lazyComponent._payload;
					var init = lazyComponent._init;
					try {
						return describeUnknownElementTypeFrameInDEV(init(payload), source, ownerFn);
					} catch (x) {}
			}
			return "";
		}
		var loggedTypeFailures = {};
		var ReactDebugCurrentFrame$1 = ReactSharedInternals.ReactDebugCurrentFrame;
		function setCurrentlyValidatingElement(element) {
			if (element) {
				var owner = element._owner;
				var stack = describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null);
				ReactDebugCurrentFrame$1.setExtraStackFrame(stack);
			} else ReactDebugCurrentFrame$1.setExtraStackFrame(null);
		}
		function checkPropTypes(typeSpecs, values, location, componentName, element) {
			var has = Function.call.bind(hasOwnProperty);
			for (var typeSpecName in typeSpecs) if (has(typeSpecs, typeSpecName)) {
				var error$1 = void 0;
				try {
					if (typeof typeSpecs[typeSpecName] !== "function") {
						var err = Error((componentName || "React class") + ": " + location + " type `" + typeSpecName + "` is invalid; it must be a function, usually from the `prop-types` package, but received `" + typeof typeSpecs[typeSpecName] + "`.This often happens because of typos such as `PropTypes.function` instead of `PropTypes.func`.");
						err.name = "Invariant Violation";
						throw err;
					}
					error$1 = typeSpecs[typeSpecName](values, typeSpecName, componentName, location, null, "SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED");
				} catch (ex) {
					error$1 = ex;
				}
				if (error$1 && !(error$1 instanceof Error)) {
					setCurrentlyValidatingElement(element);
					error("%s: type specification of %s `%s` is invalid; the type checker function must return `null` or an `Error` but returned a %s. You may have forgotten to pass an argument to the type checker creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and shape all require an argument).", componentName || "React class", location, typeSpecName, typeof error$1);
					setCurrentlyValidatingElement(null);
				}
				if (error$1 instanceof Error && !(error$1.message in loggedTypeFailures)) {
					loggedTypeFailures[error$1.message] = true;
					setCurrentlyValidatingElement(element);
					error("Failed %s type: %s", location, error$1.message);
					setCurrentlyValidatingElement(null);
				}
			}
		}
		function setCurrentlyValidatingElement$1(element) {
			if (element) {
				var owner = element._owner;
				setExtraStackFrame(describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null));
			} else setExtraStackFrame(null);
		}
		var propTypesMisspellWarningShown = false;
		function getDeclarationErrorAddendum() {
			if (ReactCurrentOwner.current) {
				var name = getComponentNameFromType(ReactCurrentOwner.current.type);
				if (name) return "\n\nCheck the render method of `" + name + "`.";
			}
			return "";
		}
		function getSourceInfoErrorAddendum(source) {
			if (source !== void 0) {
				var fileName = source.fileName.replace(/^.*[\\\/]/, "");
				var lineNumber = source.lineNumber;
				return "\n\nCheck your code at " + fileName + ":" + lineNumber + ".";
			}
			return "";
		}
		function getSourceInfoErrorAddendumForProps(elementProps) {
			if (elementProps !== null && elementProps !== void 0) return getSourceInfoErrorAddendum(elementProps.__source);
			return "";
		}
		/**
		* Warn if there's no key explicitly set on dynamic arrays of children or
		* object keys are not valid. This allows us to keep track of children between
		* updates.
		*/
		var ownerHasKeyUseWarning = {};
		function getCurrentComponentErrorInfo(parentType) {
			var info = getDeclarationErrorAddendum();
			if (!info) {
				var parentName = typeof parentType === "string" ? parentType : parentType.displayName || parentType.name;
				if (parentName) info = "\n\nCheck the top-level render call using <" + parentName + ">.";
			}
			return info;
		}
		/**
		* Warn if the element doesn't have an explicit key assigned to it.
		* This element is in an array. The array could grow and shrink or be
		* reordered. All children that haven't already been validated are required to
		* have a "key" property assigned to it. Error statuses are cached so a warning
		* will only be shown once.
		*
		* @internal
		* @param {ReactElement} element Element that requires a key.
		* @param {*} parentType element's parent's type.
		*/
		function validateExplicitKey(element, parentType) {
			if (!element._store || element._store.validated || element.key != null) return;
			element._store.validated = true;
			var currentComponentErrorInfo = getCurrentComponentErrorInfo(parentType);
			if (ownerHasKeyUseWarning[currentComponentErrorInfo]) return;
			ownerHasKeyUseWarning[currentComponentErrorInfo] = true;
			var childOwner = "";
			if (element && element._owner && element._owner !== ReactCurrentOwner.current) childOwner = " It was passed a child from " + getComponentNameFromType(element._owner.type) + ".";
			setCurrentlyValidatingElement$1(element);
			error("Each child in a list should have a unique \"key\" prop.%s%s See https://reactjs.org/link/warning-keys for more information.", currentComponentErrorInfo, childOwner);
			setCurrentlyValidatingElement$1(null);
		}
		/**
		* Ensure that every element either is passed in a static location, in an
		* array with an explicit keys property defined, or in an object literal
		* with valid key property.
		*
		* @internal
		* @param {ReactNode} node Statically passed child of any type.
		* @param {*} parentType node's parent's type.
		*/
		function validateChildKeys(node, parentType) {
			if (typeof node !== "object") return;
			if (isArray(node)) for (var i = 0; i < node.length; i++) {
				var child = node[i];
				if (isValidElement(child)) validateExplicitKey(child, parentType);
			}
			else if (isValidElement(node)) {
				if (node._store) node._store.validated = true;
			} else if (node) {
				var iteratorFn = getIteratorFn(node);
				if (typeof iteratorFn === "function") {
					if (iteratorFn !== node.entries) {
						var iterator = iteratorFn.call(node);
						var step;
						while (!(step = iterator.next()).done) if (isValidElement(step.value)) validateExplicitKey(step.value, parentType);
					}
				}
			}
		}
		/**
		* Given an element, validate that its props follow the propTypes definition,
		* provided by the type.
		*
		* @param {ReactElement} element
		*/
		function validatePropTypes(element) {
			var type = element.type;
			if (type === null || type === void 0 || typeof type === "string") return;
			var propTypes;
			if (typeof type === "function") propTypes = type.propTypes;
			else if (typeof type === "object" && (type.$$typeof === REACT_FORWARD_REF_TYPE || type.$$typeof === REACT_MEMO_TYPE)) propTypes = type.propTypes;
			else return;
			if (propTypes) {
				var name = getComponentNameFromType(type);
				checkPropTypes(propTypes, element.props, "prop", name, element);
			} else if (type.PropTypes !== void 0 && !propTypesMisspellWarningShown) {
				propTypesMisspellWarningShown = true;
				error("Component %s declared `PropTypes` instead of `propTypes`. Did you misspell the property assignment?", getComponentNameFromType(type) || "Unknown");
			}
			if (typeof type.getDefaultProps === "function" && !type.getDefaultProps.isReactClassApproved) error("getDefaultProps is only used on classic React.createClass definitions. Use a static property named `defaultProps` instead.");
		}
		/**
		* Given a fragment, validate that it can only be provided with fragment props
		* @param {ReactElement} fragment
		*/
		function validateFragmentProps(fragment) {
			var keys = Object.keys(fragment.props);
			for (var i = 0; i < keys.length; i++) {
				var key = keys[i];
				if (key !== "children" && key !== "key") {
					setCurrentlyValidatingElement$1(fragment);
					error("Invalid prop `%s` supplied to `React.Fragment`. React.Fragment can only have `key` and `children` props.", key);
					setCurrentlyValidatingElement$1(null);
					break;
				}
			}
			if (fragment.ref !== null) {
				setCurrentlyValidatingElement$1(fragment);
				error("Invalid attribute `ref` supplied to `React.Fragment`.");
				setCurrentlyValidatingElement$1(null);
			}
		}
		function createElementWithValidation(type, props, children) {
			var validType = isValidElementType(type);
			if (!validType) {
				var info = "";
				if (type === void 0 || typeof type === "object" && type !== null && Object.keys(type).length === 0) info += " You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports.";
				var sourceInfo = getSourceInfoErrorAddendumForProps(props);
				if (sourceInfo) info += sourceInfo;
				else info += getDeclarationErrorAddendum();
				var typeString;
				if (type === null) typeString = "null";
				else if (isArray(type)) typeString = "array";
				else if (type !== void 0 && type.$$typeof === REACT_ELEMENT_TYPE) {
					typeString = "<" + (getComponentNameFromType(type.type) || "Unknown") + " />";
					info = " Did you accidentally export a JSX literal instead of a component?";
				} else typeString = typeof type;
				error("React.createElement: type is invalid -- expected a string (for built-in components) or a class/function (for composite components) but got: %s.%s", typeString, info);
			}
			var element = createElement.apply(this, arguments);
			if (element == null) return element;
			if (validType) for (var i = 2; i < arguments.length; i++) validateChildKeys(arguments[i], type);
			if (type === REACT_FRAGMENT_TYPE) validateFragmentProps(element);
			else validatePropTypes(element);
			return element;
		}
		var didWarnAboutDeprecatedCreateFactory = false;
		function createFactoryWithValidation(type) {
			var validatedFactory = createElementWithValidation.bind(null, type);
			validatedFactory.type = type;
			if (!didWarnAboutDeprecatedCreateFactory) {
				didWarnAboutDeprecatedCreateFactory = true;
				warn("React.createFactory() is deprecated and will be removed in a future major release. Consider using JSX or use React.createElement() directly instead.");
			}
			Object.defineProperty(validatedFactory, "type", {
				enumerable: false,
				get: function() {
					warn("Factory.type is deprecated. Access the class directly before passing it to createFactory.");
					Object.defineProperty(this, "type", { value: type });
					return type;
				}
			});
			return validatedFactory;
		}
		function cloneElementWithValidation(element, props, children) {
			var newElement = cloneElement.apply(this, arguments);
			for (var i = 2; i < arguments.length; i++) validateChildKeys(arguments[i], newElement.type);
			validatePropTypes(newElement);
			return newElement;
		}
		function startTransition(scope, options) {
			var prevTransition = ReactCurrentBatchConfig.transition;
			ReactCurrentBatchConfig.transition = {};
			var currentTransition = ReactCurrentBatchConfig.transition;
			ReactCurrentBatchConfig.transition._updatedFibers = /* @__PURE__ */ new Set();
			try {
				scope();
			} finally {
				ReactCurrentBatchConfig.transition = prevTransition;
				if (prevTransition === null && currentTransition._updatedFibers) {
					if (currentTransition._updatedFibers.size > 10) warn("Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table.");
					currentTransition._updatedFibers.clear();
				}
			}
		}
		var didWarnAboutMessageChannel = false;
		var enqueueTaskImpl = null;
		function enqueueTask(task) {
			if (enqueueTaskImpl === null) try {
				var requireString = ("require" + Math.random()).slice(0, 7);
				enqueueTaskImpl = (module && module[requireString]).call(module, "timers").setImmediate;
			} catch (_err) {
				enqueueTaskImpl = function(callback) {
					if (didWarnAboutMessageChannel === false) {
						didWarnAboutMessageChannel = true;
						if (typeof MessageChannel === "undefined") error("This browser does not have a MessageChannel implementation, so enqueuing tasks via await act(async () => ...) will fail. Please file an issue at https://github.com/facebook/react/issues if you encounter this warning.");
					}
					var channel = new MessageChannel();
					channel.port1.onmessage = callback;
					channel.port2.postMessage(void 0);
				};
			}
			return enqueueTaskImpl(task);
		}
		var actScopeDepth = 0;
		var didWarnNoAwaitAct = false;
		function act(callback) {
			var prevActScopeDepth = actScopeDepth;
			actScopeDepth++;
			if (ReactCurrentActQueue.current === null) ReactCurrentActQueue.current = [];
			var prevIsBatchingLegacy = ReactCurrentActQueue.isBatchingLegacy;
			var result;
			try {
				ReactCurrentActQueue.isBatchingLegacy = true;
				result = callback();
				if (!prevIsBatchingLegacy && ReactCurrentActQueue.didScheduleLegacyUpdate) {
					var queue = ReactCurrentActQueue.current;
					if (queue !== null) {
						ReactCurrentActQueue.didScheduleLegacyUpdate = false;
						flushActQueue(queue);
					}
				}
			} catch (error) {
				popActScope(prevActScopeDepth);
				throw error;
			} finally {
				ReactCurrentActQueue.isBatchingLegacy = prevIsBatchingLegacy;
			}
			if (result !== null && typeof result === "object" && typeof result.then === "function") {
				var thenableResult = result;
				var wasAwaited = false;
				var thenable = { then: function(resolve, reject) {
					wasAwaited = true;
					thenableResult.then(function(returnValue) {
						popActScope(prevActScopeDepth);
						if (actScopeDepth === 0) recursivelyFlushAsyncActWork(returnValue, resolve, reject);
						else resolve(returnValue);
					}, function(error) {
						popActScope(prevActScopeDepth);
						reject(error);
					});
				} };
				if (!didWarnNoAwaitAct && typeof Promise !== "undefined") Promise.resolve().then(function() {}).then(function() {
					if (!wasAwaited) {
						didWarnNoAwaitAct = true;
						error("You called act(async () => ...) without await. This could lead to unexpected testing behaviour, interleaving multiple act calls and mixing their scopes. You should - await act(async () => ...);");
					}
				});
				return thenable;
			} else {
				var returnValue = result;
				popActScope(prevActScopeDepth);
				if (actScopeDepth === 0) {
					var _queue = ReactCurrentActQueue.current;
					if (_queue !== null) {
						flushActQueue(_queue);
						ReactCurrentActQueue.current = null;
					}
					return { then: function(resolve, reject) {
						if (ReactCurrentActQueue.current === null) {
							ReactCurrentActQueue.current = [];
							recursivelyFlushAsyncActWork(returnValue, resolve, reject);
						} else resolve(returnValue);
					} };
				} else return { then: function(resolve, reject) {
					resolve(returnValue);
				} };
			}
		}
		function popActScope(prevActScopeDepth) {
			if (prevActScopeDepth !== actScopeDepth - 1) error("You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one. ");
			actScopeDepth = prevActScopeDepth;
		}
		function recursivelyFlushAsyncActWork(returnValue, resolve, reject) {
			var queue = ReactCurrentActQueue.current;
			if (queue !== null) try {
				flushActQueue(queue);
				enqueueTask(function() {
					if (queue.length === 0) {
						ReactCurrentActQueue.current = null;
						resolve(returnValue);
					} else recursivelyFlushAsyncActWork(returnValue, resolve, reject);
				});
			} catch (error) {
				reject(error);
			}
			else resolve(returnValue);
		}
		var isFlushing = false;
		function flushActQueue(queue) {
			if (!isFlushing) {
				isFlushing = true;
				var i = 0;
				try {
					for (; i < queue.length; i++) {
						var callback = queue[i];
						do
							callback = callback(true);
						while (callback !== null);
					}
					queue.length = 0;
				} catch (error) {
					queue = queue.slice(i + 1);
					throw error;
				} finally {
					isFlushing = false;
				}
			}
		}
		var createElement$1 = createElementWithValidation;
		var cloneElement$1 = cloneElementWithValidation;
		var createFactory = createFactoryWithValidation;
		exports.Children = {
			map: mapChildren,
			forEach: forEachChildren,
			count: countChildren,
			toArray,
			only: onlyChild
		};
		exports.Component = Component;
		exports.Fragment = REACT_FRAGMENT_TYPE;
		exports.Profiler = REACT_PROFILER_TYPE;
		exports.PureComponent = PureComponent;
		exports.StrictMode = REACT_STRICT_MODE_TYPE;
		exports.Suspense = REACT_SUSPENSE_TYPE;
		exports.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = ReactSharedInternals;
		exports.act = act;
		exports.cloneElement = cloneElement$1;
		exports.createContext = createContext;
		exports.createElement = createElement$1;
		exports.createFactory = createFactory;
		exports.createRef = createRef;
		exports.forwardRef = forwardRef;
		exports.isValidElement = isValidElement;
		exports.lazy = lazy;
		exports.memo = memo;
		exports.startTransition = startTransition;
		exports.unstable_act = act;
		exports.useCallback = useCallback;
		exports.useContext = useContext;
		exports.useDebugValue = useDebugValue;
		exports.useDeferredValue = useDeferredValue;
		exports.useEffect = useEffect;
		exports.useId = useId;
		exports.useImperativeHandle = useImperativeHandle;
		exports.useInsertionEffect = useInsertionEffect;
		exports.useLayoutEffect = useLayoutEffect;
		exports.useMemo = useMemo;
		exports.useReducer = useReducer;
		exports.useRef = useRef;
		exports.useState = useState;
		exports.useSyncExternalStore = useSyncExternalStore;
		exports.useTransition = useTransition;
		exports.version = ReactVersion;
		if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop === "function") __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(/* @__PURE__ */ new Error());
	})();
}));
//#endregion
//#region ../../node_modules/.pnpm/react@18.3.1/node_modules/react/index.js
var require_react = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	if (process.env.NODE_ENV === "production") module.exports = require_react_production_min();
	else module.exports = require_react_development();
}));
//#endregion
//#region ../../packages/workbuddy-app/src/shared/ipc-channels.ts
var HOST_PLATFORM_GET_SYNC_CHANNEL, WECHAT_IS_INSTALLED_SYNC_CHANNEL, WECHAT_GET_VERSION_SYNC_CHANNEL, WECHAT_IS_RUNNING_SYNC_CHANNEL, WECHAT_LAUNCH_CHANNEL;
var init_ipc_channels$1 = __esmMin((() => {
	HOST_PLATFORM_GET_SYNC_CHANNEL = "host-platform:get-sync";
	WECHAT_IS_INSTALLED_SYNC_CHANNEL = "wechat:isInstalledSync";
	WECHAT_GET_VERSION_SYNC_CHANNEL = "wechat:getVersionSync";
	WECHAT_IS_RUNNING_SYNC_CHANNEL = "wechat:isRunningSync";
	WECHAT_LAUNCH_CHANNEL = "wechat:launchClient";
}));
//#endregion
//#region ../../packages/workbuddy-app/src/desktop/daemon/legacy-api.ts
var init_legacy_api = __esmMin((() => {
	init_client$2();
}));
var init_runtime = __esmMin((() => {
	require_react();
	init_client$2();
	init_legacy_api();
}));
//#endregion
//#region ../../packages/workbuddy-app/src/desktop/daemon/index.ts
var init_daemon = __esmMin((() => {
	init_client$2();
	init_desktop_daemon_transport();
	init_mcp_apps_wb_api();
	init_runtime();
}));
//#endregion
//#region ../../packages/workbuddy-app/src/desktop/index.ts
var init_desktop = __esmMin((() => {
	init_clipboard();
	init_dialog();
	init_host();
	init_host_platform();
	init_notification();
	init_opener();
	init_daemon();
}));
//#endregion
//#region ../../node_modules/.pnpm/electron-log@5.4.3/node_modules/electron-log/src/core/scope.js
var require_scope = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = scopeFactory;
	function scopeFactory(logger) {
		return Object.defineProperties(scope, {
			defaultLabel: {
				value: "",
				writable: true
			},
			labelPadding: {
				value: true,
				writable: true
			},
			maxLabelLength: {
				value: 0,
				writable: true
			},
			labelLength: { get() {
				switch (typeof scope.labelPadding) {
					case "boolean": return scope.labelPadding ? scope.maxLabelLength : 0;
					case "number": return scope.labelPadding;
					default: return 0;
				}
			} }
		});
		function scope(label) {
			scope.maxLabelLength = Math.max(scope.maxLabelLength, label.length);
			const newScope = {};
			for (const level of logger.levels) newScope[level] = (...d) => logger.logData(d, {
				level,
				scope: label
			});
			newScope.log = newScope.info;
			return newScope;
		}
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/electron-log@5.4.3/node_modules/electron-log/src/core/Buffering.js
var require_Buffering = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Buffering = class {
		constructor({ processMessage }) {
			this.processMessage = processMessage;
			this.buffer = [];
			this.enabled = false;
			this.begin = this.begin.bind(this);
			this.commit = this.commit.bind(this);
			this.reject = this.reject.bind(this);
		}
		addMessage(message) {
			this.buffer.push(message);
		}
		begin() {
			this.enabled = [];
		}
		commit() {
			this.enabled = false;
			this.buffer.forEach((item) => this.processMessage(item));
			this.buffer = [];
		}
		reject() {
			this.enabled = false;
			this.buffer = [];
		}
	};
	module.exports = Buffering;
}));
//#endregion
//#region ../../node_modules/.pnpm/electron-log@5.4.3/node_modules/electron-log/src/core/Logger.js
var require_Logger = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var scopeFactory = require_scope();
	var Buffering = require_Buffering();
	module.exports = class Logger {
		static instances = {};
		dependencies = {};
		errorHandler = null;
		eventLogger = null;
		functions = {};
		hooks = [];
		isDev = false;
		levels = null;
		logId = null;
		scope = null;
		transports = {};
		variables = {};
		constructor({ allowUnknownLevel = false, dependencies = {}, errorHandler, eventLogger, initializeFn, isDev = false, levels = [
			"error",
			"warn",
			"info",
			"verbose",
			"debug",
			"silly"
		], logId, transportFactories = {}, variables } = {}) {
			this.addLevel = this.addLevel.bind(this);
			this.create = this.create.bind(this);
			this.initialize = this.initialize.bind(this);
			this.logData = this.logData.bind(this);
			this.processMessage = this.processMessage.bind(this);
			this.allowUnknownLevel = allowUnknownLevel;
			this.buffering = new Buffering(this);
			this.dependencies = dependencies;
			this.initializeFn = initializeFn;
			this.isDev = isDev;
			this.levels = levels;
			this.logId = logId;
			this.scope = scopeFactory(this);
			this.transportFactories = transportFactories;
			this.variables = variables || {};
			for (const name of this.levels) this.addLevel(name, false);
			this.log = this.info;
			this.functions.log = this.log;
			this.errorHandler = errorHandler;
			errorHandler?.setOptions({
				...dependencies,
				logFn: this.error
			});
			this.eventLogger = eventLogger;
			eventLogger?.setOptions({
				...dependencies,
				logger: this
			});
			for (const [name, factory] of Object.entries(transportFactories)) this.transports[name] = factory(this, dependencies);
			Logger.instances[logId] = this;
		}
		static getInstance({ logId }) {
			return this.instances[logId] || this.instances.default;
		}
		addLevel(level, index = this.levels.length) {
			if (index !== false) this.levels.splice(index, 0, level);
			this[level] = (...args) => this.logData(args, { level });
			this.functions[level] = this[level];
		}
		catchErrors(options) {
			this.processMessage({
				data: ["log.catchErrors is deprecated. Use log.errorHandler instead"],
				level: "warn"
			}, { transports: ["console"] });
			return this.errorHandler.startCatching(options);
		}
		create(options) {
			if (typeof options === "string") options = { logId: options };
			return new Logger({
				dependencies: this.dependencies,
				errorHandler: this.errorHandler,
				initializeFn: this.initializeFn,
				isDev: this.isDev,
				transportFactories: this.transportFactories,
				variables: { ...this.variables },
				...options
			});
		}
		compareLevels(passLevel, checkLevel, levels = this.levels) {
			const pass = levels.indexOf(passLevel);
			const check = levels.indexOf(checkLevel);
			if (check === -1 || pass === -1) return true;
			return check <= pass;
		}
		initialize(options = {}) {
			this.initializeFn({
				logger: this,
				...this.dependencies,
				...options
			});
		}
		logData(data, options = {}) {
			if (this.buffering.enabled) this.buffering.addMessage({
				data,
				date: /* @__PURE__ */ new Date(),
				...options
			});
			else this.processMessage({
				data,
				...options
			});
		}
		processMessage(message, { transports = this.transports } = {}) {
			if (message.cmd === "errorHandler") {
				this.errorHandler.handle(message.error, {
					errorName: message.errorName,
					processType: "renderer",
					showDialog: Boolean(message.showDialog)
				});
				return;
			}
			let level = message.level;
			if (!this.allowUnknownLevel) level = this.levels.includes(message.level) ? message.level : "info";
			const normalizedMessage = {
				date: /* @__PURE__ */ new Date(),
				logId: this.logId,
				...message,
				level,
				variables: {
					...this.variables,
					...message.variables
				}
			};
			for (const [transName, transFn] of this.transportEntries(transports)) {
				if (typeof transFn !== "function" || transFn.level === false) continue;
				if (!this.compareLevels(transFn.level, message.level)) continue;
				try {
					const transformedMsg = this.hooks.reduce((msg, hook) => {
						return msg ? hook(msg, transFn, transName) : msg;
					}, normalizedMessage);
					if (transformedMsg) transFn({
						...transformedMsg,
						data: [...transformedMsg.data]
					});
				} catch (e) {
					this.processInternalErrorFn(e);
				}
			}
		}
		processInternalErrorFn(_e) {}
		transportEntries(transports = this.transports) {
			return (Array.isArray(transports) ? transports : Object.entries(transports)).map((item) => {
				switch (typeof item) {
					case "string": return this.transports[item] ? [item, this.transports[item]] : null;
					case "function": return [item.name, item];
					default: return Array.isArray(item) ? item : null;
				}
			}).filter(Boolean);
		}
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/electron-log@5.4.3/node_modules/electron-log/src/renderer/lib/RendererErrorHandler.js
var require_RendererErrorHandler = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var consoleError = console.error;
	var RendererErrorHandler = class {
		logFn = null;
		onError = null;
		showDialog = false;
		preventDefault = true;
		constructor({ logFn = null } = {}) {
			this.handleError = this.handleError.bind(this);
			this.handleRejection = this.handleRejection.bind(this);
			this.startCatching = this.startCatching.bind(this);
			this.logFn = logFn;
		}
		handle(error, { logFn = this.logFn, errorName = "", onError = this.onError, showDialog = this.showDialog } = {}) {
			try {
				if (onError?.({
					error,
					errorName,
					processType: "renderer"
				}) !== false) logFn({
					error,
					errorName,
					showDialog
				});
			} catch {
				consoleError(error);
			}
		}
		setOptions({ logFn, onError, preventDefault, showDialog }) {
			if (typeof logFn === "function") this.logFn = logFn;
			if (typeof onError === "function") this.onError = onError;
			if (typeof preventDefault === "boolean") this.preventDefault = preventDefault;
			if (typeof showDialog === "boolean") this.showDialog = showDialog;
		}
		startCatching({ onError, showDialog } = {}) {
			if (this.isActive) return;
			this.isActive = true;
			this.setOptions({
				onError,
				showDialog
			});
			window.addEventListener("error", (event) => {
				this.preventDefault && event.preventDefault?.();
				this.handleError(event.error || event);
			});
			window.addEventListener("unhandledrejection", (event) => {
				this.preventDefault && event.preventDefault?.();
				this.handleRejection(event.reason || event);
			});
		}
		handleError(error) {
			this.handle(error, { errorName: "Unhandled" });
		}
		handleRejection(reason) {
			const error = reason instanceof Error ? reason : new Error(JSON.stringify(reason));
			this.handle(error, { errorName: "Unhandled rejection" });
		}
	};
	module.exports = RendererErrorHandler;
}));
//#endregion
//#region ../../node_modules/.pnpm/electron-log@5.4.3/node_modules/electron-log/src/core/transforms/transform.js
var require_transform = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = { transform };
	function transform({ logger, message, transport, initialData = message?.data || [], transforms = transport?.transforms }) {
		return transforms.reduce((data, trans) => {
			if (typeof trans === "function") return trans({
				data,
				logger,
				message,
				transport
			});
			return data;
		}, initialData);
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/electron-log@5.4.3/node_modules/electron-log/src/renderer/lib/transports/console.js
var require_console = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var { transform } = require_transform();
	module.exports = consoleTransportRendererFactory;
	var consoleMethods = {
		error: console.error,
		warn: console.warn,
		info: console.info,
		verbose: console.info,
		debug: console.debug,
		silly: console.debug,
		log: console.log
	};
	function consoleTransportRendererFactory(logger) {
		return Object.assign(transport, {
			format: "{h}:{i}:{s}.{ms}{scope} › {text}",
			transforms: [formatDataFn],
			writeFn({ message: { level, data } }) {
				const consoleLogFn = consoleMethods[level] || consoleMethods.info;
				setTimeout(() => consoleLogFn(...data));
			}
		});
		function transport(message) {
			transport.writeFn({ message: {
				...message,
				data: transform({
					logger,
					message,
					transport
				})
			} });
		}
	}
	function formatDataFn({ data = [], logger = {}, message = {}, transport = {} }) {
		if (typeof transport.format === "function") return transport.format({
			data,
			level: message?.level || "info",
			logger,
			message,
			transport
		});
		if (typeof transport.format !== "string") return data;
		data.unshift(transport.format);
		if (typeof data[1] === "string" && data[1].match(/%[1cdfiOos]/)) data = [`${data[0]}${data[1]}`, ...data.slice(2)];
		const date = message.date || /* @__PURE__ */ new Date();
		data[0] = data[0].replace(/\{(\w+)}/g, (substring, name) => {
			switch (name) {
				case "level": return message.level;
				case "logId": return message.logId;
				case "scope": {
					const scope = message.scope || logger.scope?.defaultLabel;
					return scope ? ` (${scope})` : "";
				}
				case "text": return "";
				case "y": return date.getFullYear().toString(10);
				case "m": return (date.getMonth() + 1).toString(10).padStart(2, "0");
				case "d": return date.getDate().toString(10).padStart(2, "0");
				case "h": return date.getHours().toString(10).padStart(2, "0");
				case "i": return date.getMinutes().toString(10).padStart(2, "0");
				case "s": return date.getSeconds().toString(10).padStart(2, "0");
				case "ms": return date.getMilliseconds().toString(10).padStart(3, "0");
				case "iso": return date.toISOString();
				default: return message.variables?.[name] || substring;
			}
		}).trim();
		return data;
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/electron-log@5.4.3/node_modules/electron-log/src/renderer/lib/transports/ipc.js
var require_ipc = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var { transform } = require_transform();
	module.exports = ipcTransportRendererFactory;
	var RESTRICTED_TYPES = new Set([
		Promise,
		WeakMap,
		WeakSet
	]);
	function ipcTransportRendererFactory(logger) {
		return Object.assign(transport, {
			depth: 5,
			transforms: [serializeFn]
		});
		function transport(message) {
			if (!window.__electronLog) {
				logger.processMessage({
					data: ["electron-log: logger isn't initialized in the main process"],
					level: "error"
				}, { transports: ["console"] });
				return;
			}
			try {
				const serialized = transform({
					initialData: message,
					logger,
					message,
					transport
				});
				__electronLog.sendToMain(serialized);
			} catch (e) {
				logger.transports.console({
					data: [
						"electronLog.transports.ipc",
						e,
						"data:",
						message.data
					],
					level: "error"
				});
			}
		}
	}
	/**
	* Is type primitive, including null and undefined
	* @param {any} value
	* @returns {boolean}
	*/
	function isPrimitive(value) {
		return Object(value) !== value;
	}
	function serializeFn({ data, depth, seen = /* @__PURE__ */ new WeakSet(), transport = {} } = {}) {
		const actualDepth = depth || transport.depth || 5;
		if (seen.has(data)) return "[Circular]";
		if (actualDepth < 1) {
			if (isPrimitive(data)) return data;
			if (Array.isArray(data)) return "[Array]";
			return `[${typeof data}]`;
		}
		if (["function", "symbol"].includes(typeof data)) return data.toString();
		if (isPrimitive(data)) return data;
		if (RESTRICTED_TYPES.has(data.constructor)) return `[${data.constructor.name}]`;
		if (Array.isArray(data)) return data.map((item) => serializeFn({
			data: item,
			depth: actualDepth - 1,
			seen
		}));
		if (data instanceof Date) return data.toISOString();
		if (data instanceof Error) return data.stack;
		if (data instanceof Map) return new Map(Array.from(data).map(([key, value]) => [serializeFn({
			data: key,
			depth: actualDepth - 1,
			seen
		}), serializeFn({
			data: value,
			depth: actualDepth - 1,
			seen
		})]));
		if (data instanceof Set) return new Set(Array.from(data).map((val) => serializeFn({
			data: val,
			depth: actualDepth - 1,
			seen
		})));
		seen.add(data);
		return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, serializeFn({
			data: value,
			depth: actualDepth - 1,
			seen
		})]));
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/electron-log@5.4.3/node_modules/electron-log/src/renderer/index.js
var require_renderer$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Logger = require_Logger();
	var RendererErrorHandler = require_RendererErrorHandler();
	var transportConsole = require_console();
	var transportIpc = require_ipc();
	if (typeof process === "object" && process.type === "browser") console.warn("electron-log/renderer is loaded in the main process. It could cause unexpected behaviour.");
	module.exports = createLogger();
	module.exports.Logger = Logger;
	module.exports.default = module.exports;
	function createLogger() {
		const logger = new Logger({
			allowUnknownLevel: true,
			errorHandler: new RendererErrorHandler(),
			initializeFn: () => {},
			logId: "default",
			transportFactories: {
				console: transportConsole,
				ipc: transportIpc
			},
			variables: { processType: "renderer" }
		});
		logger.errorHandler.setOptions({ logFn({ error, errorName, showDialog }) {
			logger.transports.console({
				data: [errorName, error].filter(Boolean),
				level: "error"
			});
			logger.transports.ipc({
				cmd: "errorHandler",
				error: {
					cause: error?.cause,
					code: error?.code,
					name: error?.name,
					message: error?.message,
					stack: error?.stack
				},
				errorName,
				logId: logger.logId,
				showDialog
			});
		} });
		if (typeof window === "object") window.addEventListener("message", (event) => {
			const { cmd, logId, ...message } = event.data || {};
			const instance = Logger.getInstance({ logId });
			if (cmd === "message") instance.processMessage(message, { transports: ["console"] });
		});
		return new Proxy(logger, { get(target, prop) {
			if (typeof target[prop] !== "undefined") return target[prop];
			return (...data) => logger.logData(data, { level: prop });
		} });
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/electron-log@5.4.3/node_modules/electron-log/renderer.js
var require_renderer = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_renderer$1();
}));
//#endregion
//#region src/shared/ipc-channels.ts
var init_ipc_channels = __esmMin((() => {
	init_ipc_channels$1();
})), SANDBOX_OOPIF_DIAGNOSTICS_CHANNEL, SANDBOX_DOC_PREVIEW_REGISTER_CHANNEL, SANDBOX_DOC_PREVIEW_UPDATE_CHANNEL, SANDBOX_DOC_PREVIEW_UNREGISTER_CHANNEL, SANDBOX_AUTHORIZATION_PROBE_CHANNEL, SANDBOX_AUTHORIZATION_DENIED;
var init_sandbox_preview_contract = __esmMin((() => {
	SANDBOX_OOPIF_DIAGNOSTICS_CHANNEL = "workbuddy:tencentDocs:sandboxOopifDiagnostics";
	SANDBOX_DOC_PREVIEW_REGISTER_CHANNEL = "workbuddy:tencentDocs:registerSandboxDocPreview";
	SANDBOX_DOC_PREVIEW_UPDATE_CHANNEL = "workbuddy:tencentDocs:updateSandboxDocPreview";
	SANDBOX_DOC_PREVIEW_UNREGISTER_CHANNEL = "workbuddy:tencentDocs:unregisterSandboxDocPreview";
	SANDBOX_AUTHORIZATION_PROBE_CHANNEL = "workbuddy:tencentDocs:sandboxAuthorizationProbe";
	SANDBOX_AUTHORIZATION_DENIED = {
		allowed: false,
		aiEditEnabled: false
	};
}));
//#endregion
//#region src/tencent-docs/preload/install-renderer-bridges.ts
function installTencentDocsPreviewBridges(contextBridge, ipcRenderer) {
	contextBridge.exposeInMainWorld("__workbuddyRegisterOnlineDocPreview", (fileId, sessionId) => ipcRenderer.invoke("workbuddy:registerOnlineDocPreview", fileId, sessionId));
	contextBridge.exposeInMainWorld("__workbuddyUnregisterOnlineDocPreview", (registrationId) => ipcRenderer.invoke("workbuddy:unregisterOnlineDocPreview", registrationId));
	contextBridge.exposeInMainWorld("__workbuddyUpdateDocsFeatureList", (featureList) => ipcRenderer.invoke("workbuddy:updateDocsFeatureList", featureList));
	contextBridge.exposeInMainWorld("__workbuddyRegisterSandboxDocPreview", (input) => ipcRenderer.invoke(SANDBOX_DOC_PREVIEW_REGISTER_CHANNEL, input));
	contextBridge.exposeInMainWorld("__workbuddyUpdateSandboxDocPreview", (input) => ipcRenderer.invoke(SANDBOX_DOC_PREVIEW_UPDATE_CHANNEL, input));
	contextBridge.exposeInMainWorld("__workbuddyUnregisterSandboxDocPreview", (previewInstanceId, generation) => ipcRenderer.invoke(SANDBOX_DOC_PREVIEW_UNREGISTER_CHANNEL, previewInstanceId, generation));
}
var init_install_renderer_bridges = __esmMin((() => {
	init_sandbox_preview_contract();
}));
//#endregion
//#region src/preload/early-event-buffer.ts
/** 构造一个早期事件缓冲器。所有内部状态封闭在闭包内。 */
function createEarlyEventBuffer(ipcRenderer) {
	const buffered = /* @__PURE__ */ new Map();
	const listeners = /* @__PURE__ */ new Map();
	return {
		startPushListening() {
			for (const channel of RAW_HOST_EVENT_CHANNELS) {
				buffered.set(channel, []);
				const listener = (_ipcEvent, payload) => {
					const buf = buffered.get(channel);
					if (buf) buf.push(payload);
				};
				listeners.set(channel, listener);
				ipcRenderer.on(channel, listener);
			}
		},
		async pullPendingWechatChips() {
			const channel = "app:wechatChatHistory:appendChip";
			console.info("[WechatChatHistoryDelivery] preload-pull-start");
			try {
				const pending = await ipcRenderer.invoke("app:consumePendingWechatChatHistoryChips");
				if (Array.isArray(pending)) console.info("[WechatChatHistoryDelivery] preload-pull-done", {
					count: pending.length,
					chipIds: pending.map((chip) => chip?.chipId).filter(Boolean)
				});
				if (Array.isArray(pending) && pending.length > 0) {
					const buf = buffered.get(channel);
					if (buf) for (const payload of pending) buf.push(payload);
				}
			} catch (error) {
				console.info("[WechatChatHistoryDelivery] preload-pull-failed", { error: error instanceof Error ? error.message : String(error) });
			}
		},
		attachHandlerAndReplay(channel, handler) {
			if (!RAW_HOST_EVENT_CHANNELS.has(channel)) return;
			const pushListener = listeners.get(channel);
			if (pushListener) {
				ipcRenderer.removeListener(channel, pushListener);
				listeners.delete(channel);
			}
			const pending = buffered.get(channel);
			if (pending && pending.length > 0) {
				const drain = pending.splice(0);
				queueMicrotask(() => {
					for (const payload of drain) try {
						handler(payload);
					} catch {}
				});
			}
		}
	};
}
var RAW_HOST_EVENT_CHANNELS;
var init_early_event_buffer = __esmMin((() => {
	init_desktop();
	RAW_HOST_EVENT_CHANNELS = new Set([
		"app:openUrl",
		"app:wechatChatHistory:appendChip",
		"app:inspirationShareCode:detected",
		"binary:install-progress",
		"menu:openNetworkCheck",
		"menu:openSelfCheck",
		"menu:openHelpFeedback",
		"self-check:progress",
		"tip-sound:play",
		WORKBUDDY_GLOBAL_SHORTCUT_REGISTRATION_STATUS_EVENT
	]);
}));
//#endregion
//#region src/preload/api/workbuddy-desktop-host.ts
/**
* 构造 `workbuddyDesktop` bridge 对象。全部字段都是 ipcRenderer 薄封装，没有主逻辑。
*/
function createWorkbuddyDesktopHost(deps) {
	const { ipcRenderer, earlyEventBuffer, appVersion, configDir, getBootstrapInfo, getPendingDisplayLanguageMigration, completeDisplayLanguageMigration } = deps;
	let openUrlRendererGeneration = -1;
	try {
		const generation = ipcRenderer.sendSync("app:getOpenUrlRendererGeneration");
		if (typeof generation === "number" && Number.isSafeInteger(generation) && generation >= 0) openUrlRendererGeneration = generation;
	} catch (error) {
		console.error("[WorkBuddy Preload] open-url generation fallback failed:", String(error));
	}
	const ensureOpenUrlRendererGeneration = async () => {
		if (Number.isSafeInteger(openUrlRendererGeneration) && openUrlRendererGeneration >= 0) return openUrlRendererGeneration;
		try {
			const retried = await ipcRenderer.invoke("app:getOpenUrlRendererGeneration");
			if (typeof retried === "number" && Number.isSafeInteger(retried) && retried >= 0) {
				openUrlRendererGeneration = retried;
				return retried;
			}
		} catch (error) {
			console.error("[WorkBuddy Preload] open-url generation retry failed:", String(error));
		}
		return -1;
	};
	const host = {
		platform: process.platform,
		appVersion,
		configDir,
		machineId: async () => {
			const value = await ipcRenderer.invoke(WORKBUDDY_MACHINE_ID_CHANNEL);
			return typeof value === "string" ? value : "";
		},
		app: {
			getBootstrapInfo: () => getBootstrapInfo(),
			getPendingDisplayLanguageMigration: () => getPendingDisplayLanguageMigration(),
			completeDisplayLanguageMigration: (keys) => completeDisplayLanguageMigration(keys),
			async consumePendingOpenUrls() {
				const generation = await ensureOpenUrlRendererGeneration();
				if (generation < 0) return [];
				const pending = await ipcRenderer.invoke("app:consumePendingOpenUrls", generation);
				return Array.isArray(pending) ? pending : [];
			},
			async consumePendingWechatChatHistoryChips() {
				console.info("[WechatChatHistoryDelivery] preload-pull-start");
				try {
					const pending = await ipcRenderer.invoke("app:consumePendingWechatChatHistoryChips");
					const chips = Array.isArray(pending) ? pending : [];
					console.info("[WechatChatHistoryDelivery] preload-pull-done", {
						count: chips.length,
						chipIds: chips.map((chip) => chip?.chipId).filter(Boolean)
					});
					return chips;
				} catch (error) {
					console.info("[WechatChatHistoryDelivery] preload-pull-failed", { error: error instanceof Error ? error.message : String(error) });
					return [];
				}
			},
			async ackWechatChatHistoryChip(chipId) {
				console.info("[WechatChatHistoryDelivery] preload-ack", { chipId });
				return ipcRenderer.invoke("app:ackWechatChatHistoryChip", chipId);
			}
		},
		invoke(command, args) {
			return ipcRenderer.invoke(WORKBUDDY_DESKTOP_INVOKE_CHANNEL, command, args);
		},
		events: { on(event, handler) {
			const isRawHostChannel = RAW_HOST_EVENT_CHANNELS.has(event);
			const channel = isRawHostChannel ? event : `${WORKBUDDY_DESKTOP_EVENT_CHANNEL_PREFIX}${event}`;
			const listener = (_ipcEvent, payload) => {
				handler(payload);
			};
			ipcRenderer.on(channel, listener);
			if (isRawHostChannel) earlyEventBuffer.attachHandlerAndReplay(channel, handler);
			return () => {
				ipcRenderer.removeListener(channel, listener);
			};
		} },
		window: { getCurrentWindow: () => ({
			minimize: () => ipcRenderer.invoke(WORKBUDDY_WINDOW_MINIMIZE_CHANNEL),
			maximize: () => ipcRenderer.invoke(WORKBUDDY_WINDOW_MAXIMIZE_CHANNEL),
			close: () => ipcRenderer.invoke(WORKBUDDY_WINDOW_CLOSE_CHANNEL),
			isMaximized: () => ipcRenderer.invoke(WORKBUDDY_WINDOW_IS_MAXIMIZED_CHANNEL),
			isFullscreen: () => ipcRenderer.invoke(WORKBUDDY_WINDOW_IS_FULLSCREEN_CHANNEL),
			setFullscreen: (flag) => ipcRenderer.invoke(WORKBUDDY_WINDOW_SET_FULLSCREEN_CHANNEL, flag),
			toggleFullscreen: () => ipcRenderer.invoke(WORKBUDDY_WINDOW_TOGGLE_FULLSCREEN_CHANNEL),
			openStartupAnalysis: () => ipcRenderer.invoke(WORKBUDDY_WINDOW_OPEN_STARTUP_ANALYSIS_CHANNEL),
			startDrag: () => ipcRenderer.invoke(WORKBUDDY_WINDOW_START_DRAG_CHANNEL),
			stopDrag: () => ipcRenderer.invoke(WORKBUDDY_WINDOW_STOP_DRAG_CHANNEL),
			onMaximizeChange: (handler) => host.events.on(WORKBUDDY_WINDOW_MAXIMIZE_CHANGED_EVENT, handler),
			onFocusChange: (handler) => host.events.on(WORKBUDDY_WINDOW_FOCUS_CHANGED_EVENT, handler),
			onFullscreenChange: (handler) => host.events.on(WORKBUDDY_WINDOW_FULLSCREEN_CHANGED_EVENT, handler)
		}) },
		opener: { openUrl: (url) => ipcRenderer.invoke(WORKBUDDY_OPENER_OPEN_URL_CHANNEL, url) },
		localFile: { open: (options) => ipcRenderer.invoke(WORKBUDDY_LOCAL_FILE_OPEN_CHANNEL, options) },
		dialog: {
			open: (options) => ipcRenderer.invoke(WORKBUDDY_DIALOG_OPEN_CHANNEL, options),
			saveImage: (dataUrl, defaultName) => ipcRenderer.invoke("dialog:saveImage", dataUrl, defaultName)
		},
		clipboard: {
			readText: () => ipcRenderer.invoke(WORKBUDDY_CLIPBOARD_READ_TEXT_CHANNEL),
			writeText: (text) => ipcRenderer.invoke(WORKBUDDY_CLIPBOARD_WRITE_TEXT_CHANNEL, text),
			writeImage: (dataUrl) => ipcRenderer.invoke(WORKBUDDY_CLIPBOARD_WRITE_IMAGE_CHANNEL, dataUrl)
		},
		notification: {
			isSupported: () => ipcRenderer.invoke(WORKBUDDY_NOTIFICATION_IS_SUPPORTED_CHANNEL),
			requestRegistration: () => ipcRenderer.invoke(WORKBUDDY_NOTIFICATION_REQUEST_REGISTRATION_CHANNEL),
			sendNotification: (payload) => ipcRenderer.invoke(WORKBUDDY_NOTIFICATION_SEND_CHANNEL, payload)
		},
		globalShortcut: {
			updateToggleWindow: (accelerator) => ipcRenderer.invoke(WORKBUDDY_GLOBAL_SHORTCUT_UPDATE_TOGGLE_WINDOW_CHANNEL, accelerator),
			onRegistrationStatus: (handler) => host.events.on(WORKBUDDY_GLOBAL_SHORTCUT_REGISTRATION_STATUS_EVENT, handler)
		},
		ipcRenderer: (() => {
			const ALLOWED_CHANNELS = new Set([
				"startup:message",
				"startup:preload-timeout",
				"splash-state:update",
				"account-snapshot:persist"
			]);
			const ALLOWED_SYNC_CHANNELS = new Set(["account-snapshot:persist"]);
			return {
				on(channel, listener) {
					if (ALLOWED_CHANNELS.has(channel)) ipcRenderer.on(channel, listener);
				},
				removeListener(channel, listener) {
					if (ALLOWED_CHANNELS.has(channel)) ipcRenderer.removeListener(channel, listener);
				},
				send(channel, ...args) {
					if (ALLOWED_CHANNELS.has(channel)) ipcRenderer.send(channel, ...args);
				},
				sendSync(channel, ...args) {
					if (ALLOWED_SYNC_CHANNELS.has(channel)) return ipcRenderer.sendSync(channel, ...args);
				}
			};
		})()
	};
	return host;
}
var init_workbuddy_desktop_host = __esmMin((() => {
	init_desktop();
	init_early_event_buffer();
}));
//#endregion
//#region src/preload/daemon-frame-channel.ts
/**
* 发起一次 daemon frame 请求：请求 payload 走 MessageChannel，等待响应帧回来。
*
* @param channel  daemon 侧 RPC channel 名
* @param args     请求参数
* @throws 若 daemon 返回 error 或 transport 层报错
*/
async function invokeDaemonFrame(channel, ...args) {
	daemonFrameRequestSeq += 1;
	const id = `preload-${Date.now()}-${daemonFrameRequestSeq}`;
	const responseFrame = await sendDaemonFrameOnce(JSON.stringify({
		id,
		type: "request",
		channel,
		args
	}));
	const response = JSON.parse(String(responseFrame));
	if (response.type === "error" || response.error) {
		const message = typeof response.error?.message === "string" ? response.error.message : `Daemon request failed: ${channel}`;
		throw new Error(message);
	}
	return response.result;
}
/**
* 单次请求：申请 MessagePort → 等 main 侧 'open' → 发 'message' → 等响应帧 →
* 关闭 port。全过程 settle 一次（重复 finish 无副作用）。
*
* 主动 export 给单测便于隔离；生产由 invokeDaemonFrame 独占调用。
*/
function sendDaemonFrameOnce(text) {
	let settled = false;
	return new Promise((resolve, reject) => {
		if (typeof MessageChannel === "undefined") {
			reject(/* @__PURE__ */ new Error("Daemon transport MessageChannel is unavailable"));
			return;
		}
		const channel = new MessageChannel();
		const port = channel.port1;
		const finish = (error, value) => {
			if (settled) return;
			settled = true;
			port.onmessage = null;
			port.onmessageerror = null;
			port.close();
			if (error) reject(error);
			else resolve(value);
		};
		port.onmessage = (event) => {
			const payload = event.data;
			if (!payload || typeof payload !== "object") return;
			if (payload.kind === "open") {
				port.postMessage({
					kind: "message",
					text
				});
				return;
			}
			if (payload.kind === "message") finish(null, payload.text ?? (payload.json !== void 0 && payload.json !== null ? JSON.stringify(payload.json) : payload.binaryBase64 ?? ""));
			else if (payload.kind === "error") finish(new Error(typeof payload.error === "string" ? payload.error : "Daemon transport error"));
			else if (payload.kind === "close") finish(new Error(typeof payload.reason === "string" ? payload.reason : "Daemon transport closed"));
		};
		port.onmessageerror = () => {
			finish(/* @__PURE__ */ new Error("Daemon transport port message error"));
		};
		port.start();
		try {
			electron.ipcRenderer.postMessage(LOCAL_DAEMON_TRANSPORT_PORT_CHANNEL, { target: { transportType: "local" } }, [channel.port2]);
		} catch (error) {
			finish(error);
		}
	});
}
/**
* 安装 renderer main-world → main 进程的 MessagePort 转发器。
*
* renderer main-world 通过 `window.postMessage({ type: OPEN_LOCAL_DAEMON_TRANSPORT_PORT_MESSAGE, target, ...port })`
* 发出请求，preload 拦下后把 port 通过 ipcRenderer.postMessage 转给 main 进程。
*
* 这条通道是 workbuddy-app 的 daemon client runtime（renderer 侧）拿到 main 进程
* 直连 port 的唯一入口——preload 只做纯转发，不解析 payload。
*/
function installDaemonTransportPortForwarder() {
	window.addEventListener("message", (event) => {
		if (event.source !== window || !event.data || typeof event.data !== "object") return;
		const data = event.data;
		if (data.type !== "workbuddy:open-local-daemon-transport-port") return;
		const port = event.ports[0];
		if (!port) return;
		electron.ipcRenderer.postMessage(LOCAL_DAEMON_TRANSPORT_PORT_CHANNEL, { target: data.target ?? null }, [port]);
	});
}
var daemonFrameRequestSeq;
var init_daemon_frame_channel = __esmMin((() => {
	init_desktop();
	daemonFrameRequestSeq = 0;
})), WORKBUDDY_DEVTOOLS_TERMINAL_ATTACH_CHANNEL, WORKBUDDY_DEVTOOLS_TERMINAL_CREATE_CHANNEL, WORKBUDDY_DEVTOOLS_TERMINAL_LIST_CHANNEL, WORKBUDDY_DEVTOOLS_TERMINAL_CLOSE_CHANNEL, WORKBUDDY_DEVTOOLS_TERMINAL_RENAME_CHANNEL, WORKBUDDY_DEVTOOLS_TERMINAL_DETACH_CHANNEL, WORKBUDDY_DEVTOOLS_TERMINAL_INPUT_CHANNEL, WORKBUDDY_DEVTOOLS_TERMINAL_EVENT_CHANNEL;
var init_devtools_terminal_ipc = __esmMin((() => {
	WORKBUDDY_DEVTOOLS_TERMINAL_ATTACH_CHANNEL = "workbuddy:devtools-terminal:attach";
	WORKBUDDY_DEVTOOLS_TERMINAL_CREATE_CHANNEL = "workbuddy:devtools-terminal:create";
	WORKBUDDY_DEVTOOLS_TERMINAL_LIST_CHANNEL = "workbuddy:devtools-terminal:list";
	WORKBUDDY_DEVTOOLS_TERMINAL_CLOSE_CHANNEL = "workbuddy:devtools-terminal:close";
	WORKBUDDY_DEVTOOLS_TERMINAL_RENAME_CHANNEL = "workbuddy:devtools-terminal:rename";
	WORKBUDDY_DEVTOOLS_TERMINAL_DETACH_CHANNEL = "workbuddy:devtools-terminal:detach";
	WORKBUDDY_DEVTOOLS_TERMINAL_INPUT_CHANNEL = "workbuddy:devtools-terminal:input";
	WORKBUDDY_DEVTOOLS_TERMINAL_EVENT_CHANNEL = "workbuddy:devtools-terminal:event";
}));
//#endregion
//#region src/preload/devtools-terminal-bridge.ts
/**
* 装配 main → preload 的事件接收，并返回 renderer 侧桥接对象。
*
* @param ipcRenderer  电子 ipcRenderer 单例；从 caller 传入避免顶层 require electron
* @returns  暴露给 renderer 的桥接对象
*/
function createDevtoolsTerminalBridge(ipcRenderer) {
	ipcRenderer.on(WORKBUDDY_DEVTOOLS_TERMINAL_EVENT_CHANNEL, (_event, payload) => {
		if (!payload || typeof payload.subscriptionId !== "string") return;
		const buffer = buffers.get(payload.subscriptionId) ?? [];
		buffer.push(payload);
		const bufferedDataLength = buffer.reduce((total, event) => total + (event.type === "data" ? event.data.length : 0), 0);
		if (buffer.length > MAX_BUFFERED_EVENTS || bufferedDataLength > MAX_BUFFERED_DATA_LENGTH) {
			buffers.set(payload.subscriptionId, [{
				subscriptionId: payload.subscriptionId,
				type: "error",
				message: BUFFER_OVERFLOW_MESSAGE
			}]);
			ipcRenderer.invoke(WORKBUDDY_DEVTOOLS_TERMINAL_DETACH_CHANNEL, { subscriptionId: payload.subscriptionId }).catch(() => void 0);
			return;
		}
		buffers.set(payload.subscriptionId, buffer);
	});
	return {
		async create(options = {}) {
			return await ipcRenderer.invoke(WORKBUDDY_DEVTOOLS_TERMINAL_CREATE_CHANNEL, options);
		},
		async list(options = {}) {
			return await ipcRenderer.invoke(WORKBUDDY_DEVTOOLS_TERMINAL_LIST_CHANNEL, options);
		},
		async close(sessionId) {
			await ipcRenderer.invoke(WORKBUDDY_DEVTOOLS_TERMINAL_CLOSE_CHANNEL, { sessionId });
		},
		async rename(sessionId, title) {
			return await ipcRenderer.invoke(WORKBUDDY_DEVTOOLS_TERMINAL_RENAME_CHANNEL, {
				sessionId,
				title
			});
		},
		async attach(sessionId) {
			if (typeof sessionId !== "string" || !sessionId.trim()) throw new Error("DevTools terminal sessionId must be a non-empty string");
			const attachResult = await ipcRenderer.invoke(WORKBUDDY_DEVTOOLS_TERMINAL_ATTACH_CHANNEL, { sessionId });
			const subscriptionId = attachResult?.subscriptionId;
			if (typeof subscriptionId !== "string" || !subscriptionId) throw new Error("DevTools terminal attach returned an invalid subscriptionId");
			return {
				subscriptionId,
				initialReplay: readInitialReplay(attachResult.initialReplay),
				initialData: typeof attachResult.initialData === "string" && attachResult.initialData ? attachResult.initialData : void 0
			};
		},
		poll(subscriptionId) {
			if (typeof subscriptionId !== "string" || !subscriptionId.trim()) return { events: [] };
			const events = buffers.get(subscriptionId) ?? [];
			buffers.set(subscriptionId, []);
			if (events.some((event) => event.type === "closed" || event.type === "error")) buffers.delete(subscriptionId);
			return { events };
		},
		async input(subscriptionId, data) {
			await ipcRenderer.invoke(WORKBUDDY_DEVTOOLS_TERMINAL_INPUT_CHANNEL, {
				subscriptionId,
				data
			});
		},
		async resize(sessionId, cols, rows) {
			if (!(await ipcRenderer.invoke("workbuddy:devtools-terminal:resize", {
				sessionId,
				cols,
				rows
			}))?.resized) await invokeDaemonFrame("sidecar:resize", sessionId, cols, rows);
		},
		async detach(subscriptionId) {
			await ipcRenderer.invoke(WORKBUDDY_DEVTOOLS_TERMINAL_DETACH_CHANNEL, { subscriptionId });
			buffers.delete(subscriptionId);
		}
	};
}
function readInitialReplay(value) {
	if (value === void 0) return;
	if (!Array.isArray(value)) throw new Error("DevTools terminal attach returned invalid replay data");
	return value.map((segment) => {
		if (typeof segment !== "object" || segment === null || !Number.isInteger(segment.cols) || !Number.isInteger(segment.rows) || typeof segment.data !== "string") throw new Error("DevTools terminal attach returned invalid replay data");
		const { cols, rows, data } = segment;
		if (cols < 1 || cols > 1e3 || rows < 1 || rows > 1e3) throw new Error("DevTools terminal attach returned invalid replay dimensions");
		return {
			cols,
			rows,
			data
		};
	});
}
var MAX_BUFFERED_EVENTS, MAX_BUFFERED_DATA_LENGTH, BUFFER_OVERFLOW_MESSAGE, buffers;
var init_devtools_terminal_bridge = __esmMin((() => {
	init_devtools_terminal_ipc();
	init_daemon_frame_channel();
	MAX_BUFFERED_EVENTS = 1e3;
	MAX_BUFFERED_DATA_LENGTH = 2 * 1024 * 1024;
	BUFFER_OVERFLOW_MESSAGE = "Terminal output exceeded the renderer buffer limit";
	buffers = /* @__PURE__ */ new Map();
}));
//#endregion
//#region src/preload/host-platform-bridge.ts
/**
* 一次性同步取值。返回 payload 保证 non-null（内部 fallback 兜底）。
*
* @param ipcRenderer  Electron ipcRenderer；从 caller 注入便于测试
* @param logger       日志器，警告/错误经它记录
*/
function resolveHostPlatformPayload(ipcRenderer, logger) {
	try {
		const raw = ipcRenderer.sendSync(HOST_PLATFORM_GET_SYNC_CHANNEL);
		if (raw && typeof raw === "object" && typeof raw.hostArch === "string") return raw;
		logger.warn("[WorkBuddy Preload] hostPlatform sendSync returned unexpected payload, falling back to process.arch", { receivedType: typeof raw });
		return buildFallbackPayload("preload-payload-invalid");
	} catch (error) {
		logger.error("[WorkBuddy Preload] hostPlatform sendSync failed:", String(error));
		return buildFallbackPayload("preload-ipc-failed", String(error));
	}
}
function buildFallbackPayload(resolvedBy, error) {
	return {
		platform: process.platform,
		arch: process.arch,
		hostArch: process.arch,
		appVersion: void 0,
		configDir: void 0,
		probe: {
			resolvedBy,
			resolvedHostArch: process.arch,
			...error ? { error } : {}
		}
	};
}
var init_host_platform_bridge = __esmMin((() => {
	init_ipc_channels();
}));
//#endregion
//#region ../../packages/workbuddy-server/src/migration/localstorage-contract.ts
/**
* 在当前 origin 的 localStorage 上逐 key 应用迁移 payload。
* - 普通 key：current-wins（当前已有值则跳过）
* - 数组合并 key（pinned、archived）：legacy 和 current 去重合并，current 中已有的元素优先保留
*/
function applyLocalStorageMigrationPayload(storage, payload) {
	const result = {
		appliedKeys: [],
		skippedKeys: {}
	};
	for (const [key, value] of Object.entries(payload.entries)) {
		if (!value) {
			result.skippedKeys[key] = "empty_value";
			continue;
		}
		const current = storage.getItem(key);
		const mergeConfig = MERGE_ARRAY_KEYS[key];
		if (mergeConfig) {
			const merged = mergeJsonArrays(current, value, mergeConfig.dedupeField);
			if (merged === MERGE_NO_CHANGE) result.skippedKeys[key] = "merge_no_new_items";
			else if (merged !== null) {
				storage.setItem(key, merged);
				result.appliedKeys.push(key);
			} else result.skippedKeys[key] = "merge_parse_failed";
			continue;
		}
		if (current !== null && current !== "") {
			result.skippedKeys[key] = "target_already_has_value";
			continue;
		}
		storage.setItem(key, value);
		result.appliedKeys.push(key);
	}
	return result;
}
function mergeJsonArrays(currentRaw, legacyRaw, dedupeField) {
	let legacyArr;
	try {
		const parsed = JSON.parse(legacyRaw);
		if (!Array.isArray(parsed)) return null;
		legacyArr = parsed;
	} catch {
		return null;
	}
	if (legacyArr.length === 0) return MERGE_NO_CHANGE;
	let currentArr = [];
	if (currentRaw) try {
		const parsed = JSON.parse(currentRaw);
		if (Array.isArray(parsed)) currentArr = parsed;
	} catch {}
	if (currentArr.length === 0) return legacyRaw;
	const seen = /* @__PURE__ */ new Set();
	for (const item of currentArr) seen.add(dedupeField ? getDedupeKey(item, dedupeField) : String(item));
	const toAppend = [];
	for (const item of legacyArr) {
		const key = dedupeField ? getDedupeKey(item, dedupeField) : String(item);
		if (!seen.has(key)) {
			seen.add(key);
			toAppend.push(item);
		}
	}
	if (toAppend.length === 0) return MERGE_NO_CHANGE;
	return JSON.stringify([...currentArr, ...toAppend]);
}
function getDedupeKey(item, field) {
	if (item && typeof item === "object") return String(item[field] ?? "");
	return String(item);
}
var PINNED_CONVERSATIONS_STORAGE_KEY, LEGACY_DISPLAY_LANGUAGE_STORAGE_KEYS, MERGE_ARRAY_KEYS, MERGE_NO_CHANGE;
var init_localstorage_contract = __esmMin((() => {
	PINNED_CONVERSATIONS_STORAGE_KEY = "workbuddy-pinned-conversations";
	LEGACY_DISPLAY_LANGUAGE_STORAGE_KEYS = ["CODEBUDDY_IDE_STORAGE_LANG", "workbuddy-language"];
	MERGE_ARRAY_KEYS = {
		[PINNED_CONVERSATIONS_STORAGE_KEY]: { dedupeField: "id" },
		"genie-archived-session-ids": {}
	};
	MERGE_NO_CHANGE = Symbol("MERGE_NO_CHANGE");
}));
//#endregion
//#region src/shared/localstorage-migration.ts
var init_localstorage_migration = __esmMin((() => {
	init_localstorage_contract();
}));
//#endregion
//#region ../../packages/workbuddy-app/src/shared/startup-ipc-channels.ts
var PRELOAD_TIMEOUT_CHANNEL;
var init_startup_ipc_channels$1 = __esmMin((() => {
	PRELOAD_TIMEOUT_CHANNEL = "startup:preload-timeout";
}));
//#endregion
//#region src/shared/startup-ipc-channels.ts
var init_startup_ipc_channels = __esmMin((() => {
	init_startup_ipc_channels$1();
}));
//#endregion
//#region ../../packages/workbuddy-app/src/shared/startup-perf-marks.ts
function buildStartupPerfMarkLine(id, startTime, source, data, atRelativeMs) {
	const def = STARTUP_PERF_MARKS[id];
	if (!def) return null;
	let now = startTime;
	let timeOrigin = 0;
	try {
		now = performance.now();
		timeOrigin = performance.timeOrigin;
	} catch {}
	const isBackfill = typeof atRelativeMs === "number" && Number.isFinite(atRelativeMs);
	const timestamp = isBackfill ? atRelativeMs : now;
	const payload = {
		_type: "mark",
		timestamp,
		phase: def.key,
		elapsed: Math.round((timestamp - startTime) * 100) / 100,
		source,
		proc: source,
		timeOrigin,
		data: {
			id: def.id,
			phase: def.phase,
			...data ?? {}
		}
	};
	if (!isBackfill) payload.epochMs = Date.now();
	return JSON.stringify(payload);
}
var StartupPerfPhase, STARTUP_PERF_MARKS;
var init_startup_perf_marks = __esmMin((() => {
	StartupPerfPhase = {
		A: "A_process",
		B: "B_bootstrap",
		C: "C_window",
		D: "D_preload",
		E: "E_renderer",
		F: "F_daemon"
	};
	STARTUP_PERF_MARKS = {
		A0: {
			id: "A0",
			phase: StartupPerfPhase.A,
			key: "process_created"
		},
		A1: {
			id: "A1",
			phase: StartupPerfPhase.A,
			key: "process_started"
		},
		A2: {
			id: "A2",
			phase: StartupPerfPhase.A,
			key: "imports_completed"
		},
		A3: {
			id: "A3",
			phase: StartupPerfPhase.A,
			key: "bundled_assets_root_set"
		},
		A4: {
			id: "A4",
			phase: StartupPerfPhase.A,
			key: "logger_configured"
		},
		A5: {
			id: "A5",
			phase: StartupPerfPhase.A,
			key: "crash_writer_installed"
		},
		A6: {
			id: "A6",
			phase: StartupPerfPhase.A,
			key: "shell_env_loaded"
		},
		A7: {
			id: "A7",
			phase: StartupPerfPhase.A,
			key: "electron_app_configured"
		},
		A8: {
			id: "A8",
			phase: StartupPerfPhase.A,
			key: "single_instance_locked"
		},
		A9: {
			id: "A9",
			phase: StartupPerfPhase.A,
			key: "app_ready"
		},
		B1: {
			id: "B1",
			phase: StartupPerfPhase.B,
			key: "bootstrap_entered"
		},
		B2: {
			id: "B2",
			phase: StartupPerfPhase.B,
			key: "platform_created"
		},
		B3: {
			id: "B3",
			phase: StartupPerfPhase.B,
			key: "celljs_container_ready"
		},
		B4: {
			id: "B4",
			phase: StartupPerfPhase.B,
			key: "database_initialized"
		},
		B5: {
			id: "B5",
			phase: StartupPerfPhase.B,
			key: "migration_context_ready"
		},
		B6: {
			id: "B6",
			phase: StartupPerfPhase.B,
			key: "daemon_bridge_handlers_registered"
		},
		B7: {
			id: "B7",
			phase: StartupPerfPhase.B,
			key: "daemon_env_ready"
		},
		B8: {
			id: "B8",
			phase: StartupPerfPhase.B,
			key: "daemon_process_started"
		},
		B9: {
			id: "B9",
			phase: StartupPerfPhase.B,
			key: "daemon_connection_created"
		},
		B10: {
			id: "B10",
			phase: StartupPerfPhase.B,
			key: "renderer_migration_bridge_ready"
		},
		B11: {
			id: "B11",
			phase: StartupPerfPhase.B,
			key: "daemon_event_bridges_registered"
		},
		B12: {
			id: "B12",
			phase: StartupPerfPhase.B,
			key: "desktop_host_rpc_registered"
		},
		B13: {
			id: "B13",
			phase: StartupPerfPhase.B,
			key: "wsrpc_ready"
		},
		B14: {
			id: "B14",
			phase: StartupPerfPhase.B,
			key: "background_services_kicked"
		},
		B15: {
			id: "B15",
			phase: StartupPerfPhase.B,
			key: "bootstrap_complete"
		},
		C1: {
			id: "C1",
			phase: StartupPerfPhase.C,
			key: "window_manager_created"
		},
		C2: {
			id: "C2",
			phase: StartupPerfPhase.C,
			key: "splash_shown"
		},
		C3: {
			id: "C3",
			phase: StartupPerfPhase.C,
			key: "vendor_ensured"
		},
		C4: {
			id: "C4",
			phase: StartupPerfPhase.C,
			key: "main_window_creating"
		},
		C5: {
			id: "C5",
			phase: StartupPerfPhase.C,
			key: "main_window_created"
		},
		C6: {
			id: "C6",
			phase: StartupPerfPhase.C,
			key: "browser_window_load_url"
		},
		C7: {
			id: "C7",
			phase: StartupPerfPhase.C,
			key: "index_html_load"
		},
		D1: {
			id: "D1",
			phase: StartupPerfPhase.D,
			key: "preload_start"
		},
		D2: {
			id: "D2",
			phase: StartupPerfPhase.D,
			key: "preload_bootstrap_requested"
		},
		D3: {
			id: "D3",
			phase: StartupPerfPhase.D,
			key: "preload_bootstrap_resolved"
		},
		D4: {
			id: "D4",
			phase: StartupPerfPhase.D,
			key: "preload_rpc_connected"
		},
		D5: {
			id: "D5",
			phase: StartupPerfPhase.D,
			key: "preload_exposed"
		},
		E1: {
			id: "E1",
			phase: StartupPerfPhase.E,
			key: "renderer_nav_start"
		},
		E2: {
			id: "E2",
			phase: StartupPerfPhase.E,
			key: "renderer_response_end"
		},
		E3: {
			id: "E3",
			phase: StartupPerfPhase.E,
			key: "renderer_dom_interactive"
		},
		E4: {
			id: "E4",
			phase: StartupPerfPhase.E,
			key: "renderer_web_first_paint"
		},
		E5: {
			id: "E5",
			phase: StartupPerfPhase.E,
			key: "renderer_dom_content_loaded"
		},
		E6: {
			id: "E6",
			phase: StartupPerfPhase.E,
			key: "renderer_script_start"
		},
		E7: {
			id: "E7",
			phase: StartupPerfPhase.E,
			key: "renderer_dom_ready"
		},
		E8: {
			id: "E8",
			phase: StartupPerfPhase.E,
			key: "renderer_react_mounted"
		},
		E9: {
			id: "E9",
			phase: StartupPerfPhase.E,
			key: "renderer_adapter_init_start"
		},
		E10: {
			id: "E10",
			phase: StartupPerfPhase.E,
			key: "renderer_first_paint"
		},
		E11: {
			id: "E11",
			phase: StartupPerfPhase.E,
			key: "renderer_web_first_contentful_paint"
		},
		E12: {
			id: "E12",
			phase: StartupPerfPhase.E,
			key: "renderer_adapter_connected"
		},
		E13: {
			id: "E13",
			phase: StartupPerfPhase.E,
			key: "renderer_skeleton_gone"
		},
		E14: {
			id: "E14",
			phase: StartupPerfPhase.E,
			key: "renderer_app_ready"
		},
		F1: {
			id: "F1",
			phase: StartupPerfPhase.F,
			key: "daemon_started"
		},
		F2: {
			id: "F2",
			phase: StartupPerfPhase.F,
			key: "daemon_db_ready"
		},
		F3: {
			id: "F3",
			phase: StartupPerfPhase.F,
			key: "daemon_celljs_deps_resolved"
		},
		F4: {
			id: "F4",
			phase: StartupPerfPhase.F,
			key: "daemon_tencent_docs_ready"
		},
		F5: {
			id: "F5",
			phase: StartupPerfPhase.F,
			key: "daemon_migration_service_ready"
		},
		F6: {
			id: "F6",
			phase: StartupPerfPhase.F,
			key: "daemon_sidecar_manager_ready"
		},
		F7: {
			id: "F7",
			phase: StartupPerfPhase.F,
			key: "daemon_rpc_ready"
		},
		F8: {
			id: "F8",
			phase: StartupPerfPhase.F,
			key: "daemon_domain_ready"
		},
		F9: {
			id: "F9",
			phase: StartupPerfPhase.F,
			key: "daemon_ready"
		},
		F10: {
			id: "F10",
			phase: StartupPerfPhase.F,
			key: "daemon_startup_migration_done"
		},
		F11: {
			id: "F11",
			phase: StartupPerfPhase.F,
			key: "daemon_mcp_apps_host_ready"
		},
		F12: {
			id: "F12",
			phase: StartupPerfPhase.F,
			key: "daemon_services_kicked"
		},
		F13: {
			id: "F13",
			phase: StartupPerfPhase.F,
			key: "daemon_background_completed"
		},
		F14: {
			id: "F14",
			phase: StartupPerfPhase.F,
			key: "daemon_state_refresh_started"
		},
		F15: {
			id: "F15",
			phase: StartupPerfPhase.F,
			key: "daemon_auth_account_ready"
		},
		F16: {
			id: "F16",
			phase: StartupPerfPhase.F,
			key: "daemon_auth_token_ready"
		},
		F17: {
			id: "F17",
			phase: StartupPerfPhase.F,
			key: "daemon_config_request_sent"
		},
		F18: {
			id: "F18",
			phase: StartupPerfPhase.F,
			key: "daemon_config_response_received"
		},
		F19: {
			id: "F19",
			phase: StartupPerfPhase.F,
			key: "daemon_state_ready"
		}
	};
}));
//#endregion
//#region src/preload/preload-perf-marks.ts
/**
* 在 preload 进程内追加一条 D 段打点。绝不抛错——perf 打点绝不阻塞 preload 主流程。
* @param id  打点 id（如 D1/D2/...），或自由字符串（罕见）
* @param data 可选附加数据
*/
function markPreloadPerf(id, data) {
	try {
		const line = buildStartupPerfMarkLine(id, PRELOAD_PERF_START, "preload", data);
		if (line) preloadPerfBuffer.push(line);
	} catch {}
}
/**
* drain 桥接：返回当前 buffer 并清空，一次性消费语义（避免重复 relay）。
* 供 `__workbuddyStartupPerfD.drain()` 暴露给 renderer。
*/
function drainPreloadPerfBuffer() {
	return preloadPerfBuffer.splice(0, preloadPerfBuffer.length);
}
var PRELOAD_PERF_START, preloadPerfBuffer;
var init_preload_perf_marks = __esmMin((() => {
	init_startup_perf_marks();
	PRELOAD_PERF_START = (() => {
		try {
			return performance.now();
		} catch {
			return 0;
		}
	})();
	preloadPerfBuffer = [];
}));
//#endregion
//#region src/preload/renderer-ready-handshake.ts
/**
* 创建 migration bridge 实例。bootstrap、通用 localStorage 应用和 Display Language
* scoped migration 共享同一份 promise 缓存 + ipcRenderer 依赖。
*/
function createMigrationBridge(deps) {
	const { ipcRenderer, logger } = deps;
	let bootstrapInfoPromise = null;
	let applyMigrationPromise = null;
	function getTargetStorage() {
		return deps.localStorage ?? window.localStorage;
	}
	function validateLocalStorageMigrationPayload(payload) {
		if (!payload || typeof payload !== "object") return;
		const candidate = payload;
		if (typeof candidate.sourceSessionPath !== "string" || typeof candidate.preparedAt !== "number" || !candidate.entries || typeof candidate.entries !== "object" || Array.isArray(candidate.entries)) return;
		const entries = {};
		for (const [key, value] of Object.entries(candidate.entries)) if (typeof value === "string") entries[key] = value;
		if (Object.keys(entries).length === 0) return;
		return {
			sourceSessionPath: candidate.sourceSessionPath,
			preparedAt: candidate.preparedAt,
			entries
		};
	}
	function validateBootstrapInfo(result) {
		if (!result || typeof result !== "object") return null;
		return { pendingLocalStorageMigration: validateLocalStorageMigrationPayload(result.pendingLocalStorageMigration) };
	}
	/**
	* 发起一次 __bootstrap IPC 并在 timeoutMs 后超时返回 null。
	* 成功时取消超时定时器避免误报日志。
	*/
	function attemptBootstrapIpc(attemptIndex, timeoutMs, t0) {
		logger.info(`[WorkBuddy Preload] __bootstrap IPC attempt #${attemptIndex} invoking (elapsed=${Date.now() - t0}ms, timeout=${timeoutMs}ms)`);
		const ipcCall = ipcRenderer.invoke("__bootstrap");
		let timeoutHandle = null;
		const timeout = new Promise((resolve) => {
			timeoutHandle = setTimeout(() => {
				timeoutHandle = null;
				logger.warn(`[WorkBuddy Preload] __bootstrap IPC attempt #${attemptIndex} timed out after ${timeoutMs}ms (elapsed=${Date.now() - t0}ms)`);
				resolve(null);
				try {
					ipcRenderer.send(PRELOAD_TIMEOUT_CHANNEL, { attempt: attemptIndex });
				} catch {}
			}, timeoutMs);
		});
		const cancelTimeout = () => {
			if (timeoutHandle !== null) {
				clearTimeout(timeoutHandle);
				timeoutHandle = null;
			}
		};
		return Promise.race([ipcCall, timeout]).then((result) => {
			cancelTimeout();
			if (result) {
				logger.info(`[WorkBuddy Preload] __bootstrap IPC attempt #${attemptIndex} succeeded in ${Date.now() - t0}ms`);
				return validateBootstrapInfo(result);
			}
			return null;
		}).catch((err) => {
			cancelTimeout();
			logger.warn(`[WorkBuddy Preload] __bootstrap IPC attempt #${attemptIndex} failed: ${String(err)} (elapsed=${Date.now() - t0}ms)`);
			return null;
		});
	}
	/**
	* 带自动重试的 bootstrap 握手：首次 10s 超时 → 每 5s 重试一次 → 90s 总预算内
	* 任一次成功即发 renderer:ready；总预算耗尽则彻底放弃，走 RendererLoadGuard 兜底。
	*/
	async function bootstrapWithRetry() {
		const t0 = Date.now();
		markPreloadPerf("D2");
		let attemptIndex = 1;
		let info = await attemptBootstrapIpc(attemptIndex, BOOTSTRAP_IPC_TIMEOUT_MS, t0);
		while (!info && Date.now() - t0 < BOOTSTRAP_IPC_MAX_TOTAL_MS) {
			const elapsedSoFar = Date.now() - t0;
			const remaining = BOOTSTRAP_IPC_MAX_TOTAL_MS - elapsedSoFar;
			if (remaining <= 0) break;
			attemptIndex++;
			logger.info(`[WorkBuddy Preload] __bootstrap scheduling retry #${attemptIndex} in ${BOOTSTRAP_IPC_RETRY_INTERVAL_MS}ms (elapsed=${elapsedSoFar}ms, remaining=${remaining}ms)`);
			await new Promise((resolve) => setTimeout(resolve, BOOTSTRAP_IPC_RETRY_INTERVAL_MS));
			const elapsedAfterWait = Date.now() - t0;
			if (elapsedAfterWait >= BOOTSTRAP_IPC_MAX_TOTAL_MS) {
				logger.error(`[WorkBuddy Preload] __bootstrap total budget exhausted during retry wait (elapsed=${elapsedAfterWait}ms, budget=${BOOTSTRAP_IPC_MAX_TOTAL_MS}ms)`);
				break;
			}
			const retryTimeout = Math.min(BOOTSTRAP_IPC_TIMEOUT_MS, BOOTSTRAP_IPC_MAX_TOTAL_MS - elapsedAfterWait);
			info = await attemptBootstrapIpc(attemptIndex, retryTimeout, t0);
		}
		if (info) {
			logger.info(`[WorkBuddy Preload] Bootstrap info valid after ${attemptIndex} attempt(s) (total=${Date.now() - t0}ms)`);
			markPreloadPerf("D3");
			try {
				ipcRenderer.send("renderer:ready");
			} catch {}
		} else {
			logger.error(`[WorkBuddy Preload] __bootstrap exhausted all retries (attempts=${attemptIndex}, total=${Date.now() - t0}ms, budget=${BOOTSTRAP_IPC_MAX_TOTAL_MS}ms) — renderer:ready will NOT be sent, falling back to RendererLoadGuard`);
			bootstrapInfoPromise = null;
		}
		return info;
	}
	function getBootstrapInfo() {
		if (bootstrapInfoPromise) return bootstrapInfoPromise;
		const attempt = bootstrapWithRetry();
		bootstrapInfoPromise = attempt;
		return attempt;
	}
	function applyPendingLocalStorageMigration() {
		if (applyMigrationPromise) return applyMigrationPromise;
		const attempt = (async () => {
			const payload = (await getBootstrapInfo())?.pendingLocalStorageMigration;
			if (!payload) return;
			const result = applyLocalStorageMigrationPayload(getTargetStorage(), payload);
			await ipcRenderer.invoke("__completeLocalStorageMigration", result);
		})().catch((error) => {
			applyMigrationPromise = null;
			throw error;
		});
		applyMigrationPromise = attempt;
		return attempt;
	}
	async function getPendingDisplayLanguageMigration() {
		await applyPendingLocalStorageMigration();
		const storage = getTargetStorage();
		const entries = {};
		for (const key of LEGACY_DISPLAY_LANGUAGE_STORAGE_KEYS) {
			const value = storage.getItem(key);
			if (typeof value === "string") entries[key] = value;
		}
		return Object.keys(entries).length > 0 ? { entries } : null;
	}
	async function completeDisplayLanguageMigration(keys) {
		const allowedKeys = new Set(LEGACY_DISPLAY_LANGUAGE_STORAGE_KEYS);
		const storage = getTargetStorage();
		for (const key of keys) if (allowedKeys.has(key)) storage.removeItem(key);
	}
	return {
		applyPendingLocalStorageMigration,
		completeDisplayLanguageMigration,
		getBootstrapInfo,
		getPendingDisplayLanguageMigration
	};
}
var BOOTSTRAP_IPC_TIMEOUT_MS, BOOTSTRAP_IPC_RETRY_INTERVAL_MS, BOOTSTRAP_IPC_MAX_TOTAL_MS;
var init_renderer_ready_handshake = __esmMin((() => {
	init_localstorage_migration();
	init_startup_ipc_channels();
	init_preload_perf_marks();
	BOOTSTRAP_IPC_TIMEOUT_MS = 1e4;
	BOOTSTRAP_IPC_RETRY_INTERVAL_MS = 5e3;
	BOOTSTRAP_IPC_MAX_TOTAL_MS = 9e4;
}));
//#endregion
//#region src/preload/migration-bridge.ts
var init_migration_bridge = __esmMin((() => {
	init_renderer_ready_handshake();
}));
//#endregion
//#region src/preload/native-theme-sync.ts
function resolveIsDark(themeKind) {
	if (themeKind === "vscode-light" || themeKind === "vscode-high-contrast-light") return false;
	if (themeKind === "vscode-dark" || themeKind === "vscode-high-contrast") return true;
}
function installNativeThemeSync(ipcRenderer, logger) {
	if (typeof document === "undefined") return () => void 0;
	let observer;
	let disposed = false;
	const report = () => {
		const isDark = resolveIsDark(document.body?.getAttribute("data-vscode-theme-kind") ?? null);
		if (isDark == null) return;
		ipcRenderer.invoke(WORKBUDDY_WINDOW_SYNC_NATIVE_THEME_CHANNEL, isDark).catch((error) => {
			logger?.warn("[NativeThemeSync] sync failed", error);
		});
	};
	const start = () => {
		if (disposed || observer || !document.body) return;
		report();
		observer = new MutationObserver((mutations) => {
			if (mutations.some((mutation) => mutation.attributeName === "data-vscode-theme-kind")) report();
		});
		observer.observe(document.body, {
			attributes: true,
			attributeFilter: ["data-vscode-theme-kind"]
		});
	};
	if (document.body) start();
	else document.addEventListener("DOMContentLoaded", start, { once: true });
	return () => {
		disposed = true;
		document.removeEventListener("DOMContentLoaded", start);
		observer?.disconnect();
	};
}
var init_native_theme_sync = __esmMin((() => {
	init_desktop();
}));
function sendRendererJsError(payload) {
	if (++rendererErrorCount > MAX_RENDERER_ERRORS) return;
	try {
		electron.ipcRenderer.send(RENDERER_JS_ERROR_CHANNEL, payload);
	} catch {}
}
var import_renderer$2, preloadLog$1, earlyEventBuffer, devtoolsTerminalBridge, applyPendingLocalStorageMigration, completeDisplayLanguageMigration, getBootstrapInfo, getPendingDisplayLanguageMigration, hostPlatformPayload, workbuddyDesktop, vscode, packagedRuntimeEnv, debugHubEnabled, wbEventListeners, RENDERER_JS_ERROR_CHANNEL, MAX_RENDERER_ERRORS, rendererErrorCount, RENDERER_LOG_WRITE_CHANNEL;
var init_bootstrap = __esmMin((() => {
	init_desktop();
	import_renderer$2 = /* @__PURE__ */ __toESM(require_renderer());
	init_ipc_channels();
	init_install_renderer_bridges();
	init_workbuddy_desktop_host();
	init_daemon_frame_channel();
	init_devtools_terminal_bridge();
	init_early_event_buffer();
	init_host_platform_bridge();
	init_migration_bridge();
	init_native_theme_sync();
	init_preload_perf_marks();
	preloadLog$1 = import_renderer$2.default.scope("preload");
	markPreloadPerf("D1");
	earlyEventBuffer = createEarlyEventBuffer(electron.ipcRenderer);
	earlyEventBuffer.startPushListening();
	earlyEventBuffer.pullPendingWechatChips().catch(() => {});
	installDaemonTransportPortForwarder();
	devtoolsTerminalBridge = createDevtoolsTerminalBridge(electron.ipcRenderer);
	({applyPendingLocalStorageMigration, completeDisplayLanguageMigration, getBootstrapInfo, getPendingDisplayLanguageMigration} = createMigrationBridge({
		ipcRenderer: electron.ipcRenderer,
		logger: preloadLog$1
	}));
	applyPendingLocalStorageMigration().catch((error) => {
		preloadLog$1.error("[WorkBuddy Preload] localStorage migration apply failed", error);
	});
	hostPlatformPayload = resolveHostPlatformPayload(electron.ipcRenderer, preloadLog$1);
	workbuddyDesktop = createWorkbuddyDesktopHost({
		ipcRenderer: electron.ipcRenderer,
		earlyEventBuffer,
		appVersion: hostPlatformPayload.appVersion ?? "",
		configDir: hostPlatformPayload.configDir ?? "",
		completeDisplayLanguageMigration,
		getBootstrapInfo,
		getPendingDisplayLanguageMigration
	});
	installNativeThemeSync(electron.ipcRenderer, preloadLog$1);
	vscode = { webUtils: { getPathForFile(file) {
		return electron.webUtils.getPathForFile(file);
	} } };
	electron.contextBridge.exposeInMainWorld("workbuddyDesktop", workbuddyDesktop);
	electron.contextBridge.exposeInMainWorld("__workbuddyDevtoolsTerminal", devtoolsTerminalBridge);
	markPreloadPerf("D4");
	electron.contextBridge.exposeInMainWorld("vscode", vscode);
	markPreloadPerf("D5");
	electron.contextBridge.exposeInMainWorld("__workbuddyStartupPerfD", Object.freeze({ drain: drainPreloadPerfBuffer }));
	electron.contextBridge.exposeInMainWorld("__hostPlatform", Object.freeze({
		platform: hostPlatformPayload.platform,
		arch: hostPlatformPayload.arch,
		hostArch: hostPlatformPayload.hostArch
	}));
	electron.contextBridge.exposeInMainWorld("__hostPlatformProbe", Object.freeze(hostPlatformPayload.probe));
	electron.contextBridge.exposeInMainWorld("__setShortcutRecordingState", (recording) => {
		electron.ipcRenderer.send("shortcut:set-recording-state", recording);
	});
	packagedRuntimeEnv = process.env.WORKBUDDY_IS_PACKAGED;
	debugHubEnabled = packagedRuntimeEnv === "0" || packagedRuntimeEnv === "false" || process.env.WORKBUDDY_ENABLE_DEBUG_HUB === "true";
	if (debugHubEnabled) electron.contextBridge.exposeInMainWorld("__debugCrashTest", (crashType) => electron.ipcRenderer.invoke("debug:crashTest", crashType));
	if (debugHubEnabled) electron.contextBridge.exposeInMainWorld("__openTencentDocsDebugPanel", () => electron.ipcRenderer.invoke("debug:openTencentDocsPanel"));
	electron.contextBridge.exposeInMainWorld("__openStartupAnalysis", () => electron.ipcRenderer.invoke(WORKBUDDY_WINDOW_OPEN_STARTUP_ANALYSIS_CHANNEL));
	electron.contextBridge.exposeInMainWorld("__getStartupTraceid", () => electron.ipcRenderer.invoke(WORKBUDDY_WINDOW_GET_STARTUP_TRACE_ID_CHANNEL));
	electron.contextBridge.exposeInMainWorld("__signalStartupFirstPaint", () => electron.ipcRenderer.invoke("renderer:signalStartupFirstPaint").then(() => void 0).catch(() => void 0));
	electron.contextBridge.exposeInMainWorld("__signalFirstLocalListRendered", () => electron.ipcRenderer.invoke("renderer:signalFirstLocalListRendered").then(() => void 0).catch(() => void 0));
	electron.contextBridge.exposeInMainWorld("__signalSkeletonReady", () => {
		electron.ipcRenderer.send("renderer:skeleton-ready");
	});
	electron.contextBridge.exposeInMainWorld("__wbInvoke", (channel, context, ...args) => electron.ipcRenderer.invoke("wb:invoke", channel, context, ...args));
	wbEventListeners = /* @__PURE__ */ new Map();
	electron.contextBridge.exposeInMainWorld("__wbOn", (channel, listener) => {
		const ipcListener = (_event, ...payload) => listener(...payload);
		if (!wbEventListeners.has(channel)) wbEventListeners.set(channel, /* @__PURE__ */ new Map());
		wbEventListeners.get(channel).set(listener, ipcListener);
		electron.ipcRenderer.on(channel, ipcListener);
	});
	electron.contextBridge.exposeInMainWorld("__wbOff", (channel, listener) => {
		const channelMap = wbEventListeners.get(channel);
		if (!channelMap) return;
		const ipcListener = channelMap.get(listener);
		if (ipcListener) {
			electron.ipcRenderer.removeListener(channel, ipcListener);
			channelMap.delete(listener);
		}
	});
	electron.contextBridge.exposeInMainWorld("__wbEventBridge", (callback) => {
		const ipcListener = (_ipcEvent, data) => {
			callback(data.event, data.payload);
		};
		electron.ipcRenderer.on("wb:event", ipcListener);
		return () => {
			electron.ipcRenderer.removeListener("wb:event", ipcListener);
		};
	});
	electron.contextBridge.exposeInMainWorld("__getTdocImportPreloadUrl", () => electron.ipcRenderer.invoke("tdoc-import:get-preload-url"));
	electron.contextBridge.exposeInMainWorld("__getTdocPreviewPreloadUrl", () => electron.ipcRenderer.invoke("tdoc-preview:get-preload-url"));
	electron.contextBridge.exposeInMainWorld("__getHostWebviewPreloadUrl", () => electron.ipcRenderer.invoke("workbuddy:tencentDocs:getWebviewPreloadUrl"));
	electron.contextBridge.exposeInMainWorld("__getClientMenuPreloadUrl", () => electron.ipcRenderer.invoke("client-menu:get-preload-url"));
	installTencentDocsPreviewBridges(electron.contextBridge, electron.ipcRenderer);
	electron.contextBridge.exposeInMainWorld("__setTencentDocsLanguage", (language) => electron.ipcRenderer.invoke("workbuddy:tencentDocs:setLanguage", language));
	electron.contextBridge.exposeInMainWorld("__setTencentDocsTheme", (theme) => electron.ipcRenderer.invoke("workbuddy:tencentDocs:setTheme", theme));
	electron.contextBridge.exposeInMainWorld("__consumeTencentDocsRendererEvents", () => electron.ipcRenderer.invoke("tencent-docs:consume-pending-renderer-events"));
	electron.contextBridge.exposeInMainWorld("__checkWechatInstalled__", () => {
		try {
			return electron.ipcRenderer.sendSync(WECHAT_IS_INSTALLED_SYNC_CHANNEL) !== false;
		} catch (error) {
			preloadLog$1.warn("[WorkBuddy Preload] wechat isInstalled sendSync failed", error);
			return false;
		}
	});
	electron.contextBridge.exposeInMainWorld("__getWechatVersion__", () => {
		try {
			const version = electron.ipcRenderer.sendSync(WECHAT_GET_VERSION_SYNC_CHANNEL);
			return typeof version === "string" && version ? version : null;
		} catch (error) {
			preloadLog$1.warn("[WorkBuddy Preload] wechat getVersion sendSync failed", error);
			return null;
		}
	});
	electron.contextBridge.exposeInMainWorld("__checkWechatRunning__", () => {
		try {
			return electron.ipcRenderer.sendSync(WECHAT_IS_RUNNING_SYNC_CHANNEL) !== false;
		} catch (error) {
			preloadLog$1.warn("[WorkBuddy Preload] wechat isRunning sendSync failed", error);
			return true;
		}
	});
	electron.contextBridge.exposeInMainWorld("__launchWechat__", () => electron.ipcRenderer.invoke(WECHAT_LAUNCH_CHANNEL).then((result) => result === true).catch((error) => {
		preloadLog$1.warn("[WorkBuddy Preload] wechat launch invoke failed", error);
		return false;
	}));
	RENDERER_JS_ERROR_CHANNEL = "crash:renderer-js-error";
	MAX_RENDERER_ERRORS = 20;
	rendererErrorCount = 0;
	window.addEventListener("error", (event) => {
		sendRendererJsError({
			subType: "uncaught_exception",
			message: event.message ?? "",
			filename: event.filename ?? "",
			lineno: event.lineno ?? 0,
			colno: event.colno ?? 0,
			stack: event.error?.stack ?? null,
			url: location.href
		});
	});
	window.addEventListener("unhandledrejection", (event) => {
		const reason = event.reason;
		sendRendererJsError({
			subType: "unhandled_rejection",
			message: reason?.message ?? String(reason ?? ""),
			filename: "",
			lineno: 0,
			colno: 0,
			stack: reason?.stack ?? null,
			url: location.href
		});
	});
	electron.contextBridge.exposeInMainWorld("__reportRendererJsError", (payload) => sendRendererJsError(payload));
	RENDERER_LOG_WRITE_CHANNEL = "renderer-log:write";
	electron.contextBridge.exposeInMainWorld("__workbuddyRendererLogWrite", (payload) => {
		try {
			electron.ipcRenderer.send(RENDERER_LOG_WRITE_CHANNEL, payload);
		} catch {}
	});
}));
//#endregion
//#region ../../packages/workbuddy-server/src/docs-shared/feature-list.ts
function getFeatureValue(options) {
	const inConversation = Boolean(options?.inConversation);
	const aiEditEnabled = options?.aiEditEnabled !== false;
	return { aiEdit: inConversation && aiEditEnabled };
}
/** 返回 JSON 字符串（如 `{"aiEdit":true}`），供 `executeJavaScript` 拼接用。 */
function getDocsFeatureListString(options) {
	return JSON.stringify(getFeatureValue(options));
}
/** 返回原始对象，供 preload / main process 代码直接访问。 */
function getDocsFeatureList(options) {
	return getFeatureValue(options);
}
var DOCS_FEATURE_LIST_GLOBAL;
var init_feature_list = __esmMin((() => {
	DOCS_FEATURE_LIST_GLOBAL = "__WB_DOCS_FEATURE_LIST__";
}));
//#endregion
//#region ../../packages/workbuddy-server/src/docs-shared/mqq/bridge.ts
var WORKBUDDY_MQQ_BRIDGE_CHANNEL, WORKBUDDY_MQQ_DIRTY_GUARD_CHANNEL, WORKBUDDY_MQQ_ACCESS_PROBE_API;
var init_bridge = __esmMin((() => {
	WORKBUDDY_MQQ_BRIDGE_CHANNEL = "workbuddy:mqqBridge";
	WORKBUDDY_MQQ_DIRTY_GUARD_CHANNEL = "workbuddy:mqqDirtyGuard";
	WORKBUDDY_MQQ_ACCESS_PROBE_API = "workbuddy.accessProbe";
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+tencent-docs-ai-en_afd80b6f2f2936220f49bf4ebb2d0283/node_modules/@tencent/tencent-docs-ai-engine/lib/common/document-types.js
var require_document_types = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.TENCENT_DOCS_ENGINE_SUPPORTED_EXTENSIONS = exports.TENCENT_DOCS_ENGINE_FILE_TYPES = void 0;
	exports.getTencentDocsEngineDocType = getTencentDocsEngineDocType;
	exports.getTencentDocsSelectionFileType = getTencentDocsSelectionFileType;
	exports.isTencentDocsEngineSupportedExtension = isTencentDocsEngineSupportedExtension;
	exports.isTencentDocsEngineDocType = isTencentDocsEngineDocType;
	exports.TENCENT_DOCS_ENGINE_FILE_TYPES = Object.freeze([
		Object.freeze({
			engineType: "doc",
			selectionFileType: "word",
			extensions: Object.freeze([
				".doc",
				".docx",
				".dot",
				".dotx",
				".wps",
				".wpt",
				".docm",
				".dotm"
			])
		}),
		Object.freeze({
			engineType: "sheet",
			selectionFileType: "excel",
			extensions: Object.freeze([
				".csv",
				".xls",
				".xlsx",
				".xlt",
				".xltx",
				".xlsm",
				".xltm"
			])
		}),
		Object.freeze({
			engineType: "slide",
			selectionFileType: "ppt",
			extensions: Object.freeze([
				".pptx",
				".ppt",
				".pps",
				".pot",
				".pptm",
				".ppsx",
				".ppsm",
				".potx",
				".potm"
			])
		}),
		Object.freeze({
			engineType: "pdf",
			selectionFileType: "pdf",
			extensions: Object.freeze([".pdf"])
		})
	]);
	exports.TENCENT_DOCS_ENGINE_SUPPORTED_EXTENSIONS = Object.freeze(exports.TENCENT_DOCS_ENGINE_FILE_TYPES.flatMap((item) => item.extensions));
	var engineDocTypeSet = new Set(exports.TENCENT_DOCS_ENGINE_FILE_TYPES.map((item) => item.engineType));
	var extensionToFileType = /* @__PURE__ */ new Map();
	for (const item of exports.TENCENT_DOCS_ENGINE_FILE_TYPES) for (const ext of item.extensions) extensionToFileType.set(ext, item);
	function normalizeTencentDocsFileExtension(value) {
		const trimmed = value.trim();
		if (!trimmed) return "";
		if (!/[\\/]/.test(trimmed) && !trimmed.includes(".")) {
			const bare = trimmed.split(/[?#]/, 1)[0] ?? "";
			return bare ? `.${bare.toLowerCase()}` : "";
		}
		const slashIndex = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
		const fileName = trimmed.slice(slashIndex + 1);
		const dotIndex = fileName.lastIndexOf(".");
		if (dotIndex < 0 || dotIndex === fileName.length - 1) return "";
		const extToken = fileName.slice(dotIndex + 1).split(/[?#]/, 1)[0] ?? "";
		return extToken ? `.${extToken.toLowerCase()}` : "";
	}
	function getTencentDocsEngineFileType(value) {
		return extensionToFileType.get(normalizeTencentDocsFileExtension(value));
	}
	function getTencentDocsEngineDocType(value) {
		return getTencentDocsEngineFileType(value)?.engineType;
	}
	function getTencentDocsSelectionFileType(value) {
		return getTencentDocsEngineFileType(value)?.selectionFileType;
	}
	function isTencentDocsEngineSupportedExtension(value) {
		return Boolean(getTencentDocsEngineFileType(value));
	}
	function isTencentDocsEngineDocType(value) {
		return Boolean(value && engineDocTypeSet.has(value));
	}
}));
//#endregion
//#region ../../packages/workbuddy-server/src/docs-shared/url-guards.ts
function isTencentDocsUrl(url) {
	try {
		const parsed = new URL(url);
		return parsed.protocol === "https:" && (parsed.hostname === "docs.qq.com" || parsed.hostname.endsWith(".docs.qq.com"));
	} catch {
		return false;
	}
}
function isLocalTencentDocsEnginePreviewUrl(url) {
	try {
		const parsed = new URL(url);
		const segments = parsed.pathname.split("/").filter(Boolean);
		return parsed.protocol === "http:" && (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") && segments.length === 3 && segments[0] === "static" && (0, import_document_types.isTencentDocsEngineDocType)(segments[1]) && segments[2] === "pc.html";
	} catch {
		return false;
	}
}
/**
* 解析云端沙箱 EditorSDK 候选页面 URL。
*
* ## 它不是授权依据
*
* 这一点必须反复强调：云沙箱 origin 是动态的，任何「形态像就放行」的判断都能被
* 伪造出一个同形 URL 绕过。本函数的唯一作用是**收窄 probe 范围**——让 preload
* 不必对 BrowserWindow 里的每个 https 子 frame 都去问一次 main。
*
* 真正的授权在 Electron main：`senderFrame` 必须精确命中一条由可信顶层 renderer
* 预先登记的预览实例（host + exact URL + 已绑定 frame）。形态判定通过但没有注册
* 记录的页面，一样拿不到任何能力。
*
* 与 `isLocalTencentDocsEnginePreviewUrl` 分开而不是合并：本地是 http + 回环地址，
* 云端是 https + 动态子域，两者的信任来源根本不同，合并会让人误以为可以共用同一套
* origin 校验。
*/
function parseCloudSandboxEditorSdkCandidateUrl(url) {
	let parsed;
	try {
		parsed = new URL(url);
	} catch {
		return null;
	}
	if (parsed.protocol !== "https:") return null;
	if (parsed.username || parsed.password) return null;
	if (!/^[a-z0-9.-]+$/.test(parsed.hostname) || parsed.hostname.includes("xn--")) return null;
	const segments = parsed.pathname.split("/").filter(Boolean);
	const docType = segments[1];
	if (segments.length !== 3 || segments[0] !== "static" || !docType || !CLOUD_SANDBOX_DOC_TYPES.has(docType) || segments[2] !== "pc.html") return null;
	const hostPrefix = parsed.hostname.split(".")[0] ?? "";
	const expectedPortPrefix = `${CLOUD_SANDBOX_EDITOR_SDK_PORT}-`;
	if (!hostPrefix.startsWith(expectedPortPrefix)) return null;
	const sandboxId = hostPrefix.slice(expectedPortPrefix.length);
	if (!sandboxId) return null;
	return {
		sandboxId,
		docType,
		origin: parsed.origin
	};
}
/** {@link parseCloudSandboxEditorSdkCandidateUrl} 的布尔封装。同样**不是**授权依据。 */
function isCloudSandboxEditorSdkCandidateUrl(url) {
	return parseCloudSandboxEditorSdkCandidateUrl(url) !== null;
}
/**
* 是否允许给该 origin / URL 放开剪贴板权限（Electron permission handler 用）。
*
* 覆盖两类腾讯文档预览 frame：
*  - 在线：https://docs.qq.com 及子域（按 host 放行）；
*  - 本地 SDK 预览：与当前引擎**实际产出**的 preview origin 完全一致（host + 动态端口）。
*
* `localEngineOrigin` 由调用方传入，取自引擎真实 previewUrl 的 origin（见
* tencent-docs-engine-origin-registry），不写死 127.0.0.1——引擎换 host/端口会
* 自动跟随。未知（undefined）时本地一律不放行。这样既绕开 setPermissionCheckHandler
* 只有 origin（无 pathname）无法校验 `/static/{type}/pc.html` 的限制，又把放行范围
* 精确收敛到「文档 SDK 自己的 origin」，不会波及任意其它本地服务。
*/
function isTencentDocsClipboardOrigin(originOrUrl, localEngineOrigin) {
	if (!originOrUrl) return false;
	if (isTencentDocsUrl(originOrUrl)) return true;
	if (!localEngineOrigin) return false;
	try {
		return new URL(originOrUrl).origin === new URL(localEngineOrigin).origin;
	} catch {
		return false;
	}
}
var import_document_types, CLOUD_SANDBOX_EDITOR_SDK_PORT, CLOUD_SANDBOX_DOC_TYPES;
var init_url_guards = __esmMin((() => {
	import_document_types = require_document_types();
	CLOUD_SANDBOX_EDITOR_SDK_PORT = 39099;
	CLOUD_SANDBOX_DOC_TYPES = new Set([
		"doc",
		"sheet",
		"slide"
	]);
}));
//#endregion
//#region ../../packages/workbuddy-server/src/docs-shared/mqq/guest-telemetry.ts
var WORKBUDDY_REPORT_TELEMETRY_API;
var init_guest_telemetry = __esmMin((() => {
	WORKBUDDY_REPORT_TELEMETRY_API = "workbuddy.reportTelemetry";
}));
//#endregion
//#region ../../packages/workbuddy-server/src/docs-shared/mqq/protocol.ts
function buildMqqSubscriberSubscribeApi(eventName) {
	return `subscriber.subscribe#${eventName}`;
}
function buildMqqSubscriberUnsubscribeApi(eventName) {
	return `subscriber.unsubscribe#${eventName}`;
}
function createUnhandledBridgeResponse(id) {
	return {
		id,
		errCode: -32601,
		ret: MQQ_API_NOT_IMPLEMENTED_MESSAGE,
		hasHandled: false
	};
}
function toCallbackResult(response) {
	if (response.errCode !== 0 || !response.hasHandled) return {
		code: response.errCode,
		err: typeof response.ret === "string" ? response.ret : MQQ_API_NOT_IMPLEMENTED_MESSAGE,
		hasHandled: response.hasHandled
	};
	return {
		code: response.errCode,
		data: response.ret,
		hasHandled: response.hasHandled
	};
}
function toInternalErrorResult(error) {
	return {
		code: MQQ_INTERNAL_ERROR_CODE,
		err: error instanceof Error ? error.message : String(error),
		hasHandled: false
	};
}
function createPermissionDeniedResult() {
	return {
		code: MQQ_INTERNAL_ERROR_CODE,
		err: MQQ_PERMISSION_DENIED_MESSAGE,
		hasHandled: false
	};
}
function isPromiseLike(value) {
	return Boolean(value && typeof value === "object" && typeof value.then === "function");
}
function canAccessMqqLevel(pageUrl, level, localEngineOrigin) {
	if (!pageUrl) return false;
	switch (level) {
		case MqqLevel.C_DOCS: return isTencentDocsUrl(pageUrl);
		case MqqLevel.C_LOCAL_EDIT: return isTencentDocsUrl(pageUrl) || isLocalTencentDocsEnginePreviewUrl(pageUrl) && isTencentDocsClipboardOrigin(pageUrl, localEngineOrigin);
		case MqqLevel.C_SANDBOX_SELECTION: return isCloudSandboxEditorSdkCandidateUrl(pageUrl);
		default: return false;
	}
}
function buildApiPermissionMap(apiPermissions) {
	return new Map((apiPermissions ?? []).map((permission) => [permission.apiName, permission.level]));
}
function checkMqqApiPermission(apiName, pageUrl, localEngineOrigin, apiPermissionMap, requireRegisteredApiPermission) {
	const level = apiPermissionMap.get(apiName);
	if (!level) {
		if (requireRegisteredApiPermission) return false;
		return true;
	}
	if (level === MqqLevel.C_LOCAL_EDIT && pageUrl && isLocalTencentDocsEnginePreviewUrl(pageUrl)) return true;
	if (!canAccessMqqLevel(pageUrl, level, localEngineOrigin)) return false;
	return true;
}
function shouldExposeMqqProtocol(url) {
	return isTencentDocsUrl(url) || isLocalTencentDocsEnginePreviewUrl(url);
}
function createMqqProtocol(options = {}) {
	const callbacks = /* @__PURE__ */ new Map();
	const subscriberCallbacks = /* @__PURE__ */ new Map();
	const invokeHandler = options.invokeHandler;
	const pageUrl = options.pageUrl;
	const localEngineOrigin = options.localEngineOrigin;
	const apiPermissionMap = buildApiPermissionMap(options.apiPermissions);
	const requireRegisteredApiPermission = options.requireRegisteredApiPermission === true;
	let nextRequestId = 0;
	let nextSubscriberId = 0;
	const runInvoke = (request, callback) => {
		const result = invokeHandler?.(request) ?? createUnhandledBridgeResponse(request.id);
		if (isPromiseLike(result)) {
			result.then((ret) => callback?.(toCallbackResult(ret))).catch((error) => callback?.(toInternalErrorResult(error)));
			return;
		}
		callback?.(toCallbackResult(result));
	};
	const invokeBridge = (apiName, args, callback) => {
		if (!checkMqqApiPermission(apiName, pageUrl, localEngineOrigin, apiPermissionMap, requireRegisteredApiPermission)) {
			callback?.(createPermissionDeniedResult());
			return;
		}
		nextRequestId += 1;
		runInvoke({
			id: nextRequestId,
			apiName,
			args
		}, callback);
	};
	return {
		invoke(moduleName, methodName, args = {}, callback) {
			invokeBridge(`${moduleName}.${methodName}`, [args], callback);
		},
		addEventListener(eventName, handler) {
			const handlers = callbacks.get(eventName) ?? [];
			handlers.push(handler);
			callbacks.set(eventName, handlers);
			return true;
		},
		removeEventListener(eventName, handler) {
			const handlers = callbacks.get(eventName);
			if (!handlers) return;
			const index = handlers.indexOf(handler);
			if (index >= 0) handlers.splice(index, 1);
			if (handlers.length === 0) callbacks.delete(eventName);
		},
		async execEventCallback(eventName, ...args) {
			const handlers = [...callbacks.get(eventName) ?? [], ...subscriberCallbacks.get(eventName) ?? []];
			if (handlers.length === 0) return;
			return Promise.all(handlers.slice().map((handler) => {
				try {
					return handler(...args);
				} catch (error) {
					return error instanceof Error ? error : new Error(String(error));
				}
			}));
		},
		createSubscribe(name) {
			nextSubscriberId += 1;
			return new MqqSubscriberImpl(name, nextSubscriberId, invokeBridge, subscriberCallbacks);
		}
	};
}
var MqqLevel, DOCX_ON_SELECTION_CHANGE_API, DOCX_ON_SELECTION_SEND_API, DOCX_ON_DOCUMENT_STATUS_CHANGED_API, DOCUMENT_FRAME_WILL_APPEAR_EVENT, DOCUMENT_FRAME_WILL_DISAPPEAR_EVENT, DOCUMENT_FRAME_WILL_CLOSE_EVENT, DOCUMENT_FRAME_CLOSE_EVENT, DOCUMENT_FRAME_WILL_REMOVE_EVENT, DOCUMENT_FRAME_REMOVED_EVENT, DOCUMENT_FRAME_WILL_APPEAR_SUBSCRIBE_API, DOCUMENT_FRAME_WILL_APPEAR_UNSUBSCRIBE_API, DOCUMENT_FRAME_WILL_DISAPPEAR_SUBSCRIBE_API, DOCUMENT_FRAME_WILL_DISAPPEAR_UNSUBSCRIBE_API, DOCUMENT_FRAME_WILL_CLOSE_SUBSCRIBE_API, DOCUMENT_FRAME_WILL_CLOSE_UNSUBSCRIBE_API, DOCUMENT_FRAME_CLOSE_SUBSCRIBE_API, DOCUMENT_FRAME_CLOSE_UNSUBSCRIBE_API, DOCUMENT_FRAME_WILL_REMOVE_SUBSCRIBE_API, DOCUMENT_FRAME_WILL_REMOVE_UNSUBSCRIBE_API, DOCUMENT_FRAME_REMOVED_SUBSCRIBE_API, DOCUMENT_FRAME_REMOVED_UNSUBSCRIBE_API, TENCENT_DOCS_MQQ_API_PERMISSIONS, SANDBOX_DOCS_MQQ_API_PERMISSIONS, MQQ_API_NOT_IMPLEMENTED_MESSAGE, MQQ_PERMISSION_DENIED_MESSAGE, MQQ_INTERNAL_ERROR_CODE, MqqSubscriberImpl;
var init_protocol = __esmMin((() => {
	init_url_guards();
	init_guest_telemetry();
	MqqLevel = /* @__PURE__ */ function(MqqLevel) {
		/** Tencent Docs online pages. */
		MqqLevel["C_DOCS"] = "C_DOCS";
		/** Tencent Docs local-edit / document preview pages. */
		MqqLevel["C_LOCAL_EDIT"] = "C_LOCAL_EDIT";
		/**
		* 云端沙箱 EditorSDK 页面，能力面只有选区。
		*
		* 单独一档而不是复用 `C_LOCAL_EDIT`：本地那一档挂着保存、dirty guard、
		* frame lifecycle、埋点等一整套本地文档能力，云页面一项都不该拿到。
		* 共用一档意味着以后往本地表加能力时会静默泄漏给云页面。
		*/
		MqqLevel["C_SANDBOX_SELECTION"] = "C_SANDBOX_SELECTION";
		return MqqLevel;
	}({});
	DOCX_ON_SELECTION_CHANGE_API = "docx.onSelectionChange";
	DOCX_ON_SELECTION_SEND_API = "docx.onSelectionSend";
	DOCX_ON_DOCUMENT_STATUS_CHANGED_API = "docx.onDocumentStatusChanged";
	DOCUMENT_FRAME_WILL_APPEAR_EVENT = "documentFrameWillAppear";
	DOCUMENT_FRAME_WILL_DISAPPEAR_EVENT = "documentFrameWillDisappear";
	DOCUMENT_FRAME_WILL_CLOSE_EVENT = "documentFrameWillClose";
	DOCUMENT_FRAME_CLOSE_EVENT = "documentFrameClose";
	DOCUMENT_FRAME_WILL_REMOVE_EVENT = "documentFrameWillRemove";
	DOCUMENT_FRAME_REMOVED_EVENT = "documentFrameRemoved";
	DOCUMENT_FRAME_WILL_APPEAR_SUBSCRIBE_API = buildMqqSubscriberSubscribeApi(DOCUMENT_FRAME_WILL_APPEAR_EVENT);
	DOCUMENT_FRAME_WILL_APPEAR_UNSUBSCRIBE_API = buildMqqSubscriberUnsubscribeApi(DOCUMENT_FRAME_WILL_APPEAR_EVENT);
	DOCUMENT_FRAME_WILL_DISAPPEAR_SUBSCRIBE_API = buildMqqSubscriberSubscribeApi(DOCUMENT_FRAME_WILL_DISAPPEAR_EVENT);
	DOCUMENT_FRAME_WILL_DISAPPEAR_UNSUBSCRIBE_API = buildMqqSubscriberUnsubscribeApi(DOCUMENT_FRAME_WILL_DISAPPEAR_EVENT);
	DOCUMENT_FRAME_WILL_CLOSE_SUBSCRIBE_API = buildMqqSubscriberSubscribeApi(DOCUMENT_FRAME_WILL_CLOSE_EVENT);
	DOCUMENT_FRAME_WILL_CLOSE_UNSUBSCRIBE_API = buildMqqSubscriberUnsubscribeApi(DOCUMENT_FRAME_WILL_CLOSE_EVENT);
	DOCUMENT_FRAME_CLOSE_SUBSCRIBE_API = buildMqqSubscriberSubscribeApi(DOCUMENT_FRAME_CLOSE_EVENT);
	DOCUMENT_FRAME_CLOSE_UNSUBSCRIBE_API = buildMqqSubscriberUnsubscribeApi(DOCUMENT_FRAME_CLOSE_EVENT);
	DOCUMENT_FRAME_WILL_REMOVE_SUBSCRIBE_API = buildMqqSubscriberSubscribeApi(DOCUMENT_FRAME_WILL_REMOVE_EVENT);
	DOCUMENT_FRAME_WILL_REMOVE_UNSUBSCRIBE_API = buildMqqSubscriberUnsubscribeApi(DOCUMENT_FRAME_WILL_REMOVE_EVENT);
	DOCUMENT_FRAME_REMOVED_SUBSCRIBE_API = buildMqqSubscriberSubscribeApi(DOCUMENT_FRAME_REMOVED_EVENT);
	DOCUMENT_FRAME_REMOVED_UNSUBSCRIBE_API = buildMqqSubscriberUnsubscribeApi(DOCUMENT_FRAME_REMOVED_EVENT);
	TENCENT_DOCS_MQQ_API_PERMISSIONS = [
		{
			apiName: WORKBUDDY_REPORT_TELEMETRY_API,
			level: MqqLevel.C_LOCAL_EDIT
		},
		{
			apiName: DOCX_ON_SELECTION_CHANGE_API,
			level: MqqLevel.C_LOCAL_EDIT
		},
		{
			apiName: DOCX_ON_SELECTION_SEND_API,
			level: MqqLevel.C_LOCAL_EDIT
		},
		{
			apiName: DOCX_ON_DOCUMENT_STATUS_CHANGED_API,
			level: MqqLevel.C_LOCAL_EDIT
		},
		{
			apiName: DOCUMENT_FRAME_WILL_APPEAR_SUBSCRIBE_API,
			level: MqqLevel.C_LOCAL_EDIT
		},
		{
			apiName: DOCUMENT_FRAME_WILL_APPEAR_UNSUBSCRIBE_API,
			level: MqqLevel.C_LOCAL_EDIT
		},
		{
			apiName: DOCUMENT_FRAME_WILL_DISAPPEAR_SUBSCRIBE_API,
			level: MqqLevel.C_LOCAL_EDIT
		},
		{
			apiName: DOCUMENT_FRAME_WILL_DISAPPEAR_UNSUBSCRIBE_API,
			level: MqqLevel.C_LOCAL_EDIT
		},
		{
			apiName: DOCUMENT_FRAME_WILL_CLOSE_SUBSCRIBE_API,
			level: MqqLevel.C_LOCAL_EDIT
		},
		{
			apiName: DOCUMENT_FRAME_WILL_CLOSE_UNSUBSCRIBE_API,
			level: MqqLevel.C_LOCAL_EDIT
		},
		{
			apiName: DOCUMENT_FRAME_CLOSE_SUBSCRIBE_API,
			level: MqqLevel.C_LOCAL_EDIT
		},
		{
			apiName: DOCUMENT_FRAME_CLOSE_UNSUBSCRIBE_API,
			level: MqqLevel.C_LOCAL_EDIT
		},
		{
			apiName: DOCUMENT_FRAME_WILL_REMOVE_SUBSCRIBE_API,
			level: MqqLevel.C_LOCAL_EDIT
		},
		{
			apiName: DOCUMENT_FRAME_WILL_REMOVE_UNSUBSCRIBE_API,
			level: MqqLevel.C_LOCAL_EDIT
		},
		{
			apiName: DOCUMENT_FRAME_REMOVED_SUBSCRIBE_API,
			level: MqqLevel.C_LOCAL_EDIT
		},
		{
			apiName: DOCUMENT_FRAME_REMOVED_UNSUBSCRIBE_API,
			level: MqqLevel.C_LOCAL_EDIT
		}
	];
	SANDBOX_DOCS_MQQ_API_PERMISSIONS = [{
		apiName: DOCX_ON_SELECTION_CHANGE_API,
		level: MqqLevel.C_SANDBOX_SELECTION
	}, {
		apiName: DOCX_ON_SELECTION_SEND_API,
		level: MqqLevel.C_SANDBOX_SELECTION
	}];
	MQQ_API_NOT_IMPLEMENTED_MESSAGE = "mqq API is not implemented";
	MQQ_PERMISSION_DENIED_MESSAGE = "当前页面无访问权限";
	MQQ_INTERNAL_ERROR_CODE = -32603;
	MqqSubscriberImpl = class {
		constructor(name, subscriberId, invokeBridge, eventHandlers) {
			this.name = name;
			this.subscriberId = subscriberId;
			this.invokeBridge = invokeBridge;
			this.eventHandlers = eventHandlers;
			this.callbackMap = /* @__PURE__ */ new Map();
			this.nextCallId = 0;
		}
		subscribe(callback) {
			if (this.callbackMap.size === 0) this.invokeBridge(buildMqqSubscriberSubscribeApi(this.name), [{ subscriberId: this.subscriberId }]);
			this.nextCallId += 1;
			this.callbackMap.set(this.nextCallId, callback);
			const handlers = this.eventHandlers.get(this.name) ?? [];
			handlers.push(callback);
			this.eventHandlers.set(this.name, handlers);
			return this.nextCallId;
		}
		unsubscribe(callId) {
			const callback = this.callbackMap.get(callId);
			if (!callback || !this.callbackMap.delete(callId)) return;
			const handlers = this.eventHandlers.get(this.name);
			if (handlers) {
				const index = handlers.indexOf(callback);
				if (index >= 0) handlers.splice(index, 1);
				if (handlers.length === 0) this.eventHandlers.delete(this.name);
			}
			if (this.callbackMap.size === 0) this.invokeBridge(buildMqqSubscriberUnsubscribeApi(this.name), [{ subscriberId: this.subscriberId }]);
		}
	};
}));
//#endregion
//#region src/tencent-docs/guest-log-contract.ts
/**
* 在文档 preload 边界过滤 main world 输入，避免超长内容或复杂对象进入
* electron-log 已有的 renderer IPC。这里只约束数据，不另建日志传输协议。
*/
function normalizeWorkbuddyGuestLogPayload(level, message, context) {
	if (typeof level !== "string" || !LOG_LEVELS.has(level)) return;
	if (typeof message !== "string" || !message.trim()) return;
	const normalizedContext = normalizeContext(context);
	return {
		level,
		message: message.slice(0, MAX_MESSAGE_LENGTH),
		...normalizedContext ? { context: normalizedContext } : {}
	};
}
function formatWorkbuddyGuestLog(payload) {
	return `[TencentDocsGuest] ${payload.message}${payload.context ? ` ${payload.context}` : ""}`;
}
function normalizeContext(context) {
	if (!context || typeof context !== "object" || Array.isArray(context)) return;
	const normalized = {};
	for (const [key, value] of Object.entries(context).slice(0, MAX_CONTEXT_FIELDS)) {
		const normalizedKey = key.slice(0, MAX_CONTEXT_KEY_LENGTH);
		if (!normalizedKey) continue;
		let normalizedValue;
		if (typeof value === "string") normalizedValue = value.slice(0, MAX_CONTEXT_STRING_LENGTH);
		else if (typeof value === "number" && Number.isFinite(value)) normalizedValue = value;
		else if (typeof value === "boolean") normalizedValue = value;
		else continue;
		const candidate = {
			...normalized,
			[normalizedKey]: normalizedValue
		};
		if (JSON.stringify(candidate).length > MAX_CONTEXT_LENGTH) break;
		normalized[normalizedKey] = normalizedValue;
	}
	const serialized = JSON.stringify(normalized);
	return serialized === "{}" ? void 0 : serialized;
}
var MAX_MESSAGE_LENGTH, MAX_CONTEXT_LENGTH, MAX_CONTEXT_FIELDS, MAX_CONTEXT_KEY_LENGTH, MAX_CONTEXT_STRING_LENGTH, LOG_LEVELS;
var init_guest_log_contract = __esmMin((() => {
	MAX_MESSAGE_LENGTH = 2048;
	MAX_CONTEXT_LENGTH = 1024;
	MAX_CONTEXT_FIELDS = 20;
	MAX_CONTEXT_KEY_LENGTH = 64;
	MAX_CONTEXT_STRING_LENGTH = 256;
	LOG_LEVELS = new Set([
		"info",
		"warn",
		"error"
	]);
}));
//#endregion
//#region src/tencent-docs/preload/install-guest-log-bridge.ts
async function installGuestLogBridge(pageUrl, ipcRenderer) {
	const isOnlineTencentDocsPage = isTencentDocsUrl(pageUrl);
	const isLocalDocument = isLocalTencentDocsEnginePreviewUrl(pageUrl);
	if (!isOnlineTencentDocsPage && !isLocalDocument) return;
	if (isLocalDocument && !await canAccessLocalDocumentFrame(ipcRenderer)) return;
	const rendererLogger = import_renderer$1.default.create({ logId: "renderer" });
	rendererLogger.transports.console.level = false;
	const guestLog = rendererLogger.scope("tencent-docs-guest");
	let windowStartedAt = Date.now();
	let emittedInWindow = 0;
	const emit = (level, message, context) => {
		const now = Date.now();
		if (now - windowStartedAt >= LOG_WINDOW_MS) {
			windowStartedAt = now;
			emittedInWindow = 0;
		}
		if (emittedInWindow >= MAX_LOGS_PER_WINDOW) return;
		const payload = normalizeWorkbuddyGuestLogPayload(level, message, context);
		if (payload) {
			emittedInWindow += 1;
			guestLog[level](formatWorkbuddyGuestLog(payload));
		}
	};
	electron.contextBridge.exposeInMainWorld("__workbuddyRenderLog", {
		info: (message, context) => emit("info", message, context),
		warn: (message, context) => emit("warn", message, context),
		error: (message, context) => emit("error", message, context)
	});
}
async function canAccessLocalDocumentFrame(ipcRenderer) {
	try {
		const response = await ipcRenderer.invoke(WORKBUDDY_MQQ_BRIDGE_CHANNEL, {
			id: 0,
			apiName: WORKBUDDY_MQQ_ACCESS_PROBE_API,
			args: []
		});
		return response.errCode === 0 && response.hasHandled === true;
	} catch {
		return false;
	}
}
var import_renderer$1, MAX_LOGS_PER_WINDOW, LOG_WINDOW_MS;
var init_install_guest_log_bridge = __esmMin((() => {
	init_bridge();
	init_url_guards();
	import_renderer$1 = /* @__PURE__ */ __toESM(require_renderer());
	init_guest_log_contract();
	MAX_LOGS_PER_WINDOW = 60;
	LOG_WINDOW_MS = 6e4;
}));
//#endregion
//#region src/tencent-docs/preload/install-guest-telemetry-bridge.ts
/**
* 从预览 URL query 读取入口来源 `wb_source`（客户端 daemon 注入，见补充方案）。
* 作为埋点默认值兜底，调用方在 params 里显式传入时以调用方为准。勿映射成 mode/source。
*/
function readWbSourceFromUrl(pageUrl) {
	try {
		const value = new URL(pageUrl).searchParams.get("wb_source");
		return value && value.trim().length > 0 ? value : void 0;
	} catch {
		return;
	}
}
function installGuestTelemetryBridge(options) {
	const wbSourceFromUrl = readWbSourceFromUrl(options.pageUrl);
	try {
		electron.contextBridge.exposeInMainWorld("__workbuddyTelemetry", { report: (params) => {
			requestSeq += 1;
			options.ipcRenderer.invoke(WORKBUDDY_MQQ_BRIDGE_CHANNEL, {
				id: requestSeq,
				apiName: WORKBUDDY_REPORT_TELEMETRY_API,
				args: [{
					pageURL: options.pageUrl,
					...wbSourceFromUrl ? { wb_source: wbSourceFromUrl } : {},
					...params
				}],
				documentResourceUri: options.documentResourceUri,
				filePath: options.filePath
			}).catch((error) => {
				console.warn("[GuestTelemetry] report failed (non-fatal):", error);
			});
		} });
	} catch (error) {
		console.warn("[GuestTelemetry] expose __workbuddyTelemetry failed (non-fatal):", error);
	}
}
var requestSeq;
var init_install_guest_telemetry_bridge = __esmMin((() => {
	init_bridge();
	init_guest_telemetry();
	requestSeq = 0;
}));
//#endregion
//#region src/tencent-docs/preload/install-sandbox-mqq-bridge.ts
/**
* 在云沙箱候选页面上安装 selection-only mqq。
*
* 返回值用于日志与测试；调用方不需要据此做任何分支。
*/
function installSandboxMqqBridge(deps) {
	if (!isCloudSandboxEditorSdkCandidateUrl(deps.pageUrl)) return "not-candidate";
	const authorization = probeAuthorization(deps);
	if (!authorization.allowed) return "denied";
	try {
		const featureList = getDocsFeatureList({
			inConversation: true,
			aiEditEnabled: authorization.aiEditEnabled
		});
		deps.exposeInMainWorld(DOCS_FEATURE_LIST_GLOBAL, featureList);
		deps.onFeatureListExposed?.(featureList);
		const mqq = createMqqProtocol({
			pageUrl: deps.pageUrl,
			apiPermissions: SANDBOX_DOCS_MQQ_API_PERMISSIONS,
			requireRegisteredApiPermission: true,
			invokeHandler: (request) => deps.ipcRenderer.invoke(WORKBUDDY_MQQ_BRIDGE_CHANNEL, {
				id: request.id,
				apiName: request.apiName,
				args: request.args
			})
		});
		deps.exposeInMainWorld("mqq", mqq);
		return "installed";
	} catch (error) {
		deps.onError?.("[TencentDocsSandboxMqq] bridge setup failed", error);
		return "denied";
	}
}
function probeAuthorization(deps) {
	try {
		const raw = deps.ipcRenderer.sendSync(SANDBOX_AUTHORIZATION_PROBE_CHANNEL);
		if (!raw || typeof raw !== "object") return SANDBOX_AUTHORIZATION_DENIED;
		const result = raw;
		if (result.allowed !== true) return SANDBOX_AUTHORIZATION_DENIED;
		return {
			allowed: true,
			aiEditEnabled: result.aiEditEnabled === true
		};
	} catch (error) {
		deps.onError?.("[TencentDocsSandboxMqq] authorization probe failed", error);
		return SANDBOX_AUTHORIZATION_DENIED;
	}
}
var init_install_sandbox_mqq_bridge = __esmMin((() => {
	init_feature_list();
	init_bridge();
	init_protocol();
	init_url_guards();
	init_sandbox_preview_contract();
}));
//#endregion
//#region src/tencent-docs/preload/install-sandbox-oopif-diagnostics.ts
/**
* 云沙箱 EditorSDK 候选页面判定（**仅用于 spike**）。
*
* 刻意放宽到「https + EditorSDK 页面路径」：spike 的目的是先看清真实 URL 长什么样，
* 判严了反而会把想观察的 frame 过滤掉。
*
* P2 会用 `parseCloudSandboxEditorSdkCandidateUrl` 替换它做真正的候选收窄，
* 而候选判定在任何阶段都**不是授权依据**——授权只认 main 内存 registry。
*/
function isSandboxEditorSdkSpikeCandidateUrl(url) {
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== "https:") return false;
		return /^\/static\/(doc|sheet|slide)\/pc\.html$/.test(parsed.pathname);
	} catch {
		return false;
	}
}
/**
* 发送一次诊断探针。返回是否真的发出，供测试与日志使用。
*
* 三重收敛，任何一条不满足都完全静默：spike 开关未开、URL 非候选、IPC 抛错。
*/
function installSandboxOopifDiagnostics(options) {
	if ((options.env ?? process.env)["WORKBUDDY_TDOC_SANDBOX_SPIKE"] !== "1") return false;
	if (!isSandboxEditorSdkSpikeCandidateUrl(options.pageUrl)) return false;
	let parsed;
	try {
		parsed = new URL(options.pageUrl);
	} catch {
		return false;
	}
	const payload = {
		origin: parsed.origin,
		pathname: parsed.pathname,
		isMainFrame: options.isMainFrame,
		hasChatMarker: parsed.searchParams.get("_wbchat") === "1",
		hasLocalFilePath: parsed.searchParams.has("localFilePath"),
		documentReadyState: options.documentReadyState ?? (typeof document !== "undefined" ? document.readyState : "unknown"),
		preloadTimeMs: options.nowMs ?? (typeof performance !== "undefined" ? performance.now() : 0)
	};
	try {
		options.ipcRenderer.sendSync(SANDBOX_OOPIF_DIAGNOSTICS_CHANNEL, payload);
		return true;
	} catch {
		return false;
	}
}
var init_install_sandbox_oopif_diagnostics = __esmMin((() => {
	init_sandbox_preview_contract();
}));
function getHostMessageTargetOrigin() {
	const ancestorOrigin = window.location.ancestorOrigins?.[0];
	if (typeof ancestorOrigin === "string" && ancestorOrigin.trim()) return ancestorOrigin;
	try {
		if (document.referrer) return new URL(document.referrer).origin;
	} catch {}
	return "*";
}
/**
* 宿主 Ctrl+= / Ctrl+- / Ctrl+0 → 腾讯文档 SDK zoom 桥接。
*
* ## 完整链路
*
*   用户按 Ctrl+=
*     ↓
*   main 端 `before-input-event` 拦截
*   (apps/workbuddy-desktop/src/main/platform/menu-builder.ts:
*    setupZoomShortcutInterception)
*     ↓ 焦点在 iframe → event.preventDefault() 阻止 Chromium 默认 page zoom
*     ↓ 通过 webFrameMain.send 向所有 frame 派 IPC 'workbuddy:zoom-shortcut'
*   本 preload (跨 origin OOPIF) 收到 IPC
*     ↓ webFrame.executeJavaScript 调用 main world 的 __workbuddyZoomDispatch
*   main world helper 在 SDK 同一个 JS context 内 dispatch 合成 KeyboardEvent
*     ↓
*   SDK keymap listener
*   (doc: @melo/surface KeymapManager.onKeyEvent;
*    sheet: @tencent/tsheet-lib/Keyboard.onKeyDown)
*   收到 → scaleService.scaleBy → 编辑器 zoom + 状态栏百分数同步变化
*
* ## 为什么这么绕？
*
* 1. **跨 origin OOPIF**：腾讯文档 iframe 跟宿主不同 origin，Chromium 把它
*    放到独立 process。`webContents.send` 默认只送主 frame，所以 main 端要
*    用 `webFrameMain.send` 遍历所有 subframe。
*
* 2. **contextIsolation isolated world**：preload 跑在 isolated world，SDK
*    跑在 main world。两 world 共享 DOM，但 JS 对象（包括 event listener）
*    完全隔离。preload 里 `dispatchEvent` 触发的 listener 仅限 isolated
*    world；preload 里 `defineProperty(window,…)` 也不影响 main world 的
*    window。所以**必须用 `webFrame.executeJavaScript` 把代码注入 main
*    world 执行**，才能让 SDK 的 listener 收到、并让 outerWidth shim 生效。
*
* 3. **SDK detectZoom 守卫**：doc / sheet 的 zoom handler 都有
*    `detectZoom() !== 100` 早期返回（本意防止跟浏览器 page zoom 叠加）。
*    `detectZoom()` 用 `window.outerWidth / window.innerWidth` 算浏览器
*    zoom 比例。在 WorkBuddy + cross-origin OOPIF 下，outerWidth 是整个
*    BrowserWindow 宽，innerWidth 是 iframe viewport 宽，比例远大于 100%
*    → SDK 误以为浏览器在缩放、拒绝执行。修复：注入 shim 让 outerWidth =
*    innerWidth，detectZoom 永远返回 100。
*
* 4. **`new KeyboardEvent({keyCode})` 在 Chromium keyCode 永远是 0**
*    （构造参数被忽略）。但 SDK 老代码常用 `e.keyCode === 187` 判 `=`。
*    修复：合成事件创建后用 `Object.defineProperty` 强行覆盖 getter。
*/
function installHostZoomShortcutBridge() {
	preloadLog.info("[TencentDocsMqqPreload] installing host zoom shortcut bridge", {
		...summarizeFrameUrl(pageUrl),
		isMainFrame
	});
	electron.webFrame.executeJavaScript(`
(function() {
    if (window.__workbuddyZoomInstalled) { return; }
    window.__workbuddyZoomInstalled = true;
    try {
        Object.defineProperty(window, 'outerWidth', { configurable: true, get: function() { return window.innerWidth; } });
        Object.defineProperty(window, 'outerHeight', { configurable: true, get: function() { return window.innerHeight; } });
    } catch (e) {
        console.warn('[workbuddy-mainworld] outerWidth shim failed', e);
    }
    var isMac = /Mac|iPhone|iPad/i.test(navigator.platform);
    function deepActive() {
        var el = document.activeElement;
        while (el && el.shadowRoot && el.shadowRoot.activeElement) {
            el = el.shadowRoot.activeElement;
        }
        return el || document.body || document.documentElement;
    }
    function buildKey(desc) {
        var e = new KeyboardEvent('keydown', {
            key: desc.key, code: desc.code,
            ctrlKey: desc.ctrl, metaKey: desc.meta,
            bubbles: true, cancelable: true, composed: true,
        });
        try {
            Object.defineProperty(e, 'keyCode', { configurable: true, get: function() { return desc.keyCode; } });
            Object.defineProperty(e, 'which', { configurable: true, get: function() { return desc.keyCode; } });
            Object.defineProperty(e, 'charCode', { configurable: true, get: function() { return 0; } });
        } catch (err) {}
        return e;
    }
    window.__workbuddyZoomDispatch = function(direction) {
        var desc;
        if (direction === 'in') { desc = { key: '=', code: 'Equal', keyCode: 187, ctrl: !isMac, meta: isMac }; }
        else if (direction === 'out') { desc = { key: '-', code: 'Minus', keyCode: 189, ctrl: !isMac, meta: isMac }; }
        else if (direction === 'reset') { desc = { key: '0', code: 'Digit0', keyCode: 48, ctrl: !isMac, meta: isMac }; }
        else { return; }
        // 同时 dispatch 到 deep activeElement / body / document，覆盖 SDK 在
        // 不同层级注册 listener 的情况（doc 挂在 .surface，sheet 挂在 body）。
        var target = deepActive();
        try { target.dispatchEvent(buildKey(desc)); } catch (e) {}
        if (target !== document.body && document.body) {
            try { document.body.dispatchEvent(buildKey(desc)); } catch (e) {}
        }
        try { document.dispatchEvent(buildKey(desc)); } catch (e) {}
    };
})();
`).catch((err) => {
		preloadLog.warn("[TencentDocsMqqPreload] inject main-world helper failed", err);
	});
	electron.ipcRenderer.on("workbuddy:zoom-shortcut", (_event, payload) => {
		const direction = payload?.direction;
		if (direction !== "in" && direction !== "out" && direction !== "reset") return;
		const code = `window.__workbuddyZoomDispatch && window.__workbuddyZoomDispatch(${JSON.stringify(direction)});`;
		electron.webFrame.executeJavaScript(code).catch((err) => {
			preloadLog.warn("[TencentDocsMqqPreload] dispatch via main world failed", err);
		});
	});
}
/**
* 通过 `webFrame.executeJavaScript` 向 main world 注入 `window.__WB_DOCS_FEATURE_LIST__`。
* 本地文档 OOPIF 在 BrowserWindow 内共享 preload，isolated world 无法直接赋值 main world，
* 需借助 webFrame.executeJavaScript 桥接。
*/
/**
* 注入 `__WB_DOCS_FEATURE_LIST__`。
* - 本地文档 iframe：URL 携带 `_wbchat=1` → { aiEdit: true }，否则 { aiEdit: false }
* - 在线文档 webview：默认 { aiEdit: false }，由 IPC 动态更新
*/
function injectDocsFeatureList() {
	const code = `window.__WB_DOCS_FEATURE_LIST__ = ${getDocsFeatureListString({ inConversation: hasChatMarker(pageUrl) })};`;
	electron.webFrame.executeJavaScript(code).catch(() => {
		preloadLog.warn("[TencentDocsMqqPreload] inject feature list failed");
	});
}
/** 检测 URL 是否携带对话场景标记 `_wbchat=1`。 */
function hasChatMarker(url) {
	try {
		return new URL(url).searchParams.get("_wbchat") === "1";
	} catch {
		return false;
	}
}
function readLocalFilePath(url) {
	try {
		return new URL(url).searchParams.get("localFilePath") ?? void 0;
	} catch {
		return;
	}
}
function toFileResourceUri(filePath) {
	const normalized = filePath.replace(/\\/g, "/");
	return `file://${(normalized.startsWith("/") ? normalized : `/${normalized}`).split("/").map(encodeFileUriSegment).join("/")}`;
}
/**
* 单个路径段编码，结果与 Node `pathToFileURL` 的 WHATWG path 百分号编码集完全一致。
*
* 以 `encodeURIComponent` 为基线（中文/空格/控制符/`%` 等已正确），再补齐与
* `pathToFileURL` 的差集：
*   - `~` 需额外编码为 `%7E`（encodeURIComponent 会保留）；
*   - `$ & + , : ; = @` 需还原为原字符（pathToFileURL 在 path 中保留它们）。
* 这些 `%XX` 仅可能由 encodeURIComponent 对上述单字节字符产生，不会误伤 UTF-8
* 多字节序列（如 `%E4%B8%AD`）或 `%`→`%25`。
*/
function encodeFileUriSegment(segment) {
	return encodeURIComponent(segment).replace(/~/g, "%7E").replace(/%24/g, "$").replace(/%26/g, "&").replace(/%2B/g, "+").replace(/%2C/g, ",").replace(/%3A/g, ":").replace(/%3B/g, ";").replace(/%3D/g, "=").replace(/%40/g, "@");
}
function summarizeFrameUrl(url) {
	try {
		const parsed = new URL(url);
		return {
			protocol: parsed.protocol,
			host: parsed.host,
			pathname: parsed.pathname,
			hasLocalFilePath: Boolean(parsed.searchParams.get("localFilePath"))
		};
	} catch {
		return { parseError: true };
	}
}
function installSaveShortcutInterceptor() {
	if (!documentResourceUri) return;
	window.addEventListener("keydown", (event) => {
		if (!isSaveShortcutEvent(event)) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		preloadLog.info("[TencentDocsMqqPreload] save shortcut captured", {
			documentResourceUri,
			key: event.key,
			metaKey: event.metaKey,
			ctrlKey: event.ctrlKey
		});
		window.parent.postMessage({
			type: WORKBUDDY_TENCENT_DOCS_SAVE_SHORTCUT_MESSAGE,
			documentResourceUri,
			reason: "keyboard-shortcut"
		}, getHostMessageTargetOrigin());
	}, true);
}
function isSaveShortcutEvent(event) {
	if (event.defaultPrevented) return false;
	if (event.key.toLowerCase() !== "s") return false;
	if (event.altKey || event.shiftKey) return false;
	return event.metaKey || event.ctrlKey;
}
function installTencentDocsInternalTabDirtyGuard(mqq) {
	if (!documentResourceUri) return;
	const originalExecEventCallback = mqq.execEventCallback.bind(mqq);
	mqq.execEventCallback = async (eventName, ...args) => {
		preloadLog.info("[TencentDocsMqqPreload] execEventCallback", {
			documentResourceUri,
			eventName,
			argCount: args.length,
			payloadType: args.length > 0 ? args[0] === null ? "null" : typeof args[0] : "none"
		});
		return originalExecEventCallback(eventName, ...args);
	};
	const confirmDirtyBeforeFrameSwitch = async (payload) => {
		const targetFileId = readTargetFileIdFromPayload(payload);
		preloadLog.info("[TencentDocsMqqPreload] documentFrameWillAppear dirty guard", {
			documentResourceUri,
			payloadType: payload === null ? "null" : typeof payload,
			targetFileId: targetFileId ?? ""
		});
		try {
			return await electron.ipcRenderer.invoke(WORKBUDDY_MQQ_DIRTY_GUARD_CHANNEL, {
				documentResourceUri,
				targetFileId,
				reason: "document-frame-will-appear"
			}) === true;
		} catch (error) {
			preloadLog.warn("[TencentDocsMqqPreload] documentFrameWillAppear dirty guard failed", {
				documentResourceUri,
				error: error instanceof Error ? error.message : String(error)
			});
			return false;
		}
	};
	mqq.createSubscribe(DOCUMENT_FRAME_WILL_APPEAR_EVENT).subscribe((payload) => confirmDirtyBeforeFrameSwitch(payload));
	const extraGuardEvents = [
		DOCUMENT_FRAME_WILL_DISAPPEAR_EVENT,
		DOCUMENT_FRAME_WILL_CLOSE_EVENT,
		DOCUMENT_FRAME_CLOSE_EVENT,
		DOCUMENT_FRAME_WILL_REMOVE_EVENT,
		DOCUMENT_FRAME_REMOVED_EVENT
	];
	for (const eventName of extraGuardEvents) mqq.createSubscribe(eventName).subscribe((payload) => {
		preloadLog.info("[TencentDocsMqqPreload] extra document frame dirty guard", {
			documentResourceUri,
			eventName,
			payloadType: payload === null ? "null" : typeof payload
		});
		return confirmDirtyBeforeFrameSwitch(payload);
	});
	installCloseButtonClickGuard(confirmDirtyBeforeFrameSwitch);
}
function readTargetFileIdFromPayload(payload) {
	if (!payload || typeof payload !== "object") return;
	const candidate = payload;
	for (const key of [
		"fileId",
		"file_id",
		"targetFileId",
		"target_file_id",
		"closingFileId"
	]) {
		const value = candidate[key];
		if (typeof value === "string" && value.trim()) return value.trim();
	}
}
function installCloseButtonClickGuard(confirmDirtyBeforeFrameSwitch) {
	const CLOSE_KEYWORDS = [
		"close",
		"关闭",
		"remove",
		"delete"
	];
	const onClickCapture = (event) => {
		const target = event.target instanceof Element ? event.target : null;
		if (!target) return;
		const actionElement = target.closest("button,[role=\"button\"],a,span,div");
		if (!actionElement) return;
		if (confirmedDirtyCloseTargets.has(actionElement)) {
			confirmedDirtyCloseTargets.delete(actionElement);
			return;
		}
		const actionText = [
			actionElement.getAttribute("aria-label") ?? "",
			actionElement.getAttribute("title") ?? "",
			actionElement.className || "",
			actionElement.textContent ?? ""
		].join(" ").toLowerCase();
		if (!CLOSE_KEYWORDS.some((keyword) => actionText.includes(keyword))) return;
		const targetFileId = extractTargetFileIdFromElement(actionElement);
		preloadLog.info("[TencentDocsMqqPreload] close-like click captured", {
			documentResourceUri,
			targetFileId: targetFileId ?? "",
			actionText: actionText.slice(0, 120)
		});
		if (!targetFileId) return;
		event.preventDefault();
		event.stopPropagation();
		event.stopImmediatePropagation();
		confirmDirtyBeforeFrameSwitch({ targetFileId }).then((allowed) => {
			if (allowed) {
				confirmedDirtyCloseTargets.add(actionElement);
				actionElement.dispatchEvent(new MouseEvent("click", {
					bubbles: true,
					cancelable: true,
					view: window
				}));
			}
		}).catch(() => void 0);
	};
	window.addEventListener("click", onClickCapture, true);
}
/**
* SDK 通过 `mqq.invoke('docx', 'onDocumentStatusChanged', payload)` 主动推送文档编辑状态。
* preload 截获后通过 `window.parent.postMessage` 直接通知 renderer，替代 renderer 侧 2s 轮询。
*/
function interceptDocumentStatusChanged(payload) {
	if (!documentResourceUri) return;
	if (!isDocumentStatusChangedPayload(payload)) {
		preloadLog.warn("[TencentDocsMqqPreload] onDocumentStatusChanged invalid payload", {
			documentResourceUri,
			payloadType: payload === null ? "null" : typeof payload
		});
		return;
	}
	preloadLog.info("[TencentDocsMqqPreload] onDocumentStatusChanged", {
		documentResourceUri,
		fileId: payload.fileId,
		hasUnSavedChange: payload.hasUnSavedChange
	});
	window.parent.postMessage({
		type: WORKBUDDY_DOCUMENT_STATUS_CHANGED_MESSAGE,
		documentResourceUri,
		hasUnSavedChange: payload.hasUnSavedChange
	}, getHostMessageTargetOrigin());
}
function isDocumentStatusChangedPayload(value) {
	if (!value || typeof value !== "object") return false;
	const payload = value;
	return typeof payload.fileId === "string" && typeof payload.hasUnSavedChange === "boolean";
}
function extractTargetFileIdFromElement(element) {
	let cursor = element;
	while (cursor) {
		for (const { name, value } of Array.from(cursor.attributes)) {
			if (!value) continue;
			const attrName = name.toLowerCase();
			if (attrName.includes("fileid") || attrName.includes("file-id") || attrName.includes("docid") || attrName.includes("data-id")) {
				const normalized = value.trim();
				if (normalized) return normalized;
			}
		}
		const dataset = cursor.dataset || {};
		for (const key of Object.keys(dataset)) {
			const lowered = key.toLowerCase();
			if (lowered.includes("fileid") || lowered.includes("docid") || lowered === "id") {
				const value = dataset[key];
				if (typeof value === "string" && value.trim()) return value.trim();
			}
		}
		cursor = cursor.parentElement;
	}
}
var import_renderer, preloadLog, isMainFrame, pageUrl, localFilePath, documentResourceUri, WORKBUDDY_TENCENT_DOCS_SAVE_SHORTCUT_MESSAGE, WORKBUDDY_DOCUMENT_STATUS_CHANGED_MESSAGE, confirmedDirtyCloseTargets;
var init_mqq_subframe_preload = __esmMin((() => {
	init_feature_list();
	init_bridge();
	init_protocol();
	import_renderer = /* @__PURE__ */ __toESM(require_renderer());
	init_install_guest_log_bridge();
	init_install_guest_telemetry_bridge();
	init_install_sandbox_mqq_bridge();
	init_install_sandbox_oopif_diagnostics();
	init_frame_context();
	preloadLog = import_renderer.default.scope("mqq-subframe-preload");
	isMainFrame = getIsMainFramePreload();
	pageUrl = window.location.href;
	localFilePath = readLocalFilePath(pageUrl);
	documentResourceUri = localFilePath ? toFileResourceUri(localFilePath) : void 0;
	WORKBUDDY_TENCENT_DOCS_SAVE_SHORTCUT_MESSAGE = "workbuddy:tencent-docs-save-shortcut";
	WORKBUDDY_DOCUMENT_STATUS_CHANGED_MESSAGE = "workbuddy:document-status-changed";
	confirmedDirtyCloseTargets = /* @__PURE__ */ new WeakSet();
	installSandboxOopifDiagnostics({
		pageUrl,
		isMainFrame,
		ipcRenderer: electron.ipcRenderer
	});
	if (shouldExposeMqqProtocol(pageUrl)) {
		installHostZoomShortcutBridge();
		injectDocsFeatureList();
		try {
			preloadLog.info("[TencentDocsMqqPreload] exposing mqq protocol", {
				...summarizeFrameUrl(pageUrl),
				isMainFrame,
				hasDocumentResourceUri: Boolean(documentResourceUri)
			});
			const mqq = createMqqProtocol({
				pageUrl,
				apiPermissions: TENCENT_DOCS_MQQ_API_PERMISSIONS,
				requireRegisteredApiPermission: true,
				invokeHandler: (request) => {
					preloadLog.info("[TencentDocsMqqPreload] forwarding mqq request", {
						apiName: request.apiName,
						argCount: request.args.length,
						hasDocumentResourceUri: Boolean(documentResourceUri)
					});
					if (request.apiName === "docx.onDocumentStatusChanged") interceptDocumentStatusChanged(request.args[0]);
					return electron.ipcRenderer.invoke(WORKBUDDY_MQQ_BRIDGE_CHANNEL, {
						...request,
						documentResourceUri,
						filePath: localFilePath
					});
				}
			});
			installTencentDocsInternalTabDirtyGuard(mqq);
			installSaveShortcutInterceptor();
			electron.contextBridge.exposeInMainWorld("mqq", mqq);
			installGuestTelemetryBridge({
				pageUrl,
				documentResourceUri,
				filePath: localFilePath,
				ipcRenderer: electron.ipcRenderer
			});
			installGuestLogBridge(pageUrl, electron.ipcRenderer).catch((error) => {
				preloadLog.warn("[TencentDocsMqqPreload] guest log bridge setup failed", error);
			});
		} catch (mqqSetupError) {
			preloadLog.warn("[TencentDocsMqqPreload] mqq setup failed", mqqSetupError);
		}
	} else {
		const outcome = installSandboxMqqBridge({
			pageUrl,
			ipcRenderer: electron.ipcRenderer,
			exposeInMainWorld: (key, value) => {
				electron.contextBridge.exposeInMainWorld(key, value);
			},
			onError: (message, error) => {
				preloadLog.warn(message, error);
			},
			onFeatureListExposed: (featureList) => {
				preloadLog.info("[TencentDocsSandboxMqq] feature list exposed", {
					...summarizeFrameUrl(pageUrl),
					isMainFrame,
					featureList
				});
			},
			onApiDenied: (apiName) => {
				preloadLog.warn("[TencentDocsSandboxMqq] mqq request denied in preload", {
					apiName,
					...summarizeFrameUrl(pageUrl),
					isMainFrame
				});
			}
		});
		if (outcome !== "not-candidate") preloadLog.info("[TencentDocsSandboxMqq] sandbox bridge outcome", {
			...summarizeFrameUrl(pageUrl),
			isMainFrame,
			outcome
		});
	}
}));
//#endregion
//#region src/preload/index.ts
init_frame_context();
if (getIsMainFramePreload()) {
	init_local_file_drag();
	init_bootstrap();
} else init_mqq_subframe_preload();
//#endregion
