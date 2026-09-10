var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../../node_modules/.pnpm/@tencent+tencent-docs-ai-en_afd80b6f2f2936220f49bf4ebb2d0283/node_modules/@tencent/tencent-docs-ai-engine/lib/common/document-types.js
var require_document_types = __commonJS({
  "../../node_modules/.pnpm/@tencent+tencent-docs-ai-en_afd80b6f2f2936220f49bf4ebb2d0283/node_modules/@tencent/tencent-docs-ai-engine/lib/common/document-types.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.TENCENT_DOCS_ENGINE_SUPPORTED_EXTENSIONS = exports2.TENCENT_DOCS_ENGINE_FILE_TYPES = void 0;
    exports2.getTencentDocsEngineDocType = getTencentDocsEngineDocType;
    exports2.getTencentDocsSelectionFileType = getTencentDocsSelectionFileType;
    exports2.isTencentDocsEngineSupportedExtension = isTencentDocsEngineSupportedExtension;
    exports2.isTencentDocsEngineDocType = isTencentDocsEngineDocType2;
    exports2.TENCENT_DOCS_ENGINE_FILE_TYPES = Object.freeze([
      Object.freeze({
        engineType: "doc",
        selectionFileType: "word",
        extensions: Object.freeze([
          ".doc",
          ".docx",
          ".dot",
          ".dotx",
          ".wps",
          ".wpt",
          ".docm",
          ".dotm"
        ])
      }),
      Object.freeze({
        engineType: "sheet",
        selectionFileType: "excel",
        extensions: Object.freeze([".csv", ".xls", ".xlsx", ".xlt", ".xltx", ".xlsm", ".xltm"])
      }),
      Object.freeze({
        engineType: "slide",
        selectionFileType: "ppt",
        extensions: Object.freeze([
          ".pptx",
          ".ppt",
          ".pps",
          ".pot",
          ".pptm",
          ".ppsx",
          ".ppsm",
          ".potx",
          ".potm"
        ])
      }),
      Object.freeze({
        engineType: "pdf",
        selectionFileType: "pdf",
        extensions: Object.freeze([".pdf"])
      })
    ]);
    exports2.TENCENT_DOCS_ENGINE_SUPPORTED_EXTENSIONS = Object.freeze(exports2.TENCENT_DOCS_ENGINE_FILE_TYPES.flatMap((item) => item.extensions));
    var engineDocTypeSet = new Set(exports2.TENCENT_DOCS_ENGINE_FILE_TYPES.map((item) => item.engineType));
    var extensionToFileType = /* @__PURE__ */ new Map();
    for (const item of exports2.TENCENT_DOCS_ENGINE_FILE_TYPES) {
      for (const ext of item.extensions) {
        extensionToFileType.set(ext, item);
      }
    }
    function normalizeTencentDocsFileExtension(value) {
      const trimmed = value.trim();
      if (!trimmed) {
        return "";
      }
      if (!/[\\/]/.test(trimmed) && !trimmed.includes(".")) {
        const bare = trimmed.split(/[?#]/, 1)[0] ?? "";
        return bare ? `.${bare.toLowerCase()}` : "";
      }
      const slashIndex = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
      const fileName = trimmed.slice(slashIndex + 1);
      const dotIndex = fileName.lastIndexOf(".");
      if (dotIndex < 0 || dotIndex === fileName.length - 1) {
        return "";
      }
      const extToken = fileName.slice(dotIndex + 1).split(/[?#]/, 1)[0] ?? "";
      return extToken ? `.${extToken.toLowerCase()}` : "";
    }
    function getTencentDocsEngineFileType(value) {
      return extensionToFileType.get(normalizeTencentDocsFileExtension(value));
    }
    function getTencentDocsEngineDocType(value) {
      return getTencentDocsEngineFileType(value)?.engineType;
    }
    function getTencentDocsSelectionFileType(value) {
      return getTencentDocsEngineFileType(value)?.selectionFileType;
    }
    function isTencentDocsEngineSupportedExtension(value) {
      return Boolean(getTencentDocsEngineFileType(value));
    }
    function isTencentDocsEngineDocType2(value) {
      return Boolean(value && engineDocTypeSet.has(value));
    }
  }
});

// ../../node_modules/.pnpm/electron-log@5.4.3/node_modules/electron-log/src/core/scope.js
var require_scope = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.4.3/node_modules/electron-log/src/core/scope.js"(exports2, module2) {
    "use strict";
    module2.exports = scopeFactory;
    function scopeFactory(logger) {
      return Object.defineProperties(scope, {
        defaultLabel: { value: "", writable: true },
        labelPadding: { value: true, writable: true },
        maxLabelLength: { value: 0, writable: true },
        labelLength: {
          get() {
            switch (typeof scope.labelPadding) {
              case "boolean":
                return scope.labelPadding ? scope.maxLabelLength : 0;
              case "number":
                return scope.labelPadding;
              default:
                return 0;
            }
          }
        }
      });
      function scope(label) {
        scope.maxLabelLength = Math.max(scope.maxLabelLength, label.length);
        const newScope = {};
        for (const level of logger.levels) {
          newScope[level] = (...d) => logger.logData(d, { level, scope: label });
        }
        newScope.log = newScope.info;
        return newScope;
      }
    }
  }
});

// ../../node_modules/.pnpm/electron-log@5.4.3/node_modules/electron-log/src/core/Buffering.js
var require_Buffering = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.4.3/node_modules/electron-log/src/core/Buffering.js"(exports2, module2) {
    "use strict";
    var Buffering = class {
      constructor({ processMessage }) {
        this.processMessage = processMessage;
        this.buffer = [];
        this.enabled = false;
        this.begin = this.begin.bind(this);
        this.commit = this.commit.bind(this);
        this.reject = this.reject.bind(this);
      }
      addMessage(message) {
        this.buffer.push(message);
      }
      begin() {
        this.enabled = [];
      }
      commit() {
        this.enabled = false;
        this.buffer.forEach((item) => this.processMessage(item));
        this.buffer = [];
      }
      reject() {
        this.enabled = false;
        this.buffer = [];
      }
    };
    module2.exports = Buffering;
  }
});

