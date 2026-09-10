const require_chunk = require("./chunk.js");
const require_common = require("./common.js");
const require_desktop_monitor_service = require("./desktop-monitor-service.js");
const require_logger = require("./logger2.js");
const require_startup_type = require("./startup-type.js");
const require_workbuddy_packaged_runtime = require("./workbuddy-packaged-runtime.js");
let electron = require("electron");
let node_path = require("node:path");
node_path = require_chunk.__toESM(node_path);
let node_fs_promises = require("node:fs/promises");
node_fs_promises = require_chunk.__toESM(node_fs_promises);
let node_os = require("node:os");
node_os = require_chunk.__toESM(node_os);
//#region src/main/features/telemetry/safe-storage-startup-probe-state.ts
require_common.init_common$2();
var STATE_VERSION = 1;
/** 密文样本约 100 字节；给到 8 KiB 已远超正常值，超出即视为异常文件。 */
var MAX_STATE_FILE_BYTES = 8 * 1024;
function isValidBase64(value) {
	if (typeof value !== "string" || value.length === 0 || value.length > MAX_STATE_FILE_BYTES) return false;
	return Buffer.from(value, "base64").toString("base64") === value;
}
function parseSample(value) {
	if (typeof value !== "object" || value === null) return;
	const candidate = value;
	if (candidate.v !== STATE_VERSION || !isValidBase64(candidate.ciphertextBase64) || typeof candidate.createdAtMs !== "number" || !Number.isFinite(candidate.createdAtMs) || candidate.createdAtMs < 0 || typeof candidate.createdAppVersion !== "string" || candidate.createdAppVersion.length > 64) return;
	return candidate;
}
function createSafeStorageProbeStateStore(filePath) {
	return {
		async load() {
			let raw;
			try {
				raw = await node_fs_promises.readFile(filePath, "utf8");
			} catch (error) {
				if (error.code === "ENOENT") return { kind: "missing" };
				return {
					kind: "unreadable",
					error
				};
			}
			if (Buffer.byteLength(raw) > MAX_STATE_FILE_BYTES) return { kind: "invalid" };
			let parsed;
			try {
				parsed = JSON.parse(raw);
			} catch {
				return { kind: "invalid" };
			}
			const sample = parseSample(parsed);
			return sample ? {
				kind: "ok",
				sample
			} : { kind: "invalid" };
		},
		async write(sample) {
			await node_fs_promises.mkdir(node_path.dirname(filePath), { recursive: true });
			const temporaryPath = `${filePath}.${process.pid}.tmp`;
			try {
				await node_fs_promises.writeFile(temporaryPath, JSON.stringify(sample), {
					encoding: "utf8",
					mode: 384
				});
				await node_fs_promises.rename(temporaryPath, filePath);
			} catch (error) {
				await node_fs_promises.rm(temporaryPath, { force: true }).catch(() => void 0);
				throw error;
			}
		}
	};
}
//#endregion
//#region src/main/features/telemetry/safe-storage-startup-probe.ts
/**
* safeStorage 跨重启可用性探针。Linux 永不加载本模块。
*
* 每次符合条件的启动执行同一套动作，两个平台完全一致：
*
*   读存档 → 解密上次写入的密文并与固定明文比对 → 加密一份新密文覆盖存档
*
* 之所以必须跨重启而不是同进程加完立刻解：线上真正丢凭证的形态是 DPAPI 主密钥漂移、
* 钥匙串条目被清、profile 漫游、用户名或代码签名变更。这些在同一个进程里用的是同一把
* 刚取到的密钥，加解密一律成功，什么都测不出来。
*
* 关于 macOS 弹框：钥匙串授权框由「进程内第一次取密钥」触发（取到后进程内缓存），
* 与本次调用的是 encrypt 还是 decrypt、解的是哪一段密文都无关。因此同进程回环并不比
* 跨重启更安全，没有理由让 macOS 跑一套阉割逻辑。
*
* 两个平台各有一个云控开关（见 `safe-storage-startup-probe-gate.ts`），出问题即可当场
* 停掉，且互不牵连。风险形态不同但后果相同，都是主线程同步冻结：macOS 是钥匙串授权框，
* Windows 是 DPAPI 在域环境 / 漫游配置下走网络。
*
* 上报走 `DesktopMonitorService.recordSafeStorageProbe()`（collector 队列），因此本模块
* 不需要等待伽利略就绪、也不需要在退出时取消：录进队列就算完成。
*/
require_startup_type.init_startup_type();
/**
* 固定明文。用常量而非随机串，是为了让存档里不必再存一份"期望值"——
* 解密结果直接和本常量比对即可。它不是秘密，泄露无损失。
*/
var PROBE_PLAINTEXT = "workbuddy-safe-storage-probe-v1";
function classifyError(error) {
	const candidate = error;
	const text = `${candidate?.name ?? ""} ${candidate?.code ?? ""} ${candidate?.message ?? error ?? ""}`.toLowerCase();
	if (/does not appear to be encrypted/.test(text)) return "ciphertext_malformed";
	if (/error while decrypting/.test(text)) return "key_mismatch";
	if (/lock|cancel/.test(text)) return "locked_or_cancelled";
	if (/denied|permission|access|eacces|eperm/.test(text)) return "permission_denied";
	if (/dpapi|cryptprotect|cryptunprotect|keyset/.test(text)) return "dpapi";
	if (/unavailable|not.?available|not.?supported/.test(text)) return "unavailable";
	if (/timeout|timed.?out/.test(text)) return "timeout";
	return "unknown";
}
/** 只取错误的类型信息；message / stack 可能含路径和用户名，一律不上报。 */
function errorFields(error) {
	const candidate = error;
	const sanitize = (value) => {
		const text = String(value ?? "").replace(/[^\w.-]/g, "").slice(0, 64);
		return text.length > 0 ? text : void 0;
	};
	return {
		errorName: sanitize(candidate?.name) ?? (error instanceof Error ? "Error" : "NonError"),
		errorCode: sanitize(candidate?.code),
		errorCategory: classifyError(error)
	};
}
/**
* 解密上次写入的密文并比对。没有可验证对象时不是失败：文件不存在是 `seeded`（首启的正常
* 形态），文件在但内容不可用是 `state_invalid`（我们自己写坏了，是要被发现的故障）。
*/
function verifyPreviousSample(api, loaded, now) {
	if (loaded.kind === "unreadable") return {
		result: "state_unreadable",
		...errorFields(loaded.error)
	};
	if (loaded.kind === "missing") return { result: "seeded" };
	if (loaded.kind === "invalid") return { result: "state_invalid" };
	const { sample } = loaded;
	const previous = {
		seedAgeMs: Math.max(0, Date.now() - sample.createdAtMs),
		seedAppVersion: sample.createdAppVersion
	};
	const decryptStartedAt = now();
	const elapsed = () => Math.max(0, Math.round(now() - decryptStartedAt));
	let decrypted;
	try {
		decrypted = api.decryptString(Buffer.from(sample.ciphertextBase64, "base64"));
	} catch (error) {
		return {
			result: "decrypt_failed",
			...previous,
			decryptMs: elapsed(),
			...errorFields(error)
		};
	}
	const decryptMs = elapsed();
	if (decrypted !== PROBE_PLAINTEXT) return {
		result: "plaintext_mismatch",
		...previous,
		decryptMs
	};
	return {
		result: "success",
		...previous,
		decryptMs
	};
}
/**
* 加密固定明文并覆盖存档，供下次启动验证。失败不改变本次的解密结论，只是让下次拿不到
* 更新的样本；因此这里吞掉异常，只返回成败。
*
* 加密和写盘各自独立捕获：前者失败说明 safeStorage 用不了（Windows 上这是唯一的判据），
* 后者失败只说明文件系统有问题（AV 持句柄让 rename 抛 EPERM 是已知形态），两者不能混。
*/
async function writeNextSample(api, store, appVersion, now) {
	const encryptStartedAt = now();
	const encryptElapsed = () => Math.max(0, Math.round(now() - encryptStartedAt));
	let ciphertext;
	try {
		ciphertext = api.encryptString(PROBE_PLAINTEXT);
	} catch (error) {
		const failure = errorFields(error);
		return {
			encryptSucceeded: false,
			encryptMs: encryptElapsed(),
			encryptErrorName: failure.errorName,
			encryptErrorCode: failure.errorCode,
			encryptErrorCategory: failure.errorCategory
		};
	}
	const encryptMs = encryptElapsed();
	try {
		await store.write({
			v: 1,
			ciphertextBase64: ciphertext.toString("base64"),
			createdAtMs: Date.now(),
			createdAppVersion: appVersion
		});
		return {
			encryptSucceeded: true,
			encryptMs,
			persistSucceeded: true
		};
	} catch (error) {
		const failure = errorFields(error);
		return {
			encryptSucceeded: true,
			encryptMs,
			persistSucceeded: false,
			persistErrorName: failure.errorName,
			persistErrorCode: failure.errorCode,
			persistErrorCategory: failure.errorCategory
		};
	}
}
function collectEnvironment(platform) {
	return {
		module: "sandbox",
		schemaVersion: 2,
		platform,
		startupType: require_startup_type.getStartupType(),
		appVersion: electron.app.getVersion(),
		electronVersion: process.versions.electron || "unknown",
		osReleaseVersion: node_os.release().match(/\d+(?:\.\d+){0,3}/)?.[0] ?? "unknown",
		isPackaged: require_workbuddy_packaged_runtime.resolveWorkbuddyPackagedRuntime(electron.app),
		...platform === "win32" ? { windowsIsRemoteSession: /^rdp-/i.test(process.env.SESSIONNAME || "") } : {}
	};
}
/**
* `seeded` / `state_invalid` 都表示"本次没有可验证对象"，不是失败；其余非 success 一律计失败。
*
* `state_invalid` 放进来是刻意的：它承载的信号在 `result` 里，不需要再靠 `status` 和日志级别
* 表达。若把它算作失败，会凭空多出一批 error 级日志，而它并不是 safeStorage 出了问题。
*/
var SUCCESS_RESULTS = new Set([
	"success",
	"seeded",
	"state_invalid"
]);
/**
* 执行一次探针并把结果录入 collector 队列。导出供单测直接调用。
*/
async function runSafeStorageStartupProbe(platform, deps = {}) {
	const monitor = deps.monitor ?? require_desktop_monitor_service.DesktopMonitorService.getSharedInstance();
	if (!monitor) {
		require_logger.mainLog.warn("[SafeStorageProbe] monitor unavailable; probe skipped");
		return;
	}
	const api = deps.api ?? electron.safeStorage;
	const now = deps.now ?? (() => performance.now());
	const startedAt = now();
	let outcome;
	let written;
	let firstCallMs;
	try {
		const firstCallStartedAt = now();
		let available;
		try {
			available = api.isEncryptionAvailable();
		} finally {
			firstCallMs = Math.max(0, Math.round(now() - firstCallStartedAt));
		}
		if (!available) outcome = { result: "unavailable" };
		else {
			const store = deps.store ?? createSafeStorageProbeStateStore(node_path.join(electron.app.getPath("userData"), "safe-storage-probe-v1.json"));
			outcome = verifyPreviousSample(api, await store.load(), now);
			if (outcome.result !== "state_unreadable") written = await writeNextSample(api, store, electron.app.getVersion(), now);
		}
	} catch (error) {
		outcome = {
			result: "unavailable",
			...errorFields(error)
		};
	}
	const durationMs = Math.max(0, Math.round(now() - startedAt));
	const status = SUCCESS_RESULTS.has(outcome.result) && written?.encryptSucceeded !== false && written?.persistSucceeded !== false ? "success" : "failed";
	const attributes = {
		...collectEnvironment(platform),
		...outcome,
		...written === void 0 ? {} : written,
		...firstCallMs === void 0 ? {} : { firstCallMs },
		status,
		durationMs
	};
	const record = {
		timestamp: Date.now(),
		level: status === "failed" ? "warn" : "info",
		message: require_common.SANDBOX_SAFE_STORAGE_STARTUP_PROBE_EVENT,
		attributes
	};
	monitor.recordSafeStorageProbe(record);
	require_logger.mainLog.info("[SafeStorageProbe] recorded", {
		result: outcome.result,
		encryptSucceeded: written?.encryptSucceeded,
		persistSucceeded: written?.persistSucceeded,
		durationMs: attributes.durationMs
	});
	return attributes;
}
var scheduled = false;
/**
* P3 调用。两个平台各自需要云控放行（开关判定在 `safe-storage-startup-probe-gate.ts`），
* 其余平台直接返回 false。
* @returns 是否真的排期了一次探针，供调用方打日志。
*/
function scheduleSafeStorageStartupProbe(probeEnabled, platform = process.platform, defer = setImmediate) {
	const refuse = (reason) => {
		require_logger.mainLog.info("[SafeStorageProbe] not scheduled", {
			reason,
			platform
		});
		return false;
	};
	if (scheduled) return refuse("already_scheduled");
	if (!require_workbuddy_packaged_runtime.resolveWorkbuddyPackagedRuntime(electron.app)) return refuse("not_packaged");
	if (!probeEnabled) return refuse("not_enabled");
	if (platform !== "win32" && platform !== "darwin") return refuse("unsupported_platform");
	const probePlatform = platform;
	scheduled = true;
	require_logger.mainLog.info("[SafeStorageProbe] scheduled", { platform });
	defer(() => {
		runSafeStorageStartupProbe(probePlatform).catch((error) => {
			require_logger.mainLog.warn("[SafeStorageProbe] unexpected probe failure", error);
		});
	});
	return true;
}
/** 仅供单元测试重置进程级 once latch。 */
function __resetSafeStorageStartupProbeForTest() {
	scheduled = false;
}
//#endregion
exports.__resetSafeStorageStartupProbeForTest = __resetSafeStorageStartupProbeForTest;
exports.runSafeStorageStartupProbe = runSafeStorageStartupProbe;
exports.scheduleSafeStorageStartupProbe = scheduleSafeStorageStartupProbe;
