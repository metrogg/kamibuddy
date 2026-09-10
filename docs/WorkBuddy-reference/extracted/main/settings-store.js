const require_chunk = require("./chunk.js");
const require_credential_protection = require("./credential-protection.js");
let node_fs_promises = require("node:fs/promises");
node_fs_promises = require_chunk.__toESM(node_fs_promises);
//#region ../../packages/workbuddy-server/src/shared/settings-store.ts
/**
* settings.json 共享读写工具（多模块复用）。
*
* 背景：WorkBuddy 的用户级配置写在 `<configDir>/settings.json`（VSCode 风格扁平 key）。
* 多个 daemon-server 模块都要读改写这个文件（SecurityCenter 写 sandbox/file-safety/...
* proxy-settings 写 http.proxy / http.proxySupport / http.noProxy ...），
* 必须共用同一份"读 → 改 → 写 + 文件锁 + 原子写"逻辑，
* 否则两个模块抢写时会互相覆盖字段。
*
* 设计要点：
* - read() 返回 `null` 表示文件存在但 JSON 损坏（调用方决定是回退默认值还是抛错）
* - read() 返回 `{}` 表示文件不存在（首次启动）
* - update(mutator) 包裹了"加锁 → 读 → 调 mutator → 原子写"全流程；
*   mutator 收到的 `current` 也可能是 null，此时由 mutator 自己决定抛错或回退默认
* - 写路径用唯一临时文件 + fsync + rename，避免并发写共享临时文件
*
* 历史：原实现散落在 `security-center/service.ts:330-369`，
* v5 #49077 抽出本文件后，SecurityCenter 与 proxy-settings 都改用此 store。
*/
function createSettingsStore(options) {
	const settingsPath = options.settingsPath;
	const failureReporter = options.logger?.warn ? new require_credential_protection.CredentialProtectionFailureReporter({
		filePath: settingsPath,
		resourceId: "settings/user",
		adapter: "credential-fields",
		processRole: "daemon",
		logger: {
			warn: (message) => options.logger?.warn?.(message),
			info: (message) => options.logger?.info?.(message)
		}
	}) : void 0;
	const readPersisted = async () => {
		try {
			const text = await node_fs_promises.readFile(settingsPath, "utf-8");
			const parsed = JSON.parse(text || "{}");
			if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
			return null;
		} catch (err) {
			if (err?.code === "ENOENT") return {};
			failureReporter?.recordStorageFailure("read", err);
			options.logger?.warn?.(`[SettingsStore] read failed (${settingsPath}):`, err);
			return null;
		}
	};
	const decode = (persisted) => {
		const attempt = failureReporter?.attempt("read");
		const codec = require_credential_protection.createUserSettingsCredentialCodec(attempt?.onUnavailable);
		try {
			const decoded = codec.decode(persisted);
			attempt?.complete();
			return decoded;
		} finally {
			codec.dispose();
		}
	};
	const scheduleMigration = () => {
		require_credential_protection.scheduleCredentialFileMigration(settingsPath, (currentBytes) => {
			const persisted = JSON.parse(currentBytes.toString("utf8"));
			const attempt = failureReporter?.attempt("migrate");
			const codec = require_credential_protection.createUserSettingsCredentialCodec(attempt?.onUnavailable);
			try {
				const decoded = codec.decode(persisted);
				if (!decoded.migrationNeeded) {
					attempt?.complete();
					return;
				}
				const migrated = Buffer.from(`${JSON.stringify(codec.encode(decoded.value), void 0, 2)}\n`, "utf8");
				attempt?.complete();
				return migrated;
			} finally {
				codec.dispose();
			}
		}, { onFailure: (error) => failureReporter?.record("migrate", error) });
	};
	const read = async () => {
		const persisted = await readPersisted();
		if (persisted === null) return null;
		const decoded = decode(persisted);
		if (decoded.migrationNeeded) scheduleMigration();
		return decoded.value;
	};
	const updateLocked = async (mutator) => require_credential_protection.withCredentialFileLock(settingsPath, async () => {
		const persisted = await readPersisted();
		if (persisted === null) {
			const next = mutator(null);
			if (next !== void 0) {
				const attempt = failureReporter?.attempt("write");
				const codec = require_credential_protection.createUserSettingsCredentialCodec(attempt?.onUnavailable);
				try {
					await require_credential_protection.writeCredentialFileAtomically(settingsPath, Buffer.from(`${JSON.stringify(codec.encode(next), void 0, 2)}\n`, "utf8"));
					attempt?.complete();
				} finally {
					codec.dispose();
				}
			}
			return;
		}
		const attempt = failureReporter?.attempt("write");
		const codec = require_credential_protection.createUserSettingsCredentialCodec(attempt?.onUnavailable);
		try {
			const current = codec.decode(persisted).value;
			const next = mutator(current);
			if (next === void 0) return;
			const encoded = codec.encode(next);
			await require_credential_protection.writeCredentialFileAtomically(settingsPath, Buffer.from(`${JSON.stringify(encoded, void 0, 2)}\n`, "utf8"));
			attempt?.complete();
		} finally {
			codec.dispose();
		}
	});
	const update = async (mutator) => {
		try {
			await updateLocked(mutator);
		} catch (error) {
			failureReporter?.recordStorageFailure("write", error);
			throw error;
		}
	};
	return {
		read,
		update
	};
}
//#endregion
Object.defineProperty(exports, "createSettingsStore", {
	enumerable: true,
	get: function() {
		return createSettingsStore;
	}
});