// ../../node_modules/.pnpm/electron-log@5.4.3/node_modules/electron-log/src/core/Logger.js
var require_Logger = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.4.3/node_modules/electron-log/src/core/Logger.js"(exports2, module2) {
    "use strict";
    var scopeFactory = require_scope();
    var Buffering = require_Buffering();
    var Logger = class _Logger {
      static instances = {};
      dependencies = {};
      errorHandler = null;
      eventLogger = null;
      functions = {};
      hooks = [];
      isDev = false;
      levels = null;
      logId = null;
      scope = null;
      transports = {};
      variables = {};
      constructor({
        allowUnknownLevel = false,
        dependencies = {},
        errorHandler,
        eventLogger,
        initializeFn,
        isDev = false,
        levels = ["error", "warn", "info", "verbose", "debug", "silly"],
        logId,
        transportFactories = {},
        variables
      } = {}) {
        this.addLevel = this.addLevel.bind(this);
        this.create = this.create.bind(this);
        this.initialize = this.initialize.bind(this);
        this.logData = this.logData.bind(this);
        this.processMessage = this.processMessage.bind(this);
        this.allowUnknownLevel = allowUnknownLevel;
        this.buffering = new Buffering(this);
        this.dependencies = dependencies;
        this.initializeFn = initializeFn;
        this.isDev = isDev;
        this.levels = levels;
        this.logId = logId;
        this.scope = scopeFactory(this);
        this.transportFactories = transportFactories;
        this.variables = variables || {};
        for (const name of this.levels) {
          this.addLevel(name, false);
        }
        this.log = this.info;
        this.functions.log = this.log;
        this.errorHandler = errorHandler;
        errorHandler?.setOptions({ ...dependencies, logFn: this.error });
        this.eventLogger = eventLogger;
        eventLogger?.setOptions({ ...dependencies, logger: this });
        for (const [name, factory] of Object.entries(transportFactories)) {
          this.transports[name] = factory(this, dependencies);
        }
        _Logger.instances[logId] = this;
      }
      static getInstance({ logId }) {
        return this.instances[logId] || this.instances.default;
      }
      addLevel(level, index = this.levels.length) {
        if (index !== false) {
          this.levels.splice(index, 0, level);
        }
        this[level] = (...args) => this.logData(args, { level });
        this.functions[level] = this[level];
      }
      catchErrors(options) {
        this.processMessage(
          {
            data: ["log.catchErrors is deprecated. Use log.errorHandler instead"],
            level: "warn"
          },
          { transports: ["console"] }
        );
        return this.errorHandler.startCatching(options);
      }
      create(options) {
        if (typeof options === "string") {
          options = { logId: options };
        }
        return new _Logger({
          dependencies: this.dependencies,
          errorHandler: this.errorHandler,
          initializeFn: this.initializeFn,
          isDev: this.isDev,
          transportFactories: this.transportFactories,
          variables: { ...this.variables },
          ...options
        });
      }
      compareLevels(passLevel, checkLevel, levels = this.levels) {
        const pass = levels.indexOf(passLevel);
        const check = levels.indexOf(checkLevel);
        if (check === -1 || pass === -1) {
          return true;
        }
        return check <= pass;
      }
      initialize(options = {}) {
        this.initializeFn({ logger: this, ...this.dependencies, ...options });
      }
      logData(data, options = {}) {
        if (this.buffering.enabled) {
          this.buffering.addMessage({ data, date: /* @__PURE__ */ new Date(), ...options });
        } else {
          this.processMessage({ data, ...options });
        }
      }
      processMessage(message, { transports = this.transports } = {}) {
        if (message.cmd === "errorHandler") {
          this.errorHandler.handle(message.error, {
            errorName: message.errorName,
            processType: "renderer",
            showDialog: Boolean(message.showDialog)
          });
          return;
        }
        let level = message.level;
        if (!this.allowUnknownLevel) {
          level = this.levels.includes(message.level) ? message.level : "info";
        }
        const normalizedMessage = {
          date: /* @__PURE__ */ new Date(),
          logId: this.logId,
          ...message,
          level,
          variables: {
            ...this.variables,
            ...message.variables
          }
        };
        for (const [transName, transFn] of this.transportEntries(transports)) {
          if (typeof transFn !== "function" || transFn.level === false) {
            continue;
          }
          if (!this.compareLevels(transFn.level, message.level)) {
            continue;
          }
          try {
            const transformedMsg = this.hooks.reduce((msg, hook) => {
              return msg ? hook(msg, transFn, transName) : msg;
            }, normalizedMessage);
            if (transformedMsg) {
              transFn({ ...transformedMsg, data: [...transformedMsg.data] });
            }
          } catch (e) {
            this.processInternalErrorFn(e);
          }
        }
      }
      processInternalErrorFn(_e) {
      }
      transportEntries(transports = this.transports) {
        const transportArray = Array.isArray(transports) ? transports : Object.entries(transports);
        return transportArray.map((item) => {
          switch (typeof item) {
            case "string":
              return this.transports[item] ? [item, this.transports[item]] : null;
            case "function":
              return [item.name, item];
            default:
              return Array.isArray(item) ? item : null;
          }
        }).filter(Boolean);
      }
    };
    module2.exports = Logger;
  }
});

// ../../node_modules/.pnpm/electron-log@5.4.3/node_modules/electron-log/src/renderer/lib/RendererErrorHandler.js
var require_RendererErrorHandler = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.4.3/node_modules/electron-log/src/renderer/lib/RendererErrorHandler.js"(exports2, module2) {
    "use strict";
    var consoleError = console.error;
    var RendererErrorHandler = class {
      logFn = null;
      onError = null;
      showDialog = false;
      preventDefault = true;
      constructor({ logFn = null } = {}) {
        this.handleError = this.handleError.bind(this);
        this.handleRejection = this.handleRejection.bind(this);
        this.startCatching = this.startCatching.bind(this);
        this.logFn = logFn;
      }
      handle(error, {
        logFn = this.logFn,
        errorName = "",
        onError = this.onError,
        showDialog = this.showDialog
      } = {}) {
        try {
          if (onError?.({ error, errorName, processType: "renderer" }) !== false) {
            logFn({ error, errorName, showDialog });
          }
        } catch {
          consoleError(error);
        }
      }
      setOptions({ logFn, onError, preventDefault, showDialog }) {
        if (typeof logFn === "function") {
          this.logFn = logFn;
        }
        if (typeof onError === "function") {
          this.onError = onError;
        }
        if (typeof preventDefault === "boolean") {
          this.preventDefault = preventDefault;
        }
        if (typeof showDialog === "boolean") {
          this.showDialog = showDialog;
        }
      }
      startCatching({ onError, showDialog } = {}) {
        if (this.isActive) {
          return;
        }
        this.isActive = true;
        this.setOptions({ onError, showDialog });
        window.addEventListener("error", (event) => {
          this.preventDefault && event.preventDefault?.();
          this.handleError(event.error || event);
        });
        window.addEventListener("unhandledrejection", (event) => {
          this.preventDefault && event.preventDefault?.();
          this.handleRejection(event.reason || event);
        });
      }
      handleError(error) {
        this.handle(error, { errorName: "Unhandled" });
      }
      handleRejection(reason) {
        const error = reason instanceof Error ? reason : new Error(JSON.stringify(reason));
        this.handle(error, { errorName: "Unhandled rejection" });
      }
    };
    module2.exports = RendererErrorHandler;
  }
});

// ../../node_modules/.pnpm/electron-log@5.4.3/node_modules/electron-log/src/core/transforms/transform.js
var require_transform = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.4.3/node_modules/electron-log/src/core/transforms/transform.js"(exports2, module2) {
    "use strict";
    module2.exports = { transform };
    function transform({
      logger,
      message,
      transport,
      initialData = message?.data || [],
      transforms = transport?.transforms
    }) {
      return transforms.reduce((data, trans) => {
        if (typeof trans === "function") {
          return trans({ data, logger, message, transport });
        }
        return data;
      }, initialData);
    }
  }
});

