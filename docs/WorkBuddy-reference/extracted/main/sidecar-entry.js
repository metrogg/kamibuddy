Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const require_chunk = require("./chunk.js");
const require_crash_reporter = require("./crash-reporter.js");
const require_dist = require("./dist.js");
const require_credential_protection_bootstrap = require("./credential-protection-bootstrap.js");
const require_process_reap_utils = require("./process-reap-utils.js");
const require_process_cpu_sampler = require("./process-cpu-sampler.js");
const require_transport_error = require("./transport-error.js");
let fs = require("fs");
fs = require_chunk.__toESM(fs);
let path = require("path");
path = require_chunk.__toESM(path);
let node_child_process = require("node:child_process");
let node_fs = require("node:fs");
node_fs = require_chunk.__toESM(node_fs);
let node_path = require("node:path");
node_path = require_chunk.__toESM(node_path);
let node_crypto = require("node:crypto");
let crypto = require("crypto");
let net = require("net");
net = require_chunk.__toESM(net);
//#region ../../packages/workbuddy-server/src/sidecar/credential-protection-state.ts
var SidecarCredentialProtectionState = class {
	constructor(expectedMode) {
		this.expectedMode = expectedMode;
	}
	initialize(payload) {
		let incoming;
		try {
			incoming = require_dist.decodeAtRestEncryptionBootstrap(payload);
		} catch {
			return {
				ok: false,
				mode: this.expectedMode
			};
		}
		if (incoming.mode !== this.expectedMode) {
			require_dist.disposeAtRestEncryptionBootstrap(incoming);
			return {
				ok: false,
				mode: this.expectedMode
			};
		}
		const incomingFingerprint = JSON.stringify(require_dist.encodeAtRestEncryptionBootstrap(incoming));
		if (this.bootstrap) {
			const matches = incomingFingerprint === this.fingerprint;
			require_dist.disposeAtRestEncryptionBootstrap(incoming);
			return {
				ok: matches,
				mode: this.expectedMode
			};
		}
		this.bootstrap = incoming;
		this.fingerprint = incomingFingerprint;
		return {
			ok: true,
			mode: this.expectedMode
		};
	}
	getMode() {
		return this.bootstrap?.mode ?? this.expectedMode;
	}
	exportForChild() {
		return require_dist.encodeAtRestEncryptionBootstrap(this.bootstrap ?? require_dist.createUnavailableAtRestEncryptionBootstrap(this.expectedMode, "transport"));
	}
	dispose() {
		if (this.bootstrap) {
			require_dist.disposeAtRestEncryptionBootstrap(this.bootstrap);
			this.bootstrap = void 0;
		}
		this.fingerprint = void 0;
	}
};
//#endregion
//#region ../../packages/workbuddy-server/src/sidecar/ring-buffer.ts
var RingBuffer = class {
	constructor(cap = require_process_reap_utils.DEFAULT_RING_BUFFER_BYTES) {
		this.cap = cap;
		this.head = 0;
		this.filled = 0;
		this.total = 0;
		this.buf = Buffer.alloc(cap);
	}
	write(data) {
		const len = data.length;
		if (len === 0) return;
		if (len >= this.cap) {
			Buffer.from(data.buffer, data.byteOffset + len - this.cap, this.cap).copy(this.buf, 0);
			this.head = 0;
			this.filled = this.cap;
			this.total += len;
			return;
		}
		const spaceAtEnd = this.cap - this.head;
		if (len <= spaceAtEnd) Buffer.from(data).copy(this.buf, this.head);
		else {
			Buffer.from(data).copy(this.buf, this.head, 0, spaceAtEnd);
			Buffer.from(data).copy(this.buf, 0, spaceAtEnd);
		}
		this.head = (this.head + len) % this.cap;
		this.filled = Math.min(this.filled + len, this.cap);
		this.total += len;
	}
	snapshot() {
		if (this.filled === 0) return Buffer.alloc(0);
		if (this.filled < this.cap) return Buffer.from(this.buf.subarray(0, this.filled));
		const out = Buffer.alloc(this.cap);
		this.buf.copy(out, 0, this.head, this.cap);
		this.buf.copy(out, this.cap - this.head, 0, this.head);
		return out;
	}
	get totalWritten() {
		return this.total;
	}
	get currentFill() {
		return this.filled;
	}
	get capacity() {
		return this.cap;
	}
};
//#endregion
//#region ../../packages/workbuddy-server/src/sidecar/session-journal.ts
/**
* Sidecar 会话账本：为每个会话子进程落一份 `<pid>.json`，并在 sidecar 启动时对账。
*
* 背景：sidecar 的会话表只在内存里。sidecar 正常退出会 kill 全部子进程，但被
* SIGKILL / 崩溃时子进程会脱管存活（reparent），磁盘上没有任何 sessionId→pid
* 记录，daemon 与新 sidecar 都永远够不到它们——这是"定时任务残留进程"泄漏链里
* 最后一个结构性缺口。账本 + 启动期 reap 把它补上。
*
* 防误杀三道闸（详见 process-reap-utils.ts 顶部注释）：
* 1. 非法/非正 pid 一律不动手；
* 2. 杀前读命令行，必须含账本登记的 sessionId（子进程 argv 带 `--session-id <id>`）
*    ——PID 已被无关进程复用时只清账不动手；
* 3. 命令行查询失败（null）保守跳过，留待下次启动重试。
*/
/**
* 无法解析/形状非法的账本文件要等这么老才允许清除：非原子写入方（老版本
* writer、外部工具）落盘一半时被读到不能当垃圾删——删了会把刚登记的会话
* 变回不可对账的孤儿。60s 远超任何在途写入的收敛时间。
*/
var UNPARSEABLE_ENTRY_UNLINK_AGE_MS = 6e4;
/** `.json.tmp` 中间文件的清理年龄阈值（写入方崩在 rename 之前的残留）。 */
var STALE_TEMP_FILE_UNLINK_AGE_MS = 6e4;
/** 会话 spawn 后立即登记；失败不影响会话创建（best-effort）。 */
function recordSessionJournal(dir, entry, log) {
	if (!require_process_reap_utils.isValidTargetPid(entry.pid)) return;
	try {
		fs.mkdirSync(dir, {
			recursive: true,
			mode: 448
		});
		const finalPath = path.join(dir, `${entry.pid}.json`);
		const tempPath = `${finalPath}.tmp`;
		fs.writeFileSync(tempPath, JSON.stringify(entry));
		fs.renameSync(tempPath, finalPath);
	} catch (error) {
		log?.(`Session journal write failed for ${entry.sessionId} (pid=${entry.pid}): ${String(error)}`);
	}
}
/** 会话退出/被杀时清账（best-effort）。 */
function removeSessionJournal(dir, pid) {
	if (typeof pid !== "number" || !Number.isInteger(pid) || pid <= 1) return;
	try {
		fs.unlinkSync(path.join(dir, `${pid}.json`));
	} catch {}
}
/**
* 无法解析/形状非法的条目：只清除「够老」的（mtime 超过阈值）。年轻的可能是
* 非原子写入方的在途写入，删了会误清刚登记的合法账本——保留待下次启动再判。
*/
function unlinkUnparseableEntryIfStale(filePath, log) {
	try {
		const ageMs = Date.now() - fs.statSync(filePath).mtimeMs;
		if (ageMs < UNPARSEABLE_ENTRY_UNLINK_AGE_MS) {
			log(`Session journal reap: ${path.basename(filePath)} is unparseable but only ${Math.round(ageMs / 1e3)}s old, keeping (possible in-flight write)`);
			return;
		}
		fs.unlinkSync(filePath);
		log(`Session journal reap: dropped stale unparseable entry ${path.basename(filePath)}`);
	} catch {}
}
/**
* 跨过 await 之后的清账必须先验内容未变：等待 ps/kill 期间本代可能复用同一
* pid 落了新账本（同名文件已易主），此时静默放弃 unlink。parse 失败同样放弃
* ——那是写入方正在覆写。
*/
function unlinkEntryIfUnchanged(filePath, expectedSessionId) {
	try {
		if (JSON.parse(fs.readFileSync(filePath, "utf-8"))?.sessionId !== expectedSessionId) return;
	} catch {
		return;
	}
	try {
		fs.unlinkSync(filePath);
	} catch {}
}
/** 清理写入方崩在 rename 前残留的够老 `.json.tmp` 中间文件。 */
function reapStaleTempFiles(dir, names, log) {
	for (const name of names) {
		if (!name.endsWith(".json.tmp")) continue;
		const filePath = path.join(dir, name);
		try {
			if (Date.now() - fs.statSync(filePath).mtimeMs >= STALE_TEMP_FILE_UNLINK_AGE_MS) {
				fs.unlinkSync(filePath);
				log(`Session journal reap: dropped stale temp file ${name}`);
			}
		} catch {}
	}
}
/**
* 启动期对账：扫描账本目录，收割上一代 sidecar 脱管的会话子进程。
* 只处理调用时刻已存在的文件——本代新建会话的账本在扫描快照之后写入，不受影响。
* 整体与逐条均不抛错，不阻塞 sidecar 启动。
*
* `isLivePid`：宿主注入的「pid 是否属于本代活会话」谓词。reap 与本代 spawn 并发，
* 上代账本文件名（pid）被本代复用时，账本与进程都已易主——命中即整条跳过，
* 既不杀也不清账。ps/kill 各 await 之后还会复查，收窄 TOCTOU 窗口。
*/
async function reapOrphanSessionJournal(dir, log, isLivePid) {
	let names;
	try {
		names = fs.readdirSync(dir);
	} catch {
		return;
	}
	reapStaleTempFiles(dir, names, log);
	const files = names.filter((name) => name.endsWith(".json"));
	if (files.length === 0) return;
	log(`Session journal reap: inspecting ${files.length} leftover entr${files.length === 1 ? "y" : "ies"}`);
	for (const name of files) {
		const filePath = path.join(dir, name);
		try {
			let entry;
			try {
				entry = JSON.parse(fs.readFileSync(filePath, "utf-8"));
			} catch {}
			if (!entry || !require_process_reap_utils.isValidTargetPid(entry.pid) || typeof entry.sessionId !== "string" || !entry.sessionId) {
				unlinkUnparseableEntryIfStale(filePath, log);
				continue;
			}
			if (isLivePid?.(entry.pid)) {
				log(`Session journal reap: pid=${entry.pid} belongs to a live session of this generation, skipping`);
				continue;
			}
			if (!require_process_reap_utils.isPidAlive(entry.pid)) {
				fs.unlinkSync(filePath);
				continue;
			}
			const commandLine = await require_process_reap_utils.readProcessCommandLine(entry.pid);
			if (isLivePid?.(entry.pid)) {
				log(`Session journal reap: pid=${entry.pid} became a live session during inspection, skipping`);
				continue;
			}
			if (commandLine === null) {
				log(`Session journal reap: cannot inspect pid=${entry.pid} (session ${entry.sessionId}), skipping`);
				continue;
			}
			if (!commandLine.includes(entry.sessionId)) {
				log(`Session journal reap: pid=${entry.pid} no longer matches session ${entry.sessionId}, dropping stale entry`);
				unlinkEntryIfUnchanged(filePath, entry.sessionId);
				continue;
			}
			log(`Session journal reap: killing orphan session ${entry.sessionId} (pid=${entry.pid}, startedAt=${new Date(entry.startedAt).toISOString()})`);
			if (await require_process_reap_utils.killProcessTree(entry.pid)) {
				unlinkEntryIfUnchanged(filePath, entry.sessionId);
				log(`Session journal reap: orphan session ${entry.sessionId} (pid=${entry.pid}) terminated`);
			} else log(`Session journal reap: orphan session ${entry.sessionId} (pid=${entry.pid}) survived kill attempts, keeping entry for next boot`);
		} catch (error) {
			log(`Session journal reap: failed handling ${name}: ${String(error)}`);
		}
	}
}
//#endregion
//#region ../../packages/workbuddy-server/src/sidecar/session-process.ts
/**
* SessionProcess — platform-abstracted child process used by SidecarServer
* to host a CLI (agent-cli `--serve`) instance per session.
*
* Two backends:
*   • PTY (macOS, Linux): @lydell/node-pty. Unchanged historical path.
*   • ChildProcess (Windows): node:child_process.spawn. Added for Issue #37718
*     to sidestep repeated edge cases in node-pty's Windows native layer
*     (winpty-conout ENOENT, missing ConPTY on Server 2016, named-pipe
*     lock contention, winpty output truncation). WorkBuddy Desktop does
*     not rely on TTY semantics — the CLI's ACP HTTP server on 127.0.0.1
*     is the real transport. PTY was only providing a log/TUI stream that
*     no consumer uses today (TerminalView is defined but never mounted).
*
* The two backends expose the same six-method surface the server depends
* on, so SidecarServer does not need platform branches.
*/
var sessionCrashReporter;
function bindSessionCrashReporter(fn) {
	sessionCrashReporter = fn;
}
/**
* Build a session process for the current platform.
* Windows → ChildProcess; other → PTY.
*/
function createSessionProcess(opts) {
	if (process.platform === "win32") return createChildProcessSession(opts);
	return createPtySession(opts);
}
/**
* Spawn using `child_process.spawn` with piped stdio.
*
* Rationale: Windows node-pty repeatedly surfaces native-layer failures
* (`winpty-conout` ENOENT, ConPTY unavailable on older builds, named-pipe
* lock contention after restart, winpty output truncation). WorkBuddy
* Desktop talks to the CLI over ACP/HTTP, so PTY semantics are not
* required for task execution. Trading PTY for a plain pipe on Windows
* eliminates an entire class of boot-time failures.
*
* Kept out of scope: ANSI color passthrough and live `resize` support.
* Neither has a consumer in the desktop app today (TerminalView is not
* mounted anywhere).
*
* Exported for direct use in tests on non-Windows platforms.
*/
function createChildProcessSession(opts) {
	const child = (0, node_child_process.spawn)(opts.command, opts.args, {
		cwd: opts.cwd,
		env: opts.env,
		windowsHide: true,
		stdio: [
			"pipe",
			"pipe",
			"pipe"
		]
	});
	const dataListeners = /* @__PURE__ */ new Set();
	const exitListeners = /* @__PURE__ */ new Set();
	let exited = false;
	let exitEvent;
	const emitData = (chunk) => {
		if (exited) return;
		for (const cb of dataListeners) try {
			cb(chunk);
		} catch {}
	};
	child.stdout.on("data", (chunk) => emitData(chunk));
	child.stderr.on("data", (chunk) => emitData(chunk));
	child.stdin.on("error", (_err) => {});
	child.on("exit", (code, signal) => {
		if (exited) return;
		exited = true;
		const exitCode = code ?? 0;
		const signalNum = signal ? signalNameToNumber(signal) : void 0;
		const evt = {
			exitCode,
			signal: signalNum
		};
		exitEvent = evt;
		if (exitCode !== 0 || signalNum !== void 0 && signalNum !== 0) sessionCrashReporter?.({
			pid: child.pid,
			exitCode,
			signal: signalNum,
			name: "cli"
		});
		for (const cb of exitListeners) try {
			cb(evt);
		} catch {}
		dataListeners.clear();
		exitListeners.clear();
	});
	child.on("error", (_err) => {
		if (exited) return;
		exited = true;
		const evt = {
			exitCode: 1,
			signal: void 0
		};
		exitEvent = evt;
		for (const cb of exitListeners) try {
			cb(evt);
		} catch {}
		dataListeners.clear();
		exitListeners.clear();
	});
	return {
		get pid() {
			return child.pid ?? 0;
		},
		onData(cb) {
			dataListeners.add(cb);
			return { dispose() {
				dataListeners.delete(cb);
			} };
		},
		onExit(cb) {
			if (exitEvent) {
				let disposed = false;
				const event = exitEvent;
				queueMicrotask(() => {
					if (!disposed) try {
						cb(event);
					} catch {}
				});
				return { dispose() {
					disposed = true;
				} };
			}
			exitListeners.add(cb);
			return { dispose() {
				exitListeners.delete(cb);
			} };
		},
		write(data) {
			if (!child.stdin.writable) return;
			try {
				child.stdin.write(data);
			} catch {}
		},
		resize(_cols, _rows) {},
		kill(_signal) {
			try {
				child.kill();
			} catch {}
		}
	};
}
/**
* Legacy PTY-backed session. Kept unchanged behaviorally from the pre-
* refactor `pty.spawn` path in server.ts.
*
* We dynamically require `@lydell/node-pty` so that a Windows bundle
* which never calls this function never tries to load its native binding
* — Issue #37718 observed winpty binaries crashing even when only
* imported.
*/
function createPtySession(opts) {
	const proc = require("@lydell/node-pty").spawn(opts.command, opts.args, {
		name: "xterm-256color",
		cols: opts.cols,
		rows: opts.rows,
		cwd: opts.cwd,
		env: opts.env,
		encoding: null
	});
	const exitListeners = /* @__PURE__ */ new Set();
	let exitEvent;
	proc.onExit(({ exitCode, signal }) => {
		exitEvent = {
			exitCode,
			signal
		};
		if (exitCode !== 0 || signal !== void 0 && signal !== 0) sessionCrashReporter?.({
			pid: proc.pid,
			exitCode,
			signal,
			name: "cli"
		});
		for (const listener of exitListeners) try {
			listener(exitEvent);
		} catch {}
		exitListeners.clear();
	});
	return {
		get pid() {
			return proc.pid;
		},
		onData(cb) {
			const disposable = proc.onData((rawData) => {
				cb(typeof rawData === "string" ? Buffer.from(rawData, "binary") : Buffer.from(rawData));
			});
			return { dispose: () => disposable.dispose() };
		},
		onExit(cb) {
			if (exitEvent) {
				let disposed = false;
				const event = exitEvent;
				queueMicrotask(() => {
					if (!disposed) try {
						cb(event);
					} catch {}
				});
				return { dispose() {
					disposed = true;
				} };
			}
			exitListeners.add(cb);
			return { dispose: () => exitListeners.delete(cb) };
		},
		write(data) {
			if (typeof data === "string") proc.write(data);
			else proc.write(data.toString("binary"));
		},
		resize(cols, rows) {
			proc.resize(cols, rows);
		},
		kill(signal) {
			proc.kill(signal);
		}
	};
}
/**
* Map a POSIX signal name to its canonical number. Used only to match
* node-pty's onExit payload shape. Unknown names return undefined.
*/
function signalNameToNumber(name) {
	switch (name) {
		case "SIGTERM": return 15;
		case "SIGKILL": return 9;
		case "SIGINT": return 2;
		case "SIGHUP": return 1;
		default: return;
	}
}
//#endregion
//#region ../../packages/workbuddy-server/src/sidecar/session-ready-registry.ts
var ACCEPTED_REPORT_REPLAY_TTL_MS = 1e4;
/**
* Tracks one-shot child -> sidecar endpoint readiness handshakes.
*
* Entries exist before the child is spawned, are armed with the actual child
* PID immediately after spawn, and are consumed by one matching report.
* The exact report remains replayable briefly so a child can retry when the
* sidecar accepted it but the acknowledgement was lost. Keeping this state
* outside the ready session map lets exit/timeout/shutdown reject the in-flight
* `session.create` RPC without leaking an orphan process.
*/
var SessionReadyRegistry = class {
	constructor() {
		this.pending = /* @__PURE__ */ new Map();
		this.accepted = /* @__PURE__ */ new Map();
	}
	register(sessionId, timeoutMs = require_process_reap_utils.SESSION_ENDPOINT_READY_TIMEOUT_MS) {
		if (this.pending.has(sessionId)) throw new Error(`Session readiness is already pending: ${sessionId}`);
		this.clearAccepted(sessionId);
		const token = (0, node_crypto.randomUUID)();
		let resolve;
		let reject;
		const promise = new Promise((promiseResolve, promiseReject) => {
			resolve = promiseResolve;
			reject = promiseReject;
		});
		promise.catch(() => void 0);
		const timer = setTimeout(() => {
			const entry = this.pending.get(sessionId);
			if (!entry || entry.token !== token) return;
			this.pending.delete(sessionId);
			reject(/* @__PURE__ */ new Error(`Session ${sessionId} did not report its runtime endpoint within ${timeoutMs}ms`));
		}, timeoutMs);
		timer.unref?.();
		const entry = {
			token,
			timer,
			resolve,
			reject
		};
		this.pending.set(sessionId, entry);
		return {
			token,
			promise,
			arm: (expectedPid) => {
				if (!Number.isInteger(expectedPid) || expectedPid <= 0) throw new Error(`Cannot arm session readiness with invalid PID: ${expectedPid}`);
				const current = this.pending.get(sessionId);
				if (!current || current.token !== token) throw new Error(`Session readiness is no longer pending: ${sessionId}`);
				current.expectedPid = expectedPid;
			}
		};
	}
	accept(params) {
		if (params.protocolVersion !== 1) throw new Error(`Unsupported session readiness protocol version: ${params.protocolVersion}`);
		if (!Number.isInteger(params.port) || params.port < 1 || params.port > 65535) throw new Error(`Invalid endpoint readiness port for session ${params.sessionId}: ${params.port}`);
		const entry = this.pending.get(params.sessionId);
		if (!entry) {
			const accepted = this.accepted.get(params.sessionId);
			if (accepted && params.token === accepted.token && params.pid === accepted.report.pid && params.port === accepted.report.port) return accepted.report;
			throw new Error(`No endpoint readiness handshake is pending for session ${params.sessionId}`);
		}
		if (params.token !== entry.token) throw new Error(`Invalid endpoint readiness token for session ${params.sessionId}`);
		if (entry.expectedPid === void 0) throw new Error(`Session readiness is not armed for session ${params.sessionId}`);
		if (params.pid !== entry.expectedPid) throw new Error(`Endpoint readiness PID mismatch for session ${params.sessionId} (expected=${entry.expectedPid}, actual=${params.pid})`);
		const report = {
			pid: params.pid,
			port: params.port
		};
		this.pending.delete(params.sessionId);
		clearTimeout(entry.timer);
		const timer = setTimeout(() => {
			if (this.accepted.get(params.sessionId)?.token === params.token) this.accepted.delete(params.sessionId);
		}, ACCEPTED_REPORT_REPLAY_TTL_MS);
		timer.unref?.();
		this.accepted.set(params.sessionId, {
			token: params.token,
			report,
			timer
		});
		entry.resolve(report);
		return report;
	}
	reject(sessionId, error) {
		const entry = this.pending.get(sessionId);
		if (entry) {
			this.pending.delete(sessionId);
			clearTimeout(entry.timer);
			entry.reject(error);
		}
		this.clearAccepted(sessionId);
	}
	rejectAll(error) {
		for (const sessionId of [...this.pending.keys()]) this.reject(sessionId, error);
		for (const sessionId of [...this.accepted.keys()]) this.clearAccepted(sessionId);
	}
	clearAccepted(sessionId) {
		const accepted = this.accepted.get(sessionId);
		if (!accepted) return;
		this.accepted.delete(sessionId);
		clearTimeout(accepted.timer);
	}
};
//#endregion
//#region ../../packages/workbuddy-server/src/sidecar/server.ts
function log(...args) {
	console.error("[Sidecar]", ...args);
}
function logError(...args) {
	console.error("[Sidecar]", ...args);
}
var CREDENTIAL_BOOTSTRAP_TIMEOUT_MS = 6e4;
var CREDENTIAL_BOOTSTRAP_RETRY_MS = 125;
var CREDENTIAL_BOOTSTRAP_ACK_MAX_BYTES = 4 * 1024;
var SidecarServer = class {
	constructor(token, controlPipeUuid, expectedCredentialProtectionMode = "disabled") {
		this.token = token;
		this.controlPipeUuid = controlPipeUuid;
		this.sessions = /* @__PURE__ */ new Map();
		this.sessionReadyRegistry = new SessionReadyRegistry();
		this.controlClients = /* @__PURE__ */ new Set();
		this.controlServer = null;
		this.idleTimer = null;
		this.startTime = Date.now();
		this.shuttingDown = false;
		if (!controlPipeUuid) throw new Error("SidecarServer requires a non-empty controlPipeUuid");
		this.credentialProtectionState = new SidecarCredentialProtectionState(expectedCredentialProtectionMode);
	}
	async start() {
		const sockPath = require_process_reap_utils.controlSocketPath(this.controlPipeUuid);
		await require_process_reap_utils.ensureSidecarRuntimeDir();
		if (!require_process_reap_utils.isNamedPipe()) await this.cleanupStaleSocket(sockPath);
		await new Promise((resolve, reject) => {
			this.controlServer = net.createServer((client) => this.handleControlClient(client));
			this.controlServer.on("error", reject);
			this.controlServer.listen(sockPath, () => {
				log(`Control socket listening on ${sockPath}`);
				resolve();
			});
		});
		await this.writePidFile();
		reapOrphanSessionJournal(require_process_reap_utils.sessionJournalDir(), log, (pid) => {
			for (const session of this.sessions.values()) if (session.ptyProcess.pid === pid && !session.exited) return true;
			return false;
		}).catch((error) => {
			logError("Session journal reap failed:", error);
		});
		this.resetIdleTimer();
		log(`Sidecar v4 started (pid=${process.pid}, controlPipeUuid=${this.controlPipeUuid})`);
	}
	/** Graceful shutdown: kill all sessions, close sockets, remove PID file. */
	async shutdown() {
		if (this.shuttingDown) return;
		this.shuttingDown = true;
		this.sessionReadyRegistry.rejectAll(/* @__PURE__ */ new Error("Sidecar is shutting down"));
		log("Shutting down...");
		if (this.idleTimer) {
			clearTimeout(this.idleTimer);
			this.idleTimer = null;
		}
		const kills = Array.from(this.sessions.keys()).map((id) => this.killSession(id).catch((err) => logError(`Error killing session ${id}:`, err)));
		await Promise.all(kills);
		for (const client of this.controlClients) client.destroy();
		this.controlClients.clear();
		if (this.controlServer) {
			await new Promise((resolve) => {
				this.controlServer.close(() => resolve());
			});
			this.controlServer = null;
		}
		if (!require_process_reap_utils.isNamedPipe()) this.unlinkSafe(require_process_reap_utils.controlSocketPath(this.controlPipeUuid));
		this.unlinkSafe(require_process_reap_utils.pidFilePath());
		this.credentialProtectionState.dispose();
		log("Shutdown complete.");
	}
	handleControlClient(client) {
		this.controlClients.add(client);
		this.resetIdleTimer();
		let buffer = "";
		client.on("data", (chunk) => {
			buffer += chunk.toString("utf-8");
			let newlineIdx;
			while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
				const line = buffer.slice(0, newlineIdx).trim();
				buffer = buffer.slice(newlineIdx + 1);
				if (line.length > 0) this.handleControlMessage(client, line);
			}
		});
		client.on("close", () => {
			this.controlClients.delete(client);
			this.resetIdleTimer();
		});
		client.on("error", (err) => {
			logError("Control client error:", err.message);
			this.controlClients.delete(client);
			client.destroy();
			this.resetIdleTimer();
		});
	}
	handleControlMessage(client, raw) {
		let req;
		try {
			req = JSON.parse(raw);
		} catch {
			this.sendResponse(client, {
				jsonrpc: "2.0",
				id: null,
				error: {
					code: require_process_reap_utils.JSON_RPC_PARSE_ERROR,
					message: "Parse error"
				}
			});
			return;
		}
		this.resetIdleTimer();
		this.dispatch(client, req);
	}
	async dispatch(client, req) {
		const respond = (result, error) => {
			const resp = {
				jsonrpc: "2.0",
				id: req.id
			};
			if (error) resp.error = error;
			else resp.result = result ?? null;
			this.sendResponse(client, resp);
		};
		try {
			switch (req.method) {
				case "session.create": {
					const params = req.params;
					if (!params || !params.command || !params.cwd || params.port == null) {
						respond(void 0, {
							code: require_process_reap_utils.JSON_RPC_INVALID_PARAMS,
							message: "Missing required params: command, cwd, port"
						});
						return;
					}
					respond(await this.createSession(params));
					break;
				}
				case "session.ready": {
					const params = req.params;
					if (!params?.sessionId || !params.token || params.pid == null || params.port == null) {
						respond(void 0, {
							code: require_process_reap_utils.JSON_RPC_INVALID_PARAMS,
							message: "Missing required params: sessionId, token, pid, port"
						});
						return;
					}
					try {
						const report = this.sessionReadyRegistry.accept(params);
						log(`Session ${params.sessionId} reported ready (pid=${report.pid}, port=${report.port})`);
						respond({ ok: true });
					} catch (error) {
						respond(void 0, {
							code: require_process_reap_utils.JSON_RPC_INVALID_PARAMS,
							message: error instanceof Error ? error.message : String(error)
						});
					}
					break;
				}
				case "session.reconnect": {
					const p = req.params;
					if (!p?.sessionId) {
						respond(void 0, {
							code: require_process_reap_utils.JSON_RPC_INVALID_PARAMS,
							message: "Missing sessionId"
						});
						return;
					}
					respond(this.reconnectSession(p.sessionId, p.cols, p.rows));
					break;
				}
				case "session.resize": {
					const p = req.params;
					if (!p?.sessionId || p.cols == null || p.rows == null) {
						respond(void 0, {
							code: require_process_reap_utils.JSON_RPC_INVALID_PARAMS,
							message: "Missing sessionId, cols, rows"
						});
						return;
					}
					this.resizeSession(p.sessionId, p.cols, p.rows);
					respond({ ok: true });
					break;
				}
				case "session.kill": {
					const p = req.params;
					if (!p?.sessionId) {
						respond(void 0, {
							code: require_process_reap_utils.JSON_RPC_INVALID_PARAMS,
							message: "Missing sessionId"
						});
						return;
					}
					await this.killSession(p.sessionId, { waitForExitFallback: false });
					respond({ ok: true });
					break;
				}
				case "session.list":
					respond(this.listSessions());
					break;
				case "session.capture": {
					const p = req.params;
					if (!p?.sessionId) {
						respond(void 0, {
							code: require_process_reap_utils.JSON_RPC_INVALID_PARAMS,
							message: "Missing sessionId"
						});
						return;
					}
					respond({ text: this.captureSession(p.sessionId, p.lines) });
					break;
				}
				case "sidecar.credentialProtection.bootstrap":
					respond(this.credentialProtectionState.initialize(req.params));
					break;
				case "sidecar.ping":
					respond(this.ping());
					break;
				case "sidecar.shutdown":
					respond({ ok: true });
					setImmediate(() => this.shutdown().then(() => process.exit(0)));
					break;
				default: respond(void 0, {
					code: require_process_reap_utils.JSON_RPC_METHOD_NOT_FOUND,
					message: `Unknown method: ${req.method}`
				});
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			logError(`Error handling ${req.method}:`, message);
			respond(void 0, {
				code: require_process_reap_utils.JSON_RPC_INTERNAL_ERROR,
				message
			});
		}
	}
	async createSession(params) {
		const sessionId = params.sessionId || (0, crypto.randomUUID)();
		const cols = params.cols ?? 80;
		const rows = params.rows ?? 24;
		if (this.sessions.has(sessionId)) throw new Error(`Session already exists: ${sessionId}`);
		log(`Creating session ${sessionId} — ${params.command} (port=${params.port})`);
		log(`Session ${sessionId} spawn details: command=${params.command}, args=${JSON.stringify(params.args ?? [])}, cwd=${params.cwd}`);
		const probePath = (p) => {
			try {
				const st = fs.statSync(p);
				return st.isDirectory() ? "dir" : st.isFile() ? "file" : "other";
			} catch (e) {
				return `missing(${e?.code ?? "UNKNOWN"})`;
			}
		};
		const scriptPath = (params.args ?? [])[0];
		log(`Session ${sessionId} pre-spawn probe: command=${probePath(params.command)}, cwd=${probePath(params.cwd)}, script=${scriptPath ? probePath(scriptPath) : "none"}`);
		try {
			if (!fs.statSync(params.cwd).isDirectory()) throw new Error(`Working directory "${params.cwd}" exists but is not a directory. Cannot start CLI session.`);
		} catch (cwdErr) {
			const e = cwdErr;
			const code = e?.code ?? "UNKNOWN";
			logError(`Session ${sessionId} pre-spawn cwd check failed: ${e?.message ?? String(cwdErr)}`);
			throw new Error(`Working directory not available: "${params.cwd}" (${code}). Please verify the default workspace path in Settings exists and is accessible.`);
		}
		let readyWaiter;
		let credentialBootstrapSocketPath;
		const cliProcessEnv = require_process_reap_utils.buildCliProcessEnv(params.env);
		if (params.port === 0) {
			readyWaiter = this.sessionReadyRegistry.register(sessionId);
			credentialBootstrapSocketPath = require_process_reap_utils.dataSocketPath(`credential-bootstrap-${sessionId}-${readyWaiter.token}`);
			Object.assign(cliProcessEnv, {
				SERVER__PORT: "0",
				SERVER__HOST: "127.0.0.1",
				[require_process_reap_utils.SIDECAR_READY_SOCKET_ENV]: require_process_reap_utils.controlSocketPath(this.controlPipeUuid),
				[require_process_reap_utils.SIDECAR_READY_TOKEN_ENV]: readyWaiter.token,
				[require_process_reap_utils.SIDECAR_READY_SESSION_ID_ENV]: sessionId,
				[require_process_reap_utils.SIDECAR_CREDENTIAL_BOOTSTRAP_SOCKET_ENV]: credentialBootstrapSocketPath,
				WORKBUDDY_AT_REST_ENCRYPTION: this.credentialProtectionState.getMode()
			});
		}
		const ptyArgs = [
			...params.args ?? [],
			"--port",
			String(params.port)
		];
		let ptyProcess;
		try {
			ptyProcess = createSessionProcess({
				command: params.command,
				args: ptyArgs,
				cwd: params.cwd,
				env: cliProcessEnv,
				cols,
				rows
			});
		} catch (spawnErr) {
			const original = spawnErr instanceof Error ? spawnErr.message : String(spawnErr);
			const errCode = spawnErr?.code ?? "";
			const isCwdError = errCode === "ENOENT" || errCode === "ENOTDIR" || /\berror code:\s*267\b/i.test(original) || /ERROR_DIRECTORY/i.test(original);
			let err;
			if (isCwdError) {
				const cwdState = (() => {
					try {
						return fs.statSync(params.cwd).isDirectory() ? "dir" : "not-a-directory";
					} catch (e) {
						return `missing(${e?.code ?? "UNKNOWN"})`;
					}
				})();
				err = /* @__PURE__ */ new Error(`Session spawn failed: working directory "${params.cwd}" is not usable (${cwdState}). Original error: ${original}. Please verify the default workspace path in Settings exists and is accessible.`);
			} else {
				const platformHint = process.platform === "win32" ? " Possible cause: CLI binary missing, blocked by antivirus, or permission denied." : " Possible cause: missing or incompatible native PTY binary.";
				err = /* @__PURE__ */ new Error(`Session spawn failed: ${original}.${platformHint}`);
			}
			logError(`Session ${sessionId} spawn failed (cwdError=${isCwdError}, code=${errCode || "n/a"}): ${original}`);
			this.sessionReadyRegistry.reject(sessionId, err);
			throw err;
		}
		try {
			readyWaiter?.arm(ptyProcess.pid);
		} catch (error) {
			this.sessionReadyRegistry.reject(sessionId, error instanceof Error ? error : new Error(String(error)));
			try {
				ptyProcess.kill("SIGTERM");
			} catch {}
			throw error;
		}
		const ringBuffer = new RingBuffer();
		let acpEndpoint = params.port === 0 ? "" : `http://127.0.0.1:${params.port}/api/v1/acp`;
		const session = {
			id: sessionId,
			ptyProcess,
			ringBuffer,
			dataSocketServer: null,
			dataClient: null,
			reconnectQueue: null,
			acpEndpoint,
			port: params.port,
			ready: false,
			cols,
			rows,
			terminating: false,
			exited: false
		};
		this.sessions.set(sessionId, session);
		recordSessionJournal(require_process_reap_utils.sessionJournalDir(), {
			sessionId,
			pid: ptyProcess.pid,
			startedAt: Date.now()
		}, log);
		if (readyWaiter && credentialBootstrapSocketPath) this.pushCredentialProtectionBootstrap({
			socketPath: credentialBootstrapSocketPath,
			sessionId,
			token: readyWaiter.token,
			pid: ptyProcess.pid,
			bootstrap: this.credentialProtectionState.exportForChild(),
			isSessionActive: () => this.sessions.get(sessionId) === session && !session.terminating && !session.exited
		}).catch(() => {
			logError("[CredentialProtection] CBC bootstrap unavailable; continuing");
		}).finally(() => {
			if (!require_process_reap_utils.isNamedPipe()) this.unlinkSafe(credentialBootstrapSocketPath);
		});
		const ptyStartTime = Date.now();
		let earlyOutputLogged = false;
		ptyProcess.onData((data) => {
			ringBuffer.write(data);
			if (!earlyOutputLogged && Date.now() - ptyStartTime < 15e3) {
				if (data.length > 0) {
					earlyOutputLogged = true;
					log(`Session ${sessionId} early output observed (${Date.now() - ptyStartTime}ms after spawn, bytes=${data.length})`);
				}
			}
			if (!earlyOutputLogged && Date.now() - ptyStartTime >= 15e3) earlyOutputLogged = true;
			if (session.reconnectQueue) session.reconnectQueue.push(Buffer.from(data));
			else if (session.dataClient) try {
				session.dataClient.write(data);
			} catch {}
		});
		ptyProcess.onExit(({ exitCode, signal }) => {
			session.exited = true;
			removeSessionJournal(require_process_reap_utils.sessionJournalDir(), ptyProcess.pid);
			if (this.sessions.get(sessionId) !== session) {
				log(`Ignoring stale exit for replaced session ${sessionId} (pid=${ptyProcess.pid}, code=${exitCode}, signal=${signal})`);
				return;
			}
			this.sessionReadyRegistry.reject(sessionId, /* @__PURE__ */ new Error(`Session ${sessionId} exited before reporting its runtime endpoint (code=${exitCode}, signal=${signal})`));
			const lastOutput = ringBuffer.snapshot().toString("utf-8").trim();
			const tail = lastOutput.length > 2e3 ? lastOutput.slice(-2e3) : lastOutput;
			log(`Session ${sessionId} exited (code=${exitCode}, signal=${signal}, pid=${ptyProcess.pid}, uptime=${Date.now() - ptyStartTime}ms, lastOutput=${tail ? tail.length + " chars" : "empty"})`);
			if (tail) log(`Session ${sessionId} last output:\n${tail}`);
			if (!tail && Date.now() - ptyStartTime < 5e3 && params.command === process.execPath && params.port !== 0) {
				log(`Session ${sessionId} post-exit probe: cwdExists=${fs.existsSync(params.cwd)}, commandExists=${fs.existsSync(params.command)}, scriptExists=${scriptPath ? fs.existsSync(scriptPath) : true}`);
				const { execFile } = require("child_process");
				const diagArgs = [
					...params.args ?? [],
					"--port",
					String(params.port)
				];
				execFile(params.command, diagArgs, {
					cwd: params.cwd,
					env: {
						...require_process_reap_utils.buildCliProcessEnv(params.env),
						ELECTRON_ENABLE_LOGGING: "1"
					},
					timeout: 5e3
				}, (err, stdout, stderr) => {
					const e = err;
					log(`Session ${sessionId} diag-exec: ${e ? `code=${e.code ?? 0}, errno=${e.errno ?? "n/a"}, syscall=${e.syscall ?? "n/a"}, path=${e.path ?? "n/a"}, msg=${e.message}` : "code=0"}, stdout=${stdout?.trim()?.slice(0, 500) || "empty"}, stderr=${stderr?.trim()?.slice(0, 1e3) || "empty"}`);
				});
			}
			this.broadcastNotification("session.exited", {
				sessionId,
				exitCode,
				signal
			});
			this.cleanupSession(sessionId, session);
		});
		const dataPath = require_process_reap_utils.dataSocketPath(sessionId);
		if (!require_process_reap_utils.isNamedPipe()) this.unlinkSafe(dataPath);
		const dataServer = net.createServer((client) => {
			this.handleDataClient(session, client);
		});
		session.dataSocketServer = dataServer;
		try {
			await new Promise((resolve, reject) => {
				let settled = false;
				const finish = (error) => {
					if (settled) return;
					settled = true;
					dataServer.removeListener("error", onError);
					dataServer.removeListener("close", onClose);
					if (error) reject(error);
					else resolve();
				};
				const onError = (error) => finish(error);
				const onClose = () => finish(/* @__PURE__ */ new Error(`Data socket for session ${sessionId} closed before it became ready`));
				dataServer.once("error", onError);
				dataServer.once("close", onClose);
				dataServer.listen(dataPath, () => {
					log(`Data socket for ${sessionId} at ${dataPath}`);
					finish();
				});
			});
		} catch (error) {
			if (this.sessions.get(sessionId) === session) this.sessionReadyRegistry.reject(sessionId, error instanceof Error ? error : new Error(String(error)));
			await this.killSession(sessionId, { expectedSession: session }).catch(() => void 0);
			throw error;
		}
		if (this.sessions.get(sessionId) !== session || session.terminating || session.exited) {
			try {
				dataServer.close();
			} catch {}
			if (!require_process_reap_utils.isNamedPipe()) this.unlinkSafe(dataPath);
			throw new Error(`Session ${sessionId} terminated before its data socket was registered`);
		}
		if (readyWaiter) try {
			const readyReport = await readyWaiter.promise;
			if (this.sessions.get(sessionId) !== session || session.terminating || session.exited) throw new Error(`Session ${sessionId} exited while completing endpoint readiness`);
			session.port = readyReport.port;
			session.acpEndpoint = `http://127.0.0.1:${readyReport.port}/api/v1/acp`;
			session.ready = true;
			acpEndpoint = session.acpEndpoint;
		} catch (error) {
			await this.killSession(sessionId, { expectedSession: session }).catch(() => void 0);
			throw error;
		}
		else session.ready = true;
		if (session.exited) {
			await this.killSession(sessionId, { expectedSession: session }).catch(() => void 0);
			throw new Error(`Session ${sessionId} exited before session creation completed`);
		}
		log(`Session ${sessionId} created (pid=${ptyProcess.pid}, port=${session.port}, acpEndpoint=${acpEndpoint})`);
		return {
			sessionId,
			socketPath: dataPath,
			acpEndpoint,
			pid: ptyProcess.pid
		};
	}
	async pushCredentialProtectionBootstrap(options) {
		const deadline = Date.now() + CREDENTIAL_BOOTSTRAP_TIMEOUT_MS;
		while (options.isSessionActive() && Date.now() < deadline) try {
			await this.pushCredentialProtectionBootstrapOnce(options, deadline - Date.now());
			return;
		} catch (error) {
			if (error.code !== "ENOENT" && error.code !== "ECONNREFUSED") throw error;
			await this.delay(CREDENTIAL_BOOTSTRAP_RETRY_MS);
		}
		throw new Error("CBC credential bootstrap transport timed out");
	}
	pushCredentialProtectionBootstrapOnce(options, timeoutMs) {
		return new Promise((resolve, reject) => {
			const socket = net.createConnection(options.socketPath);
			let settled = false;
			let response = "";
			let responseBytes = 0;
			const finish = (error) => {
				if (settled) return;
				settled = true;
				socket.destroy();
				if (error) reject(error);
				else resolve();
			};
			socket.setTimeout(Math.max(1, timeoutMs), () => {
				const error = /* @__PURE__ */ new Error("CBC credential bootstrap acknowledgement timed out");
				error.code = "ETIMEDOUT";
				finish(error);
			});
			socket.once("connect", () => {
				socket.write(`${JSON.stringify({
					version: 1,
					sessionId: options.sessionId,
					token: options.token,
					pid: options.pid,
					bootstrap: options.bootstrap
				})}\n`);
			});
			socket.on("data", (chunk) => {
				responseBytes += chunk.length;
				response += chunk.toString("utf8");
				if (responseBytes > CREDENTIAL_BOOTSTRAP_ACK_MAX_BYTES) {
					finish(/* @__PURE__ */ new Error("CBC credential bootstrap acknowledgement exceeded size limit"));
					return;
				}
				const newline = response.indexOf("\n");
				if (newline === -1) return;
				try {
					const ack = JSON.parse(response.slice(0, newline));
					if (ack.ok !== true || ack.mode !== this.credentialProtectionState.getMode()) throw new Error("CBC credential bootstrap acknowledgement was rejected");
					finish();
				} catch (error) {
					finish(error instanceof Error ? error : new Error(String(error)));
				}
			});
			socket.once("error", finish);
			socket.once("close", () => {
				if (!settled) finish(/* @__PURE__ */ new Error("CBC credential bootstrap channel closed early"));
			});
		});
	}
	handleDataClient(session, client) {
		if (session.dataClient) {
			log(`Session ${session.id}: replacing data client`);
			try {
				session.dataClient.destroy();
			} catch {}
		}
		session.dataClient = client;
		const snapshot = session.ringBuffer.snapshot();
		if (snapshot.length > 0) client.write(snapshot);
		if (session.reconnectQueue) {
			for (const chunk of session.reconnectQueue) client.write(chunk);
			session.reconnectQueue = null;
		}
		client.on("data", (chunk) => {
			if (!session.terminating) try {
				session.ptyProcess.write(chunk);
			} catch (err) {
				logError(`Session ${session.id}: error writing to PTY:`, err);
			}
		});
		client.on("close", () => {
			if (session.dataClient === client) session.dataClient = null;
		});
		client.on("error", (err) => {
			logError(`Session ${session.id}: data client error:`, err.message);
			if (session.dataClient === client) session.dataClient = null;
			client.destroy();
		});
	}
	reconnectSession(sessionId, cols, rows) {
		const session = this.getSession(sessionId);
		log(`Reconnecting session ${sessionId}`);
		session.reconnectQueue = [];
		if (cols != null && rows != null) {
			session.ptyProcess.resize(cols, rows);
			session.cols = cols;
			session.rows = rows;
		}
		return {
			sessionId,
			socketPath: require_process_reap_utils.dataSocketPath(sessionId),
			acpEndpoint: session.acpEndpoint
		};
	}
	resizeSession(sessionId, cols, rows) {
		const session = this.getSession(sessionId);
		session.ptyProcess.resize(cols, rows);
		session.cols = cols;
		session.rows = rows;
	}
	async killSession(sessionId, options = {}) {
		const session = this.sessions.get(sessionId);
		if (!session || options.expectedSession && session !== options.expectedSession) return;
		if (session.terminating) return;
		session.terminating = true;
		const waitForExitFallback = options.waitForExitFallback ?? true;
		const ptyPid = session.ptyProcess.pid;
		log(`Killing session ${sessionId} (pid=${ptyPid})`);
		const exited = new Promise((resolve) => {
			const exitSubscriptionRef = {};
			const timeout = setTimeout(() => {
				exitSubscriptionRef.current?.dispose();
				resolve(false);
			}, 2e3);
			const onExit = session.ptyProcess.onExit(() => {
				clearTimeout(timeout);
				onExit.dispose();
				resolve(true);
			});
			exitSubscriptionRef.current = onExit;
		});
		try {
			if (process.platform !== "win32") process.kill(-ptyPid, "SIGTERM");
			else session.ptyProcess.kill("SIGTERM");
		} catch {
			try {
				session.ptyProcess.kill("SIGTERM");
			} catch {}
		}
		const forceKillIfNeeded = (killed) => {
			if (!killed) {
				log(`Session ${sessionId}: graceful kill timed out, force-killing process group (pid=${ptyPid})`);
				try {
					if (process.platform !== "win32") process.kill(-ptyPid, "SIGKILL");
					else session.ptyProcess.kill("SIGKILL");
				} catch {
					try {
						process.kill(ptyPid, "SIGKILL");
					} catch {}
				}
			}
		};
		if (waitForExitFallback) {
			forceKillIfNeeded(await exited);
			this.cleanupSession(sessionId, session);
			return;
		}
		this.cleanupSession(sessionId, session);
		exited.then(forceKillIfNeeded).catch((err) => logError(`Session ${sessionId}: background kill failed:`, err));
	}
	listSessions() {
		const result = [];
		for (const session of this.sessions.values()) {
			if (!session.ready) continue;
			result.push({
				sessionId: session.id,
				socketPath: require_process_reap_utils.dataSocketPath(session.id),
				acpEndpoint: session.acpEndpoint,
				pid: session.ptyProcess.pid,
				cols: session.cols,
				rows: session.rows
			});
		}
		return result;
	}
	captureSession(sessionId, lines) {
		const text = this.getSession(sessionId).ringBuffer.snapshot().toString("utf-8");
		if (lines == null || lines <= 0) return text;
		return text.split("\n").slice(-lines).join("\n");
	}
	ping() {
		return {
			pid: process.pid,
			uptime: Date.now() - this.startTime,
			version: 4,
			token: this.token
		};
	}
	cleanupSession(sessionId, expectedSession) {
		const session = this.sessions.get(sessionId);
		if (!session || expectedSession && session !== expectedSession) return;
		this.sessionReadyRegistry.reject(sessionId, /* @__PURE__ */ new Error(`Session ${sessionId} was cleaned up before reporting its runtime endpoint`));
		this.sessions.delete(sessionId);
		if (session.dataClient) {
			try {
				session.dataClient.destroy();
			} catch {}
			session.dataClient = null;
		}
		try {
			session.dataSocketServer.close();
		} catch {}
		if (!require_process_reap_utils.isNamedPipe()) this.unlinkSafe(require_process_reap_utils.dataSocketPath(sessionId));
		log(`Session ${sessionId} cleaned up (${this.sessions.size} remaining)`);
		this.resetIdleTimer();
	}
	getSession(sessionId) {
		const session = this.sessions.get(sessionId);
		if (!session) {
			const err = /* @__PURE__ */ new Error(`Session not found: ${sessionId}`);
			err.code = require_process_reap_utils.JSON_RPC_SESSION_NOT_FOUND;
			throw err;
		}
		return session;
	}
	resetIdleTimer() {
		if (this.idleTimer) {
			clearTimeout(this.idleTimer);
			this.idleTimer = null;
		}
		if (this.sessions.size === 0 && this.controlClients.size === 0 && !this.shuttingDown) {
			this.idleTimer = setTimeout(() => {
				log("Idle timeout reached — shutting down");
				this.shutdown().then(() => process.exit(0));
			}, require_process_reap_utils.IDLE_TIMEOUT_MS);
			this.idleTimer.unref();
		}
	}
	broadcastNotification(method, params) {
		const payload = JSON.stringify({
			jsonrpc: "2.0",
			method,
			params
		}) + "\n";
		for (const client of this.controlClients) try {
			client.write(payload);
		} catch {}
	}
	sendResponse(client, resp) {
		try {
			client.write(JSON.stringify(resp) + "\n");
		} catch (err) {
			logError("Failed to send response:", err);
		}
	}
	unlinkSafe(filepath) {
		try {
			fs.unlinkSync(filepath);
		} catch {}
	}
	async cleanupStaleSocket(sockPath) {
		try {
			fs.unlinkSync(sockPath);
			return;
		} catch (err) {
			if (err?.code === "ENOENT") return;
			if (err?.code !== "EACCES" && err?.code !== "EPERM") return;
		}
		log("Socket file is locked, attempting to shut down previous sidecar...");
		try {
			await this.requestRemoteShutdown(sockPath);
		} catch {
			log("Could not reach previous sidecar for graceful shutdown");
		}
		await this.delay(500);
		try {
			fs.unlinkSync(sockPath);
			log("Stale socket file removed after shutdown");
		} catch (retryErr) {
			logError(`Failed to remove stale socket file (${retryErr?.code}): ${sockPath}. A previous sidecar process may still be running. Try terminating it manually or deleting the file.`);
		}
	}
	requestRemoteShutdown(sockPath) {
		return new Promise((resolve, reject) => {
			const client = net.createConnection(sockPath, () => {
				const req = JSON.stringify({
					jsonrpc: "2.0",
					id: 1,
					method: "sidecar.shutdown"
				}) + "\n";
				client.write(req);
				const timeout = setTimeout(() => {
					client.destroy();
					resolve();
				}, 2e3);
				client.on("data", () => {
					clearTimeout(timeout);
					client.destroy();
					resolve();
				});
			});
			client.on("error", (err) => {
				client.destroy();
				reject(err);
			});
		});
	}
	delay(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
	async writePidFile() {
		const data = JSON.stringify({
			pid: process.pid,
			token: this.token,
			version: 4,
			controlPipeUuid: this.controlPipeUuid
		});
		const filePath = require_process_reap_utils.pidFilePath();
		await fs.promises.writeFile(filePath, data, "utf-8");
		log(`PID file written: ${filePath}`);
	}
};
//#endregion
//#region src/main/integrations/sidecar/entry.ts
/**
* Sidecar entry point — electron-vite build input for sidecar-entry.js.
* Desktop keeps this entry as the electron-vite build input; the sidecar
* runtime implementation lives in the server package.
*/
/**
* sidecar 的诊断出口全部是 stderr（父进程 daemon 通过 watchSpawnedStderrTail 收集）。
* daemon 退出后该管道关闭，任何写入都会抛 EPIPE。
*
* 现场（5.4.1 win32）：daemon 15:22:29 崩溃后，sidecar 的每一条 console.error
* （含 60s 内存水位定时器）都变成 uncaught EPIPE，38 条崩溃记录持续 15 分钟，
* 进程始终不退出。**日志绝不能成为杀死进程的原因**，也不该在对端已死后继续刷。
*
* 这里做三件事：
*  1. 给 stdout/stderr 挂 error handler，写失败不再冒泡成 uncaughtException；
*  2. 统计连续写失败次数，达到阈值判定"父进程已不可达"→ 自行退出，消灭孤儿；
*  3. 暴露 safeConsoleError 供本文件所有诊断输出使用。
*/
var SIDECAR_PIPE_FAILURE_EXIT_THRESHOLD = 3;
var sidecarPipeFailureCount = 0;
function installSidecarStdioGuard() {
	const onStreamError = (error) => {
		if (isBrokenPipeError(error)) noteSidecarPipeFailure();
	};
	process.stderr.on("error", onStreamError);
	process.stdout.on("error", onStreamError);
}
/** 只认 Node stable error code，避免 message 文本随版本/语言漂移。 */
function isBrokenPipeError(error) {
	return require_transport_error.isRecoverableTransportError(error);
}
/**
* 记一次管道写失败；连续多次即认定父进程已消失并主动退出。
*
* 用 exit code 0：这是"父进程先走、sidecar 跟随收尾"的预期路径，
* 不是崩溃，避免污染 crash 统计与触发无意义的重启退避。
*/
function noteSidecarPipeFailure() {
	sidecarPipeFailureCount += 1;
	if (sidecarPipeFailureCount >= SIDECAR_PIPE_FAILURE_EXIT_THRESHOLD) process.exit(0);
}
/**
* 写诊断日志的唯一安全出口：写失败只累计计数，绝不抛出。
* 导出供单测覆盖。
*/
function safeConsoleError(...args) {
	try {
		console.error(...args);
		sidecarPipeFailureCount = 0;
	} catch (error) {
		if (isBrokenPipeError(error)) noteSidecarPipeFailure();
	}
}
function installSidecarCrashWriter() {
	try {
		const configDir = process.env.WORKBUDDY_CONFIG_DIR;
		if (!configDir) return;
		installSidecarMemoryDiagnostics(configDir);
		const handle = require_crash_reporter.installCrashWriter({
			logsDir: node_path.join(configDir, "logs"),
			processName: "sidecar",
			appVersion: process.env.WORKBUDDY_APP_VERSION ?? ""
		});
		bindSessionCrashReporter(({ exitCode, signal, name }) => {
			handle.write({
				type: "child_process_crash",
				childProcess: {
					processType: "spawned",
					reason: signal !== void 0 ? `signal:${signal}` : `exit:${exitCode}`,
					exitCode,
					name
				}
			});
		});
	} catch {}
}
/**
* sidecar 内存诊断（OOM 排查 patch，与 daemon 侧对齐）。
* - fatal error（含 V8 OOM）时自动写 report 到 logs/Diagnostics/
* - 每 1 分钟打水位到 stderr：daemon 侧 watchSpawnedStderrTail 收集，
*   崩溃时随 sidecar-stderr-tail crash entry 上报
* 根因修复后可移除。
*/
function installSidecarMemoryDiagnostics(configDir) {
	try {
		if (!process.report) return;
		const diagDir = node_path.join(configDir, "logs", "Diagnostics");
		node_fs.mkdirSync(diagDir, { recursive: true });
		require_transport_error.pruneDiagnosticArtifacts(diagDir, require_transport_error.DEFAULT_DIAGNOSTIC_RETENTION_POLICY).catch(() => {});
		process.report.directory = diagDir;
		process.report.reportOnFatalError = true;
		const highHeapReportMinIntervalMs = 1800 * 1e3;
		let highWatermarkReported = false;
		let lastHighHeapReportAt = 0;
		const toMb = (bytes) => Math.round(bytes / 1048576);
		const sampleCpuPercent = require_process_cpu_sampler.createProcessCpuPercentSampler();
		const reportMemory = () => {
			const mu = process.memoryUsage();
			safeConsoleError([
				`[SidecarMemWatch] pid=${process.pid}`,
				`heapUsed=${toMb(mu.heapUsed)}MB`,
				`heapTotal=${toMb(mu.heapTotal)}MB`,
				`rss=${toMb(mu.rss)}MB`,
				`external=${toMb(mu.external)}MB`,
				`cpuPercent=${sampleCpuPercent().toFixed(1)}`
			].join(" "));
			if (mu.heapUsed >= 15e8) {
				if (!highWatermarkReported && Date.now() - lastHighHeapReportAt >= highHeapReportMinIntervalMs) {
					highWatermarkReported = true;
					lastHighHeapReportAt = Date.now();
					process.report.writeReport("sidecar-high-heap");
					require_transport_error.pruneDiagnosticArtifacts(diagDir, require_transport_error.DEFAULT_DIAGNOSTIC_RETENTION_POLICY).catch(() => {});
				}
			} else highWatermarkReported = false;
		};
		setTimeout(reportMemory, 3e4).unref?.();
		setInterval(reportMemory, 6e4).unref?.();
	} catch {}
}
function parseCliArg(name) {
	const idx = process.argv.indexOf(name);
	if (idx === -1 || idx + 1 >= process.argv.length) {
		safeConsoleError(`[Sidecar] Missing required ${name} argument`);
		process.exit(1);
	}
	return process.argv[idx + 1];
}
async function main() {
	installSidecarStdioGuard();
	const credentialProtectionMode = require_credential_protection_bootstrap.readWorkbuddyCredentialProtectionMode(process.env);
	delete process.env[require_credential_protection_bootstrap.WORKBUDDY_CREDENTIAL_PROTECTION_ENV];
	installSidecarCrashWriter();
	const server = new SidecarServer(parseCliArg("--token"), parseCliArg("--control-pipe-uuid"), credentialProtectionMode);
	const onSignal = () => {
		server.shutdown().then(() => process.exit(0));
	};
	process.on("SIGTERM", onSignal);
	process.on("SIGINT", onSignal);
	await server.start();
}
main().catch((err) => {
	safeConsoleError("[Sidecar] Fatal error:", err);
	process.exit(isBrokenPipeError(err) ? 0 : 1);
});
//#endregion
exports.safeConsoleError = safeConsoleError;
