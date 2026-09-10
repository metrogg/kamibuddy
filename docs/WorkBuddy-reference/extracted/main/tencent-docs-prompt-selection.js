const require_chunk = require("./chunk.js");
const require_logger = require("./logger.js");
const require_normalize_path$1 = require("./normalize-path.js");
let fs = require("fs");
let path = require("path");
path = require_chunk.__toESM(path);
let node_child_process = require("node:child_process");
let node_fs = require("node:fs");
node_fs = require_chunk.__toESM(node_fs);
let node_path = require("node:path");
node_path = require_chunk.__toESM(node_path);
let node_fs_promises = require("node:fs/promises");
let node_os = require("node:os");
node_os = require_chunk.__toESM(node_os);
let node_crypto = require("node:crypto");
let node_util = require("node:util");
let _tencent_tencent_docs_ai_engine = require("@tencent/tencent-docs-ai-engine");
let node_url = require("node:url");
let node_module = require("node:module");
let node_net = require("node:net");
node_net = require_chunk.__toESM(node_net);
//#region ../../packages/workbuddy-server/src/docs/document-edit-context.ts
var DocumentEditContext = class {
	constructor(ttlMs = 300 * 1e3) {
		this.activeContext = null;
		this.ttlMs = ttlMs;
	}
	/**
	* 更新当前活动选区
	*
	* 覆盖式更新：同一文档后来的选区会覆盖前一个，不做多选区管理。
	*/
	setActiveSelection(documentResourceUri, filePath, fileType, selection) {
		this.activeContext = {
			documentResourceUri,
			filePath,
			fileType,
			selection,
			updatedAt: Date.now()
		};
	}
	/**
	* 更新当前打开的文档但清空选区
	*
	* 用于用户切换 tab / 取消选中的场景。
	*/
	clearSelection(documentResourceUri, filePath, fileType) {
		this.activeContext = {
			documentResourceUri,
			filePath,
			fileType,
			selection: null,
			updatedAt: Date.now()
		};
	}
	/**
	* 在 SDK editor pool 注册后，把真实 file_id 回填到当前文档上下文。
	*
	* 调用前提：已经存在 `activeContext`（一般在 `clearSelection` 或选区上报时建立）。
	* 没有 active context 时为 no-op：不主动 fabricate 一个仅有 fileId 的空上下文，
	* 避免污染 `getActiveContext()` 的返回值（消费方依赖 `documentResourceUri`/`filePath`）。
	*/
	setFileId(fileId) {
		if (!this.activeContext) return;
		this.activeContext = {
			...this.activeContext,
			fileId,
			updatedAt: Date.now()
		};
	}
	/**
	* 获取当前活动上下文
	*
	* 若已过期则自动清理并返回 null。
	*/
	getActiveContext() {
		if (!this.activeContext) return null;
		if (Date.now() - this.activeContext.updatedAt > this.ttlMs) {
			this.activeContext = null;
			return null;
		}
		return this.activeContext;
	}
	/** 清除全部上下文 */
	clear() {
		this.activeContext = null;
	}
};
//#endregion
//#region ../../packages/workbuddy-server/src/docs-shared/document-edit-types.ts
/**
* 文档选区类型。
*
* 透明转发：text/rangeId 是 WorkBuddy 自己也要用的通用字段（节流签名 + LLM 内容理解），
* 其余字段由前端按 docs-engine MCP 工具 inputSchema 自由扩展，原样透传。
*/
function detectDocumentFileType(filePath) {
	return (0, _tencent_tencent_docs_ai_engine.getTencentDocsSelectionFileType)(filePath) ?? null;
}
//#endregion
//#region ../../packages/workbuddy-server/src/docs-shared/logger.ts
/**
* docs-shared 中立层日志适配。
*
* docs-shared 是本地(docs)/在线(tencent-docs)/桌面宿主共用的叶子层，不允许反向依赖
* tencent-docs 业务模块。这里直接复用平台无关的 createWorkbuddyScopedLogger（真实
* electron-log 由宿主通过 configureWorkbuddyLogger 注入），保持调用点 `windowLog.info(...)`
* 用法不变。
*/
var windowLog = require_logger.createWorkbuddyScopedLogger("window");
var mainLog = require_logger.createWorkbuddyScopedLogger("main");
//#endregion
//#region ../../packages/workbuddy-server/src/docs-shared/online-document-types.ts
var TENCENT_ONLINE_FILE_PATH_PREFIX = "tdoc://";
function isTencentOnlineFilePath(filePath) {
	return typeof filePath === "string" && filePath.startsWith("tdoc://");
}
/** 从 `tdoc://<file_id>` 取出 fileId；非在线 filePath 或空串返回 undefined。 */
function extractTencentOnlineFileId(filePath) {
	if (!isTencentOnlineFilePath(filePath)) return;
	const fileId = filePath.slice(7);
	return fileId.length > 0 ? fileId : void 0;
}
//#endregion
//#region ../../packages/workbuddy-server/src/docs-shared/selection-sequence.ts
var sequenceEpoch = (0, node_crypto.randomUUID)();
var current = 0;
/** 当前 daemon 进程内，所有文档选区通知的唯一 wire 序号源。 */
function allocateDocumentSelectionSequence() {
	current += 1;
	return {
		sequence: current,
		sequenceEpoch
	};
}
//#endregion
//#region ../../packages/workbuddy-server/src/docs/context/tencent-docs-context-helpers.ts
/**
* Preview URL 的 `globalPadId`（本地路径 md5），用于 SDK 识别同一份本地文档。
* 它不是 MCP editor pool 的 `file_id`；误注入 prompt 会导致模型对未打开 editor 调工具。
*/
function computeLocalPreviewGlobalPadId(filePath) {
	const normalized = filePath.trim();
	if (!normalized) return;
	return (0, node_crypto.createHash)("md5").update(normalized).digest("hex");
}
function isLocalPreviewGlobalPadId(filePath, candidateFileId) {
	const normalizedId = candidateFileId.trim();
	if (!normalizedId) return false;
	const globalPadId = computeLocalPreviewGlobalPadId(filePath);
	return Boolean(globalPadId && globalPadId === normalizedId);
}
/** UI 侧选区文本截断（再长用户也读不下，避免 IPC 体积膨胀）。 */
function truncateForBroadcast(text) {
	if (text.length <= maxSelectionTextLengthForBroadcast) return text;
	return text.slice(0, maxSelectionTextLengthForBroadcast) + "…";
}
/**
* 将「来源不可信 / 可能未归一」的本地路径转为文档资源 URI。
*
* 只有上下文索引/选区/active 文档使用 resource URI；SDK、fs、watcher、MCP 仍使用真实 filePath。
*
* 本地路径先做 canonical 化（解析 symlink + 磁盘真实大小写），保证同一物理文件只对应一个
* resourceUri 主键——即使调用方传入的是 symlink 或大小写不一致的路径。在线文档（已带 `://`）
* 原样返回，不触碰文件系统。
*
* 注意：canonical 化是一次同步磁盘 syscall（realpath）。若调用方手里已经是
* `normalizeLocalDocumentFilePath` 的输出（已 canonical），应改用
* {@link fileResourceUriFromCanonicalPath} 跳过重复 syscall，避免主线程上的双重 IO。
*/
function toDocumentResourceUri(filePath) {
	const trimmed = filePath.trim();
	if (!trimmed || trimmed.includes("://")) return trimmed;
	return fileResourceUriFromCanonicalPath(toCanonicalRealPath(trimmed));
}
/**
* 由「已 canonical 化的本地真实路径」直接生成文档资源 URI——不再触碰文件系统。
*
* 入参契约：必须是 `normalizeLocalDocumentFilePath` 的输出（symlink 已解析、已是磁盘真实大小写）。
* 之所以单独拆出，是因为这些调用点都在主进程热路径上（每个 tool_call / 每轮 prompt / 每次冲突预检），
* 重复 realpath 会在慢盘/网络盘上同步阻塞主进程。在线文档（已带 `://`）原样返回。
*/
function fileResourceUriFromCanonicalPath(canonicalAbsolutePath) {
	const trimmed = canonicalAbsolutePath.trim();
	if (!trimmed || trimmed.includes("://")) return trimmed;
	return (0, node_url.pathToFileURL)(trimmed).toString();
}
/**
* 解析 symlink 并归一为磁盘上的真实大小写（case-insensitive FS）。委托 OS realpath 以获得
* 每个平台正确的语义（macOS/Windows 折叠大小写、Linux 不折叠）；文件不存在时退回原路径。
*
* Windows 兼容：`realpathSync.native`（GetFinalPathNameByHandle）可能返回扩展长度前缀
* `\\?\C:\...` / `\\?\UNC\server\share\...`，这里统一剥除归一为常规形式。否则同一物理文件会因
* 「存在→带前缀」与「不存在→退回原路径无前缀」生成两个 resourceUri 主键，破坏去重；非 Windows
* 上 realpath 不会带该前缀，剥除恒为 no-op。
*/
function toCanonicalRealPath(absolutePath) {
	try {
		return stripWindowsExtendedLengthPrefix(node_fs.realpathSync.native(absolutePath));
	} catch {
		return absolutePath;
	}
}
var WIN_EXTENDED_LENGTH_PREFIX = "\\\\?\\";
var WIN_EXTENDED_LENGTH_UNC_PREFIX = "\\\\?\\UNC\\";
/** 剥除 Windows 扩展长度前缀，把 `\\?\C:\x` 还原为 `C:\x`、`\\?\UNC\srv\share` 还原为 `\\srv\share`。 */
function stripWindowsExtendedLengthPrefix(p) {
	if (p.startsWith(WIN_EXTENDED_LENGTH_UNC_PREFIX)) return "\\\\" + p.slice(8);
	if (p.startsWith(WIN_EXTENDED_LENGTH_PREFIX)) return p.slice(4);
	return p;
}
var maxSelectionTextLengthForBroadcast = 240;
//#endregion
//#region ../../packages/workbuddy-server/src/docs/context/tencent-docs-context-manager.ts
/**
* Tencent Docs 文档上下文管理器。
*
* Source of truth 只使用 `documentResourceUri`：本地为 `file://...`，在线为 `tdoc://...`。
* 真实 `filePath` 仅用于 SDK、fs、watcher 和 MCP 参数，不能作为上下文主键。
*/
var TencentDocsContextManager = class {
	constructor() {
		this.contextsByResourceUri = /* @__PURE__ */ new Map();
		this.activeResourceUriBySessionId = /* @__PURE__ */ new Map();
		this.activeResourceUri = null;
		this.selectionListeners = /* @__PURE__ */ new Set();
	}
	/** 订阅选区变化通知；返回值为取消订阅函数。 */
	onSelectionChange(listener) {
		this.selectionListeners.add(listener);
		return () => {
			this.selectionListeners.delete(listener);
		};
	}
	/** 释放 main 进程退出时仍保留的上下文和监听器。 */
	dispose() {
		for (const record of this.contextsByResourceUri.values()) record.editContext.clear();
		this.contextsByResourceUri.clear();
		this.activeResourceUriBySessionId.clear();
		this.activeResourceUri = null;
		this.selectionListeners.clear();
	}
	/**
	* 登记一个已经被业务入口打开的文档工作区。
	*
	* 同 session 重复登记同一 `documentResourceUri` 是幂等 no-op；不同 session 命中同一
	* resource 时一律返回 conflict（§2.4 严格隔离，owner 永不转移）。已结束 session 的 owner
	* 不在此改绑——由会话删除（evictSessionDocuments）或其预览关闭来释放后，新 session 方可全新打开。
	*/
	createFileContext(params) {
		const filePath = params.filePath.trim();
		const documentResourceUri = this.resolveDocumentResourceUri(params);
		if (!documentResourceUri) throw new Error("documentResourceUri is required to create an AI Docs file context");
		const existingRecord = this.contextsByResourceUri.get(documentResourceUri);
		const nextSessionId = params.sessionId?.trim();
		if (existingRecord) {
			if (nextSessionId && existingRecord.sessionId && existingRecord.sessionId !== nextSessionId) {
				const previousSessionId = existingRecord.sessionId;
				windowLog.warn("[TencentDocsContextManager] file context conflict", {
					documentResourceUri,
					filePath,
					existingSessionId: previousSessionId,
					nextSessionId
				});
				return {
					documentResourceUri,
					status: "conflict",
					existingSessionId: previousSessionId
				};
			}
			existingRecord.title = params.title ?? existingRecord.title;
			existingRecord.previewUrl = params.previewUrl ?? existingRecord.previewUrl;
			existingRecord.fileExt = params.fileExt ?? existingRecord.fileExt;
			if (nextSessionId && !existingRecord.sessionId) this.adoptSessionlessRecord(existingRecord, nextSessionId, "create-file-context");
			else existingRecord.sessionId = nextSessionId ?? existingRecord.sessionId;
			if (params.fileId) {
				existingRecord.fileId = params.fileId;
				existingRecord.editContext.setFileId(params.fileId);
			}
			this.activateFileContext(documentResourceUri);
			windowLog.info("[TencentDocsContextManager] file context already active", {
				documentResourceUri,
				filePath: existingRecord.filePath,
				sessionId: existingRecord.sessionId,
				trackedContextCount: this.contextsByResourceUri.size
			});
			return {
				documentResourceUri,
				status: "already-active",
				existingSessionId: existingRecord.sessionId
			};
		}
		const fileType = params.fileType ?? detectDocumentFileType(filePath || documentResourceUri);
		const editContext = new DocumentEditContext();
		editContext.clearSelection(documentResourceUri, filePath || documentResourceUri, fileType);
		if (params.fileId) editContext.setFileId(params.fileId);
		const record = {
			documentResourceUri,
			filePath: filePath || documentResourceUri,
			fileType,
			fileExt: params.fileExt,
			title: params.title,
			previewUrl: params.previewUrl,
			fileId: params.fileId,
			sessionId: nextSessionId,
			createdAt: Date.now(),
			editContext
		};
		this.contextsByResourceUri.set(documentResourceUri, record);
		if (nextSessionId) this.activeResourceUriBySessionId.set(nextSessionId, documentResourceUri);
		this.activeResourceUri = documentResourceUri;
		windowLog.info("[TencentDocsContextManager] file context created", {
			documentResourceUri,
			filePath: record.filePath,
			fileType,
			fileId: params.fileId,
			hasFileId: Boolean(params.fileId),
			sessionId: nextSessionId,
			trackedContextCount: this.contextsByResourceUri.size
		});
		return {
			documentResourceUri,
			status: "created"
		};
	}
	/** SDK editor pool 延迟注册后，按 resource URI 回填本地文档真实 file_id。 */
	updateFileContextFileId(documentResourceUri, fileId) {
		const record = this.contextsByResourceUri.get(documentResourceUri.trim());
		const nextFileId = fileId.trim();
		if (!record || !nextFileId) return false;
		record.fileId = nextFileId;
		record.editContext.setFileId(nextFileId);
		return true;
	}
	/** 将某个已登记文档标记为当前活动文档。 */
	activateFileContext(documentResourceUri) {
		const record = this.contextsByResourceUri.get(documentResourceUri.trim());
		if (!record) return false;
		const previousActiveResourceUri = record.sessionId ? this.activeResourceUriBySessionId.get(record.sessionId) : this.activeResourceUri;
		this.activeResourceUri = record.documentResourceUri;
		if (record.sessionId) this.activeResourceUriBySessionId.set(record.sessionId, record.documentResourceUri);
		if (previousActiveResourceUri && previousActiveResourceUri !== record.documentResourceUri) {
			const previousRecord = this.contextsByResourceUri.get(previousActiveResourceUri);
			const previousContext = previousRecord?.editContext.getActiveContext();
			if (previousRecord && previousContext?.selection) this.notifySelectionChange({
				sessionId: previousRecord.sessionId,
				documentResourceUri: previousRecord.documentResourceUri,
				filePath: previousRecord.filePath,
				fileType: previousRecord.fileType ?? void 0,
				selection: null
			});
		}
		return true;
	}
	/**
	* 会话删除时清理该 session 拥有的全部 file context（§2.4 owner 永不转移，删除即彻底回收）。
	* 返回被释放的 documentResourceUri 列表（信息性/测试用；上层注册表清理按 sessionId 走
	* `DocumentLeaseRegistry.evictSession`，不依赖此返回值）。
	*/
	releaseSessionContexts(sessionId) {
		const targetSessionId = sessionId.trim();
		if (!targetSessionId) return [];
		const owned = [];
		for (const [resourceUri, record] of this.contextsByResourceUri) if (record.sessionId === targetSessionId) owned.push(resourceUri);
		for (const resourceUri of owned) this.releaseFileContext(resourceUri);
		return owned;
	}
	/** 释放一个文档工作区。 */
	releaseFileContext(documentResourceUri) {
		const normalizedResourceUri = documentResourceUri.trim();
		const record = this.contextsByResourceUri.get(normalizedResourceUri);
		if (!record) return false;
		const isActiveForSession = record.sessionId ? this.activeResourceUriBySessionId.get(record.sessionId) === normalizedResourceUri : this.activeResourceUri === normalizedResourceUri;
		this.contextsByResourceUri.delete(normalizedResourceUri);
		if (record.sessionId && isActiveForSession) this.activeResourceUriBySessionId.delete(record.sessionId);
		record.editContext.clear();
		if (this.activeResourceUri === normalizedResourceUri) this.activeResourceUri = null;
		windowLog.info("[TencentDocsContextManager] file context released", {
			documentResourceUri: normalizedResourceUri,
			filePath: record.filePath,
			trackedContextCount: this.contextsByResourceUri.size
		});
		if (isActiveForSession) this.notifySelectionChange({
			sessionId: record.sessionId,
			documentResourceUri: normalizedResourceUri,
			filePath: record.filePath,
			fileType: record.fileType ?? void 0,
			selection: null
		});
		return true;
	}
	getFilePreviewContext(documentResourceUri) {
		const record = this.contextsByResourceUri.get(documentResourceUri.trim());
		return record ? toActiveFilePreviewContextInfo(record) : null;
	}
	getFilePreviewContextByFileId(fileId) {
		const targetFileId = fileId.trim();
		if (!targetFileId) return null;
		for (const record of this.contextsByResourceUri.values()) if (record.fileId === targetFileId) return toActiveFilePreviewContextInfo(record);
		return null;
	}
	getFilePreviewContexts(options = {}) {
		const targetSessionId = options.sessionId?.trim();
		return Array.from(this.contextsByResourceUri.values()).filter((record) => !targetSessionId || record.sessionId === targetSessionId).map(toActiveFilePreviewContextInfo);
	}
	/**
	* 更新某个文档工作区的选区上下文。
	*
	* 优先使用 `documentResourceUri` 精确定位；缺失时才根据 filePath 推导或使用当前 active
	* 兜底，避免旧 iframe/跨 session 事件污染当前输入区。
	*/
	reportDocumentSelection(params) {
		windowLog.info("[TencentDocsContextManager] document selection report received", {
			documentResourceUri: params.documentResourceUri,
			sessionId: params.sessionId,
			filePath: params.filePath,
			fileType: params.fileType,
			hasSelection: Boolean(params.selection),
			rangeId: params.selection?.rangeId,
			sendAction: params.sendAction
		});
		const record = this.resolveFileContext(params);
		if (!record) {
			windowLog.warn("[TencentDocsContextManager] document selection dropped: context not found", {
				documentResourceUri: params.documentResourceUri,
				sessionId: params.sessionId,
				filePath: params.filePath,
				fileType: params.fileType,
				hasSelection: Boolean(params.selection),
				sendAction: params.sendAction
			});
			return;
		}
		const reportedResourceUri = this.resolveSelectionResourceUri(params);
		if (reportedResourceUri) {
			const activeResourceUri = record.sessionId ? this.activeResourceUriBySessionId.get(record.sessionId) : this.activeResourceUri;
			if (activeResourceUri !== record.documentResourceUri) {
				windowLog.warn("[TencentDocsContextManager] document selection dropped: stale non-active resource", {
					documentResourceUri: record.documentResourceUri,
					reportedResourceUri,
					activeResourceUri,
					sessionId: record.sessionId,
					filePath: record.filePath,
					hasSelection: Boolean(params.selection),
					rangeId: params.selection?.rangeId,
					sendAction: params.sendAction
				});
				return;
			}
		}
		const documentResourceUri = record.documentResourceUri;
		const filePath = record.filePath;
		const fileType = params.fileType ?? record.fileType ?? detectDocumentFileType(filePath);
		if (!fileType) {
			windowLog.warn("[TencentDocsContextManager] document selection dropped: unknown file type", {
				sessionId: record.sessionId,
				documentResourceUri,
				filePath,
				reportedFileType: params.fileType,
				sendAction: params.sendAction
			});
			return;
		}
		if (params.sendAction) {
			if (!params.selection) {
				windowLog.info("[TencentDocsContextManager] selection send skipped: no selection", {
					sessionId: record.sessionId,
					documentResourceUri,
					filePath
				});
				return;
			}
			windowLog.info("[TencentDocsContextManager] document selection send triggered", {
				sessionId: record.sessionId,
				documentResourceUri,
				filePath,
				fileType,
				rangeId: params.selection.rangeId,
				textLength: params.selection.text.length
			});
			this.notifySelectionChange({
				sessionId: record.sessionId,
				documentResourceUri,
				filePath,
				fileType,
				selection: {
					...params.selection,
					rangeId: params.selection.rangeId,
					text: truncateForBroadcast(params.selection.text)
				},
				sendAction: true
			});
			return;
		}
		this.activeResourceUri = documentResourceUri;
		if (record.sessionId) this.activeResourceUriBySessionId.set(record.sessionId, documentResourceUri);
		if (!params.selection) {
			record.editContext.clearSelection(documentResourceUri, filePath, fileType);
			windowLog.info("[TencentDocsContextManager] document selection cleared", {
				sessionId: record.sessionId,
				documentResourceUri,
				filePath,
				fileType
			});
			this.notifySelectionChange({
				sessionId: record.sessionId,
				documentResourceUri,
				filePath,
				fileType,
				selection: null
			});
			return;
		}
		record.editContext.setActiveSelection(documentResourceUri, filePath, fileType, params.selection);
		const reportedFileId = typeof params.selection.fileId === "string" ? params.selection.fileId.trim() : "";
		const promotedFileId = resolveToolUsableFileIdFromSelection(record, reportedFileId);
		if (promotedFileId) {
			record.fileId = promotedFileId;
			record.editContext.setFileId(promotedFileId);
		}
		windowLog.info("[TencentDocsContextManager] document selection resolved", {
			sessionId: record.sessionId,
			documentResourceUri,
			filePath,
			fileType,
			rangeId: params.selection.rangeId,
			textLength: params.selection.text.length,
			hasFileId: typeof params.selection.fileId === "string",
			promotedToolFileId: promotedFileId,
			skippedPreviewGlobalPadId: Boolean(reportedFileId && !promotedFileId && isLocalPreviewGlobalPadId(record.filePath, reportedFileId))
		});
		this.notifySelectionChange({
			sessionId: record.sessionId,
			documentResourceUri,
			filePath,
			fileType,
			selection: {
				...params.selection,
				rangeId: params.selection.rangeId,
				text: truncateForBroadcast(params.selection.text)
			}
		});
	}
	/** 读取当前可用于 prompt 注入的活动文档上下文。 */
	getActiveDocumentContext(sessionId) {
		this.adoptActiveSessionlessContext(sessionId);
		const activeResourceUri = sessionId ? this.activeResourceUriBySessionId.get(sessionId) : this.activeResourceUri;
		if (activeResourceUri) {
			const record = this.contextsByResourceUri.get(activeResourceUri);
			const context = this.matchesSession(record, sessionId) ? record?.editContext.getActiveContext() ?? null : null;
			if (context) return context;
		}
		for (const record of Array.from(this.contextsByResourceUri.values()).reverse()) {
			if (!this.matchesSession(record, sessionId)) continue;
			const active = record.editContext.getActiveContext();
			if (active) return active;
		}
		return null;
	}
	/** 返回当前活跃文档的轻量元数据快照。 */
	getActiveFileContextInfo(sessionId) {
		this.adoptActiveSessionlessContext(sessionId);
		const activeResourceUri = sessionId ? this.activeResourceUriBySessionId.get(sessionId) : this.activeResourceUri;
		const activeRecord = activeResourceUri ? this.contextsByResourceUri.get(activeResourceUri) : void 0;
		const record = this.matchesSession(activeRecord, sessionId) ? activeRecord : Array.from(this.contextsByResourceUri.values()).reverse().find((candidate) => this.matchesSession(candidate, sessionId));
		if (!record) return null;
		return toActiveFileContextInfo(record);
	}
	/** 仅当前活跃文档是在线腾讯文档时返回快照。 */
	getActiveOnlineDocumentInfo(sessionId) {
		this.adoptActiveSessionlessContext(sessionId);
		const activeResourceUri = sessionId ? this.activeResourceUriBySessionId.get(sessionId) : this.activeResourceUri;
		const activeRecord = activeResourceUri ? this.contextsByResourceUri.get(activeResourceUri) : void 0;
		const candidate = this.matchesSession(activeRecord, sessionId) ? activeRecord : Array.from(this.contextsByResourceUri.values()).reverse().find((record) => this.matchesSession(record, sessionId) && isTencentOnlineFilePath(record.documentResourceUri));
		if (!candidate || !isTencentOnlineFilePath(candidate.documentResourceUri)) return null;
		const fileId = extractTencentOnlineFileId(candidate.documentResourceUri);
		if (!fileId) return null;
		return {
			documentResourceUri: candidate.documentResourceUri,
			fileId,
			title: candidate.title,
			fileType: candidate.fileType,
			fileExt: candidate.fileExt,
			url: candidate.previewUrl,
			sessionId: candidate.sessionId
		};
	}
	/** 按本地文档路径查找已经登记的 preview context。 */
	findActiveFilePreviewContextByPath(filePath) {
		const normalizedFilePath = filePath.trim();
		if (!normalizedFilePath) return null;
		const documentResourceUri = toDocumentResourceUri(normalizedFilePath);
		const record = this.contextsByResourceUri.get(documentResourceUri);
		return record ? toActiveFilePreviewContextInfo(record) : null;
	}
	resolveDocumentResourceUri(params) {
		const explicitUri = params.documentResourceUri?.trim();
		if (explicitUri) return explicitUri;
		return toDocumentResourceUri(params.filePath);
	}
	resolveSelectionResourceUri(params) {
		const explicitUri = params.documentResourceUri?.trim();
		if (explicitUri) return explicitUri;
		return toDocumentResourceUri(params.filePath);
	}
	/**
	* 把仍然“无主”的当前活动文档领养绑定到首个用真实 sessionId 来访问它的会话。
	*
	* 背景：本地文档预览经常在欢迎态（还没有会话）创建，`record.sessionId` 为空；
	* 等用户发出第一条消息建立会话后，renderer 才带着真实 sessionId 来读取活动文档
	* （prompt 注入）或上报选区。由于 `matchesSession` 对“真实 sessionId vs 空 record.sessionId”
	* 判定为不匹配，这条无主文档既进不了 prompt，也无法把选区 chip 推回正确的 ChatInput。
	*
	* 这里在会话首次按自己的 sessionId 访问活动文档时，把这条无主文档领养给该会话，
	* 之后选区上报、prompt 注入都能精确按 sessionId 命中。仅领养“当前活动且无主”的那一条，
	* 且该会话尚未拥有自己的活动文档，避免后台会话抢占其它会话的文档。
	*/
	adoptActiveSessionlessContext(sessionId) {
		const targetSessionId = sessionId?.trim();
		if (!targetSessionId) return;
		if (this.activeResourceUriBySessionId.has(targetSessionId)) return;
		const activeResourceUri = this.activeResourceUri;
		if (!activeResourceUri) return;
		const record = this.contextsByResourceUri.get(activeResourceUri);
		if (!record || record.sessionId) return;
		this.adoptSessionlessRecord(record, targetSessionId, "active-context-access");
	}
	matchesSession(record, sessionId) {
		if (!sessionId) return true;
		return record?.sessionId === sessionId;
	}
	resolveFileContext(params) {
		const targetResourceUri = this.resolveSelectionResourceUri(params);
		if (targetResourceUri) {
			const record = this.contextsByResourceUri.get(targetResourceUri);
			if (record && this.matchesSession(record, params.sessionId)) return record;
			if (record && params.sessionId && !record.sessionId) {
				this.adoptSessionlessRecord(record, params.sessionId, "selection-report");
				return record;
			}
		}
		if (params.sessionId) {
			const activeForSessionId = this.activeResourceUriBySessionId.get(params.sessionId);
			const activeForSession = activeForSessionId ? this.contextsByResourceUri.get(activeForSessionId) : void 0;
			if (activeForSession?.documentResourceUri === targetResourceUri) return activeForSession;
		}
		if (!targetResourceUri && this.activeResourceUri) {
			const active = this.contextsByResourceUri.get(this.activeResourceUri);
			if (this.matchesSession(active, params.sessionId)) return active ?? null;
		}
		return null;
	}
	adoptSessionlessRecord(record, sessionId, reason) {
		const targetSessionId = sessionId.trim();
		if (!targetSessionId || record.sessionId) return;
		record.sessionId = targetSessionId;
		this.activeResourceUriBySessionId.set(targetSessionId, record.documentResourceUri);
		windowLog.info("[TencentDocsContextManager] adopted session-less context", {
			documentResourceUri: record.documentResourceUri,
			filePath: record.filePath,
			sessionId: targetSessionId,
			reason
		});
		this.rebroadcastSelectionForSession(record, targetSessionId);
	}
	rebroadcastSelectionForSession(record, sessionId) {
		const activeSelection = record.editContext.getActiveContext()?.selection ?? null;
		if (activeSelection) this.notifySelectionChange({
			sessionId,
			documentResourceUri: record.documentResourceUri,
			filePath: record.filePath,
			fileType: record.fileType ?? void 0,
			selection: {
				...activeSelection,
				text: truncateForBroadcast(activeSelection.text)
			}
		});
	}
	/** 把选区变化推给所有监听器；listener 异常不影响其他订阅者。 */
	notifySelectionChange(notification) {
		if (this.selectionListeners.size === 0) {
			windowLog.warn("[TencentDocsContextManager] selection change skipped: no listeners", {
				documentResourceUri: notification.documentResourceUri,
				sessionId: notification.sessionId,
				filePath: notification.filePath,
				hasSelection: Boolean(notification.selection),
				rangeId: notification.selection?.rangeId
			});
			return;
		}
		const sequenceStamp = allocateDocumentSelectionSequence();
		const fullNotification = {
			...notification,
			...sequenceStamp
		};
		windowLog.info("[TencentDocsContextManager] notifying selection change listeners", {
			documentResourceUri: fullNotification.documentResourceUri,
			sessionId: fullNotification.sessionId,
			filePath: fullNotification.filePath,
			fileType: fullNotification.fileType,
			hasSelection: Boolean(fullNotification.selection),
			rangeId: fullNotification.selection?.rangeId,
			sequence: sequenceStamp.sequence,
			listenerCount: this.selectionListeners.size
		});
		for (const listener of Array.from(this.selectionListeners)) try {
			listener(fullNotification);
		} catch (error) {
			windowLog.warn("[TencentDocsContextManager] selection change listener threw", { error: error instanceof Error ? error.message : String(error) });
		}
	}
};
/**
* 选区 payload 里的 fileId 可能是 preview globalPadId（路径 md5），不能当作 MCP tool file_id。
* 在线文档仍允许；本地仅当不是 globalPadId 时才提升到 record.fileId。
*/
function resolveToolUsableFileIdFromSelection(record, reportedFileId) {
	if (!reportedFileId) return;
	if (isTencentOnlineFilePath(record.documentResourceUri)) return reportedFileId;
	if (isLocalPreviewGlobalPadId(record.filePath, reportedFileId)) return;
	return reportedFileId;
}
function toActiveFileContextInfo(record) {
	return {
		documentResourceUri: record.documentResourceUri,
		filePath: record.filePath,
		fileType: record.fileType,
		title: record.title,
		fileId: record.fileId,
		sessionId: record.sessionId
	};
}
function toActiveFilePreviewContextInfo(record) {
	return {
		...toActiveFileContextInfo(record),
		previewUrl: record.previewUrl,
		createdAt: record.createdAt
	};
}
var TENCENT_DOCS_AI_FILE_SUPPORT_WHITELIST = Object.freeze([
	{
		"kind": "doc",
		"extensions": [
			".doc",
			".docx",
			".dot",
			".dotx",
			".wps",
			".wpt",
			".docm",
			".dotm"
		]
	},
	{
		"kind": "sheet",
		"extensions": [
			".csv",
			".xls",
			".xlsx",
			".xlt",
			".xltx",
			".xlsm",
			".xltm"
		]
	},
	{
		"kind": "slide",
		"extensions": [
			".pptx",
			".ppt",
			".pps",
			".pot",
			".pptm",
			".ppsx",
			".ppsm",
			".potx",
			".potm"
		]
	}
].map(({ kind, extensions }) => Object.freeze({
	kind,
	extensions: Object.freeze([...extensions])
})));
var TENCENT_DOCS_AI_FILE_EXTENSION_WHITELIST = Object.freeze(TENCENT_DOCS_AI_FILE_SUPPORT_WHITELIST.flatMap(({ extensions }) => extensions));
var TENCENT_DOCS_AI_SERVICE_EXTENSIONS = new Set(TENCENT_DOCS_AI_FILE_EXTENSION_WHITELIST.map((ext) => ext.replace(/^\./, "").toLowerCase()));
function isAbsoluteLocalPath(filePath) {
	return filePath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(filePath);
}
/** 文件名或路径是否带有 ai-whitelist 内的扩展名（不要求绝对路径）。 */
function hasTencentDocsAiServiceExtension(fileNameOrPath) {
	const cleanPath = fileNameOrPath.split(/[?#]/, 1)[0] ?? fileNameOrPath;
	const dot = cleanPath.lastIndexOf(".");
	if (dot < 0 || dot === cleanPath.length - 1) return false;
	return TENCENT_DOCS_AI_SERVICE_EXTENSIONS.has(cleanPath.slice(dot + 1).toLowerCase());
}
/** 路径是否属于 ai-whitelist.json 定义的腾讯文档 AI 服务接管品类（主进程 / renderer 共用）。 */
function isTencentDocsAiServiceFilePath(filePath) {
	if (!filePath || !isAbsoluteLocalPath(filePath)) return false;
	return hasTencentDocsAiServiceExtension(filePath);
}
/** 批量过滤，保留白名单内路径（顺序不变）。 */
function filterTencentDocsAiServiceFilePaths(filePaths) {
	return filePaths.filter(isTencentDocsAiServiceFilePath);
}
//#endregion
//#region ../../packages/workbuddy-server/src/shared/normalize-local-file-path.ts
var import_normalize_path = /* @__PURE__ */ require_chunk.__toESM(require_normalize_path$1.require_normalize_path());
/**
* 主进程 / 单测可用的本地路径归一化（与 renderer `cleanFileUri` 行为对齐）。
* 不依赖 @genie/cb-chat-ui，避免 main bundle 拉入 React。
*/
function normalizeLocalFilePathInput(uri) {
	let cleaned = uri.trim().replace(/^["']|["']$/g, "");
	if (cleaned.startsWith("file://")) cleaned = cleaned.substring(7);
	try {
		cleaned = decodeURIComponent(cleaned);
	} catch {}
	cleaned = (0, import_normalize_path.default)(cleaned);
	if (/^\/[A-Za-z]:\//.test(cleaned)) cleaned = cleaned.substring(1);
	return cleaned;
}
//#endregion
//#region ../../packages/workbuddy-server/src/docs/engine/kill-stale-editor-sdk-core.ts
/**
* editor_sdk 残留孤儿清理的「纯逻辑核心」—— 不依赖 Electron / electron-log。
*
* 抽出本模块的动机：
*   产品启动兜底（`kill-stale-editor-sdk.ts`）和本地文档 e2e 的 teardown
*   （`tests/local-docs/helpers/lifecycle.ts`）需要用**完全一致**的方式清理残留
*   editor_sdk。但产品侧的 logger（`main/logger.ts`）顶层从 electron 导入 app，
*   一旦被纯 Node 进程（Playwright e2e / vitest）import 就会拉起 Electron 依赖而崩。
*
*   因此把「解析随包二进制路径 + pkill」的纯逻辑放在这里，只依赖 node 内置模块，
*   logger 通过参数注入（默认 no-op）。产品侧 wrapper 注入 `windowLog`，e2e 直接调用。
*   这样「如何杀残留 editor_sdk」收敛到唯一真源，上游改 `--port` 锚点时只改一处。
*/
var ENGINE_PACKAGE_NAME = "@tencent/tencent-docs-ai-engine";
var BINARY_NAME = process.platform === "win32" ? "editor_sdk.exe" : "editor_sdk";
/**
* 解析本机随包 editor_sdk 的候选绝对路径，与引擎 `resolveBinaryPath` 的 bin 布局保持一致：
* `<engine-pkg>/bin/<platform>-<arch>/<binary>`，并补 `app.asar` → `app.asar.unpacked` 重写。
*
* 关键：必须用 `createRequire(__filename).resolve` 在**运行期**定位引擎包目录，而不是 import 引擎里
* 基于 `__dirname` 的解析函数 —— 后者在 electron-vite 打包后会被内联进 `dist/main`，`__dirname` 变成
* 打包产物目录，解析出的 bin 路径不存在、返回空，导致清理静默失效。`createRequire` 命中真实
* node_modules / asar，无论是否被打包都拿到与 spawn 完全一致的路径；e2e 进程从 helpers 目录向上
* 解析也命中同一份仓库 node_modules，与被测 app 实际 spawn 的路径一致。
*
* 该 bin 布局是引擎包的稳定约定；若上游改动需同步本文件与单测。
*/
function resolveEditorSdkBinaryCandidates$1(logger = {}) {
	let packageDir;
	try {
		const requireFromHere = (0, node_module.createRequire)(__filename);
		packageDir = node_path.dirname(requireFromHere.resolve(`${ENGINE_PACKAGE_NAME}/package.json`));
	} catch (error) {
		logger.warn?.("[TencentDocsEngine] resolve editor_sdk package dir failed", { error: error instanceof Error ? error.message : String(error) });
		return [];
	}
	const bundled = node_path.join(packageDir, "bin", `${process.platform}-${process.arch}`, BINARY_NAME);
	const asarUnpacked = bundled.replace(/([\\/])app\.asar\1/, "$1app.asar.unpacked$1");
	return bundled === asarUnpacked ? [bundled] : [asarUnpacked, bundled];
}
/**
* `pkill -9 -f "<binaryPath> --port"` 杀残留 editor_sdk。
*
* 锚点 `--port`：ai-engine `buildEditorSdkSpawnArgs` 始终把 `--port` 作为首个 flag 传入 spawn，故该
* pattern 只命中真正被 spawn 的引擎进程，不误伤引用同路径的其它命令；`binaryPath` 带 app 安装目录前缀，
* 不误伤别的 app（含同机共存的另一个用了同名引擎包的项目）。仅类 Unix 生效，Windows 跳过（Node 无法
* 可靠 pkill，且端口占用语义不同）。pkill 不杀自身；无匹配时以 exit 1 退出（execFileSync 抛错），视作
* 「无残留」吞掉。
*
* 若上游改了 flag 名或顺序，此 pattern 会静默失效（exit 1 被 catch），届时需同步更新。
*/
function killStaleEditorSdkByPath(binaryPath, logger = {}) {
	if (process.platform === "win32") return;
	try {
		(0, node_child_process.execFileSync)("pkill", [
			"-9",
			"-f",
			`${binaryPath} --port`
		], { stdio: "ignore" });
		logger.info?.("[TencentDocsEngine] killed stale editor_sdk before start", { binaryPath });
	} catch {}
}
/**
* 清理本机随包 editor_sdk 的残留孤儿进程：解析候选路径后逐一 pkill。
*
* `resolveCandidates` 仅为单测注入留口；生产 / e2e 走默认的运行期解析。无候选（该平台未随包发布
* 二进制 / 解析失败）时直接跳过 —— 本就不会 spawn，自然没有孤儿。
*/
function killStaleEditorSdkProcesses$1(resolveCandidates = () => resolveEditorSdkBinaryCandidates$1(), logger = {}) {
	for (const binaryPath of resolveCandidates()) killStaleEditorSdkByPath(binaryPath, logger);
}
//#endregion
//#region ../../packages/workbuddy-server/src/docs/engine/kill-stale-editor-sdk.ts
/**
* 启动时清理上一实例残留的 editor_sdk 孤儿进程，根治「杀进程/强退后本地文档一直 loading」。
*
* editor_sdk 由 `@tencent/tencent-docs-ai-engine` 以 `detached: false` spawn，只在 app 正常退出链
* （`before-quit` → `mainBootstrap.stop()` → `documentService.dispose()`）里优雅 kill。两类退出会绕过这条链：
*   1. 用户「强制退出 / 杀进程」(SIGKILL) —— OS 直接终止主进程，`before-quit` 根本不触发；
*   2. 进程收到 SIGTERM/SIGINT/SIGHUP —— 本 app 的信号 handler 按设计直接 `process.exit()`（见
*      `main/index.ts` 信号 handler 注释，刻意不走 `app.quit()` 以免关机被「运行中任务」确认框卡住），
*      同样不触发 `before-quit` → 不 dispose。
* 两种路径都会让 editor_sdk 变成孤儿继续占着端口；重启后该端口被占 → 引擎 `findAvailablePort` 漂移到
* 别的端口 → 与 MCP / preview 期望端口错位 → 本地文档一直 loading。
*
* 本 app 为单实例（`app.requestSingleInstanceLock()`，见 `main/index.ts`），启动期同路径的 editor_sdk
* 必然是上次残留，spawn 新引擎前清掉即可；SIGKILL 不可捕获的那部分，正是靠这里在下次启动时兜底。
*
* 纯逻辑（路径解析 + pkill）放在 `kill-stale-editor-sdk-core.ts`（不依赖 Electron），本文件只是注入
* `windowLog` 的薄封装，供产品主进程使用；本地文档 e2e 复用同一份 core 逻辑，详见
* `tests/local-docs/helpers/lifecycle.ts`。
*/
/** @see resolveEditorSdkBinaryCandidates in kill-stale-editor-sdk-core（注入 windowLog）。 */
function resolveEditorSdkBinaryCandidates() {
	return resolveEditorSdkBinaryCandidates$1(windowLog);
}
/** @see killStaleEditorSdkProcesses in kill-stale-editor-sdk-core（注入 windowLog）。 */
function killStaleEditorSdkProcesses(resolveCandidates = resolveEditorSdkBinaryCandidates) {
	killStaleEditorSdkProcesses$1(resolveCandidates, windowLog);
}
//#endregion
//#region ../../packages/workbuddy-server/src/docs/runtime-paths.ts
/**
* 腾讯文档本地功能迁移到 workbuddy-server 后的配置目录解析。
*
* 桌面端旧实现位于 main/runtime/app-instance。这里保持同样的解析优先级：
* 优先 `WORKBUDDY_CONFIG_DIR`，否则 `~/<dataFolderName>`；桌面端启动时会把
* `WORKBUDDY_DATA_FOLDER_NAME` 写入环境变量（来源于 product.json#dataFolderName），
* 读不到时回退 `.workbuddy`。
*/
function getWorkbuddyConfigDir() {
	const explicit = process.env.WORKBUDDY_CONFIG_DIR?.trim();
	if (explicit) return explicit;
	const dataFolderName = process.env.WORKBUDDY_DATA_FOLDER_NAME?.trim() || ".workbuddy";
	return node_path.default.join(node_os.default.homedir(), dataFolderName);
}
/**
* `editor_sdk` 自己写 `editor_sdk.log` 的目录，spawn 时以 `--log_dir` 传给它。
*
* 不传的话 vendor 会把日志写在二进制旁边（安装目录下的 `app.asar.unpacked/...`），
* 工单收日志时既找不到也可能没写权限。放到 `logs/` 下和 main.log 同级，日志包直接带走。
*/
function getEditorSdkLogDir() {
	return node_path.default.join(getWorkbuddyConfigDir(), "logs", "editor_sdk");
}
//#endregion
//#region ../../packages/workbuddy-server/src/docs/engine/editor-sdk-diagnostics.ts
/**
* editor_sdk 启动失败时的现场采集。
*
* 工单里 `engine start failed: ... did not become ready within 60000ms` 只说明「父进程等超时了」，
* 无法区分三种处置完全不同的根因：二进制没随包发布 / 被 EDR 拦下；进程活着但从没 bind 端口；
* 端口被别的进程占住导致引擎漂移。这里在失败瞬间补一次只读现场并落进日志，工单侧不必再回捞
* 用户机器就能定位。
*
* 全程 best-effort：任何一步失败都只记进 `errors`，绝不让诊断本身抛错或显著拖长失败路径
* （单条外部命令 2s 超时，端口探测 1s，且四项并发）。
*/
var execFileAsync = (0, node_util.promisify)(node_child_process.execFile);
var EXTERNAL_COMMAND_TIMEOUT_MS = 2e3;
var PORT_PROBE_TIMEOUT_MS = 1e3;
/** 命令输出行数上限，防 netstat 全量输出灌进 main.log。 */
var MAX_REPORTED_LINES = 10;
var PROBE_HOST = "127.0.0.1";
async function collectEditorSdkStartDiagnostics(port) {
	const startedAt = Date.now();
	const errors = [];
	const [binary, livePids, portListeners, portProbe] = await Promise.all([
		resolveBinaryInfo(errors),
		listLiveEditorSdkPids(errors),
		listPortListeners(port, errors),
		probePort(port)
	]);
	return {
		...binary,
		livePids,
		portListeners,
		portProbe,
		...await resolveLogFileInfo(),
		durationMs: Date.now() - startedAt,
		...errors.length > 0 ? { errors } : {}
	};
}
async function resolveBinaryInfo(errors) {
	let candidates = [];
	try {
		candidates = resolveEditorSdkBinaryCandidates();
	} catch (error) {
		errors.push(`resolve binary: ${toErrorMessage$5(error)}`);
	}
	for (const candidate of candidates) try {
		return {
			binaryPath: candidate,
			binaryExists: true,
			binarySizeBytes: (await node_fs.promises.stat(candidate)).size
		};
	} catch {}
	return {
		binaryPath: candidates[0],
		binaryExists: false
	};
}
/**
* 日志文件不存在本身就是结论：说明 editor_sdk 连 `--log_dir` 都没走到，
* 多半卡在 exec 之前（二进制缺失 / 被 EDR 拦下）。
*/
async function resolveLogFileInfo() {
	const logFilePath = node_path.join(getEditorSdkLogDir(), "editor_sdk.log");
	try {
		return {
			logFilePath,
			logFileExists: true,
			logFileMtimeMs: (await node_fs.promises.stat(logFilePath)).mtimeMs
		};
	} catch {
		return {
			logFilePath,
			logFileExists: false
		};
	}
}
/**
* 类 Unix 用 `pgrep -f 'editor_sdk --port'`：`--port` 是 vendor `buildEditorSdkSpawnArgs` 恒定的
* 首个 flag，用它锚定才不会把「命令行里恰好提到 editor_sdk」的进程（比如本诊断自己的父进程）算进来。
* Windows 的 tasklist 拿不到命令行，用镜像名过滤已经足够精确。
*/
async function listLiveEditorSdkPids(errors) {
	try {
		if (process.platform === "win32") return parseTasklistPids(await runCommand("tasklist", [
			"/FI",
			"IMAGENAME eq editor_sdk.exe",
			"/FO",
			"CSV",
			"/NH"
		]));
		return parsePgrepPids(await runCommand("pgrep", ["-f", "editor_sdk --port"]));
	} catch (error) {
		if (isNoMatchExit(error)) return [];
		errors.push(`list editor_sdk pids: ${toErrorMessage$5(error)}`);
		return [];
	}
}
async function listPortListeners(port, errors) {
	try {
		if (process.platform === "win32") return parseNetstatListeners(await runCommand("netstat", [
			"-ano",
			"-p",
			"TCP"
		]), port);
		return parseLsofListeners(await runCommand("lsof", [
			"-nP",
			`-iTCP:${port}`,
			"-sTCP:LISTEN"
		]));
	} catch (error) {
		if (isNoMatchExit(error)) return [];
		errors.push(`list port listeners: ${toErrorMessage$5(error)}`);
		return [];
	}
}
/**
* `tasklist /FO CSV /NH` 的行形如
* `"editor_sdk.exe","12345","Console","1","123,456 K"`，第二列是 PID。
* 导出仅为单测：Windows 侧的解析在 macOS/Linux CI 上跑不到真实命令。
*/
function parseTasklistPids(stdout) {
	return stdout.split(/\r?\n/).map((line) => /^"[^"]*","(\d+)"/.exec(line)?.[1]).filter((pid) => pid !== void 0).map(Number).slice(0, MAX_REPORTED_LINES);
}
function parsePgrepPids(stdout) {
	return stdout.split("\n").map((line) => Number(line.trim())).filter((pid) => Number.isInteger(pid) && pid > 0).slice(0, MAX_REPORTED_LINES);
}
/**
* netstat 行形如 `  TCP    0.0.0.0:39099    0.0.0.0:0    LISTENING    12345`。
* 端口后的空格是必需的：少了它 `:39099` 会顺带命中 `:390991`。
*/
function parseNetstatListeners(stdout, port) {
	return stdout.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.includes(`:${port} `) && line.toUpperCase().includes("LISTENING")).slice(0, MAX_REPORTED_LINES);
}
function parseLsofListeners(stdout) {
	return stdout.split("\n").map((line) => line.trim()).filter((line) => line.length > 0).slice(0, MAX_REPORTED_LINES);
}
function probePort(port) {
	return new Promise((resolve) => {
		let settled = false;
		const socket = node_net.createConnection({
			host: PROBE_HOST,
			port: Number(port)
		});
		socket.unref();
		const settle = (result) => {
			if (settled) return;
			settled = true;
			socket.removeAllListeners();
			socket.destroy();
			resolve(result);
		};
		socket.once("connect", () => settle("accepting"));
		socket.once("error", () => settle("refused"));
		socket.setTimeout(PORT_PROBE_TIMEOUT_MS, () => settle("timeout"));
	});
}
async function runCommand(file, args) {
	const { stdout } = await execFileAsync(file, args, {
		timeout: EXTERNAL_COMMAND_TIMEOUT_MS,
		windowsHide: true,
		maxBuffer: 1024 * 1024
	});
	return typeof stdout === "string" ? stdout : String(stdout);
}
/** `pgrep` / `lsof` 在「没有匹配」时以 exit 1 结束，这是正常结果而不是采集失败。 */
function isNoMatchExit(error) {
	return typeof error === "object" && error !== null && error.code === 1;
}
function toErrorMessage$5(error) {
	return error instanceof Error ? error.message : String(error);
}
//#endregion
//#region ../../packages/workbuddy-server/src/docs/engine/engine-unavailable-error.ts
/**
* 「本地腾讯文档引擎已判定不可用」的失败信号。
*
* 与普通启动失败的区别在于处置方式：普通失败可能只是冷启动慢，值得让 renderer 退避重试；
* 本错误由 `TencentDocsEngineSession` 的启动熔断器抛出，表示 editor_sdk 已连续多次在 vendor
* 的 60s readiness 窗口内起不来，继续等只是重复吃满超时。该信号经
* `EmbeddedPreviewResult.engineUnavailable` 透到 renderer，让预览立刻降级到内置 JS 预览。
*
* 独立成零依赖模块而不是挂在 `tencent-docs-engine-session.ts` 上：preview 侧只需要这个判定，
* 不应为此反向拉进引擎会话与 vendor 类型。
*/
var TencentDocsEngineUnavailableError = class extends Error {
	constructor(message) {
		super(message);
		this.engineUnavailable = true;
		this.name = "TencentDocsEngineUnavailableError";
	}
};
function isTencentDocsEngineUnavailableError(error) {
	return typeof error === "object" && error !== null && error.engineUnavailable === true;
}
//#endregion
//#region ../../packages/workbuddy-server/src/docs/engine/tencent-docs-engine-origin-registry.ts
/**
* 本地腾讯文档 SDK 引擎 origin 注册表。
*
* 引擎监听端口由系统动态分配，进程启动后才确定（见 TencentDocsService.getPort）。
* 而 Electron 的 setPermissionCheckHandler 是**同步**回调，给剪贴板等权限做精确
* （含端口）放行时，需要一个同步可读、无副作用的当前 origin 来源。
*
* 由 TencentDocsDocumentService 在引擎启动 / 生成预览 URL / 重启后登记最新 origin，
* dispose 时清除。permission handler 通过 getActiveTencentDocsEngineOrigin() 读取，
* 与 frame 的 requestingOrigin 精确比对（host + 动态端口）。
*/
var activeEngineOrigin;
var listeners = /* @__PURE__ */ new Set();
/** 登记（或更新）当前本地引擎 origin，形如 `http://127.0.0.1:<port>`。传 undefined 表示引擎已停止。 */
function setActiveTencentDocsEngineOrigin(origin) {
	if (activeEngineOrigin === origin) return;
	activeEngineOrigin = origin;
	for (const listener of listeners) listener(origin);
}
/** 读取当前本地引擎 origin；引擎未启动时返回 undefined。 */
function getActiveTencentDocsEngineOrigin() {
	return activeEngineOrigin;
}
/** 订阅当前进程内 engine origin 变化；用于 fork daemon 将 origin 镜像同步回 main。 */
function onActiveTencentDocsEngineOriginChange(listener) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}
//#endregion
//#region ../../packages/workbuddy-server/src/docs/engine/tencent-docs-engine-session.ts
/**
* 连续多少次引擎启动失败后熔断。
*
* 取 2 而不是 1：vendor 的 readiness 窗口是 60s，Windows 冷启动最慢也只到 ~8s，单次超时已经
* 很不正常，但仍可能是首次运行被杀软挂钩这类一次性事件；连续两次则可以判定这台机器上的
* editor_sdk 确实起不来，再等只是重复吃满 60s。
*/
var ENGINE_START_FAILURE_BREAKER_THRESHOLD = 2;
/**
* 熔断持续时长。期间所有 ensureStarted 立即失败，预览直接降级到内置 JS 预览。
*
* 5 分钟是「别再让用户反复卡 60s」与「环境恢复后别锁死太久」的折中：熔断态下用户仍能正常看
* 文档（走降级预览），而真修好了环境的用户通常会重启客户端，不必等这个窗口自然过期。
*/
var ENGINE_START_BREAKER_COOLDOWN_MS = 5 * 6e4;
/** 腾讯文档本地引擎生命周期：start/restart/port/ready/preview-url/origin/stale-cleanup。 */
var TencentDocsEngineSession = class {
	constructor(options) {
		this.options = options;
		this.staleCleanupDone = false;
		this.consecutiveStartFailures = 0;
		this.startBreakerOpenUntil = 0;
	}
	/**
	* 确保本地腾讯文档引擎已启动。
	*
	* 用于 MCP 后台预热、预览 getPreviewUrl 前的显式兜底等。
	* `source` 写入日志，便于在 main.log 对照冷启动耗时（grep `ensureStarted`）。
	*/
	async ensureStarted(source = "unspecified") {
		const startedAt = Date.now();
		const breakerRemainingMs = this.startBreakerOpenUntil - startedAt;
		if (breakerRemainingMs > 0) {
			windowLog.warn("[TencentDocsEngineSession] ensureStarted short-circuited by start breaker", {
				source,
				consecutiveStartFailures: this.consecutiveStartFailures,
				breakerRemainingMs
			});
			throw new TencentDocsEngineUnavailableError(`local Tencent Docs engine is unavailable: ${this.consecutiveStartFailures} consecutive start failures, retry allowed in ${Math.ceil(breakerRemainingMs / 1e3)}s`);
		}
		windowLog.info("[TencentDocsEngineSession] ensureStarted begin", {
			source,
			engineStarted: this.options.docsService.isStarted()
		});
		if (!this.staleCleanupDone) {
			this.staleCleanupDone = true;
			if (!this.options.docsService.isStarted()) try {
				this.options.cleanupStaleEditorSdkProcesses();
			} catch (error) {
				windowLog.warn("[TencentDocsEngineSession] kill stale editor_sdk failed", { error: toErrorMessage$4(error) });
			}
		}
		try {
			if (!this.engineStartInflight) this.engineStartInflight = this.options.docsService.ensureStarted().catch((error) => {
				this.engineStartInflight = void 0;
				this.recordStartAttemptFailure();
				throw error;
			});
			await this.engineStartInflight;
			const durationMs = Date.now() - startedAt;
			this.resetStartBreaker();
			windowLog.info("[TencentDocsEngineSession] ensureStarted done", {
				source,
				durationMs,
				engineStarted: this.options.docsService.isStarted(),
				enginePort: this.options.docsService.getPort()
			});
		} catch (error) {
			const breakerOpen = this.startBreakerOpenUntil > Date.now();
			windowLog.warn("[TencentDocsEngineSession] ensureStarted failed", {
				source,
				durationMs: Date.now() - startedAt,
				error: toErrorMessage$4(error),
				consecutiveStartFailures: this.consecutiveStartFailures,
				breakerOpen,
				hint: "grep main.log for: did not become ready within 60000, exited before ready, health endpoint not ready, preferred port busy",
				diagnostics: await this.startDiagnostics
			});
			throw breakerOpen ? new TencentDocsEngineUnavailableError(`local Tencent Docs engine failed to start ${this.consecutiveStartFailures} times in a row: ${toErrorMessage$4(error)}`) : error;
		}
	}
	recordStartAttemptFailure() {
		this.consecutiveStartFailures += 1;
		if (this.consecutiveStartFailures >= ENGINE_START_FAILURE_BREAKER_THRESHOLD) this.startBreakerOpenUntil = Date.now() + ENGINE_START_BREAKER_COOLDOWN_MS;
		this.startDiagnostics = this.consecutiveStartFailures <= ENGINE_START_FAILURE_BREAKER_THRESHOLD ? this.collectStartDiagnostics() : void 0;
	}
	/** 任何异常都吞掉：诊断不能反过来污染失败路径。 */
	async collectStartDiagnostics() {
		const collect = this.options.collectStartDiagnostics ?? collectEditorSdkStartDiagnostics;
		try {
			return await collect(this.options.docsService.getPort());
		} catch (error) {
			return { collectFailed: toErrorMessage$4(error) };
		}
	}
	resetStartBreaker() {
		this.consecutiveStartFailures = 0;
		this.startBreakerOpenUntil = 0;
		this.startDiagnostics = void 0;
	}
	/**
	* 只读预检：本机是否随包发布了可解析的 `editor_sdk` 二进制（不启动引擎、无副作用）。
	*/
	async canEnsureStart() {
		return this.options.docsService.canEnsureStart();
	}
	/** 引擎是否已就绪。 */
	isStarted() {
		return this.options.docsService.isStarted();
	}
	/** 返回本地腾讯文档引擎当前监听端口。 */
	getPort() {
		return this.options.docsService.getPort();
	}
	/**
	* 注入引擎就绪回调，bootstrap 用它在 editor_sdk 就绪后广播 `tencent-docs:engineReady`。
	* 若注入时引擎已就绪，立即补发一次，覆盖「引擎先于 handler 就绪」的冷启动竞态。
	*/
	setReadyHandler(handler) {
		this.readyHandler = handler;
		if (this.options.docsService.isStarted()) this.notifyReady();
	}
	/**
	* docsService.onEngineReady 触发入口。由门面/组合根在构造 docsService 时作为回调注入。
	* setReadyHandler 在引擎已就绪时补发也走同一条路。
	*/
	triggerReady() {
		this.notifyReady();
	}
	notifyReady() {
		try {
			this.readyHandler?.();
		} catch (error) {
			windowLog.warn("[TencentDocsEngineSession] engine ready handler threw", { error: toErrorMessage$4(error) });
		}
	}
	async restartWithDebugOptions(staticDir, editorSdkPath) {
		windowLog.info("[TencentDocsEngineSession] restart with debug options start", {
			staticDir,
			editorSdkPath
		});
		try {
			if (editorSdkPath === void 0) await this.options.docsService.restartWithStaticDir(staticDir);
			else await this.options.docsService.restartWithStaticDir(staticDir, editorSdkPath);
			windowLog.info("[TencentDocsEngineSession] restart with debug options succeeded", {
				staticDir,
				editorSdkPath
			});
			this.resetStartBreaker();
			setActiveTencentDocsEngineOrigin(void 0);
			return { success: true };
		} catch (error) {
			const message = toErrorMessage$4(error);
			windowLog.warn("[TencentDocsEngineSession] restart with debug options failed", {
				staticDir,
				editorSdkPath,
				error: message
			});
			return {
				success: false,
				error: message
			};
		}
	}
	/**
	* 为一个已确认的本地文件生成 iframe 预览 URL。
	*
	* 只负责和本地 SDK/引擎交互，不做文件存在性校验，也不登记 AI Docs 上下文。
	*
	* 必须先走 ensureStarted：若直连 docsService.getPreviewUrl 懒启动引擎，会绕过 staleCleanupDone，
	* 随后 mcp-config-warmup 的 ensureStarted 仍执行 pkill，误杀本进程刚拉起的 editor_sdk → 预览白屏。
	*/
	async createPreviewUrl(filePath, options) {
		const startedAt = Date.now();
		windowLog.info("[TencentDocsEngineSession] create preview URL start", {
			filePath,
			mode: options?.mode,
			engineStarted: this.options.docsService.isStarted(),
			enginePort: this.options.docsService.getPort()
		});
		let engineStartFailed = false;
		try {
			try {
				await this.ensureStarted("create-preview-url");
			} catch (error) {
				engineStartFailed = true;
				throw error;
			}
			const previewUrl = options ? await this.options.docsService.getPreviewUrl(filePath, options) : await this.options.docsService.getPreviewUrl(filePath);
			const durationMs = Date.now() - startedAt;
			windowLog.info("[TencentDocsEngineSession] create preview URL succeeded", {
				filePath,
				mode: options?.mode,
				durationMs,
				enginePort: this.options.docsService.getPort(),
				...getUrlLogFields(previewUrl, "previewUrl")
			});
			this.setOriginFromPreviewUrl(previewUrl);
			return previewUrl;
		} catch (error) {
			if (engineStartFailed) {
				windowLog.warn("[TencentDocsEngineSession] create preview URL failed on engine start; skipping fresh-engine retry", {
					filePath,
					mode: options?.mode,
					durationMs: Date.now() - startedAt,
					error: toErrorMessage$4(error)
				});
				throw error;
			}
			windowLog.warn("[TencentDocsEngineSession] create preview URL failed; retrying with fresh engine", {
				filePath,
				mode: options?.mode,
				durationMs: Date.now() - startedAt,
				engineStarted: this.options.docsService.isStarted(),
				enginePort: this.options.docsService.getPort(),
				error: toErrorMessage$4(error)
			});
			await this.options.docsService.dispose();
			setActiveTencentDocsEngineOrigin(void 0);
			this.engineStartInflight = void 0;
			const retryStartedAt = Date.now();
			await this.ensureStarted("create-preview-url-retry");
			const previewUrl = options ? await this.options.docsService.getPreviewUrl(filePath, options) : await this.options.docsService.getPreviewUrl(filePath);
			windowLog.info("[TencentDocsEngineSession] create preview URL retry succeeded", {
				filePath,
				mode: options?.mode,
				durationMs: Date.now() - retryStartedAt,
				totalDurationMs: Date.now() - startedAt,
				enginePort: this.options.docsService.getPort(),
				...getUrlLogFields(previewUrl, "previewUrl")
			});
			this.setOriginFromPreviewUrl(previewUrl);
			return previewUrl;
		}
	}
	/**
	* 把"引擎真实产出的 preview URL 的 origin"登记到 registry，供 Electron 剪贴板
	* 权限 handler 同步、精确（host + 动态端口）地放行 SDK preview frame。
	*/
	setOriginFromPreviewUrl(previewUrl) {
		try {
			setActiveTencentDocsEngineOrigin(new URL(previewUrl).origin);
		} catch (error) {
			windowLog.warn("[TencentDocsEngineSession] register engine origin failed", {
				...getUrlLogFields(previewUrl, "previewUrl"),
				error: toErrorMessage$4(error)
			});
		}
	}
	/**
	* editor_sdk 意外退出后重置会话状态，使下次 ensureStarted 能真正重新拉起引擎。
	*
	* 必须在 onUnexpectedExit 回调里调用：
	* - 清空 engineStartInflight：该字段成功启动后保留为 resolved Promise，不清空则下次
	*   ensureStarted 命中旧 Promise 直接返回，docsService.ensureStarted 永远不会被再次调用。
	* - 清除 active origin：旧 origin 已失效（端口可能变化），避免 preload 权限校验用死端口。
	*/
	resetOnUnexpectedExit() {
		this.engineStartInflight = void 0;
		setActiveTencentDocsEngineOrigin(void 0);
		windowLog.info("[TencentDocsEngineSession] resetOnUnexpectedExit: cleared engineStartInflight and origin");
	}
	/** 释放底层引擎资源并清除登记的 origin。 */
	async dispose() {
		await this.options.docsService.dispose();
		setActiveTencentDocsEngineOrigin(void 0);
	}
};
function toErrorMessage$4(error) {
	return error instanceof Error ? error.message : String(error);
}
function getUrlLogFields(rawUrl, prefix) {
	if (!rawUrl) return {};
	try {
		const parsed = new URL(rawUrl);
		return {
			[`${prefix}Protocol`]: parsed.protocol,
			[`${prefix}Host`]: parsed.hostname,
			[`${prefix}Port`]: parsed.port || void 0,
			[`${prefix}Pathname`]: parsed.pathname
		};
	} catch {
		return { [`${prefix}Raw`]: rawUrl };
	}
}
//#endregion
//#region ../../packages/workbuddy-server/src/docs/lease/document-lease-registry.ts
/** 创建一个 ReleaseDeferred（手动 resolve 的 void Promise）。 */
function createReleaseDeferred() {
	let resolve = () => {};
	return {
		promise: new Promise((res) => {
			resolve = res;
		}),
		resolve
	};
}
/**
* 本地文档「打开 / 去重 / 冲突 / 释放」的单一权威表，对外是一组 lock-manager 式显式 API。
* 借主进程单线程「await 前同步占位 + opToken 引用相等性回写」实现无锁串行，不双开。
*/
var DocumentLeaseRegistry = class {
	/** @param options 依赖注入的副作用挂载点与 running 谓词；纯核心使用时可全缺省。 */
	constructor(options = {}) {
		this.options = options;
		this.records = /* @__PURE__ */ new Map();
	}
	/**
	* 后置注入 running 谓词（§6.0#5 读时 prune / owner 活性判定的数据源）。
	*
	* registry 作为单一权威表由组合根先于业务依赖（如 sessionManager）构造，故 running 谓词在构造时
	* 往往尚不可得，由 bootstrap 完成会话依赖装配后经本 setter 注入；注入前缺省视为恒 running（true）。
	*/
	setSessionStillProcessing(predicate) {
		this.options.isSessionStillProcessing = predicate;
	}
	/** 后置注入前台会话 id（system-open 无 requester 时区分 owner 是否前台）。 */
	setForegroundSessionIdGetter(getter) {
		this.options.getForegroundSessionId = getter;
	}
	/**
	* 返回某资源的打开生命周期聚合状态（对租约集合的派生投影）：
	* 有 OpenLease → 其 phase；否则有 reserved 租约 → `reserved`；否则 → `absent`。
	*/
	getState(resourceUri) {
		const record = this.records.get(resourceUri);
		if (!record) return "absent";
		if (record.open) return record.open.phase;
		return record.reservedSessions.size > 0 ? "reserved" : "absent";
	}
	/**
	* 占用一条 reserved turn 租约（同步、无 await）。多 session 可在同一资源上各持一条共存；
	* 真正的跨 session 阻断发生在 arbitrate / acquireOpenLease，不在此处。
	*/
	acquireTurnLease(resourceUri, sessionId) {
		const record = this.ensureRecord(resourceUri);
		const existed = record.reservedSessions.has(sessionId);
		record.reservedSessions.add(sessionId);
		return { outcome: existed ? "already-mine" : "acquired" };
	}
	/**
	* single-flight 打开入口：第一个 await 之前同步占位 OPENING + 挂 inflightOpen，
	* 同资源后到的并发调用复用同一 Promise（不二次打开）。跨 session 命中 live OpenLease → conflict
	* （§2.4 严格隔离，永不 takeover、不双开）。
	*/
	acquireOpenLease(resourceUri, sessionId, openFn) {
		const record = this.ensureRecord(resourceUri);
		const open = record.open;
		if (!open) {
			const lease = {
				ownerSessionId: sessionId,
				phase: "opening",
				inflightOpen: null,
				opToken: null,
				inflightRelease: null
			};
			record.open = lease;
			const task = this.runOpen(resourceUri, lease, openFn);
			lease.inflightOpen = task;
			return {
				outcome: "acquired",
				task
			};
		}
		if (open.ownerSessionId !== sessionId) return {
			outcome: "conflict",
			existingSessionId: open.ownerSessionId
		};
		if (open.phase === "opening") {
			if (open.inflightOpen) return {
				outcome: "already-mine",
				task: open.inflightOpen
			};
			return { outcome: "already-active" };
		}
		if (open.phase === "releasing" || open.phase === "closing") return {
			outcome: "releasing-retry",
			task: open.inflightRelease?.promise ?? Promise.resolve()
		};
		return { outcome: "already-active" };
	}
	/**
	* 裁决（system-open 等入口）：返回 none / owned-by-self / owned-by-other + shouldBlockOpen。
	*
	* 决策语义上是对租约集合的投影（§3.6），数据单源自本表内部，方向性 fail-open（§6.2）：
	* 不创建、不升级任何租约。但**并非纯函数**——读时会惰性 GC 掉非 running 会话遗留的陈旧 turn
	* 租约（经 {@link collectRunningReservedSessions}，§6.0#5 惰性清理），陈旧租约清空后该记录可能被
	* 整条回收。单线程下迭代安全；调用方应把它视为「读 + 惰性清理」而非可重复无副作用的只读查询。
	*/
	arbitrate(resourceUri, options = {}) {
		const record = this.records.get(resourceUri);
		if (!record) return this.logArbitrateOutcome(resourceUri, options, "no-record", {
			decision: "none",
			shouldBlockOpen: false
		});
		let otherReservedSessionId;
		try {
			otherReservedSessionId = this.resolveTurnLeaseConflictSession(resourceUri, record, options);
		} catch {
			otherReservedSessionId = void 0;
		}
		if (otherReservedSessionId && otherReservedSessionId !== options.requestSessionId) return this.logArbitrateOutcome(resourceUri, options, "turn-lease-conflict", {
			decision: "owned-by-other",
			sessionId: otherReservedSessionId,
			shouldBlockOpen: true
		}, { turnLeaseOwner: otherReservedSessionId });
		const open = this.records.get(resourceUri)?.open;
		if (open) {
			const owner = open.ownerSessionId;
			if (options.requestSessionId) {
				if (owner !== options.requestSessionId) return this.logArbitrateOutcome(resourceUri, options, "open-lease-cross-session", {
					decision: "owned-by-other",
					sessionId: owner,
					shouldBlockOpen: true
				}, {
					openLeaseOwner: owner,
					openLeasePhase: open.phase
				});
				return this.logArbitrateOutcome(resourceUri, options, "open-lease-same-session", {
					decision: "owned-by-self",
					sessionId: owner,
					shouldBlockOpen: false
				}, {
					openLeaseOwner: owner,
					openLeasePhase: open.phase
				});
			}
			if (options.openSource === "session-open") return this.logArbitrateOutcome(resourceUri, options, "session-open-no-requester", {
				decision: "owned-by-other",
				sessionId: owner,
				shouldBlockOpen: true
			}, {
				openLeaseOwner: owner,
				openLeasePhase: open.phase
			});
			if (options.openSource === "system-open") {
				const foregroundSessionId = this.resolveForegroundSessionId();
				if (foregroundSessionId === null) return this.logArbitrateOutcome(resourceUri, options, "system-open-unknown-foreground-owned-by-other", {
					decision: "owned-by-other",
					sessionId: owner,
					shouldBlockOpen: true
				}, {
					openLeaseOwner: owner,
					foregroundSessionId: null
				});
				if (owner === foregroundSessionId) return this.logArbitrateOutcome(resourceUri, options, "system-open-foreground-owner", {
					decision: "owned-by-self",
					sessionId: owner,
					shouldBlockOpen: false
				}, {
					openLeaseOwner: owner,
					foregroundSessionId
				});
				return this.logArbitrateOutcome(resourceUri, options, "system-open-background-owner", {
					decision: "owned-by-other",
					sessionId: owner,
					shouldBlockOpen: true
				}, {
					openLeaseOwner: owner,
					foregroundSessionId
				});
			}
			return this.logArbitrateOutcome(resourceUri, options, "open-lease-no-requester-default", {
				decision: "owned-by-self",
				sessionId: owner,
				shouldBlockOpen: false
			}, {
				openLeaseOwner: owner,
				openLeasePhase: open.phase
			});
		}
		return this.logArbitrateOutcome(resourceUri, options, "reserved-only-or-empty", {
			decision: "none",
			shouldBlockOpen: false
		});
	}
	/**
	* 温和释放（release-if-clean，无弹框）：OPEN→RELEASING，await releaseFn 探测；clean→ABSENT
	* （onReleaseClean），dirty/失败/抛异常→回 OPEN 保守保留（§6.2 E1）。RELEASING 期被 evict → settle
	* 凭引用相等性放弃 drop（§6.1）。期间并发同 session 重开走 wait-and-chain：返回 releasing-retry、
	* await 本次释放 settle 后重入。
	*/
	releaseOpenLease(resourceUri, releaseFn) {
		return this.runPendingTransition(resourceUri, "releasing", releaseFn, (p) => p.released);
	}
	/**
	* 显式关闭（含 dirty prompt，编排在 closeFn 内）：OPEN→CLOSING，closed→ABSENT（onCloseDone），
	* blocked/取消/保存失败/抛异常→回 OPEN（§6.2 E1，对齐 S-CL-06/07/16）。
	*/
	closeOpenLease(resourceUri, closeFn) {
		return this.runPendingTransition(resourceUri, "closing", closeFn, (p) => p.closed);
	}
	/**
	* RELEASING 与 CLOSING 的同构实现：OPEN→phase 同步占位 + 令牌，await probeFn 后按 §6.1/§6.2 回写：
	* shouldDrop 为真且令牌/phase 未变 → 落 ABSENT 跑 dropEffect；否则（dirty/blocked/异常）回 OPEN。
	* 释放原子不可打断，令牌/phase 失配只会因 evict 发生。
	* @param phase 目标中间态（releasing/closing）。
	* @param probeFn 异步探测（release-if-clean 的 dirty 探测 / 显式关闭编排）。
	* @param shouldDrop 由探测结果判断是否应落 ABSENT。
	* @param dropEffect 落 ABSENT 后要跑的副作用挂载点。
	*/
	runPendingTransition(resourceUri, phase, probeFn, shouldDrop) {
		const token = this.beginPendingRelease(resourceUri, phase);
		if (!token) return Promise.resolve();
		return (async () => {
			let drop = false;
			try {
				drop = shouldDrop(await probeFn());
			} catch (error) {
				this.options.onEffectError?.(phase === "releasing" ? "releaseFn" : "closeFn", resourceUri, error);
				drop = false;
			}
			this.endPendingRelease(resourceUri, token, phase, drop);
		})();
	}
	/**
	* 同步把 OpenLease 从 OPEN 迁入中间态（releasing/closing）并返回身份令牌；供「释放副作用无法塞进
	* 单个回调」的调用方（如 SDK closeEditor 同时探测 dirty + 关闭）在 await 真实释放工作**之前**先占位。
	* 占位同时挂一个进行中释放 settle 信号（inflightRelease）：期间并发同 session 重开经 acquireOpenLease
	* 拿到 releasing-retry + 此信号，await 后重入做正确判定（wait-and-chain）。
	*
	* 返回 null 表示当前不可迁移（无 OpenLease / 非 OPEN，例如 opening 或已在另一释放编排中）——
	* 调用方此时仍应照常执行其释放工作，但**不要**参与本 FSM 的 drop（交给真正持有该迁移的一方）。
	*/
	beginPendingRelease(resourceUri, phase) {
		const lease = this.records.get(resourceUri)?.open;
		if (!lease || lease.phase !== "open") return null;
		lease.phase = phase;
		const token = {};
		lease.opToken = token;
		lease.inflightRelease = createReleaseDeferred();
		return token;
	}
	/**
	* 与 beginPendingRelease 配对：真实释放工作结束后回写 FSM。无论走哪条分支都会 resolve 进行中释放 settle
	* 信号，唤醒 wait-and-chain 的等待者去重入。
	* - 令牌/phase 未变（未被 evict）：drop=true→落 ABSENT 跑 dropEffect（onReleaseClean/onCloseDone，等待者
	*   重入走 fresh）；drop=false→回 OPEN 保守保留（dirty/blocked/异常，§6.2 E1，fail-closed，等待者重入走
	*   already-active 复用）。
	* - 令牌失配或 phase 已变（只会因 evict 发生）：放弃回写（§6.1），不误删；仅兜底 resolve 信号。
	* @param phase 必须与 beginPendingRelease 时一致；releasing→onReleaseClean，closing→onCloseDone。
	*/
	endPendingRelease(resourceUri, token, phase, drop) {
		const current = this.records.get(resourceUri)?.open;
		if (!current || current.opToken !== token || current.phase !== phase) {
			if (current) this.resolveInflightRelease(current);
			return;
		}
		current.opToken = null;
		if (drop) {
			this.dropOpenLease(resourceUri);
			const effect = phase === "releasing" ? this.options.onReleaseClean : this.options.onCloseDone;
			this.runEffect(phase === "releasing" ? "onReleaseClean" : "onCloseDone", resourceUri, () => effect?.(resourceUri));
		} else {
			current.phase = "open";
			this.resolveInflightRelease(current);
		}
	}
	/** resolve 并清空某 lease 的进行中释放信号（唤醒全部 wait-and-chain 等待者）；无信号则 no-op。 */
	resolveInflightRelease(lease) {
		const pending = lease.inflightRelease;
		if (pending) {
			lease.inflightRelease = null;
			pending.resolve();
		}
	}
	/**
	* agent `open_file` 的 pre-hook（states-only，§3.5）：把资源同步占为 OPENING 并返回身份令牌，供
	* {@link endAgentOpen} 回写。与 `acquireOpenLease` 的差异：openFn 不由本表持有（真实打开在引擎侧），
	* OPENING→OPEN/ABSENT 的 settle 由外部 tool_call_update 结果驱动，故 `inflightOpen` 恒为 null。
	*
	* 返回 null 表示**已有 OpenLease**（同 session 已开 / 正在 opening / 跨 session 他人持有）——镜像既有、
	* 不竞争、不夺主（§2.4），调用方不应参与本次 settle。
	*/
	beginAgentOpen(resourceUri, sessionId) {
		const record = this.ensureRecord(resourceUri);
		if (record.open) return null;
		const token = {};
		record.open = {
			ownerSessionId: sessionId,
			phase: "opening",
			inflightOpen: null,
			opToken: token,
			inflightRelease: null
		};
		return token;
	}
	/**
	* 与 {@link beginAgentOpen} 配对的 result-hook：`success`→OPEN，否则 drop（ABSENT）。
	* 凭 §6.1 `opToken` 引用相等性回写：令牌失配或 phase 已变（被 evict）→放弃改表，防 ABA。
	*/
	endAgentOpen(resourceUri, token, success) {
		const current = this.records.get(resourceUri)?.open;
		if (!current || current.opToken !== token || current.phase !== "opening") return;
		if (success) {
			current.phase = "open";
			current.opToken = null;
		} else this.dropOpenLease(resourceUri);
	}
	/** 落 ABSENT：清除 OpenLease 并对空记录做 refcount GC。仅在 settle 校验通过后调用。 */
	dropOpenLease(resourceUri) {
		const record = this.records.get(resourceUri);
		if (!record) return;
		if (record.open) this.resolveInflightRelease(record.open);
		record.open = null;
		this.gcIfEmpty(resourceUri, record);
	}
	/**
	* turn 结束：清该 session 的 reserved turn 租约，**不动 OpenLease**（前台预览跨 turn 保留）。
	* 空记录 refcount GC。
	*/
	releaseTurnLeases(sessionId) {
		for (const [resourceUri, record] of this.records) if (record.reservedSessions.delete(sessionId)) this.gcIfEmpty(resourceUri, record);
	}
	/**
	* session 删除：清该 session 全部租约，含其持有的 OpenLease（§2.4 owner 永不转移）。
	* 被清的 OpenLease 若仍在 opening，其 inflightOpen 的 settle 会因引用失配而放弃回写。
	*/
	evictSession(sessionId) {
		for (const [resourceUri, record] of this.records) {
			let changed = record.reservedSessions.delete(sessionId);
			if (record.open && record.open.ownerSessionId === sessionId) {
				this.resolveInflightRelease(record.open);
				record.open = null;
				changed = true;
			}
			if (changed) this.gcIfEmpty(resourceUri, record);
		}
	}
	/** 清空全部租约状态。仅用于服务 dispose / 测试 teardown。 */
	clearAll() {
		for (const record of this.records.values()) if (record.open) this.resolveInflightRelease(record.open);
		this.records.clear();
	}
	/**
	* 返回当前持有 OpenLease 的资源数量（任意非 null phase 均计入）。
	*
	* 用于 system-open 入口的预览池容量硬闸门预检：
	* 手动打开（右键/双击）时若 `count >= capacity` 则拒绝，不需要判断 owner 是否 processing，
	* 容量上限对手动打开是绝对约束。
	*
	* 注：主进程 OpenLease 与 renderer keep-alive pool entry 基本 1:1 对应
	*（acquireOpenLease 入口与 releaseOpenLease / closeOpenLease 出口对称），
	* 边界情况下多计一个仍比超开预览更安全。
	*/
	getOpenLeaseCount() {
		let count = 0;
		for (const record of this.records.values()) if (record.open) count++;
		return count;
	}
	/** 返回某资源租约集合的只读快照（无记录返回 null）；仅用于调试与单测断言，不参与决策。 */
	inspect(resourceUri) {
		const record = this.records.get(resourceUri);
		if (!record) return null;
		return {
			state: this.getState(resourceUri),
			reserved: [...record.reservedSessions],
			open: record.open ? {
				ownerSessionId: record.open.ownerSessionId,
				phase: record.open.phase
			} : null
		};
	}
	/**
	* 执行一次打开：同步占位已在 acquireOpenLease 完成，这里启动 openFn 并在 settle 时按 §6.1
	* 引用相等性回写——成功转 OPEN（跑 onOpenSettled），失败 drop 记录；令牌失配则只 settle 不改表。
	*/
	runOpen(resourceUri, lease, openFn) {
		const token = {};
		lease.opToken = token;
		return (async () => {
			try {
				const result = await openFn();
				if (this.records.get(resourceUri)?.open?.opToken === token) {
					lease.phase = "open";
					lease.inflightOpen = null;
					lease.opToken = null;
					this.runEffect("onOpenSettled", resourceUri, () => this.options.onOpenSettled?.(resourceUri, result));
				}
				return result;
			} catch (error) {
				const record = this.records.get(resourceUri);
				if (record?.open?.opToken === token) {
					record.open = null;
					this.gcIfEmpty(resourceUri, record);
				}
				throw error;
			}
		})();
	}
	/**
	* reserved turn 租约的跨 session 冲突投影（§3.6）：返回首个仍 running 的他会话（其 reserved 阻断本次打开）。
	* 读时 prune 非 running 的陈旧 reserved 租约（§6.0#5）。
	*
	* TODO（右键打开不再被 turn 租约前置拦截）：`system-open` 且无 requestSessionId 时直接放行——
	* 移除 `processing` 后，右键 / 双击系统入口不再受 turn 租约（含旧「≥2 running processing」规则，原 S-CF-05/06）
	* 约束，仅由 OpenLease（真实打开）去重。若后续需要恢复「多会话引用同一文件时右键去重」，在此重加规则。
	*/
	resolveTurnLeaseConflictSession(resourceUri, record, options) {
		if (options.openSource === "system-open" && !options.requestSessionId) return;
		return this.collectRunningReservedSessions(resourceUri, record, options.requestSessionId)[0];
	}
	/**
	* 收集该资源上仍 running 的 reserved 租约会话，并顺带 prune 掉非 running 的陈旧租约（读时兜底）。
	* @param excludeSessionId 排除该会话自身（发起方不与自己冲突）。
	*/
	collectRunningReservedSessions(resourceUri, record, excludeSessionId) {
		const running = [];
		const stale = [];
		for (const sessionId of record.reservedSessions) {
			if (excludeSessionId && sessionId === excludeSessionId) continue;
			if (!this.isRunning(sessionId)) {
				stale.push(sessionId);
				continue;
			}
			running.push(sessionId);
		}
		for (const staleSessionId of stale) record.reservedSessions.delete(staleSessionId);
		if (stale.length > 0) this.gcIfEmpty(resourceUri, record);
		return running;
	}
	/** 会话是否仍 running；未注入谓词时视为恒 running。谓词抛错由调用方按 fail-open 处理。 */
	isRunning(sessionId) {
		return this.options.isSessionStillProcessing ? this.options.isSessionStillProcessing(sessionId) : true;
	}
	/** 当前前台会话；未注入或抛错时返回 null（fail-safe 未知）。 */
	resolveForegroundSessionId() {
		try {
			const foreground = this.options.getForegroundSessionId?.();
			if (typeof foreground === "string" && foreground.trim()) return foreground.trim();
			return null;
		} catch {
			return null;
		}
	}
	/** arbitrate 出口统一日志：reason 标识判定分支，便于排查去重失效。 */
	logArbitrateOutcome(resourceUri, options, reason, result, extra = {}) {
		return result;
	}
	/** 同步内联跑一个副作用：状态已先行落定，副作用抛错只经 onEffectError 上报、绝不回滚 FSM（§6.2 E2）。 */
	runEffect(hook, resourceUri, effect) {
		try {
			effect();
		} catch (error) {
			this.options.onEffectError?.(hook, resourceUri, error);
		}
	}
	/** refcount GC：租约集合（reservedSessions + open）为空即删除整条记录，杜绝空记录泄漏。 */
	gcIfEmpty(resourceUri, record) {
		if (!record.open && record.reservedSessions.size === 0) this.records.delete(resourceUri);
	}
	/** 取得或新建某资源的租约记录（新建时租约集合为空，需调用方随即写入租约）。 */
	ensureRecord(resourceUri) {
		let record = this.records.get(resourceUri);
		if (!record) {
			record = {
				reservedSessions: /* @__PURE__ */ new Set(),
				open: null
			};
			this.records.set(resourceUri, record);
		}
		return record;
	}
};
//#endregion
//#region ../../packages/workbuddy-server/src/docs/menu-i18n.ts
var localeResources = {
	"zh-CN": { tencentDocs: { localPreview: {
		saveDialogTitle: "保存文档",
		saveDialogMessage: "保存“{{name}}”？",
		saveDialogDetail: "“保存”将覆盖原文档，或选择“另存为”创建新副本。",
		readOnlySaveDialogDetail: "原文档只读，无法覆盖保存。请使用另存为在可写目录中生成新文件。",
		readOnlySavePreventedMessage: "原文档只读，无法保存到原文档，请使用另存为。",
		saveButton: "保存",
		saveAsButton: "另存为",
		cancelButton: "取消",
		discardButton: "不保存",
		chooseSaveAsFileTitle: "选择另存为文件",
		saveCanceledMessage: "已取消保存",
		saveAsCanceledMessage: "已取消另存为",
		dirtyCloseTitle: "保存文档修改",
		dirtyCloseMessage: "是否保存对“{{name}}”的修改？",
		dirtyCloseDetail: "未保存的修改将在关闭后丢失。",
		readOnlyDirtyCloseDetail: "原文档只读，无法覆盖保存；请另存为在可写目录中保留修改，或选择不保存并确认丢弃修改。",
		discardConfirmTitle: "不保存并关闭预览？",
		discardConfirmMessage: "不保存“{{name}}”的修改？",
		discardConfirmDetail: "未保存的内容将丢失。确认不保存后会直接关闭预览服务并放弃当前修改。",
		overwriteButton: "继续覆盖",
		acknowledgeButton: "知道了",
		originalChangedNotificationTitle: "原文档已被修改",
		originalChangedNotificationBody: "“{{name}}”已被其他应用修改，继续编辑后保存可能覆盖外部修改。",
		originalChangedDirtyNotificationDetail: "建议先另存为当前修改，或取消后刷新文档确认外部修改。",
		originalChangedCleanNotificationBody: "“{{name}}”已被其他应用修改，请刷新文档以查看最新内容。",
		originalChangedCleanNotificationDetail: "当前预览仍是打开时的内容；如果要继续处理，请先刷新或重新打开文档。",
		originalChangedConflictTitle: "原文档已被修改",
		originalChangedConflictMessage: "“{{name}}”已被其他应用修改。",
		originalChangedConflictDetail: "保存到原文档会覆盖外部修改。建议选择另存为，或取消保存后先确认原文档内容；只有确认需要覆盖时再选择继续覆盖。"
	} } },
	"en-US": { tencentDocs: { localPreview: {
		saveDialogTitle: "Save Document",
		saveDialogMessage: "Save \"{{name}}\"?",
		saveDialogDetail: "\"Save\" will overwrite the original document, or choose \"Save As\" to create a new copy.",
		readOnlySaveDialogDetail: "The original document is read-only and cannot be overwritten. Use Save As to create a new file in a writable folder.",
		readOnlySavePreventedMessage: "The original document is read-only and cannot be saved in place. Use Save As instead.",
		saveButton: "Save",
		saveAsButton: "Save As",
		cancelButton: "Cancel",
		discardButton: "Don't Save",
		chooseSaveAsFileTitle: "Choose Save As File",
		saveCanceledMessage: "Save canceled",
		saveAsCanceledMessage: "Save As canceled",
		dirtyCloseTitle: "Save Document Changes",
		dirtyCloseMessage: "Save changes to \"{{name}}\"?",
		dirtyCloseDetail: "Unsaved changes will be lost when the document is closed.",
		readOnlyDirtyCloseDetail: "The original document is read-only and cannot be overwritten. Use Save As to keep changes in a writable folder, or choose Don't Save and confirm discarding changes.",
		discardConfirmTitle: "Close Without Saving?",
		discardConfirmMessage: "Don't save changes to \"{{name}}\"?",
		discardConfirmDetail: "Unsaved changes will be lost. Confirming Don't Save will close the preview service and discard current changes.",
		overwriteButton: "Overwrite Anyway",
		acknowledgeButton: "Got it",
		originalChangedNotificationTitle: "Original Document Changed",
		originalChangedNotificationBody: "\"{{name}}\" was modified by another app. Saving after further edits may overwrite those changes.",
		originalChangedDirtyNotificationDetail: "Save As is recommended, or cancel and refresh the document to review the external changes first.",
		originalChangedCleanNotificationBody: "\"{{name}}\" was modified by another app. Refresh the document to view the latest content.",
		originalChangedCleanNotificationDetail: "The current preview is still showing the content from when it was opened. Refresh or reopen the document before continuing.",
		originalChangedConflictTitle: "Original Document Changed",
		originalChangedConflictMessage: "\"{{name}}\" was modified by another app.",
		originalChangedConflictDetail: "Saving to the original document will overwrite external changes. Save As is recommended, or cancel and review the original document first. Choose Overwrite Anyway only if you are sure."
	} } }
};
function isChineseLocale(locale) {
	return /^zh|^cn/.test(locale.toLowerCase());
}
function normalizeMenuLocale(locale) {
	const normalized = locale.trim();
	if (normalized === "zh-CN" || normalized === "en-US") return normalized;
	return isChineseLocale(normalized) ? "zh-CN" : "en-US";
}
function setMenuLocale(locale) {
	process.env.WORKBUDDY_MENU_LOCALE = normalizeMenuLocale(locale);
}
function getMenuLocale() {
	const saved = process.env.WORKBUDDY_MENU_LOCALE;
	if (saved === "zh-CN" || saved === "en-US") return saved;
	return isChineseLocale(process.env.LANG || "en-US") ? "zh-CN" : "en-US";
}
function getRendererTranslation(key, locale = getMenuLocale()) {
	const value = key.split(".").reduce((current, part) => {
		if (!current || typeof current !== "object") return;
		return current[part];
	}, localeResources[locale]);
	if (typeof value !== "string") return key;
	return value;
}
//#endregion
//#region ../../packages/workbuddy-server/src/docs/save/local-document-save.ts
/**
* 判断路径条目是否存在。
*
* 使用 `lstat` 而不是 `access`，是为了把断链符号链接也视为“已占用路径”，
* 避免另存为生成的目标路径覆盖用户已有的链接条目。
*/
async function pathEntryExists(filePath) {
	try {
		await node_fs.promises.lstat(filePath);
		return true;
	} catch (error) {
		if (error.code === "ENOENT") return false;
		throw error;
	}
}
/**
* 检查原始本地文件是否仍可覆盖写入。
*
* 该判断只服务于“保存到原文档”入口；另存为会写入用户新选目录，不能因为原文件只读而被拦截。
* 读不到或权限不可写时统一视为不可覆盖，避免弹出“保存”按钮后再静默失败或误导用户。
*/
async function getLocalDocumentWriteAccess(filePath, access = node_fs.promises.access) {
	const target = filePath.trim();
	if (!target) return {
		writable: false,
		reason: "missing"
	};
	try {
		await access(target, node_fs.constants.W_OK);
		return { writable: true };
	} catch (error) {
		const code = error.code;
		if (code === "ENOENT") return {
			writable: false,
			reason: "missing"
		};
		if (code === "EACCES" || code === "EPERM" || code === "EROFS") return {
			writable: false,
			reason: "read-only"
		};
		return {
			writable: false,
			reason: "unknown",
			error: error instanceof Error ? error.message : String(error)
		};
	}
}
/**
* 构造显式保存弹窗的按钮顺序。
*
* macOS 保持取消在左侧的系统习惯；当原文档不可写时移除覆盖保存，仅保留另存为和取消。
*/
function buildLocalDocumentSaveChoices(params) {
	const cancelChoice = {
		action: "cancel",
		label: params.labels.cancelButton
	};
	const saveChoice = {
		action: "save",
		label: params.labels.saveButton
	};
	const saveAsChoice = {
		action: "saveAs",
		label: params.labels.saveAsButton
	};
	if (!params.canSaveOriginal) return params.isDarwin ? [cancelChoice, saveAsChoice] : [saveAsChoice, cancelChoice];
	return params.isDarwin ? [
		cancelChoice,
		saveChoice,
		saveAsChoice
	] : [
		saveChoice,
		saveAsChoice,
		cancelChoice
	];
}
/**
* 构造 dirty close 弹窗的按钮顺序。
*
* 只读原文档不能覆盖保存，但用户仍可“另存为”保留修改，或明确“不保存”后丢弃修改。
*/
function buildLocalDocumentDirtyCloseChoices(params) {
	const cancelChoice = {
		action: "cancel",
		label: params.labels.cancelButton
	};
	const saveChoice = {
		action: "save",
		label: params.labels.saveButton
	};
	const saveAsChoice = {
		action: "saveAs",
		label: params.labels.saveAsButton
	};
	const discardChoice = {
		action: "discard",
		label: params.labels.discardButton
	};
	if (!params.canSaveOriginal) return params.isDarwin ? [
		cancelChoice,
		saveAsChoice,
		discardChoice
	] : [
		saveAsChoice,
		discardChoice,
		cancelChoice
	];
	return params.isDarwin ? [
		cancelChoice,
		saveChoice,
		saveAsChoice,
		discardChoice
	] : [
		saveChoice,
		saveAsChoice,
		discardChoice,
		cancelChoice
	];
}
/**
* 根据业务动作计算 Electron 弹窗按钮 ID。
*
* Electron 只会按英文按钮名自动识别取消按钮；中文 locale 下必须显式传入 `cancelId`，
* 否则 Esc / 关闭弹窗可能回落到第一个按钮并误触发“另存为”。
*/
function getLocalDocumentDialogButtonIds(params) {
	const defaultId = params.choices.findIndex((item) => item.action === params.defaultAction);
	const cancelId = params.choices.findIndex((item) => item.action === params.cancelAction);
	return {
		defaultId: defaultId >= 0 ? defaultId : 0,
		cancelId: cancelId >= 0 ? cancelId : 0
	};
}
/**
* 根据原文件名和目标目录生成一个未占用的另存为默认路径。
*
* 该函数只负责生成系统保存弹窗的默认文件名；用户仍可在 `showSaveDialog` 中重命名，
* 若最终选择已有文件，覆盖确认交给宿主系统保存弹窗处理。
*/
async function buildLocalDocumentSaveAsPath(sourceFilePath, targetDirectory, exists = pathEntryExists) {
	const directory = targetDirectory.trim();
	if (!directory) throw new Error("targetDirectory is required");
	const parsed = node_path.parse(sourceFilePath);
	const baseName = parsed.name || parsed.base || "document";
	const extension = parsed.ext;
	const directTarget = node_path.join(directory, `${baseName}${extension}`);
	if (!await exists(directTarget)) return directTarget;
	let copyIndex = 1;
	while (true) {
		const suffix = copyIndex === 1 ? " 副本" : ` 副本 ${copyIndex}`;
		const candidate = node_path.join(directory, `${baseName}${suffix}${extension}`);
		if (!await exists(candidate)) return candidate;
		copyIndex += 1;
	}
}
/** 根据源文件扩展名生成保存弹窗过滤器，让用户改名时仍默认保留文档类型。 */
function buildLocalDocumentSaveAsFilters(sourceFilePath) {
	const extension = node_path.extname(sourceFilePath).replace(/^\./, "").trim();
	if (!extension) return;
	return [{
		name: extension.toUpperCase(),
		extensions: [extension]
	}];
}
/**
* 打开系统“另存为”文件对话框并返回用户选择的目标文件路径。
*
* 与旧的“选择目录后自动拼文件名”不同，这里使用保存文件对话框，允许用户直接重命名文件。
*/
async function requestLocalDocumentSaveAsPath(params) {
	const defaultPath = await buildLocalDocumentSaveAsPath(params.sourceFilePath, node_path.dirname(params.sourceFilePath), params.exists);
	const result = await params.dialogProvider.showSaveDialog({
		title: params.title,
		defaultPath,
		filters: buildLocalDocumentSaveAsFilters(params.sourceFilePath)
	});
	if (result.canceled || !result.filePath?.trim()) return;
	return result.filePath;
}
//#endregion
//#region ../../packages/workbuddy-server/src/docs/preview/dirty-editor-close-decision.ts
/**
* 默认 dirty editor 关闭决策：询问用户保存、另存为、丢弃或取消。
*
* 该函数只负责 Electron 对话框和 save-as 目标路径选择；真正保存仍由调用方执行，
* 以保持 SDK editor 生命周期和 context 释放顺序由 manager 控制。
*/
async function defaultRequestDirtyEditorCloseDecision(context, dialogOptions) {
	const dialogProvider = dialogOptions?.dialogProvider;
	if (!dialogProvider) {
		windowLog.warn("[TencentDocsDocumentService] dirty close blocked without host dialog provider", {
			fileId: context.fileId,
			filePath: context.filePath,
			source: context.source
		});
		return context.source === "open-eviction" ? { action: "discard" } : { action: "cancel" };
	}
	const title = context.title || node_path.basename(context.filePath);
	const allowCancel = context.source !== "open-eviction";
	const originalWriteAccess = await getLocalDocumentWriteAccess(context.filePath);
	if (!originalWriteAccess.writable) windowLog.info("[TencentDocsDocumentService] dirty close uses save-as only for read-only original", {
		fileId: context.fileId,
		filePath: context.filePath,
		reason: originalWriteAccess.reason,
		error: originalWriteAccess.error
	});
	while (true) {
		const buttons = buildLocalDocumentDirtyCloseChoices({
			isDarwin: process.platform === "darwin",
			canSaveOriginal: originalWriteAccess.writable,
			labels: {
				saveButton: formatLocalPreviewText$2("saveButton"),
				saveAsButton: formatLocalPreviewText$2("saveAsButton"),
				cancelButton: formatLocalPreviewText$2("cancelButton"),
				discardButton: formatLocalPreviewText$2("discardButton")
			}
		}).filter((item) => allowCancel || item.action !== "cancel");
		const defaultAction = originalWriteAccess.writable ? "save" : "saveAs";
		const defaultId = buttons.findIndex((item) => item.action === defaultAction);
		const cancelId = buttons.findIndex((item) => item.action === "cancel");
		const options = {
			type: "warning",
			buttons: buttons.map((item) => item.label),
			defaultId: defaultId >= 0 ? defaultId : 0,
			...allowCancel && cancelId >= 0 ? { cancelId } : {},
			title: formatLocalPreviewText$2("dirtyCloseTitle"),
			message: formatLocalPreviewText$2("dirtyCloseMessage", { name: title }),
			detail: formatLocalPreviewText$2(originalWriteAccess.writable ? "dirtyCloseDetail" : "readOnlyDirtyCloseDetail"),
			noLink: true
		};
		const action = buttons[(await dialogProvider.showMessageBox(options)).response]?.action ?? (allowCancel ? "cancel" : defaultAction);
		if (action === "discard") return { action: "discard" };
		if (action === "cancel") return { action: "cancel" };
		if (action === "save") return { action: "save" };
		const targetFilePath = await requestLocalDocumentSaveAsPath({
			sourceFilePath: context.filePath,
			title: formatLocalPreviewText$2("chooseSaveAsFileTitle"),
			dialogProvider
		});
		if (!targetFilePath) {
			if (allowCancel) return { action: "cancel" };
			continue;
		}
		return {
			action: "saveAs",
			targetFilePath
		};
	}
}
function formatLocalPreviewText$2(key, values = {}) {
	const template = getRendererTranslation(`tencentDocs.localPreview.${key}`);
	return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{{${name}}}`, value).replaceAll(`{${name}}`, value), template);
}
//#endregion
//#region ../../packages/workbuddy-server/src/docs-shared/doc-artifact-source.ts
var WORD_EXTS = new Set([
	"doc",
	"docx",
	"dot",
	"dotx",
	"docm",
	"dotm",
	"wps",
	"wpt"
]);
var EXCEL_EXTS = new Set([
	"xls",
	"xlsx",
	"xlt",
	"xltx",
	"xlsm",
	"xltm",
	"csv"
]);
var PPT_EXTS = new Set([
	"ppt",
	"pptx",
	"pptm",
	"pps",
	"ppsx",
	"ppsm",
	"pot",
	"potx",
	"potm",
	"dps",
	"dpt"
]);
/**
* 由文件后缀推导制品大类。入参可带或不带前导点，大小写不敏感。
*/
function resolveDocArtifactSource(ext) {
	const e = (ext ?? "").toLowerCase().replace(/^\./, "");
	if (WORD_EXTS.has(e)) return "word";
	if (EXCEL_EXTS.has(e)) return "excel";
	if (PPT_EXTS.has(e)) return "ppt";
	if (e === "pdf") return "pdf";
	return "unknown";
}
/**
* 从文件路径 / 文件名提取小写后缀（不含点）。无后缀返回 ''。
* 兼容 file:// URI、query/hash 尾串与 Windows 反斜杠路径。
*/
function extractFileExtension$1(filePathOrName) {
	if (!filePathOrName) return "";
	const normalized = (filePathOrName.split(/[?#]/, 1)[0] ?? "").replace(/\\/g, "/");
	const lastSegment = normalized.slice(normalized.lastIndexOf("/") + 1);
	const dotIdx = lastSegment.lastIndexOf(".");
	if (dotIdx <= 0 || dotIdx === lastSegment.length - 1) return "";
	return lastSegment.slice(dotIdx + 1).toLowerCase();
}
//#endregion
//#region ../../packages/workbuddy-server/src/docs/preview/preview-telemetry.ts
/**
* daemon 侧本地文档预览上报（file_viewer）。
*
* 保存成功落在 daemon 真实写盘路径，需经本模块把 (eventCode, payload) 透传到
* telemetry service（与渲染端 adapter.reportTelemetry 汇入同一 /v2/report）。
* 具体 reporter 由宿主（daemon-app-server-main）用 celljs.eventService.report 注入。
*
* 事件：
* - file_viewer_save_suc：用户 Save / Save As（含 dirty-close）写盘成功；不含 interactive:false 自动保存。
*/
var SAVE_SUC_EVENT = "file_viewer_save_suc";
/** 从原文件路径推导 source/type；另存为仍按原文件归因。 */
function buildFileViewerSaveTelemetryFields(filePath) {
	const type = extractFileExtension$1(filePath ?? "");
	return {
		source: resolveDocArtifactSource(type),
		type,
		mode: "local"
	};
}
/** 安全上报：失败仅 log，绝不阻断保存/关闭流程。 */
function safeReport(report, eventCode, payload) {
	try {
		report(eventCode, payload);
	} catch (error) {
		windowLog.warn("[TencentDocsPreviewTelemetry] report failed", {
			eventCode,
			error: error instanceof Error ? error.message : String(error)
		});
	}
}
/**
* 本地文档预览保存成功上报。
* 调用方需自行保证：仅 interactive 写盘成功、且非 autoSave 路径。
*/
function reportFileViewerSaveSuc(report, filePath) {
	if (!report) return;
	safeReport(report, SAVE_SUC_EVENT, buildFileViewerSaveTelemetryFields(filePath));
}
//#endregion
//#region ../../packages/workbuddy-server/src/docs/preview/local-document-preview-close.ts
/**
* embedded preview 显式释放和 dirty close 编排。
*
* 职责边界：
* - 释放 context 前定位真实 SDK editor，并以 `closeEditor(force=false)` 做 dirty 权威校验；
* - dirty 时串行化同一 fileId 的保存/另存/丢弃/取消决策，避免并发弹框或重复保存；
* - iframe 内部 tab 切换也复用同一 dirty guard，保证用户离开当前文档前不会丢改动；
* - keep-alive 的无弹框 release-if-clean 不在这里做，由 `LocalDocumentPreviewReleaseManager` 调用轻量 close 能力复用 SDK 语义。
*/
var LocalDocumentPreviewCloseManager = class {
	constructor(options) {
		this.options = options;
		this.dirtyEditorCloseGuardTasks = /* @__PURE__ */ new Map();
	}
	/**
	* 查询某个 SDK editor 是否已有 dirty close 决策在执行。
	* release-if-clean 依赖它把并发关闭流程保守视为 dirty，避免 pool 淘汰抢在用户决策前释放 context。
	*/
	hasDirtyCloseGuardTask(fileId) {
		return this.dirtyEditorCloseGuardTasks.has(fileId);
	}
	/**
	* 显式释放单个 embedded preview context（CLOSING 两段式 FSM 包装）。
	*
	* 先同步把 OpenLease 占为 CLOSING（拿令牌），再**不受 phase 门控**地执行真实关闭（含 dirty 弹框，必须始终运行）；
	* 结束后按结果回写 FSM：released→drop OpenLease（落 ABSENT，使产物仍在时再点击为 fresh 重开 S-RO-01）；
	* 期间被 evict（令牌失配）→放弃 drop（§6.1）；异常→回 OPEN 保守保留（§6.2 E1，fail-closed）。同 session 重开
	* 走 wait-and-chain，等本次关闭 settle 后重入（见 README §4.3）。
	* `beginPendingRelease` 返回 null（无 OpenLease / 非 OPEN，如在线文档或已在另一释放编排中）时不参与本 FSM。
	*/
	async releaseContext(documentResourceUri, options = {}) {
		const token = this.options.registry.beginPendingRelease(documentResourceUri, "closing");
		try {
			const result = await this.releaseContextInner(documentResourceUri, options);
			if (token) this.options.registry.endPendingRelease(documentResourceUri, token, "closing", !!result.released);
			return result;
		} catch (error) {
			if (token) this.options.registry.endPendingRelease(documentResourceUri, token, "closing", false);
			throw error;
		}
	}
	/** 显式释放的真实拆除工作（SDK close / dirty prompt / 释放 context），由 `releaseContext` 包 FSM 后调用。 */
	async releaseContextInner(documentResourceUri, options = {}) {
		const previewContext = this.options.contextManager.getFilePreviewContext(documentResourceUri);
		if (!previewContext) return {
			success: true,
			released: true
		};
		try {
			if (!await this.closeLocalSdkEditorForPreviewContext(previewContext, {
				closeSource: options.closeSource ?? "embedded-release",
				promptOnDirty: true,
				closeEditor: true,
				...options.reason ? { reason: options.reason } : {}
			})) return {
				success: false,
				released: false,
				reason: "blocked"
			};
		} catch (error) {
			windowLog.warn("[TencentDocsDocumentService] local SDK editor close threw during embedded context release", {
				documentResourceUri,
				error: toErrorMessage$3(error)
			});
			return {
				success: false,
				released: false,
				reason: "failed"
			};
		}
		const treatedAsReleased = this.options.contextManager.releaseFileContext(documentResourceUri) || !this.options.contextManager.getFilePreviewContext(documentResourceUri);
		if (treatedAsReleased) this.options.originalSaveGuard.releaseResource(documentResourceUri);
		return {
			success: treatedAsReleased,
			released: treatedAsReleased
		};
	}
	/**
	* 会话删除专用：强制丢弃式关闭单个 preview 的本地 SDK editor 并释放 context。
	*
	* 与 `releaseContext` 的差异：**不弹框、强制丢弃未保存改动**（force close）——会话被删除即视为用户已决意丢弃。
	* 用于 `evictSessionDocuments`，避免删除会话后 SDK editor 残留在 pool（资源泄漏）或其旧 dirty 状态
	* 串入同路径被新会话重开（§2.4 fresh 语义）。在线文档无本地 SDK editor，直接释放 context。
	*
	* 同样以 CLOSING 两段式包装：删除路径 fail-open（即便 SDK 关闭异常也继续释放 context、不阻塞会话删除），
	* 故 released 取决于 context 是否真正释放，再据此 drop OpenLease，保持 registry SSOT 一致。
	*/
	async forceReleaseContextDiscardingChanges(documentResourceUri) {
		const token = this.options.registry.beginPendingRelease(documentResourceUri, "closing");
		try {
			const result = await this.forceReleaseContextDiscardingChangesInner(documentResourceUri);
			if (token) this.options.registry.endPendingRelease(documentResourceUri, token, "closing", result.released);
			return result;
		} catch (error) {
			if (token) this.options.registry.endPendingRelease(documentResourceUri, token, "closing", false);
			throw error;
		}
	}
	/** force-discard 的真实拆除工作（force close SDK editor + 释放 context），由 wrapper 包 FSM 后调用。 */
	async forceReleaseContextDiscardingChangesInner(documentResourceUri) {
		const previewContext = this.options.contextManager.getFilePreviewContext(documentResourceUri);
		if (!previewContext) return { released: true };
		if (!isTencentOnlineFilePath(previewContext.filePath)) try {
			const fileId = await this.resolveSdkEditorFileIdForForceClose(previewContext);
			if (fileId) await this.forceCloseLocalSdkEditor(fileId, {
				documentResourceUri,
				filePath: previewContext.filePath,
				title: previewContext.title,
				source: "contextFileId"
			}, true);
		} catch (error) {
			windowLog.warn("[TencentDocsDocumentService] force-discard SDK editor close threw during session evict", {
				documentResourceUri,
				filePath: previewContext.filePath,
				error: toErrorMessage$3(error)
			});
		}
		const released = this.options.contextManager.releaseFileContext(documentResourceUri) || !this.options.contextManager.getFilePreviewContext(documentResourceUri);
		if (released) this.options.originalSaveGuard.releaseResource(documentResourceUri);
		return { released };
	}
	/**
	* 解析 preview context 绑定的本地 SDK editor `file_id`（force-discard 关闭用）。
	* 优先用 context 已回填的 fileId；缺失时按 filePath 查询 editor pool 精确匹配，查不到返回 undefined（无 editor 可关）。
	*/
	async resolveSdkEditorFileIdForForceClose(previewContext) {
		if (previewContext.fileId) return previewContext.fileId;
		const status = await this.options.docsService.getEditorStatusByFilePath(previewContext.filePath);
		if (!status.success) return;
		return this.options.localSdkEditorFileIds.matchByFilePath(status.openEditors, previewContext.filePath)?.file_id;
	}
	/**
	* 按创建顺序批量释放 embedded preview contexts，并在遇到 dirty 文档时逐个提示用户。
	*
	* 任一 context 被用户取消或保存失败都会立即中断批量流程，让调用方知道已释放数量和阻断点。
	*/
	async releaseContextsWithPrompt(options = {}) {
		const contexts = this.options.contextManager.getFilePreviewContexts({ ...options.sessionId ? { sessionId: options.sessionId } : {} }).sort((a, b) => a.createdAt - b.createdAt);
		let releasedCount = 0;
		for (const context of contexts) {
			const releaseResult = await this.releaseContext(context.documentResourceUri, { ...options.reason ? { reason: options.reason } : {} });
			if (releaseResult.success && releaseResult.released !== false) {
				releasedCount += 1;
				continue;
			}
			if (releaseResult.reason === "blocked") {
				windowLog.warn("[TencentDocsDocumentService] releaseEmbeddedPreviewContextsWithPrompt: blocked, abort", {
					blockedDocumentResourceUri: context.documentResourceUri,
					releasedCount,
					totalCount: contexts.length
				});
				return {
					success: false,
					releasedCount,
					totalCount: contexts.length,
					blockedDocumentResourceUri: context.documentResourceUri
				};
			}
			windowLog.warn("[TencentDocsDocumentService] releaseEmbeddedPreviewContextsWithPrompt: failed (non-blocked), abort", {
				documentResourceUri: context.documentResourceUri,
				releasedCount,
				totalCount: contexts.length,
				reason: releaseResult.reason
			});
			return {
				success: false,
				releasedCount,
				totalCount: contexts.length
			};
		}
		return {
			success: true,
			releasedCount,
			totalCount: contexts.length
		};
	}
	/**
	* iframe 内部准备切换/关闭某个 SDK 文档 tab 前的 dirty guard。
	*
	* 返回 `false` 表示用户取消、保存失败或原文档冲突被阻断，webview 应阻止本次内部 tab 行为。
	*/
	async confirmIframeInternalDocumentTabAction(documentResourceUri, targetFileId) {
		const normalizedTargetFileId = typeof targetFileId === "string" && targetFileId.trim() ? targetFileId.trim() : void 0;
		const previewContext = (normalizedTargetFileId ? this.options.contextManager.getFilePreviewContextByFileId(normalizedTargetFileId) : null) ?? (documentResourceUri ? this.options.contextManager.getFilePreviewContext(documentResourceUri) : null);
		if (!previewContext && !normalizedTargetFileId) return true;
		if (!normalizedTargetFileId && previewContext && isTencentOnlineFilePath(previewContext.filePath)) return true;
		const fileId = normalizedTargetFileId ?? previewContext?.fileId;
		if (!fileId) return true;
		const status = await this.options.docsService.getEditorStatusByFileId(fileId);
		if (!status.success || status.notFound) {
			windowLog.warn("[TencentDocsDocumentService] iframe internal tab dirty guard status unavailable", {
				documentResourceUri,
				targetFileId: targetFileId ?? "",
				filePath: previewContext?.filePath ?? "",
				fileId,
				status: status.status,
				message: status.message,
				error: status.error,
				notFound: status.notFound
			});
			return true;
		}
		const editor = status.openEditors?.find((item) => item.file_id === fileId);
		if (!editor) {
			windowLog.warn("[TencentDocsDocumentService] iframe internal tab dirty guard skipped: exact editor not found", {
				documentResourceUri,
				targetFileId: targetFileId ?? "",
				fileId,
				openEditorCount: status.openEditors?.length ?? 0
			});
			return true;
		}
		if (!editor.is_dirty) return true;
		const editorFilePath = editor.file_path || previewContext?.filePath || "";
		if (await this.runDirtyEditorCloseGuard(fileId, {
			documentResourceUri: previewContext?.documentResourceUri ?? documentResourceUri,
			filePath: editorFilePath,
			title: node_path.basename(editorFilePath),
			source: "embedded-release"
		}) === "blocked") {
			windowLog.warn("[TencentDocsDocumentService] iframe internal tab dirty guard blocked by save flow", {
				documentResourceUri,
				targetFileId: targetFileId ?? "",
				fileId,
				filePath: editorFilePath
			});
			return false;
		}
		return true;
	}
	/**
	* 对单个 SDK editor 执行底层 close 调用。
	*
	* `force=false` 时如果 SDK 返回 dirty，这里只把状态上抛，不弹框；显式释放和 release-if-clean 会分别决定后续处理策略。
	*/
	async forceCloseLocalSdkEditor(fileId, context, force) {
		const closeResult = await this.options.docsService.closeEditor(fileId, { force });
		if (closeResult.success && !closeResult.notFound) return "closed";
		if (closeResult.notFound) return "not-found";
		if (closeResult.status === 409 && closeResult.isDirty) {
			windowLog.info("[TencentDocsDocumentService] local SDK editor close blocked by dirty state", {
				...context,
				fileId,
				source: context.source,
				force,
				status: closeResult.status,
				message: closeResult.message
			});
			return "dirty";
		}
		windowLog.warn("[TencentDocsDocumentService] local SDK editor close failed during window close", {
			...context,
			fileId,
			source: context.source,
			force,
			status: closeResult.status,
			message: closeResult.message,
			error: closeResult.error
		});
		return "failed";
	}
	/**
	* 将 preview context 转换为 SDK editor close 请求。
	* 在线文档或缺失 context 直接视为可释放；本地文档必须继续解析 fileId 并走 dirty guard。
	*/
	async closeLocalSdkEditorForPreviewContext(previewContext, options) {
		return this.prepareLocalSdkEditorClose(previewContext, options);
	}
	/**
	* 解析 context 绑定的 SDK editor 并执行关闭准备。
	* context 缺 fileId 时按 filePath 查询 editor pool，命中后同步回填 context，保证后续保存/释放走同一个真实 fileId。
	*/
	async prepareLocalSdkEditorClose(previewContext, options) {
		if (!previewContext || isTencentOnlineFilePath(previewContext.filePath)) return true;
		let directFileId = previewContext.fileId;
		let knownEditor;
		let source = "contextFileId";
		if (!directFileId) {
			if (!(this.options.isSdkAlive?.() ?? true)) {
				windowLog.warn("[TencentDocsDocumentService] SDK died unexpectedly, releasing context (fail-open)", {
					filePath: previewContext.filePath,
					documentResourceUri: previewContext.documentResourceUri,
					reason: options.reason
				});
				return true;
			}
			const status = await this.options.docsService.getEditorStatusByFilePath(previewContext.filePath);
			if (!status.success) {
				windowLog.warn("[TencentDocsDocumentService] local SDK editor status failed during close fallback", {
					filePath: previewContext.filePath,
					error: status.error,
					status: status.status,
					message: status.message,
					reason: options.reason
				});
				if (!(this.options.isSdkAlive?.() ?? true) || options.reason === "app-quit") return true;
				return false;
			}
			knownEditor = this.options.localSdkEditorFileIds.matchByFilePath(status.openEditors, previewContext.filePath);
			directFileId = knownEditor?.file_id;
			source = "editorStatus";
			if (directFileId) this.options.contextManager.updateFileContextFileId(previewContext.documentResourceUri, directFileId);
			if (!directFileId) {
				const openEditorCount = status.openEditors?.length ?? 0;
				if (options.reason === "app-quit" && status.notFound && openEditorCount === 0) {
					windowLog.warn("[TencentDocsDocumentService] release orphan loading preview during app quit", {
						filePath: previewContext.filePath,
						documentResourceUri: previewContext.documentResourceUri,
						title: previewContext.title,
						createdAt: previewContext.createdAt,
						sessionId: previewContext.sessionId,
						closeSource: options.closeSource,
						reason: options.reason,
						promptOnDirty: options.promptOnDirty,
						closeEditor: options.closeEditor,
						status: status.status,
						message: status.message,
						notFound: status.notFound,
						poolSize: status.poolSize,
						openEditorCount
					});
					return true;
				}
				windowLog.warn("[TencentDocsDocumentService] local SDK editor file_id unresolved during close fallback", {
					filePath: previewContext.filePath,
					documentResourceUri: previewContext.documentResourceUri,
					openEditorCount
				});
				return false;
			}
		}
		if (directFileId) {
			if (!(this.options.isSdkAlive?.() ?? true)) {
				windowLog.warn("[TencentDocsDocumentService] SDK died unexpectedly before closeEditor, releasing context (fail-open)", {
					filePath: previewContext.filePath,
					documentResourceUri: previewContext.documentResourceUri,
					fileId: directFileId,
					reason: options.reason
				});
				return true;
			}
			const closeResult = await this.closeLocalSdkEditorWithDirtyGuard(directFileId, {
				documentResourceUri: previewContext.documentResourceUri,
				filePath: previewContext.filePath,
				title: previewContext.title,
				source,
				closeSource: options.closeSource,
				promptOnDirty: options.promptOnDirty,
				closeEditor: options.closeEditor
			}, knownEditor);
			if (closeResult === "closed") return true;
			if (closeResult === "blocked") return false;
		}
		return true;
	}
	/**
	* 根据 SDK editor 状态执行 close 或 dirty prompt。
	* `closeEditor=false` 时只做 dirty probe，不真正关闭 editor，供 iframe 内部 tab guard 复用。
	*/
	async closeLocalSdkEditorWithDirtyGuard(fileId, context, knownEditor) {
		const editor = knownEditor ?? await this.getLocalSdkEditorInfo(fileId, context);
		if (editor === "not-found") return "not-found";
		if (!editor) {
			if (!context.closeEditor) return "closed";
			const closeResult = await this.forceCloseLocalSdkEditor(fileId, context, !context.promptOnDirty);
			if (closeResult === "dirty" && context.promptOnDirty) return this.handleDirtyLocalSdkEditorClose(fileId, context);
			return closeResult === "dirty" ? "failed" : closeResult;
		}
		if (editor.is_dirty && context.promptOnDirty) return this.handleDirtyLocalSdkEditorClose(fileId, context);
		if (context.promptOnDirty && !context.closeEditor) {
			const probeResult = await this.forceCloseLocalSdkEditor(fileId, context, false);
			if (probeResult === "dirty") return this.handleDirtyLocalSdkEditorClose(fileId, context);
			return probeResult;
		}
		if (!context.closeEditor) return "closed";
		const closeResult = await this.forceCloseLocalSdkEditor(fileId, context, false);
		if (closeResult === "dirty" && context.promptOnDirty) return this.handleDirtyLocalSdkEditorClose(fileId, context);
		return closeResult === "dirty" ? "failed" : closeResult;
	}
	/**
	* 执行用户 dirty 决策后的保存/丢弃收尾。
	* 保存路径必须复用 `LocalDocumentOriginalSaveGuard`，保证 close 前保存也不会覆盖外部修改。
	*/
	async handleDirtyLocalSdkEditorClose(fileId, context) {
		const guardResult = await this.runDirtyEditorCloseGuard(fileId, {
			...context.documentResourceUri ? { documentResourceUri: context.documentResourceUri } : {},
			filePath: context.filePath,
			title: context.title,
			source: context.closeSource
		});
		if (guardResult === "blocked") return "blocked";
		if (!context.closeEditor) return "closed";
		const closeResult = await this.forceCloseLocalSdkEditor(fileId, context, guardResult === "discarded");
		return closeResult === "dirty" ? "failed" : closeResult;
	}
	/**
	* 串行化同一 fileId 的 dirty close 流程。
	* 并发 release / iframe tab guard 会复用同一个 Promise，避免同一文档弹多个保存确认框。
	*/
	runDirtyEditorCloseGuard(fileId, context) {
		const pending = this.dirtyEditorCloseGuardTasks.get(fileId);
		if (pending) return pending;
		const task = this.runDirtyEditorCloseGuardOnce(fileId, context).finally(() => {
			if (this.dirtyEditorCloseGuardTasks.get(fileId) === task) this.dirtyEditorCloseGuardTasks.delete(fileId);
		});
		this.dirtyEditorCloseGuardTasks.set(fileId, task);
		return task;
	}
	/**
	* 单次 dirty close 决策执行。
	* 用户选择保存时会先做写权限与原文档外部修改仲裁，再调用 SDK save；取消或失败均返回 `blocked`。
	*/
	async runDirtyEditorCloseGuardOnce(fileId, context) {
		const decision = await this.options.requestDirtyEditorCloseDecision({
			...context,
			fileId
		});
		if (decision.action === "cancel") return "blocked";
		if (decision.action === "discard") return "discarded";
		let targetFilePath = decision.action === "saveAs" ? decision.targetFilePath.trim() : "";
		if (decision.action === "save" || Boolean(targetFilePath) && this.options.normalizeFilePath(targetFilePath) === this.options.normalizeFilePath(context.filePath)) {
			const originalWriteAccess = await getLocalDocumentWriteAccess(context.filePath);
			if (!originalWriteAccess.writable) {
				windowLog.warn("[TencentDocsDocumentService] dirty close original save blocked: original file is not writable", {
					...context,
					fileId,
					reason: originalWriteAccess.reason,
					error: originalWriteAccess.error
				});
				return "blocked";
			}
		}
		const documentResourceUri = context.documentResourceUri ?? fileId;
		const originalSave = await this.options.originalSaveGuard.prepareOriginalSave({
			documentResourceUri,
			filePath: context.filePath,
			...targetFilePath ? { targetFilePath } : {},
			title: context.title
		});
		if (originalSave.action !== "save") windowLog.info("[TencentDocsDocumentService] dirty close original save guard decision", {
			documentResourceUri,
			filePath: context.filePath,
			action: originalSave.action
		});
		if (originalSave.action === "cancel") return "blocked";
		targetFilePath = originalSave.action === "saveAs" ? originalSave.targetFilePath : "";
		const saveFilePath = targetFilePath || context.filePath;
		this.options.originalSaveGuard.markSaveStarted(documentResourceUri);
		const saveResult = await this.options.docsService.saveEditor(fileId, { filePath: saveFilePath });
		if (!saveResult.success) {
			this.options.originalSaveGuard.markSaveFinished(documentResourceUri);
			windowLog.warn("[TencentDocsDocumentService] local SDK editor save failed before close", {
				...context,
				fileId,
				action: decision.action,
				targetFilePath: targetFilePath || void 0,
				status: saveResult.status,
				message: saveResult.message,
				error: saveResult.error
			});
			return "blocked";
		}
		if (originalSave.action === "save") await this.options.originalSaveGuard.refreshBaselineAfterSave(documentResourceUri, context.filePath);
		else this.options.originalSaveGuard.markSaveFinished(documentResourceUri);
		reportFileViewerSaveSuc(this.options.reportTelemetry, context.filePath);
		return "saved";
	}
	async getLocalSdkEditorInfo(fileId, context) {
		const status = await this.options.docsService.getEditorStatusByFileId(fileId);
		if (!status.success) {
			windowLog.warn("[TencentDocsDocumentService] local SDK editor status failed during close", {
				...context,
				fileId,
				status: status.status,
				message: status.message,
				error: status.error
			});
			return null;
		}
		if (status.notFound) return "not-found";
		return status.openEditors?.find((item) => item.file_id === fileId) ?? null;
	}
};
function toErrorMessage$3(error) {
	return error instanceof Error ? error.message : String(error);
}
//#endregion
//#region ../../packages/workbuddy-server/src/docs/preview/local-document-preview-manager.ts
/**
* 本地 embedded preview 生命周期管理。
*
* 只负责创建 WorkBuddy 文档上下文和 SDK iframe URL；上下文主键固定为
* `documentResourceUri=file://<normalizedPath>`，不再向 preview URL 注入私有 context 参数。
*/
var LocalDocumentPreviewManager = class LocalDocumentPreviewManager {
	constructor(options) {
		this.options = options;
	}
	static {
		this.RELEASING_RETRY_BUDGET = 3;
	}
	/**
	* 创建本地文档 embedded preview。
	*
	* registry.acquireOpenLease 是唯一闸门：OPENING 窗口的 single-flight、跨 session 冲突、以及 RELEASING/
	* CLOSING 期同 session 重开的 wait-and-chain 全部由它裁决（不在它之前用 findExistingPreview 短路——那会
	* 绕过 FSM）。各 outcome：acquired→本次发起真正打开；already-mine→复用进行中的 OPENING promise；already-active→
	* 复用既有 preview context；若同 session 只有 agent open_file 留下的 states-only OPEN 租约，
	* 先丢弃这条不可见租约并重试，让用户能重新打开同文件恢复可见 preview；
	* releasing-retry→await 进行中释放 settle 后重新 acquire 评估（见 RELEASING_RETRY_BUDGET），不新建第二个 editor；
	* conflict→跨 session 占用直接失败。
	*/
	async createEmbeddedPreview(filePath, options = {}) {
		const normalizedFilePath = this.options.normalizeFilePath(filePath);
		if (!normalizedFilePath) return {
			success: false,
			error: "filePath is required"
		};
		const documentResourceUri = fileResourceUriFromCanonicalPath(normalizedFilePath);
		const sessionId = options.sessionId?.trim();
		for (let attempt = 0; attempt <= LocalDocumentPreviewManager.RELEASING_RETRY_BUDGET; attempt++) {
			const acquisition = this.options.registry.acquireOpenLease(documentResourceUri, sessionId ?? "", () => this.createEmbeddedPreviewInternal(normalizedFilePath, documentResourceUri, options));
			switch (acquisition.outcome) {
				case "conflict": return {
					success: false,
					documentResourceUri,
					status: "conflict",
					existingSessionId: acquisition.existingSessionId,
					error: "Document is being opened in another session"
				};
				case "already-mine": return acquisition.task;
				case "already-active": {
					const existing = this.findExistingPreview(documentResourceUri, normalizedFilePath, sessionId);
					if (existing) return existing;
					if (await this.dropStatesOnlyOpenLease(documentResourceUri, normalizedFilePath, sessionId)) continue;
					return {
						success: false,
						documentResourceUri,
						error: "Document is currently open without a preview context"
					};
				}
				case "releasing-retry":
					await acquisition.task;
					continue;
				default: {
					const result = await acquisition.task;
					if (!result.success) await this.options.registry.releaseOpenLease(documentResourceUri, async () => ({ released: true }));
					return result;
				}
			}
		}
		windowLog.warn("[TencentDocsDocumentService] create embedded preview hit releasing-retry budget (fail-closed)", {
			documentResourceUri,
			retryBudget: LocalDocumentPreviewManager.RELEASING_RETRY_BUDGET,
			sessionId
		});
		return {
			success: false,
			documentResourceUri,
			error: "Document open contended by in-flight release (retry limit reached)"
		};
	}
	async createEmbeddedPreviewInternal(normalizedFilePath, documentResourceUri, options) {
		try {
			const rawPreviewUrl = await this.options.createPreviewUrl(normalizedFilePath);
			const fileType = detectDocumentFileType(normalizedFilePath) ?? void 0;
			const title = node_path.basename(normalizedFilePath);
			const createResult = this.options.contextManager.createFileContext({
				documentResourceUri,
				filePath: normalizedFilePath,
				fileType,
				fileExt: node_path.extname(normalizedFilePath).replace(/^\./, ""),
				title,
				previewUrl: rawPreviewUrl,
				sessionId: options.sessionId
			});
			if (createResult.status === "conflict") {
				windowLog.warn("[TencentDocsDocumentService] create embedded preview blocked by resource conflict", {
					documentResourceUri,
					filePath: normalizedFilePath,
					existingSessionId: createResult.existingSessionId,
					sessionId: options.sessionId
				});
				return {
					success: false,
					documentResourceUri,
					status: "conflict",
					existingSessionId: createResult.existingSessionId,
					error: "Document is already open in another session"
				};
			}
			await this.options.originalSaveGuard.trackResource(documentResourceUri, normalizedFilePath, title);
			const fileId = await this.options.localSdkEditorFileIds.resolveFileId(normalizedFilePath);
			if (fileId) this.options.contextManager.updateFileContextFileId(documentResourceUri, fileId);
			else {
				windowLog.info("[TencentDocsDocumentService] create embedded preview scheduled file_id hydration", {
					documentResourceUri,
					filePath: normalizedFilePath
				});
				this.options.hydrateFileIdWhenReady({
					documentResourceUri,
					filePath: normalizedFilePath,
					source: "embedded-preview"
				});
			}
			windowLog.info("[TencentDocsDocumentService] create embedded preview succeeded", {
				documentResourceUri,
				filePath: normalizedFilePath,
				fileType,
				sessionId: options.sessionId,
				hasFileId: Boolean(fileId),
				status: createResult.status
			});
			return {
				success: true,
				url: rawPreviewUrl,
				documentResourceUri,
				status: createResult.status
			};
		} catch (error) {
			const engineUnavailable = isTencentDocsEngineUnavailableError(error);
			windowLog.warn("[TencentDocsDocumentService] create embedded preview failed", {
				documentResourceUri,
				filePath: normalizedFilePath,
				error: toErrorMessage$2(error),
				engineUnavailable
			});
			return {
				success: false,
				documentResourceUri,
				error: `Preview failed: ${toErrorMessage$2(error)}`,
				...engineUnavailable ? { engineUnavailable: true } : {}
			};
		}
	}
	async dropStatesOnlyOpenLease(documentResourceUri, normalizedFilePath, sessionId) {
		if (this.options.registry.getState(documentResourceUri) !== "open") return false;
		windowLog.info("[TencentDocsDocumentService] drop states-only local preview lease before retry", {
			documentResourceUri,
			filePath: normalizedFilePath,
			sessionId
		});
		await this.options.registry.releaseOpenLease(documentResourceUri, async () => ({ released: true }));
		return this.options.registry.getState(documentResourceUri) !== "open";
	}
	findExistingPreview(documentResourceUri, normalizedFilePath, sessionId) {
		const existing = this.options.contextManager.getFilePreviewContext(documentResourceUri) ?? this.options.contextManager.findActiveFilePreviewContextByPath(normalizedFilePath);
		if (!existing?.previewUrl) return null;
		if (sessionId && existing.sessionId && existing.sessionId !== sessionId) return {
			success: false,
			documentResourceUri,
			status: "conflict",
			existingSessionId: existing.sessionId,
			error: "Document is already open in another session"
		};
		this.options.contextManager.activateFileContext(documentResourceUri);
		this.options.originalSaveGuard.trackResource(documentResourceUri, normalizedFilePath, existing.title);
		windowLog.info("[TencentDocsDocumentService] create embedded preview hit existing resource", {
			documentResourceUri,
			filePath: normalizedFilePath,
			sessionId
		});
		return toExistingPreviewResult(existing);
	}
};
function toExistingPreviewResult(existing) {
	return {
		success: true,
		url: existing.previewUrl,
		documentResourceUri: existing.documentResourceUri,
		status: "already-active",
		existingSessionId: existing.sessionId
	};
}
function toErrorMessage$2(error) {
	return error instanceof Error ? error.message : String(error);
}
//#endregion
//#region ../../packages/workbuddy-server/src/docs/preview/local-document-preview-release.ts
var RELEASE_IF_CLEAN_READY_RETRY_DELAYS_MS = [
	150,
	300,
	500
];
function wait$1(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms).unref?.();
	});
}
/**
* embedded preview 的 dirty 查询与温和释放管理。
*
* 只覆盖不会弹保存框的 keep-alive 路径：release-if-clean。
* 显式关闭/退出时的 dirty prompt 由 `LocalDocumentPreviewCloseManager` 处理；本类遇到不确定状态一律保守保留 context。
*/
var LocalDocumentPreviewReleaseManager = class {
	constructor(options) {
		this.options = options;
		this.releaseIfCleanTasks = /* @__PURE__ */ new Map();
	}
	/**
	* 温和淘汰（RELEASING 两段式 FSM 包装）：只在 SDK editor 当前为干净时释放，dirty 则保留 context 不弹框。
	*
	* 同一 documentResourceUri 的并发调用复用同一个 in-flight 任务，避免一路拆 context、另一路才 drop OpenLease 的短暂不一致。
	* 先同步把 OpenLease 占为 RELEASING（拿令牌），再执行温和释放；结束后回写 FSM：released→drop OpenLease；
	* 期间被 evict（令牌失配）→放弃 drop（§6.1）；抛异常→回 OPEN 保守保留（§6.2 E1，fail-closed）。同 session 重开走
	* wait-and-chain，等本次释放 settle 后重入（见 README §4.3）。
	* 该方法用于 renderer keep-alive pool 的 LRU 淘汰；它必须无 UI 副作用。
	*/
	async releaseIfClean(documentResourceUri, options = {}) {
		const existingTask = this.releaseIfCleanTasks.get(documentResourceUri);
		if (existingTask) return existingTask;
		const task = this.releaseIfCleanOnce(documentResourceUri, options);
		this.releaseIfCleanTasks.set(documentResourceUri, task);
		try {
			return await task;
		} finally {
			if (this.releaseIfCleanTasks.get(documentResourceUri) === task) this.releaseIfCleanTasks.delete(documentResourceUri);
		}
	}
	async releaseIfCleanOnce(documentResourceUri, options) {
		const token = this.options.registry.beginPendingRelease(documentResourceUri, "releasing");
		try {
			const result = await this.releaseIfCleanInner(documentResourceUri, options);
			if (token) this.options.registry.endPendingRelease(documentResourceUri, token, "releasing", !!result.released);
			return result;
		} catch (error) {
			if (token) this.options.registry.endPendingRelease(documentResourceUri, token, "releasing", false);
			throw error;
		}
	}
	/** release-if-clean 的真实拆除工作（dirty 探测 + clean 时释放 context），由 `releaseIfClean` 包 FSM 后调用。 */
	async releaseIfCleanInner(documentResourceUri, options = {}) {
		const previewContext = this.options.contextManager.getFilePreviewContext(documentResourceUri);
		if (!previewContext) return { released: true };
		if (isTencentOnlineFilePath(previewContext.filePath)) {
			const success = this.options.contextManager.releaseFileContext(documentResourceUri);
			if (success) this.options.originalSaveGuard.releaseResource(documentResourceUri);
			return success ? { released: true } : {
				released: false,
				reason: "failed",
				code: "context-not-found",
				error: "context not found"
			};
		}
		const resolveAndHydrateFileId = async () => {
			const resolvedFileId = await this.options.localSdkEditorFileIds.resolveFileId(previewContext.filePath);
			if (resolvedFileId) this.options.contextManager.updateFileContextFileId(documentResourceUri, resolvedFileId);
			return resolvedFileId;
		};
		let fileId = previewContext.fileId ?? await resolveAndHydrateFileId();
		if (!fileId && options.waitForReady) for (const delayMs of RELEASE_IF_CLEAN_READY_RETRY_DELAYS_MS) {
			await wait$1(delayMs);
			fileId = await resolveAndHydrateFileId();
			if (fileId) break;
		}
		if (fileId && this.options.hasDirtyCloseGuardTask(fileId)) {
			windowLog.info("[TencentDocsDocumentService] release-if-clean: dirty guard already in flight, treat as dirty", {
				documentResourceUri,
				fileId,
				filePath: previewContext.filePath
			});
			return {
				released: false,
				reason: "dirty"
			};
		}
		if (!fileId) {
			const statusByFilePath = await this.options.docsService.getEditorStatusByFilePath(previewContext.filePath);
			if (statusByFilePath.success && statusByFilePath.notFound) {
				const released = this.options.contextManager.releaseFileContext(documentResourceUri);
				if (released) this.options.originalSaveGuard.releaseResource(documentResourceUri);
				return released ? { released: true } : {
					released: false,
					reason: "failed",
					code: "context-not-found",
					error: "context not found"
				};
			}
			windowLog.warn("[TencentDocsDocumentService] release-if-clean: file_id unresolved, keep context", {
				documentResourceUri,
				filePath: previewContext.filePath,
				status: statusByFilePath.status,
				message: statusByFilePath.message,
				notFound: statusByFilePath.notFound,
				poolSize: statusByFilePath.poolSize
			});
			return {
				released: false,
				reason: "failed",
				code: "file-id-unresolved",
				canRetry: true,
				error: "file_id unresolved"
			};
		}
		const closeResult = await this.options.closeLocalSdkEditor(fileId, {
			filePath: previewContext.filePath,
			title: previewContext.title,
			source: "contextFileId"
		}, false);
		if (closeResult === "dirty") {
			windowLog.info("[TencentDocsDocumentService] release-if-clean: SDK reports dirty, keep context", {
				documentResourceUri,
				fileId,
				filePath: previewContext.filePath
			});
			return {
				released: false,
				reason: "dirty"
			};
		}
		if (closeResult === "failed") {
			windowLog.warn("[TencentDocsDocumentService] release-if-clean: SDK close failed", {
				documentResourceUri,
				fileId,
				filePath: previewContext.filePath
			});
			return {
				released: false,
				reason: "failed",
				code: "sdk-close-failed",
				error: "SDK close failed"
			};
		}
		const success = this.options.contextManager.releaseFileContext(documentResourceUri);
		if (success) this.options.originalSaveGuard.releaseResource(documentResourceUri);
		return success ? { released: true } : {
			released: false,
			reason: "failed",
			code: "context-not-found",
			error: "context not found"
		};
	}
};
//#endregion
//#region ../../packages/workbuddy-server/src/docs/preview/local-document-preview-save.ts
/**
* embedded preview 显式保存管理。
*
* 该类负责保存 API 的最终防线：定位 SDK editor、阻止只读原文档覆盖、调用 SDK save。
* 原路径保存必须经过 `LocalDocumentOriginalSaveGuard` 的保存前仲裁，避免覆盖外部应用已修改的原文件；
* 用户主动选择保存目标和 dirty close 决策仍分别由 RPC domain / close manager 处理。
*/
var LocalDocumentPreviewSaveManager = class {
	constructor(options) {
		this.options = options;
	}
	/**
	* 保存 embedded preview context，支持原路径保存和另存为目标路径。
	*
	* 保存原路径时会依次经过：context 定位 → fileId hydration → 写权限检查 → 原文档外部修改仲裁 → SDK save。
	* 另存为路径会绕过原文档覆盖冲突，但仍复用 SDK editor 的当前内容作为保存源。
	*
	* 当 `options.interactive === false`（静默自动保存）时：
	* - 只读文件直接返回 `{ skipped: 'read-only' }`，不弹框。
	* - 外部修改冲突直接返回 `{ skipped: 'external-change' }`，不弹框，不另存为。
	*/
	async saveContext(documentResourceUri, options = {}) {
		const previewContext = this.options.contextManager.getFilePreviewContext(documentResourceUri);
		if (!previewContext) return {
			success: false,
			documentResourceUri,
			error: "Document preview context not found"
		};
		if (isTencentOnlineFilePath(previewContext.filePath)) return {
			success: false,
			documentResourceUri,
			error: "Only local document preview can be saved"
		};
		let fileId = previewContext.fileId;
		if (!fileId) {
			fileId = await this.options.localSdkEditorFileIds.resolveFileId(previewContext.filePath);
			if (fileId) this.options.contextManager.updateFileContextFileId(documentResourceUri, fileId);
		}
		if (!fileId) return {
			success: false,
			documentResourceUri,
			filePath: previewContext.filePath,
			error: "Document editor is not ready for saving"
		};
		const interactive = options.interactive !== false;
		let targetFilePath = interactive ? options.targetFilePath?.trim() : void 0;
		if (!targetFilePath || this.options.normalizeFilePath(targetFilePath) === this.options.normalizeFilePath(previewContext.filePath)) {
			const originalWriteAccess = await getLocalDocumentWriteAccess(previewContext.filePath);
			if (!originalWriteAccess.writable) {
				windowLog.warn("[TencentDocsDocumentService] original save blocked: original file is not writable", {
					documentResourceUri,
					fileId,
					filePath: previewContext.filePath,
					reason: originalWriteAccess.reason,
					error: originalWriteAccess.error,
					interactive
				});
				if (!interactive) return {
					success: false,
					documentResourceUri,
					fileId,
					filePath: previewContext.filePath,
					skipped: "read-only"
				};
				return {
					success: false,
					documentResourceUri,
					fileId,
					filePath: previewContext.filePath,
					message: this.options.formatText("readOnlySavePreventedMessage"),
					error: this.options.formatText("readOnlySavePreventedMessage")
				};
			}
		}
		const originalSave = await this.options.originalSaveGuard.prepareOriginalSave({
			documentResourceUri,
			filePath: previewContext.filePath,
			...targetFilePath ? { targetFilePath } : {},
			title: previewContext.title,
			interactive
		});
		if (originalSave.action !== "save") windowLog.info("[TencentDocsDocumentService] embedded preview original save guard decision", {
			documentResourceUri,
			filePath: previewContext.filePath,
			action: originalSave.action,
			interactive
		});
		if (originalSave.action === "skip") return {
			success: false,
			documentResourceUri,
			fileId,
			filePath: previewContext.filePath,
			skipped: "external-change"
		};
		if (originalSave.action === "cancel") return {
			success: false,
			documentResourceUri,
			fileId,
			filePath: previewContext.filePath,
			error: this.options.formatText("saveCanceledMessage"),
			message: this.options.formatText("saveCanceledMessage")
		};
		targetFilePath = originalSave.action === "saveAs" ? originalSave.targetFilePath : "";
		this.options.originalSaveGuard.markSaveStarted(documentResourceUri);
		const saveResult = await this.options.docsService.saveEditor(fileId, { filePath: targetFilePath || previewContext.filePath });
		if (!saveResult.success) {
			this.options.originalSaveGuard.markSaveFinished(documentResourceUri);
			windowLog.warn("[TencentDocsDocumentService] embedded preview save failed", {
				documentResourceUri,
				fileId,
				filePath: previewContext.filePath,
				targetFilePath,
				status: saveResult.status,
				message: saveResult.message,
				error: saveResult.error
			});
			return {
				success: false,
				documentResourceUri,
				fileId,
				filePath: saveResult.filePath ?? previewContext.filePath,
				...targetFilePath ? { targetFilePath } : {},
				message: saveResult.message,
				error: saveResult.error ?? saveResult.message ?? "Document save failed"
			};
		}
		if (originalSave.action === "save") await this.options.originalSaveGuard.refreshBaselineAfterSave(documentResourceUri, previewContext.filePath);
		else this.options.originalSaveGuard.markSaveFinished(documentResourceUri);
		windowLog.info("[TencentDocsDocumentService] embedded preview saved", {
			documentResourceUri,
			fileId: saveResult.fileId ?? fileId,
			filePath: saveResult.filePath ?? previewContext.filePath,
			targetFilePath
		});
		if (interactive) reportFileViewerSaveSuc(this.options.reportTelemetry, previewContext.filePath);
		return {
			success: true,
			documentResourceUri,
			fileId: saveResult.fileId ?? fileId,
			filePath: saveResult.filePath ?? targetFilePath ?? previewContext.filePath,
			...targetFilePath ? { targetFilePath } : {},
			message: saveResult.message
		};
	}
};
//#endregion
//#region ../../packages/workbuddy-server/src/docs/preview/local-file-open-conflict.ts
/**
* 由 requestSessionId 发起的打开是否应阻断（产物 / 预览）。
* 与 SSOT 一致：owned-by-other 阻断；跨会话 owned-by-self 阻断；同会话 owned-by-self 放行。
*/
function shouldBlockLocalDocumentOpenAttempt(conflict, requestSessionId) {
	if (conflict.kind === "owned-by-other") return true;
	if (conflict.kind === "owned-by-self") {
		const ownerSessionId = conflict.sessionId;
		if (ownerSessionId && requestSessionId && ownerSessionId !== requestSessionId) return true;
	}
	return false;
}
//#endregion
//#region ../../packages/workbuddy-server/src/docs/preview/local-sdk-editor-file-id.ts
/**
* 负责本地 Tencent Docs SDK editor `file_id` 的路径匹配和同步解析。
*
* manager 仍保留延迟 hydration 调度语义；本类只封装“按规范化 filePath 精确匹配 SDK editor”的规则，
* 避免保存、释放和 dirty guard 分支重复实现同一匹配策略。
*/
var LocalSdkEditorFileIdResolver = class {
	constructor(options) {
		this.options = options;
	}
	/** 通过文件路径反查本地 SDK editor pool 中的 `file_id`。 */
	async resolveFileId(filePath) {
		const status = await this.options.docsService.getEditorStatusByFilePath(filePath);
		if (!status.success) {
			windowLog.warn("[TencentDocsDocumentService] local SDK editor status failed during context hydration", {
				filePath,
				error: status.error,
				status: status.status,
				message: status.message
			});
			return;
		}
		return this.matchByFilePath(status.openEditors, filePath)?.file_id;
	}
	/**
	* 只按规范化 filePath 精确匹配 SDK editor。
	* 不回退到 `openEditors[0]` 或 URL 派生 ID，避免保存/关闭错文档。
	*/
	matchByFilePath(openEditors, targetFilePath) {
		if (!openEditors?.length) return;
		const normalizedTargetPath = this.options.normalizeFilePath(targetFilePath);
		if (!normalizedTargetPath) return;
		return openEditors.find((editor) => this.options.normalizeFilePath(editor.file_path) === normalizedTargetPath);
	}
};
//#endregion
//#region ../../packages/workbuddy-server/src/docs/save/local-preview-text.ts
/**
* 本地预览 i18n 文案帮助函数。
* 以 `tencentDocs.localPreview.<key>` 为键取翻译模板，支持 `{{name}}` / `{name}` 插值。
*/
function formatLocalPreviewText$1(key, values = {}) {
	const template = getRendererTranslation(`tencentDocs.localPreview.${key}`);
	return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{{${name}}}`, value).replaceAll(`{${name}}`, value), template);
}
//#endregion
//#region ../../packages/workbuddy-server/src/docs/preview/native-host-decisions.ts
function createNativeHostDirtyEditorCloseDecision(platform) {
	return async (context) => requestNativeHostDirtyEditorCloseDecision(context, platform);
}
function createNativeHostOriginalFileConflictDecision(platform) {
	return (context) => requestNativeHostOriginalFileConflictDecision(context, platform);
}
function createNativeHostOriginalFileChangedNotifier(platform) {
	return (notification) => notifyNativeHostOriginalFileChanged(notification, platform);
}
async function requestNativeHostDirtyEditorCloseDecision(context, platform) {
	const title = context.title || node_path.basename(context.filePath);
	const allowCancel = context.source !== "open-eviction";
	const originalWriteAccess = await getLocalDocumentWriteAccess(context.filePath);
	if (!originalWriteAccess.writable) windowLog.info("[TencentDocsDocumentService] dirty close uses save-as only for read-only original", {
		fileId: context.fileId,
		filePath: context.filePath,
		reason: originalWriteAccess.reason,
		error: originalWriteAccess.error
	});
	while (true) {
		const buttons = buildLocalDocumentDirtyCloseChoices({
			isDarwin: platform.osPlatform === "darwin",
			canSaveOriginal: originalWriteAccess.writable,
			labels: {
				saveButton: formatLocalPreviewText$1("saveButton"),
				saveAsButton: formatLocalPreviewText$1("saveAsButton"),
				cancelButton: formatLocalPreviewText$1("cancelButton"),
				discardButton: formatLocalPreviewText$1("discardButton")
			}
		}).filter((item) => allowCancel || item.action !== "cancel");
		const defaultAction = originalWriteAccess.writable ? "save" : "saveAs";
		const defaultId = buttons.findIndex((item) => item.action === defaultAction);
		const cancelId = buttons.findIndex((item) => item.action === "cancel");
		const action = buttons[(await platform.showMessageBox({
			type: "warning",
			buttons: buttons.map((item) => item.label),
			defaultId: defaultId >= 0 ? defaultId : 0,
			...allowCancel && cancelId >= 0 ? { cancelId } : {},
			title: formatLocalPreviewText$1("dirtyCloseTitle"),
			message: formatLocalPreviewText$1("dirtyCloseMessage", { name: title }),
			detail: formatLocalPreviewText$1(originalWriteAccess.writable ? "dirtyCloseDetail" : "readOnlyDirtyCloseDetail"),
			noLink: true
		})).response]?.action ?? (allowCancel ? "cancel" : defaultAction);
		if (action === "discard") return { action: "discard" };
		if (action === "cancel") return { action: "cancel" };
		if (action === "save") return { action: "save" };
		const targetFilePath = await requestLocalDocumentSaveAsPath({
			sourceFilePath: context.filePath,
			title: formatLocalPreviewText$1("chooseSaveAsFileTitle"),
			dialogProvider: platform
		});
		if (!targetFilePath) {
			if (allowCancel) return { action: "cancel" };
			continue;
		}
		return {
			action: "saveAs",
			targetFilePath
		};
	}
}
async function requestNativeHostOriginalFileConflictDecision(context, platform) {
	const title = context.title || node_path.basename(context.filePath);
	const buttons = platform.osPlatform === "darwin" ? [
		{
			action: "cancel",
			label: formatLocalPreviewText$1("cancelButton")
		},
		{
			action: "overwrite",
			label: formatLocalPreviewText$1("overwriteButton")
		},
		{
			action: "saveAs",
			label: formatLocalPreviewText$1("saveAsButton")
		}
	] : [
		{
			action: "saveAs",
			label: formatLocalPreviewText$1("saveAsButton")
		},
		{
			action: "overwrite",
			label: formatLocalPreviewText$1("overwriteButton")
		},
		{
			action: "cancel",
			label: formatLocalPreviewText$1("cancelButton")
		}
	];
	windowLog.warn("[TencentDocsDocumentService] show original file conflict dialog", {
		documentResourceUri: context.documentResourceUri,
		filePath: context.filePath,
		hasBaseline: context.baseline !== null,
		hasCurrent: context.current !== null
	});
	const result = await platform.showMessageBox({
		type: "warning",
		buttons: buttons.map((item) => item.label),
		defaultId: buttons.findIndex((item) => item.action === "saveAs"),
		cancelId: buttons.findIndex((item) => item.action === "cancel"),
		title: formatLocalPreviewText$1("originalChangedConflictTitle"),
		message: formatLocalPreviewText$1("originalChangedConflictMessage", { name: title }),
		detail: formatLocalPreviewText$1("originalChangedConflictDetail"),
		noLink: true
	});
	const action = buttons[result.response]?.action ?? "cancel";
	windowLog.info("[TencentDocsDocumentService] original file conflict dialog resolved", {
		documentResourceUri: context.documentResourceUri,
		filePath: context.filePath,
		response: result.response,
		action
	});
	if (action !== "saveAs") return { action };
	const targetFilePath = await requestLocalDocumentSaveAsPath({
		sourceFilePath: context.filePath,
		title: formatLocalPreviewText$1("chooseSaveAsFileTitle"),
		dialogProvider: platform
	});
	if (!targetFilePath) return { action: "cancel" };
	return {
		action: "saveAs",
		targetFilePath
	};
}
async function notifyNativeHostOriginalFileChanged(notification, platform) {
	const title = notification.title || node_path.basename(notification.filePath);
	const isClean = notification.isDirty === false;
	const messageKey = isClean ? "originalChangedCleanNotificationBody" : "originalChangedNotificationBody";
	const detailKey = isClean ? "originalChangedCleanNotificationDetail" : "originalChangedDirtyNotificationDetail";
	try {
		windowLog.warn("[TencentDocsDocumentService] show original file changed notification dialog", {
			documentResourceUri: notification.documentResourceUri,
			filePath: notification.filePath,
			isDirty: notification.isDirty,
			messageKey
		});
		await platform.showMessageBox({
			type: "warning",
			buttons: [formatLocalPreviewText$1("acknowledgeButton")],
			defaultId: 0,
			cancelId: 0,
			title: formatLocalPreviewText$1("originalChangedNotificationTitle"),
			message: formatLocalPreviewText$1(messageKey, { name: title }),
			detail: formatLocalPreviewText$1(detailKey),
			noLink: true
		});
		windowLog.info("[TencentDocsDocumentService] original file changed notification dialog dismissed", {
			documentResourceUri: notification.documentResourceUri,
			filePath: notification.filePath,
			messageKey
		});
	} catch (error) {
		windowLog.warn("[TencentDocsDocumentService] original file changed message box failed", {
			documentResourceUri: notification.documentResourceUri,
			filePath: notification.filePath,
			error: error instanceof Error ? error.message : String(error)
		});
	}
}
//#endregion
//#region ../../packages/workbuddy-server/src/docs/preview/original-file-conflict-decision.ts
/**
* 默认原文档外部修改冲突决策：保存前要求用户选择另存为、继续覆盖或取消。
*/
async function defaultRequestOriginalFileConflictDecision(context, dialogOptions) {
	const dialogProvider = dialogOptions?.dialogProvider;
	const title = context.title || node_path.default.basename(context.filePath);
	if (!dialogProvider) {
		windowLog.warn("[TencentDocsDocumentService] original file conflict blocked without host dialog provider", {
			documentResourceUri: context.documentResourceUri,
			filePath: context.filePath,
			hasBaseline: context.baseline !== null,
			hasCurrent: context.current !== null
		});
		return { action: "cancel" };
	}
	const buttons = process.platform === "darwin" ? [
		{
			action: "cancel",
			label: formatLocalPreviewText("cancelButton")
		},
		{
			action: "overwrite",
			label: formatLocalPreviewText("overwriteButton")
		},
		{
			action: "saveAs",
			label: formatLocalPreviewText("saveAsButton")
		}
	] : [
		{
			action: "saveAs",
			label: formatLocalPreviewText("saveAsButton")
		},
		{
			action: "overwrite",
			label: formatLocalPreviewText("overwriteButton")
		},
		{
			action: "cancel",
			label: formatLocalPreviewText("cancelButton")
		}
	];
	const options = {
		type: "warning",
		buttons: buttons.map((item) => item.label),
		defaultId: buttons.findIndex((item) => item.action === "saveAs"),
		cancelId: buttons.findIndex((item) => item.action === "cancel"),
		title: formatLocalPreviewText("originalChangedConflictTitle"),
		message: formatLocalPreviewText("originalChangedConflictMessage", { name: title }),
		detail: formatLocalPreviewText("originalChangedConflictDetail"),
		noLink: true
	};
	windowLog.warn("[TencentDocsDocumentService] show original file conflict dialog", {
		documentResourceUri: context.documentResourceUri,
		filePath: context.filePath,
		hasBaseline: context.baseline !== null,
		hasCurrent: context.current !== null
	});
	const result = await dialogProvider.showMessageBox(options);
	const action = buttons[result.response]?.action ?? "cancel";
	windowLog.info("[TencentDocsDocumentService] original file conflict dialog resolved", {
		documentResourceUri: context.documentResourceUri,
		filePath: context.filePath,
		response: result.response,
		action
	});
	if (action !== "saveAs") return { action };
	const targetFilePath = await requestLocalDocumentSaveAsPath({
		sourceFilePath: context.filePath,
		title: formatLocalPreviewText("chooseSaveAsFileTitle"),
		dialogProvider
	});
	if (!targetFilePath) return { action: "cancel" };
	return {
		action: "saveAs",
		targetFilePath
	};
}
/**
* 原文档被其他应用修改时的早提示；最终是否覆盖仍由保存前冲突弹窗决定。
*
* 使用附着主窗口的 message box，而不是系统通知：用户正在前台预览时，系统通知可能被权限或勿扰模式吞掉，
* 会让“请刷新查看最新内容”的提示看起来失效。
*/
async function defaultNotifyOriginalFileChanged(notification, dialogOptions) {
	const dialogProvider = dialogOptions?.dialogProvider;
	if (!dialogProvider) {
		windowLog.warn("[TencentDocsDocumentService] original file changed without host dialog provider", {
			documentResourceUri: notification.documentResourceUri,
			filePath: notification.filePath,
			isDirty: notification.isDirty
		});
		return;
	}
	const title = notification.title || node_path.default.basename(notification.filePath);
	const isClean = notification.isDirty === false;
	const messageKey = isClean ? "originalChangedCleanNotificationBody" : "originalChangedNotificationBody";
	const detailKey = isClean ? "originalChangedCleanNotificationDetail" : "originalChangedDirtyNotificationDetail";
	try {
		const options = {
			type: "warning",
			buttons: [formatLocalPreviewText("acknowledgeButton")],
			defaultId: 0,
			cancelId: 0,
			title: formatLocalPreviewText("originalChangedNotificationTitle"),
			message: formatLocalPreviewText(messageKey, { name: title }),
			detail: formatLocalPreviewText(detailKey),
			noLink: true
		};
		windowLog.warn("[TencentDocsDocumentService] show original file changed notification dialog", {
			documentResourceUri: notification.documentResourceUri,
			filePath: notification.filePath,
			isDirty: notification.isDirty,
			messageKey
		});
		await dialogProvider.showMessageBox(options);
		windowLog.info("[TencentDocsDocumentService] original file changed notification dialog dismissed", {
			documentResourceUri: notification.documentResourceUri,
			filePath: notification.filePath,
			messageKey
		});
	} catch (error) {
		windowLog.warn("[TencentDocsDocumentService] original file changed message box failed", {
			documentResourceUri: notification.documentResourceUri,
			filePath: notification.filePath,
			error: error instanceof Error ? error.message : String(error)
		});
	}
}
function formatLocalPreviewText(key, values = {}) {
	const template = getRendererTranslation(`tencentDocs.localPreview.${key}`);
	return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{{${name}}}`, value).replaceAll(`{${name}}`, value), template);
}
//#endregion
//#region ../../packages/workbuddy-server/src/docs/prompt/tencent-docs-prompt-local-paths.ts
/**
* Tencent Docs Local routing 的纯文本路径识别：
* text / input_text 仅识别明确绝对路径（file://、引号、无引号），
* 裸文件名不触发；结构化 resource_link 统一由 resolveFileReferencePaths 处理。
*/
/**
* 白名单扩展名的正则 alternation（不含点号），供文本扫描锚定路径终点。
* 放开空格后不能再靠「遇到空白就停」；必须靠已知 Office 扩展名收口，
* 否则会把 `/Downloads 里的 report.docx` 误吞成一条假路径。
*/
var OFFICE_EXTENSION_ALTERNATION = TENCENT_DOCS_AI_FILE_EXTENSION_WHITELIST.map((ext) => ext.replace(/^\./, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
/** 匹配 `file://...` URI；字面空格非法，空格应已是 `%20`。 */
var FILE_URI_PATTERN = /file:\/\/[^\s"'<>]+/g;
/** POSIX `/` 或 Windows 盘符 `C:/` / `C:\` 开头的本地路径前缀。 */
var LOCAL_PATH_DRIVE_OR_POSIX_PREFIX = String.raw`(?:[A-Za-z]:[\\/]|/)`;
/** 双引号包裹的本地绝对路径，支持可选 `@` 前缀（如 `@"/abs/path/file.pptx"`）。 */
var DOUBLE_QUOTED_LOCAL_PATH_PATTERN = new RegExp(String.raw`@?"(${LOCAL_PATH_DRIVE_OR_POSIX_PREFIX}[^"\r\n]+)"`, "g");
/** 单引号包裹的本地绝对路径，支持可选 `@` 前缀。 */
var SINGLE_QUOTED_LOCAL_PATH_PATTERN = new RegExp(String.raw`@?'(${LOCAL_PATH_DRIVE_OR_POSIX_PREFIX}[^'\r\n]+)'`, "g");
/**
* 无引号的本地绝对路径。
*
* 允许路径内空白 / 全角标点（`word_env_001 (4).docx`、`季度报告（终版）.pptx`），
* 终点锚定在白名单 Office 扩展名 + 右侧边界哨。含空白的候选还需
* {@link defaultLocalPathExists} 校验，压掉
* `/Downloads 里的 report.docx` 这类跨中文的假阳性。
*/
var UNQUOTED_LOCAL_PATH_PATTERN = new RegExp(String.raw`(?:^|[\s([{（【])@?` + String.raw`(${LOCAL_PATH_DRIVE_OR_POSIX_PREFIX}[^"'<>\r\n]*?\.(?:${OFFICE_EXTENSION_ALTERNATION}))` + String.raw`(?=$|[\s)\]}）】，。；;：:!?！？])`, "gi");
/** 单个用户文本块超过此长度时截断，避免正则在异常超长输入上空转。 */
var MAX_PROMPT_STRING_LENGTH = 16384;
/** 幂等追加：仅当 `filePath` 不在 `seen` 中时才写入 `target`，顺序不变。 */
function addUniquePath(target, seen, filePath) {
	if (seen.has(filePath)) return;
	seen.add(filePath);
	target.push(filePath);
}
/** 判断字符串是否是 Windows 绝对路径（如 `C:\...` 或 `C:/...`）。 */
function isWindowsAbsoluteLocalPath(value) {
	return /^[A-Za-z]:[\\/]/.test(value);
}
async function defaultLocalPathExists(filePath) {
	try {
		await (0, node_fs_promises.access)(filePath);
		return true;
	} catch {
		return false;
	}
}
/**
* 将正则匹配到的原始字符串规范化为可用的本地绝对路径：
* - 末尾中英文标点剥除（防止路径尾部沾带句号/逗号）；
* - `file://` URI 经 `fileURLToPath` 转换为系统路径；
* - 非绝对路径（相对路径、URL 等）返回 `undefined`。
*/
function normalizeMentionedLocalPath(value) {
	const trimmed = value.trim().replace(/[，。；;：:,.!?！？]+$/u, "");
	if (!trimmed) return;
	if (trimmed.startsWith("file://")) try {
		return (0, node_url.fileURLToPath)(trimmed);
	} catch {
		return;
	}
	if (trimmed.startsWith("/") || isWindowsAbsoluteLocalPath(trimmed)) return trimmed;
}
/**
* 从一个被前置伪路径吞长的候选中找后续绝对路径起点。
*
* 只把“左侧是空白/括号等边界”的 `/` 或 Windows 盘符视为新起点，
* 不会把 `/Users/foo/report.docx` 内部的路径分隔符拆成多个候选。
*/
function getNestedAbsolutePathCandidates(value) {
	const candidates = [];
	for (const match of value.matchAll(/[\s([{（【]@?((?:[A-Za-z]:[\\/]|\/))/g)) {
		const prefix = match[1];
		if (!prefix || match.index === void 0) continue;
		const prefixOffset = match[0].lastIndexOf(prefix);
		candidates.push(value.slice(match.index + prefixOffset));
	}
	return candidates;
}
/**
* @param requireExistsIfWhitespace 仅无引号通道开启。含空白时必须能落到真实文件，
* 否则 `/Downloads 里的 report.docx` 会被正则吞成假路径。引号通道不查盘——
* 用户显式引用的路径即使尚未落盘也应触发 routing。
*/
async function acceptMentionedLocalPath(filePath, pathExists, requireExistsIfWhitespace, forceExists = false) {
	if (!isTencentDocsAiServiceFilePath(filePath)) return false;
	if (!forceExists && (!requireExistsIfWhitespace || !/\s/.test(filePath))) return true;
	return pathExists(filePath);
}
/**
* 只收集用户正文块。resource_link 的 uri / _meta 由结构化通道处理，
* 这里不递归扫描，避免把展示 metadata 或远端资源误判成本地路径。
*/
function collectUserTextCandidates(prompt) {
	if (!Array.isArray(prompt)) return [];
	const strings = [];
	for (const block of prompt) {
		if (!block || typeof block !== "object") continue;
		const { type, text } = block;
		if (type !== "text" && type !== "input_text" || typeof text !== "string") continue;
		strings.push(text.length > MAX_PROMPT_STRING_LENGTH ? text.slice(0, MAX_PROMPT_STRING_LENGTH) : text);
	}
	return strings;
}
/**
* Tencent Docs Local routing 的纯文本兜底：补齐用户用
* `@"/absolute/path/file.pptx"` 或直接粘贴绝对路径指定本地 Office 文件的场景。
*
* 这里不写入通用 `<attached_files>`，避免影响 WorkBuddy 主流程；只扫描
* `text` / `input_text` 的正文，不读取 resource_link 或 metadata。
*
* 含空白的无引号路径会做存在性校验，避免放开空格后把中文叙述吞进路径。
* 裸文件名（如 `report.docx`）不属于可靠文件引用，明确不处理。
*/
async function getTextMentionedLocalOfficeFilePaths(prompt, options) {
	const pathExists = options?.pathExists ?? defaultLocalPathExists;
	const result = [];
	const seen = /* @__PURE__ */ new Set();
	const tryAdd = async (raw, requireExistsIfWhitespace, forceExists = false) => {
		const filePath = normalizeMentionedLocalPath(raw);
		if (!filePath || !await acceptMentionedLocalPath(filePath, pathExists, requireExistsIfWhitespace, forceExists)) return false;
		addUniquePath(result, seen, filePath);
		return true;
	};
	for (const text of collectUserTextCandidates(prompt)) {
		for (const match of text.matchAll(FILE_URI_PATTERN)) await tryAdd(match[0], false);
		for (const match of text.matchAll(DOUBLE_QUOTED_LOCAL_PATH_PATTERN)) await tryAdd(match[1], false);
		for (const match of text.matchAll(SINGLE_QUOTED_LOCAL_PATH_PATTERN)) await tryAdd(match[1], false);
		for (const match of text.matchAll(UNQUOTED_LOCAL_PATH_PATTERN)) {
			const nestedCandidates = getNestedAbsolutePathCandidates(match[1]);
			if (await tryAdd(match[1], true, nestedCandidates.length > 0)) continue;
			for (const fallback of nestedCandidates) if (await tryAdd(fallback, true, true)) break;
		}
	}
	return result;
}
/**
* 合并两个路径数组并去重（按首次出现顺序，`first` 优先）。
* 用于将 chip 路径与纯文本提及路径合并成统一的 routing 候选集。
*/
function mergeUniquePaths(first, second) {
	const result = [];
	const seen = /* @__PURE__ */ new Set();
	for (const filePath of [...first, ...second]) addUniquePath(result, seen, filePath);
	return result;
}
//#endregion
//#region ../../packages/workbuddy-server/src/docs/prompt/turn-document-routing-context.ts
/**
* 本地 MCP 工具可用的 file_id：依次遍历候选值，跳过为空的和 local preview globalPadId（路径 md5），
* 返回第一个有效 id，或 undefined（表示本轮尚无可用 file_id）。
*/
function resolveToolUsableLocalFileId(filePath, ...candidates) {
	if (!filePath) return;
	for (const candidate of candidates) {
		const normalized = candidate?.trim();
		if (!normalized || isLocalPreviewGlobalPadId(filePath, normalized)) continue;
		return normalized;
	}
}
/** 路径是否属于 Tencent Docs 本地入口品类（白名单扩展名，不强制绝对路径）。 */
function isTencentDocsLocalEntryFilePath(filePath) {
	return !!filePath && hasTencentDocsAiServiceExtension(filePath);
}
/**
* 推断 `activeDocumentFileId` 实际来自哪一信号源，结果仅用于日志 / 监控。
*
* 调用时 `activeDocumentFileId` 已由调用方计算完毕；这里仅做逆向溯源，
* 按相同优先级重走一遍判断逻辑，确保溯源结果与仲裁结果一致。
*/
function resolveActiveDocumentFileIdSource(activeDocumentFilePath, activeDocumentFileId, activeSelection, activeFileContext) {
	if (activeDocumentFileId) {
		if (activeSelection?.fileId && resolveToolUsableLocalFileId(activeDocumentFilePath, activeSelection.fileId)) return "selection";
		if (activeFileContext?.fileId && activeFileContext.filePath === activeDocumentFilePath && resolveToolUsableLocalFileId(activeDocumentFilePath, activeFileContext.fileId)) return "activeFileContext";
		return "activeDocumentContext";
	}
	if (activeSelection?.fileId && isLocalPreviewGlobalPadId(activeDocumentFilePath ?? "", activeSelection.fileId)) return "selection-preview-global-pad-skipped";
	return "missing";
}
/**
* 根据 `filePath` 构造 routing 包所需的 `ActiveDocument`。
*
* - `filePath` 为 `tdoc://` URI 时，视为在线文档，返回 `type: 'remote'`（兼容选区携带在线路径的场景）；
* - 其余情况返回 `type: 'local'`，`fileId` 可选注入（未注册进 SDK editor pool 时为空）。
*/
function buildActiveLocalDocument(filePath, fileId, fileType) {
	if (!filePath) return;
	const onlineFileId = extractTencentOnlineFileId(filePath);
	if (onlineFileId) return {
		type: "remote",
		doc: {
			fileId: fileId ?? onlineFileId,
			title: fileId ?? onlineFileId,
			...fileType ? { fileType } : {}
		}
	};
	return {
		type: "local",
		filePath,
		...fileId ? { fileId } : {}
	};
}
/**
* 将 `ActiveOnlineDocumentInfo` 转换为 routing 包的 `ActiveDocument`（`type: 'remote'`）。
* `title` 缺失时退到 `fileId`（routing 包要求 `title` 必填）。
*/
function buildActiveOnlineDocumentFromInfo(info) {
	return {
		type: "remote",
		doc: {
			fileId: info.fileId,
			title: info.title ?? info.fileId,
			...info.fileExt ? { fileExt: info.fileExt } : {},
			...info.fileType ? { fileType: info.fileType } : {},
			...info.url ? { url: info.url } : {}
		}
	};
}
/**
* 聚合本轮 Tencent Docs routing 所需的 host 侧文档上下文，执行以下三项核心操作：
*
* 1. **多源 filePath/fileId 仲裁**：从 selection、activeFileContext、activeDocumentContext
*    三个信号源按优先级选出本轮的 `activeDocumentFilePath` 和 `activeDocumentFileId`，
*    严格保证 filePath 与 fileId 同源，避免多 session 间的 id 错配。
* 2. **turn 租约登记**：把本轮用到的本地文档路径写入 `DocumentLeaseRegistry`，
*    作为跨 session 打开冲突检测的早期信号。
* 3. **ActiveDocument 构造**：在线文档优先（`type: 'remote'`）；无在线文档时，
*    基于仲裁结果构造本地或 tdoc:// 的 `ActiveDocument` 传给 routing 包。
*
* `deps` 对应 `TencentDocsDocumentService` 上的方法子集，单元测试可直接 stub；
* `input` 来自 `AdditionalDataSection.render()` 中已完成解析的 prompt 数据。
*/
function buildTurnDocumentRoutingContext(deps, input) {
	const { sessionId, activeSelection, routingFilePaths, selectionFileType } = input;
	let activeFileContextRaw = null;
	try {
		activeFileContextRaw = deps.getActiveFileContextInfo(sessionId);
	} catch {}
	const activeFileContext = activeFileContextRaw ?? void 0;
	let activeDocumentContextRaw = null;
	try {
		activeDocumentContextRaw = deps.getActiveDocumentContext(sessionId);
	} catch {}
	const activeDocumentContextInfo = activeDocumentContextRaw ? (() => {
		const selectionFileId = typeof activeDocumentContextRaw.selection?.fileId === "string" ? activeDocumentContextRaw.selection.fileId : void 0;
		const fileId = resolveToolUsableLocalFileId(activeDocumentContextRaw.filePath, activeDocumentContextRaw.fileId, selectionFileId);
		return {
			filePath: activeDocumentContextRaw.filePath,
			fileType: activeDocumentContextRaw.fileType,
			...fileId ? { fileId } : {}
		};
	})() : void 0;
	const tencentDocsRoutingFilePaths = routingFilePaths.filter(isTencentDocsLocalEntryFilePath);
	const activeDocumentFilePath = activeSelection?.filePath ?? activeFileContext?.filePath ?? activeDocumentContextInfo?.filePath;
	const activeDocumentFileId = resolveToolUsableLocalFileId(activeDocumentFilePath, activeSelection?.fileId, activeFileContext && activeFileContext.filePath === activeDocumentFilePath ? activeFileContext.fileId : void 0, activeDocumentContextInfo && activeDocumentContextInfo.filePath === activeDocumentFilePath ? activeDocumentContextInfo.fileId : void 0);
	const activeDocumentFileIdSource = resolveActiveDocumentFileIdSource(activeDocumentFilePath, activeDocumentFileId, activeSelection, activeFileContext);
	const tencentDocsActiveDocumentFilePath = isTencentDocsLocalEntryFilePath(activeDocumentFilePath) ? activeDocumentFilePath : void 0;
	const pathsToReserve = mergeUniquePaths(tencentDocsRoutingFilePaths, tencentDocsActiveDocumentFilePath ? [tencentDocsActiveDocumentFilePath] : []);
	if (sessionId && pathsToReserve.length > 0) try {
		deps.reserveLocalDocumentsForTurn(sessionId, pathsToReserve);
	} catch {}
	let activeOnlineDocumentInfo = null;
	try {
		activeOnlineDocumentInfo = deps.getActiveOnlineDocumentInfo(sessionId);
	} catch {}
	const activeOnlineDocument = activeOnlineDocumentInfo ? buildActiveOnlineDocumentFromInfo(activeOnlineDocumentInfo) : void 0;
	return {
		activeFileContext,
		activeDocumentContext: activeDocumentContextInfo,
		activeDocumentFilePath,
		activeDocumentFileId,
		activeDocumentFileIdSource,
		tencentDocsActiveDocumentFilePath,
		tencentDocsRoutingFilePaths,
		activeOnlineDocument,
		activeLocalDocument: activeOnlineDocument ? void 0 : buildActiveLocalDocument(activeSelection?.filePath ?? tencentDocsActiveDocumentFilePath, tencentDocsActiveDocumentFilePath ? activeDocumentFileId : void 0, selectionFileType ?? activeDocumentContextInfo?.fileType)
	};
}
//#endregion
//#region ../../packages/workbuddy-server/src/session/file-watch-service.ts
/**
* FileWatchService
*
* 反向订阅式文件监听服务。
*
* Renderer 在打开预览时主动告知 app-server "我在看哪个文件"，
* app-server 为该文件单独建立 watcher，文件变更时直接推给订阅方；
* Renderer 关闭/切换预览时取消订阅。
*
* - 主路径：fs.watch(filePath) 单文件监听（变更/rename 立即触发）
* - 兜底：fs.watchFile(filePath) 轮询（处理原子写、文件还未生成的场景）
*
* 不引入 chokidar 等三方依赖，沿用项目现有风格（与 MediaArtifactService 一致）。
*/
/**
* 轮询间隔（ms）—— fs.watch 的兜底。
*
* 从 1000 降到 500：Windows 下 fs.watch 对原子写（rename）经常静默失效，
* 轮询是唯一可靠兜底，间隔太长会让"AI 改完 → 右侧刷新"的延迟明显。
* watch 未失效时轮询几乎不会触发 emit（会被签名去重），额外开销可忽略。
*/
var POLL_INTERVAL_MS = 500;
/**
* primary watcher 健康自愈检查间隔（ms）。
*
* Windows 下 fs.watch 在原子写 rename 后可能**收不到任何事件**就失效
* （macOS/Linux 通常能收到 rename 事件触发重建，Windows 不保证）。
* 定期检查 watcher 是否已丢失，丢失则重建并补发期间变更，
* 是消除"概率性不刷新"的关键（原因 A）。
*/
var WATCHER_HEALTH_CHECK_MS = 1e3;
/**
* change 事件去重窗口（ms）。
*
* fs.watch + fs.watchFile 经常对同一次变更各触发一次，需要去重。
* 从 250 降到 120：过大的窗口会把"连续两次快速修改"误合并成一次，
* 导致第二次变更被吞（原因 C）。120ms 足够覆盖同一变更的重复回调。
*/
var CHANGE_DEDUPE_MS = 120;
/**
* fs.watch 在某些场景下不可靠：
* - 文件还没创建：watch 会直接抛 ENOENT
* - 编辑器原子写（写临时文件 + rename）：rename 后原 watcher 失效
*   （Windows 尤其严重，可能连 rename 事件都收不到）
*
* 所以每个订阅都同时挂上 fs.watchFile 轮询兜底 + 定期健康检查自愈。
*/
var FileWatchService = class {
	constructor(pushEvent, options = {}) {
		this.pushEvent = pushEvent;
		this.subscriptions = /* @__PURE__ */ new Map();
		this.nextId = 1;
		this.disposed = false;
		this.healthCheckTimer = null;
		this.logger = options.logger ?? console;
		this.healthCheckIntervalMs = options.healthCheckIntervalMs ?? WATCHER_HEALTH_CHECK_MS;
	}
	/**
	* 仅供测试：同步驱动一次健康自愈检查，避免依赖真实定时器 + fs I/O 混用。
	*/
	runHealthCheckForTest() {
		this.runHealthCheck();
	}
	/**
	* 订阅一个文件路径。
	* @param filePath 绝对路径
	* @returns 订阅 ID（用于后续 unsubscribe；renderer 也用这个 id 拼 channel）
	*/
	subscribe(filePath) {
		if (this.disposed) throw new Error("FileWatchService disposed");
		if (!filePath || !path.isAbsolute(filePath)) throw new Error(`FileWatchService.subscribe: filePath must be absolute, got: ${String(filePath)}`);
		const id = `fw-${this.nextId++}`;
		const entry = {
			id,
			filePath,
			watcher: null,
			pollingActive: false,
			lastEmitAt: 0,
			lastMtimeMs: 0,
			lastSize: -1
		};
		this.subscriptions.set(id, entry);
		this.refreshSignature(entry);
		this.attachPrimaryWatcher(entry);
		this.attachPollingWatcher(entry);
		this.ensureHealthCheckTimer();
		this.logger.info("[FileWatchService] subscribed", {
			id,
			filePath
		});
		return id;
	}
	/**
	* 取消订阅。多次调用幂等。
	*/
	unsubscribe(id) {
		const entry = this.subscriptions.get(id);
		if (!entry) return;
		this.subscriptions.delete(id);
		this.detachWatchers(entry);
		this.stopHealthCheckTimerIfIdle();
		this.logger.info("[FileWatchService] unsubscribed", {
			id,
			filePath: entry.filePath
		});
	}
	/**
	* 全量清理（应用退出/服务重置时调用）。
	*/
	dispose() {
		if (this.disposed) return;
		this.disposed = true;
		for (const entry of this.subscriptions.values()) this.detachWatchers(entry);
		this.subscriptions.clear();
		this.stopHealthCheckTimer();
		this.logger.info("[FileWatchService] disposed");
	}
	/**
	* 释放当前所有订阅，但保持 service 可用（不置 disposed）。
	*
	* 用途：renderer 客户端全部断开时主动清掉孤儿 watcher。
	* renderer 重连后会自动重新订阅，所以 service 必须仍可接受新 subscribe。
	*
	* 与 dispose() 的区别：
	* - dispose() 置 disposed 标记，后续 subscribe 会抛错（应用退出语义）
	* - releaseAllSubscriptions() 仅释放当前订阅，service 仍可工作
	*/
	releaseAllSubscriptions() {
		if (this.disposed) return;
		if (this.subscriptions.size === 0) return;
		const count = this.subscriptions.size;
		for (const entry of this.subscriptions.values()) this.detachWatchers(entry);
		this.subscriptions.clear();
		this.stopHealthCheckTimer();
		this.logger.info("[FileWatchService] released all subscriptions", { count });
	}
	/**
	* 读取当前文件签名（mtimeMs + size）并写回 entry。
	* 文件不存在或 stat 失败时保持原值不动（等文件出现后由 watcher/轮询再更新）。
	* @returns 是否成功读到签名
	*/
	refreshSignature(entry) {
		try {
			const st = (0, fs.statSync)(entry.filePath);
			entry.lastMtimeMs = st.mtimeMs;
			entry.lastSize = st.size;
			return true;
		} catch {
			return false;
		}
	}
	/**
	* 确保健康检查定时器在运行（有订阅时）。幂等。
	*/
	ensureHealthCheckTimer() {
		if (this.healthCheckTimer || this.disposed) return;
		this.healthCheckTimer = setInterval(() => {
			this.runHealthCheck();
		}, this.healthCheckIntervalMs);
		this.healthCheckTimer.unref?.();
	}
	/** 没有订阅时停掉健康检查定时器，避免空转。 */
	stopHealthCheckTimerIfIdle() {
		if (this.subscriptions.size === 0) this.stopHealthCheckTimer();
	}
	stopHealthCheckTimer() {
		if (this.healthCheckTimer) {
			clearInterval(this.healthCheckTimer);
			this.healthCheckTimer = null;
		}
	}
	/**
	* 健康自愈：遍历所有订阅，重建已失效的 primary watcher，
	* 并对比签名补发在 watcher 失效窗口内漏掉的变更。
	*
	* 这是解决 Windows「原子写 rename 后 fs.watch 静默失效 → 概率性不刷新」的关键：
	* 即使 fs.watch 没发任何事件、轮询也恰好错过，健康检查也能在 1s 内
	* 通过 stat 签名对比发现变更并补发。
	*/
	runHealthCheck() {
		if (this.disposed) return;
		for (const entry of this.subscriptions.values()) {
			if (!entry.watcher) this.attachPrimaryWatcher(entry);
			try {
				const st = (0, fs.statSync)(entry.filePath);
				if (st.mtimeMs !== entry.lastMtimeMs || st.size !== entry.lastSize) {
					entry.lastMtimeMs = st.mtimeMs;
					entry.lastSize = st.size;
					this.emitChange(entry, "change");
				}
			} catch {}
		}
	}
	/**
	* 主路径 watcher：fs.watch(filePath)。
	* 文件不存在时会抛 ENOENT，吞掉错误，靠 polling 兜底；
	* rename 事件触发后 watcher 通常失效，重新尝试挂载。
	*/
	attachPrimaryWatcher(entry) {
		try {
			const watcher = (0, fs.watch)(entry.filePath, { persistent: false }, (eventType) => {
				const type = eventType === "rename" ? "rename" : "change";
				this.refreshSignature(entry);
				this.emitChange(entry, type);
				if (eventType === "rename") {
					this.detachPrimaryWatcher(entry);
					setTimeout(() => {
						if (this.subscriptions.has(entry.id) && !entry.watcher) this.attachPrimaryWatcher(entry);
					}, 50);
				}
			});
			watcher.on("error", (err) => {
				this.logger.debug("[FileWatchService] primary watcher error", {
					id: entry.id,
					filePath: entry.filePath,
					error: err instanceof Error ? err.message : String(err)
				});
				this.detachPrimaryWatcher(entry);
			});
			entry.watcher = watcher;
		} catch (err) {
			this.logger.debug("[FileWatchService] primary watcher attach failed (will rely on polling)", {
				id: entry.id,
				filePath: entry.filePath,
				error: err instanceof Error ? err.message : String(err)
			});
			entry.watcher = null;
		}
	}
	detachPrimaryWatcher(entry) {
		if (entry.watcher) {
			try {
				entry.watcher.close();
			} catch {}
			entry.watcher = null;
		}
	}
	/**
	* 兜底轮询：fs.watchFile，比较 mtimeMs **和** size。
	*
	* Windows NTFS 的 mtime 精度较低（1~2s 级），小文件快速改写时 mtime 可能不变，
	* 单看 mtime 会漏判；叠加 size 判据后，只要内容长度变了就能捕获。
	* 主 watcher 已触发过的同一变更会在 emitChange 内按短窗口去重。
	*/
	attachPollingWatcher(entry) {
		if (entry.pollingActive) return;
		const listener = (curr, prev) => {
			if (curr.mtimeMs === 0 && prev.mtimeMs === 0) return;
			if (curr.mtimeMs === 0 && prev.mtimeMs > 0) {
				entry.lastMtimeMs = 0;
				entry.lastSize = -1;
				this.emitChange(entry, "unlink");
				return;
			}
			if (curr.mtimeMs !== entry.lastMtimeMs || curr.size !== entry.lastSize) {
				entry.lastMtimeMs = curr.mtimeMs;
				entry.lastSize = curr.size;
				if (!entry.watcher) this.attachPrimaryWatcher(entry);
				this.emitChange(entry, "change");
			}
		};
		try {
			(0, fs.watchFile)(entry.filePath, {
				interval: POLL_INTERVAL_MS,
				persistent: false
			}, listener);
			entry.pollingActive = true;
		} catch (err) {
			this.logger.warn("[FileWatchService] polling watcher attach failed", {
				id: entry.id,
				filePath: entry.filePath,
				error: err instanceof Error ? err.message : String(err)
			});
		}
	}
	detachPollingWatcher(entry) {
		if (entry.pollingActive) {
			try {
				(0, fs.unwatchFile)(entry.filePath);
			} catch {}
			entry.pollingActive = false;
		}
	}
	detachWatchers(entry) {
		this.detachPrimaryWatcher(entry);
		this.detachPollingWatcher(entry);
	}
	emitChange(entry, type) {
		const now = Date.now();
		if (type === "change" && now - entry.lastEmitAt < CHANGE_DEDUPE_MS) return;
		entry.lastEmitAt = now;
		const payload = {
			id: entry.id,
			path: entry.filePath,
			type,
			timestamp: now
		};
		const channel = `fileWatch:changed:${entry.id}`;
		try {
			this.pushEvent(channel, payload);
			this.logger.debug("[FileWatchService] pushed", {
				channel,
				type
			});
		} catch (err) {
			this.logger.error("[FileWatchService] push failed", {
				channel,
				error: err instanceof Error ? err.message : String(err)
			});
		}
	}
};
//#endregion
//#region ../../packages/workbuddy-server/src/docs/save/local-document-original-save-guard.ts
var MTIME_TOLERANCE_MS = 50;
/**
* Maximum absolute difference (ms) between the file's on-disk `mtimeMs` and
* editor_sdk's `last_saved_ms` for the change to count as "editor_sdk wrote
* this file itself". Probe measurements show the two values differ by ~1 ms
* in practice; ±50 ms absorbs clock skew and sub-millisecond timestamp
* precision differences in either direction while staying well below any
* realistic interval between an SDK save and an unrelated external edit.
*/
var SDK_SELF_WRITE_TOLERANCE_MS = 50;
/**
* editor_sdk updates `last_saved_ms` asynchronously after the atomic rename.
* Probing shows the status API reflects the new value within ~3–4 ms of the
* fs.watch event, with rare outliers under load.
*
* Instead of busy-polling, we wait a single fixed delay and then query exactly
* once. 100 ms is a generous multiple of the observed delay that comfortably
* absorbs slower machines and HTTP service variance, while keeping each watch
* event to a single status request. fs.watchFile fires its fallback poll every
* ~1 s, so a single 100 ms check per event keeps the SDK status endpoint load
* low (one request rather than ~10 retries) without sacrificing accuracy.
*/
var SDK_SELF_WRITE_CHECK_DELAY_MS = 100;
/**
* 本地腾讯文档预览的“保存回原文档”保护器。
*
* 设计边界：
* - `FileWatchService` 只负责尽早发现并提示外部修改，提升用户感知；
* - 真正保存前仍重新 `stat` 原文件并和 `baseline` 对比，作为不误覆盖的最终判断；
* - 冲突弹窗和系统通知通过构造函数注入，guard 本身不直接依赖 Electron UI。
*/
var LocalDocumentOriginalSaveGuard = class {
	constructor(options) {
		this.trackedByResourceUri = /* @__PURE__ */ new Map();
		this.resourceUriByWatchId = /* @__PURE__ */ new Map();
		this.disposed = false;
		this.requestConflictDecision = options.requestConflictDecision;
		this.onExternalOriginalChange = options.onExternalOriginalChange;
		this.resolveDirtyState = options.resolveDirtyState;
		this.resolveSdkLastSavedMs = options.resolveSdkLastSavedMs;
		this.enableFileWatch = options.enableFileWatch !== false;
		this.selfWriteCheckDelayMs = options.selfWriteCheckDelayMs ?? SDK_SELF_WRITE_CHECK_DELAY_MS;
		this.fileWatchService = options.fileWatchService ?? new FileWatchService((channel, payload) => {
			this.handleWatchEvent(channel, payload);
		});
	}
	/**
	* 建立或刷新一个 embedded preview 对原文档的跟踪。
	* 这里会记录打开时的磁盘签名，并启动 watcher 做早提示。
	*/
	async trackResource(documentResourceUri, filePath, title) {
		if (this.disposed) return;
		const normalizedResourceUri = documentResourceUri.trim();
		const normalizedFilePath = node_path.resolve(filePath);
		if (!normalizedResourceUri || !normalizedFilePath) return;
		const existing = this.trackedByResourceUri.get(normalizedResourceUri);
		if (existing?.filePath === normalizedFilePath) {
			existing.title = title ?? existing.title;
			return;
		}
		if (existing) this.releaseResource(normalizedResourceUri);
		const sameFileResourceUri = this.findTrackedResourceUriByFilePath(normalizedFilePath);
		if (sameFileResourceUri && sameFileResourceUri !== normalizedResourceUri) {
			windowLog.warn("[LocalDocumentOriginalSaveGuard] duplicate original-file tracker rejected", {
				existingResourceUri: sameFileResourceUri,
				rejectedResourceUri: normalizedResourceUri,
				filePath: normalizedFilePath
			});
			return;
		}
		const tracked = {
			documentResourceUri: normalizedResourceUri,
			filePath: normalizedFilePath,
			title,
			baseline: await readFileSignature(normalizedFilePath),
			notifiedExternalChange: false,
			saving: false
		};
		try {
			if (this.enableFileWatch) {
				tracked.watchId = this.fileWatchService.subscribe(normalizedFilePath);
				this.resourceUriByWatchId.set(tracked.watchId, normalizedResourceUri);
			}
		} catch (error) {
			windowLog.warn("[LocalDocumentOriginalSaveGuard] file watch subscribe failed", {
				documentResourceUri: normalizedResourceUri,
				filePath: normalizedFilePath,
				error: toErrorMessage$1(error)
			});
		}
		this.trackedByResourceUri.set(normalizedResourceUri, tracked);
	}
	/**
	* 释放单个 context 的原文档跟踪状态。
	*
	* 在 preview context 被释放、在线文档直接释放或 manager teardown 时调用；必须同步取消 watcher，
	* 否则后续外部修改会继续触发已失效 context 的早提示。
	*/
	releaseResource(documentResourceUri) {
		const normalizedResourceUri = documentResourceUri.trim();
		const tracked = this.trackedByResourceUri.get(normalizedResourceUri);
		if (!tracked) return;
		this.trackedByResourceUri.delete(normalizedResourceUri);
		if (tracked.watchId) {
			this.resourceUriByWatchId.delete(tracked.watchId);
			this.fileWatchService.unsubscribe(tracked.watchId);
		}
	}
	/**
	* 释放 guard 持有的全部 watcher 和跟踪状态。
	* manager teardown 时调用；释放后新的 `trackResource` 会被忽略，避免异步 preview 创建在关窗后重建 watcher。
	*/
	dispose() {
		if (this.disposed) return;
		this.disposed = true;
		for (const documentResourceUri of this.trackedByResourceUri.keys()) this.releaseResource(documentResourceUri);
		try {
			this.fileWatchService.dispose();
		} catch (error) {
			windowLog.warn("[LocalDocumentOriginalSaveGuard] file watch dispose failed", { error: toErrorMessage$1(error) });
		}
	}
	/**
	* 保存前的最终仲裁。
	* 另存为目标不等于原路径时直接放行；写回原路径时必须即时读取磁盘签名，
	* 与打开/上次保存后的基线对比，发现变化则交给宿主弹窗决策。
	*/
	async prepareOriginalSave(params) {
		const originalFilePath = node_path.resolve(params.filePath);
		const targetFilePath = params.targetFilePath?.trim() ? node_path.resolve(params.targetFilePath) : originalFilePath;
		if (!isSameFilePath(originalFilePath, targetFilePath)) return {
			action: "saveAs",
			targetFilePath
		};
		let tracked = this.trackedByResourceUri.get(params.documentResourceUri);
		if (!tracked) {
			await this.trackResource(params.documentResourceUri, originalFilePath, params.title);
			tracked = this.trackedByResourceUri.get(params.documentResourceUri);
		}
		const baseline = tracked?.baseline ?? await readFileSignature(originalFilePath);
		const current = await readFileSignature(originalFilePath);
		if (isSameSignature(baseline, current)) return {
			action: "save",
			targetFilePath: originalFilePath
		};
		const sdkLastSavedMs = await this.resolveSdkLastSavedMsSafe({
			documentResourceUri: params.documentResourceUri,
			filePath: originalFilePath,
			title: params.title ?? tracked?.title
		});
		if (!tracked?.notifiedExternalChange && isSdkSelfWrite(current, sdkLastSavedMs)) {
			if (tracked) {
				tracked.baseline = current;
				tracked.notifiedExternalChange = false;
			}
			windowLog.info("[LocalDocumentOriginalSaveGuard] original file change is editor_sdk self-write, skip conflict", {
				documentResourceUri: params.documentResourceUri,
				filePath: originalFilePath,
				baseline: summarizeSignature(baseline),
				current: summarizeSignature(current),
				sdkLastSavedMs
			});
			return {
				action: "save",
				targetFilePath: originalFilePath
			};
		}
		windowLog.warn("[LocalDocumentOriginalSaveGuard] original file changed before save", {
			documentResourceUri: params.documentResourceUri,
			filePath: originalFilePath,
			baseline: summarizeSignature(baseline),
			current: summarizeSignature(current),
			alreadyNotified: tracked?.notifiedExternalChange ?? false,
			interactive: params.interactive ?? true
		});
		if (params.interactive === false) {
			windowLog.info("[LocalDocumentOriginalSaveGuard] original file conflict skipped (non-interactive)", {
				documentResourceUri: params.documentResourceUri,
				filePath: originalFilePath
			});
			return {
				action: "skip",
				targetFilePath: originalFilePath
			};
		}
		const decision = await this.requestConflictDecision({
			documentResourceUri: params.documentResourceUri,
			filePath: originalFilePath,
			title: params.title ?? tracked?.title,
			baseline,
			current
		});
		windowLog.info("[LocalDocumentOriginalSaveGuard] original file conflict decision", {
			documentResourceUri: params.documentResourceUri,
			filePath: originalFilePath,
			action: decision.action
		});
		if (decision.action === "cancel") return {
			action: "cancel",
			targetFilePath: originalFilePath
		};
		if (decision.action === "saveAs") return {
			action: "saveAs",
			targetFilePath: node_path.resolve(decision.targetFilePath)
		};
		return {
			action: "save",
			targetFilePath: originalFilePath
		};
	}
	/** 标记 WorkBuddy 即将写入该文件，watch 事件在此期间只视为自写入副作用。 */
	markSaveStarted(documentResourceUri) {
		const tracked = this.trackedByResourceUri.get(documentResourceUri.trim());
		if (!tracked) return;
		tracked.saving = true;
		windowLog.info("[LocalDocumentOriginalSaveGuard] original save started", {
			documentResourceUri,
			filePath: tracked.filePath
		});
	}
	/**
	* 原路径保存成功后刷新基线。
	* 这一步同时清除早提示状态，并结束 saving 标记，保证后续外部修改能再次提示。
	*/
	async refreshBaselineAfterSave(documentResourceUri, filePath) {
		const tracked = this.trackedByResourceUri.get(documentResourceUri.trim());
		if (!tracked || !isSameFilePath(tracked.filePath, filePath)) return;
		tracked.baseline = await readFileSignature(tracked.filePath);
		tracked.notifiedExternalChange = false;
		tracked.saving = false;
		windowLog.info("[LocalDocumentOriginalSaveGuard] original baseline refreshed after save", {
			documentResourceUri,
			filePath: tracked.filePath,
			baseline: summarizeSignature(tracked.baseline)
		});
	}
	/** 保存失败或另存为完成时恢复 watcher 判断；原路径保存成功由 `refreshBaselineAfterSave` 负责恢复。 */
	markSaveFinished(documentResourceUri) {
		const tracked = this.trackedByResourceUri.get(documentResourceUri.trim());
		if (!tracked) return;
		tracked.saving = false;
		windowLog.info("[LocalDocumentOriginalSaveGuard] original save finished without baseline refresh", {
			documentResourceUri,
			filePath: tracked.filePath
		});
	}
	/**
	* 处理 FileWatchService 推送的早提示事件。
	* 这里不直接判定“可以覆盖/不可以覆盖”，只在签名确实偏离基线时提示用户，
	* 最终安全判断仍然留给 `prepareOriginalSave` 的保存前 stat。
	*/
	async handleWatchEvent(channel, payload) {
		const event = payload;
		const watchId = event?.id ?? channel.match(/^fileWatch:changed:(.+)$/)?.[1];
		const documentResourceUri = watchId ? this.resourceUriByWatchId.get(watchId) : void 0;
		const tracked = documentResourceUri ? this.trackedByResourceUri.get(documentResourceUri) : void 0;
		if (!tracked) return;
		if (tracked.saving) {
			windowLog.info("[LocalDocumentOriginalSaveGuard] ignore original file watch event during save", {
				documentResourceUri: tracked.documentResourceUri,
				filePath: tracked.filePath,
				watchId,
				eventType: event?.type
			});
			return;
		}
		if (tracked.notifiedExternalChange) {
			windowLog.info("[LocalDocumentOriginalSaveGuard] suppress duplicate original file change notification", {
				documentResourceUri: tracked.documentResourceUri,
				filePath: tracked.filePath,
				watchId,
				eventType: event?.type
			});
			return;
		}
		const current = event?.type === "unlink" ? null : await readFileSignature(tracked.filePath);
		if (isSameSignature(tracked.baseline, current)) return;
		if (tracked.notifiedExternalChange || this.disposed) return;
		if (current) {
			const sdkContext = {
				documentResourceUri: tracked.documentResourceUri,
				filePath: tracked.filePath,
				title: tracked.title
			};
			const isNewCheck = !tracked.selfWriteCheckPromise;
			if (isNewCheck) tracked.selfWriteCheckPromise = this.checkIsSdkSelfWrite(current, sdkContext, tracked, watchId).finally(() => {
				tracked.selfWriteCheckPromise = void 0;
			});
			windowLog.info("[LocalDocumentOriginalSaveGuard] watcher fired, awaiting sdk self-write check", {
				documentResourceUri: tracked.documentResourceUri,
				filePath: tracked.filePath,
				watchId,
				eventType: event?.type,
				current: summarizeSignature(current),
				isNewCheck
			});
			const isSelfWrite = await tracked.selfWriteCheckPromise;
			if (tracked.notifiedExternalChange || this.disposed) {
				windowLog.info("[LocalDocumentOriginalSaveGuard] watcher exit after self-write check: already notified or disposed", {
					documentResourceUri: tracked.documentResourceUri,
					filePath: tracked.filePath,
					watchId
				});
				return;
			}
			if (isSelfWrite) {
				tracked.baseline = current;
				tracked.notifiedExternalChange = false;
				windowLog.info("[LocalDocumentOriginalSaveGuard] ignore editor_sdk self-write", {
					documentResourceUri: tracked.documentResourceUri,
					filePath: tracked.filePath,
					watchId,
					eventType: event?.type,
					current: summarizeSignature(current)
				});
				return;
			}
		}
		tracked.notifiedExternalChange = true;
		const deleted = current === null;
		const isDirty = await this.resolveCurrentDirtyState(tracked);
		const notification = {
			documentResourceUri: tracked.documentResourceUri,
			filePath: tracked.filePath,
			title: tracked.title,
			...isDirty === void 0 ? {} : { isDirty },
			...deleted ? { deleted: true } : {}
		};
		windowLog.warn("[LocalDocumentOriginalSaveGuard] external original file change detected", {
			documentResourceUri: tracked.documentResourceUri,
			filePath: tracked.filePath,
			watchId,
			eventType: event?.type,
			baseline: summarizeSignature(tracked.baseline),
			current: summarizeSignature(current),
			isDirty,
			deleted
		});
		const outcome = await this.onExternalOriginalChange?.(notification) ?? "notified";
		if (this.disposed) return;
		const settledTracked = this.trackedByResourceUri.get(tracked.documentResourceUri);
		if (!settledTracked) return;
		if (outcome === "silent") {
			settledTracked.baseline = current;
			settledTracked.notifiedExternalChange = false;
		}
		windowLog.info("[LocalDocumentOriginalSaveGuard] external original file change outcome", {
			documentResourceUri: tracked.documentResourceUri,
			filePath: tracked.filePath,
			outcome
		});
	}
	findTrackedResourceUriByFilePath(filePath) {
		for (const tracked of this.trackedByResourceUri.values()) if (isSameFilePath(tracked.filePath, filePath)) return tracked.documentResourceUri;
	}
	/**
	* 查询 editor_sdk 最近写盘时间戳；失败/未配置时返回 undefined，调用方按"非自写盘"保守处理。
	* 单独封装以便 watch 早提示与保存前仲裁复用同一套容错与日志。
	*/
	async resolveSdkLastSavedMsSafe(context) {
		if (!this.resolveSdkLastSavedMs) return;
		try {
			return await this.resolveSdkLastSavedMs(context);
		} catch (error) {
			windowLog.warn("[LocalDocumentOriginalSaveGuard] resolve editor_sdk last_saved_ms failed", {
				documentResourceUri: context.documentResourceUri,
				filePath: context.filePath,
				error: toErrorMessage$1(error)
			});
			return;
		}
	}
	/**
	* Decides whether this file change was caused by editor_sdk itself by
	* comparing the file mtime against the SDK's `last_saved_ms`.
	*
	* Timing rationale (derived from probe measurements):
	*   - editor_sdk updates `last_saved_ms` within ~3–4 ms of the atomic
	*     rename that triggers fs.watch, with rare outliers under load.
	*   - We wait a single SDK_SELF_WRITE_CHECK_DELAY_MS (100 ms) for the value
	*     to settle, then query exactly once — no busy-polling. This keeps each
	*     watch event to one status request even when fs.watchFile fires its
	*     ~1 s fallback poll repeatedly, while the generous delay still absorbs
	*     slow machines and HTTP variance.
	*   - The popup notification is held until this method returns, so the user
	*     never sees a false "external change" for an SDK self-write.
	*
	* Concurrent callers: `handleWatchEvent` caches this promise on `tracked`,
	* so multiple simultaneous watcher events for the same write await one
	* shared HTTP round-trip instead of each issuing their own request.
	*/
	async checkIsSdkSelfWrite(current, context, tracked, watchId) {
		const startMs = Date.now();
		if (this.selfWriteCheckDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, this.selfWriteCheckDelayMs));
		if (tracked.notifiedExternalChange || this.disposed) return false;
		const lsm = await this.resolveSdkLastSavedMsSafe(context);
		const isSelf = isSdkSelfWrite(current, lsm);
		windowLog.info("[LocalDocumentOriginalSaveGuard] sdk last_saved_ms vs file mtime", {
			filePath: context.filePath,
			watchId,
			fileMtimeMs: current.mtimeMs,
			sdkLastSavedMs: lsm,
			diffMs: lsm !== void 0 ? lsm - current.mtimeMs : "N/A",
			isSdkSelfWrite: isSelf,
			elapsedMs: Date.now() - startMs
		});
		return isSelf;
	}
	/** 查询当前 SDK editor 是否 dirty；失败不影响早提示，只降级为未知状态文案。 */
	async resolveCurrentDirtyState(tracked) {
		if (!this.resolveDirtyState) return;
		try {
			return await this.resolveDirtyState({
				documentResourceUri: tracked.documentResourceUri,
				filePath: tracked.filePath,
				title: tracked.title
			});
		} catch (error) {
			windowLog.warn("[LocalDocumentOriginalSaveGuard] resolve dirty state failed before external-change notification", {
				documentResourceUri: tracked.documentResourceUri,
				filePath: tracked.filePath,
				error: toErrorMessage$1(error)
			});
			return;
		}
	}
};
async function readFileSignature(filePath) {
	try {
		const info = await (0, node_fs_promises.stat)(filePath);
		return {
			mtimeMs: info.mtimeMs,
			size: info.size
		};
	} catch {
		return null;
	}
}
/**
* Returns true when the file change was caused by editor_sdk itself rather
* than an external application.
*
* editor_sdk records `last_saved_ms` (integer ms) immediately before or after
* the atomic rename that updates the file. The file system `mtime` carries
* sub-millisecond precision, so the two values may differ by a fraction of a
* millisecond in either direction. A symmetric ±SDK_SELF_WRITE_TOLERANCE_MS
* window accepts both orderings while remaining far smaller than any realistic
* gap between an SDK save and a subsequent external edit.
*
* `undefined` (query failed or SDK has never saved), non-positive values, and
* differences exceeding the tolerance all fall through to "treat as external
* change" — the conservative safe default.
*/
function isSdkSelfWrite(current, sdkLastSavedMs) {
	if (!current) return false;
	return isEditorSdkSelfWriteByMtime(current.mtimeMs, sdkLastSavedMs);
}
/**
* 判断某次磁盘写入是否为 editor_sdk 自写：文件 `mtimeMs` 与 SDK `last_saved_ms` 落在
* ±{@link SDK_SELF_WRITE_TOLERANCE_MS} 容差内即视为自写。
*
* 导出给 service 的「reload 前二次自写复核」复用：`last_saved_ms` 是异步 settle 的，
* guard 前置检测在慢机上可能假阴性；reload 原语在去抖 settle 后用重新查询的时间戳再核一次，
* 命中即放弃 reload（避免误关用户正在编辑的 editor）。判据须与 guard 前置检测完全一致。
*
* `undefined`（查询失败/从未保存）与非正数一律按「非自写」的保守默认处理。
*/
function isEditorSdkSelfWriteByMtime(fileMtimeMs, sdkLastSavedMs) {
	if (sdkLastSavedMs === void 0 || sdkLastSavedMs <= 0) return false;
	return Math.abs(sdkLastSavedMs - fileMtimeMs) <= SDK_SELF_WRITE_TOLERANCE_MS;
}
function isSameSignature(a, b) {
	if (!a || !b) return a === b;
	return a.size === b.size && Math.abs(a.mtimeMs - b.mtimeMs) <= MTIME_TOLERANCE_MS;
}
function summarizeSignature(signature) {
	return signature ? {
		exists: true,
		mtimeMs: Math.round(signature.mtimeMs),
		size: signature.size
	} : { exists: false };
}
function isSameFilePath(a, b) {
	const left = node_path.resolve(a);
	const right = node_path.resolve(b);
	return process.platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right;
}
function toErrorMessage$1(error) {
	return error instanceof Error ? error.message : String(error);
}
//#endregion
//#region ../../packages/workbuddy-server/src/docs/tencent-docs-document-service.ts
/**
* WorkBuddy 支持 AI 能力的文档品类白名单。
* 与腾讯文档引擎完整预览能力解耦：引擎可支持更多格式，但只有这里列出的品类才进入 AI 文档入口。
*/
var aiFileExtensionWhitelistSet = new Set(TENCENT_DOCS_AI_FILE_EXTENSION_WHITELIST.map((ext) => ext.toLowerCase()));
/**
* 本地 SDK editor 注册到 file_id 的轮询退避表（毫秒）。
*
* 背景：embedded preview 创建时，本地 Tencent Docs SDK 还在
* 拉数据并把文档注册进 editor pool，`getEditorStatusByFilePath` 会在短时间内返回
* "未找到"。这里采用先短后长的退避序列，先快速响应（多数轮次只需 100~400ms），
* 再用稳定的 1s 节奏续命，总等待约 5.5s（100+200+400+800+1000×4）即放弃。
*
* 修改时请同时核对 `hydrateLocalSdkEditorFileIdWhenReadyInternal` 的循环退出语义。
*/
var LOCAL_SDK_FILE_ID_HYDRATION_RETRY_DELAYS_MS = [
	100,
	200,
	400,
	800,
	1e3,
	1e3,
	1e3,
	1e3
];
/**
* Promise 化的 setTimeout。
* `unref()` 是为了避免后台等待的 timer 阻止 Electron 主进程退出
* （异步触发且不等待的 hydration 任务在用户关窗后还可能在跑）。
*/
function wait(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms).unref?.();
	});
}
/**
* 「干净预览外部变更 → 自动重载」前的默认去抖延迟（ms）。
*
* 复用 self-write 检测的「单次固定延迟」思路：等一小段时间让 agent 长写 / 第三方 app 的
* 连续写盘 settle，再作废旧 in-memory editor 重开，避免读到半成品或预览闪烁。取 150ms 作为
* 观测到的 fs.watch 抖动窗口的宽裕上限；测试环境降为 0，避免定时器不确定性。
*/
var PREVIEW_RELOAD_DEBOUNCE_MS = 150;
/**
* reload 孤儿清理时单个本地孤儿 force-discard 的超时上限（ms）。
*
* force-discard 是 `force=true` 关闭、不走 dirty 探测，正常 sub-second；设上限只为兜底
* 某次 SDK 调用挂住时不至于无限阻塞 `getPreviewUrl` gate（超时按 fail-open 跳过，底层关闭仍会自行收尾）。
*
* 各孤儿并发清理 → reconcile 整体耗时 ≈ 最慢一项，故本上限即「reload 后首个预览 URL 最坏等待」。
* 取 3s 而非更大值：force-discard 超过秒级几乎一定是 SDK 已挂住，再多等也无意义，宁可早放行（fail-open）。
*/
var RECONCILE_FORCE_DISCARD_TIMEOUT_MS = 3e3;
var SESSION_DELETE_AGENT_OPEN_SETTLE_TIMEOUT_MS = 2e3;
var SESSION_DELETE_PREVIEW_OPEN_SETTLE_TIMEOUT_MS = 2e3;
var SESSION_DELETE_LATE_AGENT_OPEN_RETENTION_MS = 6e4;
/** Promise 超时包装：超过 ms 未 settle 则 reject（调用方按 fail-open 处理）。不取消底层 promise，仅不再等待。 */
function withTimeout(promise, ms, label) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(/* @__PURE__ */ new Error(`${label} timed out after ${ms}ms`)), ms);
		promise.then((value) => {
			clearTimeout(timer);
			resolve(value);
		}, (error) => {
			clearTimeout(timer);
			reject(error);
		});
	});
}
/**
* Tencent Docs main 侧门面。
*
* 负责本地文档在 main 进程里的业务编排：持有腾讯文档引擎服务、获取预览 URL、
* 并登记/释放 AI 上下文。它不接管 renderer iframe 渲染，
* 也不复制 TencentDocsService 的底层启动细节。
*/
var TencentDocsDocumentService = class {
	constructor(options = {}) {
		this.pendingPreviewReloads = /* @__PURE__ */ new Map();
		this.sdkDied = false;
		this.foregroundSessionId = null;
		this.agentEditorOpenTokens = /* @__PURE__ */ new Map();
		this.deletingDocumentSessionIds = /* @__PURE__ */ new Set();
		this.pendingEmbeddedPreviewOpens = /* @__PURE__ */ new Map();
		this.pendingAgentEditorOpenSettlements = /* @__PURE__ */ new Map();
		this.successfulAgentEditorPathsBySession = /* @__PURE__ */ new Map();
		this.agentOpenedFilePathsByDeletingSession = /* @__PURE__ */ new Map();
		this.approvedDirtyAgentDiscardsBySession = /* @__PURE__ */ new Map();
		this.documentSessionGenerations = /* @__PURE__ */ new Map();
		this.sessionDeleteAgentOpenScanStarted = /* @__PURE__ */ new Set();
		this.pendingSessionDeleteFinalizers = /* @__PURE__ */ new Map();
		this.sessionDeleteAgentOpenSettleTimeoutMs = options.sessionDeleteAgentOpenSettleTimeoutMs ?? SESSION_DELETE_AGENT_OPEN_SETTLE_TIMEOUT_MS;
		this.sessionDeletePreviewOpenSettleTimeoutMs = options.sessionDeletePreviewOpenSettleTimeoutMs ?? SESSION_DELETE_PREVIEW_OPEN_SETTLE_TIMEOUT_MS;
		this.documentLeaseRegistry = options.documentLeaseRegistry ?? new DocumentLeaseRegistry();
		this.documentLeaseRegistry.setForegroundSessionIdGetter(() => this.foregroundSessionId);
		const cleanupStaleEditorSdkProcesses = options.killStaleEditorSdkProcesses ?? (options.docsService === void 0 ? killStaleEditorSdkProcesses : () => {});
		this.docsService = options.docsService ?? new _tencent_tencent_docs_ai_engine.TencentDocsService({
			logger: {
				info: (message, extra) => windowLog.info("[TencentDocsEngine]", message, ...extra !== void 0 ? [extra] : []),
				warn: (message, extra) => windowLog.warn("[TencentDocsEngine]", message, ...extra !== void 0 ? [extra] : [])
			},
			portFileRootDir: getWorkbuddyConfigDir(),
			logDir: getEditorSdkLogDir(),
			onEngineReady: () => {
				this.sdkDied = false;
				this.engineSession.triggerReady();
			},
			onUnexpectedExit: (info) => {
				this.sdkDied = true;
				this.engineSession.resetOnUnexpectedExit();
				windowLog.error("[TencentDocsDocumentService] editor_sdk exited unexpectedly", {
					code: info.code,
					signal: info.signal,
					uptimeMs: info.uptimeMs,
					port: info.port,
					error: info.error?.message
				});
			}
		});
		this.engineSession = new TencentDocsEngineSession({
			docsService: this.docsService,
			cleanupStaleEditorSdkProcesses
		});
		this.contextManager = options.contextManager ?? new TencentDocsContextManager();
		this.localSdkEditorFileIds = new LocalSdkEditorFileIdResolver({
			docsService: this.docsService,
			normalizeFilePath: normalizeLocalDocumentFilePath
		});
		this.focusMainWindow = options.focusMainWindow;
		this.dialogProvider = options.dialogProvider;
		this.requestDirtyEditorCloseDecision = options.requestDirtyEditorCloseDecision ?? ((context) => defaultRequestDirtyEditorCloseDecision(context, { dialogProvider: this.dialogProvider }));
		this.requestOriginalFileConflictDecision = options.requestOriginalFileConflictDecision ?? ((context) => defaultRequestOriginalFileConflictDecision(context, { dialogProvider: this.dialogProvider }));
		this.notifyOriginalFileChanged = options.notifyOriginalFileChanged ?? ((notification) => defaultNotifyOriginalFileChanged(notification, { dialogProvider: this.dialogProvider }));
		this.previewReloadDebounceMs = options.previewReloadDebounceMs ?? (process.env.NODE_ENV === "test" ? 0 : PREVIEW_RELOAD_DEBOUNCE_MS);
		this.localDocumentOriginalSaveGuard = new LocalDocumentOriginalSaveGuard({
			enableFileWatch: options.enableOriginalFileWatch ?? process.env.NODE_ENV !== "test",
			requestConflictDecision: (context) => this.requestOriginalFileConflictDecision(context),
			resolveDirtyState: async ({ filePath }) => {
				const status = await this.docsService.getEditorStatusByFilePath(filePath);
				if (!status.success || status.notFound) return;
				return this.localSdkEditorFileIds.matchByFilePath(status.openEditors, filePath)?.is_dirty;
			},
			resolveSdkLastSavedMs: async ({ filePath }) => {
				const status = await this.docsService.getEditorStatusByFilePath(filePath);
				if (!status.success || status.notFound) return;
				return this.localSdkEditorFileIds.matchByFilePath(status.openEditors, filePath)?.last_saved_ms;
			},
			onExternalOriginalChange: (notification) => this.handleExternalOriginalChange(notification)
		});
		this.localDocumentPreviewManager = new LocalDocumentPreviewManager({
			registry: this.documentLeaseRegistry,
			contextManager: this.contextManager,
			originalSaveGuard: this.localDocumentOriginalSaveGuard,
			localSdkEditorFileIds: this.localSdkEditorFileIds,
			createPreviewUrl: (filePath) => this.createPreviewUrl(filePath),
			normalizeFilePath: normalizeLocalDocumentFilePath,
			hydrateFileIdWhenReady: (params) => this.hydrateLocalSdkEditorFileIdWhenReady(params)
		});
		this.localDocumentPreviewCloseManager = new LocalDocumentPreviewCloseManager({
			contextManager: this.contextManager,
			registry: this.documentLeaseRegistry,
			docsService: this.docsService,
			originalSaveGuard: this.localDocumentOriginalSaveGuard,
			localSdkEditorFileIds: this.localSdkEditorFileIds,
			requestDirtyEditorCloseDecision: (context) => this.requestDirtyEditorCloseDecision(context),
			normalizeFilePath: normalizeLocalDocumentFilePath,
			isSdkAlive: () => this.isSdkAlive(),
			reportTelemetry: options.reportTelemetry
		});
		this.localDocumentPreviewReleaseManager = new LocalDocumentPreviewReleaseManager({
			contextManager: this.contextManager,
			registry: this.documentLeaseRegistry,
			docsService: this.docsService,
			originalSaveGuard: this.localDocumentOriginalSaveGuard,
			localSdkEditorFileIds: this.localSdkEditorFileIds,
			hasDirtyCloseGuardTask: (fileId) => this.localDocumentPreviewCloseManager.hasDirtyCloseGuardTask(fileId),
			closeLocalSdkEditor: (fileId, context, force) => this.localDocumentPreviewCloseManager.forceCloseLocalSdkEditor(fileId, context, force)
		});
		this.localDocumentPreviewSaveManager = new LocalDocumentPreviewSaveManager({
			contextManager: this.contextManager,
			docsService: this.docsService,
			originalSaveGuard: this.localDocumentOriginalSaveGuard,
			localSdkEditorFileIds: this.localSdkEditorFileIds,
			normalizeFilePath: normalizeLocalDocumentFilePath,
			formatText: formatLocalPreviewText$1,
			reportTelemetry: options.reportTelemetry
		});
		this.documentLeaseRegistry.setForegroundSessionIdGetter(() => this.foregroundSessionId);
	}
	/**
	* 注入主窗口聚焦回调。
	*
	* 仅用于“系统右键/拖入文件已经在主 chat embedded preview 打开”的去重分支。
	* 由 bootstrap 层提供函数，manager 不直接持有 WindowManager，确保 Tencent Docs
	* 去重逻辑仍封装在本模块内，不扩散到 WorkBuddy 主流程。
	*/
	setMainWindowFocusHandler(handler) {
		this.focusMainWindow = handler;
	}
	setDialogProvider(provider) {
		this.dialogProvider = provider;
	}
	/**
	* 注入会话元数据查询（目前仅 session 标题，供 owned-by-other toast 使用）。
	*/
	setSessionConflictLookups(options) {
		this.getSessionTitle = options.getSessionTitle;
		this.documentLeaseRegistry.setSessionStillProcessing(options.isSessionStillProcessing);
	}
	/**
	* prompt every_turn section 薄调入口：为本轮 prompt 引用到的本地文档占 reserved turn 租约。
	*
	* reserved 是 turn 租约的唯一种类（最早的硬阻断起点：「本轮引用了该文档但尚未真正打开」），
	* turn 结束随 releaseTurnLeases 自动到期。无效路径 / 空 sessionId 直接忽略。
	*/
	reserveLocalDocumentsForTurn(sessionId, filePaths) {
		const trimmedSessionId = sessionId.trim();
		if (!trimmedSessionId || filePaths.length === 0) return;
		for (const filePath of filePaths) {
			const normalized = normalizeLocalDocumentFilePath(filePath);
			if (!normalized) continue;
			this.documentLeaseRegistry.acquireTurnLease(fileResourceUriFromCanonicalPath(normalized), trimmedSessionId);
		}
	}
	/** 诊断 / 测试用：返回某资源在注册表中的租约快照（无记录返回 null）。 */
	inspectDocumentLease(documentResourceUri) {
		return this.documentLeaseRegistry.inspect(documentResourceUri);
	}
	/** turn 结束时清空该 session 的 turn 维度状态（reserved 租约 + 未 settle 的 agent OPENING 令牌）。 */
	clearSessionTurnLeases(sessionId) {
		windowLog.info("[TencentDocsDocumentService] turn lease clear", { sessionId });
		this.documentLeaseRegistry.releaseTurnLeases(sessionId);
		this.dropPendingAgentEditorOpens(sessionId);
	}
	/**
	* agent `open_file` 的 pre-hook（§3.5 states-only）：把目标资源同步占为 OPENING，记 `toolCallId→令牌`。
	* 仅当该资源此前无 OpenLease 才真正占位（{@link DocumentLeaseRegistry.beginAgentOpen} 返回 null 时镜像既有、不参与 settle）。
	*/
	beginAgentEditorOpen(sessionId, filePath, toolCallId) {
		const trimmedSessionId = sessionId.trim();
		const normalized = normalizeLocalDocumentFilePath(filePath);
		if (!trimmedSessionId || !normalized || !toolCallId) return;
		const resourceUri = fileResourceUriFromCanonicalPath(normalized);
		const token = this.documentLeaseRegistry.beginAgentOpen(resourceUri, trimmedSessionId);
		if (token) {
			let resolveSettlement;
			const settlement = new Promise((resolve) => {
				resolveSettlement = resolve;
			});
			this.agentEditorOpenTokens.set(toolCallId, {
				resourceUri,
				token,
				sessionId: trimmedSessionId,
				filePath: normalized,
				settlement,
				resolveSettlement,
				forceCloseOnSettle: false,
				documentSessionGeneration: this.getDocumentSessionGeneration(trimmedSessionId)
			});
			this.trackAgentEditorOpenSettlement(trimmedSessionId, settlement);
			if (this.deletingDocumentSessionIds.has(trimmedSessionId)) this.trackDeletingSessionAgentFilePath(trimmedSessionId, normalized, this.getDocumentSessionGeneration(trimmedSessionId));
			this.localDocumentOriginalSaveGuard.trackResource(resourceUri, normalized, node_path.basename(normalized)).catch((error) => {
				windowLog.warn("[TencentDocsDocumentService] agent open_file original baseline track failed", {
					toolCallId,
					sessionId: trimmedSessionId,
					filePath: normalized,
					resourceUri,
					error: toErrorMessage(error)
				});
			});
		}
	}
	/**
	* agent `open_file` 的 result-hook（§3.5）：据 tool_call 终态结果 settle OPENING→OPEN（success）或 drop（failure）。
	* 只应在 tool_call_update 的**终态** status 上调用（completed=success；failed/cancelled=failure）。
	*/
	settleAgentEditorOpen(toolCallId, success) {
		const entry = this.agentEditorOpenTokens.get(toolCallId);
		if (!entry) return;
		this.agentEditorOpenTokens.delete(toolCallId);
		this.documentLeaseRegistry.endAgentOpen(entry.resourceUri, entry.token, success);
		if (success) this.trackSuccessfulAgentEditorPath(entry.sessionId, entry.filePath, entry.documentSessionGeneration);
		if (success && (entry.forceCloseOnSettle || this.sessionDeleteAgentOpenScanStarted.has(entry.sessionId))) {
			this.trackDeletingSessionAgentFilePath(entry.sessionId, entry.filePath, entry.documentSessionGeneration);
			this.forceCloseAgentOpenedEditor(entry.sessionId, entry.filePath, true, entry.documentSessionGeneration).catch((error) => {
				windowLog.warn("[TencentDocsDocumentService] late agent editor force-close failed", {
					sessionId: entry.sessionId,
					filePath: entry.filePath,
					error: toErrorMessage(error)
				});
			}).finally(() => {
				entry.resolveSettlement();
				if (entry.forceCloseOnSettle && !this.sessionDeleteAgentOpenScanStarted.has(entry.sessionId)) this.forgetAgentEditorPath(entry.sessionId, entry.filePath, entry.documentSessionGeneration);
			});
			return;
		}
		entry.resolveSettlement();
	}
	/** turn 结束 / 会话删除兜底：把该 session 尚未 settle 的 open_file OPENING 令牌按失败 drop。 */
	dropPendingAgentEditorOpens(sessionId) {
		if (this.sessionDeleteAgentOpenScanStarted.has(sessionId)) return;
		for (const [toolCallId, entry] of this.agentEditorOpenTokens) if (entry.sessionId === sessionId) {
			this.agentEditorOpenTokens.delete(toolCallId);
			this.documentLeaseRegistry.endAgentOpen(entry.resourceUri, entry.token, false);
			entry.resolveSettlement();
		}
	}
	trackAgentEditorOpenSettlement(sessionId, settlement) {
		const pending = this.pendingAgentEditorOpenSettlements.get(sessionId) ?? /* @__PURE__ */ new Set();
		pending.add(settlement);
		this.pendingAgentEditorOpenSettlements.set(sessionId, pending);
		settlement.finally(() => {
			pending.delete(settlement);
			if (pending.size === 0 && this.pendingAgentEditorOpenSettlements.get(sessionId) === pending) this.pendingAgentEditorOpenSettlements.delete(sessionId);
		});
	}
	getDocumentSessionGeneration(sessionId) {
		return this.documentSessionGenerations.get(sessionId) ?? 0;
	}
	bumpDocumentSessionGeneration(sessionId) {
		this.documentSessionGenerations.set(sessionId, this.getDocumentSessionGeneration(sessionId) + 1);
	}
	trackDeletingSessionAgentFilePath(sessionId, filePath, generation) {
		const paths = this.agentOpenedFilePathsByDeletingSession.get(sessionId) ?? /* @__PURE__ */ new Map();
		const currentGeneration = paths.get(filePath);
		if (currentGeneration === void 0 || generation >= currentGeneration) paths.set(filePath, generation);
		this.agentOpenedFilePathsByDeletingSession.set(sessionId, paths);
	}
	trackSuccessfulAgentEditorPath(sessionId, filePath, generation) {
		const paths = this.successfulAgentEditorPathsBySession.get(sessionId) ?? /* @__PURE__ */ new Map();
		const currentGeneration = paths.get(filePath);
		if (currentGeneration === void 0 || generation >= currentGeneration) paths.set(filePath, generation);
		this.successfulAgentEditorPathsBySession.set(sessionId, paths);
	}
	forgetAgentEditorPath(sessionId, filePath, expectedGeneration) {
		for (const pathsBySession of [this.successfulAgentEditorPathsBySession, this.agentOpenedFilePathsByDeletingSession]) {
			const paths = pathsBySession.get(sessionId);
			if (paths && (expectedGeneration === void 0 || paths.get(filePath) === expectedGeneration)) paths.delete(filePath);
			if (paths?.size === 0) pathsBySession.delete(sessionId);
		}
	}
	async awaitPendingAgentEditorOpens(sessionId) {
		const deadline = Date.now() + this.sessionDeleteAgentOpenSettleTimeoutMs;
		while (true) {
			const pending = this.pendingAgentEditorOpenSettlements.get(sessionId);
			if (!pending || pending.size === 0) return true;
			const remainingMs = deadline - Date.now();
			if (remainingMs <= 0) return false;
			if (!await Promise.race([Promise.all([...pending]).then(() => true), wait(remainingMs).then(() => false)])) return false;
		}
	}
	forceSettlePendingAgentEditorOpensForDelete(sessionId) {
		for (const [toolCallId, entry] of this.agentEditorOpenTokens) {
			if (entry.sessionId !== sessionId) continue;
			entry.forceCloseOnSettle = true;
			this.trackDeletingSessionAgentFilePath(sessionId, entry.filePath, entry.documentSessionGeneration);
			this.documentLeaseRegistry.endAgentOpen(entry.resourceUri, entry.token, false);
			entry.resolveSettlement();
			setTimeout(() => {
				if (this.agentEditorOpenTokens.get(toolCallId) === entry) this.agentEditorOpenTokens.delete(toolCallId);
			}, SESSION_DELETE_LATE_AGENT_OPEN_RETENTION_MS).unref?.();
		}
	}
	async prepareAgentEditorsForDelete(sessionId) {
		const paths = this.successfulAgentEditorPathsBySession.get(sessionId);
		if (!paths) return "continue";
		const currentGeneration = this.getDocumentSessionGeneration(sessionId);
		for (const [filePath, generation] of [...paths]) {
			if (generation !== currentGeneration) {
				this.forgetAgentEditorPath(sessionId, filePath, generation);
				continue;
			}
			if (this.contextManager.findActiveFilePreviewContextByPath(filePath)) continue;
			const resourceUri = fileResourceUriFromCanonicalPath(normalizeLocalDocumentFilePath(filePath) || filePath);
			const openOwnerSessionId = this.documentLeaseRegistry.inspect(resourceUri)?.open?.ownerSessionId;
			if (openOwnerSessionId && openOwnerSessionId !== sessionId) {
				this.forgetAgentEditorPath(sessionId, filePath, generation);
				continue;
			}
			const status = await this.docsService.getEditorStatusByFilePath(filePath);
			if (!status.success) {
				windowLog.warn("[TencentDocsDocumentService] delete preflight agent editor status failed", {
					sessionId,
					filePath,
					error: status.error
				});
				return "cancelled";
			}
			if (status.notFound) {
				this.forgetAgentEditorPath(sessionId, filePath, generation);
				continue;
			}
			const editor = this.localSdkEditorFileIds.matchByFilePath(status.openEditors, filePath);
			if (!editor) {
				this.forgetAgentEditorPath(sessionId, filePath, generation);
				continue;
			}
			if (!editor.is_dirty) continue;
			const decision = await this.requestDirtyEditorCloseDecision({
				filePath,
				fileId: editor.file_id,
				title: node_path.basename(filePath),
				source: "embedded-release"
			});
			if (decision.action === "cancel") return "cancelled";
			if (decision.action === "discard") {
				const discards = this.approvedDirtyAgentDiscardsBySession.get(sessionId) ?? /* @__PURE__ */ new Map();
				discards.set(filePath, generation);
				this.approvedDirtyAgentDiscardsBySession.set(sessionId, discards);
				continue;
			}
			let targetFilePath = decision.action === "saveAs" ? decision.targetFilePath : filePath;
			if (decision.action === "save") {
				const originalSave = await this.localDocumentOriginalSaveGuard.prepareOriginalSave({
					documentResourceUri: resourceUri,
					filePath,
					title: node_path.basename(filePath),
					interactive: true
				});
				if (originalSave.action === "cancel" || originalSave.action === "skip") return "cancelled";
				if (originalSave.action === "saveAs") targetFilePath = originalSave.targetFilePath;
			}
			this.localDocumentOriginalSaveGuard.markSaveStarted(resourceUri);
			const saved = await this.docsService.saveEditor(editor.file_id, { filePath: targetFilePath });
			if (!saved.success) {
				this.localDocumentOriginalSaveGuard.markSaveFinished(resourceUri);
				windowLog.warn("[TencentDocsDocumentService] delete preflight agent editor save failed", {
					sessionId,
					filePath,
					fileId: editor.file_id,
					error: saved.error
				});
				return "cancelled";
			}
			if (targetFilePath === filePath) await this.localDocumentOriginalSaveGuard.refreshBaselineAfterSave(resourceUri, filePath);
			else this.localDocumentOriginalSaveGuard.markSaveFinished(resourceUri);
		}
		return "continue";
	}
	async forceCloseAgentOpenedEditor(sessionId, filePath, force = false, expectedGeneration, dirtyDiscardApproved = false) {
		if (this.contextManager.findActiveFilePreviewContextByPath(filePath)) return;
		const trackedGeneration = this.successfulAgentEditorPathsBySession.get(sessionId)?.get(filePath);
		if (expectedGeneration !== void 0 && trackedGeneration !== void 0 && trackedGeneration !== expectedGeneration) return;
		const resourceUri = fileResourceUriFromCanonicalPath(normalizeLocalDocumentFilePath(filePath) || filePath);
		const openOwnerSessionId = this.documentLeaseRegistry.inspect(resourceUri)?.open?.ownerSessionId;
		if (openOwnerSessionId && openOwnerSessionId !== sessionId) return;
		const status = await this.docsService.getEditorStatusByFilePath(filePath);
		if (!status.success) throw new Error(status.error ?? `Failed to query agent editor status for ${filePath}`);
		if (status.notFound) return;
		const editor = this.localSdkEditorFileIds.matchByFilePath(status.openEditors, filePath);
		if (!editor) return;
		if (force && editor.is_dirty && !dirtyDiscardApproved && this.approvedDirtyAgentDiscardsBySession.get(sessionId)?.get(filePath) !== expectedGeneration) throw new Error(`Refusing to force-close unconfirmed dirty agent editor ${editor.file_id}`);
		const result = force ? await this.docsService.closeEditor(editor.file_id, { force: true }) : await this.docsService.closeEditor(editor.file_id);
		if (!result.success) throw new Error(result.error ?? `Failed to close agent editor ${editor.file_id}`);
	}
	async forceCloseAgentOpenedEditorsForDeletedSession(sessionId) {
		const paths = this.agentOpenedFilePathsByDeletingSession.get(sessionId);
		if (!paths) return /* @__PURE__ */ new Map();
		const failures = /* @__PURE__ */ new Map();
		for (const [filePath, generation] of paths) try {
			await this.forceCloseAgentOpenedEditor(sessionId, filePath, true, generation);
		} catch (error) {
			failures.set(filePath, generation);
			windowLog.warn("[TencentDocsDocumentService] deleting-session agent editor close failed", {
				sessionId,
				filePath,
				error: toErrorMessage(error)
			});
		}
		return failures;
	}
	scheduleDeletedAgentEditorCloseRetries(sessionId, failures) {
		if (failures.size === 0) return;
		const retryDelaysMs = [
			250,
			1e3,
			3e3
		];
		const approvedDiscardPaths = new Set([...failures].flatMap(([filePath, generation]) => this.approvedDirtyAgentDiscardsBySession.get(sessionId)?.get(filePath) === generation ? [filePath] : []));
		let remainingFailures = failures;
		const retry = async (attempt) => {
			const remaining = /* @__PURE__ */ new Map();
			for (const [filePath, generation] of remainingFailures) try {
				await this.forceCloseAgentOpenedEditor(sessionId, filePath, true, generation, approvedDiscardPaths.has(filePath));
				this.forgetAgentEditorPath(sessionId, filePath, generation);
			} catch (error) {
				remaining.set(filePath, generation);
				windowLog.warn("[TencentDocsDocumentService] deleted-session agent editor retry failed", {
					sessionId,
					filePath,
					attempt: attempt + 1,
					error: toErrorMessage(error)
				});
			}
			if (remaining.size === 0 || attempt + 1 >= retryDelaysMs.length) return;
			remainingFailures = remaining;
			setTimeout(() => {
				retry(attempt + 1).catch(() => void 0);
			}, retryDelaysMs[attempt + 1]).unref?.();
		};
		setTimeout(() => {
			retry(0).catch(() => void 0);
		}, retryDelaysMs[0]).unref?.();
	}
	/**
	* 会话删除：彻底回收该 session 的全部本地文档占用（§2.4 owner 永不转移，删除即清理）。
	*
	* 顺序：①逐个对其 preview 做 **lease-aware 强制丢弃式关闭**（force-discard 关 SDK editor 不弹框 +
	* CLOSING 两段式 drop `OpenLease` + 释放 context），避免 editor pool 残留 / 旧 dirty 状态串入同路径重开；
	* ②`releaseSessionContexts` 兜底清理无 preview 的残余 context；③`evictSession` 清残留 turn 租约；
	* ④若删除的是当前前台会话则清空前台指针（N5）。使同一文件可被新会话全新打开，不残留死 owner 租约阻断 arbitrate。
	*/
	async evictSessionDocuments(sessionId) {
		const targetSessionId = sessionId.trim();
		windowLog.info("[TencentDocsDocumentService] evict session documents", { sessionId: targetSessionId });
		if (targetSessionId) {
			const contexts = this.contextManager.getFilePreviewContexts({ sessionId: targetSessionId });
			for (const context of contexts) try {
				await this.localDocumentPreviewCloseManager.forceReleaseContextDiscardingChanges(context.documentResourceUri);
			} catch (error) {
				windowLog.warn("[TencentDocsDocumentService] evict session: force release threw", {
					sessionId: targetSessionId,
					documentResourceUri: context.documentResourceUri,
					error: error instanceof Error ? error.message : String(error)
				});
			}
		}
		this.contextManager.releaseSessionContexts(sessionId);
		this.documentLeaseRegistry.evictSession(sessionId);
		this.successfulAgentEditorPathsBySession.delete(targetSessionId);
		this.dropPendingAgentEditorOpens(targetSessionId);
		if (this.foregroundSessionId === targetSessionId) this.setForegroundSession(null);
	}
	/**
	* Resend/edit 场景：释放指定 session 所有已打开预览的原文档跟踪（watcher + baseline）。
	*
	* 与 evictSessionDocuments 不同，本方法**不关闭 SDK editor、不清 context、不释放 lease**——
	* 只释放 `LocalDocumentOriginalSaveGuard` 对该 session 预览文件的跟踪，
	* 使得 agent 覆写同路径文件时不会触发"被其他应用修改"早提示弹窗。
	* 新一轮生成完成后，预览面板重新打开时会重新 trackResource 建立新 baseline。
	*/
	async releaseSessionOriginalFileTracking(sessionId) {
		const targetSessionId = sessionId.trim();
		if (!targetSessionId) return;
		const contexts = this.contextManager.getFilePreviewContexts({ sessionId: targetSessionId });
		for (const context of contexts) this.localDocumentOriginalSaveGuard.releaseResource(context.documentResourceUri);
		windowLog.info("[TencentDocsDocumentService] released original file tracking for resend", {
			sessionId: targetSessionId,
			releasedCount: contexts.length
		});
	}
	/**
	* Reload 孤儿清理：清掉上一条 renderer 生命周期遗留的**本地**预览孤儿。
	*
	* 背景：renderer 整页 reload（Cmd+R / 崩溃 / 无响应 / bootstrap 超时）会销毁 renderer 进程，但 daemon
	* 侧本地 `editor_sdk` 实例、`OpenLease`、preview context 都不随之回收。重开同一文档时 `getPreviewUrl`
	* 会让引擎再建一个 editor 实例 → 同文档多实例。
	*
	* 触发：新 renderer 挂载后由 `getPreviewUrl` 提供方 once-per-boot gate 调用一次，**先清理孤儿、再放行前台重开**，
	* 使前台走全新打开（`acquired`），不复用 reload 前的 stale context。
	*
	* 只清本地：在线 `tdoc://` 预览没有本地 editor、也不存在多实例问题；而 `forceReleaseContextDiscardingChanges`
	* 即便对在线文件也会释放其 context（见 `forceReleaseContextDiscardingChangesInner`），故**必须**先按
	* `isTencentOnlineFilePath` 过滤成仅本地，避免误清在线预览。
	*
	* 健壮性：各孤儿 **并发** 清理（避免 fileId 未缓存时逐个 `getEditorStatusByFilePath` 往返串行拖慢前台）、
	* **单项超时**、**逐项 + 整体 fail-open**（reconcile 报错/超时也照常返回，绝不阻塞重开）。返回成功强清的本地孤儿数。
	*/
	async reconcileOrphanLocalPreviews() {
		const startedAt = Date.now();
		const allContexts = this.contextManager.getFilePreviewContexts({});
		const localContexts = allContexts.filter((context) => !isTencentOnlineFilePath(context.filePath));
		windowLog.info("[TencentDocsDocumentService] reconcile orphan local previews", {
			totalCount: allContexts.length,
			localCount: localContexts.length
		});
		if (localContexts.length === 0) return { discardedCount: 0 };
		const discardedCount = (await Promise.all(localContexts.map((context) => this.forceDiscardOrphanPreviewWithTimeout(context.documentResourceUri)))).filter(Boolean).length;
		windowLog.info("[TencentDocsDocumentService] reconcile orphan local previews done", {
			localCount: localContexts.length,
			discardedCount,
			durationMs: Date.now() - startedAt
		});
		return { discardedCount };
	}
	/** 单个本地孤儿的 force-discard，带超时 + fail-open；返回是否成功释放（超时/异常按未释放计）。 */
	async forceDiscardOrphanPreviewWithTimeout(documentResourceUri) {
		try {
			return (await withTimeout(this.localDocumentPreviewCloseManager.forceReleaseContextDiscardingChanges(documentResourceUri), RECONCILE_FORCE_DISCARD_TIMEOUT_MS, "reconcile force-discard")).released;
		} catch (error) {
			windowLog.warn("[TencentDocsDocumentService] reconcile force-discard failed (fail-open)", {
				documentResourceUri,
				error: error instanceof Error ? error.message : String(error)
			});
			return false;
		}
	}
	/** 预热腾讯文档本地引擎；失败由调用方决定如何记录和降级。 */
	async init() {
		windowLog.info("[TencentDocsDocumentService] init");
		await this.ensureEngineStarted("manager-init");
	}
	/**
	* 确保本地腾讯文档引擎已启动。
	*
	* 用于 MCP 后台预热、预览 getPreviewUrl 前的显式兜底等。
	* `source` 写入日志，便于在 main.log 对照冷启动耗时（grep `ensureStarted`）。
	*/
	async ensureEngineStarted(source = "unspecified") {
		return this.engineSession.ensureStarted(source);
	}
	/**
	* 注入引擎就绪回调，bootstrap 用它在 editor_sdk 就绪后广播 `tencent-docs:engineReady`。
	* 若注入时引擎已就绪，立即补发一次，覆盖「引擎先于 handler 就绪」的冷启动竞态。
	*/
	setEngineReadyHandler(handler) {
		this.engineSession.setReadyHandler(handler);
	}
	/**
	* 注入「干净预览外部变更自动重载」的推送回调（镜像 {@link setEngineReadyHandler}）。
	* bootstrap 用它把 daemon 侧的 reload 意图经 `tencent-docs:reloadEmbeddedPreview` 推给 renderer，
	* 由 renderer 作为唯一 reopen 方强制重挂 iframe、重新 `getPreviewUrl` 读盘拿最新内容。
	*/
	setPreviewReloadHandler(handler) {
		this.previewReloadHandler = handler;
	}
	/**
	* 只读预检：本机是否随包发布了可解析的 `editor_sdk` 二进制（不启动引擎、无副作用）。
	*
	* 这是“是否注入本地腾讯文档 MCP”的判据，刻意与 `ensureEngineStarted()` 的运行期
	* 就绪语义正交——local MCP 走 stdio bridge，bridge 自带端口等待 + 重连，可容忍引擎
	* 延迟就绪。亦与 system prompt 本地文档场景 hard guard 同源（见
	* `TencentDocsLocalScenarioCollector`），避免“prompt 宣传了工具、MCP 层却没注册”。
	*/
	async canEnsureEngineStart() {
		return this.engineSession.canEnsureStart();
	}
	/**
	* editor_sdk 当前是否存活。
	*
	* 仅在 `onUnexpectedExit` 触发后返回 false；引擎主动 dispose 或尚未启动时**不**视为死亡。
	* 返回 false 后所有 SDK API 调用路径应 fail-open 放行（关 tab、dirty 检查等），
	* 避免永久阻塞在已失效的 HTTP 连接上。引擎重启成功（onEngineReady）后自动恢复为 true。
	*/
	isSdkAlive() {
		return !this.sdkDied;
	}
	/**
	* 引擎是否已就绪；为 true 时 `getEnginePort()` 返回实际绑定端口而非首选端口。
	*
	* 用于把关“注入插件子进程的本地引擎 HTTP 直连 env”：该 env 是 spawn 时一次性快照、
	* 不能像 stdio bridge 那样运行期重解析端口，故未就绪时宁可不注入也不塞首选端口。
	*/
	isEngineStarted() {
		return this.engineSession.isStarted();
	}
	/**
	* 返回本地腾讯文档引擎当前监听端口。
	*
	* 主要给 MCP 配置和调试日志使用；调用前如果要求端口一定可用，应先
	* `await ensureEngineStarted()`，否则可能只是首选端口。
	*/
	getEnginePort() {
		return this.engineSession.getPort();
	}
	async restartEngineWithDebugOptions(staticDir, editorSdkPath) {
		return this.engineSession.restartWithDebugOptions(staticDir, editorSdkPath);
	}
	/**
	* 为一个已确认的本地文件生成 iframe 预览 URL。
	*
	* 只负责和本地 SDK/引擎交互，不做文件存在性校验，也不登记 AI Docs 上下文。
	*/
	async createPreviewUrl(filePath, options) {
		return this.engineSession.createPreviewUrl(filePath, options);
	}
	/**
	* 在 agent 一轮对话结束后收尾：对本回合 open_file 打开的文档执行 save（如有
	* 未保存修改）再 close。
	*
	* 策略：
	*   - 逐路径查询 editor 状态（getEditorStatusByFilePath 内部按 file_path 过滤，
	*     每个路径各发起一次请求，路径数通常很小）；
	*   - 若该路径同时被用户 embedded preview 登记了 context，说明它正被用户查看，
	*     其生命周期由用户的关闭操作（releaseEmbeddedPreviewContext）管理，这里直接
	*     跳过，避免误关用户正在查看的预览、并留下残留 context（review #1）；
	*   - is_dirty → 先走非交互式原文档保存守卫，再 saveEditor，成功后 closeEditor；外部修改冲突 /
	*     save 失败则跳过 close，保留未保存内容，不弹用户确认框；
	*   - 干净 → 直接 closeEditor；
	*   - pool 里不存在该路径 → 跳过（agent 可能已自行关闭）。
	*/
	async reconcileAgentOpenedEditors(filePaths, sessionId) {
		for (const filePath of [...new Set(filePaths)]) {
			if (this.contextManager.findActiveFilePreviewContextByPath(filePath)) {
				windowLog.debug("[TencentDocsDocumentService] reconcile skip: file has active user preview context", { filePath });
				if (sessionId) this.forgetAgentEditorPath(sessionId, filePath);
				continue;
			}
			const status = await this.docsService.getEditorStatusByFilePath(filePath);
			if (!status.success) {
				windowLog.warn("[TencentDocsDocumentService] reconcile status query failed", {
					filePath,
					error: status.error
				});
				continue;
			}
			if (status.notFound) {
				windowLog.debug("[TencentDocsDocumentService] reconcile skip: file not in editor pool", { filePath });
				this.dropAgentOpenLeaseIfOpen(filePath);
				if (sessionId) this.forgetAgentEditorPath(sessionId, filePath);
				continue;
			}
			const editor = this.localSdkEditorFileIds.matchByFilePath(status.openEditors, filePath);
			if (!editor) {
				windowLog.debug("[TencentDocsDocumentService] reconcile skip: editor not found for path", { filePath });
				this.dropAgentOpenLeaseIfOpen(filePath);
				if (sessionId) this.forgetAgentEditorPath(sessionId, filePath);
				continue;
			}
			const wasDirty = editor.is_dirty;
			if (wasDirty) {
				const resourceUri = fileResourceUriFromCanonicalPath(normalizeLocalDocumentFilePath(filePath) || filePath);
				const originalSave = await this.localDocumentOriginalSaveGuard.prepareOriginalSave({
					documentResourceUri: resourceUri,
					filePath,
					title: node_path.basename(filePath),
					interactive: false
				});
				if (originalSave.action === "cancel" || originalSave.action === "skip") {
					windowLog.warn("[TencentDocsDocumentService] reconcile save skipped by original-file guard, keep editor open", {
						filePath,
						fileId: editor.file_id,
						action: originalSave.action
					});
					continue;
				}
				const targetFilePath = originalSave.action === "saveAs" ? originalSave.targetFilePath : filePath;
				this.localDocumentOriginalSaveGuard.markSaveStarted(resourceUri);
				const saved = await this.docsService.saveEditor(editor.file_id, { filePath: targetFilePath });
				if (!saved.success) {
					this.localDocumentOriginalSaveGuard.markSaveFinished(resourceUri);
					windowLog.warn("[TencentDocsDocumentService] reconcile save failed, keep editor open to avoid data loss", {
						filePath,
						fileId: editor.file_id,
						error: saved.error
					});
					continue;
				}
				if (originalSave.action === "save") await this.localDocumentOriginalSaveGuard.refreshBaselineAfterSave(resourceUri, filePath);
				else this.localDocumentOriginalSaveGuard.markSaveFinished(resourceUri);
			}
			const resourceUri = fileResourceUriFromCanonicalPath(normalizeLocalDocumentFilePath(filePath) || filePath);
			const closeToken = this.documentLeaseRegistry.beginPendingRelease(resourceUri, "closing");
			const closed = await this.docsService.closeEditor(editor.file_id);
			if (closeToken) this.documentLeaseRegistry.endPendingRelease(resourceUri, closeToken, "closing", closed.success);
			if (!closed.success) {
				windowLog.warn("[TencentDocsDocumentService] reconcile close failed", {
					filePath,
					fileId: editor.file_id,
					error: closed.error
				});
				continue;
			}
			windowLog.info("[TencentDocsDocumentService] reconcile done", {
				filePath,
				fileId: editor.file_id,
				action: wasDirty ? "saved+closed" : "closed"
			});
			if (sessionId) this.forgetAgentEditorPath(sessionId, filePath);
		}
	}
	/** reconcile 兜底：引擎 editor 已不在 pool（被 agent close_file 关掉）时，drop 该资源仍残留的 OPEN OpenLease。 */
	dropAgentOpenLeaseIfOpen(filePath) {
		const resourceUri = fileResourceUriFromCanonicalPath(normalizeLocalDocumentFilePath(filePath) || filePath);
		const token = this.documentLeaseRegistry.beginPendingRelease(resourceUri, "closing");
		if (token) this.documentLeaseRegistry.endPendingRelease(resourceUri, token, "closing", true);
	}
	/**
	* 释放 AI Docs 门面持有的本地引擎和上下文资源。
	*
	* 进程退出或测试 teardown 时调用；如果当前实例是共享单例，也会清空单例引用。
	*/
	async dispose() {
		windowLog.info("[TencentDocsDocumentService] dispose");
		await this.engineSession.dispose();
		this.localDocumentOriginalSaveGuard.dispose();
		this.contextManager.dispose();
		this.documentLeaseRegistry.clearAll();
		this.agentEditorOpenTokens.clear();
		this.pendingEmbeddedPreviewOpens.clear();
		this.pendingAgentEditorOpenSettlements.clear();
		this.successfulAgentEditorPathsBySession.clear();
		this.agentOpenedFilePathsByDeletingSession.clear();
		this.approvedDirtyAgentDiscardsBySession.clear();
		this.documentSessionGenerations.clear();
		this.deletingDocumentSessionIds.clear();
		this.sessionDeleteAgentOpenScanStarted.clear();
		this.pendingSessionDeleteFinalizers.clear();
		if (sharedManager === this) sharedManager = null;
	}
	/**
	* 本地文档多会话冲突预检。
	*
	* 决策单源自 `documentLeaseRegistry.arbitrate`（读 turnLeases + OpenLease 的纯投影）：
	* 外部入口不传请求会话；chat 内入口传 requestSessionId，只拦截「其他活跃任务」占用同文件。
	* 依赖缺失 / 谓词抛错时 arbitrate 走 fail-open 保守放行，避免预检异常阻塞合法打开。
	*/
	/**
	* 返回当前持有 OpenLease 的文档数量（=已在 renderer keep-alive pool 中的条目数）。
	* 供 system-open 入口做预览池容量硬闸门预检（手动打开，不判断 owner 是否 processing）。
	*/
	getOpenLeaseCount() {
		return this.documentLeaseRegistry.getOpenLeaseCount();
	}
	checkLocalFileOpenConflict(filePath, options = {}) {
		const normalizedFilePath = normalizeLocalDocumentFilePath(filePath);
		if (!normalizedFilePath) return {
			kind: "none",
			filePath: filePath || ""
		};
		const documentResourceUri = fileResourceUriFromCanonicalPath(normalizedFilePath);
		const arbitrateOptions = {
			...options.requestSessionId ? { requestSessionId: options.requestSessionId } : {},
			...options.openSource ? { openSource: options.openSource } : {}
		};
		const arbitration = this.documentLeaseRegistry.arbitrate(documentResourceUri, arbitrateOptions);
		const result = this.toLocalFileOpenConflictResult(arbitration, normalizedFilePath);
		windowLog.info("[TencentDocsDocumentService] checkLocalFileOpenConflict", {
			filePath: result.filePath,
			kind: result.kind,
			requestSessionId: options.requestSessionId ?? null,
			conflictSessionId: result.sessionId ?? null
		});
		return result;
	}
	/** 把 registry.arbitrate 的纯决策映射为对外的 LocalFileOpenConflictResult（补 filePath / title / 聚焦副作用）。 */
	toLocalFileOpenConflictResult(arbitration, normalizedFilePath) {
		if (arbitration.decision === "owned-by-other") {
			const sessionTitle = arbitration.sessionId ? this.resolveSessionTitleSafely(arbitration.sessionId) : void 0;
			return {
				kind: "owned-by-other",
				filePath: normalizedFilePath,
				...arbitration.sessionId ? { sessionId: arbitration.sessionId } : {},
				...sessionTitle ? { sessionTitle } : {}
			};
		}
		if (arbitration.decision === "owned-by-self") {
			this.focusMainWindowSafely(normalizedFilePath);
			return {
				kind: "owned-by-self",
				filePath: normalizedFilePath,
				...arbitration.sessionId ? { sessionId: arbitration.sessionId } : {}
			};
		}
		return {
			kind: "none",
			filePath: normalizedFilePath
		};
	}
	/** getSessionTitle 包一层异常兜底，避免标题查询抛错影响冲突预检（toast 文案非关键路径）。 */
	resolveSessionTitleSafely(sessionId) {
		try {
			return this.getSessionTitle?.(sessionId);
		} catch (error) {
			windowLog.warn("[TencentDocsDocumentService] getSessionTitle failed", {
				sessionId,
				error: toErrorMessage(error)
			});
			return;
		}
	}
	/** 命中 owned-by-self（聚焦既有）时聚焦主窗；聚焦失败只 warn，不影响预检结果。 */
	focusMainWindowSafely(filePath) {
		try {
			this.focusMainWindow?.();
		} catch (error) {
			windowLog.warn("[TencentDocsDocumentService] focus main window for already-open preview failed", {
				filePath,
				error: toErrorMessage(error)
			});
		}
	}
	/**
	* 当前 session 发起的打开是否应阻断产物/预览（open_result_view 等）。
	* 与 arbitrate 的 shouldBlockOpen 同源：跨会话占用恒阻断；同 session 的 states-only
	* OpenLease 由 createEmbeddedPreview 的 drop-and-retry 恢复成可见 preview，不在这里拦截。
	*/
	shouldBlockSessionLocalDocumentOpen(filePath, requestSessionId) {
		const trimmed = requestSessionId.trim();
		if (!trimmed) return false;
		const normalizedFilePath = normalizeLocalDocumentFilePath(filePath);
		if (!normalizedFilePath) return false;
		const documentResourceUri = fileResourceUriFromCanonicalPath(normalizedFilePath);
		return this.documentLeaseRegistry.arbitrate(documentResourceUri, { requestSessionId: trimmed }).shouldBlockOpen;
	}
	/**
	* 内部 embedded frame 预览入口。
	* Renderer 仍负责 iframe 展示；这里仅保留 public 门面，生命周期细节由 preview 子职责处理。
	*
	* conflict 时会触发一次纯只读的 checkLocalFileOpenConflict（再次 arbitrate），
	* 补充 UI 三态字段 conflictOwnership / sessionTitle，供 renderer SdkDocumentPreview
	* 的 onOpenConflict 回调驱动 toast + 回滚。
	*/
	async createEmbeddedPreview(filePath, options = {}) {
		const sessionId = options.sessionId?.trim();
		if (sessionId && this.deletingDocumentSessionIds.has(sessionId)) return {
			success: false,
			error: "Document preview open was superseded by session deletion"
		};
		const opening = this.localDocumentPreviewManager.createEmbeddedPreview(filePath, options);
		const result = await (sessionId ? this.trackEmbeddedPreviewOpen(sessionId, opening) : opening);
		if (result.status === "conflict") {
			const conflict = this.checkLocalFileOpenConflict(filePath, { requestSessionId: options.sessionId });
			return {
				...result,
				conflictOwnership: "owned-by-other",
				...conflict.sessionTitle ? { sessionTitle: conflict.sessionTitle } : {}
			};
		}
		return result;
	}
	trackEmbeddedPreviewOpen(sessionId, opening) {
		const settlement = opening.then(() => void 0, () => void 0);
		const pending = this.pendingEmbeddedPreviewOpens.get(sessionId) ?? /* @__PURE__ */ new Set();
		pending.add(settlement);
		this.pendingEmbeddedPreviewOpens.set(sessionId, pending);
		settlement.finally(() => {
			pending.delete(settlement);
			if (pending.size === 0 && this.pendingEmbeddedPreviewOpens.get(sessionId) === pending) this.pendingEmbeddedPreviewOpens.delete(sessionId);
		});
		return opening;
	}
	async awaitPendingEmbeddedPreviewOpens(sessionId) {
		const deadline = Date.now() + this.sessionDeletePreviewOpenSettleTimeoutMs;
		while (true) {
			const pending = this.pendingEmbeddedPreviewOpens.get(sessionId);
			if (!pending || pending.size === 0) return true;
			const remainingMs = deadline - Date.now();
			if (remainingMs <= 0) return false;
			if (!await Promise.race([Promise.all([...pending]).then(() => true), wait(remainingMs).then(() => false)])) return false;
		}
	}
	/**
	* 按 documentResourceUri 读取 embedded preview 的轻量上下文快照。
	*
	* 供 renderer/IPC 查询当前 iframe 绑定的 filePath、fileId 和 session 归属；本方法只读，不触发 SDK 状态刷新。
	* 入参允许 canonical documentResourceUri，也允许 renderer 侧只能拿到的普通本地路径或 file URI。
	*/
	getEmbeddedPreviewContextInfo(documentResourceUriOrFilePath) {
		const context = this.contextManager.getFilePreviewContext(documentResourceUriOrFilePath);
		if (context) return context;
		if (/^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(documentResourceUriOrFilePath) && !documentResourceUriOrFilePath.toLowerCase().startsWith("file://")) return null;
		const normalizedFilePath = normalizeLocalDocumentFilePath(documentResourceUriOrFilePath);
		if (!normalizedFilePath) return null;
		return this.contextManager.findActiveFilePreviewContextByPath(normalizedFilePath);
	}
	/**
	* 查询某个 embedded preview 当前是否有未保存改动（脏状态）。
	*
	* 供 renderer 以轮询方式驱动保存按钮启用态与预览 tab 未保存灰点。只读查询：
	* 先按 documentResourceUri 取 context 拿 filePath，再向 SDK editor pool 查 is_dirty。
	* context 不存在 / SDK 未就绪 / 查询失败时一律返回 { isDirty: false }，UI 表现为"无未保存灰点"。
	*/
	async getEmbeddedPreviewDirty(documentResourceUri) {
		const context = this.getEmbeddedPreviewContextInfo(documentResourceUri);
		if (!context) return { isDirty: false };
		const status = await this.docsService.getEditorStatusByFilePath(context.filePath);
		if (!status.success || status.notFound) return { isDirty: false };
		return { isDirty: this.localSdkEditorFileIds.matchByFilePath(status.openEditors, context.filePath)?.is_dirty === true };
	}
	/**
	* 保存 embedded preview 里的本地文档内容。
	*
	* manager 只保留 public 门面；实际保存、写权限防线和原文档外部修改保护由 `LocalDocumentPreviewSaveManager` 执行。
	*/
	async saveEmbeddedPreviewContext(documentResourceUri, options = {}) {
		const context = this.getEmbeddedPreviewContextInfo(documentResourceUri);
		return this.localDocumentPreviewSaveManager.saveContext(context?.documentResourceUri ?? documentResourceUri, options);
	}
	/**
	* 自动（静默）保存 embedded preview 本地文档，供 keep-alive 池定时器调用。
	*
	* 与 `saveEmbeddedPreviewContext` 的差异：
	* - 不弹任何对话框（`interactive:false`）。
	* - 文件只读或被外部修改时直接跳过（不 saveAs），留给用户手动处理。
	* - 先检查 dirty 状态，未改动则不发起保存请求。
	*/
	async autoSaveEmbeddedPreviewContext(documentResourceUri) {
		const context = this.contextManager.getFilePreviewContext(documentResourceUri);
		if (!context) return {
			saved: false,
			reason: "not-found"
		};
		if (isTencentOnlineFilePath(context.filePath)) return {
			saved: false,
			reason: "unsupported"
		};
		try {
			if (!(await this.getEmbeddedPreviewDirty(documentResourceUri)).isDirty) return {
				saved: false,
				reason: "not-dirty"
			};
		} catch {}
		const saveResult = await this.localDocumentPreviewSaveManager.saveContext(documentResourceUri, { interactive: false });
		if (saveResult.success) return { saved: true };
		if (saveResult.skipped === "read-only") return {
			saved: false,
			reason: "read-only"
		};
		if (saveResult.skipped === "external-change") return {
			saved: false,
			reason: "external-change"
		};
		return {
			saved: false,
			reason: "failed"
		};
	}
	/**
	* 释放 embedded preview 创建的 AI Docs 上下文，dirty 时按用户决策保存/丢弃/取消。
	*
	* 纯门面委托：CLOSING 两段式 FSM 包装（OpenLease drop / fail-closed 保留；重开走 wait-and-chain）已下沉到
	* `LocalDocumentPreviewCloseManager.releaseContext` 内部，门面不再直接持有 registry 的释放语义。
	*/
	async releaseEmbeddedPreviewContext(documentResourceUri, options = {}) {
		return this.localDocumentPreviewCloseManager.releaseContext(documentResourceUri, options);
	}
	/**
	* 批量释放当前 session 下的 embedded preview contexts。
	*
	* 每个 dirty 文档都会走保存/另存为/丢弃/取消决策；任一文档取消会中断后续释放并返回阻断 context。
	*/
	async releaseEmbeddedPreviewContextsWithPrompt(options = {}) {
		return this.localDocumentPreviewCloseManager.releaseContextsWithPrompt(options);
	}
	/**
	* Task 删除前准备：按 session 逐个处理 dirty 文档（保存 / 另存为 / 丢弃 / 取消）。
	*
	* 任一取消或保存失败都返回 `cancelled`，调用方不得继续删除 Task。
	* clean 文档或无 preview context 时快速通过。
	*/
	async prepareSessionForDelete(sessionId) {
		const targetSessionId = sessionId.trim();
		if (!targetSessionId) return "continue";
		this.deletingDocumentSessionIds.add(targetSessionId);
		for (const [filePath, generation] of this.successfulAgentEditorPathsBySession.get(targetSessionId) ?? []) this.trackDeletingSessionAgentFilePath(targetSessionId, filePath, generation);
		for (const entry of this.agentEditorOpenTokens.values()) if (entry.sessionId === targetSessionId) this.trackDeletingSessionAgentFilePath(targetSessionId, entry.filePath, entry.documentSessionGeneration);
		try {
			if (!await this.awaitPendingEmbeddedPreviewOpens(targetSessionId)) {
				windowLog.warn("[TencentDocsDocumentService] delete preflight timed out waiting for preview opens", {
					sessionId: targetSessionId,
					timeoutMs: this.sessionDeletePreviewOpenSettleTimeoutMs
				});
				this.abortSessionDelete(targetSessionId);
				return "cancelled";
			}
			if (!await this.awaitPendingAgentEditorOpens(targetSessionId)) {
				windowLog.warn("[TencentDocsDocumentService] delete preflight timed out waiting for agent editors", {
					sessionId: targetSessionId,
					timeoutMs: this.sessionDeleteAgentOpenSettleTimeoutMs
				});
				this.abortSessionDelete(targetSessionId);
				return "cancelled";
			}
			if (await this.prepareAgentEditorsForDelete(targetSessionId) === "cancelled") {
				this.abortSessionDelete(targetSessionId);
				return "cancelled";
			}
			if (!(await this.releaseEmbeddedPreviewContextsWithPrompt({ sessionId: targetSessionId })).success) {
				this.abortSessionDelete(targetSessionId);
				return "cancelled";
			}
			return "continue";
		} catch (error) {
			this.abortSessionDelete(targetSessionId);
			throw error;
		}
	}
	/** 核心删除提交前失败时回滚 preflight fence；已关闭的 preview 不在此重建。 */
	abortSessionDelete(sessionId) {
		const targetSessionId = sessionId.trim();
		if (!targetSessionId) return;
		this.deletingDocumentSessionIds.delete(targetSessionId);
		this.sessionDeleteAgentOpenScanStarted.delete(targetSessionId);
		this.agentOpenedFilePathsByDeletingSession.delete(targetSessionId);
		this.approvedDirtyAgentDiscardsBySession.delete(targetSessionId);
	}
	/**
	* Task 删除提交后的强制收尾：等待 agent open_file 落定，关闭其 SDK editor，
	* 再回收 preview context 和全部租约。并发通知共享同一次清理。
	*/
	finalizeSessionForDelete(sessionId) {
		const targetSessionId = sessionId.trim();
		if (!targetSessionId) return Promise.resolve();
		const pending = this.pendingSessionDeleteFinalizers.get(targetSessionId);
		if (pending) return pending;
		const finalization = (async () => {
			this.sessionDeleteAgentOpenScanStarted.add(targetSessionId);
			if (!await this.awaitPendingAgentEditorOpens(targetSessionId)) {
				windowLog.warn("[TencentDocsDocumentService] delete finalizer timed out waiting for agent editors", {
					sessionId: targetSessionId,
					timeoutMs: this.sessionDeleteAgentOpenSettleTimeoutMs
				});
				this.forceSettlePendingAgentEditorOpensForDelete(targetSessionId);
			}
			await this.forceCloseAgentOpenedEditorsForDeletedSession(targetSessionId);
			await this.evictSessionDocuments(targetSessionId);
			if (!await this.awaitPendingAgentEditorOpens(targetSessionId)) this.forceSettlePendingAgentEditorOpensForDelete(targetSessionId);
			const failedAgentEditorCloses = await this.forceCloseAgentOpenedEditorsForDeletedSession(targetSessionId);
			this.scheduleDeletedAgentEditorCloseRetries(targetSessionId, failedAgentEditorCloses);
		})().finally(() => {
			this.bumpDocumentSessionGeneration(targetSessionId);
			this.deletingDocumentSessionIds.delete(targetSessionId);
			this.sessionDeleteAgentOpenScanStarted.delete(targetSessionId);
			this.agentOpenedFilePathsByDeletingSession.delete(targetSessionId);
			this.approvedDirtyAgentDiscardsBySession.delete(targetSessionId);
			if (this.pendingSessionDeleteFinalizers.get(targetSessionId) === finalization) this.pendingSessionDeleteFinalizers.delete(targetSessionId);
		});
		this.pendingSessionDeleteFinalizers.set(targetSessionId, finalization);
		return finalization;
	}
	/**
	* 将某个已登记 embedded preview context 设为当前活动文档。
	*
	* keep-alive 多实例场景下，renderer 在可见 slot 切换时调用它，
	* 让 main 侧 active file 与内容区可见文档保持一致。
	*
	* 同时（§2.4 触发2）：renderer 透传当前可见 slot 所属 `sessionId` 时一并记为前台会话。
	* 注意这只是「带预览激活」时的顺带上报；前台会话的**权威来源**是 renderer 在每次会话切换时
	* 调用的 {@link setForegroundSession}（HC-6），切到无预览会话时也能正确更新前台标记。
	*/
	activateEmbeddedPreviewContext(documentResourceUri, sessionId) {
		if (typeof sessionId === "string" && sessionId.trim()) this.setForegroundSession(sessionId.trim());
		return this.contextManager.activateFileContext(documentResourceUri);
	}
	/**
	* 记录/清除当前前台会话 id（§2.4 触发2 判定来源）。
	* renderer 切到会话 X 的可见预览时上报 X；无前台预览时可传 `null` 清除。
	*/
	setForegroundSession(sessionId) {
		const next = typeof sessionId === "string" && sessionId.trim() ? sessionId.trim() : null;
		if (next === this.foregroundSessionId) return;
		windowLog.info("[TencentDocsDocumentService] foreground session changed", {
			previous: this.foregroundSessionId,
			next
		});
		this.foregroundSessionId = next;
	}
	/**
	* §2.4 触发2：非前台会话 S 的 turn 结束收尾。
	*
	* 跳过（不关，保持 `OPEN`）的两种情况：
	* - `skipped:'foreground'`：S 是当前前台会话（用户仍在看），不自动关（S-SW-06）。
	* - `skipped:'unknown-foreground'`：前台尚未上报（首开竞态：turn 终态事件早于 renderer 的
	*   `activateContext` 到达）→ fail-safe **不关**，避免误关用户正盯着的刚开预览；该会话切走时由触发1 兜底。
	* - `skipped:'empty'`：S 无任何 preview context。
	*
	* 后台 turn 结束时，主进程不再用带弹框的 release 流程关闭 renderer preview context；
	* 但会对 clean context 跑一次无弹框 `release-if-clean` 兜底，覆盖 renderer 未挂载 /
	* processing 状态漏同步等情况。dirty / SDK 状态不确定仍保留。
	*
	* 注意区分两类生命周期：
	* - agent hook `open_file` 打开的无 preview editor：同一个 terminal 事件后续会走
	*   `reconcileAgentOpenedEditors` 做 save+close，这是 hook open_file 的退出主路径。
	* - renderer 已创建的 preview context：由 keep-alive 池在 processing 结束时
	*   release-if-clean（clean 出池，dirty 保留），或由用户显式关闭 / 容量淘汰管理；
	*   主进程兜底只补无弹框 release-if-clean，不能调用 `releaseEmbeddedPreviewContext` 弹保存框。
	*/
	async handleBackgroundSessionTurnEnd(sessionId) {
		const targetSessionId = sessionId.trim();
		if (!targetSessionId) return {
			closed: false,
			skipped: "empty"
		};
		if (this.foregroundSessionId === null) return {
			closed: false,
			skipped: "unknown-foreground"
		};
		if (targetSessionId === this.foregroundSessionId) return {
			closed: false,
			skipped: "foreground"
		};
		const contexts = this.contextManager.getFilePreviewContexts({ sessionId: targetSessionId }).sort((a, b) => a.createdAt - b.createdAt);
		if (contexts.length === 0) return {
			closed: false,
			skipped: "empty"
		};
		for (const context of contexts) try {
			await this.releaseEmbeddedPreviewContextIfClean(context.documentResourceUri);
		} catch (error) {
			windowLog.warn("[TencentDocsDocumentService] background turn-end release-if-clean failed", {
				documentResourceUri: context.documentResourceUri,
				sessionId: targetSessionId,
				error: toErrorMessage(error)
			});
		}
		return {
			closed: false,
			skipped: "preview-managed"
		};
	}
	/**
	* 温和淘汰：只在 SDK editor 当前为干净时释放，dirty 则保留 context 不弹框。
	*
	* 纯门面委托：RELEASING 两段式 FSM 包装已下沉到 `LocalDocumentPreviewReleaseManager.releaseIfClean` 内部。
	*/
	async releaseEmbeddedPreviewContextIfClean(documentResourceUri, options = {}) {
		return this.localDocumentPreviewReleaseManager.releaseIfClean(documentResourceUri, options);
	}
	/**
	* 一次「非自写」外部原文档变更的决策入口（由 {@link LocalDocumentOriginalSaveGuard} 的
	* `onExternalOriginalChange` 注入调用）。按 §1.1 二维矩阵（脏态 × 是否有可视预览）分级，
	* 并回传 {@link ExternalOriginalChangeOutcome} 供 guard 收尾其 baseline/notified 状态：
	*
	* - 删除/不可读（`deleted`）→ **永不重载**：有预览走冲突弹窗，无预览由末尾 `silent` 兜底。
	* - `isDirty === true`（editor 有未保存改动）→ 冲突弹窗（保护未保存内容）。
	* - `isDirty === undefined`（SDK 未就绪/查询失败）+ 有预览 → 保守弹窗；无预览 → 静默。
	* - `isDirty === false`（干净 live editor）+ 有预览 → 自动重载（去抖 + 二次自写复核 + releaseIfClean）；
	*   被拒（dirty 竞态/失败）回落弹窗；命中自写则静默；无预览 → 静默。
	*
	* 「静默」是根治本 issue 误报的关键分支：agent 产物文件没有可视预览时，任何外部写都不打扰用户。
	*/
	async handleExternalOriginalChange(notification) {
		const hasVisiblePreview = !!this.getEmbeddedPreviewContextInfo(notification.documentResourceUri);
		if (notification.isDirty === true || (notification.deleted || notification.isDirty === void 0) && hasVisiblePreview) {
			await this.emitNotifyOriginalFileChanged(notification);
			return "notified";
		}
		if (notification.isDirty === false && hasVisiblePreview) {
			const reload = await this.reloadEmbeddedPreviewContext(notification.documentResourceUri);
			if (reload.status === "reloaded") return "reloaded";
			if (reload.status === "skipped-self-write") return "silent";
			await this.emitNotifyOriginalFileChanged(notification);
			return "notified";
		}
		return "silent";
	}
	/**
	* 干净预览外部变更的自动重载原语（daemon 只负责彻底作废旧 in-memory editor，不 reopen）。
	*
	* 流程：coalesce/去抖 → 二次自写复核（settled `last_saved_ms`）→ `releaseIfClean` 彻底降到 ABSENT
	* → release settle 后 `pushPreviewReload`。renderer 收到 push 后作为唯一 reopen 方强制重挂，
	* 靠 `acquireOpenLease` 的 `acquired` 全新建立（新 previewUrl/context/fileId/baseline），杜绝复用旧实例。
	*
	* 同一 uri 的并发/连续调用复用同一 in-flight 任务（single-flight），只跑一次 release+push。
	*/
	async reloadEmbeddedPreviewContext(documentResourceUri) {
		const context = this.getEmbeddedPreviewContextInfo(documentResourceUri);
		if (!context || isTencentOnlineFilePath(context.filePath)) return { status: "no-context" };
		const key = context.documentResourceUri;
		const existing = this.pendingPreviewReloads.get(key);
		if (existing) return existing;
		const task = this.runPreviewReload(key, context.filePath).finally(() => {
			if (this.pendingPreviewReloads.get(key) === task) this.pendingPreviewReloads.delete(key);
		});
		this.pendingPreviewReloads.set(key, task);
		return task;
	}
	/** {@link reloadEmbeddedPreviewContext} 的真实工作：去抖 → 二次自写复核 → releaseIfClean → push。 */
	async runPreviewReload(documentResourceUri, filePath) {
		if (this.previewReloadDebounceMs > 0) await wait(this.previewReloadDebounceMs);
		const context = this.getEmbeddedPreviewContextInfo(documentResourceUri);
		if (!context || isTencentOnlineFilePath(context.filePath)) return { status: "no-context" };
		if (await this.isReloadTargetEditorSdkSelfWrite(context.filePath)) {
			windowLog.info("[TencentDocsDocumentService] reload abandoned: settled last_saved_ms indicates editor_sdk self-write", {
				documentResourceUri,
				filePath: context.filePath
			});
			return { status: "skipped-self-write" };
		}
		const result = await this.releaseEmbeddedPreviewContextIfClean(context.documentResourceUri);
		if (result.released) {
			this.pushPreviewReload({
				documentResourceUri: context.documentResourceUri,
				filePath: context.filePath
			});
			windowLog.info("[TencentDocsDocumentService] preview reload released and pushed", {
				documentResourceUri: context.documentResourceUri,
				filePath: context.filePath
			});
			return { status: "reloaded" };
		}
		windowLog.info("[TencentDocsDocumentService] preview reload declined by release-if-clean", {
			documentResourceUri: context.documentResourceUri,
			filePath: context.filePath,
			reason: result.reason
		});
		return {
			status: "declined",
			reason: result.reason === "dirty" ? "dirty" : "failed"
		};
	}
	/**
	* reload 前的二次自写复核：用**重新查询**的 settled `last_saved_ms` 对比文件 mtime，
	* 判据与 guard 前置自写检测（{@link isEditorSdkSelfWriteByMtime}）完全一致。
	* 文件已删除/不可读、SDK 未就绪、未匹配到 editor 时一律按「非自写」返回 false（保守放行到 releaseIfClean）。
	*/
	async isReloadTargetEditorSdkSelfWrite(filePath) {
		let fileMtimeMs;
		try {
			fileMtimeMs = (await (0, node_fs_promises.stat)(filePath)).mtimeMs;
		} catch {
			return false;
		}
		const status = await this.docsService.getEditorStatusByFilePath(filePath);
		if (!status.success || status.notFound) return false;
		const lastSavedMs = this.localSdkEditorFileIds.matchByFilePath(status.openEditors, filePath)?.last_saved_ms;
		return isEditorSdkSelfWriteByMtime(fileMtimeMs, lastSavedMs);
	}
	/** 把 reload 意图推给 renderer（唯一 reopen 方）；未注入 handler 或推送抛错时只记录日志。 */
	pushPreviewReload(payload) {
		if (!this.previewReloadHandler) {
			windowLog.info("[TencentDocsDocumentService] preview reload handler not set, skip push", payload);
			return;
		}
		try {
			this.previewReloadHandler(payload);
		} catch (error) {
			windowLog.warn("[TencentDocsDocumentService] preview reload push failed", {
				documentResourceUri: payload.documentResourceUri,
				filePath: payload.filePath,
				error: toErrorMessage(error)
			});
		}
	}
	/** 走现有冲突弹窗（`defaultNotifyOriginalFileChanged` 内部按 clean/dirty 分文案）；抛错只记录不冒泡。 */
	async emitNotifyOriginalFileChanged(notification) {
		try {
			await this.notifyOriginalFileChanged(notification);
		} catch (error) {
			windowLog.warn("[TencentDocsDocumentService] notify original file changed failed", {
				documentResourceUri: notification.documentResourceUri,
				filePath: notification.filePath,
				error: toErrorMessage(error)
			});
		}
	}
	/**
	* 异步触发后不等待：在 SDK editor pool 完成注册后，把真实 file_id
	* 写回 `TencentDocsContextManager` 中对应的 file context。
	*
	* 调用方**不要 await**：embedded preview 的同步路径要立即返回，
	* 真实 file_id 后续可由消费方通过 `getActiveDocumentContext`/`getFilePreviewContext...`
	* 重新读取。任何内部异常都会被 catch 转成 warn，不会漏到 unhandledRejection。
	*
	* `source` 仅用于日志区分入口，不影响逻辑。
	*/
	hydrateLocalSdkEditorFileIdWhenReady(params) {
		this.hydrateLocalSdkEditorFileIdWhenReadyInternal(params).catch((error) => {
			windowLog.warn("[TencentDocsDocumentService] async local SDK editor file_id hydration threw", {
				...params,
				error: toErrorMessage(error)
			});
		});
	}
	/**
	* 实际执行延迟回填的循环：按 `LOCAL_SDK_FILE_ID_HYDRATION_RETRY_DELAYS_MS` 等待若干轮，
	* 每轮检查 SDK editor pool 是否已经能解析出 file_id，能就回填并立即结束。
	*
	* 退出条件（按顺序判断）：
	*   1. context 已被释放（`!currentContext`）：上下文不在了，无须再回填；
	*   2. context 已有 fileId（`currentContext.fileId`）：可能被别的路径抢先填了；
	*   3. resolve 出 fileId：写回后结束；
	*   4. 重试表用尽：放弃，不再重试也不抛错（首屏没拿到 fileId 不是致命错误，
	*      下一次用户操作仍会走同步快路径）。
	*/
	async hydrateLocalSdkEditorFileIdWhenReadyInternal(params) {
		for (const delayMs of LOCAL_SDK_FILE_ID_HYDRATION_RETRY_DELAYS_MS) {
			await wait(delayMs);
			const currentContext = this.contextManager.getFilePreviewContext(params.documentResourceUri);
			if (!currentContext) return;
			if (currentContext.fileId) return;
			const fileId = await this.localSdkEditorFileIds.resolveFileId(params.filePath);
			if (fileId) {
				this.contextManager.updateFileContextFileId(params.documentResourceUri, fileId);
				return;
			}
		}
	}
	/**
	* iframe 内部文档 tab 切换/关闭前的 dirty guard 门面。
	*
	* 返回 `false` 时 renderer/webview 必须取消本次内部 tab 行为；返回 `true` 才允许继续。
	*/
	async confirmIframeInternalDocumentTabAction(documentResourceUri, targetFileId) {
		return this.localDocumentPreviewCloseManager.confirmIframeInternalDocumentTabAction(documentResourceUri, targetFileId);
	}
	/**
	* 接收 renderer/webview 上报的文档选区变化。
	*
	* 该信息会写入 context manager，供系统提示词和工具调用知道当前活跃文档及选区。
	*/
	reportDocumentSelection(params) {
		this.contextManager.reportDocumentSelection(params);
	}
	/**
	* 获取当前活跃的 AI Docs 文档上下文。
	*
	* prompt 拼接层通过它决定是否注入本地腾讯文档相关上下文。
	*/
	getActiveDocumentContext(sessionId) {
		return this.contextManager.getActiveDocumentContext(sessionId);
	}
	/**
	* 返回当前活跃文档的轻量元数据快照，供 host 侧路由门控使用。
	*
	* 与 {@link getActiveDocumentContext} 的区别见 {@link ActiveFileContextInfo}。
	*/
	getActiveFileContextInfo(sessionId) {
		return this.contextManager.getActiveFileContextInfo(sessionId);
	}
	/** 在线腾讯文档活跃时返回快照，否则 null。详见 contextManager 同名方法。 */
	getActiveOnlineDocumentInfo(sessionId) {
		return this.contextManager.getActiveOnlineDocumentInfo(sessionId);
	}
	/**
	* 聚合本轮 Tencent Docs routing 所需的 host 侧文档上下文（选区/host 多源仲裁 + turn 租约 + ActiveDocument）。
	* `AdditionalDataSection` every_turn 直接调用 daemon 内 singleton；实现见 `prompt/turn-document-routing-context.ts`。
	* 内部实现是纯同步内存操作，外层保留 Promise 签名以兼容现有调用。
	*/
	async buildTurnDocumentRoutingContext(input) {
		return buildTurnDocumentRoutingContext(this, input);
	}
	/**
	* 订阅文档选区变化。
	*
	* 返回的函数用于取消订阅，避免 UI 或服务生命周期结束后继续收到通知。
	*/
	onSelectionChange(listener) {
		windowLog.debug("[TencentDocsDocumentService] add selection change listener");
		return this.contextManager.onSelectionChange(listener);
	}
};
function normalizeLocalDocumentFilePath(input) {
	const trimmed = input.trim().replace(/^["']|["']$/g, "");
	if (!trimmed) return "";
	const cleaned = normalizeLocalFilePathInput(trimmed);
	if (!cleaned) return "";
	const absolute = node_path.isAbsolute(cleaned) || /^[a-zA-Z]:[/\\]/.test(cleaned) ? cleaned : normalizeLocalFilePathInput(node_path.resolve(cleaned));
	return toCanonicalRealPath(process.platform === "win32" && /^[a-zA-Z]:/.test(absolute) ? absolute.replace(/\//g, node_path.sep) : absolute);
}
/**
* 提取文件路径的扩展名（小写，含前导点）。
*
* 与 `path.extname` 不同：当 basename 以 "." 开头且不再含其他 "."（即 dotfile，
* 如 `.xlsx`、`.docx`）时，Node 的 `path.extname` 会返回空串——它认为这是
* 一个没有扩展名的隐藏文件名。但对于用户实际命名的"无文件名只有扩展名"的
* 文件（例如桌面上的 `.xlsx`），我们需要把整个 basename 当作扩展名识别。
*
* 规则：
*  1. 优先使用 `path.extname` 的结果。
*  2. 若结果为空且 basename 以 "." 开头并且 basename 中只有这一个 "."
*     —— 说明是 dotfile-style 输入，把整个 basename（小写）作为扩展名返回。
*  3. 其他情况返回空串。
*/
function extractFileExtension(filePath) {
	const ext = node_path.extname(filePath).toLowerCase();
	if (ext) return ext;
	const base = node_path.basename(filePath);
	if (base.startsWith(".") && base.indexOf(".", 1) === -1) return base.toLowerCase();
	return "";
}
/**
* 判断本地文件是否属于 WorkBuddy 支持 AI 能力的文档品类。
* 这是 AI 能力入口策略，不代表腾讯文档引擎的完整格式能力。
*/
function isSupportedLocalDocumentFilePath(filePath) {
	return aiFileExtensionWhitelistSet.has(extractFileExtension(filePath));
}
function toErrorMessage(error) {
	return error instanceof Error ? error.message : String(error);
}
var sharedManager = null;
function initializeTencentDocsDocumentService(options = {}) {
	if (sharedManager) {
		if (Object.keys(options).length > 0) throw new Error("[TencentDocsDocumentService] singleton already initialized before host options were provided");
		return sharedManager;
	}
	sharedManager = new TencentDocsDocumentService(options);
	return sharedManager;
}
function getTencentDocsDocumentService() {
	return initializeTencentDocsDocumentService();
}
//#endregion
//#region ../../packages/workbuddy-server/src/docs/prompt/tencent-docs-prompt-selection.ts
/** 读取并 trim 字符串值；空串 / 非字符串返回 `undefined`。 */
function readString(value) {
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : void 0;
}
/**
* 从选区 payload 里剥掉仅供 UI/prompt 使用的字段，得到注入 `<selection_payload>` 的
* 机器可读子集。这是 server strip 侧；与其成对的 UI encode 侧在
* packages/agent-ui/src/hooks/use-active-document-selection.ts 的 createDocumentSelectionContextBlock，
* 那里刻意保留 text/description 作为 badge label 来源，最终由本函数统一剥离，两处需成对维护。
*/
function readPromptSelectionPayload(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) return value;
	const { aiPrompt: _aiPrompt, sourceApi: _sourceApi, text: _text, description: _description, ...rest } = value;
	return rest;
}
/**
* 从单个 `tdoc-selection://` ContentBlock 解析出 `TencentDocsActiveSelection`。
*
* 解析规则：
* - `type` 必须为 `'resource_link'`，`_meta.mentionType` 必须为 `'tencentDocsSelection'`；
* - `filePath` 优先读 `_meta.filePath`，缺失时退到 `_meta.documentResourceUri`；
* - `fileId` 的来源按优先级：`_meta.fileId` > 从 `documentResourceUri` 提取在线 fileId
*   > 从 `filePath` 提取在线 fileId。本地文档还会经 `resolveToolUsableLocalFileId` 过滤
*   掉 preview globalPadId，避免把临时 padId 误注入 prompt；
* - `raw` 默认使用前端透传的 `_meta.selectionPayload`，缺失时合成最小结构（`{ rangeId, fileId? }`）。
*
* 任意必填字段（`filePath` / `rangeId`）缺失则返回 `undefined`，调用方直接跳过该 block。
*/
function parseTencentDocsSelectionBlock(block) {
	if (block.type !== "resource_link") return;
	const meta = block._meta;
	if (meta?.mentionType !== "tencentDocsSelection") return;
	const documentResourceUri = readString(meta.documentResourceUri);
	const filePath = readString(meta.filePath) ?? documentResourceUri;
	const rangeId = readString(meta.rangeId);
	if (!filePath || !rangeId) return;
	const fileType = readString(meta.fileType) ?? "unknown";
	const rawFileId = readString(meta.fileId) ?? (documentResourceUri ? extractTencentOnlineFileId(documentResourceUri) : void 0) ?? extractTencentOnlineFileId(filePath);
	const fileId = extractTencentOnlineFileId(filePath) ? rawFileId : resolveToolUsableLocalFileId(filePath, rawFileId);
	const sourceApi = readString(meta.sourceApi) ?? "documentSelectionContextBlock";
	const raw = meta.selectionPayload ? readPromptSelectionPayload(meta.selectionPayload) : {
		rangeId,
		...fileId ? { fileId } : {}
	};
	return {
		filePath,
		fileType,
		...fileId ? { fileId } : {},
		sourceApi,
		raw
	};
}
/**
* 从 renderer 注入的 selection ContentBlock 取所有选区（发送时凝固，不会被后续 store 变更覆盖）。
* 支持多个选区 chip。
*
* 调用方分工：
* - `AdditionalDataSection` 将全部 chip 合并成一个 selection-payload list；
* - 取最后一个 chip 作为 `activeSelection` 传入 `buildTurnDocumentRoutingContext` 做活跃文档仲裁。
*
* 注意：_meta.aiPrompt 只是 chip 首次创建时的初始值，用户在 chat input 中可二次编辑，
* 因此发送时不再读取 _meta.aiPrompt——用户的最终意图已体现在 prompt 的普通文本块中。
*/
function getAllTencentDocsSelectionsFromPrompt(prompt) {
	const results = [];
	for (const block of prompt) {
		const selection = parseTencentDocsSelectionBlock(block);
		if (selection) results.push(selection);
	}
	return results;
}
//#endregion
Object.defineProperty(exports, "FileWatchService", {
	enumerable: true,
	get: function() {
		return FileWatchService;
	}
});
Object.defineProperty(exports, "TENCENT_DOCS_AI_FILE_SUPPORT_WHITELIST", {
	enumerable: true,
	get: function() {
		return TENCENT_DOCS_AI_FILE_SUPPORT_WHITELIST;
	}
});
Object.defineProperty(exports, "TENCENT_ONLINE_FILE_PATH_PREFIX", {
	enumerable: true,
	get: function() {
		return TENCENT_ONLINE_FILE_PATH_PREFIX;
	}
});
Object.defineProperty(exports, "allocateDocumentSelectionSequence", {
	enumerable: true,
	get: function() {
		return allocateDocumentSelectionSequence;
	}
});
Object.defineProperty(exports, "buildLocalDocumentSaveChoices", {
	enumerable: true,
	get: function() {
		return buildLocalDocumentSaveChoices;
	}
});
Object.defineProperty(exports, "createNativeHostDirtyEditorCloseDecision", {
	enumerable: true,
	get: function() {
		return createNativeHostDirtyEditorCloseDecision;
	}
});
Object.defineProperty(exports, "createNativeHostOriginalFileChangedNotifier", {
	enumerable: true,
	get: function() {
		return createNativeHostOriginalFileChangedNotifier;
	}
});
Object.defineProperty(exports, "createNativeHostOriginalFileConflictDecision", {
	enumerable: true,
	get: function() {
		return createNativeHostOriginalFileConflictDecision;
	}
});
Object.defineProperty(exports, "detectDocumentFileType", {
	enumerable: true,
	get: function() {
		return detectDocumentFileType;
	}
});
Object.defineProperty(exports, "extractTencentOnlineFileId", {
	enumerable: true,
	get: function() {
		return extractTencentOnlineFileId;
	}
});
Object.defineProperty(exports, "filterTencentDocsAiServiceFilePaths", {
	enumerable: true,
	get: function() {
		return filterTencentDocsAiServiceFilePaths;
	}
});
Object.defineProperty(exports, "formatLocalPreviewText", {
	enumerable: true,
	get: function() {
		return formatLocalPreviewText$1;
	}
});
Object.defineProperty(exports, "getActiveTencentDocsEngineOrigin", {
	enumerable: true,
	get: function() {
		return getActiveTencentDocsEngineOrigin;
	}
});
Object.defineProperty(exports, "getAllTencentDocsSelectionsFromPrompt", {
	enumerable: true,
	get: function() {
		return getAllTencentDocsSelectionsFromPrompt;
	}
});
Object.defineProperty(exports, "getLocalDocumentDialogButtonIds", {
	enumerable: true,
	get: function() {
		return getLocalDocumentDialogButtonIds;
	}
});
Object.defineProperty(exports, "getLocalDocumentWriteAccess", {
	enumerable: true,
	get: function() {
		return getLocalDocumentWriteAccess;
	}
});
Object.defineProperty(exports, "getTencentDocsDocumentService", {
	enumerable: true,
	get: function() {
		return getTencentDocsDocumentService;
	}
});
Object.defineProperty(exports, "getTextMentionedLocalOfficeFilePaths", {
	enumerable: true,
	get: function() {
		return getTextMentionedLocalOfficeFilePaths;
	}
});
Object.defineProperty(exports, "hasTencentDocsAiServiceExtension", {
	enumerable: true,
	get: function() {
		return hasTencentDocsAiServiceExtension;
	}
});
Object.defineProperty(exports, "initializeTencentDocsDocumentService", {
	enumerable: true,
	get: function() {
		return initializeTencentDocsDocumentService;
	}
});
Object.defineProperty(exports, "isSupportedLocalDocumentFilePath", {
	enumerable: true,
	get: function() {
		return isSupportedLocalDocumentFilePath;
	}
});
Object.defineProperty(exports, "isTencentOnlineFilePath", {
	enumerable: true,
	get: function() {
		return isTencentOnlineFilePath;
	}
});
Object.defineProperty(exports, "mainLog", {
	enumerable: true,
	get: function() {
		return mainLog;
	}
});
Object.defineProperty(exports, "mergeUniquePaths", {
	enumerable: true,
	get: function() {
		return mergeUniquePaths;
	}
});
Object.defineProperty(exports, "normalizeLocalDocumentFilePath", {
	enumerable: true,
	get: function() {
		return normalizeLocalDocumentFilePath;
	}
});
Object.defineProperty(exports, "onActiveTencentDocsEngineOriginChange", {
	enumerable: true,
	get: function() {
		return onActiveTencentDocsEngineOriginChange;
	}
});
Object.defineProperty(exports, "requestLocalDocumentSaveAsPath", {
	enumerable: true,
	get: function() {
		return requestLocalDocumentSaveAsPath;
	}
});
Object.defineProperty(exports, "setActiveTencentDocsEngineOrigin", {
	enumerable: true,
	get: function() {
		return setActiveTencentDocsEngineOrigin;
	}
});
Object.defineProperty(exports, "setMenuLocale", {
	enumerable: true,
	get: function() {
		return setMenuLocale;
	}
});
Object.defineProperty(exports, "shouldBlockLocalDocumentOpenAttempt", {
	enumerable: true,
	get: function() {
		return shouldBlockLocalDocumentOpenAttempt;
	}
});
Object.defineProperty(exports, "windowLog", {
	enumerable: true,
	get: function() {
		return windowLog;
	}
});
