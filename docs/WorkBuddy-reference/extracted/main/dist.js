const require_chunk = require("./chunk.js");
let node_fs = require("node:fs");
let node_path = require("node:path");
node_path = require_chunk.__toESM(node_path, 1);
let node_fs_promises = require("node:fs/promises");
let node_crypto = require("node:crypto");
let node_perf_hooks = require("node:perf_hooks");
//#region ../../packages/at-rest-crypto/dist/key-normalize-2t2Jeyvk.mjs
var AAD_DOMAIN = Buffer.from("WB-AAD\0", "ascii");
var WRAP_DOMAIN = Buffer.from("WB-WRAP\0", "ascii");
var MAX_UINT32 = 4294967295;
var MAX_UINT64$1 = 18446744073709551615n;
var FRAMING_CODE = {
	file: 1,
	field: 2,
	record: 3,
	stream: 4
};
var STANDARD_FORMAT_ID = {
	file: "WBEF1",
	field: "WBEV1",
	record: "WBER1",
	stream: "WBES1"
};
var ADVANCED_FORMAT_ID = {
	file: "WBEA1",
	field: "WBEV1"
};
function encodeUint32(value) {
	if (!Number.isSafeInteger(value) || value < 0 || value > MAX_UINT32) throw new RangeError("value must be a uint32");
	const bytes = Buffer.allocUnsafe(4);
	bytes.writeUInt32BE(value);
	return bytes;
}
function encodeLengthPrefixed(value) {
	const bytes = Buffer.from(value, "utf8");
	if (bytes.length === 0 || bytes.length > MAX_UINT32) throw new RangeError("authenticated string must contain 1..2^32-1 UTF-8 bytes");
	return Buffer.concat([encodeUint32(bytes.length), bytes]);
}
function encodeOptionalString(value) {
	return value === void 0 ? Buffer.from([0]) : Buffer.concat([Buffer.from([1]), encodeLengthPrefixed(value)]);
}
function encodeOptionalUint64(value) {
	if (value === void 0) return Buffer.from([0]);
	if (typeof value !== "bigint" || value < 0n || value > MAX_UINT64$1) throw new RangeError("sequence must be a uint64");
	const bytes = Buffer.allocUnsafe(9);
	bytes[0] = 1;
	bytes.writeBigUInt64BE(value, 1);
	return bytes;
}
function assertSymmetricContextShape(context) {
	if (context.purpose !== void 0 || context.resourceId !== void 0 || context.fieldPath !== void 0) throw new TypeError("sym-v1 context must not carry purpose, resourceId or fieldPath");
	switch (context.framing) {
		case "file":
		case "field":
			if (context.sequence !== void 0 || context.final !== void 0) throw new TypeError("sym-v1 whole-value context must not carry sequence or final");
			break;
		case "record":
			if (typeof context.sequence !== "bigint" || context.final !== void 0) throw new TypeError("record context requires only sequence");
			break;
		case "stream":
			if (typeof context.sequence !== "bigint" || typeof context.final !== "boolean") throw new TypeError("stream context requires sequence and final");
			break;
		default: {
			const neverFraming = context.framing;
			throw new TypeError(`unsupported framing: ${String(neverFraming)}`);
		}
	}
}
function assertAsymmetricContextShape(context) {
	if (typeof context.purpose !== "string" || typeof context.resourceId !== "string") throw new TypeError("purpose and resourceId must be strings");
	encodeLengthPrefixed(context.purpose);
	encodeLengthPrefixed(context.resourceId);
	if (context.sequence !== void 0 || context.final !== void 0) throw new TypeError("asym-v1 context must not carry sequence or final");
	switch (context.framing) {
		case "file":
			if (context.fieldPath !== void 0) throw new TypeError("file context contains forbidden authenticated fields");
			break;
		case "field":
			if (typeof context.fieldPath !== "string" || context.fieldPath.length === 0) throw new TypeError("field context requires fieldPath");
			break;
		default: throw new TypeError("asym-v1 supports only file and field framing");
	}
}
function buildAuthenticatedContextAad(keyId, suite, context, scheme = "sym-v1") {
	if (!/^[0-9a-f]{16}$/.test(keyId)) throw new TypeError("keyId must be 16 lowercase hexadecimal characters");
	if (scheme === "sym-v1") {
		assertSymmetricContextShape(context);
		return Buffer.concat([
			AAD_DOMAIN,
			Buffer.from([1]),
			encodeLengthPrefixed(STANDARD_FORMAT_ID[context.framing]),
			encodeLengthPrefixed(scheme),
			encodeUint32(suite),
			encodeLengthPrefixed(keyId),
			Buffer.from([FRAMING_CODE[context.framing]]),
			encodeOptionalUint64(context.sequence),
			Buffer.from([context.final === void 0 ? 0 : context.final ? 2 : 1])
		]);
	}
	assertAsymmetricContextShape(context);
	return Buffer.concat([
		AAD_DOMAIN,
		Buffer.from([1]),
		encodeLengthPrefixed(context.framing === "file" ? ADVANCED_FORMAT_ID.file : ADVANCED_FORMAT_ID.field),
		encodeLengthPrefixed(scheme),
		encodeUint32(suite),
		encodeLengthPrefixed(keyId),
		Buffer.from([FRAMING_CODE[context.framing]]),
		encodeLengthPrefixed(context.purpose),
		encodeLengthPrefixed(context.resourceId),
		encodeOptionalString(context.fieldPath),
		encodeOptionalUint64(void 0),
		Buffer.from([0])
	]);
}
function buildFileKeyWrapContext(input) {
	assertAsymmetricContextShape(input.context);
	if (!/^[0-9a-f]{16}$/.test(input.fileKeyId)) throw new TypeError("fileKeyId must be 16 lowercase hexadecimal characters");
	if (!/^[0-9a-f]{64}$/.test(input.developerPublicKeyId)) throw new TypeError("developerPublicKeyId must be 64 lowercase hexadecimal characters");
	const formatId = ADVANCED_FORMAT_ID[input.context.framing];
	return Buffer.concat([
		WRAP_DOMAIN,
		Buffer.from([1]),
		encodeLengthPrefixed(formatId),
		encodeLengthPrefixed("asym-v1"),
		encodeUint32(input.suite),
		encodeLengthPrefixed(input.fileKeyId),
		encodeLengthPrefixed(input.developerPublicKeyId),
		Buffer.from([FRAMING_CODE[input.context.framing]]),
		encodeLengthPrefixed(input.context.purpose),
		encodeLengthPrefixed(input.context.resourceId),
		encodeOptionalString(input.context.fieldPath)
	]);
}
var AtRestCryptoError = class extends Error {
	constructor(message, code, options) {
		super(message, options);
		this.code = code;
		this.name = new.target.name;
	}
};
var CryptoUnavailableError = class extends AtRestCryptoError {
	constructor(message, code = "CRYPTO_UNAVAILABLE", options) {
		super(message, code, options);
	}
};
var KeyPayloadParseError = class extends CryptoUnavailableError {
	constructor(message, code, options) {
		super(message, code, options);
	}
};
var IntegrityError = class extends AtRestCryptoError {
	constructor(message, options) {
		super(message, "INTEGRITY_ERROR", options);
	}
};
var UnsupportedCiphertextError = class extends AtRestCryptoError {
	constructor(message, options) {
		super(message, "UNSUPPORTED_CIPHERTEXT", options);
	}
};
var KeyMismatchError = class extends AtRestCryptoError {
	constructor(declaredKeyId) {
		super(`ciphertext declares a different key id: ${declaredKeyId}`, "KEY_MISMATCH");
		this.declaredKeyId = declaredKeyId;
	}
};
var PayloadTooLargeError = class extends AtRestCryptoError {
	constructor(message) {
		super(message, "PAYLOAD_TOO_LARGE");
	}
};
var MIN_ACCEPTED_SUITE = 1;
var SUPPORTED_SUITES = new Set([1]);
var ENVELOPE_KEYS = [
	"authTag",
	"ciphertext",
	"keyId",
	"nonce",
	"suite"
];
Buffer.from("WBEF1\n", "ascii");
Buffer.from("WBEA1\n", "ascii");
function decodeCanonicalBase64$1(value, field) {
	if (typeof value !== "string" || value.length === 0) throw new IntegrityError(`${field} must be non-empty canonical base64`);
	const decoded = Buffer.from(value, "base64");
	if (decoded.toString("base64") !== value) throw new IntegrityError(`${field} must be canonical base64`);
	return decoded;
}
function parseEnvelopeObject(envelopeBytes) {
	if (envelopeBytes.length > 67108864) throw new UnsupportedCiphertextError("envelope exceeds this reader limit");
	let value;
	try {
		value = JSON.parse(envelopeBytes.toString("utf8"));
	} catch (cause) {
		throw new IntegrityError("envelope is not valid JSON", { cause });
	}
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new IntegrityError("envelope must be an object");
	return value;
}
function parseSupportedEnvelope(envelopeBytes) {
	const envelope = parseEnvelopeObject(envelopeBytes);
	if (!Number.isInteger(envelope.suite)) throw new IntegrityError("suite must be an integer");
	const suite = envelope.suite;
	if (suite < MIN_ACCEPTED_SUITE || !SUPPORTED_SUITES.has(suite)) throw new UnsupportedCiphertextError(`unsupported suite ${suite}`);
	const keys = Object.keys(envelope).sort();
	if (keys.length !== ENVELOPE_KEYS.length || keys.some((key, index) => key !== ENVELOPE_KEYS[index])) throw new IntegrityError("suite 1 envelope fields do not match the schema");
	if (typeof envelope.keyId !== "string" || !/^[0-9a-f]{16}$/.test(envelope.keyId)) throw new IntegrityError("keyId must be 16 lowercase hexadecimal characters");
	const nonce = decodeCanonicalBase64$1(envelope.nonce, "nonce");
	const authTag = decodeCanonicalBase64$1(envelope.authTag, "authTag");
	const ciphertext = typeof envelope.ciphertext === "string" && envelope.ciphertext === "" ? Buffer.alloc(0) : decodeCanonicalBase64$1(envelope.ciphertext, "ciphertext");
	if (nonce.length !== 12 || authTag.length !== 16) throw new IntegrityError("suite 1 nonce or authentication tag has the wrong length");
	return {
		suite,
		keyId: envelope.keyId,
		nonce,
		authTag,
		ciphertext
	};
}
function isCanonical32ByteBase64(value) {
	if (typeof value !== "string" || value.length !== 44) return false;
	const decoded = Buffer.from(value, "base64");
	try {
		return decoded.length === 32 && decoded.toString("base64") === value;
	} finally {
		decoded.fill(0);
	}
}
function isZeroKeySentinel(value) {
	const decoded = Buffer.from(value, "base64");
	try {
		return decoded.every((byte) => byte === 0);
	} finally {
		decoded.fill(0);
	}
}
function parseKeyPayload(rawPayload) {
	let value;
	try {
		value = JSON.parse(rawPayload);
	} catch (cause) {
		throw new KeyPayloadParseError("workbuddy key payload is not valid JSON", "KEY_PAYLOAD_PARSE_FAILED", { cause });
	}
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new KeyPayloadParseError("workbuddy key payload must be an object", "KEY_PAYLOAD_SCHEMA_INVALID");
	const payload = value;
	if (payload.version !== 1) throw new KeyPayloadParseError("workbuddy key payload version must be 1", "KEY_PAYLOAD_VERSION_UNSUPPORTED");
	if (!isCanonical32ByteBase64(payload.atRestSecretKey)) throw new KeyPayloadParseError("atRestSecretKey must be canonical base64 for 32 bytes", "AT_REST_SECRET_KEY_INVALID");
	if (isZeroKeySentinel(payload.atRestSecretKey)) throw new KeyPayloadParseError("atRestSecretKey sentinel is not allowed", "AT_REST_SECRET_KEY_INVALID");
	return {
		version: 1,
		atRestSecretKey: payload.atRestSecretKey
	};
}
function deriveAtRestKeyId(key) {
	if (key.byteLength !== 32) throw new KeyPayloadParseError("normalized at-rest key must be exactly 32 bytes", "AT_REST_KEY_LENGTH_INVALID");
	return (0, node_crypto.createHash)("sha256").update(key).digest("hex").slice(0, 16);
}
function normalizeAtRestKeyPayload(rawPayload) {
	const payload = parseKeyPayload(rawPayload);
	const key = (0, node_crypto.createHash)("sha256").update(payload.atRestSecretKey, "utf8").digest();
	return {
		key,
		keyId: deriveAtRestKeyId(key)
	};
}
function decodeCanonicalBase64$2(value, field) {
	if (typeof value !== "string" || value.length === 0) throw new KeyPayloadParseError(`${field} must be non-empty canonical base64`, "DEVELOPER_PUBLIC_KEY_INVALID");
	const decoded = Buffer.from(value, "base64");
	if (decoded.length === 0 || decoded.toString("base64") !== value) {
		decoded.fill(0);
		throw new KeyPayloadParseError(`${field} must be canonical base64`, "DEVELOPER_PUBLIC_KEY_INVALID");
	}
	return decoded;
}
function normalizeAtRestDeveloperPublicKey(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new KeyPayloadParseError("at-rest developer public key must be an object", "DEVELOPER_PUBLIC_KEY_INVALID");
	const input = value;
	const keys = Object.keys(input).sort();
	if (keys.length !== 3 || keys[0] !== "alg" || keys[1] !== "id" || keys[2] !== "key") throw new KeyPayloadParseError("at-rest developer public key fields do not match the schema", "DEVELOPER_PUBLIC_KEY_INVALID");
	if (input.alg !== "RSA-OAEP-256" || typeof input.id !== "string" || !/^[0-9a-f]{64}$/.test(input.id)) throw new KeyPayloadParseError("at-rest developer public key metadata is invalid", "DEVELOPER_PUBLIC_KEY_INVALID");
	const keyDer = decodeCanonicalBase64$2(input.key, "at-rest developer public key");
	const id = (0, node_crypto.createHash)("sha256").update(keyDer).digest("hex");
	if (id !== input.id) {
		keyDer.fill(0);
		throw new KeyPayloadParseError("at-rest developer public key id does not match key material", "DEVELOPER_PUBLIC_KEY_ID_MISMATCH");
	}
	try {
		const key = (0, node_crypto.createPublicKey)({
			key: keyDer,
			format: "der",
			type: "spki"
		});
		if (key.asymmetricKeyType !== "rsa" || key.asymmetricKeyDetails?.modulusLength !== 3072) throw new Error("not RSA-3072");
	} catch (cause) {
		keyDer.fill(0);
		throw new KeyPayloadParseError("at-rest developer public key must be RSA-3072 SPKI DER", "DEVELOPER_PUBLIC_KEY_INVALID", { cause });
	}
	return {
		alg: "RSA-OAEP-256",
		id,
		keyDer
	};
}
//#endregion
//#region ../../packages/at-rest-crypto/dist/aes-gcm-4L6MEmMw.mjs
var AtRestCrypto = class {
	key;
	keyId;
	disposed = false;
	constructor(current, nonceSource = () => (0, node_crypto.randomBytes)(12), scheme = "sym-v1") {
		this.nonceSource = nonceSource;
		this.scheme = scheme;
		if (current.key.byteLength !== 32) throw new CryptoUnavailableError("at-rest key must be exactly 32 bytes");
		const derivedKeyId = deriveAtRestKeyId(current.key);
		if (current.keyId !== derivedKeyId) throw new CryptoUnavailableError("at-rest key id does not match the key bytes");
		this.key = Buffer.from(current.key);
		this.keyId = current.keyId;
	}
	seal(plaintext, context) {
		this.assertUsable();
		const nonce = this.nonceSource();
		if (nonce.length !== 12) throw new CryptoUnavailableError("nonce source must return exactly 12 bytes");
		const cipher = (0, node_crypto.createCipheriv)("aes-256-gcm", this.key, nonce, { authTagLength: 16 });
		cipher.setAAD(buildAuthenticatedContextAad(this.keyId, 1, context, this.scheme));
		const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
		const envelope = {
			suite: 1,
			keyId: this.keyId,
			nonce: nonce.toString("base64"),
			authTag: cipher.getAuthTag().toString("base64"),
			ciphertext: ciphertext.toString("base64")
		};
		const envelopeBytes = Buffer.from(JSON.stringify(envelope), "utf8");
		if (envelopeBytes.length > 67108864) throw new PayloadTooLargeError("whole-file envelope exceeds this reader limit");
		return envelopeBytes;
	}
	open(envelope, context) {
		this.assertUsable();
		if (envelope.keyId !== this.keyId) throw new KeyMismatchError(envelope.keyId);
		try {
			const decipher = (0, node_crypto.createDecipheriv)("aes-256-gcm", this.key, envelope.nonce, { authTagLength: 16 });
			decipher.setAAD(buildAuthenticatedContextAad(envelope.keyId, envelope.suite, context, this.scheme));
			decipher.setAuthTag(envelope.authTag);
			return Buffer.concat([decipher.update(envelope.ciphertext), decipher.final()]);
		} catch (cause) {
			throw new IntegrityError("ciphertext authentication failed", { cause });
		}
	}
	dispose() {
		this.key.fill(0);
		this.disposed = true;
	}
	assertUsable() {
		if (this.disposed) throw new CryptoUnavailableError("at-rest crypto has been disposed");
	}
};
//#endregion
//#region ../../packages/at-rest-crypto/dist/asymmetric-envelope-DhFQSwLY.mjs
var FILE_KEYS = [
	"authTag",
	"ciphertext",
	"developerWrap",
	"keyId",
	"nonce",
	"purpose",
	"resourceId",
	"scheme",
	"suite",
	"userWrap"
];
var FIELD_KEYS = [...FILE_KEYS, "fieldPath"].sort();
var USER_WRAP_KEYS = [
	"authTag",
	"ciphertext",
	"keyId",
	"nonce",
	"suite"
];
var DEVELOPER_WRAP_KEYS = [
	"alg",
	"ciphertext",
	"publicKeyId"
];
function isObject$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasExactKeys(value, keys) {
	const actual = Object.keys(value).sort();
	const expected = [...keys].sort();
	return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}
