import { n as __esmMin } from "./rolldown-runtime-D5a2oYpF.js";
import { Bu as deriveLexiangVpcWebOriginFromEndpoint, Cu as init_lexiang_auth_constants, Fu as init_constants, Mu as LEXIANG_PAGE_PREVIEW_UI_QUERY, Ru as LEXIANG_WEB_ORIGIN_PROD, Su as LEXIANG_OAUTH_NAME, Vu as isVpcEndpointHost, ju as LEXIANG_LIBRARY_EMBED_UI_QUERY } from "./ui-docs-viewer-C2jT2eXi.js";
import { Ou as require_jsx_runtime, ku as require_react } from "./lib-chat-ui-ChIVprRk.js";
import { _ as refreshLexiangConnectorTokenOnce, d as init_catalog_service, f as callSpApi, g as init_auth_refresh, h as init_mcp_client, m as unwrapData, n as init_entry_service, p as init_spapi_client, v as init_auth_error, y as isLexiangAuthExpiredCode } from "./entry-service-CYRgnsAK.js";
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/api/asset-service.ts
/**
* 判断一个 logo URL 是否可以直接作为 img src 展示（无需 API 解析）。
*
* 规则：URL 路径部分（去掉查询参数后）以 `.{ext}` 结尾即可直接展示，
* 例如 `https://static.lexiang-asset.com/kb/assets/logos/space/51.png`。
* 而 `/assets/{hex-id}?company_from=xxx` 这种不含扩展名的需要解析。
*
* 注意：还会校验 URL 基本格式（如域名后需有有效路径），
* 防止格式异常的 URL（如域名后缺少 / 导致路径被拼入 hostname）被误判为可用。
*/
function isDirectlyUsableLogoUrl(url) {
	if (!url) return false;
	try {
		const parsed = new URL(url);
		if (parsed.hostname.length > 60) return false;
		return /\.\w{2,5}$/.test(parsed.pathname);
	} catch {
		return /\.\w{2,5}(\?|#|$)/.test(url);
	}
}
/**
* 解析乐享知识库 logo URL。
*
* 规则：
* - 如果 logo 地址格式为 `https://{host}/assets/{id}(可选?查询参数)`，需要通过 spapi 解析换取真实图片地址。
* - 如果不是上述格式（含文件扩展名），直接返回原始 URL。
* - 返回 null 表示无法解析或无 logo。
*/
async function resolveSpaceLogoUrl(logo) {
	if (!logo) return null;
	if (logoUrlCache.has(logo)) {
		const cached = logoUrlCache.get(logo) ?? null;
		if (cached !== null) return cached;
		const failedTime = logoFailedAt.get(logo);
		if (failedTime && Date.now() - failedTime < LOGO_RETRY_INTERVAL) return null;
		logoUrlCache.delete(logo);
		logoFailedAt.delete(logo);
	}
	if (!(!isDirectlyUsableLogoUrl(logo) && /\/assets\/[^./]+(\?|$)/i.test(logo))) {
		logoUrlCache.set(logo, logo);
		return logo;
	}
	const assetId = logo.match(/\/assets\/([^./?]+)(\?|$)/i)?.[1];
	if (!assetId) {
		logoUrlCache.set(logo, logo);
		return logo;
	}
	try {
		const resolvedUrl = unwrapData(await callSpApi({ path: `/spapi/driver/v1/assets/${encodeURIComponent(assetId)}` }))?.url ?? null;
		if (resolvedUrl) {
			try {
				const parsed = new URL(resolvedUrl);
				if (parsed.pathname.length <= 1) {
					console.warn("[lexiang-api] resolveSpaceLogoUrl: suspicious URL, no path:", resolvedUrl);
					logoUrlCache.set(logo, null);
					logoFailedAt.set(logo, Date.now());
					return null;
				}
				if (parsed.hostname.length > 60) {
					console.warn("[lexiang-api] resolveSpaceLogoUrl: hostname too long, likely missing / in URL:", resolvedUrl);
					logoUrlCache.set(logo, null);
					logoFailedAt.set(logo, Date.now());
					return null;
				}
			} catch {
				console.warn("[lexiang-api] resolveSpaceLogoUrl: invalid URL returned:", resolvedUrl);
				logoUrlCache.set(logo, null);
				logoFailedAt.set(logo, Date.now());
				return null;
			}
			logoUrlCache.set(logo, resolvedUrl);
		} else {
			logoUrlCache.set(logo, null);
			logoFailedAt.set(logo, Date.now());
		}
		return resolvedUrl;
	} catch (e) {
		console.warn("[lexiang-api] resolveSpaceLogoUrl failed:", e);
		logoUrlCache.set(logo, null);
		logoFailedAt.set(logo, Date.now());
		return null;
	}
}
/** 失效指定 logo key 的缓存（用于图片加载失败后重试） */
function invalidateLogoUrlCache(logo) {
	if (!logo) return;
	logoUrlCache.delete(logo);
	logoFailedAt.delete(logo);
}
var logoUrlCache, LOGO_RETRY_INTERVAL, logoFailedAt;
var init_asset_service = __esmMin((() => {
	init_spapi_client();
	logoUrlCache = /* @__PURE__ */ new Map();
	LOGO_RETRY_INTERVAL = 1e4;
	logoFailedAt = /* @__PURE__ */ new Map();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/api/auth-service.ts
/**
* 调用免登接口，把原始乐享 URL 转换成带一次性登录态的 URL。
*
* 注意：本期后端接口仅消费 `intend_url` 一个字段，不再透传 `file_id` / `open_type`。
*
* 401/41 自动恢复（仅 native 模式）：
* 第一次请求失败且命中 auth-like 错误码时，通过 single-flight token refresh
* 刷新乐享 token 并重试原请求一次；仍失败才抛错。
* iframe 模式走 B 端企业免登（OneID），不自动刷新 C 端 OAuth token。
*
* @param adapter           IAgentAdapter 实例（用于发起 temp-login-url IPC）
* @param params.intendUrl  原始乐享页面 URL（必填）
* @param params.mode       iframe 走 B 端企业免登，native 保持 C 端 OAuth 免登
* @returns 后端签发的 login_url
*/
async function fetchLexiangTempLoginUrl(adapter, params) {
	const body = { intend_url: params.intendUrl };
	const doRequest = async () => {
		const resp = params.mode === "iframe" ? await fetchEnterpriseTempLoginUrl(adapter, body) : await fetchOauthTempLoginUrl(adapter, body);
		if (resp?.code !== 0) throw new TempLoginUrlError(`[lexiang-auth] temp-login-url 失败: ${resp?.msg ?? "unknown"} (code=${resp?.code})`, resp?.code);
		const loginUrl = resp.data?.login_url;
		if (!loginUrl) throw new Error("[lexiang-auth] temp-login-url 返回 data.login_url 为空");
		return loginUrl;
	};
	try {
		return await doRequest();
	} catch (firstError) {
		if (!(firstError instanceof TempLoginUrlError && isLexiangAuthExpiredCode(firstError.respCode)) || params.mode !== "native") throw firstError;
		try {
			await refreshLexiangConnectorTokenOnce(adapter);
		} catch {
			throw firstError;
		}
		return doRequest();
	}
}
/**
* 已知是 VPC（专享版）账号时，从 endpoint 派生乐享 Web origin。
*
* 防御性后缀白名单：即便调用方 `isVpcAccount` 判定不严格（如把 SaaS exclusive
* 套餐当 VPC 部署），也只对命中 `isVpcEndpointHost` 的 endpoint 派生 `-lx` 子域名，
* 避免对 SaaS 域名（如 `copilot.tencent.com`）派生不存在的 `-lx` 子域名。
*
* 线上 VPC endpoint 形如 `zxonline070122.copilot.qq.com`，预发形如
* `*.copilot-staging.qq.com`；SaaS 域名不在白名单，返回 undefined 由调用方兜底。
*
* 与 `deriveLexiangVpcWebOriginFromEndpoint`（origins.ts，给 license / company-status 用）
* 的区别：本函数仅在调用方已确认 `isVpcAccount === true` 时调用，而前者在无 account
* 上下文的场景下也能安全派生（同样基于 `isVpcEndpointHost` 后缀白名单防御）。
*
* 安全前提：本函数仅做 HTTPS / 非 IP / 后缀白名单等格式校验，不校验域名归属。
* 调用方须保证 endpoint 来自受信 daemon 产品配置（如 `imaBridge.getProductEndpoint`），
* 不可来自用户输入，否则可能将任意 `*.copilot.qq.com` 子域派生出对应的 `-lx` origin。
*/
function deriveLexiangWebOriginForVpcAccount(endpoint) {
	const rawEndpoint = endpoint?.trim();
	if (!rawEndpoint) return;
	try {
		const url = new URL(rawEndpoint);
		if (url.protocol !== "https:") return;
		const host = url.hostname;
		if (!isVpcEndpointHost(host)) return;
		const labels = host.split(".");
		if (!labels[0]) return;
		if (!labels[0].endsWith("-lx")) labels[0] = `${labels[0]}-lx`;
		const port = url.port ? `:${url.port}` : "";
		return `${url.protocol}//${labels.join(".")}${port}`;
	} catch {
		return;
	}
}
/**
* 专享版私有化（Issue #65281）：把 /v3/config 下发的乐享私有域名归一化成 origin。
*
* 下发值现在为**带协议的完整 origin**（且私有化环境可能是 `http://`，
* 如 `http://wbtest.lexiang-app.com`）——此时**保留下发的协议**，仅取其 origin
* （去掉路径 / query），不强制升到 https，否则会指到不存在的 https 端口。
* 为兼容历史裸主机名，无协议时按 https 补全。
*
* 非法值返回 undefined 由调用方回退。
* 安全前提：lexiangHost 来自受信 daemon 产品配置（/v3/config 下发），不来自用户输入。
*/
function buildLexiangPrivateOrigin(lexiangHost) {
	const raw = lexiangHost?.trim();
	if (!raw) return;
	try {
		if (/^https?:\/\//i.test(raw)) return new URL(raw).origin;
		return new URL(`https://${raw}`).origin;
	} catch {
		return;
	}
}
/**
* 根据宿主环境选择 B 端乐享域名。
*
* - 专享版私有化（Issue #65281）：`/v3/config` 下发 `lexiangHost` 时**最高优先级**，
*   直接用其归一化后的 origin（保留下发协议，可能是 http），不再走 endpoint 派生 / SaaS 兜底。
* - `isVpcAccount` 为 true（专享版 / VPC）时：无论 staging / prod，都从当前 endpoint
*   派生 `*-lx` 子域名，派生失败兜底 `LEXIANG_WEB_ORIGIN_PROD`。
* - 非 VPC 账号（旗舰版 / 个人版）保持原逻辑：
*   - `isStaging` 由调用方从 IMA bridge 读取（宿主侧基于产品配置 endpoint 判断）。
*   - `true` → 优先派生 VPC staging `*-lx.copilot-staging.qq.com`；无法派生时走
*     `LEXIANG_WEB_ORIGIN_STAGING`（`lexiangla.net`，绑定 OneID 741 测试环境）。
*   - `false` → 兜底 `LEXIANG_WEB_ORIGIN_PROD`（`lexiangla.com`），以"能加载出正式环境看板"为优先。
*
* 注意：B 端看板两种模式（主看板 / 指定空间）都走同一个 helper，保证域名一致。
*/
function resolveLexiangBOrigin(isStaging, endpoint, isVpcAccount, lexiangHost) {
	const privateOrigin = buildLexiangPrivateOrigin(lexiangHost);
	if (privateOrigin) return privateOrigin;
	if (isVpcAccount) return deriveLexiangWebOriginForVpcAccount(endpoint) ?? "https://lexiangla.com";
	if (!isStaging) return LEXIANG_WEB_ORIGIN_PROD;
	return deriveLexiangVpcWebOriginFromEndpoint(endpoint) ?? "https://lexiangla.net";
}
async function resolveProductEndpoint(adapter, isStaging, endpoint) {
	const explicitEndpoint = endpoint?.trim();
	if (explicitEndpoint) return explicitEndpoint;
	try {
		const product = await adapter.getProductConfiguration?.();
		return (isStaging ? product?.stagingEndpoint ?? product?.endpoint : product?.endpoint)?.trim() || void 0;
	} catch {
		return;
	}
}
/**
* 专享版私有化（Issue #65281）：读取 `/v3/config` 下发的乐享私有域名 `lexiangHost`。
*
* 与 docHost 走 React `usePrivateHost()` hook 不同，乐享 URL 构建是 service 层异步流程，
* 本函数直接复用 `adapter.getProductConfiguration()` 通道读取，避免绕道组件 hook 把私有域名
* 塞进 iframe 的 effect deps（否则 config 异步 ready 会触发 iframe 重载 / 闪烁）。二者共用
* 同一数据源 `getProductConfiguration().privateHost`。
*
* 调用方显式传入 `explicit` 时优先（便于单测注入），否则从产品配置读取；均无则 undefined，
* 由 `resolveLexiangBOrigin` 回退 endpoint 派生 / SaaS 兜底。
*/
async function resolveLexiangPrivateHost(adapter, explicit) {
	const trimmed = explicit?.trim();
	if (trimmed) return trimmed;
	try {
		return (await adapter.getProductConfiguration?.())?.privateHost?.lexiangHost?.trim() || void 0;
	} catch {
		return;
	}
}
/**
* 根据 entry id 生成原始乐享页面 URL，供 `intend_url` 使用。
*
* 规则：`https://lexiangla.com/pages/{entry.id}` + 预览裁剪 query。
* 文件夹与文件使用相同的 URL 协议，统一拼接 entry id 即可。
*/
function buildLexiangPageUrl(entryId) {
	const query = buildQueryString(LEXIANG_PAGE_PREVIEW_UI_QUERY);
	return `${LEXIANG_WEB_ORIGIN_PROD}/pages/${entryId}${query ? `?${query}` : ""}`;
}
/**
* 生成乐享 B 端主看板原始 URL，仅作为 temp-login-url 的 intend_url。
*
* 固定使用 /wb 路径（乐享 B 端工作台入口），
* 域名由 `resolveLexiangBOrigin(isStaging, endpoint, isVpcAccount)` 动态选择：
*   VPC 账号 → 从 endpoint 派生 `*-lx` 子域名（线上/预发均派生）
*   非 VPC staging → `.net` 或 VPC staging `*-lx.copilot-staging.qq.com`
*   其他环境 → `.com`
*/
function buildLexiangLibraryUrl(isStaging, params = {}) {
	const origin = resolveLexiangBOrigin(isStaging, params.endpoint, params.isVpcAccount, params.lexiangHost);
	const query = buildQueryString(LEXIANG_LIBRARY_EMBED_UI_QUERY);
	return `${origin}/wb${query ? `?${query}` : ""}`;
}
/**
* 获取乐享 B 端主看板的免登 iframe URL。
*
* @param isStaging 是否预发环境（调用方通过 `useOptionalImaApiBridge().isStagingEnv()` 读取）。
*/
async function getLexiangLibraryEmbedUrl(adapter, isStaging, params = {}) {
	const [endpoint, lexiangHost] = await Promise.all([resolveProductEndpoint(adapter, isStaging, params.endpoint), resolveLexiangPrivateHost(adapter, params.lexiangHost)]);
	return fetchLexiangTempLoginUrl(adapter, {
		intendUrl: buildLexiangLibraryUrl(isStaging, {
			...params,
			endpoint,
			lexiangHost
		}),
		mode: "iframe"
	});
}
/**
* 拼接 B 端「空间内打开指定条目」的原始 URL：
*   https://{B端域名}/wb/spaces/{spaceId}?entry_id={entryId}&{embed UI query}
*
* 仅作为 temp-login-url 的 intend_url 使用。
* 域名由 `resolveLexiangBOrigin(isStaging, endpoint, isVpcAccount)` 动态选择。
*/
function buildLexiangSpaceUrl(isStaging, params) {
	const origin = resolveLexiangBOrigin(isStaging, params.endpoint, params.isVpcAccount, params.lexiangHost);
	const query = buildQueryString({
		...LEXIANG_LIBRARY_EMBED_UI_QUERY,
		entry_id: params.entryId
	});
	const suffix = query ? `?${query}` : "";
	return `${origin}/wb/spaces/${params.spaceId}${suffix}`;
}
/**
* 获取乐享 B 端「空间 + 指定条目」的免登 iframe URL，
* 用于上传成功后跳转 iframe 直接定位到目标条目所在空间。
*
* @param isStaging 是否预发环境（调用方通过 `useOptionalImaApiBridge().isStagingEnv()` 读取）。
*/
async function getLexiangSpaceEmbedUrl(adapter, isStaging, params) {
	const [endpoint, lexiangHost] = await Promise.all([resolveProductEndpoint(adapter, isStaging, params.endpoint), resolveLexiangPrivateHost(adapter, params.lexiangHost)]);
	return fetchLexiangTempLoginUrl(adapter, {
		intendUrl: buildLexiangSpaceUrl(isStaging, {
			...params,
			endpoint,
			lexiangHost
		}),
		mode: "iframe"
	});
}
/**
* 获取 LexiangFile 的"可嵌入 iframe"预览 URL。
*
* 用列表行的 `id`（= entry.id）拼 intend_url → 调免登接口 → 返回 login_url。
* 文件夹与文件使用相同的 URL 协议（`/pages/{id}`），统一走此路径。
*/
async function getLexiangPreviewEmbedUrl(adapter, file) {
	return fetchLexiangTempLoginUrl(adapter, {
		intendUrl: buildLexiangPageUrl(file.id),
		mode: "native"
	});
}
var buildQueryString, fetchOauthTempLoginUrl, fetchEnterpriseTempLoginUrl, TempLoginUrlError;
var init_auth_service = __esmMin((() => {
	init_lexiang_auth_constants();
	init_constants();
	init_auth_error();
	init_auth_refresh();
	buildQueryString = (params) => {
		return new URLSearchParams(params).toString();
	};
	fetchOauthTempLoginUrl = async (adapter, body) => {
		if (!adapter?.connectorOauthTempLoginUrl) throw new Error("[lexiang-auth] adapter.connectorOauthTempLoginUrl not supported");
		return adapter.connectorOauthTempLoginUrl(LEXIANG_OAUTH_NAME, body);
	};
	fetchEnterpriseTempLoginUrl = async (adapter, body) => {
		if (!adapter?.connectorEnterpriseTempLoginUrl) throw new Error("[lexiang-auth] adapter.connectorEnterpriseTempLoginUrl not supported");
		return adapter.connectorEnterpriseTempLoginUrl(LEXIANG_OAUTH_NAME, body);
	};
	TempLoginUrlError = class extends Error {
		respCode;
		constructor(message, respCode) {
			super(message);
			this.name = "TempLoginUrlError";
			this.respCode = respCode;
		}
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/assets/no-knowledge-base-update.svg
var no_knowledge_base_update_default;
var init_no_knowledge_base_update = __esmMin((() => {
	no_knowledge_base_update_default = "" + new URL("no-knowledge-base-update-CopzwuXE.svg", import.meta.url).href;
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/assets/kb.svg
var kb_default;
var init_kb = __esmMin((() => {
	kb_default = "" + new URL("kb-BQsWXcm2.svg", import.meta.url).href;
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/icons/kb-default-icon.tsx
function KbDefaultIcon({ size = 24 }) {
	return /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("img", {
		src: kb_default,
		width: size,
		height: size,
		alt: "kb",
		draggable: false,
		style: { display: "block" }
	});
}
var import_jsx_runtime$1;
var init_kb_default_icon = __esmMin((() => {
	require_react();
	init_kb();
	import_jsx_runtime$1 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/icons/team-default-icon.tsx
function TeamDefaultIcon({ size = 16 }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		viewBox: "0 0 16 16",
		xmlns: "http://www.w3.org/2000/svg",
		width: size,
		height: size,
		style: { display: "block" },
		"aria-hidden": "true",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			fill: "currentColor",
			d: "M11.1846 7.00391C13.107 7.09275 14.7062 8.54649 14.9629 10.4717L15.1983 12.2354C15.3481 13.3591 14.5377 14.3655 13.4395 14.4873L13.2158 14.5H7.78421C6.57472 14.4999 5.64193 13.4343 5.80178 12.2354L6.03714 10.4717C6.3021 8.48451 7.99723 7.00006 10.002 7H10.9981L11.1846 7.00391ZM4.50003 7C5.19037 7 5.83873 7.19695 6.38967 7.53906C6.11113 7.82934 5.86795 8.15449 5.66507 8.50684C5.31892 8.31269 4.9218 8.2002 4.50003 8.2002C3.2869 8.20023 2.26674 9.11016 2.12893 10.3154L1.94632 11.9092C1.89213 12.3837 2.26367 12.7995 2.74124 12.7998H4.79592C4.83866 13.2315 4.97432 13.6387 5.18362 14H2.74124C1.62147 13.9998 0.735643 13.0853 0.741237 11.9932L0.754909 11.7725L0.93655 10.1797C1.14357 8.36828 2.67683 7.00004 4.50003 7ZM10.002 8.2002C8.59869 8.20025 7.41209 9.2389 7.22659 10.6299L6.99124 12.3945C6.92748 12.8739 7.30056 13.2997 7.78421 13.2998H13.2158C13.6994 13.2996 14.0725 12.8739 14.0088 12.3945L13.7735 10.6299C13.588 9.23895 12.4013 8.20035 10.9981 8.2002H10.002ZM4.50003 2.5C5.6046 2.5 6.50003 3.39543 6.50003 4.5C6.50003 5.60457 5.6046 6.5 4.50003 6.5C3.39546 6.5 2.50003 5.60457 2.50003 4.5C2.50003 3.39543 3.39546 2.5 4.50003 2.5ZM10.5 1.5C11.8807 1.5 13 2.61929 13 4C13 5.38071 11.8807 6.5 10.5 6.5C9.11932 6.5 8.00003 5.38071 8.00003 4C8.00003 2.61929 9.11932 1.5 10.5 1.5ZM10.5 2.7002C9.78206 2.7002 9.20022 3.28203 9.20022 4C9.20022 4.71797 9.78206 5.2998 10.5 5.2998C11.218 5.2998 11.7998 4.71797 11.7998 4C11.7998 3.28203 11.218 2.7002 10.5 2.7002ZM4.50003 3.7002C4.0582 3.7002 3.70022 4.05817 3.70022 4.5C3.70022 4.94183 4.0582 5.2998 4.50003 5.2998C4.94185 5.2998 5.29983 4.94183 5.29983 4.5C5.29983 4.05817 4.94185 3.7002 4.50003 3.7002Z"
		})
	});
}
var import_jsx_runtime;
var init_team_default_icon = __esmMin((() => {
	require_react();
	import_jsx_runtime = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/api/team-service.ts
/**
* 按关键字搜索团队（用于团队选择下拉）。
* 关键字为空时返回默认列表（最近/常用团队）。
*
* 对齐 SPAPI `GET /spapi/team/v1/teams?keyword=<keyword>`。
*/
async function searchTeamsByKeyword(keyword, limit = 20, pageToken) {
	try {
		const query = {
			limit,
			permission: "edit"
		};
		if (keyword.trim()) query.keyword = keyword.trim();
		if (pageToken) query.page_token = pageToken;
		const data = unwrapData(await callSpApi({
			path: "/spapi/team/v1/teams",
			query
		}));
		const teams = data?.teams ?? [];
		return {
			teams,
			hasMore: teams.length === limit,
			nextPageToken: data?.next_page_token
		};
	} catch {
		return {
			teams: [],
			hasMore: false
		};
	}
}
/**
* 按名称精确搜索团队（用于"重名检查"场景）。
*
* 对齐 SPAPI `GET /spapi/team/v1/teams?name=<keyword>`，与 shield
* `useSearchTeamByName` 行为一致。
*/
async function searchTeamsByName(name, limit = 20) {
	const trimmed = name.trim();
	if (!trimmed) return [];
	try {
		return unwrapData(await callSpApi({
			path: "/spapi/team/v1/teams",
			query: {
				name: trimmed,
				limit
			}
		}))?.teams ?? [];
	} catch {
		return [];
	}
}
/**
* 创建团队。
*
* 对齐 SPAPI `POST /spapi/team/v1/teams`。
*/
async function createTeam(params) {
	const body = { name: params.name };
	if (params.signature) body.signature = params.signature;
	if (params.logo) body.logo = params.logo;
	if (params.is_secret !== void 0) body.is_secret = params.is_secret;
	if (params.privileges?.length) body.privileges = params.privileges;
	return unwrapData(await callSpApi({
		method: "POST",
		path: "/spapi/team/v1/teams",
		body
	}));
}
/**
* 获取团队与知识库默认权限配置（管理端）。
*
* 对齐 SPAPI `GET /spapi/team/v1/privilege-config`。
* 失败时抛错，由调用方自行处理 loading/error/retry 状态。
*/
async function fetchTeamPrivilegeConfig() {
	return unwrapData(await callSpApi({ path: "/spapi/team/v1/privilege-config" })).privilege_config;
}
/**
* 获取当前用户的常用团队列表（对齐乐享 `team_list_frequent_teams`）。
*
* 与 `team_list_teams` 的差异：常用团队会优先返回用户高频访问的团队，
* 适合作为默认排序。`team_list_teams` 返回的是全量团队。
*
* ⚠️ 接口约束：服务端校验 `limit <= 20`（int32.lte），超过会返回 code=51 校验错误。
*
* @param limit     每页数量，默认 20（接口上限），传入 >20 会被自动 clamp
* @param type      可选过滤类型：'personal' | 'company'
* @param pageToken 分页 token
*/
async function fetchFrequentTeams(limit = 20, type, pageToken) {
	const query = { limit: Math.min(Math.max(1, limit), 20) };
	if (type) query.type = type;
	if (pageToken) query.page_token = pageToken;
	return unwrapData(await callSpApi({
		path: "/spapi/team/v1/frequent-teams",
		query
	}));
}
/**
* 按关键字搜索团队（通过 team_list_teams 接口的 keyword 参数过滤）。
*
* @param keyword 团队名关键字
* @param limit   每页数量，默认 20
* @param pageToken 分页 token
*/
async function searchTeams(keyword, limit = 20, pageToken) {
	const query = {
		keyword,
		limit
	};
	if (pageToken) query.page_token = pageToken;
	return unwrapData(await callSpApi({
		path: "/spapi/team/v1/teams",
		query
	}));
}
var init_team_service = __esmMin((() => {
	init_spapi_client();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/api/privilege-service.ts
async function fetchMyPermissions() {
	try {
		return unwrapData(await callSpApi({ path: "/spapi/privilege/rbac/v1/my-permissions" }));
	} catch {
		return { permissions: [] };
	}
}
/**
* 获取资源权限人数统计。
* 对应 SPAPI `GET /spapi/kb/perm/v1/privileges/count`。
*
* @param resourceId   资源 id（团队 id / 知识库 id）
* @param resourceType 资源类型（'team' | 'space'）
*/
async function fetchPrivilegeCount(resourceId, resourceType) {
	if (!resourceId) return { count: {} };
	try {
		const data = unwrapData(await callSpApi({
			path: "/spapi/kb/perm/v1/privileges/count",
			query: {
				resource_id: resourceId,
				resource_type: resourceType
			}
		})) ?? {};
		if (data.count) for (const k of Object.keys(data.count)) {
			const v = data.count[k];
			if (v !== void 0) data.count[k] = Number(v);
		}
		return data;
	} catch {
		return { count: {} };
	}
}
/**
* 获取资源权限成员列表（分页）。
* 对应 SPAPI `GET /spapi/kb/perm/v1/privileges`。
* 对齐 shield useGetPrivilegePagination。
*
* @param resourceId   资源 id
* @param resourceType 资源类型
* @param role         过滤角色（'manager' | 'member' 等）
* @param pageToken    分页 token
* @param limit        每页条数，默认 20
*/
async function fetchPrivilegePagination(resourceId, resourceType, options = {}) {
	if (!resourceId) return { privileges: [] };
	const { pageToken, limit = 20 } = options;
	try {
		const query = {
			resource_id: resourceId,
			resource_type: resourceType,
			limit
		};
		if (pageToken) query.page_token = pageToken;
		const raw = unwrapData(await callSpApi({
			path: "/spapi/kb/perm/v1/privileges",
			query
		})) ?? { privileges: [] };
		return {
			privileges: (raw.privileges ?? []).map((item) => ({
				...item,
				subject_type: item.subject_type,
				staff: raw.staffs?.[item.subject_id] ?? void 0,
				department: raw.departments?.[item.subject_id] ?? void 0
			})),
			next_page_token: raw.next_page_token
		};
	} catch {
		return { privileges: [] };
	}
}
/**
* 获取当前用户在指定资源上的权限列表。
* 对应 SPAPI `GET /spapi/kb/perm/v1/staff/permissions`。
* 对齐 shield getStaffPermissions。
*
* 失败时返回空数组（降级为无权）。
*/
async function fetchStaffPermissions(resourceId, resourceType) {
	if (!resourceId) return [];
	try {
		return unwrapData(await callSpApi({
			path: "/spapi/kb/perm/v1/staff/permissions",
			query: {
				resource_id: resourceId,
				resource_type: resourceType
			}
		}))?.permissions ?? [];
	} catch {
		return [];
	}
}
var init_privilege_service = __esmMin((() => {
	init_spapi_client();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/api/contact-service.ts
/**
* 搜索联系人（成员/部门/标签）。
*
* 对齐 SPAPI `GET /spapi/contact/v1/search`，返回规范化的统一列表：
* staffs → model: 'staff'，departments → model: 'department'，tags → model: 'contact_tag'。
*
* @param keyword  搜索关键字（按姓名前缀匹配）
* @param options.limit           最大条数，默认 20
* @param options.withDepartment  是否返回部门，默认 true
* @param options.withTags        是否返回标签，默认 false
* @param options.onlyStaff       是否仅返回 staff 类型，默认 false
*/
async function searchContacts(keyword, options = {}) {
	const trimmed = keyword.trim();
	if (!trimmed) return [];
	const { limit = 20, withDepartment = true, withTags = false, onlyStaff = false } = options;
	try {
		const data = (await callSpApi({
			path: "/spapi/contact/v1/search",
			query: {
				starts_with: trimmed,
				limit,
				with_department: withDepartment ? 1 : 0,
				with_tags: withTags ? 1 : 0
			}
		}))?.data ?? {};
		const staffs = (data.staffs ?? []).map((s) => ({
			id: s.id,
			display_name: s.display_name,
			model: "staff",
			avatar: s.avatar,
			organization: s.organization,
			is_resigned: s.is_resigned
		}));
		const departments = onlyStaff ? [] : (data.departments ?? []).map((d) => ({
			id: d.id,
			display_name: d.name,
			model: "department",
			organization: d.path_name
		}));
		const tags = onlyStaff || !withTags ? [] : (data.tags ?? []).map((t) => ({
			id: t.id,
			display_name: t.name,
			model: "contact_tag"
		}));
		return [
			...departments,
			...tags,
			...staffs
		];
	} catch {
		return [];
	}
}
/**
* 获取单个部门信息。
*
* 对齐 shield `useGetDepartment`，对应 SPAPI：
* `GET /spapi/contact/v1/departments/:id`
*
* 部门不存在或无权限时返回 `null`。
*/
async function getDepartment(id) {
	if (!id) return null;
	try {
		return unwrapData(await callSpApi({ path: `/spapi/contact/v1/departments/${encodeURIComponent(id)}` }))?.department ?? null;
	} catch {
		return null;
	}
}
var init_contact_service = __esmMin((() => {
	init_spapi_client();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/api/space-service.ts
/**
* 创建知识库。
* 对应 SPAPI `POST /spapi/kb/space/v1/spaces`。
* 后台返回 `{ data: { space: Space } }`，解包到 Space 层。
*/
async function createSpace(params) {
	return unwrapData(await callSpApi({
		method: "POST",
		path: "/spapi/kb/space/v1/spaces",
		body: params
	})).space;
}
/**
* 获取当前用户最近访问过的知识库列表。
*
* 对应 SPAPI `GET /spapi/kb/space/v1/recent-spaces`。
*/
async function fetchRecentSpaces(limit = 20, include) {
	const query = { limit };
	if (include) query.include = include;
	return unwrapData(await callSpApi({
		path: "/spapi/kb/space/v1/recent-spaces",
		query
	}));
}
/**
* 拉取某团队下的知识库列表（对齐 `space_list_spaces`）。
*
* 设计要点：
* - 默认带 `sort_by={@link LEXIANG_TEAM_SPACES_SORT_BY}`（`-edited_at`）与站内行为对齐；
*   调用方可通过 `options.sortBy` 覆盖。
* - 当 `options.isPinned=true` 时透传 `is_pinned`，**服务端会按 `-pinned_at` 查询并忽略
*   分页 token**（来自接口文档），此模式下：
*   1. 不携带 `page_token`（即使 caller 传了也忽略）；
*   2. 不携带 `sort_by`（pinned 模式下排序由服务端固定为 `-pinned_at`，传入会被忽略，
*      为避免误导阅读者，干脆不带）。
*
* @param teamId    团队 id
* @param limit     每页数量；pinned 模式下作为单页全量上限
* @param pageToken 分页 token；pinned 模式下会被忽略
* @param options   可选项：sortBy / isPinned
*/
async function fetchTeamSpaces(teamId, limit = 20, pageToken, options) {
	const query = {
		team_id: teamId,
		limit
	};
	if (options?.isPinned === true) query.is_pinned = 1;
	else {
		query.sort_by = options?.sortBy ?? "-edited_at";
		if (pageToken) query.page_token = pageToken;
	}
	if (options?.permission) query.permission = options.permission;
	return unwrapData(await callSpApi({
		path: "/spapi/kb/space/v1/spaces",
		query
	}));
}
/**
* 拉取某团队下的「置顶」知识库列表（对齐站内 `/sapi/kb/space/v1/spaces?is_pinned=1`）。
*
* 内部委托 {@link fetchTeamSpaces} 走 `is_pinned: true` 分支：
* - 服务端按 `-pinned_at` 排序；
* - 服务端会忽略 `page_token`（即「单页全量」语义），调用方无需关心分页。
*
* 与 {@link fetchTeamSpaces} 分开导出的原因：语义独立（单页 / 不分页），独立函数
* 便于上层做 in-flight 去重、缓存键隔离与失败兜底。
*/
async function fetchPinnedTeamSpaces(teamId, limit = 50, permission) {
	return fetchTeamSpaces(teamId, limit, void 0, {
		isPinned: true,
		permission
	});
}
/**
* 获取当前用户的个人知识库信息。
*
* 对应 SPAPI `GET /spapi/kb/space/v1/spaces/personal`。
*/
async function fetchPersonalSpace() {
	return unwrapData(await callSpApi({
		path: "/spapi/kb/space/v1/spaces/personal",
		query: { is_async: false }
	}));
}
var init_space_service = __esmMin((() => {
	init_spapi_client();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/api/search-service.ts
/**
* 解析 `SearchData.docs[].extra_info` JSON 字符串字段。
*
* 乐享搜索接口把 `logo` / `root_entry_id` 等扩展字段塞在序列化的 JSON 字符串里，
* 这里做一次防御解析：解析失败 / 类型异常一律返回空对象，不抛错。
*/
function parseLexiangSearchExtraInfo(raw) {
	if (!raw || typeof raw !== "string") return {};
	try {
		const parsed = JSON.parse(raw);
		return {
			logo: typeof parsed.logo === "string" ? parsed.logo : void 0,
			rootEntryId: typeof parsed.root_entry_id === "string" ? parsed.root_entry_id : void 0
		};
	} catch {
		return {};
	}
}
/**
* 知识库全局搜索（跨知识库 / 跨类型）。
*
* 对应 SPAPI `POST /spapi/search/v1/kb/search`。
*
* @param keyword 搜索关键字
* @param options 搜索选项
*/
async function searchKb(keyword, options = {}) {
	const body = {
		keyword,
		type: options.type ?? "all",
		highlight: options.highlight ?? true,
		limit: options.limit ?? 20,
		include_references: true
	};
	if (options.teamId) body.team_id = options.teamId;
	if (options.spaceId) body.space_id = options.spaceId;
	if (options.pageToken) body.page_token = options.pageToken;
	if (options.titleOnly !== void 0) body.title_only = options.titleOnly;
	if (options.sortBy) body.sort_by = options.sortBy;
	return unwrapData(await callSpApi({
		path: "/spapi/search/v1/kb/search",
		method: "POST",
		body
	}));
}
var init_search_service = __esmMin((() => {
	init_spapi_client();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/api/feature-flag-service.ts
/**
* 获取公司级 feature flag 配置。
* 失败时返回空对象（所有开关默认关闭）。
*/
async function fetchFeatureFlags() {
	try {
		return unwrapData(await callSpApi({ path: "/spapi/feature-flag/v1/company/version" }))?.feature_flags ?? {};
	} catch {
		return {};
	}
}
var init_feature_flag_service = __esmMin((() => {
	init_spapi_client();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/api/index.ts
var init_api = __esmMin((() => {
	init_mcp_client();
	init_catalog_service();
	init_asset_service();
	init_auth_service();
	init_team_service();
	init_privilege_service();
	init_contact_service();
	init_space_service();
	init_search_service();
	init_entry_service();
	init_feature_flag_service();
}));
//#endregion
export { init_kb_default_icon as A, init_asset_service as B, init_team_service as C, TeamDefaultIcon as D, searchTeamsByName as E, fetchLexiangTempLoginUrl as F, isDirectlyUsableLogoUrl as H, getLexiangLibraryEmbedUrl as I, getLexiangPreviewEmbedUrl as L, no_knowledge_base_update_default as M, buildLexiangPageUrl as N, init_team_default_icon as O, deriveLexiangWebOriginForVpcAccount as P, getLexiangSpaceEmbedUrl as R, fetchTeamPrivilegeConfig as S, searchTeamsByKeyword as T, resolveSpaceLogoUrl as U, invalidateLogoUrlCache as V, fetchPrivilegePagination as _, searchKb as a, createTeam as b, fetchPinnedTeamSpaces as c, init_space_service as d, getDepartment as f, fetchPrivilegeCount as g, fetchMyPermissions as h, parseLexiangSearchExtraInfo as i, init_no_knowledge_base_update as j, KbDefaultIcon as k, fetchRecentSpaces as l, searchContacts as m, fetchFeatureFlags as n, createSpace as o, init_contact_service as p, init_feature_flag_service as r, fetchPersonalSpace as s, init_api as t, fetchTeamSpaces as u, fetchStaffPermissions as v, searchTeams as w, fetchFrequentTeams as x, init_privilege_service as y, init_auth_service as z };
