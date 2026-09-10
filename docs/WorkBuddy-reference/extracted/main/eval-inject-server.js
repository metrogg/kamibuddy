const require_chunk = require("./chunk.js");
const require_contract = require("./contract2.js");
let http = require("http");
http = require_chunk.__toESM(http);
var EvalProxyServer = class EvalProxyServer {
	host;
	preferredPort;
	portRetries;
	daemon;
	startedAt = Date.now();
	httpServer = null;
	port = 0;
	appReady = false;
	mainBootstrapReady = false;
	shuttingDown = false;
	constructor(logger, options) {
		this.logger = logger;
		this.host = options.host ?? "127.0.0.1";
		this.preferredPort = options.preferredPort ?? 18485;
		this.portRetries = options.portRetries ?? 10;
		this.daemon = options.daemon;
	}
	async start() {
		if (this.httpServer) return this.port;
		this.shuttingDown = false;
		this.httpServer = http.createServer((req, res) => {
			this.handleRequest(req, res).catch((err) => {
				this.logger.error("[EvalProxyServer] Unhandled request error:", err);
			});
		});
		this.httpServer.on("error", (error) => {
			this.logger.error("[EvalProxyServer] HTTP server error:", error);
		});
		this.port = await this.listenOnPort(this.httpServer);
		this.logger.info(`[EvalProxyServer] Listening on http://${this.host}:${this.port}`);
		return this.port;
	}
	async stop() {
		this.shuttingDown = true;
		if (!this.httpServer) return;
		const server = this.httpServer;
		this.httpServer = null;
		this.port = 0;
		await new Promise((resolve) => {
			const timeout = setTimeout(() => {
				server.unref();
				this.logger.warn("[EvalProxyServer] server.close() timed out after 5 s — forcing shutdown");
				resolve();
			}, 5e3);
			server.close(() => {
				clearTimeout(timeout);
				resolve();
			});
		});
		this.logger.info("[EvalProxyServer] Stopped");
	}
	markAppReady() {
		this.appReady = true;
	}
	markMainBootstrapReady() {
		this.mainBootstrapReady = true;
	}
	getPort() {
		return this.port;
	}
	getUrl() {
		if (!this.port) return null;
		return `http://${this.host}:${this.port}`;
	}
	async handleRequest(req, res) {
		const method = req.method ?? "GET";
		const url = new URL(req.url ?? "/", `http://${this.host}:${this.port || this.preferredPort}`);
		if (method === "GET" && url.pathname === "/ping") {
			this.writeJson(res, 200, {
				ok: true,
				service: "eval-proxy",
				pid: process.pid,
				uptimeSec: Math.floor(process.uptime())
			});
			return;
		}
		if (method === "GET" && url.pathname === "/healthz") {
			const payload = this.buildHealthPayload();
			this.writeJson(res, payload.ok ? 200 : 503, payload);
			return;
		}
		if (method === "POST" && url.pathname.startsWith("/chat/")) {
			const sessionId = decodeURIComponent(url.pathname.slice(6)).trim();
			await this.handleChatContinue(req, res, sessionId);
			return;
		}
		const injectMatch = url.pathname.match(/^\/sessions\/([^/]+)\/inject$/);
		if (injectMatch) {
			if (method === "POST") {
				const sessionId = decodeURIComponent(injectMatch[1]).trim();
				await this.handleInjectTurn(req, res, sessionId);
				return;
			}
			this.writeJson(res, 405, {
				ok: false,
				error: `Method ${method} not allowed on ${url.pathname}`
			});
			return;
		}
		if (url.pathname === "/sessions" || url.pathname.startsWith("/sessions/")) {
			const sessionId = url.pathname === "/sessions" ? "" : decodeURIComponent(url.pathname.slice(10)).trim();
			if (method === "POST" && !sessionId) {
				await this.handleCreateSession(req, res);
				return;
			}
			if (method === "GET") {
				await this.handleGetSessions(res, sessionId);
				return;
			}
			if (method === "DELETE") {
				const confirmAll = url.searchParams.get("all") === "true";
				await this.handleDeleteSessions(res, sessionId, confirmAll);
				return;
			}
		}
		this.writeJson(res, 404, {
			ok: false,
			error: "Not Found"
		});
	}
	buildHealthPayload() {
		return {
			ok: this.appReady && this.mainBootstrapReady && !this.shuttingDown,
			service: "eval-proxy",
			pid: process.pid,
			uptimeSec: Math.floor((Date.now() - this.startedAt) / 1e3),
			appReady: this.appReady,
			mainBootstrapReady: this.mainBootstrapReady,
			shuttingDown: this.shuttingDown
		};
	}
	writeJson(res, statusCode, body) {
		res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
		res.end(JSON.stringify(body));
	}
	static ALLOWED_MODES = new Set([
		"craft",
		"ask",
		"plan"
	]);
	static BODY_WARN_THRESHOLD_BYTES = 50 * 1024 * 1024;
	static BODY_HARD_LIMIT_BYTES = 200 * 1024 * 1024;
	/**
	* POST /chat/:id
	*
	* Send a prompt on an existing session and return the structured result.
	* Session config (`cwd` / `mode` / `model`) is fixed at creation time and
	* cannot be changed here — any extra fields in the body are simply ignored.
	*
	* The session is NEVER auto-deleted by this endpoint — callers must
	* issue DELETE /sessions/:id explicitly when they're done.
	*/
	async handleChatContinue(req, res, sessionId) {
		const chatStart = Date.now();
		this.logger.info(`[EvalProxyServer] POST /chat/${sessionId} request received`);
		try {
			if (!sessionId) {
				this.writeJson(res, 400, {
					ok: false,
					error: "Missing sessionId in URL"
				});
				return;
			}
			const body = await this.readJsonBody(req);
			const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
			if (!prompt) {
				this.writeJson(res, 400, {
					ok: false,
					error: "Missing prompt"
				});
				return;
			}
			if (!this.daemon.sessionManager.getSession(sessionId)) {
				this.writeJson(res, 404, {
					ok: false,
					error: `Session "${sessionId}" not found or not loaded`
				});
				return;
			}
			this.logger.info(`[EvalProxyServer] /chat/${sessionId} starting: prompt="${prompt.slice(0, 50)}..."`);
			const result = await this.driveChatTurn(sessionId, prompt);
			this.logger.info(`[EvalProxyServer] /chat/${sessionId} completed in ${Date.now() - chatStart}ms`);
			this.writeJson(res, 200, {
				ok: true,
				reused: true,
				...result
			});
		} catch (error) {
			this.logger.error(`[EvalProxyServer] /chat/${sessionId} failed after ${Date.now() - chatStart}ms:`, error);
			this.writeJson(res, error instanceof SyntaxError ? 400 : 500, {
				ok: false,
				error: error instanceof Error ? error.message : "Chat continue failed"
			});
		}
	}
	/**
	* POST /sessions/:id/inject
	*
	* Inject conversation turn(s) into an existing session without triggering
	* LLM calls. Each turn represents a complete user→assistant exchange,
	* optionally including tool calls.
	*
	* Body: {
	*   turns: Array<{
	*     user: string;
	*     assistant: string;
	*     tool_calls?: Array<{
	*       name: string;
	*       arguments: string | object;
	*       result: string;
	*     }>;
	*   }>;
	* }
	*
	* Response: { ok: true, sessionId: string, injected: number }
	*/
	async handleInjectTurn(req, res, sessionId) {
		this.logger.info(`[EvalProxyServer] POST /sessions/${sessionId}/inject request received`);
		try {
			if (!sessionId) {
				this.writeJson(res, 400, {
					ok: false,
					error: "Missing sessionId in URL"
				});
				return;
			}
			const body = await this.readJsonBody(req);
			const turns = Array.isArray(body?.turns) ? body.turns : [];
			if (turns.length === 0) {
				this.writeJson(res, 400, {
					ok: false,
					error: "Missing or empty \"turns\" array. Each turn should be { user: string, assistant: string, tool_calls?: [...] }"
				});
				return;
			}
			if (!this.daemon.sessionManager.getSession(sessionId)) {
				this.writeJson(res, 404, {
					ok: false,
					error: `Session "${sessionId}" not found or not loaded`
				});
				return;
			}
			await this.injectTurnsToSession(sessionId, turns, res);
		} catch (error) {
			this.logger.error(`[EvalProxyServer] /sessions/${sessionId}/inject failed:`, error);
			this.writeJson(res, error instanceof SyntaxError ? 400 : 500, {
				ok: false,
				error: error instanceof Error ? error.message : "Inject turn failed"
			});
		}
	}
	/**
	* Validate `turns[]`, flatten into InjectMessage[], and call
	* `session/inject_history` on the target session. On validation failure
	* the 400 response is written directly and the function returns without
	* calling the ext method.
	*/
	async injectTurnsToSession(sessionId, turns, res) {
		const messages = [];
		for (const turn of turns) {
			if (typeof turn !== "object" || turn === null) {
				this.writeJson(res, 400, {
					ok: false,
					error: "Each turn must be an object with \"user\" and \"assistant\" string fields"
				});
				return;
			}
			const t = turn;
			if (typeof t.user !== "string" || !t.user.trim()) {
				this.writeJson(res, 400, {
					ok: false,
					error: "Each turn must have a non-empty \"user\" string field"
				});
				return;
			}
			if (typeof t.assistant !== "string" || !t.assistant.trim()) {
				this.writeJson(res, 400, {
					ok: false,
					error: "Each turn must have a non-empty \"assistant\" string field"
				});
				return;
			}
			let assistantUsage;
			if (t.assistant_usage !== void 0) {
				if (typeof t.assistant_usage !== "object" || t.assistant_usage === null) {
					this.writeJson(res, 400, {
						ok: false,
						error: "\"assistant_usage\" must be an object with optional numeric inputTokens / outputTokens / totalTokens"
					});
					return;
				}
				const u = t.assistant_usage;
				for (const key of [
					"inputTokens",
					"outputTokens",
					"totalTokens"
				]) if (u[key] !== void 0 && (typeof u[key] !== "number" || !Number.isFinite(u[key]))) {
					this.writeJson(res, 400, {
						ok: false,
						error: `"assistant_usage.${key}" must be a finite number if provided`
					});
					return;
				}
				assistantUsage = {
					...typeof u.inputTokens === "number" ? { inputTokens: u.inputTokens } : {},
					...typeof u.outputTokens === "number" ? { outputTokens: u.outputTokens } : {},
					...typeof u.totalTokens === "number" ? { totalTokens: u.totalTokens } : {}
				};
			}
			messages.push({
				role: "user",
				content: t.user
			});
			if (Array.isArray(t.tool_calls) && t.tool_calls.length > 0) for (const tc of t.tool_calls) {
				const tcObj = tc;
				if (typeof tcObj.name !== "string" || !tcObj.name.trim()) {
					this.writeJson(res, 400, {
						ok: false,
						error: "Each tool_call must have a non-empty \"name\" string field"
					});
					return;
				}
				const args = tcObj.arguments ?? "{}";
				if (typeof args === "string") try {
					JSON.parse(args);
				} catch {
					this.writeJson(res, 400, {
						ok: false,
						error: `tool_call "${tcObj.name}" has invalid JSON in "arguments"`
					});
					return;
				}
				const result = typeof tcObj.result === "string" ? tcObj.result : JSON.stringify(tcObj.result ?? "");
				messages.push({
					role: "tool_call",
					name: tcObj.name,
					arguments: typeof args === "string" ? args : args
				});
				messages.push({
					role: "tool_result",
					tool_call_name: tcObj.name,
					output: result
				});
			}
			messages.push({
				role: "assistant",
				content: t.assistant,
				...assistantUsage ? { usage: assistantUsage } : {}
			});
		}
		this.logger.info(`[EvalProxyServer] injectTurnsToSession: injecting ${turns.length} turn(s) (${messages.length} messages) into session "${sessionId}"`);
		const injected = (await this.daemon.sessionManager.callExtMethod(sessionId, "session/inject_history", {
			sessionId,
			messages
		}))?.injected ?? messages.length;
		this.logger.info(`[EvalProxyServer] injectTurnsToSession: done, injected=${injected}`);
		this.writeJson(res, 200, {
			ok: true,
			sessionId,
			injected
		});
	}
	/**
	* POST /sessions
	*
	* Create a new chat session without sending any message.
	* Use this when you want to pre-create a session (e.g. to inject history
	* via POST /sessions/:id/inject) before driving turns with POST /chat.
	*
	* Body: { cwd: string, mode?: EvalMode, model?: string }
	* Response: { ok: true, sessionId: string }
	*/
	async handleCreateSession(req, res) {
		this.logger.info("[EvalProxyServer] POST /sessions request received");
		try {
			const body = await this.readJsonBody(req);
			const cwd = typeof body?.cwd === "string" ? body.cwd.trim() : "";
			if (!cwd) {
				this.writeJson(res, 400, {
					ok: false,
					error: "Missing cwd"
				});
				return;
			}
			const rawMode = typeof body?.mode === "string" ? body.mode.trim() : "";
			const mode = rawMode ? rawMode : void 0;
			if (mode && !EvalProxyServer.ALLOWED_MODES.has(mode)) {
				this.writeJson(res, 400, {
					ok: false,
					error: `Invalid mode: "${mode}". Allowed values: ${[...EvalProxyServer.ALLOWED_MODES].join(", ")}`
				});
				return;
			}
			const model = typeof body?.model === "string" ? body.model.trim() || void 0 : void 0;
			this.logger.info(`[EvalProxyServer] POST /sessions: creating session cwd="${cwd}", mode=${mode ?? "default"}, model=${model ?? "default"}`);
			const sessionId = await this.createChatSession({
				cwd,
				mode,
				model
			});
			this.logger.info(`[EvalProxyServer] POST /sessions: created sessionId="${sessionId}"`);
			this.writeJson(res, 200, {
				ok: true,
				sessionId
			});
		} catch (error) {
			this.logger.error("[EvalProxyServer] POST /sessions failed:", error);
			this.writeJson(res, error instanceof SyntaxError ? 400 : 500, {
				ok: false,
				error: error instanceof Error ? error.message : "Create session failed"
			});
		}
	}
	/**
	* GET /sessions          → { ok, sessions: SessionInfo[] }
	* GET /sessions/:id      → { ok, session: SessionInfo | null }
	*
	* 数据来自 SessionManager.listSessions()（内存中当前加载的会话）。
	* 被归档 / 只存在于 recordStore 的会话不会出现在此处——这与原有 session:list
	* RPC 通道的语义保持一致。
	*/
	async handleGetSessions(res, sessionId) {
		try {
			const result = await this.daemon.server.invokeLocal(require_contract.SESSION_RPC_CHANNELS.LIST);
			const sessions = this.extractSessionList(result);
			if (!sessionId) {
				this.logger.info(`[EvalProxyServer] GET /sessions: returning ${sessions.length} session(s)`);
				this.writeJson(res, 200, {
					ok: true,
					sessions,
					count: sessions.length
				});
				return;
			}
			const session = sessions.find((s) => typeof s === "object" && s !== null && s.sessionId === sessionId) ?? null;
			this.logger.info(`[EvalProxyServer] GET /sessions/${sessionId}: ${session ? "found" : "not found"}`);
			this.writeJson(res, session ? 200 : 404, {
				ok: !!session,
				...session ? { session } : { error: `Session "${sessionId}" not found` }
			});
		} catch (error) {
			this.logger.error("[EvalProxyServer] GET /sessions failed:", error);
			this.writeJson(res, 500, {
				ok: false,
				error: error instanceof Error ? error.message : "List sessions failed"
			});
		}
	}
	/**
	* DELETE /sessions?all=true   → 删除全部 session（需显式 all=true 防误删）
	* DELETE /sessions/:id        → 删除指定 session
	*
	* 底层调用 SESSION_RPC_CHANNELS.DELETE，会由 SessionManager.deleteSession()
	* 统一处理：
	*   - 内存 session (this.sessions)
	*   - backend.destroy()
	*   - pendingSessionRestores / primedReplayStates / sessionEffectChains
	*   - recordStore.deleteSession() —— 持久化数据清理
	*/
	async handleDeleteSessions(res, sessionId, confirmAll) {
		try {
			if (sessionId) {
				this.logger.info(`[EvalProxyServer] DELETE /sessions/${sessionId}: deleting single session`);
				await this.daemon.server.invokeLocal(require_contract.SESSION_RPC_CHANNELS.DELETE, sessionId);
				this.writeJson(res, 200, {
					ok: true,
					deleted: [sessionId],
					count: 1
				});
				return;
			}
			if (!confirmAll) {
				this.logger.warn("[EvalProxyServer] DELETE /sessions: rejected, missing ?all=true");
				this.writeJson(res, 400, {
					ok: false,
					error: "Deleting all sessions requires explicit confirmation. Use DELETE /sessions?all=true, or DELETE /sessions/:id for a single session."
				});
				return;
			}
			const listResult = await this.daemon.server.invokeLocal(require_contract.SESSION_RPC_CHANNELS.LIST);
			const ids = this.extractSessionList(listResult).map((s) => typeof s?.sessionId === "string" ? s.sessionId : "").filter((id) => !!id);
			this.logger.info(`[EvalProxyServer] DELETE /sessions?all=true: deleting ${ids.length} session(s)`);
			const deleted = [];
			const failed = [];
			for (const id of ids) try {
				await this.daemon.server.invokeLocal(require_contract.SESSION_RPC_CHANNELS.DELETE, id);
				deleted.push(id);
			} catch (err) {
				failed.push({
					sessionId: id,
					error: err instanceof Error ? err.message : String(err)
				});
				this.logger.warn(`[EvalProxyServer] DELETE /sessions: failed to delete "${id}":`, err);
			}
			this.writeJson(res, failed.length === 0 ? 200 : 207, {
				ok: failed.length === 0,
				deleted,
				count: deleted.length,
				...failed.length > 0 ? { failed } : {}
			});
		} catch (error) {
			this.logger.error("[EvalProxyServer] DELETE /sessions failed:", error);
			this.writeJson(res, 500, {
				ok: false,
				error: error instanceof Error ? error.message : "Delete sessions failed"
			});
		}
	}
	async readJsonBody(req) {
		const chunks = [];
		let totalBytes = 0;
		for await (const chunk of req) {
			const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
			totalBytes += buf.byteLength;
			if (totalBytes > EvalProxyServer.BODY_HARD_LIMIT_BYTES) {
				req.destroy();
				throw new Error(`Request body exceeds hard limit of ${EvalProxyServer.BODY_HARD_LIMIT_BYTES / 1024 / 1024} MB — possible runaway eval script`);
			}
			chunks.push(buf);
		}
		const buf = Buffer.concat(chunks);
		if (buf.byteLength > EvalProxyServer.BODY_WARN_THRESHOLD_BYTES) this.logger.warn(`[EvalProxyServer] readJsonBody: oversized body (${(buf.byteLength / 1024 / 1024).toFixed(1)} MB), possible runaway eval script — consider reducing the turns payload`);
		const raw = buf.toString("utf8").trim();
		if (!raw) return {};
		try {
			return JSON.parse(raw);
		} catch {
			throw new SyntaxError("Request body is not valid JSON");
		}
	}
	/**
	* Create a new session via SESSION_RPC_CHANNELS.CREATE.
	* Returns the newly created sessionId; throws if creation fails.
	*/
	async createChatSession(options) {
		const createStart = Date.now();
		const created = await this.daemon.server.invokeLocal(require_contract.SESSION_RPC_CHANNELS.CREATE, {
			cwd: options.cwd,
			config: {
				...options.mode ? { mode: options.mode } : {},
				...options.model ? { model: options.model } : {},
				permissionMode: "bypassPermissions"
			}
		});
		this.logger.info(`[EvalProxyServer] createChatSession: SESSION_CREATE took ${Date.now() - createStart}ms, result=${JSON.stringify(created)}`);
		const sessionId = typeof created?.sessionId === "string" ? created.sessionId : "";
		if (!sessionId) throw new Error("Failed to create chat session");
		return sessionId;
	}
	/**
	* Drive a single prompt turn on an existing session:
	*   1. SEND_MESSAGE and wait for completion
	*   2. Extract assistant text from new events
	*   3. Return output + stopReason + usage
	*/
	async driveChatTurn(sessionId, prompt) {
		const prePromptLength = (this.daemon.sessionManager.getSession(sessionId)?.eventHistory ?? []).length;
		this.logger.info(`[EvalProxyServer] driveChatTurn: prePromptLength=${prePromptLength}, sending message...`);
		const sendMsgStart = Date.now();
		const promptResult = await this.daemon.server.invokeLocal(require_contract.SESSION_RPC_CHANNELS.SEND_MESSAGE, sessionId, [{
			type: "text",
			text: prompt
		}]);
		this.logger.info(`[EvalProxyServer] driveChatTurn: SEND_MESSAGE took ${Date.now() - sendMsgStart}ms, stopReason=${promptResult?.stopReason ?? "n/a"}`);
		const events = (this.daemon.sessionManager.getSession(sessionId)?.eventHistory ?? []).slice(prePromptLength);
		let output = "";
		for (const evt of events) {
			const update = evt.update;
			const updateType = this.pickString(update?.sessionUpdate, evt.type, evt.sessionUpdate);
			if (updateType === "agent_message_chunk" || updateType === "assistant_message_chunk") output += this.extractTextFromContent(update?.content ?? evt.content);
		}
		const acpUsage = promptResult?.usage;
		const usage = acpUsage?.inputTokens != null || acpUsage?.outputTokens != null ? {
			inputTokens: acpUsage?.inputTokens ?? 0,
			outputTokens: acpUsage?.outputTokens ?? 0,
			totalTokens: (acpUsage?.inputTokens ?? 0) + (acpUsage?.outputTokens ?? 0)
		} : void 0;
		this.logger.info(`[EvalProxyServer] driveChatTurn: output length=${output.length}`);
		return {
			sessionId,
			output: output.trim(),
			stopReason: promptResult?.stopReason,
			...usage ? { usage } : {}
		};
	}
	/**
	* Extract text from content field which may be a single object or an array.
	* Mirrors how ACPMessageAccumulator.extractText() handles this.
	*/
	extractTextFromContent(content) {
		if (!content) return "";
		const blocks = Array.isArray(content) ? content : [content];
		let text = "";
		for (const block of blocks) if (typeof block === "object" && block !== null) {
			const typedBlock = block;
			if (typedBlock.type === "text" && typedBlock.text) text += typedBlock.text;
		}
		return text;
	}
	/**
	* Normalize the return value of SESSION_RPC_CHANNELS.LIST into a plain array.
	* The LIST handler returns { agents: SessionRecord[], pagination: null } — not a bare array.
	* Both handleGetSessions and handleDeleteSessions use this helper so that any
	* future format change only needs to be fixed in one place.
	*/
	extractSessionList(result) {
		if (Array.isArray(result)) return result;
		if (result && typeof result === "object") {
			const agents = result.agents;
			if (Array.isArray(agents)) return agents;
		}
		return [];
	}
	pickString(...candidates) {
		for (const candidate of candidates) if (typeof candidate === "string" && candidate.trim().length > 0) return candidate;
	}
	listenOnPort(server) {
		if (this.preferredPort === 0) return new Promise((resolve, reject) => {
			const onError = (err) => reject(err);
			server.once("error", onError);
			server.listen(0, this.host, () => {
				server.removeListener("error", onError);
				const address = server.address();
				if (!address || typeof address === "string") {
					reject(/* @__PURE__ */ new Error("[EvalProxyServer] Failed to resolve ephemeral port"));
					return;
				}
				resolve(address.port);
			});
		});
		return new Promise((resolve, reject) => {
			let attempts = 0;
			const tryListen = (port) => {
				const onError = (err) => {
					server.removeListener("listening", onListening);
					if (err.code === "EADDRINUSE" && attempts < this.portRetries) {
						attempts++;
						this.logger.warn(`[EvalProxyServer] Port ${port} in use, trying ${port + 1}...`);
						tryListen(port + 1);
						return;
					}
					reject(err);
				};
				const onListening = () => {
					server.removeListener("error", onError);
					resolve(port);
				};
				server.once("error", onError);
				server.once("listening", onListening);
				server.listen(port, this.host);
			};
			tryListen(this.preferredPort);
		});
	}
};
//#endregion
exports.EvalProxyServer = EvalProxyServer;
