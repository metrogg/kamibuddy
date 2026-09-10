const require_chunk = require("./chunk.js");
const require_workbuddy_product_config = require("./workbuddy-product-config.js");
const require_workbuddy_paths = require("./workbuddy-paths.js");
const require_app_instance = require("./app-instance.js");
let electron = require("electron");
let path = require("path");
path = require_chunk.__toESM(path);
let fs_promises = require("fs/promises");
fs_promises = require_chunk.__toESM(fs_promises);
//#region src/main/features/telemetry/startup-type.ts
/**
* Startup Type 判定（启动类型维度）
*
* 性能打点上报需要一个 `startup_type` 维度，用于区分本次启动属于哪种场景：
*
* | startup_type   | 判定依据                                            |
* | -------------- | --------------------------------------------------- |
* | `first_install`| 无历史启动记录（`last-launch.json` 不存在）         |
* | `upgrade`      | 记录中的 version/build 与当前进程不一致             |
* | `cold`         | 进程全新启动（默认；version/build 一致）            |
* | `warm`         | 进程复用（同一进程内二次激活：dock 点击 / second-instance）|
*
* 实现要点：
* - `first_install` / `upgrade` / `cold` 三者靠持久化的 `last-launch.json`
*   （存于 `~/.workbuddy/last-launch.json`）比对 version+build 得出，进程启动
*   早期调用一次 `resolveStartupType()` 即可。
* - `warm` 是运行期状态：进程已经活着、再次被激活（macOS dock、Windows
*   second-instance）时，由激活回调显式调用 `markWarmActivation()` 切到 warm。
* - 所有 IO 异常吞掉，判定失败时降级为 `cold`，绝不阻塞启动。
*/
var startup_type_exports = /* @__PURE__ */ require_chunk.__exportAll({
	__resetStartupTypeForTest: () => __resetStartupTypeForTest,
	getStartupType: () => getStartupType,
	markWarmActivation: () => markWarmActivation,
	resolveStartupType: () => resolveStartupType
});
function getLastLaunchPath() {
	return path.join(require_workbuddy_paths.getWorkbuddyConfigDir(), LAST_LAUNCH_FILE);
}
function safe(fn) {
	try {
		return fn();
	} catch {
		return;
	}
}
function getCurrentVersion() {
	return safe(() => electron.app.getVersion()) ?? "unknown";
}
function getCurrentBuild() {
	return safe(() => require_workbuddy_product_config.tryGetWorkbuddyProductCommit()) ?? "unknown";
}
async function readLastLaunch() {
	try {
		const raw = await fs_promises.readFile(getLastLaunchPath(), "utf-8");
		const parsed = JSON.parse(raw);
		if (typeof parsed.version === "string" && typeof parsed.build === "string") return {
			version: parsed.version,
			build: parsed.build,
			timestamp: parsed.timestamp ?? ""
		};
		return;
	} catch {
		return;
	}
}
async function writeLastLaunch(version, build) {
	try {
		const dir = require_workbuddy_paths.getWorkbuddyConfigDir();
		await fs_promises.mkdir(dir, { recursive: true });
		const record = {
			version,
			build,
			timestamp: (/* @__PURE__ */ new Date()).toISOString()
		};
		await fs_promises.writeFile(getLastLaunchPath(), JSON.stringify(record), "utf-8");
	} catch {}
}
/**
* 判定本次进程启动类型并持久化当前 version/build。
*
* 进程启动早期调用一次。结果会被缓存（进程级单例），后续重复调用直接返回缓存值
* （除非已被 `markWarmActivation()` 标记为 warm）。
*
* 副作用：把当前 version+build 写回 `last-launch.json`，供下次启动比对。
*/
async function resolveStartupType() {
	if (resolvedType) return resolvedType;
	const version = getCurrentVersion();
	const build = getCurrentBuild();
	const last = await readLastLaunch();
	let type;
	if (!last) type = "first_install";
	else if (last.version !== version || last.build !== build) type = "upgrade";
	else type = "cold";
	writeLastLaunch(version, build);
	resolvedType = type;
	return type;
}
/**
* 标记本次为热启动（进程复用：macOS dock 点击已有实例 / Windows second-instance）。
*
* 在 app 的 `activate` / `second-instance` 回调里调用。一旦标记为 warm，
* 后续 `getStartupType()` 固定返回 warm，直到进程退出。
*/
function markWarmActivation() {
	resolvedType = "warm";
}
/**
* 取当前已判定的启动类型（同步）。
*
* 若 `resolveStartupType()` 尚未被 await 过，返回 'cold' 作为安全默认值。
* 正常流程中 resolveStartupType 在首次 telemetry 使用前已完成。
*/
function getStartupType() {
	return resolvedType ?? "cold";
}
/** 仅供测试：重置进程级缓存。 */
function __resetStartupTypeForTest() {
	resolvedType = void 0;
}
var LAST_LAUNCH_FILE, resolvedType;
var init_startup_type = require_chunk.__esmMin((() => {
	require_app_instance.init_app_instance();
	require_workbuddy_product_config.init_workbuddy_product_config();
	LAST_LAUNCH_FILE = "last-launch.json";
}));
//#endregion
Object.defineProperty(exports, "getStartupType", {
	enumerable: true,
	get: function() {
		return getStartupType;
	}
});
Object.defineProperty(exports, "init_startup_type", {
	enumerable: true,
	get: function() {
		return init_startup_type;
	}
});
Object.defineProperty(exports, "markWarmActivation", {
	enumerable: true,
	get: function() {
		return markWarmActivation;
	}
});
Object.defineProperty(exports, "resolveStartupType", {
	enumerable: true,
	get: function() {
		return resolveStartupType;
	}
});
Object.defineProperty(exports, "startup_type_exports", {
	enumerable: true,
	get: function() {
		return startup_type_exports;
	}
});
