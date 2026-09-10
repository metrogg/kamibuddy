const require_common$2 = require("./common.js");
const require_workbuddy_product_config = require("./workbuddy-product-config.js");
const require_dev_env_override = require("./dev-env-override.js");
//#region ../../packages/workbuddy-server/src/ima/connector-name.ts
var DEFAULT_IMA_CONNECTOR_NAME = "ima";
var WORKBUDDY_APPLICATION_NAME = "workbuddy";
function normalizeApplicationName(value) {
	if (typeof value !== "string") return;
	return value.trim().toLowerCase() || void 0;
}
function getImaConnectorNameFromProduct(product) {
	const applicationName = normalizeApplicationName(product?.applicationName);
	if (!applicationName || applicationName === WORKBUDDY_APPLICATION_NAME) return DEFAULT_IMA_CONNECTOR_NAME;
	return `${DEFAULT_IMA_CONNECTOR_NAME}-${applicationName}`;
}
async function getImaConnectorName(productManager) {
	const current = productManager?.getCurrentConfiguration?.();
	if (current) return getImaConnectorNameFromProduct(current);
	try {
		return getImaConnectorNameFromProduct(await productManager?.waitConfiguration?.());
	} catch {
		return DEFAULT_IMA_CONNECTOR_NAME;
	}
}
//#endregion
//#region src/main/system/runtime/remote-product-payload.ts
var import_common$1 = require_common$2.require_common$1();
require_common$2.init_decorate();
require_common$2.init_decorateMetadata();
require_common$2.init_common$5();
require_common$2.init_common$3();
require_common$2.init_common();
require_dev_env_override.init_dev_env_override();
/**
* 判断远端 sanitized 配置是否包含有效云控 payload（issue #59223 修复方案 §16.3）。
*
* CloudProductManager.fetch() 失败无缓存时返回 {}（不抛错），不能用它覆盖上一次有效 overlay。
* 判定规则：
* - 入参应是 omitRemoteExcludedFields 之后的结果（endpoint/availableModels 等不通过 overlay
*   生效的字段已剔除）。
* - mergeStrategy 是客户端派生字段，不算有效 payload（此调用点通常还未拼入，仅为 helper 复用兜底）。
* - undefined / null / 空对象 / 空数组 / 空字符串 不算有效。
* - false / 0 算有效（远端可能明确关闭功能或下发阈值 0）。
* 不维护字段白名单，避免每新增一个云控字段都要改判断列表。
*/
function hasRemoteProductPayload(config) {
	if (!config) return false;
	return Object.entries(config).some(([key, value]) => key !== "mergeStrategy" && hasMeaningfulValue(value));
}
function hasMeaningfulValue(value) {
	if (value === void 0 || value === null) return false;
	if (typeof value === "string") return value.length > 0;
	if (typeof value === "number" || typeof value === "boolean") return true;
	if (Array.isArray(value)) return value.some((item) => hasMeaningfulValue(item));
	if (typeof value === "object") return Object.values(value).some((item) => hasMeaningfulValue(item));
	return false;
}
//#endregion
//#region src/main/system/runtime/workbuddy-product-experiment-overlay.ts
var import_common = require_common$2.require_common();
require_workbuddy_product_config.init_workbuddy_product_config();
function hasProductExperimentOverlay(overlay) {
	if (!overlay) return false;
	return Object.keys(overlay).some((key) => overlay[key] !== void 0);
}
function mergeExperimentModel(base, overlay) {
	if (overlay === void 0) return base;
	if (Array.isArray(base) || Array.isArray(overlay)) return overlay;
	if (base && overlay && typeof base === "object" && typeof overlay === "object") {
		const result = { ...base };
		for (const key of Object.keys(overlay)) result[key] = mergeExperimentModel(base[key], overlay[key]);
		return result;
	}
	return overlay;
}
function applyModelsExperimentOverlay(baseModels, overlayModels) {
	if (overlayModels === void 0) return baseModels;
	if (!baseModels?.length) return baseModels;
	const result = [...baseModels];
	for (const overlayModel of overlayModels) {
		const modelIndex = result.findIndex((model) => model.id === overlayModel.id);
		if (modelIndex === -1) continue;
		result[modelIndex] = mergeExperimentModel(result[modelIndex], overlayModel);
	}
	return result;
}
function isTopLevelObjectConfig(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
function applyTopLevelObjectExperimentOverlays(base, overlay) {
	const result = {
		...base,
		...overlay
	};
	for (const key of Object.keys(overlay)) {
		if (key === "models") continue;
		const baseValue = base[key];
		const overlayValue = overlay[key];
		if (isTopLevelObjectConfig(baseValue) && isTopLevelObjectConfig(overlayValue)) result[key] = {
			...baseValue,
			...overlayValue
		};
	}
	return result;
}
/**
* Apply TAB experiment config with top-level replacement semantics.
*
* Keys absent from experiment config are preserved. Top-level object fields are
* shallow-merged by key, so productFeatures-like maps can override one key
* without restating the whole object. The models key is the array exception:
* experiment models are matched by id and merged into existing model entries.
*/
function applyProductExperimentOverlay(base, overlay) {
	if (!hasProductExperimentOverlay(overlay)) return base;
	const effectiveOverlay = overlay;
	return {
		...applyTopLevelObjectExperimentOverlays(base, effectiveOverlay),
		models: applyModelsExperimentOverlay(base.models, effectiveOverlay.models)
	};
}
//#endregion
//#region src/main/system/runtime/workbuddy-product-manager.ts
var SERVER_DATA_LEVEL = 2;
var NOOP_LOGGER = {
	info: () => {},
	warn: () => {},
	error: () => {},
	debug: () => {}
};
var WorkbuddyProductManager = class WorkbuddyProductManager extends require_common$2.ProductManagerImpl {
	localConfiguration = {};
	/** 自定义模型 provider 的独立输出，用于在 overlay merge 后重新叠加 */
	customModelsOverride = {};
	/** 企业模型 provider 的独立输出，用于在远端 overlay merge 后叠加 */
	enterpriseModelsOverride = {};
	resolvedOverlay;
	/** TAB 实验配置 overlay，仅保存在内存中，按顶层 key 替换最终 product 配置。 */
	experimentOverlay;
	async doSync(force) {
		const providers = [...await this.productProviderProvider.sort()].reverse().filter((provider) => !this.isExternallyOwnedProvider(provider));
		let localConfig = {};
		const stableProviderConfigs = [];
		let hasVolatileProvider = false;
		let customModelsConfig = {};
		let enterpriseModelsConfig = {};
		try {
			for (const productProvider of providers) {
				const config = await productProvider.provide({
					force: !!force,
					current: localConfig
				});
				if (productProvider.volatile) hasVolatileProvider = true;
				else stableProviderConfigs.push(config);
				if (this.isCustomModelsProvider(productProvider)) customModelsConfig = config;
				if (this.isEnterpriseModelsProvider(productProvider)) enterpriseModelsConfig = config;
				localConfig = await this.productMerger.merge(localConfig, config);
				this.trackConfigUrlChange(localConfig, productProvider);
				if (localConfig.endpoint) this.currentEndpoint = localConfig.endpoint;
			}
		} catch (error) {
			console.error(`[ProductManager] Error while syncing product configuration: ${error}`);
		}
		this.localConfiguration = localConfig;
		this.customModelsOverride = customModelsConfig;
		this.enterpriseModelsOverride = enterpriseModelsConfig;
		this._stableConfiguration = hasVolatileProvider ? await this.buildStableConfiguration(stableProviderConfigs) : localConfig;
		await this.publishResolvedConfiguration();
	}
	getLocalConfiguration() {
		return this.localConfiguration;
	}
	async setResolvedOverlay(overlay) {
		this.resolvedOverlay = overlay;
		await this.publishResolvedConfiguration();
	}
	getExperimentOverlay() {
		return this.experimentOverlay;
	}
	async setExperimentOverlay(overlay) {
		this.experimentOverlay = overlay;
		await this.publishResolvedConfiguration();
	}
	isExternallyOwnedProvider(provider) {
		return provider.constructor.name === "EnvProductProvider" || provider.constructor.name === "CloudProductProvider" || provider.constructor.name === "CustomModelsProductProvider" || provider.constructor.name === "ModelsProductProvider" || provider.constructor.name === "WorkspaceProductProvider" || provider.constructor.name === "AvailableModelsFilterProvider";
	}
	isCustomModelsProvider(provider) {
		return provider.constructor.name === "WorkbuddyCustomModelsProductProvider";
	}
	isEnterpriseModelsProvider(provider) {
		return provider.constructor.name === "WorkbuddyEnterpriseModelsProductProvider";
	}
	async buildStableConfiguration(stableProviderConfigs) {
		let stableConfig = {};
		for (const config of stableProviderConfigs) stableConfig = await this.productMerger.merge(stableConfig, config);
		return stableConfig;
	}
	async publishResolvedConfiguration() {
		let logger;
		try {
			logger = import_common$1.ContainerUtil.get(import_common$1.Logger);
		} catch {
			logger = NOOP_LOGGER;
		}
		const localModelsCount = (this.localConfiguration ?? {}).models?.length ?? 0;
		const overlayModelsCount = (this.resolvedOverlay ?? {}).models?.length ?? 0;
		let resolvedConfig = await this.productMerger.merge(this.localConfiguration ?? {}, this.resolvedOverlay ?? {});
		const afterMergeModelsCount = resolvedConfig.models?.length ?? 0;
		logger.info(`[Merge] Step 1 (local + overlay): localModels=${localModelsCount}, overlayModels=${overlayModelsCount}, mergedModels=${afterMergeModelsCount}`);
		const environmentProduct = require_workbuddy_product_config.getWorkbuddyEnvironmentProductConfiguration(resolvedConfig.networkEnvironment ?? require_workbuddy_product_config.resolveWorkbuddyProductEnvironmentFromSessionFile());
		if (environmentProduct?.productFeatures) resolvedConfig = {
			...resolvedConfig,
			productFeatures: {
				...resolvedConfig.productFeatures,
				...environmentProduct.productFeatures
			}
		};
		console.log("[WorkbuddyProductManager] publishResolvedConfiguration 合并后 Connector:", resolvedConfig.productFeatures?.Connector);
		if (hasProductExperimentOverlay(this.experimentOverlay)) {
			const beforeModelsCount = resolvedConfig.models?.length ?? 0;
			const beforeProductFeaturesCount = Object.keys(resolvedConfig.productFeatures ?? {}).length;
			const overlayKeys = Object.keys(this.experimentOverlay ?? {});
			resolvedConfig = applyProductExperimentOverlay(resolvedConfig, this.experimentOverlay);
			logger.info(`[ExperimentConfig] Apply overlay: keys=${overlayKeys.join(",") || "(empty)"}, beforeModels=${beforeModelsCount}, afterModels=${resolvedConfig.models?.length ?? 0}, beforeProductFeatures=${beforeProductFeaturesCount}, afterProductFeatures=${Object.keys(resolvedConfig.productFeatures ?? {}).length}`);
		}
		const enterpriseModelsCount = this.enterpriseModelsOverride.models?.length ?? 0;
		if (this.enterpriseModelsOverride.models?.length) resolvedConfig = await this.productMerger.merge(resolvedConfig, {
			...this.enterpriseModelsOverride,
			mergeStrategy: require_common$2.MergeStrategy.DeepSmartMerge
		});
		logger.info(`[Merge] Step 2 (+enterprise): enterpriseModels=${enterpriseModelsCount}, totalModels=${resolvedConfig.models?.length ?? 0}`);
		const customModelsCount = this.customModelsOverride.models?.length ?? 0;
		if (this.customModelsOverride.models?.length) resolvedConfig = await this.productMerger.merge(resolvedConfig, {
			...this.customModelsOverride,
			mergeStrategy: require_common$2.MergeStrategy.SmartMerge
		});
		logger.info(`[Merge] Step 3 (+custom): customModels=${customModelsCount}, totalModels=${resolvedConfig.models?.length ?? 0}`);
		const mergedPromotions = require_workbuddy_product_config.mergeNamedArrayLayers(this.localConfiguration?.modelPromotions, environmentProduct?.modelPromotions, this.resolvedOverlay?.modelPromotions);
		resolvedConfig = {
			...resolvedConfig,
			modelPromotions: mergedPromotions
		};
		resolvedConfig = this.applyAvailableModelsFilter(resolvedConfig);
		const cliAgent = resolvedConfig.agents?.find((a) => a.name === "cli");
		logger.info(`[Merge] Step 4 (availableModels filter): finalModels=${resolvedConfig.models?.length ?? 0}` + (cliAgent ? `, cli.models=${JSON.stringify(cliAgent.models)}` : ""));
		this.applyProductFeatureFilters(resolvedConfig);
		if (require_common$2.shouldReplaceAutoWithTierModels(resolvedConfig)) {
			resolvedConfig = require_common$2.replaceAutoWithTierModels(resolvedConfig);
			logger.info(`[Merge] Step 5 (auto→tier): finalModels=${resolvedConfig.models?.length ?? 0}`);
		}
		const endpointOverride = require_dev_env_override.resolveEndpointOverride();
		if (endpointOverride) resolvedConfig = {
			...resolvedConfig,
			endpoint: endpointOverride
		};
		const isChanged = require_common$2.ObjectUtils.isChanged(this._configuration, resolvedConfig);
		this.currentConfiguration = resolvedConfig;
		if (resolvedConfig.endpoint) this.currentEndpoint = resolvedConfig.endpoint;
		if (!isChanged) return;
		this._configuration = resolvedConfig;
		const proxy = new Proxy(resolvedConfig, { get: (target, p) => {
			if (Date.now() - this.lastSyncTime > 48e4) this.throttledSyncForProxy();
			return target[p];
		} });
		this.dataLevel = SERVER_DATA_LEVEL;
		this.configuration.next(proxy);
		this.onDidChangeEmitter.fire();
		await this.saveToCache();
	}
	applyAvailableModelsFilter(config) {
		if (!config.models || !config.availableModels?.length) return config;
		return {
			...config,
			models: config.models.filter((model) => config.availableModels?.includes(model.id))
		};
	}
	trackConfigUrlChange(config, provider) {
		const newConfigUrl = config.config?.url;
		if (this.previousConfigUrl === newConfigUrl) return;
		this.previousConfigUrl = newConfigUrl;
	}
	getEndpoint() {
		return require_dev_env_override.resolveEndpointOverride() ?? super.getEndpoint();
	}
};
WorkbuddyProductManager = require_common$2.__decorate([(0, import_common$1.Component)({
	id: require_common$2.ProductManager,
	rebind: true
})], WorkbuddyProductManager);
//#endregion
//#region src/main/system/runtime/workbuddy-product-experiment-manager.ts
require_common$2.init_common$3();
require_common$2.init_decorate();
var _ref$1, _ref2$1, _ref3$1, _ref4$1;
var DEFAULT_EXPERIMENT_CONFIG_PATH = "/v2/feature-flag/api/product-config";
var DEFAULT_EXPERIMENT_POLLING_INTERVAL_MS = 900 * 1e3;
var MIN_EXPERIMENT_POLLING_INTERVAL_MS = 60 * 1e3;
function hasExperimentId(data) {
	if (data?.exp_id === void 0 || data.exp_id === null) return false;
	return String(data.exp_id).trim().length > 0;
}
var WorkbuddyProductExperimentManager = class WorkbuddyProductExperimentManager {
	logger;
	restOperations;
	productManager;
	authenticationManager;
	gitInfoCollector;
	syncQueue = Promise.resolve();
	pollingTimer;
	pollingIntervalMs;
	experimentOverlay;
	refreshGeneration = 0;
	init() {
		this.logger.setContext("WorkbuddyProductExperimentManager");
	}
	async waitReady() {
		await this.syncQueue;
	}
	getOverlay() {
		return this.experimentOverlay;
	}
	async refresh(product, session, options) {
		this.syncQueue = this.syncQueue.catch((error) => {
			this.logger.warn(`Previous experiment config refresh failed: ${error}`);
		}).then(() => this.doRefresh(product, session, options));
		return this.syncQueue;
	}
	async clear(reason = "clear") {
		this.refreshGeneration++;
		this.stopPolling(reason);
		if (!this.experimentOverlay) return;
		this.logger.info(`[ExperimentConfig] Clear overlay: reason=${reason}`);
		this.experimentOverlay = void 0;
		await this.productManager.setExperimentOverlay(void 0);
	}
	async doRefresh(product, session, _options) {
		const refreshGeneration = this.refreshGeneration;
		const effectiveSession = session ?? this.authenticationManager.currentSessionSubject.getValue();
		if (!effectiveSession) {
			await this.clear("no-session");
			return;
		}
		const effectiveProduct = product ?? await this.productManager.waitConfiguration();
		if (!this.isRefreshCurrent(refreshGeneration, effectiveSession)) {
			this.stopPolling("stale-session");
			return;
		}
		const experimentOptions = this.normalizeOptions(effectiveProduct.productFeatureExperiment);
		this.logger.info(`[ExperimentConfig] gate: enabled=${experimentOptions.enabled === true}, pollingEnabled=${experimentOptions.pollingEnabled === true}, intervalMs=${experimentOptions.pollingIntervalMs}, url=${DEFAULT_EXPERIMENT_CONFIG_PATH}`);
		if (experimentOptions.enabled !== true) {
			await this.clear("disabled");
			return;
		}
		try {
			const experimentProduct = await this.fetchExperimentProduct(experimentOptions, effectiveProduct, refreshGeneration, effectiveSession);
			if (!this.isRefreshCurrent(refreshGeneration, effectiveSession)) {
				this.stopPolling("stale-session");
				return;
			}
			if (!hasProductExperimentOverlay(experimentProduct)) {
				this.logger.info("[ExperimentConfig] Fetch empty: clear experiment overlay");
				this.experimentOverlay = void 0;
				await this.productManager.setExperimentOverlay(void 0);
				return;
			}
			this.experimentOverlay = experimentProduct;
			await this.productManager.setExperimentOverlay(experimentProduct);
			if (!this.isRefreshCurrent(refreshGeneration, effectiveSession)) {
				this.experimentOverlay = void 0;
				await this.productManager.setExperimentOverlay(void 0);
				this.stopPolling("stale-session");
				return;
			}
		} catch (error) {
			this.logger.warn(`[ExperimentConfig] Fetch failed: error=${error}`);
		} finally {
			if (this.isRefreshCurrent(refreshGeneration, effectiveSession)) this.updatePolling(experimentOptions);
			else this.stopPolling("stale-session");
		}
	}
	isRefreshCurrent(refreshGeneration, session) {
		return this.refreshGeneration === refreshGeneration && this.authenticationManager.currentSessionSubject.getValue() === session;
	}
	normalizeOptions(options) {
		const rawInterval = options?.pollingIntervalMs;
		const pollingIntervalMs = typeof rawInterval === "number" && Number.isFinite(rawInterval) ? Math.max(rawInterval, MIN_EXPERIMENT_POLLING_INTERVAL_MS) : DEFAULT_EXPERIMENT_POLLING_INTERVAL_MS;
		return {
			enabled: options?.enabled === true,
			pollingEnabled: options?.pollingEnabled === true,
			pollingIntervalMs
		};
	}
	async fetchExperimentProduct(_options, _product, refreshGeneration, session) {
		const startedAt = Date.now();
		const endpoint = this.productManager.getEndpoint();
		if (!endpoint) {
			this.logger.warn(`[ExperimentConfig] Fetch skipped: endpoint is missing, url=${DEFAULT_EXPERIMENT_CONFIG_PATH}`);
			return;
		}
		this.logger.info(`[ExperimentConfig] Fetch start: url=${DEFAULT_EXPERIMENT_CONFIG_PATH}`);
		const repos = await this.collectRepos();
		if (!this.isRefreshCurrent(refreshGeneration, session)) return;
		const responseData = (await this.restOperations.post(DEFAULT_EXPERIMENT_CONFIG_PATH, void 0, {
			timeout: 5e3,
			baseURL: endpoint,
			params: { repos: repos.map((item) => item.url) }
		}))?.data?.data;
		const hasExpId = hasExperimentId(responseData);
		const data = hasExpId ? responseData?.value ?? {} : {};
		this.logger.info(`[ExperimentConfig] Fetch success: expId=${responseData?.exp_id ?? "(empty)"}, ignored=${!hasExpId}, keys=${Object.keys(data).join(",") || "(empty)"}, models=${data.models?.length ?? 0}, elapsedMs=${Date.now() - startedAt}`);
		return data;
	}
	async collectRepos() {
		if (!this.gitInfoCollector) return [];
		try {
			return (await this.gitInfoCollector.collect())?.repositories ?? [];
		} catch (error) {
			this.logger.warn(`[ExperimentConfig] collect repos failed: ${error}`);
			return [];
		}
	}
	updatePolling(options) {
		if (options.enabled !== true || options.pollingEnabled !== true) {
			this.stopPolling("polling-disabled");
			return;
		}
		if (this.pollingTimer && this.pollingIntervalMs === options.pollingIntervalMs) return;
		this.stopPolling("restart");
		this.pollingIntervalMs = options.pollingIntervalMs;
		this.pollingTimer = setInterval(() => {
			this.refreshFromCurrentState().catch((error) => {
				this.logger.warn(`[ExperimentConfig] Polling refresh failed: ${error}`);
			});
		}, options.pollingIntervalMs);
		this.pollingTimer.unref?.();
		this.logger.info(`[ExperimentConfig] Polling started: intervalMs=${options.pollingIntervalMs}`);
	}
	stopPolling(reason) {
		if (!this.pollingTimer) {
			this.pollingIntervalMs = void 0;
			return;
		}
		clearInterval(this.pollingTimer);
		this.pollingTimer = void 0;
		this.pollingIntervalMs = void 0;
		this.logger.info(`[ExperimentConfig] Polling stopped: reason=${reason}`);
	}
	async refreshFromCurrentState() {
		const session = this.authenticationManager.currentSessionSubject.getValue();
		const product = await this.productManager.waitConfiguration();
		await this.refresh(product, session);
	}
};
require_common$2.__decorate([(0, import_common$1.Autowired)(import_common$1.Logger), require_common$2.__decorateMetadata("design:type", typeof (_ref$1 = typeof import_common$1.Logger !== "undefined" && import_common$1.Logger) === "function" ? _ref$1 : Object)], WorkbuddyProductExperimentManager.prototype, "logger", void 0);
require_common$2.__decorate([(0, import_common$1.Autowired)(import_common.RestOperations), require_common$2.__decorateMetadata("design:type", typeof (_ref2$1 = typeof import_common.RestOperations !== "undefined" && import_common.RestOperations) === "function" ? _ref2$1 : Object)], WorkbuddyProductExperimentManager.prototype, "restOperations", void 0);
require_common$2.__decorate([(0, import_common$1.Autowired)(require_common$2.ProductManager), require_common$2.__decorateMetadata("design:type", typeof (_ref3$1 = typeof WorkbuddyProductManager !== "undefined" && WorkbuddyProductManager) === "function" ? _ref3$1 : Object)], WorkbuddyProductExperimentManager.prototype, "productManager", void 0);
require_common$2.__decorate([(0, import_common$1.Autowired)(require_common$2.AuthenticationManager), require_common$2.__decorateMetadata("design:type", typeof (_ref4$1 = typeof require_common$2.AuthenticationManager !== "undefined" && require_common$2.AuthenticationManager) === "function" ? _ref4$1 : Object)], WorkbuddyProductExperimentManager.prototype, "authenticationManager", void 0);
require_common$2.__decorate([
	(0, import_common$1.Autowired)(require_common$2.GitInfoCollector),
	(0, import_common$1.Optional)(),
	require_common$2.__decorateMetadata("design:type", Object)
], WorkbuddyProductExperimentManager.prototype, "gitInfoCollector", void 0);
require_common$2.__decorate([
	(0, import_common$1.PostConstruct)(),
	require_common$2.__decorateMetadata("design:type", Function),
	require_common$2.__decorateMetadata("design:paramtypes", []),
	require_common$2.__decorateMetadata("design:returntype", void 0)
], WorkbuddyProductExperimentManager.prototype, "init", null);
WorkbuddyProductExperimentManager = require_common$2.__decorate([(0, import_common$1.Component)()], WorkbuddyProductExperimentManager);
//#endregion
//#region src/main/system/runtime/workbuddy-auth-product-coordinator.ts
require_common$2.init_common();
require_common$2.init_common$3();
require_dev_env_override.init_dev_env_override();
require_workbuddy_product_config.init_workbuddy_product_config();
require_common$2.init_decorateMetadata();
require_common$2.init_decorate();
var _ref, _ref2, _ref3, _ref4, _ref5, _ref6;
var DEFAULT_REMOTE_CONFIG_PATH = "/v3/config";
var REMOTE_CONFIG_EXCLUDE_FIELDS = [
	"deploymentType",
	"availableModels",
	"defaultRelatedModels",
	"productName",
	"defaultFolderName"
];
function normalizeJsonValue(value) {
	if (Array.isArray(value)) return value.map((item) => normalizeJsonValue(item));
	if (value && typeof value === "object") {
		const maybeJsonValue = value;
		if (typeof maybeJsonValue.toJSON === "function") return normalizeJsonValue(maybeJsonValue.toJSON());
		const source = value;
		const result = {};
		for (const key of Object.keys(source).sort()) {
			const normalized = normalizeJsonValue(source[key]);
			if (normalized !== void 0) result[key] = normalized;
		}
		return result;
	}
	if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") return;
	return value;
}
/** 后缀规则覆盖不到的精确 key（归一化后）。 */
var SENSITIVE_PRODUCT_LOG_KEYS = new Set([
	"authorization",
	"cookie",
	"passwordhash",
	"signature"
]);
/**
* 归一化后以这些词结尾的 key 一律脱敏。用后缀而不是逐个枚举，
* 避免远端配置新增 appSecret/clientToken 之类字段时黑名单漏网。
*/
var SENSITIVE_PRODUCT_LOG_KEY_SUFFIX = /(?:token|secret|password|passwd|credentials?|apikey|accesskey|secretkey|sessionkey|privatekey|publickey)$/;
function isSensitiveProductLogKey(normalizedKey) {
	return SENSITIVE_PRODUCT_LOG_KEYS.has(normalizedKey) || SENSITIVE_PRODUCT_LOG_KEY_SUFFIX.test(normalizedKey);
}
function normalizeSensitiveProductLogKey(key) {
	return key.toLowerCase().replace(/[_-]/g, "");
}
function isDownloadUrlKey(key) {
	return !!key && normalizeSensitiveProductLogKey(key) === "downloadurl";
}
function tryParseUrl(value) {
	try {
		return new URL(value);
	} catch {
		return;
	}
}
function stripProductLogUrlParams(value) {
	const url = tryParseUrl(value);
	if (!url || !url.search && !url.hash) return value;
	url.search = "";
	url.hash = "";
	return url.toString();
}
function redactProductSnapshotLogValue(key, value) {
	if (!key) return value;
	const normalizedKey = normalizeSensitiveProductLogKey(key);
	if (isSensitiveProductLogKey(normalizedKey)) return "<redacted>";
	if (normalizedKey === "downloadurl" && typeof value === "string") return stripProductLogUrlParams(value);
	return value;
}
function isJsonObject(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
function appendJsonPath(path, key) {
	return /^[A-Za-z_$][\w$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
}
function collectJsonChangedPaths(previous, next, path = "$", result = []) {
	if (Object.is(previous, next)) return result;
	if (Array.isArray(previous) && Array.isArray(next)) {
		const length = Math.max(previous.length, next.length);
		for (let i = 0; i < length; i += 1) collectJsonChangedPaths(previous[i], next[i], `${path}[${i}]`, result);
		return result;
	}
	if (isJsonObject(previous) && isJsonObject(next)) {
		const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
		for (const key of [...keys].sort()) collectJsonChangedPaths(previous[key], next[key], appendJsonPath(path, key), result);
		return result;
	}
	result.push(path);
	return result;
}
/**
* download_url 上跟签名轮换一起变化的易变参数（腾讯 CDN 的 sign/t、COS 的 q-* 签名族、
* 临时密钥 token）。轮转键要剥掉它们，否则任一参数轮换都会被误判成语义变更、
* 重新触发 hosted CLI 重启——正是本修复要压住的抖动。
*/
var VOLATILE_DOWNLOAD_URL_PARAMS = new Set([
	"sign",
	"t",
	"expires",
	"x-cos-security-token"
]);
function isVolatileDownloadUrlParam(name) {
	const normalized = name.toLowerCase();
	return VOLATILE_DOWNLOAD_URL_PARAMS.has(normalized) || normalized.startsWith("q-");
}
function stripSignedDownloadUrl(value) {
	const url = tryParseUrl(value);
	if (!url) return value;
	const volatileParams = [...url.searchParams.keys()].filter(isVolatileDownloadUrlParam);
	if (!volatileParams.length) return value;
	for (const name of volatileParams) url.searchParams.delete(name);
	return url.toString();
}
function normalizeHostedCliRotationValue(key, value) {
	if (isDownloadUrlKey(key) && typeof value === "string") return stripSignedDownloadUrl(value);
	return value;
}
/**
* 从 normalizeJsonValue 的产物派生 hosted CLI 轮转键。输入必须已规范化
* （键有序、无 toJSON/undefined），这样 JSON.stringify 的 replacer 一遍
* 就能完成 download_url 易变参数的剥离，无需再走一次树遍历。
*/
function hostedCliRotationKeyOfNormalized(normalizedSnapshot) {
	return JSON.stringify(normalizedSnapshot, (key, value) => normalizeHostedCliRotationValue(key, value));
}
var WorkbuddyAuthProductCoordinator = class WorkbuddyAuthProductCoordinator {
	logger;
	authenticationManager;
	productManager;
	productMerger;
	cloudProductManager;
	experimentManager;
	lastPublishedEnv;
	/** lastPublishedEnv 的解析形态（同一次发布写入），供变更 diff 免去重复 JSON.parse。 */
	lastPublishedSnapshot;
	syncQueue = Promise.resolve();
	remoteSyncQueue = Promise.resolve();
	remoteRefreshInFlightByKey = /* @__PURE__ */ new Map();
	remoteProductOverlay;
	lastRemoteRefreshKey;
	lastRemoteRefreshAt = 0;
	lastRemoteProductConfigurationResolution;
	lastNotifiedHostedCliSnapshotKey;
	hostedCliProductSnapshotChangeListeners = /* @__PURE__ */ new Set();
	/**
	* 等待当前的远端配置拉取完成。
	* 用于确保 getProductConfiguration RPC 返回的配置已包含远端 overlay。
	*/
	async waitRemoteReady() {
		await this.remoteSyncQueue;
		await this.experimentManager.waitReady();
	}
	getRemoteProductFeatures() {
		return this.remoteProductOverlay?.productFeatures;
	}
	init() {
		this.logger.setContext("WorkbuddyAuthProductCoordinator");
		this.authenticationManager.currentSessionSubject.subscribe((session) => {
			if (!session) {
				this.lastRemoteRefreshKey = void 0;
				this.lastRemoteRefreshAt = 0;
				this.cloudProductManager.reset();
				this.runInBackground(this.clearRemoteProductOverlay(), "clear remote product overlay after logout");
				this.runInBackground(this.publishResolvedSnapshot(void 0, this.productManager.getLocalConfiguration(), "auth-logout"), "publish resolved snapshot after logout");
				this.runInBackground(this.experimentManager.clear("logout"), "clear experiment product overlay after logout");
			}
		});
		this.productManager.configuration.subscribe(() => {
			const session = this.authenticationManager.currentSessionSubject.getValue();
			const localProduct = this.productManager.getLocalConfiguration();
			this.runInBackground(this.publishResolvedSnapshot(session, localProduct, "local-product-change"), "publish resolved snapshot after local product change");
		});
	}
	async publishResolvedSnapshot(session, product, source = "unspecified") {
		const effectiveSession = session ?? this.authenticationManager.currentSessionSubject.getValue();
		let resolvedSnapshot = require_workbuddy_product_config.buildWorkbuddyResolvedProductConfiguration({
			product: applyProductExperimentOverlay(await this.getResolvedSourceProduct(product) ?? {}, this.experimentManager.getOverlay()),
			session: effectiveSession,
			remoteHasModels: !!this.remoteProductOverlay?.models?.length
		});
		if (require_common$2.shouldReplaceAutoWithTierModels(resolvedSnapshot)) resolvedSnapshot = require_common$2.replaceAutoWithTierModels(resolvedSnapshot);
		if (require_dev_env_override.resolveEndpointOverride()) this.logger.info(`[DevEnvOverride] Active — endpoint=${resolvedSnapshot.endpoint}`);
		const networkEnvironment = resolvedSnapshot.networkEnvironment;
		if (networkEnvironment) process.env[require_common$2.ENV_KEY_CODEBUDDY_COPILOT_INTERNET_ENVIRONMENT] = networkEnvironment;
		else delete process.env[require_common$2.ENV_KEY_CODEBUDDY_COPILOT_INTERNET_ENVIRONMENT];
		const normalizedSnapshot = normalizeJsonValue(resolvedSnapshot);
		const envValue = JSON.stringify(normalizedSnapshot);
		if (envValue === this.lastPublishedEnv) return;
		require_workbuddy_product_config.assignAccProductConfigV3ToProcessEnv(envValue);
		const hostedCliSnapshotKey = hostedCliRotationKeyOfNormalized(normalizedSnapshot);
		const hostedCliRotationChanged = hostedCliSnapshotKey !== this.lastNotifiedHostedCliSnapshotKey;
		this.logResolvedSnapshotChange(source, this.lastPublishedSnapshot, normalizedSnapshot, hostedCliRotationChanged);
		this.lastPublishedEnv = envValue;
		this.lastPublishedSnapshot = normalizedSnapshot;
		this.logger.info(`Published resolved workbuddy product snapshot to ACC_PRODUCT_CONFIG_V3 (source=${source})`);
		if (!hostedCliRotationChanged) {
			this.logger.info(`Skipped hosted CLI product snapshot notification because rotation key is unchanged (source=${source})`);
			return;
		}
		this.lastNotifiedHostedCliSnapshotKey = hostedCliSnapshotKey;
		this.notifyHostedCliProductSnapshotChanged({ envValue }, hostedCliSnapshotKey);
	}
	logResolvedSnapshotChange(source, previousSnapshot, nextSnapshot, hostedCliRotationChanged) {
		const changedPaths = collectJsonChangedPaths(previousSnapshot, nextSnapshot);
		const snapshotForLog = hostedCliRotationChanged ? `, snapshot=${JSON.stringify(nextSnapshot, (key, value) => redactProductSnapshotLogValue(key, value))}` : "";
		this.logger.info(`[ResolvedProductSnapshot] source=${source}, hostedCliRotationChanged=${hostedCliRotationChanged}, changedPaths=${JSON.stringify(changedPaths)}${snapshotForLog}`);
	}
	onHostedCliProductSnapshotChanged(listener) {
		this.hostedCliProductSnapshotChangeListeners.add(listener);
		return { dispose: () => {
			this.hostedCliProductSnapshotChangeListeners.delete(listener);
		} };
	}
	resolveEnvironment(session, product) {
		return require_workbuddy_product_config.resolveWorkbuddyProductEnvironmentFromSession(session, product);
	}
	getResolvedSnapshot(product, session) {
		return require_workbuddy_product_config.buildWorkbuddyResolvedProductConfiguration({
			product,
			session
		});
	}
	async syncResolvedProduct(session) {
		this.syncQueue = this.syncQueue.catch((error) => {
			this.logger.warn(`Previous resolved product sync failed: ${error}`);
		}).then(async () => {
			if (session && this.isSameIdentityWithFreshRemote(session)) return;
			await this.productManager.sync(true);
			if (!session) {
				this.lastRemoteRefreshKey = void 0;
				this.lastRemoteRefreshAt = 0;
				await this.clearRemoteProductOverlay();
				await this.experimentManager.clear("no-session");
				await this.publishResolvedSnapshot(void 0, this.productManager.getLocalConfiguration(), "sync-resolved-product:no-session");
				return;
			}
			await this.publishResolvedSnapshot(session, this.productManager.getLocalConfiguration(), "sync-resolved-product:local-before-remote");
			await this.refreshRemoteProductIfNeeded(session, this.productManager.getLocalConfiguration(), { force: true });
			await this.refreshExperimentProduct(session, this.productManager.getLocalConfiguration());
		});
		return this.syncQueue;
	}
	isSameIdentityWithFreshRemote(session) {
		const localProduct = this.productManager.getLocalConfiguration();
		if (!localProduct) return false;
		const refreshKey = this.getRemoteRefreshKey(session, localProduct);
		return !!refreshKey && refreshKey === this.lastRemoteRefreshKey && Date.now() - this.lastRemoteRefreshAt < 48e4;
	}
	async refreshExperimentProduct(session, localProduct) {
		const gateProduct = require_workbuddy_product_config.buildWorkbuddyResolvedProductConfiguration({
			product: await this.getResolvedSourceProduct(localProduct),
			session,
			remoteHasModels: !!this.remoteProductOverlay?.models?.length
		});
		await this.experimentManager.refresh(gateProduct, session, { force: true });
		await this.publishResolvedSnapshot(session, localProduct, "experiment-refresh");
	}
	async getResolvedSourceProduct(product) {
		if (!product) return this.remoteProductOverlay;
		if (!this.remoteProductOverlay) return product;
		return this.productMerger.merge(product, this.remoteProductOverlay);
	}
	/**
	* 按产品配置 8 分钟 TTL 刷新远端 overlay。
	*
	* `getProductConfiguration()` 读取 resolved product 前会触发 stale refresh，
	* 避免长期复用过期 overlay。
	*/
	async refreshRemoteProduct(options, session) {
		const currentSession = session ?? this.authenticationManager.currentSessionSubject.getValue();
		if (!currentSession) return;
		await this.productManager.waitConfiguration(true);
		await this.refreshRemoteProductIfNeeded(currentSession, this.productManager.getLocalConfiguration(), { force: options?.force });
	}
	async refreshRemoteProductIfStale(session) {
		return this.refreshRemoteProduct(void 0, session);
	}
	/**
	* 为 Connector Marketplace 刷新远端配置并保留结果语义。
	*
	* 普通 refreshRemoteProductIfStale 返回 void；它适合一般 overlay 刷新，但无法让
	* Marketplace 区分“请求失败”与“本次成功但没有对应 URL”。
	*/
	async refreshRemoteProductForConnectorMarketplace(session) {
		const currentSession = session ?? this.authenticationManager.currentSessionSubject.getValue();
		if (!currentSession) return "failed";
		const localProductBeforeReady = this.productManager.getLocalConfiguration();
		if (!this.getRemoteRefreshKey(currentSession, localProductBeforeReady ?? {})) this.logger.info("[RemoteConfig] Connector Marketplace waiting for local product configuration before refresh");
		try {
			await this.productManager.waitConfiguration(true);
		} catch (error) {
			this.logger.warn(`[RemoteConfig] Connector Marketplace local product configuration failed: ${error instanceof Error ? error.message : String(error)}`);
			return "failed";
		}
		const localProduct = this.productManager.getLocalConfiguration();
		if (!localProduct) return "failed";
		const refreshKey = this.getRemoteRefreshKey(currentSession, localProduct);
		if (!refreshKey) {
			this.logger.warn("[RemoteConfig] Connector Marketplace refresh key unavailable after local product configuration became ready");
			return "failed";
		}
		const wasFresh = refreshKey === this.lastRemoteRefreshKey && Date.now() - this.lastRemoteRefreshAt < 48e4;
		const refreshStartedAt = Date.now();
		try {
			await this.refreshRemoteProductIfStale(currentSession);
			await this.waitRemoteReady();
		} catch (error) {
			this.logger.warn(`[RemoteConfig] Connector Marketplace refresh failed: ${error instanceof Error ? error.message : String(error)}`);
			return "failed";
		}
		if (wasFresh) return this.lastRemoteProductConfigurationResolution?.refreshKey === refreshKey ? this.lastRemoteProductConfigurationResolution.resolution : "resolved";
		if (this.lastRemoteProductConfigurationResolution?.refreshKey === refreshKey) return this.lastRemoteProductConfigurationResolution.resolution;
		return this.lastRemoteRefreshKey === refreshKey && this.lastRemoteRefreshAt >= refreshStartedAt ? "resolved" : "failed";
	}
	async refreshRemoteProductIfNeeded(session, product, options) {
		if (!session) return;
		const localProduct = product ?? this.productManager.getLocalConfiguration();
		if (!localProduct) return;
		const refreshKey = this.getRemoteRefreshKey(session, localProduct);
		if (!refreshKey) {
			this.lastRemoteRefreshAt = 0;
			await this.clearRemoteProductOverlay();
			await this.publishResolvedSnapshot(session, localProduct, "remote-refresh:no-key");
			return;
		}
		const inFlight = this.remoteRefreshInFlightByKey.get(refreshKey);
		if (inFlight) {
			if (!options?.force) return inFlight;
			await inFlight.catch(() => void 0);
			return this.refreshRemoteProductIfNeeded(session, localProduct, options);
		}
		const isSameRefreshKey = refreshKey === this.lastRemoteRefreshKey;
		const isRemoteFresh = Date.now() - this.lastRemoteRefreshAt < require_common$2.PRODUCT_CONFIGURATION_CACHE_TIMEOUT;
		if (!options?.force && isSameRefreshKey && isRemoteFresh) return;
		const shouldPreserveOverlayOnFailure = this.lastRemoteRefreshKey === refreshKey;
		this.lastRemoteRefreshKey = refreshKey;
		const refreshPromise = this.remoteSyncQueue.catch((error) => {
			this.logger.warn(`Previous remote product refresh failed: ${error}`);
		}).then(async () => {
			if (!shouldPreserveOverlayOnFailure) {
				await this.clearRemoteProductOverlay();
				await this.publishResolvedSnapshot(session, localProduct, "remote-refresh:key-change-clear-overlay");
			}
			const remoteOverlay = await this.fetchRemoteProductOverlay(localProduct, session);
			if (remoteOverlay === void 0) {
				this.lastRemoteProductConfigurationResolution = {
					refreshKey,
					resolution: "failed"
				};
				return;
			}
			this.remoteProductOverlay = remoteOverlay;
			this.lastRemoteRefreshAt = Date.now();
			this.lastRemoteProductConfigurationResolution = {
				refreshKey,
				resolution: "resolved"
			};
			await this.productManager.setResolvedOverlay(remoteOverlay);
			await this.publishResolvedSnapshot(session, localProduct, "remote-refresh:success");
		});
		this.remoteSyncQueue = refreshPromise;
		this.remoteRefreshInFlightByKey.set(refreshKey, refreshPromise);
		refreshPromise.finally(() => {
			if (this.remoteRefreshInFlightByKey.get(refreshKey) === refreshPromise) this.remoteRefreshInFlightByKey.delete(refreshKey);
		}).catch(() => void 0);
		return refreshPromise;
	}
	async clearRemoteProductOverlay() {
		if (!this.remoteProductOverlay) return;
		this.remoteProductOverlay = void 0;
		await this.productManager.setResolvedOverlay(void 0);
	}
	getRemoteRefreshKey(session, product) {
		if (product.config?.disabled) return;
		if (!product.endpoint && !product.config?.url) return;
		return [
			session.account?.uid ?? "",
			session.account?.type ?? "",
			session.account?.enterpriseId ?? "",
			session.account?.oneidAccountId ?? "",
			session.account?.idp ?? "",
			product.endpoint ?? "",
			product.config?.url ?? DEFAULT_REMOTE_CONFIG_PATH,
			product.networkEnvironment ?? "",
			session.auth?.domain ?? ""
		].join("|");
	}
	async fetchRemoteProductOverlay(product, session) {
		const configUrl = product.config?.url ?? DEFAULT_REMOTE_CONFIG_PATH;
		const endpoint = this.productManager.getEndpoint();
		const xProduct = this.productManager.getCurrentConfiguration()?.deploymentType ?? this.productManager.configuration.getValue()?.deploymentType ?? "SaaS";
		const startedAt = Date.now();
		this.logger.info(`[RemoteConfig] Fetch start: configUrl=${configUrl}, endpoint=${endpoint || "undefined"}, xProduct=${xProduct}, domain=${session?.auth?.domain || "undefined"}, networkEnvironment=${product.networkEnvironment || "undefined"}`);
		try {
			const remoteProduct = await this.cloudProductManager.fetch(configUrl);
			const sanitized = this.omitRemoteExcludedFields(remoteProduct);
			if (!hasRemoteProductPayload(sanitized)) {
				this.logger.warn(`[RemoteConfig] Fetch returned empty/invalid config in ${Date.now() - startedAt}ms, preserving previous overlay`);
				return;
			}
			const remoteCommandsSmartMerge = remoteProduct.productFeatures?.CommandsSmartMerge;
			const localCommandsSmartMerge = product.productFeatures?.CommandsSmartMerge;
			const useCommandsSmartMerge = (remoteCommandsSmartMerge ?? localCommandsSmartMerge) === true;
			const mergeStrategy = useCommandsSmartMerge ? require_common$2.MergeStrategy.CommandsSmartMerge : require_common$2.MergeStrategy.Merge;
			const remoteModelsCount = remoteProduct.models?.length ?? 0;
			const remoteAgentsCount = remoteProduct.agents?.length ?? 0;
			const localModelsCount = product.models?.length ?? 0;
			const localAgentsCount = product.agents?.length ?? 0;
			this.logger.info(`[RemoteConfig] Fetch success in ${Date.now() - startedAt}ms: keys=${Object.keys(remoteProduct ?? {}).join(",") || "(empty)"}, remoteModels=${remoteModelsCount}, localModels=${localModelsCount}, remoteAgents=${remoteAgentsCount}, localAgents=${localAgentsCount}, mergeStrategy=${useCommandsSmartMerge ? "CommandsSmartMerge" : "Merge"}`);
			if (!!product.productFeatures?.[require_common$2.ProductFeature.CloudAgentsSmartMerge] && !!sanitized.agents && !!product.agents) {
				const beforeCount = sanitized.agents.length;
				sanitized.agents = this.smartMergeAgents(product.agents, sanitized.agents);
				const cliAgent = sanitized.agents.find((a) => a.name === "cli");
				this.logger.info(`[RemoteConfig] Agents SmartMerge: local=${localAgentsCount}, remote=${beforeCount}, merged=${sanitized.agents.length}` + (cliAgent ? `, cli.models=${JSON.stringify(cliAgent.models)}` : ""));
			}
			return {
				...sanitized,
				mergeStrategy
			};
		} catch (error) {
			this.logger.warn(`[RemoteConfig] Fetch failed in ${Date.now() - startedAt}ms: configUrl=${configUrl}, endpoint=${endpoint || "undefined"}, xProduct=${xProduct}, domain=${session?.auth?.domain || "undefined"}, error=${error}`);
			return;
		}
	}
	omitRemoteExcludedFields(config) {
		if (!config) return config;
		const sanitized = { ...config };
		delete sanitized.endpoint;
		delete sanitized.stagingEndpoint;
		for (const field of REMOTE_CONFIG_EXCLUDE_FIELDS) Reflect.deleteProperty(sanitized, field);
		return sanitized;
	}
	runInBackground(task, label) {
		task.catch((error) => {
			this.logger.warn(`Failed to ${label}: ${error}`);
		});
	}
	notifyHostedCliProductSnapshotChanged(event, notifiedKey) {
		for (const listener of this.hostedCliProductSnapshotChangeListeners) this.runInBackground(Promise.resolve(listener(event)).then(() => void 0).catch((error) => {
			if (this.lastNotifiedHostedCliSnapshotKey === notifiedKey) this.lastNotifiedHostedCliSnapshotKey = void 0;
			throw error;
		}), "handle hosted CLI product snapshot change");
	}
	/**
	* 按 name 对 agents 做 SmartMerge：
	* - 远端有、本地也有 → 以本地为基底，本地缺失的字段从云端补充，models 强制使用远端的
	* - 远端有、本地没有 → 追加
	* - 本地有、远端没有 → 保留
	*/
	smartMergeAgents(localAgents, remoteAgents) {
		const result = localAgents.map((agent) => ({ ...agent }));
		for (const remoteAgent of remoteAgents) {
			const idx = result.findIndex((a) => a.name === remoteAgent.name);
			if (idx >= 0) {
				const merged = {
					...remoteAgent,
					...result[idx]
				};
				if (remoteAgent.models !== void 0) merged.models = remoteAgent.models;
				result[idx] = merged;
			} else result.push(remoteAgent);
		}
		return result;
	}
};
require_common$2.__decorate([(0, import_common$1.Autowired)(import_common$1.Logger), require_common$2.__decorateMetadata("design:type", typeof (_ref = typeof import_common$1.Logger !== "undefined" && import_common$1.Logger) === "function" ? _ref : Object)], WorkbuddyAuthProductCoordinator.prototype, "logger", void 0);
require_common$2.__decorate([(0, import_common$1.Autowired)(require_common$2.AuthenticationManager), require_common$2.__decorateMetadata("design:type", typeof (_ref2 = typeof require_common$2.AuthenticationManager !== "undefined" && require_common$2.AuthenticationManager) === "function" ? _ref2 : Object)], WorkbuddyAuthProductCoordinator.prototype, "authenticationManager", void 0);
require_common$2.__decorate([(0, import_common$1.Autowired)(require_common$2.ProductManager), require_common$2.__decorateMetadata("design:type", typeof (_ref3 = typeof WorkbuddyProductManager !== "undefined" && WorkbuddyProductManager) === "function" ? _ref3 : Object)], WorkbuddyAuthProductCoordinator.prototype, "productManager", void 0);
require_common$2.__decorate([(0, import_common$1.Autowired)(require_common$2.ProductMerger), require_common$2.__decorateMetadata("design:type", typeof (_ref4 = typeof require_common$2.ProductMerger !== "undefined" && require_common$2.ProductMerger) === "function" ? _ref4 : Object)], WorkbuddyAuthProductCoordinator.prototype, "productMerger", void 0);
require_common$2.__decorate([(0, import_common$1.Autowired)(require_common$2.CloudProductManager), require_common$2.__decorateMetadata("design:type", typeof (_ref5 = typeof require_common$2.CloudProductManager !== "undefined" && require_common$2.CloudProductManager) === "function" ? _ref5 : Object)], WorkbuddyAuthProductCoordinator.prototype, "cloudProductManager", void 0);
require_common$2.__decorate([(0, import_common$1.Autowired)(WorkbuddyProductExperimentManager), require_common$2.__decorateMetadata("design:type", typeof (_ref6 = typeof WorkbuddyProductExperimentManager !== "undefined" && WorkbuddyProductExperimentManager) === "function" ? _ref6 : Object)], WorkbuddyAuthProductCoordinator.prototype, "experimentManager", void 0);
require_common$2.__decorate([
	(0, import_common$1.PostConstruct)(),
	require_common$2.__decorateMetadata("design:type", Function),
	require_common$2.__decorateMetadata("design:paramtypes", []),
	require_common$2.__decorateMetadata("design:returntype", void 0)
], WorkbuddyAuthProductCoordinator.prototype, "init", null);
WorkbuddyAuthProductCoordinator = require_common$2.__decorate([(0, import_common$1.Component)()], WorkbuddyAuthProductCoordinator);
//#endregion
//#region ../../packages/workbuddy-server/src/net/tls-verification.ts
/**
* 进程级 TLS 证书校验关闭工具。
*
* 与 IDE / CLI（`agent-cli` 的 `ProxyUtils.disableTlsVerification`）行为对齐：当 product 配置
* `ProductFeature.DisableTlsVerification = true` 时，设置进程级 `NODE_TLS_REJECT_UNAUTHORIZED='0'`，
* 使 Node 侧所有 HTTPS 请求（AuthService / RestOperations / undici fetch / 裸 axios / cloud-repo）
* 跳过证书校验。已确认上述链路创建的 `https.Agent` / undici dispatcher 均未显式设置
* `rejectUnauthorized`，故只设该全局环境变量即可全量生效，无需逐个改 agent。
*
* 归属 `workbuddy-server/net` 模块，不跨 import `agent-cli` 的 `ProxyUtils`（包归属边界），
* 逻辑与其等价（仅设 env + 抑制噪声告警）。
*/
var tlsLog = { info: (...args) => console.info(...args) };
/** process.emitWarning 拦截器只装一次；保留原实现用于测试还原。 */
var originalEmitWarning;
/**
* 幂等关闭进程级 TLS 证书校验。
*
* 已为 '0' 时直接返回，不重复打日志，避免运行期配置多次发布时刷屏。
*
* @param reason 触发来源（如 'ProductFeature.DisableTlsVerification' / 'bootstrap'），仅用于日志。
*/
function disableTlsVerificationForProcess(reason) {
	if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") return;
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
	tlsLog.info(`[TlsVerification] NODE_TLS_REJECT_UNAUTHORIZED set to "0" (reason=${reason})`);
}
/**
* 抑制 Node 的 `NODE_TLS_REJECT_UNAUTHORIZED` 噪声告警（参考 `agent-cli/src/node/shim.ts`）。
*
* 一旦设置了该环境变量，Node 的 TLS 模块会在每次连接时通过 `process.emitWarning` 输出告警，
* 对客户端用户而言是无意义的噪声。必须在 `emitWarning` 层拦截 —— 默认告警打印器在 C++ 层
* 先于任何 'warning' 事件监听器执行。
*
* 幂等：重复调用只装一次拦截器。
*/
function suppressTlsRejectWarning() {
	if (originalEmitWarning) return;
	originalEmitWarning = process.emitWarning;
	const origEmitWarning = originalEmitWarning;
	process.emitWarning = function(warning, ...args) {
		const msg = typeof warning === "string" ? warning : warning?.message;
		if (typeof msg === "string" && msg.includes("NODE_TLS_REJECT_UNAUTHORIZED")) return;
		return origEmitWarning.call(process, warning, ...args);
	};
}
//#endregion
Object.defineProperty(exports, "WorkbuddyAuthProductCoordinator", {
	enumerable: true,
	get: function() {
		return WorkbuddyAuthProductCoordinator;
	}
});
Object.defineProperty(exports, "disableTlsVerificationForProcess", {
	enumerable: true,
	get: function() {
		return disableTlsVerificationForProcess;
	}
});
Object.defineProperty(exports, "getImaConnectorName", {
	enumerable: true,
	get: function() {
		return getImaConnectorName;
	}
});
Object.defineProperty(exports, "getImaConnectorNameFromProduct", {
	enumerable: true,
	get: function() {
		return getImaConnectorNameFromProduct;
	}
});
Object.defineProperty(exports, "suppressTlsRejectWarning", {
	enumerable: true,
	get: function() {
		return suppressTlsRejectWarning;
	}
});
