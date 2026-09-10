require("./chunk.js");
const require_tencent_docs_prompt_selection = require("./tencent-docs-prompt-selection.js");
const require_wb_source = require("./wb-source.js");
require("./docs.js");
const require_document_lifecycle_port = require("./document-lifecycle-port.js");
const require_tencent_docs_document_lifecycle_port = require("./tencent-docs-document-lifecycle-port.js");
let electron = require("electron");
//#region src/main/tencent-docs/tencent-docs-main-integration.ts
function registerTencentDocsMainIntegration(options) {
	const { windowManager, pushRendererEvent, logger } = options;
	const documentService = require_tencent_docs_prompt_selection.getTencentDocsDocumentService();
	documentService.setMainWindowFocusHandler(() => {
		windowManager.showOrCreate();
	});
	documentService.setDialogProvider({
		async showMessageBox(dialogOptions) {
			windowManager.showOrCreate();
			const owner = windowManager.getMainWindow() ?? void 0;
			return owner && !owner.isDestroyed() ? electron.dialog.showMessageBox(owner, dialogOptions) : electron.dialog.showMessageBox(dialogOptions);
		},
		async showOpenDialog(dialogOptions) {
			windowManager.showOrCreate();
			const owner = windowManager.getMainWindow() ?? void 0;
			const electronDialogOptions = {
				...dialogOptions,
				properties: [...dialogOptions.properties]
			};
			return owner && !owner.isDestroyed() ? electron.dialog.showOpenDialog(owner, electronDialogOptions) : electron.dialog.showOpenDialog(electronDialogOptions);
		},
		async showSaveDialog(dialogOptions) {
			windowManager.showOrCreate();
			const owner = windowManager.getMainWindow() ?? void 0;
			return owner && !owner.isDestroyed() ? electron.dialog.showSaveDialog(owner, dialogOptions) : electron.dialog.showSaveDialog(dialogOptions);
		}
	});
	documentService.setEngineReadyHandler(() => {
		pushRendererEvent(require_wb_source.TENCENT_DOCS_RENDERER_PUSH_CHANNELS.ENGINE_READY, {});
	});
	documentService.setPreviewReloadHandler((payload) => {
		pushRendererEvent(require_wb_source.TENCENT_DOCS_RENDERER_PUSH_CHANNELS.RELOAD_EMBEDDED_PREVIEW, payload);
	});
	return {
		documentService,
		createEngineProvider() {
			return require_tencent_docs_document_lifecycle_port.createTencentDocsEngineProvider({
				documentService,
				logger
			});
		},
		wireSessionConflictLookups({ sessionManager, database }) {
			const isSessionStillProcessing = require_document_lifecycle_port.createIsSessionStillProcessing(sessionManager);
			documentService.setSessionConflictLookups({
				isSessionStillProcessing,
				getSessionTitle: (sessionId) => require_tencent_docs_document_lifecycle_port.resolveStoredSessionTitle(database, sessionId)
			});
		}
	};
}
//#endregion
exports.registerTencentDocsMainIntegration = registerTencentDocsMainIntegration;