// ../../node_modules/.pnpm/electron-log@5.4.3/node_modules/electron-log/src/renderer/lib/transports/console.js
var require_console = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.4.3/node_modules/electron-log/src/renderer/lib/transports/console.js"(exports2, module2) {
    "use strict";
    var { transform } = require_transform();
    module2.exports = consoleTransportRendererFactory;
    var consoleMethods = {
      error: console.error,
      warn: console.warn,
      info: console.info,
      verbose: console.info,
      debug: console.debug,
      silly: console.debug,
      log: console.log
    };
    function consoleTransportRendererFactory(logger) {
      return Object.assign(transport, {
        format: "{h}:{i}:{s}.{ms}{scope} \u203A {text}",
        transforms: [formatDataFn],
        writeFn({ message: { level, data } }) {
          const consoleLogFn = consoleMethods[level] || consoleMethods.info;
          setTimeout(() => consoleLogFn(...data));
        }
      });
      function transport(message) {
        transport.writeFn({
          message: { ...message, data: transform({ logger, message, transport }) }
        });
      }
    }
    function formatDataFn({
      data = [],
      logger = {},
      message = {},
      transport = {}
    }) {
      if (typeof transport.format === "function") {
        return transport.format({
          data,
          level: message?.level || "info",
          logger,
          message,
          transport
        });
      }
      if (typeof transport.format !== "string") {
        return data;
      }
      data.unshift(transport.format);
      if (typeof data[1] === "string" && data[1].match(/%[1cdfiOos]/)) {
        data = [`${data[0]}${data[1]}`, ...data.slice(2)];
      }
      const date = message.date || /* @__PURE__ */ new Date();
      data[0] = data[0].replace(/\{(\w+)}/g, (substring, name) => {
        switch (name) {
          case "level":
            return message.level;
          case "logId":
            return message.logId;
          case "scope": {
            const scope = message.scope || logger.scope?.defaultLabel;
            return scope ? ` (${scope})` : "";
          }
          case "text":
            return "";
          case "y":
            return date.getFullYear().toString(10);
          case "m":
            return (date.getMonth() + 1).toString(10).padStart(2, "0");
          case "d":
            return date.getDate().toString(10).padStart(2, "0");
          case "h":
            return date.getHours().toString(10).padStart(2, "0");
          case "i":
            return date.getMinutes().toString(10).padStart(2, "0");
          case "s":
            return date.getSeconds().toString(10).padStart(2, "0");
          case "ms":
            return date.getMilliseconds().toString(10).padStart(3, "0");
          case "iso":
            return date.toISOString();
          default:
            return message.variables?.[name] || substring;
        }
      }).trim();
      return data;
    }
  }
});

// ../../node_modules/.pnpm/electron-log@5.4.3/node_modules/electron-log/src/renderer/lib/transports/ipc.js
var require_ipc = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.4.3/node_modules/electron-log/src/renderer/lib/transports/ipc.js"(exports2, module2) {
    "use strict";
    var { transform } = require_transform();
    module2.exports = ipcTransportRendererFactory;
    var RESTRICTED_TYPES = /* @__PURE__ */ new Set([Promise, WeakMap, WeakSet]);
    function ipcTransportRendererFactory(logger) {
      return Object.assign(transport, {
        depth: 5,
        transforms: [serializeFn]
      });
      function transport(message) {
        if (!window.__electronLog) {
          logger.processMessage(
            {
              data: ["electron-log: logger isn't initialized in the main process"],
              level: "error"
            },
            { transports: ["console"] }
          );
          return;
        }
        try {
          const serialized = transform({
            initialData: message,
            logger,
            message,
            transport
          });
          __electronLog.sendToMain(serialized);
        } catch (e) {
          logger.transports.console({
            data: ["electronLog.transports.ipc", e, "data:", message.data],
            level: "error"
          });
        }
      }
    }
    function isPrimitive(value) {
      return Object(value) !== value;
    }
    function serializeFn({
      data,
      depth,
      seen = /* @__PURE__ */ new WeakSet(),
      transport = {}
    } = {}) {
      const actualDepth = depth || transport.depth || 5;
      if (seen.has(data)) {
        return "[Circular]";
      }
      if (actualDepth < 1) {
        if (isPrimitive(data)) {
          return data;
        }
        if (Array.isArray(data)) {
          return "[Array]";
        }
        return `[${typeof data}]`;
      }
      if (["function", "symbol"].includes(typeof data)) {
        return data.toString();
      }
      if (isPrimitive(data)) {
        return data;
      }
      if (RESTRICTED_TYPES.has(data.constructor)) {
        return `[${data.constructor.name}]`;
      }
      if (Array.isArray(data)) {
        return data.map((item) => serializeFn({
          data: item,
          depth: actualDepth - 1,
          seen
        }));
      }
      if (data instanceof Date) {
        return data.toISOString();
      }
      if (data instanceof Error) {
        return data.stack;
      }
      if (data instanceof Map) {
        return new Map(
          Array.from(data).map(([key, value]) => [
            serializeFn({ data: key, depth: actualDepth - 1, seen }),
            serializeFn({ data: value, depth: actualDepth - 1, seen })
          ])
        );
      }
      if (data instanceof Set) {
        return new Set(
          Array.from(data).map(
            (val) => serializeFn({ data: val, depth: actualDepth - 1, seen })
          )
        );
      }
      seen.add(data);
      return Object.fromEntries(
        Object.entries(data).map(
          ([key, value]) => [
            key,
            serializeFn({ data: value, depth: actualDepth - 1, seen })
          ]
        )
      );
    }
  }
});

// ../../node_modules/.pnpm/electron-log@5.4.3/node_modules/electron-log/src/renderer/index.js
var require_renderer = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.4.3/node_modules/electron-log/src/renderer/index.js"(exports2, module2) {
    "use strict";
    var Logger = require_Logger();
    var RendererErrorHandler = require_RendererErrorHandler();
    var transportConsole = require_console();
    var transportIpc = require_ipc();
    if (typeof process === "object" && process.type === "browser") {
      console.warn(
        "electron-log/renderer is loaded in the main process. It could cause unexpected behaviour."
      );
    }
    module2.exports = createLogger();
    module2.exports.Logger = Logger;
    module2.exports.default = module2.exports;
    function createLogger() {
      const logger = new Logger({
        allowUnknownLevel: true,
        errorHandler: new RendererErrorHandler(),
        initializeFn: () => {
        },
        logId: "default",
        transportFactories: {
          console: transportConsole,
          ipc: transportIpc
        },
        variables: {
          processType: "renderer"
        }
      });
      logger.errorHandler.setOptions({
        logFn({ error, errorName, showDialog }) {
          logger.transports.console({
            data: [errorName, error].filter(Boolean),
            level: "error"
          });
          logger.transports.ipc({
            cmd: "errorHandler",
            error: {
              cause: error?.cause,
              code: error?.code,
              name: error?.name,
              message: error?.message,
              stack: error?.stack
            },
            errorName,
            logId: logger.logId,
            showDialog
          });
        }
      });
      if (typeof window === "object") {
        window.addEventListener("message", (event) => {
          const { cmd, logId, ...message } = event.data || {};
          const instance = Logger.getInstance({ logId });
          if (cmd === "message") {
            instance.processMessage(message, { transports: ["console"] });
          }
        });
      }
      return new Proxy(logger, {
        get(target, prop) {
          if (typeof target[prop] !== "undefined") {
            return target[prop];
          }
          return (...data) => logger.logData(data, { level: prop });
        }
      });
    }
  }
});

// ../../node_modules/.pnpm/electron-log@5.4.3/node_modules/electron-log/renderer.js
var require_renderer2 = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.4.3/node_modules/electron-log/renderer.js"(exports2, module2) {
    "use strict";
    var renderer = require_renderer();
    module2.exports = renderer;
  }
});

// ../../packages/workbuddy-server/src/docs-shared/feature-list.ts
function getFeatureValue(options) {
  const inConversation = Boolean(options?.inConversation);
  const aiEditEnabled = options?.aiEditEnabled !== false;
  return { aiEdit: inConversation && aiEditEnabled };
}
function getDocsFeatureListString(options) {
  return JSON.stringify(getFeatureValue(options));
}
var WORKBUDDY_DOCS_FEATURE_LIST_RESOLVE_CHANNEL = "workbuddy:tencentDocs:resolveFeatureList";