function decodeCanonicalBase64(value, field, expectedLength) {
	if (typeof value !== "string") throw new IntegrityError(`${field} must be canonical base64`);
	const decoded = Buffer.from(value, "base64");
	if (decoded.toString("base64") !== value || expectedLength !== void 0 && decoded.length !== expectedLength) {
		decoded.fill(0);
		throw new IntegrityError(`${field} must be canonical base64 with the expected length`);
	}
	return decoded;
}
function validatePublicKey(material) {
	if (material.alg !== "RSA-OAEP-256" || !/^[0-9a-f]{64}$/.test(material.id)) throw new CryptoUnavailableError("developer public key metadata is invalid");
	const der = Buffer.from(material.keyDer);
	if ((0, node_crypto.createHash)("sha256").update(der).digest("hex") !== material.id) throw new CryptoUnavailableError("developer public key id does not match key material");
	try {
		const key = (0, node_crypto.createPublicKey)({
			key: der,
			format: "der",
			type: "spki"
		});
		if (key.asymmetricKeyType !== "rsa" || key.asymmetricKeyDetails?.modulusLength !== 3072) throw new Error("not RSA-3072");
		return key;
	} catch (cause) {
		throw new CryptoUnavailableError("developer public key must be RSA-3072 SPKI DER", "DEVELOPER_PUBLIC_KEY_INVALID", { cause });
	}
}
function serializePayloadEnvelope(envelope) {
	return JSON.parse(envelope.toString("utf8"));
}
function sealUserWrap(fileKey, userKey, aad) {
	validateUserKey(userKey);
	const nonce = (0, node_crypto.randomBytes)(12);
	const cipher = (0, node_crypto.createCipheriv)("aes-256-gcm", userKey.key, nonce, { authTagLength: 16 });
	cipher.setAAD(aad);
	const ciphertext = Buffer.concat([cipher.update(fileKey), cipher.final()]);
	return {
		suite: 1,
		keyId: userKey.keyId,
		nonce: nonce.toString("base64"),
		authTag: cipher.getAuthTag().toString("base64"),
		ciphertext: ciphertext.toString("base64")
	};
}
function validateUserKey(userKey) {
	if (userKey.key.byteLength !== 32 || deriveAtRestKeyId(userKey.key) !== userKey.keyId) throw new CryptoUnavailableError("user key is invalid");
}
function openUserWrap(wrap, userKey, aad) {
	if (wrap.keyId !== userKey.keyId) throw new KeyMismatchError(wrap.keyId);
	try {
		const decipher = (0, node_crypto.createDecipheriv)("aes-256-gcm", userKey.key, Buffer.from(wrap.nonce, "base64"), { authTagLength: 16 });
		decipher.setAAD(aad);
		decipher.setAuthTag(Buffer.from(wrap.authTag, "base64"));
		return Buffer.concat([decipher.update(Buffer.from(wrap.ciphertext, "base64")), decipher.final()]);
	} catch (cause) {
		throw new IntegrityError("user key wrap authentication failed", { cause });
	}
}
function parseAsymmetricEnvelope(bytes, context) {
	if (bytes.length > 67108864) throw new UnsupportedCiphertextError("advanced envelope exceeds this reader limit");
	let value;
	try {
		const text = bytes.toString("utf8");
		if (!Buffer.from(text, "utf8").equals(bytes)) throw new Error("invalid UTF-8");
		value = JSON.parse(text);
	} catch (cause) {
		throw new IntegrityError("advanced envelope is not valid UTF-8 JSON", { cause });
	}
	if (!isObject$1(value) || !Number.isInteger(value.suite)) throw new IntegrityError("advanced envelope suite is invalid");
	if (value.suite !== 1) throw new UnsupportedCiphertextError(`unsupported advanced suite ${String(value.suite)}`);
	if (!hasExactKeys(value, context.framing === "field" ? FIELD_KEYS : FILE_KEYS)) throw new IntegrityError("advanced envelope fields do not match the schema");
	if (value.scheme !== "asym-v1" || typeof value.keyId !== "string" || !/^[0-9a-f]{16}$/.test(value.keyId) || value.purpose !== context.purpose || value.resourceId !== context.resourceId || context.framing === "field" && value.fieldPath !== context.fieldPath) throw new IntegrityError("advanced envelope context does not match the requested resource");
	if (!isObject$1(value.userWrap) || !hasExactKeys(value.userWrap, USER_WRAP_KEYS) || value.userWrap.suite !== 1 || typeof value.userWrap.keyId !== "string" || !/^[0-9a-f]{16}$/.test(value.userWrap.keyId)) throw new IntegrityError("user wrap fields do not match the schema");
	if (!isObject$1(value.developerWrap) || !hasExactKeys(value.developerWrap, DEVELOPER_WRAP_KEYS) || value.developerWrap.alg !== "RSA-OAEP-256" || typeof value.developerWrap.publicKeyId !== "string" || !/^[0-9a-f]{64}$/.test(value.developerWrap.publicKeyId)) throw new IntegrityError("developer wrap fields do not match the schema");
	decodeCanonicalBase64(value.userWrap.nonce, "userWrap.nonce", 12).fill(0);
	decodeCanonicalBase64(value.userWrap.authTag, "userWrap.authTag", 16).fill(0);
	decodeCanonicalBase64(value.userWrap.ciphertext, "userWrap.ciphertext", 32).fill(0);
	decodeCanonicalBase64(value.developerWrap.ciphertext, "developerWrap.ciphertext", 384).fill(0);
	decodeCanonicalBase64(value.nonce, "nonce", 12).fill(0);
	decodeCanonicalBase64(value.authTag, "authTag", 16).fill(0);
	decodeCanonicalBase64(value.ciphertext, "ciphertext").fill(0);
	return value;
}
function openPayload(envelope, context, fileKey) {
	if (deriveAtRestKeyId(fileKey) !== envelope.keyId) {
		fileKey.fill(0);
		throw new IntegrityError("unwrapped file key does not match the envelope key id");
	}
	const crypto = new AtRestCrypto({
		keyId: envelope.keyId,
		key: fileKey
	}, () => (0, node_crypto.randomBytes)(12), "asym-v1");
	try {
		return crypto.open({
			suite: envelope.suite,
			keyId: envelope.keyId,
			nonce: Buffer.from(envelope.nonce, "base64"),
			authTag: Buffer.from(envelope.authTag, "base64"),
			ciphertext: Buffer.from(envelope.ciphertext, "base64")
		}, context);
	} finally {
		crypto.dispose();
		fileKey.fill(0);
	}
}
function sealAsymmetricEnvelope(plaintext, context, material) {
	const publicKey = validatePublicKey(material.developerPublicKey);
	const fileKey = (0, node_crypto.randomBytes)(32);
	const fileKeyId = deriveAtRestKeyId(fileKey);
	const wrapContext = buildFileKeyWrapContext({
		suite: 1,
		fileKeyId,
		developerPublicKeyId: material.developerPublicKey.id,
		context
	});
	const payloadCrypto = new AtRestCrypto({
		keyId: fileKeyId,
		key: fileKey
	}, () => (0, node_crypto.randomBytes)(12), "asym-v1");
	try {
		const payload = serializePayloadEnvelope(payloadCrypto.seal(plaintext, context));
		const userWrap = sealUserWrap(fileKey, material.userKey, wrapContext);
		const developerCiphertext = (0, node_crypto.publicEncrypt)({
			key: publicKey,
			padding: node_crypto.constants.RSA_PKCS1_OAEP_PADDING,
			oaepHash: "sha256",
			oaepLabel: (0, node_crypto.createHash)("sha256").update(wrapContext).digest()
		}, fileKey);
		const envelope = {
			suite: payload.suite,
			scheme: "asym-v1",
			keyId: fileKeyId,
			purpose: context.purpose,
			resourceId: context.resourceId,
			...context.framing === "field" ? { fieldPath: context.fieldPath } : {},
			userWrap,
			developerWrap: {
				alg: "RSA-OAEP-256",
				publicKeyId: material.developerPublicKey.id,
				ciphertext: developerCiphertext.toString("base64")
			},
			nonce: payload.nonce,
			authTag: payload.authTag,
			ciphertext: payload.ciphertext
		};
		const bytes = Buffer.from(JSON.stringify(envelope), "utf8");
		if (bytes.length > 67108864) throw new PayloadTooLargeError("advanced envelope exceeds this reader limit");
		return bytes;
	} finally {
		payloadCrypto.dispose();
		fileKey.fill(0);
	}
}
function openAsymmetricEnvelope(bytes, context, material) {
	const envelope = parseAsymmetricEnvelope(bytes, context);
	validateUserKey(material.userKey);
	validatePublicKey(material.developerPublicKey);
	if (envelope.developerWrap.publicKeyId !== material.developerPublicKey.id) throw new KeyMismatchError(envelope.developerWrap.publicKeyId);
	const wrapContext = buildFileKeyWrapContext({
		suite: envelope.suite,
		fileKeyId: envelope.keyId,
		developerPublicKeyId: envelope.developerWrap.publicKeyId,
		context
	});
	return openPayload(envelope, context, openUserWrap(envelope.userWrap, material.userKey, wrapContext));
}
//#endregion
//#region ../../packages/at-rest-crypto/dist/file-permissions-Burk2rhy.mjs
async function fsyncDirectory(directoryPath) {
	if (process.platform === "win32") return;
	const handle = await (0, node_fs_promises.open)(directoryPath, "r");
	try {
		await handle.sync();
	} finally {
		await handle.close();
	}
}
Buffer.from("WBEF1\n", "ascii");
Buffer.from("WBEA1\n", "ascii");
var BASE_RETRY_MS = 6e4;
var MAX_RETRY_MS = 1440 * 6e4;
var RESOURCE_ID_PATTERN = /^[A-Za-z0-9._/@:-]{1,256}$/;
var ENTRY_KEYS = [
	"adapter",
	"attemptCount",
	"category",
	"firstFailureAt",
	"lastFailureAt",
	"nextRetryAt",
	"operation",
	"processRole",
	"resourceId"
];
var OPERATIONS = new Set([
	"read",
	"write",
	"migrate",
	"bootstrap"
]);
var PROCESS_ROLES = new Set([
	"main",
	"daemon",
	"cbc",
	"sidecar",
	"prewarm"
]);
var FAILURE_CATEGORIES$1 = new Set([
	"missing-key",
	"invalid-key",
	"safe-storage",
	"transport",
	"timeout",
	"mode-mismatch",
	"integrity",
	"unsupported",
	"lock",
	"io",
	"unknown"
]);
var RECOVERY_KEYS = [
	"adapter",
	"operation",
	"recoveredAt",
	"resourceId"
];
function isMissing(error) {
	return error.code === "ENOENT";
}
function isValidResourceId(resourceId) {
	if (!RESOURCE_ID_PATTERN.test(resourceId) || node_path.default.posix.isAbsolute(resourceId)) return false;
	return resourceId.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}
