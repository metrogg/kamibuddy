require("./chunk.js");
let node_path = require("node:path");
let node_fs_promises = require("node:fs/promises");
//#region src/main/system/logging/diagnostic-retention.ts
var DEFAULT_DIAGNOSTIC_RETENTION_POLICY = {
	maxAgeMs: 10080 * 60 * 1e3,
	maxFiles: 20,
	maxTotalBytes: 512 * 1024 * 1024
};
/** Best-effort bounded retention that always preserves the newest artifact. */
async function pruneDiagnosticArtifacts(rootDir, policy, fileOps = DEFAULT_FILE_OPS) {
	const artifacts = await collectArtifacts(rootDir);
	const nowMs = policy.nowMs ?? Date.now();
	const maxFiles = Math.max(1, Math.floor(policy.maxFiles));
	const retained = [];
	const undeletablePaths = /* @__PURE__ */ new Set();
	const newestPath = artifacts.reduce((newest, artifact) => !newest || artifact.mtimeMs > newest.mtimeMs ? artifact : newest, void 0)?.path;
	let deletedFiles = 0;
	for (const artifact of artifacts) {
		if (artifact.path !== newestPath && nowMs - artifact.mtimeMs > policy.maxAgeMs) {
			if (await fileOps.deleteFile(artifact.path)) {
				deletedFiles += 1;
				continue;
			}
			undeletablePaths.add(artifact.path);
		}
		retained.push(artifact);
	}
	retained.sort((left, right) => left.mtimeMs - right.mtimeMs);
	let retainedBytes = retained.reduce((total, artifact) => total + artifact.size, 0);
	while (retained.length > 1 && (retained.length > maxFiles || retainedBytes > policy.maxTotalBytes)) {
		const candidateIndex = retained.findIndex((artifact, index) => index < retained.length - 1 && !undeletablePaths.has(artifact.path));
		if (candidateIndex === -1) break;
		const candidate = retained[candidateIndex];
		if (!await fileOps.deleteFile(candidate.path)) {
			undeletablePaths.add(candidate.path);
			continue;
		}
		retained.splice(candidateIndex, 1);
		retainedBytes -= candidate.size;
		deletedFiles += 1;
	}
	return {
		scannedFiles: artifacts.length,
		deletedFiles,
		retainedFiles: retained.length,
		retainedBytes
	};
}
async function collectArtifacts(dir) {
	let entries;
	try {
		entries = await (0, node_fs_promises.readdir)(dir, { withFileTypes: true });
	} catch {
		return [];
	}
	const artifacts = [];
	for (const entry of entries) {
		const entryPath = (0, node_path.join)(dir, entry.name);
		if (entry.isDirectory()) {
			artifacts.push(...await collectArtifacts(entryPath));
			continue;
		}
		if (!entry.isFile()) continue;
		try {
			const metadata = await (0, node_fs_promises.stat)(entryPath);
			artifacts.push({
				path: entryPath,
				size: metadata.size,
				mtimeMs: metadata.mtimeMs
			});
		} catch {}
	}
	return artifacts;
}
async function tryDelete(path) {
	try {
		await (0, node_fs_promises.rm)(path, { force: true });
		return true;
	} catch {
		return false;
	}
}
var DEFAULT_FILE_OPS = { deleteFile: tryDelete };
//#endregion
//#region src/main/system/transport-error.ts
/**
* 传输层错误判定（daemon / sidecar 共用）。
*
* 独立成模块的原因：`daemon-app-server-entry.ts` 顶层带启动副作用
* （assertDaemonProcessRole → process.exit），无法被单测直接 import。
*/
/**
* 判定是否为"对端已断开"的可恢复传输错误。
*
* 这类错误表达的是**外部事实**（管道/通道对端关闭），而非本进程状态损坏，
* 因此不应升级为进程级致命错误。
*
* 现场（5.4.1 win32）：ConnectorService 推送 Custom MCP 状态 → WBBus.emit →
* `process.send()` 抛 `write EPIPE` → daemon 的 uncaughtException handler
* 无条件 `process.exit(1)` → daemon 死亡 → 全部会话中断。
*
* 只认 Node 的 stable error code，不做 message 文本匹配——后者会随 Node 版本
* 与系统语言漂移。
*/
function isRecoverableTransportError(error) {
	if (typeof error !== "object" || error === null) return false;
	const code = error.code;
	return code === "EPIPE" || code === "ERR_IPC_CHANNEL_CLOSED" || code === "ERR_STREAM_DESTROYED" || code === "ECONNRESET";
}
//#endregion
Object.defineProperty(exports, "DEFAULT_DIAGNOSTIC_RETENTION_POLICY", {
	enumerable: true,
	get: function() {
		return DEFAULT_DIAGNOSTIC_RETENTION_POLICY;
	}
});
Object.defineProperty(exports, "isRecoverableTransportError", {
	enumerable: true,
	get: function() {
		return isRecoverableTransportError;
	}
});
Object.defineProperty(exports, "pruneDiagnosticArtifacts", {
	enumerable: true,
	get: function() {
		return pruneDiagnosticArtifacts;
	}
});
