const require_chunk = require("./chunk.js");
const require_common = require("./common.js");
const require_credential_protection = require("./credential-protection.js");
const require_tencent_docs_prompt_selection = require("./tencent-docs-prompt-selection.js");
const require_logger = require("./logger.js");
const require_wb_source = require("./wb-source.js");
const require_docs = require("./docs.js");
const require_proxy_agents = require("./proxy-agents.js");
const require_workbuddy_product_config = require("./workbuddy-product-config.js");
const require_dev_env_override = require("./dev-env-override.js");
const require_workbuddy_paths = require("./workbuddy-paths.js");
const require_logger$1 = require("./logger3.js");
const require_package_and_show_log = require("./package-and-show-log.js");
const require_log_acl_guard = require("./log-acl-guard.js");
const require_server = require("./server.js");
const require_daemon_bootstrap = require("./daemon-bootstrap.js");
const require_tls_verification = require("./tls-verification.js");
const require_tar = require("./tar.js");
const require_credential_protection_bootstrap = require("./credential-protection-bootstrap.js");
const require_runtime_http = require("./runtime-http.js");
const require_cli_prewarm_pool = require("./cli-prewarm-pool.js");
const require_perf_profiler_handlers = require("./perf-profiler-handlers.js");
const require_file_authentication_storage = require("./file-authentication-storage.js");
const require_tencent_docs_document_lifecycle_port = require("./tencent-docs-document-lifecycle-port.js");
const require_legacy_auth_session_migrator = require("./legacy-auth-session-migrator.js");
const require_module_base = require("./module-base.js");
const require_module_app_server = require("./module.app-server.js");
const require_selection_broadcast = require("./selection-broadcast.js");
let node_fs = require("node:fs");
node_fs = require_chunk.__toESM(node_fs);
let node_path = require("node:path");
node_path = require_chunk.__toESM(node_path);
let node_fs_promises = require("node:fs/promises");
node_fs_promises = require_chunk.__toESM(node_fs_promises);
//#region ../../packages/workbuddy-core/src/domains/expert/common/utils/expert-runtime-identity.ts
/**
* `expert-v2:` 运行时身份的唯一解析处。daemon launch 与 UI 展示都读它，禁止再抄一份 JSON 解包。
*
* 存在的理由：会话里落库的 `expert_id` 多数是 `source_id`（`PptCreationExpert` 这类），
* 而 OP get-by-ids 只认 `ex_*`。做同款、首页场景这些只拿得到市场 id 的入口，把 `ex_*`
* 塞进 runtimeIdentity 捎带过去，是目前唯一能跨端把它带到底的通道（#99334）。
*/
/**
* 官方市场 id（`ex_xxx`）。也匹配混合大小写 id 被 kebab 化之后的样子
* （`ex_gaZLEEnjaBQw` → `ex_ga-zle-enja-b-qw`）。
*/
function looksLikeOfficialMarketExpertId(id) {
	return /^ex_[A-Za-z0-9-]+$/.test(id);
}
var EXPERT_V2_PREFIX = "expert-v2:";
function readExpertV2Field(identity, field) {
	if (!identity?.startsWith(EXPERT_V2_PREFIX)) return;
	try {
		const value = JSON.parse(identity.slice(10))[field];
		return typeof value === "string" && value.trim() !== "" ? value.trim() : void 0;
	} catch {
		return;
	}
}
/**
* 非 `ex_*` 一律丢弃：拿 source_id 去查 get-by-ids 必然 miss，还会白等一轮网络。
*/
function readMarketExpertIdFromRuntimeIdentity(identity) {
	const value = readExpertV2Field(identity, "marketExpertId");
	return value && looksLikeOfficialMarketExpertId(value) ? value : void 0;
}
//#endregion
//#region ../../packages/workbuddy-server/src/expert/lookup-official-plugin-name.ts
require_common.init_common$3();
/**
* 在 COS manifest 里按 id / sourceId / marketExpertId 三路匹配，返回命中的 pluginName。
* 任一命中即返回，找不到返回 undefined。
*/
async function lookupPluginNameFromCosManifest(id, fallback) {
	const hit = ((await fallback.getManifest())?.experts ?? []).find((e) => e.id === id || e.sourceId === id || e.marketExpertId === id);
	return (typeof hit?.plugin === "string" ? hit.plugin.trim() : "") || void 0;
}
function createLookupOfficialPluginName(http, deps) {
	return async (expertId) => {
		const id = expertId.trim();
		if (!id) {
			deps?.logger?.warn?.("[lookup-official-plugin-name] empty id");
			return;
		}
		let opPluginName;
		try {
			const items = await require_tar.fetchOperationPlatformExpertsByIds(http, {
				routePrefix: "/portal",
				ids: [id],
				includeInvisible: true
			});
			const item = items.find((it) => it.expert_id === id);
			opPluginName = typeof item?.plugin_name === "string" && item.plugin_name.trim() ? item.plugin_name.trim() : void 0;
			deps?.logger?.info?.("[lookup-official-plugin-name] result " + JSON.stringify({
				id,
				itemsCount: items.length,
				items: items.map((it) => ({
					expert_id: it.expert_id,
					plugin_name: it.plugin_name
				})),
				matched: Boolean(item),
				pluginName: opPluginName ?? null
			}));
		} catch (error) {
			deps?.logger?.warn?.("[lookup-official-plugin-name] fetch failed " + JSON.stringify({
				id,
				errorMessage: error instanceof Error ? error.message : String(error),
				errorStack: error instanceof Error ? error.stack?.split("\n").slice(0, 5) : void 0
			}));
		}
		if (opPluginName) return opPluginName;
		if (!deps?.manifestFallback) return;
		try {
			const pluginName = await lookupPluginNameFromCosManifest(id, deps.manifestFallback);
			deps?.logger?.info?.("[lookup-official-plugin-name] cos-fallback " + JSON.stringify({
				id,
				pluginName: pluginName ?? null
			}));
			return pluginName;
		} catch (error) {
			deps?.logger?.warn?.("[lookup-official-plugin-name] cos-fallback failed " + JSON.stringify({
				id,
				errorMessage: error instanceof Error ? error.message : String(error)
			}));
			return;
		}
	};
}
function createLookupOfficialDownloadUrl(http, deps) {
	return async (expertId) => {
		const id = expertId.trim();
		if (!id) {
			deps?.logger?.warn?.("[lookup-official-download-url] empty id");
			return;
		}
		if (!id.startsWith("ex_")) {
			deps?.logger?.info?.("[lookup-official-download-url] skip non-ex_ id " + JSON.stringify({ id }));
			return;
		}
		try {
			const resp = await http.post("/portal/operation-platform/market/expert/download-url", { expert_id: id });
			const url = typeof resp.data?.download_url === "string" ? resp.data.download_url : "";
			deps?.logger?.info?.("[lookup-official-download-url] result " + JSON.stringify({
				id,
				code: resp.code,
				hasUrl: Boolean(url),
				version: resp.data?.version,
				expiresAt: resp.data?.expires_at
			}));
			if (resp.code !== 0 || !url) return;
			return url;
		} catch (error) {
			deps?.logger?.warn?.("[lookup-official-download-url] fetch failed " + JSON.stringify({
				id,
				errorMessage: error instanceof Error ? error.message : String(error)
			}));
			return;
		}
	};
}
//#endregion
//#region ../../packages/workbuddy-server/src/server/app-server-addons/conversation-expert-runtime-preparer.ts
/**
* Conversations launch 边界的 server-private expert runtime preparer。
*
* 只读 sessions 投影的 ExpertSelection，做 authoritative lookup / materialize /
* exact validate，产出内存 PreparedExpertRuntimeFacts。不写 sessions。
* 官方市场、以及无 marketplace 列的历史裸 id（本地 0 命中后），按 OP
* get-by-ids 的 plugin_name 匹配已落地目录或下载。不读 COS catalog。
* kebab 不得当下载名。禁止省略 pluginName。
*
* 名字匹配只用于收敛候选，不能单独定案：官方市场里 dirName / manifest.name / agentName
* 三套名字互相交叉（目录 `ppt-creation-expert` 属于 LexiangPptExpert，而 `PptCreationExpert`
* 的包叫 `ppt-implement`），撞车是常态。撞车时按 OP plugin_name → 本机落地记录定夺（#99334）；
* 两个来源都答不上来才退到「取第一个」并 warn（#99876：撞车不该让会话判死）。
*/
var EXPERTS_MARKETPLACE$1 = "experts";
var EXPERT_UNAVAILABLE = "EXPERT_UNAVAILABLE";
var EXPERT_ID_AMBIGUOUS = "EXPERT_ID_AMBIGUOUS";
var KNOWN_MARKETPLACE_ALIASES = new Set([
	"builtin",
	"official",
	EXPERTS_MARKETPLACE$1,
	"custom",
	require_tar.CUSTOM_EXPERT_MY_EXPERT_DIR_NAME
]);
var PLUGIN_METADATA_DIRS = [".codebuddy-plugin", ".workbuddy-plugin"];
var PLUGIN_MANIFEST_FILE = "plugin.json";
var ExpertRuntimePrepareError = class extends Error {
	constructor(prepareErrorCode, message) {
		super(message);
		this.name = "ExpertRuntimePrepareError";
		this.prepareErrorCode = prepareErrorCode;
	}
};
function rawExpertFingerprintKey(fingerprint) {
	return JSON.stringify({
		expertId: fingerprint.expertId ?? null,
		expertMarketplace: fingerprint.expertMarketplace ?? null,
		expertRuntimeIdentity: fingerprint.expertRuntimeIdentity ?? null
	});
}
function fingerprintsEqual(left, right) {
	return rawExpertFingerprintKey(left) === rawExpertFingerprintKey(right);
}
function normalizeMarketplaceAlias(marketplace) {
	if (!marketplace) return;
	if (marketplace === "builtin" || marketplace === "official") return EXPERTS_MARKETPLACE$1;
	if (marketplace === "custom") return require_tar.CUSTOM_EXPERT_MY_EXPERT_DIR_NAME;
	return marketplace;
}
/**
* 从 expert-v2 JSON identity 提取 pluginRegisteredName，作为精确插件目录匹配 hint。
* v2 格式：`expert-v2:{"v":2,"kind":"expert","expertId":"...","pluginRegisteredName":"data-ai-experts",...}`
*/
function parseExpertV2PluginHint(runtimeIdentity) {
	if (!runtimeIdentity || !runtimeIdentity.startsWith("expert-v2:")) return;
	try {
		const payload = JSON.parse(runtimeIdentity.slice(10));
		if (payload?.v !== 2 || payload?.kind !== "expert") return;
		const pluginName = typeof payload.pluginRegisteredName === "string" ? payload.pluginRegisteredName.trim() : void 0;
		return pluginName ? { pluginRegisteredName: pluginName } : void 0;
	} catch {
		return;
	}
}
/**
* 政策①：仅 `expert:${id}:${marketplace}[:v]` 且 id+marketplace 非空，
* 第二段必须是已知市场别名。不把 expert-v2 / 裸 id / 缺市场段当结构化身份。
*/
function parseStructuredRuntimeIdentity(runtimeIdentity) {
	if (!runtimeIdentity || runtimeIdentity.startsWith("expert-v2:")) return;
	if (!runtimeIdentity.startsWith("expert:")) return;
	const body = runtimeIdentity.slice(7);
	const firstColon = body.indexOf(":");
	if (firstColon <= 0) return;
	const id = body.slice(0, firstColon);
	const rest = body.slice(firstColon + 1);
	if (!id || !rest) return;
	const versionSep = rest.lastIndexOf(":v");
	const marketplacePart = versionSep > 0 ? rest.slice(0, versionSep) : rest;
	if (!marketplacePart || marketplacePart.includes(":") || !KNOWN_MARKETPLACE_ALIASES.has(marketplacePart)) return;
	if (versionSep > 0) {
		const version = rest.slice(versionSep + 1);
		if (!/^v\d+$/.test(version)) return;
	}
	return {
		id,
		marketplace: marketplacePart
	};
}
function isUnsafeDirName(dirName) {
	return !dirName || dirName === "." || dirName === ".." || /[\\/]/.test(dirName);
}
function optionalManifestString(value) {
	return typeof value === "string" && value.trim() !== "" ? value : void 0;
}
function optionalExpertType(value) {
	return value === "skill" || value === "agent" || value === "plugin" || value === "team" ? value : void 0;
}
function localizedNameMatches(name, query) {
	if (!name) return false;
	if (typeof name === "string") return name === query;
	return name.zh === query || name.en === query;
}
/** 与 ExpertPluginService.toKebabCase 同规则。只用于已落地候选的匹配，不拿来猜 activate 路径。 */
function toExpertDirKebabCase(value) {
	return value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/([A-Z])([A-Z][a-z])/g, "$1-$2").toLowerCase();
}
function identityMatches(value, query, kebabQuery) {
	return !!value && (value === query || value === kebabQuery);
}
function candidateMatchesQuery(candidate, query) {
	const kebabQuery = toExpertDirKebabCase(query);
	return identityMatches(candidate.dirName, query, kebabQuery) || identityMatches(candidate.id, query, kebabQuery) || identityMatches(candidate.pluginIdentity, query, kebabQuery) || identityMatches(candidate.agentName, query, kebabQuery) || identityMatches(candidate.marketExpertId, query, kebabQuery) || identityMatches(candidate.sourceId, query, kebabQuery) || localizedNameMatches(candidate.name, query) || localizedNameMatches(candidate.name, kebabQuery);
}
function candidateDedupeKey(candidate) {
	const pluginIdentity = candidate.pluginIdentity || candidate.dirName;
	return `${candidate.marketplace}::${candidate.dirName}::${pluginIdentity}`;
}
function displayNameOf(candidate, locale, fallback) {
	const name = candidate.name;
	if (!name) return fallback;
	if (typeof name === "string") return name;
	return (locale?.toLowerCase().startsWith("en") ? name.en : name.zh) || name.zh || name.en || fallback;
}
async function readPluginManifestFromDir(dir) {
	for (const metaDir of PLUGIN_METADATA_DIRS) {
		const manifestPath = node_path.join(dir, metaDir, PLUGIN_MANIFEST_FILE);
		try {
			const content = await node_fs_promises.readFile(manifestPath, "utf8");
			const json = JSON.parse(content);
			return {
				name: typeof json.name === "string" ? json.name : void 0,
				id: typeof json.id === "string" ? json.id : void 0,
				agentName: typeof json.agentName === "string" ? json.agentName : void 0,
				expertType: optionalExpertType(json.expertType),
				displayName: json.displayName,
				marketExpertId: optionalManifestString(json.marketExpertId),
				sourceId: optionalManifestString(json.sourceId) ?? optionalManifestString(json.source_id)
			};
		} catch (error) {
			if (error.code === "ENOENT") continue;
			return;
		}
	}
}
async function hasMarketplaceBundleEntry(marketplacePath, dirName) {
	const manifestPath = node_path.join(marketplacePath, ".codebuddy-plugin", "marketplace.json");
	try {
		const content = await node_fs_promises.readFile(manifestPath, "utf8");
		const json = JSON.parse(content);
		const source = `./plugins/${dirName}`;
		return Array.isArray(json.plugins) && json.plugins.some((plugin) => plugin.source === source);
	} catch {
		return false;
	}
}
async function inspectLandedBundle(marketplacePath, marketplace, dirName) {
	if (isUnsafeDirName(dirName)) return { status: "none" };
	const dir = node_path.join(marketplacePath, "plugins", dirName);
	try {
		if (!(await node_fs_promises.stat(dir)).isDirectory()) return { status: "none" };
	} catch {
		return { status: "none" };
	}
	const manifest = await readPluginManifestFromDir(dir);
	const pluginName = manifest?.name;
	const agentName = manifest?.agentName;
	if (!pluginName || !agentName) return { status: "incomplete-names" };
	const candidate = {
		marketplace,
		dirName,
		id: manifest.id,
		name: manifest.displayName ?? manifest.name,
		pluginIdentity: pluginName,
		agentName,
		expertType: manifest.expertType,
		marketExpertId: manifest.marketExpertId,
		sourceId: manifest.sourceId
	};
	if (await hasMarketplaceBundleEntry(marketplacePath, dirName)) return {
		status: "complete",
		candidate
	};
	return {
		status: "needs-register",
		candidate
	};
}
async function listLandedOfficialExpertsFromMarketplace(marketplacePath) {
	const pluginsDir = node_path.join(marketplacePath, "plugins");
	let entries;
	try {
		entries = await node_fs_promises.readdir(pluginsDir, { withFileTypes: true });
	} catch {
		return [];
	}
	const candidates = [];
	for (const entry of entries) {
		if (!entry.isDirectory() || isUnsafeDirName(entry.name)) continue;
		const manifest = await readPluginManifestFromDir(node_path.join(pluginsDir, entry.name));
		if (!manifest) continue;
		candidates.push({
			marketplace: EXPERTS_MARKETPLACE$1,
			dirName: entry.name,
			id: manifest.id,
			name: manifest.displayName ?? manifest.name,
			pluginIdentity: manifest.name,
			agentName: manifest.agentName,
			expertType: manifest.expertType,
			marketExpertId: manifest.marketExpertId,
			sourceId: manifest.sourceId
		});
	}
	return candidates;
}
async function readOfficialExpertCandidateByDirName(marketplacePath, dirName) {
	if (isUnsafeDirName(dirName)) return;
	const dir = node_path.join(marketplacePath, "plugins", dirName);
	try {
		if (!(await node_fs_promises.stat(dir)).isDirectory()) return;
	} catch {
		return;
	}
	const manifest = await readPluginManifestFromDir(dir);
	if (!manifest) return;
	return {
		marketplace: EXPERTS_MARKETPLACE$1,
		dirName,
		id: manifest.id,
		name: manifest.displayName ?? manifest.name,
		pluginIdentity: manifest.name,
		agentName: manifest.agentName,
		expertType: manifest.expertType,
		marketExpertId: manifest.marketExpertId,
		sourceId: manifest.sourceId
	};
}
function candidateMatchesPluginDir(candidate, dirName) {
	return candidate.dirName === dirName || candidate.pluginIdentity === dirName;
}
function pickOfficialByPluginDirs(pool, dirNames) {
	for (const dirName of dirNames) {
		const matched = pool.filter((candidate) => candidateMatchesPluginDir(candidate, dirName));
		if (matched.length > 0) return dedupeCandidates(matched);
	}
	return [];
}
function customDirNameOf(expert) {
	if (typeof expert.expertRootDir === "string" && expert.expertRootDir.trim()) {
		const base = node_path.basename(expert.expertRootDir);
		return isUnsafeDirName(base) ? void 0 : base;
	}
}
/** 已落地自定义包的 displayName：string 或 {zh,en}；trim 空串忽略。 */
function customExpertDisplayName(expert) {
	const displayName = expert.displayName;
	if (typeof displayName === "string") {
		const trimmed = displayName.trim();
		return trimmed !== "" ? trimmed : void 0;
	}
	if (!displayName || typeof displayName !== "object" || Array.isArray(displayName)) return;
	const raw = displayName;
	const zh = typeof raw.zh === "string" && raw.zh.trim() !== "" ? raw.zh.trim() : void 0;
	const en = typeof raw.en === "string" && raw.en.trim() !== "" ? raw.en.trim() : void 0;
	if (!zh && !en) return;
	return {
		...zh ? { zh } : {},
		...en ? { en } : {}
	};
}
async function enumerateCustomCandidates(pluginService, queryId) {
	const byKey = /* @__PURE__ */ new Map();
	const direct = await pluginService.getCustomExpert(queryId);
	if (direct) {
		const dirName = customDirNameOf(direct) ?? (isUnsafeDirName(queryId) ? void 0 : queryId);
		if (dirName) {
			const candidate = {
				marketplace: require_tar.CUSTOM_EXPERT_MY_EXPERT_DIR_NAME,
				dirName,
				id: direct.id,
				name: customExpertDisplayName(direct) ?? direct.name,
				pluginIdentity: typeof direct.agentName === "string" ? direct.agentName : void 0
			};
			byKey.set(candidateDedupeKey(candidate), candidate);
			return [...byKey.values()];
		}
	}
	const scanned = await pluginService.scanCustomExperts();
	for (const expert of scanned) {
		const dirName = customDirNameOf(expert);
		if (!dirName) continue;
		const candidate = {
			marketplace: require_tar.CUSTOM_EXPERT_MY_EXPERT_DIR_NAME,
			dirName,
			id: expert.id,
			name: customExpertDisplayName(expert) ?? expert.name,
			pluginIdentity: typeof expert.agentName === "string" ? expert.agentName : void 0
		};
		byKey.set(candidateDedupeKey(candidate), candidate);
	}
	return [...byKey.values()];
}
function dedupeCandidates(candidates) {
	const byKey = /* @__PURE__ */ new Map();
	for (const candidate of candidates) byKey.set(candidateDedupeKey(candidate), candidate);
	return [...byKey.values()];
}
async function assemblePreparedFacts(pluginService, expertId, candidate, options, resolved) {
	const { readPromptFile, locale, fingerprint, runtimeIdentity, logger } = options;
	let promptText;
	let promptTruncated = false;
	let promptFilePath;
	try {
		const source = await pluginService.resolveExpertAgentPromptSource(expertId, candidate.marketplace);
		promptFilePath = source?.filePath;
		if (source?.filePath) {
			const fullPrompt = await readPromptFile(source.filePath);
			if (fullPrompt.trim()) {
				promptTruncated = fullPrompt.length > require_tar.MAX_EXPERT_PROMPT_CHARS;
				promptText = fullPrompt.slice(0, require_tar.MAX_EXPERT_PROMPT_CHARS);
			}
		}
	} catch (error) {
		if (error?.code !== "ENOENT") {
			const detail = error instanceof Error ? error.message : String(error);
			logger?.warn(`[expert-runtime-preparer] prompt read failed expertId=${expertId} filePath=${promptFilePath ?? "unknown"} error=${detail}`);
		}
		promptText = void 0;
	}
	return {
		fingerprint,
		canonical: {
			id: expertId,
			marketplace: candidate.marketplace,
			...runtimeIdentity ? { runtimeIdentity } : {}
		},
		pluginName: resolved.pluginName,
		agentName: resolved.agentName,
		expertType: resolved.expertType,
		displayName: displayNameOf(candidate, locale, resolved.agentName),
		...promptText ? {
			promptText,
			promptTruncated
		} : {}
	};
}
async function materializeAndValidate(pluginService, expertId, candidate, options) {
	const inspection = await inspectLandedBundle(pluginService.getExpertMarketplacePath(candidate.marketplace), candidate.marketplace, candidate.dirName);
	if (inspection.status === "incomplete-names") throw new ExpertRuntimePrepareError(EXPERT_UNAVAILABLE, `${EXPERT_UNAVAILABLE}: exact validate failed for ${expertId}@${candidate.marketplace}`);
	if (inspection.status === "complete") return assemblePreparedFacts(pluginService, expertId, inspection.candidate, options, {
		pluginName: inspection.candidate.pluginIdentity,
		agentName: inspection.candidate.agentName,
		expertType: inspection.candidate.expertType || "skill"
	});
	const activation = await pluginService.activateExpert(expertId, candidate.dirName, void 0, candidate.marketplace, void 0);
	if (!activation.success) throw new ExpertRuntimePrepareError(EXPERT_UNAVAILABLE, `${EXPERT_UNAVAILABLE}: failed to materialize ${expertId}@${candidate.marketplace}`);
	const manifest = await pluginService.getExpertManifestFromMarketplace(candidate.dirName, candidate.marketplace);
	const agentName = activation.agentName ?? await pluginService.getExpertAgentNameFromMarketplace(candidate.dirName, candidate.marketplace);
	const pluginName = activation.pluginRegisteredName ?? manifest?.name;
	if (!manifest?.name || !pluginName || !agentName) throw new ExpertRuntimePrepareError(EXPERT_UNAVAILABLE, `${EXPERT_UNAVAILABLE}: exact validate failed for ${expertId}@${candidate.marketplace}`);
	return assemblePreparedFacts(pluginService, expertId, candidate, options, {
		pluginName,
		agentName,
		expertType: activation.expertType || manifest.expertType || "skill"
	});
}
function createConversationExpertRuntimePreparer(deps) {
	const { pluginService } = deps;
	const readPromptFile = deps.readPromptFile ?? ((filePath) => node_fs_promises.readFile(filePath, "utf8"));
	const listOfficial = deps.listLandedOfficialExperts ?? (async () => listLandedOfficialExpertsFromMarketplace(pluginService.getExpertMarketplacePath("experts")));
	const marketplacePath = pluginService.getExpertMarketplacePath(EXPERTS_MARKETPLACE$1);
	const downloadOfficialByPluginName = async (queryId, pluginName) => {
		if (isUnsafeDirName(pluginName)) throw new ExpertRuntimePrepareError(EXPERT_UNAVAILABLE, `${EXPERT_UNAVAILABLE}: no landed candidate for ${queryId}`);
		const downloadUrl = deps.lookupOfficialDownloadUrl ? await deps.lookupOfficialDownloadUrl(queryId).catch(() => void 0) : void 0;
		if (!(await pluginService.activateExpert(queryId, pluginName, void 0, void 0, downloadUrl)).success) throw new ExpertRuntimePrepareError(EXPERT_UNAVAILABLE, `${EXPERT_UNAVAILABLE}: download failed for ${queryId}`);
		const afterDownload = await readOfficialExpertCandidateByDirName(marketplacePath, pluginName) ?? pickOfficialByPluginDirs(await listOfficial(), [pluginName])[0];
		if (!afterDownload) throw new ExpertRuntimePrepareError(EXPERT_UNAVAILABLE, `${EXPERT_UNAVAILABLE}: no landed candidate for ${queryId}`);
		return afterDownload;
	};
	return async ({ fingerprint, locale }) => {
		const expertId = fingerprint.expertId?.trim();
		if (!expertId) throw new ExpertRuntimePrepareError(EXPERT_UNAVAILABLE, `${EXPERT_UNAVAILABLE}: missing expert id`);
		const structured = parseStructuredRuntimeIdentity(fingerprint.expertRuntimeIdentity);
		const v2Hint = parseExpertV2PluginHint(fingerprint.expertRuntimeIdentity);
		const columnMarketplace = fingerprint.expertMarketplace?.trim() || void 0;
		let queryId = expertId;
		let scopedMarketplace;
		if (structured) {
			queryId = structured.id;
			scopedMarketplace = normalizeMarketplaceAlias(structured.marketplace);
		} else if (columnMarketplace) scopedMarketplace = normalizeMarketplaceAlias(columnMarketplace);
		else if (v2Hint) scopedMarketplace = EXPERTS_MARKETPLACE$1;
		const opQueryId = readMarketExpertIdFromRuntimeIdentity(fingerprint.expertRuntimeIdentity) ?? queryId;
		const materialize = (candidate) => materializeAndValidate(pluginService, queryId, candidate, {
			readPromptFile,
			locale,
			fingerprint,
			runtimeIdentity: fingerprint.expertRuntimeIdentity,
			logger: deps.logger
		});
		/**
		* 名字撞车时的定夺：先信 OP 的权威 plugin_name，OP 不可用（离线 / miss）再退到
		* expert-bundle-map.json 记的本机落地目录。后者记的是「上次实际启了哪个包」，
		* 曾经启错就会固化，所以只当兜底，不能排在 OP 前面。
		*/
		const disambiguate = async (matched) => {
			const pluginNames = [(await deps.lookupOfficialPluginName?.(opQueryId))?.trim(), (await pluginService.lookupLandedBundleHint?.(queryId))?.trim()];
			for (const pluginName of pluginNames) {
				if (!pluginName || isUnsafeDirName(pluginName)) continue;
				const picked = pickOfficialByPluginDirs(matched, [pluginName]);
				if (picked.length === 1) return picked[0];
			}
		};
		const resolveOfficialByOp = async (alreadyListedOfficial) => {
			const pluginName = (await deps.lookupOfficialPluginName?.(opQueryId))?.trim() || void 0;
			if (!pluginName || isUnsafeDirName(pluginName)) return;
			const pointHit = await readOfficialExpertCandidateByDirName(marketplacePath, pluginName);
			if (pointHit) return pointHit;
			const byPluginDir = pickOfficialByPluginDirs(alreadyListedOfficial ?? await listOfficial(), [pluginName]);
			if (byPluginDir.length === 1) return byPluginDir[0];
			if (byPluginDir.length > 1) {
				deps.logger?.warn?.(`[expert-runtime-preparer] ${EXPERT_ID_AMBIGUOUS}: ${byPluginDir.length} candidates for ${queryId} (resolveOfficialByOp), using first.`);
				return byPluginDir[0];
			}
			return downloadOfficialByPluginName(queryId, pluginName);
		};
		if (scopedMarketplace === "experts") {
			const pool = await listOfficial();
			const localMatched = dedupeCandidates(pool.filter((candidate) => candidateMatchesQuery(candidate, queryId)));
			if (localMatched.length === 1) return materialize(localMatched[0]);
			if (localMatched.length > 1) {
				const decided = await disambiguate(localMatched);
				if (decided) return materialize(decided);
				deps.logger?.warn?.(`[expert-runtime-preparer] ${EXPERT_ID_AMBIGUOUS}: ${localMatched.length} candidates for ${queryId} (official scope), using first.`);
				return materialize(localMatched[0]);
			}
			const official = await resolveOfficialByOp(pool);
			if (official) return materialize(official);
			throw new ExpertRuntimePrepareError(EXPERT_UNAVAILABLE, `${EXPERT_UNAVAILABLE}: no landed candidate for ${queryId}`);
		}
		let pool = [];
		let listedOfficial;
		if (scopedMarketplace === "my-experts") pool = await enumerateCustomCandidates(pluginService, queryId);
		else if (scopedMarketplace) pool = [];
		else {
			const [official, custom] = await Promise.all([listOfficial(), enumerateCustomCandidates(pluginService, queryId)]);
			listedOfficial = official;
			pool = [...official, ...custom];
		}
		const matched = dedupeCandidates(pool.filter((candidate) => candidateMatchesQuery(candidate, queryId)));
		if (matched.length === 1) return materialize(matched[0]);
		if (matched.length > 1) {
			const decided = scopedMarketplace ? void 0 : await disambiguate(matched);
			if (decided) return materialize(decided);
			deps.logger?.warn?.(`[expert-runtime-preparer] ${EXPERT_ID_AMBIGUOUS}: ${matched.length} candidates for ${queryId} (no-scope fallback), using first.`);
			return materialize(matched[0]);
		}
		if (!scopedMarketplace) {
			const official = await resolveOfficialByOp(listedOfficial);
			if (official) return materialize(official);
		}
		throw new ExpertRuntimePrepareError(EXPERT_UNAVAILABLE, `${EXPERT_UNAVAILABLE}: no landed candidate for ${queryId}`);
	};
}
//#endregion
//#region ../../packages/workbuddy-server/src/server/app-server-addons/conversation-runtime-config-provider.ts
/**
* ConversationRuntimeConfigProvider —— server 侧会话运行配置数据源。
*
* 把持久化 sessions 行 + `ctx.selection` 事实重建 `SessionDesiredConfig`，复用纯函数式
* `SessionRuntimeConfigResolver` 渲染 systemPrompt/tools/model，再投影为 core 编排链消费的
* `AddonDesiredConfig` / `AddonRuntimeConfig`。core 仍在其结果之上叠加 selection 事实
* （welcomeMode/permissionMode/addonSelection）。
*
* 纯工厂（依赖经参数注入），只依赖 desiredConfig + resolver，无 SessionManager 状态耦合；
* conversation session 与 SessionManager session 相互独立。
* 健壮性（bounded timeout / 普通会话降级 / 专家会话 fail-closed / 脱敏日志）由 core
* `resolveLaunchSpec` 统一收口；本 provider 不 log token/凭据/systemPrompt 全文，保持纯数据投影。
*/
var EXPERTS_MARKETPLACE = "experts";
/** 历史 Home reserve 可能写入的脏 key；落 CLI 前剥掉。 */
var RESERVE_FINGERPRINT_SETTINGS_KEY = "__wbReserveFingerprint";
/** Claw IM 禁用计划进出工具；Desktop 本地助理切 plan 时必须保留，否则模型无法退出计划。 */
var CLAW_PLAN_MODE_TOOLS = new Set(["EnterPlanMode", "ExitPlanMode"]);
var ARDOT_DESIGN_PROMPT_MARKER = "ardot-design-core";
var ARDOT_DESIGN_PROMPT_REQUIREMENT = [
	"<ardot-design-skill-requirement>",
	"For design tasks, follow the Ardot design Skills injected into this conversation ",
	"(`ardot-design-core` plus the matching domain skill) and execute their workflow strictly.",
	"</ardot-design-skill-requirement>"
].join("\n");
function ensureArdotDesignPromptContract(systemPrompt, welcomeMode) {
	if (welcomeMode !== "design" || systemPrompt === void 0) return systemPrompt;
	if (systemPrompt.includes(ARDOT_DESIGN_PROMPT_MARKER)) return systemPrompt;
	return `${systemPrompt.trimEnd()}\n\n${ARDOT_DESIGN_PROMPT_REQUIREMENT}`;
}
var EXPERT_RUNTIME_REGISTRY_LIMIT = 256;
var EXPERT_RUNTIME_REGISTRY_TTL_MS = 1800 * 1e3;
/**
* 从持久化行 + `ctx.selection` 重建 `SessionDesiredConfig`。
* mode / welcomeMode / permissionMode 以 selection 事实优先、回退持久化列，并各经归一化。
*/
function buildDesiredConfig(stored, ctx) {
	const mode = require_tar.normalizeSceneMode(stored.mode ?? ctx.selection?.interactionMode);
	const welcomeMode = require_tar.normalizeWelcomeMode(ctx.selection?.welcomeMode ?? stored.sourceMode);
	const explicitPermissionMode = require_tar.normalizePermissionMode(ctx.selection?.permissionMode ?? stored.permissionMode);
	const effectiveExplicitPermissionMode = require_tar.isPermissionModeWeakerThanSceneDefault(mode, explicitPermissionMode) ? void 0 : explicitPermissionMode;
	const permissionMode = mode === "plan" ? require_tar.resolveDefaultPermissionMode(mode) : effectiveExplicitPermissionMode ?? require_tar.resolveDefaultPermissionMode(mode);
	const expertMarketplace = normalizeExpertMarketplace(stored.expertMarketplace);
	const clawRuntime = require_server.readClawConversationRuntimeSettings(stored.sessionSettings);
	const cliSessionSettings = copyCliSessionSettings(stored.sessionSettings, mode);
	if (typeof stored.useSandboxCLI === "boolean") cliSessionSettings.sandbox = {
		...asRecord(cliSessionSettings.sandbox),
		enabled: stored.useSandboxCLI
	};
	const disabledTools = new Set(clawRuntime?.disabledTools ?? []);
	if (mode === "plan") for (const tool of CLAW_PLAN_MODE_TOOLS) disabledTools.delete(tool);
	const tools = (clawRuntime?.disabledTools?.length ?? 0) > 0 ? require_tar.resolveModeTools(mode).split(",").map((tool) => tool.trim()).filter((tool) => tool && !disabledTools.has(tool)).join(",") : void 0;
	return {
		...mode ? { mode } : {},
		...stored.expertId ? { expertId: stored.expertId } : {},
		...expertMarketplace ? { expertMarketplace } : {},
		...stored.expertLocale ? { locale: stored.expertLocale } : {},
		...stored.expertRuntimeIdentity ? { runtimeIdentity: stored.expertRuntimeIdentity } : {},
		...stored.model ? { model: stored.model } : {},
		...clawRuntime?.systemPrompt ? { systemPrompt: clawRuntime.systemPrompt } : {},
		...tools !== void 0 ? { tools } : {},
		...permissionMode ? { permissionMode } : {},
		...welcomeMode ? { welcomeMode } : {},
		...Object.keys(cliSessionSettings).length > 0 ? { sessionSettings: cliSessionSettings } : {}
	};
}
/**
* 浅拷贝 sessionSettings 供 --settings 转发。plan 模式下再深拷贝 claw.runtime /
* disabledTools，从副本去掉 EnterPlanMode/ExitPlanMode，不 mutate 持久化嵌套对象。
*/
function copyCliSessionSettings(sessionSettings, mode) {
	const cliSessionSettings = { ...sessionSettings ?? {} };
	delete cliSessionSettings.automation;
	delete cliSessionSettings[RESERVE_FINGERPRINT_SETTINGS_KEY];
	if (mode !== "plan") return cliSessionSettings;
	const clawRuntimeRaw = cliSessionSettings[require_server.CLAW_CONVERSATION_RUNTIME_SETTINGS_KEY];
	if (!clawRuntimeRaw || typeof clawRuntimeRaw !== "object" || Array.isArray(clawRuntimeRaw)) return cliSessionSettings;
	const clawRuntime = clawRuntimeRaw;
	if (!Array.isArray(clawRuntime.disabledTools)) return cliSessionSettings;
	cliSessionSettings[require_server.CLAW_CONVERSATION_RUNTIME_SETTINGS_KEY] = {
		...clawRuntime,
		disabledTools: clawRuntime.disabledTools.filter((tool) => !(typeof tool === "string" && CLAW_PLAN_MODE_TOOLS.has(tool)))
	};
	return cliSessionSettings;
}
function asRecord(value) {
	return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function stripReserveFingerprint(sessionSettings) {
	if (!sessionSettings) return;
	const rest = { ...sessionSettings };
	delete rest[RESERVE_FINGERPRINT_SETTINGS_KEY];
	return Object.keys(rest).length > 0 ? rest : void 0;
}
/**
* 无 sqlite 行时按 selection 合成 StoredSession（不含 expert：selection 没有 expert 字段）。
* 无 stored 且无 selection：仍 undefined。
*/
function synthesizeStoredFromContext(ctx) {
	const selection = ctx.selection;
	if (!selection) return;
	return {
		id: ctx.conversationId,
		cwd: ctx.cwd,
		userId: "",
		status: "active",
		createdAt: 0,
		updatedAt: 0,
		mode: selection.interactionMode,
		sourceMode: selection.welcomeMode,
		permissionMode: selection.permissionMode,
		sessionSettings: stripReserveFingerprint(ctx.sessionSettings)
	};
}
function resolveStoredSession(resolveSessionRow, ctx) {
	return resolveSessionRow(ctx.conversationId) ?? synthesizeStoredFromContext(ctx);
}
function normalizeExpertMarketplace(marketplace) {
	if (marketplace === "builtin") return EXPERTS_MARKETPLACE;
	if (marketplace === "custom") return require_tar.CUSTOM_EXPERT_MY_EXPERT_DIR_NAME;
	return marketplace || void 0;
}
/** 只认找不到专家；两个包撞名不走这条。 */
function isExpertUnavailablePrepareError(error) {
	if (!error || typeof error !== "object") return false;
	const record = error;
	if (record.prepareErrorCode === "EXPERT_UNAVAILABLE") return true;
	return typeof record.message === "string" && record.message.startsWith("EXPERT_UNAVAILABLE");
}
function stripExpertFromWorkerConfig(config) {
	const desired = { ...config.desired ?? {} };
	delete desired.expertId;
	delete desired.expertMarketplace;
	delete desired.runtimeIdentity;
	return {
		...config,
		desired,
		runtime: { value: config.runtime?.value ?? {} }
	};
}
function rawFingerprintOf(stored) {
	return {
		...stored.expertId ? { expertId: stored.expertId } : {},
		...stored.expertMarketplace ? { expertMarketplace: stored.expertMarketplace } : {},
		...stored.expertRuntimeIdentity ? { expertRuntimeIdentity: stored.expertRuntimeIdentity } : {}
	};
}
function applyPreparedExpertSettings(baseSettings, facts, expertRuntime) {
	const settings = baseSettings ?? {};
	const enabledPlugins = asRecord(settings.enabledPlugins);
	const extraKnownMarketplaces = asRecord(settings.extraKnownMarketplaces);
	const env = asRecord(settings.env);
	const existingHeaders = typeof env.CODEBUDDY_CUSTOM_HEADERS === "string" ? env.CODEBUDDY_CUSTOM_HEADERS.trim() : "";
	const expertHeaders = [`X-Expert-Id: ${facts.canonical.id}`, ...facts.expertType === "team" ? ["X-Expert-Team-Task: true"] : []];
	const marketplace = facts.canonical.marketplace;
	return {
		...settings,
		enabledPlugins: require_server.withSummonedExpertPlugin(enabledPlugins, `${facts.pluginName}@${marketplace}`),
		extraKnownMarketplaces: {
			...extraKnownMarketplaces,
			[marketplace]: { source: {
				source: "directory",
				url: expertRuntime.pluginService.getExpertMarketplacePath(marketplace)
			} }
		},
		env: {
			...env,
			CODEBUDDY_CUSTOM_HEADERS: [existingHeaders, ...expertHeaders].filter(Boolean).join("\n")
		}
	};
}
function createConversationRuntimeConfigProvider(deps) {
	const { resolveSessionRow, resolver, logger } = deps;
	const registry = /* @__PURE__ */ new Map();
	const inflight = /* @__PURE__ */ new Map();
	let generationClock = 0;
	const prepareExpertRuntime = deps.expertRuntime ? deps.expertRuntime.prepareExpertRuntime ?? createConversationExpertRuntimePreparer({
		pluginService: deps.expertRuntime.pluginService,
		logger: deps.logger
	}) : void 0;
	const touchRecord = (conversationId) => {
		const existing = registry.get(conversationId);
		if (existing) {
			existing.updatedAt = Date.now();
			return existing;
		}
		const created = {
			fingerprint: {},
			generation: 0,
			revision: 0,
			updatedAt: Date.now()
		};
		registry.set(conversationId, created);
		evictRegistry();
		return created;
	};
	const evictRegistry = () => {
		const now = Date.now();
		for (const [id, record] of registry) if (now - record.updatedAt > EXPERT_RUNTIME_REGISTRY_TTL_MS) registry.delete(id);
		while (registry.size > EXPERT_RUNTIME_REGISTRY_LIMIT) {
			const oldest = registry.keys().next().value;
			if (oldest === void 0) break;
			registry.delete(oldest);
		}
	};
	const forget = (conversationId) => {
		registry.delete(conversationId);
		for (const key of inflight.keys()) if (key.startsWith(`${conversationId}::`)) inflight.delete(key);
	};
	const getPreparedExpertRuntimeFacts = (conversationId) => {
		evictRegistry();
		const record = registry.get(conversationId);
		const published = record?.published;
		if (!published) return;
		const stored = resolveSessionRow(conversationId);
		const fingerprint = stored ? rawFingerprintOf(stored) : {};
		if (!fingerprintsEqual(published.fingerprint, fingerprint)) return;
		record.updatedAt = Date.now();
		return published;
	};
	const publishTombstone = (conversationId, fingerprint, generation, revision) => {
		const record = touchRecord(conversationId);
		if (generation < record.generation) return;
		record.fingerprint = fingerprint;
		record.generation = generation;
		record.revision = revision;
		record.pending = void 0;
		record.published = {
			status: "tombstone",
			fingerprint
		};
	};
	const stagePrepared = (conversationId, facts, generation, revision) => {
		const record = touchRecord(conversationId);
		if (generation < record.generation) return false;
		record.fingerprint = facts.fingerprint;
		record.generation = generation;
		record.revision = revision;
		record.pending = facts;
		return true;
	};
	const prepareForLaunch = async (stored) => {
		const runtime = deps.expertRuntime;
		if (!runtime || !prepareExpertRuntime) return "tombstone";
		const fingerprint = rawFingerprintOf(stored);
		if (!stored.expertId) {
			runtime.agentTeamsEnvResolver.recordSessionExpertType(stored.id, void 0);
			const generation = ++generationClock;
			const revision = runtime.getRuntimeRevision?.() ?? 0;
			publishTombstone(stored.id, fingerprint, generation, revision);
			return "tombstone";
		}
		const reused = registry.get(stored.id);
		if (reused?.pending && fingerprintsEqual(reused.pending.fingerprint, fingerprint)) return reused.pending;
		if (reused?.published?.status === "launchReady" && fingerprintsEqual(reused.published.fingerprint, fingerprint)) return reused.published.facts;
		const revision = runtime.getRuntimeRevision?.() ?? 0;
		const inflightKey = `${stored.id}::${rawExpertFingerprintKey(fingerprint)}::${revision}`;
		const existing = inflight.get(inflightKey);
		if (existing) return existing;
		const generation = ++generationClock;
		const record = touchRecord(stored.id);
		record.generation = generation;
		const pending = prepareExpertRuntime({
			fingerprint,
			locale: stored.expertLocale
		}).then((facts) => {
			if (stagePrepared(stored.id, facts, generation, revision)) runtime.agentTeamsEnvResolver.recordSessionExpertType(stored.id, facts.expertType);
			return facts;
		}).catch(async (error) => {
			if (!isExpertUnavailablePrepareError(error)) throw error;
			runtime.agentTeamsEnvResolver.recordSessionExpertType(stored.id, void 0);
			publishTombstone(stored.id, fingerprint, generation, revision);
			return "tombstone";
		});
		inflight.set(inflightKey, pending);
		try {
			return await pending;
		} finally {
			if (inflight.get(inflightKey) === pending) inflight.delete(inflightKey);
		}
	};
	const peekPreparedForLaunch = (stored) => {
		if (!stored.expertId) return "tombstone";
		const fingerprint = rawFingerprintOf(stored);
		const reused = registry.get(stored.id);
		if (reused?.pending && fingerprintsEqual(reused.pending.fingerprint, fingerprint)) return reused.pending;
		if (reused?.published?.status === "launchReady" && fingerprintsEqual(reused.published.fingerprint, fingerprint)) return reused.published.facts;
		if (reused?.published?.status === "tombstone" && fingerprintsEqual(reused.published.fingerprint, fingerprint)) return "tombstone";
	};
	const provider = {
		resolvePromptDesiredConfig(ctx) {
			const stored = resolveStoredSession(resolveSessionRow, ctx);
			return stored ? buildDesiredConfig(stored, ctx) : void 0;
		},
		async resolveDesiredConfig(ctx) {
			const stored = resolveStoredSession(resolveSessionRow, ctx);
			if (!stored) return;
			const desiredConfig = buildDesiredConfig(stored, ctx);
			return {
				...desiredConfig.mode ? { mode: desiredConfig.mode } : {},
				...desiredConfig.expertId ? { expertId: desiredConfig.expertId } : {},
				...desiredConfig.expertMarketplace ? { expertMarketplace: desiredConfig.expertMarketplace } : {},
				...desiredConfig.locale ? { locale: desiredConfig.locale } : {},
				...desiredConfig.runtimeIdentity ? { runtimeIdentity: desiredConfig.runtimeIdentity } : {},
				...desiredConfig.welcomeMode ? { welcomeMode: desiredConfig.welcomeMode } : {},
				...desiredConfig.permissionMode ? { permissionMode: desiredConfig.permissionMode } : {},
				...desiredConfig.permissionModeBeforePlan ? { permissionModeBeforePlan: desiredConfig.permissionModeBeforePlan } : {}
			};
		},
		async resolveRuntimeConfig(ctx, options) {
			const stored = resolveStoredSession(resolveSessionRow, ctx);
			if (!stored) return;
			const desiredConfig = buildDesiredConfig(stored, ctx);
			const resolved = await resolver.resolveConfig({
				sessionId: ctx.conversationId,
				cwd: ctx.cwd,
				desiredConfig
			});
			let resolvedSessionSettings = resolved.sessionSettings;
			if (deps.expertRuntime) {
				const prepared = options?.materializeExpert === false ? peekPreparedForLaunch(stored) : await prepareForLaunch(stored);
				if (prepared && prepared !== "tombstone") resolvedSessionSettings = applyPreparedExpertSettings(resolved.sessionSettings, prepared, deps.expertRuntime);
			}
			const systemPrompt = ensureArdotDesignPromptContract(resolved.systemPrompt, desiredConfig.welcomeMode);
			const language = deps.resolveLanguage?.();
			const sessionSettings = language && (!resolvedSessionSettings || resolvedSessionSettings.language === void 0) ? {
				...resolvedSessionSettings ?? {},
				language
			} : resolvedSessionSettings;
			let promptVarsFile;
			try {
				promptVarsFile = require_server.writeAgentCliPromptVarsFile(ctx.conversationId, resolved.promptVariables) ?? void 0;
			} catch (error) {
				logger?.warn(`[conversation-runtime-config] prompt-vars write failed sessionId=${ctx.conversationId} message=${error instanceof Error ? error.message : String(error)}`);
				promptVarsFile = void 0;
			}
			let systemPromptFile;
			try {
				systemPromptFile = require_server.writeAgentCliSystemPromptFile(ctx.conversationId, systemPrompt) ?? void 0;
			} catch (error) {
				logger?.warn(`[conversation-runtime-config] system-prompt write failed sessionId=${ctx.conversationId} message=${error instanceof Error ? error.message : String(error)}`);
				systemPromptFile = void 0;
			}
			return {
				...systemPrompt !== void 0 ? { systemPrompt } : {},
				...systemPromptFile ? { systemPromptFile } : {},
				...resolved.tools !== void 0 ? { tools: resolved.tools } : {},
				...resolved.model !== void 0 ? { model: resolved.model } : {},
				...sessionSettings !== void 0 ? { sessionSettings } : {},
				...resolved.welcomeMode !== void 0 ? { welcomeMode: resolved.welcomeMode } : {},
				...promptVarsFile ? { promptVarsFile } : {}
			};
		},
		async resolveBeforePromptRequests(ctx) {
			const stored = resolveStoredSession(resolveSessionRow, ctx);
			if (!stored?.expertId || !deps.expertRuntime || !prepareExpertRuntime) return;
			try {
				if (await prepareForLaunch(stored) === "tombstone") return;
			} catch (error) {
				throw require_server.markWorkerHookFailClosed(error instanceof Error ? error : new Error(String(error)));
			}
		},
		async refineConversationConfig(ctx, config) {
			const stored = resolveStoredSession(resolveSessionRow, ctx);
			const unavailable = (cause) => ({
				...config,
				runtime: {
					value: config.runtime?.value,
					error: new Error(`[conversation-runtime-config] expert runtime unavailable for session ${ctx.conversationId}`, cause === void 0 ? void 0 : { cause })
				}
			});
			if (!stored?.expertId) return stripExpertFromWorkerConfig(config);
			if (!deps.expertRuntime) return unavailable(config.runtime?.error);
			const prepared = peekPreparedForLaunch(stored);
			if (prepared === "tombstone") return stripExpertFromWorkerConfig(config);
			if (!prepared) return unavailable(config.runtime?.error);
			try {
				const value = await provider.resolveRuntimeConfig(ctx, { materializeExpert: false });
				if (value === void 0) return unavailable(config.runtime?.error);
				return {
					...config,
					runtime: { value }
				};
			} catch (error) {
				return unavailable(error);
			}
		},
		async activateExpertRuntimeForSession(ctx) {
			if (!deps.expertRuntime) return;
			const stored = resolveStoredSession(resolveSessionRow, ctx);
			const expertId = stored?.expertId;
			if (!stored || !expertId) return;
			const fingerprint = rawFingerprintOf(stored);
			const record = registry.get(ctx.conversationId);
			const facts = record?.pending && fingerprintsEqual(record.pending.fingerprint, fingerprint) ? record.pending : record?.published?.status === "launchReady" && fingerprintsEqual(record.published.fingerprint, fingerprint) ? record.published.facts : void 0;
			if (!facts) {
				logger?.info(`[conversation-runtime-config] skip activate because expert runtime facts missing sessionId=${ctx.conversationId} expertId=${expertId}`);
				return;
			}
			const current = touchRecord(ctx.conversationId);
			current.published = {
				status: "launchReady",
				fingerprint: facts.fingerprint,
				facts
			};
			current.pending = void 0;
			logger?.info(`[conversation-runtime-config] expert runtime published without plugin switch sessionId=${ctx.conversationId} agent=${facts.agentName} plugin=${facts.pluginName}@${facts.canonical.marketplace}`);
		},
		getPreparedExpertRuntimeFacts,
		forget,
		resolveAllowedTools() {
			return [...require_server.WORKBUDDY_AGENT_ALLOWED_TOOLS];
		},
		async resolveAgentTeams(sessionId) {
			const runtime = deps.expertRuntime;
			if (!runtime) return;
			if (!resolveSessionRow(sessionId)?.expertId) runtime.agentTeamsEnvResolver.recordSessionExpertType(sessionId, void 0);
			return runtime.agentTeamsEnvResolver.resolveForSession(sessionId);
		}
	};
	return provider;
}
//#endregion
//#region src/main/features/workflows/migration/file-localstorage-migration-service.ts
require_workbuddy_product_config.init_bundled_assets();
require_dev_env_override.init_dev_env_override();
require_workbuddy_product_config.init_workbuddy_product_config();
require_log_acl_guard.init_qimei_detector();
var FileBackedLegacyLocalStorageMigrationService = class {
	constructor(resultPath) {
		this.resultPath = resultPath;
	}
	async migrate() {
		if (!this.resultPath) return createSkippedLocalStorageResult("legacy_localstorage_result_path_missing");
		let raw;
		try {
			raw = node_fs.readFileSync(this.resultPath, "utf8");
		} catch (error) {
			return createSkippedLocalStorageResult(`legacy_localstorage_result_read_failed: ${formatError(error)}`);
		}
		try {
			return normalizeLocalStorageResult(JSON.parse(raw));
		} catch (error) {
			return createSkippedLocalStorageResult(`legacy_localstorage_result_parse_failed: ${formatError(error)}`);
		}
	}
};
function normalizeLocalStorageResult(value) {
	if (!value || typeof value !== "object") return createSkippedLocalStorageResult("legacy_localstorage_result_invalid");
	const record = value;
	const entries = isStringRecord(record.entries) ? record.entries : {};
	const sourceSessionPath = typeof record.sourceSessionPath === "string" ? record.sourceSessionPath : "";
	const currentSessionPath = typeof record.currentSessionPath === "string" ? record.currentSessionPath : "";
	const skipped = record.skipped === true;
	const reason = typeof record.reason === "string" ? record.reason : void 0;
	if (skipped) return {
		sourceSessionPath,
		currentSessionPath,
		skipped: true,
		reason,
		entries
	};
	return {
		sourceSessionPath,
		currentSessionPath,
		skipped: false,
		entries
	};
}
function createSkippedLocalStorageResult(reason) {
	return {
		sourceSessionPath: "",
		currentSessionPath: "",
		skipped: true,
		reason,
		entries: {}
	};
}
function isStringRecord(value) {
	if (!value || typeof value !== "object") return false;
	return Object.values(value).every((entry) => typeof entry === "string");
}
function formatError(error) {
	return error instanceof Error ? error.message : String(error);
}
//#endregion
//#region src/main/daemon/app-server/conversation-runtime-warm-cache.ts
require_workbuddy_paths.init_workbuddy_paths();
function createDaemonConversationRuntimeWarmCache(deps) {
	const { celljs } = deps;
	const resolveLocalHistoryConfigDir = () => require_workbuddy_paths.getWorkbuddyConfigDir();
	const getCurrentOwnerKey = () => require_server.getHostedCliSessionOwnerKey(celljs.authenticationManager.currentSessionSubject.getValue());
	const catalog = require_tar.isHostRuntimeCatalogEnabled() ? new require_tar.HostRuntimeCatalog({
		configDir: require_workbuddy_paths.getWorkbuddyConfigDir(),
		getCurrentOwnerKey,
		logger: deps.logger
	}) : void 0;
	const previous = require_tar.getBoundHostRuntimeCatalog();
	if (previous && previous !== catalog) {
		previous.stop();
		if (!catalog) require_tar.bindHostRuntimeCatalog(void 0);
	}
	if (catalog) {
		catalog.start();
		require_tar.bindHostRuntimeCatalog(catalog);
	}
	return {
		cache: new require_server.ConversationRuntimeWarmCache({
			configDir: require_workbuddy_paths.getWorkbuddyConfigDir(),
			getCurrentOwnerKey,
			resolveAccountFacts: async () => {
				deps.prewarmAgentExtraEnv();
				return { qimei36: await deps.resolveQimei36() };
			},
			loadConnectorTokenEnv: () => celljs.connectorService?.getSkillOnlyTokenEnv() ?? {},
			loadProjectMcpServersBySession: () => require_daemon_bootstrap.projectResourceManager.getMcpServersSnapshotBySession(),
			logger: deps.logger,
			catalog
		}),
		resolveLocalHistoryConfigDir
	};
}
//#endregion
//#region src/main/daemon/app-server/desktop-host-bridge.ts
function createAppServerDesktopHostBridge({ parent, events, appName, appVersion, appLocale, appConfigDir, isPackaged }) {
	return {
		...require_daemon_bootstrap.NOOP_DESKTOP_HOST,
		app: {
			...require_daemon_bootstrap.NOOP_DESKTOP_HOST.app,
			getName: () => appName || require_daemon_bootstrap.NOOP_DESKTOP_HOST.app.getName(),
			getVersion: () => appVersion || require_daemon_bootstrap.NOOP_DESKTOP_HOST.app.getVersion(),
			getLocale: () => appLocale || require_daemon_bootstrap.NOOP_DESKTOP_HOST.app.getLocale(),
			getConfigDir: () => appConfigDir || require_daemon_bootstrap.NOOP_DESKTOP_HOST.app.getConfigDir(),
			isPackaged: () => isPackaged === true,
			getAutoLaunchEnabled: async () => {
				const result = await parent.invoke(require_server.WORKBUDDY_APP_SERVER_HOST_RPC_CHANNELS.GET_AUTO_LAUNCH_ENABLED);
				if (typeof result !== "boolean") throw new Error("desktopHost:getAutoLaunchEnabled must return a boolean");
				return result;
			},
			setAutoLaunchEnabled: async (enabled) => {
				await parent.invoke(require_server.WORKBUDDY_APP_SERVER_HOST_RPC_CHANNELS.SET_AUTO_LAUNCH_ENABLED, { enabled });
			}
		},
		dialog: createBridgeDialog(parent),
		shell: {
			...require_daemon_bootstrap.NOOP_DESKTOP_HOST.shell,
			openExternal: async (url) => {
				const result = await parent.invoke(require_server.WORKBUDDY_APP_SERVER_HOST_RPC_CHANNELS.OPEN_EXTERNAL, url);
				const opened = result === false ? false : true;
				console.log(`[DesktopHostBridge] openExternal RPC result=${String(result)} -> opened=${opened} for: ${url}`);
				return opened;
			},
			openPath: async (filePath) => {
				const result = await parent.invoke(require_server.WORKBUDDY_APP_SERVER_HOST_RPC_CHANNELS.OPEN_PATH, filePath);
				return typeof result === "string" ? result : "";
			},
			showItemInFolder: async (filePath) => {
				await parent.invoke(require_server.WORKBUDDY_APP_SERVER_HOST_RPC_CHANNELS.SHOW_ITEM_IN_FOLDER, filePath);
			}
		},
		network: {
			...require_daemon_bootstrap.NOOP_DESKTOP_HOST.network,
			fetch: async (url, init) => fetch(url, init),
			getDefaultSession: () => createBridgeSession(parent, "default"),
			getSessionPartition: (partition) => createBridgeSession(parent, partitionToScope(partition)),
			clearDefaultSessionCookiesForDomains: async (domains) => {
				const result = await parent.invoke(require_server.WORKBUDDY_APP_SERVER_HOST_RPC_CHANNELS.CLEAR_DEFAULT_SESSION_COOKIES_FOR_DOMAINS, { domains });
				return typeof result === "number" ? result : 0;
			},
			resolveProxy: async (targetUrl) => {
				const result = await parent.invoke(require_server.WORKBUDDY_APP_SERVER_HOST_RPC_CHANNELS.RESOLVE_PROXY, { targetUrl });
				return typeof result === "string" ? result : "DIRECT";
			},
			applyProxySettings: async (settings) => {
				const result = await parent.invoke(require_server.WORKBUDDY_APP_SERVER_HOST_RPC_CHANNELS.APPLY_PROXY_SETTINGS, { settings });
				if (result && typeof result === "object" && "HTTP_PROXY" in result && "HTTPS_PROXY" in result && "NO_PROXY" in result) return result;
				return {
					HTTP_PROXY: "",
					HTTPS_PROXY: "",
					NO_PROXY: ""
				};
			}
		},
		auth: {
			...require_daemon_bootstrap.NOOP_DESKTOP_HOST.auth,
			decryptLegacyAuthSession: async (encryptedBase64) => {
				const result = await parent.invoke(require_server.WORKBUDDY_APP_SERVER_HOST_RPC_CHANNELS.DECRYPT_LEGACY_AUTH_SESSION, { encryptedBase64 });
				return typeof result === "string" ? result : void 0;
			},
			getTuringDeviceToken: async () => {
				const result = await parent.invoke(require_server.WORKBUDDY_APP_SERVER_HOST_RPC_CHANNELS.GET_TURING_DEVICE_TOKEN);
				return typeof result === "string" && result.trim() ? result : void 0;
			}
		},
		permissions: {
			...require_daemon_bootstrap.NOOP_DESKTOP_HOST.permissions,
			getMicrophonePermissionStatus: () => "unknown",
			getMicrophonePermission: async () => readMicrophonePermission(await parent.invoke(require_server.WORKBUDDY_APP_SERVER_HOST_RPC_CHANNELS.MICROPHONE_PERMISSION)),
			requestMicrophonePermission: async () => readMicrophonePermission(await parent.invoke(require_server.WORKBUDDY_APP_SERVER_HOST_RPC_CHANNELS.REQUEST_MICROPHONE_PERMISSION)),
			openMicrophoneSystemSettings: async () => {
				await parent.invoke(require_server.WORKBUDDY_APP_SERVER_HOST_RPC_CHANNELS.OPEN_MICROPHONE_PERMISSION_SETTINGS);
			}
		},
		clientTools: { execute: (request) => parent.invoke(require_server.WORKBUDDY_APP_SERVER_HOST_RPC_CHANNELS.CLIENT_TOOL_EXECUTE, request) },
		window: {
			...require_daemon_bootstrap.NOOP_DESKTOP_HOST.window,
			send(channel, data) {
				events.push(channel, data);
				return true;
			},
			getColorScheme: async () => {
				try {
					const result = await parent.invoke(require_server.WORKBUDDY_APP_SERVER_HOST_RPC_CHANNELS.GET_COLOR_SCHEME);
					return result === "dark" || result === "light" ? result : void 0;
				} catch {
					return;
				}
			}
		},
		showTaskCompletedNotification(payload) {
			events.push(require_server.WORKBUDDY_APP_SERVER_HOST_EVENT_CHANNELS.TASK_COMPLETED_NOTIFICATION, payload);
			return true;
		},
		showTaskPendingNotification(payload) {
			events.push(require_server.WORKBUDDY_APP_SERVER_HOST_EVENT_CHANNELS.TASK_PENDING_NOTIFICATION, payload);
			return true;
		}
	};
}
function createBridgeSession(parent, scope) {
	return { cookies: {
		async set(details) {
			await parent.invoke(require_server.WORKBUDDY_APP_SERVER_HOST_RPC_CHANNELS.COOKIE_SET, {
				scope,
				details
			});
		},
		async get(filter) {
			const result = await parent.invoke(require_server.WORKBUDDY_APP_SERVER_HOST_RPC_CHANNELS.COOKIE_GET, {
				scope,
				filter
			});
			return Array.isArray(result) ? result : [];
		},
		async remove(url, name) {
			await parent.invoke(require_server.WORKBUDDY_APP_SERVER_HOST_RPC_CHANNELS.COOKIE_REMOVE, {
				scope,
				url,
				name
			});
		}
	} };
}
function readMicrophonePermission(value) {
	switch (value) {
		case "not-determined":
		case "granted":
		case "denied":
		case "restricted":
		case "unknown": return value;
		default: return "unknown";
	}
}
function partitionToScope(partition) {
	if (partition === "persist:tdoc-import") return "tdoc-import";
	if (partition === "persist:tdoc-preview") return "tdoc-preview";
	throw new Error(`Unsupported app-server desktop host partition: ${partition}`);
}
function createBridgeDialog(parent) {
	return {
		async showOpenDialog(options) {
			const params = {
				title: options.title,
				defaultPath: options.defaultPath,
				filters: options.filters,
				properties: options.properties
			};
			return readOpenDialogResult(await parent.invoke(require_server.WORKBUDDY_APP_SERVER_HOST_RPC_CHANNELS.SHOW_OPEN_DIALOG, params));
		},
		async showSaveDialog(options) {
			const params = {
				title: options.title,
				defaultPath: options.defaultPath,
				filters: options.filters
			};
			return readSaveDialogResult(await parent.invoke(require_server.WORKBUDDY_APP_SERVER_HOST_RPC_CHANNELS.SHOW_SAVE_DIALOG, params));
		},
		async showMessageBox(options) {
			const params = {
				type: options.type,
				title: options.title,
				message: options.message,
				detail: options.detail,
				buttons: options.buttons,
				defaultId: options.defaultId,
				cancelId: options.cancelId,
				noLink: options.noLink
			};
			return readMessageBoxResult(await parent.invoke(require_server.WORKBUDDY_APP_SERVER_HOST_RPC_CHANNELS.SHOW_MESSAGE_BOX, params));
		}
	};
}
function readOpenDialogResult(value) {
	if (!value || typeof value !== "object") return {
		canceled: true,
		filePaths: []
	};
	const record = value;
	const filePaths = Array.isArray(record.filePaths) ? record.filePaths.filter((item) => typeof item === "string") : [];
	return {
		canceled: record.canceled !== false && filePaths.length === 0,
		filePaths
	};
}
function readSaveDialogResult(value) {
	if (!value || typeof value !== "object") throw new Error("desktopHost.showSaveDialog returned an invalid result");
	const record = value;
	if (record.canceled === true) return { canceled: true };
	const filePath = typeof record.filePath === "string" && record.filePath.trim() ? record.filePath : void 0;
	if (!filePath) throw new Error("desktopHost.showSaveDialog returned an invalid result");
	return {
		canceled: false,
		filePath
	};
}
function readMessageBoxResult(value) {
	if (!value || typeof value !== "object") return { response: 0 };
	const record = value;
	return { response: typeof record.response === "number" ? record.response : 0 };
}
//#endregion
//#region src/main/daemon/daemon-app-server-main.ts
/**
* daemon 各业务服务优雅关停的预算。
*
* 父进程 `DaemonProcessManager.stop()` 在 SHUTDOWN RPC 之后只等
* `DEFAULT_STOP_TIMEOUT_MS`(5s) 就 SIGTERM。被 SIGTERM 打断意味着 `finalizeDaemonShutdown()`
* 里的 WAL checkpoint 一定跑不到（线上就是这样丢的）。所以这里留 1s 余量自行收尾，
* 保证退出前的收口动作一定执行完。
*/
var DAEMON_SERVICES_STOP_BUDGET_MS = 4e3;
/**
* daemon 子进程侧启动打点（F 段）。daemon 已在入口 initStartupContextFromEnv('daemon')，
* 故 mark 会带 source=daemon、pid=main pid，落进同一个 `<pid>-<time>.jsonl`，供瀑布分泳道
* 展示 daemon 与 main(C)/renderer(E) 的并行。直接用 perf logger，不引 electron（守卫约束）。
* 全程吞异常，绝不阻塞 daemon 启动。
*/
function markDaemon(id) {
	try {
		const def = require_package_and_show_log.STARTUP_MARKS[id];
		if (!def) return;
		require_logger$1.getWorkbuddyPerfLogger(require_logger$1.PerfFlow.STARTUP).mark(def.key, {
			id: def.id,
			phase: def.phase
		});
	} catch {}
}
function requireStdioMode() {
	require_server.assertWorkbuddyAppServerStdioMode(process.argv);
}
var daemonAppServerLogger = {
	info: (message, ...args) => {
		require_logger.createWorkbuddyScopedLogger("daemon-app-server").info(message, ...args);
	},
	warn: (message, ...args) => {
		require_logger.createWorkbuddyScopedLogger("daemon-app-server").warn(message, ...args);
	},
	error: (message, ...args) => {
		require_logger.createWorkbuddyScopedLogger("daemon-app-server").error(message, ...args);
	}
};
async function runDaemonAppServerEntry() {
	requireStdioMode();
	const expectedCredentialProtectionMode = require_credential_protection_bootstrap.readWorkbuddyCredentialProtectionMode(process.env);
	delete process.env[require_credential_protection_bootstrap.WORKBUDDY_CREDENTIAL_PROTECTION_ENV];
	if (expectedCredentialProtectionMode === "required") require_credential_protection.setCredentialProtectionPending();
	require_workbuddy_product_config.setBundledAssetsRoot(__dirname);
	markDaemon("F1");
	const platform = require_server.createWorkbuddyAppServerPlatformFromEnv({ processResourcesPath: process.resourcesPath });
	require_server.configureWorkbuddyAppServerRuntimeContextFromEnv(platform);
	const daemonServer = new require_server.DaemonServer({ logger: {
		info: (message, meta) => daemonAppServerLogger.info(message, meta ?? {}),
		warn: (message, meta) => daemonAppServerLogger.warn(message, meta ?? {})
	} });
	const credentialProtectionGate = new require_credential_protection_bootstrap.DaemonCredentialProtectionBootstrapGate(expectedCredentialProtectionMode, (bootstrap) => {
		if (!require_credential_protection.configureCredentialProtection(bootstrap)) daemonAppServerLogger.warn("[CredentialProtection] conflicting late bootstrap ignored");
	});
	credentialProtectionGate.register(daemonServer);
	const parentHost = require_server.createStdioParentRpcClient({ output: process.stdout });
	const desktopHost = createAppServerDesktopHostBridge({
		parent: parentHost,
		events: daemonServer,
		appName: process.env.WORKBUDDY_APP_NAME,
		appVersion: platform.appVersion,
		appLocale: platform.appLocale(),
		appConfigDir: platform.configDir,
		isPackaged: platform.isPackaged
	});
	const syncTencentDocsEngineOriginToMain = (origin) => {
		parentHost.invoke(require_server.WORKBUDDY_APP_SERVER_HOST_RPC_CHANNELS.TENCENT_DOCS_ENGINE_ORIGIN_CHANGED, { ...origin ? { origin } : {} }).catch((error) => {
			daemonAppServerLogger.warn("Failed to sync Tencent Docs engine origin to main:", error);
		});
	};
	const disposeTencentDocsEngineOriginSync = require_tencent_docs_prompt_selection.onActiveTencentDocsEngineOriginChange(syncTencentDocsEngineOriginToMain);
	syncTencentDocsEngineOriginToMain(require_tencent_docs_prompt_selection.getActiveTencentDocsEngineOrigin());
	require_file_authentication_storage.setWorkbuddyLegacyAuthSessionMigrator(require_legacy_auth_session_migrator.createLegacyAuthSessionMigrator({ decryptString: (encrypted) => desktopHost.auth.decryptLegacyAuthSession(encrypted.toString("base64")) }, daemonAppServerLogger));
	const resolveDaemonProxyEnv = () => require_daemon_bootstrap.resolveProxyEnv(void 0, { resolveProxy: (targetUrl) => desktopHost.network.resolveProxy(targetUrl) });
	let celljsContainerReady = false;
	let daemonReady = false;
	const resources = {};
	/** 可能挂起的异步服务收尾。每一步都自带 catch，单点失败不阻断后续。 */
	const stopDaemonServices = async () => {
		parentHost.rejectPending(/* @__PURE__ */ new Error("Daemon app-server shutting down"));
		const background = await resources.backgroundPromise?.catch(() => void 0);
		await resources.wbBridge?.settleConversationsForShutdown().catch((error) => {
			daemonAppServerLogger.error("Failed to settle conversations before shutdown:", error);
		});
		await background?.stop().catch((error) => {
			daemonAppServerLogger.error("Failed to stop background services:", error);
		});
		await resources.wbBridge?.dispose().catch((error) => {
			daemonAppServerLogger.error("Failed to dispose conversation bridge:", error);
		});
		try {
			resources.mcpAppsHost?.stop();
		} catch (error) {
			daemonAppServerLogger.error("Failed to stop MCP Apps host:", error);
		}
		resources.disposeMigrationRuntimeHandlers?.();
		resources.hostPowerEvents?.dispose();
		await resources.pacRpc?.close().catch((error) => {
			daemonAppServerLogger.warn("Failed to stop PAC RPC service:", error);
		});
		try {
			disposeTencentDocsSelectionBroadcast();
		} catch {}
		await resources.daemon?.stop().catch((error) => {
			daemonAppServerLogger.error("Failed to stop daemon:", error);
		});
	};
	const servicesStopBudget = () => new Promise((resolve) => {
		setTimeout(() => {
			daemonAppServerLogger.warn(`[DaemonAppServer] service teardown exceeded ${DAEMON_SERVICES_STOP_BUDGET_MS}ms; finalizing shutdown anyway`);
			resolve();
		}, DAEMON_SERVICES_STOP_BUDGET_MS).unref?.();
	});
	/**
	* 退出前必须执行完的收口动作，全同步、幂等。
	* `resources.database?.dispose()` 是 SQLite WAL checkpoint，漏掉会留下 WAL 残留。
	*/
	let finalized = false;
	const finalizeDaemonShutdown = () => {
		if (finalized) return;
		finalized = true;
		try {
			disposeTencentDocsEngineOriginSync();
		} catch (error) {
			daemonAppServerLogger.warn("Failed to dispose tencent docs engine origin sync:", error);
		}
		try {
			resources.database?.dispose();
		} catch (error) {
			daemonAppServerLogger.error("Failed to dispose database:", error);
		}
		try {
			credentialProtectionGate.dispose();
			require_credential_protection.disposeCredentialProtection();
		} catch (error) {
			daemonAppServerLogger.warn("Failed to dispose credential protection:", error);
		}
	};
	const lifecycle = require_server.startWorkbuddyAppServerStdioLifecycle({
		server: daemonServer,
		emitReady: false,
		getPingStatus: () => ({
			ok: true,
			pid: process.pid,
			appVersion: platform.appVersion,
			celljsReady: celljsContainerReady,
			daemonReady
		}),
		shutdown: async () => {
			try {
				await Promise.race([stopDaemonServices(), servicesStopBudget()]);
			} finally {
				finalizeDaemonShutdown();
			}
		},
		flushCliPrewarmPool: async () => {
			await resources.daemon?.cliPrewarmPool?.flush();
			daemonAppServerLogger.info(`[DaemonAppServer] ${require_server.DAEMON_LIFECYCLE_RPC_CHANNELS.FLUSH_CLI_PREWARM_POOL} completed`);
		},
		logger: {
			error: (message, ...args) => {
				daemonAppServerLogger.error(message, ...args);
			},
			warn: (message, meta) => {
				daemonAppServerLogger.warn(message, meta ?? {});
			}
		},
		onUnhandledFrame: (frame) => parentHost.handleFrame(frame),
		exit: (code) => process.exit(code)
	});
	const credentialProtectionBootstrap = await credentialProtectionGate.wait(1e3);
	if (!require_credential_protection.configureCredentialProtection(credentialProtectionBootstrap)) daemonAppServerLogger.warn("[CredentialProtection] conflicting bootstrap ignored");
	if (credentialProtectionBootstrap.mode === "required" && !credentialProtectionBootstrap.symmetricKey) daemonAppServerLogger.warn("[CredentialProtection] key unavailable; continuing");
	daemonServer.handle("runtime:patchEnv", (env) => {
		for (const [key, value] of Object.entries(env)) if (typeof value === "string" && value) process.env[key] = value;
		daemonAppServerLogger.info("[Daemon] runtime:patchEnv applied", { keys: Object.keys(env) });
		return { ok: true };
	});
	daemonServer.handle("telemetry:updateQimei36", (params) => {
		const { qimei36 } = params ?? {};
		if (typeof qimei36 === "string" && qimei36.length > 0) {
			process.env.CODEBUDDY_QIMEI36 = qimei36;
			require_daemon_bootstrap.markQimei36Ready();
			daemonAppServerLogger.info("[QimeiUpdate] qimei36 updated via IPC");
		}
	});
	const pacStartedAt = Date.now();
	resources.pacRpc = await configureDaemonNetworkProxy(resolveDaemonProxyEnv, process.env.WORKBUDDY_PAC_RESOLVER === "off" ? void 0 : (targetUrl) => desktopHost.network.resolveProxy(targetUrl));
	daemonAppServerLogger.info(`[DaemonStartup] network proxy configured (${Date.now() - pacStartedAt}ms)`);
	const celljsStartedAt = Date.now();
	daemonAppServerLogger.info("[DaemonStartup] initializing CellJS container...");
	const celljsContainer = await require_daemon_bootstrap.initializeCellJSContainer({
		baseModules: require_module_base.baseModules,
		workbuddyModule: require_module_app_server.default,
		logger: {
			info: (message) => daemonAppServerLogger.info(message),
			error: (message) => daemonAppServerLogger.error(message)
		}
	});
	celljsContainerReady = true;
	daemonAppServerLogger.info(`[DaemonStartup] CellJS container ready (${Date.now() - celljsStartedAt}ms)`);
	const dbStartedAt = Date.now();
	const database = require_server.createInitializedWorkbuddyAppServerDatabase({
		configDir: platform.configDir,
		logger: { info: (message) => daemonAppServerLogger.info(message) }
	});
	resources.database = database;
	daemonAppServerLogger.info(`[DaemonStartup] database ready (${Date.now() - dbStartedAt}ms)`);
	markDaemon("F2");
	const celljs = require_daemon_bootstrap.resolveCellJSDeps(celljsContainer, {
		database,
		windowManager: require_server.createNoopWorkbuddyAppServerWindowManager(),
		getColorScheme: () => desktopHost.window.getColorScheme()
	});
	markDaemon("F3");
	const tencentDocsNativeHostPlatform = {
		osPlatform: platform.osPlatform ?? process.platform,
		showMessageBox: (options) => desktopHost.dialog.showMessageBox(options),
		showOpenDialog: (options) => desktopHost.dialog.showOpenDialog(options),
		showSaveDialog: (options) => desktopHost.dialog.showSaveDialog(options)
	};
	const reportTencentDocsPreviewTelemetry = (eventCode, payload) => {
		try {
			Promise.resolve(celljs.eventService.report(eventCode, payload)).catch((error) => {
				daemonAppServerLogger.warn("[TencentDocsPreviewTelemetry] report rejected:", eventCode, error);
			});
		} catch (error) {
			daemonAppServerLogger.warn("[TencentDocsPreviewTelemetry] report threw:", eventCode, error);
		}
	};
	const tencentDocsDocumentService = require_tencent_docs_prompt_selection.initializeTencentDocsDocumentService({
		requestDirtyEditorCloseDecision: require_tencent_docs_prompt_selection.createNativeHostDirtyEditorCloseDecision(tencentDocsNativeHostPlatform),
		requestOriginalFileConflictDecision: require_tencent_docs_prompt_selection.createNativeHostOriginalFileConflictDecision(tencentDocsNativeHostPlatform),
		notifyOriginalFileChanged: require_tencent_docs_prompt_selection.createNativeHostOriginalFileChangedNotifier(tencentDocsNativeHostPlatform),
		reportTelemetry: reportTencentDocsPreviewTelemetry
	});
	tencentDocsDocumentService.setEngineReadyHandler(() => {
		daemonServer.push(require_wb_source.TENCENT_DOCS_RENDERER_PUSH_CHANNELS.ENGINE_READY, {});
	});
	tencentDocsDocumentService.setPreviewReloadHandler((payload) => {
		daemonServer.push(require_wb_source.TENCENT_DOCS_RENDERER_PUSH_CHANNELS.RELOAD_EMBEDDED_PREVIEW, payload);
	});
	const tencentDocsMcp = require_tencent_docs_document_lifecycle_port.createTencentDocsEngineProvider({
		documentService: tencentDocsDocumentService,
		logger: daemonAppServerLogger
	});
	const localDocsFacade = require_docs.createLocalDocsHostFacade({
		documentService: tencentDocsDocumentService,
		platform: tencentDocsNativeHostPlatform,
		logger: daemonAppServerLogger,
		isTencentDocsAiEditEnabled: () => require_tar.resolveTencentDocsAiEditConfigEnabled(celljs.productManager?.getCurrentConfiguration?.()?.productFeatures, celljs.authenticationManager?.currentSessionSubject.getValue()?.account)
	});
	const disposeTencentDocsSelectionBroadcast = require_selection_broadcast.registerTencentDocsSelectionBroadcast({ push: (channel, data) => {
		daemonServer.push(channel, data);
	} });
	markDaemon("F4");
	const migrationService = new require_daemon_bootstrap.MigrationService(database, celljs.logger, void 0, void 0, {
		userIdProvider: () => celljs.authService.getAccount()?.uid,
		localStorageServiceFactory: () => new FileBackedLegacyLocalStorageMigrationService(process.env.WORKBUDDY_LEGACY_LOCALSTORAGE_MIGRATION_RESULT_PATH)
	});
	let baseMigrationRuntimeHandlersRegistered = false;
	const ensureBaseMigrationRuntimeHandlers = (server) => {
		if (baseMigrationRuntimeHandlersRegistered) return;
		resources.disposeMigrationRuntimeHandlers = require_server.registerWorkbuddyMainRuntimeHandlers(server, { migration: {
			getHistoryStatus: () => migrationService.getHistoryStatus(),
			replayArchived: (ids) => migrationService.replayArchivedManual(ids),
			getPendingLocalStorageMigration: () => migrationService.getPendingLocalStorageMigration(),
			completeLocalStorageMigration: (result) => migrationService.completeLocalStorageMigration(result),
			getArchivedSyncService: () => migrationService.getArchivedSyncService(),
			logger: {
				info: (message) => daemonAppServerLogger.info(message),
				warn: (message, ...args) => daemonAppServerLogger.warn(message, ...args),
				error: (message, ...args) => daemonAppServerLogger.error(message, ...args)
			}
		} });
		baseMigrationRuntimeHandlersRegistered = true;
	};
	markDaemon("F5");
	const runtimeManager = require_cli_prewarm_pool.createWorkbuddySidecarManager({
		credentialProtectionBootstrap,
		getConnectorTokenEnv: () => celljs.connectorService.getSkillOnlyTokenEnv(),
		getQimei36: () => process.env.CODEBUDDY_QIMEI36?.trim() || void 0,
		resolveProxyEnv: resolveDaemonProxyEnv,
		resolveCliEnvRouteMode: require_dev_env_override.resolveCliEnvRouteModeOverride
	});
	const bridgeToMain = (channel, payload) => {
		parentHost.invoke(channel, payload).catch(() => void 0);
	};
	const sendMetric = (payload) => bridgeToMain(require_server.WORKBUDDY_APP_SERVER_HOST_RPC_CHANNELS.MONITOR_REPORT_METRIC, payload);
	const chatPerfCollectorStub = {
		recordMessageDisplay: (data) => bridgeToMain(require_server.WORKBUDDY_APP_SERVER_HOST_RPC_CHANNELS.MONITOR_RECORD_MESSAGE_DISPLAY, data),
		recordFirstResponse: (data) => bridgeToMain(require_server.WORKBUDDY_APP_SERVER_HOST_RPC_CHANNELS.MONITOR_RECORD_FIRST_RESPONSE, data)
	};
	const remoteMonitorService = {
		applyRendererSessionId: (sessionId) => bridgeToMain(require_server.WORKBUDDY_APP_SERVER_HOST_RPC_CHANNELS.MONITOR_APPLY_RENDERER_SESSION_ID, { sessionId }),
		recordDuration: (metric, durationMs, dims) => sendMetric({
			kind: "duration",
			metric,
			value: durationMs,
			dims
		}),
		addCounter: (metric, count, dims) => sendMetric({
			kind: "counter",
			metric,
			value: count,
			dims
		}),
		reportEvent: (name, ext) => sendMetric({
			kind: "event",
			name,
			ext
		}),
		getChatPerfCollector: () => chatPerfCollectorStub
	};
	require_tar.setConnectorOAuthMetricReporter({
		recordDuration: (metric, durationMs, dims) => {
			sendMetric({
				kind: "duration",
				metric,
				value: durationMs,
				dims
			});
		},
		addCounter: (metric, count, dims) => {
			sendMetric({
				kind: "counter",
				metric,
				value: count,
				dims
			});
		}
	});
	markDaemon("F6");
	markDaemon("F7");
	const { NetworkGate } = await Promise.resolve().then(() => require("./network.js"));
	const networkGate = new NetworkGate({ logger: daemonAppServerLogger });
	const daemon = await require_daemon_bootstrap.bootstrapDaemon({
		celljs,
		credentialProtectionBootstrap,
		platform,
		runtimeManager,
		desktopHost,
		createRpcServer: () => daemonServer,
		rpcHandlerProfile: "daemon-app-server",
		rpcHandlerOptions: { getNetworkGate: () => networkGate },
		resolveProxyEnv: resolveDaemonProxyEnv,
		tencentDocsMcp,
		localDocsReleaseBridge: require_daemon_bootstrap.createLocalDocsReleaseBridgeFromFacade(localDocsFacade),
		localDocs: localDocsFacade,
		tencentDocsRuntime: {
			documentService: tencentDocsDocumentService,
			push: (channel, data) => daemonServer.push(channel, data),
			documentPreviewPoolCapacity: 5
		},
		localDocumentMediaTypes: require_daemon_bootstrap.createTencentDocsLocalDocumentMediaTypes(),
		createDocumentLifecycle: ({ sessionManager }) => {
			const documentLifecycle = require_daemon_bootstrap.createTencentDocsDocumentLifecycleDeps({
				sessionManager,
				documentService: tencentDocsDocumentService
			});
			tencentDocsDocumentService.setSessionConflictLookups({
				isSessionStillProcessing: documentLifecycle.isSessionStillProcessing,
				getSessionTitle: (sessionId) => require_tencent_docs_document_lifecycle_port.resolveStoredSessionTitle(database, sessionId)
			});
			return documentLifecycle;
		},
		monitorEvent: (name, ext) => {
			sendMetric({
				kind: "event",
				name,
				ext
			});
		},
		promptTraceReporters: {
			reportForwarding: (payload) => {
				parentHost.invoke(require_server.WORKBUDDY_APP_SERVER_HOST_RPC_CHANNELS.MONITOR_REPORT_PROMPT_FORWARDING, payload).catch(() => void 0);
			},
			reportDone: (payload) => {
				parentHost.invoke(require_server.WORKBUDDY_APP_SERVER_HOST_RPC_CHANNELS.MONITOR_REPORT_PROMPT_DONE, payload).catch(() => void 0);
			},
			reportTrace: async (payload) => {
				try {
					await parentHost.invoke(require_server.WORKBUDDY_APP_SERVER_HOST_RPC_CHANNELS.MONITOR_REPORT_PROMPT_TRACE, payload);
				} catch {}
			}
		},
		getMonitorService: () => remoteMonitorService,
		storeSessionCreateTiming: (sessionId, timing) => bridgeToMain(require_server.WORKBUDDY_APP_SERVER_HOST_RPC_CHANNELS.MONITOR_STORE_SESSION_CREATE_TIMING, {
			sessionId,
			timing
		}),
		onRpcReady: (server) => {
			ensureBaseMigrationRuntimeHandlers(server);
		},
		docsService: {
			getPreviewUrl: (filePath, options) => tencentDocsDocumentService.createPreviewUrl(filePath, options),
			dispose: () => tencentDocsDocumentService.dispose()
		},
		getSandboxPreviewMountService: () => resources.mcpAppsHost?.sandboxPreviewMountService,
		getSandboxPreviewHttpPort: () => resources.mcpAppsHost?.getSandboxPreviewHttpPort?.() ?? 0,
		getStaticHtmlServer: () => resources.mcpAppsHost?.staticHtmlServer
	});
	resources.daemon = daemon;
	markDaemon("F8");
	daemonReady = true;
	ensureBaseMigrationRuntimeHandlers(daemon.server);
	require_perf_profiler_handlers.registerPerfProfilerHandlers(daemon.server);
	const hostPowerEvents = require_server.createWorkbuddyAppServerHostPowerEvents();
	resources.hostPowerEvents = hostPowerEvents;
	hostPowerEvents.registerHandlers(daemon.server);
	celljs.automationSessionManager = daemon.sessionManager;
	celljs.connectorPowerEvents = hostPowerEvents;
	const conversationRuntimeConfigResolver = require_server.createSessionRuntimeConfigResolver(Promise.resolve({
		logger: celljs.logger,
		systemPromptService: celljs.systemPromptService
	}));
	const preparerHttp = require_runtime_http.createRuntimeContextFromCellDeps(celljs, {
		homeDir: platform.dataDir,
		logger: daemonAppServerLogger,
		fetch: (url, init) => fetch(url, init)
	}).http;
	const prepareConversationExpertRuntime = createConversationExpertRuntimePreparer({
		pluginService: celljs.expertPluginService,
		lookupOfficialPluginName: createLookupOfficialPluginName(preparerHttp, {
			logger: daemonAppServerLogger,
			manifestFallback: celljs.expertCenterService
		}),
		lookupOfficialDownloadUrl: createLookupOfficialDownloadUrl(preparerHttp, { logger: daemonAppServerLogger }),
		logger: celljs.logger
	});
	const conversationRuntimeConfigProvider = createConversationRuntimeConfigProvider({
		resolveSessionRow: (sessionId) => database.getSession(sessionId),
		resolver: conversationRuntimeConfigResolver,
		logger: celljs.logger,
		resolveLanguage: () => require_server.resolveCliSettingsLanguageFromDirs({
			getSystemLocale: () => platform.appLocale(),
			getConfigDir: () => platform.configDir,
			getUserDataDir: () => platform.dataDir
		}),
		expertRuntime: {
			pluginService: celljs.expertPluginService,
			agentTeamsEnvResolver: daemon.agentTeamsEnvResolver,
			prepareExpertRuntime: prepareConversationExpertRuntime
		}
	});
	const resolveConversationAgentExtraEnv = () => tencentDocsMcp.resolveAgentEnv();
	const prewarmConversationAgentExtraEnv = () => {
		resolveConversationAgentExtraEnv().catch((error) => {
			daemonAppServerLogger.warn("[ConversationRuntimeWarmCache] optional agent env prewarm failed", error);
		});
	};
	const resolveConversationQimei36 = () => require_log_acl_guard.getQimeiDetector().getAsync();
	const conversationRuntimeWarm = createDaemonConversationRuntimeWarmCache({
		celljs,
		prewarmAgentExtraEnv: prewarmConversationAgentExtraEnv,
		resolveQimei36: resolveConversationQimei36,
		logger: daemonAppServerLogger
	});
	resources.wbBridge = require_daemon_bootstrap.registerWBBridgeChannels(daemon.server, {
		celljs,
		desktopHost,
		measurementSink: { record: (metric) => sendMetric({
			kind: "measurement",
			metric
		}) },
		intentRecognition: celljsContainer.get(require_server.IntentRecognitionServiceToken),
		conversationRuntimeFacts: {
			resolveAgentTeams: (sessionId) => conversationRuntimeConfigProvider.resolveAgentTeams(sessionId),
			getProjectConversationEnv: (sessionId) => require_daemon_bootstrap.projectResourceManager.getEnvForSession(sessionId),
			getProjectMcpServersForConversation: (sessionId) => require_daemon_bootstrap.projectResourceManager.getMcpServersForSession(sessionId),
			resolveAgentExtraEnv: resolveConversationAgentExtraEnv,
			resolveConnectorTokenEnv: () => celljs.connectorService?.getSkillOnlyTokenEnv() ?? {},
			getConnectorRuntimeRevision: () => celljs.connectorService?.getRuntimeRevision() ?? 0,
			resolveQimei36: resolveConversationQimei36,
			resolveDesiredConfig: (ctx) => conversationRuntimeConfigProvider.resolveDesiredConfig(ctx),
			resolveRuntimeConfig: (ctx, options) => conversationRuntimeConfigProvider.resolveRuntimeConfig(ctx, options),
			resolveBeforePromptRequests: (ctx) => conversationRuntimeConfigProvider.resolveBeforePromptRequests(ctx),
			refineConversationConfig: (ctx, config) => conversationRuntimeConfigProvider.refineConversationConfig(ctx, config),
			activateExpertConversationRuntime: (ctx) => conversationRuntimeConfigProvider.activateExpertRuntimeForSession(ctx),
			forgetPreparedExpertRuntime: (conversationId) => conversationRuntimeConfigProvider.forget(conversationId),
			resolveAllowedTools: () => conversationRuntimeConfigProvider.resolveAllowedTools(),
			resolveMcpConfig: (ctx, toolSpecs) => celljs.sessionMcpConfigCoordinator.resolveConversationConfig({
				sessionId: ctx.conversationId,
				cwd: ctx.cwd,
				welcomeMode: ctx.selection?.welcomeMode,
				projectId: ctx.projectId,
				workspace: ctx.cwd,
				toolSpecs,
				interactionMode: ctx.selection?.interactionMode
			}),
			prepareConversationPrompt: require_server.createConversationPromptPreparer(celljs.userPromptService, daemonAppServerLogger, (conversationId) => conversationRuntimeConfigProvider.getPreparedExpertRuntimeFacts(conversationId)),
			runtimeWarmCache: conversationRuntimeWarm.cache
		}
	});
	lifecycle.signalReady();
	markDaemon("F9");
	const FIRST_RPC_YIELD_TICKS = 3;
	for (let tick = 0; tick < FIRST_RPC_YIELD_TICKS; tick += 1) await new Promise((resolve) => {
		setImmediate(resolve);
	});
	const FIRST_LOCAL_LIST_TIMEOUT_MS = 3e3;
	const firstLocalListGateReason = await Promise.race([resources.wbBridge.firstLocalListReady.then(() => "ready"), new Promise((resolve) => {
		setTimeout(() => resolve("timeout"), FIRST_LOCAL_LIST_TIMEOUT_MS).unref?.();
	})]);
	daemonAppServerLogger.info(`[FirstLocalListGate] released by "${firstLocalListGateReason}"`);
	const startupMigration = await require_server.startWorkbuddyAppServerStartupMigration({
		migrationService,
		productName: await resolveProductName(celljs),
		onHistoryProgress: (current, total, name) => {
			daemon.server.push(require_tar.MIGRATION_RPC_CHANNELS.HISTORY_PROGRESS, {
				current,
				total,
				name
			});
		},
		logger: {
			info: (message) => daemonAppServerLogger.info(message),
			warn: (message, ...args) => daemonAppServerLogger.warn(message, ...args)
		}
	});
	markDaemon("F10");
	resources.disposeMigrationRuntimeHandlers?.();
	resources.disposeMigrationRuntimeHandlers = require_server.registerWorkbuddyMainRuntimeHandlers(daemon.server, { migration: startupMigration.createRuntimeHandlersDeps({ logger: {
		info: (message) => daemonAppServerLogger.info(message),
		warn: (message, ...args) => daemonAppServerLogger.warn(message, ...args),
		error: (message, ...args) => daemonAppServerLogger.error(message, ...args)
	} }) });
	require_daemon_bootstrap.scheduleSessionFragmentRepairRun({
		database,
		deferredHistory: startupMigration.deferredHistory,
		logger: {
			warn: (message, ...args) => daemonAppServerLogger.warn(message, ...args),
			error: (message, ...args) => daemonAppServerLogger.error(message, ...args)
		}
	});
	resources.mcpAppsHost = await require_server.startWorkbuddyAppServerDefaultMcpAppsHost({
		celljs,
		daemon,
		connectorOauthFetch: (url, init) => fetch(url, init),
		serverFetch: (url, init) => fetch(url, init),
		resolveBundledAsset: require_workbuddy_product_config.resolveBundledAsset,
		logger: daemonAppServerLogger
	});
	markDaemon("F11");
	const backgroundPromise = require_server.startWorkbuddyAppServerDefaultBackgroundServices({
		celljs,
		runtimeManager,
		daemon,
		builtinSkillsDir: require_workbuddy_product_config.requireBundledAsset("plugins", "workbuddy-builtin", "skills"),
		connectorOauthFetch: (url, init) => fetch(url, init),
		resolveBundledAsset: require_workbuddy_product_config.resolveBundledAsset,
		resolveBuiltinMarketEndpointOverride: require_dev_env_override.resolveEndpointOverride,
		conversationsBridge: resources.wbBridge,
		runtimeWarmCache: conversationRuntimeWarm.cache,
		logger: daemonAppServerLogger,
		connectorPowerEvents: hostPowerEvents,
		networkGate,
		prewarmPool: daemon.cliPrewarmPool,
		...resources.mcpAppsHost?.staticHtmlServer ? { staticHtmlServer: resources.mcpAppsHost.staticHtmlServer } : {}
	});
	resources.backgroundPromise = backgroundPromise;
	markDaemon("F12");
	backgroundPromise.then(() => {
		markDaemon("F13");
	}, (error) => {
		daemonAppServerLogger.error("Background services start error:", error);
	});
	const shutdown = () => {
		lifecycle.shutdown().catch((error) => {
			daemonAppServerLogger.error("[DaemonAppServer] Shutdown failed:", error);
		});
	};
	process.on("SIGTERM", shutdown);
	process.on("SIGINT", shutdown);
}
async function configureDaemonNetworkProxy(resolveDaemonProxyEnv, pacResolver) {
	let pacRpcHandle;
	if (pacResolver) {
		try {
			require_proxy_agents.setPacResolver(pacResolver);
			daemonAppServerLogger.info("PAC resolver installed (per-request resolveProxy via host bridge)");
		} catch (error) {
			daemonAppServerLogger.warn("install PAC resolver failed (non-fatal, falling back to env)", error);
		}
		try {
			pacRpcHandle = await require_daemon_bootstrap.startPacRpcService(pacResolver, { logger: {
				info: (msg) => daemonAppServerLogger.info(msg),
				warn: (msg) => daemonAppServerLogger.warn(msg)
			} });
			if (pacRpcHandle) {
				process.env[require_daemon_bootstrap.PAC_RPC_SOCKET_ENV] = pacRpcHandle.socketPath;
				process.env[require_daemon_bootstrap.PAC_RPC_TOKEN_ENV] = pacRpcHandle.token;
				daemonAppServerLogger.info(`PAC RPC service started: socket=${pacRpcHandle.socketPath} (token written to env)`);
			}
		} catch (error) {
			daemonAppServerLogger.warn("start PAC RPC service failed (non-fatal, CLI will skip L0)", error);
		}
	}
	try {
		const proxyEnv = await resolveDaemonProxyEnv();
		for (const [key, value] of Object.entries(proxyEnv)) {
			if (key === "NODE_OPTIONS") continue;
			if (typeof value === "string" && value.length > 0) process.env[key] = value;
		}
	} catch (error) {
		daemonAppServerLogger.warn("resolve daemon proxy env failed (non-fatal)", error);
	}
	require_proxy_agents.installUndiciProxyDispatcher();
	require_proxy_agents.installAxiosGlobalProxy();
	require_tls_verification.suppressTlsRejectWarning();
	try {
		if (require_workbuddy_product_config.tryGetWorkbuddyBaseProductConfiguration()?.productFeatures?.[require_common.ProductFeature.DisableTlsVerification]) require_tls_verification.disableTlsVerificationForProcess("bootstrap:daemon:product.json");
	} catch (error) {
		daemonAppServerLogger.warn("[TlsVerification] early bootstrap injection skipped (non-fatal)", error);
	}
	return pacRpcHandle;
}
async function resolveProductName(celljs) {
	const fromEnv = process.env.WORKBUDDY_PRODUCT_NAME?.trim();
	if (fromEnv) return fromEnv;
	try {
		const productName = (await celljs.productManager?.waitConfiguration?.())?.productName ?? celljs.productManager?.configuration?.productName;
		if (typeof productName === "string" && productName.trim()) return productName;
	} catch {}
	return "WorkBuddy";
}
//#endregion
exports.runDaemonAppServerEntry = runDaemonAppServerEntry;