function isFailureEntry(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const entry = value;
	const keys = Object.keys(value).sort();
	return keys.length === ENTRY_KEYS.length && keys.every((key, index) => key === ENTRY_KEYS[index]) && typeof entry.resourceId === "string" && isValidResourceId(entry.resourceId) && typeof entry.adapter === "string" && /^[A-Za-z0-9._:-]{1,64}$/.test(entry.adapter) && OPERATIONS.has(entry.operation) && FAILURE_CATEGORIES$1.has(entry.category) && PROCESS_ROLES.has(entry.processRole) && Number.isFinite(entry.firstFailureAt) && Number.isFinite(entry.lastFailureAt) && Number.isSafeInteger(entry.attemptCount) && Number.isFinite(entry.nextRetryAt) && entry.attemptCount > 0 && entry.firstFailureAt >= 0 && entry.lastFailureAt >= entry.firstFailureAt && entry.nextRetryAt >= entry.lastFailureAt;
}
function isRecoveryEntry(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const entry = value;
	const keys = Object.keys(value).sort();
	return keys.length === RECOVERY_KEYS.length && keys.every((key, index) => key === RECOVERY_KEYS[index]) && typeof entry.resourceId === "string" && isValidResourceId(entry.resourceId) && typeof entry.adapter === "string" && /^[A-Za-z0-9._:-]{1,64}$/.test(entry.adapter) && OPERATIONS.has(entry.operation) && Number.isFinite(entry.recoveredAt) && entry.recoveredAt >= 0;
}
var AtRestFailureRegistry = class {
	filePath;
	configDir;
	logger;
	now;
	processRole;
	withFileLock;
	operationTail = Promise.resolve();
	constructor(options) {
		this.configDir = node_path.default.resolve(options.configDir);
		this.filePath = node_path.default.join(this.configDir, "security", "at-rest-failures-v1.json");
		this.processRole = options.processRole;
		this.withFileLock = options.withFileLock;
		this.logger = options.logger;
		this.now = options.now ?? (() => node_perf_hooks.performance.timeOrigin + node_perf_hooks.performance.now());
	}
	record(input) {
		const observedAt = this.now();
		return this.enqueue(() => this.recordNow(input, observedAt));
	}
	clear(selector) {
		const observedAt = this.now();
		return this.enqueue(() => this.clearNow(selector, observedAt, true));
	}
	clearOrdered(selector) {
		const observedAt = this.now();
		return this.enqueue(() => this.clearNow(selector, observedAt, false));
	}
	shouldRetry(selector, now = this.now()) {
		return this.enqueue(() => this.shouldRetryNow(selector, now));
	}
	shouldRetrySync(selector, now = this.now()) {
		if (!this.validateSelector(selector)) return true;
		try {
			const entry = this.parseRegistry((0, node_fs.readFileSync)(this.filePath)).entries.find((candidate) => candidate.resourceId === selector.resourceId && candidate.adapter === selector.adapter && candidate.operation === selector.operation);
			return entry === void 0 || entry.nextRetryAt <= now;
		} catch {
			return true;
		}
	}
	hasFailureSync(selector) {
		if (!this.validateSelector(selector)) return false;
		try {
			return this.parseRegistry((0, node_fs.readFileSync)(this.filePath)).entries.some((entry) => entry.resourceId === selector.resourceId && entry.adapter === selector.adapter && entry.operation === selector.operation);
		} catch {
			return false;
		}
	}
	async recordNow(input, observedAt) {
		if (!this.validateInput(input)) return;
		this.safeWarn(`[AtRestEncryption] unavailable adapter=${input.adapter} resource=${input.resourceId} operation=${input.operation} category=${input.category} role=${this.processRole}`);
		try {
			await this.withFileLock(this.filePath, async () => {
				const registry = await this.readRegistry();
				if (registry.recoveries.some((recovery) => recovery.resourceId === input.resourceId && recovery.adapter === input.adapter && recovery.operation === input.operation && recovery.recoveredAt >= observedAt)) return;
				const now = observedAt;
				const current = registry.entries.find((entry) => entry.resourceId === input.resourceId && entry.adapter === input.adapter && entry.operation === input.operation);
				if (current) {
					if (current.lastFailureAt > observedAt) return;
					current.category = input.category;
					current.processRole = this.processRole;
					current.lastFailureAt = now;
					current.attemptCount += 1;
					current.nextRetryAt = now + this.retryDelay(current.attemptCount);
				} else registry.entries.push({
					...input,
					processRole: this.processRole,
					firstFailureAt: now,
					lastFailureAt: now,
					attemptCount: 1,
					nextRetryAt: now + this.retryDelay(1)
				});
				await this.writeRegistry(registry);
			});
		} catch {
			this.safeWarn("[AtRestEncryption] failure-registry operation=record category=io");
		}
	}
	async clearNow(selector, observedAt, persistRecovery) {
		if (!this.validateSelector(selector)) {
			this.safeWarn("[AtRestEncryption] failure-registry operation=clear category=invalid-resource");
			return;
		}
		try {
			let cleared = false;
			await this.withFileLock(this.filePath, async () => {
				const registry = await this.readRegistry();
				const retained = registry.entries.filter((entry) => {
					const matches = entry.resourceId === selector.resourceId && entry.adapter === selector.adapter && entry.operation === selector.operation && entry.lastFailureAt <= observedAt;
					cleared ||= matches;
					return !matches;
				});
				if (!persistRecovery) {
					const recoveries = registry.recoveries.filter((entry) => entry.resourceId !== selector.resourceId || entry.adapter !== selector.adapter || entry.operation !== selector.operation);
					if (!cleared && recoveries.length === registry.recoveries.length) return;
					await this.writeRegistry({
						version: 1,
						entries: retained,
						recoveries
					});
					return;
				}
				const recovery = registry.recoveries.find((entry) => entry.resourceId === selector.resourceId && entry.adapter === selector.adapter && entry.operation === selector.operation);
				if (recovery) recovery.recoveredAt = Math.max(recovery.recoveredAt, observedAt);
				else registry.recoveries.push({
					...selector,
					recoveredAt: observedAt
				});
				await this.writeRegistry({
					version: 1,
					entries: retained,
					recoveries: registry.recoveries
				});
			});
			if (cleared) this.safeInfo(`[AtRestEncryption] recovered adapter=${selector.adapter} resource=${selector.resourceId} operation=${selector.operation}`);
		} catch (error) {
			if (!isMissing(error)) this.safeWarn("[AtRestEncryption] failure-registry operation=clear category=io");
		}
	}
	async shouldRetryNow(selector, now) {
		if (!this.validateSelector(selector)) return true;
		try {
			return await this.withFileLock(this.filePath, async () => {
				const entry = (await this.readRegistry()).entries.find((candidate) => candidate.resourceId === selector.resourceId && candidate.adapter === selector.adapter && candidate.operation === selector.operation);
				return entry === void 0 || entry.nextRetryAt <= now;
			});
		} catch {
			return true;
		}
	}
	enqueue(operation) {
		const result = this.operationTail.then(operation, operation);
		this.operationTail = result.then(() => void 0, () => void 0);
		return result;
	}
	async readRegistry() {
		let bytes;
		try {
			bytes = await (0, node_fs_promises.readFile)(this.filePath);
		} catch (error) {
			if (isMissing(error)) return {
				version: 1,
				entries: [],
				recoveries: []
			};
			throw error;
		}
		return this.parseRegistry(bytes);
	}
	parseRegistry(bytes) {
		let value;
		try {
			value = JSON.parse(bytes.toString("utf8"));
		} catch {
			throw new Error("invalid at-rest failure registry");
		}
		if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("invalid at-rest failure registry");
		const registry = value;
		if (registry.version !== 1 || !Array.isArray(registry.entries) || !registry.entries.every(isFailureEntry) || registry.recoveries !== void 0 && (!Array.isArray(registry.recoveries) || !registry.recoveries.every(isRecoveryEntry))) throw new Error("invalid at-rest failure registry");
		return {
			version: 1,
			entries: registry.entries,
			recoveries: registry.recoveries ?? []
		};
	}
	async writeRegistry(registry) {
		const directory = node_path.default.dirname(this.filePath);
		await (0, node_fs_promises.mkdir)(directory, {
			recursive: true,
			mode: 448
		});
		if (process.platform !== "win32") await (0, node_fs_promises.chmod)(directory, 448);
		const tempPath = `${this.filePath}.${process.pid}.${(0, node_crypto.randomBytes)(16).toString("hex")}.tmp`;
		let renamed = false;
		try {
			const handle = await (0, node_fs_promises.open)(tempPath, "wx", 384);
			try {
				await handle.writeFile(`${JSON.stringify(registry, void 0, 2)}\n`, "utf8");
				await handle.sync();
			} finally {
				await handle.close();
			}
			await (0, node_fs_promises.rename)(tempPath, this.filePath);
			renamed = true;
			await fsyncDirectory(directory);
		} finally {
			if (!renamed) await (0, node_fs_promises.rm)(tempPath, { force: true });
		}
	}
	retryDelay(attemptCount) {
		return Math.min(MAX_RETRY_MS, BASE_RETRY_MS * 2 ** Math.min(10, attemptCount - 1));
	}
	validateInput(input) {
		if (!this.validateSelector(input)) {
			this.safeWarn("[AtRestEncryption] failure-registry operation=record category=invalid-resource");
			return false;
		}
		return true;
	}
	validateSelector(selector) {
		return isValidResourceId(selector.resourceId) && /^[A-Za-z0-9._:-]{1,64}$/.test(selector.adapter) && OPERATIONS.has(selector.operation);
	}
	safeWarn(message) {
		try {
			this.logger.warn(message);
		} catch {}
	}
	safeInfo(message) {
		try {
			this.logger.info?.(message);
		} catch {}
	}
};
//#endregion
//#region ../../packages/at-rest-crypto/dist/index.mjs
var FAILURE_CATEGORIES = new Set([
	"missing-key",
	"invalid-key",
	"safe-storage",
	"transport",
	"timeout",
	"mode-mismatch",
	"integrity",
	"unsupported",
	"lock",
	"io",
	"unknown"
]);
function invalid(message) {
	throw new KeyPayloadParseError(message, "AT_REST_BOOTSTRAP_INVALID");
}
function isObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function assertOnlyKeys(value, allowed) {
	const actual = Object.keys(value).sort();
	const expected = [...allowed].sort();
	if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) invalid("at-rest encryption bootstrap contains unsupported fields");
}
function decodeCanonicalKey(value, label) {
	if (typeof value !== "string" || value.length !== 44) return invalid(`${label} must be canonical base64 for 32 bytes`);
	const key = Buffer.from(value, "base64");
	if (key.length !== 32 || key.toString("base64") !== value) {
		key.fill(0);
		return invalid(`${label} must be canonical base64 for 32 bytes`);
	}
	return key;
}
function validateMode(value) {
	if (value !== "disabled" && value !== "required") return invalid("at-rest encryption mode must be disabled or required");
	return value;
}
function isFailureCategory(value) {
	return typeof value === "string" && FAILURE_CATEGORIES.has(value);
}
function encodeKey(key, label) {
	const bytes = Buffer.from(key.key);
	try {
		if (bytes.length !== 32) return invalid(`${label} must be exactly 32 bytes`);
		const keyId = deriveAtRestKeyId(bytes);
		if (key.keyId !== keyId) return invalid(`${label} keyId does not match key material`);
		return {
			keyId,
			keyBase64: bytes.toString("base64")
		};
	} finally {
		bytes.fill(0);
	}
}
function decodeKey(value, label) {
	if (!isObject(value)) return invalid(`${label} is missing`);
	assertOnlyKeys(value, ["keyId", "keyBase64"]);
	if (typeof value.keyId !== "string") return invalid(`${label} keyId must be a string`);
	const key = decodeCanonicalKey(value.keyBase64, label);
	const keyId = deriveAtRestKeyId(key);
	if (value.keyId !== keyId) {
		key.fill(0);
		return invalid("at-rest encryption keyId does not match key material");
	}
	return {
		keyId,
		key
	};
}
function encodeDeveloperPublicKey(key) {
	const normalized = normalizeAtRestDeveloperPublicKey({
		alg: key.alg,
		id: key.id,
		key: Buffer.from(key.keyDer).toString("base64")
	});
	return {
		alg: normalized.alg,
		id: normalized.id,
		keyDerBase64: Buffer.from(normalized.keyDer).toString("base64")
	};
}
function decodeDeveloperPublicKey(value) {
	if (!isObject(value)) return invalid("developer public key is missing");
	assertOnlyKeys(value, [
		"alg",
		"id",
		"keyDerBase64"
	]);
	return normalizeAtRestDeveloperPublicKey({
		alg: value.alg,
		id: value.id,
		key: value.keyDerBase64
	});
}
function encodeAtRestEncryptionBootstrap(bootstrap) {
	const symmetric = bootstrap.symmetricKey ? { symmetricKey: encodeKey(bootstrap.symmetricKey, "symmetric key") } : { symmetricUnavailable: bootstrap.symmetricUnavailable };
	const asymmetric = bootstrap.userKey && bootstrap.developerPublicKey ? {
		userKey: encodeKey(bootstrap.userKey, "user key"),
		developerPublicKey: encodeDeveloperPublicKey(bootstrap.developerPublicKey)
	} : { asymmetricUnavailable: bootstrap.asymmetricUnavailable };
	return {
		version: 1,
		mode: bootstrap.mode,
		...symmetric,
		...asymmetric
	};
}
function decodeAtRestEncryptionBootstrap(value) {
	if (!isObject(value) || value.version !== 1) return invalid("at-rest encryption bootstrap version must be 1");
	const mode = validateMode(value.mode);
	if (mode === "disabled" && Object.keys(value).length === 2) {
		assertOnlyKeys(value, ["version", "mode"]);
		return {
			mode,
			symmetricUnavailable: "missing-key",
			asymmetricUnavailable: "missing-key"
		};
	}
	const hasSymmetricKey = isObject(value.symmetricKey);
	const hasSymmetricUnavailable = isFailureCategory(value.symmetricUnavailable);
	const hasUserKey = isObject(value.userKey);
	const hasDeveloperPublicKey = isObject(value.developerPublicKey);
	const hasAsymmetricUnavailable = isFailureCategory(value.asymmetricUnavailable);
	if (hasSymmetricKey === hasSymmetricUnavailable) return invalid("at-rest encryption bootstrap must describe both capabilities");
	if (hasUserKey !== hasDeveloperPublicKey || hasAsymmetricUnavailable === hasUserKey) return invalid("required at-rest encryption asymmetric capability is invalid");
	const allowedKeys = ["version", "mode"];
	allowedKeys.push(hasSymmetricKey ? "symmetricKey" : "symmetricUnavailable");
	if (hasUserKey) allowedKeys.push("userKey", "developerPublicKey");
	else allowedKeys.push("asymmetricUnavailable");
	assertOnlyKeys(value, allowedKeys);
	const symmetricKey = hasSymmetricKey ? decodeKey(value.symmetricKey, "symmetric key") : void 0;
	let userKey;
	try {
		userKey = hasUserKey ? decodeKey(value.userKey, "user key") : void 0;
		return {
			mode,
			...symmetricKey ? { symmetricKey } : { symmetricUnavailable: value.symmetricUnavailable },
			...userKey ? {
				userKey,
				developerPublicKey: decodeDeveloperPublicKey(value.developerPublicKey)
			} : { asymmetricUnavailable: value.asymmetricUnavailable }
		};
	} catch (error) {
		symmetricKey?.key.fill(0);
		userKey?.key.fill(0);
		throw error;
	}
}
function createUnavailableAtRestEncryptionBootstrap(mode, category) {
	return {
		mode,
		symmetricUnavailable: category,
		asymmetricUnavailable: category
	};
}
function disposeAtRestEncryptionBootstrap(bootstrap) {
	bootstrap.symmetricKey?.key.fill(0);
	bootstrap.userKey?.key.fill(0);
}
//#endregion
Object.defineProperty(exports, "AtRestCrypto", {
	enumerable: true,
	get: function() {
		return AtRestCrypto;
	}
});
Object.defineProperty(exports, "AtRestFailureRegistry", {
	enumerable: true,
	get: function() {
		return AtRestFailureRegistry;
	}
});
Object.defineProperty(exports, "CryptoUnavailableError", {
	enumerable: true,
	get: function() {
		return CryptoUnavailableError;
	}
});
Object.defineProperty(exports, "IntegrityError", {
	enumerable: true,
	get: function() {
		return IntegrityError;
	}
});
Object.defineProperty(exports, "createUnavailableAtRestEncryptionBootstrap", {
	enumerable: true,
	get: function() {
		return createUnavailableAtRestEncryptionBootstrap;
	}
});
Object.defineProperty(exports, "decodeAtRestEncryptionBootstrap", {
	enumerable: true,
	get: function() {
		return decodeAtRestEncryptionBootstrap;
	}
});
Object.defineProperty(exports, "deriveAtRestKeyId", {
	enumerable: true,
	get: function() {
		return deriveAtRestKeyId;
	}
});
Object.defineProperty(exports, "disposeAtRestEncryptionBootstrap", {
	enumerable: true,
	get: function() {
		return disposeAtRestEncryptionBootstrap;
	}
});
Object.defineProperty(exports, "encodeAtRestEncryptionBootstrap", {
	enumerable: true,
	get: function() {
		return encodeAtRestEncryptionBootstrap;
	}
});
Object.defineProperty(exports, "normalizeAtRestKeyPayload", {
	enumerable: true,
	get: function() {
		return normalizeAtRestKeyPayload;
	}
});
Object.defineProperty(exports, "openAsymmetricEnvelope", {
	enumerable: true,
	get: function() {
		return openAsymmetricEnvelope;
	}
});
Object.defineProperty(exports, "parseSupportedEnvelope", {
	enumerable: true,
	get: function() {
		return parseSupportedEnvelope;
	}
});
Object.defineProperty(exports, "sealAsymmetricEnvelope", {
	enumerable: true,
	get: function() {
		return sealAsymmetricEnvelope;
	}
});
