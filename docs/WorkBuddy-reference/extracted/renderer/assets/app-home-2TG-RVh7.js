import { n as __esmMin, s as __toESM } from "./rolldown-runtime-D5a2oYpF.js";
import { AG as WORKBUDDY_DEPLOY_ORIGIN, BE as emitProjectChange, Cp as init_project_service, GL as useConversations, HE as subscribeProjectChange, Il as init_common$1, Jb as appPublishIntentStore, Jk as TemplateImageIcon, Kb as genieEmbedNavStore, LR as Segmented, MR as init_src, Sp as deleteGenieProject, UL as init_conversations_context, VE as init_project_change_bus, Yb as init_app_publish_intent_store, _P as init_clipboard, _k as init_services, aT as init_use_genie_agent_enabled, aV as Button, bp as cancelGenieProjectDeploy, cL as init_useI18n, cW as init_common, db as init_genie_embed, fb as useGenieEmbedTelemetry, gL as useModuleHost, gP as copyToClipboard, gS as useMainRouteActive, gv as useWorkBuddyTopBarVisible, gz as Input, hb as GENIE_EMBED_EVENT, hv as useTopBarRootClassName, iB as SearchIcon, iz as Dropdown, jB as ConnectorTabIcon, oT as useGenieAgentEnabled, pv as init_workbuddy_topbar, qb as init_genie_embed_nav_store, sA as MoreDotsIcon, sz as Modal, uL as useTranslation, uv as SidebarExpandButton, vb as GENIE_PAGE, vc as init_app_providers, xc as useAppProviders, yb as GENIE_PAGE_SHOW_ACTION, zR as message, zk as init_icons } from "./ui-docs-viewer-C2jT2eXi.js";
import { Oo as RefreshCw, Ou as require_jsx_runtime, ao as init_lucide_react, ku as require_react } from "./lib-chat-ui-ChIVprRk.js";
import { t as init_app_shell } from "./app-shell-CgEWTZuw.js";
//#region ../../packages/agent-ui/src/modules/genie-project/pages/app-home/genie-app-card.tsx
/**
* 项目类型 → i18n key（组件层用 t() 翻译）。未知类型返回 undefined（不渲染标签）。
*/
function getProjectTypeLabelKey(type) {
	if (!type) return;
	const normalized = type.toLowerCase();
	if (normalized === "web") return "genieAppHome.projectType.web";
	if (normalized === "miniprogram" || normalized === "wx_miniprogram") return "genieAppHome.projectType.miniprogram";
	if (normalized === "game") return "genieAppHome.projectType.game";
	if (normalized === "prototype") return "genieAppHome.projectType.prototype";
	if (normalized === "ppt") return "genieAppHome.projectType.ppt";
}
/**
* 计算卡片类型标签的 i18n key：
*   - workbuddy-deploy 来源固定"其他"，忽略 projectType
*   - 其它来源按 projectType 映射（getProjectTypeLabelKey）
* 返回 i18n key（组件层 t() 翻译）；无匹配返回 undefined（不渲染标签）。
*
* 注意：当前版本「其他」和「云服务」标签已不再展示（genie-home 改造）。
*/
function resolveTypeLabelKey(conversationOrigin, projectType) {
	if (conversationOrigin === "workbuddy-deploy") return;
	return getProjectTypeLabelKey(projectType);
}
/** Returns tag keys in the visual order rendered by the app card. */
function getCardTagLabelKeys(hasCloudService, conversationOrigin, projectType) {
	const typeLabelKey = resolveTypeLabelKey(conversationOrigin, projectType);
	return [...typeLabelKey ? [typeLabelKey] : []];
}
/**
* 将 ISO 时间字符串格式化为 `YYYY-MM-DD HH:mm`（精确到分钟）。
*
* 卡片原先用 `toLocaleDateString()` 只输出到「日」，无法区分同一天创建的多个项目的先后顺序。
* 这里统一按本地时区补齐时:分，格式与设计稿一致（如 `2026-07-24 15:11`）。
* 非法/空值返回空字符串，交由调用方决定是否渲染。
*/
function formatCardDateTime(value) {
	if (!value) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	const pad = (n) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
/**
* 是否展示「复制链接」按钮：以「已发布」为前提（先状态后地址）。
* 取消发布后即便 releaseUrl 未及时清除（部署滞后/历史脏数据），
* 只要 published=false 就不再展示复制，避免复制到已失效的旧地址。
*/
function canCopyReleaseLink(published, releaseUrl) {
	return Boolean(published) && Boolean(releaseUrl);
}
function GenieAppCard({ item, hasCloudService = false, onOpen, onCopyLink, onCancelPublish, onDelete }) {
	const t = useTranslation();
	const [imgFailed, setImgFailed] = (0, import_react$3.useState)(false);
	const [menuOpen, setMenuOpen] = (0, import_react$3.useState)(false);
	(0, import_react$3.useEffect)(() => {
		if (!menuOpen) return;
		const close = () => setMenuOpen(false);
		window.addEventListener("scroll", close, true);
		return () => window.removeEventListener("scroll", close, true);
	}, [menuOpen]);
	const tagLabelKeys = getCardTagLabelKeys(hasCloudService, item.conversationOrigin, item.projectType);
	const hasCover = Boolean(item.cover) && !imgFailed;
	const isPublished = Boolean(item.published);
	const canCopyLink = canCopyReleaseLink(item.published, item.releaseUrl);
	const description = item.description || formatCardDateTime(item.createdAt || item.updatedAt);
	return /* @__PURE__ */ (0, import_jsx_runtime$2.jsxs)("article", {
		className: "genie-app-card",
		children: [/* @__PURE__ */ (0, import_jsx_runtime$2.jsxs)("div", {
			className: "genie-app-card__cover",
			children: [isPublished && /* @__PURE__ */ (0, import_jsx_runtime$2.jsxs)("span", {
				className: "genie-app-card__published-badge cb-font-size-fixed",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$2.jsx)("span", {
					className: "genie-app-card__published-dot",
					"aria-hidden": "true"
				}), t("genieAppHome.card.publishedBadge")]
			}), hasCover ? /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)("img", {
				src: item.cover,
				alt: item.title,
				className: "genie-app-card__cover-image",
				style: { objectFit: item.previewType === "mobile" ? "contain" : "cover" },
				loading: "lazy",
				onError: () => setImgFailed(true)
			}) : /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)("div", {
				className: "genie-app-card__cover-empty",
				children: /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)(TemplateImageIcon, {
					className: "genie-app-card__cover-icon",
					width: 32,
					height: 32
				})
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime$2.jsxs)("div", {
			className: "genie-app-card__content",
			children: [/* @__PURE__ */ (0, import_jsx_runtime$2.jsxs)("div", {
				className: "genie-app-card__summary",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$2.jsxs)("div", {
					className: "genie-app-card__headline",
					children: [/* @__PURE__ */ (0, import_jsx_runtime$2.jsx)("div", {
						className: "genie-app-card__title-wrap",
						children: /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)("div", {
							className: "genie-app-card__title cb-font-size-fixed",
							children: item.title
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)("div", {
						className: "genie-app-card__tags",
						children: tagLabelKeys.map((labelKey) => /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)("span", {
							className: "genie-app-card__tag cb-font-size-fixed",
							children: t(labelKey)
						}, labelKey))
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)("div", {
					className: "genie-app-card__description cb-font-size-fixed",
					children: description
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime$2.jsxs)("div", {
				className: "genie-app-card__actions",
				"aria-label": `${item.title} actions`,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime$2.jsx)("button", {
						type: "button",
						className: "genie-app-card__view-button",
						onClick: () => onOpen?.(item),
						children: t("genieAppHome.card.view")
					}),
					canCopyLink && /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)("button", {
						type: "button",
						className: "genie-app-card__icon-button",
						"aria-label": t("genieAppHome.card.copyLink"),
						onClick: () => onCopyLink?.(item),
						children: /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)(ConnectorTabIcon, {
							className: "genie-app-card__action-icon",
							width: 16,
							height: 16
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime$2.jsx)(Dropdown, {
						trigger: /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)("button", {
							type: "button",
							className: "genie-app-card__icon-button",
							"aria-label": t("genieAppHome.card.moreActions"),
							children: /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)(MoreDotsIcon, {
								className: "genie-app-card__action-icon",
								width: 16,
								height: 16
							})
						}),
						items: [...isPublished ? [{
							key: "cancelPublish",
							label: t("genieAppHome.card.cancelPublish"),
							disabled: !onCancelPublish
						}] : [], {
							key: "delete",
							label: t("genieAppHome.card.delete"),
							danger: true,
							divider: isPublished,
							disabled: !onDelete
						}],
						placement: "bottom-end",
						portalRoot: "body",
						open: menuOpen,
						onOpenChange: setMenuOpen,
						onSelect: (key) => {
							if (key === "cancelPublish") onCancelPublish?.(item);
							if (key === "delete") onDelete?.(item);
						}
					})
				]
			})]
		})]
	});
}
var import_react$3, import_jsx_runtime$2;
var init_genie_app_card = __esmMin((() => {
	init_common();
	init_src();
	import_react$3 = /* @__PURE__ */ __toESM(require_react());
	init_icons();
	init_useI18n();
	import_jsx_runtime$2 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/assets/genie-home-empty.svg
var genie_home_empty_default;
var init_genie_home_empty = __esmMin((() => {
	genie_home_empty_default = "" + new URL("genie-home-empty-CjKT3ugJ.svg", import.meta.url).href;
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/genie-project/pages/app-home/genie-app-empty.tsx
function GenieAppEmpty({ title, description, actionText, onAction, retryText, onRetry }) {
	return /* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("div", {
		className: "genie-app-empty",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("img", {
				src: genie_home_empty_default,
				alt: "",
				className: "genie-app-empty__image"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("div", {
				className: "genie-app-empty__title",
				children: title
			}),
			description && /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("div", {
				className: "genie-app-empty__description",
				children: description
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("div", {
				className: "genie-app-empty__actions",
				children: [onRetry && /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(Button, {
					variant: "secondary",
					size: "small",
					leftIcon: /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(RefreshCw, { className: "genie-app-empty__button-icon" }),
					onClick: onRetry,
					children: retryText
				}), onAction && actionText && /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(Button, {
					className: "genie-app-empty__create-button",
					variant: "secondary",
					size: "small",
					onClick: onAction,
					children: actionText
				})]
			})
		]
	});
}
var import_jsx_runtime$1;
var init_genie_app_empty = __esmMin((() => {
	init_src();
	init_lucide_react();
	require_react();
	init_genie_home_empty();
	import_jsx_runtime$1 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/genie-project/pages/app-home/map-conversation-to-card.ts
function getStringValue(value) {
	return typeof value === "string" && value.trim() ? value.trim() : void 0;
}
function getExtraInfoString(extraInfo, keys) {
	if (!extraInfo) return;
	for (const key of keys) {
		const value = getStringValue(extraInfo[key]);
		if (value) return value;
	}
}
function getExtraInfoBool(extraInfo, key) {
	if (!extraInfo) return false;
	const value = extraInfo[key];
	return value === true || value === "true";
}
function mapConversationToCard(conversation) {
	const extraInfo = conversation.extraInfo ?? {};
	const description = getStringValue(conversation.summary) ?? getExtraInfoString(extraInfo, [
		"description",
		"desc",
		"projectDescription"
	]) ?? "";
	return {
		id: conversation.id,
		title: conversation.name || getExtraInfoString(extraInfo, ["projectName", "title"]) || "Untitled",
		description,
		cover: getExtraInfoString(extraInfo, [
			"GenieCoverURL",
			"cover",
			"coverUrl",
			"thumbnailUrl",
			"previewImage"
		]),
		projectType: getExtraInfoString(extraInfo, [
			"GenieProjectType",
			"projectType",
			"type"
		]),
		previewType: getExtraInfoString(extraInfo, ["GeniePreviewType", "previewType"]),
		updatedAt: conversation.updatedAt,
		createdAt: conversation.createdAt,
		status: conversation.status,
		conversationOrigin: conversation.conversationOrigin,
		published: getExtraInfoBool(extraInfo, "GenieProjectPublished"),
		releaseUrl: getExtraInfoString(extraInfo, [
			"GenieProjectReleaseURL",
			"releaseUrl",
			"publishUrl",
			"homePageUrl"
		])
	};
}
var init_map_conversation_to_card = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/modules/genie-project/pages/app-home/merge-app-cards.ts
/**
* 按应用名（card.title）做大小写不敏感的子串匹配。
* keyword 为空（去空格后）时视为不过滤，原样返回。
*
* 只匹配应用名（issue #3817 验收口径：输入应用名关键词可搜索到对应应用），
* 不匹配 description，保持与「按名字搜」的直觉一致。
*/
function filterCardsByKeyword(cards, keyword) {
	const normalized = keyword.trim().toLowerCase();
	if (!normalized) return cards;
	return cards.filter((card) => (card.title ?? "").toLowerCase().includes(normalized));
}
/**
* 合并 genie 路与 deploy 路的卡片并按 sortMode 统一排序（desc）。
*
* 排序键：updatedAt / createdAt（ISO 字符串，字典序等价时间序）。缺失值视为最旧（排末尾），
* 与后端 `{ orderBy, order: 'desc' }` 的语义对齐。两路各自可能已有序，但合并后必须重排，
* 否则 deploy 卡片会整体沉底或浮顶，破坏「按更新时间混排」的展示预期。
*
* 潜在 id 去重：genie 与 workbuddy-deploy 是互斥的 conversationOrigin，理论上 id 不会重叠；
* 仍按 id 去重兜底（保留先出现的一条），避免任何边界情况下渲染出重复 React key。
*/
function mergeAndSortCards(genieCards, deployCards, sortMode) {
	const seen = /* @__PURE__ */ new Set();
	const merged = [];
	for (const card of [...genieCards, ...deployCards]) {
		if (seen.has(card.id)) continue;
		seen.add(card.id);
		merged.push(card);
	}
	const key = sortMode === "createdAt" ? "createdAt" : "updatedAt";
	return merged.sort((a, b) => {
		const av = a[key] ?? "";
		const bv = b[key] ?? "";
		if (av === bv) return 0;
		return av < bv ? 1 : -1;
	});
}
var init_merge_app_cards = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/modules/genie-project/pages/app-home/reconcile-deploy-cards.ts
/**
* 拉取 conversationIds 对应的 deploy history，构建 conversationId → 发布信息 的映射。
*
* 匹配 key 是「部署沙箱会话 id」（conversationId），而非 taskSessionId：
* app-home 的 workbuddy-deploy 卡片 id 就是部署时自动创建的沙箱会话 id
* （createGenieWorkspace 生成，origin=workbuddy-deploy），它对应 history 里的
* `conversationId` 字段；`taskSessionId` 存的是发起部署的用户会话，语义不同，
* 用它对账会全部 miss（issue：发布应用全被过滤）。
*
* 规则：
* - history 为空的 target 不算入映射（没有任何发布记录，无从展示）
* - `unpublished === true`（已取消发布）的 target 仍入映射，但标记 `published=false`：
*   产品要求取消发布的应用也要展示（呈现为未发布态），因此不再直接丢弃
* - 同一 conversationId 命中多条记录时，取 `createdTimestamp` 最新的一条
* - publishedApps 未注入或调用抛错时返回空 Map（即所有 workbuddy-deploy 卡片被过滤）
*/
async function buildDeployInfoMap(publishedApps, conversationIds) {
	const map = /* @__PURE__ */ new Map();
	if (!publishedApps || typeof publishedApps.getDeployHistory !== "function" || conversationIds.length === 0) return map;
	try {
		const raw = await publishedApps.getDeployHistory({ conversationIds });
		const targets = Array.isArray(raw) ? raw : [];
		for (const target of targets) {
			if (!target.history || target.history.length === 0) continue;
			const published = !target.unpublished;
			for (const entry of target.history) {
				const cid = entry.conversationId;
				if (!cid) continue;
				const info = {
					releaseUrl: getStringValue(entry.shareLink ?? void 0),
					title: getStringValue(entry.title) ?? getStringValue(target.title),
					taskSessionId: getStringValue(entry.taskSessionId),
					createdTimestamp: entry.createdTimestamp ?? 0,
					published
				};
				const prev = map.get(cid);
				if (!prev || info.createdTimestamp > prev.createdTimestamp) map.set(cid, info);
			}
		}
	} catch {}
	return map;
}
/**
* 过滤并覆写 workbuddy-deploy 卡片的发布状态。
* - 非 workbuddy-deploy 卡片：原样保留
* - workbuddy-deploy 卡片：仅当在 deployMap 中命中时保留，且 published/releaseUrl
*   以 deployMap 为权威源（覆盖 conversation extraInfo 里的快照）
*/
function reconcileDeployCards(cards, deployMap) {
	const result = [];
	for (const card of cards) {
		if (card.conversationOrigin !== "workbuddy-deploy") {
			result.push(card);
			continue;
		}
		const info = deployMap.get(card.id);
		if (!info) continue;
		const publishedAt = info.createdTimestamp > 0 ? new Date(info.createdTimestamp).toISOString() : void 0;
		result.push({
			...card,
			title: info.title || card.title,
			published: info.published,
			releaseUrl: info.releaseUrl || card.releaseUrl,
			updatedAt: publishedAt ?? card.updatedAt,
			createdAt: publishedAt ?? card.createdAt,
			taskSessionId: info.taskSessionId
		});
	}
	return result;
}
var init_reconcile_deploy_cards = __esmMin((() => {
	init_common();
	init_map_conversation_to_card();
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/genie-project/pages/app-home/use-genie-app-conversations.ts
function useGenieAppConversations({ keyword = "", sortMode = "updatedAt" }) {
	const { facades, accountInfo } = useModuleHost();
	const cloudAgent = facades.cloudAgent;
	const publishedApps = useAppProviders()?.publishedApps;
	const [items, setItems] = (0, import_react$1.useState)([]);
	const [total, setTotal] = (0, import_react$1.useState)(0);
	const [loading, setLoading] = (0, import_react$1.useState)(true);
	const [refreshing, setRefreshing] = (0, import_react$1.useState)(false);
	const [error, setError] = (0, import_react$1.useState)(null);
	const [revision, setRevision] = (0, import_react$1.useState)(0);
	const fetchedOnceRef = (0, import_react$1.useRef)(false);
	const lastAuthenticatedScopeRef = (0, import_react$1.useRef)(null);
	const requestIdRef = (0, import_react$1.useRef)(0);
	const normalizedKeyword = keyword.trim();
	const authenticatedScope = (0, import_react$1.useMemo)(() => {
		const userId = accountInfo?.userId?.trim();
		const enterpriseId = accountInfo?.enterpriseId?.trim();
		return userId && enterpriseId ? JSON.stringify([userId, enterpriseId]) : null;
	}, [accountInfo?.enterpriseId, accountInfo?.userId]);
	const sort = (0, import_react$1.useMemo)(() => JSON.stringify({
		orderBy: sortMode,
		order: "desc"
	}), [sortMode]);
	const refresh = (0, import_react$1.useCallback)(() => {
		setRevision((prev) => prev + 1);
	}, []);
	(0, import_react$1.useEffect)(() => subscribeProjectChange(refresh, { ownSource: "genie-app-home" }), [refresh]);
	(0, import_react$1.useEffect)(() => {
		const requestId = ++requestIdRef.current;
		const isScopeChange = authenticatedScope !== null && lastAuthenticatedScopeRef.current !== null && lastAuthenticatedScopeRef.current !== authenticatedScope;
		if (authenticatedScope !== null) lastAuthenticatedScopeRef.current = authenticatedScope;
		if (!cloudAgent?.listConversations) {
			setItems([]);
			setTotal(0);
			setError("CloudAgent facade is not available");
			setLoading(false);
			setRefreshing(false);
			return;
		}
		let cancelled = false;
		const isCurrentRequest = () => !cancelled && requestIdRef.current === requestId;
		const shouldShowLoading = isScopeChange || !fetchedOnceRef.current;
		if (shouldShowLoading) {
			if (isScopeChange) {
				setItems([]);
				setTotal(0);
			}
			setLoading(true);
			setRefreshing(false);
		} else setRefreshing(true);
		setError(null);
		cloudAgent.listConversations({
			conversationOrigin: WORKBUDDY_DEPLOY_ORIGIN,
			page: 1,
			size: DEPLOY_FETCH_SIZE,
			sort
		}).then(async (result) => {
			if (!isCurrentRequest()) return;
			const deployCards = (Array.isArray(result?.conversations) ? result.conversations : []).map(mapConversationToCard);
			const deployMap = await buildDeployInfoMap(publishedApps, deployCards.map((card) => card.id));
			if (!isCurrentRequest()) return;
			const finalCards = mergeAndSortCards([], filterCardsByKeyword(reconcileDeployCards(deployCards, deployMap), normalizedKeyword), sortMode);
			setItems(finalCards);
			setTotal(finalCards.length);
			fetchedOnceRef.current = true;
		}).catch((err) => {
			if (!isCurrentRequest()) return;
			if (shouldShowLoading) {
				setItems([]);
				setTotal(0);
				setError(err instanceof Error ? err.message : String(err));
			}
		}).finally(() => {
			if (!isCurrentRequest()) return;
			if (shouldShowLoading) setLoading(false);
			else setRefreshing(false);
		});
		return () => {
			cancelled = true;
		};
	}, [
		authenticatedScope,
		cloudAgent,
		publishedApps,
		normalizedKeyword,
		revision,
		sort,
		sortMode,
		accountInfo?.enterpriseId,
		accountInfo?.userId
	]);
	if (authenticatedScope !== null && lastAuthenticatedScopeRef.current !== null && lastAuthenticatedScopeRef.current !== authenticatedScope) return {
		items: [],
		total: 0,
		loading: true,
		refreshing: false,
		error: null,
		refresh
	};
	return {
		items,
		total,
		loading,
		refreshing,
		error,
		refresh
	};
}
var import_react$1, DEPLOY_FETCH_SIZE;
var init_use_genie_app_conversations = __esmMin((() => {
	init_common();
	import_react$1 = /* @__PURE__ */ __toESM(require_react());
	init_app_providers();
	init_project_change_bus();
	init_common$1();
	init_map_conversation_to_card();
	init_merge_app_cards();
	init_reconcile_deploy_cards();
	DEPLOY_FETCH_SIZE = 100;
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/genie-project/pages/app-home/index.tsx
function useDebouncedValue(value, delayMs) {
	const [debounced, setDebounced] = (0, import_react.useState)(value);
	(0, import_react.useEffect)(() => {
		const timer = window.setTimeout(() => setDebounced(value), delayMs);
		return () => window.clearTimeout(timer);
	}, [value, delayMs]);
	return debounced;
}
function LoadingGrid() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "genie-app-home__grid",
		children: Array.from({ length: 6 }).map((_, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "genie-app-skeleton-card",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "genie-app-skeleton-card__cover" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "genie-app-skeleton-card__title" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "genie-app-skeleton-card__line" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "genie-app-skeleton-card__line genie-app-skeleton-card__line--short" })
			]
		}, index))
	});
}
function GenieAppHomePage() {
	const { enabled: genieAgentEnabled, loading: genieAgentLoading } = useGenieAgentEnabled();
	const { navigation } = useModuleHost();
	const everEnabledRef = (0, import_react.useRef)(false);
	if (genieAgentEnabled) everEnabledRef.current = true;
	(0, import_react.useEffect)(() => {
		if (!genieAgentLoading && !genieAgentEnabled && !everEnabledRef.current) navigation.goHome({ replace: true });
	}, [
		genieAgentEnabled,
		genieAgentLoading,
		navigation
	]);
	if (genieAgentLoading || !genieAgentEnabled && !everEnabledRef.current) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, {});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GenieAppHomeContent, {});
}
function GenieAppHomeContent() {
	const t = useTranslation();
	const active = useMainRouteActive();
	const { navigation } = useModuleHost();
	const publishedApps = useAppProviders()?.publishedApps;
	const conversationsContext = useConversations();
	const { setSelectedWelcomeMode, setShowDetailPanel } = conversationsContext;
	const [keyword, setKeyword] = (0, import_react.useState)("");
	const sidebarCollapsed = conversationsContext?.sidebarCollapsed ?? false;
	const topbarRootClassName = useTopBarRootClassName();
	const showExpandTopbar = useWorkBuddyTopBarVisible() && sidebarCollapsed;
	(0, import_react.useEffect)(() => {
		if (active) setShowDetailPanel?.(false);
	}, [active, setShowDetailPanel]);
	const genieReport = useGenieEmbedTelemetry();
	const lastActiveRef = (0, import_react.useRef)(false);
	(0, import_react.useEffect)(() => {
		if (active && !lastActiveRef.current) genieReport(GENIE_EMBED_EVENT.PAGE_SHOW, {
			page: GENIE_PAGE.APPLICATION,
			action: GENIE_PAGE_SHOW_ACTION.APPLICATION_TAB_SHOW
		});
		lastActiveRef.current = active;
	}, [active, genieReport]);
	const [sortMode, setSortMode] = (0, import_react.useState)("updatedAt");
	const debouncedKeyword = useDebouncedValue(keyword, 300);
	const { items, loading, refreshing, error, refresh } = useGenieAppConversations({
		keyword: debouncedKeyword,
		sortMode
	});
	const sortOptions = (0, import_react.useMemo)(() => [{
		value: "updatedAt",
		label: t("genieAppHome.sort.updatedAt")
	}, {
		value: "createdAt",
		label: t("genieAppHome.sort.createdAt")
	}], [t]);
	const handleOpenApp = (item) => {
		if (item.conversationOrigin === "workbuddy-deploy") {
			if (item.taskSessionId) {
				conversationsContext.setJumpToConversationId?.(item.taskSessionId);
				return;
			}
			message.warning(t("genieAppHome.messages.taskSessionMissing"));
			return;
		}
		genieEmbedNavStore.getState().setPendingPath(`/project/${item.id}`);
		navigation.navigate(`/genie/project/${encodeURIComponent(item.id)}`);
	};
	const handleCopyLink = (item) => {
		copyToClipboard(item.releaseUrl ? item.releaseUrl : typeof window !== "undefined" ? new URL(`/genie/project/${encodeURIComponent(item.id)}`, window.location.href).toString() : `/genie/project/${encodeURIComponent(item.id)}`).then((ok) => {
			if (ok) message.success(t("genieAppHome.messages.copySuccess"));
			else message.error(t("genieAppHome.messages.copyFailed"));
		});
	};
	const handleCancelPublish = (item) => {
		Modal.confirm({
			title: t("genieAppHome.cancelPublishConfirm.title", { title: item.title }),
			content: t("genieAppHome.cancelPublishConfirm.content"),
			okText: t("genieAppHome.cancelPublishConfirm.okText"),
			cancelText: t("genieAppHome.cancelPublishConfirm.cancelText"),
			onOk: async () => {
				try {
					await cancelGenieProjectDeploy(item.id);
					if (typeof publishedApps?.destroy === "function") try {
						await publishedApps.destroy({
							conversationId: item.id,
							localOnly: true
						});
					} catch (e) {
						console.error("[GenieAppHome] write local unpublish record failed:", e);
					}
					refresh();
				} catch (err) {
					return false;
				}
			}
		});
	};
	const handleDelete = (item) => {
		Modal.confirm({
			title: t("genieAppHome.deleteConfirm.title", { title: item.title }),
			content: t("genieAppHome.deleteConfirm.content"),
			okText: t("genieAppHome.deleteConfirm.okText"),
			cancelText: t("genieAppHome.deleteConfirm.cancelText"),
			okType: "danger",
			onOk: async () => {
				try {
					await deleteGenieProject(item.id);
					refresh();
					emitProjectChange("genie-app-home");
					message.success(t("genieAppHome.messages.deleteSuccess"));
				} catch (err) {
					message.error(err instanceof Error ? err.message : t("genieAppHome.messages.deleteFailed"));
					return false;
				}
			}
		});
	};
	const handleCreateApp = () => {
		setSelectedWelcomeMode("code");
		appPublishIntentStore.getState().setPending(true);
		navigation.goHome();
	};
	const emptyTitle = debouncedKeyword ? t("genieAppHome.empty.searchTitle") : t("genieAppHome.empty.title");
	const emptyDescription = debouncedKeyword ? t("genieAppHome.empty.searchDescription") : t("genieAppHome.empty.description");
	const showToolbar = !(items.length === 0 && !debouncedKeyword && !loading && !refreshing && !error);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "main-content main-content--genie-home genie-app-home",
		children: [showExpandTopbar && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: `${topbarRootClassName} genie-app-home__topbar`,
			style: { flexShrink: 0 },
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "workbuddy-topbar-left",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SidebarExpandButton, {})
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: `genie-app-home__inner${showExpandTopbar ? " genie-app-home__inner--with-topbar" : ""}`,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "genie-app-home__header",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "genie-app-home__header-left",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "genie-app-home__title",
							children: t("genieAppHome.title")
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "genie-app-home__subtitle",
							children: t("genieAppHome.subtitle")
						})] })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "genie-app-home__header-actions",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							className: "genie-app-home__create-button",
							variant: "primary",
							size: "medium",
							onClick: handleCreateApp,
							children: t("genieAppHome.create")
						})
					})]
				}),
				showToolbar && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "genie-app-home__toolbar",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Segmented, {
						className: "genie-app-home__sort",
						size: "medium",
						value: sortMode,
						options: sortOptions,
						onChange: (value) => setSortMode(value),
						"aria-label": t("genieAppHome.sort.ariaLabel")
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						className: "genie-app-home__search",
						size: "medium",
						variant: "filled",
						value: keyword,
						prefix: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SearchIcon, {
							className: "genie-app-home__search-icon",
							width: 16,
							height: 16
						}),
						placeholder: t("genieAppHome.search.placeholderShort"),
						allowClear: true,
						onChange: (event) => setKeyword(event.target.value)
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
					className: "genie-app-home__content",
					"aria-label": t("genieAppHome.list.ariaLabel"),
					children: loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoadingGrid, {}) : error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GenieAppEmpty, {
						title: t("genieAppHome.error.title"),
						description: error,
						retryText: t("genieAppHome.error.retry"),
						onRetry: refresh
					}) : items.length === 0 && !refreshing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GenieAppEmpty, {
						title: emptyTitle,
						description: debouncedKeyword ? emptyDescription : void 0,
						actionText: debouncedKeyword ? void 0 : t("genieAppHome.empty.action"),
						onAction: debouncedKeyword ? void 0 : handleCreateApp
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "genie-app-home__grid",
						children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GenieAppCard, {
							item,
							onOpen: handleOpenApp,
							onCopyLink: handleCopyLink,
							onCancelPublish: handleCancelPublish,
							onDelete: handleDelete
						}, item.id))
					})
				})
			]
		})]
	});
}
var import_react, import_jsx_runtime;
//#endregion
__esmMin((() => {
	init_common();
	init_src();
	import_react = /* @__PURE__ */ __toESM(require_react());
	init_app_shell();
	init_genie_embed();
	init_icons();
	init_workbuddy_topbar();
	init_conversations_context();
	init_use_genie_agent_enabled();
	init_useI18n();
	init_services();
	init_app_publish_intent_store();
	init_clipboard();
	init_genie_embed_nav_store();
	init_project_change_bus();
	init_common$1();
	init_project_service();
	init_genie_app_card();
	init_genie_app_empty();
	init_use_genie_app_conversations();
	import_jsx_runtime = require_jsx_runtime();
}))();
export { GenieAppHomePage, GenieAppHomePage as default };
