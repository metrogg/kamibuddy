import { n as __esmMin, s as __toESM } from "./rolldown-runtime-D5a2oYpF.js";
import { AL as useOptionalImaApiBridge, Bv as init_use_oneid_app_status, Fu as init_constants, Go as init_auth_guide, Ko as init_use_lexiang_check_auth_gate, Rs as init_contexts, Ru as LEXIANG_WEB_ORIGIN_PROD, Vv as useOneidAppStatus, Wo as AuthGuide, Xo as init_telemetry, _u as lexiangAuthStore, bc as useAgentServices, cL as init_useI18n, fF as useIsEnterpriseEdition, gu as init_lexiang_auth_store, kL as init_ima_api_context, nu as init_lexiang_file_type_icon, qo as useLexiangCheckAuthGate, rs as reportLicenseDeniedPageShow, ru as isLexiangOnlineDocIcon, tu as getLexiangIconUrl, uF as init_use_is_enterprise_admin, uL as useTranslation, vc as init_app_providers, yu as useLexiangAuth, zL as useAdapter, zu as LEXIANG_WEB_ORIGIN_STAGING } from "./ui-docs-viewer-C2jT2eXi.js";
import { Du as require_react_dom, Ou as require_jsx_runtime, a as Breadcrumb, ku as require_react, t as init_src } from "./lib-chat-ui-ChIVprRk.js";
import { c as fetchEntryChildren, t as fetchRecentEntries } from "./entry-service-CYRgnsAK.js";
import { A as init_kb_default_icon, B as init_asset_service, D as TeamDefaultIcon, F as fetchLexiangTempLoginUrl, H as isDirectlyUsableLogoUrl, M as no_knowledge_base_update_default, O as init_team_default_icon, U as resolveSpaceLogoUrl, a as searchKb, c as fetchPinnedTeamSpaces, i as parseLexiangSearchExtraInfo, j as init_no_knowledge_base_update, k as KbDefaultIcon, l as fetchRecentSpaces, s as fetchPersonalSpace, t as init_api, u as fetchTeamSpaces, w as searchTeams, x as fetchFrequentTeams, z as init_auth_service } from "./api-Smo5IgCT.js";
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/styles/tokens.less
var init_tokens = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/picker/lexiang-content-picker.less
var init_lexiang_content_picker$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/hooks/use-lexiang-license.ts
/**
* @param enabled 是否需要触发 license 校验，调用方典型传值：
*                `picker.visible && isAuthorized`
*
* 注意：本 hook 内部还会强制叠加一道
*   `useIsEnterpriseEdition()` + `useOneidAppStatus('lexiang').status === 'enabled'`
* 的兜底判定，即使 `enabled=true` 但企业态/OneID 不满足也会落到 `skip`，
* 避免误用造成 C 端打扰。
*/
function useLexiangLicense(enabled) {
	const isEnterpriseEdition = useIsEnterpriseEdition();
	const oneidStatus = useOneidAppStatus("lexiang");
	const facade = useAgentServices()?.tencentLexiang;
	const shouldCheck = enabled && isEnterpriseEdition && oneidStatus.status === "enabled" && !!facade?.checkLicense;
	const shouldWaitOneid = enabled && isEnterpriseEdition && oneidStatus.status === "checking";
	const [status, setStatus] = (0, import_react$11.useState)(() => {
		if (shouldCheck || shouldWaitOneid) return "checking";
		return "skip";
	});
	const requestSeqRef = (0, import_react$11.useRef)(0);
	const performCheck = (0, import_react$11.useCallback)(async () => {
		if (!facade?.checkLicense) {
			setStatus("skip");
			return;
		}
		const seq = ++requestSeqRef.current;
		setStatus("checking");
		try {
			const resp = await facade.checkLicense();
			if (seq !== requestSeqRef.current) return;
			setStatus(resp?.data?.is_pass === true ? "pass" : "denied");
		} catch {
			if (seq !== requestSeqRef.current) return;
			setStatus("denied");
		}
	}, [facade]);
	(0, import_react$11.useEffect)(() => {
		if (shouldWaitOneid) {
			requestSeqRef.current += 1;
			setStatus("checking");
			return;
		}
		if (!shouldCheck) {
			requestSeqRef.current += 1;
			setStatus("skip");
			return;
		}
		let cancelled = false;
		performCheck().catch(() => {
			if (!cancelled) setStatus("denied");
		});
		return () => {
			cancelled = true;
			requestSeqRef.current += 1;
		};
	}, [
		shouldCheck,
		shouldWaitOneid,
		performCheck
	]);
	const refresh = (0, import_react$11.useCallback)(async () => {
		if (!shouldCheck) return;
		await performCheck();
	}, [shouldCheck, performCheck]);
	return {
		status,
		isAdmin: oneidStatus.isAdmin,
		refresh
	};
}
var import_react$11;
var init_use_lexiang_license = __esmMin((() => {
	import_react$11 = /* @__PURE__ */ __toESM(require_react());
	init_use_is_enterprise_admin();
	init_use_oneid_app_status();
	init_app_providers();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/license-denied/index.less
var init_license_denied$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/license-denied/index.tsx
function LexiangLicenseDeniedView({ isAdmin, onAssign }) {
	const t = useTranslation();
	const adapter = useAdapter();
	const [busy, setBusy] = (0, import_react$10.useState)(false);
	const hasReportedShowRef = (0, import_react$10.useRef)(false);
	(0, import_react$10.useEffect)(() => {
		if (hasReportedShowRef.current) return;
		hasReportedShowRef.current = true;
		reportLicenseDeniedPageShow(adapter);
	}, [adapter]);
	const text = isAdmin ? t("tencentLexiang.license.deniedAdmin") : t("tencentLexiang.license.deniedMember");
	const handleAssign = (0, import_react$10.useCallback)(async () => {
		if (!onAssign || busy) return;
		setBusy(true);
		try {
			await onAssign();
		} finally {
			setBusy(false);
		}
	}, [onAssign, busy]);
	return /* @__PURE__ */ (0, import_jsx_runtime$8.jsxs)("div", {
		className: "lexiang-license-denied",
		role: "status",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime$8.jsx)("img", {
				className: "lexiang-license-denied__icon",
				src: no_knowledge_base_update_default,
				alt: "",
				"aria-hidden": "true",
				draggable: false
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$8.jsx)("div", {
				className: "lexiang-license-denied__text",
				children: text
			}),
			isAdmin && !!onAssign && /* @__PURE__ */ (0, import_jsx_runtime$8.jsxs)("button", {
				type: "button",
				className: "lexiang-license-denied__action",
				onClick: handleAssign,
				disabled: busy,
				"aria-label": t("tencentLexiang.license.assignAction"),
				children: [busy && /* @__PURE__ */ (0, import_jsx_runtime$8.jsx)("span", {
					className: "lexiang-license-denied__action-spinner",
					"aria-hidden": "true"
				}), /* @__PURE__ */ (0, import_jsx_runtime$8.jsx)("span", { children: t("tencentLexiang.license.assignAction") })]
			})
		]
	});
}
var import_react$10, import_jsx_runtime$8;
var init_license_denied = __esmMin((() => {
	init_license_denied$1();
	import_react$10 = /* @__PURE__ */ __toESM(require_react());
	init_contexts();
	init_useI18n();
	init_no_knowledge_base_update();
	init_telemetry();
	import_jsx_runtime$8 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/picker/shared/kb-cascade-view.less
var init_kb_cascade_view$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/picker/shared/doc-tree-view.less
var init_doc_tree_view$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/picker/shared/picker-icons.tsx
/** 根据 DocItem.kind + extension 获取对应的图标 URL */
function getDocKindIconUrl(kind, extension) {
	return getLexiangIconUrl(kind, extension, kind === "folder");
}
/**
* 渲染文档类型图标（<img> 元素）。
*
* 在线文档（智能文档 / 智能表格等）使用品牌 PNG，带留白，视觉上在小尺寸下偏小。
* 调用方可通过 `onlineDocSize` 单独为在线文档指定更大的尺寸，保持与本地文件 SVG
* 视觉对齐（与 `LexiangFileTypeIcon` 的同名 prop 保持一致语义）。
*/
function DocKindIcon({ kind, extension, size = 24, onlineDocSize }) {
	if (kind === "kb") return /* @__PURE__ */ (0, import_jsx_runtime$7.jsx)(KbDefaultIcon, { size });
	const iconUrl = getDocKindIconUrl(kind, extension);
	const renderSize = isLexiangOnlineDocIcon(kind, extension, kind === "folder") && onlineDocSize ? onlineDocSize : size;
	return /* @__PURE__ */ (0, import_jsx_runtime$7.jsx)("img", {
		src: iconUrl,
		width: renderSize,
		height: renderSize,
		alt: extension || kind || "doc",
		draggable: false,
		style: {
			display: "block",
			width: renderSize,
			height: renderSize,
			flexShrink: 0
		}
	});
}
var import_jsx_runtime$7;
var init_picker_icons = __esmMin((() => {
	require_react();
	init_kb_default_icon();
	init_lexiang_file_type_icon();
	import_jsx_runtime$7 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/picker/shared/types.ts
/** 判断知识条目是否应展示展开入口 */
function isExpandableDoc(doc) {
	return doc.meta?.hasChildren === true;
}
var init_types = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/picker/shared/doc-tree-view.tsx
function DocTreeFooter({ depth, nodeState, onLoadMore, onRetry }) {
	const t = useTranslation();
	const sentinelRef = (0, import_react$8.useRef)(null);
	const shouldAutoLoad = !!nodeState?.loaded && !!nodeState.nextPageToken && !nodeState.loading;
	(0, import_react$8.useEffect)(() => {
		const sentinel = sentinelRef.current;
		if (!sentinel || !shouldAutoLoad || !onLoadMore) return;
		const scrollRoot = sentinel.closest(".lexiang-kb-cascade__col-body");
		const observer = new IntersectionObserver((entries) => {
			if (entries[0]?.isIntersecting) onLoadMore();
		}, {
			root: scrollRoot instanceof Element ? scrollRoot : null,
			rootMargin: "0px 0px 48px 0px",
			threshold: .1
		});
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [onLoadMore, shouldAutoLoad]);
	if (!nodeState) return null;
	if (nodeState.loading) return /* @__PURE__ */ (0, import_jsx_runtime$6.jsxs)("div", {
		className: "lexiang-doc-tree-footer",
		style: { paddingLeft: 40 + depth * 20 },
		children: [/* @__PURE__ */ (0, import_jsx_runtime$6.jsx)("span", { className: "lexiang-doc-tree-footer__spinner" }), /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)("span", { children: t("tencentLexiang.picker.loading") })]
	});
	if (nodeState.error) return /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)("button", {
		type: "button",
		className: "lexiang-doc-tree-footer lexiang-doc-tree-footer--action",
		style: { paddingLeft: 40 + depth * 20 },
		onClick: onRetry,
		children: t("tencentLexiang.catalog.loadFailed")
	});
	if (shouldAutoLoad) return /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)("div", {
		ref: sentinelRef,
		className: "lexiang-doc-tree-footer lexiang-doc-tree-footer--sentinel",
		style: { paddingLeft: 40 + depth * 20 },
		children: t("tencentLexiang.picker.loadMore")
	});
	return null;
}
function DocTreeNode({ doc, depth, getChildren, getNodeState, loadMoreChildren, retryChildren, selectionMode, selectedDocIds, onDocSelect, onFolderSelect, expandedIds, toggleExpand }) {
	const t = useTranslation();
	const isFolder = doc.kind === "folder";
	const canHaveChildren = isExpandableDoc(doc);
	const isExpanded = expandedIds.has(doc.id);
	const isSelected = selectedDocIds?.has(doc.id) ?? false;
	const children = canHaveChildren && isExpanded ? getChildren(doc.id) : [];
	const nodeState = canHaveChildren && isExpanded ? getNodeState?.(doc.id) : void 0;
	const collectDescendants = (0, import_react$8.useCallback)((folderId) => {
		const result = [];
		for (const child of getChildren(folderId)) {
			result.push(child);
			if (isExpandableDoc(child)) result.push(...collectDescendants(child.id));
		}
		return result;
	}, [getChildren]);
	const handleRowClick = () => {
		if (isFolder) toggleExpand(doc.id);
		else onDocSelect?.(doc);
	};
	const handleCheckboxClick = (e) => {
		e.stopPropagation();
		if (isFolder && onFolderSelect) onFolderSelect(doc, collectDescendants(doc.id));
		else onDocSelect?.(doc);
	};
	const handleArrowClick = (e) => {
		e.stopPropagation();
		toggleExpand(doc.id);
	};
	const isSticky = isFolder && isExpanded && depth === 0;
	const row = /* @__PURE__ */ (0, import_jsx_runtime$6.jsxs)("div", {
		className: [
			"lexiang-doc-tree-row",
			isFolder ? "lexiang-doc-tree-row--folder" : "",
			isSticky ? "lexiang-doc-tree-row--sticky" : "",
			isSelected ? "lexiang-doc-tree-row--selected" : ""
		].filter(Boolean).join(" "),
		style: {
			paddingLeft: 8 + depth * 20,
			top: isSticky ? -4 : void 0
		},
		onClick: handleRowClick,
		children: [
			canHaveChildren ? /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)("button", {
				type: "button",
				className: `lexiang-doc-tree-row__expand-btn${isExpanded ? " lexiang-doc-tree-row__expand-btn--expanded" : ""}`,
				onClick: handleArrowClick,
				"aria-label": isExpanded ? t("tencentLexiang.picker.collapse") : t("tencentLexiang.picker.expand"),
				children: /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)("svg", {
					width: "6",
					height: "10",
					viewBox: "0 0 6 10",
					fill: "none",
					"aria-hidden": "true",
					children: /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)("path", {
						d: "M1 1L5 5L1 9",
						stroke: "currentColor",
						strokeWidth: "1.5",
						strokeLinecap: "round",
						strokeLinejoin: "round"
					})
				})
			}) : /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)("span", { className: "lexiang-doc-tree-row__expand-placeholder" }),
			selectionMode === "checkbox" && /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)("span", {
				className: "lexiang-doc-tree-row__selector-wrap",
				onClick: handleCheckboxClick,
				children: /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)("span", {
					className: `lexiang-doc-tree-row__checkbox${isSelected ? " lexiang-doc-tree-row__checkbox--checked" : ""}`,
					children: /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)("svg", {
						viewBox: "0 0 10 10",
						fill: "none",
						children: /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)("path", {
							d: "M1.5 5.5L4 8L8.5 2",
							stroke: "currentColor",
							strokeWidth: "1.6",
							strokeLinecap: "round",
							strokeLinejoin: "round"
						})
					})
				})
			}),
			selectionMode === "radio" && /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)("span", {
				className: "lexiang-doc-tree-row__selector-wrap",
				onClick: handleCheckboxClick,
				children: /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)("span", {
					className: `lexiang-doc-tree-row__radio${isSelected ? " lexiang-doc-tree-row__radio--checked" : ""}`,
					"aria-hidden": "true"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$6.jsx)("span", {
				className: "lexiang-doc-tree-row__icon",
				children: doc.icon ?? /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)(DocKindIcon, {
					kind: doc.kind,
					extension: doc.extension,
					size: 20
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$6.jsx)("span", {
				className: "lexiang-doc-tree-row__name",
				children: doc.name
			})
		]
	});
	if (!canHaveChildren || !isExpanded) return row;
	return /* @__PURE__ */ (0, import_jsx_runtime$6.jsxs)("div", {
		className: "lexiang-doc-tree-folder-group",
		children: [
			row,
			children.map((child) => /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)(DocTreeNode, {
				doc: child,
				depth: depth + 1,
				getChildren,
				getNodeState,
				loadMoreChildren,
				retryChildren,
				selectionMode,
				selectedDocIds,
				onDocSelect,
				onFolderSelect,
				expandedIds,
				toggleExpand
			}, child.id)),
			/* @__PURE__ */ (0, import_jsx_runtime$6.jsx)(DocTreeFooter, {
				depth: depth + 1,
				nodeState,
				onLoadMore: loadMoreChildren ? () => loadMoreChildren(doc.id) : void 0,
				onRetry: retryChildren ? () => retryChildren(doc.id) : void 0
			})
		]
	});
}
function DocTreeView({ docs, getChildren, getNodeState, loadMoreChildren, retryChildren, rootNodeState, onRootLoadMore, onRootRetry, selectionMode = "none", selectedDocIds, onDocSelect, onFolderSelect }) {
	const [expandedIds, setExpandedIds] = (0, import_react$8.useState)(/* @__PURE__ */ new Set());
	const toggleExpand = (0, import_react$8.useCallback)((id) => {
		setExpandedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime$6.jsxs)("div", {
		className: "lexiang-doc-tree-view",
		children: [docs.map((doc) => /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)(DocTreeNode, {
			doc,
			depth: 0,
			getChildren,
			getNodeState,
			loadMoreChildren,
			retryChildren,
			selectionMode,
			selectedDocIds,
			onDocSelect,
			onFolderSelect,
			expandedIds,
			toggleExpand
		}, doc.id)), /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)(DocTreeFooter, {
			depth: 0,
			nodeState: rootNodeState,
			onLoadMore: onRootLoadMore,
			onRetry: onRootRetry
		})]
	});
}
var import_react$8, import_jsx_runtime$6;
var init_doc_tree_view = __esmMin((() => {
	init_doc_tree_view$1();
	import_react$8 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_picker_icons();
	init_types();
	import_jsx_runtime$6 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/picker/shared/kb-cascade-view.tsx
function KbCascadeView({ teams, activeTeamId, onTeamChange, teamSelectionMode = "none", selectedTeamIds, onTeamSelect, teamsHasMore, teamsLoadingMore, onTeamsLoadMore, personalSpaceLabel, isPersonalSpaceActive, onPersonalSpaceClick, kbs, activeKbId, onKbChange, kbSelectionMode = "none", selectedKbIds, onKbSelect, kbsHasMore, kbsLoading, kbsLoadingMore, onKbsLoadMore, showKbArrow = true, columnRatio, docs, getDocChildren, getDocNodeState, loadMoreDocChildren, retryDocChildren, rootDocNodeState, loadMoreRootDocs, retryRootDocs, docSelectionMode = "none", selectedDocIds, onDocSelect, onFolderSelect, onDocClick, breadcrumbs, resizable = false }) {
	const t = useTranslation();
	const hasThirdColumn = docs !== void 0;
	const columnCount = hasThirdColumn ? 3 : 2;
	const teamSentinelRef = (0, import_react$7.useRef)(null);
	(0, import_react$7.useEffect)(() => {
		const sentinel = teamSentinelRef.current;
		if (!sentinel || !teamsHasMore || teamsLoadingMore) return;
		const observer = new IntersectionObserver((entries) => {
			if (entries[0]?.isIntersecting) onTeamsLoadMore?.();
		}, { threshold: .1 });
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [
		teamsHasMore,
		teamsLoadingMore,
		onTeamsLoadMore
	]);
	const kbSentinelRef = (0, import_react$7.useRef)(null);
	(0, import_react$7.useEffect)(() => {
		const sentinel = kbSentinelRef.current;
		if (!sentinel || !kbsHasMore || kbsLoadingMore) return;
		const observer = new IntersectionObserver((entries) => {
			if (entries[0]?.isIntersecting) onKbsLoadMore?.();
		}, { threshold: .1 });
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [
		kbsHasMore,
		kbsLoadingMore,
		onKbsLoadMore
	]);
	const cascadeRef = (0, import_react$7.useRef)(null);
	const [columnWidths, setColumnWidths] = (0, import_react$7.useState)(null);
	const columnWidthsRef = (0, import_react$7.useRef)(null);
	columnWidthsRef.current = columnWidths;
	const dragStartWidths = (0, import_react$7.useRef)([]);
	(0, import_react$7.useEffect)(() => {
		if (!cascadeRef.current) return;
		const raf = requestAnimationFrame(() => {
			if (!cascadeRef.current) return;
			const cols = cascadeRef.current.querySelectorAll(":scope > .lexiang-kb-cascade__column");
			const widths = [];
			cols.forEach((col) => widths.push(col.offsetWidth));
			if (widths.length === columnCount && widths.every((w) => w > 0)) setColumnWidths(widths);
		});
		return () => cancelAnimationFrame(raf);
	}, [columnCount]);
	(0, import_react$7.useEffect)(() => {
		if (!resizable || !cascadeRef.current || !columnWidths) return;
		const container = cascadeRef.current;
		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;
			const currentWidths = columnWidthsRef.current;
			if (!currentWidths) return;
			const diff = entry.contentRect.width - (columnCount - 1) - currentWidths.reduce((a, b) => a + b, 0);
			if (Math.abs(diff) < 1) return;
			setColumnWidths((prev) => {
				if (!prev) return prev;
				const next = [...prev];
				next[next.length - 1] = Math.max(COLUMN_MIN_WIDTH, next[next.length - 1] + diff);
				return next;
			});
		});
		observer.observe(container);
		return () => observer.disconnect();
	}, [
		resizable,
		columnCount,
		columnWidths !== null
	]);
	const handleDividerMouseDown = (0, import_react$7.useCallback)((dividerIndex) => (e) => {
		e.preventDefault();
		if (columnWidths) dragStartWidths.current = [...columnWidths];
		const startX = e.clientX;
		const onMouseMove = (ev) => {
			const deltaX = ev.clientX - startX;
			const starts = dragStartWidths.current;
			if (!starts.length) return;
			const total = starts[dividerIndex] + starts[dividerIndex + 1];
			let newLeft = Math.max(COLUMN_MIN_WIDTH, starts[dividerIndex] + deltaX);
			const newRight = Math.max(COLUMN_MIN_WIDTH, total - newLeft);
			if (newLeft + newRight !== total) newLeft = total - newRight;
			setColumnWidths((prev) => {
				if (!prev) return prev;
				const next = [...prev];
				next[dividerIndex] = newLeft;
				next[dividerIndex + 1] = newRight;
				return next;
			});
		};
		const onMouseUp = () => {
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("mouseup", onMouseUp);
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
		};
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";
		document.addEventListener("mousemove", onMouseMove);
		document.addEventListener("mouseup", onMouseUp);
	}, [columnWidths]);
	const getColStyle = (index) => {
		if (columnWidths) return {
			width: columnWidths[index],
			minWidth: COLUMN_MIN_WIDTH,
			flex: "0 0 auto"
		};
		if (!columnRatio) return { minWidth: COLUMN_MIN_WIDTH };
		if (index === 0) return {
			flex: columnRatio[0],
			minWidth: COLUMN_MIN_WIDTH
		};
		if (index === 1) return {
			flex: columnRatio[1],
			minWidth: COLUMN_MIN_WIDTH
		};
		return { minWidth: COLUMN_MIN_WIDTH };
	};
	const checkboxSvg = /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("svg", {
		viewBox: "0 0 10 10",
		fill: "none",
		children: /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("path", {
			d: "M1.5 5.5L4 8L8.5 2",
			stroke: "currentColor",
			strokeWidth: "1.6",
			strokeLinecap: "round",
			strokeLinejoin: "round"
		})
	});
	const arrowSvg = /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("svg", {
		className: "lexiang-kb-cascade__arrow",
		width: "6",
		height: "10",
		viewBox: "0 0 6 10",
		fill: "none",
		children: /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("path", {
			d: "M1 1L5 5L1 9",
			stroke: "currentColor",
			strokeWidth: "1.5",
			strokeLinecap: "round",
			strokeLinejoin: "round"
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime$5.jsxs)("div", {
		className: "lexiang-kb-cascade",
		children: [breadcrumbs && breadcrumbs.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)(Breadcrumb, {
			className: "lexiang-kb-cascade__breadcrumb",
			size: "sm",
			collapseThreshold: BREADCRUMB_COLLAPSE_THRESHOLD,
			separator: /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("span", {
				"aria-hidden": "true",
				children: "›"
			}),
			items: breadcrumbs.map((crumb) => ({
				id: crumb.id,
				label: crumb.label,
				onClick: crumb.onClick
			}))
		}), /* @__PURE__ */ (0, import_jsx_runtime$5.jsxs)("div", {
			ref: cascadeRef,
			className: "lexiang-kb-cascade__columns",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime$5.jsxs)("div", {
					className: "lexiang-kb-cascade__column",
					style: getColStyle(0),
					children: [/* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("div", {
						className: "lexiang-kb-cascade__col-header",
						children: t("tencentLexiang.picker.team")
					}), /* @__PURE__ */ (0, import_jsx_runtime$5.jsxs)("div", {
						className: "lexiang-kb-cascade__col-body",
						children: [personalSpaceLabel && onPersonalSpaceClick && /* @__PURE__ */ (0, import_jsx_runtime$5.jsxs)("div", {
							className: `lexiang-kb-cascade__team-row${isPersonalSpaceActive ? " lexiang-kb-cascade__team-row--active" : ""}`,
							onClick: onPersonalSpaceClick,
							children: [
								teamSelectionMode !== "none" && /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("span", {
									className: "lexiang-kb-cascade__selector-placeholder",
									"aria-hidden": "true"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("span", {
									className: "lexiang-kb-cascade__team-avatar lexiang-kb-cascade__team-avatar--default",
									children: /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("svg", {
										width: "18",
										height: "18",
										viewBox: "0 0 16 16",
										fill: "none",
										"aria-hidden": "true",
										children: /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("path", {
											d: "M8 8.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5.5 5.25c0-2.071 2.462-3.75 5.5-3.75s5.5 1.679 5.5 3.75v.25h-11v-.25Z",
											stroke: "currentColor",
											strokeWidth: "1.2",
											strokeLinejoin: "round"
										})
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("span", {
									className: "lexiang-kb-cascade__name",
									children: personalSpaceLabel
								}),
								arrowSvg
							]
						}), teams.length === 0 && !personalSpaceLabel ? /* @__PURE__ */ (0, import_jsx_runtime$5.jsxs)("div", {
							className: "lexiang-kb-cascade__empty lexiang-kb-cascade__empty--centered",
							children: [/* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("span", {
								className: "lexiang-kb-cascade__empty-icon",
								children: /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("img", {
									src: no_knowledge_base_update_default,
									alt: "",
									"aria-hidden": "true"
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("span", {
								className: "lexiang-kb-cascade__empty-text",
								children: t("tencentLexiang.picker.noAccessibleTeams")
							})]
						}) : /* @__PURE__ */ (0, import_jsx_runtime$5.jsxs)(import_jsx_runtime$5.Fragment, { children: [teams.map((team) => {
							const isActive = activeTeamId === team.id;
							const isSelected = selectedTeamIds?.has(`team:${team.id}`);
							return /* @__PURE__ */ (0, import_jsx_runtime$5.jsxs)("div", {
								className: `lexiang-kb-cascade__team-row${isActive ? " lexiang-kb-cascade__team-row--active" : ""}`,
								onClick: () => {
									onTeamChange?.(team.id);
									if (teamSelectionMode === "radio") onTeamSelect?.(team);
								},
								children: [
									teamSelectionMode === "checkbox" && /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("span", {
										className: "lexiang-kb-cascade__selector-wrap",
										onClick: (e) => {
											e.stopPropagation();
											onTeamSelect?.(team);
										},
										children: /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("span", {
											className: `lexiang-kb-cascade__checkbox${isSelected ? " lexiang-kb-cascade__checkbox--checked" : ""}`,
											children: checkboxSvg
										})
									}),
									teamSelectionMode === "radio" && /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("span", {
										className: `lexiang-kb-cascade__radio${isSelected ? " lexiang-kb-cascade__radio--checked" : ""}`,
										"aria-hidden": "true"
									}),
									team.avatarUrl ? /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("img", {
										className: "lexiang-kb-cascade__team-avatar",
										src: team.avatarUrl,
										alt: ""
									}) : /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("span", {
										className: "lexiang-kb-cascade__team-avatar lexiang-kb-cascade__team-avatar--default",
										children: /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)(TeamDefaultIcon, { size: 18 })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("span", {
										className: "lexiang-kb-cascade__name",
										children: team.name
									}),
									arrowSvg
								]
							}, team.id);
						}), teamsHasMore && /* @__PURE__ */ (0, import_jsx_runtime$5.jsxs)(import_jsx_runtime$5.Fragment, { children: [teamsLoadingMore && /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("div", {
							className: "lexiang-kb-cascade__load-more-indicator",
							children: /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("span", { className: "lexiang-kb-cascade__load-more-spinner" })
						}), /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("div", {
							ref: teamSentinelRef,
							className: "lexiang-kb-cascade__load-more-sentinel"
						})] })] })]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("div", {
					className: `lexiang-kb-cascade__divider${resizable ? " lexiang-kb-cascade__divider--resizable" : ""}`,
					onMouseDown: resizable ? handleDividerMouseDown(0) : void 0
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$5.jsxs)("div", {
					className: "lexiang-kb-cascade__column",
					style: getColStyle(1),
					children: [/* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("div", {
						className: "lexiang-kb-cascade__col-header",
						children: activeTeamId && kbSelectionMode === "radio" ? `\u201C${teams.find((tm) => tm.id === activeTeamId)?.name ?? ""}\u201D${t("tencentLexiang.picker.teamKbSuffix")}` : t("tencentLexiang.picker.knowledgeBase")
					}), /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("div", {
						className: "lexiang-kb-cascade__col-body",
						children: kbs.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("div", {
							className: "lexiang-kb-cascade__empty lexiang-kb-cascade__empty--centered",
							children: kbsLoading ? t("tencentLexiang.picker.loading") : /* @__PURE__ */ (0, import_jsx_runtime$5.jsxs)(import_jsx_runtime$5.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("span", {
								className: "lexiang-kb-cascade__empty-icon",
								children: /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("img", {
									src: no_knowledge_base_update_default,
									alt: "",
									"aria-hidden": "true"
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("span", {
								className: "lexiang-kb-cascade__empty-text",
								children: t("tencentLexiang.picker.noKb")
							})] })
						}) : /* @__PURE__ */ (0, import_jsx_runtime$5.jsxs)(import_jsx_runtime$5.Fragment, { children: [kbs.map((kb) => {
							const isActive = kb.id === activeKbId;
							const isSelected = selectedKbIds?.has(kb.id);
							return /* @__PURE__ */ (0, import_jsx_runtime$5.jsxs)("div", {
								className: `lexiang-kb-cascade__kb-row${isActive ? " lexiang-kb-cascade__kb-row--active" : ""}`,
								onClick: () => {
									onKbChange?.(kb.id);
									if (kbSelectionMode === "radio") onKbSelect?.(kb);
								},
								children: [
									kbSelectionMode === "checkbox" && /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("span", {
										className: "lexiang-kb-cascade__selector-wrap",
										onClick: (e) => {
											e.stopPropagation();
											onKbSelect?.(kb);
										},
										children: /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("span", {
											className: `lexiang-kb-cascade__checkbox${isSelected ? " lexiang-kb-cascade__checkbox--checked" : ""}`,
											children: checkboxSvg
										})
									}),
									kbSelectionMode === "radio" && /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("span", {
										className: `lexiang-kb-cascade__radio${isSelected ? " lexiang-kb-cascade__radio--checked" : ""}`,
										"aria-hidden": "true"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("span", {
										className: "lexiang-kb-cascade__icon",
										children: (() => {
											const rawLogo = kb.meta?.rawLogo;
											const logoSrc = kb.logoUrl || (isDirectlyUsableLogoUrl(rawLogo) ? rawLogo : void 0);
											return logoSrc ? /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("img", {
												className: "lexiang-kb-cascade__kb-logo",
												src: logoSrc,
												alt: "",
												referrerPolicy: "no-referrer"
											}) : /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)(KbDefaultIcon, { size: 16 });
										})()
									}),
									/* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("span", {
										className: "lexiang-kb-cascade__name",
										children: kb.name
									}),
									showKbArrow && arrowSvg
								]
							}, kb.id);
						}), kbsHasMore && /* @__PURE__ */ (0, import_jsx_runtime$5.jsxs)(import_jsx_runtime$5.Fragment, { children: [kbsLoadingMore && /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("div", {
							className: "lexiang-kb-cascade__load-more-indicator",
							children: /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("span", { className: "lexiang-kb-cascade__load-more-spinner" })
						}), /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("div", {
							ref: kbSentinelRef,
							className: "lexiang-kb-cascade__load-more-sentinel"
						})] })] })
					})]
				}),
				hasThirdColumn && /* @__PURE__ */ (0, import_jsx_runtime$5.jsxs)(import_jsx_runtime$5.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("div", {
					className: `lexiang-kb-cascade__divider${resizable ? " lexiang-kb-cascade__divider--resizable" : ""}`,
					onMouseDown: resizable ? handleDividerMouseDown(1) : void 0
				}), /* @__PURE__ */ (0, import_jsx_runtime$5.jsxs)("div", {
					className: "lexiang-kb-cascade__column",
					style: getColStyle(2),
					children: [/* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("div", {
						className: "lexiang-kb-cascade__col-header",
						children: t("tencentLexiang.picker.knowledge")
					}), /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("div", {
						className: "lexiang-kb-cascade__col-body",
						children: !activeKbId ? /* @__PURE__ */ (0, import_jsx_runtime$5.jsxs)("div", {
							className: "lexiang-kb-cascade__empty lexiang-kb-cascade__empty--centered",
							children: [/* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("span", {
								className: "lexiang-kb-cascade__empty-icon",
								children: /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("img", {
									src: "" + new URL("no-knowledge-base-update-CopzwuXE.svg", import.meta.url).href,
									alt: "",
									"aria-hidden": "true"
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("span", {
								className: "lexiang-kb-cascade__empty-text",
								children: t("tencentLexiang.picker.noKnowledge")
							})]
						}) : rootDocNodeState?.loading && !rootDocNodeState.loaded ? /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("div", {
							className: "lexiang-kb-cascade__empty lexiang-kb-cascade__empty--centered",
							children: /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("span", {
								className: "lexiang-kb-cascade__empty-text",
								children: t("tencentLexiang.picker.loading")
							})
						}) : rootDocNodeState?.error && docs.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("button", {
							type: "button",
							className: "lexiang-kb-cascade__empty lexiang-kb-cascade__empty--centered lexiang-kb-cascade__empty--action",
							onClick: retryRootDocs,
							children: /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("span", {
								className: "lexiang-kb-cascade__empty-text",
								children: t("tencentLexiang.catalog.loadFailed")
							})
						}) : docs.length === 0 && rootDocNodeState?.loaded ? /* @__PURE__ */ (0, import_jsx_runtime$5.jsxs)("div", {
							className: "lexiang-kb-cascade__empty lexiang-kb-cascade__empty--centered",
							children: [/* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("span", {
								className: "lexiang-kb-cascade__empty-icon",
								children: /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("img", {
									src: "" + new URL("no-knowledge-base-update-CopzwuXE.svg", import.meta.url).href,
									alt: "",
									"aria-hidden": "true"
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("span", {
								className: "lexiang-kb-cascade__empty-text",
								children: t("tencentLexiang.picker.noContentInDir")
							})]
						}) : /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)(DocTreeView, {
							docs,
							getChildren: getDocChildren ?? (() => []),
							getNodeState: getDocNodeState,
							loadMoreChildren: loadMoreDocChildren,
							retryChildren: retryDocChildren,
							rootNodeState: rootDocNodeState,
							onRootLoadMore: loadMoreRootDocs,
							onRootRetry: retryRootDocs,
							selectionMode: docSelectionMode,
							selectedDocIds,
							onDocSelect: onDocClick ?? onDocSelect,
							onFolderSelect
						})
					})]
				})] })
			]
		})]
	});
}
var import_react$7, import_jsx_runtime$5, BREADCRUMB_COLLAPSE_THRESHOLD, COLUMN_MIN_WIDTH;
var init_kb_cascade_view = __esmMin((() => {
	init_kb_cascade_view$1();
	init_src();
	import_react$7 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_asset_service();
	init_no_knowledge_base_update();
	init_team_default_icon();
	init_doc_tree_view();
	init_picker_icons();
	import_jsx_runtime$5 = require_jsx_runtime();
	BREADCRUMB_COLLAPSE_THRESHOLD = 5;
	COLUMN_MIN_WIDTH = 120;
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/picker/shared/kb-item-row.less
var init_kb_item_row$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/picker/shared/kb-item-row.tsx
function getKindIcon(kind, extension) {
	if (kind === "team") return /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)(TeamDefaultIcon, { size: 16 });
	return /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)(DocKindIcon, {
		kind,
		extension,
		size: 16,
		onlineDocSize: 20
	});
}
function isKbItem(item) {
	return !("kind" in item);
}
function formatTime(ts) {
	if (!ts) return "";
	const d = new Date(ts);
	const pad = (n) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/**
* 渲染带高亮的文本。
*
* 优先解析后端返回的 `<em>` 标签（搜索接口开启 highlight 后标题中会含 `<em>` 标签），
* 如果文本中没有 `<em>` 标签，则 fallback 使用前端关键字分割高亮。
*/
function HighlightText({ text, keyword }) {
	if (text.includes("<em>")) {
		const emRegex = /<em>(.*?)<\/em>/g;
		const parts = [];
		let lastIndex = 0;
		let match;
		let key = 0;
		while ((match = emRegex.exec(text)) !== null) {
			if (match.index > lastIndex) parts.push(/* @__PURE__ */ (0, import_jsx_runtime$4.jsx)("span", { children: text.slice(lastIndex, match.index) }, key++));
			parts.push(/* @__PURE__ */ (0, import_jsx_runtime$4.jsx)("mark", {
				className: "lexiang-kb-item-row__highlight",
				children: match[1]
			}, key++));
			lastIndex = match.index + match[0].length;
		}
		if (lastIndex < text.length) parts.push(/* @__PURE__ */ (0, import_jsx_runtime$4.jsx)("span", { children: text.slice(lastIndex) }, key++));
		return /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)(import_jsx_runtime$4.Fragment, { children: parts });
	}
	if (!keyword?.trim()) return /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)(import_jsx_runtime$4.Fragment, { children: text });
	const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)(import_jsx_runtime$4.Fragment, { children: text.split(new RegExp(`(${escaped})`, "gi")).map((part, i) => part.toLowerCase() === keyword.toLowerCase() ? /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)("mark", {
		className: "lexiang-kb-item-row__highlight",
		children: part
	}, i) : /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)("span", { children: part }, i)) });
}
function KbItemRow({ item, selected = false, active = false, disabled = false, selectionMode = "none", showArrow = false, showSource = false, showTime = false, highlightKeyword, onClick, rightSlot, teamLabel, hoverSourceLabel, sourceLabel }) {
	const isKb = isKbItem(item);
	const docItem = isKb ? void 0 : item;
	const kbItem = isKb ? item : void 0;
	const renderIcon = () => {
		if (kbItem) {
			const rawLogo = kbItem.meta?.rawLogo;
			const logoSrc = kbItem.logoUrl || (isDirectlyUsableLogoUrl(rawLogo) ? rawLogo : void 0);
			if (logoSrc) return /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)("span", {
				className: "lexiang-kb-item-row__icon lexiang-kb-item-row__icon--logo",
				children: /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)("img", {
					src: logoSrc,
					alt: "",
					referrerPolicy: "no-referrer"
				})
			});
			if (kbItem.icon) return /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)("span", {
				className: "lexiang-kb-item-row__icon",
				children: kbItem.icon
			});
			return /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)("span", {
				className: "lexiang-kb-item-row__icon",
				children: /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)(KbDefaultIcon, { size: 16 })
			});
		}
		if (docItem) return /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)("span", {
			className: "lexiang-kb-item-row__icon",
			children: docItem.icon ?? getKindIcon(docItem.kind, docItem.extension)
		});
		return null;
	};
	const sourceText = showSource && docItem ? docItem.kind === "kb" ? docItem.teamName ?? "" : docItem.teamName && docItem.kbName ? `${docItem.teamName} / ${docItem.kbName}` : docItem.kbName ?? docItem.teamName ?? "" : "";
	const renderSelector = () => {
		if (selectionMode === "none") return null;
		if (selectionMode === "radio") {
			if (selected) return /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)("span", {
				className: "lexiang-kb-item-row__radio lexiang-kb-item-row__radio--checked",
				"aria-hidden": "true"
			});
			return /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)("span", {
				className: "lexiang-kb-item-row__radio",
				"aria-hidden": "true"
			});
		}
		return /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)("span", {
			className: `lexiang-kb-item-row__checkbox${selected ? " lexiang-kb-item-row__checkbox--checked" : ""}`,
			children: /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)("svg", {
				viewBox: "0 0 10 10",
				fill: "none",
				children: /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)("path", {
					d: "M1.5 5.5L4 8L8.5 2",
					stroke: "currentColor",
					strokeWidth: "1.6",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			})
		});
	};
	return /* @__PURE__ */ (0, import_jsx_runtime$4.jsxs)("div", {
		className: [
			"lexiang-kb-item-row",
			selected ? "lexiang-kb-item-row--selected" : "",
			active ? "lexiang-kb-item-row--active" : "",
			disabled ? "lexiang-kb-item-row--disabled" : ""
		].filter(Boolean).join(" "),
		onClick: disabled ? void 0 : onClick,
		children: [
			renderSelector(),
			/* @__PURE__ */ (0, import_jsx_runtime$4.jsxs)("span", {
				className: "lexiang-kb-item-row__left",
				children: [
					renderIcon(),
					/* @__PURE__ */ (0, import_jsx_runtime$4.jsx)("span", {
						className: "lexiang-kb-item-row__name",
						children: /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)(HighlightText, {
							text: item.name,
							keyword: highlightKeyword
						})
					}),
					teamLabel && /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)("span", {
						className: "lexiang-kb-item-row__team-label",
						children: teamLabel
					}),
					hoverSourceLabel && /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)("span", {
						className: "lexiang-kb-item-row__hover-source",
						children: hoverSourceLabel
					})
				]
			}),
			sourceText && /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)("span", {
				className: "lexiang-kb-item-row__source",
				children: sourceText
			}),
			!sourceText && sourceLabel && /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)("span", {
				className: "lexiang-kb-item-row__source",
				children: sourceLabel
			}),
			showTime && docItem?.updatedAt && /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)("span", {
				className: "lexiang-kb-item-row__time",
				children: formatTime(docItem.updatedAt)
			}),
			showArrow && /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)("span", {
				className: "lexiang-kb-item-row__arrow",
				children: "›"
			}),
			rightSlot
		]
	});
}
var import_jsx_runtime$4;
var init_kb_item_row = __esmMin((() => {
	init_kb_item_row$1();
	require_react();
	init_asset_service();
	init_kb_default_icon();
	init_team_default_icon();
	init_picker_icons();
	import_jsx_runtime$4 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/picker/shared/picker-dialog-shell.less
var init_picker_dialog_shell$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/picker/shared/lexiang-search-input.less
var init_lexiang_search_input$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/picker/shared/lexiang-search-input.tsx
function LexiangSearchInput({ value, placeholder, onChange, onClear, onFocus, onBlur }) {
	const t = useTranslation();
	const resolvedPlaceholder = placeholder ?? t("tencentLexiang.picker.search");
	const inputRef = (0, import_react$5.useRef)(null);
	const handleClear = (0, import_react$5.useCallback)(() => {
		onClear?.();
		inputRef.current?.focus();
	}, [onClear]);
	return /* @__PURE__ */ (0, import_jsx_runtime$3.jsxs)("div", {
		className: "lexiang-search-input",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime$3.jsx)("svg", {
				className: "lexiang-search-input__icon",
				viewBox: "0 0 16 16",
				fill: "none",
				xmlns: "http://www.w3.org/2000/svg",
				children: /* @__PURE__ */ (0, import_jsx_runtime$3.jsx)("path", {
					d: "M7 1.5a5.5 5.5 0 0 1 4.288 8.94l3.136 3.136a.6.6 0 0 1-.849.849l-3.136-3.136A5.5 5.5 0 1 1 7 1.5zM7 2.7a4.3 4.3 0 1 0 0 8.6 4.3 4.3 0 0 0 0-8.6z",
					fill: "currentColor"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$3.jsx)("input", {
				ref: inputRef,
				type: "text",
				className: "lexiang-search-input__input",
				value,
				placeholder: resolvedPlaceholder,
				onChange: (e) => onChange(e.target.value),
				onFocus,
				onBlur
			}),
			value && /* @__PURE__ */ (0, import_jsx_runtime$3.jsx)("button", {
				type: "button",
				className: "lexiang-search-input__clear-btn",
				onClick: handleClear,
				"aria-label": t("tencentLexiang.picker.clear"),
				children: /* @__PURE__ */ (0, import_jsx_runtime$3.jsx)("svg", {
					width: "16",
					height: "16",
					viewBox: "0 0 16 16",
					fill: "none",
					xmlns: "http://www.w3.org/2000/svg",
					children: /* @__PURE__ */ (0, import_jsx_runtime$3.jsx)("path", {
						fillRule: "evenodd",
						clipRule: "evenodd",
						d: "M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16ZM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646Z",
						fill: "currentColor"
					})
				})
			})
		]
	});
}
var import_react$5, import_jsx_runtime$3;
var init_lexiang_search_input = __esmMin((() => {
	init_lexiang_search_input$1();
	import_react$5 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	import_jsx_runtime$3 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/picker/shared/lexiang-tabs.less
var init_lexiang_tabs$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/picker/shared/lexiang-tabs.tsx
function LexiangTabs({ items, activeId, onChange }) {
	const handleClick = (0, import_react$4.useCallback)((item) => {
		if (item.disabled || item.id === activeId) return;
		onChange(item.id);
	}, [activeId, onChange]);
	return /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)("div", {
		className: "lexiang-tabs",
		children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)("button", {
			type: "button",
			className: [
				"lexiang-tabs__item",
				item.id === activeId ? "lexiang-tabs__item--active" : "",
				item.disabled ? "lexiang-tabs__item--disabled" : ""
			].filter(Boolean).join(" "),
			onClick: () => handleClick(item),
			disabled: item.disabled,
			children: item.label
		}, item.id))
	});
}
var import_react$4, import_jsx_runtime$2;
var init_lexiang_tabs = __esmMin((() => {
	init_lexiang_tabs$1();
	import_react$4 = /* @__PURE__ */ __toESM(require_react());
	import_jsx_runtime$2 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/picker/shared/picker-dialog-shell.tsx
function PickerDialogShell({ visible, title, subtitle, tabs, activeTabId, onTabChange, searchKeyword, onSearchKeywordChange, searchPlaceholder, searchFocused, onSearchFocusChange, confirmText, cancelText, confirmDisabled = false, confirmLoading = false, footerLeft, hideFooter = false, hideToolbar = false, footerExtra, maskClosable = false, children, onClose, onConfirm, className, containerStyle, resizable = false }) {
	const t = useTranslation();
	const resolvedSearchPlaceholder = searchPlaceholder ?? t("tencentLexiang.picker.search");
	const resolvedConfirmText = confirmText ?? t("tencentLexiang.picker.confirm");
	const resolvedCancelText = cancelText ?? t("tencentLexiang.picker.cancel");
	const containerRef = (0, import_react$3.useRef)(null);
	const isResizingRef = (0, import_react$3.useRef)(false);
	const [containerWidth, setContainerWidth] = (0, import_react$3.useState)(void 0);
	const prevTabIdRef = (0, import_react$3.useRef)(activeTabId);
	const [slideDirection, setSlideDirection] = (0, import_react$3.useState)(null);
	(0, import_react$3.useEffect)(() => {
		const prevId = prevTabIdRef.current;
		if (prevId !== activeTabId && tabs.length > 1) {
			const prevIdx = tabs.findIndex((t) => t.id === prevId);
			const nextIdx = tabs.findIndex((t) => t.id === activeTabId);
			if (prevIdx !== -1 && nextIdx !== -1) setSlideDirection(nextIdx > prevIdx ? "right" : "left");
		}
		prevTabIdRef.current = activeTabId;
	}, [activeTabId, tabs]);
	(0, import_react$3.useEffect)(() => {
		if (!visible) {
			setContainerWidth(void 0);
			setSlideDirection(null);
		}
	}, [visible]);
	(0, import_react$3.useEffect)(() => {
		if (!visible) return;
		const handleKeyDown = (e) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [visible, onClose]);
	const handleOverlayClick = (0, import_react$3.useCallback)((e) => {
		if (!maskClosable || isResizingRef.current) return;
		if (!containerRef.current?.contains(e.target)) onClose();
	}, [maskClosable, onClose]);
	const handleResizeMouseDown = (0, import_react$3.useCallback)((e) => {
		e.preventDefault();
		e.stopPropagation();
		isResizingRef.current = true;
		const startX = e.clientX;
		const startWidth = containerRef.current?.offsetWidth ?? 960;
		const maxWidth = window.innerWidth - 48;
		const onMouseMove = (ev) => {
			setContainerWidth(Math.min(maxWidth, Math.max(MIN_WIDTH, startWidth + (ev.clientX - startX) * 2)));
		};
		const onMouseUp = () => {
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("mouseup", onMouseUp);
			requestAnimationFrame(() => {
				isResizingRef.current = false;
			});
		};
		document.addEventListener("mousemove", onMouseMove);
		document.addEventListener("mouseup", onMouseUp);
	}, []);
	if (!visible) return null;
	const mergedStyle = {
		...containerStyle,
		...containerWidth !== void 0 ? { width: containerWidth } : {}
	};
	const bodyCls = [
		"lexiang-picker-dialog__body",
		slideDirection === "right" ? "lexiang-picker-dialog__body--slide-right" : "",
		slideDirection === "left" ? "lexiang-picker-dialog__body--slide-left" : ""
	].filter(Boolean).join(" ");
	return (0, import_react_dom.createPortal)(/* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("div", {
		className: "lexiang-picker-dialog-overlay",
		onClick: handleOverlayClick,
		children: /* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("div", {
			ref: containerRef,
			className: ["lexiang-picker-dialog", className ?? ""].filter(Boolean).join(" "),
			style: mergedStyle,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("button", {
					type: "button",
					className: "lexiang-picker-dialog__close-btn",
					onClick: onClose,
					"aria-label": t("tencentLexiang.picker.close"),
					children: /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("svg", {
						width: "16",
						height: "16",
						viewBox: "0 0 16 16",
						fill: "none",
						xmlns: "http://www.w3.org/2000/svg",
						children: /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("path", {
							d: "M2.626 2.626a.6.6 0 0 1 .849 0L8 7.152l4.525-4.526a.6.6 0 0 1 .849.849L8.848 8l4.526 4.525a.6.6 0 0 1-.849.849L8 8.848l-4.525 4.526a.6.6 0 0 1-.849-.849L7.152 8 2.626 3.475a.6.6 0 0 1 0-.849z",
							fill: "currentColor"
						})
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("div", {
					className: "lexiang-picker-dialog__header",
					children: [/* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("div", {
						className: "lexiang-picker-dialog__title",
						children: title
					}), subtitle && /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("div", {
						className: "lexiang-picker-dialog__subtitle",
						children: subtitle
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("div", {
					className: "lexiang-picker-dialog__content",
					children: [!hideToolbar && /* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("div", {
						className: "lexiang-picker-dialog__toolbar",
						children: [/* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("div", {
							className: "lexiang-picker-dialog__tabs-wrap",
							children: /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(LexiangTabs, {
								items: tabs,
								activeId: searchKeyword.trim() ? "" : activeTabId,
								onChange: (id) => {
									if (searchKeyword.trim()) {
										onSearchKeywordChange("");
										onSearchFocusChange?.(false);
									}
									onTabChange(id);
								}
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("div", {
							className: "lexiang-picker-dialog__search-wrap",
							children: /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(LexiangSearchInput, {
								value: searchKeyword,
								placeholder: resolvedSearchPlaceholder,
								onChange: onSearchKeywordChange,
								onClear: () => {
									onSearchKeywordChange("");
									onSearchFocusChange?.(false);
								},
								onFocus: () => onSearchFocusChange?.(true),
								onBlur: () => {
									if (!searchKeyword.trim()) onSearchFocusChange?.(false);
								}
							})
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("div", {
						className: bodyCls,
						children
					}, activeTabId)]
				}),
				!hideFooter && /* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("div", {
					className: "lexiang-picker-dialog__footer",
					children: [(footerLeft || footerExtra) && /* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("div", {
						className: "lexiang-picker-dialog__footer-left",
						children: [footerLeft, footerExtra]
					}), /* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("div", {
						className: "lexiang-picker-dialog__footer-right",
						children: [/* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("button", {
							type: "button",
							className: "lexiang-picker-dialog__cancel-btn",
							onClick: onClose,
							children: resolvedCancelText
						}), /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("button", {
							type: "button",
							className: "lexiang-picker-dialog__confirm-btn",
							disabled: confirmDisabled || confirmLoading,
							onClick: onConfirm,
							children: confirmLoading ? "..." : resolvedConfirmText
						})]
					})]
				}),
				resizable && /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("div", {
					className: "lexiang-picker-dialog__resize-handle",
					onMouseDown: handleResizeMouseDown
				})
			]
		})
	}), document.body);
}
var import_react$3, import_react_dom, import_jsx_runtime$1, MIN_WIDTH;
var init_picker_dialog_shell = __esmMin((() => {
	init_picker_dialog_shell$1();
	import_react$3 = /* @__PURE__ */ __toESM(require_react());
	import_react_dom = /* @__PURE__ */ __toESM(require_react_dom());
	init_useI18n();
	init_lexiang_search_input();
	init_lexiang_tabs();
	import_jsx_runtime$1 = require_jsx_runtime();
	MIN_WIDTH = 480;
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/picker/shared/use-debounced-value.ts
/**
* 受控值防抖 hook
*
* @param value 外部值
* @param delay 防抖 ms，默认 200
*/
function useDebouncedValue(value, delay = 200) {
	const [debounced, setDebounced] = (0, import_react$2.useState)(value);
	(0, import_react$2.useEffect)(() => {
		const timer = setTimeout(() => setDebounced(value), delay);
		return () => clearTimeout(timer);
	}, [value, delay]);
	return debounced;
}
var import_react$2;
var init_use_debounced_value = __esmMin((() => {
	import_react$2 = /* @__PURE__ */ __toESM(require_react());
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/picker/merge-pinned-spaces.ts
var mergePinnedAndNormalSpaces, filterOutPinned;
var init_merge_pinned_spaces = __esmMin((() => {
	mergePinnedAndNormalSpaces = (pinned, normal) => {
		const pinnedIds = /* @__PURE__ */ new Set();
		const dedupedPinned = [];
		for (const item of pinned) {
			if (pinnedIds.has(item.id)) continue;
			pinnedIds.add(item.id);
			dedupedPinned.push(item);
		}
		const filteredNormal = normal.filter((item) => !pinnedIds.has(item.id));
		return {
			merged: [...dedupedPinned, ...filteredNormal],
			pinnedIds
		};
	};
	filterOutPinned = (items, pinnedIds) => items.filter((item) => !pinnedIds.has(item.id));
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/picker/shared/doc-node-state.ts
function createEmptyDocNodeState() {
	return {
		children: [],
		loading: false,
		loaded: false,
		error: null,
		nextPageToken: void 0
	};
}
function shouldLoadDocNode(state) {
	return !state.loaded && !state.loading;
}
function mergeDocChildrenPage(state, page, previousPageToken) {
	const validNextPageToken = page.children.length > 0 && page.nextPageToken !== previousPageToken ? page.nextPageToken : void 0;
	return {
		...state,
		children: [...state.children, ...page.children],
		loading: false,
		loaded: true,
		error: null,
		nextPageToken: validNextPageToken
	};
}
var init_doc_node_state = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/picker/use-lexiang-content-data.ts
function mapTeam(raw) {
	return {
		id: raw.id,
		name: raw.name
	};
}
function mapSpace(raw, visitTime) {
	return {
		id: raw.id,
		name: raw.name,
		lastVisitedAt: visitTime ? Number(visitTime) * 1e3 : void 0,
		meta: {
			rootEntryId: raw.root_entry_id,
			teamId: raw.team_id,
			rawLogo: raw.logo
		}
	};
}
/**
* 过滤掉缺少关键字段（id 或 name）的原始 entry。
* 乐享接口偶发返回空壳条目（没有 name/id），直接渲染会出现空白行，且 React key 缺失，统一在数据源过滤。
*/
function isValidRawEntry(raw) {
	if (!raw) return false;
	if (!raw.id) return false;
	if (typeof raw.name !== "string" || raw.name.trim().length === 0) return false;
	return true;
}
function mapEntryKind(entryType, extension) {
	if (entryType === "folder") return "folder";
	if (entryType === "flink") return "other";
	const ext = extension?.toLowerCase();
	if (ext === "sheet" || ext === "smartsheet" || ext === "xlsx" || ext === "xls") return "sheet";
	if (ext === "mind" || ext === "mm") return "mind";
	if (ext === "slide" || ext === "ppt" || ext === "pptx") return "slide";
	if (ext === "pdf") return "pdf";
	return "doc";
}
function mapEntry(raw, kbId, kbName, teamId, teamName, kbRootEntryId) {
	return {
		id: raw.id,
		name: raw.name,
		kind: mapEntryKind(raw.entry_type, raw.extension),
		extension: raw.extension,
		kbId,
		kbName,
		teamId,
		teamName,
		kbRootEntryId,
		parentId: raw.parent_id,
		updatedAt: raw.edited_at ? Number(raw.edited_at) * 1e3 : void 0,
		meta: {
			hasChildren: raw.has_children ?? false,
			entryType: raw.entry_type,
			targetId: raw.target_id
		}
	};
}
/**
* 批量解析知识库列表中的 logo URL（就地修改 kbItem.logoUrl）。
* 返回 true 表示有任何 logo 被成功解析（需要触发重渲染）。
*/
async function resolveLogosForKbs(kbs) {
	const toResolve = kbs.filter((kb) => kb.meta?.rawLogo && !kb.logoUrl);
	if (toResolve.length === 0) return false;
	return (await Promise.allSettled(toResolve.map(async (kb) => {
		const url = await resolveSpaceLogoUrl(kb.meta?.rawLogo);
		if (url) {
			kb.logoUrl = url;
			return true;
		}
		return false;
	}))).some((r) => r.status === "fulfilled" && r.value === true);
}
function cachedFetch(key, fetcher) {
	if (!contentCache.has(key)) {
		const promise = fetcher().catch((err) => {
			contentCache.delete(key);
			throw err;
		});
		contentCache.set(key, promise);
	}
	return contentCache.get(key);
}
function clearContentDataCache() {
	contentCache.clear();
}
function useLexiangContentData() {
	const isConnected = useLexiangAuth((s) => s.authStatus) === "connected";
	const [loading, setLoading] = (0, import_react$1.useState)(false);
	const [error, setError] = (0, import_react$1.useState)(null);
	const [teams, setTeams] = (0, import_react$1.useState)([]);
	const [teamsHasMore, setTeamsHasMore] = (0, import_react$1.useState)(false);
	const [teamsLoadingMore, setTeamsLoadingMore] = (0, import_react$1.useState)(false);
	const teamsNextPageTokenRef = (0, import_react$1.useRef)(void 0);
	const teamsLoadingMoreRef = (0, import_react$1.useRef)(false);
	const [recentKbs, setRecentKbs] = (0, import_react$1.useState)([]);
	const [personalKb, setPersonalKb] = (0, import_react$1.useState)(null);
	const [recentDocs, setRecentDocs] = (0, import_react$1.useState)([]);
	const [recentDocsLoading, setRecentDocsLoading] = (0, import_react$1.useState)(false);
	const spaceMapRef = (0, import_react$1.useRef)(/* @__PURE__ */ new Map());
	const teamKbsRef = (0, import_react$1.useRef)(/* @__PURE__ */ new Map());
	const docNodeStatesRef = (0, import_react$1.useRef)(/* @__PURE__ */ new Map());
	const [renderVersion, forceUpdate] = (0, import_react$1.useState)(0);
	const forceRender = (0, import_react$1.useCallback)(() => forceUpdate((n) => n + 1), []);
	const loadingKeysRef = (0, import_react$1.useRef)(/* @__PURE__ */ new Set());
	const teamsRef = (0, import_react$1.useRef)([]);
	const isLoadingRef = (0, import_react$1.useRef)(false);
	const emptyDocNodeStateRef = (0, import_react$1.useRef)(createEmptyDocNodeState());
	const getDocCacheKey = (0, import_react$1.useCallback)((kbId, parentId) => parentId ? `children:${parentId}` : `root:${kbId}`, []);
	const getOrCreateDocNodeState = (0, import_react$1.useCallback)((kbId, parentId) => {
		const cacheKey = getDocCacheKey(kbId, parentId);
		let state = docNodeStatesRef.current.get(cacheKey);
		if (!state) {
			state = createEmptyDocNodeState();
			docNodeStatesRef.current.set(cacheKey, state);
		}
		return state;
	}, [getDocCacheKey]);
	const getDocNodeState = (0, import_react$1.useCallback)((kbId, parentId) => docNodeStatesRef.current.get(getDocCacheKey(kbId, parentId)) ?? emptyDocNodeStateRef.current, [getDocCacheKey]);
	const requestDocChildren = (0, import_react$1.useCallback)((kbId, parentId, mode) => {
		const state = getOrCreateDocNodeState(kbId, parentId);
		if (state.loading) return;
		if (mode === "initial" && !shouldLoadDocNode(state)) return;
		if (mode === "append" && !state.nextPageToken) return;
		const spaceInfo = spaceMapRef.current.get(kbId);
		const actualParentId = parentId ?? spaceInfo?.rootEntryId;
		if (!actualParentId) {
			docNodeStatesRef.current.set(getDocCacheKey(kbId, parentId), {
				...state,
				loading: false,
				loaded: true,
				error: null,
				nextPageToken: void 0
			});
			if (mode !== "initial") forceRender();
			return;
		}
		const pageToken = mode === "append" ? state.nextPageToken : void 0;
		const requestState = {
			...state,
			children: mode === "append" ? state.children : [],
			loading: true,
			error: null,
			nextPageToken: mode === "append" ? state.nextPageToken : void 0
		};
		docNodeStatesRef.current.set(getDocCacheKey(kbId, parentId), requestState);
		if (mode !== "initial") forceRender();
		const kbName = spaceInfo?.name ?? kbId;
		const teamId = spaceInfo?.teamId;
		const teamName = teamId ? teamsRef.current.find((t) => t.id === teamId)?.name : void 0;
		fetchEntryChildren(actualParentId, ENTRY_PAGE_SIZE, pageToken, "sort_id", "staff").then((data) => {
			const latest = getOrCreateDocNodeState(kbId, parentId);
			const page = {
				children: (data.entries ?? []).filter(isValidRawEntry).map((e) => mapEntry(e, kbId, kbName, teamId, teamName, spaceInfo?.rootEntryId)),
				nextPageToken: data.next_page_token || void 0
			};
			const nextState = mergeDocChildrenPage(mode === "append" ? latest : {
				...latest,
				children: []
			}, page, pageToken);
			docNodeStatesRef.current.set(getDocCacheKey(kbId, parentId), nextState);
			forceRender();
		}).catch((err) => {
			const latest = getOrCreateDocNodeState(kbId, parentId);
			docNodeStatesRef.current.set(getDocCacheKey(kbId, parentId), {
				...latest,
				loading: false,
				loaded: mode === "append" ? latest.loaded : false,
				error: err instanceof Error ? err.message : String(err)
			});
			forceRender();
		});
	}, [
		forceRender,
		getDocCacheKey,
		getOrCreateDocNodeState
	]);
	const getDocsByKb = (0, import_react$1.useCallback)((kbId, parentId) => {
		requestDocChildren(kbId, parentId, "initial");
		return getDocNodeState(kbId, parentId).children;
	}, [getDocNodeState, requestDocChildren]);
	const loadMoreDocChildren = (0, import_react$1.useCallback)((kbId, parentId) => {
		requestDocChildren(kbId, parentId, "append");
	}, [requestDocChildren]);
	const retryDocChildren = (0, import_react$1.useCallback)((kbId, parentId) => {
		requestDocChildren(kbId, parentId, "retry");
	}, [requestDocChildren]);
	const getKbsByTeam = (0, import_react$1.useCallback)((teamId) => {
		if (teamKbsRef.current.has(teamId)) return teamKbsRef.current.get(teamId);
		const loadingKey = `team-spaces:${teamId}`;
		if (loadingKeysRef.current.has(loadingKey)) return {
			kbs: [],
			hasMore: false,
			loading: true,
			loadingMore: false,
			pinnedIds: /* @__PURE__ */ new Set()
		};
		loadingKeysRef.current.add(loadingKey);
		const mapAndRegister = (s) => {
			const kb = mapSpace(s);
			const teamName = teamsRef.current.find((t) => t.id === teamId)?.name;
			if (teamName) kb.teamName = teamName;
			spaceMapRef.current.set(s.id, {
				...kb,
				rootEntryId: s.root_entry_id,
				teamId: s.team_id
			});
			return kb;
		};
		Promise.allSettled([fetchPinnedTeamSpaces(teamId), fetchTeamSpaces(teamId, KB_PAGE_SIZE, void 0, { sortBy: "-edited_at" })]).then(async ([pinnedResult, normalResult]) => {
			if (normalResult.status === "rejected") {
				teamKbsRef.current.set(teamId, {
					kbs: [],
					hasMore: false,
					loading: false,
					loadingMore: false,
					pinnedIds: /* @__PURE__ */ new Set()
				});
				forceRender();
				return;
			}
			if (pinnedResult.status === "rejected") console.warn("[lexiang][useLexiangContentData] fetchPinnedTeamSpaces failed, fallback to normal list only:", pinnedResult.reason);
			const pinnedKbs = pinnedResult.status === "fulfilled" ? (pinnedResult.value.spaces ?? []).map(mapAndRegister) : [];
			const normalKbs = (normalResult.value.spaces ?? []).map(mapAndRegister);
			const { merged, pinnedIds } = mergePinnedAndNormalSpaces(pinnedKbs, normalKbs);
			const hasMore = normalKbs.length >= KB_PAGE_SIZE && !!normalResult.value.next_page_token;
			teamKbsRef.current.set(teamId, {
				kbs: merged,
				nextPageToken: normalResult.value.next_page_token ?? void 0,
				hasMore,
				loading: false,
				loadingMore: false,
				pinnedIds
			});
			forceRender();
			if (await resolveLogosForKbs(merged)) forceRender();
		}).finally(() => {
			loadingKeysRef.current.delete(loadingKey);
		});
		return {
			kbs: [],
			hasMore: false,
			loading: true,
			loadingMore: false,
			pinnedIds: /* @__PURE__ */ new Set()
		};
	}, [forceRender]);
	const loadMoreKbsByTeam = (0, import_react$1.useCallback)((teamId) => {
		const page = teamKbsRef.current.get(teamId);
		if (!page || !page.hasMore || page.loadingMore || !page.nextPageToken) return;
		page.loadingMore = true;
		forceRender();
		fetchTeamSpaces(teamId, KB_PAGE_SIZE, page.nextPageToken, { sortBy: "-edited_at" }).then(async (data) => {
			const rawNewKbs = (data.spaces ?? []).map((s) => {
				const kb = mapSpace(s);
				const teamName = teamsRef.current.find((t) => t.id === teamId)?.name;
				if (teamName) kb.teamName = teamName;
				spaceMapRef.current.set(s.id, {
					...kb,
					rootEntryId: s.root_entry_id,
					teamId: s.team_id
				});
				return kb;
			});
			const newKbs = filterOutPinned(rawNewKbs, page.pinnedIds);
			const hasMore = rawNewKbs.length > 0 && !!data.next_page_token;
			const allKbs = [...page.kbs, ...newKbs];
			teamKbsRef.current.set(teamId, {
				kbs: allKbs,
				nextPageToken: data.next_page_token ?? void 0,
				hasMore,
				loading: false,
				loadingMore: false,
				pinnedIds: page.pinnedIds
			});
			forceRender();
			if (await resolveLogosForKbs(newKbs)) forceRender();
		}).catch(() => {
			page.loadingMore = false;
			page.hasMore = false;
			forceRender();
		});
	}, [forceRender]);
	const load = (0, import_react$1.useCallback)(async () => {
		if (isLoadingRef.current) return;
		isLoadingRef.current = true;
		setLoading(true);
		setError(null);
		try {
			const [teamsResult, spacesResult, personalSpaceResult] = await Promise.allSettled([
				cachedFetch("frequent-teams", () => fetchFrequentTeams(20)),
				cachedFetch("recent-spaces", () => fetchRecentSpaces(20, "team")),
				cachedFetch("personal-space", () => fetchPersonalSpace())
			]);
			const teamsOk = teamsResult.status === "fulfilled";
			const spacesOk = spacesResult.status === "fulfilled";
			const personalOk = personalSpaceResult.status === "fulfilled";
			if (!teamsOk) throw teamsResult.reason instanceof Error ? teamsResult.reason : new Error(String(teamsResult.reason));
			const teamsData = teamsResult.value;
			const spacesData = spacesOk ? spacesResult.value : {
				spaces: [],
				visits: {}
			};
			const personalSpaceData = personalOk ? personalSpaceResult.value : null;
			let mappedPersonalKb = null;
			if (personalSpaceData?.space) {
				const ps = personalSpaceData.space;
				mappedPersonalKb = {
					id: ps.id,
					name: ps.name,
					logoUrl: isDirectlyUsableLogoUrl(ps.logo) ? ps.logo : void 0,
					meta: {
						rootEntryId: ps.root_entry_id,
						teamId: ps.team_id,
						isPersonal: true,
						rawLogo: ps.logo
					}
				};
			}
			setPersonalKb(mappedPersonalKb);
			if (mappedPersonalKb) {
				spaceMapRef.current.set(mappedPersonalKb.id, {
					...mappedPersonalKb,
					rootEntryId: mappedPersonalKb.meta?.rootEntryId,
					teamId: mappedPersonalKb.meta?.teamId
				});
				if (mappedPersonalKb.meta?.rawLogo && !mappedPersonalKb.logoUrl) resolveSpaceLogoUrl(mappedPersonalKb.meta.rawLogo).then((url) => {
					if (url) setPersonalKb((prev) => prev && prev.id === mappedPersonalKb.id ? {
						...prev,
						logoUrl: url
					} : prev);
				});
			}
			const mappedTeams = teamsData.teams.map(mapTeam);
			const seenTeamIds = /* @__PURE__ */ new Set();
			const dedupedTeams = [];
			for (const team of mappedTeams) if (!seenTeamIds.has(team.id)) {
				seenTeamIds.add(team.id);
				dedupedTeams.push(team);
			}
			setTeams(dedupedTeams);
			teamsRef.current = dedupedTeams;
			const nextToken = teamsData.next_page_token || void 0;
			teamsNextPageTokenRef.current = nextToken;
			setTeamsHasMore(!!nextToken);
			setTeamsLoadingMore(false);
			teamsLoadingMoreRef.current = false;
			const newSpaceMap = /* @__PURE__ */ new Map();
			const spacesTeamMap = spacesData.teams ?? {};
			const mappedSpaces = spacesData.spaces.map((s) => {
				const visitTime = spacesData.visits?.[s.id];
				const kb = mapSpace(s, visitTime);
				const teamName = s.team_id ? spacesTeamMap[s.team_id]?.name : void 0;
				if (teamName) kb.teamName = teamName;
				newSpaceMap.set(s.id, {
					...kb,
					rootEntryId: s.root_entry_id,
					teamId: s.team_id,
					teamName
				});
				return kb;
			});
			for (const [id, info] of spaceMapRef.current.entries()) if (!newSpaceMap.has(id)) newSpaceMap.set(id, info);
			spaceMapRef.current = newSpaceMap;
			setRecentKbs(mappedSpaces);
			resolveLogosForKbs(mappedSpaces).then((updated) => {
				if (updated) setRecentKbs([...mappedSpaces]);
			});
		} catch (err) {
			setError(err?.message ?? String(err));
		} finally {
			isLoadingRef.current = false;
			setLoading(false);
		}
	}, []);
	const loadMoreTeams = (0, import_react$1.useCallback)(() => {
		if (teamsLoadingMoreRef.current) return;
		const token = teamsNextPageTokenRef.current;
		if (!token) return;
		teamsLoadingMoreRef.current = true;
		setTeamsLoadingMore(true);
		fetchFrequentTeams(20, void 0, token).then((data) => {
			const newTeams = (data.teams ?? []).map(mapTeam);
			const nextToken = data.next_page_token || void 0;
			if (newTeams.length === 0) {
				teamsNextPageTokenRef.current = void 0;
				setTeamsHasMore(false);
				return;
			}
			if (nextToken && nextToken === token) {
				teamsNextPageTokenRef.current = void 0;
				setTeamsHasMore(false);
			} else {
				teamsNextPageTokenRef.current = nextToken;
				setTeamsHasMore(!!nextToken);
			}
			setTeams((prev) => {
				const seen = new Set(prev.map((t) => t.id));
				const merged = [...prev];
				for (const t of newTeams) if (!seen.has(t.id)) {
					merged.push(t);
					seen.add(t.id);
				}
				teamsRef.current = merged;
				return merged;
			});
		}).catch((err) => {
			console.error("[lexiang] loadMoreTeams failed", err);
			teamsNextPageTokenRef.current = void 0;
			setTeamsHasMore(false);
		}).finally(() => {
			teamsLoadingMoreRef.current = false;
			setTeamsLoadingMore(false);
		});
	}, []);
	const RECENT_DOCS_LIMIT = 50;
	const recentDocsLoadedRef = (0, import_react$1.useRef)(false);
	const loadRecentDocs = (0, import_react$1.useCallback)(() => {
		if (recentDocsLoadedRef.current || recentDocsLoading) return;
		recentDocsLoadedRef.current = true;
		setRecentDocsLoading(true);
		fetchRecentEntries(RECENT_DOCS_LIMIT, "staff,space").then((data) => {
			const docs = [];
			const spacesMap = data.spaces ?? {};
			for (const entry of data.entries ?? []) {
				if (!isValidRawEntry(entry)) continue;
				if (entry.entry_type !== "folder") {
					const spaceId = entry.space_id;
					const space = spaceId ? spacesMap[spaceId] : void 0;
					const kbName = space?.name ?? "";
					const teamId = space?.team_id;
					const teamName = teamId ? teamsRef.current.find((t) => t.id === teamId)?.name : void 0;
					docs.push(mapEntry(entry, spaceId ?? "", kbName, teamId, teamName, space?.root_entry_id));
				}
			}
			setRecentDocs(docs);
		}).catch(() => {
			recentDocsLoadedRef.current = false;
		}).finally(() => {
			setRecentDocsLoading(false);
		});
	}, [recentDocsLoading]);
	const refresh = (0, import_react$1.useCallback)(() => {
		clearContentDataCache();
		docNodeStatesRef.current.clear();
		teamKbsRef.current.clear();
		loadingKeysRef.current.clear();
		isLoadingRef.current = false;
		recentDocsLoadedRef.current = false;
		teamsNextPageTokenRef.current = void 0;
		teamsLoadingMoreRef.current = false;
		setTeamsHasMore(false);
		setTeamsLoadingMore(false);
		setRecentDocs([]);
		load();
	}, [load]);
	const search = (0, import_react$1.useCallback)(async (keyword, pageToken) => {
		const SEARCH_PAGE_SIZE = 20;
		const [spaceResult, entryResult, teamResult] = await Promise.allSettled([
			searchKb(keyword, {
				type: "space",
				limit: SEARCH_PAGE_SIZE,
				pageToken
			}),
			searchKb(keyword, {
				type: "entry",
				limit: SEARCH_PAGE_SIZE,
				pageToken
			}),
			searchTeams(keyword, SEARCH_PAGE_SIZE, pageToken)
		]);
		const teams = [];
		const docs = [];
		const kbs = [];
		if (teamResult.status === "fulfilled") {
			const teamData = teamResult.value;
			for (const t of teamData.teams ?? []) teams.push({
				id: t.id,
				name: t.name
			});
		}
		let spaceData;
		if (spaceResult.status === "fulfilled") {
			spaceData = spaceResult.value;
			for (const d of spaceData.docs ?? []) {
				if (d.target_type !== "kb_space") continue;
				const teamName = d.team_id ? spaceData.team?.[d.team_id] ?? teamsRef.current.find((t) => t.id === d.team_id)?.name : void 0;
				const { rootEntryId, logo } = parseLexiangSearchExtraInfo(d.extra_info);
				kbs.push({
					id: d.target_id ?? d.space_id ?? d.id,
					name: d.title,
					teamId: d.team_id,
					teamName,
					logoUrl: isDirectlyUsableLogoUrl(logo) ? logo : void 0,
					meta: {
						rootEntryId,
						teamId: d.team_id,
						rawLogo: logo
					}
				});
			}
		}
		let entryData;
		if (entryResult.status === "fulfilled") {
			entryData = entryResult.value;
			for (const d of entryData.docs ?? []) {
				if (!d.id || typeof d.title !== "string" || d.title.trim().length === 0) continue;
				docs.push({
					id: d.id,
					name: d.title,
					kind: "doc",
					kbId: d.space_id,
					kbName: d.space_id && entryData.space ? entryData.space[d.space_id] : void 0,
					teamId: d.team_id,
					teamName: d.team_id && entryData.team ? entryData.team[d.team_id] : void 0,
					updatedAt: d.updated_at ? Number(d.updated_at) * 1e3 : void 0
				});
			}
		}
		return {
			teams,
			docs,
			kbs,
			total: teams.length + docs.length + kbs.length,
			hasMore: !!(spaceData?.page_token || entryData?.page_token),
			nextPageToken: entryData?.page_token ?? spaceData?.page_token ?? void 0
		};
	}, []);
	const prevConnectedRef = (0, import_react$1.useRef)(isConnected);
	(0, import_react$1.useEffect)(() => {
		const wasConnected = prevConnectedRef.current;
		prevConnectedRef.current = isConnected;
		if (!isConnected) return;
		if (wasConnected) return;
		const timer = setTimeout(() => {
			refresh();
		}, 500);
		return () => clearTimeout(timer);
	}, [isConnected, refresh]);
	return {
		loading,
		error,
		teams,
		teamsHasMore,
		teamsLoadingMore,
		loadMoreTeams,
		recentKbs,
		personalKb,
		recentDocs,
		recentDocsLoading,
		loadRecentDocs,
		getKbsByTeam,
		loadMoreKbsByTeam,
		getDocsByKb,
		getDocNodeState,
		loadMoreDocChildren,
		retryDocChildren,
		search,
		refresh,
		renderVersion
	};
}
var import_react$1, KB_PAGE_SIZE, ENTRY_PAGE_SIZE, contentCache;
var init_use_lexiang_content_data = __esmMin((() => {
	import_react$1 = /* @__PURE__ */ __toESM(require_react());
	init_api();
	init_lexiang_auth_store();
	init_merge_pinned_spaces();
	init_doc_node_state();
	KB_PAGE_SIZE = 20;
	ENTRY_PAGE_SIZE = 20;
	contentCache = /* @__PURE__ */ new Map();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/knowledge-base-panel/tencent-lexiang/components/picker/lexiang-content-picker.tsx
function CollapsibleSection({ title, items, maxItems = COLLAPSED_MAX, pageSize = PAGE_SIZE }) {
	const t = useTranslation();
	const [expanded, setExpanded] = (0, import_react.useState)(false);
	const [page, setPage] = (0, import_react.useState)(1);
	const sentinelRef = (0, import_react.useRef)(null);
	const needCollapse = items.length > maxItems;
	const visibleCount = expanded ? Math.min(page * pageSize, items.length) : needCollapse ? maxItems : items.length;
	const hasMore = expanded && visibleCount < items.length;
	(0, import_react.useEffect)(() => {
		const sentinel = sentinelRef.current;
		if (!sentinel || !hasMore) return;
		const observer = new IntersectionObserver((entries) => {
			if (entries[0]?.isIntersecting) setPage((p) => p + 1);
		}, { threshold: .1 });
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [hasMore, visibleCount]);
	(0, import_react.useEffect)(() => {
		if (!expanded) setPage(1);
	}, [expanded]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "lexiang-content-picker__section-header",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "lexiang-content-picker__section-title",
			children: title
		}), needCollapse && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			className: "lexiang-content-picker__expand-btn",
			onClick: () => setExpanded(!expanded),
			children: [expanded ? t("tencentLexiang.picker.collapse") : t("tencentLexiang.picker.expand"), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: `lexiang-content-picker__expand-arrow${expanded ? " lexiang-content-picker__expand-arrow--up" : ""}`,
				children: "‹"
			})]
		})]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "lexiang-content-picker__section-body",
		children: [items.slice(0, visibleCount), hasMore && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "lexiang-content-picker__load-more-indicator",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "lexiang-content-picker__load-more-spinner" })
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: sentinelRef,
			className: "lexiang-content-picker__load-more-sentinel"
		})] })]
	})] });
}
function PaginatedSection({ title, items, pageSize = PAGE_SIZE }) {
	const [page, setPage] = (0, import_react.useState)(1);
	const sentinelRef = (0, import_react.useRef)(null);
	const visibleCount = Math.min(page * pageSize, items.length);
	const hasMore = visibleCount < items.length;
	(0, import_react.useEffect)(() => {
		const sentinel = sentinelRef.current;
		if (!sentinel || !hasMore) return;
		const observer = new IntersectionObserver((entries) => {
			if (entries[0]?.isIntersecting) setPage((p) => p + 1);
		}, { threshold: .1 });
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [hasMore, visibleCount]);
	(0, import_react.useEffect)(() => {
		setPage(1);
	}, [items.length]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "lexiang-content-picker__section-header",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "lexiang-content-picker__section-title",
			children: title
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "lexiang-content-picker__section-body",
		children: [items.slice(0, visibleCount), hasMore && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "lexiang-content-picker__load-more-indicator",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "lexiang-content-picker__load-more-spinner" })
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: sentinelRef,
			className: "lexiang-content-picker__load-more-sentinel"
		})] })]
	})] });
}
/** 移除后端搜索高亮返回的 `<em>` 标签，只保留纯文本 */
function stripEmTags(text) {
	return text.replace(/<\/?em>/g, "");
}
/** 清理 PickedNode 中 name 字段的 `<em>` 标签，避免传递给外部 */
function sanitizePickedNode(node) {
	switch (node.type) {
		case "team": return {
			...node,
			team: {
				...node.team,
				name: stripEmTags(node.team.name)
			}
		};
		case "kb": return {
			...node,
			kb: {
				...node.kb,
				name: stripEmTags(node.kb.name)
			}
		};
		case "doc": return {
			...node,
			doc: {
				...node.doc,
				name: stripEmTags(node.doc.name)
			}
		};
		default: return node;
	}
}
/**
* 根据 `multiple` 和 `excludeTargetTypes` 决定某类节点的选择控件模式。
* - 在 exclude 列表中的类型 → 'none'（KbCascadeView / KbItemRow 都不渲染选择控件）
* - 否则按 multiple 决定 'checkbox' / 'radio'
*/
function resolveSelectionMode(type, multiple, exclude) {
	if (exclude?.includes(type)) return "none";
	return multiple ? "checkbox" : "radio";
}
function LexiangContentPicker({ visible, defaultTab = "directory", multiple = true, maxCount, searchPlaceholder, confirmText, cancelText, bypassConnectorAuth = false, excludeTargetTypes, onClose, onConfirm, containerStyle }) {
	const t = useTranslation();
	const resolvedSearchPlaceholder = searchPlaceholder ?? (excludeTargetTypes?.includes("team") && excludeTargetTypes.includes("kb") ? t("tencentLexiang.picker.searchKnowledge") : excludeTargetTypes?.includes("team") ? t("tencentLexiang.picker.searchKbKnowledge") : t("tencentLexiang.picker.searchTeamKbKnowledge"));
	const resolvedConfirmText = confirmText ?? t("tencentLexiang.picker.confirm");
	const resolvedCancelText = cancelText ?? t("tencentLexiang.picker.cancel");
	const authStatus = useLexiangAuth((s) => s.authStatus);
	const isAuthorized = bypassConnectorAuth || authStatus === "connected";
	const triggerCheckAuth = useLexiangCheckAuthGate();
	const license = useLexiangLicense(visible && isAuthorized);
	const adapter = useAdapter();
	const imaBridge = useOptionalImaApiBridge();
	const handleAssignLicense = (0, import_react.useCallback)(async () => {
		const intendUrl = `${(imaBridge ? await imaBridge.isStagingEnv().catch(() => false) : false) ? LEXIANG_WEB_ORIGIN_STAGING : LEXIANG_WEB_ORIGIN_PROD}/s/license`;
		try {
			const loginUrl = await fetchLexiangTempLoginUrl(adapter, {
				intendUrl,
				mode: "iframe"
			});
			await adapter.openExternal?.(loginUrl);
		} catch (err) {
			console.warn("[lexiang] license assign temp-login-url 失败，降级使用原始 URL", err);
			await adapter.openExternal?.(intendUrl).catch(() => {});
		}
	}, [adapter, imaBridge]);
	const { error, teams, teamsHasMore, teamsLoadingMore, loadMoreTeams, recentKbs, personalKb, recentDocs, recentDocsLoading, loadRecentDocs, getKbsByTeam, loadMoreKbsByTeam, getDocsByKb, getDocNodeState, loadMoreDocChildren, retryDocChildren, search, refresh, renderVersion } = useLexiangContentData();
	const prevVisibleRef = (0, import_react.useRef)(false);
	(0, import_react.useEffect)(() => {
		if (visible && !prevVisibleRef.current) if (bypassConnectorAuth) refresh();
		else if (lexiangAuthStore.getState().authStatus === "connected") refresh();
		else triggerCheckAuth();
		prevVisibleRef.current = visible;
	}, [
		visible,
		refresh,
		bypassConnectorAuth,
		triggerCheckAuth
	]);
	const [activeTab, setActiveTab] = (0, import_react.useState)(defaultTab);
	const [keyword, setKeyword] = (0, import_react.useState)("");
	const debouncedKeyword = useDebouncedValue(keyword, 300);
	const [searchFocused, setSearchFocused] = (0, import_react.useState)(false);
	const [activeTeamId, setActiveTeamId] = (0, import_react.useState)("");
	const [activeKbId, setActiveKbId] = (0, import_react.useState)("");
	const [isPersonalSpaceActive, setIsPersonalSpaceActive] = (0, import_react.useState)(false);
	const [searchResultTeams, setSearchResultTeams] = (0, import_react.useState)([]);
	const [searchResultDocs, setSearchResultDocs] = (0, import_react.useState)([]);
	const [searchResultKbs, setSearchResultKbs] = (0, import_react.useState)([]);
	const [searchLoading, setSearchLoading] = (0, import_react.useState)(false);
	const [searchHasMore, setSearchHasMore] = (0, import_react.useState)(false);
	const [searchNextPageToken, setSearchNextPageToken] = (0, import_react.useState)();
	const [searchLoadingMore, setSearchLoadingMore] = (0, import_react.useState)(false);
	const searchSentinelRef = (0, import_react.useRef)(null);
	const searchSeqRef = (0, import_react.useRef)(0);
	const handleTabChange = (0, import_react.useCallback)((tabId) => {
		setActiveTab(tabId);
		if (tabId === "recent") loadRecentDocs();
		if (tabId === "directory") if (personalKb) {
			setIsPersonalSpaceActive(true);
			setActiveTeamId("");
			setActiveKbId(personalKb.id);
		} else {
			setIsPersonalSpaceActive(false);
			const firstTeamId = teams[0]?.id ?? "";
			setActiveTeamId(firstTeamId);
			if (firstTeamId) setActiveKbId(getKbsByTeam(firstTeamId).kbs[0]?.id ?? "");
			else setActiveKbId("");
		}
	}, [
		teams,
		getKbsByTeam,
		loadRecentDocs,
		personalKb
	]);
	const [selected, setSelected] = (0, import_react.useState)(/* @__PURE__ */ new Map());
	(0, import_react.useEffect)(() => {
		if (visible) {
			setActiveTab(defaultTab);
			setKeyword("");
			setSearchFocused(false);
			if (personalKb) {
				setIsPersonalSpaceActive(true);
				setActiveTeamId("");
				setActiveKbId(personalKb.id);
			} else {
				setIsPersonalSpaceActive(false);
				setActiveTeamId("");
				setActiveKbId("");
			}
			setSelected(/* @__PURE__ */ new Map());
			setSearchResultTeams([]);
			setSearchResultDocs([]);
			setSearchResultKbs([]);
			setSearchHasMore(false);
			setSearchNextPageToken(void 0);
		}
	}, [visible, defaultTab]);
	const teamsLoadedOnceRef = (0, import_react.useRef)(false);
	(0, import_react.useEffect)(() => {
		if (teams.length > 0 && visible && !teamsLoadedOnceRef.current) {
			teamsLoadedOnceRef.current = true;
			if (activeTab === "recent") loadRecentDocs();
			else if (activeTab === "directory") if (personalKb) {
				setIsPersonalSpaceActive(true);
				setActiveTeamId("");
				setActiveKbId(personalKb.id);
			} else {
				const firstTeamId = teams[0]?.id ?? "";
				setActiveTeamId(firstTeamId);
				if (firstTeamId) setActiveKbId(getKbsByTeam(firstTeamId).kbs[0]?.id ?? "");
			}
		}
		if (!visible) teamsLoadedOnceRef.current = false;
	}, [
		teams,
		visible,
		activeTab,
		loadRecentDocs,
		getKbsByTeam,
		personalKb
	]);
	const isSearching = debouncedKeyword.trim().length > 0;
	(0, import_react.useEffect)(() => {
		const kw = debouncedKeyword.trim();
		if (!kw) {
			setSearchResultTeams([]);
			setSearchResultDocs([]);
			setSearchResultKbs([]);
			setSearchHasMore(false);
			setSearchNextPageToken(void 0);
			return;
		}
		const seq = ++searchSeqRef.current;
		setSearchLoading(true);
		setSearchResultTeams([]);
		setSearchResultDocs([]);
		setSearchResultKbs([]);
		setSearchHasMore(false);
		setSearchNextPageToken(void 0);
		search(kw).then((result) => {
			if (searchSeqRef.current !== seq) return;
			setSearchResultTeams(result.teams);
			setSearchResultDocs(result.docs);
			setSearchResultKbs(result.kbs);
			setSearchHasMore(result.hasMore);
			setSearchNextPageToken(result.nextPageToken);
		}).catch(() => {
			if (searchSeqRef.current !== seq) return;
			setSearchResultTeams([]);
			setSearchResultDocs([]);
			setSearchResultKbs([]);
			setSearchHasMore(false);
		}).finally(() => {
			if (searchSeqRef.current === seq) setSearchLoading(false);
		});
	}, [debouncedKeyword, search]);
	const loadMoreSearch = (0, import_react.useCallback)(async () => {
		if (searchLoadingMore || !searchHasMore || !searchNextPageToken) return;
		const kw = debouncedKeyword.trim();
		if (!kw) return;
		const seq = searchSeqRef.current;
		setSearchLoadingMore(true);
		try {
			const result = await search(kw, searchNextPageToken);
			if (searchSeqRef.current !== seq) return;
			setSearchResultTeams((prev) => [...prev, ...result.teams]);
			setSearchResultDocs((prev) => [...prev, ...result.docs]);
			setSearchResultKbs((prev) => [...prev, ...result.kbs]);
			setSearchHasMore(result.hasMore);
			setSearchNextPageToken(result.nextPageToken);
		} catch {} finally {
			if (searchSeqRef.current === seq) setSearchLoadingMore(false);
		}
	}, [
		debouncedKeyword,
		search,
		searchHasMore,
		searchNextPageToken,
		searchLoadingMore
	]);
	(0, import_react.useEffect)(() => {
		const sentinel = searchSentinelRef.current;
		if (!sentinel || !searchHasMore || searchLoadingMore) return;
		const observer = new IntersectionObserver((entries) => {
			if (entries[0]?.isIntersecting) loadMoreSearch();
		}, { threshold: .1 });
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [
		searchHasMore,
		searchLoadingMore,
		loadMoreSearch
	]);
	const isTeamExcluded = excludeTargetTypes?.includes("team") ?? false;
	const isKbExcluded = excludeTargetTypes?.includes("kb") ?? false;
	const isDocExcluded = excludeTargetTypes?.includes("doc") ?? false;
	const hasSearchResults = !isTeamExcluded && searchResultTeams.length > 0 || !isKbExcluded && searchResultKbs.length > 0 || !isDocExcluded && searchResultDocs.length > 0;
	const toggleSelect = (0, import_react.useCallback)((node) => {
		const key = node.type === "team" ? `team:${node.team.id}` : node.type === "kb" ? `kb:${node.kb.id}` : `doc:${node.doc.id}`;
		setSelected((prev) => {
			const next = new Map(prev);
			if (next.has(key)) {
				next.delete(key);
				return next;
			}
			if (!multiple) next.clear();
			if (multiple && typeof maxCount === "number" && next.size >= maxCount) return prev;
			next.set(key, node);
			return next;
		});
	}, [multiple, maxCount]);
	const toggleTeamSelect = (0, import_react.useCallback)((team) => {
		toggleSelect({
			type: "team",
			team
		});
	}, [toggleSelect]);
	const toggleFolderSelect = (0, import_react.useCallback)((folder, _descendants) => {
		toggleSelect({
			type: "doc",
			doc: folder
		});
	}, [toggleSelect]);
	const handleConfirm = (0, import_react.useCallback)(() => {
		onConfirm(Array.from(selected.values()).map(sanitizePickedNode));
	}, [selected, onConfirm]);
	const activeTeamKbPage = (0, import_react.useMemo)(() => activeTeamId ? getKbsByTeam(activeTeamId) : {
		kbs: [],
		hasMore: false,
		loading: false,
		loadingMore: false
	}, [
		activeTeamId,
		getKbsByTeam,
		renderVersion
	]);
	const kbsOfActiveTeam = isPersonalSpaceActive ? personalKb ? [personalKb] : [] : activeTeamKbPage.kbs;
	(0, import_react.useEffect)(() => {
		if (activeTeamId && kbsOfActiveTeam.length > 0 && !activeKbId) setActiveKbId(kbsOfActiveTeam[0].id);
	}, [
		activeTeamId,
		kbsOfActiveTeam,
		activeKbId
	]);
	(0, import_react.useEffect)(() => {
		if (isPersonalSpaceActive && personalKb) setActiveKbId(personalKb.id);
	}, [isPersonalSpaceActive, personalKb]);
	const rootDocs = (0, import_react.useMemo)(() => activeKbId ? getDocsByKb(activeKbId) : [], [
		activeKbId,
		getDocsByKb,
		renderVersion
	]);
	const rootDocNodeState = (0, import_react.useMemo)(() => activeKbId ? getDocNodeState(activeKbId) : void 0, [
		activeKbId,
		getDocNodeState,
		renderVersion
	]);
	const getDocChildren = (0, import_react.useCallback)((parentId) => activeKbId ? getDocsByKb(activeKbId, parentId) : [], [
		activeKbId,
		getDocsByKb,
		renderVersion
	]);
	const getActiveDocNodeState = (0, import_react.useCallback)((parentId) => activeKbId ? getDocNodeState(activeKbId, parentId) : void 0, [
		activeKbId,
		getDocNodeState,
		renderVersion
	]);
	const loadMoreActiveDocChildren = (0, import_react.useCallback)((parentId) => {
		if (activeKbId) loadMoreDocChildren(activeKbId, parentId);
	}, [activeKbId, loadMoreDocChildren]);
	const retryActiveDocChildren = (0, import_react.useCallback)((parentId) => {
		if (activeKbId) retryDocChildren(activeKbId, parentId);
	}, [activeKbId, retryDocChildren]);
	const loadMoreRootDocs = (0, import_react.useCallback)(() => {
		if (activeKbId) loadMoreDocChildren(activeKbId);
	}, [activeKbId, loadMoreDocChildren]);
	const retryRootDocs = (0, import_react.useCallback)(() => {
		if (activeKbId) retryDocChildren(activeKbId);
	}, [activeKbId, retryDocChildren]);
	const selectedKbIds = (0, import_react.useMemo)(() => {
		const s = /* @__PURE__ */ new Set();
		for (const n of selected.values()) if (n.type === "team") s.add(`team:${n.team.id}`);
		else if (n.type === "kb") s.add(n.kb.id);
		return s;
	}, [selected]);
	const selectedDocIds = (0, import_react.useMemo)(() => {
		const s = /* @__PURE__ */ new Set();
		for (const n of selected.values()) if (n.type === "doc") s.add(n.doc.id);
		return s;
	}, [selected]);
	const renderBody = () => {
		if (!isAuthorized) {
			if (authStatus === "checking") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "lexiang-content-picker__empty",
				children: t("tencentLexiang.auth.checking")
			});
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthGuide, { source: "file_picker" });
		}
		if (license.status === "checking") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "lexiang-content-picker__empty",
			children: t("tencentLexiang.license.checking")
		});
		if (license.status === "denied") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LexiangLicenseDeniedView, {
			isAdmin: license.isAdmin,
			onAssign: license.isAdmin ? handleAssignLicense : void 0
		});
		if (teams.length === 0 && !personalKb && recentKbs.length === 0 && !error) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "lexiang-content-picker__empty",
			children: t("tencentLexiang.picker.loading")
		});
		if (keyword.trim().length > 0 && !isSearching) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "lexiang-content-picker__empty",
			children: t("tencentLexiang.picker.searchHint")
		});
		if (isSearching) {
			if (searchLoading) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "lexiang-content-picker__empty",
				children: t("tencentLexiang.picker.searching")
			});
			if (!hasSearchResults) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "lexiang-content-picker__empty",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					className: "lexiang-content-picker__empty-icon",
					src: no_knowledge_base_update_default,
					alt: "",
					"aria-hidden": "true"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("tencentLexiang.picker.noFileResultsRetry") })]
			});
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "lexiang-content-picker__sectioned-list",
				children: [
					!isTeamExcluded && searchResultTeams.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CollapsibleSection, {
						title: t("tencentLexiang.picker.team"),
						maxItems: COLLAPSED_MAX,
						items: searchResultTeams.map((team) => {
							const fakeKbId = `team:${team.id}`;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(KbItemRow, {
								item: {
									id: fakeKbId,
									name: team.name,
									kind: "team",
									teamId: team.id,
									teamName: team.name
								},
								selected: selectedKbIds.has(fakeKbId),
								selectionMode: resolveSelectionMode("team", multiple, excludeTargetTypes),
								highlightKeyword: debouncedKeyword,
								onClick: () => toggleTeamSelect(team)
							}, fakeKbId);
						})
					}),
					!isKbExcluded && searchResultKbs.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CollapsibleSection, {
						title: t("tencentLexiang.picker.knowledgeBase"),
						maxItems: COLLAPSED_MAX,
						items: searchResultKbs.map((kb) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(KbItemRow, {
							item: kb,
							selected: selectedKbIds.has(kb.id),
							selectionMode: resolveSelectionMode("kb", multiple, excludeTargetTypes),
							highlightKeyword: debouncedKeyword,
							sourceLabel: kb.teamName,
							onClick: () => toggleSelect({
								type: "kb",
								kb,
								team: kb.teamId ? teams.find((tt) => tt.id === kb.teamId) : void 0
							})
						}, kb.id))
					}),
					!isDocExcluded && searchResultDocs.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "lexiang-content-picker__section-header",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "lexiang-content-picker__section-title",
							children: t("tencentLexiang.picker.knowledge")
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "lexiang-content-picker__section-body",
						children: [searchResultDocs.map((doc) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(KbItemRow, {
							item: doc,
							selected: selectedDocIds.has(doc.id),
							selectionMode: resolveSelectionMode("doc", multiple, excludeTargetTypes),
							highlightKeyword: debouncedKeyword,
							sourceLabel: doc.kbName,
							onClick: () => toggleSelect({
								type: "doc",
								doc
							})
						}, doc.id)), searchHasMore && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [searchLoadingMore && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "lexiang-content-picker__load-more-indicator",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "lexiang-content-picker__load-more-spinner" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							ref: searchSentinelRef,
							className: "lexiang-content-picker__load-more-sentinel"
						})] })]
					})] })
				]
			});
		}
		if (activeTab === "recent") {
			if (recentKbs.length === 0 && recentDocs.length === 0 && !recentDocsLoading) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "lexiang-content-picker__empty",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					className: "lexiang-content-picker__empty-icon",
					src: no_knowledge_base_update_default,
					alt: "",
					"aria-hidden": "true"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("tencentLexiang.picker.noRecentRecords") })]
			});
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "lexiang-content-picker__sectioned-list",
				children: [
					recentKbs.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CollapsibleSection, {
						title: t("tencentLexiang.picker.knowledgeBase"),
						maxItems: COLLAPSED_MAX,
						pageSize: PAGE_SIZE,
						items: recentKbs.map((kb) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(KbItemRow, {
							item: kb,
							selected: selectedKbIds.has(kb.id),
							selectionMode: resolveSelectionMode("kb", multiple, excludeTargetTypes),
							sourceLabel: kb.teamName,
							onClick: () => toggleSelect({
								type: "kb",
								kb,
								team: kb.teamId ? teams.find((t) => t.id === kb.teamId) : void 0
							})
						}, kb.id))
					}),
					recentDocsLoading && recentDocs.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "lexiang-content-picker__empty",
						children: t("tencentLexiang.picker.loading")
					}),
					recentDocs.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PaginatedSection, {
						title: t("tencentLexiang.picker.knowledge"),
						pageSize: PAGE_SIZE,
						items: recentDocs.map((doc) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(KbItemRow, {
							item: doc,
							selected: selectedDocIds.has(doc.id),
							disabled: doc.disabled,
							selectionMode: resolveSelectionMode("doc", multiple, excludeTargetTypes),
							sourceLabel: doc.kbName,
							onClick: () => toggleSelect({
								type: "doc",
								doc
							})
						}, doc.id))
					})
				]
			});
		}
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(KbCascadeView, {
			teams,
			activeTeamId,
			onTeamChange: (teamId) => {
				setActiveTeamId(teamId);
				setActiveKbId("");
				setIsPersonalSpaceActive(false);
			},
			teamSelectionMode: resolveSelectionMode("team", multiple, excludeTargetTypes),
			selectedTeamIds: selectedKbIds,
			onTeamSelect: (team) => toggleTeamSelect(team),
			teamsHasMore,
			teamsLoadingMore,
			onTeamsLoadMore: loadMoreTeams,
			personalSpaceLabel: personalKb ? t("tencentLexiang.picker.personalSpace") : void 0,
			isPersonalSpaceActive,
			onPersonalSpaceClick: personalKb ? () => {
				setIsPersonalSpaceActive(true);
				setActiveTeamId("");
				setActiveKbId(personalKb.id);
			} : void 0,
			kbs: kbsOfActiveTeam,
			activeKbId,
			onKbChange: (kbId) => setActiveKbId(kbId),
			kbSelectionMode: resolveSelectionMode("kb", multiple, excludeTargetTypes),
			selectedKbIds,
			onKbSelect: (kb) => toggleSelect({
				type: "kb",
				kb,
				team: teams.find((t) => t.id === activeTeamId)
			}),
			kbsHasMore: isPersonalSpaceActive ? false : activeTeamKbPage.hasMore,
			kbsLoading: isPersonalSpaceActive ? false : activeTeamKbPage.loading,
			kbsLoadingMore: isPersonalSpaceActive ? false : activeTeamKbPage.loadingMore,
			onKbsLoadMore: () => activeTeamId && loadMoreKbsByTeam(activeTeamId),
			docs: rootDocs,
			getDocChildren,
			getDocNodeState: getActiveDocNodeState,
			loadMoreDocChildren: loadMoreActiveDocChildren,
			retryDocChildren: retryActiveDocChildren,
			rootDocNodeState,
			loadMoreRootDocs,
			retryRootDocs,
			docSelectionMode: resolveSelectionMode("doc", multiple, excludeTargetTypes),
			selectedDocIds,
			onDocSelect: (doc) => toggleSelect({
				type: "doc",
				doc
			}),
			onFolderSelect: toggleFolderSelect,
			resizable: true
		});
	};
	const [showSelectedPanel, setShowSelectedPanel] = (0, import_react.useState)(false);
	const selectedPanelRef = (0, import_react.useRef)(null);
	const selectedTriggerRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		if (!showSelectedPanel) return;
		const handleClick = (e) => {
			if (selectedPanelRef.current?.contains(e.target)) return;
			if (selectedTriggerRef.current?.contains(e.target)) return;
			setShowSelectedPanel(false);
		};
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [showSelectedPanel]);
	(0, import_react.useEffect)(() => {
		if (!visible) setShowSelectedPanel(false);
	}, [visible]);
	const removeSelected = (0, import_react.useCallback)((key) => {
		setSelected((prev) => {
			const next = new Map(prev);
			next.delete(key);
			return next;
		});
	}, []);
	const getNodeDisplayName = (0, import_react.useCallback)((node) => {
		if (node.type === "team") return stripEmTags(node.team.name);
		if (node.type === "kb") return stripEmTags(node.kb.name);
		return stripEmTags(node.doc.name);
	}, []);
	const getNodeKindIcon = (0, import_react.useCallback)((node) => {
		if (node.type === "team") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TeamDefaultIcon, { size: 16 });
		if (node.type === "kb") {
			const rawLogo = node.kb.meta?.rawLogo;
			const logoSrc = node.kb.logoUrl || (isDirectlyUsableLogoUrl(rawLogo) ? rawLogo : void 0);
			if (logoSrc) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				className: "lexiang-content-picker__selected-panel-logo",
				src: logoSrc,
				alt: "",
				referrerPolicy: "no-referrer"
			});
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(KbDefaultIcon, { size: 16 });
		}
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DocKindIcon, {
			kind: node.doc.kind,
			extension: node.doc.extension,
			size: 16,
			onlineDocSize: 20
		});
	}, []);
	const footerLeft = multiple && selected.size > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "lexiang-content-picker__footer-selected",
		ref: selectedTriggerRef,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "lexiang-content-picker__summary",
			onClick: () => setShowSelectedPanel(!showSelectedPanel),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("tencentLexiang.selection.selectedCount", { count: selected.size }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
				className: `lexiang-content-picker__chevron${showSelectedPanel ? " lexiang-content-picker__chevron--up" : ""}`,
				xmlns: "http://www.w3.org/2000/svg",
				width: "16",
				height: "16",
				viewBox: "0 0 16 16",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
					fill: "currentColor",
					fillOpacity: "0.4",
					transform: "translate(2.4 5.4)",
					d: "M10.176.175a.6.6 0 0 1 .849.001.6.6 0 0 1-.001.849L6.731 5.315a1 1 0 0 1-1.415 0L.176 1.025l-.077-.095A.6.6 0 0 1 .175.176a.6.6 0 0 1 .755-.077l.094.076L5.317 4.466a.2.2 0 0 0 .283 0L10.176.175Z"
				})
			})]
		}), showSelectedPanel && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "lexiang-content-picker__selected-panel",
			ref: selectedPanelRef,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "lexiang-content-picker__selected-panel-header",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "lexiang-content-picker__selected-panel-title",
					children: t("tencentLexiang.selection.selectedItems", { count: selected.size })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "lexiang-content-picker__selected-panel-clear",
					onClick: () => setSelected(/* @__PURE__ */ new Map()),
					children: t("tencentLexiang.selection.clearAll")
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "lexiang-content-picker__selected-panel-list",
				children: Array.from(selected.entries()).map(([key, node]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "lexiang-content-picker__selected-panel-item",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "lexiang-content-picker__selected-panel-icon",
							children: getNodeKindIcon(node)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "lexiang-content-picker__selected-panel-name",
							title: getNodeDisplayName(node),
							children: getNodeDisplayName(node)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "lexiang-content-picker__selected-panel-remove",
							onClick: () => removeSelected(key),
							"aria-label": t("tencentLexiang.selection.remove"),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
								width: "14",
								height: "14",
								viewBox: "0 0 16 16",
								fill: "none",
								xmlns: "http://www.w3.org/2000/svg",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
									d: "M2.626 2.626a.6.6 0 0 1 .849 0L8 7.152l4.525-4.526a.6.6 0 0 1 .849.849L8.848 8l4.526 4.525a.6.6 0 0 1-.849.849L8 8.848l-4.525 4.526a.6.6 0 0 1-.849-.849L7.152 8 2.626 3.475a.6.6 0 0 1 0-.849z",
									fill: "currentColor"
								})
							})
						})
					]
				}, key))
			})]
		})]
	}) : void 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PickerDialogShell, {
		visible,
		title: t("tencentLexiang.picker.selectFromLexiangTitle"),
		tabs: [{
			id: "recent",
			label: t("tencentLexiang.picker.recentUsed")
		}, {
			id: "directory",
			label: t("tencentLexiang.picker.kbDirectory")
		}],
		activeTabId: activeTab,
		onTabChange: (id) => handleTabChange(id),
		searchKeyword: keyword,
		onSearchKeywordChange: setKeyword,
		searchPlaceholder: resolvedSearchPlaceholder,
		searchFocused,
		onSearchFocusChange: setSearchFocused,
		confirmText: resolvedConfirmText,
		cancelText: resolvedCancelText,
		confirmDisabled: selected.size === 0,
		footerLeft,
		hideToolbar: !isAuthorized || license.status === "checking" || license.status === "denied",
		hideFooter: !isAuthorized || license.status === "checking" || license.status === "denied",
		containerStyle,
		resizable: true,
		onClose,
		onConfirm: handleConfirm,
		children: renderBody()
	});
}
var import_react, import_jsx_runtime, COLLAPSED_MAX, PAGE_SIZE;
var init_lexiang_content_picker = __esmMin((() => {
	init_tokens();
	init_lexiang_content_picker$1();
	import_react = /* @__PURE__ */ __toESM(require_react());
	init_contexts();
	init_ima_api_context();
	init_useI18n();
	init_asset_service();
	init_auth_service();
	init_no_knowledge_base_update();
	init_constants();
	init_use_lexiang_check_auth_gate();
	init_use_lexiang_license();
	init_auth_guide();
	init_lexiang_auth_store();
	init_kb_default_icon();
	init_team_default_icon();
	init_license_denied();
	init_kb_cascade_view();
	init_kb_item_row();
	init_picker_dialog_shell();
	init_picker_icons();
	init_use_debounced_value();
	init_use_lexiang_content_data();
	import_jsx_runtime = require_jsx_runtime();
	COLLAPSED_MAX = 3;
	PAGE_SIZE = 20;
}));
//#endregion
export { init_picker_dialog_shell as a, init_license_denied as c, init_use_debounced_value as i, init_use_lexiang_license as l, init_lexiang_content_picker as n, init_kb_item_row as o, init_use_lexiang_content_data as r, init_kb_cascade_view as s, LexiangContentPicker as t, init_tokens as u };