// ../../packages/workbuddy-server/src/docs-shared/mqq/bridge.ts
var WORKBUDDY_MQQ_BRIDGE_CHANNEL = "workbuddy:mqqBridge";
var WORKBUDDY_MQQ_ACCESS_PROBE_API = "workbuddy.accessProbe";

// ../../packages/workbuddy-server/src/docs-shared/url-guards.ts
var import_document_types = __toESM(require_document_types());

// ../../packages/workbuddy-server/src/tencent-docs/webview-download.ts
var WORKBUDDY_TENCENT_DOCS_WEBVIEW_DOWNLOAD_CHANNEL = "workbuddy:tencentDocs:webviewDownload";
var MAIN_WORLD_DOWNLOAD_TRIGGER_KEY = "__tencentDocsWebviewDownload";
function isExclusiveExportHost(hostname) {
  const idx = hostname.indexOf("-docs.");
  if (idx <= 0) {
    return false;
  }
  const subdomain = hostname.slice(0, idx);
  return subdomain.includes("export");
}
function isTencentDocsDownloadHref(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return false;
    }
    const hostname = parsed.hostname;
    if (hostname === "export.docs.qq.com" || hostname.endsWith(".export.docs.qq.com")) {
      return true;
    }
    if (isExclusiveExportHost(hostname)) {
      return true;
    }
    const disposition = parsed.searchParams.get("response-content-disposition") ?? "";
    return disposition.toLowerCase().includes("attachment");
  } catch {
    return false;
  }
}

// ../../packages/workbuddy-server/src/docs-shared/url-guards.ts
function isTencentDocsUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && (parsed.hostname === "docs.qq.com" || parsed.hostname.endsWith(".docs.qq.com"));
  } catch {
    return false;
  }
}
function isLocalTencentDocsEnginePreviewUrl(url) {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    return parsed.protocol === "http:" && (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") && segments.length === 3 && segments[0] === "static" && (0, import_document_types.isTencentDocsEngineDocType)(segments[1]) && segments[2] === "pc.html";
  } catch {
    return false;
  }
}
var CLOUD_SANDBOX_EDITOR_SDK_PORT = 39099;
var CLOUD_SANDBOX_DOC_TYPES = /* @__PURE__ */ new Set(["doc", "sheet", "slide"]);
function parseCloudSandboxEditorSdkCandidateUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") {
    return null;
  }
  if (parsed.username || parsed.password) {
    return null;
  }
  if (!/^[a-z0-9.-]+$/.test(parsed.hostname) || parsed.hostname.includes("xn--")) {
    return null;
  }
  const segments = parsed.pathname.split("/").filter(Boolean);
  const docType = segments[1];
  if (segments.length !== 3 || segments[0] !== "static" || !docType || !CLOUD_SANDBOX_DOC_TYPES.has(docType) || segments[2] !== "pc.html") {
    return null;
  }
  const hostPrefix = parsed.hostname.split(".")[0] ?? "";
  const expectedPortPrefix = `${CLOUD_SANDBOX_EDITOR_SDK_PORT}-`;
  if (!hostPrefix.startsWith(expectedPortPrefix)) {
    return null;
  }
  const sandboxId = hostPrefix.slice(expectedPortPrefix.length);
  if (!sandboxId) {
    return null;
  }
  return { sandboxId, docType, origin: parsed.origin };
}
function isCloudSandboxEditorSdkCandidateUrl(url) {
  return parseCloudSandboxEditorSdkCandidateUrl(url) !== null;
}
function isTencentDocsClipboardOrigin(originOrUrl, localEngineOrigin) {
  if (!originOrUrl) {
    return false;
  }
  if (isTencentDocsUrl(originOrUrl)) {
    return true;
  }
  if (!localEngineOrigin) {
    return false;
  }
  try {
    return new URL(originOrUrl).origin === new URL(localEngineOrigin).origin;
  } catch {
    return false;
  }
}

// ../../packages/workbuddy-server/src/docs-shared/mqq/guest-telemetry.ts
var WORKBUDDY_REPORT_TELEMETRY_API = "workbuddy.reportTelemetry";

