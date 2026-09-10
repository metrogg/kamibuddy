require("./chunk.js");
const require_tencent_docs_prompt_selection = require("./tencent-docs-prompt-selection.js");
const require_wb_source = require("./wb-source.js");
require("./docs.js");
const require_contract = require("./contract3.js");
//#region src/main/tencent-docs/selection-broadcast.ts
/**
* 腾讯文档选区变化 → renderer 广播。
*
* mqq 选区上报在 daemon 侧（本地 TencentDocsDocumentService / 远端选区 store），
* ChatInput 顶部 chip 与 aiPrompt 注入在 renderer 侧订阅 `docs:selectionChanged`。
*
* ## 两种 daemon 装配共用本模块
*
* WorkBuddy 有两条装配路径：eval/main 内嵌 daemon 走
* `schedule-post-daemon-tasks`，fork-daemon 走 `daemon-app-server-main`。
* 两边都必须订阅同一组 producer，否则某一种运行模式下选区会整体失灵。历史上就
* 出现过只改一条路径的情况，所以这里只留一个实现，两边都调它。
*
* ## 只订阅两个 producer
*
* - 本地文件 → `TencentDocsDocumentService`
* - 在线 + 云沙箱 → `RemoteDocumentSelectionStore`（在线 store 只是它的门面）
*
* 刻意**不**再单独订阅在线 store：它与 remote 是同一个实例，重复订阅会让每条
* 在线选区推送两遍。
*/
/**
* 订阅 daemon 侧文档选区变化，推送到 renderer。
*
* @returns dispose 回调，取消全部订阅。
*/
function registerTencentDocsSelectionBroadcast(options) {
	const { push, logger } = options;
	const pushSelection = (source, notification) => {
		const channel = notification.sendAction ? require_contract.DOCS_RPC_EX_CHANNELS.SELECTION_SEND : require_contract.DOCS_RPC_EX_CHANNELS.SELECTION_CHANGED;
		logger?.info("[TencentDocsSelection] pushing selection to renderer", {
			source,
			channel,
			documentResourceUri: notification.documentResourceUri,
			sessionId: notification.sessionId,
			filePath: notification.filePath,
			fileType: notification.fileType,
			hasSelection: Boolean(notification.selection),
			rangeId: notification.selection?.rangeId,
			hasAiPrompt: typeof notification.selection?.aiPrompt === "string" && notification.selection.aiPrompt.trim().length > 0,
			sequence: notification.sequence,
			sequenceEpoch: notification.sequenceEpoch,
			sendAction: notification.sendAction
		});
		push(channel, notification);
	};
	const disposeLocal = require_tencent_docs_prompt_selection.getTencentDocsDocumentService().onSelectionChange((notification) => {
		pushSelection("local", notification);
	});
	const disposeRemote = require_wb_source.getRemoteDocumentSelectionStore().onSelectionChange((notification) => {
		pushSelection("remote", notification);
	});
	return () => {
		disposeLocal();
		disposeRemote();
	};
}
//#endregion
exports.registerTencentDocsSelectionBroadcast = registerTencentDocsSelectionBroadcast;
