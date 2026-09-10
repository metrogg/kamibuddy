const require_chunk = require("./chunk.js");
const require_tencent_docs_prompt_selection = require("./tencent-docs-prompt-selection.js");
const require_wb_source = require("./wb-source.js");
let node_fs = require("node:fs");
node_fs = require_chunk.__toESM(node_fs);
let node_path = require("node:path");
node_path = require_chunk.__toESM(node_path);
let _tencent_tencent_docs_ai_engine = require("@tencent/tencent-docs-ai-engine");
//#region ../../packages/workbuddy-server/src/docs/preview/local-file-open-check-open.ts
/** 将冲突预检结果映射为 localDocs.checkOpen RPC 返回值（不含 UI 副作用）。 */
function mapConflictToCheckOpenResult(conflict, requestSessionId) {
	if (conflict.kind === "owned-by-other" && conflict.sessionId) {
		const title = conflict.filePath.split(/[\\/]/).pop() || conflict.filePath;
		return {
			success: true,
			status: "owned-by-other",
			filePath: conflict.filePath,
			sessionId: conflict.sessionId,
			...conflict.sessionTitle ? { sessionTitle: conflict.sessionTitle } : {},
			message: `Document is already active in another task: ${title}`,
			shouldBlockOpen: require_tencent_docs_prompt_selection.shouldBlockLocalDocumentOpenAttempt(conflict, requestSessionId)
		};
	}
	if (conflict.kind === "owned-by-self") return {
		success: true,
		status: "owned-by-self",
		filePath: conflict.filePath,
		...conflict.sessionId ? { sessionId: conflict.sessionId } : {},
		shouldBlockOpen: require_tencent_docs_prompt_selection.shouldBlockLocalDocumentOpenAttempt(conflict, requestSessionId)
	};
	return {
		success: true,
		status: "none",
		filePath: conflict.filePath
	};
}
//#endregion
//#region ../../packages/workbuddy-server/src/docs/local-docs-facade.ts
/**
* local-docs-facade.ts · 本地文档预览领域的 host 无关 Facade 工厂。
*
* 承接原 desktop 主进程 `registerLocalDocsDomain` 的本地文档预览业务方法
* （checkOpen / getPreviewUrl / release* / save 等），以及原 `rpc/docs.ts` 的
* `requestSaveDocumentPreviewContext` 显式保存流程。
*
* 本地预览的状态单例（TencentDocsDocumentService）由 daemon 持有；原生保存/
* 冲突对话框通过注入的 `platform` 能力回到 desktop main。组合根注入
* `documentService` + `platform` 后，把返回的 facade 挂到 daemon `localDocs:*`
* handler。
*
* 不属于本工厂：
*   - `registerMediaArtifact`：依赖 app-server 的 MediaArtifactService，由 renderer 走 daemon 路由。
*   - `getFrameOptions`：返回函数，renderer-local。
*/
var TAG = "[LocalDocsFacade]";
function isSupportedExtension(filePath) {
	return (0, _tencent_tencent_docs_ai_engine.isTencentDocsEngineSupportedExtension)(filePath);
}
/** 在 URL 上追加对话场景标记 `_wbchat=1`。失败时静默降级返回原 URL。 */
function appendChatMarker(url) {
	try {
		const u = new URL(url);
		u.searchParams.set("_wbchat", "1");
		return u.toString();
	} catch {
		return url;
	}
}
/**
* 创建本地文档预览领域 Facade（host 无关）。
*
* @param deps.documentService daemon 本地预览状态单例。
* @param deps.platform 提供原生保存/文件选择对话框的宿主平台能力。
* @param deps.logger 可选日志（默认 no-op）。
*/
function createLocalDocsHostFacade(deps) {
	const { documentService, platform } = deps;
	const log = deps.logger ?? {
		info: () => {},
		warn: () => {}
	};
	async function requestSaveContext(documentResourceUri) {
		const previewContext = documentService.getEmbeddedPreviewContextInfo(documentResourceUri);
		if (!previewContext) return {
			success: false,
			error: "Document preview context not found"
		};
		const resolvedDocumentResourceUri = previewContext.documentResourceUri;
		const originalWriteAccess = await require_tencent_docs_prompt_selection.getLocalDocumentWriteAccess(previewContext.filePath);
		if (!originalWriteAccess.writable) log.info(`${TAG} saveContext original not writable; save-as only`, {
			documentResourceUri: resolvedDocumentResourceUri,
			filePath: previewContext.filePath,
			reason: originalWriteAccess.reason,
			error: originalWriteAccess.error
		});
		const saveChoices = require_tencent_docs_prompt_selection.buildLocalDocumentSaveChoices({
			isDarwin: platform.osPlatform === "darwin",
			canSaveOriginal: originalWriteAccess.writable,
			labels: {
				saveButton: require_tencent_docs_prompt_selection.formatLocalPreviewText("saveButton"),
				saveAsButton: require_tencent_docs_prompt_selection.formatLocalPreviewText("saveAsButton"),
				cancelButton: require_tencent_docs_prompt_selection.formatLocalPreviewText("cancelButton")
			}
		});
		const dialogButtonIds = require_tencent_docs_prompt_selection.getLocalDocumentDialogButtonIds({
			choices: saveChoices,
			defaultAction: originalWriteAccess.writable ? "save" : "saveAs",
			cancelAction: "cancel"
		});
		const fileName = node_path.basename(previewContext.filePath);
		const choiceAction = saveChoices[(await platform.showMessageBox({
			type: "info",
			title: require_tencent_docs_prompt_selection.formatLocalPreviewText("saveDialogTitle"),
			message: require_tencent_docs_prompt_selection.formatLocalPreviewText("saveDialogMessage", { name: fileName }),
			detail: require_tencent_docs_prompt_selection.formatLocalPreviewText(originalWriteAccess.writable ? "saveDialogDetail" : "readOnlySaveDialogDetail"),
			buttons: saveChoices.map((item) => item.label),
			defaultId: dialogButtonIds.defaultId,
			cancelId: dialogButtonIds.cancelId,
			noLink: true
		})).response]?.action ?? "cancel";
		if (choiceAction === "cancel") return {
			success: false,
			canceled: true,
			message: require_tencent_docs_prompt_selection.formatLocalPreviewText("saveCanceledMessage")
		};
		if (choiceAction === "saveAs") {
			const targetFilePath = await require_tencent_docs_prompt_selection.requestLocalDocumentSaveAsPath({
				sourceFilePath: previewContext.filePath,
				title: require_tencent_docs_prompt_selection.formatLocalPreviewText("chooseSaveAsFileTitle"),
				dialogProvider: platform
			});
			if (!targetFilePath) return {
				success: false,
				canceled: true,
				action: "saveAs",
				message: require_tencent_docs_prompt_selection.formatLocalPreviewText("saveAsCanceledMessage")
			};
			log.info(`${TAG} saveContext save as`, {
				documentResourceUri: resolvedDocumentResourceUri,
				filePath: previewContext.filePath,
				targetFilePath
			});
			return {
				...await documentService.saveEmbeddedPreviewContext(resolvedDocumentResourceUri, { targetFilePath }),
				action: "saveAs",
				targetFilePath
			};
		}
		log.info(`${TAG} saveContext save original`, {
			documentResourceUri: resolvedDocumentResourceUri,
			filePath: previewContext.filePath
		});
		return {
			...await documentService.saveEmbeddedPreviewContext(resolvedDocumentResourceUri),
			action: "save"
		};
	}
	/**
	* release 的主语义仍是 documentResourceUri。
	* renderer 打开 preflight 只有 filePath 时，在 facade 边界复用已登记 context 做一次解析。
	*/
	function resolvePreviewResourceUri(input) {
		return documentService.getEmbeddedPreviewContextInfo(input)?.documentResourceUri ?? input;
	}
	return {
		async checkOpen(filePath, options) {
			if (!filePath || typeof filePath !== "string") return {
				success: false,
				status: "none",
				error: "filePath is required"
			};
			const normalized = require_tencent_docs_prompt_selection.normalizeLocalDocumentFilePath(filePath);
			log.info(`${TAG} checkOpen normalize`, {
				platform: process.platform,
				input: filePath,
				normalized,
				sessionId: options?.sessionId,
				source: options?.source
			});
			if (!isSupportedExtension(normalized)) return {
				success: true,
				status: "none"
			};
			const openSource = options?.source === "system-open" || options?.source === "session-open" ? options.source : void 0;
			const conflict = documentService.checkLocalFileOpenConflict(normalized, {
				...options?.sessionId ? { requestSessionId: options.sessionId } : {},
				...openSource ? { openSource } : {}
			});
			if (conflict.kind === "owned-by-other" || conflict.kind === "owned-by-self") return mapConflictToCheckOpenResult(conflict, options?.sessionId);
			return {
				success: true,
				status: "none"
			};
		},
		async filterAiServiceFilePaths(filePaths) {
			if (!Array.isArray(filePaths)) return [];
			return require_tencent_docs_prompt_selection.filterTencentDocsAiServiceFilePaths(filePaths.filter((p) => typeof p === "string" && p.length > 0).map(require_tencent_docs_prompt_selection.normalizeLocalDocumentFilePath));
		},
		async getPreviewUrl(filePath, options) {
			if (!filePath || typeof filePath !== "string") return {
				success: false,
				error: "filePath is required"
			};
			const normalized = require_tencent_docs_prompt_selection.normalizeLocalDocumentFilePath(filePath);
			log.info(`${TAG} getPreviewUrl normalize`, {
				platform: process.platform,
				input: filePath,
				normalized
			});
			if (!isSupportedExtension(normalized)) return {
				success: false,
				error: `Unsupported file type: ${normalized}`
			};
			try {
				await node_fs.promises.access(normalized, node_fs.constants.R_OK);
			} catch {
				log.warn?.(`${TAG} getPreviewUrl file not accessible`, { normalized });
				return {
					success: false,
					error: "file_not_found"
				};
			}
			const sessionId = typeof options?.sessionId === "string" ? options.sessionId : void 0;
			const result = await documentService.createEmbeddedPreview(normalized, { sessionId });
			const aiEditEnabled = deps.isTencentDocsAiEditEnabled ? deps.isTencentDocsAiEditEnabled() : true;
			if (sessionId && result.url && aiEditEnabled) result.url = appendChatMarker(result.url);
			if (result.url) result.url = require_wb_source.appendWbSource(result.url, options?.wbSource ?? "local");
			return result;
		},
		async releaseContext(documentResourceUri, options) {
			if (!documentResourceUri || typeof documentResourceUri !== "string") return {
				success: false,
				error: "documentResourceUri is required"
			};
			const source = options?.source === "open-eviction" ? "open-eviction" : "embedded-release";
			return documentService.releaseEmbeddedPreviewContext(resolvePreviewResourceUri(documentResourceUri), { closeSource: source });
		},
		async saveContext(documentResourceUri) {
			if (!documentResourceUri || typeof documentResourceUri !== "string") return {
				success: false,
				error: "documentResourceUri is required"
			};
			return requestSaveContext(documentResourceUri);
		},
		async getDirty(documentResourceUri) {
			if (!documentResourceUri || typeof documentResourceUri !== "string") return { isDirty: false };
			return documentService.getEmbeddedPreviewDirty(documentResourceUri);
		},
		async releaseContextIfClean(documentResourceUri, options) {
			if (!documentResourceUri || typeof documentResourceUri !== "string") return {
				released: false,
				reason: "failed",
				code: "invalid-document-resource-uri",
				error: "documentResourceUri is required"
			};
			return documentService.releaseEmbeddedPreviewContextIfClean(resolvePreviewResourceUri(documentResourceUri), { waitForReady: options?.waitForReady === true });
		},
		async activateContext(documentResourceUri, sessionId) {
			if (!documentResourceUri || typeof documentResourceUri !== "string") return {
				success: false,
				error: "documentResourceUri is required"
			};
			if (!documentService.activateEmbeddedPreviewContext(documentResourceUri, typeof sessionId === "string" ? sessionId : void 0)) return {
				success: false,
				error: "Document preview context not found"
			};
			return { success: true };
		},
		async setForegroundSession(sessionId) {
			documentService.setForegroundSession(typeof sessionId === "string" ? sessionId : null);
			return { success: true };
		},
		async autoSaveContext(documentResourceUri) {
			if (!documentResourceUri || typeof documentResourceUri !== "string") return {
				saved: false,
				reason: "not-found"
			};
			return documentService.autoSaveEmbeddedPreviewContext(documentResourceUri);
		},
		async reconcileOrphanPreviews() {
			return documentService.reconcileOrphanLocalPreviews();
		}
	};
}
//#endregion
Object.defineProperty(exports, "createLocalDocsHostFacade", {
	enumerable: true,
	get: function() {
		return createLocalDocsHostFacade;
	}
});
