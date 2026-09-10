const require_chunk = require("./chunk.js");
let node_path = require("node:path");
node_path = require_chunk.__toESM(node_path);
//#region src/main/system/runtime/workbuddy-packaged-runtime.ts
function isAppPathUnderPackagedResources(appPath) {
	const parentDir = node_path.basename(node_path.dirname(appPath));
	return parentDir === "Resources" || parentDir === "resources";
}
function resolveWorkbuddyPackagedRuntime(app) {
	if (process.env.WORKBUDDY_IS_PACKAGED === "1" || process.env.WORKBUDDY_IS_PACKAGED === "true") return true;
	if (app.isPackaged) return true;
	try {
		if (isAppPathUnderPackagedResources(app.getAppPath())) return true;
	} catch {
		return false;
	}
	return false;
}
function syncWorkbuddyPackagedRuntimeEnv(app) {
	const isPackagedRuntime = resolveWorkbuddyPackagedRuntime(app);
	process.env.WORKBUDDY_IS_PACKAGED = isPackagedRuntime ? "1" : "0";
	return isPackagedRuntime;
}
//#endregion
Object.defineProperty(exports, "resolveWorkbuddyPackagedRuntime", {
	enumerable: true,
	get: function() {
		return resolveWorkbuddyPackagedRuntime;
	}
});
Object.defineProperty(exports, "syncWorkbuddyPackagedRuntimeEnv", {
	enumerable: true,
	get: function() {
		return syncWorkbuddyPackagedRuntimeEnv;
	}
});