// ../../packages/workbuddy-server/src/docs-shared/mqq/protocol.ts
var DOCX_ON_SELECTION_CHANGE_API = "docx.onSelectionChange";
var DOCX_ON_SELECTION_SEND_API = "docx.onSelectionSend";
var DOCX_ON_DOCUMENT_STATUS_CHANGED_API = "docx.onDocumentStatusChanged";
var DOCUMENT_FRAME_WILL_APPEAR_EVENT = "documentFrameWillAppear";
var DOCUMENT_FRAME_WILL_DISAPPEAR_EVENT = "documentFrameWillDisappear";
var DOCUMENT_FRAME_WILL_CLOSE_EVENT = "documentFrameWillClose";
var DOCUMENT_FRAME_CLOSE_EVENT = "documentFrameClose";
var DOCUMENT_FRAME_WILL_REMOVE_EVENT = "documentFrameWillRemove";
var DOCUMENT_FRAME_REMOVED_EVENT = "documentFrameRemoved";
function buildMqqSubscriberSubscribeApi(eventName) {
  return `subscriber.subscribe#${eventName}`;
}
function buildMqqSubscriberUnsubscribeApi(eventName) {
  return `subscriber.unsubscribe#${eventName}`;
}
var DOCUMENT_FRAME_WILL_APPEAR_SUBSCRIBE_API = buildMqqSubscriberSubscribeApi(
  DOCUMENT_FRAME_WILL_APPEAR_EVENT
);
var DOCUMENT_FRAME_WILL_APPEAR_UNSUBSCRIBE_API = buildMqqSubscriberUnsubscribeApi(
  DOCUMENT_FRAME_WILL_APPEAR_EVENT
);
var DOCUMENT_FRAME_WILL_DISAPPEAR_SUBSCRIBE_API = buildMqqSubscriberSubscribeApi(
  DOCUMENT_FRAME_WILL_DISAPPEAR_EVENT
);
var DOCUMENT_FRAME_WILL_DISAPPEAR_UNSUBSCRIBE_API = buildMqqSubscriberUnsubscribeApi(
  DOCUMENT_FRAME_WILL_DISAPPEAR_EVENT
);
var DOCUMENT_FRAME_WILL_CLOSE_SUBSCRIBE_API = buildMqqSubscriberSubscribeApi(
  DOCUMENT_FRAME_WILL_CLOSE_EVENT
);
var DOCUMENT_FRAME_WILL_CLOSE_UNSUBSCRIBE_API = buildMqqSubscriberUnsubscribeApi(
  DOCUMENT_FRAME_WILL_CLOSE_EVENT
);
var DOCUMENT_FRAME_CLOSE_SUBSCRIBE_API = buildMqqSubscriberSubscribeApi(
  DOCUMENT_FRAME_CLOSE_EVENT
);
var DOCUMENT_FRAME_CLOSE_UNSUBSCRIBE_API = buildMqqSubscriberUnsubscribeApi(
  DOCUMENT_FRAME_CLOSE_EVENT
);
var DOCUMENT_FRAME_WILL_REMOVE_SUBSCRIBE_API = buildMqqSubscriberSubscribeApi(
  DOCUMENT_FRAME_WILL_REMOVE_EVENT
);
var DOCUMENT_FRAME_WILL_REMOVE_UNSUBSCRIBE_API = buildMqqSubscriberUnsubscribeApi(
  DOCUMENT_FRAME_WILL_REMOVE_EVENT
);
var DOCUMENT_FRAME_REMOVED_SUBSCRIBE_API = buildMqqSubscriberSubscribeApi(
  DOCUMENT_FRAME_REMOVED_EVENT
);
var DOCUMENT_FRAME_REMOVED_UNSUBSCRIBE_API = buildMqqSubscriberUnsubscribeApi(
  DOCUMENT_FRAME_REMOVED_EVENT
);
var TENCENT_DOCS_MQQ_API_PERMISSIONS = [
  // Guest 页统一埋点上报：与选区同档 C_LOCAL_EDIT，在线 docs.qq.com + 本地引擎均放行。
  { apiName: WORKBUDDY_REPORT_TELEMETRY_API, level: "C_LOCAL_EDIT" /* C_LOCAL_EDIT */ },
  { apiName: DOCX_ON_SELECTION_CHANGE_API, level: "C_LOCAL_EDIT" /* C_LOCAL_EDIT */ },
  { apiName: DOCX_ON_SELECTION_SEND_API, level: "C_LOCAL_EDIT" /* C_LOCAL_EDIT */ },
  { apiName: DOCX_ON_DOCUMENT_STATUS_CHANGED_API, level: "C_LOCAL_EDIT" /* C_LOCAL_EDIT */ },
  { apiName: DOCUMENT_FRAME_WILL_APPEAR_SUBSCRIBE_API, level: "C_LOCAL_EDIT" /* C_LOCAL_EDIT */ },
  { apiName: DOCUMENT_FRAME_WILL_APPEAR_UNSUBSCRIBE_API, level: "C_LOCAL_EDIT" /* C_LOCAL_EDIT */ },
  { apiName: DOCUMENT_FRAME_WILL_DISAPPEAR_SUBSCRIBE_API, level: "C_LOCAL_EDIT" /* C_LOCAL_EDIT */ },
  { apiName: DOCUMENT_FRAME_WILL_DISAPPEAR_UNSUBSCRIBE_API, level: "C_LOCAL_EDIT" /* C_LOCAL_EDIT */ },
  { apiName: DOCUMENT_FRAME_WILL_CLOSE_SUBSCRIBE_API, level: "C_LOCAL_EDIT" /* C_LOCAL_EDIT */ },
  { apiName: DOCUMENT_FRAME_WILL_CLOSE_UNSUBSCRIBE_API, level: "C_LOCAL_EDIT" /* C_LOCAL_EDIT */ },
  { apiName: DOCUMENT_FRAME_CLOSE_SUBSCRIBE_API, level: "C_LOCAL_EDIT" /* C_LOCAL_EDIT */ },
  { apiName: DOCUMENT_FRAME_CLOSE_UNSUBSCRIBE_API, level: "C_LOCAL_EDIT" /* C_LOCAL_EDIT */ },
  { apiName: DOCUMENT_FRAME_WILL_REMOVE_SUBSCRIBE_API, level: "C_LOCAL_EDIT" /* C_LOCAL_EDIT */ },
  { apiName: DOCUMENT_FRAME_WILL_REMOVE_UNSUBSCRIBE_API, level: "C_LOCAL_EDIT" /* C_LOCAL_EDIT */ },
  { apiName: DOCUMENT_FRAME_REMOVED_SUBSCRIBE_API, level: "C_LOCAL_EDIT" /* C_LOCAL_EDIT */ },
  { apiName: DOCUMENT_FRAME_REMOVED_UNSUBSCRIBE_API, level: "C_LOCAL_EDIT" /* C_LOCAL_EDIT */ }
];
var MQQ_API_NOT_IMPLEMENTED_MESSAGE = "mqq API is not implemented";
var MQQ_PERMISSION_DENIED_MESSAGE = "\u5F53\u524D\u9875\u9762\u65E0\u8BBF\u95EE\u6743\u9650";
function createUnhandledBridgeResponse(id) {
  return {
    id,
    errCode: -32601,
    ret: MQQ_API_NOT_IMPLEMENTED_MESSAGE,
    hasHandled: false
  };
}
var MQQ_INTERNAL_ERROR_CODE = -32603;
function toCallbackResult(response) {
  if (response.errCode !== 0 || !response.hasHandled) {
    return {
      code: response.errCode,
      err: typeof response.ret === "string" ? response.ret : MQQ_API_NOT_IMPLEMENTED_MESSAGE,
      hasHandled: response.hasHandled
    };
  }
  return {
    code: response.errCode,
    data: response.ret,
    hasHandled: response.hasHandled
  };
}
function toInternalErrorResult(error) {
  return {
    code: MQQ_INTERNAL_ERROR_CODE,
    err: error instanceof Error ? error.message : String(error),
    hasHandled: false
  };
}
function createPermissionDeniedResult() {
  return {
    code: MQQ_INTERNAL_ERROR_CODE,
    err: MQQ_PERMISSION_DENIED_MESSAGE,
    hasHandled: false
  };
}
function isPromiseLike(value) {
  return Boolean(value && typeof value === "object" && typeof value.then === "function");
}
function canAccessMqqLevel(pageUrl2, level, localEngineOrigin) {
  if (!pageUrl2) {
    return false;
  }
  switch (level) {
    case "C_DOCS" /* C_DOCS */:
      return isTencentDocsUrl(pageUrl2);
    case "C_LOCAL_EDIT" /* C_LOCAL_EDIT */:
      return isTencentDocsUrl(pageUrl2) || isLocalTencentDocsEnginePreviewUrl(pageUrl2) && isTencentDocsClipboardOrigin(pageUrl2, localEngineOrigin);
    case "C_SANDBOX_SELECTION" /* C_SANDBOX_SELECTION */:
      return isCloudSandboxEditorSdkCandidateUrl(pageUrl2);
    default:
      return false;
  }
}
function buildApiPermissionMap(apiPermissions) {
  return new Map((apiPermissions ?? []).map((permission) => [permission.apiName, permission.level]));
}
function checkMqqApiPermission(apiName, pageUrl2, localEngineOrigin, apiPermissionMap, requireRegisteredApiPermission) {
  const level = apiPermissionMap.get(apiName);
  if (!level) {
    if (requireRegisteredApiPermission) {
      return false;
    }
    return true;
  }
  if (level === "C_LOCAL_EDIT" /* C_LOCAL_EDIT */ && pageUrl2 && isLocalTencentDocsEnginePreviewUrl(pageUrl2)) {
    return true;
  }
  if (!canAccessMqqLevel(pageUrl2, level, localEngineOrigin)) {
    return false;
  }
  return true;
}
function shouldExposeMqqProtocol(url) {
  return isTencentDocsUrl(url) || isLocalTencentDocsEnginePreviewUrl(url);
}
var MqqSubscriberImpl = class {
  constructor(name, subscriberId, invokeBridge, eventHandlers) {
    this.name = name;
    this.subscriberId = subscriberId;
    this.invokeBridge = invokeBridge;
    this.eventHandlers = eventHandlers;
    this.callbackMap = /* @__PURE__ */ new Map();
    this.nextCallId = 0;
  }
  subscribe(callback) {
    if (this.callbackMap.size === 0) {
      this.invokeBridge(buildMqqSubscriberSubscribeApi(this.name), [{ subscriberId: this.subscriberId }]);
    }
    this.nextCallId += 1;
    this.callbackMap.set(this.nextCallId, callback);
    const handlers = this.eventHandlers.get(this.name) ?? [];
    handlers.push(callback);
    this.eventHandlers.set(this.name, handlers);
    return this.nextCallId;
  }
  unsubscribe(callId) {
    const callback = this.callbackMap.get(callId);
    if (!callback || !this.callbackMap.delete(callId)) {
      return;
    }
    const handlers = this.eventHandlers.get(this.name);
    if (handlers) {
      const index = handlers.indexOf(callback);
      if (index >= 0) {
        handlers.splice(index, 1);
      }
      if (handlers.length === 0) {
        this.eventHandlers.delete(this.name);
      }
    }
    if (this.callbackMap.size === 0) {
      this.invokeBridge(buildMqqSubscriberUnsubscribeApi(this.name), [{ subscriberId: this.subscriberId }]);
    }
  }
};
function createMqqProtocol(options = {}) {
  const callbacks = /* @__PURE__ */ new Map();
  const subscriberCallbacks = /* @__PURE__ */ new Map();
  const invokeHandler = options.invokeHandler;
  const pageUrl2 = options.pageUrl;
  const localEngineOrigin = options.localEngineOrigin;
  const apiPermissionMap = buildApiPermissionMap(options.apiPermissions);
  const requireRegisteredApiPermission = options.requireRegisteredApiPermission === true;
  let nextRequestId = 0;
  let nextSubscriberId = 0;
  const runInvoke = (request, callback) => {
    const result = invokeHandler?.(request) ?? createUnhandledBridgeResponse(request.id);
    if (isPromiseLike(result)) {
      result.then((ret) => callback?.(toCallbackResult(ret))).catch((error) => callback?.(toInternalErrorResult(error)));
      return;
    }
    callback?.(toCallbackResult(result));
  };
  const invokeBridge = (apiName, args, callback) => {
    if (!checkMqqApiPermission(
      apiName,
      pageUrl2,
      localEngineOrigin,
      apiPermissionMap,
      requireRegisteredApiPermission
    )) {
      callback?.(createPermissionDeniedResult());
      return;
    }
    nextRequestId += 1;
    runInvoke({
      id: nextRequestId,
      apiName,
      args
    }, callback);
  };
  return {
    invoke(moduleName, methodName, args = {}, callback) {
      invokeBridge(`${moduleName}.${methodName}`, [args], callback);
    },
    addEventListener(eventName, handler) {
      const handlers = callbacks.get(eventName) ?? [];
      handlers.push(handler);
      callbacks.set(eventName, handlers);
      return true;
    },
    removeEventListener(eventName, handler) {
      const handlers = callbacks.get(eventName);
      if (!handlers) {
        return;
      }
      const index = handlers.indexOf(handler);
      if (index >= 0) {
        handlers.splice(index, 1);
      }
      if (handlers.length === 0) {
        callbacks.delete(eventName);
      }
    },
    async execEventCallback(eventName, ...args) {
      const handlers = [
        ...callbacks.get(eventName) ?? [],
        ...subscriberCallbacks.get(eventName) ?? []
      ];
      if (handlers.length === 0) {
        return void 0;
      }
      return Promise.all(handlers.slice().map((handler) => {
        try {
          return handler(...args);
        } catch (error) {
          return error instanceof Error ? error : new Error(String(error));
        }
      }));
    },
    createSubscribe(name) {
      nextSubscriberId += 1;
      return new MqqSubscriberImpl(name, nextSubscriberId, invokeBridge, subscriberCallbacks);
    }
  };
}

