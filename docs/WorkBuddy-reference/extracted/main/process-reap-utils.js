const require_chunk = require("./chunk.js");
let fs = require("fs");
fs = require_chunk.__toESM(fs);
let os = require("os");
os = require_chunk.__toESM(os);
let path = require("path");
path = require_chunk.__toESM(path);
let node_child_process = require("node:child_process");
let node_util = require("node:util");
let child_process = require("child_process");
let crypto = require("crypto");
let tls = require("tls");
tls = require_chunk.__toESM(tls);
var DEFAULT_RING_BUFFER_BYTES = 8 * 1024 * 1024;
var IDLE_TIMEOUT_MS = 1800 * 1e3;
var RPC_TIMEOUT_MS = 1e4;
var SESSION_LIFECYCLE_RPC_TIMEOUT_MS = 6e4;
/**
* Preserve the historical per-session cold-start budget. Before auto-port
* readiness, `session.create` returned after spawn and the backend waited up
* to 180s for the ACP endpoint. Now that `session.create` waits for the child
* ready ACK, the same budget must live in the sidecar.
*/
var SESSION_ENDPOINT_READY_TIMEOUT_MS = 18e4;
/**
* `session.create` must outlive endpoint readiness long enough for the
* sidecar to serialize the result (or clean up a timed-out child) and deliver
* the JSON-RPC response. Other lifecycle calls retain their 60s budget.
*/
var SESSION_CREATE_RPC_TIMEOUT_MS = SESSION_ENDPOINT_READY_TIMEOUT_MS + 15e3;
var SIDECAR_READY_SOCKET_ENV = "CODEBUDDY_SIDECAR_READY_SOCKET";
var SIDECAR_READY_TOKEN_ENV = "CODEBUDDY_SIDECAR_READY_TOKEN";
var SIDECAR_READY_SESSION_ID_ENV = "CODEBUDDY_SIDECAR_READY_SESSION_ID";
var SIDECAR_CREDENTIAL_BOOTSTRAP_SOCKET_ENV = "CODEBUDDY_SIDECAR_CREDENTIAL_BOOTSTRAP_SOCKET";
/**
* sidecar 优雅退出的等待上限（shutdown ack 后等控制 socket 关闭）。正常收尾
* （杀掉全部会话，每个 2s SIGTERM 宽限）在几秒内完成；超时后调用方按"进程可能
* 仍在收尾"处理，不能拖住 daemon 启动清理 / 应用退出。
*/
var SIDECAR_GRACEFUL_EXIT_TIMEOUT_MS = 1e4;
var WINDOWS_PIPE_PREFIX = "\\\\.\\pipe\\";
var CONTROL_PIPE_KEY = "sidecar-control";
var DATA_PIPE_KEY = "sidecar-data";
/**
* macOS `struct sockaddr_un.sun_path` is 104 bytes (incl. terminating NUL).
* Linux allows 108; using 104 as the conservative upper bound covers both.
*
* A small safety margin is kept because some kernels include the NUL in the
* accounted length and others don't, and tooling (e.g. strace) may add prefix
* bytes in some edge cases.
*/
var SUN_PATH_MAX_BYTES = 104;
var SUN_PATH_SAFETY_MARGIN = 3;
/**
* Path to the user's workbuddy config dir (~/.workbuddy or an override). Used
* both as the stable hash input for the install-scoped instance token and by
* one-shot cleanup of pre-migration sidecar files. Nothing is written here.
*/
function workbuddyConfigDir() {
	return process.env.WORKBUDDY_CONFIG_DIR?.trim() || process.env.CODEBUDDY_CONFIG_DIR?.trim() || path.join(os.homedir(), ".workbuddy");
}
function instanceToken() {
	return hashToken(workbuddyConfigDir(), 12);
}
function isWritableDir(dir) {
	try {
		if (!fs.statSync(dir).isDirectory()) return false;
		fs.accessSync(dir, fs.constants.W_OK);
		return true;
	} catch {
		return false;
	}
}
/**
* Runtime directory for sockets and the sidecar PID file.
*
* Linux prefers `$XDG_RUNTIME_DIR` → `/run/user/<uid>`; elsewhere (macOS,
* Linux without XDG, Windows) falls back to `os.tmpdir()`. Kept short so
* per-session sockets stay within macOS's 104-byte sun_path limit.
*
* Not memoized: tests mutate the config-dir env between cases, and call
* frequency is low (a handful of lookups per sidecar lifecycle).
*/
function sidecarRuntimeDir() {
	const token = instanceToken();
	const uid = typeof process.getuid === "function" ? process.getuid() : void 0;
	if (process.platform === "linux") {
		const xdg = process.env.XDG_RUNTIME_DIR?.trim();
		if (xdg && isWritableDir(xdg)) return path.join(xdg, "workbuddy", token);
		if (uid !== void 0) {
			const runUser = `/run/user/${uid}`;
			if (isWritableDir(runUser)) return path.join(runUser, "workbuddy", token);
		}
	}
	const base = uid !== void 0 ? `wb-${hashToken(String(uid), 6)}` : "wb";
	return path.join(os.tmpdir().trim(), base, token);
}
/** Create the runtime directory (0700) if missing. Idempotent. */
async function ensureSidecarRuntimeDir() {
	const dir = sidecarRuntimeDir();
	await fs.promises.mkdir(dir, {
		recursive: true,
		mode: 448
	});
	try {
		await fs.promises.chmod(dir, 448);
	} catch {}
	return dir;
}
/**
* 计算 control socket / named pipe 的完整路径。
*
* @param controlPipeUuid 每次 sidecar 启动时生成的随机 id（见
*   `SIDECAR_CONTROL_PIPE_UUID_LENGTH`）。传入时返回带 uuid 后缀的
*   隔离路径，例如 Windows 的 `\\.\pipe\workbuddy-<inst>-sidecar-control-<uuid>`
*   或 POSIX 的 `<runtimeDir>/sidecar-<uuid>.sock`。不传时回退到固定名
*   `sidecar-control` / `sidecar.sock`——**仅供 legacy 清理路径使用**
*   （见 sidecar-manager.cleanupLegacySidecarArtifacts），新版 sidecar 与
*   主进程都必须传 uuid。
*/
function controlSocketPath(controlPipeUuid) {
	const suffix = controlPipeUuid ? `-${controlPipeUuid}` : "";
	if (isNamedPipe()) return buildNamedPipePath(`${CONTROL_PIPE_KEY}${suffix}`);
	return path.join(sidecarRuntimeDir(), `sidecar${suffix}.sock`);
}
/**
* 生成一个 sidecar 控制通道的随机 uuid。长度 = `SIDECAR_CONTROL_PIPE_UUID_LENGTH`
* 个十六进制字符。使用 crypto 随机源，避免可预测。
*/
function generateControlPipeUuid() {
	return (0, crypto.randomBytes)(Math.ceil(8 / 2)).toString("hex").slice(0, 8);
}
/**
* 从 POSIX 控制 socket 文件名（`sidecar-<uuid>.sock`）中反解 uuid。
* 匹配失败返回 null（例如碰到固定名 `sidecar.sock` legacy 遗留，或不相关文件）。
*
* Windows 上 control pipe 不是磁盘文件，扫地逻辑不会用到，因此本函数仅在
* POSIX 扫地路径消费。
*/
function matchControlSocketFile(filename) {
	const match = filename.match(/^sidecar-([a-f0-9]+)\.sock$/);
	if (!match) return null;
	return { uuid: match[1] };
}
function dataSocketPath(id) {
	if (isNamedPipe()) return buildNamedPipePath(`${DATA_PIPE_KEY}-${sanitizePipeToken(id)}-${hashToken(id, 8)}`);
	const primary = path.join(sidecarRuntimeDir(), `s-${hashToken(id, 16)}.sock`);
	if (Buffer.byteLength(primary) + SUN_PATH_SAFETY_MARGIN <= SUN_PATH_MAX_BYTES) return primary;
	const uid = typeof process.getuid === "function" ? process.getuid() : void 0;
	const base = uid !== void 0 ? `wb-${hashToken(String(uid), 6)}` : "wb";
	const shortDir = path.join("/tmp", base, instanceToken());
	try {
		fs.mkdirSync(shortDir, {
			recursive: true,
			mode: 448
		});
		try {
			fs.chmodSync(shortDir, 448);
		} catch {}
	} catch {}
	return path.join(shortDir, `s-${hashToken(id, 16)}.sock`);
}
function pidFilePath() {
	return path.join(sidecarRuntimeDir(), "sidecar.pid");
}
/**
* 每个会话子进程一份 `<pid>.json` 的落盘账本目录。sidecar 被 SIGKILL/崩溃时
* 子进程会脱管（内存 session Map 随 sidecar 消失），下一次 sidecar 启动靠
* 这里的账本对账补杀（见 session-journal.ts）。目录随 sidecarRuntimeDir()
* 跨重启确定性可推导。
*/
function sessionJournalDir() {
	return path.join(sidecarRuntimeDir(), "sessions");
}
function isNamedPipe() {
	return process.platform === "win32";
}
function buildNamedPipePath(name) {
	return `${WINDOWS_PIPE_PREFIX}workbuddy-${instanceToken()}-${name}`;
}
function sanitizePipeToken(value) {
	return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "session";
}
function hashToken(value, length) {
	return (0, crypto.createHash)("sha1").update(value).digest("hex").slice(0, length);
}
var JSON_RPC_PARSE_ERROR = -32700;
var JSON_RPC_METHOD_NOT_FOUND = -32601;
var JSON_RPC_INVALID_PARAMS = -32602;
var JSON_RPC_INTERNAL_ERROR = -32603;
var JSON_RPC_SESSION_NOT_FOUND = -32e3;
//#endregion
//#region ../../packages/workbuddy-server/src/common/cli-process-env.ts
/**
* Static managed overlay for every WorkBuddy-spawned CLI process, applied by
* both the cold sidecar-session path and the prewarm pool. The prewarm acquire
* gate compares the two paths' managed envs for exact equality, so these keys
* must come from this single definition rather than per-site literals.
*/
var CLI_STATIC_MANAGED_ENV = {
	ELECTRON_RUN_AS_NODE: "1",
	CODEBUDDY_DISABLE_IDE: "1",
	SERVER__PORT: "0",
	SERVER__HOST: "127.0.0.1"
};
/**
* Environment variable prefixes that must not leak from a host process into
* an agent-cli process. Managed values may still be supplied explicitly via
* `managedEnv`.
*/
var ENV_BLOCKED_PREFIXES = [
	"CODEBUDDY_",
	"ELECTRON_",
	"VITE_",
	"ACC_PRODUCT_CONFIG_"
];
/**
* Exact environment variable names that can change Node/Electron bootstrap or
* networking semantics and therefore must come from the managed environment.
*/
var ENV_BLOCKED_KEYS = new Set([
	"NODE_OPTIONS",
	"NODE_CHANNEL_FD",
	"NODE_CHANNEL_SERIALIZATION_MODE",
	"NODE_PATH",
	"NODE_DEBUG",
	"NODE_DEBUG_NATIVE",
	"NODE_REPL_HISTORY",
	"NODE_PENDING_DEPRECATION",
	"NODE_REDIRECT_WARNINGS",
	"NODE_EXTRA_CA_CERTS",
	"NODE_TLS_REJECT_UNAUTHORIZED",
	"SSL_CERT_FILE",
	"SSL_CERT_DIR",
	"OPENSSL_CONF",
	"HTTP_PROXY",
	"HTTPS_PROXY",
	"ALL_PROXY",
	"NO_PROXY",
	"http_proxy",
	"https_proxy",
	"all_proxy",
	"no_proxy",
	"WORKBUDDY_PROXY_SOURCE",
	"WORKBUDDY_PAC_RPC_SOCKET",
	"WORKBUDDY_PAC_RPC_TOKEN",
	"SERVER__PORT",
	"SERVER__HOST",
	"UV_THREADPOOL_SIZE"
]);
/**
* Build the environment for an agent-cli process.
*
* Ordinary user/system variables (notably PATH and HOME) pass through, while
* WorkBuddy-managed and runtime-sensitive variables are removed.
* `managedEnv` is overlaid last as the authoritative source for both cold and
* prewarmed CLI processes.
*/
function buildCliProcessEnv(managedEnv, hostEnv = process.env) {
	const passedEnv = {};
	for (const [key, value] of Object.entries(hostEnv)) {
		if (value === void 0) continue;
		const canonicalKey = key.toUpperCase();
		if (ENV_BLOCKED_KEYS.has(canonicalKey)) continue;
		if (ENV_BLOCKED_PREFIXES.some((prefix) => canonicalKey.startsWith(prefix))) continue;
		passedEnv[key] = value;
	}
	const result = {
		...passedEnv,
		...managedEnv
	};
	if (!result.NODE_EXTRA_CA_CERTS && process.platform === "darwin") try {
		const configDir = process.env.WORKBUDDY_CONFIG_DIR || process.env.CODEBUDDY_CONFIG_DIR || path.default.join(os.default.homedir(), ".workbuddy");
		const caBundlePath = path.default.join(configDir, "system-ca-bundle.pem");
		if (!fs.default.existsSync(caBundlePath)) {
			if (!!(result.HTTPS_PROXY || result.HTTP_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY)) {
				const CERT_REGEX = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;
				const keychains = [path.default.join(os.default.homedir(), "Library", "Keychains", "login.keychain-db"), "/Library/Keychains/System.keychain"];
				const certs = [];
				for (const kc of keychains) try {
					const m = (0, child_process.execFileSync)("security", [
						"find-certificate",
						"-a",
						"-p",
						kc
					], {
						encoding: "utf-8",
						timeout: 5e3
					}).match(CERT_REGEX);
					if (m) certs.push(...m);
				} catch {}
				const builtinSet = new Set(tls.default.rootCertificates);
				const extra = [...new Set(certs)].filter((c) => !builtinSet.has(c));
				if (extra.length > 0) {
					fs.default.mkdirSync(path.default.dirname(caBundlePath), { recursive: true });
					fs.default.writeFileSync(caBundlePath, extra.join("\n"), "utf-8");
				}
			}
		}
		if (fs.default.existsSync(caBundlePath)) result.NODE_EXTRA_CA_CERTS = caBundlePath;
	} catch {}
	return result;
}
//#endregion
//#region ../../packages/workbuddy-server/src/shared/process-reap-utils.ts
/**
* 孤儿进程对账用的跨平台工具：存活探测、命令行读取（身份校验）、进程树终止。
*
* 设计约束（都来自本仓已知的坑）：
* - `process.kill(pid <= 0, sig)` 在 Unix 下会向进程组/当前用户所有进程广播，
*   属高危路径——所有入口对非法/非正 pid 一律防御性拒绝（对齐
*   agent-cli `evictExistingPrewarm` 与 `DaemonProcessManagerImpl` 的守卫）。
* - PID 复用竞态：探活成功 ≠ 还是原进程。杀之前必须用 `readProcessCommandLine`
*   校验命令行里带有我们登记的锚点（sessionId / prewarmId），失配只清账不动手。
*/
var execFileAsync = (0, node_util.promisify)(node_child_process.execFile);
function isValidTargetPid(pid) {
	return typeof pid === "number" && Number.isInteger(pid) && pid > 1 && pid !== process.pid;
}
/** kill(pid, 0) 探活；EPERM 视为存活。非法 pid 视为不存活。 */
function isPidAlive(pid) {
	if (!isValidTargetPid(pid)) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return error.code === "EPERM";
	}
}
/**
* 读取进程完整命令行，用于杀前身份校验。异步——调用方跑在活着的事件循环上
* （sidecar 正在服务 control socket / daemon 主进程），Windows 下 PowerShell
* 一次可达数百毫秒，不能用 spawnSync 卡住事件循环。
* 返回 null 表示查询失败（未知，调用方应保守跳过）；返回 ''
* 通常表示进程已退出/不可见。
*
* - POSIX：`ps -p <pid> -o args=`（仓库先例：sandbox-proxy debug、netstat-service）
* - Windows：PowerShell CIM Win32_Process.CommandLine（wmic 在新版已废弃）
*/
async function readProcessCommandLine(pid) {
	if (!isValidTargetPid(pid)) return "";
	try {
		if (process.platform === "win32") {
			const { stdout } = await execFileAsync("powershell.exe", [
				"-NoProfile",
				"-NonInteractive",
				"-Command",
				`(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`
			], {
				encoding: "utf-8",
				timeout: 1e4,
				windowsHide: true
			});
			return (stdout ?? "").trim();
		}
		const { stdout } = await execFileAsync("ps", [
			"-p",
			String(pid),
			"-o",
			"args="
		], {
			encoding: "utf-8",
			timeout: 1e4
		});
		return (stdout ?? "").trim();
	} catch (error) {
		const code = error.code;
		if (process.platform !== "win32" && typeof code === "number") return "";
		return null;
	}
}
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
async function waitForDeath(pid, timeoutMs) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (!isPidAlive(pid)) return true;
		await sleep(100);
	}
	return !isPidAlive(pid);
}
/**
* 终止进程（尽力连同其进程组/子树）：SIGTERM → 宽限 → SIGKILL。
* 返回最终是否确认死亡。
*
* - POSIX：优先 `kill(-pid)` 杀进程组（sidecar 子进程经 forkpty/setsid 是组长，
*   与 sidecar killSession 的既有语义一致），失败回退单 pid。
* - Windows：`taskkill /pid <pid> /f /t` 杀进程树。
*/
async function killProcessTree(pid, options) {
	if (!isValidTargetPid(pid)) return true;
	const gracefulMs = options?.gracefulMs ?? 2e3;
	const forceMs = options?.forceMs ?? 2e3;
	if (process.platform === "win32") {
		try {
			await execFileAsync("taskkill", [
				"/pid",
				String(pid),
				"/f",
				"/t"
			], {
				encoding: "utf-8",
				timeout: 1e4,
				windowsHide: true
			});
		} catch {}
		return waitForDeath(pid, forceMs);
	}
	const signalBoth = (signal) => {
		try {
			process.kill(-pid, signal);
		} catch {
			try {
				process.kill(pid, signal);
			} catch {}
		}
	};
	signalBoth("SIGTERM");
	if (await waitForDeath(pid, gracefulMs)) return true;
	signalBoth("SIGKILL");
	return waitForDeath(pid, forceMs);
}
//#endregion
Object.defineProperty(exports, "CLI_STATIC_MANAGED_ENV", {
	enumerable: true,
	get: function() {
		return CLI_STATIC_MANAGED_ENV;
	}
});
Object.defineProperty(exports, "DEFAULT_RING_BUFFER_BYTES", {
	enumerable: true,
	get: function() {
		return DEFAULT_RING_BUFFER_BYTES;
	}
});
Object.defineProperty(exports, "IDLE_TIMEOUT_MS", {
	enumerable: true,
	get: function() {
		return IDLE_TIMEOUT_MS;
	}
});
Object.defineProperty(exports, "JSON_RPC_INTERNAL_ERROR", {
	enumerable: true,
	get: function() {
		return JSON_RPC_INTERNAL_ERROR;
	}
});
Object.defineProperty(exports, "JSON_RPC_INVALID_PARAMS", {
	enumerable: true,
	get: function() {
		return JSON_RPC_INVALID_PARAMS;
	}
});
Object.defineProperty(exports, "JSON_RPC_METHOD_NOT_FOUND", {
	enumerable: true,
	get: function() {
		return JSON_RPC_METHOD_NOT_FOUND;
	}
});
Object.defineProperty(exports, "JSON_RPC_PARSE_ERROR", {
	enumerable: true,
	get: function() {
		return JSON_RPC_PARSE_ERROR;
	}
});
Object.defineProperty(exports, "JSON_RPC_SESSION_NOT_FOUND", {
	enumerable: true,
	get: function() {
		return JSON_RPC_SESSION_NOT_FOUND;
	}
});
Object.defineProperty(exports, "RPC_TIMEOUT_MS", {
	enumerable: true,
	get: function() {
		return RPC_TIMEOUT_MS;
	}
});
Object.defineProperty(exports, "SESSION_CREATE_RPC_TIMEOUT_MS", {
	enumerable: true,
	get: function() {
		return SESSION_CREATE_RPC_TIMEOUT_MS;
	}
});
Object.defineProperty(exports, "SESSION_ENDPOINT_READY_TIMEOUT_MS", {
	enumerable: true,
	get: function() {
		return SESSION_ENDPOINT_READY_TIMEOUT_MS;
	}
});
Object.defineProperty(exports, "SESSION_LIFECYCLE_RPC_TIMEOUT_MS", {
	enumerable: true,
	get: function() {
		return SESSION_LIFECYCLE_RPC_TIMEOUT_MS;
	}
});
Object.defineProperty(exports, "SIDECAR_CREDENTIAL_BOOTSTRAP_SOCKET_ENV", {
	enumerable: true,
	get: function() {
		return SIDECAR_CREDENTIAL_BOOTSTRAP_SOCKET_ENV;
	}
});
Object.defineProperty(exports, "SIDECAR_GRACEFUL_EXIT_TIMEOUT_MS", {
	enumerable: true,
	get: function() {
		return SIDECAR_GRACEFUL_EXIT_TIMEOUT_MS;
	}
});
Object.defineProperty(exports, "SIDECAR_READY_SESSION_ID_ENV", {
	enumerable: true,
	get: function() {
		return SIDECAR_READY_SESSION_ID_ENV;
	}
});
Object.defineProperty(exports, "SIDECAR_READY_SOCKET_ENV", {
	enumerable: true,
	get: function() {
		return SIDECAR_READY_SOCKET_ENV;
	}
});
Object.defineProperty(exports, "SIDECAR_READY_TOKEN_ENV", {
	enumerable: true,
	get: function() {
		return SIDECAR_READY_TOKEN_ENV;
	}
});
Object.defineProperty(exports, "buildCliProcessEnv", {
	enumerable: true,
	get: function() {
		return buildCliProcessEnv;
	}
});
Object.defineProperty(exports, "controlSocketPath", {
	enumerable: true,
	get: function() {
		return controlSocketPath;
	}
});
Object.defineProperty(exports, "dataSocketPath", {
	enumerable: true,
	get: function() {
		return dataSocketPath;
	}
});
Object.defineProperty(exports, "ensureSidecarRuntimeDir", {
	enumerable: true,
	get: function() {
		return ensureSidecarRuntimeDir;
	}
});
Object.defineProperty(exports, "generateControlPipeUuid", {
	enumerable: true,
	get: function() {
		return generateControlPipeUuid;
	}
});
Object.defineProperty(exports, "isNamedPipe", {
	enumerable: true,
	get: function() {
		return isNamedPipe;
	}
});
Object.defineProperty(exports, "isPidAlive", {
	enumerable: true,
	get: function() {
		return isPidAlive;
	}
});
Object.defineProperty(exports, "isValidTargetPid", {
	enumerable: true,
	get: function() {
		return isValidTargetPid;
	}
});
Object.defineProperty(exports, "killProcessTree", {
	enumerable: true,
	get: function() {
		return killProcessTree;
	}
});
Object.defineProperty(exports, "matchControlSocketFile", {
	enumerable: true,
	get: function() {
		return matchControlSocketFile;
	}
});
Object.defineProperty(exports, "pidFilePath", {
	enumerable: true,
	get: function() {
		return pidFilePath;
	}
});
Object.defineProperty(exports, "readProcessCommandLine", {
	enumerable: true,
	get: function() {
		return readProcessCommandLine;
	}
});
Object.defineProperty(exports, "sessionJournalDir", {
	enumerable: true,
	get: function() {
		return sessionJournalDir;
	}
});
Object.defineProperty(exports, "sidecarRuntimeDir", {
	enumerable: true,
	get: function() {
		return sidecarRuntimeDir;
	}
});
Object.defineProperty(exports, "workbuddyConfigDir", {
	enumerable: true,
	get: function() {
		return workbuddyConfigDir;
	}
});
