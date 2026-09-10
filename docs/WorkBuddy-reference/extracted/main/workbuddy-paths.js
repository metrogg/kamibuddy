const require_chunk = require("./chunk.js");
const require_workbuddy_product_config = require("./workbuddy-product-config.js");
let fs = require("fs");
fs = require_chunk.__toESM(fs);
let os = require("os");
os = require_chunk.__toESM(os);
let path = require("path");
path = require_chunk.__toESM(path);
//#region src/main/system/runtime/workbuddy-paths.ts
/**
* WorkBuddy 路径与实例元信息（纯函数，禁止 import electron）。
*
* 背景（#issue-daemon-white-screen）：
* 之前所有路径函数都写在 `app-instance.ts` 里，与 `import { app } from 'electron'`
* 同文件。rolldown 打包 `daemon-app-server-main` 时，通过 `module.app-server.ts`
* → `system/runtime/index.ts` → `workbuddy-product-config.ts` 的传递依赖，
* 把 `app-instance.ts` 拖进公共 chunk（`app-instance.js`），
* chunk 顶层保留 `let electron = require("electron")`。
* daemon 子进程用 `ELECTRON_RUN_AS_NODE=1` 启动，Node 侧
* `require('electron')` 抛 `Cannot find module 'electron'`，daemon 崩溃，
* renderer 白屏 30s。参考：Electron 官方文档明确说明
* `ELECTRON_RUN_AS_NODE` 下 electron 内置模块不可用。
*
* 解决方案：
* - 本文件只放**纯 path 计算** + env 读取，**禁止**任何形式的 electron import。
* - `app-instance.ts` 从这里 re-export，保持对外 API 不变。
* - 需要 `app.getAppPath()` 的地方改成读 `process.env.WORKBUDDY_APP_PATH`
*   （由主进程 `configureElectronApp()` 首次调用时写入）。
*
* 守卫：`.ci` / lint 里可以加规则禁止本文件 import 'electron'。
*/
/**
* `app.getAppPath()` 的等价物。
*
* 主进程侧由 `configureElectronApp()` 把 `app.getAppPath()` 写入
* `WORKBUDDY_APP_PATH`；daemon / 非 Electron 上下文回落到 `process.cwd()`。
* 只用于 `detectInstanceNumber` 推断多实例目录后缀（如 "-2"），
* 拿不到时返回空字符串，会走 `WORKBUDDY_INSTANCE_NUMBER=''` 单实例分支。
*/
function readAppPathFromEnv() {
	const explicit = process.env.WORKBUDDY_APP_PATH?.trim();
	if (explicit) return explicit;
	return process.cwd();
}
function getDefaultConfigDirname() {
	return require_workbuddy_product_config.resolveWorkbuddyDataFolderName();
}
function detectInstanceNumber() {
	if (process.env.WORKBUDDY_FORCE_NO_INSTANCE_NUMBER) return "";
	const explicitInstanceNumber = process.env.WORKBUDDY_INSTANCE_NUMBER?.trim();
	if (explicitInstanceNumber) return explicitInstanceNumber;
	try {
		const appPath = readAppPathFromEnv();
		if (!appPath) return "";
		const repoDir = path.resolve(appPath, "../../../..");
		return path.basename(repoDir).match(/-(\d+)$/)?.[1] ?? "";
	} catch {
		return "";
	}
}
function getInstanceSuffix() {
	const instanceNumber = detectInstanceNumber();
	return instanceNumber ? `-${instanceNumber}` : "";
}
function deriveDefaultAppName() {
	const instanceNumber = detectInstanceNumber();
	return instanceNumber ? `${DEFAULT_APP_NAME} [${instanceNumber}]` : DEFAULT_APP_NAME;
}
function deriveDefaultSchemes() {
	const suffix = getInstanceSuffix().replace(/^-/, "");
	const product = require_workbuddy_product_config.tryGetWorkbuddyBaseProductConfiguration();
	const productSchemes = Array.isArray(product?.deepLinkSchemes) ? product.deepLinkSchemes.filter((s) => typeof s === "string" && s.trim()) : [];
	return (productSchemes.length > 0 ? productSchemes : DEFAULT_DEEPLINK_SCHEMES).map((scheme) => `${scheme}${suffix}`);
}
function parseSchemes(value) {
	return (value ?? "").split(",").map((scheme) => scheme.trim()).filter(Boolean);
}
function getWorkbuddyAppName() {
	return process.env.WORKBUDDY_APP_NAME?.trim() || deriveDefaultAppName();
}
function getWorkbuddyConfigDir() {
	return require_workbuddy_product_config.resolveWorkbuddyConfigDir();
}
function getWorkbuddyUserDataDir() {
	return process.env.WORKBUDDY_USER_DATA_DIR?.trim() || path.join(getWorkbuddyConfigDir(), "app");
}
/**
* 安装目录（含可执行文件的目录）。
* - 生产模式：返回 {安装目录}/（如 C:\Program Files\WorkBuddy）
* - dev 模式：返回项目里 electron 二进制所在目录
* - 支持环境变量 WORKBUDDY_INSTALL_DIR 覆盖（方便企业私有化部署）
*/
function getWorkbuddyInstallDir() {
	return process.env.WORKBUDDY_INSTALL_DIR?.trim() || path.dirname(process.execPath);
}
function getWorkbuddySessionDataDir() {
	return path.join(getWorkbuddyUserDataDir(), "session");
}
function getWorkbuddySkillsDir() {
	return path.join(getWorkbuddyConfigDir(), "skills");
}
function getWorkbuddyLogsDir(...segments) {
	return path.join(getWorkbuddyConfigDir(), "logs", ...segments);
}
/** Pending telemetry directory (install/update timing, repair events). */
function getWorkbuddyPendingTelemetryDir() {
	if (process.platform === "win32" || process.platform === "linux") return path.join(getWorkbuddyConfigDir(), "pending-telemetry");
	return path.join(os.homedir(), "Library", "Application Support", getWorkbuddyAppName(), "pending-telemetry");
}
function ensureWorkbuddyDataDirs() {
	const dirs = [
		getWorkbuddyConfigDir(),
		getWorkbuddyUserDataDir(),
		getWorkbuddySkillsDir(),
		getWorkbuddyLogsDir()
	];
	for (const dir of dirs) if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function getRegisteredDeepLinkSchemes() {
	const fromList = parseSchemes(process.env.WORKBUDDY_DEEPLINK_SCHEMES);
	if (fromList.length > 0) return fromList;
	const primaryScheme = process.env.WORKBUDDY_DEEPLINK_SCHEME?.trim();
	if (primaryScheme) return [primaryScheme];
	return deriveDefaultSchemes();
}
function isWorkbuddyDeepLink(url) {
	try {
		const scheme = new URL(url).protocol.replace(/:$/, "");
		return getRegisteredDeepLinkSchemes().includes(scheme);
	} catch {
		return false;
	}
}
function getRendererEntryUrl() {
	const rendererUrl = process.env.ELECTRON_RENDERER_URL?.trim();
	return rendererUrl ? rendererUrl : null;
}
/**
* 内部使用（`app-instance.ts` 的 `configureElectronApp` 需要读默认目录名）。
* 不作为对外 API 暴露，避免调用方绕开 `getWorkbuddyConfigDir`。
*/
function _internalGetDefaultConfigDirname() {
	return getDefaultConfigDirname();
}
/**
* 内部使用（`app-instance.ts` 的 `configureElectronApp` 需要判断多实例后缀）。
* 不作为对外 API 暴露。
*/
function _internalDetectInstanceNumber() {
	return detectInstanceNumber();
}
var DEFAULT_APP_NAME, DEFAULT_DEEPLINK_SCHEMES;
var init_workbuddy_paths = require_chunk.__esmMin((() => {
	require_workbuddy_product_config.init_workbuddy_product_config();
	DEFAULT_APP_NAME = "WorkBuddy";
	DEFAULT_DEEPLINK_SCHEMES = ["workbuddy"];
}));
//#endregion
Object.defineProperty(exports, "_internalDetectInstanceNumber", {
	enumerable: true,
	get: function() {
		return _internalDetectInstanceNumber;
	}
});
Object.defineProperty(exports, "_internalGetDefaultConfigDirname", {
	enumerable: true,
	get: function() {
		return _internalGetDefaultConfigDirname;
	}
});
Object.defineProperty(exports, "ensureWorkbuddyDataDirs", {
	enumerable: true,
	get: function() {
		return ensureWorkbuddyDataDirs;
	}
});
Object.defineProperty(exports, "getRegisteredDeepLinkSchemes", {
	enumerable: true,
	get: function() {
		return getRegisteredDeepLinkSchemes;
	}
});
Object.defineProperty(exports, "getRendererEntryUrl", {
	enumerable: true,
	get: function() {
		return getRendererEntryUrl;
	}
});
Object.defineProperty(exports, "getWorkbuddyAppName", {
	enumerable: true,
	get: function() {
		return getWorkbuddyAppName;
	}
});
Object.defineProperty(exports, "getWorkbuddyConfigDir", {
	enumerable: true,
	get: function() {
		return getWorkbuddyConfigDir;
	}
});
Object.defineProperty(exports, "getWorkbuddyInstallDir", {
	enumerable: true,
	get: function() {
		return getWorkbuddyInstallDir;
	}
});
Object.defineProperty(exports, "getWorkbuddyLogsDir", {
	enumerable: true,
	get: function() {
		return getWorkbuddyLogsDir;
	}
});
Object.defineProperty(exports, "getWorkbuddyPendingTelemetryDir", {
	enumerable: true,
	get: function() {
		return getWorkbuddyPendingTelemetryDir;
	}
});
Object.defineProperty(exports, "getWorkbuddySessionDataDir", {
	enumerable: true,
	get: function() {
		return getWorkbuddySessionDataDir;
	}
});
Object.defineProperty(exports, "getWorkbuddyUserDataDir", {
	enumerable: true,
	get: function() {
		return getWorkbuddyUserDataDir;
	}
});
Object.defineProperty(exports, "init_workbuddy_paths", {
	enumerable: true,
	get: function() {
		return init_workbuddy_paths;
	}
});
Object.defineProperty(exports, "isWorkbuddyDeepLink", {
	enumerable: true,
	get: function() {
		return isWorkbuddyDeepLink;
	}
});
