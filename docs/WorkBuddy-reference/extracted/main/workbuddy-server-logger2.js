const require_chunk = require("./chunk.js");
const require_logger = require("./logger.js");
const require_src$1 = require("./src.js");
const require_workbuddy_paths = require("./workbuddy-paths.js");
const require_persistent_log_writer = require("./persistent-log-writer.js");
let node_path = require("node:path");
//#region src/main/system/logging/workbuddy-server-logger.ts
var import_src = /* @__PURE__ */ require_chunk.__toESM(require_src$1.require_src());
require_workbuddy_paths.init_workbuddy_paths();
var DAEMON_LOG_MAX_SIZE = 10 * 1024 * 1024;
var DAEMON_SAMPLER_WINDOW_MS = 1e3;
var DAEMON_SAMPLER_MAX_PER_WINDOW = 5;
function formatJsonLine({ message }) {
	return [JSON.stringify({
		timestamp: message.date.toISOString(),
		level: message.level,
		scope: message.scope,
		message: message.data
	})];
}
function fingerprintOf(message) {
	const scope = typeof message.scope === "string" ? message.scope : "";
	const head = message.data?.[0];
	const key = typeof head === "string" ? head : typeof head;
	return `${scope}\u0000${message.level}\u0000${key}`;
}
function attachDaemonFileSampler(logger) {
	const sampler = new require_persistent_log_writer.LogSampler({
		windowMs: DAEMON_SAMPLER_WINDOW_MS,
		maxPerWindow: DAEMON_SAMPLER_MAX_PER_WINDOW
	});
	logger.hooks.push((message, transport) => {
		if (transport !== logger.transports.file) return message;
		if (message.level === "error" || message.level === "warn") return message;
		const decision = sampler.admit(fingerprintOf(message));
		if (!decision.admit) return false;
		if (decision.suppressedSinceLast > 0) message.data = [...message.data, { suppressed: decision.suppressedSinceLast }];
		return message;
	});
}
var daemonLoggerConfigured = false;
var daemonFileWriter;
function configureDaemonFileTransport() {
	if (daemonLoggerConfigured) return;
	if (process.env.VITEST || process.env.VITEST_WORKER_ID) {
		import_src.default.transports.file.level = false;
		import_src.default.transports.console.level = false;
		if (import_src.default.transports.ipc) import_src.default.transports.ipc.level = false;
		daemonLoggerConfigured = true;
		return;
	}
	daemonLoggerConfigured = true;
	import_src.default.transports.file.format = formatJsonLine;
	import_src.default.transports.file.maxSize = DAEMON_LOG_MAX_SIZE;
	import_src.default.transports.file.fileName = "daemon.log";
	import_src.default.transports.file.resolvePathFn = (variables) => {
		return (0, node_path.join)(require_workbuddy_paths.getWorkbuddyLogsDir() || variables.libraryDefaultDir || variables.userData || process.cwd(), variables.fileName ?? "daemon.log");
	};
	import_src.default.transports.file.level = "info";
	if (process.env.WORKBUDDY_LOG_FILE_LEVEL) import_src.default.transports.file.level = process.env.WORKBUDDY_LOG_FILE_LEVEL;
	if (import_src.default.transports.ipc) import_src.default.transports.ipc.level = false;
	attachDaemonFileSampler(import_src.default);
	daemonFileWriter = require_persistent_log_writer.createPersistentLogWriter({
		filePath: (0, node_path.join)(require_workbuddy_paths.getWorkbuddyLogsDir(), "daemon.log"),
		maxSize: DAEMON_LOG_MAX_SIZE
	});
	require_persistent_log_writer.installPersistentFileTransport(import_src.default, daemonFileWriter);
	process.once("beforeExit", () => {
		daemonFileWriter?.close().catch(() => void 0);
	});
	try {
		import_src.default.errorHandler.startCatching({ showDialog: false });
	} catch {}
	try {
		const marker = {
			pid: process.pid,
			ppid: process.ppid,
			nodeVersion: process.version,
			electronVersion: process.versions.electron ?? null,
			startedAt: (/* @__PURE__ */ new Date()).toISOString()
		};
		import_src.default.scope("daemon-boot").info("[DaemonLog] session started", marker);
	} catch {}
}
function configureDesktopWorkbuddyServerLogger(options = {}) {
	if (options.disableConsoleTransport) import_src.default.transports.console.level = false;
	if (options.role === "daemon") configureDaemonFileTransport();
	require_logger.configureWorkbuddyLogger(createElectronWorkbuddyLogger(options.rootScope ?? "workbuddy-server"));
}
function createElectronWorkbuddyLogger(scopeName) {
	const scoped = import_src.default.scope(scopeName);
	return {
		debug: (message, ...args) => scoped.debug(message, ...args),
		info: (message, ...args) => scoped.info(message, ...args),
		warn: (message, ...args) => scoped.warn(message, ...args),
		error: (message, ...args) => scoped.error(message, ...args),
		log: (message, ...args) => scoped.info(message, ...args),
		scope: (childScope) => createElectronWorkbuddyLogger(`${scopeName}:${childScope}`)
	};
}
//#endregion
Object.defineProperty(exports, "configureDesktopWorkbuddyServerLogger", {
	enumerable: true,
	get: function() {
		return configureDesktopWorkbuddyServerLogger;
	}
});