// src/tencent-docs/preload/webview-preload.ts
var import_electron3 = require("electron");

// src/preload/webview-drag-release-guard.ts
var WEBVIEW_DRAG_RELEASE_BRIDGE_DRAG_START_CHANNEL = "workbuddy:webview-drag-release-bridge:drag-start";
var WEBVIEW_DRAG_RELEASE_BRIDGE_DRAG_END_CHANNEL = "workbuddy:webview-drag-release-bridge:drag-end";
var WEBVIEW_DRAG_RELEASE_BRIDGE_HOST_RELEASE_CHANNEL = "workbuddy:webview-drag-release-bridge:host-release";
function installWebviewDragReleaseGuard(targetDocument = document, options = {}) {
  const targetWindow = targetDocument.defaultView;
  if (!targetWindow) {
    return () => void 0;
  }
  const ownerWindow = targetWindow;
  const state = {
    isPrimaryMouseDown: false,
    isPrimaryPointerDown: false,
    isDispatchingSyntheticRelease: false
  };
  const listenerOptions = { capture: true, passive: false };
  const removeHostReleaseListener = options.listenHostRelease?.((payload) => {
    releaseFromHost(payload);
  });
  const onMouseDown = (event) => {
    if (event.button !== 0) {
      return;
    }
    state.isPrimaryMouseDown = true;
    state.lastMouseDownTarget = readDispatchTarget(event.target, targetDocument);
    state.lastMouseEvent = event;
    options.notifyHostDragStart?.();
  };
  const onMouseUp = (event) => {
    if (event.button !== 0 || state.isDispatchingSyntheticRelease) {
      clearMouseState(state);
      options.notifyHostDragEnd?.();
      return;
    }
    const releaseTarget = state.lastMouseDownTarget;
    clearMouseState(state);
    dispatchMouseReleaseIfNeeded(releaseTarget, event, targetDocument, ownerWindow, state);
    options.notifyHostDragEnd?.();
  };
  const onPointerDown = (event) => {
    if (!event.isPrimary || event.button !== 0) {
      return;
    }
    state.isPrimaryPointerDown = true;
    state.primaryPointerId = event.pointerId;
    state.lastPointerDownTarget = readDispatchTarget(event.target, targetDocument);
    state.lastPointerEvent = event;
  };
  const onPointerUpOrCancel = (event) => {
    if (state.primaryPointerId !== void 0 && event.pointerId !== state.primaryPointerId) {
      return;
    }
    clearPointerState(state);
  };
  targetDocument.addEventListener("mousedown", onMouseDown, listenerOptions);
  targetDocument.addEventListener("mouseup", onMouseUp, listenerOptions);
  targetDocument.addEventListener("pointerdown", onPointerDown, listenerOptions);
  targetDocument.addEventListener("pointerup", onPointerUpOrCancel, listenerOptions);
  targetDocument.addEventListener("pointercancel", onPointerUpOrCancel, listenerOptions);
  return () => {
    removeHostReleaseListener?.();
    targetDocument.removeEventListener("mousedown", onMouseDown, listenerOptions);
    targetDocument.removeEventListener("mouseup", onMouseUp, listenerOptions);
    targetDocument.removeEventListener("pointerdown", onPointerDown, listenerOptions);
    targetDocument.removeEventListener("pointerup", onPointerUpOrCancel, listenerOptions);
    targetDocument.removeEventListener("pointercancel", onPointerUpOrCancel, listenerOptions);
  };
  function releaseFromHost(payload) {
    const mouseTarget = state.lastMouseDownTarget;
    const mouseEvent = state.lastMouseEvent;
    const pointerTarget = state.lastPointerDownTarget;
    const pointerEvent = state.lastPointerEvent;
    const shouldDispatchMouseRelease = state.isPrimaryMouseDown;
    const shouldDispatchPointerRelease = state.isPrimaryPointerDown;
    clearMouseState(state);
    clearPointerState(state);
    if (shouldDispatchPointerRelease) {
      dispatchPointerRelease(pointerTarget, pointerEvent, payload, targetDocument, ownerWindow);
    }
    if (shouldDispatchMouseRelease) {
      dispatchMouseRelease(mouseTarget, mouseEvent, payload, targetDocument, ownerWindow, state);
    }
    if (shouldDispatchMouseRelease || shouldDispatchPointerRelease) {
      options.notifyHostDragEnd?.();
    }
  }
}
function dispatchMouseReleaseIfNeeded(releaseTarget, event, ownerDocument, ownerWindow, state) {
  const dispatchTarget = readDispatchTarget(releaseTarget, ownerDocument);
  if (isSameOrInsideTarget(dispatchTarget, event.target, ownerWindow)) {
    return;
  }
  state.isDispatchingSyntheticRelease = true;
  try {
    dispatchTarget.dispatchEvent(new ownerWindow.MouseEvent("mouseup", buildMouseReleaseInitFromEvent(event)));
  } finally {
    state.isDispatchingSyntheticRelease = false;
  }
}
function dispatchMouseRelease(releaseTarget, fallbackEvent, payload, ownerDocument, ownerWindow, state) {
  const dispatchTarget = readDispatchTarget(releaseTarget, ownerDocument);
  state.isDispatchingSyntheticRelease = true;
  try {
    dispatchTarget.dispatchEvent(new ownerWindow.MouseEvent(
      "mouseup",
      buildMouseReleaseInit(payload, fallbackEvent)
    ));
  } finally {
    state.isDispatchingSyntheticRelease = false;
  }
}
function dispatchPointerRelease(releaseTarget, fallbackEvent, payload, ownerDocument, ownerWindow) {
  const dispatchTarget = readDispatchTarget(releaseTarget, ownerDocument);
  if (typeof ownerWindow.PointerEvent !== "function") {
    return;
  }
  dispatchTarget.dispatchEvent(new ownerWindow.PointerEvent(
    "pointerup",
    buildPointerReleaseInit(payload, fallbackEvent)
  ));
}
function readDispatchTarget(target, ownerDocument) {
  if (target && typeof target.dispatchEvent === "function") {
    return target;
  }
  return ownerDocument;
}
function isSameOrInsideTarget(releaseTarget, eventTarget, ownerWindow) {
  if (releaseTarget === eventTarget) {
    return true;
  }
  const releaseNode = releaseTarget instanceof ownerWindow.Node ? releaseTarget : void 0;
  const eventNode = eventTarget instanceof ownerWindow.Node ? eventTarget : void 0;
  return Boolean(releaseNode && eventNode && releaseNode.contains(eventNode));
}
function clearMouseState(state) {
  state.isPrimaryMouseDown = false;
  state.lastMouseDownTarget = void 0;
  state.lastMouseEvent = void 0;
}
function clearPointerState(state) {
  state.isPrimaryPointerDown = false;
  state.primaryPointerId = void 0;
  state.lastPointerDownTarget = void 0;
  state.lastPointerEvent = void 0;
}
function buildMouseReleaseInitFromEvent(event) {
  return buildMouseReleaseInit(void 0, event);
}
function buildMouseReleaseInit(payload, fallbackEvent) {
  return {
    bubbles: true,
    cancelable: true,
    composed: true,
    button: 0,
    buttons: 0,
    detail: fallbackEvent?.detail ?? 0,
    screenX: payload?.screenX ?? fallbackEvent?.screenX ?? 0,
    screenY: payload?.screenY ?? fallbackEvent?.screenY ?? 0,
    clientX: payload?.clientX ?? fallbackEvent?.clientX ?? 0,
    clientY: payload?.clientY ?? fallbackEvent?.clientY ?? 0,
    ctrlKey: payload?.ctrlKey ?? fallbackEvent?.ctrlKey ?? false,
    altKey: payload?.altKey ?? fallbackEvent?.altKey ?? false,
    shiftKey: payload?.shiftKey ?? fallbackEvent?.shiftKey ?? false,
    metaKey: payload?.metaKey ?? fallbackEvent?.metaKey ?? false
  };
}
function buildPointerReleaseInit(payload, fallbackEvent) {
  return {
    ...buildMouseReleaseInit(payload, fallbackEvent),
    pointerId: fallbackEvent?.pointerId ?? 1,
    width: fallbackEvent?.width ?? 1,
    height: fallbackEvent?.height ?? 1,
    pressure: 0,
    tangentialPressure: fallbackEvent?.tangentialPressure ?? 0,
    tiltX: fallbackEvent?.tiltX ?? 0,
    tiltY: fallbackEvent?.tiltY ?? 0,
    twist: fallbackEvent?.twist ?? 0,
    pointerType: fallbackEvent?.pointerType ?? "mouse",
    isPrimary: fallbackEvent?.isPrimary ?? true
  };
}

