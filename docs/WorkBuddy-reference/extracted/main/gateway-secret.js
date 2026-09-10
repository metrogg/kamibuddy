require("./chunk.js");
let crypto = require("crypto");
//#region ../../packages/workbuddy-server/src/agent/gateway-secret.ts
/**
* Sidecar Gateway Secret (CNVD-ZC-2026-6234 修复)
*
* WorkBuddy Desktop spawn 的 `codebuddy --serve` sidecar 在 127.0.0.1 随机端口暴露
* `/api/v1/*`（process 执行 / fs / pty / sessions / file-version / plugins）。这些
* REST 端点经 `requireAuth` 鉴权，但桌面端历史上注入 `CODEBUDDY_GATEWAY_AUTH=none`
* 关掉了认证，导致同机任意进程可未授权 RCE。
*
* 修复方式：复用 agent-cli 既有的 password / Bearer 认证。
*   - workbuddy-server 进程内生成**一个**随机 secret（本模块单例）。
*   - 两个 env builder（buildCliEnv / buildAgentCliRuntimeEnv）把它作为
*     CODEBUDDY_GATEWAY_PASSWORD 注入，并把 CODEBUDDY_GATEWAY_AUTH 设为 'password'。
*   - 所有 in-process REST 调用方（session-replay / sandbox / expert / pulse）通过
*     `gatewaySecretHeaders()` 带上 `Authorization: Bearer <secret>`。
*
* 注意：
*   - ACP 主通道（/api/v1/acp）走 AcpSecurityMiddleware 的 loopback 豁免，无需 secret。
*   - /internal/*（hooks/services/invoke、plugin/*）与 /api/v1/llm/completions 不经
*     requireAuth，本身不对外暴露，缺 secret 也照常放行。
*
* secret 仅存于本进程内存，不落盘、不进 settings。spawn 方与连接方同进程树，
* 同机其他进程无法读取（只能尝试本地端口，但缺 Bearer 会被 401 拦截）。
*/
/** Bearer/password 头名（与 agent-cli GatewayAuthMiddleware 一致） */
var GATEWAY_AUTH_MODE_ENV = "CODEBUDDY_GATEWAY_AUTH";
var GATEWAY_PASSWORD_ENV = "CODEBUDDY_GATEWAY_PASSWORD";
/** 关闭 Swagger UI / OpenAPI 文档暴露（CNVD-ZC-2026-6234 修复建议 5）。 */
var GATEWAY_DISABLE_API_DOCS_ENV = "CODEBUDDY_GATEWAY_DISABLE_API_DOCS";
var cachedSecret;
/**
* 获取本进程的 sidecar gateway secret（首次调用时惰性生成）。
*
* 单例语义保证：无论有几个 SidecarManager 实例、host-runtime serve 还是
* per-session serve，整个 workbuddy-server 进程共享同一个 secret。
*/
function getGatewaySecret() {
	if (!cachedSecret) cachedSecret = (0, crypto.randomBytes)(32).toString("base64url");
	return cachedSecret;
}
/**
* 注入到 sidecar 子进程 env 的认证片段。
* 由 env builder 在最后 spread，覆盖历史的 `CODEBUDDY_GATEWAY_AUTH:'none'`。
*/
function gatewaySecretEnv() {
	return {
		[GATEWAY_AUTH_MODE_ENV]: "password",
		[GATEWAY_PASSWORD_ENV]: getGatewaySecret(),
		[GATEWAY_DISABLE_API_DOCS_ENV]: "1"
	};
}
/**
* in-process REST 调用方应携带的认证头。
* 合并到现有 headers（如 x-codebuddy-request）之上。
*/
function gatewaySecretHeaders() {
	return { Authorization: `Bearer ${getGatewaySecret()}` };
}
//#endregion
Object.defineProperty(exports, "gatewaySecretEnv", {
	enumerable: true,
	get: function() {
		return gatewaySecretEnv;
	}
});
Object.defineProperty(exports, "gatewaySecretHeaders", {
	enumerable: true,
	get: function() {
		return gatewaySecretHeaders;
	}
});
Object.defineProperty(exports, "getGatewaySecret", {
	enumerable: true,
	get: function() {
		return getGatewaySecret;
	}
});
