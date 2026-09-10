const require_chunk = require("./chunk.js");
const require_common = require("./common.js");
let fs = require("fs");
fs = require_chunk.__toESM(fs);
//#region ../../packages/workbuddy-server/src/agent/cli-product-env.ts
function resolveAgentCliProductEnv({ processEnv = process.env, productConfigEnv, productConfigPathEnv, fallbackProductConfigEnv, fallbackProductConfigPathEnv } = {}) {
	const resolvedProductConfigPathEnv = productConfigPathEnv ?? processEnv["ACC_PRODUCT_CONFIG_PATH"] ?? fallbackProductConfigPathEnv;
	const resolvedProductConfigEnv = productConfigEnv ?? (resolvedProductConfigPathEnv ? void 0 : processEnv.ACC_PRODUCT_CONFIG_V3) ?? (resolvedProductConfigPathEnv ? void 0 : fallbackProductConfigEnv);
	const env = {
		ACC_PRODUCT_CONFIG_V3: resolvedProductConfigEnv,
		[AGENT_CLI_PRODUCT_CONFIG_PATH_ENV_KEY]: resolvedProductConfigPathEnv
	};
	applyAgentCliHostedProductEnvironment(env, processEnv);
	return {
		productConfigEnv: resolvedProductConfigEnv,
		productConfigPathEnv: resolvedProductConfigPathEnv,
		hostedCliInternetEnv: env[AGENT_CLI_HOSTED_INTERNET_ENVIRONMENT_KEY]
	};
}
async function resolveAgentCliProductEnvAsync({ processEnv = process.env, productConfigEnv, productConfigPathEnv, fallbackProductConfigEnv, fallbackProductConfigPathEnv } = {}) {
	const resolvedProductConfigPathEnv = productConfigPathEnv ?? processEnv["ACC_PRODUCT_CONFIG_PATH"] ?? fallbackProductConfigPathEnv;
	const resolvedProductConfigEnv = productConfigEnv ?? (resolvedProductConfigPathEnv ? void 0 : processEnv.ACC_PRODUCT_CONFIG_V3) ?? (resolvedProductConfigPathEnv ? void 0 : fallbackProductConfigEnv);
	const env = {
		ACC_PRODUCT_CONFIG_V3: resolvedProductConfigEnv,
		[AGENT_CLI_PRODUCT_CONFIG_PATH_ENV_KEY]: resolvedProductConfigPathEnv
	};
	await applyAgentCliHostedProductEnvironmentAsync(env, processEnv);
	return {
		productConfigEnv: resolvedProductConfigEnv,
		productConfigPathEnv: resolvedProductConfigPathEnv,
		hostedCliInternetEnv: env[AGENT_CLI_HOSTED_INTERNET_ENVIRONMENT_KEY]
	};
}
function applyAgentCliHostedProductEnvironment(env, processEnv = process.env) {
	const networkEnvironment = resolveAgentCliHostedInternetEnvironment(env, processEnv);
	if (networkEnvironment) env[AGENT_CLI_HOSTED_INTERNET_ENVIRONMENT_KEY] = networkEnvironment;
	else delete env[AGENT_CLI_HOSTED_INTERNET_ENVIRONMENT_KEY];
	return env;
}
async function applyAgentCliHostedProductEnvironmentAsync(env, processEnv = process.env) {
	const networkEnvironment = await resolveAgentCliHostedInternetEnvironmentAsync(env, processEnv);
	if (networkEnvironment) env[AGENT_CLI_HOSTED_INTERNET_ENVIRONMENT_KEY] = networkEnvironment;
	else delete env[AGENT_CLI_HOSTED_INTERNET_ENVIRONMENT_KEY];
	return env;
}
function resolveAgentCliHostedInternetEnvironment(env, processEnv = process.env) {
	const mergedEnv = env ? {
		...processEnv,
		...env
	} : processEnv;
	for (const key of AGENT_CLI_PRODUCT_CONFIG_ENV_KEYS) {
		const configValue = readAgentCliProductConfigJsonByKey(key, mergedEnv);
		if (!configValue) continue;
		try {
			const networkEnvironment = JSON.parse(configValue)?.networkEnvironment;
			if (isAgentCliProductEnvironment(networkEnvironment)) return networkEnvironment;
		} catch {}
	}
	const currentEnvironment = processEnv[require_common.ENV_KEY_CODEBUDDY_COPILOT_INTERNET_ENVIRONMENT];
	if (isAgentCliProductEnvironment(currentEnvironment)) return currentEnvironment;
}
async function resolveAgentCliHostedInternetEnvironmentAsync(env, processEnv = process.env) {
	const mergedEnv = env ? {
		...processEnv,
		...env
	} : processEnv;
	for (const key of AGENT_CLI_PRODUCT_CONFIG_ENV_KEYS) {
		const configValue = await readAgentCliProductConfigJsonByKeyAsync(key, mergedEnv);
		if (!configValue) continue;
		try {
			const networkEnvironment = JSON.parse(configValue)?.networkEnvironment;
			if (isAgentCliProductEnvironment(networkEnvironment)) return networkEnvironment;
		} catch {}
	}
	const currentEnvironment = processEnv[require_common.ENV_KEY_CODEBUDDY_COPILOT_INTERNET_ENVIRONMENT];
	if (isAgentCliProductEnvironment(currentEnvironment)) return currentEnvironment;
}
function readAgentCliProductConfigJsonByKey(key, env = process.env) {
	const inline = env[key];
	if (inline) return inline;
	if (key !== "ACC_PRODUCT_CONFIG_V3") return;
	const filePath = env[AGENT_CLI_PRODUCT_CONFIG_PATH_ENV_KEY];
	if (!filePath) return;
	try {
		return fs.readFileSync(filePath, "utf8");
	} catch {
		return;
	}
}
async function readAgentCliProductConfigJsonByKeyAsync(key, env = process.env) {
	const inline = env[key];
	if (inline) return inline;
	if (key !== "ACC_PRODUCT_CONFIG_V3") return;
	const filePath = env[AGENT_CLI_PRODUCT_CONFIG_PATH_ENV_KEY];
	if (!filePath) return;
	try {
		return await fsp.readFile(filePath, "utf8");
	} catch {
		return;
	}
}
function isAgentCliProductEnvironment(value) {
	return typeof value === "string" && Object.values(require_common.ProductEnviroment).includes(value);
}
var fsp, AGENT_CLI_PRODUCT_CONFIG_ENV_KEYS, AGENT_CLI_PRODUCT_CONFIG_PATH_ENV_KEY, AGENT_CLI_HOSTED_INTERNET_ENVIRONMENT_KEY;
var init_cli_product_env = require_chunk.__esmMin((() => {
	require_common.init_common();
	fsp = fs.promises;
	AGENT_CLI_PRODUCT_CONFIG_ENV_KEYS = ["ACC_PRODUCT_CONFIG_V3", "ACC_PRODUCT_CONFIG_V2"];
	AGENT_CLI_PRODUCT_CONFIG_PATH_ENV_KEY = "ACC_PRODUCT_CONFIG_PATH";
	AGENT_CLI_HOSTED_INTERNET_ENVIRONMENT_KEY = "CODEBUDDY_INTERNET_ENVIRONMENT";
}));
//#endregion
Object.defineProperty(exports, "AGENT_CLI_HOSTED_INTERNET_ENVIRONMENT_KEY", {
	enumerable: true,
	get: function() {
		return AGENT_CLI_HOSTED_INTERNET_ENVIRONMENT_KEY;
	}
});
Object.defineProperty(exports, "AGENT_CLI_PRODUCT_CONFIG_ENV_KEYS", {
	enumerable: true,
	get: function() {
		return AGENT_CLI_PRODUCT_CONFIG_ENV_KEYS;
	}
});
Object.defineProperty(exports, "AGENT_CLI_PRODUCT_CONFIG_PATH_ENV_KEY", {
	enumerable: true,
	get: function() {
		return AGENT_CLI_PRODUCT_CONFIG_PATH_ENV_KEY;
	}
});
Object.defineProperty(exports, "init_cli_product_env", {
	enumerable: true,
	get: function() {
		return init_cli_product_env;
	}
});
Object.defineProperty(exports, "readAgentCliProductConfigJsonByKey", {
	enumerable: true,
	get: function() {
		return readAgentCliProductConfigJsonByKey;
	}
});
Object.defineProperty(exports, "resolveAgentCliProductEnv", {
	enumerable: true,
	get: function() {
		return resolveAgentCliProductEnv;
	}
});
Object.defineProperty(exports, "resolveAgentCliProductEnvAsync", {
	enumerable: true,
	get: function() {
		return resolveAgentCliProductEnvAsync;
	}
});
