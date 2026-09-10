const require_chunk = require("./chunk.js");
const require_dist = require("./dist.js");
const require_graceful_fs$1 = require("./graceful-fs.js");
let node_fs = require("node:fs");
node_fs = require_chunk.__toESM(node_fs);
let node_path = require("node:path");
node_path = require_chunk.__toESM(node_path);
let node_crypto = require("node:crypto");
let node_util = require("node:util");
//#region ../../node_modules/.pnpm/retry@0.12.0/node_modules/retry/lib/retry_operation.js
var require_retry_operation = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	function RetryOperation(timeouts, options) {
		if (typeof options === "boolean") options = { forever: options };
		this._originalTimeouts = JSON.parse(JSON.stringify(timeouts));
		this._timeouts = timeouts;
		this._options = options || {};
		this._maxRetryTime = options && options.maxRetryTime || Infinity;
		this._fn = null;
		this._errors = [];
		this._attempts = 1;
		this._operationTimeout = null;
		this._operationTimeoutCb = null;
		this._timeout = null;
		this._operationStart = null;
		if (this._options.forever) this._cachedTimeouts = this._timeouts.slice(0);
	}
	module.exports = RetryOperation;
	RetryOperation.prototype.reset = function() {
		this._attempts = 1;
		this._timeouts = this._originalTimeouts;
	};
	RetryOperation.prototype.stop = function() {
		if (this._timeout) clearTimeout(this._timeout);
		this._timeouts = [];
		this._cachedTimeouts = null;
	};
	RetryOperation.prototype.retry = function(err) {
		if (this._timeout) clearTimeout(this._timeout);
		if (!err) return false;
		var currentTime = (/* @__PURE__ */ new Date()).getTime();
		if (err && currentTime - this._operationStart >= this._maxRetryTime) {
			this._errors.unshift(/* @__PURE__ */ new Error("RetryOperation timeout occurred"));
			return false;
		}
		this._errors.push(err);
		var timeout = this._timeouts.shift();
		if (timeout === void 0) if (this._cachedTimeouts) {
			this._errors.splice(this._errors.length - 1, this._errors.length);
			this._timeouts = this._cachedTimeouts.slice(0);
			timeout = this._timeouts.shift();
		} else return false;
		var self = this;
		var timer = setTimeout(function() {
			self._attempts++;
			if (self._operationTimeoutCb) {
				self._timeout = setTimeout(function() {
					self._operationTimeoutCb(self._attempts);
				}, self._operationTimeout);
				if (self._options.unref) self._timeout.unref();
			}
			self._fn(self._attempts);
		}, timeout);
		if (this._options.unref) timer.unref();
		return true;
	};
	RetryOperation.prototype.attempt = function(fn, timeoutOps) {
		this._fn = fn;
		if (timeoutOps) {
			if (timeoutOps.timeout) this._operationTimeout = timeoutOps.timeout;
			if (timeoutOps.cb) this._operationTimeoutCb = timeoutOps.cb;
		}
		var self = this;
		if (this._operationTimeoutCb) this._timeout = setTimeout(function() {
			self._operationTimeoutCb();
		}, self._operationTimeout);
		this._operationStart = (/* @__PURE__ */ new Date()).getTime();
		this._fn(this._attempts);
	};
	RetryOperation.prototype.try = function(fn) {
		console.log("Using RetryOperation.try() is deprecated");
		this.attempt(fn);
	};
	RetryOperation.prototype.start = function(fn) {
		console.log("Using RetryOperation.start() is deprecated");
		this.attempt(fn);
	};
	RetryOperation.prototype.start = RetryOperation.prototype.try;
	RetryOperation.prototype.errors = function() {
		return this._errors;
	};
	RetryOperation.prototype.attempts = function() {
		return this._attempts;
	};
	RetryOperation.prototype.mainError = function() {
		if (this._errors.length === 0) return null;
		var counts = {};
		var mainError = null;
		var mainErrorCount = 0;
		for (var i = 0; i < this._errors.length; i++) {
			var error = this._errors[i];
			var message = error.message;
			var count = (counts[message] || 0) + 1;
			counts[message] = count;
			if (count >= mainErrorCount) {
				mainError = error;
				mainErrorCount = count;
			}
		}
		return mainError;
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/retry@0.12.0/node_modules/retry/lib/retry.js
var require_retry$1 = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	var RetryOperation = require_retry_operation();
	exports.operation = function(options) {
		return new RetryOperation(exports.timeouts(options), {
			forever: options && options.forever,
			unref: options && options.unref,
			maxRetryTime: options && options.maxRetryTime
		});
	};
	exports.timeouts = function(options) {
		if (options instanceof Array) return [].concat(options);
		var opts = {
			retries: 10,
			factor: 2,
			minTimeout: 1 * 1e3,
			maxTimeout: Infinity,
			randomize: false
		};
		for (var key in options) opts[key] = options[key];
		if (opts.minTimeout > opts.maxTimeout) throw new Error("minTimeout is greater than maxTimeout");
		var timeouts = [];
		for (var i = 0; i < opts.retries; i++) timeouts.push(this.createTimeout(i, opts));
		if (options && options.forever && !timeouts.length) timeouts.push(this.createTimeout(i, opts));
		timeouts.sort(function(a, b) {
			return a - b;
		});
		return timeouts;
	};
	exports.createTimeout = function(attempt, opts) {
		var random = opts.randomize ? Math.random() + 1 : 1;
		var timeout = Math.round(random * opts.minTimeout * Math.pow(opts.factor, attempt));
		timeout = Math.min(timeout, opts.maxTimeout);
		return timeout;
	};
	exports.wrap = function(obj, options, methods) {
		if (options instanceof Array) {
			methods = options;
			options = null;
		}
		if (!methods) {
			methods = [];
			for (var key in obj) if (typeof obj[key] === "function") methods.push(key);
		}
		for (var i = 0; i < methods.length; i++) {
			var method = methods[i];
			var original = obj[method];
			obj[method] = function retryWrapper(original) {
				var op = exports.operation(options);
				var args = Array.prototype.slice.call(arguments, 1);
				var callback = args.pop();
				args.push(function(err) {
					if (op.retry(err)) return;
					if (err) arguments[0] = op.mainError();
					callback.apply(this, arguments);
				});
				op.attempt(function() {
					original.apply(obj, args);
				});
			}.bind(obj, original);
			obj[method].options = options;
		}
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/retry@0.12.0/node_modules/retry/index.js
var require_retry = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	module.exports = require_retry$1();
}));
//#endregion
//#region ../../node_modules/.pnpm/signal-exit@3.0.7/node_modules/signal-exit/signals.js
var require_signals = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	module.exports = [
		"SIGABRT",
		"SIGALRM",
		"SIGHUP",
		"SIGINT",
		"SIGTERM"
	];
	if (process.platform !== "win32") module.exports.push("SIGVTALRM", "SIGXCPU", "SIGXFSZ", "SIGUSR2", "SIGTRAP", "SIGSYS", "SIGQUIT", "SIGIOT");
	if (process.platform === "linux") module.exports.push("SIGIO", "SIGPOLL", "SIGPWR", "SIGSTKFLT", "SIGUNUSED");
}));
//#endregion
//#region ../../node_modules/.pnpm/signal-exit@3.0.7/node_modules/signal-exit/index.js
var require_signal_exit = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var process = global.process;
	var processOk = function(process) {
		return process && typeof process === "object" && typeof process.removeListener === "function" && typeof process.emit === "function" && typeof process.reallyExit === "function" && typeof process.listeners === "function" && typeof process.kill === "function" && typeof process.pid === "number" && typeof process.on === "function";
	};
	/* istanbul ignore if */
	if (!processOk(process)) module.exports = function() {
		return function() {};
	};
	else {
		var assert = require("assert");
		var signals = require_signals();
		var isWin = /^win/i.test(process.platform);
		var EE = require("events");
		/* istanbul ignore if */
		if (typeof EE !== "function") EE = EE.EventEmitter;
		var emitter;
		if (process.__signal_exit_emitter__) emitter = process.__signal_exit_emitter__;
		else {
			emitter = process.__signal_exit_emitter__ = new EE();
			emitter.count = 0;
			emitter.emitted = {};
		}
		if (!emitter.infinite) {
			emitter.setMaxListeners(Infinity);
			emitter.infinite = true;
		}
		module.exports = function(cb, opts) {
			/* istanbul ignore if */
			if (!processOk(global.process)) return function() {};
			assert.equal(typeof cb, "function", "a callback must be provided for exit handler");
			if (loaded === false) load();
			var ev = "exit";
			if (opts && opts.alwaysLast) ev = "afterexit";
			var remove = function() {
				emitter.removeListener(ev, cb);
				if (emitter.listeners("exit").length === 0 && emitter.listeners("afterexit").length === 0) unload();
			};
			emitter.on(ev, cb);
			return remove;
		};
		var unload = function unload() {
			if (!loaded || !processOk(global.process)) return;
			loaded = false;
			signals.forEach(function(sig) {
				try {
					process.removeListener(sig, sigListeners[sig]);
				} catch (er) {}
			});
			process.emit = originalProcessEmit;
			process.reallyExit = originalProcessReallyExit;
			emitter.count -= 1;
		};
		module.exports.unload = unload;
		var emit = function emit(event, code, signal) {
			/* istanbul ignore if */
			if (emitter.emitted[event]) return;
			emitter.emitted[event] = true;
			emitter.emit(event, code, signal);
		};
		var sigListeners = {};
		signals.forEach(function(sig) {
			sigListeners[sig] = function listener() {
				/* istanbul ignore if */
				if (!processOk(global.process)) return;
				if (process.listeners(sig).length === emitter.count) {
					unload();
					emit("exit", null, sig);
					/* istanbul ignore next */
					emit("afterexit", null, sig);
					/* istanbul ignore next */
					if (isWin && sig === "SIGHUP") sig = "SIGINT";
					/* istanbul ignore next */
					process.kill(process.pid, sig);
				}
			};
		});
		module.exports.signals = function() {
			return signals;
		};
		var loaded = false;
		var load = function load() {
			if (loaded || !processOk(global.process)) return;
			loaded = true;
			emitter.count += 1;
			signals = signals.filter(function(sig) {
				try {
					process.on(sig, sigListeners[sig]);
					return true;
				} catch (er) {
					return false;
				}
			});
			process.emit = processEmit;
			process.reallyExit = processReallyExit;
		};
		module.exports.load = load;
		var originalProcessReallyExit = process.reallyExit;
		var processReallyExit = function processReallyExit(code) {
			/* istanbul ignore if */
			if (!processOk(global.process)) return;
			process.exitCode = code || 0;
			emit("exit", process.exitCode, null);
			/* istanbul ignore next */
			emit("afterexit", process.exitCode, null);
			/* istanbul ignore next */
			originalProcessReallyExit.call(process, process.exitCode);
		};
		var originalProcessEmit = process.emit;
		var processEmit = function processEmit(ev, arg) {
			if (ev === "exit" && processOk(global.process)) {
				/* istanbul ignore else */
				if (arg !== void 0) process.exitCode = arg;
				var ret = originalProcessEmit.apply(this, arguments);
				/* istanbul ignore next */
				emit("exit", process.exitCode, null);
				/* istanbul ignore next */
				emit("afterexit", process.exitCode, null);
				/* istanbul ignore next */
				return ret;
			} else return originalProcessEmit.apply(this, arguments);
		};
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/proper-lockfile@4.1.2/node_modules/proper-lockfile/lib/mtime-precision.js
var require_mtime_precision = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var cacheSymbol = Symbol();
	function probe(file, fs, callback) {
		const cachedPrecision = fs[cacheSymbol];
		if (cachedPrecision) return fs.stat(file, (err, stat) => {
			/* istanbul ignore if */
			if (err) return callback(err);
			callback(null, stat.mtime, cachedPrecision);
		});
		const mtime = /* @__PURE__ */ new Date(Math.ceil(Date.now() / 1e3) * 1e3 + 5);
		fs.utimes(file, mtime, mtime, (err) => {
			/* istanbul ignore if */
			if (err) return callback(err);
			fs.stat(file, (err, stat) => {
				/* istanbul ignore if */
				if (err) return callback(err);
				const precision = stat.mtime.getTime() % 1e3 === 0 ? "s" : "ms";
				Object.defineProperty(fs, cacheSymbol, { value: precision });
				callback(null, stat.mtime, precision);
			});
		});
	}
	function getMtime(precision) {
		let now = Date.now();
		if (precision === "s") now = Math.ceil(now / 1e3) * 1e3;
		return new Date(now);
	}
	module.exports.probe = probe;
	module.exports.getMtime = getMtime;
}));
//#endregion
//#region ../../node_modules/.pnpm/proper-lockfile@4.1.2/node_modules/proper-lockfile/lib/lockfile.js
var require_lockfile = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var path$3 = require("path");
	var fs = require_graceful_fs$1.require_graceful_fs();
	var retry = require_retry();
	var onExit = require_signal_exit();
	var mtimePrecision = require_mtime_precision();
	var locks = {};
	function getLockFile(file, options) {
		return options.lockfilePath || `${file}.lock`;
	}
	function resolveCanonicalPath(file, options, callback) {
		if (!options.realpath) return callback(null, path$3.resolve(file));
		options.fs.realpath(file, callback);
	}
	function acquireLock(file, options, callback) {
		const lockfilePath = getLockFile(file, options);
		options.fs.mkdir(lockfilePath, (err) => {
			if (!err) return mtimePrecision.probe(lockfilePath, options.fs, (err, mtime, mtimePrecision) => {
				/* istanbul ignore if */
				if (err) {
					options.fs.rmdir(lockfilePath, () => {});
					return callback(err);
				}
				callback(null, mtime, mtimePrecision);
			});
			if (err.code !== "EEXIST") return callback(err);
			if (options.stale <= 0) return callback(Object.assign(/* @__PURE__ */ new Error("Lock file is already being held"), {
				code: "ELOCKED",
				file
			}));
			options.fs.stat(lockfilePath, (err, stat) => {
				if (err) {
					if (err.code === "ENOENT") return acquireLock(file, {
						...options,
						stale: 0
					}, callback);
					return callback(err);
				}
				if (!isLockStale(stat, options)) return callback(Object.assign(/* @__PURE__ */ new Error("Lock file is already being held"), {
					code: "ELOCKED",
					file
				}));
				removeLock(file, options, (err) => {
					if (err) return callback(err);
					acquireLock(file, {
						...options,
						stale: 0
					}, callback);
				});
			});
		});
	}
	function isLockStale(stat, options) {
		return stat.mtime.getTime() < Date.now() - options.stale;
	}
	function removeLock(file, options, callback) {
		options.fs.rmdir(getLockFile(file, options), (err) => {
			if (err && err.code !== "ENOENT") return callback(err);
			callback();
		});
	}
	function updateLock(file, options) {
		const lock = locks[file];
		/* istanbul ignore if */
		if (lock.updateTimeout) return;
		lock.updateDelay = lock.updateDelay || options.update;
		lock.updateTimeout = setTimeout(() => {
			lock.updateTimeout = null;
			options.fs.stat(lock.lockfilePath, (err, stat) => {
				const isOverThreshold = lock.lastUpdate + options.stale < Date.now();
				if (err) {
					if (err.code === "ENOENT" || isOverThreshold) return setLockAsCompromised(file, lock, Object.assign(err, { code: "ECOMPROMISED" }));
					lock.updateDelay = 1e3;
					return updateLock(file, options);
				}
				if (!(lock.mtime.getTime() === stat.mtime.getTime())) return setLockAsCompromised(file, lock, Object.assign(/* @__PURE__ */ new Error("Unable to update lock within the stale threshold"), { code: "ECOMPROMISED" }));
				const mtime = mtimePrecision.getMtime(lock.mtimePrecision);
				options.fs.utimes(lock.lockfilePath, mtime, mtime, (err) => {
					const isOverThreshold = lock.lastUpdate + options.stale < Date.now();
					if (lock.released) return;
					if (err) {
						if (err.code === "ENOENT" || isOverThreshold) return setLockAsCompromised(file, lock, Object.assign(err, { code: "ECOMPROMISED" }));
						lock.updateDelay = 1e3;
						return updateLock(file, options);
					}
					lock.mtime = mtime;
					lock.lastUpdate = Date.now();
					lock.updateDelay = null;
					updateLock(file, options);
				});
			});
		}, lock.updateDelay);
		/* istanbul ignore else */
		if (lock.updateTimeout.unref) lock.updateTimeout.unref();
	}
	function setLockAsCompromised(file, lock, err) {
		lock.released = true;
		/* istanbul ignore if */
		if (lock.updateTimeout) clearTimeout(lock.updateTimeout);
		if (locks[file] === lock) delete locks[file];
		lock.options.onCompromised(err);
	}
	function lock(file, options, callback) {
		/* istanbul ignore next */
		options = {
			stale: 1e4,
			update: null,
			realpath: true,
			retries: 0,
			fs,
			onCompromised: (err) => {
				throw err;
			},
			...options
		};
		options.retries = options.retries || 0;
		options.retries = typeof options.retries === "number" ? { retries: options.retries } : options.retries;
		options.stale = Math.max(options.stale || 0, 2e3);
		options.update = options.update == null ? options.stale / 2 : options.update || 0;
		options.update = Math.max(Math.min(options.update, options.stale / 2), 1e3);
		resolveCanonicalPath(file, options, (err, file) => {
			if (err) return callback(err);
			const operation = retry.operation(options.retries);
			operation.attempt(() => {
				acquireLock(file, options, (err, mtime, mtimePrecision) => {
					if (operation.retry(err)) return;
					if (err) return callback(operation.mainError());
					const lock = locks[file] = {
						lockfilePath: getLockFile(file, options),
						mtime,
						mtimePrecision,
						options,
						lastUpdate: Date.now()
					};
					updateLock(file, options);
					callback(null, (releasedCallback) => {
						if (lock.released) return releasedCallback && releasedCallback(Object.assign(/* @__PURE__ */ new Error("Lock is already released"), { code: "ERELEASED" }));
						unlock(file, {
							...options,
							realpath: false
						}, releasedCallback);
					});
				});
			});
		});
	}
	function unlock(file, options, callback) {
		options = {
			fs,
			realpath: true,
			...options
		};
		resolveCanonicalPath(file, options, (err, file) => {
			if (err) return callback(err);
			const lock = locks[file];
			if (!lock) return callback(Object.assign(/* @__PURE__ */ new Error("Lock is not acquired/owned by you"), { code: "ENOTACQUIRED" }));
			lock.updateTimeout && clearTimeout(lock.updateTimeout);
			lock.released = true;
			delete locks[file];
			removeLock(file, options, callback);
		});
	}
	function check(file, options, callback) {
		options = {
			stale: 1e4,
			realpath: true,
			fs,
			...options
		};
		options.stale = Math.max(options.stale || 0, 2e3);
		resolveCanonicalPath(file, options, (err, file) => {
			if (err) return callback(err);
			options.fs.stat(getLockFile(file, options), (err, stat) => {
				if (err) return err.code === "ENOENT" ? callback(null, false) : callback(err);
				return callback(null, !isLockStale(stat, options));
			});
		});
	}
	function getLocks() {
		return locks;
	}
	/* istanbul ignore next */
	onExit(() => {
		for (const file in locks) {
			const options = locks[file].options;
			try {
				options.fs.rmdirSync(getLockFile(file, options));
			} catch (e) {}
		}
	});
	module.exports.lock = lock;
	module.exports.unlock = unlock;
	module.exports.check = check;
	module.exports.getLocks = getLocks;
}));
//#endregion
//#region ../../node_modules/.pnpm/proper-lockfile@4.1.2/node_modules/proper-lockfile/lib/adapter.js
var require_adapter = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var fs = require_graceful_fs$1.require_graceful_fs();
	function createSyncFs(fs) {
		const methods = [
			"mkdir",
			"realpath",
			"stat",
			"rmdir",
			"utimes"
		];
		const newFs = { ...fs };
		methods.forEach((method) => {
			newFs[method] = (...args) => {
				const callback = args.pop();
				let ret;
				try {
					ret = fs[`${method}Sync`](...args);
				} catch (err) {
					return callback(err);
				}
				callback(null, ret);
			};
		});
		return newFs;
	}
	function toPromise(method) {
		return (...args) => new Promise((resolve, reject) => {
			args.push((err, result) => {
				if (err) reject(err);
				else resolve(result);
			});
			method(...args);
		});
	}
	function toSync(method) {
		return (...args) => {
			let err;
			let result;
			args.push((_err, _result) => {
				err = _err;
				result = _result;
			});
			method(...args);
			if (err) throw err;
			return result;
		};
	}
	function toSyncOptions(options) {
		options = { ...options };
		options.fs = createSyncFs(options.fs || fs);
		if (typeof options.retries === "number" && options.retries > 0 || options.retries && typeof options.retries.retries === "number" && options.retries.retries > 0) throw Object.assign(/* @__PURE__ */ new Error("Cannot use retries with the sync api"), { code: "ESYNC" });
		return options;
	}
	module.exports = {
		toPromise,
		toSync,
		toSyncOptions
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/proper-lockfile@4.1.2/node_modules/proper-lockfile/index.js
var require_proper_lockfile = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var lockfile = require_lockfile();
	var { toPromise, toSync, toSyncOptions } = require_adapter();
	async function lock(file, options) {
		return toPromise(await toPromise(lockfile.lock)(file, options));
	}
	function lockSync(file, options) {
		return toSync(toSync(lockfile.lock)(file, toSyncOptions(options)));
	}
	function unlock(file, options) {
		return toPromise(lockfile.unlock)(file, options);
	}
	function unlockSync(file, options) {
		return toSync(lockfile.unlock)(file, toSyncOptions(options));
	}
	function check(file, options) {
		return toPromise(lockfile.check)(file, options);
	}
	function checkSync(file, options) {
		return toSync(lockfile.check)(file, toSyncOptions(options));
	}
	module.exports = lock;
	module.exports.lock = lock;
	module.exports.unlock = unlock;
	module.exports.lockSync = lockSync;
	module.exports.unlockSync = unlockSync;
	module.exports.check = check;
	module.exports.checkSync = checkSync;
}));
//#endregion
//#region ../../packages/core/src/node/credential-protection/file-lock.ts
var import_proper_lockfile = /* @__PURE__ */ require_chunk.__toESM(require_proper_lockfile());
var STALE_MS = 1e4;
var UPDATE_MS = 5e3;
var DEFAULT_MAX_WAIT_MS = 2e3;
var DEFAULT_RETRY_DELAY_MS = 50;
new Int32Array(new SharedArrayBuffer(4));
function resolveCredentialFileLockPath(filePath) {
	const absolute = node_path.default.resolve(filePath);
	return node_path.default.join(node_path.default.dirname(absolute), `.${node_path.default.basename(absolute)}.workbuddy.lock`);
}
async function withCredentialFileLock(filePath, action, options = {}) {
	const target = prepareTarget(filePath);
	const compromise = createCompromiseState();
	const release = await import_proper_lockfile.lock(target, asyncOptions(target, options, compromise));
	try {
		return await action();
	} finally {
		await releaseAsync(release, compromise);
	}
}
async function tryWithCredentialFileLock(filePath, action) {
	const target = prepareTarget(filePath);
	const compromise = createCompromiseState();
	let release;
	try {
		release = await import_proper_lockfile.lock(target, lockOptions(target, compromise));
	} catch (error) {
		if (isBusy(error)) return { acquired: false };
		throw error;
	}
	try {
		return {
			acquired: true,
			value: await action()
		};
	} finally {
		await releaseAsync(release, compromise);
	}
}
function prepareTarget(filePath) {
	const target = node_path.default.resolve(filePath);
	node_fs.default.mkdirSync(node_path.default.dirname(target), { recursive: true });
	return target;
}
function lockOptions(target, compromise) {
	return {
		lockfilePath: resolveCredentialFileLockPath(target),
		realpath: false,
		retries: 0,
		stale: STALE_MS,
		update: UPDATE_MS,
		onCompromised: compromise.onCompromised
	};
}
function asyncOptions(target, options, compromise) {
	const maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
	const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
	return {
		...lockOptions(target, compromise),
		retries: {
			retries: Math.max(0, Math.ceil(maxWaitMs / retryDelayMs)),
			factor: 1,
			minTimeout: retryDelayMs,
			maxTimeout: retryDelayMs
		}
	};
}
function createCompromiseState() {
	const state = {
		error: void 0,
		onCompromised: (error) => {
			state.error ??= error;
		}
	};
	return state;
}
async function releaseAsync(release, compromise) {
	if (compromise.error) throw compromise.error;
	try {
		await release();
	} catch (error) {
		throw compromise.error ?? error;
	}
	if (compromise.error) throw compromise.error;
}
function isBusy(error) {
	return typeof error === "object" && error !== null && "code" in error && error.code === "ELOCKED";
}
//#endregion
//#region ../../packages/at-rest-crypto/dist/field.mjs
function isStandardEncryptedFieldWrapper(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const wrapper = value;
	const keys = Object.keys(wrapper).sort();
	return keys.length === 2 && keys[0] === "$wbEncrypted" && keys[1] === "envelope" && wrapper.$wbEncrypted === 1 && typeof wrapper.envelope === "string";
}
function isAsymmetricEncryptedFieldWrapper(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const wrapper = value;
	const keys = Object.keys(wrapper).sort();
	return keys.length === 3 && keys[0] === "$wbEncrypted" && keys[1] === "envelope" && keys[2] === "scheme" && wrapper.$wbEncrypted === 1 && wrapper.scheme === "asym-v1" && typeof wrapper.envelope === "string";
}
function isEncryptedFieldWrapper(value) {
	return isStandardEncryptedFieldWrapper(value) || isAsymmetricEncryptedFieldWrapper(value);
}
var ProtectedFieldCodec = class {
	asymmetricKeyMaterial;
	crypto;
	mode;
	constructor(options) {
		this.mode = options.mode;
		this.crypto = options.key ? new require_dist.AtRestCrypto(options.key) : void 0;
		this.asymmetricKeyMaterial = options.asymmetricKeyMaterial;
	}
	encodeString(plaintext, context, protection = "standard") {
		if (this.mode === "disabled") return plaintext;
		return this.seal(Buffer.from(plaintext, "utf8"), context, protection);
	}
	decodeString(value, context) {
		if (typeof value === "string") return value;
		return this.open(value, context).toString("utf8");
	}
	canSeal(protection = "standard") {
		if (this.mode === "disabled") return false;
		return protection === "advanced" ? this.asymmetricKeyMaterial !== void 0 : this.crypto !== void 0;
	}
	seal(plaintext, context, protection = "standard") {
		if (this.mode === "disabled") throw new require_dist.CryptoUnavailableError("disabled field codec cannot create encrypted wrappers");
		if (protection === "advanced") return {
			$wbEncrypted: 1,
			scheme: "asym-v1",
			envelope: require_dist.sealAsymmetricEnvelope(plaintext, this.requireAdvancedContext(context), this.requireAsymmetricKeyMaterial()).toString("base64")
		};
		return {
			$wbEncrypted: 1,
			envelope: this.requireCrypto().seal(plaintext, { framing: "field" }).toString("base64")
		};
	}
	open(value, context) {
		if (!isEncryptedFieldWrapper(value)) throw new require_dist.IntegrityError("encrypted field wrapper does not match the schema");
		const envelopeBytes = Buffer.from(value.envelope, "base64");
		if (envelopeBytes.toString("base64") !== value.envelope) throw new require_dist.IntegrityError("encrypted field envelope must be canonical base64");
		if (isAsymmetricEncryptedFieldWrapper(value)) return require_dist.openAsymmetricEnvelope(envelopeBytes, this.requireAdvancedContext(context), this.requireAsymmetricKeyMaterial());
		const envelope = require_dist.parseSupportedEnvelope(envelopeBytes);
		return this.requireCrypto().open(envelope, { framing: "field" });
	}
	dispose() {
		this.crypto?.dispose();
	}
	requireCrypto() {
		if (!this.crypto) throw new require_dist.CryptoUnavailableError("at-rest key is not ready");
		return this.crypto;
	}
	requireAsymmetricKeyMaterial() {
		if (!this.asymmetricKeyMaterial) throw new require_dist.CryptoUnavailableError("advanced at-rest key material is not ready");
		return this.asymmetricKeyMaterial;
	}
	/** asym-v1 把 purpose/resourceId/fieldPath 明文写进 envelope 并在读取时比对。 */
	requireAdvancedContext(context) {
		if (!context) throw new require_dist.CryptoUnavailableError("advanced field protection requires a context");
		return {
			framing: "field",
			...context
		};
	}
};
function isObject$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasEncryptedFieldMarker(value) {
	return isObject$1(value) && value.$wbEncrypted === 1;
}
function* walkField(current, path, depth, concrete) {
	if (!isObject$1(current) && !Array.isArray(current)) return;
	const node = current;
	const segment = path[depth];
	if (depth === path.length - 1) {
		if (segment === "*") for (const key of Object.keys(node)) yield {
			parent: node,
			key,
			concretePath: [...concrete, key]
		};
		else yield {
			parent: node,
			key: segment,
			concretePath: [...concrete, segment]
		};
		return;
	}
	if (segment === "*") {
		for (const key of Object.keys(node)) yield* walkField(node[key], path, depth + 1, [...concrete, key]);
		return;
	}
	yield* walkField(node[segment], path, depth + 1, [...concrete, segment]);
}
function escapeJsonPointerSegment(segment) {
	return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}