// src/tencent-docs/preload/install-guest-log-bridge.ts
var import_electron = require("electron");
var import_renderer = __toESM(require_renderer2());

// src/tencent-docs/guest-log-contract.ts
var MAX_MESSAGE_LENGTH = 2048;
var MAX_CONTEXT_LENGTH = 1024;
var MAX_CONTEXT_FIELDS = 20;
var MAX_CONTEXT_KEY_LENGTH = 64;
var MAX_CONTEXT_STRING_LENGTH = 256;
var LOG_LEVELS = /* @__PURE__ */ new Set(["info", "warn", "error"]);
function normalizeWorkbuddyGuestLogPayload(level, message, context) {
  if (typeof level !== "string" || !LOG_LEVELS.has(level)) {
    return void 0;
  }
  if (typeof message !== "string" || !message.trim()) {
    return void 0;
  }
  const normalizedContext = normalizeContext(context);
  return {
    level,
    message: message.slice(0, MAX_MESSAGE_LENGTH),
    ...normalizedContext ? { context: normalizedContext } : {}
  };
}
function formatWorkbuddyGuestLog(payload) {
  return `[TencentDocsGuest] ${payload.message}${payload.context ? ` ${payload.context}` : ""}`;
}
function normalizeContext(context) {
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    return void 0;
  }
  const normalized = {};
  for (const [key, value] of Object.entries(context).slice(0, MAX_CONTEXT_FIELDS)) {
    const normalizedKey = key.slice(0, MAX_CONTEXT_KEY_LENGTH);
    if (!normalizedKey) {
      continue;
    }
    let normalizedValue;
    if (typeof value === "string") {
      normalizedValue = value.slice(0, MAX_CONTEXT_STRING_LENGTH);
    } else if (typeof value === "number" && Number.isFinite(value)) {
      normalizedValue = value;
    } else if (typeof value === "boolean") {
      normalizedValue = value;
    } else {
      continue;
    }
    const candidate = { ...normalized, [normalizedKey]: normalizedValue };
    if (JSON.stringify(candidate).length > MAX_CONTEXT_LENGTH) {
      break;
    }
    normalized[normalizedKey] = normalizedValue;
  }
  const serialized = JSON.stringify(normalized);
  return serialized === "{}" ? void 0 : serialized;
}

