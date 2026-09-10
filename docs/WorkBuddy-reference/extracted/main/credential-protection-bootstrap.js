const require_dist = require("./dist.js");
//#region ../../packages/workbuddy-server/src/server/credential-protection-bootstrap.ts
var WORKBUDDY_CREDENTIAL_PROTECTION_ENV = "WORKBUDDY_AT_REST_ENCRYPTION";
var DAEMON_CREDENTIAL_PROTECTION_BOOTSTRAP_CHANNEL = "daemon:credential-protection-bootstrap";
function readWorkbuddyCredentialProtectionMode(env) {
	const mode = env[WORKBUDDY_CREDENTIAL_PROTECTION_ENV];
	return mode === "required" || mode === "disabled" ? mode : "disabled";
}
var DaemonCredentialProtectionBootstrapGate = class {
	constructor(expectedMode, onBootstrap) {
		this.expectedMode = expectedMode;
		this.onBootstrap = onBootstrap;
		this.timeoutFallback = false;
		this.promise = new Promise((resolve) => {
			this.resolve = resolve;
		});
	}
	register(server) {
		server.handle(DAEMON_CREDENTIAL_PROTECTION_BOOTSTRAP_CHANNEL, (payload) => this.accept(payload));
	}
	async wait(timeoutMs = 5e3) {
		if (this.bootstrap) return this.bootstrap;
		let timeout;
		const fallback = new Promise((resolve) => {
			timeout = setTimeout(() => {
				const unavailable = require_dist.createUnavailableAtRestEncryptionBootstrap(this.expectedMode, "timeout");
				this.bootstrap = unavailable;
				this.timeoutFallback = true;
				this.resolve(unavailable);
				this.onBootstrap?.(unavailable);
				resolve(unavailable);
			}, timeoutMs);
			timeout.unref?.();
		});
		try {
			return await Promise.race([this.promise, fallback]);
		} finally {
			if (timeout) clearTimeout(timeout);
		}
	}
	dispose() {
		if (this.bootstrap) {
			require_dist.disposeAtRestEncryptionBootstrap(this.bootstrap);
			this.bootstrap = void 0;
		}
		this.fingerprint = void 0;
	}
	accept(payload) {
		let incoming;
		try {
			incoming = require_dist.decodeAtRestEncryptionBootstrap(payload);
		} catch {
			return {
				ok: false,
				mode: this.expectedMode,
				errorCategory: "transport"
			};
		}
		if (incoming.mode !== this.expectedMode) {
			require_dist.disposeAtRestEncryptionBootstrap(incoming);
			return {
				ok: false,
				mode: this.expectedMode,
				errorCategory: "mode-mismatch"
			};
		}
		const incomingFingerprint = fingerprint(incoming);
		if (this.bootstrap && !this.timeoutFallback) {
			const matches = this.fingerprint === incomingFingerprint;
			require_dist.disposeAtRestEncryptionBootstrap(incoming);
			return matches ? {
				ok: true,
				mode: this.expectedMode
			} : {
				ok: false,
				mode: this.expectedMode,
				errorCategory: "conflict"
			};
		}
		if (this.bootstrap) require_dist.disposeAtRestEncryptionBootstrap(this.bootstrap);
		this.bootstrap = incoming;
		this.fingerprint = incomingFingerprint;
		this.timeoutFallback = false;
		this.resolve(incoming);
		this.onBootstrap?.(incoming);
		return {
			ok: true,
			mode: this.expectedMode
		};
	}
};
function fingerprint(bootstrap) {
	return JSON.stringify(require_dist.encodeAtRestEncryptionBootstrap(bootstrap));
}
//#endregion
Object.defineProperty(exports, "DAEMON_CREDENTIAL_PROTECTION_BOOTSTRAP_CHANNEL", {
	enumerable: true,
	get: function() {
		return DAEMON_CREDENTIAL_PROTECTION_BOOTSTRAP_CHANNEL;
	}
});
Object.defineProperty(exports, "DaemonCredentialProtectionBootstrapGate", {
	enumerable: true,
	get: function() {
		return DaemonCredentialProtectionBootstrapGate;
	}
});
Object.defineProperty(exports, "WORKBUDDY_CREDENTIAL_PROTECTION_ENV", {
	enumerable: true,
	get: function() {
		return WORKBUDDY_CREDENTIAL_PROTECTION_ENV;
	}
});
Object.defineProperty(exports, "readWorkbuddyCredentialProtectionMode", {
	enumerable: true,
	get: function() {
		return readWorkbuddyCredentialProtectionMode;
	}
});