function unescapeJsonPointerSegment(segment) {
	return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}
function pointerOf(path) {
	return `/${path.map(escapeJsonPointerSegment).join("/")}`;
}
function fieldPathSegments(fieldPath) {
	return fieldPath.slice(1).split("/").map(unescapeJsonPointerSegment);
}
function fieldPathPatternsOverlap(a, b) {
	return a.length === b.length && a.every((segment, index) => segment === "*" || b[index] === "*" || segment === b[index]);
}
var ProtectedJsonFields = class {
	codec;
	mode;
	purpose;
	resourceId;
	onUnavailable;
	previousFields = /* @__PURE__ */ new Map();
	constructor(options) {
		this.mode = options.mode;
		this.purpose = options.purpose;
		this.resourceId = options.resourceId;
		this.onUnavailable = options.onUnavailable;
		this.codec = new ProtectedFieldCodec({
			mode: options.mode,
			key: options.key,
			asymmetricKeyMaterial: options.asymmetricKeyMaterial
		});
	}
	decode(input, specs) {
		const value = this.clone(input);
		this.assertUniqueFieldPaths(specs);
		this.previousFields.clear();
		let migrationNeeded = false;
		for (const spec of specs) {
			const specFieldPath = this.getFieldPath(spec);
			const wildcard = spec.path.includes("*");
			const resolvedFields = [...this.resolveFields(value, spec.path)];
			const ownerCounts = /* @__PURE__ */ new Map();
			if (wildcard) for (const resolved of resolvedFields) ownerCounts.set(resolved.parent, (ownerCounts.get(resolved.parent) ?? 0) + 1);
			for (const resolved of resolvedFields) {
				if (!(resolved.key in resolved.parent)) continue;
				const rawValue = resolved.parent[resolved.key];
				const previousKey = wildcard ? pointerOf(resolved.concretePath) : specFieldPath;
				const ownerIdentity = wildcard && ownerCounts.get(resolved.parent) === 1 ? resolved.parent : void 0;
				try {
					let plaintext;
					let fieldMigrationNeeded = false;
					if (spec.kind === "json") {
						if (isEncryptedFieldWrapper(rawValue)) {
							plaintext = JSON.parse(this.codec.open(rawValue, this.context(specFieldPath)).toString("utf8"));
							fieldMigrationNeeded = this.requiresAdvancedMigration(rawValue, spec);
						} else if (isObject$1(rawValue)) {
							plaintext = rawValue;
							fieldMigrationNeeded = this.mode === "required" && this.codec.canSeal(spec.protection ?? "standard");
						} else throw new Error("sensitive JSON field has an invalid value");
						if (!isObject$1(plaintext)) throw new Error("sensitive JSON field must decode to an object");
					} else {
						plaintext = this.codec.decodeString(rawValue, this.context(specFieldPath));
						fieldMigrationNeeded = this.mode === "required" && typeof rawValue === "string" && this.codec.canSeal(spec.protection ?? "standard");
						fieldMigrationNeeded ||= this.requiresAdvancedMigration(rawValue, spec);
					}
					if (isEncryptedFieldWrapper(rawValue)) this.previousFields.set(previousKey, {
						kind: "readable",
						persisted: rawValue,
						plaintext: this.clone(plaintext),
						migrationNeeded: this.mode === "disabled" || fieldMigrationNeeded,
						specFieldPath,
						concretePath: resolved.concretePath,
						ownerIdentity
					});
					migrationNeeded ||= fieldMigrationNeeded;
					resolved.parent[resolved.key] = plaintext;
				} catch (error) {
					if (hasEncryptedFieldMarker(rawValue)) this.previousFields.set(previousKey, {
						kind: "opaque",
						persisted: rawValue,
						specFieldPath,
						concretePath: resolved.concretePath,
						ownerIdentity
					});
					delete resolved.parent[resolved.key];
					this.reportUnavailable(specFieldPath, error);
				}
			}
		}
		return {
			value,
			migrationNeeded
		};
	}
	encode(input, specs) {
		const value = this.clone(input);
		this.assertUniqueFieldPaths(specs);
		for (const spec of specs) {
			const specFieldPath = this.getFieldPath(spec);
			const wildcard = spec.path.includes("*");
			const resolvedFields = [...this.resolveFields(value, spec.path)].map((resolved) => ({
				...resolved,
				previousKey: wildcard ? pointerOf(resolved.concretePath) : specFieldPath,
				sourceParent: this.resolveConcreteParent(input, resolved.concretePath)
			}));
			if (!wildcard) {
				const resolvedKeys = new Set(resolvedFields.map((resolved) => resolved.previousKey));
				for (const [previousKey, previous] of this.previousFields) if (previous.kind === "opaque" && previous.specFieldPath === specFieldPath && !resolvedKeys.has(previousKey)) this.restoreOpaqueField(value, previous.concretePath, previous.persisted);
			}
			for (const resolved of resolvedFields) {
				const previous = this.findPreviousField(resolved.previousKey, specFieldPath, wildcard, resolved.sourceParent);
				if (previous?.kind === "opaque" && resolved.sourceParent !== void 0 && !(resolved.key in resolved.sourceParent)) {
					resolved.parent[resolved.key] = previous.persisted;
					continue;
				}
				if (!(resolved.key in resolved.parent)) {
					if (previous?.kind === "opaque") resolved.parent[resolved.key] = previous.persisted;
					continue;
				}
				const fieldValue = resolved.parent[resolved.key];
				if (previous?.kind === "readable" && !previous.migrationNeeded && (0, node_util.isDeepStrictEqual)(fieldValue, previous.plaintext)) {
					resolved.parent[resolved.key] = previous.persisted;
					continue;
				}
				if (isEncryptedFieldWrapper(fieldValue)) {
					if (this.mode === "required") this.codec.open(fieldValue, this.context(specFieldPath));
					else if (spec.kind === "json") {
						const plaintext = JSON.parse(this.codec.open(fieldValue, this.context(specFieldPath)).toString("utf8"));
						if (!isObject$1(plaintext)) throw new Error(`sensitive JSON field is invalid: ${specFieldPath}`);
						resolved.parent[resolved.key] = plaintext;
					} else resolved.parent[resolved.key] = this.codec.decodeString(fieldValue, this.context(specFieldPath));
					continue;
				}
				if (spec.kind === "json") {
					if (!isObject$1(fieldValue)) throw new Error(`sensitive JSON field is invalid: ${specFieldPath}`);
					if (this.mode === "required") try {
						resolved.parent[resolved.key] = this.codec.seal(Buffer.from(JSON.stringify(fieldValue), "utf8"), this.context(specFieldPath), spec.protection ?? "standard");
					} catch (error) {
						this.reportUnavailable(specFieldPath, error);
					}
					continue;
				}
				if (typeof fieldValue !== "string") throw new Error(`sensitive string field is invalid: ${specFieldPath}`);
				try {
					resolved.parent[resolved.key] = this.codec.encodeString(fieldValue, this.context(specFieldPath), spec.protection ?? "standard");
				} catch (error) {
					this.reportUnavailable(specFieldPath, error);
				}
			}
		}
		return value;
	}
	findPreviousField(previousKey, specFieldPath, wildcard, ownerIdentity) {
		if (!wildcard) return this.previousFields.get(previousKey);
		if (ownerIdentity === void 0) return this.previousFields.get(previousKey);
		for (const previous of this.previousFields.values()) if (previous.specFieldPath === specFieldPath && previous.ownerIdentity === ownerIdentity) return previous;
		const indexedPrevious = this.previousFields.get(previousKey);
		if (indexedPrevious?.ownerIdentity === void 0) return indexedPrevious;
	}
	discardPrevious(fieldPath) {
		if (!fieldPath.startsWith("/")) throw new Error("fieldPath must be an absolute JSON pointer");
		this.previousFields.delete(fieldPath);
	}
	dispose() {
		this.codec.dispose();
		this.previousFields.clear();
	}
	context(fieldPath) {
		return {
			purpose: this.purpose,
			resourceId: this.resourceId,
			fieldPath
		};
	}
	reportUnavailable(fieldPath, error) {
		try {
			this.onUnavailable?.(fieldPath, error);
		} catch {}
	}
	requiresAdvancedMigration(value, spec) {
		return this.mode === "required" && spec.protection === "advanced" && this.codec.canSeal("advanced") && isEncryptedFieldWrapper(value) && !("scheme" in value);
	}
	getFieldPath(spec) {
		if (spec.fieldPath !== void 0) {
			if (!spec.fieldPath.startsWith("/")) throw new Error("sensitive fieldPath must be an absolute JSON pointer");
			return spec.fieldPath;
		}
		return `/${spec.path.map((segment) => segment.replace(/~/g, "~0").replace(/\//g, "~1")).join("/")}`;
	}
	assertUniqueFieldPaths(specs) {
		const fieldPaths = /* @__PURE__ */ new Set();
		const patterns = [];
		for (const spec of specs) {
			const fieldPath = this.getFieldPath(spec);
			if (fieldPaths.has(fieldPath)) throw new Error(`duplicate sensitive fieldPath: ${fieldPath}`);
			fieldPaths.add(fieldPath);
			const segments = fieldPathSegments(fieldPath);
			for (const existing of patterns) if (fieldPathPatternsOverlap(existing, segments)) throw new Error(`overlapping sensitive fieldPath: ${fieldPath}`);
			patterns.push(segments);
		}
	}
	*resolveFields(root, path) {
		if (path.length === 0) return;
		yield* walkField(root, path, 0, []);
	}
	resolveConcreteParent(root, path) {
		let current = root;
		for (const segment of path.slice(0, -1)) {
			if (!isObject$1(current) && !Array.isArray(current)) return;
			current = current[segment];
		}
		return isObject$1(current) || Array.isArray(current) ? current : void 0;
	}
	restoreOpaqueField(root, path, persisted) {
		if (path.length === 0) return;
		let parent = root;
		for (let index = 0; index < path.length - 1; index += 1) {
			const segment = path[index];
			const child = parent[segment];
			if (isObject$1(child) || Array.isArray(child)) {
				parent = child;
				continue;
			}
			if (child !== void 0) return;
			const nextSegment = path[index + 1];
			const created = /^\d+$/.test(nextSegment) ? [] : {};
			parent[segment] = created;
			parent = created;
		}
		parent[path[path.length - 1]] = persisted;
	}
	clone(value) {
		return JSON.parse(JSON.stringify(value));
	}
};
//#endregion
//#region ../../packages/core/src/node/credential-protection/runtime.ts
var state = { status: "disabled" };
var writeMode = "disabled";
function setCredentialProtectionPending() {
	if (state.status === "disabled") {
		state = { status: "pending" };
		return true;
	}
	return state.status === "pending";
}
function configureCredentialProtection(bootstrap) {
	if (!bootstrap.symmetricKey) {
		if (state.status !== "ready") {
			writeMode = bootstrap.mode;
			state = {
				status: "unavailable",
				category: bootstrap.symmetricUnavailable
			};
		}
		return true;
	}
	const key = normalizeKey(bootstrap.symmetricKey);
	if (!key) {
		if (state.status === "ready") return false;
		writeMode = bootstrap.mode;
		state = {
			status: "unavailable",
			category: "invalid-key"
		};
		return true;
	}
	if (state.status === "ready") {
		const matches = writeMode === bootstrap.mode && state.key.keyId === key.keyId;
		key.key.fill(0);
		return matches;
	}
	writeMode = bootstrap.mode;
	state = {
		status: "ready",
		key
	};
	return true;
}
function getCredentialProtectionState() {
	return state.status === "ready" ? { status: "ready" } : { ...state };
}
function createCredentialFieldCodec(options) {
	const readyKey = state.status === "ready" ? {
		keyId: state.key.keyId,
		key: Buffer.from(state.key.key)
	} : void 0;
	try {
		return new ProtectedJsonFields({
			mode: writeMode,
			key: readyKey,
			...options
		});
	} finally {
		readyKey?.key.fill(0);
	}
}
function disposeCredentialProtection() {
	if (state.status === "ready") state.key.key.fill(0);
	state = { status: "disabled" };
	writeMode = "disabled";
}
function normalizeKey(input) {
	const key = Buffer.from(input.key);
	try {
		if (key.length !== 32 || key.every((byte) => byte === 0) || require_dist.deriveAtRestKeyId(key) !== input.keyId) return;
		return {
			keyId: input.keyId,
			key: Buffer.from(key)
		};
	} catch {
		return;
	} finally {
		key.fill(0);
	}
}
//#endregion
//#region ../../packages/core/src/node/credential-protection/failure-reporter.ts
var WARNING_INTERVAL_MS$1 = 6e4;
var registries = /* @__PURE__ */ new Map();
var CredentialProtectionFailureReporter = class {
	constructor(options) {
		this.options = options;
		const configDir = resolveCredentialProtectionConfigDir(options.filePath);
		const registryKey = `${configDir}\0${options.processRole}`;
		const current = registries.get(registryKey);
		if (current) {
			current.loggerRef.current = options.logger;
			this.state = current;
			return;
		}
		const loggerRef = { current: options.logger };
		const failed = /* @__PURE__ */ new Set();
		const recoveryChecked = /* @__PURE__ */ new Set();
		const lastWarningAt = /* @__PURE__ */ new Map();
		const state = {
			loggerRef,
			registry: new require_dist.AtRestFailureRegistry({
				configDir,
				processRole: options.processRole,
				withFileLock: (filePath, action) => withCredentialFileLock(filePath, action),
				logger: {
					warn: (message) => {
						if (message.includes("failure-registry")) warnAtMostOncePerInterval({
							loggerRef,
							lastWarningAt
						}, `internal\0${message}`, message);
					},
					info: (message) => safeInfo(loggerRef.current, message)
				}
			}),
			failed,
			recoveryChecked,
			lastWarningAt
		};
		registries.set(registryKey, state);
		this.state = state;
	}
	attempt(operation) {
		let failed = false;
		return {
			onUnavailable: (_fieldPath, error) => {
				if (failed) return;
				failed = true;
				this.record(operation, error);
			},
			fail: (error) => {
				if (failed) return;
				failed = true;
				this.record(operation, error);
			},
			complete: () => {
				if (!failed) this.recover(operation);
			}
		};
	}
	record(operation, error) {
		const selector = this.selector(operation);
		const key = selectorKey(selector);
		const category = classifyCredentialProtectionFailure(error);
		this.state.failed.add(key);
		warnAtMostOncePerInterval(this.state, key, `[AtRestEncryption] unavailable adapter=${selector.adapter} resource=${selector.resourceId} operation=${operation} category=${category} role=${this.options.processRole}; continuing`);
		this.state.registry.record({
			...selector,
			category
		}).catch(() => void 0);
	}
	recordStorageFailure(operation, error) {
		if (classifyCredentialProtectionFailure(error) !== "unknown") this.record(operation, error);
	}
	recover(operation) {
		const selector = this.selector(operation);
		const key = selectorKey(selector);
		const failedInProcess = this.state.failed.delete(key);
		if (!failedInProcess && this.state.recoveryChecked.has(key)) return;
		if (!failedInProcess && !this.state.registry.hasFailureSync(selector)) {
			this.state.recoveryChecked.add(key);
			return;
		}
		this.state.recoveryChecked.add(key);
		this.state.registry.clear(selector).catch(() => void 0);
	}
	selector(operation) {
		return {
			resourceId: this.options.resourceId,
			adapter: this.options.adapter,
			operation
		};
	}
};
function resolveCredentialProtectionConfigDir(filePath) {
	const parent = node_path.default.dirname(node_path.default.resolve(filePath));
	return node_path.default.basename(parent) === "auth" ? node_path.default.dirname(parent) : parent;
}
function classifyCredentialProtectionFailure(error) {
	const runtime = getCredentialProtectionState();
	const code = readErrorCode(error);
	if (code === "CRYPTO_UNAVAILABLE") return runtime.status === "unavailable" ? runtime.category : "missing-key";
	if (code === "KEY_MISMATCH") return "invalid-key";
	if (code === "INTEGRITY_ERROR") return "integrity";
	if (code === "UNSUPPORTED_CIPHERTEXT") return "unsupported";
	if (code === "ELOCKED") return "lock";
	if (typeof code === "string" && (code.startsWith("E") || code.startsWith("UV_"))) return "io";
	return runtime.status === "unavailable" ? runtime.category : "unknown";
}
function readErrorCode(error) {
	return typeof error === "object" && error !== null && "code" in error ? error.code : void 0;
}
function selectorKey(selector) {
	return `${selector.resourceId}\0${selector.adapter}\0${selector.operation}`;
}
function safeWarn(logger, message) {
	try {
		logger.warn(message);
	} catch {}
}
function safeInfo(logger, message) {
	try {
		logger.info?.(message);
	} catch {}
}
function warnAtMostOncePerInterval(state, key, message) {
	const now = Date.now();
	const lastWarningAt = state.lastWarningAt.get(key);
	if (lastWarningAt !== void 0 && now - lastWarningAt < WARNING_INTERVAL_MS$1) return;
	state.lastWarningAt.set(key, now);
	safeWarn(state.loggerRef.current, message);
}
//#endregion
//#region ../../packages/core/src/node/credential-protection/migration.ts
var migrations = /* @__PURE__ */ new Map();
var lastWarnings = /* @__PURE__ */ new Map();
var WARNING_INTERVAL_MS = 6e4;
var RENAME_RETRY_INITIAL_DELAY_MS = 25;
var RENAME_RETRY_MAX_DELAY_MS = 750;
var RENAME_RETRY_MAX_ATTEMPTS = 9;
var RENAME_RETRY_TOTAL_DELAY_MS = 3e3;
var RETRYABLE_RENAME_ERROR_CODES = new Set([
	"EACCES",
	"EAGAIN",
	"EBUSY",
	"EPERM",
	"ETXTBSY"
]);
function scheduleCredentialFileMigration(filePath, migrate, options = {}) {
	const target = node_path.default.resolve(filePath);
	if (migrations.has(target)) return false;
	const task = Promise.resolve().then(async () => {
		if (!(await tryWithCredentialFileLock(target, async () => {
			const current = await node_fs.default.promises.readFile(target);
			const migrated = await migrate(current);
			if (!migrated || current.equals(migrated)) return;
			await writeCredentialFileAtomically(target, migrated, { verifyTemporary: options.verifyTemporary ? (temporaryBytes) => options.verifyTemporary?.(temporaryBytes, current) : void 0 });
		})).acquired) throw Object.assign(/* @__PURE__ */ new Error("credential migration lock is busy"), { code: "ELOCKED" });
	}).catch((error) => reportFailure(target, error, options.onFailure)).finally(() => {
		if (migrations.get(target) === task) migrations.delete(target);
	});
	migrations.set(target, task);
	return true;
}
async function writeCredentialFileAtomically(filePath, bytes, options = {}) {
	const target = node_path.default.resolve(filePath);
	await node_fs.default.promises.mkdir(node_path.default.dirname(target), { recursive: true });
	const mode = await readMode(target);
	const temporary = uniqueTemporaryPath(target);
	let handle;
	try {
		handle = await node_fs.default.promises.open(temporary, "wx", mode);
		await handle.writeFile(bytes);
		await handle.sync();
		await handle.close();
		handle = void 0;
		if (options.verifyTemporary) await options.verifyTemporary(await node_fs.default.promises.readFile(temporary));
		await renameWithRetry(temporary, target);
		await syncDirectory(node_path.default.dirname(target));
	} catch (error) {
		await handle?.close().catch(() => void 0);
		await node_fs.default.promises.unlink(temporary).catch(() => void 0);
		throw error;
	}
}
function writeCredentialFileAtomicallySync(filePath, bytes, options = {}) {
	const target = node_path.default.resolve(filePath);
	node_fs.default.mkdirSync(node_path.default.dirname(target), { recursive: true });
	const mode = readModeSync(target);
	const temporary = uniqueTemporaryPath(target);
	let descriptor;
	try {
		descriptor = node_fs.default.openSync(temporary, "wx", mode);
		node_fs.default.writeFileSync(descriptor, bytes);
		node_fs.default.fsyncSync(descriptor);
		node_fs.default.closeSync(descriptor);
		descriptor = void 0;
		options.verifyTemporary?.(node_fs.default.readFileSync(temporary));
		renameSyncWithRetry(temporary, target);
		syncDirectorySync(node_path.default.dirname(target));
	} catch (error) {
		if (descriptor !== void 0) try {
			node_fs.default.closeSync(descriptor);
		} catch {}
		try {
			node_fs.default.unlinkSync(temporary);
		} catch {}
		throw error;
	}
}
async function readMode(filePath) {
	try {
		return (await node_fs.default.promises.stat(filePath)).mode & 511;
	} catch (error) {
		if (isNodeError$1(error, "ENOENT")) return 384;
		throw error;
	}
}
function readModeSync(filePath) {
	try {
		return node_fs.default.statSync(filePath).mode & 511;
	} catch (error) {
		if (isNodeError$1(error, "ENOENT")) return 384;
		throw error;
	}
}
function uniqueTemporaryPath(filePath) {
	return node_path.default.join(node_path.default.dirname(filePath), `.${node_path.default.basename(filePath)}.${process.pid}.${(0, node_crypto.randomUUID)()}.tmp`);
}
async function renameWithRetry(temporary, target) {
	let previousDelayMs = RENAME_RETRY_INITIAL_DELAY_MS;
	let totalDelayMs = 0;
	for (let attempt = 0;; attempt++) try {
		await node_fs.default.promises.rename(temporary, target);
		return;
	} catch (error) {
		if (!isRetryableRenameError(error) || attempt >= RENAME_RETRY_MAX_ATTEMPTS) throw error;
		const delayMs = nextRenameRetryDelay(previousDelayMs, totalDelayMs);
		if (delayMs <= 0) throw error;
		await sleep(delayMs);
		previousDelayMs = delayMs;
		totalDelayMs += delayMs;
	}
}
function renameSyncWithRetry(temporary, target) {
	let previousDelayMs = RENAME_RETRY_INITIAL_DELAY_MS;
	let totalDelayMs = 0;
	for (let attempt = 0;; attempt++) try {
		node_fs.default.renameSync(temporary, target);
		return;
	} catch (error) {
		if (!isRetryableRenameError(error) || attempt >= RENAME_RETRY_MAX_ATTEMPTS) throw error;
		const delayMs = nextRenameRetryDelay(previousDelayMs, totalDelayMs);
		if (delayMs <= 0) throw error;
		sleepSync(delayMs);
		previousDelayMs = delayMs;
		totalDelayMs += delayMs;
	}
}
function isRetryableRenameError(error) {
	return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" && RETRYABLE_RENAME_ERROR_CODES.has(error.code);
}
function nextRenameRetryDelay(previousDelayMs, totalDelayMs) {
	const maximumDelayMs = Math.min(previousDelayMs * 3, RENAME_RETRY_MAX_DELAY_MS);
	const randomizedDelayMs = RENAME_RETRY_INITIAL_DELAY_MS + Math.floor(Math.random() * (maximumDelayMs - RENAME_RETRY_INITIAL_DELAY_MS + 1));
	return Math.min(randomizedDelayMs, RENAME_RETRY_TOTAL_DELAY_MS - totalDelayMs);
}
function sleep(delayMs) {
	return new Promise((resolve) => setTimeout(resolve, delayMs));
}
function sleepSync(delayMs) {
	try {
		Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
	} catch {
		const end = Date.now() + delayMs;
		while (Date.now() < end);
	}
}
async function syncDirectory(directory) {
	let handle;
	try {
		handle = await node_fs.default.promises.open(directory, "r");
		await handle.sync();
	} catch {} finally {
		await handle?.close().catch(() => void 0);
	}
}
function syncDirectorySync(directory) {
	let descriptor;
	try {
		descriptor = node_fs.default.openSync(directory, "r");
		node_fs.default.fsyncSync(descriptor);
	} catch {} finally {
		if (descriptor !== void 0) node_fs.default.closeSync(descriptor);
	}
}
function reportFailure(target, error, reporter) {
	const now = Date.now();
	if (now - (lastWarnings.get(target) ?? 0) < WARNING_INTERVAL_MS) return;
	lastWarnings.set(target, now);
	try {
		reporter?.(error);
	} catch {}
}
function isNodeError$1(error, code) {
	return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
//#endregion
//#region ../../packages/core/src/node/credential-protection/models-json-storage.ts
/**
* models.json 的通用文件读写封装。
*
* 注意：当前实现**不**对任何字段做加密，仅保留文件锁与原子写能力。
*/
var ModelsJsonStorage = class {
	constructor(options) {
		this.options = options;
	}
	async read() {
		try {
			const content = await node_fs.default.promises.readFile(this.options.filePath, "utf8");
			return JSON.parse(content);
		} catch (error) {
			if (isNodeError(error, "ENOENT")) return;
			this.options.logger?.warn?.(`[ModelsJsonStorage] failed to read ${this.options.filePath}: ${String(error)}`);
			throw error;
		}
	}
	async update(mutator) {
		const action = async () => {
			const next = await mutator(await this.read());
			if (next === void 0) return;
			await writeCredentialFileAtomically(this.options.filePath, Buffer.from(JSON.stringify(next, null, 2), "utf8"));
			return next;
		};
		try {
			return await (this.options.scope === "user" ? withCredentialFileLock(this.options.filePath, action) : action());
		} catch (error) {
			this.options.logger?.warn?.(`[ModelsJsonStorage] failed to update ${this.options.filePath}: ${String(error)}`);
			throw error;
		}
	}
	async write(value) {
		await this.update(() => value);
	}
};
function isNodeError(error, code) {
	return error instanceof Error && "code" in error && error.code === code;
}
//#endregion
//#region ../../packages/core/src/node/credential-protection/policies.ts
var AUTH_CREDENTIAL_FIELDS = [
	{ path: ["auth", "accessToken"] },
	{ path: ["auth", "refreshToken"] },
	{ path: ["account", "phoneNumber"] },
	{ path: ["account", "departmentFullName"] },
	{ path: ["account", "nickname"] },
	{ path: [
		"accounts",
		"*",
		"phoneNumber"
	] },
	{ path: [
		"accounts",
		"*",
		"nickname"
	] },
	{ path: [
		"allAccounts",
		"*",
		"phoneNumber"
	] },
	{ path: [
		"allAccounts",
		"*",
		"nickname"
	] }
];
var USER_SETTINGS_CREDENTIAL_FIELDS = [
	{ path: ["env", "CODEBUDDY_API_KEY"] },
	{ path: ["env", "CODEBUDDY_AUTH_TOKEN"] },
	{ path: ["gateway", "password"] },
	{ path: ["automation.wecomWebhookUrl"] },
	{ path: ["automation.wecomPushConfig", "webhookUrl"] },
	{ path: ["automation.wecomPushConfig", "botSecret"] }
];
var CHANNEL_CREDENTIAL_KEYS = {
	feishu: [
		"appId",
		"appSecret",
		"encryptKey",
		"verificationToken",
		"secret"
	],
	wecomaibot: [
		"botSecret",
		"token",
		"encodingAESKey"
	],
	qq: ["appId", "appSecret"],
	dingtalk: [
		"appKey",
		"appSecret",
		"token",
		"aesKey"
	],
	yuanbao: ["appSecret"],
	wecomIOA: ["webhookUrl"],
	wechatkf: ["webhookUrl"],
	wecomNew: [
		"webhookUrl",
		"token",
		"encodingAESKey",
		"corpId",
		"corpSecret",
		"agentId"
	],
	custom: ["webhookUrl"],
	weixinClawBot: ["botToken"],
	slack: ["botToken", "appToken"],
	discord: ["token"],
	wechatmp: ["webhookUrl", "appSecret"],
	telegram: ["token"]
};
function isObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function getUserSettingsCredentialFields(document) {
	const specs = USER_SETTINGS_CREDENTIAL_FIELDS.map((spec) => ({ path: [...spec.path] }));
	if (!isObject(document) || !isObject(document.claw)) return specs;
	appendChannelSpecs(specs, document.claw.channels, ["claw", "channels"]);
	if (isObject(document.claw.users)) {
		for (const [userId, user] of Object.entries(document.claw.users)) if (isObject(user)) appendChannelSpecs(specs, user.channels, [
			"claw",
			"users",
			userId,
			"channels"
		]);
	}
	return specs;
}
function appendChannelSpecs(specs, value, basePath) {
	if (!isObject(value)) return;
	for (const channel of Object.keys(value)) {
		specs.push({ path: [
			...basePath,
			channel,
			"registration",
			"webhookUrl"
		] });
		specs.push({ path: [
			...basePath,
			channel,
			"channelId"
		] });
		for (const key of CHANNEL_CREDENTIAL_KEYS[channel] ?? []) specs.push({ path: [
			...basePath,
			channel,
			key
		] });
	}
}
//#endregion
//#region ../../packages/core/src/node/credential-protection/user-settings-codec.ts
function createUserSettingsCredentialCodec(onUnavailable) {
	const codec = createCredentialFieldCodec({
		purpose: "workbuddy-user-settings",
		resourceId: "settings/user",
		onUnavailable
	});
	return {
		decode: (input) => codec.decode(input, getUserSettingsCredentialFields(input)),
		encode: (input) => codec.encode(input, getUserSettingsCredentialFields(input)),
		dispose: () => codec.dispose()
	};
}
//#endregion
Object.defineProperty(exports, "AUTH_CREDENTIAL_FIELDS", {
	enumerable: true,
	get: function() {
		return AUTH_CREDENTIAL_FIELDS;
	}
});
Object.defineProperty(exports, "CredentialProtectionFailureReporter", {
	enumerable: true,
	get: function() {
		return CredentialProtectionFailureReporter;
	}
});
Object.defineProperty(exports, "ModelsJsonStorage", {
	enumerable: true,
	get: function() {
		return ModelsJsonStorage;
	}
});
Object.defineProperty(exports, "configureCredentialProtection", {
	enumerable: true,
	get: function() {
		return configureCredentialProtection;
	}
});
Object.defineProperty(exports, "createCredentialFieldCodec", {
	enumerable: true,
	get: function() {
		return createCredentialFieldCodec;
	}
});
Object.defineProperty(exports, "createUserSettingsCredentialCodec", {
	enumerable: true,
	get: function() {
		return createUserSettingsCredentialCodec;
	}
});
Object.defineProperty(exports, "disposeCredentialProtection", {
	enumerable: true,
	get: function() {
		return disposeCredentialProtection;
	}
});
Object.defineProperty(exports, "scheduleCredentialFileMigration", {
	enumerable: true,
	get: function() {
		return scheduleCredentialFileMigration;
	}
});
Object.defineProperty(exports, "setCredentialProtectionPending", {
	enumerable: true,
	get: function() {
		return setCredentialProtectionPending;
	}
});
Object.defineProperty(exports, "withCredentialFileLock", {
	enumerable: true,
	get: function() {
		return withCredentialFileLock;
	}
});
Object.defineProperty(exports, "writeCredentialFileAtomically", {
	enumerable: true,
	get: function() {
		return writeCredentialFileAtomically;
	}
});
Object.defineProperty(exports, "writeCredentialFileAtomicallySync", {
	enumerable: true,
	get: function() {
		return writeCredentialFileAtomicallySync;
	}
});
