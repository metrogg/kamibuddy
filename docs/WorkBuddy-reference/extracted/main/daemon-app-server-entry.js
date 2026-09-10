const require_chunk = require("./chunk.js");
require("./fs-protection.js");
const require_crash_reporter = require("./crash-reporter.js");
const require_src$1 = require("./src.js");
const require_process_role = require("./process-role.js");
const require_startup_context = require("./startup-context.js");
const require_cli_prewarm_pool = require("./cli-prewarm-pool.js");
const require_process_cpu_sampler = require("./process-cpu-sampler.js");
const require_transport_error = require("./transport-error.js");
let node_fs = require("node:fs");
node_fs = require_chunk.__toESM(node_fs);
let node_path = require("node:path");
node_path = require_chunk.__toESM(node_path);
let node_console = require("node:console");
//#region src/main/daemon/daemon-app-server-entry.ts
var import_src = /* @__PURE__ */ require_chunk.__toESM(require_src$1.require_src());
if (!process.env.UV_THREADPOOL_SIZE) process.env.UV_THREADPOOL_SIZE = "16";
require_process_role.assertDaemonProcessRole();
installDaemonCrashWriter();
installDaemonMemoryDiagnostics();
installDaemonStdioConsoleGuard();
installDaemonCrashGuards();
require_startup_context.initStartupContextFromEnv("daemon");
installOrphanGuard();
Promise.resolve().then(() => require("./workbuddy-server-logger.js")).then(({ configureDesktopWorkbuddyServerLogger }) => {
	configureDesktopWorkbuddyServerLogger({
		disableConsoleTransport: true,
		rootScope: "daemon-server",
		role: "daemon"
	});
}).then(() => Promise.resolve().then(() => require("./daemon-app-server-main.js"))).then(({ runDaemonAppServerEntry }) => runDaemonAppServerEntry()).catch((error) => {
	console.error("[DaemonAppServer] Fatal error:", error);
	process.exit(1);
});
/**
* daemon 子进程未捕获异常兜底。
*
* 背景：daemon 是独立子进程，运行期未捕获异常若无处理器会静默崩溃，main 侧
* 只能通过 stdio EOF 猜测、无诊断信息。这里把诊断写到 stderr（main 的
* DaemonAppServerProcessManager 会保留 stderr 尾部用于失败归因），并让进程以
* 非 0 码退出，触发 main 侧的崩溃恢复（respawn / give-up）。
*
* 策略取舍：
* - uncaughtException 视为致命，退出让 main 重启（有 DaemonRecoveryPolicy 的
*   退避 + give-up 防死循环）。
* - unhandledRejection 仅告警不退出，避免良性 rejection 触发过度重启。
* - **传输层错误（EPIPE / ERR_IPC_CHANNEL_CLOSED / ECONNRESET）例外**：它们表示
*   "对端管道已关闭"这一外部事实，而非 daemon 自身状态损坏。把它们当致命错误会
*   让"一次事件广播写失败"升级成"整个 daemon 死亡 + 全部会话中断"。
*   现场（5.4.1 win32）：ConnectorService 推送 Custom MCP 状态 → WBBus.emit →
*   process.send() 抛 write EPIPE → daemon 退出 → main 侧 RPC 全部堆积超时。
*   这类错误只记日志不退出，让上层自行重连/重试。
*/
function installDaemonCrashGuards() {
	process.on("uncaughtException", (error) => {
		if (require_transport_error.isRecoverableTransportError(error)) {
			console.error("[DaemonAppServer] recoverable transport error (ignored):", error);
			return;
		}
		console.error("[DaemonAppServer] uncaughtException:", error);
		process.exit(1);
	});
	process.on("unhandledRejection", (reason) => {
		console.error("[DaemonAppServer] unhandledRejection:", reason);
	});
}
function installDaemonCrashWriter() {
	try {
		const configDir = process.env.WORKBUDDY_CONFIG_DIR;
		if (!configDir) return;
		const handle = require_crash_reporter.installCrashWriter({
			logsDir: node_path.join(configDir, "logs"),
			processName: "daemon",
			appVersion: process.env.WORKBUDDY_APP_VERSION ?? ""
		});
		require_cli_prewarm_pool.bindCliChildCrashWatcher((child) => {
			require_crash_reporter.wrapChildProcess(child, { name: "cli" }, handle);
			watchSpawnedStderrTail(child, "cli", handle);
		});
		require_cli_prewarm_pool.bindSidecarCrashWatcher((child) => {
			require_crash_reporter.wrapChildProcess(child, { name: "sidecar" }, handle);
			watchSpawnedStderrTail(child, "sidecar", handle);
		});
	} catch {}
}
/**
* cli/sidecar 孙进程 crash entry 补 stderr 尾部（OOM 排查 patch）。
* 背景：daemon spawn 的 cli（prewarm pool）与 sidecar 崩溃时，crash entry 只有
* signal 类型，OOM/断言文本丢失（同 daemon 主进程问题）。两类 spawn 的 stderr
* 均为 pipe，这里并行消费（data 事件多播，不影响 prewarm pool 自身的 tail 收集），
* 意外退出时把尾部写进 crash entry 的 reason，随 CrashLogExporter 上报。
* 根因修复或常驻观测就绪后可移除。
*/
function watchSpawnedStderrTail(child, name, handle) {
	try {
		const stderr = child.stderr;
		if (!stderr) return;
		const tail = [];
		stderr.on("data", (data) => {
			for (const raw of data.toString().split(/\r?\n/)) {
				if (!raw) continue;
				tail.push(raw.length > 1024 ? `${raw.slice(0, 1024)}…` : raw);
				if (tail.length > 20) tail.shift();
			}
		});
		stderr.on("error", () => {});
		child.on("exit", (...args) => {
			const code = args[0];
			const signal = args[1];
			if (code === 0 && !signal) return;
			setTimeout(() => {
				try {
					const text = tail.join("\n").slice(-1536).trim();
					if (!text) return;
					handle.write({
						type: "child_process_crash",
						childProcess: {
							processType: "spawned",
							name: `${name}-stderr-tail`,
							reason: `stderr-tail:\n${text}`,
							exitCode: code ?? -1,
							signal: signal ?? void 0
						}
					});
				} catch {}
			}, 250).unref?.();
		});
	} catch {}
}
/**
* daemon 内存诊断（OOM 排查 patch，5.3.13 daemon SIGABRT/V8 OOM 用）。
* - fatal error（含 V8 OOM）时 Node 自动写 diagnostic report 到 logs/Diagnostics/
* - 每 1 分钟打一条内存水位到 daemon.log + stderr：文件供平时排查看曲线，
*   stderr 进主进程 stderrTail 滚动缓冲，崩溃时随 daemon-stderr-tail crash entry 上报
* - heapUsed ≥ 1.5G 时额外写一次 diagnostic report（单次，防抖）
* 根因修复或常驻观测就绪后可移除。
*/
function installDaemonMemoryDiagnostics() {
	try {
		const configDir = process.env.WORKBUDDY_CONFIG_DIR;
		if (!configDir || !process.report) return;
		const diagDir = node_path.join(configDir, "logs", "Diagnostics");
		node_fs.mkdirSync(diagDir, { recursive: true });
		require_transport_error.pruneDiagnosticArtifacts(diagDir, require_transport_error.DEFAULT_DIAGNOSTIC_RETENTION_POLICY).catch(() => {});
		process.report.directory = diagDir;
		process.report.reportOnFatalError = true;
		const highHeapBytes = 15e8;
		const highHeapReportMinIntervalMs = 1800 * 1e3;
		let highWatermarkReported = false;
		let lastHighHeapReportAt = 0;
		const toMb = (bytes) => Math.round(bytes / 1048576);
		const sampleCpuPercent = require_process_cpu_sampler.createProcessCpuPercentSampler();
		const reportMemory = () => {
			const mu = process.memoryUsage();
			const line = [
				`[DaemonMemWatch] pid=${process.pid}`,
				`heapUsed=${toMb(mu.heapUsed)}MB`,
				`heapTotal=${toMb(mu.heapTotal)}MB`,
				`rss=${toMb(mu.rss)}MB`,
				`external=${toMb(mu.external)}MB`,
				`cpuPercent=${sampleCpuPercent().toFixed(1)}`
			].join(" ");
			import_src.default.info(line);
			console.error(line);
			if (mu.heapUsed >= highHeapBytes) {
				if (!highWatermarkReported && Date.now() - lastHighHeapReportAt >= highHeapReportMinIntervalMs) {
					highWatermarkReported = true;
					lastHighHeapReportAt = Date.now();
					import_src.default.warn(`[DaemonMemWatch] high heap ${toMb(mu.heapUsed)}MB, writing diagnostic report`);
					process.report.writeReport("daemon-high-heap");
					require_transport_error.pruneDiagnosticArtifacts(diagDir, require_transport_error.DEFAULT_DIAGNOSTIC_RETENTION_POLICY).catch(() => {});
				}
			} else highWatermarkReported = false;
		};
		setTimeout(reportMemory, 3e4).unref?.();
		setInterval(reportMemory, 6e4).unref?.();
	} catch {}
}
function installDaemonStdioConsoleGuard() {
	process.stderr.on("error", () => void 0);
	process.stdout.on("error", () => void 0);
	const stderrConsole = new node_console.Console({
		stdout: process.stderr,
		stderr: process.stderr
	});
	console.log = stderrConsole.log.bind(stderrConsole);
	console.info = stderrConsole.info.bind(stderrConsole);
	console.debug = stderrConsole.debug.bind(stderrConsole);
	console.warn = stderrConsole.warn.bind(stderrConsole);
	console.error = stderrConsole.error.bind(stderrConsole);
	console.dir = stderrConsole.dir.bind(stderrConsole);
	console.table = stderrConsole.table.bind(stderrConsole);
	console.trace = stderrConsole.trace.bind(stderrConsole);
}
/**
* 兜底防孤儿：stdin 断开时立即退出。
*
* 场景：Electron main 被强杀 / 崩溃 / 父终端 Ctrl+C 导致 dev 进程终止时，
* 常规 SIGTERM 不会传给 daemon，daemon 会变成 PPID=1 的孤儿进程继续跑。
* stdin 是 daemon 与父进程唯一的通信通道，其关闭事件是父进程消失的可靠信号。
*
* 触发时机：
*  - 'end'   父进程正常关闭 stdio pipe（少见）
*  - 'close' pipe 底层描述符被关闭（父进程死亡最常见的信号）
*
* 为什么不走 shutdown() 优雅关闭：
* 到达此分支说明父进程已不可达，daemon 里跑的 RPC handler 不再有意义，
* 强制 exit 是最快清理孤儿资源的方式；正常路径由 SIGTERM handler 处理。
*/
function installOrphanGuard() {
	const onParentGone = (reason) => {
		if (globalThis.__daemonExiting) return;
		globalThis.__daemonExiting = true;
		console.error(`[DaemonAppServer] parent gone (${reason}), exiting`);
		setTimeout(() => process.exit(0), 100).unref();
	};
	process.stdin.on("end", () => onParentGone("stdin end"));
	process.stdin.on("close", () => onParentGone("stdin close"));
	process.stdout.on("error", (err) => {
		if (err.code === "EPIPE") onParentGone("stdout EPIPE");
	});
}
//#endregion
