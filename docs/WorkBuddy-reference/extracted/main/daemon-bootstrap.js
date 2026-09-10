const require_chunk = require("./chunk.js");
const require_common$1 = require("./common.js");
const require_graceful_fs$1 = require("./graceful-fs.js");
const require_credential_protection = require("./credential-protection.js");
const require_tencent_docs_prompt_selection = require("./tencent-docs-prompt-selection.js");
const require_logger = require("./logger.js");
const require_wb_source = require("./wb-source.js");
require("./docs.js");
const require_proxy_env = require("./proxy-env.js");
const require_src$1 = require("./src.js");
const require_workbuddy_product_config = require("./workbuddy-product-config.js");
const require_dev_env_override = require("./dev-env-override.js");
const require_workbuddy_paths = require("./workbuddy-paths.js");
const require_session_create_timing = require("./session-create-timing.js");
const require_runtime_context = require("./runtime-context.js");
const require_logger$1 = require("./logger3.js");
const require_package_and_show_log = require("./package-and-show-log.js");
const require_log_acl_guard = require("./log-acl-guard.js");
const require_menu_i18n = require("./menu-i18n.js");
const require_server = require("./server.js");
const require_client_info_env = require("./client-info-env.js");
const require_tls_verification = require("./tls-verification.js");
const require_tar = require("./tar.js");
const require_contract = require("./contract2.js");
const require_runtime_http = require("./runtime-http.js");
const require_adm_zip$1 = require("./adm-zip.js");
const require_process_reap_utils = require("./process-reap-utils.js");
const require_readonly = require("./readonly.js");
const require_document_lifecycle_port = require("./document-lifecycle-port.js");
let fs = require("fs");
fs = require_chunk.__toESM(fs);
let os = require("os");
os = require_chunk.__toESM(os);
let path = require("path");
path = require_chunk.__toESM(path);
let node_child_process = require("node:child_process");
let url = require("url");
let node_fs = require("node:fs");
node_fs = require_chunk.__toESM(node_fs);
let node_path = require("node:path");
node_path = require_chunk.__toESM(node_path);
let node_fs_promises = require("node:fs/promises");
node_fs_promises = require_chunk.__toESM(node_fs_promises);
let node_os = require("node:os");
let util = require("util");
util = require_chunk.__toESM(util);
let events = require("events");
let node_util = require("node:util");
let http = require("http");
http = require_chunk.__toESM(http);
let crypto = require("crypto");
crypto = require_chunk.__toESM(crypto);
let node_stream = require("node:stream");
let fs_promises = require("fs/promises");
fs_promises = require_chunk.__toESM(fs_promises);
let node_stream_promises = require("node:stream/promises");
//#region ../../packages/workbuddy-server/src/storage/index.ts
var import_common = require_common$1.require_common$1();
require_common$1.init_decorate();
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.8_patch_ha_f50fe51f8da8931d61312254a0a15933/node_modules/@celljs/core/lib/common/application/application.js
var require_application = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	var __decorate = exports && exports.__decorate || function(decorators, target, key, desc) {
		var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
		if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
		else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
		return c > 3 && r && Object.defineProperty(target, key, r), r;
	};
	var __metadata = exports && exports.__metadata || function(k, v) {
		if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.CommonApplication = void 0;
	var annotation_1 = require_common$1.require_annotation();
	var application_protocol_1 = require_common$1.require_application_protocol();
	var CommonApplication = class CommonApplication extends application_protocol_1.AbstractApplication {
		async start() {
			await this.doStart();
			this.stateService.state = "started";
			this.stateService.state = "ready";
		}
		async stop() {
			this.doStop();
			this.stateService.state = "stoped";
		}
	};
	exports.CommonApplication = CommonApplication;
	__decorate([(0, annotation_1.Autowired)(application_protocol_1.ApplicationStateService), __metadata("design:type", Object)], CommonApplication.prototype, "stateService", void 0);
	exports.CommonApplication = CommonApplication = __decorate([(0, annotation_1.Component)(application_protocol_1.Application)], CommonApplication);
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.8_patch_ha_f50fe51f8da8931d61312254a0a15933/node_modules/@celljs/core/lib/common/application/application-state.js
var require_application_state = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	var __decorate = exports && exports.__decorate || function(decorators, target, key, desc) {
		var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
		if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
		else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
		return c > 3 && r && Object.defineProperty(target, key, r), r;
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.CommonApplicationStateService = void 0;
	var annotation_1 = require_common$1.require_annotation();
	var application_protocol_1 = require_common$1.require_application_protocol();
	var CommonApplicationStateService = class CommonApplicationStateService extends application_protocol_1.AbstractApplicationStateService {};
	exports.CommonApplicationStateService = CommonApplicationStateService;
	exports.CommonApplicationStateService = CommonApplicationStateService = __decorate([(0, annotation_1.Component)(application_protocol_1.ApplicationStateService)], CommonApplicationStateService);
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.8_patch_ha_f50fe51f8da8931d61312254a0a15933/node_modules/@celljs/core/lib/common/static-module.js
var require_static_module = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	require_common$1.require_common$1();
	var value_1 = require_common$1.require_value();
	var autowired_provider_1 = require_common$1.require_autowired_provider();
	exports.default = (0, require_common$1.require_auto_bind().autoBind)((bind) => {
		(0, value_1.bindValue)(bind);
		(0, autowired_provider_1.bindAutowiredProvider)(bind);
	});
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.8_patch_ha_f50fe51f8da8931d61312254a0a15933/node_modules/@celljs/core/lib/common/application/application-factory.js
var require_application_factory = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.ApplicationFactory = void 0;
	require_common$1.init_Reflect();
	var container_provider_1 = require_common$1.require_container_provider();
	var application_protocol_1 = require_common$1.require_application_protocol();
	require_application();
	require_application_state();
	var auto_bind_1 = require_common$1.require_auto_bind();
	var static_module_1 = require_static_module();
	var utils_1 = require_common$1.require_utils();
	var container_factory_1 = require_common$1.require_container_factory();
	var ApplicationFactory = class {
		static async create(applicationProps, ...modules) {
			utils_1.currentThis.cellProps = applicationProps;
			const container = container_factory_1.ContainerFactory.create(static_module_1.default, (0, auto_bind_1.autoBind)(), ...modules);
			container_provider_1.ContainerProvider.set(container);
			return container.get(application_protocol_1.Application);
		}
	};
	exports.ApplicationFactory = ApplicationFactory;
}));
//#endregion
//#region src/main/initialize.ts
var import_application_factory = /* @__PURE__ */ require_chunk.__toESM(require_application_factory());
var cellContainer = null;
var consoleLogger = {
	info: (message) => console.log(message),
	error: (message) => console.error(message)
};
/**
* 初始化 CellJS 容器。
*
* 调用方必须显式传入模块 profile，避免 daemon app-server 入口被默认 desktop
* profile 的动态 import 污染，进而在 ELECTRON_RUN_AS_NODE 子进程里加载 Electron。
*/
async function initializeCellJSContainer(options = {}) {
	const logger = options.logger ?? consoleLogger;
	if (cellContainer) {
		logger.info("[WorkBuddy] CellJS container already initialized");
		return cellContainer;
	}
	if (!options.baseModules || !options.workbuddyModule) throw new Error("initializeCellJSContainer requires explicit baseModules and workbuddyModule");
	const selectedBaseModules = options.baseModules;
	const selectedWorkbuddyModule = options.workbuddyModule;
	const startedAt = Date.now();
	try {
		logger.info("[WorkBuddy] Creating CellJS application...");
		const application = await import_application_factory.ApplicationFactory.create({}, ...selectedBaseModules, selectedWorkbuddyModule);
		const createdAt = Date.now();
		logger.info(`[WorkBuddy] CellJS application created (${createdAt - startedAt}ms)`);
		cellContainer = import_common.ContainerProvider.provide();
		logger.info("[WorkBuddy] Starting CellJS application...");
		await application.start();
		logger.info(`[WorkBuddy] CellJS application started (${Date.now() - createdAt}ms)`);
	} catch (error) {
		logger.error(`[WorkBuddy] Failed to initialize CellJS container: ${util.inspect(error, {
			depth: 6,
			breakLength: 120
		})}`);
		throw error;
	}
	logger.info(`[WorkBuddy] CellJS container initialized (total ${Date.now() - startedAt}ms)`);
	return cellContainer;
}
//#endregion
//#region ../../packages/workbuddy-server/src/ima/errors.ts
/**
* ima 模块错误类型
*
* 所有与 WorkBuddy 后端 /agent-gateway/ima/* 交互产生的错误都转成 ImaApiError，
* 统一携带 HTTP 状态码、errorCode 语义码、traceId。
*
* 参见：docs/plans/2026-04-19-ima-backend-api-requirements.md §6
*/
/** ima 错误码语义常量。后端返回 errorCode 字符串，对端需要时判断用此表。 */
var ImaErrorCode = {
	UNKNOWN: "IMA_UNKNOWN",
	NETWORK: "IMA_NETWORK",
	ABORTED: "IMA_ABORTED",
	WORKBUDDY_UNAUTHORIZED: "IMA_WORKBUDDY_UNAUTHORIZED",
	NOT_AUTHED: "IMA_NOT_AUTHED",
	TOKEN_EXPIRED: "IMA_TOKEN_EXPIRED",
	REFRESH_FAILED: "IMA_REFRESH_FAILED",
	KB_UNAUTHORIZED: "IMA_KB_UNAUTHORIZED",
	FILE_NOT_FOUND: "IMA_FILE_NOT_FOUND",
	FILE_CONFLICT: "IMA_FILE_CONFLICT",
	FILE_TOO_LARGE: "IMA_FILE_TOO_LARGE",
	RATE_LIMITED: "IMA_RATE_LIMITED",
	AUTH_DENIED: "IMA_AUTH_DENIED",
	UPSTREAM_ERROR: "IMA_UPSTREAM_ERROR",
	INTERNAL_ERROR: "IMA_INTERNAL_ERROR"
};
/**
* ima REST 层统一错误。
*
* 使用 `ImaApiError.fromResponse(res.status, body, traceId)` 创建；
* 上层根据 `errorCode` 做差异化处理（触发重新授权、toast、重试等）。
*/
var ImaApiError = class ImaApiError extends Error {
	constructor(init) {
		super(init.message);
		this.name = "ImaApiError";
		this.httpStatus = init.httpStatus;
		this.errorCode = init.errorCode;
		this.traceId = init.traceId;
		this.detail = init.detail;
		if (init.cause !== void 0) this.cause = init.cause;
	}
	/** 根据后端响应构造错误。body 预期为 `{ code, errorCode, message, detail, traceId }` 结构。 */
	static fromResponse(httpStatus, body, traceId) {
		const b = body && typeof body === "object" ? body : {};
		const errorCode = typeof b.errorCode === "string" ? b.errorCode : void 0;
		const message = typeof b.message === "string" && b.message ? b.message : typeof b.msg === "string" && b.msg ? b.msg : `ima request failed (HTTP ${httpStatus})`;
		const remoteTraceId = typeof b.traceId === "string" ? b.traceId : typeof b.request_id === "string" ? b.request_id : void 0;
		return new ImaApiError({
			message,
			httpStatus,
			errorCode: errorCode ?? fallbackErrorCodeFromStatus(httpStatus),
			traceId: remoteTraceId ?? traceId,
			detail: b.detail
		});
	}
	/** 网络层异常（fetch reject、超时）。*/
	static network(message, cause, traceId) {
		return new ImaApiError({
			message,
			httpStatus: 0,
			errorCode: ImaErrorCode.NETWORK,
			traceId,
			cause
		});
	}
	/** 客户端主动 abort。*/
	static aborted(traceId) {
		return new ImaApiError({
			message: "ima request aborted",
			httpStatus: 0,
			errorCode: ImaErrorCode.ABORTED,
			traceId
		});
	}
	/** 是否需要重新授权（UI 层据此展示 ImaAuthEntry） */
	requiresReauth() {
		return this.errorCode === ImaErrorCode.NOT_AUTHED || this.errorCode === ImaErrorCode.TOKEN_EXPIRED || this.errorCode === ImaErrorCode.REFRESH_FAILED;
	}
	/** 是否可以重试（网络 / 限流 / 上游 5xx） */
	retriable() {
		return this.errorCode === ImaErrorCode.NETWORK || this.errorCode === ImaErrorCode.RATE_LIMITED || this.errorCode === ImaErrorCode.UPSTREAM_ERROR || this.httpStatus >= 500 && this.httpStatus < 600;
	}
	toJSON() {
		return {
			name: this.name,
			message: this.message,
			httpStatus: this.httpStatus,
			errorCode: this.errorCode,
			traceId: this.traceId,
			detail: this.detail
		};
	}
};
function fallbackErrorCodeFromStatus(status) {
	if (status === 401) return ImaErrorCode.WORKBUDDY_UNAUTHORIZED;
	if (status === 403) return ImaErrorCode.NOT_AUTHED;
	if (status === 404) return ImaErrorCode.FILE_NOT_FOUND;
	if (status === 409) return ImaErrorCode.FILE_CONFLICT;
	if (status === 413) return ImaErrorCode.FILE_TOO_LARGE;
	if (status === 429) return ImaErrorCode.RATE_LIMITED;
	if (status >= 500 && status < 600) return ImaErrorCode.UPSTREAM_ERROR;
	return ImaErrorCode.UNKNOWN;
}
//#endregion
//#region ../../packages/workbuddy-server/src/ima/ima-data-cipher.ts
/**
* ImaDataCipher — IMA 数据加解密工具类（与 C++ ImaDataCipher 方案严格对齐）
*
* 加密方案：
*   - AES-128-GCM：密文格式 Base64( nonce(12) + ciphertext + tag(16) )
*   - RSA-OAEP（SHA-256），输出 Base64
*   - 模式自动切换：无 Token / 过期 → RSA；有有效 Token → AES Token
*/
var CryptoMode = /* @__PURE__ */ function(CryptoMode) {
	CryptoMode[CryptoMode["Null"] = 0] = "Null";
	CryptoMode[CryptoMode["RSA"] = 1] = "RSA";
	CryptoMode[CryptoMode["AESToken"] = 2] = "AESToken";
	return CryptoMode;
}({});
var LOG_TAG$1 = "[ImaDataCipher]";
var AES = {
	KEY_LENGTH: 16,
	NONCE_LENGTH: 12,
	TAG_LENGTH: 16,
	TAG_LENGTH_BITS: 128
};
var RSA_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlZ6L/a9+9JBX3rAT+/jh
O6dm8gZc3Tmp4r1AE7ctm41lS7I6CiIF/AfBR4BbmxpdLssDjuKnPlsMMIWFxlDf
XjQyDW+5Ycm4KH1trwYtlg4jBBtr2wHOCnHBie5m3OoGb2MFUN1xtlkL8ohpkj4I
IooAsc+tmQDuKpXUbrKLZFvmzr5YaeCeHnBx/oBs6yMRIAfacGfBSyiVE6ZIqGX9
izULS6vuWSdvR+MGTrL7ZW88hq3KrkPPVuOuJw7xoVyYT0MDqjXUBxxu4ILCF2sF
DIDIuRXGcTx9p5/C1L/Fu9vOKsFI0o8QLZwCDKlYt1aN6mWofvZmfgZyUYwrAY8b
EQIDAQAB
-----END PUBLIC KEY-----`;
var Codec = {
	strToBytes(str) {
		return new TextEncoder().encode(str);
	},
	bytesToStr(bytes) {
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	},
	bytesToBase64(bytes) {
		if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
		let binary = "";
		const chunkSize = 32768;
		for (let i = 0; i < bytes.length; i += chunkSize) binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
		return btoa(binary);
	},
	base64ToBytes(b64) {
		if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(b64, "base64"));
		const binary = atob(b64);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
		return bytes;
	},
	pemToArrayBuffer(pem) {
		const cleaned = pem.replace(/-----BEGIN [^-]+-----/g, "").replace(/-----END [^-]+-----/g, "").replace(/\s+/g, "");
		return Codec.base64ToBytes(cleaned).buffer;
	}
};
var CryptoEnv = {
	getSubtle() {
		const c = CryptoEnv._getCrypto();
		if (!c?.subtle) throw new Error(`${LOG_TAG$1} Web Crypto API not available`);
		return c.subtle;
	},
	getRandomBytes(length) {
		const c = CryptoEnv._getCrypto();
		if (!c) throw new Error(`${LOG_TAG$1} crypto.getRandomValues not available`);
		const arr = new Uint8Array(length);
		c.getRandomValues(arr);
		return arr;
	},
	_getCrypto() {
		if (typeof window !== "undefined" && window.crypto) return window.crypto;
		if (typeof globalThis !== "undefined" && globalThis.crypto) return globalThis.crypto;
	}
};
var AesGcmCipher = {
	generateRawKey() {
		return CryptoEnv.getRandomBytes(AES.KEY_LENGTH);
	},
	importKey(rawKey) {
		return CryptoEnv.getSubtle().importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
	},
	async encrypt(key, plaintext) {
		try {
			const nonce = CryptoEnv.getRandomBytes(AES.NONCE_LENGTH);
			const ciphertextWithTag = new Uint8Array(await CryptoEnv.getSubtle().encrypt({
				name: "AES-GCM",
				iv: nonce,
				tagLength: AES.TAG_LENGTH_BITS
			}, key, Codec.strToBytes(plaintext)));
			const output = new Uint8Array(nonce.length + ciphertextWithTag.length);
			output.set(nonce, 0);
			output.set(ciphertextWithTag, nonce.length);
			return Codec.bytesToBase64(output);
		} catch (e) {
			console.error(`${LOG_TAG$1} AesGcmCipher.encrypt failed:`, e);
			return "";
		}
	},
	async decrypt(key, ciphertextBase64) {
		try {
			const decoded = Codec.base64ToBytes(ciphertextBase64);
			if (decoded.length < AES.NONCE_LENGTH + AES.TAG_LENGTH) {
				console.error(`${LOG_TAG$1} AesGcmCipher.decrypt: ciphertext too short, size=${decoded.length}`);
				return "";
			}
			const nonce = decoded.subarray(0, AES.NONCE_LENGTH);
			const ciphertextWithTag = decoded.subarray(AES.NONCE_LENGTH);
			const plaintextBuf = await CryptoEnv.getSubtle().decrypt({
				name: "AES-GCM",
				iv: nonce,
				tagLength: AES.TAG_LENGTH_BITS
			}, key, ciphertextWithTag);
			return Codec.bytesToStr(new Uint8Array(plaintextBuf));
		} catch (e) {
			console.error(`${LOG_TAG$1} AesGcmCipher.decrypt failed:`, e);
			return "";
		}
	}
};
var RsaOaepEncryptor = class {
	constructor(_publicKeyPem) {
		this._publicKeyPem = _publicKeyPem;
		this._publicKey = null;
		this._importPromise = null;
	}
	async encrypt(data) {
		try {
			const key = await this._importPublicKey();
			const encryptedBuf = await CryptoEnv.getSubtle().encrypt({ name: "RSA-OAEP" }, key, data);
			return Codec.bytesToBase64(new Uint8Array(encryptedBuf));
		} catch (e) {
			console.error(`${LOG_TAG$1} RsaOaepEncryptor.encrypt failed:`, e);
			return "";
		}
	}
	/** 仅支持 SPKI 格式 PEM；带缓存与并发去重 */
	_importPublicKey() {
		if (this._publicKey) return Promise.resolve(this._publicKey);
		if (this._importPromise) return this._importPromise;
		this._importPromise = (async () => {
			const key = await CryptoEnv.getSubtle().importKey("spki", Codec.pemToArrayBuffer(this._publicKeyPem), {
				name: "RSA-OAEP",
				hash: { name: "SHA-256" }
			}, false, ["encrypt"]);
			this._publicKey = key;
			return key;
		})().catch((e) => {
			this._importPromise = null;
			throw e;
		});
		return this._importPromise;
	}
};
var SessionStore = class {
	constructor() {
		this._aesKey = null;
		this._token = "";
		this._tokenExpireTimestamp = 0;
		this._ensureKeyPromise = null;
	}
	hasAesKey() {
		return this._aesKey !== null;
	}
	getAesKey() {
		return this._aesKey;
	}
	getToken() {
		return this._token;
	}
	isTokenValid() {
		if (!this._token || this._tokenExpireTimestamp <= 0) return false;
		return nowInSeconds() < this._tokenExpireTimestamp;
	}
	setToken(token, expireTimestamp) {
		this._token = String(token || "");
		this._tokenExpireTimestamp = Number(expireTimestamp) || 0;
	}
	/** 全量清空：AES key + Token + pending promise */
	clear() {
		this._aesKey = null;
		this._token = "";
		this._tokenExpireTimestamp = 0;
		this._ensureKeyPromise = null;
	}
	/** 确保已有 AES key；并发首次调用共享同一个生成 promise */
	ensureAesKey() {
		if (this._aesKey) return Promise.resolve(this._aesKey);
		if (this._ensureKeyPromise) return this._ensureKeyPromise;
		this._ensureKeyPromise = (async () => {
			if (this._aesKey) return this._aesKey;
			const rawBytes = AesGcmCipher.generateRawKey();
			const material = {
				rawBytes,
				cryptoKey: await AesGcmCipher.importKey(rawBytes)
			};
			this._aesKey = material;
			return material;
		})().finally(() => {
			this._ensureKeyPromise = null;
		});
		return this._ensureKeyPromise;
	}
};
function nowInSeconds() {
	return Math.floor(Date.now() / 1e3);
}
var ImaDataCipher = class {
	static {
		this._session = new SessionStore();
	}
	static {
		this._rsa = new RsaOaepEncryptor(RSA_PUBLIC_KEY_PEM);
	}
	/** 加密 body，自动选择模式（RSA 或 AES Token） */
	static async encrypt(plaintext) {
		const fail = {
			success: false,
			data: "",
			mode: CryptoMode.Null
		};
		if (typeof plaintext !== "string" || plaintext.length === 0) {
			console.error(`${LOG_TAG$1} encrypt: plaintext is empty`);
			return fail;
		}
		const session = this._session;
		const tokenValid = session.isTokenValid();
		if (session.hasAesKey() && !tokenValid && !!session.getToken()) session.clear();
		const { rawBytes, cryptoKey } = await session.ensureAesKey();
		if (tokenValid) {
			const data = await AesGcmCipher.encrypt(cryptoKey, plaintext);
			if (!data) return fail;
			return {
				success: true,
				data,
				mode: CryptoMode.AESToken,
				x_ima_ctk: session.getToken()
			};
		}
		const encryptedKey = await this._rsa.encrypt(rawBytes);
		if (!encryptedKey) return fail;
		const data = await AesGcmCipher.encrypt(cryptoKey, plaintext);
		if (!data) return fail;
		return {
			success: true,
			data,
			mode: CryptoMode.RSA,
			x_ima_ckey: encryptedKey
		};
	}
	/** 使用当前缓存的 AES 密钥解密响应 body；失败返回 '' */
	static async decrypt(ciphertextBase64) {
		if (typeof ciphertextBase64 !== "string" || ciphertextBase64.length === 0) return "";
		const aesKey = this._session.getAesKey();
		if (!aesKey) {
			console.error(`${LOG_TAG$1} decrypt: no AES key, call encrypt first`);
			return "";
		}
		return AesGcmCipher.decrypt(aesKey.cryptoKey, ciphertextBase64);
	}
	/** 保存后台响应头 x-ima-ctk / x-ima-ctk-expire（Unix 秒） */
	static setToken(token, expireTimestamp) {
		this._session.setToken(token, expireTimestamp);
	}
	/** 清除 Token 与 AES 密钥，下次 encrypt 走 RSA 重新协商 */
	static clearSession() {
		this._session.clear();
	}
	static async encryptData(plaintext) {
		if (typeof plaintext !== "string" || plaintext.length === 0) return {
			code: -1,
			msg: "data is empty"
		};
		try {
			const r = await this.encrypt(plaintext);
			if (!r.success || r.mode !== CryptoMode.RSA && r.mode !== CryptoMode.AESToken) return {
				code: -2,
				msg: "encrypt failed"
			};
			const payload = {
				data: r.data,
				x_ima_cm: r.mode
			};
			if (r.mode === CryptoMode.RSA) payload.x_ima_ckey = r.x_ima_ckey;
			else payload.x_ima_ctk = r.x_ima_ctk;
			return {
				code: 0,
				msg: "ok",
				data: payload
			};
		} catch (e) {
			console.error(`${LOG_TAG$1} encryptData failed:`, e);
			return {
				code: -2,
				msg: e instanceof Error ? e.message : "encrypt failed"
			};
		}
	}
	static async decryptData(ciphertextBase64) {
		if (typeof ciphertextBase64 !== "string" || ciphertextBase64.length === 0) return {
			code: -1,
			msg: "data is empty",
			data: ""
		};
		if (!this._session.hasAesKey()) return {
			code: -2,
			msg: "no aes key, call encryptData first",
			data: ""
		};
		try {
			const plaintext = await this.decrypt(ciphertextBase64);
			if (!plaintext) return {
				code: -1,
				msg: "decrypted plaintext is empty",
				data: ""
			};
			return {
				code: 0,
				msg: "ok",
				data: plaintext
			};
		} catch (e) {
			console.error(`${LOG_TAG$1} decryptData failed:`, e);
			return {
				code: -2,
				msg: e instanceof Error ? e.message : "decrypt failed",
				data: ""
			};
		}
	}
	static setCryptoToken(params) {
		const token = params?.token;
		const expire = Number(params?.expire);
		if (typeof token !== "string" || token.length === 0) return {
			code: -1,
			msg: "token is empty"
		};
		if (!Number.isFinite(expire) || expire <= 0) return {
			code: -1,
			msg: "expire is invalid"
		};
		this.setToken(token, expire);
		return {
			code: 0,
			msg: "ok"
		};
	}
	/**
	* 触发时机：后台返回加密 Token 无效/过期时
	*   - HTTP 403 + 响应头 Trpc-Func-Ret: 20006
	*/
	static clearCryptoSession() {
		this.clearSession();
		return {
			code: 0,
			msg: "ok"
		};
	}
};
//#endregion
//#region ../../packages/workbuddy-server/src/ima/ima-backend-client.ts
var DEFAULT_PATH_PREFIX = "/console/agent-gateway/ima";
/**
* 根据 applicationName 计算默认路径前缀：
* - 'workbuddy'（不区分大小写）/ undefined → '/console/agent-gateway/ima'
* - 其他值 → '/console/agent-gateway/ima-{applicationName小写}'
*/
function getDefaultPathPrefix(applicationName) {
	const appName = (applicationName ?? "workbuddy").trim().toLowerCase();
	if (!appName || appName === "workbuddy") return DEFAULT_PATH_PREFIX;
	return `/console/agent-gateway/ima-${appName}`;
}
var DEFAULT_TIMEOUT_MS$1 = 3e4;
/**
* 触发自动加密的路径白名单（精确匹配，去掉 pathPrefix 后的 path）。
*/
var ENCRYPTED_PATHS = new Set(["/openapi/media/v1/download_medias", "/openapi/media/v1/preview_medias"]);
/** 后端响应头：Token + 过期时间（Unix 秒）+ 错误码 */
var HEADER_IMA_CTK = "x-ima-ctk";
var HEADER_IMA_CTK_EXPIRE = "x-ima-ctk-expire";
var HEADER_TRPC_FUNC_RET = "trpc-func-ret";
/** Token 失效时的 trpc 错误码（与后端约定） */
var TRPC_TOKEN_INVALID = "20006";
function resolveImaFetch(fetchFn) {
	if (fetchFn) return fetchFn;
	return (url, init) => {
		if (typeof globalThis.fetch !== "function") throw new Error("IMA fetch is unavailable; inject ImaBackendClientOptions.fetchFn");
		return globalThis.fetch(url, init);
	};
}
var ImaBackendClient = class {
	constructor(options) {
		this.logger = options.logger;
		this.productManager = options.productManager;
		this.authManager = options.authenticationManager;
		const applicationName = process.env.WORKBUDDY_APPLICATION_NAME?.trim();
		this.pathPrefix = (options.pathPrefix ?? getDefaultPathPrefix(applicationName)).replace(/\/+$/, "");
		this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS$1;
		this.fetchFn = resolveImaFetch(options.fetchFn);
	}
	/** GET 请求，解析为 JSON envelope 的 data 字段。 */
	async get(path, options = {}) {
		return this.request("GET", path, void 0, options);
	}
	/** POST 请求，body 会被 JSON.stringify。 */
	async post(path, body, options = {}) {
		const headers = {
			"Content-Type": "application/json",
			...options.headers ?? {}
		};
		return this.request("POST", path, JSON.stringify(body ?? {}), {
			...options,
			headers
		});
	}
	/** DELETE 请求。 */
	async delete(path, options = {}) {
		return this.request("DELETE", path, void 0, options);
	}
	/**
	* POST multipart/form-data。
	*
	* 不要手动设置 Content-Type，让 fetch 实现自动生成 boundary。
	* multipart 不参与加解密（强制 skipCrypto=true）。
	*/
	async postMultipart(path, form, options = {}) {
		return this.request("POST", path, form, {
			...options,
			skipCrypto: true
		});
	}
	/**
	* 以原始二进制形式 GET 资源。
	* 不走 JSON envelope 解析，适用于"下载"场景；不参与加解密。
	*/
	async getBinary(path, options = {}) {
		const url = this.buildUrl(path, options.query);
		const traceId = this.newTraceId();
		const ac = new AbortController();
		const timer = setTimeout(() => ac.abort(), options.timeoutMs ?? this.defaultTimeoutMs);
		try {
			const res = await this.doFetch(url, {
				method: "GET",
				headers: this.buildHeaders(options.headers, traceId, options.idempotencyKey),
				signal: options.signal ?? ac.signal
			}, traceId);
			if (!res.ok) {
				const text = await res.text().catch(() => "");
				throw ImaApiError.fromResponse(res.status, safeJsonParse(text), traceId);
			}
			const ab = await res.arrayBuffer();
			return new Uint8Array(ab);
		} finally {
			clearTimeout(timer);
		}
	}
	async request(method, path, body, options) {
		if (this.shouldEncrypt(path, body, options)) return this.requestEncrypted(method, path, body, options);
		return this.requestPlain(method, path, body, options);
	}
	/** 原始（未加密）请求。 */
	async requestPlain(method, path, body, options) {
		const url = this.buildUrl(path, options.query);
		const traceId = this.newTraceId();
		const ac = new AbortController();
		const timer = setTimeout(() => ac.abort(), options.timeoutMs ?? this.defaultTimeoutMs);
		try {
			const headers = this.buildHeaders(options.headers, traceId, options.idempotencyKey);
			const res = await this.doFetch(url, {
				method,
				headers,
				body,
				signal: options.signal ?? ac.signal
			}, traceId);
			const parsed = safeJsonParse(await res.text());
			if (!res.ok) throw ImaApiError.fromResponse(res.status, parsed, traceId);
			const envelope = parsed ?? {};
			if (envelope.code !== 0) throw ImaApiError.fromResponse(res.status, envelope, traceId);
			if (envelope.data !== void 0) return envelope.data;
			const { code: _code, errorCode: _ec, message: _msg, msg: _m, detail: _d, traceId: _tid, request_id: _rid, ...rest } = parsed ?? {};
			return Object.keys(rest).length > 0 ? rest : {};
		} finally {
			clearTimeout(timer);
		}
	}
	/**
	* 加密请求。Token 失效时自动 clearSession + 重试一次。
	*/
	async requestEncrypted(method, path, plaintextBody, options) {
		try {
			return await this.doEncryptedRequest(method, path, plaintextBody, options);
		} catch (err) {
			if (this.isTokenInvalidError(err)) {
				this.logger.warn(`[ImaBackendClient] token invalid, clear session and retry once: ${path}`);
				ImaDataCipher.clearSession();
				return this.doEncryptedRequest(method, path, plaintextBody, options);
			}
			throw err;
		}
	}
	async doEncryptedRequest(method, path, plaintextBody, options) {
		const enc = await ImaDataCipher.encrypt(plaintextBody);
		if (!enc.success) throw ImaApiError.network("ima encrypt failed", void 0, "");
		const cryptoHeaders = { "x-ima-cm": String(enc.mode) };
		if (enc.mode === CryptoMode.RSA && enc.x_ima_ckey) cryptoHeaders["x-ima-ckey"] = enc.x_ima_ckey;
		else if (enc.mode === CryptoMode.AESToken && enc.x_ima_ctk) cryptoHeaders["x-ima-ctk"] = enc.x_ima_ctk;
		const url = this.buildUrl(path, options.query);
		const traceId = this.newTraceId();
		const ac = new AbortController();
		const timer = setTimeout(() => ac.abort(), options.timeoutMs ?? this.defaultTimeoutMs);
		try {
			const headers = this.buildHeaders({
				...options.headers ?? {},
				...cryptoHeaders
			}, traceId, options.idempotencyKey);
			const res = await this.doFetch(url, {
				method,
				headers,
				body: enc.data,
				signal: options.signal ?? ac.signal
			}, traceId);
			this.persistTokenFromHeaders(res);
			const cipherText = await res.text();
			const trpcFuncRet = res.headers.get(HEADER_TRPC_FUNC_RET) ?? void 0;
			if (!res.ok) {
				const parsed = await this.tryDecryptJson(cipherText) ?? safeJsonParse(cipherText);
				const enriched = this.enrichBodyWithTrpcRet(parsed, trpcFuncRet);
				throw ImaApiError.fromResponse(res.status, enriched, traceId);
			}
			let decrypted = "";
			try {
				decrypted = cipherText ? await ImaDataCipher.decrypt(cipherText) : "";
			} catch (decErr) {
				throw ImaApiError.network(`ima decrypt failed: ${decErr instanceof Error ? decErr.message : String(decErr)}`, decErr, traceId);
			}
			const parsed = decrypted ? safeJsonParse(decrypted) : null;
			const envelope = parsed ?? {};
			if (envelope.code !== 0) throw ImaApiError.fromResponse(res.status, envelope, traceId);
			if (envelope.data !== void 0) return envelope.data;
			const { code: _code, errorCode: _ec, message: _msg, msg: _m, detail: _d, traceId: _tid, request_id: _rid, ...rest } = parsed ?? {};
			return Object.keys(rest).length > 0 ? rest : {};
		} finally {
			clearTimeout(timer);
		}
	}
	/** 是否应当对该请求启用自动加解密。 */
	shouldEncrypt(path, body, options) {
		if (options.skipCrypto) return false;
		if (typeof body !== "string") return false;
		const pathOnly = (path.startsWith("/") ? path : `/${path}`).split("?")[0];
		return ENCRYPTED_PATHS.has(pathOnly);
	}
	/** 把响应头 x-ima-ctk / x-ima-ctk-expire 写入 cipher session。 */
	persistTokenFromHeaders(res) {
		const token = res.headers.get(HEADER_IMA_CTK);
		const expireRaw = res.headers.get(HEADER_IMA_CTK_EXPIRE);
		if (!token || !expireRaw) return;
		const expire = Number(expireRaw);
		if (!Number.isFinite(expire) || expire <= 0) return;
		ImaDataCipher.setToken(token, expire);
	}
	/**
	* 判定是否为 Token 失效错误（HTTP 403 + Trpc-Func-Ret: 20006）。
	* trpcFuncRet 由 doEncryptedRequest 在 4xx 路径上注入到 ImaApiError.detail。
	*/
	isTokenInvalidError(err) {
		if (!(err instanceof ImaApiError)) return false;
		if (err.httpStatus !== 403) return false;
		const detail = err.detail;
		if (typeof detail !== "object" || detail === null) return false;
		return String(detail.trpcFuncRet ?? "") === TRPC_TOKEN_INVALID;
	}
	/** 把响应头 Trpc-Func-Ret 拼到错误响应 body 的 detail 字段里。 */
	enrichBodyWithTrpcRet(body, trpcFuncRet) {
		if (!trpcFuncRet) return body;
		const base = body && typeof body === "object" ? body : {};
		const detail = base.detail && typeof base.detail === "object" ? base.detail : {};
		return {
			...base,
			detail: {
				...detail,
				trpcFuncRet
			}
		};
	}
	/** 尝试以加密方式解析失败响应；失败返回 null。 */
	async tryDecryptJson(cipherText) {
		if (!cipherText) return null;
		try {
			const plain = await ImaDataCipher.decrypt(cipherText);
			return plain ? safeJsonParse(plain) : null;
		} catch {
			return null;
		}
	}
	/** 包装底层 fetch，统一 abort/network 错误转为 ImaApiError。 */
	async doFetch(url, init, traceId) {
		try {
			return await this.fetchFn(url, init);
		} catch (err) {
			if (err?.name === "AbortError") throw ImaApiError.aborted(traceId);
			this.logger.warn(`[ImaBackendClient] network error ${url}`, String(err));
			throw ImaApiError.network(`ima request failed: ${err?.message ?? "unknown"}`, err, traceId);
		}
	}
	buildUrl(path, query) {
		const endpoint = this.productManager.getEndpoint().replace(/\/+$/, "");
		const normalizedPath = path.startsWith("/") ? path : `/${path}`;
		const full = `${endpoint}${this.pathPrefix}${normalizedPath}`;
		if (!query) return full;
		const pairs = [];
		for (const [k, v] of Object.entries(query)) {
			if (v === void 0 || v === null) continue;
			pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
		}
		return pairs.length ? `${full}?${pairs.join("&")}` : full;
	}
	buildHeaders(extra, traceId, idempotencyKey) {
		const base = {
			...this.authManager.buildAuthHeaders(true, true, false),
			"X-Trace-Id": traceId,
			"X-B3-TraceId": traceId,
			"X-B3-SpanId": crypto.randomBytes(8).toString("hex"),
			"X-B3-Sampled": "1"
		};
		if (idempotencyKey) base["X-Request-Id"] = idempotencyKey;
		if (extra) Object.assign(base, extra);
		return base;
	}
	newTraceId() {
		return crypto.randomBytes(16).toString("hex");
	}
};
function safeJsonParse(text) {
	if (!text) return null;
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}
//#endregion
//#region ../../packages/workbuddy-server/src/ima/api/auth-api.ts
/**
* 授权链路请求超时（ms），覆盖 start / status / revoke / accesstoken。
*
* 取 60s 而非原先的 15s：主进程卡顿时 event loop 阻塞实测可达 11s，叠加网络最坏 5s 已越过 15s，
* 会把本可成功的请求提前 abort，status() 随即降级返回 authed=false 并触发不可逆的 revoke（#87036）。
*/
var AUTH_REQUEST_TIMEOUT_MS = 6e4;
var LOG_TAG = "[ImaAuthApi]";
var ImaAuthApi = class {
	constructor(client, deps) {
		this.client = client;
		this.productManager = deps?.productManager;
		this.authManager = deps?.authenticationManager;
		this.fetchFn = resolveImaFetch(deps?.fetchFn);
	}
	/**
	* 发起 OAuth 授权。
	*
	* - 优先走 agent-server：POST /v2/as/connector/oauth/ima/start
	*   把后端返回的 `authorize_url / request_id / expire_at` 映射为
	*   ima service 定义的 `StartAuthResult { authorizeUrl, sessionId, expiresIn }`。
	* - 若 `productManager / authenticationManager` 未注入（单测），退化到旧 `/api/ima/oauth/start`。
	*/
	async start(params) {
		if (!this.productManager || !this.authManager) return this.client.post("/oauth/start", params);
		const url = await this.buildConnectorOauthUrl("start");
		const headers = this.buildAgentServerHeaders();
		if (!headers) throw new Error(`${LOG_TAG} start: not logged in to WorkBuddy`);
		const body = {};
		if (params.deepLinkScheme) body.redirect_uri = `${params.deepLinkScheme}://ima/auth/complete`;
		const response = await this.fetchWithTimeout(url, {
			method: "POST",
			headers,
			body: JSON.stringify(body)
		});
		if (!response.ok) {
			const text = await response.text().catch(() => "");
			throw new Error(`${LOG_TAG} start HTTP ${response.status}: ${text}`);
		}
		const envelope = await response.json();
		if (envelope.code !== 0) throw new Error(`${LOG_TAG} start API error ${envelope.code}: ${envelope.msg ?? ""}`);
		const d = envelope.data;
		const expiresIn = d.expire_at ? Math.max(0, d.expire_at - Math.floor(Date.now() / 1e3)) : 600;
		const nextAction = (typeof d.next_action === "string" ? d.next_action : "redirect") === "connected" ? "connected" : "redirect";
		return {
			authorizeUrl: d.authorize_url ?? "",
			sessionId: d.request_id,
			expiresIn,
			nextAction
		};
	}
	/**
	* 查询授权状态。
	*
	* agent-server 响应里 `extra.user_id / display_name / avatar_url`（若后端透传）
	* 会映射到 `AuthStatus.userId / imaAccountInfo`。
	*/
	async status(params) {
		if (!this.productManager || !this.authManager) return this.client.get("/auth/status", { query: params?.sessionId ? { sessionId: params.sessionId } : void 0 });
		const url = await this.buildConnectorOauthUrl("status");
		const headers = this.buildAgentServerHeaders();
		if (!headers) {
			console.warn(LOG_TAG, "status: no headers (not logged in) → returning authed=false");
			return { authed: false };
		}
		try {
			const response = await this.fetchWithTimeout(url, {
				method: "GET",
				headers
			});
			if (!response.ok) {
				const text = await response.text().catch(() => "");
				console.warn(LOG_TAG, `status HTTP ${response.status}: ${text}`);
				return { authed: false };
			}
			const rawText = await response.text();
			let envelope;
			try {
				envelope = JSON.parse(rawText);
			} catch (parseErr) {
				console.warn(LOG_TAG, "status JSON parse failed:", String(parseErr));
				return { authed: false };
			}
			if (envelope.code !== 0) {
				console.warn(LOG_TAG, `status API error ${envelope.code}: ${envelope.msg ?? ""}`);
				return { authed: false };
			}
			const d = envelope.data;
			const authed = d.status === "connected";
			const result = {
				authed,
				userId: d.extra?.user_id ?? d.extra?.open_id,
				expiresAt: d.expire_at ? d.expire_at * 1e3 : void 0,
				imaAccountInfo: d.extra?.display_name || d.extra?.avatar_url ? {
					displayName: d.extra?.display_name,
					avatarUrl: d.extra?.avatar_url
				} : void 0,
				clientId: d.extra?.client_id
			};
			if (authed) try {
				const tokenData = await this.getAccessToken();
				result.accessToken = tokenData.accessToken;
				result.accessTokenExpiresIn = tokenData.accessTokenExpiresIn;
				result.mcpToken = tokenData.mcpToken;
				result.mcpTokenExpiresAt = tokenData.mcpTokenExpiresAt;
			} catch (tokenErr) {
				console.warn(LOG_TAG, "status: getAccessToken failed, tokens will be empty:", String(tokenErr));
			}
			return result;
		} catch (err) {
			console.warn(LOG_TAG, "status failed:", String(err));
			return { authed: false };
		}
	}
	/**
	* Refresh 语义：agent-server 侧的 `/status` 本身在需要时会触发 token 续期，
	* 这里无额外后端接口可调。为保持 service 返回值形状一致，基于当前 status 返回
	* `expiresAt` 即可。
	*/
	async refresh() {
		if (!this.productManager || !this.authManager) return this.client.post("/auth/refresh", {});
		return { expiresAt: (await this.status()).expiresAt ?? 0 };
	}
	/**
	* 撤销授权：POST /v2/as/connector/oauth/ima/revoke
	* （对应旧 logout 语义）
	*/
	async logout() {
		if (!this.productManager || !this.authManager) return this.client.post("/auth/logout", {});
		const url = await this.buildConnectorOauthUrl("revoke");
		const headers = this.buildAgentServerHeaders();
		if (!headers) throw new Error(`${LOG_TAG} logout: not logged in to WorkBuddy`);
		const response = await this.fetchWithTimeout(url, {
			method: "POST",
			headers,
			body: JSON.stringify({})
		});
		if (!response.ok) {
			const text = await response.text().catch(() => "");
			throw new Error(`${LOG_TAG} logout HTTP ${response.status}: ${text}`);
		}
		const envelope = await response.json();
		if (envelope.code !== 0) throw new Error(`${LOG_TAG} logout API error ${envelope.code}: ${envelope.msg ?? ""}`);
		return { success: true };
	}
	/**
	* 获取 IMA access_token / mcp_token。
	*
	* GET /v2/as/connector/oauth/ima/accesstoken
	* 仅在已确认 authed=true 后调用。
	*/
	async getAccessToken() {
		const url = await this.buildConnectorOauthUrl("accesstoken");
		const headers = this.buildAgentServerHeaders();
		if (!headers) throw new Error(`${LOG_TAG} getAccessToken: not logged in to WorkBuddy`);
		const response = await this.fetchWithTimeout(url, {
			method: "GET",
			headers
		});
		if (!response.ok) {
			const text = await response.text().catch(() => "");
			throw new Error(`${LOG_TAG} getAccessToken HTTP ${response.status}: ${text}`);
		}
		const envelope = await response.json();
		if (envelope.code !== 0) throw new Error(`${LOG_TAG} getAccessToken API error ${envelope.code}: ${envelope.msg ?? ""}`);
		const d = envelope.data;
		return {
			accessToken: d.access_token,
			accessTokenExpiresIn: d.expire_at ? Math.max(0, d.expire_at - Math.floor(Date.now() / 1e3)) : void 0,
			mcpToken: d.mcp_token,
			mcpTokenExpiresAt: d.mcp_token_expire_at ? d.mcp_token_expire_at * 1e3 : void 0
		};
	}
	async buildConnectorOauthUrl(action) {
		return `${this.productManager.getEndpoint().replace(/\/+$/, "")}/v2/as/connector/oauth/${await require_tls_verification.getImaConnectorName(this.productManager)}/${action}`;
	}
	/**
	* 构造 agent-server 请求的 headers。
	* 与 tdoc 的 `buildTdocGatewayHeaders` 同构：Bearer token + X-User-Id + enterprise/domain。
	*/
	buildAgentServerHeaders() {
		const session = this.authManager.currentSessionSubject.getValue();
		if (!session?.auth?.accessToken) return null;
		const { account, auth } = session;
		const headers = {
			"Accept": "application/json",
			"Content-Type": "application/json",
			"Authorization": `Bearer ${auth.accessToken}`
		};
		if (account?.uid) headers["X-User-Id"] = account.uid;
		if (account?.enterpriseId) {
			headers["X-Enterprise-Id"] = account.enterpriseId;
			headers["X-Tenant-Id"] = account.enterpriseId;
		}
		if (auth.domain) headers["X-Domain"] = auth.domain;
		return headers;
	}
	async fetchWithTimeout(url, init) {
		const ac = new AbortController();
		const timer = setTimeout(() => ac.abort(), AUTH_REQUEST_TIMEOUT_MS);
		try {
			return await this.fetchFn(url, {
				...init,
				signal: ac.signal
			});
		} finally {
			clearTimeout(timer);
		}
	}
};
//#endregion
//#region ../../packages/workbuddy-server/src/ima/api/files-api.ts
var import_cos_nodejs_sdk_v5 = /* @__PURE__ */ require_chunk.__toESM(require_log_acl_guard.require_cos_nodejs_sdk_v5());
var SORT_BY_TO_SORT_TYPE = {
	createdDesc: 0,
	createdAsc: 1,
	sizeDesc: 2,
	nameAsc: 3,
	nameDesc: 4,
	sizeAsc: 5,
	mediaTypeAsc: 6,
	mediaTypeDesc: 7,
	updatedAsc: 8,
	updatedDesc: 9
};
function buildFilters(params) {
	const filters = [];
	if (params.mediaStates?.length) filters.push({
		filter_type: 1,
		media_state_filter: { media_states: params.mediaStates }
	});
	if (params.tags?.length) filters.push({
		filter_type: 2,
		tags_filter: { tags: params.tags }
	});
	if (params.mediaTypes?.length) filters.push({
		filter_type: 3,
		media_type_filter: { media_type: params.mediaTypes }
	});
	if (params.excludeMediaTypes?.length) filters.push({
		filter_type: 4,
		media_type_filter_out: { media_type: params.excludeMediaTypes }
	});
	return filters.length > 0 ? filters : void 0;
}
function mapRawKnowledgeItem(raw) {
	const mediaTypeInfo = raw.media_type_info ? {
		icon: raw.media_type_info.icon ?? "",
		name: raw.media_type_info.name ?? ""
	} : void 0;
	const creator = raw.creator_info ? {
		nickname: raw.creator_info.nick_name ?? "",
		isCreator: raw.creator_info.is_creator ?? false
	} : void 0;
	const fileSize = typeof raw.file_size === "number" ? raw.file_size : typeof raw.file_size === "string" ? parseInt(raw.file_size, 10) || void 0 : void 0;
	const createTime = typeof raw.create_time === "number" ? raw.create_time : typeof raw.create_time === "string" ? parseInt(raw.create_time, 10) || 0 : 0;
	return {
		mediaId: raw.media_id ?? "",
		mediaType: raw.media_type ?? 1,
		mediaTypeInfo,
		title: raw.title ?? "",
		introduction: raw.introduction,
		coverUrls: raw.cover_urls,
		tags: raw.tags,
		mediaState: raw.media_state ?? 0,
		parseProgress: raw.parse_progress,
		fileSize,
		createTime,
		timeWording: raw.time_wording,
		parentFolderId: raw.parent_folder_id ?? "",
		accessStatus: raw.access_status,
		isTop: raw.is_top,
		isFolder: raw.media_type === 99,
		folderInfo: raw.folder_info ?? null,
		creator,
		forbiddenInfo: raw.forbidden_info ?? null,
		canFetchContent: raw.can_fetch_content
	};
}
var UPLOAD_MIME_BY_EXT = {
	pdf: "application/pdf",
	md: "text/markdown",
	markdown: "text/markdown",
	txt: "text/plain",
	json: "application/json",
	csv: "text/csv",
	html: "text/html",
	htm: "text/html",
	xml: "application/xml",
	doc: "application/msword",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	xls: "application/vnd.ms-excel",
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	ppt: "application/vnd.ms-powerpoint",
	pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
	svg: "image/svg+xml",
	mp3: "audio/mpeg",
	wav: "audio/wav",
	mp4: "video/mp4",
	zip: "application/zip"
};
function inferMimeByExt(ext) {
	return UPLOAD_MIME_BY_EXT[ext.toLowerCase()] ?? "application/octet-stream";
}
var ImaFilesApi = class {
	constructor(client, deps = {}) {
		this.client = client;
		this.fetchFn = resolveImaFetch(deps.fetchFn);
	}
	/**
	* 获取知识列表（§4.7）。
	*
	* 底层调用 IMA `POST /openapi/knowledge_base/v1/get_knowledge_list`。
	*
	* 注意：IMA 后端硬约束 `limit ∈ (0, 50]`，超出会返回 `code=51` 业务错误。
	* 这里做一次 clamp 兜底，避免上层漏传 / 误传超限值导致整个列表加载失败。
	*/
	async list(params) {
		const filters = buildFilters({
			mediaStates: params.mediaStates,
			tags: params.tags,
			mediaTypes: params.mediaTypes,
			excludeMediaTypes: params.excludeMediaTypes
		});
		const safeLimit = Math.min(50, Math.max(1, params.limit ?? 20));
		const body = {
			knowledge_base_id: params.kbId,
			cursor: params.cursor ?? "",
			limit: safeLimit
		};
		if (params.sortBy) body.sort_type = SORT_BY_TO_SORT_TYPE[params.sortBy] ?? 0;
		if (filters) body.filters = filters;
		if (params.needDefaultCover !== void 0) body.need_default_cover = params.needDefaultCover;
		if (params.version) body.version = params.version;
		if (params.folderId) body.folder_id = params.folderId;
		const raw = await this.client.post("/openapi/knowledge_base/v1/get_knowledge_list", body);
		return {
			knowledgeBaseInfo: {
				id: raw.knowledge_base_info?.id ?? "",
				name: raw.knowledge_base_info?.basic_info?.name ?? "",
				fileCount: Number(raw.knowledge_base_info?.basic_info?.knowledge_total_size) || 0
			},
			items: (raw.knowledge_list ?? []).map(mapRawKnowledgeItem),
			currentPath: (raw.current_path ?? []).map((p) => ({
				folderId: p.folder_id ?? "",
				name: p.name ?? ""
			})),
			nextCursor: raw.next_cursor || null,
			isEnd: raw.is_end ?? true,
			totalSize: Number(raw.total_size) || 0,
			version: raw.version,
			isUpdate: raw.is_update
		};
	}
	/**
	* 搜索知识（§4.8）。
	*
	* 底层调用 IMA `POST /openapi/knowledge_base/v1/search_knowledge`。
	* 注意：IMA search 接口不支持 limit，每页条数由 ima 后端决定。
	*/
	async search(params) {
		const filters = buildFilters({
			mediaStates: params.mediaStates,
			tags: params.tags,
			mediaTypes: params.mediaTypes,
			excludeMediaTypes: params.excludeMediaTypes
		});
		const body = {
			knowledge_base_id: params.kbId,
			cursor: params.cursor ?? ""
		};
		if (params.q) body.query = params.q;
		if (filters) body.filters = filters;
		if (params.folderId) body.folder_id = params.folderId;
		const raw = await this.client.post("/openapi/knowledge_base/v1/search_knowledge", body);
		return {
			items: (raw.searched_knowledge_list ?? []).map((item) => {
				const base = mapRawKnowledgeItem(item.knowledge ?? {});
				const highlights = item.highlight_content || item.highlight_title || item.highlight_tags?.length || item.highlight_category ? {
					content: item.highlight_content,
					title: item.highlight_title,
					tags: item.highlight_tags,
					category: item.highlight_category
				} : void 0;
				return {
					...base,
					parentFolderName: item.parent_folder_name,
					highlights
				};
			}),
			nextCursor: raw.next_cursor || null,
			isEnd: raw.is_end ?? true
		};
	}
	/**
	* 获取文件预览 URL。
	* 走 IMA 官方预览接口 `POST /openapi/media/v1/preview_medias`。
	*
	* 与 `getDownloadUrl` 的区别：preview 接口返回的 URL 由 IMA 侧针对**浏览器内联预览**
	* 场景做了 `Content-Disposition: inline` / 跨域头等优化；download 接口返回的 URL
	* 更偏向于触发下载。前端预览务必走本方法，下载走 getDownloadUrl。
	*/
	getViewUrl(fileId) {
		return this.fetchSingleMediaItem(fileId, "/openapi/media/v1/preview_medias");
	}
	/**
	* 获取文件下载 URL。
	* 走 IMA 官方下载接口 `POST /openapi/media/v1/download_medias`。
	*/
	getDownloadUrl(fileId) {
		return this.fetchSingleMediaItem(fileId, "/openapi/media/v1/download_medias");
	}
	/**
	* 拉取指定 URL 的文本内容（用于 markdown 等纯文本预览）。
	*
	* 设计：调用方（通常是 ImaFilePreview）已经持有 download_url
	* （由 imaFilesViewUrl/JSAPI openMedia 预拉得到），不再走 preview_medias 二次请求。
	* app-server 通过注入的 fetch 拉取文本，规避渲染端 CORS 限制。
	*
	* 失败转换：HTTP 非 2xx → throw Error；网络异常透传。
	*/
	async getContent(url$2) {
		if (!url$2) throw new Error("[ImaFilesApi] getContent: url is empty");
		let res;
		try {
			res = await this.fetchFn(url$2);
		} catch (e) {
			throw new Error(`[ImaFilesApi] getContent: fetch failed ${e instanceof Error ? e.message : String(e)}`);
		}
		if (!res.ok) throw new Error(`[ImaFilesApi] getContent: http ${res.status} ${res.statusText}`);
		return { content: await res.text() };
	}
	/**
	* 拉取指定 URL 的二进制内容（用于 PDF / Office 等非文本预览）。
	*
	* 和 getContent 对称：fetch → ArrayBuffer → base64（IPC 不能直传 ArrayBuffer）。
	* 调用方在渲染端 `atob → Uint8Array → new File([buf], name, { type })` 消费。
	*/
	async getBlob(url$3) {
		if (!url$3) throw new Error("[ImaFilesApi] getBlob: url is empty");
		let res;
		try {
			res = await this.fetchFn(url$3);
		} catch (e) {
			throw new Error(`[ImaFilesApi] getBlob: fetch failed ${e instanceof Error ? e.message : String(e)}`);
		}
		if (!res.ok) throw new Error(`[ImaFilesApi] getBlob: http ${res.status} ${res.statusText}`);
		const arrayBuffer = await res.arrayBuffer();
		return {
			base64: Buffer.from(arrayBuffer).toString("base64"),
			mimeType: res.headers.get("content-type")?.split(";")[0]?.trim() ?? "application/octet-stream",
			size: arrayBuffer.byteLength
		};
	}
	/**
	* 调用 IMA 媒体接口（preview_medias / download_medias）拿到单条文件结果。
	* 把 ret_code !== 0 的失败转成异常。
	*
	* preview_medias 与 download_medias 请求体（`{ media_ids: string[] }`）和响应体
	* （`{ results: Record<media_id, ImaDownloadMediaItem> }`）结构完全一致，故抽取为
	* 同一个内部方法，仅 path 参数化。
	*/
	async fetchSingleMediaItem(fileId, path$15) {
		const body = { media_ids: [fileId] };
		const resp = await this.client.post(path$15, body);
		const tag = path$15.split("/").pop() ?? path$15;
		const item = resp.results?.[fileId];
		if (!item) throw new Error(`[ImaFilesApi] ${tag}: missing result for media_id=${fileId}`);
		if (item.ret_code !== 0) throw new Error(`[ImaFilesApi] ${tag}: media_id=${fileId} ret_code=${item.ret_code} msg=${item.wrong_msg}`);
		return item;
	}
	async upload(params) {
		const form = new FormData();
		form.append("metadata", JSON.stringify({
			kbId: params.kbId,
			folderId: params.folderId,
			filename: params.filename,
			overwrite: params.overwrite ?? false,
			tags: params.tags
		}));
		const buffer = new Uint8Array(params.content.byteLength);
		buffer.set(params.content);
		const blob = new Blob([buffer.buffer], { type: params.mimeType });
		form.append("file", blob, params.filename);
		return this.client.postMultipart("/files/upload", form, { idempotencyKey: params.idempotencyKey });
	}
	/** Step ①：创建媒体占位 + 拿 COS 临时凭证（IMA `POST /openapi/media/v1/create_media`） */
	createMedia(params) {
		return this.client.post("/openapi/media/v1/create_media", {
			file_name: params.fileName,
			file_size: params.fileSize,
			content_type: params.contentType,
			knowledge_base_id: params.knowledgeBaseId,
			file_ext: params.fileExt
		});
	}
	/** Step ③：COS 上传完成后入库（IMA `POST /openapi/knowledge_base/v1/add_knowledge`） */
	addKnowledge(params) {
		return this.client.post("/openapi/knowledge_base/v1/add_knowledge", {
			media_id: params.mediaId,
			knowledge_base_id: params.knowledgeBaseId,
			folder_id: params.folderId ?? ""
		});
	}
	/**
	* Step ②：用 STS 凭证把 Buffer 直传 COS（cos-nodejs-sdk-v5 putObject）。
	* 凭证仅在 app-server 内构造 client，不出 app-server。单次 PUT 适合 <50MB；大文件可切 sliceUploadFile。
	*/
	uploadToCos(cred, body, contentType, onProgress) {
		const cos = new import_cos_nodejs_sdk_v5.default({
			SecretId: cred.secret_id,
			SecretKey: cred.secret_key,
			SecurityToken: cred.token
		});
		return new Promise((resolve, reject) => {
			cos.putObject({
				Bucket: cred.bucket_name,
				Region: cred.region,
				Key: cred.cos_key,
				Body: body,
				ContentType: contentType,
				onProgress: onProgress ? (info) => {
					try {
						onProgress(info);
					} catch {}
				} : void 0
			}, (err, data) => {
				if (err) {
					const msg = err instanceof Error ? err.message : String(err);
					reject(/* @__PURE__ */ new Error(`[ImaFilesApi] COS putObject failed: ${msg}`));
					return;
				}
				if (data?.statusCode && data.statusCode >= 300) {
					reject(/* @__PURE__ */ new Error(`[ImaFilesApi] COS putObject http ${data.statusCode}`));
					return;
				}
				resolve();
			});
		});
	}
	/**
	* 「保存到 ima 知识库」一站式 API：编排 ① + ② + ③。
	* 任一步失败直接抛出；上一步残留的 media 占位 / COS 对象由 IMA 后端按过期回收。
	*/
	async uploadByPath(params) {
		const { signal } = params;
		/** 若 signal 已 abort，抛出 AbortError 中断流程 */
		const throwIfAborted = () => {
			if (signal?.aborted) {
				const err = /* @__PURE__ */ new Error("Upload cancelled");
				err.name = "AbortError";
				throw err;
			}
		};
		const emit = (stage, percent, extra) => {
			if (!params.onProgress) return;
			const p = Math.max(0, Math.min(100, Math.floor(percent)));
			try {
				params.onProgress({
					stage,
					percent: p,
					...extra
				});
			} catch {}
		};
		throwIfAborted();
		emit("prepare", 0);
		const localPath = normalizeLocalPath(params.filePath);
		const filename = params.filename ?? path.basename(localPath);
		const ext = path.extname(filename).slice(1).toLowerCase();
		const MB_BYTES = 1024 * 1024;
		const FALLBACK_MAX_UPLOAD_SIZE_BYTES = 200 * MB_BYTES;
		const MAX_UPLOAD_SIZE_BYTES = {
			pdf: 200 * MB_BYTES,
			doc: 200 * MB_BYTES,
			docx: 200 * MB_BYTES,
			xls: 10 * MB_BYTES,
			xlsx: 10 * MB_BYTES,
			csv: 10 * MB_BYTES,
			ppt: 200 * MB_BYTES,
			pptx: 200 * MB_BYTES,
			jpg: 30 * MB_BYTES,
			jpeg: 30 * MB_BYTES,
			png: 30 * MB_BYTES,
			webp: 30 * MB_BYTES,
			wav: 200 * MB_BYTES,
			aac: 200 * MB_BYTES,
			mp3: 200 * MB_BYTES,
			m4a: 200 * MB_BYTES,
			txt: 10 * MB_BYTES,
			md: 10 * MB_BYTES,
			xmind: 10 * MB_BYTES
		}[ext] ?? FALLBACK_MAX_UPLOAD_SIZE_BYTES;
		const formatHumanSize = (bytes) => {
			if (!Number.isFinite(bytes) || bytes < 0) return `${bytes} B`;
			const units = [
				"B",
				"KB",
				"MB",
				"GB",
				"TB"
			];
			let value = bytes;
			let unitIdx = 0;
			while (value >= 1024 && unitIdx < units.length - 1) {
				value /= 1024;
				unitIdx += 1;
			}
			const digits = value < 10 ? 2 : 1;
			return `${value.toFixed(digits)} ${units[unitIdx]}`;
		};
		let stat;
		try {
			stat = await fs_promises.stat(localPath);
		} catch (e) {
			console.error("[ImaFilesApi] stat failed:", e);
			throw e;
		}
		if (stat.size > MAX_UPLOAD_SIZE_BYTES) {
			const humanSize = formatHumanSize(stat.size);
			const limitHuman = formatHumanSize(MAX_UPLOAD_SIZE_BYTES);
			console.error(`[ImaFilesApi] file too large: ext=${ext} bytes=${stat.size} (${humanSize}), limit=${limitHuman}`);
			throw new Error(`当前文件 ${humanSize}，超出 ${limitHuman} 大小上限`);
		}
		let buffer;
		try {
			buffer = await fs_promises.readFile(localPath);
		} catch (e) {
			if (e instanceof RangeError && /greater than|too large/i.test(e.message ?? "")) {
				const humanSize = formatHumanSize(stat.size);
				const limitHuman = formatHumanSize(MAX_UPLOAD_SIZE_BYTES);
				throw new Error(`当前文件 ${humanSize}，超出 ${limitHuman} 大小上限`);
			}
			throw e;
		}
		const contentType = params.contentType ?? inferMimeByExt(ext);
		const fileSize = buffer.byteLength;
		emit("prepare", 5);
		throwIfAborted();
		emit("createMedia", 5);
		const created = await this.createMedia({
			fileName: filename,
			fileSize,
			contentType,
			knowledgeBaseId: params.kbId,
			fileExt: ext
		});
		if (!created?.media_id || !created?.cos_credential) throw new Error("[ImaFilesApi] createMedia: empty media_id or cos_credential");
		emit("createMedia", 10);
		throwIfAborted();
		emit("cosPut", 10, {
			loaded: 0,
			total: fileSize
		});
		await this.uploadToCos(created.cos_credential, buffer, contentType, (info) => {
			emit("cosPut", 10 + info.percent * 85, {
				loaded: info.loaded,
				total: info.total
			});
		});
		emit("cosPut", 95, {
			loaded: fileSize,
			total: fileSize
		});
		throwIfAborted();
		emit("addKnowledge", 95);
		await this.addKnowledge({
			mediaId: created.media_id,
			knowledgeBaseId: params.kbId,
			folderId: params.folderId
		});
		emit("addKnowledge", 100);
		return {
			fileId: created.media_id,
			kbId: params.kbId,
			folderId: params.folderId ?? null,
			name: filename,
			size: fileSize
		};
	}
};
/**
* 把 `file:///...` URL 形式的路径转成本地文件系统路径。
*/
function normalizeLocalPath(input) {
	if (!input) return input;
	if (input.startsWith("file://")) try {
		return (0, url.fileURLToPath)(input);
	} catch {
		return input.replace(/^file:\/{2,3}/, "/");
	}
	return input;
}
//#endregion
//#region ../../packages/workbuddy-server/src/ima/api/kb-api.ts
var ImaKnowledgeBaseApi = class {
	constructor(client) {
		this.client = client;
	}
	async list(params = {}) {
		const types = params.types && params.types.length > 0 ? params.types : [
			1001,
			1002,
			1004,
			1005
		];
		const limit = params.limit ?? 20;
		const cursors = params.cursors ?? {};
		const imaParams = types.map((type) => ({
			type,
			cursor: cursors[type] ?? "",
			limit
		}));
		return { groups: transformResults((await this.client.post("/openapi/knowledge_base/v1/get_knowledge_base_list", { params: imaParams })).results) };
	}
	/**
	* 按关键词搜索当前用户可见范围内的知识库。
	*
	* 底层调用 IMA `POST /openapi/knowledge_base/v1/search_knowledge_base`。
	* 响应体为 `{ info_list, is_end, next_cursor }`，UI 侧只消费 camelCase
	* 归一后的 `{ items, nextCursor, isEnd }`。
	*/
	async search(params) {
		const body = {
			query: params.query,
			cursor: params.cursor ?? "",
			limit: Math.max(1, Math.min(20, params.limit ?? 20))
		};
		const raw = await this.client.post("/openapi/knowledge_base/v1/search_knowledge_base", body);
		return {
			items: (raw.info_list ?? []).map(transformSearchItem),
			nextCursor: raw.next_cursor || null,
			isEnd: raw.is_end ?? true
		};
	}
	/**
	* 通过分享链接获取知识库信息（名称、封面等）。
	*
	* 底层调用 IMA `POST /openapi/knowledge_base/v1/get_knowledge_base_info_by_share_link`。
	* 用于粘贴链接后 resolve chip 标题。
	*/
	async getInfoByShareLink(shareLink) {
		try {
			const info = (await this.client.post("/openapi/knowledge_base/v1/get_knowledge_base_info_by_share_link", { share_link: shareLink })).knowledge_base_info;
			if (!info?.basic_info?.name) return null;
			return {
				name: info.basic_info.name,
				id: info.id ?? "",
				coverUrl: info.basic_info.cover_url || void 0
			};
		} catch {
			return null;
		}
	}
};
function transformSearchItem(raw) {
	return {
		id: raw.id ?? "",
		name: raw.name ?? "",
		highlightName: raw.highlight_name,
		coverUrl: raw.cover_url,
		type: raw.type
	};
}
/**
* 把 IMA 原始 `results[]` 转换为 `KnowledgeBaseGroup[]`。
*/
function transformResults(results) {
	if (!Array.isArray(results)) return [];
	return results.filter((r) => r && typeof r === "object").map((r) => ({
		type: r.type,
		typeName: r.knowledge_base_list_name ?? "",
		items: (r.knowledge_base_list ?? []).map(transformKbItem),
		nextCursor: r.next_cursor || null,
		isEnd: r.is_end ?? true
	}));
}
/**
* 把 IMA 原始 knowledge_base_list 条目转为内部 `ImaKnowledgeBase`。
*/
function transformKbItem(raw) {
	const info = raw.basic_info ?? {};
	return {
		id: raw.id,
		name: info.name ?? "",
		description: info.description ?? void 0,
		coverUrl: info.cover_url ?? void 0,
		coverBackgroundColor: info.cover_background_color,
		size: info.size ? Number(info.size) : void 0,
		fileCount: info.knowledge_total_size ? Number(info.knowledge_total_size) : 0,
		creator: info.creator ? {
			nickname: info.creator.nickname ?? "",
			avatarUrl: info.creator.avatar_url
		} : void 0,
		memberCount: raw.member_info?.member_count,
		permissions: {
			accessStatus: raw.permission_info?.access_status ?? 0,
			visibleExportStatus: raw.permission_info?.visible_export_status,
			joinType: raw.permission_info?.join_type,
			roleType: raw.user_permission_info?.role_type,
			canAddKnowledge: raw.user_permission_info?.can_add_knowledge
		},
		isTop: raw.is_top,
		statistics: raw.statistics ? { viewAndQa: raw.statistics.view_and_qa } : void 0,
		paymentInfo: raw.payment_info
	};
}
//#endregion
//#region ../../packages/workbuddy-server/src/ima/auth-event-emitter.ts
var ImaAuthEventEmitter = class {
	constructor() {
		this.listeners = /* @__PURE__ */ new Set();
		this.lastValue = void 0;
	}
	/** 订阅。返回 Disposable。 */
	on(cb) {
		this.listeners.add(cb);
		return { dispose: () => this.listeners.delete(cb) };
	}
	/** 触发事件（去重：连续相同值不重复派发） */
	emit(authed) {
		if (this.lastValue === authed) return;
		this.lastValue = authed;
		for (const cb of this.listeners) try {
			cb(authed);
		} catch {}
	}
	/** 仅当状态真正变化才触发；外部也可直接 emit。 */
	getLast() {
		return this.lastValue;
	}
	dispose() {
		this.listeners.clear();
	}
};
var ImaUploadEventEmitter = class {
	constructor() {
		this.listeners = /* @__PURE__ */ new Set();
	}
	on(cb) {
		this.listeners.add(cb);
		return { dispose: () => this.listeners.delete(cb) };
	}
	emit(payload) {
		for (const cb of this.listeners) try {
			cb(payload);
		} catch {}
	}
	dispose() {
		this.listeners.clear();
	}
};
//#endregion
//#region ../../packages/workbuddy-server/src/ima/ima-service.ts
var ImaService = class {
	constructor(options) {
		this.authEvents = new ImaAuthEventEmitter();
		this.uploadEvents = new ImaUploadEventEmitter();
		const client = options.client;
		this.auth = new ImaAuthApi(client, {
			productManager: options.productManager,
			authenticationManager: options.authenticationManager,
			fetchFn: options.fetchFn
		});
		this.kb = new ImaKnowledgeBaseApi(client);
		this.files = new ImaFilesApi(client, { fetchFn: options.fetchFn });
	}
	/** 订阅授权状态变化事件。 */
	onAuthChanged(cb) {
		return this.authEvents.on(cb);
	}
	/**
	* 主动触发授权状态广播（供 deep link handler / postMessage 桥调用）。
	* 内部会去重，相同值不会重复通知。
	*/
	notifyAuthChanged(authed) {
		this.authEvents.emit(authed);
	}
	/** 获取最近一次广播的状态，未广播时返回 undefined。 */
	getLastAuthState() {
		return this.authEvents.getLast();
	}
	/** 订阅「保存到 ima 知识库」的上传链路进度事件。 */
	onUploadProgress(cb) {
		return this.uploadEvents.on(cb);
	}
	/** 主动触发上传进度事件（由 ImaFilesApi.uploadByPath 回调驱动）。 */
	notifyUploadProgress(payload) {
		this.uploadEvents.emit(payload);
	}
	dispose() {
		this.authEvents.dispose();
		this.uploadEvents.dispose();
	}
};
//#endregion
//#region ../../packages/workbuddy-core/src/wb/boundary/permission/authorization.ts
/**
* WB Bridge 统一授权。
*
* 本文件定义授权运行时、标准化数据结构，以及 **调用上下文（`InvokeContext`）与
* 宿主常量**——这两个概念天然归属"授权/身份"域：
* - `InvokeContext.callerId` 决定 host / guest 分派
* - `InvokeContext.subject` 是 `BridgeSubject` 的携带体，参与 `BridgeAuthorizer` 决策
* - `HOST_MODULE_ID` / `HOST_SUBJECT` 是两个宿主常量
*
* transport 层与 bridge 层都从本文件消费这些类型，避免"授权数据结构分散在 types.ts /
* authorization.ts 两处"的历史包袱。
*/
/** 宿主的 moduleId 常量。`callerId === HOST_MODULE_ID` 时视为进程内部调用，无授权检查。 */
var HOST_MODULE_ID = "__host__";
/** 精确、namespace 前缀和全通配匹配。 */
function matchBridgePattern(value, patterns) {
	for (const pattern of patterns) {
		if (pattern === "*") return true;
		if (pattern.endsWith(":*") && value.startsWith(pattern.slice(0, -1))) return true;
		if (pattern === value) return true;
	}
	return false;
}
function getAllowPatterns(action, layer) {
	return action.type === "invoke" ? layer.invokes : layer.events;
}
function getDenyPatterns(action, layer) {
	return action.type === "invoke" ? layer.denyInvokes ?? [] : layer.denyEvents ?? [];
}
function getActionResource(action) {
	return action.type === "invoke" ? action.channel : action.event;
}
function isDenied(action, layer) {
	return matchBridgePattern(getActionResource(action), getDenyPatterns(action, layer));
}
function isAllowed(action, layer) {
	if (layer.inheritBase) return true;
	return matchBridgePattern(getActionResource(action), getAllowPatterns(action, layer));
}
function createPermissionDeniedError(request, reason) {
	const resource = getActionResource(request.action);
	const error = /* @__PURE__ */ new Error(`[WBBridge] PERMISSION_DENIED: subject "${request.subject.moduleId}" cannot ${request.action.type} "${resource}" (${reason})`);
	error.code = "PERMISSION_DENIED";
	return error;
}
/** 创建唯一授权决策器；所有配置来源先适配为 BridgeAuthorizationProvider。 */
function createBridgeAuthorizer(provider) {
	const authorize = async (request) => {
		const { subject, action } = request;
		if (subject.type === "host" && subject.moduleId === "__host__") return {
			allowed: true,
			reason: "HOST"
		};
		const exposure = await provider.getExposure(action) ?? "host-only";
		if (exposure === "host-only") return {
			allowed: false,
			reason: "HOST_ONLY"
		};
		if (exposure === "public") return {
			allowed: true,
			reason: "PUBLIC"
		};
		const base = await provider.getBaseGrant(subject);
		if (!base) return {
			allowed: false,
			reason: "MISSING_BASE_GRANT"
		};
		if (isDenied(action, base)) return {
			allowed: false,
			reason: "EXPLICIT_DENY",
			matchedLayers: [base.id]
		};
		if (!isAllowed(action, base)) return {
			allowed: false,
			reason: "MISSING_GRANT",
			matchedLayers: [base.id]
		};
		const matchedLayers = [base.id];
		for (const scope of subject.scopes) {
			const layer = await provider.getScopeGrant(subject, scope);
			if (!layer) return {
				allowed: false,
				reason: "MISSING_SCOPE_GRANT",
				matchedLayers
			};
			matchedLayers.push(layer.id);
			if (isDenied(action, layer)) return {
				allowed: false,
				reason: "EXPLICIT_DENY",
				matchedLayers
			};
			if (!isAllowed(action, layer)) return {
				allowed: false,
				reason: "MISSING_GRANT",
				matchedLayers
			};
		}
		return {
			allowed: true,
			reason: "GRANTED",
			matchedLayers
		};
	};
	return {
		authorize,
		async assertAuthorized(request) {
			const decision = await authorize(request);
			if (!decision.allowed) throw createPermissionDeniedError(request, decision.reason);
		}
	};
}
//#endregion
//#region ../../packages/workbuddy-core/src/wb/boundary/permission/registry.ts
/**
* 把声明格式（`'skills.list'`）展开为 core channel pattern（`'wb:skills:list'`）。
*
* 规则：
* - `'*'` → `'*'`（**仅 builtin**，其余 kind 抛错）
* - `'skills.list'` → `'wb:skills:list'`（精确接口）
* - `'skills.marketplace.builtin.list'` → `'wb:skills.marketplace.builtin:list'`（嵌套 namespace）
* - `'skills'`（裸 namespace）→ **抛错**（避免新接口自动放行）
*/
function expandPermission(perm, kind) {
	if (perm === "*") {
		if (kind !== "builtin") throw new Error(`[Permission] "*" only allowed for builtin subjects, got kind="${kind}"`);
		return "*";
	}
	if (!perm.includes(".")) throw new Error(`[Permission] namespace-only permission "${perm}" is not allowed. Specify exact method like "${perm}.method".`);
	const lastDot = perm.lastIndexOf(".");
	return `wb:${perm.slice(0, lastDot)}:${perm.slice(lastDot + 1)}`;
}
/** 组合 subject 主键：不同 type 的同名 moduleId 不撞库 */
function subjectKey(type, moduleId) {
	return `${type}:${moduleId}`;
}
/**
* 全局权限注册表 —— 同时管理 subject base permissions 与 surface scope grants。
*
* 生命周期：
* - Subject 注册：extension registry / iframe 装配 / window 装配处，主体加载时 register，卸载时 unregister
* - Surface 注册：容器装配层，surface 挂载时 register，卸载时 unregister
* - 二者独立管理，不做级联
*
* 用法：
* ```ts
* const permissions = new PermissionRegistry();
* permissions.registerSubject({
*   moduleId: 'workbuddy-industry-hr',
*   type: 'extension',
*   kind: 'platform',
*   permissions: ['skills.list', 'conversations.list'],
* });
* permissions.registerSurface({
*   surface: 'surface:chat-panel',
*   invokes: ['wb:conversations:*'],
* });
*
* const authorizer = createBridgeAuthorizer(permissions.toProvider());
* ```
*/
var PermissionRegistry = class {
	subjects = /* @__PURE__ */ new Map();
	surfaces = /* @__PURE__ */ new Map();
	registerSubject(entry) {
		for (const perm of entry.permissions) expandPermission(perm, entry.kind);
		this.subjects.set(subjectKey(entry.type, entry.moduleId), entry);
	}
	unregisterSubject(type, moduleId) {
		this.subjects.delete(subjectKey(type, moduleId));
	}
	getSubject(type, moduleId) {
		return this.subjects.get(subjectKey(type, moduleId));
	}
	listSubjects() {
		return Array.from(this.subjects.values());
	}
	registerSurface(entry) {
		this.surfaces.set(entry.surface, entry);
	}
	unregisterSurface(surface) {
		this.surfaces.delete(surface);
	}
	getSurface(surface) {
		return this.surfaces.get(surface);
	}
	listSurfaces() {
		return Array.from(this.surfaces.values());
	}
	/**
	* 转成 `BridgeAuthorizationProvider`，接入 `createBridgeAuthorizer`。
	*
	* - `getExposure`：默认所有 channel `grantable`；具体 `host-only` / `public` 由装配层
	*   在 authorizer 上层包装或另注册（当前 P1 阶段不细分）
	* - `getBaseGrant`：从 subject registry 查 → 展开 → 生成 base layer；builtin 直接 `inheritBase: true`
	* - `getScopeGrant`：从 surface registry 查 → 生成 scope layer；查不到返回 undefined
	*   （authorizer 会以 `MISSING_SCOPE_GRANT` 拒绝，符合"未声明 = 拒绝"原则）
	*/
	toProvider() {
		return {
			getExposure: (_action) => "grantable",
			getBaseGrant: (subject) => {
				const entry = this.subjects.get(subjectKey(subject.type, subject.moduleId));
				if (!entry) return;
				const hasWildcard = entry.permissions.includes("*");
				if (entry.kind === "builtin" && hasWildcard) return {
					id: `builtin:${entry.moduleId}`,
					invokes: ["*"],
					events: ["*"],
					inheritBase: true
				};
				const invokes = entry.permissions.map((p) => expandPermission(p, entry.kind));
				return {
					id: `${entry.kind}:${entry.moduleId}`,
					invokes,
					events: invokes
				};
			},
			getScopeGrant: (_subject, scope) => {
				const entry = this.surfaces.get(scope);
				if (!entry) return;
				return {
					id: entry.surface,
					invokes: entry.invokes,
					events: entry.events ?? entry.invokes,
					denyInvokes: entry.denyInvokes,
					denyEvents: entry.denyEvents
				};
			}
		};
	}
};
//#endregion
//#region src/main/system/platform/ioa-machine-detector.ts
/**
* IOA Machine Detector (main process).
*
* Detects whether the host machine has a valid Tencent IOA client installed
* by checking filesystem paths and verifying code signatures.
*
* - Mac: /Applications/iOA/iOA.app + codesign team ID 88L2Q4487U
* - Windows: iOABiz service + service/registry path + Authenticode signature
* - Linux: always false (no IOA client for Linux)
*
* Result is cached for the process lifetime (detection runs at most once).
* All errors are swallowed — detection failure = not an IOA machine.
*
* This stays in the Electron desktop package as a host capability; channel
* restriction policy lives in workbuddy-server.
*/
var execFile = (0, node_util.promisify)(node_child_process.execFile);
/** Expected codesign team identifier for Tencent IOA on macOS. */
var MACOS_IOA_TEAM_ID = "88L2Q4487U";
/** Expected path for IOA app on macOS. */
var MACOS_IOA_PATH = "/Applications/iOA/iOA.app";
/** Expected signer subject substring for Windows Authenticode. */
var WIN_SIGNER_SUBJECT = "Tencent Technology (Shenzhen) Company Limited";
/** Windows service name for the IOA business client. */
var WIN_IOA_SERVICE_NAME = "iOABiz";
/** Windows IOA business executable name. */
var WIN_IOA_EXE_NAME = "iOABiz.exe";
/** Registry keys for IOA client install directory on Windows. */
var WIN_IOA_REGISTRY_KEYS = ["HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\ioaclient", "HKEY_LOCAL_MACHINE\\SOFTWARE\\ioaclient"];
var WIN_SERVICE_PATH_COMMAND = [
	`$service = Get-CimInstance -ClassName Win32_Service -Filter "Name='${WIN_IOA_SERVICE_NAME}'" -ErrorAction SilentlyContinue`,
	"if ($null -eq $service) { exit 1 }",
	"$service.PathName"
].join("; ");
var WIN_SIGNATURE_SUBJECT_COMMAND = [
	"$sig = Get-AuthenticodeSignature -LiteralPath $env:WB_IOA_EXE_PATH",
	"if ($sig.Status -ne \"Valid\" -or $null -eq $sig.SignerCertificate) { exit 1 }",
	"$sig.SignerCertificate.Subject"
].join("; ");
var cached;
/**
* Detect whether the current machine has a valid IOA client installed.
* Result is cached — subsequent calls return immediately.
*/
async function detectIOAMachine() {
	if (cached !== void 0) return cached;
	try {
		if (process.platform === "darwin") cached = await detectIOAMacOS();
		else if (process.platform === "win32") cached = await detectIOAWindows();
		else cached = false;
	} catch {
		cached = false;
	}
	return cached;
}
async function detectIOAMacOS() {
	if (!node_fs.existsSync(MACOS_IOA_PATH)) return false;
	try {
		await execFile("codesign", [
			"--verify",
			"--verbose=0",
			MACOS_IOA_PATH
		], { timeout: 5e3 });
	} catch {
		return false;
	}
	try {
		const { stderr } = await execFile("codesign", [
			"-d",
			"--verbose=2",
			MACOS_IOA_PATH
		], { timeout: 5e3 });
		return stderr.includes(MACOS_IOA_TEAM_ID);
	} catch {
		return false;
	}
}
async function detectIOAWindows() {
	if (!await isWindowsIOABizServiceInstalled()) return false;
	const serviceExePath = await readWindowsIOABizServiceExePath();
	if (serviceExePath && await isValidWindowsIOAExecutable(serviceExePath)) return true;
	for (const registryKey of WIN_IOA_REGISTRY_KEYS) {
		const installDir = await readWindowsIOAInstallDir(registryKey);
		if (!installDir) continue;
		if (await isValidWindowsIOAExecutable(`${installDir}\\${WIN_IOA_EXE_NAME}`)) return true;
	}
	return false;
}
async function isWindowsIOABizServiceInstalled() {
	try {
		await execFile("sc.exe", ["query", WIN_IOA_SERVICE_NAME], {
			timeout: 5e3,
			windowsHide: true
		});
		return true;
	} catch {
		return false;
	}
}
async function readWindowsIOABizServiceExePath() {
	try {
		const { stdout } = await execFile("powershell", [
			"-NoProfile",
			"-NonInteractive",
			"-Command",
			WIN_SERVICE_PATH_COMMAND
		], {
			timeout: 5e3,
			windowsHide: true
		});
		return parseWindowsExecutablePath(stdout);
	} catch {
		return;
	}
}
async function readWindowsIOAInstallDir(registryKey) {
	try {
		const { stdout } = await execFile("reg", [
			"query",
			registryKey,
			"/v",
			"InstallDir"
		], {
			timeout: 5e3,
			windowsHide: true
		});
		return stdout.match(/InstallDir\s+REG_SZ\s+(.+)/i)?.[1]?.trim() || void 0;
	} catch {
		return;
	}
}
async function isValidWindowsIOAExecutable(exePath) {
	if (!node_fs.existsSync(exePath)) return false;
	try {
		const { stdout } = await execFile("powershell", [
			"-NoProfile",
			"-NonInteractive",
			"-Command",
			WIN_SIGNATURE_SUBJECT_COMMAND
		], {
			timeout: 1e4,
			windowsHide: true,
			env: {
				...process.env,
				WB_IOA_EXE_PATH: exePath
			}
		});
		return stdout.includes(WIN_SIGNER_SUBJECT);
	} catch {
		return false;
	}
}
function parseWindowsExecutablePath(value) {
	const pathText = value.trim();
	if (!pathText) return;
	const quoted = pathText.match(/^"([^"]+?\.exe)"/i);
	if (quoted?.[1]) return quoted[1].trim();
	return pathText.match(/^(.+?\.exe)(?:\s|$)/i)?.[1]?.trim() || void 0;
}
//#endregion
//#region src/main/daemon/app-server/celljs-deps.ts
function resolveCellJSDeps(container, options) {
	return require_server.resolveWorkbuddyAppServerCellJSDeps(container, {
		database: options.database,
		getColorScheme: options.getColorScheme,
		sessionEvents: {
			onSessionUpsert: (session) => {
				options.windowManager.broadcast("session:upserted", session);
			},
			onSessionDeleted: (payload) => {
				options.windowManager.broadcast("session:deleted", payload);
			}
		},
		runtime: {
			getAppName: require_runtime_context.getWorkbuddyRuntimeAppName,
			getAppVersion: require_runtime_context.getWorkbuddyRuntimeAppVersion,
			getUserDataDir: require_runtime_context.getWorkbuddyRuntimeUserDataDir
		},
		i18n: {
			getMenuLocale: require_menu_i18n.getMenuLocale,
			translateAutomationTestMessage: require_menu_i18n.getRendererTranslation
		},
		createImaService: ({ logger, productManager, authenticationManager }) => {
			return new ImaService({
				client: new ImaBackendClient({
					logger: {
						info: (message, ...args) => logger.info(String(message), ...args),
						warn: (message, ...args) => logger.warn(String(message), ...args),
						error: (message, ...args) => logger.error(String(message), ...args),
						debug: (message, ...args) => logger.debug(String(message), ...args)
					},
					productManager,
					authenticationManager
				}),
				productManager,
				authenticationManager
			});
		},
		getCoordinator: (celljs) => celljs.get(require_tls_verification.WorkbuddyAuthProductCoordinator),
		waitUntilExecutionReady: (coordinator) => coordinator.waitRemoteReady(),
		detectIOAMachine
	});
}
//#endregion
//#region ../../packages/workbuddy-server/src/net/pac-rpc-service.ts
require_common$1.init_common$3();
var import_src = /* @__PURE__ */ require_chunk.__toESM(require_src$1.require_src());
require_common$1.init_common$2();
require_workbuddy_product_config.init_bundled_assets();
require_dev_env_override.init_dev_env_override();
require_workbuddy_product_config.init_workbuddy_product_config();
require_workbuddy_paths.init_workbuddy_paths();
var import_adm_zip = /* @__PURE__ */ require_chunk.__toESM(require_adm_zip$1.require_adm_zip());
require_client_info_env.init_src();
/**
* Daemon-local PAC reverse-lookup service（#57186 / Phase 2）。
*
* 用途：让 CLI sidecar / hosted CLI runtime 子进程在请求时反查 daemon→main 的
* Chromium PAC 引擎（`session.defaultSession.resolveProxy`），完整识别企业 PAC
* 脚本的 per-URL 决策（含 DIRECT / shExpMatch / isInNet / myIpAddress / dnsResolve）。
*
* 通道选择：**OS 原生 IPC（Unix Domain Socket / Windows Named Pipe）**，不走 TCP。
*   - 不经过 IP 栈 → 企业防火墙 / EDR / PAC 脚本完全看不到（它们检查 IP 流量）
*   - 文件权限（Unix 0600 / Windows 命名管道 ACL）天然限制为当前用户可访问
*   - 无端口竞争、无端口扫描风险
*
* 设计：
*   - macOS/Linux: `os.tmpdir()/workbuddy-pac-<pid>-<rand>.sock` + listen 后 chmod 0600
*   - Windows:     `\\.\pipe\workbuddy-pac-<pid>-<rand>`（命名管道，进程级 ACL 隔离）
*   - 路由：`GET /pac/resolve?url=<encoded>`（HTTP over IPC，单一 endpoint）
*   - 鉴权：`Authorization: Bearer <token>` —— 额外纵深防御，防同用户下其它进程
*     精准命中我们的 socket 路径后乱调；token 进程级随机，不落盘
*   - 超时保护：默认 2s，超时返回 500（调用方降级到 L1-L4）
*
* 失败语义：
*   - resolver 抛错 / 超时 → 500 + text/plain 错误体；CLI 端 fallback 到 L1-L4
*   - 未启动 / socket 路径不可写 → 不阻断 daemon 启动，CLI 读不到 env → 跳过 L0
*/
/** Env 字段名 — 与 ProxyResolver 自动注入逻辑保持契约一致。 */
var PAC_RPC_SOCKET_ENV = "WORKBUDDY_PAC_RPC_SOCKET";
var PAC_RPC_TOKEN_ENV = "WORKBUDDY_PAC_RPC_TOKEN";
var DEFAULT_TIMEOUT_MS = 3e4;
var SOCKET_PREFIX = "workbuddy-pac";
/**
* 启动 PAC RPC service。失败不抛，返回 undefined 让调用方继续走 env-fallback。
*
* 幂等性：调用方应自行管理 handle 生命周期；多次调用会启多个独立 server。
*/
async function startPacRpcService(resolver, options = {}) {
	const log = options.logger ?? console;
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const token = generateToken();
	const socketPath = options.socketPath ?? generateSocketPath();
	return new Promise((resolve) => {
		const server = http.createServer((req, res) => {
			handleRequest(req, res, resolver, token, timeoutMs).catch((err) => {
				log.warn?.(`[PacRpc] request failed: ${String(err)}`);
				if (!res.headersSent) {
					res.statusCode = 500;
					res.setHeader("Content-Type", "text/plain; charset=utf-8");
					res.end(`pac rpc error: ${err instanceof Error ? err.message : String(err)}`);
				}
			});
		});
		server.once("error", (err) => {
			log.warn?.(`[PacRpc] failed to start (non-fatal): ${String(err)}`);
			resolve(void 0);
		});
		if (process.platform !== "win32") try {
			fs.unlinkSync(socketPath);
		} catch {}
		server.listen(socketPath, () => {
			if (process.platform !== "win32") try {
				fs.chmodSync(socketPath, 384);
			} catch (chmodErr) {
				log.warn?.(`[PacRpc] chmod failed (non-fatal): ${String(chmodErr)}`);
			}
			log.info?.(`[PacRpc] listening on ${socketPath}`);
			resolve({
				socketPath,
				token,
				close: () => closeServer(server, socketPath)
			});
		});
	});
}
async function closeServer(server, socketPath) {
	await new Promise((r) => server.close(() => r()));
	if (process.platform !== "win32") try {
		fs.unlinkSync(socketPath);
	} catch {}
}
async function handleRequest(req, res, resolver, expectedToken, timeoutMs) {
	if (req.method !== "GET") {
		res.statusCode = 405;
		res.setHeader("Allow", "GET");
		res.end("method not allowed");
		return;
	}
	const url = new URL(req.url ?? "", "http://localhost");
	if (url.pathname !== "/pac/resolve") {
		res.statusCode = 404;
		res.end("not found");
		return;
	}
	const auth = req.headers["authorization"];
	if (typeof auth !== "string" || !auth.startsWith("Bearer ")) {
		res.statusCode = 401;
		res.end("missing bearer token");
		return;
	}
	if (!safeEqual(auth.slice(7).trim(), expectedToken)) {
		res.statusCode = 401;
		res.end("invalid token");
		return;
	}
	const targetUrl = url.searchParams.get("url");
	if (!targetUrl) {
		res.statusCode = 400;
		res.end("missing url");
		return;
	}
	const rule = await withTimeout(Promise.resolve(resolver(targetUrl)), timeoutMs, /* @__PURE__ */ new Error(`pac resolver timed out after ${timeoutMs}ms`));
	res.statusCode = 200;
	res.setHeader("Content-Type", "text/plain; charset=utf-8");
	res.setHeader("Cache-Control", "no-store");
	res.end(typeof rule === "string" ? rule : "DIRECT");
}
function generateToken() {
	return crypto.randomBytes(24).toString("base64url");
}
/**
* 生成 socket 路径：
*   - Windows: `\\.\pipe\workbuddy-pac-<pid>-<rand>` （命名管道）
*   - POSIX:   `<tmpdir>/workbuddy-pac-<pid>-<rand>.sock` （Unix domain socket）
*
* 用 PID + 8 字节随机后缀，避免同机多实例冲突；POSIX 平台还会在 listen 前清理同名残留。
*/
function generateSocketPath() {
	const rand = crypto.randomBytes(8).toString("hex");
	if (process.platform === "win32") return `\\\\.\\pipe\\${SOCKET_PREFIX}-${process.pid}-${rand}`;
	return path.join(os.tmpdir(), `${SOCKET_PREFIX}-${process.pid}-${rand}.sock`);
}
function safeEqual(a, b) {
	const ab = Buffer.from(a);
	const bb = Buffer.from(b);
	if (ab.length !== bb.length) return false;
	return crypto.timingSafeEqual(ab, bb);
}
function withTimeout(p, ms, error) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(error), ms);
		p.then((value) => {
			clearTimeout(timer);
			resolve(value);
		}, (err) => {
			clearTimeout(timer);
			reject(err);
		});
	});
}
//#endregion
//#region src/main/system/runtime/proxy-env.ts
var DEFAULT_PROXY_TARGET_URL = "https://copilot.tencent.com";
var proxyEnvLog = {
	info: (...args) => console.info(...args),
	warn: (...args) => console.warn(...args)
};
var USE_SYSTEM_CA_NODE_OPTION = "--use-system-ca";
function getProxyEnvFromProcess() {
	const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
	const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
	const env = {};
	if (httpProxy) env.HTTP_PROXY = httpProxy;
	if (httpsProxy) env.HTTPS_PROXY = httpsProxy;
	if (httpProxy || httpsProxy) {
		env.NO_PROXY = require_proxy_env.mergeNoProxy(process.env.NO_PROXY || process.env.no_proxy);
		if (process.env.WORKBUDDY_PROXY_SOURCE) env.WORKBUDDY_PROXY_SOURCE = process.env.WORKBUDDY_PROXY_SOURCE;
	}
	const pacSocket = process.env[PAC_RPC_SOCKET_ENV];
	const pacToken = process.env[PAC_RPC_TOKEN_ENV];
	if (pacSocket && pacToken) {
		env.WORKBUDDY_PAC_RPC_SOCKET = pacSocket;
		env.WORKBUDDY_PAC_RPC_TOKEN = pacToken;
	}
	return env;
}
function getProxyEnvFromElectronProxyRules(proxyRules) {
	const resolvedProxy = parseElectronProxyRules(proxyRules);
	const pacEnv = {};
	const pacSocket = process.env[PAC_RPC_SOCKET_ENV];
	const pacToken = process.env[PAC_RPC_TOKEN_ENV];
	if (pacSocket && pacToken) {
		pacEnv.WORKBUDDY_PAC_RPC_SOCKET = pacSocket;
		pacEnv.WORKBUDDY_PAC_RPC_TOKEN = pacToken;
	}
	if (!resolvedProxy) return pacEnv;
	return {
		HTTP_PROXY: resolvedProxy,
		HTTPS_PROXY: resolvedProxy,
		NO_PROXY: require_proxy_env.mergeNoProxy(process.env.NO_PROXY || process.env.no_proxy),
		WORKBUDDY_PROXY_SOURCE: "system",
		...pacEnv
	};
}
async function resolveProxyEnv(targetUrl = DEFAULT_PROXY_TARGET_URL, proxyRulesResolver) {
	const explicitEnv = getProxyEnvFromProcess();
	if (hasProxy(explicitEnv)) {
		proxyEnvLog.info(`[WorkBuddyProxy] Using proxy from environment: ${describeProxyEnv(explicitEnv)}`);
		return explicitEnv;
	}
	if (!proxyRulesResolver) return {};
	try {
		const proxyRules = await proxyRulesResolver.resolveProxy(targetUrl);
		const proxyEnv = getProxyEnvFromElectronProxyRules(proxyRules);
		if (!hasProxy(proxyEnv)) {
			const message = `[WorkBuddyProxy] No supported system proxy resolved for ${targetUrl}: ${describeProxyRulesForLog(proxyRules)}`;
			if (isDirectProxyRules(proxyRules)) proxyEnvLog.info(message);
			else proxyEnvLog.warn(message);
			return {};
		}
		proxyEnvLog.info(`[WorkBuddyProxy] Using system proxy: ${sanitizeProxyForLog(proxyEnv.HTTP_PROXY)}`);
		return proxyEnv;
	} catch (error) {
		proxyEnvLog.warn(`[WorkBuddyProxy] Failed to resolve system proxy for ${targetUrl}: ${formatErrorForLog(error)}`);
		return {};
	}
}
function hasProxy(env) {
	return Boolean(env.HTTP_PROXY || env.HTTPS_PROXY);
}
function isDirectProxyRules(proxyRules) {
	return proxyRules.split(";").every((rule) => {
		const normalizedRule = rule.trim().toUpperCase();
		return !normalizedRule || normalizedRule === "DIRECT";
	});
}
function parseElectronProxyRules(proxyRules) {
	for (const rawRule of proxyRules.split(";")) {
		const rule = rawRule.trim();
		if (!rule || rule.toUpperCase() === "DIRECT") continue;
		const [type, value] = rule.split(/\s+/, 2);
		if (!value) continue;
		const normalizedType = type.toUpperCase();
		let proxyUrl;
		if (normalizedType === "PROXY" || normalizedType === "HTTP") proxyUrl = normalizeProxyUrl(value, "http");
		else if (normalizedType === "HTTPS") proxyUrl = normalizeProxyUrl(value, "https");
		if (proxyUrl) return proxyUrl;
	}
}
function normalizeProxyUrl(value, defaultProtocol) {
	const candidate = value.includes("://") ? value : `${defaultProtocol}://${value}`;
	try {
		const parsed = new URL(candidate);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
		return parsed.toString();
	} catch {
		return;
	}
}
function describeProxyEnv(env) {
	const parts = [];
	if (env.HTTP_PROXY) parts.push(`HTTP_PROXY=${sanitizeProxyForLog(env.HTTP_PROXY)}`);
	if (env.HTTPS_PROXY) parts.push(`HTTPS_PROXY=${sanitizeProxyForLog(env.HTTPS_PROXY)}`);
	if (env.NO_PROXY) parts.push("NO_PROXY=present");
	if (env.NODE_OPTIONS?.includes(USE_SYSTEM_CA_NODE_OPTION)) parts.push(`NODE_OPTIONS=${USE_SYSTEM_CA_NODE_OPTION}`);
	return parts.join(", ");
}
function describeProxyRulesForLog(proxyRules) {
	if (!proxyRules) return "empty";
	return proxyRules.split(";").map((rule) => {
		const trimmed = rule.trim();
		const [type, value] = trimmed.split(/\s+/, 2);
		return value ? `${type} ${sanitizeProxyForLog(value)}` : trimmed;
	}).join("; ");
}
function sanitizeProxyForLog(proxyUrl) {
	try {
		const candidate = proxyUrl.includes("://") ? proxyUrl : `http://${proxyUrl}`;
		const parsed = new URL(candidate);
		parsed.username = "";
		parsed.password = "";
		return proxyUrl.includes("://") ? parsed.toString() : parsed.host;
	} catch {
		return "<invalid-proxy-url>";
	}
}
function formatErrorForLog(error) {
	if (error instanceof Error) return `${error.name}: ${error.message}`;
	return String(error);
}
//#endregion
//#region ../../packages/history-migration/src/common/core/errors.ts
/**
* 迁移错误基类
*/
var MigrationError = class MigrationError extends Error {
	constructor(message, code, severity, rollbackable) {
		super(message);
		this.code = code;
		this.severity = severity || "fatal";
		this.rollbackable = rollbackable || false;
		this.timestamp = Date.now();
		Object.setPrototypeOf(this, MigrationError.prototype);
	}
};
/**
* 配置错误 - 迁移配置不有效
*/
var ConfigError = class ConfigError extends MigrationError {
	constructor(message, details) {
		super(message, "CONFIG_ERROR", "fatal", false);
		this.details = details;
		Object.setPrototypeOf(this, ConfigError.prototype);
	}
};
//#endregion
//#region ../../packages/history-migration/src/common/core/constants.ts
/**
* 历史记录迁移常量定义
*/
var CONSTANTS = {
	TIME: {
		CACHE_TTL: 1e3 * 60 * 5,
		OPERATION_TIMEOUT: 3e4,
		RETRY_TIMEOUT: 5e3
	},
	SIZE: {
		MAX_BLOB_SIZE: 104857600,
		MAX_MESSAGE_SIZE: 10485760,
		MAX_CACHE_SIZE: 1e3
	},
	CONCURRENCY: {
		PARALLEL_CONVERSIONS: 3,
		PARALLEL_VERIFICATIONS: 2
	},
	RETRY: {
		MAX_ATTEMPTS: 3,
		INITIAL_DELAY: 100,
		MAX_DELAY: 5e3,
		BACKOFF_MULTIPLIER: 2
	},
	PATHS: {
		CODEBUDDY_BASE: ".codebuddy",
		SESSIONS_DIR: "projects",
		FILE_HISTORY_DIR: "file-history",
		BLOBS_DIR: "blobs",
		TODOS_DIR: "todos",
		TASKS_DIR: "tasks",
		BACKUP_DIR: "backup",
		MIGRATION_HISTORY_DIR: ".migration-history",
		MIGRATION_STATE_FILE: ".migration-state.json"
	},
	FILES: {
		SESSION_EXT: ".jsonl",
		META_FILE: ".meta.json"
	}
};
CONSTANTS.SIZE.MAX_BLOB_SIZE, CONSTANTS.SIZE.MAX_MESSAGE_SIZE;
//#endregion
//#region ../../packages/history-migration/src/common/core/migration-service-protocol.ts
/**
* DI 容器中的服务符号
*/
var HistoryMigrationService = Symbol("HistoryMigrationService");
//#endregion
//#region ../../node_modules/.pnpm/universalify@2.0.1/node_modules/universalify/index.js
var require_universalify = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	exports.fromCallback = function(fn) {
		return Object.defineProperty(function(...args) {
			if (typeof args[args.length - 1] === "function") fn.apply(this, args);
			else return new Promise((resolve, reject) => {
				args.push((err, res) => err != null ? reject(err) : resolve(res));
				fn.apply(this, args);
			});
		}, "name", { value: fn.name });
	};
	exports.fromPromise = function(fn) {
		return Object.defineProperty(function(...args) {
			const cb = args[args.length - 1];
			if (typeof cb !== "function") return fn.apply(this, args);
			else {
				args.pop();
				fn.apply(this, args).then((r) => cb(null, r), cb);
			}
		}, "name", { value: fn.name });
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/fs-extra@11.3.3/node_modules/fs-extra/lib/fs/index.js
var require_fs = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	var u = require_universalify().fromCallback;
	var fs = require_graceful_fs$1.require_graceful_fs();
	var api = [
		"access",
		"appendFile",
		"chmod",
		"chown",
		"close",
		"copyFile",
		"cp",
		"fchmod",
		"fchown",
		"fdatasync",
		"fstat",
		"fsync",
		"ftruncate",
		"futimes",
		"glob",
		"lchmod",
		"lchown",
		"lutimes",
		"link",
		"lstat",
		"mkdir",
		"mkdtemp",
		"open",
		"opendir",
		"readdir",
		"readFile",
		"readlink",
		"realpath",
		"rename",
		"rm",
		"rmdir",
		"stat",
		"statfs",
		"symlink",
		"truncate",
		"unlink",
		"utimes",
		"writeFile"
	].filter((key) => {
		return typeof fs[key] === "function";
	});
	Object.assign(exports, fs);
	api.forEach((method) => {
		exports[method] = u(fs[method]);
	});
	exports.exists = function(filename, callback) {
		if (typeof callback === "function") return fs.exists(filename, callback);
		return new Promise((resolve) => {
			return fs.exists(filename, resolve);
		});
	};
	exports.read = function(fd, buffer, offset, length, position, callback) {
		if (typeof callback === "function") return fs.read(fd, buffer, offset, length, position, callback);
		return new Promise((resolve, reject) => {
			fs.read(fd, buffer, offset, length, position, (err, bytesRead, buffer) => {
				if (err) return reject(err);
				resolve({
					bytesRead,
					buffer
				});
			});
		});
	};
	exports.write = function(fd, buffer, ...args) {
		if (typeof args[args.length - 1] === "function") return fs.write(fd, buffer, ...args);
		return new Promise((resolve, reject) => {
			fs.write(fd, buffer, ...args, (err, bytesWritten, buffer) => {
				if (err) return reject(err);
				resolve({
					bytesWritten,
					buffer
				});
			});
		});
	};
	exports.readv = function(fd, buffers, ...args) {
		if (typeof args[args.length - 1] === "function") return fs.readv(fd, buffers, ...args);
		return new Promise((resolve, reject) => {
			fs.readv(fd, buffers, ...args, (err, bytesRead, buffers) => {
				if (err) return reject(err);
				resolve({
					bytesRead,
					buffers
				});
			});
		});
	};
	exports.writev = function(fd, buffers, ...args) {
		if (typeof args[args.length - 1] === "function") return fs.writev(fd, buffers, ...args);
		return new Promise((resolve, reject) => {
			fs.writev(fd, buffers, ...args, (err, bytesWritten, buffers) => {
				if (err) return reject(err);
				resolve({
					bytesWritten,
					buffers
				});
			});
		});
	};
	if (typeof fs.realpath.native === "function") exports.realpath.native = u(fs.realpath.native);
	else process.emitWarning("fs.realpath.native is not a function. Is fs being monkey-patched?", "Warning", "fs-extra-WARN0003");
}));
//#endregion
//#region ../../node_modules/.pnpm/fs-extra@11.3.3/node_modules/fs-extra/lib/mkdirs/utils.js
var require_utils$1 = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var path$13 = require("path");
	module.exports.checkPath = function checkPath(pth) {
		if (process.platform === "win32") {
			if (/[<>:"|?*]/.test(pth.replace(path$13.parse(pth).root, ""))) {
				const error = /* @__PURE__ */ new Error(`Path contains invalid characters: ${pth}`);
				error.code = "EINVAL";
				throw error;
			}
		}
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/fs-extra@11.3.3/node_modules/fs-extra/lib/mkdirs/make-dir.js
var require_make_dir = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var fs = require_fs();
	var { checkPath } = require_utils$1();
	var getMode = (options) => {
		const defaults = { mode: 511 };
		if (typeof options === "number") return options;
		return {
			...defaults,
			...options
		}.mode;
	};
	module.exports.makeDir = async (dir, options) => {
		checkPath(dir);
		return fs.mkdir(dir, {
			mode: getMode(options),
			recursive: true
		});
	};
	module.exports.makeDirSync = (dir, options) => {
		checkPath(dir);
		return fs.mkdirSync(dir, {
			mode: getMode(options),
			recursive: true
		});
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/fs-extra@11.3.3/node_modules/fs-extra/lib/mkdirs/index.js
var require_mkdirs = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var u = require_universalify().fromPromise;
	var { makeDir: _makeDir, makeDirSync } = require_make_dir();
	var makeDir = u(_makeDir);
	module.exports = {
		mkdirs: makeDir,
		mkdirsSync: makeDirSync,
		mkdirp: makeDir,
		mkdirpSync: makeDirSync,
		ensureDir: makeDir,
		ensureDirSync: makeDirSync
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/fs-extra@11.3.3/node_modules/fs-extra/lib/path-exists/index.js
var require_path_exists = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var u = require_universalify().fromPromise;
	var fs = require_fs();
	function pathExists(path) {
		return fs.access(path).then(() => true).catch(() => false);
	}
	module.exports = {
		pathExists: u(pathExists),
		pathExistsSync: fs.existsSync
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/fs-extra@11.3.3/node_modules/fs-extra/lib/util/utimes.js
var require_utimes = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var fs = require_fs();
	var u = require_universalify().fromPromise;
	async function utimesMillis(path, atime, mtime) {
		const fd = await fs.open(path, "r+");
		let closeErr = null;
		try {
			await fs.futimes(fd, atime, mtime);
		} finally {
			try {
				await fs.close(fd);
			} catch (e) {
				closeErr = e;
			}
		}
		if (closeErr) throw closeErr;
	}
	function utimesMillisSync(path, atime, mtime) {
		const fd = fs.openSync(path, "r+");
		fs.futimesSync(fd, atime, mtime);
		return fs.closeSync(fd);
	}
	module.exports = {
		utimesMillis: u(utimesMillis),
		utimesMillisSync
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/fs-extra@11.3.3/node_modules/fs-extra/lib/util/stat.js
var require_stat = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var fs = require_fs();
	var path$12 = require("path");
	var u = require_universalify().fromPromise;
	function getStats(src, dest, opts) {
		const statFunc = opts.dereference ? (file) => fs.stat(file, { bigint: true }) : (file) => fs.lstat(file, { bigint: true });
		return Promise.all([statFunc(src), statFunc(dest).catch((err) => {
			if (err.code === "ENOENT") return null;
			throw err;
		})]).then(([srcStat, destStat]) => ({
			srcStat,
			destStat
		}));
	}
	function getStatsSync(src, dest, opts) {
		let destStat;
		const statFunc = opts.dereference ? (file) => fs.statSync(file, { bigint: true }) : (file) => fs.lstatSync(file, { bigint: true });
		const srcStat = statFunc(src);
		try {
			destStat = statFunc(dest);
		} catch (err) {
			if (err.code === "ENOENT") return {
				srcStat,
				destStat: null
			};
			throw err;
		}
		return {
			srcStat,
			destStat
		};
	}
	async function checkPaths(src, dest, funcName, opts) {
		const { srcStat, destStat } = await getStats(src, dest, opts);
		if (destStat) {
			if (areIdentical(srcStat, destStat)) {
				const srcBaseName = path$12.basename(src);
				const destBaseName = path$12.basename(dest);
				if (funcName === "move" && srcBaseName !== destBaseName && srcBaseName.toLowerCase() === destBaseName.toLowerCase()) return {
					srcStat,
					destStat,
					isChangingCase: true
				};
				throw new Error("Source and destination must not be the same.");
			}
			if (srcStat.isDirectory() && !destStat.isDirectory()) throw new Error(`Cannot overwrite non-directory '${dest}' with directory '${src}'.`);
			if (!srcStat.isDirectory() && destStat.isDirectory()) throw new Error(`Cannot overwrite directory '${dest}' with non-directory '${src}'.`);
		}
		if (srcStat.isDirectory() && isSrcSubdir(src, dest)) throw new Error(errMsg(src, dest, funcName));
		return {
			srcStat,
			destStat
		};
	}
	function checkPathsSync(src, dest, funcName, opts) {
		const { srcStat, destStat } = getStatsSync(src, dest, opts);
		if (destStat) {
			if (areIdentical(srcStat, destStat)) {
				const srcBaseName = path$12.basename(src);
				const destBaseName = path$12.basename(dest);
				if (funcName === "move" && srcBaseName !== destBaseName && srcBaseName.toLowerCase() === destBaseName.toLowerCase()) return {
					srcStat,
					destStat,
					isChangingCase: true
				};
				throw new Error("Source and destination must not be the same.");
			}
			if (srcStat.isDirectory() && !destStat.isDirectory()) throw new Error(`Cannot overwrite non-directory '${dest}' with directory '${src}'.`);
			if (!srcStat.isDirectory() && destStat.isDirectory()) throw new Error(`Cannot overwrite directory '${dest}' with non-directory '${src}'.`);
		}
		if (srcStat.isDirectory() && isSrcSubdir(src, dest)) throw new Error(errMsg(src, dest, funcName));
		return {
			srcStat,
			destStat
		};
	}
	async function checkParentPaths(src, srcStat, dest, funcName) {
		const srcParent = path$12.resolve(path$12.dirname(src));
		const destParent = path$12.resolve(path$12.dirname(dest));
		if (destParent === srcParent || destParent === path$12.parse(destParent).root) return;
		let destStat;
		try {
			destStat = await fs.stat(destParent, { bigint: true });
		} catch (err) {
			if (err.code === "ENOENT") return;
			throw err;
		}
		if (areIdentical(srcStat, destStat)) throw new Error(errMsg(src, dest, funcName));
		return checkParentPaths(src, srcStat, destParent, funcName);
	}
	function checkParentPathsSync(src, srcStat, dest, funcName) {
		const srcParent = path$12.resolve(path$12.dirname(src));
		const destParent = path$12.resolve(path$12.dirname(dest));
		if (destParent === srcParent || destParent === path$12.parse(destParent).root) return;
		let destStat;
		try {
			destStat = fs.statSync(destParent, { bigint: true });
		} catch (err) {
			if (err.code === "ENOENT") return;
			throw err;
		}
		if (areIdentical(srcStat, destStat)) throw new Error(errMsg(src, dest, funcName));
		return checkParentPathsSync(src, srcStat, destParent, funcName);
	}
	function areIdentical(srcStat, destStat) {
		return destStat.ino !== void 0 && destStat.dev !== void 0 && destStat.ino === srcStat.ino && destStat.dev === srcStat.dev;
	}
	function isSrcSubdir(src, dest) {
		const srcArr = path$12.resolve(src).split(path$12.sep).filter((i) => i);
		const destArr = path$12.resolve(dest).split(path$12.sep).filter((i) => i);
		return srcArr.every((cur, i) => destArr[i] === cur);
	}
	function errMsg(src, dest, funcName) {
		return `Cannot ${funcName} '${src}' to a subdirectory of itself, '${dest}'.`;
	}
	module.exports = {
		checkPaths: u(checkPaths),
		checkPathsSync,
		checkParentPaths: u(checkParentPaths),
		checkParentPathsSync,
		isSrcSubdir,
		areIdentical
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/fs-extra@11.3.3/node_modules/fs-extra/lib/util/async.js
var require_async = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	async function asyncIteratorConcurrentProcess(iterator, fn) {
		const promises = [];
		for await (const item of iterator) promises.push(fn(item).then(() => null, (err) => err ?? /* @__PURE__ */ new Error("unknown error")));
		await Promise.all(promises.map((promise) => promise.then((possibleErr) => {
			if (possibleErr !== null) throw possibleErr;
		})));
	}
	module.exports = { asyncIteratorConcurrentProcess };
}));
//#endregion
//#region ../../node_modules/.pnpm/fs-extra@11.3.3/node_modules/fs-extra/lib/copy/copy.js
var require_copy$1 = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var fs = require_fs();
	var path$11 = require("path");
	var { mkdirs } = require_mkdirs();
	var { pathExists } = require_path_exists();
	var { utimesMillis } = require_utimes();
	var stat = require_stat();
	var { asyncIteratorConcurrentProcess } = require_async();
	async function copy(src, dest, opts = {}) {
		if (typeof opts === "function") opts = { filter: opts };
		opts.clobber = "clobber" in opts ? !!opts.clobber : true;
		opts.overwrite = "overwrite" in opts ? !!opts.overwrite : opts.clobber;
		if (opts.preserveTimestamps && process.arch === "ia32") process.emitWarning("Using the preserveTimestamps option in 32-bit node is not recommended;\n\n	see https://github.com/jprichardson/node-fs-extra/issues/269", "Warning", "fs-extra-WARN0001");
		const { srcStat, destStat } = await stat.checkPaths(src, dest, "copy", opts);
		await stat.checkParentPaths(src, srcStat, dest, "copy");
		if (!await runFilter(src, dest, opts)) return;
		const destParent = path$11.dirname(dest);
		if (!await pathExists(destParent)) await mkdirs(destParent);
		await getStatsAndPerformCopy(destStat, src, dest, opts);
	}
	async function runFilter(src, dest, opts) {
		if (!opts.filter) return true;
		return opts.filter(src, dest);
	}
	async function getStatsAndPerformCopy(destStat, src, dest, opts) {
		const srcStat = await (opts.dereference ? fs.stat : fs.lstat)(src);
		if (srcStat.isDirectory()) return onDir(srcStat, destStat, src, dest, opts);
		if (srcStat.isFile() || srcStat.isCharacterDevice() || srcStat.isBlockDevice()) return onFile(srcStat, destStat, src, dest, opts);
		if (srcStat.isSymbolicLink()) return onLink(destStat, src, dest, opts);
		if (srcStat.isSocket()) throw new Error(`Cannot copy a socket file: ${src}`);
		if (srcStat.isFIFO()) throw new Error(`Cannot copy a FIFO pipe: ${src}`);
		throw new Error(`Unknown file: ${src}`);
	}
	async function onFile(srcStat, destStat, src, dest, opts) {
		if (!destStat) return copyFile(srcStat, src, dest, opts);
		if (opts.overwrite) {
			await fs.unlink(dest);
			return copyFile(srcStat, src, dest, opts);
		}
		if (opts.errorOnExist) throw new Error(`'${dest}' already exists`);
	}
	async function copyFile(srcStat, src, dest, opts) {
		await fs.copyFile(src, dest);
		if (opts.preserveTimestamps) {
			if (fileIsNotWritable(srcStat.mode)) await makeFileWritable(dest, srcStat.mode);
			const updatedSrcStat = await fs.stat(src);
			await utimesMillis(dest, updatedSrcStat.atime, updatedSrcStat.mtime);
		}
		return fs.chmod(dest, srcStat.mode);
	}
	function fileIsNotWritable(srcMode) {
		return (srcMode & 128) === 0;
	}
	function makeFileWritable(dest, srcMode) {
		return fs.chmod(dest, srcMode | 128);
	}
	async function onDir(srcStat, destStat, src, dest, opts) {
		if (!destStat) await fs.mkdir(dest);
		await asyncIteratorConcurrentProcess(await fs.opendir(src), async (item) => {
			const srcItem = path$11.join(src, item.name);
			const destItem = path$11.join(dest, item.name);
			if (await runFilter(srcItem, destItem, opts)) {
				const { destStat } = await stat.checkPaths(srcItem, destItem, "copy", opts);
				await getStatsAndPerformCopy(destStat, srcItem, destItem, opts);
			}
		});
		if (!destStat) await fs.chmod(dest, srcStat.mode);
	}
	async function onLink(destStat, src, dest, opts) {
		let resolvedSrc = await fs.readlink(src);
		if (opts.dereference) resolvedSrc = path$11.resolve(process.cwd(), resolvedSrc);
		if (!destStat) return fs.symlink(resolvedSrc, dest);
		let resolvedDest = null;
		try {
			resolvedDest = await fs.readlink(dest);
		} catch (e) {
			if (e.code === "EINVAL" || e.code === "UNKNOWN") return fs.symlink(resolvedSrc, dest);
			throw e;
		}
		if (opts.dereference) resolvedDest = path$11.resolve(process.cwd(), resolvedDest);
		if (resolvedSrc !== resolvedDest) {
			if (stat.isSrcSubdir(resolvedSrc, resolvedDest)) throw new Error(`Cannot copy '${resolvedSrc}' to a subdirectory of itself, '${resolvedDest}'.`);
			if (stat.isSrcSubdir(resolvedDest, resolvedSrc)) throw new Error(`Cannot overwrite '${resolvedDest}' with '${resolvedSrc}'.`);
		}
		await fs.unlink(dest);
		return fs.symlink(resolvedSrc, dest);
	}
	module.exports = copy;
}));
//#endregion
//#region ../../node_modules/.pnpm/fs-extra@11.3.3/node_modules/fs-extra/lib/copy/copy-sync.js
var require_copy_sync = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var fs = require_graceful_fs$1.require_graceful_fs();
	var path$10 = require("path");
	var mkdirsSync = require_mkdirs().mkdirsSync;
	var utimesMillisSync = require_utimes().utimesMillisSync;
	var stat = require_stat();
	function copySync(src, dest, opts) {
		if (typeof opts === "function") opts = { filter: opts };
		opts = opts || {};
		opts.clobber = "clobber" in opts ? !!opts.clobber : true;
		opts.overwrite = "overwrite" in opts ? !!opts.overwrite : opts.clobber;
		if (opts.preserveTimestamps && process.arch === "ia32") process.emitWarning("Using the preserveTimestamps option in 32-bit node is not recommended;\n\n	see https://github.com/jprichardson/node-fs-extra/issues/269", "Warning", "fs-extra-WARN0002");
		const { srcStat, destStat } = stat.checkPathsSync(src, dest, "copy", opts);
		stat.checkParentPathsSync(src, srcStat, dest, "copy");
		if (opts.filter && !opts.filter(src, dest)) return;
		const destParent = path$10.dirname(dest);
		if (!fs.existsSync(destParent)) mkdirsSync(destParent);
		return getStats(destStat, src, dest, opts);
	}
	function getStats(destStat, src, dest, opts) {
		const srcStat = (opts.dereference ? fs.statSync : fs.lstatSync)(src);
		if (srcStat.isDirectory()) return onDir(srcStat, destStat, src, dest, opts);
		else if (srcStat.isFile() || srcStat.isCharacterDevice() || srcStat.isBlockDevice()) return onFile(srcStat, destStat, src, dest, opts);
		else if (srcStat.isSymbolicLink()) return onLink(destStat, src, dest, opts);
		else if (srcStat.isSocket()) throw new Error(`Cannot copy a socket file: ${src}`);
		else if (srcStat.isFIFO()) throw new Error(`Cannot copy a FIFO pipe: ${src}`);
		throw new Error(`Unknown file: ${src}`);
	}
	function onFile(srcStat, destStat, src, dest, opts) {
		if (!destStat) return copyFile(srcStat, src, dest, opts);
		return mayCopyFile(srcStat, src, dest, opts);
	}
	function mayCopyFile(srcStat, src, dest, opts) {
		if (opts.overwrite) {
			fs.unlinkSync(dest);
			return copyFile(srcStat, src, dest, opts);
		} else if (opts.errorOnExist) throw new Error(`'${dest}' already exists`);
	}
	function copyFile(srcStat, src, dest, opts) {
		fs.copyFileSync(src, dest);
		if (opts.preserveTimestamps) handleTimestamps(srcStat.mode, src, dest);
		return setDestMode(dest, srcStat.mode);
	}
	function handleTimestamps(srcMode, src, dest) {
		if (fileIsNotWritable(srcMode)) makeFileWritable(dest, srcMode);
		return setDestTimestamps(src, dest);
	}
	function fileIsNotWritable(srcMode) {
		return (srcMode & 128) === 0;
	}
	function makeFileWritable(dest, srcMode) {
		return setDestMode(dest, srcMode | 128);
	}
	function setDestMode(dest, srcMode) {
		return fs.chmodSync(dest, srcMode);
	}
	function setDestTimestamps(src, dest) {
		const updatedSrcStat = fs.statSync(src);
		return utimesMillisSync(dest, updatedSrcStat.atime, updatedSrcStat.mtime);
	}
	function onDir(srcStat, destStat, src, dest, opts) {
		if (!destStat) return mkDirAndCopy(srcStat.mode, src, dest, opts);
		return copyDir(src, dest, opts);
	}
	function mkDirAndCopy(srcMode, src, dest, opts) {
		fs.mkdirSync(dest);
		copyDir(src, dest, opts);
		return setDestMode(dest, srcMode);
	}
	function copyDir(src, dest, opts) {
		const dir = fs.opendirSync(src);
		try {
			let dirent;
			while ((dirent = dir.readSync()) !== null) copyDirItem(dirent.name, src, dest, opts);
		} finally {
			dir.closeSync();
		}
	}
	function copyDirItem(item, src, dest, opts) {
		const srcItem = path$10.join(src, item);
		const destItem = path$10.join(dest, item);
		if (opts.filter && !opts.filter(srcItem, destItem)) return;
		const { destStat } = stat.checkPathsSync(srcItem, destItem, "copy", opts);
		return getStats(destStat, srcItem, destItem, opts);
	}
	function onLink(destStat, src, dest, opts) {
		let resolvedSrc = fs.readlinkSync(src);
		if (opts.dereference) resolvedSrc = path$10.resolve(process.cwd(), resolvedSrc);
		if (!destStat) return fs.symlinkSync(resolvedSrc, dest);
		else {
			let resolvedDest;
			try {
				resolvedDest = fs.readlinkSync(dest);
			} catch (err) {
				if (err.code === "EINVAL" || err.code === "UNKNOWN") return fs.symlinkSync(resolvedSrc, dest);
				throw err;
			}
			if (opts.dereference) resolvedDest = path$10.resolve(process.cwd(), resolvedDest);
			if (resolvedSrc !== resolvedDest) {
				if (stat.isSrcSubdir(resolvedSrc, resolvedDest)) throw new Error(`Cannot copy '${resolvedSrc}' to a subdirectory of itself, '${resolvedDest}'.`);
				if (stat.isSrcSubdir(resolvedDest, resolvedSrc)) throw new Error(`Cannot overwrite '${resolvedDest}' with '${resolvedSrc}'.`);
			}
			return copyLink(resolvedSrc, dest);
		}
	}
	function copyLink(resolvedSrc, dest) {
		fs.unlinkSync(dest);
		return fs.symlinkSync(resolvedSrc, dest);
	}
	module.exports = copySync;
}));
//#endregion
//#region ../../node_modules/.pnpm/fs-extra@11.3.3/node_modules/fs-extra/lib/copy/index.js
var require_copy = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var u = require_universalify().fromPromise;
	module.exports = {
		copy: u(require_copy$1()),
		copySync: require_copy_sync()
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/fs-extra@11.3.3/node_modules/fs-extra/lib/remove/index.js
var require_remove = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var fs = require_graceful_fs$1.require_graceful_fs();
	var u = require_universalify().fromCallback;
	function remove(path, callback) {
		fs.rm(path, {
			recursive: true,
			force: true
		}, callback);
	}
	function removeSync(path) {
		fs.rmSync(path, {
			recursive: true,
			force: true
		});
	}
	module.exports = {
		remove: u(remove),
		removeSync
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/fs-extra@11.3.3/node_modules/fs-extra/lib/empty/index.js
var require_empty = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var u = require_universalify().fromPromise;
	var fs = require_fs();
	var path$9 = require("path");
	var mkdir = require_mkdirs();
	var remove = require_remove();
	var emptyDir = u(async function emptyDir(dir) {
		let items;
		try {
			items = await fs.readdir(dir);
		} catch {
			return mkdir.mkdirs(dir);
		}
		return Promise.all(items.map((item) => remove.remove(path$9.join(dir, item))));
	});
	function emptyDirSync(dir) {
		let items;
		try {
			items = fs.readdirSync(dir);
		} catch {
			return mkdir.mkdirsSync(dir);
		}
		items.forEach((item) => {
			item = path$9.join(dir, item);
			remove.removeSync(item);
		});
	}
	module.exports = {
		emptyDirSync,
		emptydirSync: emptyDirSync,
		emptyDir,
		emptydir: emptyDir
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/fs-extra@11.3.3/node_modules/fs-extra/lib/ensure/file.js
var require_file = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var u = require_universalify().fromPromise;
	var path$8 = require("path");
	var fs = require_fs();
	var mkdir = require_mkdirs();
	async function createFile(file) {
		let stats;
		try {
			stats = await fs.stat(file);
		} catch {}
		if (stats && stats.isFile()) return;
		const dir = path$8.dirname(file);
		let dirStats = null;
		try {
			dirStats = await fs.stat(dir);
		} catch (err) {
			if (err.code === "ENOENT") {
				await mkdir.mkdirs(dir);
				await fs.writeFile(file, "");
				return;
			} else throw err;
		}
		if (dirStats.isDirectory()) await fs.writeFile(file, "");
		else await fs.readdir(dir);
	}
	function createFileSync(file) {
		let stats;
		try {
			stats = fs.statSync(file);
		} catch {}
		if (stats && stats.isFile()) return;
		const dir = path$8.dirname(file);
		try {
			if (!fs.statSync(dir).isDirectory()) fs.readdirSync(dir);
		} catch (err) {
			if (err && err.code === "ENOENT") mkdir.mkdirsSync(dir);
			else throw err;
		}
		fs.writeFileSync(file, "");
	}
	module.exports = {
		createFile: u(createFile),
		createFileSync
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/fs-extra@11.3.3/node_modules/fs-extra/lib/ensure/link.js
var require_link = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var u = require_universalify().fromPromise;
	var path$7 = require("path");
	var fs = require_fs();
	var mkdir = require_mkdirs();
	var { pathExists } = require_path_exists();
	var { areIdentical } = require_stat();
	async function createLink(srcpath, dstpath) {
		let dstStat;
		try {
			dstStat = await fs.lstat(dstpath);
		} catch {}
		let srcStat;
		try {
			srcStat = await fs.lstat(srcpath);
		} catch (err) {
			err.message = err.message.replace("lstat", "ensureLink");
			throw err;
		}
		if (dstStat && areIdentical(srcStat, dstStat)) return;
		const dir = path$7.dirname(dstpath);
		if (!await pathExists(dir)) await mkdir.mkdirs(dir);
		await fs.link(srcpath, dstpath);
	}
	function createLinkSync(srcpath, dstpath) {
		let dstStat;
		try {
			dstStat = fs.lstatSync(dstpath);
		} catch {}
		try {
			const srcStat = fs.lstatSync(srcpath);
			if (dstStat && areIdentical(srcStat, dstStat)) return;
		} catch (err) {
			err.message = err.message.replace("lstat", "ensureLink");
			throw err;
		}
		const dir = path$7.dirname(dstpath);
		if (fs.existsSync(dir)) return fs.linkSync(srcpath, dstpath);
		mkdir.mkdirsSync(dir);
		return fs.linkSync(srcpath, dstpath);
	}
	module.exports = {
		createLink: u(createLink),
		createLinkSync
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/fs-extra@11.3.3/node_modules/fs-extra/lib/ensure/symlink-paths.js
var require_symlink_paths = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var path$6 = require("path");
	var fs = require_fs();
	var { pathExists } = require_path_exists();
	var u = require_universalify().fromPromise;
	/**
	* Function that returns two types of paths, one relative to symlink, and one
	* relative to the current working directory. Checks if path is absolute or
	* relative. If the path is relative, this function checks if the path is
	* relative to symlink or relative to current working directory. This is an
	* initiative to find a smarter `srcpath` to supply when building symlinks.
	* This allows you to determine which path to use out of one of three possible
	* types of source paths. The first is an absolute path. This is detected by
	* `path.isAbsolute()`. When an absolute path is provided, it is checked to
	* see if it exists. If it does it's used, if not an error is returned
	* (callback)/ thrown (sync). The other two options for `srcpath` are a
	* relative url. By default Node's `fs.symlink` works by creating a symlink
	* using `dstpath` and expects the `srcpath` to be relative to the newly
	* created symlink. If you provide a `srcpath` that does not exist on the file
	* system it results in a broken symlink. To minimize this, the function
	* checks to see if the 'relative to symlink' source file exists, and if it
	* does it will use it. If it does not, it checks if there's a file that
	* exists that is relative to the current working directory, if does its used.
	* This preserves the expectations of the original fs.symlink spec and adds
	* the ability to pass in `relative to current working direcotry` paths.
	*/
	async function symlinkPaths(srcpath, dstpath) {
		if (path$6.isAbsolute(srcpath)) {
			try {
				await fs.lstat(srcpath);
			} catch (err) {
				err.message = err.message.replace("lstat", "ensureSymlink");
				throw err;
			}
			return {
				toCwd: srcpath,
				toDst: srcpath
			};
		}
		const dstdir = path$6.dirname(dstpath);
		const relativeToDst = path$6.join(dstdir, srcpath);
		if (await pathExists(relativeToDst)) return {
			toCwd: relativeToDst,
			toDst: srcpath
		};
		try {
			await fs.lstat(srcpath);
		} catch (err) {
			err.message = err.message.replace("lstat", "ensureSymlink");
			throw err;
		}
		return {
			toCwd: srcpath,
			toDst: path$6.relative(dstdir, srcpath)
		};
	}
	function symlinkPathsSync(srcpath, dstpath) {
		if (path$6.isAbsolute(srcpath)) {
			if (!fs.existsSync(srcpath)) throw new Error("absolute srcpath does not exist");
			return {
				toCwd: srcpath,
				toDst: srcpath
			};
		}
		const dstdir = path$6.dirname(dstpath);
		const relativeToDst = path$6.join(dstdir, srcpath);
		if (fs.existsSync(relativeToDst)) return {
			toCwd: relativeToDst,
			toDst: srcpath
		};
		if (!fs.existsSync(srcpath)) throw new Error("relative srcpath does not exist");
		return {
			toCwd: srcpath,
			toDst: path$6.relative(dstdir, srcpath)
		};
	}
	module.exports = {
		symlinkPaths: u(symlinkPaths),
		symlinkPathsSync
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/fs-extra@11.3.3/node_modules/fs-extra/lib/ensure/symlink-type.js
var require_symlink_type = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var fs = require_fs();
	var u = require_universalify().fromPromise;
	async function symlinkType(srcpath, type) {
		if (type) return type;
		let stats;
		try {
			stats = await fs.lstat(srcpath);
		} catch {
			return "file";
		}
		return stats && stats.isDirectory() ? "dir" : "file";
	}
	function symlinkTypeSync(srcpath, type) {
		if (type) return type;
		let stats;
		try {
			stats = fs.lstatSync(srcpath);
		} catch {
			return "file";
		}
		return stats && stats.isDirectory() ? "dir" : "file";
	}
	module.exports = {
		symlinkType: u(symlinkType),
		symlinkTypeSync
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/fs-extra@11.3.3/node_modules/fs-extra/lib/ensure/symlink.js
var require_symlink = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var u = require_universalify().fromPromise;
	var path$5 = require("path");
	var fs = require_fs();
	var { mkdirs, mkdirsSync } = require_mkdirs();
	var { symlinkPaths, symlinkPathsSync } = require_symlink_paths();
	var { symlinkType, symlinkTypeSync } = require_symlink_type();
	var { pathExists } = require_path_exists();
	var { areIdentical } = require_stat();
	async function createSymlink(srcpath, dstpath, type) {
		let stats;
		try {
			stats = await fs.lstat(dstpath);
		} catch {}
		if (stats && stats.isSymbolicLink()) {
			const [srcStat, dstStat] = await Promise.all([fs.stat(srcpath), fs.stat(dstpath)]);
			if (areIdentical(srcStat, dstStat)) return;
		}
		const relative = await symlinkPaths(srcpath, dstpath);
		srcpath = relative.toDst;
		const toType = await symlinkType(relative.toCwd, type);
		const dir = path$5.dirname(dstpath);
		if (!await pathExists(dir)) await mkdirs(dir);
		return fs.symlink(srcpath, dstpath, toType);
	}
	function createSymlinkSync(srcpath, dstpath, type) {
		let stats;
		try {
			stats = fs.lstatSync(dstpath);
		} catch {}
		if (stats && stats.isSymbolicLink()) {
			if (areIdentical(fs.statSync(srcpath), fs.statSync(dstpath))) return;
		}
		const relative = symlinkPathsSync(srcpath, dstpath);
		srcpath = relative.toDst;
		type = symlinkTypeSync(relative.toCwd, type);
		const dir = path$5.dirname(dstpath);
		if (fs.existsSync(dir)) return fs.symlinkSync(srcpath, dstpath, type);
		mkdirsSync(dir);
		return fs.symlinkSync(srcpath, dstpath, type);
	}
	module.exports = {
		createSymlink: u(createSymlink),
		createSymlinkSync
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/fs-extra@11.3.3/node_modules/fs-extra/lib/ensure/index.js
var require_ensure = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var { createFile, createFileSync } = require_file();
	var { createLink, createLinkSync } = require_link();
	var { createSymlink, createSymlinkSync } = require_symlink();
	module.exports = {
		createFile,
		createFileSync,
		ensureFile: createFile,
		ensureFileSync: createFileSync,
		createLink,
		createLinkSync,
		ensureLink: createLink,
		ensureLinkSync: createLinkSync,
		createSymlink,
		createSymlinkSync,
		ensureSymlink: createSymlink,
		ensureSymlinkSync: createSymlinkSync
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/jsonfile@6.1.0/node_modules/jsonfile/utils.js
var require_utils = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	function stringify(obj, { EOL = "\n", finalEOL = true, replacer = null, spaces } = {}) {
		const EOF = finalEOL ? EOL : "";
		return JSON.stringify(obj, replacer, spaces).replace(/\n/g, EOL) + EOF;
	}
	function stripBom(content) {
		if (Buffer.isBuffer(content)) content = content.toString("utf8");
		return content.replace(/^\uFEFF/, "");
	}
	module.exports = {
		stringify,
		stripBom
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/jsonfile@6.1.0/node_modules/jsonfile/index.js
var require_jsonfile$1 = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var _fs;
	try {
		_fs = require_graceful_fs$1.require_graceful_fs();
	} catch (_) {
		_fs = require("fs");
	}
	var universalify = require_universalify();
	var { stringify, stripBom } = require_utils();
	async function _readFile(file, options = {}) {
		if (typeof options === "string") options = { encoding: options };
		const fs$4 = options.fs || _fs;
		const shouldThrow = "throws" in options ? options.throws : true;
		let data = await universalify.fromCallback(fs$4.readFile)(file, options);
		data = stripBom(data);
		let obj;
		try {
			obj = JSON.parse(data, options ? options.reviver : null);
		} catch (err) {
			if (shouldThrow) {
				err.message = `${file}: ${err.message}`;
				throw err;
			} else return null;
		}
		return obj;
	}
	var readFile = universalify.fromPromise(_readFile);
	function readFileSync(file, options = {}) {
		if (typeof options === "string") options = { encoding: options };
		const fs$5 = options.fs || _fs;
		const shouldThrow = "throws" in options ? options.throws : true;
		try {
			let content = fs$5.readFileSync(file, options);
			content = stripBom(content);
			return JSON.parse(content, options.reviver);
		} catch (err) {
			if (shouldThrow) {
				err.message = `${file}: ${err.message}`;
				throw err;
			} else return null;
		}
	}
	async function _writeFile(file, obj, options = {}) {
		const fs$6 = options.fs || _fs;
		const str = stringify(obj, options);
		await universalify.fromCallback(fs$6.writeFile)(file, str, options);
	}
	var writeFile = universalify.fromPromise(_writeFile);
	function writeFileSync(file, obj, options = {}) {
		const fs$7 = options.fs || _fs;
		const str = stringify(obj, options);
		return fs$7.writeFileSync(file, str, options);
	}
	module.exports = {
		readFile,
		readFileSync,
		writeFile,
		writeFileSync
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/fs-extra@11.3.3/node_modules/fs-extra/lib/json/jsonfile.js
var require_jsonfile = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var jsonFile = require_jsonfile$1();
	module.exports = {
		readJson: jsonFile.readFile,
		readJsonSync: jsonFile.readFileSync,
		writeJson: jsonFile.writeFile,
		writeJsonSync: jsonFile.writeFileSync
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/fs-extra@11.3.3/node_modules/fs-extra/lib/output-file/index.js
var require_output_file = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var u = require_universalify().fromPromise;
	var fs = require_fs();
	var path$4 = require("path");
	var mkdir = require_mkdirs();
	var pathExists = require_path_exists().pathExists;
	async function outputFile(file, data, encoding = "utf-8") {
		const dir = path$4.dirname(file);
		if (!await pathExists(dir)) await mkdir.mkdirs(dir);
		return fs.writeFile(file, data, encoding);
	}
	function outputFileSync(file, ...args) {
		const dir = path$4.dirname(file);
		if (!fs.existsSync(dir)) mkdir.mkdirsSync(dir);
		fs.writeFileSync(file, ...args);
	}
	module.exports = {
		outputFile: u(outputFile),
		outputFileSync
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/fs-extra@11.3.3/node_modules/fs-extra/lib/json/output-json.js
var require_output_json = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var { stringify } = require_utils();
	var { outputFile } = require_output_file();
	async function outputJson(file, data, options = {}) {
		await outputFile(file, stringify(data, options), options);
	}
	module.exports = outputJson;
}));
//#endregion
//#region ../../node_modules/.pnpm/fs-extra@11.3.3/node_modules/fs-extra/lib/json/output-json-sync.js
var require_output_json_sync = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var { stringify } = require_utils();
	var { outputFileSync } = require_output_file();
	function outputJsonSync(file, data, options) {
		outputFileSync(file, stringify(data, options), options);
	}
	module.exports = outputJsonSync;
}));
//#endregion
//#region ../../node_modules/.pnpm/fs-extra@11.3.3/node_modules/fs-extra/lib/json/index.js
var require_json = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var u = require_universalify().fromPromise;
	var jsonFile = require_jsonfile();
	jsonFile.outputJson = u(require_output_json());
	jsonFile.outputJsonSync = require_output_json_sync();
	jsonFile.outputJSON = jsonFile.outputJson;
	jsonFile.outputJSONSync = jsonFile.outputJsonSync;
	jsonFile.writeJSON = jsonFile.writeJson;
	jsonFile.writeJSONSync = jsonFile.writeJsonSync;
	jsonFile.readJSON = jsonFile.readJson;
	jsonFile.readJSONSync = jsonFile.readJsonSync;
	module.exports = jsonFile;
}));
//#endregion
//#region ../../node_modules/.pnpm/fs-extra@11.3.3/node_modules/fs-extra/lib/move/move.js
var require_move$1 = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var fs = require_fs();
	var path$3 = require("path");
	var { copy } = require_copy();
	var { remove } = require_remove();
	var { mkdirp } = require_mkdirs();
	var { pathExists } = require_path_exists();
	var stat = require_stat();
	async function move(src, dest, opts = {}) {
		const overwrite = opts.overwrite || opts.clobber || false;
		const { srcStat, isChangingCase = false } = await stat.checkPaths(src, dest, "move", opts);
		await stat.checkParentPaths(src, srcStat, dest, "move");
		const destParent = path$3.dirname(dest);
		if (path$3.parse(destParent).root !== destParent) await mkdirp(destParent);
		return doRename(src, dest, overwrite, isChangingCase);
	}
	async function doRename(src, dest, overwrite, isChangingCase) {
		if (!isChangingCase) {
			if (overwrite) await remove(dest);
			else if (await pathExists(dest)) throw new Error("dest already exists.");
		}
		try {
			await fs.rename(src, dest);
		} catch (err) {
			if (err.code !== "EXDEV") throw err;
			await moveAcrossDevice(src, dest, overwrite);
		}
	}
	async function moveAcrossDevice(src, dest, overwrite) {
		await copy(src, dest, {
			overwrite,
			errorOnExist: true,
			preserveTimestamps: true
		});
		return remove(src);
	}
	module.exports = move;
}));
//#endregion
//#region ../../node_modules/.pnpm/fs-extra@11.3.3/node_modules/fs-extra/lib/move/move-sync.js
var require_move_sync = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var fs = require_graceful_fs$1.require_graceful_fs();
	var path$2 = require("path");
	var copySync = require_copy().copySync;
	var removeSync = require_remove().removeSync;
	var mkdirpSync = require_mkdirs().mkdirpSync;
	var stat = require_stat();
	function moveSync(src, dest, opts) {
		opts = opts || {};
		const overwrite = opts.overwrite || opts.clobber || false;
		const { srcStat, isChangingCase = false } = stat.checkPathsSync(src, dest, "move", opts);
		stat.checkParentPathsSync(src, srcStat, dest, "move");
		if (!isParentRoot(dest)) mkdirpSync(path$2.dirname(dest));
		return doRename(src, dest, overwrite, isChangingCase);
	}
	function isParentRoot(dest) {
		const parent = path$2.dirname(dest);
		return path$2.parse(parent).root === parent;
	}
	function doRename(src, dest, overwrite, isChangingCase) {
		if (isChangingCase) return rename(src, dest, overwrite);
		if (overwrite) {
			removeSync(dest);
			return rename(src, dest, overwrite);
		}
		if (fs.existsSync(dest)) throw new Error("dest already exists.");
		return rename(src, dest, overwrite);
	}
	function rename(src, dest, overwrite) {
		try {
			fs.renameSync(src, dest);
		} catch (err) {
			if (err.code !== "EXDEV") throw err;
			return moveAcrossDevice(src, dest, overwrite);
		}
	}
	function moveAcrossDevice(src, dest, overwrite) {
		copySync(src, dest, {
			overwrite,
			errorOnExist: true,
			preserveTimestamps: true
		});
		return removeSync(src);
	}
	module.exports = moveSync;
}));
//#endregion
//#region ../../node_modules/.pnpm/fs-extra@11.3.3/node_modules/fs-extra/lib/move/index.js
var require_move = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var u = require_universalify().fromPromise;
	module.exports = {
		move: u(require_move$1()),
		moveSync: require_move_sync()
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/fs-extra@11.3.3/node_modules/fs-extra/lib/index.js
var require_lib = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	module.exports = {
		...require_fs(),
		...require_copy(),
		...require_empty(),
		...require_ensure(),
		...require_json(),
		...require_mkdirs(),
		...require_move(),
		...require_output_file(),
		...require_path_exists(),
		...require_remove()
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/uuid@9.0.1/node_modules/uuid/dist/esm-node/rng.js
var rnds8Pool = new Uint8Array(256);
var poolPtr = rnds8Pool.length;
function rng() {
	if (poolPtr > rnds8Pool.length - 16) {
		crypto.default.randomFillSync(rnds8Pool);
		poolPtr = 0;
	}
	return rnds8Pool.slice(poolPtr, poolPtr += 16);
}
//#endregion
//#region ../../node_modules/.pnpm/uuid@9.0.1/node_modules/uuid/dist/esm-node/stringify.js
/**
* Convert array of 16 byte values to UUID string format of the form:
* XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
*/
var byteToHex = [];
for (let i = 0; i < 256; ++i) byteToHex.push((i + 256).toString(16).slice(1));
function unsafeStringify(arr, offset = 0) {
	return byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]];
}
//#endregion
//#region ../../node_modules/.pnpm/uuid@9.0.1/node_modules/uuid/dist/esm-node/native.js
var native_default = { randomUUID: crypto.default.randomUUID };
//#endregion
//#region ../../node_modules/.pnpm/uuid@9.0.1/node_modules/uuid/dist/esm-node/v4.js
function v4(options, buf, offset) {
	if (native_default.randomUUID && !buf && !options) return native_default.randomUUID();
	options = options || {};
	const rnds = options.random || (options.rng || rng)();
	rnds[6] = rnds[6] & 15 | 64;
	rnds[8] = rnds[8] & 63 | 128;
	if (buf) {
		offset = offset || 0;
		for (let i = 0; i < 16; ++i) buf[offset + i] = rnds[i];
		return buf;
	}
	return unsafeStringify(rnds);
}
//#endregion
//#region ../../packages/history-migration/src/common/conflict/conflict-protocol.ts
var import_lib = /* @__PURE__ */ require_chunk.__toESM(require_lib());
/** 冲突解决器 DI 标识符 */
var ConflictResolver = Symbol("ConflictResolver");
//#endregion
//#region ../../packages/history-migration/src/common/conflict/conflict-resolver.ts
/**
* 冲突解决器实现
*
* 检测源数据与目标项目之间的会话冲突，并根据策略进行解决
*/
var ConflictResolverImpl = class ConflictResolverImpl {
	/**
	* 检测源会话与目标项目之间的冲突
	*
	* @param sourceSession - 源会话数据（包含 sessionId 和 items）
	* @param targetProject - 目标项目路径（项目的 hash 路径，如 ~/.codebuddy/projects/{projectHash}）
	* @returns 检测到的冲突列表
	*/
	async detectConflicts(sourceSession, targetProject) {
		const conflicts = [];
		if (!sourceSession || !sourceSession.sessionId) return conflicts;
		const sessionId = sourceSession.sessionId;
		const sessionFileName = `${sessionId}${CONSTANTS.FILES.SESSION_EXT}`;
		const sessionFilePath = path.join(targetProject, sessionFileName);
		if (await import_lib.pathExists(sessionFilePath)) {
			const targetContent = await this.readTargetSession(sessionFilePath);
			if (targetContent.length === 0) return conflicts;
			conflicts.push({
				type: "session-exists",
				sourceSessionId: sessionId,
				targetSessionId: sessionId,
				details: {
					targetPath: sessionFilePath,
					targetItemCount: targetContent.length,
					sourceItemCount: Array.isArray(sourceSession.items) ? sourceSession.items.length : 0
				},
				suggestedResolution: "skip"
			});
			if (Array.isArray(sourceSession.items) && targetContent.length > 0) {
				const duplicateCount = this.countDuplicateMessages(sourceSession.items, targetContent);
				if (duplicateCount > 0) conflicts.push({
					type: "duplicate-messages",
					sourceSessionId: sessionId,
					targetSessionId: sessionId,
					details: {
						duplicateCount,
						totalSourceItems: sourceSession.items.length,
						totalTargetItems: targetContent.length
					},
					suggestedResolution: "merge"
				});
			}
			if (Array.isArray(sourceSession.items) && targetContent.length > 0) {
				const timeConflict = this.detectTimeConflict(sourceSession.items, targetContent);
				if (timeConflict) conflicts.push({
					type: "time-conflict",
					sourceSessionId: sessionId,
					targetSessionId: sessionId,
					details: timeConflict,
					suggestedResolution: "overwrite"
				});
			}
		}
		return conflicts;
	}
	/**
	* 解决单个冲突
	*
	* @param conflict - 冲突信息
	* @param strategy - 合并策略
	* @returns 解决结果
	*/
	async resolveConflict(conflict, strategy) {
		const conflictId = `${conflict.type}:${conflict.sourceSessionId}`;
		switch (strategy) {
			case "source": return {
				conflictId,
				resolution: "overwrite",
				message: `Overwriting target with source data for session ${conflict.sourceSessionId}`
			};
			case "target": return {
				conflictId,
				resolution: "skip",
				message: `Keeping target data, skipping source session ${conflict.sourceSessionId}`
			};
			case "merge": return this.resolveMerge(conflict, conflictId);
			default: return {
				conflictId,
				resolution: "error",
				message: `Unknown strategy: ${strategy}`
			};
		}
	}
	/**
	* 批量解决冲突
	*
	* @param conflicts - 冲突列表
	* @param strategy - 合并策略
	* @returns 解决结果列表
	*/
	async resolveConflicts(conflicts, strategy) {
		const resolutions = [];
		for (const conflict of conflicts) {
			const resolution = await this.resolveConflict(conflict, strategy);
			resolutions.push(resolution);
		}
		return resolutions;
	}
	/**
	* 读取目标 session 文件内容
	*/
	async readTargetSession(filePath) {
		try {
			return (await import_lib.readFile(filePath, "utf-8")).split("\n").filter((line) => line.trim().length > 0).map((line) => {
				try {
					return JSON.parse(line);
				} catch {
					return null;
				}
			}).filter((item) => item !== null);
		} catch {
			return [];
		}
	}
	/**
	* 统计源和目标之间的重复消息数量
	* 通过 id 字段匹配
	*/
	countDuplicateMessages(sourceItems, targetItems) {
		const targetIds = new Set(targetItems.map((item) => item.id).filter(Boolean));
		let count = 0;
		for (const item of sourceItems) if (item.id && targetIds.has(item.id)) count++;
		return count;
	}
	/**
	* 检测时间范围冲突
	* 如果源和目标的时间范围有重叠则返回冲突详情
	*/
	detectTimeConflict(sourceItems, targetItems) {
		const sourceTimestamps = sourceItems.map((i) => i.timestamp).filter((t) => typeof t === "number" && t > 0);
		const targetTimestamps = targetItems.map((i) => i.timestamp).filter((t) => typeof t === "number" && t > 0);
		if (sourceTimestamps.length === 0 || targetTimestamps.length === 0) return null;
		const sourceMin = Math.min(...sourceTimestamps);
		const sourceMax = Math.max(...sourceTimestamps);
		const targetMin = Math.min(...targetTimestamps);
		const targetMax = Math.max(...targetTimestamps);
		if (sourceMin <= targetMax && sourceMax >= targetMin) return {
			sourceTimeRange: {
				min: sourceMin,
				max: sourceMax
			},
			targetTimeRange: {
				min: targetMin,
				max: targetMax
			},
			overlapStart: Math.max(sourceMin, targetMin),
			overlapEnd: Math.min(sourceMax, targetMax)
		};
		return null;
	}
	/**
	* 解决 merge 策略
	* 根据冲突类型决定具体合并行为
	*/
	resolveMerge(conflict, conflictId) {
		switch (conflict.type) {
			case "session-exists": return {
				conflictId,
				resolution: "skip",
				message: `Keeping existing target session ${conflict.sourceSessionId}`
			};
			case "duplicate-messages": return {
				conflictId,
				resolution: "merge",
				message: `Merging non-duplicate messages for session ${conflict.sourceSessionId}, skipping ${conflict.details.duplicateCount} duplicates`
			};
			case "time-conflict": return {
				conflictId,
				resolution: "overwrite",
				message: `Time conflict detected for session ${conflict.sourceSessionId}, overwriting with source data`
			};
			default: return {
				conflictId,
				resolution: "error",
				message: `Cannot merge unknown conflict type for session ${conflict.sourceSessionId}`
			};
		}
	}
};
ConflictResolverImpl = require_common$1.__decorate([(0, import_common.Component)(ConflictResolver)], ConflictResolverImpl);
//#endregion
//#region ../../packages/history-migration/src/common/utils/blob-extractor.ts
/**
* Blob extraction utility for history migration
*
* Extracts base64-encoded images from old message data,
* writes them as separate blob files to the target blob store,
* and returns ImageBlobRef references for use in migrated JSONL.
*
* Blob storage is content-addressed by SHA-256 hash,
* ensuring idempotent writes and automatic deduplication.
*/
/** Default maximum blob size: 100 MB */
var DEFAULT_MAX_BLOB_SIZE = 104857600;
/** MIME type to file extension mapping */
var MIME_EXT_MAP = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/gif": "gif",
	"image/webp": "webp",
	"image/svg+xml": "svg",
	"image/bmp": "bmp",
	"image/tiff": "tiff"
};
/** Default extension for unknown MIME types */
var DEFAULT_EXT = "bin";
/**
* Content-addressed blob extractor for history migration.
*
* Converts base64-encoded image data into separate blob files,
* stored at `{basePath}/blobs/{sha256[0:2]}/{sha256}.{ext}`.
*
* Features:
* - Content-addressed: same binary data → same blobId → single file
* - Idempotent: existing blobs are not overwritten
* - Graceful: extraction failures are reported, never thrown
*/
var BlobExtractor = class BlobExtractor {
	constructor(config) {
		this.stats = {
			extracted: 0,
			totalSize: 0,
			skipped: 0
		};
		if (!config.basePath) throw new Error("BlobExtractor: basePath is required");
		this.config = config;
		this.maxBlobSize = config.maxBlobSize ?? DEFAULT_MAX_BLOB_SIZE;
	}
	/**
	* Extract a blob from a data URI string.
	*
	* @param dataUri - Full data URI (e.g. "data:image/jpeg;base64,/9j/4AAQ...")
	* @param source - Optional source path for provenance tracking
	* @param originalFilename - Optional original filename from source
	* @returns Extraction result, or undefined on failure
	*/
	async extractFromDataUri(dataUri, source, originalFilename) {
		const parsed = BlobExtractor.parseDataUri(dataUri);
		if (!parsed) return;
		return this.extractFromBase64(parsed.base64, parsed.mime, source, originalFilename);
	}
	/**
	* Extract a blob from raw base64 data + MIME type.
	*
	* @param base64Data - Raw base64-encoded data (no data: prefix)
	* @param mime - MIME type (e.g. "image/jpeg")
	* @param source - Optional source path
	* @param originalFilename - Optional original filename
	* @returns Extraction result, or undefined on failure
	*/
	async extractFromBase64(base64Data, mime, source, originalFilename) {
		try {
			const buffer = Buffer.from(base64Data, "base64");
			if (buffer.length > this.maxBlobSize) return;
			if (buffer.length === 0) return;
			const blobId = crypto.createHash("sha256").update(buffer).digest("hex");
			const blobPath = this.computeBlobPath(blobId, mime);
			const alreadyExists = fs.existsSync(blobPath);
			if (!alreadyExists) {
				const dir = path.dirname(blobPath);
				fs.mkdirSync(dir, { recursive: true });
				fs.writeFileSync(blobPath, buffer);
			}
			if (alreadyExists) this.stats.skipped++;
			this.stats.extracted++;
			this.stats.totalSize += buffer.length;
			return {
				blobId,
				blobPath,
				mime,
				size: buffer.length,
				source,
				originalFilename,
				alreadyExists
			};
		} catch {
			return;
		}
	}
	/**
	* Build an ImageBlobRef from a BlobExtractResult.
	*/
	buildImageBlobRef(result) {
		return {
			type: "image_blob_ref",
			blob_id: result.blobId,
			mime: result.mime,
			size: result.size,
			source: result.source,
			blob_path: result.blobPath,
			original_filename: result.originalFilename
		};
	}
	/**
	* Get accumulated extraction statistics.
	*/
	getStats() {
		return { ...this.stats };
	}
	/**
	* Compute the full blob file path.
	*
	* Format: {basePath}/blobs/{sha256[0:2]}/{sha256}.{ext}
	*/
	computeBlobPath(blobId, mime) {
		const prefix = blobId.substring(0, 2);
		const ext = BlobExtractor.mimeToExt(mime);
		return path.join(this.config.basePath, CONSTANTS.PATHS.BLOBS_DIR, prefix, `${blobId}.${ext}`);
	}
	/**
	* Map MIME type to file extension.
	*/
	static mimeToExt(mime) {
		return MIME_EXT_MAP[mime] ?? DEFAULT_EXT;
	}
	/**
	* Parse a data URI into its components.
	*
	* @returns Object with mime and base64, or undefined if invalid
	*/
	static parseDataUri(dataUri) {
		const match = dataUri.match(/^data:([^;]+);base64,(.+)$/s);
		if (!match) return;
		return {
			mime: match[1],
			base64: match[2]
		};
	}
};
//#endregion
//#region ../../packages/history-migration/src/common/converters/converter-protocol.ts
/** 转换器 DI 标识符 */
var DataConverter = Symbol("DataConverter");
//#endregion
//#region ../../packages/history-migration/src/common/converters/data-converter.ts
/**
* 数据格式转换器实现
*
* 将 agent-history 格式的数据转换为 agent-cli JSONL 格式，
* 包括消息转换、工具调用提取、消息链构建、请求分组、图像处理等。
*/
require_common$1.init_decorate();
/**
* WorkBuddy → cbc 工具名映射表
*
* 映射原则（三重原则）：
* 1. 无损映射：CB tool 能无损转为 CBC tool，参数字段兼容 → 直接映射
* 2. 有损映射：CB tool 和 CBC 有对应但字段不兼容 → 按 CBC 方式渲染，接受不一致
* 3. 不匹配：CB tool 在 CBC 找不到对应 → 不映射，保留原名，由前端原有渲染器处理
*
* 未在此表中的 CB 工具名会保留原名透传（fallback: TOOL_NAME_MAP[name] || name）
*/
var TOOL_NAME_MAP = {
	"read_file": "Read",
	"write_to_file": "Write",
	"replace_in_file": "Edit",
	"execute_command": "Bash",
	"update_task": "TaskUpdate",
	"list_tasks": "TaskList",
	"web_fetch": "WebFetch",
	"web_search": "WebSearch",
	"image_gen": "ImageGen",
	"use_skill": "Skill",
	"search_file": "Grep",
	"search_content": "Grep",
	"ask_followup_question": "AskUserQuestion",
	"lsp": "LSP",
	"delete_file": "Bash"
};
/**
* 将 WorkBuddy 工具结果转换为 cbc 原生展示格式
*
* 仅对已映射到 CBC 工具名的工具做结果转换（原则1/2的工具）。
* 保留原名的工具（原则3）不做转换，返回 undefined，
* 让原始结构化数据以 JSON 形式保留，供前端渲染器直接使用。
*/
function transformToolResultToCbc(toolName, innerResult) {
	if (!innerResult || typeof innerResult !== "object") return;
	if (!TOOL_NAME_MAP[toolName]) return;
	switch (innerResult.type) {
		case "read_file_result": return innerResult.content || "";
		case "write_to_file_result":
			if (innerResult.isNewFile) return `Successfully created and wrote to new file: ${innerResult.path || ""}`;
			return `Successfully wrote to file: ${innerResult.path || ""}`;
		case "replace_in_file_result": return `Successfully edited file: ${innerResult.path || ""}`;
		case "execute_command_result": {
			const parts = [];
			if (innerResult.stdout) parts.push(`Stdout: ${innerResult.stdout}`);
			if (innerResult.stderr) parts.push(`Stderr: ${innerResult.stderr}`);
			if (innerResult.exitCode !== void 0) parts.push(`Exit Code: ${innerResult.exitCode}`);
			return parts.join("\n") || "Command executed successfully";
		}
		case "search_file_result":
			if (Array.isArray(innerResult.results)) return innerResult.results.map((r) => typeof r === "string" ? r : JSON.stringify(r)).join("\n") || "No results found";
			return "No results found";
		case "multi_question_result":
			if (innerResult.message) return innerResult.message;
			if (Array.isArray(innerResult.answers)) return innerResult.answers.map((a) => typeof a === "string" ? a : JSON.stringify(a)).join("\n");
			return JSON.stringify(innerResult, null, 2);
		case "open_result_view_result": return innerResult.message || `Opened: ${innerResult.targetFile || ""}`;
		default: return;
	}
}
var DataConverterImpl = class DataConverterImpl {
	constructor() {
		this.context = null;
		this.statistics = this.createEmptyStatistics();
	}
	/**
	* 初始化转换器
	*
	* @param context - 转换上下文，包含源路径、目标路径、选项等
	*/
	async initialize(context) {
		if (!context) throw new Error("context must not be null");
		if (!context.projectHash) throw new Error("projectHash must not be empty");
		if (!context.sourceWorkspacePath) throw new Error("sourceWorkspacePath must not be empty");
		if (!context.targetProjectPath) throw new Error("targetProjectPath must not be empty");
		this.context = context;
		this.statistics = this.createEmptyStatistics();
		if (context.options?.extractImagesToBlobs !== false && context.basePath) this.blobExtractor = new BlobExtractor({
			basePath: context.basePath,
			maxBlobSize: context.options?.maxBlobSize
		});
	}
	/**
	* 转换单个会话
	*
	* @param conversation - agent-history 格式的会话对象
	* @param messages - 该会话的所有消息
	* @param conversationIndex - 可选的会话索引（包含请求和消息元信息）
	* @param fileTreeNodes - 可选的文件树节点数组（来自 file-tree.json）
	* @returns agent-cli 格式的会话对象（包含 JSONL 记录）
	*/
	async convertConversation(conversation, messages, conversationIndex, fileTreeNodes) {
		this.ensureInitialized();
		const startTime = Date.now();
		try {
			this.currentConversationCwd = (this.context?.sessionMetadataMap?.get(conversation.id))?.cwd;
			const sessionId = this.generateSessionId(conversation.id);
			const items = [];
			if (conversationIndex && conversationIndex.requests.length > 0) {
				const messageMap = this.buildMessageMap(messages);
				await this.convertByRequests(conversationIndex, messageMap, sessionId, items);
			} else await this.convertByTimestamp(messages, sessionId, items);
			this.assignUsageToLastAssistantPerRequest(items, conversationIndex);
			if (fileTreeNodes && fileTreeNodes.length > 0) {
				const lastItemId = items.length > 0 ? items[items.length - 1].id : void 0;
				const { items: snapshotItems } = this.convertFileTreeToSnapshotItems(fileTreeNodes, sessionId, lastItemId);
				items.push(...snapshotItems);
			}
			if (conversation.name) {
				const customTitleItem = {
					id: crypto.randomUUID(),
					type: "custom-title",
					customTitle: conversation.name,
					sessionId,
					timestamp: conversation.createdAt ? new Date(conversation.createdAt).getTime() : Date.now()
				};
				items.push(customTitleItem);
			}
			this.statistics.totalMessages += messages.length;
			this.statistics.successful++;
			const duration = Date.now() - startTime;
			this.updateAverageConversionTime(duration);
			const meta = {
				migratedFrom: "agent-history",
				migratedAt: (/* @__PURE__ */ new Date()).toISOString(),
				sourceConversationId: conversation.id,
				messageCount: messages.length,
				itemCount: items.length,
				requestCount: conversationIndex?.requests.length ?? 0
			};
			const sessionMeta = this.context?.sessionMetadataMap?.get(conversation.id);
			if (sessionMeta) {
				if (sessionMeta.isPlayground !== void 0) meta.isPlayground = sessionMeta.isPlayground;
				if (sessionMeta.cwd) meta.cwd = sessionMeta.cwd;
			}
			const sessionModel = this.extractSessionModel(messages);
			if (sessionModel) meta.model = sessionModel;
			return {
				sessionId,
				conversationId: conversation.id,
				name: conversation.name,
				type: conversation.type,
				createdAt: conversation.createdAt,
				items,
				meta
			};
		} catch (err) {
			this.statistics.failed++;
			throw err;
		} finally {
			this.currentConversationCwd = void 0;
		}
	}
	/**
	* 流式转换单个会话：按 request 分批读消息、转换、追加写入，避免 OOM。
	*
	* 原理：
	* - 有 conversationIndex 时，按 request 顺序分批读取（每批读该 request 涉及的消息 ID）
	* - 每批转换后通过 onBatch 回调交给调用方写入（appendMode），写完后释放这批内存
	* - 无 conversationIndex 时退化为全量读取（回退模式，无法分批）
	*
	* @param conversation - 会话对象
	* @param conversationIndex - 会话索引（有则按 request 分批，无则退化全量）
	* @param readMessages - 按消息 ID 列表读取消息的函数
	* @param onBatch - 每批转换结果的回调（session 含 items，isFirst/isLast 控制写入模式）
	* @param fileTreeNodes - 可选的文件树节点数据
	*/
	async convertConversationStreaming(conversation, conversationIndex, readMessages, onItems, fileTreeNodes) {
		this.ensureInitialized();
		const sessionId = this.generateSessionId(conversation.id);
		this.currentConversationCwd = (this.context?.sessionMetadataMap?.get(conversation.id))?.cwd;
		let totalMessageCount = 0;
		let isFirst = true;
		const flush = async (items) => {
			if (items.length === 0) return;
			await onItems(sessionId, items, isFirst);
			isFirst = false;
		};
		try {
			if (conversationIndex && conversationIndex.requests.length > 0) {
				const requests = conversationIndex.requests;
				const allRequestMessageIds = /* @__PURE__ */ new Set();
				for (const req of requests) for (const id of req.messages) allRequestMessageIds.add(id);
				const orphanIds = conversationIndex.messages.map((m) => m.id).filter((id) => !allRequestMessageIds.has(id));
				let prevToolWasAskUserQuestion = false;
				let lastItemId;
				for (let ri = 0; ri < requests.length; ri++) {
					const request = requests[ri];
					const batchMessages = await readMessages(request.messages);
					totalMessageCount += batchMessages.length;
					const messageMap = this.buildMessageMap(batchMessages);
					const items = [];
					const firstUserMsgId = this.findFirstUserMessageId(request, messageMap);
					let lastAssistantMessageId;
					for (const msgId of request.messages) {
						const message = messageMap.get(msgId);
						if (message && this.normalizeRole(message.role) === "assistant") lastAssistantMessageId = msgId;
					}
					for (const msgId of request.messages) {
						const message = messageMap.get(msgId);
						if (!message) continue;
						const role = this.normalizeRole(message.role);
						if (role === "user" && prevToolWasAskUserQuestion) {
							if (this.extractQuestionAnswerFromMessage(message) !== void 0) {
								this.statistics.askUserQuestionAnswersSkipped++;
								prevToolWasAskUserQuestion = false;
								continue;
							}
						}
						if (role === "user") prevToolWasAskUserQuestion = false;
						else if (role === "tool") {
							const toolMeta = this.parseToolResultMeta(message);
							prevToolWasAskUserQuestion = toolMeta.name === "AskUserQuestion" || toolMeta.name === "ask_followup_question";
						} else prevToolWasAskUserQuestion = false;
						const isLastAssistant = role === "assistant" && msgId === lastAssistantMessageId;
						const convertedItems = await this.convertMessage(message, sessionId, lastItemId, firstUserMsgId, isLastAssistant ? request : void 0, request?.startedAt);
						for (const item of convertedItems) {
							items.push(item);
							lastItemId = item.id;
						}
					}
					this.assignUsageToLastAssistantPerRequest(items, conversationIndex);
					await flush(items);
				}
				if (orphanIds.length > 0) {
					const orphanMessages = await readMessages(orphanIds);
					totalMessageCount += orphanMessages.length;
					const items = [];
					for (const message of orphanMessages) {
						const convertedItems = await this.convertMessage(message, sessionId, lastItemId);
						for (const item of convertedItems) {
							items.push(item);
							lastItemId = item.id;
						}
					}
					this.assignUsageToLastAssistantPerRequest(items, conversationIndex);
					await flush(items);
				}
				const tailItems = [];
				if (fileTreeNodes && fileTreeNodes.length > 0) {
					const { items: snapshotItems } = this.convertFileTreeToSnapshotItems(fileTreeNodes, sessionId, lastItemId);
					tailItems.push(...snapshotItems);
					if (snapshotItems.length > 0) lastItemId = snapshotItems[snapshotItems.length - 1].id;
				}
				if (conversation.name) tailItems.push({
					id: crypto.randomUUID(),
					type: "custom-title",
					customTitle: conversation.name,
					sessionId,
					timestamp: conversation.createdAt ? new Date(conversation.createdAt).getTime() : Date.now()
				});
				await flush(tailItems);
			} else {
				const messages = await readMessages(conversationIndex?.messages.map((m) => m.id) ?? []);
				totalMessageCount = messages.length;
				const items = [];
				await this.convertByTimestamp(messages, sessionId, items);
				this.assignUsageToLastAssistantPerRequest(items, void 0);
				let lastItemId = items.length > 0 ? items[items.length - 1].id : void 0;
				if (fileTreeNodes && fileTreeNodes.length > 0) {
					const { items: snapshotItems } = this.convertFileTreeToSnapshotItems(fileTreeNodes, sessionId, lastItemId);
					items.push(...snapshotItems);
					if (snapshotItems.length > 0) lastItemId = snapshotItems[snapshotItems.length - 1].id;
				}
				if (conversation.name) items.push({
					id: crypto.randomUUID(),
					type: "custom-title",
					customTitle: conversation.name,
					sessionId,
					timestamp: conversation.createdAt ? new Date(conversation.createdAt).getTime() : Date.now()
				});
				await flush(items);
			}
		} finally {
			this.currentConversationCwd = void 0;
		}
		this.statistics.totalMessages += totalMessageCount;
		this.statistics.successful++;
		return { messageCount: totalMessageCount };
	}
	/**
	* 批量转换会话
	*
	* @param conversations - 会话数组
	* @param messagesMap - 会话 ID → 消息数组的映射
	* @param indexMap - 可选：会话 ID → 会话索引的映射
	* @param fileTreeMap - 可选：会话 ID → 文件树节点数组的映射
	* @returns 转换结果（成功/失败/统计）
	*/
	async convertBatch(conversations, messagesMap, indexMap, fileTreeMap) {
		this.ensureInitialized();
		const successful = [];
		const failed = [];
		for (let i = 0; i < conversations.length; i += CONSTANTS.CONCURRENCY.PARALLEL_CONVERSIONS) {
			const batch = conversations.slice(i, i + CONSTANTS.CONCURRENCY.PARALLEL_CONVERSIONS);
			const results = await Promise.allSettled(batch.map((conv) => {
				const messages = messagesMap.get(conv.id) || [];
				const convIndex = indexMap?.get(conv.id);
				const fileTree = fileTreeMap?.get(conv.id);
				return this.convertConversation(conv, messages, convIndex, fileTree);
			}));
			for (let j = 0; j < results.length; j++) {
				const result = results[j];
				const conv = batch[j];
				if (result.status === "fulfilled") successful.push(result.value);
				else failed.push({
					id: conv.id,
					error: result.reason?.message || "Unknown error"
				});
				this.statistics.totalProcessed++;
				if (this.context?.callbacks?.onProgress) this.context.callbacks.onProgress(this.statistics.totalProcessed, conversations.length, conv.id);
			}
		}
		return {
			successful,
			failed,
			statistics: { ...this.statistics }
		};
	}
	/**
	* 获取当前转换统计
	*/
	getStatistics() {
		return { ...this.statistics };
	}
	/**
	* Get accumulated blob extraction statistics.
	*/
	getBlobStats() {
		if (!this.blobExtractor) return {
			blobsExtracted: 0,
			totalBlobsSize: 0
		};
		const stats = this.blobExtractor.getStats();
		return {
			blobsExtracted: stats.extracted,
			totalBlobsSize: stats.totalSize
		};
	}
	/**
	* 验证转换后的会话数据
	*
	* @param session - 转换后的会话对象
	* @returns 验证是否通过
	*/
	async validateConversion(session) {
		if (!session.sessionId) return false;
		if (!Array.isArray(session.items)) return false;
		if (session.items.length === 0) return true;
		for (const item of session.items) if (!item.id || !item.type) return false;
		return true;
	}
	/**
	* 清理资源
	*/
	async dispose() {
		this.context = null;
	}
	ensureInitialized() {
		if (!this.context) throw new Error("DataConverter not initialized. Call initialize() first.");
	}
	/**
	* 创建空的统计对象
	*/
	createEmptyStatistics() {
		return {
			totalProcessed: 0,
			successful: 0,
			failed: 0,
			totalMessages: 0,
			totalSize: 0,
			averageConversionTime: 0,
			imagesExtracted: 0,
			checkpointsProcessed: 0,
			toolCallsConverted: 0,
			toolResultsConverted: 0,
			askUserQuestionAnswersSkipped: 0
		};
	}
	/**
	* 重写工具调用参数中的 brain 文件路径
	*
	* 将旧系统 globalStorage 下的 brain 路径替换为新系统的 brain 路径，
	* 使 agent-cli 的 extractOverviewArtifact() 能正确识别迁移后的产物文件。
	*/
	rewriteBrainPaths(args) {
		const mapping = this.context?.brainPathMapping;
		if (!mapping) return args;
		const filePath = args.file_path;
		if (typeof filePath !== "string") return args;
		const normalizedFilePath = filePath.replace(/\\/g, "/");
		const normalizedOldPrefix = mapping.oldPrefix.replace(/\\/g, "/");
		if (normalizedFilePath.startsWith(normalizedOldPrefix)) {
			const relativePath = normalizedFilePath.slice(normalizedOldPrefix.length);
			const newFilePath = mapping.newPrefix + relativePath;
			return {
				...args,
				file_path: newFilePath
			};
		}
		return args;
	}
	/**
	* 从 agent-history 会话 ID 生成 agent-cli 会话 ID
	*/
	generateSessionId(conversationId) {
		return conversationId;
	}
	/**
	* 构建消息 ID → 消息的映射
	*/
	buildMessageMap(messages) {
		const map = /* @__PURE__ */ new Map();
		for (const msg of messages) if (msg.id) map.set(msg.id, msg);
		return map;
	}
	/**
	* 按请求分组模式转换消息
	*
	* 使用 ConversationIndex 中的 request 信息，按照 request 的顺序处理消息，
	* 保证 parentId 链和 logicalParentId 的正确性
	*/
	async convertByRequests(conversationIndex, messageMap, sessionId, items) {
		let lastItemId;
		let prevToolWasAskUserQuestion = false;
		for (const request of conversationIndex.requests) {
			const firstUserMsgId = this.findFirstUserMessageId(request, messageMap);
			let lastAssistantMessageId;
			for (const msgId of request.messages) {
				const message = messageMap.get(msgId);
				if (message && this.normalizeRole(message.role) === "assistant") lastAssistantMessageId = msgId;
			}
			for (const msgId of request.messages) {
				const message = messageMap.get(msgId);
				if (!message) continue;
				const role = this.normalizeRole(message.role);
				if (role === "user" && prevToolWasAskUserQuestion) {
					if (this.extractQuestionAnswerFromMessage(message) !== void 0) {
						this.statistics.askUserQuestionAnswersSkipped++;
						prevToolWasAskUserQuestion = false;
						continue;
					}
				}
				if (role === "user") prevToolWasAskUserQuestion = false;
				else if (role === "tool") {
					const toolMeta = this.parseToolResultMeta(message);
					prevToolWasAskUserQuestion = toolMeta.name === "AskUserQuestion" || toolMeta.name === "ask_followup_question";
				} else prevToolWasAskUserQuestion = false;
				const isLastAssistant = this.normalizeRole(message.role) === "assistant" && msgId === lastAssistantMessageId;
				const convertedItems = await this.convertMessage(message, sessionId, lastItemId, firstUserMsgId, isLastAssistant ? request : void 0, request?.startedAt);
				for (const item of convertedItems) {
					items.push(item);
					lastItemId = item.id;
				}
			}
		}
		const processedIds = /* @__PURE__ */ new Set();
		for (const req of conversationIndex.requests) for (const msgId of req.messages) processedIds.add(msgId);
		for (const [msgId, message] of messageMap) if (!processedIds.has(msgId)) {
			const convertedItems = await this.convertMessage(message, sessionId, lastItemId);
			for (const item of convertedItems) {
				items.push(item);
				lastItemId = item.id;
			}
		}
	}
	/**
	* 按时间排序模式转换消息（回退模式）
	*/
	async convertByTimestamp(messages, sessionId, items) {
		const sortedMessages = [...messages].sort((a, b) => {
			return this.getTimestamp(a) - this.getTimestamp(b);
		});
		let lastItemId;
		for (const msg of sortedMessages) {
			const convertedItems = await this.convertMessage(msg, sessionId, lastItemId);
			for (const item of convertedItems) {
				items.push(item);
				lastItemId = item.id;
			}
		}
	}
	/**
	* 将单条消息转换为 agent-cli JSONL 格式的记录数组
	*
	* 一条 agent-history 消息可能产生多条 JSONL 记录，
	* 例如一条 assistant 消息中包含文本 + 工具调用，会拆分为：
	* - 1 条 message (role=assistant) 记录
	* - N 条 function_call 记录
	*
	* @param message - agent-history 原始消息
	* @param sessionId - 目标会话 ID
	* @param previousItemId - 前一条记录的 ID（用于 parentId 链）
	* @param logicalParentId - 逻辑父节点 ID（请求的首条用户消息 ID）
	* @param request - 所属的请求索引信息
	* @returns AgentCliItem 数组
	*/
	/**
	* 将 file-tree.json 中的 FileTreeNode 数据转换为 file-history-snapshot items
	*
	* 每个有版本历史的文件节点生成一个 file-history-snapshot item，
	* 使 agent-cli 的 CheckpointUtils 可从中构建可回退的 checkpoint。
	*/
	convertFileTreeToSnapshotItems(fileTreeNodes, sessionId, lastItemId) {
		const items = [];
		if (!fileTreeNodes || fileTreeNodes.length === 0) return {
			items,
			lastItemId
		};
		const trackedFileBackups = {};
		let latestTime = 0;
		for (const node of fileTreeNodes) {
			if (!node || node.type !== "file" || !node.filePath) continue;
			const versions = node.versions;
			if (!Array.isArray(versions) || versions.length === 0) continue;
			const latestVersion = versions[versions.length - 1];
			const createTime = latestVersion.createTime ? new Date(latestVersion.createTime).getTime() : 0;
			trackedFileBackups[node.filePath] = {
				version: versions.length,
				backupTime: createTime || Date.now()
			};
			if (createTime > latestTime) latestTime = createTime;
		}
		if (Object.keys(trackedFileBackups).length === 0) return {
			items,
			lastItemId
		};
		const snapshotId = crypto.randomUUID();
		const snapshotItem = {
			id: snapshotId,
			type: "file-history-snapshot",
			timestamp: latestTime || Date.now(),
			sessionId,
			isSnapshotUpdate: false,
			snapshot: {
				messageId: lastItemId || snapshotId,
				trackedFileBackups
			}
		};
		if (lastItemId !== void 0) snapshotItem.parentId = lastItemId;
		items.push(snapshotItem);
		this.statistics.checkpointsProcessed++;
		return {
			items,
			lastItemId: snapshotId
		};
	}
	/**
	* 将 plan-task 中的 PlanContextItem 数据转换为 agent-cli 的 TodoToolItem 格式
	*
	* 状态映射:
	*   'waiting'     → 'pending'
	*   'in-progress' → 'in_progress'
	*   'completed'   → 'completed'
	*   'error'       → 'pending'（error 无对应，回退到 pending）
	*
	* @param planTasks - PlanContextItem 数组
	* @returns TodoToolItem 格式的 todos 数组，如果输入为空返回空数组
	*/
	convertPlanTasksToTodos(planTasks) {
		if (!planTasks || planTasks.length === 0) return [];
		const statusMap = {
			"waiting": "pending",
			"in-progress": "in_progress",
			"completed": "completed",
			"error": "pending"
		};
		const todos = [];
		for (const task of planTasks) {
			if (!task || !task.title) continue;
			const todo = {
				content: task.title,
				status: statusMap[task.status] || "pending",
				activeForm: task.description || task.title
			};
			todos.push(todo);
		}
		return todos;
	}
	/**
	* Convert plan-task items to new TaskItem format
	*
	* Maps PlanContextItem fields to TaskItem fields:
	*   - title → subject
	*   - description → description + activeForm
	*   - status: waiting→pending, in-progress→in_progress, completed→completed, error→pending
	*   - id: auto-increment from "1"
	*   - createdAt/updatedAt: current timestamp
	*
	* @param planTasks - PlanContextItem array
	* @returns TaskItem format array, empty array if input is empty
	*/
	convertPlanTasksToNewTasks(planTasks) {
		if (!planTasks || planTasks.length === 0) return [];
		const statusMap = {
			"waiting": "pending",
			"in-progress": "in_progress",
			"completed": "completed",
			"error": "pending"
		};
		const now = Date.now();
		const tasks = [];
		let idCounter = 1;
		for (const planTask of planTasks) {
			if (!planTask || !planTask.title) continue;
			const task = {
				id: String(idCounter),
				subject: planTask.title,
				description: planTask.description || planTask.title,
				activeForm: planTask.description || planTask.title,
				status: statusMap[planTask.status] || "pending",
				createdAt: now,
				updatedAt: now
			};
			tasks.push(task);
			idCounter++;
		}
		return tasks;
	}
	async convertMessage(message, sessionId, previousItemId, logicalParentId, request, fallbackTimestamp) {
		const results = [];
		const role = this.normalizeRole(message.role);
		const messageId = message.id || crypto.randomUUID();
		const timestamp = this.getTimestamp(message) || fallbackTimestamp || 0;
		if (role === "assistant") {
			const parsed = this.parseAssistantContent(message.message);
			const assistantItem = {
				id: messageId,
				type: "message",
				role: "assistant",
				sessionId,
				timestamp
			};
			if (previousItemId !== void 0) assistantItem.parentId = previousItemId;
			if (logicalParentId) assistantItem.logicalParentId = logicalParentId;
			const contentBlocks = [];
			if (parsed.textContent) contentBlocks.push({
				type: "output_text",
				text: parsed.textContent
			});
			else if (!parsed.toolCalls.length) {
				const fallbackText = typeof message.message === "string" ? message.message : "";
				if (fallbackText) contentBlocks.push({
					type: "output_text",
					text: fallbackText
				});
			}
			if (contentBlocks.length > 0) assistantItem.content = contentBlocks;
			else assistantItem.content = [];
			if (parsed.reasoningContent) {
				const reasoningItem = {
					id: crypto.randomUUID(),
					type: "reasoning",
					sessionId,
					timestamp,
					content: [],
					rawContent: [{
						type: "reasoning_text",
						text: parsed.reasoningContent
					}]
				};
				if (previousItemId !== void 0) reasoningItem.parentId = previousItemId;
				results.push(reasoningItem);
				assistantItem.parentId = reasoningItem.id;
			}
			this.attachDisplayMetadata(assistantItem, message);
			this.attachModelInfo(assistantItem, message);
			results.push(assistantItem);
			for (const tc of parsed.toolCalls) {
				const args = this.rewriteBrainPaths(tc.args ?? {});
				const callItem = {
					id: tc.toolCallId || crypto.randomUUID(),
					type: "function_call",
					callId: tc.toolCallId || crypto.randomUUID(),
					name: tc.toolName,
					arguments: JSON.stringify(args),
					status: "completed",
					sessionId,
					timestamp
				};
				callItem.parentId = messageId;
				if (logicalParentId) callItem.logicalParentId = logicalParentId;
				results.push(callItem);
				this.statistics.toolCallsConverted++;
			}
		} else if (role === "tool") {
			const resultItem = {
				id: messageId,
				type: "function_call_result",
				sessionId,
				timestamp
			};
			const toolMeta = this.parseToolResultMeta(message);
			if (toolMeta.callId) resultItem.callId = toolMeta.callId;
			if (toolMeta.name) resultItem.name = toolMeta.name;
			resultItem.status = toolMeta.isError ? "incomplete" : "completed";
			const { outputObj, toolResult, workbuddyToolResult } = this.parseToolResultOutput(message, toolMeta);
			resultItem.output = outputObj;
			if (toolResult || workbuddyToolResult) {
				resultItem.providerData = {};
				if (toolResult) resultItem.providerData.toolResult = toolResult;
				if (workbuddyToolResult) resultItem.providerData.workbuddyToolResult = workbuddyToolResult;
			}
			if (previousItemId !== void 0) resultItem.parentId = previousItemId;
			if (logicalParentId) resultItem.logicalParentId = logicalParentId;
			this.attachDisplayMetadata(resultItem, message);
			results.push(resultItem);
			this.statistics.toolResultsConverted++;
		} else {
			const isCompacted = this.extractIsCompactedFromMessage(message);
			const item = {
				id: messageId,
				type: "message",
				role,
				sessionId,
				timestamp
			};
			if (isCompacted) {
				const cbSummary = this.extractCbSummaryFromMessage(message);
				if (cbSummary) {
					const compactUserItem = {
						id: crypto.randomUUID(),
						type: "message",
						role: "user",
						sessionId,
						timestamp: timestamp > 1 ? timestamp - 2 : Math.max(0, timestamp - 1),
						content: "/compact",
						providerData: {
							agent: "compact",
							isCompactInternal: true,
							skipRun: true
						}
					};
					if (previousItemId !== void 0) compactUserItem.logicalParentId = previousItemId;
					results.push(compactUserItem);
					const compactAssistantItem = {
						id: crypto.randomUUID(),
						type: "message",
						role: "assistant",
						sessionId,
						timestamp: timestamp > 0 ? timestamp - 1 : timestamp,
						parentId: compactUserItem.id,
						content: [{
							type: "output_text",
							text: `<conversation_history_summary>\n<summary>\n${cbSummary}\n</summary>\n</conversation_history_summary>`
						}],
						providerData: { agent: "compact" }
					};
					results.push(compactAssistantItem);
					previousItemId = compactAssistantItem.id;
					item.parentId = compactAssistantItem.id;
				} else if (previousItemId !== void 0) item.logicalParentId = previousItemId;
				if (!item.providerData) item.providerData = {};
				item.providerData.isCompactInternal = true;
			} else {
				if (previousItemId !== void 0) item.parentId = previousItemId;
				if (logicalParentId) item.logicalParentId = logicalParentId;
			}
			const content = await this.convertUserMessageContent(message);
			if (content !== void 0) item.content = content;
			if (message.references && Array.isArray(message.references) && message.references.length > 0) {
				if (!item.providerData) item.providerData = {};
				item.providerData.references = await this.migrateReferencesImages(message.references);
			}
			const questionAnswer = this.extractQuestionAnswerFromMessage(message);
			if (questionAnswer) {
				if (!item.providerData) item.providerData = {};
				item.extra = { questionAnswer };
			}
			this.attachDisplayMetadata(item, message);
			results.push(item);
		}
		if (request?.usage && role === "assistant") {
			const lastItem = results[0];
			if (lastItem) {
				if (!lastItem.providerData) lastItem.providerData = {};
				lastItem.providerData._pendingUsage = {
					input_tokens: request.usage.inputTokens,
					output_tokens: request.usage.outputTokens,
					total_tokens: request.usage.totalTokens
				};
			}
		}
		if (role === "assistant" && message.references && Array.isArray(message.references) && message.references.length > 0) {
			const assistantItem = results[0];
			if (assistantItem) {
				if (!assistantItem.providerData) assistantItem.providerData = {};
				assistantItem.providerData.references = await this.migrateReferencesImages(message.references);
			}
		}
		if (this.blobExtractor) this.statistics.imagesExtracted = this.blobExtractor.getStats().extracted;
		else if (this.context?.options?.extractImagesToBlobs && message.content) {
			const images = this.extractImages(message.content);
			if (images.length > 0) this.statistics.imagesExtracted += images.length;
		}
		return results;
	}
	/**
	* 查找请求中的第一条用户消息 ID（用于 logicalParentId）
	*/
	findFirstUserMessageId(request, messageMap) {
		for (const msgId of request.messages) {
			const msg = messageMap.get(msgId);
			if (msg && this.normalizeRole(msg.role) === "user") return msgId;
		}
	}
	/**
	* 解析 assistant 消息的 JSON content
	*
	* agent-history 中 assistant 消息的 message 字段是一个 JSON 字符串，
	* 解析后可能包含：
	* - content: string（纯文本）
	* - content: Array<{type: 'text', text: string} | {type: 'tool-call', toolCallId, toolName, args}>
	*/
	parseAssistantContent(messageContent) {
		const result = {
			textContent: "",
			toolCalls: [],
			reasoningContent: ""
		};
		if (!messageContent) return result;
		let parsed;
		if (typeof messageContent === "string") try {
			parsed = JSON.parse(messageContent);
		} catch {
			result.textContent = messageContent;
			return result;
		}
		else if (typeof messageContent === "object") parsed = messageContent;
		else {
			result.textContent = String(messageContent);
			return result;
		}
		const content = parsed.content;
		if (Array.isArray(content)) {
			for (const part of content) if (part.type === "text" && part.text) result.textContent += part.text;
			else if (part.type === "tool-call") {
				const callId = part.toolCallId || part.tool_call_id || crypto.randomUUID();
				const rawToolName = part.toolName || part.tool_name || "unknown";
				const toolName = TOOL_NAME_MAP[rawToolName] || rawToolName;
				result.toolCalls.push({
					toolCallId: callId,
					toolName,
					args: part.args ?? part.arguments ?? {}
				});
			} else if ((part.type === "reasoning" || part.type === "reasoning_content") && part.text) result.reasoningContent += part.text;
		} else if (typeof content === "string") result.textContent = content;
		return result;
	}
	/**
	* 从 tool role 消息中提取 callId、name 和错误状态
	*/
	parseToolResultMeta(message) {
		if (message.toolCallId) return {
			callId: message.toolCallId,
			name: message.toolName
		};
		if (typeof message.message === "string") try {
			const parsed = JSON.parse(message.message);
			if (parsed.role === "tool" && Array.isArray(parsed.content) && parsed.content.length > 0) {
				const toolResult = parsed.content[0];
				if (toolResult.type === "tool-result") {
					const rawName = toolResult.toolName;
					return {
						callId: toolResult.toolCallId,
						name: TOOL_NAME_MAP[rawName] || rawName,
						isError: toolResult.isError === true
					};
				}
			}
			if (parsed.toolCallId) return {
				callId: parsed.toolCallId,
				name: parsed.toolName
			};
			if (parsed.tool_call_id) return {
				callId: parsed.tool_call_id,
				name: parsed.tool_name
			};
		} catch {}
		if (message.extra) try {
			const extra = typeof message.extra === "string" ? JSON.parse(message.extra) : message.extra;
			if (extra.toolCallId) return {
				callId: extra.toolCallId,
				name: extra.toolName
			};
			if (extra.tool_call_id) return {
				callId: extra.tool_call_id,
				name: extra.tool_name
			};
		} catch {}
		return {};
	}
	/**
	* 从 tool role 消息中解析工具结果输出
	*
	* 处理多种格式：
	* 1. 简单格式：message 是纯字符串 → 直接使用
	* 2. WorkBuddy 格式：message 是 JSON 字符串 {role: 'tool', content: [{type: 'tool-result', ...}]}
	* 3. 结构化格式：已解析的 JSON 对象
	*
	* 返回 cbc 格式的输出：
	* - outputObj: {type: 'text', text: '...'} 用于 item.output
	* - toolResult: 结构化对象用于 providerData.toolResult
	*/
	parseToolResultOutput(message, toolMeta) {
		let outputText = "";
		let errorText;
		let workbuddyToolResult;
		try {
			if (typeof message.message === "string") {
				const parsed = JSON.parse(message.message);
				if (parsed.role === "tool" && Array.isArray(parsed.content)) {
					for (const item of parsed.content) if (item.type === "tool-result") {
						if (item.isError) errorText = item.result?.errorMessage || JSON.stringify(item.result);
						else {
							const resultData = item.result?.result || item.result;
							if (resultData) {
								if (typeof resultData === "object") {
									const { snapshot, ...rest } = resultData;
									workbuddyToolResult = Object.keys(rest).length > 0 ? rest : void 0;
								}
								const cbcText = typeof resultData === "object" ? transformToolResultToCbc(item.toolName || "", resultData) : void 0;
								if (cbcText !== void 0) outputText = cbcText;
								else if (typeof resultData === "string") outputText = resultData;
								else outputText = JSON.stringify(resultData, null, 2);
							}
						}
						break;
					}
				}
				if (!outputText && !errorText) outputText = JSON.stringify(parsed, null, 2);
			} else if (typeof message.message === "object") outputText = JSON.stringify(message.message, null, 2);
		} catch {
			if (typeof message.message === "string") outputText = message.message;
			else outputText = JSON.stringify(message.message ?? "Tool executed");
		}
		if (!outputText && !errorText) outputText = "Tool execution completed";
		const output = {
			type: "text",
			text: errorText || outputText
		};
		const toolResult = { content: errorText || outputText };
		if (errorText) toolResult.error = errorText;
		return {
			outputObj: output,
			toolResult,
			workbuddyToolResult
		};
	}
	/**
	* 转换 user/system 消息内容为 ContentBlock[] 格式
	*
	* 对齐 agent-cli UserMessageItem.content 格式：
	*   [{type: 'input_text', text: '用户实际输入'}]
	*
	* 导入旧 history 时，优先从 extra.sourceContentBlocks 提取用户的实际输入
	* （不包含 system prompt）。这是迁移边界上的只读 legacy fallback；
	* 新链路不再写入 sourceContentBlocks。
	*
	* 如果旧消息没有该字段，再回退到 message.message 解析，最后使用 content 字段。
	*
	* When blob extraction is enabled, inline base64 images are stored as blob files
	* and replaced with ImageBlobRef references.
	*/
	async convertUserMessageContent(message) {
		const userContent = await this.extractUserInputContent(message);
		if (userContent && userContent.length > 0) return userContent;
		if (message.content) {
			if (Array.isArray(message.content)) {
				const blocks = [];
				for (const part of message.content) if (part.type === "text" && part.text) {
					const cleanedText = this.stripWorkbuddySystemXmlTags(part.text);
					if (cleanedText) blocks.push({
						type: "input_text",
						text: cleanedText
					});
				} else if (part.type === "image") {
					if (part.url) blocks.push({
						type: "input_image",
						image: { url: part.url }
					});
					else if (part.data) {
						const imageBlock = part.data.startsWith("data:") ? await this.extractImageDataUriToBlock(part.data) : await this.extractImageToBlock(part.data, part.mediaType || "image/jpeg");
						if (imageBlock) blocks.push(imageBlock);
					} else if (part.image) if (typeof part.image === "string" && part.image.startsWith("data:")) {
						const imageBlock = await this.extractImageDataUriToBlock(part.image);
						if (imageBlock) blocks.push(imageBlock);
					} else blocks.push({
						type: "input_image",
						image: part.image
					});
				}
				if (blocks.length > 0) return blocks;
			} else if (typeof message.content === "string") {
				const cleanedText = this.stripWorkbuddySystemXmlTags(message.content);
				if (cleanedText) return [{
					type: "input_text",
					text: cleanedText
				}];
			}
		}
		if (typeof message.message === "string") {
			try {
				const parsed = JSON.parse(message.message);
				if (typeof parsed.content === "string") {
					const cleanedText = this.stripWorkbuddySystemXmlTags(parsed.content);
					if (cleanedText) return [{
						type: "input_text",
						text: cleanedText
					}];
				}
				if (Array.isArray(parsed.content)) {
					const blocks = [];
					for (const p of parsed.content) if (p.type === "text" && p.text) {
						const cleanedText = this.stripWorkbuddySystemXmlTags(p.text);
						if (cleanedText) blocks.push({
							type: "input_text",
							text: cleanedText
						});
					} else if (p.type === "image") {
						if (typeof p.image === "string" && p.image.startsWith("data:")) {
							const imageBlock = await this.extractImageDataUriToBlock(p.image);
							if (imageBlock) blocks.push(imageBlock);
						} else if (p.data) {
							const imageBlock = p.data.startsWith("data:") ? await this.extractImageDataUriToBlock(p.data) : await this.extractImageToBlock(p.data, p.mediaType || "image/jpeg");
							if (imageBlock) blocks.push(imageBlock);
						}
					}
					if (blocks.length > 0) return blocks;
				}
			} catch {}
			const cleanedText = this.stripWorkbuddySystemXmlTags(message.message);
			if (cleanedText) return [{
				type: "input_text",
				text: cleanedText
			}];
		}
		if (message.message !== void 0 && message.message !== null) {
			const cleanedText = this.stripWorkbuddySystemXmlTags(String(message.message));
			if (cleanedText) return [{
				type: "input_text",
				text: cleanedText
			}];
		}
	}
	/**
	* Extract user input content blocks from legacy extra.sourceContentBlocks.
	*
	* In old agent-history format, the message.message field contains the full system prompt,
	* but extra.sourceContentBlocks contains only the user's actual input (text + images).
	* This reader exists only for history import compatibility.
	*
	* When blob extraction is enabled, image blocks are stored as blob files
	* and replaced with ImageBlobRef references.
	*/
	async extractUserInputContent(message) {
		if (!message.extra) return;
		try {
			const extra = typeof message.extra === "string" ? JSON.parse(message.extra) : message.extra;
			if (Array.isArray(extra.sourceContentBlocks)) {
				const blocks = [];
				for (const block of extra.sourceContentBlocks) if (block.type === "text" && block.text) {
					const cleanedText = this.stripWorkbuddySystemXmlTags(block.text);
					if (cleanedText) blocks.push({
						type: "input_text",
						text: cleanedText
					});
				} else if (block.type === "resource_link" && block.uri) blocks.push(this.convertResourceLinkToInputTextBlock(block.uri, block.name));
				else if (block.type === "image" && block.data) {
					let originalFilename;
					if (block.uri && typeof block.uri === "string") originalFilename = block.uri.split(/[\\/]/).pop();
					const imageBlock = await this.extractImageToBlock(block.data, block.mediaType || "image/jpeg", block.uri, originalFilename);
					if (imageBlock) blocks.push(imageBlock);
				}
				if (blocks.length > 0) return blocks;
			}
			if (Array.isArray(extra.inputPhrase)) {
				const phraseBlocks = this.convertInputPhraseToContentBlocks(extra.inputPhrase);
				if (phraseBlocks.length > 0) return phraseBlocks;
			}
		} catch {}
	}
	/**
	* 按 badge protocol v1 将旧 inputPhrase 数组转为 ContentBlock[]：
	*
	* - command → synthetic `command://` resource_link → 通过 codec 编码成 `/name` slash token
	* - file    → synthetic `file://<path>` resource_link → 通过 codec 编码成 `@path`
	* - folder  → synthetic `file://<path>/` resource_link → 通过 codec 编码成 `@path/`
	* - skill   → synthetic `skill://<name>` resource_link → 通过 codec 编码成 `@skill:name`
	* - img     → 无真实二进制来源，只能降级为可见文本（不凭空合成 blob，对齐迁移指南 §5.2）
	* - 其它   → 可见文本降级（editor/diff/commit/terminal/knowledge/topic 等，对齐 §7.2）
	*
	* 顺序严格按 phrase 数组索引保留。
	*/
	convertInputPhraseToContentBlocks(phrases) {
		const blocks = [];
		let pendingText = "";
		const flushPendingText = () => {
			if (pendingText.length > 0) {
				blocks.push({
					type: "input_text",
					text: pendingText
				});
				pendingText = "";
			}
		};
		for (const phrase of phrases) {
			if (!phrase || typeof phrase !== "object") continue;
			const type = typeof phrase.type === "string" ? phrase.type : "normal";
			const content = typeof phrase.content === "string" ? phrase.content : "";
			const expandContent = typeof phrase.expandContent === "string" ? phrase.expandContent : "";
			if (type === "normal" || type === "") {
				pendingText += content || expandContent;
				continue;
			}
			if (type === "command") {
				const commandUri = expandContent.startsWith("command://") ? expandContent : `command://${(content || expandContent).replace(/^\/+/, "")}`;
				const commandName = content || commandUri.slice(10);
				flushPendingText();
				blocks.push(this.convertResourceLinkToInputTextBlock(commandUri, commandName));
				continue;
			}
			if (type === "file" || type === "folder") {
				const rawPath = expandContent || content;
				if (!rawPath) continue;
				const fileUri = this.buildFileUri(rawPath, type === "folder");
				const displayName = content || rawPath.split(/[\\/]/).pop() || rawPath;
				flushPendingText();
				blocks.push(this.convertResourceLinkToInputTextBlock(fileUri, displayName));
				continue;
			}
			if (type === "skill") {
				const skillName = (content || expandContent).trim();
				if (!skillName) continue;
				const skillUri = `skill://${skillName.replace(/^skill:\/\//, "")}`;
				flushPendingText();
				blocks.push(this.convertResourceLinkToInputTextBlock(skillUri, skillName));
				continue;
			}
			if (type === "img") {
				const label = content || expandContent;
				if (label) pendingText += (pendingText ? "\n" : "") + label;
				continue;
			}
			const fallbackText = expandContent || content;
			if (fallbackText) pendingText += (pendingText ? "\n" : "") + fallbackText;
		}
		flushPendingText();
		return blocks;
	}
	/**
	* 将 phrase.expandContent 里的路径合成 file:// URI，用于走 codec。
	* 目录保留末尾 '/'；相对路径在有 cwd 时拼成绝对路径，没有就直接拼相对路径。
	*/
	buildFileUri(rawPath, isFolder) {
		let path = rawPath.trim();
		if (path.startsWith("file://")) {
			if (isFolder && !path.endsWith("/")) path += "/";
			return path;
		}
		if (path.startsWith("/")) {
			if (isFolder && !path.endsWith("/")) path += "/";
			return `file://${path}`;
		}
		const cwd = this.currentConversationCwd;
		if (cwd) {
			let absolute = `${cwd.endsWith("/") ? cwd.slice(0, -1) : cwd}/${path}`;
			if (isFolder && !absolute.endsWith("/")) absolute += "/";
			return `file://${absolute}`;
		}
		if (isFolder && !path.endsWith("/")) path += "/";
		return `file://${path}`;
	}
	convertResourceLinkToInputTextBlock(uri, name) {
		const relativePath = this.computeWorkspaceRelativePath(uri);
		const effectiveName = uri.startsWith("file://") && !relativePath ? void 0 : name;
		const encoded = require_tar.encodeAcpResourceLinkToInputText({
			uri,
			...effectiveName !== void 0 ? { name: effectiveName } : {},
			...relativePath ? { relativePath } : {}
		});
		return {
			type: "input_text",
			text: encoded.text,
			...encoded.providerData ? { providerData: encoded.providerData } : {}
		};
	}
	/**
	* 若 uri 是 file:// 且能落在当前会话 cwd 下，返回 workspace-relative POSIX 路径。
	* 目录保留末尾 '/'，文件不带。否则返回 undefined，让 codec 回退到绝对路径语义。
	*/
	computeWorkspaceRelativePath(uri) {
		if (!uri || !uri.startsWith("file://")) return;
		const cwd = this.currentConversationCwd;
		if (!cwd) return;
		const absolutePath = this.decodeFileUriPath(uri);
		if (!absolutePath) return;
		const isFolder = absolutePath.endsWith("/");
		const normalizedCwd = cwd.endsWith("/") ? cwd.slice(0, -1) : cwd;
		const trimmed = isFolder ? absolutePath.slice(0, -1) : absolutePath;
		if (trimmed === normalizedCwd) return isFolder ? "./" : void 0;
		const prefix = normalizedCwd + "/";
		if (!trimmed.startsWith(prefix)) return;
		const rel = trimmed.slice(prefix.length);
		if (!rel) return;
		return isFolder ? `${rel}/` : rel;
	}
	decodeFileUriPath(uri) {
		if (!uri.startsWith("file://")) return;
		const raw = uri.slice(7);
		try {
			return decodeURIComponent(raw);
		} catch {
			return raw;
		}
	}
	/**
	* Extract a base64 image to a blob file or return an inline content block.
	*
	* When blob extraction is enabled, the image is stored as a blob file and
	* the content block is a direct ImageBlobRef (same format as agent-cli native):
	*   { type: 'image_blob_ref', blob_id, mime, size, blob_path, original_filename }
	*
	* @param base64Data - Raw base64 data (no data: prefix)
	* @param mime - MIME type
	* @param source - Optional source file path
	* @param originalFilename - Optional original filename
	* @returns ContentBlock with ImageBlobRef or inline data
	*/
	async extractImageToBlock(base64Data, mime, source, originalFilename) {
		if (this.blobExtractor) {
			const result = await this.blobExtractor.extractFromBase64(base64Data, mime, source, originalFilename);
			if (result) return this.blobExtractor.buildImageBlobRef(result);
		}
		return {
			type: "input_image",
			image: {
				data: base64Data,
				mediaType: mime
			}
		};
	}
	/**
	* Extract a data URI image to a blob file or return an inline content block.
	*
	* When blob extraction is enabled, uses direct ImageBlobRef format
	* (same as agent-cli native).
	*
	* @param dataUri - Full data URI (data:mime;base64,...)
	* @param source - Optional source file path
	* @param originalFilename - Optional original filename
	* @returns ContentBlock with ImageBlobRef or inline data
	*/
	async extractImageDataUriToBlock(dataUri, source, originalFilename) {
		if (this.blobExtractor) {
			const result = await this.blobExtractor.extractFromDataUri(dataUri, source, originalFilename);
			if (result) return this.blobExtractor.buildImageBlobRef(result);
		}
		const parsed = BlobExtractor.parseDataUri(dataUri);
		if (parsed) return {
			type: "input_image",
			image: {
				data: parsed.base64,
				mediaType: parsed.mime
			}
		};
	}
	/**
	* 规范化消息角色
	*/
	normalizeRole(role) {
		return {
			"user": "user",
			"assistant": "assistant",
			"system": "system",
			"tool": "tool"
		}[role] || "user";
	}
	/**
	* 获取消息的时间戳（毫秒）
	*/
	getTimestamp(message) {
		if (message.timestamp && typeof message.timestamp === "number") return message.timestamp;
		if (message.createdAt) {
			const ts = new Date(message.createdAt).getTime();
			if (!isNaN(ts)) return ts;
		}
		if (message.updatedAt) {
			const ts = new Date(message.updatedAt).getTime();
			if (!isNaN(ts)) return ts;
		}
		return 0;
	}
	/**
	* 从消息内容中提取图像
	*/
	extractImages(content) {
		const images = [];
		if (typeof content === "string") {
			const dataUrlRegex = /data:image\/([a-z]+);base64,([A-Za-z0-9+/=]+)/g;
			let match;
			while ((match = dataUrlRegex.exec(content)) !== null) images.push({
				url: match[0],
				type: match[1]
			});
		} else if (Array.isArray(content)) {
			for (const item of content) if (item.type === "image" && item.url) images.push(item);
		} else if (content && typeof content === "object") {
			if (content.type === "image" && content.url) images.push(content);
		}
		return images;
	}
	/**
	* 将 token usage 分配到每个 request 的最后一条 assistant 消息
	*
	* 在 convertByRequests 模式下，只有最后一条 assistant 消息被标记了 _pendingUsage。
	* 这里将 _pendingUsage 临时标记转换为正式的 providerData.usage 字段。
	* 注意：cbc 的 getTotalUsage() 读取 providerData.usage，不是 message.usage。
	*/
	assignUsageToLastAssistantPerRequest(items, conversationIndex) {
		if (!conversationIndex) {
			for (const item of items) if (item.providerData?._pendingUsage) {
				delete item.providerData._pendingUsage;
				if (Object.keys(item.providerData).length === 0) delete item.providerData;
			}
			return;
		}
		for (const item of items) if (item.providerData?._pendingUsage) {
			const usage = item.providerData._pendingUsage;
			delete item.providerData._pendingUsage;
			item.providerData.usage = {
				input_tokens: usage.input_tokens,
				output_tokens: usage.output_tokens,
				total_tokens: usage.total_tokens
			};
			if (Object.keys(item.providerData).length === 0) delete item.providerData;
		}
	}
	/**
	* 从 WorkBuddy 用户消息中提取实际用户输入，移除系统注入的 XML 标签
	*
	* WorkBuddy 在用户消息中注入：
	* - <additional_data>：上下文信息（当前时间等）
	* - <system_reminder>：系统规则和记忆提醒
	* - <working_memory_reminder>：工作内存提醒
	* - <user_query>：包装的用户查询（可能包含 <question_answer>）
	* - <question_answer>：用户对问卷的回答
	*
	* 该函数提取实际用户输入，移除这些系统标签。
	*/
	stripWorkbuddySystemXmlTags(text) {
		if (!text) return text;
		text = text.replace(/<additional_data>[\s\S]*?<\/additional_data>\s*/g, "");
		text = text.replace(/<system_reminder>[\s\S]*?<\/system_reminder>\s*/g, "");
		text = text.replace(/<working_memory_reminder>[\s\S]*?<\/working_memory_reminder>\s*/g, "");
		const userQueryMatch = text.match(/<user_query>([\s\S]*?)<\/user_query>/);
		if (userQueryMatch) text = userQueryMatch[1];
		const answersMatches = text.match(/<answers>([\s\S]*?)<\/answers>/g);
		if (answersMatches && answersMatches.length > 0) {
			const answers = [];
			for (const match of answersMatches) {
				const content = match.replace(/<\/?answers>/g, "").trim();
				if (content) answers.push(content);
			}
			if (answers.length > 0) text = answers.join("\n");
			else text = text.replace(/<question_answer>[\s\S]*?<\/question_answer>\s*/g, "");
		} else {
			text = text.replace(/<\/?question_answer>/g, "");
			text = text.replace(/<\/?question_item[^>]*>/g, "");
			text = text.replace(/<\/?question>/g, "");
			text = text.replace(/<\/?answers>/g, "");
			text = text.replace(/<\/?title>/g, "");
			text = text.replace(/<\/?questions>/g, "");
		}
		text = text.trim();
		text = text.replace(/\n{3,}/g, "\n\n");
		return text;
	}
	/**
	* Migrate references by converting inline base64 data URIs in img-type
	* references to ImageBlobRef JSON strings.
	*
	* Source format: { type: 'img', data: ['data:image/jpeg;base64,...'], fileFrom: 'drag' }
	* Target format: { type: 'img', data: ['{"type":"image_blob_ref","blob_id":"...","mime":"...","size":...,"blob_path":"..."}'], fileFrom: 'drag' }
	*/
	async migrateReferencesImages(references) {
		if (!this.blobExtractor) return references;
		const migrated = [];
		for (const ref of references) {
			if (ref.type !== "img" || !Array.isArray(ref.data)) {
				migrated.push(ref);
				continue;
			}
			const newData = [];
			for (const item of ref.data) {
				if (typeof item !== "string") {
					newData.push(item);
					continue;
				}
				if (item.startsWith("{") && item.includes("image_blob_ref")) {
					newData.push(item);
					continue;
				}
				if (item.startsWith("data:")) {
					const result = await this.blobExtractor.extractFromDataUri(item, void 0, void 0);
					if (result) {
						const blobRef = this.blobExtractor.buildImageBlobRef(result);
						newData.push(JSON.stringify(blobRef));
						continue;
					}
				}
				newData.push(item);
			}
			migrated.push({
				...ref,
				data: newData
			});
		}
		return migrated;
	}
	/**
	* 从老消息的 extra.modelId 提取模型标识，写入 providerData.model。
	*/
	attachModelInfo(item, message) {
		if (!message.extra) return;
		try {
			const modelId = (typeof message.extra === "string" ? JSON.parse(message.extra) : message.extra)?.modelId;
			if (typeof modelId === "string" && modelId.trim()) {
				if (!item.providerData) item.providerData = {};
				item.providerData.model = modelId;
			}
		} catch {}
	}
	/**
	* 从会话的消息列表中提取第一个可用的 modelId，作为 session 级别的模型标识。
	*/
	extractSessionModel(messages) {
		for (const message of messages) {
			if (!message.extra) continue;
			try {
				const modelId = (typeof message.extra === "string" ? JSON.parse(message.extra) : message.extra)?.modelId;
				if (typeof modelId === "string" && modelId.trim()) return modelId;
			} catch {}
		}
	}
	/**
	* 提取消息上的展示标签并归一化到 providerData.displayMetadata.tags。
	*
	* 目前只兼容旧数据里常见的 tag/tags/label/labels 四种字段，
	* 来源可以是 message 顶层字段，也可以在 extra JSON 中。
	*/
	attachDisplayMetadata(item, message) {
		const tags = this.extractDisplayTagsFromMessage(message);
		if (!tags.length) return;
		if (!item.providerData) item.providerData = {};
		item.providerData.displayMetadata = {
			...item.providerData.displayMetadata,
			tags
		};
	}
	extractDisplayTagsFromMessage(message) {
		const values = [];
		const seen = /* @__PURE__ */ new Set();
		const collectFromRecord = (record) => {
			if (!record || typeof record !== "object") return;
			for (const key of [
				"tag",
				"tags",
				"label",
				"labels"
			]) {
				const value = record[key];
				if (typeof value === "string") {
					const normalized = value.trim();
					if (normalized && !seen.has(normalized)) {
						seen.add(normalized);
						values.push(normalized);
					}
					continue;
				}
				if (!Array.isArray(value)) continue;
				for (const item of value) {
					if (typeof item !== "string") continue;
					const normalized = item.trim();
					if (normalized && !seen.has(normalized)) {
						seen.add(normalized);
						values.push(normalized);
					}
				}
			}
		};
		collectFromRecord(message);
		if (message.extra) try {
			collectFromRecord(typeof message.extra === "string" ? JSON.parse(message.extra) : message.extra);
		} catch {}
		return values;
	}
	/**
	* 从源消息中提取 Q&A 卡片数据（用于 ask_followup_question 的回答）
	*
	* 目标数据结构（CBC 期望的格式）：
	* {
	*   title?: string,
	*   questions: Array<{
	*     id: string,
	*     question: string,
	*     answers: string[]  // 必须是数组
	*   }>
	* }
	*/
	extractQuestionAnswerFromMessage(message) {
		if (!message.extra) return;
		try {
			const questionAnswer = (typeof message.extra === "string" ? JSON.parse(message.extra) : message.extra).questionAnswer;
			if (!questionAnswer || !questionAnswer.questions || !Array.isArray(questionAnswer.questions)) return;
			const normalizedQuestions = questionAnswer.questions.map((q) => ({
				id: q.id || "",
				question: q.question || "",
				answers: Array.isArray(q.answers) ? q.answers : q.answers ? [q.answers] : []
			})).filter((q) => q.id && q.question);
			if (normalizedQuestions.length === 0) return;
			return {
				title: questionAnswer.title,
				questions: normalizedQuestions
			};
		} catch (err) {
			return;
		}
	}
	/**
	* 检测 WB 侧的上下文压缩标记。
	*
	* 旧版 WorkBuddy 有两种压缩格式：
	* 1. `extra.isCompacted: true`，摘要嵌在 message 字段的 `<cb_summary>` 标签内
	* 2. `extra.isSummary: true` 或 `extra.isMaxTokenLimitSummary: true`，
	*    摘要直接放在 `extra.originalSummary` 字符串里
	*
	* @returns 若该消息是压缩后第一条请求则返回 true，否则返回 false
	*/
	extractIsCompactedFromMessage(message) {
		if (!message.extra) return false;
		try {
			const extra = typeof message.extra === "string" ? JSON.parse(message.extra) : message.extra;
			return extra.isCompacted === true || extra.isSummary === true || extra.isMaxTokenLimitSummary === true;
		} catch {
			return false;
		}
	}
	/**
	* 从 WB 压缩消息中提取摘要内容。
	*
	* 兼容两种格式：
	* 1. `extra.originalSummary` 字符串（isSummary / isMaxTokenLimitSummary 场景）
	* 2. message 字段中 `<cb_summary>...</cb_summary>` 标签（isCompacted 场景）
	*
	* @returns 摘要文本，如果都不存在则返回 undefined
	*/
	extractCbSummaryFromMessage(message) {
		if (message.extra) try {
			const extra = typeof message.extra === "string" ? JSON.parse(message.extra) : message.extra;
			if (typeof extra?.originalSummary === "string" && extra.originalSummary.trim()) return extra.originalSummary.trim();
		} catch {}
		const msgText = message.message;
		if (!msgText || typeof msgText !== "string") return;
		const startTag = "<cb_summary>";
		const endTag = "</cb_summary>";
		const startIdx = msgText.indexOf(startTag);
		if (startIdx === -1) return;
		const endIdx = msgText.indexOf(endTag, startIdx);
		if (endIdx === -1) return;
		return msgText.substring(startIdx + 12, endIdx).trim() || void 0;
	}
	/**
	* 更新平均转换时间
	*/
	updateAverageConversionTime(duration) {
		if (this.statistics.successful === 0) this.statistics.averageConversionTime = duration;
		else this.statistics.averageConversionTime = (this.statistics.averageConversionTime * (this.statistics.successful - 1) + duration) / this.statistics.successful;
	}
};
DataConverterImpl = require_common$1.__decorate([(0, import_common.Component)(DataConverter)], DataConverterImpl);
//#endregion
//#region ../../packages/history-migration/src/common/readers/reader-protocol.ts
/**
* 历史记录读取器接口定义
*
* 定义了从 agent-history 格式读取会话数据的接口。
* 数据源路径为 {workspace}/.genie/history/{uid}/{hash}/，
* 包含 GlobalIndex、ConversationIndex 和单条消息文件。
*/
/** 读取器 DI 标识符 */
var HistoryReader = Symbol("HistoryReader");
//#endregion
//#region ../../packages/history-migration/src/common/readers/history-reader.ts
/**
* agent-history 读取器实现
*
* 从 agent-history 存储目录中读取会话、消息和请求数据，
* 支持过滤、验证和元信息查询。
*/
require_common$1.init_decorate();
var HistoryReaderImpl = class HistoryReaderImpl {
	constructor() {
		this.workspacePath = "";
	}
	/**
	* 初始化读取器，验证工作区路径
	*
	* @param workspacePath - agent-history 工作区的绝对路径
	*/
	async initialize(workspacePath) {
		if (!workspacePath) throw new Error("workspacePath must not be empty");
		if (!fs.existsSync(workspacePath)) throw new Error(`Workspace path does not exist: ${workspacePath}`);
		if (!fs.statSync(workspacePath).isDirectory()) throw new Error(`workspacePath must be a directory: ${workspacePath}`);
		this.workspacePath = workspacePath;
	}
	/**
	* 读取所有会话
	*
	* @param filter - 可选的过滤条件（对话 ID、时间、数量限制）
	* @returns 满足条件的会话数组
	*/
	async readConversations(filter) {
		this.ensureInitialized();
		let conversations = [...(await this.readGlobalIndex()).conversations];
		if (filter?.conversationIds) {
			const idSet = new Set(filter.conversationIds);
			const beforeCount = conversations.length;
			conversations = conversations.filter((c) => idSet.has(c.id));
			if (conversations.length < filter.conversationIds.length) {
				const foundIds = new Set(conversations.map((c) => c.id));
				const missing = filter.conversationIds.filter((id) => !foundIds.has(id));
				console.log(`[HistoryReader] readConversations: ${missing.length} filter IDs NOT found in globalIndex (total=${beforeCount})`);
				for (const id of missing) {
					const convDir = path.join(this.workspacePath, id);
					if (fs.existsSync(convDir) && fs.statSync(convDir).isDirectory()) {
						console.log(`[HistoryReader] readConversations: synthesizing conversation entry for ${id} (has subdirectory but missing from index.json)`);
						conversations.push({
							id,
							type: "craft",
							name: "",
							createdAt: (/* @__PURE__ */ new Date()).toISOString(),
							lastMessageAt: (/* @__PURE__ */ new Date()).toISOString()
						});
					}
				}
			}
		}
		if (filter?.afterTime) conversations = conversations.filter((c) => {
			return new Date(c.lastMessageAt).getTime() >= filter.afterTime;
		});
		if (filter?.limit) conversations = conversations.slice(0, filter.limit);
		return conversations;
	}
	/**
	* 读取单个会话
	*
	* @param conversationId - 会话 ID
	* @returns 会话数据或 undefined
	*/
	async readConversation(conversationId) {
		this.ensureInitialized();
		return (await this.readGlobalIndex()).conversations.find((c) => c.id === conversationId);
	}
	/**
	* 读取会话中的消息
	*
	* @param conversationId - 会话 ID
	* @param requestIds - 可选：只读取特定 request 对应的消息
	* @returns 消息数组
	*/
	async readConversationMessages(conversationId, requestIds, maxItems, offset) {
		this.ensureInitialized();
		const conversationIndex = await this.readConversationIndex(conversationId);
		let messageIds = [];
		if (requestIds) {
			const requestIdSet = new Set(requestIds);
			for (const req of conversationIndex.requests) if (requestIdSet.has(req.id)) messageIds.push(...req.messages);
		} else messageIds = conversationIndex.messages.map((m) => m.id);
		if (offset !== void 0 && offset > 0) messageIds = messageIds.slice(offset);
		if (maxItems !== void 0 && messageIds.length > maxItems) messageIds = messageIds.slice(0, maxItems);
		const messages = [];
		for (let i = 0; i < messageIds.length; i += CONSTANTS.CONCURRENCY.PARALLEL_CONVERSIONS) {
			const batch = messageIds.slice(i, i + CONSTANTS.CONCURRENCY.PARALLEL_CONVERSIONS);
			const batchMessages = await Promise.all(batch.map((msgId) => this.readMessage(conversationId, msgId).catch(() => null)));
			messages.push(...batchMessages.filter((m) => m !== null));
		}
		return messages;
	}
	/**
	* 按指定消息 ID 列表读取消息（流式迁移用，每次只读一个 request 的消息）
	*
	* @param conversationId - 会话 ID
	* @param messageIds - 要读取的消息 ID 列表
	* @returns 消息数组（读取失败的消息会被跳过）
	*/
	async readConversationMessagesByIds(conversationId, messageIds) {
		this.ensureInitialized();
		if (!messageIds || messageIds.length === 0) return [];
		const BATCH_SIZE = 10;
		const messages = [];
		for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
			const batch = messageIds.slice(i, i + BATCH_SIZE);
			const batchMessages = await Promise.all(batch.map((msgId) => this.readMessage(conversationId, msgId).catch(() => null)));
			messages.push(...batchMessages.filter((m) => m !== null));
		}
		return messages;
	}
	/**
	* 获取会话的消息总数（不加载消息内容）
	*/
	async getConversationMessageCount(conversationId) {
		this.ensureInitialized();
		try {
			return (await this.readConversationIndex(conversationId)).messages.length;
		} catch {
			return 0;
		}
	}
	/**
	* 读取会话的文件树数据
	*
	* file-tree 路径与 history 路径同级，将路径中的 /history/ 替换为 /file-tree/
	* 例如: ~/.../history/{hash}/ → ~/.../file-tree/{hash}/{conversationId}/file-tree.json
	*
	* @param conversationId - 会话 ID
	* @returns 文件树节点数组，文件不存在时返回空数组
	*/
	async readConversationFileTree(conversationId) {
		this.ensureInitialized();
		const fileTreeBasePath = this.workspacePath.replace(/[/\\]history[/\\]/, `${path.sep}file-tree${path.sep}`);
		const fileTreePath = path.join(fileTreeBasePath, conversationId, "file-tree.json");
		if (!fs.existsSync(fileTreePath)) return [];
		try {
			const content = fs.readFileSync(fileTreePath, "utf-8");
			const parsed = JSON.parse(content);
			if (Array.isArray(parsed)) return parsed;
			if (parsed && Array.isArray(parsed.nodes)) return parsed.nodes;
			if (parsed && typeof parsed === "object") return Object.values(parsed);
			return [];
		} catch {
			return [];
		}
	}
	/**
	* 读取会话的计划任务数据
	*
	* plan-task 路径与 history 路径同级，将路径中的 /history/ 替换为 /plan-task/
	* 例如: ~/.../history/{hash}/ → ~/.../plan-task/{hash}/{conversationId}/meta.json
	*
	* @param conversationId - 会话 ID
	* @returns PlanContextItem 数组
	*/
	async readConversationPlanTasks(conversationId) {
		this.ensureInitialized();
		const planTaskBasePath = this.workspacePath.replace(/[/\\]history[/\\]/, `${path.sep}plan-task${path.sep}`);
		const metaPath = path.join(planTaskBasePath, conversationId, "meta.json");
		if (!fs.existsSync(metaPath)) return [];
		try {
			const content = fs.readFileSync(metaPath, "utf-8");
			const parsed = JSON.parse(content);
			if (Array.isArray(parsed)) return parsed;
			if (parsed && Array.isArray(parsed.items)) return parsed.items;
			return [];
		} catch {
			return [];
		}
	}
	/**
	* 获取工作区信息
	*
	* 统计对话数、消息数、总大小等信息
	*
	* @returns 工作区元信息
	*/
	async getWorkspaceInfo() {
		this.ensureInitialized();
		const globalIndex = await this.readGlobalIndex();
		let conversationCount = 0;
		let messageCount = 0;
		let totalSize = 0;
		let lastMessageTime = 0;
		let oldestMessageTime = Number.MAX_SAFE_INTEGER;
		for (const conv of globalIndex.conversations) {
			conversationCount++;
			const convIndex = await this.readConversationIndex(conv.id).catch(() => null);
			if (!convIndex) continue;
			messageCount += convIndex.messages.length;
			const lastMsgTime = new Date(conv.lastMessageAt).getTime();
			if (lastMsgTime > lastMessageTime) lastMessageTime = lastMsgTime;
			const createdTime = new Date(conv.createdAt).getTime();
			if (createdTime < oldestMessageTime) oldestMessageTime = createdTime;
			const messagesDir = path.join(this.workspacePath, conv.id, "messages");
			if (fs.existsSync(messagesDir)) totalSize += this.getDirectorySize(messagesDir);
		}
		return {
			path: this.workspacePath,
			conversationCount,
			messageCount,
			totalSize,
			lastMessageTime,
			oldestMessageTime: oldestMessageTime === Number.MAX_SAFE_INTEGER ? 0 : oldestMessageTime
		};
	}
	/**
	* 验证工作区中的数据一致性
	*
	* @returns 验证结果
	*/
	async validate() {
		this.ensureInitialized();
		const issues = [];
		try {
			const globalIndex = await this.readGlobalIndex();
			let conversationCount = 0;
			let messageCount = 0;
			for (const conv of globalIndex.conversations) {
				conversationCount++;
				const convPath = path.join(this.workspacePath, conv.id);
				if (!fs.existsSync(convPath)) {
					issues.push(`Conversation directory missing: ${conv.id}`);
					continue;
				}
				const convIndex = await this.readConversationIndex(conv.id).catch((err) => {
					issues.push(`Failed to read conversation index for ${conv.id}: ${err.message}`);
					return null;
				});
				if (!convIndex) continue;
				for (const msgMeta of convIndex.messages) {
					const msgPath = path.join(this.workspacePath, conv.id, "messages", `${msgMeta.id}.json`);
					if (!fs.existsSync(msgPath)) issues.push(`Message file missing: ${conv.id}/${msgMeta.id}.json`);
					else messageCount++;
				}
			}
			return {
				passed: issues.length === 0,
				conversationCount,
				messageCount,
				issues
			};
		} catch (err) {
			return {
				passed: false,
				conversationCount: 0,
				messageCount: 0,
				issues: [`Validation failed: ${err.message}`]
			};
		}
	}
	/**
	* 清理资源
	*/
	async dispose() {}
	ensureInitialized() {
		if (!this.workspacePath) throw new Error("HistoryReader not initialized. Call initialize() first.");
	}
	/**
	* 读取全局索引文件
	*/
	async readGlobalIndex() {
		const indexPath = path.join(this.workspacePath, "index.json");
		if (!fs.existsSync(indexPath)) throw new Error(`Global index not found at ${indexPath}`);
		const content = fs.readFileSync(indexPath, "utf-8");
		return JSON.parse(content);
	}
	/**
	* 读取会话级索引文件
	*/
	async readConversationIndex(conversationId) {
		const indexPath = path.join(this.workspacePath, conversationId, "index.json");
		if (!fs.existsSync(indexPath)) throw new Error(`Conversation index not found at ${indexPath}`);
		const content = fs.readFileSync(indexPath, "utf-8");
		return JSON.parse(content);
	}
	/**
	* 读取单个消息文件，并裁剪掉不需要的超大字段（如 tool-result 里的 snapshot）
	*/
	async readMessage(conversationId, messageId) {
		const msgPath = path.join(this.workspacePath, conversationId, "messages", `${messageId}.json`);
		let content;
		try {
			content = await fs.promises.readFile(msgPath, "utf-8");
		} catch {
			throw new Error(`Message file not found: ${msgPath}`);
		}
		const msg = JSON.parse(content);
		if (msg.role === "tool" && typeof msg.message === "string") try {
			const parsed = JSON.parse(msg.message);
			if (parsed.role === "tool" && Array.isArray(parsed.content)) {
				let modified = false;
				for (const item of parsed.content) {
					const snap = item.result?.result?.snapshot;
					if (snap && typeof snap === "object") {
						if (snap.inbox !== void 0) {
							delete snap.inbox;
							modified = true;
						}
						if (snap.runtimeState !== void 0) {
							delete snap.runtimeState;
							modified = true;
						}
					}
				}
				if (modified) msg.message = JSON.stringify(parsed);
			}
		} catch {}
		return msg;
	}
	/**
	* 计算目录的总大小（字节）
	*/
	getDirectorySize(dirPath) {
		if (!fs.existsSync(dirPath)) return 0;
		let size = 0;
		const entries = fs.readdirSync(dirPath, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(dirPath, entry.name);
			if (entry.isDirectory()) size += this.getDirectorySize(fullPath);
			else if (entry.isFile()) {
				const stats = fs.statSync(fullPath);
				size += stats.size;
			}
		}
		return size;
	}
};
HistoryReaderImpl = require_common$1.__decorate([(0, import_common.Component)(HistoryReader)], HistoryReaderImpl);
//#endregion
//#region ../../packages/history-migration/src/common/state/migration-state-tracker.ts
/**
* 迁移状态追踪器
*
* 用于增量迁移场景：记录已迁移的会话信息，
* 在后续迁移时跳过已处理的会话或仅更新有变化的会话。
*
* 状态文件存储在 {basePath}/.migration-history/state-{projectHash}.json
* basePath 由调用者传入，默认为 ~/.codebuddy
*/
/**
* 迁移状态追踪器实现
*/
var MigrationStateTracker = class {
	/**
	* @param basePath - Root directory for state files (e.g. ~/.workbuddy).
	*                   Defaults to ~/{CODEBUDDY_BASE} for backward compatibility.
	*/
	constructor(basePath) {
		this.basePath = basePath || path.join(os.homedir(), CONSTANTS.PATHS.CODEBUDDY_BASE);
	}
	/**
	* Update the base path after construction.
	* Used when basePath is computed after the tracker is instantiated.
	*/
	setBasePath(basePath) {
		this.basePath = basePath;
	}
	/**
	* 获取状态文件路径
	* 每个项目有独立的状态文件，按项目路径的哈希值区分
	*/
	getStateFilePath(projectPath) {
		const projectHash = crypto.createHash("sha256").update(projectPath).digest("hex").substring(0, 16);
		return path.join(this.basePath, CONSTANTS.PATHS.MIGRATION_HISTORY_DIR, `state-${projectHash}.json`);
	}
	/**
	* 加载指定项目的迁移状态
	*/
	async loadState(projectPath) {
		const stateFilePath = this.getStateFilePath(projectPath);
		try {
			if (!await import_lib.pathExists(stateFilePath)) return;
			const content = await import_lib.readFile(stateFilePath, "utf-8");
			return JSON.parse(content);
		} catch {
			return;
		}
	}
	/**
	* 保存迁移状态
	*/
	async saveState(projectPath, state) {
		const stateFilePath = this.getStateFilePath(projectPath);
		await import_lib.ensureDir(path.dirname(stateFilePath));
		await import_lib.writeFile(stateFilePath, JSON.stringify(state, null, 2), "utf-8");
	}
	/**
	* 检查会话是否已迁移
	*/
	async isConversationMigrated(projectPath, conversationId) {
		const state = await this.loadState(projectPath);
		if (!state) return false;
		return conversationId in state.migratedConversations;
	}
	/**
	* 检查会话源数据是否有变化
	*
	* 通过对比已记录的哈希值和当前哈希值来判断。
	* 如果没有迁移记录，认为"有变化"（需要迁移）。
	*/
	async hasConversationChanged(projectPath, conversationId, currentHash) {
		const state = await this.loadState(projectPath);
		if (!state) return true;
		const existing = state.migratedConversations[conversationId];
		if (!existing) return true;
		return existing.sourceHash !== currentHash;
	}
	/**
	* 记录一个会话的迁移结果
	*/
	async markConversationMigrated(projectPath, info) {
		let state = await this.loadState(projectPath);
		if (!state) state = {
			lastMigrationTime: Date.now(),
			migratedConversations: {}
		};
		state.lastMigrationTime = Date.now();
		state.migratedConversations[info.sourceId] = info;
		await this.saveState(projectPath, state);
	}
	/**
	* 计算会话数据的哈希值
	*
	* 对会话数据做 JSON 序列化后取 SHA-256 摘要，
	* 用于增量迁移时检测源数据是否发生变化。
	*/
	computeConversationHash(conversationData) {
		const serialized = JSON.stringify(conversationData);
		return crypto.createHash("sha256").update(serialized).digest("hex");
	}
	/**
	* 获取增量迁移需要处理的会话列表
	*
	* 遍历所有候选会话，返回尚未迁移或源数据有变化的会话 ID。
	*/
	async getConversationsToMigrate(projectPath, conversations) {
		const state = await this.loadState(projectPath);
		const toMigrate = [];
		for (const conv of conversations) {
			const currentHash = this.computeConversationHash(conv.data);
			if (!state) {
				toMigrate.push(conv.id);
				continue;
			}
			const existing = state.migratedConversations[conv.id];
			if (!existing) toMigrate.push(conv.id);
			else if (existing.sourceHash !== currentHash) toMigrate.push(conv.id);
		}
		return toMigrate;
	}
	/**
	* 清除指定项目的迁移状态
	*/
	async clearState(projectPath) {
		const stateFilePath = this.getStateFilePath(projectPath);
		try {
			if (await import_lib.pathExists(stateFilePath)) await import_lib.remove(stateFilePath);
		} catch {}
	}
};
//#endregion
//#region ../../packages/history-migration/src/common/utils/util-protocol.ts
/**
* 工具函数接口定义
*/
var PathMapper = Symbol("PathMapper");
//#endregion
//#region ../../packages/history-migration/src/common/utils/path-mapper.ts
/**
* 路径映射工具实现
*
* 负责所有路径计算、哈希生成和存储路径映射，
* 遵循 agent-cli 的路径约定（compressed-work-dir 算法、blob 分桶存储等）。
*/
require_common$1.init_decorate();
var PathMapperImpl = class PathMapperImpl {
	/**
	* 计算项目路径的哈希值（compressed-work-dir）
	*
	* 遵循 agent-cli 的 PathUtils.getCompressedWorkDir 算法：
	* 1. 将路径中的 `/`、`\`、`:` 替换为 `-`
	* 2. 去除首尾 `-`
	* 3. 将连续的 `-` 合并为单个 `-`
	*
	* @param projectPath - 项目的绝对路径
	* @returns 压缩后的项目路径标识
	*/
	computeProjectHash(projectPath) {
		if (!projectPath) throw new Error("projectPath must not be empty");
		let compressed = path.normalize(projectPath).replace(/[/\\]+$/, "").replace(/[/\\:]/g, "-");
		compressed = compressed.replace(/^-+|-+$/g, "");
		compressed = compressed.replace(/-+/g, "-");
		return compressed;
	}
	/**
	* 计算文件内容的哈希值（SHA256）
	*
	* 以流式方式读取文件，避免大文件占用过多内存。
	*
	* @param filePath - 文件的绝对路径
	* @returns SHA256 哈希值（十六进制）
	*/
	async computeFileHash(filePath) {
		if (!filePath) throw new Error("filePath must not be empty");
		return new Promise((resolve, reject) => {
			const hash = crypto.createHash("sha256");
			const stream = fs.createReadStream(filePath);
			stream.on("data", (data) => {
				hash.update(data);
			});
			stream.on("end", () => {
				resolve(hash.digest("hex"));
			});
			stream.on("error", (err) => {
				reject(/* @__PURE__ */ new Error(`Failed to compute file hash for ${filePath}: ${err.message}`));
			});
		});
	}
	/**
	* 计算 Blob 的唯一标识（SHA256）
	*
	* 基于数据内容计算 SHA256 哈希，用作 blob 的存储标识。
	*
	* @param data - 二进制数据
	* @param extension - 文件扩展名（如 'png', 'jpg'），不含 `.`
	* @returns 格式为 `{sha256}.{extension}` 的 blob 标识
	*/
	computeBlobId(data, extension) {
		if (!data || data.length === 0) throw new Error("data must not be empty");
		if (!extension) throw new Error("extension must not be empty");
		const ext = extension.replace(/^\./, "");
		return `${crypto.createHash("sha256").update(data).digest("hex")}.${ext}`;
	}
	/**
	* 获取会话 JSONL 文件的完整路径
	*
	* 路径格式: {basePath}/projects/{projectHash}/{sessionId}.jsonl
	*
	* @param projectHash - 项目哈希（由 computeProjectHash 生成）
	* @param sessionId - 会话 ID
	* @param basePath - Root directory (e.g. ~/.workbuddy). Defaults to ~/{CODEBUDDY_BASE}.
	* @returns 会话文件的绝对路径
	*/
	getSessionFilePath(projectHash, sessionId, basePath) {
		if (!projectHash) throw new Error("projectHash must not be empty");
		if (!sessionId) throw new Error("sessionId must not be empty");
		const resolvedBase = basePath || path.join(os.homedir(), CONSTANTS.PATHS.CODEBUDDY_BASE);
		return path.join(resolvedBase, CONSTANTS.PATHS.SESSIONS_DIR, projectHash, `${sessionId}${CONSTANTS.FILES.SESSION_EXT}`);
	}
	/**
	* 获取 Blob 存储路径
	*
	* 路径格式: {basePath}/blobs/{sha256前2字符}/{blobId}
	* 使用 SHA256 前两位字符做分桶，防止单目录文件过多。
	*
	* @param blobId - blob 标识（格式: {sha256}.{ext}）
	* @param basePath - Root directory (e.g. ~/.workbuddy). Defaults to ~/{CODEBUDDY_BASE}.
	* @returns blob 文件的绝对路径
	*/
	getBlobStoragePath(blobId, basePath) {
		if (!blobId) throw new Error("blobId must not be empty");
		const prefix = blobId.split(".")[0].substring(0, 2);
		const resolvedBase = basePath || path.join(os.homedir(), CONSTANTS.PATHS.CODEBUDDY_BASE);
		return path.join(resolvedBase, CONSTANTS.PATHS.BLOBS_DIR, prefix, blobId);
	}
	/**
	* 获取文件版本的存储路径
	*
	* 路径格式: {basePath}/file-history/{sessionId}/{fileHash}@v{version}
	*
	* @param sessionId - 会话 ID
	* @param fileHash - 文件内容哈希
	* @param version - 版本号（从 1 开始）
	* @param basePath - Root directory (e.g. ~/.workbuddy). Defaults to ~/{CODEBUDDY_BASE}.
	* @returns 文件版本的绝对路径
	*/
	getFileVersionPath(sessionId, fileHash, version, basePath) {
		if (!sessionId) throw new Error("sessionId must not be empty");
		if (!fileHash) throw new Error("fileHash must not be empty");
		if (version < 1) throw new Error("version must be >= 1");
		const resolvedBase = basePath || path.join(os.homedir(), CONSTANTS.PATHS.CODEBUDDY_BASE);
		return path.join(resolvedBase, CONSTANTS.PATHS.FILE_HISTORY_DIR, sessionId, `${fileHash}@v${version}`);
	}
};
PathMapperImpl = require_common$1.__decorate([(0, import_common.Component)(PathMapper)], PathMapperImpl);
//#endregion
//#region ../../packages/history-migration/src/common/validators/validator-protocol.ts
/** 验证器 DI 标识符 */
var DataValidator = Symbol("DataValidator");
//#endregion
//#region ../../packages/history-migration/src/common/validators/data-validator.ts
/**
* 数据验证器实现
*
* 验证源数据、转换结果、写入数据的完整性和一致性
*/
require_common$1.init_decorate();
var DataValidatorImpl = class DataValidatorImpl {
	/**
	* 验证源数据（agent-history 格式）
	*
	* @param conversation - 源对话对象
	* @returns 发现的验证问题列表
	*/
	async validateSource(conversation) {
		const issues = [];
		const sessionId = conversation.id || "unknown";
		if (!conversation.id) issues.push({
			severity: "error",
			sessionId,
			message: "Conversation missing id field"
		});
		if (!conversation.name) issues.push({
			severity: "warning",
			sessionId,
			message: "Conversation missing name field"
		});
		if (!conversation.type) issues.push({
			severity: "warning",
			sessionId,
			message: "Conversation missing type field"
		});
		if (!conversation.createdAt) issues.push({
			severity: "warning",
			sessionId,
			message: "Conversation missing createdAt field"
		});
		if (conversation.createdAt) try {
			const timestamp = new Date(conversation.createdAt).getTime();
			if (isNaN(timestamp)) issues.push({
				severity: "error",
				sessionId,
				message: "Invalid createdAt timestamp format"
			});
		} catch (err) {
			issues.push({
				severity: "error",
				sessionId,
				message: "Invalid createdAt timestamp format"
			});
		}
		return issues;
	}
	/**
	* 验证转换结果（agent-cli 格式）
	*
	* @param session - 转换后的会话对象
	* @returns 发现的验证问题列表
	*/
	async validateConversion(session) {
		const issues = [];
		const sessionId = session.sessionId || "unknown";
		if (!session.sessionId) issues.push({
			severity: "error",
			sessionId: "unknown",
			message: "Session missing sessionId field"
		});
		if (!Array.isArray(session.items)) {
			issues.push({
				severity: "error",
				sessionId,
				message: "Session items must be an array"
			});
			return issues;
		}
		for (let i = 0; i < session.items.length; i++) {
			const item = session.items[i];
			if (!item.id) issues.push({
				severity: "error",
				sessionId,
				message: `Item ${i} missing id field`
			});
			if (!item.type) issues.push({
				severity: "error",
				sessionId,
				message: `Item ${i} missing type field`
			});
			if (typeof item.timestamp !== "number") issues.push({
				severity: "error",
				sessionId,
				message: `Item ${i} has invalid timestamp`
			});
			if (item.sessionId && item.sessionId !== session.sessionId) issues.push({
				severity: "warning",
				sessionId,
				message: `Item ${i} sessionId does not match parent session`
			});
		}
		return issues;
	}
	/**
	* 验证写入的数据
	*
	* @param session - 已写入的会话对象
	* @param projectPath - 项目路径
	* @returns 发现的验证问题列表
	*/
	async validateWrite(session, projectPath) {
		const issues = [];
		const sessionId = session.sessionId || "unknown";
		if (!session.sessionId) issues.push({
			severity: "error",
			sessionId: "unknown",
			message: "Written session missing sessionId"
		});
		if (!Array.isArray(session.items)) {
			issues.push({
				severity: "error",
				sessionId,
				message: "Written session items must be an array"
			});
			return issues;
		}
		if (session.items.length === 0) issues.push({
			severity: "warning",
			sessionId,
			message: "Session has no items"
		});
		for (let i = 0; i < session.items.length; i++) if (!session.items[i].id) issues.push({
			severity: "error",
			sessionId,
			message: `Written item ${i} missing id`
		});
		return issues;
	}
	/**
	* 验证完整的迁移报告
	*
	* @param report - 迁移报告对象
	* @returns 验证结果
	*/
	async validate(report) {
		const checks = [];
		const issues = [];
		const hasBasicFields = !!(report.id && report.sourceWorkspace && report.targetProject);
		checks.push({
			name: "Basic fields exist",
			passed: hasBasicFields,
			message: hasBasicFields ? "All basic fields present" : "Missing basic fields (id, sourceWorkspace, or targetProject)"
		});
		if (!hasBasicFields) issues.push({
			severity: "error",
			sessionId: "migration",
			message: "Migration report missing basic fields"
		});
		const statsConsistent = !!(report.statistics && report.statistics.successCount <= report.statistics.conversationCount && report.statistics.skipCount >= 0 && report.statistics.errorCount >= 0);
		checks.push({
			name: "Statistics are consistent",
			passed: statsConsistent,
			message: statsConsistent ? "Statistics are consistent" : "Statistics values are inconsistent"
		});
		if (!statsConsistent) issues.push({
			severity: "error",
			sessionId: "migration",
			message: "Migration report statistics are inconsistent"
		});
		const qualityValid = !!(report.quality && report.quality.dataLossPercentage >= 0 && report.quality.dataLossPercentage <= 100 && report.quality.conversionErrors >= 0);
		checks.push({
			name: "Quality metrics are valid",
			passed: qualityValid,
			message: qualityValid ? "Quality metrics are valid" : "Quality metrics are out of range or missing"
		});
		if (!qualityValid) issues.push({
			severity: "error",
			sessionId: "migration",
			message: "Migration report quality metrics are invalid"
		});
		const resultsValid = Array.isArray(report.results);
		checks.push({
			name: "Results list is valid",
			passed: resultsValid,
			message: resultsValid ? "Results list is valid" : "Results must be an array"
		});
		if (!resultsValid) issues.push({
			severity: "error",
			sessionId: "migration",
			message: "Migration report results must be an array"
		});
		const timestampsValid = report.startTime > 0 && report.endTime >= report.startTime && report.duration >= 0;
		checks.push({
			name: "Timestamps are valid",
			passed: timestampsValid,
			message: timestampsValid ? "Timestamps are valid" : "Timestamps are invalid or inconsistent"
		});
		if (!timestampsValid) issues.push({
			severity: "error",
			sessionId: "migration",
			message: "Migration report timestamps are invalid"
		});
		const passed = checks.every((c) => c.passed);
		return {
			passed,
			totalChecks: checks.length,
			passedChecks: checks.filter((c) => c.passed).length,
			checks,
			issues,
			summary: passed ? "All validation checks passed" : `${checks.length - checks.filter((c) => c.passed).length} checks failed`
		};
	}
};
DataValidatorImpl = require_common$1.__decorate([(0, import_common.Component)(DataValidator)], DataValidatorImpl);
//#endregion
//#region ../../packages/history-migration/src/common/writers/writer-protocol.ts
/**
* 历史记录写入器接口定义
*
* 定义了将转换后的会话数据写入 agent-cli 格式（JSONL + meta.json）的接口。
* 写入目标路径为 ~/.codebuddy/projects/{projectHash}/{sessionId}.jsonl
*/
var HistoryWriter = Symbol("HistoryWriter");
//#endregion
//#region ../../packages/history-migration/src/common/writers/history-writer.ts
/**
* agent-cli 历史记录写入器实现
*
* 将转换后的数据写入 agent-cli JSONL 存储格式。
* 存储路径对齐 agent-cli SessionStore:
*   ~/.codebuddy/projects/{projectHash}/{sessionId}.jsonl
*   ~/.codebuddy/projects/{projectHash}/{sessionId}.meta.json
*/
require_common$1.init_decorate();
var HistoryWriterImpl = class HistoryWriterImpl {
	constructor() {
		this.config = null;
		this.writtenSessions = /* @__PURE__ */ new Set();
		this.streamingSessions = /* @__PURE__ */ new Map();
	}
	/**
	* 初始化写入器
	*
	* @param config - 写入器配置
	*/
	async initialize(config) {
		if (!config) throw new Error("config must not be null");
		if (!config.projectPath) throw new Error("projectPath must not be empty");
		if (!config.projectHash) throw new Error("projectHash must not be empty");
		if (!config.basePath) throw new Error("basePath must not be empty");
		this.config = config;
		this.writtenSessions = /* @__PURE__ */ new Set();
		this.ensureDirectoriesExist();
	}
	/**
	* 获取项目会话目录路径
	* 对齐 agent-cli: ~/.codebuddy/projects/{projectHash}/
	*/
	getProjectDir() {
		return path.join(this.config.basePath, CONSTANTS.PATHS.SESSIONS_DIR, this.config.projectHash);
	}
	/**
	* 写入单个会话
	*
	* 写入路径:
	*   {basePath}/projects/{projectHash}/{sessionId}.jsonl
	*   {basePath}/projects/{projectHash}/{sessionId}.meta.json
	*
	* @param session - 转换后的会话对象
	* @returns 写入结果
	*/
	async writeSession(session, options) {
		this.ensureInitialized();
		const startTime = Date.now();
		const files = [];
		let totalSize = 0;
		try {
			if (!session.sessionId) throw new Error("Session must have sessionId");
			if (!session.items || session.items.length === 0) return {
				sessionId: session.sessionId,
				success: true,
				files: [],
				size: 0,
				duration: Date.now() - startTime
			};
			const projectDir = this.getProjectDir();
			fs.mkdirSync(projectDir, { recursive: true });
			const WRITE_BATCH_SIZE = 100;
			const jsonlPath = path.join(projectDir, `${session.sessionId}${CONSTANTS.FILES.SESSION_EXT}`);
			const items = session.items || [];
			if (!options?.appendMode) fs.writeFileSync(jsonlPath, "");
			let jsonlSize = 0;
			for (let i = 0; i < items.length; i += WRITE_BATCH_SIZE) {
				const chunk = items.slice(i, i + WRITE_BATCH_SIZE).map((item) => JSON.stringify(this.normalizeItem(item))).join("\n") + "\n";
				fs.appendFileSync(jsonlPath, chunk);
				jsonlSize += Buffer.byteLength(chunk, "utf-8");
			}
			totalSize += jsonlSize;
			files.push({
				path: jsonlPath,
				size: jsonlSize,
				checksum: "",
				timestamp: Date.now(),
				type: "jsonl"
			});
			const metaPath = path.join(projectDir, `${session.sessionId}${CONSTANTS.FILES.META_FILE}`);
			const meta = {
				createdAt: this.normalizeTimestamp(session.createdAt),
				updatedAt: this.normalizeTimestamp(session.createdAt)
			};
			if (session.meta) Object.assign(meta, session.meta);
			const metaContent = JSON.stringify(meta, null, 2);
			fs.writeFileSync(metaPath, metaContent);
			const metaSize = metaContent.length;
			totalSize += metaSize;
			files.push({
				path: metaPath,
				size: metaSize,
				checksum: this.computeChecksum(metaContent),
				timestamp: Date.now(),
				type: "meta"
			});
			this.writtenSessions.add(session.sessionId);
			const duration = Date.now() - startTime;
			return {
				sessionId: session.sessionId,
				success: true,
				files,
				size: totalSize,
				duration
			};
		} catch (err) {
			const duration = Date.now() - startTime;
			return {
				sessionId: session.sessionId,
				success: false,
				files,
				size: totalSize,
				duration,
				error: err.message
			};
		}
	}
	/**
	* 打开一个会话文件准备流式写入（清空或创建文件，写入 meta）。
	* 配合 appendItems / closeSession 使用，适合逐批 item 写入的场景。
	* 内部持有 WriteStream + Hash，背压由 appendItems 处理，无需一次性拼接大字符串。
	*/
	openSession(session) {
		this.ensureInitialized();
		const projectDir = this.getProjectDir();
		fs.mkdirSync(projectDir, { recursive: true });
		const existing = this.streamingSessions.get(session.sessionId);
		if (existing) {
			existing.stream.destroy();
			this.streamingSessions.delete(session.sessionId);
		}
		const jsonlPath = path.join(projectDir, `${session.sessionId}${CONSTANTS.FILES.SESSION_EXT}`);
		const stream = fs.createWriteStream(jsonlPath, { encoding: "utf-8" });
		const hash = crypto.createHash("sha256");
		const streamError = new Promise((_, reject) => {
			stream.once("error", reject);
		});
		this.streamingSessions.set(session.sessionId, {
			stream,
			hash,
			size: 0,
			streamError
		});
		const metaPath = path.join(projectDir, `${session.sessionId}${CONSTANTS.FILES.META_FILE}`);
		const meta = {
			createdAt: this.normalizeTimestamp(session.createdAt),
			updatedAt: this.normalizeTimestamp(session.createdAt)
		};
		if (session.meta) Object.assign(meta, session.meta);
		fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
		this.writtenSessions.add(session.sessionId);
	}
	/**
	* 追加 items 到已打开的会话 JSONL stream（每个 item 写一行）。
	* 缓冲区满时自动 await drain，避免写入背压。
	* items 写入后即可释放，不需要在内存中保留。
	*/
	async appendItems(sessionId, items) {
		if (!items || items.length === 0) return;
		const s = this.streamingSessions.get(sessionId);
		if (!s) throw new Error(`Session ${sessionId} not opened. Call openSession() first.`);
		for (const item of items) {
			const line = `${JSON.stringify(this.normalizeItem(item))}\n`;
			s.hash.update(line);
			s.size += Buffer.byteLength(line);
			if (!s.stream.write(line)) await Promise.race([(0, events.once)(s.stream, "drain"), s.streamError]);
		}
	}
	/**
	* 关闭流式写入，等待 stream finish，清理句柄。
	*/
	async closeSession(sessionId) {
		const s = this.streamingSessions.get(sessionId);
		if (!s) return;
		this.streamingSessions.delete(sessionId);
		s.stream.end();
		await Promise.race([(0, events.once)(s.stream, "finish"), s.streamError]);
	}
	/**
	* 写入会话的 Todo 数据
	*
	* @param sessionId - 会话 ID
	* @param todos - TodoToolItem 数组
	* @returns 写入是否成功
	*/
	async writeTodos(sessionId, todos) {
		this.ensureInitialized();
		if (!sessionId || !todos || todos.length === 0) return false;
		try {
			const todosDir = path.join(this.config.basePath, CONSTANTS.PATHS.TODOS_DIR);
			fs.mkdirSync(todosDir, { recursive: true });
			const todoFilePath = path.join(todosDir, `${sessionId}.json`);
			const todoContent = JSON.stringify({
				todos,
				updatedAt: Date.now()
			}, null, 2);
			fs.writeFileSync(todoFilePath, todoContent);
			return true;
		} catch {
			return false;
		}
	}
	/**
	* Write session Task data in new format
	*
	* Each task is stored as an individual JSON file: {basePath}/tasks/{sessionId}/{taskId}.json
	*
	* @param sessionId - session ID
	* @param tasks - TaskItem array
	* @returns whether write was successful
	*/
	async writeTasks(sessionId, tasks) {
		this.ensureInitialized();
		if (!sessionId || !tasks || tasks.length === 0) return false;
		try {
			const sessionTasksDir = path.join(this.config.basePath, CONSTANTS.PATHS.TASKS_DIR, sessionId);
			fs.mkdirSync(sessionTasksDir, { recursive: true });
			for (const task of tasks) {
				if (!task || !task.id) continue;
				const taskFilePath = path.join(sessionTasksDir, `${task.id}.json`);
				const taskContent = JSON.stringify(task, null, 2);
				fs.writeFileSync(taskFilePath, taskContent);
			}
			return true;
		} catch {
			return false;
		}
	}
	/**
	* 批量写入会话
	*
	* @param sessions - 会话数组
	* @param callbacks - 可选的进度回调
	* @returns 批量写入结果
	*/
	async writeSessions(sessions, callbacks) {
		this.ensureInitialized();
		const startTime = Date.now();
		const sessionResults = [];
		let totalSize = 0;
		let writtenCount = 0;
		let failedCount = 0;
		const skippedCount = 0;
		for (let i = 0; i < sessions.length; i += CONSTANTS.CONCURRENCY.PARALLEL_VERIFICATIONS) {
			const batch = sessions.slice(i, i + CONSTANTS.CONCURRENCY.PARALLEL_VERIFICATIONS);
			const results = await Promise.all(batch.map((session) => this.writeSession(session)));
			for (let j = 0; j < results.length; j++) {
				const result = results[j];
				sessionResults.push(result);
				if (result.success) {
					writtenCount++;
					totalSize += result.size;
				} else failedCount++;
				if (callbacks?.onProgress) callbacks.onProgress(i + j + 1, sessions.length, result.sessionId);
			}
		}
		const duration = Date.now() - startTime;
		return {
			writtenCount,
			skippedCount,
			failedCount,
			sessions: sessionResults,
			files: this.collectAllFiles(sessionResults),
			totalSize,
			duration
		};
	}
	/**
	* 验证已写入的会话
	*
	* @param sessionIds - 要验证的会话 ID 数组
	* @returns 验证结果
	*/
	async verify(sessionIds) {
		this.ensureInitialized();
		const errors = [];
		let sessionCount = 0;
		let messageCount = 0;
		const projectDir = this.getProjectDir();
		for (const sessionId of sessionIds) {
			const jsonlPath = path.join(projectDir, `${sessionId}${CONSTANTS.FILES.SESSION_EXT}`);
			if (!fs.existsSync(jsonlPath)) {
				errors.push({
					sessionId,
					message: `JSONL file not found: ${jsonlPath}`,
					severity: "error"
				});
				continue;
			}
			sessionCount++;
			try {
				const lines = fs.readFileSync(jsonlPath, "utf-8").trim().split("\n").filter((line) => line.length > 0);
				messageCount += lines.length;
				for (let i = 0; i < lines.length; i++) try {
					JSON.parse(lines[i]);
				} catch (err) {
					errors.push({
						sessionId,
						message: `Invalid JSON at line ${i + 1}`,
						severity: "error"
					});
				}
			} catch (err) {
				errors.push({
					sessionId,
					message: `Failed to read JSONL file: ${err.message}`,
					severity: "error"
				});
			}
			const metaPath = path.join(projectDir, `${sessionId}${CONSTANTS.FILES.META_FILE}`);
			if (!fs.existsSync(metaPath)) errors.push({
				sessionId,
				message: `Meta file not found: ${metaPath}`,
				severity: "warning"
			});
		}
		return {
			passed: errors.filter((e) => e.severity === "error").length === 0,
			sessionCount,
			messageCount,
			errors
		};
	}
	/**
	* 清理资源
	*/
	async cleanup() {
		for (const [, s] of this.streamingSessions) s.stream.destroy();
		this.streamingSessions.clear();
		this.writtenSessions.clear();
	}
	/**
	* 释放资源
	*/
	async dispose() {
		for (const [, s] of this.streamingSessions) s.stream.destroy();
		this.streamingSessions.clear();
		this.config = null;
		this.writtenSessions.clear();
	}
	ensureInitialized() {
		if (!this.config) throw new Error("HistoryWriter not initialized. Call initialize() first.");
	}
	/**
	* 确保所需目录存在
	*/
	ensureDirectoriesExist() {
		if (!this.config) return;
		const dirs = [
			path.join(this.config.basePath, CONSTANTS.PATHS.SESSIONS_DIR, this.config.projectHash),
			path.join(this.config.basePath, CONSTANTS.PATHS.BLOBS_DIR),
			path.join(this.config.basePath, CONSTANTS.PATHS.FILE_HISTORY_DIR),
			path.join(this.config.basePath, CONSTANTS.PATHS.TODOS_DIR)
		];
		for (const dir of dirs) fs.mkdirSync(dir, { recursive: true });
	}
	/**
	* 规范化单个项目的字段顺序
	* 对齐 agent-cli SessionStore.transformItemForSaveAsync 的字段顺序
	*/
	normalizeItem(item) {
		const ordered = {};
		if (item.id) ordered.id = item.id;
		if (item.parentId) ordered.parentId = item.parentId;
		if (item.logicalParentId) ordered.logicalParentId = item.logicalParentId;
		if (item.timestamp !== void 0) ordered.timestamp = item.timestamp;
		if (item.type) ordered.type = item.type;
		if (item.role) ordered.role = item.role;
		for (const key in item) if (![
			"id",
			"parentId",
			"logicalParentId",
			"timestamp",
			"type",
			"role"
		].includes(key)) ordered[key] = item[key];
		return ordered;
	}
	/**
	* 规范化时间戳为毫秒数
	*/
	normalizeTimestamp(value) {
		if (typeof value === "number") return value;
		if (typeof value === "string") {
			const ts = new Date(value).getTime();
			if (!isNaN(ts)) return ts;
		}
		return Date.now();
	}
	/**
	* 计算内容的校验和
	*/
	computeChecksum(content) {
		return crypto.createHash("sha256").update(content).digest("hex");
	}
	/**
	* 从所有会话结果收集文件信息
	*/
	collectAllFiles(sessionResults) {
		const allFiles = [];
		for (const result of sessionResults) allFiles.push(...result.files);
		return allFiles;
	}
};
HistoryWriterImpl = require_common$1.__decorate([(0, import_common.Component)(HistoryWriter)], HistoryWriterImpl);
//#endregion
//#region ../../packages/history-migration/src/common/core/migration-service.ts
/**
* 历史记录迁移服务实现
*
* 协调完整的迁移流程：
* 1. 验证配置
* 2. 从 agent-history 读取源数据
* 3. 检测冲突
* 4. 创建备份
* 5. 转换数据
* 6. 写入到 agent-cli 存储
* 7. 验证结果
* 8. 生成报告
*/
require_common$1.init_decorate();
var HistoryMigrationServiceImpl = class HistoryMigrationServiceImpl {
	/**
	* 执行完整的迁移流程
	*/
	async migrate(config, callbacks) {
		const migrationId = v4();
		const startTime = Date.now();
		const results = [];
		const issues = [];
		const pathMapping = {};
		let totalMessageCount = 0;
		const totalRequestCount = 0;
		let successCount = 0;
		let skipCount = 0;
		let errorCount = 0;
		this.validateConfig(config);
		callbacks?.onStart?.(config);
		const pathMapper = new PathMapperImpl();
		const reader = new HistoryReaderImpl();
		const converter = new DataConverterImpl();
		const writer = new HistoryWriterImpl();
		const validator = new DataValidatorImpl();
		const conflictResolver = new ConflictResolverImpl();
		const stateTracker = new MigrationStateTracker();
		let backupManifest;
		try {
			const projectHash = pathMapper.computeProjectHash(config.target.projectPath);
			const basePath = config.target.basePath || path.join(os.homedir(), CONSTANTS.PATHS.CODEBUDDY_BASE);
			const targetProjectDir = path.join(basePath, CONSTANTS.PATHS.SESSIONS_DIR, projectHash);
			stateTracker.setBasePath(basePath);
			backupManifest = await this.createBackup(targetProjectDir, migrationId, config.target.projectPath, projectHash, basePath, callbacks);
			callbacks?.onBeforeRead?.(config.source);
			await reader.initialize(config.source.workspacePath);
			const conversations = await reader.readConversations(config.source.filter ? {
				conversationIds: config.source.filter.conversationIds,
				afterTime: config.source.filter.afterTime
			} : void 0);
			const workspaceInfo = await reader.getWorkspaceInfo();
			callbacks?.onAfterRead?.({
				conversationCount: conversations.length,
				messageCount: workspaceInfo.messageCount,
				totalSize: workspaceInfo.totalSize
			});
			const migrationState = await stateTracker.loadState(config.target.projectPath);
			await converter.initialize({
				projectHash,
				sourceWorkspacePath: config.source.workspacePath,
				targetProjectPath: config.target.projectPath,
				pathMapping: /* @__PURE__ */ new Map(),
				options: config.conversion || {},
				basePath,
				brainPathMapping: config.brainPathMapping,
				sessionMetadataMap: config.sessionMetadataMap
			});
			await writer.initialize({
				projectPath: config.target.projectPath,
				projectHash,
				basePath,
				overwrite: config.strategy.overwrite,
				createBackup: false
			});
			const totalConversations = conversations.length;
			callbacks?.onBeforeConvert?.(totalConversations);
			const mergeStrategy = config.strategy.mergeStrategy || "merge";
			for (let i = 0; i < conversations.length; i++) {
				const conversation = conversations[i];
				const convStartTime = Date.now();
				try {
					const sourceIssues = await validator.validateSource(conversation);
					if (sourceIssues.some((issue) => issue.severity === "error")) {
						errorCount++;
						results.push({
							sourceId: conversation.id || `unknown-${i}`,
							targetId: "",
							status: "error",
							error: "Source data validation failed",
							metadata: {
								messageCount: 0,
								requestCount: 0,
								fileSize: 0,
								duration: Date.now() - convStartTime,
								checkpointsIncluded: 0
							}
						});
						issues.push(...sourceIssues);
						continue;
					}
					const result = await this.withRetry(async () => {
						let conversationIndex;
						try {
							conversationIndex = await reader.readConversationIndex(conversation.id);
						} catch {
							conversationIndex = void 0;
						}
						const allMessageIds = conversationIndex ? conversationIndex.messages.map((m) => m.id) : [];
						const sourceDataForHash = {
							id: conversation.id,
							messageIds: allMessageIds
						};
						const sourceHash = stateTracker.computeConversationHash(sourceDataForHash);
						if (!config.strategy.force && migrationState) {
							const existingInfo = migrationState.migratedConversations[conversation.id];
							if (existingInfo && existingInfo.sourceHash === sourceHash) {
								callbacks?.onConvertProgress?.(i + 1, totalConversations, conversation.name || conversation.id);
								return {
									action: "skipped",
									session: { sessionId: existingInfo.targetId },
									messageCount: 0,
									sourceHash,
									reason: "Already migrated with identical source data"
								};
							}
						} else if (!migrationState) {}
						const sessionShell = { sessionId: conversation.id };
						const conflicts = await conflictResolver.detectConflicts(sessionShell, targetProjectDir);
						if (conflicts.length > 0) {
							for (const conflict of conflicts) callbacks?.onConflictDetected?.(conflict);
							const resolutions = await conflictResolver.resolveConflicts(conflicts, mergeStrategy);
							callbacks?.onConflictsResolved?.(resolutions.length);
							if (!(config.strategy.overwrite || !!config.strategy.force) && resolutions.some((r) => r.resolution === "skip")) return {
								action: "skipped",
								session: sessionShell,
								messageCount: 0,
								sourceHash,
								reason: "Session already exists in target"
							};
						}
						let fileTreeNodes;
						try {
							fileTreeNodes = await reader.readConversationFileTree(conversation.id);
							if (fileTreeNodes && fileTreeNodes.length === 0) fileTreeNodes = void 0;
						} catch {
							fileTreeNodes = void 0;
						}
						callbacks?.onWriteProgress?.(i + 1, totalConversations, conversation.id);
						let sessionId = conversation.id;
						const sessionShellForOpen = {
							sessionId: conversation.id,
							createdAt: conversation.createdAt,
							meta: (() => {
								const m = {
									migratedFrom: "agent-history",
									migratedAt: (/* @__PURE__ */ new Date()).toISOString(),
									sourceConversationId: conversation.id
								};
								const sm = config.sessionMetadataMap?.get(conversation.id);
								if (sm?.isPlayground !== void 0) m.isPlayground = sm.isPlayground;
								if (sm?.cwd) m.cwd = sm.cwd;
								return m;
							})()
						};
						try {
							const { messageCount } = await converter.convertConversationStreaming(conversation, conversationIndex, (ids) => reader.readConversationMessagesByIds(conversation.id, ids), async (sid, items, isFirst) => {
								sessionId = sid;
								if (isFirst) writer.openSession(sessionShellForOpen);
								await writer.appendItems(sid, items);
							}, fileTreeNodes);
							await writer.closeSession(sessionId);
							const writeIssues = await validator.validateWrite({ sessionId }, targetProjectDir);
							issues.push(...writeIssues);
							callbacks?.onConvertProgress?.(i + 1, totalConversations, conversation.name || conversation.id);
							return {
								action: "success",
								session: { sessionId },
								messageCount,
								sourceHash
							};
						} catch (err) {
							await writer.closeSession(sessionId);
							throw err;
						}
					});
					if (result.action === "skipped") {
						skipCount++;
						pathMapping[conversation.id] = result.session.sessionId;
						results.push({
							sourceId: conversation.id,
							targetId: result.session.sessionId,
							status: "skipped",
							reason: result.reason || "Session already exists in target",
							metadata: {
								messageCount: result.messageCount,
								requestCount: 0,
								fileSize: 0,
								duration: Date.now() - convStartTime,
								checkpointsIncluded: 0
							}
						});
					} else {
						successCount++;
						totalMessageCount += result.messageCount;
						pathMapping[conversation.id] = result.session.sessionId;
						try {
							await stateTracker.markConversationMigrated(config.target.projectPath, {
								sourceId: conversation.id,
								targetId: result.session.sessionId,
								migratedAt: Date.now(),
								sourceHash: result.sourceHash,
								sourceWorkspace: config.source.workspacePath
							});
						} catch (stateError) {
							issues.push({
								severity: "warning",
								sessionId: conversation.id,
								message: "Failed to persist migration state",
								suggestion: "The migrated session is valid, but state tracking should be rebuilt on next run.",
								details: {
									error: stateError?.message || String(stateError),
									targetProjectPath: config.target.projectPath
								}
							});
						}
						results.push({
							sourceId: conversation.id,
							targetId: result.session.sessionId,
							status: "success",
							metadata: {
								messageCount: result.messageCount,
								requestCount: 0,
								fileSize: 0,
								duration: Date.now() - convStartTime,
								checkpointsIncluded: 0
							}
						});
					}
				} catch (err) {
					errorCount++;
					results.push({
						sourceId: conversation.id || `unknown-${i}`,
						targetId: "",
						status: "error",
						error: err.message || String(err),
						metadata: {
							messageCount: 0,
							requestCount: 0,
							fileSize: 0,
							duration: Date.now() - convStartTime,
							checkpointsIncluded: 0
						}
					});
					callbacks?.onError?.(err, true);
				}
			}
			callbacks?.onAfterConvert?.({
				successful: successCount,
				failed: errorCount,
				errors: results.filter((r) => r.status === "error").map((r) => r.error || "Unknown error")
			});
			callbacks?.onAfterWrite?.({
				written: successCount,
				skipped: skipCount,
				failed: errorCount
			});
			let validationPassed = true;
			if (config.strategy.validateData !== false) {
				callbacks?.onBeforeValidate?.();
				const sessionIds = results.filter((r) => r.status === "success").map((r) => r.targetId);
				if (sessionIds.length > 0) {
					const verifyResult = await writer.verify(sessionIds);
					if (verifyResult.errors && verifyResult.errors.length > 0) {
						validationPassed = false;
						for (const err of verifyResult.errors) issues.push({
							severity: "error",
							sessionId: err.sessionId,
							message: `Verification failed: ${err.message}`
						});
					}
				}
				const endTime = Date.now();
				const tempReport = this.buildReport({
					migrationId,
					startTime,
					endTime,
					config,
					projectHash,
					conversations,
					workspaceInfo,
					results,
					issues,
					pathMapping,
					validationPassed,
					totalMessageCount,
					totalRequestCount,
					successCount,
					skipCount,
					errorCount,
					backupManifest
				});
				const validationResult = await validator.validate(tempReport);
				if (!validationResult.passed) {
					validationPassed = false;
					issues.push(...validationResult.issues);
				}
				callbacks?.onValidationComplete?.(validationResult);
			}
			const endTime = Date.now();
			const blobStats = converter.getBlobStats();
			const report = this.buildReport({
				migrationId,
				startTime,
				endTime,
				config,
				projectHash,
				conversations,
				workspaceInfo,
				results,
				issues,
				pathMapping,
				validationPassed,
				totalMessageCount,
				totalRequestCount,
				successCount,
				skipCount,
				errorCount,
				backupManifest,
				blobStats
			});
			await this.saveMigrationHistory(basePath, report);
			callbacks?.onComplete?.(report);
			return report;
		} catch (err) {
			callbacks?.onError?.(err, false);
			const endTime = Date.now();
			const report = {
				id: migrationId,
				startTime,
				endTime,
				duration: endTime - startTime,
				sourceWorkspace: {
					path: config.source.workspacePath,
					conversationCount: 0,
					messageCount: 0,
					totalSize: 0
				},
				targetProject: {
					path: config.target.projectPath,
					projectHash: ""
				},
				statistics: {
					conversationCount: 0,
					sessionCount: 0,
					messageCount: 0,
					requestCount: 0,
					successCount,
					skipCount,
					errorCount: errorCount + 1
				},
				results,
				quality: {
					dataLoss: 0,
					dataLossPercentage: 0,
					conversionErrors: errorCount + 1,
					validationPassed: false,
					issues: [{
						severity: "error",
						sessionId: "migration",
						message: `Fatal migration error: ${err.message || String(err)}`
					}]
				},
				fileOperations: {
					checkpointsCreated: 0,
					fileVersionsCopied: 0,
					blobsExtracted: 0,
					totalBlobsSize: 0
				},
				rollback: { enabled: false },
				pathMapping
			};
			callbacks?.onComplete?.(report);
			return report;
		} finally {
			await Promise.allSettled([
				converter.dispose(),
				writer.dispose(),
				reader.dispose()
			]);
		}
	}
	/**
	* 验证迁移结果的数据一致性
	*/
	async validateMigration(report) {
		return new DataValidatorImpl().validate(report);
	}
	/**
	* 回滚迁移
	*
	* 步骤：
	* 1. 验证备份可用性
	* 2. 删除迁移过程中新写入的会话数据
	* 3. 从备份恢复原始数据
	* 4. 验证恢复结果
	*
	* @param report - Migration report from the original migration
	* @param basePath - Root directory (e.g. ~/.workbuddy). Defaults to ~/{CODEBUDDY_BASE}.
	*/
	async rollback(report, basePath) {
		const startTime = Date.now();
		if (!report.rollback.enabled || !report.rollback.backupLocation) return {
			success: false,
			message: "Rollback not available: no backup was created during migration",
			restoredSessions: 0,
			restoredMessages: 0,
			duration: Date.now() - startTime,
			rollbackTime: Date.now()
		};
		try {
			const backupDir = report.rollback.backupLocation;
			if (!await import_lib.pathExists(backupDir)) return {
				success: false,
				message: `Backup directory not found: ${backupDir}`,
				restoredSessions: 0,
				restoredMessages: 0,
				duration: Date.now() - startTime,
				rollbackTime: Date.now()
			};
			const manifestPath = path.join(backupDir, "manifest.json");
			let manifest;
			if (await import_lib.pathExists(manifestPath)) {
				const manifestContent = await import_lib.readFile(manifestPath, "utf-8");
				manifest = JSON.parse(manifestContent);
			}
			const pathMapper = new PathMapperImpl();
			const projectHash = report.targetProject.projectHash || pathMapper.computeProjectHash(report.targetProject.path);
			const resolvedBasePath = basePath || path.join(os.homedir(), CONSTANTS.PATHS.CODEBUDDY_BASE);
			const targetProjectDir = path.join(resolvedBasePath, CONSTANTS.PATHS.SESSIONS_DIR, projectHash);
			const successResults = report.results.filter((r) => r.status === "success");
			for (const result of successResults) {
				const jsonlPath = path.join(targetProjectDir, `${result.targetId}${CONSTANTS.FILES.SESSION_EXT}`);
				if (await import_lib.pathExists(jsonlPath)) await import_lib.remove(jsonlPath);
				const metaPath = path.join(targetProjectDir, `${result.targetId}${CONSTANTS.FILES.META_FILE}`);
				if (await import_lib.pathExists(metaPath)) await import_lib.remove(metaPath);
			}
			let restoredSessions = 0;
			if (manifest && manifest.files.length > 0) {
				for (const fileInfo of manifest.files) if (await import_lib.pathExists(fileInfo.backupPath)) {
					await import_lib.ensureDir(path.dirname(fileInfo.originalPath));
					await import_lib.copy(fileInfo.backupPath, fileInfo.originalPath, { overwrite: true });
					restoredSessions++;
				}
			} else {
				const dataFiles = (await import_lib.readdir(backupDir)).filter((f) => !f.startsWith(".") && f !== "manifest.json");
				if (dataFiles.length > 0 && await import_lib.pathExists(targetProjectDir)) for (const file of dataFiles) {
					const src = path.join(backupDir, file);
					const dest = path.join(targetProjectDir, file);
					await import_lib.copy(src, dest, { overwrite: true });
					restoredSessions++;
				}
			}
			return {
				success: true,
				message: `Successfully rolled back: removed ${successResults.length} migrated sessions, restored ${restoredSessions} backup items`,
				restoredSessions,
				restoredMessages: 0,
				duration: Date.now() - startTime,
				rollbackTime: Date.now()
			};
		} catch (err) {
			return {
				success: false,
				message: `Rollback failed: ${err.message || String(err)}`,
				restoredSessions: 0,
				restoredMessages: 0,
				duration: Date.now() - startTime,
				rollbackTime: Date.now()
			};
		}
	}
	/**
	* 获取项目的迁移统计信息
	*
	* @param projectPath - Project path
	* @param basePath - Root directory (e.g. ~/.workbuddy). Defaults to ~/{CODEBUDDY_BASE}.
	*/
	async getStatistics(projectPath, basePath) {
		const projectHash = new PathMapperImpl().computeProjectHash(projectPath);
		const resolvedBasePath = basePath || path.join(os.homedir(), CONSTANTS.PATHS.CODEBUDDY_BASE);
		const projectDir = path.join(resolvedBasePath, CONSTANTS.PATHS.SESSIONS_DIR, projectHash);
		let totalSessions = 0;
		let totalSize = 0;
		try {
			if (await import_lib.pathExists(projectDir)) {
				const sessionFiles = (await import_lib.readdir(projectDir)).filter((f) => f.endsWith(CONSTANTS.FILES.SESSION_EXT));
				totalSessions = sessionFiles.length;
				for (const file of sessionFiles) {
					const stat = await import_lib.stat(path.join(projectDir, file));
					totalSize += stat.size;
				}
			}
		} catch {}
		return {
			projectPath,
			totalSessions,
			totalMessages: 0,
			totalSize,
			migrationCount: 0
		};
	}
	/**
	* 查询迁移历史
	*
	* 从 {basePath}/.migration-history/ 目录读取历史记录
	*/
	async getMigrationHistory(options) {
		const resolvedBasePath = options?.basePath || path.join(os.homedir(), CONSTANTS.PATHS.CODEBUDDY_BASE);
		const historyDir = path.join(resolvedBasePath, CONSTANTS.PATHS.MIGRATION_HISTORY_DIR);
		try {
			if (!await import_lib.pathExists(historyDir)) return [];
			const jsonFiles = (await import_lib.readdir(historyDir)).filter((f) => f.endsWith(".json")).sort().reverse();
			const entries = [];
			for (const file of jsonFiles) try {
				const content = await import_lib.readFile(path.join(historyDir, file), "utf-8");
				const entry = JSON.parse(content);
				if (options?.projectPath && entry.targetProject !== options.projectPath) continue;
				entries.push(entry);
			} catch {}
			const offset = options?.offset || 0;
			const limit = options?.limit || entries.length;
			return entries.slice(offset, offset + limit);
		} catch {
			return [];
		}
	}
	/**
	* 批量迁移多个工作区
	*
	* 按配置串行或并行处理多个工作区，汇总所有迁移报告
	*/
	async migrateBatch(config, callbacks) {
		const batchId = v4();
		const startTime = Date.now();
		const workspaceReports = [];
		const stopOnError = config.globalStrategy?.stopOnError ?? false;
		const parallelWorkspaces = config.globalStrategy?.parallelWorkspaces ?? 1;
		if (parallelWorkspaces <= 1) for (const workspaceConfig of config.workspaces) try {
			const report = await this.migrate(workspaceConfig, callbacks);
			workspaceReports.push(report);
			if (stopOnError && report.statistics.errorCount > 0) break;
		} catch (err) {
			const errorReport = {
				id: v4(),
				startTime: Date.now(),
				endTime: Date.now(),
				duration: 0,
				sourceWorkspace: {
					path: workspaceConfig.source.workspacePath,
					conversationCount: 0,
					messageCount: 0,
					totalSize: 0
				},
				targetProject: {
					path: workspaceConfig.target.projectPath,
					projectHash: ""
				},
				statistics: {
					conversationCount: 0,
					sessionCount: 0,
					messageCount: 0,
					requestCount: 0,
					successCount: 0,
					skipCount: 0,
					errorCount: 1
				},
				results: [],
				quality: {
					dataLoss: 0,
					dataLossPercentage: 0,
					conversionErrors: 1,
					validationPassed: false,
					issues: [{
						severity: "error",
						sessionId: "migration",
						message: `Workspace migration failed: ${err.message || String(err)}`
					}]
				},
				fileOperations: {
					checkpointsCreated: 0,
					fileVersionsCopied: 0,
					blobsExtracted: 0,
					totalBlobsSize: 0
				},
				rollback: { enabled: false },
				pathMapping: {}
			};
			workspaceReports.push(errorReport);
			if (stopOnError) break;
		}
		else for (let i = 0; i < config.workspaces.length; i += parallelWorkspaces) {
			const batch = config.workspaces.slice(i, i + parallelWorkspaces);
			const batchResults = await Promise.allSettled(batch.map((workspaceConfig) => this.migrate(workspaceConfig, callbacks)));
			let shouldStop = false;
			for (const result of batchResults) if (result.status === "fulfilled") {
				workspaceReports.push(result.value);
				if (stopOnError && result.value.statistics.errorCount > 0) shouldStop = true;
			} else {
				const errorReport = {
					id: v4(),
					startTime: Date.now(),
					endTime: Date.now(),
					duration: 0,
					sourceWorkspace: {
						path: "",
						conversationCount: 0,
						messageCount: 0,
						totalSize: 0
					},
					targetProject: {
						path: "",
						projectHash: ""
					},
					statistics: {
						conversationCount: 0,
						sessionCount: 0,
						messageCount: 0,
						requestCount: 0,
						successCount: 0,
						skipCount: 0,
						errorCount: 1
					},
					results: [],
					quality: {
						dataLoss: 0,
						dataLossPercentage: 0,
						conversionErrors: 1,
						validationPassed: false,
						issues: [{
							severity: "error",
							sessionId: "migration",
							message: `Workspace migration failed: ${result.reason?.message || String(result.reason)}`
						}]
					},
					fileOperations: {
						checkpointsCreated: 0,
						fileVersionsCopied: 0,
						blobsExtracted: 0,
						totalBlobsSize: 0
					},
					rollback: { enabled: false },
					pathMapping: {}
				};
				workspaceReports.push(errorReport);
				if (stopOnError) shouldStop = true;
			}
			if (shouldStop) break;
		}
		const endTime = Date.now();
		let totalConversations = 0;
		let totalMessages = 0;
		let successWorkspaces = 0;
		let partialWorkspaces = 0;
		let errorWorkspaces = 0;
		for (const report of workspaceReports) {
			totalConversations += report.statistics.conversationCount;
			totalMessages += report.statistics.messageCount;
			if (report.statistics.errorCount === 0) successWorkspaces++;
			else if (report.statistics.successCount > 0 || report.statistics.skipCount > 0) partialWorkspaces++;
			else errorWorkspaces++;
		}
		return {
			id: batchId,
			startTime,
			endTime,
			duration: endTime - startTime,
			workspaceReports,
			summary: {
				totalWorkspaces: workspaceReports.length,
				successCount: successWorkspaces,
				partialCount: partialWorkspaces,
				errorCount: errorWorkspaces,
				totalConversations,
				totalMessages
			}
		};
	}
	/**
	* 验证迁移配置
	*/
	validateConfig(config) {
		if (!config) throw new ConfigError("Migration config is required");
		if (!config.source || !config.source.workspacePath) throw new ConfigError("Source workspace path is required");
		if (!config.target || !config.target.projectPath) throw new ConfigError("Target project path is required");
		if (config.source.type !== "agent-history") throw new ConfigError(`Unsupported source type: ${config.source.type}`);
		if (config.target.type !== "agent-cli") throw new ConfigError(`Unsupported target type: ${config.target.type}`);
	}
	/**
	* 构建迁移报告
	*/
	buildReport(params) {
		const totalSourceMessages = params.workspaceInfo.messageCount || 0;
		const dataLoss = Math.max(0, totalSourceMessages - params.totalMessageCount);
		const dataLossPercentage = totalSourceMessages > 0 ? dataLoss / totalSourceMessages * 100 : 0;
		return {
			id: params.migrationId,
			startTime: params.startTime,
			endTime: params.endTime,
			duration: params.endTime - params.startTime,
			sourceWorkspace: {
				path: params.config.source.workspacePath,
				conversationCount: params.conversations.length,
				messageCount: totalSourceMessages,
				totalSize: params.workspaceInfo.totalSize || 0
			},
			targetProject: {
				path: params.config.target.projectPath,
				projectHash: params.projectHash
			},
			statistics: {
				conversationCount: params.conversations.length,
				sessionCount: params.successCount,
				messageCount: params.totalMessageCount,
				requestCount: params.totalRequestCount,
				successCount: params.successCount,
				skipCount: params.skipCount,
				errorCount: params.errorCount
			},
			results: params.results,
			quality: {
				dataLoss,
				dataLossPercentage,
				conversionErrors: params.errorCount,
				validationPassed: params.validationPassed,
				issues: params.issues
			},
			fileOperations: {
				checkpointsCreated: 0,
				fileVersionsCopied: 0,
				blobsExtracted: params.blobStats?.blobsExtracted ?? 0,
				totalBlobsSize: params.blobStats?.totalBlobsSize ?? 0
			},
			rollback: params.backupManifest ? {
				enabled: true,
				backupLocation: params.backupManifest.backupDir,
				backupTimestamp: params.backupManifest.timestamp,
				canRollback: true
			} : { enabled: false },
			pathMapping: params.pathMapping
		};
	}
	/**
	* 创建备份
	*
	* 在迁移前备份目标目录中已有的数据，以支持回滚操作。
	* 如果目标目录不存在或为空，则跳过备份。
	*/
	async createBackup(targetProjectDir, migrationId, targetProjectPath, projectHash, basePath, callbacks) {
		if (!import_lib.existsSync(targetProjectDir)) return;
		const dataFiles = import_lib.readdirSync(targetProjectDir).filter((f) => !f.startsWith("."));
		if (dataFiles.length === 0) return;
		let sourceSize = 0;
		for (const file of dataFiles) try {
			const stat = import_lib.statSync(path.join(targetProjectDir, file));
			sourceSize += stat.size;
		} catch {}
		callbacks?.onBeforeBackup?.({
			sourceSize: 0,
			targetSize: sourceSize
		});
		const backupId = v4();
		const timestamp = Date.now();
		const backupDir = path.join(basePath, CONSTANTS.PATHS.BACKUP_DIR, `${timestamp}-${migrationId}`);
		import_lib.mkdirSync(backupDir, { recursive: true });
		const backupFiles = [];
		for (const file of dataFiles) {
			const originalPath = path.join(targetProjectDir, file);
			const backupPath = path.join(backupDir, file);
			try {
				const stat = import_lib.statSync(originalPath);
				const content = import_lib.readFileSync(originalPath);
				const checksum = crypto.createHash("sha256").update(content).digest("hex");
				import_lib.copyFileSync(originalPath, backupPath);
				backupFiles.push({
					originalPath,
					backupPath,
					size: stat.size,
					checksum
				});
			} catch {}
		}
		const manifest = {
			id: backupId,
			migrationId,
			timestamp,
			targetProjectPath,
			projectHash,
			files: backupFiles,
			backupDir
		};
		const manifestPath = path.join(backupDir, "manifest.json");
		import_lib.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
		callbacks?.onAfterBackup?.(backupDir);
		return manifest;
	}
	/**
	* 带重试的异步操作执行器
	*
	* 使用指数退避策略，在操作失败时自动重试。
	* 重试次数、初始延迟和最大延迟由 CONSTANTS.RETRY 配置。
	*/
	async withRetry(fn) {
		const maxAttempts = CONSTANTS.RETRY.MAX_ATTEMPTS;
		const initialDelay = CONSTANTS.RETRY.INITIAL_DELAY;
		const maxDelay = CONSTANTS.RETRY.MAX_DELAY;
		const multiplier = CONSTANTS.RETRY.BACKOFF_MULTIPLIER;
		let lastError;
		for (let attempt = 1; attempt <= maxAttempts; attempt++) try {
			return await fn();
		} catch (err) {
			lastError = err;
			if (attempt === maxAttempts) break;
			const delay = Math.min(initialDelay * Math.pow(multiplier, attempt - 1), maxDelay);
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
		throw lastError;
	}
	/**
	* 保存迁移历史记录
	*
	* 将迁移报告摘要写入 {basePath}/.migration-history/ 目录，
	* 用于后续查询和增量迁移参考。
	*/
	async saveMigrationHistory(basePath, report) {
		try {
			const historyDir = path.join(basePath, CONSTANTS.PATHS.MIGRATION_HISTORY_DIR);
			import_lib.mkdirSync(historyDir, { recursive: true });
			const entry = {
				id: report.id,
				timestamp: report.endTime,
				sourceWorkspace: report.sourceWorkspace.path,
				targetProject: report.targetProject.path,
				status: report.statistics.errorCount === 0 ? "success" : report.statistics.successCount > 0 ? "partial" : "failed",
				conversationCount: report.statistics.conversationCount,
				messageCount: report.statistics.messageCount,
				successCount: report.statistics.successCount,
				skipCount: report.statistics.skipCount,
				errorCount: report.statistics.errorCount,
				duration: report.duration
			};
			const fileName = `${report.endTime}-${report.id}.json`;
			const filePath = path.join(historyDir, fileName);
			import_lib.writeFileSync(filePath, JSON.stringify(entry, null, 2), "utf-8");
		} catch {}
	}
};
HistoryMigrationServiceImpl = require_common$1.__decorate([(0, import_common.Component)(HistoryMigrationService)], HistoryMigrationServiceImpl);
//#endregion
//#region ../../packages/workbuddy-server/src/migration/archived-sync-service.ts
/**
* M22 —— 归档迁移时序缺陷修复。
*
* ## 背景
*
* M21（MR #33745）修好了"归档 ID 在 localStorage→history 时序中被丢弃"的首次
* 迁移问题，引入了 `legacy_archived_session_ids_pending` 快照 + history 完成后
* `replayArchivedSessionIdsPatch` 回放的两阶段模型。
*
* 但遗留一个**时序缺陷**：当 localStorage 迁移和 history 迁移发生在**不同启动
* 会话**（可能间隔几小时到几天），replay 用的是**第一次启动时冻结的 pending
* 快照**，而不是 history 完成**当下**老 WB 的实际归档状态。用户在两次启动之间
* 对老 WB 的任何归档 / 取消归档操作都会被忽略，结果是"陈旧快照覆盖现实"。
*
* ## 方案
*
* 不信任 pending，**在 history 成功完成的那一刻 fresh-read legacy localStorage**，
* 拿最新的 `genie-archived-session-ids` 应用到新 DB。一次性完成标志 + 只加不减
* 语义，匹配产品决策（参见 `docs/refactor/migration/22-archived-session-continuous-sync.md`）。
*
* ## 保证
*
* - **单向**：只从老 WB → 新 WB 拉归档状态
* - **一次性**：`legacy_archived_sync_done` meta 写入后永久 skip
* - **只加不减**：legacy 数组中的 id → 置 archived；不在数组里的 id → 不干预
* - **时序闸门**：必须 `legacy_history_migration.status === 'success'` 才触发
* - **失败吞错**：任何异常都吞到 fileLogger，不影响 history / 启动 / 假阳性迁移失败
* - **不退化 M21**：`replayArchivedSessionIdsPatch` / `replayArchivedManual` / RPC 保留
*/
/** 一次性完成标志 meta key。写入后 sync 永久 skip。 */
var LEGACY_ARCHIVED_SYNC_DONE_META_KEY = "legacy_archived_sync_done";
/** History 迁移 meta key（与 migration-service.ts 保持同值）。 */
var HISTORY_MIGRATION_META_KEY$1 = "legacy_history_migration";
/** 老 WB localStorage 里归档 ID 数组的 key。 */
var LEGACY_ARCHIVED_KEY = "genie-archived-session-ids";
/** 归档状态字面量 —— 与 DB `sessions.status` 约定一致（lowercase）。 */
var ARCHIVED_STATUS = "archived";
function getLegacySessionPath() {
	if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support", "WorkBuddy");
	if (process.platform === "win32") return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "WorkBuddy");
	return path.join(os.homedir(), ".config", "WorkBuddy");
}
var NOOP_LOGGER = {
	info: () => void 0,
	warn: () => void 0
};
/**
* 归档同步服务（M22）。
*
* **生命周期**：由 `MigrationService` 持有，随进程启停。`onComplete` 订阅者
* 在主进程 shutdown 时通过返回的 disposer 释放。
*/
var ArchivedSyncService = class {
	constructor(database, fileLogger, localStorageServiceFactory, options = {}) {
		this.database = database;
		this.fileLogger = fileLogger;
		this.localStorageServiceFactory = localStorageServiceFactory;
		this.options = options;
		this.completedHandlers = /* @__PURE__ */ new Set();
	}
	/**
	* 一次性从老 WB localStorage 读取归档状态并应用到新 DB。
	*
	* 详细算法见文档 §2.9。失败不抛，总是返回 `ArchivedSyncResult`。
	*/
	async syncFromLegacyOnce() {
		const start = Date.now();
		const logger = this.options.logger ?? NOOP_LOGGER;
		logger.info("[ArchivedSync] syncFromLegacyOnce begin");
		if (this.database.getMigrationMeta("legacy_archived_sync_done")) {
			this.fileLogger.info("[ArchivedSync] Skipped: already_done");
			logger.info("[ArchivedSync] syncFromLegacyOnce end: skipped=already_done");
			return this.skipResult("already_done", start);
		}
		const historyMeta = this.database.getMigrationMeta(HISTORY_MIGRATION_META_KEY$1);
		if (!historyMeta) {
			this.fileLogger.info("[ArchivedSync] Skipped: history_not_ready (meta missing)");
			logger.info("[ArchivedSync] syncFromLegacyOnce end: skipped=history_not_ready (meta missing)");
			return this.skipResult("history_not_ready", start);
		}
		let historyStatus;
		try {
			const parsed = JSON.parse(historyMeta);
			historyStatus = typeof parsed.status === "string" ? parsed.status : void 0;
		} catch {
			this.fileLogger.warn("[ArchivedSync] Skipped: history_not_ready (meta parse failed)");
			logger.info("[ArchivedSync] syncFromLegacyOnce end: skipped=history_not_ready (meta parse failed)");
			return this.skipResult("history_not_ready", start);
		}
		if (historyStatus !== "success") {
			this.fileLogger.info(`[ArchivedSync] Skipped: history_not_ready (status=${historyStatus ?? "undefined"})`);
			logger.info(`[ArchivedSync] syncFromLegacyOnce end: skipped=history_not_ready (status=${historyStatus ?? "undefined"})`);
			return this.skipResult("history_not_ready", start);
		}
		const legacyPath = (this.options.getLegacySessionPath ?? getLegacySessionPath)();
		if (!fs.existsSync(legacyPath)) {
			this.fileLogger.info(`[ArchivedSync] Skipped: legacy_path_missing (${legacyPath})`);
			logger.info("[ArchivedSync] syncFromLegacyOnce end: skipped=legacy_path_missing");
			return this.skipResult("legacy_path_missing", start);
		}
		let freshEntries;
		logger.info("[ArchivedSync] Calling localStorage migration adapter");
		try {
			const svc = this.localStorageServiceFactory?.();
			if (!svc) {
				this.fileLogger.warn("[ArchivedSync] legacy_read_failed (localStorage adapter missing)");
				logger.warn("[ArchivedSync] syncFromLegacyOnce end: legacy_read_failed (localStorage adapter missing)");
				return this.skipResult("legacy_read_failed", start);
			}
			const result = await svc.migrate();
			logger.info(`[ArchivedSync] localStorage migration adapter returned (skipped=${result.skipped}, reason=${result.reason ?? "success"})`);
			if (result.skipped) {
				this.fileLogger.warn(`[ArchivedSync] legacy_read_failed (${result.reason ?? "unknown"}), writing completion flag to avoid retrying`);
				logger.warn(`[ArchivedSync] syncFromLegacyOnce end: legacy_read_failed (${result.reason ?? "unknown"}), giving up`);
				this.writeCompletionFlag(0, 0, legacyPath);
				return this.skipResult("legacy_read_failed", start);
			}
			freshEntries = result.entries;
		} catch (err) {
			this.fileLogger.warn(`[ArchivedSync] legacy_read_failed (threw: ${err instanceof Error ? err.message : String(err)}), writing completion flag to avoid retrying`);
			logger.warn("[ArchivedSync] syncFromLegacyOnce end: legacy_read_failed (threw), giving up", err);
			this.writeCompletionFlag(0, 0, legacyPath);
			return this.skipResult("legacy_read_failed", start);
		}
		this.fileLogger.info(`[ArchivedSync] Fresh read completed: ${Object.keys(freshEntries).length} entries`);
		const raw = freshEntries[LEGACY_ARCHIVED_KEY];
		if (!raw) {
			this.writeCompletionFlag(0, 0, legacyPath);
			const result = {
				skipped: false,
				reason: "no_entries",
				applied: 0,
				considered: 0,
				durationMs: Date.now() - start,
				completedAt: Date.now()
			};
			this.fileLogger.info("[ArchivedSync] Completed: applied=0 considered=0 (no_entries, legacy array absent)");
			logger.info("[ArchivedSync] syncFromLegacyOnce end: completed (no_entries, legacy array absent)");
			this.fireCompleted(result);
			return result;
		}
		let ids;
		try {
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) throw new Error("legacy archived value is not an array");
			ids = parsed.filter((x) => typeof x === "string" && x.length > 0);
		} catch (err) {
			this.fileLogger.warn(`[ArchivedSync] Legacy array parse failed, treating as no_entries: ${err instanceof Error ? err.message : String(err)}`);
			this.writeCompletionFlag(0, 0, legacyPath);
			const result = {
				skipped: false,
				reason: "no_entries",
				applied: 0,
				considered: 0,
				durationMs: Date.now() - start,
				completedAt: Date.now()
			};
			logger.info("[ArchivedSync] syncFromLegacyOnce end: completed (no_entries, parse failed)");
			this.fireCompleted(result);
			return result;
		}
		if (ids.length === 0) {
			this.writeCompletionFlag(0, 0, legacyPath);
			const result = {
				skipped: false,
				reason: "no_entries",
				applied: 0,
				considered: 0,
				durationMs: Date.now() - start,
				completedAt: Date.now()
			};
			this.fileLogger.info("[ArchivedSync] Completed: applied=0 considered=0 (no_entries, empty array)");
			logger.info("[ArchivedSync] syncFromLegacyOnce end: completed (no_entries, empty array)");
			this.fireCompleted(result);
			return result;
		}
		const now = Date.now();
		let applied = 0;
		for (const id of ids) try {
			const session = this.database.getSession(id);
			if (!session) continue;
			if (session.deletedAt) continue;
			if (session.status?.toLowerCase() === ARCHIVED_STATUS) continue;
			if (this.database.updateSessionStatus(id, ARCHIVED_STATUS, now) > 0) applied++;
		} catch (err) {
			this.fileLogger.warn(`[ArchivedSync] Failed to archive ${id}: ${err instanceof Error ? err.message : String(err)}`);
		}
		this.writeCompletionFlag(applied, ids.length, legacyPath);
		const result = {
			skipped: false,
			reason: "ok",
			applied,
			considered: ids.length,
			durationMs: Date.now() - start,
			completedAt: now
		};
		this.fileLogger.info(`[ArchivedSync] Completed: applied=${applied} considered=${ids.length} durationMs=${result.durationMs}`);
		logger.info(`[ArchivedSync] syncFromLegacyOnce end: completed (ok, applied=${applied}/${ids.length}, durationMs=${result.durationMs})`);
		this.fireCompleted(result);
		return result;
	}
	/**
	* 订阅完成事件。**仅** `skipped=false` 的执行会触发（skip 分支不触发，
	* 避免 renderer 每次启动都收到无意义事件）。
	*
	* @returns disposer。调用即从订阅列表中移除。
	*/
	onComplete(handler) {
		this.completedHandlers.add(handler);
		return () => {
			this.completedHandlers.delete(handler);
		};
	}
	/**
	* 清除完成标志。测试用途 / QA 工具强制重跑用。生产路径不暴露。
	*/
	clearCompletionFlag() {
		this.database.deleteMigrationMeta(LEGACY_ARCHIVED_SYNC_DONE_META_KEY);
	}
	writeCompletionFlag(applied, considered, legacySource) {
		const payload = {
			completedAt: Date.now(),
			applied,
			considered,
			legacySource
		};
		try {
			this.database.setMigrationMeta(LEGACY_ARCHIVED_SYNC_DONE_META_KEY, JSON.stringify(payload));
			this.fileLogger.info(`[ArchivedSync] Completion flag written: applied=${applied} considered=${considered}`);
		} catch (err) {
			this.fileLogger.error("[ArchivedSync] Failed to write completion flag:", err instanceof Error ? err : new Error(String(err)));
		}
	}
	fireCompleted(result) {
		for (const handler of this.completedHandlers) try {
			handler(result);
		} catch (err) {
			this.fileLogger.warn(`[ArchivedSync] onComplete handler threw: ${err instanceof Error ? err.message : String(err)}`);
		}
	}
	skipResult(reason, start) {
		return {
			skipped: true,
			reason,
			applied: 0,
			considered: 0,
			durationMs: Date.now() - start
		};
	}
};
//#endregion
//#region ../../packages/workbuddy-server/src/migration/automation-migration.ts
var AutomationMigrationService = class {
	constructor(database) {
		this.database = database;
	}
	/**
	* 从旧系统数据库迁移 automation 数据到统一数据库。
	*
	* @param sourcePath  旧库路径
	* @param lastSyncAt  上次同步的 watermark（epoch ms）。
	*                    为 0 时执行全量迁移，大于 0 时只查询 updated_at > lastSyncAt 的行。
	*                    写入时会与目标库做 updated_at 比较，保护目标库中用户已修改的数据。
	*/
	migrateFromLegacyDatabase(sourcePath = getLegacyAutomationDatabasePath(), lastSyncAt = 0) {
		let legacyDb;
		try {
			legacyDb = require_readonly.openReadonlySqliteDatabase(sourcePath);
		} catch {
			return {
				sourcePath,
				skipped: true,
				automationsMigrated: 0,
				automationsSkipped: 0,
				runsMigrated: 0,
				runsSkipped: 0
			};
		}
		try {
			const automations = legacyDb.prepare("SELECT * FROM automations WHERE updated_at > ?").all(lastSyncAt);
			const runs = legacyDb.prepare("SELECT * FROM automation_runs WHERE updated_at > ?").all(lastSyncAt);
			let automationsSkipped = 0;
			for (const row of automations) {
				const existing = this.database.getAutomation(row.id, { includeDeleted: true });
				if (existing && existing.updatedAt >= row.updated_at) {
					automationsSkipped++;
					continue;
				}
				const automation = {
					id: row.id,
					name: row.name,
					prompt: row.prompt,
					status: row.status,
					scheduleType: row.schedule_type ?? "recurring",
					nextRunAt: row.next_run_at ?? void 0,
					lastRunAt: row.last_run_at ?? void 0,
					cwds: parseCwds(row.cwds),
					rrule: row.rrule ?? "",
					scheduledAt: row.scheduled_at ?? void 0,
					validFrom: row.valid_from ?? void 0,
					validUntil: row.valid_until ?? void 0,
					modelId: row.model_id ?? void 0,
					modelIsThinking: Boolean(row.model_is_thinking),
					pushToWeChat: Boolean(row.push_to_wechat),
					createdAt: row.created_at,
					updatedAt: row.updated_at
				};
				this.database.upsertAutomation(automation);
			}
			let runsSkipped = 0;
			for (const row of runs) {
				const existing = this.database.getAutomationRun(row.thread_id);
				if (existing && existing.updatedAt >= row.updated_at) {
					runsSkipped++;
					continue;
				}
				const run = {
					threadId: row.thread_id,
					automationId: row.automation_id,
					status: row.status,
					readAt: row.read_at ?? void 0,
					threadTitle: row.thread_title ?? void 0,
					sourceCwd: row.source_cwd ?? void 0,
					runsJson: row.runs_json ?? void 0,
					resultSuccess: row.result_success === null || row.result_success === void 0 ? void 0 : Boolean(row.result_success),
					createdAt: row.created_at,
					updatedAt: row.updated_at
				};
				this.database.upsertAutomationRun(run);
			}
			return {
				sourcePath,
				skipped: false,
				automationsMigrated: automations.length - automationsSkipped,
				automationsSkipped,
				runsMigrated: runs.length - runsSkipped,
				runsSkipped
			};
		} finally {
			legacyDb.close();
		}
	}
};
function getLegacyAutomationDatabasePath() {
	return path.join(getLegacyAppDataDir$5(), "WorkBuddy", "automations", "automations.db");
}
function getLegacyAppDataDir$5() {
	if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support");
	if (process.platform === "win32") return process.env.APPDATA?.trim() || path.join(os.homedir(), "AppData", "Roaming");
	return process.env.XDG_CONFIG_HOME?.trim() || path.join(os.homedir(), ".config");
}
function parseCwds(rawCwds) {
	if (!rawCwds) return [];
	try {
		const parsed = JSON.parse(rawCwds);
		return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
	} catch {
		return [];
	}
}
//#endregion
//#region ../../packages/workbuddy-server/src/migration/claw-settings-migration.ts
/**
* ClawSettingsMigrationService
*
* Migrates Claw channel configurations from the legacy VS Code-based
* WorkBuddy settings.json to the new ~/.workbuddy/settings.json.
*
* Source: ~/Library/Application Support/WorkBuddy/User/settings.json
*   - `claw.channels`   — new-format channel configs (wecomaibot, wechatmp, etc.)
*   - `wecom.channels`  — old-format channel configs (fallback; may still wrap credentials in `extra`)
*   - `wecom.botId` / `wecom.botSecret` / `wecom.connectionMode` — oldest wecomaibot format
*   - `wecom.enabled`   — legacy IOA enable switch
*
* Target: ~/.workbuddy/settings.json
*   - `claw.channels`   — merged channel configurations
*
* Merge strategy:
*   This migration is **one-shot** — once completed, subsequent startups skip it
*   (guarded by `migration_meta`). For `force` re-runs, the merge uses a
*   "target-wins" policy: existing Desktop channel configs are preserved,
*   and only channels that do NOT exist in the target are added from source.
*   This prevents stale legacy data from overwriting user changes made in Desktop.
*/
var ClawSettingsMigrationService = class {
	/**
	* Read Claw/wecom channel configs from legacy settings and write into
	* the new settings file under the `claw` key.
	*/
	async migrate(sourcePath = getLegacySettingsPath(), targetPath = getTargetSettingsPath()) {
		const result = {
			sourcePath,
			targetPath,
			skipped: false,
			channelsMigrated: 0,
			channelNames: []
		};
		if (!fs.existsSync(sourcePath)) {
			result.skipped = true;
			result.reason = "legacy_settings_not_found";
			return result;
		}
		let legacySettings;
		try {
			const raw = fs.readFileSync(sourcePath, "utf-8");
			legacySettings = JSON.parse(raw);
		} catch (error) {
			result.skipped = true;
			result.reason = `legacy_settings_parse_error: ${error instanceof Error ? error.message : String(error)}`;
			return result;
		}
		const clawChannels = legacySettings["claw.channels"];
		const wecomChannels = legacySettings["wecom.channels"];
		const mergedChannels = {};
		if (wecomChannels && typeof wecomChannels === "object") {
			for (const [channelType, rawConfig] of Object.entries(wecomChannels)) if (rawConfig && typeof rawConfig === "object") mergedChannels[this.normalizeLegacyChannelType(channelType)] = this.normalizeWecomChannel(channelType, rawConfig);
		}
		this.applyLegacyWecomAiBotSettings(legacySettings, mergedChannels);
		this.applyLegacyWecomEnabled(legacySettings, mergedChannels);
		if (clawChannels && typeof clawChannels === "object") {
			for (const [channelType, config] of Object.entries(clawChannels)) if (config && typeof config === "object") {
				const normalizedType = this.normalizeLegacyChannelType(channelType);
				mergedChannels[normalizedType] = {
					...mergedChannels[normalizedType],
					...config
				};
			}
		}
		if (Object.keys(mergedChannels).length === 0) {
			result.skipped = true;
			result.reason = "no_channel_configs_found";
			return result;
		}
		const protectionAttempt = new require_credential_protection.CredentialProtectionFailureReporter({
			filePath: targetPath,
			resourceId: "settings/user",
			adapter: "credential-fields",
			processRole: "daemon",
			logger: console
		}).attempt("migrate");
		try {
			await require_credential_protection.withCredentialFileLock(targetPath, () => {
				let persistedSettings = {};
				if (fs.existsSync(targetPath)) try {
					persistedSettings = JSON.parse(fs.readFileSync(targetPath, "utf-8"));
				} catch (error) {
					throw new Error(`target_settings_parse_error: ${error instanceof Error ? error.message : String(error)}`);
				}
				const codec = require_credential_protection.createUserSettingsCredentialCodec(protectionAttempt.onUnavailable);
				try {
					const existingSettings = codec.decode(persistedSettings).value;
					const existingClaw = existingSettings["claw"];
					const existingChannels = existingClaw?.["channels"] ?? {};
					const finalChannels = { ...existingChannels };
					for (const [channelType, config] of Object.entries(mergedChannels)) if (!(channelType in finalChannels)) finalChannels[channelType] = config;
					const clawSettings = { channels: finalChannels };
					existingSettings["claw"] = existingClaw && typeof existingClaw === "object" ? {
						...existingClaw,
						...clawSettings
					} : clawSettings;
					console.warn("[ClawSettingsMigration] writing merged claw.channels to settings.json", {
						targetPath,
						existingChannelsBefore: Object.keys(existingChannels),
						finalChannelsAfter: Object.keys(finalChannels),
						mergedFromLegacy: Object.keys(mergedChannels)
					});
					require_credential_protection.writeCredentialFileAtomicallySync(targetPath, Buffer.from(JSON.stringify(codec.encode(existingSettings), null, 2), "utf8"));
					protectionAttempt.complete();
					const newlyAdded = Object.keys(mergedChannels).filter((ch) => !(ch in existingChannels));
					result.channelsMigrated = newlyAdded.length;
					result.channelNames = newlyAdded;
				} finally {
					codec.dispose();
				}
			});
		} catch (error) {
			protectionAttempt.fail(error);
			result.skipped = true;
			result.reason = error instanceof Error ? error.message : String(error);
		}
		return result;
	}
	/**
	* Normalize a wecom.channels entry into the claw.channels format.
	* The old format stores response data under a `response` sub-key;
	* we flatten it into the standard channel config shape.
	*/
	normalizeWecomChannel(_channelType, raw) {
		const { extra, response, ...rest } = raw;
		const normalizedExtra = extra && typeof extra === "object" ? extra : {};
		const normalizedResponse = response && typeof response === "object" ? response : void 0;
		const registration = normalizedResponse ? {
			webhookUrl: typeof normalizedResponse["webhookUrl"] === "string" ? normalizedResponse["webhookUrl"] : void 0,
			sessionId: typeof normalizedResponse["sessionId"] === "string" ? normalizedResponse["sessionId"] : void 0
		} : void 0;
		const channelId = typeof raw["channelId"] === "string" ? raw["channelId"] : typeof normalizedResponse?.["channelId"] === "string" ? normalizedResponse["channelId"] : void 0;
		const config = {
			enabled: true,
			...rest,
			channelId,
			...normalizedExtra
		};
		if (registration?.webhookUrl || registration?.sessionId) config.registration = registration;
		if (typeof config.connectionMode !== "string" || !config.connectionMode) config.connectionMode = "webhook";
		return config;
	}
	applyLegacyWecomAiBotSettings(legacySettings, mergedChannels) {
		const legacyBotId = typeof legacySettings["wecom.botId"] === "string" ? legacySettings["wecom.botId"] : void 0;
		if (!legacyBotId) return;
		const legacyBotSecret = typeof legacySettings["wecom.botSecret"] === "string" ? legacySettings["wecom.botSecret"] : void 0;
		const legacyConnectionMode = typeof legacySettings["wecom.connectionMode"] === "string" ? legacySettings["wecom.connectionMode"] : "websocket";
		const existing = mergedChannels["wecomaibot"] ?? {};
		mergedChannels["wecomaibot"] = {
			...existing,
			enabled: existing.enabled ?? true,
			channelId: typeof existing.channelId === "string" && existing.channelId ? existing.channelId : legacyBotId,
			botId: typeof existing.botId === "string" && existing.botId ? existing.botId : legacyBotId,
			botSecret: typeof existing.botSecret === "string" ? existing.botSecret : legacyBotSecret || "",
			connectionMode: typeof existing.connectionMode === "string" && existing.connectionMode ? existing.connectionMode : legacyConnectionMode
		};
	}
	applyLegacyWecomEnabled(legacySettings, mergedChannels) {
		const wecomEnabled = legacySettings["wecom.enabled"];
		if (typeof wecomEnabled !== "boolean") return;
		const existing = mergedChannels["wecomIOA"] ?? {};
		mergedChannels["wecomIOA"] = {
			...existing,
			enabled: existing.enabled ?? wecomEnabled
		};
	}
	normalizeLegacyChannelType(channelType) {
		return channelType === "weixinBot" ? "weixinClawBot" : channelType;
	}
};
function getLegacySettingsPath() {
	return path.join(getLegacyAppDataDir$4(), "WorkBuddy", "User", "settings.json");
}
function getTargetSettingsPath() {
	return path.join(getWorkbuddyConfigDir$5(), "settings.json");
}
function getLegacyAppDataDir$4() {
	if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support");
	if (process.platform === "win32") return process.env.APPDATA?.trim() || path.join(os.homedir(), "AppData", "Roaming");
	return process.env.XDG_CONFIG_HOME?.trim() || path.join(os.homedir(), ".config");
}
function getWorkbuddyConfigDir$5() {
	return process.env.WORKBUDDY_CONFIG_DIR?.trim() || process.env.CODEBUDDY_CONFIG_DIR?.trim() || path.join(os.homedir(), ".workbuddy");
}
//#endregion
//#region ../../packages/workbuddy-server/src/migration/expert-recents-migration-service.ts
var LEGACY_HISTORY_FILE = path.join("app", "data", "expert-history.json");
var EXPERT_STORAGE_FILE = "expert.json";
var SHARED_HISTORY_KEY = "__global__";
var EXPERT_RECENTS_KEY = "recents";
var DEFAULT_RECENTS_LIMIT = 20;
function isRecord$1(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
function readJsonFile(filePath) {
	return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}
function readObjectFile(filePath) {
	try {
		const value = readJsonFile(filePath);
		return isRecord$1(value) ? value : {};
	} catch {
		return {};
	}
}
function normalizeRecentExperts(value, limit) {
	if (!Array.isArray(value)) return [];
	return value.filter((item) => isRecord$1(item) && typeof item.id === "string" && item.id.length > 0).slice(0, limit);
}
function writeJsonAtomic(filePath, data) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	const tempPath = `${filePath}.tmp`;
	fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
	fs.renameSync(tempPath, filePath);
}
function migrateLegacyExpertRecents(options) {
	const sourcePath = path.join(options.configDir, LEGACY_HISTORY_FILE);
	const limit = options.limit ?? DEFAULT_RECENTS_LIMIT;
	const userId = options.userId?.trim();
	if (!userId) return {
		skipped: true,
		reason: "missing_user_id",
		sourcePath,
		migratedCount: 0
	};
	if (!fs.existsSync(sourcePath)) return {
		skipped: true,
		reason: "legacy_file_missing",
		sourcePath,
		migratedCount: 0
	};
	const recents = normalizeRecentExperts(readJsonFile(sourcePath).sessions?.[SHARED_HISTORY_KEY], limit);
	const targetPath = path.join(options.configDir, "storage", `user-${userId}`, EXPERT_STORAGE_FILE);
	const target = readObjectFile(targetPath);
	target[EXPERT_RECENTS_KEY] = recents;
	writeJsonAtomic(targetPath, target);
	const skipped = recents.length === 0;
	return {
		skipped,
		reason: skipped ? "legacy_recents_empty" : void 0,
		sourcePath,
		targetPath,
		migratedCount: recents.length
	};
}
//#endregion
//#region ../../packages/workbuddy-server/src/migration/legacy-todos-migration.ts
/**
* Status mapping from legacy todo status to new task status.
* Consistent with M03 plan-task status mapping.
*/
var STATUS_MAP = {
	"pending": "pending",
	"waiting": "pending",
	"in-progress": "in_progress",
	"completed": "completed",
	"error": "pending"
};
/**
* Service for migrating legacy todos from VSCode globalStorage
* to the new tasks format under ~/.workbuddy/tasks/.
*
* Follows the same pattern as PlanMigrationService.
*/
var LegacyTodosMigrationService = class {
	/**
	* Execute the migration.
	*
	* @param sourcePath - Legacy todos directory path
	* @param targetPath - New tasks directory path
	* @param skipSessionIds - Session IDs to skip (already migrated by M03 plan-task)
	*/
	migrateFromLegacyDirectory(sourcePath = getLegacyTodosDirectoryPath(), targetPath = getTargetTasksDirectoryPath(), skipSessionIds = /* @__PURE__ */ new Set()) {
		const result = {
			sourcePath,
			targetPath,
			skipped: false,
			totalFilesRead: 0,
			totalTodosFound: 0,
			sessionsMigrated: 0,
			sessionsSkipped: 0,
			tasksMigrated: 0
		};
		result.skipped = true;
		return result;
	}
	/**
	* Read all legacy todo JSON files from the source directory.
	*/
	readLegacyTodoFiles(dirPath) {
		const results = [];
		try {
			const entries = fs.readdirSync(dirPath, { withFileTypes: true });
			for (const entry of entries) {
				if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
				const sessionId = entry.name.replace(".json", "");
				if (!sessionId) continue;
				const filePath = path.join(dirPath, entry.name);
				try {
					const content = fs.readFileSync(filePath, "utf-8");
					const parsed = JSON.parse(content);
					const todos = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.todos) ? parsed.todos : [];
					const updatedAt = !Array.isArray(parsed) ? parsed?.updatedAt : void 0;
					if (todos.length > 0) results.push({
						conversationId: sessionId,
						todos,
						updatedAt
					});
				} catch {}
			}
		} catch {}
		return results;
	}
	/**
	* Convert legacy todo items to new TaskItem format.
	* Status mapping is consistent with M03 convertPlanTasksToNewTasks().
	*/
	convertToNewTasks(legacyTodos, updatedAt) {
		const tasks = [];
		let idCounter = 1;
		const timestamp = updatedAt ?? Date.now();
		for (const todo of legacyTodos) {
			if (!todo || !todo.content) continue;
			tasks.push({
				id: String(idCounter),
				subject: todo.content,
				description: todo.content,
				activeForm: todo.content,
				status: STATUS_MAP[todo.status] || "pending",
				createdAt: timestamp,
				updatedAt: timestamp
			});
			idCounter++;
		}
		return tasks;
	}
};
function getLegacyTodosDirectoryPath() {
	return path.join(getLegacyAppDataDir$3(), "WorkBuddy", "User", "globalStorage", "tencent-cloud.coding-copilot", "todos");
}
function getTargetTasksDirectoryPath() {
	return path.join(getWorkbuddyConfigDir$4(), "tasks");
}
function getLegacyAppDataDir$3() {
	if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support");
	if (process.platform === "win32") return process.env.APPDATA?.trim() || path.join(os.homedir(), "AppData", "Roaming");
	return process.env.XDG_CONFIG_HOME?.trim() || path.join(os.homedir(), ".config");
}
function getWorkbuddyConfigDir$4() {
	return process.env.WORKBUDDY_CONFIG_DIR?.trim() || process.env.CODEBUDDY_CONFIG_DIR?.trim() || path.join(os.homedir(), ".workbuddy");
}
//#endregion
//#region ../../packages/workbuddy-server/src/migration/mcp-oauth-migration.ts
/**
* McpOAuthMigrationService
*
* 把旧版 VS Code 套壳 WorkBuddy 留下的 MCP OAuth 凭据迁移到新版 Desktop。
*
* Source files (per UID directory):
*   - WorkBuddyExtension/Data/{uid}/VSCode_mcp_oauth.json    (HTTP callback)
*   - WorkBuddyExtension/Data/{uid}/VSCode_mcp_ide_oauth.json (IDE URL scheme)
*
* 写入：通过 `ConnectorOAuthStore.saveTokens` / `saveClientInfo` 写到
*   ~/.workbuddy/connectors/<userId>/.credentials.v3.json (AES-256-GCM)
*
* ## 与 ConnectorOAuthStore 的协作（#48593）
*
* 本服务**不**自维护 desktop key 算法、不直接 fs.writeFileSync。
* 改造前的实现里有一个 `generateDesktopKey()`，与 `ConnectorOAuthStore.generateServerKey()`
* 不一致（前缀 `custom-mcp:my-server` vs `my-server`，hash payload `{configId,url}`
* vs `{type,url,Headers}`），导致迁移完成的 token 加密保存在 v3 但 connector
* runtime 永远读不到，等于迁移失败。
*
* 现在迁移服务只做：
*   1. 读旧 OAuth 文件 + mcp.json
*   2. 用 legacy key 算法配对
*   3. 调 `store.saveTokens` / `saveClientInfo` —— store 自己用真实 key 算法 +
*      v3 加密 + master.key + ACL，迁移服务不参与加密 / 路径 / key 任何细节
*   4. paired-atomic-write 语义：用 `store.loadTokens` 检查已有 token，跳过整对
*
* ## 强制登录态
*
* userId 由 `userIdProvider` 注入。返回 undefined / 'default' 时迁移跳过：
* 标记 `pending_login`，等下次启动用户登录后再尝试。绝不写明文到 `default/`。
*
* ## Key 算法差异（仅 legacy 侧需要自维护，desktop 侧由 store 全权负责）
*
*   Legacy:  SHA256(serverName + ":" + JSON.stringify({url}))    → full 64-char hex
*   Desktop: 由 ConnectorOAuthStore.generateServerKey 决定，本模块不复述
*/
var CUSTOM_MCP_PREFIX = "custom-mcp:";
var McpOAuthMigrationService = class {
	/**
	* @param userIdProvider 当前登录 userId 提供器。未传时等价于"未登录"，
	*   migrate() 会标记 pending_login 跳过。生产环境由 main-bootstrap 注入：
	*   `() => celljs.authService.getAccount()?.uid`。
	* @param options.homeDir **仅供测试用**：让内部 `new ConnectorOAuthStore`
	*   走临时目录，避免污染真实 ~/.workbuddy/。生产不传，store 默认 `os.homedir()`。
	*/
	constructor(userIdProvider, options) {
		this.userIdProvider = userIdProvider ?? (() => void 0);
		this.homeDirOverride = options?.homeDir;
	}
	/**
	* Migrate MCP OAuth credentials from legacy source files to Desktop's
	* encrypted store via `ConnectorOAuthStore.saveTokens` / `saveClientInfo`.
	*
	* 流程：
	*   1. 读 mcp.json + 旧 VS Code 套壳 OAuth 文件，按 legacy key 算法匹配
	*   2. 对每个匹配的 server，调 `store.saveTokens` / `saveClientInfo`
	*      → store 内部用真实 key 算法 + v3 加密 + master.key + ACL，落盘到
	*        `~/.workbuddy/connectors/<userId>/.credentials.v3.json`
	*   3. paired-atomic-write 语义：用 `store.loadTokens(...)` 检查是否已有 token，
	*      已有则跳过整对（Desktop 自己已完成 OAuth → 不覆盖）
	*
	* **不再**自己拼 desktop key 写 v1 明文文件。
	* 改造前的实现自维护一个 `generateDesktopKey()`，与 `ConnectorOAuthStore`
	* 内部的 `generateServerKey()` 算法不一致（前缀不同 + payload 不同），
	* 导致迁移完成的 token 加密保存在 v3 但 connector 永远读不到。
	*
	* **强制登录态**：调用方必须保证 userIdProvider 返回真实账号 ID。
	* 未登录态时返回 `pending_login` 跳过，调用方应在用户登录后重试。
	*/
	migrate(legacyDataRoot = getLegacyExtensionDataRoot$1(), mcpConfigPath = getMcpConfigPath()) {
		const userId = this.userIdProvider() ?? "default";
		const result = {
			targetPath: userId !== "default" ? getTargetCredentialsPath(userId) : "",
			userId,
			skipped: false,
			serversMatched: 0,
			serverNames: [],
			tokensMigrated: 0,
			clientInfoMigrated: 0
		};
		if (!userId || userId === "default") {
			result.skipped = true;
			result.reason = "pending_login";
			return result;
		}
		const mcpServers = this.readMcpConfig(mcpConfigPath);
		if (Object.keys(mcpServers).length === 0) {
			result.skipped = true;
			result.reason = "no_mcp_servers_configured";
			return result;
		}
		const legacyData = this.readLegacySources(legacyDataRoot);
		if (Object.keys(legacyData.tokens).length === 0 && Object.keys(legacyData.clientInfo).length === 0) {
			result.skipped = true;
			result.reason = "no_oauth_data_in_legacy_sources";
			return result;
		}
		const store = new require_tar.ConnectorOAuthStore(userId, this.homeDirOverride ? { homeDir: this.homeDirOverride } : { backupBaseDir: require_runtime_context.getWorkbuddyRuntimeUserDataDir() });
		for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
			const serverUrl = serverConfig.url;
			if (!serverUrl) continue;
			const legacyKey = generateLegacyKey(serverName, serverUrl);
			const legacyToken = legacyData.tokens[legacyKey];
			const legacyClient = legacyData.clientInfo[legacyKey];
			if (!legacyToken && !legacyClient) continue;
			const configId = CUSTOM_MCP_PREFIX + serverName;
			result.serversMatched++;
			result.serverNames.push(serverName);
			if (store.loadTokens(configId, serverUrl)?.access_token) continue;
			if (legacyToken) {
				const expiresIn = computeRemainingExpiresIn(legacyToken, legacyClient);
				if (store.saveTokens(configId, serverUrl, {
					access_token: legacyToken.access_token,
					token_type: legacyToken.token_type ?? "bearer",
					refresh_token: legacyToken.refresh_token,
					expires_in: expiresIn,
					scope: legacyToken.scope
				})) result.tokensMigrated++;
			}
			if (legacyClient) {
				if (store.saveClientInfo(configId, serverUrl, {
					client_id: legacyClient.client_id,
					client_secret: legacyClient.client_secret,
					redirect_uris: legacyClient.redirect_uris
				})) result.clientInfoMigrated++;
			}
		}
		if (result.serversMatched === 0) {
			result.skipped = true;
			result.reason = "no_matching_credentials_for_configured_servers";
			return result;
		}
		return result;
	}
	/**
	* Read MCP server configurations from ~/.workbuddy/mcp.json
	*/
	readMcpConfig(mcpConfigPath) {
		if (!fs.existsSync(mcpConfigPath)) return {};
		try {
			const raw = fs.readFileSync(mcpConfigPath, "utf-8");
			return JSON.parse(raw).mcpServers ?? {};
		} catch {
			return {};
		}
	}
	/**
	* Read and merge all legacy OAuth source files.
	*
	* Scans WorkBuddyExtension/Data/{uid}/ directories for
	* VSCode_mcp_oauth.json (HTTP, low priority) and
	* VSCode_mcp_ide_oauth.json (IDE, high priority).
	*/
	readLegacySources(legacyDataRoot) {
		const merged = {
			tokens: {},
			clientInfo: {}
		};
		if (!fs.existsSync(legacyDataRoot)) return merged;
		const sourceFiles = [];
		try {
			const entries = fs.readdirSync(legacyDataRoot, { withFileTypes: true });
			for (const entry of entries) {
				if (!entry.isDirectory()) continue;
				const uidDir = path.join(legacyDataRoot, entry.name);
				const httpFile = path.join(uidDir, "VSCode_mcp_oauth.json");
				if (fs.existsSync(httpFile)) sourceFiles.push({
					file: httpFile,
					mode: "http"
				});
				const ideFile = path.join(uidDir, "VSCode_mcp_ide_oauth.json");
				if (fs.existsSync(ideFile)) sourceFiles.push({
					file: ideFile,
					mode: "ide"
				});
			}
		} catch {
			return merged;
		}
		sourceFiles.sort((a, b) => {
			if (a.mode !== b.mode) return a.mode === "http" ? -1 : 1;
			return 0;
		});
		for (const { file } of sourceFiles) try {
			const raw = fs.readFileSync(file, "utf-8");
			const data = JSON.parse(raw);
			if (data.tokens && typeof data.tokens === "object") for (const [key, token] of Object.entries(data.tokens)) merged.tokens[key] = token;
			if (data.clientInfo && typeof data.clientInfo === "object") for (const [key, info] of Object.entries(data.clientInfo)) merged.clientInfo[key] = info;
		} catch {
			continue;
		}
		return merged;
	}
};
/**
* 从 legacy 凭证推算迁移后应写入的 `expires_in`（剩余有效秒数）。
*
* 背景：`store.saveTokens` 内部用 `Date.now() + expires_in*1000` 计算 expiresAt。
* 若直接透传 legacy 的原始 expires_in，会把一个签发于很久以前、可能早已过期的
* token 重新计时成「此刻刚签发」，使应用误判 token 仍然有效从而跳过 refresh。
*
* 计算规则：
* - 有 `connect_time`（签发时间，ms）+ 原始 `expires_in`（s）
*   → 原始绝对过期时刻 = connect_time + expires_in*1000
*   → 剩余秒数 = max(0, (绝对过期时刻 - now) / 1000)
*   已过期 → 返回 0，让 store 写入 expiresAt=now，上层据此主动 refresh。
* - 缺 `connect_time` 但有 `expires_in`：无法确定签发锚点，保守视为已过期 → 0。
* - 完全没有有效期信息：返回 undefined，交给 store 的 XAA fallback
*   （保留 prev.expiresAt 或视为立即过期）。
*/
function computeRemainingExpiresIn(token, client, now = Date.now()) {
	const originalExpiresIn = token.expires_in;
	if (originalExpiresIn === void 0) return;
	const connectTime = client?.connect_time;
	if (connectTime === void 0) return 0;
	const remainingMs = connectTime + originalExpiresIn * 1e3 - now;
	if (remainingMs <= 0) return 0;
	return Math.floor(remainingMs / 1e3);
}
/**
* Generate legacy-format OAuth key (used by McpOAuthStoreImpl in old VS Code plugin).
* Algorithm: SHA256(serverName + ":" + JSON.stringify({url}))
*/
function generateLegacyKey(serverName, url) {
	const normalizedConfig = { url };
	const configStr = JSON.stringify(normalizedConfig, Object.keys(normalizedConfig).sort());
	return crypto.createHash("sha256").update(`${serverName}:${configStr}`).digest("hex");
}
function getLegacyExtensionDataRoot$1() {
	return path.join(getLegacyExtensionBaseDir$1(), "WorkBuddyExtension", "Data");
}
function getMcpConfigPath() {
	return path.join(getWorkbuddyConfigDir$3(), "mcp.json");
}
/**
* 目标 v1 凭据文件路径：`~/.workbuddy/connectors/<userId>/.credentials.json`。
*
* 这是 ConnectorOAuthStore 的 v1 兜底路径 —— 写到这里之后，store.read()
* 会自动 v1 → v3 升级 + 删 v1 明文（详见 connector-oauth-store.ts:read()）。
*
* 改造前是根级 `~/.workbuddy/.credentials.json`（路径错位 + 明文垃圾），
* 已经修正为 connectors/<userId>/，与 store 的读取路径完全一致。
*/
function getTargetCredentialsPath(userId) {
	return path.join(getWorkbuddyConfigDir$3(), "connectors", userId, ".credentials.json");
}
/**
* 获取旧版扩展数据的根目录。
* 注意：在 macOS 上，WorkBuddyExtension 数据实际存储在 ~/Library/Application Support/，
* 而非 agent-history 中 getCacheBasePath() 所返回的 ~/Library/Caches/。
* 在 Windows 上，agent-history 使用 LOCALAPPDATA (AppData\Local)。
*/
function getLegacyExtensionBaseDir$1() {
	if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support");
	if (process.platform === "win32") return process.env.LOCALAPPDATA?.trim() || path.join(os.homedir(), "AppData", "Local");
	return path.join(os.homedir(), ".local", "share");
}
function getWorkbuddyConfigDir$3() {
	return process.env.WORKBUDDY_CONFIG_DIR?.trim() || process.env.CODEBUDDY_CONFIG_DIR?.trim() || path.join(os.homedir(), ".workbuddy");
}
/**
* Get the maximum mtime (ms) across all legacy OAuth source files.
*
* Scans WorkBuddyExtension/Data/{uid}/ for VSCode_mcp_oauth.json and
* VSCode_mcp_ide_oauth.json files. Returns 0 if no source files exist.
*
* Used by MigrationService for incremental detection: if the max source mtime
* is <= the last completedAt timestamp, the migration can be skipped.
*/
function getSourceMaxMtime(legacyDataRoot = getLegacyExtensionDataRoot$1()) {
	if (!fs.existsSync(legacyDataRoot)) return 0;
	let maxMtime = 0;
	try {
		const entries = fs.readdirSync(legacyDataRoot, { withFileTypes: true });
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const uidDir = path.join(legacyDataRoot, entry.name);
			for (const filename of ["VSCode_mcp_oauth.json", "VSCode_mcp_ide_oauth.json"]) {
				const filePath = path.join(uidDir, filename);
				if (fs.existsSync(filePath)) {
					const mtime = fs.statSync(filePath).mtimeMs;
					if (mtime > maxMtime) maxMtime = mtime;
				}
			}
		}
	} catch {}
	return maxMtime;
}
//#endregion
//#region ../../packages/workbuddy-server/src/migration/media-index-migration.ts
/**
* MediaIndexMigrationService
*
* Migrates media-index records from the old architecture (plugin-chat/VSCode)
* into per-session JSON index files under `~/.workbuddy/media-index/`.
*
* Old architecture persisted media file records (detected by FileSystemWatcher)
* to `globalStorage/tencent-cloud.coding-copilot/media-index/{workspaceHash}.json`.
* Each record contains a sessionId binding.
*
* This service converts those records into `{sessionId}.json` files that
* `MediaArtifactService.pushLegacyMediaArtifacts()` reads at loadSession time,
* pushing media artifact notifications to the UI without modifying JSONL history.
*
* Also cleans up synthetic JSONL entries from the previous migration approach
* (entries with id starting with "migrated-media-").
*/
var MediaIndexMigrationService = class {
	/**
	* Migrate media-index records from old architecture into per-session JSON files.
	*
	* For each media record with a sessionId, writes a `{sessionId}.json` file
	* to the media-index output directory. Also cleans up any synthetic JSONL
	* entries from the previous migration approach.
	*/
	migrate(sourceDir = getLegacyMediaIndexDir(), outputDir = getMediaIndexOutputDir(), projectsDir = getProjectsDir()) {
		const result = {
			sourceDir,
			indexFilesScanned: 0,
			totalRecords: 0,
			recordsWritten: 0,
			recordsSkippedExisting: 0,
			recordsSkippedNoFile: 0,
			syntheticEntriesCleaned: 0,
			skipped: false
		};
		if (!fs.existsSync(sourceDir)) {
			result.skipped = true;
			return result;
		}
		const recordsBySession = this.loadAndGroupRecords(sourceDir, result);
		if (recordsBySession.size === 0) {
			result.skipped = result.totalRecords === 0;
			return result;
		}
		fs.mkdirSync(outputDir, { recursive: true });
		for (const [sessionId, records] of recordsBySession) this.writeSessionIndex(outputDir, sessionId, records, result);
		result.syntheticEntriesCleaned = this.cleanSyntheticEntries(projectsDir);
		return result;
	}
	/**
	* Load all media-index JSON files and group records by sessionId.
	*/
	loadAndGroupRecords(sourceDir, result) {
		const recordsBySession = /* @__PURE__ */ new Map();
		let files;
		try {
			files = fs.readdirSync(sourceDir).filter((f) => f.endsWith(".json"));
		} catch {
			return recordsBySession;
		}
		for (const file of files) {
			result.indexFilesScanned++;
			const sourceHash = file.replace(/\.json$/, "");
			try {
				const content = fs.readFileSync(path.join(sourceDir, file), "utf-8");
				const indexFile = JSON.parse(content);
				for (const record of Object.values(indexFile.records)) {
					result.totalRecords++;
					if (!record.sessionId || !record.filePath) continue;
					let list = recordsBySession.get(record.sessionId);
					if (!list) {
						list = [];
						recordsBySession.set(record.sessionId, list);
					}
					list.push({
						sourceHash,
						record
					});
				}
			} catch {}
		}
		return recordsBySession;
	}
	/**
	* Write a per-session media index JSON file.
	* If the file already exists, skip (idempotent).
	*/
	writeSessionIndex(outputDir, sessionId, entries, result) {
		const indexPath = path.join(outputDir, `${sessionId}.json`);
		if (fs.existsSync(indexPath)) {
			result.recordsSkippedExisting += entries.length;
			return;
		}
		const validRecords = [];
		for (const { record } of entries) {
			if (!fs.existsSync(record.filePath)) {
				result.recordsSkippedNoFile++;
				continue;
			}
			validRecords.push({
				filePath: record.filePath,
				fileName: record.fileName,
				mimeType: record.mimeType,
				contentType: record.contentType,
				size: record.size,
				timestamp: record.timestamp
			});
		}
		if (validRecords.length === 0) return;
		const sourceHash = entries[0].sourceHash;
		const index = {
			version: 1,
			migratedAt: Date.now(),
			sourceHash,
			records: validRecords
		};
		fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf-8");
		result.recordsWritten += validRecords.length;
	}
	/**
	* Clean up synthetic JSONL entries from the previous migration approach.
	* Removes lines whose JSON id starts with "migrated-media-".
	* Returns the total number of entries cleaned across all JSONL files.
	*/
	cleanSyntheticEntries(projectsDir) {
		let totalCleaned = 0;
		if (!fs.existsSync(projectsDir)) return totalCleaned;
		let projectDirs;
		try {
			projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true });
		} catch {
			return totalCleaned;
		}
		for (const dir of projectDirs) {
			if (!dir.isDirectory()) continue;
			const projectPath = path.join(projectsDir, dir.name);
			let files;
			try {
				files = fs.readdirSync(projectPath).filter((f) => f.endsWith(".jsonl"));
			} catch {
				continue;
			}
			for (const file of files) {
				const jsonlPath = path.join(projectPath, file);
				totalCleaned += this.cleanSyntheticEntriesFromFile(jsonlPath);
			}
		}
		return totalCleaned;
	}
	/**
	* Remove synthetic entries (id starts with "migrated-media-") from a single JSONL file.
	*/
	cleanSyntheticEntriesFromFile(jsonlPath) {
		let content;
		try {
			content = fs.readFileSync(jsonlPath, "utf-8");
		} catch {
			return 0;
		}
		if (!content.includes("migrated-media-")) return 0;
		const lines = content.split("\n");
		let cleaned = 0;
		const filtered = lines.filter((line) => {
			if (!line.trim()) return true;
			try {
				const item = JSON.parse(line);
				if (typeof item.id === "string" && item.id.startsWith("migrated-media-")) {
					cleaned++;
					return false;
				}
			} catch {}
			return true;
		});
		if (cleaned > 0) fs.writeFileSync(jsonlPath, filtered.join("\n"), "utf-8");
		return cleaned;
	}
};
function getLegacyMediaIndexDir() {
	return path.join(getLegacyAppDataDir$2(), "WorkBuddy", "User", "globalStorage", "tencent-cloud.coding-copilot", "media-index");
}
/** Output directory for per-session media index files. */
function getMediaIndexOutputDir() {
	const configDir = process.env.WORKBUDDY_CONFIG_DIR?.trim() || process.env.CODEBUDDY_CONFIG_DIR?.trim() || path.join(os.homedir(), ".workbuddy");
	return path.join(configDir, "media-index");
}
function getProjectsDir() {
	const configDir = process.env.WORKBUDDY_CONFIG_DIR?.trim() || process.env.CODEBUDDY_CONFIG_DIR?.trim() || path.join(os.homedir(), ".workbuddy");
	return path.join(configDir, "projects");
}
function getLegacyAppDataDir$2() {
	if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support");
	if (process.platform === "win32") return process.env.APPDATA?.trim() || path.join(os.homedir(), "AppData", "Roaming");
	return process.env.XDG_CONFIG_HOME?.trim() || path.join(os.homedir(), ".config");
}
//#endregion
//#region ../../packages/workbuddy-server/src/migration/migration-file-logger.ts
function getWorkbuddyConfigDir$2() {
	return process.env.WORKBUDDY_CONFIG_DIR?.trim() || process.env.CODEBUDDY_CONFIG_DIR?.trim() || path.join(os.homedir(), ".workbuddy");
}
function getMigrationLogDir() {
	return path.join(getWorkbuddyConfigDir$2(), "logs", "migration");
}
/**
* Migration file logger singleton.
*
* - Writes logs only to ~/.workbuddy/logs/migration/
* - Never prints migration log lines to console
*/
var MigrationFileLogger = class MigrationFileLogger extends require_server.BufferedFileLogger {
	static {
		this.instance = null;
	}
	constructor() {
		super({
			logDir: getMigrationLogDir(),
			filePrefix: "migration"
		});
	}
	static getInstance() {
		if (!MigrationFileLogger.instance) MigrationFileLogger.instance = new MigrationFileLogger();
		return MigrationFileLogger.instance;
	}
};
//#endregion
//#region ../../packages/workbuddy-server/src/migration/plan-migration.ts
var PlanMigrationService = class {
	migrateFromLegacyDirectory(sourcePath = getLegacyPlanDirectoryPath(), targetPath = getTargetPlanDirectoryPath(), brainPath = getLegacyBrainDirectoryPath()) {
		fs.mkdirSync(targetPath, { recursive: true });
		let plansMigrated = 0;
		if (fs.existsSync(sourcePath)) {
			const conversationDirs = fs.readdirSync(sourcePath, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
			for (const conversationId of conversationDirs) {
				const content = this.readLegacyPlanContent(path.join(sourcePath, conversationId));
				if (!content) continue;
				this.writePlan(targetPath, conversationId, content);
				plansMigrated++;
			}
		}
		if (fs.existsSync(brainPath)) {
			const brainDirs = fs.readdirSync(brainPath, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
			for (const conversationId of brainDirs) {
				const plansDir = path.join(brainPath, conversationId, "plans");
				if (!fs.existsSync(plansDir)) continue;
				const targetPlanPath = path.join(targetPath, conversationId, "plan.md");
				if (fs.existsSync(targetPlanPath)) continue;
				const content = this.readLegacyPlanContent(plansDir);
				if (!content) continue;
				this.writePlan(targetPath, conversationId, content);
				plansMigrated++;
			}
		}
		return {
			sourcePath,
			targetPath,
			skipped: plansMigrated === 0 && !fs.existsSync(sourcePath) && !fs.existsSync(brainPath),
			plansMigrated
		};
	}
	writePlan(targetPath, conversationId, content) {
		const conversationTargetDir = path.join(targetPath, conversationId);
		const targetPlanPath = path.join(conversationTargetDir, "plan.md");
		fs.mkdirSync(conversationTargetDir, { recursive: true });
		fs.writeFileSync(targetPlanPath, content, "utf-8");
	}
	readLegacyPlanContent(conversationPath) {
		const planMdPath = path.join(conversationPath, "plan.md");
		if (fs.existsSync(planMdPath)) {
			const content = fs.readFileSync(planMdPath, "utf-8");
			return content.trim().length > 0 ? content : void 0;
		}
		const planJsonPath = path.join(conversationPath, "plan.json");
		if (!fs.existsSync(planJsonPath)) return;
		try {
			const planJson = JSON.parse(fs.readFileSync(planJsonPath, "utf-8"));
			if (typeof planJson.content !== "string") return;
			const content = planJson.content;
			return content.trim().length > 0 ? content : void 0;
		} catch {
			return;
		}
	}
};
function getLegacyPlanDirectoryPath() {
	return path.join(getLegacyAppDataDir$1(), "WorkBuddy", "User", "globalStorage", "tencent-cloud.coding-copilot", "plans");
}
function getLegacyBrainDirectoryPath() {
	return path.join(getLegacyAppDataDir$1(), "WorkBuddy", "User", "globalStorage", "tencent-cloud.coding-copilot", "brain");
}
function getTargetPlanDirectoryPath() {
	return path.join(getWorkbuddyConfigDir$1(), "plans");
}
function getLegacyAppDataDir$1() {
	if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support");
	if (process.platform === "win32") return process.env.APPDATA?.trim() || path.join(os.homedir(), "AppData", "Roaming");
	return process.env.XDG_CONFIG_HOME?.trim() || path.join(os.homedir(), ".config");
}
function getWorkbuddyConfigDir$1() {
	return process.env.WORKBUDDY_CONFIG_DIR?.trim() || process.env.CODEBUDDY_CONFIG_DIR?.trim() || path.join(os.homedir(), ".workbuddy");
}
//#endregion
//#region ../../packages/workbuddy-server/src/migration/vscdb-reader.ts
var VscdbReader = class {
	async initialize(vscdbPath) {
		if (!vscdbPath) throw new Error("vscdbPath is required");
		if (!fs.existsSync(vscdbPath)) throw new Error(`vscdb file does not exist: ${vscdbPath}`);
		this.dispose();
		this.db = require_readonly.openReadonlySqliteDatabase(vscdbPath);
	}
	async readSessions(filter) {
		this.ensureInitialized();
		const rows = this.db.prepare("SELECT value FROM ItemTable WHERE key LIKE 'session:%'").all();
		const sessions = [];
		for (const row of rows) {
			const parsed = this.parseSession(row.value);
			if (!parsed || parsed.deletedAt) continue;
			if (filter?.userId && parsed.userId !== filter.userId) continue;
			sessions.push(parsed);
		}
		return sessions.sort((left, right) => left.updatedAt - right.updatedAt);
	}
	async getWorkspacePaths(filter) {
		const sessions = await this.readSessions(filter);
		return Array.from(new Set(sessions.map((session) => session.cwd).filter(Boolean))).sort();
	}
	dispose() {
		if (!this.db) return;
		try {
			this.db.close();
		} finally {
			this.db = void 0;
		}
	}
	/**
	* Read recently opened workspace paths from the VSCode-style
	* `history.recentlyOpenedPathsList` key in state.vscdb.
	*
	* The stored value is a JSON object with entries:
	* ```json
	* { "entries": [{ "folderUri": "file:///Users/foo/bar" }, ...] }
	* ```
	*
	* Returns deduplicated, sorted absolute file-system paths.
	*/
	async readRecentlyOpenedPaths() {
		this.ensureInitialized();
		try {
			const rows = this.db.prepare("SELECT value FROM ItemTable WHERE key = 'history.recentlyOpenedPathsList'").all();
			if (rows.length === 0) return [];
			const parsed = JSON.parse(rows[0].value);
			if (!parsed || typeof parsed !== "object") return [];
			const entries = parsed.entries;
			if (!Array.isArray(entries)) return [];
			const validPaths = [];
			for (const entry of entries) {
				if (!entry || typeof entry !== "object") continue;
				const uriString = entry.folderUri ?? entry.fileUri;
				if (typeof uriString !== "string" || !uriString) continue;
				try {
					const url$1 = new URL(uriString);
					if (url$1.protocol === "file:") {
						const fsPath = (0, url.fileURLToPath)(url$1);
						if (path.isAbsolute(fsPath)) validPaths.push(fsPath);
					}
				} catch {}
			}
			return Array.from(new Set(validPaths)).sort();
		} catch {
			return [];
		}
	}
	ensureInitialized() {
		if (!this.db) throw new Error("VscdbReader is not initialized");
	}
	parseSession(rawValue) {
		try {
			const parsed = JSON.parse(rawValue);
			if (!parsed.conversationId || !parsed.cwd || !parsed.userId) return;
			return {
				conversationId: parsed.conversationId,
				cwd: parsed.cwd,
				userId: parsed.userId,
				title: parsed.title,
				customTitle: parsed.customTitle,
				status: parsed.status ?? "Pending",
				createdAt: parsed.createdAt ?? 0,
				updatedAt: parsed.updatedAt ?? parsed.createdAt ?? 0,
				deletedAt: parsed.deletedAt,
				isPlayground: parsed.isPlayground
			};
		} catch {
			return;
		}
	}
};
//#endregion
//#region ../../packages/workbuddy-server/src/migration/migration-service.ts
var HISTORY_MIGRATION_META_KEY = "legacy_history_migration";
var HISTORY_MIGRATION_FORMAT_VERSION = 2;
var AUTOMATION_MIGRATION_META_KEY = "legacy_automation_migration";
var PLAN_MIGRATION_META_KEY = "legacy_plan_migration";
var LEGACY_TODOS_MIGRATION_META_KEY = "legacy_todos_migration";
var BRAIN_MIGRATION_META_KEY = "legacy_brain_migration";
var CLAW_SETTINGS_MIGRATION_META_KEY = "legacy_claw_settings_migration";
var MCP_OAUTH_MIGRATION_META_KEY = "legacy_mcp_oauth_migration";
var MEDIA_INDEX_MIGRATION_META_KEY = "legacy_media_index_migration";
var LOCALSTORAGE_MIGRATION_META_KEY = "legacy_localstorage_migration";
var EXPERT_RECENTS_MIGRATION_META_KEY = "legacy_expert_recents_migration";
var SESSION_MODEL_PATCH_META_KEY = "legacy_session_model_patch";
/**
* M21 —— pending 归档 ID 队列 meta key。
* 存放从 legacy localStorage 读到的 `genie-archived-session-ids` 原始 JSON 数组，
* `replayArchivedSessionIdsPatch` 成功完成后清除，保证幂等。
*/
var ARCHIVED_PENDING_KEY = "legacy_archived_session_ids_pending";
/** 历史迁移最低磁盘空间要求（512MB），低于此值跳过迁移 */
var HISTORY_MIGRATION_MIN_DISK_BYTES = 512 * 1024 * 1024;
/** 连续因磁盘不足跳过的最大次数，超过后永久放弃（force 可重置） */
var HISTORY_MIGRATION_MAX_DISK_SKIP_COUNT = 3;
/** 大批量迁移日志仅打印前 N 条明细，避免日志 IO 成为启动瓶颈 */
var HISTORY_MIGRATION_LOG_SAMPLE_LIMIT = 20;
function getWorkbuddyConfigDir() {
	return process.env.WORKBUDDY_CONFIG_DIR?.trim() || process.env.CODEBUDDY_CONFIG_DIR?.trim() || path.join(os.homedir(), ".workbuddy");
}
var MigrationService = class {
	constructor(database, logger, migrationCollector, archivedSyncService, options = {}) {
		this.database = database;
		this.logger = logger;
		this.options = options;
		this.historyLaunchingSentinel = false;
		this.fileLogger = MigrationFileLogger.getInstance();
		this.migrationCollector = migrationCollector;
		this.archivedSyncService = archivedSyncService ?? new ArchivedSyncService(this.database, this.fileLogger, this.options.localStorageServiceFactory, { logger: this.logger });
	}
	/**
	* 返回内部持有的归档同步服务，供 `main-bootstrap.ts` 订阅 `onComplete` 事件。
	*/
	getArchivedSyncService() {
		return this.archivedSyncService;
	}
	/**
	* 注册 "history 迁移转后台" 的回调钩子。
	* main-bootstrap 在 daemon 就绪后调用此方法挂接桥：
	*   - 收到 Promise 立刻推送 `{ phase: 'running' }`
	*   - Promise 完成后推送 `{ phase: 'done' | 'partial' | 'failed' }`
	* Renderer 收到 done 事件后，刷新会话列表 / automation / inspiration。
	*/
	setHistoryDeferredHandler(handler) {
		this.onHistoryDeferred = handler;
	}
	setHistoryProgressHandler(handler) {
		this.historyProgressHandler = handler;
	}
	/**
	* 查询 history 迁移的当前状态。供 renderer 启动时主动查一次（处理"已经跑完"场景）。
	*/
	getHistoryStatus() {
		if (this.runningHistoryPromise) return {
			phase: "running",
			timestamp: Date.now()
		};
		const meta = this.database.getMigrationMeta(HISTORY_MIGRATION_META_KEY);
		if (!meta) return {
			phase: "idle",
			timestamp: Date.now()
		};
		try {
			const parsed = JSON.parse(meta);
			const timestamp = parsed.completedAt ?? Date.now();
			if (parsed.repairAbandoned || parsed.reason === "insufficient_disk_space" && parsed.permanentlyAbandoned) return {
				phase: "abandoned",
				migratedSessionCount: parsed.sessionCount,
				migratedWorkspaceCount: parsed.migratedWorkspaceCount,
				unrecoverableSessionIds: parsed.unrecoverableSessionIds,
				timestamp
			};
			if (parsed.status === "success") return {
				phase: "done",
				migratedSessionCount: parsed.sessionCount,
				migratedWorkspaceCount: parsed.migratedWorkspaceCount,
				unrecoverableSessionIds: parsed.unrecoverableSessionIds,
				timestamp
			};
			if (parsed.status === "partial") return {
				phase: "partial",
				migratedSessionCount: parsed.sessionCount,
				migratedWorkspaceCount: parsed.migratedWorkspaceCount,
				unrecoverableSessionIds: parsed.unrecoverableSessionIds,
				timestamp
			};
			if (parsed.status === "failed") return {
				phase: "failed",
				error: parsed.error,
				timestamp
			};
			return {
				phase: "done",
				migratedSessionCount: parsed.sessionCount,
				migratedWorkspaceCount: parsed.migratedWorkspaceCount,
				timestamp
			};
		} catch {
			return {
				phase: "idle",
				timestamp: Date.now()
			};
		}
	}
	getPendingLocalStorageMigration() {
		return this.pendingLocalStorageMigration;
	}
	completeLocalStorageMigration(result) {
		if (!this.pendingLocalStorageMigration) return;
		const pending = this.pendingLocalStorageMigration;
		this.pendingLocalStorageMigration = void 0;
		this.fileLogger.info(`[LocalStorage] Renderer bootstrap completed - Applied: [${result.appliedKeys.join(", ")}], Skipped: ${JSON.stringify(result.skippedKeys)}`);
		this.database.setMigrationMeta(LOCALSTORAGE_MIGRATION_META_KEY, JSON.stringify({
			status: result.appliedKeys.length > 0 ? "success" : "skipped",
			appliedKeys: result.appliedKeys,
			skippedKeys: result.skippedKeys,
			sourceSessionPath: pending.sourceSessionPath,
			completedAt: Date.now()
		}));
	}
	/**
	* 执行迁移
	* @param options.type - 迁移类型：'history' | 'automation' | 'plan' | 'all'（默认）
	* @param options.force - 是否强制重新迁移，忽略幂等性检查
	*/
	async triggerMigration(options) {
		const initError = this.ensureDatabaseReady();
		if (initError) return {
			success: false,
			message: "Database initialization failed",
			error: initError
		};
		if (this.runningMigration) return {
			success: false,
			message: "Migration is already running"
		};
		const { type = "all", force = false, historyBlockingTimeoutMs = 0 } = options || {};
		const run = async () => {
			const migrationStartTime = Date.now();
			this.logger.info(`[MigrationService] Starting migration: type=${type}, force=${force}, historyBlockingTimeoutMs=${historyBlockingTimeoutMs}`);
			this.fileLogger.info("=== Migration Started ===");
			this.fileLogger.info(`Type: ${type}, Force: ${force}, HistoryBlockingTimeoutMs: ${historyBlockingTimeoutMs}`);
			const shouldReport = !this.hasAnyMigrationMeta() || force;
			try {
				const results = [];
				const nonHistorySubMigrations = [];
				if (type === "automation" || type === "all") nonHistorySubMigrations.push({
					name: "automation",
					metaKey: AUTOMATION_MIGRATION_META_KEY,
					fn: () => this.migrateLegacyAutomations(force)
				});
				if (type === "plan" || type === "all") nonHistorySubMigrations.push({
					name: "plan",
					metaKey: PLAN_MIGRATION_META_KEY,
					fn: () => this.migrateLegacyPlans(force)
				});
				if (type === "legacy-todos" || type === "all") nonHistorySubMigrations.push({
					name: "legacy-todos",
					metaKey: LEGACY_TODOS_MIGRATION_META_KEY,
					fn: () => this.migrateLegacyTodos(force)
				});
				if (type === "brain" || type === "all") nonHistorySubMigrations.push({
					name: "brain",
					metaKey: BRAIN_MIGRATION_META_KEY,
					fn: () => this.migrateLegacyBrainFiles(force)
				});
				if (type === "media-index" || type === "all") nonHistorySubMigrations.push({
					name: "media-index",
					metaKey: MEDIA_INDEX_MIGRATION_META_KEY,
					fn: () => this.migrateLegacyMediaIndex(force)
				});
				if (type === "pinned-conversations" || type === "all") nonHistorySubMigrations.push({
					name: "pinned-conversations",
					metaKey: LOCALSTORAGE_MIGRATION_META_KEY,
					fn: () => this.migrateLocalStorage(force)
				});
				if (type === "claw-settings" || type === "all") nonHistorySubMigrations.push({
					name: "claw-settings",
					metaKey: CLAW_SETTINGS_MIGRATION_META_KEY,
					fn: () => this.migrateClawSettings(force)
				});
				if (type === "mcp-oauth" || type === "all") nonHistorySubMigrations.push({
					name: "mcp-oauth",
					metaKey: MCP_OAUTH_MIGRATION_META_KEY,
					fn: () => this.migrateMcpOAuth(force)
				});
				if (type === "expert-recents" || type === "all") nonHistorySubMigrations.push({
					name: "expert-recents",
					metaKey: EXPERT_RECENTS_MIGRATION_META_KEY,
					fn: () => this.migrateExpertRecents(force)
				});
				for (const sub of nonHistorySubMigrations) {
					const startTime = Date.now();
					const result = await this.safeRunSubMigration(sub.name, sub.metaKey, sub.fn, { timeoutMs: 3e4 });
					results.push(result);
					this.reportSubMigration(sub.name, result, startTime, force, shouldReport);
				}
				let backgroundHistoryPromise;
				if (type === "history" || type === "all") {
					const historyStart = Date.now();
					this.historyLaunchingSentinel = true;
					const historyPromise = this.safeRunSubMigration("history", HISTORY_MIGRATION_META_KEY, () => this.migrateLegacySessionsAndHistory(force), { timeoutMs: 3e5 }).then((result) => {
						this.reportSubMigration("history", result, historyStart, force, shouldReport);
						return result;
					}).then(async (result) => {
						if (result.message?.includes("skipped") || result.message?.includes("already completed")) return result;
						try {
							await this.archivedSyncService.syncFromLegacyOnce();
						} catch (syncErr) {
							this.fileLogger.error("[ArchivedSync] Sync after history failed (non-fatal):", syncErr);
						}
						return result;
					}).finally(() => {
						this.runningHistoryPromise = void 0;
						this.historyLaunchingSentinel = false;
					});
					if (historyBlockingTimeoutMs > 0) {
						const TIMED_OUT = Symbol("history-timed-out");
						const raceResult = await Promise.race([historyPromise.then((r) => ({
							kind: "done",
							result: r
						})), new Promise((resolve) => setTimeout(() => resolve({ kind: TIMED_OUT }), historyBlockingTimeoutMs))]);
						if (raceResult.kind === "done") {
							results.push(raceResult.result);
							this.fileLogger.info(`[History] Completed within ${historyBlockingTimeoutMs}ms budget`);
						} else {
							this.logger.info(`[MigrationService] History migration exceeded ${historyBlockingTimeoutMs}ms budget, continuing in background`);
							this.fileLogger.info(`[History] Exceeded ${historyBlockingTimeoutMs}ms budget, continuing in background`);
							backgroundHistoryPromise = historyPromise;
							try {
								this.onHistoryDeferred?.(historyPromise);
							} catch (hookErr) {
								this.logger.warn("[MigrationService] onHistoryDeferred handler threw, ignoring:", hookErr);
							}
							historyPromise.catch((err) => {
								this.logger.error("[MigrationService] Background history migration unexpected error:", err);
							});
						}
					} else {
						const result = await historyPromise;
						results.push(result);
					}
				}
				if (!this.database.getMigrationMeta(SESSION_MODEL_PATCH_META_KEY)) try {
					this.fileLogger.info("[SessionModelPatch] Starting session model patch...");
					const modelPatchCount = this.patchSessionModel();
					this.database.setMigrationMeta(SESSION_MODEL_PATCH_META_KEY, JSON.stringify({
						status: "success",
						patchCount: modelPatchCount,
						completedAt: Date.now()
					}));
					this.fileLogger.info(`[SessionModelPatch] Completed, patched ${modelPatchCount} sessions`);
				} catch (modelPatchError) {
					this.fileLogger.warn(`[SessionModelPatch] Failed (non-fatal): ${modelPatchError}`);
				}
				else this.fileLogger.info("[SessionModelPatch] Already completed, skipping");
				const allSuccess = results.every((r) => r.success);
				const deferredSuffix = backgroundHistoryPromise ? " (history running in background)" : "";
				const message = allSuccess ? `Migration completed successfully (${results.length} steps)${deferredSuffix}` : `Migration completed with issues (${results.filter((r) => !r.success).length}/${results.length} failed)${deferredSuffix}`;
				this.fileLogger.info("=== Migration Completed ===");
				this.fileLogger.info(`Status: ${allSuccess ? "SUCCESS" : "FAILED"}${deferredSuffix}`);
				this.fileLogger.info(`Message: ${message}`);
				if (shouldReport) if (backgroundHistoryPromise) backgroundHistoryPromise.then((historyResult) => {
					try {
						const finalResults = [...results, historyResult];
						const finalAllSuccess = finalResults.every((r) => r.success);
						const finalFailedCount = finalResults.filter((r) => !r.success).length;
						this.migrationCollector?.recordMigration({
							type: "all",
							status: finalAllSuccess ? "success" : "failed",
							durationMs: Date.now() - migrationStartTime,
							isIncremental: !force,
							error: finalAllSuccess ? void 0 : `${finalFailedCount}/${finalResults.length} sub-migrations failed`
						});
					} catch {}
				}).catch(() => {
					try {
						this.migrationCollector?.recordMigration({
							type: "all",
							status: "failed",
							durationMs: Date.now() - migrationStartTime,
							isIncremental: !force,
							error: "background history migration failed"
						});
					} catch {}
				});
				else try {
					const failedCount = results.filter((r) => !r.success).length;
					this.migrationCollector?.recordMigration({
						type: "all",
						status: allSuccess ? "success" : "failed",
						durationMs: Date.now() - migrationStartTime,
						isIncremental: !force,
						error: allSuccess ? void 0 : `${failedCount}/${results.length} sub-migrations failed`
					});
				} catch {}
				return {
					success: allSuccess,
					message,
					details: { results },
					backgroundHistoryPromise
				};
			} catch (error) {
				this.logger.error("[MigrationService] Migration failed:", error);
				this.fileLogger.error("[MigrationService] Migration execution failed:", error);
				return {
					success: false,
					message: "Migration execution failed",
					error: error instanceof Error ? error.message : String(error)
				};
			}
		};
		this.runningMigration = run();
		try {
			return await this.runningMigration;
		} finally {
			this.runningMigration = void 0;
		}
	}
	/**
	* 获取迁移状态
	*/
	getMigrationStatus(type) {
		const initError = this.ensureDatabaseReady();
		if (initError) return {
			type: type ?? "all",
			status: "failed",
			message: `Database initialization failed: ${initError}`
		};
		if (this.runningMigration) return {
			type: type ?? "all",
			status: "running",
			message: "Migration is running"
		};
		const historyMeta = this.database.getMigrationMeta(HISTORY_MIGRATION_META_KEY);
		const automationMeta = this.database.getMigrationMeta(AUTOMATION_MIGRATION_META_KEY);
		const planMeta = this.database.getMigrationMeta(PLAN_MIGRATION_META_KEY);
		const legacyTodosMeta = this.database.getMigrationMeta(LEGACY_TODOS_MIGRATION_META_KEY);
		const brainMeta = this.database.getMigrationMeta(BRAIN_MIGRATION_META_KEY);
		const localStorageMeta = this.database.getMigrationMeta(LOCALSTORAGE_MIGRATION_META_KEY);
		const clawSettingsMeta = this.database.getMigrationMeta(CLAW_SETTINGS_MIGRATION_META_KEY);
		const mcpOAuthMeta = this.database.getMigrationMeta(MCP_OAUTH_MIGRATION_META_KEY);
		const expertRecentsMeta = this.database.getMigrationMeta(EXPERT_RECENTS_MIGRATION_META_KEY);
		if (type === "history") return this.parseMigrationMeta(historyMeta, "history");
		else if (type === "automation") return this.parseMigrationMeta(automationMeta, "automation");
		else if (type === "plan") return this.parseMigrationMeta(planMeta, "plan");
		else if (type === "legacy-todos") return this.parseMigrationMeta(legacyTodosMeta, "legacy-todos");
		else if (type === "brain") return this.parseMigrationMeta(brainMeta, "brain");
		else if (type === "pinned-conversations") return this.parseMigrationMeta(localStorageMeta, "pinned-conversations");
		else if (type === "claw-settings") return this.parseMigrationMeta(clawSettingsMeta, "claw-settings");
		else if (type === "mcp-oauth") return this.parseMigrationMeta(mcpOAuthMeta, "mcp-oauth");
		else if (type === "expert-recents") return this.parseMigrationMeta(expertRecentsMeta, "expert-recents");
		return [
			this.parseMigrationMeta(historyMeta, "history"),
			this.parseMigrationMeta(automationMeta, "automation"),
			this.parseMigrationMeta(planMeta, "plan"),
			this.parseMigrationMeta(legacyTodosMeta, "legacy-todos"),
			this.parseMigrationMeta(brainMeta, "brain"),
			this.parseMigrationMeta(localStorageMeta, "pinned-conversations"),
			this.parseMigrationMeta(clawSettingsMeta, "claw-settings"),
			this.parseMigrationMeta(mcpOAuthMeta, "mcp-oauth"),
			this.parseMigrationMeta(expertRecentsMeta, "expert-recents")
		].reduce((latest, current) => {
			const latestRun = latest.lastRun ?? -1;
			return (current.lastRun ?? -1) > latestRun ? current : latest;
		});
	}
	/**
	* 清除迁移元数据（用于 force 重跑）
	*/
	clearMigrationMeta(type) {
		if (type === "history" || type === "all") {
			this.database.deleteMigrationMeta(HISTORY_MIGRATION_META_KEY);
			this.logger.info("[MigrationService] Cleared history migration metadata");
			this.database.deleteMigrationMeta(LEGACY_ARCHIVED_SYNC_DONE_META_KEY);
			this.logger.info("[MigrationService] Cleared archived sync completion flag");
		}
		if (type === "automation" || type === "all") {
			this.database.deleteMigrationMeta(AUTOMATION_MIGRATION_META_KEY);
			this.logger.info("[MigrationService] Cleared automation migration metadata");
		}
		if (type === "legacy-todos" || type === "all") {
			this.database.deleteMigrationMeta(LEGACY_TODOS_MIGRATION_META_KEY);
			this.logger.info("[MigrationService] Cleared legacy-todos migration metadata");
		}
		if (type === "plan" || type === "all") {
			this.database.deleteMigrationMeta(PLAN_MIGRATION_META_KEY);
			this.logger.info("[MigrationService] Cleared plan migration metadata");
		}
		if (type === "brain" || type === "all") {
			this.database.deleteMigrationMeta(BRAIN_MIGRATION_META_KEY);
			this.logger.info("[MigrationService] Cleared brain migration metadata");
		}
		if (type === "media-index" || type === "all") {
			this.database.deleteMigrationMeta(MEDIA_INDEX_MIGRATION_META_KEY);
			this.logger.info("[MigrationService] Cleared media-index migration metadata");
		}
		if (type === "pinned-conversations" || type === "all") {
			this.database.deleteMigrationMeta(LOCALSTORAGE_MIGRATION_META_KEY);
			this.logger.info("[MigrationService] Cleared localStorage migration metadata");
		}
		if (type === "claw-settings" || type === "all") {
			this.database.deleteMigrationMeta(CLAW_SETTINGS_MIGRATION_META_KEY);
			this.logger.info("[MigrationService] Cleared claw-settings migration metadata");
		}
		if (type === "mcp-oauth" || type === "all") {
			this.database.deleteMigrationMeta(MCP_OAUTH_MIGRATION_META_KEY);
			this.logger.info("[MigrationService] Cleared mcp-oauth migration metadata");
		}
		if (type === "expert-recents" || type === "all") {
			this.database.deleteMigrationMeta(EXPERT_RECENTS_MIGRATION_META_KEY);
			this.logger.info("[MigrationService] Cleared expert-recents migration metadata");
		}
	}
	readHistoryMigrationMeta() {
		const raw = this.database.getMigrationMeta(HISTORY_MIGRATION_META_KEY);
		if (!raw) return;
		try {
			return JSON.parse(raw);
		} catch (error) {
			this.logger.warn("[MigrationService] Failed to parse history migration metadata", error);
			this.fileLogger.warn("[History] Failed to parse migration metadata, treating as absent");
			return;
		}
	}
	isHistoryMigrationPermanentlyAbandoned(meta) {
		return !!meta && meta.reason === "insufficient_disk_space" && meta.permanentlyAbandoned === true;
	}
	getAvailableDiskBytes(targetPath) {
		try {
			let existingPath = targetPath;
			while (!fs.existsSync(existingPath)) {
				const parent = path.dirname(existingPath);
				if (parent === existingPath) break;
				existingPath = parent;
			}
			const stat = fs.statfsSync(existingPath);
			const availableBlocks = Number(stat.bavail);
			const blockSize = Number(stat.bsize);
			if (!Number.isFinite(availableBlocks) || !Number.isFinite(blockSize)) return null;
			return availableBlocks * blockSize;
		} catch (error) {
			this.logger.warn("[MigrationService] Failed to determine available disk space, will skip automatic history migration", error);
			this.fileLogger.warn("[History] Failed to determine available disk space, skipping automatic history migration");
			return null;
		}
	}
	ensureDatabaseReady() {
		try {
			this.database.initialize();
			return;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const err = error instanceof Error ? error : new Error(String(error));
			this.logger.error(`[MigrationService] Database initialization failed: ${err.message}`);
			this.fileLogger.error("[MigrationService] Database initialization failed:", err);
			return message;
		}
	}
	/**
	* 检查是否存在任何迁移记录（用于判断是否首次迁移）
	*/
	hasAnyMigrationMeta() {
		return [
			HISTORY_MIGRATION_META_KEY,
			AUTOMATION_MIGRATION_META_KEY,
			PLAN_MIGRATION_META_KEY,
			LEGACY_TODOS_MIGRATION_META_KEY,
			BRAIN_MIGRATION_META_KEY,
			MEDIA_INDEX_MIGRATION_META_KEY,
			LOCALSTORAGE_MIGRATION_META_KEY,
			CLAW_SETTINGS_MIGRATION_META_KEY,
			MCP_OAUTH_MIGRATION_META_KEY,
			EXPERT_RECENTS_MIGRATION_META_KEY
		].some((key) => !!this.database.getMigrationMeta(key));
	}
	parseMigrationMeta(meta, type) {
		if (!meta) return {
			type,
			status: "idle"
		};
		try {
			const parsed = JSON.parse(meta);
			return {
				type,
				status: parsed.status || "idle",
				lastRun: parsed.completedAt,
				message: parsed.error || parsed.reason
			};
		} catch {
			return {
				type,
				status: "idle"
			};
		}
	}
	/**
	* 单个子迁移完成后的监控上报。抽出来以便 history 后台化时也能复用同一份上报逻辑。
	*/
	reportSubMigration(name, result, startTime, force, shouldReport) {
		if (!shouldReport) return;
		try {
			const monitorStatus = result.success ? !result.details ? "skipped" : "success" : "failed";
			const details = result.details;
			this.migrationCollector?.recordMigration({
				type: name,
				status: monitorStatus,
				durationMs: Date.now() - startTime,
				sessionCount: details?.sessionCount ?? details?.successCount,
				isIncremental: !force,
				error: result.error
			});
		} catch {}
	}
	/**
	* 子迁移专用的"绝对安全沙盒"。
	*
	* 设计目标：
	*   无论 fn 以何种方式失败（同步 throw / Promise reject / 内部漏 await 产生的
	*   unhandledRejection / 卡死超时），都不能让异常冒泡到调用方。所有失败最终
	*   只体现为 MigrationResult.success = false，让 triggerMigration 的循环可以
	*   继续跑兄弟子迁移，并保证主进程启动流程不会因为某一条子迁移出问题而中断。
	*
	* 额外职责：
	*   1. 失败时兜底写一条 `status: 'failed'` / `status: 'timeout'` 的 meta（前提：
	*      目标 meta 当前还不是 success / partial），避免下次启动再把同一个必崩的
	*      子迁移从头跑一次。
	*   2. 硬超时（默认传入）：防止源文件 IO hang 死整个迁移链路。
	*   3. 本地 unhandledRejection 捕获：在子迁移执行期间临时挂一个 listener，把
	*      发生在本段时间窗口的 unhandledRejection 降级为日志，而不是冒泡到主进程。
	*
	* 明确边界（无法覆盖）：
	*   - 原生模块（.node 绑定）的 native crash（例如 better_sqlite3、fsevents）
	*     无法在 JS 层拦截。这类问题需要通过模块级防护或进程隔离解决，不在本函数
	*     承诺的范围内。
	*
	* @param name 子迁移名字（用于日志与错误上下文）
	* @param metaKey 对应的 migration_meta key，用于在兜底失败时写入 failed 记录
	* @param fn 子迁移主体
	* @param options.timeoutMs 硬超时毫秒数
	*/
	async safeRunSubMigration(name, metaKey, fn, options) {
		const { timeoutMs } = options;
		const capturedRejections = [];
		const onLocalUnhandledRejection = (reason) => {
			capturedRejections.push(reason);
			const msg = reason instanceof Error ? reason.stack || reason.message : String(reason);
			this.logger.warn(`[MigrationService] [${name}] captured unhandledRejection: ${msg.slice(0, 500)}`);
			try {
				this.fileLogger.warn(`[${name}] Captured unhandledRejection: ${msg.slice(0, 2e3)}`);
			} catch {}
		};
		process.on("unhandledRejection", onLocalUnhandledRejection);
		let timer;
		const timeoutSymbol = Symbol("sub-migration-timeout");
		try {
			const wrapped = Promise.resolve().then(fn).catch((err) => {
				const msg = err instanceof Error ? err.stack || err.message : String(err);
				this.logger.error(`[MigrationService] [${name}] sub-migration threw: ${msg.slice(0, 500)}`);
				try {
					this.fileLogger.error(`[${name}] Sub-migration threw`, err);
				} catch {}
				return {
					success: false,
					message: `${name} migration threw an exception`,
					error: err instanceof Error ? err.message : String(err)
				};
			});
			const timeoutPromise = new Promise((resolve) => {
				timer = setTimeout(() => resolve(timeoutSymbol), timeoutMs);
				timer.unref?.();
			});
			const raced = await Promise.race([wrapped, timeoutPromise]);
			if (raced === timeoutSymbol) {
				this.logger.warn(`[MigrationService] [${name}] sub-migration timed out after ${timeoutMs}ms, abandoning`);
				try {
					this.fileLogger.warn(`[${name}] Timed out after ${timeoutMs}ms`);
				} catch {}
				this.writeFailureMetaIfNeeded(metaKey, name, "timeout", `exceeded ${timeoutMs}ms`);
				return {
					success: false,
					message: `${name} migration timed out after ${timeoutMs}ms`,
					error: `timeout:${timeoutMs}ms`
				};
			}
			if (!raced.success) this.writeFailureMetaIfNeeded(metaKey, name, "failed", raced.error || raced.message);
			if (capturedRejections.length > 0) try {
				this.fileLogger.warn(`[${name}] ${capturedRejections.length} unhandled rejection(s) occurred during sub-migration; see warnings above`);
			} catch {}
			return raced;
		} catch (err) {
			const msg = err instanceof Error ? err.stack || err.message : String(err);
			this.logger.error(`[MigrationService] [${name}] safeRunSubMigration itself threw: ${msg.slice(0, 500)}`);
			try {
				this.fileLogger.error(`[${name}] safeRunSubMigration itself threw`, err);
			} catch {}
			this.writeFailureMetaIfNeeded(metaKey, name, "failed", msg);
			return {
				success: false,
				message: `${name} migration failed in safe wrapper`,
				error: err instanceof Error ? err.message : String(err)
			};
		} finally {
			if (timer) clearTimeout(timer);
			process.off("unhandledRejection", onLocalUnhandledRejection);
		}
	}
	/**
	* 在子迁移意外失败时兜底写入 meta，供下次启动幂等检查使用。
	*
	* 原则：最小干预。只在 meta 完全缺失或脏数据时才写入，任何已存在的结构化 meta
	* 都优先保留，因为子迁移方法自己写的失败 meta 往往包含更有价值的上下文
	* （具体失败文件、errno、详细 reason 等）。
	*
	* 调用场景：
	*   - 子迁移方法在 try/catch 外抛了异常 → meta 根本没写 → 兜底写
	*   - 子迁移方法超时 → meta 可能未写 → 兜底写
	*   - 子迁移方法返回 success:false 但忘了写 meta（边界情况）→ 兜底写
	*   - 子迁移方法返回 success:false 且自己写了 meta → 不覆盖
	*/
	writeFailureMetaIfNeeded(metaKey, name, status, error) {
		try {
			const existing = this.database.getMigrationMeta(metaKey);
			if (existing) {
				let isStructured = false;
				try {
					const parsed = JSON.parse(existing);
					isStructured = parsed && typeof parsed === "object" && typeof parsed.status === "string";
				} catch {}
				if (isStructured) return;
			}
			const truncatedError = typeof error === "string" ? error.slice(0, 2e3) : error;
			this.database.setMigrationMeta(metaKey, JSON.stringify({
				status,
				error: truncatedError,
				completedAt: Date.now(),
				source: "safeRunSubMigration",
				name
			}));
			try {
				this.fileLogger.info(`[${name}] Persisted fallback failure meta (status=${status})`);
			} catch {}
		} catch (metaErr) {
			this.logger.warn(`[MigrationService] [${name}] failed to persist fallback failure meta:`, metaErr);
		}
	}
	async migrateLegacySessionsAndHistory(force) {
		if (this.historyLaunchingSentinel) this.historyLaunchingSentinel = false;
		else if (this.runningHistoryPromise && !force) {
			this.logger.info("[MigrationService] History migration already in-flight, reusing existing promise");
			this.fileLogger.info("[History] Migration already in-flight, reusing existing promise (de-dup)");
			return this.runningHistoryPromise;
		}
		const resultPromise = this._doMigrateLegacySessionsAndHistory(force);
		this.runningHistoryPromise = resultPromise;
		return resultPromise;
	}
	async _doMigrateLegacySessionsAndHistory(force) {
		const existingHistoryMeta = force ? void 0 : this.readHistoryMigrationMeta();
		if (!force && this.isHistoryMigrationPermanentlyAbandoned(existingHistoryMeta)) {
			this.logger.warn("[MigrationService] History migration remains permanently abandoned after repeated low-disk skips");
			this.fileLogger.warn("[History] Automatic migration remains permanently abandoned until force retry");
			return {
				success: false,
				message: "History migration permanently abandoned after repeated low-disk skips",
				error: "insufficient_disk_space"
			};
		}
		if (force) {
			this.logger.info("[MigrationService] Force mode enabled, clearing history migration metadata");
			this.fileLogger.info("[History] Force mode enabled, clearing previous metadata");
			this.clearMigrationMeta("history");
		}
		const sourcePath = getLegacyVscdbPath();
		const historyRoot = getLegacyExtensionDataRoot();
		this.fileLogger.info(`[History] sourcePath=${sourcePath}, exists=${fs.existsSync(sourcePath)}`);
		this.fileLogger.info(`[History] historyDataRoot=${historyRoot}, exists=${fs.existsSync(historyRoot)}`);
		if (!force) {
			const existingMeta = this.database.getMigrationMeta(HISTORY_MIGRATION_META_KEY);
			this.fileLogger.info(`[History][Debug] existingMeta=${existingMeta ? "present" : "null"}, force=${force}`);
			if (existingMeta) {
				let shouldRerun = false;
				try {
					const parsed = JSON.parse(existingMeta);
					this.fileLogger.info(`[History][Debug] status=${parsed.status}, reason=${parsed.reason}, repairChecked=${parsed.repairChecked}, repairAbandoned=${parsed.repairAbandoned}, repairAttempts=${parsed.repairAttempts}, completedAt=${parsed.completedAt}`);
					const historyMigrationVersion = parsed.migrationVersion ?? 0;
					if (historyMigrationVersion < HISTORY_MIGRATION_FORMAT_VERSION) {
						this.fileLogger.info(`[History] Migration format upgraded ${historyMigrationVersion} -> ${HISTORY_MIGRATION_FORMAT_VERSION}, clearing meta to re-run`);
						this.database.setMigrationMeta(HISTORY_MIGRATION_META_KEY, "");
						this.clearMigrationStateFiles();
						shouldRerun = true;
					}
					if (!shouldRerun && parsed.status === "skipped" && parsed.reason === "legacy_history_missing") {
						const currentDataRoot = getLegacyExtensionDataRoot();
						this.fileLogger.info(`[History][Debug] legacy_history_missing detected, checking currentDataRoot=${currentDataRoot}, exists=${fs.existsSync(currentDataRoot)}`);
						if (fs.existsSync(currentDataRoot)) {
							this.fileLogger.info(`[History] Previous migration was skipped (legacy_history_missing) but data root now exists: ${currentDataRoot}, clearing meta to re-run`);
							this.database.setMigrationMeta(HISTORY_MIGRATION_META_KEY, "");
							this.clearMigrationStateFiles();
							shouldRerun = true;
						}
					}
					const shouldRecheckDisk = (parsed.reason === "insufficient_disk_space" || parsed.reason === "disk_space_unavailable") && !shouldRerun;
					if (shouldRecheckDisk) this.fileLogger.info("[History] Previous disk-guard skip detected, rechecking disk guard before migration");
					if (!shouldRerun && !shouldRecheckDisk) {
						const lastCompletedAt = parsed.completedAt ?? 0;
						const vscdbMtime = getMaxMtime(sourcePath);
						const historyDirMtime = getDirMtime(getLegacyExtensionDataRoot());
						const effectiveMtime = Math.max(vscdbMtime, historyDirMtime);
						this.fileLogger.info(`[History] Incremental check: vscdbMtime=${vscdbMtime}, historyDirMtime=${historyDirMtime}, effectiveMtime=${effectiveMtime}, lastCompletedAt=${lastCompletedAt}, diff=${effectiveMtime - lastCompletedAt}ms`);
						if (effectiveMtime <= lastCompletedAt) {
							if (parsed.repairAbandoned) {
								this.fileLogger.info(`[History] Already completed, repair abandoned after ${parsed.repairAttempts ?? 0} attempts, skipping`);
								return {
									success: true,
									message: "History migration: repair abandoned (permanently unrecoverable)"
								};
							}
							if (!parsed.repairChecked) {
								const missingCount = this.countMissingJsonlFiles();
								this.fileLogger.info(`[History][Debug] repairChecked=false, missingCount=${missingCount}`);
								if (missingCount > 0) {
									const repairAttempts = (parsed.repairAttempts ?? 0) + 1;
									const lastMissingCount = parsed.lastRepairMissingCount;
									const MAX_REPAIR_ATTEMPTS = 3;
									if (repairAttempts >= MAX_REPAIR_ATTEMPTS && lastMissingCount === missingCount) {
										this.logger.warn(`[MigrationService] Repair abandoned after ${repairAttempts} attempts, missingCount stuck at ${missingCount}`);
										this.fileLogger.warn(`[History] Repair abandoned after ${repairAttempts} attempts, ${missingCount} sessions permanently unrecoverable`);
										this.database.setMigrationMeta(HISTORY_MIGRATION_META_KEY, JSON.stringify({
											...parsed,
											migrationVersion: HISTORY_MIGRATION_FORMAT_VERSION,
											repairAbandoned: true,
											repairAttempts,
											lastRepairMissingCount: missingCount
										}));
										return {
											success: true,
											message: "History migration: repair abandoned (permanently unrecoverable)"
										};
									}
									this.logger.info(`[MigrationService] Source unchanged but ${missingCount} .jsonl files missing, re-running migration to restore (attempt ${repairAttempts}/${MAX_REPAIR_ATTEMPTS})`);
									this.fileLogger.info(`[History] Source unchanged but ${missingCount} .jsonl files missing, re-running migration (attempt ${repairAttempts}/${MAX_REPAIR_ATTEMPTS})`);
									this.database.setMigrationMeta(HISTORY_MIGRATION_META_KEY, JSON.stringify({
										...parsed,
										migrationVersion: HISTORY_MIGRATION_FORMAT_VERSION,
										repairAttempts,
										lastRepairMissingCount: missingCount
									}));
									this.clearMigrationStateFiles();
								} else {
									this.database.setMigrationMeta(HISTORY_MIGRATION_META_KEY, JSON.stringify({
										...parsed,
										migrationVersion: HISTORY_MIGRATION_FORMAT_VERSION,
										repairChecked: true
									}));
									this.fileLogger.info("[History] Already completed, source unchanged, repair check passed, skipping");
									return {
										success: true,
										message: "History migration already completed (skipped)"
									};
								}
							} else {
								this.logger.info("[MigrationService] History migration already completed and source unchanged, skipping");
								this.fileLogger.info("[History] Already completed, source unchanged, repairChecked=true, skipping");
								return {
									success: true,
									message: "History migration already completed (skipped)"
								};
							}
						} else {
							this.logger.info("[MigrationService] History migration: source has new content, running incremental migration");
							this.fileLogger.info("[History] Source updated since last migration, running incremental migration");
						}
					} else if (shouldRerun) this.fileLogger.info("[History][Debug] shouldRerun=true, skipping incremental check, proceeding to full migration");
				} catch (err) {
					this.fileLogger.info(`[History][Debug] meta parse error: ${err}, proceeding to full migration`);
				}
			} else this.fileLogger.info("[History][Debug] No existing meta, proceeding to full migration");
		}
		if (!fs.existsSync(sourcePath)) {
			this.database.setMigrationMeta(HISTORY_MIGRATION_META_KEY, JSON.stringify({
				status: "skipped",
				reason: "legacy_vscdb_missing",
				migrationVersion: HISTORY_MIGRATION_FORMAT_VERSION,
				sourcePath,
				completedAt: Date.now()
			}));
			this.fileLogger.info(`[History] Skipped: legacy database not found at ${sourcePath}`);
			return {
				success: true,
				message: "History migration skipped (legacy database not found)"
			};
		}
		if (!force) {
			const configDir = getWorkbuddyConfigDir();
			const availableBytes = this.getAvailableDiskBytes(configDir);
			if (availableBytes === null || availableBytes < HISTORY_MIGRATION_MIN_DISK_BYTES) {
				const availableText = availableBytes === null ? "unknown" : `${(availableBytes / 1024 / 1024).toFixed(0)}MB`;
				const requiredMb = HISTORY_MIGRATION_MIN_DISK_BYTES / 1024 / 1024;
				this.logger.warn(`[MigrationService] History migration skipped: disk space not sufficient (${availableText} available, ${requiredMb}MB required)`);
				this.fileLogger.warn(`[History] Skipped: disk guard failed at ${configDir}, available=${availableBytes ?? "unknown"}, required=${HISTORY_MIGRATION_MIN_DISK_BYTES}`);
				const reason = availableBytes === null ? "disk_space_unavailable" : "insufficient_disk_space";
				const skipCount = reason === "insufficient_disk_space" ? ((existingHistoryMeta?.reason === "insufficient_disk_space" ? existingHistoryMeta.diskSkipCount : 0) ?? 0) + 1 : void 0;
				const permanentlyAbandoned = (skipCount ?? 0) >= HISTORY_MIGRATION_MAX_DISK_SKIP_COUNT;
				this.database.setMigrationMeta(HISTORY_MIGRATION_META_KEY, JSON.stringify({
					...existingHistoryMeta,
					status: permanentlyAbandoned ? "abandoned" : "skipped",
					reason,
					diskSkipCount: skipCount,
					permanentlyAbandoned,
					migrationVersion: HISTORY_MIGRATION_FORMAT_VERSION,
					sourcePath,
					completedAt: Date.now()
				}));
				let message = "History migration skipped (disk space unavailable)";
				if (permanentlyAbandoned) {
					message = `History migration permanently abandoned after ${skipCount} low-disk skips`;
					this.logger.warn(`[MigrationService] History migration permanently abandoned after ${skipCount} consecutive low-disk skips`);
					this.fileLogger.warn(`[History] Permanently abandoned after ${skipCount} low-disk skips; use force=true to retry`);
				} else if (skipCount !== void 0) {
					message = `History migration skipped (insufficient disk space, ${skipCount}/${HISTORY_MIGRATION_MAX_DISK_SKIP_COUNT})`;
					this.logger.warn(`[MigrationService] Low-disk skip #${skipCount}/${HISTORY_MIGRATION_MAX_DISK_SKIP_COUNT}`);
					this.fileLogger.warn(`[History] Low-disk skip #${skipCount}/${HISTORY_MIGRATION_MAX_DISK_SKIP_COUNT}`);
				}
				return {
					success: false,
					message,
					error: reason
				};
			}
		}
		this.fileLogger.info("[History] Starting history migration...");
		const reader = new VscdbReader();
		try {
			await reader.initialize(sourcePath);
			const sessions = await reader.readSessions();
			this.fileLogger.info(`[History] Read ${sessions.length} sessions from legacy database`);
			const sampledSessions = sessions.slice(0, HISTORY_MIGRATION_LOG_SAMPLE_LIMIT);
			for (const session of sampledSessions) {
				const title = (session.title || "").slice(0, 40);
				this.fileLogger.info(`[History][Session] id=${session.conversationId}, cwd=${session.cwd}, title=${title}, isPlayground=${session.isPlayground}`);
			}
			if (sessions.length > sampledSessions.length) this.fileLogger.info(`[History][Session] ... ${sessions.length - sampledSessions.length} more sessions omitted`);
			const sessionWriteFailures = [];
			for (const session of sessions) try {
				const existing = this.database.getSession(session.conversationId);
				if (existing?.deletedAt) continue;
				const statusToWrite = existing?.status?.toLowerCase() === "archived" ? existing.status : session.status;
				this.database.upsertSession({
					id: session.conversationId,
					cwd: session.cwd,
					userId: session.userId,
					title: session.title,
					customTitle: session.customTitle,
					status: statusToWrite,
					createdAt: session.createdAt,
					updatedAt: session.updatedAt,
					deletedAt: session.deletedAt,
					isPlayground: session.isPlayground
				});
			} catch (error) {
				sessionWriteFailures.push({
					conversationId: session.conversationId,
					error: error instanceof Error ? error.message : String(error)
				});
			}
			if (sessionWriteFailures.length > 0) this.fileLogger.warn(`[History] ${sessionWriteFailures.length} session write failures`);
			let recentlyOpenedPathsCount = 0;
			let newWorkspacesAdded = 0;
			const workspaceWriteFailures = [];
			try {
				const recentlyOpenedPaths = await reader.readRecentlyOpenedPaths();
				recentlyOpenedPathsCount = recentlyOpenedPaths.length;
				if (recentlyOpenedPaths.length > 0) {
					const sessionCwds = new Set(sessions.map((s) => require_server.canonicalizeStoredPath(s.cwd)).filter(Boolean));
					const additionalPaths = recentlyOpenedPaths.filter((p) => !sessionCwds.has(require_server.canonicalizeStoredPath(p)));
					for (const workspacePath of additionalPaths) try {
						this.database.upsertWorkspace(workspacePath);
						newWorkspacesAdded++;
					} catch (error) {
						workspaceWriteFailures.push({
							path: workspacePath,
							error: error instanceof Error ? error.message : String(error)
						});
					}
					this.fileLogger.info(`[History] Recently opened paths: found=${recentlyOpenedPaths.length}, sessionCwds=${sessionCwds.size}, additional=${additionalPaths.length}, added=${newWorkspacesAdded}, failures=${workspaceWriteFailures.length}`);
				}
			} catch (error) {
				this.logger.warn("[MigrationService] Failed to read recently opened paths, continuing:", error);
				this.fileLogger.warn("[History] Failed to read recently opened paths, continuing");
			}
			const configs = this.buildHistoryMigrationConfigs(sessions, force);
			this.fileLogger.info(`[History] buildHistoryMigrationConfigs returned ${configs.length} workspace configs for ${sessions.length} sessions`);
			const sampledConfigs = configs.slice(0, HISTORY_MIGRATION_LOG_SAMPLE_LIMIT);
			for (const cfg of sampledConfigs) {
				const convIds = cfg.source.filter?.conversationIds || [];
				this.fileLogger.info(`[History][Config] workspace=${cfg.source.workspacePath}, target=${cfg.target.projectPath}, conversations=[${convIds.join(", ")}]`);
			}
			if (configs.length > sampledConfigs.length) this.fileLogger.info(`[History][Config] ... ${configs.length - sampledConfigs.length} more configs omitted`);
			const coveredSessionIds = new Set(configs.flatMap((c) => c.source.filter?.conversationIds || []));
			const uncoveredSessions = sessions.filter((s) => !coveredSessionIds.has(s.conversationId));
			if (uncoveredSessions.length > 0) {
				this.fileLogger.warn(`[History] ${uncoveredSessions.length} sessions have NO matching history directory (will have DB record but no JSONL):`);
				const sampledUncoveredSessions = uncoveredSessions.slice(0, HISTORY_MIGRATION_LOG_SAMPLE_LIMIT);
				for (const s of sampledUncoveredSessions) this.fileLogger.warn(`[History][Uncovered] id=${s.conversationId}, cwd=${s.cwd}, title=${(s.title || "").slice(0, 40)}`);
				if (uncoveredSessions.length > sampledUncoveredSessions.length) this.fileLogger.warn(`[History][Uncovered] ... ${uncoveredSessions.length - sampledUncoveredSessions.length} more sessions omitted`);
			}
			if (configs.length === 0) {
				this.database.setMigrationMeta(HISTORY_MIGRATION_META_KEY, JSON.stringify({
					status: "skipped",
					reason: "legacy_history_missing",
					migrationVersion: HISTORY_MIGRATION_FORMAT_VERSION,
					sourcePath,
					sessionCount: sessions.length,
					completedAt: Date.now()
				}));
				this.fileLogger.info(`[History] Skipped: ${sessions.length} sessions but no history files found`);
				return {
					success: true,
					message: `History migration skipped (${sessions.length} sessions, no history found)`
				};
			}
			this.fileLogger.info(`[History] Migrating ${configs.length} workspace histories...`);
			const migrationService = new HistoryMigrationServiceImpl();
			const logMem = (tag) => {
				const m = process.memoryUsage();
				this.fileLogger.info(`[History][Mem][${tag}] rss=${(m.rss / 1024 / 1024).toFixed(1)}MB heapUsed=${(m.heapUsed / 1024 / 1024).toFixed(1)}MB heapTotal=${(m.heapTotal / 1024 / 1024).toFixed(1)}MB`);
			};
			logMem("before-migrate");
			const globalTotal = configs.reduce((sum, cfg) => sum + (cfg.source.filter?.conversationIds?.length ?? 0), 0);
			let globalCurrent = 0;
			let prevWorkspaceTotal = 0;
			if (globalTotal > 0) this.historyProgressHandler?.(0, globalTotal);
			const report = await migrationService.migrateBatch({
				workspaces: configs,
				globalStrategy: {
					stopOnError: false,
					parallelWorkspaces: 1
				}
			}, { onConvertProgress: (current, total, name) => {
				this.fileLogger.info(`[History] Progress: ${current}/${total} - ${name || ""}`);
				if (current % 5 === 0 || current === total) logMem(`progress-${current}`);
				if (globalTotal > 0) {
					if (current === 1 && globalCurrent > 0) prevWorkspaceTotal = globalCurrent;
					globalCurrent = prevWorkspaceTotal + current;
					this.historyProgressHandler?.(globalCurrent, globalTotal, name);
				} else this.historyProgressHandler?.(current, total, name);
			} });
			logMem("after-migrate");
			const failedWorkspaces = report.workspaceReports.filter((workspaceReport) => workspaceReport.statistics.errorCount > 0).map((workspaceReport) => ({
				workspacePath: workspaceReport.sourceWorkspace.path,
				successCount: workspaceReport.statistics.successCount,
				skipCount: workspaceReport.statistics.skipCount,
				errorCount: workspaceReport.statistics.errorCount,
				errors: workspaceReport.results.filter((item) => item.status === "error").slice(0, 5).map((item) => item.error || item.reason || "Unknown error")
			}));
			const failedWorkspaceCount = failedWorkspaces.length;
			const hasFailures = failedWorkspaceCount > 0 || sessionWriteFailures.length > 0 || workspaceWriteFailures.length > 0;
			if (failedWorkspaceCount > 0) {
				this.fileLogger.warn(`[History] Failed workspace details (${failedWorkspaceCount}):`);
				const sampledFailedWorkspaces = failedWorkspaces.slice(0, HISTORY_MIGRATION_LOG_SAMPLE_LIMIT);
				for (const workspace of sampledFailedWorkspaces) {
					const errors = workspace.errors.length > 0 ? workspace.errors.join(" | ") : "N/A";
					const stats = `success=${workspace.successCount}, skipped=${workspace.skipCount}, error=${workspace.errorCount}`;
					this.fileLogger.warn(`[History][Workspace] path=${workspace.workspacePath}, ${stats}, errors=${errors}`);
				}
				if (failedWorkspaces.length > sampledFailedWorkspaces.length) {
					const omittedCount = failedWorkspaces.length - sampledFailedWorkspaces.length;
					this.fileLogger.warn(`[History][Workspace] ... ${omittedCount} more failed workspaces omitted`);
				}
			}
			this.fileLogger.info(`[History] Migration completed - Success: ${report.summary.successCount}, Error: ${failedWorkspaceCount}`);
			try {
				const patchCount = this.patchSessionMetadata(sessions);
				if (patchCount > 0) this.fileLogger.info(`[History] Patched ${patchCount} session meta.json files with isPlayground/cwd`);
			} catch (patchError) {
				this.fileLogger.warn(`[History] Failed to patch session metadata, non-fatal: ${patchError}`);
			}
			try {
				const cwdCount = this.ensureCwdDirectories(sessions);
				if (cwdCount > 0) this.fileLogger.info(`[History] Created ${cwdCount} missing cwd directories`);
			} catch (cwdError) {
				this.fileLogger.warn(`[History] Failed to ensure cwd directories, non-fatal: ${cwdError}`);
			}
			const vscdbMtimeMs = fs.existsSync(sourcePath) ? fs.statSync(sourcePath).mtimeMs : 0;
			const unrecoverableSessionIds = this.collectUnrecoverableSessionIds(sessions, configs);
			if (unrecoverableSessionIds.length > 0) this.fileLogger.warn(`[History] Marking ${unrecoverableSessionIds.length} sessions as permanently unrecoverable (no legacy source): ` + unrecoverableSessionIds.slice(0, 10).join(", ") + (unrecoverableSessionIds.length > 10 ? ", ..." : ""));
			this.database.setMigrationMeta(HISTORY_MIGRATION_META_KEY, JSON.stringify({
				status: hasFailures ? "partial" : "success",
				migrationVersion: HISTORY_MIGRATION_FORMAT_VERSION,
				sourcePath,
				sessionCount: sessions.length,
				migratedWorkspaceCount: configs.length,
				recentlyOpenedPathsCount,
				newWorkspacesAdded,
				sessionWriteFailures,
				workspaceWriteFailures,
				failedWorkspaces,
				summary: report.summary,
				vscdbMtimeMs,
				completedAt: Date.now(),
				repairChecked: true,
				unrecoverableSessionIds
			}));
			return {
				success: !hasFailures,
				message: `History migration completed: ${configs.length} workspaces, ${report.summary.successCount} successful, ${failedWorkspaceCount} failed`,
				details: report.summary
			};
		} catch (error) {
			this.logger.error("[MigrationService] Failed to migrate legacy sessions/history:", error);
			this.fileLogger.error("[History] Migration failed:", error);
			this.database.setMigrationMeta(HISTORY_MIGRATION_META_KEY, JSON.stringify({
				status: "failed",
				migrationVersion: HISTORY_MIGRATION_FORMAT_VERSION,
				sourcePath,
				error: error instanceof Error ? error.message : String(error),
				completedAt: Date.now()
			}));
			return {
				success: false,
				message: "History migration failed",
				error: error instanceof Error ? error.message : String(error)
			};
		} finally {
			reader.dispose();
		}
	}
	async migrateLegacyAutomations(force) {
		const sourcePath = getLegacyAutomationDatabasePath();
		let lastSyncAt = 0;
		if (!force) {
			const existingMeta = this.database.getMigrationMeta(AUTOMATION_MIGRATION_META_KEY);
			if (existingMeta) try {
				const parsed = JSON.parse(existingMeta);
				const lastCompletedAt = parsed.completedAt ?? 0;
				if (getMaxMtime(sourcePath) <= lastCompletedAt) {
					this.logger.info("[MigrationService] Automation migration already completed and source unchanged, skipping");
					this.fileLogger.info("[Automation] Already completed, source unchanged, skipping");
					return {
						success: true,
						message: "Automation migration already completed (skipped)"
					};
				}
				lastSyncAt = parsed.lastSyncAt ?? 0;
				this.logger.info("[MigrationService] Automation migration: source has new content, running incremental sync");
				this.fileLogger.info("[Automation] Source updated since last migration, running incremental sync");
			} catch {}
		} else {
			this.logger.info("[MigrationService] Force mode enabled, clearing automation migration metadata");
			this.fileLogger.info("[Automation] Force mode enabled, clearing previous metadata");
			this.clearMigrationMeta("automation");
		}
		this.fileLogger.info(`[Automation] Starting automation migration (lastSyncAt=${lastSyncAt})...`);
		try {
			const result = new AutomationMigrationService(this.database).migrateFromLegacyDatabase(sourcePath, lastSyncAt);
			this.fileLogger.info(`[Automation] Migration completed - Automations: ${result.automationsMigrated} migrated, ${result.automationsSkipped} skipped; Runs: ${result.runsMigrated} migrated, ${result.runsSkipped} skipped`);
			this.database.setMigrationMeta(AUTOMATION_MIGRATION_META_KEY, JSON.stringify({
				status: result.skipped ? "skipped" : "success",
				...result,
				lastSyncAt: Date.now(),
				completedAt: Date.now()
			}));
			return {
				success: true,
				message: `Automation migration completed: ${result.automationsMigrated} automations, ${result.runsMigrated} runs`,
				details: result
			};
		} catch (error) {
			this.logger.error("[MigrationService] Failed to migrate legacy automations:", error);
			this.fileLogger.error("[Automation] Migration failed:", error);
			this.database.setMigrationMeta(AUTOMATION_MIGRATION_META_KEY, JSON.stringify({
				status: "failed",
				error: error instanceof Error ? error.message : String(error),
				completedAt: Date.now()
			}));
			return {
				success: false,
				message: "Automation migration failed",
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}
	/**
	* 确保所有 session 的 cwd 目录存在。
	* 旧 WorkBuddy 在关闭 playground session 时会删除 ~/WorkBuddy/{timestamp}/ 临时工作目录，
	* 导致迁移后 Desktop 打开文件夹时报"无法打开文件夹"。
	*/
	ensureCwdDirectories(sessions) {
		let created = 0;
		const uniqueCwds = /* @__PURE__ */ new Set();
		for (const session of sessions) {
			const cwd = require_server.canonicalizeStoredPath(session.cwd);
			if (cwd) uniqueCwds.add(cwd);
		}
		for (const cwd of uniqueCwds) if (!fs.existsSync(cwd)) try {
			fs.mkdirSync(cwd, { recursive: true });
			created++;
		} catch {}
		return created;
	}
	/**
	* 补丁方法：确保所有迁移的 session 的 meta.json 包含 isPlayground 和 cwd。
	* 扫描 ~/.workbuddy/projects/ 下的所有 meta.json 文件，
	* 如果缺少 isPlayground 或 cwd 字段，从 sessions 数据中补写。
	*
	* @returns 被修补的 meta.json 文件数量
	*/
	patchSessionMetadata(sessions) {
		const sessionMap = /* @__PURE__ */ new Map();
		for (const session of sessions) sessionMap.set(session.conversationId, session);
		const projectsDir = path.join(getWorkbuddyConfigDir(), "projects");
		if (!fs.existsSync(projectsDir)) return 0;
		let patchCount = 0;
		const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true });
		for (const projectDir of projectDirs) {
			if (!projectDir.isDirectory()) continue;
			const projectPath = path.join(projectsDir, projectDir.name);
			let files;
			try {
				files = fs.readdirSync(projectPath);
			} catch {
				continue;
			}
			for (const file of files) {
				if (!file.endsWith(".meta.json")) continue;
				const sessionId = file.slice(0, -10);
				const sessionData = sessionMap.get(sessionId);
				if (!sessionData) continue;
				const metaPath = path.join(projectPath, file);
				try {
					const metaContent = fs.readFileSync(metaPath, "utf-8");
					const meta = JSON.parse(metaContent);
					let needsUpdate = false;
					if (meta.isPlayground === void 0 && sessionData.isPlayground !== void 0) {
						meta.isPlayground = sessionData.isPlayground;
						needsUpdate = true;
					}
					if (!meta.cwd && sessionData.cwd) {
						meta.cwd = require_server.canonicalizeStoredPath(sessionData.cwd);
						needsUpdate = true;
					}
					if (needsUpdate) {
						fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
						patchCount++;
					}
				} catch {
					continue;
				}
			}
		}
		return patchCount;
	}
	/**
	* 从 meta.json 中提取 model 信息，写入 sessions 表的 model 列。
	* 如果 meta.json 也没有 model，则回源读老 Claw 消息的 extra.modelId。
	* 仅对尚未设置 model 的 session 进行补丁。
	*/
	patchSessionModel() {
		const projectsDir = path.join(getWorkbuddyConfigDir(), "projects");
		let patchCount = 0;
		const needsLegacyFallback = [];
		if (fs.existsSync(projectsDir)) {
			const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true });
			for (const projectDir of projectDirs) {
				if (!projectDir.isDirectory()) continue;
				const projectPath = path.join(projectsDir, projectDir.name);
				let files;
				try {
					files = fs.readdirSync(projectPath);
				} catch {
					continue;
				}
				for (const file of files) {
					if (!file.endsWith(".meta.json")) continue;
					const sessionId = file.slice(0, -10);
					const existing = this.database.getSession(sessionId);
					if (!existing || existing.model) continue;
					const metaPath = path.join(projectPath, file);
					try {
						const metaContent = fs.readFileSync(metaPath, "utf-8");
						const model = JSON.parse(metaContent)?.model;
						if (typeof model === "string" && model.trim()) {
							this.database.upsertSession({
								...existing,
								model
							});
							patchCount++;
						} else needsLegacyFallback.push(sessionId);
					} catch {
						needsLegacyFallback.push(sessionId);
					}
				}
			}
		}
		for (const sessionId of needsLegacyFallback) {
			const existing = this.database.getSession(sessionId);
			if (!existing || existing.model) continue;
			const model = this.extractModelFromLegacyMessages(sessionId);
			if (model) {
				this.database.upsertSession({
					...existing,
					model
				});
				patchCount++;
			}
		}
		return patchCount;
	}
	/**
	* 从老 Claw 源消息的 extra.modelId 中提取模型标识。
	* 只需找到第一条有 modelId 的消息即返回。
	*/
	extractModelFromLegacyMessages(conversationId) {
		const workspaceDir = this.getConversationIdIndex().get(conversationId);
		if (!workspaceDir) return;
		const messagesDir = path.join(workspaceDir, conversationId, "messages");
		if (!fs.existsSync(messagesDir)) return;
		let files;
		try {
			files = fs.readdirSync(messagesDir);
		} catch {
			return;
		}
		for (const file of files) {
			if (!file.endsWith(".json")) continue;
			try {
				const content = fs.readFileSync(path.join(messagesDir, file), "utf-8");
				const message = JSON.parse(content);
				if (!message.extra) continue;
				const modelId = (typeof message.extra === "string" ? JSON.parse(message.extra) : message.extra)?.modelId;
				if (typeof modelId === "string" && modelId.trim()) return modelId;
			} catch {
				continue;
			}
		}
	}
	buildHistoryMigrationConfigs(sessions, force = false) {
		const groupedSessions = /* @__PURE__ */ new Map();
		for (const session of sessions) {
			const bucket = groupedSessions.get(session.cwd) ?? [];
			bucket.push(session);
			groupedSessions.set(session.cwd, bucket);
		}
		this.fileLogger.info(`[History][BuildConfigs] Grouped ${sessions.length} sessions into ${groupedSessions.size} workspaces`);
		const configs = [];
		for (const [cwd, workspaceSessions] of groupedSessions) {
			const sessionsByUserId = /* @__PURE__ */ new Map();
			for (const session of workspaceSessions) {
				const uid = session.userId || "_unknown_";
				const bucket = sessionsByUserId.get(uid) ?? [];
				bucket.push(session);
				sessionsByUserId.set(uid, bucket);
			}
			if (sessionsByUserId.size > 1) this.fileLogger.info(`[History][BuildConfigs] cwd=${cwd} has ${sessionsByUserId.size} userIds: [${[...sessionsByUserId.keys()].join(", ")}]`);
			for (const [userId, userSessions] of sessionsByUserId) {
				const workspacePath = this.findLegacyHistoryWorkspacePath(cwd, userId === "_unknown_" ? void 0 : userId);
				const canonicalCwd = require_server.canonicalizeStoredPath(cwd);
				if (!workspacePath) {
					this.fileLogger.warn(`[History][BuildConfigs] No legacy history found for cwd=${cwd}, userId=${userId}, sessions=[${userSessions.map((s) => s.conversationId).join(", ")}]`);
					for (const session of userSessions) {
						const actualPath = this.findLegacyHistoryByConversationId(session.conversationId);
						if (!actualPath) continue;
						this.fileLogger.info(`[History][BuildConfigs] Orphan session ${session.conversationId} found at ${actualPath} via conversationId lookup (cwd=${cwd})`);
						const sessionMetadataMap = /* @__PURE__ */ new Map();
						sessionMetadataMap.set(session.conversationId, {
							isPlayground: session.isPlayground,
							cwd: canonicalCwd
						});
						configs.push({
							source: {
								type: "agent-history",
								workspacePath: actualPath,
								filter: { conversationIds: [session.conversationId] }
							},
							target: {
								type: "agent-cli",
								projectPath: canonicalCwd,
								basePath: getWorkbuddyConfigDir()
							},
							strategy: {
								overwrite: force,
								force,
								validateData: true
							},
							brainPathMapping: {
								oldPrefix: getLegacyBrainBasePath() + path.sep,
								newPrefix: path.join(getWorkbuddyConfigDir(), "brain") + path.sep
							},
							sessionMetadataMap
						});
					}
					continue;
				}
				this.fileLogger.info(`[History][BuildConfigs] Found legacy history: cwd=${cwd}, userId=${userId} -> ${workspacePath}, sessions=[${userSessions.map((s) => s.conversationId).join(", ")}]`);
				const coveredIds = [];
				const misplacedSessions = [];
				try {
					const indexPath = path.join(workspacePath, "index.json");
					const indexContent = fs.readFileSync(indexPath, "utf-8");
					const parsed = JSON.parse(indexContent);
					const indexConvIds = new Set((parsed.conversations || []).map((c) => c.id));
					try {
						const entries = fs.readdirSync(workspacePath, { withFileTypes: true });
						for (const entry of entries) if (entry.isDirectory()) indexConvIds.add(entry.name);
					} catch {}
					for (const session of userSessions) if (indexConvIds.has(session.conversationId)) coveredIds.push(session.conversationId);
					else misplacedSessions.push(session);
					if (misplacedSessions.length > 0) this.fileLogger.info(`[History][BuildConfigs] ${misplacedSessions.length} session(s) not found in workspace index, will search by conversationId: [${misplacedSessions.map((s) => s.conversationId).join(", ")}]`);
				} catch {
					coveredIds.push(...userSessions.map((s) => s.conversationId));
				}
				if (coveredIds.length > 0) {
					const coveredSet = new Set(coveredIds);
					const sessionMetadataMap = /* @__PURE__ */ new Map();
					for (const session of userSessions) if (coveredSet.has(session.conversationId)) sessionMetadataMap.set(session.conversationId, {
						isPlayground: session.isPlayground,
						cwd: canonicalCwd
					});
					configs.push({
						source: {
							type: "agent-history",
							workspacePath,
							filter: { conversationIds: coveredIds }
						},
						target: {
							type: "agent-cli",
							projectPath: canonicalCwd,
							basePath: getWorkbuddyConfigDir()
						},
						strategy: {
							overwrite: force,
							force,
							validateData: true
						},
						brainPathMapping: {
							oldPrefix: getLegacyBrainBasePath() + path.sep,
							newPrefix: path.join(getWorkbuddyConfigDir(), "brain") + path.sep
						},
						sessionMetadataMap
					});
				}
				const misplacedByPath = /* @__PURE__ */ new Map();
				for (const session of misplacedSessions) {
					const actualPath = this.findLegacyHistoryByConversationId(session.conversationId);
					if (!actualPath) continue;
					this.fileLogger.info(`[History][BuildConfigs] Misplaced session ${session.conversationId} found at ${actualPath} (expected cwd=${cwd})`);
					const group = misplacedByPath.get(actualPath) ?? [];
					group.push(session);
					misplacedByPath.set(actualPath, group);
				}
				for (const [actualPath, groupSessions] of misplacedByPath) {
					const sessionMetadataMap = /* @__PURE__ */ new Map();
					for (const session of groupSessions) sessionMetadataMap.set(session.conversationId, {
						isPlayground: session.isPlayground,
						cwd: canonicalCwd
					});
					configs.push({
						source: {
							type: "agent-history",
							workspacePath: actualPath,
							filter: { conversationIds: groupSessions.map((s) => s.conversationId) }
						},
						target: {
							type: "agent-cli",
							projectPath: canonicalCwd,
							basePath: getWorkbuddyConfigDir()
						},
						strategy: {
							overwrite: force,
							force,
							validateData: true
						},
						brainPathMapping: {
							oldPrefix: getLegacyBrainBasePath() + path.sep,
							newPrefix: path.join(getWorkbuddyConfigDir(), "brain") + path.sep
						},
						sessionMetadataMap
					});
				}
			}
		}
		return configs;
	}
	/**
	* 读取 meta 中记录的"已知无源、永远无法恢复"的 session ID 列表。
	* 这些 session 的 legacy history 源数据已丢失（例如：旧 WorkBuddyExtension/Data 目录
	* 被清理、跨账号数据错位、旧版 bug 导致源文件被删），无论 repair 多少次都不可能生成 .jsonl。
	* 列在这里的 id 会被 countMissingJsonlFiles() 跳过，避免死循环 repair。
	*/
	getUnrecoverableSessionIds() {
		const meta = this.database.getMigrationMeta(HISTORY_MIGRATION_META_KEY);
		if (!meta) return [];
		try {
			const parsed = JSON.parse(meta);
			if (Array.isArray(parsed.unrecoverableSessionIds)) return parsed.unrecoverableSessionIds.filter((id) => typeof id === "string");
		} catch {}
		return [];
	}
	/**
	* 收集本次 history 迁移中"DB 有记录但无 legacy 源"的 session（即 Uncovered sessions）。
	* 这些 session 对应的 configs 里不会包含它们，HistoryMigrationService 无论跑多少次都不会为其生成 .jsonl。
	* 把它们记录到 meta 里作为永久黑名单，后续 countMissingJsonlFiles() 跳过。
	*/
	collectUnrecoverableSessionIds(sessions, configs) {
		const coveredIds = /* @__PURE__ */ new Set();
		for (const cfg of configs) {
			const ids = cfg.source.filter?.conversationIds ?? [];
			for (const id of ids) coveredIds.add(id);
		}
		return sessions.filter((s) => !coveredIds.has(s.conversationId) && !s.conversationId.includes("-")).map((s) => s.conversationId);
	}
	/**
	* Count sessions that have a DB record (not deleted) but are missing their .jsonl file.
	* This detects cases where save() overwrote a migrated .jsonl with empty content
	* and the file was subsequently lost. A non-zero count triggers re-migration.
	*
	* Only counts sessions with non-UUID IDs (legacy format from old IDE),
	* since Desktop-created sessions (UUID format) cannot be restored from legacy data.
	*
	* Sessions listed in meta.unrecoverableSessionIds are excluded — these are sessions
	* whose legacy history source has been permanently lost (legacy WorkBuddyExtension/Data
	* directory cleaned up, cross-account mismatch, etc.). Re-running migration can never
	* produce .jsonl for them, so counting them here would cause an infinite repair loop.
	*/
	countMissingJsonlFiles() {
		const projectsDir = path.join(getWorkbuddyConfigDir(), "projects");
		if (!fs.existsSync(projectsDir)) return 0;
		const unrecoverable = new Set(this.getUnrecoverableSessionIds());
		const existingJsonlIds = /* @__PURE__ */ new Set();
		try {
			const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true });
			for (const dir of projectDirs) {
				if (!dir.isDirectory()) continue;
				const dirPath = path.join(projectsDir, dir.name);
				try {
					const files = fs.readdirSync(dirPath);
					for (const file of files) if (file.endsWith(".jsonl")) existingJsonlIds.add(file.replace(".jsonl", ""));
				} catch {}
			}
		} catch {
			return 0;
		}
		let missing = 0;
		let skippedUnrecoverable = 0;
		try {
			const rows = this.database.db?.prepare?.("SELECT id FROM sessions WHERE deleted_at IS NULL")?.all();
			if (rows) for (const row of rows) {
				if (row.id.includes("-")) continue;
				if (unrecoverable.has(row.id)) {
					skippedUnrecoverable++;
					continue;
				}
				if (!existingJsonlIds.has(row.id)) missing++;
			}
		} catch {
			return 0;
		}
		if (missing > 0 || skippedUnrecoverable > 0) this.fileLogger.info(`[History] Missing .jsonl check: missing=${missing}, skippedUnrecoverable=${skippedUnrecoverable}`);
		return missing;
	}
	/**
	* Clear migration-history state files so that HistoryMigrationService's
	* sourceHash idempotency check won't skip sessions whose .jsonl was lost.
	* This is only called during repair mode.
	*/
	clearMigrationStateFiles() {
		const stateDir = path.join(getWorkbuddyConfigDir(), ".migration-history");
		if (!fs.existsSync(stateDir)) return;
		try {
			const files = fs.readdirSync(stateDir).filter((f) => f.startsWith("state-") && f.endsWith(".json"));
			for (const file of files) fs.unlinkSync(path.join(stateDir, file));
			this.fileLogger.info(`[History] Repair: cleared ${files.length} migration state files from ${stateDir}`);
		} catch (error) {
			this.fileLogger.warn(`[History] Repair: failed to clear migration state files: ${error}`);
		}
	}
	findLegacyHistoryWorkspacePath(workspacePath, userId) {
		const dataRoot = getLegacyExtensionDataRoot();
		if (!fs.existsSync(dataRoot)) {
			this.fileLogger.warn(`[History][FindPath] Legacy data root does not exist: ${dataRoot}`);
			return;
		}
		const normalized = path.normalize(workspacePath);
		const workspaceHash = crypto.createHash("md5").update(normalized).digest("hex");
		this.fileLogger.info(`[History][FindPath] Looking for workspace: path=${workspacePath}, hash=${workspaceHash}, userId=${userId || "N/A"}`);
		const candidateHashes = [workspaceHash];
		if (process.platform === "win32" && /^[a-zA-Z]:/.test(normalized)) {
			const flipped = normalized[0] === normalized[0].toLowerCase() ? normalized[0].toUpperCase() + normalized.slice(1) : normalized[0].toLowerCase() + normalized.slice(1);
			const flippedHash = crypto.createHash("md5").update(flipped).digest("hex");
			if (flippedHash !== workspaceHash) {
				candidateHashes.push(flippedHash);
				this.fileLogger.info(`[History][FindPath] Also trying flipped drive letter hash: ${flippedHash} (from ${flipped})`);
			}
		}
		const accountDirs = fs.readdirSync(dataRoot, { withFileTypes: true });
		const sortedAccountDirs = userId ? [...accountDirs].sort((a, b) => {
			return (a.name === userId ? -1 : 0) - (b.name === userId ? -1 : 0);
		}) : accountDirs;
		for (const accountDir of sortedAccountDirs) {
			if (!accountDir.isDirectory()) continue;
			const vscodeRoot = path.join(dataRoot, accountDir.name, "VSCode");
			if (!fs.existsSync(vscodeRoot)) continue;
			const uidDirs = fs.readdirSync(vscodeRoot, { withFileTypes: true });
			const sortedUidDirs = userId ? [...uidDirs].sort((a, b) => {
				return (a.name === userId ? -1 : 0) - (b.name === userId ? -1 : 0);
			}) : uidDirs;
			for (const uidDir of sortedUidDirs) {
				if (!uidDir.isDirectory()) continue;
				for (const hash of candidateHashes) {
					const candidate = path.join(vscodeRoot, uidDir.name, "history", hash);
					const indexPath = path.join(candidate, "index.json");
					if (fs.existsSync(indexPath)) {
						this.fileLogger.info(`[History][FindPath] FOUND: ${indexPath} (account=${accountDir.name}, uid=${uidDir.name})`);
						return candidate;
					}
				}
			}
		}
		this.fileLogger.warn(`[History][FindPath] NOT FOUND for hash=${candidateHashes.join("|")}, workspace=${workspacePath}`);
	}
	getConversationIdIndex() {
		if (this.conversationIdIndex) return this.conversationIdIndex;
		const index = /* @__PURE__ */ new Map();
		const dataRoot = getLegacyExtensionDataRoot();
		if (!fs.existsSync(dataRoot)) {
			this.conversationIdIndex = index;
			return index;
		}
		let totalDirs = 0;
		try {
			const accountDirs = fs.readdirSync(dataRoot, { withFileTypes: true });
			for (const accountDir of accountDirs) {
				if (!accountDir.isDirectory()) continue;
				const vscodeRoot = path.join(dataRoot, accountDir.name, "VSCode");
				if (!fs.existsSync(vscodeRoot)) continue;
				let uidDirs;
				try {
					uidDirs = fs.readdirSync(vscodeRoot, { withFileTypes: true });
				} catch {
					continue;
				}
				for (const uidDir of uidDirs) {
					if (!uidDir.isDirectory()) continue;
					const historyRoot = path.join(vscodeRoot, uidDir.name, "history");
					if (!fs.existsSync(historyRoot)) continue;
					let hashDirs;
					try {
						hashDirs = fs.readdirSync(historyRoot, { withFileTypes: true });
					} catch {
						continue;
					}
					for (const hashDir of hashDirs) {
						if (!hashDir.isDirectory()) continue;
						totalDirs++;
						const dirPath = path.join(historyRoot, hashDir.name);
						const indexPath = path.join(dirPath, "index.json");
						try {
							const content = fs.readFileSync(indexPath, "utf-8");
							const conversations = JSON.parse(content).conversations || [];
							for (const conv of conversations) if (conv.id) index.set(conv.id, dirPath);
						} catch {}
						let subDirCount = 0;
						try {
							const subEntries = fs.readdirSync(dirPath, { withFileTypes: true });
							for (const sub of subEntries) if (sub.isDirectory() && !index.has(sub.name)) {
								index.set(sub.name, dirPath);
								subDirCount++;
							}
						} catch {}
						if (subDirCount > 0) this.fileLogger.info(`[History][ConvIdIndex] hash=${hashDir.name}: added ${subDirCount} extra conversationId(s) from subdirectories`);
					}
				}
			}
		} catch (err) {
			this.fileLogger.warn(`[History][ConvIdIndex] Error scanning dataRoot: ${err}`);
		}
		this.fileLogger.info(`[History][ConvIdIndex] Built index: ${index.size} conversationIds from ${totalDirs} hash directories, dataRoot=${dataRoot}`);
		this.conversationIdIndex = index;
		return index;
	}
	findLegacyHistoryByConversationId(conversationId) {
		const result = this.getConversationIdIndex().get(conversationId);
		if (result) this.fileLogger.info(`[History][FindByConvId] FOUND conversationId=${conversationId} -> ${result}`);
		else this.fileLogger.warn(`[History][FindByConvId] NOT FOUND conversationId=${conversationId}`);
		return result;
	}
	async migrateLegacyPlans(force) {
		if (!force && this.database.getMigrationMeta(PLAN_MIGRATION_META_KEY)) {
			this.logger.info("[MigrationService] Plan migration already completed, skipping");
			this.fileLogger.info("[Plan] Already completed, skipping");
			return {
				success: true,
				message: "Plan migration already completed (skipped)"
			};
		}
		if (force) {
			this.logger.info("[MigrationService] Force mode enabled, clearing plan migration metadata");
			this.fileLogger.info("[Plan] Force mode enabled, clearing previous metadata");
			this.clearMigrationMeta("plan");
		}
		this.fileLogger.info("[Plan] Starting plan migration...");
		try {
			const result = new PlanMigrationService().migrateFromLegacyDirectory();
			this.fileLogger.info(`[Plan] Migration completed - Plans migrated: ${result.plansMigrated}`);
			this.database.setMigrationMeta(PLAN_MIGRATION_META_KEY, JSON.stringify({
				status: result.skipped ? "skipped" : "success",
				plansMigrated: result.plansMigrated,
				sourcePath: result.sourcePath,
				targetPath: result.targetPath,
				completedAt: Date.now()
			}));
			return {
				success: true,
				message: `Plan migration completed: ${result.plansMigrated} plans migrated`,
				details: result
			};
		} catch (error) {
			this.logger.error("[MigrationService] Failed to migrate legacy plans:", error);
			this.fileLogger.error("[Plan] Migration failed:", error);
			this.database.setMigrationMeta(PLAN_MIGRATION_META_KEY, JSON.stringify({
				status: "failed",
				error: error instanceof Error ? error.message : String(error),
				completedAt: Date.now()
			}));
			return {
				success: false,
				message: "Plan migration failed",
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}
	async migrateLegacyTodos(force) {
		if (!force && this.database.getMigrationMeta(LEGACY_TODOS_MIGRATION_META_KEY)) {
			this.logger.info("[MigrationService] Legacy-todos migration already completed, skipping");
			this.fileLogger.info("[LegacyTodos] Already completed, skipping");
			return {
				success: true,
				message: "Legacy-todos migration already completed (skipped)"
			};
		}
		if (force) {
			this.logger.info("[MigrationService] Force mode enabled, clearing legacy-todos migration metadata");
			this.fileLogger.info("[LegacyTodos] Force mode enabled, clearing previous metadata");
			this.clearMigrationMeta("legacy-todos");
		}
		this.fileLogger.info("[LegacyTodos] Starting legacy todos migration...");
		try {
			const result = new LegacyTodosMigrationService().migrateFromLegacyDirectory();
			this.fileLogger.info(`[LegacyTodos] Migration completed - Files: ${result.totalFilesRead}, Todos: ${result.totalTodosFound}, Sessions migrated: ${result.sessionsMigrated}, Sessions skipped: ${result.sessionsSkipped}, Tasks migrated: ${result.tasksMigrated}`);
			this.database.setMigrationMeta(LEGACY_TODOS_MIGRATION_META_KEY, JSON.stringify({
				status: result.skipped ? "skipped" : "success",
				sourcePath: result.sourcePath,
				targetPath: result.targetPath,
				totalFilesRead: result.totalFilesRead,
				totalTodosFound: result.totalTodosFound,
				sessionsMigrated: result.sessionsMigrated,
				sessionsSkipped: result.sessionsSkipped,
				tasksMigrated: result.tasksMigrated,
				completedAt: Date.now()
			}));
			return {
				success: true,
				message: `Legacy-todos migration completed: ${result.tasksMigrated} tasks from ${result.sessionsMigrated} sessions`,
				details: result
			};
		} catch (error) {
			this.logger.error("[MigrationService] Failed to migrate legacy todos:", error);
			this.fileLogger.error("[LegacyTodos] Migration failed:", error);
			this.database.setMigrationMeta(LEGACY_TODOS_MIGRATION_META_KEY, JSON.stringify({
				status: "failed",
				error: error instanceof Error ? error.message : String(error),
				completedAt: Date.now()
			}));
			return {
				success: false,
				message: "Legacy-todos migration failed",
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}
	/**
	* 迁移旧系统的 brain 产物文件
	*
	* 将 IDE 插件 globalStorage 下的 brain/{conversationId}/ 目录
	* 复制到 Desktop 的 {workbuddyConfigDir}/brain/{conversationId}/ 目录
	*/
	async migrateLegacyBrainFiles(force) {
		if (!force && this.database.getMigrationMeta(BRAIN_MIGRATION_META_KEY)) {
			this.logger.info("[MigrationService] Brain migration already completed, skipping");
			this.fileLogger.info("[Brain] Already completed, skipping");
			return {
				success: true,
				message: "Brain migration already completed (skipped)"
			};
		}
		if (force) {
			this.logger.info("[MigrationService] Force mode enabled, clearing brain migration metadata");
			this.fileLogger.info("[Brain] Force mode enabled, clearing previous metadata");
			this.clearMigrationMeta("brain");
		}
		const sourceBrainBase = getLegacyBrainBasePath();
		if (!fs.existsSync(sourceBrainBase)) {
			this.database.setMigrationMeta(BRAIN_MIGRATION_META_KEY, JSON.stringify({
				status: "skipped",
				reason: "legacy_brain_dir_missing",
				sourcePath: sourceBrainBase,
				completedAt: Date.now()
			}));
			this.fileLogger.info("[Brain] Skipped: legacy brain directory not found");
			return {
				success: true,
				message: "Brain migration skipped (legacy brain directory not found)"
			};
		}
		this.fileLogger.info("[Brain] Starting brain files migration...");
		const targetBrainBase = path.join(getWorkbuddyConfigDir(), "brain");
		let filesCopied = 0;
		let sessionsCopied = 0;
		let sessionsSkipped = 0;
		const errors = [];
		try {
			const conversationDirs = fs.readdirSync(sourceBrainBase, { withFileTypes: true }).filter((e) => e.isDirectory());
			this.fileLogger.info(`[Brain] Found ${conversationDirs.length} conversation brain directories`);
			for (const dir of conversationDirs) {
				const conversationId = dir.name;
				const sourceDir = path.join(sourceBrainBase, conversationId);
				const targetDir = path.join(targetBrainBase, conversationId);
				try {
					if (fs.existsSync(targetDir) && !force) {
						sessionsSkipped++;
						continue;
					}
					fs.mkdirSync(targetDir, { recursive: true });
					const copiedCount = this.copyDirectoryRecursive(sourceDir, targetDir);
					filesCopied += copiedCount;
					sessionsCopied++;
				} catch (error) {
					errors.push({
						conversationId,
						error: error instanceof Error ? error.message : String(error)
					});
				}
			}
			this.fileLogger.info(`[Brain] Migration completed - Sessions: ${sessionsCopied} copied, ${sessionsSkipped} skipped, Files: ${filesCopied}, Errors: ${errors.length}`);
			this.database.setMigrationMeta(BRAIN_MIGRATION_META_KEY, JSON.stringify({
				status: errors.length > 0 ? "partial" : "success",
				sourcePath: sourceBrainBase,
				targetPath: targetBrainBase,
				sessionsCopied,
				sessionsSkipped,
				filesCopied,
				errors: errors.slice(0, 10),
				completedAt: Date.now()
			}));
			return {
				success: errors.length === 0,
				message: `Brain migration completed: ${sessionsCopied} sessions, ${filesCopied} files copied`,
				details: {
					sessionsCopied,
					sessionsSkipped,
					filesCopied,
					errorCount: errors.length
				}
			};
		} catch (error) {
			this.logger.error("[MigrationService] Failed to migrate brain files:", error);
			this.fileLogger.error("[Brain] Migration failed:", error);
			this.database.setMigrationMeta(BRAIN_MIGRATION_META_KEY, JSON.stringify({
				status: "failed",
				sourcePath: sourceBrainBase,
				error: error instanceof Error ? error.message : String(error),
				completedAt: Date.now()
			}));
			return {
				success: false,
				message: "Brain migration failed",
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}
	/**
	* 迁移旧架构 media-index 中的媒体文件记录到独立的索引文件。
	*
	* 旧架构通过 FileSystemWatcher 检测媒体文件并持久化到 media-index/{hash}.json，
	* 每条记录含 sessionId 绑定。本方法将这些记录转换为按 session 存储的
	* ~/.workbuddy/media-index/{sessionId}.json 索引文件，供
	* MediaArtifactService.pushLegacyMediaArtifacts() 在 loadSession 时读取推送。
	*/
	async migrateLegacyMediaIndex(force) {
		if (!force && this.database.getMigrationMeta(MEDIA_INDEX_MIGRATION_META_KEY)) {
			this.logger.info("[MigrationService] Media-index migration already completed, skipping");
			this.fileLogger.info("[MediaIndex] Already completed, skipping");
			return {
				success: true,
				message: "Media-index migration already completed (skipped)"
			};
		}
		if (force) {
			this.logger.info("[MigrationService] Force mode enabled, clearing media-index migration metadata");
			this.fileLogger.info("[MediaIndex] Force mode enabled, clearing previous metadata");
			this.clearMigrationMeta("media-index");
		}
		this.fileLogger.info("[MediaIndex] Starting media-index migration...");
		try {
			const migrationResult = new MediaIndexMigrationService().migrate();
			this.fileLogger.info(`[MediaIndex] Migration completed: ${migrationResult.indexFilesScanned} index files scanned, ${migrationResult.totalRecords} total records, ${migrationResult.recordsWritten} written, ${migrationResult.recordsSkippedExisting} already existed, ${migrationResult.recordsSkippedNoFile} file missing, ${migrationResult.syntheticEntriesCleaned} synthetic entries cleaned`);
			this.database.setMigrationMeta(MEDIA_INDEX_MIGRATION_META_KEY, JSON.stringify({
				status: migrationResult.skipped ? "skipped" : "success",
				sourceDir: migrationResult.sourceDir,
				indexFilesScanned: migrationResult.indexFilesScanned,
				totalRecords: migrationResult.totalRecords,
				recordsWritten: migrationResult.recordsWritten,
				syntheticEntriesCleaned: migrationResult.syntheticEntriesCleaned,
				completedAt: Date.now()
			}));
			return {
				success: true,
				message: migrationResult.skipped ? "Media-index migration skipped (no source data)" : `Media-index migration completed: ${migrationResult.recordsWritten} records written`,
				details: migrationResult
			};
		} catch (error) {
			this.logger.error("[MigrationService] Media-index migration failed:", error);
			this.fileLogger.error("[MediaIndex] Migration failed:", error);
			this.database.setMigrationMeta(MEDIA_INDEX_MIGRATION_META_KEY, JSON.stringify({
				status: "failed",
				error: error instanceof Error ? error.message : String(error),
				completedAt: Date.now()
			}));
			return {
				success: false,
				message: "Media-index migration failed",
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}
	async migrateExpertRecents(force) {
		const userId = this.options.userIdProvider?.()?.trim();
		const metaKey = userId ? `${EXPERT_RECENTS_MIGRATION_META_KEY}:${userId}` : void 0;
		if (!userId || !metaKey) {
			this.fileLogger.info("[ExpertRecents] Skipped: user id is not available yet");
			return {
				success: true,
				message: "Expert-recents migration skipped (missing user id)",
				details: {
					skipped: true,
					reason: "missing_user_id",
					migratedCount: 0
				}
			};
		}
		if (!force && this.database.getMigrationMeta(metaKey)) {
			this.logger.info(`[MigrationService] Expert-recents migration already completed for user ${userId}, skipping`);
			this.fileLogger.info(`[ExpertRecents] Already completed for user ${userId}, skipping`);
			return {
				success: true,
				message: "Expert-recents migration already completed (skipped)"
			};
		}
		if (force) {
			this.logger.info(`[MigrationService] Force mode enabled, clearing expert-recents migration metadata for user ${userId}`);
			this.fileLogger.info(`[ExpertRecents] Force mode enabled, clearing previous metadata for user ${userId}`);
			this.database.deleteMigrationMeta(metaKey);
		}
		this.fileLogger.info(`[ExpertRecents] Starting expert-recents migration for user ${userId}...`);
		try {
			const result = migrateLegacyExpertRecents({
				configDir: getWorkbuddyConfigDir(),
				userId
			});
			const status = result.skipped ? "skipped" : "success";
			const message = result.skipped ? `Expert-recents migration skipped (${result.reason})` : `Expert-recents migration completed: ${result.migratedCount} recents migrated`;
			const logMessage = result.skipped ? `[ExpertRecents] Migration skipped (${result.reason})` : `[ExpertRecents] Migration completed - Recents migrated: ${result.migratedCount}`;
			this.database.setMigrationMeta(metaKey, JSON.stringify({
				status,
				userId,
				reason: result.reason,
				sourcePath: result.sourcePath,
				targetPath: result.targetPath,
				migratedCount: result.migratedCount,
				completedAt: Date.now()
			}));
			this.fileLogger.info(logMessage);
			return {
				success: true,
				message,
				details: result
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error("[MigrationService] Failed to migrate expert recents:", error);
			this.fileLogger.error("[ExpertRecents] Migration failed:", error);
			this.database.setMigrationMeta(metaKey, JSON.stringify({
				status: "failed",
				userId,
				error: errorMessage,
				completedAt: Date.now()
			}));
			return {
				success: false,
				message: "Expert-recents migration failed",
				error: errorMessage
			};
		}
	}
	async migrateLocalStorage(force) {
		if (!force && this.database.getMigrationMeta(LOCALSTORAGE_MIGRATION_META_KEY)) {
			this.logger.info("[MigrationService] localStorage migration already completed, skipping");
			this.fileLogger.info("[LocalStorage] Already completed, skipping");
			return {
				success: true,
				message: "localStorage migration already completed (skipped)"
			};
		}
		if (force) {
			this.logger.info("[MigrationService] Force mode enabled, clearing localStorage migration metadata");
			this.fileLogger.info("[LocalStorage] Force mode enabled, clearing previous metadata");
			this.clearMigrationMeta("pinned-conversations");
		}
		this.pendingLocalStorageMigration = void 0;
		this.fileLogger.info("[LocalStorage] Starting localStorage migration (pinned + group-order + archived)...");
		try {
			const service = this.createLocalStorageMigrationService();
			if (!service) {
				const reason = "localstorage_adapter_missing";
				this.fileLogger.warn("[LocalStorage] Skipped: localStorage migration adapter missing");
				this.database.setMigrationMeta(LOCALSTORAGE_MIGRATION_META_KEY, JSON.stringify({
					status: "skipped",
					reason,
					completedAt: Date.now()
				}));
				return {
					success: true,
					message: `localStorage migration skipped (${reason})`,
					details: {
						skipped: true,
						reason
					}
				};
			}
			const result = await service.migrate();
			const entryCount = Object.keys(result.entries).length;
			this.fileLogger.info(`[LocalStorage] Legacy read completed - ${entryCount} entries, Reason: ${result.reason ?? "success"}`);
			if (result.skipped) {
				this.database.setMigrationMeta(LOCALSTORAGE_MIGRATION_META_KEY, JSON.stringify({
					status: "skipped",
					reason: result.reason,
					sourceSessionPath: result.sourceSessionPath,
					completedAt: Date.now()
				}));
				return {
					success: true,
					message: `localStorage migration skipped (${result.reason})`,
					details: result
				};
			}
			this.pendingLocalStorageMigration = {
				sourceSessionPath: result.sourceSessionPath,
				preparedAt: Date.now(),
				entries: result.entries
			};
			this.fileLogger.info(`[LocalStorage] Pending payload prepared: ${entryCount} entries awaiting renderer apply`);
			this.applyArchivedSessionIdsToDatabase(result.entries["genie-archived-session-ids"]);
			return {
				success: true,
				message: `localStorage migration prepared: ${entryCount} entries awaiting renderer apply`,
				details: result
			};
		} catch (error) {
			this.logger.error("[MigrationService] Failed to migrate localStorage:", error);
			this.fileLogger.error("[LocalStorage] Migration failed:", error);
			this.database.setMigrationMeta(LOCALSTORAGE_MIGRATION_META_KEY, JSON.stringify({
				status: "failed",
				error: error instanceof Error ? error.message : String(error),
				completedAt: Date.now()
			}));
			return {
				success: false,
				message: "localStorage migration failed",
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}
	/**
	* 将旧 WB localStorage 中的归档 session ID 标记为 DB 中的 archived 状态。
	* Desktop 不读 localStorage 的归档数据，只看 DB 的 sessions.status。
	*
	* ### M21 改造：即时生效 + pending 落盘双写
	*
	* 原实现假设 sessions 已入库，但 migration 顺序是 `localStorage →
	* history`，此时 DB 尚未被 history 填充，逐个 `getSession` 全部为空
	* ⇒ 静默丢弃。
	*
	* 改造后：
	* 1. 对 DB 中**已存在**的 session 立即生效（兼容已升级用户重启场景）。
	* 2. 把**原始** ids（未做任何过滤）写入 `migration_meta[ARCHIVED_PENDING_KEY]`，
	*    等 history 迁移完成后由 `replayArchivedSessionIdsPatch()` 回放。
	*
	* 若 `ids.length === 0`，两步都不做，避免写入空 pending key。
	*/
	applyArchivedSessionIdsToDatabase(raw) {
		if (!raw) return;
		let ids;
		try {
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return;
			ids = parsed.filter((id) => typeof id === "string" && id.length > 0);
		} catch {
			return;
		}
		if (ids.length === 0) return;
		let applied = 0;
		for (const id of ids) try {
			const session = this.database.getSession(id);
			if (session && session.status?.toLowerCase() !== "archived") {
				this.database.upsertSession({
					...session,
					status: "archived"
				});
				applied++;
			}
		} catch {}
		try {
			this.database.setMigrationMeta(ARCHIVED_PENDING_KEY, JSON.stringify(ids));
		} catch (error) {
			this.fileLogger.error("[LocalStorage] Failed to persist archived pending meta:", error);
		}
		this.fileLogger.info(`[LocalStorage] Archived session IDs pending: ${ids.length} (applied immediately: ${applied})`);
	}
	/**
	* M21 —— history 迁移完成后回放 pending 归档 ID。
	*
	* 幂等：成功回放后清除 `ARCHIVED_PENDING_KEY`；再次调用无副作用。
	* 线程安全：全部走 `this.database` 同步方法（better-sqlite3 同步 API）。
	*
	* @internal 测试用途暴露为 public；生产路径由 `runAllMigrations` / RPC 调用。
	*/
	async replayArchivedSessionIdsPatch() {
		if (this.ensureDatabaseReady()) {
			this.fileLogger.error("[ArchivedReplay] Database not ready, skipping replay");
			return {
				applied: 0,
				missing: []
			};
		}
		const raw = this.database.getMigrationMeta(ARCHIVED_PENDING_KEY);
		if (!raw) return {
			applied: 0,
			missing: []
		};
		let ids;
		try {
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) {
				this.database.deleteMigrationMeta(ARCHIVED_PENDING_KEY);
				return {
					applied: 0,
					missing: []
				};
			}
			ids = parsed.filter((id) => typeof id === "string" && id.length > 0);
		} catch {
			this.database.deleteMigrationMeta(ARCHIVED_PENDING_KEY);
			return {
				applied: 0,
				missing: []
			};
		}
		if (ids.length === 0) {
			this.database.deleteMigrationMeta(ARCHIVED_PENDING_KEY);
			return {
				applied: 0,
				missing: []
			};
		}
		const now = Date.now();
		let applied = 0;
		const missing = [];
		for (const id of ids) try {
			const session = this.database.getSession(id);
			if (!session) {
				missing.push(id);
				continue;
			}
			if (session.status?.toLowerCase() === "archived") continue;
			if (this.database.updateSessionStatus(id, "archived", now) > 0) applied++;
		} catch (error) {
			missing.push(id);
			this.fileLogger.warn(`[ArchivedReplay] Failed to replay session ${id}: ${error instanceof Error ? error.message : String(error)}`);
		}
		this.database.deleteMigrationMeta(ARCHIVED_PENDING_KEY);
		this.fileLogger.info(`[ArchivedReplay] Applied: ${applied}/${ids.length} (missing: ${missing.length})`);
		return {
			applied,
			missing
		};
	}
	/**
	* M21 —— 方案 B：手动触发归档回放（供 RPC / QA 工具调用）。
	*
	* 入参优先级：
	* 1. 显式传入 `ids` —— 按该集合回放（适用于外部工具重新提交旧列表）。
	* 2. `migration_meta[ARCHIVED_PENDING_KEY]` —— 走现有 pending。
	* 3. 兜底：重新读一次 legacy localStorage 中的 `genie-archived-session-ids`。
	*
	* 若三者都没有，返回 `{ applied: 0, missing: [] }`。
	*/
	async replayArchivedManual(ids) {
		if (this.ensureDatabaseReady()) return {
			applied: 0,
			missing: []
		};
		if (Array.isArray(ids) && ids.length > 0) {
			const sanitized = ids.filter((id) => typeof id === "string" && id.length > 0);
			if (sanitized.length > 0) {
				this.database.setMigrationMeta(ARCHIVED_PENDING_KEY, JSON.stringify(sanitized));
				return this.replayArchivedSessionIdsPatch();
			}
		}
		if (this.database.getMigrationMeta(ARCHIVED_PENDING_KEY)) return this.replayArchivedSessionIdsPatch();
		try {
			const service = this.createLocalStorageMigrationService();
			if (!service) {
				this.fileLogger.info("[ArchivedReplay] Manual replay: localStorage migration adapter missing");
				return {
					applied: 0,
					missing: []
				};
			}
			const raw = (await service.migrate()).entries?.["genie-archived-session-ids"];
			if (!raw) {
				this.fileLogger.info("[ArchivedReplay] Manual replay: no legacy localStorage archived ids found");
				return {
					applied: 0,
					missing: []
				};
			}
			let legacyIds;
			try {
				const parsed = JSON.parse(raw);
				if (!Array.isArray(parsed)) return {
					applied: 0,
					missing: []
				};
				legacyIds = parsed.filter((id) => typeof id === "string" && id.length > 0);
			} catch {
				return {
					applied: 0,
					missing: []
				};
			}
			if (legacyIds.length === 0) return {
				applied: 0,
				missing: []
			};
			this.database.setMigrationMeta(ARCHIVED_PENDING_KEY, JSON.stringify(legacyIds));
			return this.replayArchivedSessionIdsPatch();
		} catch (error) {
			this.fileLogger.error("[ArchivedReplay] Manual replay fallback failed:", error);
			return {
				applied: 0,
				missing: []
			};
		}
	}
	createLocalStorageMigrationService() {
		return this.options.localStorageServiceFactory?.();
	}
	/**
	* 迁移 Claw 渠道设置
	*
	* 从旧 VS Code 格式的 settings.json 中读取 claw.channels / wecom.channels，
	* 合并后写入 ~/.workbuddy/settings.json 的 `claw` 键下。
	*/
	async migrateClawSettings(force) {
		if (!force && this.database.getMigrationMeta(CLAW_SETTINGS_MIGRATION_META_KEY)) {
			this.logger.info("[MigrationService] Claw settings migration already completed, skipping");
			this.fileLogger.info("[ClawSettings] Already completed, skipping");
			return {
				success: true,
				message: "Claw settings migration already completed (skipped)"
			};
		}
		if (force) {
			this.logger.info("[MigrationService] Force mode enabled, clearing claw-settings migration metadata");
			this.fileLogger.info("[ClawSettings] Force mode enabled, clearing previous metadata");
			this.clearMigrationMeta("claw-settings");
		}
		this.fileLogger.info("[ClawSettings] Starting claw settings migration...");
		try {
			const result = await new ClawSettingsMigrationService().migrate();
			this.fileLogger.info(`[ClawSettings] Migration completed - Channels: ${result.channelsMigrated} (${result.channelNames.join(", ")})`);
			this.database.setMigrationMeta(CLAW_SETTINGS_MIGRATION_META_KEY, JSON.stringify({
				status: result.skipped ? "skipped" : "success",
				reason: result.reason,
				channelsMigrated: result.channelsMigrated,
				channelNames: result.channelNames,
				sourcePath: result.sourcePath,
				targetPath: result.targetPath,
				completedAt: Date.now()
			}));
			return {
				success: true,
				message: result.skipped ? `Claw settings migration skipped (${result.reason})` : `Claw settings migration completed: ${result.channelsMigrated} channels (${result.channelNames.join(", ")})`,
				details: result
			};
		} catch (error) {
			this.logger.error("[MigrationService] Failed to migrate claw settings:", error);
			this.fileLogger.error("[ClawSettings] Migration failed:", error);
			this.database.setMigrationMeta(CLAW_SETTINGS_MIGRATION_META_KEY, JSON.stringify({
				status: "failed",
				error: error instanceof Error ? error.message : String(error),
				completedAt: Date.now()
			}));
			return {
				success: false,
				message: "Claw settings migration failed",
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}
	/**
	* 迁移 MCP OAuth 凭证
	*
	* 基于 Desktop mcp.json 中配置的服务器，从旧版 VSCode_mcp_oauth.json /
	* VSCode_mcp_ide_oauth.json 中匹配凭证，转换格式后写入 ~/.workbuddy/.credentials.json。
	*/
	async migrateMcpOAuth(force) {
		try {
			require_tar.purgeOrphanRootCredentials();
		} catch (error) {
			this.logger.warn("[MigrationService] purgeOrphanRootCredentials failed (non-fatal):", error);
		}
		if (!force) {
			const existingMeta = this.database.getMigrationMeta(MCP_OAUTH_MIGRATION_META_KEY);
			if (existingMeta) try {
				const lastCompletedAt = JSON.parse(existingMeta).completedAt ?? 0;
				if (getSourceMaxMtime() <= lastCompletedAt) {
					this.logger.info("[MigrationService] MCP OAuth migration already completed and source unchanged, skipping");
					this.fileLogger.info("[McpOAuth] Already completed, source unchanged, skipping");
					return {
						success: true,
						message: "MCP OAuth migration already completed (skipped)"
					};
				}
				this.logger.info("[MigrationService] MCP OAuth migration: source has new content, running incremental sync");
				this.fileLogger.info("[McpOAuth] Source updated since last migration, running incremental sync");
			} catch {}
		} else {
			this.logger.info("[MigrationService] Force mode enabled, clearing mcp-oauth migration metadata");
			this.fileLogger.info("[McpOAuth] Force mode enabled, clearing previous metadata");
			this.clearMigrationMeta("mcp-oauth");
		}
		this.fileLogger.info("[McpOAuth] Starting MCP OAuth migration...");
		try {
			const result = new McpOAuthMigrationService(this.options.userIdProvider).migrate();
			this.fileLogger.info(`[McpOAuth] Migration completed - Matched: ${result.serversMatched} servers (${result.serverNames.join(", ")}), Tokens: ${result.tokensMigrated}, ClientInfo: ${result.clientInfoMigrated}`);
			const isPendingLogin = result.skipped && result.reason === "pending_login";
			this.database.setMigrationMeta(MCP_OAUTH_MIGRATION_META_KEY, JSON.stringify({
				status: result.skipped ? "skipped" : "success",
				reason: result.reason,
				serversMatched: result.serversMatched,
				serverNames: result.serverNames,
				tokensMigrated: result.tokensMigrated,
				clientInfoMigrated: result.clientInfoMigrated,
				targetPath: result.targetPath,
				completedAt: isPendingLogin ? 0 : Date.now()
			}));
			return {
				success: true,
				message: result.skipped ? `MCP OAuth migration skipped (${result.reason})` : `MCP OAuth migration completed: ${result.serversMatched} servers matched, ${result.tokensMigrated} tokens, ${result.clientInfoMigrated} client info`,
				details: result
			};
		} catch (error) {
			this.logger.error("[MigrationService] Failed to migrate MCP OAuth:", error);
			this.fileLogger.error("[McpOAuth] Migration failed:", error);
			this.database.setMigrationMeta(MCP_OAUTH_MIGRATION_META_KEY, JSON.stringify({
				status: "failed",
				error: error instanceof Error ? error.message : String(error),
				completedAt: Date.now()
			}));
			return {
				success: false,
				message: "MCP OAuth migration failed",
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}
	/**
	* 递归复制目录内容
	* @returns 复制的文件数量
	*/
	copyDirectoryRecursive(source, target) {
		let count = 0;
		const entries = fs.readdirSync(source, { withFileTypes: true });
		for (const entry of entries) {
			const srcPath = path.join(source, entry.name);
			const tgtPath = path.join(target, entry.name);
			if (entry.isDirectory()) {
				fs.mkdirSync(tgtPath, { recursive: true });
				count += this.copyDirectoryRecursive(srcPath, tgtPath);
			} else {
				fs.copyFileSync(srcPath, tgtPath);
				count++;
			}
		}
		return count;
	}
};
function getLegacyVscdbPath() {
	return path.join(getLegacyAppDataDir(), "WorkBuddy", "codebuddy-sessions.vscdb");
}
function getLegacyExtensionDataRoot() {
	return path.join(getLegacyExtensionBaseDir(), "WorkBuddyExtension", "Data");
}
/**
* 获取旧版扩展数据的根目录。
* 注意：在 macOS 上，WorkBuddyExtension 数据实际存储在 ~/Library/Application Support/，
* 而非 agent-history 中 getCacheBasePath() 所返回的 ~/Library/Caches/。
* 在 Windows 上，agent-history 包使用 LOCALAPPDATA (AppData\Local) 存储 history，
* 这与 vscdb/globalStorage 使用的 APPDATA (AppData\Roaming) 不同。
*/
function getLegacyExtensionBaseDir() {
	if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support");
	if (process.platform === "win32") return process.env.LOCALAPPDATA?.trim() || path.join(os.homedir(), "AppData", "Local");
	return path.join(os.homedir(), ".local", "share");
}
function getLegacyAppDataDir() {
	if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support");
	if (process.platform === "win32") return process.env.APPDATA?.trim() || path.join(os.homedir(), "AppData", "Roaming");
	return process.env.XDG_CONFIG_HOME?.trim() || path.join(os.homedir(), ".config");
}
/**
* 获取旧系统 brain 文件的基础路径
* brain 文件存储在 IDE 插件的 globalStorage 目录下
*/
function getLegacyBrainBasePath() {
	return path.join(getLegacyAppDataDir(), "WorkBuddy", "User", "globalStorage", "tencent-cloud.coding-copilot", "brain");
}
/**
* 获取 SQLite 数据库文件的最大 mtime（毫秒）。
* SQLite WAL 模式下写入仅更新 .db-wal 文件，主 .db 文件 mtime 直到 checkpoint 才变，
* 因此需同时检查 .db、.db-wal、.db-shm 三个文件，取最大值。
*/
function getMaxMtime(dbPath) {
	let maxMtime = 0;
	for (const suffix of [
		"",
		"-wal",
		"-shm"
	]) {
		const filePath = dbPath + suffix;
		if (fs.existsSync(filePath)) {
			const mtime = fs.statSync(filePath).mtimeMs;
			if (mtime > maxMtime) maxMtime = mtime;
		}
	}
	return maxMtime;
}
/**
* 递归扫描目录，返回其中所有文件和子目录的最大 mtime（毫秒）。
* 用于检测 WorkBuddyExtension/Data 目录下是否有新的 history 消息写入。
* 最多递归 maxDepth 层，避免遍历过深影响启动性能。
*/
function getDirMtime(dirPath, maxDepth = 4, currentDepth = 0) {
	if (!fs.existsSync(dirPath)) return 0;
	let maxMtime = 0;
	try {
		const stat = fs.statSync(dirPath);
		maxMtime = stat.mtimeMs;
		if (currentDepth >= maxDepth || !stat.isDirectory()) return maxMtime;
		const entries = fs.readdirSync(dirPath, { withFileTypes: true });
		for (const entry of entries) {
			const childMtime = getDirMtime(path.join(dirPath, entry.name), maxDepth, currentDepth + 1);
			if (childMtime > maxMtime) maxMtime = childMtime;
		}
	} catch {}
	return maxMtime;
}
//#endregion
//#region ../../packages/workbuddy-server/src/migration/session-fragment-repair-service.ts
var MAX_REPAIR_ATTEMPTS = 3;
function compressPath(p) {
	return p.replace(/[/\\:]/g, "-").replace(/^-+/, "").replace(/-+$/, "").replace(/-+/g, "-");
}
function getWorkbuddyHomeDir() {
	return process.env.CODEBUDDY_CONFIG_DIR?.trim() || process.env.WORKBUDDY_CONFIG_DIR?.trim() || path.join(os.homedir(), ".workbuddy");
}
var FRAGMENT_DIR_RE = /^.+-workspace-files-\d+-(.+)$/;
async function pathExists(p) {
	try {
		await fs.promises.access(p);
		return true;
	} catch {
		return false;
	}
}
var SessionFragmentRepairService = class {
	async repair(database, fileLogger, force = false) {
		const startMs = Date.now();
		if (process.platform !== "win32") {
			fileLogger.info("[SessionFragmentRepair] Non-Windows platform, skipping");
			return {
				repaired: 0,
				skipped: 0,
				elapsedMs: Date.now() - startMs
			};
		}
		const homeDir = getWorkbuddyHomeDir();
		const projectsDir = path.join(homeDir, "projects");
		const doneMarker = path.join(homeDir, "session_fragment_repair_done520");
		if (!force && await pathExists(doneMarker)) {
			fileLogger.info("[SessionFragmentRepair] Already completed (marker exists), skipping");
			return {
				repaired: 0,
				skipped: 0,
				elapsedMs: Date.now() - startMs
			};
		}
		const attemptsPath = path.join(homeDir, "session_fragment_repair_attempts");
		const attempts = force ? 0 : await this.readAttempts(attemptsPath);
		if (!force && attempts >= MAX_REPAIR_ATTEMPTS) {
			fileLogger.warn(`[SessionFragmentRepair] Exceeded max attempts (${MAX_REPAIR_ATTEMPTS}), giving up — writing marker`);
			await this.writeDoneMarker(doneMarker, fileLogger);
			await this.unlinkAttempts(attemptsPath, fileLogger);
			return {
				repaired: 0,
				skipped: 0,
				elapsedMs: Date.now() - startMs
			};
		}
		fileLogger.info(`[SessionFragmentRepair] Scanning: ${projectsDir}`);
		if (!await pathExists(projectsDir)) {
			fileLogger.info("[SessionFragmentRepair] projects dir not found, marking done");
			await this.writeDoneMarker(doneMarker, fileLogger);
			return {
				repaired: 0,
				skipped: 0,
				elapsedMs: Date.now() - startMs
			};
		}
		const entries = await fs.promises.readdir(projectsDir, { withFileTypes: true });
		const fragments = [];
		for (const e of entries) {
			if (!e.isDirectory()) continue;
			const m = FRAGMENT_DIR_RE.exec(e.name);
			if (m) fragments.push({
				dir: path.join(projectsDir, e.name),
				sessionId: m[1]
			});
		}
		if (fragments.length === 0) {
			fileLogger.info("[SessionFragmentRepair] No fragment dirs found, marking done");
			await this.writeDoneMarker(doneMarker, fileLogger);
			return {
				repaired: 0,
				skipped: 0,
				elapsedMs: Date.now() - startMs
			};
		}
		fileLogger.info(`[SessionFragmentRepair] Found ${fragments.length} fragment dir(s)`);
		const ts = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
		const backupDir = path.join(homeDir, `projects_repair_backup_${ts}`);
		fileLogger.info(`[SessionFragmentRepair] Creating backup: ${backupDir}`);
		try {
			await this.copyDirSafe(projectsDir, backupDir, fileLogger);
			fileLogger.info(`[SessionFragmentRepair] Backup created: ${backupDir}`);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			fileLogger.warn(`[SessionFragmentRepair] Backup failed (non-fatal, continuing repair): ${msg}`);
		}
		const grouped = /* @__PURE__ */ new Map();
		for (const f of fragments) {
			const list = grouped.get(f.sessionId) ?? [];
			list.push(f.dir);
			grouped.set(f.sessionId, list);
		}
		let repaired = 0;
		let skipped = 0;
		let failedAny = false;
		for (const [sessionId, fragDirs] of grouped) {
			let result;
			try {
				result = await this.repairSession(sessionId, fragDirs, projectsDir, database, fileLogger);
			} catch (err) {
				fileLogger.warn(`[SessionFragmentRepair] Session ${sessionId}: repair threw: ${err instanceof Error ? err.message : String(err)}`);
				result = "failed";
			}
			if (result === "repaired") repaired++;
			else if (result === "failed") {
				failedAny = true;
				skipped++;
			} else skipped++;
		}
		const elapsedMs = Date.now() - startMs;
		fileLogger.info(`[SessionFragmentRepair] Done: repaired=${repaired}, skipped=${skipped}, elapsed=${elapsedMs}ms`);
		if (failedAny) if (!force) {
			const newAttempts = attempts + 1;
			await this.writeAttempts(attemptsPath, newAttempts, fileLogger);
			fileLogger.warn(`[SessionFragmentRepair] Had failures, attempts ${newAttempts}/${MAX_REPAIR_ATTEMPTS} — marker NOT written, will retry next startup`);
		} else fileLogger.warn("[SessionFragmentRepair] Had failures (force mode), marker NOT written");
		else {
			if (skipped > 0) fileLogger.warn(`[SessionFragmentRepair] ${skipped} session(s) skipped, fragment dirs preserved for later recovery`);
			await this.writeDoneMarker(doneMarker, fileLogger);
			if (!force) await this.unlinkAttempts(attemptsPath, fileLogger);
		}
		return {
			repaired,
			skipped,
			elapsedMs
		};
	}
	async copyDirSafe(src, dest, fileLogger) {
		await fs.promises.mkdir(dest, { recursive: true });
		let entries;
		try {
			entries = await fs.promises.readdir(src, { withFileTypes: true });
		} catch (err) {
			fileLogger.warn(`[SessionFragmentRepair] Backup: cannot read dir, skipping subtree\n  src=${src}\n  dest=${dest}\n  err=${err instanceof Error ? err.message : String(err)}`);
			return;
		}
		for (const entry of entries) {
			const srcPath = path.join(src, entry.name);
			const destPath = path.join(dest, entry.name);
			try {
				if (entry.isSymbolicLink()) fileLogger.warn(`[SessionFragmentRepair] Backup: skipping symlink/reparse\n  src=${srcPath}\n  dest=${destPath}`);
				else if (entry.isDirectory()) await this.copyDirSafe(srcPath, destPath, fileLogger);
				else if (entry.isFile()) await fs.promises.copyFile(srcPath, destPath);
				else fileLogger.warn(`[SessionFragmentRepair] Backup: skipping unknown entry type\n  src=${srcPath}`);
			} catch (err) {
				fileLogger.warn(`[SessionFragmentRepair] Backup: failed to copy file, skipping\n  src=${srcPath}\n  dest=${destPath}\n  err=${err instanceof Error ? err.message : String(err)}`);
			}
		}
	}
	async writeDoneMarker(markerPath, fileLogger) {
		try {
			await fs.promises.writeFile(markerPath, (/* @__PURE__ */ new Date()).toISOString(), "utf-8");
		} catch (err) {
			fileLogger.warn(`[SessionFragmentRepair] Failed to write done marker: ${err instanceof Error ? err.message : String(err)}`);
		}
	}
	async readAttempts(attemptsPath) {
		try {
			const raw = (await fs.promises.readFile(attemptsPath, "utf-8")).trim();
			if (!/^\+?\d+$/.test(raw)) return 0;
			const n = parseInt(raw, 10);
			if (Number.isInteger(n) && n >= 0) return n;
		} catch {}
		return 0;
	}
	async writeAttempts(attemptsPath, attempts, fileLogger) {
		try {
			await fs.promises.writeFile(attemptsPath, String(attempts), "utf-8");
		} catch (err) {
			fileLogger.warn(`[SessionFragmentRepair] Failed to write attempts: ${err instanceof Error ? err.message : String(err)}`);
		}
	}
	async unlinkAttempts(attemptsPath, fileLogger) {
		try {
			await fs.promises.unlink(attemptsPath);
		} catch (err) {
			if (err.code !== "ENOENT") fileLogger.warn(`[SessionFragmentRepair] Failed to remove attempts file: ${err instanceof Error ? err.message : String(err)}`);
		}
	}
	async repairSession(sessionId, fragDirs, projectsDir, database, fileLogger) {
		fileLogger.info(`[SessionFragmentRepair] Session ${sessionId}: ${fragDirs.length} fragment dir(s)`);
		const session = database.getSession(sessionId);
		if (!session?.cwd) {
			fileLogger.warn(`[SessionFragmentRepair] Session ${sessionId}: not found in DB or cwd empty, skipping (fragment dirs preserved)`);
			return "skipped_no_db";
		}
		const origDirName = compressPath(session.cwd);
		const existingDirMatch = (await fs.promises.readdir(projectsDir, { withFileTypes: true })).find((e) => e.isDirectory() && e.name.toLowerCase() === origDirName.toLowerCase());
		const origDir = existingDirMatch ? path.join(projectsDir, existingDirMatch.name) : path.join(projectsDir, origDirName);
		fileLogger.info(`[SessionFragmentRepair] Session ${sessionId}: target dir = ${origDir}`);
		const jsonlName = `${sessionId}.jsonl`;
		const metaName = `${sessionId}.meta.json`;
		const knownTopLevelNames = new Set([jsonlName, metaName]);
		const filesToCopy = [];
		for (const fragDir of fragDirs) {
			const scanDir = async (dir, relPrefix) => {
				const dirEntries = await fs.promises.readdir(dir, { withFileTypes: true });
				for (const e of dirEntries) {
					const entryRel = relPrefix ? `${relPrefix}/${e.name}` : e.name;
					const entryAbs = path.join(dir, e.name);
					if (e.isDirectory()) await scanDir(entryAbs, entryRel);
					else if (!(relPrefix === "" && knownTopLevelNames.has(e.name))) filesToCopy.push({
						src: entryAbs,
						relPath: entryRel,
						isSubdirFile: relPrefix !== ""
					});
				}
			};
			await scanDir(fragDir, "");
		}
		if (!await pathExists(origDir)) {
			await fs.promises.mkdir(origDir, { recursive: true });
			fileLogger.warn(`[SessionFragmentRepair] Session ${sessionId}: original dir not found, created: ${origDir}`);
		}
		const origJsonl = path.join(origDir, jsonlName);
		const sourced = [];
		if (await pathExists(origJsonl)) {
			const lines = (await fs.promises.readFile(origJsonl, "utf-8")).split("\n").filter((l) => l.trim());
			for (const l of lines) sourced.push({
				source: "original",
				line: l
			});
			fileLogger.info(`[SessionFragmentRepair] Session ${sessionId}: original dir has ${lines.length} lines`);
		}
		for (const fragDir of fragDirs) {
			const fragJsonl = path.join(fragDir, jsonlName);
			if (await pathExists(fragJsonl)) {
				const lines = (await fs.promises.readFile(fragJsonl, "utf-8")).split("\n").filter((l) => l.trim());
				for (const l of lines) sourced.push({
					source: path.basename(fragDir),
					line: l
				});
				fileLogger.info(`[SessionFragmentRepair] Session ${sessionId}: fragment ${path.basename(fragDir)} has ${lines.length} lines`);
			} else fileLogger.warn(`[SessionFragmentRepair] Session ${sessionId}: fragment ${path.basename(fragDir)} has no ${jsonlName}, skipping dir`);
		}
		if (sourced.length === 0) {
			fileLogger.warn(`[SessionFragmentRepair] Session ${sessionId}: no lines found, skipping`);
			return "failed";
		}
		const seen = /* @__PURE__ */ new Map();
		const duplicates = [];
		const unique = [];
		for (const { source, line } of sourced) if (seen.has(line)) duplicates.push({
			line,
			firstSource: seen.get(line),
			dupSource: source
		});
		else {
			seen.set(line, source);
			unique.push({
				source,
				line
			});
		}
		if (duplicates.length > 0) {
			fileLogger.warn(`[SessionFragmentRepair] Session ${sessionId}: ${duplicates.length} duplicate line(s) removed`);
			const preview = duplicates.slice(0, 3);
			for (const d of preview) try {
				const obj = JSON.parse(d.line);
				fileLogger.warn(`  dup: id=${obj["id"] ?? "?"} type=${obj["type"] ?? "?"} ts=${obj["timestamp"] ?? "?"} firstSrc=${d.firstSource} dupSrc=${d.dupSource}`);
			} catch {
				fileLogger.warn(`  dup: ${d.line.slice(0, 120)} firstSrc=${d.firstSource} dupSrc=${d.dupSource}`);
			}
		}
		const parsed = unique.map(({ line }) => {
			try {
				const obj = JSON.parse(line);
				return {
					ts: typeof obj["timestamp"] === "number" ? obj["timestamp"] : 0,
					line
				};
			} catch {
				return {
					ts: 0,
					line
				};
			}
		});
		parsed.sort((a, b) => a.ts - b.ts);
		const content = parsed.map((p) => p.line).join("\n") + "\n";
		const tmpJsonl = `${origJsonl}.tmp`;
		await fs.promises.writeFile(tmpJsonl, content, "utf-8");
		await fs.promises.rename(tmpJsonl, origJsonl);
		fileLogger.info(`[SessionFragmentRepair] Session ${sessionId}: wrote ${parsed.length} lines to ${origJsonl}` + (duplicates.length > 0 ? ` (removed ${duplicates.length} duplicates)` : ""));
		const origMeta = path.join(origDir, metaName);
		for (const fragDir of fragDirs) {
			const fragMeta = path.join(fragDir, metaName);
			if (await pathExists(fragMeta)) if (!await pathExists(origMeta)) try {
				await fs.promises.rename(fragMeta, origMeta);
				fileLogger.info(`[SessionFragmentRepair] Session ${sessionId}: moved meta.json from ${path.basename(fragDir)} to original dir`);
			} catch (err) {
				fileLogger.warn(`[SessionFragmentRepair] Session ${sessionId}: failed to move meta.json, leaving in fragment dir: ${err instanceof Error ? err.message : String(err)}`);
			}
			else fileLogger.warn(`[SessionFragmentRepair] Session ${sessionId}: meta.json exists in both ${path.basename(fragDir)} and original dir, keeping original`);
		}
		let copiedFiles = 0;
		let skippedFiles = 0;
		let bakFiles = 0;
		let fileCopyFailed = 0;
		for (const { src, relPath, isSubdirFile } of filesToCopy) {
			const dst = path.join(origDir, relPath);
			try {
				await fs.promises.mkdir(path.dirname(dst), { recursive: true });
				if (await pathExists(dst)) if (isSubdirFile) skippedFiles++;
				else {
					const bakDst = `${dst}.bak`;
					await fs.promises.copyFile(src, bakDst);
					bakFiles++;
					fileLogger.warn(`[SessionFragmentRepair] Session ${sessionId}: conflict on ${relPath}, copied as ${path.basename(bakDst)}`);
				}
				else {
					await fs.promises.copyFile(src, dst);
					copiedFiles++;
				}
			} catch (err) {
				fileCopyFailed++;
				fileLogger.warn(`[SessionFragmentRepair] Session ${sessionId}: failed to copy ${relPath}, skipping: ${err instanceof Error ? err.message : String(err)}`);
			}
		}
		if (copiedFiles > 0 || skippedFiles > 0 || bakFiles > 0 || fileCopyFailed > 0) fileLogger.info(`[SessionFragmentRepair] Session ${sessionId}: extra files copied=${copiedFiles}, skipped(content-addressed)=${skippedFiles}, bak(conflict)=${bakFiles}, failed=${fileCopyFailed}`);
		for (const fragDir of fragDirs) {
			await fs.promises.rm(fragDir, {
				recursive: true,
				force: true
			});
			fileLogger.info(`[SessionFragmentRepair] Session ${sessionId}: deleted fragment dir ${path.basename(fragDir)}`);
		}
		return "repaired";
	}
};
//#endregion
//#region src/main/startup-steps/run-session-fragment-repair.ts
/** repair 底层是同步 fs I/O；超时只停止等待（遗留 repair 仍在后台跑完当前调用），不写 marker，下次重试。 */
var FRAGMENT_REPAIR_TIMEOUT_MS = 3e5;
/**
* 调度 session fragment repair（fire-and-forget）。抽为共享 helper，供两处运行模式复用，避免重复实现：
*   - daemon 子进程主链（daemon-app-server-main.ts）；
*   - evalMode 内嵌路径（schedule-session-fragment-repair.ts）。
*
* 时序要求：必须在 fallback data merge **和** history migration 之后运行（session.cwd 由 history
* migration 写入 DB，fallback merge 可能带来新 session）。history 未完成时链到 deferredHistory 之后；
* 已同步完成时用 Promise.resolve().then 异步启动，避免主启动路径等 repair 最多 300s。
*
* history migration 超时/失败时跳过 repair，避免 partial-cwd skip 让 marker 不写入 → 无限重试 + 备份堆积。
*/
function scheduleSessionFragmentRepairRun(deps) {
	const { database, deferredHistory, logger, fallbackMergeHappened } = deps;
	const fileLogger = MigrationFileLogger.getInstance();
	const runFragmentRepair = async (historyResult) => {
		if (historyResult && !historyResult.success) {
			fileLogger.warn(`[SessionFragmentRepair] Skipping repair because history migration did not succeed (${historyResult.error ?? historyResult.message})`);
			return;
		}
		const repairPromise = new SessionFragmentRepairService().repair(database, fileLogger, fallbackMergeHappened);
		repairPromise.catch(() => {});
		let repairTimer;
		const timeoutPromise = new Promise((_, reject) => {
			repairTimer = setTimeout(() => {
				fileLogger.warn(`[SessionFragmentRepair] Repair aborted by timeout after ${FRAGMENT_REPAIR_TIMEOUT_MS}ms — marker NOT written, will retry on next startup`);
				reject(/* @__PURE__ */ new Error(`repair timed out after ${FRAGMENT_REPAIR_TIMEOUT_MS}ms`));
			}, FRAGMENT_REPAIR_TIMEOUT_MS);
			repairTimer.unref?.();
		});
		try {
			await Promise.race([repairPromise, timeoutPromise]);
		} catch (err) {
			logger.warn(`[SessionFragmentRepair] Failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
			fileLogger.error("[SessionFragmentRepair] Failed (non-fatal):", err instanceof Error ? err : new Error(String(err)));
		} finally {
			if (repairTimer) clearTimeout(repairTimer);
		}
	};
	if (deferredHistory) deferredHistory.then(runFragmentRepair).catch(() => {});
	else Promise.resolve().then(() => runFragmentRepair()).catch(() => {});
}
//#endregion
//#region src/main/system/runtime/channel-branding.ts
var DEFAULT_CHANNEL_BRANDING_ENV_KEY = "WORKBUDDY_USER_CHANNEL";
function resolveChannelBranding(rawConfig, env = process.env) {
	const config = parseChannelBrandingConfig(rawConfig);
	if (!config?.channels) return;
	let channel = normalizeString(config.channelId);
	if (!channel) channel = normalizeString(env[normalizeString(config.envKey) ?? DEFAULT_CHANNEL_BRANDING_ENV_KEY]);
	if (!channel) return;
	const entry = config.channels[channel];
	const welcomeLogo = typeof entry === "string" ? normalizeString(entry) : normalizeString(entry?.welcomeLogo);
	if (!welcomeLogo) return;
	const resolvedLogo = resolveSafeBundledAsset(welcomeLogo);
	if (!resolvedLogo) return;
	return {
		channel,
		envKey: normalizeString(config.envKey) ?? DEFAULT_CHANNEL_BRANDING_ENV_KEY,
		welcomeLogoUrl: toLocalFileUrl$1(resolvedLogo),
		...typeof entry === "object" && entry?.welcomeLogoAlt ? { welcomeLogoAlt: entry.welcomeLogoAlt } : {},
		...typeof entry === "object" && entry?.welcomeToastZh ? { welcomeToastZh: entry.welcomeToastZh } : {},
		...typeof entry === "object" && entry?.welcomeToastEn ? { welcomeToastEn: entry.welcomeToastEn } : {}
	};
}
function parseChannelBrandingConfig(rawConfig) {
	if (!isRecord(rawConfig)) return;
	const channels = isRecord(rawConfig.channels) ? rawConfig.channels : void 0;
	if (!channels) return;
	return {
		channelId: typeof rawConfig.channelId === "string" ? rawConfig.channelId : void 0,
		envKey: typeof rawConfig.envKey === "string" ? rawConfig.envKey : void 0,
		channels
	};
}
function resolveSafeBundledAsset(assetPath) {
	const segments = toSafeAssetSegments(assetPath);
	if (!segments) return;
	return require_workbuddy_product_config.resolveBundledAsset(...segments);
}
function toLocalFileUrl$1(filePath) {
	if (process.platform === "win32") return `local-file:///${filePath.replace(/\\/g, "/")}`;
	return `local-file://${filePath}`;
}
function toSafeAssetSegments(assetPath) {
	const trimmed = assetPath.trim();
	if (!trimmed) return;
	if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed) || /^[a-zA-Z]:[\\/]/.test(trimmed) || trimmed.startsWith("/") || trimmed.startsWith("\\")) return;
	const segments = trimmed.replace(/\\/g, "/").split("/").filter(Boolean);
	if (segments.length === 0 || segments.some((segment) => segment === "." || segment === "..")) return;
	return segments;
}
function normalizeString(value) {
	if (typeof value !== "string") return;
	return value.trim() || void 0;
}
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
//#endregion
//#region ../../packages/workbuddy-extensions/src/bridge/bridge-host.ts
/**
* Extension Bridge Host —— extension 子进程的宿主侧装配器。
*
* ── 设计（终极形态） ─────────────────────────────────────────
*
* Extension 子进程发出 wb.* 调用后：
*
* ```
* transport 收到 invoke(channel, ctx?, ...args)
*   → authorizer 前置校验（subject={extension 身份}, action.channel）
*   → forward 到 daemon methodChannel.invoke(channel, {subject}, ...args)
*   → daemon 侧走跟宿主一致的分派（contextualHandlers 覆盖优先，flatten 结果 fallback）
* ```
*
* ── 为什么不自己 flatten services ─────────────────────────────
*
* 早期设计让 bridge-host 自己 `flattenService(services)` 挂 handler，但 daemon 侧
* `createMethodChannel(hub, { contextualHandlers })` 有一份**契约不同的视图**：
* - `hub.storage.user` / `hub.storage.device` 是 Proxy，flatten 抓不到方法
* - daemon 靠 contextualHandlers 硬编码补齐 storage 12 个 channel
*
* 如果 bridge-host 自己重建视图，就必须**同步维护**这份 contextualHandlers。装配层
* 每加一个类似 transform（trace 注入、authn context、metric）都要在两处同步 ——
* 少同步一处→ extension 报 no handler for channel 或行为跟宿主不一致。
*
* **终极形态**：bridge-host 只做"边界拦截 + forward"，把"channel 视图"完全委托给
* daemon methodChannel。一致性天然保证，装配层只需要给 bridge-host 一份 methodChannel
* 引用，其余细节不需要感知。
*
* ── 反向 RPC / 事件 ──────────────────────────────────────────
*
* 除了正向 wb.* 之外，bridge-host 还负责：
* - `invokeExtension(method, ...args)`：反向调extension 子进程注册的 methods
*   （extension bootstrap 返回的methods 字典）
* - `pushEvent(event, payload)`：走 transport.broadcast 推送宿主事件到 extension
*/
function createExtensionBridgeHost(options) {
	const { subject, authorizer, methodChannel, transport, daemonRpcInvoke } = options;
	const methods = methodChannel.methods();
	const forwardOne = async (channel, ...args) => {
		await authorizer.assertAuthorized({
			subject,
			action: {
				type: "invoke",
				channel
			}
		});
		return methodChannel.invoke(channel, {
			callerId: subject.moduleId,
			subject
		}, ...args);
	};
	const forwardDaemonRpc = async (channel, ...args) => {
		if (!daemonRpcInvoke) throw new Error(`[ExtensionBridgeHost] wb.invoke('${channel}') requires daemonRpcInvoke (装配层未通过 ExtensionBridgeHostOptions.daemonRpcInvoke 注入 daemon RPC 通用调用)`);
		return daemonRpcInvoke(channel, ...args);
	};
	const CONTROL_PLANE_PREFIX = "wb:internal:extension-";
	const dispatchControlPlaneOrFallback = async (channel, ...args) => {
		if (channel.startsWith(CONTROL_PLANE_PREFIX)) {
			const rawPayload = args[0];
			return forwardDaemonRpc(channel, {
				...rawPayload && typeof rawPayload === "object" ? rawPayload : {},
				extensionId: subject.moduleId
			}, ...args.slice(1));
		}
		if (channel.startsWith("wb:")) return forwardOne(channel, ...args);
		return forwardDaemonRpc(channel, ...args);
	};
	if (methods.length === 0) {
		if (!transport.handleAny) throw new Error("[ExtensionBridgeHost] methodChannel.methods() is empty (forward mode) but transport does not implement handleAny —— 请检查装配层是否用了支持 handleAny 的 transport");
		transport.handleAny(async (channel, _untrustedContext, ...args) => dispatchControlPlaneOrFallback(channel, ...args));
	} else {
		for (const channel of methods) transport.handle(channel, async (_untrustedContext, ...args) => forwardOne(channel, ...args));
		if (transport.handleAny) transport.handleAny(async (channel, _untrustedContext, ...args) => dispatchControlPlaneOrFallback(channel, ...args));
	}
	return {
		pushEvent(event, payload) {
			transport.broadcast?.(event, payload);
		},
		invokeExtension(method, ...args) {
			if (!transport.invoke) throw new Error("[ExtensionBridgeHost] transport.invoke not supported");
			return transport.invoke(method, { callerId: HOST_MODULE_ID }, ...args);
		},
		dispose() {
			transport.dispose?.();
		}
	};
}
//#endregion
//#region ../../packages/workbuddy-extensions/src/bridge/transport-process.ts
/**
* 构建一个满足 core `Transport` 接口的对象。两侧共用此实现，
* 差异仅在 send / onMessage 的物理承载（child.send vs process.send）。
*/
function createRpcSide(opts) {
	const { send, onMessage, label } = opts;
	const requestHandlers = /* @__PURE__ */ new Map();
	/**
	* 通配 handler（catch-all）—— per-channel handler map 里查不到时的兜底。
	*
	* 用于 wb.invoke(channel, ...) 逃生舱：extension 侧要能调**任意 daemon RPC channel**
	* （比如 `claw:getWechatmpEnabled`），不能事先 per-channel 挂 handler（channel 集合
	* 是运行时开放的）。装配层挂一个 catch-all 做前缀路由（wb:* 走 methodChannel；
	* 其他走 daemon RPC）。
	*
	* ⚠️ 签名走 core `RequestHandler`（`(channel, ctx, ...args)`）——per-channel handler
	* 用 `ChannelHandler`（channel 已经在 map key 里，不需要 handler 参数带一遍），
	* catch-all 需要 handler 感知 channel 才能路由，所以走 RequestHandler 全签名。
	*/
	let anyHandler;
	let eventHandler;
	let requestCounter = 0;
	const pending = /* @__PURE__ */ new Map();
	const listener = async (raw) => {
		if (!isWireMessage(raw)) return;
		const msg = raw;
		if (msg.type === "invoke:request" && msg.channel && msg.requestId) {
			const perChannelHandler = requestHandlers.get(msg.channel);
			if (!perChannelHandler && !anyHandler) {
				send({
					type: "invoke:response",
					requestId: msg.requestId,
					error: require_server.serializeBridgeError(/* @__PURE__ */ new Error(`[${label}] no handler for channel: ${msg.channel}`))
				});
				return;
			}
			try {
				const [context, ...userArgs] = msg.args ?? [];
				const result = perChannelHandler ? await perChannelHandler(context, ...userArgs) : await anyHandler(msg.channel, context, ...userArgs);
				send({
					type: "invoke:response",
					requestId: msg.requestId,
					result
				});
			} catch (err) {
				send({
					type: "invoke:response",
					requestId: msg.requestId,
					error: require_server.serializeBridgeError(err)
				});
			}
			return;
		}
		if (msg.type === "invoke:response" && msg.requestId) {
			const p = pending.get(msg.requestId);
			if (!p) return;
			pending.delete(msg.requestId);
			if (msg.error !== void 0) try {
				if (require_server.isSerializedBridgeError(msg.error)) require_server.deserializeResult(msg.error);
				else throw new Error(String(msg.error));
			} catch (err) {
				p.reject(err);
			}
			else p.resolve(msg.result);
			return;
		}
		if (msg.type === "event" && msg.event) eventHandler?.(msg.event, msg.payload);
	};
	const detach = onMessage(listener);
	function invoke(channel, context, ...args) {
		return new Promise((resolve, reject) => {
			const requestId = `${label}_req_${++requestCounter}`;
			pending.set(requestId, {
				resolve,
				reject
			});
			try {
				send({
					type: "invoke:request",
					requestId,
					channel,
					args: [context, ...args]
				});
			} catch (err) {
				pending.delete(requestId);
				reject(err instanceof Error ? err : new Error(String(err)));
			}
		});
	}
	return {
		handle(channel, handler) {
			requestHandlers.set(channel, handler);
		},
		handleAny(handler) {
			anyHandler = handler;
		},
		broadcast(event, payload) {
			send({
				type: "event",
				event,
				payload
			});
		},
		invoke,
		on(handler) {
			eventHandler = handler;
		},
		dispose() {
			detach();
			for (const [, p] of pending) p.reject(/* @__PURE__ */ new Error(`[${label}] disposed`));
			pending.clear();
			requestHandlers.clear();
			anyHandler = void 0;
			eventHandler = void 0;
		}
	};
}
/**
* 父进程侧 Transport —— 实现完整的四件套 `handle / broadcast / invoke / on / dispose`。
*
* 使用方式：
* ```ts
* const transport = createProcessHostTransport({ child });
* // Host 收 extension 发来的请求
* transport.handle(methodChannel.invoke);
* // Host 推送事件给 extension
* bus.onAny((event, payload) => transport.broadcast(event, payload));
* // Host 反向调 extension 注册的 method
* await transport.invoke('greet', undefined, { name: 'World' });
* ```
*/
function createProcessHostTransport(options) {
	const { child } = options;
	return createRpcSide({
		label: "ProcessHostTransport",
		send: (msg) => {
			if (child.connected) child.send(msg);
		},
		onMessage: (listener) => {
			child.on("message", listener);
			return () => child.off("message", listener);
		}
	});
}
function isWireMessage(msg) {
	return msg !== null && typeof msg === "object" && "type" in msg && typeof msg.type === "string";
}
//#endregion
//#region ../../packages/workbuddy-extensions/src/runtime/extension-host-manager.ts
/**
* Extension Host Manager —— 管理 extension 子进程的生命周期。
*
* 职责：
* 1. fork extension host 子进程
* 2. 建立 `ProcessHostTransport` → `ExtensionBridgeHost`（基于 core 新 Bridge 协议）
* 3. 装配 hub domain services + 可选的 BridgeAuthorizer 做权限拦截
* 4. 转发 bus 事件到 extension
* 5. 进程退出/崩溃处理
*/
var LOG_BASE_DIR = (0, node_path.join)((0, node_os.homedir)(), ".workbuddy", "logs");
var lastLogDateStr = "";
var cachedLogDir = "";
function todayLogDir() {
	const dateStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
	if (dateStr === lastLogDateStr) return cachedLogDir;
	const dir = (0, node_path.join)(LOG_BASE_DIR, dateStr);
	try {
		(0, node_fs.mkdirSync)(dir, { recursive: true });
	} catch {}
	lastLogDateStr = dateStr;
	cachedLogDir = dir;
	return dir;
}
function memDiagLogPath() {
	return (0, node_path.join)(todayLogDir(), "daemon-memory-diag.log");
}
function extSchedulerLogPath() {
	return (0, node_path.join)(todayLogDir(), "extension-scheduler-diag.log");
}
var trackedChildren = /* @__PURE__ */ new Map();
var memoryTimer;
/** Extension → daemon 请求开始接收某 conversation 的流式事件。走 wb.invoke。 */
var WB_EXTENSION_REQUEST_RECEIVE_STREAMING_CHANNEL = "wb:internal:extension-request-receive-streaming";
/** Extension → daemon 取消接收流式事件。走 wb.invoke。 */
var WB_EXTENSION_CANCEL_RECEIVE_STREAMING_CHANNEL = "wb:internal:extension-cancel-receive-streaming";
var extensionConversationSubscriptions = /* @__PURE__ */ new Map();
/**
* 每个 extension host 的 scheduler 引用注册表。
*
* spawnExtensionHost 在装配 scheduler 之后 register，dispose 时 unregister。
*
* 【为什么需要这份注册表】
* 订阅 request/cancel 通过 daemon RPC 到达（`register-wb-bridge-channels.ts` 里
* `server.handle`），拿到 payload 后需要**直接操作对应 host 的 scheduler**：
* - `scheduler.setCurrentConversationIds([cid])` 把 gate 打开
* - `scheduler.setCurrentConversationIds([SENTINEL])` 关回 gate
*
* scheduler 的 `shouldPublishHighFrequency` 内部会先看 currentConversationIds：
* 只要 has(cid) → 放行；否则走 shouldPublishRequestUpdate 回调（我们也接了做双重校验）。
* 用 currentConversationIds 走 gate 才能绕过 `size === 0 → return true` 那条兜底短路。
*/
var extensionSchedulers = /* @__PURE__ */ new Map();
/**
* scheduler.setCurrentConversationIds 的哨兵 cid。
*
* 【为什么需要】
* scheduler.shouldPublishHighFrequency 有条兜底短路：`currentConversationIds`
* 为空集或 undefined 时**直接放行**（原本是给 renderer 首页空窗兜底的语义）。
* extension 场景要严格 gate —— 未订阅时**必须**让 currentConversationIds 非空且
* 不包含任何真实 cid，走 shouldPublishRequestUpdate 回调返回 false 才能真正 gate。
* 哨兵值就是这条 wire 上"永远不会出现的 cid"，让 currentConversationIds 恒非空。
*/
var EXTENSION_GATE_SENTINEL = "__ext_gate_sentinel__";
/**
* 覆盖式请求接收某 conversation 的流式事件。
* 每次调用作废前一次的关注 cid（单值 set current 语义）。
*
* 【双写】
* 1. subscriptions map：记录订阅关系，供 shouldPublishRequestUpdate 回调做二次校验；
* 2. scheduler.currentConversationIds：真正让 gate 逻辑生效的入口。
*
* ⚠️ 只应由 daemon 侧 `WB_EXTENSION_REQUEST_RECEIVE_STREAMING_CHANNEL` 的 server.handle
* 调用（payload.extensionId 已由 extension bridge-host host-sign）。不要在其他地方
* 直接调用本函数 —— 否则绕过 host-sign 环节等于给外部可控数据开了后门。
*/
function requestExtensionReceiveStreaming(payload) {
	extensionConversationSubscriptions.set(payload.extensionId, payload.conversationId);
	extensionSchedulers.get(payload.extensionId)?.setCurrentConversationIds([payload.conversationId]);
}
/**
* 取消接收流式事件。清空该 extension 的关注。
*
* ⚠️ 只应由 daemon 侧 `WB_EXTENSION_CANCEL_RECEIVE_STREAMING_CHANNEL` 的 server.handle
* 或 spawnExtensionHost 的 child.on('exit') / dispose 路径调用。
*/
function cancelExtensionReceiveStreaming(payload) {
	extensionConversationSubscriptions.delete(payload.extensionId);
	extensionSchedulers.get(payload.extensionId)?.setCurrentConversationIds([EXTENSION_GATE_SENTINEL]);
}
/** 用于 scheduler 门控闭包读取；封装成函数是为了避免闭包捕获 Map 引用带来的心智负担。 */
function isConversationSubscribedByExtension(extensionId, conversationId) {
	return extensionConversationSubscriptions.get(extensionId) === conversationId;
}
function readChildWriteQueue(c) {
	const anyChild = c;
	const channel = anyChild.channel;
	const stdout = anyChild.stdout;
	const stderr = anyChild.stderr;
	const readNum = (v) => typeof v === "number" ? v : void 0;
	const cHandle = anyChild._handle;
	const chHandle = channel?._handle;
	const _channelHandle = anyChild._channel?._handle;
	const ipcWq = readNum(cHandle?.writeQueueSize) ?? readNum(chHandle?.writeQueueSize) ?? readNum(_channelHandle?.writeQueueSize) ?? readNum(channel?.writeQueueSize);
	const soHandle = stdout?._handle;
	const stdoutWq = readNum(soHandle?.writeQueueSize) ?? readNum(stdout?.writableLength);
	const seHandle = stderr?._handle;
	return {
		ipcWq,
		stdoutWq,
		stderrWq: readNum(seHandle?.writeQueueSize) ?? readNum(stderr?.writableLength)
	};
}
function ensureMemorySamplerStarted() {
	if (memoryTimer) return;
	const runOnce = () => {
		try {
			const mem = process.memoryUsage();
			const rssMB = (mem.rss / 1024 / 1024).toFixed(1);
			const heapUsedMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
			const heapTotalMB = (mem.heapTotal / 1024 / 1024).toFixed(1);
			const externalMB = (mem.external / 1024 / 1024).toFixed(1);
			const arrayBufMB = (mem.arrayBuffers / 1024 / 1024).toFixed(1);
			const sysFreeMB = ((0, node_os.freemem)() / 1024 / 1024).toFixed(0);
			const sysTotalMB = ((0, node_os.totalmem)() / 1024 / 1024).toFixed(0);
			const childInfos = [];
			for (const [pid, entry] of trackedChildren) {
				const { ipcWq, stdoutWq, stderrWq } = readChildWriteQueue(entry.child);
				childInfos.push(`${entry.manifestId}(pid=${pid} conn=${entry.child.connected} ipcWq=${ipcWq !== void 0 ? (ipcWq / 1024 / 1024).toFixed(2) + "MB" : "N/A"}${stdoutWq ? ` stdoutWq=${stdoutWq}B` : ""}${stderrWq ? ` stderrWq=${stderrWq}B` : ""})`);
			}
			(0, node_fs.appendFileSync)(memDiagLogPath(), `[${(/* @__PURE__ */ new Date()).toISOString()}] rss=${rssMB}MB heap=${heapUsedMB}/${heapTotalMB}MB external=${externalMB}MB arrayBuf=${arrayBufMB}MB sysFree=${sysFreeMB}/${sysTotalMB}MB children=[${childInfos.join(", ")}]\n`);
			const ts = (/* @__PURE__ */ new Date()).toISOString();
			for (const [extensionId, scheduler] of extensionSchedulers) try {
				const snap = scheduler.snapshotObservability();
				const curIds = scheduler.getCurrentConversationIds();
				let curLabel;
				if (curIds === void 0) curLabel = "undef";
				else if (curIds.length === 0) curLabel = "empty";
				else if (curIds.length === 1 && curIds[0] === EXTENSION_GATE_SENTINEL) curLabel = "SENTINEL(gate-all)";
				else curLabel = curIds.map((c) => c.slice(0, 8)).join(",");
				(0, node_fs.appendFileSync)(extSchedulerLogPath(), `[${ts}] [ext=${extensionId}] current=${curLabel} received=${snap.sched.received} gated=${snap.sched.gatedFrames} immSent=${snap.sched.immediateSent} batch=${snap.sched.batchedFrames} toolThr=${snap.sched.toolThrottledFrames} toolSnt=${snap.sched.toolThrottleSent} chThr=${snap.sched.childThrottledFrames} chSnt=${snap.sched.childThrottleSent} artThr=${snap.sched.artifactThrottledFrames} artSnt=${snap.sched.artifactThrottleSent} pending=text${snap.pending.text}+child${snap.pending.child}+tool${snap.pending.tool}+art${snap.pending.artifact}\n`);
			} catch {}
		} catch {}
		memoryTimer = setTimeout(runOnce, 5e3);
		memoryTimer.unref?.();
	};
	memoryTimer = setTimeout(runOnce, 5e3);
	memoryTimer.unref?.();
}
/**
* 启动一个 extension host 子进程，建立 bridge 通信，返回 handle。
*/
function spawnExtensionHost(manifest, deps) {
	const { methodChannel, bus, authorizer, daemonRpcInvoke, extraNodePaths } = deps;
	const nodePathSep = process.platform === "win32" ? ";" : ":";
	const mergedNodePath = extraNodePaths && extraNodePaths.length > 0 ? [...extraNodePaths, process.env.NODE_PATH ?? ""].filter(Boolean).join(nodePathSep) : process.env.NODE_PATH;
	const child = (0, node_child_process.fork)(manifest.main, [], {
		stdio: [
			"pipe",
			"pipe",
			"pipe",
			"ipc"
		],
		env: {
			...process.env,
			...mergedNodePath ? { NODE_PATH: mergedNodePath } : {},
			WB_EXTENSION_ID: manifest.id
		}
	});
	if (child.pid) {
		trackedChildren.set(child.pid, {
			manifestId: manifest.id,
			child
		});
		const pidToRemove = child.pid;
		child.once("exit", () => {
			trackedChildren.delete(pidToRemove);
		});
	}
	ensureMemorySamplerStarted();
	const forwardStream = (stream) => (chunk) => {
		const lines = chunk.toString("utf-8").split("\n");
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (i === lines.length - 1 && line === "") continue;
			bus.emit("extension.log", {
				extensionId: manifest.id,
				pid: child.pid,
				stream,
				text: line,
				timestamp: Date.now()
			});
		}
	};
	child.stdout?.on("data", forwardStream("stdout"));
	child.stderr?.on("data", forwardStream("stderr"));
	child.stdout?.on("data", (chunk) => {
		console.log(`[ext-stdout:${manifest.id}:${child.pid}]`, chunk.toString("utf-8").trimEnd());
	});
	child.stderr?.on("data", (chunk) => {
		console.error(`[ext-stderr:${manifest.id}:${child.pid}]`, chunk.toString("utf-8").trimEnd());
	});
	const transport = createProcessHostTransport({ child });
	const host = createExtensionBridgeHost({
		subject: {
			moduleId: manifest.id,
			type: "extension",
			kind: manifest.builtin ? "builtin" : "platform",
			scopes: []
		},
		authorizer,
		methodChannel,
		transport,
		daemonRpcInvoke
	});
	const extensionEventScheduler = new require_server.ConversationEventPushScheduler({
		push: (event, payload) => host.pushEvent(event, payload),
		shouldPublishRequestUpdate: (conversationId) => isConversationSubscribedByExtension(manifest.id, conversationId)
	});
	extensionEventScheduler.setCurrentConversationIds([EXTENSION_GATE_SENTINEL]);
	extensionSchedulers.set(manifest.id, extensionEventScheduler);
	const unsubBus = bus.onAny((event, payload) => {
		extensionEventScheduler.publish(event, payload);
	});
	let readyResolve;
	let readyReject;
	let readyDone = false;
	const ready = new Promise((resolve, reject) => {
		readyResolve = () => {
			readyDone = true;
			resolve();
		};
		readyReject = (err) => {
			readyDone = true;
			reject(err);
		};
	});
	const readyTimeout = setTimeout(() => {
		if (!readyDone) {
			console.warn(`[ExtensionHost] "${manifest.id}" did not send ready signal within 10s; proceeding anyway (may hit "no request handler attached" race on first invoke). Update the extension bootstrap to use latest @genie/workbuddy-extensions/runtime.`);
			readyResolve();
		}
	}, 1e4);
	const onChildMessage = (msg) => {
		if (msg && typeof msg === "object" && msg.type === "wb-extension-ready") {
			clearTimeout(readyTimeout);
			readyResolve();
			child.off("message", onChildMessage);
		}
	};
	child.on("message", onChildMessage);
	let exitResolve;
	const exitPromise = new Promise((resolve) => {
		exitResolve = resolve;
	});
	let exited = false;
	child.on("exit", (code, signal) => {
		exited = true;
		console.log(`[ExtensionHost] "${manifest.id}" exited (code=${code}, signal=${signal})`);
		clearTimeout(readyTimeout);
		if (!readyDone) readyReject(/* @__PURE__ */ new Error(`[ExtensionHost] "${manifest.id}" exited before ready (code=${code}, signal=${signal})`));
		unsubBus();
		extensionEventScheduler.dispose();
		extensionConversationSubscriptions.delete(manifest.id);
		extensionSchedulers.delete(manifest.id);
		exitResolve();
	});
	let disposePromise = null;
	return {
		id: manifest.id,
		host,
		process: child,
		ready,
		dispose() {
			if (disposePromise) return disposePromise;
			disposePromise = (async () => {
				clearTimeout(readyTimeout);
				unsubBus();
				extensionEventScheduler.dispose();
				extensionConversationSubscriptions.delete(manifest.id);
				extensionSchedulers.delete(manifest.id);
				host.dispose();
				if (exited) return;
				try {
					child.kill("SIGTERM");
				} catch (err) {
					console.warn(`[ExtensionHost] "${manifest.id}" SIGTERM failed:`, err);
				}
				const KILL_TIMEOUT_MS = 3e3;
				const killTimer = setTimeout(() => {
					if (!exited) {
						console.warn(`[ExtensionHost] "${manifest.id}" did not exit within ${KILL_TIMEOUT_MS}ms after SIGTERM, sending SIGKILL`);
						try {
							child.kill("SIGKILL");
						} catch (err) {
							console.error(`[ExtensionHost] "${manifest.id}" SIGKILL failed:`, err);
						}
					}
				}, KILL_TIMEOUT_MS);
				await exitPromise;
				clearTimeout(killTimer);
			})();
			return disposePromise;
		}
	};
}
//#endregion
//#region ../../packages/workbuddy-extensions/src/runtime/extension-registry.ts
/**
* Extension Registry —— extensions 包的核心管理器。
*
* 职责：
* 1. 扫描指定目录下的 extension（读 extension.json + distribution.json）
* 2. 注册到内部 registry
* 3. 按 activationEvents 决定激活时机
* 4. 调 spawnExtensionHost fork 子进程
* 5. 管理生命周期（activate / deactivate / dispose）
* 6. 对外暴露查询接口（listExtensions / getExtension / status）
*
* 设计要点：
* - desktop 侧只需要 createExtensionRegistry + addScanPath + activate + dispose
* - extensions 包自己写测试时，mock services + bus 就能完整跑通
* - 后续云端拉取分发信息也在这里做（复用 core 的 http 能力）
*/
function createExtensionRegistry(deps) {
	const { methodChannel: methodChannelInput, bus, logger = console, guardian, guardianBudgets } = deps;
	const guardianId = (extId) => `ext:${extId}`;
	const resolveMethodChannel = typeof methodChannelInput === "function" ? methodChannelInput : () => methodChannelInput;
	const scanPaths = [];
	const extensions = /* @__PURE__ */ new Map();
	function addScanPath(dir) {
		scanPaths.push(dir);
	}
	/**
	* 扫描所有 scan paths，发现 extension 并注册到 registry。
	* 每个子目录如果包含 extension.json，就视为一个 extension。
	*/
	function scan() {
		for (const scanDir of scanPaths) {
			if (!(0, node_fs.existsSync)(scanDir)) continue;
			const entries = (0, node_fs.readdirSync)(scanDir, { withFileTypes: true });
			for (const entry of entries) {
				if (!entry.isDirectory()) continue;
				const extDir = node_path.join(scanDir, entry.name);
				const manifestPath = node_path.join(extDir, "extension.json");
				if (!(0, node_fs.existsSync)(manifestPath)) continue;
				try {
					const manifest = JSON.parse((0, node_fs.readFileSync)(manifestPath, "utf-8"));
					const distPath = node_path.join(extDir, "distribution.json");
					const distribution = (0, node_fs.existsSync)(distPath) ? JSON.parse((0, node_fs.readFileSync)(distPath, "utf-8")) : createDefaultDistribution(manifest.id, manifest.version);
					const serverEntry = resolveServerEntry(extDir, manifest);
					extensions.set(manifest.id, {
						manifest,
						distribution,
						basePath: extDir,
						serverEntry,
						enabled: true,
						state: "registered",
						handle: null
					});
				} catch (err) {
					logger.error(`[ExtensionRegistry] failed to parse extension at ${extDir}:`, err);
				}
			}
		}
	}
	/**
	* 激活单个 extension（幂等 —— 已 active 直接返回）。
	*
	* `emitLifecycleEvent` 会把 state 变化通过 bus 推给 UI，UI 无需轮询即可实时更新。
	*/
	async function activateOne(id, options = {}) {
		const ext = extensions.get(id);
		if (!ext) throw new Error(`[ExtensionRegistry] extension not registered: ${id}`);
		if (!ext.enabled) throw new Error(`[ExtensionRegistry] extension "${id}" is disabled by user; call setEnabled(id, true) first`);
		if (ext.state === "active" || ext.state === "activating") return ext;
		if (!options.force && ext.distribution.status !== "active") throw new Error(`[ExtensionRegistry] extension "${id}" distribution status is "${ext.distribution.status}"`);
		if (!ext.serverEntry) {
			ext.state = "active";
			ext.error = void 0;
			logger.info(`[ExtensionRegistry] ${id} activated (renderer-only, no server fork; skip guardian)`);
			emitLifecycleEvent(ext);
			return ext;
		}
		ext.state = "activating";
		ext.error = void 0;
		emitLifecycleEvent(ext);
		try {
			const handle = spawnExtensionHost({
				id: ext.manifest.id,
				name: ext.manifest.name,
				main: ext.serverEntry,
				builtin: ext.distribution.kind === "builtin",
				permissions: ext.distribution.grantedPermissions
			}, {
				methodChannel: resolveMethodChannel(),
				bus,
				authorizer: deps.authorizer,
				daemonRpcInvoke: deps.daemonRpcInvoke,
				extraNodePaths: deps.extraNodePaths
			});
			ext.handle = handle;
			logger.info(`[ExtensionRegistry] ${id} forked, pid=${handle.process.pid} — waiting ready`);
			handle.process.once("exit", (code, signal) => {
				if (ext.handle !== handle) return;
				ext.handle = null;
				ext.state = code === 0 || signal === "SIGTERM" ? "deactivated" : "failed";
				if (ext.state === "failed") ext.error = `unexpected exit code=${code} signal=${signal}`;
				unregisterFromGuardian(ext.manifest.id, "manual");
				emitLifecycleEvent(ext);
			});
			await handle.ready;
			ext.state = "active";
			logger.info(`[ExtensionRegistry] ${id} ready, pid=${handle.process.pid}`);
			registerToGuardian(ext);
			emitLifecycleEvent(ext);
			return ext;
		} catch (err) {
			ext.state = "failed";
			ext.error = err instanceof Error ? err.message : String(err);
			const errMsg = err instanceof Error ? err.message : String(err);
			const errStack = err instanceof Error ? err.stack : void 0;
			logger.error(`[ExtensionRegistry] ${id} activation failed: ${errMsg}\n${errStack ?? "(no stack)"}`);
			emitLifecycleEvent(ext);
			throw err;
		}
	}
	/**
	* @deprecated 兼容旧调用：遍历所有 status=active 的 extension 全部激活。
	* 不查 activationEvents，不区分 lazy —— 上层应改用 `activateByEvent('onStartup')`
	* 或让 `wb.extensions.invoke` 触发 lazy 激活。
	*/
	async function activate() {
		for (const [id, ext] of extensions) {
			if (ext.distribution.status !== "active") continue;
			if (ext.state === "active" || ext.state === "activating") continue;
			try {
				await activateOne(id);
			} catch {}
		}
	}
	/**
	* 事件驱动激活 —— 见接口注释。framework 无业务感知，只做"查表 + 逐个 activateOne"。
	*
	* 匹配规则：`manifest.service?.activationEvents` 数组里精确 includes(event)。
	* 纯 UI extension（无 service 段）永远不匹配任何事件。
	* 未来若引入通配（如 `onCommand:tdocs.*`），在此函数扩展匹配逻辑即可，
	* `activateOne` 那侧不用动。
	*/
	async function activateByEvent(event) {
		const hits = [];
		for (const [id, ext] of extensions) {
			const events = ext.manifest.service?.activationEvents ?? [];
			const distStatus = ext.distribution.status;
			const state = ext.state;
			const matched = events.includes(event);
			if (distStatus !== "active") continue;
			if (!ext.enabled) continue;
			if (state === "active" || state === "activating") continue;
			if (!matched) continue;
			hits.push(id);
		}
		if (hits.length === 0) {
			logger.info(`[ExtensionRegistry] activateByEvent('${event}') matched 0 extension`);
			return;
		}
		logger.info(`[ExtensionRegistry] activateByEvent('${event}') matched ${hits.length} extension(s): ${hits.join(", ")}`);
		for (const id of hits) try {
			await activateOne(id);
		} catch {}
	}
	/**
	* 停用单个 extension —— 杀子进程 + 释放 handle。
	* `resident=true` 的 extension 需要 `force` 才能停。
	*/
	async function deactivateOne(id, options = {}) {
		const ext = extensions.get(id);
		if (!ext) throw new Error(`[ExtensionRegistry] extension not registered: ${id}`);
		if (ext.distribution.resident && !options.force) throw new Error(`[ExtensionRegistry] extension "${id}" is resident, cannot deactivate (pass force=true to override)`);
		if (!ext.handle) {
			if (ext.state !== "deactivated") {
				ext.state = "deactivated";
				emitLifecycleEvent(ext);
			}
			return ext;
		}
		ext.state = "deactivating";
		emitLifecycleEvent(ext);
		unregisterFromGuardian(id, "manual");
		await ext.handle.dispose();
		ext.handle = null;
		ext.state = "deactivated";
		logger.info(`[ExtensionRegistry] ${id} deactivated`);
		emitLifecycleEvent(ext);
		return ext;
	}
	/**
	* 注册当前 extension 到 Guardian —— 只在 state 变为 `active` 后调用。
	*
	* Guardian.handle.dispose 通过 `deactivateOne(id, {force: true})` 路由回 registry：
	* - Idle 驱逐时 Guardian 会调 handle.dispose → registry 走完整停用流程
	* - `distribution.resident=true` 映射为 `pin='resident'`，Guardian 不会 idle 驱逐它
	*
	* 未挂 Guardian 时是 no-op。
	*/
	function registerToGuardian(ext) {
		if (!guardian) return;
		try {
			let budgets = [];
			if (guardianBudgets) try {
				budgets = guardianBudgets(ext);
			} catch (err) {
				logger.warn(`[ExtensionRegistry] guardianBudgets(${ext.manifest.id}) threw:`, err);
				budgets = [];
			}
			guardian.register({
				id: guardianId(ext.manifest.id),
				runtimeKind: "extension",
				pin: ext.distribution.resident ? "resident" : "idle-evictable",
				handle: { dispose: async () => {
					await deactivateOne(ext.manifest.id, { force: true });
				} },
				budgets
			});
		} catch (err) {
			const detail = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
			logger.warn(`[ExtensionRegistry] guardian.register failed for ${ext.manifest.id}: ${detail}`);
		}
	}
	/** 从 Guardian 中注销（幂等）。未挂 Guardian 或未注册均是 no-op。 */
	function unregisterFromGuardian(extId, reason = "manual") {
		if (!guardian) return;
		try {
			guardian.unregister(guardianId(extId), reason);
		} catch (err) {
			logger.warn(`[ExtensionRegistry] guardian.unregister failed for ${extId}:`, err);
		}
	}
	/**
	* 通知 Guardian 该 extension 刚发生活动。见 interface 注释。
	* 未挂 Guardian 时是 no-op；未注册 id 时 Guardian 内部也静默处理。
	*/
	function markActive(id) {
		if (!guardian) return;
		guardian.markActive(guardianId(id));
	}
	/**
	* 生命周期事件 —— 每次 state 变化广播一次，UI 订阅 `extension.lifecycle` 实时更新。
	*/
	function emitLifecycleEvent(ext) {
		bus.emit("extension.lifecycle", {
			extensionId: ext.manifest.id,
			state: ext.state,
			enabled: ext.enabled,
			pid: ext.handle?.process.pid,
			error: ext.error,
			timestamp: Date.now()
		});
	}
	/**
	* 设置 extension 启用/禁用状态。
	*
	* 切到 `false` 且 service 在跑：先 force-deactivate 释放子进程，再置 enabled。
	* 切到 `true`：不主动 activate，等 activationEvents / invoke 触发；只发一次 lifecycle 事件通知 UI 刷新。
	*/
	async function setEnabled(id, enabled) {
		const ext = extensions.get(id);
		if (!ext) throw new Error(`[ExtensionRegistry] extension not registered: ${id}`);
		if (ext.enabled === enabled) return ext;
		if (!enabled && ext.handle) try {
			await deactivateOne(id, { force: true });
		} catch (err) {
			logger.error(`[ExtensionRegistry] setEnabled(${id}, false): failed to deactivate service:`, err);
		}
		ext.enabled = enabled;
		logger.info(`[ExtensionRegistry] ${id} ${enabled ? "enabled" : "disabled"}`);
		emitLifecycleEvent(ext);
		return ext;
	}
	/**
	* 重载单个 extension —— 开发期热更新入口。
	*
	* 流程：
	* 1. 若在跑 → force deactivate（复用 deactivateOne）
	* 2. 从 basePath 重新读磁盘（manifest.json + distribution.json）
	* 3. 替换 registry 里的记录，**保留** `enabled` 用户偏好
	* 4. 广播 lifecycle 事件让 UI 刷新
	* 5. 不主动 activate —— lazy activate 按 invoke / activationEvents 触发
	*/
	async function reload(id) {
		const prev = extensions.get(id);
		if (!prev) throw new Error(`[ExtensionRegistry] reload: extension not registered: ${id}`);
		const extDir = prev.basePath;
		const manifestPath = node_path.join(extDir, "extension.json");
		if (!(0, node_fs.existsSync)(manifestPath)) throw new Error(`[ExtensionRegistry] reload: manifest missing at ${manifestPath}`);
		logger.info(`[ExtensionRegistry] reload ${id} — deactivate → rescan → replace`);
		if (prev.handle) try {
			await deactivateOne(id, { force: true });
		} catch (err) {
			logger.error(`[ExtensionRegistry] reload ${id}: deactivate failed (continue anyway):`, err);
		}
		let manifest;
		let distribution;
		try {
			manifest = JSON.parse((0, node_fs.readFileSync)(manifestPath, "utf-8"));
			const distPath = node_path.join(extDir, "distribution.json");
			distribution = (0, node_fs.existsSync)(distPath) ? JSON.parse((0, node_fs.readFileSync)(distPath, "utf-8")) : createDefaultDistribution(manifest.id, manifest.version);
		} catch (err) {
			throw new Error(`[ExtensionRegistry] reload ${id}: failed to parse extension.json / distribution.json: ${err instanceof Error ? err.message : String(err)}`);
		}
		const serverEntry = resolveServerEntry(extDir, manifest);
		const next = {
			manifest,
			distribution,
			basePath: extDir,
			serverEntry,
			enabled: prev.enabled,
			state: "registered",
			handle: null
		};
		extensions.set(id, next);
		emitLifecycleEvent(next);
		logger.info(`[ExtensionRegistry] ${id} reloaded, serverEntry=${serverEntry ?? "<null>"}`);
		return next;
	}
	function list() {
		return Array.from(extensions.values());
	}
	function get(id) {
		return extensions.get(id);
	}
	function dispose() {
		for (const [id, ext] of extensions) {
			unregisterFromGuardian(id, "manual");
			if (ext.handle) {
				ext.handle.dispose();
				ext.handle = null;
				ext.state = "deactivated";
				logger.info(`[ExtensionRegistry] ${id} disposed`);
			}
		}
	}
	return {
		addScanPath,
		scan,
		activate,
		activateByEvent,
		activateOne,
		deactivateOne,
		markActive,
		list,
		get,
		setEnabled,
		reload,
		dispose
	};
}
/**
* 解析 extension server 入口的绝对路径。
* 优先找 pkg/server/index.cjs（构建产物），fallback 到 manifest 声明的 runtime.server.entry。
*/
/**
* 解析 extension 的 server 入口。
*
* 目标形态 flat 布局：`<extDir>/server/index.cjs`（extDir 已经是 dist/<id>/）。
* 若 manifest 显式声明 `service.entry`，尊重之。
*
* @returns 绝对路径；无 server 或产物缺失返回 null（scan 仍成功，activate 会 skip）。
*/
function resolveServerEntry(extDir, manifest) {
	const declared = manifest.service?.entry;
	if (declared) {
		const resolved = node_path.resolve(extDir, declared);
		if ((0, node_fs.existsSync)(resolved)) return resolved;
	}
	const conventional = node_path.join(extDir, "server", "index.cjs");
	if ((0, node_fs.existsSync)(conventional)) return conventional;
	return null;
}
/**
* 缺 `distribution.json` 时的默认值 —— **最保守**（缺声明 = 什么都不给）。
*
* 反直觉但正确：如果 default 是 builtin/全通，那么"忘记补 distribution.json"就等于
* 静默把 extension 提升到最高权限。永远不能让"漏配置"变成"漏授权"。
*
* builtin 必须通过 distribution.json 显式声明 `kind: 'builtin'` 才拿全权限。
*/
function createDefaultDistribution(extensionId, version) {
	return {
		extensionId,
		version,
		kind: "platform",
		grantedPermissions: [],
		processPolicy: {
			server: "fork",
			renderer: null
		},
		rollout: {
			strategy: "full",
			percentage: 100
		},
		status: "active"
	};
}
//#endregion
//#region src/main/startup-steps/first-screen-signal-channels.ts
/**
* [TEMP-EXPERIMENT #84300] 首屏本地列表渲染完成信号的跨进程 channel 常量。
*
* 单独成文件（无 electron / daemon 依赖），供三方共享而不互相拉入对方的运行时依赖：
*   - main 侧 first-screen-rendered-signal.ts（含 electron ipcMain）；
*   - daemon 侧 register-wb-bridge-channels.ts（daemon 子进程，不能 import electron）；
*   - preload / renderer 侧只用字符串字面量，不 import 本文件（避免把 main 模块拉进 preload）。
*
* 实验完需还原（移除本文件与相关接线）。
*/
/** renderer → main：首屏本地列表已渲染完成 IPC 通道。 */
var RENDERER_FIRST_LOCAL_LIST_RENDERED_CHANNEL = "renderer:signalFirstLocalListRendered";
/** main → daemon：转发首屏列表渲染完成，供 daemon firstLocalListReady 门 resolve 的 RPC channel。 */
var DAEMON_FIRST_LOCAL_LIST_RENDERED_CHANNEL = "startup:firstLocalListRendered";
//#endregion
//#region ../../packages/workbuddy-core/src/infra/guardian/decision-log.ts
var DecisionLog = class {
	buffer = [];
	maxSize;
	/** 下一个写入位置（环形游标） */
	cursor = 0;
	constructor(maxSize) {
		this.maxSize = Math.max(1, maxSize);
	}
	/**
	* 追加一条记录。超出容量则覆盖最旧的条目。
	*/
	append(entry) {
		if (this.buffer.length < this.maxSize) this.buffer.push(entry);
		else {
			this.buffer[this.cursor] = entry;
			this.cursor = (this.cursor + 1) % this.maxSize;
		}
	}
	/**
	* 导出全部记录（按时间顺序，最旧的在前）。
	*
	* 每次调用都返回新数组，调用方可自行 filter / slice 不必担心影响内部状态。
	*/
	export() {
		if (this.buffer.length < this.maxSize) return [...this.buffer];
		return [...this.buffer.slice(this.cursor), ...this.buffer.slice(0, this.cursor)];
	}
	/** 清空（测试 / 手动重置用）。 */
	clear() {
		this.buffer.length = 0;
		this.cursor = 0;
	}
	/** 当前条目数（用于测试与调试）。 */
	get size() {
		return this.buffer.length;
	}
};
//#endregion
//#region ../../packages/workbuddy-core/src/infra/guardian/guardian.ts
/**
* ResourceGuardian —— 中心化实例资源调度器（Policy 层主实现）。
*
* ═══════════════════════════════════════════════════════════════════
* Phase 1 范围（对齐 DESIGN.md § 分期落地 · 第一期）
* ═══════════════════════════════════════════════════════════════════
*
* ✅ ManagedInstance 数据结构 + register / unregister
* ✅ markActive（活动信号更新 lastActiveAt）
* ✅ 路径 A：Idle 驱逐（TTL 巡检 + pin 保护 + 幂等竞态处理）
* ✅ 事件契约：registered / evicted（violation / pressure 待 Phase 2/3）
* ✅ Sampler / Action 注册表（接口就位，Phase 1 内部尚未激活违约判定）
* ✅ 决策日志 ring buffer
*
* ⏳ Phase 2：路径 B 违约驱逐（pidusage / memory.rss / graceMs 判定）
* ⏳ Phase 3：路径 C 系统压力驱逐（os.freemem / 候选打分 / 消抖冷却）
*
* ═══════════════════════════════════════════════════════════════════
* 关键约束
* ═══════════════════════════════════════════════════════════════════
*
* - **Policy 层不感知运行时**：只处理数字 / 时间戳 / 抽象句柄，不 import
*   `node:child_process` / `pidusage` / DOM 等。Adapter 各自实现 dispose / sample。
* - **dispose 必须幂等**：驱逐进行中被 markActive 抢占会触发状态修复，Adapter
*   侧要能容忍重复调用。
* - **单进程单实例**：不做跨进程 Guardian 集群协调。
*/
var DEFAULT_IDLE_TIMEOUT_MS = 600 * 1e3;
var DEFAULT_IDLE_CHECK_INTERVAL_MS = 60 * 1e3;
/**
* 违约巡检周期（默认 1s）——比 idle 巡检快，因为内存/CPU 飙升需要快速响应。
* Sampler 各自的 `intervalMs` 目前是"建议"值，简化版还没做每 sampler 独立调度。
*/
var DEFAULT_VIOLATION_CHECK_INTERVAL_MS = 1e3;
var DEFAULT_DECISION_LOG_SIZE = 200;
/** 0 = 不限；装配层需要显式声明池上限（比如 desktop 场景传 `poolSize: 2`）。 */
var DEFAULT_POOL_SIZE = 0;
var ResourceGuardian = class {
	slots = /* @__PURE__ */ new Map();
	samplers = /* @__PURE__ */ new Map();
	actions = /* @__PURE__ */ new Map();
	decisionLog;
	bus;
	/**
	* 事件命名空间。用于**多实例共享同一 bus** 场景下事件隔离。
	*
	* - 未提供（缺省） → emit `guardian.registered` / `guardian.evicted` / ...（老行为）
	* - 提供 `'extension'` → emit `guardian.extension.registered` / `guardian.extension.evicted` / ...
	*
	* 场景：extension 侧 `new Guardian({namespace:'extension'})`、container 侧
	* `new Guardian({namespace:'container'})`，两个 Guardian 挂同一 bus 时事件互不串。
	* UI 侧监听按需拼前缀。
	*/
	namespace;
	config;
	/**
	* 池上限。0 表示不限。可通过 `setPoolSize()` 动态扩容 / 缩容；缩容不会主动驱逐，
	* 只是让下一次 register 更容易触发容量判定。
	*/
	poolSize;
	/**
	* 池满且全 resident 时的扩容策略回调；未提供 → Guardian 直接拒绝新 register。
	*/
	onCapacityExceeded;
	logger;
	/** Idle 巡检定时器句柄；`dispose()` 时清理。 */
	idleTimer;
	/** 已 dispose 标志——之后所有操作抛错，避免僵尸调用。 */
	disposed = false;
	constructor(deps = {}) {
		this.bus = deps.bus ?? require_tar.getBus();
		this.namespace = deps.namespace;
		this.logger = deps.logger ?? console;
		this.poolSize = Math.max(0, deps.config?.poolSize ?? DEFAULT_POOL_SIZE);
		this.onCapacityExceeded = deps.config?.onCapacityExceeded;
		this.config = {
			idleTimeoutMs: deps.config?.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS,
			idleCheckIntervalMs: deps.config?.idleCheckIntervalMs ?? DEFAULT_IDLE_CHECK_INTERVAL_MS,
			violationCheckIntervalMs: deps.config?.violationCheckIntervalMs ?? DEFAULT_VIOLATION_CHECK_INTERVAL_MS,
			decisionLogSize: deps.config?.decisionLogSize ?? DEFAULT_DECISION_LOG_SIZE
		};
		this.decisionLog = new DecisionLog(this.config.decisionLogSize);
		this.registerBuiltinActions();
		this.startIdleCheck();
		this.startViolationCheck();
	}
	/**
	* 注册一个被托管实例。
	*
	* 校验 & 副作用：
	* 1. `budgets[*].resource` 必须有对应 Sampler 注册（Phase 1 内部尚未激活违约
	*    判定，但校验先立起来避免"声明了但没采样"的隐蔽 bug）。
	* 2. **池容量判定**（若 `poolSize > 0`）：
	*    - 未满 → 直接注册
	*    - 已满 且 池内存在可淘汰的非 resident 实例 → 挑 lastActiveAt 最早的一个淘汰
	*      （reason = 'capacity'），腾出空间后继续注册当前实例
	*    - 已满 且 全 resident：
	*      - 若 `onCapacityExceeded` 返回 `> current` 的新上限 → 扩容后放行
	*      - 否则拒绝 register，emit `guardian.capacityExceeded` 并抛错
	*
	* ⚠️ 相同 id 重复 register 会抛错，避免静默替换 handle 导致老实例泄漏。
	* ⚠️ 淘汰旧实例走 fire-and-forget dispose —— register 保持同步语义；如果调用方
	*    需要"确认旧实例真死了再拉新的"，应显式调 `evict(id)` 后再 `register()`。
	*/
	register(params) {
		this.ensureAlive();
		if (this.slots.has(params.id)) throw new Error(`[Guardian] instance already registered: ${params.id}`);
		const requestedBudgets = params.budgets ?? [];
		const budgets = [];
		for (const b of requestedBudgets) if (this.samplers.has(b.resource)) budgets.push(b);
		else this.logger?.warn?.(`[Guardian] budget "${b.resource}" for instance=${params.id} skipped: sampler not registered. Budget will auto-activate when sampler is registered.`);
		this.enforceCapacity(params.id);
		const now = Date.now();
		const instance = {
			id: params.id,
			runtimeKind: params.runtimeKind,
			pin: params.pin ?? "idle-evictable",
			isolation: params.isolation ?? "strict",
			budgets,
			lastActiveAt: now,
			registeredAt: now
		};
		this.slots.set(params.id, {
			instance,
			handle: params.handle,
			evicting: false,
			violationSince: /* @__PURE__ */ new Map()
		});
		const payload = {
			id: instance.id,
			runtimeKind: instance.runtimeKind
		};
		this.emitEvent("registered", payload);
	}
	/**
	* 容量兜底 —— 在 register 阶段判定并执行淘汰 / 扩容。
	*
	* 语义（`register()` 调用一次）：
	* - `poolSize <= 0` → no-op（不限）
	* - 未满 → no-op
	* - 已满 + 存在可淘汰非 resident → LRU 淘汰 1 个（reason='capacity'）
	* - 已满 + 全 resident + 有 `onCapacityExceeded` 且返回 > 当前 → 扩容后放行
	* - 已满 + 全 resident + 无扩容路径 → emit `guardian.capacityExceeded` + 抛错
	*
	* @throws 当池已满且全 resident 且未通过扩容回调放行时抛错。
	*/
	enforceCapacity(incomingId) {
		if (this.poolSize <= 0) return;
		if (this.slots.size < this.poolSize) return;
		const candidates = [];
		for (const slot of this.slots.values()) {
			if (slot.instance.pin === "resident") continue;
			if (slot.evicting) continue;
			candidates.push(slot);
		}
		candidates.sort((a, b) => a.instance.lastActiveAt - b.instance.lastActiveAt);
		if (candidates.length > 0) {
			this.evictForCapacity(candidates[0], incomingId);
			return;
		}
		const currentIds = Array.from(this.slots.keys());
		const residentIds = Array.from(this.slots.values()).filter((s) => s.instance.pin === "resident").map((s) => s.instance.id);
		const current = this.poolSize;
		let expanded;
		if (this.onCapacityExceeded) try {
			expanded = this.onCapacityExceeded({
				current,
				rejectedId: incomingId,
				residentIds
			});
		} catch (err) {
			this.logger.error(`[Guardian] onCapacityExceeded threw: ${err instanceof Error ? err.message : String(err)}`);
			expanded = void 0;
		}
		if (typeof expanded === "number" && expanded > current) {
			this.poolSize = expanded;
			this.logger.warn(`[Guardian] pool expanded ${current} → ${expanded} (all residents, incoming=${incomingId})`);
			return;
		}
		const payload = {
			rejectedId: incomingId,
			currentIds,
			limit: current
		};
		this.emitEvent("capacityExceeded", payload);
		throw new Error(`[Guardian] pool full: size=${current}, all ${currentIds.length} slot(s) are resident. rejectedId=${incomingId}. Free up a slot (unregister a resident) or expand poolSize.`);
	}
	/**
	* 因容量原因淘汰一个 slot —— 同步剔除记账，异步 dispose 不阻塞 register。
	*/
	evictForCapacity(victim, incomingId) {
		this.slots.delete(victim.instance.id);
		victim.evicting = true;
		const snapshotAt = Date.now();
		const lastActiveAt = victim.instance.lastActiveAt;
		this.logger.warn(`[Guardian] pool full (size=${this.poolSize}), evicting LRU non-resident: ${victim.instance.id} (lastActiveAt=${lastActiveAt}, incoming=${incomingId})`);
		this.decisionLog.append({
			at: Date.now(),
			path: "capacity",
			instanceId: victim.instance.id,
			reason: `pool full size=${this.poolSize}, incoming=${incomingId}`,
			snapshotAt,
			lastActiveAt,
			executed: true
		});
		Promise.resolve().then(() => victim.handle.dispose()).catch((err) => {
			this.logger.error(`[Guardian] capacity-driven dispose failed for ${victim.instance.id}: ${err instanceof Error ? err.message : String(err)}`);
		});
		this.emitEvicted(victim.instance.id, "capacity");
	}
	/**
	* 动态调整池上限。
	*
	* - 扩容（`size > current`）：立即生效；后续 register 更容易通过。
	* - 缩容（`size < current`）：**不主动驱逐已在池内的实例**，只是让下次 register
	*   更容易触发容量判定 —— 语义"容纳上限降了，但不清理已存在的"。
	* - `size <= 0` → 关闭容量限制。
	*
	* 装配层典型用法：`onCapacityExceeded` 回调里同步返回新上限，或者收到
	* `guardian.capacityExceeded` 事件后由 UI 让用户确认再手动调此 API。
	*/
	setPoolSize(size) {
		this.ensureAlive();
		const next = Math.max(0, size);
		if (next === this.poolSize) return;
		this.logger.warn(`[Guardian] setPoolSize ${this.poolSize} → ${next}`);
		this.poolSize = next;
	}
	/** 返回当前池上限（0 = 不限）。 */
	getPoolSize() {
		return this.poolSize;
	}
	/**
	* 注销实例（Adapter 主动通知：进程已退出 / DOM 已卸载）。
	*
	* 与 `evict` 不同 —— 这里 Guardian 不再调 `handle.dispose()`，因为调用方已经
	* 完成了释放。仅清理内部记账并广播 `guardian.evicted { reason: 'manual' }`。
	*/
	unregister(id, reason = "manual") {
		this.ensureAlive();
		if (!this.slots.get(id)) return;
		this.slots.delete(id);
		this.emitEvicted(id, reason);
	}
	/**
	* 更新活动信号 —— 每次 invoke / UI 交互调一次。
	*
	* 若目标实例正在驱逐中，会**取消驱逐** —— 场景：`activateOne` 完成后 idle
	* 巡检刚好触发驱逐，同时用户调 invoke，需要保证正在使用的实例不被误杀。
	*/
	markActive(id) {
		this.ensureAlive();
		const slot = this.slots.get(id);
		if (!slot) return;
		slot.instance.lastActiveAt = Date.now();
		if (slot.evicting) slot.evicting = false;
		slot.handle.onActivity?.();
	}
	/**
	* 手动驱逐 —— `wb.guardian.evict(id)` 走这里。
	*
	* 语义：**Guardian 主动调 handle.dispose()**（跟 unregister 不同），dispose 成功
	* 后清账 + 广播事件。若 dispose 抛错，仍然清账（避免 Adapter 挂了导致 Guardian
	* 侧永久残留），但日志记录失败原因。
	*/
	async evict(id, reason = "manual") {
		this.ensureAlive();
		const slot = this.slots.get(id);
		if (!slot) return;
		await this.evictSlot(slot, reason, "manual evict via wb.guardian.evict");
	}
	/** 列出所有当前托管的实例（快照，调用方可安全 filter/sort）。 */
	list() {
		const summaries = [];
		for (const slot of this.slots.values()) {
			const nextCheck = slot.instance.pin === "resident" ? void 0 : slot.instance.lastActiveAt + this.config.idleTimeoutMs;
			summaries.push({
				id: slot.instance.id,
				runtimeKind: slot.instance.runtimeKind,
				pin: slot.instance.pin,
				isolation: slot.instance.isolation,
				lastActiveAt: slot.instance.lastActiveAt,
				registeredAt: slot.instance.registeredAt,
				nextIdleCheckAt: nextCheck,
				evicting: slot.evicting
			});
		}
		summaries.sort((a, b) => {
			if (a.runtimeKind !== b.runtimeKind) return a.runtimeKind.localeCompare(b.runtimeKind);
			return a.registeredAt - b.registeredAt;
		});
		return summaries;
	}
	/** 导出决策日志（排障用）。 */
	exportDecisionLog() {
		return this.decisionLog.export();
	}
	/**
	* 拿到 Guardian 内部使用的事件总线。
	*
	* - 构造时传入了共享 bus：返回该共享 bus（跟 `sdk.$bus` 是同一个）
	* - 未传入：返回进程级单例 bus（`getBus()`），消费方通过 `wb.on(...)` 或它订阅 `guardian.*` 事件
	*
	* 主要用途：装配层未把共享 bus 递进来时，仍能拿到 Guardian 事件源（比如把它桥
	* 接到别处、或做单元测试）。
	*/
	getBus() {
		return this.bus;
	}
	/**
	* 注册 Sampler —— Adapter 侧在初始化时调用。
	*
	* 已注册的 sampler 会被违约巡检循环（`runViolationCheck`）按 `intervalMs` 调用；
	* 采样值跟 `budget.hardLimit` 比较，超限持续 `graceMs` 后按 `onViolation` 触发动作
	* （当前简化实现只支持 `evict`）。
	*/
	registerSampler(sampler) {
		this.ensureAlive();
		if (this.samplers.has(sampler.resource)) throw new Error(`[Guardian] sampler already registered: ${sampler.resource}`);
		this.samplers.set(sampler.resource, sampler);
	}
	/**
	* 注册 Action —— 默认已内建 warn / evict / downgrade，Adapter 或业务可扩展
	* `custom:xxx`。
	*/
	registerAction(action) {
		this.ensureAlive();
		this.actions.set(action.name, action);
	}
	startIdleCheck() {
		this.idleTimer = setInterval(() => {
			this.runIdleCheck();
		}, this.config.idleCheckIntervalMs);
		this.idleTimer.unref?.();
	}
	async runIdleCheck() {
		if (this.disposed) return;
		const now = Date.now();
		const idleTimeout = this.config.idleTimeoutMs;
		const candidates = [];
		for (const slot of this.slots.values()) {
			if (slot.evicting) continue;
			if (slot.instance.pin === "resident") continue;
			if (now - slot.instance.lastActiveAt < idleTimeout) continue;
			candidates.push(slot);
		}
		for (const slot of candidates) await this.evictSlot(slot, "idle", `idle > ${idleTimeout}ms`);
	}
	violationTimer;
	startViolationCheck() {
		this.violationTimer = setInterval(() => {
			this.runViolationCheck();
		}, this.config.violationCheckIntervalMs);
		this.violationTimer.unref?.();
	}
	async runViolationCheck() {
		if (this.disposed) return;
		const snapshot = [];
		for (const slot of this.slots.values()) {
			if (slot.evicting) continue;
			if (slot.instance.budgets.length === 0) continue;
			snapshot.push(slot);
		}
		if (snapshot.length > 0) this.logger.warn(`[Guardian] runViolationCheck tick: ${snapshot.length} slot(s) to check: ${snapshot.map((s) => s.instance.id).join(",")}`);
		for (const slot of snapshot) for (const budget of slot.instance.budgets) {
			const sampler = this.samplers.get(budget.resource);
			if (!sampler) continue;
			let value;
			try {
				value = await sampler.sample(slot.instance);
			} catch (err) {
				this.logger.warn(`[Guardian] sample(${budget.resource}) failed for ${slot.instance.id}: ${err instanceof Error ? err.message : String(err)}`);
				continue;
			}
			if (value <= budget.hardLimit) {
				slot.violationSince.delete(budget.resource);
				continue;
			}
			const now = Date.now();
			let since = slot.violationSince.get(budget.resource);
			if (since === void 0) {
				since = now;
				slot.violationSince.set(budget.resource, since);
				this.logger.warn(`[Guardian] ${slot.instance.id} exceeded ${budget.resource}: value=${value} > hardLimit=${budget.hardLimit}, grace=${budget.graceMs}ms window opened`);
			}
			if (!(now - since >= budget.graceMs)) continue;
			if (budget.onViolation === "evict") {
				this.logger.warn(`[Guardian] ${slot.instance.id} violation evict: ${budget.resource}=${value} > ${budget.hardLimit} for ${now - since}ms (grace=${budget.graceMs}ms)`);
				await this.evictSlot(slot, "violation", `${budget.resource}=${value} exceeded ${budget.hardLimit} for ${now - since}ms`);
				break;
			}
			this.logger.warn(`[Guardian] ${slot.instance.id} onViolation="${budget.onViolation}" not implemented, no action taken`);
		}
	}
	/**
	* 驱逐单个 slot —— 统一入口（idle / manual / 未来的 violation / pressure 都走）。
	*
	* 流程：
	* 1. 置 `evicting = true`（幂等标志）
	* 2. 调 `handle.dispose()`（Adapter 侧幂等要求）
	* 3. 中途若 `evicting` 被抢占清零（markActive 触发），**取消驱逐**并记录日志
	* 4. 成功：清账 + 广播 `guardian.evicted`
	* 5. 失败：清账 + 记 error log（Adapter 挂了不应导致 Guardian 侧永久残留）
	*/
	async evictSlot(slot, reason, description) {
		if (!this.slots.has(slot.instance.id)) return;
		if (slot.evicting) return;
		slot.evicting = true;
		const snapshotAt = Date.now();
		const lastActiveAt = slot.instance.lastActiveAt;
		try {
			await slot.handle.dispose();
		} catch (err) {
			this.logger.error(`[Guardian] dispose failed for ${slot.instance.id}: ${err instanceof Error ? err.message : String(err)}`);
		}
		if (!slot.evicting) {
			this.decisionLog.append({
				at: Date.now(),
				path: reason,
				instanceId: slot.instance.id,
				reason: `${description} (preempted by markActive)`,
				snapshotAt,
				lastActiveAt,
				executed: false
			});
			return;
		}
		this.slots.delete(slot.instance.id);
		this.decisionLog.append({
			at: Date.now(),
			path: reason,
			instanceId: slot.instance.id,
			reason: description,
			snapshotAt,
			lastActiveAt,
			executed: true
		});
		this.emitEvicted(slot.instance.id, reason);
	}
	registerBuiltinActions() {}
	emitEvicted(id, reason) {
		const payload = {
			id,
			reason
		};
		this.emitEvent("evicted", payload);
	}
	/**
	* 统一事件 emit —— 按 namespace 拼事件名。
	*
	* 拼名规则：
	* - 无 namespace → `guardian.<name>`
	* - 有 namespace → `guardian.<namespace>.<name>`
	*
	* 集中在这里，未来若要支持多 namespace 广播（比如同时 emit 带 ns 的和不带 ns 的做兼容）
	* 只需要改这一处。
	*/
	emitEvent(name, payload) {
		const eventName = this.namespace ? `guardian.${this.namespace}.${name}` : `guardian.${name}`;
		this.bus.emit(eventName, payload);
	}
	/**
	* 停止 Guardian —— 清理定时器 + 清空注册表。
	*
	* ⚠️ 不 dispose 名下实例（那是 Adapter 的职责，避免双重清理）。宿主进程退出前
	* 应先让 Adapter 完成自己的清理，再 dispose Guardian。
	*/
	dispose() {
		if (this.disposed) return;
		this.disposed = true;
		if (this.idleTimer) {
			clearInterval(this.idleTimer);
			this.idleTimer = void 0;
		}
		if (this.violationTimer) {
			clearInterval(this.violationTimer);
			this.violationTimer = void 0;
		}
		this.slots.clear();
		this.samplers.clear();
		this.actions.clear();
	}
	ensureAlive() {
		if (this.disposed) throw new Error("[Guardian] instance is disposed");
	}
};
function createResourceGuardian(deps = {}) {
	return new ResourceGuardian(deps);
}
//#endregion
//#region ../../node_modules/.pnpm/pidusage@3.0.2/node_modules/pidusage/lib/bin.js
var require_bin = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var spawn = require("child_process").spawn;
	/**
	* Spawn a binary and read its stdout.
	* @param  {String} cmd
	* @param  {String[]} args
	* @param  {Function} done(err, stdout)
	*/
	function run(cmd, args, options, done) {
		if (typeof options === "function") {
			done = options;
			options = void 0;
		}
		let executed = false;
		const ch = spawn(cmd, args, options);
		let stdout = "";
		let stderr = "";
		ch.stdout.on("data", function(d) {
			stdout += d.toString();
		});
		ch.stderr.on("data", function(d) {
			stderr += d.toString();
		});
		ch.on("error", function(err) {
			if (executed) return;
			executed = true;
			done(new Error(err));
		});
		ch.on("close", function(code, signal) {
			if (executed) return;
			executed = true;
			if (stderr) return done(new Error(stderr));
			done(null, stdout, code);
		});
	}
	module.exports = run;
}));
//#endregion
//#region ../../node_modules/.pnpm/pidusage@3.0.2/node_modules/pidusage/lib/history.js
var require_history = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var DEFAULT_MAXAGE = 6e4;
	var expiration = {};
	var history = {};
	var expireListeners = {};
	var size = 0;
	var interval = null;
	function get(pid, maxage) {
		if (maxage <= 0) return;
		if (history[pid] !== void 0) expiration[pid] = Date.now() + (maxage || DEFAULT_MAXAGE);
		return history[pid];
	}
	function set(pid, object, maxage, onExpire) {
		if (object === void 0 || maxage <= 0) return;
		expiration[pid] = Date.now() + (maxage || DEFAULT_MAXAGE);
		if (history[pid] === void 0) {
			size++;
			sheduleInvalidator(maxage);
		}
		history[pid] = object;
		if (onExpire) expireListeners[pid] = onExpire;
	}
	function sheduleInvalidator(maxage) {
		if (size > 0) {
			if (interval === null) {
				interval = setInterval(runInvalidator, (maxage || DEFAULT_MAXAGE) / 2);
				if (typeof interval.unref === "function") interval.unref();
			}
			return;
		}
		if (interval !== null) {
			clearInterval(interval);
			interval = null;
		}
	}
	function runInvalidator() {
		const now = Date.now();
		const pids = Object.keys(expiration);
		for (let i = 0; i < pids.length; i++) {
			const pid = pids[i];
			if (expiration[pid] < now) {
				size--;
				if (expireListeners[pid]) expireListeners[pid](history[pid]);
				delete history[pid];
				delete expiration[pid];
				delete expireListeners[pid];
			}
		}
		sheduleInvalidator();
	}
	function deleteLoop(obj) {
		for (const i in obj) delete obj[i];
	}
	function clear() {
		if (interval !== null) {
			clearInterval(interval);
			interval = null;
		}
		deleteLoop(history);
		deleteLoop(expiration);
		deleteLoop(expireListeners);
	}
	module.exports = {
		get,
		set,
		clear
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/pidusage@3.0.2/node_modules/pidusage/lib/ps.js
var require_ps = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var os$4 = require("os");
	var bin = require_bin();
	var history = require_history();
	var PLATFORM = os$4.platform();
	function parseTime(timestr, centisec) {
		let time = 0;
		const tpart = timestr.split(/-|:|\./);
		let i = tpart.length - 1;
		if (i >= 0 && centisec && PLATFORM === "darwin") time += parseInt(tpart[i--], 10) * 10;
		if (i >= 0) time += parseInt(tpart[i--], 10) * 1e3;
		if (i >= 0) time += parseInt(tpart[i--], 10) * 6e4;
		if (i >= 0) time += parseInt(tpart[i--], 10) * 36e5;
		if (i >= 0) time += parseInt(tpart[i--], 10) * 864e5;
		return time;
	}
	/**
	* Get pid informations through ps command.
	* @param  {Number[]} pids
	* @param  {Object} options
	* @param  {Function} done(err, stat)
	*/
	function ps(pids, options, done) {
		const pArg = pids.join(",");
		let args = [
			"-o",
			"etime,pid,ppid,pcpu,rss,time",
			"-p",
			pArg
		];
		if (PLATFORM === "aix" || PLATFORM === "os400") args = [
			"-o",
			"etime,pid,ppid,pcpu,rssize,time",
			"-p",
			pArg
		];
		bin("ps", args, function(err, stdout, code) {
			if (err) {
				if (PLATFORM === "os390" && /no matching processes found/.test(err)) {
					err = /* @__PURE__ */ new Error("No matching pid found");
					err.code = "ENOENT";
				}
				return done(err);
			}
			if (code === 1) {
				const error = /* @__PURE__ */ new Error("No matching pid found");
				error.code = "ENOENT";
				return done(error);
			}
			if (code !== 0) return done(/* @__PURE__ */ new Error("pidusage ps command exited with code " + code));
			const date = Date.now();
			stdout = stdout.split(os$4.EOL);
			const statistics = {};
			for (let i = 1; i < stdout.length; i++) {
				const line = stdout[i].trim().split(/\s+/);
				if (!line || line.length !== 6) continue;
				const pid = parseInt(line[1], 10);
				let hst = history.get(pid, options.maxage);
				if (hst === void 0) hst = {};
				const ppid = parseInt(line[2], 10);
				const memory = parseInt(line[4], 10) * 1024;
				const etime = parseTime(line[0]);
				const ctime = parseTime(line[5], true);
				const total = ctime - (hst.ctime || 0);
				const seconds = Math.abs(hst.elapsed !== void 0 ? etime - hst.elapsed : etime);
				statistics[pid] = {
					cpu: seconds > 0 ? total / seconds * 100 : 0,
					memory,
					ppid,
					pid,
					ctime,
					elapsed: etime,
					timestamp: date
				};
				history.set(pid, statistics[pid], options.maxage);
			}
			done(null, statistics);
		});
	}
	module.exports = ps;
}));
//#endregion
//#region ../../node_modules/.pnpm/pidusage@3.0.2/node_modules/pidusage/lib/helpers/parallel.js
var require_parallel = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	function parallel(fns, options, done) {
		if (typeof options === "function") {
			done = options;
			options = {};
		}
		let keys;
		if (!Array.isArray(fns)) keys = Object.keys(fns);
		const length = keys ? keys.length : fns.length;
		let pending = length;
		const results = keys ? {} : [];
		function each(i, err, result) {
			results[i] = result;
			if (--pending === 0 || err && !options.graceful) {
				if (options.graceful && err && length > 1) err = null;
				done && done(err, results);
				done = null;
			}
		}
		if (keys) keys.forEach(function(key) {
			fns[key](function(err, res) {
				each(key, err, res);
			});
		});
		else fns.forEach(function(fn, i) {
			fn(function(err, res) {
				each(i, err, res);
			});
		});
	}
	module.exports = parallel;
}));
//#endregion
//#region ../../node_modules/.pnpm/pidusage@3.0.2/node_modules/pidusage/lib/helpers/cpu.js
var require_cpu = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var os$3 = require("os");
	var fs$3 = require("fs");
	var exec = require("child_process").exec;
	var parallel = require_parallel();
	/**
	* Gathers Clock, PageSize and system uptime through /proc/uptime
	* This method is mocked in procfile tests
	*/
	function updateCpu(cpu, next) {
		if (cpu !== null) {
			getRealUptime(function(err, uptime) {
				if (err) return next(err);
				cpu.uptime = uptime;
				next(null, cpu);
			});
			return;
		}
		parallel([getClockAndPageSize, getRealUptime], function(err, data) {
			if (err) return next(err);
			cpu = {
				clockTick: data[0].clockTick,
				pageSize: data[0].pageSize,
				uptime: data[1]
			};
			next(null, cpu);
		});
	}
	module.exports = updateCpu;
	/**
	* Fallback on os.uptime(), though /proc/uptime is more precise
	*/
	function getRealUptime(next) {
		fs$3.readFile("/proc/uptime", "utf8", function(err, uptime) {
			if (err || uptime === void 0) {
				if (!process.env.PIDUSAGE_SILENT) console.warn("[pidusage] We couldn't find uptime from /proc/uptime, using os.uptime() value");
				return next(null, os$3.uptime() || /* @__PURE__ */ new Date() / 1e3);
			}
			return next(null, parseFloat(uptime.split(" ")[0]));
		});
	}
	function getClockAndPageSize(next) {
		parallel([function getClockTick(cb) {
			getconf("CLK_TCK", { default: 100 }, cb);
		}, function getPageSize(cb) {
			getconf("PAGESIZE", { default: 4096 }, cb);
		}], function(err, data) {
			if (err) return next(err);
			next(null, {
				clockTick: data[0],
				pageSize: data[1]
			});
		});
	}
	function getconf(keyword, options, next) {
		if (typeof options === "function") {
			next = options;
			options = { default: "" };
		}
		exec("getconf " + keyword, function(error, stdout, stderr) {
			if (error !== null) {
				if (!process.env.PIDUSAGE_SILENT) console.error("Error while calling \"getconf " + keyword + "\"", error);
				return next(null, options.default);
			}
			stdout = parseInt(stdout);
			if (!isNaN(stdout)) return next(null, stdout);
			return next(null, options.default);
		});
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/pidusage@3.0.2/node_modules/pidusage/lib/procfile.js
var require_procfile = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var fs$2 = require("fs");
	var path$1 = require("path");
	var updateCpu = require_cpu();
	var parallel = require_parallel();
	var history = require_history();
	var cpuInfo = null;
	var Buffer = require_common$1.require_safe_buffer().Buffer;
	var SIZE = 1024;
	function noop() {}
	function open(path$14, history, cb) {
		if (history.fd) return cb(null, history.fd);
		fs$2.open(path$14, "r", cb);
	}
	function close(history) {
		if (history.fd) fs$2.close(history.fd, noop);
	}
	function readUntilEnd(fd, buf, cb) {
		let firstRead = false;
		if (typeof buf === "function") {
			cb = buf;
			buf = Buffer.alloc(SIZE);
			firstRead = true;
		}
		fs$2.read(fd, buf, 0, SIZE, 0, function(err, bytesRead, buffer) {
			if (err) {
				cb(err);
				return;
			}
			const data = Buffer.concat([buf, buffer], firstRead ? bytesRead : buf.length + bytesRead);
			if (bytesRead === SIZE) {
				readUntilEnd(fd, data, cb);
				return;
			}
			cb(null, buf);
		});
	}
	function readProcFile(pid, options, done) {
		let hst = history.get(pid, options.maxage);
		let again = false;
		if (hst === void 0) {
			again = true;
			hst = {};
		}
		open(path$1.join("/proc", "" + pid, "stat"), hst, function(err, fd) {
			if (err) {
				if (err.code === "ENOENT") err.message = "No matching pid found";
				return done(err, null);
			}
			if (err) return done(err);
			readUntilEnd(fd, function(err, buffer) {
				if (err) return done(err);
				let infos = buffer.toString("utf8");
				const date = Date.now();
				const index = infos.lastIndexOf(")");
				infos = infos.substr(index + 2).split(" ");
				const stat = {
					ppid: parseInt(infos[1]),
					utime: parseFloat(infos[11]) * 1e3 / cpuInfo.clockTick,
					stime: parseFloat(infos[12]) * 1e3 / cpuInfo.clockTick,
					cutime: parseFloat(infos[13]) * 1e3 / cpuInfo.clockTick,
					cstime: parseFloat(infos[14]) * 1e3 / cpuInfo.clockTick,
					start: parseFloat(infos[19]) * 1e3 / cpuInfo.clockTick,
					rss: parseFloat(infos[21]),
					uptime: cpuInfo.uptime * 1e3,
					fd
				};
				const memory = stat.rss * cpuInfo.pageSize;
				const childrens = options.childrens ? stat.cutime + stat.cstime : 0;
				const total = stat.stime - (hst.stime || 0) + stat.utime - (hst.utime || 0) + childrens;
				const seconds = Math.abs(hst.uptime !== void 0 ? stat.uptime - hst.uptime : stat.start - stat.uptime);
				const cpu = seconds > 0 ? total / seconds * 100 : 0;
				history.set(pid, stat, options.maxage, close);
				if (again) return readProcFile(pid, options, done);
				return done(null, {
					cpu,
					memory,
					ctime: stat.utime + stat.stime,
					elapsed: stat.uptime - stat.start,
					timestamp: date,
					pid,
					ppid: stat.ppid
				});
			});
		});
	}
	function procfile(pids, options, done) {
		updateCpu(cpuInfo, function(err, result) {
			if (err) return done(err);
			cpuInfo = result;
			const fns = {};
			pids.forEach(function(pid, i) {
				fns[pid] = function(cb) {
					readProcFile(pid, options, cb);
				};
			});
			parallel(fns, { graceful: true }, done);
		});
	}
	module.exports = procfile;
}));
//#endregion
//#region ../../node_modules/.pnpm/pidusage@3.0.2/node_modules/pidusage/lib/wmic.js
var require_wmic = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var os$2 = require("os");
	var bin = require_bin();
	var history = require_history();
	function parseDate(datestr) {
		const year = datestr.substring(0, 4);
		const month = datestr.substring(4, 6);
		const day = datestr.substring(6, 8);
		const hour = datestr.substring(8, 10);
		const minutes = datestr.substring(10, 12);
		const seconds = datestr.substring(12, 14);
		const useconds = datestr.substring(15, 21);
		const sign = datestr.substring(21, 22);
		const tmz = parseInt(datestr.substring(22, 25), 10);
		const tmzh = Math.floor(tmz / 60);
		const tmzm = tmz % 60;
		return /* @__PURE__ */ new Date(year + "-" + month + "-" + day + "T" + hour + ":" + minutes + ":" + seconds + "." + useconds + sign + (tmzh > 9 ? tmzh : "0" + tmzh) + (tmzm > 9 ? tmzm : "0" + tmzm));
	}
	/**
	* Get pid informations through wmic command.
	* @param  {Number[]} pids
	* @param  {Object} options
	* @param  {Function} done(err, stat)
	*/
	function wmic(pids, options, done) {
		let whereClause = "ProcessId=" + pids[0];
		for (let i = 1; i < pids.length; i++) whereClause += " or ProcessId=" + pids[i];
		bin("wmic", [
			"PROCESS",
			"where",
			"\"" + whereClause + "\"",
			"get",
			"CreationDate,KernelModeTime,ParentProcessId,ProcessId,UserModeTime,WorkingSetSize"
		], {
			windowsHide: true,
			windowsVerbatimArguments: true
		}, function(err, stdout, code) {
			if (err) {
				if (err.message.indexOf("No Instance(s) Available.") !== -1) {
					const error = /* @__PURE__ */ new Error("No matching pid found");
					error.code = "ENOENT";
					return done(error);
				}
				return done(err);
			}
			if (code !== 0) return done(/* @__PURE__ */ new Error("pidusage wmic command exited with code " + code));
			const date = Date.now();
			const uptime = Math.floor(os$2.uptime() || date / 1e3);
			stdout = stdout.split(os$2.EOL);
			let again = false;
			const statistics = {};
			for (let i = 1; i < stdout.length; i++) {
				const line = stdout[i].trim().split(/\s+/);
				if (!line || line.length !== 6) continue;
				const creation = parseDate(line[0]);
				const ppid = parseInt(line[2], 10);
				const pid = parseInt(line[3], 10);
				const kerneltime = Math.round(parseInt(line[1], 10) / 1e4);
				const usertime = Math.round(parseInt(line[4], 10) / 1e4);
				const memory = parseInt(line[5], 10);
				let hst = history.get(pid, options.maxage);
				if (hst === void 0) {
					again = true;
					hst = {
						ctime: kerneltime + usertime,
						uptime
					};
				}
				const total = (kerneltime + usertime - hst.ctime) / 1e3;
				const seconds = uptime - hst.uptime;
				const cpu = seconds > 0 ? total / seconds * 100 : 0;
				history.set(pid, {
					ctime: usertime + kerneltime,
					uptime
				}, options.maxage);
				statistics[pid] = {
					cpu,
					memory,
					ppid,
					pid,
					ctime: usertime + kerneltime,
					elapsed: date - creation.getTime(),
					timestamp: date
				};
			}
			if (again) return wmic(pids, options, function(err, stats) {
				if (err) return done(err);
				done(null, Object.assign(statistics, stats));
			});
			done(null, statistics);
		});
	}
	module.exports = wmic;
}));
//#endregion
//#region ../../node_modules/.pnpm/pidusage@3.0.2/node_modules/pidusage/lib/stats.js
var require_stats = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var fs$1 = require("fs");
	var os$1 = require("os");
	var requireMap = {
		ps: () => require_ps(),
		procfile: () => require_procfile(),
		wmic: () => require_wmic()
	};
	var platformToMethod = {
		aix: "ps",
		os400: "ps",
		android: "procfile",
		alpine: "procfile",
		darwin: "ps",
		freebsd: "ps",
		os390: "ps",
		linux: "procfile",
		netbsd: "procfile",
		openbsd: "ps",
		sunos: "ps",
		win: "wmic"
	};
	var platform = os$1.platform();
	if (fs$1.existsSync("/etc/alpine-release")) platform = "alpine";
	if (platform.match(/^win/)) platform = "win";
	var stat;
	try {
		stat = requireMap[platformToMethod[platform]]();
	} catch (err) {}
	/**
	* @callback pidCallback
	* @param {Error} err A possible error.
	* @param {Object} statistics The object containing the statistics.
	*/
	/**
	* Get pid informations.
	* @public
	* @param  {Number|Number[]|String|String[]} pids A pid or a list of pids.
	* @param  {Object} [options={}] Options object
	* @param  {pidCallback} callback Called when the statistics are ready.
	*/
	function get(pids, options, callback) {
		let fn = stat;
		if (platform !== "win" && options.usePs === true) fn = requireMap.ps();
		if (fn === void 0) return callback(/* @__PURE__ */ new Error(os$1.platform() + " is not supported yet, please open an issue (https://github.com/soyuka/pidusage)"));
		let single = false;
		if (!Array.isArray(pids)) {
			single = true;
			pids = [pids];
		}
		if (pids.length === 0) return callback(/* @__PURE__ */ new TypeError("You must provide at least one pid"));
		for (let i = 0; i < pids.length; i++) {
			pids[i] = parseInt(pids[i], 10);
			if (isNaN(pids[i]) || pids[i] < 0) return callback(/* @__PURE__ */ new TypeError("One of the pids provided is invalid"));
		}
		fn(pids, options, function(err, stats) {
			if (err) return callback(err);
			if (single) callback(null, stats[pids[0]]);
			else callback(null, stats);
		});
	}
	module.exports = get;
}));
//#endregion
//#region ../../node_modules/.pnpm/pidusage@3.0.2/node_modules/pidusage/index.js
var require_pidusage = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var stats = require_stats();
	/**
	* Get pid informations.
	* @public
	* @param  {Number|Number[]|String|String[]} pids A pid or a list of pids.
	* @param  {Object} [options={}] Options object
	* @param  {Function} [callback=undefined] Called when the statistics are ready.
	* If not provided a promise is returned instead.
	* @returns  {Promise.<Object>} Only when the callback is not provided.
	*/
	function pidusage(pids, options, callback) {
		if (typeof options === "function") {
			callback = options;
			options = {};
		}
		if (options === void 0) options = {};
		options = Object.assign({
			usePs: /^true$/i.test(process.env.PIDUSAGE_USE_PS),
			maxage: process.env.PIDUSAGE_MAXAGE
		}, options);
		if (typeof callback === "function") {
			stats(pids, options, callback);
			return;
		}
		return new Promise(function(resolve, reject) {
			stats(pids, options, function(err, data) {
				if (err) return reject(err);
				resolve(data);
			});
		});
	}
	module.exports = pidusage;
	module.exports.clear = require_history().clear;
}));
//#endregion
//#region src/main/system/runtime/extension-paths.ts
var import_pidusage = /* @__PURE__ */ require_chunk.__toESM(require_pidusage());
/**
* Extension 路径的单一事实源（Single Source of Truth）。
*
* 所有需要定位 extension 目录的地方（registry 扫描、wb-extension:// 协议解析、
* 未来 web daemon 拼绝对 URL 等）**必须**走这里，禁止各自计算路径。
*
* ── 扫描根按优先级 ──
*
*   1. `~/.workbuddy/extensions-dev/`     —— 三方开发中（"Load unpacked" 风格，未来能力）
*   2. `~/.workbuddy/extensions/`         —— 用户装的正式 extension（未来能力）
*   3. builtin extensions（内置）
*        - packaged: `<Resources>/app.asar.unpacked/resources/extensions/`
*        - dev:      `<repo>/packages/workbuddy-extensions-builtin/dist/`
*
* 目前 1、2 目录不落地实现，仅在此文件预留 —— 存在时才 addScanPath，
* 未来添加只是"改常量"而不是"改架构"。
*
* ── 所有根内部布局完全一致（flat） ──
*
*   <root>/
*     <extension-id>/
*       extension.json
*       service/index.cjs
*       ui/assets/remoteEntry.js
*
* ── 冲突策略 ──
*
* 同 id 出现在多个根：优先级高的胜出。`extensions-dev > extensions > builtin`，
* 避免核心 builtin extension 被误装篡改（跟 VS Code "user 覆盖 builtin" 反着来 ——
* WorkBuddy 里 builtin 承载业务能力，不是可选功能）。
*/
require_workbuddy_product_config.init_bundled_assets();
/**
* 判断目录是否存在且**非空**。用于扫描根候选筛选 —— 空目录跟不存在等价，
* 避免被 electron-vite / syncBuiltinExtensions 提前创建的空占位目录骗到。
*/
function isNonEmptyDir(p) {
	try {
		return (0, fs.existsSync)(p) && (0, fs.statSync)(p).isDirectory() && (0, fs.readdirSync)(p).length > 0;
	} catch {
		return false;
	}
}
var DBG_LOG = "/tmp/wb-ext-debug.log";
function dbg(msg) {
	try {
		(0, fs.appendFileSync)(DBG_LOG, `${(/* @__PURE__ */ new Date()).toISOString()} [ext-paths] ${msg}\n`);
	} catch {}
}
/**
* builtin extensions 在 monorepo 里的产物根（dev 环境）。
*
* `__dirname` 在 daemon 子进程 / main 进程都是
* `<repoRoot>/apps/workbuddy-desktop/dist/main`（或 packaged 里的对应路径），
* 上溯 4 层到 repoRoot。
*
* 所有 builtin extension 的 build 脚本 outDir 都指向这里的 `<id>/`（flat 布局）：
*
*   packages/workbuddy-extensions-builtin/dist/
*     <id>/
*       extension.json         (build script 从源目录 cp 过来)
*       distribution.json      (可选)
*       server/index.cjs       (esbuild 产物)
*       ui/assets/...          (vite + module-federation 产物)
*
* `pnpm nx run @genie/workbuddy-desktop:dev` 通过 `^compile` 依赖会先跑
* `@genie/workbuddy-extensions-builtin` 的 compile（= build-all.js），把所有
* builtin extension 一次性产出到这里。
*/
function resolveBuiltinDevRoot() {
	return path.resolve(__dirname, "..", "..", "..", "..", "packages", "workbuddy-extensions-builtin", "dist");
}
/**
* builtin extensions 目录（dev 优先命中 monorepo dist，packaged 命中 asar-unpacked）。
*
* 两阶段：
*   1. **Dev root**：`packages/workbuddy-extensions-builtin/dist/` —— dev 场景，
*      各 extension 通过 build-all.js 或自己的 `pnpm dev --watch` 直接写这里
*   2. **Bundled**：`resolveBundledAsset('extensions')` —— packaged 场景,
*      electron-builder 把 `dist/` 打包到 asar-unpacked/resources/extensions/
*
* 两阶段都要求"存在且非空"—— electron-vite / syncBuiltinExtensions 可能提前建出
* 空的占位目录（比如 `apps/workbuddy-desktop/dist/resources/extensions/`）,
* 此时该 fallthrough 到下一阶段而不是死锁在空目录。
*
* ── stage1 何时命中：filesystem-driven，不需要 env 门禁 ──
*
* 采用 **filesystem = 真相** 语义：dist 有内容就扫，空就不扫。
* 由 `pnpm dev` / `pnpm run wb` 启动前置钩子清 dist 决定，见
* `apps/workbuddy-desktop/scripts/electron-dev.js` 头部的清理逻辑。
*
* 为什么不用 env 门禁：
*   1. 未来会有独立 dev 加载路径（如三方 extension 装到 `~/.workbuddy/extensions-dev/`），
*      env 门禁一刀切会误伤这些独立 root
*   2. 消费方（daemon registry）只看目录状态，不感知启动方式，语义更纯
*   3. 开发者手动 `cd packages/workbuddy-extensions-builtin && pnpm compile` 后
*      dev 应能自然扫到，无需重新启动带 env 的 script
*/
function resolveBuiltinRoot() {
	dbg(`resolveBuiltinRoot() called, __dirname=${__dirname}, pid=${process.pid}`);
	const devRoot = resolveBuiltinDevRoot();
	const devRootHit = isNonEmptyDir(devRoot);
	dbg(`  stage1(monorepo dist): ${devRootHit ? "HIT" : "MISS"} ${devRoot}`);
	if (devRootHit) {
		dbg(`  -> selected STAGE1: ${devRoot}`);
		return devRoot;
	}
	const bundled = require_workbuddy_product_config.resolveBundledAsset("extensions");
	const bundledHit = bundled ? isNonEmptyDir(bundled) : false;
	dbg(`  stage2(bundled): ${bundledHit ? "HIT" : "MISS"} ${bundled ?? "<null>"}`);
	if (bundledHit && bundled) {
		dbg(`  -> selected STAGE2: ${bundled}`);
		return bundled;
	}
	dbg(`  -> FALLBACK(non-existent stage1): ${devRoot}`);
	return devRoot;
}
/**
* 用户级 extensions 目录（未来能力，POC 阶段目录不存在时不加载）。
*
* marketplace / URL 装机后落这里。P0 不实现装机流程，仅预留扫描路径。
*/
function resolveUserExtensionsRoot() {
	return path.join(os.homedir(), ".workbuddy", "extensions");
}
/**
* 三方开发中的 extensions 目录（未来能力，Chrome "Load unpacked" 风格）。
*
* P0 不实现 dev 加载 UI，仅预留扫描路径 —— 目录存在时自动扫入。
* 生产版是否需要显式开关避免被诱导加载不受信任 extension，另议。
*/
function resolveExtensionsDevRoot() {
	return path.join(os.homedir(), ".workbuddy", "extensions-dev");
}
/**
* 按优先级返回所有 extension 扫描根。
*
* Registry 装配层遍历这个数组挨个 `addScanPath`。**不过滤存在性**——
* 上游按需 `existsSync` 后再加，避免"运行时突然创建 dev 目录"的场景失效。
*
* 返回顺序 = 优先级顺序（低索引优先）：
*   [0] `~/.workbuddy/extensions-dev/`
*   [1] `~/.workbuddy/extensions/`
*   [2] builtin（dev 或 packaged）
*/
function resolveExtensionsScanRoots() {
	dbg(`resolveExtensionsScanRoots() called, pid=${process.pid}`);
	const roots = [
		resolveExtensionsDevRoot(),
		resolveUserExtensionsRoot(),
		resolveBuiltinRoot()
	];
	dbg(`resolveExtensionsScanRoots() returns:\n  [0] ${roots[0]}\n  [1] ${roots[1]}\n  [2] ${roots[2]}`);
	return roots;
}
/**
* 定位单个 extension 的根目录。
*
* 供 `wb-extension://` 协议解析等使用。
* 按 `resolveExtensionsScanRoots()` 的优先级顺序找，返回第一个存在的路径。
* 都不存在返回 null（handler 应返回 404）。
*
* 所有环境都返回 `<extensions-root>/<id>/`（flat 布局），
* 消费方拼相对路径无需感知 dev / packaged 差异。
*/
function resolveExtensionRoot(id) {
	for (const root of resolveExtensionsScanRoots()) {
		const candidate = path.join(root, id);
		if ((0, fs.existsSync)(candidate) && (0, fs.statSync)(candidate).isDirectory()) return candidate;
	}
	return null;
}
//#endregion
//#region src/main/features/extensions/registry-setup.ts
/**
* Extension Registry 装配层（desktop 侧）。
*
* 把 extension 的"路径解析 → registry 创建 → 扫描根挂载 → scan → activate → dispose"
* 全流程收进这里。`features/wb/` 只管 wb SDK IPC bridge 本身，不掺 extension 生命周期。
*
* ── 循环依赖打破 ──
*
* `hub` 构建时需要 `extensionRegistry`（供 `wb.extensions` namespace 消费），
* 而 `registry.activate()` 时又需要 hub services（extension 子进程要能调 wb.*）。
* 顺序必须是：
*
*   1) `setupExtensionRegistry(...)` —— 创建空 registry + addScanPath + scan
*      （scan 只读磁盘 manifest，不启子进程，此时 hub services 可以还没就绪）
*   2) `initHub({ extensionRegistry })` —— 拿 registry 构建 hub
*   3) `bindServicesAndActivate(services)` —— 回填 services，触发 activate
*      （fork extension 子进程，子进程 wb.* 调用能拿到完整 hub services）
*   4) shutdown 时调 `dispose()` 释放子进程
*
* `services` 用 factory 传给 `createExtensionRegistry`，`activate` 时才解引用，
* 保证拿到"当下最新的" services（含 extensions 自身 namespace）。
*/
/**
* 装配 extension registry —— 创建 + 挂扫描根 + scan（不 activate）。
*
* activate 时机由调用方通过 `bindServicesAndActivate` 显式触发，
* 因为 activate 依赖 hub services 已就绪（见文件头"循环依赖打破"注释）。
*/
function setupExtensionRegistry(deps) {
	const { bus, logger, daemonRpcInvoke } = deps;
	const guardian = createResourceGuardian({
		bus,
		namespace: "extension",
		config: {
			idleTimeoutMs: 10 * 6e4,
			poolSize: 2,
			onCapacityExceeded: ({ current, rejectedId, residentIds }) => {
				logger.warn(`[guardian] pool full (size=${current}, all resident=${residentIds.join(",")}), reject register=${rejectedId}`);
			}
		},
		logger: {
			warn: (...args) => logger.warn("[guardian]", ...args),
			error: (...args) => logger.error("[guardian]", ...args)
		}
	});
	bus.on("guardian.extension.registered", (payload) => {
		logger.info("[guardian:extension] registered", payload);
	});
	bus.on("guardian.extension.evicted", (payload) => {
		logger.warn("[guardian:extension] evicted", payload);
	});
	bus.on("guardian.extension.crashed", (payload) => {
		logger.error("[guardian:extension] crashed", payload);
	});
	bus.on("guardian.extension.capacityExceeded", (payload) => {
		logger.error("[guardian:extension] capacityExceeded", payload);
	});
	const registryHolder = { ref: void 0 };
	/** 从 Guardian instanceId（`ext:<id>`）反查当前子进程 pid。 */
	const resolveExtensionPid = (instanceId) => {
		const extId = instanceId.startsWith("ext:") ? instanceId.slice(4) : instanceId;
		return registryHolder.ref?.get(extId)?.handle?.process.pid;
	};
	guardian.registerSampler({
		resource: "memory.rss.mb",
		intervalMs: 1e3,
		sample: async (instance) => {
			const pid = resolveExtensionPid(instance.id);
			if (!pid) {
				logger.info(`[guardian:sample] mem ${instance.id}: no live pid (handle missing), skip`);
				return -1;
			}
			try {
				const mb = (await (0, import_pidusage.default)(pid)).memory / (1024 * 1024);
				logger.info(`[guardian:sample] mem ${instance.id} pid=${pid} rss=${mb.toFixed(1)}MB`);
				return mb;
			} catch (err) {
				logger.warn(`[guardian:sample] mem ${instance.id} pid=${pid} failed: ${err instanceof Error ? err.message : String(err)}`);
				return -1;
			}
		}
	});
	let latestMethodChannel;
	const permissions = new PermissionRegistry();
	const authorizer = createBridgeAuthorizer(permissions.toProvider());
	const registry = createExtensionRegistry({
		methodChannel: () => {
			if (!latestMethodChannel) throw new Error("[ExtensionRegistry] methodChannel 未 bind —— 必须先 `bindMethodChannel(mc)` 才能激活 extension");
			return latestMethodChannel;
		},
		bus,
		authorizer,
		guardian,
		guardianBudgets: (ext) => {
			if (ext.distribution.resident === true) return [];
			return [{
				resource: "memory.rss.mb",
				expected: 50,
				hardLimit: 200,
				graceMs: 3e3,
				onViolation: "evict"
			}, {
				resource: "cpu.percent",
				expected: 5,
				hardLimit: 50,
				graceMs: 3e3,
				onViolation: "evict"
			}];
		},
		logger,
		daemonRpcInvoke,
		extraNodePaths: [node_path.resolve(__dirname, "..", "..", "node_modules")]
	});
	registryHolder.ref = registry;
	const scanRoots = resolveExtensionsScanRoots();
	logger.info("[ext-scan] candidate scan roots (priority high→low):");
	for (const root of scanRoots) {
		const exists = (0, node_fs.existsSync)(root);
		logger.info(`[ext-scan]   ${exists ? "✓" : "✗"} ${root}`);
		if (exists) registry.addScanPath(root);
	}
	registry.scan();
	logger.info(`[ext-scan] after scan(), extensions count=${registry.list().length}`);
	for (const ext of registry.list()) logger.info(`[ext-scan]   - ${ext.manifest.id} @ ${ext.basePath}`);
	const PLATFORM_BASELINE_PERMISSIONS = ["bus.emit", "bus.on"];
	for (const ext of registry.list()) {
		const kind = ext.distribution.kind === "builtin" ? "builtin" : "platform";
		const perms = kind === "builtin" ? ["*"] : [...PLATFORM_BASELINE_PERMISSIONS, ...ext.distribution.grantedPermissions ?? []];
		try {
			permissions.registerSubject({
				moduleId: ext.manifest.id,
				type: "extension",
				kind,
				permissions: perms
			});
			logger.info(`[ext-perm] registered ${ext.manifest.id} kind=${kind} perms=[${perms.join(",")}]`);
		} catch (err) {
			logger.error(`[ext-perm] register ${ext.manifest.id} failed:`, err instanceof Error ? err.message : String(err));
		}
	}
	return {
		registry,
		guardian,
		authorizer,
		permissionRegistry: permissions,
		bindMethodChannel(methodChannel) {
			latestMethodChannel = methodChannel;
		},
		async activateByEvent(event) {
			try {
				await registry.activateByEvent(event);
			} catch (err) {
				logger.error(`[ExtensionRegistry] activateByEvent('${event}') failed:`, err);
			}
		},
		dispose() {
			registry.dispose();
			guardian.dispose();
		}
	};
}
//#endregion
//#region src/main/features/wb/register-wb-bridge-channels.ts
/**
* WB SDK Bridge channel 注册（daemon 子进程侧）。
*
* domain 构建逻辑直接调 `initHub`（hub 在 workbuddy-server），
* 差异仅在 transport：daemon 用 DaemonServer.handle + DaemonServer.push。
*
* 好处：bridge 跑在 daemon 子进程 → 不占 main 进程 event loop；
* domain repo 的 HTTP 请求、磁盘 IO 全在子进程完成。
*
* 时序：在 onRpcReady 回调中调用——此时 CellJS 已就绪，celljs deps 可直接用。
*
* Extension 装配顺序（避免循环依赖，详见 `features/extensions/registry-setup.ts`）：
* 1. `setupExtensionRegistry(...)` —— 创建 registry + scan（只登记，不激活）
* 2. `initHub({ extensionRegistry })` —— hub 里 `wb.extensions` namespace 读 registry
* 3. `extSetup.bindServices(services)` —— 回填 services（供后续激活时 fork 子进程消费）
* 4. 注册 `extensions:activateByEvent` channel —— main 进程在合适时机（主窗口 ready 等）
*    通过此 RPC 喊事件字符串，daemon 转 `registry.activateByEvent(event)` 做激活
*/
require_workbuddy_product_config.init_bundled_assets();
var _wbBridgeLogger;
function wbBridgeLogger() {
	if (!_wbBridgeLogger) _wbBridgeLogger = require_logger.createWorkbuddyScopedLogger("WBBridge");
	return _wbBridgeLogger;
}
var WB_BRIDGE_EVENT_CHANNEL = "wb:event";
/**
* 事件驱动激活 extension 的 daemon RPC channel。
*
* Main 进程在某个业务时机（如主窗口 `ready-to-show`）通过 daemon RPC 喊事件字符串，
* daemon 装配层收到后转 `extensionRegistry.activateByEvent(event)`。
*
* 参数：`event: string` —— 与 `manifest.activationEvents[]` 精确匹配的字符串，
* 如 `'onStartup'` / `'onCommand:workbuddy.openApiConsole'` / `'onView:/extensions'`。
*/
var EXTENSION_ACTIVATE_BY_EVENT_CHANNEL = "extensions:activateByEvent";
var CONVERSATION_LIST_POLL_PAGE_SIZE = 100;
/**
* 把 `wb.conversations.delete()` 接到 daemon 既有的 `session:delete` RPC 上。
*
* 该 RPC 才是本地会话删除的完整链路——删除前 dirty 文档确认、运行态拆除、
* `session:deleted` 广播都挂在上面；SDK 自带的 sqlite 软删除只覆盖其中一步。
* 走 `invokeLocal` 是为了与 renderer 老路径（daemonClient.deleteSession）共用同一
* handler，避免两条删除语义漂移。
*/
async function deleteSessionViaDaemonRpc(server, sessionId) {
	return (await server.invokeLocal(require_contract.SESSION_RPC_CHANNELS.DELETE, sessionId))?.status === "cancelled" ? "cancelled" : "deleted";
}
/**
* 在 daemon 子进程中构建 WB SDK bridge，把所有 wb:* channel 注册到 DaemonServer。
*
* @param server daemon 的 DaemonServer 实例
* @param deps 依赖项（CellJS deps + desktopHost bridge + intentRecognition + optional runtime facts）
* @returns 句柄，供 daemon shutdown 钩子释放 poller/scheduler 与 hub 资源
*/
function registerWBBridgeChannels(server, deps) {
	const { celljs, desktopHost, intentRecognition, conversationRuntimeFacts, runtimeConfigDir, measurementSink } = deps;
	const extSetup = setupExtensionRegistry({
		bus: require_tar.getBus(),
		logger: wbBridgeLogger(),
		daemonRpcInvoke: (channel, ...args) => server.invokeLocal(channel, ...args)
	});
	try {
		extSetup.permissionRegistry.registerSubject({
			moduleId: "main",
			type: "window",
			kind: "builtin",
			permissions: ["*"]
		});
	} catch (err) {
		wbBridgeLogger().error("[wb-perm] failed to register main window subject:", err instanceof Error ? err.message : String(err));
	}
	const initialSession = celljs.authenticationManager?.currentSessionSubject?.getValue?.();
	const hubStorage = require_server.createHubStorage({
		homeDir: require_workbuddy_paths.getWorkbuddyConfigDir(),
		initialUid: initialSession?.account?.uid,
		initialEnterpriseId: initialSession?.account?.enterpriseId
	});
	celljs.authenticationManager?.currentSessionSubject?.subscribe?.(async (session) => {
		const account = session?.account;
		const uid = account?.uid;
		if (uid) await hubStorage.bindUser(uid, account?.enterpriseId);
	});
	const { hub, disposeAll: disposeHub } = require_server.initHub({
		celljs,
		homeDir: require_workbuddy_paths.getWorkbuddyConfigDir(),
		hubStorage,
		resolveBundledAsset: require_workbuddy_product_config.requireBundledAsset,
		appRoot: require_workbuddy_product_config.getAssetsRoot(),
		resolveSystemHome: () => (0, node_os.homedir)(),
		intentRecognition,
		resolveSavePath: async (defaultPath) => {
			const result = await desktopHost.dialog.showSaveDialog({
				defaultPath,
				title: "保存文件"
			});
			return result.canceled ? null : result.filePath ?? null;
		},
		clientToolDispatcher: desktopHost.clientTools ? { execute: (request) => desktopHost.clientTools.execute(request) } : void 0,
		conversationRuntimeFacts,
		runtimeConfigDir,
		deleteSessionHost: (sessionId) => deleteSessionViaDaemonRpc(server, sessionId),
		extensionRegistry: extSetup.registry,
		measurementSink
	});
	const requestUpdateSubscriptions = /* @__PURE__ */ new Set();
	const conversationEventScheduler = new require_server.ConversationEventPushScheduler({
		push: (event, payload) => server.push(WB_BRIDGE_EVENT_CHANNEL, {
			event,
			payload
		}),
		shouldPublishRequestUpdate: (conversationId) => requestUpdateSubscriptions.has(conversationId) || requestUpdateSubscriptions.has("*"),
		report: (metrics) => {
			wbBridgeLogger().info("Conversation event push summary", metrics);
		}
	});
	require_server.startConversationPerfSampler(() => conversationEventScheduler.snapshotObservability());
	require_tar.getBus().onAny((event, payload) => {
		conversationEventScheduler.publish(event, payload);
	});
	const storageContextualHandlers = require_server.createStorageContextualHandlers(hubStorage);
	const pathsContextualHandlers = require_server.createPathsContextualHandlers({
		userDataDir: require_workbuddy_paths.getWorkbuddyConfigDir(),
		appRoot: require_workbuddy_product_config.getAssetsRoot(),
		resolveBundledAsset: require_workbuddy_product_config.requireBundledAsset,
		resolveSystemHome: () => (0, node_os.homedir)()
	});
	const methodChannel = require_server.createMethodChannel(hub, {
		contextualHandlers: new Map([...storageContextualHandlers, ...pathsContextualHandlers]),
		authorizer: extSetup.authorizer
	});
	const MC_LOG_SILENT_SUFFIXES = [
		":ping",
		":heartbeat",
		":health",
		":status"
	];
	const MC_LOG_SILENT_EXACT = new Set([
		"ping",
		"heartbeat",
		"health",
		"conversations:snapshot"
	]);
	function isSilentMcChannel(name) {
		if (MC_LOG_SILENT_EXACT.has(name)) return true;
		for (const s of MC_LOG_SILENT_SUFFIXES) if (name.endsWith(s)) return true;
		return false;
	}
	const MC_SLOW_MS = 500;
	const MC_VERY_SLOW_MS = 5e3;
	let mcSeq = 0;
	async function invokeMethodChannel(channel, invokeContext, args) {
		const chName = typeof channel === "string" ? channel : String(channel);
		const silent = isSilentMcChannel(chName);
		const seq = ++mcSeq;
		const start = Date.now();
		const firstArg = args[0];
		const argHint = summarizeMcArg(firstArg);
		if (!silent) wbBridgeLogger().info(`[MethodCh] begin #${seq} ${chName} arg=${argHint}`);
		try {
			const result = await methodChannel.invoke(chName, invokeContext, ...args);
			const elapsedMs = Date.now() - start;
			if (elapsedMs >= MC_VERY_SLOW_MS) wbBridgeLogger().warn(`[MethodCh] end #${seq} ${chName} elapsedMs=${elapsedMs} VERY_SLOW arg=${argHint}`);
			else if (elapsedMs >= MC_SLOW_MS) wbBridgeLogger().warn(`[MethodCh] end #${seq} ${chName} elapsedMs=${elapsedMs} SLOW arg=${argHint}`);
			else if (!silent) wbBridgeLogger().info(`[MethodCh] end #${seq} ${chName} elapsedMs=${elapsedMs}`);
			return result;
		} catch (error) {
			const elapsedMs = Date.now() - start;
			const msg = error instanceof Error ? error.message : String(error);
			wbBridgeLogger().error(`[MethodCh] error #${seq} ${chName} elapsedMs=${elapsedMs} error=${msg} arg=${argHint}`);
			throw error;
		}
	}
	function summarizeMcArg(arg) {
		if (arg === void 0) return "undefined";
		if (arg === null) return "null";
		if (typeof arg === "string") return arg.length <= 64 ? JSON.stringify(arg) : `<str:${arg.length}>`;
		if (typeof arg === "number" || typeof arg === "boolean") return String(arg);
		if (typeof arg !== "object") return `<${typeof arg}>`;
		const src = arg;
		const picked = {};
		for (const k of [
			"sessionId",
			"conversationId",
			"requestId",
			"projectId",
			"expertTeamId",
			"cwd",
			"limit",
			"offset"
		]) if (src[k] !== void 0) picked[k] = src[k];
		if (Array.isArray(arg)) return `<arr:${arg.length}>`;
		try {
			return JSON.stringify(picked);
		} catch {
			return "<obj>";
		}
	}
	const methods = methodChannel.methods();
	for (const channel of methods) server.handle(channel, (invokeContext, ...args) => invokeMethodChannel(channel, invokeContext, args));
	server.handle("wb:invoke", (channel, invokeContext, ...args) => invokeMethodChannel(channel, invokeContext, args));
	console.log(`[WB-SDK:Daemon] method channel registered, ${methods.length} methods`);
	extSetup.bindMethodChannel(methodChannel);
	server.handle(EXTENSION_ACTIVATE_BY_EVENT_CHANNEL, async (event) => {
		try {
			(0, node_fs.appendFileSync)("/tmp/wb-ext-debug.log", `${(/* @__PURE__ */ new Date()).toISOString()} [wb-bridge] ${EXTENSION_ACTIVATE_BY_EVENT_CHANNEL} received: event=${JSON.stringify(event)} typeof=${typeof event}\n`);
		} catch {}
		if (typeof event !== "string" || event.length === 0) {
			wbBridgeLogger().warn(`[${EXTENSION_ACTIVATE_BY_EVENT_CHANNEL}] invalid event payload: ${JSON.stringify(event)}`);
			throw new Error(`[${EXTENSION_ACTIVATE_BY_EVENT_CHANNEL}] event must be a non-empty string`);
		}
		const activateStartedAt = Date.now();
		wbBridgeLogger().info(`[${EXTENSION_ACTIVATE_BY_EVENT_CHANNEL}] dispatch: ${event}`);
		try {
			await extSetup.activateByEvent(event);
			const elapsedMs = Date.now() - activateStartedAt;
			if (elapsedMs >= 3e3) wbBridgeLogger().warn(`[${EXTENSION_ACTIVATE_BY_EVENT_CHANNEL}] dispatch SLOW event=${event} elapsedMs=${elapsedMs}`);
			else wbBridgeLogger().info(`[${EXTENSION_ACTIVATE_BY_EVENT_CHANNEL}] dispatch done: ${event} elapsedMs=${elapsedMs}`);
		} catch (error) {
			const elapsedMs = Date.now() - activateStartedAt;
			wbBridgeLogger().error(`[${EXTENSION_ACTIVATE_BY_EVENT_CHANNEL}] dispatch FAILED event=${event} elapsedMs=${elapsedMs} error=${error instanceof Error ? error.message : String(error)}`);
			throw error;
		}
	});
	const conversationsSvc = hub.conversations;
	const conversationListPoller = new require_server.ConversationListPoller({
		list: (filter) => conversationsSvc.list(filter),
		listByIds: (ids) => conversationsSvc.listByIds(ids),
		emit: (payload) => require_tar.getBus().emit(require_server.WB_CONVERSATION_LIST_CHANGED, payload),
		filter: {
			size: CONVERSATION_LIST_POLL_PAGE_SIZE,
			conversationOrigin: require_server.DESKTOP_TASK_CONVERSATION_ORIGINS
		},
		logger: wbBridgeLogger()
	});
	let releaseListRefresh;
	const setListPollingActive = (active) => {
		if (active === Boolean(releaseListRefresh)) return;
		if (active) {
			const releasePolling = conversationListPoller.subscribe();
			const releaseAutomationCreatedListener = require_tar.getBus().on(require_server.WB_CONVERSATION_CREATED, ({ conversationId, info }) => {
				if (!info.isBackgroundAutomation) return;
				conversationListPoller.notifyCreated(conversationId);
			});
			releaseListRefresh = () => {
				releaseAutomationCreatedListener();
				releasePolling();
			};
		} else {
			releaseListRefresh?.();
			releaseListRefresh = void 0;
		}
	};
	server.handle(require_server.WB_CONVERSATION_EVENT_SUBSCRIPTION_CHANNEL, (value) => {
		if (!value || typeof value !== "object") throw new Error("invalid conversation event subscription");
		const subscription = value;
		if (subscription.event === "current") {
			if (!Array.isArray(subscription.currentConversationIds) || !subscription.currentConversationIds.every((id) => typeof id === "string")) throw new Error("invalid conversation event subscription");
			conversationEventScheduler.setCurrentConversationIds(subscription.currentConversationIds);
			return;
		}
		if (subscription.event === "listChanged") {
			if (typeof subscription.active !== "boolean") throw new Error("invalid conversation event subscription");
			setListPollingActive(subscription.active);
			return;
		}
		if (subscription.event !== "requestUpdate" || !Array.isArray(subscription.activeConversationIds) || !subscription.activeConversationIds.every((id) => typeof id === "string")) throw new Error("invalid conversation event subscription");
		const next = new Set(subscription.activeConversationIds);
		conversationEventScheduler.discardInactive((conversationId) => next.has("*") || next.has(conversationId));
		requestUpdateSubscriptions.clear();
		for (const conversationId of next) requestUpdateSubscriptions.add(conversationId);
	});
	server.handle(WB_EXTENSION_REQUEST_RECEIVE_STREAMING_CHANNEL, (value) => {
		if (!value || typeof value !== "object") throw new Error("invalid extension-request-receive-streaming payload");
		const { extensionId, conversationId } = value;
		if (typeof extensionId !== "string" || !extensionId || typeof conversationId !== "string" || !conversationId) throw new Error("invalid extension-request-receive-streaming payload: extensionId and conversationId must be non-empty strings (extensionId is expected to be host-signed by extension bridge-host)");
		requestExtensionReceiveStreaming({
			extensionId,
			conversationId
		});
	});
	server.handle(WB_EXTENSION_CANCEL_RECEIVE_STREAMING_CHANNEL, (value) => {
		if (!value || typeof value !== "object") throw new Error("invalid extension-cancel-receive-streaming payload");
		const { extensionId } = value;
		if (typeof extensionId !== "string" || !extensionId) throw new Error("invalid extension-cancel-receive-streaming payload: extensionId must be non-empty string (extensionId is expected to be host-signed by extension bridge-host)");
		cancelExtensionReceiveStreaming({ extensionId });
	});
	let resolveFirstLocalList;
	const firstLocalListReady = new Promise((resolve) => {
		resolveFirstLocalList = resolve;
	});
	const unsubscribeFirstLocalList = conversationsSvc.on(require_server.ConversationsEvent.ListChange, (space) => {
		if (space !== "local") return;
		unsubscribeFirstLocalList();
		resolveFirstLocalList?.();
	});
	server.handle(DAEMON_FIRST_LOCAL_LIST_RENDERED_CHANNEL, async () => {
		resolveFirstLocalList?.();
		return { ok: true };
	});
	if ((celljs.authenticationManager.currentSessionSubject?.getValue?.())?.account?.uid) conversationsSvc.ensureList("local", {
		page: 1,
		size: 1e5,
		view: "active"
	}).catch((err) => {
		wbBridgeLogger().warn("[WB-SDK:Daemon] prefetch local conversation list failed (non-blocking)", err);
	});
	let conversationShutdownPromise;
	const settleConversationsForShutdown = () => {
		conversationShutdownPromise ??= conversationsSvc._disposeAll();
		return conversationShutdownPromise;
	};
	return {
		firstLocalListReady,
		_resetAll: (reason) => conversationsSvc._resetAll(reason),
		settleConversationsForShutdown,
		dispose: async () => {
			unsubscribeFirstLocalList();
			resolveFirstLocalList?.();
			setListPollingActive(false);
			conversationListPoller.dispose();
			conversationEventScheduler.dispose();
			extSetup.dispose();
			await settleConversationsForShutdown();
			await disposeHub();
		}
	};
}
//#endregion
//#region ../../packages/workbuddy-server/src/docs/local-docs-release-bridge.ts
function createLocalDocsReleaseBridgeFromFacade(facade) {
	return {
		releaseContext: (documentResourceUri, options) => facade.releaseContext(documentResourceUri, options),
		releaseContextIfClean: (documentResourceUri, options) => facade.releaseContextIfClean(documentResourceUri, options),
		saveContext: (documentResourceUri) => facade.saveContext(documentResourceUri)
	};
}
//#endregion
//#region ../../packages/workbuddy-server/src/session/tencent-docs-agent-editor-tracker.ts
/**
* TencentDocsAgentEditorTracker
*
* Tracks local document `open_file` calls made during an agent turn so that,
* once the turn ends, the host can reconcile (save-if-dirty then close) the
* editors that the agent opened.
*/
var TencentDocsAgentEditorTracker = class {
	constructor() {
		this.sessionPaths = /* @__PURE__ */ new Map();
	}
	recordOpenedFile(sessionId, filePath) {
		if (typeof filePath !== "string" || !filePath) return;
		let paths = this.sessionPaths.get(sessionId);
		if (!paths) {
			paths = /* @__PURE__ */ new Set();
			this.sessionPaths.set(sessionId, paths);
		}
		paths.add(filePath);
	}
	takeAndClear(sessionId) {
		const paths = this.sessionPaths.get(sessionId);
		if (!paths || paths.size === 0) return [];
		this.sessionPaths.delete(sessionId);
		return [...paths];
	}
	clear(sessionId) {
		this.sessionPaths.delete(sessionId);
	}
};
//#endregion
//#region ../../packages/workbuddy-server/src/tencent-docs/create-document-lifecycle-deps.ts
var LOCAL_DOCUMENT_KIND_BY_TENCENT_DOCS_KIND = {
	doc: "document",
	sheet: "spreadsheet",
	slide: "presentation"
};
function clearTencentDocsOnlineSessionState(sessionId) {
	require_wb_source.getOnlineDocumentSelectionStore().clearSession(sessionId);
	require_wb_source.getOnlineDocPreviewRegistry().clearSession(sessionId);
}
function createTencentDocsDocumentLifecycleDeps(args) {
	const isSessionStillProcessing = require_document_lifecycle_port.createIsSessionStillProcessing(args.sessionManager);
	return {
		tracker: new TencentDocsAgentEditorTracker(),
		documentService: args.documentService,
		isSessionStillProcessing,
		onSessionDeleted: clearTencentDocsOnlineSessionState,
		dispose: args.dispose
	};
}
function createTencentDocsLocalDocumentMediaTypes() {
	return require_server.buildLocalDocumentMediaTypeEntries(require_tencent_docs_prompt_selection.TENCENT_DOCS_AI_FILE_SUPPORT_WHITELIST.map((item) => ({
		kind: LOCAL_DOCUMENT_KIND_BY_TENCENT_DOCS_KIND[item.kind],
		extensions: item.extensions
	})));
}
//#endregion
//#region src/main/features/desktop-host/noop-desktop-host.ts
var NOOP_DESKTOP_HOST_APP = {
	getName: () => "WorkBuddy",
	getVersion: () => "0.0.0",
	getPlatform: () => process.platform,
	getLocale: () => "en",
	getConfigDir: () => "",
	isPackaged: () => false,
	getAutoLaunchEnabled: () => false,
	setAutoLaunchEnabled: () => void 0,
	reconcileAutoLaunchOnStartup: async () => void 0,
	showAboutDialog: async () => void 0,
	quit: () => void 0
};
var NOOP_DESKTOP_HOST_DIALOG = {
	showOpenDialog: async () => ({
		canceled: true,
		filePaths: []
	}),
	showSaveDialog: async () => ({ canceled: true }),
	showMessageBox: async () => ({ response: 0 })
};
var NOOP_DESKTOP_HOST_SHELL = {
	openExternal: async () => {
		throw new Error("DesktopHost.shell.openExternal is not available");
	},
	openPath: async () => {
		throw new Error("DesktopHost.shell.openPath is not available");
	},
	showItemInFolder: () => {
		throw new Error("DesktopHost.shell.showItemInFolder is not available");
	}
};
function desktopHostUnavailable(capability) {
	throw new Error(`DesktopHost.${capability} is not available`);
}
var NOOP_DESKTOP_HOST_CLIPBOARD = {
	readText: () => desktopHostUnavailable("clipboard.readText"),
	writeText: () => desktopHostUnavailable("clipboard.writeText"),
	writeImageFromDataUrl: () => desktopHostUnavailable("clipboard.writeImageFromDataUrl")
};
var NOOP_DESKTOP_HOST_SESSION = { cookies: {
	set: async () => desktopHostUnavailable("session.cookies.set"),
	get: async () => desktopHostUnavailable("session.cookies.get"),
	remove: async () => desktopHostUnavailable("session.cookies.remove")
} };
var NOOP_DESKTOP_HOST = {
	app: NOOP_DESKTOP_HOST_APP,
	dialog: NOOP_DESKTOP_HOST_DIALOG,
	shell: NOOP_DESKTOP_HOST_SHELL,
	clipboard: NOOP_DESKTOP_HOST_CLIPBOARD,
	network: {
		fetch: async () => ({
			ok: false,
			status: 503,
			statusText: "Service Unavailable",
			url: "",
			headers: new Headers(),
			body: null,
			json: async () => ({}),
			text: async () => "",
			arrayBuffer: async () => /* @__PURE__ */ new ArrayBuffer(0)
		}),
		getDefaultSession: () => NOOP_DESKTOP_HOST_SESSION,
		getSessionPartition: () => NOOP_DESKTOP_HOST_SESSION,
		clearDefaultSessionCookiesForDomains: async () => 0,
		resolveProxy: async () => "DIRECT",
		applyProxySettings: async () => ({
			HTTP_PROXY: "",
			HTTPS_PROXY: "",
			NO_PROXY: ""
		})
	},
	auth: {
		decryptLegacyAuthSession: async () => void 0,
		getTuringDeviceToken: async () => void 0
	},
	window: {
		minimize: () => void 0,
		maximize: () => void 0,
		close: () => void 0,
		isMaximized: () => false,
		cancelPendingClose: () => void 0,
		confirmClose: () => void 0,
		setTrafficLightsVisible: () => void 0,
		reload: () => void 0,
		updateTitleBarOverlay: () => void 0,
		syncNativeThemeColors: () => void 0,
		getColorScheme: async () => void 0,
		isFullscreen: () => false,
		setFullscreen: () => void 0,
		toggleFullscreen: () => false,
		startWindowDrag: () => void 0,
		endWindowDrag: () => void 0,
		isFocused: () => false,
		onFocusChange: () => () => void 0,
		onFullscreenChange: () => () => void 0,
		onMaximizeChange: () => () => void 0,
		send: () => false,
		toggleDevTools: () => void 0,
		performEditCommand: () => void 0
	},
	notification: {
		isSupported: () => false,
		requestRegistration: async () => void 0,
		send: () => false
	},
	permissions: {
		getMicrophonePermissionStatus: () => "unknown",
		getMicrophonePermission: async () => "unknown",
		requestMicrophonePermission: async () => "unknown",
		openMicrophoneSystemSettings: async () => void 0,
		checkAccessibility: () => "unauthorized"
	},
	wechatShare: {
		shareLink: async () => ({
			success: false,
			errcode: 7,
			errmsg: "WeChat share host is unavailable"
		}),
		launchMiniProgram: async () => ({
			success: false,
			errcode: 7,
			errmsg: "WeChat share host is unavailable"
		}),
		shareMiniProgram: async () => ({
			success: false,
			errcode: 7,
			errmsg: "WeChat share host is unavailable"
		}),
		shareFile: async () => ({
			success: false,
			errcode: 7,
			errmsg: "WeChat share host is unavailable"
		})
	},
	globalShortcut: { updateToggleWindow: (accelerator) => ({
		success: false,
		accelerator
	}) },
	showTaskCompletedNotification: () => false,
	showTaskPendingNotification: () => false,
	registerLocalStorageMigrationCompletion: () => () => void 0
};
//#endregion
//#region src/main/skills/project-resource-loader.ts
/**
* ProjectResourceLoader — 项目本地任务的 skill 下载服务。
*
* 职责：
* - 根据 createSession 传入的 projectResources，下载 skill zips 并解压
* - 解压到隔离目录：$CODEBUDDY_CONFIG_DIR/project-resources/<projectId>/<skillId>/
* - 返回目录路径列表，由 createSession handler 通过 opts.env 传给 CLI
* - CLI 通过 CODEBUDDY_SESSION_SKILL_DIRS env 扫描这些额外目录
*
* 设计原则：
* - 不侵入 ConnectorService / SessionManager
* - 独立模块，由 createSession handler 按需调用
* - best-effort：单个 skill 下载失败不阻塞整体
* - 只在有 projectResources 时触发，普通本地任务不受影响
* - per-project 隔离：不同项目的 skill 互不影响
*/
/**
* 项目资源本地存储目录名（位于 $CODEBUDDY_CONFIG_DIR/ 下）。
* 定义在这里而不是 project-resource-manager：manager 在模块顶层就 new 了 loader 单例，
* 反向 import 会构成循环依赖，以 loader 为入口时拿到的 ProjectResourceLoader 是 undefined。
*/
var PROJECT_RESOURCES_DIR_NAME = "project-resources";
/** skill 目录下记录下载来源 ETag / Last-Modified 的文件名（用于条件请求缓存校验）。 */
var SKILL_META_FILE = ".skill-source-meta.json";
var ProjectResourceLoader = class {
	baseDir;
	/**
	* @param configDir CLI 配置根目录（$CODEBUDDY_CONFIG_DIR 或 ~/.codebuddy）
	*/
	constructor(configDir) {
		this.baseDir = (0, node_path.join)(configDir, PROJECT_RESOURCES_DIR_NAME);
	}
	/**
	* 下载项目 skill 到隔离目录，返回路径供 env 注入。
	* best-effort：单项失败记日志但不阻塞。
	* 只在有 projectResources 时调用——普通本地任务不走这里。
	*/
	async installProjectSkills(projectId, resources) {
		const result = {
			skillDir: void 0,
			installedSkills: 0,
			failedSkills: []
		};
		const allSkills = [];
		if (resources.connectorSkills?.length) for (const s of resources.connectorSkills) allSkills.push({
			id: s.skillId,
			url: s.downloadUrl
		});
		if (resources.projectSkills?.length) for (const s of resources.projectSkills) allSkills.push({
			id: s.name,
			url: s.downloadUrl
		});
		const projectDir = (0, node_path.join)(this.baseDir, projectId);
		const relFromBase = (0, node_path.relative)((0, node_path.resolve)(this.baseDir), (0, node_path.resolve)(projectDir));
		if (!relFromBase || relFromBase.startsWith("..") || (0, node_path.isAbsolute)(relFromBase)) {
			import_src.default.error("[ProjectResourceLoader] projectId escapes project-resources base dir, refuse install", {
				projectId,
				baseDir: this.baseDir
			});
			return result;
		}
		const activeSkillIds = new Set(allSkills.map((skill) => skill.id));
		const canPrune = !resources.partial;
		import_src.default.info("[ProjectResourceLoader] installProjectSkills:resolve", {
			projectId,
			baseDir: this.baseDir,
			projectDir,
			allSkillCount: allSkills.length,
			allSkillIds: [...activeSkillIds],
			partial: !!resources.partial
		});
		if (!allSkills.length) {
			if (canPrune && (0, node_fs.existsSync)(projectDir)) await this.pruneInactiveSkillDirs(projectDir, activeSkillIds);
			else import_src.default.warn("[ProjectResourceLoader] empty but partial resource list, skip prune", { projectId });
			return result;
		}
		await (0, node_fs_promises.mkdir)(projectDir, { recursive: true });
		result.skillDir = projectDir;
		const CONCURRENCY = 5;
		for (let i = 0; i < allSkills.length; i += CONCURRENCY) {
			const batch = allSkills.slice(i, i + CONCURRENCY);
			const batchResults = await Promise.allSettled(batch.map((skill) => this.downloadAndInstallSkill(projectDir, skill.id, skill.url)));
			for (let j = 0; j < batchResults.length; j++) if (batchResults[j].status === "fulfilled") result.installedSkills++;
			else result.failedSkills.push(batch[j].id);
		}
		if (canPrune && result.failedSkills.length === 0) await this.pruneInactiveSkillDirs(projectDir, activeSkillIds);
		else import_src.default.warn("[ProjectResourceLoader] skip prune", {
			projectId,
			partial: !!resources.partial,
			failedSkills: result.failedSkills
		});
		import_src.default.info("[ProjectResourceLoader] installProjectSkills done", {
			projectId,
			skillDir: projectDir,
			installed: result.installedSkills,
			failed: result.failedSkills.length
		});
		return result;
	}
	/**
	* 删除不在本轮 active 列表里的技能目录。
	*
	* 这里必须真删，不能沿用「给 SKILL.md 写 `disable: true`」的老做法：
	* - 解压后的真实布局是 `<skillId>/<技能名>/SKILL.md`（zip 自带一层与技能同名的顶层
	*   目录），老实现只在 `<skillId>/SKILL.md` 找 frontmatter，浅一层，`existsSync` 恒
	*   为 false，disable 从来没有写进去过；
	* - 即便写进去了也不够：CLI 侧 `disable` 只映射成 `disableModelInvocation`，
	*   `SkillProductProvider` 仍会加载该技能并让它占住同名去重槽位，反而可能把新版本
	*   挤掉（见 packages/agent-cli/src/node/product/skill-product-provider.ts 的
	*   `addSkills` 按 name 去重 + `scanSkillsDirectory` 递归到 5 层）。
	*
	* 代价是重新启用某个技能时要再下载一次，远小于旧版本技能持续污染模型上下文。
	*/
	async pruneInactiveSkillDirs(projectDir, activeSkillIds) {
		let entries;
		try {
			entries = (0, node_fs.readdirSync)(projectDir, { withFileTypes: true });
		} catch (err) {
			import_src.default.warn("[ProjectResourceLoader] pruneInactiveSkillDirs readdir failed:", err);
			return;
		}
		for (const entry of entries) {
			if (!entry.isDirectory() || activeSkillIds.has(entry.name)) continue;
			const staleDir = (0, node_path.join)(projectDir, entry.name);
			try {
				await (0, node_fs_promises.rm)(staleDir, {
					recursive: true,
					force: true
				});
				import_src.default.info("[ProjectResourceLoader] pruned inactive skill dir", {
					projectDir,
					skillId: entry.name
				});
			} catch (err) {
				import_src.default.warn(`[ProjectResourceLoader] prune inactive skill dir ${staleDir} failed:`, err);
			}
		}
	}
	/**
	* 下载单个 skill zip 并解压到 projectDir/<skillId>/。
	* 如果目录已存在且有文件，跳过（简单缓存）。
	*/
	async downloadAndInstallSkill(projectDir, skillId, downloadUrl) {
		const skillDir = (0, node_path.join)(projectDir, skillId);
		const metaPath = (0, node_path.join)(skillDir, SKILL_META_FILE);
		const cachedMeta = this.readSkillMeta(metaPath);
		const hasCachedFiles = this.hasSkillFiles(skillDir);
		if (hasCachedFiles && !cachedMeta) return;
		await (0, node_fs_promises.mkdir)(skillDir, { recursive: true });
		const tempDir = await (0, node_fs_promises.mkdtemp)((0, node_path.join)((0, node_os.tmpdir)(), "wb-proj-skill-"));
		const zipPath = (0, node_path.join)(tempDir, `${skillId}.zip`);
		try {
			const conditionalHeaders = {};
			if (hasCachedFiles && cachedMeta) {
				if (cachedMeta.etag) conditionalHeaders["If-None-Match"] = cachedMeta.etag;
				if (cachedMeta.lastModified) conditionalHeaders["If-Modified-Since"] = cachedMeta.lastModified;
			}
			const response = await fetch(downloadUrl, { headers: conditionalHeaders });
			if (response.status === 304) return;
			if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
			if (hasCachedFiles) {
				await (0, node_fs_promises.rm)(skillDir, {
					recursive: true,
					force: true
				}).catch(() => {});
				await (0, node_fs_promises.mkdir)(skillDir, { recursive: true });
			}
			const writeStream = (0, node_fs.createWriteStream)(zipPath);
			await (0, node_stream_promises.pipeline)(node_stream.Readable.fromWeb(response.body), writeStream);
			new import_adm_zip.default(zipPath).extractAllTo(skillDir, true);
			this.writeSkillMeta(metaPath, {
				etag: response.headers.get("etag") ?? void 0,
				lastModified: response.headers.get("last-modified") ?? void 0
			});
			import_src.default.info(`[ProjectResourceLoader] skill installed: ${skillId}`);
		} catch (err) {
			await (0, node_fs_promises.rm)(skillDir, {
				recursive: true,
				force: true
			}).catch(() => {});
			import_src.default.warn(`[ProjectResourceLoader] skill ${skillId} download failed:`, err);
			throw err;
		} finally {
			await (0, node_fs_promises.rm)(tempDir, {
				recursive: true,
				force: true
			}).catch(() => {});
		}
	}
	/** skill 目录是否含真实文件（排除 meta 文件本身）。 */
	hasSkillFiles(skillDir) {
		if (!(0, node_fs.existsSync)(skillDir)) return false;
		try {
			return (0, node_fs.readdirSync)(skillDir).some((name) => name !== SKILL_META_FILE);
		} catch {
			return false;
		}
	}
	readSkillMeta(metaPath) {
		if (!(0, node_fs.existsSync)(metaPath)) return;
		try {
			const parsed = JSON.parse((0, node_fs.readFileSync)(metaPath, "utf-8"));
			if (!parsed.etag && !parsed.lastModified) return;
			return {
				etag: parsed.etag,
				lastModified: parsed.lastModified
			};
		} catch {
			return;
		}
	}
	writeSkillMeta(metaPath, meta) {
		if (!meta.etag && !meta.lastModified) return;
		try {
			(0, node_fs.writeFileSync)(metaPath, JSON.stringify(meta), "utf-8");
		} catch {}
	}
};
//#endregion
//#region src/main/skills/project-resource-manager.ts
/**
* ProjectResourceManager — 项目本地任务资源的统一管理器。
*
* 职责：
* 1. 管理 per-project 的 skill 目录 + sanitized MCP config 状态
* 2. 维护 sessionId → projectId 的映射，让 backend 能按 sessionId 取环境变量和 MCP servers
* 3. 支持项目 connector 动态变化时刷新资源
* 4. 磁盘只持久化不含 token 的 MCP server 状态，运行时再按 session 注入 token
* 5. 对外提供 getEnvForSession / getMcpServersForSession，backend initializeInternal 调用
*
* 设计原则：
* - 替换 ws-rpc-bootstrap 里的简单 Map 缓存
* - 不侵入 ConnectorService / SessionManager / CLI
* - 独立模块，createSession/loadSession handler 调用注册/查询方法
* - 只有项目本地任务的 session 才有数据，普通任务返回 undefined
*/
var BUILTIN_PROJECT_MCPS = [{
	serverName: "wb-issues",
	path: "/console/agent-gateway/wb-issues/_internal/issues/mcp",
	description: "Project todo/issue management MCP. Tools: todo_list (filter by status/scope), todo_show (details + allowed transitions + attachments), todo_create, todo_update, todo_delete, todo_transition (status change), todo_statuses, todo_history, todo_comments, todo_add_comment, todo_update_comment, todo_delete_comment, todo_add_attachment, todo_remove_attachment, project_members.",
	needsUserId: true,
	deferLoading: true
}];
var ProjectResourceManager = class {
	configDir;
	loader;
	getToken;
	getEndpoint;
	getUserId;
	/** projectId → 资源状态 */
	projectStates = /* @__PURE__ */ new Map();
	/** sessionId → projectId 映射 */
	sessionProjectMap = /* @__PURE__ */ new Map();
	constructor(deps) {
		this.configDir = deps.configDir;
		this.loader = deps.loader ?? new ProjectResourceLoader(deps.configDir);
	}
	/** 注入 token 获取函数（app 启动后调用） */
	setTokenProvider(getToken) {
		this.getToken = getToken;
	}
	/** 注入 endpoint 获取函数（用于拼内置 MCP 的 url）。 */
	setEndpointProvider(getEndpoint) {
		this.getEndpoint = getEndpoint;
	}
	/** 注入当前用户 ID 获取函数（内置 MCP 的 x-user-id 头需要）。 */
	setUserIdProvider(getUserId) {
		this.getUserId = getUserId;
	}
	/**
	* 创建新的项目本地任务时调用：下载 skill + 准备 MCP config。
	* 返回值会被 merge 到 opts.env 传给 CLI sidecar。
	*/
	async registerSession(sessionId, projectId, resources) {
		this.sessionProjectMap.set(sessionId, projectId);
		const loadResult = await this.loader.installProjectSkills(projectId, resources);
		const mcpConfigJson = this.buildMcpConfigJson(projectId, resources);
		const state = {
			skillDir: loadResult.skillDir,
			mcpConfigJson
		};
		this.projectStates.set(projectId, state);
		if (mcpConfigJson) this.persistMcpConfig(projectId, mcpConfigJson);
		else this.removeMcpConfig(projectId);
		return this.buildEnv(state, projectId);
	}
	/**
	* 恢复历史对话时调用：根据 projectId 恢复资源 env。
	* 从内存缓存或磁盘恢复。
	*/
	registerSessionFromRecord(sessionId, projectId) {
		this.sessionProjectMap.set(sessionId, projectId);
		if (this.projectStates.has(projectId)) return;
		const state = this.restoreProjectState(projectId);
		if (state) this.projectStates.set(projectId, state);
	}
	/**
	* backend initializeInternal 调用：获取 session 对应的项目资源 env。
	* 普通任务返回 undefined。
	*/
	getEnvForSession(sessionId) {
		const projectId = this.sessionProjectMap.get(sessionId);
		if (!projectId) return;
		const state = this.projectStates.get(projectId);
		if (!state) return;
		return this.buildEnv(state, projectId);
	}
	/** 获取当前 session 对应项目的 MCP servers，避免跨项目合并。 */
	getMcpServersForSession(sessionId) {
		const projectId = this.sessionProjectMap.get(sessionId);
		if (!projectId) return;
		const state = this.projectStates.get(projectId) ?? this.restoreProjectState(projectId) ?? void 0;
		if (!state?.mcpConfigJson) return;
		const token = this.getToken?.();
		const userId = this.getUserId?.();
		const servers = {};
		try {
			const parsed = JSON.parse(state.mcpConfigJson);
			for (const [name, config] of Object.entries(parsed.mcpServers || {})) {
				const cfg = config;
				if (cfg.disabled) continue;
				const sanitized = this.sanitizeMcpServerConfig(cfg);
				const builtin = BUILTIN_PROJECT_MCPS.find((b) => b.serverName === name);
				const needsUserId = builtin?.needsUserId ?? false;
				const headers = { ...sanitized.headers || {} };
				if (token) headers.Authorization = `Bearer ${token}`;
				if (needsUserId && userId) headers["x-user-id"] = userId;
				if (projectId) headers["x-project-id"] = projectId;
				servers[name] = {
					url: sanitized.url,
					type: sanitized.type || "http",
					description: sanitized.description,
					defer_loading: builtin ? builtin.deferLoading : sanitized.defer_loading ?? false,
					...Object.keys(headers).length ? { headers } : {}
				};
			}
		} catch {}
		return Object.keys(servers).length ? servers : void 0;
	}
	/** 账号重登预热：快照当前已注册 session 的项目内置/connector MCP 描述。 */
	getMcpServersSnapshotBySession() {
		const snapshot = {};
		for (const sessionId of this.sessionProjectMap.keys()) {
			const servers = this.getMcpServersForSession(sessionId);
			if (servers) snapshot[sessionId] = servers;
		}
		return snapshot;
	}
	/**
	* 项目 connector 变化时刷新资源（动态添加/删除 connector）。
	* 重新下载 skill + 更新 sanitized MCP config；已运行 CLI 不热更新 MCP，下次 backend restart/create 生效。
	*/
	async refreshProjectResources(projectId, resources) {
		const loadResult = await this.loader.installProjectSkills(projectId, resources);
		const mcpConfigJson = this.buildMcpConfigJson(projectId, resources);
		const state = {
			skillDir: loadResult.skillDir,
			mcpConfigJson
		};
		this.projectStates.set(projectId, state);
		if (mcpConfigJson) this.persistMcpConfig(projectId, mcpConfigJson);
		else this.removeMcpConfig(projectId);
		import_src.default.info("[ProjectResourceManager] refreshProjectResources done", { projectId });
	}
	buildMcpConfigJson(projectId, resources) {
		const mcpServers = {};
		const existing = this.projectStates.get(projectId) ?? this.restoreProjectState(projectId) ?? void 0;
		if (existing?.mcpConfigJson) try {
			const parsed = JSON.parse(existing.mcpConfigJson);
			for (const [name, config] of Object.entries(parsed.mcpServers || {})) mcpServers[name] = {
				...this.sanitizeMcpServerConfig(config),
				disabled: true
			};
		} catch {}
		for (const mcp of resources.mcpServers ?? []) mcpServers[mcp.serverName] = {
			url: mcp.gatewayUrl,
			type: mcp.transport || "http",
			defer_loading: true,
			description: `Project connector MCP server: ${mcp.connectorName}`
		};
		const endpoint = this.getEndpoint?.()?.replace(/\/+$/, "");
		if (endpoint) for (const builtin of BUILTIN_PROJECT_MCPS) mcpServers[builtin.serverName] = {
			url: endpoint + builtin.path,
			type: "http",
			defer_loading: builtin.deferLoading,
			description: builtin.description
		};
		return Object.keys(mcpServers).length ? JSON.stringify({ mcpServers }) : void 0;
	}
	buildEnv(state, _projectId) {
		const env = {};
		if (state.skillDir) {
			const resourcesRoot = (0, node_path.resolve)(this.configDir, PROJECT_RESOURCES_DIR_NAME);
			const canonical = (0, node_path.resolve)(state.skillDir);
			const rel = (0, node_path.relative)(resourcesRoot, canonical);
			if (rel && !rel.startsWith("..") && !(0, node_path.isAbsolute)(rel)) env.CODEBUDDY_SESSION_SKILL_DIRS = canonical;
			else import_src.default.warn("[ProjectResourceManager] skillDir escapes project-resources root, skip env injection", {
				skillDir: state.skillDir,
				resourcesRoot
			});
		}
		return env;
	}
	/** 持久化 MCP config 到 project-resources/<projectId>/mcp.json（不写入 token）。 */
	persistMcpConfig(projectId, json) {
		try {
			const dir = (0, node_path.join)(this.configDir, PROJECT_RESOURCES_DIR_NAME, projectId);
			(0, node_fs.mkdirSync)(dir, { recursive: true });
			(0, node_fs.writeFileSync)((0, node_path.join)(dir, "mcp.json"), this.sanitizeMcpConfigJson(json), "utf-8");
		} catch (err) {
			import_src.default.warn("[ProjectResourceManager] persistMcpConfig failed:", err);
		}
	}
	sanitizeMcpConfigJson(json) {
		try {
			const parsed = JSON.parse(json);
			for (const [name, config] of Object.entries(parsed.mcpServers || {})) parsed.mcpServers[name] = this.sanitizeMcpServerConfig(config);
			return JSON.stringify(parsed);
		} catch {
			return json;
		}
	}
	sanitizeMcpServerConfig(config) {
		const next = { ...config || {} };
		if (next.headers) {
			const headers = { ...next.headers };
			delete headers.Authorization;
			delete headers.authorization;
			if (Object.keys(headers).length > 0) next.headers = headers;
			else delete next.headers;
		}
		return next;
	}
	/** 清除旧的 MCP config 文件（connector 断开/删除后避免残留） */
	removeMcpConfig(projectId) {
		try {
			const mcpFile = (0, node_path.join)(this.configDir, PROJECT_RESOURCES_DIR_NAME, projectId, "mcp.json");
			if ((0, node_fs.existsSync)(mcpFile)) (0, node_fs.unlinkSync)(mcpFile);
		} catch {}
	}
	/** 从文件系统恢复项目资源状态 */
	restoreProjectState(projectId) {
		const projectDir = (0, node_path.join)(this.configDir, PROJECT_RESOURCES_DIR_NAME, projectId);
		if (!(0, node_fs.existsSync)(projectDir)) return null;
		const state = {};
		try {
			if ((0, node_fs.readdirSync)(projectDir).filter((e) => e !== "mcp.json").length > 0) state.skillDir = projectDir;
		} catch {}
		const mcpFile = (0, node_path.join)(projectDir, "mcp.json");
		if ((0, node_fs.existsSync)(mcpFile)) try {
			state.mcpConfigJson = this.sanitizeMcpConfigJson((0, node_fs.readFileSync)(mcpFile, "utf-8"));
		} catch {}
		return state.skillDir || state.mcpConfigJson ? state : null;
	}
};
/** 全局单例，所有消费方直接 import 使用 */
var projectResourceManager = new ProjectResourceManager({ configDir: process.env.CODEBUDDY_CONFIG_DIR || (0, node_path.join)((0, node_os.homedir)(), ".codebuddy") });
//#endregion
//#region ../../packages/ardot-infra/src/design-feature-override.ts
/**
* Ardot 设计入口特性开关 + 临时 override 常量的 **跨进程 SSOT**。
*
* renderer(`@genie/agent-ui` utils/ardot-design-feature.ts) 与 desktop 主进程
* (`apps/workbuddy-desktop` main/system/runtime/ardot-design-feature.ts) 都必须
* 从同一份 gate 实现 + 同一个 globalThis override key 出发。两端如果字符串或
* 判定逻辑漂移(哪怕只是拼写差异 / 一端多加一层 log),会造成:
*   UI 显示设计入口(renderer override=true) → 用户新建 design 会话 →
*   daemon 校验失败(desktop 主进程 override=false, isDesignFeatureEnabled 走
*   EnableArdot 严格判定)。
*
* 通过把 `ENABLE_ARDOT_DESIGN_FEATURE` / `isEnableArdotDesignEnabled` /
* `hasArdotDesignUngateOverride` / `ARDOT_DESIGN_UNGATE_GLOBAL_KEY` 全部收敛在
* 本文件,重命名 / typo / 判定分支新增在 tsc / grep 一致失败,不再需要依赖
* 两端注释互相引用来维系约定。renderer 与 desktop 的本地 wrapper 仅保留
* 类型 / enum 校验断言,判定逻辑不重复。
*
* ⚠️ override 属于临时通道,与 issue #72191 的收尾清单绑定;正式全量发布 /
* 早期体验结束后,请同时删除本文件与两端 wrapper 中 override 分支的引用点。
*/
/** ProductFeature key,与 `@genie/product` `ProductFeature.EnableArdot` 保持字面量一致。 */
var ENABLE_ARDOT_DESIGN_FEATURE$1 = "EnableArdot";
var ARDOT_DESIGN_UNGATE_GLOBAL_KEY = "__ARDOT_DESIGN_UNGATE__";
/**
* 读取当前进程 `globalThis` 上的 override 值。跨端复用同一实现,避免任一端
* 出现『读到 truthy 就放行』或『严格 === true』的语义分裂。
*
* 语义:仅在 override === true(严格布尔)时视为放开;其它值(undefined /
* 字符串 'true' / 1 等)一律视为未设置,保持默认的 EnableArdot 判定。
*/
function hasArdotDesignUngateOverride() {
	try {
		if (typeof globalThis === "undefined") return false;
		return globalThis[ARDOT_DESIGN_UNGATE_GLOBAL_KEY] === true;
	} catch {
		return false;
	}
}
/**
* Ardot 设计入口最终判定。renderer(UI) 与 desktop 主进程(daemon 校验) 共同 owner:
*   - override === true → 直接放行(内部灰度通道,SSOT 仍在 EnableArdot)
*   - 否则严格判断 productFeatures?.EnableArdot === true
*
* 后续新增日志 / 多层灰度 / 到期兜底等分支时,只需要改这一份实现,renderer 与
* daemon 侧自动同步。
*/
function isEnableArdotDesignEnabled$1(productFeatures) {
	if (hasArdotDesignUngateOverride()) return true;
	return productFeatures?.[ENABLE_ARDOT_DESIGN_FEATURE$1] === true;
}
//#endregion
//#region src/main/system/runtime/ardot-design-feature.ts
/**
* Ardot Design 入口特性开关 desktop 主进程引用点。
*
* 判定逻辑收敛在 `@genie/ardot-infra/design-feature-override`(跨进程 SSOT),
* renderer 与 desktop 主进程都从该共享包 import;本文件仅做类型 / enum 校验:
*
*   1. `ENABLE_ARDOT_DESIGN_FEATURE` 沿用 `ProductFeature.EnableArdot` 的 enum
*      作为 key(desktop 侧倾向 enum 而非 string 字面量),用运行时断言把 enum
*      与共享 SSOT 常量字面量绑死 —— 一旦有人改了 renderer / desktop / product
*  三处任一常量,tsc 会先失败或运行时立刻抛错,不会静默漂移。
*   2. 通过 re-export `sharedIsEnableArdotDesignEnabled` 保持既有 daemon-bootstrap
*      的 import 路径不变(`./ardot-design-feature`),避免大规模 refactor。
*
* Gating 完全由 `EnableArdot` feature flag 决定;海外构建的关闭由 product 配置
* (缺省即 false)实现,不再用构建目录(workbuddy-ai)强制 false,与 renderer 端
* `packages/agent-ui/src/utils/ardot-design-feature.ts` 保持一致。
*/
var ENABLE_ARDOT_DESIGN_FEATURE = require_common$1.ProductFeature.EnableArdot;
if (ENABLE_ARDOT_DESIGN_FEATURE !== "EnableArdot") throw new Error(`[ardot-design-feature] ENABLE_ARDOT_DESIGN_FEATURE mismatch: ProductFeature.EnableArdot="${ENABLE_ARDOT_DESIGN_FEATURE}" vs shared="${ENABLE_ARDOT_DESIGN_FEATURE$1}"`);
var isEnableArdotDesignEnabled = isEnableArdotDesignEnabled$1;
//#endregion
//#region ../../packages/workbuddy-server/src/appearance/cloud-appearance-repo.ts
/** 默认路由前缀（Web 端） */
var DEFAULT_ROUTE_PREFIX$1 = "/portal";
/** 默认平台标识（与 Desktop RPC handler 保持一致） */
var DEFAULT_PLATFORM = "client";
var SELECTION_TIMEOUT_MS = 2e3;
var SELECTION_RESOURCE_KEY = /^[a-z0-9][a-z0-9_-]{0,63}$/;
/**
* 后端 vip_level 到领域模型 vipLevel 的映射。
* - `standard` 为后端历史命名（产品「标准版」），收敛到 `pro`。
* - `flagship` / `exclusive` 与 `ultimate` 同档（旗舰/尊享），全部归一到 `ultimate`，
*   下游按 `ultimate` 统一处理，避免 DTO 端出现的账号版本细分穿透到 UI。
*/
var VIP_LEVEL_MAP = {
	free: "free",
	standard: "pro",
	pro: "pro",
	advanced: "advanced",
	ultimate: "ultimate",
	flagship: "ultimate",
	exclusive: "ultimate"
};
var RESOURCE_KINDS = new Set(["theme", "color"]);
var APPEARANCE_MODES = new Set([
	"light",
	"dark",
	"system"
]);
var THEME_SERIES_DTO = new Set([
	"craft",
	"collection",
	"coop"
]);
function withId(id, msg) {
	return `${msg} [resource=${typeof id === "string" && id ? id : "<no-id>"}]`;
}
function assertAppearanceVipLevel(value, id) {
	if (typeof value !== "string" || !Object.prototype.hasOwnProperty.call(VIP_LEVEL_MAP, value)) throw new Error(withId(id, `unsupported vip_level: ${String(value)}`));
}
function assertNonEmptyString(value, field, id) {
	if (typeof value !== "string" || !value.trim() || value.length > 256) throw new Error(withId(id, `invalid ${field}`));
}
function assertOptionalHttpsUrl(value, field, id) {
	if (value === void 0) return;
	if (typeof value !== "string") throw new Error(withId(id, `invalid ${field}`));
	try {
		const url = new URL(value);
		if (url.protocol !== "https:" || url.username || url.password || url.port) throw new Error("unsafe");
	} catch {
		throw new Error(withId(id, `invalid ${field}`));
	}
}
function assertResourceDTO(dto) {
	assertNonEmptyString(dto.id, "id");
	assertNonEmptyString(dto.name, "name", dto.id);
	assertNonEmptyString(dto.name_en, "name_en", dto.id);
	if (!RESOURCE_KINDS.has(dto.kind)) throw new Error(withId(dto.id, "invalid kind"));
	assertAppearanceVipLevel(dto.vip_level, dto.id);
	if (!Number.isFinite(dto.updated_at) || dto.updated_at < 0) throw new Error(withId(dto.id, "invalid updated_at"));
	assertOptionalHttpsUrl(dto.cover_url, "cover_url", dto.id);
	assertOptionalHttpsUrl(dto.preview_url, "preview_url", dto.id);
	assertOptionalHttpsUrl(dto.zip_url, "zip_url", dto.id);
	if (dto.kind === "theme") {
		if (!THEME_SERIES_DTO.has(dto.series)) throw new Error(withId(dto.id, "invalid series"));
		if (!APPEARANCE_MODES.has(dto.appearance)) throw new Error(withId(dto.id, "invalid appearance"));
	}
}
function summarizeResources(resources) {
	if (!Array.isArray(resources)) return `type=${typeof resources}`;
	const sample = resources.slice(0, 3).map((r) => ({
		id: r?.id,
		kind: r?.kind,
		vip_level: r?.vip_level,
		series: r?.series,
		appearance: r?.appearance,
		has_zip: typeof r?.zip_url === "string"
	}));
	return `count=${resources.length} sample=${JSON.stringify(sample)}`;
}
function mapSelectionDTO(value) {
	const dto = value;
	if (!dto || !RESOURCE_KINDS.has(dto.kind) || typeof dto.resource_key !== "string" || !SELECTION_RESOURCE_KEY.test(dto.resource_key) || typeof dto.updated_at !== "string" || !Number.isFinite(Date.parse(dto.updated_at))) throw new Error("invalid appearance selection");
	return {
		kind: dto.kind,
		resourceKey: dto.resource_key,
		updatedAt: dto.updated_at
	};
}
var CloudAppearanceRepo = class {
	constructor({ context, runtime, routePrefix, platform }) {
		this.ctx = context;
		this.runtime = runtime;
		this.routePrefix = routePrefix ?? DEFAULT_ROUTE_PREFIX$1;
		this.platform = platform ?? DEFAULT_PLATFORM;
	}
	async getSelections() {
		const resp = await this.ctx.http.get(`${this.routePrefix}/user-asset/appearance/get`, { timeoutMs: SELECTION_TIMEOUT_MS });
		const body = this.unwrapResponse(resp);
		this.assertSuccess(body);
		if (!Array.isArray(body?.data?.items)) throw new Error("bad response: missing data.items");
		return body.data.items.map(mapSelectionDTO);
	}
	async setSelection(kind, resourceKey) {
		if (!RESOURCE_KINDS.has(kind) || !SELECTION_RESOURCE_KEY.test(resourceKey)) throw new Error("invalid appearance selection");
		const resp = await this.ctx.http.post(`${this.routePrefix}/user-asset/appearance/set`, {
			kind,
			resource_key: resourceKey
		}, { timeoutMs: SELECTION_TIMEOUT_MS });
		const body = this.unwrapResponse(resp);
		this.assertSuccess(body);
		return mapSelectionDTO(body?.data);
	}
	async listResources(options) {
		const { version, lang, kind } = this.resolveRuntimeParams(options);
		const resp = await this.ctx.http.post(`${this.routePrefix}/operation-platform/appearance/resources`, {
			platform: this.platform,
			kind,
			version,
			lang
		});
		const body = this.unwrapResponse(resp);
		if (body?.code !== 0) throw new Error(`bad response: code=${body?.code}, msg=${body?.msg}`);
		if (!Array.isArray(body?.data?.resources)) throw new Error("bad response: missing data.resources");
		const filtered = body.data.resources.filter((dto) => dto?.kind === kind);
		try {
			return filtered.map(mapResourceDTO);
		} catch (error) {
			throw new Error(`${String(error?.message ?? error)} | summary: ${summarizeResources(filtered)}`);
		}
	}
	assertSuccess(body) {
		if (body?.code !== 0) throw new Error(`bad response: code=${body?.code}, msg=${body?.msg}, requestId=${body?.requestId ?? "<none>"}`);
	}
	/**
	* 兼容两种 http 返回格式：
	* - Web httpService (Axios)：返回 { data: { code, msg, data, ... } }
	* - Desktop createMainProcessHttp：直接返回 JSON body { code, msg, data, ... }
	* 区分方式：如果 resp 本身含 code 字段，说明是直返 envelope；否则取 resp.data
	*/
	unwrapResponse(resp) {
		return "code" in (resp ?? {}) ? resp : resp?.data;
	}
	/**
	* 统一解析 runtime 参数：
	* - version 来自 runtime getter
	* - lang 优先 options.lang（renderer 端 i18n 实时值），否则回退 runtime.getLang
	* - kind 默认 'theme'（本期 UI 只消费主题）
	* - edition 不传，由后端根据用户身份自动推断
	*/
	resolveRuntimeParams(options) {
		return {
			version: this.runtime.getVersion(),
			lang: options?.lang ?? this.runtime.getLang(),
			kind: options?.kind ?? "theme"
		};
	}
};
/**
* 后端资源 DTO → 领域模型映射。
*
* 字段重命名：id→resourceKey，name→nameZh，vip_level→vipLevel（含 standard→pro 归一化）。
* 主题 appearance 直接透传，语义与 spec §3.2 对齐（light/dark/system）。
*/
function mapResourceDTO(dto) {
	assertResourceDTO(dto);
	if (dto.kind === "theme") return mapThemeDTO(dto);
	return mapColorDTO(dto);
}
function mapThemeDTO(dto) {
	return {
		kind: "theme",
		resourceKey: dto.id,
		nameZh: dto.name,
		nameEn: dto.name_en,
		vipLevel: VIP_LEVEL_MAP[dto.vip_level],
		updatedAt: dto.updated_at,
		coverUrl: dto.cover_url,
		previewUrl: dto.preview_url,
		zipUrl: dto.zip_url,
		series: dto.series,
		appearance: dto.appearance
	};
}
function mapColorDTO(dto) {
	return {
		kind: "color",
		resourceKey: dto.id,
		nameZh: dto.name,
		nameEn: dto.name_en,
		vipLevel: VIP_LEVEL_MAP[dto.vip_level],
		updatedAt: dto.updated_at,
		coverUrl: dto.cover_url,
		previewUrl: dto.preview_url,
		zipUrl: dto.zip_url
	};
}
/** 单个 zip 下载 + 解压总时长兜底（避免慢网导致 UI 长期挂起） */
var DEFAULT_DOWNLOAD_TIMEOUT_MS = 6e4;
/** 单个 zip 未压缩大小上限（20MB），防止 zip bomb */
var DEFAULT_MAX_UNZIPPED_BYTES = 20 * 1024 * 1024;
/** 单个 zip 条目数上限，防止 zip bomb */
var DEFAULT_MAX_ENTRIES = 500;
/** 允许直接内嵌到 CSS `url()` 里的资源扩展名白名单 */
var ALLOWED_ASSET_EXTS = new Set([
	".css",
	".png",
	".jpg",
	".jpeg",
	".gif",
	".webp",
	".svg",
	".woff",
	".woff2",
	".ttf",
	".otf"
]);
/**
* macOS 在 Finder 压缩时会塞入 `__MACOSX/._xxx`（AppleDouble）与 `.DS_Store`。
* 它们没有可用扩展名，会被白名单判为非法条目而让整个主题包解压失败，
* 只能回落慢路径重下 zip。这类条目不落盘也不影响渲染，直接跳过。#93057
*/
function isMacOsNoiseEntry(name) {
	const base = name.slice(name.lastIndexOf("/") + 1);
	return name.startsWith("__MACOSX/") || base === ".DS_Store" || base.startsWith("._");
}
/**
* 校验 resourceKey 只包含 URL-safe 字符 —— 避免路径穿越，同时避免 zip 名怪字符污染目录名。
* spec §3.2 允许 id 为字符串；我们再收敛一层。
*/
function assertSafeResourceKey(key) {
	if (!/^[A-Za-z0-9._-]+$/.test(key) || key === "." || key === "..") throw new Error(`unsafe resourceKey: ${key}`);
}
/**
* 计算标准目录名 `<resourceKey>-<updatedAt>`。updatedAt 已是数值 epoch ms，
* 与 resource cache key 语义一致：只要 updatedAt 不变就复用现有解压结果。
*/
function computeDirName(theme) {
	assertSafeResourceKey(theme.resourceKey);
	return `${theme.resourceKey}-${theme.updatedAt}`;
}
/**
* 把绝对文件路径转为 `local-file://` URL。
*
* Windows 路径分隔符要换成 `/`（follow `window-manager.ts::toLocalFileUrl` 现有约定），
* 每一段做 encodeURI 以处理空格/中文/#等特殊字符（`net.fetch(file://...)` 会 decode）。
*/
function toLocalFileUrl(absPath) {
	const encoded = absPath.replace(/\\/g, "/").split("/").map((part) => part === "" ? "" : encodeURIComponent(part)).join("/");
	return `local-file://${encoded.startsWith("/") ? "" : "/"}${encoded}`;
}
/**
* 重写 CSS 内所有 `url(...)`：
* - 绝对 URL（http(s):/data:/local-file:/blob:/#）原样保留
* - 相对路径解析到 `resourceDir` 内，越界抛错，命中扩展名白名单后转 `local-file://` 绝对 URL
*/
function rewriteCssUrls(css, resourceDir, joinPath) {
	return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (match, quote, rawUrl) => {
		const trimmed = rawUrl.trim();
		if (!trimmed) return match;
		if (/^(https?:|data:|blob:|local-file:|#)/i.test(trimmed)) return match;
		const withoutQuery = trimmed.split(/[?#]/, 1)[0];
		const ext = withoutQuery.slice(withoutQuery.lastIndexOf(".")).toLowerCase();
		if (!ALLOWED_ASSET_EXTS.has(ext)) throw new Error(`css url() references disallowed extension: ${trimmed}`);
		const abs = joinPath(resourceDir, withoutQuery.split("/").join("/"));
		if (!isInside(abs, resourceDir)) throw new Error(`css url() escapes resource dir: ${trimmed}`);
		return `url("${toLocalFileUrl(abs)}")`;
	});
}
/**
* 判断 abs 是否位于 parent 目录内。
* 出于防御目的额外做一次 posix normalize —— 即使传入的 `path.join` 实现漏 normalize
* `..`，`../etc/passwd` 这类相对片段仍会被拒绝。
*/
function isInside(abs, parent) {
	const norm = (s) => {
		const parts = s.replace(/\\/g, "/").split("/");
		const out = [];
		for (const seg of parts) {
			if (seg === "" || seg === ".") {
				out.push(seg);
				continue;
			}
			if (seg === "..") {
				if (out.length && out[out.length - 1] !== ".." && out[out.length - 1] !== "") out.pop();
				else return null;
				continue;
			}
			out.push(seg);
		}
		return out.join("/");
	};
	const a = norm(abs);
	const p = norm(parent);
	if (a === null || p === null) return false;
	return a === p || a.startsWith(p.endsWith("/") ? p : `${p}/`);
}
var DesktopAppearanceRepo = class extends CloudAppearanceRepo {
	constructor(deps) {
		super({
			context: deps.context,
			runtime: deps.runtime,
			routePrefix: "/v2",
			platform: "client"
		});
		this.inflight = /* @__PURE__ */ new Map();
		this.deps = deps;
		this.rootPath = deps.localResourceRoot;
	}
	/** issue #74055：主题 zip 下载 + 解压 + URL 重写，返回可直接注入的 CSS */
	async getLocalResource(theme) {
		if (!theme.zipUrl) throw new Error(`theme ${theme.resourceKey} has no zipUrl`);
		const dirName = computeDirName(theme);
		const cacheKey = dirName;
		const existing = this.inflight.get(cacheKey);
		if (existing) return existing;
		const task = this.doGetLocalResource(theme, dirName).finally(() => {
			this.inflight.delete(cacheKey);
		});
		this.inflight.set(cacheKey, task);
		return task;
	}
	async doGetLocalResource(theme, dirName) {
		const resolved = await this.resolveDir(dirName);
		const cssPath = this.deps.path.join(resolved.absPath, "skin.css");
		const cached = await this.tryReadCachedCss(cssPath, resolved.absPath);
		if (cached !== void 0) {
			await this.enforceLru(resolved.dirName).catch((err) => {
				this.deps.logger?.warn("[appearance] enforceLru failed (post-hit)", { err: String(err) });
			});
			return { css: cached };
		}
		const buffer = await this.downloadZip(theme.zipUrl);
		const { rawCss } = await this.extractZip(buffer, resolved.absPath);
		const rewritten = rewriteCssUrls(rawCss, resolved.absPath, (a, b) => this.deps.path.join(a, b));
		const tmpPath = `${cssPath}.tmp`;
		await this.deps.fs.writeFile(tmpPath, rewritten);
		await this.deps.fs.rename(tmpPath, cssPath);
		await this.enforceLru(resolved.dirName).catch((err) => {
			this.deps.logger?.warn("[appearance] enforceLru failed", { err: String(err) });
		});
		return { css: rewritten };
	}
	async resolveDir(dirName) {
		const absPath = this.deps.path.join(this.rootPath, dirName);
		if (!isInside(absPath, this.rootPath)) throw new Error(`resource dir escapes root: ${dirName}`);
		await this.deps.fs.mkdir(absPath, { recursive: true });
		return {
			absPath,
			dirName
		};
	}
	/** 读盘缓存：skin.css 由 tmp+rename 原子写产生，存在即视为完整 rewrite 产物 */
	async tryReadCachedCss(cssPath, dir) {
		try {
			const buf = await this.deps.fs.readFile(cssPath);
			await this.deps.fs.stat(dir).catch(() => {});
			return new TextDecoder("utf-8").decode(buf);
		} catch {
			return;
		}
	}
	async downloadZip(url) {
		const ctrl = new AbortController();
		const to = setTimeout(() => ctrl.abort(), this.deps.downloadTimeoutMs ?? DEFAULT_DOWNLOAD_TIMEOUT_MS);
		try {
			const resp = await this.deps.fetch(url, { signal: ctrl.signal });
			if (!resp.ok) throw new Error(`zip download failed: HTTP ${resp.status}`);
			return new Uint8Array(await resp.arrayBuffer());
		} finally {
			clearTimeout(to);
		}
	}
	/** 解压 zip 到 dir，返回 CSS 原始内容（首个 `.css` 文件；spec 约定单主题单 CSS） */
	async extractZip(buffer, dir) {
		const maxEntries = this.deps.maxEntries ?? DEFAULT_MAX_ENTRIES;
		const maxBytes = this.deps.maxUnzippedBytes ?? DEFAULT_MAX_UNZIPPED_BYTES;
		const entries = this.deps.createUnzipper(buffer).listEntries();
		if (entries.length > maxEntries) throw new Error(`zip too many entries: ${entries.length} > ${maxEntries}`);
		let total = 0;
		let rawCss;
		const skippedNoise = [];
		for (const entry of entries) {
			if (entry.name.includes("..") || entry.name.startsWith("/") || /^[A-Za-z]:/.test(entry.name) || entry.name.includes("\\")) throw new Error(`zip entry unsafe: ${entry.name}`);
			total += entry.size;
			if (total > maxBytes) throw new Error(`zip too large: ${total} > ${maxBytes}`);
			if (isMacOsNoiseEntry(entry.name)) {
				skippedNoise.push(entry.name);
				continue;
			}
			const ext = entry.name.slice(entry.name.lastIndexOf(".")).toLowerCase();
			if (!ALLOWED_ASSET_EXTS.has(ext)) throw new Error(`zip entry disallowed extension: ${entry.name}`);
			const data = entry.getData();
			if (ext === ".css" && rawCss === void 0) rawCss = new TextDecoder("utf-8").decode(data);
			if (entry.name === "skin.css") continue;
			const target = this.deps.path.join(dir, entry.name);
			if (!isInside(target, dir)) throw new Error(`zip entry escapes dir: ${entry.name}`);
			await this.deps.fs.mkdir(this.deps.path.join(target, ".."), { recursive: true });
			await this.deps.fs.writeFile(target, data);
		}
		if (rawCss === void 0) throw new Error("zip has no .css entry");
		if (skippedNoise.length > 0) this.deps.logger?.info("appearance: zip macOS noise entries skipped", {
			count: skippedNoise.length,
			sample: skippedNoise.slice(0, 3)
		});
		return { rawCss };
	}
	/**
	* LRU 清理：把最新一次用到的目录标记为最新（依赖 fs.stat mtime），
	* 保留最新的 N 个目录，其余按 mtime 从旧到新删除。
	*/
	async enforceLru(justUsedDir) {
		const limit = this.deps.lruLimit ?? 8;
		let entries;
		try {
			entries = await this.deps.fs.readdir(this.rootPath);
		} catch {
			return;
		}
		if (entries.length <= limit) return;
		const stats = [];
		for (const name of entries) {
			const abs = this.deps.path.join(this.rootPath, name);
			try {
				const st = await this.deps.fs.stat(abs);
				stats.push({
					name,
					mtimeMs: name === justUsedDir ? Number.MAX_SAFE_INTEGER : st.mtimeMs
				});
			} catch {}
		}
		stats.sort((a, b) => a.mtimeMs - b.mtimeMs);
		const drop = stats.length - limit;
		for (let i = 0; i < drop; i++) {
			const abs = this.deps.path.join(this.rootPath, stats[i].name);
			try {
				await this.deps.fs.rm(abs, {
					recursive: true,
					force: true
				});
			} catch (err) {
				this.deps.logger?.warn("[appearance] LRU rm failed", {
					dir: stats[i].name,
					err: String(err)
				});
			}
		}
	}
	async listResources(options) {
		return super.listResources(options);
	}
};
//#endregion
//#region ../../packages/workbuddy-server/src/genie-inspiration/types.ts
/** Genie 后端 API 路径。 */
var GENIE_INSPIRATION_API = { PROJECT_FORK: (id) => `/genie/api/project/${encodeURIComponent(id)}/fork_v2` };
//#endregion
//#region ../../packages/workbuddy-server/src/genie-inspiration/cloud-repo.ts
/**
* 灵感复刻请求超时（ms）。
* Genie 后端 fork_v2 涉及项目创建 + 文件复制，耗时远超普通接口；
* Genie Web 前端默认 30s，这里对齐并留一定余量。
*/
var FORK_TIMEOUT_MS = 6e4;
/**
* Genie 灵感复刻 HTTP 实现。
*
* 只承载 #65327 已确认的"复刻项目"接口，不引入 Genie webview / 路由 / 首页逻辑。
*/
var CloudGenieInspirationRepo = class {
	constructor(deps) {
		this.http = deps.context.http;
		this.routePrefix = deps.routePrefix ?? "";
	}
	async forkProject(request) {
		const projectId = request.projectId.trim();
		if (!projectId) throw new Error("Missing Genie project id");
		const body = unwrapResponse$1(await this.http.post(`${this.routePrefix}${GENIE_INSPIRATION_API.PROJECT_FORK(projectId)}`, void 0, { timeoutMs: FORK_TIMEOUT_MS }));
		const code = typeof body?.code === "number" ? body.code : void 0;
		if (code !== void 0 && code !== 0 && code !== 200) throw new Error(resolveErrorMessage(body));
		const data = body?.data ?? body;
		if (!data || typeof data !== "object") throw new Error("Genie fork response missing project data");
		return data;
	}
};
function unwrapResponse$1(response) {
	if (response && typeof response === "object" && "data" in response) {
		const data = response.data;
		if (data && typeof data === "object" && ("code" in data || "data" in data)) return data;
	}
	return response;
}
function resolveErrorMessage(body) {
	if (!body || typeof body !== "object") return "Failed to fork Genie project";
	const { msg, message } = body;
	if (typeof msg === "string" && msg.trim()) return msg;
	if (typeof message === "string" && message.trim()) return message;
	return "Failed to fork Genie project";
}
//#endregion
//#region ../../packages/workbuddy-server/src/genie-project/types.ts
/** Genie 后端 API 路径 */
var GENIE_API = {
	PROJECT: "/genie/api/project",
	PROJECT_RECOMMENDATIONS: "/genie/api/public/project-recommendations",
	PROJECT_DETAIL: (id) => `/genie/api/project/${id}`,
	PROJECT_FORK: (id) => `/genie/api/project/${id}/fork`,
	PROJECT_DEPLOY: (id) => `/genie/api/project/${id}/deploy`,
	PLUGINS_OFFICIAL: "/genie/api/public/plugins",
	PLUGINS_USER: "/genie/api/plugins",
	PLUGINS_UPLOAD: "/genie/api/plugins/upload",
	PLUGIN_DETAIL: (id) => `/genie/api/plugins/${id}`,
	TCB_USAGE: "/genie/api/user/tcb/usage"
};
/** Figma API 路径常量 */
var FIGMA_API = {
	AUTH_URL: "/api/figma/auth-url",
	STATUS: "/api/figma/status",
	DISCONNECT: "/api/figma/disconnect",
	FETCH_PROGRESS: "/api/figma/fetch/progress"
};
//#endregion
//#region ../../packages/workbuddy-server/src/genie-project/cloud-genie-project-repo.ts
var CloudGenieProjectRepo = class {
	constructor(deps) {
		this.context = deps.context;
		this.deleteProjectHttp = deps.deleteProjectHttp;
		this.routePrefix = deps.routePrefix ?? "";
	}
	async createProject(request) {
		const response = await this.context.http.post(`${this.routePrefix}${GENIE_API.PROJECT}`, request);
		if (response.code !== 0 && response.code !== 200) throw new Error(response.msg || "Failed to create project");
		return response.data;
	}
	async getProject(projectId) {
		const response = await this.context.http.get(`${this.routePrefix}${GENIE_API.PROJECT_DETAIL(projectId)}`);
		if (response.code !== 0 && response.code !== 200) throw new Error(response.msg || "Failed to get project");
		return response.data;
	}
	async listProjects() {
		const response = await this.context.http.get(`${this.routePrefix}${GENIE_API.PROJECT}`);
		if (response.code !== 0 && response.code !== 200) throw new Error(response.msg || "Failed to list projects");
		return response.data;
	}
	async getProjectRecommendations() {
		const response = await this.context.http.get(`${this.routePrefix}${GENIE_API.PROJECT_RECOMMENDATIONS}`);
		if (response.code !== 0 && response.code !== 200) throw new Error(response.msg || "Failed to get project recommendations");
		return response.data;
	}
	async forkProject(projectId) {
		const response = await this.context.http.post(`${this.routePrefix}${GENIE_API.PROJECT_FORK(projectId)}`);
		if (response.code !== 0 && response.code !== 200) throw new Error(response.msg || "Failed to fork project");
		return response.data;
	}
	async deleteProject(projectId) {
		const response = await (this.deleteProjectHttp ?? this.context.http).delete(`${this.routePrefix}${GENIE_API.PROJECT_DETAIL(projectId)}`);
		if (response.code !== 0 && response.code !== 200) throw new Error(response.msg || "Failed to delete project");
	}
	async cancelDeploy(projectId) {
		const response = await this.context.http.delete(`${this.routePrefix}${GENIE_API.PROJECT_DEPLOY(projectId)}`);
		if (response.code !== 0 && response.code !== 200) throw new Error(response.msg || "Failed to cancel deploy");
	}
	async getFigmaAuthURL() {
		return this.context.http.get(`${this.routePrefix}${FIGMA_API.AUTH_URL}`);
	}
	async getFigmaStatus() {
		return this.context.http.get(`${this.routePrefix}${FIGMA_API.STATUS}`);
	}
	async disconnectFigma() {
		return this.context.http.delete(`${this.routePrefix}${FIGMA_API.DISCONNECT}`);
	}
	/**
	* 返回 Figma 文件抓取进度的 SSE URL（相对路径）。
	* renderer 侧用此 URL 建立 EventSource。
	*/
	getFigmaFetchProgressURL(fileUrl) {
		return `${this.routePrefix}${FIGMA_API.FETCH_PROGRESS}?file_url=${encodeURIComponent(fileUrl)}`;
	}
	/**
	* 官方插件列表（公共接口，走 `/genie/api/public/plugins`）。
	*
	* 与 genie 侧 `PluginService.getOfficialPlugins` 字面同源；无需登录，拉取失败
	* 均返回空数组（面板展示空态），不抛错。
	*/
	async getOfficialGeniePlugins() {
		try {
			const response = await this.context.http.get(`${this.routePrefix}${GENIE_API.PLUGINS_OFFICIAL}`);
			if (response.code !== 0 && response.code !== 200) return [];
			return normalizePlugins(response.data?.plugins, "official");
		} catch {
			return [];
		}
	}
	/**
	* 用户自建插件列表（需登录，走 `/genie/api/plugins?page=1&page_size=100`）。
	*
	* 与 genie 侧 `PluginService.getUserPlugins` 字面同源；未登录 / 拉取失败
	* 均返回空数组（面板展示为空态），不抛错。
	*/
	async getUserGeniePlugins() {
		try {
			const response = await this.context.http.get(`${this.routePrefix}${GENIE_API.PLUGINS_USER}?page=1&page_size=100`);
			if (response.code !== 0 && response.code !== 200) return [];
			return normalizePlugins(response.data?.plugins, "custom");
		} catch {
			return [];
		}
	}
	/**
	* 上传自建插件 —— 走 `POST /genie/api/plugins/upload`，multipart form-data，
	* 与 genie 侧 `PluginService.uploadPlugin` 字面同源。
	*
	* **关键 1（走原生 fetch）**：不走 `context.http`（axios），而走 `context.fetch`
	* （Web: window.fetch / Desktop: undici）。axios 有默认
	* `Content-Type: application/json`，实测 staging 后端会拿到空 body 回
	* `{"code":-1,"message":"File is required"}`。
	*
	* **关键 2（base64 而非 Uint8Array/File）**：daemon IPC 传输是 `JSON.parse(String(frame))`
	* 纯 JSON —— Uint8Array 会退化成 `{"0":x,"1":y,...}` 普通 object，`new Blob([obj])` 内容
	* 就是 `[object Object]` 或 `undefined`（抓包实测）。所以入参约定为 base64 字符串
	* （见 `GeniePluginUploadPayload` 注释），CloudRepo 里 `Buffer.from(base64, 'base64')`
	* 还原字节流，再包 Blob 塞进 FormData（后端只关心 `Content-Disposition: filename=`
	* 和 body 字节流）。
	*
	* Web 端 same-origin cookie 由浏览器自动携带；Desktop 端 Bearer / X-User-Id 由
	* `context.getAuthHeaders()` 注入。业务错误码（HTTP 200 带 `code=1000` 等）
	* 优先透传给 UI 做 i18n。
	*/
	async uploadGeniePlugin(payload) {
		const bytes = decodeBase64ToBytes(payload.dataBase64);
		const arrayBuffer = new ArrayBuffer(bytes.byteLength);
		new Uint8Array(arrayBuffer).set(bytes);
		const blob = new Blob([arrayBuffer], { type: payload.contentType });
		const formData = new FormData();
		formData.append("file", blob, payload.name);
		try {
			const url = `${this.context.getBaseURL().replace(/\/$/, "")}${this.routePrefix}${GENIE_API.PLUGINS_UPLOAD}`;
			const authHeaders = this.context.getAuthHeaders?.() ?? {};
			const response = await this.context.fetch(url, {
				method: "POST",
				body: formData,
				credentials: "include",
				headers: authHeaders
			});
			let result;
			try {
				result = await response.json();
			} catch {
				return {
					success: false,
					message: `Upload failed: HTTP ${response.status} ${response.statusText}`
				};
			}
			if (!result || result.code !== 0 && result.code !== 200) return {
				success: false,
				message: result?.msg || "Upload failed",
				errorCode: result?.code
			};
			return {
				success: true,
				message: result.msg || "Upload successful",
				plugin: result.data
			};
		} catch (error) {
			return {
				success: false,
				message: error instanceof Error ? error.message : "Upload failed"
			};
		}
	}
	/**
	* 删除自建插件 —— `DELETE /genie/api/plugins/{id}`，与 genie 侧字面同源。
	*/
	async deleteGeniePlugin(id) {
		try {
			const response = await this.context.http.delete(`${this.routePrefix}${GENIE_API.PLUGIN_DETAIL(id)}`);
			if (response.code !== 0 && response.code !== 200) return {
				success: false,
				message: response.msg || "Delete failed"
			};
			return {
				success: true,
				message: response.msg || "Delete successful"
			};
		} catch (error) {
			return {
				success: false,
				message: error instanceof Error ? error.message : "Delete failed"
			};
		}
	}
	/**
	* 查询用户维度的 TCB 云资源用量（issue #3156）。
	*
	* `GET /genie/api/user/tcb/usage`，经 `/genie` 前缀转发到
	* genie-agent backend/cmd/api-server 的 `GET /api/user/tcb/usage`。
	*/
	async getTcbUsage() {
		const response = await this.context.http.get(`${this.routePrefix}${GENIE_API.TCB_USAGE}`);
		if (response.code !== 0 && response.code !== 200) throw new Error(response.msg || "Failed to get TCB usage");
		return response.data;
	}
};
/**
* 后端字段规整：确保 `type` 字段有值（fallback 到 tab 名），并把可能为空的
* 字符串字段收敛到可选 —— 与 genie 侧 `PluginService` 对齐。
*/
function normalizePlugins(raw, fallbackType) {
	if (!raw || !Array.isArray(raw)) return [];
	return raw.map((plugin) => ({
		id: plugin.id,
		skillname: plugin.skillname || plugin.name,
		name: plugin.name,
		name_cn: plugin.name_cn || plugin.name,
		description: plugin.description || "",
		description_cn: plugin.description_cn || plugin.description || "",
		iconName: plugin.iconName,
		enabled: plugin.enabled ?? false,
		tags: plugin.tags ?? [],
		type: plugin.type ?? fallbackType,
		version: plugin.version,
		source: plugin.source
	}));
}
/**
* base64 → Uint8Array —— daemon 侧优先用 Buffer（Node），浏览器同进程兜底用 atob。
*
* 为什么必须走 base64：daemon IPC 是 `JSON.parse(String(frame))` 纯 JSON，
* Uint8Array 序列化后会变成 `{0:x,1:y}` 普通 object，还原不出字节流。
* base64 是字符串，JSON 天然安全。
*/
function decodeBase64ToBytes(base64) {
	if (typeof Buffer !== "undefined" && typeof Buffer.from === "function") {
		const buf = Buffer.from(base64, "base64");
		return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
	}
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}
//#endregion
//#region ../../packages/workbuddy-server/src/slot/types.ts
/** 客户端侧需要拉取的 6 个 slot key */
var CLIENT_SLOT_KEYS = [
	"home",
	"home_growth",
	"avatar_top",
	"menu_signin",
	"menu_growth",
	"codebuddy"
];
//#endregion
//#region ../../packages/workbuddy-server/src/slot/cloud-slot-repo.ts
/** 默认路由前缀（Web 端） */
var DEFAULT_ROUTE_PREFIX = "/portal";
var CloudSlotRepo = class {
	constructor({ context, runtime, routePrefix }) {
		this.ctx = context;
		this.runtime = runtime;
		this.routePrefix = routePrefix ?? DEFAULT_ROUTE_PREFIX;
	}
	async getActiveConfigs(options) {
		const url = `${this.routePrefix}/operation-platform/slots/active-batch`;
		try {
			const { version, lang } = this.resolveRuntimeParams(options);
			const resp = await this.ctx.http.post(url, {
				platform: "client",
				slot_keys: [...CLIENT_SLOT_KEYS],
				version,
				lang
			});
			const body = this.unwrapResponse(resp);
			if (body?.code !== 0) throw new Error(`bad response: code=${body?.code}, msg=${body?.msg}`);
			if (!body?.data?.configs) throw new Error("bad response: missing data.configs");
			return body.data.configs;
		} catch (error) {
			console.error("[SlotDomain] getActiveConfigs failed: url=%s, error=%s", url, String(error));
			throw error;
		}
	}
	/**
	* 单 slot 查询。后端：POST `${routePrefix}/operation-platform/slots/active`
	*
	* 用于"点击新建任务后只刷一个 home slot"等按需场景，避免拉一整批。
	* 命中：data.config 为 ActiveSlotConfig；未命中：data.config 为 null。
	*/
	async getActiveConfig(slotKey, options) {
		const url = `${this.routePrefix}/operation-platform/slots/active`;
		try {
			const { version, lang } = this.resolveRuntimeParams(options);
			const resp = await this.ctx.http.post(url, {
				platform: "client",
				slot_key: slotKey,
				version,
				lang
			});
			const body = this.unwrapResponse(resp);
			if (body?.code !== 0) throw new Error(`bad response: code=${body?.code}, msg=${body?.msg}, slotKey=${slotKey}`);
			if (!body?.data || !Object.prototype.hasOwnProperty.call(body.data, "config")) throw new Error(`bad response: missing data.config, slotKey=${slotKey}`);
			return body.data.config ?? null;
		} catch (error) {
			console.error("[SlotDomain] getActiveConfig failed: url=%s, slotKey=%s, error=%s", url, slotKey, String(error));
			throw error;
		}
	}
	/**
	* 兼容两种 http 返回格式：
	* - Web httpService (Axios)：返回 { data: { code, msg, data, ... } }
	* - Desktop createMainProcessHttp：直接返回 JSON body { code, msg, data, ... }
	* 区分方式：如果 resp 本身含 code 字段，说明是直返 envelope；否则取 resp.data
	*/
	unwrapResponse(resp) {
		return "code" in (resp ?? {}) ? resp : resp?.data;
	}
	/**
	* 统一解析 runtime 参数：
	* - version 来自 runtime getter
	* - lang 优先 options.lang（renderer 端 i18n 实时值），否则回退 runtime.getLang
	* - edition 不传，由后端根据用户身份自动推断（internal/enterprise/cn）
	*/
	resolveRuntimeParams(options) {
		return {
			version: this.runtime.getVersion(),
			lang: options?.lang ?? this.runtime.getLang()
		};
	}
};
//#endregion
//#region ../../packages/workbuddy-server/src/slot/desktop-slot-repo.ts
/**
* DesktopSlotRepo — Desktop 端运营位配置实现
*
* 继承 CloudSlotRepo，注入 routePrefix='/v2' 以走 IDE 网关路径。
* 即使当前只覆盖前缀，也保持分层一致性（R10 规则），方便未来扩展缓存/离线。
*
* 主进程通过 registerDomainService 注册后，
* 渲染进程通过 createDomainProxy IPC 代理调用。
*/
var DesktopSlotRepo = class extends CloudSlotRepo {
	constructor(deps) {
		super({
			...deps,
			routePrefix: "/v2"
		});
	}
};
//#endregion
//#region ../../packages/workbuddy-server/src/space-node/types.ts
var SPACE_NODE_API = { NODE_INFO: "/space/api/agent/v1/node-info" };
//#endregion
//#region ../../packages/workbuddy-server/src/space-node/cloud-repo.ts
/**
* 「资源不存在」类错误码。
*
* 除了字面意义的 not found，还收编了受保护资源码（内容安全 / 跨企业 / 仅 owner 等）：
* 它们对本场景的表现完全一致（保持 URL、不重试），单开一类没有收益。
* 权威表见 `apps/workbuddy-desktop/resources/plugins/workbuddy-builtin/skills/library/error_handling.md`。
*/
var NOT_FOUND_CODES = new Set([
	11510,
	404,
	410,
	619610,
	11511,
	56031,
	56032,
	56033,
	56034,
	56035,
	56036,
	56037,
	56041
]);
/** 「权限不足」类错误码。注意：不要把它提示成「链接失效」，是权限问题不是坏链接。 */
var FORBIDDEN_CODES = new Set([
	12100,
	12607,
	56030,
	401,
	403
]);
/**
* SpaceNodeFacade 的 HTTP 实现，Web 直接注入、Desktop 由 daemon handler 持有。
*
* `/space/api/agent/v1/*` 走 `AgentV1AuthMiddleware`（JWT > X-Userinfo > X-Skill-Token），
* 因此 baseURL 必须是**去掉 `/v2` 网关前缀的域名根**，不能沿用 product endpoint。
*/
var CloudSpaceNodeRepo = class {
	constructor(deps) {
		this.http = deps.context.http;
		this.routePrefix = deps.routePrefix ?? "";
	}
	async getNodeBrief({ url }) {
		const target = typeof url === "string" ? url.trim() : "";
		if (!target) return {
			ok: false,
			reason: "notFound"
		};
		let response;
		try {
			response = await this.http.post(`${this.routePrefix}${SPACE_NODE_API.NODE_INFO}`, { url: target });
		} catch (error) {
			return {
				ok: false,
				reason: resolveFailureFromError(error)
			};
		}
		const body = unwrapResponse(response);
		const code = typeof body?.code === "number" ? body.code : void 0;
		if (code !== void 0 && code !== 0) return {
			ok: false,
			reason: mapCodeToFailure(code)
		};
		const node = normalizeNode(body?.data ?? body);
		if (!node) return {
			ok: false,
			reason: "temporary"
		};
		return {
			ok: true,
			node
		};
	}
};
/**
* 剥掉可能多出来的一层信封。
*
* 生产 httpService 已拆掉 axios 的 data 层直接给业务体，但部分注入形态会多包一层，
* 与 `CloudGenieInspirationRepo` 保持同样的兼容写法。
*/
function unwrapResponse(response) {
	if (!response || typeof response !== "object") return;
	const outer = response;
	const inner = outer.data;
	if (inner && typeof inner === "object" && ("code" in inner || "data" in inner)) return inner;
	return outer;
}
function normalizeNode(payload) {
	const node = payload?.node;
	if (!node || typeof node !== "object") return;
	const id = typeof node.id === "string" ? node.id : "";
	if (!id) return;
	return {
		id,
		title: typeof node.title === "string" ? node.title : "",
		kind: typeof node.kind === "string" ? node.kind : "",
		url: typeof node.url === "string" ? node.url : ""
	};
}
/**
* 从抛出的错误里判定失败原因。
*
* `createRuntimeHttp` 对非 2xx 会把后端 envelope 的业务码平铺到 `error.code`，
* HTTP 状态放在 `error.status`/`error.httpStatus`。业务码更精确，优先取它；
* 都拿不到（网络异常 / AbortError / 非法响应）按临时故障处理。
*/
function resolveFailureFromError(error) {
	if (!error || typeof error !== "object") return "temporary";
	const err = error;
	const bizCode = toFiniteNumber(err.code);
	if (bizCode !== void 0) {
		const mapped = matchKnownCode(bizCode);
		if (mapped) return mapped;
	}
	const status = toFiniteNumber(err.status) ?? toFiniteNumber(err.httpStatus);
	if (status !== void 0) {
		const mapped = matchKnownCode(status);
		if (mapped) return mapped;
	}
	return "temporary";
}
/**
* 业务码 → 失败原因。未列出的码一律按临时故障，与 skill 侧权威表的兜底规则一致。
*
* 参数错误（400 / 422 / INVALID_PARAMS）在本场景只可能来自识别层放过了非
* `/space/d/` 的 URL，属于我方 bug，应该在识别层拦住，这里不给它单独语义。
*/
function mapCodeToFailure(code) {
	return matchKnownCode(code) ?? "temporary";
}
function matchKnownCode(code) {
	if (NOT_FOUND_CODES.has(code)) return "notFound";
	if (FORBIDDEN_CODES.has(code)) return "forbidden";
}
function toFiniteNumber(value) {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && /^-?\d+$/.test(value)) return Number(value);
}
//#endregion
//#region src/main/integrations/netdrive/netdrive-env-route.ts
/**
* 网盘环境路由 Cookie 共享状态。
*
* renderer 进程受浏览器 Forbidden header 限制，无法通过 SDK 的 setCustomHeader('Cookie') 设置 Cookie。
* 需要通过 Electron session.webRequest.onBeforeSendHeaders 拦截器注入。
*
* 此模块维护一个模块级变量，由以下位置更新：
*   - my-files.ts RPC handler（getNetDriveAccessToken 响应后更新）
*   - netdrive-reader-service.ts（getTokenInfo 后更新）
*
* window-manager.ts 拦截器在每个 drive 请求前读取当前值。
*/
var currentEnvCookie = null;
/**
* 更新环境路由 Cookie。
* @param envName 灰度环境名称（如 "feature/wb_saas_drive"），prod 为空
* @param envId 灰度环境 ID（如 "sit-fc948708"），prod 为空
*/
function setNetDriveEnvRoute(envName, envId) {
	const name = envName || "";
	const id = envId || "";
	if (!name && !id) {
		currentEnvCookie = null;
		return;
	}
	const parts = [];
	if (name) parts.push(`env_name=${name}`);
	if (id) parts.push(`env_id=${id}`);
	currentEnvCookie = parts.join("; ");
}
/**
* 获取当前环境路由 Cookie 值（供 webRequest 拦截器注入）。
* 返回 null 表示不需要注入（prod 环境）。
*/
function getNetDriveEnvCookie() {
	return currentEnvCookie;
}
//#endregion
//#region src/main/daemon/app-server/rpc-handler-deps.ts
require_workbuddy_product_config.init_bundled_assets();
function createDefaultEnhancePromptLogger() {
	try {
		const electronLog = require_src$1.require_src();
		const scope = electronLog.default?.scope ?? electronLog.scope;
		if (typeof scope !== "function") return;
		const scoped = scope("enhancePrompt");
		return { error: (message, payload) => {
			if (payload) scoped.error(message, payload);
			else scoped.error(message);
		} };
	} catch {
		return;
	}
}
function createProfileRpcHandlerDeps(deps, options) {
	return require_server.createWorkbuddyAppServerRpcProfileDepsFromRuntime({
		...createAppServerRpcRuntimeDeps(deps, options.configDir ?? deps.platform.configDir, options),
		adapters: createDesktopRpcProfileAdapterDeps(options.getMonitorService),
		profile: options.profile,
		triggerPluginMarketplaceUpdate: options.triggerPluginMarketplaceUpdate,
		builtinMarketTag: "desktop.createProfileRpcHandlerDeps"
	});
}
function createAppServerRpcRuntimeDeps(deps, configDir = deps.platform.configDir, options) {
	const createLogger = options?.createLogger ?? require_logger.createWorkbuddyScopedLogger;
	return {
		core: deps,
		celljs: deps.celljs,
		services: deps.services,
		hostServices: deps.hostServices,
		host: {
			app: deps.desktopHost.app,
			dialog: deps.desktopHost.dialog,
			shell: deps.desktopHost.shell,
			network: deps.desktopHost.network,
			applyWindowsExperimentalFeatures: deps.desktopHost.applyWindowsExperimentalFeatures
		},
		serverFetch: deps.serverFetch,
		configDir,
		runtimeManager: deps.runtimeManager,
		sessionManager: deps.sessionManager,
		docsService: deps.docsService,
		identityServiceRef: deps.identityServiceRef,
		moderationService: deps.moderationService,
		auditStore: deps.auditStore,
		fallbackProxyTestEndpoint: require_workbuddy_product_config.tryGetWorkbuddyBaseProductConfiguration()?.endpoint,
		localDocsRelease: options?.localDocsRelease,
		localDocs: options?.localDocs,
		tencentDocsRuntime: options?.tencentDocsRuntime,
		broadcastSandboxRulesDelta: createSandboxRulesDeltaBroadcaster(deps),
		slot: createDesktopSlotDeps(deps),
		genieInspiration: createDesktopGenieInspirationDeps(deps),
		spaceNode: createDesktopSpaceNodeDeps(deps),
		genieProject: createDesktopGenieProjectDeps(deps),
		appearance: createDesktopAppearanceDeps(deps),
		getNetworkGate: options?.getNetworkGate,
		logger: {
			main: createLogger("main"),
			handler: createLogger("handler"),
			runtime: createLogger("runtime"),
			builtinMarket: createLogger("builtin-market")
		}
	};
}
function createDesktopRpcProfileAdapterDeps(getMonitorService) {
	return {
		resolveBundledAsset: require_workbuddy_product_config.resolveBundledAsset,
		requireBundledAsset: require_workbuddy_product_config.requireBundledAsset,
		enhancePromptLogger: createDefaultEnhancePromptLogger(),
		logLifecycleEvent: require_package_and_show_log.logLifecycleEvent,
		setNetDriveEnvRoute,
		resolveEndpointOverride: require_dev_env_override.resolveEndpointOverride,
		getMonitorService: getMonitorService ?? (async () => {
			const { DesktopMonitorService } = await Promise.resolve().then(() => require("./desktop-monitor-service2.js"));
			return DesktopMonitorService.getSharedInstance();
		})
	};
}
/**
* 构造安全中心规则增量广播器：取所有活跃 sidecar 的 HTTP 端点，对每个
* `POST /internal/sandbox-rules/sync` 发送 delta。单端点失败不影响其余；
* getAllActiveEndpoints 失败（sidecar 未启动等）静默返回空，整体不抛错，
* 让安全中心保存 RPC 始终成功——实时同步是 best-effort，落盘才是 source of truth。
*/
function createSandboxRulesDeltaBroadcaster(deps) {
	const logger = require_logger.createWorkbuddyScopedLogger("security-center");
	const runtimeManager = deps.runtimeManager;
	const fetchFn = deps.serverFetch;
	return async (delta) => {
		const endpoints = await runtimeManager.getAllActiveEndpoints?.().catch(() => []) ?? [];
		if (endpoints.length === 0) return;
		const body = JSON.stringify(delta);
		await Promise.allSettled(endpoints.map(async (endpoint) => {
			try {
				const resp = await fetchFn(`${endpoint}/internal/sandbox-rules/sync`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body
				});
				if (!resp.ok) logger.warn(`[SecurityCenter] broadcast delta to ${endpoint} failed: HTTP ${resp.status}`);
			} catch (error) {
				logger.warn(`[SecurityCenter] broadcast delta to ${endpoint} error: ${error instanceof Error ? error.message : String(error)}`);
			}
		}));
	};
}
/**
* 装配 Desktop 端 SlotRepo，作为 daemon RPC `slot:getActiveConfigs` 的 service。
*
* - context: 通过 cellDeps 构造带认证 + endpoint 拼接的 RuntimeContext（与其他 domain 一致）
* - runtime.getEdition: 通过 WORKBUDDY_CONFIG_DIR 推断（与 ardot-design-feature.ts 逻辑对齐）
* - runtime.getVersion: 取 platform.appVersion
* - runtime.getLang: 取 platform.appLocale() 的系统语言 fallback；renderer 端通过
*   getActiveConfigs(options) 显式传入的 lang 优先级更高（i18n 实时值）
*/
function createDesktopSlotDeps(deps) {
	const contextPromise = Promise.resolve(deps.celljs).then((cellDeps) => require_runtime_http.createRuntimeContextFromCellDeps(cellDeps, {
		homeDir: deps.platform.configDir,
		fetch: deps.serverFetch ?? deps.desktopHost.network.fetch
	}));
	return { service: new DesktopSlotRepo({
		context: { http: { async post(url, data) {
			return (await contextPromise).http.post(url, data);
		} } },
		runtime: {
			getEdition() {
				return (process.env.WORKBUDDY_CONFIG_DIR?.trim() ?? "").includes("workbuddy-ai") ? "overseas" : "cn";
			},
			getVersion() {
				return deps.platform.appVersion ?? "";
			},
			getLang() {
				return (deps.platform.appLocale?.() ?? "").toLowerCase().startsWith("zh") ? "zh" : "en";
			}
		}
	}) };
}
/**
* 装配 Desktop 端 GenieProjectRepo，作为 daemon RPC `genieProject:*` 的 service。
*
* - context: 通过 cellDeps 构造带认证 + endpoint 拼接的 RuntimeContext（与其他 domain 一致）
* - Genie Project API 默认走产品 `/v2` 网关；仅删除项目使用根级 HTTP transport
* - 上传插件（multipart）走 `context.fetch`（daemon 的 undici / net.fetch）直接发，
*   避免 axios 默认 JSON Content-Type 把 FormData 序列化。auth header 由
*   `getAuthHeaders()` 从 authenticationManager 派生。
*
* Issue #3165
*/
function createDesktopGenieProjectDeps(deps) {
	let cachedCellDeps;
	const contextPromise = Promise.resolve(deps.celljs).then((cellDeps) => {
		cachedCellDeps = cellDeps;
		return require_runtime_http.createRuntimeContextFromCellDeps(cellDeps, {
			homeDir: deps.platform.configDir,
			fetch: deps.serverFetch ?? deps.desktopHost.network.fetch
		});
	});
	const deleteProjectContextPromise = Promise.resolve(deps.celljs).then((cellDeps) => {
		const rootEndpointProductManager = {
			...cellDeps.productManager,
			getEndpoint: () => cellDeps.productManager.getEndpoint()?.replace(/\/v2\/?$/, "")
		};
		return require_runtime_http.createRuntimeContextFromCellDeps({
			...cellDeps,
			productManager: rootEndpointProductManager
		}, {
			homeDir: deps.platform.configDir,
			fetch: deps.serverFetch ?? deps.desktopHost.network.fetch
		});
	});
	return { service: new CloudGenieProjectRepo({
		context: {
			http: {
				async get(url) {
					return (await contextPromise).http.get(url);
				},
				async post(url, data) {
					return (await contextPromise).http.post(url, data);
				},
				async delete(url) {
					return (await contextPromise).http.delete(url);
				}
			},
			fetch: (async (input, init) => {
				return (await contextPromise).fetch(input, init);
			}),
			getBaseURL() {
				return cachedCellDeps?.productManager.getEndpoint()?.replace(/\/$/, "") ?? "";
			},
			getAuthHeaders() {
				const session = cachedCellDeps?.authenticationManager?.currentSessionSubject?.getValue?.();
				const headers = {};
				if (session?.auth?.accessToken) headers.Authorization = `Bearer ${session.auth.accessToken}`;
				if (session?.account?.uid) headers["X-User-Id"] = session.account.uid;
				if (session?.account?.enterpriseId) {
					headers["X-Enterprise-Id"] = session.account.enterpriseId;
					headers["X-Tenant-Id"] = session.account.enterpriseId;
				}
				if (session?.auth?.domain) headers["X-Domain"] = session.auth.domain;
				return headers;
			}
		},
		deleteProjectHttp: { async delete(url) {
			return (await deleteProjectContextPromise).http.delete(url);
		} }
	}) };
}
/**
* 装配 Desktop 端 AppearanceRepo，作为 daemon RPC `appearance:*` 的 service。
*
* 与 createDesktopSlotDeps 同构：lazy RuntimeContext（含认证/endpoint 注入）+ 端侧 runtime
* 参数（edition/version/lang），edition/lang 推断逻辑与 slot 保持一致。
*
* 额外注入本地资源目录 + fs/fetch/adm-zip，让 DesktopAppearanceRepo 完成 zip 下载
* →解压→URL 重写→LRU 清理的闭环（issue #74055）。
*/
function createDesktopAppearanceDeps(deps) {
	const contextPromise = Promise.resolve(deps.celljs).then((cellDeps) => require_runtime_http.createRuntimeContextFromCellDeps(cellDeps, {
		homeDir: deps.platform.configDir,
		fetch: deps.serverFetch ?? deps.desktopHost.network.fetch
	}));
	const lazyContext = { http: {
		async get(url, config) {
			return (await contextPromise).http.get(url, config);
		},
		async post(url, data, config) {
			return (await contextPromise).http.post(url, data, config);
		}
	} };
	const runtime = {
		getVersion() {
			return deps.platform.appVersion ?? "";
		},
		getLang() {
			return (deps.platform.appLocale?.() ?? "").toLowerCase().startsWith("zh") ? "zh" : "en";
		}
	};
	const localResourceRoot = node_path.join(deps.platform.configDir, "appearance-resources");
	const AdmZip = require_adm_zip$1.require_adm_zip();
	const logger = require_logger.createWorkbuddyScopedLogger("appearance");
	return { service: new DesktopAppearanceRepo({
		context: lazyContext,
		runtime,
		localResourceRoot,
		fetch: (deps.serverFetch ?? deps.desktopHost.network.fetch ?? globalThis.fetch).bind(globalThis),
		fs: {
			mkdir: (p, opts) => node_fs_promises.mkdir(p, opts),
			readFile: (p) => node_fs_promises.readFile(p),
			writeFile: (p, data) => node_fs_promises.writeFile(p, data),
			rename: (oldPath, newPath) => node_fs_promises.rename(oldPath, newPath),
			stat: async (p) => ({ mtimeMs: (await node_fs_promises.stat(p)).mtimeMs }),
			readdir: (p) => node_fs_promises.readdir(p),
			rm: (p, opts) => node_fs_promises.rm(p, opts)
		},
		path: {
			join: node_path.join,
			resolve: node_path.resolve,
			sep: node_path.sep
		},
		createUnzipper: (buffer) => {
			const raw = new AdmZip(Buffer.from(buffer)).getEntries();
			return { listEntries: () => raw.filter((e) => !e.isDirectory).map((e) => ({
				name: e.entryName,
				size: e.header.size,
				getData: () => new Uint8Array(e.getData())
			})) };
		},
		logger: {
			info: (msg, meta) => logger.info(meta ? `${msg} ${JSON.stringify(meta)}` : msg),
			warn: (msg, meta) => logger.warn(meta ? `${msg} ${JSON.stringify(meta)}` : msg),
			error: (msg, meta) => logger.error(meta ? `${msg} ${JSON.stringify(meta)}` : msg)
		}
	}) };
}
/**
* 构造指向**域名根级**的惰性 RuntimeContext http（去掉 product endpoint 的 `/v2` 网关前缀）。
*
* Genie 灵感与资料库节点查询这类接口都不在 `/v2` 网关下，但仍要复用 RuntimeContext
* 的认证注入、代理、日志和错误语义。`deps.celljs` 是 Promise 而装配阶段不能 await，
* 因此包一层惰性代理：首次真正发请求时才取 context，不阻塞模块装配。
*/
function createRootEndpointLazyHttp(deps) {
	const contextPromise = Promise.resolve(deps.celljs).then((cellDeps) => {
		const rootEndpointProductManager = {
			...cellDeps.productManager,
			getEndpoint: () => cellDeps.productManager.getEndpoint()?.replace(/\/v2\/?$/, "")
		};
		return require_runtime_http.createRuntimeContextFromCellDeps({
			...cellDeps,
			productManager: rootEndpointProductManager
		}, {
			homeDir: deps.platform.configDir,
			fetch: deps.serverFetch ?? deps.desktopHost.network.fetch
		});
	});
	return { http: {
		async get(url, config) {
			return (await contextPromise).http.get(url, config);
		},
		async post(url, data, config) {
			return (await contextPromise).http.post(url, data, config);
		},
		async put(url, data, config) {
			return (await contextPromise).http.put(url, data, config);
		},
		async patch(url, data, config) {
			return (await contextPromise).http.patch(url, data, config);
		},
		async delete(url, config) {
			return (await contextPromise).http.delete(url, config);
		}
	} };
}
function createDesktopGenieInspirationDeps(deps) {
	return { service: new CloudGenieInspirationRepo({ context: createRootEndpointLazyHttp(deps) }) };
}
/**
* 装配 Desktop 端 SpaceNodeRepo（daemon RPC `spaceNode:getNodeBrief` 的 service）。
* spaceengine 的 `/space/api/agent/v1/*` 同样在域名根级；鉴权走 AgentV1AuthMiddleware
* 的 JWT 分支，由 RuntimeContext 注入的 Authorization 承接。
*/
function createDesktopSpaceNodeDeps(deps) {
	return { service: new CloudSpaceNodeRepo({ context: createRootEndpointLazyHttp(deps) }) };
}
//#endregion
//#region src/main/daemon/qimei-ready-signal.ts
/**
* daemon 子进程内的「qimei36 就绪」信号。
*
* 背景：cbc（codebuddy-code CLI）子进程由 daemon spawn，其 qimei36 来自 spawn 时的
* env 快照（cbc 的 EnvQimeiDetector 只读 `CODEBUDDY_QIMEI36`）。首次安装冷启动时
* daemon fork env 里可能还没 qimei36（helper 探测 ~2s 不阻塞 fork），main 会在探测
* 完成后通过 `telemetry:updateQimei36` RPC 事后补写 daemon 的 `process.env`。
*
* 问题：daemon 无法反向同步向 main 索取 qimei36，唯一来源是 main 单向、异步的补发。
* 若某条 cbc 抢在补发落地之前就被 spawn，它整个生命周期 qimei36 都为空——因为 env
* 是 spawn 快照，事后补写只更新 daemon 自身 process.env，不回灌已 spawn 的 cbc。
*
* 本模块把「daemon env 被补写填充」这一已有事件（{@link markQimei36Ready}，由
* telemetry:updateQimei36 handler 触发）暴露成一个可 await 的 promise
* （{@link waitQimei36Ready}），供组装 cbc env 的 getQimei36 在读到空值时短暂等待
* 补发落地，从而在 spawn 前尽量拿到 qimei36。不新增任何跨进程通道。
*/
var resolveReady;
var readyPromise = new Promise((resolve) => {
	resolveReady = resolve;
});
var isReady = false;
/**
* 标记 qimei36 已就绪（daemon 的 `process.env.CODEBUDDY_QIMEI36` 已被填充）。
* 由 telemetry:updateQimei36 handler 在写入 env 后调用。幂等，多次调用只 resolve 一次。
*/
function markQimei36Ready() {
	if (isReady) return;
	isReady = true;
	resolveReady?.();
}
/**
* 等待 qimei36 就绪，封顶 `timeoutMs`。命中返回 true，超时返回 false（尽力而为，
* 调用方超时后应放行、不阻断，避免遥测字段拖慢会话创建）。
*
* 若已就绪则立即 resolve（true）。
*/
function waitQimei36Ready(timeoutMs) {
	if (isReady) return Promise.resolve(true);
	let timer;
	const timeout = new Promise((resolve) => {
		timer = setTimeout(() => resolve(false), timeoutMs);
	});
	return Promise.race([readyPromise.then(() => true), timeout]).finally(() => {
		if (timer) clearTimeout(timer);
	});
}
//#endregion
//#region src/main/daemon/daemon-bootstrap.ts
require_workbuddy_product_config.init_bundled_assets();
require_dev_env_override.init_dev_env_override();
require_workbuddy_product_config.init_workbuddy_product_config();
/**
* 组装 cbc env 时，getQimei36 读到空值后等待 main 侧 qimei36 补发落地的封顶时长（ms）。
* 仅首次安装冷启动、且 cbc 抢在补发前创建会话时命中；主进程 helper 探测本身 ~2s，
* 与 fork 前的 QIMEI_FORK_WAIT_MS 互补，两段总窗口覆盖多数探测完成场景。超时放行，
* 不阻断会话创建（qimei36 仅遥测公参）。
*/
var QIMEI36_WAIT_MS = 2e3;
var STARTUP_PERF_BRIDGE_EVENT = "startup.perf.bridge";
var NOOP_POWER_MANAGER = {
	setEnabled: () => void 0,
	isEnabled: () => false,
	isActive: () => false,
	getState: () => ({
		isEnabled: false,
		isActive: false
	}),
	cleanup: () => void 0
};
/**
* In-process 兜底实现：直接 import desktop main 进程内的 reporter。
* 仅在 evalMode（main + daemon 同进程）下生效；fork 子进程下 monitor 单例
* 不可达，必须走 `DaemonBootstrapOptions.monitorEvent` / `promptTraceReporters`
* 由宿主注入 RPC 回调。
*/
function inProcessReportMonitorEvent(name, ext) {
	if (name === "sandbox.threat_database.update_check" || name === "sandbox.threat_database.startup_availability") {
		Promise.resolve().then(() => require("./threat-database-galileo.js")).then(({ reportThreatDatabaseGalileoEvent }) => {
			reportThreatDatabaseGalileoEvent(name, ext);
		}).catch(() => void 0);
		return;
	}
	Promise.resolve().then(() => require("./desktop-monitor-service2.js")).then(({ DesktopMonitorService }) => {
		DesktopMonitorService.getSharedInstance()?.reportAegisEvent(name, ext);
	}).catch(() => void 0);
}
function inProcessReportPromptForwardingEvent(payload) {
	Promise.resolve().then(() => require("./prompt-trace-reporter.js")).then(({ reportPromptForwardingEvent }) => reportPromptForwardingEvent(payload)).catch(() => void 0);
}
function inProcessReportPromptDoneEvent(payload) {
	Promise.resolve().then(() => require("./prompt-trace-reporter.js")).then(({ reportPromptDoneEvent }) => reportPromptDoneEvent(payload)).catch(() => void 0);
}
async function inProcessReportPromptTrace(payload) {
	try {
		const { reportPromptTrace } = await Promise.resolve().then(() => require("./prompt-trace-reporter.js"));
		await reportPromptTrace(payload);
	} catch {}
}
async function bootstrapDaemon({ celljs, credentialProtectionBootstrap, platform, runtimeManager, desktopHost = NOOP_DESKTOP_HOST, powerManager = NOOP_POWER_MANAGER, resolveProxyEnv, rpcHandlerProfile = "daemon-app-server", createRpcServer, createHostServiceDeps = require_server.createWorkbuddyAppServerDefaultHostServiceDeps, getLogFilePath = () => void 0, recordMainLoadTime, localDocumentMediaTypes, createDocumentLifecycle, tencentDocsMcp, rpcHandlerOptions, localDocsReleaseBridge, localDocs, tencentDocsRuntime, onRpcReady, monitorEvent, promptTraceReporters, getMonitorService, storeSessionCreateTiming: storeSessionCreateTiming$1, docsService, getSandboxPreviewMountService, getSandboxPreviewHttpPort, getStaticHtmlServer }) {
	const mainLog = require_logger.createWorkbuddyScopedLogger("daemon-bootstrap");
	projectResourceManager.setTokenProvider(() => {
		try {
			return celljs.authenticationManager.currentSessionSubject.getValue()?.auth?.accessToken ?? null;
		} catch {
			return null;
		}
	});
	projectResourceManager.setEndpointProvider(() => {
		try {
			return celljs.productManager?.getEndpoint?.() ?? null;
		} catch {
			return null;
		}
	});
	projectResourceManager.setUserIdProvider(() => {
		try {
			return celljs.authService.getAccount()?.uid ?? null;
		} catch {
			return null;
		}
	});
	const serverFetch = require_server.createWorkbuddyServerHttpFetch();
	const reportMonitorEvent = monitorEvent ?? inProcessReportMonitorEvent;
	const reportPromptForwarding = promptTraceReporters?.reportForwarding ?? inProcessReportPromptForwardingEvent;
	const reportPromptDone = promptTraceReporters?.reportDone ?? inProcessReportPromptDoneEvent;
	const reportPromptTrace = promptTraceReporters?.reportTrace ?? inProcessReportPromptTrace;
	return require_server.bootstrapWorkbuddyAppServer({
		celljs,
		credentialProtectionBootstrap,
		platform,
		runtimeManager,
		host: desktopHost,
		serverFetch,
		powerManager,
		resolveProxyEnv,
		rpcHandlerProfile,
		createRpcServer: createRpcServer ?? (() => new require_server.DaemonServer({ logger: {
			info: (message, meta) => mainLog.info(message, meta),
			warn: (message, meta) => mainLog.warn(message, meta)
		} })),
		createHostServiceDeps,
		createCoreServices: ({ celljs: celljsReady, platform: appServerPlatform, runtimeManager: appServerRuntimeManager, host }) => require_server.createWorkbuddyAppServerCoreServices({
			celljs: celljsReady,
			platform: { configDir: appServerPlatform.configDir },
			runtimeManager: appServerRuntimeManager,
			serverFetch,
			host: {
				fetch: host.network.fetch,
				getMainSession: () => host.network.getDefaultSession(),
				getTdocImportPartition: () => host.network.getSessionPartition("persist:tdoc-import"),
				getPreviewPartition: () => host.network.getSessionPartition("persist:tdoc-preview"),
				clearDefaultSessionCookiesForDomains: host.network.clearDefaultSessionCookiesForDomains ? (domains) => host.network.clearDefaultSessionCookiesForDomains(domains) : void 0
			},
			adapters: {
				resolveBundledAsset: require_workbuddy_product_config.resolveBundledAsset,
				resolveChannelBranding,
				designFeatureKey: ENABLE_ARDOT_DESIGN_FEATURE,
				isDesignFeatureEnabled: isEnableArdotDesignEnabled,
				resolveEndpointOverride: require_dev_env_override.resolveEndpointOverride,
				readDevEnv: require_dev_env_override.readDevEnv,
				getDevEnvName: () => process.env["TDOCS_DEV_ENV_NAME"],
				getDevEnvId: () => process.env["TDOCS_DEV_ENV_ID"],
				getLogFilePath,
				packageLogs: require_package_and_show_log.packageLogs,
				getPerfLogger: (flowType, traceId) => {
					const logger = require_logger$1.getWorkbuddyPerfLogger(flowType, traceId);
					if (flowType === require_logger$1.PerfFlow.STARTUP) return {
						appendRendererLine: (line) => logger.appendRendererLine(line),
						flush: () => {
							logger.flush();
							reportMonitorEvent(STARTUP_PERF_BRIDGE_EVENT, { logFilePath: logger.getLogFilePath() });
						},
						getLogFilePath: () => logger.getLogFilePath()
					};
					return logger;
				}
			},
			logger: mainLog
		}),
		createHandlerDeps: ({ server, sessionManager, listBackends, runtimeManager: appServerRuntimeManager, platform: appServerPlatform, host, powerManager: appServerPowerManager, permissionRequests, celljs: celljsReady, services, hostServices, appServerServices, auditStore, clawCwd }) => ({
			server,
			desktopHost: host,
			serverFetch,
			sessionManager,
			listBackends,
			runtimeManager: appServerRuntimeManager,
			platform: appServerPlatform,
			powerManager: appServerPowerManager,
			permissionRequests,
			celljs: celljsReady,
			services,
			hostServices,
			docsService: appServerServices.docsService,
			identityServiceRef: appServerServices.identityServiceRef,
			moderationService: appServerServices.moderationService,
			auditStore,
			clawCwd,
			monitorEvent: reportMonitorEvent,
			getSandboxPreviewMountService,
			getSandboxPreviewHttpPort,
			getStaticHtmlServer
		}),
		createRpcProfileDeps: (deps, options) => createProfileRpcHandlerDeps(deps, {
			configDir: options.configDir,
			profile: options.profile,
			localDocsRelease: localDocsReleaseBridge,
			localDocs,
			tencentDocsRuntime,
			triggerPluginMarketplaceUpdate: options.triggerPluginMarketplaceUpdate,
			getMonitorService,
			getNetworkGate: rpcHandlerOptions?.getNetworkGate
		}),
		codeBackendAdapters: {
			resolveBundledAsset: require_workbuddy_product_config.resolveBundledAsset,
			requireBundledAsset: require_workbuddy_product_config.requireBundledAsset,
			getBootstrapProductConfigEnv: require_workbuddy_product_config.getWorkbuddyBootstrapProductConfigurationEnv,
			getRegisteredBinaryTypes: require_client_info_env.getRegisteredBinaryTypes,
			getProcessProxyEnv: getProxyEnvFromProcess,
			storeSessionCreateTiming: storeSessionCreateTiming$1 ?? require_session_create_timing.storeSessionCreateTiming,
			resolveCliEnvRouteMode: require_dev_env_override.resolveCliEnvRouteModeOverride,
			reportPromptForwardingEvent: reportPromptForwarding,
			reportPromptDoneEvent: reportPromptDone,
			reportPromptTrace,
			getQimei36: async () => {
				const fromEnv = process.env.CODEBUDDY_QIMEI36?.trim() || void 0;
				if (fromEnv) return fromEnv;
				const waitStartedAt = Date.now();
				mainLog.info("[QimeiUpdate] getQimei36 env empty, waiting for main backfill before cbc spawn");
				if (!await waitQimei36Ready(QIMEI36_WAIT_MS)) {
					mainLog.warn(`[QimeiUpdate] getQimei36 timed out after ${Date.now() - waitStartedAt}ms waiting for env backfill; spawning cbc without qimei36`);
					return;
				}
				mainLog.info(`[QimeiUpdate] getQimei36 backfill landed after ${Date.now() - waitStartedAt}ms; cbc will spawn with qimei36`);
				return process.env.CODEBUDDY_QIMEI36?.trim() || void 0;
			},
			getProjectSessionEnv: (sessionId) => projectResourceManager.getEnvForSession(sessionId),
			getProjectMcpServersForSession: (sessionId) => projectResourceManager.getMcpServersForSession(sessionId),
			registerProjectSession: (sessionId, projectId, resources) => projectResourceManager.registerSession(sessionId, projectId, resources),
			registerProjectSessionFromRecord: (sessionId, projectId) => projectResourceManager.registerSessionFromRecord(sessionId, projectId)
		},
		resolveEndpointOverride: require_dev_env_override.resolveEndpointOverride,
		recordMainLoadTime,
		resolveDataSocketPath: require_process_reap_utils.dataSocketPath,
		onRpcReady,
		docsService,
		logger: mainLog,
		localDocumentMediaTypes,
		createDocumentLifecycle,
		tencentDocsMcp,
		rpcHandlerOptions
	});
}
//#endregion
Object.defineProperty(exports, "DAEMON_FIRST_LOCAL_LIST_RENDERED_CHANNEL", {
	enumerable: true,
	get: function() {
		return DAEMON_FIRST_LOCAL_LIST_RENDERED_CHANNEL;
	}
});
Object.defineProperty(exports, "EXTENSION_ACTIVATE_BY_EVENT_CHANNEL", {
	enumerable: true,
	get: function() {
		return EXTENSION_ACTIVATE_BY_EVENT_CHANNEL;
	}
});
Object.defineProperty(exports, "MigrationService", {
	enumerable: true,
	get: function() {
		return MigrationService;
	}
});
Object.defineProperty(exports, "NOOP_DESKTOP_HOST", {
	enumerable: true,
	get: function() {
		return NOOP_DESKTOP_HOST;
	}
});
Object.defineProperty(exports, "PAC_RPC_SOCKET_ENV", {
	enumerable: true,
	get: function() {
		return PAC_RPC_SOCKET_ENV;
	}
});
Object.defineProperty(exports, "PAC_RPC_TOKEN_ENV", {
	enumerable: true,
	get: function() {
		return PAC_RPC_TOKEN_ENV;
	}
});
Object.defineProperty(exports, "RENDERER_FIRST_LOCAL_LIST_RENDERED_CHANNEL", {
	enumerable: true,
	get: function() {
		return RENDERER_FIRST_LOCAL_LIST_RENDERED_CHANNEL;
	}
});
Object.defineProperty(exports, "WB_BRIDGE_EVENT_CHANNEL", {
	enumerable: true,
	get: function() {
		return WB_BRIDGE_EVENT_CHANNEL;
	}
});
Object.defineProperty(exports, "bootstrapDaemon", {
	enumerable: true,
	get: function() {
		return bootstrapDaemon;
	}
});
Object.defineProperty(exports, "createLocalDocsReleaseBridgeFromFacade", {
	enumerable: true,
	get: function() {
		return createLocalDocsReleaseBridgeFromFacade;
	}
});
Object.defineProperty(exports, "createTencentDocsDocumentLifecycleDeps", {
	enumerable: true,
	get: function() {
		return createTencentDocsDocumentLifecycleDeps;
	}
});
Object.defineProperty(exports, "createTencentDocsLocalDocumentMediaTypes", {
	enumerable: true,
	get: function() {
		return createTencentDocsLocalDocumentMediaTypes;
	}
});
Object.defineProperty(exports, "getNetDriveEnvCookie", {
	enumerable: true,
	get: function() {
		return getNetDriveEnvCookie;
	}
});
Object.defineProperty(exports, "initializeCellJSContainer", {
	enumerable: true,
	get: function() {
		return initializeCellJSContainer;
	}
});
Object.defineProperty(exports, "markQimei36Ready", {
	enumerable: true,
	get: function() {
		return markQimei36Ready;
	}
});
Object.defineProperty(exports, "projectResourceManager", {
	enumerable: true,
	get: function() {
		return projectResourceManager;
	}
});
Object.defineProperty(exports, "registerWBBridgeChannels", {
	enumerable: true,
	get: function() {
		return registerWBBridgeChannels;
	}
});
Object.defineProperty(exports, "resolveCellJSDeps", {
	enumerable: true,
	get: function() {
		return resolveCellJSDeps;
	}
});
Object.defineProperty(exports, "resolveChannelBranding", {
	enumerable: true,
	get: function() {
		return resolveChannelBranding;
	}
});
Object.defineProperty(exports, "resolveExtensionRoot", {
	enumerable: true,
	get: function() {
		return resolveExtensionRoot;
	}
});
Object.defineProperty(exports, "resolveProxyEnv", {
	enumerable: true,
	get: function() {
		return resolveProxyEnv;
	}
});
Object.defineProperty(exports, "scheduleSessionFragmentRepairRun", {
	enumerable: true,
	get: function() {
		return scheduleSessionFragmentRepairRun;
	}
});
Object.defineProperty(exports, "startPacRpcService", {
	enumerable: true,
	get: function() {
		return startPacRpcService;
	}
});
