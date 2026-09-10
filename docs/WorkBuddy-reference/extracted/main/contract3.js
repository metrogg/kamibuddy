//#region ../../packages/workbuddy-server/src/tencent-docs/contract.ts
/**
* 腾讯文档 RPC 频道与数据类型。
*
* 两组频道按操作划分：
* - docs:*           本地文档预览与选区（无鉴权，进程间通信）
* - tencentDocs:*    云端资料库 CRUD 与鉴权（需 OAuth）
*/
var DOCS_RPC_EX_CHANNELS = {
	GET_PREVIEW_URL: "docs:getPreviewUrl",
	RELEASE_PREVIEW_CONTEXT: "docs:releasePreviewContext",
	RELEASE_PREVIEW_CONTEXT_IF_CLEAN: "docs:releasePreviewContextIfClean",
	SAVE_PREVIEW_CONTEXT: "docs:savePreviewContext",
	PREVIEW_DOCUMENT_FROM_CONTENT: "docs:previewDocumentFromContent",
	SELECTION_CHANGED: "docs:selectionChanged",
	SELECTION_SEND: "docs:selectionSend"
};
//#endregion
Object.defineProperty(exports, "DOCS_RPC_EX_CHANNELS", {
	enumerable: true,
	get: function() {
		return DOCS_RPC_EX_CHANNELS;
	}
});
