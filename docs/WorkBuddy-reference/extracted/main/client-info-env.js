const require_chunk = require("./chunk.js");
const require_common$1 = require("./common.js");
const require_dist$2 = require("./dist2.js");
let fs = require("fs");
let os = require("os");
os = require_chunk.__toESM(os);
let path = require("path");
path = require_chunk.__toESM(path);
let node_child_process = require("node:child_process");
let node_fs = require("node:fs");
node_fs = require_chunk.__toESM(node_fs);
let node_os = require("node:os");
node_os = require_chunk.__toESM(node_os);
let node_crypto = require("node:crypto");
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
//#region ../../packages/workbuddy-server/src/runtime/machine-uuid.ts
var import_common$10 = require_common$1.require_common$1();
require_common$1.init_decorate();
require_common$1.init_decorateMetadata();
/**
* Resolve a stable per-machine identifier.
*
* Mirrors `packages/agent-cli/src/node/client/machine-uuid.ts` so telemetry
* reported from WorkBuddy app-server carries the same `machineId` as telemetry
* reported from the bundled agent-cli sub-process.
*/
var cachedUuid;
var uuidRegex = /\w{8}-\w{4}-\w{4}-\w{4}-\w{12}/;
function linuxUuid() {
	try {
		const content = (0, node_fs.readFileSync)("/var/lib/dbus/machine-id", { encoding: "utf8" });
		if (!content) return (0, node_crypto.randomUUID)();
		let formatted = content.replace(/\s+/, "");
		if (!/-/.test(formatted) && formatted.length > 20) formatted = `${formatted.slice(0, 8)}-${formatted.slice(8, 12)}-${formatted.slice(12, 16)}-${formatted.slice(16, 20)}-${formatted.slice(20)}`;
		return formatted;
	} catch {
		return (0, node_crypto.randomUUID)();
	}
}
function osxUuid() {
	try {
		const stdout = (0, node_child_process.execFileSync)("ioreg", [
			"-rd1",
			"-c",
			"IOPlatformExpertDevice"
		], { encoding: "utf8" });
		for (const line of stdout.split("\n")) if (/IOPlatformUUID/.test(line) && uuidRegex.test(line)) {
			const match = uuidRegex.exec(line)?.[0];
			if (match) return match;
		}
	} catch {}
	return (0, node_crypto.randomUUID)();
}
function winUuid() {
	try {
		const stdout = (0, node_child_process.execFileSync)("reg", [
			"query",
			"HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography",
			"/v",
			"MachineGuid"
		], {
			encoding: "utf8",
			windowsHide: true
		});
		const match = uuidRegex.exec(stdout);
		if (match) return match[0];
	} catch {
		try {
			const stdout = (0, node_child_process.execFileSync)("wmic", [
				"csproduct",
				"get",
				"UUID"
			], {
				encoding: "utf8",
				windowsHide: true
			});
			for (const line of stdout.split("\n")) if (uuidRegex.test(line)) {
				const match = uuidRegex.exec(line)?.[0];
				if (match) return match;
			}
		} catch {}
	}
	return (0, node_crypto.randomUUID)();
}
function machineIdSync() {
	if (cachedUuid) return cachedUuid;
	const resolver = {
		darwin: osxUuid,
		win32: winUuid,
		linux: linuxUuid
	}[node_os.default.platform()];
	cachedUuid = resolver ? resolver() : (0, node_crypto.randomUUID)();
	return cachedUuid;
}
//#endregion
//#region ../../packages/binary-manager/src/types.ts
var BinaryErrorCode, BinaryError;
var init_types = require_chunk.__esmMin((() => {
	BinaryErrorCode = /* @__PURE__ */ function(BinaryErrorCode) {
		BinaryErrorCode["DETECTION_FAILED"] = "DETECTION_FAILED";
		BinaryErrorCode["VERSION_PARSE_FAILED"] = "VERSION_PARSE_FAILED";
		BinaryErrorCode["DOWNLOAD_FAILED"] = "DOWNLOAD_FAILED";
		BinaryErrorCode["DOWNLOAD_TIMEOUT"] = "DOWNLOAD_TIMEOUT";
		BinaryErrorCode["CHECKSUM_MISMATCH"] = "CHECKSUM_MISMATCH";
		BinaryErrorCode["NETWORK_ERROR"] = "NETWORK_ERROR";
		BinaryErrorCode["EXTRACT_FAILED"] = "EXTRACT_FAILED";
		BinaryErrorCode["PERMISSION_DENIED"] = "PERMISSION_DENIED";
		BinaryErrorCode["DISK_FULL"] = "DISK_FULL";
		BinaryErrorCode["VERIFICATION_FAILED"] = "VERIFICATION_FAILED";
		BinaryErrorCode["NO_MATCHING_VERSION"] = "NO_MATCHING_VERSION";
		BinaryErrorCode["BINARY_NOT_FOUND"] = "BINARY_NOT_FOUND";
		BinaryErrorCode["BINARY_CORRUPTED"] = "BINARY_CORRUPTED";
		return BinaryErrorCode;
	}({});
	BinaryError = class extends Error {
		constructor(message, code, cause) {
			super(message);
			this.code = code;
			this.cause = cause;
			this.name = "BinaryError";
		}
	};
}));
//#endregion
//#region ../../packages/binary-manager/src/binary/binary-protocol.ts
var BinaryManager, BinaryDetector, BinaryDownloader, BinaryInstaller, BinaryResolver, BinaryRegistry, BinaryPromptGenerator, BinaryCleaner;
var init_binary_protocol = require_chunk.__esmMin((() => {
	BinaryManager = Symbol("BinaryManager");
	BinaryDetector = Symbol("BinaryDetector");
	BinaryDownloader = Symbol("BinaryDownloader");
	BinaryInstaller = Symbol("BinaryInstaller");
	BinaryResolver = Symbol("BinaryResolver");
	BinaryRegistry = Symbol("BinaryRegistry");
	BinaryPromptGenerator = Symbol("BinaryPromptGenerator");
	BinaryCleaner = Symbol("BinaryCleaner");
}));
//#endregion
//#region ../../packages/binary-manager/src/platform/platform-protocol.ts
var PlatformAdapter;
var init_platform_protocol = require_chunk.__esmMin((() => {
	PlatformAdapter = Symbol("PlatformAdapter");
}));
//#endregion
//#region ../../packages/binary-manager/src/binary/binary-registry.ts
/**
* 二进制注册表 - 持久化元信息到 registry.json
*/
var _ref$7, _ref2$6, SYSTEM_CACHE_TTL, KNOWN_SOURCES, BinaryRegistryImpl;
var init_binary_registry = require_chunk.__esmMin((() => {
	init_platform_protocol();
	init_binary_protocol();
	SYSTEM_CACHE_TTL = 1440 * 60 * 1e3;
	KNOWN_SOURCES = ["system", "managed"];
	BinaryRegistryImpl = class BinaryRegistryImpl {
		constructor() {
			this.data = {
				version: 1,
				lastUpdated: 0,
				binaries: {},
				systemDetectionCache: {}
			};
		}
		get registryPath() {
			return path.join(this.platformAdapter.binariesDir, ".cache", "registry.json");
		}
		async load() {
			try {
				const content = await fs_promises.readFile(this.registryPath, "utf-8");
				const parsed = JSON.parse(content);
				this.sanitizeLoadedData(parsed);
				this.data = parsed;
			} catch (error) {
				if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) this.logger.warn("Failed to load binary registry, using defaults", String(error));
			}
		}
		/**
		* 对反序列化后的 registry 做防御性清理：
		* - 丢弃 source 值不在 KNOWN_SOURCES 列表中的条目（老版本/脏数据）
		*/
		sanitizeLoadedData(data) {
			if (!data.binaries) return;
			for (const type of Object.keys(data.binaries)) {
				const versions = data.binaries[type];
				if (!versions) continue;
				for (const version of Object.keys(versions)) {
					const entry = versions[version];
					if (!entry || !KNOWN_SOURCES.includes(entry.source)) {
						this.logger.warn(`Registry entry ${type}@${version} has unknown source "${entry?.source}", skipping`);
						delete versions[version];
					}
				}
			}
		}
		/**
		* 原子写入：先写临时文件，再 rename 替换
		*/
		async save() {
			const dir = path.dirname(this.registryPath);
			await fs_promises.mkdir(dir, { recursive: true });
			this.data.lastUpdated = Date.now();
			const tmpPath = `${this.registryPath}.tmp`;
			try {
				await fs_promises.writeFile(tmpPath, JSON.stringify(this.data, null, 2), "utf-8");
				await fs_promises.rename(tmpPath, this.registryPath);
			} catch (error) {
				await fs_promises.rm(tmpPath, { force: true }).catch(() => {});
				this.logger.warn("Failed to save binary registry", String(error));
			}
		}
		async register(info, skipSave = false) {
			if (!this.data.binaries[info.type]) this.data.binaries[info.type] = {};
			this.data.binaries[info.type][info.version] = {
				source: info.source,
				executablePath: info.executablePath,
				installPath: info.installPath ?? "",
				installedAt: info.installedAt ?? Date.now(),
				verified: info.verified,
				size: info.size,
				mtimeMs: info.mtimeMs
			};
			if (!skipSave) await this.save();
		}
		async unregister(type, version) {
			if (this.data.binaries[type]) delete this.data.binaries[type][version];
			await this.save();
		}
		getAll() {
			const result = [];
			for (const [type, versions] of Object.entries(this.data.binaries)) {
				if (!versions) continue;
				for (const [version, entry] of Object.entries(versions)) result.push({
					type,
					version,
					source: entry.source,
					executablePath: entry.executablePath,
					installPath: entry.installPath,
					installedAt: entry.installedAt,
					verified: entry.verified,
					size: entry.size,
					mtimeMs: entry.mtimeMs
				});
			}
			return result;
		}
		getManagedEntry(type, version) {
			const entry = this.data.binaries[type]?.[version];
			if (!entry) return null;
			return {
				type,
				version,
				source: entry.source,
				executablePath: entry.executablePath,
				installPath: entry.installPath,
				installedAt: entry.installedAt,
				verified: entry.verified,
				size: entry.size,
				mtimeMs: entry.mtimeMs
			};
		}
		getSystemCache(type) {
			const cache = this.data.systemDetectionCache[type];
			if (!cache || !cache.path) return null;
			if (Date.now() - cache.detectedAt > SYSTEM_CACHE_TTL) return null;
			return {
				type,
				version: cache.version,
				source: "system",
				executablePath: cache.path,
				verified: true
			};
		}
		setSystemCache(type, info) {
			if (info) this.data.systemDetectionCache[type] = {
				path: info.executablePath,
				version: info.version,
				detectedAt: Date.now()
			};
			else this.data.systemDetectionCache[type] = null;
		}
	};
	require_common$1.__decorate([(0, import_common$10.Autowired)(import_common$10.Logger), require_common$1.__decorateMetadata("design:type", typeof (_ref$7 = typeof import_common$10.Logger !== "undefined" && import_common$10.Logger) === "function" ? _ref$7 : Object)], BinaryRegistryImpl.prototype, "logger", void 0);
	require_common$1.__decorate([(0, import_common$10.Autowired)(PlatformAdapter), require_common$1.__decorateMetadata("design:type", typeof (_ref2$6 = typeof PlatformAdapter !== "undefined" && PlatformAdapter) === "function" ? _ref2$6 : Object)], BinaryRegistryImpl.prototype, "platformAdapter", void 0);
	BinaryRegistryImpl = require_common$1.__decorate([(0, import_common$10.Component)(BinaryRegistry)], BinaryRegistryImpl);
}));
//#endregion
//#region ../../packages/binary-manager/src/binary/type-configs/cos-preload.ts
var COS_PRELOAD_BASE_URL;
var init_cos_preload = require_chunk.__esmMin((() => {
	COS_PRELOAD_BASE_URL = "https://acc-1258344699.cos.ap-guangzhou.myqcloud.com/workbuddy/binaries";
}));
//#endregion
//#region ../../packages/binary-manager/src/binary/type-configs/node-config.ts
/**
* Node.js 类型配置
*/
var nodeConfig;
var init_node_config = require_chunk.__esmMin((() => {
	init_cos_preload();
	nodeConfig = {
		executableName: {
			unix: "node",
			win32: "node.exe"
		},
		requiredFiles: { win32: [
			"node.exe",
			"npm.cmd",
			"npx.cmd",
			path.join("node_modules", "npm", "bin", "npm-cli.js")
		] },
		parseVersion: (output) => {
			const match = output.match(/v?(\d+\.\d+\.\d+)/);
			return match ? match[1] : null;
		},
		versionVerifyRegex: /v?\d+\.\d+\.\d+/,
		downloadSources: [
			{
				name: "cos-preloaded",
				urlTemplate: `${COS_PRELOAD_BASE_URL}/node/{filename}`,
				priority: 0
			},
			{
				name: "npmmirror",
				urlTemplate: "https://npmmirror.com/mirrors/node/v{version}/{filename}",
				priority: 1
			},
			{
				name: "nodejs-official",
				urlTemplate: "{url}",
				priority: 2
			}
		],
		systemSearchPaths: {
			darwin: ["/usr/local/bin/node", "/opt/homebrew/bin/node"],
			linux: ["/usr/local/bin/node", "/usr/bin/node"],
			win32: [
				"C:\\Program Files\\nodejs\\node.exe",
				"%PROGRAMFILES%\\nodejs\\node.exe",
				"%APPDATA%\\nvm\\v*\\node.exe",
				"%USERPROFILE%\\.volta\\bin\\node.exe"
			]
		},
		blockedEnvVars: ["NODE_PATH", "NPM_CONFIG_PREFIX"],
		buildIsolatedEnv: (binary) => {
			const env = { NPM_CONFIG_LOGLEVEL: "error" };
			if (binary.installPath) {
				const npmConfigDir = path.join(binary.installPath, ".npm-config");
				env.NPM_CONFIG_USERCONFIG = path.join(npmConfigDir, ".npmrc");
				env.NPM_CONFIG_GLOBALCONFIG = path.join(npmConfigDir, ".npmrc");
				env.NPM_CONFIG_CACHE = path.join(binary.installPath, ".npm-cache");
			}
			return env;
		},
		promptInstructions: "For Node.js packages: use `npm install` (local). Never `npm install -g`."
	};
}));
//#endregion
//#region ../../packages/binary-manager/src/binary/type-configs/python-config.ts
/**
* Python 类型配置
*/
/**
* 给 macOS Python 主二进制做 ad-hoc 重签并附加 Hardened Runtime 兼容 entitlements。
*
* 双签名路径设计（与 CI 互补）：
*   - CI 路径：vendor/python.zip 在 SIGN_MAC 阶段就被腾讯证书 + entitlements 签好；
*     这里检测 ent 已存在 → 直接 return，零开销。
*   - 直链下载路径：binary-manager 从 GitHub astral-sh/python-build-standalone 下载的版本
*     上游不带 entitlements，需要这里 ad-hoc 重签补上，否则 Hardened Runtime 的 library
*     validation 会阻止加载 ad-hoc 签名的 PyPI C 扩展，报错
*     "mapping process and mapped file (non-platform) have different Team IDs"。
*
* 失败容错：所有 codesign 异常向上抛，由 binary-installer 的 try/catch 转 warn 不阻塞。
*/
async function signDarwinPythonWithEntitlements(execPath) {
	try {
		const { stdout } = await execFileAsync$2("codesign", [
			"-d",
			"--entitlements",
			"-",
			"--xml",
			execPath
		], { encoding: "utf8" });
		if (RE_DISABLE_LIB_VALIDATION.test(stdout)) return;
	} catch {}
	const plistPath = path.join(os.tmpdir(), `wb-py-ent-${process.pid}-${Date.now()}.plist`);
	await fs.promises.writeFile(plistPath, PYTHON_DARWIN_ENTITLEMENTS, "utf8");
	try {
		await execFileAsync$2("codesign", ["--remove-signature", execPath]);
		await execFileAsync$2("codesign", [
			"--sign",
			"-",
			"--force",
			"--options",
			"runtime",
			"--entitlements",
			plistPath,
			execPath
		]);
	} finally {
		await fs.promises.unlink(plistPath).catch(() => void 0);
	}
}
var execFileAsync$2, PYTHON_DARWIN_ENTITLEMENTS, RE_DISABLE_LIB_VALIDATION, pythonConfig;
var init_python_config = require_chunk.__esmMin((() => {
	init_cos_preload();
	execFileAsync$2 = (0, util.promisify)(child_process.execFile);
	PYTHON_DARWIN_ENTITLEMENTS = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key><true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
    <key>com.apple.security.cs.allow-dyld-environment-variables</key><true/>
    <key>com.apple.security.cs.disable-library-validation</key><true/>
</dict>
</plist>
`;
	RE_DISABLE_LIB_VALIDATION = /<key>\s*com\.apple\.security\.cs\.disable-library-validation\s*<\/key>\s*<true\s*\/>/i;
	pythonConfig = {
		executableName: {
			unix: "python3",
			win32: "python.exe"
		},
		parseVersion: (output) => {
			const match = output.match(/Python\s+(\d+\.\d+\.\d+)/i);
			return match ? match[1] : null;
		},
		versionVerifyRegex: /Python\s+\d+\.\d+\.\d+/i,
		downloadSources: [{
			name: "cos-preloaded",
			urlTemplate: `${COS_PRELOAD_BASE_URL}/python/{filename}`,
			priority: 0
		}, {
			name: "github-releases",
			urlTemplate: "{url}",
			priority: 1
		}],
		systemSearchPaths: {
			darwin: [
				"/usr/bin/python3",
				"/usr/local/bin/python3",
				"/opt/homebrew/bin/python3",
				"/opt/homebrew/opt/python@3.11/bin/python3",
				"/opt/homebrew/opt/python@3.12/bin/python3",
				"/opt/homebrew/opt/python@3.13/bin/python3"
			],
			linux: [
				"/usr/bin/python3",
				"/usr/local/bin/python3",
				"/usr/bin/python3.11",
				"/usr/bin/python3.12",
				"/usr/bin/python3.13"
			],
			win32: [
				"C:\\Python3*\\python.exe",
				"%LOCALAPPDATA%\\Programs\\Python\\Python3*\\python.exe",
				"%USERPROFILE%\\AppData\\Local\\Programs\\Python\\Python3*\\python.exe",
				"%PROGRAMFILES%\\Python3*\\python.exe",
				"%LOCALAPPDATA%\\Microsoft\\WindowsApps\\python3.exe"
			]
		},
		blockedEnvVars: [
			"PYTHONPATH",
			"PYTHONHOME",
			"PYTHONUSERBASE",
			"VIRTUAL_ENV",
			"CONDA_PREFIX",
			"CONDA_DEFAULT_ENV",
			"PYENV_ROOT",
			"PYENV_VERSION",
			"PIP_INDEX_URL",
			"PIP_TRUSTED_HOST"
		],
		buildIsolatedEnv: () => ({
			PIP_NO_INPUT: "1",
			PYTHONUNBUFFERED: "1",
			PYTHONNOUSERSITE: "1",
			PYTHONDONTWRITEBYTECODE: "1",
			PIP_CONFIG_FILE: process.platform === "win32" ? "NUL" : "/dev/null"
		}),
		promptInstructions: "For Python packages: use `<python-path> -m venv .venv` + `.venv/bin/pip install`. Never `pip install` globally.",
		postInstall: async (_tempDir, execPath, platform) => {
			if (platform !== "darwin") return;
			await signDarwinPythonWithEntitlements(execPath);
		}
	};
}));
//#endregion
//#region ../../packages/binary-manager/src/binary/type-configs/index.ts
/** 获取所有已注册的二进制类型 */
function getRegisteredBinaryTypes() {
	return Object.keys(BINARY_TYPE_CONFIGS);
}
/** 获取指定类型的配置，类型不存在时抛异常 */
function getBinaryTypeConfig(type) {
	const config = BINARY_TYPE_CONFIGS[type];
	if (!config) throw new Error(`Unknown binary type: ${type}`);
	return config;
}
var BINARY_TYPE_CONFIGS;
var init_type_configs = require_chunk.__esmMin((() => {
	init_node_config();
	init_python_config();
	init_cos_preload();
	BINARY_TYPE_CONFIGS = {
		python: pythonConfig,
		node: nodeConfig
	};
}));
//#endregion
//#region ../../packages/binary-manager/src/binary/binary-detector.ts
function parseVersion(type, output) {
	return getBinaryTypeConfig(type).parseVersion(output);
}
var import_common$9, _ref$6, _ref2$5, execFileAsync$1, WHICH_PROBE_TIMEOUT_MS, VERSION_PROBE_TIMEOUT_MS, VERIFY_PROBE_TIMEOUT_MS, BinaryDetectorImpl;
var init_binary_detector = require_chunk.__esmMin((() => {
	import_common$9 = require_common$1.require_common$1();
	init_platform_protocol();
	init_binary_protocol();
	init_type_configs();
	require_common$1.init_decorateMetadata();
	require_common$1.init_decorate();
	execFileAsync$1 = (0, util.promisify)(child_process.execFile);
	WHICH_PROBE_TIMEOUT_MS = 3e3;
	VERSION_PROBE_TIMEOUT_MS = 5e3;
	VERIFY_PROBE_TIMEOUT_MS = 1e4;
	BinaryDetectorImpl = class BinaryDetectorImpl {
		async detectSystem(type) {
			const forceMissing = process.env.WORKBUDDY_BINARY_MANAGER_FORCE_MISSING;
			if (forceMissing) {
				const list = forceMissing.split(",").map((s) => s.trim().toLowerCase());
				if (forceMissing === "1" || list.includes(type)) return null;
			}
			const whichResult = await this.findViaWhich(type);
			if (whichResult) return whichResult;
			const searchPaths = this.platformAdapter.getSystemSearchPaths(type);
			for (const searchPath of searchPaths) {
				const resolvedPaths = await this.resolveGlobPath(searchPath);
				for (const resolvedPath of resolvedPaths) {
					const info = await this.detectAtPath(type, resolvedPath);
					if (info) return info;
				}
			}
			return null;
		}
		async detectManaged(type) {
			const versionsDir = path.join(this.platformAdapter.binariesDir, type, "versions");
			const results = [];
			try {
				const entries = await fs_promises.readdir(versionsDir);
				for (const entry of entries) {
					if (entry.includes(".installing") || entry.includes(".deleting.") || entry.endsWith(".tmp") || entry.endsWith(".downloading")) continue;
					const installPath = path.join(versionsDir, entry);
					const execPath = this.platformAdapter.getExecutablePath(type, entry);
					try {
						await fs_promises.access(execPath);
						if (!await this.hasRequiredFiles(type, installPath)) {
							this.logger.warn(`Managed binary ${type}@${entry} is incomplete; skipping candidate`);
							continue;
						}
						results.push({
							type,
							version: entry,
							source: "managed",
							executablePath: execPath,
							installPath,
							verified: false
						});
					} catch {}
				}
			} catch {}
			return results;
		}
		/**
		* 探测某可执行文件的版本号：fs.access + `<bin> --version` + parseVersion。
		* 任何失败（不存在/无权限/超时/输出不可解析）统一返回 null。detectAtPath 与
		* verify 共用，避免两份并行维护的探测逻辑（超时/可执行权限差异由参数控制）。
		*/
		async probeVersion(execPath, type, timeoutMs, accessMode) {
			try {
				await fs_promises.access(execPath, accessMode);
				const { stdout } = await execFileAsync$1(execPath, ["--version"], { timeout: timeoutMs });
				return parseVersion(type, stdout);
			} catch {
				return null;
			}
		}
		async verify(info) {
			if (info.source === "managed" && !await this.hasRequiredFiles(info.type, info.installPath ?? path.dirname(info.executablePath))) return false;
			if (await this.probeVersion(info.executablePath, info.type, VERIFY_PROBE_TIMEOUT_MS, fs_promises.constants.X_OK) === null) return false;
			try {
				const stat = await fs_promises.stat(info.executablePath);
				info.size = stat.size;
				info.mtimeMs = stat.mtimeMs;
			} catch {}
			return true;
		}
		async verifyByStat(cached) {
			if (cached.source === "managed" && !await this.hasRequiredFiles(cached.type, cached.installPath ?? path.dirname(cached.executablePath))) return false;
			if (cached.size === void 0 || cached.mtimeMs === void 0) return false;
			try {
				const stat = await fs_promises.stat(cached.executablePath);
				return stat.size === cached.size && stat.mtimeMs === cached.mtimeMs;
			} catch {
				return false;
			}
		}
		async hasRequiredFiles(type, installPath) {
			const files = getBinaryTypeConfig(type).requiredFiles?.[process.platform] ?? [];
			if (files.length === 0) return true;
			for (const file of files) try {
				await fs_promises.access(path.join(installPath, file));
			} catch {
				return false;
			}
			return true;
		}
		async findViaWhich(type) {
			const execName = this.platformAdapter.getExecutableName(type);
			const whichCmd = process.platform === "win32" ? "where" : "which";
			try {
				const { stdout } = await execFileAsync$1(whichCmd, [execName], { timeout: WHICH_PROBE_TIMEOUT_MS });
				const execPath = stdout.trim().split("\n")[0].trim();
				if (!execPath) return null;
				return this.detectAtPath(type, execPath);
			} catch {
				return null;
			}
		}
		/**
		* 探测指定路径下的可执行文件并解析版本号
		*/
		async detectAtPath(type, execPath) {
			const version = await this.probeVersion(execPath, type, VERSION_PROBE_TIMEOUT_MS);
			if (!version) return null;
			return {
				type,
				version,
				source: "system",
				executablePath: execPath,
				verified: true
			};
		}
		/**
		* 简单的通配符路径解析
		* 支持 * 通配符（仅一级）
		*/
		async resolveGlobPath(searchPath) {
			if (!searchPath.includes("*")) return [searchPath];
			const dir = path.dirname(searchPath);
			const pattern = path.basename(searchPath);
			const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
			try {
				const parentDir = path.dirname(dir);
				const dirPattern = path.basename(dir);
				if (dirPattern.includes("*")) {
					const dirRegex = new RegExp("^" + dirPattern.replace(/\*/g, ".*") + "$");
					const parentEntries = await fs_promises.readdir(parentDir);
					const results = [];
					for (const entry of parentEntries) if (dirRegex.test(entry)) {
						const fullPath = path.join(parentDir, entry, path.basename(searchPath));
						results.push(fullPath);
					}
					return results;
				} else return (await fs_promises.readdir(dir)).filter((e) => regex.test(e)).map((e) => path.join(dir, e));
			} catch {
				return [];
			}
		}
	};
	require_common$1.__decorate([(0, import_common$9.Autowired)(import_common$9.Logger), require_common$1.__decorateMetadata("design:type", typeof (_ref$6 = typeof import_common$9.Logger !== "undefined" && import_common$9.Logger) === "function" ? _ref$6 : Object)], BinaryDetectorImpl.prototype, "logger", void 0);
	require_common$1.__decorate([(0, import_common$9.Autowired)(PlatformAdapter), require_common$1.__decorateMetadata("design:type", typeof (_ref2$5 = typeof PlatformAdapter !== "undefined" && PlatformAdapter) === "function" ? _ref2$5 : Object)], BinaryDetectorImpl.prototype, "platformAdapter", void 0);
	BinaryDetectorImpl = require_common$1.__decorate([(0, import_common$9.Component)(BinaryDetector)], BinaryDetectorImpl);
}));
//#endregion
//#region ../../packages/core/src/node/utils/proxy-agent-util.ts
/**
* 读取并规范化环境变量里的代理 URL。
*
* 没有配置 / 配置非法时返回 undefined。允许 `host:port` 这种没有 scheme 的输入。
*/
function getProxyUrlFromEnv() {
	const raw = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
	if (!raw) return;
	const candidate = raw.includes("://") ? raw : `http://${raw}`;
	try {
		const parsed = new URL(candidate);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
		return parsed.toString();
	} catch {
		return;
	}
}
/**
* 目标 URL 是否应绕过代理（loopback 或命中 NO_PROXY）。
*/
function shouldBypassProxyForUrl(targetUrl) {
	let hostname;
	try {
		hostname = new URL(targetUrl).hostname.toLowerCase();
	} catch {
		return true;
	}
	if (LOOPBACK_HOSTS.has(hostname)) return true;
	const noProxy = process.env.NO_PROXY || process.env.no_proxy;
	if (!noProxy) return false;
	for (const entry of noProxy.split(",")) {
		const pattern = entry.trim().toLowerCase();
		if (!pattern) continue;
		if (pattern === "*" || pattern === hostname) return true;
		const suffix = pattern.startsWith(".") ? pattern : `.${pattern}`;
		if (hostname.endsWith(suffix)) return true;
	}
	return false;
}
/**
* 把代理 URL 脱敏成 `host:port` 便于日志（去掉用户名/密码）。
*/
function sanitizeProxyForLog(proxyUrl) {
	try {
		const parsed = new URL(proxyUrl);
		const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
		return `${parsed.hostname}:${port}`;
	} catch {
		return "<invalid-proxy>";
	}
}
/**
* 返回一个日志友好的"本次请求走哪"字符串：`proxy=host:port` 或 `DIRECT`。
*/
function describeProxyForNodeRequest(targetUrl) {
	const proxy = getProxyUrlFromEnv();
	if (!proxy || shouldBypassProxyForUrl(targetUrl)) return "DIRECT";
	return `proxy=${sanitizeProxyForLog(proxy)}`;
}
function getAgentBundle(proxyUrl) {
	if (!agentCache) agentCache = /* @__PURE__ */ new Map();
	let bundle = agentCache.get(proxyUrl);
	if (bundle) return bundle;
	const { HttpProxyAgent } = require_dist$2.require_dist$1();
	const { HttpsProxyAgent } = require_dist$2.require_dist();
	bundle = {
		http: new HttpProxyAgent(proxyUrl, KEEP_ALIVE_OPTS),
		https: new HttpsProxyAgent(proxyUrl, KEEP_ALIVE_OPTS)
	};
	agentCache.set(proxyUrl, bundle);
	return bundle;
}
/**
* 根据目标 URL 返回对应协议的 Node agent。
*
* 返回 undefined 表示不需要挂 agent（无代理或 bypass）。调用方通常把它塞到
* `http.request(url, { agent, ... })` / `https.get(url, { agent, ... })`。
*/
function resolveNodeProxyAgent(targetUrl) {
	const proxyUrl = getProxyUrlFromEnv();
	if (!proxyUrl || shouldBypassProxyForUrl(targetUrl)) return;
	let protocol;
	try {
		protocol = new URL(targetUrl).protocol;
	} catch {
		return;
	}
	const bundle = getAgentBundle(proxyUrl);
	if (protocol === "http:") return bundle.http;
	if (protocol === "https:") return bundle.https;
}
var LOOPBACK_HOSTS, KEEP_ALIVE_OPTS, agentCache;
var init_proxy_agent_util = require_chunk.__esmMin((() => {
	LOOPBACK_HOSTS = new Set([
		"localhost",
		"127.0.0.1",
		"::1",
		"[::1]"
	]);
	KEEP_ALIVE_OPTS = {
		keepAlive: true,
		keepAliveMsecs: 2e3
	};
}));
//#endregion
//#region ../../packages/binary-manager/src/manifest/manifest-protocol.ts
var ManifestManager;
var init_manifest_protocol = require_chunk.__esmMin((() => {
	ManifestManager = Symbol("ManifestManager");
}));
//#endregion
//#region ../../packages/binary-manager/src/utils/retry.ts
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
function isRetryableError(error) {
	if (error instanceof BinaryError) return [
		BinaryErrorCode.NETWORK_ERROR,
		BinaryErrorCode.DOWNLOAD_TIMEOUT,
		BinaryErrorCode.CHECKSUM_MISMATCH
	].includes(error.code);
	return false;
}
async function withRetry(operation, options = {}) {
	const opts = {
		...DEFAULT_RETRY_OPTIONS,
		...options
	};
	let lastError = null;
	let delay = opts.initialDelay;
	for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) try {
		return await operation();
	} catch (error) {
		lastError = error;
		if (attempt === opts.maxAttempts) break;
		if (!isRetryableError(error)) break;
		await sleep(delay);
		delay = Math.min(delay * opts.backoffFactor, opts.maxDelay);
	}
	throw lastError;
}
var DEFAULT_RETRY_OPTIONS;
var init_retry = require_chunk.__esmMin((() => {
	init_types();
	DEFAULT_RETRY_OPTIONS = {
		maxAttempts: 3,
		initialDelay: 1e3,
		maxDelay: 3e4,
		backoffFactor: 2
	};
}));
//#endregion
//#region ../../packages/binary-manager/src/binary/binary-downloader.ts
/** 把字节数格式化为人类可读的字符串（如 "42.3 MB"）。 */
function formatBytes$1(bytes) {
	if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
	const units = [
		"B",
		"KB",
		"MB",
		"GB"
	];
	let value = bytes;
	let unitIdx = 0;
	while (value >= 1024 && unitIdx < units.length - 1) {
		value /= 1024;
		unitIdx++;
	}
	return `${value.toFixed(value >= 10 || unitIdx === 0 ? 0 : 1)} ${units[unitIdx]}`;
}
var import_common$8, _ref$5, _ref2$4, _ref3$3, _BinaryDownloaderImpl, BinaryDownloaderImpl;
var init_binary_downloader = require_chunk.__esmMin((() => {
	import_common$8 = require_common$1.require_common$1();
	init_proxy_agent_util();
	init_manifest_protocol();
	init_platform_protocol();
	init_types();
	init_retry();
	init_binary_protocol();
	init_type_configs();
	require_common$1.init_decorateMetadata();
	require_common$1.init_decorate();
	BinaryDownloaderImpl = class BinaryDownloaderImpl {
		static {
			_BinaryDownloaderImpl = this;
		}
		constructor() {
			this.tasks = /* @__PURE__ */ new Map();
			this.abortControllers = /* @__PURE__ */ new Map();
		}
		static {
			this.HTTP_IDLE_TIMEOUT_MS = 12e4;
		}
		async download(type, version, options) {
			const manifest = await this.manifestManager.getManifest();
			const platform = this.platformAdapter.platform;
			const versionEntry = manifest.binaries[type]?.versions[version];
			if (!versionEntry) throw new BinaryError(`Version ${version} not found in manifest for ${type}`, BinaryErrorCode.NO_MATCHING_VERSION);
			const platformEntry = versionEntry[platform];
			if (!platformEntry) throw new BinaryError(`Platform ${platform} not supported for ${type} ${version}`, BinaryErrorCode.NO_MATCHING_VERSION);
			const cacheDir = path.join(this.platformAdapter.binariesDir, ".cache", "downloads");
			const filename = path.basename(new URL(platformEntry.url).pathname);
			const cachedPath = path.join(cacheDir, filename);
			try {
				await fs_promises.access(cachedPath);
				if (platformEntry.sha256 && await this.verifyChecksum(cachedPath, platformEntry.sha256)) {
					this.logger.info(`Using cached download: ${cachedPath}`);
					return cachedPath;
				}
				await fs_promises.rm(cachedPath, { force: true });
			} catch {}
			const taskId = crypto.randomUUID();
			const task = {
				id: taskId,
				type,
				version,
				platform,
				url: platformEntry.url,
				sha256: platformEntry.sha256,
				status: "pending",
				progress: 0
			};
			this.tasks.set(taskId, task);
			const tempPath = `${cachedPath}.${process.pid}.downloading`;
			try {
				await fs_promises.mkdir(cacheDir, { recursive: true });
				task.status = "downloading";
				const sources = getBinaryTypeConfig(type).downloadSources;
				await this.downloadWithFallback(sources, {
					url: platformEntry.url,
					version,
					filename
				}, tempPath, options);
				task.status = "verifying";
				if (platformEntry.sha256) {
					if (!await this.verifyChecksum(tempPath, platformEntry.sha256)) {
						await fs_promises.rm(tempPath, { force: true });
						throw new BinaryError(`Checksum mismatch for ${filename}`, BinaryErrorCode.CHECKSUM_MISMATCH);
					}
				}
				try {
					await fs_promises.rename(tempPath, cachedPath);
				} catch {
					await fs_promises.rm(tempPath, { force: true }).catch(() => {});
					if (!platformEntry.sha256 || await this.verifyChecksum(cachedPath, platformEntry.sha256)) {} else throw new BinaryError(`Failed to cache download for ${filename}`, BinaryErrorCode.DOWNLOAD_FAILED);
				}
				task.status = "completed";
				task.progress = 100;
				return cachedPath;
			} catch (error) {
				task.status = "failed";
				task.error = error instanceof Error ? error.message : String(error);
				await fs_promises.rm(tempPath, { force: true }).catch(() => {});
				throw error;
			} finally {
				setTimeout(() => {
					this.tasks.delete(taskId);
				}, 300 * 1e3);
			}
		}
		cancel(taskId) {
			const controller = this.abortControllers.get(taskId);
			if (controller) {
				controller.abort();
				this.abortControllers.delete(taskId);
			}
		}
		getTask(taskId) {
			return this.tasks.get(taskId) ?? null;
		}
		/**
		* 按优先级依次尝试多个下载源
		*/
		async downloadWithFallback(sources, params, destPath, options) {
			const sorted = [...sources].sort((a, b) => a.priority - b.priority);
			let lastError = null;
			for (const source of sorted) {
				const url = source.urlTemplate.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? "");
				try {
					await withRetry(() => this.downloadFile(url, destPath, options), { maxAttempts: 2 });
					this.logger.info(`Downloaded from ${source.name}: ${url}`);
					return;
				} catch (error) {
					lastError = error;
					await fs_promises.rm(destPath, { force: true }).catch(() => {});
					this.logger.warn(`Download from ${source.name} failed (${error?.message ?? error}), trying next source...`);
				}
			}
			throw new BinaryError(`All download sources failed: ${lastError?.message}`, BinaryErrorCode.DOWNLOAD_FAILED, lastError ?? void 0);
		}
		/**
		* 下载单个文件
		*/
		downloadFile(url, destPath, options, redirectCount = 0) {
			if (redirectCount > 10) return Promise.reject(new BinaryError(`Too many redirects: ${url}`, BinaryErrorCode.NETWORK_ERROR));
			return new Promise((resolve, reject) => {
				const protocol = url.startsWith("https:") ? https : http;
				const agent = resolveNodeProxyAgent(url);
				const requestOptions = {
					timeout: _BinaryDownloaderImpl.HTTP_IDLE_TIMEOUT_MS,
					...agent ? { agent } : {}
				};
				const proxyDesc = describeProxyForNodeRequest(url);
				this.logger.info(`[NetLog] GET ${url} -> ${proxyDesc} (source=BinaryDownloader)`);
				const request = protocol.get(url, requestOptions, (response) => {
					if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
						response.resume();
						this.downloadFile(response.headers.location, destPath, options, redirectCount + 1).then(resolve).catch(reject);
						return;
					}
					if (response.statusCode !== 200) {
						response.resume();
						reject(new BinaryError(`HTTP ${response.statusCode}: ${url}`, BinaryErrorCode.NETWORK_ERROR));
						return;
					}
					const totalSize = parseInt(response.headers["content-length"] ?? "0", 10);
					let downloadedSize = 0;
					const startedAt = Date.now();
					let lastLoggedBucket = -1;
					let headerLogged = false;
					const fileStream = (0, fs.createWriteStream)(destPath);
					response.pipe(fileStream);
					response.on("data", (chunk) => {
						downloadedSize += chunk.length;
						if (!headerLogged) {
							headerLogged = true;
							const sizeLabel = totalSize > 0 ? formatBytes$1(totalSize) : "unknown size";
							this.logger.info(`Download started (${sizeLabel}): ${url}`);
						}
						if (totalSize > 0) {
							const bucket = Math.floor(downloadedSize / totalSize * 100 / 5);
							if (bucket > lastLoggedBucket) {
								lastLoggedBucket = bucket;
								const elapsedSec = Math.max((Date.now() - startedAt) / 1e3, .001);
								const speed = downloadedSize / elapsedSec;
								const pct = Math.round(downloadedSize / totalSize * 100);
								this.logger.info(`Download progress ${pct}% (${formatBytes$1(speed)}/s)`);
							}
						}
						if (options?.onProgress && totalSize > 0) options.onProgress(downloadedSize, totalSize);
					});
					fileStream.on("finish", resolve);
					fileStream.on("error", (err) => {
						fs_promises.rm(destPath, { force: true }).catch(() => {});
						reject(new BinaryError(`File write error: ${err.message}`, BinaryErrorCode.DOWNLOAD_FAILED, err));
					});
				});
				request.on("error", (err) => {
					reject(new BinaryError(`Network error: ${err.message}`, BinaryErrorCode.NETWORK_ERROR, err));
				});
				request.on("timeout", () => {
					request.destroy();
					reject(new BinaryError(`Download timeout (${_BinaryDownloaderImpl.HTTP_IDLE_TIMEOUT_MS}ms idle): ${url}`, BinaryErrorCode.DOWNLOAD_TIMEOUT));
				});
				if (options?.signal) options.signal.addEventListener("abort", () => {
					request.destroy();
					reject(/* @__PURE__ */ new Error("Download aborted"));
				});
			});
		}
		/**
		* 验证文件 SHA256（流式读取，避免大文件内存溢出）
		*/
		verifyChecksum(filePath, expectedSha256) {
			if (!expectedSha256) return Promise.resolve(true);
			return new Promise((resolve, reject) => {
				const hash = crypto.createHash("sha256");
				const stream = (0, fs.createReadStream)(filePath);
				stream.on("data", (chunk) => hash.update(chunk));
				stream.on("end", () => resolve(hash.digest("hex") === expectedSha256));
				stream.on("error", reject);
			});
		}
	};
	require_common$1.__decorate([(0, import_common$8.Autowired)(import_common$8.Logger), require_common$1.__decorateMetadata("design:type", typeof (_ref$5 = typeof import_common$8.Logger !== "undefined" && import_common$8.Logger) === "function" ? _ref$5 : Object)], BinaryDownloaderImpl.prototype, "logger", void 0);
	require_common$1.__decorate([(0, import_common$8.Autowired)(ManifestManager), require_common$1.__decorateMetadata("design:type", typeof (_ref2$4 = typeof ManifestManager !== "undefined" && ManifestManager) === "function" ? _ref2$4 : Object)], BinaryDownloaderImpl.prototype, "manifestManager", void 0);
	require_common$1.__decorate([(0, import_common$8.Autowired)(PlatformAdapter), require_common$1.__decorateMetadata("design:type", typeof (_ref3$3 = typeof PlatformAdapter !== "undefined" && PlatformAdapter) === "function" ? _ref3$3 : Object)], BinaryDownloaderImpl.prototype, "platformAdapter", void 0);
	BinaryDownloaderImpl = _BinaryDownloaderImpl = require_common$1.__decorate([(0, import_common$8.Component)(BinaryDownloader)], BinaryDownloaderImpl);
}));
//#endregion
//#region ../../packages/binary-manager/src/utils/disk-check.ts
/**
* 磁盘空间检查
*/
/**
* 格式化字节数为可读字符串
*/
function formatBytes(bytes) {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}
/**
* 获取指定路径的可用磁盘空间（字节）
*/
async function getFreeDiskSpace(targetDir) {
	if (process.platform === "win32") {
		const { stdout } = await execAsync$4(`powershell -NoProfile -Command "(Get-PSDrive ${targetDir.substring(0, 2)[0]}).Free"`);
		return parseInt(stdout.trim(), 10);
	} else {
		const { stdout } = await execAsync$4(`df -k "${targetDir}" | tail -1`);
		const parts = stdout.trim().split(/\s+/);
		return parseInt(parts[3], 10) * 1024;
	}
}
/**
* 检查磁盘空间是否充足
*
* @param targetDir 目标安装目录
* @param compressedSize 压缩包大小（字节，来自 manifest.json 的 size 字段）
*/
async function checkDiskSpace(targetDir, compressedSize) {
	const estimatedRequired = compressedSize + compressedSize * 4;
	try {
		const freeBytes = await getFreeDiskSpace(targetDir);
		if (freeBytes < estimatedRequired) throw new BinaryError(`Insufficient disk space: need ~${formatBytes(estimatedRequired)}, available ${formatBytes(freeBytes)}`, BinaryErrorCode.DISK_FULL);
	} catch (error) {
		if (error instanceof BinaryError) throw error;
	}
}
var execAsync$4;
var init_disk_check = require_chunk.__esmMin((() => {
	init_types();
	execAsync$4 = (0, util.promisify)(child_process.exec);
}));
//#endregion
//#region ../../packages/binary-manager/src/binary/binary-installer.ts
var import_common$7, _ref$4, _ref2$3, _ref3$2, _ref4$2, execAsync$3, execFileAsync, INSTALLING_MARKER_STALE_MS, BinaryInstallerImpl;
var init_binary_installer = require_chunk.__esmMin((() => {
	import_common$7 = require_common$1.require_common$1();
	init_manifest_protocol();
	init_platform_protocol();
	init_types();
	init_disk_check();
	init_binary_protocol();
	init_type_configs();
	require_common$1.init_decorateMetadata();
	require_common$1.init_decorate();
	execAsync$3 = (0, util.promisify)(child_process.exec);
	execFileAsync = (0, util.promisify)(child_process.execFile);
	INSTALLING_MARKER_STALE_MS = 300 * 1e3;
	BinaryInstallerImpl = class BinaryInstallerImpl {
		async install(archivePath, type, version) {
			const finalDir = path.join(this.platformAdapter.binariesDir, type, "versions", version);
			const versionsDir = path.dirname(finalDir);
			if (await this.isOtherProcessInstalling(versionsDir, version)) {
				this.logger.info(`Another process is installing ${type} ${version}, skipping`);
				throw new BinaryError(`Another process is already installing ${type} ${version}`, BinaryErrorCode.BINARY_NOT_FOUND);
			}
			const tempDir = `${finalDir}.installing.${process.pid}`;
			await fs_promises.rm(tempDir, {
				recursive: true,
				force: true
			});
			await this.checkDiskSpaceIfPossible(type, version);
			try {
				this.logger.info(`Extracting ${type} ${version} to ${tempDir}`);
				await this.platformAdapter.extractArchive(archivePath, tempDir);
				if (process.platform === "darwin") await this.clearQuarantineAttribute(tempDir);
				const tempExecPath = this.getExecutablePathInDir(tempDir, type);
				if (process.platform !== "win32") await fs_promises.chmod(tempExecPath, 493);
				const typeConfig = getBinaryTypeConfig(type);
				if (typeConfig.postInstall) try {
					await typeConfig.postInstall(tempDir, tempExecPath, process.platform);
				} catch (err) {
					this.logger.warn(`postInstall hook failed for ${type} ${version}, continuing anyway`, err);
				}
				await this.renameWithRetry(tempDir, finalDir, type, version);
				const finalExecPath = this.platformAdapter.getExecutablePath(type, version);
				this.logger.info(`Verifying ${type} ${version} at ${finalExecPath}`);
				if (!await this.verifyInstallation(finalDir, finalExecPath, type)) {
					await fs_promises.rm(finalDir, {
						recursive: true,
						force: true
					});
					throw new BinaryError(`Verification failed for ${type} ${version}`, BinaryErrorCode.VERIFICATION_FAILED);
				}
				const info = {
					type,
					version,
					source: "managed",
					executablePath: finalExecPath,
					installPath: finalDir,
					installedAt: Date.now(),
					verified: true
				};
				await this.registry.register(info);
				this.logger.info(`Successfully installed ${type} ${version}`);
				return info;
			} catch (error) {
				await fs_promises.rm(tempDir, {
					recursive: true,
					force: true
				});
				throw error;
			}
		}
		/**
		* 检测是否有其他进程正在安装同一版本（通过 .installing.{pid} 目录判断）
		*/
		async isOtherProcessInstalling(versionsDir, version) {
			try {
				const prefix = `${version}.installing.`;
				const entries = await fs_promises.readdir(versionsDir);
				for (const entry of entries) {
					if (!entry.startsWith(prefix)) continue;
					if (entry.slice(prefix.length) === String(process.pid)) continue;
					const stat = await fs_promises.stat(path.join(versionsDir, entry));
					if (Date.now() - stat.mtimeMs < INSTALLING_MARKER_STALE_MS) return true;
				}
			} catch {}
			return false;
		}
		async uninstall(type, version) {
			const installDir = path.join(this.platformAdapter.binariesDir, type, "versions", version);
			await fs_promises.rm(installDir, {
				recursive: true,
				force: true
			});
			await this.registry.unregister(type, version);
			this.logger.info(`Uninstalled ${type} ${version}`);
		}
		/**
		* 获取临时目录中的可执行文件路径
		*/
		getExecutablePathInDir(dir, type) {
			const execName = this.platformAdapter.getExecutableName(type);
			if (process.platform === "win32") return path.join(dir, execName);
			return path.join(dir, "bin", execName);
		}
		/**
		* 带重试的原子替换：先 rm(finalDir) 再 rename(tempDir, finalDir)。
		*
		* Windows 上 rename 偶发 EPERM（比如 Defender 实时扫描刚解出的文件短暂持有
		* 句柄、PowerShell 子进程退出后内核对其工作目录的同步尚未完成等），不是
		* 稳定失败。短间隔 retry 通常就能绕过。
		*
		* 同时处理并发场景：若 rename 连续失败且 finalDir 已被其他进程装好（通过
		* exec --version 验证），则复用对方成果、丢弃本进程 tempDir。
		*/
		async renameWithRetry(tempDir, finalDir, type, version) {
			await fs_promises.rm(finalDir, {
				recursive: true,
				force: true
			});
			const delays = [
				0,
				200,
				500,
				1e3,
				2e3
			];
			let lastError;
			for (let i = 0; i < delays.length; i++) {
				if (delays[i] > 0) await new Promise((resolve) => setTimeout(resolve, delays[i]));
				try {
					await fs_promises.rename(tempDir, finalDir);
					if (i > 0) this.logger.info(`rename succeeded after ${i} retries for ${type} ${version}`);
					return;
				} catch (error) {
					lastError = error;
					this.logger.warn(`rename attempt ${i + 1}/${delays.length} failed for ${type} ${version}: ${String(error)}`);
					if (await this.dirExists(finalDir)) {
						const execPath = this.platformAdapter.getExecutablePath(type, version);
						if (await this.verifyInstallation(finalDir, execPath, type)) {
							this.logger.info(`${type} ${version} installed by another process, reusing`);
							await fs_promises.rm(tempDir, {
								recursive: true,
								force: true
							});
							return;
						}
						await fs_promises.rm(finalDir, {
							recursive: true,
							force: true
						});
					}
				}
			}
			throw lastError ?? new BinaryError(`Atomic rename failed for ${type} ${version}`, BinaryErrorCode.VERIFICATION_FAILED);
		}
		/**
		* 检查目录是否存在（stat 失败统一返回 false）
		*/
		async dirExists(dir) {
			try {
				return (await fs_promises.stat(dir)).isDirectory();
			} catch {
				return false;
			}
		}
		/**
		* 验证安装是否成功
		*/
		async verifyInstallation(installPath, execPath, type) {
			try {
				const requiredFiles = getBinaryTypeConfig(type).requiredFiles?.[process.platform] ?? [];
				await Promise.all(requiredFiles.map((file) => fs_promises.access(path.join(installPath, file))));
				const { stdout } = await execFileAsync(execPath, ["--version"], { timeout: 1e4 });
				return getBinaryTypeConfig(type).versionVerifyRegex.test(stdout);
			} catch (error) {
				this.logger.warn(`Verification failed for ${execPath}`, error);
				return false;
			}
		}
		/**
		* 清除 macOS Gatekeeper 隔离属性
		*/
		async clearQuarantineAttribute(dirPath) {
			try {
				await execAsync$3(`xattr -rd com.apple.quarantine "${dirPath}"`);
			} catch {}
		}
		/**
		* 磁盘空间预检查
		*/
		async checkDiskSpaceIfPossible(type, version) {
			try {
				const manifest = await this.manifestManager.getManifest();
				const platform = this.platformAdapter.platform;
				const entry = manifest.binaries[type]?.versions[version]?.[platform];
				if (entry?.size) await checkDiskSpace(this.platformAdapter.binariesDir, entry.size);
			} catch (error) {
				if (error instanceof BinaryError && error.code === BinaryErrorCode.DISK_FULL) throw error;
			}
		}
	};
	require_common$1.__decorate([(0, import_common$7.Autowired)(import_common$7.Logger), require_common$1.__decorateMetadata("design:type", typeof (_ref$4 = typeof import_common$7.Logger !== "undefined" && import_common$7.Logger) === "function" ? _ref$4 : Object)], BinaryInstallerImpl.prototype, "logger", void 0);
	require_common$1.__decorate([(0, import_common$7.Autowired)(PlatformAdapter), require_common$1.__decorateMetadata("design:type", typeof (_ref2$3 = typeof PlatformAdapter !== "undefined" && PlatformAdapter) === "function" ? _ref2$3 : Object)], BinaryInstallerImpl.prototype, "platformAdapter", void 0);
	require_common$1.__decorate([(0, import_common$7.Autowired)(BinaryRegistry), require_common$1.__decorateMetadata("design:type", typeof (_ref3$2 = typeof BinaryRegistry !== "undefined" && BinaryRegistry) === "function" ? _ref3$2 : Object)], BinaryInstallerImpl.prototype, "registry", void 0);
	require_common$1.__decorate([(0, import_common$7.Autowired)(ManifestManager), require_common$1.__decorateMetadata("design:type", typeof (_ref4$2 = typeof ManifestManager !== "undefined" && ManifestManager) === "function" ? _ref4$2 : Object)], BinaryInstallerImpl.prototype, "manifestManager", void 0);
	BinaryInstallerImpl = require_common$1.__decorate([(0, import_common$7.Component)(BinaryInstaller)], BinaryInstallerImpl);
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/internal/constants.js
var require_constants = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var SEMVER_SPEC_VERSION = "2.0.0";
	var MAX_LENGTH = 256;
	var MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || 9007199254740991;
	module.exports = {
		MAX_LENGTH,
		MAX_SAFE_COMPONENT_LENGTH: 16,
		MAX_SAFE_BUILD_LENGTH: MAX_LENGTH - 6,
		MAX_SAFE_INTEGER,
		RELEASE_TYPES: [
			"major",
			"premajor",
			"minor",
			"preminor",
			"patch",
			"prepatch",
			"prerelease"
		],
		SEMVER_SPEC_VERSION,
		FLAG_INCLUDE_PRERELEASE: 1,
		FLAG_LOOSE: 2
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/internal/debug.js
var require_debug = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	module.exports = typeof process === "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? (...args) => console.error("SEMVER", ...args) : () => {};
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/internal/re.js
var require_re = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var { MAX_SAFE_COMPONENT_LENGTH, MAX_SAFE_BUILD_LENGTH, MAX_LENGTH } = require_constants();
	var debug = require_debug();
	exports = module.exports = {};
	var re = exports.re = [];
	var safeRe = exports.safeRe = [];
	var src = exports.src = [];
	var safeSrc = exports.safeSrc = [];
	var t = exports.t = {};
	var R = 0;
	var LETTERDASHNUMBER = "[a-zA-Z0-9-]";
	var safeRegexReplacements = [
		["\\s", 1],
		["\\d", MAX_LENGTH],
		[LETTERDASHNUMBER, MAX_SAFE_BUILD_LENGTH]
	];
	var makeSafeRegex = (value) => {
		for (const [token, max] of safeRegexReplacements) value = value.split(`${token}*`).join(`${token}{0,${max}}`).split(`${token}+`).join(`${token}{1,${max}}`);
		return value;
	};
	var createToken = (name, value, isGlobal) => {
		const safe = makeSafeRegex(value);
		const index = R++;
		debug(name, index, value);
		t[name] = index;
		src[index] = value;
		safeSrc[index] = safe;
		re[index] = new RegExp(value, isGlobal ? "g" : void 0);
		safeRe[index] = new RegExp(safe, isGlobal ? "g" : void 0);
	};
	createToken("NUMERICIDENTIFIER", "0|[1-9]\\d*");
	createToken("NUMERICIDENTIFIERLOOSE", "\\d+");
	createToken("NONNUMERICIDENTIFIER", `\\d*[a-zA-Z-]${LETTERDASHNUMBER}*`);
	createToken("MAINVERSION", `(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})`);
	createToken("MAINVERSIONLOOSE", `(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})`);
	createToken("PRERELEASEIDENTIFIER", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIER]})`);
	createToken("PRERELEASEIDENTIFIERLOOSE", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIERLOOSE]})`);
	createToken("PRERELEASE", `(?:-(${src[t.PRERELEASEIDENTIFIER]}(?:\\.${src[t.PRERELEASEIDENTIFIER]})*))`);
	createToken("PRERELEASELOOSE", `(?:-?(${src[t.PRERELEASEIDENTIFIERLOOSE]}(?:\\.${src[t.PRERELEASEIDENTIFIERLOOSE]})*))`);
	createToken("BUILDIDENTIFIER", `${LETTERDASHNUMBER}+`);
	createToken("BUILD", `(?:\\+(${src[t.BUILDIDENTIFIER]}(?:\\.${src[t.BUILDIDENTIFIER]})*))`);
	createToken("FULLPLAIN", `v?${src[t.MAINVERSION]}${src[t.PRERELEASE]}?${src[t.BUILD]}?`);
	createToken("FULL", `^${src[t.FULLPLAIN]}$`);
	createToken("LOOSEPLAIN", `[v=\\s]*${src[t.MAINVERSIONLOOSE]}${src[t.PRERELEASELOOSE]}?${src[t.BUILD]}?`);
	createToken("LOOSE", `^${src[t.LOOSEPLAIN]}$`);
	createToken("GTLT", "((?:<|>)?=?)");
	createToken("XRANGEIDENTIFIERLOOSE", `${src[t.NUMERICIDENTIFIERLOOSE]}|x|X|\\*`);
	createToken("XRANGEIDENTIFIER", `${src[t.NUMERICIDENTIFIER]}|x|X|\\*`);
	createToken("XRANGEPLAIN", `[v=\\s]*(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:${src[t.PRERELEASE]})?${src[t.BUILD]}?)?)?`);
	createToken("XRANGEPLAINLOOSE", `[v=\\s]*(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:${src[t.PRERELEASELOOSE]})?${src[t.BUILD]}?)?)?`);
	createToken("XRANGE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAIN]}$`);
	createToken("XRANGELOOSE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAINLOOSE]}$`);
	createToken("COERCEPLAIN", `(^|[^\\d])(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}})(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?`);
	createToken("COERCE", `${src[t.COERCEPLAIN]}(?:$|[^\\d])`);
	createToken("COERCEFULL", src[t.COERCEPLAIN] + `(?:${src[t.PRERELEASE]})?(?:${src[t.BUILD]})?(?:$|[^\\d])`);
	createToken("COERCERTL", src[t.COERCE], true);
	createToken("COERCERTLFULL", src[t.COERCEFULL], true);
	createToken("LONETILDE", "(?:~>?)");
	createToken("TILDETRIM", `(\\s*)${src[t.LONETILDE]}\\s+`, true);
	exports.tildeTrimReplace = "$1~";
	createToken("TILDE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAIN]}$`);
	createToken("TILDELOOSE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAINLOOSE]}$`);
	createToken("LONECARET", "(?:\\^)");
	createToken("CARETTRIM", `(\\s*)${src[t.LONECARET]}\\s+`, true);
	exports.caretTrimReplace = "$1^";
	createToken("CARET", `^${src[t.LONECARET]}${src[t.XRANGEPLAIN]}$`);
	createToken("CARETLOOSE", `^${src[t.LONECARET]}${src[t.XRANGEPLAINLOOSE]}$`);
	createToken("COMPARATORLOOSE", `^${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]})$|^$`);
	createToken("COMPARATOR", `^${src[t.GTLT]}\\s*(${src[t.FULLPLAIN]})$|^$`);
	createToken("COMPARATORTRIM", `(\\s*)${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]}|${src[t.XRANGEPLAIN]})`, true);
	exports.comparatorTrimReplace = "$1$2$3";
	createToken("HYPHENRANGE", `^\\s*(${src[t.XRANGEPLAIN]})\\s+-\\s+(${src[t.XRANGEPLAIN]})\\s*$`);
	createToken("HYPHENRANGELOOSE", `^\\s*(${src[t.XRANGEPLAINLOOSE]})\\s+-\\s+(${src[t.XRANGEPLAINLOOSE]})\\s*$`);
	createToken("STAR", "(<|>)?=?\\s*\\*");
	createToken("GTE0", "^\\s*>=\\s*0\\.0\\.0\\s*$");
	createToken("GTE0PRE", "^\\s*>=\\s*0\\.0\\.0-0\\s*$");
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/internal/parse-options.js
var require_parse_options = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var looseOption = Object.freeze({ loose: true });
	var emptyOpts = Object.freeze({});
	var parseOptions = (options) => {
		if (!options) return emptyOpts;
		if (typeof options !== "object") return looseOption;
		return options;
	};
	module.exports = parseOptions;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/internal/identifiers.js
var require_identifiers = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var numeric = /^[0-9]+$/;
	var compareIdentifiers = (a, b) => {
		if (typeof a === "number" && typeof b === "number") return a === b ? 0 : a < b ? -1 : 1;
		const anum = numeric.test(a);
		const bnum = numeric.test(b);
		if (anum && bnum) {
			a = +a;
			b = +b;
		}
		return a === b ? 0 : anum && !bnum ? -1 : bnum && !anum ? 1 : a < b ? -1 : 1;
	};
	var rcompareIdentifiers = (a, b) => compareIdentifiers(b, a);
	module.exports = {
		compareIdentifiers,
		rcompareIdentifiers
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/classes/semver.js
var require_semver$1 = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var debug = require_debug();
	var { MAX_LENGTH, MAX_SAFE_INTEGER } = require_constants();
	var { safeRe: re, t } = require_re();
	var parseOptions = require_parse_options();
	var { compareIdentifiers } = require_identifiers();
	module.exports = class SemVer {
		constructor(version, options) {
			options = parseOptions(options);
			if (version instanceof SemVer) if (version.loose === !!options.loose && version.includePrerelease === !!options.includePrerelease) return version;
			else version = version.version;
			else if (typeof version !== "string") throw new TypeError(`Invalid version. Must be a string. Got type "${typeof version}".`);
			if (version.length > MAX_LENGTH) throw new TypeError(`version is longer than ${MAX_LENGTH} characters`);
			debug("SemVer", version, options);
			this.options = options;
			this.loose = !!options.loose;
			this.includePrerelease = !!options.includePrerelease;
			const m = version.trim().match(options.loose ? re[t.LOOSE] : re[t.FULL]);
			if (!m) throw new TypeError(`Invalid Version: ${version}`);
			this.raw = version;
			this.major = +m[1];
			this.minor = +m[2];
			this.patch = +m[3];
			if (this.major > MAX_SAFE_INTEGER || this.major < 0) throw new TypeError("Invalid major version");
			if (this.minor > MAX_SAFE_INTEGER || this.minor < 0) throw new TypeError("Invalid minor version");
			if (this.patch > MAX_SAFE_INTEGER || this.patch < 0) throw new TypeError("Invalid patch version");
			if (!m[4]) this.prerelease = [];
			else this.prerelease = m[4].split(".").map((id) => {
				if (/^[0-9]+$/.test(id)) {
					const num = +id;
					if (num >= 0 && num < MAX_SAFE_INTEGER) return num;
				}
				return id;
			});
			this.build = m[5] ? m[5].split(".") : [];
			this.format();
		}
		format() {
			this.version = `${this.major}.${this.minor}.${this.patch}`;
			if (this.prerelease.length) this.version += `-${this.prerelease.join(".")}`;
			return this.version;
		}
		toString() {
			return this.version;
		}
		compare(other) {
			debug("SemVer.compare", this.version, this.options, other);
			if (!(other instanceof SemVer)) {
				if (typeof other === "string" && other === this.version) return 0;
				other = new SemVer(other, this.options);
			}
			if (other.version === this.version) return 0;
			return this.compareMain(other) || this.comparePre(other);
		}
		compareMain(other) {
			if (!(other instanceof SemVer)) other = new SemVer(other, this.options);
			if (this.major < other.major) return -1;
			if (this.major > other.major) return 1;
			if (this.minor < other.minor) return -1;
			if (this.minor > other.minor) return 1;
			if (this.patch < other.patch) return -1;
			if (this.patch > other.patch) return 1;
			return 0;
		}
		comparePre(other) {
			if (!(other instanceof SemVer)) other = new SemVer(other, this.options);
			if (this.prerelease.length && !other.prerelease.length) return -1;
			else if (!this.prerelease.length && other.prerelease.length) return 1;
			else if (!this.prerelease.length && !other.prerelease.length) return 0;
			let i = 0;
			do {
				const a = this.prerelease[i];
				const b = other.prerelease[i];
				debug("prerelease compare", i, a, b);
				if (a === void 0 && b === void 0) return 0;
				else if (b === void 0) return 1;
				else if (a === void 0) return -1;
				else if (a === b) continue;
				else return compareIdentifiers(a, b);
			} while (++i);
		}
		compareBuild(other) {
			if (!(other instanceof SemVer)) other = new SemVer(other, this.options);
			let i = 0;
			do {
				const a = this.build[i];
				const b = other.build[i];
				debug("build compare", i, a, b);
				if (a === void 0 && b === void 0) return 0;
				else if (b === void 0) return 1;
				else if (a === void 0) return -1;
				else if (a === b) continue;
				else return compareIdentifiers(a, b);
			} while (++i);
		}
		inc(release, identifier, identifierBase) {
			if (release.startsWith("pre")) {
				if (!identifier && identifierBase === false) throw new Error("invalid increment argument: identifier is empty");
				if (identifier) {
					const match = `-${identifier}`.match(this.options.loose ? re[t.PRERELEASELOOSE] : re[t.PRERELEASE]);
					if (!match || match[1] !== identifier) throw new Error(`invalid identifier: ${identifier}`);
				}
			}
			switch (release) {
				case "premajor":
					this.prerelease.length = 0;
					this.patch = 0;
					this.minor = 0;
					this.major++;
					this.inc("pre", identifier, identifierBase);
					break;
				case "preminor":
					this.prerelease.length = 0;
					this.patch = 0;
					this.minor++;
					this.inc("pre", identifier, identifierBase);
					break;
				case "prepatch":
					this.prerelease.length = 0;
					this.inc("patch", identifier, identifierBase);
					this.inc("pre", identifier, identifierBase);
					break;
				case "prerelease":
					if (this.prerelease.length === 0) this.inc("patch", identifier, identifierBase);
					this.inc("pre", identifier, identifierBase);
					break;
				case "release":
					if (this.prerelease.length === 0) throw new Error(`version ${this.raw} is not a prerelease`);
					this.prerelease.length = 0;
					break;
				case "major":
					if (this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0) this.major++;
					this.minor = 0;
					this.patch = 0;
					this.prerelease = [];
					break;
				case "minor":
					if (this.patch !== 0 || this.prerelease.length === 0) this.minor++;
					this.patch = 0;
					this.prerelease = [];
					break;
				case "patch":
					if (this.prerelease.length === 0) this.patch++;
					this.prerelease = [];
					break;
				case "pre": {
					const base = Number(identifierBase) ? 1 : 0;
					if (this.prerelease.length === 0) this.prerelease = [base];
					else {
						let i = this.prerelease.length;
						while (--i >= 0) if (typeof this.prerelease[i] === "number") {
							this.prerelease[i]++;
							i = -2;
						}
						if (i === -1) {
							if (identifier === this.prerelease.join(".") && identifierBase === false) throw new Error("invalid increment argument: identifier already exists");
							this.prerelease.push(base);
						}
					}
					if (identifier) {
						let prerelease = [identifier, base];
						if (identifierBase === false) prerelease = [identifier];
						if (compareIdentifiers(this.prerelease[0], identifier) === 0) {
							if (isNaN(this.prerelease[1])) this.prerelease = prerelease;
						} else this.prerelease = prerelease;
					}
					break;
				}
				default: throw new Error(`invalid increment argument: ${release}`);
			}
			this.raw = this.format();
			if (this.build.length) this.raw += `+${this.build.join(".")}`;
			return this;
		}
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/functions/parse.js
var require_parse = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var parse = (version, options, throwErrors = false) => {
		if (version instanceof SemVer) return version;
		try {
			return new SemVer(version, options);
		} catch (er) {
			if (!throwErrors) return null;
			throw er;
		}
	};
	module.exports = parse;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/functions/valid.js
var require_valid$1 = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var parse = require_parse();
	var valid = (version, options) => {
		const v = parse(version, options);
		return v ? v.version : null;
	};
	module.exports = valid;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/functions/clean.js
var require_clean = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var parse = require_parse();
	var clean = (version, options) => {
		const s = parse(version.trim().replace(/^[=v]+/, ""), options);
		return s ? s.version : null;
	};
	module.exports = clean;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/functions/inc.js
var require_inc = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var inc = (version, release, options, identifier, identifierBase) => {
		if (typeof options === "string") {
			identifierBase = identifier;
			identifier = options;
			options = void 0;
		}
		try {
			return new SemVer(version instanceof SemVer ? version.version : version, options).inc(release, identifier, identifierBase).version;
		} catch (er) {
			return null;
		}
	};
	module.exports = inc;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/functions/diff.js
var require_diff = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var parse = require_parse();
	var diff = (version1, version2) => {
		const v1 = parse(version1, null, true);
		const v2 = parse(version2, null, true);
		const comparison = v1.compare(v2);
		if (comparison === 0) return null;
		const v1Higher = comparison > 0;
		const highVersion = v1Higher ? v1 : v2;
		const lowVersion = v1Higher ? v2 : v1;
		const highHasPre = !!highVersion.prerelease.length;
		if (!!lowVersion.prerelease.length && !highHasPre) {
			if (!lowVersion.patch && !lowVersion.minor) return "major";
			if (lowVersion.compareMain(highVersion) === 0) {
				if (lowVersion.minor && !lowVersion.patch) return "minor";
				return "patch";
			}
		}
		const prefix = highHasPre ? "pre" : "";
		if (v1.major !== v2.major) return prefix + "major";
		if (v1.minor !== v2.minor) return prefix + "minor";
		if (v1.patch !== v2.patch) return prefix + "patch";
		return "prerelease";
	};
	module.exports = diff;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/functions/major.js
var require_major = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var major = (a, loose) => new SemVer(a, loose).major;
	module.exports = major;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/functions/minor.js
var require_minor = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var minor = (a, loose) => new SemVer(a, loose).minor;
	module.exports = minor;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/functions/patch.js
var require_patch = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var patch = (a, loose) => new SemVer(a, loose).patch;
	module.exports = patch;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/functions/prerelease.js
var require_prerelease = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var parse = require_parse();
	var prerelease = (version, options) => {
		const parsed = parse(version, options);
		return parsed && parsed.prerelease.length ? parsed.prerelease : null;
	};
	module.exports = prerelease;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/functions/compare.js
var require_compare = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var compare = (a, b, loose) => new SemVer(a, loose).compare(new SemVer(b, loose));
	module.exports = compare;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/functions/rcompare.js
var require_rcompare = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var compare = require_compare();
	var rcompare = (a, b, loose) => compare(b, a, loose);
	module.exports = rcompare;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/functions/compare-loose.js
var require_compare_loose = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var compare = require_compare();
	var compareLoose = (a, b) => compare(a, b, true);
	module.exports = compareLoose;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/functions/compare-build.js
var require_compare_build = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var compareBuild = (a, b, loose) => {
		const versionA = new SemVer(a, loose);
		const versionB = new SemVer(b, loose);
		return versionA.compare(versionB) || versionA.compareBuild(versionB);
	};
	module.exports = compareBuild;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/functions/sort.js
var require_sort = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var compareBuild = require_compare_build();
	var sort = (list, loose) => list.sort((a, b) => compareBuild(a, b, loose));
	module.exports = sort;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/functions/rsort.js
var require_rsort = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var compareBuild = require_compare_build();
	var rsort = (list, loose) => list.sort((a, b) => compareBuild(b, a, loose));
	module.exports = rsort;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/functions/gt.js
var require_gt = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var compare = require_compare();
	var gt = (a, b, loose) => compare(a, b, loose) > 0;
	module.exports = gt;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/functions/lt.js
var require_lt = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var compare = require_compare();
	var lt = (a, b, loose) => compare(a, b, loose) < 0;
	module.exports = lt;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/functions/eq.js
var require_eq = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var compare = require_compare();
	var eq = (a, b, loose) => compare(a, b, loose) === 0;
	module.exports = eq;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/functions/neq.js
var require_neq = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var compare = require_compare();
	var neq = (a, b, loose) => compare(a, b, loose) !== 0;
	module.exports = neq;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/functions/gte.js
var require_gte = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var compare = require_compare();
	var gte = (a, b, loose) => compare(a, b, loose) >= 0;
	module.exports = gte;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/functions/lte.js
var require_lte = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var compare = require_compare();
	var lte = (a, b, loose) => compare(a, b, loose) <= 0;
	module.exports = lte;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/functions/cmp.js
var require_cmp = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var eq = require_eq();
	var neq = require_neq();
	var gt = require_gt();
	var gte = require_gte();
	var lt = require_lt();
	var lte = require_lte();
	var cmp = (a, op, b, loose) => {
		switch (op) {
			case "===":
				if (typeof a === "object") a = a.version;
				if (typeof b === "object") b = b.version;
				return a === b;
			case "!==":
				if (typeof a === "object") a = a.version;
				if (typeof b === "object") b = b.version;
				return a !== b;
			case "":
			case "=":
			case "==": return eq(a, b, loose);
			case "!=": return neq(a, b, loose);
			case ">": return gt(a, b, loose);
			case ">=": return gte(a, b, loose);
			case "<": return lt(a, b, loose);
			case "<=": return lte(a, b, loose);
			default: throw new TypeError(`Invalid operator: ${op}`);
		}
	};
	module.exports = cmp;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/functions/coerce.js
var require_coerce = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var parse = require_parse();
	var { safeRe: re, t } = require_re();
	var coerce = (version, options) => {
		if (version instanceof SemVer) return version;
		if (typeof version === "number") version = String(version);
		if (typeof version !== "string") return null;
		options = options || {};
		let match = null;
		if (!options.rtl) match = version.match(options.includePrerelease ? re[t.COERCEFULL] : re[t.COERCE]);
		else {
			const coerceRtlRegex = options.includePrerelease ? re[t.COERCERTLFULL] : re[t.COERCERTL];
			let next;
			while ((next = coerceRtlRegex.exec(version)) && (!match || match.index + match[0].length !== version.length)) {
				if (!match || next.index + next[0].length !== match.index + match[0].length) match = next;
				coerceRtlRegex.lastIndex = next.index + next[1].length + next[2].length;
			}
			coerceRtlRegex.lastIndex = -1;
		}
		if (match === null) return null;
		const major = match[2];
		return parse(`${major}.${match[3] || "0"}.${match[4] || "0"}${options.includePrerelease && match[5] ? `-${match[5]}` : ""}${options.includePrerelease && match[6] ? `+${match[6]}` : ""}`, options);
	};
	module.exports = coerce;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/internal/lrucache.js
var require_lrucache = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var LRUCache = class {
		constructor() {
			this.max = 1e3;
			this.map = /* @__PURE__ */ new Map();
		}
		get(key) {
			const value = this.map.get(key);
			if (value === void 0) return;
			else {
				this.map.delete(key);
				this.map.set(key, value);
				return value;
			}
		}
		delete(key) {
			return this.map.delete(key);
		}
		set(key, value) {
			if (!this.delete(key) && value !== void 0) {
				if (this.map.size >= this.max) {
					const firstKey = this.map.keys().next().value;
					this.delete(firstKey);
				}
				this.map.set(key, value);
			}
			return this;
		}
	};
	module.exports = LRUCache;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/classes/range.js
var require_range = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var SPACE_CHARACTERS = /\s+/g;
	module.exports = class Range {
		constructor(range, options) {
			options = parseOptions(options);
			if (range instanceof Range) if (range.loose === !!options.loose && range.includePrerelease === !!options.includePrerelease) return range;
			else return new Range(range.raw, options);
			if (range instanceof Comparator) {
				this.raw = range.value;
				this.set = [[range]];
				this.formatted = void 0;
				return this;
			}
			this.options = options;
			this.loose = !!options.loose;
			this.includePrerelease = !!options.includePrerelease;
			this.raw = range.trim().replace(SPACE_CHARACTERS, " ");
			this.set = this.raw.split("||").map((r) => this.parseRange(r.trim())).filter((c) => c.length);
			if (!this.set.length) throw new TypeError(`Invalid SemVer Range: ${this.raw}`);
			if (this.set.length > 1) {
				const first = this.set[0];
				this.set = this.set.filter((c) => !isNullSet(c[0]));
				if (this.set.length === 0) this.set = [first];
				else if (this.set.length > 1) {
					for (const c of this.set) if (c.length === 1 && isAny(c[0])) {
						this.set = [c];
						break;
					}
				}
			}
			this.formatted = void 0;
		}
		get range() {
			if (this.formatted === void 0) {
				this.formatted = "";
				for (let i = 0; i < this.set.length; i++) {
					if (i > 0) this.formatted += "||";
					const comps = this.set[i];
					for (let k = 0; k < comps.length; k++) {
						if (k > 0) this.formatted += " ";
						this.formatted += comps[k].toString().trim();
					}
				}
			}
			return this.formatted;
		}
		format() {
			return this.range;
		}
		toString() {
			return this.range;
		}
		parseRange(range) {
			const memoKey = ((this.options.includePrerelease && FLAG_INCLUDE_PRERELEASE) | (this.options.loose && FLAG_LOOSE)) + ":" + range;
			const cached = cache.get(memoKey);
			if (cached) return cached;
			const loose = this.options.loose;
			const hr = loose ? re[t.HYPHENRANGELOOSE] : re[t.HYPHENRANGE];
			range = range.replace(hr, hyphenReplace(this.options.includePrerelease));
			debug("hyphen replace", range);
			range = range.replace(re[t.COMPARATORTRIM], comparatorTrimReplace);
			debug("comparator trim", range);
			range = range.replace(re[t.TILDETRIM], tildeTrimReplace);
			debug("tilde trim", range);
			range = range.replace(re[t.CARETTRIM], caretTrimReplace);
			debug("caret trim", range);
			let rangeList = range.split(" ").map((comp) => parseComparator(comp, this.options)).join(" ").split(/\s+/).map((comp) => replaceGTE0(comp, this.options));
			if (loose) rangeList = rangeList.filter((comp) => {
				debug("loose invalid filter", comp, this.options);
				return !!comp.match(re[t.COMPARATORLOOSE]);
			});
			debug("range list", rangeList);
			const rangeMap = /* @__PURE__ */ new Map();
			const comparators = rangeList.map((comp) => new Comparator(comp, this.options));
			for (const comp of comparators) {
				if (isNullSet(comp)) return [comp];
				rangeMap.set(comp.value, comp);
			}
			if (rangeMap.size > 1 && rangeMap.has("")) rangeMap.delete("");
			const result = [...rangeMap.values()];
			cache.set(memoKey, result);
			return result;
		}
		intersects(range, options) {
			if (!(range instanceof Range)) throw new TypeError("a Range is required");
			return this.set.some((thisComparators) => {
				return isSatisfiable(thisComparators, options) && range.set.some((rangeComparators) => {
					return isSatisfiable(rangeComparators, options) && thisComparators.every((thisComparator) => {
						return rangeComparators.every((rangeComparator) => {
							return thisComparator.intersects(rangeComparator, options);
						});
					});
				});
			});
		}
		test(version) {
			if (!version) return false;
			if (typeof version === "string") try {
				version = new SemVer(version, this.options);
			} catch (er) {
				return false;
			}
			for (let i = 0; i < this.set.length; i++) if (testSet(this.set[i], version, this.options)) return true;
			return false;
		}
	};
	var cache = new (require_lrucache())();
	var parseOptions = require_parse_options();
	var Comparator = require_comparator();
	var debug = require_debug();
	var SemVer = require_semver$1();
	var { safeRe: re, t, comparatorTrimReplace, tildeTrimReplace, caretTrimReplace } = require_re();
	var { FLAG_INCLUDE_PRERELEASE, FLAG_LOOSE } = require_constants();
	var isNullSet = (c) => c.value === "<0.0.0-0";
	var isAny = (c) => c.value === "";
	var isSatisfiable = (comparators, options) => {
		let result = true;
		const remainingComparators = comparators.slice();
		let testComparator = remainingComparators.pop();
		while (result && remainingComparators.length) {
			result = remainingComparators.every((otherComparator) => {
				return testComparator.intersects(otherComparator, options);
			});
			testComparator = remainingComparators.pop();
		}
		return result;
	};
	var parseComparator = (comp, options) => {
		comp = comp.replace(re[t.BUILD], "");
		debug("comp", comp, options);
		comp = replaceCarets(comp, options);
		debug("caret", comp);
		comp = replaceTildes(comp, options);
		debug("tildes", comp);
		comp = replaceXRanges(comp, options);
		debug("xrange", comp);
		comp = replaceStars(comp, options);
		debug("stars", comp);
		return comp;
	};
	var isX = (id) => !id || id.toLowerCase() === "x" || id === "*";
	var replaceTildes = (comp, options) => {
		return comp.trim().split(/\s+/).map((c) => replaceTilde(c, options)).join(" ");
	};
	var replaceTilde = (comp, options) => {
		const r = options.loose ? re[t.TILDELOOSE] : re[t.TILDE];
		return comp.replace(r, (_, M, m, p, pr) => {
			debug("tilde", comp, _, M, m, p, pr);
			let ret;
			if (isX(M)) ret = "";
			else if (isX(m)) ret = `>=${M}.0.0 <${+M + 1}.0.0-0`;
			else if (isX(p)) ret = `>=${M}.${m}.0 <${M}.${+m + 1}.0-0`;
			else if (pr) {
				debug("replaceTilde pr", pr);
				ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
			} else ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
			debug("tilde return", ret);
			return ret;
		});
	};
	var replaceCarets = (comp, options) => {
		return comp.trim().split(/\s+/).map((c) => replaceCaret(c, options)).join(" ");
	};
	var replaceCaret = (comp, options) => {
		debug("caret", comp, options);
		const r = options.loose ? re[t.CARETLOOSE] : re[t.CARET];
		const z = options.includePrerelease ? "-0" : "";
		return comp.replace(r, (_, M, m, p, pr) => {
			debug("caret", comp, _, M, m, p, pr);
			let ret;
			if (isX(M)) ret = "";
			else if (isX(m)) ret = `>=${M}.0.0${z} <${+M + 1}.0.0-0`;
			else if (isX(p)) if (M === "0") ret = `>=${M}.${m}.0${z} <${M}.${+m + 1}.0-0`;
			else ret = `>=${M}.${m}.0${z} <${+M + 1}.0.0-0`;
			else if (pr) {
				debug("replaceCaret pr", pr);
				if (M === "0") if (m === "0") ret = `>=${M}.${m}.${p}-${pr} <${M}.${m}.${+p + 1}-0`;
				else ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
				else ret = `>=${M}.${m}.${p}-${pr} <${+M + 1}.0.0-0`;
			} else {
				debug("no pr");
				if (M === "0") if (m === "0") ret = `>=${M}.${m}.${p}${z} <${M}.${m}.${+p + 1}-0`;
				else ret = `>=${M}.${m}.${p}${z} <${M}.${+m + 1}.0-0`;
				else ret = `>=${M}.${m}.${p} <${+M + 1}.0.0-0`;
			}
			debug("caret return", ret);
			return ret;
		});
	};
	var replaceXRanges = (comp, options) => {
		debug("replaceXRanges", comp, options);
		return comp.split(/\s+/).map((c) => replaceXRange(c, options)).join(" ");
	};
	var replaceXRange = (comp, options) => {
		comp = comp.trim();
		const r = options.loose ? re[t.XRANGELOOSE] : re[t.XRANGE];
		return comp.replace(r, (ret, gtlt, M, m, p, pr) => {
			debug("xRange", comp, ret, gtlt, M, m, p, pr);
			const xM = isX(M);
			const xm = xM || isX(m);
			const xp = xm || isX(p);
			const anyX = xp;
			if (gtlt === "=" && anyX) gtlt = "";
			pr = options.includePrerelease ? "-0" : "";
			if (xM) if (gtlt === ">" || gtlt === "<") ret = "<0.0.0-0";
			else ret = "*";
			else if (gtlt && anyX) {
				if (xm) m = 0;
				p = 0;
				if (gtlt === ">") {
					gtlt = ">=";
					if (xm) {
						M = +M + 1;
						m = 0;
						p = 0;
					} else {
						m = +m + 1;
						p = 0;
					}
				} else if (gtlt === "<=") {
					gtlt = "<";
					if (xm) M = +M + 1;
					else m = +m + 1;
				}
				if (gtlt === "<") pr = "-0";
				ret = `${gtlt + M}.${m}.${p}${pr}`;
			} else if (xm) ret = `>=${M}.0.0${pr} <${+M + 1}.0.0-0`;
			else if (xp) ret = `>=${M}.${m}.0${pr} <${M}.${+m + 1}.0-0`;
			debug("xRange return", ret);
			return ret;
		});
	};
	var replaceStars = (comp, options) => {
		debug("replaceStars", comp, options);
		return comp.trim().replace(re[t.STAR], "");
	};
	var replaceGTE0 = (comp, options) => {
		debug("replaceGTE0", comp, options);
		return comp.trim().replace(re[options.includePrerelease ? t.GTE0PRE : t.GTE0], "");
	};
	var hyphenReplace = (incPr) => ($0, from, fM, fm, fp, fpr, fb, to, tM, tm, tp, tpr) => {
		if (isX(fM)) from = "";
		else if (isX(fm)) from = `>=${fM}.0.0${incPr ? "-0" : ""}`;
		else if (isX(fp)) from = `>=${fM}.${fm}.0${incPr ? "-0" : ""}`;
		else if (fpr) from = `>=${from}`;
		else from = `>=${from}${incPr ? "-0" : ""}`;
		if (isX(tM)) to = "";
		else if (isX(tm)) to = `<${+tM + 1}.0.0-0`;
		else if (isX(tp)) to = `<${tM}.${+tm + 1}.0-0`;
		else if (tpr) to = `<=${tM}.${tm}.${tp}-${tpr}`;
		else if (incPr) to = `<${tM}.${tm}.${+tp + 1}-0`;
		else to = `<=${to}`;
		return `${from} ${to}`.trim();
	};
	var testSet = (set, version, options) => {
		for (let i = 0; i < set.length; i++) if (!set[i].test(version)) return false;
		if (version.prerelease.length && !options.includePrerelease) {
			for (let i = 0; i < set.length; i++) {
				debug(set[i].semver);
				if (set[i].semver === Comparator.ANY) continue;
				if (set[i].semver.prerelease.length > 0) {
					const allowed = set[i].semver;
					if (allowed.major === version.major && allowed.minor === version.minor && allowed.patch === version.patch) return true;
				}
			}
			return false;
		}
		return true;
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/classes/comparator.js
var require_comparator = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var ANY = Symbol("SemVer ANY");
	module.exports = class Comparator {
		static get ANY() {
			return ANY;
		}
		constructor(comp, options) {
			options = parseOptions(options);
			if (comp instanceof Comparator) if (comp.loose === !!options.loose) return comp;
			else comp = comp.value;
			comp = comp.trim().split(/\s+/).join(" ");
			debug("comparator", comp, options);
			this.options = options;
			this.loose = !!options.loose;
			this.parse(comp);
			if (this.semver === ANY) this.value = "";
			else this.value = this.operator + this.semver.version;
			debug("comp", this);
		}
		parse(comp) {
			const r = this.options.loose ? re[t.COMPARATORLOOSE] : re[t.COMPARATOR];
			const m = comp.match(r);
			if (!m) throw new TypeError(`Invalid comparator: ${comp}`);
			this.operator = m[1] !== void 0 ? m[1] : "";
			if (this.operator === "=") this.operator = "";
			if (!m[2]) this.semver = ANY;
			else this.semver = new SemVer(m[2], this.options.loose);
		}
		toString() {
			return this.value;
		}
		test(version) {
			debug("Comparator.test", version, this.options.loose);
			if (this.semver === ANY || version === ANY) return true;
			if (typeof version === "string") try {
				version = new SemVer(version, this.options);
			} catch (er) {
				return false;
			}
			return cmp(version, this.operator, this.semver, this.options);
		}
		intersects(comp, options) {
			if (!(comp instanceof Comparator)) throw new TypeError("a Comparator is required");
			if (this.operator === "") {
				if (this.value === "") return true;
				return new Range(comp.value, options).test(this.value);
			} else if (comp.operator === "") {
				if (comp.value === "") return true;
				return new Range(this.value, options).test(comp.semver);
			}
			options = parseOptions(options);
			if (options.includePrerelease && (this.value === "<0.0.0-0" || comp.value === "<0.0.0-0")) return false;
			if (!options.includePrerelease && (this.value.startsWith("<0.0.0") || comp.value.startsWith("<0.0.0"))) return false;
			if (this.operator.startsWith(">") && comp.operator.startsWith(">")) return true;
			if (this.operator.startsWith("<") && comp.operator.startsWith("<")) return true;
			if (this.semver.version === comp.semver.version && this.operator.includes("=") && comp.operator.includes("=")) return true;
			if (cmp(this.semver, "<", comp.semver, options) && this.operator.startsWith(">") && comp.operator.startsWith("<")) return true;
			if (cmp(this.semver, ">", comp.semver, options) && this.operator.startsWith("<") && comp.operator.startsWith(">")) return true;
			return false;
		}
	};
	var parseOptions = require_parse_options();
	var { safeRe: re, t } = require_re();
	var cmp = require_cmp();
	var debug = require_debug();
	var SemVer = require_semver$1();
	var Range = require_range();
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/functions/satisfies.js
var require_satisfies = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var Range = require_range();
	var satisfies = (version, range, options) => {
		try {
			range = new Range(range, options);
		} catch (er) {
			return false;
		}
		return range.test(version);
	};
	module.exports = satisfies;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/ranges/to-comparators.js
var require_to_comparators = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var Range = require_range();
	var toComparators = (range, options) => new Range(range, options).set.map((comp) => comp.map((c) => c.value).join(" ").trim().split(" "));
	module.exports = toComparators;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/ranges/max-satisfying.js
var require_max_satisfying = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var Range = require_range();
	var maxSatisfying = (versions, range, options) => {
		let max = null;
		let maxSV = null;
		let rangeObj = null;
		try {
			rangeObj = new Range(range, options);
		} catch (er) {
			return null;
		}
		versions.forEach((v) => {
			if (rangeObj.test(v)) {
				if (!max || maxSV.compare(v) === -1) {
					max = v;
					maxSV = new SemVer(max, options);
				}
			}
		});
		return max;
	};
	module.exports = maxSatisfying;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/ranges/min-satisfying.js
var require_min_satisfying = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var Range = require_range();
	var minSatisfying = (versions, range, options) => {
		let min = null;
		let minSV = null;
		let rangeObj = null;
		try {
			rangeObj = new Range(range, options);
		} catch (er) {
			return null;
		}
		versions.forEach((v) => {
			if (rangeObj.test(v)) {
				if (!min || minSV.compare(v) === 1) {
					min = v;
					minSV = new SemVer(min, options);
				}
			}
		});
		return min;
	};
	module.exports = minSatisfying;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/ranges/min-version.js
var require_min_version = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var Range = require_range();
	var gt = require_gt();
	var minVersion = (range, loose) => {
		range = new Range(range, loose);
		let minver = new SemVer("0.0.0");
		if (range.test(minver)) return minver;
		minver = new SemVer("0.0.0-0");
		if (range.test(minver)) return minver;
		minver = null;
		for (let i = 0; i < range.set.length; ++i) {
			const comparators = range.set[i];
			let setMin = null;
			comparators.forEach((comparator) => {
				const compver = new SemVer(comparator.semver.version);
				switch (comparator.operator) {
					case ">":
						if (compver.prerelease.length === 0) compver.patch++;
						else compver.prerelease.push(0);
						compver.raw = compver.format();
					case "":
					case ">=":
						if (!setMin || gt(compver, setMin)) setMin = compver;
						break;
					case "<":
					case "<=": break;
					/* istanbul ignore next */
					default: throw new Error(`Unexpected operation: ${comparator.operator}`);
				}
			});
			if (setMin && (!minver || gt(minver, setMin))) minver = setMin;
		}
		if (minver && range.test(minver)) return minver;
		return null;
	};
	module.exports = minVersion;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/ranges/valid.js
var require_valid = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var Range = require_range();
	var validRange = (range, options) => {
		try {
			return new Range(range, options).range || "*";
		} catch (er) {
			return null;
		}
	};
	module.exports = validRange;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/ranges/outside.js
var require_outside = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var Comparator = require_comparator();
	var { ANY } = Comparator;
	var Range = require_range();
	var satisfies = require_satisfies();
	var gt = require_gt();
	var lt = require_lt();
	var lte = require_lte();
	var gte = require_gte();
	var outside = (version, range, hilo, options) => {
		version = new SemVer(version, options);
		range = new Range(range, options);
		let gtfn, ltefn, ltfn, comp, ecomp;
		switch (hilo) {
			case ">":
				gtfn = gt;
				ltefn = lte;
				ltfn = lt;
				comp = ">";
				ecomp = ">=";
				break;
			case "<":
				gtfn = lt;
				ltefn = gte;
				ltfn = gt;
				comp = "<";
				ecomp = "<=";
				break;
			default: throw new TypeError("Must provide a hilo val of \"<\" or \">\"");
		}
		if (satisfies(version, range, options)) return false;
		for (let i = 0; i < range.set.length; ++i) {
			const comparators = range.set[i];
			let high = null;
			let low = null;
			comparators.forEach((comparator) => {
				if (comparator.semver === ANY) comparator = new Comparator(">=0.0.0");
				high = high || comparator;
				low = low || comparator;
				if (gtfn(comparator.semver, high.semver, options)) high = comparator;
				else if (ltfn(comparator.semver, low.semver, options)) low = comparator;
			});
			if (high.operator === comp || high.operator === ecomp) return false;
			if ((!low.operator || low.operator === comp) && ltefn(version, low.semver)) return false;
			else if (low.operator === ecomp && ltfn(version, low.semver)) return false;
		}
		return true;
	};
	module.exports = outside;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/ranges/gtr.js
var require_gtr = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var outside = require_outside();
	var gtr = (version, range, options) => outside(version, range, ">", options);
	module.exports = gtr;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/ranges/ltr.js
var require_ltr = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var outside = require_outside();
	var ltr = (version, range, options) => outside(version, range, "<", options);
	module.exports = ltr;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/ranges/intersects.js
var require_intersects = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var Range = require_range();
	var intersects = (r1, r2, options) => {
		r1 = new Range(r1, options);
		r2 = new Range(r2, options);
		return r1.intersects(r2, options);
	};
	module.exports = intersects;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/ranges/simplify.js
var require_simplify = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var satisfies = require_satisfies();
	var compare = require_compare();
	module.exports = (versions, range, options) => {
		const set = [];
		let first = null;
		let prev = null;
		const v = versions.sort((a, b) => compare(a, b, options));
		for (const version of v) if (satisfies(version, range, options)) {
			prev = version;
			if (!first) first = version;
		} else {
			if (prev) set.push([first, prev]);
			prev = null;
			first = null;
		}
		if (first) set.push([first, null]);
		const ranges = [];
		for (const [min, max] of set) if (min === max) ranges.push(min);
		else if (!max && min === v[0]) ranges.push("*");
		else if (!max) ranges.push(`>=${min}`);
		else if (min === v[0]) ranges.push(`<=${max}`);
		else ranges.push(`${min} - ${max}`);
		const simplified = ranges.join(" || ");
		const original = typeof range.raw === "string" ? range.raw : String(range);
		return simplified.length < original.length ? simplified : range;
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/ranges/subset.js
var require_subset = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var Range = require_range();
	var Comparator = require_comparator();
	var { ANY } = Comparator;
	var satisfies = require_satisfies();
	var compare = require_compare();
	var subset = (sub, dom, options = {}) => {
		if (sub === dom) return true;
		sub = new Range(sub, options);
		dom = new Range(dom, options);
		let sawNonNull = false;
		OUTER: for (const simpleSub of sub.set) {
			for (const simpleDom of dom.set) {
				const isSub = simpleSubset(simpleSub, simpleDom, options);
				sawNonNull = sawNonNull || isSub !== null;
				if (isSub) continue OUTER;
			}
			if (sawNonNull) return false;
		}
		return true;
	};
	var minimumVersionWithPreRelease = [new Comparator(">=0.0.0-0")];
	var minimumVersion = [new Comparator(">=0.0.0")];
	var simpleSubset = (sub, dom, options) => {
		if (sub === dom) return true;
		if (sub.length === 1 && sub[0].semver === ANY) if (dom.length === 1 && dom[0].semver === ANY) return true;
		else if (options.includePrerelease) sub = minimumVersionWithPreRelease;
		else sub = minimumVersion;
		if (dom.length === 1 && dom[0].semver === ANY) if (options.includePrerelease) return true;
		else dom = minimumVersion;
		const eqSet = /* @__PURE__ */ new Set();
		let gt, lt;
		for (const c of sub) if (c.operator === ">" || c.operator === ">=") gt = higherGT(gt, c, options);
		else if (c.operator === "<" || c.operator === "<=") lt = lowerLT(lt, c, options);
		else eqSet.add(c.semver);
		if (eqSet.size > 1) return null;
		let gtltComp;
		if (gt && lt) {
			gtltComp = compare(gt.semver, lt.semver, options);
			if (gtltComp > 0) return null;
			else if (gtltComp === 0 && (gt.operator !== ">=" || lt.operator !== "<=")) return null;
		}
		for (const eq of eqSet) {
			if (gt && !satisfies(eq, String(gt), options)) return null;
			if (lt && !satisfies(eq, String(lt), options)) return null;
			for (const c of dom) if (!satisfies(eq, String(c), options)) return false;
			return true;
		}
		let higher, lower;
		let hasDomLT, hasDomGT;
		let needDomLTPre = lt && !options.includePrerelease && lt.semver.prerelease.length ? lt.semver : false;
		let needDomGTPre = gt && !options.includePrerelease && gt.semver.prerelease.length ? gt.semver : false;
		if (needDomLTPre && needDomLTPre.prerelease.length === 1 && lt.operator === "<" && needDomLTPre.prerelease[0] === 0) needDomLTPre = false;
		for (const c of dom) {
			hasDomGT = hasDomGT || c.operator === ">" || c.operator === ">=";
			hasDomLT = hasDomLT || c.operator === "<" || c.operator === "<=";
			if (gt) {
				if (needDomGTPre) {
					if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomGTPre.major && c.semver.minor === needDomGTPre.minor && c.semver.patch === needDomGTPre.patch) needDomGTPre = false;
				}
				if (c.operator === ">" || c.operator === ">=") {
					higher = higherGT(gt, c, options);
					if (higher === c && higher !== gt) return false;
				} else if (gt.operator === ">=" && !satisfies(gt.semver, String(c), options)) return false;
			}
			if (lt) {
				if (needDomLTPre) {
					if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomLTPre.major && c.semver.minor === needDomLTPre.minor && c.semver.patch === needDomLTPre.patch) needDomLTPre = false;
				}
				if (c.operator === "<" || c.operator === "<=") {
					lower = lowerLT(lt, c, options);
					if (lower === c && lower !== lt) return false;
				} else if (lt.operator === "<=" && !satisfies(lt.semver, String(c), options)) return false;
			}
			if (!c.operator && (lt || gt) && gtltComp !== 0) return false;
		}
		if (gt && hasDomLT && !lt && gtltComp !== 0) return false;
		if (lt && hasDomGT && !gt && gtltComp !== 0) return false;
		if (needDomGTPre || needDomLTPre) return false;
		return true;
	};
	var higherGT = (a, b, options) => {
		if (!a) return b;
		const comp = compare(a.semver, b.semver, options);
		return comp > 0 ? a : comp < 0 ? b : b.operator === ">" && a.operator === ">=" ? b : a;
	};
	var lowerLT = (a, b, options) => {
		if (!a) return b;
		const comp = compare(a.semver, b.semver, options);
		return comp < 0 ? a : comp > 0 ? b : b.operator === "<" && a.operator === "<=" ? b : a;
	};
	module.exports = subset;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.7.3/node_modules/semver/index.js
var require_semver = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var internalRe = require_re();
	var constants = require_constants();
	var SemVer = require_semver$1();
	var identifiers = require_identifiers();
	module.exports = {
		parse: require_parse(),
		valid: require_valid$1(),
		clean: require_clean(),
		inc: require_inc(),
		diff: require_diff(),
		major: require_major(),
		minor: require_minor(),
		patch: require_patch(),
		prerelease: require_prerelease(),
		compare: require_compare(),
		rcompare: require_rcompare(),
		compareLoose: require_compare_loose(),
		compareBuild: require_compare_build(),
		sort: require_sort(),
		rsort: require_rsort(),
		gt: require_gt(),
		lt: require_lt(),
		eq: require_eq(),
		neq: require_neq(),
		gte: require_gte(),
		lte: require_lte(),
		cmp: require_cmp(),
		coerce: require_coerce(),
		Comparator: require_comparator(),
		Range: require_range(),
		satisfies: require_satisfies(),
		toComparators: require_to_comparators(),
		maxSatisfying: require_max_satisfying(),
		minSatisfying: require_min_satisfying(),
		minVersion: require_min_version(),
		validRange: require_valid(),
		outside: require_outside(),
		gtr: require_gtr(),
		ltr: require_ltr(),
		intersects: require_intersects(),
		simplifyRange: require_simplify(),
		subset: require_subset(),
		SemVer,
		re: internalRe.re,
		src: internalRe.src,
		tokens: internalRe.t,
		SEMVER_SPEC_VERSION: constants.SEMVER_SPEC_VERSION,
		RELEASE_TYPES: constants.RELEASE_TYPES,
		compareIdentifiers: identifiers.compareIdentifiers,
		rcompareIdentifiers: identifiers.rcompareIdentifiers
	};
}));
//#endregion
//#region ../../packages/binary-manager/src/binary/binary-resolver.ts
var import_common$6, import_semver$1, _ref$3, SOURCE_PRIORITY, BinaryResolverImpl;
var init_binary_resolver = require_chunk.__esmMin((() => {
	import_common$6 = require_common$1.require_common$1();
	import_semver$1 = /* @__PURE__ */ require_chunk.__toESM(require_semver());
	init_binary_protocol();
	require_common$1.init_decorateMetadata();
	require_common$1.init_decorate();
	SOURCE_PRIORITY = {
		managed: 0,
		system: 1
	};
	BinaryResolverImpl = class BinaryResolverImpl {
		/**
		* 解析最佳运行时
		* 策略：按来源优先级（managed > system）；同来源按版本降序
		*/
		resolve(requirement, available) {
			const { type, versionRange } = requirement;
			const sameType = available.filter((b) => b.type === type && b.verified);
			const candidates = sameType.filter((b) => this.satisfies(b.version, versionRange)).sort((a, b) => {
				const priorityDiff = SOURCE_PRIORITY[a.source] - SOURCE_PRIORITY[b.source];
				if (priorityDiff !== 0) return priorityDiff;
				return import_semver$1.rcompare(a.version, b.version);
			});
			const picked = candidates[0] ?? null;
			if (picked) this.logger?.info(`Resolved ${type} ${versionRange} -> ${picked.source}:${picked.version} (candidates=${candidates.length})`);
			else this.logger?.info(`No candidate for ${type} ${versionRange} (total=${sameType.length}, afterFilter=0)`);
			return picked;
		}
		/**
		* 判断版本是否满足需求
		*/
		satisfies(version, range) {
			if (range === "*") return true;
			const normalizedRange = this.normalizeRange(range);
			try {
				return import_semver$1.satisfies(version, normalizedRange);
			} catch {
				const coerced = import_semver$1.coerce(version);
				if (coerced) try {
					return import_semver$1.satisfies(coerced.version, normalizedRange);
				} catch {
					return false;
				}
				return false;
			}
		}
		/**
		* 将版本缩写转换为标准 semver 范围
		*
		* - "18"    → ">=18.0.0 <19.0.0"
		* - "18.19" → ">=18.19.0 <18.20.0"
		* - 其他格式保持不变
		*/
		normalizeRange(range) {
			if (/^\d+$/.test(range)) {
				const major = parseInt(range, 10);
				return `>=${major}.0.0 <${major + 1}.0.0`;
			}
			if (/^\d+\.\d+$/.test(range)) {
				const [major, minor] = range.split(".").map(Number);
				return `>=${major}.${minor}.0 <${major}.${minor + 1}.0`;
			}
			return range;
		}
	};
	require_common$1.__decorate([(0, import_common$6.Autowired)(import_common$6.Logger), require_common$1.__decorateMetadata("design:type", typeof (_ref$3 = typeof import_common$6.Logger !== "undefined" && import_common$6.Logger) === "function" ? _ref$3 : Object)], BinaryResolverImpl.prototype, "logger", void 0);
	BinaryResolverImpl = require_common$1.__decorate([(0, import_common$6.Component)(BinaryResolver)], BinaryResolverImpl);
}));
//#endregion
//#region ../../packages/binary-manager/src/binary/binary-prompt.ts
var import_common$5, BinaryPromptGeneratorImpl;
var init_binary_prompt = require_chunk.__esmMin((() => {
	import_common$5 = require_common$1.require_common$1();
	init_binary_protocol();
	require_common$1.init_decorate();
	BinaryPromptGeneratorImpl = class BinaryPromptGeneratorImpl {
		generate(binaries) {
			const verifiedBinaries = binaries.filter((b) => b.verified);
			const hasNonSystem = verifiedBinaries.some((b) => b.source === "managed");
			return {
				summary: this.generateSummary(verifiedBinaries),
				binaries: verifiedBinaries.map((b) => ({
					type: b.type,
					version: b.version,
					path: b.executablePath,
					source: b.source
				})),
				instructions: this.generateInstructions(verifiedBinaries),
				hasNonSystem
			};
		}
		generateSummary(binaries) {
			const byType = /* @__PURE__ */ new Map();
			for (const b of binaries) {
				const versions = byType.get(b.type) ?? [];
				versions.push(b.version);
				byType.set(b.type, versions);
			}
			const parts = Array.from(byType.entries()).map(([type, versions]) => `${type}: ${versions.join(", ")}`);
			return parts.length > 0 ? `Available binaries: ${parts.join("; ")}` : "No managed binaries available";
		}
		/**
		* 生成注入到 <runtime-environment> 中的完整指令
		*
		* 结构：
		* 1. 可用运行时列表（系统 + 托管）
		* 2. 使用规则（优先级 + 路径要求）
		* 3. 环境隔离规则（仅托管运行时需要）
		*/
		generateInstructions(binaries) {
			if (binaries.length === 0) return "";
			const groups = this.groupByType(binaries);
			const lines = [];
			lines.push("# Available Runtimes");
			lines.push("");
			for (const group of groups) {
				lines.push(`## ${this.capitalize(group.type)}`);
				for (const m of group.managed) lines.push(`- ${m.version} (managed, preferred): \`${m.executablePath}\``);
				if (group.system) lines.push(`- ${group.system.version} (system, fallback): \`${group.system.executablePath}\``);
				lines.push("");
			}
			if (groups.some((g) => g.managed.length > 0 && g.system !== null)) {
				lines.push("# Runtime Selection Rules");
				lines.push("");
				lines.push("When multiple runtimes of the same type are available, **always prefer the (managed) version** over the (system) version.");
				lines.push("The (managed) runtimes are pre-configured for isolated, safe execution. Only fall back to a (system) runtime if no managed version satisfies the requirement.");
				lines.push("");
			}
			const isolatedTypes = groups.filter((g) => g.managed.length > 0);
			if (isolatedTypes.length > 0) {
				lines.push("# Runtime Isolation Rules");
				lines.push("");
				lines.push("The runtimes marked **(managed)** above are installed in an isolated directory. When using them, follow these rules:");
				lines.push("");
				lines.push("- Use the absolute path listed above. Do not use bare commands (e.g. use the full path instead of `node` or `python`).");
				lines.push("- If no available runtime satisfies the requirement, use the `install_binary` tool to install the needed version before proceeding.");
				lines.push("- When a command outputs a version incompatibility warning (e.g. `EBADENGINE`, `requires python >= 3.x`), install a compatible version with `install_binary` and retry with the new path.");
				lines.push("");
				lines.push("**Package installation isolation** — all packages must stay within the isolated directory, never pollute the user's environment:");
				lines.push("");
				for (const group of isolatedTypes) {
					const binary = group.managed[0];
					if (binary) lines.push(...this.generateIsolationRules(group.type, binary));
				}
			}
			return lines.join("\n");
		}
		/**
		* 生成特定运行时类型的环境隔离规则
		*/
		generateIsolationRules(type, binary) {
			const lines = [];
			switch (type) {
				case "python": {
					const envDir = this.getEnvDir(binary, "envs/default");
					lines.push("**Python**:");
					lines.push(`- Create a venv under the runtime directory: \`${binary.executablePath} -m venv ${envDir}\``);
					lines.push(`- Install packages into it: \`${envDir}/bin/pip install <pkg>\``);
					lines.push(`- Run scripts with: \`${envDir}/bin/python script.py\``);
					lines.push("- Never run `pip install` globally or outside this venv.");
					lines.push("");
					break;
				}
				case "node": {
					const workspaceDir = this.getEnvDir(binary, "workspace");
					lines.push("**Node.js**:");
					lines.push(`- Install packages into the managed workspace: \`cd ${workspaceDir} && ${this.getNpmPath(binary)} install <pkg>\``);
					lines.push(`- When running scripts that need these packages, set: \`NODE_PATH=${workspaceDir}/node_modules ${binary.executablePath} script.js\``);
					lines.push("- Never use `npm install -g`.");
					lines.push("");
					break;
				}
				default: break;
			}
			return lines;
		}
		/**
		* 按 type 分组，每组包含 system / managed
		*/
		groupByType(binaries) {
			const map = /* @__PURE__ */ new Map();
			for (const b of binaries) {
				if (!map.has(b.type)) map.set(b.type, {
					type: b.type,
					system: null,
					managed: []
				});
				const group = map.get(b.type);
				if (b.source === "system") group.system = b;
				else group.managed.push(b);
			}
			return Array.from(map.values());
		}
		/**
		* 推导运行时的环境子目录。
		*
		* managed: installPath = ~/.workbuddy/binaries/python/versions/3.11.9
		*          → ~/.workbuddy/binaries/python/envs/default
		*/
		getEnvDir(binary, subDir) {
			if (binary.installPath) {
				const typeDir = binary.installPath.replace(/[/\\]versions[/\\][^/\\]+$/, "");
				return path.join(typeDir, subDir);
			}
			const execDir = binary.executablePath.replace(/[/\\]versions[/\\][^/\\]+[/\\].*$/, "");
			return path.join(execDir, subDir);
		}
		/**
		* 获取托管 Node 对应的 npm 路径
		*/
		getNpmPath(managed) {
			return managed.executablePath.replace(/[/\\]node$/, `${path.sep}npm`);
		}
		capitalize(s) {
			return s.charAt(0).toUpperCase() + s.slice(1);
		}
	};
	BinaryPromptGeneratorImpl = require_common$1.__decorate([(0, import_common$5.Component)(BinaryPromptGenerator)], BinaryPromptGeneratorImpl);
}));
//#endregion
//#region ../../packages/binary-manager/src/binary/binary-cleaner.ts
var import_common$4, _ref$2, _ref2$2, _ref3$1, _ref4$1, BinaryCleanerImpl;
var init_binary_cleaner = require_chunk.__esmMin((() => {
	import_common$4 = require_common$1.require_common$1();
	init_platform_protocol();
	init_binary_protocol();
	require_common$1.init_decorateMetadata();
	require_common$1.init_decorate();
	BinaryCleanerImpl = class BinaryCleanerImpl {
		async uninstallVersion(type, version) {
			this.logger.info(`Uninstalling ${type} ${version}...`);
			await this.installer.uninstall(type, version);
			this.logger.info(`Successfully uninstalled ${type} ${version}`);
		}
		async uninstallAll(type) {
			this.logger.info(`Uninstalling all ${type} versions...`);
			const versionsDir = path.join(this.platformAdapter.binariesDir, type, "versions");
			try {
				const entries = await fs_promises.readdir(versionsDir);
				for (const version of entries) if ((await fs_promises.stat(path.join(versionsDir, version))).isDirectory()) await this.installer.uninstall(type, version);
			} catch (error) {
				if (error.code === "ENOENT") return;
				throw error;
			}
			const typeDir = path.join(this.platformAdapter.binariesDir, type);
			await fs_promises.rm(typeDir, {
				recursive: true,
				force: true
			});
			this.logger.info(`Successfully uninstalled all ${type} versions`);
		}
		async purge() {
			this.logger.info("Purging all managed binaries...");
			const binariesDir = this.platformAdapter.binariesDir;
			await fs_promises.rm(binariesDir, {
				recursive: true,
				force: true
			});
			this.logger.info(`Purged ${binariesDir}. System is clean.`);
		}
		async cleanCache() {
			this.logger.info("Cleaning download cache...");
			const cacheDir = path.join(this.platformAdapter.binariesDir, ".cache", "downloads");
			await fs_promises.rm(cacheDir, {
				recursive: true,
				force: true
			});
			await fs_promises.mkdir(cacheDir, { recursive: true });
			this.logger.info("Download cache cleaned");
		}
	};
	require_common$1.__decorate([(0, import_common$4.Autowired)(import_common$4.Logger), require_common$1.__decorateMetadata("design:type", typeof (_ref$2 = typeof import_common$4.Logger !== "undefined" && import_common$4.Logger) === "function" ? _ref$2 : Object)], BinaryCleanerImpl.prototype, "logger", void 0);
	require_common$1.__decorate([(0, import_common$4.Autowired)(BinaryInstaller), require_common$1.__decorateMetadata("design:type", typeof (_ref2$2 = typeof BinaryInstaller !== "undefined" && BinaryInstaller) === "function" ? _ref2$2 : Object)], BinaryCleanerImpl.prototype, "installer", void 0);
	require_common$1.__decorate([(0, import_common$4.Autowired)(BinaryRegistry), require_common$1.__decorateMetadata("design:type", typeof (_ref3$1 = typeof BinaryRegistry !== "undefined" && BinaryRegistry) === "function" ? _ref3$1 : Object)], BinaryCleanerImpl.prototype, "registry", void 0);
	require_common$1.__decorate([(0, import_common$4.Autowired)(PlatformAdapter), require_common$1.__decorateMetadata("design:type", typeof (_ref4$1 = typeof PlatformAdapter !== "undefined" && PlatformAdapter) === "function" ? _ref4$1 : Object)], BinaryCleanerImpl.prototype, "platformAdapter", void 0);
	BinaryCleanerImpl = require_common$1.__decorate([(0, import_common$4.Component)(BinaryCleaner)], BinaryCleanerImpl);
}));
//#endregion
//#region ../../packages/binary-manager/src/utils/install-lock.ts
var InstallLockManager;
var init_install_lock = require_chunk.__esmMin((() => {
	InstallLockManager = class {
		constructor() {
			this.locks = /* @__PURE__ */ new Map();
		}
		/**
		* 确保同一运行时只有一个安装进程在执行
		* @param key 如 "python:3.11.9"
		* @param installer 安装函数
		*/
		async withLock(key, installer) {
			const existing = this.locks.get(key);
			if (existing) return existing;
			const promise = installer().finally(() => {
				this.locks.delete(key);
			});
			this.locks.set(key, promise);
			return promise;
		}
		/**
		* 检查指定 key 是否正在安装
		*/
		isInstalling(key) {
			return this.locks.has(key);
		}
		/**
		* 检查指定 key 前缀是否有任一 key 正在安装。
		*
		* 锁 key 的格式是 `<type>:<version>`（如 `node:22.12.0`）。外部调用方
		* 通常只知道 type 不知道具体 version，用此方法按 type 探测是否有该类型
		* 运行环境的安装正在进行。
		*/
		isInstallingPrefix(prefix) {
			const head = `${prefix}:`;
			for (const key of this.locks.keys()) if (key.startsWith(head)) return true;
			return false;
		}
	};
}));
//#endregion
//#region ../../packages/binary-manager/src/binary/binary-manager.ts
var import_common$3, import_semver, _ref$1, _ref2$1, _ref3, _ref4, _ref5, _ref6, _ref7, _ref8, _ref9, _ref10, BinaryManagerImpl;
var init_binary_manager = require_chunk.__esmMin((() => {
	import_common$3 = require_common$1.require_common$1();
	import_semver = /* @__PURE__ */ require_chunk.__toESM(require_semver());
	init_manifest_protocol();
	init_platform_protocol();
	init_types();
	init_install_lock();
	init_binary_protocol();
	init_type_configs();
	require_common$1.init_decorateMetadata();
	require_common$1.init_decorate();
	BinaryManagerImpl = class BinaryManagerImpl {
		constructor() {
			this.installLock = new InstallLockManager();
			this.cachedBinaries = [];
			this.initialized = false;
		}
		async initialize() {
			if (this.initialized) return;
			if (this.initPromise) return this.initPromise;
			this.initPromise = this.doInitialize().finally(() => {
				this.initPromise = void 0;
			});
			return this.initPromise;
		}
		async doInitialize() {
			this.logger.info("Initializing BinaryManager...");
			try {
				await this.registry.load();
				const binaryTypes = getRegisteredBinaryTypes();
				const detectSystemForType = async (type) => {
					let systemBinary = this.isForceMissing(type) ? null : this.registry.getSystemCache(type);
					if (!systemBinary) {
						systemBinary = await this.detector.detectSystem(type);
						this.registry.setSystemCache(type, systemBinary);
					}
					if (systemBinary) this.cachedBinaries.push(systemBinary);
				};
				const detectManagedForType = async (type) => {
					const managed = await this.detector.detectManaged(type);
					await Promise.all(managed.map(async (binary) => {
						const cached = this.registry.getManagedEntry(binary.type, binary.version);
						if (cached?.verified && await this.detector.verifyByStat(cached)) {
							binary.verified = true;
							binary.size = cached.size;
							binary.mtimeMs = cached.mtimeMs;
						} else binary.verified = await this.detector.verify(binary);
						this.cachedBinaries.push(binary);
						await this.registry.register(binary, true);
					}));
				};
				await Promise.all([...binaryTypes.map(detectSystemForType), ...binaryTypes.map(detectManagedForType)]);
				await this.registry.save();
			} catch (error) {
				this.logger.warn("BinaryManager initialization failed, running in degraded mode", String(error));
			}
			this.initialized = true;
			const system = this.cachedBinaries.filter((b) => b.source === "system").length;
			const managed = this.cachedBinaries.filter((b) => b.source === "managed").length;
			const verified = this.cachedBinaries.filter((b) => b.verified).length;
			const details = this.cachedBinaries.map((b) => `${b.type}@${b.version}(${b.source},${b.verified ? "ok" : "fail"})`).join(", ");
			this.logger.info(`BinaryManager initialized. system=${system}, managed=${managed}, verified=${verified} [${details}]`);
		}
		/**
		* Debug 开关：让进程"认为"系统里没有某类型的二进制，便于本地复现
		* 无系统 Node/Python 的场景而无需真卸载系统安装。
		*
		* 用法：
		* - `WORKBUDDY_BINARY_MANAGER_FORCE_MISSING=1` 跳过所有类型
		* - `WORKBUDDY_BINARY_MANAGER_FORCE_MISSING=node` 只跳过 node
		* - `WORKBUDDY_BINARY_MANAGER_FORCE_MISSING=node,python` 跳过多个
		*
		* 注意：此开关同时影响 resolve 时对"系统二进制"的命中判断（binary-resolver
		* 在比较 source 优先级时，会看 cachedBinaries 里是否有 system 项），
		* 所以在 initialize 阶段直接不把系统二进制加入 cachedBinaries 是正确做法。
		*/
		isForceMissing(type) {
			const flag = process.env.WORKBUDDY_BINARY_MANAGER_FORCE_MISSING;
			if (!flag) return false;
			if (flag === "1") return true;
			return flag.split(",").map((s) => s.trim().toLowerCase()).includes(type);
		}
		async resolve(requirement) {
			await this.initialize();
			const resolved = this.resolver.resolve(requirement, this.cachedBinaries);
			if (!resolved || resolved.source !== "managed" || await this.detector.verifyByStat(resolved)) return resolved;
			this.logger.warn(`Managed binary ${resolved.type}@${resolved.version} is missing or changed; removing stale cache entry`);
			this.cachedBinaries = this.cachedBinaries.filter((binary) => binary !== resolved);
			await this.registry.unregister(resolved.type, resolved.version);
			return this.resolver.resolve(requirement, this.cachedBinaries);
		}
		async ensure(requirement, options) {
			await this.initialize();
			const existing = await this.resolve(requirement);
			if (existing) return existing;
			if (options?.autoInstall === false) throw new BinaryError(`No binary found for ${requirement.type} ${requirement.versionRange}`, BinaryErrorCode.BINARY_NOT_FOUND);
			const version = await this.resolveVersionToInstall(requirement);
			const lockKey = `${requirement.type}:${version}`;
			return this.installLock.withLock(lockKey, async () => {
				try {
					return await this.installBinary(requirement.type, version, options);
				} catch (installError) {
					return this.handleInstallFailure(requirement, installError);
				}
			});
		}
		async getAvailableBinaries() {
			return this.cachedBinaries.filter((b) => b.verified);
		}
		async listAll() {
			return [...this.cachedBinaries];
		}
		async listByType(type) {
			return this.cachedBinaries.filter((b) => b.type === type);
		}
		async generatePromptContext(exclude) {
			let binaries = await this.getAvailableBinaries();
			if (exclude && exclude.length > 0) binaries = binaries.filter((b) => !(b.source === "managed" && exclude.includes(b.type)));
			return this.promptGenerator.generate(binaries);
		}
		async ensureRecommendedBinaries() {
			const manifest = await this.manifestManager.getManifest();
			for (const type of getRegisteredBinaryTypes()) {
				if (await this.resolve({
					type,
					versionRange: "*"
				})) continue;
				const recommended = manifest.binaries[type]?.recommended;
				if (!recommended) continue;
				this.logger.info(`Installing recommended ${type} ${recommended}...`);
				try {
					let lastReportedProgress = -1;
					await this.ensure({
						type,
						versionRange: recommended
					}, { onProgress: (task) => {
						const rounded = Math.floor(task.progress / 5) * 5;
						if (rounded > lastReportedProgress) {
							lastReportedProgress = rounded;
							this.logger.info(`Installing ${task.type} ${task.version}: ${task.progress}%`);
						}
					} });
				} catch (error) {
					this.logger.warn(`Failed to install recommended ${type} ${recommended}`, String(error));
				}
			}
		}
		async installVersion(requirement) {
			const existing = await this.resolve(requirement);
			if (existing && existing.verified) {
				this.logger.info(`${requirement.type} ${existing.version} already available, skipping installation (requested: ${requirement.versionRange})`);
				return existing;
			}
			const version = await this.resolveVersionToInstall(requirement);
			const lockKey = `${requirement.type}:${version}`;
			return this.installLock.withLock(lockKey, async () => this.installBinary(requirement.type, version));
		}
		async checkAndRepair() {
			const results = [];
			const managed = this.cachedBinaries.filter((b) => b.source === "managed");
			for (const binary of managed) if (!await this.detector.verify(binary)) {
				this.logger.warn(`Corrupted binary detected: ${binary.type} ${binary.version}`);
				try {
					await this.installer.uninstall(binary.type, binary.version);
					const archivePath = await this.downloader.download(binary.type, binary.version);
					const repairedInfo = await this.installer.install(archivePath, binary.type, binary.version);
					const idx = this.cachedBinaries.indexOf(binary);
					if (idx !== -1) this.cachedBinaries[idx] = repairedInfo;
					results.push({
						binary: repairedInfo,
						status: "repaired"
					});
				} catch (error) {
					results.push({
						binary,
						status: "failed",
						error
					});
				}
			}
			return results;
		}
		getCleaner() {
			return this.binaryCleaner;
		}
		isInstallingType(type) {
			return this.installLock.isInstallingPrefix(type);
		}
		/**
		* 确定要安装的版本
		*/
		async resolveVersionToInstall(requirement) {
			const entry = (await this.manifestManager.getManifest()).binaries[requirement.type];
			if (!entry) throw new BinaryError(`No manifest entry for ${requirement.type}`, BinaryErrorCode.NO_MATCHING_VERSION);
			if (/^\d+\.\d+\.\d+$/.test(requirement.versionRange)) {
				if (entry.versions[requirement.versionRange]) return requirement.versionRange;
				const requestedMajor = import_semver.major(requirement.versionRange);
				const versions = Object.keys(entry.versions);
				const sameMajor = versions.filter((v) => import_semver.major(v) === requestedMajor).sort((a, b) => import_semver.rcompare(a, b));
				if (sameMajor.length > 0) {
					this.logger.warn(`Version ${requirement.versionRange} is not available for ${requirement.type}. Using closest match: ${sameMajor[0]}`);
					return sameMajor[0];
				}
				const availableVersions = versions.join(", ");
				throw new BinaryError(`No version of ${requirement.type} matches major version ${requestedMajor}. Available versions: ${availableVersions}`, BinaryErrorCode.NO_MATCHING_VERSION);
			}
			const matching = Object.keys(entry.versions).filter((v) => this.resolver.satisfies(v, requirement.versionRange)).sort((a, b) => import_semver.rcompare(a, b));
			if (matching.length === 0) {
				this.logger.warn(`No version of ${requirement.type} matches range "${requirement.versionRange}". Falling back to recommended version ${entry.recommended}.`);
				return entry.recommended;
			}
			this.logger.info(`Resolved ${requirement.type} "${requirement.versionRange}" to version ${matching[0]}`);
			return matching[0];
		}
		/**
		* 执行实际安装
		*/
		async installBinary(type, version, options) {
			this.logger.info(`Downloading ${type} ${version}...`);
			const archivePath = await this.downloader.download(type, version, { onProgress: (downloaded, total) => {
				if (options?.onProgress) {
					const progress = total > 0 ? Math.round(downloaded / total * 80) : 0;
					options.onProgress({
						id: `${type}:${version}`,
						type,
						version,
						platform: this.platformAdapter.platform,
						url: "",
						sha256: "",
						status: "downloading",
						progress
					});
				}
			} });
			this.logger.info(`Installing ${type} ${version}...`);
			const info = await this.installer.install(archivePath, type, version);
			this.cachedBinaries.push(info);
			return info;
		}
		/**
		* 安装失败的降级处理
		*/
		async handleInstallFailure(requirement, error) {
			const systemBinary = await this.detector.detectSystem(requirement.type);
			if (systemBinary) {
				this.logger.warn(`Installation failed, falling back to system ${requirement.type} ${systemBinary.version} (may not meet requirement ${requirement.versionRange})`);
				return systemBinary;
			}
			if (requirement.optional) throw new BinaryError(`Optional binary ${requirement.type} not available, some features may be limited`, BinaryErrorCode.BINARY_NOT_FOUND);
			throw error;
		}
	};
	require_common$1.__decorate([(0, import_common$3.Autowired)(import_common$3.Logger), require_common$1.__decorateMetadata("design:type", typeof (_ref$1 = typeof import_common$3.Logger !== "undefined" && import_common$3.Logger) === "function" ? _ref$1 : Object)], BinaryManagerImpl.prototype, "logger", void 0);
	require_common$1.__decorate([(0, import_common$3.Autowired)(BinaryDetector), require_common$1.__decorateMetadata("design:type", typeof (_ref2$1 = typeof BinaryDetector !== "undefined" && BinaryDetector) === "function" ? _ref2$1 : Object)], BinaryManagerImpl.prototype, "detector", void 0);
	require_common$1.__decorate([(0, import_common$3.Autowired)(BinaryDownloader), require_common$1.__decorateMetadata("design:type", typeof (_ref3 = typeof BinaryDownloader !== "undefined" && BinaryDownloader) === "function" ? _ref3 : Object)], BinaryManagerImpl.prototype, "downloader", void 0);
	require_common$1.__decorate([(0, import_common$3.Autowired)(BinaryInstaller), require_common$1.__decorateMetadata("design:type", typeof (_ref4 = typeof BinaryInstaller !== "undefined" && BinaryInstaller) === "function" ? _ref4 : Object)], BinaryManagerImpl.prototype, "installer", void 0);
	require_common$1.__decorate([(0, import_common$3.Autowired)(BinaryResolver), require_common$1.__decorateMetadata("design:type", typeof (_ref5 = typeof BinaryResolver !== "undefined" && BinaryResolver) === "function" ? _ref5 : Object)], BinaryManagerImpl.prototype, "resolver", void 0);
	require_common$1.__decorate([(0, import_common$3.Autowired)(BinaryRegistry), require_common$1.__decorateMetadata("design:type", typeof (_ref6 = typeof BinaryRegistry !== "undefined" && BinaryRegistry) === "function" ? _ref6 : Object)], BinaryManagerImpl.prototype, "registry", void 0);
	require_common$1.__decorate([(0, import_common$3.Autowired)(BinaryPromptGenerator), require_common$1.__decorateMetadata("design:type", typeof (_ref7 = typeof BinaryPromptGenerator !== "undefined" && BinaryPromptGenerator) === "function" ? _ref7 : Object)], BinaryManagerImpl.prototype, "promptGenerator", void 0);
	require_common$1.__decorate([(0, import_common$3.Autowired)(ManifestManager), require_common$1.__decorateMetadata("design:type", typeof (_ref8 = typeof ManifestManager !== "undefined" && ManifestManager) === "function" ? _ref8 : Object)], BinaryManagerImpl.prototype, "manifestManager", void 0);
	require_common$1.__decorate([(0, import_common$3.Autowired)(PlatformAdapter), require_common$1.__decorateMetadata("design:type", typeof (_ref9 = typeof PlatformAdapter !== "undefined" && PlatformAdapter) === "function" ? _ref9 : Object)], BinaryManagerImpl.prototype, "platformAdapter", void 0);
	require_common$1.__decorate([(0, import_common$3.Autowired)(BinaryCleaner), require_common$1.__decorateMetadata("design:type", typeof (_ref10 = typeof BinaryCleaner !== "undefined" && BinaryCleaner) === "function" ? _ref10 : Object)], BinaryManagerImpl.prototype, "binaryCleaner", void 0);
	BinaryManagerImpl = require_common$1.__decorate([(0, import_common$3.Component)(BinaryManager)], BinaryManagerImpl);
}));
//#endregion
//#region ../../packages/binary-manager/src/binary/index.ts
var init_binary = require_chunk.__esmMin((() => {
	init_binary_protocol();
	init_binary_registry();
	init_binary_detector();
	init_binary_downloader();
	init_binary_installer();
	init_binary_resolver();
	init_binary_prompt();
	init_binary_cleaner();
	init_binary_manager();
	init_type_configs();
}));
//#endregion
//#region ../../packages/binary-manager/src/platform/base-platform-adapter.ts
/**
* 平台适配器抽象基类
*/
/**
* 解析 binary-manager 的数据目录根。
*
* managed 运行时读写路径必须与 Desktop 主进程写入侧（vendor-extract-service）
* 一致，否则专享版/私有化下会出现"写到 ~/.aimea/binaries、读还锁 ~/.workbuddy"
* 的写读不一致（cnb.woa.com/genie/genie/-/issues/79541）。
*
* 优先级：
*   1. WORKBUDDY_CONFIG_DIR / CODEBUDDY_CONFIG_DIR env
*      （Desktop 主进程 configureElectronApp 已按 dataFolderName 写入，专享版为 ~/.aimea）
*   2. 回退 <homeDir>/.workbuddy（标准版行为不变）
*/
function resolveBinaryManagerConfigDir(homeDir) {
	const envDir = process.env.WORKBUDDY_CONFIG_DIR?.trim() || process.env.CODEBUDDY_CONFIG_DIR?.trim();
	if (envDir) return envDir;
	return path.join(homeDir, ".workbuddy");
}
var BasePlatformAdapter;
var init_base_platform_adapter = require_chunk.__esmMin((() => {
	BasePlatformAdapter = class {
		get homeDir() {
			return os.homedir();
		}
		get binariesDir() {
			return path.join(resolveBinaryManagerConfigDir(this.homeDir), "binaries");
		}
		getExecutablePath(type, version) {
			const execName = this.getExecutableName(type);
			return path.join(this.binariesDir, type, "versions", version, "bin", execName);
		}
	};
}));
//#endregion
//#region ../../packages/binary-manager/src/platform/darwin-adapter.ts
/**
* macOS 平台适配器
*/
var execAsync$2, DarwinPlatformAdapter;
var init_darwin_adapter = require_chunk.__esmMin((() => {
	init_type_configs();
	init_base_platform_adapter();
	execAsync$2 = (0, util.promisify)(child_process.exec);
	DarwinPlatformAdapter = class DarwinPlatformAdapter extends BasePlatformAdapter {
		constructor() {
			super();
			this.platform = DarwinPlatformAdapter.detectArch();
		}
		/**
		* 检测 macOS 真实架构
		*
		* 当 x86_64 版本的宿主应用通过 Rosetta 2 运行在 Apple Silicon 上时，
		* process.arch 返回 'x64' 而非 'arm64'。使用 sysctl 检测硬件真实架构，
		* 确保下载 arm64 版本以获得最佳性能。
		*/
		static detectArch() {
			if (process.arch === "arm64") return "darwin-arm64";
			try {
				if ((0, child_process.execSync)("sysctl -n hw.optional.arm64", {
					encoding: "utf-8",
					timeout: 3e3
				}).trim() === "1") return "darwin-arm64";
			} catch {}
			return "darwin-x64";
		}
		getExecutableName(type) {
			return getBinaryTypeConfig(type).executableName.unix;
		}
		getPathSeparator() {
			return ":";
		}
		getSystemSearchPaths(type) {
			return getBinaryTypeConfig(type).systemSearchPaths.darwin;
		}
		async extractArchive(archivePath, destPath) {
			await fs_promises.mkdir(destPath, { recursive: true });
			await execAsync$2(`tar -xzf "${archivePath}" -C "${destPath}" --strip-components=1`);
		}
	};
}));
//#endregion
//#region ../../packages/binary-manager/src/platform/win32-adapter.ts
/**
* Windows 平台适配器
*/
var execAsync$1, Win32PlatformAdapter;
var init_win32_adapter = require_chunk.__esmMin((() => {
	init_type_configs();
	init_base_platform_adapter();
	execAsync$1 = (0, util.promisify)(child_process.exec);
	Win32PlatformAdapter = class extends BasePlatformAdapter {
		constructor(..._args) {
			super(..._args);
			this.platform = "win32-x64";
		}
		getExecutableName(type) {
			return getBinaryTypeConfig(type).executableName.win32;
		}
		getPathSeparator() {
			return ";";
		}
		getSystemSearchPaths(type) {
			return getBinaryTypeConfig(type).systemSearchPaths.win32.map((p) => p.replace(/%(\w+)%/g, (_, name) => process.env[name] ?? ""));
		}
		/**
		* Windows 上的可执行文件路径差异：
		* - Python: {version}/python.exe（根目录，无 bin/ 子目录）
		* - Node.js: {version}/node.exe（根目录，无 bin/ 子目录）
		*/
		getExecutablePath(type, version) {
			const execName = this.getExecutableName(type);
			return path.join(this.binariesDir, type, "versions", version, execName);
		}
		async extractArchive(archivePath, destPath) {
			if (archivePath.endsWith(".zip")) {
				const parentDir = path.dirname(destPath);
				await fs_promises.mkdir(parentDir, { recursive: true });
				const tempExtract = `${destPath}.__extract_temp__`;
				await fs_promises.rm(tempExtract, {
					recursive: true,
					force: true
				});
				const safePath = (p) => p.replace(/'/g, "''");
				try {
					await execAsync$1(`powershell -NoProfile -Command "Expand-Archive -Path '${safePath(archivePath)}' -DestinationPath '${safePath(tempExtract)}' -Force"`);
					await this.flattenSingleSubdir(tempExtract, destPath);
				} finally {
					await fs_promises.rm(tempExtract, {
						recursive: true,
						force: true
					});
				}
			} else {
				await fs_promises.mkdir(destPath, { recursive: true });
				await execAsync$1(`tar -xzf "${archivePath}" -C "${destPath}" --strip-components=1`);
			}
		}
		/**
		* Windows zip 解压后的目录层级规整
		* 如果解压结果只有一个子目录，将其内容提升一层
		*
		* 前置条件（由调用方 extractArchive 保证）：targetDir **不存在**。
		* 原因见 extractArchive 中的说明：Windows MoveFileExW 不支持 rename 目录
		* 到已存在目录。
		*/
		async flattenSingleSubdir(extractedDir, targetDir) {
			const entries = await fs_promises.readdir(extractedDir);
			if (entries.length === 1) {
				const singleDir = path.join(extractedDir, entries[0]);
				if ((await fs_promises.stat(singleDir)).isDirectory()) {
					await fs_promises.rename(singleDir, targetDir);
					return;
				}
			}
			await fs_promises.rename(extractedDir, targetDir);
		}
	};
}));
//#endregion
//#region ../../packages/binary-manager/src/platform/linux-adapter.ts
/**
* Linux 平台适配器
*/
var execAsync, LinuxPlatformAdapter;
var init_linux_adapter = require_chunk.__esmMin((() => {
	init_type_configs();
	init_base_platform_adapter();
	execAsync = (0, util.promisify)(child_process.exec);
	LinuxPlatformAdapter = class LinuxPlatformAdapter extends BasePlatformAdapter {
		constructor() {
			super();
			this.platform = LinuxPlatformAdapter.detectPlatform(process.arch);
		}
		static detectPlatform(arch) {
			if (arch === "arm64") return "linux-arm64";
			return "linux-x64";
		}
		getExecutableName(type) {
			return getBinaryTypeConfig(type).executableName.unix;
		}
		getPathSeparator() {
			return ":";
		}
		getSystemSearchPaths(type) {
			return getBinaryTypeConfig(type).systemSearchPaths.linux;
		}
		async extractArchive(archivePath, destPath) {
			await fs_promises.mkdir(destPath, { recursive: true });
			await execAsync(`tar -xzf "${archivePath}" -C "${destPath}" --strip-components=1`);
		}
	};
}));
//#endregion
//#region ../../packages/binary-manager/src/platform/platform-adapter-provider.ts
function createPlatformAdapter() {
	switch (process.platform) {
		case "darwin": return new DarwinPlatformAdapter();
		case "win32": return new Win32PlatformAdapter();
		case "linux": return new LinuxPlatformAdapter();
		default: throw new Error(`Unsupported platform: ${process.platform}`);
	}
}
var import_common$2, PlatformAdapterProvider;
var init_platform_adapter_provider = require_chunk.__esmMin((() => {
	import_common$2 = require_common$1.require_common$1();
	init_darwin_adapter();
	init_linux_adapter();
	init_platform_protocol();
	init_win32_adapter();
	require_common$1.init_decorateMetadata();
	require_common$1.init_decorate();
	PlatformAdapterProvider = class PlatformAdapterProvider {
		init() {
			this.delegate = createPlatformAdapter();
		}
		get platform() {
			return this.delegate.platform;
		}
		get homeDir() {
			return this.delegate.homeDir;
		}
		get binariesDir() {
			return this.delegate.binariesDir;
		}
		getExecutableName(type) {
			return this.delegate.getExecutableName(type);
		}
		getExecutablePath(type, version) {
			return this.delegate.getExecutablePath(type, version);
		}
		getPathSeparator() {
			return this.delegate.getPathSeparator();
		}
		getSystemSearchPaths(type) {
			return this.delegate.getSystemSearchPaths(type);
		}
		extractArchive(archivePath, destPath) {
			return this.delegate.extractArchive(archivePath, destPath);
		}
	};
	require_common$1.__decorate([
		(0, import_common$2.PostConstruct)(),
		require_common$1.__decorateMetadata("design:type", Function),
		require_common$1.__decorateMetadata("design:paramtypes", []),
		require_common$1.__decorateMetadata("design:returntype", void 0)
	], PlatformAdapterProvider.prototype, "init", null);
	PlatformAdapterProvider = require_common$1.__decorate([(0, import_common$2.Component)(PlatformAdapter)], PlatformAdapterProvider);
}));
//#endregion
//#region ../../packages/binary-manager/src/platform/index.ts
var init_platform = require_chunk.__esmMin((() => {
	init_platform_protocol();
	init_base_platform_adapter();
	init_darwin_adapter();
	init_win32_adapter();
	init_platform_adapter_provider();
})), updatedAt, binaries, builtin_manifest_default;
var init_builtin_manifest = require_chunk.__esmMin((() => {
	updatedAt = "2026-03-19T00:00:00Z";
	binaries = /* @__PURE__ */ JSON.parse("{\"python\":{\"recommended\":\"3.13.12\",\"versions\":{\"3.10.20\":{\"darwin-arm64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20260303/cpython-3.10.20+20260303-aarch64-apple-darwin-install_only.tar.gz\",\"sha256\":\"\",\"size\":44000000},\"darwin-x64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20260303/cpython-3.10.20+20260303-x86_64-apple-darwin-install_only.tar.gz\",\"sha256\":\"\",\"size\":47000000},\"linux-x64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20260303/cpython-3.10.20+20260303-x86_64-unknown-linux-gnu-install_only.tar.gz\",\"sha256\":\"\",\"size\":48000000},\"linux-arm64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20260303/cpython-3.10.20+20260303-aarch64-unknown-linux-gnu-install_only.tar.gz\",\"sha256\":\"\",\"size\":44068379},\"win32-x64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20260303/cpython-3.10.20+20260303-x86_64-pc-windows-msvc-install_only.tar.gz\",\"sha256\":\"\",\"size\":51000000}},\"3.11.9\":{\"darwin-arm64\":{\"url\":\"https://github.com/indygreg/python-build-standalone/releases/download/20240415/cpython-3.11.9+20240415-aarch64-apple-darwin-install_only.tar.gz\",\"sha256\":\"\",\"size\":45000000},\"darwin-x64\":{\"url\":\"https://github.com/indygreg/python-build-standalone/releases/download/20240415/cpython-3.11.9+20240415-x86_64-apple-darwin-install_only.tar.gz\",\"sha256\":\"\",\"size\":48000000},\"linux-x64\":{\"url\":\"https://github.com/indygreg/python-build-standalone/releases/download/20240415/cpython-3.11.9+20240415-x86_64-unknown-linux-gnu-install_only.tar.gz\",\"sha256\":\"\",\"size\":49000000},\"linux-arm64\":{\"url\":\"https://github.com/indygreg/python-build-standalone/releases/download/20240415/cpython-3.11.9+20240415-aarch64-unknown-linux-gnu-install_only.tar.gz\",\"sha256\":\"\",\"size\":26061145},\"win32-x64\":{\"url\":\"https://github.com/indygreg/python-build-standalone/releases/download/20240415/cpython-3.11.9+20240415-x86_64-pc-windows-msvc-shared-install_only.tar.gz\",\"sha256\":\"\",\"size\":52000000}},\"3.11.15\":{\"darwin-arm64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20260303/cpython-3.11.15+20260303-aarch64-apple-darwin-install_only.tar.gz\",\"sha256\":\"\",\"size\":46000000},\"darwin-x64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20260303/cpython-3.11.15+20260303-x86_64-apple-darwin-install_only.tar.gz\",\"sha256\":\"\",\"size\":49000000},\"linux-x64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20260303/cpython-3.11.15+20260303-x86_64-unknown-linux-gnu-install_only.tar.gz\",\"sha256\":\"\",\"size\":50000000},\"linux-arm64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20260303/cpython-3.11.15+20260303-aarch64-unknown-linux-gnu-install_only.tar.gz\",\"sha256\":\"\",\"size\":48478587},\"win32-x64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20260303/cpython-3.11.15+20260303-x86_64-pc-windows-msvc-install_only.tar.gz\",\"sha256\":\"\",\"size\":53000000}},\"3.12.8\":{\"darwin-arm64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20241205/cpython-3.12.8+20241205-aarch64-apple-darwin-install_only.tar.gz\",\"sha256\":\"\",\"size\":47000000},\"darwin-x64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20241205/cpython-3.12.8+20241205-x86_64-apple-darwin-install_only.tar.gz\",\"sha256\":\"\",\"size\":50000000},\"linux-x64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20241205/cpython-3.12.8+20241205-x86_64-unknown-linux-gnu-install_only.tar.gz\",\"sha256\":\"\",\"size\":51000000},\"linux-arm64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20241205/cpython-3.12.8+20241205-aarch64-unknown-linux-gnu-install_only.tar.gz\",\"sha256\":\"\",\"size\":24449546},\"win32-x64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20241205/cpython-3.12.8+20241205-x86_64-pc-windows-msvc-shared-install_only.tar.gz\",\"sha256\":\"\",\"size\":54000000}},\"3.12.13\":{\"darwin-arm64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20260303/cpython-3.12.13+20260303-aarch64-apple-darwin-install_only.tar.gz\",\"sha256\":\"\",\"size\":48000000},\"darwin-x64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20260303/cpython-3.12.13+20260303-x86_64-apple-darwin-install_only.tar.gz\",\"sha256\":\"\",\"size\":51000000},\"linux-x64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20260303/cpython-3.12.13+20260303-x86_64-unknown-linux-gnu-install_only.tar.gz\",\"sha256\":\"\",\"size\":52000000},\"linux-arm64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20260303/cpython-3.12.13+20260303-aarch64-unknown-linux-gnu-install_only.tar.gz\",\"sha256\":\"\",\"size\":81885303},\"win32-x64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20260303/cpython-3.12.13+20260303-x86_64-pc-windows-msvc-install_only.tar.gz\",\"sha256\":\"\",\"size\":55000000}},\"3.13.1\":{\"darwin-arm64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20241205/cpython-3.13.1+20241205-aarch64-apple-darwin-install_only.tar.gz\",\"sha256\":\"\",\"size\":48000000},\"darwin-x64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20241205/cpython-3.13.1+20241205-x86_64-apple-darwin-install_only.tar.gz\",\"sha256\":\"\",\"size\":51000000},\"linux-x64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20241205/cpython-3.13.1+20241205-x86_64-unknown-linux-gnu-install_only.tar.gz\",\"sha256\":\"\",\"size\":52000000},\"linux-arm64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20241205/cpython-3.13.1+20241205-aarch64-unknown-linux-gnu-install_only.tar.gz\",\"sha256\":\"\",\"size\":24589218},\"win32-x64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20241205/cpython-3.13.1+20241205-x86_64-pc-windows-msvc-shared-install_only.tar.gz\",\"sha256\":\"\",\"size\":55000000}},\"3.13.12\":{\"darwin-arm64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20260203/cpython-3.13.12+20260203-aarch64-apple-darwin-install_only.tar.gz\",\"sha256\":\"\",\"size\":49000000},\"darwin-x64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20260203/cpython-3.13.12+20260203-x86_64-apple-darwin-install_only.tar.gz\",\"sha256\":\"\",\"size\":52000000},\"linux-x64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20260203/cpython-3.13.12+20260203-x86_64-unknown-linux-gnu-install_only.tar.gz\",\"sha256\":\"\",\"size\":53000000},\"linux-arm64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20260203/cpython-3.13.12+20260203-aarch64-unknown-linux-gnu-install_only.tar.gz\",\"sha256\":\"\",\"size\":93918143},\"win32-x64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20260203/cpython-3.13.12+20260203-x86_64-pc-windows-msvc-install_only.tar.gz\",\"sha256\":\"\",\"size\":56000000}},\"3.14.3\":{\"darwin-arm64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20260203/cpython-3.14.3+20260203-aarch64-apple-darwin-install_only.tar.gz\",\"sha256\":\"\",\"size\":50000000},\"darwin-x64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20260203/cpython-3.14.3+20260203-x86_64-apple-darwin-install_only.tar.gz\",\"sha256\":\"\",\"size\":53000000},\"linux-x64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20260203/cpython-3.14.3+20260203-x86_64-unknown-linux-gnu-install_only.tar.gz\",\"sha256\":\"\",\"size\":54000000},\"linux-arm64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20260203/cpython-3.14.3+20260203-aarch64-unknown-linux-gnu-install_only.tar.gz\",\"sha256\":\"\",\"size\":95376445},\"win32-x64\":{\"url\":\"https://github.com/astral-sh/python-build-standalone/releases/download/20260203/cpython-3.14.3+20260203-x86_64-pc-windows-msvc-install_only.tar.gz\",\"sha256\":\"\",\"size\":57000000}}}},\"node\":{\"recommended\":\"22.12.0\",\"versions\":{\"16.20.2\":{\"darwin-arm64\":{\"url\":\"https://nodejs.org/dist/v16.20.2/node-v16.20.2-darwin-arm64.tar.gz\",\"sha256\":\"\",\"size\":36000000},\"darwin-x64\":{\"url\":\"https://nodejs.org/dist/v16.20.2/node-v16.20.2-darwin-x64.tar.gz\",\"sha256\":\"\",\"size\":39000000},\"linux-x64\":{\"url\":\"https://nodejs.org/dist/v16.20.2/node-v16.20.2-linux-x64.tar.gz\",\"sha256\":\"\",\"size\":38000000},\"linux-arm64\":{\"url\":\"https://nodejs.org/dist/v16.20.2/node-v16.20.2-linux-arm64.tar.gz\",\"sha256\":\"\",\"size\":38000000},\"win32-x64\":{\"url\":\"https://nodejs.org/dist/v16.20.2/node-v16.20.2-win-x64.zip\",\"sha256\":\"\",\"size\":26000000}},\"18.20.4\":{\"darwin-arm64\":{\"url\":\"https://nodejs.org/dist/v18.20.4/node-v18.20.4-darwin-arm64.tar.gz\",\"sha256\":\"\",\"size\":40000000},\"darwin-x64\":{\"url\":\"https://nodejs.org/dist/v18.20.4/node-v18.20.4-darwin-x64.tar.gz\",\"sha256\":\"\",\"size\":43000000},\"linux-x64\":{\"url\":\"https://nodejs.org/dist/v18.20.4/node-v18.20.4-linux-x64.tar.gz\",\"sha256\":\"\",\"size\":42000000},\"linux-arm64\":{\"url\":\"https://nodejs.org/dist/v18.20.4/node-v18.20.4-linux-arm64.tar.gz\",\"sha256\":\"\",\"size\":42000000},\"win32-x64\":{\"url\":\"https://nodejs.org/dist/v18.20.4/node-v18.20.4-win-x64.zip\",\"sha256\":\"\",\"size\":28000000}},\"20.15.0\":{\"darwin-arm64\":{\"url\":\"https://nodejs.org/dist/v20.15.0/node-v20.15.0-darwin-arm64.tar.gz\",\"sha256\":\"\",\"size\":42000000},\"darwin-x64\":{\"url\":\"https://nodejs.org/dist/v20.15.0/node-v20.15.0-darwin-x64.tar.gz\",\"sha256\":\"\",\"size\":45000000},\"linux-x64\":{\"url\":\"https://nodejs.org/dist/v20.15.0/node-v20.15.0-linux-x64.tar.gz\",\"sha256\":\"\",\"size\":44000000},\"linux-arm64\":{\"url\":\"https://nodejs.org/dist/v20.15.0/node-v20.15.0-linux-arm64.tar.gz\",\"sha256\":\"\",\"size\":44000000},\"win32-x64\":{\"url\":\"https://nodejs.org/dist/v20.15.0/node-v20.15.0-win-x64.zip\",\"sha256\":\"\",\"size\":30000000}},\"20.18.0\":{\"darwin-arm64\":{\"url\":\"https://nodejs.org/dist/v20.18.0/node-v20.18.0-darwin-arm64.tar.gz\",\"sha256\":\"\",\"size\":42000000},\"darwin-x64\":{\"url\":\"https://nodejs.org/dist/v20.18.0/node-v20.18.0-darwin-x64.tar.gz\",\"sha256\":\"\",\"size\":45000000},\"linux-x64\":{\"url\":\"https://nodejs.org/dist/v20.18.0/node-v20.18.0-linux-x64.tar.gz\",\"sha256\":\"\",\"size\":44000000},\"linux-arm64\":{\"url\":\"https://nodejs.org/dist/v20.18.0/node-v20.18.0-linux-arm64.tar.gz\",\"sha256\":\"\",\"size\":44000000},\"win32-x64\":{\"url\":\"https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip\",\"sha256\":\"\",\"size\":30000000}},\"22.12.0\":{\"darwin-arm64\":{\"url\":\"https://nodejs.org/dist/v22.12.0/node-v22.12.0-darwin-arm64.tar.gz\",\"sha256\":\"\",\"size\":44000000},\"darwin-x64\":{\"url\":\"https://nodejs.org/dist/v22.12.0/node-v22.12.0-darwin-x64.tar.gz\",\"sha256\":\"\",\"size\":47000000},\"linux-x64\":{\"url\":\"https://nodejs.org/dist/v22.12.0/node-v22.12.0-linux-x64.tar.gz\",\"sha256\":\"\",\"size\":46000000},\"linux-arm64\":{\"url\":\"https://nodejs.org/dist/v22.12.0/node-v22.12.0-linux-arm64.tar.gz\",\"sha256\":\"\",\"size\":46000000},\"win32-x64\":{\"url\":\"https://nodejs.org/dist/v22.12.0/node-v22.12.0-win-x64.zip\",\"sha256\":\"\",\"size\":32000000}},\"23.11.1\":{\"darwin-arm64\":{\"url\":\"https://nodejs.org/dist/v23.11.1/node-v23.11.1-darwin-arm64.tar.gz\",\"sha256\":\"\",\"size\":45000000},\"darwin-x64\":{\"url\":\"https://nodejs.org/dist/v23.11.1/node-v23.11.1-darwin-x64.tar.gz\",\"sha256\":\"\",\"size\":48000000},\"linux-x64\":{\"url\":\"https://nodejs.org/dist/v23.11.1/node-v23.11.1-linux-x64.tar.gz\",\"sha256\":\"\",\"size\":47000000},\"linux-arm64\":{\"url\":\"https://nodejs.org/dist/v23.11.1/node-v23.11.1-linux-arm64.tar.gz\",\"sha256\":\"\",\"size\":47000000},\"win32-x64\":{\"url\":\"https://nodejs.org/dist/v23.11.1/node-v23.11.1-win-x64.zip\",\"sha256\":\"\",\"size\":33000000}},\"24.14.0\":{\"darwin-arm64\":{\"url\":\"https://nodejs.org/dist/v24.14.0/node-v24.14.0-darwin-arm64.tar.gz\",\"sha256\":\"\",\"size\":46000000},\"darwin-x64\":{\"url\":\"https://nodejs.org/dist/v24.14.0/node-v24.14.0-darwin-x64.tar.gz\",\"sha256\":\"\",\"size\":49000000},\"linux-x64\":{\"url\":\"https://nodejs.org/dist/v24.14.0/node-v24.14.0-linux-x64.tar.gz\",\"sha256\":\"\",\"size\":48000000},\"linux-arm64\":{\"url\":\"https://nodejs.org/dist/v24.14.0/node-v24.14.0-linux-arm64.tar.gz\",\"sha256\":\"\",\"size\":48000000},\"win32-x64\":{\"url\":\"https://nodejs.org/dist/v24.14.0/node-v24.14.0-win-x64.zip\",\"sha256\":\"\",\"size\":34000000}}}}}");
	builtin_manifest_default = {
		version: 1,
		updatedAt,
		binaries
	};
}));
//#endregion
//#region ../../packages/binary-manager/src/manifest/manifest-manager.ts
var import_common$1, _ref, _ref2, ManifestManagerImpl;
var init_manifest_manager = require_chunk.__esmMin((() => {
	import_common$1 = require_common$1.require_common$1();
	init_platform_protocol();
	init_builtin_manifest();
	init_manifest_protocol();
	require_common$1.init_decorateMetadata();
	require_common$1.init_decorate();
	ManifestManagerImpl = class ManifestManagerImpl {
		constructor() {
			this.CACHE_TTL = 1440 * 60 * 1e3;
		}
		get manifestCachePath() {
			return path.join(this.platformAdapter.binariesDir, ".cache", "manifest.json");
		}
		async getManifest() {
			const cached = await this.loadCachedManifest();
			if (cached && Date.now() - cached.fetchedAt < this.CACHE_TTL) return cached.manifest;
			try {
				const remote = await this.fetchRemoteManifest();
				await this.saveCachedManifest(remote);
				return remote;
			} catch {
				return cached?.manifest ?? this.loadBuiltinManifest();
			}
		}
		async refresh() {
			try {
				const remote = await this.fetchRemoteManifest();
				await this.saveCachedManifest(remote);
				return remote;
			} catch {
				return this.loadBuiltinManifest();
			}
		}
		loadBuiltinManifest() {
			return builtin_manifest_default;
		}
		async loadCachedManifest() {
			try {
				const content = await fs_promises.readFile(this.manifestCachePath, "utf-8");
				return JSON.parse(content);
			} catch {
				return null;
			}
		}
		/**
		* 原子写入：先写临时文件，再 rename 替换
		*/
		async saveCachedManifest(manifest) {
			const data = {
				manifest,
				fetchedAt: Date.now()
			};
			const dir = path.dirname(this.manifestCachePath);
			await fs_promises.mkdir(dir, { recursive: true });
			const tmpPath = `${this.manifestCachePath}.tmp`;
			try {
				await fs_promises.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf-8");
				await fs_promises.rename(tmpPath, this.manifestCachePath);
			} catch (error) {
				await fs_promises.rm(tmpPath, { force: true }).catch(() => {});
				throw error;
			}
		}
		/**
		* 从远程获取清单
		* TODO: 配置远程 manifest URL
		*/
		async fetchRemoteManifest() {
			throw new Error("Remote manifest fetch not implemented yet");
		}
	};
	require_common$1.__decorate([(0, import_common$1.Autowired)(import_common$1.Logger), require_common$1.__decorateMetadata("design:type", typeof (_ref = typeof import_common$1.Logger !== "undefined" && import_common$1.Logger) === "function" ? _ref : Object)], ManifestManagerImpl.prototype, "logger", void 0);
	require_common$1.__decorate([(0, import_common$1.Autowired)(PlatformAdapter), require_common$1.__decorateMetadata("design:type", typeof (_ref2 = typeof PlatformAdapter !== "undefined" && PlatformAdapter) === "function" ? _ref2 : Object)], ManifestManagerImpl.prototype, "platformAdapter", void 0);
	ManifestManagerImpl = require_common$1.__decorate([(0, import_common$1.Component)(ManifestManager)], ManifestManagerImpl);
}));
//#endregion
//#region ../../packages/binary-manager/src/manifest/index.ts
var init_manifest = require_chunk.__esmMin((() => {
	init_manifest_protocol();
	init_manifest_manager();
}));
var init_binary_context_middleware = require_chunk.__esmMin((() => {
	require_common$1.require_common$1();
	init_type_configs();
}));
//#endregion
//#region ../../packages/binary-manager/src/middleware/index.ts
var init_middleware = require_chunk.__esmMin((() => {
	init_binary_context_middleware();
}));
var init_env_isolation = require_chunk.__esmMin((() => {
	init_type_configs();
	[...getRegisteredBinaryTypes().flatMap((type) => getBinaryTypeConfig(type).blockedEnvVars ?? [])];
}));
//#endregion
//#region ../../packages/binary-manager/src/utils/index.ts
var init_utils = require_chunk.__esmMin((() => {
	init_retry();
	init_install_lock();
	init_disk_check();
	init_env_isolation();
}));
//#endregion
//#region ../../packages/binary-manager/src/index.ts
var init_src = require_chunk.__esmMin((() => {
	init_types();
	init_binary();
	init_platform();
	init_manifest();
	init_middleware();
	init_utils();
}));
//#endregion
//#region ../../packages/workbuddy-server/src/runtime/client-info-env.ts
/**
* Build a `CLIENT_INFO_*` environment variable bag for spawned agent-cli
* child processes.
*/
var WORKBUDDY_PLATFORM = "WorkBuddy";
var WORKBUDDY_PLUGIN_NAME = "workbuddy-desktop";
var cachedEnv;
var cachedEnvVersion;
var cachedEnvAssetResolver;
function buildWorkbuddyClientInfoEnv(options = {}) {
	const result = { ...getCachedBaseEnv(options) };
	const channel = process.env.CODEBUDDY_CLIENT_INFO_DOWNLOAD_CHANNEL;
	if (channel) result.CODEBUDDY_CLIENT_INFO_DOWNLOAD_CHANNEL = channel;
	const machineId = resolveHostMachineId();
	if (machineId) result.CLIENT_INFO_MACHINE_ID = machineId;
	return result;
}
/**
* Resolve the host machineId: prefer the value already in env (propagated from the
* desktop main / inherited by the daemon via CLIENT_INFO_MACHINE_ID), else probe
* once — machineIdSync() memoizes per process. Shared by the env-bag builder above
* and WorkbuddyClientInfoProvider so the "prefer inherited env, else probe" rule
* lives in one place. (agent-cli's provider keeps its own copy — separate package
* with a deliberately-mirrored machine-uuid module.)
*/
function resolveHostMachineId() {
	return process.env.CLIENT_INFO_MACHINE_ID || machineIdSync();
}
function getCachedBaseEnv(options) {
	const version = resolveDesktopVersion(options);
	const assetResolver = options.resolveBundledAsset;
	if (cachedEnv && cachedEnvVersion === version && cachedEnvAssetResolver === assetResolver) return cachedEnv;
	const productName = resolveBundledProductName(assetResolver) ?? WORKBUDDY_PLATFORM;
	const cliVersion = resolveBundledCliVersion(assetResolver);
	cachedEnv = {
		CLIENT_INFO_PLATFORM: WORKBUDDY_PLATFORM,
		CLIENT_INFO_PLATFORM_VERSION: version,
		CLIENT_INFO_IDE_TYPE: WORKBUDDY_PLATFORM,
		CLIENT_INFO_PRODUCT_NAME: productName,
		CLIENT_INFO_PRODUCT_VERSION: version,
		CLIENT_INFO_PLUGIN_NAME: WORKBUDDY_PLUGIN_NAME,
		CLIENT_INFO_PLUGIN_VERSION: version,
		...cliVersion ? { CLIENT_INFO_USER_AGENT_EXTENSION: `CLI/${cliVersion}` } : {}
	};
	cachedEnvVersion = version;
	cachedEnvAssetResolver = assetResolver;
	return cachedEnv;
}
function resolveDesktopVersion(options) {
	try {
		return options.getAppVersion?.() ?? "";
	} catch {
		return "";
	}
}
function resolveBundledProductName(resolveBundledAsset) {
	const resolved = resolveBundledAsset?.("product.json");
	if (!resolved) return;
	try {
		const product = JSON.parse(node_fs.readFileSync(resolved, "utf-8"));
		if (typeof product.productName === "string" && product.productName) return product.productName;
	} catch {}
}
function resolveBundledCliVersion(resolveBundledAsset) {
	const resolved = resolveBundledAsset?.("cli", "package.json");
	if (!resolved) return;
	try {
		const pkg = JSON.parse(node_fs.readFileSync(resolved, "utf-8"));
		const ver = pkg.version;
		if (ver && ver !== "0.0.0") return ver;
		const customPkg = pkg.publishConfig?.customPackage;
		if (typeof customPkg?.version === "string" && customPkg.version) return customPkg.version;
	} catch {}
}
//#endregion
Object.defineProperty(exports, "BinaryError", {
	enumerable: true,
	get: function() {
		return BinaryError;
	}
});
Object.defineProperty(exports, "BinaryErrorCode", {
	enumerable: true,
	get: function() {
		return BinaryErrorCode;
	}
});
Object.defineProperty(exports, "BinaryManager", {
	enumerable: true,
	get: function() {
		return BinaryManager;
	}
});
Object.defineProperty(exports, "buildWorkbuddyClientInfoEnv", {
	enumerable: true,
	get: function() {
		return buildWorkbuddyClientInfoEnv;
	}
});
Object.defineProperty(exports, "describeProxyForNodeRequest", {
	enumerable: true,
	get: function() {
		return describeProxyForNodeRequest;
	}
});
Object.defineProperty(exports, "getRegisteredBinaryTypes", {
	enumerable: true,
	get: function() {
		return getRegisteredBinaryTypes;
	}
});
Object.defineProperty(exports, "init_proxy_agent_util", {
	enumerable: true,
	get: function() {
		return init_proxy_agent_util;
	}
});
Object.defineProperty(exports, "init_src", {
	enumerable: true,
	get: function() {
		return init_src;
	}
});
Object.defineProperty(exports, "machineIdSync", {
	enumerable: true,
	get: function() {
		return machineIdSync;
	}
});
Object.defineProperty(exports, "require_semver", {
	enumerable: true,
	get: function() {
		return require_semver;
	}
});
Object.defineProperty(exports, "resolveHostMachineId", {
	enumerable: true,
	get: function() {
		return resolveHostMachineId;
	}
});
Object.defineProperty(exports, "resolveNodeProxyAgent", {
	enumerable: true,
	get: function() {
		return resolveNodeProxyAgent;
	}
});
