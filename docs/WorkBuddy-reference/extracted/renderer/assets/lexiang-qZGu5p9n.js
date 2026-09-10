import { n as __esmMin, s as __toESM } from "./rolldown-runtime-D5a2oYpF.js";
import { $l as init_lexiang_content_blocks, $o as reportIframePageShow, $x as init_use_oneid_connector_gate, AL as useOptionalImaApiBridge, Ad as ViewIcon, Au as LEXIANG_IFRAME_SANDBOX, Bo as init_auth, Bv as init_use_oneid_app_status, Cd as OrganizationIcon, Dd as SortIcon, Du as tencentLexiangStore, Ed as SettingIcon, Eu as readLastViewFromCache, FB as ChevronRightIcon, FR as ScrollLoadMore, Fu as init_constants, GI as init_useTheme, GL as useConversations, Gu as init_host, Ho as AuthGuard, Io as SingleServiceOnboardingPanel, Iu as LEXIANG_HTML_SUPPORTED_EXTENSIONS, KI as useTheme, Ku as BRIDGE_PROTOCOL_VERSION, LB as ChevronDownIcon, LO as init_use_named_page_show, Lo as init_single_service_panel, Lu as LEXIANG_SUPPORTED_EXTENSIONS, MR as init_src, Md as init_ui_icons, Nu as LEXIANG_TRUSTED_ORIGINS, Od as TagIcon, Ou as useTencentLexiangStore, Pu as buildKbHomeUrl, Ql as buildTeamBlock, Qo as reportAddToTaskHover, RB as CheckIcon, RO as useNamedElementShow, Rs as init_contexts, Ru as LEXIANG_WEB_ORIGIN_PROD, Sd as MoreIcon, Su as LEXIANG_OAUTH_NAME, Td as PlusIcon, Tu as readLastSelectedKbFromCache, Vv as useOneidAppStatus, Xl as buildFileBlock, Xo as init_telemetry, Zl as buildKnowledgeBaseBlock, Zo as reportAddToTaskBatch, _M as matchShellRoute, _c as getFacades, _d as CompanyIcon, _k as init_services, _u as lexiangAuthStore, aM as init_router, aV as Button, as as reportSearch, az as Tooltip, bF as isIOAUser, bc as useAgentServices, bd as KnowledgeBaseIcon, cL as init_useI18n, dc as useCurrentAccount, eS as useOneidConnectorGate, es as reportJsApiFail, eu as LexiangFileTypeIcon, fv as WorkBuddyTopBar, gd as CircleMoreIcon, gz as Input, hd as CatalogViewIcon, hu as useLexiangLibraryMode, iB as SearchIcon, is as reportOpenInLexiang, iz as Dropdown, jd as ViewOffIcon, kL as init_ima_api_context, kd as UserIcon, ku as IWIKI_ENABLED_COMPANY_CODE, lz as Popover, md as AllTeamsIcon, mu as init_use_lexiang_library_mode, nF as init_utils$1, nS as init_use_oneid_applications, ns as reportLibraryListPageShow, nu as init_lexiang_file_type_icon, nz as Checkbox, pd as AddToChatIcon, pv as init_workbuddy_topbar, pz as Loading, qu as HostToClientMessageType, rS as refreshOneidApplications, sz as Modal, ts as reportJsApiSuccess, tz as Select, uL as useTranslation, vL as init_dist, vc as init_app_providers, vd as EditIcon, wd as PinFillIcon, wu as init_store, xL as useLocation, xV as onLocaleChange, xd as ListViewIcon, yV as init_i18n, yd as ExternalArrowIcon, yu as useLexiangAuth, zL as useAdapter, zR as message } from "./ui-docs-viewer-C2jT2eXi.js";
import { Du as require_react_dom, Ks as ChevronDownIcon$1, Lo as Minimize2, Mc as LoadingSpinnerIcon, Oc as IconButton, Ou as require_jsx_runtime, Ro as Maximize2, ao as init_lucide_react, co as X, di as toast, hi as ConfirmDialog, jc as Tooltip$1, kc as Button$1, ku as require_react, t as init_src$1, w as Checkbox$1 } from "./lib-chat-ui-ChIVprRk.js";
import { a as classifyCreateEntryError, b as isLexiangAuthExpiredError, d as init_catalog_service, f as callSpApi, i as LEXIANG_CATALOG_SORT_BY, l as fetchExampleSpace, m as unwrapData, o as createEntry, p as init_spapi_client, s as fetchCatalogChildren, u as fetchLatestEntries, v as init_auth_error } from "./entry-service-CYRgnsAK.js";
import { r as isLexiangSpApiError } from "./contract-DrysQ6QD.js";
import { i as useLexiangAddToTask, t as init_use_lexiang_add_to_task } from "./use-lexiang-add-to-task-c4nMiixO.js";
import { A as init_kb_default_icon, C as init_team_service, D as TeamDefaultIcon, E as searchTeamsByName, F as fetchLexiangTempLoginUrl, I as getLexiangLibraryEmbedUrl, L as getLexiangPreviewEmbedUrl, M as no_knowledge_base_update_default, N as buildLexiangPageUrl, O as init_team_default_icon, P as deriveLexiangWebOriginForVpcAccount, R as getLexiangSpaceEmbedUrl, S as fetchTeamPrivilegeConfig, T as searchTeamsByKeyword, U as resolveSpaceLogoUrl, V as invalidateLogoUrlCache, _ as fetchPrivilegePagination, b as createTeam, c as fetchPinnedTeamSpaces, d as init_space_service, f as getDepartment, g as fetchPrivilegeCount, h as fetchMyPermissions, j as init_no_knowledge_base_update, k as KbDefaultIcon, m as searchContacts, n as fetchFeatureFlags, o as createSpace, p as init_contact_service, r as init_feature_flag_service, s as fetchPersonalSpace, t as init_api, u as fetchTeamSpaces, v as fetchStaffPermissions, w as searchTeams, x as fetchFrequentTeams, y as init_privilege_service, z as init_auth_service } from "./api-Smo5IgCT.js";
import { n as useDescribeUploadError, t as init_use_describe_upload_error } from "./use-describe-upload-error-BlfhZmqz.js";
import { n as shouldRefreshOneidApplications, t as init_oneid_refresh_throttle } from "./oneid-refresh-throttle-rtY8bPjJ.js";
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/tencent-lexiang-panel.less
var init_tencent_lexiang_panel = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/account-cookie-clear-policy.ts
/**
* 根据当前登录 UID、会话 UID 和持久化 UID 判断乐享账号切换清理动作。
*
* sessionStorage 负责识别同一客户端会话内的 A → B 切换；localStorage 负责覆盖
* 客户端重启后首次进入面板时仍可能复用上个账号 defaultSession cookie 的场景。
*/
function resolveLexiangAccountCookieClearPolicy(input) {
	const currentUid = input.currentUid || null;
	const lastSessionUid = input.lastSessionUid || null;
	const persistedLastUid = input.persistedLastUid || null;
	return {
		shouldResetAccountState: currentUid ? lastSessionUid ? lastSessionUid !== currentUid : input.hasCachedKb : Boolean(lastSessionUid || input.hasCachedKb),
		shouldClearWebCookies: Boolean(currentUid && (!persistedLastUid || persistedLastUid !== currentUid))
	};
}
var init_account_cookie_clear_policy = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/lexiang-layout/lexiang-layout.less
var init_lexiang_layout$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/lexiang-layout/lexiang-heading.less
var init_lexiang_heading$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/hooks/use-goto-lexiang.ts
/**
* 返回一个异步跳转函数。
* 内部先获取免登 URL，失败时降级到原始 URL。
*/
function useGotoLexiang() {
	const contextAdapter = useAdapter();
	return { gotoLexiang: (0, import_react$52.useCallback)(async ({ homeUrl, isIframeMode = false, adapter: adapterOverride }) => {
		const adapter = adapterOverride ?? contextAdapter;
		reportOpenInLexiang(adapter);
		let targetUrl = homeUrl;
		try {
			targetUrl = await fetchLexiangTempLoginUrl(adapter, {
				intendUrl: homeUrl,
				mode: isIframeMode ? "iframe" : "native"
			});
		} catch (err) {
			console.warn("[lexiang] temp-login-url 失败，降级使用原始 URL", err);
		}
		adapter.openExternal?.(targetUrl).catch(() => {});
	}, [contextAdapter]) };
}
var import_react$52;
var init_use_goto_lexiang = __esmMin((() => {
	import_react$52 = /* @__PURE__ */ __toESM(require_react());
	init_contexts();
	init_api();
	init_telemetry();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/utils.ts
/**
* 格式化相对时间（简化版）
*
* - 1 分钟内：刚刚
* - 1 小时内：N 分钟前
* - 24 小时内：N 小时前
* - 7 天内：N 天前
* - 更早：YYYY-MM-DD
*
* 若 locale 支持需求明确，后续再接入 i18n 插值。
*/
function formatRelativeTime(timestamp, nowFn = Date.now) {
	const now = nowFn();
	const diff = Math.max(0, now - timestamp);
	const minute = 60 * 1e3;
	const hour = 60 * minute;
	const day = 24 * hour;
	if (diff < minute) return "刚刚";
	if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
	if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
	if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
	const d = new Date(timestamp);
	const pad = (n) => n < 10 ? `0${n}` : `${n}`;
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/**
* 从文件名后缀推断 LexiangFileType（兜底用，优先以 file.type 为准）。
*/
function inferFileTypeFromExt(ext) {
	if (!ext) return "other";
	const normalized = ext.replace(/^\./, "").toLowerCase();
	if (["doc", "docx"].includes(normalized)) return "doc";
	if ([
		"sheet",
		"xlsx",
		"xls",
		"csv"
	].includes(normalized)) return "sheet";
	if (["mind", "mm"].includes(normalized)) return "mind";
	if ([
		"slide",
		"ppt",
		"pptx"
	].includes(normalized)) return "slide";
	if (normalized === "pdf") return "pdf";
	return "other";
}
/** 获取乐享首页 URL：知识库页 → `/spaces/{kbId}`；团队页 → `/t/{teamCode}/spaces`；指定 path → 直接拼接 */
function getLexiangHomeUrl(opts) {
	if (opts?.path) return `${LEXIANG_WEB_ORIGIN_PROD}${opts.path}`;
	if (opts?.kbId) return `${LEXIANG_WEB_ORIGIN_PROD}/spaces/${opts.kbId}`;
	if (opts?.teamCode) return `${LEXIANG_WEB_ORIGIN_PROD}/t/${opts.teamCode}/spaces`;
	return LEXIANG_WEB_ORIGIN_PROD;
}
var init_utils = __esmMin((() => {
	init_constants();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/lexiang-layout/lexiang-heading.tsx
var import_react$51, import_jsx_runtime$44, LexiangHeading;
var init_lexiang_heading = __esmMin((() => {
	init_lexiang_heading$1();
	init_src$1();
	init_src();
	import_react$51 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_services();
	init_useTheme();
	init_api();
	init_auth();
	init_ui_icons();
	init_use_goto_lexiang();
	init_utils();
	import_jsx_runtime$44 = require_jsx_runtime();
	LexiangHeading = ({ showActions, onGotoLexiang, adapter, isIframeMode = false }) => {
		const t = useTranslation();
		const { theme } = useTheme();
		const { gotoLexiang } = useGotoLexiang();
		const [showRevokeConfirm, setShowRevokeConfirm] = (0, import_react$51.useState)(false);
		const [isAdmin, setIsAdmin] = (0, import_react$51.useState)(false);
		(0, import_react$51.useEffect)(() => {
			fetchMyPermissions().then((data) => setIsAdmin(data.permissions.includes("root"))).catch(() => setIsAdmin(false));
		}, []);
		const settingsMenuItems = (0, import_react$51.useMemo)(() => {
			const items = [];
			if (isAdmin) items.push({
				key: "admin",
				label: t("tencentLexiang.settings.gotoAdmin")
			});
			items.push({
				key: "revoke",
				label: t("tencentLexiang.auth.revokeMenuItem"),
				danger: true,
				divider: isAdmin
			});
			return items;
		}, [t, isAdmin]);
		const handleSettingsSelect = (0, import_react$51.useCallback)((key) => {
			if (key === "admin") gotoLexiang({
				homeUrl: getLexiangHomeUrl({ path: "/s/overview" }),
				isIframeMode
			});
			else if (key === "revoke") {
				try {
					adapter?.reportTelemetry?.("web_element_click", {
						elementId: "lexiang_unbind",
						elementName: "解绑乐享账号"
					});
				} catch {}
				setShowRevokeConfirm(true);
			}
		}, [adapter, gotoLexiang]);
		const handleRevoke = (0, import_react$51.useCallback)(async () => {
			setShowRevokeConfirm(false);
			try {
				getFacades()?.tencentLexiang?.invalidateAccessToken?.().catch(() => {});
			} catch {}
			await lexiangAuthStore.getState().revokeAuthorization();
		}, []);
		return /* @__PURE__ */ (0, import_jsx_runtime$44.jsxs)(import_jsx_runtime$44.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime$44.jsxs)("div", {
			className: "tencent-lexiang-panel__heading",
			children: [/* @__PURE__ */ (0, import_jsx_runtime$44.jsxs)("div", {
				className: "tencent-lexiang-panel__heading-text",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$44.jsx)("h2", {
					className: "tencent-lexiang-panel__heading-title",
					children: t("tencentLexiang.heading.title")
				}), /* @__PURE__ */ (0, import_jsx_runtime$44.jsx)("p", {
					className: "tencent-lexiang-panel__heading-subtitle",
					children: t("tencentLexiang.heading.subtitle")
				})]
			}), showActions ? /* @__PURE__ */ (0, import_jsx_runtime$44.jsxs)("div", {
				className: "tencent-lexiang-panel__heading-actions",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$44.jsx)(Button, {
					variant: "ghost",
					size: "small",
					className: "tencent-lexiang-panel__goto-btn",
					rightIcon: /* @__PURE__ */ (0, import_jsx_runtime$44.jsx)(ExternalArrowIcon, { size: 16 }),
					onClick: onGotoLexiang,
					children: t("tencentLexiang.topbar.gotoLexiang")
				}), /* @__PURE__ */ (0, import_jsx_runtime$44.jsx)(Dropdown, {
					trigger: /* @__PURE__ */ (0, import_jsx_runtime$44.jsx)(Button, {
						variant: "ghost",
						iconOnly: true,
						size: "small",
						className: "tencent-lexiang-panel__settings-btn",
						title: t("tencentLexiang.settings"),
						leftIcon: /* @__PURE__ */ (0, import_jsx_runtime$44.jsx)(CircleMoreIcon, { size: 16 })
					}),
					items: settingsMenuItems,
					onSelect: handleSettingsSelect,
					placement: "bottom-end"
				})]
			}) : null]
		}), /* @__PURE__ */ (0, import_jsx_runtime$44.jsx)(ConfirmDialog, {
			visible: showRevokeConfirm,
			title: t("tencentLexiang.auth.revokeConfirmTitle"),
			content: t("tencentLexiang.auth.revokeConfirmDesc"),
			confirmText: t("tencentLexiang.auth.revokeConfirmOk"),
			cancelText: t("common.cancel"),
			confirmVariant: "danger",
			confirmButtonColor: "#CF222E",
			theme: theme === "dark" ? "dark" : "light",
			onConfirm: handleRevoke,
			onClose: () => setShowRevokeConfirm(false),
			overlayClassName: "kb-revoke-confirm-dialog"
		})] });
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/lexiang-layout/sidebar-shortcut-access.tsx
var import_react$50, import_jsx_runtime$43, SidebarShortcutAccess;
var init_sidebar_shortcut_access = __esmMin((() => {
	import_react$50 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_api();
	init_constants();
	init_store();
	init_ui_icons();
	import_jsx_runtime$43 = require_jsx_runtime();
	SidebarShortcutAccess = () => {
		const t = useTranslation();
		const pageView = useTencentLexiangStore((s) => s.pageView);
		const personalKbInfo = useTencentLexiangStore((s) => s.personalKbInfo);
		const currentKbId = useTencentLexiangStore((s) => s.currentKnowledgeBase?.id);
		const isPersonalKbActive = pageView === "space-detail" && !!personalKbInfo?.id && currentKbId === personalKbInfo.id;
		/** 跳到个人知识库：若 personalKbInfo 尚未加载（面板处于 space-list 页时不会触发 detail init），
		*  先按需拉取后再跳转。 */
		const handleSelect = (0, import_react$50.useCallback)(async () => {
			let info = tencentLexiangStore.getState().personalKbInfo;
			if (!info?.id) try {
				const data = await fetchPersonalSpace();
				if (data?.space?.id) {
					info = {
						id: data.space.id,
						logo: data.space.logo,
						description: data.space.description,
						rootEntryId: data.space.root_entry_id
					};
					tencentLexiangStore.getState().setPersonalKbInfo(info);
				}
			} catch {
				return;
			}
			if (!info?.id) return;
			tencentLexiangStore.getState().closePreview();
			tencentLexiangStore.getState().goToSpaceDetail({
				id: info.id,
				name: t("tencentLexiang.sidebar.myPersonalKb"),
				avatar: info.logo || void 0,
				home_url: buildKbHomeUrl(info.id),
				rootEntryId: info.rootEntryId
			});
		}, [t]);
		return /* @__PURE__ */ (0, import_jsx_runtime$43.jsxs)("div", {
			className: "tencent-lexiang-sidebar__group",
			children: [/* @__PURE__ */ (0, import_jsx_runtime$43.jsx)("div", {
				className: "tencent-lexiang-sidebar__group-header",
				children: /* @__PURE__ */ (0, import_jsx_runtime$43.jsx)("span", {
					className: "tencent-lexiang-sidebar__group-title",
					children: t("tencentLexiang.sidebar.personalKb")
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime$43.jsx)("div", {
				className: "tencent-lexiang-sidebar__list",
				children: /* @__PURE__ */ (0, import_jsx_runtime$43.jsxs)("div", {
					className: ["tencent-lexiang-sidebar__item", isPersonalKbActive ? "is-active" : ""].filter(Boolean).join(" "),
					onClick: handleSelect,
					children: [/* @__PURE__ */ (0, import_jsx_runtime$43.jsx)("span", {
						className: "tencent-lexiang-sidebar__item-icon",
						children: /* @__PURE__ */ (0, import_jsx_runtime$43.jsx)(KnowledgeBaseIcon, { size: 16 })
					}), /* @__PURE__ */ (0, import_jsx_runtime$43.jsx)("span", {
						className: "tencent-lexiang-sidebar__item-name",
						children: t("tencentLexiang.sidebar.myPersonalKb")
					})]
				})
			})]
		});
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/hooks/use-team-privilege-config.ts
function useTeamPrivilegeConfig() {
	const [config, setConfig] = (0, import_react$49.useState)(null);
	const [isAdmin, setIsAdmin] = (0, import_react$49.useState)(false);
	const [loading, setLoading] = (0, import_react$49.useState)(true);
	const [error, setError] = (0, import_react$49.useState)(false);
	const load = (0, import_react$49.useCallback)(() => {
		let cancelled = false;
		setLoading(true);
		setError(false);
		fetchTeamPrivilegeConfig().then((c) => {
			if (!cancelled) setConfig(c);
		}).catch(() => {
			if (!cancelled) setError(true);
		}).finally(() => {
			if (!cancelled) setLoading(false);
		});
		fetchMyPermissions().then((data) => {
			if (!cancelled) setIsAdmin(data.permissions.includes("root"));
		}).catch(() => {
			if (!cancelled) setIsAdmin(false);
		});
		return () => {
			cancelled = true;
		};
	}, []);
	(0, import_react$49.useEffect)(() => load(), [load]);
	return {
		config,
		loading,
		error,
		isConfigReady: !!config,
		canCreateTeam: config?.can_create_team === true || isAdmin,
		refetch: load
	};
}
var import_react$49;
var init_use_team_privilege_config = __esmMin((() => {
	import_react$49 = /* @__PURE__ */ __toESM(require_react());
	init_privilege_service();
	init_team_service();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/create-space-dialog/create-space-dialog.less
var init_create_space_dialog$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/create-team-dialog/create-team-dialog.less
var init_create_team_dialog$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/assets/team-logo-default.png
var team_logo_default_default;
var init_team_logo_default = __esmMin((() => {
	team_logo_default_default = "" + new URL("team-logo-default-CNwkbOOP.png", import.meta.url).href;
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/member-selector/member-selector.less
var init_member_selector$2 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/api/account-service.ts
/**
* 获取当前登录用户信息。
* 失败时返回 null（降级处理）。
*/
async function fetchCurrentStaff() {
	try {
		return unwrapData(await callSpApi({ path: "/spapi/account/v1/staff" }))?.staff ?? null;
	} catch {
		return null;
	}
}
/**
* 获取当前企业/公司信息。
* 失败时返回 null（降级处理）。
*/
async function fetchCurrentCompany() {
	try {
		return unwrapData(await callSpApi({ path: "/spapi/account/v1/company" }))?.company ?? null;
	} catch {
		return null;
	}
}
var init_account_service = __esmMin((() => {
	init_spapi_client();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/member-avatar/member-avatar.less
var init_member_avatar$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/hooks/use-lexiang-logo.ts
/**
* 解析乐享 logo 并通过 ref 安全设置到 img 元素上。
*
* 使用方式：
* ```tsx
* const { imgRef, ready, onError } = useLexiangLogo({ rawLogo: space.logo });
* return (
*   <>
*     <img ref={imgRef} referrerPolicy='no-referrer' onError={onError}
*          style={ready ? undefined : { display: 'none' }} />
*     {!ready && <FallbackIcon />}
*   </>
* );
* ```
*/
function useLexiangLogo({ rawLogo, maxRetry = 0 }) {
	const [ready, setReady] = (0, import_react$48.useState)(false);
	const [broken, setBroken] = (0, import_react$48.useState)(false);
	const imgRef = (0, import_react$48.useRef)(null);
	const retryCountRef = (0, import_react$48.useRef)(0);
	(0, import_react$48.useEffect)(() => {
		retryCountRef.current = 0;
		setBroken(false);
		if (!rawLogo) {
			setReady(false);
			if (imgRef.current) imgRef.current.src = "";
			return;
		}
		let cancelled = false;
		resolveSpaceLogoUrl(rawLogo).then((url) => {
			if (cancelled || !url) {
				if (!cancelled) setReady(false);
				return;
			}
			if (imgRef.current) {
				imgRef.current.referrerPolicy = "no-referrer";
				imgRef.current.src = url;
				setReady(true);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [rawLogo]);
	const onError = (0, import_react$48.useCallback)(() => {
		if (!rawLogo || retryCountRef.current >= maxRetry) {
			setBroken(true);
			setReady(false);
			return;
		}
		retryCountRef.current += 1;
		invalidateLogoUrlCache(rawLogo);
		resolveSpaceLogoUrl(rawLogo).then((url) => {
			if (!url) {
				setBroken(true);
				setReady(false);
				return;
			}
			if (imgRef.current) {
				imgRef.current.referrerPolicy = "no-referrer";
				imgRef.current.src = url;
			}
		});
	}, [rawLogo, maxRetry]);
	return {
		imgRef,
		ready: ready && !broken,
		onError
	};
}
var import_react$48;
var init_use_lexiang_logo = __esmMin((() => {
	import_react$48 = /* @__PURE__ */ __toESM(require_react());
	init_api();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/assets/avatar-default.png
var avatar_default_default;
var init_avatar_default = __esmMin((() => {
	avatar_default_default = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAjjSURBVHgB7Z1NbFRVFMfPszRFscQQsA2QQIACjZGysSWotMaGJrLAwkJNsHWHaNWF0aQsNLqARMNGq8HEDY0LXdjKQhNIm0AIBmFh2dgSgUAi0AZEmFLoB+34/vP6uGcer+20cz/OkPdLyLw3ZWY673/POffce86r99fVdJoSxPAYJYgiEUQYiSDCSAQRRiKIMBJBhJEIIoxEEGEkgggjEUQYiSDCmEcFyJ0RooEU0fkbwWPIghKi8lL/30Ki1UuoICkYQc7+Q3Tyov94hejCjdxeU7WMaPMqoudXBSIVAp7k1V5YAkQ42hsIkQ8QZ2slUUMliUasIEd8EdpPZ7skzvoyospyooXz01Q6P3hucJiot9+jlP/YNxD/ujLfUj7f5ru0xSQScYL0+wJ82fWwReCi76hK08vrfTEyQkz/PlduEZ2+RNTV51H3uYd/vqOKqKmG6MkSEoUoQRAnPvmNaGhEPQchmmvS1LRpZhGmAuK0HSPqPOtlPQ9rOdAoK76IEaSjh+jbE9nPNW9K07u1cxciSpww0lyYCEHa/wjiRciyp4j2b09T9UoyQvspoq+Pe5mYA+C2DuyQIYpzQaKWgUDd9lo6I4pJYC1Nh7zMI4AoB193776cZuoI4FExDjWbFwPgM9rZZ2GK/emvwaNLnAmCL/5hpzrHhYEYuuJFLuAzYY3htBkJJ9ynS5wJAlcV5hi4IO2WxQiBVb5Xq7x2x9n8k9B8cCIIXBUP4nsb7LipqcCUunqFOndpJU4E4WJghDZuJOfsf1VZCSzElZVYFwTWgbWpkNYGGXkpLLSxSv0uJy+QE6wLwkce8gxTucZc4JZ6tM/NjMu6INw6+IiUAAYHnwbnusyvE6uC4EtyC8FCoTRcuy2rgkTdlYtp7kxwF+oisFsV5MJ1dVxZLnNfDEv7IQODZB2rgpxnPhkbTBKB1fI4MtUGmSmsCsL3OVwmgjNRylzpnVGyivWgHlIqMH6ELGS7iLanvnYFYaNNYkCXQFIoJwyrgqCILSTcGJJIyuGeiFVBygpEkL5+dWx7W9eqILzkZqq6KdegdCgEYtguE7IqSNVydYyCNolkCeKgPtiuIMvUMb54apjEwUuEUBNsG+sui4viev86CgYJr0J55AUBW1mx86FTnigr4dax2YEYwLogGHVhoEShmhQr6fVnVp096rypmpxgXRCI8WaNOoeV9PaTc1p+UtYBK3ZVMOckU99ZpWIJrAQXw2Ve0nZMfT66sFxZB3C2dPJRvXJduBgQxUU8afcttO24Ot+50W05qTNB8KX3vKjO4bYav7NrKZ09Hu07os4RyF1aB3C6uIj2sj1b1HlYAM2DqylgGa2H1TnaEj6uJ+eIaEdA+xq6pjgoyWmp1V/RCNFbD3tZGbmkxh0xDTsooEPxdXTLFMKgEiTf+i24xF/8PAM1xYMsVmG96rNtcrqoxLRFQ4g1ix8WBO4Lvh6WggKE+nXpWZWeth0PrIFbBAcTi7C6JLEQCtzVbNueuz/IzZVBTLinXEH+gaDuUhhnFoL+czTrxFV1YL+9fl1QKgRXc/qyntkXKtzRt5h5z0u+5VzO/vnRycHhUhjrFpJL23NcvMBFxMYRLGM28aS7L1hVxvtG9/HxPH4OlxgVB0CUphqyilVBMPq+OaG/7RnAgvKZkU3VOo0VBSSxtqzFmiDRTlugq+153xEv01kLy0EnVj5Em0GBzWmxlcQwru0ZF661IX8xcOEgBphuNpUr+N0waWhhbW4Dk1PyfgtVjMYFiYqBwNq5W18PelSAuFgwF1rqgkETFvTZEsWoILhVBhejcWOa2t/S29zZfS7b52M5XxehC+SioHXaJMYEQQnmF93qHL2E+7eTVjBL6urLfg5ZeL5ui4Pfm8cl063TxgThbc9hP7huzlyKfz7u7j/5AFH2NmS3TptyXUYEibY9m1gkBF3MXS1n79/Ro7/EiLdOw/qjM0ZdGBGEJ32Z7lZDbc/cXe16jujx4uBYt9sKaalTVvL7RTOV8UYEiVqHCXDBw1XbRQsC4WtWqp/rdlsg0zXMrIQ3sOpCuyBwV/yWGaasg2fUFZMVhhtYzZcJtwXq17Om0IukHe2C8FbiynIyBndJoWVAGNNui3cOm2ib1i4IX72tXmHOXYVLG3BXFawGt65CHZvYCoZrDPMSuC3dcUS7ICgUwIIcfK2NYF4RKYiueJr9v3NmKllw96C1/ue8s0V/dbz2/RAswOF2eUtK01RSTEbg2TkP5AACLXqC6ObdwG1hyV737TswBX7lGaLhMdKOscRw5D4ZAfsiobtCvKiIaRngImEL1wRj42QEc0snwx5NTJB2eHbOZ1WcTSvVMQTU7bawnzNu4LsBY4JM+PE8dU//6OyIme5G4YF+cHJXUBf3x818rxCjq72YgQxrbLyHq+L9f1NZCFjDxIruAubDrbueMesAxvdDbg552kThecWGpSrniOOltdmv0+G2/rvjGQnkHOOCwHXd8L+IDjPvZNn3dNYBogE/n5wEbmrgtkdDFm6zYa22N3WP6Notj0bmOMIyN9dnu4EVOTRkPrtUHUc3snIBkxIMpIGUZ2xWFcVqsTV87/VBL/NvaJYZbrQu6+/rM7/m6m11PJtllFCIa7e9zECyWSjlpFAOVjIyFnzZknlokklTcZE/OqYZHigjxbJFKMwPZ4LHaGII7vrv//3JbNH40nkc930R7o1iEuIZy6FyQdSfq0BmX+yLMr84TUX+Y3FkuMSV6Lxfl+2+IMZXx7ItCmK01KpzXPxx3wWNjiPB82h0LHhOAqL/5BGY5wtTVBT4Voh0LZWmt3/0HixiInhDFOwY/jsUiIFlk5Bmf5lj9wu+25kIsuvxtF0XNFvECxJHtHUBouyqJvr5z2wxUAbquiNqthSkIGCqfpIQdENtFf4HwOIo2PtllU+Wd5bFlHcWqhigoG9gFhUFLc0H3yhcMUDBuixOeD/5zauDLqxC5pEQ5FEiueeiMBJBhJEIIoxEEGEkgggjEUQYiSDCSAQRRiKIMBJBhJEIIoxEEGH8D1rdex5ooAo1AAAAAElFTkSuQmCC";
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/icons/staff-default-icon.tsx
function StaffDefaultIcon({ size = 16 }) {
	return /* @__PURE__ */ (0, import_jsx_runtime$42.jsx)("img", {
		src: avatar_default_default,
		width: size,
		height: size,
		alt: "",
		draggable: false,
		style: {
			display: "block",
			borderRadius: "50%"
		}
	});
}
var import_jsx_runtime$42;
var init_staff_default_icon = __esmMin((() => {
	require_react();
	init_avatar_default();
	import_jsx_runtime$42 = require_jsx_runtime();
})), import_jsx_runtime$41, ROOT_DEPARTMENT_ID$1, MemberAvatar;
var init_member_avatar = __esmMin((() => {
	init_member_avatar$1();
	require_react();
	init_use_lexiang_logo();
	init_staff_default_icon();
	init_ui_icons();
	import_jsx_runtime$41 = require_jsx_runtime();
	ROOT_DEPARTMENT_ID$1 = "1";
	MemberAvatar = ({ subjectType, subjectId, avatar, displayName, size = 20 }) => {
		const { imgRef, ready: showAvatar, onError: handleAvatarError } = useLexiangLogo({ rawLogo: subjectType === "staff" ? avatar : void 0 });
		if (subjectType === "department") return /* @__PURE__ */ (0, import_jsx_runtime$41.jsx)("span", {
			className: "lexiang-member-avatar lexiang-member-avatar--icon",
			style: {
				width: size,
				height: size
			},
			children: /* @__PURE__ */ (0, import_jsx_runtime$41.jsx)(subjectId === ROOT_DEPARTMENT_ID$1 ? CompanyIcon : OrganizationIcon, { size: Math.round(size * .65) })
		});
		if (subjectType === "contact_tag") return /* @__PURE__ */ (0, import_jsx_runtime$41.jsx)("span", {
			className: "lexiang-member-avatar lexiang-member-avatar--icon",
			style: {
				width: size,
				height: size
			},
			children: /* @__PURE__ */ (0, import_jsx_runtime$41.jsx)(TagIcon, { size: Math.round(size * .65) })
		});
		return /* @__PURE__ */ (0, import_jsx_runtime$41.jsxs)("span", {
			className: "lexiang-member-avatar lexiang-member-avatar--staff",
			style: {
				width: size,
				height: size
			},
			children: [/* @__PURE__ */ (0, import_jsx_runtime$41.jsx)("img", {
				ref: imgRef,
				alt: displayName ?? "",
				draggable: false,
				referrerPolicy: "no-referrer",
				onError: handleAvatarError,
				className: "lexiang-member-avatar__img",
				style: showAvatar ? {
					width: size,
					height: size,
					borderRadius: "50%"
				} : { display: "none" }
			}), !showAvatar && /* @__PURE__ */ (0, import_jsx_runtime$41.jsx)(StaffDefaultIcon, { size })]
		});
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/member-selector/member-role-list.tsx
var import_react$45, import_jsx_runtime$40, SUBJECT_TYPE_ORDER, getOrder, MemberRoleList;
var init_member_role_list = __esmMin((() => {
	init_src();
	import_react$45 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_member_avatar();
	import_jsx_runtime$40 = require_jsx_runtime();
	SUBJECT_TYPE_ORDER = {
		department: 0,
		contact_tag: 1,
		staff: 2
	};
	getOrder = (type) => SUBJECT_TYPE_ORDER[type] ?? 2;
	MemberRoleList = ({ value, onChange, hasNone, currentStaffId }) => {
		const t = useTranslation();
		const displayValue = (0, import_react$45.useMemo)(() => {
			return [...currentStaffId ? value.filter((m) => !(m.subjectType === "staff" && m.id === currentStaffId)) : value].sort((a, b) => getOrder(a.subjectType) - getOrder(b.subjectType));
		}, [value, currentStaffId]);
		const roleItems = (0, import_react$45.useMemo)(() => [
			{
				key: "manager",
				label: t("tencentLexiang.memberRole.manager")
			},
			{
				key: "editor",
				label: t("tencentLexiang.memberRole.editor")
			},
			{
				key: "downloader",
				label: t("tencentLexiang.memberRole.downloader")
			},
			{
				key: "viewer",
				label: t("tencentLexiang.memberRole.viewer")
			},
			...hasNone ? [{
				key: "none",
				label: t("tencentLexiang.memberRole.none"),
				danger: true,
				divider: hasNone
			}] : [],
			{
				key: "remove",
				label: t("tencentLexiang.memberRole.remove"),
				danger: true,
				divider: !hasNone
			}
		], [t, hasNone]);
		const handleRemove = (0, import_react$45.useCallback)((memberId) => {
			onChange(value.filter((m) => m.id !== memberId));
		}, [value, onChange]);
		const handleRoleChange = (0, import_react$45.useCallback)((memberId, key) => {
			if (key === "remove") {
				handleRemove(memberId);
				return;
			}
			onChange(value.map((m) => m.id === memberId ? {
				...m,
				role: key
			} : m));
		}, [
			value,
			onChange,
			handleRemove
		]);
		if (displayValue.length === 0) return null;
		return /* @__PURE__ */ (0, import_jsx_runtime$40.jsx)("div", {
			className: "tencent-lexiang-member-list",
			children: displayValue.map((member) => /* @__PURE__ */ (0, import_jsx_runtime$40.jsxs)("div", {
				className: "tencent-lexiang-member-item",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime$40.jsx)(MemberAvatar, {
						subjectType: member.subjectType,
						subjectId: member.id,
						avatar: member.avatar,
						displayName: member.displayName,
						size: 20
					}),
					/* @__PURE__ */ (0, import_jsx_runtime$40.jsx)("span", {
						className: "tencent-lexiang-member-item__name",
						children: member.displayName
					}),
					/* @__PURE__ */ (0, import_jsx_runtime$40.jsx)("div", {
						className: "tencent-lexiang-member-item__role",
						children: /* @__PURE__ */ (0, import_jsx_runtime$40.jsx)(Dropdown, {
							trigger: /* @__PURE__ */ (0, import_jsx_runtime$40.jsxs)("button", {
								type: "button",
								className: "tencent-lexiang-member-item__role-btn",
								children: [roleItems.find((r) => r.key === member.role)?.label || member.role, /* @__PURE__ */ (0, import_jsx_runtime$40.jsx)("span", {
									className: "tencent-lexiang-member-item__role-arrow",
									children: "▾"
								})]
							}),
							items: roleItems.map((r) => ({
								...r,
								selected: r.key === member.role
							})),
							onSelect: (key) => handleRoleChange(member.id, key),
							placement: "bottom-end"
						})
					})
				]
			}, member.id))
		});
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/member-selector/role-selector.tsx
var import_react$44, import_jsx_runtime$39, RoleSelector;
var init_role_selector = __esmMin((() => {
	init_src();
	import_react$44 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	import_jsx_runtime$39 = require_jsx_runtime();
	RoleSelector = ({ value, onChange }) => {
		const t = useTranslation();
		const roleItems = (0, import_react$44.useMemo)(() => [
			{
				key: "manager",
				label: t("tencentLexiang.memberRole.manager")
			},
			{
				key: "editor",
				label: t("tencentLexiang.memberRole.editor")
			},
			{
				key: "downloader",
				label: t("tencentLexiang.memberRole.downloader")
			},
			{
				key: "viewer",
				label: t("tencentLexiang.memberRole.viewer")
			}
		], [t]);
		return /* @__PURE__ */ (0, import_jsx_runtime$39.jsx)(Dropdown, {
			trigger: /* @__PURE__ */ (0, import_jsx_runtime$39.jsxs)("button", {
				type: "button",
				className: "tencent-lexiang-role-selector",
				children: [roleItems.find((r) => r.key === value)?.label ?? value, /* @__PURE__ */ (0, import_jsx_runtime$39.jsx)("span", {
					className: "tencent-lexiang-role-selector__arrow",
					children: "▾"
				})]
			}),
			items: roleItems.map((r) => ({
				...r,
				selected: r.key === value
			})),
			onSelect: (key) => onChange(key),
			placement: "bottom-start"
		});
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/member-selector/member-selector.tsx
var import_react$43, import_jsx_runtime$38, toSubjectType, DEBOUNCE_MS$2, MemberSelector;
var init_member_selector$1 = __esmMin((() => {
	init_src();
	import_react$43 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_contact_service();
	init_member_avatar();
	init_role_selector();
	import_jsx_runtime$38 = require_jsx_runtime();
	toSubjectType = (model) => {
		if (model === "department") return "department";
		if (model === "contact_tag" || model === "contacttag") return "contact_tag";
		return "staff";
	};
	DEBOUNCE_MS$2 = 300;
	MemberSelector = ({ addedIds, currentStaffId, onSelect, placeholder }) => {
		const t = useTranslation();
		const [keyword, setKeyword] = (0, import_react$43.useState)("");
		const [results, setResults] = (0, import_react$43.useState)([]);
		const [searching, setSearching] = (0, import_react$43.useState)(false);
		const [dropdownOpen, setDropdownOpen] = (0, import_react$43.useState)(false);
		const [highlightIndex, setHighlightIndex] = (0, import_react$43.useState)(0);
		const debounceRef = (0, import_react$43.useRef)(null);
		const listRef = (0, import_react$43.useRef)(null);
		const inputRef = (0, import_react$43.useRef)(null);
		const [pendingItems, setPendingItems] = (0, import_react$43.useState)([]);
		const [pendingRole, setPendingRole] = (0, import_react$43.useState)("viewer");
		const showActionBar = pendingItems.length > 0;
		const occupiedIds = new Set([...addedIds ?? [], ...pendingItems.map((p) => p.id)]);
		const occupiedIdsRef = (0, import_react$43.useRef)(occupiedIds);
		occupiedIdsRef.current = occupiedIds;
		const showDropdown = dropdownOpen && keyword.trim().length > 0;
		const handleSearchChange = (0, import_react$43.useCallback)((val) => {
			setKeyword(val);
			if (debounceRef.current) clearTimeout(debounceRef.current);
			if (!val.trim()) {
				setResults([]);
				setDropdownOpen(false);
				return;
			}
			debounceRef.current = setTimeout(async () => {
				setSearching(true);
				setResults([]);
				try {
					const list = await searchContacts(val.trim(), {
						limit: 20,
						withTags: true
					});
					setResults(list);
					setDropdownOpen(true);
					const firstSelectableIdx = list.findIndex((item) => !occupiedIdsRef.current.has(item.id));
					setHighlightIndex(firstSelectableIdx >= 0 ? firstSelectableIdx : 0);
				} catch {
					setResults([]);
				} finally {
					setSearching(false);
				}
			}, DEBOUNCE_MS$2);
		}, []);
		const scrollToHighlightedOption = (0, import_react$43.useCallback)((index) => {
			if (!listRef.current) return;
			listRef.current.querySelectorAll("[data-option-index]")[index]?.scrollIntoView({ block: "nearest" });
		}, []);
		const handlePickItemRef = (0, import_react$43.useRef)(() => {});
		const handlePickItem = (0, import_react$43.useCallback)((item) => {
			if (occupiedIdsRef.current.has(item.id) && !(currentStaffId && item.id === currentStaffId)) return;
			setPendingItems((prev) => [...prev, item]);
			setKeyword("");
			setResults([]);
			setDropdownOpen(false);
			if (debounceRef.current) clearTimeout(debounceRef.current);
			setTimeout(() => inputRef.current?.focus(), 0);
		}, [currentStaffId]);
		handlePickItemRef.current = handlePickItem;
		const handleRemovePending = (0, import_react$43.useCallback)((id) => {
			setPendingItems((prev) => prev.filter((p) => p.id !== id));
			setTimeout(() => inputRef.current?.focus(), 0);
		}, []);
		const handleCancel = (0, import_react$43.useCallback)(() => {
			setPendingItems([]);
			setPendingRole("viewer");
			setKeyword("");
			setResults([]);
			setDropdownOpen(false);
			setTimeout(() => inputRef.current?.focus(), 0);
		}, []);
		const handleConfirm = (0, import_react$43.useCallback)(() => {
			if (pendingItems.length === 0) return;
			onSelect(pendingItems.map((item) => ({
				id: item.id,
				displayName: item.display_name || "",
				subjectType: toSubjectType(item.model),
				avatar: item.avatar,
				organization: item.organization,
				role: pendingRole
			})));
			setPendingItems([]);
			setPendingRole("viewer");
			setTimeout(() => inputRef.current?.focus(), 0);
		}, [
			pendingItems,
			pendingRole,
			onSelect
		]);
		return /* @__PURE__ */ (0, import_jsx_runtime$38.jsxs)("div", {
			className: "tencent-lexiang-member-search-wrapper",
			children: [/* @__PURE__ */ (0, import_jsx_runtime$38.jsx)(Popover, {
				trigger: /* @__PURE__ */ (0, import_jsx_runtime$38.jsxs)("div", {
					className: `tencent-lexiang-member-search${showActionBar ? " tencent-lexiang-member-search--active" : ""}`,
					onClick: () => inputRef.current?.focus(),
					children: [pendingItems.map((item) => /* @__PURE__ */ (0, import_jsx_runtime$38.jsxs)("span", {
						className: "tencent-lexiang-member-search__tag",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime$38.jsx)(MemberAvatar, {
								subjectType: toSubjectType(item.model),
								subjectId: item.id,
								avatar: item.avatar,
								displayName: item.display_name,
								size: 20
							}),
							/* @__PURE__ */ (0, import_jsx_runtime$38.jsx)("span", {
								className: "tencent-lexiang-member-search__tag-name",
								children: item.display_name
							}),
							/* @__PURE__ */ (0, import_jsx_runtime$38.jsx)(Button, {
								variant: "ghost",
								iconOnly: true,
								size: "small",
								className: "tencent-lexiang-member-search__tag-remove",
								onClick: (e) => {
									e.stopPropagation();
									handleRemovePending(item.id);
								},
								tabIndex: -1,
								"aria-label": "remove",
								children: "×"
							})
						]
					}, item.id)), /* @__PURE__ */ (0, import_jsx_runtime$38.jsx)("input", {
						ref: inputRef,
						type: "text",
						className: "tencent-lexiang-member-search__input",
						value: keyword,
						onChange: (e) => handleSearchChange(e.target.value),
						placeholder: pendingItems.length === 0 ? placeholder ?? t("tencentLexiang.createTeam.memberSearchPlaceholder") : "",
						onKeyDown: (e) => {
							if (e.key === "Backspace" && keyword === "" && pendingItems.length > 0) {
								e.preventDefault();
								setPendingItems((prev) => prev.slice(0, -1));
								return;
							}
							if (!showDropdown || results.length === 0) return;
							if (e.key === "ArrowDown") {
								e.preventDefault();
								setHighlightIndex((prev) => {
									for (let i = prev + 1; i < results.length; i++) if (!occupiedIds.has(results[i].id)) {
										scrollToHighlightedOption(i);
										return i;
									}
									return prev;
								});
							} else if (e.key === "ArrowUp") {
								e.preventDefault();
								setHighlightIndex((prev) => {
									for (let i = prev - 1; i >= 0; i--) if (!occupiedIds.has(results[i].id)) {
										scrollToHighlightedOption(i);
										return i;
									}
									return prev;
								});
							} else if (e.key === "Enter") {
								e.preventDefault();
								const item = results[highlightIndex];
								if (item) handlePickItemRef.current(item);
							}
						}
					})]
				}),
				placement: "bottom-start",
				triggerMode: "click",
				open: showDropdown,
				onOpenChange: (open) => {
					if (!open) setDropdownOpen(false);
				},
				portalRoot: "body",
				className: "tencent-lexiang-member-search-popover tencent-lexiang-scrollbar",
				children: /* @__PURE__ */ (0, import_jsx_runtime$38.jsxs)("div", {
					ref: listRef,
					className: "tencent-lexiang-member-search__dropdown",
					children: [
						searching && /* @__PURE__ */ (0, import_jsx_runtime$38.jsx)("div", {
							className: "tencent-lexiang-member-search__loading",
							children: /* @__PURE__ */ (0, import_jsx_runtime$38.jsx)(Loading, { size: "small" })
						}),
						!searching && results.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime$38.jsx)("div", {
							className: "tencent-lexiang-member-search__empty",
							children: t("tencentLexiang.createTeam.searchEmpty")
						}),
						!searching && results.map((item, idx) => {
							const isOccupied = currentStaffId && item.id === currentStaffId ? false : occupiedIds.has(item.id);
							return /* @__PURE__ */ (0, import_jsx_runtime$38.jsxs)("div", {
								"data-option-index": idx,
								className: [
									"tencent-lexiang-member-search__item",
									isOccupied ? "tencent-lexiang-member-search__item--disabled" : "",
									idx === highlightIndex && !isOccupied ? "tencent-lexiang-member-search__item--highlighted" : ""
								].filter(Boolean).join(" "),
								onClick: () => !isOccupied && handlePickItem(item),
								onMouseEnter: () => !isOccupied && setHighlightIndex(idx),
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime$38.jsx)(MemberAvatar, {
										subjectType: toSubjectType(item.model),
										subjectId: item.id,
										avatar: item.avatar,
										displayName: item.display_name,
										size: 32
									}),
									/* @__PURE__ */ (0, import_jsx_runtime$38.jsxs)("div", {
										className: "tencent-lexiang-member-search__item-info",
										children: [/* @__PURE__ */ (0, import_jsx_runtime$38.jsx)("span", {
											className: "tencent-lexiang-member-search__item-name",
											children: item.display_name
										}), item.organization && /* @__PURE__ */ (0, import_jsx_runtime$38.jsx)("span", {
											className: "tencent-lexiang-member-search__item-org",
											children: item.organization
										})]
									}),
									isOccupied && /* @__PURE__ */ (0, import_jsx_runtime$38.jsx)("span", {
										className: "tencent-lexiang-member-search__item-added",
										children: t("tencentLexiang.createTeam.alreadyAdded")
									})
								]
							}, item.id);
						})
					]
				})
			}), showActionBar && /* @__PURE__ */ (0, import_jsx_runtime$38.jsxs)("div", {
				className: "tencent-lexiang-member-search__action-bar",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$38.jsxs)("div", {
					className: "tencent-lexiang-member-search__action-role",
					children: [/* @__PURE__ */ (0, import_jsx_runtime$38.jsx)("span", {
						className: "tencent-lexiang-member-search__action-label",
						children: t("tencentLexiang.createTeam.setRole")
					}), /* @__PURE__ */ (0, import_jsx_runtime$38.jsx)(RoleSelector, {
						value: pendingRole,
						onChange: setPendingRole
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime$38.jsxs)("div", {
					className: "tencent-lexiang-member-search__action-btns",
					children: [/* @__PURE__ */ (0, import_jsx_runtime$38.jsx)(Button, {
						variant: "secondary",
						size: "small",
						onClick: handleCancel,
						children: t("tencentLexiang.createTeam.cancelAdd")
					}), /* @__PURE__ */ (0, import_jsx_runtime$38.jsx)(Button, {
						variant: "primary",
						size: "small",
						onClick: handleConfirm,
						children: t("tencentLexiang.createTeam.confirmAdd")
					})]
				})]
			})]
		});
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/member-selector/member-panel.tsx
var import_react$42, import_jsx_runtime$37, ROOT_DEPARTMENT_ID, MemberPanel;
var init_member_panel = __esmMin((() => {
	init_member_selector$2();
	import_react$42 = /* @__PURE__ */ __toESM(require_react());
	init_account_service();
	init_contact_service();
	init_member_role_list();
	init_member_selector$1();
	import_jsx_runtime$37 = require_jsx_runtime();
	ROOT_DEPARTMENT_ID = "1";
	MemberPanel = ({ value, onChange, placeholder, hasNone, injectRootDept = true, middleSlot }) => {
		const valueRef = (0, import_react$42.useRef)(value);
		(0, import_react$42.useEffect)(() => {
			valueRef.current = value;
		}, [value]);
		const onChangeRef = (0, import_react$42.useRef)(onChange);
		(0, import_react$42.useEffect)(() => {
			onChangeRef.current = onChange;
		}, [onChange]);
		const [currentStaffId, setCurrentStaffId] = (0, import_react$42.useState)(void 0);
		(0, import_react$42.useEffect)(() => {
			let cancelled = false;
			fetchCurrentStaff().then((staff) => {
				if (!cancelled && staff?.id) setCurrentStaffId(staff.id);
			}).catch(() => {});
			return () => {
				cancelled = true;
			};
		}, []);
		(0, import_react$42.useEffect)(() => {
			if (!injectRootDept) return;
			let cancelled = false;
			getDepartment(ROOT_DEPARTMENT_ID).then((dept) => {
				if (cancelled || !dept?.id) return;
				const defaultItem = {
					id: dept.id,
					displayName: dept.name,
					subjectType: "department",
					role: "viewer"
				};
				const current = valueRef.current;
				if (current.some((m) => m.id === defaultItem.id)) return;
				onChangeRef.current([defaultItem, ...current]);
			}).catch(() => {});
			return () => {
				cancelled = true;
			};
		}, [injectRootDept]);
		return /* @__PURE__ */ (0, import_jsx_runtime$37.jsxs)("div", {
			className: "tencent-lexiang-member-panel",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime$37.jsx)(MemberSelector, {
					addedIds: (0, import_react$42.useMemo)(() => new Set(value.map((m) => m.id)), [value]),
					currentStaffId,
					onSelect: (0, import_react$42.useCallback)((items) => {
						const current = valueRef.current;
						const existingIds = new Set(current.map((m) => m.id));
						const newItems = items.filter((item) => !existingIds.has(item.id));
						if (newItems.length === 0) return;
						onChangeRef.current([...current, ...newItems]);
					}, []),
					placeholder
				}),
				middleSlot,
				middleSlot && value.some((m) => m.id !== currentStaffId) && /* @__PURE__ */ (0, import_jsx_runtime$37.jsx)("div", { className: "tencent-lexiang-member-panel__divider" }),
				/* @__PURE__ */ (0, import_jsx_runtime$37.jsx)(MemberRoleList, {
					value,
					onChange,
					hasNone,
					currentStaffId
				})
			]
		});
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/member-selector/index.ts
var init_member_selector = __esmMin((() => {
	init_member_panel();
	init_member_selector$1();
	init_member_role_list();
	init_role_selector();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/create-team-dialog/team-duplicate-list.tsx
var import_react$41, import_jsx_runtime$36, DEBOUNCE_MS$1, TeamDuplicateItem, TeamDuplicateList;
var init_team_duplicate_list = __esmMin((() => {
	init_src();
	import_react$41 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_team_service();
	init_team_logo_default();
	init_use_lexiang_logo();
	init_store();
	import_jsx_runtime$36 = require_jsx_runtime();
	DEBOUNCE_MS$1 = 300;
	TeamDuplicateItem = ({ team, onBeforeNavigate }) => {
		const { imgRef: logoRef, ready: showLogo, onError: handleLogoError } = useLexiangLogo({ rawLogo: team.logo });
		return /* @__PURE__ */ (0, import_jsx_runtime$36.jsxs)("div", {
			className: "tencent-lexiang-team-duplicate__item",
			onClick: () => {
				onBeforeNavigate?.();
				tencentLexiangStore.getState().goToSpaceList(team);
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime$36.jsx)("img", {
					ref: logoRef,
					alt: team.name,
					draggable: false,
					referrerPolicy: "no-referrer",
					onError: handleLogoError,
					style: showLogo ? void 0 : { display: "none" },
					className: "tencent-lexiang-team-duplicate__logo"
				}),
				!showLogo && /* @__PURE__ */ (0, import_jsx_runtime$36.jsx)("img", {
					src: "" + new URL("team-logo-default-CNwkbOOP.png", import.meta.url).href,
					alt: "",
					draggable: false,
					className: "tencent-lexiang-team-duplicate__logo"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$36.jsx)("span", {
					className: "tencent-lexiang-team-duplicate__name",
					children: team.name
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$36.jsx)(ChevronRightIcon, {
					size: 14,
					className: "tencent-lexiang-team-duplicate__arrow"
				})
			]
		});
	};
	TeamDuplicateList = (0, import_react$41.forwardRef)(({ name, excludeId, onBeforeNavigate, onHasDuplicateChange }, ref) => {
		const t = useTranslation();
		const trimmedName = name.trim();
		const [debouncedName, setDebouncedName] = (0, import_react$41.useState)(trimmedName);
		(0, import_react$41.useEffect)(() => {
			const timer = setTimeout(() => setDebouncedName(trimmedName), DEBOUNCE_MS$1);
			return () => clearTimeout(timer);
		}, [trimmedName]);
		const [duplicates, setDuplicates] = (0, import_react$41.useState)([]);
		(0, import_react$41.useEffect)(() => {
			let cancelled = false;
			if (!debouncedName) {
				setDuplicates([]);
				return;
			}
			(async () => {
				const teams = await searchTeamsByName(debouncedName, 50);
				if (cancelled) return;
				setDuplicates(excludeId ? teams.filter((tm) => tm.id !== excludeId) : teams);
			})();
			return () => {
				cancelled = true;
			};
		}, [debouncedName, excludeId]);
		const hasDuplicate = duplicates.length > 0;
		(0, import_react$41.useImperativeHandle)(ref, () => ({ hasDuplicate }), [hasDuplicate]);
		const prevHasDuplicateRef = (0, import_react$41.useRef)(void 0);
		(0, import_react$41.useEffect)(() => {
			if (prevHasDuplicateRef.current === hasDuplicate) return;
			prevHasDuplicateRef.current = hasDuplicate;
			onHasDuplicateChange?.(hasDuplicate);
		}, [hasDuplicate, onHasDuplicateChange]);
		if (!(0, import_react$41.useMemo)(() => trimmedName.length > 0 && hasDuplicate, [trimmedName, hasDuplicate])) return null;
		return /* @__PURE__ */ (0, import_jsx_runtime$36.jsxs)("div", {
			className: "tencent-lexiang-team-duplicate",
			children: [/* @__PURE__ */ (0, import_jsx_runtime$36.jsx)("div", {
				className: "tencent-lexiang-team-duplicate__error",
				children: t("tencentLexiang.createTeam.duplicateName")
			}), /* @__PURE__ */ (0, import_jsx_runtime$36.jsx)("div", {
				className: "tencent-lexiang-team-duplicate__list tencent-lexiang-scrollbar--narrow",
				children: duplicates.map((team) => /* @__PURE__ */ (0, import_jsx_runtime$36.jsx)(TeamDuplicateItem, {
					team,
					onBeforeNavigate
				}, team.id))
			})]
		});
	});
	TeamDuplicateList.displayName = "TeamDuplicateList";
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/create-team-dialog/visible-type-selector.tsx
var import_react$40, import_jsx_runtime$35, VisibleTypeSelector;
var init_visible_type_selector = __esmMin((() => {
	init_src();
	import_react$40 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_ui_icons();
	import_jsx_runtime$35 = require_jsx_runtime();
	VisibleTypeSelector = ({ value, onChange }) => {
		const t = useTranslation();
		const options = (0, import_react$40.useMemo)(() => [{
			value: "visible",
			label: /* @__PURE__ */ (0, import_jsx_runtime$35.jsxs)("span", {
				className: "tencent-lexiang-visibility__option-label",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$35.jsx)(ViewIcon, { size: 16 }), /* @__PURE__ */ (0, import_jsx_runtime$35.jsx)("span", { children: t("tencentLexiang.createTeam.visible") })]
			}),
			tip: t("tencentLexiang.createTeam.visibleTip")
		}, {
			value: "hidden",
			label: /* @__PURE__ */ (0, import_jsx_runtime$35.jsxs)("span", {
				className: "tencent-lexiang-visibility__option-label",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$35.jsx)(ViewOffIcon, { size: 16 }), /* @__PURE__ */ (0, import_jsx_runtime$35.jsx)("span", { children: t("tencentLexiang.createTeam.hidden") })]
			}),
			tip: t("tencentLexiang.createTeam.hiddenTip")
		}], [t]);
		const current = options.find((o) => o.value === value) ?? options[0];
		return /* @__PURE__ */ (0, import_jsx_runtime$35.jsxs)("div", {
			className: "tencent-lexiang-visibility",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime$35.jsx)("div", {
					className: "tencent-lexiang-visibility__title",
					children: t("tencentLexiang.createTeam.visibilityTitle")
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$35.jsx)(Select, {
					options,
					value,
					onChange: (v) => onChange(v),
					fullWidth: true,
					className: "tencent-lexiang-visibility-select"
				}),
				current?.tip && /* @__PURE__ */ (0, import_jsx_runtime$35.jsx)("p", {
					className: "tencent-lexiang-visibility__tip",
					children: /* @__PURE__ */ (0, import_jsx_runtime$35.jsx)("span", { children: current.tip })
				})
			]
		});
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/create-team-dialog/index.tsx
var import_react$39, import_jsx_runtime$34, CreateTeamDialog;
var init_create_team_dialog = __esmMin((() => {
	init_create_team_dialog$1();
	init_src();
	import_react$39 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_spapi_client();
	init_team_service();
	init_team_logo_default();
	init_use_team_privilege_config();
	init_ui_icons();
	init_member_selector();
	init_team_duplicate_list();
	init_visible_type_selector();
	import_jsx_runtime$34 = require_jsx_runtime();
	CreateTeamDialog = ({ open, onOpenChange, onSuccess }) => {
		const t = useTranslation();
		const [name, setName] = (0, import_react$39.useState)("");
		const [signature, setSignature] = (0, import_react$39.useState)("");
		const [members, setMembers] = (0, import_react$39.useState)([]);
		const [visibility, setVisibility] = (0, import_react$39.useState)("visible");
		const [loading, setLoading] = (0, import_react$39.useState)(false);
		const [nameError, setNameError] = (0, import_react$39.useState)("");
		const [hasDuplicate, setHasDuplicate] = (0, import_react$39.useState)(false);
		const { config: privilegeConfig, loading: configLoading, error: configError, isConfigReady, refetch: refetchConfig } = useTeamPrivilegeConfig();
		const hasPatchedVisibility = (0, import_react$39.useRef)(false);
		const nameInputRef = (0, import_react$39.useRef)(null);
		const defaultIsSecret = privilegeConfig?.team_visibility === "invisible";
		const clearDefaultMembers = privilegeConfig?.team_permission === "creator_only";
		(0, import_react$39.useEffect)(() => {
			if (open) {
				setName("");
				setSignature("");
				setMembers([]);
				setVisibility("visible");
				setNameError("");
				setHasDuplicate(false);
				setLoading(false);
				hasPatchedVisibility.current = false;
			}
		}, [open]);
		(0, import_react$39.useEffect)(() => {
			if (open && isConfigReady && !hasPatchedVisibility.current) {
				setVisibility(defaultIsSecret ? "hidden" : "visible");
				hasPatchedVisibility.current = true;
			}
		}, [
			open,
			isConfigReady,
			defaultIsSecret
		]);
		(0, import_react$39.useEffect)(() => {
			if (open) {
				const timer = setTimeout(() => {
					nameInputRef.current?.focus();
				}, 100);
				return () => clearTimeout(timer);
			}
		}, [open]);
		const validateName = (0, import_react$39.useCallback)((value) => {
			if (!value.trim()) return t("tencentLexiang.createTeam.nameRequired");
			if (value.length > 100) return t("tencentLexiang.createTeam.nameMaxLength");
			return "";
		}, [t]);
		const handleNameChange = (0, import_react$39.useCallback)((val) => {
			setName(val);
			setNameError(validateName(val));
		}, [validateName]);
		const handleCancel = (0, import_react$39.useCallback)(() => {
			onOpenChange(false);
		}, [onOpenChange]);
		const handleOk = (0, import_react$39.useCallback)(async () => {
			const errMsg = validateName(name);
			if (errMsg) {
				setNameError(errMsg);
				return;
			}
			if (hasDuplicate) return;
			setLoading(true);
			try {
				const privileges = members.map((m) => ({
					subject_type: m.subjectType,
					subject_id: m.id,
					role: m.role
				}));
				const result = await createTeam({
					name: name.trim(),
					signature: signature.trim() || void 0,
					logo: "",
					privileges: privileges.length > 0 ? privileges : [],
					is_secret: visibility === "hidden"
				});
				message.success(t("tencentLexiang.createTeam.success"));
				onOpenChange(false);
				if (result.team) onSuccess?.(result.team);
			} catch (err) {
				if (isLexiangSpApiError(err) && err.status === 403) message.error(t("tencentLexiang.createTeam.noPermission"));
				else {
					const msg = isLexiangSpApiError(err) ? err.message : t("tencentLexiang.createTeam.failed");
					message.error(msg);
				}
			} finally {
				setLoading(false);
			}
		}, [
			name,
			nameError,
			hasDuplicate,
			signature,
			visibility,
			members,
			validateName,
			onOpenChange,
			onSuccess,
			t
		]);
		const handleDuplicateChange = (0, import_react$39.useCallback)((isDuplicate) => {
			setHasDuplicate(isDuplicate);
			if (!isDuplicate) setNameError("");
		}, []);
		const isOkDisabled = !name.trim() || !!nameError || hasDuplicate || !isConfigReady;
		return /* @__PURE__ */ (0, import_jsx_runtime$34.jsx)(Modal, {
			open,
			onOpenChange,
			title: t("tencentLexiang.createTeam.title"),
			size: "small",
			okText: t("tencentLexiang.createTeam.confirm"),
			cancelText: t("tencentLexiang.createTeam.cancel"),
			onOk: handleOk,
			onCancel: handleCancel,
			confirmLoading: loading,
			okButtonProps: { disabled: isOkDisabled },
			className: "tencent-lexiang-create-team-modal",
			closeOnOverlayClick: false,
			closeOnEscape: false,
			children: /* @__PURE__ */ (0, import_jsx_runtime$34.jsx)("div", {
				className: "tencent-lexiang-create-team",
				children: configError ? /* @__PURE__ */ (0, import_jsx_runtime$34.jsxs)("div", {
					className: "tencent-lexiang-create-team__config-error",
					children: [/* @__PURE__ */ (0, import_jsx_runtime$34.jsx)("span", { children: t("tencentLexiang.privilegeConfig.loadFailed") }), /* @__PURE__ */ (0, import_jsx_runtime$34.jsx)(Button, {
						variant: "link",
						size: "small",
						onClick: refetchConfig,
						children: t("tencentLexiang.privilegeConfig.retry")
					})]
				}) : /* @__PURE__ */ (0, import_jsx_runtime$34.jsxs)(Loading, {
					spinning: configLoading,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime$34.jsxs)("div", {
							className: "tencent-lexiang-create-team__header",
							children: [/* @__PURE__ */ (0, import_jsx_runtime$34.jsx)("img", {
								src: team_logo_default_default,
								alt: "",
								width: 60,
								height: 60,
								draggable: false,
								className: "tencent-lexiang-create-team__avatar-default"
							}), /* @__PURE__ */ (0, import_jsx_runtime$34.jsxs)("div", {
								className: "tencent-lexiang-create-team__info",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime$34.jsx)("input", {
										ref: nameInputRef,
										type: "text",
										className: `tencent-lexiang-create-team__name-input ${nameError ? "tencent-lexiang-create-team__name-input--error" : ""}`,
										value: name,
										onChange: (e) => handleNameChange(e.target.value),
										placeholder: t("tencentLexiang.createTeam.namePlaceholder")
									}),
									nameError && /* @__PURE__ */ (0, import_jsx_runtime$34.jsx)("span", {
										className: "tencent-lexiang-create-team__error",
										children: nameError
									}),
									/* @__PURE__ */ (0, import_jsx_runtime$34.jsx)(TeamDuplicateList, {
										name,
										onBeforeNavigate: () => onOpenChange(false),
										onHasDuplicateChange: handleDuplicateChange
									}),
									/* @__PURE__ */ (0, import_jsx_runtime$34.jsx)("textarea", {
										className: "tencent-lexiang-create-team__signature-input",
										value: signature,
										onChange: (e) => setSignature(e.target.value),
										placeholder: t("tencentLexiang.createTeam.signaturePlaceholder"),
										maxLength: 200,
										rows: 3
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime$34.jsxs)("div", {
							className: "tencent-lexiang-create-team__section",
							children: [/* @__PURE__ */ (0, import_jsx_runtime$34.jsxs)("div", {
								className: "tencent-lexiang-create-team__section-header",
								children: [/* @__PURE__ */ (0, import_jsx_runtime$34.jsx)("span", {
									className: "tencent-lexiang-create-team__section-title",
									children: t("tencentLexiang.createTeam.memberTitle")
								}), /* @__PURE__ */ (0, import_jsx_runtime$34.jsxs)("a", {
									className: "tencent-lexiang-create-team__section-link",
									href: "https://lexiangla.com/pages/278347f8e4ca43bfabbe523780543802?company_from=906ba45e6f9a11f089c57a2a2b4bccb6",
									target: "_blank",
									rel: "noopener noreferrer",
									children: [t("tencentLexiang.createTeam.memberExplain"), /* @__PURE__ */ (0, import_jsx_runtime$34.jsx)(ExternalArrowIcon, { size: 12 })]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime$34.jsx)(MemberPanel, {
								value: members,
								onChange: setMembers,
								injectRootDept: !clearDefaultMembers
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime$34.jsx)(VisibleTypeSelector, {
							value: visibility,
							onChange: setVisibility
						})
					]
				})
			})
		});
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/create-space-dialog/advanced-settings.tsx
var import_react$38, import_jsx_runtime$33, AdvancedSettings;
var init_advanced_settings = __esmMin((() => {
	init_src();
	import_react$38 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_feature_flag_service();
	import_jsx_runtime$33 = require_jsx_runtime();
	AdvancedSettings = ({ value, onChange }) => {
		const t = useTranslation();
		const [enabled, setEnabled] = (0, import_react$38.useState)(false);
		const [expanded, setExpanded] = (0, import_react$38.useState)(false);
		(0, import_react$38.useEffect)(() => {
			fetchFeatureFlags().then((flags) => {
				setEnabled(!!flags.admin_enable_workflow);
			}).catch(() => {});
		}, []);
		if (!enabled) return null;
		return /* @__PURE__ */ (0, import_jsx_runtime$33.jsxs)("div", {
			className: "lexiang-advanced-settings",
			children: [/* @__PURE__ */ (0, import_jsx_runtime$33.jsx)(Button, {
				variant: "ghost",
				size: "small",
				className: "lexiang-advanced-settings__toggle",
				onClick: () => setExpanded((prev) => !prev),
				rightIcon: /* @__PURE__ */ (0, import_jsx_runtime$33.jsx)(ChevronDownIcon, {
					size: 12,
					rotate: expanded ? 180 : 0
				}),
				children: t("tencentLexiang.createSpace.advancedSettings")
			}), expanded && /* @__PURE__ */ (0, import_jsx_runtime$33.jsxs)("div", {
				className: "lexiang-advanced-settings__content",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$33.jsxs)("div", {
					className: "lexiang-advanced-settings__header",
					children: [/* @__PURE__ */ (0, import_jsx_runtime$33.jsx)("span", {
						className: "lexiang-advanced-settings__title",
						children: t("tencentLexiang.createSpace.workflowMode")
					}), /* @__PURE__ */ (0, import_jsx_runtime$33.jsx)("span", {
						className: "lexiang-advanced-settings__warn",
						children: t("tencentLexiang.createSpace.workflowWarn")
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime$33.jsxs)("div", {
					className: "lexiang-advanced-settings__options",
					children: [/* @__PURE__ */ (0, import_jsx_runtime$33.jsxs)("label", {
						className: "lexiang-advanced-settings__option",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime$33.jsx)("input", {
								type: "radio",
								name: "publish_mode",
								checked: value === false,
								onChange: () => onChange(false)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime$33.jsx)("span", {
								className: "lexiang-advanced-settings__option-title",
								children: t("tencentLexiang.createSpace.workflowRealtime")
							}),
							/* @__PURE__ */ (0, import_jsx_runtime$33.jsx)("span", {
								className: "lexiang-advanced-settings__option-desc cb-font-size-fixed",
								children: t("tencentLexiang.createSpace.workflowRealtimeDesc")
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime$33.jsxs)("label", {
						className: "lexiang-advanced-settings__option",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime$33.jsx)("input", {
								type: "radio",
								name: "publish_mode",
								checked: value === true,
								onChange: () => onChange(true)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime$33.jsx)("span", {
								className: "lexiang-advanced-settings__option-title",
								children: t("tencentLexiang.createSpace.workflowApproval")
							}),
							/* @__PURE__ */ (0, import_jsx_runtime$33.jsx)("span", {
								className: "lexiang-advanced-settings__option-desc cb-font-size-fixed",
								children: t("tencentLexiang.createSpace.workflowApprovalDesc")
							})
						]
					})]
				})]
			})]
		});
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/create-space-dialog/space-inherit-list.tsx
var import_react$37, import_jsx_runtime$32, MANAGER_ROLE_KEYS, MEMBER_ROLE_KEYS, InheritRow, SpaceInheritList;
var init_space_inherit_list = __esmMin((() => {
	init_src();
	import_react$37 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_privilege_service();
	init_member_avatar();
	import_jsx_runtime$32 = require_jsx_runtime();
	MANAGER_ROLE_KEYS = [
		{
			key: "manager",
			i18nKey: "tencentLexiang.memberRole.manager"
		},
		{
			key: "editor",
			i18nKey: "tencentLexiang.memberRole.editor"
		},
		{
			key: "downloader",
			i18nKey: "tencentLexiang.memberRole.downloader"
		},
		{
			key: "viewer",
			i18nKey: "tencentLexiang.memberRole.viewer"
		},
		{
			key: "none",
			i18nKey: "tencentLexiang.memberRole.none",
			danger: true,
			divider: true
		}
	];
	MEMBER_ROLE_KEYS = [
		{
			key: "inheritor",
			i18nKey: "tencentLexiang.createSpace.inheritTeamRole"
		},
		{
			key: "manager",
			i18nKey: "tencentLexiang.memberRole.manager",
			divider: true
		},
		{
			key: "editor",
			i18nKey: "tencentLexiang.memberRole.editor"
		},
		{
			key: "downloader",
			i18nKey: "tencentLexiang.memberRole.downloader"
		},
		{
			key: "viewer",
			i18nKey: "tencentLexiang.memberRole.viewer"
		},
		{
			key: "none",
			i18nKey: "tencentLexiang.memberRole.none",
			danger: true,
			divider: true
		}
	];
	InheritRow = ({ item, teamId, roleKeys, onRoleChange, inheritNoPermission }) => {
		const t = useTranslation();
		const [expanded, setExpanded] = (0, import_react$37.useState)(false);
		const [members, setMembers] = (0, import_react$37.useState)([]);
		const [nextPageToken, setNextPageToken] = (0, import_react$37.useState)();
		const [hasMore, setHasMore] = (0, import_react$37.useState)(false);
		const [loadingMembers, setLoadingMembers] = (0, import_react$37.useState)(false);
		const mountedRef = (0, import_react$37.useRef)(true);
		(0, import_react$37.useEffect)(() => () => {
			mountedRef.current = false;
		}, []);
		const loadingMoreRef = (0, import_react$37.useRef)(false);
		const LIMIT = 20;
		/** 按 inheritType 过滤：manager 行只留 manager，member 行留非 manager。
		*  接受 inheritType 参数而非从闭包捕获 item，避免 fetchPage 里读到 stale item。 */
		const filterByInheritType = (p, inheritType) => inheritType === "manager" ? p.role === "manager" : p.role !== "manager";
		/**
		* 拉一页数据，过滤后不足 LIMIT 时补拉一次。
		* hasMore 用未过滤的原始数量 === LIMIT 来判断（不依赖 next_page_token）。
		*/
		const fetchPage = async (pageToken) => {
			const inheritType = item.inheritType;
			const res = await fetchPrivilegePagination(teamId, "team", {
				pageToken,
				limit: LIMIT
			});
			const rawHasMore = res.privileges.length === LIMIT;
			const filtered = res.privileges.filter((p) => filterByInheritType(p, inheritType));
			if (filtered.length < LIMIT && rawHasMore && res.next_page_token) {
				const res2 = await fetchPrivilegePagination(teamId, "team", {
					pageToken: res.next_page_token,
					limit: LIMIT
				});
				const filtered2 = res2.privileges.filter((p) => filterByInheritType(p, inheritType));
				return {
					filtered: [...filtered, ...filtered2],
					nextToken: res2.next_page_token,
					rawHasMore: res2.privileges.length === LIMIT
				};
			}
			return {
				filtered,
				nextToken: res.next_page_token,
				rawHasMore
			};
		};
		(0, import_react$37.useEffect)(() => {
			if (!expanded || !teamId) {
				setMembers([]);
				setNextPageToken(void 0);
				setHasMore(false);
				return;
			}
			let cancelled = false;
			setLoadingMembers(true);
			setMembers([]);
			setNextPageToken(void 0);
			setHasMore(false);
			fetchPage(void 0).then(({ filtered, nextToken, rawHasMore }) => {
				if (cancelled) return;
				setMembers(filtered);
				setNextPageToken(nextToken);
				setHasMore(rawHasMore);
			}).catch(() => {}).finally(() => {
				if (!cancelled) setLoadingMembers(false);
			});
			return () => {
				cancelled = true;
			};
		}, [expanded, teamId]);
		const currentLabel = t(roleKeys.find((r) => r.key === item.role)?.i18nKey ?? roleKeys[0].i18nKey);
		const loadMore = async () => {
			if (!hasMore || !nextPageToken || loadingMoreRef.current) return;
			loadingMoreRef.current = true;
			try {
				const { filtered, nextToken, rawHasMore } = await fetchPage(nextPageToken);
				if (!mountedRef.current) return;
				setMembers((prev) => [...prev, ...filtered]);
				setNextPageToken(nextToken);
				setHasMore(rawHasMore);
			} finally {
				loadingMoreRef.current = false;
			}
		};
		return /* @__PURE__ */ (0, import_jsx_runtime$32.jsxs)("div", {
			className: "lexiang-space-inherit-row",
			children: [/* @__PURE__ */ (0, import_jsx_runtime$32.jsxs)("div", {
				className: "lexiang-space-inherit-row__header",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime$32.jsx)(Button, {
						variant: "ghost",
						iconOnly: true,
						size: "small",
						className: "lexiang-space-inherit-row__expand",
						onClick: () => setExpanded((prev) => !prev),
						"aria-label": expanded ? "collapse" : "expand",
						leftIcon: /* @__PURE__ */ (0, import_jsx_runtime$32.jsx)(ChevronRightIcon, {
							size: 14,
							rotate: expanded ? 90 : 0
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime$32.jsx)("span", {
						className: "lexiang-space-inherit-row__title",
						onClick: () => setExpanded((prev) => !prev),
						children: item.inheritType === "manager" ? t("tencentLexiang.createSpace.teamManagers", { count: item.count }) : t("tencentLexiang.createSpace.teamMembers", { count: item.count })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime$32.jsx)("div", {
						className: "lexiang-space-inherit-row__role",
						children: /* @__PURE__ */ (0, import_jsx_runtime$32.jsx)(Dropdown, {
							trigger: /* @__PURE__ */ (0, import_jsx_runtime$32.jsxs)("button", {
								type: "button",
								className: "tencent-lexiang-role-selector",
								children: [currentLabel, /* @__PURE__ */ (0, import_jsx_runtime$32.jsx)("span", {
									className: "tencent-lexiang-role-selector__arrow",
									children: "▾"
								})]
							}),
							items: roleKeys.map((r) => ({
								key: r.key,
								label: t(r.i18nKey),
								selected: r.key === item.role,
								danger: r.danger,
								divider: r.divider
							})),
							onSelect: (key) => onRoleChange(key),
							placement: "bottom-end",
							disabled: inheritNoPermission
						})
					})
				]
			}), expanded && /* @__PURE__ */ (0, import_jsx_runtime$32.jsxs)("div", {
				className: "lexiang-space-inherit-row__members",
				children: [
					loadingMembers && /* @__PURE__ */ (0, import_jsx_runtime$32.jsx)("div", {
						className: "lexiang-space-inherit-row__loading",
						children: /* @__PURE__ */ (0, import_jsx_runtime$32.jsx)(Loading, { size: "small" })
					}),
					members.map((m) => /* @__PURE__ */ (0, import_jsx_runtime$32.jsxs)("div", {
						className: "lexiang-space-inherit-row__member",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime$32.jsx)(MemberAvatar, {
								subjectType: m.subject_type,
								subjectId: m.subject_id,
								avatar: m.staff?.avatar,
								displayName: m.staff?.display_name || m.department?.name,
								size: 20
							}),
							/* @__PURE__ */ (0, import_jsx_runtime$32.jsx)("span", {
								className: "lexiang-space-inherit-row__member-name",
								children: m.staff?.display_name || m.department?.name || m.subject_id
							}),
							/* @__PURE__ */ (0, import_jsx_runtime$32.jsx)("span", {
								className: "lexiang-space-inherit-row__member-role",
								children: t(roleKeys.find((r) => r.key === m.role)?.i18nKey ?? "tencentLexiang.memberRole.viewer")
							})
						]
					}, m.subject_id)),
					hasMore && /* @__PURE__ */ (0, import_jsx_runtime$32.jsx)(Button, {
						variant: "link",
						size: "small",
						className: "lexiang-space-inherit-row__load-more",
						onClick: loadMore,
						children: t("tencentLexiang.createSpace.loadMore")
					})
				]
			})]
		});
	};
	SpaceInheritList = ({ teamId, onChange, inheritNoPermission }) => {
		const [items, setItems] = (0, import_react$37.useState)([{
			inheritType: "manager",
			count: 0,
			role: "manager"
		}, {
			inheritType: "member",
			count: 0,
			role: "inheritor"
		}]);
		(0, import_react$37.useEffect)(() => {
			if (!inheritNoPermission) return;
			setItems((prev) => prev.map((item) => item.role === "none" ? item : {
				...item,
				role: "none"
			}));
		}, [inheritNoPermission]);
		(0, import_react$37.useEffect)(() => {
			if (!teamId) return;
			let cancelled = false;
			fetchPrivilegeCount(teamId, "team").then(({ count }) => {
				if (cancelled) return;
				const managerCount = count.manager ?? 0;
				const memberCount = Object.entries(count).filter(([k]) => k !== "manager").reduce((sum, [, v]) => sum + (v ?? 0), 0);
				setItems((prev) => [{
					...prev[0],
					count: managerCount
				}, {
					...prev[1],
					count: memberCount
				}]);
			}).catch(() => {});
			return () => {
				cancelled = true;
			};
		}, [teamId]);
		(0, import_react$37.useEffect)(() => {
			onChange(items);
		}, [items, onChange]);
		const handleRoleChange = (0, import_react$37.useCallback)((inheritType, role) => {
			setItems((prev) => prev.map((item) => item.inheritType === inheritType ? {
				...item,
				role
			} : item));
		}, []);
		return /* @__PURE__ */ (0, import_jsx_runtime$32.jsx)("div", {
			className: "lexiang-space-inherit-list",
			children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime$32.jsx)(InheritRow, {
				item,
				teamId,
				roleKeys: item.inheritType === "manager" ? MANAGER_ROLE_KEYS : MEMBER_ROLE_KEYS,
				onRoleChange: (role) => handleRoleChange(item.inheritType, role),
				inheritNoPermission
			}, item.inheritType))
		});
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/create-space-dialog/space-team-selector.tsx
var import_react$36, import_jsx_runtime$31, DEBOUNCE_MS, LIMIT, SpaceTeamSelector;
var init_space_team_selector = __esmMin((() => {
	init_src();
	import_react$36 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_team_service();
	init_use_team_privilege_config();
	init_team_default_icon();
	init_ui_icons();
	import_jsx_runtime$31 = require_jsx_runtime();
	DEBOUNCE_MS = 300;
	LIMIT = 20;
	SpaceTeamSelector = ({ defaultTeam, onChange, onCreateTeam }) => {
		const t = useTranslation();
		const { canCreateTeam } = useTeamPrivilegeConfig();
		const [keyword, setKeyword] = (0, import_react$36.useState)("");
		const [teams, setTeams] = (0, import_react$36.useState)([]);
		const [loading, setLoading] = (0, import_react$36.useState)(false);
		const [loadingMore, setLoadingMore] = (0, import_react$36.useState)(false);
		const [hasMore, setHasMore] = (0, import_react$36.useState)(false);
		const [nextPageToken, setNextPageToken] = (0, import_react$36.useState)();
		const [selectedTeam, setSelectedTeam] = (0, import_react$36.useState)(defaultTeam);
		const [open, setOpen] = (0, import_react$36.useState)(false);
		const debounceRef = (0, import_react$36.useRef)(null);
		const inputRef = (0, import_react$36.useRef)(null);
		const listRef = (0, import_react$36.useRef)(null);
		const keywordRef = (0, import_react$36.useRef)("");
		(0, import_react$36.useEffect)(() => {
			if (!open) return;
			if (keyword === "" && teams.length > 0) return;
			setLoading(true);
			setTeams([]);
			searchTeamsByKeyword("", LIMIT).then((res) => {
				setTeams(res.teams);
				setHasMore(res.hasMore);
				setNextPageToken(res.nextPageToken);
			}).catch(() => {
				setTeams([]);
				setHasMore(false);
			}).finally(() => setLoading(false));
		}, [open]);
		const handleSearch = (0, import_react$36.useCallback)((val) => {
			setKeyword(val);
			keywordRef.current = val;
			if (debounceRef.current) clearTimeout(debounceRef.current);
			debounceRef.current = setTimeout(async () => {
				setLoading(true);
				setTeams([]);
				setHasMore(false);
				setNextPageToken(void 0);
				try {
					const res = await searchTeamsByKeyword(val, LIMIT);
					setTeams(res.teams);
					setHasMore(res.hasMore);
					setNextPageToken(res.nextPageToken);
				} catch {
					setTeams([]);
				} finally {
					setLoading(false);
				}
			}, DEBOUNCE_MS);
		}, []);
		const handleLoadMore = (0, import_react$36.useCallback)(async () => {
			if (!hasMore || loadingMore || loading) return;
			setLoadingMore(true);
			try {
				const res = await searchTeamsByKeyword(keywordRef.current, LIMIT, nextPageToken);
				setTeams((prev) => [...prev, ...res.teams]);
				setHasMore(res.hasMore);
				setNextPageToken(res.nextPageToken);
			} catch {
				setHasMore(false);
			} finally {
				setLoadingMore(false);
			}
		}, [
			hasMore,
			loadingMore,
			loading,
			nextPageToken
		]);
		const handleScroll = (0, import_react$36.useCallback)(() => {
			const el = listRef.current;
			if (!el) return;
			if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) handleLoadMore();
		}, [handleLoadMore]);
		const handleSelect = (0, import_react$36.useCallback)((team) => {
			setSelectedTeam({
				id: team.id,
				name: team.name
			});
			onChange({
				id: team.id,
				name: team.name
			});
			setOpen(false);
		}, [onChange]);
		const displayName = selectedTeam?.name ?? t("tencentLexiang.createSpace.selectTeamPlaceholder");
		return /* @__PURE__ */ (0, import_jsx_runtime$31.jsx)("div", {
			className: "lexiang-space-team-selector",
			children: /* @__PURE__ */ (0, import_jsx_runtime$31.jsx)(Popover, {
				trigger: /* @__PURE__ */ (0, import_jsx_runtime$31.jsxs)("button", {
					type: "button",
					className: "lexiang-space-team-selector__trigger",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime$31.jsx)("span", {
							className: "lexiang-space-team-selector__label",
							children: t("tencentLexiang.createSpace.teamLabel")
						}),
						/* @__PURE__ */ (0, import_jsx_runtime$31.jsx)("span", {
							className: "lexiang-space-team-selector__value",
							children: displayName
						}),
						/* @__PURE__ */ (0, import_jsx_runtime$31.jsx)("span", {
							className: "lexiang-space-team-selector__arrow",
							children: "▾"
						})
					]
				}),
				placement: "bottom-start",
				open,
				onOpenChange: (next) => {
					setOpen(next);
					if (next) setTimeout(() => inputRef.current?.focus(), 50);
				},
				offsetDistance: 4,
				portalRoot: "body",
				stopClickPropagation: true,
				className: "lexiang-space-team-selector__popover tencent-lexiang-scrollbar",
				children: /* @__PURE__ */ (0, import_jsx_runtime$31.jsxs)("div", {
					className: "lexiang-space-team-selector__dropdown",
					children: [/* @__PURE__ */ (0, import_jsx_runtime$31.jsxs)("div", {
						className: "lexiang-space-team-selector__search",
						children: [/* @__PURE__ */ (0, import_jsx_runtime$31.jsxs)("div", {
							className: "lexiang-space-team-selector__search-input-wrap",
							children: [/* @__PURE__ */ (0, import_jsx_runtime$31.jsx)("span", {
								className: "lexiang-space-team-selector__search-icon",
								children: /* @__PURE__ */ (0, import_jsx_runtime$31.jsx)(SearchIcon, { size: 14 })
							}), /* @__PURE__ */ (0, import_jsx_runtime$31.jsx)("input", {
								ref: inputRef,
								type: "text",
								className: "lexiang-space-team-selector__search-input",
								value: keyword,
								onChange: (e) => handleSearch(e.target.value),
								placeholder: t("tencentLexiang.createSpace.searchTeamPlaceholder")
							})]
						}), onCreateTeam && canCreateTeam && /* @__PURE__ */ (0, import_jsx_runtime$31.jsx)(Button, {
							variant: "ghost",
							iconOnly: true,
							size: "small",
							className: "lexiang-space-team-selector__create-btn",
							onClick: () => {
								setOpen(false);
								onCreateTeam();
							},
							title: t("tencentLexiang.createTeam.title"),
							leftIcon: /* @__PURE__ */ (0, import_jsx_runtime$31.jsx)(PlusIcon, { size: 16 })
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime$31.jsxs)("div", {
						ref: listRef,
						className: "lexiang-space-team-selector__list",
						onScroll: handleScroll,
						children: [
							loading && /* @__PURE__ */ (0, import_jsx_runtime$31.jsx)("div", {
								className: "lexiang-space-team-selector__loading",
								children: /* @__PURE__ */ (0, import_jsx_runtime$31.jsx)(Loading, { size: "small" })
							}),
							!loading && teams.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime$31.jsx)("div", {
								className: "lexiang-space-team-selector__empty",
								children: t("tencentLexiang.createTeam.searchEmpty")
							}),
							teams.map((team) => /* @__PURE__ */ (0, import_jsx_runtime$31.jsxs)("div", {
								className: `lexiang-space-team-selector__item${selectedTeam?.id === team.id ? " lexiang-space-team-selector__item--selected" : ""}`,
								onClick: () => handleSelect(team),
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime$31.jsx)("span", {
										className: "lexiang-space-team-selector__item-icon",
										children: /* @__PURE__ */ (0, import_jsx_runtime$31.jsx)(TeamDefaultIcon, { size: 16 })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime$31.jsx)("span", {
										className: "lexiang-space-team-selector__item-name",
										children: team.name
									}),
									selectedTeam?.id === team.id && /* @__PURE__ */ (0, import_jsx_runtime$31.jsx)(CheckIcon, {
										size: 14,
										className: "lexiang-space-team-selector__item-check"
									})
								]
							}, team.id)),
							loadingMore && /* @__PURE__ */ (0, import_jsx_runtime$31.jsx)("div", {
								className: "lexiang-space-team-selector__loading",
								children: /* @__PURE__ */ (0, import_jsx_runtime$31.jsx)(Loading, { size: "small" })
							})
						]
					})]
				})
			})
		});
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/create-space-dialog/index.tsx
var import_react$35, import_jsx_runtime$30, CreateSpaceDialog;
var init_create_space_dialog = __esmMin((() => {
	init_create_space_dialog$1();
	init_src();
	import_react$35 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_space_service();
	init_spapi_client();
	init_constants();
	init_use_team_privilege_config();
	init_store();
	init_create_team_dialog();
	init_kb_default_icon();
	init_ui_icons();
	init_member_selector();
	init_advanced_settings();
	init_space_inherit_list();
	init_space_team_selector();
	import_jsx_runtime$30 = require_jsx_runtime();
	CreateSpaceDialog = ({ open, onOpenChange, defaultTeam, onSuccess }) => {
		const t = useTranslation();
		const [name, setName] = (0, import_react$35.useState)("");
		const [description, setDescription] = (0, import_react$35.useState)("");
		const [selectedTeam, setSelectedTeam] = (0, import_react$35.useState)(defaultTeam);
		const [members, setMembers] = (0, import_react$35.useState)([]);
		const [inheritItems, setInheritItems] = (0, import_react$35.useState)([]);
		const [enablePublishMode, setEnablePublishMode] = (0, import_react$35.useState)(false);
		const [nameError, setNameError] = (0, import_react$35.useState)("");
		const [loading, setLoading] = (0, import_react$35.useState)(false);
		const [createTeamOpen, setCreateTeamOpen] = (0, import_react$35.useState)(false);
		const { config: privilegeConfig, loading: configLoading, error: configError, isConfigReady, refetch: refetchConfig } = useTeamPrivilegeConfig();
		const nameInputRef = (0, import_react$35.useRef)(null);
		const defaultVisibleType = privilegeConfig?.space_visibility === "invisible" ? 0 : 2;
		const inheritNoPermission = privilegeConfig?.space_permission === "creator_only";
		(0, import_react$35.useEffect)(() => {
			if (open) {
				setName("");
				setDescription("");
				setSelectedTeam(defaultTeam);
				setMembers([]);
				setInheritItems([]);
				setEnablePublishMode(false);
				setNameError("");
				setLoading(false);
				setTimeout(() => nameInputRef.current?.focus(), 100);
			}
		}, [open, defaultTeam]);
		const validateName = (0, import_react$35.useCallback)((val) => {
			if (!val.trim()) return t("tencentLexiang.createSpace.nameRequired");
			if (val.length > 100) return t("tencentLexiang.createSpace.nameMaxLength");
			return "";
		}, [t]);
		const handleNameChange = (0, import_react$35.useCallback)((val) => {
			setName(val);
			setNameError(validateName(val));
		}, [validateName]);
		const handleOk = (0, import_react$35.useCallback)(async () => {
			const errMsg = validateName(name);
			if (errMsg) {
				setNameError(errMsg);
				return;
			}
			if (!selectedTeam?.id) {
				message.error(t("tencentLexiang.createSpace.teamRequired"));
				return;
			}
			setLoading(true);
			try {
				const privilege = { items: members.map((m) => ({
					subject_type: m.subjectType,
					subject_id: m.id,
					role: m.role
				})) };
				const PRIVILEGE_MAP = {
					none: 0,
					inheritor: 1,
					viewer: 2,
					downloader: 3,
					editor: 4,
					manager: 5
				};
				for (const item of inheritItems) {
					const val = PRIVILEGE_MAP[item.role];
					if (item.inheritType === "manager") privilege.manager_inherit_type = val ?? PRIVILEGE_MAP["manager"];
					else privilege.member_inherit_type = val ?? PRIVILEGE_MAP["inheritor"];
				}
				const result = await createSpace({
					name: name.trim(),
					description: description.trim() || void 0,
					team_id: selectedTeam.id,
					enable_publish_mode: enablePublishMode,
					visible_type: defaultVisibleType,
					privilege
				});
				message.success(t("tencentLexiang.createSpace.success"));
				onOpenChange(false);
				onSuccess?.({
					id: result.id,
					name: result.name
				});
				const storeApi = tencentLexiangStore.getState();
				storeApi.bumpTeamSpaceVersion(selectedTeam.id);
				storeApi.setCurrentTeam({
					id: selectedTeam.id,
					name: selectedTeam.name
				});
				storeApi.goToSpaceDetail({
					id: result.id,
					name: result.name,
					home_url: buildKbHomeUrl(result.id),
					teamId: selectedTeam.id,
					rootEntryId: result.root_entry_id
				});
			} catch (err) {
				const msg = isLexiangSpApiError(err) ? err.message : t("tencentLexiang.createSpace.failed");
				message.error(msg);
			} finally {
				setLoading(false);
			}
		}, [
			name,
			description,
			selectedTeam,
			members,
			inheritItems,
			enablePublishMode,
			defaultVisibleType,
			validateName,
			onOpenChange,
			onSuccess,
			t
		]);
		const isOkDisabled = !name.trim() || !!nameError || !selectedTeam?.id || !isConfigReady;
		return /* @__PURE__ */ (0, import_jsx_runtime$30.jsxs)(import_jsx_runtime$30.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime$30.jsx)(Modal, {
			open,
			onOpenChange,
			title: t("tencentLexiang.createSpace.title"),
			size: "small",
			okText: t("tencentLexiang.createSpace.confirm"),
			cancelText: t("tencentLexiang.createSpace.cancel"),
			onOk: handleOk,
			onCancel: () => onOpenChange(false),
			confirmLoading: loading,
			okButtonProps: { disabled: isOkDisabled },
			className: "tencent-lexiang-create-space-modal",
			closeOnOverlayClick: false,
			closeOnEscape: false,
			children: /* @__PURE__ */ (0, import_jsx_runtime$30.jsx)("div", {
				className: "tencent-lexiang-create-space",
				children: configError ? /* @__PURE__ */ (0, import_jsx_runtime$30.jsxs)("div", {
					className: "tencent-lexiang-create-space__config-error",
					children: [/* @__PURE__ */ (0, import_jsx_runtime$30.jsx)("span", { children: t("tencentLexiang.privilegeConfig.loadFailed") }), /* @__PURE__ */ (0, import_jsx_runtime$30.jsx)(Button, {
						variant: "link",
						size: "small",
						onClick: refetchConfig,
						children: t("tencentLexiang.privilegeConfig.retry")
					})]
				}) : /* @__PURE__ */ (0, import_jsx_runtime$30.jsxs)(Loading, {
					spinning: configLoading,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime$30.jsxs)("div", {
							className: "tencent-lexiang-create-space__header",
							children: [/* @__PURE__ */ (0, import_jsx_runtime$30.jsx)("div", {
								className: "tencent-lexiang-create-space__icon",
								children: /* @__PURE__ */ (0, import_jsx_runtime$30.jsx)(KbDefaultIcon, { size: 60 })
							}), /* @__PURE__ */ (0, import_jsx_runtime$30.jsxs)("div", {
								className: "tencent-lexiang-create-space__info",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime$30.jsx)("input", {
										ref: nameInputRef,
										type: "text",
										className: `tencent-lexiang-create-space__name-input${nameError ? " tencent-lexiang-create-space__name-input--error" : ""}`,
										value: name,
										onChange: (e) => handleNameChange(e.target.value),
										placeholder: t("tencentLexiang.createSpace.namePlaceholder")
									}),
									nameError && /* @__PURE__ */ (0, import_jsx_runtime$30.jsx)("span", {
										className: "tencent-lexiang-create-space__error",
										children: nameError
									}),
									/* @__PURE__ */ (0, import_jsx_runtime$30.jsx)("textarea", {
										className: "tencent-lexiang-create-space__desc-input",
										value: description,
										onChange: (e) => setDescription(e.target.value),
										placeholder: t("tencentLexiang.createSpace.descPlaceholder"),
										maxLength: 200,
										rows: 3
									}),
									/* @__PURE__ */ (0, import_jsx_runtime$30.jsx)(SpaceTeamSelector, {
										defaultTeam,
										onChange: setSelectedTeam,
										onCreateTeam: () => {
											onOpenChange(false);
											setCreateTeamOpen(true);
										}
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime$30.jsxs)("div", {
							className: "tencent-lexiang-create-space__section",
							children: [/* @__PURE__ */ (0, import_jsx_runtime$30.jsxs)("div", {
								className: "tencent-lexiang-create-space__section-header",
								children: [/* @__PURE__ */ (0, import_jsx_runtime$30.jsx)("span", {
									className: "tencent-lexiang-create-space__section-title",
									children: t("tencentLexiang.createSpace.memberTitle")
								}), /* @__PURE__ */ (0, import_jsx_runtime$30.jsxs)("a", {
									className: "tencent-lexiang-create-space__section-link",
									href: "https://lexiangla.com/pages/278347f8e4ca43bfabbe523780543802?company_from=906ba45e6f9a11f089c57a2a2b4bccb6",
									target: "_blank",
									rel: "noopener noreferrer",
									children: [t("tencentLexiang.createSpace.memberExplain"), /* @__PURE__ */ (0, import_jsx_runtime$30.jsx)(ExternalArrowIcon, { size: 12 })]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime$30.jsx)("div", {
								className: "tencent-lexiang-create-space__privilege",
								children: /* @__PURE__ */ (0, import_jsx_runtime$30.jsx)(MemberPanel, {
									value: members,
									onChange: setMembers,
									injectRootDept: false,
									middleSlot: selectedTeam?.id ? /* @__PURE__ */ (0, import_jsx_runtime$30.jsx)(SpaceInheritList, {
										teamId: selectedTeam.id,
										onChange: setInheritItems,
										inheritNoPermission
									}) : void 0
								})
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime$30.jsx)(AdvancedSettings, {
							value: enablePublishMode,
							onChange: setEnablePublishMode
						})
					]
				})
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime$30.jsx)(CreateTeamDialog, {
			open: createTeamOpen,
			onOpenChange: setCreateTeamOpen,
			onSuccess: (team) => {
				setSelectedTeam({
					id: team.id,
					name: team.name
				});
				tencentLexiangStore.getState().setPendingNewTeam(team);
			}
		})] });
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/lexiang-layout/team-selector-popover.tsx
var import_react$34, import_jsx_runtime$29, TeamSelectorPopover;
var init_team_selector_popover = __esmMin((() => {
	init_src();
	import_react$34 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_api();
	init_team_default_icon();
	import_jsx_runtime$29 = require_jsx_runtime();
	TeamSelectorPopover = ({ excludeTeamIds, onSelect }) => {
		const t = useTranslation();
		const excludeKey = JSON.stringify(excludeTeamIds);
		const [keyword, setKeyword] = (0, import_react$34.useState)("");
		const [debouncedKeyword, setDebouncedKeyword] = (0, import_react$34.useState)("");
		const [results, setResults] = (0, import_react$34.useState)([]);
		const [loading, setLoading] = (0, import_react$34.useState)(true);
		const [loadingMore, setLoadingMore] = (0, import_react$34.useState)(false);
		const [nextPageToken, setNextPageToken] = (0, import_react$34.useState)(void 0);
		const loadMoreRef = (0, import_react$34.useRef)(null);
		const searchInputRef = (0, import_react$34.useRef)(null);
		(0, import_react$34.useEffect)(() => {
			const timer = setTimeout(() => setDebouncedKeyword(keyword), 300);
			return () => clearTimeout(timer);
		}, [keyword]);
		const isSearching = debouncedKeyword.trim().length > 0;
		(0, import_react$34.useEffect)(() => {
			requestAnimationFrame(() => searchInputRef.current?.focus());
		}, []);
		(0, import_react$34.useEffect)(() => {
			let cancelled = false;
			setLoading(true);
			setNextPageToken(void 0);
			(isSearching ? searchTeams(debouncedKeyword.trim(), 20) : fetchFrequentTeams(20)).then((data) => {
				if (cancelled) return;
				const teams = data.teams ?? [];
				setResults(isSearching ? teams : teams.filter((team) => !excludeTeamIds.includes(team.id)));
				setNextPageToken(teams.length >= 20 ? data.next_page_token || void 0 : void 0);
			}).catch(() => {
				if (!cancelled) setResults([]);
			}).finally(() => {
				if (!cancelled) setLoading(false);
			});
			return () => {
				cancelled = true;
			};
		}, [debouncedKeyword, excludeKey]);
		const loadNextPage = (0, import_react$34.useCallback)(async () => {
			if (!nextPageToken || loadingMore) return;
			setLoadingMore(true);
			try {
				const data = isSearching ? await searchTeams(debouncedKeyword.trim(), 20, nextPageToken) : await fetchFrequentTeams(20, void 0, nextPageToken);
				const teams = data.teams ?? [];
				const filtered = isSearching ? teams : teams.filter((team) => !excludeTeamIds.includes(team.id));
				setResults((prev) => [...prev, ...filtered]);
				setNextPageToken(teams.length >= 20 ? data.next_page_token || void 0 : void 0);
			} catch {
				setNextPageToken(void 0);
			} finally {
				setLoadingMore(false);
			}
		}, [
			nextPageToken,
			loadingMore,
			debouncedKeyword,
			excludeKey
		]);
		(0, import_react$34.useEffect)(() => {
			const el = loadMoreRef.current;
			if (!el || !nextPageToken) return;
			const observer = new IntersectionObserver(([entry]) => {
				if (entry.isIntersecting) loadNextPage();
			}, { rootMargin: "40px" });
			observer.observe(el);
			return () => {
				observer.disconnect();
			};
		}, [nextPageToken, loadNextPage]);
		return /* @__PURE__ */ (0, import_jsx_runtime$29.jsxs)("div", {
			className: "tencent-lexiang-sidebar__popover",
			children: [/* @__PURE__ */ (0, import_jsx_runtime$29.jsx)("input", {
				ref: searchInputRef,
				className: "tencent-lexiang-sidebar__popover-search",
				type: "text",
				placeholder: t("tencentLexiang.sidebar.searchTeam"),
				value: keyword,
				onChange: (e) => setKeyword(e.target.value)
			}), /* @__PURE__ */ (0, import_jsx_runtime$29.jsx)("div", {
				className: "tencent-lexiang-sidebar__popover-list",
				children: loading || keyword !== debouncedKeyword ? /* @__PURE__ */ (0, import_jsx_runtime$29.jsx)("div", {
					className: "tencent-lexiang-sidebar__loading",
					children: /* @__PURE__ */ (0, import_jsx_runtime$29.jsx)(Loading, { size: "small" })
				}) : results.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime$29.jsx)("div", {
					className: "tencent-lexiang-sidebar__loading",
					children: keyword ? t("tencentLexiang.sidebar.noSearchResults") : t("tencentLexiang.sidebar.noTeams")
				}) : /* @__PURE__ */ (0, import_jsx_runtime$29.jsxs)(import_jsx_runtime$29.Fragment, { children: [
					isSearching && /* @__PURE__ */ (0, import_jsx_runtime$29.jsx)("div", {
						className: "tencent-lexiang-sidebar__popover-section-title",
						children: t("tencentLexiang.sidebar.searchResults")
					}),
					results.map((team) => /* @__PURE__ */ (0, import_jsx_runtime$29.jsxs)("div", {
						className: "tencent-lexiang-sidebar__popover-item",
						onClick: () => onSelect(team),
						children: [/* @__PURE__ */ (0, import_jsx_runtime$29.jsx)("span", {
							className: "tencent-lexiang-sidebar__item-icon",
							children: /* @__PURE__ */ (0, import_jsx_runtime$29.jsx)(TeamDefaultIcon, { size: 16 })
						}), /* @__PURE__ */ (0, import_jsx_runtime$29.jsx)("span", {
							className: "tencent-lexiang-sidebar__item-name",
							children: team.name
						})]
					}, team.id)),
					loadingMore && /* @__PURE__ */ (0, import_jsx_runtime$29.jsx)("div", {
						className: "tencent-lexiang-sidebar__loading",
						children: /* @__PURE__ */ (0, import_jsx_runtime$29.jsx)(Loading, { size: "small" })
					}),
					nextPageToken && !loadingMore && /* @__PURE__ */ (0, import_jsx_runtime$29.jsx)("div", {
						ref: loadMoreRef,
						style: { height: 4 }
					})
				] })
			})]
		});
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/lexiang-layout/team-space-list.tsx
var import_react$33, import_jsx_runtime$28, TeamSpaceList;
var init_team_space_list = __esmMin((() => {
	init_src();
	import_react$33 = /* @__PURE__ */ __toESM(require_react());
	init_api();
	init_constants();
	init_store();
	init_ui_icons();
	import_jsx_runtime$28 = require_jsx_runtime();
	TeamSpaceList = ({ teamId, visible }) => {
		const currentKbId = useTencentLexiangStore((s) => s.currentKnowledgeBase?.id);
		const pageView = useTencentLexiangStore((s) => s.pageView);
		const refreshKey = useTencentLexiangStore((s) => s.teamSpaceVersions[teamId] ?? 0);
		const [spaces, setSpaces] = (0, import_react$33.useState)([]);
		const [pinnedSpaces, setPinnedSpaces] = (0, import_react$33.useState)([]);
		const [loading, setLoading] = (0, import_react$33.useState)(true);
		(0, import_react$33.useEffect)(() => {
			let cancelled = false;
			setLoading(true);
			async function loadAllSpaces() {
				const [pinnedData, firstPage] = await Promise.all([fetchPinnedTeamSpaces(teamId, 20, "view").catch(() => ({ spaces: [] })), fetchTeamSpaces(teamId, 20, void 0, { permission: "view" })]);
				if (cancelled) return {
					pinned: pinnedData.spaces ?? [],
					normal: []
				};
				const allNormal = [...firstPage.spaces ?? []];
				let pageToken = firstPage.spaces?.length === 20 ? firstPage.next_page_token : void 0;
				while (pageToken) {
					const nextData = await fetchTeamSpaces(teamId, 20, pageToken, { permission: "view" });
					if (cancelled) break;
					const newSpaces = nextData.spaces ?? [];
					allNormal.push(...newSpaces);
					pageToken = newSpaces.length >= 20 ? nextData.next_page_token || void 0 : void 0;
				}
				return {
					pinned: pinnedData.spaces ?? [],
					normal: allNormal
				};
			}
			loadAllSpaces().then(({ pinned, normal }) => {
				if (cancelled) return;
				setPinnedSpaces(pinned);
				setSpaces(normal);
			}).catch(() => {}).finally(() => {
				if (!cancelled) setLoading(false);
			});
			return () => {
				cancelled = true;
			};
		}, [teamId, refreshKey]);
		const mergedSpaces = import_react$33.useMemo(() => {
			const pinnedIds = new Set(pinnedSpaces.map((s) => s.id));
			const normalFiltered = spaces.filter((s) => !pinnedIds.has(s.id));
			return [...pinnedSpaces, ...normalFiltered];
		}, [pinnedSpaces, spaces]);
		const handleSpaceClick = (space) => {
			const storeApi = tencentLexiangStore.getState();
			storeApi.closePreview();
			storeApi.goToSpaceDetail({
				id: space.id,
				name: space.name,
				avatar: space.logo || void 0,
				home_url: buildKbHomeUrl(space.id),
				rootEntryId: space.root_entry_id,
				teamId: space.team_id ?? teamId
			});
		};
		return /* @__PURE__ */ (0, import_jsx_runtime$28.jsx)("div", {
			className: "tencent-lexiang-sidebar__space-list",
			style: { display: visible ? void 0 : "none" },
			children: loading ? /* @__PURE__ */ (0, import_jsx_runtime$28.jsx)("div", {
				className: "tencent-lexiang-sidebar__loading",
				children: /* @__PURE__ */ (0, import_jsx_runtime$28.jsx)(Loading, { size: "small" })
			}) : /* @__PURE__ */ (0, import_jsx_runtime$28.jsx)(import_jsx_runtime$28.Fragment, { children: mergedSpaces.map((space) => /* @__PURE__ */ (0, import_jsx_runtime$28.jsxs)("div", {
				className: ["tencent-lexiang-sidebar__space-item", pageView === "space-detail" && space.id === currentKbId ? "is-active" : ""].filter(Boolean).join(" "),
				onClick: () => handleSpaceClick(space),
				children: [/* @__PURE__ */ (0, import_jsx_runtime$28.jsx)("span", {
					className: "tencent-lexiang-sidebar__item-icon",
					children: /* @__PURE__ */ (0, import_jsx_runtime$28.jsx)(KnowledgeBaseIcon, { size: 16 })
				}), /* @__PURE__ */ (0, import_jsx_runtime$28.jsx)("span", {
					className: "tencent-lexiang-sidebar__item-name",
					title: space.name,
					children: space.name
				})]
			}, space.id)) })
		});
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/lexiang-layout/sidebar-team-list.tsx
/** 从 lastView 缓存中恢复团队对象（store.currentTeam 为 null 时的 fallback） */
function resolveTeamFromCache(teamId) {
	const lastView = readLastViewFromCache();
	if (!lastView) return null;
	if (lastView.pageView === "space-list" && lastView.team?.id === teamId) return lastView.team;
	if (lastView.pageView === "space-detail" && lastView.team?.id === teamId) return lastView.team;
	return null;
}
var import_react$32, import_jsx_runtime$27, DISPLAY_COUNT, TEAM_PAGE_SIZE, SidebarTeamList;
var init_sidebar_team_list = __esmMin((() => {
	init_src();
	import_react$32 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_api();
	init_privilege_service();
	init_use_team_privilege_config();
	init_store();
	init_create_space_dialog();
	init_create_team_dialog();
	init_team_default_icon();
	init_ui_icons();
	init_team_selector_popover();
	init_team_space_list();
	import_jsx_runtime$27 = require_jsx_runtime();
	DISPLAY_COUNT = 9;
	TEAM_PAGE_SIZE = 20;
	SidebarTeamList = () => {
		const t = useTranslation();
		const pageView = useTencentLexiangStore((s) => s.pageView);
		const currentTeamId = useTencentLexiangStore((s) => s.currentTeam?.id);
		const currentKbTeamId = useTencentLexiangStore((s) => s.currentKnowledgeBase?.teamId);
		const { canCreateTeam } = useTeamPrivilegeConfig();
		const [allTeams, setAllTeams] = (0, import_react$32.useState)([]);
		const [loading, setLoading] = (0, import_react$32.useState)(true);
		const [expandedTeams, setExpandedTeams] = (0, import_react$32.useState)(/* @__PURE__ */ new Set());
		const [loadedTeams, setLoadedTeams] = (0, import_react$32.useState)(/* @__PURE__ */ new Set());
		const [moreTeamsOpen, setMoreTeamsOpen] = (0, import_react$32.useState)(false);
		const [visitTeam, setVisitTeam] = (0, import_react$32.useState)(null);
		const [createTeamOpen, setCreateTeamOpen] = (0, import_react$32.useState)(false);
		const [createSpaceOpen, setCreateSpaceOpen] = (0, import_react$32.useState)(false);
		const [createSpaceTeam, setCreateSpaceTeam] = (0, import_react$32.useState)(null);
		const [canCreateSpaceForTeamId, setCanCreateSpaceForTeamId] = (0, import_react$32.useState)(null);
		const allTeamsRef = (0, import_react$32.useRef)([]);
		(0, import_react$32.useEffect)(() => {
			let cancelled = false;
			setLoading(true);
			fetchFrequentTeams(TEAM_PAGE_SIZE).then((data) => {
				if (cancelled) return;
				const seen = /* @__PURE__ */ new Set();
				const unique = (data.teams ?? []).filter((team) => {
					if (seen.has(team.id)) return false;
					seen.add(team.id);
					return true;
				});
				allTeamsRef.current = unique;
				setAllTeams(unique);
			}).catch(() => {}).finally(() => {
				if (!cancelled) setLoading(false);
			});
			return () => {
				cancelled = true;
			};
		}, []);
		const activeTeamId = pageView === "space-list" ? currentTeamId ?? null : currentKbTeamId ?? currentTeamId ?? null;
		(0, import_react$32.useEffect)(() => {
			setCanCreateSpaceForTeamId(null);
			if (!activeTeamId) return;
			let cancelled = false;
			fetchStaffPermissions(activeTeamId, "team").then((perms) => {
				if (cancelled) return;
				setCanCreateSpaceForTeamId(perms.includes("create_space") ? activeTeamId : null);
			}).catch(() => {});
			return () => {
				cancelled = true;
			};
		}, [activeTeamId]);
		(0, import_react$32.useEffect)(() => {
			if (loading) return;
			const unique = allTeamsRef.current;
			const state = tencentLexiangStore.getState();
			let targetTeamId;
			if (state.pageView === "space-list") targetTeamId = state.currentTeam?.id;
			else {
				if (state.currentKnowledgeBase && !state.currentKnowledgeBase.teamId) return;
				targetTeamId = state.currentKnowledgeBase?.teamId ?? state.currentTeam?.id;
			}
			if (!targetTeamId) return;
			setExpandedTeams((prev) => {
				if (prev.has(targetTeamId)) return prev;
				if (unique.slice(0, DISPLAY_COUNT).find((team) => team.id === targetTeamId)) {
					setLoadedTeams((p) => p.has(targetTeamId) ? p : new Set([...p, targetTeamId]));
					return new Set([...prev, targetTeamId]);
				}
				const storeTeam = tencentLexiangStore.getState().currentTeam;
				const fromAllTeams = unique.find((team) => team.id === targetTeamId);
				const resolvedTeam = storeTeam?.id === targetTeamId ? storeTeam : fromAllTeams ?? resolveTeamFromCache(targetTeamId);
				if (resolvedTeam) {
					setVisitTeam(resolvedTeam);
					setLoadedTeams((p) => p.has(targetTeamId) ? p : new Set([...p, targetTeamId]));
					return new Set([...prev, targetTeamId]);
				}
				return prev;
			});
		}, [
			loading,
			currentKbTeamId,
			currentTeamId,
			pageView
		]);
		const displayTeams = import_react$32.useMemo(() => {
			const top = allTeams.slice(0, DISPLAY_COUNT);
			const topIds = top.map((t) => t.id);
			if (visitTeam && !topIds.includes(visitTeam.id)) return [...top, visitTeam];
			return top;
		}, [allTeams, visitTeam]);
		const hasMore = allTeams.length > displayTeams.length;
		const toggleExpand = (0, import_react$32.useCallback)((teamId) => {
			setExpandedTeams((prev) => {
				const next = new Set(prev);
				if (next.has(teamId)) next.delete(teamId);
				else next.add(teamId);
				return next;
			});
			setLoadedTeams((prev) => {
				if (prev.has(teamId)) return prev;
				return new Set([...prev, teamId]);
			});
		}, []);
		const handleTeamClick = (0, import_react$32.useCallback)((team) => {
			const isExpanded = expandedTeams.has(team.id);
			const state = tencentLexiangStore.getState();
			const isActive = state.pageView === "space-list" && state.currentTeam?.id === team.id;
			state.closePreview();
			if (isExpanded && isActive) toggleExpand(team.id);
			else {
				if (!isExpanded) toggleExpand(team.id);
				state.goToSpaceList(team);
			}
		}, [expandedTeams, toggleExpand]);
		const handleSelectTeamFromPopover = (0, import_react$32.useCallback)((team) => {
			setMoreTeamsOpen(false);
			if (!allTeams.slice(0, DISPLAY_COUNT).map((t) => t.id).includes(team.id)) setVisitTeam(team);
			if (!expandedTeams.has(team.id)) toggleExpand(team.id);
			tencentLexiangStore.getState().closePreview();
			tencentLexiangStore.getState().goToSpaceList(team);
		}, [
			allTeams,
			expandedTeams,
			toggleExpand
		]);
		const handleCreateTeamSuccess = (0, import_react$32.useCallback)((team) => {
			setAllTeams((prev) => {
				const updated = [...prev.filter((t) => t.id !== team.id), team];
				allTeamsRef.current = updated;
				return updated;
			});
			setVisitTeam(team);
			toggleExpand(team.id);
			tencentLexiangStore.getState().goToSpaceList(team);
		}, [toggleExpand]);
		const pendingNewTeam = useTencentLexiangStore((s) => s.pendingNewTeam);
		(0, import_react$32.useEffect)(() => {
			if (!pendingNewTeam) return;
			tencentLexiangStore.getState().setPendingNewTeam(null);
			handleCreateTeamSuccess(pendingNewTeam);
		}, [pendingNewTeam, handleCreateTeamSuccess]);
		return /* @__PURE__ */ (0, import_jsx_runtime$27.jsxs)("div", {
			className: "tencent-lexiang-sidebar__group tencent-lexiang-sidebar__group--scroll",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime$27.jsxs)("div", {
					className: "tencent-lexiang-sidebar__group-header",
					children: [/* @__PURE__ */ (0, import_jsx_runtime$27.jsx)("span", {
						className: "tencent-lexiang-sidebar__group-title",
						children: t("tencentLexiang.sidebar.teamKb")
					}), canCreateTeam && /* @__PURE__ */ (0, import_jsx_runtime$27.jsx)(Tooltip, {
						content: t("tencentLexiang.sidebar.createTeam"),
						children: /* @__PURE__ */ (0, import_jsx_runtime$27.jsx)("span", {
							className: "tencent-lexiang-sidebar__group-add-btn",
							onClick: () => setCreateTeamOpen(true),
							children: /* @__PURE__ */ (0, import_jsx_runtime$27.jsx)(PlusIcon, { size: 16 })
						})
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$27.jsx)(CreateTeamDialog, {
					open: createTeamOpen,
					onOpenChange: setCreateTeamOpen,
					onSuccess: handleCreateTeamSuccess
				}),
				createSpaceTeam && /* @__PURE__ */ (0, import_jsx_runtime$27.jsx)(CreateSpaceDialog, {
					open: createSpaceOpen,
					onOpenChange: setCreateSpaceOpen,
					defaultTeam: {
						id: createSpaceTeam.id,
						name: createSpaceTeam.name
					},
					onSuccess: () => {
						tencentLexiangStore.getState().bumpTeamSpaceVersion(createSpaceTeam.id);
					}
				}),
				loading ? /* @__PURE__ */ (0, import_jsx_runtime$27.jsx)("div", {
					className: "tencent-lexiang-sidebar__loading",
					children: /* @__PURE__ */ (0, import_jsx_runtime$27.jsx)(Loading, { size: "small" })
				}) : /* @__PURE__ */ (0, import_jsx_runtime$27.jsxs)("ul", {
					className: "tencent-lexiang-sidebar__list",
					children: [displayTeams.map((team) => {
						const isExpanded = expandedTeams.has(team.id);
						const isLoaded = loadedTeams.has(team.id);
						return /* @__PURE__ */ (0, import_jsx_runtime$27.jsxs)("li", {
							className: "tencent-lexiang-sidebar__team-group",
							children: [/* @__PURE__ */ (0, import_jsx_runtime$27.jsxs)("div", {
								className: [
									"tencent-lexiang-sidebar__item",
									"tencent-lexiang-sidebar__item--team",
									pageView === "space-list" && team.id === currentTeamId ? "is-active" : ""
								].filter(Boolean).join(" "),
								onClick: () => handleTeamClick(team),
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime$27.jsx)("span", {
										className: "tencent-lexiang-sidebar__chevron",
										onClick: (e) => {
											e.stopPropagation();
											toggleExpand(team.id);
										},
										children: isExpanded ? /* @__PURE__ */ (0, import_jsx_runtime$27.jsx)(ChevronRightIcon, {
											size: 12,
											rotate: 90
										}) : /* @__PURE__ */ (0, import_jsx_runtime$27.jsx)(ChevronRightIcon, { size: 12 })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime$27.jsx)("span", {
										className: "tencent-lexiang-sidebar__item-icon",
										children: /* @__PURE__ */ (0, import_jsx_runtime$27.jsx)(TeamDefaultIcon, { size: 16 })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime$27.jsx)("span", {
										className: "tencent-lexiang-sidebar__item-name",
										title: team.name,
										children: team.name
									}),
									canCreateSpaceForTeamId === team.id && /* @__PURE__ */ (0, import_jsx_runtime$27.jsx)(Tooltip, {
										content: t("tencentLexiang.teamInfoCard.createSpace"),
										children: /* @__PURE__ */ (0, import_jsx_runtime$27.jsx)("span", {
											className: "tencent-lexiang-sidebar__group-add-btn",
											onClick: (e) => {
												e.stopPropagation();
												setCreateSpaceTeam(team);
												setCreateSpaceOpen(true);
											},
											children: /* @__PURE__ */ (0, import_jsx_runtime$27.jsx)(PlusIcon, { size: 16 })
										})
									})
								]
							}), isLoaded && /* @__PURE__ */ (0, import_jsx_runtime$27.jsx)(TeamSpaceList, {
								teamId: team.id,
								visible: isExpanded
							})]
						}, team.id);
					}), hasMore && /* @__PURE__ */ (0, import_jsx_runtime$27.jsx)("li", {
						className: "tencent-lexiang-sidebar__team-group",
						children: /* @__PURE__ */ (0, import_jsx_runtime$27.jsx)(Popover, {
							placement: "right-start",
							open: moreTeamsOpen,
							onOpenChange: setMoreTeamsOpen,
							portalRoot: "inline",
							trigger: /* @__PURE__ */ (0, import_jsx_runtime$27.jsxs)("div", {
								className: "tencent-lexiang-sidebar__item tencent-lexiang-sidebar__item--more",
								children: [/* @__PURE__ */ (0, import_jsx_runtime$27.jsx)("span", {
									className: "tencent-lexiang-sidebar__item-icon",
									children: /* @__PURE__ */ (0, import_jsx_runtime$27.jsx)(AllTeamsIcon, { size: 16 })
								}), /* @__PURE__ */ (0, import_jsx_runtime$27.jsx)("span", {
									className: "tencent-lexiang-sidebar__item-name",
									children: t("tencentLexiang.sidebar.moreTeams")
								})]
							}),
							children: /* @__PURE__ */ (0, import_jsx_runtime$27.jsx)(TeamSelectorPopover, {
								excludeTeamIds: displayTeams.map((t) => t.id),
								onSelect: handleSelectTeamFromPopover
							})
						})
					})]
				})
			]
		});
	};
})), import_jsx_runtime$26, LexiangSidebar;
var init_lexiang_sidebar = __esmMin((() => {
	require_react();
	init_sidebar_shortcut_access();
	init_sidebar_team_list();
	import_jsx_runtime$26 = require_jsx_runtime();
	LexiangSidebar = () => /* @__PURE__ */ (0, import_jsx_runtime$26.jsxs)("aside", {
		className: "tencent-lexiang-sidebar",
		children: [/* @__PURE__ */ (0, import_jsx_runtime$26.jsx)(SidebarShortcutAccess, {}), /* @__PURE__ */ (0, import_jsx_runtime$26.jsx)(SidebarTeamList, {})]
	});
})), import_jsx_runtime$25, LexiangLayout;
var init_lexiang_layout = __esmMin((() => {
	init_lexiang_layout$1();
	require_react();
	import_jsx_runtime$25 = require_jsx_runtime();
	init_lexiang_heading();
	init_lexiang_sidebar();
	LexiangLayout = ({ heading, sidebar, children }) => /* @__PURE__ */ (0, import_jsx_runtime$25.jsxs)("div", {
		className: "tencent-lexiang-layout",
		children: [heading ? heading : null, /* @__PURE__ */ (0, import_jsx_runtime$25.jsxs)("div", {
			className: "tencent-lexiang-layout__body",
			children: [sidebar ? /* @__PURE__ */ (0, import_jsx_runtime$25.jsx)("div", {
				className: "tencent-lexiang-layout__sidebar tencent-lexiang-scrollbar",
				children: sidebar
			}) : null, /* @__PURE__ */ (0, import_jsx_runtime$25.jsx)("div", {
				className: "tencent-lexiang-layout__main",
				children
			})]
		})]
	});
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/library-iframe-view/library-iframe-view.less
var init_library_iframe_view$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/library-iframe-view/lexiang-host-bridge.ts
function isRecord(value) {
	return typeof value === "object" && value !== null;
}
function isAllowedLexiangOrigin(origin, allowedOrigins) {
	return Boolean(origin && allowedOrigins?.includes(origin));
}
function normalizeLexiangIncomingMessage(data) {
	if (!isRecord(data) || typeof data.type !== "string") return null;
	if (data.source !== "lexiang") return null;
	if (data.type === "lexiang:ready") {
		const payload = isRecord(data.payload) ? data.payload : {};
		return {
			kind: "ready",
			sdkVersion: typeof payload.sdkVersion === "string" ? payload.sdkVersion : void 0,
			supportedProtocolVersions: Array.isArray(payload.supportedProtocolVersions) ? payload.supportedProtocolVersions.filter((version) => typeof version === "string") : void 0
		};
	}
	if (data.type === "lexiang:jsapi:request") {
		const payload = isRecord(data.payload) ? data.payload : null;
		if (!payload || typeof payload.requestId !== "string" || typeof payload.method !== "string") return null;
		return {
			kind: "jsapi",
			requestId: payload.requestId,
			method: payload.method,
			params: payload.params,
			shouldRespond: true
		};
	}
	return null;
}
function buildHostMeta() {
	return {
		protocolVersion: BRIDGE_PROTOCOL_VERSION,
		timestamp: Date.now()
	};
}
function createJsApiResponsePayload(requestId, success, data, error) {
	return {
		requestId,
		success,
		code: success ? 0 : -1,
		msg: success ? "ok" : error?.message ?? "Unknown error",
		...data !== void 0 ? { data } : {},
		...error ? { error } : {}
	};
}
function useLexiangHostBridge({ handlers, allowedOrigins, enabled = true, iframeRef }) {
	const handlersRef = (0, import_react$29.useRef)(handlers);
	handlersRef.current = handlers;
	const allowedOriginsRef = (0, import_react$29.useRef)(allowedOrigins);
	allowedOriginsRef.current = allowedOrigins;
	const iframeRefStable = (0, import_react$29.useRef)(iframeRef);
	iframeRefStable.current = iframeRef;
	const lastOriginRef = (0, import_react$29.useRef)(null);
	const getTargetWindow = () => iframeRefStable.current?.current?.contentWindow ?? null;
	const getSendOrigin = () => {
		if (lastOriginRef.current) return lastOriginRef.current;
		return allowedOriginsRef.current?.[0] ?? "*";
	};
	const send = (type, payload) => {
		const targetWindow = getTargetWindow();
		if (!targetWindow) {
			console.warn(`[Lexiang-Host] send: targetWindow is null, message dropped: type=${type}`);
			return;
		}
		const targetOrigin = getSendOrigin();
		const message = {
			type,
			payload,
			meta: buildHostMeta()
		};
		targetWindow.postMessage(message, targetOrigin);
	};
	const sendJsApiResponse = (event, requestId, success, data, error) => {
		const targetWindow = event.source ?? getTargetWindow();
		if (!targetWindow) {
			console.warn("[Lexiang-Host] sendJsApiResponse: targetWindow is null, response dropped:", requestId);
			return;
		}
		const targetOrigin = event.origin || getSendOrigin();
		const message = {
			type: HostToClientMessageType.JsApiResponse,
			payload: createJsApiResponsePayload(requestId, success, data, error),
			meta: buildHostMeta()
		};
		targetWindow.postMessage(message, targetOrigin);
	};
	(0, import_react$29.useEffect)(() => {
		if (!enabled || typeof window === "undefined") return;
		const handleMessage = (event) => {
			if (!isAllowedLexiangOrigin(event.origin, allowedOriginsRef.current)) return;
			const message = normalizeLexiangIncomingMessage(event.data);
			if (!message) return;
			lastOriginRef.current = event.origin;
			if (message.kind === "ready") {
				handlersRef.current.onLexiangReady?.({
					sdkVersion: message.sdkVersion,
					supportedProtocolVersions: message.supportedProtocolVersions
				});
				return;
			}
			const handler = handlersRef.current.onJsApiRequest;
			if (!handler) {
				if (message.shouldRespond && message.requestId) sendJsApiResponse(event, message.requestId, false, void 0, {
					code: "NOT_IMPLEMENTED",
					message: `JSAPI method '${message.method}' is not implemented by the host`
				});
				return;
			}
			handler(message.method, message.params).then((data) => {
				if (message.shouldRespond && message.requestId) sendJsApiResponse(event, message.requestId, true, data);
			}).catch((err) => {
				if (message.shouldRespond && message.requestId) sendJsApiResponse(event, message.requestId, false, void 0, {
					code: "JSAPI_ERROR",
					message: err instanceof Error ? err.message : String(err)
				});
			});
		};
		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, [enabled]);
	return (0, import_react$29.useMemo)(() => ({
		sendHostReady: (payload) => send("host:ready", {
			...payload,
			code: payload.code ?? 0,
			msg: payload.msg ?? "ok"
		}),
		sendThemeChanged: (theme) => send("host:theme:changed", {
			code: 0,
			msg: "ok",
			theme
		}),
		sendLocaleChanged: (locale) => send("host:locale:changed", {
			code: 0,
			msg: "ok",
			locale
		}),
		sendAuthChanged: (authed, userId) => send("host:auth:changed", {
			code: 0,
			msg: "ok",
			authed,
			userId
		}),
		sendAuthRefreshRequest: (reason) => send("host:auth:refresh-request", {
			code: 0,
			msg: "ok",
			reason
		}),
		sendVisibilityChanged: (visible) => send(HostToClientMessageType.VisibilityChanged, {
			code: 0,
			msg: "ok",
			visible
		}),
		sendPreviewOpen: (payload) => send(HostToClientMessageType.PreviewOpen, {
			code: 0,
			msg: "ok",
			...payload
		})
	}), []);
}
var import_react$29;
var init_lexiang_host_bridge = __esmMin((() => {
	init_host();
	import_react$29 = /* @__PURE__ */ __toESM(require_react());
})), import_jsx_runtime$24, LibraryIframeSkeleton;
var init_library_iframe_skeleton = __esmMin((() => {
	require_react();
	import_jsx_runtime$24 = require_jsx_runtime();
	LibraryIframeSkeleton = ({ label, overlay = false }) => /* @__PURE__ */ (0, import_jsx_runtime$24.jsxs)("div", {
		className: ["lexiang-library-iframe-view__skeleton", overlay ? "lexiang-library-iframe-view__skeleton--overlay" : ""].filter(Boolean).join(" "),
		role: "status",
		"aria-label": label,
		children: [/* @__PURE__ */ (0, import_jsx_runtime$24.jsxs)("div", {
			className: "lexiang-library-iframe-view__skeleton-header",
			"aria-hidden": "true",
			children: [/* @__PURE__ */ (0, import_jsx_runtime$24.jsx)("div", { className: "lexiang-library-iframe-view__skeleton-bar lexiang-library-iframe-view__skeleton-bar--title" }), /* @__PURE__ */ (0, import_jsx_runtime$24.jsxs)("div", {
				className: "lexiang-library-iframe-view__skeleton-toolbar",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime$24.jsx)("div", { className: "lexiang-library-iframe-view__skeleton-bar lexiang-library-iframe-view__skeleton-bar--chip" }),
					/* @__PURE__ */ (0, import_jsx_runtime$24.jsx)("div", { className: "lexiang-library-iframe-view__skeleton-bar lexiang-library-iframe-view__skeleton-bar--chip" }),
					/* @__PURE__ */ (0, import_jsx_runtime$24.jsx)("div", { className: "lexiang-library-iframe-view__skeleton-bar lexiang-library-iframe-view__skeleton-bar--chip-sm" })
				]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime$24.jsx)("div", {
			className: "lexiang-library-iframe-view__skeleton-list",
			"aria-hidden": "true",
			children: Array.from({ length: 5 }).map((_, idx) => /* @__PURE__ */ (0, import_jsx_runtime$24.jsxs)("div", {
				className: "lexiang-library-iframe-view__skeleton-card",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$24.jsx)("div", { className: "lexiang-library-iframe-view__skeleton-bar lexiang-library-iframe-view__skeleton-bar--line-main" }), /* @__PURE__ */ (0, import_jsx_runtime$24.jsx)("div", { className: "lexiang-library-iframe-view__skeleton-bar lexiang-library-iframe-view__skeleton-bar--line-desc" })]
			}, idx))
		})]
	});
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/library-iframe-view/index.tsx
function getUrlOrigin(url) {
	try {
		return new URL(url).origin;
	} catch {
		return;
	}
}
function isTrustedLexiangUrl(url, extraOrigins = []) {
	try {
		const parsed = new URL(url);
		const trustedOrigins = new Set([...LEXIANG_TRUSTED_ORIGINS, ...extraOrigins]);
		return parsed.protocol === "https:" && trustedOrigins.has(parsed.origin);
	} catch {
		return false;
	}
}
function getMediaId(media) {
	return media.id || "";
}
function getMediaTitle(media) {
	return media.title || "";
}
function getMediaExtension(media) {
	if (media.extension) return media.extension;
	const title = getMediaTitle(media);
	return title.includes(".") ? title.split(".").pop() : void 0;
}
function getMediaEntryType(media) {
	const entryType = media.entryType;
	if (entryType === "folder" || entryType === "flink") return entryType;
	return "page";
}
function isMediaFolder(media) {
	return Boolean(media.itemType === "folder" || media.type === "folder" || media.entryType === "folder");
}
function isKnowledgeBaseMedia(media) {
	return media.itemType === "kb";
}
function isTeamMedia(media) {
	return media.itemType === "team";
}
function isLexiangFileType(type) {
	return type === "doc" || type === "sheet" || type === "mind" || type === "slide" || type === "pdf" || type === "folder" || type === "other";
}
function hasRequiredMediaFields(media) {
	return Boolean(media.id && media.title && media.itemType);
}
function mediaToKnowledgeBase(media) {
	return {
		id: getMediaId(media),
		name: getMediaTitle(media),
		home_url: ""
	};
}
function mediaToFile(media) {
	const extension = getMediaExtension(media);
	const isFolder = isMediaFolder(media);
	const rawType = typeof media.type === "string" ? media.type : void 0;
	const type = isFolder ? "folder" : isLexiangFileType(rawType) ? rawType : inferFileTypeFromExt(extension);
	return {
		id: getMediaId(media),
		title: getMediaTitle(media),
		type,
		is_folder: isFolder,
		owner: { name: "" },
		updated_at: Date.now(),
		entry_type: isFolder ? "folder" : getMediaEntryType(media),
		extension
	};
}
function buildBlocks(medias, currentKb) {
	return medias.map((media) => {
		if (isTeamMedia(media)) return buildTeamBlock({
			id: getMediaId(media),
			name: getMediaTitle(media)
		});
		if (isKnowledgeBaseMedia(media)) return buildKnowledgeBaseBlock(mediaToKnowledgeBase(media));
		const kbId = media.spaceId;
		const kb = kbId ? {
			id: kbId,
			name: media.spaceName || currentKb?.name || "",
			home_url: ""
		} : currentKb;
		return buildFileBlock(mediaToFile(media), kb);
	});
}
function getPendingPreviewOpenKey(pending) {
	const targetSpaceId = pending?.spaceId ?? pending?.kb?.id;
	if (!pending?.entryId || !targetSpaceId) return null;
	return `${targetSpaceId}:${pending.entryId}`;
}
function isReusableIframeLoadFresh(load) {
	if (!load) return false;
	return Date.now() - load.loadedAt < LEXIANG_IFRAME_CACHE_TTL_MS;
}
function LexiangLibraryIframeView({ isActive, pendingPreviewOpen, onPendingPreviewOpenConsumed }) {
	const adapter = useAdapter();
	const imaBridge = useOptionalImaApiBridge();
	const isExclusiveAccount = useCurrentAccount()?.type === "exclusive";
	const [vpcDerivedOrigin, setVpcDerivedOrigin] = (0, import_react$27.useState)(void 0);
	(0, import_react$27.useEffect)(() => {
		if (!isExclusiveAccount) setVpcDerivedOrigin(void 0);
	}, [isExclusiveAccount]);
	const lexiangOneidStatus = useOneidAppStatus("lexiang");
	const canCallTempLoginUrl = lexiangOneidStatus.status === "skip" || lexiangOneidStatus.status === "enabled";
	const t = useTranslation();
	const { theme } = useTheme();
	const currentKb = useTencentLexiangStore((s) => s.currentKnowledgeBase);
	const { addBlocksToTask } = useLexiangAddToTask();
	const iframeRef = (0, import_react$27.useRef)(null);
	const hostSenderRef = (0, import_react$27.useRef)(null);
	const fallbackHostReadySentRef = (0, import_react$27.useRef)(false);
	const urlRef = (0, import_react$27.useRef)(null);
	const lastReusableLoadRef = (0, import_react$27.useRef)(null);
	const lastTriggeredPendingPreviewOpenKeyRef = (0, import_react$27.useRef)(null);
	const prevPendingActiveRef = (0, import_react$27.useRef)(isActive);
	const hasEvaluatedPendingTriggerRef = (0, import_react$27.useRef)(false);
	const pendingPreviewOpenRef = (0, import_react$27.useRef)(pendingPreviewOpen);
	const [pendingLoadRevision, setPendingLoadRevision] = (0, import_react$27.useState)(0);
	(0, import_react$27.useEffect)(() => {
		pendingPreviewOpenRef.current = pendingPreviewOpen;
		const wasActive = prevPendingActiveRef.current;
		const isInitialEvaluation = !hasEvaluatedPendingTriggerRef.current;
		prevPendingActiveRef.current = isActive;
		hasEvaluatedPendingTriggerRef.current = true;
		const pendingKey = getPendingPreviewOpenKey(pendingPreviewOpen);
		if (!pendingKey) {
			lastTriggeredPendingPreviewOpenKeyRef.current = null;
			return;
		}
		if (!isActive || pendingKey === lastTriggeredPendingPreviewOpenKeyRef.current) return;
		lastTriggeredPendingPreviewOpenKeyRef.current = pendingKey;
		if (isInitialEvaluation || !wasActive) return;
		setPendingLoadRevision((value) => value + 1);
	}, [pendingPreviewOpen, isActive]);
	const onPendingPreviewOpenConsumedRef = (0, import_react$27.useRef)(onPendingPreviewOpenConsumed);
	(0, import_react$27.useEffect)(() => {
		onPendingPreviewOpenConsumedRef.current = onPendingPreviewOpenConsumed;
	}, [onPendingPreviewOpenConsumed]);
	const [url, setUrl] = (0, import_react$27.useState)(null);
	const [loading, setLoading] = (0, import_react$27.useState)(false);
	const [error, setError] = (0, import_react$27.useState)(null);
	const [iframeLoaded, setIframeLoaded] = (0, import_react$27.useState)(false);
	const [clientReady, setClientReady] = (0, import_react$27.useState)(false);
	const iframeLoadedRef = (0, import_react$27.useRef)(false);
	const clientReadyRef = (0, import_react$27.useRef)(false);
	const [reloadKey, setReloadKey] = (0, import_react$27.useState)(0);
	(0, import_react$27.useEffect)(() => {
		iframeLoadedRef.current = iframeLoaded;
	}, [iframeLoaded]);
	(0, import_react$27.useEffect)(() => {
		clientReadyRef.current = clientReady;
	}, [clientReady]);
	(0, import_react$27.useEffect)(() => {
		if (!isActive || !adapter) return;
		if (!canCallTempLoginUrl) {
			lastReusableLoadRef.current = null;
			urlRef.current = null;
			setLoading(true);
			setError(null);
			setUrl(null);
			setIframeLoaded(false);
			setClientReady(false);
			iframeLoadedRef.current = false;
			clientReadyRef.current = false;
			fallbackHostReadySentRef.current = false;
			return;
		}
		const pending = pendingPreviewOpenRef.current;
		const targetSpaceId = pending?.spaceId ?? pending?.kb?.id;
		const shouldOpenSpace = Boolean(pending?.entryId && targetSpaceId);
		const canSoftNavigatePending = shouldOpenSpace && iframeLoadedRef.current;
		const lastReusableLoad = lastReusableLoadRef.current;
		if (Boolean(urlRef.current) && isReusableIframeLoadFresh(lastReusableLoad) && (!shouldOpenSpace || canSoftNavigatePending) && lastReusableLoad.adapter === adapter && lastReusableLoad.canCallTempLoginUrl === canCallTempLoginUrl && lastReusableLoad.reloadKey === reloadKey) return;
		let cancelled = false;
		lastReusableLoadRef.current = null;
		setLoading(true);
		setError(null);
		setIframeLoaded(false);
		setClientReady(false);
		iframeLoadedRef.current = false;
		clientReadyRef.current = false;
		fallbackHostReadySentRef.current = false;
		(async () => {
			const [isStaging, endpoint] = imaBridge ? await Promise.all([imaBridge.isStagingEnv().catch(() => false), imaBridge.getProductEndpoint?.().catch(() => void 0) ?? Promise.resolve(void 0)]) : [false, void 0];
			if (!cancelled && isExclusiveAccount && endpoint) setVpcDerivedOrigin(deriveLexiangWebOriginForVpcAccount(endpoint));
			return shouldOpenSpace ? getLexiangSpaceEmbedUrl(adapter, isStaging, {
				spaceId: targetSpaceId,
				entryId: pending.entryId,
				endpoint,
				isVpcAccount: isExclusiveAccount
			}) : getLexiangLibraryEmbedUrl(adapter, isStaging, {
				endpoint,
				isVpcAccount: isExclusiveAccount
			});
		})().then((nextUrl) => {
			if (cancelled) return;
			urlRef.current = nextUrl;
			lastReusableLoadRef.current = {
				adapter,
				canCallTempLoginUrl,
				reloadKey,
				loadedAt: Date.now()
			};
			setUrl(nextUrl);
			if (shouldOpenSpace) onPendingPreviewOpenConsumedRef.current?.();
		}).catch((err) => {
			if (cancelled) return;
			urlRef.current = null;
			setUrl(null);
			setError(err instanceof Error ? err.message : String(err));
		}).finally(() => {
			if (!cancelled) setLoading(false);
		});
		return () => {
			cancelled = true;
			if (shouldOpenSpace) lastTriggeredPendingPreviewOpenKeyRef.current = null;
		};
	}, [
		adapter,
		isActive,
		reloadKey,
		canCallTempLoginUrl,
		pendingLoadRevision,
		isExclusiveAccount
	]);
	const allowedOrigins = (0, import_react$27.useMemo)(() => {
		const origin = url ? getUrlOrigin(url) : void 0;
		return Array.from(new Set([
			...origin ? [origin] : [],
			...vpcDerivedOrigin ? [vpcDerivedOrigin] : [],
			...LEXIANG_TRUSTED_ORIGINS
		]));
	}, [url, vpcDerivedOrigin]);
	const handleGetToken = (0, import_react$27.useCallback)(async () => {
		if (!adapter?.connectorOauthAccessToken) return {
			code: 1,
			msg: "connectorOauthAccessToken not available"
		};
		const resp = await adapter.connectorOauthAccessToken(LEXIANG_OAUTH_NAME);
		const token = resp.data?.access_token;
		if (resp.code !== 0 || !token) return {
			code: 1,
			msg: resp.msg ?? "get token failed"
		};
		return ok({ token });
	}, [adapter]);
	const handleAddKnowledgeTask = (0, import_react$27.useCallback)(async (params) => {
		const { medias } = params ?? {};
		if (!Array.isArray(medias) || medias.length === 0) return {
			code: 1,
			msg: "medias is empty"
		};
		if (!medias.every(hasRequiredMediaFields)) return {
			code: 1,
			msg: "media id, title and itemType are required"
		};
		addBlocksToTask(buildBlocks(medias, currentKb));
		return ok({ taskId: `local-${Date.now()}` });
	}, [addBlocksToTask, currentKb]);
	const openTrustedUrl = (0, import_react$27.useCallback)(async (nextUrl) => {
		if (adapter?.openExternal) {
			await adapter.openExternal(nextUrl);
			return;
		}
		window.open(nextUrl, "_blank", "noopener,noreferrer");
	}, [adapter]);
	const handleOpenBrowser = (0, import_react$27.useCallback)(async (params) => {
		const browserUrl = params?.url;
		if (!browserUrl || !isTrustedLexiangUrl(browserUrl, allowedOrigins)) return {
			code: 1,
			msg: "url is not allowed"
		};
		await openTrustedUrl(browserUrl);
		reportOpenInLexiang(adapter);
		return ok();
	}, [
		adapter,
		allowedOrigins,
		openTrustedUrl
	]);
	const handleGetHostState = (0, import_react$27.useCallback)(async () => ok({
		theme: theme === "light" ? "light" : "dark",
		locale: navigator.language || "zh-CN"
	}), [theme]);
	const sendHostReady = (0, import_react$27.useCallback)(() => {
		hostSenderRef.current?.sendHostReady({
			code: 0,
			msg: "",
			hostApp: adapter?.environmentType === "local" ? "workbuddy-desktop" : "codebuddy-web",
			hostVersion: "unknown",
			theme: theme === "light" ? "light" : "dark",
			locale: navigator.language || "zh-CN",
			authed: true,
			supportedProtocolVersions: ["1.1.0", "1.2.0"]
		});
	}, [adapter?.environmentType, theme]);
	const hostSender = useLexiangHostBridge({
		allowedOrigins,
		enabled: Boolean(url),
		iframeRef,
		handlers: {
			onLexiangReady: () => {
				clientReadyRef.current = true;
				setClientReady(true);
				sendHostReady();
			},
			onJsApiRequest: async (method, params) => {
				let result;
				try {
					switch (method) {
						case "getToken":
							result = await handleGetToken();
							break;
						case "addKnowledgeTask":
							result = await handleAddKnowledgeTask(params);
							if (params?.actionType === "hover") reportAddToTaskHover(adapter);
							else reportAddToTaskBatch(adapter);
							break;
						case "openBrowser":
							result = await handleOpenBrowser(params);
							break;
						case "getHostState":
							result = await handleGetHostState();
							break;
						case "getSupportedFileFormats":
							result = ok(LEXIANG_SUPPORTED_FILE_FORMATS);
							break;
						case "authExpired":
							setReloadKey((value) => value + 1);
							result = ok();
							break;
						case "search":
							reportSearch(adapter);
							result = ok();
							break;
						default: throw new Error(`Unknown JSAPI method: ${method}`);
					}
					if (result?.code === 0) reportJsApiSuccess(adapter, method);
					else reportJsApiFail(adapter, method);
					return result;
				} catch (err) {
					reportJsApiFail(adapter, method);
					throw err;
				}
			}
		}
	});
	(0, import_react$27.useEffect)(() => {
		hostSenderRef.current = hostSender;
	}, [hostSender]);
	(0, import_react$27.useEffect)(() => {
		const pending = pendingPreviewOpen;
		const targetSpaceId = pending?.spaceId ?? pending?.kb?.id;
		if (!iframeLoaded) return;
		if (!pending?.entryId || !targetSpaceId) return;
		if (!clientReady && !fallbackHostReadySentRef.current) {
			fallbackHostReadySentRef.current = true;
			sendHostReady();
		}
		hostSenderRef.current?.sendPreviewOpen({
			media: {
				id: pending.entryId,
				title: pending.name,
				entryType: pending.entryType,
				spaceId: targetSpaceId
			},
			source: "upload"
		});
		onPendingPreviewOpenConsumedRef.current?.();
	}, [
		pendingPreviewOpen,
		iframeLoaded,
		clientReady,
		sendHostReady
	]);
	(0, import_react$27.useEffect)(() => {
		if (!iframeLoaded || clientReady || fallbackHostReadySentRef.current) return;
		fallbackHostReadySentRef.current = true;
		sendHostReady();
	}, [
		clientReady,
		iframeLoaded,
		sendHostReady
	]);
	(0, import_react$27.useEffect)(() => {
		if (!iframeLoaded) return;
		hostSenderRef.current?.sendThemeChanged(theme === "light" ? "light" : "dark");
	}, [iframeLoaded, theme]);
	const prevActiveRef = (0, import_react$27.useRef)(isActive);
	(0, import_react$27.useEffect)(() => {
		if (isActive !== prevActiveRef.current && iframeLoaded) hostSenderRef.current?.sendVisibilityChanged(isActive);
		prevActiveRef.current = isActive;
	}, [iframeLoaded, isActive]);
	(0, import_react$27.useEffect)(() => {
		if (!iframeLoaded) return;
		return onLocaleChange((locale) => {
			hostSenderRef.current?.sendLocaleChanged(locale);
		});
	}, [iframeLoaded]);
	const handleRetry = () => setReloadKey((value) => value + 1);
	return /* @__PURE__ */ (0, import_jsx_runtime$23.jsxs)("div", {
		className: "lexiang-library-iframe-view",
		children: [
			loading && /* @__PURE__ */ (0, import_jsx_runtime$23.jsx)(LibraryIframeSkeleton, { label: t("tencentLexiang.iframe.loading") }),
			!loading && error && /* @__PURE__ */ (0, import_jsx_runtime$23.jsxs)("div", {
				className: "lexiang-library-iframe-view__placeholder lexiang-library-iframe-view__placeholder--error",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime$23.jsx)("img", {
						className: "lexiang-library-iframe-view__error-icon",
						src: "" + new URL("no-knowledge-base-update-CopzwuXE.svg", import.meta.url).href,
						alt: "",
						"aria-hidden": "true"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime$23.jsx)("div", {
						className: "lexiang-library-iframe-view__error-desc",
						children: t("tencentLexiang.iframe.loadFailedHint")
					}),
					/* @__PURE__ */ (0, import_jsx_runtime$23.jsx)("button", {
						type: "button",
						className: "lexiang-library-iframe-view__retry",
						onClick: handleRetry,
						children: t("tencentLexiang.iframe.refreshRetry")
					})
				]
			}),
			url && !error && /* @__PURE__ */ (0, import_jsx_runtime$23.jsxs)(import_jsx_runtime$23.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime$23.jsx)("iframe", {
				ref: iframeRef,
				className: "lexiang-library-iframe-view__iframe",
				src: url,
				title: t("tencentLexiang.iframe.title"),
				allow: "clipboard-read; clipboard-write; fullscreen",
				onLoad: () => {
					iframeLoadedRef.current = true;
					setIframeLoaded(true);
					reportIframePageShow(adapter);
				}
			}), !iframeLoaded && /* @__PURE__ */ (0, import_jsx_runtime$23.jsx)(LibraryIframeSkeleton, {
				label: t("tencentLexiang.iframe.loading"),
				overlay: true
			})] })
		]
	});
}
var import_react$27, import_jsx_runtime$23, ok, LEXIANG_SUPPORTED_FILE_FORMATS, LEXIANG_IFRAME_CACHE_TTL_MS;
var init_library_iframe_view = __esmMin((() => {
	init_library_iframe_view$1();
	import_react$27 = /* @__PURE__ */ __toESM(require_react());
	init_contexts();
	init_ima_api_context();
	init_use_oneid_app_status();
	init_i18n();
	init_useI18n();
	init_useTheme();
	init_auth_service();
	init_no_knowledge_base_update();
	init_constants();
	init_use_lexiang_add_to_task();
	init_lexiang_content_blocks();
	init_store();
	init_telemetry();
	init_utils();
	init_auth();
	init_lexiang_host_bridge();
	init_library_iframe_skeleton();
	import_jsx_runtime$23 = require_jsx_runtime();
	ok = (payload) => ({
		code: 0,
		msg: "",
		...payload ?? {}
	});
	LEXIANG_SUPPORTED_FILE_FORMATS = { formats: {
		doc: {
			supportChat: true,
			supportPreview: true
		},
		sheet: {
			supportChat: true,
			supportPreview: true
		},
		mind: {
			supportChat: true,
			supportPreview: true
		},
		slide: {
			supportChat: true,
			supportPreview: true
		},
		pdf: {
			supportChat: true,
			supportPreview: true
		},
		other: {
			supportChat: true,
			supportPreview: true
		},
		folder: {
			supportChat: true,
			supportPreview: false
		}
	} };
	LEXIANG_IFRAME_CACHE_TTL_MS = 1440 * 60 * 1e3;
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/post-activation-gate/lexiang-post-activation-gate.less
var init_lexiang_post_activation_gate = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/post-activation-gate/index.tsx
var import_react$26, import_jsx_runtime$22, LexiangPostActivationGate;
var init_post_activation_gate = __esmMin((() => {
	init_lexiang_post_activation_gate();
	import_react$26 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_auth();
	import_jsx_runtime$22 = require_jsx_runtime();
	LexiangPostActivationGate = () => {
		const t = useTranslation();
		const postActivationGate = useLexiangAuth((s) => s.postActivationGate);
		const handleRetry = (0, import_react$26.useCallback)(() => {
			lexiangAuthStore.getState().retryPostActivationGate();
		}, []);
		const handleContinue = (0, import_react$26.useCallback)(() => {
			lexiangAuthStore.getState().continuePostActivationGate();
		}, []);
		if (postActivationGate === "pending") return /* @__PURE__ */ (0, import_jsx_runtime$22.jsx)("div", {
			className: "lexiang-post-activation-gate",
			role: "status",
			"aria-live": "polite",
			children: /* @__PURE__ */ (0, import_jsx_runtime$22.jsxs)("div", {
				className: "lexiang-post-activation-gate__card",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$22.jsx)("span", {
					className: "lexiang-post-activation-gate__spinner",
					"aria-hidden": "true"
				}), /* @__PURE__ */ (0, import_jsx_runtime$22.jsx)("p", {
					className: "lexiang-post-activation-gate__desc",
					children: t("tencentLexiang.postActivation.checking")
				})]
			})
		});
		if (postActivationGate === "timeout") return /* @__PURE__ */ (0, import_jsx_runtime$22.jsx)("div", {
			className: "lexiang-post-activation-gate",
			role: "alert",
			"aria-live": "assertive",
			children: /* @__PURE__ */ (0, import_jsx_runtime$22.jsxs)("div", {
				className: "lexiang-post-activation-gate__card lexiang-post-activation-gate__card--timeout",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$22.jsxs)("div", {
					className: "lexiang-post-activation-gate__content",
					children: [/* @__PURE__ */ (0, import_jsx_runtime$22.jsx)("h3", {
						className: "lexiang-post-activation-gate__title",
						children: t("tencentLexiang.postActivation.timeout.title")
					}), /* @__PURE__ */ (0, import_jsx_runtime$22.jsx)("p", {
						className: "lexiang-post-activation-gate__desc",
						children: t("tencentLexiang.postActivation.timeout.desc")
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime$22.jsxs)("div", {
					className: "lexiang-post-activation-gate__actions",
					children: [/* @__PURE__ */ (0, import_jsx_runtime$22.jsx)("button", {
						type: "button",
						className: "lexiang-post-activation-gate__btn lexiang-post-activation-gate__btn--secondary",
						onClick: handleRetry,
						"aria-label": t("tencentLexiang.postActivation.timeout.retry"),
						children: t("tencentLexiang.postActivation.timeout.retry")
					}), /* @__PURE__ */ (0, import_jsx_runtime$22.jsx)("button", {
						type: "button",
						className: "lexiang-post-activation-gate__btn lexiang-post-activation-gate__btn--primary",
						onClick: handleContinue,
						"aria-label": t("tencentLexiang.postActivation.timeout.continue"),
						children: t("tencentLexiang.postActivation.timeout.continue")
					})]
				})]
			})
		});
		return null;
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/pages/space-detail/space-detail.less
var init_space_detail$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/hooks/use-lexiang-catalog-tree.ts
function useLexiangCatalogTree() {
	const currentKb = useTencentLexiangStore((s) => s.currentKnowledgeBase);
	const fileListVersion = useTencentLexiangStore((s) => s.fileListVersion);
	const nodeMapRef = (0, import_react$25.useRef)(/* @__PURE__ */ new Map());
	const [, setTick] = (0, import_react$25.useState)(0);
	const forceRender = (0, import_react$25.useCallback)(() => setTick((v) => v + 1), []);
	const [rootId, setRootId] = (0, import_react$25.useState)(currentKb?.rootEntryId);
	const [rootLoading, setRootLoading] = (0, import_react$25.useState)(true);
	const [rootError, setRootError] = (0, import_react$25.useState)(null);
	/** 读/建节点状态（确保返回同一引用以便外部 memo 生效） */
	const getOrInitNode = (0, import_react$25.useCallback)((nodeId) => {
		const map = nodeMapRef.current;
		let node = map.get(nodeId);
		if (!node) {
			node = createEmptyNodeState();
			map.set(nodeId, node);
		}
		return node;
	}, []);
	/** 外部只读 API：不存在时返回稳定 empty（避免频繁创建引用） */
	const EMPTY_NODE_STATE = (0, import_react$25.useRef)(createEmptyNodeState()).current;
	const getNodeState = (0, import_react$25.useCallback)((nodeId) => nodeMapRef.current.get(nodeId) ?? EMPTY_NODE_STATE, [EMPTY_NODE_STATE]);
	/** 单个节点最多拉多少条子项（防止巨型目录打爆内存） */
	const MAX_CHILDREN_PER_NODE = 200;
	/** 防 token 不递进死循环 */
	const MAX_PAGES_PER_NODE = 20;
	/**
	* 拉取一个节点的 children（分页 + 增量渲染）。
	*
	* 分页策略：
	* - 每拉完一页就 append 到 nodeState.children 并 forceRender，
	*   用户能看到数据逐步出现。
	* - 「短页即停」：当后端返回的 items 数 < `LEXIANG_CATALOG_PAGE_SIZE`，
	*   视为本层已无更多数据，清空 `nextPageToken` 并结束循环；
	*   这样可避免后端返回极少条目却携带 token 导致的「无意义续拉 + loading 闪烁」。
	* - 只有「满页」返回（items 数 === limit）且 token 有效时，才自动拉下一页。
	* - 达到 MAX_CHILDREN_PER_NODE 或 MAX_PAGES_PER_NODE 时也停止（安全上限）。
	*/
	const requestChildren = (0, import_react$25.useCallback)(async (parentId) => {
		const node = getOrInitNode(parentId);
		if (node.loading) return;
		const isAppend = node.loaded && !!node.nextPageToken;
		const startPageToken = isAppend ? node.nextPageToken : void 0;
		node.loading = true;
		node.error = null;
		if (!isAppend) {
			node.children = [];
			node.nextPageToken = void 0;
		}
		forceRender();
		try {
			let pageToken = startPageToken;
			let pageCount = 0;
			let totalItems = isAppend ? node.children.length : 0;
			do {
				const result = await fetchCatalogChildren(parentId, pageToken);
				const latest = getOrInitNode(parentId);
				latest.children = [...latest.children, ...result.items];
				latest.loaded = true;
				totalItems += result.items.length;
				if (result.nextPageToken && result.nextPageToken === pageToken) {
					latest.nextPageToken = void 0;
					break;
				}
				if (result.items.length < 20) {
					latest.nextPageToken = void 0;
					break;
				}
				pageCount += 1;
				pageToken = result.nextPageToken;
				latest.nextPageToken = pageToken;
				forceRender();
				if (pageCount >= MAX_PAGES_PER_NODE || totalItems >= MAX_CHILDREN_PER_NODE) break;
			} while (pageToken);
			const latest = getOrInitNode(parentId);
			latest.loading = false;
			latest.error = null;
			if (latest.children.length > 0) tencentLexiangStore.getState().registerFiles(latest.children);
		} catch (err) {
			const latest = getOrInitNode(parentId);
			latest.loading = false;
			latest.error = err?.message ?? "load failed";
		} finally {
			forceRender();
		}
	}, [getOrInitNode, forceRender]);
	const prevFileListVersionRef = (0, import_react$25.useRef)(fileListVersion);
	(0, import_react$25.useEffect)(() => {
		let cancelled = false;
		const isSilentRefresh = fileListVersion > prevFileListVersionRef.current;
		prevFileListVersionRef.current = fileListVersion;
		const resolveRootId = async () => currentKb?.rootEntryId;
		(async () => {
			if (!isSilentRefresh) {
				setRootLoading(true);
				setRootError(null);
			}
			try {
				const id = await resolveRootId();
				if (cancelled) return;
				if (!id) {
					if (!isSilentRefresh) setRootLoading(false);
					return;
				}
				setRootId(id);
				const rootNode = getOrInitNode(id);
				rootNode.expanded = true;
				let expandedNodeIds = [];
				if (isSilentRefresh) {
					expandedNodeIds = Array.from(nodeMapRef.current.entries()).filter(([nodeId, node]) => nodeId !== id && node.expanded).map(([nodeId]) => nodeId);
					nodeMapRef.current.forEach((node) => {
						node.loaded = false;
						node.children = [];
						node.nextPageToken = void 0;
						node.error = null;
					});
					rootNode.expanded = true;
				}
				await requestChildren(id);
				if (cancelled) return;
				if (isSilentRefresh && expandedNodeIds.length > 0) {
					await Promise.all(expandedNodeIds.map((nodeId) => requestChildren(nodeId)));
					if (cancelled) return;
				}
			} catch (err) {
				if (cancelled) return;
				setRootError(err?.message ?? "resolve_root_failed");
			} finally {
				if (!cancelled) setRootLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [currentKb?.rootEntryId, fileListVersion]);
	return {
		rootId,
		rootLoading,
		rootError,
		getNodeState,
		toggleExpand: (0, import_react$25.useCallback)((nodeId) => {
			const node = getOrInitNode(nodeId);
			const nextExpanded = !node.expanded;
			node.expanded = nextExpanded;
			forceRender();
			if (nextExpanded && !node.loaded && !node.loading) requestChildren(nodeId);
		}, [
			getOrInitNode,
			forceRender,
			requestChildren
		]),
		loadMore: (0, import_react$25.useCallback)((parentId) => {
			const node = getOrInitNode(parentId);
			if (!node.loaded || !node.nextPageToken || node.loading) return;
			requestChildren(parentId);
		}, [getOrInitNode, requestChildren]),
		retry: (0, import_react$25.useCallback)((parentId) => {
			const node = getOrInitNode(parentId);
			if (node.loading) return;
			node.error = null;
			forceRender();
			requestChildren(parentId);
		}, [
			getOrInitNode,
			forceRender,
			requestChildren
		])
	};
}
var import_react$25, createEmptyNodeState;
var init_use_lexiang_catalog_tree = __esmMin((() => {
	import_react$25 = /* @__PURE__ */ __toESM(require_react());
	init_api();
	init_catalog_service();
	init_store();
	createEmptyNodeState = () => ({
		children: [],
		nextPageToken: void 0,
		loading: false,
		loaded: false,
		expanded: false,
		error: null
	});
})), import_jsx_runtime$21, LexiangEmptyView;
var init_empty_view = __esmMin((() => {
	require_react();
	init_no_knowledge_base_update();
	import_jsx_runtime$21 = require_jsx_runtime();
	LexiangEmptyView = ({ text }) => /* @__PURE__ */ (0, import_jsx_runtime$21.jsxs)("div", {
		className: "tencent-lexiang-empty",
		role: "status",
		children: [/* @__PURE__ */ (0, import_jsx_runtime$21.jsx)("img", {
			className: "tencent-lexiang-empty__icon",
			src: no_knowledge_base_update_default,
			alt: "",
			"aria-hidden": "true",
			draggable: false
		}), /* @__PURE__ */ (0, import_jsx_runtime$21.jsx)("span", {
			className: "tencent-lexiang-empty__text",
			children: text
		})]
	});
})), import_jsx_runtime$20, ListSkeleton;
var init_list_skeleton = __esmMin((() => {
	require_react();
	import_jsx_runtime$20 = require_jsx_runtime();
	ListSkeleton = ({ rows = 6 }) => /* @__PURE__ */ (0, import_jsx_runtime$20.jsxs)("div", {
		className: "tencent-lexiang-skeleton",
		children: [/* @__PURE__ */ (0, import_jsx_runtime$20.jsxs)("div", {
			className: "tencent-lexiang-skeleton__header",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime$20.jsx)("span", { className: "tencent-lexiang-skeleton__bar tencent-lexiang-skeleton__bar--short" }),
				/* @__PURE__ */ (0, import_jsx_runtime$20.jsx)("span", { className: "tencent-lexiang-skeleton__bar tencent-lexiang-skeleton__bar--long" }),
				/* @__PURE__ */ (0, import_jsx_runtime$20.jsx)("span", { className: "tencent-lexiang-skeleton__bar tencent-lexiang-skeleton__bar--medium" }),
				/* @__PURE__ */ (0, import_jsx_runtime$20.jsx)("span", { className: "tencent-lexiang-skeleton__bar tencent-lexiang-skeleton__bar--medium" })
			]
		}), Array.from({ length: rows }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime$20.jsxs)("div", {
			className: "tencent-lexiang-skeleton__row",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime$20.jsx)("span", { className: "tencent-lexiang-skeleton__icon" }),
				/* @__PURE__ */ (0, import_jsx_runtime$20.jsx)("span", { className: "tencent-lexiang-skeleton__bar tencent-lexiang-skeleton__bar--long" }),
				/* @__PURE__ */ (0, import_jsx_runtime$20.jsx)("span", { className: "tencent-lexiang-skeleton__bar tencent-lexiang-skeleton__bar--medium" }),
				/* @__PURE__ */ (0, import_jsx_runtime$20.jsx)("span", { className: "tencent-lexiang-skeleton__bar tencent-lexiang-skeleton__bar--short" })
			]
		}, i))]
	});
})), import_jsx_runtime$19, CatalogRow, LevelFooter, CatalogView;
var init_catalog_view = __esmMin((() => {
	init_src$1();
	require_react();
	init_useI18n();
	init_constants();
	init_use_lexiang_add_to_task();
	init_use_lexiang_catalog_tree();
	init_store();
	init_utils();
	init_empty_view();
	init_lexiang_file_type_icon();
	init_ui_icons();
	init_list_skeleton();
	import_jsx_runtime$19 = require_jsx_runtime();
	CatalogRow = ({ file, depth, getNodeState, toggleExpand, loadMore, retry }) => {
		const t = useTranslation();
		const selectedIds = useTencentLexiangStore((s) => s.selectedIds);
		const toggleSelected = useTencentLexiangStore((s) => s.toggleSelected);
		const openPreview = useTencentLexiangStore((s) => s.openPreview);
		const { addFileToTask } = useLexiangAddToTask();
		const isFolder = file.is_folder;
		const checked = selectedIds.has(file.id);
		const canHaveChildren = file.has_children === true;
		const nodeState = getNodeState(file.id);
		const expanded = nodeState.expanded;
		const handleRowClick = () => {
			if (isFolder) {
				openPreview(file);
				return;
			}
			openPreview(file);
		};
		const handleCaretClick = (e) => {
			e.stopPropagation();
			if (canHaveChildren) toggleExpand(file.id);
		};
		const indent = (depth + 1) * 24;
		return /* @__PURE__ */ (0, import_jsx_runtime$19.jsxs)(import_jsx_runtime$19.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime$19.jsxs)("div", {
			className: `tencent-lexiang-catalog__row${checked ? " is-selected" : ""}`,
			role: "row",
			style: { paddingLeft: indent },
			onClick: handleRowClick,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime$19.jsx)("span", {
					className: "tencent-lexiang-catalog__caret",
					"aria-hidden": !canHaveChildren,
					role: canHaveChildren ? "button" : void 0,
					"aria-label": canHaveChildren ? expanded ? t("tencentLexiang.catalog.collapse") : t("tencentLexiang.catalog.expand") : void 0,
					style: {
						display: "inline-flex",
						transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
						transition: "transform 0.15s ease",
						visibility: canHaveChildren ? "visible" : "hidden",
						cursor: canHaveChildren ? "pointer" : "default"
					},
					onClick: canHaveChildren ? handleCaretClick : void 0,
					children: /* @__PURE__ */ (0, import_jsx_runtime$19.jsx)(ChevronDownIcon$1, {})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$19.jsx)("span", {
					className: "tencent-lexiang-catalog__checkbox",
					onClick: (e) => e.stopPropagation(),
					children: /* @__PURE__ */ (0, import_jsx_runtime$19.jsx)(Checkbox$1, {
						size: "medium",
						checked,
						onChange: () => toggleSelected(file.id),
						"aria-label": file.title
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$19.jsx)("span", {
					className: "tencent-lexiang-catalog__file-icon",
					"aria-hidden": "true",
					children: /* @__PURE__ */ (0, import_jsx_runtime$19.jsx)(LexiangFileTypeIcon, {
						type: file.type,
						extension: file.extension,
						isFolder,
						size: 16,
						onlineDocSize: 20
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$19.jsx)("span", {
					className: "tencent-lexiang-catalog__title",
					title: file.title,
					children: file.title
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$19.jsx)(Tooltip$1, {
					content: t("tencentLexiang.list.addSingleToTask"),
					children: /* @__PURE__ */ (0, import_jsx_runtime$19.jsx)(IconButton, {
						size: "small",
						"aria-label": t("tencentLexiang.list.addSingleToTask"),
						className: "tencent-lexiang-catalog__spark",
						onClick: (e) => {
							e.stopPropagation();
							addFileToTask(file, "spark_icon");
						},
						children: /* @__PURE__ */ (0, import_jsx_runtime$19.jsx)(AddToChatIcon, { size: 16 })
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$19.jsx)("span", {
					className: "tencent-lexiang-catalog__dots",
					"aria-hidden": "true"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$19.jsx)("span", {
					className: "tencent-lexiang-catalog__time",
					children: file.updated_at ? formatRelativeTime(file.updated_at) : ""
				})
			]
		}), canHaveChildren && expanded && /* @__PURE__ */ (0, import_jsx_runtime$19.jsxs)("div", {
			className: "tencent-lexiang-catalog__children",
			role: "rowgroup",
			children: [nodeState.children.map((child) => /* @__PURE__ */ (0, import_jsx_runtime$19.jsx)(CatalogRow, {
				file: child,
				depth: depth + 1,
				getNodeState,
				toggleExpand,
				loadMore,
				retry
			}, child.id)), /* @__PURE__ */ (0, import_jsx_runtime$19.jsx)(LevelFooter, {
				parentId: file.id,
				depth: depth + 1,
				nodeState,
				loadMore,
				retry
			})]
		})] });
	};
	LevelFooter = ({ parentId, depth, nodeState, loadMore, retry }) => {
		const t = useTranslation();
		const indent = (depth + 1) * 24;
		if (nodeState.loading && !nodeState.loaded) return /* @__PURE__ */ (0, import_jsx_runtime$19.jsx)("div", {
			className: "tencent-lexiang-catalog__row is-footer is-loading",
			role: "row",
			style: {
				paddingLeft: indent,
				cursor: "default"
			},
			"aria-live": "polite",
			children: /* @__PURE__ */ (0, import_jsx_runtime$19.jsxs)("span", {
				className: "tencent-lexiang-catalog__footer-loading",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$19.jsx)(LoadingSpinnerIcon, { size: "1" }), /* @__PURE__ */ (0, import_jsx_runtime$19.jsx)("span", { children: t("common.loading") })]
			})
		});
		if (nodeState.error) {
			const handleRetry = (e) => {
				e.stopPropagation();
				retry(parentId);
			};
			return /* @__PURE__ */ (0, import_jsx_runtime$19.jsx)("div", {
				className: "tencent-lexiang-catalog__row is-footer is-error",
				role: "row",
				style: { paddingLeft: indent },
				onClick: handleRetry,
				onKeyDown: (e) => {
					if (e.key === "Enter") handleRetry(e);
				},
				tabIndex: 0,
				"aria-label": t("tencentLexiang.catalog.loadFailed"),
				children: /* @__PURE__ */ (0, import_jsx_runtime$19.jsx)("span", {
					className: "tencent-lexiang-catalog__title",
					children: t("tencentLexiang.catalog.loadFailed")
				})
			});
		}
		if (nodeState.loaded && nodeState.nextPageToken) {
			const handleLoadMore = (e) => {
				e.stopPropagation();
				loadMore(parentId);
			};
			return /* @__PURE__ */ (0, import_jsx_runtime$19.jsx)("div", {
				className: "tencent-lexiang-catalog__row is-footer is-load-more",
				role: "row",
				style: { paddingLeft: indent },
				onClick: handleLoadMore,
				onKeyDown: (e) => {
					if (e.key === "Enter") handleLoadMore(e);
				},
				tabIndex: 0,
				"aria-label": t("tencentLexiang.catalog.loadMore"),
				children: /* @__PURE__ */ (0, import_jsx_runtime$19.jsx)("span", {
					className: "tencent-lexiang-catalog__title",
					children: t("tencentLexiang.catalog.loadMore")
				})
			});
		}
		return null;
	};
	CatalogView = () => {
		const t = useTranslation();
		const { rootId, rootLoading, rootError, getNodeState, toggleExpand, loadMore, retry } = useLexiangCatalogTree();
		if (rootLoading) return /* @__PURE__ */ (0, import_jsx_runtime$19.jsx)(ListSkeleton, { rows: 5 });
		if (rootError) {
			const handleRetry = () => {
				if (rootId) retry(rootId);
			};
			return /* @__PURE__ */ (0, import_jsx_runtime$19.jsx)("div", {
				className: "tencent-lexiang-catalog__empty",
				onClick: handleRetry,
				onKeyDown: (e) => {
					if (e.key === "Enter") handleRetry();
				},
				tabIndex: 0,
				role: "button",
				"aria-label": t("tencentLexiang.catalog.loadFailed"),
				children: t("tencentLexiang.catalog.loadFailed")
			});
		}
		if (!rootId) return /* @__PURE__ */ (0, import_jsx_runtime$19.jsx)(LexiangEmptyView, { text: t("tencentLexiang.list.empty") });
		const rootNode = getNodeState(rootId);
		if (rootNode.loaded && rootNode.children.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime$19.jsx)(LexiangEmptyView, { text: t("tencentLexiang.list.empty") });
		return /* @__PURE__ */ (0, import_jsx_runtime$19.jsxs)("div", {
			className: "tencent-lexiang-catalog",
			role: "table",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime$19.jsxs)("div", {
					className: "tencent-lexiang-catalog__header",
					role: "row",
					children: [/* @__PURE__ */ (0, import_jsx_runtime$19.jsx)("span", {
						className: "tencent-lexiang-catalog__header-name",
						role: "columnheader",
						children: t("tencentLexiang.list.col.name")
					}), /* @__PURE__ */ (0, import_jsx_runtime$19.jsx)("span", {
						className: "tencent-lexiang-catalog__header-time",
						role: "columnheader",
						children: t("tencentLexiang.list.col.updatedAt")
					})]
				}),
				rootNode.children.map((node) => /* @__PURE__ */ (0, import_jsx_runtime$19.jsx)(CatalogRow, {
					file: node,
					depth: 0,
					getNodeState,
					toggleExpand,
					loadMore,
					retry
				}, node.id)),
				/* @__PURE__ */ (0, import_jsx_runtime$19.jsx)(LevelFooter, {
					parentId: rootId,
					depth: 0,
					nodeState: rootNode,
					loadMore,
					retry
				})
			]
		});
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/hooks/use-lexiang-flat-files.ts
/**
* 拉完指定 parent 的所有分页，返回该 parent 下的所有直接子节点。
*
* 内部循环消化 `nextPageToken`，直到接口返回为空。
*
* 防循环护栏：
* 1. 页数上限 MAX_PAGES_PER_FOLDER：避免后端规模畸形时拻得太狠。
* 2. token 重复检测：如果后端返回的 nextPageToken 与本次请求的 pageToken 完全相同，
*    说明 token 没有递进，直接中断防死循环。
*/
async function fetchAllChildrenOfParent(parentId) {
	const all = [];
	let pageToken;
	let pageCount = 0;
	do {
		const { items, nextPageToken } = await fetchCatalogChildren(parentId, pageToken, void 0, LEXIANG_CATALOG_SORT_BY);
		all.push(...items);
		pageCount += 1;
		if (nextPageToken && nextPageToken === pageToken) break;
		if (pageCount >= MAX_PAGES_PER_FOLDER) break;
		pageToken = nextPageToken;
	} while (pageToken);
	return all;
}
/**
* 带并发上限的"批量执行 Promise"。
*
* 相比 `Promise.all`，会把任务切成多个批次，避免一次性发出过多请求。
*/
async function runWithConcurrency(inputs, concurrency, worker) {
	const results = [];
	for (let i = 0; i < inputs.length; i += concurrency) {
		const batch = inputs.slice(i, i + concurrency);
		const batchResults = await Promise.all(batch.map(worker));
		results.push(...batchResults);
	}
	return results;
}
function useLexiangFlatFiles() {
	const currentKb = useTencentLexiangStore((s) => s.currentKnowledgeBase);
	const fileListVersion = useTencentLexiangStore((s) => s.fileListVersion);
	const [files, setFiles] = (0, import_react$21.useState)([]);
	const [loading, setLoading] = (0, import_react$21.useState)(true);
	const [expanding, setExpanding] = (0, import_react$21.useState)(false);
	const [error, setError] = (0, import_react$21.useState)(null);
	const [partialError, setPartialError] = (0, import_react$21.useState)(null);
	const [reloadTick, setReloadTick] = (0, import_react$21.useState)(0);
	const refresh = (0, import_react$21.useCallback)(() => setReloadTick((v) => v + 1), []);
	const prevVersionRef = (0, import_react$21.useRef)(fileListVersion);
	(0, import_react$21.useEffect)(() => {
		let cancelled = false;
		const isSilentRefresh = fileListVersion > prevVersionRef.current;
		prevVersionRef.current = fileListVersion;
		/** 解析 rootEntryId：从 store 读取，由 space-detail 页负责初始化 */
		const resolveRootId = async () => currentKb?.rootEntryId;
		const run = async () => {
			if (!isSilentRefresh) {
				setLoading(true);
				setExpanding(false);
				setError(null);
				setPartialError(null);
				setFiles([]);
			} else {
				setError(null);
				setPartialError(null);
			}
			let rootId;
			try {
				rootId = await resolveRootId();
			} catch (err) {
				if (cancelled) return;
				setError(err?.message ?? "resolve_root_failed");
				if (!isSilentRefresh) setLoading(false);
				return;
			}
			if (cancelled) return;
			if (!rootId) {
				setError("no_root_entry");
				if (!isSilentRefresh) setLoading(false);
				return;
			}
			const visitedFolders = /* @__PURE__ */ new Set();
			let currentLayer = [rootId];
			visitedFolders.add(rootId);
			const leafFiles = [];
			const seenFileIds = /* @__PURE__ */ new Set();
			let firstLayerDone = false;
			while (currentLayer.length > 0) {
				if (cancelled) return;
				if (visitedFolders.size > MAX_FOLDERS_VISITED) break;
				const nextLayer = [];
				const prevLen = leafFiles.length;
				await runWithConcurrency(currentLayer, LAYER_CONCURRENCY, async (parentId) => {
					try {
						const children = await fetchAllChildrenOfParent(parentId);
						if (cancelled) return;
						for (const child of children) {
							if (child.has_children === true && !visitedFolders.has(child.id)) {
								visitedFolders.add(child.id);
								nextLayer.push(child.id);
							}
							if (!child.is_folder && !seenFileIds.has(child.id)) {
								seenFileIds.add(child.id);
								leafFiles.push(child);
							}
						}
					} catch (err) {
						const errMsg = err?.message ?? String(err);
						console.error("[useLexiangFlatFiles] 加载子目录失败 parentId=", parentId, err);
						if (isLexiangAuthExpiredError(err)) setPartialError("部分目录加载失败：登录态可能已过期，请重试");
						else if (!cancelled) setPartialError(`部分目录加载失败: ${errMsg}`);
					}
				});
				if (cancelled) return;
				if (leafFiles.length > prevLen) {
					const addedSorted = leafFiles.slice(prevLen).sort((a, b) => (b.updated_at ?? 0) - (a.updated_at ?? 0));
					leafFiles.length = prevLen;
					leafFiles.push(...addedSorted);
				}
				setFiles([...leafFiles]);
				if (!firstLayerDone) {
					firstLayerDone = true;
					setLoading(false);
					setExpanding(nextLayer.length > 0);
				}
				currentLayer = nextLayer;
			}
			if (cancelled) return;
			setExpanding(false);
		};
		run();
		return () => {
			cancelled = true;
		};
	}, [
		currentKb?.rootEntryId,
		reloadTick,
		fileListVersion
	]);
	return {
		files,
		loading,
		expanding,
		error,
		partialError,
		refresh
	};
}
var import_react$21, LAYER_CONCURRENCY, MAX_FOLDERS_VISITED, MAX_PAGES_PER_FOLDER;
var init_use_lexiang_flat_files = __esmMin((() => {
	import_react$21 = /* @__PURE__ */ __toESM(require_react());
	init_api();
	init_auth_error();
	init_store();
	LAYER_CONCURRENCY = 5;
	MAX_FOLDERS_VISITED = 500;
	MAX_PAGES_PER_FOLDER = 50;
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/list-view/index.tsx
var import_react$20, import_jsx_runtime$18, ListView;
var init_list_view = __esmMin((() => {
	init_src$1();
	import_react$20 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_use_lexiang_add_to_task();
	init_use_lexiang_flat_files();
	init_store();
	init_utils();
	init_empty_view();
	init_lexiang_file_type_icon();
	init_ui_icons();
	init_list_skeleton();
	import_jsx_runtime$18 = require_jsx_runtime();
	ListView = () => {
		const t = useTranslation();
		const { files, loading, expanding, partialError } = useLexiangFlatFiles();
		const selectedIds = useTencentLexiangStore((s) => s.selectedIds);
		const toggleSelected = useTencentLexiangStore((s) => s.toggleSelected);
		const openPreview = useTencentLexiangStore((s) => s.openPreview);
		const { addFileToTask } = useLexiangAddToTask();
		const registerFiles = useTencentLexiangStore((s) => s.registerFiles);
		(0, import_react$20.useEffect)(() => {
			if (files.length > 0) registerFiles(files);
		}, [files, registerFiles]);
		const isEmpty = (0, import_react$20.useMemo)(() => !loading && files.length === 0, [loading, files]);
		if (loading) return /* @__PURE__ */ (0, import_jsx_runtime$18.jsx)(ListSkeleton, { rows: 6 });
		if (isEmpty) return /* @__PURE__ */ (0, import_jsx_runtime$18.jsx)(LexiangEmptyView, { text: t("tencentLexiang.list.empty") });
		return /* @__PURE__ */ (0, import_jsx_runtime$18.jsxs)("div", {
			className: "tencent-lexiang-list",
			role: "table",
			"data-show-id": "lexiang_file_list_show",
			"data-show-name": "乐享文件列表展示",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime$18.jsxs)("div", {
					className: "tencent-lexiang-list__header",
					role: "row",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime$18.jsx)("span", {
							className: "tencent-lexiang-list__col tencent-lexiang-list__col--name",
							role: "columnheader",
							children: t("tencentLexiang.list.col.name")
						}),
						/* @__PURE__ */ (0, import_jsx_runtime$18.jsx)("span", {
							className: "tencent-lexiang-list__col tencent-lexiang-list__col--owner",
							role: "columnheader",
							children: t("tencentLexiang.list.col.owner")
						}),
						/* @__PURE__ */ (0, import_jsx_runtime$18.jsx)("span", {
							className: "tencent-lexiang-list__col tencent-lexiang-list__col--time",
							role: "columnheader",
							children: t("tencentLexiang.list.col.updatedAt")
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$18.jsx)("ul", {
					className: "tencent-lexiang-list__body",
					children: files.map((file) => {
						const checked = selectedIds.has(file.id);
						return /* @__PURE__ */ (0, import_jsx_runtime$18.jsxs)("li", {
							role: "row",
							className: `tencent-lexiang-list__row${checked ? " is-selected" : ""}`,
							onClick: () => openPreview(file),
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime$18.jsx)("span", {
									className: "tencent-lexiang-list__checkbox",
									onClick: (e) => e.stopPropagation(),
									children: /* @__PURE__ */ (0, import_jsx_runtime$18.jsx)(Checkbox$1, {
										size: "medium",
										checked,
										onChange: () => toggleSelected(file.id),
										"aria-label": file.title
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime$18.jsxs)("span", {
									className: "tencent-lexiang-list__col tencent-lexiang-list__col--name",
									role: "cell",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime$18.jsx)("span", {
											className: "tencent-lexiang-list__file-icon",
											"aria-hidden": "true",
											children: /* @__PURE__ */ (0, import_jsx_runtime$18.jsx)(LexiangFileTypeIcon, {
												type: file.type,
												extension: file.extension,
												isFolder: file.is_folder,
												size: 16,
												onlineDocSize: 20
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime$18.jsx)("span", {
											className: "tencent-lexiang-list__name",
											title: file.title,
											children: file.title
										}),
										/* @__PURE__ */ (0, import_jsx_runtime$18.jsx)(Tooltip$1, {
											content: t("tencentLexiang.list.addSingleToTask"),
											children: /* @__PURE__ */ (0, import_jsx_runtime$18.jsx)(IconButton, {
												size: "small",
												"aria-label": t("tencentLexiang.list.addSingleToTask"),
												className: "tencent-lexiang-list__spark",
												onClick: (e) => {
													e.stopPropagation();
													addFileToTask(file, "spark_icon");
												},
												children: /* @__PURE__ */ (0, import_jsx_runtime$18.jsx)(AddToChatIcon, { size: 16 })
											})
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime$18.jsx)("span", {
									className: "tencent-lexiang-list__col tencent-lexiang-list__col--owner",
									role: "cell",
									children: file.owner.name
								}),
								/* @__PURE__ */ (0, import_jsx_runtime$18.jsx)("span", {
									className: "tencent-lexiang-list__col tencent-lexiang-list__col--time",
									role: "cell",
									children: formatRelativeTime(file.updated_at)
								})
							]
						}, file.id);
					})
				}),
				expanding ? /* @__PURE__ */ (0, import_jsx_runtime$18.jsx)("div", {
					className: "tencent-lexiang-list__loading",
					"aria-live": "polite",
					children: t("common.loading")
				}) : null,
				partialError && !expanding ? /* @__PURE__ */ (0, import_jsx_runtime$18.jsx)("div", {
					className: "tencent-lexiang-list__partial-error",
					style: {
						padding: "8px 12px",
						fontSize: "12px",
						color: "var(--cb-warning, #e6a700)",
						textAlign: "center"
					},
					"aria-live": "polite",
					children: partialError
				}) : null
			]
		});
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/preview-modal/index.tsx
/** 获取拖拽最大宽度：与 tencent-lexiang-panel 容器宽度一致，找不到时回退到视口 92% */
function getMaxDragWidth() {
	const panel = document.querySelector(".tencent-lexiang-panel");
	if (panel) return panel.getBoundingClientRect().width;
	return window.innerWidth * .92;
}
var import_react$19, import_react_dom, import_jsx_runtime$17, PreviewModal;
var init_preview_modal = __esmMin((() => {
	init_src$1();
	init_src();
	init_lucide_react();
	import_react$19 = /* @__PURE__ */ __toESM(require_react());
	import_react_dom = /* @__PURE__ */ __toESM(require_react_dom());
	init_contexts();
	init_useI18n();
	init_api();
	init_constants();
	init_use_lexiang_add_to_task();
	init_store();
	init_lexiang_file_type_icon();
	init_ui_icons();
	import_jsx_runtime$17 = require_jsx_runtime();
	PreviewModal = () => {
		const t = useTranslation();
		const adapter = useAdapter();
		const show = useTencentLexiangStore((s) => s.showPreview);
		const file = useTencentLexiangStore((s) => s.previewFile);
		const drawerMode = useTencentLexiangStore((s) => s.drawerMode);
		const createType = useTencentLexiangStore((s) => s.drawerCreateType);
		const createdEntryId = useTencentLexiangStore((s) => s.drawerCreatedEntryId);
		const closePreview = useTencentLexiangStore((s) => s.closePreview);
		const currentKb = useTencentLexiangStore((s) => s.currentKnowledgeBase);
		const { addPreviewFileToTask } = useLexiangAddToTask();
		const [iframeUrl, setIframeUrl] = (0, import_react$19.useState)("");
		const [loadingUrl, setLoadingUrl] = (0, import_react$19.useState)(false);
		const [urlError, setUrlError] = (0, import_react$19.useState)(null);
		const openTimeRef = (0, import_react$19.useRef)(0);
		const [mounted, setMounted] = (0, import_react$19.useState)(false);
		const [animating, setAnimating] = (0, import_react$19.useState)(false);
		const [panelWidth, setPanelWidth] = (0, import_react$19.useState)(null);
		const [isFullscreen, setIsFullscreen] = (0, import_react$19.useState)(false);
		const [isDragging, setIsDragging] = (0, import_react$19.useState)(false);
		const isDraggingRef = (0, import_react$19.useRef)(false);
		const dragStartXRef = (0, import_react$19.useRef)(0);
		const dragStartWidthRef = (0, import_react$19.useRef)(0);
		const panelRef = (0, import_react$19.useRef)(null);
		const adapterRef = (0, import_react$19.useRef)(adapter);
		(0, import_react$19.useEffect)(() => {
			adapterRef.current = adapter;
		}, [adapter]);
		/**
		* 把 createEntry 抛出的错误转换为用户可见的提示文案。
		*
		* 与 CreateKnowledgePopover 内的同名函数规则一致：
		* - forbidden / rateLimit / network：固定友好文案
		* - server：带 bizCode
		* - generic：优先使用后端 bizMessage，否则退回静态"创建失败"
		*/
		const describeCreateError = (0, import_react$19.useCallback)((detail) => {
			switch (detail.kind) {
				case "forbidden": return t("tencentLexiang.createEntry.failed.forbidden");
				case "rateLimit": return t("tencentLexiang.createEntry.failed.rateLimit");
				case "network": return t("tencentLexiang.createEntry.failed.network");
				case "server": return t("tencentLexiang.createEntry.failed.server", { bizCode: detail.bizCode ?? "" });
				default: return t("tencentLexiang.createEntry.failed.generic", { reason: detail.bizMessage || t("tencentLexiang.preview.createFailed") });
			}
		}, [t]);
		/**
		* 关闭抽屉：
		* - 'preview' 模式追加 duration_ms 埋点；关闭时触发一次静默刷新，
		*   以便抽屉内可能发生的标题/内容修改回写到列表（不出现骨架屏）。
		* - 'edit' 模式本期不上报耗时；关闭时同样触发静默刷新。
		*/
		const handleClose = (0, import_react$19.useCallback)(() => {
			openTimeRef.current = 0;
			if (drawerMode === "preview" || drawerMode === "edit") tencentLexiangStore.getState().bumpFileListVersion();
			closePreview();
		}, [
			drawerMode,
			file,
			closePreview
		]);
		/**
		* 'edit' 模式（新建文档 / 智能表格后打开的可编辑抽屉）下的目标文件。
		*
		* 该模式没有 `store.previewFile`（条目是刚由 CreateKnowledgePopover 创建的），
		* 只有 `drawerCreatedEntryId` + `drawerCreateType`，因此这里按已知信息补一个
		* 最小可用的 `LexiangFile`：
		* - `title` 取新建时用的默认名（与 `useLexiangCreateEntry` 传给后端的 `name` 一致），
		*   仅作为反查失败时的兜底；真实标题由 `addPreviewFileToTask` 反查覆盖。
		* - `parent_id` 取 `currentKb.rootEntryId` —— 新建条目正是建在知识库根目录下
		*   （见 `useLexiangCreateEntry` 的 `parentEntryId: rootEntryId`），
		*   缺了它 `resolveFreshLexiangEntryTitle` 会直接回落快照标题。
		* - `createType` 只可能是 `'doc' | 'sheet'`（`'folder'` 不开抽屉，直接创建后刷新列表），
		*   两者都是合法的 `LexiangFileType`，可直接作为 `type` 使用。
		*/
		const createdFile = (0, import_react$19.useMemo)(() => {
			if (drawerMode !== "edit" || !createType || !createdEntryId || createType === "folder") return null;
			return {
				id: createdEntryId,
				title: t(`tencentLexiang.newDoc.${createType}`),
				type: createType,
				is_folder: false,
				owner: { name: "" },
				updated_at: Date.now(),
				parent_id: currentKb?.rootEntryId
			};
		}, [
			drawerMode,
			createType,
			createdEntryId,
			currentKb?.rootEntryId,
			t
		]);
		/** 当前抽屉可被「添加到任务」的目标文件（preview 用快照，edit 用新建条目） */
		const addToTaskTarget = drawerMode === "preview" ? file : createdFile;
		/**
		* 抽屉右上角「添加到任务」。
		*
		* 背景：native 模式（个人版 / 微信登录 / OneID 未开通）下抽屉壳是我们自绘的，
		* 乐享 iframe 内部那套"添加到任务"入口拿不到，导致这些用户在单个文件预览页
		* 和新建后的可编辑页都没有添加到任务的入口（企业版走 iframe 模式则由乐享页面自带）。
		*
		* 交互：先关闭抽屉再注入，避免 `addFileToTask` 跳转到新建任务后抽屉遮罩仍悬在上层。
		*
		* ⚠️ 标题保鲜（issue #87858 同类问题）：目标文件是打开抽屉那一刻的快照，用户可以
		* 在 iframe 内的乐享站点里直接改标题（跨域，renderer 收不到通知），直接注入会把
		* 旧标题写进输入框 chip。`addPreviewFileToTask` 内部会先反查最新标题，
		* 失败 / 超时自动回落快照标题，不阻塞跳转。'edit' 模式尤其依赖这一步 ——
		* 快照标题只是「智能文档」这类默认名。
		*/
		const handleAddToTask = (0, import_react$19.useCallback)(() => {
			if (!addToTaskTarget) return;
			handleClose();
			addPreviewFileToTask(addToTaskTarget, drawerMode === "edit" ? "create_drawer" : "preview_header");
		}, [
			addToTaskTarget,
			drawerMode,
			handleClose,
			addPreviewFileToTask
		]);
		(0, import_react$19.useEffect)(() => {
			if (show) {
				setMounted(true);
				requestAnimationFrame(() => {
					requestAnimationFrame(() => {
						setAnimating(true);
					});
				});
			} else {
				setAnimating(false);
				const timer = setTimeout(() => {
					setMounted(false);
					setPanelWidth(null);
					setIsFullscreen(false);
				}, 200);
				return () => clearTimeout(timer);
			}
		}, [show]);
		(0, import_react$19.useEffect)(() => {
			if (!show) return;
			const handleKey = (e) => {
				if (e.key === "Escape") if (isFullscreen) setIsFullscreen(false);
				else handleClose();
			};
			document.addEventListener("keydown", handleKey);
			return () => document.removeEventListener("keydown", handleKey);
		}, [
			show,
			handleClose,
			isFullscreen
		]);
		const [retryTick, setRetryTick] = (0, import_react$19.useState)(0);
		const handleRetryLoad = (0, import_react$19.useCallback)(() => {
			setRetryTick((v) => v + 1);
		}, []);
		(0, import_react$19.useEffect)(() => {
			if (!show) {
				setIframeUrl("");
				setLoadingUrl(false);
				setUrlError(null);
				return;
			}
			let cancelled = false;
			openTimeRef.current = performance.now();
			setIframeUrl("");
			setLoadingUrl(true);
			setUrlError(null);
			const loadPreview = async () => {
				if (drawerMode === "preview" && file) {
					const url = await getLexiangPreviewEmbedUrl(adapterRef.current, file);
					if (cancelled) return;
					setIframeUrl(url);
					setLoadingUrl(false);
					try {
						adapterRef.current?.reportTelemetry?.("web_element_click", {
							pageName: "lexiang",
							elementId: "lexiang_lib_file_open",
							elementName: "文件点击预览",
							source: file.type ?? "",
							type: file.extension ?? "",
							mode: "lexiang"
						});
					} catch {}
					return;
				}
				if (drawerMode === "edit" && createType) {
					if (!createdEntryId) throw new Error("[PreviewModal] edit 模式缺少 drawerCreatedEntryId，无法拼 URL");
					const intendUrl = buildLexiangPageUrl(createdEntryId);
					const loginUrl = await fetchLexiangTempLoginUrl(adapterRef.current, {
						intendUrl,
						mode: "native"
					});
					if (cancelled) return;
					setIframeUrl(loginUrl);
					setLoadingUrl(false);
				}
			};
			loadPreview().catch((err) => {
				if (cancelled) return;
				console.error("[PreviewModal] load iframe url failed:", err);
				if (drawerMode === "edit") {
					const friendly = describeCreateError(classifyCreateEntryError(err));
					setUrlError(friendly);
					toast.error(friendly, { duration: 3e3 });
				} else setUrlError(err?.message ?? "iframe_url_failed");
				setLoadingUrl(false);
			});
			return () => {
				cancelled = true;
			};
		}, [
			show,
			drawerMode,
			file?.id,
			createType,
			createdEntryId,
			t,
			describeCreateError,
			retryTick
		]);
		const handleResizeStart = (0, import_react$19.useCallback)((e) => {
			e.preventDefault();
			e.stopPropagation();
			isDraggingRef.current = true;
			setIsDragging(true);
			dragStartXRef.current = e.clientX;
			if (panelRef.current) dragStartWidthRef.current = panelRef.current.getBoundingClientRect().width;
			else dragStartWidthRef.current = panelWidth ?? window.innerWidth * 55 / 100;
			document.body.style.cursor = "col-resize";
			document.body.style.userSelect = "none";
		}, [panelWidth]);
		(0, import_react$19.useEffect)(() => {
			const handleMouseMove = (e) => {
				if (!isDraggingRef.current) return;
				const delta = dragStartXRef.current - e.clientX;
				const maxWidth = getMaxDragWidth();
				setPanelWidth(Math.max(300, Math.min(maxWidth, dragStartWidthRef.current + delta)));
			};
			const handleMouseUp = () => {
				if (!isDraggingRef.current) return;
				isDraggingRef.current = false;
				setIsDragging(false);
				document.body.style.cursor = "";
				document.body.style.userSelect = "";
			};
			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handleMouseUp);
			return () => {
				document.removeEventListener("mousemove", handleMouseMove);
				document.removeEventListener("mouseup", handleMouseUp);
			};
		}, []);
		const toggleFullscreen = (0, import_react$19.useCallback)(() => {
			setIsFullscreen((prev) => !prev);
		}, []);
		const handleOverlayClick = (0, import_react$19.useCallback)((e) => {
			if (e.target === e.currentTarget) handleClose();
		}, [handleClose]);
		const header = (0, import_react$19.useMemo)(() => {
			if (drawerMode === "edit" && createType) return { title: t(`tencentLexiang.newDoc.${createType}`) };
			if (drawerMode === "preview" && file) return { title: file.title };
			return null;
		}, [
			drawerMode,
			createType,
			file,
			t
		]);
		if (!mounted || !header) return null;
		const iframeSrc = iframeUrl || "about:blank";
		const loadingLabel = drawerMode === "edit" ? t("tencentLexiang.preview.creating") : t("common.loading");
		const fallbackErrorLabel = drawerMode === "edit" ? t("tencentLexiang.preview.createFailed") : t("tencentLexiang.preview.loadFailed");
		const displayErrorLabel = drawerMode === "edit" ? urlError ?? fallbackErrorLabel : fallbackErrorLabel;
		const panelStyle = isFullscreen ? {
			width: "100vw",
			top: 28
		} : panelWidth != null ? { width: panelWidth } : {};
		return (0, import_react_dom.createPortal)(/* @__PURE__ */ (0, import_jsx_runtime$17.jsx)("div", {
			className: [
				"tencent-lexiang-preview__overlay",
				animating && "tencent-lexiang-preview__overlay--open",
				isFullscreen && "tencent-lexiang-preview__overlay--fullscreen",
				isDragging && "tencent-lexiang-preview__overlay--dragging"
			].filter(Boolean).join(" "),
			onClick: handleOverlayClick,
			children: /* @__PURE__ */ (0, import_jsx_runtime$17.jsxs)("div", {
				ref: panelRef,
				className: [
					"tencent-lexiang-preview__modal",
					animating && "tencent-lexiang-preview__modal--open",
					isFullscreen && "tencent-lexiang-preview__modal--fullscreen"
				].filter(Boolean).join(" "),
				style: panelStyle,
				role: "dialog",
				"aria-modal": "true",
				"aria-label": header.title,
				children: [
					!isFullscreen && /* @__PURE__ */ (0, import_jsx_runtime$17.jsx)("div", {
						className: "tencent-lexiang-preview__resize-handle",
						onMouseDown: handleResizeStart
					}),
					/* @__PURE__ */ (0, import_jsx_runtime$17.jsxs)("header", {
						className: "tencent-lexiang-preview__header",
						children: [/* @__PURE__ */ (0, import_jsx_runtime$17.jsxs)("div", {
							className: "tencent-lexiang-preview__title-row",
							children: [
								drawerMode === "preview" && file && /* @__PURE__ */ (0, import_jsx_runtime$17.jsx)(LexiangFileTypeIcon, {
									type: file.type,
									extension: file.extension,
									isFolder: file.is_folder,
									size: 20
								}),
								drawerMode === "edit" && createType && /* @__PURE__ */ (0, import_jsx_runtime$17.jsx)(LexiangFileTypeIcon, {
									type: createType,
									isFolder: createType === "folder",
									size: 20
								}),
								/* @__PURE__ */ (0, import_jsx_runtime$17.jsx)("span", {
									className: "tencent-lexiang-preview__title",
									title: header.title,
									children: header.title
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime$17.jsxs)("div", {
							className: "tencent-lexiang-preview__header-actions",
							children: [
								addToTaskTarget && /* @__PURE__ */ (0, import_jsx_runtime$17.jsx)(Button, {
									variant: "primary",
									className: "tencent-lexiang-preview__add-task-btn",
									leftIcon: /* @__PURE__ */ (0, import_jsx_runtime$17.jsx)(AddToChatIcon, { size: 16 }),
									onClick: handleAddToTask,
									title: t("tencentLexiang.list.addSingleToTask"),
									children: t("tencentLexiang.list.addSingleToTask")
								}),
								/* @__PURE__ */ (0, import_jsx_runtime$17.jsx)("button", {
									className: "tencent-lexiang-preview__fullscreen-btn",
									onClick: toggleFullscreen,
									type: "button",
									"aria-label": isFullscreen ? t("tencentLexiang.preview.exitFullscreen") : t("tencentLexiang.preview.fullscreen"),
									title: isFullscreen ? t("tencentLexiang.preview.exitFullscreen") : t("tencentLexiang.preview.fullscreen"),
									children: isFullscreen ? /* @__PURE__ */ (0, import_jsx_runtime$17.jsx)(Minimize2, { size: 14 }) : /* @__PURE__ */ (0, import_jsx_runtime$17.jsx)(Maximize2, { size: 14 })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime$17.jsx)("button", {
									className: "tencent-lexiang-preview__close-btn",
									onClick: handleClose,
									type: "button",
									"aria-label": t("tencentLexiang.preview.close"),
									children: /* @__PURE__ */ (0, import_jsx_runtime$17.jsx)(X, { size: 16 })
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime$17.jsx)("div", {
						className: "tencent-lexiang-preview__body",
						children: loadingUrl ? /* @__PURE__ */ (0, import_jsx_runtime$17.jsx)("div", {
							className: "tencent-lexiang-preview__status",
							children: loadingLabel
						}) : urlError ? /* @__PURE__ */ (0, import_jsx_runtime$17.jsxs)("div", {
							className: "tencent-lexiang-preview__status tencent-lexiang-preview__status--error",
							children: [/* @__PURE__ */ (0, import_jsx_runtime$17.jsx)("span", { children: displayErrorLabel }), /* @__PURE__ */ (0, import_jsx_runtime$17.jsx)("button", {
								type: "button",
								className: "tencent-lexiang-preview__retry-btn",
								onClick: handleRetryLoad,
								children: t("common.retry") || "重试"
							})]
						}) : /* @__PURE__ */ (0, import_jsx_runtime$17.jsx)("iframe", {
							className: "tencent-lexiang-preview__iframe",
							src: iframeSrc,
							title: header.title,
							sandbox: LEXIANG_IFRAME_SANDBOX,
							allow: "clipboard-read; clipboard-write; fullscreen"
						})
					})
				]
			})
		}), document.body);
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/selection-action-bar/index.tsx
var import_react$18, import_jsx_runtime$16, SelectionActionBar;
var init_selection_action_bar = __esmMin((() => {
	init_src$1();
	import_react$18 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_use_lexiang_add_to_task();
	init_store();
	init_ui_icons();
	import_jsx_runtime$16 = require_jsx_runtime();
	SelectionActionBar = () => {
		const t = useTranslation();
		const selectedIds = useTencentLexiangStore((s) => s.selectedIds);
		const fileRegistry = useTencentLexiangStore((s) => s.fileRegistry);
		const { addFilesToTask } = useLexiangAddToTask();
		const count = selectedIds.size;
		const selectedFiles = (0, import_react$18.useMemo)(() => {
			if (count === 0 || fileRegistry.size === 0) return [];
			const result = [];
			selectedIds.forEach((id) => {
				const file = fileRegistry.get(id);
				if (file) result.push(file);
			});
			return result;
		}, [
			selectedIds,
			fileRegistry,
			count
		]);
		if (count < 1) return null;
		const handleAddToTask = () => {
			if (selectedFiles.length === 0) return;
			addFilesToTask(selectedFiles, "selection_bar");
		};
		return /* @__PURE__ */ (0, import_jsx_runtime$16.jsxs)("div", {
			className: "tencent-lexiang-selection-bar",
			role: "toolbar",
			children: [/* @__PURE__ */ (0, import_jsx_runtime$16.jsx)("span", {
				className: "tencent-lexiang-selection-bar__count",
				children: t("tencentLexiang.selection.selectedCount", { count })
			}), /* @__PURE__ */ (0, import_jsx_runtime$16.jsxs)(Button$1, {
				variant: "outline",
				size: "small",
				className: "tencent-lexiang-selection-bar__add-btn",
				onClick: handleAddToTask,
				children: [/* @__PURE__ */ (0, import_jsx_runtime$16.jsx)(AddToChatIcon, { size: 16 }), t("tencentLexiang.selection.addToTask")]
			})]
		});
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/pages/space-detail/components/space-info-card/space-info-card.less
var init_space_info_card$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/create-knowledge-popover/create-knowledge-popover.less
var init_create_knowledge_popover$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/iwiki-import/iwiki-import.less
var init_iwiki_import$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/api/import-task-service.ts
/**
* 创建导入任务。
* @returns task_id
*/
async function createImportTask(params) {
	const taskId = unwrapData(await callSpApi({
		method: "POST",
		path: "/spapi/kb/import/v1/tasks",
		body: {
			type: params.type,
			parent_entry_id: params.parentEntryId,
			space_id: params.spaceId,
			files: params.files,
			dry_run: params.dryRun ?? false
		}
	}))?.task_id;
	if (!taskId) throw new Error("创建导入任务失败：缺少 task_id");
	return taskId;
}
/**
* 查询单次导入任务状态。
*/
async function queryImportTask(taskId) {
	return unwrapData(await callSpApi({
		method: "GET",
		path: `/spapi/kb/import/v1/tasks/${taskId}`
	})) ?? null;
}
/**
* 创建导入任务并轮询至完成。
*
* @param params 导入任务参数
* @param options.timeoutMessage 超时提示文案
* @param options.failedMessage  失败兜底提示文案（服务端未返回 err_message 时使用）
* @returns resolve 表示导入成功（返回最终任务数据）；reject 抛错（失败原因 / 超时）
*/
async function runImportTask(params, options) {
	const signal = options?.signal;
	const taskId = await createImportTask(params);
	const sleep = (ms) => new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
	for (let i = 0; i < IMPORT_POLL_MAX_TIMES; i++) {
		if (signal?.aborted) throw signal.reason ?? new DOMException("Import task aborted", "AbortError");
		const task = await queryImportTask(taskId);
		const status = task?.status;
		if (status === "succeed") return task;
		if (status === "failed" || status === "canceled") throw new Error(task?.err_message || options?.failedMessage || "导入失败");
		await sleep(IMPORT_POLL_INTERVAL_MS);
	}
	throw new Error(options?.timeoutMessage || "导入超时，请稍后在乐享查看导入结果");
}
var IMPORT_POLL_INTERVAL_MS, IMPORT_POLL_MAX_TIMES;
var init_import_task_service = __esmMin((() => {
	init_spapi_client();
	IMPORT_POLL_INTERVAL_MS = 3e3;
	IMPORT_POLL_MAX_TIMES = 200;
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/api/iwiki-service.ts
/** 判断链接是否为合法 iWiki host 前缀 */
function isIwikiLink(link) {
	const trimmed = link.trim();
	return trimmed.startsWith("https://iwiki.woa.com") || trimmed.startsWith("https://iwiki-test.woa.com");
}
/**
* 解析 iWiki 链接，支持两种合法格式：
* - 文档/节点链接：{host}/p/{nodeId}    → parent_id
* - 空间链接：    {host}/space/{spaceId} → space_id
*/
function parseIwikiLink(link) {
	const pageMatch = link.match(/\/p\/([^/?#]+)/);
	if (pageMatch) return { parent_id: pageMatch[1] };
	const spaceMatch = link.match(/\/space\/([^/?#]+)/);
	if (spaceMatch) return { space_id: spaceMatch[1] };
	return {};
}
/** iWiki 仅 page、folder 类型可选，其它一律禁用（对齐 shield formatNode） */
function isIwikiNodeSelectable(displayIcon) {
	return ["page", "folder"].includes(displayIcon ?? "");
}
function formatIwikiNode(node) {
	return {
		id: node.id,
		title: node.title,
		hasChild: !!node.has_child,
		displayIcon: node.display_icon ?? "",
		disabled: !isIwikiNodeSelectable(node.display_icon)
	};
}
/**
* 列 iWiki 目录（或某节点的子节点）。
* POST /spapi/connector/iwiki/v1/nodes
*/
async function fetchIwikiNodes(params) {
	const data = unwrapData(await callSpApi({
		method: "POST",
		path: "/spapi/connector/iwiki/v1/nodes",
		body: {
			parent_id: params.parentId,
			space_id: params.spaceId,
			page_token: params.pageToken,
			limit: params.limit ?? 50
		}
	}));
	return {
		nodes: (data?.nodes ?? []).map(formatIwikiNode),
		nextPageToken: data?.next_page_token,
		hasMore: !!data?.has_more,
		currentNode: data?.current_node ? formatIwikiNode(data.current_node) : void 0
	};
}
/**
* iWiki 导入预检查（dry_run）。
*
* 对齐 shield useThirdPartyImportWithDryRun：正式导入前先以 dry_run 方式发起任务，
* 拿到 special_num（将被覆盖更新的文档数），由调用方决定是否弹"覆盖更新"确认。
*/
async function dryRunIwikiImport(params) {
	const task = await runImportTask({
		type: "iwiki",
		parentEntryId: params.parentEntryId,
		spaceId: params.spaceId,
		files: params.files.map((f) => ({
			id: f.id,
			include_subpages: f.includeSubpages
		})),
		dryRun: true
	}, {
		failedMessage: "iWiki 文档导入预检查失败",
		timeoutMessage: "iWiki 文档导入预检查超时，请稍后重试",
		signal: params.signal
	});
	return {
		totalNum: task.total_num ?? params.files.length,
		specialNum: task.dry_run_stats?.special_num ?? 0
	};
}
/**
* 发起 iWiki 正式导入并轮询至完成（复用通用 import-task-service）。
*
* @returns resolve 表示导入成功；reject 抛错（失败原因 / 超时）
*/
async function importIwikiDocsAndWait(params) {
	await runImportTask({
		type: "iwiki",
		parentEntryId: params.parentEntryId,
		spaceId: params.spaceId,
		files: params.files.map((f) => ({
			id: f.id,
			include_subpages: f.includeSubpages
		}))
	}, {
		failedMessage: "iWiki 文档导入失败",
		timeoutMessage: "iWiki 文档导入超时，请稍后在乐享查看导入结果",
		signal: params.signal
	});
}
var init_iwiki_service = __esmMin((() => {
	init_import_task_service();
	init_spapi_client();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/iwiki-import/iwiki-doc-tree.tsx
var import_react$17, import_jsx_runtime$15, IwikiDocTree;
var init_iwiki_doc_tree = __esmMin((() => {
	init_src();
	import_react$17 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_iwiki_service();
	import_jsx_runtime$15 = require_jsx_runtime();
	IwikiDocTree = ({ parentId, spaceId, onChange }) => {
		const t = useTranslation();
		const [nodeMap, setNodeMap] = (0, import_react$17.useState)({});
		const [rootIds, setRootIds] = (0, import_react$17.useState)([]);
		const [checkedIds, setCheckedIds] = (0, import_react$17.useState)(/* @__PURE__ */ new Set());
		const [rootLoading, setRootLoading] = (0, import_react$17.useState)(false);
		const [rootError, setRootError] = (0, import_react$17.useState)(false);
		const makeNode = (n, depth, extra) => ({
			...n,
			depth,
			expanded: false,
			loaded: false,
			loading: false,
			childIds: [],
			lockedByParent: false,
			...extra
		});
		(0, import_react$17.useEffect)(() => {
			let cancelled = false;
			setRootLoading(true);
			setRootError(false);
			setNodeMap({});
			setRootIds([]);
			setCheckedIds(/* @__PURE__ */ new Set());
			fetchIwikiNodes({
				parentId,
				spaceId
			}).then((res) => {
				if (cancelled) return;
				const map = {};
				if (res.currentNode) {
					const rootNode = res.currentNode;
					map[rootNode.id] = makeNode(rootNode, 0, {
						hasChild: res.nodes.length > 0,
						expanded: false,
						loaded: false,
						childIds: []
					});
					setNodeMap(map);
					setRootIds([rootNode.id]);
					return;
				}
				res.nodes.forEach((n) => {
					map[n.id] = makeNode(n, 0);
				});
				setNodeMap(map);
				setRootIds(res.nodes.map((n) => n.id));
			}).catch(() => {
				if (!cancelled) setRootError(true);
			}).finally(() => {
				if (!cancelled) setRootLoading(false);
			});
			return () => {
				cancelled = true;
			};
		}, [parentId, spaceId]);
		(0, import_react$17.useEffect)(() => {
			const files = [];
			checkedIds.forEach((id) => {
				const node = nodeMap[id];
				if (!node || node.disabled || node.lockedByParent) return;
				files.push({
					id,
					includeSubpages: node.hasChild
				});
			});
			onChange(files);
		}, [
			checkedIds,
			nodeMap,
			onChange
		]);
		const loadChildren = (0, import_react$17.useCallback)(async (node) => {
			setNodeMap((prev) => ({
				...prev,
				[node.id]: {
					...prev[node.id],
					loading: true
				}
			}));
			try {
				const res = await fetchIwikiNodes({
					parentId: node.id,
					spaceId
				});
				const parentChecked = checkedIds.has(node.id);
				setNodeMap((prev) => {
					const next = { ...prev };
					res.nodes.forEach((n) => {
						next[n.id] = makeNode(n, node.depth + 1, { lockedByParent: parentChecked });
					});
					next[node.id] = {
						...next[node.id],
						loading: false,
						loaded: true,
						childIds: res.nodes.map((n) => n.id)
					};
					return next;
				});
				if (parentChecked) setCheckedIds((prev) => {
					const nextSet = new Set(prev);
					res.nodes.forEach((n) => nextSet.add(n.id));
					return nextSet;
				});
			} catch {
				setNodeMap((prev) => ({
					...prev,
					[node.id]: {
						...prev[node.id],
						loading: false
					}
				}));
			}
		}, [spaceId, checkedIds]);
		const handleToggleExpand = (0, import_react$17.useCallback)((node) => {
			if (!node.hasChild) return;
			if (!node.loaded && !node.expanded) loadChildren(node).catch(() => void 0);
			setNodeMap((prev) => ({
				...prev,
				[node.id]: {
					...prev[node.id],
					expanded: !prev[node.id].expanded
				}
			}));
		}, [loadChildren]);
		const collectLoadedDescendants = (0, import_react$17.useCallback)((rootId, map) => {
			const acc = [];
			const walk = (id) => {
				const n = map[id];
				if (!n) return;
				n.childIds.forEach((cid) => {
					acc.push(cid);
					walk(cid);
				});
			};
			walk(rootId);
			return acc;
		}, []);
		const handleToggleCheck = (0, import_react$17.useCallback)((node, checked) => {
			const descendants = collectLoadedDescendants(node.id, nodeMap);
			setNodeMap((prev) => {
				const next = { ...prev };
				descendants.forEach((id) => {
					if (next[id]) next[id] = {
						...next[id],
						lockedByParent: checked
					};
				});
				return next;
			});
			setCheckedIds((prev) => {
				const nextSet = new Set(prev);
				if (checked) {
					nextSet.add(node.id);
					descendants.forEach((id) => nextSet.add(id));
				} else {
					nextSet.delete(node.id);
					descendants.forEach((id) => nextSet.delete(id));
				}
				return nextSet;
			});
		}, [collectLoadedDescendants, nodeMap]);
		const renderNode = (id) => {
			const node = nodeMap[id];
			if (!node) return null;
			const isChecked = checkedIds.has(id);
			return /* @__PURE__ */ (0, import_jsx_runtime$15.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime$15.jsxs)("div", {
				className: "tencent-lexiang-iwiki-tree__row",
				style: { paddingLeft: 8 + node.depth * 20 },
				children: [/* @__PURE__ */ (0, import_jsx_runtime$15.jsx)("span", {
					className: [
						"tencent-lexiang-iwiki-tree__expander",
						node.hasChild ? "tencent-lexiang-iwiki-tree__expander--clickable" : "",
						node.expanded ? "tencent-lexiang-iwiki-tree__expander--expanded" : ""
					].filter(Boolean).join(" "),
					onClick: () => handleToggleExpand(node),
					role: node.hasChild ? "button" : void 0,
					"aria-label": node.hasChild ? node.expanded ? "collapse" : "expand" : void 0,
					children: node.hasChild && (node.loading ? /* @__PURE__ */ (0, import_jsx_runtime$15.jsx)(Loading, { size: "small" }) : /* @__PURE__ */ (0, import_jsx_runtime$15.jsx)(ChevronRightIcon, {
						width: 14,
						height: 14
					}))
				}), /* @__PURE__ */ (0, import_jsx_runtime$15.jsx)(Checkbox, {
					size: "small",
					checked: isChecked,
					disabled: node.disabled || node.lockedByParent,
					onChange: (e) => handleToggleCheck(node, e.target.checked),
					label: node.title
				})]
			}), node.expanded && node.childIds.map((childId) => renderNode(childId))] }, id);
		};
		if (rootLoading) return /* @__PURE__ */ (0, import_jsx_runtime$15.jsx)("div", {
			className: "tencent-lexiang-iwiki-tree__status",
			children: /* @__PURE__ */ (0, import_jsx_runtime$15.jsx)(Loading, { size: "medium" })
		});
		if (rootError) return /* @__PURE__ */ (0, import_jsx_runtime$15.jsx)("div", {
			className: "tencent-lexiang-iwiki-tree__status",
			children: t("tencentLexiang.import.iwiki.loadError")
		});
		if (rootIds.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime$15.jsx)("div", {
			className: "tencent-lexiang-iwiki-tree__status",
			children: t("tencentLexiang.import.iwiki.empty")
		});
		return /* @__PURE__ */ (0, import_jsx_runtime$15.jsx)("div", {
			className: "tencent-lexiang-iwiki-tree",
			children: rootIds.map((id) => renderNode(id))
		});
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/iwiki-import/iwiki-doc-selector.tsx
var import_react$16, import_jsx_runtime$14, IwikiDocSelector;
var init_iwiki_doc_selector = __esmMin((() => {
	init_src();
	import_react$16 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_iwiki_service();
	init_iwiki_doc_tree();
	import_jsx_runtime$14 = require_jsx_runtime();
	IwikiDocSelector = ({ open, onOpenChange, entry, checking, importing, onConfirm, onCancel }) => {
		const t = useTranslation();
		const [checkedFiles, setCheckedFiles] = (0, import_react$16.useState)([]);
		const busy = checking || importing;
		const handleTreeChange = (0, import_react$16.useCallback)((files) => {
			setCheckedFiles(files);
		}, []);
		const handleConfirm = (0, import_react$16.useCallback)(() => {
			if (checkedFiles.length === 0 || busy) return;
			onConfirm(checkedFiles);
		}, [
			checkedFiles,
			busy,
			onConfirm
		]);
		return /* @__PURE__ */ (0, import_jsx_runtime$14.jsx)(Modal, {
			open,
			onOpenChange: (next) => {
				if (busy) return;
				onOpenChange(next);
			},
			title: t("tencentLexiang.import.iwiki.selectTitle"),
			description: t("tencentLexiang.import.iwiki.selectSubtitle"),
			size: "medium-large",
			footer: /* @__PURE__ */ (0, import_jsx_runtime$14.jsxs)("div", {
				className: "tencent-lexiang-iwiki-selector-footer",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$14.jsx)("span", {
					className: "tencent-lexiang-iwiki-selector-max-tip",
					children: t("tencentLexiang.import.iwiki.maxTip", { max: 500 })
				}), /* @__PURE__ */ (0, import_jsx_runtime$14.jsxs)("div", {
					className: "tencent-lexiang-iwiki-selector-actions",
					children: [/* @__PURE__ */ (0, import_jsx_runtime$14.jsx)(Button, {
						type: "button",
						variant: "grey",
						size: "medium",
						disabled: busy,
						onClick: onCancel,
						children: t("tencentLexiang.import.iwiki.cancel")
					}), /* @__PURE__ */ (0, import_jsx_runtime$14.jsx)(Button, {
						type: "button",
						variant: "primary",
						size: "medium",
						disabled: checkedFiles.length === 0,
						loading: busy,
						onClick: handleConfirm,
						children: checking ? t("tencentLexiang.import.iwiki.checking") : importing ? t("tencentLexiang.import.iwiki.importing") : t("tencentLexiang.import.iwiki.confirm")
					})]
				})]
			}),
			children: /* @__PURE__ */ (0, import_jsx_runtime$14.jsx)("div", {
				className: "tencent-lexiang-iwiki-selector",
				children: open && /* @__PURE__ */ (0, import_jsx_runtime$14.jsx)(IwikiDocTree, {
					parentId: entry.parent_id,
					spaceId: entry.space_id,
					onChange: handleTreeChange
				})
			})
		});
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/iwiki-import/iwiki-link-dialog.tsx
var import_react$15, import_jsx_runtime$13, IwikiLinkDialog;
var init_iwiki_link_dialog = __esmMin((() => {
	init_src();
	import_react$15 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_iwiki_service();
	import_jsx_runtime$13 = require_jsx_runtime();
	IwikiLinkDialog = ({ open, onOpenChange, onNext }) => {
		const t = useTranslation();
		const [url, setUrl] = (0, import_react$15.useState)("");
		const urlValid = isIwikiLink(url.trim());
		const handleNext = (0, import_react$15.useCallback)(() => {
			const value = url.trim();
			if (!isIwikiLink(value)) return;
			const parsed = parseIwikiLink(value);
			if (!parsed.parent_id && !parsed.space_id) {
				message.error(t("tencentLexiang.import.iwiki.parseError"));
				return;
			}
			onNext({
				url: value,
				...parsed
			});
			setUrl("");
		}, [
			url,
			onNext,
			t
		]);
		return /* @__PURE__ */ (0, import_jsx_runtime$13.jsx)(Modal, {
			open,
			onOpenChange: (next) => {
				onOpenChange(next);
				if (!next) setUrl("");
			},
			title: t("tencentLexiang.import.iwiki.title"),
			size: "medium",
			footer: /* @__PURE__ */ (0, import_jsx_runtime$13.jsx)("div", {
				className: "tencent-lexiang-iwiki-link-footer",
				children: /* @__PURE__ */ (0, import_jsx_runtime$13.jsx)(Button, {
					type: "button",
					variant: "primary",
					size: "medium",
					disabled: !urlValid,
					onClick: handleNext,
					children: t("tencentLexiang.import.iwiki.next")
				})
			}),
			children: /* @__PURE__ */ (0, import_jsx_runtime$13.jsxs)("div", {
				className: "tencent-lexiang-iwiki-link-body",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$13.jsx)(Input, {
					autoFocus: true,
					value: url,
					status: url.length > 0 && !urlValid ? "error" : void 0,
					placeholder: t("tencentLexiang.import.iwiki.placeholder"),
					onChange: (e) => setUrl(e.target.value),
					onPressEnter: () => {
						if (urlValid) handleNext();
					}
				}), url.length > 0 && !urlValid && /* @__PURE__ */ (0, import_jsx_runtime$13.jsx)("div", {
					className: "tencent-lexiang-iwiki-link-error-tip",
					children: t("tencentLexiang.import.iwiki.invalidTip", { host: `https://iwiki.woa.com/p/79249073` })
				})]
			})
		});
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/iwiki-import/index.tsx
var import_react$14, import_jsx_runtime$12, IwikiImport;
var init_iwiki_import = __esmMin((() => {
	init_iwiki_import$1();
	init_src();
	import_react$14 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_iwiki_service();
	init_iwiki_doc_selector();
	init_iwiki_link_dialog();
	import_jsx_runtime$12 = require_jsx_runtime();
	IwikiImport = ({ open, onOpenChange, parentEntryId, lexiangSpaceId, onImported }) => {
		const t = useTranslation();
		const [step, setStep] = (0, import_react$14.useState)("link");
		const [entry, setEntry] = (0, import_react$14.useState)({});
		const [checking, setChecking] = (0, import_react$14.useState)(false);
		const [importing, setImporting] = (0, import_react$14.useState)(false);
		const abortRef = (0, import_react$14.useRef)(null);
		(0, import_react$14.useEffect)(() => () => {
			abortRef.current?.abort();
			abortRef.current = null;
		}, []);
		const close = (0, import_react$14.useCallback)(() => {
			onOpenChange(false);
			setStep("link");
			setEntry({});
		}, [onOpenChange]);
		const handleNext = (0, import_react$14.useCallback)((payload) => {
			setEntry({
				parent_id: payload.parent_id,
				space_id: payload.space_id
			});
			setStep("select");
		}, []);
		const doImport = (0, import_react$14.useCallback)(async (files) => {
			if (!parentEntryId) return;
			const controller = new AbortController();
			abortRef.current?.abort();
			abortRef.current = controller;
			setImporting(true);
			const closeLoading = message.loading(t("tencentLexiang.import.iwiki.importing"));
			try {
				await importIwikiDocsAndWait({
					parentEntryId,
					spaceId: lexiangSpaceId,
					files,
					signal: controller.signal
				});
				closeLoading();
				message.success(t("tencentLexiang.import.iwiki.success"), 3e3);
				close();
				onImported?.();
			} catch (err) {
				closeLoading();
				if (err instanceof DOMException && err.name === "AbortError") return;
				console.error("[lexiang-import] importIwiki failed:", err);
				const detail = err instanceof Error ? err.message : String(err);
				message.error(detail || t("tencentLexiang.import.iwiki.failed"), 3e3);
			} finally {
				if (abortRef.current === controller) abortRef.current = null;
				setImporting(false);
			}
		}, [
			parentEntryId,
			lexiangSpaceId,
			t,
			close,
			onImported
		]);
		const handleConfirm = (0, import_react$14.useCallback)(async (files) => {
			if (!parentEntryId) {
				message.error(t("tencentLexiang.import.iwiki.noTarget"));
				return;
			}
			const controller = new AbortController();
			abortRef.current?.abort();
			abortRef.current = controller;
			setChecking(true);
			try {
				const { totalNum, specialNum } = await dryRunIwikiImport({
					parentEntryId,
					spaceId: lexiangSpaceId,
					files,
					signal: controller.signal
				});
				setChecking(false);
				if (specialNum > 0) Modal.confirm({
					size: "small",
					title: t("tencentLexiang.import.iwiki.overwrite.title", { count: specialNum }),
					content: t("tencentLexiang.import.iwiki.overwrite.body", {
						total: totalNum,
						special: specialNum
					}),
					okText: t("tencentLexiang.import.iwiki.overwrite.confirm"),
					cancelText: t("tencentLexiang.import.iwiki.cancel"),
					showCancel: true,
					onOk: () => {
						doImport(files).catch(() => void 0);
					}
				});
				else doImport(files).catch(() => void 0);
			} catch (err) {
				setChecking(false);
				if (err instanceof DOMException && err.name === "AbortError") return;
				console.error("[lexiang-import] iwiki dry-run failed:", err);
				const detail = err instanceof Error ? err.message : String(err);
				message.error(detail || t("tencentLexiang.import.iwiki.failed"), 3e3);
			} finally {
				if (abortRef.current === controller) abortRef.current = null;
			}
		}, [
			parentEntryId,
			lexiangSpaceId,
			t,
			doImport
		]);
		return /* @__PURE__ */ (0, import_jsx_runtime$12.jsxs)(import_jsx_runtime$12.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime$12.jsx)(IwikiLinkDialog, {
			open: open && step === "link",
			onOpenChange: (next) => {
				if (!next) close();
			},
			onNext: handleNext
		}), /* @__PURE__ */ (0, import_jsx_runtime$12.jsx)(IwikiDocSelector, {
			open: open && step === "select",
			onOpenChange: (next) => {
				if (!next) close();
			},
			entry,
			checking,
			importing,
			onConfirm: handleConfirm,
			onCancel: close
		})] });
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/wechat-import/wechat-import.less
var init_wechat_import$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/api/wechat-import-service.ts
/** 判断链接是否为合法公众号文章 host */
function isWechatArticleLink(link) {
	try {
		const url = new URL(link.trim());
		return url.protocol === "https:" && url.hostname === "mp.weixin.qq.com";
	} catch {
		return false;
	}
}
/**
* 公众号文章导入：创建 hyperlink 任务并轮询至完成。
*
* @returns resolve 表示导入成功（返回最终任务数据）；reject 抛错（校验失败 / 导入失败 / 超时 / abort）
*/
async function importWechatArticleAndWait(params) {
	const url = (params.url ?? "").trim();
	if (!isWechatArticleLink(url)) throw new Error(`仅支持微信公众号文章链接（需以 ${WECHAT_ARTICLE_HOST} 开头）`);
	if (!params.parentEntryId) throw new Error("缺少目标目录 parent_entry_id");
	const taskId = unwrapData(await callSpApi({
		method: "POST",
		path: "/spapi/kb/file/v1/files/hyperlink",
		body: {
			url,
			parent_entry_id: params.parentEntryId
		}
	}))?.task_id;
	if (!taskId) throw new Error("创建公众号导入任务失败：缺少 task_id");
	const sleep = (ms) => new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
	for (let i = 0; i < WECHAT_IMPORT_POLL_MAX_TIMES; i++) {
		if (params.signal?.aborted) throw params.signal.reason ?? new DOMException("Wechat import aborted", "AbortError");
		const task = unwrapData(await callSpApi({
			method: "GET",
			path: `/spapi/kb/entry/v1/entry/async-tasks/${taskId}`
		}));
		const status = task?.status;
		if (status === "success") return task;
		if (status === "failed") throw new Error(task?.err_message || task?.message || "公众号文章导入失败");
		await sleep(WECHAT_IMPORT_POLL_INTERVAL_MS);
	}
	throw new Error("公众号文章导入超时，请稍后在乐享查看导入结果");
}
var WECHAT_ARTICLE_HOST, WECHAT_IMPORT_POLL_INTERVAL_MS, WECHAT_IMPORT_POLL_MAX_TIMES;
var init_wechat_import_service = __esmMin((() => {
	init_spapi_client();
	WECHAT_ARTICLE_HOST = "https://mp.weixin.qq.com";
	WECHAT_IMPORT_POLL_INTERVAL_MS = 3e3;
	WECHAT_IMPORT_POLL_MAX_TIMES = 200;
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/wechat-import/index.tsx
var import_react$13, import_jsx_runtime$11, WechatImport;
var init_wechat_import = __esmMin((() => {
	init_wechat_import$1();
	init_src();
	import_react$13 = /* @__PURE__ */ __toESM(require_react());
	init_contexts();
	init_useI18n();
	init_wechat_import_service();
	init_use_describe_upload_error();
	import_jsx_runtime$11 = require_jsx_runtime();
	WechatImport = ({ open, onOpenChange, parentEntryId, onImported }) => {
		const t = useTranslation();
		const adapter = useAdapter();
		const describeUploadError = useDescribeUploadError();
		const [wechatUrl, setWechatUrl] = (0, import_react$13.useState)("");
		const [wechatImporting, setWechatImporting] = (0, import_react$13.useState)(false);
		const abortRef = (0, import_react$13.useRef)(null);
		(0, import_react$13.useEffect)(() => () => {
			abortRef.current?.abort();
			abortRef.current = null;
		}, []);
		(0, import_react$13.useEffect)(() => {
			if (open) setWechatUrl("");
		}, [open]);
		const wechatUrlValid = isWechatArticleLink(wechatUrl);
		const handleConfirm = (0, import_react$13.useCallback)(async () => {
			const url = wechatUrl.trim();
			if (!isWechatArticleLink(url)) return;
			if (!parentEntryId) {
				message.error(t("tencentLexiang.upload.failedWithReason"));
				return;
			}
			setWechatImporting(true);
			const controller = new AbortController();
			abortRef.current?.abort();
			abortRef.current = controller;
			const closeLoading = message.loading(t("tencentLexiang.import.wechat.importing"));
			try {
				adapter?.reportTelemetry?.("web_element_click", {
					elementId: "import_weixin_article",
					elementName: "确定并导入公众号文章",
					source: "wechat"
				});
			} catch {}
			try {
				await importWechatArticleAndWait({
					url,
					parentEntryId,
					signal: controller.signal
				});
				closeLoading();
				message.success(t("tencentLexiang.import.wechat.success"), 3e3);
				onOpenChange(false);
				onImported?.();
			} catch (err) {
				closeLoading();
				if (err instanceof DOMException && err.name === "AbortError") return;
				console.error("[lexiang-import] importWechat failed:", err);
				message.error(describeUploadError(err), 3e3);
			} finally {
				if (abortRef.current === controller) abortRef.current = null;
				setWechatImporting(false);
			}
		}, [
			adapter,
			parentEntryId,
			wechatUrl,
			t,
			describeUploadError,
			onOpenChange,
			onImported
		]);
		return /* @__PURE__ */ (0, import_jsx_runtime$11.jsx)(Modal, {
			open,
			onOpenChange: (next) => {
				if (wechatImporting) return;
				onOpenChange(next);
			},
			title: t("tencentLexiang.import.wechat.title"),
			size: "medium",
			footer: /* @__PURE__ */ (0, import_jsx_runtime$11.jsx)("div", {
				className: "tencent-lexiang-wechat-import-footer",
				children: /* @__PURE__ */ (0, import_jsx_runtime$11.jsx)(Button, {
					type: "button",
					variant: "primary",
					size: "medium",
					disabled: !wechatUrlValid,
					loading: wechatImporting,
					onClick: () => {
						handleConfirm().catch(() => void 0);
					},
					children: t("tencentLexiang.import.wechat.confirm")
				})
			}),
			children: /* @__PURE__ */ (0, import_jsx_runtime$11.jsxs)("div", {
				className: "tencent-lexiang-wechat-import-body",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$11.jsx)(Input, {
					autoFocus: true,
					value: wechatUrl,
					status: wechatUrl.length > 0 && !wechatUrlValid ? "error" : void 0,
					placeholder: t("tencentLexiang.import.wechat.placeholder"),
					disabled: wechatImporting,
					onChange: (e) => setWechatUrl(e.target.value),
					onPressEnter: () => {
						if (wechatUrlValid && !wechatImporting) handleConfirm().catch(() => void 0);
					}
				}), wechatUrl.length > 0 && !wechatUrlValid && /* @__PURE__ */ (0, import_jsx_runtime$11.jsx)("div", {
					className: "tencent-lexiang-wechat-import-error-tip",
					children: t("tencentLexiang.import.wechat.invalidTip")
				})]
			})
		});
	};
})), import_jsx_runtime$10, DocTileIcon, SheetTileIcon, FolderTileIcon, UploadFileTileIcon, UploadFolderTileIcon, HtmlTileIcon, IwikiTileIcon, WeChatArticleTileIcon;
var init_icons = __esmMin((() => {
	require_react();
	import_jsx_runtime$10 = require_jsx_runtime();
	DocTileIcon = ({ size = 36 }) => /* @__PURE__ */ (0, import_jsx_runtime$10.jsxs)("svg", {
		width: size,
		height: size,
		viewBox: "0 0 16 16",
		fill: "none",
		xmlns: "http://www.w3.org/2000/svg",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("path", {
				d: "M8.75781 1C9.5533 1.00012 10.3164 1.3164 10.8789 1.87891L13.1211 4.12109C13.6836 4.6836 13.9999 5.4467 14 6.24219V13C14 14.1046 13.1046 15 12 15H4C2.89543 15 2 14.1046 2 13V3C2 1.89543 2.89543 1 4 1H8.75781Z",
				fill: "#1A79FF"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("path", {
				d: "M10.5 9.80005C10.8314 9.80005 11.0996 10.0683 11.0996 10.3997C11.0996 10.731 10.8314 10.9993 10.5 10.9993H5.5C5.16863 10.9993 4.90039 10.731 4.90039 10.3997C4.90039 10.0683 5.16863 9.80005 5.5 9.80005H10.5Z",
				fill: "white"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("path", {
				d: "M10.5 7C10.8314 7 11.0996 7.26824 11.0996 7.59961C11.0996 7.93098 10.8314 8.19922 10.5 8.19922H5.5C5.16863 8.19922 4.90039 7.93098 4.90039 7.59961C4.90039 7.26824 5.16863 7 5.5 7H10.5Z",
				fill: "white"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("path", {
				d: "M10 1.27246C10.3236 1.41991 10.6226 1.62264 10.8789 1.87891L13.1211 4.12109C13.3773 4.37726 13.5791 4.67651 13.7266 5H11C10.4477 5 10 4.55228 10 4V1.27246Z",
				fill: "#005DCC"
			})
		]
	});
	SheetTileIcon = ({ size = 36 }) => /* @__PURE__ */ (0, import_jsx_runtime$10.jsxs)("svg", {
		width: size,
		height: size,
		viewBox: "0 0 16 16",
		fill: "none",
		xmlns: "http://www.w3.org/2000/svg",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("path", {
				d: "M8.75781 1C9.5533 1.00012 10.3164 1.3164 10.8789 1.87891L13.1211 4.12109C13.6836 4.6836 13.9999 5.4467 14 6.24219V13C14 14.1046 13.1046 15 12 15H4C2.89543 15 2 14.1046 2 13V3C2 1.89543 2.89543 1 4 1H8.75781Z",
				fill: "#7D52FF"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("path", {
				d: "M7.19922 13C7.19922 13.3314 6.93098 13.5996 6.59961 13.5996C6.26824 13.5996 6 13.3314 6 13L6 3C6 2.66863 6.26824 2.40039 6.59961 2.40039C6.93098 2.40039 7.19922 2.66863 7.19922 3L7.19922 13Z",
				fill: "white"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("path", {
				d: "M11.5 6.40039C11.8314 6.40039 12.0996 6.66863 12.0996 7C12.0996 7.33137 11.8314 7.59961 11.5 7.59961H4C3.66863 7.59961 3.40039 7.33137 3.40039 7C3.40039 6.66863 3.66863 6.40039 4 6.40039H11.5Z",
				fill: "white"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("path", {
				d: "M12 9.90039C12.3314 9.90039 12.5996 10.1686 12.5996 10.5C12.5996 10.8314 12.3314 11.0996 12 11.0996H4C3.66863 11.0996 3.40039 10.8314 3.40039 10.5C3.40039 10.1686 3.66863 9.90039 4 9.90039H12Z",
				fill: "white"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("path", {
				d: "M10 1.27246C10.3236 1.41991 10.6226 1.62264 10.8789 1.87891L13.1211 4.12109C13.3773 4.37726 13.5791 4.67651 13.7266 5H11C10.4477 5 10 4.55228 10 4V1.27246Z",
				fill: "#5831CC"
			})
		]
	});
	FolderTileIcon = ({ size = 36 }) => /* @__PURE__ */ (0, import_jsx_runtime$10.jsxs)("svg", {
		width: size,
		height: size,
		viewBox: "0 0 16 16",
		fill: "none",
		xmlns: "http://www.w3.org/2000/svg",
		"aria-hidden": "true",
		children: [/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("path", {
			d: "M1 4C1 2.89543 1.89543 2 3 2H7C7.32456 2 7.64036 2.10527 7.9 2.3L9.1 3.2C9.35964 3.39473 9.67544 3.5 10 3.5H13C14.1046 3.5 15 4.39543 15 5.5V6H1V4Z",
			fill: "#BF8600"
		}), /* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("path", {
			d: "M1 7H15V12C15 13.1046 14.1046 14 13 14H3C1.89543 14 1 13.1046 1 12V7Z",
			fill: "#FFB300"
		})]
	});
	UploadFileTileIcon = ({ size = 36 }) => /* @__PURE__ */ (0, import_jsx_runtime$10.jsxs)("svg", {
		width: size,
		height: size,
		viewBox: "0 0 16 16",
		fill: "none",
		xmlns: "http://www.w3.org/2000/svg",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("path", {
				d: "M2 3C2 1.89543 2.89543 1 4 1H8.75736C9.55301 1 10.3161 1.31607 10.8787 1.87868L13.1213 4.12132C13.6839 4.68393 14 5.44699 14 6.24264V13C14 14.1046 13.1046 15 12 15H4C2.89543 15 2 14.1046 2 13V3Z",
				fill: "#1A79FF"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("path", {
				d: "M7.22379 6.92973C7.65336 6.50015 8.34988 6.50015 8.77945 6.92973L10.547 8.6973C10.7811 8.93159 10.7812 9.3107 10.547 9.54495C10.3128 9.77919 9.93371 9.77905 9.69937 9.54495L8.59976 8.44534V12C8.59971 12.3312 8.33135 12.5995 8.00016 12.5996C7.66882 12.5996 7.4006 12.3313 7.40055 12V8.44827L6.30387 9.54495C6.06954 9.77911 5.69047 9.77921 5.45621 9.54495C5.222 9.31068 5.22207 8.93161 5.45621 8.6973L7.22379 6.92973Z",
				fill: "white"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("path", {
				d: "M10 1.27344C10.3236 1.42089 10.6226 1.62361 10.8789 1.87988L13.1211 4.12207C13.3774 4.37823 13.5801 4.67749 13.7275 5.00098H11C10.4477 5.00098 10 4.55326 10 4.00098V1.27344Z",
				fill: "#005DCC"
			})
		]
	});
	UploadFolderTileIcon = ({ size = 36 }) => /* @__PURE__ */ (0, import_jsx_runtime$10.jsxs)("svg", {
		width: size,
		height: size,
		viewBox: "0 0 16 16",
		fill: "none",
		xmlns: "http://www.w3.org/2000/svg",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("path", {
				d: "M1 4C1 2.89543 1.89543 2 3 2H7C7.32456 2 7.64036 2.10527 7.9 2.3L9.1 3.2C9.35964 3.39473 9.67544 3.5 10 3.5H13C14.1046 3.5 15 4.39543 15 5.5V6H1V4Z",
				fill: "#BF8600"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("path", {
				d: "M1 7H15V12C15 13.1046 14.1046 14 13 14H3C1.89543 14 1 13.1046 1 12V7Z",
				fill: "#FFB300"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("path", {
				d: "M7.22379 8.42973C7.65336 8.00015 8.34988 8.00015 8.77945 8.42973L10.047 9.6973C10.2811 9.93159 10.2812 10.3107 10.047 10.545C9.81275 10.7792 9.43371 10.779 9.19937 10.545L8.59976 9.94534V12.5C8.59971 12.8312 8.33135 13.0995 8.00016 13.0996C7.66882 13.0996 7.4006 12.8313 7.40055 12.5V9.94827L6.80387 10.545C6.56954 10.7791 6.19047 10.7792 5.95621 10.545C5.722 10.3107 5.72207 9.93161 5.95621 9.6973L7.22379 8.42973Z",
				fill: "white"
			})
		]
	});
	HtmlTileIcon = ({ size = 36 }) => /* @__PURE__ */ (0, import_jsx_runtime$10.jsxs)("svg", {
		width: size,
		height: size,
		viewBox: "0 0 16 16",
		fill: "none",
		xmlns: "http://www.w3.org/2000/svg",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("path", {
				d: "M2 3C2 1.89543 2.89543 1 4 1H8.75736C9.55301 1 10.3161 1.31607 10.8787 1.87868L13.1213 4.12132C13.6839 4.68393 14 5.44699 14 6.24264V13C14 14.1046 13.1046 15 12 15H4C2.89543 15 2 14.1046 2 13V3Z",
				fill: "#008DF2"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("path", {
				d: "M8.43092 5.30975C8.53568 4.99548 8.87542 4.82529 9.18971 4.92987C9.50378 5.03474 9.67414 5.37447 9.56959 5.68866L7.5696 11.6886C7.46487 12.0028 7.12501 12.1729 6.81081 12.0685C6.49655 11.9638 6.32636 11.624 6.43093 11.3097L8.43092 5.30975ZM5.32645 6.32439C5.56077 6.09022 5.94081 6.09013 6.17508 6.32439C6.40866 6.55857 6.40867 6.93787 6.17508 7.17205L4.84794 8.49821L6.17508 9.82438C6.40898 10.0586 6.409 10.4388 6.17508 10.673C5.94087 10.9072 5.56079 10.907 5.32645 10.673L3.92997 9.27653C3.50041 8.84696 3.50042 8.15045 3.92997 7.72087L5.32645 6.32439ZM9.82642 6.32537C10.0607 6.09115 10.4408 6.09109 10.675 6.32537L12.0705 7.72087C12.4999 8.15043 12.5 8.84702 12.0705 9.27653L10.675 10.673C10.4408 10.9072 10.0608 10.9071 9.82642 10.673C9.5921 10.4387 9.59211 10.0587 9.82642 9.82438L11.1526 8.49821L9.82642 7.17302C9.59223 6.93873 9.59223 6.55966 9.82642 6.32537Z",
				fill: "white"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("path", {
				d: "M10 1.27234C10.3236 1.41977 10.6226 1.62253 10.8789 1.87878L13.1211 4.12097C13.3772 4.37711 13.5791 4.67643 13.7266 4.99988H11C10.4477 4.99988 10 4.55216 10 3.99988V1.27234Z",
				fill: "#3273A6"
			})
		]
	});
	IwikiTileIcon = ({ size = 36 }) => /* @__PURE__ */ (0, import_jsx_runtime$10.jsxs)("svg", {
		width: size,
		height: size,
		viewBox: "0 0 16 16",
		fill: "none",
		xmlns: "http://www.w3.org/2000/svg",
		"aria-hidden": "true",
		children: [/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("path", {
			d: "M12.6332 1.5H3.39803C2.35803 1.5 1.51562 2.3424 1.51562 3.3824V12.6176C1.51562 13.6576 2.35803 14.5 3.39803 14.5H12.6332C13.6732 14.5 14.5156 13.6576 14.5156 12.6176V3.3824C14.5156 2.3424 13.6732 1.5 12.6332 1.5Z",
			fill: "#0051E1"
		}), /* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("path", {
			d: "M11.6785 4.40929H12.8121L9.93909 11.6139H8.40769L8.09309 6.25789L5.71409 11.6139H4.18269L4.09689 4.41189H5.37089L5.35269 10.0539L7.82789 4.41189H9.21629L9.50229 10.0539L11.6785 4.40929Z",
			fill: "white"
		})]
	});
	WeChatArticleTileIcon = ({ size = 36 }) => /* @__PURE__ */ (0, import_jsx_runtime$10.jsxs)("svg", {
		width: size,
		height: size,
		viewBox: "0 0 16 16",
		fill: "none",
		xmlns: "http://www.w3.org/2000/svg",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("path", {
				d: "M0.542694 6.39128C0.542694 7.74473 1.26894 8.96276 2.40509 9.78613C2.49642 9.85114 2.55595 9.95811 2.55595 10.0788C2.55595 10.1186 2.54752 10.1553 2.53706 10.1934C2.44644 10.5319 2.30117 11.0738 2.29416 11.0993C2.28299 11.1419 2.26531 11.1862 2.26531 11.2306C2.26531 11.3298 2.34567 11.4102 2.44482 11.4102C2.48403 11.4102 2.51583 11.3958 2.54884 11.3768L3.72878 10.6956C3.81736 10.6444 3.91133 10.6128 4.01485 10.6128C4.07011 10.6128 4.12324 10.6211 4.17332 10.6365C4.72383 10.7947 5.3176 10.8829 5.93271 10.8829C8.90953 10.8829 11.3226 8.87174 11.3226 6.39128C11.3226 3.91062 8.90953 1.8997 5.93271 1.8997C2.9559 1.8997 0.542694 3.91062 0.542694 6.39128Z",
				fill: "url(#wechat_paint0)"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("path", {
				d: "M6.47238 9.91793C6.47238 11.9851 8.4835 13.6609 10.9641 13.6609C11.4766 13.6609 11.9714 13.5876 12.4302 13.4557C12.4718 13.4429 12.5163 13.436 12.5621 13.436C12.6485 13.436 12.7268 13.4623 12.8008 13.505L13.784 14.0725C13.8116 14.0886 13.838 14.1006 13.8704 14.1006C13.9532 14.1006 14.0202 14.0336 14.0202 13.9508C14.0202 13.9139 14.0055 13.877 13.996 13.8414C13.9905 13.8202 13.8694 13.3685 13.7938 13.0865C13.785 13.0547 13.778 13.0243 13.778 12.991C13.778 12.8905 13.8276 12.8014 13.9036 12.7471C14.8506 12.061 15.4557 11.0459 15.4557 9.91793C15.4557 7.85094 13.4446 6.17515 10.9641 6.17515C8.4835 6.17515 6.47238 7.85094 6.47238 9.91793Z",
				fill: "url(#wechat_paint1)"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("path", {
				d: "M11.8607 8.72049C11.8607 9.05126 12.1287 9.31924 12.4594 9.31924C12.7903 9.31924 13.0584 9.05126 13.0584 8.72049C13.0584 8.38962 12.7903 8.12163 12.4594 8.12163C12.1287 8.12163 11.8607 8.38962 11.8607 8.72049Z",
				fill: "#919191"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("path", {
				d: "M8.86789 8.72049C8.86789 9.05126 9.13598 9.31924 9.46664 9.31924C9.79741 9.31924 10.0656 9.05126 10.0656 8.72049C10.0656 8.38962 9.79741 8.12163 9.46664 8.12163C9.13598 8.12163 8.86789 8.38962 8.86789 8.72049Z",
				fill: "#919191"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("path", {
				d: "M8.44685 4.95418C8.44685 5.35108 8.12512 5.67281 7.72822 5.67281C7.33122 5.67281 7.00949 5.35108 7.00949 4.95418C7.00949 4.55728 7.33122 4.23545 7.72822 4.23545C8.12512 4.23545 8.44685 4.55728 8.44685 4.95418Z",
				fill: "#168743"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("path", {
				d: "M4.85467 4.95418C4.85467 5.35108 4.53294 5.67281 4.13604 5.67281C3.73914 5.67281 3.41731 5.35108 3.41731 4.95418C3.41731 4.55728 3.73914 4.23545 4.13604 4.23545C4.53294 4.23545 4.85467 4.55728 4.85467 4.95418Z",
				fill: "#168743"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$10.jsxs)("defs", { children: [/* @__PURE__ */ (0, import_jsx_runtime$10.jsxs)("linearGradient", {
				id: "wechat_paint0",
				x1: "5.9327",
				y1: "11.4102",
				x2: "5.9327",
				y2: "1.89967",
				gradientUnits: "userSpaceOnUse",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("stop", { stopColor: "#05CD66" }),
					/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("stop", {
						offset: "0.06",
						stopColor: "#05CD66"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("stop", {
						offset: "0.2941",
						stopColor: "#05CD66"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("stop", {
						offset: "0.95",
						stopColor: "#61F380"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("stop", {
						offset: "1",
						stopColor: "#61F380"
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime$10.jsxs)("linearGradient", {
				id: "wechat_paint1",
				x1: "10.964",
				y1: "14.1006",
				x2: "10.964",
				y2: "6.17512",
				gradientUnits: "userSpaceOnUse",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("stop", { stopColor: "#D9D9D9" }),
					/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("stop", {
						offset: "0.08",
						stopColor: "#D9D9D9"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("stop", {
						offset: "0.1063",
						stopColor: "#D9D9D9"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("stop", {
						offset: "1",
						stopColor: "#F0F0F0"
					})
				]
			})] })
		]
	});
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/create-knowledge-popover/use-lexiang-create-entry.ts
function useLexiangCreateEntry(closePopover) {
	const t = useTranslation();
	const adapter = useAdapter();
	const openCreateDrawer = useTencentLexiangStore((s) => s.openCreateDrawer);
	const [creating, setCreating] = (0, import_react$11.useState)(false);
	const describeCreateError = (detail) => {
		switch (detail.kind) {
			case "forbidden": return t("tencentLexiang.createEntry.failed.forbidden");
			case "rateLimit": return t("tencentLexiang.createEntry.failed.rateLimit");
			case "network": return t("tencentLexiang.createEntry.failed.network");
			case "server": return t("tencentLexiang.createEntry.failed.server", { bizCode: detail.bizCode ?? "" });
			default: return t("tencentLexiang.createEntry.failed.generic", { reason: detail.bizMessage || t("tencentLexiang.preview.createFailed") });
		}
	};
	/**
	* 统一创建入口：先关浮窗 + 上报埋点，再创建。
	* folder 直接创建不弹抽屉；doc / sheet 创建成功后打开编辑抽屉。
	*/
	const handleCreateEntry = async (type) => {
		closePopover();
		try {
			adapter?.reportTelemetry?.("web_element_click", {
				pageName: "lexiang",
				elementId: "lexiang_lib_new_file",
				elementName: "新建文件",
				source: type,
				mode: "lexiang"
			});
		} catch {}
		if (creating) return;
		const rootEntryId = tencentLexiangStore.getState().currentKnowledgeBase?.rootEntryId;
		if (!rootEntryId) {
			message.error(type === "folder" ? t("tencentLexiang.newFolder.failed") : t("tencentLexiang.preview.createFailed"));
			return;
		}
		setCreating(true);
		const closeLoading = type !== "folder" ? message.loading(t("tencentLexiang.preview.creating")) : null;
		try {
			const { entry } = await createEntry({
				parentEntryId: rootEntryId,
				type,
				name: type === "folder" ? t("tencentLexiang.newFolder.defaultName") : t(`tencentLexiang.newDoc.${type}`)
			});
			closeLoading?.();
			if (type === "folder") {
				tencentLexiangStore.getState().setViewMode("catalog");
				message.success(t("tencentLexiang.newFolder.success"), 3e3);
			} else openCreateDrawer(type, entry.id);
			tencentLexiangStore.getState().bumpFileListVersion();
		} catch (err) {
			closeLoading?.();
			console.error(`[CreateKnowledgePopover] create ${type} failed:`, err);
			const detail = classifyCreateEntryError(err);
			message.error(describeCreateError(detail), 3e3);
		} finally {
			setCreating(false);
		}
	};
	return {
		creating,
		handleCreateEntry
	};
}
var import_react$11;
var init_use_lexiang_create_entry = __esmMin((() => {
	init_src();
	import_react$11 = /* @__PURE__ */ __toESM(require_react());
	init_contexts();
	init_useI18n();
	init_api();
	init_store();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/create-knowledge-popover/use-lexiang-local-upload.ts
function useLexiangLocalUpload(closePopover) {
	const t = useTranslation();
	const adapter = useAdapter();
	const currentKb = useTencentLexiangStore((s) => s.currentKnowledgeBase);
	const describeUploadError = useDescribeUploadError();
	const [uploading, setUploading] = (0, import_react$10.useState)(false);
	return {
		uploading,
		handleUploadFile: (0, import_react$10.useCallback)(async () => {
			closePopover();
			try {
				adapter?.reportTelemetry?.("web_element_click", {
					pageName: "lexiang",
					elementId: "lexiang_lib_upload",
					elementName: "上传文件"
				});
			} catch {}
			if (!adapter?.pickFile) {
				message.error(t("tencentLexiang.upload.failedWithReason"));
				return;
			}
			const rootEntryId = currentKb?.rootEntryId;
			if (!rootEntryId) {
				message.error(t("tencentLexiang.upload.failedWithReason"));
				return;
			}
			let pickResult;
			try {
				pickResult = await adapter.pickFile({
					canSelectMany: false,
					filters: [{
						name: "Supported Files",
						extensions: [...LEXIANG_SUPPORTED_EXTENSIONS]
					}]
				});
			} catch (err) {
				console.error("[lexiang-upload] pickFile failed:", err);
				message.error(t("tencentLexiang.upload.failedWithReason"));
				return;
			}
			if (!pickResult || pickResult.canceled) return;
			const first = pickResult.files?.[0];
			if (!first || typeof first !== "string") return;
			const fileName = first.split(/[\\/]/).pop() || "file";
			if (!adapter.uploadLexiangFile) {
				message.error(t("tencentLexiang.upload.failedWithReason"));
				return;
			}
			setUploading(true);
			const closeLoading = message.loading(t("tencentLexiang.upload.uploading"));
			try {
				adapter?.reportTelemetry?.("web_element_click", {
					elementId: "save_to_lexiang_confirm",
					elementName: "确认上传到乐享"
				});
			} catch {}
			try {
				await adapter.uploadLexiangFile({
					filePath: first,
					parentEntryId: rootEntryId,
					fileName
				});
				closeLoading();
				message.success(t("tencentLexiang.upload.success"), 3e3);
				try {
					adapter?.reportTelemetry?.("web_element_click", {
						elementId: "save_to_lexiang_success",
						elementName: "上传到乐享成功"
					});
				} catch {}
				tencentLexiangStore.getState().bumpFileListVersion();
			} catch (err) {
				closeLoading();
				console.error("[lexiang-upload] uploadFile failed:", err);
				const detail = describeUploadError(err);
				message.error(detail, 3e3);
			} finally {
				setUploading(false);
			}
		}, [
			adapter,
			currentKb,
			t,
			describeUploadError,
			closePopover
		]),
		handleUploadFolder: (0, import_react$10.useCallback)(async () => {
			closePopover();
			try {
				adapter?.reportTelemetry?.("web_element_click", {
					pageName: "lexiang",
					elementId: "lexiang_lib_upload_folder",
					elementName: "上传文件夹"
				});
			} catch {}
			if (!adapter?.pickFolder) {
				message.error(t("tencentLexiang.upload.failedWithReason"));
				return;
			}
			const rootEntryId = currentKb?.rootEntryId;
			if (!rootEntryId) {
				message.error(t("tencentLexiang.upload.failedWithReason"));
				return;
			}
			let pickResult;
			try {
				pickResult = await adapter.pickFolder();
			} catch (err) {
				console.error("[lexiang-upload] pickFolder failed:", err);
				message.error(t("tencentLexiang.upload.failedWithReason"));
				return;
			}
			if (!pickResult || pickResult.canceled) return;
			const folderPath = pickResult.folderPaths?.[0];
			if (!folderPath || typeof folderPath !== "string") return;
			if (!adapter.uploadLexiangFolder) {
				message.error(t("tencentLexiang.upload.failedWithReason"));
				return;
			}
			const folderName = folderPath.split(/[\\/]/).pop() || folderPath;
			if (!await new Promise((resolve) => {
				Modal.confirm({
					title: t("tencentLexiang.upload.folderConfirmTitle"),
					content: t("tencentLexiang.upload.folderConfirmContent", { folderName }),
					okText: t("tencentLexiang.upload.folderConfirmOk"),
					cancelText: t("tencentLexiang.upload.folderConfirmCancel"),
					onOk: () => {
						resolve(true);
					},
					onCancel: () => {
						resolve(false);
					}
				});
			})) return;
			setUploading(true);
			const closeLoading = message.loading(t("tencentLexiang.upload.uploading"));
			try {
				const result = await adapter.uploadLexiangFolder({
					folderPath,
					parentEntryId: rootEntryId
				});
				closeLoading();
				if (result?.total === 0) message.warning(t("tencentLexiang.upload.emptyFolder"), 3e3);
				else if (result?.filtered > 0 && result?.success > 0) message.success(t("tencentLexiang.upload.successWithFiltered", {
					success: result.success,
					filtered: result.filtered
				}), 5e3);
				else if (result?.filtered > 0 && !result?.success) message.warning(t("tencentLexiang.upload.filteredFiles", { count: result.filtered }), 3e3);
				else if (result?.success > 0) message.success(t("tencentLexiang.upload.success"), 3e3);
				tencentLexiangStore.getState().bumpFileListVersion();
			} catch (err) {
				closeLoading();
				console.error("[lexiang-upload] uploadFolder failed:", err);
				const detail = describeUploadError(err);
				message.error(detail, 3e3);
			} finally {
				setUploading(false);
			}
		}, [
			adapter,
			currentKb,
			t,
			describeUploadError,
			closePopover
		]),
		handleUploadHtml: (0, import_react$10.useCallback)(async () => {
			closePopover();
			try {
				adapter?.reportTelemetry?.("web_element_click", {
					pageName: "lexiang",
					elementId: "lexiang_lib_upload_html",
					elementName: "上传HTML"
				});
			} catch {}
			if (!adapter?.pickFile) {
				message.error(t("tencentLexiang.upload.failedWithReason"));
				return;
			}
			const rootEntryId = currentKb?.rootEntryId;
			if (!rootEntryId) {
				message.error(t("tencentLexiang.upload.failedWithReason"));
				return;
			}
			let pickResult;
			try {
				pickResult = await adapter.pickFile({
					canSelectMany: false,
					filters: [{
						name: "HTML Files",
						extensions: [...LEXIANG_HTML_SUPPORTED_EXTENSIONS]
					}]
				});
			} catch (err) {
				console.error("[lexiang-upload] pickFile (html) failed:", err);
				message.error(t("tencentLexiang.upload.failedWithReason"));
				return;
			}
			if (!pickResult || pickResult.canceled) return;
			const first = pickResult.files?.[0];
			if (!first || typeof first !== "string") return;
			const fileName = first.split(/[\\/]/).pop() || "index.html";
			if (!adapter.uploadLexiangHtml) {
				message.error(t("tencentLexiang.upload.failedWithReason"));
				return;
			}
			const spaceId = currentKb?.id;
			if (!spaceId) {
				message.error(t("tencentLexiang.upload.failedWithReason"));
				return;
			}
			setUploading(true);
			const closeLoading = message.loading(t("tencentLexiang.upload.uploading"));
			try {
				adapter?.reportTelemetry?.("web_element_click", {
					elementId: "save_to_lexiang_confirm",
					elementName: "确认上传到乐享",
					source: "html"
				});
			} catch {}
			try {
				await adapter.uploadLexiangHtml({
					filePath: first,
					parentEntryId: rootEntryId,
					spaceId,
					fileName
				});
				closeLoading();
				message.success(t("tencentLexiang.upload.success"), 3e3);
				try {
					adapter?.reportTelemetry?.("web_element_click", {
						elementId: "save_to_lexiang_success",
						elementName: "上传到乐享成功",
						source: "html"
					});
				} catch {}
				tencentLexiangStore.getState().bumpFileListVersion();
			} catch (err) {
				closeLoading();
				console.error("[lexiang-upload] uploadHtml failed:", err);
				const detail = describeUploadError(err);
				message.error(detail, 3e3);
			} finally {
				setUploading(false);
			}
		}, [
			adapter,
			currentKb,
			t,
			describeUploadError,
			closePopover
		])
	};
}
var import_react$10;
var init_use_lexiang_local_upload = __esmMin((() => {
	init_src();
	import_react$10 = /* @__PURE__ */ __toESM(require_react());
	init_contexts();
	init_useI18n();
	init_constants();
	init_use_describe_upload_error();
	init_store();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/create-knowledge-popover/index.tsx
var import_react$9, import_jsx_runtime$9, CreateKnowledgePopover;
var init_create_knowledge_popover = __esmMin((() => {
	init_create_knowledge_popover$1();
	init_src();
	import_react$9 = /* @__PURE__ */ __toESM(require_react());
	init_contexts();
	init_useI18n();
	init_account_service();
	init_constants();
	init_store();
	init_ui_icons();
	init_iwiki_import();
	init_wechat_import();
	init_icons();
	init_use_lexiang_create_entry();
	init_use_lexiang_local_upload();
	import_jsx_runtime$9 = require_jsx_runtime();
	CreateKnowledgePopover = () => {
		const t = useTranslation();
		const adapter = useAdapter();
		const currentKb = useTencentLexiangStore((s) => s.currentKnowledgeBase);
		const [open, setOpen] = (0, import_react$9.useState)(false);
		const [wechatModalOpen, setWechatModalOpen] = (0, import_react$9.useState)(false);
		const [iwikiEnabled, setIwikiEnabled] = (0, import_react$9.useState)(false);
		const [iwikiModalOpen, setIwikiModalOpen] = (0, import_react$9.useState)(false);
		const closePopover = (0, import_react$9.useCallback)(() => setOpen(false), []);
		const { creating, handleCreateEntry } = useLexiangCreateEntry(closePopover);
		const { uploading, handleUploadFile, handleUploadFolder, handleUploadHtml } = useLexiangLocalUpload(closePopover);
		(0, import_react$9.useEffect)(() => {
			let cancelled = false;
			fetchCurrentCompany().then((company) => {
				if (!cancelled) setIwikiEnabled(company?.code === IWIKI_ENABLED_COMPANY_CODE);
			});
			return () => {
				cancelled = true;
			};
		}, []);
		const handleImportWechat = (0, import_react$9.useCallback)(() => {
			closePopover();
			try {
				adapter?.reportTelemetry?.("web_element_click", {
					pageName: "lexiang",
					elementId: "lexiang_lib_import_wechat",
					elementName: "导入公众号文章"
				});
			} catch {}
			setWechatModalOpen(true);
		}, [adapter, closePopover]);
		const handleImportIwiki = (0, import_react$9.useCallback)(() => {
			closePopover();
			try {
				adapter?.reportTelemetry?.("web_element_click", {
					pageName: "lexiang",
					elementId: "lexiang_lib_import_iwiki",
					elementName: "导入iWiki文档"
				});
			} catch {}
			setIwikiModalOpen(true);
		}, [adapter, closePopover]);
		const popoverContent = /* @__PURE__ */ (0, import_jsx_runtime$9.jsxs)("div", {
			className: "tencent-lexiang-create-knowledge-popover",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime$9.jsxs)("div", {
					className: "tencent-lexiang-create-knowledge-popover__section",
					children: [/* @__PURE__ */ (0, import_jsx_runtime$9.jsx)("div", {
						className: "tencent-lexiang-create-knowledge-popover__section-title",
						children: t("tencentLexiang.createPanel.newKnowledge")
					}), /* @__PURE__ */ (0, import_jsx_runtime$9.jsxs)("div", {
						className: "tencent-lexiang-create-knowledge-popover__grid",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime$9.jsxs)("button", {
								type: "button",
								className: "tencent-lexiang-create-knowledge-popover__item",
								disabled: creating,
								onClick: () => handleCreateEntry("doc"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime$9.jsx)(DocTileIcon, { size: 36 }), /* @__PURE__ */ (0, import_jsx_runtime$9.jsx)("span", {
									className: "tencent-lexiang-create-knowledge-popover__label",
									children: t("tencentLexiang.newDoc.doc")
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime$9.jsxs)("button", {
								type: "button",
								className: "tencent-lexiang-create-knowledge-popover__item",
								disabled: creating,
								onClick: () => handleCreateEntry("sheet"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime$9.jsx)(SheetTileIcon, { size: 36 }), /* @__PURE__ */ (0, import_jsx_runtime$9.jsx)("span", {
									className: "tencent-lexiang-create-knowledge-popover__label",
									children: t("tencentLexiang.newDoc.sheet")
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime$9.jsxs)("button", {
								type: "button",
								className: "tencent-lexiang-create-knowledge-popover__item",
								disabled: creating,
								onClick: () => handleCreateEntry("folder"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime$9.jsx)(FolderTileIcon, { size: 36 }), /* @__PURE__ */ (0, import_jsx_runtime$9.jsx)("span", {
									className: "tencent-lexiang-create-knowledge-popover__label",
									children: t("tencentLexiang.newDoc.folder")
								})]
							})
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$9.jsxs)("div", {
					className: "tencent-lexiang-create-knowledge-popover__section",
					children: [/* @__PURE__ */ (0, import_jsx_runtime$9.jsx)("div", {
						className: "tencent-lexiang-create-knowledge-popover__section-title",
						children: t("tencentLexiang.createPanel.uploadLocal")
					}), /* @__PURE__ */ (0, import_jsx_runtime$9.jsxs)("div", {
						className: "tencent-lexiang-create-knowledge-popover__grid",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime$9.jsxs)("button", {
								type: "button",
								className: "tencent-lexiang-create-knowledge-popover__item",
								disabled: uploading,
								onClick: handleUploadFile,
								children: [/* @__PURE__ */ (0, import_jsx_runtime$9.jsx)(UploadFileTileIcon, { size: 36 }), /* @__PURE__ */ (0, import_jsx_runtime$9.jsx)("span", {
									className: "tencent-lexiang-create-knowledge-popover__label",
									children: t("tencentLexiang.upload.file")
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime$9.jsxs)("button", {
								type: "button",
								className: "tencent-lexiang-create-knowledge-popover__item",
								disabled: uploading,
								onClick: handleUploadFolder,
								children: [/* @__PURE__ */ (0, import_jsx_runtime$9.jsx)(UploadFolderTileIcon, { size: 36 }), /* @__PURE__ */ (0, import_jsx_runtime$9.jsx)("span", {
									className: "tencent-lexiang-create-knowledge-popover__label",
									children: t("tencentLexiang.upload.folder")
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime$9.jsxs)("button", {
								type: "button",
								className: "tencent-lexiang-create-knowledge-popover__item",
								disabled: uploading,
								onClick: handleUploadHtml,
								children: [/* @__PURE__ */ (0, import_jsx_runtime$9.jsx)(HtmlTileIcon, { size: 36 }), /* @__PURE__ */ (0, import_jsx_runtime$9.jsx)("span", {
									className: "tencent-lexiang-create-knowledge-popover__label",
									children: t("tencentLexiang.upload.html")
								})]
							})
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$9.jsxs)("div", {
					className: "tencent-lexiang-create-knowledge-popover__section",
					children: [/* @__PURE__ */ (0, import_jsx_runtime$9.jsx)("div", {
						className: "tencent-lexiang-create-knowledge-popover__section-title",
						children: t("tencentLexiang.createPanel.importPlatform")
					}), /* @__PURE__ */ (0, import_jsx_runtime$9.jsxs)("div", {
						className: "tencent-lexiang-create-knowledge-popover__grid",
						children: [/* @__PURE__ */ (0, import_jsx_runtime$9.jsxs)("button", {
							type: "button",
							className: "tencent-lexiang-create-knowledge-popover__item",
							onClick: handleImportWechat,
							children: [/* @__PURE__ */ (0, import_jsx_runtime$9.jsx)(WeChatArticleTileIcon, { size: 36 }), /* @__PURE__ */ (0, import_jsx_runtime$9.jsx)("span", {
								className: "tencent-lexiang-create-knowledge-popover__label",
								children: t("tencentLexiang.import.wechat")
							})]
						}), iwikiEnabled && /* @__PURE__ */ (0, import_jsx_runtime$9.jsxs)("button", {
							type: "button",
							className: "tencent-lexiang-create-knowledge-popover__item",
							onClick: handleImportIwiki,
							children: [/* @__PURE__ */ (0, import_jsx_runtime$9.jsx)(IwikiTileIcon, { size: 36 }), /* @__PURE__ */ (0, import_jsx_runtime$9.jsx)("span", {
								className: "tencent-lexiang-create-knowledge-popover__label",
								children: t("tencentLexiang.import.iwiki")
							})]
						})]
					})]
				})
			]
		});
		return /* @__PURE__ */ (0, import_jsx_runtime$9.jsxs)(import_jsx_runtime$9.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime$9.jsx)(Tooltip, {
				content: open ? void 0 : t("tencentLexiang.banner.newDoc"),
				children: /* @__PURE__ */ (0, import_jsx_runtime$9.jsx)("span", {
					style: { display: "inline-flex" },
					children: /* @__PURE__ */ (0, import_jsx_runtime$9.jsx)(Popover, {
						placement: "bottom-start",
						open,
						onOpenChange: setOpen,
						portalRoot: "inline",
						role: "menu",
						trigger: /* @__PURE__ */ (0, import_jsx_runtime$9.jsx)("button", {
							type: "button",
							className: "lexiang-space-info-card__icon-btn",
							"aria-label": t("tencentLexiang.banner.newDoc"),
							"aria-haspopup": "menu",
							"aria-expanded": open,
							children: /* @__PURE__ */ (0, import_jsx_runtime$9.jsx)(PlusIcon, { size: 18 })
						}),
						children: popoverContent
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$9.jsx)(WechatImport, {
				open: wechatModalOpen,
				onOpenChange: setWechatModalOpen,
				parentEntryId: currentKb?.rootEntryId,
				onImported: () => tencentLexiangStore.getState().bumpFileListVersion()
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$9.jsx)(IwikiImport, {
				open: iwikiModalOpen,
				onOpenChange: setIwikiModalOpen,
				parentEntryId: currentKb?.rootEntryId,
				lexiangSpaceId: currentKb?.id,
				onImported: () => tencentLexiangStore.getState().bumpFileListVersion()
			})
		] });
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/pages/space-detail/components/space-info-card/index.tsx
var import_react$8, import_jsx_runtime$8, SpaceInfoCard;
var init_space_info_card = __esmMin((() => {
	init_space_info_card$1();
	init_src();
	import_react$8 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_privilege_service();
	init_create_knowledge_popover();
	init_kb_default_icon();
	init_ui_icons();
	init_use_goto_lexiang();
	init_use_lexiang_add_to_task();
	init_use_lexiang_logo();
	init_store();
	init_utils();
	import_jsx_runtime$8 = require_jsx_runtime();
	SpaceInfoCard = () => {
		const t = useTranslation();
		const currentKb = useTencentLexiangStore((s) => s.currentKnowledgeBase);
		const personalKbInfo = useTencentLexiangStore((s) => s.personalKbInfo);
		const { addKnowledgeBaseToTask } = useLexiangAddToTask();
		const { gotoLexiang } = useGotoLexiang();
		const [canManageSpace, setCanManageSpace] = (0, import_react$8.useState)(false);
		const [moreDropdownOpen, setMoreDropdownOpen] = (0, import_react$8.useState)(false);
		(0, import_react$8.useEffect)(() => {
			if (!currentKb?.id) return;
			let cancelled = false;
			fetchStaffPermissions(currentKb.id, "space").then((perms) => {
				if (cancelled) return;
				setCanManageSpace(perms.includes("manage_space"));
			}).catch(() => {});
			return () => {
				cancelled = true;
			};
		}, [currentKb?.id]);
		const handleAddToTaskClick = () => {
			addKnowledgeBaseToTask("banner");
		};
		const handleGotoInLexiang = (0, import_react$8.useCallback)(async (path) => {
			await gotoLexiang({ homeUrl: getLexiangHomeUrl({ path }) });
		}, [gotoLexiang]);
		const moreItems = [{
			key: "members",
			label: t("tencentLexiang.teamInfoCard.members"),
			icon: /* @__PURE__ */ (0, import_jsx_runtime$8.jsx)(UserIcon, { size: 16 }),
			action: () => handleGotoInLexiang(`/spaces/${currentKb?.id}/settings/access`)
		}, {
			key: "manage",
			label: t("tencentLexiang.teamInfoCard.manage"),
			icon: /* @__PURE__ */ (0, import_jsx_runtime$8.jsx)(SettingIcon, { size: 16 }),
			divider: true,
			action: () => handleGotoInLexiang(`/spaces/${currentKb?.id}/settings/profile`)
		}];
		const isPersonalKb = !!(currentKb && personalKbInfo && currentKb.id === personalKbInfo.id);
		const { imgRef, ready: showAvatar, onError: handleAvatarError } = useLexiangLogo({ rawLogo: currentKb?.avatar ?? (isPersonalKb ? personalKbInfo?.logo : void 0) });
		const personalDescription = isPersonalKb ? personalKbInfo?.description?.trim() : void 0;
		const subtitle = personalDescription && personalDescription.length > 0 ? personalDescription : "";
		return /* @__PURE__ */ (0, import_jsx_runtime$8.jsxs)("div", {
			className: "lexiang-space-info-card",
			children: [/* @__PURE__ */ (0, import_jsx_runtime$8.jsxs)("div", {
				className: "lexiang-space-info-card__left",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$8.jsxs)("div", {
					className: `lexiang-space-info-card__avatar${showAvatar ? "" : " lexiang-space-info-card__avatar--fallback"}`,
					"aria-hidden": "true",
					children: [/* @__PURE__ */ (0, import_jsx_runtime$8.jsx)("img", {
						ref: imgRef,
						alt: "",
						referrerPolicy: "no-referrer",
						onError: handleAvatarError,
						style: showAvatar ? void 0 : { display: "none" }
					}), !showAvatar && /* @__PURE__ */ (0, import_jsx_runtime$8.jsx)("span", {
						className: "lexiang-space-info-card__avatar-fallback",
						children: /* @__PURE__ */ (0, import_jsx_runtime$8.jsx)(KbDefaultIcon, { size: 48 })
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime$8.jsxs)("div", {
					className: "lexiang-space-info-card__info",
					children: [/* @__PURE__ */ (0, import_jsx_runtime$8.jsx)("h1", {
						className: "lexiang-space-info-card__name",
						title: currentKb?.name,
						children: currentKb?.name ?? "—"
					}), subtitle && /* @__PURE__ */ (0, import_jsx_runtime$8.jsx)("p", {
						className: "lexiang-space-info-card__subtitle",
						children: subtitle
					})]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime$8.jsxs)("div", {
				className: "lexiang-space-info-card__right",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime$8.jsx)(CreateKnowledgePopover, {}),
					canManageSpace && /* @__PURE__ */ (0, import_jsx_runtime$8.jsx)(Tooltip, {
						content: moreDropdownOpen ? void 0 : t("tencentLexiang.teamInfoCard.more"),
						placement: "top",
						children: /* @__PURE__ */ (0, import_jsx_runtime$8.jsx)("span", {
							style: { display: "inline-flex" },
							children: /* @__PURE__ */ (0, import_jsx_runtime$8.jsx)(Dropdown, {
								placement: "bottom-end",
								items: moreItems,
								open: moreDropdownOpen,
								onOpenChange: setMoreDropdownOpen,
								onSelect: (key) => {
									moreItems.find((i) => i.key === key)?.action();
								},
								trigger: /* @__PURE__ */ (0, import_jsx_runtime$8.jsx)("span", {
									className: "lexiang-space-info-card__icon-btn",
									role: "button",
									tabIndex: 0,
									"aria-label": t("tencentLexiang.teamInfoCard.more"),
									children: /* @__PURE__ */ (0, import_jsx_runtime$8.jsx)(MoreIcon, { size: 16 })
								})
							})
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime$8.jsx)(Button, {
						variant: "primary",
						className: "lexiang-space-info-card__add-btn",
						leftIcon: /* @__PURE__ */ (0, import_jsx_runtime$8.jsx)(AddToChatIcon, { size: 16 }),
						onClick: handleAddToTaskClick,
						children: t("tencentLexiang.banner.addToTask")
					})
				]
			})]
		});
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/pages/space-detail/index.tsx
var import_react$7, import_jsx_runtime$7, VIEW_MODE_LIST, VIEW_MODE_CATALOG, LexiangSpaceDetailPage;
var init_space_detail = __esmMin((() => {
	init_space_detail$1();
	init_src();
	import_react$7 = /* @__PURE__ */ __toESM(require_react());
	init_contexts();
	init_use_named_page_show();
	init_useI18n();
	init_api();
	init_auth();
	init_catalog_view();
	init_ui_icons();
	init_list_view();
	init_preview_modal();
	init_selection_action_bar();
	init_constants();
	init_store();
	init_telemetry();
	init_space_info_card();
	import_jsx_runtime$7 = require_jsx_runtime();
	VIEW_MODE_LIST = "list";
	VIEW_MODE_CATALOG = "catalog";
	LexiangSpaceDetailPage = () => {
		const t = useTranslation();
		const adapter = useAdapter();
		const { authStatus } = useLexiangAuth();
		useNamedElementShow({
			active: authStatus === "connected",
			elementId: "knowledge_base_file_list",
			elementName: "乐享文件列表",
			props: { type: "lexiang" }
		});
		const openId = useLexiangAuth((s) => s.currentOpenId);
		const viewMode = useTencentLexiangStore((s) => s.viewMode);
		const setViewMode = useTencentLexiangStore((s) => s.setViewMode);
		const setCurrentKnowledgeBase = useTencentLexiangStore((s) => s.setCurrentKnowledgeBase);
		const setPersonalKbInfo = useTencentLexiangStore((s) => s.setPersonalKbInfo);
		const accountScopedVersion = useTencentLexiangStore((s) => s.accountScopedVersion);
		const currentKbId = useTencentLexiangStore((s) => s.currentKnowledgeBase?.id);
		const personalKbId = useTencentLexiangStore((s) => s.personalKbInfo?.id);
		const kbLoadedRef = (0, import_react$7.useRef)(false);
		const lastLoadedOpenIdRef = (0, import_react$7.useRef)(null);
		const lastLoadedAccountVersionRef = (0, import_react$7.useRef)(accountScopedVersion);
		(0, import_react$7.useEffect)(() => {
			if (lastLoadedAccountVersionRef.current !== accountScopedVersion) {
				kbLoadedRef.current = false;
				lastLoadedOpenIdRef.current = null;
				lastLoadedAccountVersionRef.current = accountScopedVersion;
			}
			if (authStatus !== "connected") {
				kbLoadedRef.current = false;
				lastLoadedOpenIdRef.current = null;
				return;
			}
			if (kbLoadedRef.current && lastLoadedOpenIdRef.current !== (openId ?? null)) kbLoadedRef.current = false;
			if (kbLoadedRef.current) return;
			kbLoadedRef.current = true;
			lastLoadedOpenIdRef.current = openId ?? null;
			const cachedKb = readLastSelectedKbFromCache();
			if (cachedKb) {
				if (!tencentLexiangStore.getState().currentKnowledgeBase) setCurrentKnowledgeBase(cachedKb);
				reportLibraryListPageShow(adapter);
				return;
			}
			let cancelled = false;
			const fallbackToPersonalSpace = () => {
				fetchPersonalSpace().then((data) => {
					if (cancelled) return;
					const space = data?.space;
					if (!space?.id) {
						kbLoadedRef.current = false;
						return;
					}
					if (!tencentLexiangStore.getState().currentKnowledgeBase) setCurrentKnowledgeBase({
						id: space.id,
						name: space.name,
						avatar: space.logo || void 0,
						home_url: buildKbHomeUrl(space.id),
						rootEntryId: space.root_entry_id
					});
					setPersonalKbInfo({
						id: space.id,
						logo: space.logo,
						description: space.description,
						rootEntryId: space.root_entry_id
					});
					reportLibraryListPageShow(adapter);
				}).catch(() => {
					if (!cancelled) kbLoadedRef.current = false;
				});
			};
			fetchExampleSpace().then((data) => {
				if (cancelled) return;
				const exampleSpace = data?.spaces?.[0];
				if (!exampleSpace?.id) {
					fallbackToPersonalSpace();
					return;
				}
				if (!tencentLexiangStore.getState().currentKnowledgeBase) setCurrentKnowledgeBase({
					id: exampleSpace.id,
					name: exampleSpace.name,
					avatar: exampleSpace.logo || void 0,
					home_url: buildKbHomeUrl(exampleSpace.id),
					rootEntryId: exampleSpace.root_entry_id,
					teamId: exampleSpace.team_id
				});
				reportLibraryListPageShow(adapter);
			}).catch(() => {
				if (!cancelled) fallbackToPersonalSpace();
			});
			return () => {
				cancelled = true;
				kbLoadedRef.current = false;
			};
		}, [
			authStatus,
			openId,
			accountScopedVersion
		]);
		const personalSpaceFetchingRef = (0, import_react$7.useRef)(false);
		(0, import_react$7.useEffect)(() => {
			if (authStatus !== "connected") return;
			if (!(!personalKbId || currentKbId && currentKbId === personalKbId)) return;
			if (personalSpaceFetchingRef.current) return;
			personalSpaceFetchingRef.current = true;
			fetchPersonalSpace().then((data) => {
				if (data?.space?.id) setPersonalKbInfo({
					id: data.space.id,
					logo: data.space.logo,
					description: data.space.description,
					rootEntryId: data.space.root_entry_id
				});
			}).catch(() => {}).finally(() => {
				personalSpaceFetchingRef.current = false;
			});
		}, [
			authStatus,
			openId,
			currentKbId,
			personalKbId,
			setPersonalKbInfo
		]);
		return /* @__PURE__ */ (0, import_jsx_runtime$7.jsxs)(import_jsx_runtime$7.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime$7.jsxs)("div", {
			className: "tencent-lexiang-panel__scroll",
			children: [/* @__PURE__ */ (0, import_jsx_runtime$7.jsx)(SpaceInfoCard, {}), /* @__PURE__ */ (0, import_jsx_runtime$7.jsxs)("section", {
				className: "tencent-lexiang-panel__files",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime$7.jsxs)("header", {
						className: "tencent-lexiang-panel__files-header",
						children: [/* @__PURE__ */ (0, import_jsx_runtime$7.jsx)("h3", {
							className: "tencent-lexiang-panel__files-title",
							children: t("tencentLexiang.list.allKnowledge")
						}), /* @__PURE__ */ (0, import_jsx_runtime$7.jsxs)("div", {
							className: "tencent-lexiang-view-toggle",
							children: [/* @__PURE__ */ (0, import_jsx_runtime$7.jsx)(Tooltip, {
								content: t("tencentLexiang.list.view.catalog"),
								children: /* @__PURE__ */ (0, import_jsx_runtime$7.jsx)("button", {
									type: "button",
									className: `tencent-lexiang-view-toggle__btn${viewMode === VIEW_MODE_CATALOG ? " is-active" : ""}`,
									onClick: () => setViewMode(VIEW_MODE_CATALOG),
									"aria-label": t("tencentLexiang.list.view.catalog"),
									children: /* @__PURE__ */ (0, import_jsx_runtime$7.jsx)(CatalogViewIcon, { size: 14 })
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime$7.jsx)(Tooltip, {
								content: t("tencentLexiang.list.view.list"),
								children: /* @__PURE__ */ (0, import_jsx_runtime$7.jsx)("button", {
									type: "button",
									className: `tencent-lexiang-view-toggle__btn${viewMode === VIEW_MODE_LIST ? " is-active" : ""}`,
									onClick: () => setViewMode(VIEW_MODE_LIST),
									"aria-label": t("tencentLexiang.list.view.list"),
									children: /* @__PURE__ */ (0, import_jsx_runtime$7.jsx)(ListViewIcon, { size: 14 })
								})
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime$7.jsx)("div", { className: "tencent-lexiang-panel__files-divider" }),
					/* @__PURE__ */ (0, import_jsx_runtime$7.jsx)("div", {
						className: "tencent-lexiang-panel__files-body",
						children: viewMode === VIEW_MODE_LIST ? /* @__PURE__ */ (0, import_jsx_runtime$7.jsx)(ListView, {}) : /* @__PURE__ */ (0, import_jsx_runtime$7.jsx)(CatalogView, {})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime$7.jsx)(SelectionActionBar, {})
				]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime$7.jsx)(PreviewModal, {})] });
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/pages/space-list/space-list.less
var init_space_list$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/pages/space-list/components/space-card.less
var init_space_card$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/pages/space-list/components/space-item-decorator.less
var init_space_item_decorator$1 = __esmMin((() => {})), import_jsx_runtime$6, COLOR_COUNT, SpaceItemDecorator;
var init_space_item_decorator = __esmMin((() => {
	init_space_item_decorator$1();
	require_react();
	import_jsx_runtime$6 = require_jsx_runtime();
	COLOR_COUNT = 9;
	SpaceItemDecorator = ({ index = 0 }) => {
		return /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)("div", { className: `lexiang-space-decorator lexiang-space-decorator--c${(index % COLOR_COUNT + COLOR_COUNT) % COLOR_COUNT}` });
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/pages/space-list/components/space-card.tsx
var import_react$5, import_jsx_runtime$5, MAX_ENTRIES, SpaceCard;
var init_space_card = __esmMin((() => {
	init_space_card$1();
	init_src();
	import_react$5 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_api();
	init_kb_default_icon();
	init_ui_icons();
	init_constants();
	init_use_lexiang_logo();
	init_store();
	init_utils();
	init_space_item_decorator();
	import_jsx_runtime$5 = require_jsx_runtime();
	MAX_ENTRIES = 4;
	SpaceCard = ({ space, index, onOpen }) => {
		const t = useTranslation();
		const { imgRef: logoRef, ready: showLogo, onError: handleLogoError } = useLexiangLogo({ rawLogo: space.logo });
		const [entries, setEntries] = (0, import_react$5.useState)([]);
		const [loading, setLoading] = (0, import_react$5.useState)(true);
		const handleEntryClick = (entry) => {
			const store = tencentLexiangStore.getState();
			store.goToSpaceDetail({
				id: space.id,
				name: space.name,
				avatar: space.logo || void 0,
				home_url: buildKbHomeUrl(space.id),
				rootEntryId: space.root_entry_id,
				teamId: space.team_id
			});
			const ext = entry.name?.includes(".") ? entry.name.split(".").pop() : void 0;
			const file = {
				id: entry.id,
				title: entry.name,
				type: ext ? inferFileTypeFromExt(ext) : "other",
				is_folder: entry.entry_type === "folder",
				owner: { name: "" },
				updated_at: Date.now(),
				entry_type: entry.entry_type,
				extension: ext
			};
			store.openPreview(file);
		};
		(0, import_react$5.useEffect)(() => {
			let cancelled = false;
			setLoading(true);
			fetchLatestEntries(space.id, MAX_ENTRIES).then((data) => {
				if (cancelled) return;
				setEntries(data.entries ?? []);
			}).catch(() => {}).finally(() => {
				if (cancelled) return;
				setLoading(false);
			});
			return () => {
				cancelled = true;
			};
		}, [space.id]);
		return /* @__PURE__ */ (0, import_jsx_runtime$5.jsxs)("div", {
			className: "lexiang-space-card-wrapper",
			children: [/* @__PURE__ */ (0, import_jsx_runtime$5.jsx)(SpaceItemDecorator, { index }), /* @__PURE__ */ (0, import_jsx_runtime$5.jsxs)("div", {
				className: "lexiang-space-card",
				onClick: () => onOpen(space),
				children: [/* @__PURE__ */ (0, import_jsx_runtime$5.jsxs)("div", {
					className: "lexiang-space-card__header",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime$5.jsxs)("div", {
							className: "lexiang-space-card__logo",
							children: [/* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("img", {
								ref: logoRef,
								alt: space.name,
								draggable: false,
								referrerPolicy: "no-referrer",
								onError: handleLogoError,
								style: showLogo ? void 0 : { display: "none" }
							}), !showLogo && /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)(KbDefaultIcon, { size: 32 })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("div", {
							className: "lexiang-space-card__name",
							title: space.name,
							children: space.name
						}),
						space.is_pinned ? /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)(Tooltip, {
							content: t("tencentLexiang.spaceCard.pinned"),
							children: /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("span", {
								className: "lexiang-space-card__pin",
								"aria-label": t("tencentLexiang.spaceCard.pinned"),
								children: /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)(PinFillIcon, { size: 16 })
							})
						}) : null
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("div", {
					className: "lexiang-space-card__body",
					children: loading ? null : entries.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("ul", {
						className: "lexiang-space-card__entries",
						children: entries.slice(0, MAX_ENTRIES).map((entry) => /* @__PURE__ */ (0, import_jsx_runtime$5.jsxs)("li", {
							className: "lexiang-space-card__entry",
							onClick: (e) => {
								e.stopPropagation();
								handleEntryClick(entry);
							},
							children: [/* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("span", { className: "lexiang-space-card__entry-dot" }), /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("span", {
								className: "lexiang-space-card__entry-name",
								title: entry.name,
								children: entry.name
							})]
						}, entry.id))
					}) : /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("div", {
						className: "lexiang-space-card__empty-text",
						children: t("tencentLexiang.spaceCard.empty")
					})
				})]
			})]
		});
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/pages/space-list/components/space-sort-popover.less
var init_space_sort_popover$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/pages/space-list/components/space-sort-popover.tsx
var import_react$4, import_jsx_runtime$4, DEFAULT_SPACE_SORT, SpaceSortPopover;
var init_space_sort_popover = __esmMin((() => {
	init_space_sort_popover$1();
	init_src();
	import_react$4 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_ui_icons();
	import_jsx_runtime$4 = require_jsx_runtime();
	DEFAULT_SPACE_SORT = "-edited_at";
	SpaceSortPopover = ({ value, onChange }) => {
		const t = useTranslation();
		const [open, setOpen] = (0, import_react$4.useState)(false);
		const OPTIONS = [{
			value: "-edited_at",
			label: t("tencentLexiang.spaceList.sortByEdited")
		}, {
			value: "-created_at",
			label: t("tencentLexiang.spaceList.sortByCreated")
		}];
		const handleSelect = (next) => {
			onChange(next);
			setOpen(false);
		};
		return /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)(Popover, {
			open,
			onOpenChange: setOpen,
			placement: "bottom-start",
			trigger: /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)("button", {
				type: "button",
				className: "lexiang-space-sort-btn",
				title: t("tencentLexiang.spaceList.sort"),
				"aria-label": t("tencentLexiang.spaceList.sort"),
				children: /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)(SortIcon, { size: 16 })
			}),
			role: "menu",
			children: /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)("div", {
				className: "lexiang-space-sort-menu",
				children: OPTIONS.map((opt) => /* @__PURE__ */ (0, import_jsx_runtime$4.jsxs)("div", {
					className: ["lexiang-space-sort-menu__item", opt.value === value ? "is-active" : ""].filter(Boolean).join(" "),
					onClick: () => handleSelect(opt.value),
					children: [/* @__PURE__ */ (0, import_jsx_runtime$4.jsx)("span", {
						className: "lexiang-space-sort-menu__label",
						children: opt.label
					}), opt.value === value ? /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)(CheckIcon, {
						size: 14,
						className: "lexiang-space-sort-menu__check"
					}) : null]
				}, opt.value))
			})
		});
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/pages/space-list/components/team-info-card.tsx
var import_react$3, import_jsx_runtime$3, TeamInfoCard;
var init_team_info_card = __esmMin((() => {
	init_src();
	import_react$3 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_privilege_service();
	init_team_logo_default();
	init_create_space_dialog();
	init_ui_icons();
	init_use_goto_lexiang();
	init_use_lexiang_add_to_task();
	init_use_lexiang_logo();
	init_lexiang_content_blocks();
	init_utils();
	import_jsx_runtime$3 = require_jsx_runtime();
	TeamInfoCard = ({ team }) => {
		const t = useTranslation();
		const { addBlocksToTask } = useLexiangAddToTask();
		const { gotoLexiang } = useGotoLexiang();
		const { imgRef: logoRef, ready: showLogo, onError: handleLogoError } = useLexiangLogo({ rawLogo: team?.logo });
		const [createSpaceOpen, setCreateSpaceOpen] = (0, import_react$3.useState)(false);
		const [canCreateSpace, setCanCreateSpace] = (0, import_react$3.useState)(false);
		const [canManageTeam, setCanManageTeam] = (0, import_react$3.useState)(false);
		const [moreDropdownOpen, setMoreDropdownOpen] = (0, import_react$3.useState)(false);
		(0, import_react$3.useEffect)(() => {
			if (!team?.id) return;
			let cancelled = false;
			fetchStaffPermissions(team.id, "team").then((perms) => {
				if (cancelled) return;
				setCanCreateSpace(perms.includes("create_space"));
				setCanManageTeam(perms.includes("manage_team"));
			}).catch(() => {});
			return () => {
				cancelled = true;
			};
		}, [team?.id]);
		const handleAddToTask = () => {
			if (!team) return;
			addBlocksToTask([buildTeamBlock({
				id: team.id,
				name: team.name
			})]);
		};
		const handleGotoInLexiang = (0, import_react$3.useCallback)(async (path) => {
			if (!team?.code) return;
			await gotoLexiang({ homeUrl: getLexiangHomeUrl({
				teamCode: team.code,
				path
			}) });
		}, [gotoLexiang, team?.code]);
		const moreItems = [
			{
				key: "edit-info",
				label: t("tencentLexiang.teamInfoCard.editInfo"),
				icon: /* @__PURE__ */ (0, import_jsx_runtime$3.jsx)(EditIcon, { size: 16 }),
				action: () => handleGotoInLexiang(`/t/${team?.code}/settings/profile`)
			},
			{
				key: "members",
				label: t("tencentLexiang.teamInfoCard.members"),
				icon: /* @__PURE__ */ (0, import_jsx_runtime$3.jsx)(UserIcon, { size: 16 }),
				action: () => handleGotoInLexiang(`/t/${team?.code}/settings/access`)
			},
			{
				key: "manage",
				label: t("tencentLexiang.teamInfoCard.manage"),
				icon: /* @__PURE__ */ (0, import_jsx_runtime$3.jsx)(SettingIcon, { size: 16 }),
				divider: true,
				action: () => handleGotoInLexiang(`/t/${team?.code}/settings/overview`)
			}
		];
		const signature = team?.signature?.trim();
		const logoNode = /* @__PURE__ */ (0, import_jsx_runtime$3.jsxs)(import_jsx_runtime$3.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime$3.jsx)("img", {
			ref: logoRef,
			alt: team?.name ?? "",
			draggable: false,
			referrerPolicy: "no-referrer",
			onError: handleLogoError,
			style: showLogo ? void 0 : { display: "none" }
		}), !showLogo && /* @__PURE__ */ (0, import_jsx_runtime$3.jsx)("img", {
			src: "" + new URL("team-logo-default-CNwkbOOP.png", import.meta.url).href,
			alt: "",
			width: 32,
			height: 32,
			draggable: false
		})] });
		if (!team) return /* @__PURE__ */ (0, import_jsx_runtime$3.jsxs)("div", {
			className: "lexiang-space-list-page__team-card",
			children: [/* @__PURE__ */ (0, import_jsx_runtime$3.jsx)("div", {
				className: "lexiang-space-list-page__team-logo",
				children: /* @__PURE__ */ (0, import_jsx_runtime$3.jsx)("img", {
					src: team_logo_default_default,
					alt: "",
					width: 32,
					height: 32,
					draggable: false
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime$3.jsx)("div", {
				className: "lexiang-space-list-page__team-info",
				children: /* @__PURE__ */ (0, import_jsx_runtime$3.jsx)("h2", {
					className: "lexiang-space-list-page__team-name",
					children: "—"
				})
			})]
		});
		return /* @__PURE__ */ (0, import_jsx_runtime$3.jsxs)(import_jsx_runtime$3.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime$3.jsxs)("div", {
			className: "lexiang-space-list-page__team-card",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime$3.jsx)("div", {
					className: "lexiang-space-list-page__team-logo",
					children: logoNode
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$3.jsxs)("div", {
					className: "lexiang-space-list-page__team-info",
					children: [/* @__PURE__ */ (0, import_jsx_runtime$3.jsx)("h2", {
						className: "lexiang-space-list-page__team-name",
						title: team.name,
						children: team.name
					}), signature ? /* @__PURE__ */ (0, import_jsx_runtime$3.jsx)("p", {
						className: "lexiang-space-list-page__team-signature",
						title: signature,
						children: signature
					}) : null]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$3.jsxs)("div", {
					className: "lexiang-space-list-page__team-actions",
					children: [
						canCreateSpace && /* @__PURE__ */ (0, import_jsx_runtime$3.jsx)(Tooltip, {
							content: t("tencentLexiang.teamInfoCard.createSpace"),
							placement: "top",
							children: /* @__PURE__ */ (0, import_jsx_runtime$3.jsx)("span", {
								className: "lexiang-space-list-page__team-icon-btn",
								onClick: () => setCreateSpaceOpen(true),
								role: "button",
								tabIndex: 0,
								onKeyDown: (e) => {
									if (e.key === "Enter" || e.key === " ") setCreateSpaceOpen(true);
								},
								"aria-label": t("tencentLexiang.teamInfoCard.createSpace"),
								children: /* @__PURE__ */ (0, import_jsx_runtime$3.jsx)(PlusIcon, { size: 16 })
							})
						}),
						canManageTeam && /* @__PURE__ */ (0, import_jsx_runtime$3.jsx)(Tooltip, {
							content: moreDropdownOpen ? void 0 : t("tencentLexiang.teamInfoCard.more"),
							placement: "top",
							children: /* @__PURE__ */ (0, import_jsx_runtime$3.jsx)("span", {
								style: { display: "inline-flex" },
								children: /* @__PURE__ */ (0, import_jsx_runtime$3.jsx)(Dropdown, {
									placement: "bottom-end",
									items: moreItems,
									open: moreDropdownOpen,
									onOpenChange: setMoreDropdownOpen,
									onSelect: (key) => {
										moreItems.find((i) => i.key === key)?.action();
									},
									trigger: /* @__PURE__ */ (0, import_jsx_runtime$3.jsx)("span", {
										className: "lexiang-space-list-page__team-icon-btn",
										role: "button",
										tabIndex: 0,
										"aria-label": t("tencentLexiang.teamInfoCard.more"),
										children: /* @__PURE__ */ (0, import_jsx_runtime$3.jsx)(MoreIcon, { size: 16 })
									})
								})
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime$3.jsx)(Button, {
							variant: "primary",
							className: "lexiang-space-list-page__team-add-btn",
							onClick: handleAddToTask,
							leftIcon: /* @__PURE__ */ (0, import_jsx_runtime$3.jsx)(AddToChatIcon, { size: 16 }),
							children: t("tencentLexiang.teamInfoCard.addToTask")
						})
					]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime$3.jsx)(CreateSpaceDialog, {
			open: createSpaceOpen,
			onOpenChange: setCreateSpaceOpen,
			defaultTeam: team ? {
				id: team.id,
				name: team.name
			} : void 0
		})] });
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/pages/space-list/index.tsx
var import_react$2, import_jsx_runtime$2, PAGE_SIZE, LexiangSpaceListPage;
var init_space_list = __esmMin((() => {
	init_space_list$1();
	init_src();
	import_react$2 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_api();
	init_privilege_service();
	init_create_space_dialog();
	init_ui_icons();
	init_constants();
	init_store();
	init_space_card();
	init_space_item_decorator();
	init_space_sort_popover();
	init_team_info_card();
	import_jsx_runtime$2 = require_jsx_runtime();
	PAGE_SIZE = 20;
	LexiangSpaceListPage = () => {
		const t = useTranslation();
		const team = useTencentLexiangStore((s) => s.currentTeam) ?? void 0;
		const selectedTeamId = team?.id ?? null;
		const [spaces, setSpaces] = (0, import_react$2.useState)([]);
		const [pinnedSpaces, setPinnedSpaces] = (0, import_react$2.useState)([]);
		const [sortBy, setSortBy] = (0, import_react$2.useState)(DEFAULT_SPACE_SORT);
		const [canCreateSpace, setCanCreateSpace] = (0, import_react$2.useState)(false);
		const [createSpaceOpen, setCreateSpaceOpen] = (0, import_react$2.useState)(false);
		(0, import_react$2.useEffect)(() => {
			if (!selectedTeamId) {
				setCanCreateSpace(false);
				return;
			}
			let cancelled = false;
			fetchStaffPermissions(selectedTeamId, "team").then((perms) => {
				if (!cancelled) setCanCreateSpace(perms.includes("create_space"));
			}).catch(() => {
				if (!cancelled) setCanCreateSpace(false);
			});
			return () => {
				cancelled = true;
			};
		}, [selectedTeamId]);
		const pageTokenRef = (0, import_react$2.useRef)(void 0);
		const teamIdRef = (0, import_react$2.useRef)(null);
		const sortByRef = (0, import_react$2.useRef)(DEFAULT_SPACE_SORT);
		const scrollRef = (0, import_react$2.useRef)(null);
		(0, import_react$2.useEffect)(() => {
			teamIdRef.current = selectedTeamId;
			sortByRef.current = sortBy;
			pageTokenRef.current = void 0;
			setSpaces([]);
			scrollRef.current?.reset();
		}, [selectedTeamId, sortBy]);
		(0, import_react$2.useEffect)(() => {
			if (!selectedTeamId) {
				setPinnedSpaces([]);
				return;
			}
			let cancelled = false;
			const teamIdAtCall = selectedTeamId;
			fetchPinnedTeamSpaces(teamIdAtCall, 20, "view").then((data) => {
				if (cancelled) return;
				if (teamIdRef.current !== teamIdAtCall) return;
				setPinnedSpaces(data.spaces ?? []);
			}).catch((err) => {
				console.warn("[LexiangSpaceList] fetchPinnedTeamSpaces failed:", err);
			});
			return () => {
				cancelled = true;
			};
		}, [selectedTeamId]);
		const handleLoadMore = (0, import_react$2.useCallback)(async () => {
			const teamId = teamIdRef.current;
			if (!teamId) throw new Error("[space-list] no team");
			const currentSort = sortByRef.current;
			const currentTeam = teamId;
			const reqToken = pageTokenRef.current;
			const data = await fetchTeamSpaces(teamId, PAGE_SIZE, reqToken, {
				sortBy: currentSort,
				permission: "view"
			});
			if (teamIdRef.current !== currentTeam || sortByRef.current !== currentSort) throw new Error("[space-list] stale request discarded");
			const newSpaces = data.spaces ?? [];
			pageTokenRef.current = data.next_page_token || void 0;
			if (newSpaces.length > 0) setSpaces((prev) => {
				const seen = new Set(prev.map((s) => s.id));
				const appended = [];
				for (const s of newSpaces) {
					if (seen.has(s.id)) continue;
					seen.add(s.id);
					appended.push(s);
				}
				return appended.length === 0 ? prev : [...prev, ...appended];
			});
			if (newSpaces.length < PAGE_SIZE) return [];
			return newSpaces;
		}, []);
		const handleOpenSpace = (0, import_react$2.useCallback)((space) => {
			tencentLexiangStore.getState().goToSpaceDetail({
				id: space.id,
				name: space.name,
				avatar: space.logo,
				home_url: buildKbHomeUrl(space.id),
				rootEntryId: space.root_entry_id,
				teamId: space.team_id ?? selectedTeamId ?? void 0
			});
		}, [selectedTeamId]);
		const scrollKey = (0, import_react$2.useMemo)(() => `${selectedTeamId ?? "__none__"}::${sortBy}`, [selectedTeamId, sortBy]);
		const displaySpaces = (0, import_react$2.useMemo)(() => {
			if (pinnedSpaces.length === 0) return spaces;
			const seen = /* @__PURE__ */ new Set();
			const merged = [];
			for (const item of pinnedSpaces) {
				if (seen.has(item.id)) continue;
				seen.add(item.id);
				merged.push(item);
			}
			for (const item of spaces) {
				if (seen.has(item.id)) continue;
				seen.add(item.id);
				merged.push(item);
			}
			return merged;
		}, [pinnedSpaces, spaces]);
		if (!selectedTeamId) return /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)("div", {
			className: "lexiang-space-list-page",
			children: /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)("div", {
				className: "lexiang-space-list-page__container",
				children: /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)("div", {
					className: "lexiang-space-list-page__empty",
					children: t("tencentLexiang.spaceList.selectTeam")
				})
			})
		});
		return /* @__PURE__ */ (0, import_jsx_runtime$2.jsxs)(ScrollLoadMore, {
			ref: scrollRef,
			className: "lexiang-space-list-page",
			onRequest: handleLoadMore,
			threshold: 100,
			children: [/* @__PURE__ */ (0, import_jsx_runtime$2.jsxs)("div", {
				className: "lexiang-space-list-page__container",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime$2.jsx)(TeamInfoCard, { team }),
					/* @__PURE__ */ (0, import_jsx_runtime$2.jsxs)("div", {
						className: "lexiang-space-list-page__list-header",
						children: [/* @__PURE__ */ (0, import_jsx_runtime$2.jsx)("h3", {
							className: "lexiang-space-list-page__list-title",
							children: t("tencentLexiang.sidebar.teamKb")
						}), /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)(SpaceSortPopover, {
							value: sortBy,
							onChange: setSortBy
						})]
					}),
					displaySpaces.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)("div", {
						className: "lexiang-space-list-page__empty",
						children: t("tencentLexiang.spaceList.empty")
					}) : /* @__PURE__ */ (0, import_jsx_runtime$2.jsxs)("div", {
						className: "lexiang-space-list-page__grid",
						children: [displaySpaces.map((space, idx) => /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)(SpaceCard, {
							space,
							index: idx,
							onOpen: handleOpenSpace
						}, space.id)), canCreateSpace && /* @__PURE__ */ (0, import_jsx_runtime$2.jsxs)("div", {
							className: "lexiang-space-card-wrapper lexiang-space-card-wrapper--create",
							children: [/* @__PURE__ */ (0, import_jsx_runtime$2.jsx)(SpaceItemDecorator, { index: 0 }), /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)(Button, {
								variant: "ghost",
								className: "lexiang-space-card lexiang-space-card--create",
								onClick: () => setCreateSpaceOpen(true),
								leftIcon: /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)(PlusIcon, { size: 20 }),
								children: t("tencentLexiang.teamInfoCard.createSpace")
							})]
						})]
					})
				]
			}), team && /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)(CreateSpaceDialog, {
				open: createSpaceOpen,
				onOpenChange: setCreateSpaceOpen,
				defaultTeam: {
					id: team.id,
					name: team.name
				}
			})]
		}, scrollKey);
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/index.tsx
var import_react$1, import_jsx_runtime$1, LAST_LEXIANG_ACCOUNT_UID_KEY, PERSISTED_LAST_LEXIANG_ACCOUNT_UID_KEY, TencentLexiangPanel;
var init_tencent_lexiang = __esmMin((() => {
	init_tencent_lexiang_panel();
	import_react$1 = /* @__PURE__ */ __toESM(require_react());
	init_dist();
	init_contexts();
	init_use_oneid_applications();
	init_use_oneid_connector_gate();
	init_useI18n();
	init_oneid_refresh_throttle();
	init_utils$1();
	init_router();
	init_app_providers();
	init_single_service_panel();
	init_workbuddy_topbar();
	init_account_cookie_clear_policy();
	init_auth();
	init_lexiang_layout();
	init_library_iframe_view();
	init_post_activation_gate();
	init_constants();
	init_use_goto_lexiang();
	init_use_lexiang_library_mode();
	init_space_detail();
	init_space_list();
	init_store();
	init_utils();
	import_jsx_runtime$1 = require_jsx_runtime();
	LAST_LEXIANG_ACCOUNT_UID_KEY = "lexiang.lastAccountUid";
	PERSISTED_LAST_LEXIANG_ACCOUNT_UID_KEY = "wb:lexiang:last-account-uid";
	TencentLexiangPanel = () => {
		const t = useTranslation();
		const adapter = useAdapter();
		const { authStatus } = useLexiangAuth();
		const postActivationGate = useLexiangAuth((s) => s.postActivationGate);
		const currentKb = useTencentLexiangStore((s) => s.currentKnowledgeBase);
		const currentAccount = useCurrentAccount();
		const services = useAgentServices();
		const tencentLexiangFacade = services?.tencentLexiang;
		const tencentDocsFacade = services?.tencentDocs;
		const isTencentUser = isIOAUser(currentAccount?.enterpriseId ?? "");
		const { gotoLexiang } = useGotoLexiang();
		const clearLexiangWebCookies = (0, import_react$1.useCallback)((reason) => {
			tencentLexiangFacade?.clearWebCookies({ reason }).catch(() => {});
		}, [tencentLexiangFacade]);
		const lexiangOneidGate = useOneidConnectorGate("lexiang");
		const isEnterpriseDisabled = lexiangOneidGate.enterpriseGate && lexiangOneidGate.status === "disabled";
		const isActive = matchShellRoute(useLocation().pathname)?.handle.view === "lexiang";
		const isIframeMode = useLexiangLibraryMode() === "iframe";
		const shouldBypassAuthGuard = isIframeMode;
		const isLexiangConnected = authStatus === "connected" || shouldBypassAuthGuard;
		const shouldShowPostActivationGate = postActivationGate === "pending" || postActivationGate === "timeout";
		const panelClassName = ["tencent-lexiang-panel", isIframeMode ? "tencent-lexiang-panel--iframe" : ""].filter(Boolean).join(" ");
		const panelStyle = (0, import_react$1.useMemo)(() => {
			if (isIframeMode && !isActive) return { display: "none" };
		}, [isIframeMode, isActive]);
		const oneidEnterpriseId = currentAccount?.enterpriseId ?? "";
		const oneidAccountUid = currentAccount?.uid ?? "";
		const lastOneidRefreshAtRef = (0, import_react$1.useRef)(0);
		const refreshOneidApplicationsIfStale = (0, import_react$1.useCallback)(() => {
			if (!lexiangOneidGate.enterpriseGate) return;
			const now = Date.now();
			if (!shouldRefreshOneidApplications(lastOneidRefreshAtRef.current, now)) return;
			lastOneidRefreshAtRef.current = now;
			refreshOneidApplications(tencentDocsFacade, oneidEnterpriseId, oneidAccountUid);
		}, [
			lexiangOneidGate.enterpriseGate,
			tencentDocsFacade,
			oneidEnterpriseId,
			oneidAccountUid
		]);
		(0, import_react$1.useEffect)(() => {
			if (isActive) refreshOneidApplicationsIfStale();
		}, [isActive, refreshOneidApplicationsIfStale]);
		(0, import_react$1.useEffect)(() => {
			if (!lexiangOneidGate.enterpriseGate || !isActive) return;
			const handleFocus = () => {
				if (document.visibilityState === "visible") refreshOneidApplicationsIfStale();
			};
			window.addEventListener("focus", handleFocus);
			document.addEventListener("visibilitychange", handleFocus);
			return () => {
				window.removeEventListener("focus", handleFocus);
				document.removeEventListener("visibilitychange", handleFocus);
			};
		}, [
			lexiangOneidGate.enterpriseGate,
			isActive,
			refreshOneidApplicationsIfStale
		]);
		const currentUid = currentAccount?.uid;
		(0, import_react$1.useEffect)(() => {
			let lastUid = null;
			let persistedLastUid = null;
			const cachedKb = readLastSelectedKbFromCache();
			try {
				lastUid = window.sessionStorage.getItem(LAST_LEXIANG_ACCOUNT_UID_KEY);
			} catch {}
			try {
				persistedLastUid = window.localStorage.getItem(PERSISTED_LAST_LEXIANG_ACCOUNT_UID_KEY);
			} catch {}
			const clearPolicy = resolveLexiangAccountCookieClearPolicy({
				currentUid,
				lastSessionUid: lastUid,
				persistedLastUid,
				hasCachedKb: Boolean(cachedKb)
			});
			if (clearPolicy.shouldResetAccountState) {
				tencentLexiangStore.getState().resetAccountScopedState();
				lexiangAuthStore.getState().stopPostActivationGate();
			}
			if (clearPolicy.shouldClearWebCookies) clearLexiangWebCookies("account-switch");
			try {
				if (currentUid) window.sessionStorage.setItem(LAST_LEXIANG_ACCOUNT_UID_KEY, currentUid);
				else window.sessionStorage.removeItem(LAST_LEXIANG_ACCOUNT_UID_KEY);
			} catch {}
			try {
				if (currentUid) window.localStorage.setItem(PERSISTED_LAST_LEXIANG_ACCOUNT_UID_KEY, currentUid);
				else window.localStorage.removeItem(PERSISTED_LAST_LEXIANG_ACCOUNT_UID_KEY);
			} catch {}
		}, [clearLexiangWebCookies, currentUid]);
		if (lexiangAuthStore.getState().adapter !== adapter) lexiangAuthStore.getState().setAdapter(adapter);
		if (lexiangAuthStore.getState().clearWebCookies !== clearLexiangWebCookies) lexiangAuthStore.getState().setClearWebCookies(clearLexiangWebCookies);
		const pendingLexiangOpen = useConversations().pendingLexiangOpen;
		const setPendingLexiangOpen = useConversations().setPendingLexiangOpen;
		const pageView = useTencentLexiangStore((s) => s.pageView);
		(0, import_react$1.useEffect)(() => {
			const lastView = readLastViewFromCache();
			if (!lastView) return;
			if (lastView.pageView === "space-list") tencentLexiangStore.getState().goToSpaceList(lastView.team);
			else if (lastView.pageView === "space-detail" && lastView.team) tencentLexiangStore.getState().setCurrentTeam(lastView.team);
		}, []);
		(0, import_react$1.useEffect)(() => () => {
			lexiangAuthStore.getState().stopPolling();
			lexiangAuthStore.getState().stopPostActivationGate();
		}, []);
		(0, import_react$1.useEffect)(() => {
			if (!isActive) tencentLexiangStore.getState().closePreview();
		}, [isActive]);
		(0, import_react$1.useEffect)(() => {
			if (!pendingLexiangOpen?.entryId) return;
			if (!isLexiangConnected) return;
			if (!isActive) return;
			const { entryId, entryType, kb, name } = pendingLexiangOpen;
			const storeApi = tencentLexiangStore.getState();
			if (kb?.id) {
				const current = storeApi.currentKnowledgeBase;
				if (!current || current.id !== kb.id) {
					storeApi.goToSpaceDetail({
						id: kb.id,
						name: kb.name,
						home_url: buildKbHomeUrl(kb.id),
						rootEntryId: kb.rootEntryId,
						teamId: kb.teamId
					});
					storeApi.clearSelected();
					storeApi.clearFileRegistry();
				} else if (storeApi.pageView !== "space-detail") storeApi.setPageView("space-detail");
			}
			if (isIframeMode) return;
			setPendingLexiangOpen?.(null);
			const ext = name?.includes(".") ? name.split(".").pop() : void 0;
			const minimalFile = {
				id: entryId,
				title: name || t("tencentLexiang.preview.untitled"),
				type: ext ? inferFileTypeFromExt(ext) : "other",
				is_folder: false,
				owner: { name: "" },
				updated_at: Date.now(),
				entry_type: entryType === "folder" || entryType === "flink" ? entryType : "page",
				extension: ext
			};
			storeApi.openPreview(minimalFile);
		}, [
			pendingLexiangOpen,
			isLexiangConnected,
			setPendingLexiangOpen,
			isActive,
			isIframeMode,
			t
		]);
		const handlePendingLexiangOpenConsumed = (0, import_react$1.useCallback)(() => {
			setPendingLexiangOpen?.(null);
		}, [setPendingLexiangOpen]);
		const handleGotoLexiang = (0, import_react$1.useCallback)(() => {
			const store = tencentLexiangStore.getState();
			gotoLexiang({
				homeUrl: store.pageView === "space-list" ? getLexiangHomeUrl({ teamCode: store.currentTeam?.code }) : getLexiangHomeUrl({ kbId: currentKb?.id }),
				isIframeMode
			});
		}, [
			currentKb?.id,
			gotoLexiang,
			isIframeMode
		]);
		if (!isIframeMode && !isActive) return null;
		return /* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("div", {
			className: panelClassName,
			style: panelStyle,
			children: [/* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(WorkBuddyTopBar, {}), isIframeMode ? /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(AuthGuard, {
				source: "library",
				className: "tencent-lexiang-panel__auth",
				isActive,
				silent: isTencentUser,
				bypass: shouldBypassAuthGuard,
				children: /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(LexiangLibraryIframeView, {
					isActive,
					pendingPreviewOpen: pendingLexiangOpen,
					onPendingPreviewOpenConsumed: handlePendingLexiangOpenConsumed
				})
			}) : isEnterpriseDisabled && !shouldShowPostActivationGate ? /* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)(import_jsx_runtime$1.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(LexiangHeading, {
				showActions: false,
				onGotoLexiang: handleGotoLexiang,
				adapter,
				isIframeMode
			}), /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(SingleServiceOnboardingPanel, { target: "lexiang" })] }) : shouldShowPostActivationGate ? /* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)(import_jsx_runtime$1.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(LexiangHeading, {
				showActions: false,
				onGotoLexiang: handleGotoLexiang,
				adapter,
				isIframeMode
			}), /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(LexiangPostActivationGate, {})] }) : /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(AuthGuard, {
				source: "library",
				className: "tencent-lexiang-panel__auth",
				isActive,
				silent: isTencentUser,
				bypass: shouldBypassAuthGuard,
				children: /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(LexiangLayout, {
					heading: /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(LexiangHeading, {
						showActions: isLexiangConnected,
						onGotoLexiang: handleGotoLexiang,
						adapter,
						isIframeMode
					}),
					sidebar: isLexiangConnected ? /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(LexiangSidebar, {}) : void 0,
					children: pageView === "space-list" ? /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(LexiangSpaceListPage, {}) : /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(LexiangSpaceDetailPage, {})
				})
			})]
		});
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/pages/lexiang.tsx
function LexiangPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TencentLexiangPanel, {});
}
var import_jsx_runtime;
//#endregion
__esmMin((() => {
	require_react();
	init_tencent_lexiang();
	import_jsx_runtime = require_jsx_runtime();
}))();
export { LexiangPage };
