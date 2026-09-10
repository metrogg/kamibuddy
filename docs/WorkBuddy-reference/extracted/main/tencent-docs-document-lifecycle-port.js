require("./chunk.js");
let _tencent_tencent_docs_ai_engine = require("@tencent/tencent-docs-ai-engine");
//#region ../../packages/workbuddy-server/src/docs/mcp/tencent-docs-engine-provider.ts
function createTencentDocsEngineProvider(options) {
	const { documentService, logger } = options;
	let backgroundWarmup;
	const startBackgroundWarmup = () => {
		if (documentService.isEngineStarted() || backgroundWarmup) return;
		backgroundWarmup = documentService.canEnsureEngineStart().catch(() => false).then(async (localEngineAvailable) => {
			logger?.info?.("[TencentDocsEngine] resolveAgentEnv localEngineAvailable", {
				localEngineAvailable,
				engineStarted: documentService.isEngineStarted()
			});
			if (localEngineAvailable && !documentService.isEngineStarted()) await documentService.ensureEngineStarted("agent-spawn");
		}).catch((error) => {
			logger?.warn?.("[TencentDocsEngine] background engine warmup failed during session init", { error: error instanceof Error ? error.message : String(error) });
		}).finally(() => {
			backgroundWarmup = void 0;
		});
	};
	return { async resolveAgentEnv() {
		const engineStarted = documentService.isEngineStarted();
		const enginePort = documentService.getEnginePort();
		if (!engineStarted) {
			startBackgroundWarmup();
			return {};
		}
		const env = { ...(0, _tencent_tencent_docs_ai_engine.buildTencentDocsLocalMcpEnv)(enginePort) };
		if (enginePort) env.editor_sdk_port = String(enginePort);
		logger?.info?.("[TencentDocsEngine] resolveAgentEnv result", {
			engineStarted,
			enginePort,
			envCount: Object.keys(env).length
		});
		return env;
	} };
}
//#endregion
//#region ../../packages/workbuddy-server/src/session/tencent-docs-document-lifecycle-port.ts
function resolveStoredSessionTitle(database, sessionId) {
	const row = database.getSession(sessionId);
	const customTitle = row?.customTitle?.trim();
	if (customTitle) return customTitle;
	return row?.title?.trim() || void 0;
}
//#endregion
Object.defineProperty(exports, "createTencentDocsEngineProvider", {
	enumerable: true,
	get: function() {
		return createTencentDocsEngineProvider;
	}
});
Object.defineProperty(exports, "resolveStoredSessionTitle", {
	enumerable: true,
	get: function() {
		return resolveStoredSessionTitle;
	}
});
