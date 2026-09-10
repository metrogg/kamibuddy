const require_chunk = require("./chunk.js");
const require_common$2 = require("./common.js");
const require_logger = require("./logger.js");
const require_proxy_agents = require("./proxy-agents.js");
const require_cli_product_env = require("./cli-product-env.js");
const require_workbuddy_product_config = require("./workbuddy-product-config.js");
const require_dev_env_override = require("./dev-env-override.js");
const require_workbuddy_paths = require("./workbuddy-paths.js");
const require_runtime_context = require("./runtime-context.js");
const require_client_info_env = require("./client-info-env.js");
const require_tls_verification = require("./tls-verification.js");
const require_tar$1 = require("./tar.js");
const require_adm_zip$1 = require("./adm-zip.js");
const require_gateway_secret = require("./gateway-secret.js");
const require_file_authentication_storage = require("./file-authentication-storage.js");
const require_module_base = require("./module-base.js");
let fs = require("fs");
fs = require_chunk.__toESM(fs);
let os = require("os");
os = require_chunk.__toESM(os);
let path = require("path");
path = require_chunk.__toESM(path);
let node_fs = require("node:fs");
node_fs = require_chunk.__toESM(node_fs);
let node_path = require("node:path");
node_path = require_chunk.__toESM(node_path);
let node_fs_promises = require("node:fs/promises");
node_fs_promises = require_chunk.__toESM(node_fs_promises);
let node_os = require("node:os");
let util = require("util");
let child_process = require("child_process");
let http = require("http");
http = require_chunk.__toESM(http);
let https = require("https");
https = require_chunk.__toESM(https);
let crypto = require("crypto");
crypto = require_chunk.__toESM(crypto);
let fs_promises = require("fs/promises");
fs_promises = require_chunk.__toESM(fs_promises);
let module$1 = require("module");
//#region ../../packages/workbuddy-server/src/expert/runtime/expert-plugin-runtime-utils.ts
var import_common$1 = require_common$2.require_common$1();
require_common$2.init_decorate();
var import_common = require_common$2.require_common();
require_common$2.init_decorateMetadata();
require_common$2.init_common$5();
require_common$2.init_common$4();
require_common$2.init_common$3();
require_common$2.init_common();
require_cli_product_env.init_cli_product_env();
var import_adm_zip = /* @__PURE__ */ require_chunk.__toESM(require_adm_zip$1.require_adm_zip());
var import_semver = /* @__PURE__ */ require_chunk.__toESM(require_client_info_env.require_semver());
require_client_info_env.init_src();
var import_dist = /* @__PURE__ */ require_chunk.__toESM(require_tar$1.require_dist());
var import_tar = /* @__PURE__ */ require_chunk.__toESM(require_tar$1.require_tar());
/** 异步判断路径是否存在 */
async function pathExists$3(p) {
	try {
		await fs_promises.access(p);
		return true;
	} catch {
		return false;
	}
}
//#endregion
//#region ../../packages/workbuddy-server/src/auth/external-link-authentication-provider.ts
var workbuddyAuthDevEnvProvider = {
	isOverrideEnabled: () => false,
	readDevEnv: () => void 0
};
function setWorkbuddyAuthDevEnvProvider(provider) {
	workbuddyAuthDevEnvProvider = provider;
}
var STAGING_SSO_DOMAIN_REWRITES = {
	"staging-sso.codebuddy.cn": "tencent.staging-sso.codebuddy.cn",
	"sso.copilot-staging.tencent.com": "tencent.sso.copilot-staging.tencent.com"
};
/** Prod → staging domain mapping for login URL fallback rewrite. */
var PROD_TO_STAGING_DOMAIN_REWRITES = {
	"www.codebuddy.cn": "staging.codebuddy.cn",
	"codebuddy.cn": "staging.codebuddy.cn",
	"copilot.tencent.com": "staging-copilot.tencent.com"
};
var WorkbuddyExternalLinkAuthenticationProvider = class WorkbuddyExternalLinkAuthenticationProvider extends require_common$2.ExternalLinkAuthenticationProvider {
	async support(ctx) {
		return (this.productManager.configuration.getValue()?.authentication?.type ?? require_file_authentication_storage.getWorkbuddyAuthenticationConfiguration()?.type) === require_common$2.AuthenticationType.CLI_EXTERNAL_LINK;
	}
	async openAuthUrl(authState) {
		if (workbuddyAuthDevEnvProvider.isOverrideEnabled() && workbuddyAuthDevEnvProvider.readDevEnv() === "staging") try {
			const url = new URL(authState.authUrl);
			const stagingDomain = PROD_TO_STAGING_DOMAIN_REWRITES[url.hostname];
			if (stagingDomain) {
				url.hostname = stagingDomain;
				authState = {
					...authState,
					authUrl: url.toString()
				};
			}
			const rewrittenSso = STAGING_SSO_DOMAIN_REWRITES[url.hostname];
			if (rewrittenSso) {
				url.hostname = rewrittenSso;
				authState = {
					...authState,
					authUrl: url.toString()
				};
			}
		} catch {}
		return super.openAuthUrl(authState);
	}
};
WorkbuddyExternalLinkAuthenticationProvider = require_common$2.__decorate([(0, import_common$1.Component)(require_common$2.AuthenticationProvider)], WorkbuddyExternalLinkAuthenticationProvider);
//#endregion
//#region ../../packages/workbuddy-server/src/auth/workbuddy-bootstrap-authentication-storage.ts
require_common$2.init_common();
require_common$2.init_common$3();
require_common$2.init_decorate();
var _ref$9;
var ACC_PRODUCT_CONFIG_ENV_KEYS = ["ACC_PRODUCT_CONFIG_V3", "ACC_PRODUCT_CONFIG_V2"];
var BOOTSTRAP_FILE_STORAGE_PRIORITY = require_common$2.AuthenticationStoragePriority.Heigh + 2;
var WorkbuddyBootstrapAuthenticationStorage = class WorkbuddyBootstrapAuthenticationStorage {
	get storeSessionSubject() {
		return this.fileAuthenticationStorage.storeSessionSubject;
	}
	async priority() {
		const authenticationType = this.getBootstrapAuthenticationType();
		if (!authenticationType || authenticationType === require_common$2.AuthenticationType.CUSTOM_TOKEN) return require_common$2.AuthenticationStoragePriority.Disabled;
		return BOOTSTRAP_FILE_STORAGE_PRIORITY;
	}
	async store(session, options) {
		await this.fileAuthenticationStorage.store(session, options);
	}
	async restore() {
		return this.fileAuthenticationStorage.restore();
	}
	async beginLogout() {
		return this.fileAuthenticationStorage.beginLogout();
	}
	async clean(options) {
		return this.fileAuthenticationStorage.clean(options);
	}
	getBootstrapAuthenticationType() {
		for (const key of ACC_PRODUCT_CONFIG_ENV_KEYS) {
			const value = require_cli_product_env.readAgentCliProductConfigJsonByKey(key);
			if (!value) continue;
			try {
				const config = JSON.parse(value);
				if (config.authentication?.type) return config.authentication.type;
			} catch {}
		}
	}
};
require_common$2.__decorate([(0, import_common$1.Autowired)(require_file_authentication_storage.FileAuthenticationStorage), require_common$2.__decorateMetadata("design:type", typeof (_ref$9 = typeof require_file_authentication_storage.FileAuthenticationStorage !== "undefined" && require_file_authentication_storage.FileAuthenticationStorage) === "function" ? _ref$9 : Object)], WorkbuddyBootstrapAuthenticationStorage.prototype, "fileAuthenticationStorage", void 0);
WorkbuddyBootstrapAuthenticationStorage = require_common$2.__decorate([(0, import_common$1.Component)(require_common$2.AuthenticationStorage)], WorkbuddyBootstrapAuthenticationStorage);
//#endregion
//#region ../../packages/workbuddy-server/src/auth/workbuddy-authentication-manager.ts
require_common$2.init_common();
require_common$2.init_decorate();
var workbuddyAuthSessionSyncer = () => void 0;
function setWorkbuddyAuthSessionSyncer(syncer) {
	workbuddyAuthSessionSyncer = syncer;
}
var WorkbuddyAuthenticationManager = class WorkbuddyAuthenticationManager extends require_common$2.AuthenticationManagerImpl {
	/**
	* 同身份重复触发（token 刷新风暴）的去重不在这一层做——desktop coordinator 的
	* syncResolvedProduct 会用它自己的 getRemoteRefreshKey + TTL 吸收重复触发，
	* 去重与它保护的 /v3/config 拉取保持在同一层，身份维度只维护一份。
	*/
	async syncProductAfterSessionChange(session) {
		if (!session) return;
		await workbuddyAuthSessionSyncer(session);
	}
};
WorkbuddyAuthenticationManager = require_common$2.__decorate([(0, import_common$1.Component)({
	id: require_common$2.AuthenticationManager,
	rebind: true
})], WorkbuddyAuthenticationManager);
//#endregion
//#region ../../packages/workbuddy-server/src/runtime/userinfo-provider.ts
/**
* WorkBuddy app-server UserinfoProvider implementation.
*
* Lets @genie/telemetry's UserinfoEventProcessor read the current account from
* AuthenticationManager so EventService.report() events carry user identity
* fields consistently with the bundled agent-cli process.
*/
require_common$2.init_common();
require_common$2.init_decorateMetadata();
require_common$2.init_decorate();
var _ref$8;
var WorkbuddyUserinfoProvider = class WorkbuddyUserinfoProvider {
	async provide() {
		const session = this.authenticationManager.currentSessionSubject.getValue();
		return {
			userId: session?.account.uid ?? "",
			userName: session?.account.nickname ?? "",
			userNickname: session?.account.nickname ?? "",
			enterpriseId: session?.account.enterpriseId,
			token: session?.auth.accessToken ?? "",
			enterprise: session?.account?.departmentFullName
		};
	}
};
require_common$2.__decorate([(0, import_common$1.Autowired)(require_common$2.AuthenticationManager), require_common$2.__decorateMetadata("design:type", typeof (_ref$8 = typeof require_common$2.AuthenticationManager !== "undefined" && require_common$2.AuthenticationManager) === "function" ? _ref$8 : Object)], WorkbuddyUserinfoProvider.prototype, "authenticationManager", void 0);
WorkbuddyUserinfoProvider = require_common$2.__decorate([(0, import_common$1.Component)({
	id: require_common$2.UserinfoProvider,
	rebind: true
})], WorkbuddyUserinfoProvider);
//#endregion
//#region ../../packages/workbuddy-server/src/connector/mcp-config.ts
var BUILTIN_ARDOT_MCP_SERVER_NAME = "ardot";
//#endregion
//#region ../../packages/workbuddy-server/src/ardot/config.ts
var ARDOT_ROOT_DOMAIN = "ardot.tencent.com";
/**
* dev 覆盖的 host 白名单：只认 `ardot.tencent.com` 及其子域。
*
* 这里刻意比 `isArdotHostUrl` 的子串匹配严格——`hostname.includes('ardot')`
* 会放行 `ardot.attacker.com` 这类攻击者可注册的域名，而覆盖条目会带着用户的
* Bearer 一起发过去。
*/
function isArdotOverrideHostAllowed(endpoint) {
	try {
		const { hostname } = new URL(endpoint);
		return hostname === ARDOT_ROOT_DOMAIN || hostname.endsWith(`.${ARDOT_ROOT_DOMAIN}`);
	} catch {
		return false;
	}
}
function isValidHttpUrl$1(endpoint) {
	try {
		const url = new URL(endpoint);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
}
function buildBuiltinArdotMcpConfig$1() {
	return {
		type: "http",
		url: "https://ardot.tencent.com/mcp",
		disabled: false,
		managedBy: "workbuddy-builtin",
		_workbuddyManagedAuth: "server-side"
	};
}
/**
* 用户在 `~/.workbuddy/mcp.json` 里对内置 Ardot MCP 的 dev 覆盖，用于把设计创意
* 会话整体切到测试 / staging Ardot 后端做验证走查（可配合 `x-frontend-branch` /
* `x-backend-branch` 头指定分支构建）。
*
* server key **必须**沿用 `ardot`：MCP App 的 appId 由 server 短名拼出
* （`McpAppCatalog`: `${serverId}/${originalName}`），换成 `ardot-test` 之类会让
* `ardot/create_design` / `ardot/open_design` 这两个被渲染层画布网关、Host
* bootstrap、制品生成链路硬编码的 appId 全部落空（画布直接打不开），同时丢掉
* `ConnectorMcpProxy.listAllTools` 里按短名 `ardot` 做的「仅 design 会话暴露」
* 隔离，测试工具会泄漏进代码 / 办公会话。
*
* 覆盖需要显式 `dev: true`，避免用户误写一条同名条目就把线上 Ardot 顶掉。
*
* URL host 必须落在 `ardot.tencent.com` 域内，这是这里唯一的安全边界：Ardot 走内置
* 白名单绕过了 MCP approval 流程，若不限制 host，一条 mcp.json 就能把设计会话的
* 全部 MCP 流量连同 Bearer token 导向任意第三方域名。Ardot 后端不提供本地部署，
* 因此不放行回环地址。
*/
function isValidArdotDevMcpServer(entry) {
	if (!entry || typeof entry !== "object") return false;
	const server = entry;
	if (server.dev !== true) return false;
	const url = typeof server.url === "string" ? server.url.trim() : "";
	if (url.length === 0 || !isValidHttpUrl$1(url)) return false;
	return isArdotOverrideHostAllowed(url);
}
/**
* 覆盖条目是否自带 Authorization —— 即「静态鉴权模式」。
*
* 命中时调用方必须让 `ArdotManager` 的影子账号链路整体让位：既不要把 managed
* token 写进 headerOverrides（`applyOverrides` 里 headerOverrides 在后 spread，
* 会盖掉用户手写的 Bearer），也不要拿 copilot 后端的授权状态去卡 design 会话的
* 发送门禁（那个状态与用户指定的 Ardot 环境无关）。
*/
function hasStaticArdotAuthHeader(entry) {
	if (!entry || typeof entry !== "object") return false;
	const headers = entry.headers;
	if (!headers || typeof headers !== "object") return false;
	return Object.entries(headers).some(([key, value]) => key.toLowerCase() === "authorization" && typeof value === "string" && value.trim().length > 0);
}
/**
* 把用户 dev 覆盖条目规整成内置 Ardot MCP 配置。
*
* 只挑取需要的字段（不整体 spread 用户条目），避免 `command` / `args` 等 stdio
* 字段混进来把 transport 带偏；`managedBy` 保持 `workbuddy-builtin` 让 UI 与
* desired-config 的白名单分支继续认得它。
*/
function buildArdotDevOverrideMcpConfig(entry) {
	const staticAuth = hasStaticArdotAuthHeader(entry);
	return {
		type: "http",
		url: entry.url.trim(),
		...entry.headers && Object.keys(entry.headers).length > 0 ? { headers: entry.headers } : {},
		...typeof entry.timeout === "number" ? { timeout: entry.timeout } : {},
		...Array.isArray(entry.disabledTools) ? { disabledTools: entry.disabledTools } : {},
		disabled: entry.disabled === true,
		managedBy: "workbuddy-builtin",
		...staticAuth ? {} : { _workbuddyManagedAuth: "server-side" }
	};
}
/** 把退出码格式化为 `0xXXXXXXXX`（大写 hex），用于日志。 */
function formatExitCodeHex(exitCode) {
	return `0x${(exitCode >>> 0).toString(16).toUpperCase()}`;
}
/**
* 面向用户/客服的退出码展示：
* - 大码（Windows NTSTATUS `0xCxxxxxxx` / DBG_TERMINATE 等 `>= 0x10000`）用 hex，
*   这是 Windows 退出码的习惯写法，客服凭 `0xC0000135` 直接可查。
* - 小码（Unix `126` / `127`、Windows `9009`）用十进制，符合命令行用户直觉，
*   `0x7F` 这种反而难认。
*/
function formatExitCodeForDisplay(exitCode) {
	const code = exitCode >>> 0;
	return code >= 65536 ? formatExitCodeHex(code) : String(exitCode);
}
/**
* 分类 CLI 子进程退出码。
*
* 命中即停：命令没找到 / 不可执行 / 被强制终止 / NTSTATUS 致命区间 → `startup-failed`；
* 其余算连接器执行出错。
*/
function classifyCliExit(exitCode) {
	const code = exitCode >>> 0;
	if (exitCode === 127 || exitCode === 126) return "startup-failed";
	if (code === 9009) return "startup-failed";
	if (code === 1073807364) return "startup-failed";
	if (code >= 3221225472 && code <= 3489660927) return "startup-failed";
	return "ran-with-error";
}
//#endregion
//#region ../../packages/workbuddy-server/src/connector/cli-skill/runtime-progress-notifier.ts
/**
* 连接器运行环境（Node.js / Python）准备进度通知器
*
* 职责：把 `binary-manager` 的进度回调 / 完成 / 失败事件转成 IPC 事件
* 推给 Renderer，由 Renderer 侧的 toast 订阅器展示「正在准备连接器运行环境」
* 系列提示。
*
* 设计要点：
* - **环境已就绪路径静默**：`binary-manager.ensure()` 直接命中缓存时不会
*   触发 onProgress，notifier 自然不会发事件，Renderer 不会弹 toast。
* - **节流**：同一 operation 至少间隔 500ms 或百分比变化 ≥ 5% 才发送进度事件，
*   避免 IPC 洪泛。首次 progress 立即发送。
* - **错误分类**：`classifyBinaryError` 将 `BinaryError` 归为 `network` / `generic`
*   两类，Renderer 据此选择对应文案。
*/
var IPC_CHANNEL = "binary:install-progress";
var THROTTLE_MS = 500;
var THROTTLE_PCT = 5;
/**
* 把未知错误归类为 Renderer 侧能直接选文案的 `network` / `generic`。
*
* - `BinaryError` 且属于网络/超时类 → `network`
* - 其他错误（解压、校验、磁盘空间、未知）→ `generic`
*/
function classifyBinaryError(err) {
	if (err instanceof require_client_info_env.BinaryError) return {
		code: [
			require_client_info_env.BinaryErrorCode.DOWNLOAD_FAILED,
			require_client_info_env.BinaryErrorCode.DOWNLOAD_TIMEOUT,
			require_client_info_env.BinaryErrorCode.NETWORK_ERROR
		].includes(err.code) ? "network" : "generic",
		message: err.message
	};
	if (err instanceof Error) return {
		code: "generic",
		message: err.message
	};
	return {
		code: "generic",
		message: String(err)
	};
}
/**
* 创建一个 runtime progress notifier。
*
* @param operationId 本次 ensure 操作的唯一 id
* @param type 运行环境类型（当前仅 node；预留 python）
* @param version 目标版本号（用于日志 / 调试）
*/
function createRuntimeProgressNotifier(operationId, type, version, deps = {}) {
	if (deps.silent) {
		const noop = () => {};
		return {
			onProgress: noop,
			preparing: noop,
			complete: noop,
			error: noop
		};
	}
	const send = deps.send ?? noopSend;
	const now = deps.now ?? Date.now;
	let lastSentAt = 0;
	let lastSentProgress = -1;
	let anyProgressSent = false;
	let terminated = false;
	const emit = (payload) => {
		send(IPC_CHANNEL, payload);
	};
	const onProgress = (task) => {
		if (terminated) return;
		const progress = Number.isFinite(task.progress) ? task.progress : void 0;
		const elapsed = now() - lastSentAt;
		const firstEvent = !anyProgressSent;
		const deltaPctOk = progress == null || lastSentProgress < 0 || Math.abs(progress - lastSentProgress) >= THROTTLE_PCT;
		if (!firstEvent && !deltaPctOk && !(elapsed >= THROTTLE_MS)) return;
		lastSentAt = now();
		if (progress != null) lastSentProgress = progress;
		anyProgressSent = true;
		emit({
			operationId,
			phase: "connector-prepare",
			type,
			version,
			status: "progress",
			progress
		});
	};
	/**
	* 发一个"准备中"事件（progress=undefined），用于"下载被 installLock 复用、
	* onProgress 不会被调用"场景下让 toast 先亮起来。幂等：重复调用只首次生效。
	*/
	const preparing = () => {
		if (terminated || anyProgressSent) return;
		lastSentAt = now();
		anyProgressSent = true;
		emit({
			operationId,
			phase: "connector-prepare",
			type,
			version,
			status: "progress",
			progress: void 0
		});
	};
	const complete = () => {
		if (terminated) return;
		terminated = true;
		if (!anyProgressSent) return;
		emit({
			operationId,
			phase: "connector-prepare",
			type,
			version,
			status: "complete"
		});
	};
	const error = (classified) => {
		if (terminated) return;
		terminated = true;
		emit({
			operationId,
			phase: "connector-prepare",
			type,
			version,
			status: "error",
			error: classified
		});
	};
	return {
		onProgress,
		preparing,
		complete,
		error
	};
}
function createConnectorInstallProgressNotifier(operationId, type, deps = {}) {
	if (deps.silent) {
		const noop = () => {};
		return {
			start: noop,
			complete: noop,
			error: noop
		};
	}
	const send = deps.send ?? noopSend;
	let started = false;
	let terminated = false;
	const emit = (payload) => {
		send(IPC_CHANNEL, payload);
	};
	const start = () => {
		if (terminated || started) return;
		started = true;
		emit({
			operationId,
			phase: "connector-install",
			type,
			version: "*",
			status: "progress"
		});
	};
	const complete = () => {
		if (terminated || !started) return;
		terminated = true;
		emit({
			operationId,
			phase: "connector-install",
			type,
			version: "*",
			status: "complete"
		});
	};
	const error = (classified) => {
		if (terminated) return;
		terminated = true;
		emit({
			operationId,
			phase: "connector-install",
			type,
			version: "*",
			status: "error",
			error: classified
		});
	};
	return {
		start,
		complete,
		error
	};
}
function noopSend() {}
//#endregion
//#region ../../packages/workbuddy-server/src/connector/cli-skill/connector-node-runtime-env.ts
/** WorkBuddy 默认 npm registry fallback 列表（按优先级排序） */
var DEFAULT_NPM_REGISTRIES = [
	"https://mirrors.tencent.com/npm/",
	"https://registry.npmmirror.com/",
	"https://repo.huaweicloud.com/repository/npm/",
	"https://registry.npmjs.org/"
];
/**
* Connector 全局 npm 包目录（与 binary-manager 的 Node 托管目录同级，跨 Node
* 版本复用，避免升级 Node 后丢包）。`npm install -g` 写到这里，CLI / npx 通过
* PATH 前置可见。
*/
var CLI_CONNECTOR_PACKAGES_DIR = (0, path.join)((0, os.homedir)(), ".workbuddy", "binaries", "node", "cli-connector-packages");
/** Connector 专属 npm cache，与用户 ~/.npm 隔离 */
var CLI_CONNECTOR_NPM_CACHE_DIR = (0, path.join)((0, os.homedir)(), ".workbuddy", "binaries", "node", "cli-connector-cache");
function prependRuntimePath$1(env, paths) {
	const isWindows = (0, os.platform)() === "win32";
	const pathKeys = Object.keys(env).filter((key) => key.toLowerCase() === "path");
	const pathKey = isWindows ? [...pathKeys].sort()[0] ?? "Path" : "PATH";
	const existingSegments = (isWindows ? pathKeys : [pathKey]).flatMap((key) => (env[key] ?? "").split(path.delimiter));
	if (isWindows) {
		for (const key of pathKeys) if (key !== pathKey) delete env[key];
	}
	env[pathKey] = dedupePathSegments$1([...paths, ...existingSegments], isWindows).join(path.delimiter);
}
function dedupePathSegments$1(paths, isWindows) {
	const seen = /* @__PURE__ */ new Set();
	const result = [];
	for (const pathSegment of paths) {
		if (!pathSegment) continue;
		const key = normalizePathSegment$1(pathSegment, isWindows);
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(pathSegment);
	}
	return result;
}
function normalizePathSegment$1(pathSegment, isWindows) {
	const normalized = pathSegment.replace(/[\\/]+$/, "");
	return isWindows ? normalized.toLowerCase() : normalized;
}
/**
* 在传入的 env 上原地注入 Node runtime 相关变量：
*
* - `PATH` 前置 `<cli-connector-packages/bin>:<npmGlobalBin>:<nodeBinDir>:<原 PATH>`
* - Windows 下合并并去除 `PATH` / `Path` 重复 key，避免子进程拿到未注入的旧 PATH
* - `npm_config_registry` / `npm_config_prefix` / `npm_config_cache`
* - HTTPS_PROXY 时给 npm 子进程加 `--use-system-ca`（Node>=20.12）或 `npm_config_strict_ssl=false`
*
* 不包含 `binaryManager.ensure()` 调用，由调用方负责（见 prepareNodeRuntimeEnv）。
*/
function applyNodeRuntimeEnv(env, runtime) {
	const { nodeInfo, nodeBinDir, npmGlobalBin, registry } = runtime;
	prependRuntimePath$1(env, [
		(0, path.join)(CLI_CONNECTOR_PACKAGES_DIR, "bin"),
		npmGlobalBin,
		nodeBinDir
	]);
	env.npm_config_registry = registry;
	env.npm_config_prefix = CLI_CONNECTOR_PACKAGES_DIR;
	env.npm_config_cache = CLI_CONNECTOR_NPM_CACHE_DIR;
	if (env.HTTPS_PROXY && !(env.NODE_OPTIONS || "").includes("--use-system-ca")) {
		const [major, minor] = nodeInfo.version.split(".").map(Number);
		if (major > 20 || major === 20 && minor >= 12) env.NODE_OPTIONS = ((env.NODE_OPTIONS || "") + " --use-system-ca").trim();
		else env.npm_config_strict_ssl = "false";
	}
}
/**
* 调 binary-manager.ensure 准备 Node，并返回组装 env 需要的路径信息。
*
* 调用方拿到结果后，可以选择：
* - 自己 spread 到子进程 env（stdio MCP 路径）
* - 直接调用 `applyNodeRuntimeEnv(env, result)` 在 env 上原地写（CLI 路径）
*
* 失败时直接抛错，调用方应当 catch 后给用户反馈。binary-manager 缺失场景
* 由调用方处理（不要在 helper 里静默兜底，CLI / stdio 对兜底语义不一定一致）。
*/
async function prepareNodeRuntimeEnv(binaryManager, requirement, logger, options = {}) {
	const versionRange = requirement.versionRange ?? "*";
	const notifier = createRuntimeProgressNotifier(options.operationId ?? (0, crypto.randomUUID)(), "node", versionRange, {
		silent: options.silent === true,
		send: options.send
	});
	if (binaryManager.isInstallingType("node")) notifier.preparing();
	let nodeInfo;
	try {
		nodeInfo = await binaryManager.ensure({
			type: "node",
			versionRange
		}, { onProgress: notifier.onProgress });
		notifier.complete();
	} catch (err) {
		notifier.error(classifyBinaryError(err));
		throw err;
	}
	const npmGlobalBin = (0, os.platform)() === "win32" ? CLI_CONNECTOR_PACKAGES_DIR : (0, path.join)(CLI_CONNECTOR_PACKAGES_DIR, "bin");
	const nodeBinDir = (0, path.join)(nodeInfo.executablePath, "..");
	const registry = requirement.registry ?? DEFAULT_NPM_REGISTRIES[0];
	const managedTag = nodeInfo.source === "managed" ? "[MANAGED-HIT] " : "";
	logger.info(`${managedTag}[NodeRuntimeEnv] Node runtime: source=${nodeInfo.source} version=${nodeInfo.version} node=${nodeInfo.executablePath} prefix=${CLI_CONNECTOR_PACKAGES_DIR} registry=${registry}`);
	return {
		nodeInfo: {
			type: nodeInfo.type,
			version: nodeInfo.version,
			source: nodeInfo.source,
			executablePath: nodeInfo.executablePath
		},
		nodeBinDir,
		npmGlobalBin,
		registry
	};
}
/**
* 清掉 NODE_OPTIONS 里的调试 flag（--inspect 会让 stdio 子进程把 inspector
* URL 当业务输出，CLI auth 命令把 URL 误判成授权链接）。保留 --use-system-ca
* 等安全/网络相关选项。
*/
function stripDebugNodeOptions(env) {
	env.NODE_OPTIONS = (env.NODE_OPTIONS || "").replace(/--inspect(-brk)?(=\S+)?|--debug(=\S+)?/g, "").trim() || void 0;
	delete env.NODE_DEBUG;
}
//#endregion
//#region ../../packages/workbuddy-server/src/connector/connector-locale.ts
/**
* 连接器界面语言判定（与 menu-i18n.ts::getMenuLocale 共用一套优先级链）
*
* 用作 `connector-service.ts` 决定 connector name / description 字段
* 中英文取值的唯一入口。抽成独立模块的目的：
*   - 让逻辑可被单测覆盖（不依赖 ConnectorService 内部状态）
*   - 与 `menu-i18n.ts` 同形，方便日后两处合并到同一份 helper
*
* 优先级：
*   1. 持久化配置 ~/.workbuddy/app/app-config.json#locale
*      （由 daemon AppConfigService 写入，renderer 不需要给 getConfigs 传 locale）
*   2. product 配置默认语言（国内 product 默认中文，海外 product 默认英文）
*   3. 兜底：runtime locale / 系统语言
*
* endpoint / productName 等 product 细节只在 caller 显式解析成 product locale 后传入；
* 本模块不直接猜测 product 结构，避免启动早期空配置被错判为英文（Issue #41817）。
*/
function defaultGetProductIsOversea() {}
function defaultGetProductLocale() {}
function defaultGetSystemLocale() {
	return require_runtime_context.getWorkbuddyRuntimeLocale();
}
function readPersistedLocale(configDir) {
	try {
		const configPath = (0, node_path.join)(configDir, "app", "app-config.json");
		if (!(0, node_fs.existsSync)(configPath)) return;
		const raw = JSON.parse((0, node_fs.readFileSync)(configPath, "utf-8"));
		return typeof raw?.locale === "string" ? raw.locale : void 0;
	} catch {
		return;
	}
}
/**
* 判断当前是否应使用英文显示连接器 name / description。
* 详细优先级见文件头注释。
*/
function isEnglishConnectorLocale(deps) {
	const getProductIsOversea = deps.getProductIsOversea ?? defaultGetProductIsOversea;
	const getProductLocale = deps.getProductLocale ?? defaultGetProductLocale;
	const getSystemLocale = deps.getSystemLocale ?? defaultGetSystemLocale;
	const persistedLocale = readPersistedLocale(deps.configDir);
	if (persistedLocale) return !persistedLocale.toLowerCase().startsWith("zh");
	const productLocale = getProductLocale();
	if (productLocale) return !productLocale.toLowerCase().startsWith("zh");
	const productIsOversea = getProductIsOversea();
	if (productIsOversea === true) return true;
	if (productIsOversea === false) return false;
	return !getSystemLocale().toLowerCase().startsWith("zh");
}
//#endregion
//#region ../../packages/workbuddy-server/src/connector/connector-server-side-oauth-refresher.ts
/** 提前刷新窗口（秒）：token 过期前多久开始刷 */
var REFRESH_BUFFER_SECONDS = 300;
/** 兜底刷新间隔（毫秒）：云端不返回 expires_in 时用 */
var FALLBACK_REFRESH_INTERVAL_MS = 1200 * 1e3;
/** 临时失败重试间隔（毫秒） */
var TRANSIENT_RETRY_INTERVAL_MS = 60 * 1e3;
/** setTimeout 最大安全值（32 位有符号整数上限，约 24.8 天） */
var MAX_SAFE_TIMEOUT_MS = 2147483647;
/** /accesstoken 响应中代表"不可恢复失败"的 HTTP 状态码（云端已清 Redis token） */
var TERMINAL_FAILURE_CODES = new Set([
	401,
	403,
	422
]);
/**
* /accesstoken 响应中代表「云端明确告知无 token / 需要重新授权」的业务错误码。
*
* - 10101: access token not found（云端 Redis 没 refresh_token，或已被 /revoke 清掉）
*
* 命中这些码时 refresher 必须 stop + disconnect，否则会无限次试图刷一个永远不存在的 token。
*/
var TERMINAL_BUSINESS_CODES = new Set([10101]);
var ConnectorServerSideOauthRefresher = class {
	constructor(getApiDeps, callbacks, logger) {
		this.getApiDeps = getApiDeps;
		this.callbacks = callbacks;
		this.logger = logger;
		this.entries = /* @__PURE__ */ new Map();
	}
	/**
	* 启动一个 connector 的刷新任务。
	*
	* 立即刷一次，之后按响应中的 expires_in 精确调度下一次。重复 schedule 会取消旧任务。
	*/
	schedule(configId, connectorName, options) {
		this.stop(configId);
		const entry = {
			configId,
			connectorName,
			timer: null
		};
		this.entries.set(configId, entry);
		this.logger?.info(`[ServerSideOauthRefresher] scheduled ${configId} (name=${connectorName})`);
		if (options?.initialAccessToken) {
			this.applyAccessToken(configId, connectorName, options.initialAccessToken).catch((err) => {
				this.logger?.warn(`[ServerSideOauthRefresher] apply initial token failed ${configId}: ${err?.message ?? err}`);
			}).finally(() => {
				const delayMs = this.computeNextDelay(options.initialExpiresIn);
				this.logger?.info(`[ServerSideOauthRefresher] scheduled ${configId} with initial token, next in ${delayMs}ms`);
				this.scheduleNextTimer(configId, connectorName, delayMs);
			});
			return;
		}
		this.refresh(configId, connectorName).catch((err) => {
			this.logger?.warn(`[ServerSideOauthRefresher] immediate refresh failed ${configId}: ${err?.message ?? err}`);
		});
	}
	/** 取消一个 connector 的刷新任务 */
	stop(configId) {
		const entry = this.entries.get(configId);
		if (!entry) return;
		if (entry.timer) clearTimeout(entry.timer);
		this.entries.delete(configId);
		this.logger?.info(`[ServerSideOauthRefresher] stopped ${configId}`);
	}
	/** 全部取消 */
	stopAll() {
		for (const entry of this.entries.values()) if (entry.timer) clearTimeout(entry.timer);
		this.entries.clear();
	}
	/** 是否已 schedule */
	isScheduled(configId) {
		return this.entries.has(configId);
	}
	/**
	* 单次尝试拿 token（不 schedule、不写磁盘、不触碰 entries），供 connectSkillOnly 同步使用。
	*
	* 用途：skill-only connector 的连接成功必须以"云端能给出 access_token"为前提，
	* 否则 skill 脚本后续无法获取 access_token，connector 形同废物。
	*
	* 返回值：
	* - ok=true：拿到 token
	* - ok=false + needsAuthorize=true：云端明确无 token（10101 / 401 / 403 / 422），需要走 /start 重新授权
	* - ok=false + needsAuthorize=false：网络或其他临时错误
	* - ok=false + errorKind='subject_not_found'：OneID 用户未同步，error 已是人性化文案
	*/
	async tryFetchToken(connectorName) {
		let resp;
		try {
			const apiDeps = await this.getApiDeps();
			resp = await require_tar$1.callConnectorOauthApi("GET", `/v2/as/connector/oauth/${connectorName}/accesstoken`, apiDeps);
		} catch (error) {
			return {
				ok: false,
				needsAuthorize: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
		if (resp?.code === 0 && resp?.data?.access_token) return {
			ok: true,
			token: resp.data.access_token,
			expiresIn: this.extractExpiresIn(resp.data)
		};
		const code = typeof resp?.code === "number" ? resp.code : -1;
		const msg = resp?.msg ?? "unknown";
		const needsAuthorize = TERMINAL_FAILURE_CODES.has(code) || TERMINAL_BUSINESS_CODES.has(code);
		const oneidError = require_tar$1.parseOneidTokenError(resp);
		const error = oneidError ? oneidError.userHint : `code=${code} msg=${msg}`;
		if (oneidError) this.logger?.warn(`[ServerSideOauthRefresher] tryFetchToken OneID error: ${oneidError.rawMessage}`);
		return {
			ok: false,
			needsAuthorize,
			error,
			errorKind: oneidError?.kind
		};
	}
	/**
	* 执行一次 refresh。
	*
	* 公开此方法是因为 ConnectorService 在 connect 成功后可能希望显式触发一次。
	*/
	async refresh(configId, connectorName) {
		if (!this.entries.has(configId)) return;
		let resp;
		try {
			const apiDeps = await this.getApiDeps();
			resp = await require_tar$1.callConnectorOauthApi("GET", `/v2/as/connector/oauth/${connectorName}/accesstoken`, apiDeps);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger?.warn(`[ServerSideOauthRefresher] refresh(${configId}) threw: ${message}, retry in ${TRANSIENT_RETRY_INTERVAL_MS}ms`);
			this.scheduleNextTimer(configId, connectorName, TRANSIENT_RETRY_INTERVAL_MS);
			return;
		}
		if (resp?.code === 0 && resp?.data?.access_token) {
			const accessToken = resp.data.access_token;
			await this.applyAccessToken(configId, connectorName, accessToken);
			const expiresIn = this.extractExpiresIn(resp.data);
			const delayMs = this.computeNextDelay(expiresIn);
			this.logger?.info(`[ServerSideOauthRefresher] refresh(${configId}) ok, expires_in=${expiresIn ?? "unknown"}, next in ${delayMs}ms`);
			this.scheduleNextTimer(configId, connectorName, delayMs);
			return;
		}
		const code = typeof resp?.code === "number" ? resp.code : -1;
		const msg = resp?.msg ?? "unknown";
		if (TERMINAL_FAILURE_CODES.has(code) || TERMINAL_BUSINESS_CODES.has(code)) {
			const errorMsg = `code=${code} msg=${msg}`;
			this.logger?.warn(`[ServerSideOauthRefresher] refresh(${configId}) terminal failure ${errorMsg}, marking unauthorized`);
			this.stop(configId);
			if (this.callbacks.markUnauthorized) this.callbacks.markUnauthorized(configId, errorMsg);
			else try {
				await this.callbacks.disconnect(configId);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				this.logger?.warn(`[ServerSideOauthRefresher] refresh(${configId}) disconnect on terminal failure threw: ${message}`);
			}
			return;
		}
		this.logger?.warn(`[ServerSideOauthRefresher] refresh(${configId}) transient failure code=${code} msg=${msg}, retry in ${TRANSIENT_RETRY_INTERVAL_MS}ms`);
		this.scheduleNextTimer(configId, connectorName, TRANSIENT_RETRY_INTERVAL_MS);
	}
	async applyAccessToken(configId, connectorName, accessToken) {
		let tokenHeaders;
		let headersApplied = false;
		try {
			tokenHeaders = this.callbacks.buildTokenHeaders ? this.callbacks.buildTokenHeaders(configId, connectorName, accessToken) : { Authorization: `Bearer ${accessToken}` };
			const result = await this.callbacks.updateHeaders(configId, tokenHeaders, true);
			if (!result.success) this.logger?.warn(`[ServerSideOauthRefresher] applyAccessToken(${configId}) updateHeaders failed: ${result.error}`);
			else headersApplied = true;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger?.warn(`[ServerSideOauthRefresher] applyAccessToken(${configId}) updateHeaders threw: ${message}`);
		}
		if (headersApplied && tokenHeaders && this.callbacks.onTokenApplied) try {
			await this.callbacks.onTokenApplied(configId, connectorName, tokenHeaders);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger?.warn(`[ServerSideOauthRefresher] applyAccessToken(${configId}) onTokenApplied threw: ${message}`);
		}
	}
	/**
	* 从 /accesstoken 响应 data 中提取 expires_in（秒）。
	* 兼容几种可能的字段名。
	*/
	extractExpiresIn(data) {
		if (typeof data?.expires_in === "number" && data.expires_in > 0) return data.expires_in;
		if (typeof data?.expiresIn === "number" && data.expiresIn > 0) return data.expiresIn;
		if (typeof data?.expires_at === "number" && data.expires_at > 0) {
			const nowSec = Math.floor(Date.now() / 1e3);
			const remaining = data.expires_at - nowSec;
			return remaining > 0 ? remaining : void 0;
		}
	}
	/**
	* 根据 expires_in 计算下次刷新的 delay（毫秒）。
	* - 有 expires_in：提前 REFRESH_BUFFER_SECONDS 刷新，最小 0（立即）
	* - 无 expires_in：用兜底 interval
	* - clamp 到 setTimeout 最大安全值
	*/
	computeNextDelay(expiresInSec) {
		if (expiresInSec === void 0) return FALLBACK_REFRESH_INTERVAL_MS;
		const delayMs = Math.max(0, expiresInSec - REFRESH_BUFFER_SECONDS) * 1e3;
		return Math.min(delayMs, MAX_SAFE_TIMEOUT_MS);
	}
	/** 设置下一次 refresh timer（会替换掉旧的） */
	scheduleNextTimer(configId, connectorName, delayMs) {
		const entry = this.entries.get(configId);
		if (!entry) return;
		if (entry.timer) clearTimeout(entry.timer);
		entry.timer = setTimeout(() => {
			entry.timer = null;
			this.refresh(configId, connectorName).catch((err) => {
				this.logger?.warn(`[ServerSideOauthRefresher] scheduled refresh failed ${configId}: ${err?.message ?? err}`);
			});
		}, delayMs);
	}
};
//#endregion
//#region ../../packages/workbuddy-server/src/connector/connector-states-persistence.ts
/**
* connector-states 的加密持久化层。
*
* ## 最终文件与内容版本（connector 状态收拢重构）
*
* 最终只保留一个状态文件：
*
*   `<configDir>/connectors/<uid>/connector-states.json`
*
* 文件名不携带版本；内容使用 `version` 字段选择 codec（当前 version=4）。
* 文件继续采用 AES-256-GCM 字段级加密（headerOverrides / envOverrides 的每个 value），
* **不能恢复为旧版明文存储**（TSRC #102305 / issue #48593 修复的口径不回退）。
*
* v4 持久化的连接器生命周期状态只有两个布尔：
*
*   connectors[id] = { bound, enabled }
*
*   - `bound`   connect 完整成功后为 true，只有 unbind 完整成功才清 false
*   - `enabled` 用户开关意图；授权/网络异常不得自动改 false
*   - 约束：`bound=false => enabled=false`（读取到非法组合时归一化并记录诊断）
*
* `connected` / `reason` / `everConnected` / `userEnabled|userDisabled` 一律不落盘。
*
* ## 迁移（v3 / legacy → v4）
*
* 迁移源（读到后一次性升级）：
*   1. `connector-states.v3.json`（上一代加密文件）：存在时为**最高优先级权威源**。
*      解密 → 迁移为 v4 → 临时文件 + rename 原子写 `connector-states.json` → 回读校验
*      → 校验通过才删除 v3 文件。
*   2. 旧明文 `connector-states.json`（无 version=4/encryption 头）：读 legacy 后原子
*      替换为同名加密 v4 文件。
*   迁移失败保留旧文件，不写空状态覆盖；不双写两个状态文件。
*
* 字段映射（见 plan §7.2）：
*   enabled: userDisabled[id] 存在 ? !userDisabled[id] : legacy.enabled.includes(id)
*   bound  : enabled || everConnected.includes(id) || 存在 header/env/OAuth/CLI 授权证据
*   !bound 时归一化 enabled=false；无任何成功接入证据 → 不落条目（默认 false/false）。
*   `everConnected` 只在迁移时帮助识别"曾成功接入"，迁移后删除。
*
* ## 复用的加密基建（与 .credentials.v3.json 同一套密钥）
*
*   - OAuthCipher                 : AES-256-GCM 字段级加解密
*   - ConnectorOAuthMasterKeyStore: 双备份 master.key（同 userId 同目录，零额外密钥管理）
*   - connector-oauth-acl         : 文件 / 目录 ACL enforce + verify + repair
*
* 未登录态（cipher 不可用）→ **跳过持久化**（不写任何文件），与 OAuth store
* 的"匿名态拒写"口径一致。登录后首次 load 触发迁移/写入。
*
* ## 读路径 cipher 不可用的两种成因（必须分开处理）
*
*   - master.key primary/backup 都不在 → 密钥永久消失，旧密文再也解不开。
*     降级：丢弃敏感字段、保留生命周期，允许下次写入用新 key 重建加密头。
*   - master.key 文件还在、只是这一轮读不出来 → 密文仍可恢复。抛
*     {@link ConnectorStatesUnreadableError} 拒读，上层据此禁写，下次启动重试。
*     绝不能让瞬时抖动把空凭据盖到密文上（v3 迁移路径还会 purge v3 源文件）。
*
* 安全模型同 connector-oauth-cipher.ts：防文件级跨机泄漏，不防同机同用户态恶意进程。
*/
var FILE_MODE = 384;
/** 最终状态文件名（内容为 version=4 加密 codec）。 */
var STATES_FILE_NAME = "connector-states.json";
/** 上一代加密文件名，仅作只读迁移源（最高优先级）。 */
var STATES_V3_FILE_NAME = "connector-states.v3.json";
/** headerOverrides 字段在 AAD 中的 serverKey 前缀 */
var AAD_SCOPE_HEADER = "connector-states:headerOverrides";
/** envOverrides 字段在 AAD 中的 serverKey 前缀 */
var AAD_SCOPE_ENV = "connector-states:envOverrides";
/** 由 storageDir 推导出标准路径 */
function resolveStatesFilePaths(storageDir, masterKeyBackupBaseDir) {
	return {
		storageDir,
		statesPath: (0, path.join)(storageDir, STATES_FILE_NAME),
		v3Path: (0, path.join)(storageDir, STATES_V3_FILE_NAME),
		masterKeyBackupBaseDir
	};
}
function isAnonymousUser(userId) {
	return !userId || userId === "default";
}
/** 读取路径上的不可恢复失败：调用方必须阻止后续写盘，避免用空状态覆盖用户数据。 */
var ConnectorStatesUnreadableError = class extends Error {
	constructor(message, cause) {
		super(message);
		this.cause = cause;
		this.name = "ConnectorStatesUnreadableError";
	}
};
/**
* v3/legacy 状态 → v4 生命周期映射。
*
* ```text
* userDisabled[id]=true                    -> enabled=false
* userDisabled[id]=false                   -> enabled=true
* enabled[] 含 id                          -> enabled=true
* enabled=true                             -> bound=true
* everConnected 含 id                      -> bound=true
* 存在 header/env/OAuth/CLI 授权证据        -> bound=true
* 无任何成功接入证据                        -> 不落条目（bound=false, enabled=false）
* ```
*/
function migrateLegacyConnectorStates(legacy, hasAuthEvidence) {
	const enabledList = coerceStringArray(legacy.enabled);
	const everConnected = new Set(coerceStringArray(legacy.everConnected));
	const userDisabled = coerceUserDisabledMap(legacy.userDisabled);
	const headerOverrides = coercePlainMap(legacy.headerOverrides);
	const envOverrides = coercePlainMap(legacy.envOverrides);
	const ids = new Set([
		...enabledList,
		...Object.keys(userDisabled),
		...everConnected,
		...Object.keys(headerOverrides),
		...Object.keys(envOverrides)
	]);
	const connectors = {};
	for (const id of ids) {
		const enabled = id in userDisabled ? !userDisabled[id] : enabledList.includes(id);
		const hasOverrideEvidence = Object.keys(headerOverrides[id] ?? {}).length > 0 || Object.keys(envOverrides[id] ?? {}).length > 0;
		if (!(enabled || everConnected.has(id) || hasOverrideEvidence || safeAuthEvidence(hasAuthEvidence, id))) continue;
		connectors[id] = {
			bound: true,
			enabled
		};
	}
	return {
		connectors,
		headerOverrides,
		envOverrides,
		disabledToolsOverrides: normalizeOptionalStringArrayMap(legacy.disabledToolsOverrides),
		pluginMcpDisabledOverrides: normalizeOptionalBooleanMap(legacy.pluginMcpDisabledOverrides),
		accountIdentityKey: legacy.accountIdentityKey,
		headerOverridesBearerStripped: legacy.headerOverridesBearerStripped,
		staleManagedAuthHeadersPurged: legacy.staleManagedAuthHeadersPurged,
		mcpSecurityMigrated: legacy.mcpSecurityMigrated
	};
}
function safeAuthEvidence(hasAuthEvidence, id) {
	if (!hasAuthEvidence) return false;
	try {
		return hasAuthEvidence(id) === true;
	} catch {
		return false;
	}
}
/**
* 读 connector-states 状态。
*
* 顺序：
*   1. 匿名态（userId='default'）→ 直接 return undefined，完全不碰磁盘。
*      登录前 connector 本就用不了；且 connectors/default/ 可能残留加密改造前
*      的历史明文凭据，匿名态绝不读取，避免把它们带回内存（CWE-312 纵深防御）。
*   2. v3 文件存在 → 最高优先级权威源：解密 → 迁移 v4 → 原子写最终文件 →
*      回读校验通过才删 v3；写入/校验失败保留 v3，仅返回内存态（下次启动重试）。
*   3. 最终文件存在：
*      - version=4 → 解密返回（顺手清理理应已删除的 v3 残留由写路径负责）。
*      - 旧明文（无 version=4 头）→ 迁移 v4 后原子替换同名文件。
*   4. 都不存在 → undefined。
*
* 文件存在但不可解析（JSON 损坏），或存在密文但 master.key 文件在盘上却读不出来时，
* 抛 {@link ConnectorStatesUnreadableError}：调用方必须阻止后续写盘，
* 不得用空状态覆盖用户数据。
*/
function readStates(opts) {
	const { paths, userId } = opts;
	if (isAnonymousUser(userId)) return;
	if ((0, fs.existsSync)(paths.storageDir)) ensureAclOk(paths.storageDir, "dir");
	if ((0, fs.existsSync)(paths.v3Path)) return migrateFromV3(opts);
	if ((0, fs.existsSync)(paths.statesPath)) {
		const raw = parseJsonFile(paths.statesPath);
		if (isV4Content(raw)) return readV4Content(opts, raw);
		return migrateFromLegacyPlain(opts, raw);
	}
}
function parseJsonFile(filePath) {
	ensureAclOk(filePath, "file");
	try {
		return JSON.parse((0, fs.readFileSync)(filePath, "utf-8"));
	} catch (err) {
		throw new ConnectorStatesUnreadableError(`[states-persistence] failed to parse ${filePath}: ${String(err)}`, err);
	}
}
function isV4Content(raw) {
	return raw.version === 4 && Boolean(raw.encryption);
}
function readV4Content(opts, raw) {
	const { paths, userId } = opts;
	const cipher = buildCipherForRead(userId, raw.encryption, paths.storageDir, paths.masterKeyBackupBaseDir);
	if (!cipher) {
		assertCiphertextLossIsUnavoidable(opts, raw, "v4 read");
		console.warn("[states-persistence] cipher unavailable on read, sensitive overrides dropped");
		return {
			...extractV4NonSensitiveFields(raw),
			headerOverrides: {},
			envOverrides: {}
		};
	}
	return {
		...extractV4NonSensitiveFields(raw),
		headerOverrides: decryptSensitiveMap(raw.headerOverrides, AAD_SCOPE_HEADER, cipher),
		envOverrides: decryptSensitiveMap(raw.envOverrides, AAD_SCOPE_ENV, cipher)
	};
}
/** v3 加密文件 → v4 迁移。 */
function migrateFromV3(opts) {
	const { paths, userId } = opts;
	const raw = parseJsonFile(paths.v3Path);
	if (raw.version !== 3 || !raw.encryption) throw new ConnectorStatesUnreadableError(`[states-persistence] v3 file missing version=3/encryption header: ${paths.v3Path}`);
	const cipher = buildCipherForRead(userId, raw.encryption, paths.storageDir, paths.masterKeyBackupBaseDir);
	if (!cipher) assertCiphertextLossIsUnavoidable(opts, raw, "v3 → v4 migration");
	const legacy = {
		...extractLegacyNonSensitiveFields(raw),
		headerOverrides: cipher ? decryptSensitiveMap(raw.headerOverrides, AAD_SCOPE_HEADER, cipher) : {},
		envOverrides: cipher ? decryptSensitiveMap(raw.envOverrides, AAD_SCOPE_ENV, cipher) : {}
	};
	if (!cipher) console.warn("[states-persistence] v3 cipher unavailable, sensitive overrides dropped during migration");
	const migrated = migrateLegacyConnectorStates(legacy, opts.hasAuthEvidence);
	if (writeV4(opts, migrated) && verifyWrittenStates(opts, migrated)) purgeFileIfPresent(paths.v3Path, "v3 source after successful migration");
	else console.warn(`[states-persistence] v3 → v4 migration write/verify failed for user=${userId}; keeping v3 file as authoritative source for next attempt`);
	return migrated;
}
/** 旧明文 connector-states.json → v4 迁移（同名原子替换）。 */
function migrateFromLegacyPlain(opts, raw) {
	const legacyRaw = raw;
	const migrated = migrateLegacyConnectorStates({
		...extractLegacyNonSensitiveFields(legacyRaw),
		headerOverrides: coercePlainMap(legacyRaw.headerOverrides),
		envOverrides: coercePlainMap(legacyRaw.envOverrides)
	}, opts.hasAuthEvidence);
	if (!writeV4(opts, migrated) || !verifyWrittenStates(opts, migrated)) console.warn(`[states-persistence] legacy plaintext → v4 migration failed for user=${opts.userId}; keeping plaintext file for next attempt`);
	return migrated;
}
/** 回读刚写入的最终文件并校验内容一致，防止半损坏写入替换掉旧权威源。 */
function verifyWrittenStates(opts, expected) {
	try {
		const raw = parseJsonFile(opts.paths.statesPath);
		if (!isV4Content(raw)) return false;
		return statesEquivalent(readV4Content(opts, raw), expected);
	} catch (err) {
		console.warn(`[states-persistence] verify after migration failed: ${String(err)}`);
		return false;
	}
}
function statesEquivalent(a, b) {
	return JSON.stringify(sortedStableView(a)) === JSON.stringify(sortedStableView(b));
}
function sortedStableView(state) {
	const sortRecord = (record) => Object.entries(record).sort(([x], [y]) => x.localeCompare(y));
	return {
		connectors: sortRecord(state.connectors),
		headerOverrides: sortRecord(state.headerOverrides).map(([k, v]) => [k, sortRecord(v)]),
		envOverrides: sortRecord(state.envOverrides).map(([k, v]) => [k, sortRecord(v)]),
		disabledToolsOverrides: sortRecord(state.disabledToolsOverrides ?? {}),
		pluginMcpDisabledOverrides: sortRecord(state.pluginMcpDisabledOverrides ?? {}),
		headerOverridesBearerStripped: state.headerOverridesBearerStripped,
		staleManagedAuthHeadersPurged: state.staleManagedAuthHeadersPurged,
		mcpSecurityMigrated: state.mcpSecurityMigrated
	};
}
/**
* 加密写入 connector-states.json（version=4）。原子写 + ACL enforce。
*
* - headerOverrides / envOverrides 的每个 value 单独 AES-256-GCM 加密；其余字段明文。
* - **永不写明文状态文件**。
* - 未登录态（cipher 不可用）→ 跳过持久化，返回 false（不产生任何明文文件）。
* - 写成功后顺手清理残留的 v3 文件，避免旧文件在下次启动时重新成为权威源
*   （迁移期 write 失败 → v3 残留 → 本次会话的变更曾写入 v4 的分叉场景）。
*/
function writeStates(opts, state) {
	if (isAnonymousUser(opts.userId)) return false;
	const ok = writeV4(opts, state);
	if (ok) purgeFileIfPresent(opts.paths.v3Path, "stale v3 file after successful v4 write");
	return ok;
}
function writeV4(opts, state) {
	const { paths, userId } = opts;
	try {
		ensureStorageDir(paths.storageDir);
		const built = buildCipherForWrite(userId, paths.statesPath, paths.storageDir, paths.masterKeyBackupBaseDir);
		if (!built) {
			console.warn("[states-persistence] cipher unavailable, skip states write");
			return false;
		}
		const { cipher, header } = built;
		const persisted = {
			version: 4,
			encryption: header,
			connectors: normalizeConnectors(state.connectors),
			disabledToolsOverrides: normalizeOptionalStringArrayMap(state.disabledToolsOverrides),
			pluginMcpDisabledOverrides: normalizeOptionalBooleanMap(state.pluginMcpDisabledOverrides),
			accountIdentityKey: state.accountIdentityKey,
			headerOverridesBearerStripped: state.headerOverridesBearerStripped,
			staleManagedAuthHeadersPurged: state.staleManagedAuthHeadersPurged,
			mcpSecurityMigrated: state.mcpSecurityMigrated,
			headerOverrides: encryptSensitiveMap(state.headerOverrides, AAD_SCOPE_HEADER, cipher),
			envOverrides: encryptSensitiveMap(state.envOverrides, AAD_SCOPE_ENV, cipher)
		};
		atomicWriteFile(paths.statesPath, JSON.stringify(persisted, null, 2));
		return true;
	} catch (err) {
		console.warn(`[states-persistence] writeV4 failed: ${String(err)}`);
		return false;
	}
}
/**
* 归一化生命周期条目：
* - `bound=false` 的条目不落盘（缺省即 false/false）
* - 非法组合 `bound=false, enabled=true` 归一化为不落盘并记录诊断
*/
function normalizeConnectors(connectors) {
	const out = {};
	for (const [id, entry] of Object.entries(connectors ?? {})) {
		if (!entry || typeof entry !== "object") continue;
		const bound = entry.bound === true;
		const enabled = entry.enabled === true;
		if (!bound) {
			if (enabled) console.warn(`[states-persistence] dropping illegal lifecycle bound=false,enabled=true for ${id}`);
			continue;
		}
		out[id] = {
			bound: true,
			enabled
		};
	}
	return out;
}
/** 删除指定文件（迁移成功后 / 写路径的防御性补刀）。失败仅 warn 不抛。 */
function purgeFileIfPresent(filePath, label) {
	if (!(0, fs.existsSync)(filePath)) return;
	try {
		(0, fs.unlinkSync)(filePath);
		console.log(`[states-persistence] removed ${label}: ${filePath}`);
	} catch (err) {
		console.warn(`[states-persistence] failed to remove ${label} at ${filePath}: ${String(err)}`);
	}
}
function encryptSensitiveMap(map, scope, cipher) {
	const out = {};
	for (const [configId, fields] of Object.entries(map ?? {})) {
		const encFields = {};
		for (const [key, value] of Object.entries(fields)) encFields[key] = cipher.encrypt(value, {
			serverKey: `${scope}:${configId}`,
			fieldName: key
		});
		out[configId] = encFields;
	}
	return out;
}
function decryptSensitiveMap(map, scope, cipher) {
	const out = {};
	if (!map) return out;
	for (const [configId, fields] of Object.entries(map)) {
		const plainFields = {};
		for (const [key, value] of Object.entries(fields)) {
			const plain = decryptValue(value, `${scope}:${configId}`, key, cipher);
			if (plain !== void 0) plainFields[key] = plain;
		}
		out[configId] = plainFields;
	}
	return out;
}
/**
* 解密单个 value。兼容：
*  - string → 明文残留（迁移源遗留），直接返回
*  - CipherEnvelope → 走 cipher 解密；失败时返回 undefined（跳过该字段）
*/
function decryptValue(value, serverKey, fieldName, cipher) {
	if (typeof value === "string") return value;
	if (require_tar$1.isCipherEnvelope(value)) try {
		return cipher.decrypt(value, {
			serverKey,
			fieldName
		});
	} catch (err) {
		console.warn(`[states-persistence] decrypt failed (${serverKey}.${fieldName}): ${String(err)}`);
		return;
	}
}
/** v4 磁盘数据中抽出非敏感字段（不含 header/env/version/encryption），并归一化生命周期条目。 */
function extractV4NonSensitiveFields(src) {
	return {
		connectors: normalizeConnectors(src.connectors),
		disabledToolsOverrides: normalizeOptionalStringArrayMap(src.disabledToolsOverrides),
		pluginMcpDisabledOverrides: normalizeOptionalBooleanMap(src.pluginMcpDisabledOverrides),
		accountIdentityKey: typeof src.accountIdentityKey === "string" ? src.accountIdentityKey : void 0,
		headerOverridesBearerStripped: src.headerOverridesBearerStripped,
		staleManagedAuthHeadersPurged: src.staleManagedAuthHeadersPurged,
		mcpSecurityMigrated: src.mcpSecurityMigrated
	};
}
/** v3/legacy 数据中抽出非敏感字段（迁移源）。 */
function extractLegacyNonSensitiveFields(src) {
	return {
		enabled: coerceStringArray(src.enabled),
		everConnected: coerceOptionalStringArray(src.everConnected),
		userDisabled: coerceUserDisabledMap(src.userDisabled),
		disabledToolsOverrides: normalizeOptionalStringArrayMap(src.disabledToolsOverrides),
		accountIdentityKey: src.accountIdentityKey,
		headerOverridesBearerStripped: src.headerOverridesBearerStripped,
		staleManagedAuthHeadersPurged: src.staleManagedAuthHeadersPurged,
		pluginMcpDisabledOverrides: coerceBooleanMap(src.pluginMcpDisabledOverrides),
		mcpSecurityMigrated: src.mcpSecurityMigrated
	};
}
function coerceStringArray(value) {
	if (!Array.isArray(value)) return [];
	return value.filter((item) => typeof item === "string");
}
function coerceOptionalStringArray(value) {
	if (!Array.isArray(value)) return;
	return coerceStringArray(value);
}
function coerceUserDisabledMap(value) {
	if (Array.isArray(value)) return value.reduce((result, item) => {
		if (typeof item === "string") result[item] = true;
		return result;
	}, {});
	if (!value || typeof value !== "object") return {};
	const result = {};
	for (const [key, item] of Object.entries(value)) if (typeof item === "boolean") result[key] = item;
	return result;
}
function coerceBooleanMap(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) return {};
	const result = {};
	for (const [key, item] of Object.entries(value)) if (typeof item === "boolean") result[key] = item;
	return result;
}
function normalizeOptionalBooleanMap(value) {
	const map = coerceBooleanMap(value);
	return Object.keys(map).length > 0 ? map : void 0;
}
function normalizeOptionalStringArrayMap(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) return;
	const result = {};
	for (const [key, item] of Object.entries(value)) {
		const items = coerceStringArray(item);
		if (items.length > 0) result[key] = items;
	}
	return Object.keys(result).length > 0 ? result : void 0;
}
/** 把磁盘上的 sensitive map 强制视为明文（旧文件迁移源）；非 string 的 value 丢弃 */
function coercePlainMap(map) {
	const out = {};
	if (!map || typeof map !== "object") return out;
	for (const [configId, fields] of Object.entries(map)) {
		if (!fields || typeof fields !== "object") continue;
		const plainFields = {};
		for (const [key, value] of Object.entries(fields)) if (typeof value === "string") plainFields[key] = value;
		out[configId] = plainFields;
	}
	return out;
}
function ensureStorageDir(storageDir) {
	if (!(0, fs.existsSync)(storageDir)) (0, fs.mkdirSync)(storageDir, {
		recursive: true,
		mode: 448
	});
	require_tar$1.enforceDirAcl(storageDir);
}
/**
* 检查路径 ACL：通过 → true；失败 → repair + 二次 verify。
* connector-states 不因 ACL 失败拒读（敏感字段已加密），只 enforce 收紧权限。
*/
function ensureAclOk(targetPath, kind) {
	const verify = kind === "file" ? require_tar$1.verifyFileAcl : require_tar$1.verifyDirAcl;
	const initial = verify(targetPath);
	if (initial.ok) return true;
	if (initial.recoverable) require_tar$1.tryRepairAcl(targetPath, kind);
	return verify(targetPath).ok;
}
/**
* 原子写文件 + 严格 ACL（与 connector-oauth-persistence.atomicWriteFile 同款）：
*   1. O_CREAT mode 0600 创建 tmp（避免 open→chmod 间的宽松窗口）
*   2. 写入 + fchmod 双保险
*   3. close → rename → finalPath
*   4. enforceFileAcl（POSIX chmod / Windows icacls）
*/
function atomicWriteFile(finalPath, content) {
	const tmpPath = `${finalPath}.tmp-${process.pid}-${Date.now()}`;
	const fd = (0, fs.openSync)(tmpPath, "w", FILE_MODE);
	try {
		(0, fs.writeSync)(fd, content);
		(0, fs.fchmodSync)(fd, FILE_MODE);
	} finally {
		(0, fs.closeSync)(fd);
	}
	try {
		(0, fs.renameSync)(tmpPath, finalPath);
	} catch (renameErr) {
		try {
			(0, fs.rmSync)(tmpPath, { force: true });
		} catch {}
		throw renameErr;
	}
	try {
		(0, fs.chmodSync)(finalPath, FILE_MODE);
	} catch {}
	require_tar$1.enforceFileAcl(finalPath);
}
/**
* 磁盘敏感字段里是否还存在密文 envelope。
* 只有存在密文时 cipher 不可用才真的会丢用户凭据——明文残留由 decryptValue 直通。
*/
function hasCiphertext(...maps) {
	for (const map of maps) for (const fields of Object.values(map ?? {})) {
		if (!fields || typeof fields !== "object") continue;
		for (const value of Object.values(fields)) if (require_tar$1.isCipherEnvelope(value)) return true;
	}
	return false;
}
/** master.key 是否还有文件躺在盘上（primary / backup 任一）。 */
function masterKeyFileExists(userId, primaryDir, backupBaseDir) {
	if (isAnonymousUser(userId)) return false;
	try {
		const store = new require_tar$1.ConnectorOAuthMasterKeyStore({
			userId,
			primaryDir,
			backupBaseDir
		});
		return (0, fs.existsSync)(store.getPrimaryPath()) || (0, fs.existsSync)(store.getBackupPath());
	} catch (err) {
		console.warn(`[states-persistence] master.key presence probe failed: ${String(err)}`);
		return false;
	}
}
/**
* cipher 读失败时决定「降级」还是「拒读」。
*
* `buildCipherForRead` 把两种完全不同的成因都收敛成 undefined：
*
*   1. **master.key primary/backup 都不在了** —— 密钥永久消失，旧密文再也解不开。
*      降级（丢敏感字段、保生命周期）是唯一出路：允许下一次写入用新 key 重建加密头，
*      用户重新授权即可恢复；否则连接器状态将永久不可写、开关再也点不动。
*   2. **master.key 文件还在，只是这一轮读不出来**（ACL 抖动、文件被占用、长度损坏、
*      加密头与 key 不匹配）—— 密文仍然可恢复。而写路径 `buildCipherForWrite` 走的是
*      `loadOrCreateMasterKey`，会**新建一把 key** 照样写成功，于是下一次落盘就把空的
*      headerOverrides/envOverrides 盖到密文上；v3 迁移路径还会在 verify 通过后
*      purge v3 源文件——一次瞬时抖动换来永久的凭据丢失。
*
* 成因 2 必须抛 {@link ConnectorStatesUnreadableError}：上层 catch 后会把
* `persistentStateLoadedIdentityKey` 置空、阻止本次会话的一切写盘，下次启动重试。
*/
function assertCiphertextLossIsUnavoidable(opts, raw, stage) {
	if (!hasCiphertext(raw.headerOverrides, raw.envOverrides)) return;
	const { paths, userId } = opts;
	if (!masterKeyFileExists(userId, paths.storageDir, paths.masterKeyBackupBaseDir)) {
		console.warn(`[states-persistence] master.key gone (${stage}); ciphertext is unrecoverable, dropping sensitive overrides and allowing re-encryption with a fresh key`);
		return;
	}
	throw new ConnectorStatesUnreadableError(`[states-persistence] master.key present but unreadable during ${stage}; refusing to read so writes stay blocked and the on-disk ciphertext survives for the next attempt`);
}
function buildCipherForRead(userId, header, primaryDir, backupBaseDir) {
	const masterKey = loadMasterKey(userId, primaryDir, backupBaseDir);
	if (!masterKey) return;
	try {
		return new require_tar$1.OAuthCipher({
			userId,
			masterKey,
			header
		});
	} catch (err) {
		console.warn(`[states-persistence] cipher build (read) failed: ${String(err)}`);
		return;
	}
}
function buildCipherForWrite(userId, statesPath, primaryDir, backupBaseDir) {
	const masterKey = loadOrCreateMasterKey(userId, primaryDir, backupBaseDir);
	if (!masterKey) return;
	const existingHeader = tryReadEncryptionHeader(statesPath);
	const initialHeader = existingHeader ?? require_tar$1.createHeader(userId, masterKey);
	try {
		return {
			cipher: new require_tar$1.OAuthCipher({
				userId,
				masterKey,
				header: initialHeader
			}),
			header: initialHeader
		};
	} catch (err) {
		if (existingHeader) {
			console.warn(`[states-persistence] existing header mismatch (${String(err)}), rebuilding with fresh header`);
			try {
				const freshHeader = require_tar$1.createHeader(userId, masterKey);
				return {
					cipher: new require_tar$1.OAuthCipher({
						userId,
						masterKey,
						header: freshHeader
					}),
					header: freshHeader
				};
			} catch (err2) {
				console.warn(`[states-persistence] cipher rebuild failed: ${String(err2)}`);
				return;
			}
		}
		console.warn(`[states-persistence] cipher build (write) failed: ${String(err)}`);
		return;
	}
}
function tryReadEncryptionHeader(statesPath) {
	if (!(0, fs.existsSync)(statesPath)) return;
	try {
		const raw = JSON.parse((0, fs.readFileSync)(statesPath, "utf-8"));
		if (raw.version === 4 && raw.encryption) return raw.encryption;
	} catch {}
}
function loadMasterKey(userId, primaryDir, backupBaseDir) {
	if (isAnonymousUser(userId)) return;
	try {
		return new require_tar$1.ConnectorOAuthMasterKeyStore({
			userId,
			primaryDir,
			backupBaseDir
		}).getExisting()?.key;
	} catch (err) {
		console.warn(`[states-persistence] loadMasterKey failed: ${String(err)}`);
		return;
	}
}
function loadOrCreateMasterKey(userId, primaryDir, backupBaseDir) {
	try {
		return new require_tar$1.ConnectorOAuthMasterKeyStore({
			userId,
			primaryDir,
			backupBaseDir
		}).getOrCreate().key;
	} catch (err) {
		console.warn(`[states-persistence] loadOrCreateMasterKey failed: ${String(err)}`);
		return;
	}
}
//#endregion
//#region ../../packages/workbuddy-server/src/connector/ioa-server-side-auth.ts
var IOA_MCP_DOMAIN_SUFFIXES = [
	".mcp.it.woa.com",
	".mcp.woa.com",
	".knot.woa.com"
];
var IOA_OAUTH_NAME_PREFIX = "internal_taihu-";
var SAFE_OAUTH_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;
var IOA_AUTH_TIMEOUT_MS = 3e5;
var IOA_AUTH_POLL_INTERVAL_MS = 2e3;
/**
* IOA 服务端 MCP OAuth 认证管理。
*
* 职责：检测 IOA 域名 → 获取/刷新 token → 装饰 server config → 撤销 token。
* 由 ConnectorService 控制面使用，基础依赖通过 deps bag 提供。
*/
var IoaServerSideAuth = class {
	constructor(deps) {
		this.deps = deps;
		this.abortControllers = /* @__PURE__ */ new Map();
	}
	/**
	* 检查 server config 是否匹配 IOA 域名 (*.mcp.it.woa.com / *.mcp.woa.com / *.knot.woa.com) 且用户是 IOA 企业。
	* 返回 { oauthName } 或 undefined。
	*/
	resolveHostRule(serverConfig) {
		const url = serverConfig?.url;
		if (!url) return;
		let hostname;
		try {
			hostname = new URL(url).hostname;
		} catch {
			return;
		}
		if (!this.isIoaMcpHostname(hostname)) return;
		if (!require_tar$1.isIOAEnterprise(this.deps.getEnterpriseId())) return;
		const explicitOauthName = serverConfig?._workbuddyManagedAuthOauthName;
		if (typeof explicitOauthName === "string" && explicitOauthName.length > 0) {
			if (this.isSafeOauthName(explicitOauthName)) return { oauthName: explicitOauthName };
			this.deps.logger.warn(`[IoaServerSideAuth] resolveHostRule: invalid explicit oauthName ignored, url=${url}`);
		}
		return { oauthName: this.deriveOauthName(url) };
	}
	extractManagedAuthHeaders(serverConfig) {
		if (serverConfig._workbuddyManagedAuth !== "server-side" || !this.resolveHostRule(serverConfig)) return {};
		const authorization = serverConfig.headers?.Authorization;
		return typeof authorization === "string" && authorization.length > 0 ? { Authorization: authorization } : {};
	}
	/**
	* 根据 URL 推导 oauthName（用于已知 URL 的 token 撤销场景）。
	* 不检查 enterpriseId（撤销时可能已不在 IOA 企业上下文中）。
	*/
	resolveOauthNameByUrl(url) {
		if (!url) return;
		let hostname;
		try {
			hostname = new URL(url).hostname;
		} catch {
			return;
		}
		if (!this.isIoaMcpHostname(hostname)) return;
		return this.deriveOauthName(url);
	}
	isIoaMcpHostname(hostname) {
		return IOA_MCP_DOMAIN_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
	}
	isSafeOauthName(oauthName) {
		return SAFE_OAUTH_NAME_PATTERN.test(oauthName);
	}
	/**
	* 从 URL 生成 oauthName：去掉 scheme，对剩余部分 sha256 取前 12 位，拼 internal_taihu- 前缀。
	*/
	deriveOauthName(url) {
		const withoutScheme = url.replace(/^https?:\/\//, "");
		return `${IOA_OAUTH_NAME_PREFIX}${crypto.createHash("sha256").update(withoutScheme).digest("hex").slice(0, 12)}`;
	}
	/**
	* 从服务端获取已有的 access token。返回 token 字符串或 undefined。
	*/
	async fetchAccessToken(rule) {
		const resp = await this.callApi("GET", `/v2/as/connector/oauth/${rule.oauthName}/accesstoken`);
		if (resp?.code === 0 && typeof resp?.data?.access_token === "string" && resp.data.access_token.length > 0) return resp.data.access_token;
	}
	/**
	* 发起交互式授权：POST /start → 打开浏览器 → 轮询 /status 直到 authorized。
	* @param onBrowserOpened 浏览器打开后、轮询开始前的回调（可选），供调用方更新 UI 状态。
	*/
	async startAuthorization(rule, signal, onBrowserOpened) {
		await this.revokeToken(rule.oauthName);
		const authorizeUrl = await this.callStartAuthorization(rule);
		await this.openBrowser(authorizeUrl);
		onBrowserOpened?.();
		await this.pollAuthStatus(rule, signal);
	}
	/**
	* 第一步：POST /start 获取 authorize_url。
	* 返回 authorize_url 字符串，失败时抛异常。
	*/
	async callStartAuthorization(rule) {
		const startResp = await this.callApi("POST", `/v2/as/connector/oauth/${rule.oauthName}/start`);
		const authorizeUrl = startResp?.data?.authorize_url ?? startResp?.data?.authorizeUrl;
		if (startResp?.code !== 0) throw new Error(startResp?.msg || `Failed to start OAuth for ${rule.oauthName}`);
		if (typeof authorizeUrl !== "string" || authorizeUrl.length === 0) throw new Error("IOA 授权服务未返回 authorize_url，请稍后重试");
		return authorizeUrl;
	}
	/**
	* 第二步：打开浏览器。
	*/
	async openBrowser(authorizeUrl) {
		await this.deps.openExternal(authorizeUrl);
	}
	/**
	* 编排器：解析 token（获取已有 token 或发起交互式授权）。
	* 返回 IoaServerSideAuthResult 或 undefined（不匹配 IOA 规则）。
	* @param options.onBrowserOpened 浏览器打开后回调，供调用方更新 UI 状态（如标记 needsAuth）。
	*/
	async resolveToken(serverConfig, options, signal) {
		const rule = this.resolveHostRule(serverConfig);
		if (!rule) return;
		try {
			let accessToken;
			if (options.interactive) {
				try {
					accessToken = await this.fetchAccessToken(rule);
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					if (message.includes("HTTP 404") || message.includes("connector not found")) return;
					throw error;
				}
				if (!accessToken) {
					await this.startAuthorization(rule, signal, options.onBrowserOpened);
					accessToken = await this.fetchAccessToken(rule);
				}
			} else accessToken = await this.fetchAccessToken(rule);
			if (!accessToken) return {
				success: false,
				needsAuthorize: true,
				error: `server-side token missing for oauthName=${rule.oauthName}`,
				rule
			};
			return {
				success: true,
				accessToken,
				rule
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.deps.logger.error(`[IoaServerSideAuth] resolveToken(${rule.oauthName}): ${message}`);
			if (message.includes("HTTP 404") || message.includes("connector not found")) return;
			return {
				success: false,
				needsAuthorize: options.interactive,
				error: `oauthName=${rule.oauthName}: ${message}`,
				rule
			};
		}
	}
	/**
	* doConnect 的 IOA 编排入口。
	*
	* 非交互式（silent=true）：静默获取 token → 成功则返回 decorated config，失败返回 undefined 让调用方 fall through。
	* 交互式（silent=false）：先复用服务端 token；仅 token 缺失时打开浏览器 → 后台 poll → 授权后自动重连。
	*   浏览器授权场景 doConnect 立即返回 `{ handled: true }` 让调用方返回 needsAuth，不阻塞 inFlightConnects。
	*
	* @returns
	*   - `{ handled: true }` — IOA 已接管（交互式：浏览器已打开，后台 poll 中；doConnect 应立即返回 needsAuth）
	*   - `{ handled: false, serverConfig }` — 非交互式：token 已注入到 serverConfig（或未匹配 IOA），doConnect 继续标准流程
	*/
	async handleConnect(configId, serverConfig, silent, callbacks) {
		const rule = this.resolveHostRule(serverConfig);
		if (!rule) return {
			handled: false,
			serverConfig
		};
		const existing = this.abortControllers.get(configId);
		if (existing) {
			try {
				existing.abort();
			} catch {}
			this.abortControllers.delete(configId);
		}
		const controller = new AbortController();
		this.abortControllers.set(configId, controller);
		if (!silent) try {
			let accessToken;
			try {
				accessToken = await this.fetchAccessToken(rule);
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);
				if (msg.includes("HTTP 404") || msg.includes("connector not found")) {
					this.abortControllers.delete(configId);
					this.deps.logger.warn(`[IoaServerSideAuth] handleConnect(${configId}): server-side auth unavailable, falling back to local OAuth`);
					return {
						handled: false,
						serverConfig
					};
				}
				throw error;
			}
			if (accessToken) {
				this.abortControllers.delete(configId);
				return {
					handled: false,
					serverConfig: this.decorateConfig(serverConfig, rule, accessToken)
				};
			}
			await this.revokeToken(rule.oauthName);
			const authorizeUrl = await this.callStartAuthorization(rule);
			await this.openBrowser(authorizeUrl);
			callbacks.onNeedsAuth();
			this.pollAuthStatus(rule, controller.signal).then(async () => {
				this.abortControllers.delete(configId);
				const accessToken = await this.fetchAccessToken(rule);
				if (accessToken) {
					const decorated = this.decorateConfig(serverConfig, rule, accessToken);
					await callbacks.onAuthorized(decorated);
				}
			}).catch((err) => {
				this.abortControllers.delete(configId);
				const msg = err instanceof Error ? err.message : String(err);
				this.deps.logger.warn(`[IoaServerSideAuth] handleConnect(${configId}): background authorization failed: ${msg}`);
			});
			return { handled: true };
		} catch (e) {
			this.abortControllers.delete(configId);
			const msg = e instanceof Error ? e.message : String(e);
			if (msg.includes("HTTP 404") || msg.includes("connector not found")) {
				this.deps.logger.warn(`[IoaServerSideAuth] handleConnect(${configId}): server-side auth unavailable, falling back to local OAuth`);
				return {
					handled: false,
					serverConfig
				};
			}
			throw e;
		}
		else try {
			const accessToken = await this.fetchAccessToken(rule);
			this.abortControllers.delete(configId);
			if (accessToken) return {
				handled: false,
				serverConfig: this.decorateConfig(serverConfig, rule, accessToken)
			};
			return {
				handled: false,
				serverConfig
			};
		} catch (e) {
			this.abortControllers.delete(configId);
			const msg = e instanceof Error ? e.message : String(e);
			if (msg.includes("HTTP 404") || msg.includes("connector not found")) return {
				handled: false,
				serverConfig
			};
			throw e;
		}
	}
	/** 取消指定 configId 的进行中 poll（供外部 disconnect 时调用）。 */
	abortPendingAuth(configId) {
		const controller = this.abortControllers.get(configId);
		if (controller) {
			try {
				controller.abort();
			} catch {}
			this.abortControllers.delete(configId);
		}
	}
	/**
	* 装饰 server config：注入 Authorization header + managed auth 标记。
	*/
	decorateConfig(serverConfig, rule, accessToken) {
		const headers = { ...serverConfig.headers ?? {} };
		if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
		return {
			...serverConfig,
			...Object.keys(headers).length > 0 ? { headers } : {},
			_workbuddyManagedAuth: "server-side",
			_workbuddyManagedAuthOauthName: rule.oauthName
		};
	}
	/**
	* 撤销指定 oauthName 的服务端 token。
	*/
	async revokeToken(oauthName) {
		await this.callApi("POST", `/v2/as/connector/oauth/${oauthName}/revoke`);
	}
	/**
	* 第三步：轮询 /status 直到 authorized/connected，或超时/abort。
	*/
	async pollAuthStatus(rule, signal) {
		const deadline = Date.now() + IOA_AUTH_TIMEOUT_MS;
		while (Date.now() < deadline) {
			if (signal?.aborted) throw new Error(`[${rule.oauthName}] auth polling aborted`);
			await this.sleep(IOA_AUTH_POLL_INTERVAL_MS, signal);
			if (signal?.aborted) throw new Error(`[${rule.oauthName}] auth polling aborted`);
			const statusResp = await this.callApi("GET", `/v2/as/connector/oauth/${rule.oauthName}/status`);
			const status = statusResp?.data?.status ?? statusResp?.status;
			if (status === "authorized" || status === "connected") return;
			if (status === "expired") throw new Error(`[${rule.oauthName}] auth expired`);
		}
		throw new Error(`[${rule.oauthName}] auth polling timed out`);
	}
	sleep(ms, signal) {
		return new Promise((resolve) => {
			if (signal?.aborted) {
				resolve();
				return;
			}
			const timer = setTimeout(() => {
				signal?.removeEventListener("abort", onAbort);
				resolve();
			}, ms);
			const onAbort = () => {
				clearTimeout(timer);
				resolve();
			};
			signal?.addEventListener("abort", onAbort, { once: true });
		});
	}
	async callApi(method, path) {
		const endpoint = this.deps.getApiEndpoint();
		const apiDeps = {
			productManager: { getEndpoint: () => endpoint },
			authenticationManager: { buildAuthHeaders: this.deps.buildAuthHeaders },
			fetch: this.deps.fetch
		};
		try {
			return await require_tar$1.callConnectorOauthApi(method, path, apiDeps);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			this.deps.logger.error(`[IoaServerSideAuth] callApi ${method} ${path}: error=${msg}`);
			throw e;
		}
	}
};
//#endregion
//#region ../../packages/workbuddy-server/src/connector/json-file-cache.ts
/**
* 单文件 JSON 配置的 mtime/size 失效缓存。
*
* 适用形态：
*   - 路径稳定（同一进程生命周期内不变）
*   - 内容是合法 JSON
*   - 文件由本进程或外部 watcher 监听的方式修改（writeFileSync 会刷 mtime）
*
* 命中规则：当前 stat 的 (mtimeMs, size) 与上次缓存时一致 → 直接返回上次的解析结果，
* 跳过 readFileSync + JSON.parse。任一变化或文件不存在 → 重新读、解析并刷新缓存。
*
* 注意：fs.watch 防抖会让"刚写完立刻读"出现 mtime 没变的极短窗口（通常 < 10ms），
* 调用方在写文件后必须主动 invalidate（writeFileSync → invalidate(path)），不要依赖
* stat 把刚写的内容反馈出来。
*/
var JsonFileCache = class {
	constructor(read) {
		this.read = read;
		this.entries = /* @__PURE__ */ new Map();
	}
	get(filePath) {
		let stat;
		try {
			stat = (0, fs.statSync)(filePath);
		} catch {
			this.entries.delete(filePath);
			return this.read(filePath);
		}
		const cached = this.entries.get(filePath);
		if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached.value;
		const value = this.read(filePath);
		this.entries.set(filePath, {
			mtimeMs: stat.mtimeMs,
			size: stat.size,
			value
		});
		return value;
	}
	invalidate(filePath) {
		if (filePath === void 0) {
			this.entries.clear();
			return;
		}
		this.entries.delete(filePath);
	}
};
function safeReadJsonFile(filePath, fallback) {
	try {
		const content = (0, fs.readFileSync)(filePath, "utf-8");
		return JSON.parse(content);
	} catch {
		return fallback;
	}
}
var TtlMemoCache = class {
	constructor(compute, ttlMs) {
		this.compute = compute;
		this.ttlMs = ttlMs;
	}
	get() {
		if (this.cached && Date.now() - this.cached.at < this.ttlMs) return this.cached.value;
		const value = this.compute();
		this.cached = {
			value,
			at: Date.now()
		};
		return value;
	}
	invalidate() {
		this.cached = void 0;
	}
};
function setConnectorBundledAssetResolver(resolver) {}
function setArdotEmbedUrlProvider(provider) {}
/**
* 内置远端 Ardot MCP Server 配置（标准 MCP 协议，HTTP transport）。
*
* 上线形态：Ardot 作为 WorkBuddy 自带能力，用户【无需手动安装 / 配置】，由 daemon
* 内置注入。URL 走【环境化】——复用 `resolveArdotEmbedUrl()` 的 env→Ardot 独立域名
* 判定（prod=ardot.tencent.com / staging=test.ardot.tencent.com / dev override），
* 拼上 `/mcp` path。一份代码多环境，生产包不会带上测试域名。
*
* server key 沿用 `ardot`（`BUILTIN_ARDOT_MCP_SERVER_NAME`），从而自动继承
* connector-mcp-proxy `listAllTools` 里「仅 design 会话暴露 ardot 工具」的硬隔离
* （见 `WORKBUDDY_WELCOME_MODE_HEADER` 过滤），无需额外门禁。
*/
function buildBuiltinArdotMcpConfig() {
	return {
		type: "http",
		url: "https://ardot.tencent.com/mcp",
		disabled: false,
		managedBy: "workbuddy-builtin",
		_workbuddyManagedAuth: "server-side"
	};
}
buildBuiltinArdotMcpConfig().url;
var BUILTIN_NETDRIVE_MCP_SERVER_NAME = "netdrive";
/**
* 网盘 MCP 在 agent-gateway 上的客户端路径前缀。
*
* Desktop 端统一走 `/console/agent-gateway/netdrive/mcp`（与 Web 端一致），
* APISIX 该路由放开了 IDE 用户访问，免去 IDE 网关额外加白的成本。
*
* 本模块导出的是 Desktop 默认路径，Web 端不要直接复用此常量。
*
* agent-gateway `proxy_v2/netdrive.go` 把 `/agent-gateway/netdrive/mcp` → 上游
* `/api/v6/open/tdrive/mcp`；客户端只用关心客户端可见的相对前缀。
*
* 完整 URL 由 connector-service.ts 拼出：endpoint + BUILTIN_NETDRIVE_MCP_PATH。
*/
var BUILTIN_NETDRIVE_MCP_PATH = "/console/agent-gateway/netdrive/mcp";
/**
* 网盘 MCP 客户端身份 header 名称。
*
* 这些 header 由 agent-gateway 的 NetdriveCredentialSource 透传给 agentserver
* `/netdrive/internal/access-token`。**必须**与后端一致：
* - X-Genie-User-ID  : 当前登录用户 ID（必填）
* - X-Project-Id     : 当前激活项目 ID（空串=个人盘；不传时也会被当作个人盘）
* - X-Enterprise-Id  : 企业 ID（决定 ToC/ToB baseUrl，决定换票走 toC vs toB provider）
*
* 端到端链路：
*   客户端 -> agent-gateway /console/agent-gateway/netdrive/mcp (带这三个 header)
*     -> agent-gateway 调 agentserver /netdrive/internal/access-token (透传同名 header)
*     -> agentserver 按 enterpriseId 选 ToC/ToB provider，按 projectId 派生权限
*     -> 返回 {accessToken, baseUrl, spaceID, dirName}
*     -> agent-gateway 转发到 baseUrl/api/v6/open/tdrive/mcp，附带 access token
*/
var NETDRIVE_HEADER_USER_ID = "X-Genie-User-ID";
var NETDRIVE_HEADER_PROJECT_ID = "X-Project-Id";
/**
* 决议生效的 netdrive MCP URL：
* - 优先用用户 dev 覆盖（mcp.json 中 entry.dev=true 且带 url），方便本地后端联调
* - 否则走传入的默认远端 URL（由 connector-service 按部署环境拼出）
*/
function isValidNetdriveDevMcpServer(entry) {
	if (!entry || typeof entry !== "object") return false;
	const server = entry;
	if (server.dev !== true) return false;
	return typeof server.url === "string" && server.url.trim().length > 0;
}
/**
* 构造内置 netdrive MCP 配置。
*
* 返回 undefined 时调用方应跳过 netdrive 注入（headers 不完整 / 用户未登录）。
*
* 设计：
* - type: 'http' —— 远端 HTTP transport，agent-cli 侧 McpConfigHTTP 已原生支持
* - headers: 会话级身份注入入口，传入空 X-Genie-User-ID 时直接返回 undefined
* - defer_loading: 工具不进 LLM tools 列表（由 ToolSearch + DeferExecute 触发）
* - managedBy: 标记为内置，UI 列表 / approval 流程据此区分
*/
function createBuiltinNetdriveMcpServer(headers, url) {
	const userId = headers[NETDRIVE_HEADER_USER_ID];
	if (!userId || typeof userId !== "string" || userId.trim().length === 0) return;
	if (!url || typeof url !== "string" || url.trim().length === 0) return;
	const authorization = headers.Authorization;
	if (!authorization || typeof authorization !== "string" || authorization.trim().length === 0) return;
	const filteredHeaders = {};
	for (const [key, value] of Object.entries(headers)) if (typeof value === "string" && value.length > 0) filteredHeaders[key] = value;
	return {
		type: "http",
		url,
		headers: filteredHeaders,
		disabled: false,
		managedBy: "workbuddy-builtin",
		defer_loading: true
	};
}
//#endregion
//#region ../../packages/workbuddy-server/src/connector/plugin-environment.ts
/**
* 插件 MCP 的环境变量与占位符解析（daemon 侧）。
*
* ## 为什么 daemon 需要这一份
*
* builtin / inline 插件的 MCP 原本由 Agent CLI 的 PLUGIN scope 加载，`MCPExtensionLoader`
* 会经 `plugin-environment.ts` 给每个 server 做占位符替换 + 注入插件环境。issue #100308
* 之后这条车道被 `--strict-mcp-config` 关掉、改由 daemon 投影，**消费口径必须跟着搬过来**，
* 否则同一个 `.mcp.json` 在两条车道下解析结果不同（实测会踩：`mcp-miora` 的
* `MIORA_DATA_DIR: "${CODEBUDDY_PLUGIN_DATA}"` 会原样把字面量传给子进程）。
*
* ## 与 agent-cli `plugin-environment.ts` 的对应关系
*
* | CLI 侧 | 这里 | 说明 |
* | --- | --- | --- |
* | `sanitizePluginDataId` / `getPluginDataDirectory` | 同名 | 逐字符对齐，data 目录必须同名，否则插件丢状态 |
* | `resolvePluginOptionValues` | 同名 | schema default 打底，存储值覆盖 |
* | `buildPluginOptionEnvironment` | 同名 | `CLAUDE_/CODEBUDDY_PLUGIN_OPTION_*` + 旧契约 `PLUGIN_OPT_*` |
* | `buildPluginSubprocessEnvironment` | 同名（同步） | 少 `*_PROJECT_DIR`，见下 |
* | `substitutePluginVariables` | 同名（同步） | 少 `expandEnvironment`，见下 |
*
* ## 两处**刻意**不对齐（勿"补全"）
*
* 1. **不做 `${VAR}` / `${VAR:-default}` 的 process.env 展开。** CLI 的
*    `McpConfigManager.expandScopeData` 对**所有** scope（含 DYNAMIC，也就是
*    `--mcp-config` 投影进去的这些）都会跑一遍 `expandEnvVariables`。在 daemon 侧再做
*    一次只会拿 **daemon 进程**的 env 去解析，和插件预期的 CLI 进程 env 不是一回事。
* 2. **不解析 `${CLAUDE_PROJECT_DIR}` / `${CODEBUDDY_PROJECT_DIR}`。** 它们是会话级的
*    （值 = 会话工作区），而本模块的调用点 `computePluginMcpConfigs` 是进程级 TTL 缓存、
*    拿不到 cwd。这两个占位符与对应 env 由 `mcp/connector-mcp/connector-mcp-service.ts`
*    的**按会话**投影点负责（那里已经在注入 `CODEBUDDY_PROJECT_DIR` 了）。
*
* 另注：`cwd` 不在这里（也不在投影里）处理 —— 投影层刻意不写 `cwd`，原因见
* `ConnectorStdioMcpConfig.cwd` 的注释（带 cwd 会让 CLI 对同一 server 建两次 transport
* 并互相 kill）。插件靠 `CODEBUDDY_PLUGIN_ROOT` / `CODEBUDDY_PROJECT_DIR` 定位资源。
*/
var PLUGIN_DATA_PLACEHOLDER = /\$\{(?:CLAUDE|CODEBUDDY)_PLUGIN_DATA\}/;
var USER_CONFIG_PLACEHOLDER = /\$\{user_config\.([^}]+)\}/g;
var LEGACY_PLUGIN_OPTION_PLACEHOLDER = /\$\{PLUGIN_OPT:([^}]+)\}/g;
/** Claude Code 把 allow-list 之外的每个字符都换成 '-'；必须逐字符对齐。 */
function sanitizePluginDataId(pluginId) {
	return pluginId.replace(/[^a-zA-Z0-9\-_]/g, "-");
}
function getPluginDataDirectory(pluginId, pluginsDirectory) {
	return (0, path.join)(pluginsDirectory, "data", sanitizePluginDataId(pluginId));
}
/** schema 的 default 打底，存储值覆盖（与 CLI `resolvePluginOptionValues` 等价）。 */
function resolvePluginOptionValues(userConfig, storedOptions) {
	const options = {};
	for (const [key, field] of Object.entries(userConfig || {})) if (field?.default !== void 0) options[key] = field.default;
	return {
		...options,
		...storedOptions || {}
	};
}
function toPluginOptionEnvKey(key) {
	return key.replace(/[^A-Za-z0-9_]/g, "_").toUpperCase();
}
function buildPluginOptionEnvironment(options) {
	const env = {};
	for (const [key, value] of Object.entries(options)) {
		const envKey = toPluginOptionEnvKey(key);
		const serialized = String(value);
		env[`CLAUDE_PLUGIN_OPTION_${envKey}`] = serialized;
		env[`CODEBUDDY_PLUGIN_OPTION_${envKey}`] = serialized;
		env[`PLUGIN_OPT_${envKey}`] = serialized;
	}
	return env;
}
/**
* 插件 stdio 子进程的环境增量。
*
* 不含 `*_PROJECT_DIR`（会话级，由按会话投影点注入，见文件头说明）。
*/
function buildPluginSubprocessEnvironment(context) {
	return {
		CLAUDE_PLUGIN_ROOT: context.pluginRoot,
		CODEBUDDY_PLUGIN_ROOT: context.pluginRoot,
		CLAUDE_PLUGIN_DATA: context.pluginData,
		CODEBUDDY_PLUGIN_DATA: context.pluginData,
		...buildPluginOptionEnvironment(context.options)
	};
}
/** `${user_config.KEY}` 取不到值：与 CLI 的 config 模式一致，视为该 server 不可用。 */
var MissingPluginUserConfigError = class extends Error {
	constructor(pluginId, key) {
		super(`No value found for user_config.${key} in plugin '${pluginId}'`);
		this.pluginId = pluginId;
		this.key = key;
		this.name = "MissingPluginUserConfigError";
	}
};
/**
* 展开插件占位符。对齐 CLI 的 `substitutePluginVariables(text, ctx, { mode: 'config' })`，
* 但不含 `${VAR}` 的 process.env 展开与 `*_PROJECT_DIR`（见文件头）。
*
* @throws {MissingPluginUserConfigError} `${user_config.KEY}` 无值时
*/
function substitutePluginVariables(text, context) {
	let result = text.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, context.pluginRoot).replace(/\$\{CODEBUDDY_PLUGIN_ROOT\}/g, context.pluginRoot);
	if (PLUGIN_DATA_PLACEHOLDER.test(result)) result = result.replace(/\$\{CLAUDE_PLUGIN_DATA\}/g, context.pluginData).replace(/\$\{CODEBUDDY_PLUGIN_DATA\}/g, context.pluginData);
	result = result.replace(USER_CONFIG_PLACEHOLDER, (_match, key) => {
		const value = context.options[key];
		if (value === void 0) throw new MissingPluginUserConfigError(context.pluginId, key);
		return String(value);
	});
	return result.replace(LEGACY_PLUGIN_OPTION_PLACEHOLDER, (match, key) => {
		const value = context.options[key];
		return value === void 0 ? match : String(value);
	});
}
/** 深度展开一个 MCP config 对象里的所有字符串占位符。 */
function substitutePluginVariablesDeep(value, context) {
	const walk = (input) => {
		if (typeof input === "string") return substitutePluginVariables(input, context);
		if (Array.isArray(input)) return input.map(walk);
		if (input && typeof input === "object") return Object.fromEntries(Object.entries(input).map(([key, child]) => [key, walk(child)]));
		return input;
	};
	return walk(value);
}
/**
* 惰性建插件数据目录 —— 只在配置里真的用到 `${*_PLUGIN_DATA}` 时建，
* 与 CLI 的 `ensurePluginDataDirectoryForText` 同语义（不给用不到的插件留空目录）。
*
* 建目录失败不应该拖垮整个投影：返回 false 由调用方决定降级（记日志、照常投影，
* 子进程自己 mkdir 也能兜住）。
*/
function ensurePluginDataDirectory(dataDirectory) {
	try {
		(0, fs.mkdirSync)(dataDirectory, { recursive: true });
		return true;
	} catch {
		return false;
	}
}
/** 配置文本里是否出现过 `${*_PLUGIN_DATA}`。 */
function usesPluginDataPlaceholder(text) {
	return PLUGIN_DATA_PLACEHOLDER.test(text);
}
//#endregion
//#region ../../packages/workbuddy-server/src/connector/plugin-integrity-guard.ts
/**
* 插件安装目录完整性校验（daemon 侧）。
*
* ## 为什么这份校验必须在 daemon
*
* 受保护插件（当前只有 `weixinpay`）随包分发一份 `manifest.qmsig` 签名清单和
* `prebuilds/win32-x64/QmProtectorLib.dll` 验签库。Agent CLI 侧原本用
* `WeixinpayIntegrityGuard`（`packages/agent-cli/src/node/plugins/guards/`）在
* **加载插件组件**前挡一道；但 builtin 插件的 MCP 现已由 daemon 解析并投影进
* `--mcp-config`（见 `ConnectorService.computePluginMcpConfigs`），MCP 子进程的
* 拉起不再经过 CLI 的插件加载路径 —— 校验必须跟着投影一起下沉，否则被篡改的
* 支付插件目录仍会被拉起。
*
* ## 与 CLI 侧 guard 的行为对齐（逐分支等价，勿单侧改）
*
* | 情形                          | 结论  | 理由                                   |
* | ----------------------------- | ----- | -------------------------------------- |
* | 非受保护插件 / 非 Windows     | 放行  | 签名产物只在 Windows 分发              |
* | DLL 未随包分发                | 放行  | 开发态 / 非打包环境                    |
* | DLL 在但 manifest.qmsig 缺失  | **拦** | 可疑：验签库在却没有清单               |
* | koffi 不可用                  | 放行  | 优雅降级，不因 FFI 环境问题堵死功能    |
* | HRESULT 失败 / 文件坏或缺失   | **拦** | 目录被篡改                             |
* | 校验过程抛异常                | **拦** | 保守取向                               |
*
* 与 CLI 侧的唯一实现差异是**同步**：`computePluginMcpConfigs` 在
* `TtlMemoCache` 里同步求值，无法 await，因此这里用 `existsSync`。koffi 的
* `load` / 调用本身就是同步的。
*/
var TAG = "[PluginIntegrityGuard]";
var DLL_NAME = "QmProtectorLib.dll";
var MANIFEST_NAME = "manifest.qmsig";
var DLL_RELATIVE_DIR = (0, path.join)("prebuilds", "win32-x64");
/**
* 需要目录完整性校验的插件名。
*
* 与 CLI 侧 `WeixinpayIntegrityGuard` 的 `WEIXINPAY_PLUGIN_NAME` 对齐；新增受保护
* 插件时两侧都要加，否则会出现「一条车道挡住、另一条放行」的不对称。
*/
var INTEGRITY_GUARDED_PLUGIN_NAMES = new Set(["weixinpay"]);
var nativeRequire = (0, module$1.createRequire)(__filename);
var bindingCache;
/**
* 校验插件安装目录是否与其签名清单一致。
*
* @returns `true` 表示允许投影该插件的 MCP；`false` 表示校验失败，调用方必须跳过。
*/
function verifyPluginDirectoryIntegrity(pluginName, installedPath, logger, deps = {}) {
	const platform = deps.platform ?? process.platform;
	const pathExists = deps.pathExists ?? ((target) => (0, fs.existsSync)(target));
	if (!INTEGRITY_GUARDED_PLUGIN_NAMES.has(pluginName) || platform !== "win32") return true;
	if (!installedPath) {
		logger?.info(`${TAG} ${pluginName} has no installedPath, allowing`);
		return true;
	}
	const dllDir = (0, path.join)(installedPath, DLL_RELATIVE_DIR);
	const dllPath = (0, path.join)(dllDir, DLL_NAME);
	if (!pathExists(dllPath)) {
		logger?.info(`${TAG} ${pluginName}: DLL not found at ${dllPath}, skipping verification`);
		return true;
	}
	const manifestPath = (0, path.join)(installedPath, MANIFEST_NAME);
	if (!pathExists(manifestPath)) {
		logger?.error(`${TAG} ${pluginName}: ${MANIFEST_NAME} NOT FOUND at ${manifestPath}, BLOCKING`);
		return false;
	}
	try {
		const binding = deps.loadBinding ? deps.loadBinding(dllDir) : loadCachedBinding(dllDir, logger);
		if (!binding) {
			logger?.info(`${TAG} ${pluginName}: koffi/DLL binding unavailable, allowing (graceful degradation)`);
			return true;
		}
		const result = binding.verify(installedPath, manifestPath);
		const hrHex = (result.hr >>> 0).toString(16).padStart(8, "0");
		logger?.info(`${TAG} ${pluginName}: verify hr=0x${hrHex} filesOk=${result.filesOk} filesBad=${result.filesBad} filesMissing=${result.filesMissing} extraEntries=${result.extraEntries}`);
		if (result.hr >>> 0 >= 2147483648) {
			logger?.error(`${TAG} ${pluginName}: integrity check FAILED (hr=0x${hrHex}), BLOCKING`);
			return false;
		}
		if (result.filesBad > 0 || result.filesMissing > 0) {
			logger?.error(`${TAG} ${pluginName}: integrity check FAILED (filesBad=${result.filesBad} filesMissing=${result.filesMissing}), BLOCKING`);
			return false;
		}
		return true;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger?.error(`${TAG} ${pluginName}: unexpected verification error: ${message}, BLOCKING`);
		return false;
	}
}
function loadCachedBinding(dllDir, logger) {
	if (bindingCache !== void 0) return bindingCache;
	try {
		const koffi = nativeRequire("koffi");
		const lib = koffi.load((0, path.join)(dllDir, DLL_NAME));
		koffi.struct("QM_SIGNER_VERIFY_OPTIONS", {
			RootDirectory: "str16",
			ManifestPath: "str16",
			KeyDirectory: "str16",
			PublicKeyBlob: "void *",
			PublicKeyBlobSize: "uint32",
			LogCallback: "void *",
			LogContext: "void *"
		});
		koffi.struct("QM_SIGNER_VERIFY_RESULT", {
			FilesOk: "uint32",
			FilesBad: "uint32",
			FilesMissing: "uint32",
			ExtraEntries: "uint32",
			DirectoriesTotal: "uint32",
			PublicKeyThumbprint: koffi.array("uint8", 32)
		});
		const verifyFn = lib.func("int32 __stdcall QmSigner_VerifyDirectoryWithEmbeddedKey(QM_SIGNER_VERIFY_OPTIONS *, QM_SIGNER_VERIFY_RESULT *)");
		bindingCache = { verify(rootDir, manifestPath) {
			const options = {
				RootDirectory: rootDir,
				ManifestPath: manifestPath,
				KeyDirectory: null,
				PublicKeyBlob: null,
				PublicKeyBlobSize: 0,
				LogCallback: null,
				LogContext: null
			};
			const result = {
				FilesOk: 0,
				FilesBad: 0,
				FilesMissing: 0,
				ExtraEntries: 0,
				DirectoriesTotal: 0,
				PublicKeyThumbprint: new Uint8Array(32)
			};
			return {
				hr: verifyFn(options, result),
				filesOk: result.FilesOk,
				filesBad: result.FilesBad,
				filesMissing: result.FilesMissing,
				extraEntries: result.ExtraEntries
			};
		} };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger?.info(`${TAG} failed to create koffi binding: ${message}`);
		bindingCache = null;
	}
	return bindingCache;
}
//#endregion
//#region ../../packages/workbuddy-server/src/connector/poi-consent-registry.ts
/** 默认授权询问超时：60 秒 */
var POI_CONSENT_DEFAULT_TIMEOUT_MS = 6e4;
var PoiConsentRegistry = class {
	constructor() {
		this.pending = /* @__PURE__ */ new Map();
	}
	/**
	* 等待用户对指定 MCP server POI 注入授权。
	*
	* 同名 server 已有 pending 时返回同一 Promise（去重）。
	* 超时后 resolve `'denied'`（fail-closed，不 reject）。
	*/
	wait(mcpServerName, timeoutMs = POI_CONSENT_DEFAULT_TIMEOUT_MS) {
		return this.waitWithFirst(mcpServerName, timeoutMs).promise;
	}
	/**
	* 原子化的 wait + 首次标记：注册 pending 并返回 { promise, isFirst }。
	*
	* `isFirst=true` 表示本次调用创建了新 pending（调用方应推送事件给 renderer）；
	* `isFirst=false` 表示复用已有 pending（无需重复推送）。
	*
	* 解决并发竞态：多个并发 callTool 在同一事件循环 tick 到达时，
	* 只有第一个 `waitWithFirst` 调用 isFirst=true，后续的都复用同一 pending。
	*/
	waitWithFirst(mcpServerName, timeoutMs = POI_CONSENT_DEFAULT_TIMEOUT_MS) {
		const existing = this.pending.get(mcpServerName);
		if (existing) return {
			promise: new Promise((resolve) => {
				const originalResolve = existing.resolve;
				existing.resolve = (result) => {
					originalResolve(result);
					resolve(result);
				};
			}),
			isFirst: false
		};
		return {
			promise: new Promise((resolve) => {
				const timeoutHandle = setTimeout(() => {
					const entry = this.pending.get(mcpServerName);
					if (entry) {
						this.pending.delete(mcpServerName);
						entry.resolve("denied");
					} else resolve("denied");
				}, timeoutMs);
				this.pending.set(mcpServerName, {
					resolve,
					timeoutHandle
				});
			}),
			isFirst: true
		};
	}
	/**
	* 回传用户授权决策，resolve 对应 pending Promise。
	* 找不到 pending 返回 false。
	*/
	answer(mcpServerName, result) {
		const entry = this.pending.get(mcpServerName);
		if (!entry) return false;
		clearTimeout(entry.timeoutHandle);
		this.pending.delete(mcpServerName);
		entry.resolve(result);
		return true;
	}
	/** 取消所有 pending 并 resolve 为 denied（进程退出兜底）。 */
	cancelAll(reason) {
		for (const entry of this.pending.values()) {
			clearTimeout(entry.timeoutHandle);
			entry.resolve("denied");
		}
		this.pending.clear();
	}
	/** 当前 pending 数量（测试 / 诊断用）。 */
	get pendingCount() {
		return this.pending.size;
	}
	/** 检查指定 server 是否已有 pending（用于并发去重推送）。 */
	hasPending(mcpServerName) {
		return this.pending.has(mcpServerName);
	}
};
//#endregion
//#region ../../packages/workbuddy-server/src/connector/poi-consent-store.ts
/**
* PoiConsentStore —— 持久化用户对各 MCP server POI 注入的授权决策。
*
* 文件：`{configDir}/poi-mcp-consent.json`
* 格式：`Record<mcpServerName, 'granted' | 'denied'>`
*
* lazy-load：首次 get/set 时读取文件；写操作立即持久化。
* 文件不存在 / 损坏时静默返回空状态（fail-closed 一致性）。
*/
var CONSENT_FILE_NAME = "poi-mcp-consent.json";
var PoiConsentStore = class {
	constructor(configDir) {
		this.filePath = (0, path.join)(configDir, CONSENT_FILE_NAME);
	}
	get(mcpServerName) {
		this.ensureLoaded();
		return this.data[mcpServerName];
	}
	set(mcpServerName, consent) {
		this.ensureLoaded();
		this.data[mcpServerName] = consent;
		if (consent === "granted") this.persist();
	}
	clear() {
		this.data = {};
		this.persist();
	}
	ensureLoaded() {
		if (this.data !== void 0) return;
		this.data = this.loadFromDisk();
	}
	loadFromDisk() {
		if (!(0, fs.existsSync)(this.filePath)) return {};
		try {
			const raw = (0, fs.readFileSync)(this.filePath, "utf-8");
			const parsed = JSON.parse(raw);
			if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
			const result = {};
			for (const [key, value] of Object.entries(parsed)) if (value === "granted") result[key] = value;
			return result;
		} catch {
			return {};
		}
	}
	persist() {
		try {
			(0, fs.writeFileSync)(this.filePath, JSON.stringify(this.data, null, 2), "utf-8");
		} catch {}
	}
};
//#endregion
//#region ../../packages/workbuddy-server/src/connector/poi-header-builder.ts
/**
* POI Header Builder —— 构建 X-WorkBuddy-User-POI HTTP header。
*
* 当 MCP server 声明 `needsInjectPOI: true` 时，callTool 路径会调用此模块
* 将用户 POI 数据序列化为 Base64(UTF-8(JSON)) 并注入 HTTP 请求 header。
*/
/** POI header 名称常量 */
var POI_HEADER_NAME = "X-WorkBuddy-User-POI";
/**
* 将 POI payload 构建为可注入 HTTP header 的 Record。
*
* 返回 `{ 'X-WorkBuddy-User-POI': base64Value }`，调用方直接合并进 headers。
*/
function buildPoiHeader(poi) {
	const json = JSON.stringify(poi);
	const base64Value = Buffer.from(json, "utf-8").toString("base64");
	return { [POI_HEADER_NAME]: base64Value };
}
//#endregion
//#region ../../packages/workbuddy-server/src/connector/session-poi-cache.ts
var SessionPoiCache = class {
	constructor() {
		this.cache = /* @__PURE__ */ new Map();
	}
	set(sessionId, poi) {
		this.cache.set(sessionId, poi);
	}
	get(sessionId) {
		return this.cache.get(sessionId);
	}
	delete(sessionId) {
		return this.cache.delete(sessionId);
	}
	clear() {
		this.cache.clear();
	}
	get size() {
		return this.cache.size;
	}
};
//#endregion
//#region ../../packages/workbuddy-server/src/connector/version-compatibility.ts
/**
* 将用户提供的 semver 字符串规整为可参与比较的形式。
*
* 无效字符串（或 undefined）返回 null，调用方视为"无约束"，避免 marketplace 脏数据
* 导致客户端全量 connector 被判为不兼容。
*/
function coerceValid(value) {
	if (!value) return null;
	return import_semver.valid(value) ?? null;
}
/**
* 检查 connector 是否与当前 WorkBuddy 版本兼容。
*
* 判定规则（详见 Issue #37956）：
* - `minWorkbuddyVersion` / `maxWorkbuddyVersion` 均缺失或无效 → 兼容（返回 null）
* - 当前版本无效 → 宽松策略，视为兼容
* - 当前版本 < min → 返回 `{ kind: 'needsUpgrade', requiredMinVersion }`
* - 当前版本 > max → 返回 `{ kind: 'connectorRetired' }`
* - 在 `[min, max]` 区间内 → 兼容
*
* 边界：`=` 等于 min 或 max 的情况视为兼容（闭区间）。
* prerelease（如 `4.30.0-beta.1`）参与比较：semver 规则下 `4.30.0-beta.1 < 4.30.0`，
* 所以 beta 客户端对于 min=4.30.0 的 connector 仍会被判为不兼容，需要 connector 侧
* 显式标注 `minWorkbuddyVersion: "4.30.0-beta.0"` 才能让 beta 通过。
*/
function checkCompatibility(input) {
	const current = coerceValid(input.currentVersion);
	if (!current) return null;
	const min = coerceValid(input.minWorkbuddyVersion);
	if (min && import_semver.lt(current, min)) return {
		kind: "needsUpgrade",
		requiredMinVersion: min
	};
	const max = coerceValid(input.maxWorkbuddyVersion);
	if (max && import_semver.gt(current, max)) return { kind: "connectorRetired" };
	return null;
}
//#endregion
//#region ../../packages/workbuddy-server/src/connector/connector-service.ts
/**
* 连接器核心服务
*
* 职责：
* 1. 管理 connector marketplace 下载与缓存
* 2. 启用/禁用 connector：
*    - MCP: 解析并校验运行时描述，保留 OAuth/token 的所有权
*    - Remote MCP: 向 McpService 提供进程内上游 descriptor
*    - stdio MCP: 向会话协调器提供命令描述，由 Agent CLI 启动
*    - Skill: 复制到 ~/.workbuddy/skills/ 目录
* 3. 维护 connector 状态
* 4. 维护 MCP Apps 发现所需的进程内工具目录
* 5. 写入 connectors/mcp.json（合并所有 connector 的 MCP 配置）
*/
require_common$2.init_common();
require_common$2.init_common$3();
require_common$2.init_decorateMetadata();
require_common$2.init_decorate();
var _ref$7, _ref2$4, _ref3$2, _ref4$2, _ConnectorService;
/** Skill 目录前缀（标识 connector 来源） */
var CONNECTOR_SKILL_PREFIX = "connector-";
/** Connector skill 安装目录（相对于 configDir）：与 agent-craft loadConnectorSkills 的扫描路径保持一致 */
var CONNECTOR_SKILLS_DIR = (0, path.join)("connectors", "skills");
function resolveConnectorConfigDir() {
	const workbuddyConfigDir = process.env.WORKBUDDY_CONFIG_DIR?.trim();
	if (workbuddyConfigDir) return workbuddyConfigDir;
	const legacyCodebuddyConfigDir = process.env.CODEBUDDY_CONFIG_DIR?.trim();
	if (legacyCodebuddyConfigDir) return legacyCodebuddyConfigDir;
	return require_runtime_context.getWorkbuddyRuntimeConfigDir();
}
/**
* disableSkills 递归扫描 connector skill 目录时的最大深度。
* 与 agent-cli `SkillProductProvider.MAX_SCAN_DEPTH` 对齐，保证「能被扫到的 SKILL.md 就能被禁用」。
* 同时充当对符号链接环的安全守卫。
*/
var MAX_SKILL_SCAN_DEPTH = 5;
/**
* 判断 fs.watch(单文件) 收到的事件是否真的属于被监听文件。
*
* Windows 下 libuv 对单文件 watch 的实现是监听其父目录（ReadDirectoryChangesW），
* 同目录其它文件的变更事件也可能派发到本 watcher。典型场景：OAuth store 的
* `.credentials.v3.json` 与 `connectors/<uid>/mcp.json` 同目录，MCP OAuth 的
* DCR / token 落盘会被误判为 mcp.json 变更，3 秒后触发 refreshAndSync，在用户
* 还停留在浏览器授权页时以 silent 模式重建 OAuth provider，打断进行中的授权。
*
* 因此只放行 fileName 与被监听文件同名的事件。fileName 缺失（事件缓冲区溢出等
* 场景，macOS/Windows 均可能）时无从判断，保守放行，由 3 秒防抖 + 期望态 diff
* 吸收。代价是 Windows 8.3 短文件名事件会被忽略——mcp.json 的外部改动若以短名
* 写入会漏一次 watcher 触发，但 refreshAndSync 还有 connect/disconnect/唤醒等
* 多个触发源兜底；相比之下误触发会直接打断 OAuth，属于更坏的一侧。
*/
function isEventForWatchedFile(watchedPath, fileName) {
	if (fileName === null || fileName === void 0) return true;
	return String(fileName).toLowerCase() === (0, path.basename)(watchedPath).toLowerCase();
}
var INSTALLED_PLUGINS_FILE_NAME = "installed_plugins.json";
var PLUGIN_CACHE_DIR = "cache";
var WORKBUDDY_BUILTIN_PLUGIN_MARKETPLACE = "workbuddy-builtin";
var AGENT_CLI_INLINE_PLUGIN_MARKETPLACE = "inline";
var PLUGIN_METADATA_DIRS$2 = [
	".codebuddy-plugin",
	".workbuddy-plugin",
	".claude-plugin"
];
function inferConnectorToolRoutes(toolName, configs) {
	return Object.entries(configs).filter(([, config]) => typeof config.url === "string" && !config.command).flatMap(([configId]) => {
		const prefix = `${require_tar$1.toRawConfigId(configId)}_`;
		return toolName.startsWith(prefix) ? [{
			configId,
			remoteToolName: toolName.slice(prefix.length)
		}] : [];
	}).filter((route) => route.remoteToolName.length > 0);
}
/**
* Agent CLI preserves comments and trailing commas in settings.json. Keep the
* daemon reader compatible without making its bundled runtime depend on an
* extra JSONC package.
*/
function parseJsonc(text) {
	const source = text.replace(/^\uFEFF/, "");
	let withoutComments = "";
	let inString = false;
	let escaped = false;
	for (let index = 0; index < source.length; index++) {
		const char = source[index];
		const next = source[index + 1];
		if (inString) {
			withoutComments += char;
			if (escaped) escaped = false;
			else if (char === "\\") escaped = true;
			else if (char === "\"") inString = false;
			continue;
		}
		if (char === "\"") {
			inString = true;
			withoutComments += char;
			continue;
		}
		if (char === "/" && next === "/") {
			withoutComments += "  ";
			index += 2;
			while (index < source.length && source[index] !== "\n") {
				withoutComments += " ";
				index++;
			}
			if (index < source.length) withoutComments += source[index];
			continue;
		}
		if (char === "/" && next === "*") {
			withoutComments += "  ";
			index += 2;
			while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
				withoutComments += source[index] === "\n" ? "\n" : " ";
				index++;
			}
			if (index < source.length) {
				withoutComments += "  ";
				index++;
			}
			continue;
		}
		withoutComments += char;
	}
	let normalized = "";
	inString = false;
	escaped = false;
	for (let index = 0; index < withoutComments.length; index++) {
		const char = withoutComments[index];
		if (inString) {
			normalized += char;
			if (escaped) escaped = false;
			else if (char === "\\") escaped = true;
			else if (char === "\"") inString = false;
			continue;
		}
		if (char === "\"") {
			inString = true;
			normalized += char;
			continue;
		}
		if (char === ",") {
			let lookahead = index + 1;
			while (/\s/.test(withoutComments[lookahead] || "")) lookahead++;
			if (withoutComments[lookahead] === "}" || withoutComments[lookahead] === "]") continue;
		}
		normalized += char;
	}
	return JSON.parse(normalized);
}
var EXTERNALLY_MANAGED_TOKEN_REFRESH_TIMEOUT_MS = 5e3;
var EXTERNALLY_MANAGED_TOKEN_RETRY_DELAYS_MS = [
	1e3,
	3e3,
	1e4
];
var EXTERNALLY_MANAGED_STALE_TOKEN_GUARD_TTL_MS = 6e4;
var UNAUTHORIZED_NOTIFY_THROTTLE_MS = 5e3;
/** 公网 marketplace server-side 授权：/status 轮询间隔与整体超时 */
var PUBLIC_SERVER_SIDE_AUTH_POLL_INTERVAL_MS = 2e3;
var PUBLIC_SERVER_SIDE_AUTH_TIMEOUT_MS = 300 * 1e3;
var EXTERNALLY_MANAGED_AUTH_FAILURE_CODES = new Set([
	41,
	401,
	403,
	422,
	10101
]);
/** main 主导续票的 externally-managed MCP host，IMA 使用 mcp_token 原样写入 Authorization。 */
var EXTERNALLY_MANAGED_TOKEN_REFRESH_HOSTS = new Set([
	"mcp.lexiang-app.com",
	"docs.qq.com",
	"ima.qq.com",
	"ima-test.qq.com"
]);
/**
* C 端资料库授权会向 connector 同步凭据的三家 host 白名单。
*
* 这里**故意不复用** `EXTERNALLY_MANAGED_TOKEN_REFRESH_HOSTS`，因为后者会被
* `isExternallyManagedConnector` 与企业态（OneID / iOA）逻辑串联。本常量
* 仅用于识别资料库凭据同步并记录 everConnected，保持与企业态判定解耦。
*/
var C_SIDE_AUTO_BOUND_CONNECTOR_HOSTS = new Set([
	"mcp.lexiang-app.com",
	"docs.qq.com",
	"ima.qq.com",
	"ima-test.qq.com"
]);
var MARKETPLACE_CLOUD_PRIMARY_WAIT_MS = 3e3;
var MARKETPLACE_CLOUD_MAX_WAIT_MS = 1e4;
var AUTH_INJECTION_LOG_PREFIX = "[ConnectorAuthInjection]";
var AUTH_INJECTION_SKIP_LOG_THROTTLE_MS = 6e4;
var DEFAULT_CONNECTOR_HOST_CAPABILITIES = {
	fetch: (url, init) => globalThis.fetch(url, init),
	openExternal: async () => {
		throw new Error("ConnectorService host capability openExternal is not available");
	},
	openPath: async () => {
		throw new Error("ConnectorService host capability openPath is not available");
	},
	getAppVersion: () => void 0,
	getSystemLocale: () => process.env.LANG || "en",
	sendRuntimeProgress: () => {
		throw new Error("ConnectorService host capability sendRuntimeProgress is not available");
	}
};
var ConnectorService = class ConnectorService {
	static {
		_ConnectorService = this;
	}
	/**
	* 判断当前是否应使用英文显示 connector name / description。
	* 委托给 `connector-locale.ts::isEnglishConnectorLocale`，与
	* daemon 可读取的持久化配置 / product 配置共用同一套优先级链。
	* 详见 `connector-locale.ts` 文件头注释。
	*/
	isEnglishLocale() {
		return isEnglishConnectorLocale({
			configDir: this.configDir,
			getProductLocale: () => this.resolveProductLocale(),
			getSystemLocale: () => this.hostCapabilities.getSystemLocale()
		});
	}
	getCurrentProductConfiguration() {
		const productManager = this.productManager;
		return productManager?.getCurrentConfiguration?.() ?? productManager?.configuration?.getValue?.();
	}
	resolveProductLocale() {
		const product = this.getCurrentProductConfiguration();
		if (!product) return;
		if (product.isOversea === true) return "en-US";
		if (product.isOversea === false) return "zh-CN";
		const productEndpoints = [
			product.endpoint,
			product.updateUrl,
			product.websiteHomeUrl
		].filter((value) => typeof value === "string" && value.length > 0).join(" ").toLowerCase();
		if (/(^|[/:.])(?:copilot\.tencent\.com|codebuddy\.cn|copilot\.qq\.com)(?:[/:\s]|$)/.test(productEndpoints)) return "zh-CN";
		if (/(^|[/:.])codebuddy\.ai(?:[/:\s]|$)/.test(productEndpoints)) return "en-US";
	}
	resolveLocalizedName(entry) {
		const isEnglish = this.isEnglishLocale();
		return this.resolveLocalizedMapText(entry.name_map, isEnglish) ?? (isEnglish ? entry.name_en || entry.name : entry.name_zh || entry.name);
	}
	resolveLocalizedDescription(entry) {
		const isEnglish = this.isEnglishLocale();
		return this.resolveLocalizedMapText(entry.description_map, isEnglish) ?? (isEnglish ? entry.description_en || entry.description : entry.description_zh || entry.description);
	}
	/**
	* 按当前 locale 选定"去试试"示例提示词：英文环境取 examples_en、中文环境取 examples_zh，
	* 任一缺失则回退另一语言；两者皆空返回 undefined。与 name/description 的语言合并策略一致
	* （在 daemon 侧收敛为单字段，避免 wire / domain / UI 透传双语言）。
	*/
	resolveLocalizedExamples(entry) {
		const isEnglish = this.isEnglishLocale();
		const primary = isEnglish ? entry.examples_en : entry.examples_zh;
		const fallback = isEnglish ? entry.examples_zh : entry.examples_en;
		const picked = primary && primary.length > 0 ? primary : fallback;
		return picked && picked.length > 0 ? picked : void 0;
	}
	resolveLocalizedMapText(map, isEnglish) {
		if (!map) return;
		const targetLocale = isEnglish ? "en" : "zh";
		for (const candidateKey of this.getLocalizedMapCandidateKeys()) for (const [rawKey, text] of Object.entries(map)) if (this.parseLocalizedMapKey(rawKey).includes(candidateKey)) {
			const value = text?.[targetLocale]?.trim();
			if (value) return value;
		}
	}
	getLocalizedMapCandidateKeys() {
		const context = this.getConnectorAccountContext();
		const candidates = [];
		if (require_tar$1.isIOAEnterprise(context.enterpriseId)) candidates.push("iOA");
		if (context.accountType) candidates.push(`plan:${context.accountType}`);
		const networkEnvironment = this.getCurrentProductConfiguration()?.networkEnvironment;
		if (typeof networkEnvironment === "string" && networkEnvironment.length > 0) candidates.push(networkEnvironment);
		return candidates;
	}
	parseLocalizedMapKey(key) {
		return key.split(/[;,]/).map((part) => part.trim()).filter(Boolean);
	}
	setRuntimeMcpStatus(configId, value) {
		if (value) this.runtimeMcpStatuses.set(configId, value);
		else this.runtimeMcpStatuses.delete(configId);
		if (configId.startsWith(this.CUSTOM_MCP_PREFIX)) this.stateChangedNotifier?.({
			configId,
			status: value?.status ?? "disconnected",
			error: value?.error
		});
	}
	static {
		this.CONNECT_INTENT_TTL_MS = 600 * 1e3;
	}
	/** 获取当前登录用户 ID，未登录时返回 'default' */
	getUserId() {
		const status = this.authService?.getStatus?.();
		return status?.loggedIn && status.user?.id ? status.user.id : "default";
	}
	createOAuthStore(userId = this.getUserId()) {
		return new require_tar$1.ConnectorOAuthStore(userId, { backupBaseDir: require_runtime_context.getWorkbuddyRuntimeUserDataDir() });
	}
	getCurrentEnterpriseId() {
		return this.authService?.getAccount?.()?.enterpriseId ?? "";
	}
	getCurrentAccountType() {
		const account = this.authService?.getAccount?.();
		return account?.type ?? account?.accountType ?? "";
	}
	getConnectorAccountContext() {
		return require_tar$1.deriveAccountContext({
			userId: this.getUserId(),
			enterpriseId: this.getCurrentEnterpriseId(),
			accountType: this.getCurrentAccountType(),
			networkEnvironment: this.getCurrentProductConfiguration()?.networkEnvironment
		});
	}
	getCurrentAccountIdentityKey() {
		const ctx = this.getConnectorAccountContext();
		return `${ctx.userId}|${ctx.enterpriseId}|${ctx.variantKey}`;
	}
	getLegacyAccountIdentityKey() {
		return `${this.getUserId()}|${this.getCurrentEnterpriseId()}`;
	}
	/** 是否完成过首次接入（进入开关管理生命周期）。 */
	isBound(configId) {
		return this.persistentState.connectors[configId]?.bound === true;
	}
	/** 用户当前是否要求启用（`bound=false` 恒为 false）。 */
	isEnabled(configId) {
		const entry = this.persistentState.connectors[configId];
		return entry?.bound === true && entry.enabled === true;
	}
	/** 所有 `bound && enabled` 的 connector id（运行准入 / 自动初始化的唯一判据）。 */
	getEnabledConnectorIds() {
		return Object.entries(this.persistentState.connectors).filter(([, entry]) => entry.bound && entry.enabled).map(([id]) => id);
	}
	/**
	* 完整 connect 成功的生命周期提交：`bound=true, enabled=true` 并落盘。
	*
	* 唯一保护：`bound=true, enabled=false`（用户显式关闭）且无进行中的用户 connect
	* 意图时拒绝提交——过期系统回调不得替用户重新打开开关（issue #89924 家族）。
	* 提交后消费掉 pending 意图。
	*/
	commitConnectSuccess(configId) {
		const entry = this.persistentState.connectors[configId];
		const hasIntent = this.hasActiveConnectIntent(configId);
		if (entry?.bound && !entry.enabled && !hasIntent) {
			this.logger.warn(`[ConnectorService] refuse lifecycle commit for ${configId}: user disabled and no active connect intent (stale system callback?)`);
			return;
		}
		this.clearConnectIntent(configId);
		if (entry?.bound && entry.enabled) return;
		this.persistentState.connectors[configId] = {
			bound: true,
			enabled: true
		};
		this.savePersistentState("connect-success");
	}
	/** disconnect：只关闭 enabled，保留 bound 与凭据；未绑定时为 no-op。 */
	markConnectorDisabled(configId) {
		const entry = this.persistentState.connectors[configId];
		if (!entry?.bound) return;
		if (entry.enabled) this.persistentState.connectors[configId] = {
			bound: true,
			enabled: false
		};
	}
	/** 标记为已绑定（如 C 端资料库授权自动接入）；不改变既有 enabled 意图。 */
	markConnectorBound(configId) {
		if (this.persistentState.connectors[configId]?.bound) return;
		this.persistentState.connectors[configId] = {
			bound: true,
			enabled: false
		};
	}
	/** unbind 完整成功：退出开关管理生命周期（删除条目 = bound/enabled 均 false）。 */
	clearConnectorLifecycle(configId) {
		delete this.persistentState.connectors[configId];
	}
	registerConnectIntent(configId) {
		this.pendingConnectIntents.set(configId, Date.now());
	}
	clearConnectIntent(configId) {
		this.pendingConnectIntents.delete(configId);
	}
	hasActiveConnectIntent(configId) {
		const startedAt = this.pendingConnectIntents.get(configId);
		if (startedAt === void 0) return false;
		if (Date.now() - startedAt > _ConnectorService.CONNECT_INTENT_TTL_MS) {
			this.pendingConnectIntents.delete(configId);
			return false;
		}
		return true;
	}
	/**
	* 判定 connector 是否属于"C 端资料库授权后自动接入"的三家。
	*
	* 仅按 host 命中判断，不掺杂企业态 / OneID / iOA 相关分支，
	* 与 `isExternallyManagedConnector` 解耦。
	*
	* 注：与 `isExternallyManagedConnector` 一致，对 `getLatestServerConfigForConnector`
	* 的调用做 try/catch 兜底——baseDir 未初始化 / mcp.json 损坏等场景会抛异常，
	* 此处视为"无法判定"，返回 false 让 connector 走原恢复路径。
	*/
	isCSideAutoBoundConnector(configId) {
		let serverConfig;
		try {
			serverConfig = this.getLatestServerConfigForConnector(configId);
		} catch {
			return false;
		}
		if (!serverConfig?.url) return false;
		try {
			const host = new URL(serverConfig.url).host;
			return C_SIDE_AUTO_BOUND_CONNECTOR_HOSTS.has(host);
		} catch {
			return false;
		}
	}
	resolveNetdriveMcpUrl(devEntry) {
		if (isValidNetdriveDevMcpServer(devEntry)) return devEntry.url;
		const endpoint = this.productManager?.getEndpoint?.();
		if (!endpoint || typeof endpoint !== "string" || endpoint.length === 0) return;
		return endpoint.replace(/\/+$/, "") + BUILTIN_NETDRIVE_MCP_PATH;
	}
	buildNetdriveHeaders() {
		const status = this.authService.getStatus();
		if (!status.loggedIn || !status.user?.id) return;
		let authHeaders;
		try {
			authHeaders = this.authService.buildAuthHeaders(true, true, false);
		} catch (err) {
			this.logger.warn("[ConnectorService] buildNetdriveHeaders: buildAuthHeaders threw", err);
			return;
		}
		const authorization = authHeaders.Authorization ?? authHeaders.authorization;
		if (!authorization || authorization.length === 0) {
			this.logger.warn("[ConnectorService] buildNetdriveHeaders: no Authorization header from authService, skip netdrive injection");
			return;
		}
		return {
			...authHeaders,
			Authorization: authorization,
			[NETDRIVE_HEADER_USER_ID]: status.user.id
		};
	}
	/**
	* 决议生效的 netdrive MCP 配置：
	* - 用户 mcp.json 显式声明带 dev:true + url 的合法条目时，使用 dev URL（本地后端联调）
	* - 否则使用内置远端 URL（productManager.getEndpoint() + BUILTIN_NETDRIVE_MCP_PATH）
	*
	* netdrive **常驻声明**：只要已登录（headers 可构造）+ URL 就绪即发布到 MCP catalog，
	* 不再依赖进程级 activeNetdriveProjectId 门控。会话隔离按「本会话 projectId」判定：
	*   1) McpService config projection 对个人会话（无 projectId）不声明 netdrive；
	*   2) 每次 tool call 的 per-request X-Project-Id 按发起会话的 projectId 注入。
	* 这样个人会话在「看得到 / 声明 / 换票」三处都不暴露 netdrive，且多项目并发不再靠进程级切换。
	*
	* headers / URL 任一缺失时返回 undefined，下次 refreshAndSync 时会再尝试
	* （productManager / authService 完成初始化后即可）。
	*/
	resolveEffectiveNetdriveMcpServer(userEntry) {
		const headers = this.buildNetdriveHeaders();
		if (!headers) return;
		const url = this.resolveNetdriveMcpUrl(userEntry);
		if (!url) return;
		return createBuiltinNetdriveMcpServer(headers, url);
	}
	constructor() {
		this.runtimeMcpServerConfigListeners = /* @__PURE__ */ new Set();
		this.states = /* @__PURE__ */ new Map();
		this.runtimeMcpInspections = /* @__PURE__ */ new Map();
		this.runtimeMcpStatuses = /* @__PURE__ */ new Map();
		this.pendingCliConnects = /* @__PURE__ */ new Map();
		this.pendingRuntimeAuthRefreshes = /* @__PURE__ */ new Map();
		this.pendingOps = /* @__PURE__ */ new Map();
		this.pendingCliAborts = /* @__PURE__ */ new Map();
		this.pendingServerSideAuthAborts = /* @__PURE__ */ new Map();
		this.persistentState = {
			connectors: {},
			headerOverrides: {},
			envOverrides: {},
			disabledToolsOverrides: {}
		};
		this.pendingConnectIntents = /* @__PURE__ */ new Map();
		this.persistentStateLoadedIdentityKey = null;
		this.pendingMcpSecurityMigration = false;
		this.runtimeRevision = 0;
		this.initPromise = null;
		this.marketplaceProductConfigurationState = "pending";
		this.marketplaceProductConfigurationGeneration = 0;
		this.marketplaceSyncChain = Promise.resolve();
		this.marketplaceDesiredGeneration = 0;
		this.marketplaceDisposed = false;
		this.sessionPoiCache = new SessionPoiCache();
		this.poiConsentRegistry = new PoiConsentRegistry();
		this.updateTimer = null;
		this.mcpConfigWatchers = [];
		this.mcpConfigDebounceTimer = null;
		this.lastSelfWriteConnectorMcpAt = 0;
		this.lastSelfWriteCustomMcpAt = 0;
		this.mcpJsonCache = new JsonFileCache((filePath) => safeReadJsonFile(filePath, { mcpServers: {} }));
		this.pluginMcpConfigsCache = new TtlMemoCache(() => this.computePluginMcpConfigs(), 6e4);
		this.marketplaceManifestCache = new JsonFileCache((filePath) => safeReadJsonFile(filePath, null));
		this.authInjectionRuleCache = {
			rules: [],
			byConnector: /* @__PURE__ */ new Map()
		};
		this.authInjectionSkipLogThrottle = /* @__PURE__ */ new Map();
		this.serverSideOauthRefresher = null;
		this.hostCapabilities = DEFAULT_CONNECTOR_HOST_CAPABILITIES;
		this.externallyManagedTokenRetryTimers = /* @__PURE__ */ new Map();
		this.externallyManagedTokenRetryAttempts = /* @__PURE__ */ new Map();
		this.externallyManagedStaleTokenGuard = /* @__PURE__ */ new Map();
		this.unauthorizedNotifyThrottle = /* @__PURE__ */ new Map();
		this.lastBoundIdentityKey = null;
		this.accountChangeUnsubscribe = null;
		this.userChangeChain = Promise.resolve();
		this.lastObservedFeatureKey = null;
		this.productFeatureChangeUnsubscribe = null;
		this.featureChangeChain = Promise.resolve();
		this.oneidApplicationsCache = /* @__PURE__ */ new Map();
		this.CUSTOM_MCP_PREFIX = "custom-mcp:";
		this.userServerApprovals = /* @__PURE__ */ new Map();
		this.approvalsLoaded = false;
		this.configDir = resolveConnectorConfigDir();
		this.baseDir = (0, path.join)(this.configDir, require_tar$1.CONNECTORS_MARKETPLACE_DIR);
		this.poiConsentStore = new PoiConsentStore(this.configDir);
	}
	async init(options) {
		if (this.initPromise) return this.initPromise;
		this.marketplaceDisposed = false;
		this.productConfigurationReady = options?.productConfigurationReady;
		this.resolveProductConfiguration = options?.resolveProductConfiguration;
		this.startMarketplaceProductConfigurationResolution("startup");
		this.initPromise = this.doInit();
		return this.initPromise;
	}
	async prepareRuntimeMcpServing() {
		await this.ensureInitialized();
	}
	async getConfigs() {
		const configs = await this.getAllConfigs();
		let networkEnvironment;
		try {
			networkEnvironment = await this.productEnvService.getCurrent();
		} catch (error) {
			this.logger.warn("[ConnectorService] Failed to resolve product environment; applying connector visibility without environment rules:", error);
		}
		let account;
		try {
			account = this.authService.getAccount();
		} catch (error) {
			this.logger.warn("[ConnectorService] Failed to resolve account; applying connector visibility without account rules:", error);
		}
		return configs.filter((config) => require_tar$1.isConnectorVisible(config.visibleIn, {
			networkEnvironment,
			enterpriseId: account?.enterpriseId,
			accountType: account?.type ?? account?.accountType
		}));
	}
	async getAllConfigs() {
		await this.ensureInitialized();
		const manifest = this.readLocalManifest();
		if (!manifest?.connectors) return [];
		const configs = [];
		for (const entry of manifest.connectors) {
			const config = this.buildConnectorConfig(entry);
			if (config) configs.push(config);
		}
		return configs;
	}
	/**
	* 统一 projector：persisted bound/enabled + 当前进程运行时状态 + reason + discovery tools
	* → ConnectorStateMap。
	*
	* 键集合 = 持久化生命周期条目 ∪ 运行时状态条目（首次 connect 失败的 connector
	* 仍以 bound=false/enabled=false + reason 返回）。catalog 中从未接触过的 connector
	* 不产生条目，消费方按缺省未绑定态处理。
	*
	* 投影时强制不变量：`connected = bound && enabled && runtime.status === 'connected'`；
	* connected=true 时不携带 reason。
	*/
	async getStates() {
		const result = {};
		const ids = new Set([...Object.keys(this.persistentState.connectors), ...this.states.keys()]);
		for (const id of ids) {
			const bound = this.isBound(id);
			const enabled = this.isEnabled(id);
			const runtime = this.states.get(id);
			const connected = bound && enabled && runtime?.status === "connected";
			const inspection = this.runtimeMcpInspections.get(require_tar$1.toRuntimeMcpConfigId(id));
			result[id] = {
				configId: id,
				bound,
				enabled,
				connected,
				reason: connected ? void 0 : this.buildStateReason(id, runtime),
				tools: inspection?.tools.map((tool) => ({
					name: tool.name,
					description: tool.description
				}))
			};
		}
		return result;
	}
	/**
	* 由内部运行时状态推导最小错误事实 `reason`。
	*
	* - `unauthorized` → `auth-required`（token 连接器不产生 auth 类 reason，
	*   其失败通过 tokenConfigRequired 事件驱动表单，映射为 `config-required`）
	* - `error` → 显式 reasonCode 或默认 `runtime`
	* - 其余（disconnected / connecting / 无运行时条目）→ 无 reason；
	*   授权中/初始化中的进度属于该次异步调用方的本地 pending 状态。
	*/
	buildStateReason(configId, runtime) {
		if (!runtime) return;
		if (runtime.status === "unauthorized") {
			if (this.getConnectorConfigById(configId)?.authMode === "token") return runtime.error ? {
				code: "config-required",
				message: runtime.error
			} : void 0;
			return {
				code: runtime.reasonCode ?? "auth-required",
				message: runtime.error ?? "Authorization required"
			};
		}
		if (runtime.status === "error") return {
			code: runtime.reasonCode ?? "runtime",
			message: runtime.error ?? "Connector runtime error"
		};
	}
	/**
	* Issue #59703: 同 configId 操作串行化。把 op 链到该 configId 当前的 pending
	* 链尾，前一个无论成败都放行下一个（用 then(op, op) 而不是 then(op).catch(op)
	* 避免重复触发）。链尾自动 GC。
	*
	* **不要**在 op 内部用同一 configId 再次调用本方法 → 自死锁。内部转调统一
	* 走私有 `doConnect` / `doDisconnect`。
	*/
	runOpExclusive(configId, op) {
		const next = (this.pendingOps.get(configId) ?? Promise.resolve()).then(op, op);
		this.pendingOps.set(configId, next);
		next.catch(() => {}).finally(() => {
			if (this.pendingOps.get(configId) === next) this.pendingOps.delete(configId);
		});
		return next;
	}
	async connect(configId, options) {
		return this.runOpExclusive(configId, () => {
			if (options?.userInitiated ?? options?.silent !== true) {
				this.registerConnectIntent(configId);
				if (this.isBound(configId) && !this.isEnabled(configId)) {
					this.persistentState.connectors[configId] = {
						bound: true,
						enabled: true
					};
					this.savePersistentState("toggle-enable");
				}
			}
			return this.doConnect(configId, options);
		});
	}
	async doConnect(configId, options) {
		const connectorConfig = this.getConnectorConfigById(configId);
		if (connectorConfig?.versionIncompatibility) {
			const incompat = connectorConfig.versionIncompatibility;
			const reason = incompat.kind === "needsUpgrade" ? `需升级 WorkBuddy 到 ${incompat.requiredMinVersion} 或更新版本以使用此连接器` : "该连接器暂不可用，请等待更新";
			this.logger.warn(`[ConnectorService] Block connect for incompatible connector ${configId}: ${reason}`);
			return {
				success: false,
				error: reason
			};
		}
		if (connectorConfig && this.isCliConnector(connectorConfig)) return this.connectCli(configId, connectorConfig, { allowAuthorization: options?.silent !== true });
		if (connectorConfig?.authMode === "token" && connectorConfig.tokenConfig) {
			const envOverrides = this.persistentState.envOverrides[configId] || {};
			if (connectorConfig.tokenConfig.fields.find((f) => f.required && !(envOverrides[f.key] && envOverrides[f.key].length > 0))) {
				this.updateState(configId, "disconnected");
				if (!options?.silent) this.tokenConfigRequiredNotifier?.({
					configId,
					reason: "missing"
				});
				return {
					success: false,
					needsTokenConfig: true
				};
			}
		}
		if (connectorConfig && this.isSkillOnlyConnector(connectorConfig)) return this.connectSkillOnly(configId, { silent: Boolean(options?.silent) });
		const abortController = new AbortController();
		this.pendingCliAborts.set(configId, abortController);
		const signal = abortController.signal;
		try {
			this.updateState(configId, "connecting");
			if (connectorConfig?.cliConfig) {
				const preAuthResult = await this.runPreCliAuth(configId, connectorConfig, signal);
				if (!preAuthResult.success) {
					if (preAuthResult.cancelled || signal.aborted) {
						this.clearConnectIntent(configId);
						this.updateState(configId, "disconnected");
					} else {
						this.clearConnectIntent(configId);
						this.updateState(configId, "error", preAuthResult.error);
					}
					return preAuthResult;
				}
			}
			if (signal.aborted) {
				this.clearConnectIntent(configId);
				this.updateState(configId, "disconnected");
				return {
					success: false,
					error: "Cancelled by user",
					cancelled: true
				};
			}
			const mcpConfig = configId.startsWith(this.CUSTOM_MCP_PREFIX) ? this.readCustomMcpConfigForConnect(configId) : this.readConnectorMcpConfig(configId);
			if (!mcpConfig) throw new Error(`MCP config not found for connector: ${configId}`);
			this.maybeApplyGatewayIdentityHeaders(configId);
			const enterpriseTokenSync = await this.syncEnterpriseConnectorTokenBeforeConnect(configId);
			if (!enterpriseTokenSync.success) {
				this.updateState(configId, enterpriseTokenSync.needsAuthorize ? "unauthorized" : "error", enterpriseTokenSync.error);
				return {
					success: false,
					error: enterpriseTokenSync.error
				};
			}
			const externalTokenSync = await this.syncExternallyManagedConnectorTokenBeforeConnect(configId);
			if (!externalTokenSync.success) {
				this.updateState(configId, externalTokenSync.needsAuthorize ? "unauthorized" : "error", externalTokenSync.error);
				return {
					success: false,
					error: externalTokenSync.error
				};
			}
			if (this.isExternallyManagedStaleTokenGuardActive(configId, externalTokenSync.tokenFingerprint)) {
				const error = this.getExternallyManagedStaleTokenError(configId);
				this.updateState(configId, "unauthorized", error);
				return {
					success: false,
					error,
					needsAuth: true
				};
			}
			const mergedConfig = this.buildRuntimeMcpConfig(configId, mcpConfig);
			const firstServerName = Object.keys(mergedConfig.mcpServers)[0];
			if (!firstServerName) throw new Error(`No MCP servers in config for connector: ${configId}`);
			let serverConfig = mergedConfig.mcpServers[firstServerName];
			this.resolveStagingConnectorUrl(configId, serverConfig);
			const syncConfigId = require_tar$1.toRuntimeMcpConfigId(configId);
			const isTokenConnector = connectorConfig?.authMode === "token";
			const isWorkBuddyManagedAuth = serverConfig._workbuddyManagedAuth === require_tar$1.WORKBUDDY_MANAGED_AUTH_ENTERPRISE;
			const entry = this.getMarketplaceEntryById(configId);
			const isServerSideAuth = entry ? this.resolveActiveAuthMode(entry) === "server-side" : false;
			if (!options?.skipClearClientInfo && serverConfig.url && !isTokenConnector && !isWorkBuddyManagedAuth && !isServerSideAuth) {
				const oauthStore = this.createOAuthStore();
				if (!oauthStore.loadTokens(syncConfigId, serverConfig.url, serverConfig.headers)?.refresh_token) this.oauthManager.invalidateCredentials(syncConfigId, serverConfig.url, "client", serverConfig.headers);
				else if (!oauthStore.loadClientInfo(syncConfigId, serverConfig.url, serverConfig.headers)?.client_id) this.oauthManager.invalidateCredentials(syncConfigId, serverConfig.url, "tokens", serverConfig.headers);
			}
			if (isServerSideAuth && !isWorkBuddyManagedAuth) {
				const { handled } = await this.startPublicServerSideAuth(configId, Boolean(options?.silent), signal);
				if (handled) {
					this.updateState(configId, "unauthorized");
					return {
						success: false,
						error: "Authorization in progress",
						needsTokenConfig: void 0
					};
				}
				serverConfig = this.buildRuntimeMcpConfig(configId, mcpConfig).mcpServers[firstServerName] ?? serverConfig;
			}
			if (signal.aborted) {
				this.clearConnectIntent(configId);
				this.updateState(configId, "disconnected");
				return {
					success: false,
					error: "Cancelled by user",
					cancelled: true
				};
			}
			const isStdioMcp = typeof serverConfig.command === "string" && serverConfig.command.length > 0;
			if (!isStdioMcp && serverConfig.url && !isTokenConnector && !isWorkBuddyManagedAuth && !isServerSideAuth) try {
				await this.oauthManager.refreshTokenIfNeeded(syncConfigId, serverConfig.url, serverConfig.headers, (message) => require_tar$1.isRemoteMcpClientUnauthorizedError(new Error(message)));
			} catch (error) {
				this.logger.warn(`[ConnectorService] connect(${configId}): pre-connect OAuth refresh failed, continuing`, error);
			}
			let connectResult = isStdioMcp ? { success: true } : await this.inspectRemoteMcp(syncConfigId, serverConfig, options?.silent === true, !isTokenConnector);
			if (!connectResult.success && connectResult.needsAuth && !connectResult.authFlowStarted && !options?.silent && serverConfig.url && !isTokenConnector && !isWorkBuddyManagedAuth && !isServerSideAuth) {
				this.logger.info(`[ConnectorService] ${configId}: stale OAuth credentials rejected before authorization redirect; clearing access token and retrying interactive OAuth`);
				this.oauthManager.invalidateCredentials(syncConfigId, serverConfig.url, "tokens", serverConfig.headers);
				connectResult = await this.inspectRemoteMcp(syncConfigId, serverConfig, false, true);
			}
			if (signal.aborted) {
				this.clearConnectIntent(configId);
				this.updateState(configId, "disconnected");
				return {
					success: false,
					error: "Cancelled by user",
					cancelled: true
				};
			}
			if (!connectResult.success) {
				const status = connectResult.needsAuth && !isTokenConnector ? "unauthorized" : "error";
				if (!connectResult.needsAuth) this.clearConnectIntent(configId);
				this.updateState(configId, status, connectResult.error);
				this.disableSkills(configId);
				if (connectorConfig?.authMode === "token" && !options?.silent) this.tokenConfigRequiredNotifier?.({
					configId,
					reason: "connect-failed",
					errorMessage: connectResult.error
				});
				return {
					success: false,
					error: connectResult.error,
					needsTokenConfig: isTokenConnector && options?.silent === false ? false : void 0
				};
			}
			this.installSkills(configId);
			this.commitConnectSuccess(configId);
			this.writeConnectorsMcpConfig();
			this.maybeScheduleServerSideOauth(configId);
			this.refreshAndSync().catch((err) => {
				this.logger.warn("[ConnectorService] refreshAndSync after connect failed:", err);
			});
			this.updateState(configId, "connected");
			return { success: true };
		} catch (error) {
			if (signal.aborted) {
				this.clearConnectIntent(configId);
				this.updateState(configId, "disconnected");
				return {
					success: false,
					error: "Cancelled by user",
					cancelled: true
				};
			}
			const message = error instanceof Error ? error.message : String(error);
			this.logger.error(`[ConnectorService] connect(${configId}) failed:`, message);
			this.clearConnectIntent(configId);
			this.updateState(configId, "error", message);
			return {
				success: false,
				error: message
			};
		} finally {
			this.pendingCliAborts.delete(configId);
		}
	}
	async inspectRemoteMcp(configId, initialConfig, silent, allowOAuth) {
		if (!initialConfig.url) return {
			success: false,
			error: "Remote MCP config is missing url"
		};
		this.setRuntimeMcpStatus(configId, { status: "connecting" });
		let serverConfig = initialConfig;
		if (this.ioaAuth) try {
			const ioaResult = await this.ioaAuth.handleConnect(configId, serverConfig, silent, {
				onNeedsAuth: () => void 0,
				onAuthorized: async (decoratedConfig) => {
					const result = await this.inspectRemoteMcp(configId, decoratedConfig, true, false);
					const rawId = this.normalizeRuntimeMcpConfigId(configId);
					if (configId.startsWith("connector:") && !this.isConnectorStillEnabled(rawId)) {
						this.setRuntimeMcpStatus(configId);
						this.runtimeMcpInspections.delete(configId);
					} else if (result.success) {
						this.updateState(rawId, "connected");
						this.notifyRuntimeMcpServerConfigsChanged({ credentialsChanged: true });
					}
					if (configId.startsWith("connector:")) this.oauthManager.notifyCompleted({
						configId,
						success: result.success,
						error: result.error
					});
				}
			});
			if (ioaResult.handled) return {
				success: false,
				needsAuth: true,
				authFlowStarted: true,
				error: "IOA authorization in progress"
			};
			serverConfig = ioaResult.serverConfig;
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
		const serverUrl = serverConfig.url;
		if (!serverUrl) return {
			success: false,
			error: "Remote MCP config is missing url"
		};
		const inspect = async (oauthBaseUrlOverride) => this.remoteMcpClient.inspectRemote(configId, {
			...serverConfig,
			url: serverUrl
		}, {
			silent,
			allowOAuth,
			...oauthBaseUrlOverride !== void 0 ? { oauthBaseUrlOverride } : {}
		});
		try {
			const inspection = await inspect();
			this.runtimeMcpInspections.set(configId, inspection);
			this.setRuntimeMcpStatus(configId, { status: "connected" });
			await this.persistIoaServerSideAuthHeaders(configId, serverConfig);
			return {
				success: true,
				tools: inspection.tools.map((tool) => ({
					name: tool.name,
					description: tool.description
				}))
			};
		} catch (firstError) {
			if (allowOAuth && require_tar$1.isRedirectUriRejectionError(firstError)) {
				this.oauthManager.invalidateCredentials(configId, serverUrl, "all", serverConfig.headers);
				try {
					const inspection = await inspect("");
					this.runtimeMcpInspections.set(configId, inspection);
					this.setRuntimeMcpStatus(configId, { status: "connected" });
					await this.persistIoaServerSideAuthHeaders(configId, serverConfig);
					return {
						success: true,
						tools: inspection.tools.map((tool) => ({
							name: tool.name,
							description: tool.description
						}))
					};
				} catch (fallbackError) {
					return this.toRemoteInspectionFailure(configId, fallbackError, allowOAuth);
				}
			}
			return this.toRemoteInspectionFailure(configId, firstError, allowOAuth);
		}
	}
	toRemoteInspectionFailure(configId, error, allowOAuth) {
		const message = error instanceof Error ? error.message : String(error);
		this.runtimeMcpInspections.delete(configId);
		const needsAuth = allowOAuth && require_tar$1.isRemoteMcpClientUnauthorizedError(error);
		this.setRuntimeMcpStatus(configId, {
			status: needsAuth ? "unauthorized" : "error",
			needsAuth,
			error: message
		});
		if (needsAuth) this.emitUnauthorized(configId, message);
		return {
			success: false,
			error: message,
			...needsAuth ? {
				needsAuth: true,
				authFlowStarted: this.oauthManager.hasAuthorizationRedirectStarted(configId)
			} : {}
		};
	}
	async disconnect(configId, options) {
		if (options?.userInitiated !== false) this.abortInFlightConnect(configId);
		return this.runOpExclusive(configId, () => this.doDisconnect(configId, options));
	}
	async doDisconnect(configId, options) {
		const userInitiated = options?.userInitiated !== false;
		if (userInitiated) {
			this.clearConnectIntent(configId);
			this.markConnectorDisabled(configId);
			this.clearExternallyManagedStaleTokenGuard(configId);
			this.savePersistentState("disconnect");
		}
		const connectorConfig = this.getConnectorConfigById(configId);
		if (connectorConfig && this.isCliConnector(connectorConfig)) return this.disconnectCli(configId, userInitiated);
		if (connectorConfig && this.isSkillOnlyConnector(connectorConfig)) return this.disconnectSkillOnly(configId, userInitiated);
		try {
			this.updateState(configId, "disconnected");
			this.savePersistentState();
			this.disableSkills(configId);
			if (!this.isEnterpriseServerSideConnector(configId)) this.serverSideOauthRefresher?.stop(configId);
			if (userInitiated) this.writeConnectorsMcpConfig();
			this.refreshAndSync().catch((err) => {
				this.logger.warn(`[ConnectorService] disconnect(${configId}) refreshAndSync failed:`, err);
			});
			return { success: true };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.error(`[ConnectorService] disconnect(${configId}) failed:`, message);
			return {
				success: false,
				error: message
			};
		}
	}
	/**
	* 取消进行中的连接（CLI auth 等待 / OAuth 等待回调）。
	*
	* 行为：
	* - CLI auth spawn 中：abortController.abort() → executor 监听 signal 后 child.kill()
	* - CLI poll 中：abortController.abort() → poll 循环检查 signal.aborted 立即退出
	* - 已连接 / 未连接 / 无 in-flight controller：noop，返回 success
	*
	* cancel 只终止本轮连接尝试，不等于关闭开关，因此保持 userEnabled 不变，
	* 并把未完成授权表达为 unauthorized。
	*
	* OAuth 等待路径不在这里处理，由 `connector-ui-adapter.cancelConnect` 委托过来后，
	* 自己先清完 pendingOAuth 等状态再调本方法。
	*/
	async cancelConnect(configId) {
		this.abortInFlightConnect(configId);
		this.clearConnectIntent(configId);
		const current = this.states.get(configId);
		if (current?.status === "connecting" || current?.status === "unauthorized" || current?.status === "error") {
			const runtimeConfigId = require_tar$1.toRuntimeMcpConfigId(configId);
			this.runtimeMcpInspections.delete(runtimeConfigId);
			this.setRuntimeMcpStatus(runtimeConfigId);
			if (this.isBound(configId) && this.isEnabled(configId)) if (current.status === "unauthorized" || current.status === "error") this.updateState(configId, current.status, current.error, { reasonCode: current.reasonCode });
			else this.updateState(configId, "unauthorized", "Authorization required", { reasonCode: "auth-required" });
			else this.updateState(configId, "disconnected");
			return { success: true };
		}
		return { success: true };
	}
	/**
	* 中止进行中的授权/初始化任务（cancelConnect / disconnect / unbind 共用）。
	*
	* - CLI auth spawn / poll：abortController.abort() → executor 监听 signal 后 child.kill()
	* - 公网 server-side 授权的后台 poll 生命周期独立于外层 connect，单独持有取消句柄，
	*   一并 abort，确保取消能穿透 5 分钟后台轮询（否则浏览器仍可完成授权，
	*   poll 反手把状态拉回 connected —— 取消后又转圈）。
	* - MCP device flow（RFC 8628）轮询如有进行中也一并中止。
	*/
	abortInFlightConnect(configId) {
		const ctrl = this.pendingCliAborts.get(configId);
		if (ctrl) {
			this.logger.info(`[ConnectorService] abortInFlightConnect(${configId}): aborting in-flight CLI connect`);
			ctrl.abort();
		}
		const pollCtrl = this.pendingServerSideAuthAborts.get(configId);
		if (pollCtrl) {
			this.logger.info(`[ConnectorService] abortInFlightConnect(${configId}): aborting in-flight server-side auth poll`);
			pollCtrl.abort();
		}
		this.oauthManager?.abortDeviceFlow?.(configId);
	}
	/**
	* 标记 OAuth 授权失败（用户在浏览器授权页点「拒绝」/ provider 返错）。
	*
	* 把状态推成 `unauthorized` 并携带 error，让 UI 的
	* 「connecting → 非 connected + state.error」检测命中并弹「授权被拒绝」提示。
	*
	* 与 `cancelConnect` 的「推 unauthorized 不带 error、不提示」严格区分：
	* 拒绝由 OAuth 回调事件触发（ConnectorUiAdapter 的 onOAuthCompleted 失败分支），
	* 不经过 cancelConnect，两条路径互不干扰。
	*/
	markOAuthFailed(configId, error) {
		this.logger.info(`[ConnectorService] markOAuthFailed(${configId}): ${error}`);
		this.clearConnectIntent(configId);
		this.updateState(configId, "unauthorized", error, { reasonCode: "auth-failed" });
	}
	/**
	* MCP connector 的前置 CLI 认证（preAuth: 'cli'）。
	*
	* 流程：install CLI → version check（升级）→ status check（已授权则跳过）→ auth。
	* CLI 成功后 token 写到本地，MCP server 启动时自动读取。
	*/
	async runPreCliAuth(configId, config, signal) {
		const cliConfig = config.cliConfig;
		if (!this.cliExecutor) return {
			success: false,
			error: "CLI executor not available"
		};
		const runtimeOptions = {
			runtimeOperationId: crypto.randomUUID(),
			connectorId: configId
		};
		if (!await this.cliExecutor.isCliInstalled(cliConfig, runtimeOptions)) {
			this.logger.info(`[ConnectorService] preAuth(${configId}): CLI not installed, running init`);
			const installResult = await this.cliExecutor.runInstall(cliConfig, runtimeOptions);
			if (!installResult.success) return this.buildCliFailureResult("install", installResult.exitCode);
		}
		if (cliConfig.versionCheck) {
			const versionResult = await this.cliExecutor.checkVersion(cliConfig, runtimeOptions);
			if (versionResult.startupFailed) return this.buildCliFailureResult("startup", versionResult.exitCode ?? -1);
			if (versionResult.executionFailed && versionResult.exitCode !== void 0) return this.buildCliFailureResult("execution", versionResult.exitCode);
			if (versionResult.needsUpgrade) {
				this.logger.info(`[ConnectorService] preAuth(${configId}): CLI needs upgrade (current=${versionResult.currentVersion}, min=${cliConfig.versionCheck.minVersion})`);
				const upgradeResult = await this.cliExecutor.runInstall(cliConfig, runtimeOptions);
				if (!upgradeResult.success) return this.buildCliFailureResult("upgrade", upgradeResult.exitCode);
				const recheck = await this.cliExecutor.checkVersion(cliConfig, runtimeOptions);
				if (recheck.startupFailed) return this.buildCliFailureResult("startup", recheck.exitCode ?? -1);
				if (recheck.executionFailed && recheck.exitCode !== void 0) return this.buildCliFailureResult("execution", recheck.exitCode);
				if (recheck.needsUpgrade) return this.buildCliVersionTooLowResult(recheck.currentVersion, cliConfig.versionCheck.minVersion);
			}
		}
		if (cliConfig.status) {
			const statusResult = await this.cliExecutor.runStatus(cliConfig, runtimeOptions);
			if (statusResult.success) {
				this.logger.info(`[ConnectorService] preAuth(${configId}): already authenticated, skip`);
				return { success: true };
			}
			if (statusResult.exitCode === -1) return this.buildCliFailureResult("execution", -1);
			if (classifyCliExit(statusResult.exitCode) === "startup-failed") return this.buildCliFailureResult("startup", statusResult.exitCode);
		}
		if (signal?.aborted) {
			this.updateState(configId, "unauthorized");
			return {
				success: false,
				error: "Cancelled by user",
				cancelled: true
			};
		}
		const authResult = await this.cliExecutor.runAuth(cliConfig, {
			...runtimeOptions,
			onQrUrl: cliConfig.authQrModal ? (url) => this.authQrUrlPusher?.({
				configId,
				url
			}) : void 0,
			onDeviceCode: cliConfig.authDeviceFlow ? (info) => {
				this.logger.info(`[ConnectorService] preAuth(${configId}): pushing device code: uri=${info.verificationUri} hasCode=${!!info.userCode}`);
				this.deviceCodePusher?.({
					configId,
					...info
				});
			} : void 0,
			suppressBrowser: cliConfig.authSuppressBrowser === true
		}, signal);
		if (authResult.cancelled || signal?.aborted) {
			this.updateState(configId, "unauthorized");
			return {
				success: false,
				error: "Cancelled by user",
				cancelled: true
			};
		}
		if (!authResult.success) {
			const result = this.buildCliFailureResult("execution", authResult.exitCode);
			this.updateState(configId, "error", result.error);
			return result;
		}
		if (!cliConfig.authDeviceFlow && !cliConfig.authWaitForExit && cliConfig.status) {
			const authCompleted = await this.cliExecutor.pollAuthCompletion(cliConfig, 300 * 1e3, 3e3, signal, runtimeOptions);
			if (signal?.aborted) {
				this.updateState(configId, "unauthorized");
				return {
					success: false,
					error: "Cancelled by user",
					cancelled: true
				};
			}
			if (!authCompleted) {
				this.updateState(configId, "error", "Pre-auth timed out");
				return {
					success: false,
					error: "Pre-auth timed out"
				};
			}
		}
		this.logger.info(`[ConnectorService] preAuth(${configId}): CLI auth completed`);
		return { success: true };
	}
	async updateHeaders(configId, headers, skipReconnect = false) {
		try {
			const connectorConfig = this.getConnectorConfigById(configId);
			const skillOnly = connectorConfig && this.isSkillOnlyConnector(connectorConfig);
			const headersToApply = { ...headers };
			if (this.getConnectorAccountContext().kind === "personal") {
				let strippedOneidHeader = false;
				for (const key of Object.keys(headersToApply)) {
					if (key.toLowerCase() !== "x-oneid-access-token") continue;
					delete headersToApply[key];
					strippedOneidHeader = true;
				}
				if (strippedOneidHeader) this.logger.warn("[ConnectorService] reject OneID header injection on personal account");
			}
			const previous = { ...this.persistentState.headerOverrides[configId] };
			const next = { ...previous };
			if (this.getConnectorAccountContext().kind === "personal") {
				for (const key of Object.keys(next)) if (key.toLowerCase() === "x-oneid-access-token") delete next[key];
			}
			for (const [key, value] of Object.entries(headersToApply)) if (value === "") delete next[key];
			else next[key] = value;
			const previousEntries = Object.entries(previous);
			if (!(previousEntries.length !== Object.keys(next).length || previousEntries.some(([key, value]) => next[key] !== value))) return { success: true };
			const nextAuthorization = next.Authorization ?? next.authorization;
			if (typeof nextAuthorization === "string" && nextAuthorization.length > 0) {
				const rawConfigId = this.normalizeRuntimeMcpConfigId(configId);
				const guardedToken = this.externallyManagedStaleTokenGuard.get(rawConfigId);
				const nextFingerprint = this.hashTokenFingerprint(nextAuthorization);
				if (guardedToken && guardedToken.tokenFingerprint !== nextFingerprint) this.clearExternallyManagedStaleTokenGuard(rawConfigId);
			}
			if (Object.keys(next).length > 0) this.persistentState.headerOverrides[configId] = next;
			else delete this.persistentState.headerOverrides[configId];
			const authorization = next.Authorization ?? next.authorization;
			if (typeof authorization === "string" && authorization.length > 0 && this.isCSideAutoBoundConnector(configId)) {
				this.markConnectorBound(configId);
				this.logger.info(`[ConnectorService] updateHeaders(${configId}): C-side library auth detected, marking bound without changing enabled`);
			}
			this.savePersistentState();
			this.writeConnectorsMcpConfig();
			if (skillOnly || skipReconnect) return { success: true };
			if (this.isEnabled(configId)) {
				await this.disconnect(configId, { userInitiated: false });
				return this.connect(configId, {
					silent: true,
					skipClearClientInfo: true
				});
			}
			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}
	/**
	* 应用 WorkBuddy 托管的认证 headers，并等待 MCP 连接进入最终状态。
	*
	* headers 未变化且 runtime MCP 已连接时直接返回；否则用最新运行时配置
	* （含 headerOverrides）静默 inspectRemote，Promise 只在成功或明确失败后结束。
	*/
	getRuntimeMcpStatus(configId) {
		return this.runtimeMcpStatuses.get(configId)?.status;
	}
	getRuntimeMcpInspection(configId) {
		if (this.runtimeMcpStatuses.get(configId)?.status !== "connected") return;
		const inspection = this.runtimeMcpInspections.get(configId);
		if (!inspection) return;
		return { tools: [...inspection.tools] };
	}
	async applyManagedAuthHeadersAndEnsureConnected(configId, headers) {
		try {
			const previous = this.persistentState.headerOverrides[configId] ?? {};
			const headersChanged = Object.entries(headers).some(([key, value]) => previous[key] !== value);
			const updateResult = await this.updateHeaders(configId, headers, true);
			if (!updateResult.success) return updateResult;
			const currentStatus = this.runtimeMcpStatuses.get(configId)?.status;
			if (!headersChanged && currentStatus === "connected" && this.runtimeMcpInspections?.has(configId)) return { success: true };
			if (!configId.startsWith(this.CUSTOM_MCP_PREFIX)) return {
				success: false,
				error: `Managed MCP config "${configId}" is not a custom MCP server`
			};
			const serverName = configId.slice(this.CUSTOM_MCP_PREFIX.length);
			const sourceConfig = this.readCustomMcpConfigForConnect(configId)?.mcpServers?.[serverName];
			if (!sourceConfig) return {
				success: false,
				error: `MCP server "${serverName}" not found in config`
			};
			const runtimeConfig = this.buildRuntimeMcpConfig(configId, { mcpServers: { [serverName]: sourceConfig } }).mcpServers[serverName];
			const inspectResult = await this.inspectRemoteMcp(configId, runtimeConfig, true, false);
			if (!inspectResult.success) return {
				success: false,
				error: inspectResult.error || `Failed to connect MCP server "${serverName}"`
			};
			this.notifyRuntimeMcpServerConfigsChanged({ credentialsChanged: true });
			if (this.runtimeMcpStatuses.get(configId)?.status !== "connected") return {
				success: false,
				error: `MCP server "${serverName}" did not reach connected state`
			};
			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}
	async getEnterpriseConnectorOneidAccessToken(configId) {
		const syncResult = await this.syncEnterpriseConnectorTokenBeforeConnect(configId);
		if (!syncResult.success) {
			this.logger.warn(`[ConnectorService] getEnterpriseConnectorOneidAccessToken(${configId}) sync failed: ${syncResult.error}`);
			return;
		}
		const rawConfigId = this.normalizeRuntimeMcpConfigId(configId);
		const headers = this.persistentState.headerOverrides[rawConfigId];
		const token = headers?.["X-Oneid-Access-Token"] ?? headers?.["x-oneid-access-token"];
		return typeof token === "string" && token.trim().length > 0 ? token.trim() : void 0;
	}
	async resolveTencentDocsSkillCredentials() {
		const personalConfigId = "tencent-docs";
		const enterpriseConfigId = "tencent-docs-oa";
		const personalAuthorizationToken = this.resolvePersonalTencentDocsAuthorizationToken(personalConfigId);
		const personalStatus = personalAuthorizationToken ? void 0 : this.getTencentDocsSkillCredentialUnavailableReason(personalConfigId);
		const enterpriseStatus = this.getTencentDocsSkillCredentialUnavailableReason(enterpriseConfigId);
		const personalToken = personalAuthorizationToken ?? (personalStatus ? void 0 : this.peekTencentDocsPersonalOAuthAccessToken(personalConfigId));
		const enterpriseToken = enterpriseStatus ? void 0 : this.peekOneidHeaderOverride(enterpriseConfigId);
		this.logger.info(`[TencentDocsSkillCredential] resolved personal=${personalStatus ?? (personalToken ? "available" : "token_unavailable")} enterprise=${enterpriseStatus ?? (enterpriseToken ? "available" : "token_unavailable")}`);
		return {
			personal: personalStatus ? {
				available: false,
				reason: personalStatus
			} : personalToken ? {
				available: true,
				token: personalToken
			} : {
				available: false,
				reason: "token_unavailable"
			},
			enterprise: enterpriseStatus ? {
				available: false,
				reason: enterpriseStatus
			} : enterpriseToken ? {
				available: true,
				token: enterpriseToken
			} : {
				available: false,
				reason: "token_unavailable"
			}
		};
	}
	getTencentDocsSkillCredentialUnavailableReason(configId) {
		if (!this.isEnabled(configId)) return "connector_disabled";
		if (!this.isConnectorConnected(configId)) return "not_connected";
	}
	resolvePersonalTencentDocsAuthorizationToken(configId) {
		if (!this.isPersonalTencentDocsAuthorizationAvailable(configId)) return;
		const rawConfigId = this.normalizeRuntimeMcpConfigId(configId);
		const headers = this.persistentState.headerOverrides[rawConfigId];
		const authorization = headers?.Authorization ?? headers?.authorization;
		if (typeof authorization !== "string") return;
		const value = authorization.trim();
		if (!value) return;
		return value.replace(/^Bearer(?:\s+|$)/i, "").trim() || void 0;
	}
	isPersonalTencentDocsAuthorizationAvailable(configId) {
		const rawConfigId = this.normalizeRuntimeMcpConfigId(configId);
		if (rawConfigId !== "tencent-docs" || this.getCurrentEnterpriseId()) return false;
		const headers = this.persistentState.headerOverrides[rawConfigId];
		const authorization = headers?.Authorization ?? headers?.authorization;
		if (typeof authorization !== "string" || authorization.trim().length === 0) return false;
		return this.isCSideAutoBoundConnector(rawConfigId);
	}
	peekTencentDocsPersonalOAuthAccessToken(configId) {
		const serverConfig = this.getLatestServerConfigForConnector(configId);
		if (!serverConfig?.url) return;
		try {
			const token = this.createOAuthStore().peekTokens(require_tar$1.toRuntimeMcpConfigId(configId), serverConfig.url, serverConfig.headers)?.access_token;
			return typeof token === "string" && token.trim().length > 0 ? token.trim() : void 0;
		} catch (error) {
			this.logger.warn(`[ConnectorService] peekTencentDocsPersonalOAuthAccessToken(${configId}) failed:`, error instanceof Error ? error.message : String(error));
			return;
		}
	}
	async updateEnv(configId, env) {
		try {
			this.persistentState.envOverrides[configId] = {
				...this.persistentState.envOverrides[configId],
				...env
			};
			this.savePersistentState();
			if (this.isEnabled(configId)) {
				await this.disconnect(configId, { userInitiated: false });
				return this.connect(configId, {
					silent: true,
					skipClearClientInfo: true
				});
			}
			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}
	/**
	* 退出开关管理生命周期并清理授权材料。
	*
	* 顺序（plan §4.3）：
	*   1. 取消进行中的授权/初始化任务 + 持久化 enabled=false
	*   2. 停止本地工作（doDisconnect）
	*   3. 远端撤销（CLI unAuth / IOA revoke）—— 失败即中止：保持 bound=true 和残留凭据
	*      事实，返回稳定 `unbind-failed`，由 UI 推导 retry-unbind；不得假装解绑完成
	*   4. 本地授权材料清理（OAuth token/client info、headerOverrides、envOverrides）
	*   5. 清理完成后持久化 bound=false（删除生命周期条目）
	*/
	async unbind(configId) {
		this.abortInFlightConnect(configId);
		return this.runOpExclusive(configId, () => this.doUnbind(configId));
	}
	async doUnbind(configId) {
		const connectorConfig = this.getConnectorConfigById(configId);
		this.clearConnectIntent(configId);
		this.markConnectorDisabled(configId);
		this.savePersistentState("unbind-disable");
		if (connectorConfig && this.isCliConnector(connectorConfig)) this.disconnectCli(configId, true);
		else await this.doDisconnect(configId, { userInitiated: true });
		try {
			if (connectorConfig?.cliConfig?.unAuth && this.cliExecutor) await this.cliExecutor.runUnAuth(connectorConfig.cliConfig, { connectorId: configId });
			if (this.ioaAuth) {
				const ioaOauthName = this.resolveIoaOauthNameByConfigId(configId);
				if (ioaOauthName) {
					await this.ioaAuth.revokeToken(ioaOauthName);
					this.logger.info(`[ConnectorService] unbind(${configId}): revoked server-side token for ${ioaOauthName}`);
				}
			}
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			this.logger.warn(`[ConnectorService] unbind(${configId}): remote revoke failed, keeping bound:`, e);
			this.updateState(configId, "error", message, { reasonCode: "unbind-failed" });
			return {
				success: false,
				error: message,
				errorCode: "unbind-failed"
			};
		}
		this.invalidateConnectorCredentials(configId);
		delete this.persistentState.headerOverrides[configId];
		delete this.persistentState.envOverrides[configId];
		this.clearConnectorLifecycle(configId);
		this.states.delete(configId);
		this.savePersistentState("unbind-complete");
		this.writeConnectorsMcpConfig();
		this.emitUnboundEvent(configId);
		return { success: true };
	}
	/**
	* 根据套件名称解绑所有属于该套件的连接器（用于套件卸载时清理 IOA 服务端 token）
	*
	* 通过 computePluginMcpConfigs 缓存（已在内存中）找到套件对应的连接器，
	* 不依赖 manifest.connectors[].sourcePluginName（该字段当前未下发）。
	*
	* 注意：必须在套件卸载前调用（manifest 被清除之前），否则 getMarketplaceEntryById 会返回 undefined。
	*/
	async unbindConnectorsByPlugin(pluginName) {
		const pluginMcpConfigs = this.readDaemonPluginMcpConfigs();
		const configIdsToUnbind = [];
		for (const [serverName, entry] of Object.entries(pluginMcpConfigs)) if (entry.sourcePluginName === pluginName) configIdsToUnbind.push(serverName);
		if (configIdsToUnbind.length === 0) {
			this.logger.info(`[ConnectorService] unbindConnectorsByPlugin: no connectors found for plugin ${pluginName}`);
			return;
		}
		if (!this.ioaAuth) return;
		for (const configId of configIdsToUnbind) try {
			let oauthName;
			try {
				oauthName = this.resolveOauthName(configId);
			} catch (e) {
				oauthName = configId;
				this.logger.warn(`[ConnectorService] unbindConnectorsByPlugin: resolveOauthName(${configId}) failed, using configId as oauthName:`, e);
			}
			this.logger.info(`[ConnectorService] unbindConnectorsByPlugin: revoking token for ${configId} (oauthName=${oauthName})`);
			await this.ioaAuth.revokeToken(oauthName);
			this.logger.info(`[ConnectorService] unbindConnectorsByPlugin: revoked server-side token for ${oauthName}`);
		} catch (err) {
			this.logger.warn(`[ConnectorService] unbindConnectorsByPlugin: failed to revoke token for ${configId}:`, err);
		}
	}
	/**
	* 向外部 pusher 发射"connector 已解绑"事件。
	* 业务侧（如腾讯文档 store）可以藉此驱动自身状态重置。
	* 失败仅记录日志，不影响 unbind 主流程。
	*/
	emitUnboundEvent(configId) {
		if (!this.unboundEventPusher) return;
		try {
			this.unboundEventPusher({ configId });
		} catch (err) {
			this.logger.warn(`[ConnectorService] unbound pusher(${configId}) threw:`, err);
		}
	}
	async hasOAuthToken(configId) {
		const runtimeId = configId.startsWith(this.CUSTOM_MCP_PREFIX) ? configId : require_tar$1.toRuntimeMcpConfigId(configId);
		const rawServerConfig = configId.startsWith(this.CUSTOM_MCP_PREFIX) ? this.readCustomMcpConfig().mcpServers?.[configId.slice(this.CUSTOM_MCP_PREFIX.length)] : this.getLatestServerConfigForConnector(this.normalizeRuntimeMcpConfigId(configId));
		const serverUrl = rawServerConfig && typeof rawServerConfig === "object" && "url" in rawServerConfig && typeof rawServerConfig.url === "string" ? rawServerConfig.url : void 0;
		return serverUrl !== void 0 && this.oauthManager.hasSavedTokens(runtimeId, serverUrl);
	}
	/** 用户自定义 MCP 配置文件路径 */
	get customMcpConfigPath() {
		return (0, path.join)(this.configDir, "mcp.json");
	}
	/**
	* 取某个 MCP server 的 disabledTools 并集（mcp.json 字段 + persistentState 覆盖）。
	* 对 user / plugin / builtin scope 都生效（issue #40087）。
	*/
	resolveDisabledToolNames(serverName, mcpJsonField) {
		const fromConfig = Array.isArray(mcpJsonField) ? mcpJsonField.filter((v) => typeof v === "string") : [];
		const fromOverride = this.persistentState.disabledToolsOverrides?.[serverName] ?? [];
		return new Set([...fromConfig, ...fromOverride]);
	}
	/** Connector 运行时 MCP 配置文件路径（由旧版 plugin-chat 或 UI 写入） */
	get connectorMcpConfigPath() {
		return (0, path.join)(this.configDir, "connectors", this.getUserId(), "mcp.json");
	}
	async listMcpServers() {
		const t0 = Date.now();
		let tReadCustom = 0;
		let tUserLoop = 0;
		let tReadPlugin = 0;
		let tPluginLoop = 0;
		let tArdot = 0;
		let userScopeCount = 0;
		let pluginScopeCount = 0;
		try {
			const tCustomStart = Date.now();
			const config = this.readCustomMcpConfig();
			tReadCustom = Date.now() - tCustomStart;
			const servers = config.mcpServers || {};
			const result = [];
			const { WHITELIST_HASHES, BLACKLIST_HASHES } = this.getTrustLists();
			const userServerNames = /* @__PURE__ */ new Set();
			const tUserLoopStart = Date.now();
			for (const [name, entry] of Object.entries(servers)) {
				if (!entry || typeof entry !== "object" || !("url" in entry) && !("command" in entry)) continue;
				userServerNames.add(name);
				if (name === "ardot") continue;
				const configId = this.CUSTOM_MCP_PREFIX + name;
				const inspection = this.runtimeMcpInspections.get(configId);
				const runtimeStatus = this.runtimeMcpStatuses.get(configId);
				let status = "disconnected";
				if (entry.disabled) status = "disabled";
				else if (runtimeStatus) switch (runtimeStatus.status) {
					case "connected":
						status = "connected";
						break;
					case "connecting":
						status = "connecting";
						break;
					case "unauthorized":
						status = "connecting";
						break;
					default: status = "disconnected";
				}
				const configHash = this.calculateConfigHash(entry);
				let trustLevel = "unknown";
				let mcpError = runtimeStatus?.error;
				let mcpStatus = status;
				if (BLACKLIST_HASHES.includes(configHash)) {
					trustLevel = "black";
					mcpStatus = "disabled";
					mcpError = "This MCP server has been identified as malicious and is blocked.";
				} else if (WHITELIST_HASHES.includes(configHash)) trustLevel = "white";
				else if (this.isUserServerApproved(name, configHash)) trustLevel = "gray";
				else if (!entry.disabled) {
					trustLevel = "gray";
					mcpStatus = "disabled";
					mcpError = "This third-party MCP server requires your approval before connecting. WorkBuddy has not verified this server.";
				}
				this.logger.info(`[MCP Security] listMcpServers: name=${name}, configHash=${configHash}, trustLevel=${trustLevel}, status=${mcpStatus}`);
				const disabledToolNames = this.resolveDisabledToolNames(name, entry.disabledTools);
				result.push({
					id: name,
					name,
					status: mcpStatus,
					description: entry.description,
					disabled: entry.disabled ?? false,
					configSource: "user",
					tools: inspection?.tools.map((t) => ({
						name: t.name,
						description: t.description,
						enabled: !disabledToolNames.has(t.name)
					})),
					prompts: inspection?.prompts,
					resources: inspection?.resources,
					resourceTemplates: inspection?.resourceTemplates,
					needsAuth: runtimeStatus?.needsAuth,
					error: mcpError,
					trustLevel,
					configHash,
					lastApprovedAt: this.getLastApprovedAt(name, configHash)
				});
				userScopeCount++;
			}
			tUserLoop = Date.now() - tUserLoopStart;
			try {
				const tPluginReadStart = Date.now();
				const pluginMcpConfigs = this.readDaemonPluginMcpConfigs();
				tReadPlugin = Date.now() - tPluginReadStart;
				const tPluginLoopStart = Date.now();
				for (const [name, { config, sourcePluginId, sourcePluginName, sourceMarketplaceName, sourcePluginVersion }] of Object.entries(pluginMcpConfigs)) {
					if (userServerNames.has(name)) continue;
					const configId = this.CUSTOM_MCP_PREFIX + name;
					const inspection = this.runtimeMcpInspections.get(configId);
					const runtimeStatus = this.runtimeMcpStatuses.get(configId);
					const disabled = Boolean(config.disabled) || this.persistentState.pluginMcpDisabledOverrides?.[name] === true;
					let status = "disconnected";
					if (disabled) status = "disabled";
					else if (runtimeStatus) switch (runtimeStatus.status) {
						case "connected":
							status = "connected";
							break;
						case "connecting":
							status = "connecting";
							break;
						case "unauthorized":
							status = "connecting";
							break;
						default: status = "disconnected";
					}
					const pluginDisabledToolNames = this.resolveDisabledToolNames(name, config.disabledTools);
					result.push({
						id: name,
						name,
						status,
						description: config.description,
						disabled,
						configSource: "plugin",
						tools: inspection?.tools?.map((t) => ({
							name: t.name,
							description: t.description,
							enabled: !pluginDisabledToolNames.has(t.name)
						})),
						prompts: inspection?.prompts,
						resources: inspection?.resources,
						resourceTemplates: inspection?.resourceTemplates,
						needsAuth: runtimeStatus?.needsAuth,
						error: runtimeStatus?.error,
						trustLevel: "white",
						sourcePluginId,
						sourcePluginName,
						sourceMarketplaceName,
						sourcePluginVersion
					});
					pluginScopeCount++;
				}
				tPluginLoop = Date.now() - tPluginLoopStart;
			} catch (error) {
				this.logger.warn("[ConnectorService] Failed to read plugin MCP configs for listMcpServers:", error);
			}
			const tArdotStart = Date.now();
			if (!result.some((server) => server.id === "ardot")) {
				const ardotUserEntry = servers[BUILTIN_ARDOT_MCP_SERVER_NAME];
				const effectiveArdotConfig = this.resolveEffectiveArdotMcpServer(ardotUserEntry);
				if (effectiveArdotConfig) {
					const configId = this.CUSTOM_MCP_PREFIX + BUILTIN_ARDOT_MCP_SERVER_NAME;
					const inspection = this.runtimeMcpInspections.get(configId);
					const runtimeStatus = this.runtimeMcpStatuses.get(configId);
					let status = "disconnected";
					if (effectiveArdotConfig.disabled) status = "disabled";
					else if (runtimeStatus) switch (runtimeStatus.status) {
						case "connected":
							status = "connected";
							break;
						case "connecting":
							status = "connecting";
							break;
						case "unauthorized":
							status = "connecting";
							break;
						default: status = "disconnected";
					}
					const ardotDisabledToolNames = this.resolveDisabledToolNames(BUILTIN_ARDOT_MCP_SERVER_NAME, effectiveArdotConfig.disabledTools);
					result.push({
						id: BUILTIN_ARDOT_MCP_SERVER_NAME,
						name: BUILTIN_ARDOT_MCP_SERVER_NAME,
						status,
						description: isValidArdotDevMcpServer(ardotUserEntry) ? `Built-in Ardot MCP App (dev override: ${effectiveArdotConfig.url})` : "Built-in Ardot MCP App",
						disabled: effectiveArdotConfig.disabled ?? false,
						configSource: "user",
						tools: inspection?.tools.map((t) => ({
							name: t.name,
							description: t.description,
							enabled: !ardotDisabledToolNames.has(t.name)
						})),
						prompts: inspection?.prompts,
						resources: inspection?.resources,
						resourceTemplates: inspection?.resourceTemplates,
						needsAuth: runtimeStatus?.needsAuth,
						error: runtimeStatus?.error,
						trustLevel: "white",
						configHash: this.calculateConfigHash(effectiveArdotConfig),
						lastApprovedAt: void 0
					});
				}
			}
			tArdot = Date.now() - tArdotStart;
			const totalMs = Date.now() - t0;
			const summary = `[ConnectorService] listMcpServers timing total=${totalMs}ms readCustom=${tReadCustom}ms userLoop=${tUserLoop}ms(n=${userScopeCount}) readPlugin=${tReadPlugin}ms pluginLoop=${tPluginLoop}ms(n=${pluginScopeCount}) ardot=${tArdot}ms total-servers=${result.length}`;
			if (totalMs >= 50) this.logger.warn(summary);
			else this.logger.info(summary);
			return result;
		} catch (error) {
			const totalMs = Date.now() - t0;
			this.logger.error(`[ConnectorService] listMcpServers failed after ${totalMs}ms (readCustom=${tReadCustom}ms userLoop=${tUserLoop}ms readPlugin=${tReadPlugin}ms pluginLoop=${tPluginLoop}ms ardot=${tArdot}ms):`, error);
			return [];
		}
	}
	/**
	* MCP Security: 计算 MCP Server 配置的规范化 hash
	* - stdio: sha256(command + sorted_args_keys + sorted_env_keys)（不含 value）
	* - remote: sha256(url_origin)
	*/
	calculateConfigHash(entry) {
		const crypto$1 = require("crypto");
		let input;
		if (entry.command) input = `${entry.command || ""}|${(entry.args || []).map(String).sort().join(",")}|${Object.keys(entry.env || {}).sort().join(",")}`;
		else if (entry.url) try {
			input = new URL(entry.url).origin;
		} catch {
			input = entry.url;
		}
		else input = JSON.stringify(entry);
		return crypto$1.createHash("sha256").update(input).digest("hex");
	}
	get mcpApprovalsPath() {
		return (0, path.join)(this.configDir, "mcp-approvals.json");
	}
	/**
	* 延迟加载授权记录。
	*
	* 升级迁移（仅首次启动新版本触发一次，之后永不再跑）：
	* - 判断标准：persistentState.mcpSecurityMigrated !== true
	* - 触发动作：把 mcp.json 里**已启用**（disabled !== true）的 server 视为
	*   "历史已信任"，避免升级后用户被打扰
	*
	* 关键设计：
	* - 只迁移 disabled !== true 的 server。用户在老版本里手动禁用的 server
	*   恰恰表达了"不信任/暂不使用"的意愿，不应在升级时被自动授信。
	*   这类 server 保持"待信任"状态，若用户后续想用，会走显式信任流程。
	*
	* 安全设计：
	* - 迁移标记存在 connector-states.json 而非 mcp-approvals.json
	* - 攻击者即使删除 mcp-approvals.json 也无法触发全量迁移，
	*   只会让 mcp.json 里所有 server 回到"待信任"状态（安全默认值）
	*/
	loadApprovals() {
		if (!this.approvalsLoaded) {
			this.approvalsLoaded = true;
			if ((0, fs.existsSync)(this.mcpApprovalsPath)) try {
				const content = (0, fs.readFileSync)(this.mcpApprovalsPath, "utf-8");
				const data = JSON.parse(content);
				this.userServerApprovals = new Map(Object.entries(data));
				this.logger.info(`[MCP Security] Loaded ${this.userServerApprovals.size} approvals from ${this.mcpApprovalsPath}`);
			} catch (error) {
				this.logger.warn("[MCP Security] Failed to load approvals:", error);
			}
		}
		this.migrateMcpSecurityApprovalsIfNeeded();
	}
	migrateMcpSecurityApprovalsIfNeeded() {
		const currentIdentityKey = this.getCurrentAccountIdentityKey();
		if (this.persistentStateLoadedIdentityKey !== currentIdentityKey) {
			this.pendingMcpSecurityMigration = true;
			return;
		}
		if (this.persistentState.mcpSecurityMigrated === true) {
			this.pendingMcpSecurityMigration = false;
			return;
		}
		this.logger.info("[MCP Security] First run on this version, migrating enabled mcp.json servers as trusted");
		try {
			const servers = this.readCustomMcpConfig().mcpServers || {};
			let migratedCount = 0;
			let skippedDisabledCount = 0;
			const now = Date.now();
			for (const [name, entry] of Object.entries(servers)) {
				if (!entry || typeof entry !== "object") continue;
				const e = entry;
				if (!e.url && !e.command) continue;
				if (e.disabled === true) {
					skippedDisabledCount++;
					this.logger.info(`[MCP Security] Migration skip: "${name}" is disabled in mcp.json, will require explicit trust`);
					continue;
				}
				const key = `${this.calculateConfigHash(e)}::${name}`;
				if (!this.userServerApprovals.has(key)) {
					this.userServerApprovals.set(key, now);
					migratedCount++;
				}
			}
			this.persistApprovals();
			this.persistentState.mcpSecurityMigrated = true;
			this.savePersistentState("mcp-security-migration");
			this.pendingMcpSecurityMigration = false;
			this.logger.info(`[MCP Security] Migration complete: ${migratedCount} enabled server(s) auto-trusted, ${skippedDisabledCount} disabled server(s) kept as untrusted, flag persisted`);
		} catch (error) {
			this.pendingMcpSecurityMigration = true;
			this.logger.warn("[MCP Security] Migration failed:", error);
		}
	}
	persistApprovals() {
		try {
			(0, fs.mkdirSync)(this.configDir, { recursive: true });
			const data = Object.fromEntries(this.userServerApprovals);
			(0, fs.writeFileSync)(this.mcpApprovalsPath, JSON.stringify(data, null, 2), "utf-8");
		} catch (error) {
			this.logger.warn("[MCP Security] Failed to persist approvals:", error);
		}
	}
	/** MCP Security: 内置白/黑名单 */
	getTrustLists() {
		return {
			WHITELIST_HASHES: [],
			BLACKLIST_HASHES: []
		};
	}
	isUserServerApproved(serverName, configHash) {
		this.loadApprovals();
		return this.userServerApprovals.has(`${configHash}::${serverName}`);
	}
	getLastApprovedAt(serverName, configHash) {
		this.loadApprovals();
		return this.userServerApprovals.get(`${configHash}::${serverName}`);
	}
	/** MCP Security: 用户授权 MCP Server（UI 层调用） */
	async approveMcpServer(serverName) {
		const entry = this.readCustomMcpConfig().mcpServers?.[serverName];
		if (!entry) throw new Error(`MCP server "${serverName}" not found`);
		this.loadApprovals();
		const configHash = this.calculateConfigHash(entry);
		this.userServerApprovals.set(`${configHash}::${serverName}`, Date.now());
		this.persistApprovals();
		this.logger.info(`[MCP Security] User approved: ${serverName} (hash: ${configHash})`);
		this.refreshAndSync().catch((err) => {
			this.logger.warn("[ConnectorService] refreshAndSync after approval failed:", err);
		});
	}
	async connectCustomMcpServer(params) {
		const serverName = params.name?.trim();
		if (!serverName) return {
			success: false,
			error: "MCP server name is required"
		};
		const config = this.readCustomMcpConfig();
		const servers = config.mcpServers || {};
		const desiredConfig = this.stripWorkbuddyMcpMeta(this.applyMcpTokenValues(params.config, params.tokenValues));
		const existing = servers[serverName];
		if (existing && !params.overwrite && !this.isSameMcpConfig(existing, desiredConfig)) return {
			success: false,
			conflict: true,
			existing
		};
		const nextConfig = {
			...desiredConfig,
			disabled: false
		};
		servers[serverName] = nextConfig;
		config.mcpServers = servers;
		this.writeCustomMcpConfig(config);
		this.mcpJsonCache.invalidate(this.customMcpConfigPath);
		this.loadApprovals();
		const configHash = this.calculateConfigHash(nextConfig);
		if (!this.isUserServerApproved(serverName, configHash)) {
			this.userServerApprovals.set(`${configHash}::${serverName}`, Date.now());
			this.persistApprovals();
		}
		this.lastSelfWriteCustomMcpAt = Date.now();
		return { success: true };
	}
	async reconnectMcpServer(serverName, options) {
		const servers = this.readCustomMcpConfig().mcpServers || {};
		let serverConfig = servers[serverName];
		if (!serverConfig) {
			const pluginEntry = this.readDaemonPluginMcpConfigs()[serverName];
			if (pluginEntry) serverConfig = pluginEntry.config;
		}
		if (!serverConfig) serverConfig = this.readCustomMcpConfigForConnect(this.CUSTOM_MCP_PREFIX + serverName)?.mcpServers?.[serverName];
		if (!serverConfig) throw new Error(`MCP server "${serverName}" not found in config`);
		const configId = this.CUSTOM_MCP_PREFIX + serverName;
		if (!!servers[serverName]) {
			const configHash = this.calculateConfigHash(serverConfig);
			const { WHITELIST_HASHES } = this.getTrustLists();
			if (!WHITELIST_HASHES.includes(configHash) && !this.isUserServerApproved(serverName, configHash)) {
				this.logger.warn(`[ConnectorService] reconnectMcpServer(${serverName}) blocked: server not approved (hash: ${configHash}). Use approveMcpServer() first.`);
				return;
			}
		}
		if (typeof serverConfig.command === "string" && serverConfig.command.length > 0) {
			await this.refreshAndSync();
			this.logger.info(`[ConnectorService] reconnectMcpServer(${serverName}) published stdio descriptor`);
			return;
		}
		if (!options?.skipClearClientInfo && serverConfig.url) this.oauthManager.invalidateCredentials(configId, serverConfig.url, "all", serverConfig.headers);
		const result = await this.inspectRemoteMcp(configId, serverConfig, false, true);
		if (result.success) {
			this.logger.info(`[ConnectorService] reconnectMcpServer(${serverName}) inspected successfully`);
			this.notifyRuntimeMcpServerConfigsChanged({ credentialsChanged: true });
			return;
		}
		this.logger.warn(`[ConnectorService] reconnectMcpServer(${serverName}) failed: ${result.error ?? "unknown error"}`);
	}
	async toggleMcpServer(serverName, enabled) {
		const config = this.readCustomMcpConfig();
		const servers = config.mcpServers || {};
		if (!servers[serverName]) {
			if (!this.readDaemonPluginMcpConfigs()[serverName]) return;
			if (!this.persistentState.pluginMcpDisabledOverrides) this.persistentState.pluginMcpDisabledOverrides = {};
			if (enabled) delete this.persistentState.pluginMcpDisabledOverrides[serverName];
			else this.persistentState.pluginMcpDisabledOverrides[serverName] = true;
			this.savePersistentState();
			this.refreshAndSync().catch((error) => {
				this.logger.warn(`[ConnectorService] refreshAndSync after plugin MCP toggle failed: ${error?.message || error}`);
			});
			return;
		}
		servers[serverName].disabled = !enabled;
		config.mcpServers = servers;
		if (enabled) this.lastSelfWriteCustomMcpAt = Date.now();
		this.writeCustomMcpConfig(config);
		this.stateChangedNotifier?.({
			configId: this.CUSTOM_MCP_PREFIX + serverName,
			status: enabled ? "connecting" : "disconnected"
		});
		if (enabled) {
			this.loadApprovals();
			const configHash = this.calculateConfigHash(servers[serverName]);
			if (!this.isUserServerApproved(serverName, configHash)) {
				this.userServerApprovals.set(`${configHash}::${serverName}`, Date.now());
				this.persistApprovals();
				this.logger.info(`[MCP Security] toggleMcpServer: ${serverName} enabled → approval recorded (hash: ${configHash})`);
			}
		}
	}
	async deleteMcpServer(serverName) {
		const config = this.readCustomMcpConfig();
		const servers = config.mcpServers || {};
		if (servers[serverName]) {
			const configId = `${this.CUSTOM_MCP_PREFIX}${serverName}`;
			const serverUrl = servers[serverName]?.url;
			if (this.ioaAuth) {
				const ioaOauthName = this.ioaAuth.resolveOauthNameByUrl(serverUrl);
				if (ioaOauthName) try {
					await this.ioaAuth.revokeToken(ioaOauthName);
					this.logger.info(`[ConnectorService] deleteMcpServer(${serverName}): revoked server-side token for ${ioaOauthName}`);
				} catch (e) {
					this.logger.warn(`[ConnectorService] deleteMcpServer(${serverName}): failed to revoke token for ${ioaOauthName}:`, e);
				}
			}
			if (serverUrl) this.oauthManager.invalidateCredentials(configId, serverUrl, "all");
			delete servers[serverName];
			config.mcpServers = servers;
			this.writeCustomMcpConfig(config);
		}
	}
	async toggleMcpTool(serverName, toolName, enabled) {
		if (!this.persistentState.disabledToolsOverrides) this.persistentState.disabledToolsOverrides = {};
		const overrides = this.persistentState.disabledToolsOverrides;
		const current = new Set(overrides[serverName] ?? []);
		if (enabled) current.delete(toolName);
		else current.add(toolName);
		if (current.size === 0) delete overrides[serverName];
		else overrides[serverName] = Array.from(current);
		this.savePersistentState();
		const config = this.readCustomMcpConfig();
		const servers = config.mcpServers || {};
		const server = servers[serverName];
		if (server) {
			if (current.size === 0) delete server.disabledTools;
			else server.disabledTools = Array.from(current);
			config.mcpServers = servers;
			this.writeCustomMcpConfig(config);
		}
		this.refreshAndSync().catch((err) => {
			this.logger.warn("[ConnectorService] refreshAndSync after toggleMcpTool failed:", err);
		});
	}
	async openMcpConfig() {
		this.ensureCustomMcpConfig();
		await this.hostCapabilities.openPath(this.customMcpConfigPath);
	}
	async getMcpConfigContent() {
		this.ensureCustomMcpConfig();
		try {
			const content = (0, fs.readFileSync)(this.customMcpConfigPath, "utf-8");
			return {
				filePath: this.customMcpConfigPath,
				content
			};
		} catch {
			const defaultContent = JSON.stringify({ mcpServers: {} }, null, 2);
			return {
				filePath: this.customMcpConfigPath,
				content: defaultContent
			};
		}
	}
	async saveMcpConfigContent(content) {
		const parsed = JSON.parse(content);
		const mcpServers = parsed?.mcpServers;
		if (mcpServers !== void 0 && (!mcpServers || typeof mcpServers !== "object" || Array.isArray(mcpServers))) throw new Error("Invalid MCP config: \"mcpServers\" must be an object");
		const normalized = JSON.stringify(parsed, null, 2);
		(0, fs.mkdirSync)(this.configDir, { recursive: true });
		(0, fs.writeFileSync)(this.customMcpConfigPath, normalized, "utf-8");
		this.mcpJsonCache.invalidate(this.customMcpConfigPath);
		this.pluginMcpConfigsCache.invalidate();
	}
	readCustomMcpConfig() {
		return this.mcpJsonCache.get(this.customMcpConfigPath);
	}
	stripWorkbuddyMcpMeta(config) {
		const { ["x-workbuddy"]: _workbuddy, ...rest } = config;
		return rest;
	}
	applyMcpTokenValues(config, tokenValues) {
		if (!tokenValues || Object.keys(tokenValues).length === 0) return this.cloneJsonObject(config);
		const replaceValue = (value) => {
			if (typeof value === "string") return value.replace(/\$\{([A-Z0-9_]+)\}/g, (match, key) => tokenValues[key] ?? match);
			if (Array.isArray(value)) return value.map(replaceValue);
			if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, replaceValue(child)]));
			return value;
		};
		return replaceValue(config);
	}
	isSameMcpConfig(a, b) {
		return this.stableStringify(this.normalizeMcpConfigForCompare(a)) === this.stableStringify(this.normalizeMcpConfigForCompare(b));
	}
	normalizeMcpConfigForCompare(value) {
		if (Array.isArray(value)) return value.map((item) => this.normalizeMcpConfigForCompare(item));
		if (!value || typeof value !== "object") return value;
		return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "disabled").map(([key, child]) => [key, this.normalizeMcpConfigForCompare(child)]));
	}
	stableStringify(value) {
		if (Array.isArray(value)) return `[${value.map((item) => this.stableStringify(item)).join(",")}]`;
		if (!value || typeof value !== "object") return JSON.stringify(value);
		return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${this.stableStringify(child)}`).join(",")}}`;
	}
	cloneJsonObject(value) {
		return JSON.parse(JSON.stringify(value));
	}
	/**
	* 扫描已安装且已启用插件的 .mcp.json，返回 MCP 服务器字典。
	*
	* daemon 只消费 installed registry 中的全局 cache 记录（含 builtin / inline，见
	* computePluginMcpConfigs 的说明）。project/local scope 属于 Agent CLI 会话运行时，
	* 不在这里投影。
	*/
	readPluginMcpConfigs() {
		return this.pluginMcpConfigsCache.get();
	}
	/**
	* daemon 的所有展示、鉴权与执行入口都必须从同一所有权投影读取。
	* issue #100308 起 computePluginMcpConfigs 会投影全部已启用插件（含 builtin /
	* inline），因此这里事实上是全集；过滤保留为最终防御，避免未来新入口绕过所有权约束。
	*/
	readDaemonPluginMcpConfigs() {
		return Object.fromEntries(Object.entries(this.readPluginMcpConfigs()).filter(([, entry]) => entry.runtimeOwner === "daemon"));
	}
	/** 受保护插件的目录完整性校验接缝（测试可 spy；实现见 plugin-integrity-guard.ts）。 */
	verifyPluginIntegrity(pluginName, installedPath) {
		return verifyPluginDirectoryIntegrity(pluginName, installedPath, this.logger);
	}
	/**
	* `readPluginMcpConfigs` 的真实计算。
	*
	* Claude 的插件目录分成两层：
	* - `plugins/marketplaces/<marketplace>` 是可更新的 marketplace source；
	* - `plugins/cache/<marketplace>/<plugin>/<version>` 是不可变的安装快照。
	*
	* daemon 托管的 plugin MCP 只能从 `installed_plugins.json` 记录的安装快照加载。
	* 普通 directory marketplace 由 Agent CLI 直接使用原始 source；daemon 不扫描它。
	* 直接扫描 marketplaces 会让一次 refresh 在会话中途改变运行代码，也是
	* cache → marketplaces 迁移后 daemon 意外接管内置 MCP 的根因。
	*
	* ## builtin / inline 也由 daemon 投影（issue #100308）
	*
	* 原先这里跳过 `workbuddy-builtin` / `inline` 两个 CLI 自有市场，理由是「Agent CLI
	* 经 CODEBUDDY_PLUGIN_DIRS 自行加载，daemon 不重复投影」。该分工在 Agent CLI 的
	* PLUGIN scope 不受 `--strict-mcp-config` 屏蔽时成立；#91110 把 `McpScope.PLUGIN`
	* 加进 `STRICT_MCP_BLOCKED_SCOPES` 后，桌面会话（恒带 `--strict-mcp-config`）两条
	* 车道同时失效，`weixinpay` / `sheetagent` 等内置 MCP 静默连不上。
	*
	* 现在 daemon 解析全部已启用插件的 MCP，按普通自定义 MCP 处理（进 desiredConfigs、
	* 有连接状态与开关）。非 strict 会话里 CLI 的 PLUGIN scope 仍会读到同名 server，
	* 但 `MERGE_SCOPE_PRIORITY` 中 DYNAMIC 先于 PLUGIN 且按名字去重，不会重复拉起。
	*/
	computePluginMcpConfigs() {
		const result = {};
		const t0 = Date.now();
		let installedPluginCount = 0;
		let selectedPluginCount = 0;
		try {
			const settingsPath = (0, path.join)(this.configDir, "settings.json");
			let enabledPlugins = {};
			let pluginConfigs = {};
			try {
				const raw = parseJsonc((0, fs.readFileSync)(settingsPath, "utf-8"));
				enabledPlugins = raw.enabledPlugins || {};
				pluginConfigs = raw.pluginConfigs || {};
			} catch (error) {
				if (error.code !== "ENOENT") this.logger.warn("[ConnectorService] computePluginMcpConfigs: failed to read settings.json:", error);
				return result;
			}
			const registryPath = (0, path.join)(this.configDir, "plugins", INSTALLED_PLUGINS_FILE_NAME);
			let rawPlugins = {};
			try {
				const rawRegistry = JSON.parse((0, fs.readFileSync)(registryPath, "utf-8"));
				const plugins = rawRegistry && typeof rawRegistry === "object" && !Array.isArray(rawRegistry) ? rawRegistry.plugins : void 0;
				if (plugins && typeof plugins === "object" && !Array.isArray(plugins)) rawPlugins = plugins;
			} catch (error) {
				if (error.code !== "ENOENT") this.logger.warn("[ConnectorService] computePluginMcpConfigs: failed to read installed_plugins.json:", error);
			}
			const enabledPluginsWithDefaults = { ...enabledPlugins };
			for (const pluginId of require_tar$1.DEFAULT_ENABLED_PLUGIN_IDS) if (!Object.prototype.hasOwnProperty.call(enabledPluginsWithDefaults, pluginId)) enabledPluginsWithDefaults[pluginId] = true;
			enabledPlugins = enabledPluginsWithDefaults;
			const pluginSecrets = this.readPluginSecrets();
			const enabledCount = Object.values(enabledPlugins).filter(Boolean).length;
			installedPluginCount = Object.keys(rawPlugins).length;
			this.logger.info(`[ConnectorService] computePluginMcpConfigs: start (enabledPlugins=${enabledCount}, installedPlugins=${installedPluginCount})`);
			const cacheRoot = (0, path.resolve)(this.configDir, "plugins", PLUGIN_CACHE_DIR);
			const agentCliOwnedMarketplaces = new Set([AGENT_CLI_INLINE_PLUGIN_MARKETPLACE, WORKBUDDY_BUILTIN_PLUGIN_MARKETPLACE]);
			const agentCliOwnedPluginNames = new Set(Object.entries(enabledPlugins).map(([pluginId, enabled]) => {
				const atIndex = pluginId.indexOf("@");
				if (!enabled || atIndex <= 0 || atIndex === pluginId.length - 1) return;
				const pluginName = pluginId.slice(0, atIndex);
				const marketplaceName = pluginId.slice(atIndex + 1);
				if (!agentCliOwnedMarketplaces.has(marketplaceName)) return;
				const pluginDir = (0, path.join)(this.configDir, "plugins", "marketplaces", marketplaceName, "plugins", pluginName);
				if (!(0, fs.existsSync)(pluginDir)) return;
				let manifestName;
				for (const metadataDir of PLUGIN_METADATA_DIRS$2) try {
					const manifest = JSON.parse((0, fs.readFileSync)((0, path.join)(pluginDir, metadataDir, "plugin.json"), "utf-8"));
					if (typeof manifest.name === "string" && manifest.name.trim()) {
						manifestName = manifest.name.trim();
						break;
					}
				} catch {}
				if (!manifestName) return;
				return manifestName;
			}).filter((pluginName) => Boolean(pluginName)));
			for (const [pluginId, enabled] of Object.entries(enabledPlugins)) {
				if (!enabled) continue;
				const atIndex = pluginId.indexOf("@");
				if (atIndex <= 0 || atIndex === pluginId.length - 1) continue;
				const marketplaceName = pluginId.slice(atIndex + 1);
				const pluginName = pluginId.slice(0, atIndex);
				if (!agentCliOwnedMarketplaces.has(marketplaceName) && agentCliOwnedPluginNames.has(pluginName)) continue;
				const rawRecords = rawPlugins[pluginId];
				if (!rawRecords) {
					this.logger.warn(`[ConnectorService] computePluginMcpConfigs: enabled plugin ${pluginId} has no installed cache record; marketplace source is not used as a fallback`);
					continue;
				}
				const records = (Array.isArray(rawRecords) ? rawRecords : [rawRecords]).filter((record) => !!record && typeof record === "object" && !Array.isArray(record));
				const selected = this.selectDaemonPluginCacheRecord(pluginId, records, cacheRoot);
				if (!selected?.installPath) {
					this.logger.warn(`[ConnectorService] computePluginMcpConfigs: enabled plugin ${pluginId} has no daemon-readable installed cache; marketplace source is not used as a fallback`);
					continue;
				}
				if (!this.verifyPluginIntegrity(pluginName, selected.installPath)) {
					this.logger.error(`[ConnectorService] computePluginMcpConfigs: skipping ${pluginId} at ${selected.installPath} — plugin directory integrity verification failed`);
					continue;
				}
				selectedPluginCount++;
				try {
					const servers = this.loadPluginMcpServers(selected.installPath, pluginId, selected.resolvedVersion || selected.version, {
						pluginConfigs,
						pluginSecrets
					});
					for (const [serverName, entry] of Object.entries(servers)) {
						const current = result[serverName];
						if (!current || !agentCliOwnedMarketplaces.has(current.sourceMarketplaceName ?? "") && agentCliOwnedMarketplaces.has(entry.sourceMarketplaceName ?? "")) result[serverName] = entry;
					}
				} catch (error) {
					this.logger.warn(`[ConnectorService] computePluginMcpConfigs: failed to process installed plugin ${pluginId} at ${selected.installPath}:`, error);
				}
			}
			if (installedPluginCount === 0) {
				this.logger.info(`[ConnectorService] computePluginMcpConfigs: done in ${Date.now() - t0}ms (installedPlugins=0, selectedPlugins=0, servers=0)`);
				return result;
			}
		} catch (error) {
			this.logger.warn("[ConnectorService] computePluginMcpConfigs failed:", error);
		}
		const elapsedMs = Date.now() - t0;
		this.logger.info(`[ConnectorService] computePluginMcpConfigs: done in ${elapsedMs}ms (installedPlugins=${installedPluginCount}, selectedPlugins=${selectedPluginCount}, servers=${Object.keys(result).length})`);
		return result;
	}
	selectDaemonPluginCacheRecord(pluginId, records, cacheRoot) {
		const scopePriority = {
			managed: 2,
			user: 1
		};
		const atIndex = pluginId.indexOf("@");
		if (atIndex <= 0 || atIndex === pluginId.length - 1) return;
		const pluginName = pluginId.slice(0, atIndex);
		const marketplaceName = pluginId.slice(atIndex + 1);
		const expectedMarketplaceSegment = this.sanitizePluginCacheSegment(marketplaceName, "name");
		const expectedPluginSegment = this.sanitizePluginCacheSegment(pluginName, "name");
		const pluginsRoot = (0, path.resolve)(cacheRoot, "..");
		const configRoot = (0, path.resolve)(this.configDir);
		const expectedPluginRoot = (0, path.resolve)(cacheRoot, expectedMarketplaceSegment, expectedPluginSegment);
		let realConfigRoot;
		let realPluginsRoot;
		let realCacheRoot;
		let realExpectedPluginRoot;
		try {
			if ((0, fs.lstatSync)(pluginsRoot).isSymbolicLink()) return;
			realConfigRoot = (0, fs.realpathSync)(configRoot);
			realPluginsRoot = (0, fs.realpathSync)(pluginsRoot);
			realCacheRoot = (0, fs.realpathSync)(cacheRoot);
			realExpectedPluginRoot = (0, fs.realpathSync)(expectedPluginRoot);
		} catch {
			return;
		}
		if ((0, path.relative)(realConfigRoot, realPluginsRoot) !== "plugins" || (0, path.relative)(realPluginsRoot, realCacheRoot) !== PLUGIN_CACHE_DIR || (0, path.relative)(realCacheRoot, realExpectedPluginRoot) !== (0, path.join)(expectedMarketplaceSegment, expectedPluginSegment)) return;
		return records.filter((record) => {
			if (!record.installPath || !record.version || !scopePriority[record.scope || ""]) return false;
			try {
				const installedPath = (0, fs.realpathSync)((0, path.resolve)(record.installPath));
				const expectedVersionSegment = this.sanitizePluginCacheSegment(record.version, "version");
				return (0, path.relative)(realExpectedPluginRoot, installedPath) === expectedVersionSegment;
			} catch {
				return false;
			}
		}).sort((left, right) => {
			const scopeDelta = scopePriority[right.scope || ""] - scopePriority[left.scope || ""];
			if (scopeDelta !== 0) return scopeDelta;
			const leftUpdated = left.lastUpdated || left.installedAt || "";
			return (right.lastUpdated || right.installedAt || "").localeCompare(leftUpdated);
		})[0];
	}
	sanitizePluginCacheSegment(value, kind) {
		const sanitized = kind === "version" ? value.replace(/[^a-zA-Z0-9\-_.]/g, "-") : value.replace(/[^a-zA-Z0-9\-_]/g, "-");
		return sanitized === "." || sanitized === ".." ? "-" : sanitized || "unknown";
	}
	/**
	* 读取单个插件目录的 MCP server 配置。
	* 插件须包含 plugin.json（在 metadata 子目录下）且已被用户启用，否则返回空对象。
	* 插件须包含 .mcp.json，否则返回空对象。
	*/
	/**
	* 读取 `~/.workbuddy/credentials.json` 的 `pluginSecrets`（与 Agent CLI 的
	* `PluginOptionsStorage.loadSensitiveOptions` 同源同形）。文件不存在 / 解析失败
	* 一律当空 —— 缺敏感选项只会让个别占位符解析失败并跳过那个 server，不该整包炸掉。
	*/
	readPluginSecrets() {
		try {
			return JSON.parse((0, fs.readFileSync)((0, path.join)(this.configDir, "credentials.json"), "utf-8"))?.pluginSecrets ?? {};
		} catch {
			return {};
		}
	}
	/**
	* 组装插件环境上下文，口径对齐 Agent CLI 的
	* `PluginLoaderManager.loadPluginComponents`：pluginId 用 `<name>@<marketplace>`，
	* 选项 = plugin.json 的 `userConfig` 默认值 ← settings.json `pluginConfigs` ←
	* credentials.json `pluginSecrets`（敏感优先）。
	*/
	buildPluginEnvironmentContext(pluginId, pluginDir, pluginMeta, stores) {
		const userConfig = pluginMeta.userConfig && typeof pluginMeta.userConfig === "object" && !Array.isArray(pluginMeta.userConfig) ? pluginMeta.userConfig : {};
		const storedOptions = {
			...stores.pluginConfigs[pluginId]?.options ?? {},
			...stores.pluginSecrets[pluginId] ?? {}
		};
		return {
			pluginId,
			pluginRoot: pluginDir,
			pluginData: getPluginDataDirectory(pluginId, (0, path.join)(this.configDir, "plugins")),
			options: resolvePluginOptionValues(userConfig, storedOptions),
			userConfig
		};
	}
	/**
	* 解析一个 JSON(C) 文件里的 MCP server 字典，兼容两种写法（对齐 Agent CLI 的
	* `MCPExtensionLoader.parseServerConfigFile`）：
	* 1. 包装格式 `{ "mcpServers": { "<name>": {...} } }`
	* 2. 扁平格式 `{ "<name>": { "command": ... } }` —— 仅当**每一项**都带
	*    `command` / `url` 时才认，否则（如 `mcp/package.json` 这种恰好同目录的
	*    npm 清单）返回空，不产生垃圾条目。
	*/
	parsePluginMcpServerFile(filePath) {
		try {
			const config = parseJsonc((0, fs.readFileSync)(filePath, "utf-8"));
			if (!config || typeof config !== "object" || Array.isArray(config)) return {};
			const wrapped = config.mcpServers;
			if (wrapped && typeof wrapped === "object" && !Array.isArray(wrapped)) return wrapped;
			const entries = Object.entries(config);
			return entries.length > 0 && entries.every(([, value]) => !!value && typeof value === "object" && !Array.isArray(value) && ("command" in value || "url" in value)) ? config : {};
		} catch {
			return {};
		}
	}
	/**
	* 汇总一个插件声明 MCP 的**全部三个来源**，顺序与合并语义对齐 Agent CLI 的
	* `MCPExtensionLoader.load`（后者覆盖前者）：
	*
	* 1. `plugin.json` 的 `mcpServers`（内联对象，或指向配置文件的相对路径字符串）；
	* 2. 插件根目录的 `.mcp.json`；
	* 3. `mcp/` 目录下的 `*.json`。
	*
	* 只读 `.mcp.json` 是不够的：现网 `sheetagent@workbuddy-builtin` 就是把 server
	* 内联在 `plugin.json.mcpServers` 里（根本没有 `.mcp.json`），漏掉这一路等于
	* 「投影跑了但 sheetagent 依旧连不上」（issue #100299 点名的现象之一）。
	*/
	readPluginMcpServerSources(pluginDir, pluginMeta) {
		const servers = {};
		const declared = pluginMeta.mcpServers;
		if (typeof declared === "string" && declared) Object.assign(servers, this.parsePluginMcpServerFile((0, path.join)(pluginDir, declared)));
		else if (declared && typeof declared === "object" && !Array.isArray(declared)) Object.assign(servers, declared);
		Object.assign(servers, this.parsePluginMcpServerFile((0, path.join)(pluginDir, ".mcp.json")));
		const mcpDir = (0, path.join)(pluginDir, "mcp");
		try {
			for (const entry of (0, fs.readdirSync)(mcpDir)) {
				if (!entry.endsWith(".json")) continue;
				Object.assign(servers, this.parsePluginMcpServerFile((0, path.join)(mcpDir, entry)));
			}
		} catch {}
		return servers;
	}
	loadPluginMcpServers(pluginDir, pluginId, installedVersion, stores) {
		let pluginMeta;
		for (const metaDir of PLUGIN_METADATA_DIRS$2) try {
			pluginMeta = JSON.parse((0, fs.readFileSync)((0, path.join)(pluginDir, metaDir, "plugin.json"), "utf-8"));
			break;
		} catch {}
		if (!pluginMeta) return {};
		const atIdx = pluginId.indexOf("@");
		if (atIdx <= 0 || atIdx === pluginId.length - 1) return {};
		const sourcePluginName = pluginId.slice(0, atIdx);
		const sourceMarketplaceName = pluginId.slice(atIdx + 1);
		const manifestPluginName = pluginMeta.name;
		if (manifestPluginName && manifestPluginName !== sourcePluginName) {
			this.logger.warn(`[ConnectorService] installed plugin manifest name mismatch: registry=${pluginId}, manifest=${manifestPluginName}`);
			return {};
		}
		const pluginVersion = installedVersion || (typeof pluginMeta.version === "string" ? pluginMeta.version : void 0);
		if (installedVersion && typeof pluginMeta.version === "string" && pluginMeta.version !== installedVersion) {
			this.logger.warn(`[ConnectorService] installed plugin manifest version mismatch: registry=${installedVersion}, manifest=${pluginMeta.version}, plugin=${pluginId}`);
			return {};
		}
		const runtimeOwner = "daemon";
		const servers = this.readPluginMcpServerSources(pluginDir, pluginMeta);
		if (Object.keys(servers).length === 0) return {};
		const environment = this.buildPluginEnvironmentContext(pluginId, pluginDir, pluginMeta, stores);
		const result = {};
		for (const [serverName, serverConfig] of Object.entries(servers)) {
			if (!serverConfig || typeof serverConfig !== "object") continue;
			if (usesPluginDataPlaceholder(JSON.stringify(serverConfig)) && !ensurePluginDataDirectory(environment.pluginData)) this.logger.warn(`[ConnectorService] loadPluginMcpServers: failed to create plugin data dir for ${pluginId} at ${environment.pluginData}; projecting anyway`);
			let cfg;
			try {
				cfg = substitutePluginVariablesDeep(this.cloneJsonObject(serverConfig), environment);
			} catch (error) {
				this.logger.warn(`[ConnectorService] loadPluginMcpServers: skipping MCP server "${serverName}" of ${pluginId}:`, error);
				continue;
			}
			if (!cfg.type || typeof cfg.type !== "string") {
				if (typeof cfg.command === "string" && cfg.command) cfg.type = "stdio";
				else if (typeof cfg.url === "string" && cfg.url) cfg.type = "http";
			}
			if (cfg.type === "stdio" || typeof cfg.command === "string") {
				const rawEnv = cfg.env && typeof cfg.env === "object" && !Array.isArray(cfg.env) ? cfg.env : {};
				cfg.env = {
					...rawEnv,
					...buildPluginSubprocessEnvironment(environment)
				};
			}
			result[serverName] = {
				config: cfg,
				sourcePluginId: pluginId,
				sourcePluginName,
				sourceMarketplaceName,
				sourcePluginVersion: pluginVersion,
				runtimeOwner
			};
		}
		return result;
	}
	writeCustomMcpConfig(config) {
		(0, fs.mkdirSync)(this.configDir, { recursive: true });
		(0, fs.writeFileSync)(this.customMcpConfigPath, JSON.stringify(config, null, 2), "utf-8");
		this.mcpJsonCache.invalidate(this.customMcpConfigPath);
		this.pluginMcpConfigsCache.invalidate();
	}
	ensureCustomMcpConfig() {
		(0, fs.mkdirSync)(this.configDir, { recursive: true });
		if (!(0, fs.existsSync)(this.customMcpConfigPath)) {
			(0, fs.writeFileSync)(this.customMcpConfigPath, JSON.stringify({ mcpServers: {} }, null, 2), "utf-8");
			this.mcpJsonCache.invalidate(this.customMcpConfigPath);
		}
	}
	/**
	* 决议生效的 Ardot MCP 配置。
	*
	* Ardot 是标准远端 MCP Server（HTTP transport），默认用内置的正式环境配置
	* （`buildBuiltinArdotMcpConfig`）。用户可在 mcp.json 里以同名 key `ardot` +
	* `dev: true` 覆盖 URL / headers，把设计创意会话整体切到测试环境走查，
	* 见 `isValidArdotDevMcpServer`。
	*
	* server key 沿用 `ardot`（`BUILTIN_ARDOT_MCP_SERVER_NAME`），由 McpService 按
	* session 上下文（welcomeMode / projectId）过滤可见工具；MCP Apps 侧按
	* `ardot/<tool>` appId 硬编码的画布链路亦依赖此 key。
	*/
	resolveEffectiveArdotMcpServer(userEntry) {
		if (isValidArdotDevMcpServer(userEntry)) {
			const config = buildArdotDevOverrideMcpConfig(userEntry);
			this.logger.warn(`[ConnectorService] Ardot dev override active: url=${config.url} staticAuth=${hasStaticArdotAuthHeader(userEntry)} (设计创意会话将连到该环境，而非正式环境)`);
			return config;
		}
		return buildBuiltinArdotMcpConfig$1();
	}
	/** 读取 mcp.json 中用户手写的 ardot 覆盖条目（未配置 / 不合法时返回 undefined）。 */
	readArdotUserEntry() {
		return this.readCustomMcpConfig().mcpServers?.[BUILTIN_ARDOT_MCP_SERVER_NAME];
	}
	/**
	* 当前是否处于 Ardot「静态鉴权模式」——用户 dev 覆盖里自带了 Authorization。
	*
	* 该模式下影子账号链路必须整体让位：`ArdotManager` 不再拿 copilot 后端的授权
	* 状态卡 design 发送门禁，`buildRuntimeMcpConfig` 也不再让 headerOverrides
	* 覆盖用户手写的 Bearer。
	*/
	isArdotStaticAuthOverride() {
		try {
			const userEntry = this.readArdotUserEntry();
			return isValidArdotDevMcpServer(userEntry) && hasStaticArdotAuthHeader(userEntry);
		} catch {
			return false;
		}
	}
	/** applyOverrides 是否应放弃 headerOverrides，保留配置里手写的 Authorization。 */
	shouldPinArdotStaticAuthHeaders(configId) {
		return configId === `${this.CUSTOM_MCP_PREFIX}ardot` && this.isArdotStaticAuthOverride();
	}
	dispose() {
		this.marketplaceDisposed = true;
		this.marketplaceDesiredGeneration += 1;
		this.desiredMarketplaceSource = void 0;
		if (this.updateTimer) {
			clearInterval(this.updateTimer);
			this.updateTimer = null;
		}
		this.closeMcpConfigWatchers();
		if (this.mcpConfigDebounceTimer) {
			clearTimeout(this.mcpConfigDebounceTimer);
			this.mcpConfigDebounceTimer = null;
		}
		this.clearExternallyManagedTokenRetryState();
		this.clearExternallyManagedStaleTokenGuard();
		this.unauthorizedNotifyThrottle.clear();
		for (const ctrl of this.pendingServerSideAuthAborts.values()) ctrl.abort();
		this.pendingServerSideAuthAborts.clear();
		this.runtimeMcpInspections.clear();
		this.runtimeMcpStatuses.clear();
		try {
			this.accountChangeUnsubscribe?.();
		} catch {}
		this.accountChangeUnsubscribe = null;
		try {
			this.productFeatureChangeUnsubscribe?.();
		} catch {}
		this.productFeatureChangeUnsubscribe = null;
		for (const configId of this.getEnabledConnectorIds()) this.serverSideOauthRefresher?.stop(configId);
		this.serverSideOauthRefresher = null;
	}
	async doInit() {
		try {
			this.logger.info("[ConnectorService] Initializing...");
			const skillsDir = (0, path.join)(this.configDir, "skills");
			if (!(0, fs.existsSync)(skillsDir)) (0, fs.mkdirSync)(skillsDir, { recursive: true });
			this.migrateLegacyConnectorSkills();
			this.loadPersistentState();
			this.loadApprovals();
			this.startServerSideOauthRefresher();
			this.ioaAuth = new IoaServerSideAuth({
				getApiEndpoint: () => this.productManager.getEndpoint(),
				buildAuthHeaders: (c, t, csrf) => this.authenticationManager.buildAuthHeaders?.(c ?? true, t ?? true, csrf ?? false) ?? {},
				fetch: this.hostCapabilities?.fetch || fetch,
				openExternal: (url) => this.hostCapabilities.openExternal(url),
				getEnterpriseId: () => this.authService?.getAccount?.()?.enterpriseId,
				logger: this.logger
			});
			await this.syncMarketplaceContent();
			this.rebuildAuthInjectionRuleCache();
			if (this.stripBearerPrefixFromExternallyManagedHeaderOverrides()) this.savePersistentState();
			this.ensurePersistentStateMatchesCurrentIdentity();
			this.restoreOAuthState();
			this.purgeServerSideOauthResidue();
			this.writeConnectorsMcpConfig();
			this.startUpdateTimer();
			this.watchMcpConfig();
			try {
				await this.syncEnterpriseConnectorUnbind();
				await this.scheduleEnterpriseConnectorRefreshes({ skipRefreshAndSync: true });
			} catch (err) {
				this.logger.warn("[ConnectorService] enterprise connector sync on init failed:", err);
			}
			this.startServerSideOauthRefreshForEnabled();
			this.refreshAndSync().catch((error) => {
				this.logger.warn("[ConnectorService] Initial refreshAndSync failed:", error);
			});
			this.restoreSkillOnlyConnectedState();
			for (const configId of this.getEnabledConnectorIds()) {
				if ((this.getMarketplaceEntryById(configId)?.type || "mcp") !== "mcp") continue;
				try {
					this.installSkills(configId);
				} catch (error) {
					this.logger.warn(`[ConnectorService] Startup installSkills failed for ${configId}:`, error);
				}
			}
			this.autoConnectCliConnectors().catch((error) => {
				this.logger.warn("[ConnectorService] CLI auto-connect failed:", error);
			});
			this.bindAccountChangeListener();
			this.bindProductConfigurationChangeListener();
			this.logger.info("[ConnectorService] Initialized");
			if (process.platform === "win32") {
				const s = require_tar$1.getAclStats();
				this.logger.info(`[ConnectorService] ACL stats: verify ${s.verifyTotal} total / ${s.verifyCacheHit} cache-hit / ${s.verifyIcaclsMs}ms icacls | enforce ${s.enforceTotal} total / ${s.enforceCacheHit} cache-hit / ${s.enforceIcaclsMs}ms icacls`);
			}
		} catch (error) {
			this.logger.error("[ConnectorService] Init failed:", error);
			this.startUpdateTimer();
		}
	}
	async ensureInitialized() {
		if (!this.initPromise) await this.init();
		return this.initPromise;
	}
	/**
	* 注册 authService.onStateChanged 监听，把账号 / 企业变更转化为「内存状态重置 + 新账号目录加载」。
	*
	* 触发条件：仅当 uid + enterpriseId 组合真的发生变化才走重置；token 续签等不影响身份的
	* next() 会被 noop 跳过，避免无意义重连。
	*/
	bindAccountChangeListener() {
		this.lastBoundIdentityKey = this.getCurrentAccountIdentityKey();
		if (this.accountChangeUnsubscribe) {
			try {
				this.accountChangeUnsubscribe();
			} catch {}
			this.accountChangeUnsubscribe = null;
		}
		this.accountChangeUnsubscribe = this.authService.onStateChanged(() => {
			const nextIdentityKey = this.getCurrentAccountIdentityKey();
			if (nextIdentityKey === this.lastBoundIdentityKey) return;
			const prevIdentityKey = this.lastBoundIdentityKey;
			this.lastBoundIdentityKey = nextIdentityKey;
			this.userChangeChain = this.userChangeChain.then(async () => {
				try {
					await this.handleUserChanged(prevIdentityKey, nextIdentityKey);
				} catch (err) {
					this.logger.warn(`[ConnectorService] handleUserChanged(${prevIdentityKey} -> ${nextIdentityKey}) failed:`, err);
				}
			});
		});
	}
	/**
	* 注册 productManager.onDidChange 监听：
	* - Marketplace source 到达或变化时，按最新 URL 串行同步；
	* - productFeatures 中影响 desiredConfigs 的字段（当前：AgentMail）变化时，
	*   串行触发一次 refreshAndSync。
	*
	* 设计与 bindAccountChangeListener 同构：信号源变化 → 字段指纹去重 → 串行链调度。
	*/
	bindProductConfigurationChangeListener() {
		this.lastObservedFeatureKey = this.computeProductFeatureKey();
		const initialMarketplaceSource = this.getMarketplaceSourceForCurrentPolicy("product-config-listener-init");
		this.lastObservedMarketplaceSourceKey = initialMarketplaceSource ? this.marketplaceSourceKey(initialMarketplaceSource) : void 0;
		if (this.productFeatureChangeUnsubscribe) {
			try {
				this.productFeatureChangeUnsubscribe();
			} catch {}
			this.productFeatureChangeUnsubscribe = null;
		}
		const disposable = this.productManager.onDidChange(() => {
			const marketplaceSource = this.getMarketplaceSourceForCurrentPolicy("product-config-change");
			const marketplaceSourceKey = marketplaceSource ? this.marketplaceSourceKey(marketplaceSource) : void 0;
			if (marketplaceSource && marketplaceSourceKey !== this.lastObservedMarketplaceSourceKey) this.syncMarketplaceForCurrentPolicy("product-config-change").then(() => {
				if (this.marketplaceSourceKey(marketplaceSource) === marketplaceSourceKey) this.lastObservedMarketplaceSourceKey = marketplaceSourceKey;
			}).catch((error) => {
				this.logger.warn("[ConnectorService] Marketplace sync after product config change failed:", error);
			});
			else if (!marketplaceSource) this.lastObservedMarketplaceSourceKey = void 0;
			const nextKey = this.computeProductFeatureKey();
			if (nextKey === this.lastObservedFeatureKey) return;
			const prevKey = this.lastObservedFeatureKey;
			this.lastObservedFeatureKey = nextKey;
			this.logger.info(`[ConnectorService] productFeatures changed: ${prevKey} → ${nextKey}, scheduling refreshAndSync`);
			this.featureChangeChain = this.featureChangeChain.then(async () => {
				try {
					await this.refreshAndSync();
				} catch (err) {
					this.logger.warn("[ConnectorService] refreshAndSync after productFeatures change failed:", err);
				}
			});
		});
		this.productFeatureChangeUnsubscribe = () => disposable.dispose();
	}
	/**
	* 计算当前 productFeatures 中"会改变 desiredConfigs 的字段"的指纹。
	* 后续如有新门控（如 Netdrive 远端开关），在此追加即可，
	* 避免无关字段（models / agents 等）抖动触发 refreshAndSync。
	*
	* 同时把企业身份维度并入指纹：账号变更主要由 bindAccountChangeListener
	* 触发 refreshAndSync，但在极端乱序时序里（productFeatures push 与账号 push 相邻）
	* 双指纹（productFeatures 维度 + enterprise 维度）可以保证任意一条路径都能识别需要重算。
	* 仅区分有 / 无企业身份，**不**把 enterpriseId 值拼进指纹（避免落日志泄漏企业 ID）。
	*/
	computeProductFeatureKey() {
		return `am:${(this.productManager.getCurrentConfiguration()?.productFeatures ?? {}).AgentMail === true ? "1" : "0"}|ent:${this.authService.getAccount()?.enterpriseId ? "1" : "0"}`;
	}
	/**
	* 账号变更时重置 connector 状态，重新从新账号目录加载持久化数据并重连。
	*
	* 重置范围（**仅清进程内内存，不动任何账号磁盘文件**）：
	*   - V2 discovery snapshots：清理上一账号的短连接探测结果；
	*   - oauthManager.clearProviderCache()：清 OAuth provider 闭包缓存的 memoryTokens / memoryClientInfo；
	*   - this.states：运行时连接状态（来自上一账号）；
	*   - this.persistentState：内存中的 enabled/headerOverrides/everConnected 列表；
	*   - serverSideOauthRefresher：旧账号绑定的刷新器。
	*
	* 之后用新账号 uid 重新执行 loadPersistentState / writeConnectorsMcpConfig / refreshAndSync
	* 等价于「在新账号身份下重启了 doInit 的对应步骤」。
	*
	* 不动的：
	*   - Gateway/WorkbuddyConnector 的无账号运行时注册；
	*   - approvalsLoaded / userServerApprovals（MCP Security 信任表，跨账号语义共享）；
	*   - proxyServer（端口/secret 全局共享）；
	*   - mcpConfigWatchers（在状态重置完成后统一关闭并按新 uid 重建，见后文）。
	*/
	async handleUserChanged(prevIdentityKey, nextIdentityKey) {
		this.logger.info(`[ConnectorService] User changed: ${prevIdentityKey ?? "<initial>"} -> ${nextIdentityKey}, resetting connector state`);
		this.marketplaceDesiredGeneration += 1;
		this.desiredMarketplaceSource = void 0;
		this.marketplaceProductConfigurationGeneration += 1;
		this.marketplaceProductConfigurationState = "pending";
		this.marketplaceProductConfigurationPromise = void 0;
		const isLogoutTransient = nextIdentityKey === "default|";
		this.clearExternallyManagedTokenRetryState();
		this.clearExternallyManagedStaleTokenGuard();
		this.unauthorizedNotifyThrottle.clear();
		try {
			this.serverSideOauthRefresher?.stopAll();
		} catch (err) {
			this.logger.warn("[ConnectorService] serverSideOauthRefresher.stopAll failed:", err);
		}
		this.runtimeMcpInspections.clear();
		this.runtimeMcpStatuses.clear();
		try {
			this.oauthManager.clearProviderCache();
		} catch (err) {
			this.logger.warn("[ConnectorService] oauthManager.clearProviderCache failed:", err);
		}
		this.states.clear();
		this.persistentStateLoadedIdentityKey = null;
		this.persistentState = {
			connectors: {},
			headerOverrides: {},
			envOverrides: {},
			disabledToolsOverrides: {}
		};
		this.loadPersistentState();
		this.ensurePersistentStateMatchesCurrentIdentity();
		this.restoreOAuthState();
		this.notifyRuntimeMcpServerConfigsChanged({ credentialsChanged: true });
		if (isLogoutTransient) {
			this.closeMcpConfigWatchers();
			this.logger.info(`[ConnectorService] User change complete (fast path): ${prevIdentityKey ?? "<initial>"} -> ${nextIdentityKey}`);
			return;
		}
		this.writeConnectorsMcpConfig();
		try {
			this.startMarketplaceProductConfigurationResolution("account-change");
			if (this.isLoaded()) await this.tryUpdate();
			else await this.syncMarketplaceContent();
			this.scheduleMarketplaceSyncWhenProductReady("account-change");
			if (this.stripBearerPrefixFromExternallyManagedHeaderOverrides()) this.savePersistentState();
		} catch (err) {
			this.logger.warn("[ConnectorService] tryUpdate after user change failed:", err);
		}
		this.purgeServerSideOauthResidue();
		try {
			await this.syncEnterpriseConnectorUnbind();
			await this.scheduleEnterpriseConnectorRefreshes({ skipRefreshAndSync: true });
		} catch (err) {
			this.logger.warn("[ConnectorService] enterprise connector sync after user change failed:", err);
		}
		this.startServerSideOauthRefreshForEnabled();
		this.restoreSkillOnlyConnectedState();
		await this.autoConnectCliConnectors().catch((err) => {
			this.logger.warn("[ConnectorService] CLI auto-connect after user change failed:", err);
		});
		try {
			await this.refreshAndSync();
		} catch (err) {
			this.logger.warn("[ConnectorService] refreshAndSync after user change failed:", err);
		}
		this.closeMcpConfigWatchers();
		try {
			this.watchMcpConfig();
		} catch (err) {
			this.logger.warn("[ConnectorService] re-watchMcpConfig after user change failed:", err);
		}
		this.logger.info(`[ConnectorService] User change complete: ${prevIdentityKey ?? "<initial>"} -> ${nextIdentityKey}`);
	}
	/**
	* Daemon-only V2 descriptor snapshot.
	*
	* buildDesiredConfigs already applies marketplace trust, enablement,
	* enterprise policy, user tool filters, runtime paths and credential
	* overrides. Return fresh shallow copies so Gateway/session composition
	* cannot mutate ConnectorService's reconciliation inputs.
	*/
	async getRuntimeMcpServerConfigs() {
		const desired = this.buildDesiredConfigs();
		return Object.fromEntries(Object.entries(desired).map(([configId, config]) => [configId, {
			...config,
			...config.args ? { args: [...config.args] } : {},
			...config.headers ? { headers: { ...config.headers } } : {},
			...config.env ? { env: { ...config.env } } : {},
			...config.disabledTools ? { disabledTools: [...config.disabledTools] } : {}
		}]));
	}
	/**
	* Daemon-internal snapshot of `~/.workbuddy/mcp.json` `mcpServers`.
	*
	* Returns a shallow copy of each entry, including disabled servers.
	* Keys are public names (not `custom-mcp:` prefixed). Must never be
	* exposed through renderer RPC.
	*/
	getCustomMcpServersSnapshot() {
		const mcpServers = this.readCustomMcpConfig().mcpServers ?? {};
		return Object.fromEntries(Object.entries(mcpServers).map(([name, entry]) => [name, entry && typeof entry === "object" ? { ...entry } : entry]));
	}
	onRuntimeMcpServerConfigsChanged(listener) {
		this.runtimeMcpServerConfigListeners.add(listener);
		return { dispose: () => {
			this.runtimeMcpServerConfigListeners.delete(listener);
		} };
	}
	notifyRuntimeMcpServerConfigsChanged(event = {}) {
		for (const listener of this.runtimeMcpServerConfigListeners) try {
			listener(event);
		} catch (error) {
			this.logger.warn("[ConnectorService] Runtime MCP descriptor listener failed:", error);
		}
	}
	notifyRuntimeMcpConfigsIfChanged(configs) {
		const sessionDescriptors = Object.fromEntries(Object.entries(configs).map(([configId, config]) => [configId, typeof config.command === "string" && config.command.length > 0 ? config : {
			transport: "gateway",
			defer_loading: config.defer_loading === true
		}]));
		const remoteDescriptors = Object.fromEntries(Object.entries(configs).filter(([, config]) => typeof config.url === "string" && config.url.length > 0));
		const sessionFingerprint = this.stableStringify(sessionDescriptors);
		const remoteFingerprint = this.stableStringify(remoteDescriptors);
		const event = {};
		if (sessionFingerprint !== this.runtimeSessionDescriptorFingerprint) {
			this.runtimeSessionDescriptorFingerprint = sessionFingerprint;
			event.descriptorsChanged = true;
		}
		if (remoteFingerprint !== this.runtimeRemoteDescriptorFingerprint) {
			this.runtimeRemoteDescriptorFingerprint = remoteFingerprint;
			event.gatewayChanged = true;
		}
		if (event.descriptorsChanged || event.gatewayChanged) this.notifyRuntimeMcpServerConfigsChanged(event);
	}
	async resolveRuntimeMcpRequestHeaders(configId, sessionId, projectId) {
		return this.resolveRequestAuthInjectionHeaders(configId, sessionId, projectId);
	}
	async refreshRuntimeMcpAuthorization(configId, sessionId, projectId) {
		const refreshKey = require_tar$1.toRuntimeMcpConfigId(configId);
		let refreshPromise = this.pendingRuntimeAuthRefreshes.get(refreshKey);
		if (!refreshPromise) {
			refreshPromise = this.refreshExternalAuthBeforeReconnect(refreshKey);
			this.pendingRuntimeAuthRefreshes.set(refreshKey, refreshPromise);
			refreshPromise.finally(() => {
				if (this.pendingRuntimeAuthRefreshes.get(refreshKey) === refreshPromise) this.pendingRuntimeAuthRefreshes.delete(refreshKey);
			}).catch(() => void 0);
		}
		const refreshed = await refreshPromise;
		if (!refreshed.ok) throw new Error(refreshed.error || "MCP authorization refresh failed");
		return {
			...refreshed.serverConfig?.headers ?? {},
			...await this.resolveRequestAuthInjectionHeaders(configId, sessionId, projectId)
		};
	}
	/**
	* 注入"未授权"事件推送器（由 daemon 启动时提供）。
	*
	* V2 的显式探测或 Gateway 鉴权刷新发现未授权时，会直接推送该事件。
	*/
	setUnauthorizedEventPusher(push) {
		this.unauthorizedEventPusher = push;
	}
	/**
	* 注入"解绑事件"推送器（由 daemon 启动时提供）。
	*
	* `unbind(configId)` 成功后会通过该 pusher 广播到 renderer，
	* channel 固定为 'connector:unbound'。
	*/
	setUnboundEventPusher(push) {
		this.unboundEventPusher = push;
	}
	setStateChangedNotifier(push) {
		this.stateChangedNotifier = push ?? void 0;
	}
	setCatalogChangedNotifier(push) {
		this.catalogChangedNotifier = push ?? void 0;
	}
	setTokenConfigRequiredNotifier(push) {
		this.tokenConfigRequiredNotifier = push ?? void 0;
	}
	setAuthQrUrlPusher(push) {
		this.authQrUrlPusher = push;
	}
	/**
	* 注入 Device Flow 授权信息推送器（由 daemon-bootstrap 启动时调用）。
	*
	* 详见 `deviceCodePusher` 字段注释。channel 固定为 'connector:device-code'。
	*/
	setDeviceCodePusher(push) {
		this.deviceCodePusher = push;
	}
	emitUnauthorized(rawConfigId, reason) {
		const configId = this.normalizeRuntimeMcpConfigId(rawConfigId);
		if (this.isExternallyManagedConnector(configId) && this.isInvalidExternallyManagedTokenReason(reason)) this.markExternallyManagedStaleToken(configId, this.getAuthorizationFingerprint(configId));
		if (!this.unauthorizedEventPusher) return;
		const now = Date.now();
		if (now - (this.unauthorizedNotifyThrottle.get(configId) ?? 0) < UNAUTHORIZED_NOTIFY_THROTTLE_MS) return;
		this.unauthorizedNotifyThrottle.set(configId, now);
		try {
			this.unauthorizedEventPusher({
				configId,
				reason
			});
		} catch (error) {
			this.logger.warn(`[ConnectorService] unauthorized pusher(${configId}) threw:`, error);
		}
	}
	/**
	* 刷新 token 并对账式同步连接（对齐 Craft refreshOAuthTokensIfNeeded）
	*
	* 触发时机：
	* 1. 初始化完成后
	* 2. connector 连接/断开后
	* 3. 定时检查
	*
	* Issue #49159 follow-up：refreshAndSync 是状态变更后的"对账"路径，
	* 调用方（plugin 启用回调 / connector connect 后 / watcher 防抖触发等）
	* 已经知道配置可能刚变。入口主动 invalidate 缓存避免读到 60 秒 TTL 内
	* 的旧空字典——典型场景：用户首次启用插件时 settings.json 刚创建，
	* `computePluginMcpConfigs` 之前的 ENOENT 分支结果还挂在缓存里。
	*/
	async refreshAndSync() {
		this.pluginMcpConfigsCache.invalidate();
		this.mcpJsonCache.invalidate();
		await this.syncExternallyManagedConnectorTokensBeforeSync();
		const desiredConfigs = this.buildDesiredConfigs();
		this.notifyRuntimeMcpConfigsIfChanged(desiredConfigs);
		const pluginMcpKeys = Object.keys(desiredConfigs).filter((k) => k.startsWith("custom-mcp:"));
		this.logger.info(`[ConnectorService] refreshAndSync: desiredConfigs has ${Object.keys(desiredConfigs).length} entries, plugin/custom MCP: [${pluginMcpKeys.join(", ")}]`);
		const previousRuntimeIds = new Set([...this.runtimeMcpStatuses.keys(), ...this.runtimeMcpInspections.keys()]);
		const desiredIds = new Set(Object.keys(desiredConfigs));
		const removed = [...previousRuntimeIds].filter((id) => !desiredIds.has(id));
		for (const configId of removed) {
			this.setRuntimeMcpStatus(configId);
			this.runtimeMcpInspections.delete(configId);
		}
		await Promise.all(Object.entries(desiredConfigs).map(async ([configId, config]) => {
			if (typeof config.command === "string" && config.command.length > 0) {
				this.setRuntimeMcpStatus(configId, { status: "connected" });
				if (configId.startsWith("connector:")) {
					const rawId = this.normalizeRuntimeMcpConfigId(configId);
					this.updateState(rawId, "connected");
					this.installSkills(rawId);
				}
				return;
			}
			if (typeof config.url !== "string" || config.url.length === 0) return;
			const entry = configId.startsWith("connector:") ? this.getMarketplaceEntryById(configId.slice(require_tar$1.CONNECTOR_PREFIX.length)) : void 0;
			const allowOAuth = !entry || this.resolveActiveAuthMode(entry) !== "token";
			const result = await this.inspectRemoteMcp(configId, config, true, allowOAuth);
			if (!configId.startsWith("connector:")) return;
			const rawId = this.normalizeRuntimeMcpConfigId(configId);
			if (!this.isConnectorStillEnabled(rawId)) {
				this.setRuntimeMcpStatus(configId);
				this.runtimeMcpInspections.delete(configId);
				this.logger.info(`[ConnectorService] refreshAndSync: dropping stale inspection result for ${configId} (disabled during in-flight check)`);
				return;
			}
			if (result.success) {
				this.updateState(rawId, "connected");
				this.installSkills(rawId);
				return;
			}
			this.updateState(rawId, result.needsAuth && allowOAuth ? "unauthorized" : "error", result.error);
			this.disableSkills(rawId);
		}));
		if (removed.length > 0) {
			const oauthStore = this.createOAuthStore();
			for (const configId of removed) {
				const prefix = this.CUSTOM_MCP_PREFIX;
				if (configId.startsWith(prefix)) {
					const serverName = configId.slice(prefix.length);
					oauthStore.deleteByServerName(serverName);
					this.logger.info(`[ConnectorService] Cleaned OAuth credentials for removed MCP server: ${serverName}`);
				}
			}
		}
	}
	async refreshEnterpriseConnectorTokens(applications) {
		if (applications && this.getCurrentEnterpriseId()) this.populateOneidApplicationsCache(this.getCurrentEnterpriseId(), applications);
		await this.syncEnterpriseConnectorUnbind();
		await this.scheduleEnterpriseConnectorRefreshes();
	}
	/**
	* 根据 configId 查找对应 server URL，如果匹配 IOA 服务端 MCP 域名则返回 oauthName。
	* 同时查 plugin MCP 和用户自定义 MCP。
	*/
	resolveIoaOauthNameByConfigId(rawConfigId) {
		const serverName = rawConfigId.startsWith(this.CUSTOM_MCP_PREFIX) ? rawConfigId.slice(this.CUSTOM_MCP_PREFIX.length) : rawConfigId;
		const pluginUrl = (this.readDaemonPluginMcpConfigs()[serverName]?.config)?.url;
		if (pluginUrl) return this.ioaAuth?.resolveOauthNameByUrl(pluginUrl);
		const customUrl = (this.readCustomMcpConfig().mcpServers?.[serverName])?.url;
		return this.ioaAuth?.resolveOauthNameByUrl(customUrl);
	}
	/**
	* 构建期望的连接配置（所有已启用的 connector + 自定义 MCP）
	*
	* Connector 配置统一从 connectors/mcp.json 读取（由 writeConnectorsMcpConfig 维护），
	* 自定义 MCP 配置从 mcp.json 读取，两者 configId 前缀不同，不会冲突。
	*/
	buildDesiredConfigs() {
		const configs = {};
		const manifest = this.readLocalManifest();
		if (manifest?.connectors) for (const entry of manifest.connectors) {
			const source = entry.source || entry.name;
			if (entry.type === "cli" || entry.type === "skill-only") continue;
			const mcpConfig = this.readConnectorMcpConfig(source);
			if (!mcpConfig) continue;
			const merged = this.buildRuntimeMcpConfig(source, mcpConfig);
			if (!this.isEnabled(source)) continue;
			for (const serverEntry of Object.values(merged.mcpServers)) {
				const e = serverEntry;
				if (!e.url && !e.command) continue;
				const runtimeConfigId = require_tar$1.toRuntimeMcpConfigId(source);
				if (this.isExternallyManagedConnector(source)) {
					const authorization = e.headers?.Authorization ?? e.headers?.authorization;
					if (typeof authorization !== "string" || authorization.length === 0) {
						this.logger.info(`[ConnectorService] buildDesiredConfigs: skipping externally-managed connector ${source} until token is ready`);
						continue;
					}
					const tokenFingerprint = this.hashTokenFingerprint(authorization);
					if (this.isExternallyManagedStaleTokenGuardActive(source, tokenFingerprint)) {
						const error = this.getExternallyManagedStaleTokenError(source);
						this.updateState(source, "unauthorized", error);
						this.logger.info(`[ConnectorService] buildDesiredConfigs: skipping externally-managed connector ${source} because token is stale`);
						continue;
					}
				}
				const rawTimeout = e.timeout;
				const timeoutMs = rawTimeout ? rawTimeout < 1e3 ? rawTimeout * 1e3 : rawTimeout : void 0;
				const resolvedUrl = this.resolveStagingConnectorUrl(source, e.url);
				configs[runtimeConfigId] = {
					...e,
					...resolvedUrl !== void 0 ? { url: resolvedUrl } : {},
					...timeoutMs !== void 0 ? { timeout: timeoutMs } : {}
				};
			}
		}
		const customConfig = this.readCustomMcpConfig();
		const ardotUserEntry = customConfig.mcpServers?.[BUILTIN_ARDOT_MCP_SERVER_NAME];
		const effectiveArdotConfig = this.resolveEffectiveArdotMcpServer(ardotUserEntry);
		const ardotConfigId = `${this.CUSTOM_MCP_PREFIX}${BUILTIN_ARDOT_MCP_SERVER_NAME}`;
		const runtimeArdotConfig = effectiveArdotConfig ? this.buildRuntimeMcpConfig(ardotConfigId, { mcpServers: { [BUILTIN_ARDOT_MCP_SERVER_NAME]: effectiveArdotConfig } }).mcpServers[BUILTIN_ARDOT_MCP_SERVER_NAME] : void 0;
		const effectiveNetdriveConfig = this.resolveEffectiveNetdriveMcpServer(customConfig.mcpServers?.[BUILTIN_NETDRIVE_MCP_SERVER_NAME]);
		for (const [name, entry] of Object.entries(customConfig.mcpServers || {})) {
			if (name === "ardot") continue;
			if (name === "netdrive") continue;
			const e = entry;
			if (e.disabled || !e.url && !e.command) continue;
			if (e.managedBy === "connector") continue;
			const configId = `${this.CUSTOM_MCP_PREFIX}${name}`;
			const configHash = this.calculateConfigHash(e);
			const { BLACKLIST_HASHES: buildBlacklist } = this.getTrustLists();
			if (buildBlacklist.includes(configHash)) {
				this.logger.info(`[MCP Security] buildDesiredConfigs: blocking blacklisted server "${name}"`);
				continue;
			}
			if (!this.isUserServerApproved(name, configHash)) {
				this.logger.info(`[MCP Security] buildDesiredConfigs: skipping untrusted server "${name}" (hash: ${configHash})`);
				continue;
			}
			configs[configId] = {
				...this.buildRuntimeMcpConfig(configId, { mcpServers: { [name]: e } }).mcpServers[name] ?? e,
				defer_loading: true
			};
		}
		if (runtimeArdotConfig && !runtimeArdotConfig.disabled) configs[ardotConfigId] = {
			...runtimeArdotConfig,
			defer_loading: false
		};
		if (effectiveNetdriveConfig && !effectiveNetdriveConfig.disabled) configs[`${this.CUSTOM_MCP_PREFIX}${BUILTIN_NETDRIVE_MCP_SERVER_NAME}`] = {
			...effectiveNetdriveConfig,
			defer_loading: true
		};
		const agentMailMcpConfig = this.buildAgentMailMcpConfig();
		if (agentMailMcpConfig) {
			configs[`${this.CUSTOM_MCP_PREFIX}agent-mail`] = agentMailMcpConfig;
			this.logger.info(`[ConnectorService] agent-mail MCP: injected into desiredConfigs (url=${agentMailMcpConfig.url})`);
		}
		try {
			const pluginMcpConfigs = this.readDaemonPluginMcpConfigs();
			for (const [name, { config }] of Object.entries(pluginMcpConfigs)) {
				const configId = `${this.CUSTOM_MCP_PREFIX}${name}`;
				if (configs[configId]) continue;
				const e = config;
				if (e.disabled || this.persistentState.pluginMcpDisabledOverrides?.[name] === true || !e.url && !e.command) continue;
				configs[configId] = {
					...this.buildRuntimeMcpConfig(configId, { mcpServers: { [name]: e } }).mcpServers[name] ?? e,
					defer_loading: true
				};
			}
		} catch (error) {
			this.logger.warn("[ConnectorService] buildDesiredConfigs: failed to read plugin MCP configs:", error);
		}
		const overrides = this.persistentState.disabledToolsOverrides ?? {};
		for (const [configId, config] of Object.entries(configs)) {
			const overrideList = overrides[configId.startsWith(this.CUSTOM_MCP_PREFIX) ? configId.slice(this.CUSTOM_MCP_PREFIX.length) : configId];
			if (!overrideList || overrideList.length === 0) continue;
			const merged = new Set([...Array.isArray(config.disabledTools) ? config.disabledTools : [], ...overrideList]);
			configs[configId] = {
				...config,
				disabledTools: Array.from(merged)
			};
		}
		return configs;
	}
	/** 启动 server-side OAuth refresher 单例 */
	startServerSideOauthRefresher() {
		this.serverSideOauthRefresher = new ConnectorServerSideOauthRefresher(async () => ({
			productManager: this.productManager,
			authenticationManager: this.authenticationManager,
			fetch: this.hostCapabilities.fetch
		}), {
			updateHeaders: async (configId, headers, skipReconnect) => {
				const result = await this.updateHeaders(configId, headers, skipReconnect);
				if (result.success) {
					const normalizedId = this.normalizeRuntimeMcpConfigId(configId);
					const currentState = this.states.get(normalizedId);
					if (currentState?.status === "unauthorized" || currentState?.status === "error") if (!this.isEnabled(normalizedId) && this.hasActiveConnectIntent(normalizedId)) {
						this.logger.info(`[ConnectorService] ServerSideOauth refresh success: completing first connect for ${normalizedId}`);
						this.connect(normalizedId, {
							silent: true,
							skipClearClientInfo: true
						}).catch((err) => {
							this.logger.warn(`[ConnectorService] ServerSideOauth first-connect completion failed for ${normalizedId}:`, err);
						});
					} else {
						this.logger.info(`[ConnectorService] ServerSideOauth refresh success: ${normalizedId} was ${currentState.status}, triggering reconnect`);
						this.refreshAndSync().catch((err) => {
							this.logger.warn(`[ConnectorService] ServerSideOauth refreshAndSync failed for ${normalizedId}:`, err);
						});
					}
				}
				return result;
			},
			buildTokenHeaders: (configId, connectorName, accessToken) => this.resolveTokenHeaders(configId, connectorName, accessToken),
			onTokenApplied: (configId) => this.applyEnterpriseTokenToActiveConnection(configId),
			disconnect: (configId) => this.disconnect(configId, { userInitiated: false }),
			markUnauthorized: (configId, error) => {
				const normalizedId = this.normalizeRuntimeMcpConfigId(configId);
				this.logger.warn(`[ConnectorService] ServerSideOauth markUnauthorized: ${normalizedId}, error=${error}`);
				this.updateState(normalizedId, "unauthorized", error);
			}
		}, this.logger);
	}
	setServerSideOauthFetch(fetchFn) {
		this.setHostCapabilities({ fetch: fetchFn });
	}
	setHostCapabilities(capabilities) {
		this.hostCapabilities = {
			...this.hostCapabilities,
			...capabilities
		};
		this.oauthManager?.setHostCapabilities({ openExternal: async (url) => {
			await this.hostCapabilities.openExternal(url);
		} });
		this.cliExecutor?.setHostCapabilities({
			openExternal: this.hostCapabilities.openExternal,
			sendRuntimeProgress: this.hostCapabilities.sendRuntimeProgress
		});
		this.remoteMcpClient.setHostCapabilities?.({ getAppVersion: this.hostCapabilities.getAppVersion });
	}
	isEnterpriseManagedOneidConnector(entry) {
		return require_tar$1.isEnterpriseManagedOneidConnector(entry, this.getConnectorAccountContext());
	}
	purgeServerSideOauthResidue() {
		let oauthStore;
		for (const configId of this.getEnabledConnectorIds()) {
			const rawConfigId = this.normalizeRuntimeMcpConfigId(configId);
			const entry = this.getMarketplaceEntryById(rawConfigId);
			if (!entry || this.resolveActiveAuthMode(entry) !== "server-side") continue;
			const names = /* @__PURE__ */ new Set();
			for (const name of [
				rawConfigId,
				entry.source,
				entry.provider_id,
				entry.name
			]) if (typeof name === "string" && name.length > 0) names.add(name);
			if (names.size === 0) continue;
			oauthStore ??= this.createOAuthStore();
			let purgedCount = 0;
			for (const name of names) purgedCount += oauthStore.purgeByServerName(name);
			if (purgedCount > 0) this.logger.info(`[ConnectorService] purged ${purgedCount} OAuth credential slot(s) for server-side connector ${rawConfigId}`);
		}
	}
	/**
	* 如果 connector 声明了 auth_mode === 'server-side'，为其启动 token 刷新任务。
	* 在 connect() 成功后、以及 init() 对已启用 connector 恢复时调用。
	*/
	maybeScheduleServerSideOauth(configId) {
		if (!this.serverSideOauthRefresher) return;
		const entry = this.getMarketplaceEntryById(configId);
		if (!entry || this.resolveActiveAuthMode(entry) !== "server-side") return;
		if (this.resolveActiveEnterpriseVariant(entry) || this.isEnterpriseManagedOneidConnector(entry)) return;
		const connectorName = this.resolveOauthName(configId);
		this.serverSideOauthRefresher.schedule(configId, connectorName);
	}
	isEnterpriseServerSideConnector(configId) {
		const entry = this.getMarketplaceEntryById(configId);
		if (!entry || this.resolveActiveAuthMode(entry) !== "server-side") return false;
		return Boolean(this.resolveActiveEnterpriseVariant(entry) || this.isEnterpriseManagedOneidConnector(entry));
	}
	/**
	* 公网 marketplace server-side connector（如 GitHub）的授权发起编排。
	*
	* 这类 connector 的 access_token 由云端 `/v2/as/connector/oauth/{name}` 托管，端侧不持有
	* refresh_token（与企业 IOA 域名的 server-side 不同：后者由 mcpProxy 内 `ioaAuth` 处理）。
	* 重构前授权发起在 renderer；统一以 daemon 为准后，由本方法在 connect 主流程中接管：
	*   POST /start → 拿 authorize_url → openExternal → 后台 poll /status → tryFetchToken 注入
	*   header → refreshAndSync 触发重连（进而发 WB_CONNECTOR_STATE_CHANGE 刷新 UI）。
	*
	* @returns
	*   - `handled: true` —— 已发起交互式授权（浏览器已开，后台 poll 中）；connect 应据此返回
	*     needsAuth/unauthorized，不再走注定失败的 `mcpProxy.connect`。
	*   - `handled: false` —— 不适用（silent / 已连接 / 端点 404）或已同步拿到 token，主流程继续。
	*/
	async startPublicServerSideAuth(configId, silent, signal) {
		if (this.isEnterpriseServerSideConnector(configId) || !this.serverSideOauthRefresher) return { handled: false };
		if (silent || signal.aborted) return { handled: false };
		const oauthName = this.resolveOauthName(configId);
		try {
			const apiDeps = {
				productManager: this.productManager,
				authenticationManager: this.authenticationManager,
				fetch: this.hostCapabilities.fetch
			};
			const tokenResult = await this.serverSideOauthRefresher.tryFetchToken(oauthName);
			if (tokenResult.ok) {
				const updateResult = await this.updateHeaders(configId, this.resolveTokenHeaders(configId, oauthName, tokenResult.token), true);
				if (!updateResult.success) {
					this.logger.warn(`[ConnectorService] startPublicServerSideAuth(${configId}): updateHeaders failed: ${updateResult.error}`);
					return { handled: false };
				}
				if (!this.serverSideOauthRefresher.isScheduled(configId)) this.serverSideOauthRefresher.schedule(configId, oauthName, {
					initialAccessToken: tokenResult.token,
					initialExpiresIn: tokenResult.expiresIn
				});
				this.logger.info(`[ConnectorService] startPublicServerSideAuth(${configId}): token valid, header injected, proceeding to direct connect`);
				return { handled: false };
			}
			if (!tokenResult.needsAuthorize) {
				this.logger.warn(`[ConnectorService] startPublicServerSideAuth(${configId}): token fetch transient error, falling back: ${tokenResult.error}`);
				return { handled: false };
			}
			const startResp = await require_tar$1.callConnectorOauthApi("POST", `/v2/as/connector/oauth/${oauthName}/start`, apiDeps);
			if (startResp?.code === 404 || String(startResp?.msg ?? "").includes("connector not found")) {
				this.logger.warn(`[ConnectorService] startPublicServerSideAuth(${configId}): server-side unavailable (code=${startResp?.code}), falling back`);
				return { handled: false };
			}
			if (startResp?.code !== 0) {
				this.logger.warn(`[ConnectorService] startPublicServerSideAuth(${configId}): /start failed code=${startResp?.code} msg=${startResp?.msg ?? ""}`);
				return { handled: false };
			}
			const data = startResp.data ?? {};
			const nextAction = data.next_action ?? data.nextAction;
			if (nextAction === "connected") {
				this.logger.info(`[ConnectorService] startPublicServerSideAuth(${configId}): /start returned connected, scheduling refresh`);
				this.updateState(configId, "unauthorized");
				this.serverSideOauthRefresher.schedule(configId, oauthName);
				return { handled: true };
			}
			const authorizeUrl = data.authorize_url ?? data.authorizeUrl;
			if (nextAction !== "redirect" || typeof authorizeUrl !== "string" || authorizeUrl.length === 0) {
				this.logger.warn(`[ConnectorService] startPublicServerSideAuth(${configId}): unexpected next_action=${nextAction}`);
				return { handled: false };
			}
			this.updateState(configId, "unauthorized");
			await this.hostCapabilities.openExternal(authorizeUrl);
			const pollAbortController = new AbortController();
			this.pendingServerSideAuthAborts.set(configId, pollAbortController);
			const forwardAbort = () => pollAbortController.abort();
			if (signal.aborted) pollAbortController.abort();
			else signal.addEventListener("abort", forwardAbort, { once: true });
			this.pollPublicServerSideAuth(configId, oauthName, apiDeps, pollAbortController.signal).catch((err) => {
				this.logger.warn(`[ConnectorService] startPublicServerSideAuth(${configId}): background poll failed:`, err);
			}).finally(() => {
				signal.removeEventListener("abort", forwardAbort);
				if (this.pendingServerSideAuthAborts.get(configId) === pollAbortController) this.pendingServerSideAuthAborts.delete(configId);
			});
			return { handled: true };
		} catch (error) {
			this.logger.warn(`[ConnectorService] startPublicServerSideAuth(${configId}) threw:`, error);
			return { handled: false };
		}
	}
	/**
	* 后台轮询 `/v2/as/.../status` 直到 authorized，然后交给 refresher 拉 token + 注入 header。
	* schedule 立即拉一次 token 并 updateHeaders(skipReconnect)；refresher 的 success 回调检测到
	* 该 connector 仍是 unauthorized/error（connect 已置为 unauthorized）时会自动 refreshAndSync
	* 重连，重连成功再发 WB_CONNECTOR_STATE_CHANGE 刷新 UI。
	*/
	async pollPublicServerSideAuth(configId, oauthName, apiDeps, signal) {
		const deadline = Date.now() + PUBLIC_SERVER_SIDE_AUTH_TIMEOUT_MS;
		while (Date.now() < deadline) {
			if (signal.aborted) {
				this.updateState(configId, "disconnected");
				return;
			}
			await this.sleep(PUBLIC_SERVER_SIDE_AUTH_POLL_INTERVAL_MS, signal);
			if (signal.aborted) {
				this.updateState(configId, "disconnected");
				return;
			}
			let statusResp;
			try {
				statusResp = await require_tar$1.callConnectorOauthApi("GET", `/v2/as/connector/oauth/${oauthName}/status`, apiDeps);
			} catch (err) {
				this.logger.warn(`[ConnectorService] pollPublicServerSideAuth(${configId}): status threw:`, err);
				continue;
			}
			const status = statusResp?.data?.status ?? statusResp?.status;
			if (status === "authorized" || status === "connected") {
				this.logger.info(`[ConnectorService] pollPublicServerSideAuth(${configId}): authorized, scheduling token refresh`);
				this.serverSideOauthRefresher?.schedule(configId, oauthName);
				return;
			}
			if (status === "expired") {
				this.logger.warn(`[ConnectorService] pollPublicServerSideAuth(${configId}): auth expired`);
				this.updateState(configId, "unauthorized", "Authorization expired");
				return;
			}
		}
		this.logger.warn(`[ConnectorService] pollPublicServerSideAuth(${configId}): auth polling timed out`);
		this.updateState(configId, "unauthorized", "Authorization timed out");
	}
	sleep(ms, signal) {
		return new Promise((resolve) => {
			if (signal?.aborted) {
				resolve();
				return;
			}
			const onAbort = () => {
				clearTimeout(timer);
				resolve();
			};
			const timer = setTimeout(() => {
				signal?.removeEventListener("abort", onAbort);
				resolve();
			}, ms);
			signal?.addEventListener("abort", onAbort, { once: true });
		});
	}
	isExternallyManagedConnector(configId) {
		if (this.isEnterpriseServerSideConnector(configId)) return false;
		if (configId === "tencent-docs" && this.getCurrentEnterpriseId()) return false;
		const entry = this.getMarketplaceEntryById(configId);
		if (!entry || this.resolveActiveAuthMode(entry) === "gateway") return false;
		const headers = this.persistentState.headerOverrides[configId];
		if (headers) {
			const oneidToken = headers["X-Oneid-Access-Token"] ?? headers["x-oneid-access-token"];
			if (typeof oneidToken === "string" && oneidToken.length > 0 && !!this.getCurrentEnterpriseId()) return false;
		}
		const serverConfig = this.getLatestServerConfigForConnector(configId);
		if (!serverConfig?.url) return false;
		try {
			const host = new URL(serverConfig.url).host;
			return require_tar$1.EXTERNALLY_MANAGED_HOSTS.has(host) && EXTERNALLY_MANAGED_TOKEN_REFRESH_HOSTS.has(host);
		} catch {
			return false;
		}
	}
	getLatestServerConfigForConnector(configId) {
		const mcpConfig = this.readConnectorMcpConfig(configId);
		if (!mcpConfig) return;
		const mergedConfig = this.buildRuntimeMcpConfig(configId, mcpConfig);
		const firstServerName = Object.keys(mergedConfig.mcpServers)[0];
		return firstServerName ? mergedConfig.mcpServers[firstServerName] : void 0;
	}
	rebuildAuthInjectionRuleCache() {
		const rules = (this.readLocalManifest()?.auth_injection_rules ?? []).map((rule) => this.normalizeAuthInjectionRule(rule)).filter((rule) => Boolean(rule));
		const byConnector = /* @__PURE__ */ new Map();
		for (const rule of rules) for (const connectorId of rule.appliesToConnectors) {
			const list = byConnector.get(connectorId) ?? [];
			list.push(rule);
			byConnector.set(connectorId, list);
		}
		this.authInjectionRuleCache = {
			rules,
			byConnector
		};
		this.logger.info(`${AUTH_INJECTION_LOG_PREFIX} cache rebuilt rules=${rules.length} connectors=[${[...byConnector.keys()].join(",")}] ruleIds=[${rules.map((rule) => rule.id).join(",")}]`);
	}
	normalizeAuthInjectionRule(rule) {
		if (!rule || typeof rule.id !== "string" || rule.id.trim().length === 0) return;
		if (rule.timing && rule.timing !== "request") return;
		const appliesToConnectors = this.normalizeStringList(rule.applies_to_connectors);
		const inject = (Array.isArray(rule.inject) ? rule.inject : []).map((item) => this.normalizeAuthInjectionItem(item)).filter((item) => Boolean(item));
		if (appliesToConnectors.length === 0 || inject.length === 0) return;
		return {
			id: rule.id.trim(),
			activeIn: this.normalizeStringList(rule.when?.active_in),
			appliesToConnectors,
			requiresConnectedConnectors: this.normalizeStringList(rule.requires_connected_connectors),
			inject
		};
	}
	normalizeAuthInjectionItem(item) {
		if (!item || typeof item.from_connector !== "string" || item.from_connector.trim().length === 0) return;
		if (item.token_type !== "mcp-oauth" && item.token_type !== "oneid-token") return;
		if (typeof item.header !== "string" || item.header.trim().length === 0) return;
		const fromConnector = item.from_connector.trim();
		const entry = this.getMarketplaceEntryById(fromConnector);
		return {
			...item,
			from_connector: fromConnector,
			header: item.header.trim(),
			value_template: item.value_template || "${access_token}",
			serverConfig: item.token_type === "mcp-oauth" ? this.getLatestServerConfigForConnector(fromConnector) : void 0,
			oauthName: item.token_type === "oneid-token" ? this.resolveOauthName(fromConnector) : void 0,
			oneidAppType: entry ? this.resolveOneidAppType(entry) : void 0
		};
	}
	normalizeStringList(value) {
		return Array.isArray(value) ? value.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean) : [];
	}
	async resolveRequestAuthInjectionHeaders(configId, sessionId, projectId) {
		const rawConfigId = this.normalizeRuntimeMcpConfigId(configId);
		const headers = {};
		const serverShortName = rawConfigId.startsWith(this.CUSTOM_MCP_PREFIX) ? rawConfigId.slice(this.CUSTOM_MCP_PREFIX.length) : rawConfigId;
		const rules = this.authInjectionRuleCache.byConnector.get(rawConfigId) ?? [];
		if (rules.length > 0) {
			const conditionKeys = this.getCurrentAuthInjectionConditionKeys();
			for (const rule of rules) {
				const match = this.getAuthInjectionRuleMatchResult(rule, conditionKeys);
				if (!match.matched) {
					this.logAuthInjectionRuleSkipped(rawConfigId, rule, match.reason, conditionKeys);
					continue;
				}
				if (this.shouldLogAuthInjectionInfo(`${rawConfigId}|${rule.id}|matched`)) this.logger.info(`${AUTH_INJECTION_LOG_PREFIX} rule matched configId=${rawConfigId} rule=${rule.id} sources=[${rule.inject.map((item) => item.from_connector).join(",")}]`);
				for (const item of rule.inject) {
					const token = await this.resolveAuthInjectionAccessToken(item);
					if (!token) {
						this.logger.warn(`${AUTH_INJECTION_LOG_PREFIX} token missing configId=${rawConfigId} rule=${rule.id} from=${item.from_connector} type=${item.token_type} header=${item.header}`);
						continue;
					}
					headers[item.header] = item.value_template.replace(/\$\{access_token\}/g, token);
				}
			}
			if (Object.keys(headers).length > 0 && this.shouldLogAuthInjectionInfo(`${rawConfigId}|resolved`)) this.logger.info(`${AUTH_INJECTION_LOG_PREFIX} resolved configId=${rawConfigId} headers=[${Object.keys(headers).join(",")}]`);
		}
		const poiHeaders = await this.resolvePoiHeaderForServer(rawConfigId, sessionId, serverShortName);
		Object.assign(headers, poiHeaders);
		if (serverShortName === "netdrive" && projectId) headers[NETDRIVE_HEADER_PROJECT_ID] = projectId;
		return headers;
	}
	/**
	* 推送/清除 session POI 缓存（供 session RPC handler 调用）。
	* `poi = null` 时清除该 session 的缓存。
	*/
	setSessionPoi(sessionId, poi) {
		this.logger.info(`[POI] setSessionPoi sessionId=${sessionId} poi=${poi === null ? "null" : `lat=${poi.lat} lng=${poi.lng} source=${poi.source}`}`);
		if (poi === null) this.sessionPoiCache.delete(sessionId);
		else this.sessionPoiCache.set(sessionId, poi);
	}
	/** 清除 session POI 缓存（session 关闭时调用）。 */
	clearSessionPoi(sessionId) {
		this.sessionPoiCache.delete(sessionId);
	}
	/**
	* 回传用户 POI 授权决策（供 connector RPC handler 调用）。
	*/
	resolvePoiConsent(mcpServerName, result) {
		this.poiConsentStore.set(mcpServerName, result);
		return this.poiConsentRegistry.answer(mcpServerName, result);
	}
	/**
	* 调用已连接 connector 的 MCP 工具（供 connector:callTool RPC handler 调用）。
	*
	* 用于 renderer 侧轻量查询（如 link-paste resolve 获取文档标题），
	* 不经过 ACP 会话 / 模型 tool_use 流程。
	*/
	async callTool(toolName, args) {
		const cnbRestResult = await this.tryCnbRestApiFallback(toolName, args);
		if (cnbRestResult !== void 0) return cnbRestResult;
		const desiredConfigs = this.buildDesiredConfigs();
		const matchingConfigIds = [...this.runtimeMcpInspections.entries()].filter(([, inspection]) => inspection.tools.some((tool) => tool.name === toolName)).map(([configId]) => configId);
		const inferredRoutes = matchingConfigIds.length === 0 ? inferConnectorToolRoutes(toolName, desiredConfigs) : [];
		if (matchingConfigIds.length === 0 && inferredRoutes.length === 0) {
			const availableTools = [...new Set([...this.runtimeMcpInspections.values()].flatMap((inspection) => inspection.tools.map((tool) => tool.name)))].slice(0, 50);
			throw new Error(`Tool "${toolName}" not found. Available tools (first 50): [${availableTools.join(", ")}]`);
		}
		if (matchingConfigIds.length > 1) throw new Error(`Tool "${toolName}" is ambiguous across MCP servers: [${matchingConfigIds.join(", ")}]`);
		if (inferredRoutes.length > 1) throw new Error(`Tool "${toolName}" is ambiguous across MCP servers: [${inferredRoutes.map((route) => route.configId).join(", ")}]`);
		const inferredRoute = inferredRoutes[0];
		const configId = inferredRoute?.configId ?? matchingConfigIds[0];
		const serverConfig = desiredConfigs[configId];
		if (!serverConfig || typeof serverConfig.url !== "string" || serverConfig.command) throw new Error(`Tool "${toolName}" is not available through a remote MCP server`);
		const opened = await this.remoteMcpClient.openRemote(configId, {
			...serverConfig,
			url: serverConfig.url
		}, { silent: true });
		try {
			const client = opened.client;
			let remoteToolName = toolName;
			if (inferredRoute) {
				const tools = (await client.listTools()).tools ?? [];
				this.runtimeMcpInspections.set(configId, {
					...this.runtimeMcpInspections.get(configId),
					tools
				});
				const listedNames = new Set(tools.map((tool) => tool.name));
				remoteToolName = listedNames.has(toolName) ? toolName : listedNames.has(inferredRoute.remoteToolName) ? inferredRoute.remoteToolName : "";
				if (!remoteToolName) throw new Error(`Tool "${toolName}" was routed to "${configId}", but neither "${toolName}" nor "${inferredRoute.remoteToolName}" is exposed by the remote MCP server`);
			}
			return await client.callTool({
				name: remoteToolName,
				arguments: args
			});
		} finally {
			await opened.close();
		}
	}
	static {
		this.CNB_TOOL_PATTERN = /^(cnb|cnb-woa)[_](proxy_execute_tool|get[-_]issue|get[-_]pull|get[-_]build[-_]status)$/;
	}
	static {
		this.CNB_PARAM_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/;
	}
	static {
		this.CNB_API_ENDPOINTS = {
			"cnb": "https://api.cnb.cool",
			"cnb-woa": "https://cnb.woa.com"
		};
	}
	/**
	* CNB CLI fallback：CNB 是纯 CLI 连接器（无 MCP 工具），
	* 直接通过 `cnb` CLI 命令获取 issue/pull 详情。
	* 返回 undefined 表示不匹配（应继续走 MCP proxy）；返回值表示已处理。
	*/
	async tryCnbRestApiFallback(toolName, args) {
		const match = _ConnectorService.CNB_TOOL_PATTERN.exec(toolName);
		if (!match) return;
		const connectorId = match[1];
		const toolSuffix = match[2];
		let actualTool;
		let actualArgs;
		if (toolSuffix === "proxy_execute_tool") {
			actualTool = args.tool_name;
			actualArgs = args.tool_args ?? {};
		} else {
			actualTool = toolSuffix.replace(/_/g, "-");
			actualArgs = args;
		}
		const repo = actualArgs.repo;
		if (!repo) throw new Error("[CNB CLI] Missing required param: repo");
		if (!_ConnectorService.CNB_PARAM_PATTERN.test(repo)) throw new Error(`[CNB CLI] Invalid repo format: ${repo.slice(0, 50)}`);
		let cliModule;
		let cliCommand;
		let extraValue;
		let extraFlag;
		if (actualTool === "get-issue") {
			cliModule = "issues";
			cliCommand = "get-issue";
			const number = actualArgs.number;
			if (!number) throw new Error("[CNB CLI] Missing required param: number");
			const numStr = String(number);
			if (!_ConnectorService.CNB_PARAM_PATTERN.test(numStr)) throw new Error(`[CNB CLI] Invalid number format: ${numStr.slice(0, 20)}`);
			extraFlag = "--number";
			extraValue = numStr;
		} else if (actualTool === "get-pull") {
			cliModule = "pulls";
			cliCommand = "get-pull";
			const number = actualArgs.number;
			if (!number) throw new Error("[CNB CLI] Missing required param: number");
			const numStr = String(number);
			if (!_ConnectorService.CNB_PARAM_PATTERN.test(numStr)) throw new Error(`[CNB CLI] Invalid number format: ${numStr.slice(0, 20)}`);
			extraFlag = "--number";
			extraValue = numStr;
		} else if (actualTool === "get-build-status") {
			cliModule = "build";
			cliCommand = "get-build-status";
			const sn = actualArgs.sn;
			if (!sn) throw new Error("[CNB CLI] Missing required param: sn");
			if (!_ConnectorService.CNB_PARAM_PATTERN.test(sn)) throw new Error(`[CNB CLI] Invalid sn format: ${sn.slice(0, 20)}`);
			extraFlag = "--sn";
			extraValue = sn;
		} else return;
		const apiEndpoint = _ConnectorService.CNB_API_ENDPOINTS[connectorId];
		const env = { ...process.env };
		stripDebugNodeOptions(env);
		if (apiEndpoint) env.CNB_API_ENDPOINT = apiEndpoint;
		const pkgsBin = (0, path.join)(CLI_CONNECTOR_PACKAGES_DIR, "bin");
		const cnbPath = (0, path.join)(pkgsBin, "cnb");
		const originalPath = env.PATH || "";
		env.PATH = `${pkgsBin}${path.delimiter}${originalPath}`;
		const execArgs = [
			cliModule,
			cliCommand,
			"--repo",
			repo,
			"--verbose"
		];
		if (extraFlag && extraValue !== void 0) execArgs.push(extraFlag, extraValue);
		this.logger.debug(`[ConnectorService] CNB CLI fallback: ${toolName} → cnb ${execArgs.join(" ")} (CNB_API_ENDPOINT=${apiEndpoint} pkgsBin=${pkgsBin} processExecPath=${process.execPath} PATH=${(env.PATH || "").slice(0, 300)})`);
		const execFilePromise = (0, util.promisify)(child_process.execFile);
		try {
			const { stdout } = await execFilePromise(process.execPath, [cnbPath, ...execArgs], {
				timeout: 15e3,
				env: {
					...env,
					ELECTRON_RUN_AS_NODE: "1"
				}
			});
			return {
				content: [{
					type: "text",
					text: stdout.trim()
				}],
				isError: false
			};
		} catch (error) {
			const stderr = error.stderr || error.message || "";
			const exitCode = error.code ?? "unknown";
			const signal = error.signal ?? "none";
			const stdoutSnippet = typeof error.stdout === "string" ? error.stdout.slice(0, 200) : "none";
			this.logger.error(`[ConnectorService] CNB CLI fallback failed: toolName=${toolName} cliCommand=${cliCommand} repo=${repo} CNB_API_ENDPOINT=${apiEndpoint} exitCode=${exitCode} signal=${signal} pkgsBin=${pkgsBin} cnbPath=${cnbPath} processExecPath=${process.execPath} originalPath=${originalPath.slice(0, 300)} stdout=${stdoutSnippet} stderr=${stderr.slice(0, 500)}`);
			throw new Error(`[CNB CLI] ${cliCommand} failed: ${stderr.slice(0, 200)}`);
		}
	}
	/**
	* 注入 POI 授权事件推送回调（bootstrap 时调用）。
	*/
	setPoiConsentEventPusher(pusher) {
		this.poiConsentEventPusher = pusher;
	}
	/**
	* 为指定 MCP server 解析 POI header。
	*
	* fail-closed：任何异常路径返回 `{}`，不阻断工具调用。
	*/
	async resolvePoiHeaderForServer(configId, sessionId, serverShortName) {
		try {
			if (!sessionId) {
				this.logger.info(`[POI] skip configId=${configId}: no sessionId`);
				return {};
			}
			if (!((this.productManager?.getCurrentConfiguration?.()?.productFeatures)?.PoiMap === true)) {
				this.logger.info(`[POI] skip configId=${configId}: PoiMap disabled`);
				return {};
			}
			if (!this.isServerNeedsInjectPOI(configId, serverShortName)) {
				this.logger.info(`[POI] skip configId=${configId} serverShortName=${serverShortName ?? "(none)"}: needsInjectPOI=false`);
				return {};
			}
			const poi = this.sessionPoiCache.get(sessionId);
			if (!poi) {
				this.logger.info(`[POI] skip configId=${configId} sessionId=${sessionId}: sessionPoiCache miss`);
				return {};
			}
			const consent = this.poiConsentStore.get(configId);
			if (consent === "granted") {
				this.logger.info(`[POI] inject configId=${configId} sessionId=${sessionId}: consent=granted, injecting header`);
				return buildPoiHeader(poi);
			}
			this.logger.info(`[POI] await consent configId=${configId} sessionId=${sessionId}: consent=${consent ?? "none"}, pushing event`);
			const { promise: consentPromise, isFirst } = this.poiConsentRegistry.waitWithFirst(configId, POI_CONSENT_DEFAULT_TIMEOUT_MS);
			if (isFirst && this.poiConsentEventPusher) this.poiConsentEventPusher({
				mcpServerName: configId,
				sessionId
			});
			const decision = await consentPromise;
			this.logger.info(`[POI] consent result configId=${configId} sessionId=${sessionId}: decision=${decision}`);
			this.poiConsentStore.set(configId, decision);
			if (decision === "denied") return {};
			return buildPoiHeader(poi);
		} catch (err) {
			this.logger.warn(`[POI] resolvePoiHeaderForServer error configId=${configId} sessionId=${sessionId}:`, err);
			return {};
		}
	}
	/**
	* 检查 configId 对应的 MCP server 是否声明了 `needsInjectPOI: true`。
	* 提供 serverShortName 时仅检查指定条目；未提供时回退遍历该 connector 的全部 mcpServers。
	*
	* 对 custom-mcp: 前缀的 configId，从 readCustomMcpConfig() 读取用户 mcp.json；
	* 其余走 readConnectorMcpConfig（marketplace connector）。
	*/
	isServerNeedsInjectPOI(configId, serverShortName) {
		if (configId.startsWith(this.CUSTOM_MCP_PREFIX)) {
			const customConfig = this.readCustomMcpConfig();
			if (!customConfig?.mcpServers) {
				this.logger.info(`[POI] isServerNeedsInjectPOI configId=${configId} serverShortName=${serverShortName ?? "(none)"}: customMcp path, result=false (no mcpServers)`);
				return false;
			}
			if (serverShortName) {
				const entry = customConfig.mcpServers[serverShortName];
				const result = typeof entry === "object" && entry !== null && entry.needsInjectPOI === true;
				this.logger.info(`[POI] isServerNeedsInjectPOI configId=${configId} serverShortName=${serverShortName}: customMcp path, result=${result}`);
				return result;
			}
			for (const entry of Object.values(customConfig.mcpServers)) if (typeof entry === "object" && entry !== null && entry.needsInjectPOI === true) {
				this.logger.info(`[POI] isServerNeedsInjectPOI configId=${configId} serverShortName=(none): customMcp path, result=true`);
				return true;
			}
			this.logger.info(`[POI] isServerNeedsInjectPOI configId=${configId} serverShortName=(none): customMcp path, result=false (no entry with needsInjectPOI)`);
			return false;
		}
		const mcpConfig = this.readConnectorMcpConfig(configId);
		if (!mcpConfig) {
			this.logger.info(`[POI] isServerNeedsInjectPOI configId=${configId} serverShortName=${serverShortName ?? "(none)"}: connectorMcp path, result=false (no mcpConfig)`);
			return false;
		}
		if (serverShortName) {
			const result = mcpConfig.mcpServers[serverShortName]?.needsInjectPOI === true;
			this.logger.info(`[POI] isServerNeedsInjectPOI configId=${configId} serverShortName=${serverShortName}: connectorMcp path, result=${result}`);
			return result;
		}
		for (const serverConfig of Object.values(mcpConfig.mcpServers)) if (serverConfig.needsInjectPOI === true) {
			this.logger.info(`[POI] isServerNeedsInjectPOI configId=${configId} serverShortName=(none): connectorMcp path, result=true`);
			return true;
		}
		this.logger.info(`[POI] isServerNeedsInjectPOI configId=${configId} serverShortName=(none): connectorMcp path, result=false`);
		return false;
	}
	getAuthInjectionRuleMatchResult(rule, conditionKeys) {
		if (rule.activeIn.length > 0 && !rule.activeIn.some((key) => conditionKeys.has(key))) return {
			matched: false,
			reason: "active_in_miss"
		};
		const missing = rule.requiresConnectedConnectors.filter((connectorId) => !this.isConnectorConnected(connectorId));
		if (missing.length > 0) return {
			matched: false,
			reason: `missing_connected:${missing.join(",")}`
		};
		return {
			matched: true,
			reason: "matched"
		};
	}
	logAuthInjectionRuleSkipped(configId, rule, reason, conditionKeys) {
		const key = `${configId}|${rule.id}|${reason}`;
		const now = Date.now();
		if (now - (this.authInjectionSkipLogThrottle.get(key) ?? 0) < AUTH_INJECTION_SKIP_LOG_THROTTLE_MS) return;
		this.authInjectionSkipLogThrottle.set(key, now);
		this.logger.info(`${AUTH_INJECTION_LOG_PREFIX} rule skipped configId=${configId} rule=${rule.id} reason=${reason} conditionKeys=[${[...conditionKeys].join(",")}] requiresConnected=[${rule.requiresConnectedConnectors.join(",")}]`);
	}
	shouldLogAuthInjectionInfo(key) {
		const now = Date.now();
		if (now - (this.authInjectionSkipLogThrottle.get(key) ?? 0) < AUTH_INJECTION_SKIP_LOG_THROTTLE_MS) return false;
		this.authInjectionSkipLogThrottle.set(key, now);
		return true;
	}
	isConnectorConnected(connectorId) {
		const rawConfigId = this.normalizeRuntimeMcpConfigId(connectorId);
		if (!this.isEnabled(rawConfigId)) return false;
		return this.states.get(rawConfigId)?.status === "connected";
	}
	getCurrentAuthInjectionConditionKeys() {
		const context = this.getConnectorAccountContext();
		const keys = /* @__PURE__ */ new Set();
		if (this.isInternalUser()) keys.add("iOA");
		if (context.accountType) keys.add(`plan:${context.accountType}`);
		const product = this.productManager?.getCurrentConfiguration?.();
		if (typeof product?.networkEnvironment === "string" && product.networkEnvironment.length > 0) keys.add(product.networkEnvironment);
		return keys;
	}
	async resolveAuthInjectionAccessToken(item) {
		if (item.token_type === "oneid-token") return this.fetchOneidAccessTokenForRequest(item);
		return this.peekMcpOAuthAccessTokenForRequest(item);
	}
	async fetchOneidAccessTokenForRequest(item) {
		const existingToken = this.peekOneidHeaderOverride(item.from_connector);
		if (existingToken) return existingToken;
		if (!this.serverSideOauthRefresher || !this.getCurrentEnterpriseId()) return;
		if (item.oneidAppType && !await this.isOneidAppEnabledByType(item.oneidAppType)) return;
		const oauthName = item.oauthName ?? item.from_connector;
		const tokenResult = await this.serverSideOauthRefresher.tryFetchToken(oauthName);
		if (!tokenResult.ok) this.logger.warn(`${AUTH_INJECTION_LOG_PREFIX} oneid token fetch failed configId=${item.from_connector} oauthName=${oauthName} error=${tokenResult.error}`);
		return tokenResult.ok ? tokenResult.token : void 0;
	}
	peekOneidHeaderOverride(configId) {
		const headers = this.persistentState.headerOverrides[this.normalizeRuntimeMcpConfigId(configId)];
		const token = headers?.["X-Oneid-Access-Token"] ?? headers?.["x-oneid-access-token"];
		return typeof token === "string" && token.trim().length > 0 ? token.trim() : void 0;
	}
	peekMcpOAuthAccessTokenForRequest(item) {
		if (!item.serverConfig?.url) return;
		return new require_tar$1.ConnectorOAuthStore(this.getUserId()).peekTokens(require_tar$1.toRuntimeMcpConfigId(item.from_connector), item.serverConfig.url, item.serverConfig.headers)?.access_token;
	}
	async applyEnterpriseTokenToActiveConnection(configId) {
		if (!this.isEnterpriseServerSideConnector(configId) || !this.isEnabled(configId)) return;
		if (this.states.get(configId)?.status === "connecting") {
			this.logger.info(`[ConnectorService] enterprise token apply skipped for ${configId}: inspection is in progress`);
			return;
		}
		const latestServerConfig = this.getLatestServerConfigForConnector(configId);
		if (!latestServerConfig) return;
		const connectResult = await this.inspectRemoteMcp(require_tar$1.toRuntimeMcpConfigId(configId), latestServerConfig, true, false);
		if (!connectResult.success) {
			const status = connectResult.needsAuth ? "unauthorized" : "error";
			this.updateState(configId, status, connectResult.error);
			this.logger.warn(`[ConnectorService] enterprise token applied reconnect failed for ${configId}: ${connectResult.error}`);
			return;
		}
		this.updateState(configId, "connected");
		this.notifyRuntimeMcpServerConfigsChanged({ credentialsChanged: true });
	}
	async refreshExternalAuthBeforeReconnect(runtimeConfigId) {
		const configId = this.normalizeRuntimeMcpConfigId(runtimeConfigId);
		if (this.isEnterpriseServerSideConnector(configId)) {
			const syncResult = await this.syncEnterpriseConnectorTokenBeforeConnect(configId);
			if (!syncResult.success) return {
				ok: false,
				kind: syncResult.needsAuthorize ? "auth" : "transient",
				error: syncResult.error
			};
			const serverConfig = this.getLatestServerConfigForConnector(configId);
			return serverConfig ? {
				ok: true,
				serverConfig
			} : { ok: true };
		}
		if (this.isExternallyManagedConnector(configId)) {
			const syncResult = await this.syncExternallyManagedConnectorTokenBeforeConnect(configId);
			if (!syncResult.success) return {
				ok: false,
				kind: syncResult.needsAuthorize ? "auth" : "transient",
				error: syncResult.error
			};
			if (this.isExternallyManagedStaleTokenGuardActive(configId, syncResult.tokenFingerprint)) {
				const error = this.getExternallyManagedStaleTokenError(configId);
				this.updateState(configId, "unauthorized", error);
				return {
					ok: false,
					kind: "auth",
					error
				};
			}
			const serverConfig = this.getLatestServerConfigForConnector(configId);
			return serverConfig ? {
				ok: true,
				serverConfig
			} : { ok: true };
		}
		const ioaRefresh = await this.refreshIoaServerSideAuthBeforeReconnect(runtimeConfigId);
		if (ioaRefresh) return ioaRefresh;
		return { ok: true };
	}
	/**
	* 为 IOA 域名的 MCP descriptor 静默续一张服务端 token。
	*
	* 返回 `undefined` 表示「不是 IOA 托管的 descriptor」，调用方继续走原有语义；
	* 命中时把新 Bearer 同时写回加密 headerOverrides（供下一轮 buildDesiredConfigs）
	* 和返回值（供本次 401 重试立即使用）。
	*/
	async refreshIoaServerSideAuthBeforeReconnect(runtimeConfigId) {
		if (!this.ioaAuth) return;
		const serverConfig = this.resolveServerConfigForRuntimeMcp(runtimeConfigId);
		if (!serverConfig || !this.ioaAuth.resolveHostRule(serverConfig)) return;
		let result;
		try {
			result = await this.ioaAuth.resolveToken(serverConfig, { interactive: false });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.warn(`[ConnectorService] refreshIoaServerSideAuth(${runtimeConfigId}): ${message}`);
			return {
				ok: false,
				kind: "transient",
				error: message
			};
		}
		if (!result) return;
		if (!result.success || !result.accessToken || !result.rule) {
			const error = result.error || `IOA server-side token unavailable for ${runtimeConfigId}`;
			return {
				ok: false,
				kind: result.needsAuthorize ? "auth" : "transient",
				error
			};
		}
		const decorated = this.ioaAuth.decorateConfig(serverConfig, result.rule, result.accessToken);
		await this.persistIoaServerSideAuthHeaders(runtimeConfigId, decorated);
		this.logger.info(`[ConnectorService] refreshIoaServerSideAuth(${runtimeConfigId}): renewed server-side token (oauthName=${result.rule.oauthName})`);
		return {
			ok: true,
			serverConfig: decorated
		};
	}
	/**
	* 按 runtime configId 取当前生效的单条 server config。
	*
	* `custom-mcp:` 走用户 mcp.json 决议，其余走 marketplace connector 决议——
	* 两条 lane 的 IOA descriptor 都要能续票。
	*/
	resolveServerConfigForRuntimeMcp(runtimeConfigId) {
		if (runtimeConfigId.startsWith(this.CUSTOM_MCP_PREFIX)) {
			const customConfig = this.readCustomMcpConfigForConnect(runtimeConfigId);
			const serverName = customConfig ? Object.keys(customConfig.mcpServers)[0] : void 0;
			return serverName ? customConfig?.mcpServers[serverName] : void 0;
		}
		return this.getLatestServerConfigForConnector(this.normalizeRuntimeMcpConfigId(runtimeConfigId));
	}
	clearExternallyManagedTokenRetryState(configId) {
		if (configId) {
			const rawConfigId = this.normalizeRuntimeMcpConfigId(configId);
			const timer = this.externallyManagedTokenRetryTimers.get(rawConfigId);
			if (timer) {
				clearTimeout(timer);
				this.externallyManagedTokenRetryTimers.delete(rawConfigId);
			}
			this.externallyManagedTokenRetryAttempts.delete(rawConfigId);
			return;
		}
		for (const timer of this.externallyManagedTokenRetryTimers.values()) clearTimeout(timer);
		this.externallyManagedTokenRetryTimers.clear();
		this.externallyManagedTokenRetryAttempts.clear();
	}
	hashTokenFingerprint(headerValue) {
		return crypto.createHash("sha256").update(headerValue).digest("hex").slice(0, 12);
	}
	getAuthorizationFingerprint(configId) {
		const rawConfigId = this.normalizeRuntimeMcpConfigId(configId);
		const headers = this.persistentState.headerOverrides[rawConfigId];
		const authorization = headers?.Authorization ?? headers?.authorization;
		if (typeof authorization !== "string" || authorization.length === 0) return;
		return this.hashTokenFingerprint(authorization);
	}
	isExternallyManagedStaleTokenGuardActive(configId, tokenFingerprint) {
		if (!tokenFingerprint) return false;
		const rawConfigId = this.normalizeRuntimeMcpConfigId(configId);
		const guard = this.externallyManagedStaleTokenGuard.get(rawConfigId);
		if (!guard) return false;
		if (Date.now() - guard.failedAt >= EXTERNALLY_MANAGED_STALE_TOKEN_GUARD_TTL_MS) {
			this.externallyManagedStaleTokenGuard.delete(rawConfigId);
			return false;
		}
		return guard.tokenFingerprint === tokenFingerprint;
	}
	markExternallyManagedStaleToken(configId, tokenFingerprint) {
		if (!tokenFingerprint) return;
		const rawConfigId = this.normalizeRuntimeMcpConfigId(configId);
		this.externallyManagedStaleTokenGuard.set(rawConfigId, {
			tokenFingerprint,
			failedAt: Date.now()
		});
	}
	clearExternallyManagedStaleTokenGuard(configId) {
		if (configId) {
			this.externallyManagedStaleTokenGuard.delete(this.normalizeRuntimeMcpConfigId(configId));
			return;
		}
		this.externallyManagedStaleTokenGuard.clear();
	}
	isInvalidExternallyManagedTokenReason(reason) {
		if (!reason) return false;
		return /\binvalid_token\b/i.test(reason) || /invalid or expired token/i.test(reason);
	}
	getExternallyManagedStaleTokenError(configId) {
		return `${configId}: token from upstream still stale, waiting for re-authorization`;
	}
	scheduleExternallyManagedTokenRetry(configId, error) {
		const rawConfigId = this.normalizeRuntimeMcpConfigId(configId);
		if (this.externallyManagedTokenRetryTimers.has(rawConfigId)) return;
		if (!this.isEnabled(rawConfigId)) {
			this.clearExternallyManagedTokenRetryState(rawConfigId);
			return;
		}
		const nextAttempt = (this.externallyManagedTokenRetryAttempts.get(rawConfigId) ?? 0) + 1;
		const delayMs = EXTERNALLY_MANAGED_TOKEN_RETRY_DELAYS_MS[nextAttempt - 1];
		if (delayMs === void 0) {
			this.logger.warn(`[ConnectorService] externally-managed token sync retry limit reached for ${rawConfigId}: ${error}`);
			this.clearExternallyManagedTokenRetryState(rawConfigId);
			return;
		}
		this.externallyManagedTokenRetryAttempts.set(rawConfigId, nextAttempt);
		const timer = setTimeout(() => {
			this.externallyManagedTokenRetryTimers.delete(rawConfigId);
			if (!this.isEnabled(rawConfigId)) {
				this.externallyManagedTokenRetryAttempts.delete(rawConfigId);
				return;
			}
			this.refreshAndSync().catch((err) => {
				this.logger.warn(`[ConnectorService] externally-managed token retry refreshAndSync failed for ${rawConfigId}:`, err);
			});
		}, delayMs);
		this.externallyManagedTokenRetryTimers.set(rawConfigId, timer);
	}
	async syncExternallyManagedConnectorTokensBeforeSync() {
		const configIds = this.getEnabledConnectorIds().filter((id) => this.isExternallyManagedConnector(id));
		if (configIds.length === 0) return;
		(await Promise.allSettled(configIds.map((id) => this.syncExternallyManagedConnectorTokenBeforeConnect(id)))).forEach((result, index) => {
			const rawConfigId = this.normalizeRuntimeMcpConfigId(configIds[index]);
			if (result.status === "fulfilled") {
				const syncResult = result.value;
				if (syncResult.success) {
					if (this.isExternallyManagedStaleTokenGuardActive(rawConfigId, syncResult.tokenFingerprint)) {
						const error = this.getExternallyManagedStaleTokenError(rawConfigId);
						this.updateState(rawConfigId, "unauthorized", error);
						this.clearExternallyManagedTokenRetryState(rawConfigId);
						return;
					}
					this.clearExternallyManagedTokenRetryState(rawConfigId);
					return;
				}
				this.logger.warn(`[ConnectorService] externally-managed token sync failed for ${rawConfigId}: ${syncResult.error}`);
				this.updateState(rawConfigId, syncResult.needsAuthorize ? "unauthorized" : "error", syncResult.error);
				if (syncResult.needsAuthorize) {
					this.clearExternallyManagedTokenRetryState(rawConfigId);
					return;
				}
				this.scheduleExternallyManagedTokenRetry(rawConfigId, syncResult.error);
				return;
			}
			const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
			this.logger.warn(`[ConnectorService] externally-managed token sync rejected for ${rawConfigId}: ${message}`);
			this.updateState(rawConfigId, "error", message);
			this.scheduleExternallyManagedTokenRetry(rawConfigId, message);
		});
	}
	async syncExternallyManagedConnectorTokenBeforeConnect(configId) {
		if (!this.isExternallyManagedConnector(configId)) return { success: true };
		const oauthName = this.resolveOauthName(configId);
		const rawConfigId = this.normalizeRuntimeMcpConfigId(configId);
		const useStatusEndpoint = oauthName === "tdocs-app" || rawConfigId === "tencent-docs";
		const tokenOauthName = useStatusEndpoint ? "tdocs-app" : oauthName;
		const tokenApiPath = useStatusEndpoint ? `/v2/as/connector/oauth/${tokenOauthName}/status` : `/v2/as/connector/oauth/${tokenOauthName}/accesstoken`;
		let resp;
		try {
			resp = await this.withExternallyManagedTokenRefreshTimeout(require_tar$1.callConnectorOauthApi("GET", tokenApiPath, {
				productManager: this.productManager,
				authenticationManager: this.authenticationManager,
				fetch: this.hostCapabilities.fetch
			}));
		} catch (error) {
			return {
				success: false,
				needsAuthorize: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
		let headerValue;
		if (useStatusEndpoint) {
			const data = resp?.data;
			const status = typeof data?.status === "string" ? data.status : void 0;
			const mcpToken = data?.extra?.mcp_token;
			if (resp?.code === 0 && status === "connected" && typeof mcpToken === "string" && mcpToken.length > 0) headerValue = mcpToken;
			else if (resp?.code === 0 && status) return {
				success: false,
				needsAuthorize: true,
				error: status === "connected" ? "tdocs-app status=connected missing mcp_token" : `tdocs-app status=${status}`
			};
		} else if (rawConfigId === "ima-mcp") {
			const mcpToken = resp?.data?.mcp_token ?? resp?.data?.mcpToken;
			if (typeof mcpToken === "string" && mcpToken.length > 0) headerValue = mcpToken;
		} else {
			const token = resp?.data?.access_token ?? resp?.data?.token;
			if (typeof token === "string" && token.length > 0) headerValue = token;
		}
		if (resp?.code === 0 && headerValue) {
			const tokenFingerprint = this.hashTokenFingerprint(headerValue);
			const updateResult = await this.updateHeaders(rawConfigId, { Authorization: headerValue }, true);
			if (!updateResult.success) return {
				success: false,
				needsAuthorize: false,
				error: updateResult.error || "updateHeaders failed"
			};
			this.logger.info(`[ConnectorService] externally-managed token sync ok for ${rawConfigId} via ${useStatusEndpoint ? "status" : "accesstoken"} (token.length=${headerValue.length})`);
			return {
				success: true,
				tokenFingerprint
			};
		}
		const code = typeof resp?.code === "number" ? resp.code : -1;
		const msg = resp?.msg ?? "unknown";
		return {
			success: false,
			needsAuthorize: EXTERNALLY_MANAGED_AUTH_FAILURE_CODES.has(code),
			error: `code=${code} msg=${msg}`
		};
	}
	withExternallyManagedTokenRefreshTimeout(promise) {
		return new Promise((resolvePromise, rejectPromise) => {
			const timeoutMessage = `externally managed token refresh timed out after ${EXTERNALLY_MANAGED_TOKEN_REFRESH_TIMEOUT_MS}ms`;
			const timer = setTimeout(() => rejectPromise(new Error(timeoutMessage)), EXTERNALLY_MANAGED_TOKEN_REFRESH_TIMEOUT_MS);
			promise.then((value) => {
				clearTimeout(timer);
				resolvePromise(value);
			}, (error) => {
				clearTimeout(timer);
				rejectPromise(error);
			});
		});
	}
	/** init 时为所有 enabled 里的 server-side OAuth connector 启动刷新任务 */
	startServerSideOauthRefreshForEnabled() {
		if (!this.serverSideOauthRefresher) return;
		for (const configId of this.getEnabledConnectorIds()) this.maybeScheduleServerSideOauth(configId);
	}
	async syncEnterpriseConnectorTokenBeforeConnect(configId) {
		if (!this.serverSideOauthRefresher || !this.getCurrentEnterpriseId()) return { success: true };
		const entry = this.getMarketplaceEntryById(configId);
		if (!entry || !this.isEnterpriseServerSideConnector(configId)) return { success: true };
		if (!await this.isOneidAppEnabledForEntry(entry)) return {
			success: false,
			needsAuthorize: true,
			error: "OneID application is not enabled"
		};
		const connectorName = this.resolveOauthName(configId);
		const tokenResult = await this.serverSideOauthRefresher.tryFetchToken(connectorName);
		if (!tokenResult.ok) return {
			success: false,
			needsAuthorize: tokenResult.needsAuthorize,
			error: tokenResult.error
		};
		const updateResult = await this.updateHeaders(configId, this.resolveTokenHeaders(configId, connectorName, tokenResult.token), true);
		if (!updateResult.success) return {
			success: false,
			needsAuthorize: false,
			error: updateResult.error || "updateHeaders failed"
		};
		if (!this.serverSideOauthRefresher.isScheduled(configId)) this.serverSideOauthRefresher.schedule(configId, connectorName, {
			initialAccessToken: tokenResult.token,
			initialExpiresIn: tokenResult.expiresIn
		});
		return { success: true };
	}
	/**
	* 企业态 connector 是 OneID 租户级开通，启动或切账号时先恢复端侧 MCP 连接。
	*
	* 只有 `bound && enabled` 的 connector 才同步 token 并恢复运行连接。
	* OneID 已开通、云端有 token 都只是授权事实，不能代替用户打开本地开关。
	*/
	async scheduleEnterpriseConnectorRefreshes(options) {
		if (!this.serverSideOauthRefresher || !this.getCurrentEnterpriseId()) return;
		const manifest = this.readLocalManifest();
		if (!manifest?.connectors) return;
		let shouldRefreshAndSync = false;
		for (const entry of manifest.connectors) {
			const source = entry.source || entry.name;
			if (!Boolean(this.resolveActiveEnterpriseVariant(entry) || this.isEnterpriseManagedOneidConnector(entry)) || this.resolveActiveAuthMode(entry) !== "server-side") continue;
			if (entry.type === "cli" || entry.type === "skill-only") continue;
			if (!await this.isOneidAppEnabledForEntry(entry)) continue;
			if (!this.isEnabled(source)) continue;
			const connectorName = this.resolveOauthName(source);
			const tokenResult = await this.serverSideOauthRefresher.tryFetchToken(connectorName);
			if (!tokenResult.ok) {
				const status = tokenResult.needsAuthorize ? "unauthorized" : "error";
				const errorKindSuffix = tokenResult.errorKind ? ` [${tokenResult.errorKind}]` : "";
				this.logger.warn(`[ConnectorService] enterprise auto-connect ${source}: token precheck failed${errorKindSuffix} (${tokenResult.error}), status=${status}`);
				this.updateState(source, status, tokenResult.error);
				continue;
			}
			const updateResult = await this.updateHeaders(source, this.resolveTokenHeaders(source, connectorName, tokenResult.token), true);
			if (!updateResult.success) {
				this.logger.warn(`[ConnectorService] enterprise auto-connect ${source}: updateHeaders failed: ${updateResult.error}`);
				this.updateState(source, "error", updateResult.error);
				continue;
			}
			shouldRefreshAndSync = true;
			this.writeConnectorsMcpConfig();
			if (!this.serverSideOauthRefresher.isScheduled(source)) this.serverSideOauthRefresher.schedule(source, connectorName, {
				initialAccessToken: tokenResult.token,
				initialExpiresIn: tokenResult.expiresIn
			});
		}
		if (shouldRefreshAndSync && !options?.skipRefreshAndSync) await this.refreshAndSync();
	}
	/**
	* 反向同步：OneID 后台关闭某 enterprise variant connector ⇒ 端侧执行 unbind 等价动作。
	*
	* 触发时机：
	*   - init() 时（兜底）；
	*   - renderer 通过 oneidListApplications RPC 回灌 applications 后调用
	*     refreshEnterpriseConnectorTokens 时（主入口，applications 一定是最新的）。
	*
	* 判定规则：
	*   - bound（完成过接入） + OneID disabled → 视为被管理员后台解绑 → unbind
	*   - 从未接入过（bound=false）            → 不动
	*   - OneID 仍开通                                            → 不动
	*
	* unbind() 内部不调 /v2/.../revoke（B 端解绑权在管理员后台），只清本地状态：
	*   bound/enabled / headerOverrides / envOverrides / token 文件 / mcp.json，并 emit unbound 事件。
	*/
	async syncEnterpriseConnectorUnbind() {
		if (!this.getCurrentEnterpriseId()) return;
		const manifest = this.readLocalManifest();
		if (!manifest?.connectors) return;
		let apps;
		try {
			apps = await this.getOneidApplications();
		} catch (err) {
			this.logger.warn("[ConnectorService] syncEnterpriseConnectorUnbind: getOneidApplications failed, skip:", err);
			return;
		}
		for (const entry of manifest.connectors) {
			const source = entry.source || entry.name;
			if (!Boolean(this.resolveActiveEnterpriseVariant(entry) || this.isEnterpriseManagedOneidConnector(entry))) continue;
			if (entry.type === "cli" || entry.type === "skill-only") continue;
			if (!this.isBound(source)) continue;
			const appType = this.resolveOneidAppType(entry);
			if (!appType) continue;
			if (apps.find((a) => a.app_type === appType)?.enabled === true) continue;
			this.logger.info(`[ConnectorService] OneID app ${appType} disabled, auto-unbinding ${source}`);
			try {
				await this.unbind(source);
			} catch (err) {
				this.logger.warn(`[ConnectorService] auto-unbind ${source} failed:`, err);
			}
		}
	}
	async isOneidAppEnabledForEntry(entry) {
		const appType = this.resolveOneidAppType(entry);
		if (!appType) return true;
		return this.isOneidAppEnabledByType(appType, entry.source || entry.name);
	}
	async isOneidAppEnabledByType(appType, logName = appType) {
		try {
			return (await this.getOneidApplications()).find((app) => app.app_type === appType)?.enabled === true;
		} catch (err) {
			this.logger.warn(`[ConnectorService] OneID applications check failed for ${logName}:`, err);
			return false;
		}
	}
	resolveOneidAppType(entry) {
		return require_tar$1.resolveOneidAppType(entry, this.getConnectorAccountContext());
	}
	populateOneidApplicationsCache(enterpriseId, applications) {
		if (!enterpriseId) return;
		const normalized = applications.map((item) => ({
			app_type: item.app_type ?? "",
			enabled: item.enabled === true
		}));
		this.oneidApplicationsCache.set(enterpriseId, { applications: this.applyDevForceDisabled(normalized) });
	}
	/**
	* ⚠️ 开发期 HACK：硬编码把所有 OneID applications 的 enabled 全部强制为 false，
	* 用于本地验证 OneID 应用「开通 → 关闭」时反向 unbind 链路（syncEnterpriseConnectorUnbind）。
	*
	* 必须在所有写入 oneidApplicationsCache 的入口统一调用：
	* - fetchOneidApplications（init 路径，主进程主动 fetch）
	* - populateOneidApplicationsCache（renderer RPC 回灌路径）
	*
	* TODO: 验证完毕后整体删除此方法，并去掉两处调用点。
	*/
	applyDevForceDisabled(apps) {
		return apps;
	}
	async getOneidApplications() {
		const enterpriseId = this.getCurrentEnterpriseId();
		if (!enterpriseId) return [];
		let cache = this.oneidApplicationsCache.get(enterpriseId);
		if (cache?.applications) return cache.applications;
		if (cache?.promise) return cache.promise;
		cache = {};
		const promise = this.fetchOneidApplications(enterpriseId).then((applications) => {
			cache.applications = applications;
			cache.promise = void 0;
			return applications;
		}).catch((err) => {
			cache.promise = void 0;
			throw err;
		});
		cache.promise = promise;
		this.oneidApplicationsCache.set(enterpriseId, cache);
		return promise;
	}
	async fetchOneidApplications(enterpriseId) {
		const endpoint = this.productManager.getEndpoint();
		if (!endpoint) throw new Error("[OneID] No endpoint available");
		const authHeaders = this.authService.buildAuthHeaders();
		if (!authHeaders.Authorization || !authHeaders["X-User-Id"]) throw new Error("[OneID] Not logged in");
		const headers = {
			Accept: "application/json",
			"Content-Type": "application/json",
			...authHeaders
		};
		const url = `${endpoint.replace(/\/+$/, "")}/console/enterprises/${encodeURIComponent(enterpriseId)}/oneid_openapi/applications`;
		const response = await this.hostCapabilities.fetch(url, {
			method: "GET",
			headers
		});
		if (!response.ok) {
			const text = await response.text().catch(() => "");
			throw new Error(`[OneID] listApplications HTTP ${response.status}: ${text}`);
		}
		const raw = typeof response.json === "function" ? await response.json() : JSON.parse(await response.text());
		if (typeof raw.code === "number" && raw.code !== 0) throw new Error(`[OneID] listApplications API error ${raw.code}: ${raw.msg ?? ""}`);
		const normalized = (raw.data?.applications ?? raw.applications ?? []).map((item) => ({
			app_type: item.app_type ?? "",
			enabled: item.enabled === true
		}));
		return this.applyDevForceDisabled(normalized);
	}
	ensurePersistentStateMatchesCurrentIdentity() {
		const currentIdentityKey = this.getCurrentAccountIdentityKey();
		if (this.persistentState.accountIdentityKey ? !this.matchesCurrentAccountIdentity(this.persistentState.accountIdentityKey, currentIdentityKey) : !!this.getCurrentEnterpriseId()) this.clearManagedAuthHeaders();
		if (this.persistentState.accountIdentityKey === currentIdentityKey) return;
		this.persistentState.accountIdentityKey = currentIdentityKey;
		this.savePersistentState();
	}
	matchesCurrentAccountIdentity(storedIdentityKey, currentIdentityKey) {
		if (storedIdentityKey === currentIdentityKey) return true;
		if (this.getConnectorAccountContext().variantKey !== "enterprise") return false;
		return storedIdentityKey === this.getLegacyAccountIdentityKey();
	}
	clearManagedAuthHeaders() {
		const managedHeaderNames = new Set(["Authorization", "X-Oneid-Access-Token"]);
		let changed = false;
		for (const [configId, headers] of Object.entries(this.persistentState.headerOverrides)) {
			if (!require_tar$1.hasEnterpriseVariantConfig(this.getMarketplaceEntryById(configId))) continue;
			for (const headerName of Array.from(managedHeaderNames)) if (headers[headerName] !== void 0) {
				delete headers[headerName];
				changed = true;
			}
			if (Object.keys(headers).length === 0) delete this.persistentState.headerOverrides[configId];
		}
		if (changed) this.logger.info("[ConnectorService] Cleared managed auth headers after account identity change");
	}
	/**
	* 启动时把 `bound && enabled` 的 skill-only connector 状态恢复为 'connected'。
	* skill-only 没有真实的 MCP 连接，只要用户启用过就视为已连接。
	*/
	restoreSkillOnlyConnectedState() {
		for (const configId of this.getEnabledConnectorIds()) {
			const entry = this.getMarketplaceEntryById(configId);
			if (!entry || entry.type !== "skill-only") continue;
			this.updateState(configId, "connected");
			this.installSkills(configId);
		}
	}
	/**
	* 修复状态文件与 OAuth 凭据分裂：状态文件被删除/重置但 OAuth 凭据仍在时，
	* 把这些 connector 恢复为 `bound=true, enabled=false`（关闭开关）。
	*
	* 凭据存在只是"曾完成接入"的补充证据（plan §7.2），不能代替用户意图，
	* 因此不自动置 enabled=true——用户重新打开开关时静默复用既有 token。
	*
	* 仅恢复标准 MCP OAuth connector；云端托管、Token、CLI 和 skill-only 不处理。
	* 有效 access token 或可刷新的 refresh token 才能作为恢复依据。
	*/
	restoreOAuthState() {
		const manifest = this.readLocalManifest();
		if (!manifest?.connectors) return false;
		const oauthStore = this.createOAuthStore();
		const restored = [];
		for (const entry of manifest.connectors) {
			const configId = entry.source || entry.name;
			if (!configId || this.isBound(configId) || entry.type === "cli" || entry.type === "skill-only" || this.resolveActiveAuthMode(entry) !== void 0 || this.isExternallyManagedConnector(configId)) continue;
			const serverConfig = this.getLatestServerConfigForConnector(configId);
			if (!serverConfig?.url) continue;
			const tokens = oauthStore.loadTokens(require_tar$1.toRuntimeMcpConfigId(configId), serverConfig.url, serverConfig.headers);
			if (!(Boolean(tokens?.access_token) && (tokens?.expires_in ?? 0) > 0) && !tokens?.refresh_token) continue;
			this.markConnectorBound(configId);
			restored.push(configId);
		}
		if (restored.length === 0) return false;
		this.savePersistentState();
		this.logger.info(`[ConnectorService] restored bound lifecycle from OAuth credentials: ${restored.join(", ")}`);
		return true;
	}
	/** 通过 configId 找 marketplace entry（兼容带/不带 connector: 前缀的场景） */
	getMarketplaceEntryById(configId) {
		const manifest = this.readLocalManifest();
		if (!manifest?.connectors) return;
		const stripped = configId.startsWith("connector:") ? configId.slice(require_tar$1.CONNECTOR_PREFIX.length) : configId;
		return manifest.connectors.find((e) => (e.source || e.name) === stripped);
	}
	/**
	* 一次性迁移：把旧版 `configDir/skills/connector-*` 挪到 `configDir/connectors/skills/connector-*`。
	*
	* 背景：早期 `installSkills` 把 connector 的 skill 装在 `configDir/skills/` 下，和用户自己的 skill 混在同一个目录。
	* workbuddy 扫描用户 skill 时会把它们当成 source='user' 返回，导致 UI 的 source='connector' 过滤失效。
	*
	* 新路径 `configDir/connectors/skills/` 与 agent-craft 对齐，扫描后 source='connector'，UI 可正确过滤。
	*
	* 可靠性设计：
	* - 优先使用 `renameSync`（同盘下是原子操作）。
	* - 跨盘 rename 失败时，退化为 "copy 到 `.tmp` → rename `.tmp` 到最终路径 → 删源"，
	*   避免"复制一半进程崩溃"导致下次启动把残缺 dest 当作完整迁移，进而错删源数据。
	* - 异常时绝不删源；重启后可重新尝试迁移。
	* - 已存在于最终路径的条目视为旧版本重连时已生成，直接清掉旧源。
	*/
	migrateLegacyConnectorSkills() {
		const legacyBase = (0, path.join)(this.configDir, "skills");
		const newBase = (0, path.join)(this.configDir, CONNECTOR_SKILLS_DIR);
		if (!(0, fs.existsSync)(legacyBase)) return;
		let entries;
		try {
			entries = (0, fs.readdirSync)(legacyBase);
		} catch (error) {
			this.logger.warn("[ConnectorService] Failed to read legacy skills dir for migration:", error);
			return;
		}
		const toMigrate = entries.filter((n) => n.startsWith(CONNECTOR_SKILL_PREFIX));
		if (toMigrate.length === 0) return;
		try {
			(0, fs.mkdirSync)(newBase, { recursive: true });
		} catch (error) {
			this.logger.warn("[ConnectorService] Failed to create new connector skills dir:", error);
			return;
		}
		for (const name of toMigrate) {
			const src = (0, path.join)(legacyBase, name);
			const dest = (0, path.join)(newBase, name);
			const tmpDest = (0, path.join)(newBase, `${name}.migrating`);
			try {
				if ((0, fs.existsSync)(dest)) {
					(0, fs.rmSync)(src, {
						recursive: true,
						force: true
					});
					this.logger.info(`[ConnectorService] Removed stale legacy connector skill: ${name}`);
					continue;
				}
				if ((0, fs.existsSync)(tmpDest)) (0, fs.rmSync)(tmpDest, {
					recursive: true,
					force: true
				});
				try {
					(0, fs.renameSync)(src, dest);
				} catch {
					this.copyDirectory(src, tmpDest);
					(0, fs.renameSync)(tmpDest, dest);
					(0, fs.rmSync)(src, {
						recursive: true,
						force: true
					});
				}
				this.logger.info(`[ConnectorService] Migrated legacy connector skill: ${name}`);
			} catch (error) {
				try {
					if ((0, fs.existsSync)(tmpDest)) (0, fs.rmSync)(tmpDest, {
						recursive: true,
						force: true
					});
				} catch {}
				this.logger.warn(`[ConnectorService] Failed to migrate legacy connector skill ${name}:`, error);
			}
		}
	}
	/**
	* 安装 connector 的 skills 到 ~/.workbuddy/connectors/skills/connector-{id}/
	*
	* 路径设计：与 agent-craft 的 loadConnectorSkills 扫描路径对齐，
	* 以便 agent-craft 能正确识别 source='connector'，UI 层可按 source 过滤。
	* （旧路径 ~/.workbuddy/skills/connector-{id}/ 会把 connector skill 混入用户 skill 列表）
	*/
	installSkills(configId) {
		const source = configId;
		const connectorDir = (0, path.join)(this.baseDir, require_tar$1.CONNECTORS_DIR, source);
		let srcSkillsDir = (0, path.join)(connectorDir, "skills");
		if (!(0, fs.existsSync)(srcSkillsDir)) srcSkillsDir = (0, path.join)(connectorDir, "skill");
		if (!(0, fs.existsSync)(srcSkillsDir)) {
			this.logger.info(`[ConnectorService] No skills found for ${configId}`);
			return;
		}
		const destSkillsDir = (0, path.join)(this.configDir, CONNECTOR_SKILLS_DIR, `${CONNECTOR_SKILL_PREFIX}${configId}`);
		if ((0, fs.existsSync)(destSkillsDir)) (0, fs.rmSync)(destSkillsDir, {
			recursive: true,
			force: true
		});
		(0, fs.mkdirSync)(destSkillsDir, { recursive: true });
		this.copyDirectory(srcSkillsDir, destSkillsDir);
		this.logger.info(`[ConnectorService] Installed skills for ${configId} to ${destSkillsDir}`);
	}
	/**
	* 禁用 connector 的 skills：递归标记 connector 目录下所有 SKILL.md 的 frontmatter `disable: true`。
	*
	* 历史：最初实现只处理 `connector-<id>/SKILL.md` 这个顶层单文件（Gmail 场景只有一层）。
	* 若 connector 在 skills 目录下采用嵌套结构（例如 `skills/search/SKILL.md` +
	* `skills/send/SKILL.md`），旧实现会漏标，解绑后 agent-cli 仍会扫到并注入 prompt——
	* 即"已解绑但能力仍可触发"的一致性 bug。
	*
	* 现行策略：以 `connector-<id>/` 为根递归，精确匹配文件名 `SKILL.md` 逐个打标。
	* 与 agent-cli `SkillProductProvider.scanSkillsDirectory` 的命名规则和最大深度对齐，
	* 保证「能被扫到的 SKILL.md 都能被禁用」。
	*
	* 软禁用保留原目录结构；重连时 `installSkills` 会 `rmSync` 整目录再复制，`disable` 字段自然消失。
	* 单个文件失败不阻断其他文件，尽力而为。
	*/
	disableSkills(configId) {
		const connectorDir = (0, path.join)(this.configDir, CONNECTOR_SKILLS_DIR, `${CONNECTOR_SKILL_PREFIX}${configId}`);
		if (!(0, fs.existsSync)(connectorDir)) return;
		let markedCount = 0;
		const visit = (dir, depth) => {
			if (depth > MAX_SKILL_SCAN_DEPTH) return;
			let entries;
			try {
				entries = (0, fs.readdirSync)(dir);
			} catch (error) {
				this.logger.warn(`[ConnectorService] disableSkills readdir failed: ${dir}`, error);
				return;
			}
			for (const entry of entries) {
				const fullPath = (0, path.join)(dir, entry);
				let stat;
				try {
					stat = (0, fs.statSync)(fullPath);
				} catch {
					continue;
				}
				if (stat.isDirectory()) visit(fullPath, depth + 1);
				else if (stat.isFile() && entry === "SKILL.md") {
					if (this.markSkillFileDisabled(fullPath)) markedCount++;
				}
			}
		};
		visit(connectorDir, 0);
		this.logger.info(`[ConnectorService] Disabled ${markedCount} skill file(s) for ${configId}`);
	}
	/**
	* 把单个 SKILL.md 的 frontmatter 标记为 `disable: true`。
	*
	* - 没有 frontmatter 的文件不处理（与旧行为一致：只对带 YAML frontmatter 的 skill 生效）
	* - 已是禁用态时幂等跳过
	* - 失败返回 false 并打 warn，调用方仅用作计数不阻断
	*/
	markSkillFileDisabled(skillFile) {
		try {
			const raw = (0, fs.readFileSync)(skillFile, "utf-8");
			const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
			if (!fmMatch) return false;
			const data = import_dist.parse(fmMatch[1]) || {};
			if (data.disable === true) return true;
			data.disable = true;
			const body = raw.slice(fmMatch[0].length).replace(/^\r?\n/, "");
			(0, fs.writeFileSync)(skillFile, `---\n${import_dist.stringify(data).trimEnd()}\n---\n${body}`, "utf-8");
			return true;
		} catch (error) {
			this.logger.warn(`[ConnectorService] Failed to mark skill disabled: ${skillFile}`, error);
			return false;
		}
	}
	/**
	* 写入 connectors/mcp.json：合并所有 connector 的 MCP 配置
	* 用于 CLI 及其他工具读取 connector 的 MCP 服务器配置
	*/
	writeConnectorsMcpConfig() {
		const manifest = this.readLocalManifest();
		if (!manifest?.connectors) return;
		const mergedServers = {};
		for (const entry of manifest.connectors) {
			const source = entry.source || entry.name;
			if (entry.type === "cli") {
				this.logger.info(`[ConnectorService] Skipping mcp.json for CLI connector: ${source}`);
				continue;
			}
			if (entry.type === "skill-only") {
				this.logger.info(`[ConnectorService] Skipping mcp.json for skill-only connector: ${source}`);
				continue;
			}
			const mcpConfig = this.readConnectorMcpConfig(source);
			if (!mcpConfig) continue;
			const isEnabled = this.isEnabled(source);
			for (const [, serverConfig] of Object.entries(mcpConfig.mcpServers)) {
				const key = require_tar$1.toRuntimeMcpConfigId(source);
				const rawTimeout = serverConfig.timeout;
				const timeoutMs = rawTimeout ? rawTimeout < 1e3 ? rawTimeout * 1e3 : rawTimeout : void 0;
				mergedServers[key] = {
					...serverConfig,
					...timeoutMs !== void 0 ? { timeout: timeoutMs } : {},
					...!isEnabled ? { disabled: true } : {}
				};
			}
		}
		const connectorsMcpDir = (0, path.dirname)(this.connectorMcpConfigPath);
		try {
			(0, fs.mkdirSync)(connectorsMcpDir, { recursive: true });
			this.lastSelfWriteConnectorMcpAt = Date.now();
			(0, fs.writeFileSync)(this.connectorMcpConfigPath, JSON.stringify({ mcpServers: mergedServers }, null, 2), "utf-8");
			this.mcpJsonCache.invalidate(this.connectorMcpConfigPath);
			this.logger.info(`[ConnectorService] Written connectors MCP config to ${this.connectorMcpConfigPath}`);
		} catch (err) {
			this.logger.warn("[ConnectorService] Failed to write connectors MCP config:", err);
		}
	}
	async syncMarketplaceContent() {
		this.ensureMarketplaceProductConfigurationResolution("startup-sync");
		if (this.isLoaded()) {
			this.logger.info(`[ConnectorService] Marketplace already cached; productConfigState=${this.marketplaceProductConfigurationState}`);
			const availableSource = this.getMarketplaceSourceForCurrentPolicy("cached-startup");
			if (availableSource) this.requestMarketplaceSync(availableSource, {
				mode: "update",
				reason: "cached-startup-source-available"
			}).catch((error) => {
				this.logger.warn("[ConnectorService] Marketplace cached startup update failed:", error);
			});
			else if (this.marketplaceProductConfigurationState === "failed") this.logger.warn("[ConnectorService] Marketplace cached startup: cloud product request failed; preserving cached source until a later retry");
			else this.scheduleMarketplaceSyncWhenProductReady("cached-startup");
			return;
		}
		if (this.marketplaceProductConfigurationPromise) {
			const primaryWaitResult = await this.waitForMarketplaceProductConfiguration(MARKETPLACE_CLOUD_PRIMARY_WAIT_MS);
			if (primaryWaitResult !== "ready") {
				this.logger.info(primaryWaitResult === "timeout" ? `[ConnectorService] Marketplace cache missing; cloud config not ready after ${MARKETPLACE_CLOUD_PRIMARY_WAIT_MS}ms, continuing to wait` : "[ConnectorService] Marketplace cache missing; cloud config request failed, using fallback for first download");
				if (primaryWaitResult === "timeout") {
					if (await this.waitForMarketplaceProductConfiguration(MARKETPLACE_CLOUD_MAX_WAIT_MS - MARKETPLACE_CLOUD_PRIMARY_WAIT_MS) === "timeout") {
						this.logger.warn(`[ConnectorService] Marketplace cache missing; cloud config not ready after ${MARKETPLACE_CLOUD_MAX_WAIT_MS}ms, using fallback for first download`);
						this.scheduleMarketplaceSyncWhenProductReady("late-cloud-after-fallback");
					}
				}
			}
		}
		const source = this.getMarketplaceSourceForCurrentPolicy("startup-no-cache");
		if (!source) throw new Error("Connector marketplace source is unavailable");
		await this.requestMarketplaceSync(source, {
			mode: "install",
			reason: "startup-no-cache"
		});
	}
	async downloadAndReplaceMarketplace(source, generation) {
		const tempDir = (0, path.join)((0, os.tmpdir)(), `connectors-marketplace-tmp-${process.pid}-${Date.now()}`);
		try {
			const { fingerprint } = await this.downloadAndExtractToDir(source.url, tempDir);
			if (!this.isMarketplaceSyncCurrent(source, generation)) {
				this.logger.info(`[ConnectorService] Discarding stale marketplace download before install: ${source.marketplaceName} -> ${require_proxy_agents.sanitizeUrlForLog(source.url)}`);
				return false;
			}
			if (!await this.replaceMarketplaceDir(tempDir, source.marketplaceName, {
				...fingerprint,
				sourceKey: this.marketplaceSourceKey(source)
			}, () => this.isMarketplaceSyncCurrent(source, generation))) return false;
			this.writeConnectorsMcpConfig();
			this.catalogChangedNotifier?.();
			return true;
		} finally {
			if ((0, fs.existsSync)(tempDir)) (0, fs.rmSync)(tempDir, {
				recursive: true,
				force: true
			});
		}
	}
	startMarketplaceProductConfigurationResolution(reason) {
		const generation = ++this.marketplaceProductConfigurationGeneration;
		this.marketplaceProductConfigurationState = "pending";
		const resolver = this.resolveProductConfiguration;
		const tracked = (resolver ? Promise.resolve().then(() => resolver()) : this.productConfigurationReady ? this.productConfigurationReady.then(() => "resolved") : Promise.resolve("resolved")).then((state) => state === "failed" ? "failed" : "resolved", (error) => {
			this.logger.warn(`[ConnectorService] Marketplace product configuration ${reason} failed:`, error);
			return "failed";
		}).then((state) => {
			if (generation === this.marketplaceProductConfigurationGeneration) {
				this.marketplaceProductConfigurationState = state;
				this.logger.info(`[ConnectorService] Marketplace product configuration ${reason} settled: state=${state}`);
			}
			return state;
		});
		this.marketplaceProductConfigurationPromise = tracked;
		return tracked;
	}
	ensureMarketplaceProductConfigurationResolution(reason) {
		return this.marketplaceProductConfigurationPromise ?? this.startMarketplaceProductConfigurationResolution(reason);
	}
	waitForMarketplaceProductConfiguration(timeoutMs) {
		const promise = this.marketplaceProductConfigurationPromise;
		if (!promise) return Promise.resolve(this.marketplaceProductConfigurationState === "failed" ? "failed" : "ready");
		return new Promise((resolve) => {
			let settled = false;
			const timer = setTimeout(() => {
				if (!settled) {
					settled = true;
					resolve("timeout");
				}
			}, timeoutMs);
			timer.unref?.();
			promise.then((state) => {
				if (!settled) {
					settled = true;
					clearTimeout(timer);
					resolve(state === "failed" ? "failed" : "ready");
				}
			});
		});
	}
	scheduleMarketplaceSyncWhenProductReady(reason) {
		this.ensureMarketplaceProductConfigurationResolution(reason).then((state) => {
			if (this.marketplaceDisposed) return;
			if (state === "failed") {
				this.logger.info(`[ConnectorService] Marketplace ${reason}: cloud product request failed; preserving cache and waiting for a later retry`);
				return;
			}
			this.syncMarketplaceForCurrentPolicy(`${reason}:product-config-resolved`).catch((error) => {
				this.logger.warn(`[ConnectorService] Marketplace ${reason} sync failed:`, error);
			});
		});
	}
	requestMarketplaceSync(source, options) {
		if (this.marketplaceDisposed) return Promise.resolve();
		const sourceKey = this.marketplaceSourceKey(source);
		if (this.pendingMarketplaceSync?.sourceKey === sourceKey) {
			if (options.mode === "update" || this.isLoaded()) return this.pendingMarketplaceSync.promise;
			return this.pendingMarketplaceSync.promise.then(() => this.requestMarketplaceSync(source, options));
		}
		this.desiredMarketplaceSource = source;
		const generation = ++this.marketplaceDesiredGeneration;
		const run = async () => {
			if (this.marketplaceDisposed || !this.isMarketplaceSyncCurrent(source, generation)) return;
			this.logger.info(`[ConnectorService] Marketplace sync queued: reason=${options.reason}, mode=${options.mode}, source=${source.marketplaceName} -> ${require_proxy_agents.sanitizeUrlForLog(source.url)}`);
			if (options.mode === "install" || !this.isLoaded()) {
				await this.downloadAndReplaceMarketplace(source, generation);
				return;
			}
			await this.tryUpdateSource(source, generation);
		};
		const result = this.marketplaceSyncChain.then(run, run);
		this.marketplaceSyncChain = result.catch((error) => {
			this.logger.warn("[ConnectorService] Marketplace sync failed:", error);
		});
		this.pendingMarketplaceSync = {
			sourceKey,
			promise: result
		};
		result.finally(() => {
			if (this.pendingMarketplaceSync?.promise === result) this.pendingMarketplaceSync = void 0;
		}).catch(() => void 0);
		return result;
	}
	isMarketplaceSyncCurrent(source, generation) {
		return !this.marketplaceDisposed && generation === this.marketplaceDesiredGeneration && this.desiredMarketplaceSource?.marketplaceName === source.marketplaceName && this.desiredMarketplaceSource?.url === source.url;
	}
	marketplaceSourceKey(source) {
		return `${source.marketplaceName}\n${source.url}`;
	}
	async downloadAndExtractToDir(url, targetDir) {
		const { buffer, etag } = await this.downloadBufferWithHeaders(url);
		const zip = new import_adm_zip.default(buffer);
		(0, fs.mkdirSync)(targetDir, { recursive: true });
		zip.extractAllTo(targetDir, true);
		const manifestPath = (0, path.join)(targetDir, require_tar$1.MANIFEST_REL_PATH);
		if (!(0, fs.existsSync)(manifestPath)) throw new Error(`Downloaded zip does not contain ${require_tar$1.MANIFEST_REL_PATH}`);
		const manifest = JSON.parse((0, fs.readFileSync)(manifestPath, "utf-8"));
		const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
		return {
			manifest,
			fingerprint: {
				etag: etag ?? null,
				sha256
			}
		};
	}
	async replaceMarketplaceDir(sourceDir, marketplaceName, fingerprint, isCurrent = () => true) {
		if (!this.acquireLock()) {
			this.logger.info(`[ConnectorService] Another instance is syncing "${marketplaceName}", skipping`);
			return false;
		}
		try {
			if (!isCurrent()) {
				this.logger.info(`[ConnectorService] Marketplace target changed before replace, skipping "${marketplaceName}"`);
				return false;
			}
			if ((0, fs.existsSync)(this.baseDir)) (0, fs.rmSync)(this.baseDir, {
				recursive: true,
				force: true
			});
			try {
				(0, fs.renameSync)(sourceDir, this.baseDir);
			} catch {
				this.copyDirectory(sourceDir, this.baseDir);
			}
			if (fingerprint) this.saveMarketplaceMeta(fingerprint);
			this.marketplaceManifestCache.invalidate();
			this.rebuildAuthInjectionRuleCache();
			for (const configId of this.getEnabledConnectorIds()) {
				if (!(this.states.get(configId)?.status === "connected")) continue;
				try {
					this.installSkills(configId);
				} catch (error) {
					this.logger.warn(`[ConnectorService] Post-marketplace-update installSkills failed for ${configId}:`, error);
				}
			}
			this.logger.info(`[ConnectorService] Synced marketplace "${marketplaceName}"`);
			return true;
		} finally {
			this.releaseLock();
		}
	}
	buildConnectorConfig(entry) {
		const source = entry.source || entry.name;
		const connectorType = entry.type || "mcp";
		const incompatibility = this.computeVersionIncompatibility(entry);
		if (incompatibility && !this.isConnectorTouchedByUser(source)) {
			this.logger.info(`[ConnectorService] Skip entry ${source}: incompatible (${incompatibility.kind}) and user has never enabled/connected it; minVersion=${entry.minWorkbuddyVersion ?? ""} maxVersion=${entry.maxWorkbuddyVersion ?? ""}`);
			return null;
		}
		let config;
		if (connectorType === "cli") config = this.buildCliConnectorConfig(entry, source);
		else if (connectorType === "skill-only") config = this.buildSkillOnlyConnectorConfig(entry, source);
		else config = this.buildMcpConnectorConfig(entry, source);
		if (config && incompatibility) config.versionIncompatibility = incompatibility;
		return config;
	}
	/**
	* 计算 entry 与当前 WorkBuddy 版本的兼容性结果。
	* 返回 undefined / VersionIncompatibility：
	* - 无版本约束或兼容 → undefined
	* - 不兼容 → 对应的 VersionIncompatibility 对象
	*
	* 拿不到当前版本号（测试环境 / electron app 未就绪等）时走宽松策略：
	* 直接返回 undefined，不阻塞任何 connector。
	*/
	computeVersionIncompatibility(entry) {
		const currentVersion = this.hostCapabilities.getAppVersion();
		if (!currentVersion) return;
		return checkCompatibility({
			currentVersion,
			minWorkbuddyVersion: entry.minWorkbuddyVersion,
			maxWorkbuddyVersion: entry.maxWorkbuddyVersion
		}) ?? void 0;
	}
	/**
	* 用户是否曾经"接触过"该 connector（完成过接入，进入开关管理生命周期）。
	* 用于决定不兼容 connector 在 UI 中是否保留显示（置灰降级）。
	*/
	isConnectorTouchedByUser(source) {
		return this.isBound(source);
	}
	buildMcpConnectorConfig(entry, source) {
		const mcpPath = (0, path.join)(this.baseDir, require_tar$1.CONNECTORS_DIR, source, "mcp.json");
		if (!(0, fs.existsSync)(mcpPath)) return null;
		let mcpConfig;
		try {
			mcpConfig = JSON.parse((0, fs.readFileSync)(mcpPath, "utf-8"));
		} catch {
			return null;
		}
		const iconPath = this.findConnectorIcon(source);
		const skills = this.readSkillConfigs(source);
		const runtimeConfig = this.buildRuntimeMcpConfig(source, mcpConfig);
		const firstServerConfig = Object.values(runtimeConfig.mcpServers || {})[0];
		const mcpConfigInfo = firstServerConfig ? {
			url: firstServerConfig.url || "",
			type: firstServerConfig.type,
			headers: firstServerConfig.headers,
			env: firstServerConfig.env
		} : { url: "" };
		const authMode = this.resolveActiveAuthMode(entry);
		let tokenConfig;
		let tokenValues;
		let tokenSecretFields;
		if (authMode === "token") {
			const schema = this.readTokenSchema(source);
			if (schema) {
				tokenConfig = schema;
				const envOverrides = this.persistentState.envOverrides[source] || {};
				tokenValues = {};
				tokenSecretFields = [];
				for (const field of schema.fields) {
					const saved = envOverrides[field.key];
					if (field.type === "password") {
						tokenValues[field.key] = "";
						if (typeof saved === "string" && saved.length > 0) tokenSecretFields.push(field.key);
					} else tokenValues[field.key] = typeof saved === "string" && saved.length > 0 ? saved : field.defaultValue ?? "";
				}
			}
		}
		let cliConfig;
		if (mcpConfig.preAuth === "cli") {
			const cliPath = (0, path.join)(this.baseDir, require_tar$1.CONNECTORS_DIR, source, "cli.json");
			if ((0, fs.existsSync)(cliPath)) try {
				cliConfig = JSON.parse((0, fs.readFileSync)(cliPath, "utf-8"));
			} catch (e) {
				this.logger.warn(`[ConnectorService] Failed to read cli.json for preAuth: ${source}`, e);
			}
		}
		const examples = this.resolveLocalizedExamples(entry);
		return {
			id: source,
			name: this.resolveLocalizedName(entry),
			description: this.resolveLocalizedDescription(entry),
			icon: iconPath || "",
			authMode,
			providerId: entry.provider_id,
			mcpConfig: mcpConfigInfo,
			skills,
			...cliConfig ? { cliConfig } : {},
			...tokenConfig ? { tokenConfig } : {},
			...tokenValues ? { tokenValues } : {},
			...tokenSecretFields && tokenSecretFields.length > 0 ? { tokenSecretFields } : {},
			...entry.visible_in && entry.visible_in.length > 0 ? { visibleIn: entry.visible_in } : {},
			...examples ? { examples } : {}
		};
	}
	readConnectorMcpConfig(configId) {
		const mcpPath = (0, path.join)(this.baseDir, require_tar$1.CONNECTORS_DIR, configId, "mcp.json");
		if (!(0, fs.existsSync)(mcpPath)) return null;
		try {
			return JSON.parse((0, fs.readFileSync)(mcpPath, "utf-8"));
		} catch {
			return null;
		}
	}
	/**
	* 为主动 connect 组装 custom-mcp: 前缀 connector 的 MCP 配置。
	*
	* 与 marketplace connector（读 connectors/<id>/mcp.json 文件）不同，custom-mcp:
	* 前缀的 server 来自用户 mcp.json（readCustomMcpConfig），且内置 Ardot / Netdrive
	* 走 resolveEffective* 决议：用户 dev 覆盖优先、否则回退到运行时合成的内置远端配置
	* （无落盘文件）。与 buildDesiredConfigs（refreshAndSync 路径）的决议逻辑保持一致，
	* 确保「主动 connect」与「自动 sync」拿到同一份配置。
	*
	* 返回 `{ mcpServers: { [serverName]: config } }` 单条形态，交给 doConnect 后续
	* buildRuntimeMcpConfig / 取 firstServer 处理。
	*/
	readCustomMcpConfigForConnect(configId) {
		const serverName = configId.slice(this.CUSTOM_MCP_PREFIX.length);
		if (!serverName) return null;
		const userEntry = this.readCustomMcpConfig().mcpServers?.[serverName];
		let serverConfig;
		if (serverName === "ardot") serverConfig = this.resolveEffectiveArdotMcpServer(userEntry);
		else if (serverName === "netdrive") serverConfig = this.resolveEffectiveNetdriveMcpServer(userEntry);
		else serverConfig = userEntry;
		if (!serverConfig || serverConfig.disabled) return null;
		return { mcpServers: { [serverName]: serverConfig } };
	}
	buildRuntimeMcpConfig(configId, mcpConfig) {
		const overriddenConfig = this.applyOverrides(configId, mcpConfig);
		const entry = this.getMarketplaceEntryById(configId);
		const enterpriseVariant = this.resolveActiveEnterpriseVariant(entry);
		const providerOauthName = typeof entry?.provider_id === "string" && entry.provider_id.length > 0 ? entry.provider_id : void 0;
		if (!Boolean(enterpriseVariant || this.isEnterpriseManagedOneidConnector(entry))) {
			if (entry && this.resolveActiveAuthMode(entry) === "server-side") {
				const result = { mcpServers: {} };
				for (const [name, config] of Object.entries(overriddenConfig.mcpServers)) result.mcpServers[name] = {
					...config,
					_workbuddyManagedAuth: "server-side"
				};
				return result;
			}
			const result = { mcpServers: {} };
			for (const [name, config] of Object.entries(overriddenConfig.mcpServers)) {
				const configWithOauthName = providerOauthName ? {
					...config,
					_workbuddyManagedAuthOauthName: providerOauthName
				} : config;
				result.mcpServers[name] = this.markIoaRuntimeServerSideAuth(configId, configWithOauthName);
			}
			return result;
		}
		const result = { mcpServers: {} };
		for (const [name, config] of Object.entries(overriddenConfig.mcpServers)) {
			const headers = {
				...config.headers,
				...enterpriseVariant?.extra_headers ?? {}
			};
			const tokenHeaderName = enterpriseVariant?.token_header?.name ?? this.resolveEnterpriseTokenHeaderName(entry);
			if (tokenHeaderName && tokenHeaderName.toLowerCase() !== "authorization") {
				delete headers.Authorization;
				delete headers.authorization;
			}
			const { headers: _headers, ...configWithoutHeaders } = config;
			result.mcpServers[name] = {
				...configWithoutHeaders,
				...enterpriseVariant?.mcp_url_override ? { url: enterpriseVariant.mcp_url_override } : {},
				...Object.keys(headers).length > 0 ? { headers } : {},
				_workbuddyManagedAuth: require_tar$1.WORKBUDDY_MANAGED_AUTH_ENTERPRISE
			};
		}
		return result;
	}
	resolveStagingConnectorUrl(configId, target) {
		if (typeof target === "string" || target === void 0) {
			const url = target;
			if (configId !== "ima-mcp" || !url || !this.isStagingEndpoint()) return url;
			return url.replace("ima.qq.com", "ima-test.qq.com");
		}
		const serverConfig = target;
		if (configId !== "ima-mcp" || !this.isStagingEndpoint()) return;
		const currentUrl = serverConfig.url;
		if (currentUrl && currentUrl.includes("ima.qq.com") && !currentUrl.includes("ima-test.qq.com")) serverConfig.url = currentUrl.replace("ima.qq.com", "ima-test.qq.com");
	}
	/**
	* 判断当前是否在预发/非生产环境。
	* 与 renderer 端 ImaApiBridge.isStagingEnv() 保持一致：
	* 检查 endpoint URL 是否包含 "staging" 子串。
	*/
	isStagingEndpoint() {
		try {
			return (this.productManager?.getEndpoint?.() ?? "").includes("staging");
		} catch {
			return false;
		}
	}
	resolveActiveEnterpriseVariant(entry) {
		return require_tar$1.resolveActiveEnterpriseVariant(entry, this.getConnectorAccountContext());
	}
	resolveActiveAuthMode(entry) {
		return require_tar$1.resolveActiveAuthMode(entry, this.getConnectorAccountContext());
	}
	resolveTokenHeaders(configId, connectorName, accessToken) {
		const entry = this.getMarketplaceEntryById(configId) ?? this.getMarketplaceEntryByProvider(connectorName);
		const tokenHeader = this.resolveActiveEnterpriseVariant(entry)?.token_header;
		const fallbackHeaderName = this.resolveEnterpriseTokenHeaderName(entry);
		if (!tokenHeader?.name && !fallbackHeaderName) return { Authorization: `Bearer ${accessToken}` };
		const headerName = tokenHeader?.name ?? fallbackHeaderName;
		const value = (tokenHeader?.value_template || "${access_token}").replace(/\$\{access_token\}/g, accessToken);
		return { [headerName]: value };
	}
	resolveEnterpriseTokenHeaderName(entry) {
		return require_tar$1.resolveTokenHeaderName(entry, this.getConnectorAccountContext());
	}
	markIoaRuntimeServerSideAuth(configId, serverConfig) {
		const rawConfigId = this.normalizeRuntimeMcpConfigId(configId);
		const authorization = this.persistentState.headerOverrides[rawConfigId]?.Authorization;
		if (typeof authorization !== "string" || authorization.length === 0 || !this.ioaAuth?.resolveHostRule(serverConfig)) return serverConfig;
		return {
			...serverConfig,
			_workbuddyManagedAuth: "server-side"
		};
	}
	/**
	* Best-effort：把 IOA 受管 Authorization 写入加密 headerOverrides。
	* 不得抛错——写盘失败只能告警，不能把已成功的 MCP inspect 翻转为 unauthorized/error。
	*/
	async persistIoaServerSideAuthHeaders(configId, serverConfig) {
		const tokenHeaders = this.ioaAuth?.extractManagedAuthHeaders(serverConfig) ?? {};
		if (Object.keys(tokenHeaders).length === 0) return;
		const rawConfigId = this.normalizeRuntimeMcpConfigId(configId);
		try {
			const result = await this.updateHeaders(rawConfigId, tokenHeaders, true);
			if (!result.success) this.logger.warn(`[ConnectorService] persistIoaServerSideAuthHeaders(${rawConfigId}): failed to persist Authorization after successful inspect: ${result.error || "unknown error"}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.warn(`[ConnectorService] persistIoaServerSideAuthHeaders(${rawConfigId}): unexpected error after successful inspect: ${message}`);
		}
	}
	getMarketplaceEntryByProvider(providerId) {
		const manifest = this.readLocalManifest();
		if (!manifest?.connectors) return;
		return manifest.connectors.find((entry) => entry.provider_id === providerId);
	}
	/**
	* 读取 connector 的 Token 对接表单 schema（auth_mode === 'token' 时使用）。
	*
	* 文件位置：`connectors/<source>/token-schema.json`
	*
	* 返回 null 的情况：
	* - 文件不存在（非 token 模式的 connector，或配置未提供）
	* - JSON 解析失败
	* - 缺少 `fields` 数组（schema 无效）
	*/
	readTokenSchema(source) {
		const schemaPath = (0, path.join)(this.baseDir, require_tar$1.CONNECTORS_DIR, source, "token-schema.json");
		if (!(0, fs.existsSync)(schemaPath)) return null;
		try {
			const parsed = JSON.parse((0, fs.readFileSync)(schemaPath, "utf-8"));
			if (!parsed || !Array.isArray(parsed.fields) || parsed.fields.length === 0) {
				this.logger.warn(`[ConnectorService] token-schema.json for ${source} is invalid: missing or empty fields`);
				return null;
			}
			return this.localizeTokenSchema(parsed);
		} catch (err) {
			this.logger.warn(`[ConnectorService] Failed to parse token-schema.json for ${source}: ${String(err)}`);
			return null;
		}
	}
	/**
	* 按当前 locale 把 token-schema 的 `_en` 文案合并进展示字段，并剔除 `_en` 键。
	*
	* 英文环境：文案字段优先取对应的 `_en` 值，缺失时回退原字段（中文）。
	* 中文环境：直接用原字段。
	*
	* 返回的 schema 中文案字段始终是普通字符串 —— UI 层无需感知 i18n，也保证老版本
	* 客户端拿到带 `_en` 的配置时只读原字段、不会因对象类型渲染崩溃。
	*/
	localizeTokenSchema(schema) {
		const isEnglish = this.isEnglishLocale();
		const pick = (base, en) => isEnglish ? en ?? base : base;
		return {
			...schema,
			title: pick(schema.title, schema.title_en),
			title_en: void 0,
			description: pick(schema.description, schema.description_en),
			description_en: void 0,
			docLabel: pick(schema.docLabel, schema.docLabel_en),
			docLabel_en: void 0,
			fields: schema.fields.map((field) => ({
				...field,
				label: pick(field.label, field.label_en) ?? field.label,
				label_en: void 0,
				placeholder: pick(field.placeholder, field.placeholder_en),
				placeholder_en: void 0,
				description: pick(field.description, field.description_en),
				description_en: void 0
			}))
		};
	}
	readSkillConfigs(source) {
		const results = [];
		for (const dirName of ["skills", "skill"]) {
			const skillsDir = (0, path.join)(this.baseDir, require_tar$1.CONNECTORS_DIR, source, dirName);
			if (!(0, fs.existsSync)(skillsDir)) continue;
			try {
				const entries = (0, fs.readdirSync)(skillsDir);
				for (const entry of entries) if ((0, fs.statSync)((0, path.join)(skillsDir, entry)).isFile() && entry.endsWith(".md")) results.push({
					name: entry.replace(".md", ""),
					description: "",
					contentPath: `${dirName}/${entry}`
				});
			} catch {}
		}
		return results;
	}
	findConnectorIcon(source) {
		const iconsDir = (0, path.join)(this.baseDir, "icons");
		for (const ext of [".svg", ".png"]) {
			const iconPath = (0, path.join)(iconsDir, `${source}${ext}`);
			if ((0, fs.existsSync)(iconPath)) try {
				const data = (0, fs.readFileSync)(iconPath);
				return `data:${ext === ".svg" ? "image/svg+xml" : "image/png"};base64,${data.toString("base64")}`;
			} catch {
				return;
			}
		}
	}
	/**
	* 应用用户的 header/env 覆盖到 MCP 配置
	*/
	applyOverrides(configId, mcpConfig) {
		const rawConfigId = this.normalizeRuntimeMcpConfigId(configId);
		const headerOverrides = this.shouldPinArdotStaticAuthHeaders(configId) ? void 0 : this.persistentState.headerOverrides[rawConfigId];
		const envOverrides = this.persistentState.envOverrides[rawConfigId];
		if (!headerOverrides && !envOverrides) return mcpConfig;
		const expandForUrl = (s) => s.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (_, key) => {
			const val = envOverrides?.[key];
			return val !== void 0 ? encodeURIComponent(val) : "";
		});
		const expandForValue = (s) => s.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (_, key) => envOverrides?.[key] ?? "");
		const expandRecord = (record) => Object.fromEntries(Object.entries(record).map(([k, v]) => [k, typeof v === "string" ? expandForValue(v) : v]));
		const result = { mcpServers: {} };
		for (const [name, config] of Object.entries(mcpConfig.mcpServers)) {
			const mergedHeaders = {
				...config.headers,
				...headerOverrides
			};
			const mergedEnv = {
				...config.env,
				...envOverrides
			};
			result.mcpServers[name] = {
				...config,
				headers: expandRecord(mergedHeaders),
				env: expandRecord(mergedEnv),
				...config.url ? { url: expandForUrl(config.url) } : {}
			};
		}
		return result;
	}
	invalidateConnectorCredentials(configId) {
		const mcpConfig = this.readConnectorMcpConfig(configId);
		if (!mcpConfig) return;
		const mergedConfig = this.buildRuntimeMcpConfig(configId, mcpConfig);
		const firstServerConfig = Object.values(mergedConfig.mcpServers)[0];
		const serverUrl = firstServerConfig?.url;
		if (!serverUrl) return;
		this.oauthManager.invalidateCredentials(configId, serverUrl, "all", firstServerConfig.headers);
	}
	/**
	* 写入内部运行时状态（`connecting/connected/unauthorized/error/disconnected` 属于
	* connect 内部流程，不进入公共契约；`getStates()` 把它投影为 connected/reason）。
	*
	* `status === 'connected'` 是生命周期提交的统一 funnel：所有异步收尾路径
	* （doConnect 成功、OAuth 回调重连、IOA onAuthorized、CLI finalize）最终都经此
	* 提交 `bound=true, enabled=true`（受 commitConnectSuccess 的用户关闭保护）。
	*/
	updateState(configId, status, error, opts) {
		this.states.set(configId, {
			status,
			error,
			reasonCode: opts?.reasonCode
		});
		if (status !== "unauthorized") this.unauthorizedNotifyThrottle.delete(configId);
		if (status === "connected") {
			this.clearExternallyManagedStaleTokenGuard(configId);
			this.commitConnectSuccess(configId);
		}
		this.stateChangedNotifier?.({
			configId,
			status,
			error
		});
	}
	normalizeRuntimeMcpConfigId(configId) {
		return configId.startsWith("connector:") ? configId.slice(require_tar$1.CONNECTOR_PREFIX.length) : configId;
	}
	/**
	* 复核 connector 当前是否仍被期待连接。供慢路径异步回调（refreshAndSync 的 inspect
	* 回调、OAuth onAuthorized 等）在写回连接状态前调用：这些回调持有的是入口快照，
	* 网络往返 / 等待授权期间用户可能已经取消/关闭/解绑，过期写回会覆盖用户操作
	* （issue #89924）。
	*
	* 判据 = 已持久化 `bound && enabled` 或存在进行中的用户 connect 意图
	* （首次 connect 在完整成功前不写 bound/enabled，靠意图标记覆盖异步授权窗口）。
	*/
	isConnectorStillEnabled(rawConfigId) {
		return this.isEnabled(rawConfigId) || this.hasActiveConnectIntent(rawConfigId);
	}
	/**
	* 读取本地 marketplace manifest。经 `marketplaceManifestCache` 走 mtime+size 缓存
	* （原因与失效时机见该字段注释）。
	*
	* 语义与旧的裸 readFileSync 版本一致：`JsonFileCache.get` 在 statSync 失败时
	* 会先删缓存再直接调 read，`safeReadJsonFile` 对「文件不存在」和「JSON 解析失败」
	* 一律返回 null —— 等价于原来的 existsSync 前置检查 + catch 兜 null，
	* 且文件不存在时不会把 null 写进缓存。
	*/
	readLocalManifest() {
		const manifest = this.marketplaceManifestCache.get((0, path.join)(this.baseDir, require_tar$1.MANIFEST_REL_PATH));
		if (!manifest) return null;
		return this.applyTemporaryEnterpriseMarketplaceMock(manifest);
	}
	/**
	* 实现已迁移至 `./enterprise-variant::applyEnterpriseVariantConfig`。
	* 此处保留薄包装，仅用于兼容历史单测通过 `service['applyTemporaryEnterpriseMarketplaceMock']`
	* 直接调用私有方法的访问方式（见 connector-service.test.ts）。
	*/
	applyTemporaryEnterpriseMarketplaceMock(manifest) {
		return require_tar$1.applyEnterpriseVariantConfig(manifest, { endpoint: this.productManager?.getEndpoint?.() });
	}
	isLoaded() {
		return (0, fs.existsSync)((0, path.join)(this.baseDir, require_tar$1.MANIFEST_REL_PATH));
	}
	loadPersistentState() {
		const dirPath = (0, path.join)(this.configDir, "connectors", this.getUserId());
		const identityKey = this.getCurrentAccountIdentityKey();
		this.persistentStateLoadedIdentityKey = null;
		try {
			const parsed = readStates({
				userId: this.getUserId(),
				paths: resolveStatesFilePaths(dirPath),
				hasAuthEvidence: (connectorId) => this.hasLocalOAuthEvidence(connectorId)
			});
			if (!parsed) {
				this.persistentStateLoadedIdentityKey = identityKey;
				if (this.approvalsLoaded || this.pendingMcpSecurityMigration) this.migrateMcpSecurityApprovalsIfNeeded();
				return;
			}
			this.persistentState = {
				connectors: parsed.connectors ?? {},
				headerOverrides: parsed.headerOverrides ?? {},
				envOverrides: parsed.envOverrides ?? {},
				headerOverridesBearerStripped: parsed.headerOverridesBearerStripped,
				staleManagedAuthHeadersPurged: parsed.staleManagedAuthHeadersPurged,
				accountIdentityKey: parsed.accountIdentityKey,
				disabledToolsOverrides: parsed.disabledToolsOverrides ?? {},
				pluginMcpDisabledOverrides: parsed.pluginMcpDisabledOverrides ?? {},
				mcpSecurityMigrated: parsed.mcpSecurityMigrated
			};
			this.persistentStateLoadedIdentityKey = identityKey;
			let dirty = false;
			for (const configId of Object.keys(this.persistentState.headerOverrides)) {
				const hdrs = this.persistentState.headerOverrides[configId];
				for (const key of Object.keys(hdrs)) if (hdrs[key] === "") {
					delete hdrs[key];
					dirty = true;
				}
				if (Object.keys(hdrs).length === 0) delete this.persistentState.headerOverrides[configId];
			}
			if (this.stripBearerPrefixFromExternallyManagedHeaderOverrides()) dirty = true;
			if (this.purgeStaleManagedAuthHeaderOverrides()) dirty = true;
			if (dirty) this.savePersistentState();
			if (this.approvalsLoaded || this.pendingMcpSecurityMigration) this.migrateMcpSecurityApprovalsIfNeeded();
		} catch (error) {
			this.persistentStateLoadedIdentityKey = null;
			this.logger.warn(`[ConnectorService] Failed to load persistent connector state; writes remain blocked to avoid replacing the existing file with empty state. dir=${dirPath}, error=${error instanceof Error ? error.message : String(error)}`);
			this.persistentState = {
				connectors: {},
				headerOverrides: {},
				envOverrides: {},
				disabledToolsOverrides: {},
				pluginMcpDisabledOverrides: {}
			};
		}
	}
	stripBearerPrefixFromExternallyManagedHeaderOverrides() {
		if (this.persistentState.headerOverridesBearerStripped === true) return false;
		let strippedCount = 0;
		let pendingConfigCount = 0;
		for (const [configId, headers] of Object.entries(this.persistentState.headerOverrides)) {
			const authorization = headers.Authorization ?? headers.authorization;
			if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) continue;
			const serverConfig = this.getLatestServerConfigForConnector(configId);
			if (!serverConfig?.url) {
				pendingConfigCount += 1;
				continue;
			}
			try {
				const host = new URL(serverConfig.url).host;
				if (!require_tar$1.EXTERNALLY_MANAGED_HOSTS.has(host)) continue;
			} catch {
				continue;
			}
			if (headers.Authorization === authorization) headers.Authorization = authorization.slice(7);
			else headers.authorization = authorization.slice(7);
			strippedCount += 1;
		}
		if (pendingConfigCount > 0) return strippedCount > 0;
		this.persistentState.headerOverridesBearerStripped = true;
		if (strippedCount > 0) this.logger.info(`[ConnectorService] stripped Bearer prefix from ${strippedCount} externally-managed header override(s)`);
		return true;
	}
	/**
	* 清理 headerOverrides 中残留的、与当前 entry token-header 决议不一致的认证 header。
	*
	* 背景：headerOverrides[configId] 在 OAuth 刷新后会被写入 Authorization / X-Oneid-Access-Token 等
	* 认证 header；当端侧后续版本调整了 connector 的 enterprise variant 归属 / auth_mode / token_header
	* 名称（典型如本期把腾讯文档 vpc 派生从 'tencent-docs' 迁到 'tencent-docs-oa'），上一版写入的认证
	* header 不会被任何代码主动清理，applyOverrides 仍会把它们合并进 mcp.json，导致：
	*   - 老 connector 的 marketplace url 被错误注入上一版本写过的 OneID header（401 / 行为异常）
	*   - 账号切换 / 企业身份变更后旧账号的 token 仍被写入 header
	*
	* 本方法在启动时一次性运行：对每个 configId，按当前账号上下文解析"应该"使用的 token_header name，
	* 仅保留这一项（或当前活动名为 Authorization 时同时保留大小写变体），其它历史认证 header 全部删除。
	* 用 staleManagedAuthHeadersPurged boolean 防止重复执行。
	*
	* 安全性：OAuth token 是账号 + connector 维度的；当前账号下若该 connector 仍有效，下一次 refresh
	* 会自动重新写入正确的 header，因此误清不会造成认证资料丢失，最多多走一次 OAuth refresh。
	*/
	purgeStaleManagedAuthHeaderOverrides() {
		if (this.persistentState.staleManagedAuthHeadersPurged === true) return false;
		const MANAGED_AUTH_HEADER_KEYS = ["authorization", "x-oneid-access-token"];
		const ctx = this.getConnectorAccountContext();
		let purgedCount = 0;
		for (const configId of Object.keys(this.persistentState.headerOverrides)) {
			const headers = this.persistentState.headerOverrides[configId];
			const entry = this.getMarketplaceEntryById(configId);
			const activeKeyLower = require_tar$1.resolveTokenHeaderName(entry, ctx)?.toLowerCase();
			const fallbackKeepKey = entry ? activeKeyLower : "authorization";
			for (const key of Object.keys(headers)) {
				const keyLower = key.toLowerCase();
				if (!MANAGED_AUTH_HEADER_KEYS.includes(keyLower)) continue;
				if (fallbackKeepKey && keyLower === fallbackKeepKey) continue;
				delete headers[key];
				purgedCount += 1;
			}
			if (Object.keys(headers).length === 0) delete this.persistentState.headerOverrides[configId];
		}
		this.persistentState.staleManagedAuthHeadersPurged = true;
		if (purgedCount > 0) this.logger.info(`[ConnectorService] purged ${purgedCount} stale managed auth header override(s) (resolved against current account context)`);
		return true;
	}
	savePersistentState(reason = "unspecified") {
		this.runtimeRevision += 1;
		const currentIdentityKey = this.getCurrentAccountIdentityKey();
		if (this.persistentStateLoadedIdentityKey !== currentIdentityKey) {
			this.logger.warn(`[ConnectorService] Skipping persistent connector state write before current account state is loaded (reason=${reason}, current=${currentIdentityKey}, loaded=${this.persistentStateLoadedIdentityKey ?? "<none>"})`);
			return;
		}
		this.persistentState.accountIdentityKey = currentIdentityKey;
		const dirPath = (0, path.join)(this.configDir, "connectors", this.getUserId());
		writeStates({
			userId: this.getUserId(),
			paths: resolveStatesFilePaths(dirPath)
		}, this.persistentState);
	}
	/**
	* 迁移期补充绑定证据：该 connector 是否在本地 OAuth store 留有 token。
	* 仅在 v3/legacy → v4 一次性迁移时被持久化层调用；任何异常一律视为无证据。
	*/
	hasLocalOAuthEvidence(configId) {
		try {
			const serverConfig = this.getLatestServerConfigForConnector(configId);
			if (!serverConfig?.url) return false;
			return this.oauthManager.hasSavedTokens(require_tar$1.toRuntimeMcpConfigId(configId), serverConfig.url);
		} catch {
			return false;
		}
	}
	/**
	* 监听配置文件变更，触发连接对账
	*
	* 监听运行配置与插件安装指针：
	* 1. connectors/mcp.json — connector 配置变更（由 writeConnectorsMcpConfig 写入）
	* 2. mcp.json — 用户添加/移除/禁用自定义 MCP server
	* 3. settings.json — 插件启用状态
	* 4. plugins/installed_plugins.json — 当前不可变插件快照指针
	*
	* settings.json 与 installed_plugins.json 都由 Agent CLI 以「临时文件 +
	* rename」原子替换。直接 watch 文件会在首次创建时漏事件，并可能在 rename
	* 后继续绑住旧 inode，因此分别 watch configDir / plugins 目录并只接收目标
	* 文件名。这样 release/5.3.4 的 marketplace 布局在 Agent CLI 首次迁入 cache
	* 后，daemon 会立即重新对账，而不会继续使用空 registry 或回退执行可变
	* marketplace source。
	*
	* 注意：不监听 .credentials.json，因为 token 写入由本进程的 OAuthClientProvider
	* 完成，监听自身写入会导致 saveTokens → watcher → refreshAndSync → 重连 → saveTokens 循环。
	*
	* 使用 3 秒防抖，避免频繁写入时反复触发。
	*/
	watchMcpConfig() {
		const filesToWatch = [this.connectorMcpConfigPath, this.customMcpConfigPath];
		for (const filePath of filesToWatch) try {
			if (!(0, fs.existsSync)(filePath)) continue;
			const watcher = (0, fs.watch)(filePath, (_eventType, fileName) => {
				if (!isEventForWatchedFile(filePath, fileName)) return;
				this.onConfigFileChanged(filePath);
			});
			this.trackMcpConfigWatcher(watcher, filePath);
		} catch (err) {
			this.logger.warn(`[ConnectorService] Failed to watch ${filePath}: ${err}`);
		}
		const settingsPath = (0, path.join)(this.configDir, "settings.json");
		try {
			(0, fs.mkdirSync)(this.configDir, { recursive: true });
			const watcher = (0, fs.watch)(this.configDir, (_eventType, fileName) => {
				if (fileName === null || fileName === void 0 || String(fileName) === "settings.json") this.onConfigFileChanged(settingsPath);
			});
			this.trackMcpConfigWatcher(watcher, this.configDir);
		} catch (err) {
			this.logger.warn(`[ConnectorService] Failed to watch settings directory ${this.configDir}: ${err}`);
		}
		const pluginsDir = (0, path.join)(this.configDir, "plugins");
		const installedPluginsPath = (0, path.join)(pluginsDir, INSTALLED_PLUGINS_FILE_NAME);
		try {
			(0, fs.mkdirSync)(pluginsDir, { recursive: true });
			const watcher = (0, fs.watch)(pluginsDir, (_eventType, fileName) => {
				if (fileName === null || fileName === void 0 || String(fileName) === INSTALLED_PLUGINS_FILE_NAME) this.onConfigFileChanged(installedPluginsPath);
			});
			this.trackMcpConfigWatcher(watcher, pluginsDir);
		} catch (err) {
			this.logger.warn(`[ConnectorService] Failed to watch plugin registry directory ${pluginsDir}: ${err}`);
		}
		if (this.mcpConfigWatchers.length > 0) this.logger.info(`[ConnectorService] Watching MCP config inputs (${this.mcpConfigWatchers.length} watchers)`);
	}
	trackMcpConfigWatcher(watcher, watchedPath) {
		let closeRequested = false;
		const removeWatcher = () => {
			const index = this.mcpConfigWatchers.indexOf(watcher);
			if (index >= 0) this.mcpConfigWatchers.splice(index, 1);
		};
		watcher.on("error", (err) => {
			removeWatcher();
			this.logger.warn(`[ConnectorService] MCP config watcher failed for ${watchedPath}: ${String(err)}`);
			if (closeRequested) return;
			closeRequested = true;
			try {
				watcher.close();
			} catch (closeErr) {
				this.logger.warn(`[ConnectorService] close failed MCP config watcher for ${watchedPath}: ${String(closeErr)}`);
			}
		});
		watcher.on("close", () => {
			closeRequested = true;
			removeWatcher();
		});
		this.mcpConfigWatchers.push(watcher);
	}
	closeMcpConfigWatchers() {
		const watchers = this.mcpConfigWatchers.splice(0);
		for (const watcher of watchers) try {
			watcher.close();
		} catch (err) {
			this.logger.warn("[ConnectorService] close MCP config watcher failed:", err);
		}
	}
	/**
	* 配置文件变更处理（3 秒防抖）
	*/
	onConfigFileChanged(filePath) {
		if (filePath === this.connectorMcpConfigPath && Date.now() - this.lastSelfWriteConnectorMcpAt < 5e3) return;
		if (filePath === this.customMcpConfigPath && Date.now() - this.lastSelfWriteCustomMcpAt < 5e3) return;
		this.mcpJsonCache.invalidate(filePath);
		this.pluginMcpConfigsCache.invalidate();
		if (this.mcpConfigDebounceTimer) clearTimeout(this.mcpConfigDebounceTimer);
		this.mcpConfigDebounceTimer = setTimeout(() => {
			this.mcpConfigDebounceTimer = null;
			const fileName = filePath.split("/").pop() || filePath;
			this.logger.info(`[ConnectorService] Config file changed: ${fileName}, triggering refreshAndSync`);
			this.refreshAndSync().catch((err) => {
				this.logger.warn(`[ConnectorService] refreshAndSync after ${fileName} change failed:`, err);
			});
		}, 3e3);
	}
	startUpdateTimer() {
		if (this.updateTimer) return;
		this.updateTimer = setInterval(() => {
			this.syncMarketplaceForCurrentPolicy("scheduled-update").catch((error) => {
				this.logger.warn("[ConnectorService] Scheduled update failed:", error);
			});
		}, require_tar$1.UPDATE_INTERVAL_MS);
	}
	/**
	* 检查 marketplace 是否有更新
	*
	* 判定顺序（越靠前越可靠，越省流量）：
	*   1. HTTP HEAD → 取 ETag / Last-Modified，与本地保存的指纹比对；命中则跳过
	*   2. HEAD 不可用或指纹不同 → 下载完整 zip，对 zip 字节算 sha256 兜底比对
	*
	* 这样任何内容变化（包括 connector 数量不变但 mcp.json 内容变化的情况）
	* 都能被检测到。manifest 的 version/lastUpdated 字段不再作为判据，
	* 避免发布侧忘记 bump 这两个字段导致客户端误判"无更新"。
	*/
	async tryUpdate() {
		await this.syncMarketplaceForCurrentPolicy("manual-update");
	}
	async syncMarketplaceForCurrentPolicy(reason) {
		this.retryMarketplaceProductConfigurationAfterFailure(reason);
		const source = this.getMarketplaceSourceForCurrentPolicy(reason);
		if (!source) {
			this.logger.info(`[ConnectorService] Marketplace ${reason}: no source yet; productConfigState=${this.marketplaceProductConfigurationState}, cache=${this.isLoaded() ? "present" : "missing"}`);
			return;
		}
		await this.requestMarketplaceSync(source, {
			mode: this.isLoaded() ? "update" : "install",
			reason
		});
	}
	retryMarketplaceProductConfigurationAfterFailure(reason) {
		if (this.marketplaceProductConfigurationState !== "failed") return;
		this.logger.info(`[ConnectorService] Marketplace ${reason}: retrying failed cloud product configuration request`);
		this.startMarketplaceProductConfigurationResolution(`${reason}:retry`);
		this.scheduleMarketplaceSyncWhenProductReady(`${reason}:retry`);
	}
	async tryUpdateSource(source, generation) {
		try {
			const localMeta = this.readMarketplaceMeta();
			const remoteEtag = await this.fetchRemoteEtag(source.url);
			const sourceKey = this.marketplaceSourceKey(source);
			const localMetaMatchesSource = localMeta?.sourceKey === sourceKey;
			if (localMetaMatchesSource && remoteEtag && localMeta?.etag && remoteEtag === localMeta.etag) {
				this.logger.info(`[ConnectorService] Marketplace update skipped: sourceKey matched and remote ETag unchanged; source=${source.marketplaceName} -> ${require_proxy_agents.sanitizeUrlForLog(source.url)}`);
				return;
			}
			const tempDir = (0, path.join)((0, os.tmpdir)(), `connectors-marketplace-update-${process.pid}-${Date.now()}`);
			try {
				const { fingerprint } = await this.downloadAndExtractToDir(source.url, tempDir);
				if (!this.isMarketplaceSyncCurrent(source, generation)) {
					this.logger.info(`[ConnectorService] Discarding stale marketplace update before install: ${source.marketplaceName} -> ${require_proxy_agents.sanitizeUrlForLog(source.url)}`);
					return;
				}
				if (localMetaMatchesSource && localMeta?.sha256 && fingerprint.sha256 === localMeta.sha256) {
					if (remoteEtag && remoteEtag !== localMeta.etag) this.saveMarketplaceMeta({
						etag: remoteEtag,
						sha256: fingerprint.sha256,
						sourceKey
					});
					this.logger.info(`[ConnectorService] Marketplace replacement skipped: downloaded package SHA256 unchanged; source=${source.marketplaceName} -> ${require_proxy_agents.sanitizeUrlForLog(source.url)}`);
					return;
				}
				this.logger.info("[ConnectorService] Marketplace has updates, syncing...");
				if (!await this.replaceMarketplaceDir(tempDir, source.marketplaceName, {
					...fingerprint,
					sourceKey
				}, () => this.isMarketplaceSyncCurrent(source, generation))) return;
				this.writeConnectorsMcpConfig();
				this.catalogChangedNotifier?.();
				this.scheduleEnterpriseConnectorRefreshes().catch((err) => {
					this.logger.warn("[ConnectorService] scheduleEnterpriseConnectorRefreshes after marketplace update failed:", err);
				});
			} finally {
				if ((0, fs.existsSync)(tempDir)) (0, fs.rmSync)(tempDir, {
					recursive: true,
					force: true
				});
			}
		} catch (error) {
			this.logger.warn("[ConnectorService] Update check failed:", error);
		}
	}
	get marketplaceMetaPath() {
		return (0, path.join)(this.configDir, require_tar$1.MARKETPLACE_META_FILE);
	}
	readMarketplaceMeta() {
		const path$2 = this.marketplaceMetaPath;
		if (!(0, fs.existsSync)(path$2)) return null;
		try {
			const parsed = JSON.parse((0, fs.readFileSync)(path$2, "utf-8"));
			if (typeof parsed.sha256 !== "string" || !parsed.sha256) return null;
			return {
				etag: parsed.etag ?? null,
				sha256: parsed.sha256,
				sourceKey: typeof parsed.sourceKey === "string" ? parsed.sourceKey : void 0
			};
		} catch {
			return null;
		}
	}
	saveMarketplaceMeta(fingerprint) {
		try {
			(0, fs.mkdirSync)(this.configDir, { recursive: true });
			(0, fs.writeFileSync)(this.marketplaceMetaPath, JSON.stringify(fingerprint, null, 2), "utf-8");
		} catch (error) {
			this.logger.warn("[ConnectorService] Failed to persist marketplace meta:", error);
		}
	}
	/**
	* 下载完整响应体，并把响应头里的 ETag 一起返回。
	*
	* 用于 marketplace 更新检测：下载后对 buffer 算 sha256 作为兜底指纹。
	*/
	downloadBufferWithHeaders(url, redirects = 0) {
		return new Promise((resolve, reject) => {
			const request = url.startsWith("https") ? https.get : http.get;
			const agent = require_proxy_agents.getNodeAgentForUrl(url);
			const requestOptions = agent ? { agent } : {};
			const proxyDesc = require_proxy_agents.describeProxyForLog(url);
			const startedAt = Date.now();
			request(url, requestOptions, (response) => {
				if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location && redirects < 5) {
					this.downloadBufferWithHeaders(response.headers.location, redirects + 1).then(resolve, reject);
					return;
				}
				if (response.statusCode !== 200) {
					require_proxy_agents.logNetRequest({
						method: "GET",
						url,
						proxy: proxyDesc,
						status: response.statusCode,
						durationMs: Date.now() - startedAt,
						error: /* @__PURE__ */ new Error(`HTTP ${response.statusCode}`),
						source: "ConnectorService"
					});
					reject(/* @__PURE__ */ new Error(`Download failed with status ${response.statusCode}`));
					return;
				}
				const etag = normalizeEtag(response.headers["etag"]);
				const chunks = [];
				response.on("data", (chunk) => chunks.push(chunk));
				response.on("end", () => {
					require_proxy_agents.logNetRequest({
						method: "GET",
						url,
						proxy: proxyDesc,
						status: response.statusCode,
						durationMs: Date.now() - startedAt,
						source: "ConnectorService"
					});
					resolve({
						buffer: Buffer.concat(chunks),
						etag
					});
				});
				response.on("error", reject);
			}).on("error", (err) => {
				require_proxy_agents.logNetRequest({
					method: "GET",
					url,
					proxy: proxyDesc,
					durationMs: Date.now() - startedAt,
					error: err,
					source: "ConnectorService"
				});
				reject(err);
			});
		});
	}
	/**
	* 发 HTTP HEAD 请求，取 ETag 用于 marketplace 更新预检。
	*
	* 失败 / 服务端不返 ETag / 不支持 HEAD 时返回 null，上层会退化到 sha256 兜底。
	* 为了不拖慢启动，设置 5 秒超时，超时也当作"无 ETag"处理。
	*/
	fetchRemoteEtag(url, redirects = 0) {
		return new Promise((resolve) => {
			try {
				const lib = url.startsWith("https") ? https : http;
				const parsed = new URL(url);
				const agent = require_proxy_agents.getNodeAgentForUrl(url);
				const req = lib.request({
					method: "HEAD",
					protocol: parsed.protocol,
					hostname: parsed.hostname,
					port: parsed.port || void 0,
					path: parsed.pathname + parsed.search,
					headers: { "User-Agent": "WorkBuddy-ConnectorService" },
					...agent ? { agent } : {}
				}, (response) => {
					if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location && redirects < 5) {
						response.resume();
						this.fetchRemoteEtag(response.headers.location, redirects + 1).then(resolve, () => resolve(null));
						return;
					}
					if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
						response.resume();
						resolve(null);
						return;
					}
					response.resume();
					resolve(normalizeEtag(response.headers["etag"]));
				});
				req.setTimeout(5e3, () => {
					req.destroy();
					resolve(null);
				});
				req.on("error", () => resolve(null));
				req.end();
			} catch {
				resolve(null);
			}
		});
	}
	acquireLock() {
		const lockDir = this.configDir;
		const lockFile = (0, path.join)(lockDir, require_tar$1.LOCK_FILE_NAME);
		try {
			(0, fs.mkdirSync)(lockDir, { recursive: true });
			if ((0, fs.existsSync)(lockFile) && this.isLockHeldByOther(lockFile)) return false;
			(0, fs.writeFileSync)(lockFile, JSON.stringify({
				pid: process.pid,
				timestamp: Date.now()
			}), "utf-8");
			return JSON.parse((0, fs.readFileSync)(lockFile, "utf-8")).pid === process.pid;
		} catch (error) {
			this.logger.warn("[ConnectorService] acquireLock failed:", String(error));
			return false;
		}
	}
	/**
	* 仅当能证明"锁被另一个存活进程持有且未超时"时返回 true（即不可抢占）。
	* 其余一律返回 false（可抢占），并在锁文件损坏时顺手删除它。
	*
	* 三条原本会永久死锁的路径在此被各自堵住：
	*   ① 锁文件损坏/非法 JSON  → 删除损坏文件并抢占（issue #58347 主因）
	*   ② 时钟偏移/未来时间戳    → 用 Math.abs 钳制 age，超 stale 即抢占
	*   ③ 同进程重入            → 同 pid 直接放行（PID 复用 / 同应用多组件场景）
	*/
	isLockHeldByOther(lockFile) {
		let lockInfo;
		try {
			lockInfo = JSON.parse((0, fs.readFileSync)(lockFile, "utf-8"));
		} catch {
			try {
				(0, fs.rmSync)(lockFile, { force: true });
			} catch {}
			return false;
		}
		if (Math.abs(Date.now() - lockInfo.timestamp) >= 3e5) return false;
		if (lockInfo.pid === process.pid) return false;
		try {
			process.kill(lockInfo.pid, 0);
			return true;
		} catch {
			return false;
		}
	}
	releaseLock() {
		const lockFile = (0, path.join)(this.configDir, require_tar$1.LOCK_FILE_NAME);
		try {
			if (!(0, fs.existsSync)(lockFile)) return;
			let info = null;
			try {
				info = JSON.parse((0, fs.readFileSync)(lockFile, "utf-8"));
			} catch {
				info = null;
			}
			if (info === null || info.pid === process.pid) (0, fs.rmSync)(lockFile, { force: true });
		} catch {}
	}
	copyDirectory(src, dest) {
		(0, fs.mkdirSync)(dest, { recursive: true });
		const entries = (0, fs.readdirSync)(src);
		for (const entry of entries) {
			const srcPath = (0, path.join)(src, entry);
			const destPath = (0, path.join)(dest, entry);
			if ((0, fs.statSync)(srcPath).isDirectory()) this.copyDirectory(srcPath, destPath);
			else (0, fs.copyFileSync)(srcPath, destPath);
		}
	}
	isCliConnector(config) {
		return config.type === "cli";
	}
	/**
	* 启动时自动连接所有 CLI 类型 connector。
	*
	* **严格遵守持久化 `bound && enabled`**：只尝试重连用户曾主动启用过的
	* CLI connector。否则会覆盖用户的禁用意图 —— 用户上次手动禁用后，只要
	* CLI 本地仍处于"已安装且已登录"状态，就会在重启时被无条件重连，
	* 让禁用状态丢失。与 MCP / skill-only connector 的行为保持一致：
	* 持久化生命周期是真相源。
	*/
	async autoConnectCliConnectors() {
		const manifest = this.readLocalManifest();
		if (!manifest?.connectors) return;
		const cliEntries = manifest.connectors.filter((c) => c.type === "cli");
		if (cliEntries.length === 0) return;
		for (const entry of cliEntries) {
			const config = this.buildConnectorConfig(entry);
			if (!config || !config.cliConfig) continue;
			if (!this.isEnabled(config.id)) {
				this.logger.info(`[ConnectorService] CLI auto-connect skipped for ${config.id}: not enabled`);
				continue;
			}
			await this.tryAutoConnectCli(config.id, config);
		}
	}
	/**
	* 根据 configId 获取 connector 配置信息
	* 从 marketplace manifest 中查找并构建
	*/
	getConnectorConfigById(configId) {
		const manifest = this.readLocalManifest();
		if (!manifest?.connectors) return null;
		const entry = manifest.connectors.find((c) => (c.source || c.name) === configId);
		if (!entry) return null;
		return this.buildConnectorConfig(entry);
	}
	buildCliFailureResult(stage, exitCode) {
		if (exitCode === -1) {
			const unknownCodeStage = stage === "startup" ? "execution" : stage;
			return {
				success: false,
				error: this.isEnglishLocale() ? {
					install: "Connector installation failed.",
					upgrade: "Connector upgrade failed.",
					execution: "Connector execution failed."
				}[unknownCodeStage] : {
					install: "连接器安装失败。",
					upgrade: "连接器升级失败。",
					execution: "连接器执行异常。"
				}[unknownCodeStage],
				errorCode: {
					install: "CLI_INSTALL_FAILED",
					upgrade: "CLI_UPGRADE_FAILED",
					execution: "CLI_EXECUTION_FAILED"
				}[unknownCodeStage]
			};
		}
		const exitCodeText = formatExitCodeForDisplay(exitCode);
		return {
			success: false,
			error: this.isEnglishLocale() ? {
				install: `Connector installation failed (exit ${exitCodeText}).`,
				upgrade: `Connector upgrade failed (exit ${exitCodeText}).`,
				execution: `Connector execution failed (exit ${exitCodeText}).`,
				startup: `CLI failed to start (exit ${exitCodeText}).`
			}[stage] : {
				install: `连接器安装失败，退出码 ${exitCodeText}。`,
				upgrade: `连接器升级失败，退出码 ${exitCodeText}。`,
				execution: `连接器执行异常，退出码 ${exitCodeText}。`,
				startup: `CLI 启动失败，退出码 ${exitCodeText}。`
			}[stage],
			errorCode: {
				install: "CLI_INSTALL_FAILED",
				upgrade: "CLI_UPGRADE_FAILED",
				execution: "CLI_EXECUTION_FAILED",
				startup: "CLI_STARTUP_FAILED"
			}[stage]
		};
	}
	buildCliVersionTooLowResult(currentVersion, minVersion) {
		const current = currentVersion || "unknown";
		return {
			success: false,
			error: this.isEnglishLocale() ? `CLI version too low (${current} < ${minVersion}). Please upgrade manually.` : `CLI 版本过低（${current} < ${minVersion}），请手动升级。`,
			errorCode: "CLI_VERSION_TOO_LOW"
		};
	}
	async connectCli(configId, config, options = {}) {
		const pending = this.pendingCliConnects.get(configId);
		if (pending) {
			this.logger.info(`[ConnectorService] CLI Connect ${configId}: already in progress, awaiting existing flow`);
			return pending;
		}
		const promise = this.doConnectCli(configId, config, options);
		this.pendingCliConnects.set(configId, promise);
		try {
			return await promise;
		} finally {
			this.pendingCliConnects.delete(configId);
		}
	}
	async doConnectCli(configId, config, options = {}) {
		const cliConfig = config.cliConfig;
		if (!cliConfig || !this.cliExecutor) return {
			success: false,
			error: `CLI config or executor not available for connector: ${configId}`
		};
		const abortController = new AbortController();
		this.pendingCliAborts.set(configId, abortController);
		const signal = abortController.signal;
		const runtimeOptions = {
			runtimeOperationId: crypto.randomUUID(),
			connectorId: configId
		};
		const cancelledResult = () => {
			this.logger.info(`[ConnectorService] CLI ${configId}: cancelled by user`);
			this.clearConnectIntent(configId);
			this.updateState(configId, "disconnected");
			return {
				success: false,
				error: "Cancelled by user",
				cancelled: true
			};
		};
		try {
			this.logger.info(`[ConnectorService] CLI Connect ${configId}: Phase 1 - Check CLI installation`);
			this.updateState(configId, "connecting");
			const isInstalled = await this.cliExecutor.isCliInstalled(cliConfig, runtimeOptions);
			if (signal.aborted) return cancelledResult();
			if (!isInstalled) {
				this.logger.info(`[ConnectorService] CLI ${configId}: not installed, running init...`);
				const installResult = await this.cliExecutor.runInstall(cliConfig, runtimeOptions);
				if (signal.aborted) return cancelledResult();
				if (!installResult.success) {
					const result = this.buildCliFailureResult("install", installResult.exitCode);
					this.updateState(configId, "error", result.error);
					return result;
				}
				this.logger.info(`[ConnectorService] CLI ${configId}: install completed`);
			}
			if (cliConfig.versionCheck) {
				const versionResult = await this.cliExecutor.checkVersion(cliConfig, runtimeOptions);
				if (signal.aborted) return cancelledResult();
				if (versionResult.startupFailed) {
					const result = this.buildCliFailureResult("startup", versionResult.exitCode ?? -1);
					this.logger.warn(`[ConnectorService] CLI ${configId}: startup failed, exitCode=${formatExitCodeHex(versionResult.exitCode ?? 0)} (${versionResult.exitCode})`);
					this.updateState(configId, "error", result.error);
					return result;
				}
				if (versionResult.executionFailed && versionResult.exitCode !== void 0) {
					const result = this.buildCliFailureResult("execution", versionResult.exitCode);
					this.updateState(configId, "error", result.error);
					return result;
				}
				if (versionResult.needsUpgrade) {
					this.logger.info(`[ConnectorService] CLI ${configId}: version ${versionResult.currentVersion || "unknown"} < ${cliConfig.versionCheck.minVersion}, upgrading...`);
					const upgradeResult = await this.cliExecutor.runInstall(cliConfig, runtimeOptions);
					if (signal.aborted) return cancelledResult();
					if (!upgradeResult.success) {
						const result = this.buildCliFailureResult("upgrade", upgradeResult.exitCode);
						this.updateState(configId, "error", result.error);
						return result;
					}
					const recheck = await this.cliExecutor.checkVersion(cliConfig, runtimeOptions);
					if (signal.aborted) return cancelledResult();
					if (recheck.startupFailed) {
						const result = this.buildCliFailureResult("startup", recheck.exitCode ?? -1);
						this.logger.warn(`[ConnectorService] CLI ${configId}: startup failed after upgrade, exitCode=${formatExitCodeHex(recheck.exitCode ?? 0)} (${recheck.exitCode})`);
						this.updateState(configId, "error", result.error);
						return result;
					}
					if (recheck.executionFailed && recheck.exitCode !== void 0) {
						const result = this.buildCliFailureResult("execution", recheck.exitCode);
						this.updateState(configId, "error", result.error);
						return result;
					}
					if (recheck.needsUpgrade) {
						const result = this.buildCliVersionTooLowResult(recheck.currentVersion, cliConfig.versionCheck.minVersion);
						this.updateState(configId, "error", result.error);
						return result;
					}
					this.logger.info(`[ConnectorService] CLI ${configId}: upgrade completed`);
				}
			}
			this.logger.info(`[ConnectorService] CLI Connect ${configId}: Phase 2 - Check status`);
			const statusResult = await this.cliExecutor.runStatus(cliConfig, runtimeOptions);
			if (signal.aborted) return cancelledResult();
			if (statusResult.success) {
				this.logger.info(`[ConnectorService] CLI ${configId}: already authenticated`);
				return this.finalizeCliConnect(configId, config);
			}
			if (statusResult.exitCode === -1) {
				const result = this.buildCliFailureResult("execution", -1);
				this.updateState(configId, "error", result.error);
				return result;
			}
			if (classifyCliExit(statusResult.exitCode) === "startup-failed") {
				const result = this.buildCliFailureResult("startup", statusResult.exitCode);
				this.updateState(configId, "error", result.error);
				return result;
			}
			if (options.allowAuthorization === false) {
				const error = "Authorization required";
				this.updateState(configId, "unauthorized", error);
				return {
					success: false,
					error,
					needsAuth: true
				};
			}
			this.logger.info(`[ConnectorService] CLI Connect ${configId}: Phase 3 - Running auth`);
			if (!cliConfig.auth) {
				const result = this.buildCliFailureResult("execution", -1);
				this.logger.error(`[ConnectorService] No auth command configured for CLI connector: ${configId}`);
				this.updateState(configId, "error", result.error);
				return result;
			}
			const authResult = await this.cliExecutor.runAuth(cliConfig, {
				...runtimeOptions,
				onQrUrl: cliConfig.authQrModal ? (url) => {
					this.logger.info(`[ConnectorService] CLI ${configId}: pushing QR URL to renderer: ${url}`);
					this.authQrUrlPusher?.({
						configId,
						url
					});
				} : void 0,
				onDeviceCode: cliConfig.authDeviceFlow ? (info) => {
					this.logger.info(`[ConnectorService] CLI ${configId}: pushing device code to renderer: uri=${info.verificationUri} hasCode=${!!info.userCode}`);
					this.deviceCodePusher?.({
						configId,
						...info
					});
				} : void 0,
				suppressBrowser: !cliConfig.authQrModal && cliConfig.authSuppressBrowser === true
			}, signal);
			if (authResult.cancelled || signal.aborted) return cancelledResult();
			if (!authResult.success) {
				const result = authResult.exitCode !== -1 && classifyCliExit(authResult.exitCode) === "startup-failed" ? this.buildCliFailureResult("startup", authResult.exitCode) : this.buildCliFailureResult("execution", authResult.exitCode);
				this.updateState(configId, "error", result.error);
				return result;
			}
			if (authResult.authUrl) this.logger.info(`[ConnectorService] CLI ${configId}: auth URL opened, waiting for browser auth...`);
			if (cliConfig.authDeviceFlow) {
				if (authResult.success) {
					this.logger.info(`[ConnectorService] CLI ${configId}: device flow auth completed`);
					return this.finalizeCliConnect(configId, config);
				}
				const result = this.buildCliFailureResult("execution", authResult.exitCode);
				this.updateState(configId, "error", result.error);
				return result;
			}
			this.logger.info(`[ConnectorService] CLI Connect ${configId}: Phase 4 - Polling for auth completion`);
			const authCompleted = await this.cliExecutor.pollAuthCompletion(cliConfig, 300 * 1e3, 3e3, signal, runtimeOptions);
			if (signal.aborted) return cancelledResult();
			if (authCompleted) {
				this.logger.info(`[ConnectorService] CLI ${configId}: auth completed successfully`);
				return this.finalizeCliConnect(configId, config);
			} else {
				this.logger.warn(`[ConnectorService] CLI ${configId}: auth timed out`);
				const result = this.buildCliFailureResult("execution", -1);
				this.updateState(configId, "error", result.error);
				return result;
			}
		} catch (error) {
			if (signal.aborted) return cancelledResult();
			this.logger.error(`[ConnectorService] CLI Connect failed for ${configId}:`, error);
			const result = this.buildCliFailureResult("execution", -1);
			this.updateState(configId, "error", result.error);
			return result;
		} finally {
			this.pendingCliAborts.delete(configId);
		}
	}
	finalizeCliConnect(configId, config) {
		this.installSkills(configId);
		this.updateState(configId, "connected");
		this.logger.info(`[ConnectorService] CLI Connected: ${configId}`);
		return { success: true };
	}
	disconnectCli(configId, userInitiated = true) {
		try {
			this.updateState(configId, "disconnected");
			if (userInitiated) {
				this.clearConnectIntent(configId);
				this.markConnectorDisabled(configId);
			}
			this.savePersistentState();
			this.disableSkills(configId);
			this.logger.info(`[ConnectorService] CLI Disconnected: ${configId}`);
			return { success: true };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.error(`[ConnectorService] CLI Disconnect failed for ${configId}:`, error);
			return {
				success: false,
				error: message
			};
		}
	}
	/**
	* 把端侧 connector configId 解析为云端 OAuth 接口使用的 :name。
	*
	* 解析顺序：marketplace entry 的 `provider_id` → `source` → `name`，
	* 全部缺失或找不到 entry 时回退到 `configId`，保证调用链不抛异常。
	*/
	resolveOauthName(configId) {
		const rawConfigId = this.normalizeRuntimeMcpConfigId(configId);
		let oauthName;
		switch (rawConfigId) {
			case "ima-mcp":
				oauthName = require_tls_verification.getImaConnectorNameFromProduct({ applicationName: process.env.WORKBUDDY_APPLICATION_NAME?.trim() });
				break;
			case "tencent-docs-oa":
				oauthName = "tdocs-app";
				break;
			default: {
				const ioaOauthName = this.resolveIoaOauthNameByConfigId(rawConfigId);
				if (ioaOauthName) oauthName = ioaOauthName;
				else {
					const entry = this.getMarketplaceEntryById(rawConfigId);
					if (!entry) oauthName = rawConfigId;
					else if (entry.source === "ima-mcp") oauthName = require_tls_verification.getImaConnectorNameFromProduct({ applicationName: process.env.WORKBUDDY_APPLICATION_NAME?.trim() });
					else oauthName = entry.provider_id || entry.source || entry.name || rawConfigId;
				}
			}
		}
		this.logger.info(`[ConnectorService] resolveOauthName(${configId}): rawConfigId=${rawConfigId}, oauthName=${oauthName}`);
		return oauthName;
	}
	isSkillOnlyConnector(config) {
		return config.type === "skill-only";
	}
	/**
	* 对 `auth_mode === 'gateway'` 的 connector，把当前用户身份 header 注入到
	* `persistentState.headerOverrides[configId]`。
	*
	* 第三方 access_token 由 agent-gateway 从 Redis 读取并在转发时注入，
	* 端侧只负责带上识别用户身份所需的 header（Authorization Bearer + X-User-Id
	* + X-Enterprise-Id + X-Tenant-Id + X-Domain）。身份 header 由
	* `authService.buildAuthHeaders()` 统一构造，和 REST facade（`buildTdocGatewayHeaders`）
	* 走同一条标准路径，避免 IOA 企业用户漏传 X-Enterprise-Id 导致 401。
	*
	* 未登录时 `buildAuthHeaders()` 返回空对象；产品层保证未登录不会进入 connect 流程，
	* 这里仅做静默跳过，不额外守卫。
	*/
	maybeApplyGatewayIdentityHeaders(configId) {
		const entry = this.getMarketplaceEntryById(configId);
		if (!entry || this.resolveActiveAuthMode(entry) !== "gateway") return;
		const identityHeaders = this.authService.buildAuthHeaders();
		if (!identityHeaders.Authorization || !identityHeaders["X-User-Id"]) {
			this.logger.warn(`[ConnectorService] gateway connector ${configId} missing identity headers (Authorization=${!!identityHeaders.Authorization}, X-User-Id=${!!identityHeaders["X-User-Id"]}); aborting header injection`);
			return;
		}
		this.persistentState.headerOverrides[configId] = {
			...this.persistentState.headerOverrides[configId],
			...identityHeaders
		};
		this.savePersistentState();
		this.logger.info(`[ConnectorService] gateway connector ${configId}: injected identity headers (keys=${Object.keys(identityHeaders).join(",")})`);
	}
	/**
	* 构建内置 Agent Mail MCP Server 配置。
	*
	* Agent Mail 是 gateway 模式的内置 MCP Server：
	* - 不在 COS marketplace manifest 中声明（UI 不展示）
	* - 端侧只注入用户身份 header，邮箱授权由后端管理
	* - 后端 gateway 层在 MCP 调用时检查邮箱状态，非 active 返回错误码
	*
	* 返回 null 表示功能未开启或用户未登录，无法构建有效配置。
	*/
	buildAgentMailMcpConfig() {
		if (!((this.productManager?.getCurrentConfiguration?.()?.productFeatures)?.AgentMail === true)) return null;
		if (this.authService.getAccount()?.enterpriseId) {
			this.logger.info("[ConnectorService] agent-mail MCP: skipping (enterprise user)");
			return null;
		}
		const endpoint = this.productManager.getEndpoint();
		if (!endpoint) return null;
		const identityHeaders = this.authService.buildAuthHeaders();
		if (!identityHeaders.Authorization || !identityHeaders["X-User-Id"]) {
			this.logger.info("[ConnectorService] agent-mail MCP: skipping (user not logged in)");
			return null;
		}
		return {
			url: `${endpoint.replace(/\/+$/, "")}/console/agent-gateway/agentmail/mcp`,
			transport: "streamable-http",
			headers: { ...identityHeaders },
			defer_loading: true
		};
	}
	/**
	* skill-only connector 的连接流程：
	* 1. 同步确认云端有可用 token（拿不到就直接失败，避免错误地标记为已连接）
	* 2. 启动 server-side OAuth refresher（周期刷新 + 更新 MCP headers）
	* 3. 安装 skills 到 ~/.workbuddy/skills/connector-{id}/
	* 4. 完整成功后提交生命周期（bound/enabled），状态 'connected'
	*
	* 注意：授权流程本身由 renderer 的 `startServerSideOauthFlow` 负责（包含浏览器跳转）。
	* 这里假定 renderer 已经完成了授权，调用本方法时只需要同步确认 token 可用并推状态。
	*/
	async connectSkillOnly(configId, options) {
		const silent = Boolean(options?.silent);
		const abortController = new AbortController();
		this.pendingCliAborts.set(configId, abortController);
		const signal = abortController.signal;
		try {
			this.logger.info(`[ConnectorService] Skill-only Connect ${configId}: starting`);
			this.updateState(configId, "connecting");
			const entry = this.getMarketplaceEntryById(configId);
			if (entry?.auth_mode === "token") {
				const connectorConfig = this.getConnectorConfigById(configId);
				if (connectorConfig?.tokenConfig) {
					const envOverrides = this.persistentState.envOverrides[configId] || {};
					if (connectorConfig.tokenConfig.fields.find((f) => f.required && !(envOverrides[f.key]?.length > 0))) {
						this.updateState(configId, "disconnected");
						return {
							success: false,
							needsTokenConfig: true
						};
					}
				}
				this.installSkills(configId);
				this.updateState(configId, "connected");
				this.logger.info(`[ConnectorService] Skill-only (token) Connected: ${configId}`);
				return { success: true };
			}
			if (entry && this.resolveActiveAuthMode(entry) === "server-side" && this.serverSideOauthRefresher) {
				const connectorName = this.resolveOauthName(configId);
				const tokenResult = await this.serverSideOauthRefresher.tryFetchToken(connectorName);
				if (!tokenResult.ok) {
					if (tokenResult.needsAuthorize && !silent) {
						const { handled } = await this.startPublicServerSideAuth(configId, false, signal);
						if (handled) {
							this.updateState(configId, "unauthorized");
							return {
								success: false,
								error: "Authorization in progress"
							};
						}
					}
					const status = tokenResult.needsAuthorize ? "unauthorized" : "error";
					this.logger.warn(`[ConnectorService] Skill-only Connect ${configId}: token precheck failed (${tokenResult.error}), status=${status}`);
					this.updateState(configId, status, tokenResult.error);
					return {
						success: false,
						error: tokenResult.error
					};
				}
			}
			this.maybeScheduleServerSideOauth(configId);
			this.installSkills(configId);
			this.updateState(configId, "connected");
			this.logger.info(`[ConnectorService] Skill-only Connected: ${configId}`);
			return { success: true };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.error(`[ConnectorService] Skill-only Connect failed for ${configId}:`, error);
			this.updateState(configId, "error", message);
			return {
				success: false,
				error: message
			};
		} finally {
			if (this.pendingCliAborts.get(configId) === abortController) this.pendingCliAborts.delete(configId);
		}
	}
	/**
	* skill-only connector 的断开流程：停 refresher + disableSkills。
	*/
	disconnectSkillOnly(configId, userInitiated = true) {
		try {
			this.updateState(configId, "disconnected");
			if (userInitiated) {
				this.clearConnectIntent(configId);
				this.markConnectorDisabled(configId);
			}
			this.savePersistentState();
			this.disableSkills(configId);
			this.serverSideOauthRefresher?.stop(configId);
			this.logger.info(`[ConnectorService] Skill-only Disconnected: ${configId}`);
			return { success: true };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.error(`[ConnectorService] Skill-only Disconnect failed for ${configId}:`, error);
			return {
				success: false,
				error: message
			};
		}
	}
	/**
	* 连接器期望态版本号。每次 persistentState 落盘递增，供缓存层做 O(1) 失效判定。
	*
	* 会话级 MCP snapshot 会缓存已解析的 server 列表，若 key 里不含此版本号，
	* 用户在已有会话里新连的 connector 到下次新建会话前都不会生效（issue #34396 场景）。
	*/
	getRuntimeRevision() {
		return this.runtimeRevision;
	}
	/**
	* 返回所有已启用的 skill-only + auth_mode=token 连接器的 envOverrides 合集。
	*
	* sidecar / backend buildEnv 时调用，将 token 注入到 agent-cli 子进程 env。
	*/
	getSkillOnlyTokenEnv() {
		const result = {};
		for (const configId of this.getEnabledConnectorIds()) {
			const entry = this.getMarketplaceEntryById(configId);
			if (entry?.type !== "skill-only" || entry?.auth_mode !== "token") continue;
			const envs = this.persistentState.envOverrides[configId];
			if (!envs) continue;
			for (const [k, v] of Object.entries(envs)) if (typeof v === "string" && v.length > 0) result[k] = v;
		}
		return result;
	}
	/**
	* CLI 自动连接：启动时检测已安装且已认证的 CLI connector
	*/
	async tryAutoConnectCli(configId, config) {
		const cliConfig = config.cliConfig;
		if (!cliConfig || !this.cliExecutor) return;
		try {
			const silentOptions = {
				silent: true,
				connectorId: configId
			};
			if (!await this.cliExecutor.isCliInstalled(cliConfig, silentOptions)) {
				this.logger.info(`[ConnectorService] CLI auto-connect skipped for ${configId}: CLI not installed`);
				return;
			}
			if (cliConfig.versionCheck) try {
				const versionResult = await this.cliExecutor.checkVersion(cliConfig, silentOptions);
				if (versionResult.executionFailed) {
					this.logger.warn(`[ConnectorService] CLI auto-connect ${configId}: version check execution failed (exit ${versionResult.exitCode ?? "unknown"}), skipping upgrade`);
					return;
				}
				if (versionResult.needsUpgrade) {
					this.logger.info(`[ConnectorService] CLI auto-connect ${configId}: version ${versionResult.currentVersion || "unknown"} < ${cliConfig.versionCheck.minVersion}, upgrading...`);
					await this.cliExecutor.runInstall(cliConfig, silentOptions);
					const recheck = await this.cliExecutor.checkVersion(cliConfig, silentOptions);
					if (recheck.needsUpgrade) this.logger.warn(`[ConnectorService] CLI auto-connect ${configId}: upgrade failed, still ${recheck.currentVersion || "unknown"}`);
					else this.logger.info(`[ConnectorService] CLI auto-connect ${configId}: upgrade completed`);
				}
			} catch (versionError) {
				this.logger.warn(`[ConnectorService] CLI auto-connect ${configId}: versionCheck error, skipping:`, versionError);
			}
			const statusResult = await this.cliExecutor.runStatus(cliConfig, silentOptions);
			const currentState = this.states.get(configId);
			if (statusResult.success) if (currentState?.status !== "connected") {
				this.logger.info(`[ConnectorService] CLI auto-connect: ${configId} authenticated, updating to connected`);
				this.finalizeCliConnect(configId, config);
			} else this.logger.info(`[ConnectorService] CLI auto-connect: ${configId} already connected`);
			else if (currentState?.status === "connecting" || currentState?.status === "connected" || currentState?.status === "error") {
				this.logger.info(`[ConnectorService] CLI auto-connect: ${configId} not authenticated, correcting status from ${currentState.status} to disconnected`);
				this.updateState(configId, "disconnected");
			}
		} catch (error) {
			this.logger.warn(`[ConnectorService] CLI auto-connect error for ${configId}:`, error);
		}
	}
	/**
	* 从 CLI 类型的 marketplace entry 构建 ConnectorConfig
	* 读取 cli.json 替代 mcp.json
	*/
	buildCliConnectorConfig(entry, source) {
		const cliPath = (0, path.join)(this.baseDir, require_tar$1.CONNECTORS_DIR, source, "cli.json");
		if (!(0, fs.existsSync)(cliPath)) {
			this.logger.warn(`[ConnectorService] CLI config not found: ${cliPath}`);
			return null;
		}
		let cliJson;
		try {
			cliJson = JSON.parse((0, fs.readFileSync)(cliPath, "utf-8"));
		} catch (error) {
			this.logger.warn(`[ConnectorService] Failed to parse CLI config: ${cliPath}`, error);
			return null;
		}
		const iconPath = this.findConnectorIcon(source);
		const skills = this.readSkillConfigs(source);
		const examples = this.resolveLocalizedExamples(entry);
		return {
			id: source,
			name: this.resolveLocalizedName(entry),
			description: this.resolveLocalizedDescription(entry),
			icon: iconPath || "",
			type: "cli",
			providerId: entry.provider_id,
			mcpConfig: {
				url: "",
				type: "cli"
			},
			cliConfig: cliJson,
			skills,
			...entry.visible_in && entry.visible_in.length > 0 ? { visibleIn: entry.visible_in } : {},
			...examples ? { examples } : {}
		};
	}
	/**
	* 构建 skill-only connector 的 ConfigInfo。
	* 不读 mcp.json（可以不存在），不读 cli.json，仅靠 marketplace entry 的元信息 +
	* skills 目录下的内容完成连接能力。
	*/
	buildSkillOnlyConnectorConfig(entry, source) {
		const iconPath = this.findConnectorIcon(source);
		const skills = this.readSkillConfigs(source);
		const examples = this.resolveLocalizedExamples(entry);
		let tokenConfig;
		let tokenValues;
		let tokenSecretFields;
		if (entry.auth_mode === "token") {
			const schema = this.readTokenSchema(source);
			if (schema) {
				tokenConfig = schema;
				const envOverrides = this.persistentState.envOverrides[source] || {};
				tokenValues = {};
				tokenSecretFields = [];
				for (const field of schema.fields) {
					const saved = envOverrides[field.key];
					if (field.type === "password") {
						tokenValues[field.key] = "";
						if (typeof saved === "string" && saved.length > 0) tokenSecretFields.push(field.key);
					} else tokenValues[field.key] = typeof saved === "string" && saved.length > 0 ? saved : field.defaultValue ?? "";
				}
			}
		}
		return {
			id: source,
			name: this.resolveLocalizedName(entry),
			description: this.resolveLocalizedDescription(entry),
			icon: iconPath || "",
			type: "skill-only",
			authMode: this.resolveActiveAuthMode(entry),
			providerId: entry.provider_id,
			skills,
			...tokenConfig ? { tokenConfig } : {},
			...tokenValues ? { tokenValues } : {},
			...tokenSecretFields && tokenSecretFields.length > 0 ? { tokenSecretFields } : {},
			...entry.visible_in && entry.visible_in.length > 0 ? { visibleIn: entry.visible_in } : {},
			...examples ? { examples } : {}
		};
	}
	/**
	* 按当前远端产品配置状态与缓存状态取得应同步的 Marketplace source。
	*
	* - resolved：远端请求已成功完成；没有云端 URL 时 fallback 是当前权威 source。
	* - pending / failed：已有缓存时不能用 fallback 覆盖可能属于当前账号的定向包。
	* - 无缓存：任何非 resolved 状态均允许 fallback，保证首次安装可用。
	*/
	getMarketplaceSourceForCurrentPolicy(reason) {
		const hasCache = this.isLoaded();
		const allowFallback = !hasCache || this.marketplaceProductConfigurationState === "resolved";
		const allowCloud = this.marketplaceProductConfigurationState === "resolved";
		const source = this.getPreferredMarketplaceSource({
			allowFallback,
			allowCloud
		});
		this.logger.info(`[ConnectorService] Marketplace policy: reason=${reason}, productConfigState=${this.marketplaceProductConfigurationState}, cache=${hasCache ? "present" : "missing"}, allowCloud=${allowCloud}, allowFallback=${allowFallback}, selected=${source ? source.marketplaceName : "none"}`);
		return source;
	}
	/**
	* 判断当前用户是否为司内用户（IOA 登录）
	* 基于账号的 enterpriseId 判断，与 agent-ui 的 nUser 逻辑一致
	*/
	isInternalUser() {
		const session = this.authenticationManager?.currentSessionSubject?.getValue();
		return require_tar$1.isIOAEnterprise(session?.account?.enterpriseId);
	}
	/** 判断当前产品是否为海外版（product.isOversea === true） */
	isOverseaProduct() {
		return this.getCurrentProductConfiguration()?.isOversea === true;
	}
	/**
	* 获取 Connector Marketplace 配置。
	*
	* 三级优先级从高到低：
	* 1. 本地文件 {configDir}/connectors/connector-marketplace.json 中的覆盖 URL
	*    - 司内用户优先取 connectorMarketplaceInternalUrl
	*    - 兜底取 connectorMarketplaceUrl
	* 2. 云端下发的 builtInConnectorMarketplaces（ProductManager 从 /v3/config 拉取，
	*    SaaS 走 Unleash variant，私有化走 product.json ConfigMap）
	*    - 司内用户优先取 workbuddy-connector-internal，回退到 workbuddy-connector-official
	*    - 海外版/国内版复用同一个 key，通过 Unleash variant 下发不同 URL
	* 3. 硬编码兜底（司内 → 司内 COS / 海外 → 新加坡 COS / 国内司外 → 国内 CDN）
	*
	* 本地文件格式：
	* {
	*   "connectorMarketplaceUrl": "http://localhost:8080/connectors-config.zip",
	*   "connectorMarketplaceInternalUrl": "http://localhost:8080/connectors-config-internal.zip"
	* }
	*
	* `allowCloud=false` 用于远端请求 pending / failed：避免把前一个账号或上一次
	* overlay 中残留的云端 URL 当作当前账号的权威 source。
	*
	* `allowFallback=false` 用于已有缓存且远端状态未知/失败：绝不拿公共 fallback
	* 覆盖可能属于当前账号的定向缓存。
	*/
	getPreferredMarketplaceSource(options) {
		const isInternalUser = this.isInternalUser();
		const local = this.readMarketplaceConfigOverride(isInternalUser);
		if (local) {
			this.logger.info(`[ConnectorService] Using marketplace URL from local config: ${local.marketplaceName} -> ${require_proxy_agents.sanitizeUrlForLog(local.url)}`);
			return local;
		}
		if (options.allowCloud !== false) {
			const cloud = this.readCloudMarketplaceConfig(isInternalUser);
			if (cloud) {
				this.logger.info(`[ConnectorService] Using marketplace URL from cloud config: ${cloud.marketplaceName} -> ${require_proxy_agents.sanitizeUrlForLog(cloud.url)}`);
				return cloud;
			}
		}
		if (!options.allowFallback) return;
		const isOversea = this.isOverseaProduct();
		const fallback = isInternalUser ? {
			marketplaceName: require_tar$1.INTERNAL_CONNECTOR_MARKETPLACE_NAME,
			url: isOversea ? require_tar$1.OVERSEA_INTERNAL_CONNECTOR_MARKETPLACE_URL : require_tar$1.INTERNAL_CONNECTOR_MARKETPLACE_URL
		} : {
			marketplaceName: require_tar$1.DEFAULT_CONNECTOR_MARKETPLACE_NAME,
			url: isOversea ? require_tar$1.OVERSEA_CONNECTOR_MARKETPLACE_URL : require_tar$1.DEFAULT_CONNECTOR_MARKETPLACE_URL
		};
		this.logger.info(`[ConnectorService] Using marketplace URL from hardcoded fallback: ${fallback.marketplaceName} -> ${require_proxy_agents.sanitizeUrlForLog(fallback.url)} (internal=${isInternalUser}, oversea=${isOversea})`);
		return fallback;
	}
	/**
	* 从云端下发的产品配置读取 Connector Marketplace URL。
	*
	* 数据来源为 ProductManager 合并后的 `builtInConnectorMarketplaces`
	* （由 CloudProductProvider 从 <endpoint>/v3/config 拉取合并）。
	*
	* 用同步的 getCurrentConfiguration() 读快照，不 await waitConfiguration()：
	* 本方法在 syncMarketplaceContent / tryUpdate 等热路径同步调用，
	* 阻塞式等待会拖慢下载；ProductManager 配置变化会由监听器立即触发同步。
	*
	* 司内用户优先取 workbuddy-connector-internal，回退到 workbuddy-connector-official；
	* 司外用户只取 workbuddy-connector-official。任一 key 缺失或 url 为空则返回 undefined，
	* 由调用方按缓存状态决定保留缓存还是使用硬编码兜底。
	*/
	readCloudMarketplaceConfig(isInternalUser) {
		try {
			const marketplaces = this.productManager?.getCurrentConfiguration?.()?.builtInConnectorMarketplaces;
			if (!marketplaces) return;
			const candidateNames = isInternalUser ? [require_tar$1.INTERNAL_CONNECTOR_MARKETPLACE_NAME, require_tar$1.DEFAULT_CONNECTOR_MARKETPLACE_NAME] : [require_tar$1.DEFAULT_CONNECTOR_MARKETPLACE_NAME];
			for (const marketplaceName of candidateNames) {
				const item = marketplaces[marketplaceName];
				if (!item || typeof item !== "object") continue;
				const rawUrl = item.url;
				if (typeof rawUrl !== "string") continue;
				const url = rawUrl.trim();
				if (url) return {
					marketplaceName,
					url
				};
			}
			return;
		} catch (error) {
			this.logger.warn("[ConnectorService] Failed to read cloud marketplace config:", error);
			return;
		}
	}
	/**
	* 从本地配置文件读取 marketplace URL 覆盖
	* 文件路径：{configDir}/connectors/connector-marketplace.json
	* 司内用户优先取 connectorMarketplaceInternalUrl，fallback 到 connectorMarketplaceUrl
	*/
	readMarketplaceConfigOverride(isInternalUser) {
		try {
			const configPath = (0, path.join)(this.configDir, "connectors", require_tar$1.MARKETPLACE_CONFIG_FILE);
			if (!(0, fs.existsSync)(configPath)) return;
			const raw = (0, fs.readFileSync)(configPath, "utf-8");
			const config = JSON.parse(raw);
			const officialUrl = config.connectorMarketplaceUrl?.trim();
			const internalUrl = config.connectorMarketplaceInternalUrl?.trim();
			if (isInternalUser && internalUrl) return {
				marketplaceName: require_tar$1.INTERNAL_CONNECTOR_MARKETPLACE_NAME,
				url: internalUrl
			};
			return officialUrl ? {
				marketplaceName: require_tar$1.DEFAULT_CONNECTOR_MARKETPLACE_NAME,
				url: officialUrl
			} : void 0;
		} catch (error) {
			this.logger.warn("[ConnectorService] Failed to read local marketplace config:", error);
		}
	}
};
require_common$2.__decorate([(0, import_common$1.Autowired)(import_common$1.Logger), require_common$2.__decorateMetadata("design:type", typeof (_ref$7 = typeof import_common$1.Logger !== "undefined" && import_common$1.Logger) === "function" ? _ref$7 : Object)], ConnectorService.prototype, "logger", void 0);
require_common$2.__decorate([(0, import_common$1.Autowired)(require_tar$1.AuthService), require_common$2.__decorateMetadata("design:type", typeof (_ref2$4 = typeof require_tar$1.AuthService !== "undefined" && require_tar$1.AuthService) === "function" ? _ref2$4 : Object)], ConnectorService.prototype, "authService", void 0);
require_common$2.__decorate([(0, import_common$1.Autowired)(require_tar$1.RemoteMcpClientToken), require_common$2.__decorateMetadata("design:type", Object)], ConnectorService.prototype, "remoteMcpClient", void 0);
require_common$2.__decorate([(0, import_common$1.Autowired)(require_tar$1.ConnectorOAuthManagerToken), require_common$2.__decorateMetadata("design:type", Object)], ConnectorService.prototype, "oauthManager", void 0);
require_common$2.__decorate([
	(0, import_common$1.Autowired)(require_tar$1.ConnectorCliExecutorToken),
	(0, import_common$1.Optional)(),
	require_common$2.__decorateMetadata("design:type", Object)
], ConnectorService.prototype, "cliExecutor", void 0);
require_common$2.__decorate([(0, import_common$1.Autowired)(require_common$2.ProductManager), require_common$2.__decorateMetadata("design:type", typeof (_ref3$2 = typeof require_common$2.ProductManager !== "undefined" && require_common$2.ProductManager) === "function" ? _ref3$2 : Object)], ConnectorService.prototype, "productManager", void 0);
require_common$2.__decorate([(0, import_common$1.Autowired)(require_common$2.ProductEnvService), require_common$2.__decorateMetadata("design:type", Object)], ConnectorService.prototype, "productEnvService", void 0);
require_common$2.__decorate([(0, import_common$1.Autowired)(require_common$2.AuthenticationManager), require_common$2.__decorateMetadata("design:type", typeof (_ref4$2 = typeof require_common$2.AuthenticationManager !== "undefined" && require_common$2.AuthenticationManager) === "function" ? _ref4$2 : Object)], ConnectorService.prototype, "authenticationManager", void 0);
ConnectorService = _ConnectorService = require_common$2.__decorate([(0, import_common$1.Component)(require_tar$1.ConnectorServiceToken), require_common$2.__decorateMetadata("design:paramtypes", [])], ConnectorService);
/**
* 标准化 HTTP ETag：剥掉 weak 标记 `W/` 和两端的双引号，仅保留内部的 opaque 值。
*
* 不同 CDN / 代理对 ETag 的大小写和引号处理略有差异；只有剥到原始值再比较，
* 才能避免"同一个对象因为引号/大小写被误判为变更"。
*
* 空值 / 非字符串统一返回 null，由上层视为"ETag 不可用"走 sha256 兜底。
*/
function normalizeEtag(raw) {
	if (typeof raw !== "string") return null;
	let value = raw.trim();
	if (!value) return null;
	if (value.startsWith("W/")) value = value.slice(2).trim();
	if (value.startsWith("\"") && value.endsWith("\"") && value.length >= 2) value = value.slice(1, -1);
	return value.length > 0 ? value : null;
}
//#endregion
//#region ../../packages/workbuddy-server/src/connector/cli-skill/connector-python-runtime-env.ts
var execFileAsync = (0, util.promisify)(child_process.execFile);
var VENV_VERSION_MISMATCH_CODE = "PYTHON_CONNECTOR_VENV_VERSION_MISMATCH";
var PYTHON_CONNECTOR_ENV_DIR = (0, path.join)((0, os.homedir)(), ".workbuddy", "binaries", "python", "envs", "default");
var PYTHON_CONNECTOR_PIP_CACHE_DIR = (0, path.join)((0, os.homedir)(), ".workbuddy", "binaries", "python", "cli-connector-cache");
var PythonConnectorVenvVersionMismatchError = class extends Error {
	constructor(venvDir, venvVersion, versionRange) {
		super(`Python connector venv ${venvDir} uses Python ${venvVersion}, which does not satisfy runtime requirement ${versionRange}.`);
		this.venvDir = venvDir;
		this.venvVersion = venvVersion;
		this.versionRange = versionRange;
		this.code = VENV_VERSION_MISMATCH_CODE;
		this.name = "PythonConnectorVenvVersionMismatchError";
	}
};
function prependRuntimePath(env, paths) {
	const isWindows = (0, os.platform)() === "win32";
	const pathKeys = Object.keys(env).filter((key) => key.toLowerCase() === "path");
	const pathKey = isWindows ? [...pathKeys].sort()[0] ?? "Path" : "PATH";
	const existingSegments = (isWindows ? pathKeys : [pathKey]).flatMap((key) => (env[key] ?? "").split(path.delimiter));
	if (isWindows) {
		for (const key of pathKeys) if (key !== pathKey) delete env[key];
	}
	env[pathKey] = dedupePathSegments([...paths, ...existingSegments], isWindows).join(path.delimiter);
}
function dedupePathSegments(paths, isWindows) {
	const seen = /* @__PURE__ */ new Set();
	const result = [];
	for (const pathSegment of paths) {
		if (!pathSegment) continue;
		const key = normalizePathSegment(pathSegment, isWindows);
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(pathSegment);
	}
	return result;
}
function normalizePathSegment(pathSegment, isWindows) {
	const normalized = pathSegment.replace(/[\\/]+$/, "");
	return isWindows ? normalized.toLowerCase() : normalized;
}
function getVenvBinDir(venvDir) {
	return (0, os.platform)() === "win32" ? (0, path.join)(venvDir, "Scripts") : (0, path.join)(venvDir, "bin");
}
function getVenvPython(venvDir) {
	return (0, os.platform)() === "win32" ? (0, path.join)(getVenvBinDir(venvDir), "python.exe") : (0, path.join)(getVenvBinDir(venvDir), "python");
}
function satisfiesVersionRange(version, versionRange) {
	if (versionRange === "*") return true;
	return import_semver.satisfies(import_semver.coerce(version) ?? version, versionRange, { includePrerelease: true });
}
async function readVenvVersion(venvDir) {
	const pyvenvCfg = (0, path.join)(venvDir, "pyvenv.cfg");
	try {
		return (await fs.promises.readFile(pyvenvCfg, "utf8")).match(/^version\s*=\s*(\S+)/m)?.[1];
	} catch {
		return;
	}
}
async function ensureVenv(pythonExecutable, venvDir, versionRange) {
	const existingVersion = await readVenvVersion(venvDir);
	if (existingVersion) {
		if (!satisfiesVersionRange(existingVersion, versionRange)) throw new PythonConnectorVenvVersionMismatchError(venvDir, existingVersion, versionRange);
		return;
	}
	await execFileAsync(pythonExecutable, [
		"-m",
		"venv",
		venvDir
	], {
		env: {
			...process.env,
			NODE_OPTIONS: ""
		},
		timeout: 300 * 1e3,
		windowsHide: true
	});
}
async function ensurePip(venvPython) {
	const execOptions = {
		env: {
			...process.env,
			NODE_OPTIONS: ""
		},
		timeout: 120 * 1e3,
		windowsHide: true
	};
	try {
		await execFileAsync(venvPython, [
			"-m",
			"pip",
			"--version"
		], execOptions);
		return;
	} catch {
		await execFileAsync(venvPython, [
			"-m",
			"ensurepip",
			"--upgrade"
		], execOptions);
	}
}
/**
* 在传入 env 上原地注入 Python runtime 相关变量：
*
* - `PATH` 前置 `<python/envs/default/bin>:<python-bin>:<原 PATH>`
* - `VIRTUAL_ENV` 指向 WorkBuddy 默认 Python venv
* - pip / Python 隔离变量，避免污染用户系统环境
*/
function applyPythonRuntimeEnv(env, runtime) {
	prependRuntimePath(env, [runtime.venvBinDir, runtime.pythonBinDir]);
	env.VIRTUAL_ENV = runtime.venvDir;
	env.PIP_CACHE_DIR = runtime.pipCacheDir;
	env.PIP_NO_INPUT = "1";
	env.PIP_DISABLE_PIP_VERSION_CHECK = "1";
	env.PYTHONUNBUFFERED = "1";
	env.PYTHONDONTWRITEBYTECODE = "1";
}
/**
* 调 binary-manager.ensure 准备 Python，并确保默认 venv 可用。
*
* 失败时直接抛错，由上层 connector 流程展示 runtime 准备失败；binary-manager 缺失
* 场景由调用方处理，以保持 CLI / stdio 的降级语义可独立演进。
*/
async function preparePythonRuntimeEnv(binaryManager, requirement, logger, options = {}) {
	const versionRange = requirement.versionRange ?? "*";
	const notifier = createRuntimeProgressNotifier(options.operationId ?? (0, crypto.randomUUID)(), "python", versionRange, {
		silent: options.silent === true,
		send: options.send
	});
	if (binaryManager.isInstallingType("python")) notifier.preparing();
	let pythonInfo;
	try {
		pythonInfo = await binaryManager.ensure({
			type: "python",
			versionRange
		}, { onProgress: notifier.onProgress });
	} catch (err) {
		notifier.error(classifyBinaryError(err));
		throw err;
	}
	const venvDir = options.venvDir ?? PYTHON_CONNECTOR_ENV_DIR;
	const pipCacheDir = options.pipCacheDir ?? PYTHON_CONNECTOR_PIP_CACHE_DIR;
	const venvBinDir = getVenvBinDir(venvDir);
	const venvPython = getVenvPython(venvDir);
	try {
		await ensureVenv(pythonInfo.executablePath, venvDir, versionRange);
		await ensurePip(venvPython);
		notifier.complete();
	} catch (err) {
		notifier.error(classifyBinaryError(err));
		throw err;
	}
	const managedTag = pythonInfo.source === "managed" ? "[MANAGED-HIT] " : "";
	logger.info(`${managedTag}[PythonRuntimeEnv] Python runtime: source=${pythonInfo.source} version=${pythonInfo.version} python=${pythonInfo.executablePath} venv=${venvDir}`);
	return {
		pythonInfo: {
			type: pythonInfo.type,
			version: pythonInfo.version,
			source: pythonInfo.source,
			executablePath: pythonInfo.executablePath
		},
		pythonBinDir: (0, path.dirname)(pythonInfo.executablePath),
		venvDir,
		venvBinDir,
		venvPython,
		pipCacheDir
	};
}
//#endregion
//#region ../../packages/workbuddy-server/src/connector/cli-skill/connector-cli-executor.ts
/**
* CLI 命令执行器
*
* 负责执行 CLI Connector 的各种命令（init/auth/unAuth/status），
* 以及从 auth 命令输出中提取授权 URL 并打开浏览器。
*
* 从 packages/plugin-chat 迁移，适配 Electron 环境：
* - vscode.env.openExternal → shell.openExternal
*
* 安全说明：
* 此模块使用 exec/spawn + shell: true 执行命令。这些命令来自受信任的 marketplace
* 配置文件（cli.json），不包含用户输入，因此不存在命令注入风险。
* 需要 shell 特性是因为 CLI 配置中的命令可能包含管道、重定向等 shell 语法。
*/
require_client_info_env.init_src();
require_common$2.init_decorateMetadata();
require_common$2.init_decorate();
var _ref$6, _ref2$3;
var execAsync = (0, util.promisify)(child_process.exec);
/**
* Node 22.18+ 会把未传 `filter` 的 `fs.cpSync` 目录复制切到原生快路径；该路径在
* Windows 中文用户目录的 verbatim path 上可能抛 EIO。给 `cpSync` 补一个恒真的
* filter 会让 Node 使用原有 JS 递归实现。通过 data URL preload 注入，避免在用户
* 目录落一个可被篡改的临时 shim 文件。
*
* 只在已经命中特征错误后的单次重试中启用，不影响正常 connector 安装。
*/
var CP_SYNC_JS_FALLBACK_PRELOAD_SOURCE = [
	"import fs from'node:fs';",
	"const originalCpSync=fs.cpSync;",
	"fs.cpSync=(source,destination,options={})=>",
	"originalCpSync(source,destination,{...options,filter:options.filter??(()=>true)});"
].join("");
var CP_SYNC_JS_FALLBACK_NODE_OPTION = `--import=data:text/javascript;base64,${Buffer.from(CP_SYNC_JS_FALLBACK_PRELOAD_SOURCE).toString("base64")}`;
var DEFAULT_CONNECTOR_CLI_EXECUTOR_HOST_CAPABILITIES = {
	openExternal: async () => {
		throw new Error("ConnectorCliExecutor host capability openExternal is not available");
	},
	sendRuntimeProgress: () => {
		throw new Error("ConnectorCliExecutor host capability sendRuntimeProgress is not available");
	}
};
/** 简单数字段版本比较：a >= b。默认提取仍是三段式；自定义 pattern 可支持 3.1.56.1 等多段版本。 */
function semverGte(a, b) {
	const pa = a.split(".").map(Number);
	const pb = b.split(".").map(Number);
	const maxLength = Math.max(pa.length, pb.length);
	for (let i = 0; i < maxLength; i++) {
		const va = pa[i] || 0;
		const vb = pb[i] || 0;
		if (va > vb) return true;
		if (va < vb) return false;
	}
	return true;
}
/**
* 把 cli.json `env` 字段合并进 env 对象，并展开占位符：
* - `$HOME` / `${HOME}` → `os.homedir()`（跨平台，含 Windows）
*
* 该函数在 buildCommandEnv 的所有返回路径最后一步调用，优先级低于
* PATH / npm_config_* 等由端侧计算的值，高于继承的 process.env。
*/
function applyCliConfigEnv(env, configEnv) {
	if (!configEnv) return;
	const home = (0, os.homedir)();
	for (const [key, raw] of Object.entries(configEnv)) env[key] = raw.replace(/\$\{HOME\}|\$HOME/g, home);
}
var ConnectorCliExecutor = class ConnectorCliExecutor {
	constructor() {
		this.hostCapabilities = DEFAULT_CONNECTOR_CLI_EXECUTOR_HOST_CAPABILITIES;
		this.VERBATIM_PATH_EIO_USER_MESSAGE = "Windows 中文用户名兼容问题：CLI 安装脚本无法在包含非 ASCII 字符的用户目录下复制资源。已尝试兼容模式重装但仍失败，请升级到最新版本后重试或联系客服；临时可在纯英文用户名的 Windows 账户中连接。";
	}
	setHostCapabilities(capabilities) {
		this.hostCapabilities = {
			...this.hostCapabilities,
			...capabilities
		};
	}
	/**
	* 获取当前平台对应的命令
	*/
	getPlatformCommand(commands) {
		return commands[(0, os.platform)()];
	}
	/**
	* 构造 CLI 命令的执行环境。
	*
	* 基础行为（所有 connector 共享）：
	* - 继承 `process.env`
	* - 删除 `NODE_OPTIONS` / `NODE_DEBUG`（防止子进程继承调试配置，尤其是 --inspect
	*   会让 auth 命令把 inspector URL 错误地当成授权 URL）
	*
	* 如果 connector 声明了 `cliConfig.runtime.type === 'node'`，额外注入：
	* - 通过 binary-manager 的 `BinaryManager.ensure` 确保 Node.js 可用。
	*   binary-manager 内部优先复用满足版本要求的系统 Node，不满足时使用
	*   已下载的 managed Node（`~/.workbuddy/binaries/node/versions/<version>/`），
	*   都没有时从 COS 预加载源下载并安装。版本匹配由 binary-manager 处理，
	*   支持 `>=14` / `^18.0.0` / `20` / `20.x` / `*` 等写法。
	* - `PATH` 前置 `<cli-connector-packages-bin>:<node-bin>:<原 PATH>`，让 npm 刚装的
	*   全局 shim 和 Node/npm 可执行文件能被后续命令（如 `tmeet auth login`）找到。
	* - `npm_config_registry`：connector 自定义 > 默认腾讯云镜像。
	* - `npm_config_prefix`：指向 `~/.workbuddy/binaries/node/cli-connector-packages/`，
	*   让 `npm install -g` 的全局包落在 WorkBuddy 私有目录，不污染用户系统 npm global。
	*   目录与 Node 版本无关，升级 Node 版本时已装的 CLI 工具仍可用。
	* - `npm_config_cache`：指向 `~/.workbuddy/binaries/node/cli-connector-cache/`，
	*   与用户 `~/.npm` 隔离。
	*
	* 如果 connector 声明了 `cliConfig.runtime.type === 'python'`，则准备 managed Python
	* 和 WorkBuddy 默认 venv，并把 venv bin 注入 PATH，供 `pip install` 后的 CLI shim 使用。
	*
	* 未声明 runtime 字段的 connector 保持现有行为不变。
	*/
	async buildCommandEnv(cliConfig, options = {}, registry) {
		const env = { ...process.env };
		stripDebugNodeOptions(env);
		if (!cliConfig.runtime) {
			applyCliConfigEnv(env, cliConfig.env);
			return env;
		}
		if (!this.binaryManager) {
			this.logger.warn(`[CliExecutor] connector requires ${cliConfig.runtime.type} runtime but BinaryManager is not available; falling back to inherited PATH`);
			applyCliConfigEnv(env, cliConfig.env);
			return env;
		}
		switch (cliConfig.runtime.type) {
			case "node":
				applyNodeRuntimeEnv(env, await prepareNodeRuntimeEnv(this.binaryManager, {
					versionRange: cliConfig.runtime.version ?? "*",
					registry: registry ?? cliConfig.npmRegistry
				}, this.logger, {
					silent: options.silent === true,
					send: this.hostCapabilities.sendRuntimeProgress,
					operationId: options.runtimeOperationId
				}));
				break;
			case "python":
				applyPythonRuntimeEnv(env, await preparePythonRuntimeEnv(this.binaryManager, { versionRange: cliConfig.runtime.version ?? "*" }, this.logger, {
					silent: options.silent === true,
					send: this.hostCapabilities.sendRuntimeProgress,
					operationId: options.runtimeOperationId
				}));
				break;
			default: break;
		}
		applyCliConfigEnv(env, cliConfig.env);
		return env;
	}
	/**
	* 从 cli.json 的命令字符串中解析出"第一个 token"（可执行文件名），并忽略
	* 后续的参数。需要正确处理引号与反斜杠转义，避免把含空格 / 引号的路径拆坏，
	* 也防止 cli.json 被篡改时把管道、分号、命令替换等 shell 元字符混进 `which`
	* 检查命令里（shell 注入保护）。
	*
	* 支持的语法（POSIX 兼容子集，足够覆盖 cli.json 配置场景）：
	*   - 单引号：`'foo bar'` → `foo bar`（内部字面，反斜杠不转义）
	*   - 双引号：`"foo bar"` → `foo bar`（支持 `\"`、`\\` 转义）
	*   - 反斜杠：在未加引号处转义下一个字符
	*   - 空白或 shell 元字符（`|`、`;`、`&`、`>` 等）视为 token 结束
	*
	* 返回 null 表示命令非法或无法解析出可执行文件。
	*/
	extractExecutable(cmd) {
		const chars = cmd.trim();
		if (!chars) return null;
		let token = "";
		let i = 0;
		let quote = null;
		while (i < chars.length) {
			const ch = chars[i];
			if (quote === "'") {
				if (ch === "'") quote = null;
				else token += ch;
				i++;
				continue;
			}
			if (quote === "\"") {
				if (ch === "\\" && i + 1 < chars.length) {
					const next = chars[i + 1];
					if (next === "\\" || next === "\"") {
						token += next;
						i += 2;
						continue;
					}
					token += ch;
					i++;
					continue;
				}
				if (ch === "\"") {
					quote = null;
					i++;
					continue;
				}
				token += ch;
				i++;
				continue;
			}
			if (/\s/.test(ch) || "|;&<>()`$".includes(ch)) break;
			if (ch === "\\" && i + 1 < chars.length) {
				token += chars[i + 1];
				i += 2;
				continue;
			}
			if (ch === "'" || ch === "\"") {
				quote = ch;
				i++;
				continue;
			}
			token += ch;
			i++;
		}
		if (quote !== null) return null;
		return token || null;
	}
	/**
	* 对单个参数做 shell 转义，让它可以安全地拼到 `/bin/sh -c <cmd>` 字符串里。
	* 用单引号包裹，内部的单引号替换为 `'\''` 闭合+转义+再开的经典模式。
	* Windows 下 `where` 走 cmd.exe，简单用双引号包裹 + 转义双引号。
	*/
	quoteForShell(value, isWindows) {
		if (isWindows) return `"${value.replace(/"/g, "\\\"")}"`;
		return `'${value.replace(/'/g, "'\\''")}'`;
	}
	/**
	* 检查 CLI 工具是否已安装
	* 通过 which（Unix）/ where（Windows）检测
	*/
	async isCliInstalled(cliConfig, options = {}) {
		const firstAuthCmd = this.normalizeAuthSteps(cliConfig)[0]?.command;
		const statusCmd = this.getPlatformCommand(firstAuthCmd ?? {}) || this.getPlatformCommand(cliConfig.status ?? {});
		if (!statusCmd) return false;
		const executable = this.extractExecutable(statusCmd);
		if (!executable) {
			this.logger.warn(`[CliExecutor] Unable to parse executable name from command: ${statusCmd}`);
			return false;
		}
		const isWindows = (0, os.platform)() === "win32";
		const quoted = this.quoteForShell(executable, isWindows);
		const checkCmd = isWindows ? `where ${quoted}` : `which ${quoted}`;
		try {
			const env = await this.buildCommandEnv(cliConfig, options);
			this.logger.info(`[CliExecutor] isCliInstalled: platform=${(0, os.platform)()} checkCmd=${checkCmd} windowsHide=true`);
			await execAsync(checkCmd, {
				timeout: 5e3,
				env,
				windowsHide: true
			});
			return true;
		} catch (error) {
			this.logCommandFailure(checkCmd, {
				success: false,
				stdout: error.stdout ?? "",
				stderr: error.stderr ?? error.message,
				exitCode: error.code ?? -1
			}, {
				connectorId: options.connectorId,
				phase: "installation-check"
			});
			return false;
		}
	}
	/**
	* 执行安装命令（支持多源 fallback）
	*
	* 按 registry 优先级依次尝试安装；仅网络类错误（FETCH_ERROR / ETIMEDOUT / TLS 校验失败等）
	* 触发 fallback，其他错误（如包不存在）直接返回。
	*/
	async runInstall(cliConfig, options = {}) {
		const cmd = this.getPlatformCommand(cliConfig.init);
		if (!cmd) return {
			success: false,
			stdout: "",
			stderr: `No init command for platform ${(0, os.platform)()}`,
			exitCode: -1
		};
		const registries = this.resolveRegistries(cliConfig);
		const installNotifier = createConnectorInstallProgressNotifier((0, crypto.randomUUID)(), cliConfig.runtime?.type ?? "unknown", {
			silent: options.silent === true,
			send: this.sendRuntimeProgressSafely.bind(this)
		});
		let installStarted = false;
		let lastResult;
		try {
			for (let i = 0; i < registries.length; i++) {
				const registry = registries[i];
				this.logger.info(`[CliExecutor] Running install: ${cmd} (registry=${registry}, attempt ${i + 1}/${registries.length})`);
				const env = await this.buildCommandEnv(cliConfig, options, registry);
				if (!installStarted) {
					installStarted = true;
					installNotifier.start();
				}
				lastResult = await this.executeCommand(cmd, {
					timeout: 3e5,
					env,
					connectorId: options.connectorId,
					phase: "install"
				});
				if (lastResult.success) {
					installNotifier.complete();
					return lastResult;
				}
				const output = `${lastResult.stderr}\n${lastResult.stdout}`;
				if (!this.isNetworkError(output) || i === registries.length - 1) break;
				this.logger.info(`[CliExecutor] Install failed with registry ${registry}, trying next...`);
			}
		} catch (err) {
			if (installStarted) installNotifier.error(classifyBinaryError(err));
			throw err;
		}
		if (lastResult && !lastResult.success) {
			const recovered = await this.tryRecoverVerbatimPathEio(lastResult, cliConfig, options);
			if (recovered) {
				if (installStarted) if (recovered.success) installNotifier.complete();
				else installNotifier.error(this.classifyInstallFailure(recovered));
				return recovered;
			}
		}
		if (installStarted) installNotifier.error(this.classifyInstallFailure(lastResult));
		return lastResult;
	}
	classifyInstallFailure(result) {
		const output = `${result?.stderr ?? ""}\n${result?.stdout ?? ""}`.trim();
		return {
			code: output && this.isNetworkError(output) ? "network" : "generic",
			message: output || "Connector install command failed"
		};
	}
	sendRuntimeProgressSafely(channel, payload) {
		try {
			this.hostCapabilities.sendRuntimeProgress(channel, payload);
		} catch (error) {
			this.logger.warn(`[CliExecutor] sendRuntimeProgress failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	/**
	* 从 npm postinstall 的 EIO 错误串里解析出触发崩溃的目标目录路径。
	*
	* 匹配 `EIO ... '\\?\C:\Users\程\.agents\skills\dws\references'` 这种
	* Windows verbatim（`\\?\`）长路径前缀 + `.agents\skills` 目录家族的签名。
	* 命中返回去掉 `\\?\` 前缀后的真实路径（仅用于诊断日志）；不命中返回 null。
	*/
	extractVerbatimPathEioTarget(output) {
		if ((0, os.platform)() !== "win32") return null;
		const match = output.match(/EIO[^']*'(\\\\\?\\[^']*[\\/]\.agents[\\/]skills[\\/][^']*)'/i);
		if (!match) return null;
		return match[1].replace(/^\\\\\?\\/, "");
	}
	/**
	* EIO verbatim path 兜底恢复：强制 cpSync 使用 JS 递归实现后重试一次 install。
	*
	* Node 22.18+ 的 fs.cpSync 在未提供 filter 时会走原生目录复制快路径；提供恒真 filter
	* 不改变复制语义，但会回到兼容性更好的 JS 路径。preload 由 NODE_OPTIONS 传给 npm
	* 及其 postinstall Node 子进程。
	*
	* @returns 恢复成功（兼容模式重试成功）返回新结果；识别到签名但重试仍失败，返回带友好错误串的
	*   失败结果；未识别到该签名返回 null（交回原始失败结果）。
	*/
	async tryRecoverVerbatimPathEio(failed, cliConfig, options) {
		const output = `${failed.stderr}\n${failed.stdout}`;
		const target = this.extractVerbatimPathEioTarget(output);
		if (!target) return null;
		const cmd = this.getPlatformCommand(cliConfig.init);
		if (!cmd) return null;
		this.logger.warn(`[CliExecutor] Detected Windows verbatim-path EIO during install (issue #68810), retrying once with fs.cpSync JS fallback: ${target}`);
		const registry = this.resolveRegistries(cliConfig)[0];
		const env = await this.buildCommandEnv(cliConfig, options, registry);
		env.NODE_OPTIONS = [env.NODE_OPTIONS, CP_SYNC_JS_FALLBACK_NODE_OPTION].filter(Boolean).join(" ");
		const retry = await this.executeCommand(cmd, {
			timeout: 3e5,
			env,
			connectorId: options.connectorId,
			phase: "install-retry-verbatim-path-eio"
		});
		if (retry.success) {
			this.logger.info("[CliExecutor] Install succeeded with fs.cpSync JS fallback (issue #68810)");
			return retry;
		}
		this.logger.warn("[CliExecutor] Install still failed with fs.cpSync JS fallback (issue #68810)");
		return {
			...retry,
			stderr: this.VERBATIM_PATH_EIO_USER_MESSAGE
		};
	}
	/**
	* 确定 npm registry 尝试顺序。
	* 优先级：npmRegistries（多源）> npmRegistry（单源）> 内置默认列表。
	*/
	resolveRegistries(cliConfig) {
		if (cliConfig.npmRegistries?.length) return cliConfig.npmRegistries;
		if (cliConfig.npmRegistry) return [cliConfig.npmRegistry];
		return [...DEFAULT_NPM_REGISTRIES];
	}
	/**
	* 判断 npm 错误输出是否属于网络类错误（值得换源重试）。
	*/
	isNetworkError(output) {
		return [
			"FETCH_ERROR",
			"ETIMEDOUT",
			"ECONNREFUSED",
			"ENOTFOUND",
			"EAI_AGAIN",
			"ECONNRESET",
			"UNABLE_TO_VERIFY_LEAF_SIGNATURE",
			"SELF_SIGNED_CERT_IN_CHAIN",
			"DEPTH_ZERO_SELF_SIGNED_CERT",
			"UNABLE_TO_GET_ISSUER_CERT",
			"CERT_HAS_EXPIRED",
			"ERR_TLS_CERT_ALTNAME_INVALID",
			"socket hang up",
			"invalid json response body"
		].some((p) => output.includes(p));
	}
	/**
	* 把 `cliConfig.auth` 归一化为 `CliAuthStep[]`。
	*
	* - 老写法（单对象）→ 包成单步数组，继承顶层所有字段（由 resolveStepConfig 负责）
	* - 新写法（数组）→ 直接返回
	* - undefined → 返回空数组
	*
	* 该归一化让下游逻辑（runAuth 循环、isCliInstalled 取第一步 command）统一按数组处理，
	* 且对外仍然保持兼容老 cli.json 配置。
	*/
	normalizeAuthSteps(cliConfig) {
		const auth = cliConfig.auth;
		if (!auth) return [];
		if (Array.isArray(auth)) return auth;
		return [{ command: auth }];
	}
	/**
	* 把单步 auth 配置与顶层 `CliConfig` 合并，解析出本步实际生效的行为配置。
	*
	* step 显式填写的字段优先，未填则继承顶层。这样多步模式既能共用顶层默认（配置少写），
	* 又能 per-step 精细覆盖（如两步用不同的 `authUrlDomain`）。
	*/
	resolveStepConfig(step, cliConfig) {
		return {
			command: step.command,
			authWaitForExit: step.authWaitForExit ?? cliConfig.authWaitForExit,
			authUrlDomain: step.authUrlDomain ?? cliConfig.authUrlDomain,
			authSuppressBrowser: step.authSuppressBrowser ?? cliConfig.authSuppressBrowser,
			authDeviceFlow: step.authDeviceFlow ?? cliConfig.authDeviceFlow
		};
	}
	/**
	* 执行认证命令
	*
	* 支持两种写法：
	* - 单步（`cliConfig.auth` 为对象）：行为等同历史版本。
	* - 多步（`cliConfig.auth` 为 `CliAuthStep[]`）：按数组顺序依次执行每一步，
	*   每步独立 spawn + 抓 URL + 等退出，任一步失败立即返回（后续步骤不再执行）。
	*   用于需要多次浏览器授权的 CLI（如飞书 lark-cli 的 `config init --new` + `auth login`）。
	*
	* 内核逻辑（URL 监听 / `authWaitForExit` / `authUrlDomain` / `authQrModal` /
	* `authSuppressBrowser`）见 `runAuthStep`。
	*
	* 失败自愈（issue #89703）：失败输出命中 `cliConfig.authFailureCleanup.errorPattern`
	* 时说明本地缓存的授权配置已在平台侧失效（如飞书自建应用被删除、`skipIf` 又跳过了
	* 重建），此时执行 `unAuth` 清理本地配置，并默认自动重试一次完整 auth 流程。
	*/
	async runAuth(cliConfig, options = {}, signal) {
		const firstResult = await this.runAuthSteps(cliConfig, options, signal);
		if (firstResult.success || firstResult.cancelled || signal?.aborted) return firstResult;
		if (!this.shouldRunAuthFailureCleanup(cliConfig, firstResult)) return firstResult;
		this.logger.info("[CliExecutor] authFailureCleanup: auth failure matched errorPattern, running unAuth to clear stale local config");
		const unAuthResult = await this.runUnAuth(cliConfig, options);
		this.logger.info(`[CliExecutor] authFailureCleanup: unAuth finished success=${unAuthResult.success} exitCode=${unAuthResult.exitCode}`);
		if (cliConfig.authFailureCleanup?.retry === false) return firstResult;
		if (signal?.aborted) return {
			success: false,
			stdout: "",
			stderr: "Cancelled by user",
			exitCode: -1,
			cancelled: true
		};
		this.logger.info("[CliExecutor] authFailureCleanup: retrying auth once after cleanup");
		return this.runAuthSteps(cliConfig, options, signal);
	}
	/**
	* 判断本次 auth 失败是否应触发 `authFailureCleanup` 清理。
	*
	* 三个门槛缺一不可：配置了 errorPattern、配置了 unAuth（否则无从清理）、
	* 失败输出命中 errorPattern。正则非法按未配置处理（marketplace 脏数据不致命）。
	*/
	shouldRunAuthFailureCleanup(cliConfig, result) {
		const cleanup = cliConfig.authFailureCleanup;
		if (!cleanup?.errorPattern || !cliConfig.unAuth) return false;
		let pattern;
		try {
			pattern = new RegExp(cleanup.errorPattern);
		} catch {
			this.logger.warn(`[CliExecutor] authFailureCleanup: invalid errorPattern, skipping cleanup: ${cleanup.errorPattern}`);
			return false;
		}
		return pattern.test(`${result.stdout}\n${result.stderr}`);
	}
	/**
	* 依序执行全部 auth 步骤（`runAuth` 的单轮执行体，不含失败自愈）。
	*/
	async runAuthSteps(cliConfig, options = {}, signal) {
		const steps = this.normalizeAuthSteps(cliConfig);
		if (steps.length === 0) return {
			success: false,
			stdout: "",
			stderr: `No auth command for platform ${(0, os.platform)()}`,
			exitCode: -1
		};
		const env = await this.buildCommandEnv(cliConfig, options);
		let lastResult;
		for (let i = 0; i < steps.length; i++) {
			if (signal?.aborted) return {
				success: false,
				stdout: "",
				stderr: "Cancelled by user",
				exitCode: -1,
				cancelled: true
			};
			const step = steps[i];
			const effective = this.resolveStepConfig(step, cliConfig);
			const cmd = this.getPlatformCommand(effective.command);
			if (!cmd) return {
				success: false,
				stdout: "",
				stderr: `No auth command for platform ${(0, os.platform)()} at step ${i + 1}/${steps.length}`,
				exitCode: -1
			};
			if (step.skipIf) {
				const skipCmd = this.getPlatformCommand(step.skipIf);
				if (skipCmd) try {
					await execAsync(skipCmd, {
						timeout: 1e4,
						env
					});
					this.logger.info(`[CliExecutor] skipIf passed (exit 0), skipping auth step ${i + 1}/${steps.length}: ${cmd}`);
					continue;
				} catch {}
			}
			if (steps.length > 1) this.logger.info(`[CliExecutor] Running auth step ${i + 1}/${steps.length}: ${cmd}`);
			else this.logger.info(`[CliExecutor] Running auth: ${cmd}`);
			lastResult = await this.runAuthStep(cmd, env, effective, cliConfig, options, signal);
			if (!lastResult.success) return lastResult;
		}
		return lastResult;
	}
	/**
	* 执行单步认证命令（runAuth 的实际内核）。
	*
	* 使用 spawn 启动子进程，实时监听 stdout/stderr，检测到 URL 后根据模式处理：
	*
	* **默认模式**（`effective.authWaitForExit` 未设置或为 false）：
	* 检测到 URL 后立即 kill 子进程并返回，适合"URL 即入口、回调由浏览器处理"场景。
	*
	* **等待退出模式**（`effective.authWaitForExit: true`）：
	* 检测到 URL 后打开浏览器，但保持子进程运行，等待其自然退出。
	* 适合 CLI 工具在 URL 输出后继续阻塞等待扫码、扫码完成后自行写入凭证并退出的场景
	* （如 wecom-cli init --noninteractive、lark-cli 两步授权）。超时扩大为 5 分钟。
	*
	* **Device Flow 模式**（`effective.authDeviceFlow` 配置 + `options.onDeviceCode` 回调）：
	* 用 `uriPattern` / `codePattern` 解析 stdout/stderr 中的 verification URL 和 user code，
	* 通过 `options.onDeviceCode` 推送给调用方。强制走"等待退出"行为：CLI 子进程保持存活
	* 直到自身完成 token 轮询并退出（exit 0 = 成功，非 0 = 失败/取消）。
	* 用户主动取消通过 `signal` AbortSignal 传入（与普通 connect 取消复用同一通道）。
	*
	* QR 弹窗（`cliConfig.authQrModal`）仅在单步模式下生效；调用方通过 `options.onQrUrl`
	* 传入才会走该分支。
	*/
	async runAuthStep(cmd, env, effective, cliConfig, options, signal) {
		const deviceFlowEnabled = !!(effective.authDeviceFlow && options.onDeviceCode);
		const tmeetAuthWaitForExit = effective.authWaitForExit === void 0 && /(?:^|[\\/"'])tmeet(?:\.cmd)?(?:["']?\s+)auth\s+login(?:\s|$)/i.test(cmd);
		const waitForExit = effective.authWaitForExit === true || deviceFlowEnabled || tmeetAuthWaitForExit;
		const timeoutMs = waitForExit ? 300 * 1e3 : 1e4;
		return new Promise((resolve) => {
			let resolved = false;
			let urlOpened = false;
			let deviceCodeReported = false;
			if (signal?.aborted) {
				resolve({
					success: false,
					stdout: "",
					stderr: "Cancelled by user",
					exitCode: -1,
					cancelled: true
				});
				return;
			}
			this.logger.info(`[CliExecutor] runAuth spawn: platform=${(0, os.platform)()} cmd=${cmd} shell=true windowsHide=true deviceFlow=${deviceFlowEnabled}`);
			const child = (0, child_process.spawn)(cmd, {
				shell: true,
				timeout: timeoutMs,
				env,
				windowsHide: true
			});
			let stdout = "";
			let stderr = "";
			const onAbort = () => {
				if (resolved) return;
				resolved = true;
				this.logger.info(`[CliExecutor] runAuth aborted by user, terminating child process tree pid=${child.pid}`);
				this.terminateAuthProcess(child);
				resolve({
					success: false,
					stdout,
					stderr,
					exitCode: -1,
					cancelled: true
				});
			};
			signal?.addEventListener("abort", onAbort, { once: true });
			const cleanupAbortListener = () => signal?.removeEventListener("abort", onAbort);
			const authUrlDomain = effective.authUrlDomain;
			const deviceFlowConfig = effective.authDeviceFlow;
			const tryHandleDeviceFlow = (text, source) => {
				if (deviceCodeReported || !deviceFlowConfig || !options.onDeviceCode) return;
				const info = this.extractDeviceFlowInfo(text, deviceFlowConfig);
				if (!info) return;
				deviceCodeReported = true;
				this.logger.info(`[CliExecutor] Device flow info found in ${source}: uri=${info.verificationUri} hasCode=${!!info.userCode}`);
				options.onDeviceCode(info);
				if (!(effective.authSuppressBrowser === true || options.suppressBrowser)) Promise.resolve(this.hostCapabilities.openExternal(info.verificationUri)).catch((error) => {
					this.logger.warn(`[CliExecutor] Failed to open device flow URL: ${error instanceof Error ? error.message : String(error)}`);
				});
			};
			const tryHandleUrl = (text, source) => {
				if (urlOpened) return;
				if (deviceFlowEnabled) return;
				const url = this.extractAuthUrl(text, authUrlDomain);
				if (!url) return;
				urlOpened = true;
				this.logger.info(`[CliExecutor] Auth URL found in ${source}: ${url}`);
				if (options.onQrUrl) options.onQrUrl(url);
				else if (effective.authSuppressBrowser === true || options.suppressBrowser) {} else Promise.resolve(this.hostCapabilities.openExternal(url)).catch((error) => {
					this.logger.warn(`[CliExecutor] Failed to open auth URL: ${error instanceof Error ? error.message : String(error)}`);
				});
				if (!waitForExit) {
					resolved = true;
					cleanupAbortListener();
					this.terminateAuthProcess(child);
					resolve({
						success: true,
						stdout,
						stderr,
						exitCode: 0,
						authUrl: url
					});
				}
			};
			child.stdout?.on("data", (data) => {
				stdout += data.toString();
				tryHandleDeviceFlow(stdout, "stdout");
				tryHandleUrl(stdout, "stdout");
			});
			child.stderr?.on("data", (data) => {
				stderr += data.toString();
				tryHandleDeviceFlow(stderr, "stderr");
				tryHandleUrl(stderr, "stderr");
			});
			child.on("close", (code) => {
				if (!resolved) {
					resolved = true;
					cleanupAbortListener();
					const result = {
						success: code === 0,
						stdout,
						stderr,
						exitCode: code ?? -1,
						authUrl: urlOpened ? this.extractAuthUrl(stdout + stderr, authUrlDomain) : void 0
					};
					if (!result.success) this.logCommandFailure(cmd, result, {
						connectorId: options.connectorId,
						phase: "auth"
					});
					resolve(result);
				}
			});
			child.on("error", (error) => {
				if (!resolved) {
					resolved = true;
					cleanupAbortListener();
					const result = {
						success: false,
						stdout,
						stderr: error.message,
						exitCode: -1
					};
					this.logCommandFailure(cmd, result, {
						connectorId: options.connectorId,
						phase: "auth"
					});
					resolve(result);
				}
			});
		});
	}
	terminateAuthProcess(child) {
		if (process.platform === "win32" && child.pid) {
			(0, child_process.spawn)("taskkill", [
				"/pid",
				String(child.pid),
				"/T",
				"/F"
			], {
				env: {
					...process.env,
					NODE_OPTIONS: ""
				},
				windowsHide: true,
				stdio: "ignore"
			}).on("error", (error) => {
				this.logger.warn(`[CliExecutor] taskkill failed for pid=${child.pid}: ${error instanceof Error ? error.message : String(error)}`);
				try {
					child.kill();
				} catch {}
			});
			return;
		}
		try {
			child.kill();
		} catch {}
	}
	/**
	* 执行状态检查命令
	*
	* 以 exit code === 0 判断是否已连接。
	* 若 cliConfig.statusMatch 存在，还需匹配 stdout 内容。
	*/
	async runStatus(cliConfig, options = {}) {
		const cmd = this.getPlatformCommand(cliConfig.status ?? {});
		if (!cmd) return {
			success: false,
			stdout: "",
			stderr: `No status command for platform ${(0, os.platform)()}`,
			exitCode: -1
		};
		const env = await this.buildCommandEnv(cliConfig, options);
		const result = await this.executeCommand(cmd, {
			timeout: 1e4,
			env,
			connectorId: options.connectorId,
			phase: "status",
			suppressFailureLog: options.suppressFailureLog
		});
		if (result.exitCode === 0 && cliConfig.statusMatchJson) try {
			const parsed = JSON.parse(result.stdout);
			result.success = Object.entries(cliConfig.statusMatchJson).every(([key, expected]) => String(parsed[key]) === expected);
			this.logger.info(`[CliExecutor] runStatus: statusMatchJson=${JSON.stringify(cliConfig.statusMatchJson)}, matched=${result.success}`);
		} catch {
			result.success = false;
			this.logger.info("[CliExecutor] runStatus: statusMatchJson parse failed, matched=false");
		}
		else if (result.exitCode === 0 && cliConfig.statusMatch) {
			const regex = new RegExp(cliConfig.statusMatch);
			const combinedOutput = result.stdout + result.stderr;
			result.success = regex.test(combinedOutput);
			this.logger.info(`[CliExecutor] runStatus: statusMatch="${cliConfig.statusMatch}", matched=${result.success}`);
		}
		return result;
	}
	/**
	* 检查 CLI 版本是否满足最低要求。
	*
	* 跑 `versionCheck.command`，用正则提取版本号，semver 比较 >= minVersion。
	* 无 versionCheck 配置时直接返回 `{ needsUpgrade: false }`。
	*
	* 退出码非 0 时通过 `classifyCliExit` 区分（issue #67596）：
	* - CLI 进程真跑起来了但 exit≠0 → `executionFailed: true`，上层展示执行异常，不再误触发升级。
	* - Windows 系统级启动失败（如 0xC0000135 DLL 缺失）/ 被 EDR 杀 / 命令没找到 →
	*   `startupFailed: true`，上层不再 auto-upgrade（对启动失败 100% 无效），转诊断向错误。
	*/
	async checkVersion(cliConfig, options = {}) {
		const check = cliConfig.versionCheck;
		if (!check) return { needsUpgrade: false };
		const cmd = this.getPlatformCommand(check.command);
		if (!cmd) return { needsUpgrade: false };
		const env = await this.buildCommandEnv(cliConfig, options);
		try {
			const result = await this.executeCommand(cmd, {
				timeout: 1e4,
				env,
				connectorId: options.connectorId,
				phase: "version-check"
			});
			if (result.exitCode !== 0) {
				if (classifyCliExit(result.exitCode) === "startup-failed") {
					this.logger.warn(`[CliExecutor] checkVersion: CLI startup failed cmd=${cmd} exitCode=${formatExitCodeHex(result.exitCode)} (${result.exitCode}) stderr=${result.stderr.slice(0, 200)}`);
					return {
						needsUpgrade: false,
						executionFailed: true,
						startupFailed: true,
						exitCode: result.exitCode
					};
				}
				this.logger.info(`[CliExecutor] checkVersion: command exited ${result.exitCode}, treating as execution failure`);
				return {
					needsUpgrade: false,
					executionFailed: true,
					exitCode: result.exitCode
				};
			}
			const pattern = new RegExp(check.versionPattern || "(\\d+\\.\\d+\\.\\d+)");
			const match = result.stdout.match(pattern) || result.stderr.match(pattern);
			if (!match?.[1]) {
				this.logger.info("[CliExecutor] checkVersion: could not extract version from output");
				return { needsUpgrade: true };
			}
			const currentVersion = match[1];
			const needsUpgrade = !semverGte(currentVersion, check.minVersion);
			this.logger.info(`[CliExecutor] checkVersion: current=${currentVersion}, min=${check.minVersion}, needsUpgrade=${needsUpgrade}`);
			return {
				needsUpgrade,
				currentVersion
			};
		} catch (err) {
			this.logger.warn("[CliExecutor] checkVersion failed:", err);
			return {
				needsUpgrade: false,
				executionFailed: true,
				exitCode: -1
			};
		}
	}
	/**
	* 执行取消认证命令
	*/
	async runUnAuth(cliConfig, options = {}) {
		const cmd = this.getPlatformCommand(cliConfig.unAuth ?? {});
		if (!cmd) return {
			success: false,
			stdout: "",
			stderr: `No unAuth command for platform ${(0, os.platform)()}`,
			exitCode: -1
		};
		this.logger.info(`[CliExecutor] Running unAuth: ${cmd}`);
		const env = await this.buildCommandEnv(cliConfig, options);
		return this.executeCommand(cmd, {
			timeout: 3e4,
			env,
			connectorId: options.connectorId,
			phase: "unauth"
		});
	}
	/**
	* 轮询 status 命令等待认证完成
	*
	* @param cliConfig CLI 配置
	* @param timeoutMs 最大等待时间（默认 5 分钟）
	* @param pollIntervalMs 轮询间隔（默认 3 秒）
	* @param signal 用户主动取消信号；abort 后立即中断 sleep 并退出循环（不等下个 poll 周期）
	* @returns true 如果认证成功；false 如果超时或被取消
	*/
	async pollAuthCompletion(cliConfig, timeoutMs = 300 * 1e3, pollIntervalMs = 3e3, signal, options = {}) {
		const startTime = Date.now();
		while (Date.now() - startTime < timeoutMs && !signal?.aborted) {
			await new Promise((resolve) => {
				const t = setTimeout(resolve, pollIntervalMs);
				const onAbort = () => {
					clearTimeout(t);
					resolve();
				};
				signal?.addEventListener("abort", onAbort, { once: true });
			});
			if (signal?.aborted) {
				this.logger.info("[CliExecutor] Auth polling cancelled by user");
				return false;
			}
			if ((await this.runStatus(cliConfig, {
				...options,
				suppressFailureLog: true
			})).success) {
				this.logger.info(`[CliExecutor] Auth completed (took ${Date.now() - startTime}ms)`);
				return true;
			}
		}
		if (signal?.aborted) {
			this.logger.info("[CliExecutor] Auth polling cancelled by user");
			return false;
		}
		this.logger.warn(`[CliExecutor] Auth polling timed out after ${timeoutMs}ms`);
		return false;
	}
	/**
	* 从文本中提取认证 URL
	*
	* @param text 命令输出文本（stdout 或 stderr）
	* @param authUrlDomain 认证 URL 的匹配域名（来自 cli.json 的 authUrlDomain 字段）
	*   若提供，只有包含该域名的 URL 才会被提取
	*   若不提供，提取第一个 https URL
	*/
	extractAuthUrl(text, authUrlDomain) {
		const urlRegex = /https?:\/\/[^\s\n\r"'<>]+/g;
		let match;
		while ((match = urlRegex.exec(text)) !== null) {
			const url = match[0];
			if (authUrlDomain) {
				if (url.includes(authUrlDomain)) return url;
			} else if (url.startsWith("https://")) return url;
		}
	}
	/**
	* 从文本中按 Device Flow 配置提取 verification URL 与可选 user_code。
	*
	* 优先取正则的第一个捕获组（`match[1]`），无捕获组时退回整个匹配（`match[0]`）。
	* URL 必须命中才返回，code 命中失败时仅 URL 部分有效。
	*/
	extractDeviceFlowInfo(text, config) {
		let uri;
		try {
			const uriRe = new RegExp(config.uriPattern);
			const m = text.match(uriRe);
			if (m) uri = (m[1] ?? m[0])?.trim();
		} catch (err) {
			this.logger.warn(`[CliExecutor] device flow uriPattern invalid: ${String(err)}`);
		}
		if (!uri) return;
		let code;
		if (config.codePattern) try {
			const codeRe = new RegExp(config.codePattern);
			const m = text.match(codeRe);
			if (m) code = (m[1] ?? m[0])?.trim();
		} catch (err) {
			this.logger.warn(`[CliExecutor] device flow codePattern invalid: ${String(err)}`);
		}
		return {
			verificationUri: uri,
			userCode: code,
			expiresIn: config.defaultExpiresInSeconds,
			codeEmbeddedInUri: config.codeEmbeddedInUri
		};
	}
	/**
	* 执行命令并返回结果
	*
	* `options.env` 优先使用调用方传入的（通常来自 `buildCommandEnv`）；
	* 未传时回退到"继承 process.env 并清 NODE_OPTIONS/NODE_DEBUG"的老行为，
	* 保证本方法独立调用（如测试）时也不会泄漏调试配置。
	*/
	async executeCommand(cmd, options = {}) {
		const env = options.env ?? (() => {
			const fallback = { ...process.env };
			delete fallback.NODE_OPTIONS;
			delete fallback.NODE_DEBUG;
			return fallback;
		})();
		try {
			this.logger.info(`[CliExecutor] executeCommand: platform=${(0, os.platform)()} cmd=${cmd} windowsHide=true`);
			const { stdout, stderr } = await execAsync(cmd, {
				timeout: options.timeout ?? 3e4,
				env,
				windowsHide: true
			});
			return {
				success: true,
				stdout,
				stderr,
				exitCode: 0
			};
		} catch (error) {
			const result = {
				success: false,
				stdout: error.stdout ?? "",
				stderr: error.stderr ?? error.message,
				exitCode: typeof error.code === "number" ? error.code : -1
			};
			if (!options.suppressFailureLog) this.logCommandFailure(cmd, result, options);
			return result;
		}
	}
	/**
	* CLI 子进程失败时，必须把命令原始 stdout/stderr 完整写入主线程日志。
	*
	* 业务层可继续根据 exit code 做“升级/未登录/启动失败”等分类，但不得替代这份
	* 原始执行证据；否则问题现场只会留下分类后的猜测，无法还原 CLI 真正报错。
	*/
	logCommandFailure(cmd, result, context) {
		this.logger.error(`[ConnectorCliCommandFailed]
connector=${context.connectorId ?? "unknown"}\nphase=${context.phase ?? "unknown"}\ncommand=${cmd}\nexitCode=${result.exitCode}\n--- stdout begin ---
${result.stdout}\n--- stdout end ---
--- stderr begin ---
${result.stderr}\n--- stderr end ---`);
	}
};
require_common$2.__decorate([(0, import_common$1.Autowired)(import_common$1.Logger), require_common$2.__decorateMetadata("design:type", typeof (_ref$6 = typeof import_common$1.Logger !== "undefined" && import_common$1.Logger) === "function" ? _ref$6 : Object)], ConnectorCliExecutor.prototype, "logger", void 0);
require_common$2.__decorate([
	(0, import_common$1.Autowired)(require_client_info_env.BinaryManager),
	(0, import_common$1.Optional)(),
	require_common$2.__decorateMetadata("design:type", typeof (_ref2$3 = typeof require_client_info_env.BinaryManager !== "undefined" && require_client_info_env.BinaryManager) === "function" ? _ref2$3 : Object)
], ConnectorCliExecutor.prototype, "binaryManager", void 0);
ConnectorCliExecutor = require_common$2.__decorate([(0, import_common$1.Component)(require_tar$1.ConnectorCliExecutorToken)], ConnectorCliExecutor);
//#endregion
//#region ../../packages/workbuddy-server/src/connector/connector-ui-adapter.ts
/**
* Connector UI 适配器
*
* 在 ConnectorService 标准接口之上，适配 UI 的动作语义：
* - connect()：未绑定时允许首次授权；已绑定时仅静默复用凭据
* - repairConnect()：用户主动修复，允许重新授权并等待回调
* - getStates() 仅在 OAuth 仍处于 pending 时映射 unauthorized → connecting
* - 授权取消/失败后保留 enabled，原样暴露 unauthorized/error
*
* ConnectorService 保持标准语义（调一次返回一次结果），
* UI 的异步等待逻辑全部在这里处理。
*/
require_common$2.init_decorateMetadata();
require_common$2.init_decorate();
var _ref$5, _ConnectorUiAdapter;
var ConnectorUiAdapter = class ConnectorUiAdapter {
	static {
		_ConnectorUiAdapter = this;
	}
	static {
		this.OAUTH_TIMEOUT_MS = 300 * 1e3;
	}
	static {
		this.CANCELLED_OAUTH_TTL_MS = 120 * 1e3;
	}
	static {
		this.OAUTH_FALLBACK_CLEAN_THRESHOLD_MS = 60 * 1e3;
	}
	constructor() {
		this.pendingOAuth = /* @__PURE__ */ new Set();
		this.processingOAuth = /* @__PURE__ */ new Set();
		this.reconnectMcpServerPromises = /* @__PURE__ */ new Map();
		this.pendingOAuthTimeouts = /* @__PURE__ */ new Map();
		this.pendingOAuthStartedAt = /* @__PURE__ */ new Map();
		this.cancelledOAuth = /* @__PURE__ */ new Map();
		setTimeout(() => this.registerOAuthListener(), 0);
	}
	registerOAuthListener() {
		this.oauthManager.onCompleted((result) => {
			const configId = result.configId;
			if (!configId) {
				this.cleanupStalePendingOAuth();
				return;
			}
			this.logger.info(`[ConnectorUiAdapter] OAuth completed for ${configId}, success=${result.success}`);
			if (!this.pendingOAuth.has(configId)) {
				this.logger.info(`[ConnectorUiAdapter] OAuth completed for ${configId} but not in pendingOAuth, ignoring`);
				return;
			}
			if (!result.success) {
				const rawId = require_tar$1.toRawConfigId(configId);
				this.connectorService.markOAuthFailed(rawId, result.error ?? "access_denied");
				this.pendingOAuth.delete(configId);
				this.processingOAuth.delete(configId);
				this.clearOAuthTimeout(configId);
				return;
			}
			if (this.isOAuthCancelled(configId)) {
				this.logger.info(`[ConnectorUiAdapter] OAuth completed for ${configId} but user cancelled, skipping reconnect`);
				this.clearOAuthCancelled(configId);
				this.pendingOAuth.delete(configId);
				this.processingOAuth.delete(configId);
				this.clearOAuthTimeout(configId);
				return;
			}
			if (this.processingOAuth.has(configId)) return;
			this.processingOAuth.add(configId);
			const serviceConfigId = require_tar$1.toRawConfigId(configId);
			(configId.startsWith("custom-mcp:") ? this.connectorService.reconnectMcpServer(configId.slice(11), { skipClearClientInfo: true }).then(() => ({ success: true })) : this.connectorService.connect(serviceConfigId, {
				skipClearClientInfo: true,
				silent: true
			})).then((result) => {
				if (this.isOAuthCancelled(configId)) {
					this.logger.info(`[ConnectorUiAdapter] OAuth reconnect ${configId} finished but user cancelled meanwhile, ignoring this attempt`);
					this.clearOAuthCancelled(configId);
					this.pendingOAuth.delete(configId);
					this.processingOAuth.delete(configId);
					this.clearOAuthTimeout(configId);
					return;
				}
				if (result.success) this.logger.info(`[ConnectorUiAdapter] OAuth reconnect ${configId}: success`);
				else this.logger.warn(`[ConnectorUiAdapter] OAuth reconnect ${configId} failed: ${result.error}`);
				this.pendingOAuth.delete(configId);
				this.processingOAuth.delete(configId);
				this.clearOAuthTimeout(configId);
			}).catch((err) => {
				this.logger.error(`[ConnectorUiAdapter] OAuth reconnect ${configId} failed:`, err);
				this.pendingOAuth.delete(configId);
				this.processingOAuth.delete(configId);
				this.clearOAuthTimeout(configId);
			});
		});
	}
	/**
	* UI 发起连接
	*
	* 流程：
	* 1. 调 service.connect() 尝试连接
	* 2. 如果成功（本地凭据仍有效、MCP 握手成功）→ 直接返回 success（= 真已连接）
	* 3. 如果 needsTokenConfig → 直接交给 Token 配置表单处理
	* 4. 如果 needsAuth → 加入 pendingOAuth，返回 { success:false, needsAuth:true }
	*    （连接尚未建立、浏览器授权页刚弹出；UI 保持 connecting 并提示「正在跳转授权」，
	*    真正 connected 由 OAuth 回调后的 WB_CONNECTOR_STATE_CHANGE 收敛）
	* 5. 如果其他错误 → 返回 error
	*
	* OAuth 完成后，proxyServer 的回调触发重连，UI 下次轮询 getStates() 就能看到 connected。
	*
	* ⚠️ 契约：这里的 success 只表示「已连接」，绝不能用它表示「已发起授权」。
	* 五态映射（mapDesktopConnectResult）会把 success 一律翻译成 status:'connected'，
	* 若在 OAuth 待授权时返回 success，renderer 会把「授权页刚弹出」误判为「已连接」提前弹 toast。
	*/
	async connect(configId) {
		const state = (await this.connectorService.getStates())?.[configId];
		return this.runConnect(configId, state?.bound !== true);
	}
	async repairConnect(configId) {
		const runtimeConfigId = require_tar$1.toRuntimeMcpConfigId(configId);
		if (this.pendingOAuth.has(runtimeConfigId)) {
			this.logger.info(`[ConnectorUiAdapter] repairConnect(${configId}): JOIN pending OAuth`);
			return {
				success: false,
				needsAuth: true
			};
		}
		return this.runConnect(configId, true);
	}
	async runConnect(configId, allowAuthorization) {
		const silent = !allowAuthorization;
		const runtimeConfigId = require_tar$1.toRuntimeMcpConfigId(configId);
		this.logger.info(`[ConnectorUiAdapter] connect(${configId}): START allowAuthorization=${allowAuthorization}`);
		this.clearOAuthCancelled(runtimeConfigId);
		const preRegisteredOAuth = allowAuthorization && !this.pendingOAuth.has(runtimeConfigId);
		if (preRegisteredOAuth) this.pendingOAuth.add(runtimeConfigId);
		let result;
		try {
			result = await this.connectorService.connect(configId, {
				silent,
				userInitiated: true
			});
		} catch (error) {
			if (preRegisteredOAuth) this.pendingOAuth.delete(runtimeConfigId);
			throw error;
		}
		if (result.success) {
			this.logger.info(`[ConnectorUiAdapter] connect(${configId}): SUCCESS — clearing pending oauth state`);
			this.pendingOAuth.delete(runtimeConfigId);
			this.processingOAuth.delete(runtimeConfigId);
			this.clearOAuthTimeout(runtimeConfigId);
			return result;
		}
		if (result.cancelled) {
			this.logger.info(`[ConnectorUiAdapter] connect(${configId}): CANCELLED — preserving cancelled result`);
			this.pendingOAuth.delete(runtimeConfigId);
			this.processingOAuth.delete(runtimeConfigId);
			this.clearOAuthTimeout(runtimeConfigId);
			return result;
		}
		if (result.needsTokenConfig !== void 0) {
			this.logger.info(`[ConnectorUiAdapter] connect(${configId}): NEEDS_TOKEN_CONFIG — skipping pendingOAuth`);
			if (preRegisteredOAuth) this.pendingOAuth.delete(runtimeConfigId);
			return result;
		}
		const reasonCode = (await this.connectorService.getStates())[configId]?.reason?.code;
		if (reasonCode === "auth-required" || reasonCode === "auth-failed") {
			if (silent) {
				this.logger.info(`[ConnectorUiAdapter] connect(${configId}): NEEDS_AUTH — silent, not entering pendingOAuth`);
				return {
					success: false,
					needsAuth: true,
					error: result.error
				};
			}
			if (preRegisteredOAuth && !this.pendingOAuth.has(runtimeConfigId)) return result;
			this.pendingOAuth.add(runtimeConfigId);
			this.startOAuthTimeout(runtimeConfigId);
			this.logger.info(`[ConnectorUiAdapter] connect(${configId}): NEEDS_AUTH — added to pendingOAuth, waiting for callback`);
			return {
				success: false,
				needsAuth: true,
				error: result.error
			};
		}
		if (preRegisteredOAuth) this.pendingOAuth.delete(runtimeConfigId);
		this.logger.info(`[ConnectorUiAdapter] connect(${configId}): FAILED — error=${result.error}`);
		return result;
	}
	/**
	* UI 发起自定义 MCP 重连
	*
	* 流程：
	* 1. 调 service.reconnectMcpServer() 发起连接（fire-and-forget）
	* 2. 检查 ConnectorService 的 V2 discovery 状态
	* 3. 如果 needsAuth → 加入 pendingOAuth，等 OAuth 回调重连完成后 resolve
	* 4. 如果不需要 OAuth → 立即返回
	*
	* mcp-panel 的 handleReconnect 在 await 完成后会触发 loadServers 刷新 UI。
	*/
	async reconnectMcpServer(serverName, options) {
		const configId = `custom-mcp:${serverName}`;
		const existing = this.reconnectMcpServerPromises.get(configId);
		if (existing) {
			this.logger.info(`[ConnectorUiAdapter] reconnectMcpServer(${serverName}): JOIN existing reconnect`);
			return existing;
		}
		const reconnect = this.doReconnectMcpServer(serverName, configId, options);
		this.reconnectMcpServerPromises.set(configId, reconnect);
		try {
			await reconnect;
		} finally {
			if (this.reconnectMcpServerPromises.get(configId) === reconnect) this.reconnectMcpServerPromises.delete(configId);
		}
	}
	async doReconnectMcpServer(serverName, configId, options) {
		this.logger.info(`[ConnectorUiAdapter] reconnectMcpServer(${serverName}): START, configId=${configId}, caller=${(/* @__PURE__ */ new Error()).stack?.split("\n")[2]?.trim()}`);
		this.pendingOAuth.add(configId);
		this.startOAuthTimeout(configId);
		try {
			await this.connectorService.reconnectMcpServer(serverName, options);
		} catch (error) {
			this.pendingOAuth.delete(configId);
			this.processingOAuth.delete(configId);
			this.clearOAuthTimeout(configId);
			throw error;
		}
		this.logger.info(`[ConnectorUiAdapter] reconnectMcpServer(${serverName}): waiting for connected/oauth callback`);
		const current = (await this.connectorService.listMcpServers()).find((server) => server.id === serverName);
		if (current?.status === "connected" || !current?.needsAuth) {
			this.pendingOAuth.delete(configId);
			this.processingOAuth.delete(configId);
			this.clearOAuthTimeout(configId);
			return;
		}
		return new Promise((resolve) => {
			let resolved = false;
			const finish = (reason) => {
				if (resolved) return;
				resolved = true;
				clearInterval(checkInterval);
				clearTimeout(timeoutId);
				this.pendingOAuth.delete(configId);
				this.processingOAuth.delete(configId);
				this.clearOAuthTimeout(configId);
				this.logger.info(`[ConnectorUiAdapter] reconnectMcpServer(${serverName}): RESOLVED — ${reason}`);
				resolve();
			};
			const checkInterval = setInterval(() => {
				if (!this.pendingOAuth.has(configId)) finish("pendingOAuth cleared");
			}, 500);
			const timeoutId = setTimeout(() => {
				this.logger.warn(`[ConnectorUiAdapter] reconnectMcpServer(${serverName}): TIMEOUT — OAuth callback did not arrive in ${_ConnectorUiAdapter.OAUTH_TIMEOUT_MS}ms`);
				finish("timeout");
			}, _ConnectorUiAdapter.OAUTH_TIMEOUT_MS);
		});
	}
	/**
	* UI 获取状态
	*
	* 对正在等 OAuth 回调的 connector，剥离过程性的 reason：授权仍在进行中，
	* 不是终态失败，不应在 UI 上显示红字。loading 由调用方本次 connect 的
	* 本地 pending 状态表达（`authorizing/initializing` 不进入公共契约）。
	*/
	async getStates() {
		const states = await this.connectorService.getStates();
		for (const runtimeConfigId of this.pendingOAuth) {
			const stateKey = require_tar$1.toRawConfigId(runtimeConfigId);
			if (states[stateKey]?.reason) states[stateKey] = {
				...states[stateKey],
				reason: void 0
			};
		}
		return states;
	}
	/**
	* UI 主动取消进行中的连接。
	*
	* 处理 4 种取消场景（思源 `/project/2026-05/连接器授权取消功能方案`）：
	* 1. CLI auth spawn 中：委托 `connectorService.cancelConnect` → AbortController 中断 spawn
	* 2. CLI poll 中：委托 `connectorService.cancelConnect` → 中断 poll 循环
	* 3. OAuth 等待回调中：清 pendingOAuth / processingOAuth / pendingOAuthTimeouts，
	*    再委托 service 推 state 到 'unauthorized'
	* 4. 已连接 / 未连接：noop，返回 success
	*
	* cancel 仅结束当前授权尝试，不改变 userEnabled。
	*/
	async cancelConnect(configId) {
		this.logger.info(`[ConnectorUiAdapter] cancelConnect(${configId}): START`);
		const runtimeConfigId = require_tar$1.toRuntimeMcpConfigId(configId);
		this.oauthManager.cancelAuthorization(runtimeConfigId);
		this.markOAuthCancelled(runtimeConfigId);
		const wasPending = this.pendingOAuth.has(runtimeConfigId);
		this.pendingOAuth.delete(runtimeConfigId);
		this.processingOAuth.delete(runtimeConfigId);
		this.clearOAuthTimeout(runtimeConfigId);
		if (wasPending) this.logger.info(`[ConnectorUiAdapter] cancelConnect(${configId}): cleared pendingOAuth state`);
		return this.connectorService.cancelConnect(configId);
	}
	/** 打上「用户取消 OAuth」标记（带取消时间戳，供 TTL 兜底）。 */
	markOAuthCancelled(runtimeConfigId) {
		this.cancelledOAuth.set(runtimeConfigId, Date.now());
	}
	/**
	* 查询该 connector 是否处于「已取消」有效期内。
	* 超过 TTL 视为过期（无重连到达的兜底），顺手清除，避免 Map 泄漏。
	*/
	isOAuthCancelled(runtimeConfigId) {
		const cancelledAt = this.cancelledOAuth.get(runtimeConfigId);
		if (cancelledAt === void 0) return false;
		if (Date.now() - cancelledAt >= _ConnectorUiAdapter.CANCELLED_OAUTH_TTL_MS) {
			this.cancelledOAuth.delete(runtimeConfigId);
			return false;
		}
		return true;
	}
	/** 清除取消标记（用户重新主动连接、或取消已被重连路径消费后）。 */
	clearOAuthCancelled(runtimeConfigId) {
		this.cancelledOAuth.delete(runtimeConfigId);
	}
	startOAuthTimeout(runtimeConfigId) {
		this.clearOAuthTimeout(runtimeConfigId);
		this.pendingOAuthStartedAt.set(runtimeConfigId, Date.now());
		this.pendingOAuthTimeouts.set(runtimeConfigId, setTimeout(() => {
			this.logger.info(`[ConnectorUiAdapter] OAuth timeout for ${runtimeConfigId}, clearing pending state`);
			this.connectorService.markOAuthFailed(require_tar$1.toRawConfigId(runtimeConfigId), "Authorization timed out");
			this.pendingOAuth.delete(runtimeConfigId);
			this.processingOAuth.delete(runtimeConfigId);
			this.pendingOAuthTimeouts.delete(runtimeConfigId);
			this.pendingOAuthStartedAt.delete(runtimeConfigId);
		}, _ConnectorUiAdapter.OAUTH_TIMEOUT_MS));
	}
	clearOAuthTimeout(runtimeConfigId) {
		const timer = this.pendingOAuthTimeouts.get(runtimeConfigId);
		if (timer) {
			clearTimeout(timer);
			this.pendingOAuthTimeouts.delete(runtimeConfigId);
		}
		this.pendingOAuthStartedAt.delete(runtimeConfigId);
	}
	/**
	* configId=undefined 的失败广播兜底清理。
	*
	* 仅清理进入 pending 已超过 OAUTH_FALLBACK_CLEAN_THRESHOLD_MS（60s）的 connector，
	* 避免误清并发 OAuth 中刚发起的其它 connector。这是失败广播，不会误清成功路径
	* （成功路径的 configId 一定有值，走上面的精确清理分支）。
	*/
	cleanupStalePendingOAuth() {
		const now = Date.now();
		const staleIds = [];
		for (const [runtimeConfigId, startedAt] of this.pendingOAuthStartedAt) if (now - startedAt >= _ConnectorUiAdapter.OAUTH_FALLBACK_CLEAN_THRESHOLD_MS) staleIds.push(runtimeConfigId);
		if (staleIds.length === 0) {
			this.logger.warn("[ConnectorUiAdapter] OAuth completed: unknown configId, no stale pendingOAuth to clean");
			return;
		}
		this.logger.warn(`[ConnectorUiAdapter] OAuth completed: unknown configId, cleaning stale pendingOAuth: ${staleIds.join(", ")}`);
		for (const runtimeConfigId of staleIds) {
			this.pendingOAuth.delete(runtimeConfigId);
			this.processingOAuth.delete(runtimeConfigId);
			this.clearOAuthTimeout(runtimeConfigId);
		}
	}
};
require_common$2.__decorate([(0, import_common$1.Autowired)(import_common$1.Logger), require_common$2.__decorateMetadata("design:type", typeof (_ref$5 = typeof import_common$1.Logger !== "undefined" && import_common$1.Logger) === "function" ? _ref$5 : Object)], ConnectorUiAdapter.prototype, "logger", void 0);
require_common$2.__decorate([(0, import_common$1.Autowired)(require_tar$1.ConnectorServiceToken), require_common$2.__decorateMetadata("design:type", Object)], ConnectorUiAdapter.prototype, "connectorService", void 0);
require_common$2.__decorate([(0, import_common$1.Autowired)(require_tar$1.ConnectorOAuthManagerToken), require_common$2.__decorateMetadata("design:type", Object)], ConnectorUiAdapter.prototype, "oauthManager", void 0);
ConnectorUiAdapter = _ConnectorUiAdapter = require_common$2.__decorate([(0, import_common$1.Component)(require_tar$1.ConnectorUiAdapterToken), require_common$2.__decorateMetadata("design:paramtypes", [])], ConnectorUiAdapter);
//#endregion
//#region ../../packages/workbuddy-server/src/expert/cache-manager.ts
/**
* Expert manifest 磁盘缓存管理器
*
* 纯 Node FS 操作，无 CellJS 依赖。
* 构造时传入 cacheDir，Desktop 宿主负责拼接路径。
*/
var MANIFEST_FILE = "manifest.json";
var VERSION_FILE = "version.txt";
var METADATA_FILE = "metadata.json";
var CACHE_FORMAT_VERSION = 2;
var ExpertCacheManager = class {
	constructor(cacheDir) {
		this.cacheDir = cacheDir;
	}
	async getManifest() {
		const p = this.filePath(MANIFEST_FILE);
		if (!await this.exists(p)) return null;
		try {
			return JSON.parse(await fs.promises.readFile(p, "utf-8"));
		} catch {
			return null;
		}
	}
	async saveManifest(manifest, sourceSignature) {
		await this.ensureDir();
		await fs.promises.writeFile(this.filePath(MANIFEST_FILE), JSON.stringify(manifest, null, 2), "utf-8");
		await fs.promises.writeFile(this.filePath(VERSION_FILE), manifest.version, "utf-8");
		await this.saveMetadata({
			version: manifest.version,
			cachedAt: (/* @__PURE__ */ new Date()).toISOString(),
			sourceSignature,
			manifestHash: this.computeHash(manifest),
			cacheFormatVersion: CACHE_FORMAT_VERSION
		});
	}
	async getMetadata() {
		const p = this.filePath(METADATA_FILE);
		if (!await this.exists(p)) return null;
		try {
			return JSON.parse(await fs.promises.readFile(p, "utf-8"));
		} catch {
			return null;
		}
	}
	async isCompatible(sourceSignature) {
		return (await this.getMetadata())?.sourceSignature === sourceSignature;
	}
	async getCachedVersion() {
		const p = this.filePath(VERSION_FILE);
		if (!await this.exists(p)) return null;
		try {
			return (await fs.promises.readFile(p, "utf-8")).trim();
		} catch {
			return null;
		}
	}
	async getCachedHash() {
		const meta = await this.getMetadata();
		if (meta?.manifestHash) return meta.manifestHash;
		const manifest = await this.getManifest();
		return manifest ? this.computeHash(manifest) : null;
	}
	async clear() {
		try {
			if (await this.exists(this.cacheDir)) await fs.promises.rm(this.cacheDir, {
				recursive: true,
				force: true
			});
		} catch {}
	}
	computeHash(manifest) {
		return (0, crypto.createHash)("sha256").update(JSON.stringify(manifest)).digest("hex");
	}
	filePath(name) {
		return path.join(this.cacheDir, name);
	}
	async ensureDir() {
		await fs.promises.mkdir(this.cacheDir, { recursive: true });
	}
	async saveMetadata(meta) {
		await fs.promises.writeFile(this.filePath(METADATA_FILE), JSON.stringify(meta, null, 2), "utf-8");
	}
	async exists(p) {
		try {
			await fs.promises.access(p, fs.constants.F_OK);
			return true;
		} catch {
			return false;
		}
	}
};
//#endregion
//#region ../../packages/workbuddy-server/src/expert/manifest-provider.ts
/**
* Expert manifest provider.
*
* 职责：manifest 加载、磁盘缓存、后台更新。
* 作为策略注入到 ExpertService。
*/
require_common$2.init_decorate();
var CURRENT_SOURCE_SIGNATURE = JSON.stringify({
	baseUrl: require_tar$1.EXPERT_CENTER_COS_CONFIG.baseUrl,
	manifestPath: require_tar$1.EXPERT_CENTER_COS_CONFIG.manifestPath
});
var ExpertManifestProvider = class ExpertManifestProvider {
	constructor() {
		this.cacheManager = new ExpertCacheManager(path.join(require_runtime_context.getWorkbuddyRuntimeUserDataDir(), "cache", "experts"));
		this.manifest = null;
		this.initPromise = null;
	}
	async init() {
		if (this.initPromise) return this.initPromise;
		this.initPromise = this.doInit();
		return this.initPromise;
	}
	async getManifest() {
		await this.ensureManifestLoaded();
		return this.manifest;
	}
	async refresh(force = false) {
		if (force) await this.clearCache();
		else this.initPromise = null;
		await this.init();
	}
	async clearCache() {
		await this.cacheManager.clear();
		this.manifest = null;
		this.initPromise = null;
	}
	async doInit() {
		try {
			await this.loadManifestFromCache();
			if (this.manifest) await this.syncManifestBeforeReady();
			else await this.fetchAndCacheManifest();
			this.backgroundManifestUpdate();
		} catch (error) {
			console.error("[ExpertCenter] Init failed:", error);
		}
	}
	async loadManifestFromCache() {
		try {
			if (!await this.cacheManager.isCompatible(CURRENT_SOURCE_SIGNATURE)) {
				if (await this.cacheManager.getMetadata()) console.log("[ExpertCenter] Clearing incompatible cache");
				await this.cacheManager.clear();
				this.manifest = null;
				return;
			}
			const cachedManifest = await this.cacheManager.getManifest();
			if (cachedManifest) {
				this.manifest = cachedManifest;
				console.log("[ExpertCenter] Manifest loaded from cache:", {
					version: cachedManifest.version,
					expertCount: cachedManifest.experts?.length ?? 0
				});
			}
		} catch (error) {
			console.warn("[ExpertCenter] Failed to load manifest from cache:", error);
		}
	}
	async fetchAndCacheManifest() {
		const remoteManifest = await require_tar$1.ExpertCloudService.fetchManifest();
		this.manifest = remoteManifest;
		await this.cacheManager.saveManifest(remoteManifest, CURRENT_SOURCE_SIGNATURE);
		console.log("[ExpertCenter] Manifest fetched from remote:", {
			version: remoteManifest.version,
			expertCount: remoteManifest.experts?.length ?? 0
		});
	}
	async syncManifestBeforeReady() {
		if (!this.manifest) return;
		try {
			const remoteManifest = await require_tar$1.ExpertCloudService.fetchManifest();
			const currentHash = this.cacheManager.computeHash(this.manifest);
			const remoteHash = this.cacheManager.computeHash(remoteManifest);
			if (this.manifest.version === remoteManifest.version && currentHash === remoteHash) return;
			this.manifest = remoteManifest;
			await this.cacheManager.saveManifest(remoteManifest, CURRENT_SOURCE_SIGNATURE);
		} catch (error) {
			console.warn("[ExpertCenter] Foreground manifest sync failed, using cached:", error);
		}
	}
	backgroundManifestUpdate() {
		setImmediate(() => {
			this.doBackgroundManifestUpdate().catch(() => {});
		});
	}
	async doBackgroundManifestUpdate() {
		try {
			const remoteManifest = await require_tar$1.ExpertCloudService.fetchManifest();
			const currentHash = this.manifest ? this.cacheManager.computeHash(this.manifest) : null;
			const cachedHash = await this.cacheManager.getCachedHash();
			const activeHash = currentHash ?? cachedHash;
			const remoteHash = this.cacheManager.computeHash(remoteManifest);
			if (!this.manifest || this.manifest.version !== remoteManifest.version || activeHash !== remoteHash) {
				this.manifest = remoteManifest;
				await this.cacheManager.saveManifest(remoteManifest, CURRENT_SOURCE_SIGNATURE);
			}
		} catch (error) {
			console.warn("[ExpertCenter] Background update failed:", error);
		}
	}
	async ensureManifestLoaded() {
		if (this.manifest) return;
		await this.init();
		if (this.manifest) return;
		try {
			await this.fetchAndCacheManifest();
		} catch (error) {
			console.error("[ExpertCenter] Manifest fallback fetch failed:", error);
		}
		if (!this.manifest) throw new Error("Expert center manifest not loaded");
	}
};
ExpertManifestProvider = require_common$2.__decorate([(0, import_common$1.Component)(require_tar$1.DesktopManifestProviderToken)], ExpertManifestProvider);
//#endregion
//#region ../../packages/workbuddy-server/src/expert/resource-loader.ts
/**
* 专家中心资源加载器
*
* 迁移自 packages/plugin-chat/src/common/expert-center/expert-center-resource-loader.ts
*/
require_common$2.init_decorate();
/**
* 仅司内 / 仅司外的额外清单相对路径。
* 与 packages/plugin-chat/.../expert-center-resource-loader.ts 保持一致。
*
* 设计目的（issue #38308 后续）：
* - 公共 expert_center.json 不再包含「司内专属」「司外专属」专家
* - 司内专家放 internalExpert.json；司外专家放 externalExpert.json
* - 客户端三份并行拉取后合并，再交由前端按 enterpriseId 过滤可见性
*
* 老客户端不感知这两个文件，从公共清单也拉不到这些专家，自然不会泄漏。
*/
var SCOPED_MANIFEST_PATHS = ["/internalExpert.json", "/externalExpert.json"];
var ExpertCenterResourceLoader = class ExpertCenterResourceLoader {
	async fetchManifest() {
		const baseManifestUrl = require_tar$1.buildExpertUrl$1(require_tar$1.EXPERT_CENTER_COS_CONFIG.manifestPath);
		console.log("[ExpertCenterDebug][DesktopLoader] fetch manifest:", {
			baseUrl: require_tar$1.EXPERT_CENTER_COS_CONFIG.baseUrl,
			manifestUrl: baseManifestUrl,
			scopedPaths: SCOPED_MANIFEST_PATHS
		});
		const [baseManifest, ...scopedResults] = await Promise.all([this.fetchBaseManifest(baseManifestUrl), ...SCOPED_MANIFEST_PATHS.map((p) => this.fetchScopedManifestSafe(p))]);
		const scopedManifests = scopedResults.filter((m) => m !== null);
		const merged = scopedManifests.length === 0 ? baseManifest : mergeExpertManifests(baseManifest, scopedManifests);
		console.log("[ExpertCenterDebug][DesktopLoader] fetchManifest:done", {
			manifestUrl: baseManifestUrl,
			version: merged.version,
			baseExperts: baseManifest.experts?.length ?? 0,
			scopedExperts: scopedManifests.map((m) => m.experts?.length ?? 0),
			mergedExperts: merged.experts?.length ?? 0,
			baseExpertIds: (baseManifest.experts ?? []).slice(0, 10).map((e) => e.id),
			scopedExpertIdsAll: scopedManifests.map((m) => (m.experts ?? []).map((e) => e.id)),
			mergedHasInternalSample: (merged.experts ?? []).some((e) => e.id === "TencentCloudPriceExpert"),
			mergedHasExternalSample: (merged.experts ?? []).some((e) => e.id === "ReportDistributionAgent")
		});
		return merged;
	}
	async fetchBaseManifest(url) {
		const response = await this.fetchWithTimeout(url);
		if (!response.ok) throw new Error(`Failed to fetch manifest: ${response.status}`);
		const manifest = await response.json();
		console.log("[ExpertCenterDebug][DesktopLoader] fetchBaseManifest:done", {
			url,
			status: response.status,
			version: manifest.version,
			experts: manifest.experts?.length ?? 0,
			categories: manifest.categories?.length ?? 0
		});
		return manifest;
	}
	async fetchScopedManifestSafe(relativePath) {
		const url = require_tar$1.buildExpertUrl$1(relativePath);
		console.log("[ExpertCenterDebug][DesktopLoader] fetchScopedManifest:start", {
			relativePath,
			url
		});
		try {
			const response = await this.fetchWithTimeout(url);
			if (!response.ok) {
				console.warn("[ExpertCenterDebug][DesktopLoader] fetchScopedManifest non-ok:", {
					relativePath,
					url,
					status: response.status
				});
				return null;
			}
			const manifest = await response.json();
			console.log("[ExpertCenterDebug][DesktopLoader] fetchScopedManifest:done", {
				relativePath,
				url,
				status: response.status,
				version: manifest.version,
				experts: manifest.experts?.length ?? 0,
				categories: manifest.categories?.length ?? 0,
				expertIds: (manifest.experts ?? []).map((e) => e.id),
				categoryIds: (manifest.categories ?? []).map((c) => c.id)
			});
			return manifest;
		} catch (error) {
			console.warn("[ExpertCenterDebug][DesktopLoader] fetchScopedManifest failed (silent fallback):", {
				relativePath,
				url,
				error: error instanceof Error ? error.message : String(error)
			});
			return null;
		}
	}
	async fetchPrompt(promptPath) {
		const url = require_tar$1.buildExpertUrl$1(promptPath);
		console.log("[ExpertCenterDebug][DesktopLoader] fetch prompt:", {
			promptPath,
			url
		});
		const response = await this.fetchWithTimeout(url);
		if (!response.ok) throw new Error(`Failed to fetch prompt: ${response.status} - ${url}`);
		return await response.text();
	}
	async fetchPromptWithRetry(promptPath) {
		const { maxRetries, retryDelay } = require_tar$1.EXPERT_CENTER_COS_CONFIG.download;
		let lastError;
		for (let attempt = 0; attempt <= maxRetries; attempt++) try {
			return await this.fetchPrompt(promptPath);
		} catch (error) {
			lastError = error;
			console.warn(`[ExpertCenter] Prompt download failed (attempt ${attempt + 1}/${maxRetries + 1}):`, error);
			if (attempt < maxRetries) await this.sleep(retryDelay);
		}
		throw lastError instanceof Error ? lastError : /* @__PURE__ */ new Error(`Failed to fetch prompt: ${promptPath}`);
	}
	async fetchPromptsBatch(tasks, onProgress) {
		const results = /* @__PURE__ */ new Map();
		const total = tasks.length;
		if (!total) {
			onProgress?.(0, 0, 0);
			return results;
		}
		const { batchConcurrency } = require_tar$1.EXPERT_CENTER_COS_CONFIG.download;
		let completed = 0;
		let failed = 0;
		for (let i = 0; i < tasks.length; i += batchConcurrency) {
			const batch = tasks.slice(i, i + batchConcurrency);
			const settled = await Promise.allSettled(batch.map(async (task) => {
				const content = await this.fetchPromptWithRetry(task.path);
				return {
					...task,
					content
				};
			}));
			for (const item of settled) if (item.status === "fulfilled") {
				const value = item.value;
				results.set(`${value.expertId}_${value.locale}`, value);
				completed += 1;
			} else {
				failed += 1;
				console.warn("[ExpertCenter] Batch download failed:", item.reason);
			}
			onProgress?.(completed, total, failed);
		}
		return results;
	}
	async fetchWithTimeout(url, timeout = require_tar$1.EXPERT_CENTER_COS_CONFIG.download.timeout) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeout);
		try {
			return await fetch(url, {
				signal: controller.signal,
				headers: { Accept: "application/json, text/plain, text/markdown" }
			});
		} catch (error) {
			if (error.name === "AbortError") throw new Error(`Request timeout after ${timeout}ms: ${url}`);
			throw error;
		} finally {
			clearTimeout(timer);
		}
	}
	sleep(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
};
ExpertCenterResourceLoader = require_common$2.__decorate([(0, import_common$1.Component)(require_tar$1.ExpertCenterResourceLoaderToken)], ExpertCenterResourceLoader);
/**
* 按 id 去重合并多份额外清单到公共清单上。
* 合并规则：base 先入 Map，overlay 依次覆盖同 id 项，因此实际效果是 **overlay 覆盖 base**。
* 与 plugin-chat 镜像保持语义一致。
*/
function mergeExpertManifests(base, overlays) {
	const categoryMap = /* @__PURE__ */ new Map();
	for (const c of base.categories ?? []) categoryMap.set(c.id, c);
	for (const overlay of overlays) for (const c of overlay.categories ?? []) categoryMap.set(c.id, c);
	const expertMap = /* @__PURE__ */ new Map();
	for (const e of base.experts ?? []) expertMap.set(e.id, e);
	for (const overlay of overlays) for (const e of overlay.experts ?? []) expertMap.set(e.id, e);
	const mergedExperts = Array.from(expertMap.values());
	const mergedCategories = Array.from(categoryMap.values());
	const allManifests = [base, ...overlays];
	const newestVersion = allManifests.map((m) => m.version ?? "").reduce((a, b) => a >= b ? a : b, "");
	const newestLastUpdated = allManifests.map((m) => typeof m.lastUpdated === "string" ? m.lastUpdated : "").reduce((a, b) => a >= b ? a : b, "");
	return {
		...base,
		categories: mergedCategories,
		experts: mergedExperts,
		statistics: {
			totalExperts: mergedExperts.length,
			totalCategories: mergedCategories.length
		},
		version: newestVersion || base.version,
		lastUpdated: newestLastUpdated || base.lastUpdated
	};
}
//#endregion
//#region ../../packages/workbuddy-server/src/expert/history-service.ts
require_common$2.init_decorateMetadata();
require_common$2.init_decorate();
var ExpertHistoryService = class ExpertHistoryService {
	constructor() {
		this._maxExpertsPerSession = 5;
		this.initPromise = null;
	}
	async getRecentExperts(sessionId) {
		await this.ensureInitialized();
		return this.cache.getRecentExperts(sessionId);
	}
	async addExpert(sessionId, expert) {
		await this.ensureInitialized();
		this.cache.addExpert(sessionId, expert, this._maxExpertsPerSession);
		this.persistToStorage();
		console.log(`[ExpertHistory] Added expert '${expert.name}' (${expert.id}) to scoped history`);
	}
	async removeExpert(sessionId, expertId) {
		await this.ensureInitialized();
		if (this.cache.removeExpert(sessionId, expertId)) {
			this.persistToStorage();
			console.log(`[ExpertHistory] Removed expert ${expertId} from scoped history`);
		}
	}
	async clearHistory(sessionId) {
		await this.ensureInitialized();
		if (this.cache.clearHistory(sessionId)) {
			this.persistToStorage();
			console.log("[ExpertHistory] Cleared scoped history");
		}
	}
	async flush() {
		await this.storage.flush();
	}
	async ensureInitialized() {
		if (this.cache.isInitialized()) return;
		if (!this.initPromise) this.initPromise = this.doInitialize();
		await this.initPromise;
	}
	async doInitialize() {
		try {
			console.log("[ExpertHistory] Initializing service...");
			const loadedData = await this.storage.load();
			const { data, migrated } = this.migrateToSharedHistory(loadedData);
			this.cache.initFromData(data);
			if (migrated && data) {
				this.storage.saveAsync(data);
				console.log("[ExpertHistory] Migrated legacy session-based history to shared history");
			}
			console.log("[ExpertHistory] Service initialized successfully");
		} catch (error) {
			console.error("[ExpertHistory] Failed to initialize:", error);
			this.cache.initFromData(null);
		}
	}
	migrateToSharedHistory(data) {
		if (!data) return {
			data: null,
			migrated: false
		};
		const sessionEntries = Object.entries(data.sessions ?? {});
		if (sessionEntries.length === 0) return {
			data,
			migrated: false
		};
		if (sessionEntries.length === 1 && sessionEntries[0][0] === "__global__") return {
			data,
			migrated: false
		};
		const deduped = /* @__PURE__ */ new Map();
		for (const experts of sessionEntries.map(([, experts]) => experts)) for (const expert of experts ?? []) {
			if (!expert?.id) continue;
			const existing = deduped.get(expert.id);
			if (!existing || (expert.summonedAt ?? 0) >= (existing.summonedAt ?? 0)) deduped.set(expert.id, expert);
		}
		const mergedExperts = Array.from(deduped.values()).sort((a, b) => (b.summonedAt ?? 0) - (a.summonedAt ?? 0)).slice(0, this._maxExpertsPerSession);
		return {
			data: {
				version: data.version,
				sessions: mergedExperts.length > 0 ? { [require_tar$1.SHARED_HISTORY_KEY]: mergedExperts } : {},
				lastUpdated: Date.now()
			},
			migrated: true
		};
	}
	persistToStorage() {
		const data = this.cache.getAllData();
		this.storage.saveAsync(data);
	}
};
require_common$2.__decorate([(0, import_common$1.Autowired)(require_tar$1.ExpertHistoryCacheToken), require_common$2.__decorateMetadata("design:type", Object)], ExpertHistoryService.prototype, "cache", void 0);
require_common$2.__decorate([(0, import_common$1.Autowired)(require_tar$1.ExpertHistoryStorageToken), require_common$2.__decorateMetadata("design:type", Object)], ExpertHistoryService.prototype, "storage", void 0);
ExpertHistoryService = require_common$2.__decorate([(0, import_common$1.Component)(require_tar$1.ExpertHistoryServiceToken)], ExpertHistoryService);
//#endregion
//#region ../../packages/workbuddy-server/src/expert/history-storage.ts
require_common$2.init_decorateMetadata();
require_common$2.init_decorate();
var _ExpertHistoryStorage;
var ExpertHistoryStorage = _ExpertHistoryStorage = class ExpertHistoryStorage {
	constructor() {
		this.writeTimer = null;
		this.pendingData = null;
		this.writeDebounceMs = 500;
		this.isWriting = false;
		const storageDir = node_path.join(require_runtime_context.getWorkbuddyRuntimeUserDataDir(), "data");
		this.storagePath = node_path.join(storageDir, require_tar$1.DEFAULT_STORAGE_FILE);
		this.initSync(storageDir);
	}
	initSync(storageDir) {
		try {
			if (!node_fs.existsSync(storageDir)) node_fs.mkdirSync(storageDir, { recursive: true });
			if (!node_fs.existsSync(this.storagePath)) {
				const emptyData = _ExpertHistoryStorage.createEmptyData();
				node_fs.writeFileSync(this.storagePath, JSON.stringify(emptyData, null, 2));
			}
		} catch (e) {
			console.warn("[ExpertHistory] Failed to init storage sync:", e);
		}
	}
	configure(options) {
		if (options.writeDebounceMs !== void 0 && options.writeDebounceMs >= 0) this.writeDebounceMs = options.writeDebounceMs;
	}
	async load() {
		try {
			if (!await this.exists(this.storagePath)) {
				console.log("[ExpertHistory] Storage file does not exist, starting fresh");
				return null;
			}
			const content = await node_fs.promises.readFile(this.storagePath, "utf-8");
			const data = JSON.parse(content);
			if (!this.isValidData(data)) {
				console.warn("[ExpertHistory] Invalid data format, starting fresh");
				return null;
			}
			return this.loadLegacyStorageWhenCurrentEmpty(data);
		} catch (error) {
			if (error instanceof SyntaxError) console.warn("[ExpertHistory] Failed to parse storage file, starting fresh:", error.message);
			else console.warn("[ExpertHistory] Failed to load from storage:", error);
			return null;
		}
	}
	saveAsync(data) {
		this.pendingData = data;
		if (this.writeTimer) clearTimeout(this.writeTimer);
		this.writeTimer = setTimeout(() => {
			this.flushPendingWrite();
		}, this.writeDebounceMs);
	}
	async flush() {
		if (this.writeTimer) {
			clearTimeout(this.writeTimer);
			this.writeTimer = null;
		}
		if (this.pendingData) {
			const dataToWrite = this.pendingData;
			this.pendingData = null;
			await this.doWrite(dataToWrite);
		}
	}
	async clear() {
		try {
			if (await this.exists(this.storagePath)) {
				await node_fs.promises.unlink(this.storagePath);
				console.log("[ExpertHistory] Storage file cleared");
			}
		} catch (error) {
			console.error("[ExpertHistory] Failed to clear storage:", error);
		}
	}
	getStoragePath() {
		return this.storagePath;
	}
	async flushPendingWrite() {
		this.writeTimer = null;
		if (!this.pendingData) return;
		const dataToWrite = this.pendingData;
		this.pendingData = null;
		await this.doWrite(dataToWrite);
	}
	async doWrite(data) {
		if (this.isWriting) {
			this.pendingData = data;
			return;
		}
		this.isWriting = true;
		try {
			const dir = node_path.dirname(this.storagePath);
			await node_fs.promises.mkdir(dir, { recursive: true });
			const tempPath = `${this.storagePath}.tmp`;
			const content = JSON.stringify(data, null, 2);
			await node_fs.promises.writeFile(tempPath, content, "utf-8");
			await node_fs.promises.rename(tempPath, this.storagePath);
			console.log(`[ExpertHistory] Saved ${Object.keys(data.sessions).length} sessions to storage`);
		} catch (error) {
			console.error("[ExpertHistory] Failed to save to storage:", error);
		} finally {
			this.isWriting = false;
			if (this.pendingData) {
				const nextData = this.pendingData;
				this.pendingData = null;
				setImmediate(() => {
					this.doWrite(nextData);
				});
			}
		}
	}
	async exists(filePath) {
		try {
			await node_fs.promises.access(filePath, node_fs.constants.F_OK);
			return true;
		} catch {
			return false;
		}
	}
	hasHistory(data) {
		return Object.values(data.sessions ?? {}).some((experts) => Array.isArray(experts) && experts.length > 0);
	}
	getLegacyStorageCandidates() {
		const userDataDir = require_runtime_context.getWorkbuddyRuntimeUserDataDir();
		if (node_path.basename(userDataDir) !== "app") return [];
		const configDir = node_path.dirname(userDataDir);
		return Array.from(new Set([node_path.join(configDir, ".workbuddy", require_tar$1.DEFAULT_STORAGE_FILE), node_path.join(configDir, require_tar$1.DEFAULT_STORAGE_FILE)])).filter((candidate) => candidate !== this.storagePath);
	}
	async readLegacyStorage(candidate) {
		try {
			if (!await this.exists(candidate)) return null;
			const content = await node_fs.promises.readFile(candidate, "utf-8");
			const data = JSON.parse(content);
			return this.isValidData(data) && this.hasHistory(data) ? data : null;
		} catch {
			return null;
		}
	}
	async loadLegacyStorageWhenCurrentEmpty(data) {
		if (this.hasHistory(data)) return data;
		for (const candidate of this.getLegacyStorageCandidates()) {
			const legacyData = await this.readLegacyStorage(candidate);
			if (legacyData) {
				await this.doWrite(legacyData);
				return legacyData;
			}
		}
		return data;
	}
	isValidData(data) {
		if (!data || typeof data !== "object") return false;
		const d = data;
		if (typeof d.version !== "number") return false;
		if (!d.sessions || typeof d.sessions !== "object") return false;
		if (typeof d.lastUpdated !== "number") return false;
		return true;
	}
	static createEmptyData() {
		return {
			version: 1,
			sessions: {},
			lastUpdated: Date.now()
		};
	}
	async dispose() {
		console.log("[ExpertHistory] Disposing storage...");
		if (this.writeTimer) {
			clearTimeout(this.writeTimer);
			this.writeTimer = null;
		}
		if (this.pendingData) {
			try {
				await this.doWrite(this.pendingData);
			} catch (e) {
				console.warn("[ExpertHistory] Failed to flush pending data on dispose:", e);
			}
			this.pendingData = null;
		}
		console.log("[ExpertHistory] Storage disposed successfully");
	}
};
ExpertHistoryStorage = _ExpertHistoryStorage = require_common$2.__decorate([(0, import_common$1.Component)(require_tar$1.ExpertHistoryStorageToken), require_common$2.__decorateMetadata("design:paramtypes", [])], ExpertHistoryStorage);
//#endregion
//#region ../../packages/workbuddy-server/src/expert/history-cache.ts
require_common$2.init_decorate();
var ExpertHistoryCache = class ExpertHistoryCache {
	constructor() {
		this.data = {
			version: 1,
			sessions: {},
			lastUpdated: Date.now()
		};
		this.initialized = false;
	}
	getRecentExperts(sessionId) {
		const sessionKey = this.resolveSessionKey(sessionId);
		return this.resolveExpertsForRead(sessionKey).slice();
	}
	addExpert(sessionId, expert, maxCount) {
		const sessionKey = this.resolveSessionKey(sessionId);
		const experts = this.resolveExpertsForWrite(sessionKey);
		const existingExpert = experts.find((e) => e.id === expert.id);
		const filteredExperts = experts.filter((e) => e.id !== expert.id);
		const newExperts = [{
			...existingExpert,
			...expert,
			isCustomExpert: expert.isCustomExpert ?? existingExpert?.isCustomExpert,
			summonedAt: Date.now()
		}, ...filteredExperts].slice(0, maxCount);
		this.data.sessions = {
			...this.data.sessions,
			[sessionKey]: newExperts
		};
		this.data.lastUpdated = Date.now();
		return newExperts.slice();
	}
	removeExpert(sessionId, expertId) {
		const sessionKey = this.resolveSessionKey(sessionId);
		if (sessionKey === "__global__") return this.removeExpertFromAllScopes(expertId);
		return this.removeExpertFromScope(sessionKey, expertId);
	}
	clearHistory(sessionId) {
		const sessionKey = this.resolveSessionKey(sessionId);
		if (this.resolveExpertsForRead(sessionKey).length === 0) return false;
		const nextSessions = { ...this.data.sessions };
		if (sessionKey === "__global__") delete nextSessions[sessionKey];
		else nextSessions[sessionKey] = [];
		this.data.sessions = nextSessions;
		this.data.lastUpdated = Date.now();
		return true;
	}
	resolveSessionKey(sessionId) {
		return (typeof sessionId === "string" ? sessionId.trim() : "") || "__global__";
	}
	hasScope(sessionKey) {
		return Object.prototype.hasOwnProperty.call(this.data.sessions, sessionKey);
	}
	resolveExpertsForRead(sessionKey) {
		if (this.hasScope(sessionKey)) return this.data.sessions[sessionKey] ?? [];
		if (sessionKey !== "__global__") return this.data.sessions["__global__"] ?? [];
		return [];
	}
	resolveExpertsForWrite(sessionKey) {
		if (this.hasScope(sessionKey)) return this.data.sessions[sessionKey] ?? [];
		if (sessionKey !== "__global__") return this.data.sessions["__global__"] ?? [];
		return [];
	}
	removeExpertFromScope(sessionKey, expertId) {
		const experts = this.data.sessions[sessionKey];
		if (!experts || experts.length === 0) {
			if (this.hasScope(sessionKey) || sessionKey === "__global__") return false;
			const legacyExperts = this.data.sessions["__global__"] ?? [];
			const filteredLegacyExperts = legacyExperts.filter((e) => e.id !== expertId);
			if (filteredLegacyExperts.length === legacyExperts.length) return false;
			this.data.sessions = {
				...this.data.sessions,
				[sessionKey]: filteredLegacyExperts
			};
			this.data.lastUpdated = Date.now();
			return true;
		}
		const filteredExperts = experts.filter((e) => e.id !== expertId);
		if (filteredExperts.length === experts.length) return false;
		const nextSessions = { ...this.data.sessions };
		if (filteredExperts.length > 0) nextSessions[sessionKey] = filteredExperts;
		else if (sessionKey === "__global__") delete nextSessions[sessionKey];
		else nextSessions[sessionKey] = [];
		this.data.sessions = nextSessions;
		this.data.lastUpdated = Date.now();
		return true;
	}
	removeExpertFromAllScopes(expertId) {
		let changed = false;
		const nextSessions = {};
		for (const [sessionKey, experts] of Object.entries(this.data.sessions)) {
			const filteredExperts = experts.filter((e) => e.id !== expertId);
			if (filteredExperts.length !== experts.length) changed = true;
			if (filteredExperts.length > 0) nextSessions[sessionKey] = filteredExperts;
		}
		if (!changed) return false;
		this.data.sessions = nextSessions;
		this.data.lastUpdated = Date.now();
		return true;
	}
	getAllData() {
		const sessions = Object.fromEntries(Object.entries(this.data.sessions).map(([key, experts]) => [key, experts.slice()]));
		return {
			...this.data,
			sessions
		};
	}
	initFromData(data) {
		if (this.initialized) return;
		if (data) this.data = {
			version: data.version ?? 1,
			sessions: data.sessions ?? {},
			lastUpdated: data.lastUpdated ?? Date.now()
		};
		this.initialized = true;
	}
	isInitialized() {
		return this.initialized;
	}
	static createEmptyData() {
		return {
			version: 1,
			sessions: {},
			lastUpdated: Date.now()
		};
	}
};
ExpertHistoryCache = require_common$2.__decorate([(0, import_common$1.Component)(require_tar$1.ExpertHistoryCacheToken)], ExpertHistoryCache);
//#endregion
//#region ../../packages/workbuddy-server/src/expert/runtime/expert-agent-file-resolver.ts
async function resolveLocalExpertPluginDir(configDir, bundleName, marketplace, hasPluginManifest) {
	if (marketplace && marketplace !== "experts" && marketplace !== "my-experts") return;
	const marketplaces = marketplace ? [marketplace] : ["experts", "my-experts"];
	for (const candidateMarketplace of marketplaces) {
		const pluginsRoot = node_path.resolve(configDir, "plugins", "marketplaces", candidateMarketplace, "plugins");
		const pluginDir = node_path.resolve(pluginsRoot, bundleName);
		if (pluginDir !== pluginsRoot && !pluginDir.startsWith(`${pluginsRoot}${node_path.sep}`)) continue;
		if (await hasPluginManifest(pluginDir)) try {
			const [realPluginsRoot, realPluginDir] = await Promise.all([node_fs_promises.realpath(pluginsRoot), node_fs_promises.realpath(pluginDir)]);
			if (realPluginDir !== realPluginsRoot && !realPluginDir.startsWith(`${realPluginsRoot}${node_path.sep}`)) continue;
			return realPluginDir;
		} catch {
			continue;
		}
	}
}
async function listMarkdownFiles(dir) {
	try {
		return (await node_fs_promises.readdir(dir, { withFileTypes: true })).filter((entry) => entry.isFile() && entry.name.endsWith(".md")).map((entry) => node_path.join(dir, entry.name));
	} catch {
		return [];
	}
}
async function readFrontmatterName(filePath) {
	try {
		return (((await node_fs_promises.readFile(filePath, "utf8")).match(/^---\s*\n([\s\S]*?)\n---/)?.[1])?.match(/^name:\s*(.+)$/m)?.[1]?.trim())?.replace(/^['"]|['"]$/g, "");
	} catch {
		return;
	}
}
/**
* Resolve an expert's local agent markdown without leaving the plugin's agents directory.
* Team experts pass their lead agent name, so the same lookup covers both single experts
* and expert teams.
*/
async function resolveExpertAgentMarkdownPath(pluginDir, agentName) {
	const candidates = await listMarkdownFiles(node_path.resolve(pluginDir, "agents"));
	if (candidates.length === 0) return;
	const normalizedAgentName = agentName.replace(/\.md$/i, "");
	const basenameMatch = candidates.find((candidate) => node_path.basename(candidate, ".md") === normalizedAgentName);
	if (basenameMatch) return node_path.resolve(basenameMatch);
	for (const candidate of candidates) if (await readFrontmatterName(candidate) === agentName) return node_path.resolve(candidate);
}
//#endregion
//#region ../../packages/workbuddy-server/src/expert/runtime/expert-bundle-runtime.ts
var EXPERTS_MARKETPLACE$2 = "experts";
var expertMarketLogger = require_logger.createWorkbuddyScopedLogger("expert-market");
var ExpertBundleRuntime = class {
	constructor(deps) {
		this.deps = deps;
		this.downloadingExperts = /* @__PURE__ */ new Map();
	}
	getConfigDir() {
		return this.deps.getConfigDir();
	}
	/** 获取专家 marketplace 根目录 */
	getMarketplaceDir() {
		const configDir = this.getConfigDir();
		return path.join(configDir, "plugins", "marketplaces", EXPERTS_MARKETPLACE$2);
	}
	/** 获取专家 Plugin 的本地目录路径，以 bundleName（plugin 字段值）为目录名 */
	getPluginDir(bundleName) {
		const configDir = this.getConfigDir();
		return path.join(configDir, "plugins", "marketplaces", EXPERTS_MARKETPLACE$2, "plugins", bundleName);
	}
	/**
	* 增量更新 experts marketplace 的 marketplace.json。
	* 只新增/更新指定 bundleName 对应的条目，不全量扫描所有子目录。
	*/
	async updateMarketplaceManifest(bundleName, marketplace) {
		const marketplaceName = marketplace || EXPERTS_MARKETPLACE$2;
		const marketplaceDir = marketplace ? path.join(this.getConfigDir(), "plugins", "marketplaces", marketplace) : this.getMarketplaceDir();
		const metaDir = path.join(marketplaceDir, ".codebuddy-plugin");
		const manifestPath = path.join(metaDir, "marketplace.json");
		await fs_promises.mkdir(metaDir, { recursive: true });
		let existing = {
			name: marketplaceName,
			description: `${marketplaceName} marketplace (auto-generated)`,
			plugins: []
		};
		try {
			const content = await fs_promises.readFile(manifestPath, "utf-8");
			existing = JSON.parse(content);
		} catch {}
		const pluginDir = path.join(marketplaceDir, "plugins", bundleName);
		const manifest = await this.deps.readPluginManifestAsync(pluginDir);
		if (!manifest) {
			console.warn(`[ExpertPluginService] updateMarketplaceManifest: no manifest for ${bundleName}`);
			return;
		}
		const entry = {
			name: manifest.name || bundleName,
			source: `./plugins/${bundleName}`,
			description: manifest.description
		};
		const idx = existing.plugins.findIndex((p) => p.source === entry.source);
		if (idx >= 0) existing.plugins[idx] = entry;
		else existing.plugins.push(entry);
		await fs_promises.writeFile(manifestPath, JSON.stringify(existing, null, 2), "utf-8");
		console.log(`[ExpertPluginService] Updated marketplace.json (incremental): ${existing.plugins.length} plugins`, { updatedBundle: bundleName });
	}
	/**
	* 确保专家 Plugin 已下载到本地且是最新版本。
	* - 本地没有 → 下载
	* - 本地有但远程 updatedAt 比本地下载时间新 → 重新下载
	* - 本地有且是最新 → 跳过下载
	*/
	async ensureDownloaded(bundleName, updatedAt, downloadUrl) {
		const localPath = this.getPluginDir(bundleName);
		if (await this.deps.hasPluginManifestAsync(localPath)) if (updatedAt && await this.isLocalStale(localPath, updatedAt)) console.log(`[ExpertPluginService] Local cache stale, re-downloading: ${bundleName}`);
		else {
			await this.logBundleSnapshot("cache", bundleName, localPath);
			return localPath;
		}
		const existing = this.downloadingExperts.get(bundleName);
		if (existing) return existing;
		const downloadPromise = this.downloadAndExtract(bundleName, localPath, downloadUrl);
		this.downloadingExperts.set(bundleName, downloadPromise);
		try {
			return await downloadPromise;
		} finally {
			this.downloadingExperts.delete(bundleName);
		}
	}
	/**
	* 优先从接口返回地址下载专家包；缺失时回退 COS tar.gz，并解压到本地目录。
	*/
	async downloadAndExtract(bundleName, targetDir, downloadUrl) {
		const explicitDownloadUrl = downloadUrl?.trim();
		const isTrusted = this.deps.isTrustedDownloadUrl ?? ((url) => this.isTrustedDownloadUrl(url));
		let explicitBundleUrl = explicitDownloadUrl && isTrusted(explicitDownloadUrl) ? explicitDownloadUrl : void 0;
		if (explicitDownloadUrl && !explicitBundleUrl) expertMarketLogger.warn("untrusted expert bundle URL ignored", {
			bundleName,
			bundleUrl: this.redactUrlForLog(explicitDownloadUrl)
		});
		if (explicitBundleUrl && this.deps.shouldStripEnterpriseGatewayParams?.(explicitBundleUrl)) explicitBundleUrl = this.deps.stripEnterpriseGatewayDownloadParams?.(explicitBundleUrl) ?? explicitBundleUrl;
		const source = explicitBundleUrl ? "operation-platform" : "cos";
		const bundleUrl = explicitBundleUrl || require_tar$1.buildExpertUrl$1(`/bundles/${bundleName}.tar.gz`);
		const safeBundleUrl = this.redactUrlForLog(bundleUrl);
		expertMarketLogger.info("expert bundle download start", {
			bundleName,
			source,
			bundleUrl: safeBundleUrl
		});
		const { timeout } = require_tar$1.EXPERT_CENTER_COS_CONFIG.download;
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeout);
		let response;
		try {
			response = await fetch(bundleUrl, { signal: controller.signal });
		} catch (error) {
			expertMarketLogger.warn("expert bundle download request failed", {
				bundleName,
				bundleUrl: safeBundleUrl,
				error: String(error)
			});
			if (explicitBundleUrl) return this.downloadAndExtract(bundleName, targetDir);
			throw error;
		} finally {
			clearTimeout(timer);
		}
		if (!response.ok) {
			expertMarketLogger.warn("expert bundle download returned non-OK", {
				bundleName,
				bundleUrl: safeBundleUrl,
				status: response.status,
				statusText: response.statusText
			});
			if (explicitBundleUrl) return this.downloadAndExtract(bundleName, targetDir);
			throw new Error(`Failed to download expert bundle: ${response.status} ${response.statusText} - ${safeBundleUrl}`);
		}
		try {
			await fs_promises.rm(targetDir, {
				recursive: true,
				force: true
			});
			await fs_promises.mkdir(targetDir, { recursive: true });
			const archiveKind = this.inferArchiveKind(bundleUrl);
			const tmpFile = path.join(targetDir, archiveKind === "zip" ? "__bundle.zip" : "__bundle.tar.gz");
			await fs_promises.writeFile(tmpFile, Buffer.from(await response.arrayBuffer()));
			try {
				if (archiveKind === "zip") await this.extractZipArchive(tmpFile, targetDir);
				else await import_tar.extract({
					file: tmpFile,
					cwd: targetDir
				});
				await this.normalizeExtractedPluginRoot(targetDir);
			} finally {
				await fs_promises.unlink(tmpFile).catch(() => {});
			}
			if (!await this.deps.hasPluginManifestAsync(targetDir)) throw new Error(`Extracted bundle does not contain plugin.json: ${bundleName}`);
			await this.logBundleSnapshot(source, bundleName, targetDir);
			await fs_promises.writeFile(path.join(targetDir, ".downloaded_at"), (/* @__PURE__ */ new Date()).toISOString(), "utf-8");
			return targetDir;
		} catch (err) {
			if (explicitBundleUrl) {
				expertMarketLogger.warn("explicit expert bundle invalid, fallback to COS", {
					bundleName,
					bundleUrl: safeBundleUrl,
					error: err instanceof Error ? `${err.name}: ${err.message}` : String(err)
				});
				await fs_promises.rm(targetDir, {
					recursive: true,
					force: true
				}).catch(() => {});
				return this.downloadAndExtract(bundleName, targetDir);
			}
			throw new Error(`Failed to extract expert bundle "${bundleName}": ${err instanceof Error ? err.message : err}`);
		}
	}
	async logBundleSnapshot(source, bundleName, localPath) {
		const manifest = await this.deps.readPluginManifestAsync(localPath).catch(() => null);
		expertMarketLogger.info("expert bundle ready", {
			bundleName,
			source,
			localPath,
			pluginName: manifest?.name,
			version: manifest?.version,
			expertType: manifest?.expertType,
			agentName: manifest?.agentName
		});
	}
	isTrustedDownloadUrl(url) {
		return require_tar$1.isTrustedCosDownloadUrl(url, new URL(require_tar$1.EXPERT_CENTER_COS_CONFIG.baseUrl).hostname.toLowerCase());
	}
	redactUrlForLog(url) {
		try {
			const parsed = new URL(url);
			const redacted = `${parsed.origin}${parsed.pathname}`;
			return parsed.search || parsed.hash ? `${redacted}?<redacted>` : redacted;
		} catch {
			return "<invalid-url>";
		}
	}
	inferArchiveKind(url) {
		try {
			return new URL(url).pathname.toLowerCase().endsWith(".zip") ? "zip" : "tar";
		} catch {
			return url.split("?")[0].toLowerCase().endsWith(".zip") ? "zip" : "tar";
		}
	}
	/**
	* 解压专家包 zip，并做 zip-slip 防护。
	*
	* 条目名统一走 `decodeZipEntryName` 做多编码兼容解码：Windows 中文系统直接
	* 右键「压缩(zipped)文件夹」打出的包，文件名是 GBK 字节且不置 EFS(UTF-8)
	* 标志位；若无条件按 UTF-8 解码，含中文名的条目会解出未配对代理项，
	* `writeFile` 抛 `EILSEQ: illegal byte sequence` 导致整包解压失败 —— 上层
	* 随后静默回退公共市场 COS 并 404，表现为「企业自建专家召唤后不生效」。
	*/
	async extractZipArchive(zipPath, targetDir) {
		const entries = new import_adm_zip.default(zipPath).getEntries();
		const directoryLikeEntries = /* @__PURE__ */ new Set();
		for (const entry of entries) {
			const entryName = require_tar$1.decodeZipEntryName(entry.rawEntryName, entry.header.flags ?? 0).replace(/\\/g, "/").replace(/\/+$/, "");
			const parts = entryName.split("/").filter(Boolean);
			for (let i = 1; i < parts.length; i++) directoryLikeEntries.add(parts.slice(0, i).join("/"));
			if (entry.isDirectory && entryName) directoryLikeEntries.add(entryName);
		}
		const resolvedRoot = path.resolve(targetDir);
		for (const entry of entries) {
			const entryName = require_tar$1.decodeZipEntryName(entry.rawEntryName, entry.header.flags ?? 0).replace(/\\/g, "/");
			const normalizedEntryName = entryName.replace(/\/+$/, "");
			const targetPath = path.resolve(resolvedRoot, normalizedEntryName || entryName);
			const rel = path.relative(resolvedRoot, targetPath);
			if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error(`[zip-slip] entry escapes targetDir: ${entryName}`);
			if (entry.isDirectory || entryName.endsWith("/") || entry.header.size === 0 && directoryLikeEntries.has(normalizedEntryName)) {
				await fs_promises.mkdir(targetPath, { recursive: true });
				continue;
			}
			await fs_promises.mkdir(path.dirname(targetPath), { recursive: true });
			await fs_promises.writeFile(targetPath, entry.getData());
		}
	}
	async normalizeExtractedPluginRoot(targetDir) {
		if (await this.deps.hasPluginManifestAsync(targetDir)) return;
		const dirs = (await fs_promises.readdir(targetDir, { withFileTypes: true })).filter((entry) => entry.isDirectory());
		for (const dir of dirs) {
			const childDir = path.join(targetDir, dir.name);
			if (!await this.deps.hasPluginManifestAsync(childDir)) continue;
			for (const childEntry of await fs_promises.readdir(childDir)) await fs_promises.rename(path.join(childDir, childEntry), path.join(targetDir, childEntry));
			await fs_promises.rm(childDir, {
				recursive: true,
				force: true
			});
			return;
		}
	}
	/**
	* 检查本地缓存是否过期（远程 updatedAt 比本地下载时间新）
	*/
	async isLocalStale(localPath, remoteUpdatedAt) {
		try {
			const tsFile = path.join(localPath, ".downloaded_at");
			const content = await fs_promises.readFile(tsFile, "utf-8");
			const localTime = new Date(content.trim()).getTime();
			return new Date(remoteUpdatedAt).getTime() > localTime;
		} catch {
			return true;
		}
	}
};
//#endregion
//#region ../../packages/workbuddy-server/src/expert/runtime/expert-custom-runtime-utils.ts
async function pathExists$2(p) {
	try {
		await fs_promises.access(p);
		return true;
	} catch {
		return false;
	}
}
function isRecord$2(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** { zh:[...], en:[...] } 旧格式 → [{ zh, en }] 列表。 */
function normalizeLocalizedManifestItems(value) {
	if (value === void 0) return;
	if (Array.isArray(value)) return value;
	if (!isRecord$2(value)) return [];
	const zhItems = Array.isArray(value.zh) ? value.zh : [];
	const enItems = Array.isArray(value.en) ? value.en : [];
	const length = Math.max(zhItems.length, enItems.length);
	if (length === 0) return [];
	return Array.from({ length }, (_, index) => {
		const item = {};
		if (zhItems[index] !== void 0) item.zh = zhItems[index];
		if (enItems[index] !== void 0) item.en = enItems[index];
		return item;
	});
}
/** 专家包 manifest 的数组字段归一化；缺失保持缺失，非数组脏数据降级为空数组。 */
function normalizeManifestItems(value) {
	if (value === void 0) return;
	return Array.isArray(value) ? value : [];
}
//#endregion
//#region ../../packages/workbuddy-server/src/expert/runtime/expert-custom-runtime.ts
var PLUGIN_METADATA_DIRS$1 = [".codebuddy-plugin", ".workbuddy-plugin"];
var PLUGIN_MANIFEST_FILE$1 = "plugin.json";
var expertPluginLog$1 = {
	log: (...args) => console.log(...args),
	warn: (...args) => console.warn(...args),
	error: (...args) => console.error(...args)
};
var MAX_CUSTOM_EXPERT_AVATAR_BYTES = 5 * 1024 * 1024;
var ExpertCustomRuntime = class {
	constructor(deps) {
		this.deps = deps;
		this.customExpertDtoCache = /* @__PURE__ */ new Map();
		this.scanCustomExpertsInflight = /* @__PURE__ */ new Map();
	}
	getConfigDir() {
		return this.deps.getConfigDir();
	}
	/** 读取 plugin.json（异步版本，用于不阻塞主线程的场景） */
	async readPluginManifestAsync(dir) {
		for (const metaDir of PLUGIN_METADATA_DIRS$1) {
			const manifestPath = path.join(dir, metaDir, PLUGIN_MANIFEST_FILE$1);
			try {
				const content = await fs_promises.readFile(manifestPath, "utf-8");
				return JSON.parse(content);
			} catch {}
		}
		return null;
	}
	/**
	* 扫描本地自定义专家列表。
	* 基于 marketplace.json 注册清单扫描，只返回已注册且有效的专家。
	* 若 marketplace.json 仅因尾逗号等格式问题损坏，则修复格式后继续扫描。
	* 传入 userId 时，进一步过滤只返回属于该用户的专家。
	*/
	async scanCustomExperts(userId) {
		const userKey = userId ?? "";
		const inflight = this.scanCustomExpertsInflight.get(userKey);
		if (inflight) return inflight;
		const promise = this.doScanCustomExperts(userId);
		this.scanCustomExpertsInflight.set(userKey, promise);
		try {
			return await promise;
		} finally {
			this.scanCustomExpertsInflight.delete(userKey);
		}
	}
	async doScanCustomExperts(userId) {
		try {
			const configDir = this.getConfigDir();
			const marketplaceDir = path.join(configDir, "plugins", "marketplaces", require_tar$1.CUSTOM_EXPERT_MY_EXPERT_DIR_NAME);
			const pluginsDir = path.join(marketplaceDir, "plugins");
			const manifestPath = path.join(marketplaceDir, ".codebuddy-plugin", "marketplace.json");
			if (!await pathExists$2(manifestPath)) return [];
			let manifest;
			let shouldRewriteManifest = false;
			try {
				const content = await fs_promises.readFile(manifestPath, "utf-8");
				try {
					manifest = JSON.parse(content);
				} catch (parseError) {
					const normalized = this.repairJsonTrailingCommas(content);
					if (normalized === content) throw parseError;
					manifest = JSON.parse(normalized);
					shouldRewriteManifest = true;
					expertPluginLog$1.warn("[ExpertPluginService] scanCustomExperts: repaired malformed marketplace.json");
				}
			} catch {
				expertPluginLog$1.warn("[ExpertPluginService] scanCustomExperts: failed to parse marketplace.json");
				return [];
			}
			const registeredPlugins = manifest?.plugins;
			if (!Array.isArray(registeredPlugins) || registeredPlugins.length === 0) {
				if (shouldRewriteManifest) await this.reconcileCustomMarketplaceManifest(manifestPath, manifest, [], true, true);
				return [];
			}
			let userExpertIds;
			if (userId) {
				const ids = await this.readUserExpertIds(userId);
				if (ids !== null) userExpertIds = new Set(ids);
			}
			const experts = [];
			const validManifestEntries = [];
			const validDirNames = /* @__PURE__ */ new Set();
			for (const plugin of registeredPlugins) {
				if (!plugin.source) continue;
				const dirName = plugin.source.replace(/^\.\/plugins\//, "");
				if (!dirName || this.isUnsafePath(dirName)) continue;
				const expertDir = path.join(pluginsDir, dirName);
				try {
					if (!await pathExists$2(expertDir)) {
						this.customExpertDtoCache.delete(dirName);
						continue;
					}
					const pluginManifest = await this.readPluginManifestAsync(expertDir);
					if (!pluginManifest) {
						this.customExpertDtoCache.delete(dirName);
						continue;
					}
					validDirNames.add(dirName);
					validManifestEntries.push({
						name: pluginManifest.name || plugin.name || dirName,
						source: `./plugins/${dirName}`,
						description: pluginManifest.description ?? plugin.description
					});
					if (userExpertIds && !userExpertIds.has(dirName)) continue;
					const expert = await this.readCustomExpertFromDirCached(expertDir, dirName);
					if (expert) experts.push(expert);
				} catch (err) {
					expertPluginLog$1.warn("[ExpertPluginService] scanCustomExperts: skipping", dirName, err);
				}
			}
			await this.reconcileCustomMarketplaceManifest(manifestPath, manifest, validManifestEntries, true, shouldRewriteManifest);
			for (const cachedDir of this.customExpertDtoCache.keys()) if (!validDirNames.has(cachedDir)) this.customExpertDtoCache.delete(cachedDir);
			return experts;
		} catch (error) {
			expertPluginLog$1.error("[ExpertPluginService] scanCustomExperts failed:", error);
			return [];
		}
	}
	/**
	* 修复 JSON 中字符串外的尾逗号。
	* 逐字符识别字符串与转义状态，避免误改 description 等字符串里的 ",]" / ",}" 文本。
	*/
	repairJsonTrailingCommas(content) {
		let repaired = "";
		let inString = false;
		let escaping = false;
		let changed = false;
		for (let i = 0; i < content.length; i += 1) {
			const ch = content[i];
			if (inString) {
				repaired += ch;
				if (escaping) escaping = false;
				else if (ch === "\\") escaping = true;
				else if (ch === "\"") inString = false;
				continue;
			}
			if (ch === "\"") {
				inString = true;
				repaired += ch;
				continue;
			}
			if (ch === ",") {
				let next = i + 1;
				while (next < content.length && /\s/.test(content[next])) next += 1;
				if (next < content.length && (content[next] === "}" || content[next] === "]")) {
					changed = true;
					continue;
				}
			}
			repaired += ch;
		}
		return changed ? repaired : content;
	}
	/**
	* 将扫描得到的有效注册项写回 marketplace.json。
	* 仅用于格式修复和清理 stale entry，不主动注册磁盘裸目录。
	*/
	async reconcileCustomMarketplaceManifest(manifestPath, manifest, validEntries, manifestExists, forceRewrite = false) {
		const currentPlugins = Array.isArray(manifest.plugins) ? manifest.plugins : [];
		if (!forceRewrite && manifestExists && JSON.stringify(currentPlugins) === JSON.stringify(validEntries)) return;
		if (!manifestExists && validEntries.length === 0) return;
		await fs_promises.mkdir(path.dirname(manifestPath), { recursive: true });
		const nextManifest = {
			name: manifest.name || "my-experts",
			description: manifest.description || `my-experts marketplace (auto-generated)`,
			plugins: validEntries
		};
		await fs_promises.writeFile(manifestPath, JSON.stringify(nextManifest, null, 2), "utf-8");
	}
	/**
	* 带 mtime 缓存的自定义专家读取：plugin.json 未变则复用缓存 DTO，
	* 跳过 readFile + 头像 base64 编码（切 tab 卡顿的主要 CPU 来源）。
	*/
	async readCustomExpertFromDirCached(expertDir, entryName) {
		const mtimeMs = await this.statManifestMtimeMs(expertDir);
		if (mtimeMs !== void 0) {
			const cached = this.customExpertDtoCache.get(entryName);
			if (cached && cached.mtimeMs === mtimeMs) return cached.dto;
		}
		const dto = await this.readCustomExpertFromDir(expertDir, entryName);
		if (dto && mtimeMs !== void 0) this.customExpertDtoCache.set(entryName, {
			mtimeMs,
			dto
		});
		return dto;
	}
	/** 返回专家 plugin.json 的 mtimeMs（用于缓存失效判定）；找不到返回 undefined */
	async statManifestMtimeMs(expertDir) {
		for (const metaDir of PLUGIN_METADATA_DIRS$1) try {
			return (await fs_promises.stat(path.join(expertDir, metaDir, PLUGIN_MANIFEST_FILE$1))).mtimeMs;
		} catch {}
	}
	/** 根据 ID 获取单个本地自定义专家 */
	async getCustomExpert(expertId) {
		if (!expertId || this.isUnsafePath(expertId)) return null;
		try {
			const configDir = this.getConfigDir();
			const pluginsDir = path.join(configDir, "plugins", "marketplaces", require_tar$1.CUSTOM_EXPERT_MY_EXPERT_DIR_NAME, "plugins");
			const expertDir = path.join(pluginsDir, expertId);
			if (!expertDir.startsWith(pluginsDir)) return null;
			if (!await pathExists$2(expertDir)) return null;
			return await this.readCustomExpertFromDir(expertDir, expertId);
		} catch (error) {
			expertPluginLog$1.error("[ExpertPluginService] getCustomExpert failed:", error);
			return null;
		}
	}
	/** 删除本地自定义专家（目录 + marketplace.json + 用户列表） */
	async deleteCustomExpert(expertId, userId) {
		if (!expertId || this.isUnsafePath(expertId)) return {
			success: false,
			error: "invalid expertId"
		};
		try {
			const configDir = this.getConfigDir();
			const pluginsDir = path.join(configDir, "plugins", "marketplaces", require_tar$1.CUSTOM_EXPERT_MY_EXPERT_DIR_NAME, "plugins");
			const expertDir = path.join(pluginsDir, expertId);
			if (!expertDir.startsWith(pluginsDir)) return {
				success: false,
				error: "invalid expert path"
			};
			if (!await pathExists$2(expertDir)) return {
				success: false,
				error: "expert directory not found"
			};
			let pluginName;
			const manifest = await this.readPluginManifestAsync(expertDir);
			if (manifest?.name) pluginName = manifest.name;
			await fs_promises.rm(expertDir, {
				recursive: true,
				force: true
			});
			this.customExpertDtoCache.delete(expertId);
			await this.removeFromMarketplaceManifest(expertId);
			if (userId) await this.removeFromUserExperts(userId, expertId);
			if (pluginName) try {
				await this.deps.deactivateExpert(expertId);
			} catch (err) {
				expertPluginLog$1.warn("[ExpertPluginService] deleteCustomExpert: deactivate failed:", err);
			}
			expertPluginLog$1.log(`[ExpertPluginService] Custom expert deleted: ${expertId}`);
			return { success: true };
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			expertPluginLog$1.error("[ExpertPluginService] deleteCustomExpert failed:", msg);
			return {
				success: false,
				error: msg
			};
		}
	}
	/** 将专家 ID 添加到用户的自定义专家列表（去重） */
	async addUserExperts(userId, expertIds) {
		if (!userId || !expertIds.length || this.isUnsafePath(userId)) return;
		try {
			const jsonPath = this.getUserExpertsJsonPath(userId);
			const current = await this.readUserExpertIds(userId);
			const idSet = new Set(current);
			let changed = false;
			for (const id of expertIds) if (!idSet.has(id)) {
				idSet.add(id);
				changed = true;
			}
			if (!changed) return;
			await fs_promises.mkdir(path.dirname(jsonPath), { recursive: true });
			await fs_promises.writeFile(jsonPath, JSON.stringify(Array.from(idSet), null, 2), "utf-8");
		} catch (err) {
			expertPluginLog$1.warn("[ExpertPluginService] addUserExperts failed:", err);
		}
	}
	/** 获取本地自定义专家注册清单监听路径 */
	getCustomExpertWatchPath() {
		return path.join(this.getConfigDir(), "plugins", "marketplaces", require_tar$1.CUSTOM_EXPERT_MY_EXPERT_DIR_NAME, ".codebuddy-plugin", "marketplace.json");
	}
	/** 获取单个自定义专家的 plugin.json 监听路径 */
	getCustomExpertPluginJsonPath(expertId) {
		return path.join(this.getConfigDir(), "plugins", "marketplaces", require_tar$1.CUSTOM_EXPERT_MY_EXPERT_DIR_NAME, "plugins", expertId, ".codebuddy-plugin", "plugin.json");
	}
	/** 清除专家的 .created-by-session 标记文件 */
	async clearCustomExpertSessionMarker(expertId) {
		if (!expertId || this.isUnsafePath(expertId)) return;
		try {
			const configDir = this.getConfigDir();
			const markerPath = path.join(configDir, "plugins", "marketplaces", require_tar$1.CUSTOM_EXPERT_MY_EXPERT_DIR_NAME, "plugins", expertId, ".created-by-session");
			if (await pathExists$2(markerPath)) await fs_promises.unlink(markerPath);
			this.customExpertDtoCache.delete(expertId);
		} catch (err) {
			expertPluginLog$1.warn("[ExpertPluginService] clearCustomExpertSessionMarker failed:", err);
		}
	}
	/** 安全路径检查：拒绝包含路径穿越的 ID */
	isUnsafePath(id) {
		return /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(id) || /[\\/]/.test(id);
	}
	/** 用户自定义专家列表路径 */
	getUserExpertsJsonPath(userId) {
		return path.join(this.getConfigDir(), "experts", "custom", userId, "experts.json");
	}
	/** 读取用户的自定义专家 ID 列表 */
	/** 返回 null 表示 experts.json 不存在（不限制）；返回数组表示文件存在（按白名单过滤）。 */
	async readUserExpertIds(userId) {
		if (this.isUnsafePath(userId)) return [];
		try {
			const jsonPath = this.getUserExpertsJsonPath(userId);
			if (!await pathExists$2(jsonPath)) return null;
			const raw = await fs_promises.readFile(jsonPath, "utf-8");
			const parsed = JSON.parse(raw);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return null;
		}
	}
	/** 从用户列表中移除专家 ID */
	async removeFromUserExperts(userId, expertId) {
		if (this.isUnsafePath(userId)) return;
		try {
			const jsonPath = this.getUserExpertsJsonPath(userId);
			const current = await this.readUserExpertIds(userId) ?? [];
			const filtered = current.filter((id) => id !== expertId);
			if (filtered.length === current.length) return;
			await fs_promises.mkdir(path.dirname(jsonPath), { recursive: true });
			await fs_promises.writeFile(jsonPath, JSON.stringify(filtered, null, 2), "utf-8");
		} catch (err) {
			expertPluginLog$1.warn("[ExpertPluginService] removeFromUserExperts failed:", err);
		}
	}
	/** 从 marketplace.json 中移除指定 expertId 的条目 */
	async removeFromMarketplaceManifest(expertId) {
		try {
			const configDir = this.getConfigDir();
			const manifestPath = path.join(configDir, "plugins", "marketplaces", require_tar$1.CUSTOM_EXPERT_MY_EXPERT_DIR_NAME, ".codebuddy-plugin", "marketplace.json");
			if (!await pathExists$2(manifestPath)) return;
			const content = await fs_promises.readFile(manifestPath, "utf-8");
			const manifest = JSON.parse(content);
			if (manifest?.plugins && Array.isArray(manifest.plugins)) {
				manifest.plugins = manifest.plugins.filter((p) => p.source !== `./plugins/${expertId}`);
				await fs_promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
			}
		} catch (err) {
			expertPluginLog$1.warn("[ExpertPluginService] removeFromMarketplaceManifest failed:", err);
		}
	}
	/**
	* 从指定目录读取单个本地自定义专家的 plugin.json 并构造 CustomExpertInfoDTO。
	* 头像相对路径会被转换为 base64 data URL。
	*/
	async readCustomExpertFromDir(expertDir, entryName) {
		const manifest = await this.readPluginManifestAsync(expertDir);
		if (!manifest) return null;
		const json = { ...manifest };
		for (const field of [
			"tags",
			"quickPrompts",
			"triggerPrompts"
		]) {
			const normalized = normalizeLocalizedManifestItems(json[field]);
			if (normalized !== void 0) json[field] = normalized;
		}
		for (const field of [
			"members",
			"connectorIds",
			"bin",
			"references"
		]) {
			const normalized = normalizeManifestItems(json[field]);
			if (normalized !== void 0) json[field] = normalized;
		}
		if (!json.version) json.version = "1.0.0";
		if (json.avatar) json.avatar = await this.resolveAvatarToDataUrl(json.avatar, expertDir);
		if (Array.isArray(json.members)) {
			for (const member of json.members) if (typeof member === "object" && member) {
				if ((!member.id || typeof member.id !== "string") && typeof member.agent === "string" && member.agent.trim()) member.id = member.agent.trim();
				if (member.avatar) member.avatar = await this.resolveAvatarToDataUrl(member.avatar, expertDir);
			}
		}
		json.expertRootDir = expertDir;
		json.id = json.id || json.name || entryName;
		json.isCustomExpert = true;
		json.marketplace = require_tar$1.CUSTOM_EXPERT_MY_EXPERT_DIR_NAME;
		try {
			const sessionMarkerPath = path.join(expertDir, ".created-by-session");
			if (await pathExists$2(sessionMarkerPath)) {
				const sessionId = await fs_promises.readFile(sessionMarkerPath, "utf-8");
				if (sessionId.trim()) json.createdBySession = sessionId.trim();
			}
		} catch {}
		return json;
	}
	/** 头像相对路径 → base64 data URL 的通用转换 */
	async resolveAvatarToDataUrl(avatarPath, baseDir) {
		if (!avatarPath) return "";
		if (/^(https?|data):/.test(avatarPath)) return avatarPath;
		const rel = avatarPath.replace(/^\.\//, "");
		const abs = path.resolve(baseDir, rel);
		const resolvedBase = path.resolve(baseDir);
		if (!abs.startsWith(resolvedBase + path.sep) && abs !== resolvedBase) return "";
		try {
			if (await pathExists$2(abs)) {
				const stat = await fs_promises.stat(abs);
				if (stat.size > MAX_CUSTOM_EXPERT_AVATAR_BYTES) {
					expertPluginLog$1.warn("[ExpertPluginService] resolveAvatarToDataUrl: avatar file is too large:", avatarPath, stat.size);
					return "";
				}
				const base64Data = (await fs_promises.readFile(abs)).toString("base64");
				return `data:${{
					png: "image/png",
					jpg: "image/jpeg",
					jpeg: "image/jpeg",
					svg: "image/svg+xml",
					webp: "image/webp",
					gif: "image/gif"
				}[path.extname(rel).replace(".", "").toLowerCase() || "png"] || "image/png"};base64,${base64Data}`;
			}
		} catch {}
		return "";
	}
};
//#endregion
//#region ../../packages/workbuddy-server/src/expert/runtime/expert-locale-utils.ts
function isRecord$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function resolveLocalized(value, locale) {
	if (typeof value === "string") return value;
	if (isRecord$1(value)) {
		const localized = value[locale] ?? value.zh ?? value.en;
		return typeof localized === "string" ? localized : void 0;
	}
}
function localizeWorkbuddyMeta(meta, locale) {
	const tokenSchema = meta.auth?.tokenSchema;
	const localizedTokenSchema = tokenSchema ? {
		...tokenSchema,
		title: resolveLocalized(tokenSchema.title, locale),
		description: resolveLocalized(tokenSchema.description, locale),
		docLabel: resolveLocalized(tokenSchema.docLabel, locale),
		fields: (tokenSchema.fields ?? []).map((field) => ({
			...field,
			label: resolveLocalized(field.label, locale) ?? field.key,
			placeholder: resolveLocalized(field.placeholder, locale),
			description: resolveLocalized(field.description, locale)
		}))
	} : tokenSchema;
	return {
		...meta,
		displayName: resolveLocalized(meta.displayName, locale),
		description: resolveLocalized(meta.description, locale),
		...meta.auth ? { auth: {
			...meta.auth,
			tokenSchema: localizedTokenSchema
		} } : {}
	};
}
//#endregion
//#region ../../packages/workbuddy-server/src/expert/runtime/expert-dependency-runtime.ts
var expertPluginLog = { warn: (...args) => console.warn(...args) };
async function pathExists$1(p) {
	try {
		await fs_promises.access(p);
		return true;
	} catch {
		return false;
	}
}
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function readWorkbuddyMeta(config) {
	const raw = config["x-workbuddy"];
	return isRecord(raw) ? raw : void 0;
}
var ExpertDependencyRuntime = class {
	constructor(deps) {
		this.deps = deps;
	}
	async resolveExpertDependencies(expertId, pluginName, marketplace, locale = "zh") {
		const bundleName = pluginName || expertId;
		const pluginDir = await this.deps.resolvePluginDir(bundleName, marketplace);
		const manifest = await this.deps.readPluginManifestAsync(pluginDir);
		if (!manifest) return [];
		const mcpServers = await this.readExpertMcpServers(pluginDir, manifest);
		const mcpDependencies = Object.entries(mcpServers).map(([name, config]) => {
			const rawMeta = readWorkbuddyMeta(config);
			const meta = rawMeta ? localizeWorkbuddyMeta(rawMeta, locale) : void 0;
			return {
				type: "mcp",
				name,
				displayName: meta?.displayName,
				description: meta?.description,
				icon: meta?.icon,
				config,
				workbuddy: meta
			};
		});
		const connectorDependencies = (manifest.dependencies?.connectors ?? []).filter((id) => typeof id === "string" && id.trim().length > 0).map((id) => ({
			type: "connector",
			id
		}));
		return [...mcpDependencies, ...connectorDependencies];
	}
	async readExpertMcpServers(pluginDir, manifest) {
		const declared = manifest.dependencies?.mcpServers ?? manifest.mcpServers;
		if (declared !== void 0) return this.readMcpServersDeclaration(pluginDir, declared);
		const fallbackPath = path.join(pluginDir, ".mcp.json");
		if (await pathExists$1(fallbackPath)) return this.readMcpServersFile(fallbackPath);
		return {};
	}
	async readMcpServersDeclaration(pluginDir, declared) {
		if (typeof declared === "string") return this.readMcpServersFile(path.resolve(pluginDir, declared));
		if (Array.isArray(declared)) {
			const result = {};
			for (const item of declared) {
				if (typeof item !== "string") continue;
				Object.assign(result, await this.readMcpServersFile(path.resolve(pluginDir, item)));
			}
			return result;
		}
		return this.normalizeMcpServers(declared, pluginDir);
	}
	async readMcpServersFile(filePath) {
		try {
			const content = await fs_promises.readFile(filePath, "utf-8");
			const parsed = JSON.parse(content);
			return this.normalizeMcpServers(parsed, path.dirname(filePath));
		} catch (error) {
			expertPluginLog.warn(`[ExpertPluginService] Failed to read MCP dependency file ${filePath}:`, error);
			return {};
		}
	}
	async normalizeMcpServers(raw, baseDir) {
		if (!isRecord(raw)) return {};
		const source = isRecord(raw.mcpServers) ? raw.mcpServers : raw;
		const result = {};
		for (const [name, config] of Object.entries(source)) if (isRecord(config)) result[name] = await this.resolveMcpIconConfig(config, baseDir);
		return result;
	}
	async resolveMcpIconConfig(config, baseDir) {
		const meta = readWorkbuddyMeta(config);
		if (!meta || typeof meta.icon !== "string" || /^(https?:|data:|file:)/.test(meta.icon)) return config;
		const icon = await this.resolveAvatarToDataUrl(meta.icon, baseDir);
		if (!icon) return config;
		return {
			...config,
			"x-workbuddy": {
				...meta,
				icon
			}
		};
	}
	/** 头像相对路径 → base64 data URL 的通用转换 */
	async resolveAvatarToDataUrl(avatarPath, baseDir) {
		if (!avatarPath) return "";
		if (/^(https?|data):/.test(avatarPath)) return avatarPath;
		const rel = avatarPath.replace(/^\.\//, "");
		const abs = path.resolve(baseDir, rel);
		const resolvedBase = path.resolve(baseDir);
		if (!abs.startsWith(resolvedBase + path.sep) && abs !== resolvedBase) return "";
		try {
			if (await pathExists$1(abs)) {
				const base64Data = (await fs_promises.readFile(abs)).toString("base64");
				return `data:${{
					png: "image/png",
					jpg: "image/jpeg",
					jpeg: "image/jpeg",
					svg: "image/svg+xml",
					webp: "image/webp",
					gif: "image/gif"
				}[path.extname(rel).replace(".", "").toLowerCase() || "png"] || "image/png"};base64,${base64Data}`;
			}
		} catch {}
		return "";
	}
};
//#endregion
//#region ../../packages/workbuddy-server/src/expert/runtime/expert-session-switcher.ts
/**
* SessionPluginSwitcher —— daemon 端专家插件的「会话内切换」薄适配（Phase 5.5）。
*
* 这是 expert 域**唯一合理留在 server 的能力**：它不属于业务 SSOT（那些已迁 core），
* 而是纯 daemon runtime 编排——通过 sidecar 查 session 的 agent-cli `acpEndpoint`，
* 再调 CLI 端 `/api/v1/plugins/*` 做 marketplace 注册 / 插件 enable·disable / agent override。
*
* 从 `plugin-service.ts` 拆出以隔离职责、独立可测。依赖（sidecar httpBase 解析 / configDir /
* plugin→marketplace 判定）由 `ExpertPluginService` 注入。
*/
var EXPERTS_MARKETPLACE$1 = "experts";
var INLINE_MARKETPLACE = "inline";
async function pathExists(p) {
	try {
		await node_fs.promises.access(p);
		return true;
	} catch {
		return false;
	}
}
var SessionPluginSwitcher = class {
	constructor(deps) {
		this.deps = deps;
		this.marketplaceRegistered = /* @__PURE__ */ new Set();
	}
	/**
	* 在指定 session 的 agent-cli runtime 内切换专家插件（enable/disable + agent override）。
	*
	* enable 时会先关掉当前 runtime 里其他已启用的 experts / my-experts 残留包
	* （含同名 @inline 镜像），避免开放平台改名后同名 skill 仍命中旧目录。
	*
	* @param enablePluginName   要 enable 的 plugin 名称（可为 undefined 表示无需 enable）
	* @param agentName  当前 session 应绑定的专家 agent 名称（可为 undefined 表示清除 override）
	* @param sourcePluginId 供 AgentManager 定位 plugin 的 "name@marketplace"；未传则用 enable 字段
	* @param internalModelRequestHeaders 要下发给 CLI 的内部模型请求临时 headers
	*/
	async switchExpertPluginForSession(sessionId, disablePluginName, enablePluginName, agentName, sourcePluginId, internalModelRequestHeaders) {
		if (!sessionId) {
			console.warn("[SessionPluginSwitcher] switchExpertPluginForSession: sessionId required");
			return false;
		}
		if (!disablePluginName && !enablePluginName && !agentName && !sourcePluginId && internalModelRequestHeaders === void 0) return false;
		const httpBase = await this.resolveSessionHttpBase(sessionId);
		if (!httpBase) {
			console.warn(`[SessionPluginSwitcher] plugin switch skipped: no acpEndpoint sessionId=${sessionId}, disable=${disablePluginName || "none"}, enable=${enablePluginName || "none"}, agent=${agentName || "none"}`);
			return false;
		}
		if (disablePluginName || enablePluginName || agentName || sourcePluginId) await this.ensureExpertsMarketplaceRegistered(httpBase);
		const leftoverDisableIds = enablePluginName ? await this.collectLeftoverExpertDisableIds(httpBase, enablePluginName, disablePluginName) : [];
		const url = `${httpBase}/api/v1/plugins/switch`;
		const payload = { persist: false };
		if (disablePluginName) payload.disable = `${disablePluginName}@${await this.deps.resolvePluginMarketplace(disablePluginName)}`;
		if (enablePluginName) payload.enable = `${enablePluginName}@${await this.deps.resolvePluginMarketplace(enablePluginName)}`;
		if (agentName) payload.agentName = agentName;
		const resolvedSourcePluginId = sourcePluginId ?? (enablePluginName ? `${enablePluginName}@${await this.deps.resolvePluginMarketplace(enablePluginName)}` : void 0);
		if (resolvedSourcePluginId) payload.sourcePluginId = resolvedSourcePluginId;
		if (internalModelRequestHeaders !== void 0) payload.internalModelRequestHeaders = internalModelRequestHeaders;
		const shouldRefreshCustomExpertAgentOverride = !!agentName && !!enablePluginName && resolvedSourcePluginId?.endsWith(`@my-experts`);
		if (shouldRefreshCustomExpertAgentOverride) {
			delete payload.agentName;
			delete payload.sourcePluginId;
			delete payload.internalModelRequestHeaders;
		}
		try {
			const primaryDisableId = typeof payload.disable === "string" ? payload.disable : void 0;
			const extraDisableIds = leftoverDisableIds.filter((id) => id !== primaryDisableId);
			for (const leftoverId of extraDisableIds) if (!await this.postPluginSwitch(url, {
				persist: false,
				disable: leftoverId
			})) console.warn(`[SessionPluginSwitcher] leftover expert plugin disable failed: sessionId=${sessionId}, disable=${leftoverId}, enable=${enablePluginName || "none"}`);
			const response = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...require_gateway_secret.gatewaySecretHeaders()
				},
				body: JSON.stringify(payload)
			});
			if (!response.ok) {
				const text = await response.text().catch(() => "");
				console.warn(`[SessionPluginSwitcher] plugin switch failed: status=${response.status} ${response.statusText}, sessionId=${sessionId}, disable=${disablePluginName || "none"}, enable=${enablePluginName || "none"}, agent=${agentName || "none"}, sourcePluginId=${resolvedSourcePluginId || "none"}, internalModelRequestHeaders=${Object.keys(internalModelRequestHeaders ?? {}).length}, body=${text}`);
				return false;
			}
			if (shouldRefreshCustomExpertAgentOverride) {
				const overrideResponse = await fetch(url, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						...require_gateway_secret.gatewaySecretHeaders()
					},
					body: JSON.stringify({
						persist: false,
						...agentName ? { agentName } : {},
						...resolvedSourcePluginId ? { sourcePluginId: resolvedSourcePluginId } : {},
						...internalModelRequestHeaders !== void 0 ? { internalModelRequestHeaders } : {}
					})
				});
				if (!overrideResponse.ok) {
					const text = await overrideResponse.text().catch(() => "");
					console.warn(`[SessionPluginSwitcher] plugin agent override refresh failed: status=${overrideResponse.status} ${overrideResponse.statusText}, sessionId=${sessionId}, agent=${agentName || "none"}, sourcePluginId=${resolvedSourcePluginId || "none"}, body=${text}`);
					return false;
				}
			}
			console.log(`[SessionPluginSwitcher] plugin switch succeeded: disable=${disablePluginName || "none"}, enable=${enablePluginName || "none"} agent=${agentName || "none"}, sourcePluginId=${resolvedSourcePluginId || "none"} internalModelRequestHeaders=${Object.keys(internalModelRequestHeaders ?? {}).length} on session ${sessionId}`);
			return true;
		} catch (error) {
			console.warn("[SessionPluginSwitcher] plugin switch request failed:", {
				sessionId,
				disablePluginName,
				enablePluginName,
				agentName,
				sourcePluginId: resolvedSourcePluginId,
				internalModelRequestHeaders: Object.keys(internalModelRequestHeaders ?? {}).length,
				error
			});
			return false;
		}
	}
	/**
	* 以当前 agent-cli runtime 的插件列表为准判断专家插件是否仍启用。
	*
	* 专家插件通过 `persist:false` 只在当前 CLI 进程内生效；WorkBuddy server 侧的
	* "已应用"缓存可能因为插件被 disable、runtime 重建等原因变旧，所以跳过
	* apply 前必须回到当前 CLI 进程查询真实状态。
	*/
	async isExpertPluginEnabledForSession(sessionId, pluginName, marketplace) {
		if (!sessionId || !pluginName || !marketplace) return false;
		const httpBase = await this.resolveSessionHttpBase(sessionId);
		if (!httpBase) return false;
		try {
			return (await this.fetchSessionPlugins(httpBase)).some((plugin) => plugin.name === pluginName && plugin.marketplace === marketplace && plugin.status === "enabled");
		} catch (error) {
			console.warn("[SessionPluginSwitcher] isExpertPluginEnabledForSession failed:", {
				sessionId,
				pluginName,
				marketplace,
				error
			});
			return false;
		}
	}
	/**
	* 开放平台改名后，本机 marketplace 仍可能残留旧专家包（含 @inline 镜像）。
	* 召唤只 enable 新包时必须先关掉这些残留，否则同名 skill 会被先注册的旧包抢走。
	*/
	async collectLeftoverExpertDisableIds(httpBase, enablePluginName, explicitDisablePluginName) {
		const plugins = await this.fetchSessionPlugins(httpBase);
		const leftoverExpertNames = new Set(plugins.filter((plugin) => plugin.status === "enabled" && plugin.name !== enablePluginName && this.isExpertMarketplace(plugin.marketplace)).map((plugin) => plugin.name));
		if (explicitDisablePluginName && explicitDisablePluginName !== enablePluginName) leftoverExpertNames.add(explicitDisablePluginName);
		return [...new Set(plugins.filter((plugin) => plugin.status === "enabled" && leftoverExpertNames.has(plugin.name) && (this.isExpertMarketplace(plugin.marketplace) || plugin.marketplace === INLINE_MARKETPLACE)).map((plugin) => `${plugin.name}@${plugin.marketplace}`))];
	}
	isExpertMarketplace(marketplace) {
		return marketplace === EXPERTS_MARKETPLACE$1 || marketplace === "my-experts";
	}
	async fetchSessionPlugins(httpBase) {
		try {
			const response = await fetch(`${httpBase}/api/v1/plugins`, { headers: require_gateway_secret.gatewaySecretHeaders() });
			if (!response.ok) {
				console.warn("[SessionPluginSwitcher] fetchSessionPlugins non-ok:", {
					httpBase,
					status: response.status,
					statusText: response.statusText
				});
				return [];
			}
			const payload = await response.json().catch(() => void 0);
			return (Array.isArray(payload) ? payload : payload && typeof payload === "object" && Array.isArray(payload.data) ? payload.data : []).flatMap((plugin) => {
				if (!plugin || typeof plugin !== "object") return [];
				const item = plugin;
				const name = typeof item.name === "string" ? item.name : "";
				const marketplace = typeof item.marketplace === "string" ? item.marketplace : "";
				const status = typeof item.status === "string" ? item.status : "";
				if (!name || !marketplace) return [];
				return [{
					name,
					marketplace,
					status
				}];
			});
		} catch (error) {
			console.warn("[SessionPluginSwitcher] fetchSessionPlugins failed:", {
				httpBase,
				error
			});
			return [];
		}
	}
	async postPluginSwitch(url, payload) {
		try {
			const response = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...require_gateway_secret.gatewaySecretHeaders()
				},
				body: JSON.stringify(payload)
			});
			if (!response.ok) {
				const text = await response.text().catch(() => "");
				console.warn(`[SessionPluginSwitcher] plugin switch failed: status=${response.status} ${response.statusText}, disable=${String(payload.disable || "none")}, enable=${String(payload.enable || "none")}, body=${text}`);
				return false;
			}
			return true;
		} catch (error) {
			console.warn("[SessionPluginSwitcher] plugin switch request failed:", {
				disable: payload.disable,
				enable: payload.enable,
				error
			});
			return false;
		}
	}
	/** 从 sidecar 查询指定 session 的 agent-cli HTTP base URL。 */
	async resolveSessionHttpBase(sessionId) {
		try {
			return await this.deps.resolveSessionHttpBase(sessionId);
		} catch (error) {
			console.warn("[SessionPluginSwitcher] resolveSessionHttpBase failed:", error);
			return;
		}
	}
	/**
	* 确保 experts marketplace（及 my-experts 自定义专家 marketplace）已在 CLI 端 PluginManager 中注册。
	*/
	async ensureExpertsMarketplaceRegistered(httpBase) {
		await this.registerMarketplaceIfNeeded(httpBase, EXPERTS_MARKETPLACE$1, this.getMarketplaceDir());
		const myExpertsDir = node_path.join(this.deps.getConfigDir(), "plugins", "marketplaces", require_tar$1.CUSTOM_EXPERT_MY_EXPERT_DIR_NAME);
		if (await pathExists(myExpertsDir)) await this.registerMarketplaceIfNeeded(httpBase, require_tar$1.CUSTOM_EXPERT_MY_EXPERT_DIR_NAME, myExpertsDir);
	}
	async registerMarketplaceIfNeeded(httpBase, marketplaceName, marketplaceDir) {
		const key = `${httpBase}:${marketplaceName}`;
		if (this.marketplaceRegistered.has(key)) return;
		try {
			const url = `${httpBase}/api/v1/plugins/marketplaces`;
			const response = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...require_gateway_secret.gatewaySecretHeaders()
				},
				body: JSON.stringify({
					source: marketplaceDir,
					name: marketplaceName
				})
			});
			if (response.ok) {
				this.marketplaceRegistered.add(key);
				console.log(`[SessionPluginSwitcher] Marketplace "${marketplaceName}" registered on ${httpBase}`);
			} else {
				const text = await response.text().catch(() => "");
				console.warn(`[SessionPluginSwitcher] Failed to register "${marketplaceName}" marketplace: ${response.status} ${text}`);
			}
		} catch (error) {
			console.warn(`[SessionPluginSwitcher] registerMarketplaceIfNeeded("${marketplaceName}") failed:`, error);
		}
	}
	getMarketplaceDir() {
		return node_path.join(this.deps.getConfigDir(), "plugins", "marketplaces", EXPERTS_MARKETPLACE$1);
	}
};
//#endregion
//#region ../../packages/workbuddy-server/src/expert/runtime/expert-plugin-runtime.ts
/**
* 专家 Plugin 服务
*
* 核心职责：
* 1. 下载 tar.gz/zip → 解压到 ~/.workbuddy/plugins/marketplaces/experts/plugins/{id}/
* 2. 更新 experts marketplace.json（让 DirectoryMarketplace 能扫描到专家）
* 3. 清理历史遗留的 plugin 目录 settings.json 中的 agent 覆盖，避免全局污染 default agent
* 4. 提供 switchExpertPluginForSession：通过 sidecar 查询 session acpEndpoint，
*    调用 CLI 的 /api/v1/plugins/switch 控制专家 plugin 在该 session 上原子切换
*
* 本地目录结构：
*   ~/.workbuddy/plugins/marketplaces/experts/
*   ├── .codebuddy-plugin/
*   │   └── marketplace.json         ← 自动生成/更新
*   └── plugins/
*       ├── TradingAgentTeam/
*       │   ├── .workbuddy-plugin/
*       │   │   └── plugin.json
*       │   ├── settings.json        ← 历史遗留的 agent 覆盖文件，启动时会清理
*       │   ├── agents/
*       │   └── skills/
*       └── InternalCommsExpert/
*           └── ...
*/
require_common$2.init_decorateMetadata();
require_common$2.init_decorate();
/** Plugin 清单文件查找目录（按优先级） */
var PLUGIN_METADATA_DIRS = [".codebuddy-plugin", ".workbuddy-plugin"];
var PLUGIN_MANIFEST_FILE = "plugin.json";
var PLUGIN_SETTINGS_FILE = "settings.json";
/** 专家 marketplace 名称 */
var EXPERTS_MARKETPLACE = "experts";
var DEFAULT_EXPERT_PLUGIN_HOST_CAPABILITIES = {
	getConfigDir: () => require_runtime_context.getWorkbuddyRuntimeConfigDir(),
	resolveSessionHttpBase: async () => void 0
};
function isEnterpriseGatewayDownloadUrl(url) {
	try {
		const { hostname, pathname } = new URL(url);
		const host = hostname.toLowerCase();
		return (host === "copilot.qq.com" || host.endsWith(".copilot.qq.com")) && pathname.includes("/v2/download/");
	} catch {
		return false;
	}
}
function stripEnterpriseGatewayDownloadParams(url) {
	const qIndex = url.indexOf("?");
	if (qIndex < 0) return url;
	const base = url.slice(0, qIndex);
	const kept = url.slice(qIndex + 1).split("&").filter((seg) => {
		const key = seg.split("=")[0];
		return key !== "q-url-param-list" && key !== "source";
	});
	return kept.length > 0 ? `${base}?${kept.join("&")}` : base;
}
var ExpertPluginService = class ExpertPluginService {
	constructor() {
		this.activeExperts = /* @__PURE__ */ new Set();
		this.expertBundleMap = /* @__PURE__ */ new Map();
		this.hostCapabilities = DEFAULT_EXPERT_PLUGIN_HOST_CAPABILITIES;
		this.customRuntime = new ExpertCustomRuntime({
			getConfigDir: () => this.getConfigDir(),
			deactivateExpert: (expertId) => this.deactivateExpert(expertId)
		});
		this.bundleRuntime = new ExpertBundleRuntime({
			getConfigDir: () => this.getConfigDir(),
			readPluginManifestAsync: (dir) => this.readPluginManifestAsync(dir),
			hasPluginManifestAsync: (dir) => this.hasPluginManifestAsync(dir),
			isTrustedDownloadUrl: (url) => this.isTrustedDownloadUrl(url),
			shouldStripEnterpriseGatewayParams: (url) => this.isEnterpriseExpertDownloadEnabled() && this.isEnterpriseGatewayBundleUrl(url),
			stripEnterpriseGatewayDownloadParams
		});
		this.dependencyRuntime = new ExpertDependencyRuntime({
			resolvePluginDir: (bundleName, marketplace) => this.resolveDependencyPluginDir(bundleName, marketplace),
			readPluginManifestAsync: (pluginDir) => this.readPluginManifestAsync(pluginDir)
		});
		this.removePersistedGeneratedAgentOverrides().catch(() => {});
	}
	setHostCapabilities(capabilities) {
		this.hostCapabilities = {
			...this.hostCapabilities,
			...capabilities
		};
	}
	getConfigDir() {
		return this.hostCapabilities.getConfigDir();
	}
	async activateExpert(expertId, pluginName, updatedAt, marketplace, downloadUrl) {
		let bundleName = pluginName;
		try {
			bundleName = bundleName || await this.lookupBundleNameFromManifestCache(expertId) || await this.lookupBundleNameFromPersistedMap(expertId) || this.toKebabCase(expertId);
			this.expertBundleMap.set(expertId, bundleName);
			await this.persistExpertBundleMapping(expertId, bundleName);
			let localPath;
			if (marketplace) localPath = this.getPluginDirForMarketplace(bundleName, marketplace);
			else localPath = await this.ensureDownloaded(bundleName, updatedAt, downloadUrl);
			const manifest = await this.readPluginManifestAsync(localPath);
			if (!manifest) return {
				success: false,
				expertType: "skill",
				error: `Failed to read plugin.json for expert: ${expertId}`
			};
			const expertType = manifest.expertType || "skill";
			const agentName = await this.resolveExpertAgentName(localPath, manifest, expertId);
			await this.updateMarketplaceManifest(bundleName, marketplace);
			await this.removeGeneratedAgentOverrideFile(localPath);
			const pluginRegisteredName = manifest.name;
			this.activeExperts.add(expertId);
			this.hostCapabilities.onRuntimeConfigChanged?.();
			require_tar$1.getBoundHostRuntimeCatalog()?.rebuild({ reason: "expert-activate" }).catch((error) => {
				console.warn("[ExpertPluginService] catalog rebuild after activate failed", error);
			});
			console.log(`[ExpertPluginService] Expert activated: ${expertId}`, {
				expertType,
				agentName,
				pluginRegisteredName,
				localPath
			});
			return {
				success: true,
				expertType,
				agentName,
				localPath,
				pluginRegisteredName
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error("[ExpertPluginService] Failed to activate expert:", {
				expertId,
				bundleName,
				pluginName,
				updatedAt,
				error
			});
			return {
				success: false,
				expertType: "skill",
				error: message
			};
		}
	}
	/**
	* Cache-only：从官方目录 manifest.json 的 plugin 字段取 COS bundle 名。
	* 匹配 id | marketExpertId | sourceId。无 kebab fallback、不读 persisted bundle map。
	*/
	async lookupCatalogPluginName(expertId) {
		return this.lookupBundleNameFromManifestCache(expertId);
	}
	/**
	* 已落地目录 hint。对齐 5.3.13：persist/内存里的值原样返回，含 kebab 猜名。
	* 只供点查已落地目录；禁止当作 omit-marketplace COS 名。
	*/
	async lookupLandedBundleHint(expertId) {
		const fromMemory = this.expertBundleMap.get(expertId);
		const fromPersist = await this.lookupBundleNameFromPersistedMap(expertId);
		for (const raw of [fromMemory, fromPersist]) if (typeof raw === "string" && raw.trim() !== "") return raw;
	}
	/**
	* 删除历史生成的 settings.json（仅清理纯 `{ agent: string }` 覆盖文件）。
	*
	* 这些文件会让 plugin-loader-manager 在 rebuildAgents 时把旧专家 agent
	* 全局 patch 到 default agent，导致会话外串脏。
	*/
	async removeGeneratedAgentOverrideFile(pluginDir) {
		try {
			const settingsPath = path.join(pluginDir, PLUGIN_SETTINGS_FILE);
			const payload = await this.readGeneratedAgentOverride(settingsPath);
			if (!payload) return;
			await fs_promises.unlink(settingsPath);
			console.log(`[ExpertPluginService] Removed stale expert settings.json: ${settingsPath}`, payload);
		} catch (error) {
			console.warn(`[ExpertPluginService] Failed to remove settings.json at ${pluginDir}:`, error);
		}
	}
	async deactivateExpert(expertId) {
		this.activeExperts.delete(expertId);
		const pluginDir = await this.getExpertLocalPath(expertId);
		if (pluginDir) await this.removeGeneratedAgentOverrideFile(pluginDir);
		this.hostCapabilities.onRuntimeConfigChanged?.();
		require_tar$1.getBoundHostRuntimeCatalog()?.rebuild({ reason: "expert-deactivate" }).catch((error) => {
			console.warn("[ExpertPluginService] catalog rebuild after deactivate failed", error);
		});
		console.log(`[ExpertPluginService] Expert deactivated: ${expertId}`);
	}
	/**
	* 原子切换专家 plugin：在一次 HTTP 调用中 disable 旧 + enable 新，只触发一次 rebuildAgents。
	* 如果 plugin 未变化但专家对应的 agent 变化，也会下发 session 级 agent override。
	*
	* @param sessionId  目标 session 的 id
	* @param disablePluginName  要 disable 的 plugin 名称（可为 undefined 表示无需 disable）
	* @param enablePluginName   要 enable 的 plugin 名称（可为 undefined 表示无需 enable）
	* @param agentName  当前 session 应绑定的专家 agent 名称（可为 undefined 表示清除 override）
	* @param sourcePluginId 供 AgentManager 定位 plugin 的 "name@marketplace"；未传则用 enable 字段
	* @param internalModelRequestHeaders 要下发给 CLI 的内部模型请求临时 headers
	*/
	async switchExpertPluginForSession(sessionId, disablePluginName, enablePluginName, agentName, sourcePluginId, internalModelRequestHeaders) {
		return this.getSessionSwitcher().switchExpertPluginForSession(sessionId, disablePluginName, enablePluginName, agentName, sourcePluginId, internalModelRequestHeaders);
	}
	/**
	* 以当前 agent-cli runtime 的插件列表为准判断专家插件是否仍启用。
	*
	* 专家插件通过 `persist:false` 只在当前 CLI 进程内生效；WorkBuddy server 侧的
	* "已应用"缓存可能因为插件被 disable、runtime 重建等原因变旧，所以跳过
	* apply 前必须回到当前 CLI 进程查询真实状态。
	*/
	async isExpertPluginEnabledForSession(sessionId, pluginName, marketplace) {
		return this.getSessionSwitcher().isExpertPluginEnabledForSession(sessionId, pluginName, marketplace);
	}
	getSessionSwitcher() {
		if (!this._sessionSwitcher) this._sessionSwitcher = new SessionPluginSwitcher({
			resolveSessionHttpBase: (sessionId) => this.hostCapabilities.resolveSessionHttpBase(sessionId),
			getConfigDir: () => this.hostCapabilities.getConfigDir(),
			resolvePluginMarketplace: (pluginName) => this.resolvePluginMarketplace(pluginName)
		});
		return this._sessionSwitcher;
	}
	getActiveExperts() {
		return [...this.activeExperts];
	}
	async isExpertDownloaded(expertId) {
		const bundleName = await this.resolveBundleName(expertId);
		return this.hasPluginManifestAsync(this.getPluginDir(bundleName));
	}
	async getExpertLocalPath(expertId, marketplace) {
		const bundleName = await this.resolveBundleName(expertId);
		return resolveLocalExpertPluginDir(this.getConfigDir(), bundleName, marketplace, (dir) => this.hasPluginManifestAsync(dir));
	}
	async resolveExpertAgentPromptSource(expertId, marketplace) {
		const pluginDir = await this.getExpertLocalPath(expertId, marketplace);
		if (!pluginDir) return;
		const manifest = await this.readPluginManifestAsync(pluginDir);
		if (!manifest) return;
		const agentName = manifest.expertType === "team" ? manifest.teamInfo?.leadAgent : await this.resolveExpertAgentName(pluginDir, manifest, expertId);
		if (!agentName) return;
		const filePath = await resolveExpertAgentMarkdownPath(pluginDir, agentName);
		return filePath ? {
			agentName,
			filePath
		} : void 0;
	}
	async getExpertManifest(expertId) {
		const bundleName = await this.resolveBundleName(expertId);
		return await this.readPluginManifestAsync(this.getPluginDir(bundleName)) ?? void 0;
	}
	async getExpertManifestFromMarketplace(expertId, marketplace) {
		const bundleName = await this.resolveBundleName(expertId);
		return await this.readPluginManifestAsync(this.getPluginDirForMarketplace(bundleName, marketplace)) ?? void 0;
	}
	async resolveExpertDependencies(expertId, pluginName, marketplace, locale = "zh") {
		return this.dependencyRuntime.resolveExpertDependencies(expertId, pluginName, marketplace, locale);
	}
	async getExpertAgentName(expertId) {
		const pluginDir = await this.getExpertLocalPath(expertId);
		if (!pluginDir) return;
		const manifest = await this.readPluginManifestAsync(pluginDir);
		if (!manifest) return;
		return this.resolveExpertAgentName(pluginDir, manifest, expertId);
	}
	async getExpertAgentNameFromMarketplace(expertId, marketplace) {
		const bundleName = await this.resolveBundleName(expertId);
		const pluginDir = this.getPluginDirForMarketplace(bundleName, marketplace);
		if (!await this.hasPluginManifestAsync(pluginDir)) return;
		const manifest = await this.readPluginManifestAsync(pluginDir);
		if (!manifest) return;
		return this.resolveExpertAgentName(pluginDir, manifest, expertId);
	}
	/**
	* 解析专家的完整位置信息（manifest + marketplace + agentName）。
	*
	* 查找优先级：hintMarketplace → 官方 experts → 自定义 my-experts。
	* 若本地无 manifest，会自动 activateExpert（下载/解压），激活后再查。
	*/
	async resolveExpertLocation(expertId, hintMarketplace) {
		let resolved = await this.findManifestAcrossMarketplaces(expertId, hintMarketplace);
		if (!resolved) {
			if (!(await this.activateExpert(expertId, void 0, void 0, hintMarketplace ?? void 0)).success) return null;
			resolved = await this.findManifestAcrossMarketplaces(expertId, hintMarketplace);
		}
		if (!resolved) return null;
		const agentName = await this.findAgentNameAcrossMarketplaces(expertId, resolved.marketplace);
		if (!agentName) return null;
		return {
			manifest: resolved.manifest,
			marketplace: resolved.marketplace,
			agentName
		};
	}
	/**
	* 按优先级在多个 marketplace 中查找 manifest。
	* 优先级：hintMarketplace → 官方 experts → 自定义 my-experts。
	*/
	async findManifestAcrossMarketplaces(expertId, hintMarketplace) {
		if (hintMarketplace) {
			const manifest = hintMarketplace === "experts" ? await this.getExpertManifest(expertId) : await this.getExpertManifestFromMarketplace(expertId, hintMarketplace);
			return manifest?.name ? {
				manifest,
				marketplace: hintMarketplace
			} : null;
		}
		const officialManifest = await this.getExpertManifest(expertId);
		if (officialManifest?.name) return {
			manifest: officialManifest,
			marketplace: "experts"
		};
		const myExpertsManifest = await this.getExpertManifestFromMarketplace(expertId, require_tar$1.CUSTOM_EXPERT_MY_EXPERT_DIR_NAME);
		if (myExpertsManifest?.name) return {
			manifest: myExpertsManifest,
			marketplace: require_tar$1.CUSTOM_EXPERT_MY_EXPERT_DIR_NAME
		};
		return null;
	}
	/**
	* 按优先级在多个 marketplace 中查找 agentName。
	* 优先级：已确定的 marketplace → 官方 experts → 自定义 my-experts。
	*/
	async findAgentNameAcrossMarketplaces(expertId, resolvedMarketplace) {
		return resolvedMarketplace === "experts" ? this.getExpertAgentName(expertId) : this.getExpertAgentNameFromMarketplace(expertId, resolvedMarketplace);
	}
	async updateMarketplaceManifest(bundleName, marketplace) {
		return this.bundleRuntime.updateMarketplaceManifest(bundleName, marketplace);
	}
	async ensureDownloaded(bundleName, updatedAt, downloadUrl) {
		return this.bundleRuntime.ensureDownloaded(bundleName, updatedAt, downloadUrl);
	}
	async lookupCatalogExpertEntry(expertId) {
		try {
			const manifestPath = path.join(this.getConfigDir(), "app", "cache", "experts", "manifest.json");
			const content = await fs_promises.readFile(manifestPath, "utf-8");
			return JSON.parse(content).experts?.find((e) => e.id === expertId || e.marketExpertId === expertId || e.sourceId === expertId || e.source_id === expertId);
		} catch {
			return;
		}
	}
	async lookupBundleNameFromManifestCache(expertId) {
		const expert = await this.lookupCatalogExpertEntry(expertId);
		return typeof expert?.plugin === "string" && expert.plugin.trim() !== "" ? expert.plugin : void 0;
	}
	uniquePersistIdentityKeys(values) {
		const seen = /* @__PURE__ */ new Set();
		const result = [];
		for (const raw of values) {
			const value = raw?.trim();
			if (!value || seen.has(value)) continue;
			seen.add(value);
			result.push(value);
		}
		return result;
	}
	getExpertBundleMapPath() {
		return path.join(this.getConfigDir(), "app", "cache", "experts", "expert-bundle-map.json");
	}
	async lookupBundleNameFromPersistedMap(expertId) {
		try {
			const content = await fs_promises.readFile(this.getExpertBundleMapPath(), "utf-8");
			const bundleName = JSON.parse(content)?.[expertId];
			return typeof bundleName === "string" && bundleName.trim() !== "" ? bundleName : void 0;
		} catch {
			return;
		}
	}
	async persistExpertBundleMapping(expertId, bundleName) {
		if (!expertId || !bundleName) return;
		const catalog = await this.lookupCatalogExpertEntry(expertId);
		const keys = this.uniquePersistIdentityKeys([
			expertId,
			catalog?.id,
			catalog?.marketExpertId,
			catalog?.sourceId,
			catalog?.source_id
		]).filter((key) => key !== bundleName);
		if (keys.length === 0) return;
		for (const key of keys) this.expertBundleMap.set(key, bundleName);
		try {
			const mapPath = this.getExpertBundleMapPath();
			let existing = {};
			try {
				const content = await fs_promises.readFile(mapPath, "utf-8");
				const parsed = JSON.parse(content);
				if (parsed && typeof parsed === "object") existing = parsed;
			} catch {}
			let changed = false;
			for (const key of keys) {
				if (existing[key] === bundleName) continue;
				existing[key] = bundleName;
				changed = true;
			}
			if (!changed) return;
			await fs_promises.mkdir(path.dirname(mapPath), { recursive: true });
			await fs_promises.writeFile(mapPath, JSON.stringify(existing, null, 2), "utf-8");
		} catch {}
	}
	async resolveBundleName(expertId) {
		const bundleName = this.expertBundleMap.get(expertId) || await this.lookupBundleNameFromManifestCache(expertId) || await this.lookupBundleNameFromPersistedMap(expertId) || expertId;
		this.expertBundleMap.set(expertId, bundleName);
		return bundleName;
	}
	/**
	* 解析当前专家真正应写入 settings.agent 的 agent 名。
	*
	* 优先级：
	* 1. plugin.json 显式声明的 agentName
	* 2. team 型专家的 teamInfo.leadAgent
	* 3. agents/ 中与 expertId slug 对应文件的 frontmatter name
	* 4. agents/ 中唯一 agent 文件的 frontmatter name
	* 5. expertId 的 kebab-case fallback
	*/
	async resolveExpertAgentName(pluginDir, manifest, expertId) {
		if (manifest.agentName) return manifest.agentName;
		if (manifest.expertType === "team" && manifest.teamInfo?.leadAgent) return manifest.teamInfo.leadAgent;
		const expertSlug = this.toKebabCase(expertId);
		return await this.resolveAgentNameFromPluginFiles(pluginDir, manifest, expertSlug) || expertSlug;
	}
	async resolveAgentNameFromPluginFiles(pluginDir, manifest, expertSlug) {
		const candidatePaths = await this.resolveAgentMarkdownFiles(pluginDir, manifest.agents);
		const matchedPath = candidatePaths.find((filePath) => path.basename(filePath, ".md") === expertSlug);
		if (matchedPath) return this.readAgentNameFromMarkdown(matchedPath);
		if (candidatePaths.length === 1) return this.readAgentNameFromMarkdown(candidatePaths[0]);
	}
	async resolveAgentMarkdownFiles(pluginDir, agents) {
		const configuredAgentPaths = this.normalizeManifestAgentPaths(agents);
		if (configuredAgentPaths.length === 0) return this.listMarkdownFiles(path.join(pluginDir, "agents"));
		return (await Promise.all(configuredAgentPaths.map(async (relativePath) => {
			const absolutePath = path.join(pluginDir, relativePath);
			try {
				const stat = await fs_promises.stat(absolutePath);
				if (stat.isDirectory()) return this.listMarkdownFiles(absolutePath);
				if (stat.isFile() && absolutePath.endsWith(".md")) return [absolutePath];
			} catch {
				return [];
			}
			return [];
		}))).flat();
	}
	normalizeManifestAgentPaths(agents) {
		if (!agents) return [];
		return (Array.isArray(agents) ? agents : [agents]).map((agentPath) => agentPath.trim()).filter((agentPath) => agentPath !== "").map((agentPath) => agentPath.replace(/^\.\//, ""));
	}
	async listMarkdownFiles(dir) {
		try {
			const entries = await fs_promises.readdir(dir, { withFileTypes: true });
			return (await Promise.all(entries.map(async (entry) => {
				const absolutePath = path.join(dir, entry.name);
				if (entry.isDirectory()) return this.listMarkdownFiles(absolutePath);
				if (entry.isFile() && entry.name.endsWith(".md")) return [absolutePath];
				return [];
			}))).flat();
		} catch {
			return [];
		}
	}
	async readAgentNameFromMarkdown(filePath) {
		try {
			const frontmatter = (await fs_promises.readFile(filePath, "utf-8")).match(/^---\s*\n([\s\S]*?)\n---/)?.[1];
			if (!frontmatter) return path.basename(filePath, ".md");
			const rawName = frontmatter.match(/^name:\s*(.+)$/m)?.[1]?.trim();
			if (!rawName) return path.basename(filePath, ".md");
			return rawName.replace(/^['"]|['"]$/g, "");
		} catch {
			return;
		}
	}
	async readGeneratedAgentOverride(settingsPath) {
		try {
			if (!await pathExists$3(settingsPath)) return null;
			const raw = await fs_promises.readFile(settingsPath, "utf-8");
			const parsed = JSON.parse(raw);
			if (Object.keys(parsed).length !== 1 || typeof parsed.agent !== "string" || parsed.agent.trim() === "") return null;
			return { agent: parsed.agent };
		} catch {
			return null;
		}
	}
	async removePersistedGeneratedAgentOverrides() {
		try {
			const pluginsDir = path.join(this.getMarketplaceDir(), "plugins");
			if (!await pathExists$3(pluginsDir)) return;
			const entries = await fs_promises.readdir(pluginsDir, { withFileTypes: true });
			for (const entry of entries) {
				if (!entry.isDirectory()) continue;
				const settingsPath = path.join(pluginsDir, entry.name, PLUGIN_SETTINGS_FILE);
				const payload = await this.readGeneratedAgentOverride(settingsPath);
				if (!payload) continue;
				await fs_promises.unlink(settingsPath);
				console.log(`[ExpertPluginService] Removed persisted expert agent override on startup: ${settingsPath}`, payload);
			}
		} catch (error) {
			console.warn("[ExpertPluginService] Failed to remove persisted expert agent overrides on startup:", error);
		}
	}
	/** 获取指定专家 marketplace 根目录，供 session-local CLI settings 注册。 */
	getExpertMarketplacePath(marketplace) {
		return path.join(this.getConfigDir(), "plugins", "marketplaces", marketplace);
	}
	/** 获取 experts marketplace 根目录 */
	getMarketplaceDir() {
		return this.getExpertMarketplacePath(EXPERTS_MARKETPLACE);
	}
	/** 获取专家 Plugin 的本地目录路径，以 bundleName（plugin 字段值）为目录名 */
	getPluginDir(bundleName) {
		const configDir = this.getConfigDir();
		return path.join(configDir, "plugins", "marketplaces", EXPERTS_MARKETPLACE, "plugins", bundleName);
	}
	/** 获取指定 marketplace 下的 Plugin 目录路径 */
	getPluginDirForMarketplace(bundleName, marketplace) {
		const configDir = this.getConfigDir();
		return path.join(configDir, "plugins", "marketplaces", marketplace, "plugins", bundleName);
	}
	/**
	* 根据 pluginName 判断所属 marketplace：
	* 优先检查 my-experts，fallback 到 experts
	*/
	async resolvePluginMarketplace(pluginName) {
		const myExpertsPath = this.getPluginDirForMarketplace(pluginName, require_tar$1.CUSTOM_EXPERT_MY_EXPERT_DIR_NAME);
		if (await this.hasPluginManifestAsync(myExpertsPath)) return require_tar$1.CUSTOM_EXPERT_MY_EXPERT_DIR_NAME;
		return EXPERTS_MARKETPLACE;
	}
	isEnterpriseExpertDownloadEnabled() {
		return (this.productManager?.getCurrentConfiguration?.()?.productFeatures)?.EnableEnterpriseExpertDownload === true;
	}
	getEnterpriseGatewayHost() {
		try {
			const endpoint = this.productManager?.getEndpoint?.();
			if (!endpoint) return;
			return new URL(endpoint).hostname.toLowerCase();
		} catch {
			return;
		}
	}
	isTrustedDownloadUrl(url) {
		try {
			const parsed = new URL(url);
			const host = parsed.hostname.toLowerCase();
			const cosHost = new URL(require_tar$1.EXPERT_CENTER_COS_CONFIG.baseUrl).hostname.toLowerCase();
			if (this.isEnterpriseExpertDownloadEnabled()) {
				const gatewayHost = this.getEnterpriseGatewayHost();
				if (gatewayHost && host === gatewayHost) return true;
			}
			return parsed.protocol === "https:" && (require_tar$1.isTrustedCosDownloadUrl(url, cosHost) || this.isEnterpriseExpertDownloadEnabled() && (host === "copilot.qq.com" || host.endsWith(".copilot.qq.com")));
		} catch {
			return false;
		}
	}
	isEnterpriseGatewayBundleUrl(url) {
		if (isEnterpriseGatewayDownloadUrl(url)) return true;
		try {
			const { hostname, pathname } = new URL(url);
			const gatewayHost = this.getEnterpriseGatewayHost();
			return !!gatewayHost && hostname.toLowerCase() === gatewayHost && pathname.includes("/v2/download/");
		} catch {
			return false;
		}
	}
	/**
	* 依赖解析路径下的专家包目录探测。
	*
	* 【语义硬约束】requirements 只读依赖声明，绝不主动下载专家包。
	* 下载能力由 summon 路径的 ensurePackageReady 负责（那条路径拿得到 downloadUrl 和 event 通道，
	* 能正确下载 openplatform 签名 URL 并通知 UI 进度）。
	*
	* 【历史 bug】旧实现在本地不命中时 fallback 到 `this.ensureDownloaded(bundleName)`（无 downloadUrl），
	* 会：
	*   1) 拼 COS 老路径 `bundles/${bundle}.tar.gz` → 新架构 openplatform 专家 404
	*   2) 占用 downloadingExperts 并发 dedupe map 的槽位 → 后到的 summon 复用这个失败 Promise
	* 表现为"专家 picker 选中后一直没法对话"。
	*
	* 【当前策略】本地不存在就返回一个占位目录（官方 marketplace 的期望路径）。
	* 上层 resolveExpertDependencies 会 readPluginManifestAsync 拿不到 manifest 就返回空依赖数组，
	* 让 UI 依赖门直接放行；真正的下载留给随后到达的 summon 完成。
	*/
	async resolveDependencyPluginDir(bundleName, marketplace) {
		if (marketplace && marketplace !== EXPERTS_MARKETPLACE) return this.getPluginDirForMarketplace(bundleName, marketplace);
		if (!marketplace) {
			const myExpertsDir = this.getPluginDirForMarketplace(bundleName, require_tar$1.CUSTOM_EXPERT_MY_EXPERT_DIR_NAME);
			if (await this.hasPluginManifestAsync(myExpertsDir)) return myExpertsDir;
		}
		return this.getPluginDir(bundleName);
	}
	/**
	* PascalCase/camelCase → kebab-case
	* 例: LivestreamEcommerceCoach → livestream-ecommerce-coach
	*      TradingAgentTeam → trading-agent-team
	*/
	toKebabCase(str) {
		return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/([A-Z])([A-Z][a-z])/g, "$1-$2").toLowerCase();
	}
	/** 检查目录下是否存在 plugin.json（支持多种元数据目录名） */
	async hasPluginManifestAsync(dir) {
		if (!await pathExists$3(dir)) return false;
		for (const metaDir of PLUGIN_METADATA_DIRS) if (await pathExists$3(path.join(dir, metaDir, PLUGIN_MANIFEST_FILE))) return true;
		return false;
	}
	/** 读取 plugin.json（异步版本，用于不阻塞主线程的场景） */
	async readPluginManifestAsync(dir) {
		for (const metaDir of PLUGIN_METADATA_DIRS) {
			const manifestPath = path.join(dir, metaDir, PLUGIN_MANIFEST_FILE);
			try {
				const content = await fs_promises.readFile(manifestPath, "utf-8");
				return JSON.parse(content);
			} catch (error) {
				if (error.code === "ENOENT") continue;
				throw new Error(`Failed to read expert manifest: ${manifestPath}`, { cause: error });
			}
		}
		return null;
	}
	async scanCustomExperts(userId) {
		return this.customRuntime.scanCustomExperts(userId);
	}
	async getCustomExpert(expertId) {
		return this.customRuntime.getCustomExpert(expertId);
	}
	async deleteCustomExpert(expertId, userId) {
		return this.customRuntime.deleteCustomExpert(expertId, userId);
	}
	async addUserExperts(userId, expertIds) {
		return this.customRuntime.addUserExperts(userId, expertIds);
	}
	getCustomExpertWatchPath() {
		return this.customRuntime.getCustomExpertWatchPath();
	}
	getCustomExpertPluginJsonPath(expertId) {
		return this.customRuntime.getCustomExpertPluginJsonPath(expertId);
	}
	async clearCustomExpertSessionMarker(expertId) {
		return this.customRuntime.clearCustomExpertSessionMarker(expertId);
	}
};
ExpertPluginService = require_common$2.__decorate([(0, import_common$1.Component)(require_tar$1.ExpertPluginServiceToken), require_common$2.__decorateMetadata("design:paramtypes", [])], ExpertPluginService);
//#endregion
//#region ../../packages/workbuddy-server/src/net/rest-operations-proxy-interceptor.ts
/**
* App-server RestOperations 代理 + 日志拦截器。
*
* 给 app-server CellJS 容器里的默认 `RestOperations`（`@celljs/http` 的 axios 实例）挂上：
*   1. 请求拦截器：按目标 URL 挂 httpsAgent/httpAgent，解决 HTTPS/HTTP 请求走代理的问题；
*      记录起始时间和代理决策；
*   2. 响应拦截器（成功 + 失败）：打一条 `[NetLog] METHOD URL -> proxy=... (status=..., ms=...)`。
*
* 这弥补了 app-server 容器里 **没有** 加载 `@genie/agent-cli` 的 HttpProxyInterceptor 的
* 覆盖空缺。具体失败 case 见 Issue 现场 main.log：
*   - `[Report Service] connect ETIMEDOUT 120.53.101.203:443`（EventService 经 RestOperations）
*   - `[ExternalLinkAuthenticationProvider] fetch auth state error: ETIMEDOUT`
*
* 关于 baseURL：`@genie/product` 的 `ProductEndpointHttpInterceptor` 在运行时用
* `config.baseURL = productManager.getEndpoint()` 动态注入。然而 axios 默认配置
* `legacyInterceptorReqResOrdering=true`，拦截器执行顺序是 **注册倒序** —— 本模块
* 作为 workbuddyModule autoBind 最后注册，实际 **最先** 执行，那时 `config.baseURL`
* 还没被 Product 拦截器填上，`resolveTargetUrl` 会拿到一个相对路径 `/v2/xxx`，URL
* 解析失败 → `shouldBypassProxy` 保守返回 true → 不挂代理 → 直连超时。
*
* 修复：在 `resolveTargetUrl` 中 fallback 到 `ContainerUtil.get(ProductManager).getEndpoint()`
* （与 `ProductEndpointHttpInterceptor` 的做法一致）。
*/
require_common$2.init_common$3();
require_common$2.init_decorateMetadata();
require_common$2.init_decorate();
var _ref$4;
var NET_LOG_KEY = "__workbuddyNetLog";
function getProductEndpointSafely() {
	try {
		return import_common$1.ContainerUtil.get(require_common$2.ProductManager)?.getEndpoint?.() || "";
	} catch {
		return "";
	}
}
function resolveTargetUrl(config) {
	const url = config.url || "";
	if (/^https?:\/\//i.test(url)) return url;
	const base = config.baseURL || getProductEndpointSafely();
	if (!base) return url;
	if (!url) return base;
	return `${base.endsWith("/") ? base.slice(0, -1) : base}${url.startsWith("/") ? url : `/${url}`}`;
}
var WorkbuddyRestOperationsProxyInterceptor = class WorkbuddyRestOperationsProxyInterceptor {
	async initialize() {
		this.restOperations.interceptors.request.use((config) => {
			const typed = config;
			try {
				const targetUrl = resolveTargetUrl(typed);
				if (targetUrl) {
					const { httpAgent, httpsAgent } = require_proxy_agents.getAxiosAgentsForUrl(targetUrl);
					if (httpAgent) typed.httpAgent = httpAgent;
					if (httpsAgent) typed.httpsAgent = httpsAgent;
					typed[NET_LOG_KEY] = {
						startedAt: Date.now(),
						method: (typed.method || "GET").toUpperCase(),
						url: targetUrl,
						proxy: require_proxy_agents.describeProxyForLog(targetUrl)
					};
				}
			} catch {}
			return typed;
		});
		this.restOperations.interceptors.response.use((response) => {
			const slot = response.config[NET_LOG_KEY];
			if (slot) require_proxy_agents.logNetRequest({
				method: slot.method,
				url: slot.url,
				proxy: slot.proxy,
				status: response.status,
				durationMs: Date.now() - slot.startedAt,
				source: "RestOperations"
			});
			return response;
		}, (error) => {
			const slot = error?.config ? error.config[NET_LOG_KEY] : void 0;
			if (slot) require_proxy_agents.logNetRequest({
				method: slot.method,
				url: slot.url,
				proxy: slot.proxy,
				status: error?.response?.status,
				durationMs: Date.now() - slot.startedAt,
				error,
				source: "RestOperations"
			});
			return Promise.reject(error);
		});
	}
};
require_common$2.__decorate([(0, import_common$1.Autowired)(import_common.RestOperations), require_common$2.__decorateMetadata("design:type", typeof (_ref$4 = typeof import_common.RestOperations !== "undefined" && import_common.RestOperations) === "function" ? _ref$4 : Object)], WorkbuddyRestOperationsProxyInterceptor.prototype, "restOperations", void 0);
WorkbuddyRestOperationsProxyInterceptor = require_common$2.__decorate([(0, import_common$1.Component)(import_common$1.ApplicationLifecycle)], WorkbuddyRestOperationsProxyInterceptor);
//#endregion
//#region ../../packages/workbuddy-server/src/net/tls-verification-interceptor.ts
/**
* App-server TLS 证书校验开关拦截器。
*
* 随 app-server CellJS 容器装配（daemon 模式跑在 daemon 进程、legacy 模式跑在主进程），
* 注入 `ProductManager`，在 `initialize()`：
*   1. 抑制 `NODE_TLS_REJECT_UNAUTHORIZED` 噪声告警；
*   2. 读取当前 `productFeatures.DisableTlsVerification` 并应用一次（覆盖本地配置）；
*   3. 订阅 `configuration` 变更（远端 `/v3/config` overlay 经 `publishResolvedConfiguration()`
*      发布后触发），命中即应用（承载服务端下发 + 运行期变更）。
*
* 这是「服务端下发」的主路径，与 bootstrap 阶段的早期同步注入互补：bootstrap 覆盖 CellJS/远端
* 就绪前的最早请求，本拦截器覆盖容器就绪后的本地/远端配置。
*
* env 为进程级全局且方向不可逆（false→true 即生效并保持），运行期不主动回退为 '1'，
* 与 CLI 的一次性 `initialize` 行为一致，避免半途切换造成连接抖动。
*
* 结构参考 `rest-operations-proxy-interceptor.ts`。
*/
require_common$2.init_common$3();
require_common$2.init_decorateMetadata();
require_common$2.init_decorate();
var _ref$3;
var DISABLE_REASON = "ProductFeature.DisableTlsVerification";
var WorkbuddyTlsVerificationInterceptor = class WorkbuddyTlsVerificationInterceptor {
	async initialize() {
		require_tls_verification.suppressTlsRejectWarning();
		this.applyFromConfiguration();
		this.productManager.configuration.subscribe(() => {
			this.applyFromConfiguration();
		});
	}
	/** 读取当前配置，命中开关则幂等关闭 TLS 校验。 */
	applyFromConfiguration() {
		if ((this.productManager.configuration.getValue() || {}).productFeatures?.[require_common$2.ProductFeature.DisableTlsVerification]) require_tls_verification.disableTlsVerificationForProcess(DISABLE_REASON);
	}
};
require_common$2.__decorate([(0, import_common$1.Autowired)(require_common$2.ProductManager), require_common$2.__decorateMetadata("design:type", typeof (_ref$3 = typeof require_common$2.ProductManager !== "undefined" && require_common$2.ProductManager) === "function" ? _ref$3 : Object)], WorkbuddyTlsVerificationInterceptor.prototype, "productManager", void 0);
WorkbuddyTlsVerificationInterceptor = require_common$2.__decorate([(0, import_common$1.Component)(import_common$1.ApplicationLifecycle)], WorkbuddyTlsVerificationInterceptor);
//#endregion
//#region ../../packages/workbuddy-server/src/runtime/custom-models-product-provider.ts
require_common$2.init_common$3();
require_common$2.init_common$4();
require_common$2.init_decorateMetadata();
require_common$2.init_decorate();
var _ref$2, _ref2$2, _ref3$1, _ref4$1, _WorkbuddyCustomModelsProductProvider;
var MODEL_TAG_CUSTOM = "custom";
var baseProductConfigurationProvider;
function setWorkbuddyCustomModelsBaseProductConfigurationProvider(provider) {
	baseProductConfigurationProvider = provider;
}
var WorkbuddyCustomModelsProductProvider = class WorkbuddyCustomModelsProductProvider {
	static {
		_WorkbuddyCustomModelsProductProvider = this;
	}
	constructor() {
		this.priority = require_common$2.ProductProviderPriority.ENV - 1e3;
		this.listenerRegistered = false;
	}
	static {
		this.FILE_WATCH_DEBOUNCE_MS = 1e3;
	}
	async provide(ctx) {
		if (!this.fs) return {};
		if (!ctx.current.productFeatures?.[require_common$2.ProductFeature.CustomModelsJSON]) {
			this.logger.info("disable use custom model");
			return {};
		}
		this.ensurePolicyListener();
		if (this.policyService) {
			const policy = this.policyService.getCachedSnapshot();
			if (!policy) {
				this.policyService.scheduleRefresh();
				this.lastAllowed = true;
			} else {
				this.lastAllowed = policy.allowed;
				if (!policy.allowed) {
					this.logger.info(`[CustomModelsProvider] policy disallow: reason=${policy.reason} mode=${policy.policy_mode} source=${policy.source}; skipping local custom models`);
					return {};
				}
			}
		}
		const userConfigPath = this.getUserConfigPath();
		this.ensureFileWatcher(userConfigPath);
		try {
			if (!this.fs.existsSync(userConfigPath)) return {};
			const content = this.fs.readFileSync(userConfigPath, { encoding: "utf-8" });
			const parsed = JSON.parse(content.toString());
			const { models: rawModels, availableModels: rawAvailableModels } = this.extractUserConfig(parsed);
			const validRawModels = rawModels.filter(require_tar$1.isValidLocalCustomModel);
			const droppedCount = rawModels.length - validRawModels.length;
			if (droppedCount > 0) this.logger.warn(`[CustomModelsProvider] dropped ${droppedCount} invalid custom model entr${droppedCount === 1 ? "y" : "ies"} from ${userConfigPath}`);
			const models = validRawModels.map((model) => this.normalizeCustomModel(model));
			if (ctx.current.productFeatures?.[require_common$2.ProductFeature.CustomModelIdPrefix]) {
				for (const model of models) if (typeof model.id === "string" && !model.id.startsWith("custom-local:")) model.id = `${require_common$2.CUSTOM_LOCAL_MODEL_PREFIX}${model.id}`;
			}
			this.logger.info(`Loaded custom models config from user: ${userConfigPath} (entries=${models.length})`);
			if (Array.isArray(rawAvailableModels)) {
				const shouldPrefixId = !!ctx.current.productFeatures?.[require_common$2.ProductFeature.CustomModelIdPrefix];
				let mergedAvailableModels = rawAvailableModels;
				if (shouldPrefixId) {
					const prefixedIds = rawAvailableModels.filter((id) => !id.startsWith(require_common$2.CUSTOM_LOCAL_MODEL_PREFIX)).map((id) => `${require_common$2.CUSTOM_LOCAL_MODEL_PREFIX}${id}`);
					mergedAvailableModels = Array.from(new Set([...rawAvailableModels, ...prefixedIds]));
				}
				return {
					models,
					availableModels: mergedAvailableModels,
					mergeStrategy: require_common$2.MergeStrategy.SmartMerge
				};
			}
			const currentAvailable = ctx.current.availableModels;
			if (Array.isArray(currentAvailable) && currentAvailable.length > 0) {
				const customIds = this.collectCustomModelIds(models);
				return {
					models,
					availableModels: Array.from(new Set([...currentAvailable, ...customIds])),
					mergeStrategy: require_common$2.MergeStrategy.SmartMerge
				};
			}
			return {
				models,
				mergeStrategy: require_common$2.MergeStrategy.SmartMerge
			};
		} catch (error) {
			this.logger.error(`Failed to load user-level custom models configuration from ${userConfigPath}`, error);
			return {};
		}
	}
	extractUserConfig(parsed) {
		if (Array.isArray(parsed)) return {
			models: parsed,
			availableModels: void 0
		};
		if (parsed !== null && typeof parsed === "object") {
			const obj = parsed;
			return {
				models: Array.isArray(obj.models) ? obj.models : [],
				availableModels: Array.isArray(obj.availableModels) ? obj.availableModels.filter((item) => typeof item === "string") : void 0
			};
		}
		return {
			models: [],
			availableModels: void 0
		};
	}
	collectCustomModelIds(models) {
		const ids = [];
		for (const model of models) {
			const rawId = model.id;
			if (typeof rawId !== "string") continue;
			const trimmed = rawId.trim();
			if (trimmed.length > 0) ids.push(trimmed);
		}
		return ids;
	}
	getUserConfigPath() {
		const configuredDir = process.env.WORKBUDDY_CONFIG_DIR?.trim() || process.env.CODEBUDDY_CONFIG_DIR?.trim();
		if (configuredDir) return node_path.join(configuredDir, "models.json");
		const dataFolderName = baseProductConfigurationProvider?.()?.dataFolderName;
		if (typeof dataFolderName === "string" && dataFolderName.trim()) return node_path.join((0, node_os.homedir)(), dataFolderName.trim(), "models.json");
		return node_path.join(require_runtime_context.getWorkbuddyRuntimeConfigDir(), "models.json");
	}
	normalizeCustomModel(model) {
		const normalizedModel = {
			disabled: false,
			...model
		};
		const tags = Array.isArray(normalizedModel.tags) ? [...normalizedModel.tags] : [];
		if (!tags.includes(MODEL_TAG_CUSTOM)) tags.push(MODEL_TAG_CUSTOM);
		normalizedModel.tags = tags;
		if (normalizedModel.apiKey) normalizedModel.apiKey = require_common$2.EnvUtils.resolveEnvVariables(normalizedModel.apiKey);
		if (normalizedModel.url) normalizedModel.url = require_common$2.EnvUtils.resolveEnvVariables(normalizedModel.url);
		for (const field of [
			"maxInputTokens",
			"maxOutputTokens",
			"temperature"
		]) {
			if (normalizedModel[field] === void 0) continue;
			const coerced = require_tar$1.coerceOptionalNumber(normalizedModel[field]);
			if (coerced === void 0) delete normalizedModel[field];
			else normalizedModel[field] = coerced;
		}
		return normalizedModel;
	}
	ensureFileWatcher(filePath) {
		if (this.fileWatcher && this.fileWatcherPath === filePath) return;
		if (this.fileWatcher) {
			this.fileWatcher.close();
			this.fileWatcher = void 0;
		}
		try {
			const dir = node_path.dirname(filePath);
			const basename = node_path.basename(filePath);
			this.fileWatcher = (0, node_fs.watch)(dir, (_, filename) => {
				if (filename === basename) this.debounceSyncForFileChange();
			});
			this.fileWatcher.on("error", () => {
				this.fileWatcher?.close();
				this.fileWatcher = void 0;
			});
			this.fileWatcherPath = filePath;
			this.logger.info(`[CustomModelsProvider] watching ${filePath} for changes`);
		} catch {}
	}
	debounceSyncForFileChange() {
		if (this.debounceSyncTimer) clearTimeout(this.debounceSyncTimer);
		this.debounceSyncTimer = setTimeout(() => {
			const productManager = this.productManager ?? (() => {
				try {
					return import_common$1.ContainerUtil.get(require_common$2.ProductManager);
				} catch {
					return;
				}
			})();
			if (!productManager) return;
			this.logger.info("[CustomModelsProvider] models.json changed, triggering sync");
			productManager.sync(true).catch((error) => {
				this.logger.warn(`[CustomModelsProvider] sync after file change failed: ${String(error)}`);
			});
		}, _WorkbuddyCustomModelsProductProvider.FILE_WATCH_DEBOUNCE_MS);
	}
	ensurePolicyListener() {
		if (this.listenerRegistered || !this.policyService) return;
		this.listenerRegistered = true;
		this.policyService.onChanged((snapshot) => {
			if (this.lastAllowed === void 0 || this.lastAllowed === snapshot.allowed) return;
			this.lastAllowed = snapshot.allowed;
			(this.productManager ?? (() => {
				try {
					return import_common$1.ContainerUtil.get(require_common$2.ProductManager);
				} catch {
					return;
				}
			})())?.sync(true).catch((error) => {
				this.logger.warn(`[CustomModelsProvider] productManager.sync failed: ${String(error)}`);
			});
		});
	}
};
require_common$2.__decorate([
	(0, import_common$1.Autowired)(require_common$2.FileSystem),
	(0, import_common$1.Optional)(),
	require_common$2.__decorateMetadata("design:type", typeof (_ref$2 = typeof require_common$2.FileSystem !== "undefined" && require_common$2.FileSystem) === "function" ? _ref$2 : Object)
], WorkbuddyCustomModelsProductProvider.prototype, "fs", void 0);
require_common$2.__decorate([(0, import_common$1.Autowired)(import_common$1.Logger), require_common$2.__decorateMetadata("design:type", typeof (_ref2$2 = typeof import_common$1.Logger !== "undefined" && import_common$1.Logger) === "function" ? _ref2$2 : Object)], WorkbuddyCustomModelsProductProvider.prototype, "logger", void 0);
require_common$2.__decorate([
	(0, import_common$1.Autowired)(require_tar$1.MemberCustomModelPolicyServiceToken),
	(0, import_common$1.Optional)(),
	require_common$2.__decorateMetadata("design:type", typeof (_ref3$1 = typeof require_tar$1.MemberCustomModelPolicyService !== "undefined" && require_tar$1.MemberCustomModelPolicyService) === "function" ? _ref3$1 : Object)
], WorkbuddyCustomModelsProductProvider.prototype, "policyService", void 0);
require_common$2.__decorate([
	(0, import_common$1.Autowired)(require_common$2.ProductManager),
	(0, import_common$1.Optional)(),
	require_common$2.__decorateMetadata("design:type", typeof (_ref4$1 = typeof require_common$2.ProductManager !== "undefined" && require_common$2.ProductManager) === "function" ? _ref4$1 : Object)
], WorkbuddyCustomModelsProductProvider.prototype, "productManager", void 0);
WorkbuddyCustomModelsProductProvider = _WorkbuddyCustomModelsProductProvider = require_common$2.__decorate([(0, import_common$1.Component)(require_common$2.ProductProvider)], WorkbuddyCustomModelsProductProvider);
//#endregion
//#region src/main/system/runtime/workspace.ts
require_workbuddy_product_config.init_bundled_assets();
require_dev_env_override.init_dev_env_override();
require_workbuddy_product_config.init_workbuddy_product_config();
require_common$2.init_common$4();
require_common$2.init_decorate();
var WorkbuddyDesktopWorkspace = class WorkbuddyDesktopWorkspace {
	folders = [{
		uri: require_common$2.URI.file(path.join(os.homedir(), "workbuddyMainThread")),
		name: "WorkbuddyDesktop",
		index: 0
	}];
	get workspaceFolders() {
		return this.folders;
	}
};
WorkbuddyDesktopWorkspace = require_common$2.__decorate([(0, import_common$1.Component)({
	id: require_common$2.Workspace,
	rebind: true
})], WorkbuddyDesktopWorkspace);
//#endregion
//#region src/main/system/runtime/workbuddy-enterprise-models-product-provider.ts
require_common$2.init_common();
require_common$2.init_common$5();
require_common$2.init_common$3();
require_common$2.init_common$4();
require_common$2.init_decorateMetadata();
require_common$2.init_decorate();
var _ref$1, _ref2$1, _ref3, _ref4, _WorkbuddyEnterpriseModelsProductProvider;
var DEFAULT_MODELS_PATH = "/console/enterprises/{enterpriseId}/config/models";
var ADMIN_MODEL_TYPE_CHAT = "chat";
/** 企业模型 last-good 持久化 key（localStorage entry），按 uid+enterpriseId+endpoint 分片存数组 */
var ENTERPRISE_MODELS_LAST_GOOD_KEY = "workbuddy_enterprise_models_last_good";
/** last-good 分片 LRU 上限，与 CloudProductManager disk cache 对齐 */
var ENTERPRISE_MODELS_LAST_GOOD_MAX = 20;
var WorkbuddyEnterpriseModelsProductProvider = class WorkbuddyEnterpriseModelsProductProvider {
	static {
		_WorkbuddyEnterpriseModelsProductProvider = this;
	}
	priority = require_common$2.ProductProviderPriority.MODELS;
	restOperations;
	authenticationManager;
	logger;
	/**
	* 跨进程 last-good 存储（issue #59223 Batch 2）。@Optional 注入：headless / 单测
	* 不注入时退回纯进程内行为（warm/persist 均 no-op），不影响主链路。
	*/
	localStorage;
	init() {
		this.authenticationManager?.currentSessionSubject.subscribe((session) => {
			const enterpriseId = session?.account?.enterpriseId;
			if (enterpriseId && !this.hasTriggeredSyncForEnterprise) {
				this.hasTriggeredSyncForEnterprise = true;
				this.logger.info(`[WorkbuddyEnterpriseModels] enterpriseId became available: ${enterpriseId}, triggering sync`);
				setImmediate(() => {
					import_common$1.ContainerUtil.get(require_common$2.ProductManager)?.sync(true);
				});
			}
		});
	}
	hasTriggeredSyncForEnterprise = false;
	/**
	* 已尝试从磁盘 warm 的 last-good key。
	* - 同一 key 只读一次盘，避免每次 provide 命中 IO。
	* - key 变化（切租户 / 切 endpoint）时清空内存 cachedResult，防止旧租户结果串用。
	*/
	lastWarmedKey;
	/**
	* 上一次成功获取的配置。API 失败/空响应时复用此结果作为兜底，
	* 避免 merge 后配置抖动让 ProductManager 反复判定变更，
	* 也避免企业模型从客户端模型列表里短暂"消失"（issue #52373）。
	*/
	cachedResult;
	/**
	* 失败/空响应后的退避截止时间。在此时间之前直接复用上一份结果，
	* 不再重打接口。force 同步（如 enterpriseId 就绪后的显式重试）可绕过退避。
	*/
	retryBackoffUntil = 0;
	/** 连续失败次数，用于指数退避 */
	consecutiveFailures = 0;
	/** 失败退避最小间隔 30s */
	static MIN_FAILURE_BACKOFF_MS = 30 * 1e3;
	/** 失败退避最大间隔 5min */
	static MAX_FAILURE_BACKOFF_MS = 300 * 1e3;
	async provide(ctx) {
		if (!this.restOperations || !this.authenticationManager) return {};
		const session = this.authenticationManager.currentSessionSubject.value;
		const enterpriseId = session?.account?.enterpriseId;
		this.logger.info(`[WorkbuddyEnterpriseModels] enterpriseId: ${enterpriseId || "undefined"}, endpoint: ${ctx.current?.endpoint}`);
		if (!enterpriseId) return {};
		const endpoint = require_dev_env_override.resolveEndpointOverride() ?? ctx.current?.endpoint;
		if (!endpoint) {
			this.logger.warn("[WorkbuddyEnterpriseModels] endpoint is missing, skipping API call");
			return {};
		}
		const lastGoodKey = this.buildLastGoodKey(session?.account?.uid, enterpriseId, endpoint);
		await this.warmLastGoodFromDisk(lastGoodKey);
		if (!ctx.force && Date.now() < this.retryBackoffUntil) {
			this.logger.debug("[WorkbuddyEnterpriseModels] in failure backoff window, reusing last result");
			return this.getFallbackResult();
		}
		const modelsUrl = DEFAULT_MODELS_PATH.replace("{enterpriseId}", enterpriseId);
		try {
			const url = new URL(modelsUrl, endpoint);
			const res = await this.restOperations.get(url.href, {
				baseURL: endpoint,
				timeout: 5e3
			});
			if (res?.data?.data?.length) {
				const models = res.data.data.map((model) => ({
					...model,
					modelType: model.id?.startsWith("custom:") ? "enterprise" : "built-in"
				}));
				this.logger.info(`[WorkbuddyEnterpriseModels] Got ${models.length} models from API`);
				const result = this.processModelAgentRelations(ctx.current, models);
				this.cachedResult = result;
				this.consecutiveFailures = 0;
				this.retryBackoffUntil = 0;
				this.persistLastGood(lastGoodKey, result);
				return result;
			}
			this.logger.warn("[WorkbuddyEnterpriseModels] API returned empty or invalid data");
			this.applyFailureBackoff();
			return this.getFallbackResult();
		} catch (error) {
			this.logger.error(`[WorkbuddyEnterpriseModels] API call failed: ${error}`);
			this.applyFailureBackoff();
			return this.getFallbackResult();
		}
	}
	/**
	* 兜底结果：优先复用上一份成功获取的配置，避免空响应/异常导致 merge 后
	* 配置抖动、企业模型短暂消失。没有缓存时（首次启动等）返回空对象，
	* 维持 4.22.16 上原有的 `return {}` 语义。
	*/
	getFallbackResult() {
		return this.cachedResult ?? {};
	}
	/**
	* 构建企业模型 last-good 的稳定 hash key：uid + enterpriseId + endpoint。
	* - 含 enterpriseId → 天然防串租户；含 endpoint → 防串环境。
	* - md5 后存储，不在明文 key 中暴露身份/域名，且不含 token。
	* - uid 缺失（未登录早期）返回 undefined → warm/persist 均 no-op，退回纯进程内行为。
	*/
	buildLastGoodKey(uid, enterpriseId, endpoint) {
		if (!uid) return;
		return require_common$2.HashUtils.md5([
			uid,
			enterpriseId,
			endpoint
		].join("|"));
	}
	/**
	* 进程内 cachedResult 为空时，从磁盘按 key 读回一次企业模型 last-good 暖到内存。
	* - lastWarmedKey 去重：同一 key 只读一次盘，避免每次 provide 命中 IO。
	* - 切 key（切租户 / 切 endpoint）时先清空内存 cachedResult，防止旧租户结果串用，
	*   再尝试读新 key 的 last-good。
	* - 读失败仅 warn，不阻断主链路。
	*/
	async warmLastGoodFromDisk(key) {
		if (!key || !this.localStorage) return;
		if (this.lastWarmedKey === key) return;
		this.lastWarmedKey = key;
		this.cachedResult = void 0;
		try {
			const item = (await this.localStorage.get(ENTERPRISE_MODELS_LAST_GOOD_KEY, []) ?? []).find((i) => i.key === key);
			if (item?.data) {
				this.cachedResult = item.data;
				this.logger.info(`[WorkbuddyEnterpriseModels] warmed last-good from disk (models=${item.data.models?.length ?? 0})`);
			}
		} catch (error) {
			this.logger.warn(`[WorkbuddyEnterpriseModels] read last-good from disk failed: ${String(error)}`);
		}
	}
	/**
	* API 权威成功后把企业模型配置写盘做 last-good。
	* - 内容 hash 去重：与同 key 已存内容一致则跳过写，避免重复 IO。
	* - LRU 截断到 {@link ENTERPRISE_MODELS_LAST_GOOD_MAX}。
	* - 异步写、写失败仅 warn，不阻断主链路。
	* - 企业模型配置不含 token，写盘安全（不持久化任何身份凭证）。
	*/
	persistLastGood(key, data) {
		if (!key || !this.localStorage) return;
		this.writeLastGoodToDisk(this.localStorage, key, data).catch((error) => {
			this.logger.warn(`[WorkbuddyEnterpriseModels] persist last-good failed: ${String(error)}`);
		});
	}
	async writeLastGoodToDisk(storage, key, data) {
		const hash = require_common$2.HashUtils.md5(JSON.stringify(data));
		const arr = await storage.get(ENTERPRISE_MODELS_LAST_GOOD_KEY, []) ?? [];
		const idx = arr.findIndex((i) => i.key === key);
		if (idx !== -1 && arr[idx].hash === hash) return;
		if (idx !== -1) arr.splice(idx, 1);
		arr.push({
			key,
			hash,
			data,
			ts: Date.now()
		});
		while (arr.length > ENTERPRISE_MODELS_LAST_GOOD_MAX) arr.shift();
		await storage.set(ENTERPRISE_MODELS_LAST_GOOD_KEY, arr);
	}
	/**
	* 记录一次失败/空响应并设置指数退避截止时间（30s ~ 5min）。
	*/
	applyFailureBackoff() {
		this.consecutiveFailures += 1;
		const backoff = Math.min(_WorkbuddyEnterpriseModelsProductProvider.MIN_FAILURE_BACKOFF_MS * 2 ** (this.consecutiveFailures - 1), _WorkbuddyEnterpriseModelsProductProvider.MAX_FAILURE_BACKOFF_MS);
		this.retryBackoffUntil = Date.now() + backoff;
		this.logger.warn(`[WorkbuddyEnterpriseModels] backing off model API for ${backoff}ms after ${this.consecutiveFailures} consecutive failure(s)`);
	}
	processModelAgentRelations(config, models) {
		const agents = config.agents ? config.agents.map((a) => ({
			...a,
			models: []
		})) : [];
		const taggedModels = models.map((model) => ({
			...model,
			modelType: model.id?.startsWith("custom:") ? "enterprise" : "built-in"
		}));
		for (const model of taggedModels) if ((model.tags ?? []).includes(ADMIN_MODEL_TYPE_CHAT)) {
			for (const agent of agents) if (!agent.models.includes(model.id)) agent.models.unshift(model.id);
		}
		return {
			mergeStrategy: require_common$2.MergeStrategy.DeepSmartMerge,
			models: taggedModels,
			agents
		};
	}
};
require_common$2.__decorate([
	(0, import_common$1.Autowired)(import_common.RestOperations),
	(0, import_common$1.Optional)(),
	require_common$2.__decorateMetadata("design:type", typeof (_ref$1 = typeof import_common.RestOperations !== "undefined" && import_common.RestOperations) === "function" ? _ref$1 : Object)
], WorkbuddyEnterpriseModelsProductProvider.prototype, "restOperations", void 0);
require_common$2.__decorate([
	(0, import_common$1.Autowired)(require_common$2.AuthenticationManager),
	(0, import_common$1.Optional)(),
	require_common$2.__decorateMetadata("design:type", typeof (_ref2$1 = typeof require_common$2.AuthenticationManager !== "undefined" && require_common$2.AuthenticationManager) === "function" ? _ref2$1 : Object)
], WorkbuddyEnterpriseModelsProductProvider.prototype, "authenticationManager", void 0);
require_common$2.__decorate([(0, import_common$1.Autowired)(import_common$1.Logger), require_common$2.__decorateMetadata("design:type", typeof (_ref3 = typeof import_common$1.Logger !== "undefined" && import_common$1.Logger) === "function" ? _ref3 : Object)], WorkbuddyEnterpriseModelsProductProvider.prototype, "logger", void 0);
require_common$2.__decorate([
	(0, import_common$1.Autowired)(require_common$2.LocalStorage),
	(0, import_common$1.Optional)(),
	require_common$2.__decorateMetadata("design:type", typeof (_ref4 = typeof require_common$2.LocalStorage !== "undefined" && require_common$2.LocalStorage) === "function" ? _ref4 : Object)
], WorkbuddyEnterpriseModelsProductProvider.prototype, "localStorage", void 0);
require_common$2.__decorate([
	(0, import_common$1.PostConstruct)(),
	require_common$2.__decorateMetadata("design:type", Function),
	require_common$2.__decorateMetadata("design:paramtypes", []),
	require_common$2.__decorateMetadata("design:returntype", void 0)
], WorkbuddyEnterpriseModelsProductProvider.prototype, "init", null);
WorkbuddyEnterpriseModelsProductProvider = _WorkbuddyEnterpriseModelsProductProvider = require_common$2.__decorate([(0, import_common$1.Component)(require_common$2.ProductProvider)], WorkbuddyEnterpriseModelsProductProvider);
//#endregion
//#region src/main/system/runtime/workbuddy-file-local-storage.ts
require_common$2.init_common$5();
require_common$2.init_common$4();
require_workbuddy_paths.init_workbuddy_paths();
require_common$2.init_decorateMetadata();
require_common$2.init_decorate();
var LOCAL_STORAGE_FOLDER = "local_storage";
var ENTRY_PREFIX = "wb_entry_";
var ENTRY_EXT = ".info";
var logger = require_logger.createWorkbuddyScopedLogger("WorkbuddyFileLocalStorage");
var WorkbuddyFileLocalStorage = class WorkbuddyFileLocalStorage {
	emitter = new import_common$1.Emitter();
	changeEvent = this.emitter.event;
	init() {
		logger.info(`initialized, storageRoot=${this.resolveStorageRoot()}`);
	}
	async set(key, value) {
		const entryPath = this.resolveEntryPath(key);
		const entryDir = path.default.dirname(entryPath);
		try {
			if (!fs.existsSync(entryDir)) fs.mkdirSync(entryDir, { recursive: true });
			fs.writeFileSync(entryPath, JSON.stringify(value));
			logger.info(`set succeeded, keyHash=${this.resolveKeyHash(key)}`);
			this.emitter.fire({ domain: key });
		} catch (error) {
			logger.error(`set failed, keyHash=${this.resolveKeyHash(key)}, error=${this.formatError(error)}`);
			throw error;
		}
	}
	getSync(key, defaultValue) {
		const entryPath = this.resolveEntryPath(key);
		const keyHash = this.resolveKeyHash(key);
		try {
			if (!fs.existsSync(entryPath)) {
				logger.info(`get missed, keyHash=${keyHash}`);
				return defaultValue;
			}
			const content = fs.readFileSync(entryPath, { encoding: "utf-8" });
			try {
				logger.info(`get hit, keyHash=${keyHash}`);
				return JSON.parse(content.toString());
			} catch (error) {
				logger.warn(`get failed to parse cache, keyHash=${keyHash}, error=${this.formatError(error)}`);
				return defaultValue;
			}
		} catch (error) {
			logger.warn(`get failed, keyHash=${keyHash}, error=${this.formatError(error)}`);
			return defaultValue;
		}
	}
	async get(key, defaultValue) {
		return this.getSync(key, defaultValue);
	}
	async remove(key) {
		const entryPath = this.resolveEntryPath(key);
		const keyHash = this.resolveKeyHash(key);
		try {
			if (fs.existsSync(entryPath)) fs.rmSync(entryPath);
			logger.info(`remove succeeded, keyHash=${keyHash}`);
			this.emitter.fire({ domain: key });
		} catch (error) {
			logger.error(`remove failed, keyHash=${keyHash}, error=${this.formatError(error)}`);
			throw error;
		}
	}
	resolveEntryPath(key) {
		return path.default.join(this.resolveStorageRoot(), `${ENTRY_PREFIX}${this.resolveKeyHash(key)}${ENTRY_EXT}`);
	}
	resolveStorageRoot() {
		return path.default.join(this.resolveHomeDir(), LOCAL_STORAGE_FOLDER);
	}
	resolveHomeDir() {
		return require_workbuddy_paths.getWorkbuddyConfigDir();
	}
	resolveKeyHash(key) {
		return require_common$2.HashUtils.md5(key);
	}
	formatError(error) {
		return error instanceof Error ? error.message : String(error);
	}
};
require_common$2.__decorate([
	(0, import_common$1.PostConstruct)(),
	require_common$2.__decorateMetadata("design:type", Function),
	require_common$2.__decorateMetadata("design:paramtypes", []),
	require_common$2.__decorateMetadata("design:returntype", void 0)
], WorkbuddyFileLocalStorage.prototype, "init", null);
WorkbuddyFileLocalStorage = require_common$2.__decorate([(0, import_common$1.Component)({
	id: require_common$2.LocalStorage,
	rebind: true
})], WorkbuddyFileLocalStorage);
//#endregion
//#region src/main/system/runtime/workbuddy-product-env-service.ts
require_common$2.init_common();
require_common$2.init_common$3();
require_common$2.init_decorateMetadata();
require_common$2.init_decorate();
var _ref, _ref2;
var WorkbuddyProductEnvService = class WorkbuddyProductEnvService {
	logger;
	productManager;
	lastSwitchedEnv;
	init() {
		this.logger.setContext("WorkbuddyProductEnvService");
		const currentEnv = process.env[require_common$2.ENV_KEY_CODEBUDDY_COPILOT_INTERNET_ENVIRONMENT];
		if (currentEnv) {
			this.lastSwitchedEnv = currentEnv;
			return;
		}
		const resolvedEnv = require_workbuddy_product_config.resolveWorkbuddyProductEnvironmentFromSessionFile();
		if (resolvedEnv) {
			process.env[require_common$2.ENV_KEY_CODEBUDDY_COPILOT_INTERNET_ENVIRONMENT] = resolvedEnv;
			this.lastSwitchedEnv = resolvedEnv;
		}
	}
	async switch(env) {
		if (env) {
			if (env === this.lastSwitchedEnv && process.env["CODEBUDDY_COPILOT_INTERNET_ENVIRONMENT"] === env) return;
			this.lastSwitchedEnv = env;
			process.env[require_common$2.ENV_KEY_CODEBUDDY_COPILOT_INTERNET_ENVIRONMENT] = env;
			return;
		}
		this.lastSwitchedEnv = void 0;
		delete process.env[require_common$2.ENV_KEY_CODEBUDDY_COPILOT_INTERNET_ENVIRONMENT];
	}
	async switchBySession(session) {
		const coordinator = this.getCoordinator();
		const resolvedEnv = session ? coordinator.resolveEnvironment(session, this.productManager.configuration.getValue()) : void 0;
		await this.switch(resolvedEnv);
		coordinator.publishResolvedSnapshot(session, this.productManager.configuration.getValue(), "product-env-switch");
	}
	async getCurrent() {
		const currentEnv = process.env[require_common$2.ENV_KEY_CODEBUDDY_COPILOT_INTERNET_ENVIRONMENT];
		if (currentEnv) return currentEnv;
		const session = import_common$1.ContainerUtil.get(require_common$2.AuthenticationManager).currentSessionSubject.getValue();
		return this.getCoordinator().getResolvedSnapshot(this.productManager.configuration.getValue(), session).networkEnvironment;
	}
	getCoordinator() {
		return import_common$1.ContainerUtil.get(require_tls_verification.WorkbuddyAuthProductCoordinator);
	}
};
require_common$2.__decorate([(0, import_common$1.Autowired)(import_common$1.Logger), require_common$2.__decorateMetadata("design:type", typeof (_ref = typeof import_common$1.Logger !== "undefined" && import_common$1.Logger) === "function" ? _ref : Object)], WorkbuddyProductEnvService.prototype, "logger", void 0);
require_common$2.__decorate([(0, import_common$1.Autowired)(require_common$2.ProductManager), require_common$2.__decorateMetadata("design:type", typeof (_ref2 = typeof require_common$2.ProductManager !== "undefined" && require_common$2.ProductManager) === "function" ? _ref2 : Object)], WorkbuddyProductEnvService.prototype, "productManager", void 0);
require_common$2.__decorate([
	(0, import_common$1.PostConstruct)(),
	require_common$2.__decorateMetadata("design:type", Function),
	require_common$2.__decorateMetadata("design:paramtypes", []),
	require_common$2.__decorateMetadata("design:returntype", void 0)
], WorkbuddyProductEnvService.prototype, "init", null);
WorkbuddyProductEnvService = require_common$2.__decorate([(0, import_common$1.Component)({
	id: require_common$2.ProductEnvService,
	rebind: true
})], WorkbuddyProductEnvService);
//#endregion
//#region src/main/system/runtime/index.ts
require_dev_env_override.init_dev_env_override();
require_workbuddy_product_config.init_workbuddy_product_config();
if (process.env.NODE_ENV === "development" || require_dev_env_override.isDevEnvSwitchBuildEnabled()) require_dev_env_override.forceEnableDevEnvOverride();
require_file_authentication_storage.setWorkbuddyAuthenticationConfigurationProvider(require_workbuddy_product_config.getWorkbuddyAuthenticationConfiguration);
setWorkbuddyAuthDevEnvProvider({
	isOverrideEnabled: require_dev_env_override.isDevEnvOverrideEnabled,
	readDevEnv: require_dev_env_override.readDevEnv
});
require_tar$1.setConnectorDevEnvProvider({ readDevEnv: require_dev_env_override.readConnectorDevEnv });
setWorkbuddyAuthSessionSyncer((session) => import_common$1.ContainerUtil.get(require_tls_verification.WorkbuddyAuthProductCoordinator).syncResolvedProduct(session));
require_module_base.setWorkbuddyClientInfoAssetResolver(require_workbuddy_product_config.resolveBundledAsset);
setConnectorBundledAssetResolver(require_workbuddy_product_config.resolveBundledAsset);
setArdotEmbedUrlProvider({ resolveEmbedUrl: require_dev_env_override.resolveArdotEndpoint });
setWorkbuddyCustomModelsBaseProductConfigurationProvider(require_workbuddy_product_config.tryGetWorkbuddyBaseProductConfiguration);
require_module_base.setDevEnvEndpointResolver({ resolve: require_dev_env_override.resolveEndpointOverride });
require_tar$1.setConnectorOAuthMetricReporter(require_tar$1.createMonitorReporter(async () => {
	const { DesktopMonitorService } = await Promise.resolve().then(() => require("./desktop-monitor-service2.js"));
	return DesktopMonitorService.getSharedInstance();
}));
//#endregion
//#region src/main/module.app-server.ts
if (typeof require_module_base.WorkbuddyInternetEnviromentProductProvider !== "function") throw new Error("WorkbuddyInternetEnviromentProductProvider registration is unavailable; check @genie/workbuddy-server subpath export shape");
var workbuddyAppServerModule = require_module_base.createWorkbuddyAutoBindModule();
//#endregion
exports.baseModules = require_module_base.baseModules;
exports.default = workbuddyAppServerModule;
