const require_chunk = require("./chunk.js");
const require_archive_artifact_sweep = require("./archive-artifact-sweep.js");
const require_adm_zip$1 = require("./adm-zip.js");
let node_fs = require("node:fs");
node_fs = require_chunk.__toESM(node_fs);
let node_path = require("node:path");
node_path = require_chunk.__toESM(node_path);
let node_os = require("node:os");
node_os = require_chunk.__toESM(node_os);
let node_crypto = require("node:crypto");
node_crypto = require_chunk.__toESM(node_crypto);
let node_worker_threads = require("node:worker_threads");
//#region src/main/features/logs/archive-budget.ts
var import_adm_zip = /* @__PURE__ */ require_chunk.__toESM(require_adm_zip$1.require_adm_zip());
var DEFAULT_NATIVE_CRASH_BUDGET_BYTES = 10 * 1024 * 1024;
/** Split one total budget so post-plan native staging cannot silently double it. */
function resolveArchiveBudgetSlices(totalBytes, nativeCrashEnabled) {
	if (!nativeCrashEnabled) return {
		ordinaryBytes: totalBytes,
		nativeCrashBytes: 0
	};
	const nativeCrashBytes = Math.min(Math.floor(totalBytes / 2), DEFAULT_NATIVE_CRASH_BUDGET_BYTES);
	return {
		ordinaryBytes: Math.max(0, totalBytes - nativeCrashBytes),
		nativeCrashBytes
	};
}
//#endregion
//#region src/main/features/logs/expired-dir-marker.ts
/**
* 过期日志目录的标记后缀（#87127）。
*
* 单独成文件是为了让 `cleanup-old-logs`（打标者）和 `log-archive-plan`
* （必须跳过被打标目录）共享同一个定义，而不必互相导入。
*
* 为什么要打标而不是直接删：libuv 线程池是进程级共享的（默认 4 线程），
* `fs.rm` 删 20 万文件要 60 秒，期间同进程内任何 `fs.promises` 调用都会被
* 饿死 —— 实测归档选材从 11ms 恶化到 2128ms（193x）。而 `rename` 只改一个
* 目录项，10ms 完成且与文件数无关。先改名让用户可见路径立刻脱离慢操作，
* 物理删除限量慢慢做。
*/
/** 已标记过期、等待物理删除的目录名包含此片段。 */
var EXPIRED_DIR_SUFFIX = ".expired";
//#endregion
//#region src/main/features/logs/log-dir-filter.ts
/**
* Pure helpers for filtering log directories by date prefix.
*
* Used by package-log-worker.ts to decide which subdirectories to include
* when staging logs for archival. Kept as a standalone module so unit tests
* can exercise the rules without spinning up a worker thread.
*/
/** electron-log style: 2026-04-21 */
var DATE_DIR_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Electron app.getPath('logs') default style: 20260421T103456 */
var TS_DIR_RE = /^(\d{8})T\d{6}$/;
/**
* Extract the ISO-like date component (YYYY-MM-DD) from a directory name,
* or return null if the name is not date-shaped.
*/
function extractDatePart(name) {
	if (DATE_DIR_RE.test(name)) return name;
	const match = TS_DIR_RE.exec(name);
	if (match) {
		const raw = match[1];
		return raw.slice(0, 4) + "-" + raw.slice(4, 6) + "-" + raw.slice(6, 8);
	}
	return null;
}
/** Format a Date as YYYY-MM-DD in the caller's local timezone. */
function formatLocalDate(d) {
	return [
		d.getFullYear(),
		String(d.getMonth() + 1).padStart(2, "0"),
		String(d.getDate()).padStart(2, "0")
	].join("-");
}
/**
* Decide whether a date-shaped directory should be included in the archive.
*
* - Non-date-shaped names return false (callers should handle plain files
*   and non-date directories with separate logic).
* - When todayOnly is true, only directories matching todayStr are kept.
* - Otherwise, directories newer than or equal to cutoff are kept.
*/
function shouldIncludeDateDir(name, cutoff, todayOnly, todayStr) {
	const datePart = extractDatePart(name);
	if (datePart === null) return false;
	if (todayOnly) return datePart === todayStr;
	const dirDate = /* @__PURE__ */ new Date(datePart + "T00:00:00");
	return !isNaN(dirDate.getTime()) && dirDate >= cutoff;
}
/**
* 回收超过 maxAgeDays 的日期目录。
*
* 两阶段，顺序很重要：
* 1. 先删已标记的残留，逐个 unlink 并计数，达到 maxFilesPerRun 立即停手。
* 2. 再把新过期的日期目录 rename 打标（毫秒级，不限量）。
*
* 只看目录名，不进目录。窗口内的日期目录、以及任何非日期目录完全不碰，
* 连 readdir 都不做。按目录名升序，最旧的先处理。
* 符号链接不跟随也不处理；失败静默跳过，下次继续。
*/
async function cleanupOldLogFiles(dirs, maxAgeDays, options = {}) {
	const now = Date.now();
	const cutoffDay = /* @__PURE__ */ new Date(now - maxAgeDays * 24 * 60 * 60 * 1e3);
	cutoffDay.setHours(0, 0, 0, 0);
	const ctx = {
		cutoffDay,
		deadline: now + (options.timeBudgetMs ?? 1e4),
		maxFiles: options.maxFilesPerRun ?? 2e3,
		result: {
			markedDirs: 0,
			deletedDirs: 0,
			deletedFiles: 0,
			pendingDirs: 0,
			stoppedEarly: false
		}
	};
	const seen = /* @__PURE__ */ new Set();
	for (const dir of dirs) {
		if (!dir) continue;
		const resolved = node_path.resolve(dir);
		if (seen.has(resolved)) continue;
		seen.add(resolved);
		await reclaimDir(dir, ctx);
	}
	return ctx.result;
}
/** 额度或时间预算是否已用尽，用尽时记下原因供线上归因。 */
function outOfBudget(ctx) {
	if (ctx.result.deletedFiles >= ctx.maxFiles) {
		ctx.result.stopReason ??= "file-quota";
		return true;
	}
	if (Date.now() >= ctx.deadline) {
		ctx.result.stopReason ??= "time-budget";
		return true;
	}
	return false;
}
/** 过期日期目录返回 true；非日期目录或窗口内目录返回 false。 */
function isExpiredDateDir(name, cutoffDay) {
	const datePart = extractDatePart(name);
	if (datePart === null) return false;
	const dirDate = /* @__PURE__ */ new Date(`${datePart}T00:00:00`);
	return !isNaN(dirDate.getTime()) && dirDate < cutoffDay;
}
async function reclaimDir(dir, ctx) {
	const entries = await require_archive_artifact_sweep.withIoTimeoutOr(node_fs.promises.readdir(dir, { withFileTypes: true }), "reclaimDir.readdir", []);
	const marked = [];
	const expired = [];
	for (const entry of entries) {
		if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
		if (entry.name.includes(".expired")) marked.push(entry.name);
		else if (isExpiredDateDir(entry.name, ctx.cutoffDay)) expired.push(entry.name);
	}
	marked.sort((left, right) => left.localeCompare(right));
	expired.sort((left, right) => left.localeCompare(right));
	for (const name of marked) {
		if (outOfBudget(ctx)) {
			ctx.result.stoppedEarly = true;
			break;
		}
		if (await removeTree(node_path.join(dir, name), ctx)) ctx.result.deletedDirs++;
		else ctx.result.pendingDirs++;
	}
	for (const name of expired) {
		const target = node_path.join(dir, `${name}${EXPIRED_DIR_SUFFIX}-${Date.now()}-${node_crypto.randomBytes(4).toString("hex")}`);
		try {
			await node_fs.promises.rename(node_path.join(dir, name), target);
			ctx.result.markedDirs++;
			ctx.result.pendingDirs++;
		} catch {}
	}
}
/**
* 在额度内逐个删除目录内容，**随时可停**。
*
* 不用 `fs.rm(recursive)`：那是单次调用，一旦进去就无法中断，删 20 万文件
* 要 60 秒，期间 libuv 线程池被占满，同进程内所有 `fs.promises` 调用一起
* 挨饿 —— 实测归档选材从 11ms 恶化到 2128ms（193x）。逐个 unlink 虽然单价
* 略高，但每删一个都能检查额度，超了立刻停手，这才是关键（#87127）。
*
* 也不用 `readdir`：它要把整个目录的 Dirent 一次性读进内存，对 15.7 万文件
* 的目录本身就要 10 秒，且返回前无法检查额度 —— 线上实测表现为 cleanup 每次
* 精确烧掉 10s 预算却 deletedFiles=0，永远删不掉任何东西。必须用 `opendir`
* 流式迭代，边读边删边检查。
*
* 目录已被 rename 打标、不在用户可见路径上，所以删一半留一半没有副作用，
* 下次调用继续。
*
* @returns 是否已彻底删空（true 时目录自身也已移除）。
*/
async function removeTree(dir, ctx) {
	let handle;
	try {
		handle = await node_fs.promises.opendir(dir);
	} catch {
		return false;
	}
	let complete = true;
	let exhausted = false;
	try {
		for await (const entry of handle) {
			if (outOfBudget(ctx)) {
				ctx.result.stoppedEarly = true;
				exhausted = true;
				break;
			}
			const fullPath = node_path.join(dir, entry.name);
			if (entry.isDirectory() && !entry.isSymbolicLink()) {
				if (!await removeTree(fullPath, ctx)) complete = false;
				continue;
			}
			try {
				await node_fs.promises.unlink(fullPath);
				ctx.result.deletedFiles++;
			} catch {
				complete = false;
			}
		}
	} catch {
		return false;
	}
	if (exhausted || !complete) return false;
	try {
		await node_fs.promises.rmdir(dir);
		return true;
	} catch {
		return false;
	}
}
//#endregion
//#region src/main/features/logs/archive-candidate-walker.ts
async function walkArchiveCandidates(roots, options, caps, protectedPaths) {
	const state = {
		candidates: [],
		protectedPaths,
		skippedByAge: 0,
		skippedByFileSize: 0,
		skippedByDirCap: 0,
		skippedByWalkCap: 0,
		statCalls: 0,
		skippedByExclusion: 0,
		skippedByType: 0,
		cappedDirs: /* @__PURE__ */ new Set()
	};
	for (const root of roots) await walkDir(root.dir, toPosix$1(root.zipPrefix), void 0, options, caps, state);
	return {
		candidates: state.candidates,
		skippedByAge: state.skippedByAge,
		skippedByFileSize: state.skippedByFileSize,
		skippedByDirCap: state.skippedByDirCap,
		skippedByWalkCap: state.skippedByWalkCap,
		statCalls: state.statCalls,
		skippedByExclusion: state.skippedByExclusion,
		skippedByType: state.skippedByType,
		cappedDirs: [...state.cappedDirs]
	};
}
async function walkDir(dir, zipFolder, topDir, options, caps, state) {
	if (isPastDeadline$2(options)) {
		state.skippedByWalkCap++;
		noteCappedDir(state, caps, zipFolder);
		return;
	}
	const subDirs = await scanDir(dir, zipFolder, topDir, options, caps, state);
	subDirs.sort((left, right) => right.localeCompare(left));
	for (const name of subDirs) {
		if (isPastDeadline$2(options)) {
			state.skippedByWalkCap++;
			noteCappedDir(state, caps, `${zipFolder}/${name}`);
			break;
		}
		if (state.statCalls >= caps.maxStatCalls) {
			state.skippedByWalkCap++;
			noteCappedDir(state, caps, `${zipFolder}/${name}`);
			break;
		}
		await walkDir(node_path.join(dir, name), `${zipFolder}/${name}`, topDir ?? name, options, caps, state);
	}
}
async function scanDir(dir, zipFolder, topDir, options, caps, state) {
	const subDirs = [];
	if (isPastDeadline$2(options)) {
		state.skippedByWalkCap++;
		noteCappedDir(state, caps, zipFolder);
		return subDirs;
	}
	const openOperation = node_fs.promises.opendir(dir);
	const remainingMs = remainingDeadlineMs$2(options);
	let handle;
	try {
		handle = remainingMs === void 0 ? await openOperation : await require_archive_artifact_sweep.withIoTimeout(openOperation, `archive-opendir:${zipFolder}`, remainingMs);
	} catch (error) {
		if (error instanceof require_archive_artifact_sweep.IoTimeoutError) {
			state.skippedByWalkCap++;
			noteCappedDir(state, caps, zipFolder);
			openOperation.then((lateHandle) => lateHandle.close()).catch(() => {});
		}
		return subDirs;
	}
	let seenEntries = 0;
	let statsHere = 0;
	const fileQuota = caps.noisyDirNames.has(node_path.basename(dir)) ? caps.maxFilesPerNoisyDir : caps.maxFilesPerDir;
	try {
		for await (const entry of handle) {
			if (isPastDeadline$2(options)) {
				state.skippedByWalkCap++;
				noteCappedDir(state, caps, zipFolder);
				break;
			}
			if (++seenEntries > caps.maxDirEntries) {
				state.skippedByDirCap++;
				noteCappedDir(state, caps, zipFolder);
				break;
			}
			if (entry.isSymbolicLink()) continue;
			if (entry.isDirectory()) {
				if (entry.name.includes(".expired")) {
					state.skippedByAge++;
					continue;
				}
				if (extractDatePart(entry.name) !== null && !shouldIncludeDateDir(entry.name, options.cutoff, options.todayOnly, options.todayStr)) {
					state.skippedByAge++;
					continue;
				}
				subDirs.push(entry.name);
				continue;
			}
			if (!entry.isFile()) continue;
			const fullPath = node_path.join(dir, entry.name);
			if (state.protectedPaths.has(fullPath)) continue;
			if (node_path.basename(dir).toLowerCase() === "memwatch" && /^cli-memwatch-\d+\.log$/i.test(entry.name)) {
				state.skippedByType++;
				continue;
			}
			if (caps.excludedFilePatterns.some((pattern) => pattern.test(entry.name))) {
				state.skippedByExclusion++;
				continue;
			}
			if (!isIncludedFile(entry.name, topDir, caps.includedFileRules)) {
				state.skippedByType++;
				continue;
			}
			if (statsHere >= fileQuota) {
				state.skippedByDirCap++;
				noteCappedDir(state, caps, zipFolder);
				continue;
			}
			if (state.statCalls >= caps.maxStatCalls || isPastDeadline$2(options)) {
				state.skippedByWalkCap++;
				noteCappedDir(state, caps, zipFolder);
				break;
			}
			statsHere++;
			state.statCalls++;
			const statResult = await statWithinDeadline(fullPath, zipFolder, entry.name, options);
			if (statResult.kind === "timeout") {
				state.skippedByWalkCap++;
				noteCappedDir(state, caps, zipFolder);
				break;
			}
			if (statResult.kind === "error") continue;
			const stat = statResult.stat;
			if (!stat.isFile()) continue;
			if (!isInTimeWindow$1(stat.mtime, options)) {
				state.skippedByAge++;
				continue;
			}
			if (stat.size > caps.maxFileBytes) {
				state.skippedByFileSize++;
				continue;
			}
			state.candidates.push({
				absolutePath: fullPath,
				zipFolder,
				fileName: entry.name,
				size: stat.size,
				mtimeMs: stat.mtimeMs
			});
		}
	} catch {}
	return subDirs;
}
async function statWithinDeadline(fullPath, zipFolder, fileName, options) {
	try {
		const remainingMs = remainingDeadlineMs$2(options);
		return {
			kind: "ok",
			stat: remainingMs === void 0 ? await node_fs.promises.lstat(fullPath) : await require_archive_artifact_sweep.withIoTimeout(node_fs.promises.lstat(fullPath), `archive-lstat:${zipFolder}/${fileName}`, remainingMs)
		};
	} catch (error) {
		return error instanceof require_archive_artifact_sweep.IoTimeoutError ? { kind: "timeout" } : { kind: "error" };
	}
}
function isIncludedFile(fileName, topDir, rules) {
	if (rules.length === 0) return true;
	return rules.some((rule) => {
		if (rule.underDir !== void 0 && rule.underDir.toLowerCase() !== topDir?.toLowerCase()) return false;
		return rule.file.test(fileName);
	});
}
function isInTimeWindow$1(mtime, options) {
	return options.todayOnly ? formatLocalDate(mtime) === options.todayStr : mtime >= options.cutoff;
}
function noteCappedDir(state, caps, zipFolder) {
	if (state.cappedDirs.size < caps.maxCappedDirs) state.cappedDirs.add(zipFolder);
}
function isPastDeadline$2(options) {
	return options.deadlineMs !== void 0 && Date.now() >= options.deadlineMs;
}
function remainingDeadlineMs$2(options) {
	return options.deadlineMs === void 0 ? void 0 : Math.max(1, options.deadlineMs - Date.now());
}
function toPosix$1(relativeDir) {
	return relativeDir.split(node_path.sep).filter(Boolean).join("/");
}
//#endregion
//#region src/main/features/logs/protected-core-logs.ts
/**
* 主日志根下必须入包的当前进程日志。它们由各自 logger 的轮转上限约束，
* 正常合计不超过 20MB；可用性优先于普通日志预算。
*/
var DEFAULT_PROTECTED_CORE_LOG_NAMES = [
	"main.log",
	"renderer.log",
	"daemon.log",
	"AppStartup.log"
];
var PROTECTED_CORE_IO_TIMEOUT_MS = 3e3;
async function collectProtectedArchiveEntries(roots, options) {
	const coreLogs = await collectFixedCoreLogs(roots, options);
	const cliMemWatch = await collectCliMemWatchLogs(roots, options);
	return {
		entries: [...coreLogs.entries, ...cliMemWatch.selected],
		discoveredPaths: [...coreLogs.entries.map((entry) => entry.absolutePath), ...cliMemWatch.discoveredPaths],
		skippedByBudget: cliMemWatch.skipped,
		missingCoreLogs: coreLogs.missing
	};
}
async function collectFixedCoreLogs(roots, options) {
	const entries = [];
	const missing = [];
	for (let nameIndex = 0; nameIndex < options.coreLogNames.length; nameIndex++) {
		const fileName = options.coreLogNames[nameIndex];
		let found = false;
		for (const root of roots) {
			const absolutePath = node_path.join(root.dir, fileName);
			try {
				const remainingMs = isPastDeadline$1(options.deadlineMs) ? void 0 : remainingDeadlineMs$1(options.deadlineMs);
				const pendingNames = options.coreLogNames.length - nameIndex;
				const timeoutMs = remainingMs === void 0 ? PROTECTED_CORE_IO_TIMEOUT_MS : Math.max(1, Math.floor(remainingMs / pendingNames));
				const metadata = await require_archive_artifact_sweep.withIoTimeoutOr(node_fs.promises.lstat(absolutePath), `protected-core-lstat:${fileName}`, void 0, timeoutMs);
				if (!metadata) continue;
				if (!metadata.isFile()) continue;
				entries.push({
					absolutePath,
					zipFolder: toPosix(root.zipPrefix),
					fileName,
					size: metadata.size,
					mtimeMs: metadata.mtimeMs,
					protectedCore: true
				});
				found = true;
				break;
			} catch {}
		}
		if (!found) missing.push(fileName);
	}
	return {
		entries,
		missing
	};
}
async function collectCliMemWatchLogs(roots, options) {
	const candidates = [];
	const seenPaths = /* @__PURE__ */ new Set();
	for (const root of roots) {
		if (isPastDeadline$1(options.deadlineMs)) break;
		const rootIsMemWatch = node_path.basename(root.dir).toLowerCase() === "memwatch";
		const memwatchDir = rootIsMemWatch ? root.dir : node_path.join(root.dir, "memwatch");
		const zipFolder = rootIsMemWatch ? toPosix(root.zipPrefix) : `${toPosix(root.zipPrefix)}/memwatch`;
		const openOperation = node_fs.promises.opendir(memwatchDir);
		let handle;
		try {
			const remainingMs = remainingDeadlineMs$1(options.deadlineMs);
			handle = remainingMs === void 0 ? await openOperation : await require_archive_artifact_sweep.withIoTimeout(openOperation, `protected-memwatch-opendir:${zipFolder}`, remainingMs);
		} catch (error) {
			if (error instanceof require_archive_artifact_sweep.IoTimeoutError) {
				openOperation.then((lateHandle) => lateHandle.close()).catch(() => {});
				break;
			}
			continue;
		}
		let seenEntries = 0;
		for await (const entry of handle) {
			if (isPastDeadline$1(options.deadlineMs) || ++seenEntries > options.maxCliMemWatchEntries) break;
			if (!entry.isFile() || !/^cli-memwatch-\d+\.log$/i.test(entry.name)) continue;
			const absolutePath = node_path.join(memwatchDir, entry.name);
			if (seenPaths.has(absolutePath)) continue;
			seenPaths.add(absolutePath);
			try {
				const remainingMs = remainingDeadlineMs$1(options.deadlineMs);
				const metadata = remainingMs === void 0 ? await node_fs.promises.lstat(absolutePath) : await require_archive_artifact_sweep.withIoTimeout(node_fs.promises.lstat(absolutePath), `protected-memwatch-lstat:${entry.name}`, remainingMs);
				candidates.push({
					absolutePath,
					zipFolder,
					fileName: entry.name,
					size: metadata.size,
					mtimeMs: metadata.mtimeMs,
					protectedCore: true
				});
			} catch (error) {
				if (error instanceof require_archive_artifact_sweep.IoTimeoutError) break;
			}
		}
	}
	candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
	const selected = [];
	let selectedBytes = 0;
	for (const candidate of candidates) {
		if (selected.length >= options.maxCliMemWatchFiles || selectedBytes + candidate.size > options.maxCliMemWatchBytes) continue;
		selected.push(candidate);
		selectedBytes += candidate.size;
	}
	return {
		selected,
		discoveredPaths: candidates.map((candidate) => candidate.absolutePath),
		skipped: candidates.length - selected.length
	};
}
function toPosix(relativeDir) {
	return relativeDir.split(node_path.sep).filter(Boolean).join("/");
}
function isPastDeadline$1(deadlineMs) {
	return deadlineMs !== void 0 && Date.now() >= deadlineMs;
}
function remainingDeadlineMs$1(deadlineMs) {
	return deadlineMs === void 0 ? void 0 : Math.max(1, deadlineMs - Date.now());
}
/** 按目录名（basename）匹配的高频埋点目录。 */
var DEFAULT_NOISY_DIR_NAMES = ["perf"];
/**
* 不入包的文件。这些文件既没有排障价值，又在 Windows 上必然被独占：
* - `.mmap3`：mars xlog 的内存映射缓冲，二进制且内容尚未成型
* - `.zip.tmp`：其它模块正在写的归档中间产物
*/
var DEFAULT_EXCLUDED_FILE_PATTERNS = [/\.mmap\d*$/i, /\.zip\.tmp(-|$)/i];
/**
* 入包白名单。判定在 stat **之前**，没命中的文件连一次 syscall 都不做。
*
* 实测用户目录 20.5 万个文件里 99.7% 是埋点 `.jsonl`（20.4 万个全在
* `<日期>/sdk/` 下），而排障真正要用的 `.log` 只有 487 个。改白名单后
* stat 次数从 2 万（撞满 maxStatCalls）降到 570 量级（#87127）。
*/
var DEFAULT_INCLUDED_FILE_RULES = [
	{ file: /\.log$/i },
	{ file: /\.xlog$/i },
	{ file: /\.dmp$/i },
	{ file: /^crash-report-.*\.json$/i },
	{ file: /^report\..*\.json$/i },
	{ file: /^(?:daemon|sidecar|cli)-high-heap(?:\.json)?$/i },
	{
		file: /\.jsonl$/i,
		underDir: "startup"
	}
];
/**
* 遍历所有 root，挑出时间窗口内、且在预算之内的文件。
*
* 核心日志先入包；剩余预算按 mtime 新→旧取，最近的普通日志优先。
*/
async function collectArchiveEntries(roots, options) {
	const maxTotalBytes = options.maxTotalBytes ?? 209715200;
	const maxFiles = options.maxFiles ?? 2e3;
	const protectedArchive = await collectProtectedArchiveEntries(roots, {
		coreLogNames: options.protectedCoreLogNames ?? DEFAULT_PROTECTED_CORE_LOG_NAMES,
		maxCliMemWatchFiles: options.maxProtectedCliMemWatchFiles ?? 3,
		maxCliMemWatchBytes: options.maxProtectedCliMemWatchBytes ?? 5242880,
		maxCliMemWatchEntries: options.maxProtectedCliMemWatchEntries ?? 500,
		deadlineMs: options.deadlineMs
	});
	const protectedCore = protectedArchive.entries;
	const state = await walkArchiveCandidates(roots, options, {
		maxFileBytes: options.maxFileBytes ?? 67108864,
		maxDirEntries: options.maxDirEntries ?? 5e3,
		maxFilesPerDir: options.maxFilesPerDir ?? 500,
		maxFilesPerNoisyDir: options.maxFilesPerNoisyDir ?? 50,
		noisyDirNames: new Set(options.noisyDirNames ?? DEFAULT_NOISY_DIR_NAMES),
		maxStatCalls: options.maxStatCalls ?? 2e4,
		maxCappedDirs: 50,
		excludedFilePatterns: options.excludedFilePatterns ?? DEFAULT_EXCLUDED_FILE_PATTERNS,
		includedFileRules: options.includedFileRules ?? DEFAULT_INCLUDED_FILE_RULES
	}, new Set(protectedArchive.discoveredPaths));
	state.candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
	const entries = [...protectedCore];
	const protectedCoreBytes = entries.reduce((total, entry) => total + entry.size, 0);
	let totalBytes = protectedCoreBytes;
	let skippedByBudget = protectedArchive.skippedByBudget;
	for (const candidate of state.candidates) {
		if (entries.length >= maxFiles || totalBytes + candidate.size > maxTotalBytes) {
			skippedByBudget++;
			continue;
		}
		entries.push(candidate);
		totalBytes += candidate.size;
	}
	return {
		entries,
		totalBytes,
		protectedCoreLogs: protectedCore.map((entry) => `${entry.zipFolder}/${entry.fileName}`),
		missingProtectedCoreLogs: protectedArchive.missingCoreLogs,
		protectedCoreBytes,
		budgetOverflowBytes: Math.max(0, protectedCoreBytes - maxTotalBytes),
		skippedByAge: state.skippedByAge,
		skippedByFileSize: state.skippedByFileSize,
		skippedByBudget,
		skippedByDirCap: state.skippedByDirCap,
		skippedByWalkCap: state.skippedByWalkCap,
		statCalls: state.statCalls + protectedCore.length,
		skippedByExclusion: state.skippedByExclusion,
		skippedByType: state.skippedByType,
		cappedDirs: state.cappedDirs
	};
}
/**
* 计算每个源目录在 zip 里的顶层目录名，并保证互不冲突。
*
* 与旧实现一致：extra 目录 basename 撞车时退化成 `<父目录名>-<basename>`。
*/
async function resolveArchiveRoots(logsDir, extraLogDirs, isValidDirectory) {
	const primaryName = node_path.basename(logsDir);
	const roots = [{
		dir: logsDir,
		zipPrefix: primaryName
	}];
	const seenDirs = new Set([node_path.resolve(logsDir)]);
	const usedPrefixes = new Set([primaryName]);
	for (const extraDir of extraLogDirs ?? []) {
		if (!extraDir) continue;
		const resolved = node_path.resolve(extraDir);
		if (seenDirs.has(resolved) || !await isValidDirectory(extraDir)) continue;
		seenDirs.add(resolved);
		const baseName = node_path.basename(extraDir);
		let prefix = baseName;
		if (usedPrefixes.has(prefix)) prefix = `${node_path.basename(node_path.dirname(extraDir))}-${baseName}`;
		let suffix = 2;
		while (usedPrefixes.has(prefix)) prefix = `${baseName}-${suffix++}`;
		usedPrefixes.add(prefix);
		roots.push({
			dir: extraDir,
			zipPrefix: prefix
		});
	}
	return roots;
}
//#endregion
//#region src/main/features/logs/mac-native-crash-reports.ts
var MAX_CANDIDATES = 200;
var MAX_DISCOVERY_ENTRIES = 500;
var MAX_READ_BYTES = 100 * 1024 * 1024;
function matchesCurrentProduct(content, options) {
	const separator = content.indexOf(10);
	if (separator < 0) return false;
	try {
		const header = JSON.parse(content.subarray(0, separator).toString("utf8"));
		const report = JSON.parse(content.subarray(separator + 1).toString("utf8"));
		if (String(header?.bug_type) !== "309" || typeof report?.captureTime !== "string") return false;
		const captureTime = new Date(report.captureTime);
		if (Number.isNaN(captureTime.getTime()) || !isInTimeWindow(captureTime, options)) return false;
		const bundleInfo = report.bundleInfo;
		const bundles = [
			header.bundleID,
			header.bundle_id,
			report.bundleID,
			bundleInfo?.CFBundleIdentifier
		].filter((value) => typeof value === "string" && value !== "");
		if (bundles.length > 0) {
			const bundleId = options.bundleIdentifier ?? "";
			return Boolean(bundleId) && bundles.some((value) => value === bundleId || value.startsWith(`${bundleId}.`));
		}
		return Boolean(options.executablePath && [header.procPath, report.procPath].some((value) => value === options.executablePath));
	} catch {
		return false;
	}
}
function isInTimeWindow(mtime, options) {
	return options.todayOnly ? formatLocalDate(mtime) === options.todayStr : mtime >= options.cutoff;
}
/**
* Stage matching macOS DiagnosticReports for the log archive. Every failure is
* best effort: an unreadable or malformed report never blocks normal log packaging.
*/
async function stageMacNativeCrashReports(options) {
	if (isPastDeadline(options)) return [];
	const maxFiles = options.maxFiles ?? 10;
	const maxFileBytes = options.maxFileBytes ?? 10 * 1024 * 1024;
	const maxTotalBytes = options.maxTotalBytes ?? 50 * 1024 * 1024;
	const candidates = await discoverCandidates(options, maxFileBytes);
	candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
	const staged = [];
	let totalBytes = 0;
	let readBytes = 0;
	candidateLoop: for (const candidate of candidates.slice(0, MAX_CANDIDATES)) {
		if (staged.length >= maxFiles || isPastDeadline(options)) break;
		let handle;
		let closeInBackground = false;
		try {
			const sourcePath = node_path.join(options.sourceDir, candidate.name);
			const openOperation = node_fs.promises.open(sourcePath, node_fs.constants.O_RDONLY | node_fs.constants.O_NOFOLLOW);
			try {
				handle = await runWithinDeadline(openOperation, `native-crash-open:${candidate.name}`, options);
			} catch (error) {
				if (error instanceof require_archive_artifact_sweep.IoTimeoutError) {
					openOperation.then((lateHandle) => lateHandle.close()).catch(() => {});
					break;
				}
				continue;
			}
			try {
				let stat;
				try {
					stat = await runWithinDeadline(handle.stat(), `native-crash-handle-stat:${candidate.name}`, options);
				} catch (error) {
					if (error instanceof require_archive_artifact_sweep.IoTimeoutError) {
						closeInBackground = true;
						break candidateLoop;
					}
					continue;
				}
				if (!stat.isFile() || stat.size <= 0 || stat.size > maxFileBytes || totalBytes + stat.size > maxTotalBytes || readBytes + stat.size > MAX_READ_BYTES || !isInTimeWindow(stat.mtime, options)) continue;
				let content;
				try {
					content = await runWithinDeadline(handle.readFile(), `native-crash-read:${candidate.name}`, options);
				} catch (error) {
					if (error instanceof require_archive_artifact_sweep.IoTimeoutError) {
						closeInBackground = true;
						break candidateLoop;
					}
					continue;
				}
				readBytes += content.length;
				if (content.length <= 0 || content.length > maxFileBytes || totalBytes + content.length > maxTotalBytes || readBytes > MAX_READ_BYTES) continue;
				if (!matchesCurrentProduct(content, options)) continue;
				if (isPastDeadline(options)) break;
				const stageOperation = node_fs.promises.mkdir(options.destinationDir, { recursive: true }).then(() => node_fs.promises.writeFile(node_path.join(options.destinationDir, candidate.name), content)).then(() => true);
				try {
					await runWithinDeadline(stageOperation, `native-crash-stage:${candidate.name}`, options);
				} catch (error) {
					if (error instanceof require_archive_artifact_sweep.IoTimeoutError) break candidateLoop;
					continue;
				}
				staged.push(candidate.name);
				totalBytes += content.length;
			} finally {
				if (closeInBackground) handle.close().catch(() => {});
				else try {
					await runWithinDeadline(handle.close(), `native-crash-close:${candidate.name}`, options);
				} catch {}
			}
		} catch {}
	}
	return staged;
}
async function discoverCandidates(options, maxFileBytes) {
	const candidates = [];
	const openOperation = node_fs.promises.opendir(options.sourceDir);
	let handle;
	try {
		handle = await runWithinDeadline(openOperation, "native-crash-opendir", options);
	} catch (error) {
		if (error instanceof require_archive_artifact_sweep.IoTimeoutError) openOperation.then((lateHandle) => lateHandle.close()).catch(() => {});
		return candidates;
	}
	let seenEntries = 0;
	try {
		for await (const entry of handle) {
			if (isPastDeadline(options) || ++seenEntries > MAX_DISCOVERY_ENTRIES) break;
			if (!entry.isFile() || !/\.ips(\.synced)?$/.test(entry.name)) continue;
			try {
				const stat = await runWithinDeadline(node_fs.promises.lstat(node_path.join(options.sourceDir, entry.name)), `native-crash-lstat:${entry.name}`, options);
				if (stat.isFile() && stat.size > 0 && stat.size <= maxFileBytes && isInTimeWindow(stat.mtime, options)) candidates.push({
					name: entry.name,
					mtimeMs: stat.mtimeMs
				});
			} catch (error) {
				if (error instanceof require_archive_artifact_sweep.IoTimeoutError) break;
			}
		}
	} catch {}
	return candidates;
}
async function runWithinDeadline(operation, label, options) {
	const timeoutMs = remainingDeadlineMs(options);
	return timeoutMs === void 0 ? operation : require_archive_artifact_sweep.withIoTimeout(operation, label, timeoutMs);
}
function isPastDeadline(options) {
	return options.deadlineMs !== void 0 && Date.now() >= options.deadlineMs;
}
function remainingDeadlineMs(options) {
	return options.deadlineMs === void 0 ? void 0 : Math.max(1, options.deadlineMs - Date.now());
}
//#endregion
//#region src/main/features/logs/package-log-worker.ts
/**
* Worker thread for log archive packaging.
*
* Performs the CPU-intensive selection + zip compression in a background thread
* so the Electron main process stays responsive while the archive is created.
*
* 选材规则见 log-archive-plan.ts：统一按 mtime 过滤，不落 staging 副本，
* 直接把命中的文件塞进 zip（#87127）。
*
* Communication:
*   parentPort receives: { logsDir, extraLogDirs, maxAgeDays, todayOnly, archiveOutputDir }
*   parentPort posts:    { ok: true, zipPath, summary } | { ok: false, error }
*/
async function isValidDirectory(dirPath) {
	try {
		return (await node_fs.promises.lstat(dirPath)).isDirectory();
	} catch {
		return false;
	}
}
function buildZipPaths(parentDir, archivePrefix) {
	const now = /* @__PURE__ */ new Date();
	const archiveName = `${archivePrefix}-${[
		now.getFullYear(),
		String(now.getMonth() + 1).padStart(2, "0"),
		String(now.getDate()).padStart(2, "0"),
		"-",
		String(now.getHours()).padStart(2, "0"),
		String(now.getMinutes()).padStart(2, "0"),
		String(now.getSeconds()).padStart(2, "0")
	].join("")}`;
	const unique = `${archiveName}.${process.pid}`;
	return {
		zipPath: node_path.join(parentDir, `${archiveName}.zip`),
		tmpZipPath: node_path.join(parentDir, `${unique}.zip.tmp`),
		stagingDir: node_path.join(parentDir, `${unique}.staging`)
	};
}
/**
* 归档超时时，主线程只知道「60s 没结果」，不知道卡在哪一步（#87127）。
* 每个阶段结束时上报累计耗时，超时日志便能直接指出最后到达的阶段。
*
* 同时把耗时留在 worker 内部，写进 archive-summary.json —— 用户反馈问题时
* 往往只发 zip 包、不发 main.log，包内自带耗时才能独立定位。
*/
function makeStageReporter(startedAt) {
	const timings = {};
	return {
		timings,
		report(step, detail) {
			const elapsedMs = Date.now() - startedAt;
			timings[step] = elapsedMs;
			node_worker_threads.parentPort?.postMessage({
				phase: "stage",
				step,
				elapsedMs,
				...detail
			});
		}
	};
}
/** 单个文件读取超过此耗时就记下来：定位是哪个文件在阻塞。 */
var SLOW_FILE_MS = 1e3;
/** 慢文件最多记几个，避免消息体膨胀。 */
var MAX_SLOW_FILES = 10;
/** worker 路径上预留的清理时间，deadline = ARCHIVE_TIMEOUT_MS - 此值。 */
var RESERVED_CLEANUP_MS = 2e3;
async function run(input) {
	const startedAt = Date.now();
	const stage = makeStageReporter(startedAt);
	stage.report("worker-entered");
	const { logsDir, extraLogDirs, maxAgeDays, todayOnly = false, maxTotalBytes, archivePrefix = "workbuddy-desktop", darwinBundleIdentifier, executablePath, archiveTimeoutMs = 15e3, archiveOutputDir, archiveWriteReserveMs = RESERVED_CLEANUP_MS, archiveDeadlineMs } = input;
	const deadline = (archiveDeadlineMs ?? startedAt + archiveTimeoutMs) - archiveWriteReserveMs;
	const now = /* @__PURE__ */ new Date();
	const cutoff = new Date(now);
	cutoff.setDate(cutoff.getDate() - maxAgeDays);
	cutoff.setHours(0, 0, 0, 0);
	const todayStr = formatLocalDate(now);
	const logsParentDir = node_path.dirname(logsDir);
	let archiveDir = archiveOutputDir?.trim() || logsParentDir;
	let archiveDirFellBack = false;
	if (archiveDir !== logsParentDir) {
		if (!await require_archive_artifact_sweep.withIoTimeoutOr(node_fs.promises.mkdir(archiveDir, { recursive: true }).then(() => true), "mkdirArchiveOutputDir", false)) {
			archiveDir = logsParentDir;
			archiveDirFellBack = true;
		}
	}
	const { zipPath, tmpZipPath, stagingDir } = buildZipPaths(archiveDir, archivePrefix);
	node_worker_threads.parentPort?.postMessage({
		phase: "paths",
		tmpZipPath,
		stagingDir
	});
	stage.report("paths-resolved", {
		archiveDir,
		archiveDirFellBack
	});
	if (!logsDir || !await require_archive_artifact_sweep.withIoTimeoutOr(isValidDirectory(logsDir), "validateLogsDir", false, Math.max(1, deadline - Date.now()))) throw new Error(`Logs directory is invalid or unreachable: ${logsDir}`);
	stage.report("logs-dir-validated");
	try {
		const roots = await resolveArchiveRoots(logsDir, extraLogDirs, (dir) => require_archive_artifact_sweep.withIoTimeoutOr(isValidDirectory(dir), `validateExtraRoot:${node_path.basename(dir)}`, false, Math.max(1, deadline - Date.now())));
		stage.report("roots-resolved", { roots: roots.length });
		const nativeCrashEnabled = process.platform === "darwin" && Boolean(darwinBundleIdentifier || executablePath);
		const totalArchiveBudget = maxTotalBytes ?? 209715200;
		const budgetSlices = resolveArchiveBudgetSlices(totalArchiveBudget, nativeCrashEnabled);
		const plan = await collectArchiveEntries(roots, {
			cutoff,
			todayOnly,
			todayStr,
			deadlineMs: deadline,
			maxTotalBytes: budgetSlices.ordinaryBytes
		});
		stage.report("plan-collected", {
			files: plan.entries.length,
			totalBytes: plan.totalBytes,
			protectedCoreLogs: plan.protectedCoreLogs,
			missingProtectedCoreLogs: plan.missingProtectedCoreLogs,
			protectedCoreBytes: plan.protectedCoreBytes,
			budgetOverflowBytes: plan.budgetOverflowBytes,
			statCalls: plan.statCalls,
			skippedByType: plan.skippedByType
		});
		const zip = new import_adm_zip.default();
		let unreadable = 0;
		let zipPopulateTruncated = false;
		const slowFiles = [];
		const packagedProtectedCoreLogs = [];
		const unreadableProtectedCoreLogs = [];
		let packagedFiles = 0;
		let packagedBytes = 0;
		let processedFiles = 0;
		for (let i = 0; i < plan.entries.length; i++) {
			processedFiles = i;
			const entry = plan.entries[i];
			if (!entry.protectedCore && Date.now() >= deadline) {
				zipPopulateTruncated = true;
				break;
			}
			const fileStartedAt = Date.now();
			try {
				zip.addLocalFile(entry.absolutePath, entry.zipFolder, entry.fileName);
				const zipEntryName = `${entry.zipFolder}/${entry.fileName}`;
				const actualBytes = zip.getEntry(zipEntryName)?.header.size ?? entry.size;
				packagedFiles++;
				packagedBytes += actualBytes;
				if (entry.protectedCore) packagedProtectedCoreLogs.push(zipEntryName);
			} catch {
				unreadable++;
				if (entry.protectedCore) unreadableProtectedCoreLogs.push(`${entry.zipFolder}/${entry.fileName}`);
			}
			const fileMs = Date.now() - fileStartedAt;
			if (fileMs >= SLOW_FILE_MS && slowFiles.length < MAX_SLOW_FILES) slowFiles.push({
				file: `${entry.zipFolder}/${entry.fileName}`,
				ms: fileMs,
				bytes: entry.size
			});
		}
		if (!zipPopulateTruncated) processedFiles = plan.entries.length;
		stage.report("zip-populated", {
			unreadable,
			slowFiles,
			truncated: zipPopulateTruncated,
			processedFiles,
			packagedFiles,
			packagedBytes
		});
		let crashReports = 0;
		const remainingNativeCrashBudget = Math.min(budgetSlices.nativeCrashBytes, Math.max(0, totalArchiveBudget - plan.totalBytes));
		if (nativeCrashEnabled && remainingNativeCrashBudget > 0) {
			const crashDir = node_path.join(stagingDir, "native-crash-reports");
			crashReports = (await stageMacNativeCrashReports({
				sourceDir: node_path.join(node_os.homedir(), "Library", "Logs", "DiagnosticReports"),
				destinationDir: crashDir,
				bundleIdentifier: darwinBundleIdentifier,
				executablePath,
				cutoff,
				todayOnly,
				todayStr,
				deadlineMs: deadline,
				maxTotalBytes: remainingNativeCrashBudget
			})).length;
			if (crashReports > 0) zip.addLocalFolder(crashDir, "native-crash-reports");
			stage.report("crash-reports-staged", { crashReports });
		}
		const summary = {
			files: packagedFiles,
			totalBytes: packagedBytes,
			plannedFiles: plan.entries.length,
			plannedBytes: plan.totalBytes,
			archiveBudgetBytes: totalArchiveBudget,
			ordinaryBudgetBytes: budgetSlices.ordinaryBytes,
			nativeCrashBudgetBytes: remainingNativeCrashBudget,
			protectedCoreLogs: plan.protectedCoreLogs,
			missingProtectedCoreLogs: plan.missingProtectedCoreLogs,
			packagedProtectedCoreLogs,
			unreadableProtectedCoreLogs,
			protectedCoreBytes: plan.protectedCoreBytes,
			budgetOverflowBytes: plan.budgetOverflowBytes,
			skippedByAge: plan.skippedByAge,
			skippedByFileSize: plan.skippedByFileSize,
			skippedByBudget: plan.skippedByBudget,
			skippedByDirCap: plan.skippedByDirCap,
			skippedByWalkCap: plan.skippedByWalkCap,
			statCalls: plan.statCalls,
			skippedByType: plan.skippedByType,
			cappedDirs: plan.cappedDirs,
			unreadable,
			truncated: zipPopulateTruncated,
			crashReports
		};
		zip.addFile("archive-summary.json", Buffer.from(JSON.stringify({
			generatedAt: now.toISOString(),
			maxAgeDays,
			todayOnly,
			cutoff: cutoff.toISOString(),
			roots: roots.map((root) => ({
				dir: root.dir,
				zipPrefix: root.zipPrefix
			})),
			...summary,
			timingsMs: { ...stage.timings }
		}, null, 2)));
		zip.writeZip(tmpZipPath);
		let zipBytes = 0;
		try {
			zipBytes = node_fs.statSync(tmpZipPath).size;
		} catch {}
		stage.report("zip-written", {
			zipBytes,
			ratio: packagedBytes > 0 ? +(zipBytes / packagedBytes).toFixed(2) : 0,
			truncated: zipPopulateTruncated
		});
		try {
			await node_fs.promises.unlink(zipPath);
		} catch {}
		await node_fs.promises.rename(tmpZipPath, zipPath);
		stage.report("zip-renamed");
		node_worker_threads.parentPort?.postMessage({
			ok: true,
			zipPath,
			summary
		});
		try {
			const sweepStartedAt = Date.now();
			const misplacedDir = archiveDir !== logsParentDir ? logsParentDir : void 0;
			const staleArtifacts = await require_archive_artifact_sweep.sweepStaleArchiveArtifacts(archiveDir, archivePrefix) + (misplacedDir ? await require_archive_artifact_sweep.sweepStaleArchiveArtifacts(misplacedDir, archivePrefix) : 0);
			const sweepStaleMs = Date.now() - sweepStartedAt;
			const sweepZipsStartedAt = Date.now();
			const removedOldZips = await require_archive_artifact_sweep.sweepOldArchiveZips(archiveDir, archivePrefix) + (misplacedDir ? await require_archive_artifact_sweep.sweepOldArchiveZips(misplacedDir, archivePrefix, 0) : 0);
			const sweepZipsMs = Date.now() - sweepZipsStartedAt;
			const cleanupStartedAt = Date.now();
			const cleanup = await cleanupOldLogFiles([logsDir], maxAgeDays);
			const cleanupLogsMs = Date.now() - cleanupStartedAt;
			node_worker_threads.parentPort?.postMessage({
				phase: "cleanup",
				cleanup,
				staleArtifacts,
				sweepStaleMs,
				removedOldZips,
				sweepZipsMs,
				cleanupLogsMs,
				archiveDir,
				archiveDirFellBack,
				misplacedDirSwept: misplacedDir !== void 0,
				elapsedMs: Date.now() - startedAt
			});
		} catch {}
		stage.report("worker-finished");
	} catch (error) {
		try {
			await node_fs.promises.unlink(tmpZipPath);
		} catch {}
		throw error;
	} finally {
		try {
			await node_fs.promises.rm(stagingDir, {
				recursive: true,
				force: true
			});
		} catch {}
	}
}
run(node_worker_threads.workerData).catch((error) => node_worker_threads.parentPort?.postMessage({
	ok: false,
	error: error instanceof Error ? error.message : String(error)
}));
//#endregion
