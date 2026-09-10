const require_chunk = require("./chunk.js");
const require_common = require("./common.js");
const require_dist = require("./dist.js");
const require_logger = require("./logger.js");
const require_proxy_env = require("./proxy-env.js");
const require_cli_product_env = require("./cli-product-env.js");
const require_runtime_context = require("./runtime-context.js");
const require_client_info_env = require("./client-info-env.js");
const require_gateway_secret = require("./gateway-secret.js");
const require_process_reap_utils = require("./process-reap-utils.js");
let fs = require("fs");
fs = require_chunk.__toESM(fs);
let os = require("os");
let path = require("path");
path = require_chunk.__toESM(path);
let node_child_process = require("node:child_process");
let node_fs = require("node:fs");
node_fs = require_chunk.__toESM(node_fs);
let node_path = require("node:path");
node_path = require_chunk.__toESM(node_path);
let node_os = require("node:os");
let node_crypto = require("node:crypto");
let node_net = require("node:net");
let child_process = require("child_process");
let crypto = require("crypto");
let node_events = require("node:events");
let net = require("net");
net = require_chunk.__toESM(net);
//#region ../../packages/workbuddy-server/src/agent/cli-runtime-env.ts
require_cli_product_env.init_cli_product_env();
require_client_info_env.init_src();
require_common.init_common$3();
var DEFAULT_AGENT_CLI_BUNDLED_RUNTIME_CONFIG = {
	enabled: true,
	tools: {
		node: true,
		python: true,
		gitBash: true,
		brokeredShell: true
	}
};
var CODEBUDDY_API_KEY_HELPER_DISABLED_ENV = "CODEBUDDY_API_KEY_HELPER_DISABLED";
var CONFIG_ONLY_RUNTIME_TYPES = ["brokeredShell"];
function buildAgentCliRuntimeEnv(options) {
	const env = {
		DISABLE_AUTOUPDATER: "1",
		ELECTRON_RUN_AS_NODE: "1",
		CODEBUDDY_GIT_REPO_SCAN_DISABLED: "1",
		CODEBUDDY_PROMPT_SUGGESTION_DISABLED: "1",
		CODEBUDDY_CONFIG_DIR: options.configDir,
		WORKBUDDY_CONFIG_DIR: options.configDir,
		WORKBUDDY_DATA_FOLDER_NAME: options.dataFolderName?.trim() || options.processEnv?.WORKBUDDY_DATA_FOLDER_NAME?.trim() || ".workbuddy",
		...require_gateway_secret.gatewaySecretEnv(),
		CODEBUDDY_DISABLE_CRON: "1",
		CODEBUDDY_FORCE_HEADLESS_BUNDLE: "1",
		CODEBUDDY_INCLUDE_TOPIC_MESSAGE: "1",
		CODEBUDDY_CODE_DISABLE_SESSION_SUMMARY: "1",
		CODEBUDDY_BUILTIN_SKILLS_DIR: options.builtinSkillsDir,
		CODEBUDDY_DISABLE_AUTO_MEMORY: "1",
		CODEBUDDY_DISABLE_SYSTEM_REMINDER_MD: "1",
		CODEBUDDY_DISABLE_REQUEST_VALIDATION: "1",
		CODEBUDDY_SKIP_GIT_BASH_CHECK: "1",
		CODEBUDDY_HOST: "workbuddy-desktop",
		CODEBUDDY_HIGH_CREDIT_APPROVAL_ENABLED: "1",
		CODEBUDDY_DISABLE_EXTENDED_PLUGIN_HOOKS: "1",
		CODEBUDDY_DISABLE_SESSION_HISTORY_CLEANUP: "1",
		CODEBUDDY_POWERSHELL_USE_PTY: "1",
		CODEBUDDY_REPLAY_SHOW_PRE_COMPACT: "1",
		CODEBUDDY_REASONING_ONLY_END_TURN: "1",
		CODEBUDDY_CODE_IMAGE_COMPRESSION_MAX_DIMENSION: "1080",
		CODEBUDDY_SKILL_TOOL_CHAR_BUDGET: "30000",
		CODEBUDDY_DISABLE_FORK_SUBAGENT: "1",
		CODEBUDDY_ENABLE_SECURITY_AUDIT: "1",
		...stringValues(options.clientInfoEnv)
	};
	if (process.platform === "linux") env[require_common.WORKBUDDY_ENABLE_LINUX_SANDBOX_CLI] = "1";
	if (options.productConfigEnv) env.ACC_PRODUCT_CONFIG_V3 = options.productConfigEnv;
	if (options.productConfigPathEnv) env.ACC_PRODUCT_CONFIG_PATH = options.productConfigPathEnv;
	if (options.hostedCliInternetEnv) env.CODEBUDDY_INTERNET_ENVIRONMENT = options.hostedCliInternetEnv;
	if (options.pluginDirs) env.CODEBUDDY_PLUGIN_DIRS = options.pluginDirs;
	Object.assign(env, stringValues(options.proxyEnv));
	const runtimeConfig = options.bundledRuntimeConfig ?? DEFAULT_AGENT_CLI_BUNDLED_RUNTIME_CONFIG;
	const rtEnabled = runtimeConfig.enabled !== false;
	const managedNodeBinDirs = rtEnabled && runtimeConfig.tools?.node !== false ? options.managedNodeBinDirs ?? [] : [];
	const extraPathParts = [];
	extraPathParts.push(...managedNodeBinDirs);
	if (rtEnabled && runtimeConfig.tools?.python !== false) extraPathParts.push(...options.managedPythonBinDirs ?? []);
	extraPathParts.push(options.cliConnectorBin);
	if (rtEnabled && runtimeConfig.tools?.python !== false && options.pythonConnectorEnvBin) extraPathParts.push(options.pythonConnectorEnvBin);
	env.WORKBUDDY_EXTRA_PATHS = extraPathParts.filter(Boolean).join(options.pathDelimiter);
	const processEnv = options.processEnv ?? {};
	prependDirsToEnvPath(env, managedNodeBinDirs, processEnv, options.pathDelimiter);
	if (rtEnabled && runtimeConfig.tools?.gitBash !== false && processEnv.CODEBUDDY_CODE_GIT_BASH_PATH) env.CODEBUDDY_CODE_GIT_BASH_PATH = processEnv.CODEBUDDY_CODE_GIT_BASH_PATH;
	const disabledTypes = resolveDisabledManagedRuntimeTypes(runtimeConfig, options.registeredBinaryTypes ?? []);
	if (disabledTypes.length > 0) env.WORKBUDDY_MANAGED_RUNTIME_DISABLED = disabledTypes.join(",");
	copyProcessEnv(env, processEnv, [
		"SANDBOX_CLI_SHOW_CONSOLE",
		"SANDBOX_CLI_PATH",
		"CODEBUDDY_DISABLE_WEB_FETCH_REMOTE_API",
		"CODEBUDDY_PRE_MESSAGE_COMPACT_PCT",
		"CODEBUDDY_AUTOCOMPACT_PCT_OVERRIDE",
		"CODEBUDDY_ENGINEERING_COMPACT_SUFFICIENCY_PCT",
		"WEIXINPAY_MOCK_OUTCOME"
	]);
	const devEndpointOverride = require_common.getProductEndpointOverride().resolve();
	if (devEndpointOverride) env[require_common.WORKBUDDY_DEV_ENDPOINT_OVERRIDE_ENV] = devEndpointOverride;
	if (options.extra) Object.assign(env, options.extra);
	env[CODEBUDDY_API_KEY_HELPER_DISABLED_ENV] = "1";
	return env;
}
/**
* 把 `dirs` 前置进 `env` 的 PATH。用 `processEnv` 中实际的 path 键名
* （Windows 多为 `Path`）写入传入的 `env`，避免另写一个大小写不同的键导致
* 子进程拿到双键后回退旧 PATH。基底优先取 `env` 已有值，其次 `processEnv`。
* `dirs` 为空时不改动 `env`。
*/
function prependDirsToEnvPath(env, dirs, processEnv, pathDelimiter) {
	if (dirs.length === 0) return;
	const pathKey = Object.keys(processEnv).find((key) => key.toLowerCase() === "path") ?? "PATH";
	const base = env[pathKey] ?? processEnv[pathKey] ?? "";
	env[pathKey] = [...dirs, base].filter(Boolean).join(pathDelimiter);
}
function resolveDisabledManagedRuntimeTypes(runtimeConfig, registeredBinaryTypes) {
	const runtimeTypes = [...registeredBinaryTypes, ...CONFIG_ONLY_RUNTIME_TYPES.filter((type) => !registeredBinaryTypes.includes(type))];
	if (runtimeConfig.enabled === false) return runtimeTypes;
	return runtimeTypes.filter((type) => runtimeConfig.tools?.[type] === false);
}
function stringValues(input) {
	const output = {};
	for (const [key, value] of Object.entries(input ?? {})) if (typeof value === "string") output[key] = value;
	return output;
}
function copyProcessEnv(env, processEnv, keys) {
	for (const key of keys) {
		const value = processEnv[key];
		if (typeof value === "string" && value) env[key] = value;
	}
}
//#endregion
//#region ../../packages/workbuddy-server/src/agent/cli-runtime-files.ts
require_common.init_common$3();
var fsp = node_fs.promises;
/**
* 解析 managed binaries 根目录（<数据目录>/binaries）。
*
* 必须与 Desktop 主进程写入侧（vendor-extract-service）一致，否则专享版/私有化下
* 会出现"写到 ~/.aimea/binaries、读还锁 ~/.workbuddy"的写读不一致
* （cnb.woa.com/genie/genie/-/issues/79541）。
*
* 优先级：WORKBUDDY_CONFIG_DIR / CODEBUDDY_CONFIG_DIR env（专享版为 ~/.aimea）
*        → 回退 <homeDir>/.workbuddy（标准版行为不变）。
*/
function resolveManagedBinariesDir(homeDir, processEnv = process.env) {
	const configDir = processEnv.WORKBUDDY_CONFIG_DIR?.trim() || processEnv.CODEBUDDY_CONFIG_DIR?.trim() || node_path.join(homeDir, ".workbuddy");
	return node_path.join(configDir, "binaries");
}
function resolveAgentCliConnectorBin({ homeDir, platform }) {
	const connectorRoot = node_path.join(resolveManagedBinariesDir(homeDir), "node", "cli-connector-packages");
	return platform === "win32" ? connectorRoot : node_path.join(connectorRoot, "bin");
}
function resolveAgentCliPythonEnvBin({ homeDir, platform }) {
	const envDir = node_path.join(homeDir, ".workbuddy", "binaries", "python", "envs", "default");
	return platform === "win32" ? node_path.join(envDir, "Scripts") : node_path.join(envDir, "bin");
}
function resolveAgentCliExecutablePath({ bundledCliPaths = [], monorepoCliPath, envCliPath, exists = node_fs.existsSync }) {
	for (const bundledPath of bundledCliPaths) if (typeof bundledPath === "string" && bundledPath.trim()) return {
		path: bundledPath,
		source: "bundled"
	};
	if (typeof monorepoCliPath === "string" && monorepoCliPath.trim() && exists(monorepoCliPath)) return {
		path: monorepoCliPath,
		source: "monorepo"
	};
	const normalizedEnvPath = envCliPath?.trim();
	if (normalizedEnvPath && exists(normalizedEnvPath)) return {
		path: normalizedEnvPath,
		source: "env"
	};
}
function listAgentCliManagedBinDirs({ homeDir, platform, binaryType }) {
	const versionsDir = node_path.join(resolveManagedBinariesDir(homeDir), binaryType, "versions");
	try {
		const entries = node_fs.readdirSync(versionsDir);
		const validEntries = [];
		for (const entry of entries) {
			if (entry.includes(".installing.") || entry.includes(".__extract_temp__")) continue;
			const versionRoot = node_path.join(versionsDir, entry);
			try {
				if (!node_fs.statSync(versionRoot).isDirectory()) continue;
			} catch {
				continue;
			}
			validEntries.push(entry);
		}
		validEntries.sort(compareVersionsDesc);
		return validEntries.map((entry) => {
			const versionRoot = node_path.join(versionsDir, entry);
			return platform === "win32" ? versionRoot : node_path.join(versionRoot, "bin");
		});
	} catch {
		return [];
	}
}
async function listAgentCliManagedBinDirsAsync({ homeDir, platform, binaryType }) {
	const versionsDir = node_path.join(resolveManagedBinariesDir(homeDir), binaryType, "versions");
	try {
		const entries = await fsp.readdir(versionsDir);
		const validEntries = (await Promise.all(entries.map(async (entry) => {
			if (entry.includes(".installing.") || entry.includes(".__extract_temp__")) return;
			const versionRoot = node_path.join(versionsDir, entry);
			try {
				return (await fsp.stat(versionRoot)).isDirectory() ? entry : void 0;
			} catch {
				return;
			}
		}))).filter((entry) => !!entry);
		validEntries.sort(compareVersionsDesc);
		return validEntries.map((entry) => {
			const versionRoot = node_path.join(versionsDir, entry);
			return platform === "win32" ? versionRoot : node_path.join(versionRoot, "bin");
		});
	} catch {
		return [];
	}
}
/**
* 若 env 里的产品配置顶层 clientSecurity 含托管 runtime，返回覆盖后的 AgentCliBundledRuntimeConfig；
* 否则返回 undefined（用本地 app-config.json）。
*
* 支持两种交付方式：
*  1. 内联 env（ACC_PRODUCT_CONFIG_V3 / V2）
*  2. 文件路径 env（ACC_PRODUCT_CONFIG_PATH）—— 当路径方式生效时内联 V3 被置 undefined，
*     故需要在内联检查无果后再读文件。
*/
function readManagedBundledRuntimeFromEnv() {
	for (const key of require_cli_product_env.AGENT_CLI_PRODUCT_CONFIG_ENV_KEYS) {
		const raw = process.env[key];
		if (!raw) continue;
		try {
			const sc = JSON.parse(raw)?.clientSecurity;
			const policy = require_common.translateRemoteSecurityCenter(sc);
			if (policy.managed && policy.bundledRuntime) return {
				enabled: policy.bundledRuntime.enabled,
				tools: { ...policy.bundledRuntime.tools }
			};
		} catch {}
	}
	const configFilePath = process.env[require_cli_product_env.AGENT_CLI_PRODUCT_CONFIG_PATH_ENV_KEY];
	if (configFilePath) try {
		const raw = node_fs.readFileSync(configFilePath, "utf8");
		const sc = JSON.parse(raw)?.clientSecurity;
		const policy = require_common.translateRemoteSecurityCenter(sc);
		if (policy.managed && policy.bundledRuntime) return {
			enabled: policy.bundledRuntime.enabled,
			tools: { ...policy.bundledRuntime.tools }
		};
	} catch {}
}
function readAgentCliBundledRuntimeConfig(userDataDir) {
	const managed = readManagedBundledRuntimeFromEnv();
	if (managed) return managed;
	try {
		const configPath = node_path.join(userDataDir, "app-config.json");
		const raw = node_fs.readFileSync(configPath, "utf8");
		const rt = JSON.parse(raw)?.bundledRuntime;
		if (rt && typeof rt === "object") return {
			enabled: rt.enabled !== false,
			tools: {
				node: rt.tools?.node !== false,
				python: rt.tools?.python !== false,
				gitBash: rt.tools?.gitBash !== false,
				brokeredShell: rt.tools?.brokeredShell !== false
			}
		};
	} catch {}
	return DEFAULT_AGENT_CLI_BUNDLED_RUNTIME_CONFIG;
}
async function readAgentCliBundledRuntimeConfigAsync(userDataDir) {
	const managed = readManagedBundledRuntimeFromEnv();
	if (managed) return managed;
	try {
		const configPath = node_path.join(userDataDir, "app-config.json");
		const raw = await fsp.readFile(configPath, "utf8");
		const rt = JSON.parse(raw)?.bundledRuntime;
		if (rt && typeof rt === "object") return {
			enabled: rt.enabled !== false,
			tools: {
				node: rt.tools?.node !== false,
				python: rt.tools?.python !== false,
				gitBash: rt.tools?.gitBash !== false,
				brokeredShell: rt.tools?.brokeredShell !== false
			}
		};
	} catch {}
	return DEFAULT_AGENT_CLI_BUNDLED_RUNTIME_CONFIG;
}
function readAgentCliAppConfigValue(key, { userDataDir }) {
	try {
		const configPath = node_path.join(userDataDir, "app-config.json");
		const raw = node_fs.readFileSync(configPath, "utf8");
		return JSON.parse(raw)?.[key] ?? null;
	} catch {
		return null;
	}
}
function resolveAgentCliRuntimeDirs(options) {
	const configDir = resolveAgentCliConfigDir(options);
	return {
		configDir,
		userDataDir: resolveAgentCliUserDataDir({
			...options,
			configDir
		})
	};
}
function resolveAgentCliConfigDir({ getConfigDir, homeDir, processEnv = process.env, defaultConfigDirname = ".workbuddy" }) {
	return resolveInjectedPath(getConfigDir) || processEnv.WORKBUDDY_CONFIG_DIR?.trim() || node_path.join(homeDir, defaultConfigDirname);
}
function resolveAgentCliUserDataDir({ getUserDataDir, processEnv = process.env, configDir }) {
	return resolveInjectedPath(getUserDataDir) || processEnv.WORKBUDDY_USER_DATA_DIR?.trim() || node_path.join(configDir, "app");
}
function listAgentCliEnabledPluginDirs(configDir) {
	try {
		const settingsPath = node_path.join(configDir, "settings.json");
		if (!node_fs.existsSync(settingsPath)) return [];
		const enabledPlugins = JSON.parse(node_fs.readFileSync(settingsPath, "utf-8")).enabledPlugins || {};
		const dirs = [];
		for (const [pluginId, enabled] of Object.entries(enabledPlugins)) {
			if (!enabled) continue;
			const atIdx = pluginId.indexOf("@");
			if (atIdx <= 0) continue;
			const pluginName = pluginId.substring(0, atIdx);
			const marketplace = pluginId.substring(atIdx + 1);
			if (marketplace === "experts" || marketplace === "my-experts") continue;
			const pluginDir = node_path.join(configDir, "plugins", "marketplaces", marketplace, "plugins", pluginName);
			if (node_fs.existsSync(pluginDir)) dirs.push(pluginDir);
		}
		return dirs;
	} catch {
		return [];
	}
}
async function listAgentCliEnabledPluginDirsAsync(configDir) {
	try {
		const settingsPath = node_path.join(configDir, "settings.json");
		const raw = await fsp.readFile(settingsPath, "utf-8");
		const enabledPlugins = JSON.parse(raw).enabledPlugins || {};
		return (await Promise.all(Object.entries(enabledPlugins).map(async ([pluginId, enabled]) => {
			if (!enabled) return;
			const atIdx = pluginId.indexOf("@");
			if (atIdx <= 0) return;
			const pluginName = pluginId.substring(0, atIdx);
			const marketplace = pluginId.substring(atIdx + 1);
			if (marketplace === "experts" || marketplace === "my-experts") return;
			const pluginDir = node_path.join(configDir, "plugins", "marketplaces", marketplace, "plugins", pluginName);
			try {
				await fsp.access(pluginDir);
				return pluginDir;
			} catch {
				return;
			}
		}))).filter((dir) => !!dir);
	} catch {
		return [];
	}
}
function normalizeAgentCliBuiltinSkillsDir(resolvedPath) {
	if (resolvedPath.includes("app.asar") && !resolvedPath.includes("app.asar.unpacked")) return resolvedPath.replace("app.asar", "app.asar.unpacked");
	return resolvedPath;
}
function compareVersionsDesc(a, b) {
	const partsA = a.split(".").map(Number);
	const partsB = b.split(".").map(Number);
	const len = Math.max(partsA.length, partsB.length);
	for (let i = 0; i < len; i++) {
		const na = partsA[i] || 0;
		const nb = partsB[i] || 0;
		if (Number.isNaN(na) || Number.isNaN(nb)) return b.localeCompare(a);
		if (nb !== na) return nb - na;
	}
	return 0;
}
function resolveInjectedPath(resolvePath) {
	try {
		return resolvePath?.().trim() || void 0;
	} catch {
		return;
	}
}
//#endregion
//#region ../../packages/workbuddy-server/src/sidecar/client.ts
function log(...args) {
	console.log("[Sidecar:Client]", ...args);
}
function logError(...args) {
	console.error("[Sidecar:Client]", ...args);
}
var SidecarClient = class {
	/**
	* @param socketPath 必传——control pipe / socket 的完整路径（包含当前
	*     sidecar 实例的 uuid 后缀）。由调用方从 PID 文件的 controlPipeUuid
	*     字段与 `controlSocketPath(uuid)` 一起拼出。
	*/
	constructor(socketPath) {
		this.socket = null;
		this.nextId = 1;
		this.pending = /* @__PURE__ */ new Map();
		this.notificationHandler = null;
		this.closeHandler = null;
		this.buffer = "";
		if (!socketPath) throw new Error("SidecarClient requires a non-empty socketPath");
		this.socketPath = socketPath;
	}
	get isConnected() {
		return this.socket !== null;
	}
	connect() {
		return new Promise((resolve, reject) => {
			const socket = net.createConnection(this.socketPath);
			socket.on("connect", () => {
				this.socket = socket;
				this.setupDataHandler(socket);
				log("Connected to", this.socketPath);
				resolve();
			});
			socket.on("error", (err) => {
				if (!this.socket) reject(err);
				else {
					logError("Socket error:", err.message);
					this.rejectAllPending(/* @__PURE__ */ new Error(`Socket error: ${err.message}`));
				}
			});
			socket.on("close", () => {
				const wasConnected = this.socket !== null;
				this.socket = null;
				this.rejectAllPending(/* @__PURE__ */ new Error("Socket closed"));
				if (wasConnected) {
					log("Socket closed:", this.socketPath);
					const handler = this.closeHandler;
					if (handler) try {
						handler();
					} catch (err) {
						logError("closeHandler threw:", err);
					}
				}
			});
		});
	}
	onClose(handler) {
		this.closeHandler = handler;
	}
	setupDataHandler(socket) {
		socket.on("data", (chunk) => {
			this.buffer += chunk.toString("utf-8");
			let newlineIdx;
			while ((newlineIdx = this.buffer.indexOf("\n")) !== -1) {
				const line = this.buffer.slice(0, newlineIdx).trim();
				this.buffer = this.buffer.slice(newlineIdx + 1);
				if (line.length > 0) this.handleMessage(line);
			}
		});
	}
	handleMessage(raw) {
		let msg;
		try {
			msg = JSON.parse(raw);
		} catch {
			logError("Failed to parse message:", raw);
			return;
		}
		if (!("id" in msg) || msg.id === void 0) {
			const notif = msg;
			if (this.notificationHandler) this.notificationHandler(notif.method, notif.params);
			return;
		}
		const resp = msg;
		const pending = this.pending.get(resp.id);
		if (!pending) {
			logError("Received response for unknown id:", resp.id);
			return;
		}
		this.pending.delete(resp.id);
		clearTimeout(pending.timer);
		if (resp.error) {
			const err = new Error(resp.error.message);
			err.code = resp.error.code;
			err.data = resp.error.data;
			pending.reject(err);
		} else pending.resolve(resp.result);
	}
	sendRequest(method, params, timeoutMs = require_process_reap_utils.RPC_TIMEOUT_MS) {
		return new Promise((resolve, reject) => {
			if (!this.socket) {
				reject(/* @__PURE__ */ new Error("Not connected"));
				return;
			}
			const id = this.nextId++;
			const req = {
				jsonrpc: "2.0",
				id,
				method,
				params
			};
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(/* @__PURE__ */ new Error(`RPC timeout: ${method} (${timeoutMs}ms)`));
			}, timeoutMs);
			this.pending.set(id, {
				resolve,
				reject,
				timer
			});
			try {
				this.socket.write(`${JSON.stringify(req)}\n`);
			} catch (err) {
				this.pending.delete(id);
				clearTimeout(timer);
				reject(err);
			}
		});
	}
	onNotification(handler) {
		this.notificationHandler = handler;
	}
	async ping() {
		return await this.sendRequest("sidecar.ping");
	}
	async initializeCredentialProtection(bootstrap) {
		return await this.sendRequest("sidecar.credentialProtection.bootstrap", bootstrap);
	}
	async createSession(params) {
		return await this.sendRequest("session.create", params, require_process_reap_utils.SESSION_CREATE_RPC_TIMEOUT_MS);
	}
	async reconnectSession(sessionId, cols, rows) {
		return await this.sendRequest("session.reconnect", {
			sessionId,
			cols,
			rows
		}, require_process_reap_utils.SESSION_LIFECYCLE_RPC_TIMEOUT_MS);
	}
	async resizeSession(sessionId, cols, rows) {
		await this.sendRequest("session.resize", {
			sessionId,
			cols,
			rows
		});
	}
	async killSession(sessionId) {
		await this.sendRequest("session.kill", { sessionId });
	}
	async listSessions() {
		return await this.sendRequest("session.list");
	}
	async captureSession(sessionId, lines) {
		return (await this.sendRequest("session.capture", {
			sessionId,
			lines
		})).text;
	}
	/**
	* 请求 sidecar 优雅退出并等控制 socket 真正关闭。sidecar 先 ack 再异步收尾
	* （见 server.ts 的 sidecar.shutdown 分支），所以 RPC 用默认超时即可。
	* AbortSignal.timeout 的定时器不阻止进程退出。
	*
	* @returns 控制 socket 是否在超时前关闭（false = sidecar 可能仍在收尾）。
	*/
	async shutdown() {
		await this.sendRequest("sidecar.shutdown");
		const socket = this.socket;
		if (!socket) return true;
		return (0, node_events.once)(socket, "close", { signal: AbortSignal.timeout(require_process_reap_utils.SIDECAR_GRACEFUL_EXIT_TIMEOUT_MS) }).then(() => true, () => false);
	}
	attachDataSocket(sessionId) {
		return net.createConnection(require_process_reap_utils.dataSocketPath(sessionId));
	}
	dispose() {
		this.rejectAllPending(/* @__PURE__ */ new Error("Client disposed"));
		if (this.socket) {
			this.socket.destroy();
			this.socket = null;
		}
	}
	rejectAllPending(err) {
		for (const [, pending] of this.pending) {
			clearTimeout(pending.timer);
			pending.reject(err);
		}
		this.pending.clear();
	}
};
//#endregion
//#region ../../packages/workbuddy-server/src/agent/sidecar-manager.ts
/**
* SidecarManager
*
* Manages the sidecar process lifecycle. The sidecar is a long-lived Node.js
* process that hosts PTY sessions for CLI-based agent backends.
*
* Responsibilities:
* - Start sidecar (check PID file, ping existing, or spawn new)
* - Delegate session create/kill/list to sidecar via JSON-RPC
* - Provide data socket attachment for terminal I/O
* - Write PID file on spawn, read on reconnect
* - Graceful shutdown on app exit
*/
require_cli_product_env.init_cli_product_env();
var TAG$1 = "[SidecarManager]";
var HOST_RUNTIME_SESSION_ID = "__workbuddy_cli_host__";
var HOST_ENDPOINT_WAIT_TIMEOUT_MS = 3e4;
var HOST_ENDPOINT_PROBE_TIMEOUT_MS = 1e3;
var HOST_RUNTIME_INSTANCE_ID_ENV = "CODEBUDDY_RUNTIME_INSTANCE_ID";
var HOST_RUNTIME_HEALTH_PATH = "/api/v1/health";
/** Max attempts to ping the sidecar after spawning before giving up. */
var MAX_PING_RETRIES = 10;
/** Delay between ping retries in ms. */
var PING_RETRY_DELAY_MS = 300;
/**
* Max time to wait for the control socket/named-pipe to become free after
* sending SIGTERM to a stale sidecar. Tuned for the Windows named-pipe case
* where the kernel may briefly retain the pipe name after all handles close.
* Short enough that a truly wedged pipe surfaces a clear error instead of
* hanging the UX.
*/
var STALE_PIPE_RECLAIM_TIMEOUT_MS = 2e3;
/** Polling interval while probing whether the control path has been reclaimed. */
var STALE_PIPE_PROBE_INTERVAL_MS = 150;
/** Max stderr lines retained from a spawned sidecar for inclusion in startup failure diagnostics. */
var SIDECAR_STDERR_TAIL_LINES = 20;
var sidecarScopedLogger;
function resolveSidecarScopedLogger() {
	if (!sidecarScopedLogger) sidecarScopedLogger = require_logger.createWorkbuddyScopedLogger("sidecar-manager");
	return sidecarScopedLogger;
}
function formatSidecarLogArgs(args) {
	return args.map((arg) => {
		if (typeof arg === "string") return arg;
		if (arg instanceof Error) return arg.stack ?? arg.message;
		try {
			return JSON.stringify(arg);
		} catch {
			return String(arg);
		}
	}).join(" ");
}
var sidecarLog = {
	info: (...args) => resolveSidecarScopedLogger().info(formatSidecarLogArgs(args)),
	warn: (...args) => resolveSidecarScopedLogger().warn(formatSidecarLogArgs(args)),
	error: (...args) => resolveSidecarScopedLogger().error(formatSidecarLogArgs(args))
};
function isExpectedSidecarShutdownLine(line) {
	return line === "[Sidecar] Shutting down..." || /^\[Sidecar\] Killing session .+ \(pid=\d+\)$/.test(line);
}
function isHostedCliRuntimeSessionId(sessionId) {
	return sessionId === HOST_RUNTIME_SESSION_ID || Boolean(sessionId?.startsWith(`${HOST_RUNTIME_SESSION_ID}-`));
}
var USE_SYSTEM_CA_NODE_OPTION = "--use-system-ca";
var CODEBUDDY_QIMEI36_ENV_KEY = "CODEBUDDY_QIMEI36";
function buildSidecarProcessEnv(cliEnv, hostEnv = process.env, overrides = {}) {
	return {
		...hostEnv,
		...cliEnv.CODEBUDDY_CONFIG_DIR ? { CODEBUDDY_CONFIG_DIR: cliEnv.CODEBUDDY_CONFIG_DIR } : {},
		...cliEnv.WORKBUDDY_CONFIG_DIR ? { WORKBUDDY_CONFIG_DIR: cliEnv.WORKBUDDY_CONFIG_DIR } : {},
		...overrides,
		ELECTRON_RUN_AS_NODE: "1",
		NODE_OPTIONS: ""
	};
}
function defaultResolveBundledAsset() {}
function defaultGetBootstrapProductConfigEnv() {
	return "{}";
}
function resolveWorkbuddySidecarBundledAsset(...segments) {
	const appPath = require_runtime_context.getWorkbuddyRuntimeAppPath();
	const resourcesPath = process.env.WORKBUDDY_RESOURCES_PATH?.trim() || (path.basename(appPath) === "app.asar" ? path.dirname(appPath) : void 0);
	const candidates = [
		resourcesPath ? path.join(resourcesPath, "app.asar.unpacked", "resources", ...segments) : void 0,
		resourcesPath ? path.join(resourcesPath, "app.asar.unpacked", ...segments) : void 0,
		path.join(appPath, ...segments),
		path.join(appPath, "resources", ...segments),
		path.join(appPath, "..", "resources", ...segments),
		path.join(appPath, "..", "..", ...segments),
		path.join(appPath, "..", "..", "resources", ...segments),
		resourcesPath ? path.join(resourcesPath, ...segments) : void 0,
		resourcesPath ? path.join(resourcesPath, "resources", ...segments) : void 0
	];
	for (const candidate of candidates) if (candidate && fs.existsSync(candidate)) return candidate;
}
function withWorkbuddySidecarDefaults(dependencies = {}) {
	return {
		getRuntimeAppPath: require_runtime_context.getWorkbuddyRuntimeAppPath,
		getRuntimeAppVersion: require_runtime_context.getWorkbuddyRuntimeAppVersion,
		getRuntimeConfigDir: require_runtime_context.getWorkbuddyRuntimeConfigDir,
		getRuntimeUserDataDir: require_runtime_context.getWorkbuddyRuntimeUserDataDir,
		resolveBundledAsset: resolveWorkbuddySidecarBundledAsset,
		getBootstrapProductConfigEnv: defaultGetBootstrapProductConfigEnv,
		hostId: "workbuddy-desktop",
		...dependencies
	};
}
function getHostedCliCwd(sessionId) {
	return path.join((0, os.tmpdir)(), "workbuddy-host-cli", sessionId);
}
function getProxyEnvFromProcess() {
	const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
	const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
	const env = {};
	if (httpProxy) env.HTTP_PROXY = httpProxy;
	if (httpsProxy) env.HTTPS_PROXY = httpsProxy;
	if (httpProxy || httpsProxy) {
		env.NO_PROXY = require_proxy_env.mergeNoProxy(process.env.NO_PROXY || process.env.no_proxy);
		env.NODE_OPTIONS = USE_SYSTEM_CA_NODE_OPTION;
	}
	return env;
}
async function defaultResolveProxyEnv() {
	return getProxyEnvFromProcess();
}
var HostRuntimeStartSupersededError = class extends Error {
	constructor() {
		super("Hosted CLI runtime start was superseded by a newer generation");
		this.name = "HostRuntimeStartSupersededError";
	}
};
var HostRuntimeIdentityMismatchError = class extends Error {
	constructor(endpoint, reason) {
		super(`Hosted CLI runtime identity mismatch at ${endpoint}: ${reason}`);
		this.name = "HostRuntimeIdentityMismatchError";
	}
};
var sharedSidecarManager;
var sidecarCrashWatcher;
function bindSidecarCrashWatcher(fn) {
	sidecarCrashWatcher = fn;
}
var SidecarManager = class {
	constructor(dependencies = {}) {
		this.dependencies = dependencies;
		this.client = null;
		this.prewarmPool = null;
		this.startPromise = null;
		this.hostEndpoint = null;
		this.hostSessionId = null;
		this.hostRuntimeInstanceId = null;
		this.hostRuntimePid = null;
		this.hostEndpointGeneration = null;
		this.hostStartPromise = null;
		this.hostResetPromise = null;
		this.hostRotationQueue = Promise.resolve();
		this.hostRuntimeGeneration = 0;
		this.hostRuntimeCandidateSessionIds = /* @__PURE__ */ new Set();
		this.hostRuntimeStartControllers = /* @__PURE__ */ new Set();
		this.disposed = false;
		this.lastNotifiedHostEndpoint = null;
		this.hostEndpointChangedListeners = /* @__PURE__ */ new Set();
	}
	get credentialProtectionBootstrap() {
		return this.dependencies.credentialProtectionBootstrap ?? require_dist.createUnavailableAtRestEncryptionBootstrap("disabled", "missing-key");
	}
	async onStart() {}
	async onStop() {
		this.disposed = true;
		await this.shutdown();
	}
	/**
	* Pre-warm the sidecar process so that the first `createSession()` call
	* does not pay the full spawn + ping-retry cost.
	*
	* Safe to call multiple times — deduplicates via `ensureStarted()`.
	* Failures are non-fatal; callers should `.catch()` and log.
	*/
	async warmup() {
		await this.getHostEndpoint();
	}
	/**
	* Create a session in the sidecar (starts sidecar on first call).
	*/
	async createSession(params) {
		sidecarLog.info(`createSession: sessionId=${params.sessionId}, port=${params.port}, cwd=${params.cwd}`);
		await this.ensureStarted();
		const client = this.getClientOrThrow("create session");
		if (params.sessionId) {
			const matched = (await client.listSessions()).find((session) => session.sessionId === params.sessionId);
			if (matched) {
				const matchedEndpoint = extractHttpEndpoint(matched.acpEndpoint);
				if (matchedEndpoint && !await isEndpointReachable(matchedEndpoint)) {
					sidecarLog.info(`createSession: stale session ${params.sessionId} endpoint ${matchedEndpoint} not reachable, killing and creating fresh`);
					await client.killSession(params.sessionId).catch(() => {});
				} else {
					sidecarLog.info(`createSession: reconnecting existing session ${params.sessionId}, acpEndpoint=${matched.acpEndpoint}`);
					return client.reconnectSession(params.sessionId, params.cols, params.rows);
				}
			}
		}
		const handle = await client.createSession(params);
		sidecarLog.info(`createSession: created, sessionId=${params.sessionId}, acpEndpoint=${handle.acpEndpoint}, pid=${handle.pid ?? "unknown"}`);
		return handle;
	}
	/**
	* Kill a session in the sidecar.
	*/
	async killSession(sessionId) {
		if (!this.client || !this.client.isConnected) return;
		return this.client.killSession(sessionId);
	}
	/**
	* Kill a session with delivery proof (WB-BUG-20260803-003).
	*
	* client 被 `resetHostRuntime()` 提前 dispose 时必须重连（与 `listSessions()`
	* 相同的 `ensureStarted()` 路径）后执行 exact-session kill；重连或 kill 失败
	* 则抛错，调用方将结果视为 terminal unconfirmed，绝不静默成功。
	*/
	async killSessionConfirmed(sessionId) {
		await this.ensureStarted();
		return this.getClientOrThrow("kill session (confirmed)").killSession(sessionId);
	}
	async resizeSession(sessionId, cols, rows) {
		if (!this.client || !this.client.isConnected) return;
		return this.client.resizeSession(sessionId, cols, rows);
	}
	async listSessions() {
		await this.ensureStarted();
		return this.getClientOrThrow("list sessions").listSessions();
	}
	async getHostEndpoint() {
		while (true) {
			if (this.disposed) throw new Error(`${TAG$1} Manager is disposed`);
			if (this.hostResetPromise) {
				await this.hostResetPromise;
				continue;
			}
			const cachedEndpoint = this.hostEndpoint;
			const cachedSessionId = this.hostSessionId;
			const cachedRuntimeInstanceId = this.hostRuntimeInstanceId;
			const cachedRuntimePid = this.hostRuntimePid;
			const cachedGeneration = this.hostEndpointGeneration;
			if (cachedEndpoint && cachedRuntimeInstanceId) {
				const reachable = await isHostRuntimeEndpointReachable(cachedEndpoint, cachedRuntimeInstanceId, cachedRuntimePid ?? void 0);
				if (this.hostEndpoint !== cachedEndpoint || this.hostSessionId !== cachedSessionId || this.hostRuntimeInstanceId !== cachedRuntimeInstanceId || this.hostRuntimePid !== cachedRuntimePid || this.hostEndpointGeneration !== cachedGeneration) continue;
				if (reachable) return cachedEndpoint;
			}
			if (this.hostStartPromise) try {
				return (await this.hostStartPromise).endpoint;
			} catch (error) {
				if (error instanceof HostRuntimeStartSupersededError) continue;
				throw error;
			}
			if (this.hostEndpoint && this.hostEndpointGeneration !== this.hostRuntimeGeneration) {
				await this.hostRotationQueue;
				continue;
			}
			this.hostEndpoint = null;
			this.hostSessionId = null;
			this.hostRuntimeInstanceId = null;
			this.hostRuntimePid = null;
			this.hostEndpointGeneration = null;
			if (!this.hostStartPromise) {
				const generation = this.hostRuntimeGeneration;
				this.hostStartPromise = this.startHostRuntime(generation);
			}
			try {
				return (await this.hostStartPromise).endpoint;
			} catch (error) {
				if (error instanceof HostRuntimeStartSupersededError) continue;
				throw error;
			}
		}
	}
	/**
	* 订阅 host runtime 端点变化（轮转 / 崩溃恢复后端口变更）。
	* 用于让依赖该端点的下游服务刷新。
	* 仅在端点从一个已通知值变为不同值时触发，首次 provision 不触发。返回取消订阅函数。
	*/
	/**
	* 注入 prewarm 池引用（可选，装配层在池创建成功后调用）。
	*
	* prewarm 命中的会话绕过了 sidecar 会话表（自持 ACP 端点，不经过
	* `createSession` RPC），`listSessions()` 看不到它们；注入后
	* `getAllActiveEndpoints()` 会把池的活跃 endpoint 一并合并进来。
	*/
	setPrewarmPool(pool) {
		this.prewarmPool = pool;
	}
	/**
	* 返回所有活跃 sidecar session 的 HTTP endpoint 列表。
	*
	* 用于需要广播到所有会话 sidecar 的场景（如安全中心规则实时同步）。
	* 每个 session 的 acpEndpoint 去掉 /api/v1/acp 后缀得到 HTTP base URL。
	* 若 listSessions 失败（sidecar 未启动等），静默返回空数组。
	*
	* 合并了 prewarm 池已 activate 的会话 endpoint（见 setPrewarmPool 注释）——
	* 否则走池命中路径建立的会话永远不会收到广播。
	*/
	async getAllActiveEndpoints() {
		let sidecarEndpoints = [];
		try {
			sidecarEndpoints = (await this.listSessions()).map((s) => s.acpEndpoint).filter((ep) => typeof ep === "string" && ep.length > 0).map((ep) => extractHttpEndpoint(ep));
		} catch (error) {
			console.warn(TAG$1, "getAllActiveEndpoints: listSessions failed, falling back to empty:", error);
			sidecarEndpoints = [];
		}
		const prewarmEndpoints = this.prewarmPool?.getActiveEndpoints() ?? [];
		return Array.from(new Set([...sidecarEndpoints, ...prewarmEndpoints]));
	}
	/**
	* 按 sessionId 解析该会话的 ACP HTTP base（去掉 /api/v1/acp 后缀）。
	*
	* 查询顺序：
	* 1. 先从 `listSessions()`（普通 sidecar 会话表）查；
	* 2. 查不到时回退到 prewarm 池的 `getActiveEndpointForSession()`——prewarm
	*    命中的会话绕过 sidecar 会话表（自持 ACP 端点，不经 createSession RPC），
	*    不会出现在 `listSessions()` 里。
	*
	* issue #62459：`ExpertPluginService.switchExpertPluginForSession()` 依赖此
	* 方法拿到 ACP endpoint 去调 /api/v1/plugins/switch 注入专家身份。此前只查
	* `listSessions()`，prewarm 会话查不到 → 返回空 → 专家 plugin switch degrade，
	* 专家 plugin、子 agent 与工具的 session 级激活失效。
	*
	* 找不到（两处都没有）或 listSessions 抛错时，仍会尝试 prewarm 池兜底；
	* 都拿不到则返回 undefined。
	*/
	async resolveSessionHttpBase(sessionId) {
		if (!sessionId) return;
		try {
			const acpEndpoint = (await this.listSessions()).find((entry) => entry.sessionId === sessionId)?.acpEndpoint;
			if (typeof acpEndpoint === "string" && acpEndpoint) return extractHttpEndpoint(acpEndpoint);
		} catch (error) {
			sidecarLog.warn(`${TAG$1} resolveSessionHttpBase: listSessions failed, falling back to prewarm pool: ${error instanceof Error ? error.message : String(error)}`);
		}
		return this.prewarmPool?.getActiveEndpointForSession?.(sessionId);
	}
	onHostEndpointChanged(listener) {
		this.hostEndpointChangedListeners.add(listener);
		return () => {
			this.hostEndpointChangedListeners.delete(listener);
		};
	}
	emitHostEndpointChanged(endpoint) {
		for (const listener of this.hostEndpointChangedListeners) try {
			listener(endpoint);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			sidecarLog.warn(`${TAG$1} hostEndpointChanged listener error: ${message}`);
		}
	}
	async rotateHostRuntime(reason = "product-config-change") {
		if (this.disposed) throw new Error(`${TAG$1} Manager is disposed`);
		if (this.hostResetPromise) await this.hostResetPromise;
		if (!this.hostEndpoint && !this.hostStartPromise) {
			sidecarLog.info(`${TAG$1} rotateHostRuntime skipped: no active hosted CLI runtime (generation=${this.hostRuntimeGeneration}, reason=${reason})`);
			return;
		}
		const generation = ++this.hostRuntimeGeneration;
		this.abortPendingHostRuntimeStarts();
		sidecarLog.info(`${TAG$1} rotateHostRuntime requested: generation=${generation}, reason=${reason}`);
		this.hostRotationQueue = this.hostRotationQueue.catch((error) => {
			sidecarLog.warn(`${TAG$1} Previous hosted CLI runtime rotation failed: ${error instanceof Error ? error.message : String(error)}`);
		}).then(() => this.doRotateHostRuntime(generation, reason));
		return this.hostRotationQueue;
	}
	resetHostRuntime() {
		if (this.hostResetPromise) return this.hostResetPromise;
		const trackedResetPromise = this.doResetHostRuntime().finally(() => {
			if (this.hostResetPromise === trackedResetPromise) this.hostResetPromise = null;
		});
		this.hostResetPromise = trackedResetPromise;
		return trackedResetPromise;
	}
	async doResetHostRuntime() {
		const activeSessionId = this.hostSessionId;
		const clientAtReset = this.client;
		const pendingHostStart = this.hostStartPromise;
		const pendingRotation = this.hostRotationQueue;
		const hadRuntimeState = Boolean(this.hostEndpoint || this.hostSessionId || this.hostStartPromise);
		if (hadRuntimeState) this.hostRuntimeGeneration += 1;
		this.abortPendingHostRuntimeStarts();
		sidecarLog.info(`${TAG$1} resetHostRuntime requested: generation=${this.hostRuntimeGeneration}, activeSession=${activeSessionId ?? "none"}, action=${hadRuntimeState ? "invalidate" : "noop"}`);
		this.hostEndpoint = null;
		this.hostSessionId = null;
		this.hostRuntimeInstanceId = null;
		this.hostRuntimePid = null;
		this.hostEndpointGeneration = null;
		this.hostStartPromise = null;
		await Promise.allSettled([...pendingHostStart ? [pendingHostStart] : [], pendingRotation]);
		if (!clientAtReset || !clientAtReset.isConnected) return;
		await this.cleanupHostedCliRuntimeSessions("reset-host-runtime", void 0, [activeSessionId]);
		if (this.client !== clientAtReset) return;
		try {
			clientAtReset.dispose();
		} catch {}
		if (this.client === clientAtReset) this.client = null;
		this.startPromise = null;
	}
	async captureSession(sessionId, lines) {
		await this.ensureStarted();
		return this.getClientOrThrow("capture session").captureSession(sessionId, lines);
	}
	attachDataSocket(sessionId) {
		if (!this.client || !this.client.isConnected) throw new Error(`${TAG$1} Sidecar not started`);
		return this.client.attachDataSocket(sessionId);
	}
	/**
	* Gracefully shut down the sidecar process and disconnect.
	*
	* 终态操作：调用方只有 `onStop()` 和 daemon background services 的 `stop()`，
	* 两者都是进程关停语义。热重启 / 轮转走 `resetHostRuntime()`，不经过这里。
	*/
	async shutdown() {
		this.disposed = true;
		this.hostRuntimeGeneration += 1;
		this.abortPendingHostRuntimeStarts();
		this.hostEndpoint = null;
		this.hostSessionId = null;
		this.hostRuntimeInstanceId = null;
		this.hostRuntimePid = null;
		this.hostEndpointGeneration = null;
		this.hostStartPromise = null;
		this.startPromise = null;
		const client = this.client;
		this.client = null;
		if (!client) return;
		try {
			if (client.isConnected) await client.shutdown();
		} catch (err) {
			console.warn(TAG$1, "Shutdown RPC failed (sidecar may already be gone):", err);
		} finally {
			client.dispose();
		}
	}
	/**
	* Ensure a sidecar process is running and we have a connected client.
	*
	* Strategy:
	* 1. Read PID file — if exists, try to ping the existing sidecar.
	* 2. If ping succeeds, reuse the existing sidecar.
	* 3. Otherwise, spawn a new sidecar and wait for it to become ready.
	*/
	async ensureSidecar() {
		sidecarLog.info(`${TAG$1} ensureSidecar: starting`);
		await this.cleanupLegacySidecarArtifacts();
		const existing = this.readPidFile();
		if (existing) {
			sidecarLog.info(`${TAG$1} ensureSidecar: found PID file (pid=${existing.pid}, version=${existing.version}, controlPipeUuid=${existing.controlPipeUuid ?? "none"})`);
			if (!existing.controlPipeUuid) {
				sidecarLog.info(`${TAG$1} ensureSidecar: legacy pre-uuid PID file detected, forcing recovery`);
				if (!await this.cleanupStaleFiles(existing.pid, void 0)) throw new Error(`${TAG$1} Legacy sidecar (pid=${existing.pid}) could not be shut down and its control socket/pipe is still occupied. Please terminate leftover codebuddy/electron processes in Task Manager, or reboot.`);
				await this.spawnSidecar();
				return;
			}
			const existingSockPath = require_process_reap_utils.controlSocketPath(existing.controlPipeUuid);
			let client;
			try {
				client = new SidecarClient(existingSockPath);
				await client.connect();
				const ping = await client.ping();
				if (ping.version !== 4) {
					sidecarLog.info(`${TAG$1} ensureSidecar: protocol version changed (running=${ping.version}, expected=4); restarting sidecar`);
					const closed = await client.shutdown();
					client.dispose();
					client = void 0;
					if (!closed || !await waitForControlPathFree(existingSockPath, STALE_PIPE_RECLAIM_TIMEOUT_MS)) throw new Error(`${TAG$1} Incompatible sidecar v${ping.version} did not release its control socket`);
					try {
						fs.unlinkSync(require_process_reap_utils.pidFilePath());
					} catch {}
					await this.spawnSidecar();
					return;
				}
				if (await this.initializeSidecarCredentialProtection(client) === "rejected") {
					sidecarLog.info(`${TAG$1} ensureSidecar: credential bootstrap changed; restarting sidecar`);
					const closed = await client.shutdown();
					client.dispose();
					client = void 0;
					if (!closed || !await waitForControlPathFree(existingSockPath, STALE_PIPE_RECLAIM_TIMEOUT_MS)) throw new Error(`${TAG$1} Sidecar with conflicting credential bootstrap did not release its control socket`);
					try {
						fs.unlinkSync(require_process_reap_utils.pidFilePath());
					} catch {}
					await this.spawnSidecar();
					return;
				}
				sidecarLog.info(`${TAG$1} ensureSidecar: reconnected to existing sidecar (pid=${ping.pid}, uptime=${ping.uptime}ms, version=${ping.version})`);
				console.info(TAG$1, `Reconnected to existing sidecar (pid=${ping.pid}, uptime=${ping.uptime}ms)`);
				this.adoptClient(client);
				return;
			} catch (err) {
				client?.dispose();
				sidecarLog.info(`${TAG$1} ensureSidecar: stale PID file, existing sidecar not reachable (error=${err instanceof Error ? err.message : String(err)}), attempting recovery`);
				console.info(TAG$1, "Stale PID file — existing sidecar not reachable, attempting recovery");
				if (!await this.cleanupStaleFiles(existing.pid, existing.controlPipeUuid)) throw new Error(`${TAG$1} Control socket/pipe is still occupied after attempting to terminate the stale sidecar (pid=${existing.pid}). On Windows this usually means another process is holding the named pipe, or the kernel has not yet released the pipe name. Please check for leftover codebuddy/electron processes in Task Manager and terminate them, or reboot the machine.`);
			}
		} else sidecarLog.info(`${TAG$1} ensureSidecar: no PID file found, spawning new sidecar`);
		await this.spawnSidecar();
	}
	/**
	* Spawn a new sidecar process.
	*
	* The sidecar entry point is the bundled desktop-local sidecar entry.
	* We run it under the Electron binary with ELECTRON_RUN_AS_NODE=1 so it
	* executes as a plain Node.js process.
	*/
	/**
	* Probe whether the Windows NUL device (\\.\NUL) is currently openable.
	*
	* Node's `stdio: 'ignore'` maps each ignored fd to the NUL device on
	* Windows. If the Null driver is not loaded (e.g. its
	* HKLM\SYSTEM\CurrentControlSet\Services\Null registry key was removed and
	* the machine rebooted), opening NUL fails and `child_process.spawn`
	* returns a child with `pid === undefined` — the misleading "no PID
	* returned" error. This probe lets us gate the discard-file fallback on the
	* broken case only, leaving healthy machines on the unchanged 'ignore' path.
	*
	* @returns diagnostic string describing NUL availability (never throws)
	*/
	probeNulDevice() {
		if (process.platform !== "win32") return "not-win32 (NUL probe skipped)";
		const results = [];
		for (const [label, flags] of [["read", "r"], ["write", "w"]]) {
			let fd;
			try {
				fd = fs.openSync("\\\\.\\NUL", flags);
				results.push(`${label}=ok`);
			} catch (err) {
				const e = err;
				results.push(`${label}=FAIL(code=${e.code ?? "n/a"}, errno=${e.errno ?? "n/a"}, msg=${e.message})`);
			} finally {
				if (fd !== void 0) try {
					fs.closeSync(fd);
				} catch {}
			}
		}
		return results.join(", ");
	}
	/**
	* Resolve the path of the discard file that backs the sidecar's ignored
	* stdio when the NUL device is unavailable (see spawnSidecar). Prefers the
	* WorkBuddy runtime config dir so it is discoverable; falls back to the OS
	* temp dir (always writable) if the config dir cannot be resolved.
	*/
	resolveStdioDiscardPath() {
		try {
			const dir = require_runtime_context.getWorkbuddyRuntimeConfigDir();
			if (dir) return path.join(dir, "sidecar-stdio-discard.log");
		} catch {}
		return path.join((0, os.tmpdir)(), "workbuddy-sidecar-stdio-discard.log");
	}
	async spawnSidecar() {
		if (this.disposed) throw new Error(`${TAG$1} Manager is disposed`);
		const token = (0, crypto.randomUUID)();
		const controlPipeUuid = require_process_reap_utils.generateControlPipeUuid();
		await this.sweepStaleControlSocks(controlPipeUuid);
		const entryPath = this.resolveSidecarEntry();
		const execPath = this.dependencies.processExecPath ?? process.execPath;
		const args = [
			...this.dependencies.processExecArgv ?? [],
			entryPath,
			"--token",
			token,
			"--control-pipe-uuid",
			controlPipeUuid
		];
		console.info(TAG$1, `Spawning sidecar: ${execPath} ${args.join(" ")}`);
		sidecarLog.info(`${TAG$1} Spawning sidecar: execPath=${execPath}, args=${JSON.stringify(args)}, entryPath=${entryPath}, controlPipeUuid=${controlPipeUuid}`);
		const cliEnv = await buildCliEnvAsync({ ELECTRON_RUN_AS_NODE: "1" }, await this.resolveProxyEnv(), this.dependencies);
		await new Promise((resolve) => setImmediate(resolve));
		let stdioDiscardFd = null;
		if (process.platform === "win32") {
			const nulState = this.probeNulDevice();
			if (nulState.includes("FAIL")) try {
				const discardPath = this.resolveStdioDiscardPath();
				fs.mkdirSync(path.dirname(discardPath), { recursive: true });
				stdioDiscardFd = fs.openSync(discardPath, "w+");
				sidecarLog.error(`${TAG$1} spawnSidecar: NUL device is NOT openable (Null driver likely missing, e.g. Services\\Null registry key removed) — falling back to discard-file stdio '${discardPath}'. NUL probe: ${nulState}`);
			} catch (err) {
				const e = err;
				sidecarLog.error(`${TAG$1} spawnSidecar: NUL device unavailable and discard-file fallback failed (${e.message}); spawn will likely fail with ENOENT. NUL probe: ${nulState}`);
			}
		}
		const stdioConfig = stdioDiscardFd != null ? [
			stdioDiscardFd,
			stdioDiscardFd,
			"pipe"
		] : [
			"ignore",
			"ignore",
			"pipe"
		];
		let child;
		try {
			child = (0, child_process.spawn)(execPath, args, {
				detached: true,
				stdio: stdioConfig,
				windowsHide: true,
				env: {
					...buildSidecarProcessEnv(cliEnv, process.env, this.dependencies.env ?? {}),
					WORKBUDDY_AT_REST_ENCRYPTION: this.credentialProtectionBootstrap.mode
				}
			});
		} finally {
			if (stdioDiscardFd != null) try {
				fs.closeSync(stdioDiscardFd);
			} catch {}
		}
		sidecarCrashWatcher?.(child);
		const stderrTail = [];
		child.stderr?.on("data", (data) => {
			const text = data.toString().trim();
			if (!text) return;
			const lines = text.split(/\r?\n/).filter(Boolean);
			if (!this.disposed || !lines.every(isExpectedSidecarShutdownLine)) sidecarLog.warn(`[sidecar-stderr] ${text}`);
			for (const line of lines) {
				if (!line) continue;
				stderrTail.push(line);
				if (stderrTail.length > SIDECAR_STDERR_TAIL_LINES) stderrTail.shift();
			}
		});
		child.unref();
		const cliHealthCollector = this.dependencies.getCliHealthCollector?.();
		const spawnTime = Date.now();
		let earlyExit = null;
		const earlyExitPromise = new Promise((_, reject) => {
			child.once("exit", (code, signal) => {
				earlyExit = {
					code,
					signal
				};
				sidecarLog.warn(`Sidecar process exited: pid=${pid}, code=${code}, signal=${signal}, uptime=${Date.now() - spawnTime}ms`);
				if (code !== 0 && code !== null) cliHealthCollector?.recordCliCrash(code, signal);
				const tail = stderrTail.length ? `\nSidecar stderr tail:\n${stderrTail.join("\n")}` : "";
				reject(/* @__PURE__ */ new Error(`${TAG$1} Sidecar exited during startup (pid=${pid}, code=${code}, signal=${signal}).${tail}`));
			});
		});
		earlyExitPromise.catch(() => {});
		const pid = child.pid;
		if (pid == null) throw new Error(`${TAG$1} Failed to spawn sidecar — no PID returned`);
		await this.writePidFile({
			pid,
			token,
			version: 4,
			controlPipeUuid
		});
		try {
			await Promise.race([this.waitForReady(controlPipeUuid), earlyExitPromise]);
		} catch (err) {
			if (!earlyExit) cliHealthCollector?.recordCliCrash(null, "STARTUP_FAILED");
			const baseMessage = err instanceof Error ? err.message : String(err);
			const tail = !earlyExit && stderrTail.length ? `\nSidecar stderr tail:\n${stderrTail.join("\n")}` : "";
			throw new Error(`${baseMessage}${tail}`);
		}
		console.info(TAG$1, `Sidecar spawned (pid=${pid})`);
		cliHealthCollector?.recordCliStart(Date.now() - spawnTime);
	}
	/**
	* Poll the sidecar control socket until it responds to ping.
	*
	* @param controlPipeUuid 与刚 spawn 出的 sidecar 匹配的 uuid，用于拼出
	*     control socket 完整路径。
	*/
	async waitForReady(controlPipeUuid) {
		const sockPath = require_process_reap_utils.controlSocketPath(controlPipeUuid);
		sidecarLog.info(`${TAG$1} waitForReady: polling sidecar control socket ${sockPath} (max ${MAX_PING_RETRIES} retries, ${PING_RETRY_DELAY_MS}ms delay)`);
		for (let i = 0; i < MAX_PING_RETRIES; i++) {
			let client;
			try {
				client = new SidecarClient(sockPath);
				await client.connect();
				await client.ping();
				await this.initializeSidecarCredentialProtection(client);
				sidecarLog.info(`${TAG$1} waitForReady: sidecar ready after ${i + 1} attempt(s)`);
				this.adoptClient(client);
				return;
			} catch (err) {
				client?.dispose();
				if (i === MAX_PING_RETRIES - 1) sidecarLog.error(`${TAG$1} waitForReady: giving up after ${MAX_PING_RETRIES} retries (lastError=${err instanceof Error ? err.message : String(err)})`);
				await this.delay(PING_RETRY_DELAY_MS);
			}
		}
		throw new Error(`${TAG$1} Sidecar did not become ready after ${MAX_PING_RETRIES} retries`);
	}
	async initializeSidecarCredentialProtection(client) {
		try {
			const ack = await client.initializeCredentialProtection(require_dist.encodeAtRestEncryptionBootstrap(this.credentialProtectionBootstrap));
			if (ack.ok !== true || ack.mode !== this.credentialProtectionBootstrap.mode) {
				sidecarLog.warn("[CredentialProtection] sidecar bootstrap rejected; continuing");
				return "rejected";
			}
			return "accepted";
		} catch {
			sidecarLog.warn("[CredentialProtection] sidecar bootstrap unavailable; continuing");
			return "unavailable";
		}
	}
	/**
	* Install a freshly-connected client and wire up the socket-close
	* callback. When the IPC socket dies unexpectedly (e.g. sidecar crashed
	* or a transient disconnect), the client becomes a shell with
	* `isConnected === false`; we clear `this.client` so the next
	* `ensureStarted()` re-spawns or reconnects instead of short-circuiting
	* on a stale reference and throwing "Not connected".
	*/
	adoptClient(client) {
		this.client = client;
		client.onClose(() => {
			if (this.client === client) {
				console.warn(TAG$1, "Sidecar client socket closed; clearing stale reference");
				this.client = null;
				this.hostEndpoint = null;
				this.hostSessionId = null;
				this.hostRuntimeInstanceId = null;
				this.hostRuntimePid = null;
				this.hostEndpointGeneration = null;
				this.hostStartPromise = null;
				this.hostRuntimeGeneration += 1;
				this.abortPendingHostRuntimeStarts();
				sidecarLog.warn(`${TAG$1} Sidecar client socket closed; host runtime invalidated, generation=${this.hostRuntimeGeneration}`);
			}
		});
	}
	/**
	* Resolve the sidecar entry.js path.
	*
	* In development the entry lives in the monorepo source tree.
	* In production it will be bundled alongside the Electron app.
	*/
	resolveSidecarEntry() {
		if (this.dependencies.resolveSidecarEntry) return this.dependencies.resolveSidecarEntry();
		return path.resolve(__dirname, "./sidecar-entry.js");
	}
	readPidFile() {
		const filePath = require_process_reap_utils.pidFilePath();
		try {
			const raw = fs.readFileSync(filePath, "utf-8");
			return JSON.parse(raw);
		} catch {
			return null;
		}
	}
	async writePidFile(data) {
		const filePath = require_process_reap_utils.pidFilePath();
		const dir = path.dirname(filePath);
		await fs.promises.mkdir(dir, {
			recursive: true,
			mode: 448
		});
		await fs.promises.chmod(dir, 448).catch(() => void 0);
		await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
	}
	/**
	* Recover from a stale pid file when the previous sidecar is unreachable.
	*
	* 背景（Windows 僵死场景，5.2.3 用户实测）：老 sidecar 主进程已崩，其子孙
	* 进程（CLI worker / conhost）挂死并继续持有旧 control named pipe 句柄。
	* 内核在最后一个 server handle 关闭前，pipe 名不会从命名空间移除。
	*
	* 关键设计变更（相对旧实现）：新版 sidecar 每次 spawn 都用一个新随机 uuid 派生
	* pipe 名（`workbuddy-<token>-sidecar-control-<uuid>` / `sidecar-<uuid>.sock`），
	* 与老 pipe 名物理上不冲突。因此**不需要**等待老 pipe 释放就能安全 spawn。
	*
	* Steps:
	*   1. If `stalePid` is still alive, SIGTERM it (best-effort — TerminateProcess
	*      on Windows only 杀主进程，孙进程可能继续挂着，但那不影响新 sidecar 起来).
	*   2. Remove the pid file eagerly so a concurrent retry doesn't re-read
	*      the same PID.
	*   3. **Windows**：直接返回 true，让 caller 走 spawn。老 pipe 爱占多久占多久，
	*      新 sidecar 用新 uuid pipe。
	*      **POSIX**：仍探测控制 socket 是否释放。原因是 POSIX 上 control socket
	*      是磁盘文件；若走 legacy 分支（uuid=undefined），新 sidecar 的 legacy
	*      清理路径可能撞上固定名 `sidecar.sock`。保守起见保留原探测。
	*
	* @param stalePid 失联的 sidecar 进程 pid，用于活性探测和信号传递。
	* @param controlPipeUuid 该 sidecar 的 control pipe uuid；来自 PID 文件的
	*     `controlPipeUuid` 字段。若为 undefined 说明 PID 文件是 pre-uuid legacy
	*     版本，此时探测固定名 `sidecar.sock` / `sidecar-control` 兜底。
	*
	* Returns `true` when the caller may safely proceed to spawn a new sidecar
	* (Windows: always; POSIX: when the control socket path is free).
	*/
	async cleanupStaleFiles(stalePid, controlPipeUuid) {
		console.info(TAG$1, `Clearing stale sidecar pid file for unreachable process ${stalePid}`);
		let livenessStatus = "unknown";
		let livenessProbeError = null;
		try {
			process.kill(stalePid, 0);
			livenessStatus = "alive";
		} catch (err) {
			const code = err?.code;
			livenessProbeError = code ?? err?.message ?? "unknown";
			livenessStatus = code === "ESRCH" ? "dead" : "unknown";
		}
		const maybeAlive = livenessStatus !== "dead";
		console.info(TAG$1, `cleanupStaleFiles: stalePid=${stalePid} liveness=${livenessStatus}${livenessProbeError ? ` (probe err=${livenessProbeError})` : ""}, legacyControlPipeUuid=${controlPipeUuid ?? "none"}`);
		let sigtermOk = null;
		let sigtermError = null;
		if (maybeAlive) {
			sidecarLog.warn(`${TAG$1} Stale sidecar pid=${stalePid} liveness=${livenessStatus}, sending SIGTERM`);
			try {
				process.kill(stalePid, "SIGTERM");
				sigtermOk = true;
			} catch (err) {
				sigtermOk = false;
				sigtermError = err.message;
				sidecarLog.warn(`${TAG$1} Failed to terminate stale sidecar pid=${stalePid}: ${sigtermError}`);
			}
			console.info(TAG$1, `cleanupStaleFiles: SIGTERM stalePid=${stalePid} ok=${sigtermOk}${sigtermError ? ` err=${sigtermError}` : ""}`);
		}
		try {
			fs.unlinkSync(require_process_reap_utils.pidFilePath());
		} catch {}
		if (require_process_reap_utils.isNamedPipe()) {
			sidecarLog.info(`${TAG$1} Windows: skipping stale pipe wait for pid=${stalePid} (new sidecar will use a fresh uuid pipe; legacy pipe left to kernel)`);
			console.info(TAG$1, `cleanupStaleFiles: Windows path — skipping stale pipe probe by design (legacyPid=${stalePid} liveness=${livenessStatus} sigtermOk=${sigtermOk ?? "n/a"} legacyUuid=${controlPipeUuid ?? "none"}); new sidecar will spawn with a fresh uuid pipe`);
			return true;
		}
		const sockPath = require_process_reap_utils.controlSocketPath(controlPipeUuid);
		const free = await waitForControlPathFree(sockPath, STALE_PIPE_RECLAIM_TIMEOUT_MS);
		if (!free) sidecarLog.error(`${TAG$1} Control path ${sockPath} still occupied after ${STALE_PIPE_RECLAIM_TIMEOUT_MS}ms; refusing to spawn`);
		return free;
	}
	/**
	* POSIX 上清扫 runtime 目录下所有不属于当前 sidecar 的历史 control socket 文件。
	*
	* 场景：sidecar 被 SIGKILL / OOM / 电脑硬关机等异常路径终止时，无法执行
	* shutdown 收尾逻辑（unlinkSafe），会在磁盘上留下 `sidecar-<uuid>.sock`。
	* UUID 化后每次 spawn 都换新 uuid，历史文件会不断堆积——本方法在 spawn 前
	* 主动清扫，保持 runtime 目录干净。
	*
	* Windows 上 named pipe 是内核对象而非磁盘文件，pipe 名在最后一个 server handle
	* 关闭时自动从命名空间移除，无需磁盘清扫；此函数直接返回。
	*
	* 只删符合 `sidecar-<hex>.sock` 命名格式的文件，避免误伤其他历史工件；
	* data socket（`s-<hash>.sock`）与 pid 文件不动。
	*
	* @param currentControlPipeUuid 当前即将 spawn 的 sidecar uuid——匹配它的文件
	*     不会被删（正常情况这个文件也还不存在，但保底防御以免刚 listen 就把新文件删了）。
	*/
	async sweepStaleControlSocks(currentControlPipeUuid) {
		if (require_process_reap_utils.isNamedPipe()) return;
		const dir = require_process_reap_utils.sidecarRuntimeDir();
		let entries;
		try {
			entries = await fs.promises.readdir(dir);
		} catch (err) {
			if (err.code !== "ENOENT") sidecarLog.warn(`${TAG$1} sweepStaleControlSocks: readdir failed on ${dir}: ${err.message}`);
			return;
		}
		const removed = [];
		await Promise.all(entries.map(async (name) => {
			const match = require_process_reap_utils.matchControlSocketFile(name);
			if (!match || match.uuid === currentControlPipeUuid) return;
			const target = path.join(dir, name);
			try {
				await fs.promises.unlink(target);
				removed.push(name);
			} catch (err) {
				if (err.code !== "ENOENT") sidecarLog.warn(`${TAG$1} sweepStaleControlSocks: unlink ${target} failed: ${err.message}`);
			}
		}));
		if (removed.length > 0) sidecarLog.info(`${TAG$1} sweepStaleControlSocks: removed ${removed.length} stale control sock(s): ${removed.join(", ")}`);
	}
	/**
	* Shut down any pre-migration sidecar and remove its leftover files under
	* `~/.workbuddy`. Idempotent.
	*
	* Shutdown RPC target differs by platform:
	*   POSIX   — the legacy control socket path.
	*   Windows — no RPC shutdown. Named pipes are still stable across the
	*             migration, so we only clean obsolete filesystem remnants and
	*             leave any live sidecar/session state untouched.
	*/
	async cleanupLegacySidecarArtifacts() {
		const legacyDir = require_process_reap_utils.workbuddyConfigDir();
		const legacyControlSock = path.join(legacyDir, "sidecar.sock");
		const legacyPidFile = path.join(legacyDir, "sidecar.pid");
		const legacySessionsDir = path.join(legacyDir, "sessions");
		if (!require_process_reap_utils.isNamedPipe() && legacyDir === require_process_reap_utils.sidecarRuntimeDir()) return;
		const [hasLegacyPidFile, hasLegacyControlSock, hasLegacySessionsDir] = await Promise.all([
			pathExists(legacyPidFile),
			pathExists(legacyControlSock),
			pathExists(legacySessionsDir)
		]);
		if (!(hasLegacyPidFile || hasLegacyControlSock || hasLegacySessionsDir)) return;
		const shutdownTarget = legacyControlSock;
		const shouldTryRpc = !require_process_reap_utils.isNamedPipe() && hasLegacyControlSock;
		let rpcSent = false;
		let sidecarExited = false;
		if (shouldTryRpc) {
			let client;
			try {
				client = new SidecarClient(shutdownTarget);
				await client.connect();
				sidecarExited = await client.shutdown();
				rpcSent = true;
			} catch (err) {
				const code = err?.code;
				if (code !== "ENOENT" && code !== "ECONNREFUSED") console.warn(TAG$1, `Legacy sidecar at ${shutdownTarget} not reachable:`, err);
			} finally {
				client?.dispose();
			}
		}
		if (rpcSent && !sidecarExited) {
			console.warn(TAG$1, `Legacy sidecar at ${shutdownTarget} did not exit within ${require_process_reap_utils.SIDECAR_GRACEFUL_EXIT_TIMEOUT_MS}ms; leaving files for next launch`);
			return;
		}
		await Promise.all([unlinkFileSafeAsync(legacyControlSock), unlinkFileSafeAsync(legacyPidFile)]);
		try {
			for (const entry of await fs.promises.readdir(legacySessionsDir)) if (entry.endsWith(".sock")) await unlinkFileSafeAsync(path.join(legacySessionsDir, entry));
			await fs.promises.rmdir(legacySessionsDir);
		} catch {}
	}
	ensureStarted() {
		if (this.disposed) return Promise.reject(/* @__PURE__ */ new Error(`${TAG$1} Manager is disposed`));
		if (this.hostResetPromise) return this.hostResetPromise.then(() => this.ensureStarted());
		if (this.client && this.client.isConnected) return Promise.resolve();
		if (this.client && !this.client.isConnected) {
			console.warn(TAG$1, "Discarding stale sidecar client (socket closed) before re-initialization");
			try {
				this.client.dispose();
			} catch {}
			this.client = null;
			this.hostEndpoint = null;
			this.hostSessionId = null;
			this.hostRuntimeInstanceId = null;
			this.hostRuntimePid = null;
			this.hostEndpointGeneration = null;
			this.hostStartPromise = null;
			this.hostRuntimeGeneration += 1;
			this.abortPendingHostRuntimeStarts();
			sidecarLog.warn(`${TAG$1} Discarding stale sidecar client; host runtime invalidated, generation=${this.hostRuntimeGeneration}`);
		}
		if (!this.startPromise) {
			const trackedPromise = this.ensureSidecar().finally(() => {
				if (this.startPromise === trackedPromise) this.startPromise = null;
			});
			this.startPromise = trackedPromise;
		}
		return this.startPromise;
	}
	getClientOrThrow(action) {
		if (!this.client) throw new Error(`${TAG$1} Sidecar client unavailable while attempting to ${action}`);
		return this.client;
	}
	resolveProxyEnv() {
		return this.dependencies.resolveProxyEnv?.() ?? defaultResolveProxyEnv();
	}
	delay(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
	startHostRuntime(generation = this.hostRuntimeGeneration) {
		const trackedStartPromise = this.ensureHostEndpoint(generation).finally(() => {
			if (this.hostStartPromise === trackedStartPromise) this.hostStartPromise = null;
		});
		return trackedStartPromise;
	}
	abortPendingHostRuntimeStarts() {
		for (const controller of this.hostRuntimeStartControllers) controller.abort();
	}
	async cleanupHostedCliRuntimeSessions(reason, keepSessionId, knownSessionIds = []) {
		const isProtectedSession = (sessionId) => sessionId === keepSessionId || sessionId === this.hostSessionId || this.hostRuntimeCandidateSessionIds.has(sessionId);
		const sessionIdsToKill = /* @__PURE__ */ new Set();
		const addSessionId = (sessionId) => {
			if (isHostedCliRuntimeSessionId(sessionId) && !isProtectedSession(sessionId)) sessionIdsToKill.add(sessionId);
		};
		for (const sessionId of knownSessionIds) addSessionId(sessionId);
		if (this.client?.isConnected) try {
			const sessions = await this.client.listSessions();
			for (const session of sessions) addSessionId(session.sessionId);
		} catch (error) {
			sidecarLog.warn(`${TAG$1} Failed to list hosted CLI runtime sessions for cleanup (reason=${reason}): ${error instanceof Error ? error.message : String(error)}`);
		}
		if (!sessionIdsToKill.size) return;
		const sessionIds = [...sessionIdsToKill];
		sidecarLog.info(`${TAG$1} cleanupHostedCliRuntimeSessions: reason=${reason}, keep=${keepSessionId ?? "none"}, sessions=${sessionIds.join(",")}`);
		await Promise.all(sessionIds.map(async (sessionId) => {
			if (isProtectedSession(sessionId)) return;
			try {
				await this.killSession(sessionId);
			} catch (error) {
				sidecarLog.warn(`${TAG$1} Failed to stop stale hosted CLI runtime session ${sessionId} (reason=${reason}): ${error instanceof Error ? error.message : String(error)}`);
			}
		}));
	}
	async doRotateHostRuntime(generation, reason) {
		if (generation !== this.hostRuntimeGeneration) {
			sidecarLog.info(`${TAG$1} Skipping stale hosted CLI runtime rotation: generation=${generation}, current=${this.hostRuntimeGeneration}`);
			return;
		}
		const previousEndpoint = this.hostEndpoint;
		const previousSessionId = this.hostSessionId;
		const previousRuntimeInstanceId = this.hostRuntimeInstanceId;
		const previousRuntimePid = this.hostRuntimePid;
		if (!previousEndpoint && !this.hostStartPromise) {
			sidecarLog.info(`${TAG$1} No active hosted CLI runtime to rotate; next start will use latest env (generation=${generation}, reason=${reason})`);
			return;
		}
		if (!previousEndpoint) {
			sidecarLog.info(`${TAG$1} Hosted CLI runtime is already starting; generation bump will force latest env (generation=${generation}, reason=${reason})`);
			return;
		}
		const previousReachable = previousRuntimeInstanceId ? await isHostRuntimeEndpointReachable(previousEndpoint, previousRuntimeInstanceId, previousRuntimePid ?? void 0) : false;
		if (generation !== this.hostRuntimeGeneration) return;
		if (this.hostEndpoint !== previousEndpoint || this.hostSessionId !== previousSessionId || this.hostRuntimeInstanceId !== previousRuntimeInstanceId || this.hostRuntimePid !== previousRuntimePid) {
			sidecarLog.info(`${TAG$1} Active hosted CLI runtime changed while rotation probe was in flight; skipping stale result`);
			return;
		}
		if (!previousReachable) {
			sidecarLog.info(`${TAG$1} Active hosted CLI runtime is not reachable; next start will use latest env (generation=${generation}, reason=${reason})`);
			this.hostEndpoint = null;
			this.hostSessionId = null;
			this.hostRuntimeInstanceId = null;
			this.hostRuntimePid = null;
			this.hostEndpointGeneration = null;
			return;
		}
		let nextRuntime;
		try {
			nextRuntime = await this.ensureHostEndpoint(generation);
		} catch (error) {
			if (error instanceof HostRuntimeStartSupersededError) return;
			throw error;
		}
		sidecarLog.info(`${TAG$1} Hosted CLI runtime rotated: old=${previousSessionId ?? "none"}, new=${nextRuntime.sessionId}, reason=${reason}`);
	}
	async ensureHostEndpoint(generation = this.hostRuntimeGeneration) {
		if (this.disposed) throw new Error(`${TAG$1} Manager is disposed`);
		const startedAt = Date.now();
		const mcpConfig = this.dependencies.getMcpConfig?.();
		const proxyEnv = await this.resolveProxyEnv();
		const agentExtraEnv = await (this.dependencies.getAgentExtraEnv?.() ?? {});
		const qimei36 = (await this.dependencies.getQimei36?.())?.trim();
		const qimeiEnv = qimei36 ? { [CODEBUDDY_QIMEI36_ENV_KEY]: qimei36 } : {};
		const cliEnvRouteMode = this.dependencies.resolveCliEnvRouteMode?.();
		const baseCliEnv = await buildCliEnvAsync({
			ELECTRON_RUN_AS_NODE: "1",
			...this.dependencies.getConnectorTokenEnv?.() ?? {},
			...agentExtraEnv,
			...qimeiEnv
		}, proxyEnv, this.dependencies);
		const readinessTimeoutMs = this.dependencies.hostEndpointWaitTimeoutMs ?? HOST_ENDPOINT_WAIT_TIMEOUT_MS;
		if (generation !== this.hostRuntimeGeneration) throw new HostRuntimeStartSupersededError();
		const sessionId = this.createHostRuntimeSessionId(generation);
		const runtimeInstanceId = (0, crypto.randomUUID)();
		const cwd = getHostedCliCwd(sessionId);
		await fs.promises.mkdir(cwd, { recursive: true });
		if (generation !== this.hostRuntimeGeneration) throw new HostRuntimeStartSupersededError();
		const cliEnv = {
			...baseCliEnv,
			[HOST_RUNTIME_INSTANCE_ID_ENV]: runtimeInstanceId
		};
		sidecarLog.info(`${TAG$1} ensureHostEndpoint: starting generation=${generation}, current=${this.hostRuntimeGeneration}, sessionId=${sessionId}, port=auto, runtimeInstanceId=${runtimeInstanceId}, mcpConfig=${mcpConfig ? "yes" : "no"}, routeMode=${cliEnvRouteMode ?? "default"}`);
		this.hostRuntimeCandidateSessionIds.add(sessionId);
		const startController = new AbortController();
		this.hostRuntimeStartControllers.add(startController);
		try {
			const createPromise = this.createHostedRuntimeSession({
				sessionId,
				command: this.dependencies.processExecPath ?? process.execPath,
				args: [
					resolveCLIPath(this.dependencies),
					"--serve",
					"--no-session-persistence",
					"--setting-sources",
					"user",
					...cliEnvRouteMode ? ["--settings", JSON.stringify({ envRouteMode: cliEnvRouteMode })] : [],
					...mcpConfig ? [
						"--mcp-config",
						mcpConfig,
						"--strict-mcp-config"
					] : []
				],
				cwd,
				env: cliEnv,
				port: 0
			}, generation, startController.signal);
			const supersededPromise = new Promise((_, reject) => {
				const rejectSuperseded = () => {
					this.killSession(sessionId).catch(() => void 0);
					reject(new HostRuntimeStartSupersededError());
				};
				if (startController.signal.aborted) {
					rejectSuperseded();
					return;
				}
				startController.signal.addEventListener("abort", rejectSuperseded, { once: true });
			});
			createPromise.then(() => {
				if (startController.signal.aborted) return this.killSession(sessionId).catch(() => void 0);
			}, () => void 0);
			const runtimeHandle = await Promise.race([createPromise, supersededPromise]);
			const endpoint = extractHttpEndpoint(runtimeHandle.acpEndpoint);
			const runtimePid = runtimeHandle.pid;
			sidecarLog.info(`${TAG$1} ensureHostEndpoint: child reported endpoint generation=${generation}, sessionId=${sessionId}, endpoint=${endpoint}, pid=${runtimePid ?? "unknown"}`);
			await waitForHostRuntimeEndpoint(endpoint, runtimeInstanceId, runtimePid, readinessTimeoutMs, () => generation !== this.hostRuntimeGeneration);
			if (generation !== this.hostRuntimeGeneration) throw new HostRuntimeStartSupersededError();
			const previousHostSessionId = this.hostSessionId;
			this.hostEndpoint = endpoint;
			this.hostSessionId = sessionId;
			this.hostRuntimeInstanceId = runtimeInstanceId;
			this.hostRuntimePid = runtimePid ?? null;
			this.hostEndpointGeneration = generation;
			this.cleanupHostedCliRuntimeSessions("ensure-host-endpoint", sessionId, [previousHostSessionId]).catch(() => {});
			if (this.lastNotifiedHostEndpoint && this.lastNotifiedHostEndpoint !== endpoint) this.emitHostEndpointChanged(endpoint);
			this.lastNotifiedHostEndpoint = endpoint;
			sidecarLog.info(`${TAG$1} ensureHostEndpoint: ready generation=${generation}, sessionId=${sessionId}, endpoint=${endpoint}, pid=${runtimePid ?? "unknown"}, elapsedMs=${Date.now() - startedAt}`);
			return {
				sessionId,
				endpoint,
				runtimeInstanceId,
				pid: runtimePid
			};
		} catch (error) {
			const superseded = error instanceof HostRuntimeStartSupersededError;
			sidecarLog.info(`${TAG$1} ensureHostEndpoint: start failed generation=${generation}, current=${this.hostRuntimeGeneration}, superseded=${superseded}, killing session=${sessionId}`);
			await this.killSession(sessionId).catch(() => {});
			throw error;
		} finally {
			this.hostRuntimeCandidateSessionIds.delete(sessionId);
			this.hostRuntimeStartControllers.delete(startController);
		}
	}
	createHostRuntimeSessionId(generation) {
		return `${HOST_RUNTIME_SESSION_ID}-${generation}-${(0, crypto.randomUUID)().slice(0, 8)}`;
	}
	async createHostedRuntimeSession(params, generation, signal) {
		await this.ensureStarted();
		if (signal.aborted || generation !== this.hostRuntimeGeneration) throw new HostRuntimeStartSupersededError();
		return this.getClientOrThrow("create hosted CLI runtime").createSession(params);
	}
};
function getSharedSidecarManager(dependencies) {
	if (!sharedSidecarManager) sharedSidecarManager = new SidecarManager(dependencies);
	return sharedSidecarManager;
}
function createWorkbuddySidecarManager(dependencies = {}) {
	return new SidecarManager(withWorkbuddySidecarDefaults({
		resolveProxyEnv: defaultResolveProxyEnv,
		...dependencies
	}));
}
function getSharedWorkbuddySidecarManager(dependencies) {
	return getSharedSidecarManager(withWorkbuddySidecarDefaults({
		resolveProxyEnv: defaultResolveProxyEnv,
		...dependencies ?? {}
	}));
}
/**
* Poll a control socket / named-pipe path until it is safe for a new sidecar
* to `listen()` on it, or until `timeoutMs` elapses.
*
* "Free" means one of:
*   - connect() → ENOENT      (POSIX socket file absent; pipe name not registered)
*   - connect() → ECONNREFUSED (path exists but no listener — we can reclaim)
*
* "Occupied (abandon immediately)" means:
*   - connect() succeeds → a live listener is still serving; we cannot take
*     over, so we bail out without further waiting to keep the error path
*     informative.
*
* Transient states that we keep retrying through:
*   - EACCES / EPERM (Windows kernel still holding the named pipe briefly
*     after the previous owner exited)
*   - any other unexpected error — treated as "still occupied, wait it out"
*
* Returns `true` when the path is reclaimable, `false` on either an active
* listener or a timeout.
*/
function waitForControlPathFree(target, timeoutMs) {
	const deadline = Date.now() + timeoutMs;
	return new Promise((resolve) => {
		const probe = () => {
			if (Date.now() >= deadline) {
				resolve(false);
				return;
			}
			const socket = net.createConnection(target);
			let settled = false;
			const finalize = (result) => {
				if (settled) return;
				settled = true;
				socket.destroy();
				if (result === "free") resolve(true);
				else if (result === "occupied") resolve(false);
				else setTimeout(probe, STALE_PIPE_PROBE_INTERVAL_MS).unref();
			};
			socket.once("connect", () => finalize("occupied"));
			socket.once("error", (err) => {
				if (err.code === "ENOENT" || err.code === "ECONNREFUSED") finalize("free");
				else finalize("retry");
			});
		};
		probe();
	});
}
function extractHttpEndpoint(acpEndpoint) {
	return acpEndpoint.replace(/\/api\/v1\/acp$/, "");
}
function waitForEndpoint(endpoint, timeoutMs = HOST_ENDPOINT_WAIT_TIMEOUT_MS, isSuperseded) {
	return new Promise((resolve, reject) => {
		const rejectIfSuperseded = () => {
			if (!isSuperseded?.()) return false;
			reject(new HostRuntimeStartSupersededError());
			return true;
		};
		const match = endpoint.match(/^https?:\/\/([^/:]+):(\d+)/);
		if (!match) {
			resolve();
			return;
		}
		const [, host, rawPort] = match;
		const port = Number(rawPort);
		const deadline = Date.now() + timeoutMs;
		let delay = 50;
		const tryConnect = () => {
			if (rejectIfSuperseded()) return;
			const socket = net.createConnection({
				host,
				port
			}, () => {
				socket.destroy();
				if (!rejectIfSuperseded()) resolve();
			});
			socket.on("error", () => {
				socket.destroy();
				if (rejectIfSuperseded()) return;
				if (Date.now() >= deadline) {
					reject(/* @__PURE__ */ new Error(`${TAG$1} Host endpoint ${endpoint} not reachable after ${timeoutMs}ms`));
					return;
				}
				const currentDelay = delay;
				delay = Math.min(Math.ceil(delay * 1.5), 500);
				setTimeout(tryConnect, currentDelay);
			});
		};
		tryConnect();
	});
}
async function probeHostRuntimeEndpoint(endpoint, expectedRuntimeInstanceId, expectedPid, timeoutMs) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetch(`${endpoint}${HOST_RUNTIME_HEALTH_PATH}`, {
			headers: {
				"X-CodeBuddy-Request": "1",
				...require_gateway_secret.gatewaySecretHeaders()
			},
			signal: controller.signal
		});
		if (!response.ok) return {
			kind: "identity-mismatch",
			reason: `health returned HTTP ${response.status}`
		};
		let payload;
		try {
			payload = await response.json();
		} catch {
			return {
				kind: "identity-mismatch",
				reason: "health returned a non-JSON response"
			};
		}
		const envelope = payload && typeof payload === "object" ? payload : void 0;
		const health = envelope?.data && typeof envelope.data === "object" ? envelope.data : envelope;
		if (health?.status !== "ok") return {
			kind: "identity-mismatch",
			reason: "health status was not ok"
		};
		if (health.runtimeInstanceId !== expectedRuntimeInstanceId) return {
			kind: "identity-mismatch",
			reason: `runtime identity mismatch (expected=${expectedRuntimeInstanceId}, actual=${String(health.runtimeInstanceId ?? "missing")})`
		};
		if (expectedPid !== void 0 && health.pid !== expectedPid) return {
			kind: "identity-mismatch",
			reason: `runtime pid mismatch (expected=${expectedPid}, actual=${String(health.pid ?? "missing")})`
		};
		return { kind: "ready" };
	} catch (error) {
		return {
			kind: "unreachable",
			reason: error instanceof Error ? error.message : String(error)
		};
	} finally {
		clearTimeout(timeout);
	}
}
async function waitForHostRuntimeEndpoint(endpoint, expectedRuntimeInstanceId, expectedPid, timeoutMs = HOST_ENDPOINT_WAIT_TIMEOUT_MS, isSuperseded) {
	const deadline = Date.now() + timeoutMs;
	let delay = 50;
	while (true) {
		if (isSuperseded?.()) throw new HostRuntimeStartSupersededError();
		const remainingMs = Math.max(1, deadline - Date.now());
		const result = await probeHostRuntimeEndpoint(endpoint, expectedRuntimeInstanceId, expectedPid, Math.min(HOST_ENDPOINT_PROBE_TIMEOUT_MS, remainingMs));
		if (isSuperseded?.()) throw new HostRuntimeStartSupersededError();
		if (result.kind === "ready") return;
		if (result.kind === "identity-mismatch") throw new HostRuntimeIdentityMismatchError(endpoint, result.reason);
		if (Date.now() >= deadline) throw new Error(`${TAG$1} Host endpoint ${endpoint} not reachable with matching runtime identity after ${timeoutMs}ms (lastError=${result.reason})`);
		const currentDelay = Math.min(delay, Math.max(1, deadline - Date.now()));
		delay = Math.min(Math.ceil(delay * 1.5), 500);
		await new Promise((resolve) => setTimeout(resolve, currentDelay));
	}
}
async function isHostRuntimeEndpointReachable(endpoint, expectedRuntimeInstanceId, expectedPid) {
	return (await probeHostRuntimeEndpoint(endpoint, expectedRuntimeInstanceId, expectedPid, 500)).kind === "ready";
}
async function isEndpointReachable(endpoint) {
	try {
		await waitForEndpoint(endpoint, 500);
		return true;
	} catch {
		return false;
	}
}
function resolveCLIPath(options = {}) {
	const resolveAsset = options.resolveBundledAsset ?? defaultResolveBundledAsset;
	const bundled = resolveAsset("cli", "bin", "codebuddy") ?? resolveAsset("cli", "dist", "codebuddy.js");
	const appPath = (options.getRuntimeAppPath ?? require_runtime_context.getWorkbuddyRuntimeAppPath)();
	const monorepoBin = path.join(path.resolve(appPath, "..", ".."), "packages", "agent-cli", "bin", "codebuddy");
	const envPath = process.env.CODEBUDDY_CODE_PATH;
	const resolution = resolveAgentCliExecutablePath({
		bundledCliPaths: [bundled],
		monorepoCliPath: monorepoBin,
		envCliPath: envPath
	});
	if (resolution?.source === "env") sidecarLog.warn(`${TAG$1} resolveCLIPath: bundled CLI not found, falling back to CODEBUDDY_CODE_PATH=${envPath}`);
	if (resolution) return resolution.path;
	throw new Error(`${TAG$1} CLI not found.\n  - cli/bin/codebuddy
  - cli/dist/codebuddy.js`);
}
/**
* 列出所有已安装的托管 Node 版本的可执行文件目录。
*
* 目的：tmeet 等 CLI 包的 shim（.cmd / shell 脚本）内部会直接调 `node`，
* 若系统无 Node 且只有 WorkBuddy 管理的托管 Node，这些 node 可执行必须
* 也出现在 PATH 里，否则 shim 执行时会报 "'node' is not recognized"。
*
* 约定：
* - Windows 下 node.exe 直接在 `versions/<ver>/` 下（无 bin/ 子目录）
* - Unix 下 node 在 `versions/<ver>/bin/` 下
* - 排除 `*.installing.*`（进行中 / 残留的安装临时目录）和 `*.__extract_temp__`
* - 若 binaries/node/versions 不存在（用户还没装过任何 node），返回空数组
*/
function listManagedNodeBinDirs() {
	return listAgentCliManagedBinDirs({
		homeDir: (0, os.homedir)(),
		platform: process.platform,
		binaryType: "node"
	});
}
/**
* 列出所有已安装的托管 Python 版本的可执行文件目录。
*
* 与 listManagedNodeBinDirs 类似，确保 `python3` / `pip3` 等命令能通过
* PATH 查找到 managed 版本，而非回退到系统自带的 Python。
*
* 约定：
* - Windows 下 python.exe 直接在 `versions/<ver>/` 下（无 bin/ 子目录）
* - Unix 下 python3 在 `versions/<ver>/bin/` 下
* - 排除 `*.installing.*`（进行中 / 残留的安装临时目录）和 `*.__extract_temp__`
* - 若 binaries/python/versions 不存在（用户还没装过任何 python），返回空数组
*/
function listManagedPythonBinDirs() {
	return listAgentCliManagedBinDirs({
		homeDir: (0, os.homedir)(),
		platform: process.platform,
		binaryType: "python"
	});
}
async function pathExists(filePath) {
	try {
		await fs.promises.access(filePath);
		return true;
	} catch {
		return false;
	}
}
async function unlinkFileSafeAsync(filePath) {
	try {
		await fs.promises.unlink(filePath);
	} catch {}
}
/**
* 构造 sidecar 子进程的环境变量集合。
*
* 导出给 unit test 使用，用于守护几条
* 契约级 env：
*   - ACC_PRODUCT_CONFIG_V3 已注入
*
* 业务代码请仍通过 `SidecarManager` 调用，不要直接调本函数。
*/
/**
* baseline host capabilities env 值（builtin MCP plugins 如 weixinpay 在 sidecar 启动早期读取）。
* 单一来源常量：sidecar 非-claw 路径（:buildCliEnvFromResolved）与
* resolveHostCapabilities provider 复用，避免值漂移。
*/
var WORKBUDDY_HOST_CAPABILITIES_VALUE = "elicitation.form,weixinpay.interception";
function buildCliEnv(extra, proxyEnv, options = {}) {
	const context = createBuildCliEnvContext(options);
	return buildCliEnvFromResolved(extra, proxyEnv, context, resolveBuildCliEnvIo(context));
}
async function buildCliEnvAsync(extra, proxyEnv, options = {}) {
	const context = createBuildCliEnvContext(options);
	return buildCliEnvFromResolved(extra, proxyEnv, context, await resolveBuildCliEnvIoAsync(context));
}
function createBuildCliEnvContext(options = {}) {
	const getRuntimeAppVersion = options.getRuntimeAppVersion ?? require_runtime_context.getWorkbuddyRuntimeAppVersion;
	const getRuntimeConfigDir = options.getRuntimeConfigDir ?? require_runtime_context.getWorkbuddyRuntimeConfigDir;
	const getRuntimeUserDataDir = options.getRuntimeUserDataDir ?? require_runtime_context.getWorkbuddyRuntimeUserDataDir;
	return {
		runtimeAppVersion: getRuntimeAppVersion(),
		runtimeConfigDir: getRuntimeConfigDir(),
		runtimeUserDataDir: getRuntimeUserDataDir(),
		resolveAsset: options.resolveBundledAsset ?? defaultResolveBundledAsset,
		getBootstrapProductConfigEnv: options.getBootstrapProductConfigEnv ?? defaultGetBootstrapProductConfigEnv,
		hostId: options.hostId ?? "workbuddy-server",
		includeHostCapabilities: options.includeHostCapabilities
	};
}
function resolveBuildCliEnvIo(context) {
	const rtConfig = readAgentCliBundledRuntimeConfig(context.runtimeUserDataDir);
	const rtEnabled = rtConfig.enabled !== false;
	return {
		pluginDirs: listAgentCliEnabledPluginDirs(context.runtimeConfigDir).join(path.delimiter),
		productEnv: require_cli_product_env.resolveAgentCliProductEnv({
			processEnv: process.env,
			fallbackProductConfigEnv: process.env.ACC_PRODUCT_CONFIG_V3 ? void 0 : context.getBootstrapProductConfigEnv()
		}),
		rtConfig,
		managedNodeBinDirs: rtEnabled && rtConfig.tools?.node !== false ? listManagedNodeBinDirs() : [],
		managedPythonBinDirs: rtEnabled && rtConfig.tools?.python !== false ? listManagedPythonBinDirs() : []
	};
}
async function resolveBuildCliEnvIoAsync(context) {
	const [pluginDirs, productEnv, rtConfig] = await Promise.all([
		listAgentCliEnabledPluginDirsAsync(context.runtimeConfigDir),
		require_cli_product_env.resolveAgentCliProductEnvAsync({
			processEnv: process.env,
			fallbackProductConfigEnv: process.env.ACC_PRODUCT_CONFIG_V3 ? void 0 : context.getBootstrapProductConfigEnv()
		}),
		readAgentCliBundledRuntimeConfigAsync(context.runtimeUserDataDir)
	]);
	const rtEnabled = rtConfig.enabled !== false;
	const [managedNodeBinDirs, managedPythonBinDirs] = await Promise.all([rtEnabled && rtConfig.tools?.node !== false ? listAgentCliManagedBinDirsAsync({
		homeDir: (0, os.homedir)(),
		platform: process.platform,
		binaryType: "node"
	}) : Promise.resolve([]), rtEnabled && rtConfig.tools?.python !== false ? listAgentCliManagedBinDirsAsync({
		homeDir: (0, os.homedir)(),
		platform: process.platform,
		binaryType: "python"
	}) : Promise.resolve([])]);
	return {
		pluginDirs: pluginDirs.join(path.delimiter),
		productEnv,
		rtConfig,
		managedNodeBinDirs,
		managedPythonBinDirs
	};
}
function buildCliEnvFromResolved(extra, proxyEnv, context, resolved) {
	const env = {
		DISABLE_AUTOUPDATER: "1",
		ELECTRON_RUN_AS_NODE: "1",
		CODEBUDDY_GIT_REPO_SCAN_DISABLED: "1",
		CODEBUDDY_PROMPT_SUGGESTION_DISABLED: "1",
		CODEBUDDY_CONFIG_DIR: context.runtimeConfigDir,
		WORKBUDDY_CONFIG_DIR: context.runtimeConfigDir,
		WORKBUDDY_DATA_FOLDER_NAME: process.env.WORKBUDDY_DATA_FOLDER_NAME?.trim() || ".workbuddy",
		...require_gateway_secret.gatewaySecretEnv(),
		CODEBUDDY_FORCE_HEADLESS_BUNDLE: "1",
		CODEBUDDY_DISABLE_REQUEST_VALIDATION: "1",
		CODEBUDDY_SKIP_GIT_BASH_CHECK: "1",
		CODEBUDDY_HOST: context.hostId,
		CODEBUDDY_HIGH_CREDIT_APPROVAL_ENABLED: "1",
		CODEBUDDY_DISABLE_EXTENDED_PLUGIN_HOOKS: "1",
		CODEBUDDY_DISABLE_SESSION_HISTORY_CLEANUP: "1",
		CODEBUDDY_INCLUDE_TOPIC_MESSAGE: "1",
		CODEBUDDY_CODE_DISABLE_SESSION_SUMMARY: "1",
		CODEBUDDY_BUILTIN_SKILLS_DIR: context.resolveAsset?.("plugins", "workbuddy-builtin", "skills") ?? path.join(process.cwd(), "resources", "plugins", "workbuddy-builtin", "skills"),
		CODEBUDDY_POWERSHELL_USE_PTY: "1",
		CODEBUDDY_REPLAY_SHOW_PRE_COMPACT: "1",
		CODEBUDDY_SKILL_TOOL_CHAR_BUDGET: "30000",
		CODEBUDDY_DISABLE_FORK_SUBAGENT: "1",
		CODEBUDDY_ENABLE_SECURITY_AUDIT: "1",
		WORKBUDDY_NODE_ENV: process.env.NODE_ENV || "production",
		...require_client_info_env.buildWorkbuddyClientInfoEnv({
			getAppVersion: () => context.runtimeAppVersion,
			resolveBundledAsset: context.resolveAsset
		})
	};
	if (process.platform === "linux") env[require_common.WORKBUDDY_ENABLE_LINUX_SANDBOX_CLI] = "1";
	if (resolved.pluginDirs) env.CODEBUDDY_PLUGIN_DIRS = resolved.pluginDirs;
	if (resolved.productEnv.productConfigPathEnv) env.ACC_PRODUCT_CONFIG_PATH = resolved.productEnv.productConfigPathEnv;
	else if (resolved.productEnv.productConfigEnv) env.ACC_PRODUCT_CONFIG_V3 = resolved.productEnv.productConfigEnv;
	if (resolved.productEnv.hostedCliInternetEnv) env[require_cli_product_env.AGENT_CLI_HOSTED_INTERNET_ENVIRONMENT_KEY] = resolved.productEnv.hostedCliInternetEnv;
	const rtConfig = resolved.rtConfig;
	const rtEnabled = rtConfig.enabled !== false;
	if (rtEnabled && rtConfig.tools?.gitBash !== false && process.env.CODEBUDDY_CODE_GIT_BASH_PATH) env.CODEBUDDY_CODE_GIT_BASH_PATH = process.env.CODEBUDDY_CODE_GIT_BASH_PATH;
	if (process.env.CODEBUDDY_PRE_MESSAGE_COMPACT_PCT) env.CODEBUDDY_PRE_MESSAGE_COMPACT_PCT = process.env.CODEBUDDY_PRE_MESSAGE_COMPACT_PCT;
	if (process.env.CODEBUDDY_AUTOCOMPACT_PCT_OVERRIDE) env.CODEBUDDY_AUTOCOMPACT_PCT_OVERRIDE = process.env.CODEBUDDY_AUTOCOMPACT_PCT_OVERRIDE;
	if (process.env.CODEBUDDY_ENGINEERING_COMPACT_SUFFICIENCY_PCT) env.CODEBUDDY_ENGINEERING_COMPACT_SUFFICIENCY_PCT = process.env.CODEBUDDY_ENGINEERING_COMPACT_SUFFICIENCY_PCT;
	if (proxyEnv) Object.assign(env, proxyEnv);
	const cliConnectorBin = resolveAgentCliConnectorBin({
		homeDir: (0, os.homedir)(),
		platform: process.platform
	});
	const extraPathParts = [];
	const managedNodeBinDirs = rtEnabled && rtConfig.tools?.node !== false ? resolved.managedNodeBinDirs : [];
	extraPathParts.push(...managedNodeBinDirs);
	if (rtEnabled && rtConfig.tools?.python !== false) extraPathParts.push(...resolved.managedPythonBinDirs);
	extraPathParts.push(cliConnectorBin);
	env.WORKBUDDY_EXTRA_PATHS = extraPathParts.filter(Boolean).join(process.platform === "win32" ? ";" : ":");
	prependDirsToEnvPath(env, managedNodeBinDirs, process.env, path.delimiter);
	const disabledTypes = resolveDisabledManagedRuntimeTypes(rtConfig, require_client_info_env.getRegisteredBinaryTypes());
	if (disabledTypes.length > 0) env.WORKBUDDY_MANAGED_RUNTIME_DISABLED = disabledTypes.join(",");
	if (context.includeHostCapabilities !== false) env.CODEBUDDY_HOST_CAPABILITIES = WORKBUDDY_HOST_CAPABILITIES_VALUE;
	if (extra) Object.assign(env, extra);
	env[CODEBUDDY_API_KEY_HELPER_DISABLED_ENV] = "1";
	return env;
}
function buildWorkbuddyCliEnv(extra, proxyEnv, options = {}) {
	return buildCliEnv(extra, proxyEnv, withWorkbuddySidecarDefaults(options));
}
//#endregion
//#region ../../packages/workbuddy-server/src/agent/agent-teams-env.ts
var ENABLED = "1";
var DISABLED = "0";
var TEAM_EXPERT_TYPE = "team";
/**
* 计算 `CODEBUDDY_CODE_EXPERIMENTAL_AGENT_TEAMS` 的值。
*
* 设计要点：
* - 专家团覆盖优先于全局开关；这是 PRD 的硬要求（"用户选专家团进行会话时，要开启这些工具"）。
* - 未提供 disableAgentTeams 时按 true 处理（默认禁用）。
* - 函数纯函数实现，便于单测。
*/
function resolveAgentTeamsEnv(input = {}) {
	if (input.expertType === TEAM_EXPERT_TYPE) return ENABLED;
	return input.disableAgentTeams ?? true ? DISABLED : ENABLED;
}
/** 注入子进程 env 时使用的键名，集中常量避免拼写漂移。 */
var AGENT_TEAMS_ENV_KEY = "CODEBUDDY_CODE_EXPERIMENTAL_AGENT_TEAMS";
//#endregion
//#region ../../packages/workbuddy-server/src/agent/runtime-log-redaction.ts
function formatEnvCountForLog(label, env) {
	return `${label}=${Object.keys(env).length}`;
}
//#endregion
//#region ../../packages/workbuddy-server/src/agent/cli-prewarm-pool.ts
/**
* CliPrewarmPool —— 预热 agent-cli 进程池（消费 agent-cli 的 --prewarm 能力）
*
* 目的：让 WorkBuddy 新建会话 / reconfigure 重启会话时，能直接复用一个已经
* 跑完冷启动、挂在本地 IPC 上待命的 cbc 进程，把启动等待从 ~3.7s 降到 ~1ms。
*
* 边界（与 SidecarManager 解耦）：
* - 池只管 prewarm 进程（spawn / activate / kill / 补池），不碰 sidecar 会话表。
* - prewarm 进程一旦 activate 后即变为普通 `--serve` 进程，自持 ACP 端口；
*   池继续按 pid 跟踪它，直到 backend killSession 时由池负责终止。
* - 命中策略：env 与基线一致才用，否则返回 null 让 backend 走原冷启动。
*
* 设计依据：docs/superpowers/specs/2026-06-16-workbuddy-cbc-prewarm-design.md
*/
var TAG = "[CliPrewarmPool]";
/** IPC ping 等短命令的单次写 / 读超时。 */
var IPC_TIMEOUT_MS = 5e3;
/**
* activate 等到 ACP 业务 ready ACK 的总超时，与冷启动 endpoint readiness 窗口一致。
* 该 ACK 包含子进程真实 pid/sessionId 与内核分配的非零端口。
*/
var ACTIVATE_READY_TIMEOUT_MS = 18e4;
/**
* 进程进入 activating|active 后、仍未回 ready ACK 的分级快失败上限。
* 命中即失败并走 activate-failure 回收（removeEntry+terminate+replenish），
* 避免 #93200 里 ready ACK 永不回却干等满 ACTIVATE_READY_TIMEOUT_MS(180s)。
* ACTIVATE_READY_TIMEOUT_MS 保留为 ackPromise 绝对上限。
*/
var ACTIVATE_POST_ACTIVE_ACK_TIMEOUT_MS = 3e4;
/** SIGTERM 后等进程退出，超时则 SIGKILL。 */
var KILL_GRACEFUL_MS = 3e3;
/**
* waitSocketReady 的探活节拍：每 PING_INTERVAL_MS 发一次 ping，最多等
* SOCKET_READY_TIMEOUT_MS_*（按平台分档）。一次 ping 通了就视为 ready。
*
* 为什么这么设：
* - Windows 上 cbc 子进程冷启动实测 ≥10s（asar 解压 + 杀软扫描 + CellJS 容器
*   初始化 + PluginManager.listPlugins 慢路径），实际生产观测过 ~12s。原来
*   3s（30 × 100ms）会在 child 还没 listen 时就放弃 → daemon 主动 SIGTERM/
*   SIGKILL，但杀进程在 require 阶段的延迟使得 child 还能写出 "Prewarm IPC
*   listening" 日志，造成"看起来 ready 但已是僵尸"的诡异现象。
* - macOS / Linux 通常 <2s，但偶发负载抖动也用 10s 兜一下，绝大多数情况
*   首次 ping 就过，不会真的等满。
* - 为什么是"间隔 3s"而不是更密：第一次 ping 必然失败（child 还在 require），
*   过密 ping 没意义、还会和 child 的 CPU 抢资源；3s 一次足够覆盖 listen
*   完成的常见时间点（Windows 的 listen 一旦 require 完成基本秒级出结果），
*   失败后再等 3s 也就比"理想最快 ready 时刻"晚最多 3s，可接受。
*/
var PING_INTERVAL_MS = 3e3;
/** Windows 默认 socket-ready 总超时：覆盖 cbc 冷启动慢路径（asar + 杀软 + 容器初始化）。 */
var SOCKET_READY_TIMEOUT_MS_WIN = 3e4;
/** 非 Windows 默认 socket-ready 总超时：冷启动通常 <2s，10s 留给负载抖动兜底。 */
var SOCKET_READY_TIMEOUT_MS_POSIX = 1e4;
/** 意外退出后最少等多久再补池。
*
* 防止瞬时崩溃 → 立刻 spawn → 又崩的死循环；同时 10s 作为下限也给可能的
* 资源/端口/二进制问题留一点恢复余地，比 1s 更稳健。
* 正常 activate 用掉一个 entry 后的补池路径同样走这个退避基数（首次 0ms，
* 失败后按 base 起步），不会影响命中正常的运行时延。
*/
var REPLENISH_BACKOFF_BASE_MS = 1e4;
/** 退避封顶。崩到这个程度可能是环境问题（cliPath 失效等），等 60s 再试。 */
var REPLENISH_BACKOFF_MAX_MS = 6e4;
/**
* 后台健康探活的节拍与单次超时。
*
* 目的：识别"进程仍在、socket 仍 listen、但用户态被冻结"的假死进程
* （kill -STOP、系统休眠恢复、GC 死循环、sync C++ addon 死锁等）。
* 这些状态**不会**触发 child 'exit' 或 socket 'error'——`entry.status`
* 会一直停留在 'idle'，靠状态字段永远发现不了。
*
* 为什么改成"后台定时探活"而非"tryAcquire 时实时 ping"（issue #75795）：
* - 旧实现在 tryAcquire 命中前 `await pingIdleEntry`（同步阻塞用户建会话）。
*   Windows 上 cbc 进程刚 ready（socket 通）时，CellJS 容器 / PluginManager.doInit
*   等重活仍在跑、事件循环繁忙，named pipe 的 ping 响应被阻塞。500ms 单次 ping
*   超时 → 把"刚 ready 仍在初始化"的**健康**进程误判为假死淘汰 → 首次会话回退
*   冷启动（用户实测"首次慢、二次快"）。日志实测误杀发生在进程 ready 后 3.3~14.6s。
* - 新实现把"探活"与"acquire"解耦：spawn ready 后挂一个后台定时器周期性 ping，
*   只用来把假死进程降级淘汰；tryAcquire 变回同步、只读状态、不 ping，永不卡等待。
*   idle 进程乐观视为可用（含首次 ping 前的窗口），偶发命中刚就绪仍在忙的进程由
*   doActivate 自身兜底回退，不影响 acquire 的即时响应。
*
* 阈值选取：
* - 首次探活 20s：进程 idle 后 20s 做第一次探活，快速过滤掉"刚 spawn 就假死 /
*   启动即卡死"的坏进程；这 20s 内 idle 乐观算可用（不阻塞 acquire）。
* - 稳态间隔 8min：探活唯一目的是发现假死（SIGSTOP / 死锁 / 休眠恢复），这是低频
*   异常事件，且 acquire 路径已不依赖探活（同步、乐观放行），不必频繁 ping——
*   8min 一次几乎无 CPU 负担，也不与 child 抢资源。
* - 单次超时 2s：本地 ping 正常 <5ms；给 2s 容忍进程偶发繁忙（GC / 短暂 init 尾巴），
*   避免把只是"忙一下"的健康进程误判假死。
*
* 单测可通过 `healthProbeFirstDelayMs` / `healthProbeIntervalMs` /
* `healthProbeTimeoutMs` dep 注入小值加速。
*/
var HEALTH_PROBE_FIRST_DELAY_MS = 2e4;
var HEALTH_PROBE_INTERVAL_MS = 8 * 6e4;
var HEALTH_PROBE_TIMEOUT_MS = 2e3;
/**
* idle 待命 TTL：到期仍 idle 则回收，且不补池（issue #92347）。
* 默认 15min；单测可注入 `idleTtlMs` 小值。
*/
var IDLE_TTL_MS = 15 * 6e4;
/** 子进程 stderr 留尾巴行数，崩溃诊断用；超过即丢最早的。 */
var STDERR_TAIL_MAX_LINES = 20;
/** 单行 stderr 最长保留字节，避免单条爆栈占用过多内存。 */
var STDERR_TAIL_MAX_LINE_BYTES = 1024;
var cliChildCrashWatcher;
function bindCliChildCrashWatcher(fn) {
	cliChildCrashWatcher = fn;
}
/**
* 已知的 session 维度 env 键白名单——作为"未审计差异兜底拦截器"。
*
* 设计意图：
* - agent-cli 的 prewarm-protocol 已支持 activate 时透传 env，**已知**的
*   session 维度差异（agent-teams / connector token 等）可以在 activate
*   阶段消化，不再需要 env 完全相等才命中。
* - 但**未知**的 env 维度差异（未来加新功能引入了一个新的 session 维度 env）
*   不应被静默"复用"——如果它没注册进白名单、调用方没把它放进 deltaEnv，
*   prewarm 进程就会漏掉这个 env，下游会出错。
* - 因此 tryAcquire 仍然检查 deltaEnv 的键集合：**任意键不在白名单内** →
*   视为未审计差异，回退冷启动，宁可慢不要错。
*
* 维护规则：每当 backend 新增"按 session 变化的 env"，必须把对应键加进
* 这个白名单——这是个显式审计动作。
*
* ⚠️ 登记新键前必须核对 cbc 侧消费方（两层耦合契约）：
*   把一个键加进白名单 = 允许 prewarm 命中而**不回退**冷启动。此时该键的值
*   只会在 activate 阶段被 merge 进待命进程的 `process.env`
*   （见 agent-cli `cli-dispatcher.ts::runPrewarmStandby` 第 2 步）。因此 cbc
*   侧对这个 env 的消费**必须是运行时 live 读**（每次用时 `process.env[K]`），
*   **不能**是冷启动就固化的形态：
*     - 模块级 `const X = process.env.K`（require 时即冻结）
*     - 单例 `@Component` 的字段初始化 / 构造函数里读一次
*     - memoized getter（首调发生在 activate 之前 → 缓存旧值）
*   否则会踩"静默取旧值"陷阱：白名单放行了预热命中，但 cbc 那个缓存值仍是
*   待命进程冷启动时的 baseline 值，session 维度差异丢失且无任何报错。
*   （反面参照：白名单内现有键——CODEBUDDY_HOST_CAPABILITIES 在
*   mcp-server-manager 运行时兜底读、CODEBUDDY_QIMEI36 在 qimei-env-detector
*   运行时读、AGENT_TEAMS 在 team-manager.isEnabled 运行时读——全部是 live 读，
*   所以登记进白名单是安全的。）
*   若某个 per-session 键在 cbc 侧只能冷启动缓存，则**不要**加进白名单——保持
*   回退冷启动，宁可慢不要错。
*/
var PER_SESSION_ENV_KEYS = new Set([
	AGENT_TEAMS_ENV_KEY,
	"CODEBUDDY_CLIENT_INFO_DOWNLOAD_CHANNEL",
	"TENCENT_DOCS_LOCAL_MCP",
	"TENCENT_DOCS_LOCAL_SERVER",
	"editor_sdk_port",
	"CODEBUDDY_HOST_CAPABILITIES",
	"CODEBUDDY_QIMEI36",
	"CODEBUDDY_SESSION_SKILL_DIRS",
	"ACC_PRODUCT_CONFIG_PATH",
	"ACC_PRODUCT_CONFIG_V3",
	"ACC_PRODUCT_CONFIG_V2",
	"ACC_PRODUCT_CONFIG",
	"CODEBUDDY_PLUGIN_DIRS",
	"CODEBUDDY_HOST_PLUGIN_CATALOG_FILE",
	"CODEBUDDY_HOST_AGENT_CATALOG_FILE",
	"CODEBUDDY_INTERNET_ENVIRONMENT",
	"WORKBUDDY_EXTRA_PATHS"
]);
/**
* 把 connector token env 这种键名动态的字段也纳入白名单——按"约定俗成"的
* 后缀匹配。比真正穷举宽松，但仍能拦住完全意外的 env 名（如配置错的全局
* 变量、调试 flag 等）。
*/
var PER_SESSION_ENV_SUFFIXES = [
	"_TOKEN",
	"_API_KEY",
	"_ACCESS_TOKEN"
];
/**
* 运行期可变、需让当前进程 `process.env` 最新值覆盖固化 baselineEnv 的 env 声明。
*
* baselineEnv 在池创建时固化，但下列 env 可能在池创建之后被产品快照热更改写，
* spawn prewarm 时必须以当前进程的最新值为准。
*
* 互斥组：组内同一时刻只应有一个键生效。按数组顺序取当前进程里第一个「有值」
* 的键作为 active，用它覆盖并删除同组其余键，避免新旧配置并存。
*/
var MUTUALLY_EXCLUSIVE_ENV_GROUPS = [["ACC_PRODUCT_CONFIG_PATH", "ACC_PRODUCT_CONFIG_V3"]];
/**
* 解析当前进程里「受控产品配置 env」应注入的最终键值：互斥组按顺序择一
* （路径优先）。spawn 时用它把当前进程的最新值覆盖固化的 baselineEnv。
*/
function resolveCurrentProductConfigEnv() {
	const resolved = {};
	for (const group of MUTUALLY_EXCLUSIVE_ENV_GROUPS) {
		const activeKey = group.find((key) => Boolean(process.env[key]));
		if (activeKey) resolved[activeKey] = process.env[activeKey];
	}
	return resolved;
}
function applyCurrentProductConfigEnv(env) {
	const resolved = resolveCurrentProductConfigEnv();
	for (const group of MUTUALLY_EXCLUSIVE_ENV_GROUPS) {
		const activeKey = group.find((key) => key in resolved);
		if (!activeKey) continue;
		for (const key of group) if (key === activeKey) env[key] = resolved[key];
		else delete env[key];
	}
}
function isWhitelistedSessionEnvKey(key, trustedSessionEnvKeys) {
	if (PER_SESSION_ENV_KEYS.has(key) || trustedSessionEnvKeys.has(key)) return true;
	for (const suffix of PER_SESSION_ENV_SUFFIXES) if (key.endsWith(suffix)) return true;
	return false;
}
/**
* spawn 之后 live baseline 常漂、但 activate 可以覆盖写进 process.env 的键。
* 这些键单独不一致时不应 Recycle 全部 idle（#97082：count=1 → high 立刻冷起）。
* 未知键（如测试里的 SOME_BASE）仍走 discard + 补池。
*/
var ACTIVATE_SAFE_BASELINE_DRIFT_KEYS = new Set([
	"PATH",
	"Path",
	"WORKBUDDY_EXTRA_PATHS",
	"CODEBUDDY_INTERNET_ENVIRONMENT",
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
	"WORKBUDDY_PAC_RPC_TOKEN"
]);
function isActivateSafeBaselineDriftKey(key, trustedSessionEnvKeys) {
	return isWhitelistedSessionEnvKey(key, trustedSessionEnvKeys) || ACTIVATE_SAFE_BASELINE_DRIFT_KEYS.has(key);
}
function formatMismatchKeysForLog(keys) {
	return keys.join(",");
}
function overlayRuntimeValuesIntoDelta(deltaEnv, runtimeManagedEnv, keys) {
	for (const key of keys) if (Object.prototype.hasOwnProperty.call(runtimeManagedEnv, key)) deltaEnv[key] = runtimeManagedEnv[key];
	else deltaEnv[key] = "";
}
function managedEnvMismatchKeys(expected, actual) {
	return [...new Set([...Object.keys(expected), ...Object.keys(actual)])].filter((key) => !Object.prototype.hasOwnProperty.call(expected, key) || !Object.prototype.hasOwnProperty.call(actual, key) || expected[key] !== actual[key]).sort();
}
var CliPrewarmPool = class {
	constructor(deps) {
		this.deps = deps;
		this.entries = [];
		this.bySession = /* @__PURE__ */ new Map();
		this.started = false;
		this.stopped = false;
		this.replenishBackoffMs = 0;
		this.pendingReplenishments = 0;
		this.flushing = null;
		this.pendingFlush = false;
	}
	/** 启动池，spawn 初始 poolSize 个 prewarm 进程。失败不抛——池空 = 全走冷启动。 */
	start() {
		if (this.started || this.stopped) return;
		this.started = true;
		if (this.deps.poolSize <= 0) {
			this.log("info", "pool disabled (poolSize=0)");
			return;
		}
		this.log("info", `pool starting, size=${this.deps.poolSize}`);
		this.reapStalePoolProcesses().catch((error) => {
			this.log("warn", `stale pool reap failed: ${String(error)}`);
		});
		for (let i = 0; i < this.deps.poolSize; i++) this.spawnEntry().catch((err) => {
			this.log("warn", `initial spawn failed: ${String(err?.message ?? err)}`);
		});
	}
	/**
	* 启动期对账 `<sessionsDir>/<pid>.json`：只认 kind==='prewarm' 且
	* meta.prewarmId 以 `wb-pool-` 开头的条目（用户手动 cbc-prewarm 不碰）。
	* 防误杀：非法/占位 pid 跳过；死 pid 只清账；杀前校验进程命令行含该
	* prewarmId（PID 已被无关进程复用时只清账不动手）；命令行查询失败保守跳过。
	*/
	async reapStalePoolProcesses() {
		try {
			const dir = this.resolveSessionsDir();
			let files;
			try {
				files = (0, node_fs.readdirSync)(dir).filter((name) => name.endsWith(".json"));
			} catch {
				return;
			}
			for (const name of files) try {
				const raw = JSON.parse((0, node_fs.readFileSync)((0, node_path.join)(dir, name), "utf-8"));
				const prewarmId = raw?.meta?.prewarmId;
				if (raw?.kind !== "prewarm" || raw.manual || !prewarmId || !prewarmId.startsWith("wb-pool-")) continue;
				const pid = raw.pid;
				if (!require_process_reap_utils.isValidTargetPid(pid)) continue;
				if (this.entries.some((entry) => entry.child.pid === pid)) continue;
				if (!require_process_reap_utils.isPidAlive(pid)) {
					this.tryUnlinkPidFile(pid);
					continue;
				}
				const commandLine = await require_process_reap_utils.readProcessCommandLine(pid);
				if (this.entries.some((entry) => entry.child.pid === pid)) continue;
				if (commandLine === null) continue;
				if (!commandLine.includes(prewarmId)) {
					this.tryUnlinkPidFile(pid);
					continue;
				}
				this.log("warn", `reaping stale pool prewarm ${prewarmId} (pid=${pid}) from a previous daemon generation`);
				await require_process_reap_utils.killProcessTree(pid);
				this.tryUnlinkPidFile(pid);
			} catch {}
		} catch (error) {
			this.log("warn", `stale pool reap failed: ${String(error)}`);
		}
	}
	/**
	* 尝试领取一个 idle prewarm 进程。
	*
	* 命中条件：
	* 1. 池非空（有 idle entry）；
	* 2. sessionDeltaEnv 中所有键都在白名单内（PER_SESSION_ENV_KEYS ∪
	*    PER_SESSION_ENV_SUFFIXES）。出现白名单外键即视为"未审计差异"，
	*    回退冷启动——保护 prewarm 复用不被新引入的 env 维度静默破坏。
	* 3. **候选 idle 通过一次 IPC ping 健康探活**——防止把"被 STOP / 冻结 /
	*    死锁的假死进程"当作可用（issue #73926）：假死进程的 `entry.status`
	*    仍是 'idle'、child.exit 永不触发，只有主动 ping 能识别。失败即
	*    reclaim（打 `discarded` 标 + removeEntry + scheduleReplenish +
	*    fire-and-forget terminateChild），继续尝试下一个候选，全部失败返回
	*    null。
	*
	* 4. entry 的 spawn managed env 叠加 sessionDeltaEnv 后，应与本次冷启动
	*    的 runtimeManagedEnv 一致。只有**非 activate 可覆盖**的键不一致才
	*    discard + 补池；白名单 / PATH / 插件目录等漂移并进 delta 后命中
	*    （#97082：count=1 把 3 个 idle 全杀再 high 冷起）。
	*/
	tryAcquire(sessionDeltaEnv = {}, runtimeManagedEnv, trustedSessionEnvKeys = /* @__PURE__ */ new Set()) {
		if (this.stopped || this.deps.poolSize <= 0) return null;
		const unknownKeys = Object.keys(sessionDeltaEnv).filter((k) => !isWhitelistedSessionEnvKey(k, trustedSessionEnvKeys));
		if (unknownKeys.length > 0) {
			this.log("warn", `tryAcquire skipped: unknownSessionEnvCount=${unknownKeys.length}; add them to PER_SESSION_ENV_KEYS/SUFFIXES if expected`);
			return null;
		}
		const capturedDeltaEnv = { ...sessionDeltaEnv };
		for (const entry of [...this.entries]) {
			if (entry.status !== "idle") continue;
			if (runtimeManagedEnv) {
				const mismatchKeys = managedEnvMismatchKeys({
					...entry.spawnManagedEnv,
					...capturedDeltaEnv
				}, runtimeManagedEnv);
				if (mismatchKeys.length > 0) {
					const hardKeys = mismatchKeys.filter((key) => !isActivateSafeBaselineDriftKey(key, trustedSessionEnvKeys));
					if (hardKeys.length === 0) {
						overlayRuntimeValuesIntoDelta(capturedDeltaEnv, runtimeManagedEnv, mismatchKeys);
						this.log("info", `tryAcquire overlaying activate-safe env drift: keys=${formatMismatchKeysForLog(mismatchKeys)}`);
					} else {
						this.log("warn", `tryAcquire skipped stale entry: managedEnvMismatchCount=${hardKeys.length} keys=${formatMismatchKeysForLog(hardKeys)}`);
						this.clearHealthProbe(entry);
						this.clearIdleTtl(entry);
						entry.discarded = true;
						this.removeEntry(entry);
						this.scheduleReplenish("managed env mismatch");
						this.terminateChild(entry.child).catch(() => {});
						continue;
					}
				}
			}
			entry.status = "activated";
			this.clearHealthProbe(entry);
			this.clearIdleTtl(entry);
			this.log("info", `tryAcquire hit (id=${entry.prewarmId})`);
			return {
				prewarmId: entry.prewarmId,
				activate: (opts) => this.doActivate(entry, {
					...opts,
					env: Object.keys(capturedDeltaEnv).length > 0 ? capturedDeltaEnv : void 0
				})
			};
		}
		this.scheduleReplenish("acquire miss");
		return null;
	}
	/**
	* 启动 entry 的后台健康探活（issue #75795），两段式：
	* - 首次：idle 后 HEALTH_PROBE_FIRST_DELAY_MS（默认 20s）做第一次探活，快速
	*   过滤刚 spawn 就假死的坏进程；
	* - 稳态：首次探活跑完后转 setInterval，每 HEALTH_PROBE_INTERVAL_MS（默认 8min）
	*   一次，低频发现假死。
	* 定时器 unref，避免拖住进程退出。幂等：已有定时器则先清再建。
	*/
	startHealthProbe(entry) {
		this.clearHealthProbe(entry);
		const firstDelayMs = this.deps.healthProbeFirstDelayMs ?? HEALTH_PROBE_FIRST_DELAY_MS;
		const intervalMs = this.deps.healthProbeIntervalMs ?? HEALTH_PROBE_INTERVAL_MS;
		const firstTimer = setTimeout(() => {
			this.runHealthProbe(entry).finally(() => {
				if (this.stopped || entry.status !== "idle" || entry.discarded) return;
				const intervalTimer = setInterval(() => {
					this.runHealthProbe(entry).catch(() => {});
				}, intervalMs);
				intervalTimer.unref?.();
				entry.healthTimer = intervalTimer;
			}).catch(() => {});
		}, firstDelayMs);
		firstTimer.unref?.();
		entry.healthTimer = firstTimer;
	}
	/**
	* 清除 entry 的健康探活定时器（activate / 淘汰 / stop 时调用）。
	* 句柄可能是 setTimeout（首次）或 setInterval（稳态）——Node 的 Timeout 对象
	* 对 clearTimeout / clearInterval 均可清理，这里两者都调以覆盖两种阶段。
	*/
	clearHealthProbe(entry) {
		if (entry.healthTimer) {
			clearTimeout(entry.healthTimer);
			clearInterval(entry.healthTimer);
			entry.healthTimer = void 0;
		}
	}
	/**
	* idle 进入待命时启动 TTL（issue #92347）。到期仍 idle 则计划内回收，不补池。
	* 只杀 idle，不杀 activated / spawning。幂等：已有定时器则先清再建。
	*/
	startIdleTtl(entry) {
		this.clearIdleTtl(entry);
		const ttlMs = this.deps.idleTtlMs ?? IDLE_TTL_MS;
		const timer = setTimeout(() => {
			this.expireIdleEntry(entry);
		}, ttlMs);
		timer.unref?.();
		entry.idleTtlTimer = timer;
	}
	clearIdleTtl(entry) {
		if (entry.idleTtlTimer) {
			clearTimeout(entry.idleTtlTimer);
			entry.idleTtlTimer = void 0;
		}
	}
	/**
	* idle TTL 到期：顺序必须是 discarded=true → 清 TTL + health probe →
	* removeEntry → terminateChild。禁止再 scheduleReplenish；exit handler
	* 因 discarded 跳过 unexpected-exit 补池。
	*/
	expireIdleEntry(entry) {
		if (this.stopped || entry.status !== "idle" || entry.discarded) return;
		this.log("info", `idle TTL expired, discarding idle prewarm (id=${entry.prewarmId}, pid=${entry.child.pid ?? "unknown"})`);
		entry.discarded = true;
		this.clearIdleTtl(entry);
		this.clearHealthProbe(entry);
		this.removeEntry(entry);
		this.terminateChild(entry.child).catch(() => {});
	}
	/**
	* 后台探活一次：对 idle entry 发一次 ping，失败即当假死淘汰。
	*
	* 失败原因不区分（timeout / ECONNREFUSED / ok!=true），一律视作"不健康"——
	* 假死进程只有 timeout 一种表现，其他失败也意味着 entry 不可用。
	*
	* 淘汰路径与旧 tryAcquire 假死分支一致（issue #73926）：打 discarded 标避免
	* SIGKILL 触发 exit handler 双写补池，removeEntry + scheduleReplenish +
	* fire-and-forget terminateChild。只处理仍是 idle 的 entry——探活期间若已被
	* acquire（activated）或已淘汰，直接跳过。
	*/
	async runHealthProbe(entry) {
		if (this.stopped || entry.status !== "idle" || entry.discarded) return;
		const timeoutMs = this.deps.healthProbeTimeoutMs ?? HEALTH_PROBE_TIMEOUT_MS;
		let healthy = false;
		try {
			const res = await sendIpcLine(entry.socketPath, { cmd: "ping" }, timeoutMs);
			healthy = !!(res && res.ok === true);
		} catch {
			healthy = false;
		}
		if (healthy || this.stopped || entry.status !== "idle" || entry.discarded) return;
		this.log("warn", `health probe failed, reclaiming unhealthy idle prewarm (id=${entry.prewarmId}, pid=${entry.child.pid ?? "unknown"})`);
		this.clearHealthProbe(entry);
		entry.discarded = true;
		this.removeEntry(entry);
		this.scheduleReplenish("unhealthy idle", { minDelayMs: this.deps.unexpectedExitBackoffMs ?? REPLENISH_BACKOFF_BASE_MS });
		this.terminateChild(entry.child).catch(() => {});
	}
	/**
	* killSession：若该 session 由池产生，按 pid 终止并清映射；否则返回 false
	* 让调用方走原 runtimeManager.killSession（sidecar 路径）。
	*/
	async killSession(sessionId) {
		const entry = this.bySession.get(sessionId);
		if (!entry) return false;
		this.bySession.delete(sessionId);
		this.removeEntry(entry);
		await this.terminateChild(entry.child).catch((err) => {
			this.log("warn", `killSession terminate failed: ${String(err?.message ?? err)}`);
		});
		return true;
	}
	/**
	* 返回所有已 activate 的 prewarm 会话的 HTTP endpoint（去掉 /api/v1/acp 后缀）。
	*
	* prewarm 命中的会话绕过了 sidecar 会话表（见文件头设计边界），不会出现在
	* `SidecarManager.listSessions()` 里；供 `SidecarManager.getAllActiveEndpoints()`
	* 合并汇总，否则安全中心规则实时同步等广播场景会漏掉这些会话。
	*/
	getActiveEndpoints() {
		return this.entries.filter((e) => e.status === "activated" && e.acpEndpoint).map((e) => e.acpEndpoint.replace(/\/api\/v1\/acp$/, ""));
	}
	/**
	* 按 sessionId 精确查询该会话已 activate 的 HTTP endpoint（去掉 /api/v1/acp 后缀）。
	*
	* prewarm 命中的会话绕过 sidecar 会话表（见文件头设计边界），不在
	* `SidecarManager.listSessions()` 里；`SidecarManager.resolveSessionHttpBase()`
	* 查不到普通 sidecar session 时回退到这里，让 `ExpertPluginService`
	* 之类按 sessionId 定位 ACP endpoint 的链路在 prewarm 会话中也能拿到端点
	* （issue #62459：不然专家 plugin switch 会 degrade，专家身份注入失效）。
	*
	* 未 activate / 已 kill / 未知 sessionId 返回 undefined。
	*/
	getActiveEndpointForSession(sessionId) {
		const entry = this.bySession.get(sessionId);
		if (!entry || entry.status !== "activated" || !entry.acpEndpoint) return;
		return entry.acpEndpoint.replace(/\/api\/v1\/acp$/, "");
	}
	/**
	* flush：无条件杀掉所有 idle/spawning 条目并重新 spawn。
	*
	* 典型场景：
	* - auth 状态变化（登录 / 登出 / 切用户）：旧 prewarm 进程持有的 auth 文件
	*   快照已过时，必须换一批在新 auth 环境下重新冷启动。
	* - 产品配置快照变化：新配置已写入当前进程的产品配置 env（可能是内联
	*   ACC_PRODUCT_CONFIG_V3，也可能是 Linux 大配置 spill 后的固定路径文件），
	*   重新 spawn 时经 applyCurrentProductConfigEnv 覆盖固化的 baselineEnv 生效。
	*
	* 变化检测由上游 coordinator 的 rotation key 精确去重（无实质变化的高频发布
	* 不会触发本入口），因此这里不再做二次指纹去重——否则 spill 模式下固定路径的
	* 指纹恒定，会把真实变化误判为无变化而漏重建。
	*
	* 已 activated 的条目不受影响（它们已经绑定了 session，由 killSession 管理）。
	*
	* 多次并发/连续调用会被合并（见 enqueueFlush），不会重复杀正在 spawning 的新进程。
	*/
	async flush() {
		if (this.stopped || this.deps.poolSize <= 0) return;
		return this.enqueueFlush();
	}
	/**
	* 合并 flush 请求：进行中再来的请求只置 pending 并共享同一个 Promise，
	* 当前轮结束后按需补跑一轮。这样连环触发（auth + 产品三段式发布同时到达）
	* 最多收敛成一轮补充重建，不会 N 次反复杀掉刚 spawn 的进程。
	*/
	enqueueFlush() {
		if (this.flushing) {
			this.pendingFlush = true;
			return this.flushing;
		}
		this.flushing = this.runFlushLoop();
		return this.flushing;
	}
	async runFlushLoop() {
		try {
			do {
				this.pendingFlush = false;
				await this.runFlush();
			} while (this.pendingFlush && !this.stopped);
		} finally {
			this.flushing = null;
		}
	}
	/** 一轮实际重建：杀 idle/spawning 条目，补池到目标容量。 */
	async runFlush() {
		if (this.stopped || this.deps.poolSize <= 0) return;
		const idleOrSpawning = this.entries.filter((e) => e.status === "idle" || e.status === "spawning");
		if (idleOrSpawning.length === 0) {
			this.log("info", "flush: no idle/spawning entries to flush");
			return;
		}
		this.log("info", `flush: killing ${idleOrSpawning.length} idle/spawning entries, will re-spawn`);
		for (const entry of idleOrSpawning) {
			entry.discarded = true;
			this.removeEntry(entry);
		}
		await Promise.all(idleOrSpawning.map((e) => this.terminateChild(e.child).catch(() => {})));
		this.replenishBackoffMs = 0;
		const currentIdleOrSpawning = this.entries.filter((e) => e.status === "idle" || e.status === "spawning").length;
		const toSpawn = Math.max(0, this.deps.poolSize - currentIdleOrSpawning);
		for (let i = 0; i < toSpawn; i++) this.spawnEntry().catch((err) => {
			this.log("warn", `flush re-spawn failed: ${String(err?.message ?? err)}`);
		});
	}
	/** daemon 退出时调用，杀光所有待命 + 已 activate 但仍由池跟踪的进程。 */
	async stop() {
		if (this.stopped) return;
		this.stopped = true;
		const snapshot = [...this.entries];
		this.entries.length = 0;
		this.bySession.clear();
		for (const entry of snapshot) {
			entry.discarded = true;
			this.clearHealthProbe(entry);
			this.clearIdleTtl(entry);
		}
		await Promise.all(snapshot.map((e) => this.terminateChild(e.child).catch(() => {})));
	}
	async doActivate(entry, opts) {
		const pid = entry.child.pid ?? 0;
		this.log("info", `doActivate (id=${entry.prewarmId}, pid=${pid}, sessionId=${opts.sessionId}, port=kernel-assigned, ${formatEnvCountForLog("deltaEnvCount", opts.env ?? {})})`);
		this.scheduleReplenish("post-acquire");
		let ready;
		try {
			ready = await this.sendActivate(entry.socketPath, {
				cwd: opts.cwd,
				args: opts.args,
				sessionId: opts.sessionId,
				ackMode: "ready",
				...this.deps.credentialProtectionBootstrap ? { credentialProtectionBootstrap: this.deps.credentialProtectionBootstrap } : {},
				...opts.env && Object.keys(opts.env).length > 0 ? { env: opts.env } : {}
			});
			validateActivateReadyResponse(ready, {
				expectedPid: pid,
				expectedSessionId: opts.sessionId
			});
		} catch (err) {
			this.removeEntry(entry);
			await this.terminateChild(entry.child).catch(() => {});
			this.scheduleReplenish("activate failure", { minDelayMs: this.deps.unexpectedExitBackoffMs ?? REPLENISH_BACKOFF_BASE_MS });
			throw err;
		}
		const acpEndpoint = String(ready.endpoint);
		entry.sessionId = opts.sessionId;
		entry.acpEndpoint = acpEndpoint;
		this.bySession.set(opts.sessionId, entry);
		return {
			pid,
			acpEndpoint,
			activateTimings: parseActivateTimings(ready.timings)
		};
	}
	async spawnEntry() {
		if (this.stopped) return;
		const prewarmId = `wb-pool-${Date.now()}-${(0, node_crypto.randomBytes)(3).toString("hex")}`;
		const socketPath = resolvePrewarmIpcPath(prewarmId);
		const args = [
			this.deps.cliPath,
			"--prewarm",
			"--prewarm-id",
			prewarmId
		];
		const spawnManagedEnv = {
			...this.deps.baselineEnvProvider?.() ?? this.deps.baselineEnv,
			...require_process_reap_utils.CLI_STATIC_MANAGED_ENV
		};
		applyCurrentProductConfigEnv(spawnManagedEnv);
		const env = require_process_reap_utils.buildCliProcessEnv(spawnManagedEnv);
		if (this.deps.credentialProtectionBootstrap) env.WORKBUDDY_AT_REST_ENCRYPTION = this.deps.credentialProtectionBootstrap.mode;
		const prewarmSocketDir = process.env[PREWARM_SOCKET_DIR_ENV]?.trim();
		if (prewarmSocketDir) env[PREWARM_SOCKET_DIR_ENV] = prewarmSocketDir;
		this.log("info", `spawning prewarm (id=${prewarmId})`);
		const child = (0, node_child_process.spawn)(this.deps.execPath, args, {
			detached: true,
			stdio: [
				"ignore",
				"ignore",
				"pipe"
			],
			windowsHide: true,
			env
		});
		const entry = {
			prewarmId,
			socketPath,
			child,
			status: "spawning",
			spawnManagedEnv: { ...spawnManagedEnv }
		};
		this.entries.push(entry);
		cliChildCrashWatcher?.(child);
		child.on("error", (err) => {
			if (entry.discarded) return;
			entry.discarded = true;
			const errMsg = err instanceof Error ? err.message : String(err);
			this.log("warn", `prewarm child error (id=${prewarmId}, pid=${child.pid ?? "unknown"}, status=${entry.status}): ${errMsg}`);
			this.removeEntry(entry);
			if (entry.sessionId) this.bySession.delete(entry.sessionId);
			if (entry.status !== "activated") this.scheduleReplenish("child error", { minDelayMs: this.deps.unexpectedExitBackoffMs ?? REPLENISH_BACKOFF_BASE_MS });
		});
		const stderrTail = [];
		child.stderr?.on("data", (data) => {
			const text = data.toString();
			for (const rawLine of text.split(/\r?\n/)) {
				if (!rawLine) continue;
				const line = rawLine.length > STDERR_TAIL_MAX_LINE_BYTES ? rawLine.slice(0, STDERR_TAIL_MAX_LINE_BYTES) + "…" : rawLine;
				stderrTail.push(line);
				if (stderrTail.length > STDERR_TAIL_MAX_LINES) stderrTail.shift();
			}
		});
		child.stderr?.on("error", () => {});
		child.on("exit", (code, signal) => {
			this.removeEntry(entry);
			if (entry.sessionId) this.bySession.delete(entry.sessionId);
			if (entry.discarded) return;
			if (entry.status !== "activated") {
				const tail = stderrTail.length > 0 ? ` | stderr tail:\n${stderrTail.join("\n")}` : "";
				this.log("warn", `prewarm entry exited before activate (id=${prewarmId}, code=${code}, signal=${signal ?? "none"})${tail}`);
				this.scheduleReplenish("unexpected exit", { minDelayMs: this.deps.unexpectedExitBackoffMs ?? REPLENISH_BACKOFF_BASE_MS });
			} else if (!this.stopped && !child.killed && ((code ?? 0) !== 0 || signal)) {
				const tail = stderrTail.length > 0 ? stderrTail.join("\n") : "<empty>";
				this.log("warn", `activated prewarm entry exited unexpectedly (id=${prewarmId}, pid=${child.pid ?? "unknown"}, sessionId=${entry.sessionId ?? "unknown"}, code=${code}, signal=${signal ?? "none"}) | stderr tail:\n${tail}`);
			}
		});
		if (!await this.waitSocketReady(socketPath)) {
			this.log("warn", `prewarm IPC not ready in time (id=${prewarmId})`);
			this.removeEntry(entry);
			await this.terminateChild(child).catch(() => {});
			return;
		}
		if (entry.status === "spawning") {
			entry.status = "idle";
			this.replenishBackoffMs = 0;
			this.log("info", `prewarm ready (id=${prewarmId})`);
			this.startHealthProbe(entry);
			this.startIdleTtl(entry);
		}
	}
	/**
	* 调度一次补池。
	*
	* 时延决策：
	* - 实际延迟 = max(replenishBackoffMs, opts.minDelayMs ?? 0)
	* - replenishBackoffMs：连续 spawn 失败的退避计数；上次成功后归 0
	* - minDelayMs：调用方指定的最小等待，意外退出路径用它强制至少等 10s
	*
	* 退避计数推进规则：只有在 **实际等过** 的调度上推进（delayMs > 0），
	* 普通 post-acquire 命中→立即补的路径不污染计数。一次 spawn 成功
	* （waitSocketReady 通过）即把计数归零。stopped 时直接放弃。
	*
	* 容量不变量：只有 idle/spawning entry 占用可领取池容量，activated entry
	* 已绑定会话、不计入 poolSize。每次调度和 timer 真正触发时都重新检查容量：
	* 前者避免同一失败路径重复排 timer/推进退避，后者合并多个并发 timer，
	* 保证最多只有 poolSize 个 idle/spawning replacement。
	*/
	scheduleReplenish(reason, opts) {
		if (!this.hasReplenishCapacity()) return;
		this.pendingReplenishments += 1;
		const minDelay = opts?.minDelayMs ?? 0;
		const delayMs = Math.max(this.replenishBackoffMs, minDelay);
		if (delayMs > 0) this.replenishBackoffMs = this.replenishBackoffMs === 0 ? REPLENISH_BACKOFF_BASE_MS : Math.min(this.replenishBackoffMs * 2, REPLENISH_BACKOFF_MAX_MS);
		const fire = () => {
			this.pendingReplenishments = Math.max(0, this.pendingReplenishments - 1);
			if (!this.hasReplenishCapacity()) return;
			this.spawnEntry().catch((err) => {
				this.log("warn", `replenish spawn failed (${reason}): ${String(err?.message ?? err)}`);
			});
		};
		if (delayMs <= 0) fire();
		else {
			this.log("warn", `replenish scheduled in ${delayMs}ms (${reason})`);
			setTimeout(fire, delayMs).unref?.();
		}
	}
	hasReplenishCapacity() {
		if (this.stopped || this.deps.poolSize <= 0) return false;
		return this.entries.filter((entry) => !entry.discarded && (entry.status === "idle" || entry.status === "spawning")).length + this.pendingReplenishments < this.deps.poolSize;
	}
	async sendActivate(socketPath, body) {
		const ackTimeoutMs = this.deps.activateReadyTimeoutMs ?? ACTIVATE_READY_TIMEOUT_MS;
		const connectTimeoutMs = this.deps.activateConnectTimeoutMs ?? IPC_TIMEOUT_MS;
		const abort = new AbortController();
		return new Promise((resolve, reject) => {
			let settled = false;
			const finishOuter = (fn) => {
				if (settled) return;
				settled = true;
				abort.abort();
				fn();
			};
			sendIpcLine(socketPath, {
				cmd: "activate",
				...body
			}, ackTimeoutMs, {
				connectTimeoutMs,
				signal: abort.signal,
				onWritten: () => {
					if (abort.signal.aborted) return;
					this.watchActivateIdleAfterWrite(socketPath, abort.signal).catch((err) => {
						finishOuter(() => reject(err instanceof Error ? err : new Error(String(err))));
					});
				}
			}).then((res) => finishOuter(() => resolve(res)), (err) => finishOuter(() => reject(err)));
		});
	}
	/**
	* activate 行 write 成功之后串行 ping：连续 ≥2 次读到 idle（间隔 ≥一次短 ping）
	* 视为从未进入 handleActivate，立即失败。进入 activating|active 后改为分级
	* 快失败：在 ACTIVATE_POST_ACTIVE_ACK_TIMEOUT_MS 内仍无 ready ACK 则抛错，
	* 由 sendActivate onWritten catch → doActivate 回收；ready ACK 先回时
	* abort signal 会让本循环退出，不空等。未进入 active 前 ping 超时/繁忙
	* 读不到 status 仍交给 ACK 主超时（#92847）。
	*/
	async watchActivateIdleAfterWrite(socketPath, signal) {
		const pingTimeoutMs = this.deps.activateIdleWatchdogTimeoutMs ?? IPC_TIMEOUT_MS;
		const postActiveAckTimeoutMs = this.deps.activatePostActiveAckTimeoutMs ?? ACTIVATE_POST_ACTIVE_ACK_TIMEOUT_MS;
		let consecutiveIdle = 0;
		let activeDeadline;
		while (!signal.aborted) {
			let status;
			try {
				status = (await sendIpcLine(socketPath, { cmd: "ping" }, pingTimeoutMs, { signal }))?.status;
			} catch {
				if (signal.aborted) return;
				if (activeDeadline !== void 0) {
					if (Date.now() >= activeDeadline) throw new Error(`prewarm activate ready ack timeout after active: ${socketPath}`);
					try {
						await delay(pingTimeoutMs, signal);
					} catch {
						return;
					}
					continue;
				}
				return;
			}
			if (signal.aborted) return;
			if (status === "activating" || status === "active") {
				if (activeDeadline === void 0) activeDeadline = Date.now() + postActiveAckTimeoutMs;
				if (Date.now() >= activeDeadline) throw new Error(`prewarm activate ready ack timeout after active: ${socketPath}`);
				try {
					await delay(pingTimeoutMs, signal);
				} catch {
					return;
				}
				continue;
			}
			if (status === "idle") {
				consecutiveIdle += 1;
				if (consecutiveIdle >= 2) throw new Error(`prewarm activate still idle after write: ${socketPath}`);
				try {
					await delay(pingTimeoutMs, signal);
				} catch {
					return;
				}
				continue;
			}
			return;
		}
	}
	/**
	* 用 ping 探活，每 PING_INTERVAL_MS 一轮，到 SOCKET_READY_TIMEOUT_MS 总超时。
	*
	* 任意一轮 ping 拿到 `ok: true` 即视为 ready，立即返回 true——首次 ping
	* 就过的快路径不会等满 ping 间隔。
	*
	* 失败语义：单次 ping 抛错（ENOENT/ECONNREFUSED/timeout）只算"还没 listen"，
	* 等 PING_INTERVAL_MS 后再试，直到总超时；总超时仍未 ok 才返回 false。
	*
	* 默认值按平台分档（见 SOCKET_READY_TIMEOUT_MS_*）；deps 可注入覆盖（仅
	* 单测用）。
	*/
	async waitSocketReady(socketPath) {
		const totalTimeoutMs = this.deps.socketReadyTimeoutMs ?? (process.platform === "win32" ? SOCKET_READY_TIMEOUT_MS_WIN : SOCKET_READY_TIMEOUT_MS_POSIX);
		const intervalMs = this.deps.socketReadyPingIntervalMs ?? PING_INTERVAL_MS;
		const deadline = Date.now() + totalTimeoutMs;
		do {
			try {
				const res = await sendIpcLine(socketPath, { cmd: "ping" }, IPC_TIMEOUT_MS);
				if (res && res.ok) return true;
			} catch {}
			const remainingMs = deadline - Date.now();
			if (remainingMs <= 0) break;
			await delay(Math.min(intervalMs, remainingMs));
		} while (Date.now() < deadline);
		return false;
	}
	removeEntry(entry) {
		this.clearHealthProbe(entry);
		this.clearIdleTtl(entry);
		const idx = this.entries.indexOf(entry);
		if (idx >= 0) this.entries.splice(idx, 1);
	}
	async terminateChild(child) {
		const pid = child?.pid;
		try {
			if (!child || child.killed || child.exitCode !== null) return;
			await new Promise((resolve) => {
				const timer = setTimeout(() => {
					try {
						child.kill("SIGKILL");
					} catch {}
					resolve();
				}, KILL_GRACEFUL_MS);
				timer.unref?.();
				child.once("exit", () => {
					clearTimeout(timer);
					resolve();
				});
				try {
					child.kill("SIGTERM");
				} catch {
					resolve();
				}
			});
		} finally {
			this.tryUnlinkPidFile(pid);
		}
	}
	/**
	* 按 pid 删除子进程写入的 pid 文件（`<sessionsDir>/<pid>.json`）。
	*
	* 使用 unlinkSync：文件本身极小且极少（poolSize=1 → 只有 1 个），同步删也
	* <1ms；换来的是 `stop()` 返回时磁盘状态已定，测试断言可靠。ENOENT / 权限
	* 错误一律忽略——文件已被子进程自清（POSIX 常见路径）或首次 stop 时压根
	* 没写成功，都不该阻塞退出流程。
	*
	* pid 校验（正整数）防御未来 spawn 失败前调用——ENOENT 就算了，`unlink(NaN)`
	* 会抛不同的错，不吞会污染诊断信号。
	*/
	tryUnlinkPidFile(pid) {
		if (!pid || !Number.isInteger(pid) || pid <= 0) return;
		const pidFile = (0, node_path.join)(this.resolveSessionsDir(), `${pid}.json`);
		try {
			(0, node_fs.unlinkSync)(pidFile);
		} catch {}
	}
	/**
	* 解析子进程 pid 文件所在的 sessions 目录。
	*
	* 优先级见 CliPrewarmPoolDependencies.sessionsDir 注释——与 `bin/wb-prewarm`
	* 完全一致，保证 daemon 侧 unlink 的路径与子进程 register 的路径匹配。
	*/
	resolveSessionsDir() {
		if (this.deps.sessionsDir) return this.deps.sessionsDir;
		const cbc = process.env.CODEBUDDY_CONFIG_DIR;
		const wb = process.env.WORKBUDDY_CONFIG_DIR;
		return (0, node_path.join)(cbc && cbc.trim() !== "" ? cbc : wb && wb.trim() !== "" ? wb : (0, node_path.join)((0, node_os.homedir)(), ".workbuddy"), "sessions");
	}
	log(level, msg) {
		(this.deps.logger ?? console)[level](`${TAG} ${msg}`);
	}
};
var PREWARM_ADDRESS_PREFIX = "codebuddy-prewarm-";
/**
* unix socket 落盘目录 env（与 agent-cli resolvePrewarmSocketDir 同构）。
* 默认 /tmp；设置后 socket 改落 `<dir>/codebuddy-prewarm-<id>.sock`。
* 池 spawn 子进程时以 `...process.env` 打底，此 env 天然透传给 prewarm 进程，
* 两侧路径一致，无需额外协调。
*/
var PREWARM_SOCKET_DIR_ENV = "CODEBUDDY_CODE_PREWARM_SOCKET_PATH";
function resolvePrewarmIpcPath(prewarmId) {
	const address = `${PREWARM_ADDRESS_PREFIX}${prewarmId}`;
	if (process.platform === "win32") return `\\\\.\\pipe\\${address}`;
	const custom = process.env[PREWARM_SOCKET_DIR_ENV];
	return (0, node_path.join)(custom && custom.trim() !== "" ? custom.trim() : "/tmp", `${address}.sock`);
}
/**
* 从 ready ACK 里安全解析 cbc 回传的 activate 阶段耗时。
*
* 纯诊断字段：非法/缺失一律返回 undefined，绝不抛错影响会话建立。cbc 侧字段可能
* 因版本不匹配（老 cbc 不带 timings）而缺席，需要容错。
*/
function parseActivateTimings(raw) {
	if (!raw || typeof raw !== "object") return;
	const t = raw;
	const num = (v) => typeof v === "number" && Number.isFinite(v) ? v : void 0;
	const totalMs = num(t.totalMs);
	const preDispatchMs = num(t.preDispatchMs);
	const dispatchMs = num(t.dispatchMs);
	if (totalMs === void 0 || preDispatchMs === void 0 || dispatchMs === void 0) return;
	return {
		totalMs,
		preDispatchMs,
		dispatchMs
	};
}
function validateActivateReadyResponse(response, expected) {
	if (response.ok !== true || response.cmd !== "activate" || response.status !== "active") throw new Error(`invalid prewarm activate ready ACK: ok=${String(response.ok)} cmd=${String(response.cmd)} status=${String(response.status)}`);
	if (response.pid !== expected.expectedPid) throw new Error(`prewarm activate ready ACK pid mismatch: expected=${expected.expectedPid} actual=${String(response.pid)}`);
	if (response.sessionId !== expected.expectedSessionId) throw new Error(`prewarm activate ready ACK session mismatch: expected=${expected.expectedSessionId} actual=${String(response.sessionId)}`);
	if (typeof response.endpoint !== "string") throw new Error("prewarm activate ready ACK is missing endpoint");
	let endpoint;
	try {
		endpoint = new URL(response.endpoint);
	} catch {
		throw new Error(`invalid prewarm activate ready ACK endpoint: ${response.endpoint}`);
	}
	const port = Number(endpoint.port);
	if (endpoint.protocol !== "http:" || endpoint.hostname !== "127.0.0.1" || !Number.isInteger(port) || port < 1 || port > 65535 || endpoint.pathname !== "/api/v1/acp" || endpoint.search || endpoint.hash) throw new Error(`invalid prewarm activate ready ACK endpoint: ${response.endpoint}`);
}
/** 写一行 JSON、读一行 JSON 响应、断开。超时按失败处理。 */
function sendIpcLine(socketPath, payload, timeoutMs, options) {
	return new Promise((resolve, reject) => {
		let buf = "";
		let settled = false;
		let connected = false;
		let timer;
		let connectTimer;
		const finish = (fn) => {
			if (settled) return;
			settled = true;
			try {
				sock.destroy();
			} catch {}
			if (timer) clearTimeout(timer);
			if (connectTimer) clearTimeout(connectTimer);
			options?.signal?.removeEventListener("abort", onAbort);
			fn();
		};
		const onAbort = () => {
			const reason = options?.signal?.reason;
			finish(() => reject(reason instanceof Error ? reason : /* @__PURE__ */ new Error(`prewarm IPC aborted: ${socketPath}`)));
		};
		const sock = (0, node_net.connect)(socketPath);
		if (options?.signal?.aborted) {
			onAbort();
			return;
		}
		options?.signal?.addEventListener("abort", onAbort, { once: true });
		if (options?.connectTimeoutMs != null) {
			connectTimer = setTimeout(() => {
				if (connected) return;
				finish(() => reject(/* @__PURE__ */ new Error(`prewarm IPC connect timeout: ${socketPath}`)));
			}, options.connectTimeoutMs);
			connectTimer.unref?.();
		} else {
			timer = setTimeout(() => finish(() => reject(/* @__PURE__ */ new Error(`prewarm IPC timeout: ${socketPath}`))), timeoutMs);
			timer.unref?.();
		}
		sock.once("connect", () => {
			connected = true;
			if (connectTimer) {
				clearTimeout(connectTimer);
				connectTimer = void 0;
			}
			if (options?.connectTimeoutMs != null && timer === void 0) {
				timer = setTimeout(() => finish(() => reject(/* @__PURE__ */ new Error(`prewarm IPC timeout: ${socketPath}`))), timeoutMs);
				timer.unref?.();
			}
			try {
				options?.onConnected?.();
			} catch (err) {
				finish(() => reject(err));
				return;
			}
			try {
				sock.write(JSON.stringify(payload) + "\n", (err) => {
					if (settled) return;
					if (err) {
						finish(() => reject(err));
						return;
					}
					try {
						options?.onWritten?.();
					} catch (cbErr) {
						finish(() => reject(cbErr));
					}
				});
			} catch (err) {
				finish(() => reject(err));
			}
		});
		sock.on("data", (chunk) => {
			buf += String(chunk);
			const nl = buf.indexOf("\n");
			if (nl >= 0) {
				const line = buf.slice(0, nl);
				try {
					const parsed = JSON.parse(line);
					finish(() => resolve(parsed));
				} catch (err) {
					finish(() => reject(err));
				}
			}
		});
		sock.on("error", (err) => finish(() => reject(err)));
		sock.on("close", () => finish(() => reject(/* @__PURE__ */ new Error(`prewarm IPC closed before response: ${socketPath}`))));
	});
}
function delay(ms, signal) {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(/* @__PURE__ */ new Error("aborted"));
			return;
		}
		const onAbort = () => {
			clearTimeout(t);
			reject(/* @__PURE__ */ new Error("aborted"));
		};
		const t = setTimeout(() => {
			signal?.removeEventListener("abort", onAbort);
			resolve();
		}, ms);
		t.unref?.();
		signal?.addEventListener("abort", onAbort, { once: true });
	});
}
//#endregion
Object.defineProperty(exports, "AGENT_TEAMS_ENV_KEY", {
	enumerable: true,
	get: function() {
		return AGENT_TEAMS_ENV_KEY;
	}
});
Object.defineProperty(exports, "CliPrewarmPool", {
	enumerable: true,
	get: function() {
		return CliPrewarmPool;
	}
});
Object.defineProperty(exports, "WORKBUDDY_HOST_CAPABILITIES_VALUE", {
	enumerable: true,
	get: function() {
		return WORKBUDDY_HOST_CAPABILITIES_VALUE;
	}
});
Object.defineProperty(exports, "bindCliChildCrashWatcher", {
	enumerable: true,
	get: function() {
		return bindCliChildCrashWatcher;
	}
});
Object.defineProperty(exports, "bindSidecarCrashWatcher", {
	enumerable: true,
	get: function() {
		return bindSidecarCrashWatcher;
	}
});
Object.defineProperty(exports, "buildAgentCliRuntimeEnv", {
	enumerable: true,
	get: function() {
		return buildAgentCliRuntimeEnv;
	}
});
Object.defineProperty(exports, "buildWorkbuddyCliEnv", {
	enumerable: true,
	get: function() {
		return buildWorkbuddyCliEnv;
	}
});
Object.defineProperty(exports, "createWorkbuddySidecarManager", {
	enumerable: true,
	get: function() {
		return createWorkbuddySidecarManager;
	}
});
Object.defineProperty(exports, "formatEnvCountForLog", {
	enumerable: true,
	get: function() {
		return formatEnvCountForLog;
	}
});
Object.defineProperty(exports, "getSharedWorkbuddySidecarManager", {
	enumerable: true,
	get: function() {
		return getSharedWorkbuddySidecarManager;
	}
});
Object.defineProperty(exports, "listAgentCliEnabledPluginDirs", {
	enumerable: true,
	get: function() {
		return listAgentCliEnabledPluginDirs;
	}
});
Object.defineProperty(exports, "listAgentCliManagedBinDirs", {
	enumerable: true,
	get: function() {
		return listAgentCliManagedBinDirs;
	}
});
Object.defineProperty(exports, "normalizeAgentCliBuiltinSkillsDir", {
	enumerable: true,
	get: function() {
		return normalizeAgentCliBuiltinSkillsDir;
	}
});
Object.defineProperty(exports, "readAgentCliAppConfigValue", {
	enumerable: true,
	get: function() {
		return readAgentCliAppConfigValue;
	}
});
Object.defineProperty(exports, "readAgentCliBundledRuntimeConfig", {
	enumerable: true,
	get: function() {
		return readAgentCliBundledRuntimeConfig;
	}
});
Object.defineProperty(exports, "resolveAgentCliConnectorBin", {
	enumerable: true,
	get: function() {
		return resolveAgentCliConnectorBin;
	}
});
Object.defineProperty(exports, "resolveAgentCliExecutablePath", {
	enumerable: true,
	get: function() {
		return resolveAgentCliExecutablePath;
	}
});
Object.defineProperty(exports, "resolveAgentCliPythonEnvBin", {
	enumerable: true,
	get: function() {
		return resolveAgentCliPythonEnvBin;
	}
});
Object.defineProperty(exports, "resolveAgentCliRuntimeDirs", {
	enumerable: true,
	get: function() {
		return resolveAgentCliRuntimeDirs;
	}
});
Object.defineProperty(exports, "resolveAgentTeamsEnv", {
	enumerable: true,
	get: function() {
		return resolveAgentTeamsEnv;
	}
});
