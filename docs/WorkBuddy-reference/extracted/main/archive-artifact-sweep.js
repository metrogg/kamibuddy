const require_chunk = require("./chunk.js");
let node_fs = require("node:fs");
node_fs = require_chunk.__toESM(node_fs);
let node_path = require("node:path");
node_path = require_chunk.__toESM(node_path);
//#region src/main/features/logs/io-timeout.ts
/**
* 给可能被 IO 饱和卡住的 fs 操作加超时（#87127）。
*
* 线上实测：应用启动 21 秒后点击「打开日志文件夹」，worker 报出
* `worker-entered @0ms` 之后 `stalledForMs=60008` —— 整整 60 秒没有任何
* 阶段上报，最终被超时强杀。同期主进程日志显示 50 个 RPC 全部堆积、
* `ageMs` 高达 8~10 秒，整个进程的 IO 已经饱和。
*
* 卡住的是「清理历史残留」这类维护性操作，它们对用户诉求（拿到日志包）
* 完全不是必需的，却因为串在主路径上而拖垮了整次打包。所以给它们加超时：
* 卡住就放弃本次维护，让打包继续走下去。
*/
/** 单个维护性 fs 操作的默认超时。 */
var MAINTENANCE_IO_TIMEOUT_MS = 5 * 1e3;
/** 被 {@link withIoTimeout} 判定为超时时抛出，便于调用方区分。 */
var IoTimeoutError = class extends Error {
	constructor(label, timeoutMs) {
		super(`IO operation '${label}' exceeded ${timeoutMs}ms`);
		this.label = label;
		this.timeoutMs = timeoutMs;
		this.name = "IoTimeoutError";
	}
};
/**
* 给 promise 套一层超时。
*
* 注意：Node 的 fs 操作无法真正取消，超时只是让**调用方**不再等待，
* 底层仍在线程池里跑完。这对本场景足够 —— 目标是别让维护操作堵住主路径。
*
* @param label 出现在错误信息里，便于定位是哪一步超时。
*/
async function withIoTimeout(operation, label, timeoutMs = MAINTENANCE_IO_TIMEOUT_MS) {
	let timer;
	try {
		return await Promise.race([operation, new Promise((_, reject) => {
			timer = setTimeout(() => reject(new IoTimeoutError(label, timeoutMs)), timeoutMs);
			timer.unref?.();
		})]);
	} finally {
		if (timer) clearTimeout(timer);
	}
}
/**
* 同 {@link withIoTimeout}，但超时/失败时返回兜底值而不抛出。
*
* 维护性操作失败不应该影响主流程，绝大多数调用点用这个变体。
*/
async function withIoTimeoutOr(operation, label, fallback, timeoutMs = MAINTENANCE_IO_TIMEOUT_MS) {
	try {
		return await withIoTimeout(operation, label, timeoutMs);
	} catch {
		return fallback;
	}
}
//#endregion
//#region src/main/features/logs/archive-artifact-sweep.ts
/**
* 清理日志归档的中间产物残留与历史压缩包。
*
* 归档过程会在日志目录的父目录下产生两类中间产物：
* - `<prefix>-<ts>.<pid>.zip.tmp`：zip 写入中的临时文件，正常路径下会被 rename 掉
* - `<prefix>-<ts>.<pid>.staging`：mac native crash report 暂存目录，正常路径下由 finally 删除
*
* 但 worker 被 `terminate()` 强杀、被 OOM kill、或应用崩溃/断电时，
* `finally` 不会执行，这些产物就会永久残留（#87127）。由于文件名带秒级
* 时间戳，后续归档不会覆盖它们，多次失败会持续累积。
*
* 因此每次归档**交付之后**扫一遍父目录，把**过期**的中间产物删掉。用 mtime
* 阈值而非无条件删除，避免误删同时进行中的另一次归档。
*
* 不放在归档之前：本次 tmp 路径带秒级时间戳 + pid，天然不与残留撞名，
* 清残留与本次产物毫无依赖；串在前面只是把 readdir + lstat + `fs.rm`
* 的风险白叠给用户诉求（#87127）。
*
* 成功产出的 `<prefix>-<ts>.zip` 同样没有回收机制：每次点击「打开日志目录」
* 都会新增一个且不覆盖，反复点击会持续堆积。这类文件是用户可见产物，
* 因此按「保留最近 N 个」回收，而不是按时间无条件删除。
*/
/** 超过此时长未被更新的中间产物视为已死。需大于归档超时，避免误删进行中的归档。 */
var STALE_ARTIFACT_AGE_MS = 600 * 1e3;
var ARTIFACT_SUFFIXES = [".zip.tmp", ".staging"];
function isArchiveArtifact(name, archivePrefix) {
	if (!name.startsWith(`${archivePrefix}-`)) return false;
	return ARTIFACT_SUFFIXES.some((suffix) => name.endsWith(suffix));
}
/** 只认最终产物 `.zip`；`.zip.tmp` 结尾是 `.tmp`，不会命中。 */
function isArchiveZip(name, archivePrefix) {
	return name.startsWith(`${archivePrefix}-`) && name.endsWith(".zip");
}
/**
* 删除 parentDir 下过期的归档中间产物。
*
* 只认 `<archivePrefix>-*` 且后缀为 `.zip.tmp` / `.staging` 的条目，
* 不会碰产出的 `.zip` 或其它任何文件。符号链接一律跳过。
*
* @param nowMs     当前时间戳，便于测试注入。
* @param maxAgeMs  超过此时长未更新才删；传 0 表示无条件删除（调用方已确认无并发）。
* @returns         实际删除的条目数。
*/
async function sweepStaleArchiveArtifacts(parentDir, archivePrefix, nowMs = Date.now(), maxAgeMs = STALE_ARTIFACT_AGE_MS) {
	const entries = await withIoTimeoutOr(node_fs.promises.readdir(parentDir, { withFileTypes: true }), "sweepStaleArchiveArtifacts.readdir", []);
	let removed = 0;
	for (const entry of entries) {
		if (!isArchiveArtifact(entry.name, archivePrefix)) continue;
		const fullPath = node_path.join(parentDir, entry.name);
		try {
			const stat = await node_fs.promises.lstat(fullPath);
			if (stat.isSymbolicLink()) continue;
			if (nowMs - stat.mtimeMs < maxAgeMs) continue;
			await node_fs.promises.rm(fullPath, {
				recursive: true,
				force: true
			});
			removed++;
		} catch {}
	}
	return removed;
}
/**
* 只保留最近 keepCount 个历史压缩包，更旧的删掉。
*
* 与 {@link sweepStaleArchiveArtifacts} 的区别：zip 是用户可能还要用的产物，
* 所以按个数保留而非按时间删，保证用户手上始终有最近几次的包。
*
* 调用时机在本次归档落盘之后，本次包作为最新的一个被 keepCount 覆盖：
* 若放在归档之前，归档失败时用户会先丢一个旧包，连续失败会被掏空。
*
* @returns 实际删除的个数。
*/
async function sweepOldArchiveZips(parentDir, archivePrefix, keepCount = 3) {
	const entries = await withIoTimeoutOr(node_fs.promises.readdir(parentDir, { withFileTypes: true }), "sweepOldArchiveZips.readdir", []);
	const zips = [];
	for (const entry of entries) {
		if (!isArchiveZip(entry.name, archivePrefix)) continue;
		const fullPath = node_path.join(parentDir, entry.name);
		try {
			const stat = await node_fs.promises.lstat(fullPath);
			if (!stat.isFile()) continue;
			zips.push({
				fullPath,
				mtimeMs: stat.mtimeMs
			});
		} catch {}
	}
	if (zips.length <= keepCount) return 0;
	zips.sort((left, right) => right.mtimeMs - left.mtimeMs);
	let removed = 0;
	for (const zip of zips.slice(keepCount)) try {
		await node_fs.promises.unlink(zip.fullPath);
		removed++;
	} catch {}
	return removed;
}
/**
* 归档失败后立即清理本次的中间产物。
*
* 与 {@link sweepStaleArchiveArtifacts} 互补：worker 被强杀时 `finally` 不执行，
* 主线程用本函数按确切路径清理，不必等到下次归档的 sweep。
*/
async function removeArchiveArtifacts(paths) {
	const targets = [paths.tmpZipPath, paths.stagingDir].filter((p) => Boolean(p));
	for (const target of targets) try {
		await node_fs.promises.rm(target, {
			recursive: true,
			force: true
		});
	} catch {}
}
//#endregion
Object.defineProperty(exports, "IoTimeoutError", {
	enumerable: true,
	get: function() {
		return IoTimeoutError;
	}
});
Object.defineProperty(exports, "removeArchiveArtifacts", {
	enumerable: true,
	get: function() {
		return removeArchiveArtifacts;
	}
});
Object.defineProperty(exports, "sweepOldArchiveZips", {
	enumerable: true,
	get: function() {
		return sweepOldArchiveZips;
	}
});
Object.defineProperty(exports, "sweepStaleArchiveArtifacts", {
	enumerable: true,
	get: function() {
		return sweepStaleArchiveArtifacts;
	}
});
Object.defineProperty(exports, "withIoTimeout", {
	enumerable: true,
	get: function() {
		return withIoTimeout;
	}
});
Object.defineProperty(exports, "withIoTimeoutOr", {
	enumerable: true,
	get: function() {
		return withIoTimeoutOr;
	}
});
