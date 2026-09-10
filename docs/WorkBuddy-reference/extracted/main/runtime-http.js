const require_chunk = require("./chunk.js");
const require_logger = require("./logger.js");
//#region ../../packages/workbuddy-server/src/server/runtime-http.ts
var runtime_http_exports = /* @__PURE__ */ require_chunk.__exportAll({
	createRuntimeContext: () => createRuntimeContext,
	createRuntimeContextFromCellDeps: () => createRuntimeContextFromCellDeps,
	createRuntimeHttp: () => createRuntimeHttp,
	wrapHttpWithLogging: () => wrapHttpWithLogging
});
var HTTP_TAG = "[DomainHttp]";
var AUTH_INIT_WAIT_LOG_THRESHOLD_MS = 0;
/**
* session 落定的有界等待上限（毫秒）。
*
* 背景（issue-91861 第二类根因）：daemon 各 domain 服务共用的 RuntimeHttpService
* 此前注入 token 前只 `await authenticationManager.initialized`。但 `initialized`
* 这个 deferred 在两种情况下会在 session 仍为空时就 resolve：
*   1. doInit() 抛错走 catch 分支照样 resolve（authentication-manager.ts:164-165）；
*   2. 冷启动 restore()/switchBySession 尚未把首个有效 session next 进 subject。
* 结果是「initialized 已完成但 currentSessionSubject 仍为 undefined」，getAuthHeaders
* 拿到空 session → 静默发无 token 请求 → 网关 oidc_introspection_failed。
*
* 修复：initialized 完成后若 session 仍为空，再订阅 currentSessionSubject 等首个
* 「有 accessToken 的值」，但只等这个有界超时；超时仍空则放行（避免把请求永久挂死，
* 也覆盖「用户确实未登录」的合法无 token 请求）。启动竞态窗口的 session 恢复走本地
* 磁盘 IO（restore），通常 1s 内完成，故取 1s：既覆盖绝大多数竞态，又把「真未登录」
* 场景的最坏等待压到最小。
*/
var AUTH_SESSION_SETTLE_TIMEOUT_MS = 1e3;
/**
* 默认请求超时（毫秒）。
*
* 背景（andon #17174936 / #59558）：系统休眠恢复瞬间网络尚未恢复（DNS ENOTFOUND），
* 此前 request() 直接 `await deps.fetch(url, init)` 且 init 不带任何 signal/timeout，
* 底层裸 fetch 会硬等到 TCP 层自己放弃——实测 msgCenter:getSummary 轮询请求卡了
* 900456ms(~15min) 才"完成"，期间 UI 转圈、消息发送被阻塞。
*
* 这里给所有非流式请求注入一个有限的默认超时，让网络异常时快速 fail-fast。
* 调用方可通过 config.timeoutMs 覆盖（传 0 / 负数 / Infinity 关闭），
* 或通过 config.signal 自带 AbortSignal 接管生命周期。
*/
var DEFAULT_REQUEST_TIMEOUT_MS = 1e4;
/**
* DNS race guard 额外宽限时间（毫秒）。
*
* Windows 上 libuv 的 GetAddrInfoW 是同步系统调用，AbortSignal.timeout
* 无法打断已提交到 threadpool 的 DNS 查询（nodejs/node#46549）。
* 用 Promise.race + setTimeout 兜底：在 AbortSignal 超时之后再额外等待
* 此宽限期，若 fetch 仍未返回则强制 reject，确保请求不会无限卡死。
*/
var DNS_RACE_GUARD_EXTRA_MS = 5e3;
function wrapHttpWithLogging(http) {
	function wrap(method, fn) {
		return async (...args) => {
			const url = args[0];
			try {
				const result = await fn.apply(http, args);
				const resp = result;
				if (resp && typeof resp.code === "number" && resp.code !== 0) require_logger.createWorkbuddyScopedLogger("runtime-http").warn(`${HTTP_TAG} ${method.toUpperCase()} ${url} biz_error code=${resp.code} msg=${resp.msg}`);
				return result;
			} catch (error) {
				const errAny = error;
				const status = typeof errAny?.status === "number" ? errAny.status : void 0;
				const bizCode = typeof errAny?.code === "number" || typeof errAny?.code === "string" ? errAny.code : void 0;
				const bodyText = typeof errAny?.bodyText === "string" ? errAny.bodyText : void 0;
				const extras = [];
				if (status !== void 0) extras.push(`status=${status}`);
				if (bizCode !== void 0) extras.push(`code=${bizCode}`);
				else if (bodyText) extras.push(`body=${bodyText}`);
				require_logger.createWorkbuddyScopedLogger("runtime-http").error(`${HTTP_TAG} ${method.toUpperCase()} ${url} FAIL`, errAny?.message || error, ...extras);
				throw error;
			}
		};
	}
	return {
		get: wrap("get", http.get.bind(http)),
		post: wrap("post", http.post.bind(http)),
		put: wrap("put", http.put.bind(http)),
		patch: wrap("patch", http.patch.bind(http)),
		delete: wrap("delete", http.delete.bind(http))
	};
}
/**
* 构造带 HTTP 状态的友好错误。
*
* 网关/后端偶发返回 HTML 错误页（以 `<pre>` 开头）时，避免直接
* `response.json()` 抛出 `Unexpected token '<'...` 这类不可理解的报错。
*
* `message` 优先使用后端 envelope 中的 `msg`（i18n 友好文案，供 UI 直接展示），
* 无 `msg` 时回退到 HTTP 状态行（不暴露内部 URL / 正文）。
* 完整的 url / method / 正文片段保留在 error 属性上，供日志与排查使用
* （`wrapHttpWithLogging` 仍会在日志里记录完整 URL）。
*
* ─── envelope 平铺 ────────────────────────────────────────────
* 后端所有非 2xx 响应统一走 `NormalResp` 壳（`{code, msg, requestId, data?}`，
* 详见 `services/pkg/client/http/response.go`）。为了让 4xx/5xx 与 2xx-软失败
* 走**同一份错误契约**——`unwrap()` 在 http 200 但 `code!=0` 时会平铺 `code /
* data / requestId` 到 error 属性上（`_internal/http.ts` unwrap 注释）——本函数
* 会尝试把 body 当成 JSON 解析：解析成功即把 `code / data / requestId` 挂到
* error，方便上层 `tryParseMemberQuotaError` / `isExclusivePlanError` /
* daemon `extractBizDetail` 直接消费；失败或非 JSON body（HTML 网关页/空正文）
* 保持原样只挂 status/bodyText，避免污染。
*/
function createHttpError(method, url, response, text, cause) {
	const status = response.status;
	const statusText = response.statusText ? ` ${response.statusText}` : "";
	const parsedEnvelope = tryParseEnvelope(text);
	const displayMessage = parsedEnvelope?.msg ?? `Request failed (HTTP ${status}${statusText})`;
	const error = new Error(displayMessage);
	error.status = status;
	error.httpStatus = status;
	error.statusText = response.statusText;
	error.bodyText = text.trim().slice(0, 200);
	error.url = url;
	error.method = method.toUpperCase();
	if (cause !== void 0) error.cause = cause;
	if (parsedEnvelope) {
		if (parsedEnvelope.code !== void 0) error.code = parsedEnvelope.code;
		if (parsedEnvelope.data !== void 0) error.data = parsedEnvelope.data;
		if (parsedEnvelope.requestId !== void 0) error.requestId = parsedEnvelope.requestId;
	}
	return error;
}
/**
* 尝试把响应 body 当作后端 `NormalResp` envelope 解析：
*   `{ code: number|string, msg?, requestId?, data?, ... }`
*
* - body 非 JSON / 非对象 → 返回 null（不污染 error）
* - body 是 JSON 但缺少 `code` → 返回 null（不算 envelope）
* - `code` 是数字字符串（如 "17273"）→ 归一为 number，方便 `err.code === 17273` 判断
* - `code` 是非数字字符串（如 "PermissionDenied"）→ 保留字符串
* - `msg` 非空字符串时返回，供 `createHttpError` 用作 Error message
*/
function tryParseEnvelope(text) {
	const trimmed = text.trim();
	if (trimmed === "" || trimmed[0] !== "{" && trimmed[0] !== "[") return null;
	let parsed;
	try {
		parsed = JSON.parse(trimmed);
	} catch {
		return null;
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
	const body = parsed;
	const rawCode = body.code;
	if (rawCode === void 0) return null;
	let code;
	if (typeof rawCode === "number" && Number.isFinite(rawCode)) code = rawCode;
	else if (typeof rawCode === "string") code = /^-?\d+$/.test(rawCode) ? Number(rawCode) : rawCode;
	else return null;
	return {
		code,
		msg: typeof body.msg === "string" && body.msg !== "" ? body.msg : void 0,
		data: body.data,
		requestId: typeof body.requestId === "string" ? body.requestId : void 0
	};
}
function createRuntimeHttp(deps) {
	const logger = require_logger.createWorkbuddyScopedLogger("runtime-http");
	let authInitialized = false;
	let authInitializationWait;
	function getEndpoint() {
		const endpoint = deps.productManager.getEndpoint();
		if (!endpoint) throw new Error("[DomainRegistry] endpoint not ready");
		return endpoint.replace(/\/$/, "");
	}
	async function waitAuthInitialized(method, url) {
		if (authInitialized) return;
		const initialized = deps.authenticationManager?.initialized;
		if (!initialized) {
			authInitialized = true;
			return;
		}
		if (authInitialized) return;
		const startedAt = Date.now();
		authInitializationWait ??= Promise.resolve(initialized).then(() => {
			authInitialized = true;
		});
		await authInitializationWait;
		const durationMs = Date.now() - startedAt;
		if (durationMs > AUTH_INIT_WAIT_LOG_THRESHOLD_MS) logger.info(`[AuthInitWait] method=${method.toUpperCase()} url=${url} durationMs=${durationMs}`);
	}
	/**
	* initialized 完成后，若 session 仍为空，再有界等待「首个有 accessToken 的 session」。
	*
	* 返回落定后的 session（可能仍为 undefined）。三种退出：
	*   - initializationError 存在：恢复流程已失败，等也等不到，立即返回当前值（多为 undefined）。
	*   - subscribe 首个有效值到达：清理订阅并返回该 session。
	*   - 超时（AUTH_SESSION_SETTLE_TIMEOUT_MS）：放行，返回当前值，避免把请求永久挂死，
	*     也覆盖「用户确实未登录」的合法无 token 场景。
	*/
	async function waitSessionSettled() {
		const authManager = deps.authenticationManager;
		const subject = authManager?.currentSessionSubject;
		const current = subject?.getValue?.();
		if (current?.auth?.accessToken) return current;
		if (authManager?.initializationError || typeof subject?.subscribe !== "function") return current;
		return new Promise((resolve) => {
			let settled = false;
			const finish = (value) => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				queueMicrotask(() => subscription?.unsubscribe?.());
				resolve(value);
			};
			const timer = setTimeout(() => finish(subject.getValue?.()), AUTH_SESSION_SETTLE_TIMEOUT_MS);
			const subscription = subject.subscribe((value) => {
				if (value?.auth?.accessToken) finish(value);
			});
		});
	}
	async function getAuthHeaders(method, url) {
		await waitAuthInitialized(method, url);
		const session = await waitSessionSettled();
		const headers = {
			"Content-Type": "application/json",
			Accept: "application/json"
		};
		if (session?.auth?.accessToken) headers.Authorization = `Bearer ${session.auth.accessToken}`;
		else {
			const reason = deps.authenticationManager?.initializationError ? "auth-init-error" : "no-session";
			logger.warn(`${HTTP_TAG} ${method.toUpperCase()} ${url} sending without token (reason=${reason})`);
		}
		if (session?.account?.uid) headers["X-User-Id"] = session.account.uid;
		if (session?.account?.enterpriseId) {
			headers["X-Enterprise-Id"] = session.account.enterpriseId;
			headers["X-Tenant-Id"] = session.account.enterpriseId;
		}
		if (session?.auth?.domain) headers["X-Domain"] = session.auth.domain;
		return headers;
	}
	function isStreamingBody(data) {
		if (!data || typeof data !== "object") return false;
		const body = data;
		if (typeof body.append === "function" && typeof body.entries === "function") return true;
		return typeof body.arrayBuffer === "function";
	}
	/**
	* 解析本次请求要用的 AbortSignal：
	* - config.signal 优先（调用方自管生命周期，直接接管，不再叠加默认超时）；
	* - 否则按 config.timeoutMs（缺省 DEFAULT_REQUEST_TIMEOUT_MS）构造超时 signal；
	* - timeoutMs <= 0 或非有限值（如 Infinity）表示显式关闭超时，返回 undefined。
	*
	* 注：AbortSignal.timeout 触发后底层 fetch 抛 AbortError，由调用方 catch 降级
	* （如 MsgCenterService.getSummary 的 `catch → return null`），不阻塞主流程。
	*/
	function resolveSignal(config) {
		if (config?.signal instanceof AbortSignal) return config.signal;
		const timeoutMs = typeof config?.timeoutMs === "number" ? config.timeoutMs : DEFAULT_REQUEST_TIMEOUT_MS;
		if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return;
		return AbortSignal.timeout(timeoutMs);
	}
	async function request(method, url, data, config) {
		let fullUrl = `${getEndpoint()}${url}`;
		if (config?.params) {
			const query = [];
			for (const [key, value] of Object.entries(config.params)) {
				if (value === void 0 || value === null || value === "") continue;
				query.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
			}
			if (query.length > 0) fullUrl += `?${query.join("&")}`;
		}
		const headers = {
			...await getAuthHeaders(method, url),
			...config?.headers
		};
		const init = {
			method,
			headers
		};
		const signal = resolveSignal(config);
		if (signal) init.signal = signal;
		if (data !== void 0 && method !== "GET") if (isStreamingBody(data)) {
			if (headers["Content-Type"] === "application/json") delete headers["Content-Type"];
			init.body = data;
		} else init.body = JSON.stringify(data);
		const timeoutMs = typeof config?.timeoutMs === "number" ? config.timeoutMs : DEFAULT_REQUEST_TIMEOUT_MS;
		const useRaceGuard = Number.isFinite(timeoutMs) && timeoutMs > 0 && !isStreamingBody(data);
		const fetchPromise = deps.fetch(fullUrl, init);
		let response;
		if (useRaceGuard) {
			const raceDeadline = timeoutMs + DNS_RACE_GUARD_EXTRA_MS;
			let raceTimer;
			const racePromise = new Promise((_, reject) => {
				raceTimer = setTimeout(() => {
					reject(new DOMException(`Request timed out after ${raceDeadline}ms (DNS race guard): ${method} ${url}`, "TimeoutError"));
				}, raceDeadline);
				if (typeof raceTimer.unref === "function") raceTimer.unref();
			});
			try {
				response = await Promise.race([fetchPromise, racePromise]);
			} finally {
				if (raceTimer !== void 0) clearTimeout(raceTimer);
			}
		} else response = await fetchPromise;
		if (!(typeof config?.validateStatus === "function" ? Boolean(config.validateStatus(response.status)) : response.ok)) {
			let bodyText = "";
			try {
				bodyText = await response.text();
			} catch {}
			throw createHttpError(method, fullUrl, response, bodyText);
		}
		try {
			return await response.json();
		} catch (err) {
			let bodyText = "";
			try {
				bodyText = await response.text();
			} catch {}
			if (bodyText.trim() === "") return;
			throw createHttpError(method, fullUrl, response, bodyText, err);
		}
	}
	return {
		get: (url, config) => request("GET", url, void 0, config),
		post: (url, data, config) => request("POST", url, data, config),
		put: (url, data, config) => request("PUT", url, data, config),
		patch: (url, data, config) => request("PATCH", url, data, config),
		delete: (url, config) => request("DELETE", url, void 0, config),
		waitAuthSessionSettled: async () => {
			await waitSessionSettled();
		}
	};
}
function createRuntimeContext(deps) {
	const http = createRuntimeHttp(deps);
	return {
		homeDir: deps.homeDir,
		logger: deps.logger ?? console,
		http: wrapHttpWithLogging(http),
		fetch: deps.fetch,
		productManager: deps.productManager,
		accountProvider: deps.accountProvider ?? (() => deps.authenticationManager?.currentSessionSubject?.getValue?.()?.account),
		reporter: deps.reporter,
		waitAuthSessionSettled: () => http.waitAuthSessionSettled()
	};
}
function createRuntimeContextFromCellDeps(cellDeps, deps) {
	return createRuntimeContext({
		homeDir: deps.homeDir,
		logger: deps.logger,
		productManager: cellDeps.productManager,
		authenticationManager: cellDeps.authenticationManager,
		fetch: deps.fetch
	});
}
//#endregion
Object.defineProperty(exports, "createRuntimeContext", {
	enumerable: true,
	get: function() {
		return createRuntimeContext;
	}
});
Object.defineProperty(exports, "createRuntimeContextFromCellDeps", {
	enumerable: true,
	get: function() {
		return createRuntimeContextFromCellDeps;
	}
});
Object.defineProperty(exports, "createRuntimeHttp", {
	enumerable: true,
	get: function() {
		return createRuntimeHttp;
	}
});
Object.defineProperty(exports, "runtime_http_exports", {
	enumerable: true,
	get: function() {
		return runtime_http_exports;
	}
});