// src/tencent-docs/preload/install-guest-log-bridge.ts
var MAX_LOGS_PER_WINDOW = 60;
var LOG_WINDOW_MS = 6e4;
async function installGuestLogBridge(pageUrl2, ipcRenderer2) {
  const isOnlineTencentDocsPage = isTencentDocsUrl(pageUrl2);
  const isLocalDocument = isLocalTencentDocsEnginePreviewUrl(pageUrl2);
  if (!isOnlineTencentDocsPage && !isLocalDocument) {
    return;
  }
  if (isLocalDocument && !await canAccessLocalDocumentFrame(ipcRenderer2)) {
    return;
  }
  const rendererLogger = import_renderer.default.create({ logId: "renderer" });
  rendererLogger.transports.console.level = false;
  const guestLog = rendererLogger.scope("tencent-docs-guest");
  let windowStartedAt = Date.now();
  let emittedInWindow = 0;
  const emit = (level, message, context) => {
    const now = Date.now();
    if (now - windowStartedAt >= LOG_WINDOW_MS) {
      windowStartedAt = now;
      emittedInWindow = 0;
    }
    if (emittedInWindow >= MAX_LOGS_PER_WINDOW) {
      return;
    }
    const payload = normalizeWorkbuddyGuestLogPayload(level, message, context);
    if (payload) {
      emittedInWindow += 1;
      guestLog[level](formatWorkbuddyGuestLog(payload));
    }
  };
  import_electron.contextBridge.exposeInMainWorld("__workbuddyRenderLog", {
    info: (message, context) => emit("info", message, context),
    warn: (message, context) => emit("warn", message, context),
    error: (message, context) => emit("error", message, context)
  });
}
async function canAccessLocalDocumentFrame(ipcRenderer2) {
  try {
    const response = await ipcRenderer2.invoke(WORKBUDDY_MQQ_BRIDGE_CHANNEL, {
      id: 0,
      apiName: WORKBUDDY_MQQ_ACCESS_PROBE_API,
      args: []
    });
    return response.errCode === 0 && response.hasHandled === true;
  } catch {
    return false;
  }
}

// src/tencent-docs/preload/install-guest-telemetry-bridge.ts
var import_electron2 = require("electron");
var requestSeq = 0;
function readWbSourceFromUrl(pageUrl2) {
  try {
    const value = new URL(pageUrl2).searchParams.get("wb_source");
    return value && value.trim().length > 0 ? value : void 0;
  } catch {
    return void 0;
  }
}
function installGuestTelemetryBridge(options) {
  const wbSourceFromUrl = readWbSourceFromUrl(options.pageUrl);
  try {
    import_electron2.contextBridge.exposeInMainWorld("__workbuddyTelemetry", {
      report: (params) => {
        requestSeq += 1;
        options.ipcRenderer.invoke(WORKBUDDY_MQQ_BRIDGE_CHANNEL, {
          id: requestSeq,
          apiName: WORKBUDDY_REPORT_TELEMETRY_API,
          // pageURL / wb_source 缺省由 preload 从 URL 补；调用方显式传入时以其为准（后铺覆盖）。
          args: [{
            pageURL: options.pageUrl,
            ...wbSourceFromUrl ? { wb_source: wbSourceFromUrl } : {},
            ...params
          }],
          documentResourceUri: options.documentResourceUri,
          filePath: options.filePath
        }).catch((error) => {
          console.warn("[GuestTelemetry] report failed (non-fatal):", error);
        });
      }
    });
  } catch (error) {
    console.warn("[GuestTelemetry] expose __workbuddyTelemetry failed (non-fatal):", error);
  }
}

// src/tencent-docs/preload/webview-preload.ts
var pageUrl = window.location.href;
var localFilePath = readLocalFilePath(pageUrl);
var documentResourceUri = localFilePath ? toFileResourceUri(localFilePath) : void 0;
if (shouldExposeMqqProtocol(pageUrl)) {
  injectDocsFeatureList();
  if (isTencentDocsUrl(pageUrl)) {
    installWebviewDragReleaseGuard(document, {
      notifyHostDragStart: () => import_electron3.ipcRenderer.sendToHost(WEBVIEW_DRAG_RELEASE_BRIDGE_DRAG_START_CHANNEL),
      notifyHostDragEnd: () => import_electron3.ipcRenderer.sendToHost(WEBVIEW_DRAG_RELEASE_BRIDGE_DRAG_END_CHANNEL),
      listenHostRelease: (handler) => {
        const listener = (_event, payload) => {
          handler(typeof payload === "object" && payload !== null ? payload : void 0);
        };
        import_electron3.ipcRenderer.on(WEBVIEW_DRAG_RELEASE_BRIDGE_HOST_RELEASE_CHANNEL, listener);
        return () => {
          import_electron3.ipcRenderer.removeListener(WEBVIEW_DRAG_RELEASE_BRIDGE_HOST_RELEASE_CHANNEL, listener);
        };
      }
    });
  }
  import_electron3.contextBridge.exposeInMainWorld("mqq", createMqqProtocol({
    pageUrl,
    apiPermissions: TENCENT_DOCS_MQQ_API_PERMISSIONS,
    requireRegisteredApiPermission: true,
    invokeHandler: (request) => import_electron3.ipcRenderer.invoke(WORKBUDDY_MQQ_BRIDGE_CHANNEL, {
      ...request,
      documentResourceUri,
      filePath: localFilePath
    })
  }));
  installGuestTelemetryBridge({ pageUrl, documentResourceUri, filePath: localFilePath, ipcRenderer: import_electron3.ipcRenderer });
  installGuestLogBridge(pageUrl, import_electron3.ipcRenderer).catch((error) => {
    console.warn("[TencentDocsWebviewPreload] guest log bridge setup failed", error);
  });
  document.addEventListener("click", (event) => {
    const target = event.target;
    const anchor = target?.closest?.("a");
    if (!anchor) {
      return;
    }
    const proto = (anchor.protocol || "").toLowerCase();
    if (anchor.hasAttribute("download") || proto === "blob:" || proto === "data:") {
      event.stopImmediatePropagation();
    }
  }, true);
  import_electron3.contextBridge.exposeInMainWorld(MAIN_WORLD_DOWNLOAD_TRIGGER_KEY, (url) => {
    if (typeof url !== "string" || !isTencentDocsDownloadHref(url)) {
      return false;
    }
    import_electron3.ipcRenderer.send(WORKBUDDY_TENCENT_DOCS_WEBVIEW_DOWNLOAD_CHANNEL, url);
    return true;
  });
}
function readLocalFilePath(url) {
  try {
    return new URL(url).searchParams.get("localFilePath") ?? void 0;
  } catch {
    return void 0;
  }
}
function injectDocsFeatureList() {
  let json;
  try {
    const resolved = import_electron3.ipcRenderer.sendSync(WORKBUDDY_DOCS_FEATURE_LIST_RESOLVE_CHANNEL);
    json = typeof resolved === "string" && resolved.length > 0 ? resolved : getDocsFeatureListString({ inConversation: false });
  } catch {
    json = getDocsFeatureListString({ inConversation: false });
  }
  import_electron3.webFrame.executeJavaScript(`window.__WB_DOCS_FEATURE_LIST__ = ${json};`).catch(() => {
  });
}
function toFileResourceUri(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  const withLeadingSlash = normalized.startsWith("/") ? normalized : `/${normalized}`;
  const encoded = withLeadingSlash.split("/").map(encodeFileUriSegment).join("/");
  return `file://${encoded}`;
}
function encodeFileUriSegment(segment) {
  return encodeURIComponent(segment).replace(/~/g, "%7E").replace(/%24/g, "$").replace(/%26/g, "&").replace(/%2B/g, "+").replace(/%2C/g, ",").replace(/%3A/g, ":").replace(/%3B/g, ";").replace(/%3D/g, "=").replace(/%40/g, "@");
}
