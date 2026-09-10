const require_chunk = require("./chunk.js");
const require_workbuddy_product_config = require("./workbuddy-product-config.js");
const require_workbuddy_paths = require("./workbuddy-paths.js");
let electron = require("electron");
let child_process = require("child_process");
//#region src/main/system/runtime/workbuddy-user-agent.ts
/**
* Electron User-Agent 规范化：保证腾讯文档 EditorSDK 能识别 WorkBuddy。
*
* SDK（slide/doc `pc~vendors`）判定：
*   `isWorkBuddy = /WorkBuddy(?:selfhost\d*|[-_]?ai)?\//i.test(userAgent)`
*
* 多开实例下 `app.setName("WorkBuddy [N]")` 后，Chromium 常把 UA 写成
* `WorkBuddy[N]/x.y.z`（无空格、无 `Brand/` token）。此时精确
* `replace(getName()/version → applicationName/version)` 会 miss，
* SDK 门禁失败 → pptx/docx 无「AI编辑」入口（#60902）。
*/
function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/**
* 确保 UA 含有 `${applicationName}/` token（SDK isWorkBuddy 所需的 slash 形态）。
* 已含则原样返回；否则优先替换 `Brand[N]/ver` / `Brand [N]/ver`，再回退注入。
*/
function ensureApplicationUserAgentToken(userAgent, applicationName, version) {
	const brand = applicationName.trim();
	if (!brand || !userAgent) return userAgent;
	const token = `${brand}/${version}`;
	if (new RegExp(`${escapeRegExp(brand)}/`, "i").test(userAgent)) return userAgent;
	const instanceToken = new RegExp(`${escapeRegExp(brand)}\\s*\\[\\d+\\]\\/${escapeRegExp(version)}`, "i");
	if (instanceToken.test(userAgent)) return userAgent.replace(instanceToken, token);
	const plainToken = new RegExp(`${escapeRegExp(brand)}\\/${escapeRegExp(version)}`, "i");
	if (plainToken.test(userAgent)) return userAgent.replace(plainToken, token);
	if (/ Chrome\//i.test(userAgent)) return userAgent.replace(/ Chrome\//i, ` ${token} Chrome/`);
	return `${userAgent} ${token}`;
}
var init_workbuddy_user_agent = require_chunk.__esmMin((() => {}));
//#endregion
//#region src/main/system/runtime/app-instance.ts
function removeLegacyProtocolRegistrations() {
	for (const scheme of LEGACY_SCHEMES_TO_REMOVE) electron.app.removeAsDefaultProtocolClient(scheme);
	if (process.platform === "darwin") unregisterAllWorkbuddyDeepLinksFromLaunchServices();
}
/**
* Asynchronously find all WorkBuddy app bundle paths registered in Launch Services
* that still have codebuddy:// bindings, and unregister them. Runs in background
* to avoid blocking app startup.
*
* After cleanup, re-registers the current app to restore workbuddy:// binding.
*/
function unregisterAllWorkbuddyDeepLinksFromLaunchServices() {
	const appMatch = process.execPath.match(/^(.+?\.app)\//);
	const currentBundlePath = appMatch ? appMatch[1] : "";
	try {
		(0, child_process.execFile)("/bin/sh", ["-c", `${LSREGISTER_PATH} -dump | grep -E "^(bundle id:|path:)" | grep -A 1 "bundle id:.*WorkBuddy" | grep "path:" | sort -u`], {
			encoding: "utf8",
			maxBuffer: 10 * 1024 * 1024
		}, (err, stdout) => {
			if (err || !stdout) return;
			const paths = [];
			for (const line of stdout.split("\n")) {
				const match = line.match(/^\s*path:\s*(.+?)\s*\(0x[0-9a-f]+\)\s*$/);
				if (!match) continue;
				const appPath = match[1].trim();
				if (currentBundlePath && appPath === currentBundlePath) continue;
				if (appPath && !paths.includes(appPath)) paths.push(appPath);
			}
			if (paths.length === 0) return;
			for (const appPath of paths) try {
				(0, child_process.spawnSync)(LSREGISTER_PATH, ["-u", appPath], { timeout: 5e3 });
				console.log(`[LegacyProtocolCleanup] unregistered stale Launch Services entry: ${appPath}`);
			} catch {}
		});
	} catch {}
}
function configureElectronApp() {
	try {
		process.env.WORKBUDDY_APP_PATH = electron.app.getAppPath();
	} catch {}
	const configDir = require_workbuddy_paths.getWorkbuddyConfigDir();
	process.env.CODEBUDDY_CONFIG_DIR = configDir;
	process.env.WORKBUDDY_CONFIG_DIR = configDir;
	process.env.WORKBUDDY_DATA_FOLDER_NAME = require_workbuddy_paths._internalGetDefaultConfigDirname();
	require_workbuddy_product_config.ensureWorkbuddyBootstrapProductEnv();
	const product = require_workbuddy_product_config.tryGetWorkbuddyBaseProductConfiguration();
	const productName = product?.productName?.trim();
	if (productName) {
		const instanceNumber = require_workbuddy_paths._internalDetectInstanceNumber();
		electron.app.setName(instanceNumber ? `${productName} [${instanceNumber}]` : productName);
	} else electron.app.setName(require_workbuddy_paths.getWorkbuddyAppName());
	const applicationName = product?.applicationName;
	if (applicationName?.trim()) {
		const version = electron.app.getVersion();
		const brand = applicationName.trim();
		electron.app.userAgentFallback = electron.app.userAgentFallback.replace(`${electron.app.getName()}/${version}`, `${brand}/${version}`);
		electron.app.userAgentFallback = ensureApplicationUserAgentToken(electron.app.userAgentFallback, brand, version);
	}
	process.env.WORKBUDDY_APPLICATION_NAME = applicationName?.trim() || "workbuddy";
	electron.app.setPath("userData", require_workbuddy_paths.getWorkbuddyUserDataDir());
	electron.app.setPath("sessionData", require_workbuddy_paths.getWorkbuddySessionDataDir());
	electron.app.setAppLogsPath(require_workbuddy_paths.getWorkbuddyLogsDir());
}
var LEGACY_SCHEMES_TO_REMOVE, LSREGISTER_PATH;
var init_app_instance = require_chunk.__esmMin((() => {
	require_workbuddy_paths.init_workbuddy_paths();
	require_workbuddy_product_config.init_workbuddy_product_config();
	init_workbuddy_user_agent();
	LEGACY_SCHEMES_TO_REMOVE = ["codebuddy"];
	LSREGISTER_PATH = "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";
}));
//#endregion
Object.defineProperty(exports, "configureElectronApp", {
	enumerable: true,
	get: function() {
		return configureElectronApp;
	}
});
Object.defineProperty(exports, "init_app_instance", {
	enumerable: true,
	get: function() {
		return init_app_instance;
	}
});
Object.defineProperty(exports, "removeLegacyProtocolRegistrations", {
	enumerable: true,
	get: function() {
		return removeLegacyProtocolRegistrations;
	}
});
