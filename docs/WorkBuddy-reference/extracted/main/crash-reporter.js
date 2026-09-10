const require_chunk = require("./chunk.js");
let node_fs = require("node:fs");
node_fs = require_chunk.__toESM(node_fs);
let node_path = require("node:path");
node_path = require_chunk.__toESM(node_path);
let node_fs_promises = require("node:fs/promises");
node_fs_promises = require_chunk.__toESM(node_fs_promises);
let node_os = require("node:os");
node_os = require_chunk.__toESM(node_os);
//#region ../../packages/monitor/src/node/crash-reporter/crash-writer.ts
/**
* Crash Writer — 同步落盘实现
*
* 设计要点：
* - **同步写盘**：crash handler 触发后进程随时可能被终结，异步 IO 有概率丢数据
* - **同次启动追加**：本次进程启动后所有 crash 写入同一文件 entries[]
* - **永不抛异常**：写盘失败仅 best-effort，不影响业务进程行为
* - **去重保护**：单次启动最多保留 maxEntriesPerLaunch 条，多余的计入 droppedCount
* - **多实例安全**：文件名带 pid 后缀，同一 logsDir 下多进程互不覆盖
*
* 落盘路径：{logsDir}/Crash-Log/crash-report-{processName}-{pid}.json
*/
var DEFAULT_MAX_ENTRIES = 50;
var CRASH_LOG_DIR_NAME = "Crash-Log";
var MAX_PROCESS_NAME_LENGTH = 32;
/**
* 生成本地时间 ISO 8601 字符串，带时区偏移。
* 示例：2026-05-11T00:01:56.924+08:00
*
* 选择本地时间而非 UTC 的原因：crash 日志主要面向研发 / SRE 快速定位问题，
* 本地时间可直接对照体感时间，省去脑内 UTC→本地 的换算步骤。
* 保留 ±HH:MM 偏移确保跨时区仍可还原绝对时刻。
*/
function localISOString(date = /* @__PURE__ */ new Date()) {
	const offset = -date.getTimezoneOffset();
	const sign = offset >= 0 ? "+" : "-";
	const absOffset = Math.abs(offset);
	const hh = String(Math.floor(absOffset / 60)).padStart(2, "0");
	const mm = String(absOffset % 60).padStart(2, "0");
	const pad = (n, len = 2) => String(n).padStart(len, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}${sign}${hh}:${mm}`;
}
/**
* 生成紧凑的文件名时间戳：YYYYMMDDTHHmmss
* 用于文件名中标识启动时刻，避免 PID 回绕导致的文件碰撞。
*/
function compactTimestamp(date = /* @__PURE__ */ new Date()) {
	const pad = (n) => String(n).padStart(2, "0");
	return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}
var installed = false;
var writerState = {
	reportPath: null,
	cachedFile: null,
	maxEntries: DEFAULT_MAX_ENTRIES,
	launchedAt: localISOString(),
	startupTag: compactTimestamp()
};
/**
* 安装 Crash Writer。
*
* 自动 hook `process.on('uncaughtException')` 和 `process.on('unhandledRejection')`。
* 对于 Electron 主进程的 `render-process-gone` / `child-process-gone` 事件，
* 调用方需要自行 hook 并调用返回的 `handle.write()` 写入。
*
* 模块级防重复：同一进程多次调用是 no-op，返回同一 handle。
*/
function installCrashWriter(options) {
	const { logsDir, processName, appVersion, extraMeta, maxEntriesPerLaunch } = options;
	writerState.maxEntries = maxEntriesPerLaunch ?? DEFAULT_MAX_ENTRIES;
	writerState.launchedAt = localISOString();
	writerState.startupTag = compactTimestamp();
	const handle = {
		write: (entry) => writeCrashEntry(logsDir, processName, appVersion, extraMeta, entry),
		getReportPath: () => writerState.reportPath
	};
	if (installed) return handle;
	installed = true;
	process.on("uncaughtException", (error) => {
		handle.write({
			type: "uncaught_exception",
			error
		});
	});
	process.on("unhandledRejection", (reason) => {
		handle.write({
			type: "unhandled_rejection",
			error: reason
		});
	});
	return handle;
}
/**
* 包装子进程，监控其异常退出并写入 child_process_crash entry。
*
* @param child - child_process.spawn() 返回的 ChildProcess 对象
* @param meta - 子进程标识信息
* @param writerHandle - installCrashWriter() 返回的 handle
*/
function wrapChildProcess(child, meta, writerHandle) {
	child.on("exit", (code, signal) => {
		if (code === 0 && !signal) return;
		writerHandle.write({
			type: "child_process_crash",
			childProcess: {
				processType: "spawned",
				reason: signal ? `signal:${signal}` : `exit:${code}`,
				exitCode: code ?? -1,
				name: meta.name,
				signal: signal ?? void 0
			}
		});
	});
	child.on("error", (err) => {
		writerHandle.write({
			type: "child_process_crash",
			childProcess: {
				processType: "spawned",
				reason: `spawn-error:${err.message}`,
				exitCode: -1,
				name: meta.name
			}
		});
	});
}
function writeCrashEntry(logsDir, processName, appVersion, extraMeta, input) {
	if (!logsDir) return null;
	try {
		const safeName = sanitizeProcessName(processName);
		const crashLogDir = node_path.join(logsDir, CRASH_LOG_DIR_NAME);
		const filename = `crash-report-${safeName}-${process.pid}-${writerState.startupTag}.json`;
		const reportPath = node_path.join(crashLogDir, filename);
		if (!writerState.reportPath) writerState.reportPath = reportPath;
		node_fs.mkdirSync(crashLogDir, { recursive: true });
		if (!writerState.cachedFile) writerState.cachedFile = readExistingFile(reportPath) ?? buildInitialFile(safeName, appVersion, extraMeta);
		const file = writerState.cachedFile;
		if (file.entries.length >= writerState.maxEntries) file.droppedCount += 1;
		else {
			const entry = buildEntry(input);
			file.entries.push(entry);
		}
		node_fs.writeFileSync(reportPath, JSON.stringify(file, null, 2), "utf8");
		return reportPath;
	} catch {
		return null;
	}
}
function buildInitialFile(processName, appVersion, extraMeta) {
	return {
		launchedAt: writerState.launchedAt,
		pid: process.pid,
		processName,
		versions: {
			node: process.versions.node,
			electron: process.versions.electron,
			chrome: process.versions.chrome,
			v8: process.versions.v8
		},
		platform: process.platform,
		arch: process.arch,
		appVersion,
		extraMeta,
		entries: [],
		droppedCount: 0
	};
}
function buildEntry(input) {
	const timestamp = localISOString();
	const { type, error, renderer, childProcess: childProc } = input;
	if (type === "renderer_crash" && renderer) return {
		timestamp,
		type,
		errorName: "RendererCrash",
		errorMessage: `Renderer process gone: reason=${renderer.reason}, exitCode=${renderer.exitCode}`,
		stack: null,
		renderer
	};
	if (type === "child_process_crash" && childProc) return {
		timestamp,
		type,
		errorName: "ChildProcessCrash",
		errorMessage: `Child process gone (${childProc.serviceName || childProc.name || childProc.processType}): reason=${childProc.reason}, exitCode=${childProc.exitCode}`,
		stack: null,
		childProcess: childProc
	};
	return {
		timestamp,
		type,
		...serializeReason(error)
	};
}
function serializeReason(reason) {
	if (reason instanceof Error) return {
		errorName: reason.name || "Error",
		errorMessage: reason.message ?? "",
		stack: reason.stack ?? null
	};
	let raw;
	try {
		raw = typeof reason === "string" ? reason : JSON.stringify(reason);
	} catch {
		raw = String(reason);
	}
	return {
		errorName: "NonError",
		errorMessage: typeof reason === "string" ? reason : raw,
		stack: null,
		raw
	};
}
function readExistingFile(reportPath) {
	try {
		if (!node_fs.existsSync(reportPath)) return null;
		const raw = node_fs.readFileSync(reportPath, "utf8");
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.entries)) return null;
		if (typeof parsed.droppedCount !== "number") parsed.droppedCount = 0;
		return parsed;
	} catch {
		return null;
	}
}
/**
* 清洗进程名为安全文件路径片段。
* 仅保留 A-Za-z0-9._-，其余替换为 _，截断到 32 字符。
*/
function sanitizeProcessName(rawName) {
	if (!rawName) return "unknown";
	return rawName.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "").slice(0, MAX_PROCESS_NAME_LENGTH) || "unknown";
}
//#endregion
//#region ../../packages/monitor/src/node/crash-reporter/crash-filter.ts
/** 内置消息排除模式（常见噪音） */
var DEFAULT_EXCLUDE_PATTERNS = [
	/EPIPE/,
	/ECONNRESET/,
	/ECONNREFUSED/,
	/ETIMEDOUT/,
	/ENETUNREACH/,
	/EHOSTUNREACH/,
	/ENOTFOUND/,
	/ERR_SOCKET_CONNECTION_TIMEOUT/,
	/^Canceled/,
	/OTLPExporterError/,
	/^Timeout$/,
	/^Not connected$/,
	/^\[?\{\}\]?$/,
	/ResizeObserver loop/,
	/Object has been destroyed/,
	/ERR_IPC_CHANNEL_CLOSED/,
	/GPU process .* terminated with exit code 0/
];
var DEFAULT_DEDUP_WINDOW_MS = 6e4;
var DEFAULT_MAX_PER_WINDOW = 100;
var CrashFilter = class {
	constructor(config) {
		this.deduplicateMap = /* @__PURE__ */ new Map();
		this.windowStart = Date.now();
		this.windowCount = 0;
		this.messagePatterns = config.messageExcludePatterns;
		this.typeExcludes = new Set(config.typeExcludes ?? []);
		this.deduplicateWindowMs = config.deduplicateWindowMs ?? DEFAULT_DEDUP_WINDOW_MS;
		this.maxReportsPerWindow = config.maxReportsPerWindow ?? DEFAULT_MAX_PER_WINDOW;
		this.customFilter = config.customFilter;
	}
	/**
	* 判断一条 crash entry 是否应该过滤（不上报）。
	* @returns true = 过滤（不上报）；false = 放行
	*/
	shouldFilter(entry) {
		if (this.typeExcludes.has(entry.type)) return true;
		const msg = entry.errorMessage;
		for (const pattern of this.messagePatterns) if (typeof pattern === "string") {
			if (msg.includes(pattern)) return true;
		} else if (pattern.test(msg)) return true;
		if (this.customFilter && this.customFilter(entry)) return true;
		const now = Date.now();
		if (now - this.windowStart > this.deduplicateWindowMs) {
			this.windowStart = now;
			this.windowCount = 0;
			this.cleanExpiredDedup(now);
		}
		this.windowCount++;
		if (this.windowCount > this.maxReportsPerWindow) return true;
		const fingerprint = this.buildFingerprint(entry);
		const existing = this.deduplicateMap.get(fingerprint);
		if (existing && now - existing.lastTime < this.deduplicateWindowMs) return true;
		this.deduplicateMap.set(fingerprint, {
			fingerprint,
			lastTime: now
		});
		return false;
	}
	buildFingerprint(entry) {
		const stackPart = (entry.stack ?? "").slice(0, 200);
		return `${entry.type}:${entry.errorName}:${entry.errorMessage.slice(0, 100)}:${stackPart}`;
	}
	cleanExpiredDedup(now) {
		for (const [key, value] of this.deduplicateMap) if (now - value.lastTime > this.deduplicateWindowMs * 2) this.deduplicateMap.delete(key);
	}
};
//#endregion
//#region ../../packages/monitor/src/node/crash-reporter/crash-sanitizer.ts
/**
* Crash Sanitizer — 脱敏处理
*
* 对 crash entry 中的堆栈路径和错误消息进行脱敏，
* 确保上报到伽利略平台的数据不含用户本地路径和敏感信息。
*/
var SENSITIVE_PATTERNS = [
	/(?:token|apikey|api_key|password|secret|authorization|bearer)\s*[=:]\s*\S+/i,
	/eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+/,
	/(?:ghp_|gho_|github_pat_|sk-|pk_live_|pk_test_)\w+/
];
/** 错误消息最大长度 */
var MAX_MESSAGE_LENGTH = 500;
var CrashSanitizer = class {
	constructor() {
		this.homeDir = node_os.homedir();
		this.homeDirEscaped = this.homeDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}
	/**
	* 对一条 CrashEntry 执行完整脱敏，返回新对象（不修改原对象）
	*/
	sanitizeEntry(entry) {
		return {
			...entry,
			errorMessage: this.sanitizeMessage(entry.errorMessage),
			stack: entry.stack ? this.sanitizeStack(entry.stack) : null,
			raw: entry.raw ? this.sanitizeMessage(entry.raw) : void 0
		};
	}
	/**
	* 堆栈路径脱敏：
	* - macOS/Linux: /Users/xxx/ → ~/
	* - Windows: C:\Users\xxx\ → ~\
	*/
	sanitizeStack(stack) {
		if (!stack) return stack;
		const pattern = new RegExp(this.homeDirEscaped, "g");
		return stack.replace(pattern, "~");
	}
	/**
	* 错误消息脱敏：
	* - 替换 token/password/secret 等敏感值为 [REDACTED]
	* - 替换 home 目录路径
	* - 截断至 MAX_MESSAGE_LENGTH
	*/
	sanitizeMessage(message) {
		if (!message) return message;
		let result = message;
		for (const pattern of SENSITIVE_PATTERNS) result = result.replace(new RegExp(pattern.source, pattern.flags + "g"), "[REDACTED]");
		const homePattern = new RegExp(this.homeDirEscaped, "g");
		result = result.replace(homePattern, "~");
		if (result.length > MAX_MESSAGE_LENGTH) result = result.slice(0, MAX_MESSAGE_LENGTH) + "...[truncated]";
		return result;
	}
};
//#endregion
//#region ../../packages/monitor/src/node/crash-reporter/crash-log-exporter.ts
/**
* Crash Log Exporter — 定时扫描 Crash-Log/ 目录并上报伽利略
*
* 工作流程：
* 1. 定时扫描 Crash-Log/ 目录下的 JSON 文件
* 2. 过滤已处理文件（.processed-crashes.json）
* 3. 对每条 entry 执行：Filter → Sanitize → Enrich Context → 构建 LogRecord
* 4. 批量上报：通过 CrashExportTransport 发送
* 5. 更新已处理记录
*
* 设计要点：
* - 与 CrashWriter 完全解耦，通过文件系统松耦合
* - 异步执行，不影响主进程性能
* - 失败不抛异常，仅记录日志
*/
var DEFAULT_SCAN_INTERVAL_MS = 3e4;
var DEFAULT_RETENTION_DAYS = 3;
/** 默认最多保留的 crash report 文件数，超出按 mtime 从旧到新删除。 */
var DEFAULT_MAX_RETAINED_FILES = 10;
var PROCESSED_FILE = ".processed-crashes.json";
var CrashLogExporter = class CrashLogExporter {
	static {
		this.MAX_PREVIOUS_SESSION = 1;
	}
	static {
		this.MAX_CURRENT_SESSION = 5;
	}
	constructor(config) {
		this.timer = null;
		this.isScanning = false;
		this.processedState = {
			files: {},
			signatures: {}
		};
		this.reportedPreviousSession = 0;
		this.reportedCurrentSession = 0;
		this.crashLogDir = config.crashLogDir;
		this.contextProvider = config.contextProvider;
		this.transport = config.transport;
		this.scanIntervalMs = config.scanIntervalMs ?? DEFAULT_SCAN_INTERVAL_MS;
		this.retentionDays = config.retentionDays ?? DEFAULT_RETENTION_DAYS;
		this.maxRetainedFiles = config.maxRetainedFiles ?? DEFAULT_MAX_RETAINED_FILES;
		this.appLaunchedAtMs = config.appLaunchedAtMs ?? Date.now();
		this.enableUpload = config.enableUpload ?? true;
		this.filter = config.filter ? new CrashFilter(config.filter) : null;
		this.sanitizer = new CrashSanitizer();
	}
	/** 启动定时扫描（立即执行一次 + 定时） */
	start() {
		this.loadProcessedState();
		if (this.enableUpload) this.reportStartupEvent().catch(() => {});
		this.scanAndExport().catch(() => {});
		this.timer = setInterval(() => {
			this.scanAndExport().catch(() => {});
		}, this.scanIntervalMs);
		if (this.timer.unref) this.timer.unref();
	}
	/** 停止定时扫描 */
	stop() {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}
	/** 手动触发一次扫描上报（如进程退出前） */
	async flush() {
		await this.scanAndExport();
	}
	/**
	* 上报一条 `codebuddy.app_startup` 日志，用于计算 Crash 率的 DAU 分母。
	* 与 crash 数据同 target、同通道（/v1/logs），确保分子分母数据源一致。
	*/
	async reportStartupEvent() {
		try {
			const context = this.contextProvider.getContext();
			const record = {
				timestamp: Date.now(),
				level: "info",
				message: "app.startup",
				attributes: {
					"event": "codebuddy.app_startup",
					"host.ide_name": context.host.ideName,
					"host.ide_type": context.host.ideType,
					"host.machine_id": context.host.machineId,
					"host.session_id": context.host.sessionId,
					"host.ide_version": context.host.ideVersion,
					"host.download_channel": context.host.downloadChannel,
					"os.name": context.os.os,
					"os.arch": context.os.arch,
					"user.id": context.user.userId
				}
			};
			await this.transport.exportLogs([record]);
		} catch {}
	}
	async scanAndExport() {
		if (this.isScanning) return;
		this.isScanning = true;
		try {
			try {
				await node_fs_promises.access(this.crashLogDir);
			} catch {
				return;
			}
			const files = (await node_fs_promises.readdir(this.crashLogDir)).filter((f) => f.startsWith("crash-report-") && f.endsWith(".json"));
			if (files.length === 0) return;
			await this.cleanupExpiredFiles(files);
			await this.enforceMaxRetainedFiles();
			if (!this.enableUpload) return;
			if (this.isReportQuotaExhausted()) return;
			const remainingFiles = [];
			for (const f of files) try {
				await node_fs_promises.access(node_path.join(this.crashLogDir, f));
				remainingFiles.push(f);
			} catch {}
			const logRecords = [];
			const context = this.contextProvider.getContext();
			for (const filename of remainingFiles) {
				const newRecords = await this.processFile(filename, context);
				logRecords.push(...newRecords);
			}
			const dedupedRecords = this.deduplicateRecords(logRecords);
			const quotaRecords = this.applyReportQuota(dedupedRecords);
			if (quotaRecords.length > 0) await this.transport.exportLogs(quotaRecords);
			await this.saveProcessedState();
		} catch {} finally {
			this.isScanning = false;
		}
	}
	/**
	* 两个上报配额都已打满：previous_session 和 current_session 均无剩余。
	* 此时继续读文件既不会有新上报，也没有其他副作用，属于纯浪费。
	*/
	isReportQuotaExhausted() {
		return this.reportedPreviousSession >= CrashLogExporter.MAX_PREVIOUS_SESSION && this.reportedCurrentSession >= CrashLogExporter.MAX_CURRENT_SESSION;
	}
	async processFile(filename, context) {
		const records = [];
		try {
			const filePath = node_path.join(this.crashLogDir, filename);
			const stat = await node_fs_promises.stat(filePath);
			const processedCount = this.processedState.files[filename] ?? 0;
			const signatures = this.processedState.signatures ?? (this.processedState.signatures = {});
			const lastSig = signatures[filename];
			if (lastSig && lastSig.mtimeMs === stat.mtimeMs && lastSig.size === stat.size && lastSig.entriesLen === processedCount) return records;
			const raw = await node_fs_promises.readFile(filePath, "utf8");
			const report = JSON.parse(raw);
			if (!report || !Array.isArray(report.entries)) return records;
			const newEntries = report.entries.slice(processedCount);
			this.processedState.files[filename] = report.entries.length;
			signatures[filename] = {
				mtimeMs: stat.mtimeMs,
				size: stat.size,
				entriesLen: report.entries.length
			};
			if (newEntries.length === 0) return records;
			for (const entry of newEntries) {
				if (this.filter && this.filter.shouldFilter(entry)) continue;
				const sanitized = this.sanitizer.sanitizeEntry(entry);
				const record = this.buildLogRecord(sanitized, report, context);
				records.push(record);
			}
		} catch {}
		return records;
	}
	buildLogRecord(entry, file, context) {
		const attributes = {
			"event": "codebuddy.crash",
			"crash_type": entry.type,
			"process_name": file.processName,
			"host.ide_name": context.host.ideName,
			"host.ide_type": context.host.ideType,
			"host.machine_id": context.host.machineId,
			"host.session_id": context.host.sessionId,
			"host.ide_version": context.host.ideVersion,
			"host.download_channel": context.host.downloadChannel,
			"os.name": context.os.os,
			"os.arch": context.os.arch,
			"os.version": context.os.osVersion,
			"os.cpu_model": context.os.cpuModel,
			"os.cpu_cores": context.os.cpuCores,
			"os.memory_gb": context.os.memorySize,
			"user.id": context.user.userId,
			"user.name": context.user.username,
			"user.nickname": context.user.userNickname,
			"product.type": context.product.product,
			"product.commit": context.product.commit,
			"error.name": entry.errorName,
			"error.message": entry.errorMessage
		};
		if (entry.stack) attributes["error.stack"] = entry.stack;
		if (context.user.enterpriseId) attributes["user.enterprise_id"] = context.user.enterpriseId;
		if (context.user.tenantId) attributes["user.tenant_id"] = context.user.tenantId;
		if (context.product.releaseDate) attributes["product.release_date"] = String(context.product.releaseDate);
		if (entry.renderer) {
			attributes["renderer.reason"] = entry.renderer.reason;
			attributes["renderer.exit_code"] = entry.renderer.exitCode;
			if (entry.renderer.url) attributes["renderer.url"] = entry.renderer.url;
		}
		if (entry.childProcess) {
			attributes["child_process.type"] = entry.childProcess.processType;
			attributes["child_process.reason"] = entry.childProcess.reason;
			attributes["child_process.exit_code"] = entry.childProcess.exitCode;
			if (entry.childProcess.serviceName) attributes["child_process.service"] = entry.childProcess.serviceName;
			if (entry.childProcess.name) attributes["child_process.name"] = entry.childProcess.name;
		}
		if (file.extraMeta) for (const [key, value] of Object.entries(file.extraMeta)) attributes[`meta.${key}`] = String(value);
		attributes["report_origin"] = new Date(file.launchedAt).getTime() >= this.appLaunchedAtMs ? "current_session" : "previous_session";
		return {
			timestamp: new Date(entry.timestamp).getTime(),
			level: "error",
			message: `crash.${entry.type}`,
			attributes
		};
	}
	/**
	* 对同一批 LogRecord 做去重：相同 (timestamp, crash_type, message) 只保留首条。
	* 防止 CrashWriter 短时间内写入多条完全相同的 entry（如 EPIPE 连续触发、
	* renderer_js_error 高频重复等）导致伽利略侧出现大量重复日志。
	*/
	deduplicateRecords(records) {
		const seen = /* @__PURE__ */ new Set();
		return records.filter((r) => {
			const fp = `${r.timestamp}|${r.attributes["crash_type"] ?? ""}|${String(r.attributes["error.message"] ?? "").slice(0, 120)}`;
			if (seen.has(fp)) return false;
			seen.add(fp);
			return true;
		});
	}
	/**
	* 按 report_origin 限制上报数量（整个进程生命周期内累计）：
	* - previous_session（上次启动遗留）：最多 1 条
	* - current_session（当次启动产生）：最多 5 条
	*
	* 保留最后 N 条（取 slice 尾部），确保上报的是最新的 crash。
	*/
	applyReportQuota(records) {
		const result = [];
		const previous = records.filter((r) => r.attributes["report_origin"] === "previous_session");
		const current = records.filter((r) => r.attributes["report_origin"] === "current_session");
		const prevRemaining = CrashLogExporter.MAX_PREVIOUS_SESSION - this.reportedPreviousSession;
		if (prevRemaining > 0 && previous.length > 0) {
			const take = previous.slice(-prevRemaining);
			result.push(...take);
			this.reportedPreviousSession += take.length;
		}
		const currRemaining = CrashLogExporter.MAX_CURRENT_SESSION - this.reportedCurrentSession;
		if (currRemaining > 0 && current.length > 0) {
			const take = current.slice(-currRemaining);
			result.push(...take);
			this.reportedCurrentSession += take.length;
		}
		return result;
	}
	/**
	* 删除超过 retentionDays 的 crash report 文件，并清理 processedState 中对应的记录。
	* 判断依据：文件的 mtime（最后修改时间）。
	*/
	async cleanupExpiredFiles(files) {
		const cutoffMs = Date.now() - this.retentionDays * 24 * 60 * 60 * 1e3;
		for (const filename of files) try {
			const filePath = node_path.join(this.crashLogDir, filename);
			if ((await node_fs_promises.stat(filePath)).mtimeMs < cutoffMs) {
				await node_fs_promises.unlink(filePath);
				delete this.processedState.files[filename];
				if (this.processedState.signatures) delete this.processedState.signatures[filename];
			}
		} catch {}
	}
	/**
	* 保留最多 maxRetainedFiles 份 crash report，超出按 mtime 从旧到新删除。
	*
	* 背景：过期清理只兜住">30 天"，如果保留期内堆积到成百上千份文件，
	* 每 30s 全量扫描时磁盘 IO 尖峰会随文件数线性恶化（尽管有签名短路，
	* 每份文件仍要 stat + readdir 遍历）。这里在数量维度做兜底收敛。
	*/
	async enforceMaxRetainedFiles() {
		if (this.maxRetainedFiles <= 0) return;
		try {
			const files = (await node_fs_promises.readdir(this.crashLogDir)).filter((f) => f.startsWith("crash-report-") && f.endsWith(".json"));
			if (files.length <= this.maxRetainedFiles) return;
			const withStat = [];
			for (const f of files) try {
				const stat = await node_fs_promises.stat(node_path.join(this.crashLogDir, f));
				withStat.push({
					name: f,
					mtimeMs: stat.mtimeMs
				});
			} catch {}
			withStat.sort((a, b) => a.mtimeMs - b.mtimeMs);
			const excess = withStat.length - this.maxRetainedFiles;
			if (excess <= 0) return;
			const toDelete = withStat.slice(0, excess);
			for (const { name } of toDelete) try {
				await node_fs_promises.unlink(node_path.join(this.crashLogDir, name));
				delete this.processedState.files[name];
				if (this.processedState.signatures) delete this.processedState.signatures[name];
			} catch {}
		} catch {}
	}
	loadProcessedState() {
		try {
			const stateFile = node_path.join(this.crashLogDir, PROCESSED_FILE);
			if (node_fs.existsSync(stateFile)) {
				const raw = node_fs.readFileSync(stateFile, "utf8");
				const parsed = JSON.parse(raw);
				if (parsed && parsed.files) this.processedState = {
					files: parsed.files,
					signatures: parsed.signatures && typeof parsed.signatures === "object" ? parsed.signatures : {}
				};
				else this.processedState = {
					files: {},
					signatures: {}
				};
			}
		} catch {
			this.processedState = {
				files: {},
				signatures: {}
			};
		}
	}
	async saveProcessedState() {
		try {
			const stateFile = node_path.join(this.crashLogDir, PROCESSED_FILE);
			await node_fs_promises.mkdir(this.crashLogDir, { recursive: true });
			const existingFiles = new Set((await node_fs_promises.readdir(this.crashLogDir).catch(() => [])).filter((f) => f.startsWith("crash-report-") && f.endsWith(".json")));
			for (const key of Object.keys(this.processedState.files)) if (!existingFiles.has(key)) delete this.processedState.files[key];
			if (this.processedState.signatures) {
				for (const key of Object.keys(this.processedState.signatures)) if (!existingFiles.has(key)) delete this.processedState.signatures[key];
			}
			await node_fs_promises.writeFile(stateFile, JSON.stringify(this.processedState, null, 2), "utf8");
		} catch {}
	}
};
//#endregion
//#region ../../packages/monitor/src/node/crash-reporter/index.ts
var crash_reporter_exports = /* @__PURE__ */ require_chunk.__exportAll({
	CrashLogExporter: () => CrashLogExporter,
	DEFAULT_EXCLUDE_PATTERNS: () => DEFAULT_EXCLUDE_PATTERNS
});
//#endregion
Object.defineProperty(exports, "crash_reporter_exports", {
	enumerable: true,
	get: function() {
		return crash_reporter_exports;
	}
});
Object.defineProperty(exports, "installCrashWriter", {
	enumerable: true,
	get: function() {
		return installCrashWriter;
	}
});
Object.defineProperty(exports, "wrapChildProcess", {
	enumerable: true,
	get: function() {
		return wrapChildProcess;
	}
});
