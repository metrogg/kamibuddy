//#region src/main/daemon/app-server/perf-profiler-handlers.ts
/** RPC channel 名（主/daemon 两侧硬编码字符串） */
var PERF_PROFILER_START_CHANNEL = "perf:profiler.start";
var PERF_PROFILER_STOP_CHANNEL = "perf:profiler.stop";
/** daemon 进程内单例 session（同一时间只允许一个采集） */
var _session = null;
/**
* 注册 daemon 端 perf profiler RPC handlers。
* 在 daemon `onRpcReady` 或 handler 注册时机（daemon-app-server-main）调用。
* handler 内部错误统一转成返回值上抛，保证 stdio RPC 通道稳定不断链。
*/
function registerPerfProfilerHandlers(server) {
	server.handle(PERF_PROFILER_START_CHANNEL, async () => {
		if (_session) return {
			ok: true,
			alreadyRunning: true
		};
		try {
			const session = new (await (import("node:inspector"))).Session();
			session.connect();
			await new Promise((resolve, reject) => {
				session.post("Profiler.enable", (err) => err ? reject(err) : resolve());
			});
			await new Promise((resolve, reject) => {
				session.post("Profiler.start", (err) => err ? reject(err) : resolve());
			});
			_session = session;
			return {
				ok: true,
				alreadyRunning: false
			};
		} catch (error) {
			return {
				ok: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	});
	server.handle(PERF_PROFILER_STOP_CHANNEL, async () => {
		const session = _session;
		if (!session) return {
			ok: false,
			error: "no active profiling session"
		};
		_session = null;
		try {
			const profile = await new Promise((resolve, reject) => {
				session.post("Profiler.stop", (err, result) => {
					if (err) reject(err);
					else resolve(result?.profile ?? null);
				});
			});
			session.post("Profiler.disable", () => {});
			try {
				session.disconnect();
			} catch {}
			return {
				ok: true,
				profile
			};
		} catch (error) {
			try {
				session.disconnect();
			} catch {}
			return {
				ok: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	});
}
//#endregion
Object.defineProperty(exports, "PERF_PROFILER_START_CHANNEL", {
	enumerable: true,
	get: function() {
		return PERF_PROFILER_START_CHANNEL;
	}
});
Object.defineProperty(exports, "PERF_PROFILER_STOP_CHANNEL", {
	enumerable: true,
	get: function() {
		return PERF_PROFILER_STOP_CHANNEL;
	}
});
Object.defineProperty(exports, "registerPerfProfilerHandlers", {
	enumerable: true,
	get: function() {
		return registerPerfProfilerHandlers;
	}
});
