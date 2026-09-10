//#region ../../packages/workbuddy-server/src/net/proxy-env.ts
/**
* Loopback hosts that must always bypass Node-side proxy handling.
*/
var LOCAL_NO_PROXY_HOSTS = [
	"localhost",
	"127.0.0.1",
	"::1"
];
/**
* Merge user-provided NO_PROXY with the app-server loopback defaults.
*/
function mergeNoProxy(existing) {
	const values = (existing || "").split(",").map((item) => item.trim()).filter(Boolean);
	const lowerValues = new Set(values.map((item) => item.toLowerCase()));
	for (const host of LOCAL_NO_PROXY_HOSTS) if (!lowerValues.has(host.toLowerCase())) {
		values.push(host);
		lowerValues.add(host.toLowerCase());
	}
	return values.join(",");
}
//#endregion
Object.defineProperty(exports, "mergeNoProxy", {
	enumerable: true,
	get: function() {
		return mergeNoProxy;
	}
});
