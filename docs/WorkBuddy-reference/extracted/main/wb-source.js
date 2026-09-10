const require_tencent_docs_prompt_selection = require("./tencent-docs-prompt-selection.js");
//#region ../../packages/workbuddy-server/src/tencent-docs/online/online-doc-preview-registry.ts
/**
* 在线腾讯文档预览登记表：`registrationId → 记录`，附带 `fileId` 二级索引。
*
* docs.qq.com 在线预览没有 documentResourceUri 链路（免登 302 会丢私有 query），
* 由 renderer 在打开预览时登记，mqq 选区据此反查归属。
* sessionId 允许缺失：资料库点击会先切欢迎页清掉 currentConversation。
*
* ## 为什么从「fileId → 单记录」改成 token 化
*
* 旧模型一个 fileId 只留一条记录、后注册覆盖前者，于是同一篇在线文档在两个会话里
* 同时打开时会出现三个问题：
* - last-wins：先打开那个会话的选区被路由到后打开的会话；
* - 误注销：关闭其中一个预览，会把另一个还开着的记录一起删掉；
* - 跨会话串路由：payload 只带 fileId 时无法判断该给谁。
*
* 现在每个预览实例拿到自己的 token，注销只删自己的。同一 fileId 有多个候选时，
* 按 payload fileId 的兜底路由会拒绝而不是随便挑一个——宁可没有选区，也不能串会话。
*
* ## 兼容
*
* 旧的 `register(fileId, sessionId)` / `unregister(fileId)` 保留原语义：它们操作
* 该 fileId 的「无 token 槽位」，重复注册就地更新。新调用点用
* `registerInstance` 拿 token。
*/
/** 无 token 的历史调用共用的槽位。同一 fileId 只有一个，重复注册就地更新。 */
function legacyRegistrationId(fileId) {
	return `legacy:${fileId}`;
}
var registrationCounter = 0;
var OnlineDocPreviewRegistry = class {
	constructor() {
		this.records = /* @__PURE__ */ new Map();
		this.byFileId = /* @__PURE__ */ new Map();
		this.byGuest = /* @__PURE__ */ new Map();
	}
	/**
	* 历史入口：操作该 fileId 的无 token 槽位，重复注册就地更新。
	*
	* 保留它是为了让尚未接入 token 的调用点行为不变；新代码请用 {@link registerInstance}。
	*/
	register(fileId, sessionId) {
		if (!fileId) return;
		this.upsert(legacyRegistrationId(fileId), fileId, sessionId);
	}
	/**
	* 多实例入口：每次调用产生独立记录，返回注销用的 token。
	*
	* 同一 fileId 可以有任意多个实例共存，互不覆盖。
	*/
	registerInstance(fileId, sessionId) {
		if (!fileId) return;
		registrationCounter += 1;
		const registrationId = `preview:${registrationCounter}:${Date.now().toString(36)}`;
		this.upsert(registrationId, fileId, sessionId);
		return registrationId;
	}
	/** webview dom-ready 后把 guest webContents 绑到记录上，供 sender 精确反查。 */
	bindGuest(registrationId, guestWebContentsId) {
		const record = this.records.get(registrationId);
		if (!record) return;
		if (record.guestWebContentsId !== void 0) this.byGuest.delete(record.guestWebContentsId);
		record.guestWebContentsId = guestWebContentsId;
		this.byGuest.set(guestWebContentsId, registrationId);
	}
	/**
	* 按 sender guest 精确定位记录。
	*
	* 这是首选路由方式：它不依赖 payload 里的 fileId，因此不受同 fileId 多实例影响。
	*/
	getRecordByGuest(guestWebContentsId) {
		const registrationId = this.byGuest.get(guestWebContentsId);
		if (!registrationId) return;
		const record = this.records.get(registrationId);
		return record ? { sessionId: record.sessionId } : void 0;
	}
	/**
	* 按 fileId 反查。
	*
	* 存在多个候选时返回最近注册的那个，仅用于「已知是在线文档」的判定；
	* 需要确定归属时请用 {@link countRegistrationsForFileId} 先确认唯一，
	* 或者走 guest 精确反查。
	*/
	getRecordByFileId(fileId) {
		const record = this.pickLatestForFileId(fileId);
		return record ? { sessionId: record.sessionId } : void 0;
	}
	getSessionByFileId(fileId) {
		return this.pickLatestForFileId(fileId)?.sessionId;
	}
	/**
	* 该 fileId 当前有几个预览实例。
	*
	* 路由层用它判断能否做 payload fileId 兜底：>1 时候选不唯一，
	* 必须拒绝而不是随便挑一个，否则会把选区送进错误的会话。
	*/
	countRegistrationsForFileId(fileId) {
		return this.byFileId.get(fileId)?.size ?? 0;
	}
	/** 历史入口：只删该 fileId 的无 token 槽位，不影响其它实例。 */
	unregister(fileId) {
		this.deleteRegistration(legacyRegistrationId(fileId));
	}
	/** 多实例入口：只删自己的 token，兄弟实例不受影响。 */
	unregisterInstance(registrationId) {
		this.deleteRegistration(registrationId);
	}
	/** chat 删除时清掉该 session 关联的全部记录。 */
	clearSession(sessionId) {
		const sid = sessionId?.trim();
		if (!sid) return;
		let removed = 0;
		for (const record of Array.from(this.records.values())) if (record.sessionId === sid) {
			this.deleteRegistration(record.registrationId);
			removed += 1;
		}
		if (removed > 0) require_tencent_docs_prompt_selection.windowLog.debug("[OnlineDocPreviewRegistry] clearSession", {
			sessionId: sid,
			removed,
			total: this.records.size
		});
	}
	upsert(registrationId, fileId, sessionId) {
		const sid = sessionId?.trim() || void 0;
		const existing = this.records.get(registrationId);
		const record = {
			registrationId,
			fileId,
			registeredAt: Date.now(),
			...sid ? { sessionId: sid } : {},
			...existing?.guestWebContentsId !== void 0 ? { guestWebContentsId: existing.guestWebContentsId } : {}
		};
		this.records.set(registrationId, record);
		const bucket = this.byFileId.get(fileId) ?? /* @__PURE__ */ new Set();
		bucket.add(registrationId);
		this.byFileId.set(fileId, bucket);
		require_tencent_docs_prompt_selection.windowLog.debug("[OnlineDocPreviewRegistry] register", {
			fileId,
			sessionId: sid,
			total: this.records.size
		});
	}
	deleteRegistration(registrationId) {
		const record = this.records.get(registrationId);
		if (!record) return;
		this.records.delete(registrationId);
		const bucket = this.byFileId.get(record.fileId);
		if (bucket) {
			bucket.delete(registrationId);
			if (bucket.size === 0) this.byFileId.delete(record.fileId);
		}
		if (record.guestWebContentsId !== void 0) this.byGuest.delete(record.guestWebContentsId);
		require_tencent_docs_prompt_selection.windowLog.debug("[OnlineDocPreviewRegistry] unregister", {
			fileId: record.fileId,
			total: this.records.size
		});
	}
	/** 多候选时取最近注册的一个。仅用于「是不是在线文档」的判定。 */
	pickLatestForFileId(fileId) {
		const bucket = this.byFileId.get(fileId);
		if (!bucket || bucket.size === 0) return;
		let latest;
		for (const registrationId of bucket) {
			const record = this.records.get(registrationId);
			if (!record) continue;
			if (!latest || record.registeredAt >= latest.registeredAt) latest = record;
		}
		return latest;
	}
};
var sharedRegistry = null;
function getOnlineDocPreviewRegistry() {
	sharedRegistry ??= new OnlineDocPreviewRegistry();
	return sharedRegistry;
}
//#endregion
//#region ../../packages/workbuddy-server/src/tencent-docs/remote/remote-document-identity.ts
/**
* 远端文档身份：在线与云沙箱两类资源 URI 的唯一定义处。
*
* daemon（路由、store）和 Electron main（注册表、身份派生）都要用同一套常量与
* 校验规则。放在 workbuddy-server 里由 desktop 反向引用，符合既有依赖方向——
* desktop 依赖 server，server 不依赖 desktop。
*/
/**
* 云端沙箱选区资源 URI scheme。
*
* 后面跟的是 main 从 `(sandboxId, canonicalSandboxPath)` 派生的 opaque key，
* 不可反解出沙箱内真实路径。刻意不用 `sandbox://`：那看起来像一个可导航的
* protocol，容易诱使后来者去注册它；`wb-sandbox-doc://` 一眼就是内部标识。
*/
var SANDBOX_DOCUMENT_RESOURCE_URI_SCHEME = "wb-sandbox-doc://";
/**
* 校验云沙箱文档资源 URI。
*
* 只接受 main 派生的形态：scheme + 十六进制 opaque key。guest 即便知道 scheme
* 也拼不出一个能命中别人记录的 key（那需要同时知道对方的 sandboxId 与路径，
* 且 key 是 sha256 截断）。
*/
function isSandboxDocumentResourceUri(uri) {
	if (!uri.startsWith("wb-sandbox-doc://")) return false;
	const key = uri.slice(17);
	return /^[a-f0-9]{16,64}$/.test(key);
}
/**
* 校验沙箱路径元数据。
*
* 它只作为 UI title 与调试信息随通知下发，不参与任何路径拼接；但仍然挡住
* traversal，避免未来某个消费方把它当成路径用。
*/
function isCanonicalSandboxPath(path) {
	if (!path.startsWith("agent:///")) return false;
	if (path.includes("\\") || path.includes("\0")) return false;
	return !path.split("/").includes("..");
}
//#endregion
//#region ../../packages/workbuddy-server/src/tencent-docs/remote/remote-document-selection-store.ts
/** 广播文本上限。store 内部状态保留完整 selection，只有对外通知截断。 */
var MAX_SELECTION_TEXT_LENGTH_FOR_BROADCAST = 240;
var NO_SESSION_BUCKET = "__no_session__";
/**
* 桶内键：文档 + 预览实例。
*
* 同一个 scope 里同一篇文档可能同时开着两个预览（例如主对话和助理各开一个），
* 只按文档分桶会让后开的覆盖先开的，关掉其中一个还会把另一个的选区一起清掉。
*/
function recordKeyOf(documentResourceUri, previewInstanceId) {
	return `${documentResourceUri}\n${previewInstanceId}`;
}
var RemoteDocumentSelectionStore = class {
	constructor() {
		this.bySession = /* @__PURE__ */ new Map();
		this.listeners = /* @__PURE__ */ new Set();
	}
	onSelectionChange(listener) {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}
	/** 传 sessionId 仅看该桶；不传则跨所有桶按 sequence 取最新（兼容 unit test）。 */
	getActiveSelection(sessionId) {
		if (sessionId) {
			const bucket = this.bySession.get(sessionId);
			return bucket ? pickLatest(bucket) : null;
		}
		let latest = null;
		for (const bucket of this.bySession.values()) {
			const candidate = pickLatest(bucket);
			if (candidate && (!latest || candidate.sequence > latest.sequence)) latest = candidate;
		}
		return latest;
	}
	reportSelection(params, validate, logTag) {
		if (!validate(params.filePath)) {
			require_tencent_docs_prompt_selection.windowLog.warn(`${logTag} reject filePath that does not belong to this resource kind`, { filePath: params.filePath });
			return;
		}
		const sequenceStamp = require_tencent_docs_prompt_selection.allocateDocumentSelectionSequence();
		const { sequence } = sequenceStamp;
		const previewInstanceId = params.previewInstanceId?.trim() || "__legacy_preview__";
		const identity = {
			documentResourceUri: params.filePath,
			sessionId: params.sessionId,
			selectionScopeId: params.sessionId,
			previewInstanceId,
			filePath: params.filePath,
			fileType: params.fileType,
			...params.canonicalSandboxPath ? { canonicalSandboxPath: params.canonicalSandboxPath } : {}
		};
		if (params.sendAction) {
			if (!params.selection) {
				require_tencent_docs_prompt_selection.windowLog.info(`${logTag} selection send skipped: no selection`, {
					filePath: params.filePath,
					sessionId: params.sessionId
				});
				return;
			}
			this.notify({
				...identity,
				selection: truncateSelectionTextForBroadcast(params.selection),
				sendAction: true
			}, sequenceStamp);
			return;
		}
		const bucketKey = params.sessionId?.trim() || NO_SESSION_BUCKET;
		const bucket = this.bySession.get(bucketKey) ?? /* @__PURE__ */ new Map();
		if (!this.bySession.has(bucketKey)) this.bySession.set(bucketKey, bucket);
		const recordKey = recordKeyOf(params.filePath, previewInstanceId);
		if (!params.selection) {
			bucket.delete(recordKey);
			if (bucket.size === 0) this.bySession.delete(bucketKey);
			this.notify({
				...identity,
				selection: null
			}, sequenceStamp);
			return;
		}
		bucket.set(recordKey, {
			filePath: params.filePath,
			fileType: params.fileType,
			selection: params.selection,
			updatedAt: Date.now(),
			sequence,
			sessionId: params.sessionId,
			previewInstanceId
		});
		this.notify({
			...identity,
			selection: truncateSelectionTextForBroadcast(params.selection)
		}, sequenceStamp);
	}
	/**
	* 预览实例消失（unmount / host 销毁 / 灰度回滚）时清理它自己的选区。
	*
	* 只删这一条 `(scope, document, previewInstance)` 记录。同 scope 同文档的其它
	* 实例必须原样保留——关掉助理里的预览不能把主对话的 chip 一起抹掉。
	*/
	clearPreviewInstance(input) {
		const bucketKey = input.selectionScopeId?.trim() || NO_SESSION_BUCKET;
		const bucket = this.bySession.get(bucketKey);
		const recordKey = recordKeyOf(input.documentResourceUri, input.previewInstanceId);
		const existed = bucket?.delete(recordKey) ?? false;
		if (bucket && bucket.size === 0) this.bySession.delete(bucketKey);
		if (!existed) return;
		this.notify({
			documentResourceUri: input.documentResourceUri,
			sessionId: input.selectionScopeId,
			selectionScopeId: input.selectionScopeId,
			previewInstanceId: input.previewInstanceId,
			filePath: input.documentResourceUri,
			selection: null
		}, require_tencent_docs_prompt_selection.allocateDocumentSelectionSequence());
	}
	/**
	* chat 关闭时调用，清空该 session 的所有远端选区。
	*
	* 只清状态。sequence 由 daemon 全局 allocator 拥有，任何清理路径都不得重置它，
	* 否则 renderer 的高水位会把后续正常事件当成乱序丢掉。
	*/
	clearSession(sessionId, logTag) {
		if (!sessionId) return;
		if (this.bySession.delete(sessionId)) require_tencent_docs_prompt_selection.windowLog.debug(`${logTag} clearSession`, { sessionId });
	}
	notify(notification, sequenceStamp) {
		if (this.listeners.size === 0) return;
		const full = {
			...notification,
			...sequenceStamp
		};
		for (const listener of Array.from(this.listeners)) try {
			listener(full);
		} catch (error) {
			require_tencent_docs_prompt_selection.windowLog.warn("[RemoteDocsSelectionStore] listener threw", { error: error instanceof Error ? error.message : String(error) });
		}
	}
};
function pickLatest(bucket) {
	let latest = null;
	for (const record of bucket.values()) {
		if (!record.selection) continue;
		if (!latest || record.sequence > latest.sequence) latest = record;
	}
	return latest;
}
function truncateForBroadcast(text) {
	return text.length <= MAX_SELECTION_TEXT_LENGTH_FOR_BROADCAST ? text : text.slice(0, MAX_SELECTION_TEXT_LENGTH_FOR_BROADCAST) + "…";
}
function truncateSelectionTextForBroadcast(selection) {
	return {
		...selection,
		rangeId: selection.rangeId,
		text: truncateForBroadcast(selection.text)
	};
}
/**
* 云沙箱选区入口。
*
* 与在线门面对称，只是校验器换成 opaque URI 校验。它**只接受 main 已经完成实例
* 授权后构造的报文**：`documentResourceUri` 必须是 main 派生的 opaque 身份，
* guest 拼不出来。
*/
function reportSandboxSelection(store, params) {
	store.reportSelection(params, isSandboxDocumentResourceUri, SANDBOX_LOG_TAG);
}
var SANDBOX_LOG_TAG = "[SandboxDocsSelectionStore]";
var sharedStore$1 = null;
/**
* 进程内单例。在线与沙箱共用同一个实例，因此两类事件天然共享一条通知流，
* 不会出现「同一个 renderer 订阅了两个 store 导致重复广播」的问题。
*/
function getRemoteDocumentSelectionStore() {
	sharedStore$1 ??= new RemoteDocumentSelectionStore();
	return sharedStore$1;
}
//#endregion
//#region ../../packages/workbuddy-server/src/tencent-docs/online/online-document-selection-store.ts
var ONLINE_LOG_TAG = "[OnlineDocsSelectionStore]";
/** 在线资源校验：只接受 `tdoc://<file_id>`。 */
function isOnlineResource(filePath) {
	return require_tencent_docs_prompt_selection.isTencentOnlineFilePath(filePath);
}
var OnlineDocumentSelectionStore = class {
	/**
	* 默认挂到共享 remote 单例；测试里 `new OnlineDocumentSelectionStore()` 会拿到
	* 一个独立 remote 实例，保持既有用例的隔离语义。
	*/
	constructor(remote = new RemoteDocumentSelectionStore()) {
		this.remote = remote;
	}
	onSelectionChange(listener) {
		return this.remote.onSelectionChange(listener);
	}
	getActiveSelection(sessionId) {
		return this.remote.getActiveSelection(sessionId);
	}
	reportSelection(params) {
		this.remote.reportSelection(params, isOnlineResource, ONLINE_LOG_TAG);
	}
	clearSession(sessionId) {
		this.remote.clearSession(sessionId, ONLINE_LOG_TAG);
	}
};
var sharedStore = null;
function getOnlineDocumentSelectionStore() {
	sharedStore ??= new OnlineDocumentSelectionStore(getRemoteDocumentSelectionStore());
	return sharedStore;
}
//#endregion
//#region ../../packages/workbuddy-server/src/docs/route-mqq-selection.ts
function createMqqSelectionReporter(deps) {
	return (selection) => routeMqqSelectionReportWithDeps(selection, deps);
}
function routeMqqSelectionReportWithDeps(selection, deps) {
	const payloadFileId = readPayloadFileId(selection);
	require_tencent_docs_prompt_selection.windowLog.info("[TencentDocsMqqRoute] selection report routing start", {
		hasDocumentResourceUri: Boolean(selection.documentResourceUri),
		documentResourceUri: selection.documentResourceUri,
		sessionId: selection.sessionId,
		filePath: selection.filePath,
		fileType: selection.fileType,
		hasSelection: Boolean(selection.selection),
		rangeId: selection.selection?.rangeId,
		payloadFileId
	});
	if (selection.resourceKind === "sandbox") {
		routeSandboxSelection(selection, deps);
		return;
	}
	if (selection.documentResourceUri) {
		const onlineFileId = require_tencent_docs_prompt_selection.isTencentOnlineFilePath(selection.documentResourceUri) ? require_tencent_docs_prompt_selection.extractTencentOnlineFileId(selection.documentResourceUri) : void 0;
		if (onlineFileId) {
			routeOnlineSelection(selection, onlineFileId, "resource-uri", deps);
			return;
		}
		require_tencent_docs_prompt_selection.windowLog.info("[TencentDocsMqqRoute] route to local manager by documentResourceUri", {
			documentResourceUri: selection.documentResourceUri,
			payloadFileId
		});
		deps.documentService.reportDocumentSelection(selection);
		return;
	}
	const onlineFileId = resolveOnlineFileIdWithoutResourceUri(selection, deps);
	if (onlineFileId) {
		routeOnlineSelection(selection, onlineFileId, "registry-fallback", deps);
		return;
	}
	require_tencent_docs_prompt_selection.windowLog.warn("[TencentDocsMqqRoute] route to local manager fallback without documentResourceUri", {
		payloadFileId,
		filePath: selection.filePath,
		fileType: selection.fileType,
		hasSelection: Boolean(selection.selection)
	});
	deps.documentService.reportDocumentSelection(selection);
}
/**
* 云沙箱选区分流。
*
* 走 remote store 的 sandbox 入口，与在线共用同一个单例但校验器不同。
* 绝不会掉进 local manager：sandbox 资源一旦进入本地 manager，`agent:///`
* 元数据就会被当成本机路径参与本地文档上下文和 MCP 链路。
*
* 身份字段全部来自 main 的预览注册记录（见 desktop 侧 sandbox-mqq-authorizer），
* guest 无法影响路由目的地。这里再校验一次 URI 形态，是纵深防御——即便未来
* 有人在 main 侧引入旁路，daemon 也不会接受一个非 opaque 的沙箱资源。
*/
function routeSandboxSelection(selection, deps) {
	const documentResourceUri = selection.documentResourceUri;
	if (!documentResourceUri) {
		require_tencent_docs_prompt_selection.windowLog.warn("[TencentDocsMqqRoute] sandbox selection without document identity");
		return;
	}
	require_tencent_docs_prompt_selection.windowLog.info("[TencentDocsMqqRoute] route to sandbox selection store", {
		documentResourceUri,
		hasSelectionScopeId: Boolean(selection.selectionScopeId),
		hasPreviewInstanceId: Boolean(selection.previewInstanceId),
		hasSelection: Boolean(selection.selection),
		sendAction: Boolean(selection.sendAction)
	});
	const canonicalSandboxPath = typeof selection.filePath === "string" && isCanonicalSandboxPath(selection.filePath) ? selection.filePath : void 0;
	reportSandboxSelection(deps.remoteDocumentSelectionStore, {
		filePath: documentResourceUri,
		fileType: selection.fileType,
		selection: selection.selection,
		sessionId: selection.selectionScopeId ?? selection.sessionId,
		previewInstanceId: selection.previewInstanceId,
		sendAction: selection.sendAction,
		...canonicalSandboxPath ? { canonicalSandboxPath } : {}
	});
}
function routeOnlineSelection(selection, onlineFileId, source, deps) {
	const registeredFileId = resolveRegisteredOnlineFileId(onlineFileId, deps) ?? onlineFileId;
	const record = (typeof selection.guestWebContentsId === "number" ? deps.onlineDocPreviewRegistry.getRecordByGuest?.(selection.guestWebContentsId) : void 0) ?? deps.onlineDocPreviewRegistry.getRecordByFileId(registeredFileId);
	require_tencent_docs_prompt_selection.windowLog.info("[TencentDocsMqqRoute] route to online selection store", {
		documentResourceUri: selection.documentResourceUri,
		onlineFileId: registeredFileId,
		rawOnlineFileId: onlineFileId,
		sessionId: record?.sessionId,
		source
	});
	deps.onlineDocumentSelectionStore.reportSelection({
		filePath: `${require_tencent_docs_prompt_selection.TENCENT_ONLINE_FILE_PATH_PREFIX}${registeredFileId}`,
		fileType: selection.fileType,
		selection: selection.selection,
		sessionId: record?.sessionId,
		sendAction: selection.sendAction
	});
}
/**
* 仅当没有明确 documentResourceUri 时才允许 registry fallback。
* 本地文档的 mqq payload 也带 fileId；若已带 `file://...`，必须按本地路由处理。
*/
function resolveOnlineFileIdWithoutResourceUri(selection, deps) {
	if (require_tencent_docs_prompt_selection.isTencentOnlineFilePath(selection.filePath)) return require_tencent_docs_prompt_selection.extractTencentOnlineFileId(selection.filePath);
	if (hasNonEmptyLocalFilePath(selection.filePath)) return;
	const payloadFileId = readPayloadFileId(selection);
	if (!payloadFileId) return;
	const registered = resolveRegisteredOnlineFileId(payloadFileId, deps);
	if (registered) {
		const candidates = deps.onlineDocPreviewRegistry.countRegistrationsForFileId?.(registered) ?? 1;
		if (candidates > 1) {
			require_tencent_docs_prompt_selection.windowLog.warn("[TencentDocsMqqRoute] ambiguous online fileId fallback rejected", {
				onlineFileId: registered,
				candidates
			});
			return;
		}
		return registered;
	}
	return stripPadIdPrefix(payloadFileId) ?? payloadFileId;
}
/** 非空且非 tdoc:// 的 filePath 视为本地路径，禁止走 payload fileId 在线路由。 */
function hasNonEmptyLocalFilePath(filePath) {
	const trimmed = filePath?.trim();
	if (!trimmed) return false;
	return !require_tencent_docs_prompt_selection.isTencentOnlineFilePath(trimmed);
}
function resolveRegisteredOnlineFileId(fileId, deps) {
	if (deps.onlineDocPreviewRegistry.getRecordByFileId(fileId)) return fileId;
	const bareFileId = stripPadIdPrefix(fileId);
	if (bareFileId && deps.onlineDocPreviewRegistry.getRecordByFileId(bareFileId)) return bareFileId;
}
/**
* 腾讯文档前端 mqq payload 的 fileId 存在两种格式：
*   - 纯 fileId：`"CaСорAeQQsPc"`
*   - padId$fileId：`"300000000$CaСорAeQQsPc"`
* 资料库 API 只返回纯 fileId。本函数提取 `$` 后面的部分；无 `$` 时返回 undefined。
*/
function stripPadIdPrefix(fileId) {
	const dollarIdx = fileId.indexOf("$");
	if (dollarIdx < 0) return;
	const bare = fileId.slice(dollarIdx + 1);
	return bare.length > 0 ? bare : void 0;
}
function readPayloadFileId(selection) {
	const fileId = selection.selection && selection.selection.fileId;
	return typeof fileId === "string" && fileId.trim().length > 0 ? fileId : void 0;
}
//#endregion
//#region ../../packages/workbuddy-server/src/docs/tencent-docs-renderer-push.ts
var TENCENT_DOCS_RENDERER_PUSH_CHANNELS = {
	OPEN_LOCAL_FILE_IN_MAIN_WINDOW: "tencent-docs:openLocalFileInMainWindow",
	LOCAL_FILE_ALREADY_ACTIVE: "tencent-docs:localFileAlreadyActive",
	PREVIEW_POOL_FULL: "tencent-docs:previewPoolFull",
	ENGINE_READY: "tencent-docs:engineReady",
	RELOAD_EMBEDDED_PREVIEW: "tencent-docs:reloadEmbeddedPreview"
};
//#endregion
//#region ../../packages/workbuddy-server/src/docs/system-open-local-file.ts
/**
* 系统级入口（右键 / 双击 / argv）打开本地腾讯文档的 main 进程处理器。
*
* ## 职责（按拦截顺序）
* 1. **唤起主窗口**（showOrCreate）
* 2. **多会话冲突预检**：owned-by-other → 广播 `localFileAlreadyActive` 弹 Toast
* 3. **预览池容量硬闸门**：openLeaseCount >= capacity → 广播 `previewPoolFull` 弹 Toast，
*    不创建新会话（手动打开专属，不判断 owner 是否 processing）
* 4. 广播 `openLocalFileInMainWindow`，由 renderer 侧消费 daemon push 事件
*
* ## 不包含
* - 预览挂载、media artifact、选区路由、session 绑定
*   （由 renderer 本地文件打开模块编排，避免与 `openResultView` 轮询形成双路径竞态）
* - 文件路径校验 / 归一化
*   （由调用方 `handleOpenLocalDocumentFile` → `normalizeLocalDocumentFilePath` 保证）
*/
/**
* 创建 system-open 本地文档打开处理器。
*
* 工厂函数模式让调用方（`bootstrapMainProcess`）只负责注入依赖，
* 所有腾讯文档业务逻辑（冲突裁决 / IPC 广播）均在返回的函数内聚，
* 不污染通用的 bootstrap 层。
*
* @example
* ```ts
* openTencentDocsLocalFile: createSystemOpenLocalFileHandler({
*   windowManager,
*   documentService: wsRpc.documentService,
*   documentPreviewPoolCapacity: 5, // 必须与 renderer DOCUMENT_PREVIEW_KEEP_ALIVE_POOL_CAPACITY 一致
* }),
* ```
*/
function createSystemOpenLocalFileHandler(deps) {
	const { windowManager, push, documentService, documentPreviewPoolCapacity } = deps;
	return function systemOpenLocalFile(filePath) {
		const title = filePath.replace(/\\/g, "/").split("/").pop() || filePath;
		require_tencent_docs_prompt_selection.mainLog.info("[TencentDocsSystemOpen] received", {
			filePath,
			title
		});
		let conflict;
		try {
			conflict = documentService.checkLocalFileOpenConflict(filePath, { openSource: "system-open" });
		} catch (err) {
			require_tencent_docs_prompt_selection.mainLog.warn("[TencentDocsSystemOpen] checkLocalFileOpenConflict failed, fallback to none", {
				filePath,
				error: err instanceof Error ? err.message : String(err)
			});
			conflict = {
				kind: "none",
				filePath
			};
		}
		windowManager.showOrCreate();
		if (conflict.kind === "owned-by-other" && conflict.sessionId) {
			push(TENCENT_DOCS_RENDERER_PUSH_CHANNELS.LOCAL_FILE_ALREADY_ACTIVE, {
				filePath: conflict.filePath || filePath,
				title,
				sessionId: conflict.sessionId,
				sessionTitle: conflict.sessionTitle
			});
			require_tencent_docs_prompt_selection.mainLog.info("[TencentDocsSystemOpen] push localFileAlreadyActive", {
				filePath,
				sessionId: conflict.sessionId,
				hasTitle: !!conflict.sessionTitle
			});
			return Promise.resolve({
				success: true,
				status: "owned-by-other"
			});
		}
		if (conflict.kind === "none") {
			let openLeaseCount = 0;
			try {
				openLeaseCount = documentService.getOpenLeaseCount();
			} catch (err) {
				require_tencent_docs_prompt_selection.mainLog.warn("[TencentDocsSystemOpen] getOpenLeaseCount failed, skip pool capacity check", {
					filePath,
					error: err instanceof Error ? err.message : String(err)
				});
			}
			if (openLeaseCount >= documentPreviewPoolCapacity) {
				push(TENCENT_DOCS_RENDERER_PUSH_CHANNELS.PREVIEW_POOL_FULL, {});
				require_tencent_docs_prompt_selection.mainLog.info("[TencentDocsSystemOpen] push previewPoolFull (pool capacity reached)", {
					filePath,
					openLeaseCount,
					documentPreviewPoolCapacity
				});
				return Promise.resolve({
					success: true,
					status: "pool-full"
				});
			}
		}
		const payload = {
			filePath,
			title,
			openSource: "system-open"
		};
		push(TENCENT_DOCS_RENDERER_PUSH_CHANNELS.OPEN_LOCAL_FILE_IN_MAIN_WINDOW, payload);
		require_tencent_docs_prompt_selection.mainLog.info("[TencentDocsSystemOpen] push openLocalFileInMainWindow", payload);
		return Promise.resolve({
			success: true,
			status: "broadcasted"
		});
	};
}
//#endregion
//#region ../../packages/workbuddy-server/src/docs-shared/local-docs/wb-source.ts
/** 在预览 URL 上追加来源标记 `wb_source`。失败静默降级返回原 URL。 */
function appendWbSource(url, source) {
	try {
		const u = new URL(url);
		u.searchParams.set("wb_source", source);
		return u.toString();
	} catch {
		return url;
	}
}
//#endregion
Object.defineProperty(exports, "SANDBOX_DOCUMENT_RESOURCE_URI_SCHEME", {
	enumerable: true,
	get: function() {
		return SANDBOX_DOCUMENT_RESOURCE_URI_SCHEME;
	}
});
Object.defineProperty(exports, "TENCENT_DOCS_RENDERER_PUSH_CHANNELS", {
	enumerable: true,
	get: function() {
		return TENCENT_DOCS_RENDERER_PUSH_CHANNELS;
	}
});
Object.defineProperty(exports, "appendWbSource", {
	enumerable: true,
	get: function() {
		return appendWbSource;
	}
});
Object.defineProperty(exports, "createMqqSelectionReporter", {
	enumerable: true,
	get: function() {
		return createMqqSelectionReporter;
	}
});
Object.defineProperty(exports, "createSystemOpenLocalFileHandler", {
	enumerable: true,
	get: function() {
		return createSystemOpenLocalFileHandler;
	}
});
Object.defineProperty(exports, "getOnlineDocPreviewRegistry", {
	enumerable: true,
	get: function() {
		return getOnlineDocPreviewRegistry;
	}
});
Object.defineProperty(exports, "getOnlineDocumentSelectionStore", {
	enumerable: true,
	get: function() {
		return getOnlineDocumentSelectionStore;
	}
});
Object.defineProperty(exports, "getRemoteDocumentSelectionStore", {
	enumerable: true,
	get: function() {
		return getRemoteDocumentSelectionStore;
	}
});
