require("./chunk.js");
let node_fs = require("node:fs");
let node_path = require("node:path");
let node_os = require("node:os");
//#region src/main/system/logging/log-sampler.ts
var LogSampler = class {
	windowMs;
	maxPerWindow;
	maxFingerprints;
	now;
	entries = /* @__PURE__ */ new Map();
	constructor(options) {
		this.windowMs = options.windowMs;
		this.maxPerWindow = options.maxPerWindow;
		this.maxFingerprints = options.maxFingerprints ?? 1024;
		this.now = options.now ?? Date.now;
	}
	admit(fingerprint) {
		const ts = this.now();
		const existing = this.entries.get(fingerprint);
		if (!existing) {
			this.evictIfNeeded();
			this.entries.set(fingerprint, {
				windowStart: ts,
				admitCount: 1,
				suppressedSinceLast: 0
			});
			return {
				admit: true,
				suppressedSinceLast: 0
			};
		}
		this.entries.delete(fingerprint);
		this.entries.set(fingerprint, existing);
		if (ts - existing.windowStart >= this.windowMs) {
			const suppressed = existing.suppressedSinceLast;
			existing.windowStart = ts;
			existing.admitCount = 1;
			existing.suppressedSinceLast = 0;
			return {
				admit: true,
				suppressedSinceLast: suppressed
			};
		}
		if (existing.admitCount < this.maxPerWindow) {
			existing.admitCount += 1;
			const suppressed = existing.suppressedSinceLast;
			existing.suppressedSinceLast = 0;
			return {
				admit: true,
				suppressedSinceLast: suppressed
			};
		}
		existing.suppressedSinceLast += 1;
		return {
			admit: false,
			suppressedSinceLast: existing.suppressedSinceLast
		};
	}
	/** Testing / diagnostics helper. Not a stable API. */
	size() {
		return this.entries.size;
	}
	evictIfNeeded() {
		if (this.entries.size < this.maxFingerprints) return;
		const oldest = this.entries.keys().next();
		if (!oldest.done) this.entries.delete(oldest.value);
	}
};
//#endregion
//#region src/main/system/logging/persistent-log-writer.ts
/**
* Keep-open async append writer for electron-log file transports.
*
* electron-log 5.x File.writeLine 默认 `sync: true`，每条走
* `fs.writeFileSync(path, text, { flag: 'a' })` —— 每次 Create→Write→Close。
* 企业杀软对 CreateFile 逐文件 hook 时，空闲每秒几十次开文件会把整机卡住。
*
* 本 writer：
* - `openSync(..., 'a')` 常开同一个 fd，避免反复 CreateFile
* - 热路径只入队，真正落盘走 `fs.write` 异步回调，禁止 writeSync / writeFileSync
* - 不用 `createWriteStream`：它会留下 uv handle，vitest fork worker 退不掉
*   （CI 里多个文件停在 `(0 test)`，unitest 拖到 10 分钟被掐）
* - 同一次 flush 把能放下的 pending 拼成一块 buffer
* - 轮转语义对齐 electron-log（超 maxSize 则改名为 *.old.log）
*/
var defaultIo = {
	mkdirSync: node_fs.mkdirSync,
	statSync: node_fs.statSync,
	renameSync: node_fs.renameSync,
	rmSync: node_fs.rmSync,
	openSync: node_fs.openSync,
	write: node_fs.write,
	closeSync: node_fs.closeSync
};
var ROTATE_FAIL_COOLDOWN_MS = 3e4;
function byteLength(text) {
	return Buffer.byteLength(text, "utf8");
}
function createPersistentLogWriter(options) {
	const filePath = options.filePath;
	const maxSize = options.maxSize;
	const io = {
		...defaultIo,
		...options.io
	};
	const now = options.now ?? Date.now;
	const rotateFailCooldownMs = options.rotateFailCooldownMs ?? ROTATE_FAIL_COOLDOWN_MS;
	let fd = null;
	let fileBytes = 0;
	let rotateBlockedUntil = 0;
	const pending = [];
	let flushing = null;
	let closed = false;
	const canRotate = () => now() >= rotateBlockedUntil;
	const ensureOpen = () => {
		if (fd != null) return fd;
		io.mkdirSync((0, node_path.dirname)(filePath), { recursive: true });
		try {
			fileBytes = io.statSync(filePath).size;
		} catch {
			fileBytes = 0;
		}
		fd = io.openSync(filePath, "a");
		return fd;
	};
	const closeFd = () => {
		const current = fd;
		fd = null;
		if (current == null) return;
		try {
			io.closeSync(current);
		} catch {}
	};
	const rotate = async () => {
		closeFd();
		const parsed = (0, node_path.parse)(filePath);
		const oldPath = (0, node_path.join)(parsed.dir, `${parsed.name}.old${parsed.ext}`);
		try {
			io.rmSync(oldPath, { force: true });
			io.renameSync(filePath, oldPath);
			fileBytes = 0;
			rotateBlockedUntil = 0;
		} catch {
			rotateBlockedUntil = now() + rotateFailCooldownMs;
		}
		ensureOpen();
	};
	const writeChunk = (chunk) => {
		const handle = ensureOpen();
		const buf = Buffer.from(chunk, "utf8");
		return new Promise((resolve, reject) => {
			io.write(handle, buf, 0, buf.length, null, (error) => {
				if (error) {
					closeFd();
					reject(error);
					return;
				}
				resolve();
			});
		});
	};
	const flushOnce = async () => {
		if (pending.length === 0) return;
		ensureOpen();
		if (maxSize > 0 && fileBytes > 0 && fileBytes >= maxSize && canRotate()) await rotate();
		let room = maxSize > 0 ? maxSize - fileBytes : Number.POSITIVE_INFINITY;
		if (room <= 0 && fileBytes > 0 && canRotate()) {
			await rotate();
			room = maxSize > 0 ? maxSize : Number.POSITIVE_INFINITY;
		}
		const parts = [];
		while (pending.length > 0) {
			const next = pending[0];
			const incoming = byteLength(next);
			if (parts.length > 0 && incoming > room) break;
			if (parts.length === 0 && fileBytes > 0 && incoming > room && canRotate()) {
				await rotate();
				room = maxSize > 0 ? maxSize : Number.POSITIVE_INFINITY;
			}
			pending.shift();
			parts.push(next);
			room -= incoming;
		}
		const chunk = parts.join("");
		if (!chunk) return;
		await writeChunk(chunk);
		fileBytes += byteLength(chunk);
	};
	const scheduleFlush = () => {
		if (flushing) return;
		flushing = (async () => {
			try {
				while (pending.length > 0) await flushOnce();
			} catch {} finally {
				flushing = null;
				if (pending.length > 0 && !closed) scheduleFlush();
			}
		})();
	};
	const enqueue = (text) => {
		if (!text || closed) return;
		pending.push(text);
		scheduleFlush();
	};
	return {
		path: filePath,
		write: enqueue,
		writeLines(lines) {
			if (lines.length === 0) return;
			enqueue(lines.map((line) => {
				const text = String(line);
				return text.endsWith("\n") ? text : `${text}${node_os.EOL}`;
			}).join(""));
		},
		async close() {
			closed = true;
			if (flushing) await flushing;
			while (pending.length > 0) try {
				await flushOnce();
			} catch {
				break;
			}
			closeFd();
		}
	};
}
function installPersistentFileTransport(logger, writer) {
	const original = logger.transports.file;
	const transport = ((message) => {
		let formatted;
		try {
			formatted = typeof original.format === "function" ? original.format({
				data: message.data,
				level: message.level ?? "info",
				logger,
				message,
				transport: original
			}) : message.data;
		} catch {
			formatted = message.data;
		}
		const lines = Array.isArray(formatted) ? formatted.map((item) => String(item)) : [String(formatted ?? "")];
		writer.writeLines(lines);
	});
	Object.assign(transport, original);
	transport.getFile = () => ({ path: writer.path });
	logger.transports.file = transport;
}
//#endregion
Object.defineProperty(exports, "LogSampler", {
	enumerable: true,
	get: function() {
		return LogSampler;
	}
});
Object.defineProperty(exports, "createPersistentLogWriter", {
	enumerable: true,
	get: function() {
		return createPersistentLogWriter;
	}
});
Object.defineProperty(exports, "installPersistentFileTransport", {
	enumerable: true,
	get: function() {
		return installPersistentFileTransport;
	}
});
