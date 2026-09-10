import { n as __esmMin, t as __commonJSMin } from "./rolldown-runtime-D5a2oYpF.js";
import { Cn as require_main, Tn as createDecorator, vn as init_module } from "./dist-C0RQhKFs.js";
import { i as ua, r as init_esm } from "./esm-BUqrghoT.js";
import { Bd as Emitter, Dl as FieldType, Vd as init_event, Xc as ViewType, _d as i18n, fl as isLinkField, fu as slicePush, go as isUserField, on as isFormattedTreeNode, sd as domainConfig, sn as normalizeLeafChildrenToRecordIds, tu as init_es, ud as dom, yd as logger } from "./registry-C3gPA5CG.js";
import { a as init_es$1 } from "./render-app-config-NYjyHqfI.js";
import { A as wbColors, B as CommonScroller, C as init_wb_config, Ct as init_lib, Et as Level, G as init_cursor, H as init_register_esc_to_cancel, I as BaseRenderer, J as init_feature_single, K as BaseFeature, L as init_base_renderer, Mt as isHitRect, Nt as FeatureUIEvent, Pt as init_feature_event, S as WbSharedConfig, Tt as init_config$1, U as registerEscToCancel, V as init_scroller, W as Cursor, X as pen, Y as init_pen, Z as init_resources, _ as setStorageValue, at as NormalIconAlias, b as WB_SOURCE_DEFAULT_VISIBLE_VALUES, c as init_base_renderer_model, d as BaseStateCollector, f as init_state$1, ft as init_style, g as init_storage_sync$1, h as getStorageValue, jt as init_is_in_rect, k as init_color, l as BaseCollector, m as init_size$1, n as init_canvas_view, p as BaseSizeCollector, pt as style, q as FeatureAuth, s as BaseRendererModel, st as getCheckboxIconAlias, t as BaseCanvasView, u as init_collector$1, v as BaseCollectorDataUtil, w as shouldShowGroupAddButton, wt as DrawType, x as WB_SOURCE_FIELD_TITLE, y as init_data_util$1 } from "./canvas-view-B2Yy_fJW.js";
import { C as fieldCollector, S as init_avatar_time_utils, b as formatRelativeTime, c as SYS_TAGS_FIELD_TITLE, d as collectWbSpecialCell, f as formatFieldTooltipLabel, g as isWbSpecialField, h as isSameTagPillHit, l as collectBodyTag, m as init_wb_cell, n as init_auto_scroll$1, o as SYS_PRIORITY_FIELD_TITLE, p as getWbSpecialMeasureFieldType, r as BODY_TAG_PILL_GEOMETRY, s as SYS_STATUS_FIELD_TITLE, t as AutoScroll, u as collectTagsPillsInRect, v as resolveTagsCellItems, w as init_field_collector, x as getDateCellFullText, y as ensureRelativeTimePlugin } from "./auto-scroll-DrkOL904.js";
import { _ as flattenSubTree, a as runGroupTree, b as RowType, c as computeDropParentDepthRange, d as pickDropParentDepthByDragDx, g as filterFoldedSubTreeRecordIds, h as resolveTargetParentIdByDepth, l as computeMovingSubTreeHeight, m as resolveFinalNewParentId, n as init_storage_sync$2, o as init_sub_tree, r as init_run_group, s as buildSubTreeParentEntry, t as StorageSync, u as isDescendantOrSelf, v as init_string_group_path, x as init_interface$6, y as stringifyGroupPath } from "./storage-sync-7AzyCITg.js";
import { i as getDefaultContentCollectConfig, n as init_hover_tooltip_controller, o as init_config$2, r as makeHoverTooltipDisposable, t as HoverTooltipController } from "./hover-tooltip-controller-DDrkRneb.js";
import { _ as collectStatusText, a as collectRichGroupValue, c as collectGroupKeyDecoration, d as mapGroupValueToDisplayTitle, f as resolveGroupHeadTitle, g as collectRelativeTimeText, h as collectAvatarGroup, i as init_batch_selection, l as getGroupValueText, m as applyAvatarSlotsFieldTitlePrefix, n as readCellText, o as init_group_value_rich, p as resolveGroupKeyConf, r as BatchSelection, s as applyGroupTextMap, t as init_source_field, u as init_group_key_config, v as init_bottom_collectors, y as measureRelativeTimeSlotWidth } from "./source-field-DgEpBlHl.js";
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/features/common/auto-scroll/interface.js
var IListAutoScroll;
var init_interface$5 = __esmMin((() => {
	init_module();
	IListAutoScroll = createDecorator("IListAutoScroll");
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/features/list-feature.js
function _defineProperties$5(target, props) {
	for (var i = 0; i < props.length; i++) {
		var descriptor = props[i];
		descriptor.enumerable = descriptor.enumerable || false;
		descriptor.configurable = true;
		if ("value" in descriptor) descriptor.writable = true;
		Object.defineProperty(target, descriptor.key, descriptor);
	}
}
function _create_class$5(Constructor, protoProps, staticProps) {
	if (protoProps) _defineProperties$5(Constructor.prototype, protoProps);
	if (staticProps) _defineProperties$5(Constructor, staticProps);
	return Constructor;
}
function _inherits$17(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function");
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		writable: true,
		configurable: true
	} });
	if (superClass) _set_prototype_of$17(subClass, superClass);
}
function _set_prototype_of$17(o, p) {
	_set_prototype_of$17 = Object.setPrototypeOf || function setPrototypeOf(o, p) {
		o.__proto__ = p;
		return o;
	};
	return _set_prototype_of$17(o, p);
}
var ListFeatureBase;
var init_list_feature = __esmMin((() => {
	init_feature_single();
	ListFeatureBase = /* @__PURE__ */ function(BaseFeature) {
		"use strict";
		_inherits$17(ListFeatureBase, BaseFeature);
		function ListFeatureBase() {
			return BaseFeature.apply(this, arguments) || this;
		}
		_create_class$5(ListFeatureBase, [
			{
				key: "root",
				get: function() {
					return this.renderer.root;
				}
			},
			{
				key: "context",
				get: function() {
					return this.renderer.context;
				}
			},
			{
				key: "emitter",
				get: function() {
					return this.renderer.context.emitter;
				}
			},
			{
				key: "layer",
				get: function() {
					return this.renderer.getFeatureLayer();
				}
			},
			{
				key: "parentApi",
				get: function() {
					return this.renderer;
				}
			},
			{
				key: "collector",
				get: function() {
					return this.renderer.collector;
				}
			},
			{
				key: "UIEvent",
				get: function() {
					return this.renderer.UIEvent;
				}
			}
		]);
		return ListFeatureBase;
	}(BaseFeature);
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/features/common/auto-scroll/main.js
function _inherits$16(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function");
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		writable: true,
		configurable: true
	} });
	if (superClass) _set_prototype_of$16(subClass, superClass);
}
function _set_prototype_of$16(o, p) {
	_set_prototype_of$16 = Object.setPrototypeOf || function setPrototypeOf(o, p) {
		o.__proto__ = p;
		return o;
	};
	return _set_prototype_of$16(o, p);
}
var ListAutoScroll;
var init_main$6 = __esmMin((() => {
	init_auto_scroll$1();
	init_list_feature();
	ListAutoScroll = /* @__PURE__ */ function(ListFeatureBase) {
		"use strict";
		_inherits$16(ListAutoScroll, ListFeatureBase);
		function ListAutoScroll() {
			return ListFeatureBase.apply(this, arguments) || this;
		}
		var _proto = ListAutoScroll.prototype;
		_proto.bootstrap = function bootstrap() {
			this.autoScroll = this._register(new AutoScroll({
				scrollToX: () => {},
				scrollToY: (scrollY) => this.renderer.scrollToY(scrollY),
				getRoot: () => this.root,
				getScrollLeft: () => 0,
				getScrollTop: () => this.collector.range.scrollTop,
				getScale: () => this.collector.size.scale,
				getBoundRect: () => {
					var { size } = this.collector;
					return {
						left: 0,
						right: size.rootWidth,
						top: 0,
						bottom: size.rootHeight
					};
				},
				getBoundRectTopEdgeOffset() {
					return this.getRoot().getBoundingClientRect().top + this.getBoundRect().top + 1;
				}
			}));
		};
		_proto.readyX = function readyX(options) {
			this.autoScroll.readyX(options);
		};
		_proto.readyY = function readyY(options) {
			this.autoScroll.readyY(options);
		};
		_proto.readyBoth = function readyBoth(options) {
			this.autoScroll.readyBoth(options);
		};
		_proto.render = function render() {};
		return ListAutoScroll;
	}(ListFeatureBase);
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/features/common/auto-scroll/index.js
var init_auto_scroll = __esmMin((() => {
	init_interface$5();
	init_main$6();
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/features/common/storage-sync/interface.js
var IListStorageSync;
var init_interface$4 = __esmMin((() => {
	init_module();
	IListStorageSync = createDecorator("IListStorageSync");
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/features/common/storage-sync/main.js
function _defineProperties$4(target, props) {
	for (var i = 0; i < props.length; i++) {
		var descriptor = props[i];
		descriptor.enumerable = descriptor.enumerable || false;
		descriptor.configurable = true;
		if ("value" in descriptor) descriptor.writable = true;
		Object.defineProperty(target, descriptor.key, descriptor);
	}
}
function _create_class$4(Constructor, protoProps, staticProps) {
	if (protoProps) _defineProperties$4(Constructor.prototype, protoProps);
	if (staticProps) _defineProperties$4(Constructor, staticProps);
	return Constructor;
}
function _inherits$15(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function");
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		writable: true,
		configurable: true
	} });
	if (superClass) _set_prototype_of$15(subClass, superClass);
}
function _set_prototype_of$15(o, p) {
	_set_prototype_of$15 = Object.setPrototypeOf || function setPrototypeOf(o, p) {
		o.__proto__ = p;
		return o;
	};
	return _set_prototype_of$15(o, p);
}
var ListStorageSync;
var init_main$5 = __esmMin((() => {
	init_storage_sync$2();
	ListStorageSync = /* @__PURE__ */ function(StorageSync) {
		"use strict";
		_inherits$15(ListStorageSync, StorageSync);
		function ListStorageSync() {
			var _this = StorageSync.apply(this, arguments) || this;
			_this.syncToStorage = () => {
				_this.renderer.collector.state.saveState();
			};
			return _this;
		}
		_create_class$4(ListStorageSync, [{
			key: "UIEvent",
			get: function() {
				return this.renderer.UIEvent;
			}
		}]);
		return ListStorageSync;
	}(StorageSync);
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/features/common/storage-sync/index.js
var init_storage_sync = __esmMin((() => {
	init_interface$4();
	init_main$5();
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/features/pc/hover/interface.js
var IListHover;
var init_interface$3 = __esmMin((() => {
	init_module();
	IListHover = createDecorator("IListHover");
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/shared/placeholder-record.js
/**
* 生成 placeholder recordId
* @param status 分组匹配值（如 'pending' / 'running' / 'paused' / 'done'）
*/ function makePlaceholderRecordId(status) {
	return `${PLACEHOLDER_RECORD_PREFIX}${status}`;
}
/** 判断给定 recordId 是否是 placeholder */ function isPlaceholderRecordId(recordId) {
	return typeof recordId === "string" && recordId.startsWith("__list_placeholder__:");
}
/**
* 从 placeholder recordId 中解析出 status（分组匹配值）
*
* 若传入的不是 placeholder recordId，返回空字符串。
*/ function parsePlaceholderStatus(recordId) {
	if (!isPlaceholderRecordId(recordId)) return "";
	return recordId.slice(PLACEHOLDER_RECORD_PREFIX.length);
}
var PLACEHOLDER_RECORD_PREFIX;
var init_placeholder_record = __esmMin((() => {
	PLACEHOLDER_RECORD_PREFIX = "__list_placeholder__:";
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/features/pc/hover/main.js
function _inherits$14(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function");
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		writable: true,
		configurable: true
	} });
	if (superClass) _set_prototype_of$14(subClass, superClass);
}
function _set_prototype_of$14(o, p) {
	_set_prototype_of$14 = Object.setPrototypeOf || function setPrototypeOf(o, p) {
		o.__proto__ = p;
		return o;
	};
	return _set_prototype_of$14(o, p);
}
var EMPTY_STATE, FADE_IN_STEP, ListHover;
var init_main$4 = __esmMin((() => {
	init_es();
	init_pen();
	init_resources();
	init_style();
	init_cursor();
	init_is_in_rect();
	init_list_feature();
	init_interface$3();
	init_placeholder_record();
	init_wb_cell();
	EMPTY_STATE = {
		kind: "none",
		key: ""
	};
	FADE_IN_STEP = .15;
	ListHover = /* @__PURE__ */ function(ListFeatureBase) {
		"use strict";
		_inherits$14(ListHover, ListFeatureBase);
		function ListHover() {
			var _this = ListFeatureBase.apply(this, arguments) || this;
			_this.hoverGroup = null;
			_this.state = EMPTY_STATE;
			_this.fadeRaf = null;
			/**
			* 「右键菜单激活 record」flag：非 null 时，视觉上把 hover 反馈持续画在该 record 上，无视
			* 鼠标是否离开 canvas / 是否移到其它行。
			*
			* 生命周期完全在 hover feature 内部闭环，业务侧无需感知：
			*
			* **置位**：record 行背景 rect 上的 `onMouseUpWithRight` 触发时（用户在该行按下右键，
			* 宿主随即会弹出右键菜单）。placeholder record 不参与置位。
			*
			* **清除通道**（任一触发即清并 reapply）：
			* 1. `UIEvent.stage.onMouseDown`：stage 层的 mousedown 仅在**非右键**点击时 fire —— 右键
			*    会被 stage 改写为 `mousedownWithRight` 走另一通道。这条通道覆盖"用户点回表格 canvas"。
			* 2. `UIEvent.document.onMouseDownCapture`（capture 阶段）：覆盖"点 canvas 外任何 DOM"
			*    （含菜单项、菜单外空白、页面其它区域）。**例外**：若 mousedown target（或其祖先）是
			*    文本输入类控件（`<input>` 非按钮 type / `<textarea>` / `[contenteditable]` / `<select>`），
			*    跳过 —— 右键菜单里可能存在需要获焦的输入框，点它不应关菜单也不应清 hover。
			*    通过 `closest()` 覆盖大部分包裹层场景；label 外置等极少数边界仍会误清，可接受。
			* 3. `document.keydown ESC`：ESC 是关菜单的标准键位。`UIEvent.document` 未暴露 keydown
			*    通道，直接用 `dom.addDisposableListener` 挂原生监听。
			*
			* 上述监听全部在 bootstrap 常驻订阅，入口通过 `if (!activeId) return` 短路 —— 避免维护
			* 按需挂载 / 解除的生命周期，也与项目其它 feature 事件订阅风格保持一致。
			*
			* 生效路径：
			* - `onMouseMove`：命中的 recordId ≠ activeId 时短路（不 reapply、不清空），但仍更新
			*   lastHoverTarget，供清 flag 后无缝恢复到鼠标当前位置；
			* - `onMouseLeave`：直接短路，保留当前视觉；
			* - `onScroll` / `render`：以 activeId 的最新 rowRect（从 content collector 反查）
			*   重画，保证滚动 / patch 后视觉仍锁在正确位置；
			* - activeId 不在可见集合（滚出视口 / 数据被删）：默默降级为无 hover，但不清 flag，
			*   等下一次清除通道触发时统一收敛。
			*/ _this.rightMenuActiveRecordId = null;
			/**
			* 最近一次 mousemove 是否命中 record 行内"实际单元格内容"（leftConfigs /
			* rightConfigs / selectedCheckbox 任一 DrawConfig 的 bbox 内）。
			*
			* 用途：`onRecordBodyClick` 短路 —— 仅在命中实际内容时 fire `onRecordClick`，行内字段间空白
			* 区域不触发。判定放在 mousemove 阶段是因为：
			* 1) FeatureUIEvent 在 mousemove 提供 stage 内坐标 (evt.x, evt.y)，可直接与 DrawConfig 的全局
			*    坐标做命中（仅需加 scrollTop）；onClick 收到的是浏览器原生 MouseEvent，复算坐标需要重做
			*    `(clientX - container.left) / scale`，与 stage 内部逻辑重复一份；
			* 2) 状态稳定到下一次 mousemove 才会更新，覆盖"鼠标停在原位 → 点击"的常规交互；
			* 3) onScroll / 切换 record / 离开 stage 时随 lastHoverTarget 一并清空，不会跨上下文残留。
			*/ _this.lastHoverHitRecordContent = false;
			/**
			* 由 parentApi.render() 调用：底层数据/几何变化后重画 hover 反馈。
			*
			* 不能简单 clearHover —— 鼠标若未移动，stage 不会再 fire mousemove，hoverGroup 上的 onMouseUp handler
			* 也丢失了，导致同位连续点击失效（典型场景：checkbox 点击触发 render，下次点击无反应）。
			* 这里基于 lastHoverTarget 重新 resolve + apply，相当于模拟"鼠标仍在原位 hover"。
			*/ _this.render = () => {
				var _a;
				(_a = _this.hoverGroup) === null || _a === void 0 || _a.setAttrs(_this.collector.size.globalRect);
				if (_this.isPreventFromOtherFeature()) {
					_this.lastHoverTarget = void 0;
					_this.clearHover();
					return;
				}
				if (_this.rightMenuActiveRecordId) {
					var activeTarget = _this.buildActiveRecordTarget(_this.rightMenuActiveRecordId);
					var next = activeTarget ? _this.resolveState(activeTarget) : EMPTY_STATE;
					_this.applyState(next, activeTarget);
					return;
				}
				var target = _this.lastHoverTarget;
				var next1 = target ? _this.resolveState(target) : EMPTY_STATE;
				_this.applyState(next1, target);
			};
			_this.onMouseMove = (evt) => {
				if (_this.isPreventFromOtherFeature()) {
					_this.resetHoverCaches();
					_this.clearHover();
					return;
				}
				_this.lastHoverTarget = evt.target;
				_this.lastHoverHitRecordContent = _this.isHitRecordContent(evt.target, evt.x, evt.y);
				var prevCellHitKey = _this.combinedCellHitKey();
				_this.lastHoverStatusIconHit = _this.resolveCellHit(evt.target, evt.x, evt.y, "statusIcon");
				_this.lastHoverOwnerAvatarHit = _this.resolveCellHit(evt.target, evt.x, evt.y, "ownerAvatar");
				_this.lastHoverTagPillHit = _this.resolveTagPillHit(evt.target, evt.x, evt.y);
				var nextCellHitKey = _this.combinedCellHitKey();
				if (_this.rightMenuActiveRecordId) return;
				var next = _this.resolveState(evt.target);
				if (next.key === _this.state.key) {
					if ((next.kind === "recordRow" || next.kind === "checkbox") && prevCellHitKey !== nextCellHitKey) _this.applyState(next, evt.target);
					return;
				}
				_this.applyState(next, evt.target);
			};
			_this.onMouseLeave = () => {
				if (_this.rightMenuActiveRecordId) return;
				_this.resetHoverCaches();
				_this.clearHover();
			};
			_this.onScroll = () => {
				_this.resetHoverCaches();
				if (_this.rightMenuActiveRecordId) return;
				_this.clearHover();
			};
			/**
			* stage 层左键 / 中键 mousedown（右键已被 stage 改写为 mousedownWithRight 走另一通道，
			* 这里不会收到）：用户点回表格 canvas → 清除激活态。
			*/ _this.onStageMouseDown = () => {
				_this.clearRightMenuActive();
			};
			/**
			* 清除激活态：清 flag + 用 lastHoverTarget 重解一次 hover。
			*
			* 幂等：flag 未置位时直接返回，不重复 apply —— document 层监听常驻订阅时靠这一步短路。
			*/ _this.clearRightMenuActive = () => {
				if (!_this.rightMenuActiveRecordId) return;
				_this.rightMenuActiveRecordId = null;
				var target = _this.lastHoverTarget;
				var next = target ? _this.resolveState(target) : EMPTY_STATE;
				_this.applyState(next, target);
			};
			/**
			* document 层 mousedown（capture 阶段）：覆盖"点 canvas 外任何 DOM"。
			*
			* 短路顺序：
			* 1. flag 未置位 → 直接返回（无激活态时零成本）；
			* 2. 判定"点击是否属于要保留 hover 的输入类交互"：target 或其祖先命中以下选择器则跳过。
			*    `<input>` 排除按钮类 type（button/submit/reset/checkbox/radio/image/file/color/range/hidden），
			*    这些类型的 input 语义上是"点击执行"，与文本输入无关，应作为普通点击清 flag。
			*/ _this.onDocumentMouseDownCapture = (evt) => {
				if (!_this.rightMenuActiveRecordId) return;
				var target = evt.event.target;
				if (target instanceof Element) {
					if (target.closest("input:not([type=\"button\"]):not([type=\"submit\"]):not([type=\"reset\"]):not([type=\"checkbox\"]):not([type=\"radio\"]):not([type=\"image\"]):not([type=\"file\"]):not([type=\"color\"]):not([type=\"range\"]):not([type=\"hidden\"]),textarea,select,[contenteditable=\"true\"],[contenteditable=\"\"]")) return;
				}
				_this.clearRightMenuActive();
			};
			/**
			* document 层 keydown（capture 阶段）：ESC 关菜单信号。
			* 未激活时短路，避免对全局键盘交互产生任何副作用。
			*/ _this.onDocumentKeyDown = (event) => {
				if (!_this.rightMenuActiveRecordId) return;
				if (event.key === "Escape") _this.clearRightMenuActive();
			};
			return _this;
		}
		var _proto = ListHover.prototype;
		_proto.bootstrap = function bootstrap() {
			this.hoverGroup = pen.group(Object.assign(Object.assign({}, this.collector.size.globalRect), { batch: true }));
			this.layer.addGroup(this.hoverGroup);
			this._register(this.UIEvent.stage.onMouseMove(this.onMouseMove));
			this._register(this.UIEvent.stage.onMouseLeave(this.onMouseLeave));
			this._register(this.UIEvent.stage.onMouseDown(this.onStageMouseDown));
			this._register(this.collector.range.onScroll(this.onScroll));
			this._register({ dispose: () => this.cancelFade() });
			this._register(this.UIEvent.document.onMouseDownCapture(this.onDocumentMouseDownCapture));
			this._register(dom.addDisposableListener(document, "keydown", this.onDocumentKeyDown, true));
		};
		/**
		* 由 record 行背景 rect 的 `onMouseUpWithRight` 调用：把激活 recordId 置为该行，立即重画。
		*
		* placeholder record 不参与右键激活（直接 return，不置 flag）；行背景的 `onMouseUpWithRight`
		* 也在 `drawRecordHover` 里被跳过挂载 —— 这里的判断是双保险。
		*
		* 多次连续右键点不同行：直接切换到新 recordId。document 层监听在 bootstrap 已常驻订阅。
		*/ _proto.activateRightMenu = function activateRightMenu(recordId) {
			if (!recordId || isPlaceholderRecordId(recordId)) return;
			if (this.rightMenuActiveRecordId === recordId) {
				var activeTarget = this.buildActiveRecordTarget(recordId);
				var next = activeTarget ? this.resolveState(activeTarget) : EMPTY_STATE;
				this.applyState(next, activeTarget);
				return;
			}
			this.rightMenuActiveRecordId = recordId;
			var activeTarget1 = this.buildActiveRecordTarget(recordId);
			var next1 = activeTarget1 ? this.resolveState(activeTarget1) : EMPTY_STATE;
			this.applyState(next1, activeTarget1);
		};
		/**
		* 用 activeRecordId 从 content collector 的可见集合反查最新 rowRect，合成一个可复用现有
		* `applyState` / `drawRecordHover` 绘制路径的伪 ListTarget（stage 视口坐标）。
		*
		* 关键点：
		* - `RecordRenderInfo.rowRect` 是全局坐标（未扣 scrollTop），与 event-handler 中 `hitRecord`
		*   的转换保持一致：`y - scrollTop` 得到 stage 视口坐标；
		* - 只填 `isRecordRow` / `recordId` / `recordRowRenderRect` / `checkboxRenderRect`：
		*   足够走 `resolveState → recordRow` 分支 + `drawRecordHover` 常规绘制；`isCheckbox` 保持
		*   `false` 让状态稳定为 `recordRow`（不因激活误进 checkbox 状态而画额外描边）；
		* - 找不到（record 滚出视口 / 被删）：返回 undefined，上层 render() 自然降级为空 hover。
		*/ _proto.buildActiveRecordTarget = function buildActiveRecordTarget(recordId) {
			var info = this.collector.content.getRecordRenderInfo(recordId);
			if (!(info === null || info === void 0 ? void 0 : info.rowRect)) return void 0;
			var { size, range } = this.collector;
			var rowRect = {
				x: info.rowRect.x,
				y: info.rowRect.y - range.scrollTop,
				width: info.rowRect.width,
				height: info.rowRect.height
			};
			return {
				isOutStage: false,
				isBlank: false,
				isRecordRow: true,
				recordId,
				recordRowRenderRect: rowRect,
				checkboxRenderRect: {
					x: rowRect.x + size.checkboxPaddingLeft,
					y: rowRect.y + (rowRect.height - size.checkboxSize) / 2,
					width: size.checkboxSize,
					height: size.checkboxSize
				}
			};
		};
		/**
		* 重置所有 hover 相关的命中缓存。在「锁定 / 离开 stage / 滚动」三处必须同步清空，
		* 避免缓存的命中态跨上下文残留（导致 cursor / hit rect 错位）。
		*/ _proto.resetHoverCaches = function resetHoverCaches() {
			this.lastHoverTarget = void 0;
			this.lastHoverHitRecordContent = false;
			this.lastHoverStatusIconHit = void 0;
			this.lastHoverOwnerAvatarHit = void 0;
			this.lastHoverTagPillHit = void 0;
		};
		_proto.clearHover = function clearHover() {
			if (this.state.kind === "none") return;
			this.applyState(EMPTY_STATE);
		};
		_proto.resolveState = function resolveState(t) {
			if (!t || t.isOutStage) return EMPTY_STATE;
			if (t.isFoldBtn && t.foldBtnRenderRect) return {
				kind: "foldBtn",
				key: `foldBtn:${t.groupIndex}`
			};
			if (t.isSelectAllBtn && t.selectAllRenderRect) return {
				kind: "selectAll",
				key: `selectAll:${t.groupIndex}`
			};
			if (t.isGroupAddBtn && t.groupAddRenderRect) return {
				kind: "groupAdd",
				key: `groupAdd:${t.groupIndex}`
			};
			if (t.isGroupHead && t.recordRowRenderRect) return {
				kind: "groupHead",
				key: `groupHead:${t.groupIndex}`
			};
			if (t.isCheckbox && t.checkboxRenderRect && t.recordId) {
				if (isPlaceholderRecordId(t.recordId)) return t.recordRowRenderRect ? {
					kind: "recordRow",
					key: `row:${t.recordId}`
				} : EMPTY_STATE;
				return {
					kind: "checkbox",
					key: `checkbox:${t.recordId}`
				};
			}
			if (t.isRecordRow && t.recordRowRenderRect && t.recordId) return {
				kind: "recordRow",
				key: `row:${t.recordId}`
			};
			return EMPTY_STATE;
		};
		_proto.applyState = function applyState(next, target) {
			var sameKey = next.key !== "" && next.key === this.state.key;
			var sameGroup = this.isSameGroupHover(this.state, next);
			this.state = next;
			if (!this.hoverGroup) return;
			this.cancelFade();
			this.hoverGroup.clear();
			this.applyHoverGroupBounds(next.kind);
			if (next.kind === "foldBtn" && (target === null || target === void 0 ? void 0 : target.foldBtnRenderRect)) {
				var rect = target.foldBtnRenderRect;
				var drawer = (opacity) => {
					if (target.recordRowRenderRect) this.drawGroupHeadHover(target.recordRowRenderRect, 1, target);
					this.drawFoldBtnHover(rect, opacity, target);
				};
				if (sameKey || sameGroup) drawer(1);
				else this.runFadeIn(drawer);
			} else if (next.kind === "groupAdd" && (target === null || target === void 0 ? void 0 : target.groupAddRenderRect) && target.groupPath) {
				var rect1 = target.groupAddRenderRect;
				var { groupPath } = target;
				var drawer1 = (opacity) => {
					if (target.recordRowRenderRect) this.drawGroupHeadHover(target.recordRowRenderRect, 1, target);
					this.drawGroupAddHover(rect1, groupPath, opacity);
				};
				if (sameKey || sameGroup) drawer1(1);
				else this.runFadeIn(drawer1);
			} else if (next.kind === "selectAll" && (target === null || target === void 0 ? void 0 : target.selectAllRenderRect) && target.groupPath) {
				this.drawSelectAllHover(target.selectAllRenderRect, target.groupPath);
				this.setCursor(Cursor.POINTER);
			} else if (next.kind === "groupHead" && (target === null || target === void 0 ? void 0 : target.recordRowRenderRect)) {
				var rect2 = target.recordRowRenderRect;
				if (sameKey || sameGroup) this.drawGroupHeadHover(rect2, 1, target);
				else {
					var drawer2 = (opacity) => this.drawGroupHeadHover(rect2, opacity, target);
					this.runFadeIn(drawer2);
				}
				this.setCursor(Cursor.DEFAULT);
			} else if ((next.kind === "recordRow" || next.kind === "checkbox") && (target === null || target === void 0 ? void 0 : target.recordRowRenderRect) && target.recordId) {
				this.drawRecordHover(target);
				if (next.kind === "recordRow") {
					var isPlaceholderRow = (target === null || target === void 0 ? void 0 : target.recordId) && isPlaceholderRecordId(target.recordId);
					var tagPillHit = this.lastHoverTagPillHit;
					var shouldPoint = isPlaceholderRow || this.lastHoverStatusIconHit || this.lastHoverOwnerAvatarHit || tagPillHit && !this.collector.state.isSourceFieldId(tagPillHit.fieldId);
					this.setCursor(shouldPoint ? Cursor.POINTER : Cursor.DEFAULT);
				}
			} else this.setCursor(Cursor.DEFAULT);
		};
		/** 判断两个 HoverState 是否属于同一个 GroupHead 行（groupHead / foldBtn / groupAdd 共享同一行）。 */ _proto.isSameGroupHover = function isSameGroupHover(prev, next) {
			var GROUP_KINDS = new Set([
				"groupHead",
				"foldBtn",
				"groupAdd"
			]);
			if (!GROUP_KINDS.has(prev.kind) || !GROUP_KINDS.has(next.kind)) return false;
			var prevIdx = prev.key.split(":")[1];
			var nextIdx = next.key.split(":")[1];
			return prevIdx !== void 0 && prevIdx === nextIdx;
		};
		/**
		* 根据当前 hover 类型与 sticky head 状态，计算并应用 hoverGroup 自身的几何范围。
		*
		* 仅 record/checkbox 会因为 sticky head 视觉遮挡而需要顶部裁剪；其余类型（foldBtn/groupAdd/none）
		* 一律还原到 globalRect 以避免 sticky head 上的反馈被裁。
		*/ _proto.applyHoverGroupBounds = function applyHoverGroupBounds(kind) {
			if (!this.hoverGroup) return;
			var { size } = this.collector;
			var global = size.globalRect;
			if (kind !== "recordRow" && kind !== "checkbox") {
				this.hoverGroup.setAttrs(global);
				return;
			}
			var sticky = this.parentApi.getStickyHead();
			var stickyBottom = sticky.index >= 0 ? Math.max(0, sticky.offsetY + size.groupHeadHeight) : 0;
			if (stickyBottom <= 0) {
				this.hoverGroup.setAttrs(global);
				return;
			}
			this.hoverGroup.setAttrs({
				x: global.x,
				y: global.y + stickyBottom,
				width: global.width,
				height: Math.max(0, global.height - stickyBottom)
			});
		};
		_proto.runFadeIn = function runFadeIn(draw) {
			var opacity = 0;
			var tick = () => {
				this.fadeRaf = null;
				if (!this.hoverGroup) return;
				opacity = Math.min(1, Math.floor((opacity + FADE_IN_STEP) * 100) / 100);
				this.hoverGroup.clear();
				draw(opacity);
				if (opacity < 1) this.fadeRaf = requestAnimationFrame(tick);
			};
			this.fadeRaf = requestAnimationFrame(tick);
		};
		_proto.cancelFade = function cancelFade() {
			if (this.fadeRaf !== null) {
				cancelAnimationFrame(this.fadeRaf);
				this.fadeRaf = null;
			}
		};
		_proto.drawFoldBtnHover = function drawFoldBtnHover(rect, opacity, target) {
			var _a;
			(_a = this.hoverGroup) === null || _a === void 0 || _a.add(pen.config.rect(Object.assign(Object.assign({}, rect), {
				background: style.color.hoverBackground,
				borderRadius: Math.min(rect.width, rect.height) / 2,
				opacity,
				onMouseUp: (event, stopPropagation) => {
					if (!(target === null || target === void 0 ? void 0 : target.groupPath)) return;
					stopPropagation === null || stopPropagation === void 0 || stopPropagation();
					this.collector.state.toggleGroupFold(target.groupPath);
					this.collector.rows.patch();
					this.collector.range.patch();
					this.collector.content.patch();
					this.parentApi.render();
				}
			})));
		};
		_proto.drawGroupAddHover = function drawGroupAddHover(rect, groupPath, opacity) {
			var _a;
			(_a = this.hoverGroup) === null || _a === void 0 || _a.add(pen.config.rect(Object.assign(Object.assign({}, rect), {
				background: style.color.hoverBackground,
				borderRadius: Math.min(rect.width, rect.height) / 2,
				opacity,
				onMouseUp: (event, stopPropagation) => {
					stopPropagation === null || stopPropagation === void 0 || stopPropagation();
					this.emitter.wbService.onGroupAddClick.fire({ groupPath });
				}
			})));
		};
		/**
		* GroupHead 行 hover：整行叠浅色 hoverBackground，与 record 行 hover 视觉对齐。
		*
		* 承接整行折叠：点击行任意位置（除加号 / 全选文字按钮 / foldBtn 各自的 hit rect，
		* 它们通过 stopPropagation 拦截）都触发 toggleGroupFold，与点 foldBtn 完全同款。
		* hit rect 与 foldBtn / groupAdd / selectAll 位于同一 hoverGroup 内，后 add 的按钮
		* rect 命中优先级更高，只要按钮 handler stopPropagation 就不会走到这里。
		*/ _proto.drawGroupHeadHover = function drawGroupHeadHover(rect, opacity, target) {
			var _a;
			var { size } = this.collector;
			(_a = this.hoverGroup) === null || _a === void 0 || _a.add(pen.config.rect(Object.assign(Object.assign({}, rect), {
				background: style.color.hoverBackground,
				borderRadius: size.headBgRadius,
				opacity,
				onMouseUp: (_event) => {
					if (!(target === null || target === void 0 ? void 0 : target.groupPath)) return;
					this.collector.state.toggleGroupFold(target.groupPath);
					this.collector.rows.patch();
					this.collector.range.patch();
					this.collector.content.patch();
					this.parentApi.render();
				}
			})));
		};
		/**
		* 「全选/取消全选」hover：与 kanban-todo 同款。
		* 视觉规范要求不绘制 hover 背景（文字本身用 cardActiveBorder 颜色区分），但仍需一层透明 rect 承接 onClick——
		* 纯文字 DrawConfig 的可点区域是文字 bbox，可能与 selectAllRect 不一致且会被同 group 其它 hover 层级覆盖。
		* 点击后：切换该分组（含子孙叶子分组）所有 record 的选中态 → fire onRecordSelectChange → 重收集可见区域 + 重绘。
		*
		* 入参 `path` 直接来自 target.groupPath（外层 / 叶子层都用同一份 path 表达），
		* state 内部按"路径前缀"聚合所有子孙叶子分组的 recordIds，因此最外层分组的全选也能覆盖全部子孙 records。
		*/ _proto.drawSelectAllHover = function drawSelectAllHover(rect, path) {
			var _a;
			(_a = this.hoverGroup) === null || _a === void 0 || _a.add(pen.config.rect(Object.assign(Object.assign({}, rect), {
				opacity: 1,
				onMouseUp: (_event) => {
					var isAllSelected = this.collector.state.isGroupAllSelected(path);
					this.collector.state.selectAllInGroup(path, !isAllSelected);
					this.emitter.wbService.onRecordSelectChange.fire(this.collector.state.getSelectedRecordIds());
					this.collector.content.collectVisibleWithHeads();
					this.parentApi.render();
				}
			})));
		};
		/**
		* Record hover：
		* - 整行浅色 hoverBackground（已选中态由 content collector 绘制 selectionBackground，hover 时叠加更深一档）；
		* - 行最左侧绘制未选中态 checkbox（已选中态由 content collector 收集了 CHECKBOX_CHECK_GREEN）；
		* - 点击：checkbox 区域走 toggleRecordSelected，其它区域走 onRecordClick；
		* - sticky GroupHead 视觉占据顶部一块区域，会覆盖滚到此处的 Record；hover 绘制由 hoverGroup 自身的
		*   几何范围（applyHoverGroupBounds 中收缩到 stickyBottom 之下）通过 canvas clip 自动裁掉，
		*   不在此处再做坐标级裁剪，否则 onMouseUp 命中区会被错位破坏。
		*/ _proto.drawRecordHover = function drawRecordHover(target) {
			var _a, _b, _c, _d, _e;
			if (!target.recordRowRenderRect || !target.recordId) return;
			var rect = target.recordRowRenderRect;
			var { recordId } = target;
			var { size, state } = this.collector;
			var isPlaceholder = isPlaceholderRecordId(recordId);
			var isSelected = !isPlaceholder && state.isRecordSelected(recordId);
			var onRightUp = isPlaceholder ? void 0 : () => this.activateRightMenu(recordId);
			if (!isSelected) (_a = this.hoverGroup) === null || _a === void 0 || _a.add(pen.config.rect(Object.assign(Object.assign({}, rect), {
				background: style.color.hoverBackground,
				borderRadius: size.recordBgRadius,
				opacity: 1,
				onMouseUp: (event) => this.onRecordBodyClick(event, target),
				onMouseUpWithRight: onRightUp
			})));
			else (_b = this.hoverGroup) === null || _b === void 0 || _b.add(pen.config.rect(Object.assign(Object.assign({}, rect), {
				opacity: 1,
				onMouseUp: (event) => this.onRecordBodyClick(event, target),
				onMouseUpWithRight: onRightUp
			})));
			if (isPlaceholder) return;
			var cbX = rect.x + size.checkboxPaddingLeft;
			var cbY = rect.y + (rect.height - size.checkboxSize) / 2;
			var isBatchMode = state.isBatchSelectMode();
			if (!isSelected && !isBatchMode) {
				var cbRect = {
					x: cbX,
					y: cbY,
					width: size.checkboxSize,
					height: size.checkboxSize
				};
				(_c = this.hoverGroup) === null || _c === void 0 || _c.add(pen.config.icon(getCheckboxIconAlias(false), Object.assign(Object.assign({}, cbRect), { onMouseUp: (event, stopPropagation) => {
					var _a;
					stopPropagation === null || stopPropagation === void 0 || stopPropagation();
					this.handleCheckboxClick(recordId, (_a = event === null || event === void 0 ? void 0 : event.shiftKey) !== null && _a !== void 0 ? _a : false);
				} })));
				if (this.state.kind === "checkbox") {
					var svgIconPadding = 3;
					(_d = this.hoverGroup) === null || _d === void 0 || _d.add(pen.config.rect({
						x: cbRect.x + svgIconPadding,
						y: cbRect.y + svgIconPadding,
						width: cbRect.width - svgIconPadding * 2,
						height: cbRect.height - svgIconPadding * 2,
						borderColor: style.color.strongBorderColor,
						borderRadius: 2
					}));
				}
			} else (_e = this.hoverGroup) === null || _e === void 0 || _e.add(pen.config.rect({
				x: cbX,
				y: cbY,
				width: size.checkboxSize,
				height: size.checkboxSize,
				opacity: 1,
				onMouseUp: (event, stopPropagation) => {
					var _a;
					stopPropagation === null || stopPropagation === void 0 || stopPropagation();
					this.handleCheckboxClick(recordId, (_a = event === null || event === void 0 ? void 0 : event.shiftKey) !== null && _a !== void 0 ? _a : false);
				}
			}));
			var info = this.collector.content.getRecordRenderInfo(recordId);
			if ((info === null || info === void 0 ? void 0 : info.statusIconRect) && info.statusIconFieldId) this.addCellHitRect(info.statusIconRect, recordId, info.statusIconFieldId, 10);
			if ((info === null || info === void 0 ? void 0 : info.ownerAvatarRect) && info.ownerAvatarFieldId) this.addCellHitRect(info.ownerAvatarRect, recordId, info.ownerAvatarFieldId, 0);
			if (info === null || info === void 0 ? void 0 : info.bodyTagPillRects) this.addTagPillHitRects(info.bodyTagPillRects, recordId);
		};
		/**
		* 在 hoverGroup 上叠一层覆盖 `cellRect` 的透明 hit rect，承接 onMouseUp：
		* - 停止冒泡，避免命中行背景的 `onRecordBodyClick` 把 `onRecordClick` 用「无 fieldId」再 fire 一次；
		* - fire `onRecordClick` 带 fieldId + cellRect。cellRect 为 stage 视口坐标系（y 已扣 scrollTop），
		*   与 grid 单元格点击同语义；`offsetX` 用于历史兼容（status icon 需要锚点偏移 10px 让浮层挂在 icon 右侧）。
		*
		* 抽出来给 status icon + owner 头像组复用，避免两段几乎相同的 fire 块漂移。
		*
		* ⚠️ 坐标系：入参 `rect` 来自 RecordRenderInfo（statusIconRect / ownerAvatarRect），是**全局坐标**
		* （未扣 scrollTop，详见 content.ts 中相应字段注释）。而 `hoverGroup` 是 stage 视口坐标系
		* （hit rect 的 onMouseUp 派发也按 stage 视口坐标匹配 mouse 位置）。
		* 因此画 hit rect 前必须先把 y 扣 scrollTop 转换到 stage 视口坐标系，
		* 否则有垂直滚动时 hit rect 会画到屏幕下方（甚至屏幕外），鼠标点击 icon 时不命中 hit rect，
		* 冒泡到行背景的 `onRecordBodyClick` 后 fire 的 `onRecordClick` 不带 cellRect / fieldId。
		* （cursor 升级 POINTER 走的是 `resolveCellHit` —— 用全局坐标 `absY = stageY + scrollTop` 命中
		* 全局坐标的 rect，自身正确，所以会出现「鼠标手势是 pointer 但点击丢 cellRect」的不一致现象。）
		*/ _proto.addCellHitRect = function addCellHitRect(rect, recordId, fieldId, offsetX) {
			var _a;
			var scrollTop = this.collector.range.scrollTop;
			var stageRect = {
				x: rect.x,
				y: rect.y - scrollTop,
				width: rect.width,
				height: rect.height
			};
			(_a = this.hoverGroup) === null || _a === void 0 || _a.add(pen.config.rect(Object.assign(Object.assign({}, stageRect), {
				opacity: 1,
				onMouseUp: (event, stopPropagation) => {
					stopPropagation === null || stopPropagation === void 0 || stopPropagation();
					this.emitter.wbService.onRecordClick.fire({
						recordId,
						fieldId,
						cellRect: {
							x: stageRect.x + offsetX,
							y: stageRect.y,
							width: stageRect.width,
							height: stageRect.height
						}
					});
				}
			})));
		};
		/**
		* Record body 点击：仅当鼠标当前停在"实际单元格内容"上时 fire `onRecordClick`。
		*
		* - checkbox 命中由 checkbox 自己的 onMouseUp 通过 stopPropagation 拦截，不会冒泡到这里；
		* - 行内字段之间 / 行两端的纯空白区域（`!lastHoverHitRecordContent`）按"未点到内容"处理直接 return，
		*   与「点击空白处不触发 Record 点击事件」的语义对齐；
		* - 命中信息由 `onMouseMove` 同步算好（复用 stage 坐标 evt.x/y + scrollTop 与 RecordRenderInfo
		*   里 leftConfigs / rightConfigs / selectedCheckbox 的真实 bbox 做命中），
		*   onMouseUp 这里只消费缓存值，避免在原生 MouseEvent 上重算 stage 坐标。
		*/ _proto.onRecordBodyClick = function onRecordBodyClick(event, target) {
			if (!target.recordId) return;
			if (isPlaceholderRecordId(target.recordId)) {
				var status = parsePlaceholderStatus(target.recordId);
				if (status) this.emitter.wbService.onGroupAddClick.fire({ groupPath: [status] });
				return;
			}
			if (target.isRecordLeftGutter) return;
			this.emitter.wbService.onRecordClick.fire({ recordId: target.recordId });
		};
		/**
		* 判定 (stageX, stageY) 是否落在 record 行内指定可点击单元格（status icon / owner 头像组）
		* 的视觉 rect 上；命中则返回 { rect, fieldId }。
		*
		* 与 `isHitRecordContent` 同款坐标转换：DrawConfig 的 y 为全局坐标（未扣 scrollTop），mousemove
		* 提供 stage 内坐标，因此 `absY = stageY + scrollTop`。
		*
		* 仅 `isRecordRow + 对应 rect + 对应 fieldId` 三者齐备时才视为命中候选；缺任一返回 undefined，
		* 状态机 cursor 自然落回默认指针。
		*
		* status icon 与 owner 头像组的处理完全对称，抽到同一方法里只在末尾按 kind 取不同字段，
		* 避免两份几乎一致的实现漂移。
		*/ _proto.resolveCellHit = function resolveCellHit(target, stageX, stageY, kind) {
			if (!(target === null || target === void 0 ? void 0 : target.isRecordRow) || !target.recordId) return void 0;
			var info = this.collector.content.getRecordRenderInfo(target.recordId);
			if (!info) return void 0;
			var rect;
			var fieldId;
			if (kind === "statusIcon") {
				rect = info.statusIconRect;
				fieldId = info.statusIconFieldId;
			} else {
				rect = info.ownerAvatarRect;
				fieldId = info.ownerAvatarFieldId;
			}
			if (!rect || !fieldId) return void 0;
			if (!isHitRect(stageX, stageY + this.collector.range.scrollTop, rect)) return void 0;
			return {
				rect,
				fieldId
			};
		};
		/**
		* 把单个命中信息序列化成稳定 key（无命中 → 空串），用于 mousemove 时判断"命中态是否切换"。
		*/ _proto.cellHitKey = function cellHitKey(hit) {
			if (!hit) return "";
			return `${hit.fieldId}:${hit.rect.x},${hit.rect.y},${hit.rect.width},${hit.rect.height}`;
		};
		/**
		* 把 status icon + owner 头像两路命中信息合成一个稳定 key，用于"两路任一切换就 reapply"。
		* 仅在 key 变化时触发 reapplyState，避免同 record 内每次 mousemove 都全量重画 hover。
		*/ _proto.combinedCellHitKey = function combinedCellHitKey() {
			return `${this.cellHitKey(this.lastHoverStatusIconHit)}|${this.cellHitKey(this.lastHoverOwnerAvatarHit)}|${this.cellHitKey(this.lastHoverTagPillHit)}`;
		};
		/**
		* 判定 (stageX, stageY) 是否落在 record 行内 body 区标签组某颗 pill 上；命中则返回 `{ rect, fieldId }`。
		*
		* 坐标语境与 `resolveCellHit` 一致：pill rect 为全局坐标（未扣 scrollTop），mousemove 提供 stage 内坐标，
		* 因此 `absY = stageY + scrollTop`。
		*
		* 遍历 `info.bodyTagPillRects`，命中第一颗即返回（pill 不重叠，无需优先级排序）。
		*/ _proto.resolveTagPillHit = function resolveTagPillHit(target, stageX, stageY) {
			var _a;
			if (!(target === null || target === void 0 ? void 0 : target.isRecordRow) || !target.recordId) return void 0;
			var info = this.collector.content.getRecordRenderInfo(target.recordId);
			if (!((_a = info === null || info === void 0 ? void 0 : info.bodyTagPillRects) === null || _a === void 0 ? void 0 : _a.length)) return void 0;
			var absY = stageY + this.collector.range.scrollTop;
			for (var pill of info.bodyTagPillRects) if (isHitRect(stageX, absY, pill.rect)) return {
				rect: pill.rect,
				fieldId: pill.fieldId
			};
		};
		/**
		* 在 hoverGroup 上为 body 区标签组每颗 pill 绘制透明 hit rect 承接点击 + hover 反馈。
		*
		* 与 `addCellHitRect` 同款坐标转换（全局坐标 → stage 视口坐标），并在当前 mousemove 命中的
		* pill 上叠一层 hoverBackground 圆角矩形作为视觉反馈。
		*/ _proto.addTagPillHitRects = function addTagPillHitRects(pillRects, recordId) {
			var _this, _loop = function(pill) {
				var stageRect = {
					x: pill.rect.x,
					y: pill.rect.y - scrollTop,
					width: pill.rect.width,
					height: pill.rect.height
				};
				var isHover = isSameTagPillHit(hoveredHit, pill);
				var pillFieldId = pill.fieldId;
				var isSource = _this.collector.state.isSourceFieldId(pillFieldId);
				if (isHover && !isSource) (_a = _this.hoverGroup) === null || _a === void 0 || _a.add(pen.config.rect(Object.assign(Object.assign({}, stageRect), {
					background: style.color.hoverBackground,
					borderRadius: stageRect.height / 2,
					opacity: 1
				})));
				(_b = _this.hoverGroup) === null || _b === void 0 || _b.add(pen.config.rect(Object.assign(Object.assign({}, stageRect), {
					opacity: 1,
					onMouseUp: (event, stopPropagation) => {
						stopPropagation === null || stopPropagation === void 0 || stopPropagation();
						_this.emitter.wbService.onRecordClick.fire(isSource ? { recordId } : {
							recordId,
							fieldId: pillFieldId,
							cellRect: Object.assign({}, stageRect)
						});
					}
				})));
			};
			var _a, _b;
			var scrollTop = this.collector.range.scrollTop;
			var hoveredHit = this.lastHoverTagPillHit;
			for (var pill of pillRects) _this = this, _loop(pill);
		};
		/**
		* 判定 (stageX, stageY) 是否落在 record 行内任一实际绘制内容（leftConfigs /
		* rightConfigs / selectedCheckbox）的视觉 bbox 内.
		*
		* 坐标语境：DrawConfig 的 (x, y) 是画布全局坐标（未扣 scrollTop），mousemove 提供的 (evt.x, evt.y)
		* 是 stage 内坐标，因此命中前把 stageY 还原到全局 `absY = stageY + scrollTop`。
		*
		* 文本类（Text）特殊处理：cfg.width/height 是字段**容器**几何（例如 Title 字段固定 386 宽，无论文字
		* 多短都铺满容器），直接用容器 bbox 命中会把字段内的视觉空白也算成命中（出现"行内左字段右侧空白
		* 也触发卡片点击"的 bug）。Text 提供了 `layouts: { x, y, width, height, text }[]`，是按字符排版后
		* 的实际占用区段（x/y 相对 cfg），这里改用 layouts 联合命中，更贴近视觉感知。
		*
		* 其它类型（Bitmap / Rect / Polygon / Corner）的容器 bbox ≈ 视觉 bbox（icon 满铺；rect 本身是绘制
		* 体），继续整体 bbox 命中。
		*
		* 仅在命中 record 行（非 checkbox）时才有意义；其它命中情况一律返回 false。
		*/ _proto.isHitRecordContent = function isHitRecordContent(target, stageX, stageY) {
			if (!(target === null || target === void 0 ? void 0 : target.isRecordRow) || !target.recordId) return false;
			var info = this.collector.content.getRecordRenderInfo(target.recordId);
			if (!info) return false;
			var absY = stageY + this.collector.range.scrollTop;
			var hits = (configs) => {
				if (!(configs === null || configs === void 0 ? void 0 : configs.length)) return false;
				for (var cfg of configs) if (this.hitDrawConfig(cfg, stageX, absY)) return true;
				return false;
			};
			if (hits(info.leftConfigs)) return true;
			if (hits(info.rightConfigs)) return true;
			if (info.selectedCheckbox && this.hitDrawConfig(info.selectedCheckbox, stageX, absY)) return true;
			return false;
		};
		/**
		* 单个 DrawConfig 的命中判定。
		*
		* - Text：用 `layouts` 联合命中（每个 layout 是「相对 cfg 偏移 + 行宽高」的真实文字 bbox）。
		*   layouts 缺失（理论不应发生）回退用容器 bbox，至少不丢命中；
		* - 其它类型：用容器 bbox（cfg.x/y/width/height）。LineConfig 无 width/height，由 toRect 守卫返回 null。
		*/ _proto.hitDrawConfig = function hitDrawConfig(cfg, x, y) {
			var _a;
			if (cfg.type === "Text") {
				var text = cfg;
				if ((_a = text.layouts) === null || _a === void 0 ? void 0 : _a.length) {
					for (var layout of text.layouts) if (layout.width > 0 && layout.height > 0 && isHitRect(x, y, {
						x: text.x + layout.x,
						y: text.y + layout.y,
						width: layout.width,
						height: layout.height
					})) return true;
					return false;
				}
			}
			var rect = this.toRect(cfg);
			return Boolean(rect && isHitRect(x, y, rect));
		};
		/**
		* 把任意 DrawConfig 还原成命中用的 Rect。
		*
		* 大多数 DrawConfig（Bitmap / Text / Rect / Polygon / Corner）都从 BaseConfig extends Rect，自带
		* x/y/width/height；唯一例外是 LineConfig（用 points 表达几何，无 width/height）。record 行的内容
		* 收集逻辑里（content collector 的 leftConfigs / rightConfigs / selectedCheckbox）
		* 产出的都是字段渲染产物，目前不会出现 Line —— 这里仍做 falsy 守卫，避免类型层 union 漏掉时静默命中失败。
		*/ _proto.toRect = function toRect(cfg) {
			var rect = cfg;
			if (typeof rect.x !== "number" || typeof rect.y !== "number") return null;
			if (typeof rect.width !== "number" || typeof rect.height !== "number") return null;
			if (rect.width <= 0 || rect.height <= 0) return null;
			return {
				x: rect.x,
				y: rect.y,
				width: rect.width,
				height: rect.height
			};
		};
		/**
		* 处理 checkbox 点选（支持 shift + 点选的连续选中 / 连续取消，跨分组）。
		*
		* shift + 点击（存在锚点且与当前 record 不同）：锚点始终保持不变，依据"当前 record 是否已选中"
		* 决定扩选还是缩选（详见 `RowCollector.getShiftSelectionChange`）：
		* - 目标未选中 → 扩选：把「锚点 → 目标」按 record 收集顺序（跨分组、跳过折叠分组与 placeholder）
		*   的整段置为选中；
		* - 目标已选中 → 缩选：保留「锚点 → 目标」，把目标之外、沿"背离锚点方向"紧邻且连续的选中段取消。
		*   例：锚点 record10，当前 10~20 选中，shift 点 record15 → 取消 16~20；再 shift 点 record5 →
		*   将 5~10 选中（11~15 保持），最终选中 5~15。
		* 端点缺失 / 不在可见有序序列中（分组折叠、record 已删）时退化为普通点击；缩选无可回收项时为
		* no-op（不改锚点、不翻转目标）。
		*
		* 普通点击：翻转当前 record 选中态，并把连续选中锚点更新为当前 record。
		*/ _proto.handleCheckboxClick = function handleCheckboxClick(recordId, shiftKey) {
			var { state, rows } = this.collector;
			var anchorId = state.getSelectAnchorRecordId();
			if (shiftKey && anchorId && anchorId !== recordId) {
				var change = rows.getShiftSelectionChange(anchorId, recordId, (id) => state.isRecordSelected(id));
				if (change) {
					if (change.recordIds.length) {
						state.setRecordsSelected(change.recordIds, change.select);
						this.afterRecordSelectChange();
					}
					return;
				}
			}
			state.toggleRecordSelected(recordId);
			state.setSelectAnchorRecordId(recordId);
			this.afterRecordSelectChange();
		};
		/**
		* 选中集合变化后的统一副作用：fire 事件 → 重收集可见内容 → 重绘。
		*
		* 选中态翻转影响：
		* 1) record 的 selectedBg / selectedCheckbox；
		* 2) 批量模式下，所属分组的 isAllSelected → head 右侧「全选/取消全选」文案翻转。
		* 因此 head 缓存也需要同步刷新。
		*/ _proto.afterRecordSelectChange = function afterRecordSelectChange() {
			this.emitter.wbService.onRecordSelectChange.fire(this.collector.state.getSelectedRecordIds());
			this.collector.content.collectVisibleWithHeads();
			this.parentApi.render();
		};
		/**
		* 是否被其它 feature 锁住（典型：拖动垂直滚动条期间 ListScroller 高优先级锁）。
		* 用于在交互入口短路，避免拖动滚动条时表格里再触发行/checkbox hover 反馈。
		*/ _proto.isPreventFromOtherFeature = function isPreventFromOtherFeature() {
			return this.featureLock.isPreventFromOtherFeature(IListHover);
		};
		return ListHover;
	}(ListFeatureBase);
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/features/pc/record-move/interface.js
var IListRecordMove;
var init_interface$2 = __esmMin((() => {
	init_module();
	IListRecordMove = createDecorator("IListRecordMove");
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/features/pc/record-move/util.js
/**
* 组装拖拽落点信息 → moveRecord 请求参数并派发。
*
* 关键设计：
* - **支持多条一起移动**：`movingRecordIds` 可为多条（批量勾选后一起拖），core 的 `moveRecord`
*   原生支持多 recordIds（内部按 source 顺序排序、连续插入到 `nextRecordId` 之前，相对顺序稳定）。
*   调用侧需保证入参已按展示顺序排列。所有被拖 record「统一落到同一个地方」——同一分组 / 同一新父，
*   与需求一致。
* - 跨分组：`groupPath` 使用**落点所在分组**的路径（不是起点分组）。core 层会根据 groupPath
*   自动改写记录的分组字段值，实现"拖到别的分组 → 分组字段值跟随变更"。调用侧需保证 prev / next
*   都限定在 groupPath 内，避免父子推导继承别分组的父子链。
* - **作为子记录落入时不改分组字段值**：若落点是「目标分组内某条记录的子记录」（最终新父为真实
*   record），则被拖 record 在父子扁平展示下跟随父记录归组，其自身分组字段值应保持不变 —— 拖拽
*   只调整父子关系。此时对 core 传空 `groupPath`（`effectiveGroupPath = []`），跳过分组字段自动
*   改写与空分组补写；仅当落到分组顶层（新父为 null）时才让分组字段值跟随目标分组。此规则对任意
*   分组字段通用（如按「状态」分组：拖成子记录 → 状态不变；拖到分组顶层 → 状态改为目标分组值）。
* - **空分组补写字段值**：当目标顶层 GroupKey 命中 `dataUtil.isEmptyRealGroupKey` 时，
*   core 的 `MoveRecordRequest.setRecordByGroupPath` 会因为 formattedTree 里没有对应节点而拿不到
*   `standardValueMap`，导致分组字段不会被写入 → 记录只挪 rank 不改字段值，视觉上"跳回原分组"。
*   此时由 view 层显式合成分组字段的 cell delta 塞进 `moveRecord.delta.records`，语义与 kanban
*   `MOVE_GROUP_RECORD` 一致：直接把 groupKey 翻译为该字段允许的最小合法 cellValue。
* - 父子关系同步：若视图启用了父子字段 (`getSubTreeFieldId()`)，且推导出的 newParentId 与当前不同，
*   则把 setRecord delta 塞进 `moveRecord.delta.records[recordId]`，一次请求内完成排序 + 父记录改写。
*   `records?` 是 core.moveRecord 的原生入参，双关处理已内置，无需额外一次 setRecord。
*   多条移动时逐条构造各自的 setRecord delta（父归属统一使用 `forcedNewParentId`，但当前父 id 逐条读取）。
* - **显式指定新父**：`forcedNewParentId` 非 undefined 时（包括 null 表示强制顶层），直接使用该值，
*   跳过 `deriveNewParentId` 的隐式推导。用于交互侧根据鼠标 X 判定的"缩进带"输出精确父归属，
*   避免推导规则与用户可见基准线的意图错位。仍然会走 `isDescendantOrSelf` 环检查。
*
* @param movingRecordIds 被拖动的 record id 列表（已按展示顺序排列；单条拖拽时长度为 1）
* @param prevRecordId   落点前一条 record id（**必须**与 groupPath 同分组；跨分组时传 undefined）
* @param nextRecordId   落点后一条 record id（**必须**与 groupPath 同分组；跨分组时传 null）
* @param groupPath      落点所在分组 path（无分组时为空数组）
* @param context
* @param collector
* @param forcedNewParentId 显式指定的新父 id：`undefined` = 走隐式推导；`null` = 强制顶层；
*                          `RecordId` = 指定该 record 为新父。
*/ function applyMovedRecordBehavior(movingRecordIds, prevRecordId, nextRecordId, groupPath, context, collector, forcedNewParentId) {
	var _a, _b;
	var view = collector.dataUtil.getCurrentView();
	var table = collector.dataUtil.getCurrentTable();
	if (!view || !table || movingRecordIds.length === 0) return;
	var subTreeFieldId = (_b = (_a = view.getSubTreeFieldId) === null || _a === void 0 ? void 0 : _a.call(view)) !== null && _b !== void 0 ? _b : null;
	var effectiveGroupPath = resolveFinalNewParentId(movingRecordIds[0], prevRecordId, nextRecordId, subTreeFieldId, collector, forcedNewParentId) !== null ? [] : groupPath;
	var delta = {
		recordIds: [...movingRecordIds],
		nextRecordId,
		groupPath: effectiveGroupPath
	};
	var records = {};
	for (var movingRecordId of movingRecordIds) {
		var setRecordDelta = buildRecordSetDelta(movingRecordId, prevRecordId, nextRecordId, effectiveGroupPath, subTreeFieldId, collector, { forcedNewParentId });
		if (setRecordDelta) records[movingRecordId] = setRecordDelta;
	}
	if (Object.keys(records).length > 0) delta.records = records;
	context.getBehaviorApi().moveRecord({
		tableId: table.id,
		viewId: view.id,
		delta
	});
}
/**
* 合成 `moveRecord.delta.records[movingRecordId]`：把「父子字段同步」和「空分组字段补写」两类字段合入同一
* ISetRecordRequestDelta。任何一项命中就返回；两项都不命中时返回 undefined，让外部不塞 `records`。
*
* 「空分组字段补写」是 grid-list 视图专属（虚拟空分组占位），故本函数留在本视图 util；父子字段同步
* 复用 shared 层 {@link buildSubTreeParentEntry}。
*/ function buildRecordSetDelta(movingRecordId, prevRecordId, nextRecordId, groupPath, subTreeFieldId, collector, options) {
	var setDelta = {};
	var hasEntry = false;
	var subTreeEntry = buildSubTreeParentEntry(movingRecordId, prevRecordId, nextRecordId, subTreeFieldId, collector, options.forcedNewParentId);
	if (subTreeEntry) {
		setDelta[subTreeEntry.fieldId] = { value: subTreeEntry.cellValue };
		hasEntry = true;
	}
	var targetTopGroupKey = groupPath[0];
	if (targetTopGroupKey !== void 0 && collector.dataUtil.isEmptyRealGroupKey(targetTopGroupKey)) {
		var override = collector.dataUtil.buildGroupFieldOverrideForTopGroupKey(targetTopGroupKey);
		if (override && !setDelta[override.fieldId]) {
			setDelta[override.fieldId] = { value: override.cellValue };
			hasEntry = true;
		}
	}
	return hasEntry ? setDelta : void 0;
}
var init_util = __esmMin((() => {
	init_sub_tree();
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/features/pc/record-move/main.js
function _defineProperties$3(target, props) {
	for (var i = 0; i < props.length; i++) {
		var descriptor = props[i];
		descriptor.enumerable = descriptor.enumerable || false;
		descriptor.configurable = true;
		if ("value" in descriptor) descriptor.writable = true;
		Object.defineProperty(target, descriptor.key, descriptor);
	}
}
function _create_class$3(Constructor, protoProps, staticProps) {
	if (protoProps) _defineProperties$3(Constructor.prototype, protoProps);
	if (staticProps) _defineProperties$3(Constructor, staticProps);
	return Constructor;
}
function _inherits$13(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function");
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		writable: true,
		configurable: true
	} });
	if (superClass) _set_prototype_of$13(subClass, superClass);
}
function _set_prototype_of$13(o, p) {
	_set_prototype_of$13 = Object.setPrototypeOf || function setPrototypeOf(o, p) {
		o.__proto__ = p;
		return o;
	};
	return _set_prototype_of$13(o, p);
}
/**
* 两个分组路径是否等价（顺序相同 + 逐项相等）。
* 空数组 vs 空数组也视为相等（无分组场景）。
*/ function isSameGroupPath(a, b) {
	if (a.length !== b.length) return false;
	for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
	return true;
}
/**
* 取单条 DrawConfig 的水平"宽度"（相对自身 `x`）：
* - Line 无 width，用 points 中最大 x 兜底（points 为 [x0,y0,x1,y1,...]）；
* - 其它 Rect 系 config 直接取 width；
* - 不可测量时返回 0。
*/ function getConfigWidth(config) {
	var _a;
	if (config.type === DrawType.Line) {
		var points = (_a = config.points) !== null && _a !== void 0 ? _a : [];
		var maxPx = 0;
		for (var i = 0; i < points.length; i += 2) if (points[i] > maxPx) maxPx = points[i];
		return maxPx;
	}
	var w = config.width;
	return typeof w === "number" ? w : 0;
}
/**
* 计算 `leftConfigs` 的水平包围盒（全局坐标）：`{ left, right }`。
*
* 忽略 `width <= 0` 的空 config（如占位不产生视觉宽度的段）；
* 数组为空 / 所有 config 都无法算宽时返回 `undefined`，由调用方走"回退简单基座"分支。
*/ function measureLeftConfigsBBox(configs) {
	var left = Number.POSITIVE_INFINITY;
	var right = Number.NEGATIVE_INFINITY;
	for (var config of configs) {
		var w = getConfigWidth(config);
		if (w <= 0) continue;
		var x = typeof config.x === "number" ? config.x : 0;
		if (x < left) left = x;
		if (x + w > right) right = x + w;
	}
	if (!Number.isFinite(left) || !Number.isFinite(right) || right <= left) return void 0;
	return {
		left,
		right
	};
}
var ListRecordMove;
var init_main$3 = __esmMin((() => {
	init_config$1();
	init_pen();
	init_style();
	init_interface$6();
	init_cursor();
	init_is_in_rect();
	init_register_esc_to_cancel();
	init_auto_scroll();
	init_list_feature();
	init_interface$2();
	init_util();
	init_placeholder_record();
	ListRecordMove = /* @__PURE__ */ function(ListFeatureBase) {
		"use strict";
		_inherits$13(ListRecordMove, ListFeatureBase);
		function ListRecordMove() {
			var _this = ListFeatureBase.apply(this, arguments) || this;
			_this.group = null;
			/**
			* 实际按下的那条 record id（拖拽起点）。仅用于：
			* - 拖影内容锚点（`clickRowInfo`）；
			* - 缩进档 `pickDropParentDepthByDragDx` 的 sourceLevel。
			* 落点邻居 / 环检查等「被移除的行集合」语义统一走 {@link movingRecordIds} / {@link movingRecordIdSet}。
			*/ _this.mouseDownRecordId = "";
			/**
			* 本次拖拽被移动的全部 record id（已按展示顺序排列）：
			* - 单条拖拽：仅 `[mouseDownRecordId]`；
			* - 多条拖拽：mousedown 命中某个已勾选行时，为全部勾选行（可不连续、跨分组）。
			* 落手时这些 record 会「统一落到同一个地方」（同分组 / 同新父）。
			*/ _this.movingRecordIds = [];
			/** {@link movingRecordIds} 的 Set 形态，供邻居查找 / 环检查 O(1) 判定「是否被拖行」。 */ _this.movingRecordIdSet = /* @__PURE__ */ new Set();
			/** 拖动起点 record 所在分组路径（落点限定在同分组内） */ _this.clickGroupPath = [];
			/**
			* 被拖子树的相对高度（自身=0，最深后代与自身的 level 差）。mousedown 计算一次即可
			* （子树在一次拖拽期间不变），用于落点层级超限校验：最终最深层级 = dropParentDepth + 该高度。
			* 多条拖拽时取**所有被拖 record 子树高度的最大值**（保守口径，保证任意被拖子树都不越限）。
			*/ _this.movingSubTreeHeight = 0;
			/**
			* 当前候选落点是否会使被拖子树最深层级超过 {@link MAX_SUB_TREE_LEVEL}。
			*
			* 与"无效落点"不同：超限时**照常绘制**基准线 / 父高亮（用户仍能看到将落到哪），只是松手时
			* 不应用数据、改为 fire `onSubDepthLimit` 通知宿主。每次 `updateDropTarget` 重新计算。
			*/ _this.isDropExceedLimit = false;
			_this.mouseDownX = 0;
			_this.mouseDownY = 0;
			_this.mouseMoveX = 0;
			_this.mouseMoveY = 0;
			/**
			* mousedown 时的 `range.scrollTop` 快照。拖影锚定它（而非实时 scrollTop）换算视口坐标：
			* 自动滚动期间鼠标可停在边缘不动，若拖影用实时 scrollTop 会随内容滚动一起漂移、脱离光标；
			* 用固定的按下时 scrollTop 可让拖影始终跟随光标（基准线 / 父高亮仍用实时 scrollTop，因它们锚定内容行）。
			*/ _this.mouseDownScrollTop = 0;
			/**
			* mousedown 时被拖起点行 `leftConfigs`（左侧字段绘制内容）的浅拷贝快照。
			*
			* 为何缓存而非每帧实时取：`content.getRecordRenderInfo` 只保留**当前渲染 range 内**的行，
			* 自动滚动超过一屏后被拖行离开 range → 实时查询返回 undefined → 拖影退化成空白基座。
			* mousedown 时被拖行必在 range 内，此刻快照即可（config 的 x/y 均为静态全局坐标，与滚动无关），
			* 之后无论滚多远拖影内容都保持完整。浅拷贝避免主层每帧 `add` 改写 offsetX/offsetY 污染快照。
			*/ _this.draggedLeftConfigs = [];
			/**
			* 落点：以行 index 表达，`dropBeforeRecord = true` 表示插在这一行的**上方**。
			* dropRowIndex = -1 时无有效落点，mouseup 直接清理。
			*/ _this.dropRowIndex = -1;
			_this.dropBeforeRecord = true;
			/**
			* 落点选定的"新父深度"（顶层 = 0）。由鼠标 X 与候选深度区间 `[lowerDepth, upperDepth]` 拟合得到。
			*
			* 与 anchor.level 解耦：同一个"记录间隙"下可能有多个候选深度（例如拖到 `a3` 和 `b` 之间时，
			* 深度 0 = 顶层、深度 1 = 作为 a 的子），基准线的左端 X 与最终父归属由此深度共同决定。
			*/ _this.dropParentDepth = 0;
			/**
			* 落点选定的"新父 record id"（null = 顶层）。由 `dropParentDepth` + 前后 record 反查得到。
			* `applyDrop` 时透传给 `applyMovedRecordBehavior` 的 `forcedNewParentId`，跳过隐式推导。
			*/ _this.dropParentId = null;
			/** 是否已越过启动阈值进入拖拽绘制 */ _this.isInDragging = false;
			_this.onStageMouseDown = (evt) => {
				var _a;
				if (_this.isPreventFromOtherFeature()) return;
				var { target } = evt;
				if (!target.isRecordRow || !target.recordId) return;
				if (isPlaceholderRecordId(target.recordId)) return;
				if (target.isRecordLeftGutter) return;
				var rowInfo = _this.collector.rows.getInfoByRecordId(target.recordId);
				if (!rowInfo) return;
				_this.mouseDownRecordId = target.recordId;
				_this.movingRecordIds = _this.resolveMovingRecordIds(target.recordId);
				_this.movingRecordIdSet = new Set(_this.movingRecordIds);
				_this.clickRowInfo = rowInfo;
				_this.clickGroupPath = _this.getRecordGroupPath(target.recordId);
				var clickRenderInfo = _this.collector.content.getRecordRenderInfo(target.recordId);
				_this.draggedLeftConfigs = ((_a = clickRenderInfo === null || clickRenderInfo === void 0 ? void 0 : clickRenderInfo.leftConfigs) !== null && _a !== void 0 ? _a : []).map((cfg) => Object.assign({}, cfg));
				_this.movingSubTreeHeight = _this.movingRecordIds.reduce((max, id) => Math.max(max, computeMovingSubTreeHeight(id, _this.collector)), 0);
				_this.mouseDownX = evt.x;
				_this.mouseDownY = evt.y;
				_this.mouseMoveX = evt.x;
				_this.mouseMoveY = evt.y;
				_this.mouseDownScrollTop = _this.collector.range.scrollTop;
				_this.dropRowIndex = -1;
				_this.setCursor(Cursor.GRAB);
				_this.attachListeners();
			};
			_this.onWindowMouseMove = (evt) => {
				var _a;
				_this.mouseMoveX = evt.x;
				_this.mouseMoveY = evt.y;
				if (!_this.mouseDownRecordId) return;
				if (!_this.isInDragging) {
					var dx = Math.abs(_this.mouseMoveX - _this.mouseDownX);
					var dy = Math.abs(_this.mouseMoveY - _this.mouseDownY);
					if (dx <= 5 && dy <= 5) return;
					_this.isInDragging = true;
					(_a = _this.parentApi.getFeature(IListAutoScroll)) === null || _a === void 0 || _a.readyY();
				}
				_this.setCursor(Cursor.GRABBING);
				_this.updateDropTarget(evt.target);
				_this.redraw();
			};
			_this.onDocumentMouseUp = (_evt) => {
				if (_this.isInDragging && _this.dropRowIndex !== -1 && _this.mouseDownRecordId) if (_this.isDropExceedLimit) _this.emitter.wbService.onSubDepthLimit.fire();
				else _this.applyDrop();
				_this.clearAll();
			};
			return _this;
		}
		var _proto = ListRecordMove.prototype;
		_proto.bootstrap = function bootstrap() {
			this.group = this._register(pen.group(this.collector.size.globalRect));
			this.layer.addGroup(this.group);
			this._register(this.UIEvent.stage.onMouseDown(this.onStageMouseDown));
			this._register(this.UIEvent.stage.onResize(() => {
				var _a;
				return (_a = this.group) === null || _a === void 0 ? void 0 : _a.setAttrs(this.collector.size.globalRect);
			}));
			this._register(this.collector.range.onScroll(() => this.abortDragging()));
		};
		_proto.dispose = function dispose(trace) {
			ListFeatureBase.prototype.dispose.call(this, trace);
			this.cancelListeners();
		};
		_proto.render = function render() {
			if (!this.isInDragging) return;
			if (!isHitRect(this.mouseMoveX, this.mouseMoveY, this.collector.size.globalRect)) return;
			this.redraw();
		};
		_proto.isDragging = function isDragging() {
			return this.isInDragging;
		};
		_proto.getFeatureLockConfig = function getFeatureLockConfig() {
			return { default: {
				id: IListRecordMove,
				isLock: () => this.isDragging()
			} };
		};
		/**
		* 判定本次拖拽被移动的 record 集合：
		* - 若命中的行处于「批量勾选」集合内且勾选了 **多条** → 拖动全部勾选行（按展示顺序排列，
		*   与 core.moveRecord「按 source 顺序连续插入」的落库口径一致，保证相对顺序稳定）；
		* - 否则退化为单条拖动命中的这一行（即使当前有勾选，但命中的是未勾选行，也只拖这一行）。
		*/ _proto.resolveMovingRecordIds = function resolveMovingRecordIds(clickedRecordId) {
			var selectedIds = this.collector.state.getSelectedRecordIds();
			if (selectedIds.length > 1 && selectedIds.includes(clickedRecordId)) return this.sortByDisplayOrder(selectedIds);
			return [clickedRecordId];
		};
		/**
		* 按视觉展示顺序对一组 recordId 排序（不在展示列表中的排到最前，容错兜底）。
		*
		* 使用 `getSubTreeOrderedRecordIds()`：启用父子记录时按 DFS「父在前子紧随」返回，与 rows 结构
		* 层展示顺序同源；未启用时等价于原 `getDisplayedRecordIds()`。若用后者，父子场景下子孙可能被
		* 平铺到不与父相邻的位置，本方法排序结果与 UI 视觉不一致，多条拖拽落库顺序会错乱。
		*/ _proto.sortByDisplayOrder = function sortByDisplayOrder(recordIds) {
			var displayed = this.collector.dataUtil.getSubTreeOrderedRecordIds();
			var indexOf = /* @__PURE__ */ new Map();
			displayed.forEach((id, i) => indexOf.set(id, i));
			return [...recordIds].sort((a, b) => {
				var _a, _b;
				return ((_a = indexOf.get(a)) !== null && _a !== void 0 ? _a : -1) - ((_b = indexOf.get(b)) !== null && _b !== void 0 ? _b : -1);
			});
		};
		/**
		* 根据鼠标当前命中的 target 计算 dropRowIndex + dropBeforeRecord。
		*
		* 判定策略：
		* - 命中 record 行：以该行"上下半区"决定插入到该行之前 / 之后；
		* - 命中 GroupHead / 空白：以鼠标 absY 兜底找最接近的 record 行作锚点；
		* - 被拖 record 自身及紧邻位置视为原位无效。
		*
		* 跨分组：允许落到不同 groupPath 下的 record 之间；分组字段值的联动由
		* `applyMovedRecordBehavior` 通过 `moveRecord.delta.groupPath` 交给 core 层完成
		* （core 会根据目标 groupPath 自动改写记录的分组字段值）。
		*
		* 父子归属（多候选）：
		* - 参考 grid `field-move` 里"列 vs 列编组"的临界处理思路：一个"记录间隙"往往对应多个父子归属
		*   候选（例如 `a3/b` 之间既可作 a 的子、也可作顶层），交互侧根据鼠标 X 落在哪个"缩进带"上
		*   选择目标深度。缩进带宽度 = `size.subIndentWidth`，起点 = 顶层主列起点。
		* - 候选区间由 {@link computeDropParentDepthRange} 依据落点前后 record 产出。**跨分组同样允许**
		*   继承父子链：`resolveDropNeighbors` 已把 prev/next 限定在目标分组 (anchorGroupPath) 内，
		*   因此继承的是**目标分组**的父子结构，语义正确（可把记录拖入别分组并作其中某记录的子）。
		* - 最终选定的 `dropParentDepth` / `dropParentId` 由 {@link resolveTargetParentIdByDepth} 反查，
		*   同时供 `drawDropLine`（缩进基准线）与 `applyDrop`（透传给 util 的 forcedNewParentId）复用。
		*/ _proto.updateDropTarget = function updateDropTarget(target) {
			this.dropRowIndex = -1;
			this.dropParentDepth = 0;
			this.dropParentId = null;
			this.isDropExceedLimit = false;
			if (!this.clickRowInfo) return;
			var anchor;
			var beforeRecord = true;
			if (target.isRecordRow && target.recordId) {
				var hover = this.collector.rows.getInfoByRecordId(target.recordId);
				if (hover) {
					var rowMidY = hover.y + hover.height / 2 - this.collector.range.scrollTop;
					beforeRecord = this.mouseMoveY <= rowMidY;
					anchor = hover;
				}
			} else {
				anchor = this.findClosestRecordByAbsY(this.mouseMoveY + this.collector.range.scrollTop);
				if (anchor) {
					var rowMidY1 = anchor.y + anchor.height / 2 - this.collector.range.scrollTop;
					beforeRecord = this.mouseMoveY <= rowMidY1;
				}
			}
			if (!anchor) return;
			var anchorGroupPath = this.getRecordGroupPath(anchor.recordId);
			var inSameGroup = isSameGroupPath(anchorGroupPath, this.clickGroupPath);
			this.dropRowIndex = anchor.index;
			this.dropBeforeRecord = beforeRecord;
			this.updateDropParent(anchor, beforeRecord, anchorGroupPath);
			if (this.isDropParentCyclic()) {
				this.resetDropTarget();
				return;
			}
			this.isDropExceedLimit = this.isDropExceedMaxLevel();
			if (inSameGroup && !this.isMultiMoving && this.isFinalSlotSameAsOrigin(anchor, beforeRecord, anchorGroupPath)) this.resetDropTarget();
		};
		/**
		* 把当前落点状态整体重置为「无效」：`dropRowIndex = -1` 使 redraw 不再绘制基准线 / 父高亮 /
		* 父归属传递到 apply 阶段。`dropParentDepth / dropParentId` 一并复位，避免残留态在下一次
		* `updateDropTarget` 早退分支里被读到造成绘制错乱。
		*/ _proto.resetDropTarget = function resetDropTarget() {
			this.dropRowIndex = -1;
			this.dropParentDepth = 0;
			this.dropParentId = null;
		};
		/**
		* 环检查：目标父不能是任一 movingRecord 自身或其后代。
		*
		* 触发场景：拖 c 到 c 自身下半区、且鼠标 X 右移触发 depth=1 时，`resolveDropNeighbors`
		* 会把 prev 定位为 self、`resolveTargetParentByPrev(depth=1, prev=self)` 直接返回 self，
		* 使 `dropParentId === movingRecordId`。若不拦下，会绘制出"父高亮虚线框画在自己身上、基准线
		* 也在自己身上"的错乱视觉（且实际 apply 侧 `isDescendantOrSelf` 兜底会把它抹为 null，
		* 用户松手后行不动，交互期望与结果不一致）。
		*
		* 多条拖拽：目标父只要落在**任一被拖 record**自身或其后代上，都会造成「被拖行成为自己/兄弟的父」
		* 的矛盾归属，一律判为无效落点，与 apply 侧逐条 `isDescendantOrSelf` 兜底口径统一。
		*/ _proto.isDropParentCyclic = function isDropParentCyclic() {
			if (this.dropParentId == null) return false;
			return this.movingRecordIds.some((id) => isDescendantOrSelf(this.dropParentId, id, this.collector));
		};
		/**
		* 层级超限检查：被拖 record 落到当前候选深度 `dropParentDepth`（即被拖 record 的新 level，顶层=0）后，
		* 它的整棵子树会一起下沉，最深层级 = `dropParentDepth + movingSubTreeHeight`（均为 0-based level）。
		* 换算成"层数"（顶层=第 1 层）即 `dropParentDepth + movingSubTreeHeight + 1`，超过 {@link MAX_SUB_TREE_LEVEL}
		* 时视为超限。超限时基准线 / 父高亮**照常绘制**，仅松手时不应用数据、改 fire `onSubDepthLimit`。
		*
		* 未启用父子字段时 `dropParentDepth` 恒 0、`movingSubTreeHeight` 恒 0，永不触发。
		*/ _proto.isDropExceedMaxLevel = function isDropExceedMaxLevel() {
			return this.dropParentDepth + this.movingSubTreeHeight + 1 > 10;
		};
		/**
		* 计算 `dropParentDepth` / `dropParentId`：
		* 1. 定位落点前后同分组 record（prev / next）；
		* 2. 由 {@link computeDropParentDepthRange} 产出候选深度区间；
		* 3. 用鼠标 X 拟合到 `[lowerDepth, upperDepth]` 内的整数深度；
		* 4. 反查得到父 id。
		*
		* 允许继承父子链的前提：视图启用了 subTreeFieldId。**跨分组同样允许**——`resolveDropNeighbors`
		* 已把 prev / next 限定在目标分组 (anchorGroupPath) 内，继承的是目标分组的父子链而非原分组，
		* 因此可把记录拖入别的分组并作其中某条记录的子记录。
		*/ _proto.updateDropParent = function updateDropParent(anchor, beforeRecord, anchorGroupPath) {
			var _a, _b;
			var view = this.collector.dataUtil.getCurrentView();
			if (!((_b = (_a = view === null || view === void 0 ? void 0 : view.getSubTreeFieldId) === null || _a === void 0 ? void 0 : _a.call(view)) !== null && _b !== void 0 ? _b : null)) return;
			var { prevRecordId, nextRecordId } = this.resolveDropNeighbors(anchor, beforeRecord, anchorGroupPath);
			var { lowerDepth, upperDepth } = computeDropParentDepthRange(prevRecordId, nextRecordId !== null && nextRecordId !== void 0 ? nextRecordId : void 0, true, this.collector);
			this.dropParentDepth = this.pickDropParentDepthByDragDx(lowerDepth, upperDepth);
			this.dropParentId = resolveTargetParentIdByDepth(this.dropParentDepth, prevRecordId, nextRecordId !== null && nextRecordId !== void 0 ? nextRecordId : void 0, this.collector);
		};
		/**
		* 用水平位移在候选深度区间内取档。
		*
		* ## grid-list 专属：默认档策略"顶层优先"（当 `lowerDepth === 0` 时）
		*
		* 上游 shared 版 `pickDropParentDepthByDragDx` 的默认档 = `upperDepth`（"作 prev 的子"最常见预期）。
		* 这套在**深层拖拽**（`lowerDepth >= 1`）里没问题——被拖行本来就在缩进里。但 grid-list 有个视觉
		* 约束：拖影 shadow 是**不透明白底**且左边缘紧贴鼠标（`shadowLeft ≈ mouseX + padding`），而顶层
		* 基线本身位于主列文本左端外侧（约 `groupValueStartX - subIndentWidth/2`），要"退到顶层"鼠标
		* 必须拖到 shadow 完全盖住基线的位置，视觉上极难触发。
		*
		* 因此当区间包含顶层（`lowerDepth === 0`）时，**翻转默认档为 `lowerDepth`（顶层）**：
		* - 鼠标停在最深档基线上/或行区间内偏右 → 认作顶层（默认）；
		* - 想"作 prev 的子记录"需要主动往右拖，越过深层基线右侧 `TOP_FIRST_SHIFT_RATIO * indent` 才升深一档。
		*
		* 这种策略与原生 grid（半透明 shadow，无遮挡问题，默认深层符合直觉）分开——`lowerDepth >= 1`
		* 的深层场景仍走 shared 版逻辑，与 grid 视图保持一致。
		*
		* 参考：图 3 用户反馈"要把 shadow 拖到完全盖住基准线才能触发顶层"就是老策略的死角。
		*/ _proto.pickDropParentDepthByDragDx = function pickDropParentDepthByDragDx1(lowerDepth, upperDepth) {
			if (upperDepth <= lowerDepth) return lowerDepth;
			var indent = this.collector.size.subIndentWidth;
			if (lowerDepth === 0) {
				var TOP_FIRST_SHIFT_RATIO = 2;
				var mouseX = this.mouseMoveX;
				var target = lowerDepth;
				for (var d = lowerDepth + 1; d <= upperDepth; d++) if (mouseX >= this.computeDropIndentLineXAt(d) + indent * TOP_FIRST_SHIFT_RATIO) target = d;
				else break;
				return target;
			}
			var baselineX = this.computeDropIndentLineXAt(upperDepth);
			return pickDropParentDepthByDragDx(lowerDepth, upperDepth, this.mouseMoveX - baselineX, indent);
		};
		/**
		* 定位落点前后**同分组**的 record id（与 applyDrop 一致的口径，提前到 updateDropTarget 供
		* 父归属计算与 applyDrop 共用）。
		*
		* anchor 侧同样跳过被拖行：当 anchor 自身也在被拖集合里（多条拖拽 hover 到某个被拖行、或单条拖
		* 到自己身上）时，直接用 anchor 作 prev/next 会把「正在被移除的行」当成落点邻居，落库时语义断裂。
		* 因此若 anchor 命中被拖行，则沿对应方向跨过所有被拖行找到真正的同组邻居。
		*/ _proto.resolveDropNeighbors = function resolveDropNeighbors(anchor, beforeRecord, anchorGroupPath) {
			var _a, _b;
			var displayedRecordIds = this.collector.dataUtil.getSubTreeOrderedRecordIds();
			var anchorIdx = displayedRecordIds.indexOf(anchor.recordId);
			if (anchorIdx < 0) return {
				prevRecordId: void 0,
				nextRecordId: null
			};
			var anchorIsMoving = this.movingRecordIdSet.has(anchor.recordId);
			if (beforeRecord) {
				var nextRecordId = anchorIsMoving ? this.getSameGroupNeighborId(displayedRecordIds, anchorIdx, anchorGroupPath, 1) : anchor.recordId;
				return {
					prevRecordId: (_a = this.getSameGroupNeighborId(displayedRecordIds, anchorIdx - 1, anchorGroupPath, -1)) !== null && _a !== void 0 ? _a : void 0,
					nextRecordId
				};
			}
			return {
				prevRecordId: anchorIsMoving ? (_b = this.getSameGroupNeighborId(displayedRecordIds, anchorIdx, anchorGroupPath, -1)) !== null && _b !== void 0 ? _b : void 0 : anchor.recordId,
				nextRecordId: this.getSameGroupNeighborId(displayedRecordIds, anchorIdx + 1, anchorGroupPath, 1)
			};
		};
		/**
		* 判断「本次拖拽产生的最终 slot」是否与被拖 record 的原始 slot 语义等价（= 原位）。
		*
		* 【为什么不能只看 displayedRecordIds 线性索引】父子层级维度会给同一个"记录间隙"提供多个候选深度。
		* 例：结构 `a { a1, a2, a3 }, b, c`，拖 a3 到 a3/b 间隙时，索引维度上 slot 就是 (a3, b) —— 但父深度
		* 有两档：depth=1（仍作 a 的子，与原位真等价）、depth=0（脱出 a 成为顶层，是有效"移出父"操作）。
		* 只按索引判就会把两档一起拦掉，导致用户无法把 a3 拖出父。
		*
		* 【最终 slot 三元组】(normalizedPrev, normalizedNext, dropParentId)：
		* - prev/next：本次落点的前后同分组邻居（`resolveDropNeighbors` 的产物）。当 anchor 是
		*   movingRecord 本身时，slot 里会含 self（`prev=self` 或 `next=self`），需要**用 self 反方向
		*   跨越 self 的同组邻居**代替 —— 这样归一化后的 slot 等价于「假设 movingRecord 已被从原位
		*   移除、再插入到 slot 时」slot 两侧真实的邻居。
		* - dropParentId：`updateDropParent` 已经算好的目标父 id。
		*
		* 【与原 slot 比较】movingRecord 的原始 slot：
		* - originPrev/originNext：`displayedRecordIds` 上 movingRecord 的**同分组**前后邻居；
		* - originParentId：`readParentIdOfRecord(movingRecordId, subTreeFieldId)`；未启用父子时视为 null。
		*
		* 【等价条件】三者同时命中：
		*   `normalizedPrev === originPrev` && `normalizedNext === originNext` && `dropParentId === originParentId`。
		*/ _proto.isFinalSlotSameAsOrigin = function isFinalSlotSameAsOrigin(anchor, beforeRecord, anchorGroupPath) {
			var _a, _b;
			var { prevRecordId, nextRecordId } = this.resolveDropNeighbors(anchor, beforeRecord, anchorGroupPath);
			var displayedRecordIds = this.collector.dataUtil.getSubTreeOrderedRecordIds();
			var selfIdx = displayedRecordIds.indexOf(this.mouseDownRecordId);
			var normalizedPrev = prevRecordId === this.mouseDownRecordId ? (_a = this.getSameGroupNeighborId(displayedRecordIds, selfIdx - 1, anchorGroupPath, -1)) !== null && _a !== void 0 ? _a : void 0 : prevRecordId;
			var normalizedNext = nextRecordId === this.mouseDownRecordId ? this.getSameGroupNeighborId(displayedRecordIds, selfIdx + 1, anchorGroupPath, 1) : nextRecordId;
			var originPrev = (_b = this.getSameGroupNeighborId(displayedRecordIds, selfIdx - 1, this.clickGroupPath, -1)) !== null && _b !== void 0 ? _b : void 0;
			var originNext = this.getSameGroupNeighborId(displayedRecordIds, selfIdx + 1, this.clickGroupPath, 1);
			var originParentId = this.readCurrentParentId(this.mouseDownRecordId);
			return normalizedPrev === originPrev && normalizedNext === originNext && this.dropParentId === originParentId;
		};
		/**
		* 读取 movingRecord 当前父 id（视图未启用父子字段时恒为 null）。
		*/ _proto.readCurrentParentId = function readCurrentParentId(recordId) {
			var _a, _b, _c, _d, _e;
			var subTreeFieldId = (_c = (_b = (_a = this.collector.dataUtil.getCurrentView()) === null || _a === void 0 ? void 0 : _a.getSubTreeFieldId) === null || _b === void 0 ? void 0 : _b.call(_a)) !== null && _c !== void 0 ? _c : null;
			if (!subTreeFieldId) return null;
			var table = this.collector.dataUtil.getCurrentTable();
			if (!table) return null;
			var cell = table.getCell(recordId, subTreeFieldId);
			var value = (_d = cell === null || cell === void 0 ? void 0 : cell.value) !== null && _d !== void 0 ? _d : null;
			if (!value || value.length === 0) return null;
			return (_e = value[0]) !== null && _e !== void 0 ? _e : null;
		};
		/**
		* 遍历 rows 找到与 absY 最接近（且高度非 0）的 record 行；未找到返回 undefined。
		*/ _proto.findClosestRecordByAbsY = function findClosestRecordByAbsY(absY) {
			var { rows, size } = this.collector;
			var closest;
			var minDist = Number.POSITIVE_INFINITY;
			for (var i = 0; i < rows.rowCount; i++) {
				var info = rows.getInfo(i);
				if (!info || info.height === 0) continue;
				if (info.type !== RowType.Record) continue;
				var rowRecord = info;
				var rowMidY = rowRecord.y + size.recordHeight / 2;
				var dist = Math.abs(absY - rowMidY);
				if (dist < minDist) {
					minDist = dist;
					closest = rowRecord;
				}
			}
			return closest;
		};
		/**
		* 从 rows 反查 record 所在 GroupHead 路径；无分组时返回 []。
		*
		* 沿 rowInfo.parent 向上找到最近的 GroupHead 即可（RecordRange 的 parent 也可能指向 GroupHead）。
		*/ _proto.getRecordGroupPath = function getRecordGroupPath(recordId) {
			var info = this.collector.rows.getInfoByRecordId(recordId);
			if (!info) return [];
			var cursor = info.parent;
			while (cursor >= 0) {
				var row = this.collector.rows.getInfo(cursor);
				if (!row) return [];
				if (row.type === RowType.GroupHead) return row.path;
				cursor = row.parent;
			}
			return [];
		};
		_proto.redraw = function redraw() {
			if (!this.group) return;
			this.group.clear();
			this.drawParentHighlight();
			this.drawDropLine();
			this.drawDragShadow();
		};
		/**
		* 高亮拖拽落点对应的父记录整行区域，帮助用户在依赖缩进（indent）之外更直观地看清"我这次拖下去
		* 会成为哪条记录的子"。
		*
		* 绘制条件：
		* - `isInDragging = true`（redraw 已保证）；
		* - `dropRowIndex !== -1`（有有效落点）；
		* - `dropParentId !== null`（父归属为顶层时无需绘制）；
		* - 目标父行 rowInfo 存在。
		*
		* 视觉：`rowStartX / rowWidth / rowInfo.height` 区域画一个 `selectionBorderColor` 的蓝色 1px 虚线
		* 边框矩形，无填充；圆角复用 `size.recordBgRadius` 与拖影基座一致。虚线（相对基准线的实线）用来
		* 弱化视觉侵入感，避免与"插入位置基准线"这条主导视觉抢焦点。
		*
		* 坐标：`y = rowInfo.y - range.scrollTop`（全局 → 视口）。父行在视口外时依然会绘制，被父 group
		* 的 clipArea 自然裁剪掉，不需要额外可见性判断。
		*/ _proto.drawParentHighlight = function drawParentHighlight() {
			if (this.dropRowIndex === -1 || !this.group) return;
			if (this.dropParentId == null) return;
			var parentInfo = this.collector.rows.getInfoByRecordId(this.dropParentId);
			if (!parentInfo) return;
			var { size, range } = this.collector;
			var y = parentInfo.y - range.scrollTop;
			var rectLeftX = this.getDropIndentLineX() - 16;
			var rectRightX = size.rowStartX + size.rowWidth;
			var rectWidth = Math.max(0, rectRightX - rectLeftX);
			var highlightGroup = pen.group(Object.assign(Object.assign({}, size.globalRect), { overflow: "visible" }));
			highlightGroup.add(pen.config.rect({
				x: rectLeftX,
				y,
				width: rectWidth,
				height: parentInfo.height,
				borderColor: style.color.selectionBorderColor,
				borderWidth: 1,
				borderDash: [2, 2],
				borderRadius: size.recordBgRadius
			}));
			this.group.addGroup(highlightGroup);
		};
		/**
		* 计算指定落点父深度下"缩进基准线"的左端 X（视口坐标）。
		*
		* 公式来源：主列文本起点 `leftStartX = baseStartX + 2 + level * indent`（与 content.ts 同源），
		* 再左移半个 indent 到"父子第 level 层竖线的中心"，加上 `subLineCenterOffsetX` 微调
		* （与 content.collectSubTreeLines 的 `vertLineCenterX` 计算完全一致）。
		*
		* 被三方复用：`drawDropLine`（基准线）、`drawParentHighlight`（父行高亮矩形左端）以及
		* `pickDropParentDepthByDragDx`（用 upperDepth 对应的 baseline 作为鼠标 X 的锚点）——三者
		* 共用同一公式，保证"视觉上的档位"和"数值上的档位判定"严格一致。
		*/ _proto.computeDropIndentLineXAt = function computeDropIndentLineXAt(depth) {
			var { size, dataUtil } = this.collector;
			return (dataUtil.hasGroup() ? size.groupedRecordStartX : size.groupValueStartX) + 2 + depth * size.subIndentWidth - size.subIndentWidth / 2 + size.subLineCenterOffsetX;
		};
		/** 当前落点父深度对应的基准线左端 X（视口坐标）；`drawDropLine`/`drawParentHighlight` 直接消费。 */ _proto.getDropIndentLineX = function getDropIndentLineX() {
			return this.computeDropIndentLineXAt(this.dropParentDepth);
		};
		/**
		* 绘制被拖 record 的拖影：白底 + 边框基座 + 复用 `leftConfigs` 中的字段内容，跟随鼠标 x/y 位移。
		*
		* 复用策略：从 mousedown 时缓存的 `draggedLeftConfigs`（行预收集 `leftConfigs` 的浅拷贝，
		* 与主渲染 `RecordWidget.draw` 同源）取内容，把每条 config 按当前 (dx, dy) 位移平移到拖影 group 中。
		* 这样拖影的字段文本 / icon / 标签等与真实行左侧内容完全一致，且不受自动滚动滚出可视区影响。
		*
		* 视觉设计：
		* - 只保留 leftConfigs，不带 subTree / right / avatar / checkbox；
		* - 白底不透明（`normalBackground` 不透明纯色），以突出被拖行的信息、避免与下方内容混叠；
		* - 宽度按 leftConfigs 的**实际内容包围盒**收敛：`shadowWidth = maxRight - shadowLeft + padding * 2`，
		*   不是撑满整行 —— 让拖影更像"抓着几个字段跑"，而不是一整条厚重的行；
		* - 跟随鼠标：dx = mouseMoveX - mouseDownX，dy = mouseMoveY - mouseDownY，同时应用到基座和字段。
		*
		* 注意：
		* - `group.add(config, ...)` 会**原地修改** config 的 `offsetX/offsetY/clipArea` 属性，
		*   直接把原 DrawConfig 引用传入会污染主层的渲染缓存；因此对每条 config 都做浅拷贝 `{...config}`；
		* - 为避免拖到画布边缘时被 clip，拖影 group 走 `overflow: 'visible'`；
		* - 兜底：`renderInfo` / `leftConfigs` 缺失或空时，用行原始宽高绘制简单白底基座保底。
		*/ _proto.drawDragShadow = function drawDragShadow() {
			var info = this.clickRowInfo;
			if (!info || !this.group) return;
			var { size } = this.collector;
			var dx = this.mouseMoveX - this.mouseDownX;
			var dy = this.mouseMoveY - this.mouseDownY;
			var shadowOffsetX = dx;
			var shadowOffsetY = -this.mouseDownScrollTop + dy;
			var shadowGroup = pen.group(Object.assign(Object.assign({}, size.globalRect), {
				overflow: "visible",
				batch: false
			}));
			var leftConfigs = this.draggedLeftConfigs;
			var bbox = measureLeftConfigsBBox(leftConfigs);
			var padding = 8;
			var shadowLeft = (bbox ? bbox.left : size.rowStartX) - padding;
			var shadowWidth = bbox ? bbox.right - bbox.left + padding * 2 : Math.min(size.rowWidth, 120);
			var baseY = info.y + shadowOffsetY;
			var baseX = shadowLeft + shadowOffsetX;
			if (this.isMultiMoving) this.drawShadowStackLayers(shadowGroup, baseX, baseY, shadowWidth, info.height);
			shadowGroup.add(pen.config.rect({
				x: baseX,
				y: baseY,
				width: shadowWidth,
				height: info.height,
				background: style.color.normalBackground,
				borderColor: style.color.lightBorderColor,
				borderWidth: 1,
				borderRadius: size.recordBgRadius
			}));
			for (var config of leftConfigs) shadowGroup.add(Object.assign({}, config), shadowOffsetX, shadowOffsetY);
			if (this.isMultiMoving) this.drawShadowCountBadge(shadowGroup, baseX, baseY, shadowWidth);
			this.group.addGroup(shadowGroup);
		};
		/**
		* 绘制多条拖影下方的「层叠矩形」阶梯：`n-1` 个（`n` = 被拖条数），视觉上封顶 {@link MAX_STACK_LAYERS}
		* 个，避免条数很多时堆出过长的尾巴。第 `j` 层（1-based）相对主基座：两侧各内缩 `j * LAYER_INSET_X`、
		* 整体下移 `j * LAYER_PEEK_Y`，因此只有底部 `LAYER_PEEK_Y` 高的一条随层级递窄的 sliver 露出主基座之下。
		*
		* 绘制顺序：j 从大到小（最深/最窄/最靠下的先画），保证靠上的层叠盖在更深层之上；主基座随后由
		* 调用方绘制，覆盖所有层叠的顶部。
		*/ _proto.drawShadowStackLayers = function drawShadowStackLayers(shadowGroup, baseX, baseY, shadowWidth, height) {
			var { size } = this.collector;
			var MAX_STACK_LAYERS = 5;
			var LAYER_INSET_X = 5;
			var LAYER_PEEK_Y = 4;
			for (var j = Math.min(this.movingRecordIds.length - 1, MAX_STACK_LAYERS); j >= 1; j--) {
				var layerWidth = shadowWidth - j * LAYER_INSET_X * 2;
				if (layerWidth <= 0) continue;
				shadowGroup.add(pen.config.rect({
					x: baseX + j * LAYER_INSET_X,
					y: baseY + j * LAYER_PEEK_Y,
					width: layerWidth,
					height,
					background: style.color.normalBackground,
					borderColor: style.color.lightBorderColor,
					borderWidth: 1,
					borderRadius: size.recordBgRadius
				}));
			}
		};
		/**
		* 绘制多条拖影右上角的「总条数」badge：一个浅灰圆角胶囊（圆形/胶囊由 badge 高的一半圆角保证），
		* 中心显示被拖总条数。锚定在主基座右上角（badge 中心落在角点上，向外微溢出），与设计稿一致。
		*/ _proto.drawShadowCountBadge = function drawShadowCountBadge(shadowGroup, baseX, baseY, shadowWidth) {
			var countText = String(this.movingRecordIds.length);
			var BADGE_HEIGHT = 18;
			var BADGE_FONT_SIZE = style.size.fontSizeNormal;
			var textWidth = pen.util.measureTextWidth(countText, BADGE_FONT_SIZE);
			var badgeWidth = Math.max(BADGE_HEIGHT, textWidth + 10);
			var badgeX = baseX + shadowWidth - badgeWidth / 2;
			var badgeY = baseY - BADGE_HEIGHT / 2;
			shadowGroup.add(pen.config.rect({
				x: badgeX,
				y: badgeY,
				width: badgeWidth,
				height: BADGE_HEIGHT,
				background: style.color.tagBackground,
				borderColor: style.color.lightBorderColor,
				borderWidth: 1,
				borderRadius: BADGE_HEIGHT / 2
			}));
			shadowGroup.add(pen.config.text({
				text: countText,
				x: badgeX,
				y: badgeY,
				width: badgeWidth,
				height: BADGE_HEIGHT,
				fontSize: BADGE_FONT_SIZE,
				fontStyle: "500",
				color: style.color.normalFontColor,
				align: "center",
				verticalAlign: "middle",
				wrap: "none",
				ellipsis: true
			}));
		};
		/**
		* 绘制落点基准线；dropRowIndex = -1 时不绘制。
		*
		* z-order 说明：feature 主 `this.group` 在 draw 时先绘 pool 里的 DrawConfig、再绘 `groups`
		* 数组里的子 group（见 `Group.draw`：`this.pool.draw(context)` → `this.groups.forEach(...)`）。
		* 基准线通过独立 group + addGroup 承载；`redraw` 中先 push 基准线 group、后 push 拖影 group，
		* 保证拖影绘制在基准线之上（拖影视觉上"盖住"下方指示线的相交区域，更贴近原生拖拽反馈）。
		*
		* 基准线水平范围：
		* - 左端 = 「目标父深度所对应的第一层子记录竖线中心 X」。与 `content.collectSubTreeLines`
		*   的 `vertLineCenterX` 严格同源：
		*     leftStartX(depth) = baseStartX + 2 + depth * subIndentWidth
		*     lineCenterX(depth) = leftStartX(depth) - subIndentWidth/2 + subLineCenterOffsetX
		*   其中 `baseStartX = hasGroup ? groupedRecordStartX : groupValueStartX`。语义：
		*   - `depth = 0` → 顶层竖线位置（等价于旧行为，用户拖到 b 之上时的基准线）；
		*   - `depth = k` → 第 k 层缩进列的竖线中心（例如 depth=1 就是"作为 a 的子"时的红线位置）。
		*   目标深度由 {@link updateDropParent} 依鼠标 X 与候选区间拟合得到，跨父子层级的临界处理与
		*   `views/grid/features/pc/field-move` 里"列 vs 列编组"的临界思路一致。
		* - 右端 = `size.rowStartX + size.rowWidth` 行内容右沿。
		*/ _proto.drawDropLine = function drawDropLine() {
			if (this.dropRowIndex === -1 || !this.group) return;
			var anchor = this.collector.rows.getInfo(this.dropRowIndex);
			if (!anchor || anchor.type !== RowType.Record) return;
			var { size, range } = this.collector;
			var y = anchor.y - range.scrollTop + (this.dropBeforeRecord ? 0 : anchor.height);
			var lineLeftX = this.getDropIndentLineX();
			var lineRightX = size.rowStartX + size.rowWidth;
			var lineWidth = Math.max(0, lineRightX - lineLeftX);
			var lineGroup = pen.group(Object.assign(Object.assign({}, size.globalRect), { overflow: "visible" }));
			lineGroup.add(pen.config.line({
				x: lineLeftX,
				y,
				points: [
					0,
					0,
					lineWidth,
					0
				],
				borderColor: style.color.selectionBorderColor,
				borderWidth: 2
			}));
			this.group.addGroup(lineGroup);
		};
		_proto.applyDrop = function applyDrop() {
			var anchor = this.collector.rows.getInfo(this.dropRowIndex);
			if (!anchor || anchor.type !== RowType.Record) return;
			var dropGroupPath = this.getRecordGroupPath(anchor.recordId);
			var { prevRecordId, nextRecordId } = this.resolveDropNeighbors(anchor, this.dropBeforeRecord, dropGroupPath);
			applyMovedRecordBehavior(this.movingRecordIds, prevRecordId, nextRecordId, dropGroupPath, this.context, this.collector, this.dropParentId);
		};
		/**
		* 取指定索引处的 record id，仅当它属于 `expectedGroupPath` 且不是被拖 record 本身时返回；
		* 否则返回 null（用于 nextRecordId）/ undefined 兼容位（由调用侧转换）。
		*
		* 跨分组场景下常见：anchor 位于目标分组开头 → anchorIdx-1 是**上一分组**最后一条 record，
		* 它属于别的分组、也不应作为 movingRecord 新的父子邻居参与推导。
		*
		* 跳过被拖行的语义：命中任一被拖 record 时按 `direction` 继续向同方向前进，**跳过所有被拖行**——
		* 因为一次移动的语义是"先把被拖 record 从原位移除、再插入到 slot"，slot 的邻居应当是
		* "被拖行都不存在时的相邻 record"。若不跳过，`isFinalSlotSameAsOrigin` / core.moveRecord 会拿到
		* 断裂的邻居（例如 a2/a3 间隙 (anchor=a2, before=false) 时 next 命中被拖的 a3 就返回 null，
		* 但语义上真正的 next 是跨过 a3 之后的 b）。多条拖拽时同理跨过整个被拖集合。
		*/ _proto.getSameGroupNeighborId = function getSameGroupNeighborId(displayedRecordIds, idx, expectedGroupPath, direction = 1) {
			var cursor = idx;
			while (cursor >= 0 && cursor < displayedRecordIds.length) {
				var candidate = displayedRecordIds[cursor];
				if (!candidate) return null;
				if (this.movingRecordIdSet.has(candidate)) {
					cursor += direction;
					continue;
				}
				if (!isSameGroupPath(this.getRecordGroupPath(candidate), expectedGroupPath)) return null;
				return candidate;
			}
			return null;
		};
		_proto.attachListeners = function attachListeners() {
			this.cancelListeners();
			this.mouseMoveDisposable = this.UIEvent.window.onMouseMove(this.onWindowMouseMove);
			this.mouseUpDisposable = this.UIEvent.document.onMouseUp(this.onDocumentMouseUp);
			this.escDisposable = registerEscToCancel(this.UIEvent, () => this.clearAll());
		};
		_proto.cancelListeners = function cancelListeners() {
			var _a, _b, _c;
			(_a = this.mouseMoveDisposable) === null || _a === void 0 || _a.dispose();
			(_b = this.mouseUpDisposable) === null || _b === void 0 || _b.dispose();
			(_c = this.escDisposable) === null || _c === void 0 || _c.dispose();
			this.mouseMoveDisposable = void 0;
			this.mouseUpDisposable = void 0;
			this.escDisposable = void 0;
		};
		_proto.abortDragging = function abortDragging() {
			if (this.isInDragging) return;
			if (!this.mouseDownRecordId) return;
			this.clearAll();
		};
		_proto.clearAll = function clearAll() {
			var _a;
			this.cancelListeners();
			(_a = this.group) === null || _a === void 0 || _a.clear();
			this.mouseDownRecordId = "";
			this.movingRecordIds = [];
			this.movingRecordIdSet = /* @__PURE__ */ new Set();
			this.clickRowInfo = void 0;
			this.clickGroupPath = [];
			this.movingSubTreeHeight = 0;
			this.mouseDownScrollTop = 0;
			this.draggedLeftConfigs = [];
			this.isDropExceedLimit = false;
			this.dropRowIndex = -1;
			this.dropBeforeRecord = true;
			this.dropParentDepth = 0;
			this.dropParentId = null;
			this.isInDragging = false;
			this.setCursor(Cursor.DEFAULT);
		};
		_proto.isPreventFromOtherFeature = function isPreventFromOtherFeature() {
			return Boolean(this.featureLock.isPreventFromOtherFeature(IListRecordMove));
		};
		_create_class$3(ListRecordMove, [{
			key: "isMultiMoving",
			get: function() {
				return this.movingRecordIds.length > 1;
			}
		}]);
		return ListRecordMove;
	}(ListFeatureBase);
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/features/pc/scroller/interface.js
var IListScroller;
var init_interface$1 = __esmMin((() => {
	init_module();
	IListScroller = createDecorator("IListScroller");
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/features/pc/scroller/main.js
function _inherits$12(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function");
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		writable: true,
		configurable: true
	} });
	if (superClass) _set_prototype_of$12(subClass, superClass);
}
function _set_prototype_of$12(o, p) {
	_set_prototype_of$12 = Object.setPrototypeOf || function setPrototypeOf(o, p) {
		o.__proto__ = p;
		return o;
	};
	return _set_prototype_of$12(o, p);
}
var ListScroller;
var init_main$2 = __esmMin((() => {
	init_esm();
	init_scroller();
	init_interface$6();
	init_list_feature();
	init_interface$1();
	ListScroller = /* @__PURE__ */ function(ListFeatureBase) {
		"use strict";
		_inherits$12(ListScroller, ListFeatureBase);
		function ListScroller() {
			var _this = ListFeatureBase.apply(this, arguments) || this;
			_this.render = () => {
				var _a;
				(_a = _this.vertical) === null || _a === void 0 || _a.updatePosition();
			};
			/**
			* 与 grid GridScroller 同款语义：滚动条 hover 或拖拽中，视为高优先级锁，
			* 阻断其他 feature（hover/area-interactive 等）的交互响应。
			* 通过 BaseFeature 构造时自动注册到 featureLock，业务 feature 在自身入口处
			* 调用 featureLock.isPreventFromOtherFeature(IXxx) 即可短路。
			*/ _this.isHovering = () => {
				var _a, _b;
				return ((_a = _this.vertical) === null || _a === void 0 ? void 0 : _a.isHovering()) || ((_b = _this.vertical) === null || _b === void 0 ? void 0 : _b.isDragging()) || false;
			};
			_this.onWheel = ({ scrollInfo }) => {
				var { deltaY } = scrollInfo;
				if (deltaY === 0) return;
				_this.collector.range.scrollByDelta(deltaY / _this.collector.size.scale);
			};
			/** range 滚动回调：同时驱动 sticky 计算与滚动条位置刷新 */ _this.onRangeScroll = () => {
				var _a;
				_this.updateSticky();
				(_a = _this.vertical) === null || _a === void 0 || _a.updatePosition();
			};
			/**
			* 找到当前应吸顶的 GroupHead 并计算 offsetY，转交给 renderer 绘制。
			*/ _this.updateSticky = () => {
				var _a, _b;
				var { rows, range, size } = _this.collector;
				var { scrollTop } = range;
				var headHeight = size.groupHeadHeight;
				var stickyIndex = -1;
				var nextHeadY = Infinity;
				var groupHeads = [];
				rows.forEachRowInfo((info) => {
					if (info.type === RowType.GroupHead && info.height > 0 && info.level === 0) groupHeads.push({
						index: info.index,
						y: info.y
					});
				});
				groupHeads.sort((a, b) => a.y - b.y);
				for (var i = 0; i < groupHeads.length; i++) {
					var head = groupHeads[i];
					if (head.y <= scrollTop) {
						stickyIndex = head.index;
						nextHeadY = (_b = (_a = groupHeads[i + 1]) === null || _a === void 0 ? void 0 : _a.y) !== null && _b !== void 0 ? _b : Infinity;
					} else break;
				}
				if (stickyIndex < 0) {
					_this.parentApi.setStickyHead(-1, 0);
					return;
				}
				var offsetY = 0;
				if (nextHeadY < Infinity) {
					var overlap = scrollTop + headHeight - nextHeadY;
					if (overlap > 0) offsetY = -overlap;
				}
				_this.parentApi.setStickyHead(stickyIndex, offsetY);
			};
			return _this;
		}
		var _proto = ListScroller.prototype;
		_proto.bootstrap = function bootstrap() {
			this._register(this.UIEvent.stage.onWheel(this.onWheel));
			this._register(this.collector.range.onScroll(this.onRangeScroll));
			this.vertical = this._register(new CommonScroller({
				vertical: true,
				autoHide: ua.isMobile,
				id: "list-v-scroller",
				root: this.root,
				getViewRect: () => this.getViewRect(),
				getScrollTop: () => this.collector.range.scrollTop * this.collector.size.scale,
				getScrollHeight: () => this.collector.rows.scrollHeight * this.collector.size.scale,
				scrollToY: (y) => this.collector.range.scrollToY(y / this.collector.size.scale)
			}));
			this.updateSticky();
			this.vertical.updatePosition();
		};
		_proto.getFeatureLockConfig = function getFeatureLockConfig() {
			return { high: {
				id: IListScroller,
				isLock: () => this.isHovering()
			} };
		};
		/** list 全屏滚动，view rect = root 全画布像素区域（含 scale） */ _proto.getViewRect = function getViewRect() {
			var { size } = this.collector;
			var { scale } = size;
			var { x, y, width, height } = size.globalRect;
			return {
				x: x * scale,
				y: y * scale,
				width: width * scale,
				height: height * scale
			};
		};
		return ListScroller;
	}(ListFeatureBase);
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/features/pc/tooltip/interface.js
var IListTooltip;
var init_interface = __esmMin((() => {
	init_module();
	IListTooltip = createDecorator("IListTooltip");
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/features/pc/tooltip/main.js
function _inherits$11(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function");
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		writable: true,
		configurable: true
	} });
	if (superClass) _set_prototype_of$11(subClass, superClass);
}
function _set_prototype_of$11(o, p) {
	_set_prototype_of$11 = Object.setPrototypeOf || function setPrototypeOf(o, p) {
		o.__proto__ = p;
		return o;
	};
	return _set_prototype_of$11(o, p);
}
var ListTooltip;
var init_main$1 = __esmMin((() => {
	init_is_in_rect();
	init_list_feature();
	init_hover_tooltip_controller();
	ListTooltip = /* @__PURE__ */ function(ListFeatureBase) {
		"use strict";
		_inherits$11(ListTooltip, ListFeatureBase);
		function ListTooltip() {
			var _this = ListFeatureBase.apply(this, arguments) || this;
			_this.controller = null;
			/**
			* 由 parentApi.render() 调用：底层数据 / 几何 / 滚动变化后保证 tooltip group 自身的 clip 与
			* 当前 stage 一致；并强制 hide 一次，避免旧锚点错位停留在屏幕上（与 ListHover.render 同款语义）。
			*/ _this.render = () => {
				var _a;
				(_a = _this.controller) === null || _a === void 0 || _a.syncStageRect();
			};
			return _this;
		}
		var _proto = ListTooltip.prototype;
		_proto.bootstrap = function bootstrap() {
			this.controller = new HoverTooltipController({
				layer: this.layer,
				getStageRect: () => this.collector.size.globalRect,
				uiEvent: this.UIEvent,
				onScroll: this.collector.range.onScroll,
				resolveHit: (stageX, stageY, target) => this.resolveHit(stageX, stageY, target)
			});
			this._register(makeHoverTooltipDisposable(this.controller));
		};
		/**
		* 命中分发：必须在 record 行才可能触发任何 tooltip。
		*/ _proto.resolveHit = function resolveHit(stageX, stageY, target) {
			var _a, _b, _c;
			if (!(target === null || target === void 0 ? void 0 : target.isRecordRow) || !target.recordId) return null;
			var info = this.collector.content.getRecordRenderInfo(target.recordId);
			if (!info) return null;
			var scrollTop = this.collector.range.scrollTop;
			var absY = stageY + scrollTop;
			return (_c = (_b = (_a = this.resolveBareIconHit(target.recordId, stageX, absY, scrollTop, info)) !== null && _a !== void 0 ? _a : this.resolveTagPillHit(target.recordId, stageX, absY, scrollTop, info.bodyTagPillRects)) !== null && _b !== void 0 ? _b : this.resolveAvatarHit(target.recordId, stageX, absY, scrollTop, info.ownerAvatarSlots)) !== null && _c !== void 0 ? _c : this.resolveDateHit(target.recordId, stageX, absY, scrollTop, info);
		};
		/**
		* 状态 icon 粒度命中：
		* icon rect 为全局坐标（未扣 scrollTop），命中后扣 scrollTop 转 stage 视口坐标。
		*
		* 优先级列的 tooltip 已合并进 body tag row 的 pill 命中链路（`resolveTagPillHit`），
		* 由 `collectBodyTag({ expandIconOnly: true })` 产出的 icon+文案 pill 自然承接。
		*/ _proto.resolveBareIconHit = function resolveBareIconHit(recordId, stageX, absY, scrollTop, info) {
			if (info.statusIconRect && info.statusIconTooltipLabel) {
				if (isHitRect(stageX, absY, info.statusIconRect)) return {
					id: `record:${recordId}/statusIcon`,
					anchorRect: {
						x: info.statusIconRect.x,
						y: info.statusIconRect.y - scrollTop,
						width: info.statusIconRect.width,
						height: info.statusIconRect.height
					},
					label: info.statusIconTooltipLabel
				};
			}
			return null;
		};
		/**
		* 标签组 pill 粒度命中（状态 / 优先级 iconOnly pill）：
		* pill rect 为全局坐标（未扣 scrollTop），命中后扣 scrollTop 转 stage 视口坐标。
		*/ _proto.resolveTagPillHit = function resolveTagPillHit(recordId, stageX, absY, scrollTop, pillRects) {
			if (!(pillRects === null || pillRects === void 0 ? void 0 : pillRects.length)) return null;
			for (var i = 0; i < pillRects.length; i++) {
				var pill = pillRects[i];
				if (!pill.tooltipLabel) continue;
				if (!isHitRect(stageX, absY, pill.rect)) continue;
				var anchorRect = {
					x: pill.rect.x,
					y: pill.rect.y - scrollTop,
					width: pill.rect.width,
					height: pill.rect.height
				};
				return {
					id: `record:${recordId}/pill:${i}`,
					anchorRect,
					label: pill.tooltipLabel
				};
			}
			return null;
		};
		/**
		* 单头像粒度命中：
		* 1) 从该 record 的 `ownerAvatarSlots` 倒序遍历（高 z 优先，还原「左压右」语义），
		*    把鼠标的「全局坐标 absY = stageY + scrollTop」与 slot.rect 做 isHitRect 命中；
		* 2) 命中 slot 后把其 rect 转 stage 视口坐标系（y - scrollTop）作为 tooltip anchorRect；
		* 3) `id` 使用 `recordId + slotIndex` 拼接，保证：
		*    - 跨 record 不同槽 id 必不同；
		*    - 同一行内移动鼠标在不同槽间切换时 id 变 → controller 触发淡出 + 淡入；
		*    - 在同一个槽内移动 mouseMove → id 不变 → 无重画（避免闪烁）。
		*/ _proto.resolveAvatarHit = function resolveAvatarHit(recordId, stageX, absY, scrollTop, slots) {
			if (!(slots === null || slots === void 0 ? void 0 : slots.length)) return null;
			for (var i = slots.length - 1; i >= 0; i--) {
				var slot = slots[i];
				if (!isHitRect(stageX, absY, slot.rect)) continue;
				var anchorRect = {
					x: slot.rect.x,
					y: slot.rect.y - scrollTop,
					width: slot.rect.width,
					height: slot.rect.height
				};
				return {
					id: `record:${recordId}/avatar:${i}`,
					anchorRect,
					label: slot.tooltipLabel
				};
			}
			return null;
		};
		/**
		* date 段（行右侧相对时间）粒度命中：
		* 相对时间文本本身只显示"5 分钟前 / 刚刚"这类简写，用户 hover 时需要展开为「完整时间」
		* （如 `2026-06-25 19:53`）核对。命中区用 `info.dateRect`（对齐槽宽），保证短文本时命中区
		* 不至于太窄；label 直接用 `info.dateTooltipLabel`（field.format 已格式化好的绝对时间，
		* 与列原生 DateTime 渲染同源）。
		*
		* `dateTooltipLabel` 空时（完整文本取不到）不弹 tooltip：与 statusIcon/priorityIcon 的处理对称。
		*/ _proto.resolveDateHit = function resolveDateHit(recordId, stageX, absY, scrollTop, info) {
			if (!info.dateRect || !info.dateTooltipLabel) return null;
			if (!isHitRect(stageX, absY, info.dateRect)) return null;
			return {
				id: `record:${recordId}/date`,
				anchorRect: {
					x: info.dateRect.x,
					y: info.dateRect.y - scrollTop,
					width: info.dateRect.width,
					height: info.dateRect.height
				},
				label: info.dateTooltipLabel
			};
		};
		return ListTooltip;
	}(ListFeatureBase);
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/features/pc/entries.js
/**
* ListView PC 端 features：
* - storage-sync：分组折叠态本地记忆的兜底落盘时机（beforeunload / visibilitychange /
*   点击画布外），与 `StateCenter.setGroupFoldState` 的"每次点击及时落盘"互补；
* - auto-scroll：拖拽到可视区上下边缘时的自动滚屏（复用 grid 同款 AutoScroll 插件），仅 Y 向，
*   由 record-move 在进入拖拽时开启；无绘制、无交互监听（插件自管 window 事件），注册顺序不敏感；
* - scroller：垂直滚动 + GroupHead sticky；
* - hover：分组头折叠按钮 / 加号 / record 行 / checkbox 的 hover 反馈 + 点击事件；
* - record-move：record 行拖拽移动 + 落点父子记录（sys_parent_id）同步；
* - tooltip：通用 hover→tooltip 浮层（owner 头像单槽显示用户名 / 来源标签显示完整 displayName
*   等共用同一深色胶囊浮层 + 渐入渐出）。注册在 hover 之后：feature layer 后注册的 group
*   视觉位于上层，让 tooltip 永远盖在 hover 之上。
*
* 移动端 features 后续根据需求补充，本次不做。
*/ function getPcFeatures() {
	return [
		{
			id: IListStorageSync,
			ctor: ListStorageSync,
			config: { auth: FeatureAuth.None }
		},
		{
			id: IListAutoScroll,
			ctor: ListAutoScroll,
			config: { auth: FeatureAuth.None }
		},
		{
			id: IListScroller,
			ctor: ListScroller,
			config: { auth: FeatureAuth.None }
		},
		{
			id: IListHover,
			ctor: ListHover,
			config: { auth: FeatureAuth.None }
		},
		{
			id: IListRecordMove,
			ctor: ListRecordMove,
			config: { auth: FeatureAuth.None }
		},
		{
			id: IListTooltip,
			ctor: ListTooltip,
			config: { auth: FeatureAuth.None }
		}
	];
}
var init_entries = __esmMin((() => {
	init_auto_scroll();
	init_storage_sync();
	init_interface$3();
	init_main$4();
	init_interface$2();
	init_main$3();
	init_interface$1();
	init_main$2();
	init_interface();
	init_main$1();
	init_feature_single();
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/event-handler/index.js
function _inherits$10(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function");
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		writable: true,
		configurable: true
	} });
	if (superClass) _set_prototype_of$10(subClass, superClass);
}
function _set_prototype_of$10(o, p) {
	_set_prototype_of$10 = Object.setPrototypeOf || function setPrototypeOf(o, p) {
		o.__proto__ = p;
		return o;
	};
	return _set_prototype_of$10(o, p);
}
var import_main$3, ListEventHandler;
var init_event_handler = __esmMin((() => {
	import_main$3 = require_main();
	init_feature_event();
	init_interface$6();
	init_is_in_rect();
	ListEventHandler = /* @__PURE__ */ function(Disposable) {
		"use strict";
		_inherits$10(ListEventHandler, Disposable);
		function ListEventHandler(stage, root, rendererModel, getStickyHead = () => ({
			index: -1,
			offsetY: 0
		})) {
			var _this = Disposable.call(this) || this;
			_this.stage = stage;
			_this.root = root;
			_this.rendererModel = rendererModel;
			_this.getStickyHead = getStickyHead;
			_this.getTarget = (offset) => {
				var { x, y } = offset;
				var { size, range, rows } = _this.rendererModel.collector;
				var isOutStage = !isHitRect(x, y, size.globalRect);
				var target = {
					isOutStage,
					isBlank: true
				};
				if (isOutStage) return target;
				var sticky = _this.getStickyHead();
				if (sticky.index >= 0 && y >= sticky.offsetY && y < sticky.offsetY + size.groupHeadHeight) {
					var stickyRow = rows.getInfo(sticky.index);
					if ((stickyRow === null || stickyRow === void 0 ? void 0 : stickyRow.type) === RowType.GroupHead) {
						_this.hitStickyGroupHead(target, stickyRow, sticky.offsetY, x, y);
						target.isBlank = false;
						return target;
					}
				}
				var absY = y + range.scrollTop;
				var rowInfo = _this.findRowByAbsY(absY);
				if (!rowInfo) return target;
				target.rowInfo = rowInfo;
				target.isBlank = false;
				if (rowInfo.type === RowType.GroupHead) {
					_this.hitGroupHead(target, rowInfo, x, y);
					return target;
				}
				if (rowInfo.type === RowType.Record) {
					_this.hitRecord(target, rowInfo, x, y);
					return target;
				}
				return target;
			};
			_this.UIEvent = _this._register(new FeatureUIEvent({
				root,
				stage,
				getScale: () => _this.rendererModel.collector.size.scale,
				targetGetter: (offset) => _this.getTarget(offset)
			}));
			return _this;
		}
		var _proto = ListEventHandler.prototype;
		_proto.hitGroupHead = function hitGroupHead(target, rowInfo, x, y) {
			var { content, range } = this.rendererModel.collector;
			target.isGroupHead = true;
			var renderInfo = content.getGroupRenderInfo(rowInfo.path);
			if (!renderInfo) return;
			target.groupIndex = renderInfo.groupIndex;
			target.groupPath = rowInfo.path;
			target.recordRowRenderRect = {
				x: renderInfo.rect.x,
				y: renderInfo.rect.y - range.scrollTop,
				width: renderInfo.rect.width,
				height: renderInfo.rect.height
			};
			var foldHit = {
				x: renderInfo.foldIconRect.x,
				y: renderInfo.foldIconRect.y - range.scrollTop,
				width: renderInfo.foldIconRect.width,
				height: renderInfo.foldIconRect.height
			};
			if (isHitRect(x, y, foldHit)) {
				target.isFoldBtn = true;
				target.foldBtnRenderRect = foldHit;
				return;
			}
			if (renderInfo.addIconRect) {
				var addHit = {
					x: renderInfo.addIconRect.x,
					y: renderInfo.addIconRect.y - range.scrollTop,
					width: renderInfo.addIconRect.width,
					height: renderInfo.addIconRect.height
				};
				if (isHitRect(x, y, addHit)) {
					target.isGroupAddBtn = true;
					target.groupAddRenderRect = addHit;
				}
			}
			if (renderInfo.selectAllRect) {
				var selectAllHit = {
					x: renderInfo.selectAllRect.x,
					y: renderInfo.selectAllRect.y - range.scrollTop,
					width: renderInfo.selectAllRect.width,
					height: renderInfo.selectAllRect.height
				};
				if (isHitRect(x, y, selectAllHit)) {
					target.isSelectAllBtn = true;
					target.selectAllRenderRect = selectAllHit;
				}
			}
		};
		/**
		* 命中 sticky GroupHead：与普通 hitGroupHead 同语义，但渲染 rect 用 stickyOffsetY 而非 (y - scrollTop)，
		* 因为 sticky head 在 head 层是按「stickyOffsetY」摆放的，与 scrollTop 无关。
		* 复用 ContentCollector 收集的 foldIconRect/addIconRect 内的「行内相对偏移」做命中测试。
		*/ _proto.hitStickyGroupHead = function hitStickyGroupHead(target, rowInfo, stickyOffsetY, x, y) {
			var { content } = this.rendererModel.collector;
			target.isGroupHead = true;
			target.rowInfo = rowInfo;
			var renderInfo = content.getGroupRenderInfo(rowInfo.path);
			if (!renderInfo) return;
			target.groupIndex = renderInfo.groupIndex;
			target.groupPath = rowInfo.path;
			var stickyDeltaY = stickyOffsetY - renderInfo.rect.y;
			target.recordRowRenderRect = {
				x: renderInfo.rect.x,
				y: stickyOffsetY,
				width: renderInfo.rect.width,
				height: renderInfo.rect.height
			};
			var foldHit = {
				x: renderInfo.foldIconRect.x,
				y: renderInfo.foldIconRect.y + stickyDeltaY,
				width: renderInfo.foldIconRect.width,
				height: renderInfo.foldIconRect.height
			};
			if (isHitRect(x, y, foldHit)) {
				target.isFoldBtn = true;
				target.foldBtnRenderRect = foldHit;
				return;
			}
			if (renderInfo.addIconRect) {
				var addHit = {
					x: renderInfo.addIconRect.x,
					y: renderInfo.addIconRect.y + stickyDeltaY,
					width: renderInfo.addIconRect.width,
					height: renderInfo.addIconRect.height
				};
				if (isHitRect(x, y, addHit)) {
					target.isGroupAddBtn = true;
					target.groupAddRenderRect = addHit;
				}
			}
			if (renderInfo.selectAllRect) {
				var selectAllHit = {
					x: renderInfo.selectAllRect.x,
					y: renderInfo.selectAllRect.y + stickyDeltaY,
					width: renderInfo.selectAllRect.width,
					height: renderInfo.selectAllRect.height
				};
				if (isHitRect(x, y, selectAllHit)) {
					target.isSelectAllBtn = true;
					target.selectAllRenderRect = selectAllHit;
				}
			}
		};
		_proto.hitRecord = function hitRecord(target, rowInfo, x, y) {
			var { size, range, dataUtil } = this.rendererModel.collector;
			target.isRecordRow = true;
			target.recordId = rowInfo.recordId;
			target.recordRowRenderRect = {
				x: rowInfo.x,
				y: rowInfo.y - range.scrollTop,
				width: size.rowWidth,
				height: rowInfo.height
			};
			if (x < (dataUtil.hasGroup() ? size.groupLineCenterX : size.groupValueStartX)) target.isRecordLeftGutter = true;
			var cbHit = {
				x: rowInfo.x + size.checkboxPaddingLeft,
				y: rowInfo.y - range.scrollTop + (rowInfo.height - size.checkboxSize) / 2,
				width: size.checkboxSize,
				height: size.checkboxSize
			};
			if (isHitRect(x, y, cbHit)) {
				target.isCheckbox = true;
				target.checkboxRenderRect = cbHit;
			}
		};
		/** 通过绝对 y 找到命中行；O(行数)，对 list 视图常规规模够用 */ _proto.findRowByAbsY = function findRowByAbsY(absY) {
			var { rows } = this.rendererModel.collector;
			var hit;
			rows.forEachRowInfo((info) => {
				if (info.height === 0) return;
				if (info.type === RowType.RecordRange) {
					var range = info;
					if (absY >= range.y && absY < range.y + range.height) {
						var offset = Math.floor((absY - range.y) / this.rendererModel.collector.size.recordHeight);
						var clamped = Math.max(0, Math.min(range.recordIds.length - 1, offset));
						hit = rows.getInfo(range.index + clamped);
					}
					return;
				}
				if (absY >= info.y && absY < info.y + info.height) hit = info;
			});
			return hit;
		};
		return ListEventHandler;
	}(import_main$3.Disposable);
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/renderer/main/widgets/group-head.js
var GroupHeadWidget;
var init_group_head = __esmMin((() => {
	GroupHeadWidget = /* @__PURE__ */ function() {
		"use strict";
		function GroupHeadWidget() {}
		var _proto = GroupHeadWidget.prototype;
		/** scrollOffsetY：传入 -scrollTop，所有 DrawConfig 内置 y 已是绝对坐标，统一加偏移即可。 */ _proto.draw = function draw(container, info, scrollOffsetY) {
			container.add(info.background, 0, scrollOffsetY);
			container.add(info.foldIcon, 0, scrollOffsetY);
			for (var cfg of info.decorationConfigs) container.add(cfg, 0, scrollOffsetY);
			if (info.groupValueConfigs && info.groupValueConfigs.length > 0) for (var cfg1 of info.groupValueConfigs) container.add(cfg1, 0, scrollOffsetY);
			else container.add(info.groupValueText, 0, scrollOffsetY);
			if (info.countText) container.add(info.countText, 0, scrollOffsetY);
			if (info.addIcon) container.add(info.addIcon, 0, scrollOffsetY);
			if (info.selectAllText) container.add(info.selectAllText, 0, scrollOffsetY);
		};
		return GroupHeadWidget;
	}();
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/renderer/main/widgets/record.js
var RecordWidget;
var init_record = __esmMin((() => {
	init_pen();
	RecordWidget = /* @__PURE__ */ function() {
		"use strict";
		function RecordWidget() {}
		var _proto = RecordWidget.prototype;
		_proto.draw = function draw(container, info, scrollOffsetY) {
			var _a;
			if (info.selectedBg) container.add(info.selectedBg, 0, scrollOffsetY);
			if (info.activeBg) container.add(info.activeBg, 0, scrollOffsetY);
			for (var config of info.subTreeConfigs) container.add(config, 0, scrollOffsetY);
			for (var config1 of info.leftConfigs) container.add(config1, 0, scrollOffsetY);
			for (var config2 of info.rightConfigs) container.add(config2, 0, scrollOffsetY);
			if ((_a = info.ownerAvatarConfigs) === null || _a === void 0 ? void 0 : _a.length) {
				var containerAttrs = container.getAttrs();
				var avatarGroup = pen.group({
					x: containerAttrs.x,
					y: containerAttrs.y,
					width: containerAttrs.width,
					height: containerAttrs.height,
					batch: false,
					overflow: "visible"
				});
				for (var config3 of info.ownerAvatarConfigs) avatarGroup.add(Object.assign({}, config3), 0, scrollOffsetY);
				container.addGroup(avatarGroup);
			}
			if (info.selectedCheckbox) container.add(info.selectedCheckbox, 0, scrollOffsetY);
		};
		return RecordWidget;
	}();
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/renderer/main/index.js
var MainRenderer;
var init_main = __esmMin((() => {
	init_es();
	init_pen();
	init_style();
	init_interface$6();
	init_group_head();
	init_record();
	MainRenderer = /* @__PURE__ */ function() {
		"use strict";
		function MainRenderer(rendererModel) {
			this.rendererModel = rendererModel;
			this.groupHeadWidget = new GroupHeadWidget();
			this.recordWidget = new RecordWidget();
		}
		var _proto = MainRenderer.prototype;
		/** 渲染 body 层：record 行 + 非吸顶的 GroupHead 行；整表无 record 时改为绘制空态文案 */ _proto.renderBody = function renderBody(bodyContainer, stickyHeadIndex) {
			var { rows, range, content, size, dataUtil } = this.rendererModel.collector;
			if (rows.recordCount === 0 && !dataUtil.hasWbVirtualGroups()) {
				this.renderEmptyTip(bodyContainer, size.rootWidth, size.emptyTipPaddingTop);
				return;
			}
			var { start, end } = range.getRowRange();
			if (end < start) return;
			var scrollOffsetY = -range.scrollTop;
			rows.forEachRowInfo((info) => {
				if (info.height === 0) return;
				if (info.type === RowType.GroupHead) {
					if (info.index === stickyHeadIndex) return;
					if (info.index < start || info.index > end) return;
					var renderInfo = content.getGroupRenderInfo(info.path);
					if (renderInfo) this.groupHeadWidget.draw(bodyContainer, renderInfo, scrollOffsetY);
					return;
				}
				if (info.type === RowType.RecordRange) {
					var rangeStart = info.index;
					if (info.index + info.recordIds.length - 1 < start || rangeStart > end) return;
					var firstOffset = Math.max(0, start - rangeStart);
					var lastOffset = Math.min(info.recordIds.length - 1, end - rangeStart);
					for (var offset = firstOffset; offset <= lastOffset; offset++) {
						var recordId = info.recordIds[offset];
						var renderInfo1 = content.getRecordRenderInfo(recordId);
						if (renderInfo1) this.recordWidget.draw(bodyContainer, renderInfo1, scrollOffsetY);
					}
					return;
				}
			});
		};
		/** 在 head 层绘制 sticky GroupHead（由 scroller feature 决定的 stickyOffsetY） */ _proto.renderStickyHead = function renderStickyHead(headContainer, groupHeadIndex, stickyOffsetY) {
			var { rows, content } = this.rendererModel.collector;
			var rowInfo = rows.getInfo(groupHeadIndex);
			if (!rowInfo || rowInfo.type !== RowType.GroupHead) return;
			var renderInfo = content.getGroupRenderInfo(rowInfo.path);
			if (!renderInfo) return;
			this.groupHeadWidget.draw(headContainer, renderInfo, stickyOffsetY - rowInfo.y);
		};
		/**
		* 整表零记录时的空态引导文案。
		*/ _proto.renderEmptyTip = function renderEmptyTip(bodyContainer, rootWidth, paddingTop) {
			var { size } = this.rendererModel.collector;
			bodyContainer.add(pen.config.text({
				text: i18n.t("伟大的计划从这里开始，快来新建待办吧"),
				x: 0,
				y: paddingTop,
				width: rootWidth,
				height: size.emptyTipHeight,
				fontSize: size.emptyTipFontSize,
				color: style.color.lightFontColor,
				align: "center",
				wrap: "none",
				verticalAlign: "top"
			}));
		};
		return MainRenderer;
	}();
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/renderer/index.js
function _defineProperties$2(target, props) {
	for (var i = 0; i < props.length; i++) {
		var descriptor = props[i];
		descriptor.enumerable = descriptor.enumerable || false;
		descriptor.configurable = true;
		if ("value" in descriptor) descriptor.writable = true;
		Object.defineProperty(target, descriptor.key, descriptor);
	}
}
function _create_class$2(Constructor, protoProps, staticProps) {
	if (protoProps) _defineProperties$2(Constructor.prototype, protoProps);
	if (staticProps) _defineProperties$2(Constructor, staticProps);
	return Constructor;
}
function _inherits$9(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function");
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		writable: true,
		configurable: true
	} });
	if (superClass) _set_prototype_of$9(subClass, superClass);
}
function _set_prototype_of$9(o, p) {
	_set_prototype_of$9 = Object.setPrototypeOf || function setPrototypeOf(o, p) {
		o.__proto__ = p;
		return o;
	};
	return _set_prototype_of$9(o, p);
}
var ListRenderer;
var init_renderer = __esmMin((() => {
	init_pen();
	init_event_handler();
	init_main();
	init_base_renderer();
	ListRenderer = /* @__PURE__ */ function(BaseRenderer) {
		"use strict";
		_inherits$9(ListRenderer, BaseRenderer);
		function ListRenderer(rendererModel, root) {
			var _this = BaseRenderer.call(this, root, rendererModel.collector.dataUtil.getContext()) || this;
			_this.rendererModel = rendererModel;
			_this.stickyHeadIndex = -1;
			_this.stickyOffsetY = 0;
			_this.isRendering = false;
			_this.collector = _this.rendererModel.collector;
			_this.headLayer = _this._register(pen.layer(_this.headLayerConfig));
			_this.bodyLayer = _this._register(pen.layer(_this.bodyLayerConfig));
			_this.featureLayer = _this._register(pen.layer(_this.featureLayerConfig));
			_this.headContainer = _this._register(pen.group(_this.headContainerConfig));
			_this.bodyContainer = _this._register(pen.group(_this.bodyContainerConfig));
			_this.headLayer.addGroup(_this.headContainer);
			_this.bodyLayer.addGroup(_this.bodyContainer);
			_this.stage.addLayer(_this.bodyLayer);
			_this.stage.addLayer(_this.headLayer);
			_this.stage.addLayer(_this.featureLayer);
			_this.mainRenderer = new MainRenderer(_this.rendererModel);
			_this._register(_this.rendererModel.onRenderModelChange(() => {
				_this.render();
			}));
			_this.eventHandler = _this._register(new ListEventHandler(_this.stage, root, _this.rendererModel, () => _this.getStickyHead()));
			_this.UIEvent = _this.eventHandler.UIEvent;
			return _this;
		}
		var _proto = ListRenderer.prototype;
		_proto.getFeatureLayer = function getFeatureLayer() {
			return this.featureLayer;
		};
		_proto.getHeadLayer = function getHeadLayer() {
			return this.headLayer;
		};
		_proto.getBodyLayer = function getBodyLayer() {
			return this.bodyLayer;
		};
		/** scroller feature 调用此方法设置 sticky head 状态 */ _proto.setStickyHead = function setStickyHead(index, offsetY) {
			if (this.stickyHeadIndex === index && this.stickyOffsetY === offsetY) return;
			this.stickyHeadIndex = index;
			this.stickyOffsetY = offsetY;
			this.render();
		};
		/** 当前 sticky head 状态（index < 0 表示无 sticky） */ _proto.getStickyHead = function getStickyHead() {
			return {
				index: this.stickyHeadIndex,
				offsetY: this.stickyOffsetY
			};
		};
		_proto.render = function render() {
			if (this.isRendering) return;
			this.isRendering = true;
			requestAnimationFrame(() => {
				this.renderMain();
				this.renderFeature();
				this.isRendering = false;
			});
		};
		_proto.renderMain = function renderMain() {
			this.headContainer.clear();
			this.bodyContainer.clear();
			this.mainRenderer.renderBody(this.bodyContainer, this.stickyHeadIndex);
			if (this.stickyHeadIndex >= 0) this.mainRenderer.renderStickyHead(this.headContainer, this.stickyHeadIndex, this.stickyOffsetY);
		};
		_proto.renderFeature = function renderFeature() {
			this.featureRenderer.render();
		};
		_proto.resize = function resize() {
			this.headContainer.setAttrs(this.headContainerConfig);
			this.bodyContainer.setAttrs(this.bodyContainerConfig);
			this.headLayer.setAttrs(this.headLayerConfig);
			this.bodyLayer.setAttrs(this.bodyLayerConfig);
			this.featureLayer.setAttrs(this.featureLayerConfig);
			this.render();
		};
		_proto.getTarget = function getTarget(x, y) {
			return this.eventHandler.getTarget({
				x,
				y
			});
		};
		_create_class$2(ListRenderer, [
			{
				key: "headLayerConfig",
				get: function() {
					var { size } = this.collector;
					return {
						id: "list-head-layer",
						scale: size.scale,
						x: 0,
						y: 0,
						width: size.globalOriginRootWidth,
						height: size.groupHeadHeight * size.scale
					};
				}
			},
			{
				key: "bodyLayerConfig",
				get: function() {
					var { size } = this.collector;
					return {
						id: "list-body-layer",
						scale: size.scale,
						x: 0,
						y: 0,
						width: size.globalOriginRootWidth,
						height: size.globalOriginRootHeight
					};
				}
			},
			{
				key: "featureLayerConfig",
				get: function() {
					var { size } = this.collector;
					return {
						id: "list-feature-layer",
						listening: true,
						scale: size.scale,
						x: 0,
						y: 0,
						width: size.globalOriginRootWidth,
						height: size.globalOriginRootHeight
					};
				}
			},
			{
				key: "headContainerConfig",
				get: function() {
					var { size } = this.collector;
					return {
						x: 0,
						y: 0,
						width: size.rootWidth,
						height: size.groupHeadHeight,
						batch: true
					};
				}
			},
			{
				key: "bodyContainerConfig",
				get: function() {
					var { size } = this.collector;
					return {
						x: 0,
						y: 0,
						width: size.rootWidth,
						height: size.rootHeight,
						batch: true
					};
				}
			}
		]);
		return ListRenderer;
	}(BaseRenderer);
}));
//#endregion
//#region ../../node_modules/.pnpm/lodash@4.18.1/node_modules/lodash/lodash.js
var require_lodash = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function() {
		/** Used as a safe reference for `undefined` in pre-ES5 environments. */
		var undefined;
		/** Used as the semantic version number. */
		var VERSION = "4.18.1";
		/** Used as the size to enable large array optimizations. */
		var LARGE_ARRAY_SIZE = 200;
		/** Error message constants. */
		var CORE_ERROR_TEXT = "Unsupported core-js use. Try https://npms.io/search?q=ponyfill.", FUNC_ERROR_TEXT = "Expected a function", INVALID_TEMPL_VAR_ERROR_TEXT = "Invalid `variable` option passed into `_.template`", INVALID_TEMPL_IMPORTS_ERROR_TEXT = "Invalid `imports` option passed into `_.template`";
		/** Used to stand-in for `undefined` hash values. */
		var HASH_UNDEFINED = "__lodash_hash_undefined__";
		/** Used as the maximum memoize cache size. */
		var MAX_MEMOIZE_SIZE = 500;
		/** Used as the internal argument placeholder. */
		var PLACEHOLDER = "__lodash_placeholder__";
		/** Used to compose bitmasks for cloning. */
		var CLONE_DEEP_FLAG = 1, CLONE_FLAT_FLAG = 2, CLONE_SYMBOLS_FLAG = 4;
		/** Used to compose bitmasks for value comparisons. */
		var COMPARE_PARTIAL_FLAG = 1, COMPARE_UNORDERED_FLAG = 2;
		/** Used to compose bitmasks for function metadata. */
		var WRAP_BIND_FLAG = 1, WRAP_BIND_KEY_FLAG = 2, WRAP_CURRY_BOUND_FLAG = 4, WRAP_CURRY_FLAG = 8, WRAP_CURRY_RIGHT_FLAG = 16, WRAP_PARTIAL_FLAG = 32, WRAP_PARTIAL_RIGHT_FLAG = 64, WRAP_ARY_FLAG = 128, WRAP_REARG_FLAG = 256, WRAP_FLIP_FLAG = 512;
		/** Used as default options for `_.truncate`. */
		var DEFAULT_TRUNC_LENGTH = 30, DEFAULT_TRUNC_OMISSION = "...";
		/** Used to detect hot functions by number of calls within a span of milliseconds. */
		var HOT_COUNT = 800, HOT_SPAN = 16;
		/** Used to indicate the type of lazy iteratees. */
		var LAZY_FILTER_FLAG = 1, LAZY_MAP_FLAG = 2, LAZY_WHILE_FLAG = 3;
		/** Used as references for various `Number` constants. */
		var INFINITY = Infinity, MAX_SAFE_INTEGER = 9007199254740991, MAX_INTEGER = 17976931348623157e292, NAN = NaN;
		/** Used as references for the maximum length and index of an array. */
		var MAX_ARRAY_LENGTH = 4294967295, MAX_ARRAY_INDEX = MAX_ARRAY_LENGTH - 1, HALF_MAX_ARRAY_LENGTH = MAX_ARRAY_LENGTH >>> 1;
		/** Used to associate wrap methods with their bit flags. */
		var wrapFlags = [
			["ary", WRAP_ARY_FLAG],
			["bind", WRAP_BIND_FLAG],
			["bindKey", WRAP_BIND_KEY_FLAG],
			["curry", WRAP_CURRY_FLAG],
			["curryRight", WRAP_CURRY_RIGHT_FLAG],
			["flip", WRAP_FLIP_FLAG],
			["partial", WRAP_PARTIAL_FLAG],
			["partialRight", WRAP_PARTIAL_RIGHT_FLAG],
			["rearg", WRAP_REARG_FLAG]
		];
		/** `Object#toString` result references. */
		var argsTag = "[object Arguments]", arrayTag = "[object Array]", asyncTag = "[object AsyncFunction]", boolTag = "[object Boolean]", dateTag = "[object Date]", domExcTag = "[object DOMException]", errorTag = "[object Error]", funcTag = "[object Function]", genTag = "[object GeneratorFunction]", mapTag = "[object Map]", numberTag = "[object Number]", nullTag = "[object Null]", objectTag = "[object Object]", promiseTag = "[object Promise]", proxyTag = "[object Proxy]", regexpTag = "[object RegExp]", setTag = "[object Set]", stringTag = "[object String]", symbolTag = "[object Symbol]", undefinedTag = "[object Undefined]", weakMapTag = "[object WeakMap]", weakSetTag = "[object WeakSet]";
		var arrayBufferTag = "[object ArrayBuffer]", dataViewTag = "[object DataView]", float32Tag = "[object Float32Array]", float64Tag = "[object Float64Array]", int8Tag = "[object Int8Array]", int16Tag = "[object Int16Array]", int32Tag = "[object Int32Array]", uint8Tag = "[object Uint8Array]", uint8ClampedTag = "[object Uint8ClampedArray]", uint16Tag = "[object Uint16Array]", uint32Tag = "[object Uint32Array]";
		/** Used to match empty string literals in compiled template source. */
		var reEmptyStringLeading = /\b__p \+= '';/g, reEmptyStringMiddle = /\b(__p \+=) '' \+/g, reEmptyStringTrailing = /(__e\(.*?\)|\b__t\)) \+\n'';/g;
		/** Used to match HTML entities and HTML characters. */
		var reEscapedHtml = /&(?:amp|lt|gt|quot|#39);/g, reUnescapedHtml = /[&<>"']/g, reHasEscapedHtml = RegExp(reEscapedHtml.source), reHasUnescapedHtml = RegExp(reUnescapedHtml.source);
		/** Used to match template delimiters. */
		var reEscape = /<%-([\s\S]+?)%>/g, reEvaluate = /<%([\s\S]+?)%>/g, reInterpolate = /<%=([\s\S]+?)%>/g;
		/** Used to match property names within property paths. */
		var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/, reIsPlainProp = /^\w*$/, rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;
		/**
		* Used to match `RegExp`
		* [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
		*/
		var reRegExpChar = /[\\^$.*+?()[\]{}|]/g, reHasRegExpChar = RegExp(reRegExpChar.source);
		/** Used to match leading whitespace. */
		var reTrimStart = /^\s+/;
		/** Used to match a single whitespace character. */
		var reWhitespace = /\s/;
		/** Used to match wrap detail comments. */
		var reWrapComment = /\{(?:\n\/\* \[wrapped with .+\] \*\/)?\n?/, reWrapDetails = /\{\n\/\* \[wrapped with (.+)\] \*/, reSplitDetails = /,? & /;
		/** Used to match words composed of alphanumeric characters. */
		var reAsciiWord = /[^\x00-\x2f\x3a-\x40\x5b-\x60\x7b-\x7f]+/g;
		/**
		* Used to validate the `validate` option in `_.template` variable.
		*
		* Forbids characters which could potentially change the meaning of the function argument definition:
		* - "()," (modification of function parameters)
		* - "=" (default value)
		* - "[]{}" (destructuring of function parameters)
		* - "/" (beginning of a comment)
		* - whitespace
		*/
		var reForbiddenIdentifierChars = /[()=,{}\[\]\/\s]/;
		/** Used to match backslashes in property paths. */
		var reEscapeChar = /\\(\\)?/g;
		/**
		* Used to match
		* [ES template delimiters](http://ecma-international.org/ecma-262/7.0/#sec-template-literal-lexical-components).
		*/
		var reEsTemplate = /\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g;
		/** Used to match `RegExp` flags from their coerced string values. */
		var reFlags = /\w*$/;
		/** Used to detect bad signed hexadecimal string values. */
		var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;
		/** Used to detect binary string values. */
		var reIsBinary = /^0b[01]+$/i;
		/** Used to detect host constructors (Safari). */
		var reIsHostCtor = /^\[object .+?Constructor\]$/;
		/** Used to detect octal string values. */
		var reIsOctal = /^0o[0-7]+$/i;
		/** Used to detect unsigned integer values. */
		var reIsUint = /^(?:0|[1-9]\d*)$/;
		/** Used to match Latin Unicode letters (excluding mathematical operators). */
		var reLatin = /[\xc0-\xd6\xd8-\xf6\xf8-\xff\u0100-\u017f]/g;
		/** Used to ensure capturing order of template delimiters. */
		var reNoMatch = /($^)/;
		/** Used to match unescaped characters in compiled string literals. */
		var reUnescapedString = /['\n\r\u2028\u2029\\]/g;
		/** Used to compose unicode character classes. */
		var rsAstralRange = "\\ud800-\\udfff", rsComboRange = "\\u0300-\\u036f\\ufe20-\\ufe2f\\u20d0-\\u20ff", rsDingbatRange = "\\u2700-\\u27bf", rsLowerRange = "a-z\\xdf-\\xf6\\xf8-\\xff", rsMathOpRange = "\\xac\\xb1\\xd7\\xf7", rsNonCharRange = "\\x00-\\x2f\\x3a-\\x40\\x5b-\\x60\\x7b-\\xbf", rsPunctuationRange = "\\u2000-\\u206f", rsSpaceRange = " \\t\\x0b\\f\\xa0\\ufeff\\n\\r\\u2028\\u2029\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000", rsUpperRange = "A-Z\\xc0-\\xd6\\xd8-\\xde", rsVarRange = "\\ufe0e\\ufe0f", rsBreakRange = rsMathOpRange + rsNonCharRange + rsPunctuationRange + rsSpaceRange;
		/** Used to compose unicode capture groups. */
		var rsApos = "['’]", rsAstral = "[" + rsAstralRange + "]", rsBreak = "[" + rsBreakRange + "]", rsCombo = "[" + rsComboRange + "]", rsDigits = "\\d+", rsDingbat = "[" + rsDingbatRange + "]", rsLower = "[" + rsLowerRange + "]", rsMisc = "[^" + rsAstralRange + rsBreakRange + rsDigits + rsDingbatRange + rsLowerRange + rsUpperRange + "]", rsFitz = "\\ud83c[\\udffb-\\udfff]", rsModifier = "(?:" + rsCombo + "|" + rsFitz + ")", rsNonAstral = "[^" + rsAstralRange + "]", rsRegional = "(?:\\ud83c[\\udde6-\\uddff]){2}", rsSurrPair = "[\\ud800-\\udbff][\\udc00-\\udfff]", rsUpper = "[" + rsUpperRange + "]", rsZWJ = "\\u200d";
		/** Used to compose unicode regexes. */
		var rsMiscLower = "(?:" + rsLower + "|" + rsMisc + ")", rsMiscUpper = "(?:" + rsUpper + "|" + rsMisc + ")", rsOptContrLower = "(?:" + rsApos + "(?:d|ll|m|re|s|t|ve))?", rsOptContrUpper = "(?:" + rsApos + "(?:D|LL|M|RE|S|T|VE))?", reOptMod = rsModifier + "?", rsOptVar = "[" + rsVarRange + "]?", rsOptJoin = "(?:" + rsZWJ + "(?:" + [
			rsNonAstral,
			rsRegional,
			rsSurrPair
		].join("|") + ")" + rsOptVar + reOptMod + ")*", rsOrdLower = "\\d*(?:1st|2nd|3rd|(?![123])\\dth)(?=\\b|[A-Z_])", rsOrdUpper = "\\d*(?:1ST|2ND|3RD|(?![123])\\dTH)(?=\\b|[a-z_])", rsSeq = rsOptVar + reOptMod + rsOptJoin, rsEmoji = "(?:" + [
			rsDingbat,
			rsRegional,
			rsSurrPair
		].join("|") + ")" + rsSeq, rsSymbol = "(?:" + [
			rsNonAstral + rsCombo + "?",
			rsCombo,
			rsRegional,
			rsSurrPair,
			rsAstral
		].join("|") + ")";
		/** Used to match apostrophes. */
		var reApos = RegExp(rsApos, "g");
		/**
		* Used to match [combining diacritical marks](https://en.wikipedia.org/wiki/Combining_Diacritical_Marks) and
		* [combining diacritical marks for symbols](https://en.wikipedia.org/wiki/Combining_Diacritical_Marks_for_Symbols).
		*/
		var reComboMark = RegExp(rsCombo, "g");
		/** Used to match [string symbols](https://mathiasbynens.be/notes/javascript-unicode). */
		var reUnicode = RegExp(rsFitz + "(?=" + rsFitz + ")|" + rsSymbol + rsSeq, "g");
		/** Used to match complex or compound words. */
		var reUnicodeWord = RegExp([
			rsUpper + "?" + rsLower + "+" + rsOptContrLower + "(?=" + [
				rsBreak,
				rsUpper,
				"$"
			].join("|") + ")",
			rsMiscUpper + "+" + rsOptContrUpper + "(?=" + [
				rsBreak,
				rsUpper + rsMiscLower,
				"$"
			].join("|") + ")",
			rsUpper + "?" + rsMiscLower + "+" + rsOptContrLower,
			rsUpper + "+" + rsOptContrUpper,
			rsOrdUpper,
			rsOrdLower,
			rsDigits,
			rsEmoji
		].join("|"), "g");
		/** Used to detect strings with [zero-width joiners or code points from the astral planes](http://eev.ee/blog/2015/09/12/dark-corners-of-unicode/). */
		var reHasUnicode = RegExp("[" + rsZWJ + rsAstralRange + rsComboRange + rsVarRange + "]");
		/** Used to detect strings that need a more robust regexp to match words. */
		var reHasUnicodeWord = /[a-z][A-Z]|[A-Z]{2}[a-z]|[0-9][a-zA-Z]|[a-zA-Z][0-9]|[^a-zA-Z0-9 ]/;
		/** Used to assign default `context` object properties. */
		var contextProps = [
			"Array",
			"Buffer",
			"DataView",
			"Date",
			"Error",
			"Float32Array",
			"Float64Array",
			"Function",
			"Int8Array",
			"Int16Array",
			"Int32Array",
			"Map",
			"Math",
			"Object",
			"Promise",
			"RegExp",
			"Set",
			"String",
			"Symbol",
			"TypeError",
			"Uint8Array",
			"Uint8ClampedArray",
			"Uint16Array",
			"Uint32Array",
			"WeakMap",
			"_",
			"clearTimeout",
			"isFinite",
			"parseInt",
			"setTimeout"
		];
		/** Used to make template sourceURLs easier to identify. */
		var templateCounter = -1;
		/** Used to identify `toStringTag` values of typed arrays. */
		var typedArrayTags = {};
		typedArrayTags[float32Tag] = typedArrayTags[float64Tag] = typedArrayTags[int8Tag] = typedArrayTags[int16Tag] = typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] = typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] = typedArrayTags[uint32Tag] = true;
		typedArrayTags[argsTag] = typedArrayTags[arrayTag] = typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] = typedArrayTags[dataViewTag] = typedArrayTags[dateTag] = typedArrayTags[errorTag] = typedArrayTags[funcTag] = typedArrayTags[mapTag] = typedArrayTags[numberTag] = typedArrayTags[objectTag] = typedArrayTags[regexpTag] = typedArrayTags[setTag] = typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;
		/** Used to identify `toStringTag` values supported by `_.clone`. */
		var cloneableTags = {};
		cloneableTags[argsTag] = cloneableTags[arrayTag] = cloneableTags[arrayBufferTag] = cloneableTags[dataViewTag] = cloneableTags[boolTag] = cloneableTags[dateTag] = cloneableTags[float32Tag] = cloneableTags[float64Tag] = cloneableTags[int8Tag] = cloneableTags[int16Tag] = cloneableTags[int32Tag] = cloneableTags[mapTag] = cloneableTags[numberTag] = cloneableTags[objectTag] = cloneableTags[regexpTag] = cloneableTags[setTag] = cloneableTags[stringTag] = cloneableTags[symbolTag] = cloneableTags[uint8Tag] = cloneableTags[uint8ClampedTag] = cloneableTags[uint16Tag] = cloneableTags[uint32Tag] = true;
		cloneableTags[errorTag] = cloneableTags[funcTag] = cloneableTags[weakMapTag] = false;
		/** Used to map Latin Unicode letters to basic Latin letters. */
		var deburredLetters = {
			"À": "A",
			"Á": "A",
			"Â": "A",
			"Ã": "A",
			"Ä": "A",
			"Å": "A",
			"à": "a",
			"á": "a",
			"â": "a",
			"ã": "a",
			"ä": "a",
			"å": "a",
			"Ç": "C",
			"ç": "c",
			"Ð": "D",
			"ð": "d",
			"È": "E",
			"É": "E",
			"Ê": "E",
			"Ë": "E",
			"è": "e",
			"é": "e",
			"ê": "e",
			"ë": "e",
			"Ì": "I",
			"Í": "I",
			"Î": "I",
			"Ï": "I",
			"ì": "i",
			"í": "i",
			"î": "i",
			"ï": "i",
			"Ñ": "N",
			"ñ": "n",
			"Ò": "O",
			"Ó": "O",
			"Ô": "O",
			"Õ": "O",
			"Ö": "O",
			"Ø": "O",
			"ò": "o",
			"ó": "o",
			"ô": "o",
			"õ": "o",
			"ö": "o",
			"ø": "o",
			"Ù": "U",
			"Ú": "U",
			"Û": "U",
			"Ü": "U",
			"ù": "u",
			"ú": "u",
			"û": "u",
			"ü": "u",
			"Ý": "Y",
			"ý": "y",
			"ÿ": "y",
			"Æ": "Ae",
			"æ": "ae",
			"Þ": "Th",
			"þ": "th",
			"ß": "ss",
			"Ā": "A",
			"Ă": "A",
			"Ą": "A",
			"ā": "a",
			"ă": "a",
			"ą": "a",
			"Ć": "C",
			"Ĉ": "C",
			"Ċ": "C",
			"Č": "C",
			"ć": "c",
			"ĉ": "c",
			"ċ": "c",
			"č": "c",
			"Ď": "D",
			"Đ": "D",
			"ď": "d",
			"đ": "d",
			"Ē": "E",
			"Ĕ": "E",
			"Ė": "E",
			"Ę": "E",
			"Ě": "E",
			"ē": "e",
			"ĕ": "e",
			"ė": "e",
			"ę": "e",
			"ě": "e",
			"Ĝ": "G",
			"Ğ": "G",
			"Ġ": "G",
			"Ģ": "G",
			"ĝ": "g",
			"ğ": "g",
			"ġ": "g",
			"ģ": "g",
			"Ĥ": "H",
			"Ħ": "H",
			"ĥ": "h",
			"ħ": "h",
			"Ĩ": "I",
			"Ī": "I",
			"Ĭ": "I",
			"Į": "I",
			"İ": "I",
			"ĩ": "i",
			"ī": "i",
			"ĭ": "i",
			"į": "i",
			"ı": "i",
			"Ĵ": "J",
			"ĵ": "j",
			"Ķ": "K",
			"ķ": "k",
			"ĸ": "k",
			"Ĺ": "L",
			"Ļ": "L",
			"Ľ": "L",
			"Ŀ": "L",
			"Ł": "L",
			"ĺ": "l",
			"ļ": "l",
			"ľ": "l",
			"ŀ": "l",
			"ł": "l",
			"Ń": "N",
			"Ņ": "N",
			"Ň": "N",
			"Ŋ": "N",
			"ń": "n",
			"ņ": "n",
			"ň": "n",
			"ŋ": "n",
			"Ō": "O",
			"Ŏ": "O",
			"Ő": "O",
			"ō": "o",
			"ŏ": "o",
			"ő": "o",
			"Ŕ": "R",
			"Ŗ": "R",
			"Ř": "R",
			"ŕ": "r",
			"ŗ": "r",
			"ř": "r",
			"Ś": "S",
			"Ŝ": "S",
			"Ş": "S",
			"Š": "S",
			"ś": "s",
			"ŝ": "s",
			"ş": "s",
			"š": "s",
			"Ţ": "T",
			"Ť": "T",
			"Ŧ": "T",
			"ţ": "t",
			"ť": "t",
			"ŧ": "t",
			"Ũ": "U",
			"Ū": "U",
			"Ŭ": "U",
			"Ů": "U",
			"Ű": "U",
			"Ų": "U",
			"ũ": "u",
			"ū": "u",
			"ŭ": "u",
			"ů": "u",
			"ű": "u",
			"ų": "u",
			"Ŵ": "W",
			"ŵ": "w",
			"Ŷ": "Y",
			"ŷ": "y",
			"Ÿ": "Y",
			"Ź": "Z",
			"Ż": "Z",
			"Ž": "Z",
			"ź": "z",
			"ż": "z",
			"ž": "z",
			"Ĳ": "IJ",
			"ĳ": "ij",
			"Œ": "Oe",
			"œ": "oe",
			"ŉ": "'n",
			"ſ": "s"
		};
		/** Used to map characters to HTML entities. */
		var htmlEscapes = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			"\"": "&quot;",
			"'": "&#39;"
		};
		/** Used to map HTML entities to characters. */
		var htmlUnescapes = {
			"&amp;": "&",
			"&lt;": "<",
			"&gt;": ">",
			"&quot;": "\"",
			"&#39;": "'"
		};
		/** Used to escape characters for inclusion in compiled string literals. */
		var stringEscapes = {
			"\\": "\\",
			"'": "'",
			"\n": "n",
			"\r": "r",
			"\u2028": "u2028",
			"\u2029": "u2029"
		};
		/** Built-in method references without a dependency on `root`. */
		var freeParseFloat = parseFloat, freeParseInt = parseInt;
		/** Detect free variable `global` from Node.js. */
		var freeGlobal = typeof globalThis == "object" && globalThis && globalThis.Object === Object && globalThis;
		/** Detect free variable `self`. */
		var freeSelf = typeof self == "object" && self && self.Object === Object && self;
		/** Used as a reference to the global object. */
		var root = freeGlobal || freeSelf || Function("return this")();
		/** Detect free variable `exports`. */
		var freeExports = typeof exports == "object" && exports && !exports.nodeType && exports;
		/** Detect free variable `module`. */
		var freeModule = freeExports && typeof module == "object" && module && !module.nodeType && module;
		/** Detect the popular CommonJS extension `module.exports`. */
		var moduleExports = freeModule && freeModule.exports === freeExports;
		/** Detect free variable `process` from Node.js. */
		var freeProcess = moduleExports && freeGlobal.process;
		/** Used to access faster Node.js helpers. */
		var nodeUtil = function() {
			try {
				var types = freeModule && freeModule.require && freeModule.require("util").types;
				if (types) return types;
				return freeProcess && freeProcess.binding && freeProcess.binding("util");
			} catch (e) {}
		}();
		var nodeIsArrayBuffer = nodeUtil && nodeUtil.isArrayBuffer, nodeIsDate = nodeUtil && nodeUtil.isDate, nodeIsMap = nodeUtil && nodeUtil.isMap, nodeIsRegExp = nodeUtil && nodeUtil.isRegExp, nodeIsSet = nodeUtil && nodeUtil.isSet, nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;
		/**
		* A faster alternative to `Function#apply`, this function invokes `func`
		* with the `this` binding of `thisArg` and the arguments of `args`.
		*
		* @private
		* @param {Function} func The function to invoke.
		* @param {*} thisArg The `this` binding of `func`.
		* @param {Array} args The arguments to invoke `func` with.
		* @returns {*} Returns the result of `func`.
		*/
		function apply(func, thisArg, args) {
			switch (args.length) {
				case 0: return func.call(thisArg);
				case 1: return func.call(thisArg, args[0]);
				case 2: return func.call(thisArg, args[0], args[1]);
				case 3: return func.call(thisArg, args[0], args[1], args[2]);
			}
			return func.apply(thisArg, args);
		}
		/**
		* A specialized version of `baseAggregator` for arrays.
		*
		* @private
		* @param {Array} [array] The array to iterate over.
		* @param {Function} setter The function to set `accumulator` values.
		* @param {Function} iteratee The iteratee to transform keys.
		* @param {Object} accumulator The initial aggregated object.
		* @returns {Function} Returns `accumulator`.
		*/
		function arrayAggregator(array, setter, iteratee, accumulator) {
			var index = -1, length = array == null ? 0 : array.length;
			while (++index < length) {
				var value = array[index];
				setter(accumulator, value, iteratee(value), array);
			}
			return accumulator;
		}
		/**
		* A specialized version of `_.forEach` for arrays without support for
		* iteratee shorthands.
		*
		* @private
		* @param {Array} [array] The array to iterate over.
		* @param {Function} iteratee The function invoked per iteration.
		* @returns {Array} Returns `array`.
		*/
		function arrayEach(array, iteratee) {
			var index = -1, length = array == null ? 0 : array.length;
			while (++index < length) if (iteratee(array[index], index, array) === false) break;
			return array;
		}
		/**
		* A specialized version of `_.forEachRight` for arrays without support for
		* iteratee shorthands.
		*
		* @private
		* @param {Array} [array] The array to iterate over.
		* @param {Function} iteratee The function invoked per iteration.
		* @returns {Array} Returns `array`.
		*/
		function arrayEachRight(array, iteratee) {
			var length = array == null ? 0 : array.length;
			while (length--) if (iteratee(array[length], length, array) === false) break;
			return array;
		}
		/**
		* A specialized version of `_.every` for arrays without support for
		* iteratee shorthands.
		*
		* @private
		* @param {Array} [array] The array to iterate over.
		* @param {Function} predicate The function invoked per iteration.
		* @returns {boolean} Returns `true` if all elements pass the predicate check,
		*  else `false`.
		*/
		function arrayEvery(array, predicate) {
			var index = -1, length = array == null ? 0 : array.length;
			while (++index < length) if (!predicate(array[index], index, array)) return false;
			return true;
		}
		/**
		* A specialized version of `_.filter` for arrays without support for
		* iteratee shorthands.
		*
		* @private
		* @param {Array} [array] The array to iterate over.
		* @param {Function} predicate The function invoked per iteration.
		* @returns {Array} Returns the new filtered array.
		*/
		function arrayFilter(array, predicate) {
			var index = -1, length = array == null ? 0 : array.length, resIndex = 0, result = [];
			while (++index < length) {
				var value = array[index];
				if (predicate(value, index, array)) result[resIndex++] = value;
			}
			return result;
		}
		/**
		* A specialized version of `_.includes` for arrays without support for
		* specifying an index to search from.
		*
		* @private
		* @param {Array} [array] The array to inspect.
		* @param {*} target The value to search for.
		* @returns {boolean} Returns `true` if `target` is found, else `false`.
		*/
		function arrayIncludes(array, value) {
			return !!(array == null ? 0 : array.length) && baseIndexOf(array, value, 0) > -1;
		}
		/**
		* This function is like `arrayIncludes` except that it accepts a comparator.
		*
		* @private
		* @param {Array} [array] The array to inspect.
		* @param {*} target The value to search for.
		* @param {Function} comparator The comparator invoked per element.
		* @returns {boolean} Returns `true` if `target` is found, else `false`.
		*/
		function arrayIncludesWith(array, value, comparator) {
			var index = -1, length = array == null ? 0 : array.length;
			while (++index < length) if (comparator(value, array[index])) return true;
			return false;
		}
		/**
		* A specialized version of `_.map` for arrays without support for iteratee
		* shorthands.
		*
		* @private
		* @param {Array} [array] The array to iterate over.
		* @param {Function} iteratee The function invoked per iteration.
		* @returns {Array} Returns the new mapped array.
		*/
		function arrayMap(array, iteratee) {
			var index = -1, length = array == null ? 0 : array.length, result = Array(length);
			while (++index < length) result[index] = iteratee(array[index], index, array);
			return result;
		}
		/**
		* Appends the elements of `values` to `array`.
		*
		* @private
		* @param {Array} array The array to modify.
		* @param {Array} values The values to append.
		* @returns {Array} Returns `array`.
		*/
		function arrayPush(array, values) {
			var index = -1, length = values.length, offset = array.length;
			while (++index < length) array[offset + index] = values[index];
			return array;
		}
		/**
		* A specialized version of `_.reduce` for arrays without support for
		* iteratee shorthands.
		*
		* @private
		* @param {Array} [array] The array to iterate over.
		* @param {Function} iteratee The function invoked per iteration.
		* @param {*} [accumulator] The initial value.
		* @param {boolean} [initAccum] Specify using the first element of `array` as
		*  the initial value.
		* @returns {*} Returns the accumulated value.
		*/
		function arrayReduce(array, iteratee, accumulator, initAccum) {
			var index = -1, length = array == null ? 0 : array.length;
			if (initAccum && length) accumulator = array[++index];
			while (++index < length) accumulator = iteratee(accumulator, array[index], index, array);
			return accumulator;
		}
		/**
		* A specialized version of `_.reduceRight` for arrays without support for
		* iteratee shorthands.
		*
		* @private
		* @param {Array} [array] The array to iterate over.
		* @param {Function} iteratee The function invoked per iteration.
		* @param {*} [accumulator] The initial value.
		* @param {boolean} [initAccum] Specify using the last element of `array` as
		*  the initial value.
		* @returns {*} Returns the accumulated value.
		*/
		function arrayReduceRight(array, iteratee, accumulator, initAccum) {
			var length = array == null ? 0 : array.length;
			if (initAccum && length) accumulator = array[--length];
			while (length--) accumulator = iteratee(accumulator, array[length], length, array);
			return accumulator;
		}
		/**
		* A specialized version of `_.some` for arrays without support for iteratee
		* shorthands.
		*
		* @private
		* @param {Array} [array] The array to iterate over.
		* @param {Function} predicate The function invoked per iteration.
		* @returns {boolean} Returns `true` if any element passes the predicate check,
		*  else `false`.
		*/
		function arraySome(array, predicate) {
			var index = -1, length = array == null ? 0 : array.length;
			while (++index < length) if (predicate(array[index], index, array)) return true;
			return false;
		}
		/**
		* Gets the size of an ASCII `string`.
		*
		* @private
		* @param {string} string The string inspect.
		* @returns {number} Returns the string size.
		*/
		var asciiSize = baseProperty("length");
		/**
		* Converts an ASCII `string` to an array.
		*
		* @private
		* @param {string} string The string to convert.
		* @returns {Array} Returns the converted array.
		*/
		function asciiToArray(string) {
			return string.split("");
		}
		/**
		* Splits an ASCII `string` into an array of its words.
		*
		* @private
		* @param {string} The string to inspect.
		* @returns {Array} Returns the words of `string`.
		*/
		function asciiWords(string) {
			return string.match(reAsciiWord) || [];
		}
		/**
		* The base implementation of methods like `_.findKey` and `_.findLastKey`,
		* without support for iteratee shorthands, which iterates over `collection`
		* using `eachFunc`.
		*
		* @private
		* @param {Array|Object} collection The collection to inspect.
		* @param {Function} predicate The function invoked per iteration.
		* @param {Function} eachFunc The function to iterate over `collection`.
		* @returns {*} Returns the found element or its key, else `undefined`.
		*/
		function baseFindKey(collection, predicate, eachFunc) {
			var result;
			eachFunc(collection, function(value, key, collection) {
				if (predicate(value, key, collection)) {
					result = key;
					return false;
				}
			});
			return result;
		}
		/**
		* The base implementation of `_.findIndex` and `_.findLastIndex` without
		* support for iteratee shorthands.
		*
		* @private
		* @param {Array} array The array to inspect.
		* @param {Function} predicate The function invoked per iteration.
		* @param {number} fromIndex The index to search from.
		* @param {boolean} [fromRight] Specify iterating from right to left.
		* @returns {number} Returns the index of the matched value, else `-1`.
		*/
		function baseFindIndex(array, predicate, fromIndex, fromRight) {
			var length = array.length, index = fromIndex + (fromRight ? 1 : -1);
			while (fromRight ? index-- : ++index < length) if (predicate(array[index], index, array)) return index;
			return -1;
		}
		/**
		* The base implementation of `_.indexOf` without `fromIndex` bounds checks.
		*
		* @private
		* @param {Array} array The array to inspect.
		* @param {*} value The value to search for.
		* @param {number} fromIndex The index to search from.
		* @returns {number} Returns the index of the matched value, else `-1`.
		*/
		function baseIndexOf(array, value, fromIndex) {
			return value === value ? strictIndexOf(array, value, fromIndex) : baseFindIndex(array, baseIsNaN, fromIndex);
		}
		/**
		* This function is like `baseIndexOf` except that it accepts a comparator.
		*
		* @private
		* @param {Array} array The array to inspect.
		* @param {*} value The value to search for.
		* @param {number} fromIndex The index to search from.
		* @param {Function} comparator The comparator invoked per element.
		* @returns {number} Returns the index of the matched value, else `-1`.
		*/
		function baseIndexOfWith(array, value, fromIndex, comparator) {
			var index = fromIndex - 1, length = array.length;
			while (++index < length) if (comparator(array[index], value)) return index;
			return -1;
		}
		/**
		* The base implementation of `_.isNaN` without support for number objects.
		*
		* @private
		* @param {*} value The value to check.
		* @returns {boolean} Returns `true` if `value` is `NaN`, else `false`.
		*/
		function baseIsNaN(value) {
			return value !== value;
		}
		/**
		* The base implementation of `_.mean` and `_.meanBy` without support for
		* iteratee shorthands.
		*
		* @private
		* @param {Array} array The array to iterate over.
		* @param {Function} iteratee The function invoked per iteration.
		* @returns {number} Returns the mean.
		*/
		function baseMean(array, iteratee) {
			var length = array == null ? 0 : array.length;
			return length ? baseSum(array, iteratee) / length : NAN;
		}
		/**
		* The base implementation of `_.property` without support for deep paths.
		*
		* @private
		* @param {string} key The key of the property to get.
		* @returns {Function} Returns the new accessor function.
		*/
		function baseProperty(key) {
			return function(object) {
				return object == null ? undefined : object[key];
			};
		}
		/**
		* The base implementation of `_.propertyOf` without support for deep paths.
		*
		* @private
		* @param {Object} object The object to query.
		* @returns {Function} Returns the new accessor function.
		*/
		function basePropertyOf(object) {
			return function(key) {
				return object == null ? undefined : object[key];
			};
		}
		/**
		* The base implementation of `_.reduce` and `_.reduceRight`, without support
		* for iteratee shorthands, which iterates over `collection` using `eachFunc`.
		*
		* @private
		* @param {Array|Object} collection The collection to iterate over.
		* @param {Function} iteratee The function invoked per iteration.
		* @param {*} accumulator The initial value.
		* @param {boolean} initAccum Specify using the first or last element of
		*  `collection` as the initial value.
		* @param {Function} eachFunc The function to iterate over `collection`.
		* @returns {*} Returns the accumulated value.
		*/
		function baseReduce(collection, iteratee, accumulator, initAccum, eachFunc) {
			eachFunc(collection, function(value, index, collection) {
				accumulator = initAccum ? (initAccum = false, value) : iteratee(accumulator, value, index, collection);
			});
			return accumulator;
		}
		/**
		* The base implementation of `_.sortBy` which uses `comparer` to define the
		* sort order of `array` and replaces criteria objects with their corresponding
		* values.
		*
		* @private
		* @param {Array} array The array to sort.
		* @param {Function} comparer The function to define sort order.
		* @returns {Array} Returns `array`.
		*/
		function baseSortBy(array, comparer) {
			var length = array.length;
			array.sort(comparer);
			while (length--) array[length] = array[length].value;
			return array;
		}
		/**
		* The base implementation of `_.sum` and `_.sumBy` without support for
		* iteratee shorthands.
		*
		* @private
		* @param {Array} array The array to iterate over.
		* @param {Function} iteratee The function invoked per iteration.
		* @returns {number} Returns the sum.
		*/
		function baseSum(array, iteratee) {
			var result, index = -1, length = array.length;
			while (++index < length) {
				var current = iteratee(array[index]);
				if (current !== undefined) result = result === undefined ? current : result + current;
			}
			return result;
		}
		/**
		* The base implementation of `_.times` without support for iteratee shorthands
		* or max array length checks.
		*
		* @private
		* @param {number} n The number of times to invoke `iteratee`.
		* @param {Function} iteratee The function invoked per iteration.
		* @returns {Array} Returns the array of results.
		*/
		function baseTimes(n, iteratee) {
			var index = -1, result = Array(n);
			while (++index < n) result[index] = iteratee(index);
			return result;
		}
		/**
		* The base implementation of `_.toPairs` and `_.toPairsIn` which creates an array
		* of key-value pairs for `object` corresponding to the property names of `props`.
		*
		* @private
		* @param {Object} object The object to query.
		* @param {Array} props The property names to get values for.
		* @returns {Object} Returns the key-value pairs.
		*/
		function baseToPairs(object, props) {
			return arrayMap(props, function(key) {
				return [key, object[key]];
			});
		}
		/**
		* The base implementation of `_.trim`.
		*
		* @private
		* @param {string} string The string to trim.
		* @returns {string} Returns the trimmed string.
		*/
		function baseTrim(string) {
			return string ? string.slice(0, trimmedEndIndex(string) + 1).replace(reTrimStart, "") : string;
		}
		/**
		* The base implementation of `_.unary` without support for storing metadata.
		*
		* @private
		* @param {Function} func The function to cap arguments for.
		* @returns {Function} Returns the new capped function.
		*/
		function baseUnary(func) {
			return function(value) {
				return func(value);
			};
		}
		/**
		* The base implementation of `_.values` and `_.valuesIn` which creates an
		* array of `object` property values corresponding to the property names
		* of `props`.
		*
		* @private
		* @param {Object} object The object to query.
		* @param {Array} props The property names to get values for.
		* @returns {Object} Returns the array of property values.
		*/
		function baseValues(object, props) {
			return arrayMap(props, function(key) {
				return object[key];
			});
		}
		/**
		* Checks if a `cache` value for `key` exists.
		*
		* @private
		* @param {Object} cache The cache to query.
		* @param {string} key The key of the entry to check.
		* @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
		*/
		function cacheHas(cache, key) {
			return cache.has(key);
		}
		/**
		* Used by `_.trim` and `_.trimStart` to get the index of the first string symbol
		* that is not found in the character symbols.
		*
		* @private
		* @param {Array} strSymbols The string symbols to inspect.
		* @param {Array} chrSymbols The character symbols to find.
		* @returns {number} Returns the index of the first unmatched string symbol.
		*/
		function charsStartIndex(strSymbols, chrSymbols) {
			var index = -1, length = strSymbols.length;
			while (++index < length && baseIndexOf(chrSymbols, strSymbols[index], 0) > -1);
			return index;
		}
		/**
		* Used by `_.trim` and `_.trimEnd` to get the index of the last string symbol
		* that is not found in the character symbols.
		*
		* @private
		* @param {Array} strSymbols The string symbols to inspect.
		* @param {Array} chrSymbols The character symbols to find.
		* @returns {number} Returns the index of the last unmatched string symbol.
		*/
		function charsEndIndex(strSymbols, chrSymbols) {
			var index = strSymbols.length;
			while (index-- && baseIndexOf(chrSymbols, strSymbols[index], 0) > -1);
			return index;
		}
		/**
		* Gets the number of `placeholder` occurrences in `array`.
		*
		* @private
		* @param {Array} array The array to inspect.
		* @param {*} placeholder The placeholder to search for.
		* @returns {number} Returns the placeholder count.
		*/
		function countHolders(array, placeholder) {
			var length = array.length, result = 0;
			while (length--) if (array[length] === placeholder) ++result;
			return result;
		}
		/**
		* Used by `_.deburr` to convert Latin-1 Supplement and Latin Extended-A
		* letters to basic Latin letters.
		*
		* @private
		* @param {string} letter The matched letter to deburr.
		* @returns {string} Returns the deburred letter.
		*/
		var deburrLetter = basePropertyOf(deburredLetters);
		/**
		* Used by `_.escape` to convert characters to HTML entities.
		*
		* @private
		* @param {string} chr The matched character to escape.
		* @returns {string} Returns the escaped character.
		*/
		var escapeHtmlChar = basePropertyOf(htmlEscapes);
		/**
		* Used by `_.template` to escape characters for inclusion in compiled string literals.
		*
		* @private
		* @param {string} chr The matched character to escape.
		* @returns {string} Returns the escaped character.
		*/
		function escapeStringChar(chr) {
			return "\\" + stringEscapes[chr];
		}
		/**
		* Gets the value at `key` of `object`.
		*
		* @private
		* @param {Object} [object] The object to query.
		* @param {string} key The key of the property to get.
		* @returns {*} Returns the property value.
		*/
		function getValue(object, key) {
			return object == null ? undefined : object[key];
		}
		/**
		* Checks if `string` contains Unicode symbols.
		*
		* @private
		* @param {string} string The string to inspect.
		* @returns {boolean} Returns `true` if a symbol is found, else `false`.
		*/
		function hasUnicode(string) {
			return reHasUnicode.test(string);
		}
		/**
		* Checks if `string` contains a word composed of Unicode symbols.
		*
		* @private
		* @param {string} string The string to inspect.
		* @returns {boolean} Returns `true` if a word is found, else `false`.
		*/
		function hasUnicodeWord(string) {
			return reHasUnicodeWord.test(string);
		}
		/**
		* Converts `iterator` to an array.
		*
		* @private
		* @param {Object} iterator The iterator to convert.
		* @returns {Array} Returns the converted array.
		*/
		function iteratorToArray(iterator) {
			var data, result = [];
			while (!(data = iterator.next()).done) result.push(data.value);
			return result;
		}
		/**
		* Converts `map` to its key-value pairs.
		*
		* @private
		* @param {Object} map The map to convert.
		* @returns {Array} Returns the key-value pairs.
		*/
		function mapToArray(map) {
			var index = -1, result = Array(map.size);
			map.forEach(function(value, key) {
				result[++index] = [key, value];
			});
			return result;
		}
		/**
		* Creates a unary function that invokes `func` with its argument transformed.
		*
		* @private
		* @param {Function} func The function to wrap.
		* @param {Function} transform The argument transform.
		* @returns {Function} Returns the new function.
		*/
		function overArg(func, transform) {
			return function(arg) {
				return func(transform(arg));
			};
		}
		/**
		* Replaces all `placeholder` elements in `array` with an internal placeholder
		* and returns an array of their indexes.
		*
		* @private
		* @param {Array} array The array to modify.
		* @param {*} placeholder The placeholder to replace.
		* @returns {Array} Returns the new array of placeholder indexes.
		*/
		function replaceHolders(array, placeholder) {
			var index = -1, length = array.length, resIndex = 0, result = [];
			while (++index < length) {
				var value = array[index];
				if (value === placeholder || value === PLACEHOLDER) {
					array[index] = PLACEHOLDER;
					result[resIndex++] = index;
				}
			}
			return result;
		}
		/**
		* Converts `set` to an array of its values.
		*
		* @private
		* @param {Object} set The set to convert.
		* @returns {Array} Returns the values.
		*/
		function setToArray(set) {
			var index = -1, result = Array(set.size);
			set.forEach(function(value) {
				result[++index] = value;
			});
			return result;
		}
		/**
		* Converts `set` to its value-value pairs.
		*
		* @private
		* @param {Object} set The set to convert.
		* @returns {Array} Returns the value-value pairs.
		*/
		function setToPairs(set) {
			var index = -1, result = Array(set.size);
			set.forEach(function(value) {
				result[++index] = [value, value];
			});
			return result;
		}
		/**
		* A specialized version of `_.indexOf` which performs strict equality
		* comparisons of values, i.e. `===`.
		*
		* @private
		* @param {Array} array The array to inspect.
		* @param {*} value The value to search for.
		* @param {number} fromIndex The index to search from.
		* @returns {number} Returns the index of the matched value, else `-1`.
		*/
		function strictIndexOf(array, value, fromIndex) {
			var index = fromIndex - 1, length = array.length;
			while (++index < length) if (array[index] === value) return index;
			return -1;
		}
		/**
		* A specialized version of `_.lastIndexOf` which performs strict equality
		* comparisons of values, i.e. `===`.
		*
		* @private
		* @param {Array} array The array to inspect.
		* @param {*} value The value to search for.
		* @param {number} fromIndex The index to search from.
		* @returns {number} Returns the index of the matched value, else `-1`.
		*/
		function strictLastIndexOf(array, value, fromIndex) {
			var index = fromIndex + 1;
			while (index--) if (array[index] === value) return index;
			return index;
		}
		/**
		* Gets the number of symbols in `string`.
		*
		* @private
		* @param {string} string The string to inspect.
		* @returns {number} Returns the string size.
		*/
		function stringSize(string) {
			return hasUnicode(string) ? unicodeSize(string) : asciiSize(string);
		}
		/**
		* Converts `string` to an array.
		*
		* @private
		* @param {string} string The string to convert.
		* @returns {Array} Returns the converted array.
		*/
		function stringToArray(string) {
			return hasUnicode(string) ? unicodeToArray(string) : asciiToArray(string);
		}
		/**
		* Used by `_.trim` and `_.trimEnd` to get the index of the last non-whitespace
		* character of `string`.
		*
		* @private
		* @param {string} string The string to inspect.
		* @returns {number} Returns the index of the last non-whitespace character.
		*/
		function trimmedEndIndex(string) {
			var index = string.length;
			while (index-- && reWhitespace.test(string.charAt(index)));
			return index;
		}
		/**
		* Used by `_.unescape` to convert HTML entities to characters.
		*
		* @private
		* @param {string} chr The matched character to unescape.
		* @returns {string} Returns the unescaped character.
		*/
		var unescapeHtmlChar = basePropertyOf(htmlUnescapes);
		/**
		* Gets the size of a Unicode `string`.
		*
		* @private
		* @param {string} string The string inspect.
		* @returns {number} Returns the string size.
		*/
		function unicodeSize(string) {
			var result = reUnicode.lastIndex = 0;
			while (reUnicode.test(string)) ++result;
			return result;
		}
		/**
		* Converts a Unicode `string` to an array.
		*
		* @private
		* @param {string} string The string to convert.
		* @returns {Array} Returns the converted array.
		*/
		function unicodeToArray(string) {
			return string.match(reUnicode) || [];
		}
		/**
		* Splits a Unicode `string` into an array of its words.
		*
		* @private
		* @param {string} The string to inspect.
		* @returns {Array} Returns the words of `string`.
		*/
		function unicodeWords(string) {
			return string.match(reUnicodeWord) || [];
		}
		var _ = (function runInContext(context) {
			context = context == null ? root : _.defaults(root.Object(), context, _.pick(root, contextProps));
			/** Built-in constructor references. */
			var Array = context.Array, Date = context.Date, Error = context.Error, Function = context.Function, Math = context.Math, Object = context.Object, RegExp = context.RegExp, String = context.String, TypeError = context.TypeError;
			/** Used for built-in method references. */
			var arrayProto = Array.prototype, funcProto = Function.prototype, objectProto = Object.prototype;
			/** Used to detect overreaching core-js shims. */
			var coreJsData = context["__core-js_shared__"];
			/** Used to resolve the decompiled source of functions. */
			var funcToString = funcProto.toString;
			/** Used to check objects for own properties. */
			var hasOwnProperty = objectProto.hasOwnProperty;
			/** Used to generate unique IDs. */
			var idCounter = 0;
			/** Used to detect methods masquerading as native. */
			var maskSrcKey = function() {
				var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || "");
				return uid ? "Symbol(src)_1." + uid : "";
			}();
			/**
			* Used to resolve the
			* [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
			* of values.
			*/
			var nativeObjectToString = objectProto.toString;
			/** Used to infer the `Object` constructor. */
			var objectCtorString = funcToString.call(Object);
			/** Used to restore the original `_` reference in `_.noConflict`. */
			var oldDash = root._;
			/** Used to detect if a method is native. */
			var reIsNative = RegExp("^" + funcToString.call(hasOwnProperty).replace(reRegExpChar, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$");
			/** Built-in value references. */
			var Buffer = moduleExports ? context.Buffer : undefined, Symbol = context.Symbol, Uint8Array = context.Uint8Array, allocUnsafe = Buffer ? Buffer.allocUnsafe : undefined, getPrototype = overArg(Object.getPrototypeOf, Object), objectCreate = Object.create, propertyIsEnumerable = objectProto.propertyIsEnumerable, splice = arrayProto.splice, spreadableSymbol = Symbol ? Symbol.isConcatSpreadable : undefined, symIterator = Symbol ? Symbol.iterator : undefined, symToStringTag = Symbol ? Symbol.toStringTag : undefined;
			var defineProperty = function() {
				try {
					var func = getNative(Object, "defineProperty");
					func({}, "", {});
					return func;
				} catch (e) {}
			}();
			/** Mocked built-ins. */
			var ctxClearTimeout = context.clearTimeout !== root.clearTimeout && context.clearTimeout, ctxNow = Date && Date.now !== root.Date.now && Date.now, ctxSetTimeout = context.setTimeout !== root.setTimeout && context.setTimeout;
			var nativeCeil = Math.ceil, nativeFloor = Math.floor, nativeGetSymbols = Object.getOwnPropertySymbols, nativeIsBuffer = Buffer ? Buffer.isBuffer : undefined, nativeIsFinite = context.isFinite, nativeJoin = arrayProto.join, nativeKeys = overArg(Object.keys, Object), nativeMax = Math.max, nativeMin = Math.min, nativeNow = Date.now, nativeParseInt = context.parseInt, nativeRandom = Math.random, nativeReverse = arrayProto.reverse;
			var DataView = getNative(context, "DataView"), Map = getNative(context, "Map"), Promise = getNative(context, "Promise"), Set = getNative(context, "Set"), WeakMap = getNative(context, "WeakMap"), nativeCreate = getNative(Object, "create");
			/** Used to store function metadata. */
			var metaMap = WeakMap && new WeakMap();
			/** Used to lookup unminified function names. */
			var realNames = {};
			/** Used to detect maps, sets, and weakmaps. */
			var dataViewCtorString = toSource(DataView), mapCtorString = toSource(Map), promiseCtorString = toSource(Promise), setCtorString = toSource(Set), weakMapCtorString = toSource(WeakMap);
			/** Used to convert symbols to primitives and strings. */
			var symbolProto = Symbol ? Symbol.prototype : undefined, symbolValueOf = symbolProto ? symbolProto.valueOf : undefined, symbolToString = symbolProto ? symbolProto.toString : undefined;
			/**
			* Creates a `lodash` object which wraps `value` to enable implicit method
			* chain sequences. Methods that operate on and return arrays, collections,
			* and functions can be chained together. Methods that retrieve a single value
			* or may return a primitive value will automatically end the chain sequence
			* and return the unwrapped value. Otherwise, the value must be unwrapped
			* with `_#value`.
			*
			* Explicit chain sequences, which must be unwrapped with `_#value`, may be
			* enabled using `_.chain`.
			*
			* The execution of chained methods is lazy, that is, it's deferred until
			* `_#value` is implicitly or explicitly called.
			*
			* Lazy evaluation allows several methods to support shortcut fusion.
			* Shortcut fusion is an optimization to merge iteratee calls; this avoids
			* the creation of intermediate arrays and can greatly reduce the number of
			* iteratee executions. Sections of a chain sequence qualify for shortcut
			* fusion if the section is applied to an array and iteratees accept only
			* one argument. The heuristic for whether a section qualifies for shortcut
			* fusion is subject to change.
			*
			* Chaining is supported in custom builds as long as the `_#value` method is
			* directly or indirectly included in the build.
			*
			* In addition to lodash methods, wrappers have `Array` and `String` methods.
			*
			* The wrapper `Array` methods are:
			* `concat`, `join`, `pop`, `push`, `shift`, `sort`, `splice`, and `unshift`
			*
			* The wrapper `String` methods are:
			* `replace` and `split`
			*
			* The wrapper methods that support shortcut fusion are:
			* `at`, `compact`, `drop`, `dropRight`, `dropWhile`, `filter`, `find`,
			* `findLast`, `head`, `initial`, `last`, `map`, `reject`, `reverse`, `slice`,
			* `tail`, `take`, `takeRight`, `takeRightWhile`, `takeWhile`, and `toArray`
			*
			* The chainable wrapper methods are:
			* `after`, `ary`, `assign`, `assignIn`, `assignInWith`, `assignWith`, `at`,
			* `before`, `bind`, `bindAll`, `bindKey`, `castArray`, `chain`, `chunk`,
			* `commit`, `compact`, `concat`, `conforms`, `constant`, `countBy`, `create`,
			* `curry`, `debounce`, `defaults`, `defaultsDeep`, `defer`, `delay`,
			* `difference`, `differenceBy`, `differenceWith`, `drop`, `dropRight`,
			* `dropRightWhile`, `dropWhile`, `extend`, `extendWith`, `fill`, `filter`,
			* `flatMap`, `flatMapDeep`, `flatMapDepth`, `flatten`, `flattenDeep`,
			* `flattenDepth`, `flip`, `flow`, `flowRight`, `fromPairs`, `functions`,
			* `functionsIn`, `groupBy`, `initial`, `intersection`, `intersectionBy`,
			* `intersectionWith`, `invert`, `invertBy`, `invokeMap`, `iteratee`, `keyBy`,
			* `keys`, `keysIn`, `map`, `mapKeys`, `mapValues`, `matches`, `matchesProperty`,
			* `memoize`, `merge`, `mergeWith`, `method`, `methodOf`, `mixin`, `negate`,
			* `nthArg`, `omit`, `omitBy`, `once`, `orderBy`, `over`, `overArgs`,
			* `overEvery`, `overSome`, `partial`, `partialRight`, `partition`, `pick`,
			* `pickBy`, `plant`, `property`, `propertyOf`, `pull`, `pullAll`, `pullAllBy`,
			* `pullAllWith`, `pullAt`, `push`, `range`, `rangeRight`, `rearg`, `reject`,
			* `remove`, `rest`, `reverse`, `sampleSize`, `set`, `setWith`, `shuffle`,
			* `slice`, `sort`, `sortBy`, `splice`, `spread`, `tail`, `take`, `takeRight`,
			* `takeRightWhile`, `takeWhile`, `tap`, `throttle`, `thru`, `toArray`,
			* `toPairs`, `toPairsIn`, `toPath`, `toPlainObject`, `transform`, `unary`,
			* `union`, `unionBy`, `unionWith`, `uniq`, `uniqBy`, `uniqWith`, `unset`,
			* `unshift`, `unzip`, `unzipWith`, `update`, `updateWith`, `values`,
			* `valuesIn`, `without`, `wrap`, `xor`, `xorBy`, `xorWith`, `zip`,
			* `zipObject`, `zipObjectDeep`, and `zipWith`
			*
			* The wrapper methods that are **not** chainable by default are:
			* `add`, `attempt`, `camelCase`, `capitalize`, `ceil`, `clamp`, `clone`,
			* `cloneDeep`, `cloneDeepWith`, `cloneWith`, `conformsTo`, `deburr`,
			* `defaultTo`, `divide`, `each`, `eachRight`, `endsWith`, `eq`, `escape`,
			* `escapeRegExp`, `every`, `find`, `findIndex`, `findKey`, `findLast`,
			* `findLastIndex`, `findLastKey`, `first`, `floor`, `forEach`, `forEachRight`,
			* `forIn`, `forInRight`, `forOwn`, `forOwnRight`, `get`, `gt`, `gte`, `has`,
			* `hasIn`, `head`, `identity`, `includes`, `indexOf`, `inRange`, `invoke`,
			* `isArguments`, `isArray`, `isArrayBuffer`, `isArrayLike`, `isArrayLikeObject`,
			* `isBoolean`, `isBuffer`, `isDate`, `isElement`, `isEmpty`, `isEqual`,
			* `isEqualWith`, `isError`, `isFinite`, `isFunction`, `isInteger`, `isLength`,
			* `isMap`, `isMatch`, `isMatchWith`, `isNaN`, `isNative`, `isNil`, `isNull`,
			* `isNumber`, `isObject`, `isObjectLike`, `isPlainObject`, `isRegExp`,
			* `isSafeInteger`, `isSet`, `isString`, `isUndefined`, `isTypedArray`,
			* `isWeakMap`, `isWeakSet`, `join`, `kebabCase`, `last`, `lastIndexOf`,
			* `lowerCase`, `lowerFirst`, `lt`, `lte`, `max`, `maxBy`, `mean`, `meanBy`,
			* `min`, `minBy`, `multiply`, `noConflict`, `noop`, `now`, `nth`, `pad`,
			* `padEnd`, `padStart`, `parseInt`, `pop`, `random`, `reduce`, `reduceRight`,
			* `repeat`, `result`, `round`, `runInContext`, `sample`, `shift`, `size`,
			* `snakeCase`, `some`, `sortedIndex`, `sortedIndexBy`, `sortedLastIndex`,
			* `sortedLastIndexBy`, `startCase`, `startsWith`, `stubArray`, `stubFalse`,
			* `stubObject`, `stubString`, `stubTrue`, `subtract`, `sum`, `sumBy`,
			* `template`, `times`, `toFinite`, `toInteger`, `toJSON`, `toLength`,
			* `toLower`, `toNumber`, `toSafeInteger`, `toString`, `toUpper`, `trim`,
			* `trimEnd`, `trimStart`, `truncate`, `unescape`, `uniqueId`, `upperCase`,
			* `upperFirst`, `value`, and `words`
			*
			* @name _
			* @constructor
			* @category Seq
			* @param {*} value The value to wrap in a `lodash` instance.
			* @returns {Object} Returns the new `lodash` wrapper instance.
			* @example
			*
			* function square(n) {
			*   return n * n;
			* }
			*
			* var wrapped = _([1, 2, 3]);
			*
			* // Returns an unwrapped value.
			* wrapped.reduce(_.add);
			* // => 6
			*
			* // Returns a wrapped value.
			* var squares = wrapped.map(square);
			*
			* _.isArray(squares);
			* // => false
			*
			* _.isArray(squares.value());
			* // => true
			*/
			function lodash(value) {
				if (isObjectLike(value) && !isArray(value) && !(value instanceof LazyWrapper)) {
					if (value instanceof LodashWrapper) return value;
					if (hasOwnProperty.call(value, "__wrapped__")) return wrapperClone(value);
				}
				return new LodashWrapper(value);
			}
			/**
			* The base implementation of `_.create` without support for assigning
			* properties to the created object.
			*
			* @private
			* @param {Object} proto The object to inherit from.
			* @returns {Object} Returns the new object.
			*/
			var baseCreate = function() {
				function object() {}
				return function(proto) {
					if (!isObject(proto)) return {};
					if (objectCreate) return objectCreate(proto);
					object.prototype = proto;
					var result = new object();
					object.prototype = undefined;
					return result;
				};
			}();
			/**
			* The function whose prototype chain sequence wrappers inherit from.
			*
			* @private
			*/
			function baseLodash() {}
			/**
			* The base constructor for creating `lodash` wrapper objects.
			*
			* @private
			* @param {*} value The value to wrap.
			* @param {boolean} [chainAll] Enable explicit method chain sequences.
			*/
			function LodashWrapper(value, chainAll) {
				this.__wrapped__ = value;
				this.__actions__ = [];
				this.__chain__ = !!chainAll;
				this.__index__ = 0;
				this.__values__ = undefined;
			}
			/**
			* By default, the template delimiters used by lodash are like those in
			* embedded Ruby (ERB) as well as ES2015 template strings. Change the
			* following template settings to use alternative delimiters.
			*
			* **Security:** See
			* [threat model](https://github.com/lodash/lodash/blob/main/threat-model.md)
			* — `_.template` is insecure and will be removed in v5.
			*
			* @static
			* @memberOf _
			* @type {Object}
			*/
			lodash.templateSettings = {
				"escape": reEscape,
				"evaluate": reEvaluate,
				"interpolate": reInterpolate,
				"variable": "",
				"imports": { "_": lodash }
			};
			lodash.prototype = baseLodash.prototype;
			lodash.prototype.constructor = lodash;
			LodashWrapper.prototype = baseCreate(baseLodash.prototype);
			LodashWrapper.prototype.constructor = LodashWrapper;
			/**
			* Creates a lazy wrapper object which wraps `value` to enable lazy evaluation.
			*
			* @private
			* @constructor
			* @param {*} value The value to wrap.
			*/
			function LazyWrapper(value) {
				this.__wrapped__ = value;
				this.__actions__ = [];
				this.__dir__ = 1;
				this.__filtered__ = false;
				this.__iteratees__ = [];
				this.__takeCount__ = MAX_ARRAY_LENGTH;
				this.__views__ = [];
			}
			/**
			* Creates a clone of the lazy wrapper object.
			*
			* @private
			* @name clone
			* @memberOf LazyWrapper
			* @returns {Object} Returns the cloned `LazyWrapper` object.
			*/
			function lazyClone() {
				var result = new LazyWrapper(this.__wrapped__);
				result.__actions__ = copyArray(this.__actions__);
				result.__dir__ = this.__dir__;
				result.__filtered__ = this.__filtered__;
				result.__iteratees__ = copyArray(this.__iteratees__);
				result.__takeCount__ = this.__takeCount__;
				result.__views__ = copyArray(this.__views__);
				return result;
			}
			/**
			* Reverses the direction of lazy iteration.
			*
			* @private
			* @name reverse
			* @memberOf LazyWrapper
			* @returns {Object} Returns the new reversed `LazyWrapper` object.
			*/
			function lazyReverse() {
				if (this.__filtered__) {
					var result = new LazyWrapper(this);
					result.__dir__ = -1;
					result.__filtered__ = true;
				} else {
					result = this.clone();
					result.__dir__ *= -1;
				}
				return result;
			}
			/**
			* Extracts the unwrapped value from its lazy wrapper.
			*
			* @private
			* @name value
			* @memberOf LazyWrapper
			* @returns {*} Returns the unwrapped value.
			*/
			function lazyValue() {
				var array = this.__wrapped__.value(), dir = this.__dir__, isArr = isArray(array), isRight = dir < 0, arrLength = isArr ? array.length : 0, view = getView(0, arrLength, this.__views__), start = view.start, end = view.end, length = end - start, index = isRight ? end : start - 1, iteratees = this.__iteratees__, iterLength = iteratees.length, resIndex = 0, takeCount = nativeMin(length, this.__takeCount__);
				if (!isArr || !isRight && arrLength == length && takeCount == length) return baseWrapperValue(array, this.__actions__);
				var result = [];
				outer: while (length-- && resIndex < takeCount) {
					index += dir;
					var iterIndex = -1, value = array[index];
					while (++iterIndex < iterLength) {
						var data = iteratees[iterIndex], iteratee = data.iteratee, type = data.type, computed = iteratee(value);
						if (type == LAZY_MAP_FLAG) value = computed;
						else if (!computed) if (type == LAZY_FILTER_FLAG) continue outer;
						else break outer;
					}
					result[resIndex++] = value;
				}
				return result;
			}
			LazyWrapper.prototype = baseCreate(baseLodash.prototype);
			LazyWrapper.prototype.constructor = LazyWrapper;
			/**
			* Creates a hash object.
			*
			* @private
			* @constructor
			* @param {Array} [entries] The key-value pairs to cache.
			*/
			function Hash(entries) {
				var index = -1, length = entries == null ? 0 : entries.length;
				this.clear();
				while (++index < length) {
					var entry = entries[index];
					this.set(entry[0], entry[1]);
				}
			}
			/**
			* Removes all key-value entries from the hash.
			*
			* @private
			* @name clear
			* @memberOf Hash
			*/
			function hashClear() {
				this.__data__ = nativeCreate ? nativeCreate(null) : {};
				this.size = 0;
			}
			/**
			* Removes `key` and its value from the hash.
			*
			* @private
			* @name delete
			* @memberOf Hash
			* @param {Object} hash The hash to modify.
			* @param {string} key The key of the value to remove.
			* @returns {boolean} Returns `true` if the entry was removed, else `false`.
			*/
			function hashDelete(key) {
				var result = this.has(key) && delete this.__data__[key];
				this.size -= result ? 1 : 0;
				return result;
			}
			/**
			* Gets the hash value for `key`.
			*
			* @private
			* @name get
			* @memberOf Hash
			* @param {string} key The key of the value to get.
			* @returns {*} Returns the entry value.
			*/
			function hashGet(key) {
				var data = this.__data__;
				if (nativeCreate) {
					var result = data[key];
					return result === HASH_UNDEFINED ? undefined : result;
				}
				return hasOwnProperty.call(data, key) ? data[key] : undefined;
			}
			/**
			* Checks if a hash value for `key` exists.
			*
			* @private
			* @name has
			* @memberOf Hash
			* @param {string} key The key of the entry to check.
			* @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
			*/
			function hashHas(key) {
				var data = this.__data__;
				return nativeCreate ? data[key] !== undefined : hasOwnProperty.call(data, key);
			}
			/**
			* Sets the hash `key` to `value`.
			*
			* @private
			* @name set
			* @memberOf Hash
			* @param {string} key The key of the value to set.
			* @param {*} value The value to set.
			* @returns {Object} Returns the hash instance.
			*/
			function hashSet(key, value) {
				var data = this.__data__;
				this.size += this.has(key) ? 0 : 1;
				data[key] = nativeCreate && value === undefined ? HASH_UNDEFINED : value;
				return this;
			}
			Hash.prototype.clear = hashClear;
			Hash.prototype["delete"] = hashDelete;
			Hash.prototype.get = hashGet;
			Hash.prototype.has = hashHas;
			Hash.prototype.set = hashSet;
			/**
			* Creates an list cache object.
			*
			* @private
			* @constructor
			* @param {Array} [entries] The key-value pairs to cache.
			*/
			function ListCache(entries) {
				var index = -1, length = entries == null ? 0 : entries.length;
				this.clear();
				while (++index < length) {
					var entry = entries[index];
					this.set(entry[0], entry[1]);
				}
			}
			/**
			* Removes all key-value entries from the list cache.
			*
			* @private
			* @name clear
			* @memberOf ListCache
			*/
			function listCacheClear() {
				this.__data__ = [];
				this.size = 0;
			}
			/**
			* Removes `key` and its value from the list cache.
			*
			* @private
			* @name delete
			* @memberOf ListCache
			* @param {string} key The key of the value to remove.
			* @returns {boolean} Returns `true` if the entry was removed, else `false`.
			*/
			function listCacheDelete(key) {
				var data = this.__data__, index = assocIndexOf(data, key);
				if (index < 0) return false;
				if (index == data.length - 1) data.pop();
				else splice.call(data, index, 1);
				--this.size;
				return true;
			}
			/**
			* Gets the list cache value for `key`.
			*
			* @private
			* @name get
			* @memberOf ListCache
			* @param {string} key The key of the value to get.
			* @returns {*} Returns the entry value.
			*/
			function listCacheGet(key) {
				var data = this.__data__, index = assocIndexOf(data, key);
				return index < 0 ? undefined : data[index][1];
			}
			/**
			* Checks if a list cache value for `key` exists.
			*
			* @private
			* @name has
			* @memberOf ListCache
			* @param {string} key The key of the entry to check.
			* @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
			*/
			function listCacheHas(key) {
				return assocIndexOf(this.__data__, key) > -1;
			}
			/**
			* Sets the list cache `key` to `value`.
			*
			* @private
			* @name set
			* @memberOf ListCache
			* @param {string} key The key of the value to set.
			* @param {*} value The value to set.
			* @returns {Object} Returns the list cache instance.
			*/
			function listCacheSet(key, value) {
				var data = this.__data__, index = assocIndexOf(data, key);
				if (index < 0) {
					++this.size;
					data.push([key, value]);
				} else data[index][1] = value;
				return this;
			}
			ListCache.prototype.clear = listCacheClear;
			ListCache.prototype["delete"] = listCacheDelete;
			ListCache.prototype.get = listCacheGet;
			ListCache.prototype.has = listCacheHas;
			ListCache.prototype.set = listCacheSet;
			/**
			* Creates a map cache object to store key-value pairs.
			*
			* @private
			* @constructor
			* @param {Array} [entries] The key-value pairs to cache.
			*/
			function MapCache(entries) {
				var index = -1, length = entries == null ? 0 : entries.length;
				this.clear();
				while (++index < length) {
					var entry = entries[index];
					this.set(entry[0], entry[1]);
				}
			}
			/**
			* Removes all key-value entries from the map.
			*
			* @private
			* @name clear
			* @memberOf MapCache
			*/
			function mapCacheClear() {
				this.size = 0;
				this.__data__ = {
					"hash": new Hash(),
					"map": new (Map || ListCache)(),
					"string": new Hash()
				};
			}
			/**
			* Removes `key` and its value from the map.
			*
			* @private
			* @name delete
			* @memberOf MapCache
			* @param {string} key The key of the value to remove.
			* @returns {boolean} Returns `true` if the entry was removed, else `false`.
			*/
			function mapCacheDelete(key) {
				var result = getMapData(this, key)["delete"](key);
				this.size -= result ? 1 : 0;
				return result;
			}
			/**
			* Gets the map value for `key`.
			*
			* @private
			* @name get
			* @memberOf MapCache
			* @param {string} key The key of the value to get.
			* @returns {*} Returns the entry value.
			*/
			function mapCacheGet(key) {
				return getMapData(this, key).get(key);
			}
			/**
			* Checks if a map value for `key` exists.
			*
			* @private
			* @name has
			* @memberOf MapCache
			* @param {string} key The key of the entry to check.
			* @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
			*/
			function mapCacheHas(key) {
				return getMapData(this, key).has(key);
			}
			/**
			* Sets the map `key` to `value`.
			*
			* @private
			* @name set
			* @memberOf MapCache
			* @param {string} key The key of the value to set.
			* @param {*} value The value to set.
			* @returns {Object} Returns the map cache instance.
			*/
			function mapCacheSet(key, value) {
				var data = getMapData(this, key), size = data.size;
				data.set(key, value);
				this.size += data.size == size ? 0 : 1;
				return this;
			}
			MapCache.prototype.clear = mapCacheClear;
			MapCache.prototype["delete"] = mapCacheDelete;
			MapCache.prototype.get = mapCacheGet;
			MapCache.prototype.has = mapCacheHas;
			MapCache.prototype.set = mapCacheSet;
			/**
			*
			* Creates an array cache object to store unique values.
			*
			* @private
			* @constructor
			* @param {Array} [values] The values to cache.
			*/
			function SetCache(values) {
				var index = -1, length = values == null ? 0 : values.length;
				this.__data__ = new MapCache();
				while (++index < length) this.add(values[index]);
			}
			/**
			* Adds `value` to the array cache.
			*
			* @private
			* @name add
			* @memberOf SetCache
			* @alias push
			* @param {*} value The value to cache.
			* @returns {Object} Returns the cache instance.
			*/
			function setCacheAdd(value) {
				this.__data__.set(value, HASH_UNDEFINED);
				return this;
			}
			/**
			* Checks if `value` is in the array cache.
			*
			* @private
			* @name has
			* @memberOf SetCache
			* @param {*} value The value to search for.
			* @returns {boolean} Returns `true` if `value` is found, else `false`.
			*/
			function setCacheHas(value) {
				return this.__data__.has(value);
			}
			SetCache.prototype.add = SetCache.prototype.push = setCacheAdd;
			SetCache.prototype.has = setCacheHas;
			/**
			* Creates a stack cache object to store key-value pairs.
			*
			* @private
			* @constructor
			* @param {Array} [entries] The key-value pairs to cache.
			*/
			function Stack(entries) {
				this.size = (this.__data__ = new ListCache(entries)).size;
			}
			/**
			* Removes all key-value entries from the stack.
			*
			* @private
			* @name clear
			* @memberOf Stack
			*/
			function stackClear() {
				this.__data__ = new ListCache();
				this.size = 0;
			}
			/**
			* Removes `key` and its value from the stack.
			*
			* @private
			* @name delete
			* @memberOf Stack
			* @param {string} key The key of the value to remove.
			* @returns {boolean} Returns `true` if the entry was removed, else `false`.
			*/
			function stackDelete(key) {
				var data = this.__data__, result = data["delete"](key);
				this.size = data.size;
				return result;
			}
			/**
			* Gets the stack value for `key`.
			*
			* @private
			* @name get
			* @memberOf Stack
			* @param {string} key The key of the value to get.
			* @returns {*} Returns the entry value.
			*/
			function stackGet(key) {
				return this.__data__.get(key);
			}
			/**
			* Checks if a stack value for `key` exists.
			*
			* @private
			* @name has
			* @memberOf Stack
			* @param {string} key The key of the entry to check.
			* @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
			*/
			function stackHas(key) {
				return this.__data__.has(key);
			}
			/**
			* Sets the stack `key` to `value`.
			*
			* @private
			* @name set
			* @memberOf Stack
			* @param {string} key The key of the value to set.
			* @param {*} value The value to set.
			* @returns {Object} Returns the stack cache instance.
			*/
			function stackSet(key, value) {
				var data = this.__data__;
				if (data instanceof ListCache) {
					var pairs = data.__data__;
					if (!Map || pairs.length < LARGE_ARRAY_SIZE - 1) {
						pairs.push([key, value]);
						this.size = ++data.size;
						return this;
					}
					data = this.__data__ = new MapCache(pairs);
				}
				data.set(key, value);
				this.size = data.size;
				return this;
			}
			Stack.prototype.clear = stackClear;
			Stack.prototype["delete"] = stackDelete;
			Stack.prototype.get = stackGet;
			Stack.prototype.has = stackHas;
			Stack.prototype.set = stackSet;
			/**
			* Creates an array of the enumerable property names of the array-like `value`.
			*
			* @private
			* @param {*} value The value to query.
			* @param {boolean} inherited Specify returning inherited property names.
			* @returns {Array} Returns the array of property names.
			*/
			function arrayLikeKeys(value, inherited) {
				var isArr = isArray(value), isArg = !isArr && isArguments(value), isBuff = !isArr && !isArg && isBuffer(value), isType = !isArr && !isArg && !isBuff && isTypedArray(value), skipIndexes = isArr || isArg || isBuff || isType, result = skipIndexes ? baseTimes(value.length, String) : [], length = result.length;
				for (var key in value) if ((inherited || hasOwnProperty.call(value, key)) && !(skipIndexes && (key == "length" || isBuff && (key == "offset" || key == "parent") || isType && (key == "buffer" || key == "byteLength" || key == "byteOffset") || isIndex(key, length)))) result.push(key);
				return result;
			}
			/**
			* A specialized version of `_.sample` for arrays.
			*
			* @private
			* @param {Array} array The array to sample.
			* @returns {*} Returns the random element.
			*/
			function arraySample(array) {
				var length = array.length;
				return length ? array[baseRandom(0, length - 1)] : undefined;
			}
			/**
			* A specialized version of `_.sampleSize` for arrays.
			*
			* @private
			* @param {Array} array The array to sample.
			* @param {number} n The number of elements to sample.
			* @returns {Array} Returns the random elements.
			*/
			function arraySampleSize(array, n) {
				return shuffleSelf(copyArray(array), baseClamp(n, 0, array.length));
			}
			/**
			* A specialized version of `_.shuffle` for arrays.
			*
			* @private
			* @param {Array} array The array to shuffle.
			* @returns {Array} Returns the new shuffled array.
			*/
			function arrayShuffle(array) {
				return shuffleSelf(copyArray(array));
			}
			/**
			* This function is like `assignValue` except that it doesn't assign
			* `undefined` values.
			*
			* @private
			* @param {Object} object The object to modify.
			* @param {string} key The key of the property to assign.
			* @param {*} value The value to assign.
			*/
			function assignMergeValue(object, key, value) {
				if (value !== undefined && !eq(object[key], value) || value === undefined && !(key in object)) baseAssignValue(object, key, value);
			}
			/**
			* Assigns `value` to `key` of `object` if the existing value is not equivalent
			* using [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
			* for equality comparisons.
			*
			* @private
			* @param {Object} object The object to modify.
			* @param {string} key The key of the property to assign.
			* @param {*} value The value to assign.
			*/
			function assignValue(object, key, value) {
				var objValue = object[key];
				if (!(hasOwnProperty.call(object, key) && eq(objValue, value)) || value === undefined && !(key in object)) baseAssignValue(object, key, value);
			}
			/**
			* Gets the index at which the `key` is found in `array` of key-value pairs.
			*
			* @private
			* @param {Array} array The array to inspect.
			* @param {*} key The key to search for.
			* @returns {number} Returns the index of the matched value, else `-1`.
			*/
			function assocIndexOf(array, key) {
				var length = array.length;
				while (length--) if (eq(array[length][0], key)) return length;
				return -1;
			}
			/**
			* Aggregates elements of `collection` on `accumulator` with keys transformed
			* by `iteratee` and values set by `setter`.
			*
			* @private
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} setter The function to set `accumulator` values.
			* @param {Function} iteratee The iteratee to transform keys.
			* @param {Object} accumulator The initial aggregated object.
			* @returns {Function} Returns `accumulator`.
			*/
			function baseAggregator(collection, setter, iteratee, accumulator) {
				baseEach(collection, function(value, key, collection) {
					setter(accumulator, value, iteratee(value), collection);
				});
				return accumulator;
			}
			/**
			* The base implementation of `_.assign` without support for multiple sources
			* or `customizer` functions.
			*
			* @private
			* @param {Object} object The destination object.
			* @param {Object} source The source object.
			* @returns {Object} Returns `object`.
			*/
			function baseAssign(object, source) {
				return object && copyObject(source, keys(source), object);
			}
			/**
			* The base implementation of `_.assignIn` without support for multiple sources
			* or `customizer` functions.
			*
			* @private
			* @param {Object} object The destination object.
			* @param {Object} source The source object.
			* @returns {Object} Returns `object`.
			*/
			function baseAssignIn(object, source) {
				return object && copyObject(source, keysIn(source), object);
			}
			/**
			* The base implementation of `assignValue` and `assignMergeValue` without
			* value checks.
			*
			* @private
			* @param {Object} object The object to modify.
			* @param {string} key The key of the property to assign.
			* @param {*} value The value to assign.
			*/
			function baseAssignValue(object, key, value) {
				if (key == "__proto__" && defineProperty) defineProperty(object, key, {
					"configurable": true,
					"enumerable": true,
					"value": value,
					"writable": true
				});
				else object[key] = value;
			}
			/**
			* The base implementation of `_.at` without support for individual paths.
			*
			* @private
			* @param {Object} object The object to iterate over.
			* @param {string[]} paths The property paths to pick.
			* @returns {Array} Returns the picked elements.
			*/
			function baseAt(object, paths) {
				var index = -1, length = paths.length, result = Array(length), skip = object == null;
				while (++index < length) result[index] = skip ? undefined : get(object, paths[index]);
				return result;
			}
			/**
			* The base implementation of `_.clamp` which doesn't coerce arguments.
			*
			* @private
			* @param {number} number The number to clamp.
			* @param {number} [lower] The lower bound.
			* @param {number} upper The upper bound.
			* @returns {number} Returns the clamped number.
			*/
			function baseClamp(number, lower, upper) {
				if (number === number) {
					if (upper !== undefined) number = number <= upper ? number : upper;
					if (lower !== undefined) number = number >= lower ? number : lower;
				}
				return number;
			}
			/**
			* The base implementation of `_.clone` and `_.cloneDeep` which tracks
			* traversed objects.
			*
			* @private
			* @param {*} value The value to clone.
			* @param {boolean} bitmask The bitmask flags.
			*  1 - Deep clone
			*  2 - Flatten inherited properties
			*  4 - Clone symbols
			* @param {Function} [customizer] The function to customize cloning.
			* @param {string} [key] The key of `value`.
			* @param {Object} [object] The parent object of `value`.
			* @param {Object} [stack] Tracks traversed objects and their clone counterparts.
			* @returns {*} Returns the cloned value.
			*/
			function baseClone(value, bitmask, customizer, key, object, stack) {
				var result, isDeep = bitmask & CLONE_DEEP_FLAG, isFlat = bitmask & CLONE_FLAT_FLAG, isFull = bitmask & CLONE_SYMBOLS_FLAG;
				if (customizer) result = object ? customizer(value, key, object, stack) : customizer(value);
				if (result !== undefined) return result;
				if (!isObject(value)) return value;
				var isArr = isArray(value);
				if (isArr) {
					result = initCloneArray(value);
					if (!isDeep) return copyArray(value, result);
				} else {
					var tag = getTag(value), isFunc = tag == funcTag || tag == genTag;
					if (isBuffer(value)) return cloneBuffer(value, isDeep);
					if (tag == objectTag || tag == argsTag || isFunc && !object) {
						result = isFlat || isFunc ? {} : initCloneObject(value);
						if (!isDeep) return isFlat ? copySymbolsIn(value, baseAssignIn(result, value)) : copySymbols(value, baseAssign(result, value));
					} else {
						if (!cloneableTags[tag]) return object ? value : {};
						result = initCloneByTag(value, tag, isDeep);
					}
				}
				stack || (stack = new Stack());
				var stacked = stack.get(value);
				if (stacked) return stacked;
				stack.set(value, result);
				if (isSet(value)) value.forEach(function(subValue) {
					result.add(baseClone(subValue, bitmask, customizer, subValue, value, stack));
				});
				else if (isMap(value)) value.forEach(function(subValue, key) {
					result.set(key, baseClone(subValue, bitmask, customizer, key, value, stack));
				});
				var props = isArr ? undefined : (isFull ? isFlat ? getAllKeysIn : getAllKeys : isFlat ? keysIn : keys)(value);
				arrayEach(props || value, function(subValue, key) {
					if (props) {
						key = subValue;
						subValue = value[key];
					}
					assignValue(result, key, baseClone(subValue, bitmask, customizer, key, value, stack));
				});
				return result;
			}
			/**
			* The base implementation of `_.conforms` which doesn't clone `source`.
			*
			* @private
			* @param {Object} source The object of property predicates to conform to.
			* @returns {Function} Returns the new spec function.
			*/
			function baseConforms(source) {
				var props = keys(source);
				return function(object) {
					return baseConformsTo(object, source, props);
				};
			}
			/**
			* The base implementation of `_.conformsTo` which accepts `props` to check.
			*
			* @private
			* @param {Object} object The object to inspect.
			* @param {Object} source The object of property predicates to conform to.
			* @returns {boolean} Returns `true` if `object` conforms, else `false`.
			*/
			function baseConformsTo(object, source, props) {
				var length = props.length;
				if (object == null) return !length;
				object = Object(object);
				while (length--) {
					var key = props[length], predicate = source[key], value = object[key];
					if (value === undefined && !(key in object) || !predicate(value)) return false;
				}
				return true;
			}
			/**
			* The base implementation of `_.delay` and `_.defer` which accepts `args`
			* to provide to `func`.
			*
			* @private
			* @param {Function} func The function to delay.
			* @param {number} wait The number of milliseconds to delay invocation.
			* @param {Array} args The arguments to provide to `func`.
			* @returns {number|Object} Returns the timer id or timeout object.
			*/
			function baseDelay(func, wait, args) {
				if (typeof func != "function") throw new TypeError(FUNC_ERROR_TEXT);
				return setTimeout(function() {
					func.apply(undefined, args);
				}, wait);
			}
			/**
			* The base implementation of methods like `_.difference` without support
			* for excluding multiple arrays or iteratee shorthands.
			*
			* @private
			* @param {Array} array The array to inspect.
			* @param {Array} values The values to exclude.
			* @param {Function} [iteratee] The iteratee invoked per element.
			* @param {Function} [comparator] The comparator invoked per element.
			* @returns {Array} Returns the new array of filtered values.
			*/
			function baseDifference(array, values, iteratee, comparator) {
				var index = -1, includes = arrayIncludes, isCommon = true, length = array.length, result = [], valuesLength = values.length;
				if (!length) return result;
				if (iteratee) values = arrayMap(values, baseUnary(iteratee));
				if (comparator) {
					includes = arrayIncludesWith;
					isCommon = false;
				} else if (values.length >= LARGE_ARRAY_SIZE) {
					includes = cacheHas;
					isCommon = false;
					values = new SetCache(values);
				}
				outer: while (++index < length) {
					var value = array[index], computed = iteratee == null ? value : iteratee(value);
					value = comparator || value !== 0 ? value : 0;
					if (isCommon && computed === computed) {
						var valuesIndex = valuesLength;
						while (valuesIndex--) if (values[valuesIndex] === computed) continue outer;
						result.push(value);
					} else if (!includes(values, computed, comparator)) result.push(value);
				}
				return result;
			}
			/**
			* The base implementation of `_.forEach` without support for iteratee shorthands.
			*
			* @private
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} iteratee The function invoked per iteration.
			* @returns {Array|Object} Returns `collection`.
			*/
			var baseEach = createBaseEach(baseForOwn);
			/**
			* The base implementation of `_.forEachRight` without support for iteratee shorthands.
			*
			* @private
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} iteratee The function invoked per iteration.
			* @returns {Array|Object} Returns `collection`.
			*/
			var baseEachRight = createBaseEach(baseForOwnRight, true);
			/**
			* The base implementation of `_.every` without support for iteratee shorthands.
			*
			* @private
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} predicate The function invoked per iteration.
			* @returns {boolean} Returns `true` if all elements pass the predicate check,
			*  else `false`
			*/
			function baseEvery(collection, predicate) {
				var result = true;
				baseEach(collection, function(value, index, collection) {
					result = !!predicate(value, index, collection);
					return result;
				});
				return result;
			}
			/**
			* The base implementation of methods like `_.max` and `_.min` which accepts a
			* `comparator` to determine the extremum value.
			*
			* @private
			* @param {Array} array The array to iterate over.
			* @param {Function} iteratee The iteratee invoked per iteration.
			* @param {Function} comparator The comparator used to compare values.
			* @returns {*} Returns the extremum value.
			*/
			function baseExtremum(array, iteratee, comparator) {
				var index = -1, length = array.length;
				while (++index < length) {
					var value = array[index], current = iteratee(value);
					if (current != null && (computed === undefined ? current === current && !isSymbol(current) : comparator(current, computed))) var computed = current, result = value;
				}
				return result;
			}
			/**
			* The base implementation of `_.fill` without an iteratee call guard.
			*
			* @private
			* @param {Array} array The array to fill.
			* @param {*} value The value to fill `array` with.
			* @param {number} [start=0] The start position.
			* @param {number} [end=array.length] The end position.
			* @returns {Array} Returns `array`.
			*/
			function baseFill(array, value, start, end) {
				var length = array.length;
				start = toInteger(start);
				if (start < 0) start = -start > length ? 0 : length + start;
				end = end === undefined || end > length ? length : toInteger(end);
				if (end < 0) end += length;
				end = start > end ? 0 : toLength(end);
				while (start < end) array[start++] = value;
				return array;
			}
			/**
			* The base implementation of `_.filter` without support for iteratee shorthands.
			*
			* @private
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} predicate The function invoked per iteration.
			* @returns {Array} Returns the new filtered array.
			*/
			function baseFilter(collection, predicate) {
				var result = [];
				baseEach(collection, function(value, index, collection) {
					if (predicate(value, index, collection)) result.push(value);
				});
				return result;
			}
			/**
			* The base implementation of `_.flatten` with support for restricting flattening.
			*
			* @private
			* @param {Array} array The array to flatten.
			* @param {number} depth The maximum recursion depth.
			* @param {boolean} [predicate=isFlattenable] The function invoked per iteration.
			* @param {boolean} [isStrict] Restrict to values that pass `predicate` checks.
			* @param {Array} [result=[]] The initial result value.
			* @returns {Array} Returns the new flattened array.
			*/
			function baseFlatten(array, depth, predicate, isStrict, result) {
				var index = -1, length = array.length;
				predicate || (predicate = isFlattenable);
				result || (result = []);
				while (++index < length) {
					var value = array[index];
					if (depth > 0 && predicate(value)) if (depth > 1) baseFlatten(value, depth - 1, predicate, isStrict, result);
					else arrayPush(result, value);
					else if (!isStrict) result[result.length] = value;
				}
				return result;
			}
			/**
			* The base implementation of `baseForOwn` which iterates over `object`
			* properties returned by `keysFunc` and invokes `iteratee` for each property.
			* Iteratee functions may exit iteration early by explicitly returning `false`.
			*
			* @private
			* @param {Object} object The object to iterate over.
			* @param {Function} iteratee The function invoked per iteration.
			* @param {Function} keysFunc The function to get the keys of `object`.
			* @returns {Object} Returns `object`.
			*/
			var baseFor = createBaseFor();
			/**
			* This function is like `baseFor` except that it iterates over properties
			* in the opposite order.
			*
			* @private
			* @param {Object} object The object to iterate over.
			* @param {Function} iteratee The function invoked per iteration.
			* @param {Function} keysFunc The function to get the keys of `object`.
			* @returns {Object} Returns `object`.
			*/
			var baseForRight = createBaseFor(true);
			/**
			* The base implementation of `_.forOwn` without support for iteratee shorthands.
			*
			* @private
			* @param {Object} object The object to iterate over.
			* @param {Function} iteratee The function invoked per iteration.
			* @returns {Object} Returns `object`.
			*/
			function baseForOwn(object, iteratee) {
				return object && baseFor(object, iteratee, keys);
			}
			/**
			* The base implementation of `_.forOwnRight` without support for iteratee shorthands.
			*
			* @private
			* @param {Object} object The object to iterate over.
			* @param {Function} iteratee The function invoked per iteration.
			* @returns {Object} Returns `object`.
			*/
			function baseForOwnRight(object, iteratee) {
				return object && baseForRight(object, iteratee, keys);
			}
			/**
			* The base implementation of `_.functions` which creates an array of
			* `object` function property names filtered from `props`.
			*
			* @private
			* @param {Object} object The object to inspect.
			* @param {Array} props The property names to filter.
			* @returns {Array} Returns the function names.
			*/
			function baseFunctions(object, props) {
				return arrayFilter(props, function(key) {
					return isFunction(object[key]);
				});
			}
			/**
			* The base implementation of `_.get` without support for default values.
			*
			* @private
			* @param {Object} object The object to query.
			* @param {Array|string} path The path of the property to get.
			* @returns {*} Returns the resolved value.
			*/
			function baseGet(object, path) {
				path = castPath(path, object);
				var index = 0, length = path.length;
				while (object != null && index < length) object = object[toKey(path[index++])];
				return index && index == length ? object : undefined;
			}
			/**
			* The base implementation of `getAllKeys` and `getAllKeysIn` which uses
			* `keysFunc` and `symbolsFunc` to get the enumerable property names and
			* symbols of `object`.
			*
			* @private
			* @param {Object} object The object to query.
			* @param {Function} keysFunc The function to get the keys of `object`.
			* @param {Function} symbolsFunc The function to get the symbols of `object`.
			* @returns {Array} Returns the array of property names and symbols.
			*/
			function baseGetAllKeys(object, keysFunc, symbolsFunc) {
				var result = keysFunc(object);
				return isArray(object) ? result : arrayPush(result, symbolsFunc(object));
			}
			/**
			* The base implementation of `getTag` without fallbacks for buggy environments.
			*
			* @private
			* @param {*} value The value to query.
			* @returns {string} Returns the `toStringTag`.
			*/
			function baseGetTag(value) {
				if (value == null) return value === undefined ? undefinedTag : nullTag;
				return symToStringTag && symToStringTag in Object(value) ? getRawTag(value) : objectToString(value);
			}
			/**
			* The base implementation of `_.gt` which doesn't coerce arguments.
			*
			* @private
			* @param {*} value The value to compare.
			* @param {*} other The other value to compare.
			* @returns {boolean} Returns `true` if `value` is greater than `other`,
			*  else `false`.
			*/
			function baseGt(value, other) {
				return value > other;
			}
			/**
			* The base implementation of `_.has` without support for deep paths.
			*
			* @private
			* @param {Object} [object] The object to query.
			* @param {Array|string} key The key to check.
			* @returns {boolean} Returns `true` if `key` exists, else `false`.
			*/
			function baseHas(object, key) {
				return object != null && hasOwnProperty.call(object, key);
			}
			/**
			* The base implementation of `_.hasIn` without support for deep paths.
			*
			* @private
			* @param {Object} [object] The object to query.
			* @param {Array|string} key The key to check.
			* @returns {boolean} Returns `true` if `key` exists, else `false`.
			*/
			function baseHasIn(object, key) {
				return object != null && key in Object(object);
			}
			/**
			* The base implementation of `_.inRange` which doesn't coerce arguments.
			*
			* @private
			* @param {number} number The number to check.
			* @param {number} start The start of the range.
			* @param {number} end The end of the range.
			* @returns {boolean} Returns `true` if `number` is in the range, else `false`.
			*/
			function baseInRange(number, start, end) {
				return number >= nativeMin(start, end) && number < nativeMax(start, end);
			}
			/**
			* The base implementation of methods like `_.intersection`, without support
			* for iteratee shorthands, that accepts an array of arrays to inspect.
			*
			* @private
			* @param {Array} arrays The arrays to inspect.
			* @param {Function} [iteratee] The iteratee invoked per element.
			* @param {Function} [comparator] The comparator invoked per element.
			* @returns {Array} Returns the new array of shared values.
			*/
			function baseIntersection(arrays, iteratee, comparator) {
				var includes = comparator ? arrayIncludesWith : arrayIncludes, length = arrays[0].length, othLength = arrays.length, othIndex = othLength, caches = Array(othLength), maxLength = Infinity, result = [];
				while (othIndex--) {
					var array = arrays[othIndex];
					if (othIndex && iteratee) array = arrayMap(array, baseUnary(iteratee));
					maxLength = nativeMin(array.length, maxLength);
					caches[othIndex] = !comparator && (iteratee || length >= 120 && array.length >= 120) ? new SetCache(othIndex && array) : undefined;
				}
				array = arrays[0];
				var index = -1, seen = caches[0];
				outer: while (++index < length && result.length < maxLength) {
					var value = array[index], computed = iteratee ? iteratee(value) : value;
					value = comparator || value !== 0 ? value : 0;
					if (!(seen ? cacheHas(seen, computed) : includes(result, computed, comparator))) {
						othIndex = othLength;
						while (--othIndex) {
							var cache = caches[othIndex];
							if (!(cache ? cacheHas(cache, computed) : includes(arrays[othIndex], computed, comparator))) continue outer;
						}
						if (seen) seen.push(computed);
						result.push(value);
					}
				}
				return result;
			}
			/**
			* The base implementation of `_.invert` and `_.invertBy` which inverts
			* `object` with values transformed by `iteratee` and set by `setter`.
			*
			* @private
			* @param {Object} object The object to iterate over.
			* @param {Function} setter The function to set `accumulator` values.
			* @param {Function} iteratee The iteratee to transform values.
			* @param {Object} accumulator The initial inverted object.
			* @returns {Function} Returns `accumulator`.
			*/
			function baseInverter(object, setter, iteratee, accumulator) {
				baseForOwn(object, function(value, key, object) {
					setter(accumulator, iteratee(value), key, object);
				});
				return accumulator;
			}
			/**
			* The base implementation of `_.invoke` without support for individual
			* method arguments.
			*
			* @private
			* @param {Object} object The object to query.
			* @param {Array|string} path The path of the method to invoke.
			* @param {Array} args The arguments to invoke the method with.
			* @returns {*} Returns the result of the invoked method.
			*/
			function baseInvoke(object, path, args) {
				path = castPath(path, object);
				object = parent(object, path);
				var func = object == null ? object : object[toKey(last(path))];
				return func == null ? undefined : apply(func, object, args);
			}
			/**
			* The base implementation of `_.isArguments`.
			*
			* @private
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is an `arguments` object,
			*/
			function baseIsArguments(value) {
				return isObjectLike(value) && baseGetTag(value) == argsTag;
			}
			/**
			* The base implementation of `_.isArrayBuffer` without Node.js optimizations.
			*
			* @private
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is an array buffer, else `false`.
			*/
			function baseIsArrayBuffer(value) {
				return isObjectLike(value) && baseGetTag(value) == arrayBufferTag;
			}
			/**
			* The base implementation of `_.isDate` without Node.js optimizations.
			*
			* @private
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a date object, else `false`.
			*/
			function baseIsDate(value) {
				return isObjectLike(value) && baseGetTag(value) == dateTag;
			}
			/**
			* The base implementation of `_.isEqual` which supports partial comparisons
			* and tracks traversed objects.
			*
			* @private
			* @param {*} value The value to compare.
			* @param {*} other The other value to compare.
			* @param {boolean} bitmask The bitmask flags.
			*  1 - Unordered comparison
			*  2 - Partial comparison
			* @param {Function} [customizer] The function to customize comparisons.
			* @param {Object} [stack] Tracks traversed `value` and `other` objects.
			* @returns {boolean} Returns `true` if the values are equivalent, else `false`.
			*/
			function baseIsEqual(value, other, bitmask, customizer, stack) {
				if (value === other) return true;
				if (value == null || other == null || !isObjectLike(value) && !isObjectLike(other)) return value !== value && other !== other;
				return baseIsEqualDeep(value, other, bitmask, customizer, baseIsEqual, stack);
			}
			/**
			* A specialized version of `baseIsEqual` for arrays and objects which performs
			* deep comparisons and tracks traversed objects enabling objects with circular
			* references to be compared.
			*
			* @private
			* @param {Object} object The object to compare.
			* @param {Object} other The other object to compare.
			* @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
			* @param {Function} customizer The function to customize comparisons.
			* @param {Function} equalFunc The function to determine equivalents of values.
			* @param {Object} [stack] Tracks traversed `object` and `other` objects.
			* @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
			*/
			function baseIsEqualDeep(object, other, bitmask, customizer, equalFunc, stack) {
				var objIsArr = isArray(object), othIsArr = isArray(other), objTag = objIsArr ? arrayTag : getTag(object), othTag = othIsArr ? arrayTag : getTag(other);
				objTag = objTag == argsTag ? objectTag : objTag;
				othTag = othTag == argsTag ? objectTag : othTag;
				var objIsObj = objTag == objectTag, othIsObj = othTag == objectTag, isSameTag = objTag == othTag;
				if (isSameTag && isBuffer(object)) {
					if (!isBuffer(other)) return false;
					objIsArr = true;
					objIsObj = false;
				}
				if (isSameTag && !objIsObj) {
					stack || (stack = new Stack());
					return objIsArr || isTypedArray(object) ? equalArrays(object, other, bitmask, customizer, equalFunc, stack) : equalByTag(object, other, objTag, bitmask, customizer, equalFunc, stack);
				}
				if (!(bitmask & COMPARE_PARTIAL_FLAG)) {
					var objIsWrapped = objIsObj && hasOwnProperty.call(object, "__wrapped__"), othIsWrapped = othIsObj && hasOwnProperty.call(other, "__wrapped__");
					if (objIsWrapped || othIsWrapped) {
						var objUnwrapped = objIsWrapped ? object.value() : object, othUnwrapped = othIsWrapped ? other.value() : other;
						stack || (stack = new Stack());
						return equalFunc(objUnwrapped, othUnwrapped, bitmask, customizer, stack);
					}
				}
				if (!isSameTag) return false;
				stack || (stack = new Stack());
				return equalObjects(object, other, bitmask, customizer, equalFunc, stack);
			}
			/**
			* The base implementation of `_.isMap` without Node.js optimizations.
			*
			* @private
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a map, else `false`.
			*/
			function baseIsMap(value) {
				return isObjectLike(value) && getTag(value) == mapTag;
			}
			/**
			* The base implementation of `_.isMatch` without support for iteratee shorthands.
			*
			* @private
			* @param {Object} object The object to inspect.
			* @param {Object} source The object of property values to match.
			* @param {Array} matchData The property names, values, and compare flags to match.
			* @param {Function} [customizer] The function to customize comparisons.
			* @returns {boolean} Returns `true` if `object` is a match, else `false`.
			*/
			function baseIsMatch(object, source, matchData, customizer) {
				var index = matchData.length, length = index, noCustomizer = !customizer;
				if (object == null) return !length;
				object = Object(object);
				while (index--) {
					var data = matchData[index];
					if (noCustomizer && data[2] ? data[1] !== object[data[0]] : !(data[0] in object)) return false;
				}
				while (++index < length) {
					data = matchData[index];
					var key = data[0], objValue = object[key], srcValue = data[1];
					if (noCustomizer && data[2]) {
						if (objValue === undefined && !(key in object)) return false;
					} else {
						var stack = new Stack();
						if (customizer) var result = customizer(objValue, srcValue, key, object, source, stack);
						if (!(result === undefined ? baseIsEqual(srcValue, objValue, COMPARE_PARTIAL_FLAG | COMPARE_UNORDERED_FLAG, customizer, stack) : result)) return false;
					}
				}
				return true;
			}
			/**
			* The base implementation of `_.isNative` without bad shim checks.
			*
			* @private
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a native function,
			*  else `false`.
			*/
			function baseIsNative(value) {
				if (!isObject(value) || isMasked(value)) return false;
				return (isFunction(value) ? reIsNative : reIsHostCtor).test(toSource(value));
			}
			/**
			* The base implementation of `_.isRegExp` without Node.js optimizations.
			*
			* @private
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a regexp, else `false`.
			*/
			function baseIsRegExp(value) {
				return isObjectLike(value) && baseGetTag(value) == regexpTag;
			}
			/**
			* The base implementation of `_.isSet` without Node.js optimizations.
			*
			* @private
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a set, else `false`.
			*/
			function baseIsSet(value) {
				return isObjectLike(value) && getTag(value) == setTag;
			}
			/**
			* The base implementation of `_.isTypedArray` without Node.js optimizations.
			*
			* @private
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
			*/
			function baseIsTypedArray(value) {
				return isObjectLike(value) && isLength(value.length) && !!typedArrayTags[baseGetTag(value)];
			}
			/**
			* The base implementation of `_.iteratee`.
			*
			* @private
			* @param {*} [value=_.identity] The value to convert to an iteratee.
			* @returns {Function} Returns the iteratee.
			*/
			function baseIteratee(value) {
				if (typeof value == "function") return value;
				if (value == null) return identity;
				if (typeof value == "object") return isArray(value) ? baseMatchesProperty(value[0], value[1]) : baseMatches(value);
				return property(value);
			}
			/**
			* The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
			*
			* @private
			* @param {Object} object The object to query.
			* @returns {Array} Returns the array of property names.
			*/
			function baseKeys(object) {
				if (!isPrototype(object)) return nativeKeys(object);
				var result = [];
				for (var key in Object(object)) if (hasOwnProperty.call(object, key) && key != "constructor") result.push(key);
				return result;
			}
			/**
			* The base implementation of `_.keysIn` which doesn't treat sparse arrays as dense.
			*
			* @private
			* @param {Object} object The object to query.
			* @returns {Array} Returns the array of property names.
			*/
			function baseKeysIn(object) {
				if (!isObject(object)) return nativeKeysIn(object);
				var isProto = isPrototype(object), result = [];
				for (var key in object) if (!(key == "constructor" && (isProto || !hasOwnProperty.call(object, key)))) result.push(key);
				return result;
			}
			/**
			* The base implementation of `_.lt` which doesn't coerce arguments.
			*
			* @private
			* @param {*} value The value to compare.
			* @param {*} other The other value to compare.
			* @returns {boolean} Returns `true` if `value` is less than `other`,
			*  else `false`.
			*/
			function baseLt(value, other) {
				return value < other;
			}
			/**
			* The base implementation of `_.map` without support for iteratee shorthands.
			*
			* @private
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} iteratee The function invoked per iteration.
			* @returns {Array} Returns the new mapped array.
			*/
			function baseMap(collection, iteratee) {
				var index = -1, result = isArrayLike(collection) ? Array(collection.length) : [];
				baseEach(collection, function(value, key, collection) {
					result[++index] = iteratee(value, key, collection);
				});
				return result;
			}
			/**
			* The base implementation of `_.matches` which doesn't clone `source`.
			*
			* @private
			* @param {Object} source The object of property values to match.
			* @returns {Function} Returns the new spec function.
			*/
			function baseMatches(source) {
				var matchData = getMatchData(source);
				if (matchData.length == 1 && matchData[0][2]) return matchesStrictComparable(matchData[0][0], matchData[0][1]);
				return function(object) {
					return object === source || baseIsMatch(object, source, matchData);
				};
			}
			/**
			* The base implementation of `_.matchesProperty` which doesn't clone `srcValue`.
			*
			* @private
			* @param {string} path The path of the property to get.
			* @param {*} srcValue The value to match.
			* @returns {Function} Returns the new spec function.
			*/
			function baseMatchesProperty(path, srcValue) {
				if (isKey(path) && isStrictComparable(srcValue)) return matchesStrictComparable(toKey(path), srcValue);
				return function(object) {
					var objValue = get(object, path);
					return objValue === undefined && objValue === srcValue ? hasIn(object, path) : baseIsEqual(srcValue, objValue, COMPARE_PARTIAL_FLAG | COMPARE_UNORDERED_FLAG);
				};
			}
			/**
			* The base implementation of `_.merge` without support for multiple sources.
			*
			* @private
			* @param {Object} object The destination object.
			* @param {Object} source The source object.
			* @param {number} srcIndex The index of `source`.
			* @param {Function} [customizer] The function to customize merged values.
			* @param {Object} [stack] Tracks traversed source values and their merged
			*  counterparts.
			*/
			function baseMerge(object, source, srcIndex, customizer, stack) {
				if (object === source) return;
				baseFor(source, function(srcValue, key) {
					stack || (stack = new Stack());
					if (isObject(srcValue)) baseMergeDeep(object, source, key, srcIndex, baseMerge, customizer, stack);
					else {
						var newValue = customizer ? customizer(safeGet(object, key), srcValue, key + "", object, source, stack) : undefined;
						if (newValue === undefined) newValue = srcValue;
						assignMergeValue(object, key, newValue);
					}
				}, keysIn);
			}
			/**
			* A specialized version of `baseMerge` for arrays and objects which performs
			* deep merges and tracks traversed objects enabling objects with circular
			* references to be merged.
			*
			* @private
			* @param {Object} object The destination object.
			* @param {Object} source The source object.
			* @param {string} key The key of the value to merge.
			* @param {number} srcIndex The index of `source`.
			* @param {Function} mergeFunc The function to merge values.
			* @param {Function} [customizer] The function to customize assigned values.
			* @param {Object} [stack] Tracks traversed source values and their merged
			*  counterparts.
			*/
			function baseMergeDeep(object, source, key, srcIndex, mergeFunc, customizer, stack) {
				var objValue = safeGet(object, key), srcValue = safeGet(source, key), stacked = stack.get(srcValue);
				if (stacked) {
					assignMergeValue(object, key, stacked);
					return;
				}
				var newValue = customizer ? customizer(objValue, srcValue, key + "", object, source, stack) : undefined;
				var isCommon = newValue === undefined;
				if (isCommon) {
					var isArr = isArray(srcValue), isBuff = !isArr && isBuffer(srcValue), isTyped = !isArr && !isBuff && isTypedArray(srcValue);
					newValue = srcValue;
					if (isArr || isBuff || isTyped) if (isArray(objValue)) newValue = objValue;
					else if (isArrayLikeObject(objValue)) newValue = copyArray(objValue);
					else if (isBuff) {
						isCommon = false;
						newValue = cloneBuffer(srcValue, true);
					} else if (isTyped) {
						isCommon = false;
						newValue = cloneTypedArray(srcValue, true);
					} else newValue = [];
					else if (isPlainObject(srcValue) || isArguments(srcValue)) {
						newValue = objValue;
						if (isArguments(objValue)) newValue = toPlainObject(objValue);
						else if (!isObject(objValue) || isFunction(objValue)) newValue = initCloneObject(srcValue);
					} else isCommon = false;
				}
				if (isCommon) {
					stack.set(srcValue, newValue);
					mergeFunc(newValue, srcValue, srcIndex, customizer, stack);
					stack["delete"](srcValue);
				}
				assignMergeValue(object, key, newValue);
			}
			/**
			* The base implementation of `_.nth` which doesn't coerce arguments.
			*
			* @private
			* @param {Array} array The array to query.
			* @param {number} n The index of the element to return.
			* @returns {*} Returns the nth element of `array`.
			*/
			function baseNth(array, n) {
				var length = array.length;
				if (!length) return;
				n += n < 0 ? length : 0;
				return isIndex(n, length) ? array[n] : undefined;
			}
			/**
			* The base implementation of `_.orderBy` without param guards.
			*
			* @private
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function[]|Object[]|string[]} iteratees The iteratees to sort by.
			* @param {string[]} orders The sort orders of `iteratees`.
			* @returns {Array} Returns the new sorted array.
			*/
			function baseOrderBy(collection, iteratees, orders) {
				if (iteratees.length) iteratees = arrayMap(iteratees, function(iteratee) {
					if (isArray(iteratee)) return function(value) {
						return baseGet(value, iteratee.length === 1 ? iteratee[0] : iteratee);
					};
					return iteratee;
				});
				else iteratees = [identity];
				var index = -1;
				iteratees = arrayMap(iteratees, baseUnary(getIteratee()));
				return baseSortBy(baseMap(collection, function(value, key, collection) {
					return {
						"criteria": arrayMap(iteratees, function(iteratee) {
							return iteratee(value);
						}),
						"index": ++index,
						"value": value
					};
				}), function(object, other) {
					return compareMultiple(object, other, orders);
				});
			}
			/**
			* The base implementation of `_.pick` without support for individual
			* property identifiers.
			*
			* @private
			* @param {Object} object The source object.
			* @param {string[]} paths The property paths to pick.
			* @returns {Object} Returns the new object.
			*/
			function basePick(object, paths) {
				return basePickBy(object, paths, function(value, path) {
					return hasIn(object, path);
				});
			}
			/**
			* The base implementation of  `_.pickBy` without support for iteratee shorthands.
			*
			* @private
			* @param {Object} object The source object.
			* @param {string[]} paths The property paths to pick.
			* @param {Function} predicate The function invoked per property.
			* @returns {Object} Returns the new object.
			*/
			function basePickBy(object, paths, predicate) {
				var index = -1, length = paths.length, result = {};
				while (++index < length) {
					var path = paths[index], value = baseGet(object, path);
					if (predicate(value, path)) baseSet(result, castPath(path, object), value);
				}
				return result;
			}
			/**
			* A specialized version of `baseProperty` which supports deep paths.
			*
			* @private
			* @param {Array|string} path The path of the property to get.
			* @returns {Function} Returns the new accessor function.
			*/
			function basePropertyDeep(path) {
				return function(object) {
					return baseGet(object, path);
				};
			}
			/**
			* The base implementation of `_.pullAllBy` without support for iteratee
			* shorthands.
			*
			* @private
			* @param {Array} array The array to modify.
			* @param {Array} values The values to remove.
			* @param {Function} [iteratee] The iteratee invoked per element.
			* @param {Function} [comparator] The comparator invoked per element.
			* @returns {Array} Returns `array`.
			*/
			function basePullAll(array, values, iteratee, comparator) {
				var indexOf = comparator ? baseIndexOfWith : baseIndexOf, index = -1, length = values.length, seen = array;
				if (array === values) values = copyArray(values);
				if (iteratee) seen = arrayMap(array, baseUnary(iteratee));
				while (++index < length) {
					var fromIndex = 0, value = values[index], computed = iteratee ? iteratee(value) : value;
					while ((fromIndex = indexOf(seen, computed, fromIndex, comparator)) > -1) {
						if (seen !== array) splice.call(seen, fromIndex, 1);
						splice.call(array, fromIndex, 1);
					}
				}
				return array;
			}
			/**
			* The base implementation of `_.pullAt` without support for individual
			* indexes or capturing the removed elements.
			*
			* @private
			* @param {Array} array The array to modify.
			* @param {number[]} indexes The indexes of elements to remove.
			* @returns {Array} Returns `array`.
			*/
			function basePullAt(array, indexes) {
				var length = array ? indexes.length : 0, lastIndex = length - 1;
				while (length--) {
					var index = indexes[length];
					if (length == lastIndex || index !== previous) {
						var previous = index;
						if (isIndex(index)) splice.call(array, index, 1);
						else baseUnset(array, index);
					}
				}
				return array;
			}
			/**
			* The base implementation of `_.random` without support for returning
			* floating-point numbers.
			*
			* @private
			* @param {number} lower The lower bound.
			* @param {number} upper The upper bound.
			* @returns {number} Returns the random number.
			*/
			function baseRandom(lower, upper) {
				return lower + nativeFloor(nativeRandom() * (upper - lower + 1));
			}
			/**
			* The base implementation of `_.range` and `_.rangeRight` which doesn't
			* coerce arguments.
			*
			* @private
			* @param {number} start The start of the range.
			* @param {number} end The end of the range.
			* @param {number} step The value to increment or decrement by.
			* @param {boolean} [fromRight] Specify iterating from right to left.
			* @returns {Array} Returns the range of numbers.
			*/
			function baseRange(start, end, step, fromRight) {
				var index = -1, length = nativeMax(nativeCeil((end - start) / (step || 1)), 0), result = Array(length);
				while (length--) {
					result[fromRight ? length : ++index] = start;
					start += step;
				}
				return result;
			}
			/**
			* The base implementation of `_.repeat` which doesn't coerce arguments.
			*
			* @private
			* @param {string} string The string to repeat.
			* @param {number} n The number of times to repeat the string.
			* @returns {string} Returns the repeated string.
			*/
			function baseRepeat(string, n) {
				var result = "";
				if (!string || n < 1 || n > MAX_SAFE_INTEGER) return result;
				do {
					if (n % 2) result += string;
					n = nativeFloor(n / 2);
					if (n) string += string;
				} while (n);
				return result;
			}
			/**
			* The base implementation of `_.rest` which doesn't validate or coerce arguments.
			*
			* @private
			* @param {Function} func The function to apply a rest parameter to.
			* @param {number} [start=func.length-1] The start position of the rest parameter.
			* @returns {Function} Returns the new function.
			*/
			function baseRest(func, start) {
				return setToString(overRest(func, start, identity), func + "");
			}
			/**
			* The base implementation of `_.sample`.
			*
			* @private
			* @param {Array|Object} collection The collection to sample.
			* @returns {*} Returns the random element.
			*/
			function baseSample(collection) {
				return arraySample(values(collection));
			}
			/**
			* The base implementation of `_.sampleSize` without param guards.
			*
			* @private
			* @param {Array|Object} collection The collection to sample.
			* @param {number} n The number of elements to sample.
			* @returns {Array} Returns the random elements.
			*/
			function baseSampleSize(collection, n) {
				var array = values(collection);
				return shuffleSelf(array, baseClamp(n, 0, array.length));
			}
			/**
			* The base implementation of `_.set`.
			*
			* @private
			* @param {Object} object The object to modify.
			* @param {Array|string} path The path of the property to set.
			* @param {*} value The value to set.
			* @param {Function} [customizer] The function to customize path creation.
			* @returns {Object} Returns `object`.
			*/
			function baseSet(object, path, value, customizer) {
				if (!isObject(object)) return object;
				path = castPath(path, object);
				var index = -1, length = path.length, lastIndex = length - 1, nested = object;
				while (nested != null && ++index < length) {
					var key = toKey(path[index]), newValue = value;
					if (key === "__proto__" || key === "constructor" || key === "prototype") return object;
					if (index != lastIndex) {
						var objValue = nested[key];
						newValue = customizer ? customizer(objValue, key, nested) : undefined;
						if (newValue === undefined) newValue = isObject(objValue) ? objValue : isIndex(path[index + 1]) ? [] : {};
					}
					assignValue(nested, key, newValue);
					nested = nested[key];
				}
				return object;
			}
			/**
			* The base implementation of `setData` without support for hot loop shorting.
			*
			* @private
			* @param {Function} func The function to associate metadata with.
			* @param {*} data The metadata.
			* @returns {Function} Returns `func`.
			*/
			var baseSetData = !metaMap ? identity : function(func, data) {
				metaMap.set(func, data);
				return func;
			};
			/**
			* The base implementation of `setToString` without support for hot loop shorting.
			*
			* @private
			* @param {Function} func The function to modify.
			* @param {Function} string The `toString` result.
			* @returns {Function} Returns `func`.
			*/
			var baseSetToString = !defineProperty ? identity : function(func, string) {
				return defineProperty(func, "toString", {
					"configurable": true,
					"enumerable": false,
					"value": constant(string),
					"writable": true
				});
			};
			/**
			* The base implementation of `_.shuffle`.
			*
			* @private
			* @param {Array|Object} collection The collection to shuffle.
			* @returns {Array} Returns the new shuffled array.
			*/
			function baseShuffle(collection) {
				return shuffleSelf(values(collection));
			}
			/**
			* The base implementation of `_.slice` without an iteratee call guard.
			*
			* @private
			* @param {Array} array The array to slice.
			* @param {number} [start=0] The start position.
			* @param {number} [end=array.length] The end position.
			* @returns {Array} Returns the slice of `array`.
			*/
			function baseSlice(array, start, end) {
				var index = -1, length = array.length;
				if (start < 0) start = -start > length ? 0 : length + start;
				end = end > length ? length : end;
				if (end < 0) end += length;
				length = start > end ? 0 : end - start >>> 0;
				start >>>= 0;
				var result = Array(length);
				while (++index < length) result[index] = array[index + start];
				return result;
			}
			/**
			* The base implementation of `_.some` without support for iteratee shorthands.
			*
			* @private
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} predicate The function invoked per iteration.
			* @returns {boolean} Returns `true` if any element passes the predicate check,
			*  else `false`.
			*/
			function baseSome(collection, predicate) {
				var result;
				baseEach(collection, function(value, index, collection) {
					result = predicate(value, index, collection);
					return !result;
				});
				return !!result;
			}
			/**
			* The base implementation of `_.sortedIndex` and `_.sortedLastIndex` which
			* performs a binary search of `array` to determine the index at which `value`
			* should be inserted into `array` in order to maintain its sort order.
			*
			* @private
			* @param {Array} array The sorted array to inspect.
			* @param {*} value The value to evaluate.
			* @param {boolean} [retHighest] Specify returning the highest qualified index.
			* @returns {number} Returns the index at which `value` should be inserted
			*  into `array`.
			*/
			function baseSortedIndex(array, value, retHighest) {
				var low = 0, high = array == null ? low : array.length;
				if (typeof value == "number" && value === value && high <= HALF_MAX_ARRAY_LENGTH) {
					while (low < high) {
						var mid = low + high >>> 1, computed = array[mid];
						if (computed !== null && !isSymbol(computed) && (retHighest ? computed <= value : computed < value)) low = mid + 1;
						else high = mid;
					}
					return high;
				}
				return baseSortedIndexBy(array, value, identity, retHighest);
			}
			/**
			* The base implementation of `_.sortedIndexBy` and `_.sortedLastIndexBy`
			* which invokes `iteratee` for `value` and each element of `array` to compute
			* their sort ranking. The iteratee is invoked with one argument; (value).
			*
			* @private
			* @param {Array} array The sorted array to inspect.
			* @param {*} value The value to evaluate.
			* @param {Function} iteratee The iteratee invoked per element.
			* @param {boolean} [retHighest] Specify returning the highest qualified index.
			* @returns {number} Returns the index at which `value` should be inserted
			*  into `array`.
			*/
			function baseSortedIndexBy(array, value, iteratee, retHighest) {
				var low = 0, high = array == null ? 0 : array.length;
				if (high === 0) return 0;
				value = iteratee(value);
				var valIsNaN = value !== value, valIsNull = value === null, valIsSymbol = isSymbol(value), valIsUndefined = value === undefined;
				while (low < high) {
					var mid = nativeFloor((low + high) / 2), computed = iteratee(array[mid]), othIsDefined = computed !== undefined, othIsNull = computed === null, othIsReflexive = computed === computed, othIsSymbol = isSymbol(computed);
					if (valIsNaN) var setLow = retHighest || othIsReflexive;
					else if (valIsUndefined) setLow = othIsReflexive && (retHighest || othIsDefined);
					else if (valIsNull) setLow = othIsReflexive && othIsDefined && (retHighest || !othIsNull);
					else if (valIsSymbol) setLow = othIsReflexive && othIsDefined && !othIsNull && (retHighest || !othIsSymbol);
					else if (othIsNull || othIsSymbol) setLow = false;
					else setLow = retHighest ? computed <= value : computed < value;
					if (setLow) low = mid + 1;
					else high = mid;
				}
				return nativeMin(high, MAX_ARRAY_INDEX);
			}
			/**
			* The base implementation of `_.sortedUniq` and `_.sortedUniqBy` without
			* support for iteratee shorthands.
			*
			* @private
			* @param {Array} array The array to inspect.
			* @param {Function} [iteratee] The iteratee invoked per element.
			* @returns {Array} Returns the new duplicate free array.
			*/
			function baseSortedUniq(array, iteratee) {
				var index = -1, length = array.length, resIndex = 0, result = [];
				while (++index < length) {
					var value = array[index], computed = iteratee ? iteratee(value) : value;
					if (!index || !eq(computed, seen)) {
						var seen = computed;
						result[resIndex++] = value === 0 ? 0 : value;
					}
				}
				return result;
			}
			/**
			* The base implementation of `_.toNumber` which doesn't ensure correct
			* conversions of binary, hexadecimal, or octal string values.
			*
			* @private
			* @param {*} value The value to process.
			* @returns {number} Returns the number.
			*/
			function baseToNumber(value) {
				if (typeof value == "number") return value;
				if (isSymbol(value)) return NAN;
				return +value;
			}
			/**
			* The base implementation of `_.toString` which doesn't convert nullish
			* values to empty strings.
			*
			* @private
			* @param {*} value The value to process.
			* @returns {string} Returns the string.
			*/
			function baseToString(value) {
				if (typeof value == "string") return value;
				if (isArray(value)) return arrayMap(value, baseToString) + "";
				if (isSymbol(value)) return symbolToString ? symbolToString.call(value) : "";
				var result = value + "";
				return result == "0" && 1 / value == -INFINITY ? "-0" : result;
			}
			/**
			* The base implementation of `_.uniqBy` without support for iteratee shorthands.
			*
			* @private
			* @param {Array} array The array to inspect.
			* @param {Function} [iteratee] The iteratee invoked per element.
			* @param {Function} [comparator] The comparator invoked per element.
			* @returns {Array} Returns the new duplicate free array.
			*/
			function baseUniq(array, iteratee, comparator) {
				var index = -1, includes = arrayIncludes, length = array.length, isCommon = true, result = [], seen = result;
				if (comparator) {
					isCommon = false;
					includes = arrayIncludesWith;
				} else if (length >= LARGE_ARRAY_SIZE) {
					var set = iteratee ? null : createSet(array);
					if (set) return setToArray(set);
					isCommon = false;
					includes = cacheHas;
					seen = new SetCache();
				} else seen = iteratee ? [] : result;
				outer: while (++index < length) {
					var value = array[index], computed = iteratee ? iteratee(value) : value;
					value = comparator || value !== 0 ? value : 0;
					if (isCommon && computed === computed) {
						var seenIndex = seen.length;
						while (seenIndex--) if (seen[seenIndex] === computed) continue outer;
						if (iteratee) seen.push(computed);
						result.push(value);
					} else if (!includes(seen, computed, comparator)) {
						if (seen !== result) seen.push(computed);
						result.push(value);
					}
				}
				return result;
			}
			/**
			* The base implementation of `_.unset`.
			*
			* @private
			* @param {Object} object The object to modify.
			* @param {Array|string} path The property path to unset.
			* @returns {boolean} Returns `true` if the property is deleted, else `false`.
			*/
			function baseUnset(object, path) {
				path = castPath(path, object);
				var index = -1, length = path.length;
				if (!length) return true;
				while (++index < length) {
					var key = toKey(path[index]);
					if (key === "__proto__" && !hasOwnProperty.call(object, "__proto__")) return false;
					if ((key === "constructor" || key === "prototype") && index < length - 1) return false;
				}
				var obj = parent(object, path);
				return obj == null || delete obj[toKey(last(path))];
			}
			/**
			* The base implementation of `_.update`.
			*
			* @private
			* @param {Object} object The object to modify.
			* @param {Array|string} path The path of the property to update.
			* @param {Function} updater The function to produce the updated value.
			* @param {Function} [customizer] The function to customize path creation.
			* @returns {Object} Returns `object`.
			*/
			function baseUpdate(object, path, updater, customizer) {
				return baseSet(object, path, updater(baseGet(object, path)), customizer);
			}
			/**
			* The base implementation of methods like `_.dropWhile` and `_.takeWhile`
			* without support for iteratee shorthands.
			*
			* @private
			* @param {Array} array The array to query.
			* @param {Function} predicate The function invoked per iteration.
			* @param {boolean} [isDrop] Specify dropping elements instead of taking them.
			* @param {boolean} [fromRight] Specify iterating from right to left.
			* @returns {Array} Returns the slice of `array`.
			*/
			function baseWhile(array, predicate, isDrop, fromRight) {
				var length = array.length, index = fromRight ? length : -1;
				while ((fromRight ? index-- : ++index < length) && predicate(array[index], index, array));
				return isDrop ? baseSlice(array, fromRight ? 0 : index, fromRight ? index + 1 : length) : baseSlice(array, fromRight ? index + 1 : 0, fromRight ? length : index);
			}
			/**
			* The base implementation of `wrapperValue` which returns the result of
			* performing a sequence of actions on the unwrapped `value`, where each
			* successive action is supplied the return value of the previous.
			*
			* @private
			* @param {*} value The unwrapped value.
			* @param {Array} actions Actions to perform to resolve the unwrapped value.
			* @returns {*} Returns the resolved value.
			*/
			function baseWrapperValue(value, actions) {
				var result = value;
				if (result instanceof LazyWrapper) result = result.value();
				return arrayReduce(actions, function(result, action) {
					return action.func.apply(action.thisArg, arrayPush([result], action.args));
				}, result);
			}
			/**
			* The base implementation of methods like `_.xor`, without support for
			* iteratee shorthands, that accepts an array of arrays to inspect.
			*
			* @private
			* @param {Array} arrays The arrays to inspect.
			* @param {Function} [iteratee] The iteratee invoked per element.
			* @param {Function} [comparator] The comparator invoked per element.
			* @returns {Array} Returns the new array of values.
			*/
			function baseXor(arrays, iteratee, comparator) {
				var length = arrays.length;
				if (length < 2) return length ? baseUniq(arrays[0]) : [];
				var index = -1, result = Array(length);
				while (++index < length) {
					var array = arrays[index], othIndex = -1;
					while (++othIndex < length) if (othIndex != index) result[index] = baseDifference(result[index] || array, arrays[othIndex], iteratee, comparator);
				}
				return baseUniq(baseFlatten(result, 1), iteratee, comparator);
			}
			/**
			* This base implementation of `_.zipObject` which assigns values using `assignFunc`.
			*
			* @private
			* @param {Array} props The property identifiers.
			* @param {Array} values The property values.
			* @param {Function} assignFunc The function to assign values.
			* @returns {Object} Returns the new object.
			*/
			function baseZipObject(props, values, assignFunc) {
				var index = -1, length = props.length, valsLength = values.length, result = {};
				while (++index < length) {
					var value = index < valsLength ? values[index] : undefined;
					assignFunc(result, props[index], value);
				}
				return result;
			}
			/**
			* Casts `value` to an empty array if it's not an array like object.
			*
			* @private
			* @param {*} value The value to inspect.
			* @returns {Array|Object} Returns the cast array-like object.
			*/
			function castArrayLikeObject(value) {
				return isArrayLikeObject(value) ? value : [];
			}
			/**
			* Casts `value` to `identity` if it's not a function.
			*
			* @private
			* @param {*} value The value to inspect.
			* @returns {Function} Returns cast function.
			*/
			function castFunction(value) {
				return typeof value == "function" ? value : identity;
			}
			/**
			* Casts `value` to a path array if it's not one.
			*
			* @private
			* @param {*} value The value to inspect.
			* @param {Object} [object] The object to query keys on.
			* @returns {Array} Returns the cast property path array.
			*/
			function castPath(value, object) {
				if (isArray(value)) return value;
				return isKey(value, object) ? [value] : stringToPath(toString(value));
			}
			/**
			* A `baseRest` alias which can be replaced with `identity` by module
			* replacement plugins.
			*
			* @private
			* @type {Function}
			* @param {Function} func The function to apply a rest parameter to.
			* @returns {Function} Returns the new function.
			*/
			var castRest = baseRest;
			/**
			* Casts `array` to a slice if it's needed.
			*
			* @private
			* @param {Array} array The array to inspect.
			* @param {number} start The start position.
			* @param {number} [end=array.length] The end position.
			* @returns {Array} Returns the cast slice.
			*/
			function castSlice(array, start, end) {
				var length = array.length;
				end = end === undefined ? length : end;
				return !start && end >= length ? array : baseSlice(array, start, end);
			}
			/**
			* A simple wrapper around the global [`clearTimeout`](https://mdn.io/clearTimeout).
			*
			* @private
			* @param {number|Object} id The timer id or timeout object of the timer to clear.
			*/
			var clearTimeout = ctxClearTimeout || function(id) {
				return root.clearTimeout(id);
			};
			/**
			* Creates a clone of  `buffer`.
			*
			* @private
			* @param {Buffer} buffer The buffer to clone.
			* @param {boolean} [isDeep] Specify a deep clone.
			* @returns {Buffer} Returns the cloned buffer.
			*/
			function cloneBuffer(buffer, isDeep) {
				if (isDeep) return buffer.slice();
				var length = buffer.length, result = allocUnsafe ? allocUnsafe(length) : new buffer.constructor(length);
				buffer.copy(result);
				return result;
			}
			/**
			* Creates a clone of `arrayBuffer`.
			*
			* @private
			* @param {ArrayBuffer} arrayBuffer The array buffer to clone.
			* @returns {ArrayBuffer} Returns the cloned array buffer.
			*/
			function cloneArrayBuffer(arrayBuffer) {
				var result = new arrayBuffer.constructor(arrayBuffer.byteLength);
				new Uint8Array(result).set(new Uint8Array(arrayBuffer));
				return result;
			}
			/**
			* Creates a clone of `dataView`.
			*
			* @private
			* @param {Object} dataView The data view to clone.
			* @param {boolean} [isDeep] Specify a deep clone.
			* @returns {Object} Returns the cloned data view.
			*/
			function cloneDataView(dataView, isDeep) {
				var buffer = isDeep ? cloneArrayBuffer(dataView.buffer) : dataView.buffer;
				return new dataView.constructor(buffer, dataView.byteOffset, dataView.byteLength);
			}
			/**
			* Creates a clone of `regexp`.
			*
			* @private
			* @param {Object} regexp The regexp to clone.
			* @returns {Object} Returns the cloned regexp.
			*/
			function cloneRegExp(regexp) {
				var result = new regexp.constructor(regexp.source, reFlags.exec(regexp));
				result.lastIndex = regexp.lastIndex;
				return result;
			}
			/**
			* Creates a clone of the `symbol` object.
			*
			* @private
			* @param {Object} symbol The symbol object to clone.
			* @returns {Object} Returns the cloned symbol object.
			*/
			function cloneSymbol(symbol) {
				return symbolValueOf ? Object(symbolValueOf.call(symbol)) : {};
			}
			/**
			* Creates a clone of `typedArray`.
			*
			* @private
			* @param {Object} typedArray The typed array to clone.
			* @param {boolean} [isDeep] Specify a deep clone.
			* @returns {Object} Returns the cloned typed array.
			*/
			function cloneTypedArray(typedArray, isDeep) {
				var buffer = isDeep ? cloneArrayBuffer(typedArray.buffer) : typedArray.buffer;
				return new typedArray.constructor(buffer, typedArray.byteOffset, typedArray.length);
			}
			/**
			* Compares values to sort them in ascending order.
			*
			* @private
			* @param {*} value The value to compare.
			* @param {*} other The other value to compare.
			* @returns {number} Returns the sort order indicator for `value`.
			*/
			function compareAscending(value, other) {
				if (value !== other) {
					var valIsDefined = value !== undefined, valIsNull = value === null, valIsReflexive = value === value, valIsSymbol = isSymbol(value);
					var othIsDefined = other !== undefined, othIsNull = other === null, othIsReflexive = other === other, othIsSymbol = isSymbol(other);
					if (!othIsNull && !othIsSymbol && !valIsSymbol && value > other || valIsSymbol && othIsDefined && othIsReflexive && !othIsNull && !othIsSymbol || valIsNull && othIsDefined && othIsReflexive || !valIsDefined && othIsReflexive || !valIsReflexive) return 1;
					if (!valIsNull && !valIsSymbol && !othIsSymbol && value < other || othIsSymbol && valIsDefined && valIsReflexive && !valIsNull && !valIsSymbol || othIsNull && valIsDefined && valIsReflexive || !othIsDefined && valIsReflexive || !othIsReflexive) return -1;
				}
				return 0;
			}
			/**
			* Used by `_.orderBy` to compare multiple properties of a value to another
			* and stable sort them.
			*
			* If `orders` is unspecified, all values are sorted in ascending order. Otherwise,
			* specify an order of "desc" for descending or "asc" for ascending sort order
			* of corresponding values.
			*
			* @private
			* @param {Object} object The object to compare.
			* @param {Object} other The other object to compare.
			* @param {boolean[]|string[]} orders The order to sort by for each property.
			* @returns {number} Returns the sort order indicator for `object`.
			*/
			function compareMultiple(object, other, orders) {
				var index = -1, objCriteria = object.criteria, othCriteria = other.criteria, length = objCriteria.length, ordersLength = orders.length;
				while (++index < length) {
					var result = compareAscending(objCriteria[index], othCriteria[index]);
					if (result) {
						if (index >= ordersLength) return result;
						return result * (orders[index] == "desc" ? -1 : 1);
					}
				}
				return object.index - other.index;
			}
			/**
			* Creates an array that is the composition of partially applied arguments,
			* placeholders, and provided arguments into a single array of arguments.
			*
			* @private
			* @param {Array} args The provided arguments.
			* @param {Array} partials The arguments to prepend to those provided.
			* @param {Array} holders The `partials` placeholder indexes.
			* @params {boolean} [isCurried] Specify composing for a curried function.
			* @returns {Array} Returns the new array of composed arguments.
			*/
			function composeArgs(args, partials, holders, isCurried) {
				var argsIndex = -1, argsLength = args.length, holdersLength = holders.length, leftIndex = -1, leftLength = partials.length, rangeLength = nativeMax(argsLength - holdersLength, 0), result = Array(leftLength + rangeLength), isUncurried = !isCurried;
				while (++leftIndex < leftLength) result[leftIndex] = partials[leftIndex];
				while (++argsIndex < holdersLength) if (isUncurried || argsIndex < argsLength) result[holders[argsIndex]] = args[argsIndex];
				while (rangeLength--) result[leftIndex++] = args[argsIndex++];
				return result;
			}
			/**
			* This function is like `composeArgs` except that the arguments composition
			* is tailored for `_.partialRight`.
			*
			* @private
			* @param {Array} args The provided arguments.
			* @param {Array} partials The arguments to append to those provided.
			* @param {Array} holders The `partials` placeholder indexes.
			* @params {boolean} [isCurried] Specify composing for a curried function.
			* @returns {Array} Returns the new array of composed arguments.
			*/
			function composeArgsRight(args, partials, holders, isCurried) {
				var argsIndex = -1, argsLength = args.length, holdersIndex = -1, holdersLength = holders.length, rightIndex = -1, rightLength = partials.length, rangeLength = nativeMax(argsLength - holdersLength, 0), result = Array(rangeLength + rightLength), isUncurried = !isCurried;
				while (++argsIndex < rangeLength) result[argsIndex] = args[argsIndex];
				var offset = argsIndex;
				while (++rightIndex < rightLength) result[offset + rightIndex] = partials[rightIndex];
				while (++holdersIndex < holdersLength) if (isUncurried || argsIndex < argsLength) result[offset + holders[holdersIndex]] = args[argsIndex++];
				return result;
			}
			/**
			* Copies the values of `source` to `array`.
			*
			* @private
			* @param {Array} source The array to copy values from.
			* @param {Array} [array=[]] The array to copy values to.
			* @returns {Array} Returns `array`.
			*/
			function copyArray(source, array) {
				var index = -1, length = source.length;
				array || (array = Array(length));
				while (++index < length) array[index] = source[index];
				return array;
			}
			/**
			* Copies properties of `source` to `object`.
			*
			* @private
			* @param {Object} source The object to copy properties from.
			* @param {Array} props The property identifiers to copy.
			* @param {Object} [object={}] The object to copy properties to.
			* @param {Function} [customizer] The function to customize copied values.
			* @returns {Object} Returns `object`.
			*/
			function copyObject(source, props, object, customizer) {
				var isNew = !object;
				object || (object = {});
				var index = -1, length = props.length;
				while (++index < length) {
					var key = props[index];
					var newValue = customizer ? customizer(object[key], source[key], key, object, source) : undefined;
					if (newValue === undefined) newValue = source[key];
					if (isNew) baseAssignValue(object, key, newValue);
					else assignValue(object, key, newValue);
				}
				return object;
			}
			/**
			* Copies own symbols of `source` to `object`.
			*
			* @private
			* @param {Object} source The object to copy symbols from.
			* @param {Object} [object={}] The object to copy symbols to.
			* @returns {Object} Returns `object`.
			*/
			function copySymbols(source, object) {
				return copyObject(source, getSymbols(source), object);
			}
			/**
			* Copies own and inherited symbols of `source` to `object`.
			*
			* @private
			* @param {Object} source The object to copy symbols from.
			* @param {Object} [object={}] The object to copy symbols to.
			* @returns {Object} Returns `object`.
			*/
			function copySymbolsIn(source, object) {
				return copyObject(source, getSymbolsIn(source), object);
			}
			/**
			* Creates a function like `_.groupBy`.
			*
			* @private
			* @param {Function} setter The function to set accumulator values.
			* @param {Function} [initializer] The accumulator object initializer.
			* @returns {Function} Returns the new aggregator function.
			*/
			function createAggregator(setter, initializer) {
				return function(collection, iteratee) {
					var func = isArray(collection) ? arrayAggregator : baseAggregator, accumulator = initializer ? initializer() : {};
					return func(collection, setter, getIteratee(iteratee, 2), accumulator);
				};
			}
			/**
			* Creates a function like `_.assign`.
			*
			* @private
			* @param {Function} assigner The function to assign values.
			* @returns {Function} Returns the new assigner function.
			*/
			function createAssigner(assigner) {
				return baseRest(function(object, sources) {
					var index = -1, length = sources.length, customizer = length > 1 ? sources[length - 1] : undefined, guard = length > 2 ? sources[2] : undefined;
					customizer = assigner.length > 3 && typeof customizer == "function" ? (length--, customizer) : undefined;
					if (guard && isIterateeCall(sources[0], sources[1], guard)) {
						customizer = length < 3 ? undefined : customizer;
						length = 1;
					}
					object = Object(object);
					while (++index < length) {
						var source = sources[index];
						if (source) assigner(object, source, index, customizer);
					}
					return object;
				});
			}
			/**
			* Creates a `baseEach` or `baseEachRight` function.
			*
			* @private
			* @param {Function} eachFunc The function to iterate over a collection.
			* @param {boolean} [fromRight] Specify iterating from right to left.
			* @returns {Function} Returns the new base function.
			*/
			function createBaseEach(eachFunc, fromRight) {
				return function(collection, iteratee) {
					if (collection == null) return collection;
					if (!isArrayLike(collection)) return eachFunc(collection, iteratee);
					var length = collection.length, index = fromRight ? length : -1, iterable = Object(collection);
					while (fromRight ? index-- : ++index < length) if (iteratee(iterable[index], index, iterable) === false) break;
					return collection;
				};
			}
			/**
			* Creates a base function for methods like `_.forIn` and `_.forOwn`.
			*
			* @private
			* @param {boolean} [fromRight] Specify iterating from right to left.
			* @returns {Function} Returns the new base function.
			*/
			function createBaseFor(fromRight) {
				return function(object, iteratee, keysFunc) {
					var index = -1, iterable = Object(object), props = keysFunc(object), length = props.length;
					while (length--) {
						var key = props[fromRight ? length : ++index];
						if (iteratee(iterable[key], key, iterable) === false) break;
					}
					return object;
				};
			}
			/**
			* Creates a function that wraps `func` to invoke it with the optional `this`
			* binding of `thisArg`.
			*
			* @private
			* @param {Function} func The function to wrap.
			* @param {number} bitmask The bitmask flags. See `createWrap` for more details.
			* @param {*} [thisArg] The `this` binding of `func`.
			* @returns {Function} Returns the new wrapped function.
			*/
			function createBind(func, bitmask, thisArg) {
				var isBind = bitmask & WRAP_BIND_FLAG, Ctor = createCtor(func);
				function wrapper() {
					return (this && this !== root && this instanceof wrapper ? Ctor : func).apply(isBind ? thisArg : this, arguments);
				}
				return wrapper;
			}
			/**
			* Creates a function like `_.lowerFirst`.
			*
			* @private
			* @param {string} methodName The name of the `String` case method to use.
			* @returns {Function} Returns the new case function.
			*/
			function createCaseFirst(methodName) {
				return function(string) {
					string = toString(string);
					var strSymbols = hasUnicode(string) ? stringToArray(string) : undefined;
					var chr = strSymbols ? strSymbols[0] : string.charAt(0);
					var trailing = strSymbols ? castSlice(strSymbols, 1).join("") : string.slice(1);
					return chr[methodName]() + trailing;
				};
			}
			/**
			* Creates a function like `_.camelCase`.
			*
			* @private
			* @param {Function} callback The function to combine each word.
			* @returns {Function} Returns the new compounder function.
			*/
			function createCompounder(callback) {
				return function(string) {
					return arrayReduce(words(deburr(string).replace(reApos, "")), callback, "");
				};
			}
			/**
			* Creates a function that produces an instance of `Ctor` regardless of
			* whether it was invoked as part of a `new` expression or by `call` or `apply`.
			*
			* @private
			* @param {Function} Ctor The constructor to wrap.
			* @returns {Function} Returns the new wrapped function.
			*/
			function createCtor(Ctor) {
				return function() {
					var args = arguments;
					switch (args.length) {
						case 0: return new Ctor();
						case 1: return new Ctor(args[0]);
						case 2: return new Ctor(args[0], args[1]);
						case 3: return new Ctor(args[0], args[1], args[2]);
						case 4: return new Ctor(args[0], args[1], args[2], args[3]);
						case 5: return new Ctor(args[0], args[1], args[2], args[3], args[4]);
						case 6: return new Ctor(args[0], args[1], args[2], args[3], args[4], args[5]);
						case 7: return new Ctor(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
					}
					var thisBinding = baseCreate(Ctor.prototype), result = Ctor.apply(thisBinding, args);
					return isObject(result) ? result : thisBinding;
				};
			}
			/**
			* Creates a function that wraps `func` to enable currying.
			*
			* @private
			* @param {Function} func The function to wrap.
			* @param {number} bitmask The bitmask flags. See `createWrap` for more details.
			* @param {number} arity The arity of `func`.
			* @returns {Function} Returns the new wrapped function.
			*/
			function createCurry(func, bitmask, arity) {
				var Ctor = createCtor(func);
				function wrapper() {
					var length = arguments.length, args = Array(length), index = length, placeholder = getHolder(wrapper);
					while (index--) args[index] = arguments[index];
					var holders = length < 3 && args[0] !== placeholder && args[length - 1] !== placeholder ? [] : replaceHolders(args, placeholder);
					length -= holders.length;
					if (length < arity) return createRecurry(func, bitmask, createHybrid, wrapper.placeholder, undefined, args, holders, undefined, undefined, arity - length);
					return apply(this && this !== root && this instanceof wrapper ? Ctor : func, this, args);
				}
				return wrapper;
			}
			/**
			* Creates a `_.find` or `_.findLast` function.
			*
			* @private
			* @param {Function} findIndexFunc The function to find the collection index.
			* @returns {Function} Returns the new find function.
			*/
			function createFind(findIndexFunc) {
				return function(collection, predicate, fromIndex) {
					var iterable = Object(collection);
					if (!isArrayLike(collection)) {
						var iteratee = getIteratee(predicate, 3);
						collection = keys(collection);
						predicate = function(key) {
							return iteratee(iterable[key], key, iterable);
						};
					}
					var index = findIndexFunc(collection, predicate, fromIndex);
					return index > -1 ? iterable[iteratee ? collection[index] : index] : undefined;
				};
			}
			/**
			* Creates a `_.flow` or `_.flowRight` function.
			*
			* @private
			* @param {boolean} [fromRight] Specify iterating from right to left.
			* @returns {Function} Returns the new flow function.
			*/
			function createFlow(fromRight) {
				return flatRest(function(funcs) {
					var length = funcs.length, index = length, prereq = LodashWrapper.prototype.thru;
					if (fromRight) funcs.reverse();
					while (index--) {
						var func = funcs[index];
						if (typeof func != "function") throw new TypeError(FUNC_ERROR_TEXT);
						if (prereq && !wrapper && getFuncName(func) == "wrapper") var wrapper = new LodashWrapper([], true);
					}
					index = wrapper ? index : length;
					while (++index < length) {
						func = funcs[index];
						var funcName = getFuncName(func), data = funcName == "wrapper" ? getData(func) : undefined;
						if (data && isLaziable(data[0]) && data[1] == (WRAP_ARY_FLAG | WRAP_CURRY_FLAG | WRAP_PARTIAL_FLAG | WRAP_REARG_FLAG) && !data[4].length && data[9] == 1) wrapper = wrapper[getFuncName(data[0])].apply(wrapper, data[3]);
						else wrapper = func.length == 1 && isLaziable(func) ? wrapper[funcName]() : wrapper.thru(func);
					}
					return function() {
						var args = arguments, value = args[0];
						if (wrapper && args.length == 1 && isArray(value)) return wrapper.plant(value).value();
						var index = 0, result = length ? funcs[index].apply(this, args) : value;
						while (++index < length) result = funcs[index].call(this, result);
						return result;
					};
				});
			}
			/**
			* Creates a function that wraps `func` to invoke it with optional `this`
			* binding of `thisArg`, partial application, and currying.
			*
			* @private
			* @param {Function|string} func The function or method name to wrap.
			* @param {number} bitmask The bitmask flags. See `createWrap` for more details.
			* @param {*} [thisArg] The `this` binding of `func`.
			* @param {Array} [partials] The arguments to prepend to those provided to
			*  the new function.
			* @param {Array} [holders] The `partials` placeholder indexes.
			* @param {Array} [partialsRight] The arguments to append to those provided
			*  to the new function.
			* @param {Array} [holdersRight] The `partialsRight` placeholder indexes.
			* @param {Array} [argPos] The argument positions of the new function.
			* @param {number} [ary] The arity cap of `func`.
			* @param {number} [arity] The arity of `func`.
			* @returns {Function} Returns the new wrapped function.
			*/
			function createHybrid(func, bitmask, thisArg, partials, holders, partialsRight, holdersRight, argPos, ary, arity) {
				var isAry = bitmask & WRAP_ARY_FLAG, isBind = bitmask & WRAP_BIND_FLAG, isBindKey = bitmask & WRAP_BIND_KEY_FLAG, isCurried = bitmask & (WRAP_CURRY_FLAG | WRAP_CURRY_RIGHT_FLAG), isFlip = bitmask & WRAP_FLIP_FLAG, Ctor = isBindKey ? undefined : createCtor(func);
				function wrapper() {
					var length = arguments.length, args = Array(length), index = length;
					while (index--) args[index] = arguments[index];
					if (isCurried) var placeholder = getHolder(wrapper), holdersCount = countHolders(args, placeholder);
					if (partials) args = composeArgs(args, partials, holders, isCurried);
					if (partialsRight) args = composeArgsRight(args, partialsRight, holdersRight, isCurried);
					length -= holdersCount;
					if (isCurried && length < arity) {
						var newHolders = replaceHolders(args, placeholder);
						return createRecurry(func, bitmask, createHybrid, wrapper.placeholder, thisArg, args, newHolders, argPos, ary, arity - length);
					}
					var thisBinding = isBind ? thisArg : this, fn = isBindKey ? thisBinding[func] : func;
					length = args.length;
					if (argPos) args = reorder(args, argPos);
					else if (isFlip && length > 1) args.reverse();
					if (isAry && ary < length) args.length = ary;
					if (this && this !== root && this instanceof wrapper) fn = Ctor || createCtor(fn);
					return fn.apply(thisBinding, args);
				}
				return wrapper;
			}
			/**
			* Creates a function like `_.invertBy`.
			*
			* @private
			* @param {Function} setter The function to set accumulator values.
			* @param {Function} toIteratee The function to resolve iteratees.
			* @returns {Function} Returns the new inverter function.
			*/
			function createInverter(setter, toIteratee) {
				return function(object, iteratee) {
					return baseInverter(object, setter, toIteratee(iteratee), {});
				};
			}
			/**
			* Creates a function that performs a mathematical operation on two values.
			*
			* @private
			* @param {Function} operator The function to perform the operation.
			* @param {number} [defaultValue] The value used for `undefined` arguments.
			* @returns {Function} Returns the new mathematical operation function.
			*/
			function createMathOperation(operator, defaultValue) {
				return function(value, other) {
					var result;
					if (value === undefined && other === undefined) return defaultValue;
					if (value !== undefined) result = value;
					if (other !== undefined) {
						if (result === undefined) return other;
						if (typeof value == "string" || typeof other == "string") {
							value = baseToString(value);
							other = baseToString(other);
						} else {
							value = baseToNumber(value);
							other = baseToNumber(other);
						}
						result = operator(value, other);
					}
					return result;
				};
			}
			/**
			* Creates a function like `_.over`.
			*
			* @private
			* @param {Function} arrayFunc The function to iterate over iteratees.
			* @returns {Function} Returns the new over function.
			*/
			function createOver(arrayFunc) {
				return flatRest(function(iteratees) {
					iteratees = arrayMap(iteratees, baseUnary(getIteratee()));
					return baseRest(function(args) {
						var thisArg = this;
						return arrayFunc(iteratees, function(iteratee) {
							return apply(iteratee, thisArg, args);
						});
					});
				});
			}
			/**
			* Creates the padding for `string` based on `length`. The `chars` string
			* is truncated if the number of characters exceeds `length`.
			*
			* @private
			* @param {number} length The padding length.
			* @param {string} [chars=' '] The string used as padding.
			* @returns {string} Returns the padding for `string`.
			*/
			function createPadding(length, chars) {
				chars = chars === undefined ? " " : baseToString(chars);
				var charsLength = chars.length;
				if (charsLength < 2) return charsLength ? baseRepeat(chars, length) : chars;
				var result = baseRepeat(chars, nativeCeil(length / stringSize(chars)));
				return hasUnicode(chars) ? castSlice(stringToArray(result), 0, length).join("") : result.slice(0, length);
			}
			/**
			* Creates a function that wraps `func` to invoke it with the `this` binding
			* of `thisArg` and `partials` prepended to the arguments it receives.
			*
			* @private
			* @param {Function} func The function to wrap.
			* @param {number} bitmask The bitmask flags. See `createWrap` for more details.
			* @param {*} thisArg The `this` binding of `func`.
			* @param {Array} partials The arguments to prepend to those provided to
			*  the new function.
			* @returns {Function} Returns the new wrapped function.
			*/
			function createPartial(func, bitmask, thisArg, partials) {
				var isBind = bitmask & WRAP_BIND_FLAG, Ctor = createCtor(func);
				function wrapper() {
					var argsIndex = -1, argsLength = arguments.length, leftIndex = -1, leftLength = partials.length, args = Array(leftLength + argsLength), fn = this && this !== root && this instanceof wrapper ? Ctor : func;
					while (++leftIndex < leftLength) args[leftIndex] = partials[leftIndex];
					while (argsLength--) args[leftIndex++] = arguments[++argsIndex];
					return apply(fn, isBind ? thisArg : this, args);
				}
				return wrapper;
			}
			/**
			* Creates a `_.range` or `_.rangeRight` function.
			*
			* @private
			* @param {boolean} [fromRight] Specify iterating from right to left.
			* @returns {Function} Returns the new range function.
			*/
			function createRange(fromRight) {
				return function(start, end, step) {
					if (step && typeof step != "number" && isIterateeCall(start, end, step)) end = step = undefined;
					start = toFinite(start);
					if (end === undefined) {
						end = start;
						start = 0;
					} else end = toFinite(end);
					step = step === undefined ? start < end ? 1 : -1 : toFinite(step);
					return baseRange(start, end, step, fromRight);
				};
			}
			/**
			* Creates a function that performs a relational operation on two values.
			*
			* @private
			* @param {Function} operator The function to perform the operation.
			* @returns {Function} Returns the new relational operation function.
			*/
			function createRelationalOperation(operator) {
				return function(value, other) {
					if (!(typeof value == "string" && typeof other == "string")) {
						value = toNumber(value);
						other = toNumber(other);
					}
					return operator(value, other);
				};
			}
			/**
			* Creates a function that wraps `func` to continue currying.
			*
			* @private
			* @param {Function} func The function to wrap.
			* @param {number} bitmask The bitmask flags. See `createWrap` for more details.
			* @param {Function} wrapFunc The function to create the `func` wrapper.
			* @param {*} placeholder The placeholder value.
			* @param {*} [thisArg] The `this` binding of `func`.
			* @param {Array} [partials] The arguments to prepend to those provided to
			*  the new function.
			* @param {Array} [holders] The `partials` placeholder indexes.
			* @param {Array} [argPos] The argument positions of the new function.
			* @param {number} [ary] The arity cap of `func`.
			* @param {number} [arity] The arity of `func`.
			* @returns {Function} Returns the new wrapped function.
			*/
			function createRecurry(func, bitmask, wrapFunc, placeholder, thisArg, partials, holders, argPos, ary, arity) {
				var isCurry = bitmask & WRAP_CURRY_FLAG, newHolders = isCurry ? holders : undefined, newHoldersRight = isCurry ? undefined : holders, newPartials = isCurry ? partials : undefined, newPartialsRight = isCurry ? undefined : partials;
				bitmask |= isCurry ? WRAP_PARTIAL_FLAG : WRAP_PARTIAL_RIGHT_FLAG;
				bitmask &= ~(isCurry ? WRAP_PARTIAL_RIGHT_FLAG : WRAP_PARTIAL_FLAG);
				if (!(bitmask & WRAP_CURRY_BOUND_FLAG)) bitmask &= ~(WRAP_BIND_FLAG | WRAP_BIND_KEY_FLAG);
				var newData = [
					func,
					bitmask,
					thisArg,
					newPartials,
					newHolders,
					newPartialsRight,
					newHoldersRight,
					argPos,
					ary,
					arity
				];
				var result = wrapFunc.apply(undefined, newData);
				if (isLaziable(func)) setData(result, newData);
				result.placeholder = placeholder;
				return setWrapToString(result, func, bitmask);
			}
			/**
			* Creates a function like `_.round`.
			*
			* @private
			* @param {string} methodName The name of the `Math` method to use when rounding.
			* @returns {Function} Returns the new round function.
			*/
			function createRound(methodName) {
				var func = Math[methodName];
				return function(number, precision) {
					number = toNumber(number);
					precision = precision == null ? 0 : nativeMin(toInteger(precision), 292);
					if (precision && nativeIsFinite(number)) {
						var pair = (toString(number) + "e").split("e");
						pair = (toString(func(pair[0] + "e" + (+pair[1] + precision))) + "e").split("e");
						return +(pair[0] + "e" + (+pair[1] - precision));
					}
					return func(number);
				};
			}
			/**
			* Creates a set object of `values`.
			*
			* @private
			* @param {Array} values The values to add to the set.
			* @returns {Object} Returns the new set.
			*/
			var createSet = !(Set && 1 / setToArray(new Set([, -0]))[1] == INFINITY) ? noop : function(values) {
				return new Set(values);
			};
			/**
			* Creates a `_.toPairs` or `_.toPairsIn` function.
			*
			* @private
			* @param {Function} keysFunc The function to get the keys of a given object.
			* @returns {Function} Returns the new pairs function.
			*/
			function createToPairs(keysFunc) {
				return function(object) {
					var tag = getTag(object);
					if (tag == mapTag) return mapToArray(object);
					if (tag == setTag) return setToPairs(object);
					return baseToPairs(object, keysFunc(object));
				};
			}
			/**
			* Creates a function that either curries or invokes `func` with optional
			* `this` binding and partially applied arguments.
			*
			* @private
			* @param {Function|string} func The function or method name to wrap.
			* @param {number} bitmask The bitmask flags.
			*    1 - `_.bind`
			*    2 - `_.bindKey`
			*    4 - `_.curry` or `_.curryRight` of a bound function
			*    8 - `_.curry`
			*   16 - `_.curryRight`
			*   32 - `_.partial`
			*   64 - `_.partialRight`
			*  128 - `_.rearg`
			*  256 - `_.ary`
			*  512 - `_.flip`
			* @param {*} [thisArg] The `this` binding of `func`.
			* @param {Array} [partials] The arguments to be partially applied.
			* @param {Array} [holders] The `partials` placeholder indexes.
			* @param {Array} [argPos] The argument positions of the new function.
			* @param {number} [ary] The arity cap of `func`.
			* @param {number} [arity] The arity of `func`.
			* @returns {Function} Returns the new wrapped function.
			*/
			function createWrap(func, bitmask, thisArg, partials, holders, argPos, ary, arity) {
				var isBindKey = bitmask & WRAP_BIND_KEY_FLAG;
				if (!isBindKey && typeof func != "function") throw new TypeError(FUNC_ERROR_TEXT);
				var length = partials ? partials.length : 0;
				if (!length) {
					bitmask &= ~(WRAP_PARTIAL_FLAG | WRAP_PARTIAL_RIGHT_FLAG);
					partials = holders = undefined;
				}
				ary = ary === undefined ? ary : nativeMax(toInteger(ary), 0);
				arity = arity === undefined ? arity : toInteger(arity);
				length -= holders ? holders.length : 0;
				if (bitmask & WRAP_PARTIAL_RIGHT_FLAG) {
					var partialsRight = partials, holdersRight = holders;
					partials = holders = undefined;
				}
				var data = isBindKey ? undefined : getData(func);
				var newData = [
					func,
					bitmask,
					thisArg,
					partials,
					holders,
					partialsRight,
					holdersRight,
					argPos,
					ary,
					arity
				];
				if (data) mergeData(newData, data);
				func = newData[0];
				bitmask = newData[1];
				thisArg = newData[2];
				partials = newData[3];
				holders = newData[4];
				arity = newData[9] = newData[9] === undefined ? isBindKey ? 0 : func.length : nativeMax(newData[9] - length, 0);
				if (!arity && bitmask & (WRAP_CURRY_FLAG | WRAP_CURRY_RIGHT_FLAG)) bitmask &= ~(WRAP_CURRY_FLAG | WRAP_CURRY_RIGHT_FLAG);
				if (!bitmask || bitmask == WRAP_BIND_FLAG) var result = createBind(func, bitmask, thisArg);
				else if (bitmask == WRAP_CURRY_FLAG || bitmask == WRAP_CURRY_RIGHT_FLAG) result = createCurry(func, bitmask, arity);
				else if ((bitmask == WRAP_PARTIAL_FLAG || bitmask == (WRAP_BIND_FLAG | WRAP_PARTIAL_FLAG)) && !holders.length) result = createPartial(func, bitmask, thisArg, partials);
				else result = createHybrid.apply(undefined, newData);
				return setWrapToString((data ? baseSetData : setData)(result, newData), func, bitmask);
			}
			/**
			* Used by `_.defaults` to customize its `_.assignIn` use to assign properties
			* of source objects to the destination object for all destination properties
			* that resolve to `undefined`.
			*
			* @private
			* @param {*} objValue The destination value.
			* @param {*} srcValue The source value.
			* @param {string} key The key of the property to assign.
			* @param {Object} object The parent object of `objValue`.
			* @returns {*} Returns the value to assign.
			*/
			function customDefaultsAssignIn(objValue, srcValue, key, object) {
				if (objValue === undefined || eq(objValue, objectProto[key]) && !hasOwnProperty.call(object, key)) return srcValue;
				return objValue;
			}
			/**
			* Used by `_.defaultsDeep` to customize its `_.merge` use to merge source
			* objects into destination objects that are passed thru.
			*
			* @private
			* @param {*} objValue The destination value.
			* @param {*} srcValue The source value.
			* @param {string} key The key of the property to merge.
			* @param {Object} object The parent object of `objValue`.
			* @param {Object} source The parent object of `srcValue`.
			* @param {Object} [stack] Tracks traversed source values and their merged
			*  counterparts.
			* @returns {*} Returns the value to assign.
			*/
			function customDefaultsMerge(objValue, srcValue, key, object, source, stack) {
				if (isObject(objValue) && isObject(srcValue)) {
					stack.set(srcValue, objValue);
					baseMerge(objValue, srcValue, undefined, customDefaultsMerge, stack);
					stack["delete"](srcValue);
				}
				return objValue;
			}
			/**
			* Used by `_.omit` to customize its `_.cloneDeep` use to only clone plain
			* objects.
			*
			* @private
			* @param {*} value The value to inspect.
			* @param {string} key The key of the property to inspect.
			* @returns {*} Returns the uncloned value or `undefined` to defer cloning to `_.cloneDeep`.
			*/
			function customOmitClone(value) {
				return isPlainObject(value) ? undefined : value;
			}
			/**
			* A specialized version of `baseIsEqualDeep` for arrays with support for
			* partial deep comparisons.
			*
			* @private
			* @param {Array} array The array to compare.
			* @param {Array} other The other array to compare.
			* @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
			* @param {Function} customizer The function to customize comparisons.
			* @param {Function} equalFunc The function to determine equivalents of values.
			* @param {Object} stack Tracks traversed `array` and `other` objects.
			* @returns {boolean} Returns `true` if the arrays are equivalent, else `false`.
			*/
			function equalArrays(array, other, bitmask, customizer, equalFunc, stack) {
				var isPartial = bitmask & COMPARE_PARTIAL_FLAG, arrLength = array.length, othLength = other.length;
				if (arrLength != othLength && !(isPartial && othLength > arrLength)) return false;
				var arrStacked = stack.get(array);
				var othStacked = stack.get(other);
				if (arrStacked && othStacked) return arrStacked == other && othStacked == array;
				var index = -1, result = true, seen = bitmask & COMPARE_UNORDERED_FLAG ? new SetCache() : undefined;
				stack.set(array, other);
				stack.set(other, array);
				while (++index < arrLength) {
					var arrValue = array[index], othValue = other[index];
					if (customizer) var compared = isPartial ? customizer(othValue, arrValue, index, other, array, stack) : customizer(arrValue, othValue, index, array, other, stack);
					if (compared !== undefined) {
						if (compared) continue;
						result = false;
						break;
					}
					if (seen) {
						if (!arraySome(other, function(othValue, othIndex) {
							if (!cacheHas(seen, othIndex) && (arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) return seen.push(othIndex);
						})) {
							result = false;
							break;
						}
					} else if (!(arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) {
						result = false;
						break;
					}
				}
				stack["delete"](array);
				stack["delete"](other);
				return result;
			}
			/**
			* A specialized version of `baseIsEqualDeep` for comparing objects of
			* the same `toStringTag`.
			*
			* **Note:** This function only supports comparing values with tags of
			* `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
			*
			* @private
			* @param {Object} object The object to compare.
			* @param {Object} other The other object to compare.
			* @param {string} tag The `toStringTag` of the objects to compare.
			* @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
			* @param {Function} customizer The function to customize comparisons.
			* @param {Function} equalFunc The function to determine equivalents of values.
			* @param {Object} stack Tracks traversed `object` and `other` objects.
			* @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
			*/
			function equalByTag(object, other, tag, bitmask, customizer, equalFunc, stack) {
				switch (tag) {
					case dataViewTag:
						if (object.byteLength != other.byteLength || object.byteOffset != other.byteOffset) return false;
						object = object.buffer;
						other = other.buffer;
					case arrayBufferTag:
						if (object.byteLength != other.byteLength || !equalFunc(new Uint8Array(object), new Uint8Array(other))) return false;
						return true;
					case boolTag:
					case dateTag:
					case numberTag: return eq(+object, +other);
					case errorTag: return object.name == other.name && object.message == other.message;
					case regexpTag:
					case stringTag: return object == other + "";
					case mapTag: var convert = mapToArray;
					case setTag:
						var isPartial = bitmask & COMPARE_PARTIAL_FLAG;
						convert || (convert = setToArray);
						if (object.size != other.size && !isPartial) return false;
						var stacked = stack.get(object);
						if (stacked) return stacked == other;
						bitmask |= COMPARE_UNORDERED_FLAG;
						stack.set(object, other);
						var result = equalArrays(convert(object), convert(other), bitmask, customizer, equalFunc, stack);
						stack["delete"](object);
						return result;
					case symbolTag: if (symbolValueOf) return symbolValueOf.call(object) == symbolValueOf.call(other);
				}
				return false;
			}
			/**
			* A specialized version of `baseIsEqualDeep` for objects with support for
			* partial deep comparisons.
			*
			* @private
			* @param {Object} object The object to compare.
			* @param {Object} other The other object to compare.
			* @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
			* @param {Function} customizer The function to customize comparisons.
			* @param {Function} equalFunc The function to determine equivalents of values.
			* @param {Object} stack Tracks traversed `object` and `other` objects.
			* @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
			*/
			function equalObjects(object, other, bitmask, customizer, equalFunc, stack) {
				var isPartial = bitmask & COMPARE_PARTIAL_FLAG, objProps = getAllKeys(object), objLength = objProps.length;
				if (objLength != getAllKeys(other).length && !isPartial) return false;
				var index = objLength;
				while (index--) {
					var key = objProps[index];
					if (!(isPartial ? key in other : hasOwnProperty.call(other, key))) return false;
				}
				var objStacked = stack.get(object);
				var othStacked = stack.get(other);
				if (objStacked && othStacked) return objStacked == other && othStacked == object;
				var result = true;
				stack.set(object, other);
				stack.set(other, object);
				var skipCtor = isPartial;
				while (++index < objLength) {
					key = objProps[index];
					var objValue = object[key], othValue = other[key];
					if (customizer) var compared = isPartial ? customizer(othValue, objValue, key, other, object, stack) : customizer(objValue, othValue, key, object, other, stack);
					if (!(compared === undefined ? objValue === othValue || equalFunc(objValue, othValue, bitmask, customizer, stack) : compared)) {
						result = false;
						break;
					}
					skipCtor || (skipCtor = key == "constructor");
				}
				if (result && !skipCtor) {
					var objCtor = object.constructor, othCtor = other.constructor;
					if (objCtor != othCtor && "constructor" in object && "constructor" in other && !(typeof objCtor == "function" && objCtor instanceof objCtor && typeof othCtor == "function" && othCtor instanceof othCtor)) result = false;
				}
				stack["delete"](object);
				stack["delete"](other);
				return result;
			}
			/**
			* A specialized version of `baseRest` which flattens the rest array.
			*
			* @private
			* @param {Function} func The function to apply a rest parameter to.
			* @returns {Function} Returns the new function.
			*/
			function flatRest(func) {
				return setToString(overRest(func, undefined, flatten), func + "");
			}
			/**
			* Creates an array of own enumerable property names and symbols of `object`.
			*
			* @private
			* @param {Object} object The object to query.
			* @returns {Array} Returns the array of property names and symbols.
			*/
			function getAllKeys(object) {
				return baseGetAllKeys(object, keys, getSymbols);
			}
			/**
			* Creates an array of own and inherited enumerable property names and
			* symbols of `object`.
			*
			* @private
			* @param {Object} object The object to query.
			* @returns {Array} Returns the array of property names and symbols.
			*/
			function getAllKeysIn(object) {
				return baseGetAllKeys(object, keysIn, getSymbolsIn);
			}
			/**
			* Gets metadata for `func`.
			*
			* @private
			* @param {Function} func The function to query.
			* @returns {*} Returns the metadata for `func`.
			*/
			var getData = !metaMap ? noop : function(func) {
				return metaMap.get(func);
			};
			/**
			* Gets the name of `func`.
			*
			* @private
			* @param {Function} func The function to query.
			* @returns {string} Returns the function name.
			*/
			function getFuncName(func) {
				var result = func.name + "", array = realNames[result], length = hasOwnProperty.call(realNames, result) ? array.length : 0;
				while (length--) {
					var data = array[length], otherFunc = data.func;
					if (otherFunc == null || otherFunc == func) return data.name;
				}
				return result;
			}
			/**
			* Gets the argument placeholder value for `func`.
			*
			* @private
			* @param {Function} func The function to inspect.
			* @returns {*} Returns the placeholder value.
			*/
			function getHolder(func) {
				return (hasOwnProperty.call(lodash, "placeholder") ? lodash : func).placeholder;
			}
			/**
			* Gets the appropriate "iteratee" function. If `_.iteratee` is customized,
			* this function returns the custom method, otherwise it returns `baseIteratee`.
			* If arguments are provided, the chosen function is invoked with them and
			* its result is returned.
			*
			* @private
			* @param {*} [value] The value to convert to an iteratee.
			* @param {number} [arity] The arity of the created iteratee.
			* @returns {Function} Returns the chosen function or its result.
			*/
			function getIteratee() {
				var result = lodash.iteratee || iteratee;
				result = result === iteratee ? baseIteratee : result;
				return arguments.length ? result(arguments[0], arguments[1]) : result;
			}
			/**
			* Gets the data for `map`.
			*
			* @private
			* @param {Object} map The map to query.
			* @param {string} key The reference key.
			* @returns {*} Returns the map data.
			*/
			function getMapData(map, key) {
				var data = map.__data__;
				return isKeyable(key) ? data[typeof key == "string" ? "string" : "hash"] : data.map;
			}
			/**
			* Gets the property names, values, and compare flags of `object`.
			*
			* @private
			* @param {Object} object The object to query.
			* @returns {Array} Returns the match data of `object`.
			*/
			function getMatchData(object) {
				var result = keys(object), length = result.length;
				while (length--) {
					var key = result[length], value = object[key];
					result[length] = [
						key,
						value,
						isStrictComparable(value)
					];
				}
				return result;
			}
			/**
			* Gets the native function at `key` of `object`.
			*
			* @private
			* @param {Object} object The object to query.
			* @param {string} key The key of the method to get.
			* @returns {*} Returns the function if it's native, else `undefined`.
			*/
			function getNative(object, key) {
				var value = getValue(object, key);
				return baseIsNative(value) ? value : undefined;
			}
			/**
			* A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
			*
			* @private
			* @param {*} value The value to query.
			* @returns {string} Returns the raw `toStringTag`.
			*/
			function getRawTag(value) {
				var isOwn = hasOwnProperty.call(value, symToStringTag), tag = value[symToStringTag];
				try {
					value[symToStringTag] = undefined;
					var unmasked = true;
				} catch (e) {}
				var result = nativeObjectToString.call(value);
				if (unmasked) if (isOwn) value[symToStringTag] = tag;
				else delete value[symToStringTag];
				return result;
			}
			/**
			* Creates an array of the own enumerable symbols of `object`.
			*
			* @private
			* @param {Object} object The object to query.
			* @returns {Array} Returns the array of symbols.
			*/
			var getSymbols = !nativeGetSymbols ? stubArray : function(object) {
				if (object == null) return [];
				object = Object(object);
				return arrayFilter(nativeGetSymbols(object), function(symbol) {
					return propertyIsEnumerable.call(object, symbol);
				});
			};
			/**
			* Creates an array of the own and inherited enumerable symbols of `object`.
			*
			* @private
			* @param {Object} object The object to query.
			* @returns {Array} Returns the array of symbols.
			*/
			var getSymbolsIn = !nativeGetSymbols ? stubArray : function(object) {
				var result = [];
				while (object) {
					arrayPush(result, getSymbols(object));
					object = getPrototype(object);
				}
				return result;
			};
			/**
			* Gets the `toStringTag` of `value`.
			*
			* @private
			* @param {*} value The value to query.
			* @returns {string} Returns the `toStringTag`.
			*/
			var getTag = baseGetTag;
			if (DataView && getTag(new DataView(/* @__PURE__ */ new ArrayBuffer(1))) != dataViewTag || Map && getTag(new Map()) != mapTag || Promise && getTag(Promise.resolve()) != promiseTag || Set && getTag(new Set()) != setTag || WeakMap && getTag(new WeakMap()) != weakMapTag) getTag = function(value) {
				var result = baseGetTag(value), Ctor = result == objectTag ? value.constructor : undefined, ctorString = Ctor ? toSource(Ctor) : "";
				if (ctorString) switch (ctorString) {
					case dataViewCtorString: return dataViewTag;
					case mapCtorString: return mapTag;
					case promiseCtorString: return promiseTag;
					case setCtorString: return setTag;
					case weakMapCtorString: return weakMapTag;
				}
				return result;
			};
			/**
			* Gets the view, applying any `transforms` to the `start` and `end` positions.
			*
			* @private
			* @param {number} start The start of the view.
			* @param {number} end The end of the view.
			* @param {Array} transforms The transformations to apply to the view.
			* @returns {Object} Returns an object containing the `start` and `end`
			*  positions of the view.
			*/
			function getView(start, end, transforms) {
				var index = -1, length = transforms.length;
				while (++index < length) {
					var data = transforms[index], size = data.size;
					switch (data.type) {
						case "drop":
							start += size;
							break;
						case "dropRight":
							end -= size;
							break;
						case "take":
							end = nativeMin(end, start + size);
							break;
						case "takeRight":
							start = nativeMax(start, end - size);
							break;
					}
				}
				return {
					"start": start,
					"end": end
				};
			}
			/**
			* Extracts wrapper details from the `source` body comment.
			*
			* @private
			* @param {string} source The source to inspect.
			* @returns {Array} Returns the wrapper details.
			*/
			function getWrapDetails(source) {
				var match = source.match(reWrapDetails);
				return match ? match[1].split(reSplitDetails) : [];
			}
			/**
			* Checks if `path` exists on `object`.
			*
			* @private
			* @param {Object} object The object to query.
			* @param {Array|string} path The path to check.
			* @param {Function} hasFunc The function to check properties.
			* @returns {boolean} Returns `true` if `path` exists, else `false`.
			*/
			function hasPath(object, path, hasFunc) {
				path = castPath(path, object);
				var index = -1, length = path.length, result = false;
				while (++index < length) {
					var key = toKey(path[index]);
					if (!(result = object != null && hasFunc(object, key))) break;
					object = object[key];
				}
				if (result || ++index != length) return result;
				length = object == null ? 0 : object.length;
				return !!length && isLength(length) && isIndex(key, length) && (isArray(object) || isArguments(object));
			}
			/**
			* Initializes an array clone.
			*
			* @private
			* @param {Array} array The array to clone.
			* @returns {Array} Returns the initialized clone.
			*/
			function initCloneArray(array) {
				var length = array.length, result = new array.constructor(length);
				if (length && typeof array[0] == "string" && hasOwnProperty.call(array, "index")) {
					result.index = array.index;
					result.input = array.input;
				}
				return result;
			}
			/**
			* Initializes an object clone.
			*
			* @private
			* @param {Object} object The object to clone.
			* @returns {Object} Returns the initialized clone.
			*/
			function initCloneObject(object) {
				return typeof object.constructor == "function" && !isPrototype(object) ? baseCreate(getPrototype(object)) : {};
			}
			/**
			* Initializes an object clone based on its `toStringTag`.
			*
			* **Note:** This function only supports cloning values with tags of
			* `Boolean`, `Date`, `Error`, `Map`, `Number`, `RegExp`, `Set`, or `String`.
			*
			* @private
			* @param {Object} object The object to clone.
			* @param {string} tag The `toStringTag` of the object to clone.
			* @param {boolean} [isDeep] Specify a deep clone.
			* @returns {Object} Returns the initialized clone.
			*/
			function initCloneByTag(object, tag, isDeep) {
				var Ctor = object.constructor;
				switch (tag) {
					case arrayBufferTag: return cloneArrayBuffer(object);
					case boolTag:
					case dateTag: return new Ctor(+object);
					case dataViewTag: return cloneDataView(object, isDeep);
					case float32Tag:
					case float64Tag:
					case int8Tag:
					case int16Tag:
					case int32Tag:
					case uint8Tag:
					case uint8ClampedTag:
					case uint16Tag:
					case uint32Tag: return cloneTypedArray(object, isDeep);
					case mapTag: return new Ctor();
					case numberTag:
					case stringTag: return new Ctor(object);
					case regexpTag: return cloneRegExp(object);
					case setTag: return new Ctor();
					case symbolTag: return cloneSymbol(object);
				}
			}
			/**
			* Inserts wrapper `details` in a comment at the top of the `source` body.
			*
			* @private
			* @param {string} source The source to modify.
			* @returns {Array} details The details to insert.
			* @returns {string} Returns the modified source.
			*/
			function insertWrapDetails(source, details) {
				var length = details.length;
				if (!length) return source;
				var lastIndex = length - 1;
				details[lastIndex] = (length > 1 ? "& " : "") + details[lastIndex];
				details = details.join(length > 2 ? ", " : " ");
				return source.replace(reWrapComment, "{\n/* [wrapped with " + details + "] */\n");
			}
			/**
			* Checks if `value` is a flattenable `arguments` object or array.
			*
			* @private
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is flattenable, else `false`.
			*/
			function isFlattenable(value) {
				return isArray(value) || isArguments(value) || !!(spreadableSymbol && value && value[spreadableSymbol]);
			}
			/**
			* Checks if `value` is a valid array-like index.
			*
			* @private
			* @param {*} value The value to check.
			* @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
			* @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
			*/
			function isIndex(value, length) {
				var type = typeof value;
				length = length == null ? MAX_SAFE_INTEGER : length;
				return !!length && (type == "number" || type != "symbol" && reIsUint.test(value)) && value > -1 && value % 1 == 0 && value < length;
			}
			/**
			* Checks if the given arguments are from an iteratee call.
			*
			* @private
			* @param {*} value The potential iteratee value argument.
			* @param {*} index The potential iteratee index or key argument.
			* @param {*} object The potential iteratee object argument.
			* @returns {boolean} Returns `true` if the arguments are from an iteratee call,
			*  else `false`.
			*/
			function isIterateeCall(value, index, object) {
				if (!isObject(object)) return false;
				var type = typeof index;
				if (type == "number" ? isArrayLike(object) && isIndex(index, object.length) : type == "string" && index in object) return eq(object[index], value);
				return false;
			}
			/**
			* Checks if `value` is a property name and not a property path.
			*
			* @private
			* @param {*} value The value to check.
			* @param {Object} [object] The object to query keys on.
			* @returns {boolean} Returns `true` if `value` is a property name, else `false`.
			*/
			function isKey(value, object) {
				if (isArray(value)) return false;
				var type = typeof value;
				if (type == "number" || type == "symbol" || type == "boolean" || value == null || isSymbol(value)) return true;
				return reIsPlainProp.test(value) || !reIsDeepProp.test(value) || object != null && value in Object(object);
			}
			/**
			* Checks if `value` is suitable for use as unique object key.
			*
			* @private
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is suitable, else `false`.
			*/
			function isKeyable(value) {
				var type = typeof value;
				return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null;
			}
			/**
			* Checks if `func` has a lazy counterpart.
			*
			* @private
			* @param {Function} func The function to check.
			* @returns {boolean} Returns `true` if `func` has a lazy counterpart,
			*  else `false`.
			*/
			function isLaziable(func) {
				var funcName = getFuncName(func), other = lodash[funcName];
				if (typeof other != "function" || !(funcName in LazyWrapper.prototype)) return false;
				if (func === other) return true;
				var data = getData(other);
				return !!data && func === data[0];
			}
			/**
			* Checks if `func` has its source masked.
			*
			* @private
			* @param {Function} func The function to check.
			* @returns {boolean} Returns `true` if `func` is masked, else `false`.
			*/
			function isMasked(func) {
				return !!maskSrcKey && maskSrcKey in func;
			}
			/**
			* Checks if `func` is capable of being masked.
			*
			* @private
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `func` is maskable, else `false`.
			*/
			var isMaskable = coreJsData ? isFunction : stubFalse;
			/**
			* Checks if `value` is likely a prototype object.
			*
			* @private
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
			*/
			function isPrototype(value) {
				var Ctor = value && value.constructor;
				return value === (typeof Ctor == "function" && Ctor.prototype || objectProto);
			}
			/**
			* Checks if `value` is suitable for strict equality comparisons, i.e. `===`.
			*
			* @private
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` if suitable for strict
			*  equality comparisons, else `false`.
			*/
			function isStrictComparable(value) {
				return value === value && !isObject(value);
			}
			/**
			* A specialized version of `matchesProperty` for source values suitable
			* for strict equality comparisons, i.e. `===`.
			*
			* @private
			* @param {string} key The key of the property to get.
			* @param {*} srcValue The value to match.
			* @returns {Function} Returns the new spec function.
			*/
			function matchesStrictComparable(key, srcValue) {
				return function(object) {
					if (object == null) return false;
					return object[key] === srcValue && (srcValue !== undefined || key in Object(object));
				};
			}
			/**
			* A specialized version of `_.memoize` which clears the memoized function's
			* cache when it exceeds `MAX_MEMOIZE_SIZE`.
			*
			* @private
			* @param {Function} func The function to have its output memoized.
			* @returns {Function} Returns the new memoized function.
			*/
			function memoizeCapped(func) {
				var result = memoize(func, function(key) {
					if (cache.size === MAX_MEMOIZE_SIZE) cache.clear();
					return key;
				});
				var cache = result.cache;
				return result;
			}
			/**
			* Merges the function metadata of `source` into `data`.
			*
			* Merging metadata reduces the number of wrappers used to invoke a function.
			* This is possible because methods like `_.bind`, `_.curry`, and `_.partial`
			* may be applied regardless of execution order. Methods like `_.ary` and
			* `_.rearg` modify function arguments, making the order in which they are
			* executed important, preventing the merging of metadata. However, we make
			* an exception for a safe combined case where curried functions have `_.ary`
			* and or `_.rearg` applied.
			*
			* @private
			* @param {Array} data The destination metadata.
			* @param {Array} source The source metadata.
			* @returns {Array} Returns `data`.
			*/
			function mergeData(data, source) {
				var bitmask = data[1], srcBitmask = source[1], newBitmask = bitmask | srcBitmask, isCommon = newBitmask < (WRAP_BIND_FLAG | WRAP_BIND_KEY_FLAG | WRAP_ARY_FLAG);
				var isCombo = srcBitmask == WRAP_ARY_FLAG && bitmask == WRAP_CURRY_FLAG || srcBitmask == WRAP_ARY_FLAG && bitmask == WRAP_REARG_FLAG && data[7].length <= source[8] || srcBitmask == (WRAP_ARY_FLAG | WRAP_REARG_FLAG) && source[7].length <= source[8] && bitmask == WRAP_CURRY_FLAG;
				if (!(isCommon || isCombo)) return data;
				if (srcBitmask & WRAP_BIND_FLAG) {
					data[2] = source[2];
					newBitmask |= bitmask & WRAP_BIND_FLAG ? 0 : WRAP_CURRY_BOUND_FLAG;
				}
				var value = source[3];
				if (value) {
					var partials = data[3];
					data[3] = partials ? composeArgs(partials, value, source[4]) : value;
					data[4] = partials ? replaceHolders(data[3], PLACEHOLDER) : source[4];
				}
				value = source[5];
				if (value) {
					partials = data[5];
					data[5] = partials ? composeArgsRight(partials, value, source[6]) : value;
					data[6] = partials ? replaceHolders(data[5], PLACEHOLDER) : source[6];
				}
				value = source[7];
				if (value) data[7] = value;
				if (srcBitmask & WRAP_ARY_FLAG) data[8] = data[8] == null ? source[8] : nativeMin(data[8], source[8]);
				if (data[9] == null) data[9] = source[9];
				data[0] = source[0];
				data[1] = newBitmask;
				return data;
			}
			/**
			* This function is like
			* [`Object.keys`](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
			* except that it includes inherited enumerable properties.
			*
			* @private
			* @param {Object} object The object to query.
			* @returns {Array} Returns the array of property names.
			*/
			function nativeKeysIn(object) {
				var result = [];
				if (object != null) for (var key in Object(object)) result.push(key);
				return result;
			}
			/**
			* Converts `value` to a string using `Object.prototype.toString`.
			*
			* @private
			* @param {*} value The value to convert.
			* @returns {string} Returns the converted string.
			*/
			function objectToString(value) {
				return nativeObjectToString.call(value);
			}
			/**
			* A specialized version of `baseRest` which transforms the rest array.
			*
			* @private
			* @param {Function} func The function to apply a rest parameter to.
			* @param {number} [start=func.length-1] The start position of the rest parameter.
			* @param {Function} transform The rest array transform.
			* @returns {Function} Returns the new function.
			*/
			function overRest(func, start, transform) {
				start = nativeMax(start === undefined ? func.length - 1 : start, 0);
				return function() {
					var args = arguments, index = -1, length = nativeMax(args.length - start, 0), array = Array(length);
					while (++index < length) array[index] = args[start + index];
					index = -1;
					var otherArgs = Array(start + 1);
					while (++index < start) otherArgs[index] = args[index];
					otherArgs[start] = transform(array);
					return apply(func, this, otherArgs);
				};
			}
			/**
			* Gets the parent value at `path` of `object`.
			*
			* @private
			* @param {Object} object The object to query.
			* @param {Array} path The path to get the parent value of.
			* @returns {*} Returns the parent value.
			*/
			function parent(object, path) {
				return path.length < 2 ? object : baseGet(object, baseSlice(path, 0, -1));
			}
			/**
			* Reorder `array` according to the specified indexes where the element at
			* the first index is assigned as the first element, the element at
			* the second index is assigned as the second element, and so on.
			*
			* @private
			* @param {Array} array The array to reorder.
			* @param {Array} indexes The arranged array indexes.
			* @returns {Array} Returns `array`.
			*/
			function reorder(array, indexes) {
				var arrLength = array.length, length = nativeMin(indexes.length, arrLength), oldArray = copyArray(array);
				while (length--) {
					var index = indexes[length];
					array[length] = isIndex(index, arrLength) ? oldArray[index] : undefined;
				}
				return array;
			}
			/**
			* Gets the value at `key`, unless `key` is "__proto__" or "constructor".
			*
			* @private
			* @param {Object} object The object to query.
			* @param {string} key The key of the property to get.
			* @returns {*} Returns the property value.
			*/
			function safeGet(object, key) {
				if (key === "constructor" && typeof object[key] === "function") return;
				if (key == "__proto__") return;
				return object[key];
			}
			/**
			* Sets metadata for `func`.
			*
			* **Note:** If this function becomes hot, i.e. is invoked a lot in a short
			* period of time, it will trip its breaker and transition to an identity
			* function to avoid garbage collection pauses in V8. See
			* [V8 issue 2070](https://bugs.chromium.org/p/v8/issues/detail?id=2070)
			* for more details.
			*
			* @private
			* @param {Function} func The function to associate metadata with.
			* @param {*} data The metadata.
			* @returns {Function} Returns `func`.
			*/
			var setData = shortOut(baseSetData);
			/**
			* A simple wrapper around the global [`setTimeout`](https://mdn.io/setTimeout).
			*
			* @private
			* @param {Function} func The function to delay.
			* @param {number} wait The number of milliseconds to delay invocation.
			* @returns {number|Object} Returns the timer id or timeout object.
			*/
			var setTimeout = ctxSetTimeout || function(func, wait) {
				return root.setTimeout(func, wait);
			};
			/**
			* Sets the `toString` method of `func` to return `string`.
			*
			* @private
			* @param {Function} func The function to modify.
			* @param {Function} string The `toString` result.
			* @returns {Function} Returns `func`.
			*/
			var setToString = shortOut(baseSetToString);
			/**
			* Sets the `toString` method of `wrapper` to mimic the source of `reference`
			* with wrapper details in a comment at the top of the source body.
			*
			* @private
			* @param {Function} wrapper The function to modify.
			* @param {Function} reference The reference function.
			* @param {number} bitmask The bitmask flags. See `createWrap` for more details.
			* @returns {Function} Returns `wrapper`.
			*/
			function setWrapToString(wrapper, reference, bitmask) {
				var source = reference + "";
				return setToString(wrapper, insertWrapDetails(source, updateWrapDetails(getWrapDetails(source), bitmask)));
			}
			/**
			* Creates a function that'll short out and invoke `identity` instead
			* of `func` when it's called `HOT_COUNT` or more times in `HOT_SPAN`
			* milliseconds.
			*
			* @private
			* @param {Function} func The function to restrict.
			* @returns {Function} Returns the new shortable function.
			*/
			function shortOut(func) {
				var count = 0, lastCalled = 0;
				return function() {
					var stamp = nativeNow(), remaining = HOT_SPAN - (stamp - lastCalled);
					lastCalled = stamp;
					if (remaining > 0) {
						if (++count >= HOT_COUNT) return arguments[0];
					} else count = 0;
					return func.apply(undefined, arguments);
				};
			}
			/**
			* A specialized version of `_.shuffle` which mutates and sets the size of `array`.
			*
			* @private
			* @param {Array} array The array to shuffle.
			* @param {number} [size=array.length] The size of `array`.
			* @returns {Array} Returns `array`.
			*/
			function shuffleSelf(array, size) {
				var index = -1, length = array.length, lastIndex = length - 1;
				size = size === undefined ? length : size;
				while (++index < size) {
					var rand = baseRandom(index, lastIndex), value = array[rand];
					array[rand] = array[index];
					array[index] = value;
				}
				array.length = size;
				return array;
			}
			/**
			* Converts `string` to a property path array.
			*
			* @private
			* @param {string} string The string to convert.
			* @returns {Array} Returns the property path array.
			*/
			var stringToPath = memoizeCapped(function(string) {
				var result = [];
				if (string.charCodeAt(0) === 46) result.push("");
				string.replace(rePropName, function(match, number, quote, subString) {
					result.push(quote ? subString.replace(reEscapeChar, "$1") : number || match);
				});
				return result;
			});
			/**
			* Converts `value` to a string key if it's not a string or symbol.
			*
			* @private
			* @param {*} value The value to inspect.
			* @returns {string|symbol} Returns the key.
			*/
			function toKey(value) {
				if (typeof value == "string" || isSymbol(value)) return value;
				var result = value + "";
				return result == "0" && 1 / value == -INFINITY ? "-0" : result;
			}
			/**
			* Converts `func` to its source code.
			*
			* @private
			* @param {Function} func The function to convert.
			* @returns {string} Returns the source code.
			*/
			function toSource(func) {
				if (func != null) {
					try {
						return funcToString.call(func);
					} catch (e) {}
					try {
						return func + "";
					} catch (e) {}
				}
				return "";
			}
			/**
			* Updates wrapper `details` based on `bitmask` flags.
			*
			* @private
			* @returns {Array} details The details to modify.
			* @param {number} bitmask The bitmask flags. See `createWrap` for more details.
			* @returns {Array} Returns `details`.
			*/
			function updateWrapDetails(details, bitmask) {
				arrayEach(wrapFlags, function(pair) {
					var value = "_." + pair[0];
					if (bitmask & pair[1] && !arrayIncludes(details, value)) details.push(value);
				});
				return details.sort();
			}
			/**
			* Creates a clone of `wrapper`.
			*
			* @private
			* @param {Object} wrapper The wrapper to clone.
			* @returns {Object} Returns the cloned wrapper.
			*/
			function wrapperClone(wrapper) {
				if (wrapper instanceof LazyWrapper) return wrapper.clone();
				var result = new LodashWrapper(wrapper.__wrapped__, wrapper.__chain__);
				result.__actions__ = copyArray(wrapper.__actions__);
				result.__index__ = wrapper.__index__;
				result.__values__ = wrapper.__values__;
				return result;
			}
			/**
			* Creates an array of elements split into groups the length of `size`.
			* If `array` can't be split evenly, the final chunk will be the remaining
			* elements.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Array
			* @param {Array} array The array to process.
			* @param {number} [size=1] The length of each chunk
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {Array} Returns the new array of chunks.
			* @example
			*
			* _.chunk(['a', 'b', 'c', 'd'], 2);
			* // => [['a', 'b'], ['c', 'd']]
			*
			* _.chunk(['a', 'b', 'c', 'd'], 3);
			* // => [['a', 'b', 'c'], ['d']]
			*/
			function chunk(array, size, guard) {
				if (guard ? isIterateeCall(array, size, guard) : size === undefined) size = 1;
				else size = nativeMax(toInteger(size), 0);
				var length = array == null ? 0 : array.length;
				if (!length || size < 1) return [];
				var index = 0, resIndex = 0, result = Array(nativeCeil(length / size));
				while (index < length) result[resIndex++] = baseSlice(array, index, index += size);
				return result;
			}
			/**
			* Creates an array with all falsey values removed. The values `false`, `null`,
			* `0`, `-0`, `0n`, `""`, `undefined`, and `NaN` are falsy.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Array
			* @param {Array} array The array to compact.
			* @returns {Array} Returns the new array of filtered values.
			* @example
			*
			* _.compact([0, 1, false, 2, '', 3]);
			* // => [1, 2, 3]
			*/
			function compact(array) {
				var index = -1, length = array == null ? 0 : array.length, resIndex = 0, result = [];
				while (++index < length) {
					var value = array[index];
					if (value) result[resIndex++] = value;
				}
				return result;
			}
			/**
			* Creates a new array concatenating `array` with any additional arrays
			* and/or values.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The array to concatenate.
			* @param {...*} [values] The values to concatenate.
			* @returns {Array} Returns the new concatenated array.
			* @example
			*
			* var array = [1];
			* var other = _.concat(array, 2, [3], [[4]]);
			*
			* console.log(other);
			* // => [1, 2, 3, [4]]
			*
			* console.log(array);
			* // => [1]
			*/
			function concat() {
				var length = arguments.length;
				if (!length) return [];
				var args = Array(length - 1), array = arguments[0], index = length;
				while (index--) args[index - 1] = arguments[index];
				return arrayPush(isArray(array) ? copyArray(array) : [array], baseFlatten(args, 1));
			}
			/**
			* Creates an array of `array` values not included in the other given arrays
			* using [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
			* for equality comparisons. The order and references of result values are
			* determined by the first array.
			*
			* **Note:** Unlike `_.pullAll`, this method returns a new array.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Array
			* @param {Array} array The array to inspect.
			* @param {...Array} [values] The values to exclude.
			* @returns {Array} Returns the new array of filtered values.
			* @see _.without, _.xor
			* @example
			*
			* _.difference([2, 1], [2, 3]);
			* // => [1]
			*/
			var difference = baseRest(function(array, values) {
				return isArrayLikeObject(array) ? baseDifference(array, baseFlatten(values, 1, isArrayLikeObject, true)) : [];
			});
			/**
			* This method is like `_.difference` except that it accepts `iteratee` which
			* is invoked for each element of `array` and `values` to generate the criterion
			* by which they're compared. The order and references of result values are
			* determined by the first array. The iteratee is invoked with one argument:
			* (value).
			*
			* **Note:** Unlike `_.pullAllBy`, this method returns a new array.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The array to inspect.
			* @param {...Array} [values] The values to exclude.
			* @param {Function} [iteratee=_.identity] The iteratee invoked per element.
			* @returns {Array} Returns the new array of filtered values.
			* @example
			*
			* _.differenceBy([2.1, 1.2], [2.3, 3.4], Math.floor);
			* // => [1.2]
			*
			* // The `_.property` iteratee shorthand.
			* _.differenceBy([{ 'x': 2 }, { 'x': 1 }], [{ 'x': 1 }], 'x');
			* // => [{ 'x': 2 }]
			*/
			var differenceBy = baseRest(function(array, values) {
				var iteratee = last(values);
				if (isArrayLikeObject(iteratee)) iteratee = undefined;
				return isArrayLikeObject(array) ? baseDifference(array, baseFlatten(values, 1, isArrayLikeObject, true), getIteratee(iteratee, 2)) : [];
			});
			/**
			* This method is like `_.difference` except that it accepts `comparator`
			* which is invoked to compare elements of `array` to `values`. The order and
			* references of result values are determined by the first array. The comparator
			* is invoked with two arguments: (arrVal, othVal).
			*
			* **Note:** Unlike `_.pullAllWith`, this method returns a new array.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The array to inspect.
			* @param {...Array} [values] The values to exclude.
			* @param {Function} [comparator] The comparator invoked per element.
			* @returns {Array} Returns the new array of filtered values.
			* @example
			*
			* var objects = [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }];
			*
			* _.differenceWith(objects, [{ 'x': 1, 'y': 2 }], _.isEqual);
			* // => [{ 'x': 2, 'y': 1 }]
			*/
			var differenceWith = baseRest(function(array, values) {
				var comparator = last(values);
				if (isArrayLikeObject(comparator)) comparator = undefined;
				return isArrayLikeObject(array) ? baseDifference(array, baseFlatten(values, 1, isArrayLikeObject, true), undefined, comparator) : [];
			});
			/**
			* Creates a slice of `array` with `n` elements dropped from the beginning.
			*
			* @static
			* @memberOf _
			* @since 0.5.0
			* @category Array
			* @param {Array} array The array to query.
			* @param {number} [n=1] The number of elements to drop.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {Array} Returns the slice of `array`.
			* @example
			*
			* _.drop([1, 2, 3]);
			* // => [2, 3]
			*
			* _.drop([1, 2, 3], 2);
			* // => [3]
			*
			* _.drop([1, 2, 3], 5);
			* // => []
			*
			* _.drop([1, 2, 3], 0);
			* // => [1, 2, 3]
			*/
			function drop(array, n, guard) {
				var length = array == null ? 0 : array.length;
				if (!length) return [];
				n = guard || n === undefined ? 1 : toInteger(n);
				return baseSlice(array, n < 0 ? 0 : n, length);
			}
			/**
			* Creates a slice of `array` with `n` elements dropped from the end.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Array
			* @param {Array} array The array to query.
			* @param {number} [n=1] The number of elements to drop.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {Array} Returns the slice of `array`.
			* @example
			*
			* _.dropRight([1, 2, 3]);
			* // => [1, 2]
			*
			* _.dropRight([1, 2, 3], 2);
			* // => [1]
			*
			* _.dropRight([1, 2, 3], 5);
			* // => []
			*
			* _.dropRight([1, 2, 3], 0);
			* // => [1, 2, 3]
			*/
			function dropRight(array, n, guard) {
				var length = array == null ? 0 : array.length;
				if (!length) return [];
				n = guard || n === undefined ? 1 : toInteger(n);
				n = length - n;
				return baseSlice(array, 0, n < 0 ? 0 : n);
			}
			/**
			* Creates a slice of `array` excluding elements dropped from the end.
			* Elements are dropped until `predicate` returns falsey. The predicate is
			* invoked with three arguments: (value, index, array).
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Array
			* @param {Array} array The array to query.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @returns {Array} Returns the slice of `array`.
			* @example
			*
			* var users = [
			*   { 'user': 'barney',  'active': true },
			*   { 'user': 'fred',    'active': false },
			*   { 'user': 'pebbles', 'active': false }
			* ];
			*
			* _.dropRightWhile(users, function(o) { return !o.active; });
			* // => objects for ['barney']
			*
			* // The `_.matches` iteratee shorthand.
			* _.dropRightWhile(users, { 'user': 'pebbles', 'active': false });
			* // => objects for ['barney', 'fred']
			*
			* // The `_.matchesProperty` iteratee shorthand.
			* _.dropRightWhile(users, ['active', false]);
			* // => objects for ['barney']
			*
			* // The `_.property` iteratee shorthand.
			* _.dropRightWhile(users, 'active');
			* // => objects for ['barney', 'fred', 'pebbles']
			*/
			function dropRightWhile(array, predicate) {
				return array && array.length ? baseWhile(array, getIteratee(predicate, 3), true, true) : [];
			}
			/**
			* Creates a slice of `array` excluding elements dropped from the beginning.
			* Elements are dropped until `predicate` returns falsey. The predicate is
			* invoked with three arguments: (value, index, array).
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Array
			* @param {Array} array The array to query.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @returns {Array} Returns the slice of `array`.
			* @example
			*
			* var users = [
			*   { 'user': 'barney',  'active': false },
			*   { 'user': 'fred',    'active': false },
			*   { 'user': 'pebbles', 'active': true }
			* ];
			*
			* _.dropWhile(users, function(o) { return !o.active; });
			* // => objects for ['pebbles']
			*
			* // The `_.matches` iteratee shorthand.
			* _.dropWhile(users, { 'user': 'barney', 'active': false });
			* // => objects for ['fred', 'pebbles']
			*
			* // The `_.matchesProperty` iteratee shorthand.
			* _.dropWhile(users, ['active', false]);
			* // => objects for ['pebbles']
			*
			* // The `_.property` iteratee shorthand.
			* _.dropWhile(users, 'active');
			* // => objects for ['barney', 'fred', 'pebbles']
			*/
			function dropWhile(array, predicate) {
				return array && array.length ? baseWhile(array, getIteratee(predicate, 3), true) : [];
			}
			/**
			* Fills elements of `array` with `value` from `start` up to, but not
			* including, `end`.
			*
			* **Note:** This method mutates `array`.
			*
			* @static
			* @memberOf _
			* @since 3.2.0
			* @category Array
			* @param {Array} array The array to fill.
			* @param {*} value The value to fill `array` with.
			* @param {number} [start=0] The start position.
			* @param {number} [end=array.length] The end position.
			* @returns {Array} Returns `array`.
			* @example
			*
			* var array = [1, 2, 3];
			*
			* _.fill(array, 'a');
			* console.log(array);
			* // => ['a', 'a', 'a']
			*
			* _.fill(Array(3), 2);
			* // => [2, 2, 2]
			*
			* _.fill([4, 6, 8, 10], '*', 1, 3);
			* // => [4, '*', '*', 10]
			*/
			function fill(array, value, start, end) {
				var length = array == null ? 0 : array.length;
				if (!length) return [];
				if (start && typeof start != "number" && isIterateeCall(array, value, start)) {
					start = 0;
					end = length;
				}
				return baseFill(array, value, start, end);
			}
			/**
			* This method is like `_.find` except that it returns the index of the first
			* element `predicate` returns truthy for instead of the element itself.
			*
			* @static
			* @memberOf _
			* @since 1.1.0
			* @category Array
			* @param {Array} array The array to inspect.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @param {number} [fromIndex=0] The index to search from.
			* @returns {number} Returns the index of the found element, else `-1`.
			* @example
			*
			* var users = [
			*   { 'user': 'barney',  'active': false },
			*   { 'user': 'fred',    'active': false },
			*   { 'user': 'pebbles', 'active': true }
			* ];
			*
			* _.findIndex(users, function(o) { return o.user == 'barney'; });
			* // => 0
			*
			* // The `_.matches` iteratee shorthand.
			* _.findIndex(users, { 'user': 'fred', 'active': false });
			* // => 1
			*
			* // The `_.matchesProperty` iteratee shorthand.
			* _.findIndex(users, ['active', false]);
			* // => 0
			*
			* // The `_.property` iteratee shorthand.
			* _.findIndex(users, 'active');
			* // => 2
			*/
			function findIndex(array, predicate, fromIndex) {
				var length = array == null ? 0 : array.length;
				if (!length) return -1;
				var index = fromIndex == null ? 0 : toInteger(fromIndex);
				if (index < 0) index = nativeMax(length + index, 0);
				return baseFindIndex(array, getIteratee(predicate, 3), index);
			}
			/**
			* This method is like `_.findIndex` except that it iterates over elements
			* of `collection` from right to left.
			*
			* @static
			* @memberOf _
			* @since 2.0.0
			* @category Array
			* @param {Array} array The array to inspect.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @param {number} [fromIndex=array.length-1] The index to search from.
			* @returns {number} Returns the index of the found element, else `-1`.
			* @example
			*
			* var users = [
			*   { 'user': 'barney',  'active': true },
			*   { 'user': 'fred',    'active': false },
			*   { 'user': 'pebbles', 'active': false }
			* ];
			*
			* _.findLastIndex(users, function(o) { return o.user == 'pebbles'; });
			* // => 2
			*
			* // The `_.matches` iteratee shorthand.
			* _.findLastIndex(users, { 'user': 'barney', 'active': true });
			* // => 0
			*
			* // The `_.matchesProperty` iteratee shorthand.
			* _.findLastIndex(users, ['active', false]);
			* // => 2
			*
			* // The `_.property` iteratee shorthand.
			* _.findLastIndex(users, 'active');
			* // => 0
			*/
			function findLastIndex(array, predicate, fromIndex) {
				var length = array == null ? 0 : array.length;
				if (!length) return -1;
				var index = length - 1;
				if (fromIndex !== undefined) {
					index = toInteger(fromIndex);
					index = fromIndex < 0 ? nativeMax(length + index, 0) : nativeMin(index, length - 1);
				}
				return baseFindIndex(array, getIteratee(predicate, 3), index, true);
			}
			/**
			* Flattens `array` a single level deep.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Array
			* @param {Array} array The array to flatten.
			* @returns {Array} Returns the new flattened array.
			* @example
			*
			* _.flatten([1, [2, [3, [4]], 5]]);
			* // => [1, 2, [3, [4]], 5]
			*/
			function flatten(array) {
				return (array == null ? 0 : array.length) ? baseFlatten(array, 1) : [];
			}
			/**
			* Recursively flattens `array`.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Array
			* @param {Array} array The array to flatten.
			* @returns {Array} Returns the new flattened array.
			* @example
			*
			* _.flattenDeep([1, [2, [3, [4]], 5]]);
			* // => [1, 2, 3, 4, 5]
			*/
			function flattenDeep(array) {
				return (array == null ? 0 : array.length) ? baseFlatten(array, INFINITY) : [];
			}
			/**
			* Recursively flatten `array` up to `depth` times.
			*
			* @static
			* @memberOf _
			* @since 4.4.0
			* @category Array
			* @param {Array} array The array to flatten.
			* @param {number} [depth=1] The maximum recursion depth.
			* @returns {Array} Returns the new flattened array.
			* @example
			*
			* var array = [1, [2, [3, [4]], 5]];
			*
			* _.flattenDepth(array, 1);
			* // => [1, 2, [3, [4]], 5]
			*
			* _.flattenDepth(array, 2);
			* // => [1, 2, 3, [4], 5]
			*/
			function flattenDepth(array, depth) {
				if (!(array == null ? 0 : array.length)) return [];
				depth = depth === undefined ? 1 : toInteger(depth);
				return baseFlatten(array, depth);
			}
			/**
			* The inverse of `_.toPairs`; this method returns an object composed
			* from key-value `pairs`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} pairs The key-value pairs.
			* @returns {Object} Returns the new object.
			* @example
			*
			* _.fromPairs([['a', 1], ['b', 2]]);
			* // => { 'a': 1, 'b': 2 }
			*/
			function fromPairs(pairs) {
				var index = -1, length = pairs == null ? 0 : pairs.length, result = {};
				while (++index < length) {
					var pair = pairs[index];
					baseAssignValue(result, pair[0], pair[1]);
				}
				return result;
			}
			/**
			* Gets the first element of `array`.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @alias first
			* @category Array
			* @param {Array} array The array to query.
			* @returns {*} Returns the first element of `array`.
			* @example
			*
			* _.head([1, 2, 3]);
			* // => 1
			*
			* _.head([]);
			* // => undefined
			*/
			function head(array) {
				return array && array.length ? array[0] : undefined;
			}
			/**
			* Gets the index at which the first occurrence of `value` is found in `array`
			* using [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
			* for equality comparisons. If `fromIndex` is negative, it's used as the
			* offset from the end of `array`.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Array
			* @param {Array} array The array to inspect.
			* @param {*} value The value to search for.
			* @param {number} [fromIndex=0] The index to search from.
			* @returns {number} Returns the index of the matched value, else `-1`.
			* @example
			*
			* _.indexOf([1, 2, 1, 2], 2);
			* // => 1
			*
			* // Search from the `fromIndex`.
			* _.indexOf([1, 2, 1, 2], 2, 2);
			* // => 3
			*/
			function indexOf(array, value, fromIndex) {
				var length = array == null ? 0 : array.length;
				if (!length) return -1;
				var index = fromIndex == null ? 0 : toInteger(fromIndex);
				if (index < 0) index = nativeMax(length + index, 0);
				return baseIndexOf(array, value, index);
			}
			/**
			* Gets all but the last element of `array`.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Array
			* @param {Array} array The array to query.
			* @returns {Array} Returns the slice of `array`.
			* @example
			*
			* _.initial([1, 2, 3]);
			* // => [1, 2]
			*/
			function initial(array) {
				return (array == null ? 0 : array.length) ? baseSlice(array, 0, -1) : [];
			}
			/**
			* Creates an array of unique values that are included in all given arrays
			* using [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
			* for equality comparisons. The order and references of result values are
			* determined by the first array.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Array
			* @param {...Array} [arrays] The arrays to inspect.
			* @returns {Array} Returns the new array of intersecting values.
			* @example
			*
			* _.intersection([2, 1], [2, 3]);
			* // => [2]
			*/
			var intersection = baseRest(function(arrays) {
				var mapped = arrayMap(arrays, castArrayLikeObject);
				return mapped.length && mapped[0] === arrays[0] ? baseIntersection(mapped) : [];
			});
			/**
			* This method is like `_.intersection` except that it accepts `iteratee`
			* which is invoked for each element of each `arrays` to generate the criterion
			* by which they're compared. The order and references of result values are
			* determined by the first array. The iteratee is invoked with one argument:
			* (value).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {...Array} [arrays] The arrays to inspect.
			* @param {Function} [iteratee=_.identity] The iteratee invoked per element.
			* @returns {Array} Returns the new array of intersecting values.
			* @example
			*
			* _.intersectionBy([2.1, 1.2], [2.3, 3.4], Math.floor);
			* // => [2.1]
			*
			* // The `_.property` iteratee shorthand.
			* _.intersectionBy([{ 'x': 1 }], [{ 'x': 2 }, { 'x': 1 }], 'x');
			* // => [{ 'x': 1 }]
			*/
			var intersectionBy = baseRest(function(arrays) {
				var iteratee = last(arrays), mapped = arrayMap(arrays, castArrayLikeObject);
				if (iteratee === last(mapped)) iteratee = undefined;
				else mapped.pop();
				return mapped.length && mapped[0] === arrays[0] ? baseIntersection(mapped, getIteratee(iteratee, 2)) : [];
			});
			/**
			* This method is like `_.intersection` except that it accepts `comparator`
			* which is invoked to compare elements of `arrays`. The order and references
			* of result values are determined by the first array. The comparator is
			* invoked with two arguments: (arrVal, othVal).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {...Array} [arrays] The arrays to inspect.
			* @param {Function} [comparator] The comparator invoked per element.
			* @returns {Array} Returns the new array of intersecting values.
			* @example
			*
			* var objects = [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }];
			* var others = [{ 'x': 1, 'y': 1 }, { 'x': 1, 'y': 2 }];
			*
			* _.intersectionWith(objects, others, _.isEqual);
			* // => [{ 'x': 1, 'y': 2 }]
			*/
			var intersectionWith = baseRest(function(arrays) {
				var comparator = last(arrays), mapped = arrayMap(arrays, castArrayLikeObject);
				comparator = typeof comparator == "function" ? comparator : undefined;
				if (comparator) mapped.pop();
				return mapped.length && mapped[0] === arrays[0] ? baseIntersection(mapped, undefined, comparator) : [];
			});
			/**
			* Converts all elements in `array` into a string separated by `separator`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The array to convert.
			* @param {string} [separator=','] The element separator.
			* @returns {string} Returns the joined string.
			* @example
			*
			* _.join(['a', 'b', 'c'], '~');
			* // => 'a~b~c'
			*/
			function join(array, separator) {
				return array == null ? "" : nativeJoin.call(array, separator);
			}
			/**
			* Gets the last element of `array`.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Array
			* @param {Array} array The array to query.
			* @returns {*} Returns the last element of `array`.
			* @example
			*
			* _.last([1, 2, 3]);
			* // => 3
			*/
			function last(array) {
				var length = array == null ? 0 : array.length;
				return length ? array[length - 1] : undefined;
			}
			/**
			* This method is like `_.indexOf` except that it iterates over elements of
			* `array` from right to left.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Array
			* @param {Array} array The array to inspect.
			* @param {*} value The value to search for.
			* @param {number} [fromIndex=array.length-1] The index to search from.
			* @returns {number} Returns the index of the matched value, else `-1`.
			* @example
			*
			* _.lastIndexOf([1, 2, 1, 2], 2);
			* // => 3
			*
			* // Search from the `fromIndex`.
			* _.lastIndexOf([1, 2, 1, 2], 2, 2);
			* // => 1
			*/
			function lastIndexOf(array, value, fromIndex) {
				var length = array == null ? 0 : array.length;
				if (!length) return -1;
				var index = length;
				if (fromIndex !== undefined) {
					index = toInteger(fromIndex);
					index = index < 0 ? nativeMax(length + index, 0) : nativeMin(index, length - 1);
				}
				return value === value ? strictLastIndexOf(array, value, index) : baseFindIndex(array, baseIsNaN, index, true);
			}
			/**
			* Gets the element at index `n` of `array`. If `n` is negative, the nth
			* element from the end is returned.
			*
			* @static
			* @memberOf _
			* @since 4.11.0
			* @category Array
			* @param {Array} array The array to query.
			* @param {number} [n=0] The index of the element to return.
			* @returns {*} Returns the nth element of `array`.
			* @example
			*
			* var array = ['a', 'b', 'c', 'd'];
			*
			* _.nth(array, 1);
			* // => 'b'
			*
			* _.nth(array, -2);
			* // => 'c';
			*/
			function nth(array, n) {
				return array && array.length ? baseNth(array, toInteger(n)) : undefined;
			}
			/**
			* Removes all given values from `array` using
			* [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
			* for equality comparisons.
			*
			* **Note:** Unlike `_.without`, this method mutates `array`. Use `_.remove`
			* to remove elements from an array by predicate.
			*
			* @static
			* @memberOf _
			* @since 2.0.0
			* @category Array
			* @param {Array} array The array to modify.
			* @param {...*} [values] The values to remove.
			* @returns {Array} Returns `array`.
			* @example
			*
			* var array = ['a', 'b', 'c', 'a', 'b', 'c'];
			*
			* _.pull(array, 'a', 'c');
			* console.log(array);
			* // => ['b', 'b']
			*/
			var pull = baseRest(pullAll);
			/**
			* This method is like `_.pull` except that it accepts an array of values to remove.
			*
			* **Note:** Unlike `_.difference`, this method mutates `array`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The array to modify.
			* @param {Array} values The values to remove.
			* @returns {Array} Returns `array`.
			* @example
			*
			* var array = ['a', 'b', 'c', 'a', 'b', 'c'];
			*
			* _.pullAll(array, ['a', 'c']);
			* console.log(array);
			* // => ['b', 'b']
			*/
			function pullAll(array, values) {
				return array && array.length && values && values.length ? basePullAll(array, values) : array;
			}
			/**
			* This method is like `_.pullAll` except that it accepts `iteratee` which is
			* invoked for each element of `array` and `values` to generate the criterion
			* by which they're compared. The iteratee is invoked with one argument: (value).
			*
			* **Note:** Unlike `_.differenceBy`, this method mutates `array`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The array to modify.
			* @param {Array} values The values to remove.
			* @param {Function} [iteratee=_.identity] The iteratee invoked per element.
			* @returns {Array} Returns `array`.
			* @example
			*
			* var array = [{ 'x': 1 }, { 'x': 2 }, { 'x': 3 }, { 'x': 1 }];
			*
			* _.pullAllBy(array, [{ 'x': 1 }, { 'x': 3 }], 'x');
			* console.log(array);
			* // => [{ 'x': 2 }]
			*/
			function pullAllBy(array, values, iteratee) {
				return array && array.length && values && values.length ? basePullAll(array, values, getIteratee(iteratee, 2)) : array;
			}
			/**
			* This method is like `_.pullAll` except that it accepts `comparator` which
			* is invoked to compare elements of `array` to `values`. The comparator is
			* invoked with two arguments: (arrVal, othVal).
			*
			* **Note:** Unlike `_.differenceWith`, this method mutates `array`.
			*
			* @static
			* @memberOf _
			* @since 4.6.0
			* @category Array
			* @param {Array} array The array to modify.
			* @param {Array} values The values to remove.
			* @param {Function} [comparator] The comparator invoked per element.
			* @returns {Array} Returns `array`.
			* @example
			*
			* var array = [{ 'x': 1, 'y': 2 }, { 'x': 3, 'y': 4 }, { 'x': 5, 'y': 6 }];
			*
			* _.pullAllWith(array, [{ 'x': 3, 'y': 4 }], _.isEqual);
			* console.log(array);
			* // => [{ 'x': 1, 'y': 2 }, { 'x': 5, 'y': 6 }]
			*/
			function pullAllWith(array, values, comparator) {
				return array && array.length && values && values.length ? basePullAll(array, values, undefined, comparator) : array;
			}
			/**
			* Removes elements from `array` corresponding to `indexes` and returns an
			* array of removed elements.
			*
			* **Note:** Unlike `_.at`, this method mutates `array`.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Array
			* @param {Array} array The array to modify.
			* @param {...(number|number[])} [indexes] The indexes of elements to remove.
			* @returns {Array} Returns the new array of removed elements.
			* @example
			*
			* var array = ['a', 'b', 'c', 'd'];
			* var pulled = _.pullAt(array, [1, 3]);
			*
			* console.log(array);
			* // => ['a', 'c']
			*
			* console.log(pulled);
			* // => ['b', 'd']
			*/
			var pullAt = flatRest(function(array, indexes) {
				var length = array == null ? 0 : array.length, result = baseAt(array, indexes);
				basePullAt(array, arrayMap(indexes, function(index) {
					return isIndex(index, length) ? +index : index;
				}).sort(compareAscending));
				return result;
			});
			/**
			* Removes all elements from `array` that `predicate` returns truthy for
			* and returns an array of the removed elements. The predicate is invoked
			* with three arguments: (value, index, array).
			*
			* **Note:** Unlike `_.filter`, this method mutates `array`. Use `_.pull`
			* to pull elements from an array by value.
			*
			* @static
			* @memberOf _
			* @since 2.0.0
			* @category Array
			* @param {Array} array The array to modify.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @returns {Array} Returns the new array of removed elements.
			* @example
			*
			* var array = [1, 2, 3, 4];
			* var evens = _.remove(array, function(n) {
			*   return n % 2 == 0;
			* });
			*
			* console.log(array);
			* // => [1, 3]
			*
			* console.log(evens);
			* // => [2, 4]
			*/
			function remove(array, predicate) {
				var result = [];
				if (!(array && array.length)) return result;
				var index = -1, indexes = [], length = array.length;
				predicate = getIteratee(predicate, 3);
				while (++index < length) {
					var value = array[index];
					if (predicate(value, index, array)) {
						result.push(value);
						indexes.push(index);
					}
				}
				basePullAt(array, indexes);
				return result;
			}
			/**
			* Reverses `array` so that the first element becomes the last, the second
			* element becomes the second to last, and so on.
			*
			* **Note:** This method mutates `array` and is based on
			* [`Array#reverse`](https://mdn.io/Array/reverse).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The array to modify.
			* @returns {Array} Returns `array`.
			* @example
			*
			* var array = [1, 2, 3];
			*
			* _.reverse(array);
			* // => [3, 2, 1]
			*
			* console.log(array);
			* // => [3, 2, 1]
			*/
			function reverse(array) {
				return array == null ? array : nativeReverse.call(array);
			}
			/**
			* Creates a slice of `array` from `start` up to, but not including, `end`.
			*
			* **Note:** This method is used instead of
			* [`Array#slice`](https://mdn.io/Array/slice) to ensure dense arrays are
			* returned.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Array
			* @param {Array} array The array to slice.
			* @param {number} [start=0] The start position.
			* @param {number} [end=array.length] The end position.
			* @returns {Array} Returns the slice of `array`.
			*/
			function slice(array, start, end) {
				var length = array == null ? 0 : array.length;
				if (!length) return [];
				if (end && typeof end != "number" && isIterateeCall(array, start, end)) {
					start = 0;
					end = length;
				} else {
					start = start == null ? 0 : toInteger(start);
					end = end === undefined ? length : toInteger(end);
				}
				return baseSlice(array, start, end);
			}
			/**
			* Uses a binary search to determine the lowest index at which `value`
			* should be inserted into `array` in order to maintain its sort order.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Array
			* @param {Array} array The sorted array to inspect.
			* @param {*} value The value to evaluate.
			* @returns {number} Returns the index at which `value` should be inserted
			*  into `array`.
			* @example
			*
			* _.sortedIndex([30, 50], 40);
			* // => 1
			*/
			function sortedIndex(array, value) {
				return baseSortedIndex(array, value);
			}
			/**
			* This method is like `_.sortedIndex` except that it accepts `iteratee`
			* which is invoked for `value` and each element of `array` to compute their
			* sort ranking. The iteratee is invoked with one argument: (value).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The sorted array to inspect.
			* @param {*} value The value to evaluate.
			* @param {Function} [iteratee=_.identity] The iteratee invoked per element.
			* @returns {number} Returns the index at which `value` should be inserted
			*  into `array`.
			* @example
			*
			* var objects = [{ 'x': 4 }, { 'x': 5 }];
			*
			* _.sortedIndexBy(objects, { 'x': 4 }, function(o) { return o.x; });
			* // => 0
			*
			* // The `_.property` iteratee shorthand.
			* _.sortedIndexBy(objects, { 'x': 4 }, 'x');
			* // => 0
			*/
			function sortedIndexBy(array, value, iteratee) {
				return baseSortedIndexBy(array, value, getIteratee(iteratee, 2));
			}
			/**
			* This method is like `_.indexOf` except that it performs a binary
			* search on a sorted `array`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The array to inspect.
			* @param {*} value The value to search for.
			* @returns {number} Returns the index of the matched value, else `-1`.
			* @example
			*
			* _.sortedIndexOf([4, 5, 5, 5, 6], 5);
			* // => 1
			*/
			function sortedIndexOf(array, value) {
				var length = array == null ? 0 : array.length;
				if (length) {
					var index = baseSortedIndex(array, value);
					if (index < length && eq(array[index], value)) return index;
				}
				return -1;
			}
			/**
			* This method is like `_.sortedIndex` except that it returns the highest
			* index at which `value` should be inserted into `array` in order to
			* maintain its sort order.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Array
			* @param {Array} array The sorted array to inspect.
			* @param {*} value The value to evaluate.
			* @returns {number} Returns the index at which `value` should be inserted
			*  into `array`.
			* @example
			*
			* _.sortedLastIndex([4, 5, 5, 5, 6], 5);
			* // => 4
			*/
			function sortedLastIndex(array, value) {
				return baseSortedIndex(array, value, true);
			}
			/**
			* This method is like `_.sortedLastIndex` except that it accepts `iteratee`
			* which is invoked for `value` and each element of `array` to compute their
			* sort ranking. The iteratee is invoked with one argument: (value).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The sorted array to inspect.
			* @param {*} value The value to evaluate.
			* @param {Function} [iteratee=_.identity] The iteratee invoked per element.
			* @returns {number} Returns the index at which `value` should be inserted
			*  into `array`.
			* @example
			*
			* var objects = [{ 'x': 4 }, { 'x': 5 }];
			*
			* _.sortedLastIndexBy(objects, { 'x': 4 }, function(o) { return o.x; });
			* // => 1
			*
			* // The `_.property` iteratee shorthand.
			* _.sortedLastIndexBy(objects, { 'x': 4 }, 'x');
			* // => 1
			*/
			function sortedLastIndexBy(array, value, iteratee) {
				return baseSortedIndexBy(array, value, getIteratee(iteratee, 2), true);
			}
			/**
			* This method is like `_.lastIndexOf` except that it performs a binary
			* search on a sorted `array`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The array to inspect.
			* @param {*} value The value to search for.
			* @returns {number} Returns the index of the matched value, else `-1`.
			* @example
			*
			* _.sortedLastIndexOf([4, 5, 5, 5, 6], 5);
			* // => 3
			*/
			function sortedLastIndexOf(array, value) {
				if (array == null ? 0 : array.length) {
					var index = baseSortedIndex(array, value, true) - 1;
					if (eq(array[index], value)) return index;
				}
				return -1;
			}
			/**
			* This method is like `_.uniq` except that it's designed and optimized
			* for sorted arrays.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The array to inspect.
			* @returns {Array} Returns the new duplicate free array.
			* @example
			*
			* _.sortedUniq([1, 1, 2]);
			* // => [1, 2]
			*/
			function sortedUniq(array) {
				return array && array.length ? baseSortedUniq(array) : [];
			}
			/**
			* This method is like `_.uniqBy` except that it's designed and optimized
			* for sorted arrays.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The array to inspect.
			* @param {Function} [iteratee] The iteratee invoked per element.
			* @returns {Array} Returns the new duplicate free array.
			* @example
			*
			* _.sortedUniqBy([1.1, 1.2, 2.3, 2.4], Math.floor);
			* // => [1.1, 2.3]
			*/
			function sortedUniqBy(array, iteratee) {
				return array && array.length ? baseSortedUniq(array, getIteratee(iteratee, 2)) : [];
			}
			/**
			* Gets all but the first element of `array`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The array to query.
			* @returns {Array} Returns the slice of `array`.
			* @example
			*
			* _.tail([1, 2, 3]);
			* // => [2, 3]
			*/
			function tail(array) {
				var length = array == null ? 0 : array.length;
				return length ? baseSlice(array, 1, length) : [];
			}
			/**
			* Creates a slice of `array` with `n` elements taken from the beginning.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Array
			* @param {Array} array The array to query.
			* @param {number} [n=1] The number of elements to take.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {Array} Returns the slice of `array`.
			* @example
			*
			* _.take([1, 2, 3]);
			* // => [1]
			*
			* _.take([1, 2, 3], 2);
			* // => [1, 2]
			*
			* _.take([1, 2, 3], 5);
			* // => [1, 2, 3]
			*
			* _.take([1, 2, 3], 0);
			* // => []
			*/
			function take(array, n, guard) {
				if (!(array && array.length)) return [];
				n = guard || n === undefined ? 1 : toInteger(n);
				return baseSlice(array, 0, n < 0 ? 0 : n);
			}
			/**
			* Creates a slice of `array` with `n` elements taken from the end.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Array
			* @param {Array} array The array to query.
			* @param {number} [n=1] The number of elements to take.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {Array} Returns the slice of `array`.
			* @example
			*
			* _.takeRight([1, 2, 3]);
			* // => [3]
			*
			* _.takeRight([1, 2, 3], 2);
			* // => [2, 3]
			*
			* _.takeRight([1, 2, 3], 5);
			* // => [1, 2, 3]
			*
			* _.takeRight([1, 2, 3], 0);
			* // => []
			*/
			function takeRight(array, n, guard) {
				var length = array == null ? 0 : array.length;
				if (!length) return [];
				n = guard || n === undefined ? 1 : toInteger(n);
				n = length - n;
				return baseSlice(array, n < 0 ? 0 : n, length);
			}
			/**
			* Creates a slice of `array` with elements taken from the end. Elements are
			* taken until `predicate` returns falsey. The predicate is invoked with
			* three arguments: (value, index, array).
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Array
			* @param {Array} array The array to query.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @returns {Array} Returns the slice of `array`.
			* @example
			*
			* var users = [
			*   { 'user': 'barney',  'active': true },
			*   { 'user': 'fred',    'active': false },
			*   { 'user': 'pebbles', 'active': false }
			* ];
			*
			* _.takeRightWhile(users, function(o) { return !o.active; });
			* // => objects for ['fred', 'pebbles']
			*
			* // The `_.matches` iteratee shorthand.
			* _.takeRightWhile(users, { 'user': 'pebbles', 'active': false });
			* // => objects for ['pebbles']
			*
			* // The `_.matchesProperty` iteratee shorthand.
			* _.takeRightWhile(users, ['active', false]);
			* // => objects for ['fred', 'pebbles']
			*
			* // The `_.property` iteratee shorthand.
			* _.takeRightWhile(users, 'active');
			* // => []
			*/
			function takeRightWhile(array, predicate) {
				return array && array.length ? baseWhile(array, getIteratee(predicate, 3), false, true) : [];
			}
			/**
			* Creates a slice of `array` with elements taken from the beginning. Elements
			* are taken until `predicate` returns falsey. The predicate is invoked with
			* three arguments: (value, index, array).
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Array
			* @param {Array} array The array to query.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @returns {Array} Returns the slice of `array`.
			* @example
			*
			* var users = [
			*   { 'user': 'barney',  'active': false },
			*   { 'user': 'fred',    'active': false },
			*   { 'user': 'pebbles', 'active': true }
			* ];
			*
			* _.takeWhile(users, function(o) { return !o.active; });
			* // => objects for ['barney', 'fred']
			*
			* // The `_.matches` iteratee shorthand.
			* _.takeWhile(users, { 'user': 'barney', 'active': false });
			* // => objects for ['barney']
			*
			* // The `_.matchesProperty` iteratee shorthand.
			* _.takeWhile(users, ['active', false]);
			* // => objects for ['barney', 'fred']
			*
			* // The `_.property` iteratee shorthand.
			* _.takeWhile(users, 'active');
			* // => []
			*/
			function takeWhile(array, predicate) {
				return array && array.length ? baseWhile(array, getIteratee(predicate, 3)) : [];
			}
			/**
			* Creates an array of unique values, in order, from all given arrays using
			* [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
			* for equality comparisons.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Array
			* @param {...Array} [arrays] The arrays to inspect.
			* @returns {Array} Returns the new array of combined values.
			* @example
			*
			* _.union([2], [1, 2]);
			* // => [2, 1]
			*/
			var union = baseRest(function(arrays) {
				return baseUniq(baseFlatten(arrays, 1, isArrayLikeObject, true));
			});
			/**
			* This method is like `_.union` except that it accepts `iteratee` which is
			* invoked for each element of each `arrays` to generate the criterion by
			* which uniqueness is computed. Result values are chosen from the first
			* array in which the value occurs. The iteratee is invoked with one argument:
			* (value).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {...Array} [arrays] The arrays to inspect.
			* @param {Function} [iteratee=_.identity] The iteratee invoked per element.
			* @returns {Array} Returns the new array of combined values.
			* @example
			*
			* _.unionBy([2.1], [1.2, 2.3], Math.floor);
			* // => [2.1, 1.2]
			*
			* // The `_.property` iteratee shorthand.
			* _.unionBy([{ 'x': 1 }], [{ 'x': 2 }, { 'x': 1 }], 'x');
			* // => [{ 'x': 1 }, { 'x': 2 }]
			*/
			var unionBy = baseRest(function(arrays) {
				var iteratee = last(arrays);
				if (isArrayLikeObject(iteratee)) iteratee = undefined;
				return baseUniq(baseFlatten(arrays, 1, isArrayLikeObject, true), getIteratee(iteratee, 2));
			});
			/**
			* This method is like `_.union` except that it accepts `comparator` which
			* is invoked to compare elements of `arrays`. Result values are chosen from
			* the first array in which the value occurs. The comparator is invoked
			* with two arguments: (arrVal, othVal).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {...Array} [arrays] The arrays to inspect.
			* @param {Function} [comparator] The comparator invoked per element.
			* @returns {Array} Returns the new array of combined values.
			* @example
			*
			* var objects = [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }];
			* var others = [{ 'x': 1, 'y': 1 }, { 'x': 1, 'y': 2 }];
			*
			* _.unionWith(objects, others, _.isEqual);
			* // => [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }, { 'x': 1, 'y': 1 }]
			*/
			var unionWith = baseRest(function(arrays) {
				var comparator = last(arrays);
				comparator = typeof comparator == "function" ? comparator : undefined;
				return baseUniq(baseFlatten(arrays, 1, isArrayLikeObject, true), undefined, comparator);
			});
			/**
			* Creates a duplicate-free version of an array, using
			* [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
			* for equality comparisons, in which only the first occurrence of each element
			* is kept. The order of result values is determined by the order they occur
			* in the array.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Array
			* @param {Array} array The array to inspect.
			* @returns {Array} Returns the new duplicate free array.
			* @example
			*
			* _.uniq([2, 1, 2]);
			* // => [2, 1]
			*/
			function uniq(array) {
				return array && array.length ? baseUniq(array) : [];
			}
			/**
			* This method is like `_.uniq` except that it accepts `iteratee` which is
			* invoked for each element in `array` to generate the criterion by which
			* uniqueness is computed. The order of result values is determined by the
			* order they occur in the array. The iteratee is invoked with one argument:
			* (value).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The array to inspect.
			* @param {Function} [iteratee=_.identity] The iteratee invoked per element.
			* @returns {Array} Returns the new duplicate free array.
			* @example
			*
			* _.uniqBy([2.1, 1.2, 2.3], Math.floor);
			* // => [2.1, 1.2]
			*
			* // The `_.property` iteratee shorthand.
			* _.uniqBy([{ 'x': 1 }, { 'x': 2 }, { 'x': 1 }], 'x');
			* // => [{ 'x': 1 }, { 'x': 2 }]
			*/
			function uniqBy(array, iteratee) {
				return array && array.length ? baseUniq(array, getIteratee(iteratee, 2)) : [];
			}
			/**
			* This method is like `_.uniq` except that it accepts `comparator` which
			* is invoked to compare elements of `array`. The order of result values is
			* determined by the order they occur in the array.The comparator is invoked
			* with two arguments: (arrVal, othVal).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The array to inspect.
			* @param {Function} [comparator] The comparator invoked per element.
			* @returns {Array} Returns the new duplicate free array.
			* @example
			*
			* var objects = [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }, { 'x': 1, 'y': 2 }];
			*
			* _.uniqWith(objects, _.isEqual);
			* // => [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }]
			*/
			function uniqWith(array, comparator) {
				comparator = typeof comparator == "function" ? comparator : undefined;
				return array && array.length ? baseUniq(array, undefined, comparator) : [];
			}
			/**
			* This method is like `_.zip` except that it accepts an array of grouped
			* elements and creates an array regrouping the elements to their pre-zip
			* configuration.
			*
			* @static
			* @memberOf _
			* @since 1.2.0
			* @category Array
			* @param {Array} array The array of grouped elements to process.
			* @returns {Array} Returns the new array of regrouped elements.
			* @example
			*
			* var zipped = _.zip(['a', 'b'], [1, 2], [true, false]);
			* // => [['a', 1, true], ['b', 2, false]]
			*
			* _.unzip(zipped);
			* // => [['a', 'b'], [1, 2], [true, false]]
			*/
			function unzip(array) {
				if (!(array && array.length)) return [];
				var length = 0;
				array = arrayFilter(array, function(group) {
					if (isArrayLikeObject(group)) {
						length = nativeMax(group.length, length);
						return true;
					}
				});
				return baseTimes(length, function(index) {
					return arrayMap(array, baseProperty(index));
				});
			}
			/**
			* This method is like `_.unzip` except that it accepts `iteratee` to specify
			* how regrouped values should be combined. The iteratee is invoked with the
			* elements of each group: (...group).
			*
			* @static
			* @memberOf _
			* @since 3.8.0
			* @category Array
			* @param {Array} array The array of grouped elements to process.
			* @param {Function} [iteratee=_.identity] The function to combine
			*  regrouped values.
			* @returns {Array} Returns the new array of regrouped elements.
			* @example
			*
			* var zipped = _.zip([1, 2], [10, 20], [100, 200]);
			* // => [[1, 10, 100], [2, 20, 200]]
			*
			* _.unzipWith(zipped, _.add);
			* // => [3, 30, 300]
			*/
			function unzipWith(array, iteratee) {
				if (!(array && array.length)) return [];
				var result = unzip(array);
				if (iteratee == null) return result;
				return arrayMap(result, function(group) {
					return apply(iteratee, undefined, group);
				});
			}
			/**
			* Creates an array excluding all given values using
			* [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
			* for equality comparisons.
			*
			* **Note:** Unlike `_.pull`, this method returns a new array.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Array
			* @param {Array} array The array to inspect.
			* @param {...*} [values] The values to exclude.
			* @returns {Array} Returns the new array of filtered values.
			* @see _.difference, _.xor
			* @example
			*
			* _.without([2, 1, 2, 3], 1, 2);
			* // => [3]
			*/
			var without = baseRest(function(array, values) {
				return isArrayLikeObject(array) ? baseDifference(array, values) : [];
			});
			/**
			* Creates an array of unique values that is the
			* [symmetric difference](https://en.wikipedia.org/wiki/Symmetric_difference)
			* of the given arrays. The order of result values is determined by the order
			* they occur in the arrays.
			*
			* @static
			* @memberOf _
			* @since 2.4.0
			* @category Array
			* @param {...Array} [arrays] The arrays to inspect.
			* @returns {Array} Returns the new array of filtered values.
			* @see _.difference, _.without
			* @example
			*
			* _.xor([2, 1], [2, 3]);
			* // => [1, 3]
			*/
			var xor = baseRest(function(arrays) {
				return baseXor(arrayFilter(arrays, isArrayLikeObject));
			});
			/**
			* This method is like `_.xor` except that it accepts `iteratee` which is
			* invoked for each element of each `arrays` to generate the criterion by
			* which by which they're compared. The order of result values is determined
			* by the order they occur in the arrays. The iteratee is invoked with one
			* argument: (value).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {...Array} [arrays] The arrays to inspect.
			* @param {Function} [iteratee=_.identity] The iteratee invoked per element.
			* @returns {Array} Returns the new array of filtered values.
			* @example
			*
			* _.xorBy([2.1, 1.2], [2.3, 3.4], Math.floor);
			* // => [1.2, 3.4]
			*
			* // The `_.property` iteratee shorthand.
			* _.xorBy([{ 'x': 1 }], [{ 'x': 2 }, { 'x': 1 }], 'x');
			* // => [{ 'x': 2 }]
			*/
			var xorBy = baseRest(function(arrays) {
				var iteratee = last(arrays);
				if (isArrayLikeObject(iteratee)) iteratee = undefined;
				return baseXor(arrayFilter(arrays, isArrayLikeObject), getIteratee(iteratee, 2));
			});
			/**
			* This method is like `_.xor` except that it accepts `comparator` which is
			* invoked to compare elements of `arrays`. The order of result values is
			* determined by the order they occur in the arrays. The comparator is invoked
			* with two arguments: (arrVal, othVal).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {...Array} [arrays] The arrays to inspect.
			* @param {Function} [comparator] The comparator invoked per element.
			* @returns {Array} Returns the new array of filtered values.
			* @example
			*
			* var objects = [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }];
			* var others = [{ 'x': 1, 'y': 1 }, { 'x': 1, 'y': 2 }];
			*
			* _.xorWith(objects, others, _.isEqual);
			* // => [{ 'x': 2, 'y': 1 }, { 'x': 1, 'y': 1 }]
			*/
			var xorWith = baseRest(function(arrays) {
				var comparator = last(arrays);
				comparator = typeof comparator == "function" ? comparator : undefined;
				return baseXor(arrayFilter(arrays, isArrayLikeObject), undefined, comparator);
			});
			/**
			* Creates an array of grouped elements, the first of which contains the
			* first elements of the given arrays, the second of which contains the
			* second elements of the given arrays, and so on.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Array
			* @param {...Array} [arrays] The arrays to process.
			* @returns {Array} Returns the new array of grouped elements.
			* @example
			*
			* _.zip(['a', 'b'], [1, 2], [true, false]);
			* // => [['a', 1, true], ['b', 2, false]]
			*/
			var zip = baseRest(unzip);
			/**
			* This method is like `_.fromPairs` except that it accepts two arrays,
			* one of property identifiers and one of corresponding values.
			*
			* @static
			* @memberOf _
			* @since 0.4.0
			* @category Array
			* @param {Array} [props=[]] The property identifiers.
			* @param {Array} [values=[]] The property values.
			* @returns {Object} Returns the new object.
			* @example
			*
			* _.zipObject(['a', 'b'], [1, 2]);
			* // => { 'a': 1, 'b': 2 }
			*/
			function zipObject(props, values) {
				return baseZipObject(props || [], values || [], assignValue);
			}
			/**
			* This method is like `_.zipObject` except that it supports property paths.
			*
			* @static
			* @memberOf _
			* @since 4.1.0
			* @category Array
			* @param {Array} [props=[]] The property identifiers.
			* @param {Array} [values=[]] The property values.
			* @returns {Object} Returns the new object.
			* @example
			*
			* _.zipObjectDeep(['a.b[0].c', 'a.b[1].d'], [1, 2]);
			* // => { 'a': { 'b': [{ 'c': 1 }, { 'd': 2 }] } }
			*/
			function zipObjectDeep(props, values) {
				return baseZipObject(props || [], values || [], baseSet);
			}
			/**
			* This method is like `_.zip` except that it accepts `iteratee` to specify
			* how grouped values should be combined. The iteratee is invoked with the
			* elements of each group: (...group).
			*
			* @static
			* @memberOf _
			* @since 3.8.0
			* @category Array
			* @param {...Array} [arrays] The arrays to process.
			* @param {Function} [iteratee=_.identity] The function to combine
			*  grouped values.
			* @returns {Array} Returns the new array of grouped elements.
			* @example
			*
			* _.zipWith([1, 2], [10, 20], [100, 200], function(a, b, c) {
			*   return a + b + c;
			* });
			* // => [111, 222]
			*/
			var zipWith = baseRest(function(arrays) {
				var length = arrays.length, iteratee = length > 1 ? arrays[length - 1] : undefined;
				iteratee = typeof iteratee == "function" ? (arrays.pop(), iteratee) : undefined;
				return unzipWith(arrays, iteratee);
			});
			/**
			* Creates a `lodash` wrapper instance that wraps `value` with explicit method
			* chain sequences enabled. The result of such sequences must be unwrapped
			* with `_#value`.
			*
			* @static
			* @memberOf _
			* @since 1.3.0
			* @category Seq
			* @param {*} value The value to wrap.
			* @returns {Object} Returns the new `lodash` wrapper instance.
			* @example
			*
			* var users = [
			*   { 'user': 'barney',  'age': 36 },
			*   { 'user': 'fred',    'age': 40 },
			*   { 'user': 'pebbles', 'age': 1 }
			* ];
			*
			* var youngest = _
			*   .chain(users)
			*   .sortBy('age')
			*   .map(function(o) {
			*     return o.user + ' is ' + o.age;
			*   })
			*   .head()
			*   .value();
			* // => 'pebbles is 1'
			*/
			function chain(value) {
				var result = lodash(value);
				result.__chain__ = true;
				return result;
			}
			/**
			* This method invokes `interceptor` and returns `value`. The interceptor
			* is invoked with one argument; (value). The purpose of this method is to
			* "tap into" a method chain sequence in order to modify intermediate results.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Seq
			* @param {*} value The value to provide to `interceptor`.
			* @param {Function} interceptor The function to invoke.
			* @returns {*} Returns `value`.
			* @example
			*
			* _([1, 2, 3])
			*  .tap(function(array) {
			*    // Mutate input array.
			*    array.pop();
			*  })
			*  .reverse()
			*  .value();
			* // => [2, 1]
			*/
			function tap(value, interceptor) {
				interceptor(value);
				return value;
			}
			/**
			* This method is like `_.tap` except that it returns the result of `interceptor`.
			* The purpose of this method is to "pass thru" values replacing intermediate
			* results in a method chain sequence.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Seq
			* @param {*} value The value to provide to `interceptor`.
			* @param {Function} interceptor The function to invoke.
			* @returns {*} Returns the result of `interceptor`.
			* @example
			*
			* _('  abc  ')
			*  .chain()
			*  .trim()
			*  .thru(function(value) {
			*    return [value];
			*  })
			*  .value();
			* // => ['abc']
			*/
			function thru(value, interceptor) {
				return interceptor(value);
			}
			/**
			* This method is the wrapper version of `_.at`.
			*
			* @name at
			* @memberOf _
			* @since 1.0.0
			* @category Seq
			* @param {...(string|string[])} [paths] The property paths to pick.
			* @returns {Object} Returns the new `lodash` wrapper instance.
			* @example
			*
			* var object = { 'a': [{ 'b': { 'c': 3 } }, 4] };
			*
			* _(object).at(['a[0].b.c', 'a[1]']).value();
			* // => [3, 4]
			*/
			var wrapperAt = flatRest(function(paths) {
				var length = paths.length, start = length ? paths[0] : 0, value = this.__wrapped__, interceptor = function(object) {
					return baseAt(object, paths);
				};
				if (length > 1 || this.__actions__.length || !(value instanceof LazyWrapper) || !isIndex(start)) return this.thru(interceptor);
				value = value.slice(start, +start + (length ? 1 : 0));
				value.__actions__.push({
					"func": thru,
					"args": [interceptor],
					"thisArg": undefined
				});
				return new LodashWrapper(value, this.__chain__).thru(function(array) {
					if (length && !array.length) array.push(undefined);
					return array;
				});
			});
			/**
			* Creates a `lodash` wrapper instance with explicit method chain sequences enabled.
			*
			* @name chain
			* @memberOf _
			* @since 0.1.0
			* @category Seq
			* @returns {Object} Returns the new `lodash` wrapper instance.
			* @example
			*
			* var users = [
			*   { 'user': 'barney', 'age': 36 },
			*   { 'user': 'fred',   'age': 40 }
			* ];
			*
			* // A sequence without explicit chaining.
			* _(users).head();
			* // => { 'user': 'barney', 'age': 36 }
			*
			* // A sequence with explicit chaining.
			* _(users)
			*   .chain()
			*   .head()
			*   .pick('user')
			*   .value();
			* // => { 'user': 'barney' }
			*/
			function wrapperChain() {
				return chain(this);
			}
			/**
			* Executes the chain sequence and returns the wrapped result.
			*
			* @name commit
			* @memberOf _
			* @since 3.2.0
			* @category Seq
			* @returns {Object} Returns the new `lodash` wrapper instance.
			* @example
			*
			* var array = [1, 2];
			* var wrapped = _(array).push(3);
			*
			* console.log(array);
			* // => [1, 2]
			*
			* wrapped = wrapped.commit();
			* console.log(array);
			* // => [1, 2, 3]
			*
			* wrapped.last();
			* // => 3
			*
			* console.log(array);
			* // => [1, 2, 3]
			*/
			function wrapperCommit() {
				return new LodashWrapper(this.value(), this.__chain__);
			}
			/**
			* Gets the next value on a wrapped object following the
			* [iterator protocol](https://mdn.io/iteration_protocols#iterator).
			*
			* @name next
			* @memberOf _
			* @since 4.0.0
			* @category Seq
			* @returns {Object} Returns the next iterator value.
			* @example
			*
			* var wrapped = _([1, 2]);
			*
			* wrapped.next();
			* // => { 'done': false, 'value': 1 }
			*
			* wrapped.next();
			* // => { 'done': false, 'value': 2 }
			*
			* wrapped.next();
			* // => { 'done': true, 'value': undefined }
			*/
			function wrapperNext() {
				if (this.__values__ === undefined) this.__values__ = toArray(this.value());
				var done = this.__index__ >= this.__values__.length;
				return {
					"done": done,
					"value": done ? undefined : this.__values__[this.__index__++]
				};
			}
			/**
			* Enables the wrapper to be iterable.
			*
			* @name Symbol.iterator
			* @memberOf _
			* @since 4.0.0
			* @category Seq
			* @returns {Object} Returns the wrapper object.
			* @example
			*
			* var wrapped = _([1, 2]);
			*
			* wrapped[Symbol.iterator]() === wrapped;
			* // => true
			*
			* Array.from(wrapped);
			* // => [1, 2]
			*/
			function wrapperToIterator() {
				return this;
			}
			/**
			* Creates a clone of the chain sequence planting `value` as the wrapped value.
			*
			* @name plant
			* @memberOf _
			* @since 3.2.0
			* @category Seq
			* @param {*} value The value to plant.
			* @returns {Object} Returns the new `lodash` wrapper instance.
			* @example
			*
			* function square(n) {
			*   return n * n;
			* }
			*
			* var wrapped = _([1, 2]).map(square);
			* var other = wrapped.plant([3, 4]);
			*
			* other.value();
			* // => [9, 16]
			*
			* wrapped.value();
			* // => [1, 4]
			*/
			function wrapperPlant(value) {
				var result, parent = this;
				while (parent instanceof baseLodash) {
					var clone = wrapperClone(parent);
					clone.__index__ = 0;
					clone.__values__ = undefined;
					if (result) previous.__wrapped__ = clone;
					else result = clone;
					var previous = clone;
					parent = parent.__wrapped__;
				}
				previous.__wrapped__ = value;
				return result;
			}
			/**
			* This method is the wrapper version of `_.reverse`.
			*
			* **Note:** This method mutates the wrapped array.
			*
			* @name reverse
			* @memberOf _
			* @since 0.1.0
			* @category Seq
			* @returns {Object} Returns the new `lodash` wrapper instance.
			* @example
			*
			* var array = [1, 2, 3];
			*
			* _(array).reverse().value()
			* // => [3, 2, 1]
			*
			* console.log(array);
			* // => [3, 2, 1]
			*/
			function wrapperReverse() {
				var value = this.__wrapped__;
				if (value instanceof LazyWrapper) {
					var wrapped = value;
					if (this.__actions__.length) wrapped = new LazyWrapper(this);
					wrapped = wrapped.reverse();
					wrapped.__actions__.push({
						"func": thru,
						"args": [reverse],
						"thisArg": undefined
					});
					return new LodashWrapper(wrapped, this.__chain__);
				}
				return this.thru(reverse);
			}
			/**
			* Executes the chain sequence to resolve the unwrapped value.
			*
			* @name value
			* @memberOf _
			* @since 0.1.0
			* @alias toJSON, valueOf
			* @category Seq
			* @returns {*} Returns the resolved unwrapped value.
			* @example
			*
			* _([1, 2, 3]).value();
			* // => [1, 2, 3]
			*/
			function wrapperValue() {
				return baseWrapperValue(this.__wrapped__, this.__actions__);
			}
			/**
			* Creates an object composed of keys generated from the results of running
			* each element of `collection` thru `iteratee`. The corresponding value of
			* each key is the number of times the key was returned by `iteratee`. The
			* iteratee is invoked with one argument: (value).
			*
			* @static
			* @memberOf _
			* @since 0.5.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [iteratee=_.identity] The iteratee to transform keys.
			* @returns {Object} Returns the composed aggregate object.
			* @example
			*
			* _.countBy([6.1, 4.2, 6.3], Math.floor);
			* // => { '4': 1, '6': 2 }
			*
			* // The `_.property` iteratee shorthand.
			* _.countBy(['one', 'two', 'three'], 'length');
			* // => { '3': 2, '5': 1 }
			*/
			var countBy = createAggregator(function(result, value, key) {
				if (hasOwnProperty.call(result, key)) ++result[key];
				else baseAssignValue(result, key, 1);
			});
			/**
			* Checks if `predicate` returns truthy for **all** elements of `collection`.
			* Iteration is stopped once `predicate` returns falsey. The predicate is
			* invoked with three arguments: (value, index|key, collection).
			*
			* **Note:** This method returns `true` for
			* [empty collections](https://en.wikipedia.org/wiki/Empty_set) because
			* [everything is true](https://en.wikipedia.org/wiki/Vacuous_truth) of
			* elements of empty collections.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {boolean} Returns `true` if all elements pass the predicate check,
			*  else `false`.
			* @example
			*
			* _.every([true, 1, null, 'yes'], Boolean);
			* // => false
			*
			* var users = [
			*   { 'user': 'barney', 'age': 36, 'active': false },
			*   { 'user': 'fred',   'age': 40, 'active': false }
			* ];
			*
			* // The `_.matches` iteratee shorthand.
			* _.every(users, { 'user': 'barney', 'active': false });
			* // => false
			*
			* // The `_.matchesProperty` iteratee shorthand.
			* _.every(users, ['active', false]);
			* // => true
			*
			* // The `_.property` iteratee shorthand.
			* _.every(users, 'active');
			* // => false
			*/
			function every(collection, predicate, guard) {
				var func = isArray(collection) ? arrayEvery : baseEvery;
				if (guard && isIterateeCall(collection, predicate, guard)) predicate = undefined;
				return func(collection, getIteratee(predicate, 3));
			}
			/**
			* Iterates over elements of `collection`, returning an array of all elements
			* `predicate` returns truthy for. The predicate is invoked with three
			* arguments: (value, index|key, collection).
			*
			* **Note:** Unlike `_.remove`, this method returns a new array.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @returns {Array} Returns the new filtered array.
			* @see _.reject
			* @example
			*
			* var users = [
			*   { 'user': 'barney', 'age': 36, 'active': true },
			*   { 'user': 'fred',   'age': 40, 'active': false }
			* ];
			*
			* _.filter(users, function(o) { return !o.active; });
			* // => objects for ['fred']
			*
			* // The `_.matches` iteratee shorthand.
			* _.filter(users, { 'age': 36, 'active': true });
			* // => objects for ['barney']
			*
			* // The `_.matchesProperty` iteratee shorthand.
			* _.filter(users, ['active', false]);
			* // => objects for ['fred']
			*
			* // The `_.property` iteratee shorthand.
			* _.filter(users, 'active');
			* // => objects for ['barney']
			*
			* // Combining several predicates using `_.overEvery` or `_.overSome`.
			* _.filter(users, _.overSome([{ 'age': 36 }, ['age', 40]]));
			* // => objects for ['fred', 'barney']
			*/
			function filter(collection, predicate) {
				return (isArray(collection) ? arrayFilter : baseFilter)(collection, getIteratee(predicate, 3));
			}
			/**
			* Iterates over elements of `collection`, returning the first element
			* `predicate` returns truthy for. The predicate is invoked with three
			* arguments: (value, index|key, collection).
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Collection
			* @param {Array|Object} collection The collection to inspect.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @param {number} [fromIndex=0] The index to search from.
			* @returns {*} Returns the matched element, else `undefined`.
			* @example
			*
			* var users = [
			*   { 'user': 'barney',  'age': 36, 'active': true },
			*   { 'user': 'fred',    'age': 40, 'active': false },
			*   { 'user': 'pebbles', 'age': 1,  'active': true }
			* ];
			*
			* _.find(users, function(o) { return o.age < 40; });
			* // => object for 'barney'
			*
			* // The `_.matches` iteratee shorthand.
			* _.find(users, { 'age': 1, 'active': true });
			* // => object for 'pebbles'
			*
			* // The `_.matchesProperty` iteratee shorthand.
			* _.find(users, ['active', false]);
			* // => object for 'fred'
			*
			* // The `_.property` iteratee shorthand.
			* _.find(users, 'active');
			* // => object for 'barney'
			*/
			var find = createFind(findIndex);
			/**
			* This method is like `_.find` except that it iterates over elements of
			* `collection` from right to left.
			*
			* @static
			* @memberOf _
			* @since 2.0.0
			* @category Collection
			* @param {Array|Object} collection The collection to inspect.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @param {number} [fromIndex=collection.length-1] The index to search from.
			* @returns {*} Returns the matched element, else `undefined`.
			* @example
			*
			* _.findLast([1, 2, 3, 4], function(n) {
			*   return n % 2 == 1;
			* });
			* // => 3
			*/
			var findLast = createFind(findLastIndex);
			/**
			* Creates a flattened array of values by running each element in `collection`
			* thru `iteratee` and flattening the mapped results. The iteratee is invoked
			* with three arguments: (value, index|key, collection).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @returns {Array} Returns the new flattened array.
			* @example
			*
			* function duplicate(n) {
			*   return [n, n];
			* }
			*
			* _.flatMap([1, 2], duplicate);
			* // => [1, 1, 2, 2]
			*/
			function flatMap(collection, iteratee) {
				return baseFlatten(map(collection, iteratee), 1);
			}
			/**
			* This method is like `_.flatMap` except that it recursively flattens the
			* mapped results.
			*
			* @static
			* @memberOf _
			* @since 4.7.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @returns {Array} Returns the new flattened array.
			* @example
			*
			* function duplicate(n) {
			*   return [[[n, n]]];
			* }
			*
			* _.flatMapDeep([1, 2], duplicate);
			* // => [1, 1, 2, 2]
			*/
			function flatMapDeep(collection, iteratee) {
				return baseFlatten(map(collection, iteratee), INFINITY);
			}
			/**
			* This method is like `_.flatMap` except that it recursively flattens the
			* mapped results up to `depth` times.
			*
			* @static
			* @memberOf _
			* @since 4.7.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @param {number} [depth=1] The maximum recursion depth.
			* @returns {Array} Returns the new flattened array.
			* @example
			*
			* function duplicate(n) {
			*   return [[[n, n]]];
			* }
			*
			* _.flatMapDepth([1, 2], duplicate, 2);
			* // => [[1, 1], [2, 2]]
			*/
			function flatMapDepth(collection, iteratee, depth) {
				depth = depth === undefined ? 1 : toInteger(depth);
				return baseFlatten(map(collection, iteratee), depth);
			}
			/**
			* Iterates over elements of `collection` and invokes `iteratee` for each element.
			* The iteratee is invoked with three arguments: (value, index|key, collection).
			* Iteratee functions may exit iteration early by explicitly returning `false`.
			*
			* **Note:** As with other "Collections" methods, objects with a "length"
			* property are iterated like arrays. To avoid this behavior use `_.forIn`
			* or `_.forOwn` for object iteration.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @alias each
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @returns {Array|Object} Returns `collection`.
			* @see _.forEachRight
			* @example
			*
			* _.forEach([1, 2], function(value) {
			*   console.log(value);
			* });
			* // => Logs `1` then `2`.
			*
			* _.forEach({ 'a': 1, 'b': 2 }, function(value, key) {
			*   console.log(key);
			* });
			* // => Logs 'a' then 'b' (iteration order is not guaranteed).
			*/
			function forEach(collection, iteratee) {
				return (isArray(collection) ? arrayEach : baseEach)(collection, getIteratee(iteratee, 3));
			}
			/**
			* This method is like `_.forEach` except that it iterates over elements of
			* `collection` from right to left.
			*
			* @static
			* @memberOf _
			* @since 2.0.0
			* @alias eachRight
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @returns {Array|Object} Returns `collection`.
			* @see _.forEach
			* @example
			*
			* _.forEachRight([1, 2], function(value) {
			*   console.log(value);
			* });
			* // => Logs `2` then `1`.
			*/
			function forEachRight(collection, iteratee) {
				return (isArray(collection) ? arrayEachRight : baseEachRight)(collection, getIteratee(iteratee, 3));
			}
			/**
			* Creates an object composed of keys generated from the results of running
			* each element of `collection` thru `iteratee`. The order of grouped values
			* is determined by the order they occur in `collection`. The corresponding
			* value of each key is an array of elements responsible for generating the
			* key. The iteratee is invoked with one argument: (value).
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [iteratee=_.identity] The iteratee to transform keys.
			* @returns {Object} Returns the composed aggregate object.
			* @example
			*
			* _.groupBy([6.1, 4.2, 6.3], Math.floor);
			* // => { '4': [4.2], '6': [6.1, 6.3] }
			*
			* // The `_.property` iteratee shorthand.
			* _.groupBy(['one', 'two', 'three'], 'length');
			* // => { '3': ['one', 'two'], '5': ['three'] }
			*/
			var groupBy = createAggregator(function(result, value, key) {
				if (hasOwnProperty.call(result, key)) result[key].push(value);
				else baseAssignValue(result, key, [value]);
			});
			/**
			* Checks if `value` is in `collection`. If `collection` is a string, it's
			* checked for a substring of `value`, otherwise
			* [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
			* is used for equality comparisons. If `fromIndex` is negative, it's used as
			* the offset from the end of `collection`.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Collection
			* @param {Array|Object|string} collection The collection to inspect.
			* @param {*} value The value to search for.
			* @param {number} [fromIndex=0] The index to search from.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.reduce`.
			* @returns {boolean} Returns `true` if `value` is found, else `false`.
			* @example
			*
			* _.includes([1, 2, 3], 1);
			* // => true
			*
			* _.includes([1, 2, 3], 1, 2);
			* // => false
			*
			* _.includes({ 'a': 1, 'b': 2 }, 1);
			* // => true
			*
			* _.includes('abcd', 'bc');
			* // => true
			*/
			function includes(collection, value, fromIndex, guard) {
				collection = isArrayLike(collection) ? collection : values(collection);
				fromIndex = fromIndex && !guard ? toInteger(fromIndex) : 0;
				var length = collection.length;
				if (fromIndex < 0) fromIndex = nativeMax(length + fromIndex, 0);
				return isString(collection) ? fromIndex <= length && collection.indexOf(value, fromIndex) > -1 : !!length && baseIndexOf(collection, value, fromIndex) > -1;
			}
			/**
			* Invokes the method at `path` of each element in `collection`, returning
			* an array of the results of each invoked method. Any additional arguments
			* are provided to each invoked method. If `path` is a function, it's invoked
			* for, and `this` bound to, each element in `collection`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Array|Function|string} path The path of the method to invoke or
			*  the function invoked per iteration.
			* @param {...*} [args] The arguments to invoke each method with.
			* @returns {Array} Returns the array of results.
			* @example
			*
			* _.invokeMap([[5, 1, 7], [3, 2, 1]], 'sort');
			* // => [[1, 5, 7], [1, 2, 3]]
			*
			* _.invokeMap([123, 456], String.prototype.split, '');
			* // => [['1', '2', '3'], ['4', '5', '6']]
			*/
			var invokeMap = baseRest(function(collection, path, args) {
				var index = -1, isFunc = typeof path == "function", result = isArrayLike(collection) ? Array(collection.length) : [];
				baseEach(collection, function(value) {
					result[++index] = isFunc ? apply(path, value, args) : baseInvoke(value, path, args);
				});
				return result;
			});
			/**
			* Creates an object composed of keys generated from the results of running
			* each element of `collection` thru `iteratee`. The corresponding value of
			* each key is the last element responsible for generating the key. The
			* iteratee is invoked with one argument: (value).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [iteratee=_.identity] The iteratee to transform keys.
			* @returns {Object} Returns the composed aggregate object.
			* @example
			*
			* var array = [
			*   { 'dir': 'left', 'code': 97 },
			*   { 'dir': 'right', 'code': 100 }
			* ];
			*
			* _.keyBy(array, function(o) {
			*   return String.fromCharCode(o.code);
			* });
			* // => { 'a': { 'dir': 'left', 'code': 97 }, 'd': { 'dir': 'right', 'code': 100 } }
			*
			* _.keyBy(array, 'dir');
			* // => { 'left': { 'dir': 'left', 'code': 97 }, 'right': { 'dir': 'right', 'code': 100 } }
			*/
			var keyBy = createAggregator(function(result, value, key) {
				baseAssignValue(result, key, value);
			});
			/**
			* Creates an array of values by running each element in `collection` thru
			* `iteratee`. The iteratee is invoked with three arguments:
			* (value, index|key, collection).
			*
			* Many lodash methods are guarded to work as iteratees for methods like
			* `_.every`, `_.filter`, `_.map`, `_.mapValues`, `_.reject`, and `_.some`.
			*
			* The guarded methods are:
			* `ary`, `chunk`, `curry`, `curryRight`, `drop`, `dropRight`, `every`,
			* `fill`, `invert`, `parseInt`, `random`, `range`, `rangeRight`, `repeat`,
			* `sampleSize`, `slice`, `some`, `sortBy`, `split`, `take`, `takeRight`,
			* `template`, `trim`, `trimEnd`, `trimStart`, and `words`
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @returns {Array} Returns the new mapped array.
			* @example
			*
			* function square(n) {
			*   return n * n;
			* }
			*
			* _.map([4, 8], square);
			* // => [16, 64]
			*
			* _.map({ 'a': 4, 'b': 8 }, square);
			* // => [16, 64] (iteration order is not guaranteed)
			*
			* var users = [
			*   { 'user': 'barney' },
			*   { 'user': 'fred' }
			* ];
			*
			* // The `_.property` iteratee shorthand.
			* _.map(users, 'user');
			* // => ['barney', 'fred']
			*/
			function map(collection, iteratee) {
				return (isArray(collection) ? arrayMap : baseMap)(collection, getIteratee(iteratee, 3));
			}
			/**
			* This method is like `_.sortBy` except that it allows specifying the sort
			* orders of the iteratees to sort by. If `orders` is unspecified, all values
			* are sorted in ascending order. Otherwise, specify an order of "desc" for
			* descending or "asc" for ascending sort order of corresponding values.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Array[]|Function[]|Object[]|string[]} [iteratees=[_.identity]]
			*  The iteratees to sort by.
			* @param {string[]} [orders] The sort orders of `iteratees`.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.reduce`.
			* @returns {Array} Returns the new sorted array.
			* @example
			*
			* var users = [
			*   { 'user': 'fred',   'age': 48 },
			*   { 'user': 'barney', 'age': 34 },
			*   { 'user': 'fred',   'age': 40 },
			*   { 'user': 'barney', 'age': 36 }
			* ];
			*
			* // Sort by `user` in ascending order and by `age` in descending order.
			* _.orderBy(users, ['user', 'age'], ['asc', 'desc']);
			* // => objects for [['barney', 36], ['barney', 34], ['fred', 48], ['fred', 40]]
			*/
			function orderBy(collection, iteratees, orders, guard) {
				if (collection == null) return [];
				if (!isArray(iteratees)) iteratees = iteratees == null ? [] : [iteratees];
				orders = guard ? undefined : orders;
				if (!isArray(orders)) orders = orders == null ? [] : [orders];
				return baseOrderBy(collection, iteratees, orders);
			}
			/**
			* Creates an array of elements split into two groups, the first of which
			* contains elements `predicate` returns truthy for, the second of which
			* contains elements `predicate` returns falsey for. The predicate is
			* invoked with one argument: (value).
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @returns {Array} Returns the array of grouped elements.
			* @example
			*
			* var users = [
			*   { 'user': 'barney',  'age': 36, 'active': false },
			*   { 'user': 'fred',    'age': 40, 'active': true },
			*   { 'user': 'pebbles', 'age': 1,  'active': false }
			* ];
			*
			* _.partition(users, function(o) { return o.active; });
			* // => objects for [['fred'], ['barney', 'pebbles']]
			*
			* // The `_.matches` iteratee shorthand.
			* _.partition(users, { 'age': 1, 'active': false });
			* // => objects for [['pebbles'], ['barney', 'fred']]
			*
			* // The `_.matchesProperty` iteratee shorthand.
			* _.partition(users, ['active', false]);
			* // => objects for [['barney', 'pebbles'], ['fred']]
			*
			* // The `_.property` iteratee shorthand.
			* _.partition(users, 'active');
			* // => objects for [['fred'], ['barney', 'pebbles']]
			*/
			var partition = createAggregator(function(result, value, key) {
				result[key ? 0 : 1].push(value);
			}, function() {
				return [[], []];
			});
			/**
			* Reduces `collection` to a value which is the accumulated result of running
			* each element in `collection` thru `iteratee`, where each successive
			* invocation is supplied the return value of the previous. If `accumulator`
			* is not given, the first element of `collection` is used as the initial
			* value. The iteratee is invoked with four arguments:
			* (accumulator, value, index|key, collection).
			*
			* Many lodash methods are guarded to work as iteratees for methods like
			* `_.reduce`, `_.reduceRight`, and `_.transform`.
			*
			* The guarded methods are:
			* `assign`, `defaults`, `defaultsDeep`, `includes`, `merge`, `orderBy`,
			* and `sortBy`
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @param {*} [accumulator] The initial value.
			* @returns {*} Returns the accumulated value.
			* @see _.reduceRight
			* @example
			*
			* _.reduce([1, 2], function(sum, n) {
			*   return sum + n;
			* }, 0);
			* // => 3
			*
			* _.reduce({ 'a': 1, 'b': 2, 'c': 1 }, function(result, value, key) {
			*   (result[value] || (result[value] = [])).push(key);
			*   return result;
			* }, {});
			* // => { '1': ['a', 'c'], '2': ['b'] } (iteration order is not guaranteed)
			*/
			function reduce(collection, iteratee, accumulator) {
				var func = isArray(collection) ? arrayReduce : baseReduce, initAccum = arguments.length < 3;
				return func(collection, getIteratee(iteratee, 4), accumulator, initAccum, baseEach);
			}
			/**
			* This method is like `_.reduce` except that it iterates over elements of
			* `collection` from right to left.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @param {*} [accumulator] The initial value.
			* @returns {*} Returns the accumulated value.
			* @see _.reduce
			* @example
			*
			* var array = [[0, 1], [2, 3], [4, 5]];
			*
			* _.reduceRight(array, function(flattened, other) {
			*   return flattened.concat(other);
			* }, []);
			* // => [4, 5, 2, 3, 0, 1]
			*/
			function reduceRight(collection, iteratee, accumulator) {
				var func = isArray(collection) ? arrayReduceRight : baseReduce, initAccum = arguments.length < 3;
				return func(collection, getIteratee(iteratee, 4), accumulator, initAccum, baseEachRight);
			}
			/**
			* The opposite of `_.filter`; this method returns the elements of `collection`
			* that `predicate` does **not** return truthy for.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @returns {Array} Returns the new filtered array.
			* @see _.filter
			* @example
			*
			* var users = [
			*   { 'user': 'barney', 'age': 36, 'active': false },
			*   { 'user': 'fred',   'age': 40, 'active': true }
			* ];
			*
			* _.reject(users, function(o) { return !o.active; });
			* // => objects for ['fred']
			*
			* // The `_.matches` iteratee shorthand.
			* _.reject(users, { 'age': 40, 'active': true });
			* // => objects for ['barney']
			*
			* // The `_.matchesProperty` iteratee shorthand.
			* _.reject(users, ['active', false]);
			* // => objects for ['fred']
			*
			* // The `_.property` iteratee shorthand.
			* _.reject(users, 'active');
			* // => objects for ['barney']
			*/
			function reject(collection, predicate) {
				return (isArray(collection) ? arrayFilter : baseFilter)(collection, negate(getIteratee(predicate, 3)));
			}
			/**
			* Gets a random element from `collection`.
			*
			* @static
			* @memberOf _
			* @since 2.0.0
			* @category Collection
			* @param {Array|Object} collection The collection to sample.
			* @returns {*} Returns the random element.
			* @example
			*
			* _.sample([1, 2, 3, 4]);
			* // => 2
			*/
			function sample(collection) {
				return (isArray(collection) ? arraySample : baseSample)(collection);
			}
			/**
			* Gets `n` random elements at unique keys from `collection` up to the
			* size of `collection`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Collection
			* @param {Array|Object} collection The collection to sample.
			* @param {number} [n=1] The number of elements to sample.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {Array} Returns the random elements.
			* @example
			*
			* _.sampleSize([1, 2, 3], 2);
			* // => [3, 1]
			*
			* _.sampleSize([1, 2, 3], 4);
			* // => [2, 3, 1]
			*/
			function sampleSize(collection, n, guard) {
				if (guard ? isIterateeCall(collection, n, guard) : n === undefined) n = 1;
				else n = toInteger(n);
				return (isArray(collection) ? arraySampleSize : baseSampleSize)(collection, n);
			}
			/**
			* Creates an array of shuffled values, using a version of the
			* [Fisher-Yates shuffle](https://en.wikipedia.org/wiki/Fisher-Yates_shuffle).
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Collection
			* @param {Array|Object} collection The collection to shuffle.
			* @returns {Array} Returns the new shuffled array.
			* @example
			*
			* _.shuffle([1, 2, 3, 4]);
			* // => [4, 1, 3, 2]
			*/
			function shuffle(collection) {
				return (isArray(collection) ? arrayShuffle : baseShuffle)(collection);
			}
			/**
			* Gets the size of `collection` by returning its length for array-like
			* values or the number of own enumerable string keyed properties for objects.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Collection
			* @param {Array|Object|string} collection The collection to inspect.
			* @returns {number} Returns the collection size.
			* @example
			*
			* _.size([1, 2, 3]);
			* // => 3
			*
			* _.size({ 'a': 1, 'b': 2 });
			* // => 2
			*
			* _.size('pebbles');
			* // => 7
			*/
			function size(collection) {
				if (collection == null) return 0;
				if (isArrayLike(collection)) return isString(collection) ? stringSize(collection) : collection.length;
				var tag = getTag(collection);
				if (tag == mapTag || tag == setTag) return collection.size;
				return baseKeys(collection).length;
			}
			/**
			* Checks if `predicate` returns truthy for **any** element of `collection`.
			* Iteration is stopped once `predicate` returns truthy. The predicate is
			* invoked with three arguments: (value, index|key, collection).
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {boolean} Returns `true` if any element passes the predicate check,
			*  else `false`.
			* @example
			*
			* _.some([null, 0, 'yes', false], Boolean);
			* // => true
			*
			* var users = [
			*   { 'user': 'barney', 'active': true },
			*   { 'user': 'fred',   'active': false }
			* ];
			*
			* // The `_.matches` iteratee shorthand.
			* _.some(users, { 'user': 'barney', 'active': false });
			* // => false
			*
			* // The `_.matchesProperty` iteratee shorthand.
			* _.some(users, ['active', false]);
			* // => true
			*
			* // The `_.property` iteratee shorthand.
			* _.some(users, 'active');
			* // => true
			*/
			function some(collection, predicate, guard) {
				var func = isArray(collection) ? arraySome : baseSome;
				if (guard && isIterateeCall(collection, predicate, guard)) predicate = undefined;
				return func(collection, getIteratee(predicate, 3));
			}
			/**
			* Creates an array of elements, sorted in ascending order by the results of
			* running each element in a collection thru each iteratee. This method
			* performs a stable sort, that is, it preserves the original sort order of
			* equal elements. The iteratees are invoked with one argument: (value).
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {...(Function|Function[])} [iteratees=[_.identity]]
			*  The iteratees to sort by.
			* @returns {Array} Returns the new sorted array.
			* @example
			*
			* var users = [
			*   { 'user': 'fred',   'age': 48 },
			*   { 'user': 'barney', 'age': 36 },
			*   { 'user': 'fred',   'age': 30 },
			*   { 'user': 'barney', 'age': 34 }
			* ];
			*
			* _.sortBy(users, [function(o) { return o.user; }]);
			* // => objects for [['barney', 36], ['barney', 34], ['fred', 48], ['fred', 30]]
			*
			* _.sortBy(users, ['user', 'age']);
			* // => objects for [['barney', 34], ['barney', 36], ['fred', 30], ['fred', 48]]
			*/
			var sortBy = baseRest(function(collection, iteratees) {
				if (collection == null) return [];
				var length = iteratees.length;
				if (length > 1 && isIterateeCall(collection, iteratees[0], iteratees[1])) iteratees = [];
				else if (length > 2 && isIterateeCall(iteratees[0], iteratees[1], iteratees[2])) iteratees = [iteratees[0]];
				return baseOrderBy(collection, baseFlatten(iteratees, 1), []);
			});
			/**
			* Gets the timestamp of the number of milliseconds that have elapsed since
			* the Unix epoch (1 January 1970 00:00:00 UTC).
			*
			* @static
			* @memberOf _
			* @since 2.4.0
			* @category Date
			* @returns {number} Returns the timestamp.
			* @example
			*
			* _.defer(function(stamp) {
			*   console.log(_.now() - stamp);
			* }, _.now());
			* // => Logs the number of milliseconds it took for the deferred invocation.
			*/
			var now = ctxNow || function() {
				return root.Date.now();
			};
			/**
			* The opposite of `_.before`; this method creates a function that invokes
			* `func` once it's called `n` or more times.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Function
			* @param {number} n The number of calls before `func` is invoked.
			* @param {Function} func The function to restrict.
			* @returns {Function} Returns the new restricted function.
			* @example
			*
			* var saves = ['profile', 'settings'];
			*
			* var done = _.after(saves.length, function() {
			*   console.log('done saving!');
			* });
			*
			* _.forEach(saves, function(type) {
			*   asyncSave({ 'type': type, 'complete': done });
			* });
			* // => Logs 'done saving!' after the two async saves have completed.
			*/
			function after(n, func) {
				if (typeof func != "function") throw new TypeError(FUNC_ERROR_TEXT);
				n = toInteger(n);
				return function() {
					if (--n < 1) return func.apply(this, arguments);
				};
			}
			/**
			* Creates a function that invokes `func`, with up to `n` arguments,
			* ignoring any additional arguments.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Function
			* @param {Function} func The function to cap arguments for.
			* @param {number} [n=func.length] The arity cap.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {Function} Returns the new capped function.
			* @example
			*
			* _.map(['6', '8', '10'], _.ary(parseInt, 1));
			* // => [6, 8, 10]
			*/
			function ary(func, n, guard) {
				n = guard ? undefined : n;
				n = func && n == null ? func.length : n;
				return createWrap(func, WRAP_ARY_FLAG, undefined, undefined, undefined, undefined, n);
			}
			/**
			* Creates a function that invokes `func`, with the `this` binding and arguments
			* of the created function, while it's called less than `n` times. Subsequent
			* calls to the created function return the result of the last `func` invocation.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Function
			* @param {number} n The number of calls at which `func` is no longer invoked.
			* @param {Function} func The function to restrict.
			* @returns {Function} Returns the new restricted function.
			* @example
			*
			* jQuery(element).on('click', _.before(5, addContactToList));
			* // => Allows adding up to 4 contacts to the list.
			*/
			function before(n, func) {
				var result;
				if (typeof func != "function") throw new TypeError(FUNC_ERROR_TEXT);
				n = toInteger(n);
				return function() {
					if (--n > 0) result = func.apply(this, arguments);
					if (n <= 1) func = undefined;
					return result;
				};
			}
			/**
			* Creates a function that invokes `func` with the `this` binding of `thisArg`
			* and `partials` prepended to the arguments it receives.
			*
			* The `_.bind.placeholder` value, which defaults to `_` in monolithic builds,
			* may be used as a placeholder for partially applied arguments.
			*
			* **Note:** Unlike native `Function#bind`, this method doesn't set the "length"
			* property of bound functions.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Function
			* @param {Function} func The function to bind.
			* @param {*} thisArg The `this` binding of `func`.
			* @param {...*} [partials] The arguments to be partially applied.
			* @returns {Function} Returns the new bound function.
			* @example
			*
			* function greet(greeting, punctuation) {
			*   return greeting + ' ' + this.user + punctuation;
			* }
			*
			* var object = { 'user': 'fred' };
			*
			* var bound = _.bind(greet, object, 'hi');
			* bound('!');
			* // => 'hi fred!'
			*
			* // Bound with placeholders.
			* var bound = _.bind(greet, object, _, '!');
			* bound('hi');
			* // => 'hi fred!'
			*/
			var bind = baseRest(function(func, thisArg, partials) {
				var bitmask = WRAP_BIND_FLAG;
				if (partials.length) {
					var holders = replaceHolders(partials, getHolder(bind));
					bitmask |= WRAP_PARTIAL_FLAG;
				}
				return createWrap(func, bitmask, thisArg, partials, holders);
			});
			/**
			* Creates a function that invokes the method at `object[key]` with `partials`
			* prepended to the arguments it receives.
			*
			* This method differs from `_.bind` by allowing bound functions to reference
			* methods that may be redefined or don't yet exist. See
			* [Peter Michaux's article](http://peter.michaux.ca/articles/lazy-function-definition-pattern)
			* for more details.
			*
			* The `_.bindKey.placeholder` value, which defaults to `_` in monolithic
			* builds, may be used as a placeholder for partially applied arguments.
			*
			* @static
			* @memberOf _
			* @since 0.10.0
			* @category Function
			* @param {Object} object The object to invoke the method on.
			* @param {string} key The key of the method.
			* @param {...*} [partials] The arguments to be partially applied.
			* @returns {Function} Returns the new bound function.
			* @example
			*
			* var object = {
			*   'user': 'fred',
			*   'greet': function(greeting, punctuation) {
			*     return greeting + ' ' + this.user + punctuation;
			*   }
			* };
			*
			* var bound = _.bindKey(object, 'greet', 'hi');
			* bound('!');
			* // => 'hi fred!'
			*
			* object.greet = function(greeting, punctuation) {
			*   return greeting + 'ya ' + this.user + punctuation;
			* };
			*
			* bound('!');
			* // => 'hiya fred!'
			*
			* // Bound with placeholders.
			* var bound = _.bindKey(object, 'greet', _, '!');
			* bound('hi');
			* // => 'hiya fred!'
			*/
			var bindKey = baseRest(function(object, key, partials) {
				var bitmask = WRAP_BIND_FLAG | WRAP_BIND_KEY_FLAG;
				if (partials.length) {
					var holders = replaceHolders(partials, getHolder(bindKey));
					bitmask |= WRAP_PARTIAL_FLAG;
				}
				return createWrap(key, bitmask, object, partials, holders);
			});
			/**
			* Creates a function that accepts arguments of `func` and either invokes
			* `func` returning its result, if at least `arity` number of arguments have
			* been provided, or returns a function that accepts the remaining `func`
			* arguments, and so on. The arity of `func` may be specified if `func.length`
			* is not sufficient.
			*
			* The `_.curry.placeholder` value, which defaults to `_` in monolithic builds,
			* may be used as a placeholder for provided arguments.
			*
			* **Note:** This method doesn't set the "length" property of curried functions.
			*
			* @static
			* @memberOf _
			* @since 2.0.0
			* @category Function
			* @param {Function} func The function to curry.
			* @param {number} [arity=func.length] The arity of `func`.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {Function} Returns the new curried function.
			* @example
			*
			* var abc = function(a, b, c) {
			*   return [a, b, c];
			* };
			*
			* var curried = _.curry(abc);
			*
			* curried(1)(2)(3);
			* // => [1, 2, 3]
			*
			* curried(1, 2)(3);
			* // => [1, 2, 3]
			*
			* curried(1, 2, 3);
			* // => [1, 2, 3]
			*
			* // Curried with placeholders.
			* curried(1)(_, 3)(2);
			* // => [1, 2, 3]
			*/
			function curry(func, arity, guard) {
				arity = guard ? undefined : arity;
				var result = createWrap(func, WRAP_CURRY_FLAG, undefined, undefined, undefined, undefined, undefined, arity);
				result.placeholder = curry.placeholder;
				return result;
			}
			/**
			* This method is like `_.curry` except that arguments are applied to `func`
			* in the manner of `_.partialRight` instead of `_.partial`.
			*
			* The `_.curryRight.placeholder` value, which defaults to `_` in monolithic
			* builds, may be used as a placeholder for provided arguments.
			*
			* **Note:** This method doesn't set the "length" property of curried functions.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Function
			* @param {Function} func The function to curry.
			* @param {number} [arity=func.length] The arity of `func`.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {Function} Returns the new curried function.
			* @example
			*
			* var abc = function(a, b, c) {
			*   return [a, b, c];
			* };
			*
			* var curried = _.curryRight(abc);
			*
			* curried(3)(2)(1);
			* // => [1, 2, 3]
			*
			* curried(2, 3)(1);
			* // => [1, 2, 3]
			*
			* curried(1, 2, 3);
			* // => [1, 2, 3]
			*
			* // Curried with placeholders.
			* curried(3)(1, _)(2);
			* // => [1, 2, 3]
			*/
			function curryRight(func, arity, guard) {
				arity = guard ? undefined : arity;
				var result = createWrap(func, WRAP_CURRY_RIGHT_FLAG, undefined, undefined, undefined, undefined, undefined, arity);
				result.placeholder = curryRight.placeholder;
				return result;
			}
			/**
			* Creates a debounced function that delays invoking `func` until after `wait`
			* milliseconds have elapsed since the last time the debounced function was
			* invoked. The debounced function comes with a `cancel` method to cancel
			* delayed `func` invocations and a `flush` method to immediately invoke them.
			* Provide `options` to indicate whether `func` should be invoked on the
			* leading and/or trailing edge of the `wait` timeout. The `func` is invoked
			* with the last arguments provided to the debounced function. Subsequent
			* calls to the debounced function return the result of the last `func`
			* invocation.
			*
			* **Note:** If `leading` and `trailing` options are `true`, `func` is
			* invoked on the trailing edge of the timeout only if the debounced function
			* is invoked more than once during the `wait` timeout.
			*
			* If `wait` is `0` and `leading` is `false`, `func` invocation is deferred
			* until to the next tick, similar to `setTimeout` with a timeout of `0`.
			*
			* See [David Corbacho's article](https://css-tricks.com/debouncing-throttling-explained-examples/)
			* for details over the differences between `_.debounce` and `_.throttle`.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Function
			* @param {Function} func The function to debounce.
			* @param {number} [wait=0] The number of milliseconds to delay.
			* @param {Object} [options={}] The options object.
			* @param {boolean} [options.leading=false]
			*  Specify invoking on the leading edge of the timeout.
			* @param {number} [options.maxWait]
			*  The maximum time `func` is allowed to be delayed before it's invoked.
			* @param {boolean} [options.trailing=true]
			*  Specify invoking on the trailing edge of the timeout.
			* @returns {Function} Returns the new debounced function.
			* @example
			*
			* // Avoid costly calculations while the window size is in flux.
			* jQuery(window).on('resize', _.debounce(calculateLayout, 150));
			*
			* // Invoke `sendMail` when clicked, debouncing subsequent calls.
			* jQuery(element).on('click', _.debounce(sendMail, 300, {
			*   'leading': true,
			*   'trailing': false
			* }));
			*
			* // Ensure `batchLog` is invoked once after 1 second of debounced calls.
			* var debounced = _.debounce(batchLog, 250, { 'maxWait': 1000 });
			* var source = new EventSource('/stream');
			* jQuery(source).on('message', debounced);
			*
			* // Cancel the trailing debounced invocation.
			* jQuery(window).on('popstate', debounced.cancel);
			*/
			function debounce(func, wait, options) {
				var lastArgs, lastThis, maxWait, result, timerId, lastCallTime, lastInvokeTime = 0, leading = false, maxing = false, trailing = true;
				if (typeof func != "function") throw new TypeError(FUNC_ERROR_TEXT);
				wait = toNumber(wait) || 0;
				if (isObject(options)) {
					leading = !!options.leading;
					maxing = "maxWait" in options;
					maxWait = maxing ? nativeMax(toNumber(options.maxWait) || 0, wait) : maxWait;
					trailing = "trailing" in options ? !!options.trailing : trailing;
				}
				function invokeFunc(time) {
					var args = lastArgs, thisArg = lastThis;
					lastArgs = lastThis = undefined;
					lastInvokeTime = time;
					result = func.apply(thisArg, args);
					return result;
				}
				function leadingEdge(time) {
					lastInvokeTime = time;
					timerId = setTimeout(timerExpired, wait);
					return leading ? invokeFunc(time) : result;
				}
				function remainingWait(time) {
					var timeSinceLastCall = time - lastCallTime, timeSinceLastInvoke = time - lastInvokeTime, timeWaiting = wait - timeSinceLastCall;
					return maxing ? nativeMin(timeWaiting, maxWait - timeSinceLastInvoke) : timeWaiting;
				}
				function shouldInvoke(time) {
					var timeSinceLastCall = time - lastCallTime, timeSinceLastInvoke = time - lastInvokeTime;
					return lastCallTime === undefined || timeSinceLastCall >= wait || timeSinceLastCall < 0 || maxing && timeSinceLastInvoke >= maxWait;
				}
				function timerExpired() {
					var time = now();
					if (shouldInvoke(time)) return trailingEdge(time);
					timerId = setTimeout(timerExpired, remainingWait(time));
				}
				function trailingEdge(time) {
					timerId = undefined;
					if (trailing && lastArgs) return invokeFunc(time);
					lastArgs = lastThis = undefined;
					return result;
				}
				function cancel() {
					if (timerId !== undefined) clearTimeout(timerId);
					lastInvokeTime = 0;
					lastArgs = lastCallTime = lastThis = timerId = undefined;
				}
				function flush() {
					return timerId === undefined ? result : trailingEdge(now());
				}
				function debounced() {
					var time = now(), isInvoking = shouldInvoke(time);
					lastArgs = arguments;
					lastThis = this;
					lastCallTime = time;
					if (isInvoking) {
						if (timerId === undefined) return leadingEdge(lastCallTime);
						if (maxing) {
							clearTimeout(timerId);
							timerId = setTimeout(timerExpired, wait);
							return invokeFunc(lastCallTime);
						}
					}
					if (timerId === undefined) timerId = setTimeout(timerExpired, wait);
					return result;
				}
				debounced.cancel = cancel;
				debounced.flush = flush;
				return debounced;
			}
			/**
			* Defers invoking the `func` until the current call stack has cleared. Any
			* additional arguments are provided to `func` when it's invoked.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Function
			* @param {Function} func The function to defer.
			* @param {...*} [args] The arguments to invoke `func` with.
			* @returns {number} Returns the timer id.
			* @example
			*
			* _.defer(function(text) {
			*   console.log(text);
			* }, 'deferred');
			* // => Logs 'deferred' after one millisecond.
			*/
			var defer = baseRest(function(func, args) {
				return baseDelay(func, 1, args);
			});
			/**
			* Invokes `func` after `wait` milliseconds. Any additional arguments are
			* provided to `func` when it's invoked.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Function
			* @param {Function} func The function to delay.
			* @param {number} wait The number of milliseconds to delay invocation.
			* @param {...*} [args] The arguments to invoke `func` with.
			* @returns {number} Returns the timer id.
			* @example
			*
			* _.delay(function(text) {
			*   console.log(text);
			* }, 1000, 'later');
			* // => Logs 'later' after one second.
			*/
			var delay = baseRest(function(func, wait, args) {
				return baseDelay(func, toNumber(wait) || 0, args);
			});
			/**
			* Creates a function that invokes `func` with arguments reversed.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Function
			* @param {Function} func The function to flip arguments for.
			* @returns {Function} Returns the new flipped function.
			* @example
			*
			* var flipped = _.flip(function() {
			*   return _.toArray(arguments);
			* });
			*
			* flipped('a', 'b', 'c', 'd');
			* // => ['d', 'c', 'b', 'a']
			*/
			function flip(func) {
				return createWrap(func, WRAP_FLIP_FLAG);
			}
			/**
			* Creates a function that memoizes the result of `func`. If `resolver` is
			* provided, it determines the cache key for storing the result based on the
			* arguments provided to the memoized function. By default, the first argument
			* provided to the memoized function is used as the map cache key. The `func`
			* is invoked with the `this` binding of the memoized function.
			*
			* **Note:** The cache is exposed as the `cache` property on the memoized
			* function. Its creation may be customized by replacing the `_.memoize.Cache`
			* constructor with one whose instances implement the
			* [`Map`](http://ecma-international.org/ecma-262/7.0/#sec-properties-of-the-map-prototype-object)
			* method interface of `clear`, `delete`, `get`, `has`, and `set`.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Function
			* @param {Function} func The function to have its output memoized.
			* @param {Function} [resolver] The function to resolve the cache key.
			* @returns {Function} Returns the new memoized function.
			* @example
			*
			* var object = { 'a': 1, 'b': 2 };
			* var other = { 'c': 3, 'd': 4 };
			*
			* var values = _.memoize(_.values);
			* values(object);
			* // => [1, 2]
			*
			* values(other);
			* // => [3, 4]
			*
			* object.a = 2;
			* values(object);
			* // => [1, 2]
			*
			* // Modify the result cache.
			* values.cache.set(object, ['a', 'b']);
			* values(object);
			* // => ['a', 'b']
			*
			* // Replace `_.memoize.Cache`.
			* _.memoize.Cache = WeakMap;
			*/
			function memoize(func, resolver) {
				if (typeof func != "function" || resolver != null && typeof resolver != "function") throw new TypeError(FUNC_ERROR_TEXT);
				var memoized = function() {
					var args = arguments, key = resolver ? resolver.apply(this, args) : args[0], cache = memoized.cache;
					if (cache.has(key)) return cache.get(key);
					var result = func.apply(this, args);
					memoized.cache = cache.set(key, result) || cache;
					return result;
				};
				memoized.cache = new (memoize.Cache || MapCache)();
				return memoized;
			}
			memoize.Cache = MapCache;
			/**
			* Creates a function that negates the result of the predicate `func`. The
			* `func` predicate is invoked with the `this` binding and arguments of the
			* created function.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Function
			* @param {Function} predicate The predicate to negate.
			* @returns {Function} Returns the new negated function.
			* @example
			*
			* function isEven(n) {
			*   return n % 2 == 0;
			* }
			*
			* _.filter([1, 2, 3, 4, 5, 6], _.negate(isEven));
			* // => [1, 3, 5]
			*/
			function negate(predicate) {
				if (typeof predicate != "function") throw new TypeError(FUNC_ERROR_TEXT);
				return function() {
					var args = arguments;
					switch (args.length) {
						case 0: return !predicate.call(this);
						case 1: return !predicate.call(this, args[0]);
						case 2: return !predicate.call(this, args[0], args[1]);
						case 3: return !predicate.call(this, args[0], args[1], args[2]);
					}
					return !predicate.apply(this, args);
				};
			}
			/**
			* Creates a function that is restricted to invoking `func` once. Repeat calls
			* to the function return the value of the first invocation. The `func` is
			* invoked with the `this` binding and arguments of the created function.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Function
			* @param {Function} func The function to restrict.
			* @returns {Function} Returns the new restricted function.
			* @example
			*
			* var initialize = _.once(createApplication);
			* initialize();
			* initialize();
			* // => `createApplication` is invoked once
			*/
			function once(func) {
				return before(2, func);
			}
			/**
			* Creates a function that invokes `func` with its arguments transformed.
			*
			* @static
			* @since 4.0.0
			* @memberOf _
			* @category Function
			* @param {Function} func The function to wrap.
			* @param {...(Function|Function[])} [transforms=[_.identity]]
			*  The argument transforms.
			* @returns {Function} Returns the new function.
			* @example
			*
			* function doubled(n) {
			*   return n * 2;
			* }
			*
			* function square(n) {
			*   return n * n;
			* }
			*
			* var func = _.overArgs(function(x, y) {
			*   return [x, y];
			* }, [square, doubled]);
			*
			* func(9, 3);
			* // => [81, 6]
			*
			* func(10, 5);
			* // => [100, 10]
			*/
			var overArgs = castRest(function(func, transforms) {
				transforms = transforms.length == 1 && isArray(transforms[0]) ? arrayMap(transforms[0], baseUnary(getIteratee())) : arrayMap(baseFlatten(transforms, 1), baseUnary(getIteratee()));
				var funcsLength = transforms.length;
				return baseRest(function(args) {
					var index = -1, length = nativeMin(args.length, funcsLength);
					while (++index < length) args[index] = transforms[index].call(this, args[index]);
					return apply(func, this, args);
				});
			});
			/**
			* Creates a function that invokes `func` with `partials` prepended to the
			* arguments it receives. This method is like `_.bind` except it does **not**
			* alter the `this` binding.
			*
			* The `_.partial.placeholder` value, which defaults to `_` in monolithic
			* builds, may be used as a placeholder for partially applied arguments.
			*
			* **Note:** This method doesn't set the "length" property of partially
			* applied functions.
			*
			* @static
			* @memberOf _
			* @since 0.2.0
			* @category Function
			* @param {Function} func The function to partially apply arguments to.
			* @param {...*} [partials] The arguments to be partially applied.
			* @returns {Function} Returns the new partially applied function.
			* @example
			*
			* function greet(greeting, name) {
			*   return greeting + ' ' + name;
			* }
			*
			* var sayHelloTo = _.partial(greet, 'hello');
			* sayHelloTo('fred');
			* // => 'hello fred'
			*
			* // Partially applied with placeholders.
			* var greetFred = _.partial(greet, _, 'fred');
			* greetFred('hi');
			* // => 'hi fred'
			*/
			var partial = baseRest(function(func, partials) {
				return createWrap(func, WRAP_PARTIAL_FLAG, undefined, partials, replaceHolders(partials, getHolder(partial)));
			});
			/**
			* This method is like `_.partial` except that partially applied arguments
			* are appended to the arguments it receives.
			*
			* The `_.partialRight.placeholder` value, which defaults to `_` in monolithic
			* builds, may be used as a placeholder for partially applied arguments.
			*
			* **Note:** This method doesn't set the "length" property of partially
			* applied functions.
			*
			* @static
			* @memberOf _
			* @since 1.0.0
			* @category Function
			* @param {Function} func The function to partially apply arguments to.
			* @param {...*} [partials] The arguments to be partially applied.
			* @returns {Function} Returns the new partially applied function.
			* @example
			*
			* function greet(greeting, name) {
			*   return greeting + ' ' + name;
			* }
			*
			* var greetFred = _.partialRight(greet, 'fred');
			* greetFred('hi');
			* // => 'hi fred'
			*
			* // Partially applied with placeholders.
			* var sayHelloTo = _.partialRight(greet, 'hello', _);
			* sayHelloTo('fred');
			* // => 'hello fred'
			*/
			var partialRight = baseRest(function(func, partials) {
				return createWrap(func, WRAP_PARTIAL_RIGHT_FLAG, undefined, partials, replaceHolders(partials, getHolder(partialRight)));
			});
			/**
			* Creates a function that invokes `func` with arguments arranged according
			* to the specified `indexes` where the argument value at the first index is
			* provided as the first argument, the argument value at the second index is
			* provided as the second argument, and so on.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Function
			* @param {Function} func The function to rearrange arguments for.
			* @param {...(number|number[])} indexes The arranged argument indexes.
			* @returns {Function} Returns the new function.
			* @example
			*
			* var rearged = _.rearg(function(a, b, c) {
			*   return [a, b, c];
			* }, [2, 0, 1]);
			*
			* rearged('b', 'c', 'a')
			* // => ['a', 'b', 'c']
			*/
			var rearg = flatRest(function(func, indexes) {
				return createWrap(func, WRAP_REARG_FLAG, undefined, undefined, undefined, indexes);
			});
			/**
			* Creates a function that invokes `func` with the `this` binding of the
			* created function and arguments from `start` and beyond provided as
			* an array.
			*
			* **Note:** This method is based on the
			* [rest parameter](https://mdn.io/rest_parameters).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Function
			* @param {Function} func The function to apply a rest parameter to.
			* @param {number} [start=func.length-1] The start position of the rest parameter.
			* @returns {Function} Returns the new function.
			* @example
			*
			* var say = _.rest(function(what, names) {
			*   return what + ' ' + _.initial(names).join(', ') +
			*     (_.size(names) > 1 ? ', & ' : '') + _.last(names);
			* });
			*
			* say('hello', 'fred', 'barney', 'pebbles');
			* // => 'hello fred, barney, & pebbles'
			*/
			function rest(func, start) {
				if (typeof func != "function") throw new TypeError(FUNC_ERROR_TEXT);
				start = start === undefined ? start : toInteger(start);
				return baseRest(func, start);
			}
			/**
			* Creates a function that invokes `func` with the `this` binding of the
			* create function and an array of arguments much like
			* [`Function#apply`](http://www.ecma-international.org/ecma-262/7.0/#sec-function.prototype.apply).
			*
			* **Note:** This method is based on the
			* [spread operator](https://mdn.io/spread_operator).
			*
			* @static
			* @memberOf _
			* @since 3.2.0
			* @category Function
			* @param {Function} func The function to spread arguments over.
			* @param {number} [start=0] The start position of the spread.
			* @returns {Function} Returns the new function.
			* @example
			*
			* var say = _.spread(function(who, what) {
			*   return who + ' says ' + what;
			* });
			*
			* say(['fred', 'hello']);
			* // => 'fred says hello'
			*
			* var numbers = Promise.all([
			*   Promise.resolve(40),
			*   Promise.resolve(36)
			* ]);
			*
			* numbers.then(_.spread(function(x, y) {
			*   return x + y;
			* }));
			* // => a Promise of 76
			*/
			function spread(func, start) {
				if (typeof func != "function") throw new TypeError(FUNC_ERROR_TEXT);
				start = start == null ? 0 : nativeMax(toInteger(start), 0);
				return baseRest(function(args) {
					var array = args[start], otherArgs = castSlice(args, 0, start);
					if (array) arrayPush(otherArgs, array);
					return apply(func, this, otherArgs);
				});
			}
			/**
			* Creates a throttled function that only invokes `func` at most once per
			* every `wait` milliseconds. The throttled function comes with a `cancel`
			* method to cancel delayed `func` invocations and a `flush` method to
			* immediately invoke them. Provide `options` to indicate whether `func`
			* should be invoked on the leading and/or trailing edge of the `wait`
			* timeout. The `func` is invoked with the last arguments provided to the
			* throttled function. Subsequent calls to the throttled function return the
			* result of the last `func` invocation.
			*
			* **Note:** If `leading` and `trailing` options are `true`, `func` is
			* invoked on the trailing edge of the timeout only if the throttled function
			* is invoked more than once during the `wait` timeout.
			*
			* If `wait` is `0` and `leading` is `false`, `func` invocation is deferred
			* until to the next tick, similar to `setTimeout` with a timeout of `0`.
			*
			* See [David Corbacho's article](https://css-tricks.com/debouncing-throttling-explained-examples/)
			* for details over the differences between `_.throttle` and `_.debounce`.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Function
			* @param {Function} func The function to throttle.
			* @param {number} [wait=0] The number of milliseconds to throttle invocations to.
			* @param {Object} [options={}] The options object.
			* @param {boolean} [options.leading=true]
			*  Specify invoking on the leading edge of the timeout.
			* @param {boolean} [options.trailing=true]
			*  Specify invoking on the trailing edge of the timeout.
			* @returns {Function} Returns the new throttled function.
			* @example
			*
			* // Avoid excessively updating the position while scrolling.
			* jQuery(window).on('scroll', _.throttle(updatePosition, 100));
			*
			* // Invoke `renewToken` when the click event is fired, but not more than once every 5 minutes.
			* var throttled = _.throttle(renewToken, 300000, { 'trailing': false });
			* jQuery(element).on('click', throttled);
			*
			* // Cancel the trailing throttled invocation.
			* jQuery(window).on('popstate', throttled.cancel);
			*/
			function throttle(func, wait, options) {
				var leading = true, trailing = true;
				if (typeof func != "function") throw new TypeError(FUNC_ERROR_TEXT);
				if (isObject(options)) {
					leading = "leading" in options ? !!options.leading : leading;
					trailing = "trailing" in options ? !!options.trailing : trailing;
				}
				return debounce(func, wait, {
					"leading": leading,
					"maxWait": wait,
					"trailing": trailing
				});
			}
			/**
			* Creates a function that accepts up to one argument, ignoring any
			* additional arguments.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Function
			* @param {Function} func The function to cap arguments for.
			* @returns {Function} Returns the new capped function.
			* @example
			*
			* _.map(['6', '8', '10'], _.unary(parseInt));
			* // => [6, 8, 10]
			*/
			function unary(func) {
				return ary(func, 1);
			}
			/**
			* Creates a function that provides `value` to `wrapper` as its first
			* argument. Any additional arguments provided to the function are appended
			* to those provided to the `wrapper`. The wrapper is invoked with the `this`
			* binding of the created function.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Function
			* @param {*} value The value to wrap.
			* @param {Function} [wrapper=identity] The wrapper function.
			* @returns {Function} Returns the new function.
			* @example
			*
			* var p = _.wrap(_.escape, function(func, text) {
			*   return '<p>' + func(text) + '</p>';
			* });
			*
			* p('fred, barney, & pebbles');
			* // => '<p>fred, barney, &amp; pebbles</p>'
			*/
			function wrap(value, wrapper) {
				return partial(castFunction(wrapper), value);
			}
			/**
			* Casts `value` as an array if it's not one.
			*
			* @static
			* @memberOf _
			* @since 4.4.0
			* @category Lang
			* @param {*} value The value to inspect.
			* @returns {Array} Returns the cast array.
			* @example
			*
			* _.castArray(1);
			* // => [1]
			*
			* _.castArray({ 'a': 1 });
			* // => [{ 'a': 1 }]
			*
			* _.castArray('abc');
			* // => ['abc']
			*
			* _.castArray(null);
			* // => [null]
			*
			* _.castArray(undefined);
			* // => [undefined]
			*
			* _.castArray();
			* // => []
			*
			* var array = [1, 2, 3];
			* console.log(_.castArray(array) === array);
			* // => true
			*/
			function castArray() {
				if (!arguments.length) return [];
				var value = arguments[0];
				return isArray(value) ? value : [value];
			}
			/**
			* Creates a shallow clone of `value`.
			*
			* **Note:** This method is loosely based on the
			* [structured clone algorithm](https://mdn.io/Structured_clone_algorithm)
			* and supports cloning arrays, array buffers, booleans, date objects, maps,
			* numbers, `Object` objects, regexes, sets, strings, symbols, and typed
			* arrays. The own enumerable properties of `arguments` objects are cloned
			* as plain objects. An empty object is returned for uncloneable values such
			* as error objects, functions, DOM nodes, and WeakMaps.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Lang
			* @param {*} value The value to clone.
			* @returns {*} Returns the cloned value.
			* @see _.cloneDeep
			* @example
			*
			* var objects = [{ 'a': 1 }, { 'b': 2 }];
			*
			* var shallow = _.clone(objects);
			* console.log(shallow[0] === objects[0]);
			* // => true
			*/
			function clone(value) {
				return baseClone(value, CLONE_SYMBOLS_FLAG);
			}
			/**
			* This method is like `_.clone` except that it accepts `customizer` which
			* is invoked to produce the cloned value. If `customizer` returns `undefined`,
			* cloning is handled by the method instead. The `customizer` is invoked with
			* up to four arguments; (value [, index|key, object, stack]).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to clone.
			* @param {Function} [customizer] The function to customize cloning.
			* @returns {*} Returns the cloned value.
			* @see _.cloneDeepWith
			* @example
			*
			* function customizer(value) {
			*   if (_.isElement(value)) {
			*     return value.cloneNode(false);
			*   }
			* }
			*
			* var el = _.cloneWith(document.body, customizer);
			*
			* console.log(el === document.body);
			* // => false
			* console.log(el.nodeName);
			* // => 'BODY'
			* console.log(el.childNodes.length);
			* // => 0
			*/
			function cloneWith(value, customizer) {
				customizer = typeof customizer == "function" ? customizer : undefined;
				return baseClone(value, CLONE_SYMBOLS_FLAG, customizer);
			}
			/**
			* This method is like `_.clone` except that it recursively clones `value`.
			*
			* @static
			* @memberOf _
			* @since 1.0.0
			* @category Lang
			* @param {*} value The value to recursively clone.
			* @returns {*} Returns the deep cloned value.
			* @see _.clone
			* @example
			*
			* var objects = [{ 'a': 1 }, { 'b': 2 }];
			*
			* var deep = _.cloneDeep(objects);
			* console.log(deep[0] === objects[0]);
			* // => false
			*/
			function cloneDeep(value) {
				return baseClone(value, CLONE_DEEP_FLAG | CLONE_SYMBOLS_FLAG);
			}
			/**
			* This method is like `_.cloneWith` except that it recursively clones `value`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to recursively clone.
			* @param {Function} [customizer] The function to customize cloning.
			* @returns {*} Returns the deep cloned value.
			* @see _.cloneWith
			* @example
			*
			* function customizer(value) {
			*   if (_.isElement(value)) {
			*     return value.cloneNode(true);
			*   }
			* }
			*
			* var el = _.cloneDeepWith(document.body, customizer);
			*
			* console.log(el === document.body);
			* // => false
			* console.log(el.nodeName);
			* // => 'BODY'
			* console.log(el.childNodes.length);
			* // => 20
			*/
			function cloneDeepWith(value, customizer) {
				customizer = typeof customizer == "function" ? customizer : undefined;
				return baseClone(value, CLONE_DEEP_FLAG | CLONE_SYMBOLS_FLAG, customizer);
			}
			/**
			* Checks if `object` conforms to `source` by invoking the predicate
			* properties of `source` with the corresponding property values of `object`.
			*
			* **Note:** This method is equivalent to `_.conforms` when `source` is
			* partially applied.
			*
			* @static
			* @memberOf _
			* @since 4.14.0
			* @category Lang
			* @param {Object} object The object to inspect.
			* @param {Object} source The object of property predicates to conform to.
			* @returns {boolean} Returns `true` if `object` conforms, else `false`.
			* @example
			*
			* var object = { 'a': 1, 'b': 2 };
			*
			* _.conformsTo(object, { 'b': function(n) { return n > 1; } });
			* // => true
			*
			* _.conformsTo(object, { 'b': function(n) { return n > 2; } });
			* // => false
			*/
			function conformsTo(object, source) {
				return source == null || baseConformsTo(object, source, keys(source));
			}
			/**
			* Performs a
			* [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
			* comparison between two values to determine if they are equivalent.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to compare.
			* @param {*} other The other value to compare.
			* @returns {boolean} Returns `true` if the values are equivalent, else `false`.
			* @example
			*
			* var object = { 'a': 1 };
			* var other = { 'a': 1 };
			*
			* _.eq(object, object);
			* // => true
			*
			* _.eq(object, other);
			* // => false
			*
			* _.eq('a', 'a');
			* // => true
			*
			* _.eq('a', Object('a'));
			* // => false
			*
			* _.eq(NaN, NaN);
			* // => true
			*/
			function eq(value, other) {
				return value === other || value !== value && other !== other;
			}
			/**
			* Checks if `value` is greater than `other`.
			*
			* @static
			* @memberOf _
			* @since 3.9.0
			* @category Lang
			* @param {*} value The value to compare.
			* @param {*} other The other value to compare.
			* @returns {boolean} Returns `true` if `value` is greater than `other`,
			*  else `false`.
			* @see _.lt
			* @example
			*
			* _.gt(3, 1);
			* // => true
			*
			* _.gt(3, 3);
			* // => false
			*
			* _.gt(1, 3);
			* // => false
			*/
			var gt = createRelationalOperation(baseGt);
			/**
			* Checks if `value` is greater than or equal to `other`.
			*
			* @static
			* @memberOf _
			* @since 3.9.0
			* @category Lang
			* @param {*} value The value to compare.
			* @param {*} other The other value to compare.
			* @returns {boolean} Returns `true` if `value` is greater than or equal to
			*  `other`, else `false`.
			* @see _.lte
			* @example
			*
			* _.gte(3, 1);
			* // => true
			*
			* _.gte(3, 3);
			* // => true
			*
			* _.gte(1, 3);
			* // => false
			*/
			var gte = createRelationalOperation(function(value, other) {
				return value >= other;
			});
			/**
			* Checks if `value` is likely an `arguments` object.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is an `arguments` object,
			*  else `false`.
			* @example
			*
			* _.isArguments(function() { return arguments; }());
			* // => true
			*
			* _.isArguments([1, 2, 3]);
			* // => false
			*/
			var isArguments = baseIsArguments(function() {
				return arguments;
			}()) ? baseIsArguments : function(value) {
				return isObjectLike(value) && hasOwnProperty.call(value, "callee") && !propertyIsEnumerable.call(value, "callee");
			};
			/**
			* Checks if `value` is classified as an `Array` object.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is an array, else `false`.
			* @example
			*
			* _.isArray([1, 2, 3]);
			* // => true
			*
			* _.isArray(document.body.children);
			* // => false
			*
			* _.isArray('abc');
			* // => false
			*
			* _.isArray(_.noop);
			* // => false
			*/
			var isArray = Array.isArray;
			/**
			* Checks if `value` is classified as an `ArrayBuffer` object.
			*
			* @static
			* @memberOf _
			* @since 4.3.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is an array buffer, else `false`.
			* @example
			*
			* _.isArrayBuffer(new ArrayBuffer(2));
			* // => true
			*
			* _.isArrayBuffer(new Array(2));
			* // => false
			*/
			var isArrayBuffer = nodeIsArrayBuffer ? baseUnary(nodeIsArrayBuffer) : baseIsArrayBuffer;
			/**
			* Checks if `value` is array-like. A value is considered array-like if it's
			* not a function and has a `value.length` that's an integer greater than or
			* equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is array-like, else `false`.
			* @example
			*
			* _.isArrayLike([1, 2, 3]);
			* // => true
			*
			* _.isArrayLike(document.body.children);
			* // => true
			*
			* _.isArrayLike('abc');
			* // => true
			*
			* _.isArrayLike(_.noop);
			* // => false
			*/
			function isArrayLike(value) {
				return value != null && isLength(value.length) && !isFunction(value);
			}
			/**
			* This method is like `_.isArrayLike` except that it also checks if `value`
			* is an object.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is an array-like object,
			*  else `false`.
			* @example
			*
			* _.isArrayLikeObject([1, 2, 3]);
			* // => true
			*
			* _.isArrayLikeObject(document.body.children);
			* // => true
			*
			* _.isArrayLikeObject('abc');
			* // => false
			*
			* _.isArrayLikeObject(_.noop);
			* // => false
			*/
			function isArrayLikeObject(value) {
				return isObjectLike(value) && isArrayLike(value);
			}
			/**
			* Checks if `value` is classified as a boolean primitive or object.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a boolean, else `false`.
			* @example
			*
			* _.isBoolean(false);
			* // => true
			*
			* _.isBoolean(null);
			* // => false
			*/
			function isBoolean(value) {
				return value === true || value === false || isObjectLike(value) && baseGetTag(value) == boolTag;
			}
			/**
			* Checks if `value` is a buffer.
			*
			* @static
			* @memberOf _
			* @since 4.3.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a buffer, else `false`.
			* @example
			*
			* _.isBuffer(new Buffer(2));
			* // => true
			*
			* _.isBuffer(new Uint8Array(2));
			* // => false
			*/
			var isBuffer = nativeIsBuffer || stubFalse;
			/**
			* Checks if `value` is classified as a `Date` object.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a date object, else `false`.
			* @example
			*
			* _.isDate(new Date);
			* // => true
			*
			* _.isDate('Mon April 23 2012');
			* // => false
			*/
			var isDate = nodeIsDate ? baseUnary(nodeIsDate) : baseIsDate;
			/**
			* Checks if `value` is likely a DOM element.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a DOM element, else `false`.
			* @example
			*
			* _.isElement(document.body);
			* // => true
			*
			* _.isElement('<body>');
			* // => false
			*/
			function isElement(value) {
				return isObjectLike(value) && value.nodeType === 1 && !isPlainObject(value);
			}
			/**
			* Checks if `value` is an empty object, collection, map, or set.
			*
			* Objects are considered empty if they have no own enumerable string keyed
			* properties.
			*
			* Array-like values such as `arguments` objects, arrays, buffers, strings, or
			* jQuery-like collections are considered empty if they have a `length` of `0`.
			* Similarly, maps and sets are considered empty if they have a `size` of `0`.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is empty, else `false`.
			* @example
			*
			* _.isEmpty(null);
			* // => true
			*
			* _.isEmpty(true);
			* // => true
			*
			* _.isEmpty(1);
			* // => true
			*
			* _.isEmpty([1, 2, 3]);
			* // => false
			*
			* _.isEmpty({ 'a': 1 });
			* // => false
			*/
			function isEmpty(value) {
				if (value == null) return true;
				if (isArrayLike(value) && (isArray(value) || typeof value == "string" || typeof value.splice == "function" || isBuffer(value) || isTypedArray(value) || isArguments(value))) return !value.length;
				var tag = getTag(value);
				if (tag == mapTag || tag == setTag) return !value.size;
				if (isPrototype(value)) return !baseKeys(value).length;
				for (var key in value) if (hasOwnProperty.call(value, key)) return false;
				return true;
			}
			/**
			* Performs a deep comparison between two values to determine if they are
			* equivalent.
			*
			* **Note:** This method supports comparing arrays, array buffers, booleans,
			* date objects, error objects, maps, numbers, `Object` objects, regexes,
			* sets, strings, symbols, and typed arrays. `Object` objects are compared
			* by their own, not inherited, enumerable properties. Functions and DOM
			* nodes are compared by strict equality, i.e. `===`.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Lang
			* @param {*} value The value to compare.
			* @param {*} other The other value to compare.
			* @returns {boolean} Returns `true` if the values are equivalent, else `false`.
			* @example
			*
			* var object = { 'a': 1 };
			* var other = { 'a': 1 };
			*
			* _.isEqual(object, other);
			* // => true
			*
			* object === other;
			* // => false
			*/
			function isEqual(value, other) {
				return baseIsEqual(value, other);
			}
			/**
			* This method is like `_.isEqual` except that it accepts `customizer` which
			* is invoked to compare values. If `customizer` returns `undefined`, comparisons
			* are handled by the method instead. The `customizer` is invoked with up to
			* six arguments: (objValue, othValue [, index|key, object, other, stack]).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to compare.
			* @param {*} other The other value to compare.
			* @param {Function} [customizer] The function to customize comparisons.
			* @returns {boolean} Returns `true` if the values are equivalent, else `false`.
			* @example
			*
			* function isGreeting(value) {
			*   return /^h(?:i|ello)$/.test(value);
			* }
			*
			* function customizer(objValue, othValue) {
			*   if (isGreeting(objValue) && isGreeting(othValue)) {
			*     return true;
			*   }
			* }
			*
			* var array = ['hello', 'goodbye'];
			* var other = ['hi', 'goodbye'];
			*
			* _.isEqualWith(array, other, customizer);
			* // => true
			*/
			function isEqualWith(value, other, customizer) {
				customizer = typeof customizer == "function" ? customizer : undefined;
				var result = customizer ? customizer(value, other) : undefined;
				return result === undefined ? baseIsEqual(value, other, undefined, customizer) : !!result;
			}
			/**
			* Checks if `value` is an `Error`, `EvalError`, `RangeError`, `ReferenceError`,
			* `SyntaxError`, `TypeError`, or `URIError` object.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is an error object, else `false`.
			* @example
			*
			* _.isError(new Error);
			* // => true
			*
			* _.isError(Error);
			* // => false
			*/
			function isError(value) {
				if (!isObjectLike(value)) return false;
				var tag = baseGetTag(value);
				return tag == errorTag || tag == domExcTag || typeof value.message == "string" && typeof value.name == "string" && !isPlainObject(value);
			}
			/**
			* Checks if `value` is a finite primitive number.
			*
			* **Note:** This method is based on
			* [`Number.isFinite`](https://mdn.io/Number/isFinite).
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a finite number, else `false`.
			* @example
			*
			* _.isFinite(3);
			* // => true
			*
			* _.isFinite(Number.MIN_VALUE);
			* // => true
			*
			* _.isFinite(Infinity);
			* // => false
			*
			* _.isFinite('3');
			* // => false
			*/
			function isFinite(value) {
				return typeof value == "number" && nativeIsFinite(value);
			}
			/**
			* Checks if `value` is classified as a `Function` object.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a function, else `false`.
			* @example
			*
			* _.isFunction(_);
			* // => true
			*
			* _.isFunction(/abc/);
			* // => false
			*/
			function isFunction(value) {
				if (!isObject(value)) return false;
				var tag = baseGetTag(value);
				return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
			}
			/**
			* Checks if `value` is an integer.
			*
			* **Note:** This method is based on
			* [`Number.isInteger`](https://mdn.io/Number/isInteger).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is an integer, else `false`.
			* @example
			*
			* _.isInteger(3);
			* // => true
			*
			* _.isInteger(Number.MIN_VALUE);
			* // => false
			*
			* _.isInteger(Infinity);
			* // => false
			*
			* _.isInteger('3');
			* // => false
			*/
			function isInteger(value) {
				return typeof value == "number" && value == toInteger(value);
			}
			/**
			* Checks if `value` is a valid array-like length.
			*
			* **Note:** This method is loosely based on
			* [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
			* @example
			*
			* _.isLength(3);
			* // => true
			*
			* _.isLength(Number.MIN_VALUE);
			* // => false
			*
			* _.isLength(Infinity);
			* // => false
			*
			* _.isLength('3');
			* // => false
			*/
			function isLength(value) {
				return typeof value == "number" && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
			}
			/**
			* Checks if `value` is the
			* [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
			* of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is an object, else `false`.
			* @example
			*
			* _.isObject({});
			* // => true
			*
			* _.isObject([1, 2, 3]);
			* // => true
			*
			* _.isObject(_.noop);
			* // => true
			*
			* _.isObject(null);
			* // => false
			*/
			function isObject(value) {
				var type = typeof value;
				return value != null && (type == "object" || type == "function");
			}
			/**
			* Checks if `value` is object-like. A value is object-like if it's not `null`
			* and has a `typeof` result of "object".
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is object-like, else `false`.
			* @example
			*
			* _.isObjectLike({});
			* // => true
			*
			* _.isObjectLike([1, 2, 3]);
			* // => true
			*
			* _.isObjectLike(_.noop);
			* // => false
			*
			* _.isObjectLike(null);
			* // => false
			*/
			function isObjectLike(value) {
				return value != null && typeof value == "object";
			}
			/**
			* Checks if `value` is classified as a `Map` object.
			*
			* @static
			* @memberOf _
			* @since 4.3.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a map, else `false`.
			* @example
			*
			* _.isMap(new Map);
			* // => true
			*
			* _.isMap(new WeakMap);
			* // => false
			*/
			var isMap = nodeIsMap ? baseUnary(nodeIsMap) : baseIsMap;
			/**
			* Performs a partial deep comparison between `object` and `source` to
			* determine if `object` contains equivalent property values.
			*
			* **Note:** This method is equivalent to `_.matches` when `source` is
			* partially applied.
			*
			* Partial comparisons will match empty array and empty object `source`
			* values against any array or object value, respectively. See `_.isEqual`
			* for a list of supported value comparisons.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Lang
			* @param {Object} object The object to inspect.
			* @param {Object} source The object of property values to match.
			* @returns {boolean} Returns `true` if `object` is a match, else `false`.
			* @example
			*
			* var object = { 'a': 1, 'b': 2 };
			*
			* _.isMatch(object, { 'b': 2 });
			* // => true
			*
			* _.isMatch(object, { 'b': 1 });
			* // => false
			*/
			function isMatch(object, source) {
				return object === source || baseIsMatch(object, source, getMatchData(source));
			}
			/**
			* This method is like `_.isMatch` except that it accepts `customizer` which
			* is invoked to compare values. If `customizer` returns `undefined`, comparisons
			* are handled by the method instead. The `customizer` is invoked with five
			* arguments: (objValue, srcValue, index|key, object, source).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {Object} object The object to inspect.
			* @param {Object} source The object of property values to match.
			* @param {Function} [customizer] The function to customize comparisons.
			* @returns {boolean} Returns `true` if `object` is a match, else `false`.
			* @example
			*
			* function isGreeting(value) {
			*   return /^h(?:i|ello)$/.test(value);
			* }
			*
			* function customizer(objValue, srcValue) {
			*   if (isGreeting(objValue) && isGreeting(srcValue)) {
			*     return true;
			*   }
			* }
			*
			* var object = { 'greeting': 'hello' };
			* var source = { 'greeting': 'hi' };
			*
			* _.isMatchWith(object, source, customizer);
			* // => true
			*/
			function isMatchWith(object, source, customizer) {
				customizer = typeof customizer == "function" ? customizer : undefined;
				return baseIsMatch(object, source, getMatchData(source), customizer);
			}
			/**
			* Checks if `value` is `NaN`.
			*
			* **Note:** This method is based on
			* [`Number.isNaN`](https://mdn.io/Number/isNaN) and is not the same as
			* global [`isNaN`](https://mdn.io/isNaN) which returns `true` for
			* `undefined` and other non-number values.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is `NaN`, else `false`.
			* @example
			*
			* _.isNaN(NaN);
			* // => true
			*
			* _.isNaN(new Number(NaN));
			* // => true
			*
			* isNaN(undefined);
			* // => true
			*
			* _.isNaN(undefined);
			* // => false
			*/
			function isNaN(value) {
				return isNumber(value) && value != +value;
			}
			/**
			* Checks if `value` is a pristine native function.
			*
			* **Note:** This method can't reliably detect native functions in the presence
			* of the core-js package because core-js circumvents this kind of detection.
			* Despite multiple requests, the core-js maintainer has made it clear: any
			* attempt to fix the detection will be obstructed. As a result, we're left
			* with little choice but to throw an error. Unfortunately, this also affects
			* packages, like [babel-polyfill](https://www.npmjs.com/package/babel-polyfill),
			* which rely on core-js.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a native function,
			*  else `false`.
			* @example
			*
			* _.isNative(Array.prototype.push);
			* // => true
			*
			* _.isNative(_);
			* // => false
			*/
			function isNative(value) {
				if (isMaskable(value)) throw new Error(CORE_ERROR_TEXT);
				return baseIsNative(value);
			}
			/**
			* Checks if `value` is `null`.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is `null`, else `false`.
			* @example
			*
			* _.isNull(null);
			* // => true
			*
			* _.isNull(void 0);
			* // => false
			*/
			function isNull(value) {
				return value === null;
			}
			/**
			* Checks if `value` is `null` or `undefined`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is nullish, else `false`.
			* @example
			*
			* _.isNil(null);
			* // => true
			*
			* _.isNil(void 0);
			* // => true
			*
			* _.isNil(NaN);
			* // => false
			*/
			function isNil(value) {
				return value == null;
			}
			/**
			* Checks if `value` is classified as a `Number` primitive or object.
			*
			* **Note:** To exclude `Infinity`, `-Infinity`, and `NaN`, which are
			* classified as numbers, use the `_.isFinite` method.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a number, else `false`.
			* @example
			*
			* _.isNumber(3);
			* // => true
			*
			* _.isNumber(Number.MIN_VALUE);
			* // => true
			*
			* _.isNumber(Infinity);
			* // => true
			*
			* _.isNumber('3');
			* // => false
			*/
			function isNumber(value) {
				return typeof value == "number" || isObjectLike(value) && baseGetTag(value) == numberTag;
			}
			/**
			* Checks if `value` is a plain object, that is, an object created by the
			* `Object` constructor or one with a `[[Prototype]]` of `null`.
			*
			* @static
			* @memberOf _
			* @since 0.8.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
			* @example
			*
			* function Foo() {
			*   this.a = 1;
			* }
			*
			* _.isPlainObject(new Foo);
			* // => false
			*
			* _.isPlainObject([1, 2, 3]);
			* // => false
			*
			* _.isPlainObject({ 'x': 0, 'y': 0 });
			* // => true
			*
			* _.isPlainObject(Object.create(null));
			* // => true
			*/
			function isPlainObject(value) {
				if (!isObjectLike(value) || baseGetTag(value) != objectTag) return false;
				var proto = getPrototype(value);
				if (proto === null) return true;
				var Ctor = hasOwnProperty.call(proto, "constructor") && proto.constructor;
				return typeof Ctor == "function" && Ctor instanceof Ctor && funcToString.call(Ctor) == objectCtorString;
			}
			/**
			* Checks if `value` is classified as a `RegExp` object.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a regexp, else `false`.
			* @example
			*
			* _.isRegExp(/abc/);
			* // => true
			*
			* _.isRegExp('/abc/');
			* // => false
			*/
			var isRegExp = nodeIsRegExp ? baseUnary(nodeIsRegExp) : baseIsRegExp;
			/**
			* Checks if `value` is a safe integer. An integer is safe if it's an IEEE-754
			* double precision number which isn't the result of a rounded unsafe integer.
			*
			* **Note:** This method is based on
			* [`Number.isSafeInteger`](https://mdn.io/Number/isSafeInteger).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a safe integer, else `false`.
			* @example
			*
			* _.isSafeInteger(3);
			* // => true
			*
			* _.isSafeInteger(Number.MIN_VALUE);
			* // => false
			*
			* _.isSafeInteger(Infinity);
			* // => false
			*
			* _.isSafeInteger('3');
			* // => false
			*/
			function isSafeInteger(value) {
				return isInteger(value) && value >= -MAX_SAFE_INTEGER && value <= MAX_SAFE_INTEGER;
			}
			/**
			* Checks if `value` is classified as a `Set` object.
			*
			* @static
			* @memberOf _
			* @since 4.3.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a set, else `false`.
			* @example
			*
			* _.isSet(new Set);
			* // => true
			*
			* _.isSet(new WeakSet);
			* // => false
			*/
			var isSet = nodeIsSet ? baseUnary(nodeIsSet) : baseIsSet;
			/**
			* Checks if `value` is classified as a `String` primitive or object.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a string, else `false`.
			* @example
			*
			* _.isString('abc');
			* // => true
			*
			* _.isString(1);
			* // => false
			*/
			function isString(value) {
				return typeof value == "string" || !isArray(value) && isObjectLike(value) && baseGetTag(value) == stringTag;
			}
			/**
			* Checks if `value` is classified as a `Symbol` primitive or object.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
			* @example
			*
			* _.isSymbol(Symbol.iterator);
			* // => true
			*
			* _.isSymbol('abc');
			* // => false
			*/
			function isSymbol(value) {
				return typeof value == "symbol" || isObjectLike(value) && baseGetTag(value) == symbolTag;
			}
			/**
			* Checks if `value` is classified as a typed array.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
			* @example
			*
			* _.isTypedArray(new Uint8Array);
			* // => true
			*
			* _.isTypedArray([]);
			* // => false
			*/
			var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;
			/**
			* Checks if `value` is `undefined`.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is `undefined`, else `false`.
			* @example
			*
			* _.isUndefined(void 0);
			* // => true
			*
			* _.isUndefined(null);
			* // => false
			*/
			function isUndefined(value) {
				return value === undefined;
			}
			/**
			* Checks if `value` is classified as a `WeakMap` object.
			*
			* @static
			* @memberOf _
			* @since 4.3.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a weak map, else `false`.
			* @example
			*
			* _.isWeakMap(new WeakMap);
			* // => true
			*
			* _.isWeakMap(new Map);
			* // => false
			*/
			function isWeakMap(value) {
				return isObjectLike(value) && getTag(value) == weakMapTag;
			}
			/**
			* Checks if `value` is classified as a `WeakSet` object.
			*
			* @static
			* @memberOf _
			* @since 4.3.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a weak set, else `false`.
			* @example
			*
			* _.isWeakSet(new WeakSet);
			* // => true
			*
			* _.isWeakSet(new Set);
			* // => false
			*/
			function isWeakSet(value) {
				return isObjectLike(value) && baseGetTag(value) == weakSetTag;
			}
			/**
			* Checks if `value` is less than `other`.
			*
			* @static
			* @memberOf _
			* @since 3.9.0
			* @category Lang
			* @param {*} value The value to compare.
			* @param {*} other The other value to compare.
			* @returns {boolean} Returns `true` if `value` is less than `other`,
			*  else `false`.
			* @see _.gt
			* @example
			*
			* _.lt(1, 3);
			* // => true
			*
			* _.lt(3, 3);
			* // => false
			*
			* _.lt(3, 1);
			* // => false
			*/
			var lt = createRelationalOperation(baseLt);
			/**
			* Checks if `value` is less than or equal to `other`.
			*
			* @static
			* @memberOf _
			* @since 3.9.0
			* @category Lang
			* @param {*} value The value to compare.
			* @param {*} other The other value to compare.
			* @returns {boolean} Returns `true` if `value` is less than or equal to
			*  `other`, else `false`.
			* @see _.gte
			* @example
			*
			* _.lte(1, 3);
			* // => true
			*
			* _.lte(3, 3);
			* // => true
			*
			* _.lte(3, 1);
			* // => false
			*/
			var lte = createRelationalOperation(function(value, other) {
				return value <= other;
			});
			/**
			* Converts `value` to an array.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Lang
			* @param {*} value The value to convert.
			* @returns {Array} Returns the converted array.
			* @example
			*
			* _.toArray({ 'a': 1, 'b': 2 });
			* // => [1, 2]
			*
			* _.toArray('abc');
			* // => ['a', 'b', 'c']
			*
			* _.toArray(1);
			* // => []
			*
			* _.toArray(null);
			* // => []
			*/
			function toArray(value) {
				if (!value) return [];
				if (isArrayLike(value)) return isString(value) ? stringToArray(value) : copyArray(value);
				if (symIterator && value[symIterator]) return iteratorToArray(value[symIterator]());
				var tag = getTag(value);
				return (tag == mapTag ? mapToArray : tag == setTag ? setToArray : values)(value);
			}
			/**
			* Converts `value` to a finite number.
			*
			* @static
			* @memberOf _
			* @since 4.12.0
			* @category Lang
			* @param {*} value The value to convert.
			* @returns {number} Returns the converted number.
			* @example
			*
			* _.toFinite(3.2);
			* // => 3.2
			*
			* _.toFinite(Number.MIN_VALUE);
			* // => 5e-324
			*
			* _.toFinite(Infinity);
			* // => 1.7976931348623157e+308
			*
			* _.toFinite('3.2');
			* // => 3.2
			*/
			function toFinite(value) {
				if (!value) return value === 0 ? value : 0;
				value = toNumber(value);
				if (value === INFINITY || value === -INFINITY) return (value < 0 ? -1 : 1) * MAX_INTEGER;
				return value === value ? value : 0;
			}
			/**
			* Converts `value` to an integer.
			*
			* **Note:** This method is loosely based on
			* [`ToInteger`](http://www.ecma-international.org/ecma-262/7.0/#sec-tointeger).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to convert.
			* @returns {number} Returns the converted integer.
			* @example
			*
			* _.toInteger(3.2);
			* // => 3
			*
			* _.toInteger(Number.MIN_VALUE);
			* // => 0
			*
			* _.toInteger(Infinity);
			* // => 1.7976931348623157e+308
			*
			* _.toInteger('3.2');
			* // => 3
			*/
			function toInteger(value) {
				var result = toFinite(value), remainder = result % 1;
				return result === result ? remainder ? result - remainder : result : 0;
			}
			/**
			* Converts `value` to an integer suitable for use as the length of an
			* array-like object.
			*
			* **Note:** This method is based on
			* [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to convert.
			* @returns {number} Returns the converted integer.
			* @example
			*
			* _.toLength(3.2);
			* // => 3
			*
			* _.toLength(Number.MIN_VALUE);
			* // => 0
			*
			* _.toLength(Infinity);
			* // => 4294967295
			*
			* _.toLength('3.2');
			* // => 3
			*/
			function toLength(value) {
				return value ? baseClamp(toInteger(value), 0, MAX_ARRAY_LENGTH) : 0;
			}
			/**
			* Converts `value` to a number.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to process.
			* @returns {number} Returns the number.
			* @example
			*
			* _.toNumber(3.2);
			* // => 3.2
			*
			* _.toNumber(Number.MIN_VALUE);
			* // => 5e-324
			*
			* _.toNumber(Infinity);
			* // => Infinity
			*
			* _.toNumber('3.2');
			* // => 3.2
			*/
			function toNumber(value) {
				if (typeof value == "number") return value;
				if (isSymbol(value)) return NAN;
				if (isObject(value)) {
					var other = typeof value.valueOf == "function" ? value.valueOf() : value;
					value = isObject(other) ? other + "" : other;
				}
				if (typeof value != "string") return value === 0 ? value : +value;
				value = baseTrim(value);
				var isBinary = reIsBinary.test(value);
				return isBinary || reIsOctal.test(value) ? freeParseInt(value.slice(2), isBinary ? 2 : 8) : reIsBadHex.test(value) ? NAN : +value;
			}
			/**
			* Converts `value` to a plain object flattening inherited enumerable string
			* keyed properties of `value` to own properties of the plain object.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Lang
			* @param {*} value The value to convert.
			* @returns {Object} Returns the converted plain object.
			* @example
			*
			* function Foo() {
			*   this.b = 2;
			* }
			*
			* Foo.prototype.c = 3;
			*
			* _.assign({ 'a': 1 }, new Foo);
			* // => { 'a': 1, 'b': 2 }
			*
			* _.assign({ 'a': 1 }, _.toPlainObject(new Foo));
			* // => { 'a': 1, 'b': 2, 'c': 3 }
			*/
			function toPlainObject(value) {
				return copyObject(value, keysIn(value));
			}
			/**
			* Converts `value` to a safe integer. A safe integer can be compared and
			* represented correctly.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to convert.
			* @returns {number} Returns the converted integer.
			* @example
			*
			* _.toSafeInteger(3.2);
			* // => 3
			*
			* _.toSafeInteger(Number.MIN_VALUE);
			* // => 0
			*
			* _.toSafeInteger(Infinity);
			* // => 9007199254740991
			*
			* _.toSafeInteger('3.2');
			* // => 3
			*/
			function toSafeInteger(value) {
				return value ? baseClamp(toInteger(value), -MAX_SAFE_INTEGER, MAX_SAFE_INTEGER) : value === 0 ? value : 0;
			}
			/**
			* Converts `value` to a string. An empty string is returned for `null`
			* and `undefined` values. The sign of `-0` is preserved.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to convert.
			* @returns {string} Returns the converted string.
			* @example
			*
			* _.toString(null);
			* // => ''
			*
			* _.toString(-0);
			* // => '-0'
			*
			* _.toString([1, 2, 3]);
			* // => '1,2,3'
			*/
			function toString(value) {
				return value == null ? "" : baseToString(value);
			}
			/**
			* Assigns own enumerable string keyed properties of source objects to the
			* destination object. Source objects are applied from left to right.
			* Subsequent sources overwrite property assignments of previous sources.
			*
			* **Note:** This method mutates `object` and is loosely based on
			* [`Object.assign`](https://mdn.io/Object/assign).
			*
			* @static
			* @memberOf _
			* @since 0.10.0
			* @category Object
			* @param {Object} object The destination object.
			* @param {...Object} [sources] The source objects.
			* @returns {Object} Returns `object`.
			* @see _.assignIn
			* @example
			*
			* function Foo() {
			*   this.a = 1;
			* }
			*
			* function Bar() {
			*   this.c = 3;
			* }
			*
			* Foo.prototype.b = 2;
			* Bar.prototype.d = 4;
			*
			* _.assign({ 'a': 0 }, new Foo, new Bar);
			* // => { 'a': 1, 'c': 3 }
			*/
			var assign = createAssigner(function(object, source) {
				if (isPrototype(source) || isArrayLike(source)) {
					copyObject(source, keys(source), object);
					return;
				}
				for (var key in source) if (hasOwnProperty.call(source, key)) assignValue(object, key, source[key]);
			});
			/**
			* This method is like `_.assign` except that it iterates over own and
			* inherited source properties.
			*
			* **Note:** This method mutates `object`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @alias extend
			* @category Object
			* @param {Object} object The destination object.
			* @param {...Object} [sources] The source objects.
			* @returns {Object} Returns `object`.
			* @see _.assign
			* @example
			*
			* function Foo() {
			*   this.a = 1;
			* }
			*
			* function Bar() {
			*   this.c = 3;
			* }
			*
			* Foo.prototype.b = 2;
			* Bar.prototype.d = 4;
			*
			* _.assignIn({ 'a': 0 }, new Foo, new Bar);
			* // => { 'a': 1, 'b': 2, 'c': 3, 'd': 4 }
			*/
			var assignIn = createAssigner(function(object, source) {
				copyObject(source, keysIn(source), object);
			});
			/**
			* This method is like `_.assignIn` except that it accepts `customizer`
			* which is invoked to produce the assigned values. If `customizer` returns
			* `undefined`, assignment is handled by the method instead. The `customizer`
			* is invoked with five arguments: (objValue, srcValue, key, object, source).
			*
			* **Note:** This method mutates `object`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @alias extendWith
			* @category Object
			* @param {Object} object The destination object.
			* @param {...Object} sources The source objects.
			* @param {Function} [customizer] The function to customize assigned values.
			* @returns {Object} Returns `object`.
			* @see _.assignWith
			* @example
			*
			* function customizer(objValue, srcValue) {
			*   return _.isUndefined(objValue) ? srcValue : objValue;
			* }
			*
			* var defaults = _.partialRight(_.assignInWith, customizer);
			*
			* defaults({ 'a': 1 }, { 'b': 2 }, { 'a': 3 });
			* // => { 'a': 1, 'b': 2 }
			*/
			var assignInWith = createAssigner(function(object, source, srcIndex, customizer) {
				copyObject(source, keysIn(source), object, customizer);
			});
			/**
			* This method is like `_.assign` except that it accepts `customizer`
			* which is invoked to produce the assigned values. If `customizer` returns
			* `undefined`, assignment is handled by the method instead. The `customizer`
			* is invoked with five arguments: (objValue, srcValue, key, object, source).
			*
			* **Note:** This method mutates `object`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Object
			* @param {Object} object The destination object.
			* @param {...Object} sources The source objects.
			* @param {Function} [customizer] The function to customize assigned values.
			* @returns {Object} Returns `object`.
			* @see _.assignInWith
			* @example
			*
			* function customizer(objValue, srcValue) {
			*   return _.isUndefined(objValue) ? srcValue : objValue;
			* }
			*
			* var defaults = _.partialRight(_.assignWith, customizer);
			*
			* defaults({ 'a': 1 }, { 'b': 2 }, { 'a': 3 });
			* // => { 'a': 1, 'b': 2 }
			*/
			var assignWith = createAssigner(function(object, source, srcIndex, customizer) {
				copyObject(source, keys(source), object, customizer);
			});
			/**
			* Creates an array of values corresponding to `paths` of `object`.
			*
			* @static
			* @memberOf _
			* @since 1.0.0
			* @category Object
			* @param {Object} object The object to iterate over.
			* @param {...(string|string[])} [paths] The property paths to pick.
			* @returns {Array} Returns the picked values.
			* @example
			*
			* var object = { 'a': [{ 'b': { 'c': 3 } }, 4] };
			*
			* _.at(object, ['a[0].b.c', 'a[1]']);
			* // => [3, 4]
			*/
			var at = flatRest(baseAt);
			/**
			* Creates an object that inherits from the `prototype` object. If a
			* `properties` object is given, its own enumerable string keyed properties
			* are assigned to the created object.
			*
			* @static
			* @memberOf _
			* @since 2.3.0
			* @category Object
			* @param {Object} prototype The object to inherit from.
			* @param {Object} [properties] The properties to assign to the object.
			* @returns {Object} Returns the new object.
			* @example
			*
			* function Shape() {
			*   this.x = 0;
			*   this.y = 0;
			* }
			*
			* function Circle() {
			*   Shape.call(this);
			* }
			*
			* Circle.prototype = _.create(Shape.prototype, {
			*   'constructor': Circle
			* });
			*
			* var circle = new Circle;
			* circle instanceof Circle;
			* // => true
			*
			* circle instanceof Shape;
			* // => true
			*/
			function create(prototype, properties) {
				var result = baseCreate(prototype);
				return properties == null ? result : baseAssign(result, properties);
			}
			/**
			* Assigns own and inherited enumerable string keyed properties of source
			* objects to the destination object for all destination properties that
			* resolve to `undefined`. Source objects are applied from left to right.
			* Once a property is set, additional values of the same property are ignored.
			*
			* **Note:** This method mutates `object`.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Object
			* @param {Object} object The destination object.
			* @param {...Object} [sources] The source objects.
			* @returns {Object} Returns `object`.
			* @see _.defaultsDeep
			* @example
			*
			* _.defaults({ 'a': 1 }, { 'b': 2 }, { 'a': 3 });
			* // => { 'a': 1, 'b': 2 }
			*/
			var defaults = baseRest(function(object, sources) {
				object = Object(object);
				var index = -1;
				var length = sources.length;
				var guard = length > 2 ? sources[2] : undefined;
				if (guard && isIterateeCall(sources[0], sources[1], guard)) length = 1;
				while (++index < length) {
					var source = sources[index];
					var props = keysIn(source);
					var propsIndex = -1;
					var propsLength = props.length;
					while (++propsIndex < propsLength) {
						var key = props[propsIndex];
						var value = object[key];
						if (value === undefined || eq(value, objectProto[key]) && !hasOwnProperty.call(object, key)) object[key] = source[key];
					}
				}
				return object;
			});
			/**
			* This method is like `_.defaults` except that it recursively assigns
			* default properties.
			*
			* **Note:** This method mutates `object`.
			*
			* @static
			* @memberOf _
			* @since 3.10.0
			* @category Object
			* @param {Object} object The destination object.
			* @param {...Object} [sources] The source objects.
			* @returns {Object} Returns `object`.
			* @see _.defaults
			* @example
			*
			* _.defaultsDeep({ 'a': { 'b': 2 } }, { 'a': { 'b': 1, 'c': 3 } });
			* // => { 'a': { 'b': 2, 'c': 3 } }
			*/
			var defaultsDeep = baseRest(function(args) {
				args.push(undefined, customDefaultsMerge);
				return apply(mergeWith, undefined, args);
			});
			/**
			* This method is like `_.find` except that it returns the key of the first
			* element `predicate` returns truthy for instead of the element itself.
			*
			* @static
			* @memberOf _
			* @since 1.1.0
			* @category Object
			* @param {Object} object The object to inspect.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @returns {string|undefined} Returns the key of the matched element,
			*  else `undefined`.
			* @example
			*
			* var users = {
			*   'barney':  { 'age': 36, 'active': true },
			*   'fred':    { 'age': 40, 'active': false },
			*   'pebbles': { 'age': 1,  'active': true }
			* };
			*
			* _.findKey(users, function(o) { return o.age < 40; });
			* // => 'barney' (iteration order is not guaranteed)
			*
			* // The `_.matches` iteratee shorthand.
			* _.findKey(users, { 'age': 1, 'active': true });
			* // => 'pebbles'
			*
			* // The `_.matchesProperty` iteratee shorthand.
			* _.findKey(users, ['active', false]);
			* // => 'fred'
			*
			* // The `_.property` iteratee shorthand.
			* _.findKey(users, 'active');
			* // => 'barney'
			*/
			function findKey(object, predicate) {
				return baseFindKey(object, getIteratee(predicate, 3), baseForOwn);
			}
			/**
			* This method is like `_.findKey` except that it iterates over elements of
			* a collection in the opposite order.
			*
			* @static
			* @memberOf _
			* @since 2.0.0
			* @category Object
			* @param {Object} object The object to inspect.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @returns {string|undefined} Returns the key of the matched element,
			*  else `undefined`.
			* @example
			*
			* var users = {
			*   'barney':  { 'age': 36, 'active': true },
			*   'fred':    { 'age': 40, 'active': false },
			*   'pebbles': { 'age': 1,  'active': true }
			* };
			*
			* _.findLastKey(users, function(o) { return o.age < 40; });
			* // => returns 'pebbles' assuming `_.findKey` returns 'barney'
			*
			* // The `_.matches` iteratee shorthand.
			* _.findLastKey(users, { 'age': 36, 'active': true });
			* // => 'barney'
			*
			* // The `_.matchesProperty` iteratee shorthand.
			* _.findLastKey(users, ['active', false]);
			* // => 'fred'
			*
			* // The `_.property` iteratee shorthand.
			* _.findLastKey(users, 'active');
			* // => 'pebbles'
			*/
			function findLastKey(object, predicate) {
				return baseFindKey(object, getIteratee(predicate, 3), baseForOwnRight);
			}
			/**
			* Iterates over own and inherited enumerable string keyed properties of an
			* object and invokes `iteratee` for each property. The iteratee is invoked
			* with three arguments: (value, key, object). Iteratee functions may exit
			* iteration early by explicitly returning `false`.
			*
			* @static
			* @memberOf _
			* @since 0.3.0
			* @category Object
			* @param {Object} object The object to iterate over.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @returns {Object} Returns `object`.
			* @see _.forInRight
			* @example
			*
			* function Foo() {
			*   this.a = 1;
			*   this.b = 2;
			* }
			*
			* Foo.prototype.c = 3;
			*
			* _.forIn(new Foo, function(value, key) {
			*   console.log(key);
			* });
			* // => Logs 'a', 'b', then 'c' (iteration order is not guaranteed).
			*/
			function forIn(object, iteratee) {
				return object == null ? object : baseFor(object, getIteratee(iteratee, 3), keysIn);
			}
			/**
			* This method is like `_.forIn` except that it iterates over properties of
			* `object` in the opposite order.
			*
			* @static
			* @memberOf _
			* @since 2.0.0
			* @category Object
			* @param {Object} object The object to iterate over.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @returns {Object} Returns `object`.
			* @see _.forIn
			* @example
			*
			* function Foo() {
			*   this.a = 1;
			*   this.b = 2;
			* }
			*
			* Foo.prototype.c = 3;
			*
			* _.forInRight(new Foo, function(value, key) {
			*   console.log(key);
			* });
			* // => Logs 'c', 'b', then 'a' assuming `_.forIn` logs 'a', 'b', then 'c'.
			*/
			function forInRight(object, iteratee) {
				return object == null ? object : baseForRight(object, getIteratee(iteratee, 3), keysIn);
			}
			/**
			* Iterates over own enumerable string keyed properties of an object and
			* invokes `iteratee` for each property. The iteratee is invoked with three
			* arguments: (value, key, object). Iteratee functions may exit iteration
			* early by explicitly returning `false`.
			*
			* @static
			* @memberOf _
			* @since 0.3.0
			* @category Object
			* @param {Object} object The object to iterate over.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @returns {Object} Returns `object`.
			* @see _.forOwnRight
			* @example
			*
			* function Foo() {
			*   this.a = 1;
			*   this.b = 2;
			* }
			*
			* Foo.prototype.c = 3;
			*
			* _.forOwn(new Foo, function(value, key) {
			*   console.log(key);
			* });
			* // => Logs 'a' then 'b' (iteration order is not guaranteed).
			*/
			function forOwn(object, iteratee) {
				return object && baseForOwn(object, getIteratee(iteratee, 3));
			}
			/**
			* This method is like `_.forOwn` except that it iterates over properties of
			* `object` in the opposite order.
			*
			* @static
			* @memberOf _
			* @since 2.0.0
			* @category Object
			* @param {Object} object The object to iterate over.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @returns {Object} Returns `object`.
			* @see _.forOwn
			* @example
			*
			* function Foo() {
			*   this.a = 1;
			*   this.b = 2;
			* }
			*
			* Foo.prototype.c = 3;
			*
			* _.forOwnRight(new Foo, function(value, key) {
			*   console.log(key);
			* });
			* // => Logs 'b' then 'a' assuming `_.forOwn` logs 'a' then 'b'.
			*/
			function forOwnRight(object, iteratee) {
				return object && baseForOwnRight(object, getIteratee(iteratee, 3));
			}
			/**
			* Creates an array of function property names from own enumerable properties
			* of `object`.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Object
			* @param {Object} object The object to inspect.
			* @returns {Array} Returns the function names.
			* @see _.functionsIn
			* @example
			*
			* function Foo() {
			*   this.a = _.constant('a');
			*   this.b = _.constant('b');
			* }
			*
			* Foo.prototype.c = _.constant('c');
			*
			* _.functions(new Foo);
			* // => ['a', 'b']
			*/
			function functions(object) {
				return object == null ? [] : baseFunctions(object, keys(object));
			}
			/**
			* Creates an array of function property names from own and inherited
			* enumerable properties of `object`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Object
			* @param {Object} object The object to inspect.
			* @returns {Array} Returns the function names.
			* @see _.functions
			* @example
			*
			* function Foo() {
			*   this.a = _.constant('a');
			*   this.b = _.constant('b');
			* }
			*
			* Foo.prototype.c = _.constant('c');
			*
			* _.functionsIn(new Foo);
			* // => ['a', 'b', 'c']
			*/
			function functionsIn(object) {
				return object == null ? [] : baseFunctions(object, keysIn(object));
			}
			/**
			* Gets the value at `path` of `object`. If the resolved value is
			* `undefined`, the `defaultValue` is returned in its place.
			*
			* @static
			* @memberOf _
			* @since 3.7.0
			* @category Object
			* @param {Object} object The object to query.
			* @param {Array|string} path The path of the property to get.
			* @param {*} [defaultValue] The value returned for `undefined` resolved values.
			* @returns {*} Returns the resolved value.
			* @example
			*
			* var object = { 'a': [{ 'b': { 'c': 3 } }] };
			*
			* _.get(object, 'a[0].b.c');
			* // => 3
			*
			* _.get(object, ['a', '0', 'b', 'c']);
			* // => 3
			*
			* _.get(object, 'a.b.c', 'default');
			* // => 'default'
			*/
			function get(object, path, defaultValue) {
				var result = object == null ? undefined : baseGet(object, path);
				return result === undefined ? defaultValue : result;
			}
			/**
			* Checks if `path` is a direct property of `object`.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Object
			* @param {Object} object The object to query.
			* @param {Array|string} path The path to check.
			* @returns {boolean} Returns `true` if `path` exists, else `false`.
			* @example
			*
			* var object = { 'a': { 'b': 2 } };
			* var other = _.create({ 'a': _.create({ 'b': 2 }) });
			*
			* _.has(object, 'a');
			* // => true
			*
			* _.has(object, 'a.b');
			* // => true
			*
			* _.has(object, ['a', 'b']);
			* // => true
			*
			* _.has(other, 'a');
			* // => false
			*/
			function has(object, path) {
				return object != null && hasPath(object, path, baseHas);
			}
			/**
			* Checks if `path` is a direct or inherited property of `object`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Object
			* @param {Object} object The object to query.
			* @param {Array|string} path The path to check.
			* @returns {boolean} Returns `true` if `path` exists, else `false`.
			* @example
			*
			* var object = _.create({ 'a': _.create({ 'b': 2 }) });
			*
			* _.hasIn(object, 'a');
			* // => true
			*
			* _.hasIn(object, 'a.b');
			* // => true
			*
			* _.hasIn(object, ['a', 'b']);
			* // => true
			*
			* _.hasIn(object, 'b');
			* // => false
			*/
			function hasIn(object, path) {
				return object != null && hasPath(object, path, baseHasIn);
			}
			/**
			* Creates an object composed of the inverted keys and values of `object`.
			* If `object` contains duplicate values, subsequent values overwrite
			* property assignments of previous values.
			*
			* @static
			* @memberOf _
			* @since 0.7.0
			* @category Object
			* @param {Object} object The object to invert.
			* @returns {Object} Returns the new inverted object.
			* @example
			*
			* var object = { 'a': 1, 'b': 2, 'c': 1 };
			*
			* _.invert(object);
			* // => { '1': 'c', '2': 'b' }
			*/
			var invert = createInverter(function(result, value, key) {
				if (value != null && typeof value.toString != "function") value = nativeObjectToString.call(value);
				result[value] = key;
			}, constant(identity));
			/**
			* This method is like `_.invert` except that the inverted object is generated
			* from the results of running each element of `object` thru `iteratee`. The
			* corresponding inverted value of each inverted key is an array of keys
			* responsible for generating the inverted value. The iteratee is invoked
			* with one argument: (value).
			*
			* @static
			* @memberOf _
			* @since 4.1.0
			* @category Object
			* @param {Object} object The object to invert.
			* @param {Function} [iteratee=_.identity] The iteratee invoked per element.
			* @returns {Object} Returns the new inverted object.
			* @example
			*
			* var object = { 'a': 1, 'b': 2, 'c': 1 };
			*
			* _.invertBy(object);
			* // => { '1': ['a', 'c'], '2': ['b'] }
			*
			* _.invertBy(object, function(value) {
			*   return 'group' + value;
			* });
			* // => { 'group1': ['a', 'c'], 'group2': ['b'] }
			*/
			var invertBy = createInverter(function(result, value, key) {
				if (value != null && typeof value.toString != "function") value = nativeObjectToString.call(value);
				if (hasOwnProperty.call(result, value)) result[value].push(key);
				else result[value] = [key];
			}, getIteratee);
			/**
			* Invokes the method at `path` of `object`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Object
			* @param {Object} object The object to query.
			* @param {Array|string} path The path of the method to invoke.
			* @param {...*} [args] The arguments to invoke the method with.
			* @returns {*} Returns the result of the invoked method.
			* @example
			*
			* var object = { 'a': [{ 'b': { 'c': [1, 2, 3, 4] } }] };
			*
			* _.invoke(object, 'a[0].b.c.slice', 1, 3);
			* // => [2, 3]
			*/
			var invoke = baseRest(baseInvoke);
			/**
			* Creates an array of the own enumerable property names of `object`.
			*
			* **Note:** Non-object values are coerced to objects. See the
			* [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
			* for more details.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Object
			* @param {Object} object The object to query.
			* @returns {Array} Returns the array of property names.
			* @example
			*
			* function Foo() {
			*   this.a = 1;
			*   this.b = 2;
			* }
			*
			* Foo.prototype.c = 3;
			*
			* _.keys(new Foo);
			* // => ['a', 'b'] (iteration order is not guaranteed)
			*
			* _.keys('hi');
			* // => ['0', '1']
			*/
			function keys(object) {
				return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
			}
			/**
			* Creates an array of the own and inherited enumerable property names of `object`.
			*
			* **Note:** Non-object values are coerced to objects.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Object
			* @param {Object} object The object to query.
			* @returns {Array} Returns the array of property names.
			* @example
			*
			* function Foo() {
			*   this.a = 1;
			*   this.b = 2;
			* }
			*
			* Foo.prototype.c = 3;
			*
			* _.keysIn(new Foo);
			* // => ['a', 'b', 'c'] (iteration order is not guaranteed)
			*/
			function keysIn(object) {
				return isArrayLike(object) ? arrayLikeKeys(object, true) : baseKeysIn(object);
			}
			/**
			* The opposite of `_.mapValues`; this method creates an object with the
			* same values as `object` and keys generated by running each own enumerable
			* string keyed property of `object` thru `iteratee`. The iteratee is invoked
			* with three arguments: (value, key, object).
			*
			* @static
			* @memberOf _
			* @since 3.8.0
			* @category Object
			* @param {Object} object The object to iterate over.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @returns {Object} Returns the new mapped object.
			* @see _.mapValues
			* @example
			*
			* _.mapKeys({ 'a': 1, 'b': 2 }, function(value, key) {
			*   return key + value;
			* });
			* // => { 'a1': 1, 'b2': 2 }
			*/
			function mapKeys(object, iteratee) {
				var result = {};
				iteratee = getIteratee(iteratee, 3);
				baseForOwn(object, function(value, key, object) {
					baseAssignValue(result, iteratee(value, key, object), value);
				});
				return result;
			}
			/**
			* Creates an object with the same keys as `object` and values generated
			* by running each own enumerable string keyed property of `object` thru
			* `iteratee`. The iteratee is invoked with three arguments:
			* (value, key, object).
			*
			* @static
			* @memberOf _
			* @since 2.4.0
			* @category Object
			* @param {Object} object The object to iterate over.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @returns {Object} Returns the new mapped object.
			* @see _.mapKeys
			* @example
			*
			* var users = {
			*   'fred':    { 'user': 'fred',    'age': 40 },
			*   'pebbles': { 'user': 'pebbles', 'age': 1 }
			* };
			*
			* _.mapValues(users, function(o) { return o.age; });
			* // => { 'fred': 40, 'pebbles': 1 } (iteration order is not guaranteed)
			*
			* // The `_.property` iteratee shorthand.
			* _.mapValues(users, 'age');
			* // => { 'fred': 40, 'pebbles': 1 } (iteration order is not guaranteed)
			*/
			function mapValues(object, iteratee) {
				var result = {};
				iteratee = getIteratee(iteratee, 3);
				baseForOwn(object, function(value, key, object) {
					baseAssignValue(result, key, iteratee(value, key, object));
				});
				return result;
			}
			/**
			* This method is like `_.assign` except that it recursively merges own and
			* inherited enumerable string keyed properties of source objects into the
			* destination object. Source properties that resolve to `undefined` are
			* skipped if a destination value exists. Array and plain object properties
			* are merged recursively. Other objects and value types are overridden by
			* assignment. Source objects are applied from left to right. Subsequent
			* sources overwrite property assignments of previous sources.
			*
			* **Note:** This method mutates `object`.
			*
			* @static
			* @memberOf _
			* @since 0.5.0
			* @category Object
			* @param {Object} object The destination object.
			* @param {...Object} [sources] The source objects.
			* @returns {Object} Returns `object`.
			* @example
			*
			* var object = {
			*   'a': [{ 'b': 2 }, { 'd': 4 }]
			* };
			*
			* var other = {
			*   'a': [{ 'c': 3 }, { 'e': 5 }]
			* };
			*
			* _.merge(object, other);
			* // => { 'a': [{ 'b': 2, 'c': 3 }, { 'd': 4, 'e': 5 }] }
			*/
			var merge = createAssigner(function(object, source, srcIndex) {
				baseMerge(object, source, srcIndex);
			});
			/**
			* This method is like `_.merge` except that it accepts `customizer` which
			* is invoked to produce the merged values of the destination and source
			* properties. If `customizer` returns `undefined`, merging is handled by the
			* method instead. The `customizer` is invoked with six arguments:
			* (objValue, srcValue, key, object, source, stack).
			*
			* **Note:** This method mutates `object`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Object
			* @param {Object} object The destination object.
			* @param {...Object} sources The source objects.
			* @param {Function} customizer The function to customize assigned values.
			* @returns {Object} Returns `object`.
			* @example
			*
			* function customizer(objValue, srcValue) {
			*   if (_.isArray(objValue)) {
			*     return objValue.concat(srcValue);
			*   }
			* }
			*
			* var object = { 'a': [1], 'b': [2] };
			* var other = { 'a': [3], 'b': [4] };
			*
			* _.mergeWith(object, other, customizer);
			* // => { 'a': [1, 3], 'b': [2, 4] }
			*/
			var mergeWith = createAssigner(function(object, source, srcIndex, customizer) {
				baseMerge(object, source, srcIndex, customizer);
			});
			/**
			* The opposite of `_.pick`; this method creates an object composed of the
			* own and inherited enumerable property paths of `object` that are not omitted.
			*
			* **Note:** This method is considerably slower than `_.pick`.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Object
			* @param {Object} object The source object.
			* @param {...(string|string[])} [paths] The property paths to omit.
			* @returns {Object} Returns the new object.
			* @example
			*
			* var object = { 'a': 1, 'b': '2', 'c': 3 };
			*
			* _.omit(object, ['a', 'c']);
			* // => { 'b': '2' }
			*/
			var omit = flatRest(function(object, paths) {
				var result = {};
				if (object == null) return result;
				var isDeep = false;
				paths = arrayMap(paths, function(path) {
					path = castPath(path, object);
					isDeep || (isDeep = path.length > 1);
					return path;
				});
				copyObject(object, getAllKeysIn(object), result);
				if (isDeep) result = baseClone(result, CLONE_DEEP_FLAG | CLONE_FLAT_FLAG | CLONE_SYMBOLS_FLAG, customOmitClone);
				var length = paths.length;
				while (length--) baseUnset(result, paths[length]);
				return result;
			});
			/**
			* The opposite of `_.pickBy`; this method creates an object composed of
			* the own and inherited enumerable string keyed properties of `object` that
			* `predicate` doesn't return truthy for. The predicate is invoked with two
			* arguments: (value, key).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Object
			* @param {Object} object The source object.
			* @param {Function} [predicate=_.identity] The function invoked per property.
			* @returns {Object} Returns the new object.
			* @example
			*
			* var object = { 'a': 1, 'b': '2', 'c': 3 };
			*
			* _.omitBy(object, _.isNumber);
			* // => { 'b': '2' }
			*/
			function omitBy(object, predicate) {
				return pickBy(object, negate(getIteratee(predicate)));
			}
			/**
			* Creates an object composed of the picked `object` properties.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Object
			* @param {Object} object The source object.
			* @param {...(string|string[])} [paths] The property paths to pick.
			* @returns {Object} Returns the new object.
			* @example
			*
			* var object = { 'a': 1, 'b': '2', 'c': 3 };
			*
			* _.pick(object, ['a', 'c']);
			* // => { 'a': 1, 'c': 3 }
			*/
			var pick = flatRest(function(object, paths) {
				return object == null ? {} : basePick(object, paths);
			});
			/**
			* Creates an object composed of the `object` properties `predicate` returns
			* truthy for. The predicate is invoked with two arguments: (value, key).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Object
			* @param {Object} object The source object.
			* @param {Function} [predicate=_.identity] The function invoked per property.
			* @returns {Object} Returns the new object.
			* @example
			*
			* var object = { 'a': 1, 'b': '2', 'c': 3 };
			*
			* _.pickBy(object, _.isNumber);
			* // => { 'a': 1, 'c': 3 }
			*/
			function pickBy(object, predicate) {
				if (object == null) return {};
				var props = arrayMap(getAllKeysIn(object), function(prop) {
					return [prop];
				});
				predicate = getIteratee(predicate);
				return basePickBy(object, props, function(value, path) {
					return predicate(value, path[0]);
				});
			}
			/**
			* This method is like `_.get` except that if the resolved value is a
			* function it's invoked with the `this` binding of its parent object and
			* its result is returned.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Object
			* @param {Object} object The object to query.
			* @param {Array|string} path The path of the property to resolve.
			* @param {*} [defaultValue] The value returned for `undefined` resolved values.
			* @returns {*} Returns the resolved value.
			* @example
			*
			* var object = { 'a': [{ 'b': { 'c1': 3, 'c2': _.constant(4) } }] };
			*
			* _.result(object, 'a[0].b.c1');
			* // => 3
			*
			* _.result(object, 'a[0].b.c2');
			* // => 4
			*
			* _.result(object, 'a[0].b.c3', 'default');
			* // => 'default'
			*
			* _.result(object, 'a[0].b.c3', _.constant('default'));
			* // => 'default'
			*/
			function result(object, path, defaultValue) {
				path = castPath(path, object);
				var index = -1, length = path.length;
				if (!length) {
					length = 1;
					object = undefined;
				}
				while (++index < length) {
					var value = object == null ? undefined : object[toKey(path[index])];
					if (value === undefined) {
						index = length;
						value = defaultValue;
					}
					object = isFunction(value) ? value.call(object) : value;
				}
				return object;
			}
			/**
			* Sets the value at `path` of `object`. If a portion of `path` doesn't exist,
			* it's created. Arrays are created for missing index properties while objects
			* are created for all other missing properties. Use `_.setWith` to customize
			* `path` creation.
			*
			* **Note:** This method mutates `object`.
			*
			* @static
			* @memberOf _
			* @since 3.7.0
			* @category Object
			* @param {Object} object The object to modify.
			* @param {Array|string} path The path of the property to set.
			* @param {*} value The value to set.
			* @returns {Object} Returns `object`.
			* @example
			*
			* var object = { 'a': [{ 'b': { 'c': 3 } }] };
			*
			* _.set(object, 'a[0].b.c', 4);
			* console.log(object.a[0].b.c);
			* // => 4
			*
			* _.set(object, ['x', '0', 'y', 'z'], 5);
			* console.log(object.x[0].y.z);
			* // => 5
			*/
			function set(object, path, value) {
				return object == null ? object : baseSet(object, path, value);
			}
			/**
			* This method is like `_.set` except that it accepts `customizer` which is
			* invoked to produce the objects of `path`.  If `customizer` returns `undefined`
			* path creation is handled by the method instead. The `customizer` is invoked
			* with three arguments: (nsValue, key, nsObject).
			*
			* **Note:** This method mutates `object`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Object
			* @param {Object} object The object to modify.
			* @param {Array|string} path The path of the property to set.
			* @param {*} value The value to set.
			* @param {Function} [customizer] The function to customize assigned values.
			* @returns {Object} Returns `object`.
			* @example
			*
			* var object = {};
			*
			* _.setWith(object, '[0][1]', 'a', Object);
			* // => { '0': { '1': 'a' } }
			*/
			function setWith(object, path, value, customizer) {
				customizer = typeof customizer == "function" ? customizer : undefined;
				return object == null ? object : baseSet(object, path, value, customizer);
			}
			/**
			* Creates an array of own enumerable string keyed-value pairs for `object`
			* which can be consumed by `_.fromPairs`. If `object` is a map or set, its
			* entries are returned.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @alias entries
			* @category Object
			* @param {Object} object The object to query.
			* @returns {Array} Returns the key-value pairs.
			* @example
			*
			* function Foo() {
			*   this.a = 1;
			*   this.b = 2;
			* }
			*
			* Foo.prototype.c = 3;
			*
			* _.toPairs(new Foo);
			* // => [['a', 1], ['b', 2]] (iteration order is not guaranteed)
			*/
			var toPairs = createToPairs(keys);
			/**
			* Creates an array of own and inherited enumerable string keyed-value pairs
			* for `object` which can be consumed by `_.fromPairs`. If `object` is a map
			* or set, its entries are returned.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @alias entriesIn
			* @category Object
			* @param {Object} object The object to query.
			* @returns {Array} Returns the key-value pairs.
			* @example
			*
			* function Foo() {
			*   this.a = 1;
			*   this.b = 2;
			* }
			*
			* Foo.prototype.c = 3;
			*
			* _.toPairsIn(new Foo);
			* // => [['a', 1], ['b', 2], ['c', 3]] (iteration order is not guaranteed)
			*/
			var toPairsIn = createToPairs(keysIn);
			/**
			* An alternative to `_.reduce`; this method transforms `object` to a new
			* `accumulator` object which is the result of running each of its own
			* enumerable string keyed properties thru `iteratee`, with each invocation
			* potentially mutating the `accumulator` object. If `accumulator` is not
			* provided, a new object with the same `[[Prototype]]` will be used. The
			* iteratee is invoked with four arguments: (accumulator, value, key, object).
			* Iteratee functions may exit iteration early by explicitly returning `false`.
			*
			* @static
			* @memberOf _
			* @since 1.3.0
			* @category Object
			* @param {Object} object The object to iterate over.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @param {*} [accumulator] The custom accumulator value.
			* @returns {*} Returns the accumulated value.
			* @example
			*
			* _.transform([2, 3, 4], function(result, n) {
			*   result.push(n *= n);
			*   return n % 2 == 0;
			* }, []);
			* // => [4, 9]
			*
			* _.transform({ 'a': 1, 'b': 2, 'c': 1 }, function(result, value, key) {
			*   (result[value] || (result[value] = [])).push(key);
			* }, {});
			* // => { '1': ['a', 'c'], '2': ['b'] }
			*/
			function transform(object, iteratee, accumulator) {
				var isArr = isArray(object), isArrLike = isArr || isBuffer(object) || isTypedArray(object);
				iteratee = getIteratee(iteratee, 4);
				if (accumulator == null) {
					var Ctor = object && object.constructor;
					if (isArrLike) accumulator = isArr ? new Ctor() : [];
					else if (isObject(object)) accumulator = isFunction(Ctor) ? baseCreate(getPrototype(object)) : {};
					else accumulator = {};
				}
				(isArrLike ? arrayEach : baseForOwn)(object, function(value, index, object) {
					return iteratee(accumulator, value, index, object);
				});
				return accumulator;
			}
			/**
			* Removes the property at `path` of `object`.
			*
			* **Note:** This method mutates `object`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Object
			* @param {Object} object The object to modify.
			* @param {Array|string} path The path of the property to unset.
			* @returns {boolean} Returns `true` if the property is deleted, else `false`.
			* @example
			*
			* var object = { 'a': [{ 'b': { 'c': 7 } }] };
			* _.unset(object, 'a[0].b.c');
			* // => true
			*
			* console.log(object);
			* // => { 'a': [{ 'b': {} }] };
			*
			* _.unset(object, ['a', '0', 'b', 'c']);
			* // => true
			*
			* console.log(object);
			* // => { 'a': [{ 'b': {} }] };
			*/
			function unset(object, path) {
				return object == null ? true : baseUnset(object, path);
			}
			/**
			* This method is like `_.set` except that accepts `updater` to produce the
			* value to set. Use `_.updateWith` to customize `path` creation. The `updater`
			* is invoked with one argument: (value).
			*
			* **Note:** This method mutates `object`.
			*
			* @static
			* @memberOf _
			* @since 4.6.0
			* @category Object
			* @param {Object} object The object to modify.
			* @param {Array|string} path The path of the property to set.
			* @param {Function} updater The function to produce the updated value.
			* @returns {Object} Returns `object`.
			* @example
			*
			* var object = { 'a': [{ 'b': { 'c': 3 } }] };
			*
			* _.update(object, 'a[0].b.c', function(n) { return n * n; });
			* console.log(object.a[0].b.c);
			* // => 9
			*
			* _.update(object, 'x[0].y.z', function(n) { return n ? n + 1 : 0; });
			* console.log(object.x[0].y.z);
			* // => 0
			*/
			function update(object, path, updater) {
				return object == null ? object : baseUpdate(object, path, castFunction(updater));
			}
			/**
			* This method is like `_.update` except that it accepts `customizer` which is
			* invoked to produce the objects of `path`.  If `customizer` returns `undefined`
			* path creation is handled by the method instead. The `customizer` is invoked
			* with three arguments: (nsValue, key, nsObject).
			*
			* **Note:** This method mutates `object`.
			*
			* @static
			* @memberOf _
			* @since 4.6.0
			* @category Object
			* @param {Object} object The object to modify.
			* @param {Array|string} path The path of the property to set.
			* @param {Function} updater The function to produce the updated value.
			* @param {Function} [customizer] The function to customize assigned values.
			* @returns {Object} Returns `object`.
			* @example
			*
			* var object = {};
			*
			* _.updateWith(object, '[0][1]', _.constant('a'), Object);
			* // => { '0': { '1': 'a' } }
			*/
			function updateWith(object, path, updater, customizer) {
				customizer = typeof customizer == "function" ? customizer : undefined;
				return object == null ? object : baseUpdate(object, path, castFunction(updater), customizer);
			}
			/**
			* Creates an array of the own enumerable string keyed property values of `object`.
			*
			* **Note:** Non-object values are coerced to objects.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Object
			* @param {Object} object The object to query.
			* @returns {Array} Returns the array of property values.
			* @example
			*
			* function Foo() {
			*   this.a = 1;
			*   this.b = 2;
			* }
			*
			* Foo.prototype.c = 3;
			*
			* _.values(new Foo);
			* // => [1, 2] (iteration order is not guaranteed)
			*
			* _.values('hi');
			* // => ['h', 'i']
			*/
			function values(object) {
				return object == null ? [] : baseValues(object, keys(object));
			}
			/**
			* Creates an array of the own and inherited enumerable string keyed property
			* values of `object`.
			*
			* **Note:** Non-object values are coerced to objects.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Object
			* @param {Object} object The object to query.
			* @returns {Array} Returns the array of property values.
			* @example
			*
			* function Foo() {
			*   this.a = 1;
			*   this.b = 2;
			* }
			*
			* Foo.prototype.c = 3;
			*
			* _.valuesIn(new Foo);
			* // => [1, 2, 3] (iteration order is not guaranteed)
			*/
			function valuesIn(object) {
				return object == null ? [] : baseValues(object, keysIn(object));
			}
			/**
			* Clamps `number` within the inclusive `lower` and `upper` bounds.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Number
			* @param {number} number The number to clamp.
			* @param {number} [lower] The lower bound.
			* @param {number} upper The upper bound.
			* @returns {number} Returns the clamped number.
			* @example
			*
			* _.clamp(-10, -5, 5);
			* // => -5
			*
			* _.clamp(10, -5, 5);
			* // => 5
			*/
			function clamp(number, lower, upper) {
				if (upper === undefined) {
					upper = lower;
					lower = undefined;
				}
				if (upper !== undefined) {
					upper = toNumber(upper);
					upper = upper === upper ? upper : 0;
				}
				if (lower !== undefined) {
					lower = toNumber(lower);
					lower = lower === lower ? lower : 0;
				}
				return baseClamp(toNumber(number), lower, upper);
			}
			/**
			* Checks if `n` is between `start` and up to, but not including, `end`. If
			* `end` is not specified, it's set to `start` with `start` then set to `0`.
			* If `start` is greater than `end` the params are swapped to support
			* negative ranges.
			*
			* @static
			* @memberOf _
			* @since 3.3.0
			* @category Number
			* @param {number} number The number to check.
			* @param {number} [start=0] The start of the range.
			* @param {number} end The end of the range.
			* @returns {boolean} Returns `true` if `number` is in the range, else `false`.
			* @see _.range, _.rangeRight
			* @example
			*
			* _.inRange(3, 2, 4);
			* // => true
			*
			* _.inRange(4, 8);
			* // => true
			*
			* _.inRange(4, 2);
			* // => false
			*
			* _.inRange(2, 2);
			* // => false
			*
			* _.inRange(1.2, 2);
			* // => true
			*
			* _.inRange(5.2, 4);
			* // => false
			*
			* _.inRange(-3, -2, -6);
			* // => true
			*/
			function inRange(number, start, end) {
				start = toFinite(start);
				if (end === undefined) {
					end = start;
					start = 0;
				} else end = toFinite(end);
				number = toNumber(number);
				return baseInRange(number, start, end);
			}
			/**
			* Produces a random number between the inclusive `lower` and `upper` bounds.
			* If only one argument is provided a number between `0` and the given number
			* is returned. If `floating` is `true`, or either `lower` or `upper` are
			* floats, a floating-point number is returned instead of an integer.
			*
			* **Note:** JavaScript follows the IEEE-754 standard for resolving
			* floating-point values which can produce unexpected results.
			*
			* **Note:** If `lower` is greater than `upper`, the values are swapped.
			*
			* @static
			* @memberOf _
			* @since 0.7.0
			* @category Number
			* @param {number} [lower=0] The lower bound.
			* @param {number} [upper=1] The upper bound.
			* @param {boolean} [floating] Specify returning a floating-point number.
			* @returns {number} Returns the random number.
			* @example
			*
			* _.random(0, 5);
			* // => an integer between 0 and 5
			*
			* // when lower is greater than upper the values are swapped
			* _.random(5, 0);
			* // => an integer between 0 and 5
			*
			* _.random(5);
			* // => also an integer between 0 and 5
			*
			* _.random(-5);
			* // => an integer between -5 and 0
			*
			* _.random(5, true);
			* // => a floating-point number between 0 and 5
			*
			* _.random(1.2, 5.2);
			* // => a floating-point number between 1.2 and 5.2
			*/
			function random(lower, upper, floating) {
				if (floating && typeof floating != "boolean" && isIterateeCall(lower, upper, floating)) upper = floating = undefined;
				if (floating === undefined) {
					if (typeof upper == "boolean") {
						floating = upper;
						upper = undefined;
					} else if (typeof lower == "boolean") {
						floating = lower;
						lower = undefined;
					}
				}
				if (lower === undefined && upper === undefined) {
					lower = 0;
					upper = 1;
				} else {
					lower = toFinite(lower);
					if (upper === undefined) {
						upper = lower;
						lower = 0;
					} else upper = toFinite(upper);
				}
				if (lower > upper) {
					var temp = lower;
					lower = upper;
					upper = temp;
				}
				if (floating || lower % 1 || upper % 1) {
					var rand = nativeRandom();
					return nativeMin(lower + rand * (upper - lower + freeParseFloat("1e-" + ((rand + "").length - 1))), upper);
				}
				return baseRandom(lower, upper);
			}
			/**
			* Converts `string` to [camel case](https://en.wikipedia.org/wiki/CamelCase).
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category String
			* @param {string} [string=''] The string to convert.
			* @returns {string} Returns the camel cased string.
			* @example
			*
			* _.camelCase('Foo Bar');
			* // => 'fooBar'
			*
			* _.camelCase('--foo-bar--');
			* // => 'fooBar'
			*
			* _.camelCase('__FOO_BAR__');
			* // => 'fooBar'
			*/
			var camelCase = createCompounder(function(result, word, index) {
				word = word.toLowerCase();
				return result + (index ? capitalize(word) : word);
			});
			/**
			* Converts the first character of `string` to upper case and the remaining
			* to lower case.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category String
			* @param {string} [string=''] The string to capitalize.
			* @returns {string} Returns the capitalized string.
			* @example
			*
			* _.capitalize('FRED');
			* // => 'Fred'
			*/
			function capitalize(string) {
				return upperFirst(toString(string).toLowerCase());
			}
			/**
			* Deburrs `string` by converting
			* [Latin-1 Supplement](https://en.wikipedia.org/wiki/Latin-1_Supplement_(Unicode_block)#Character_table)
			* and [Latin Extended-A](https://en.wikipedia.org/wiki/Latin_Extended-A)
			* letters to basic Latin letters and removing
			* [combining diacritical marks](https://en.wikipedia.org/wiki/Combining_Diacritical_Marks).
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category String
			* @param {string} [string=''] The string to deburr.
			* @returns {string} Returns the deburred string.
			* @example
			*
			* _.deburr('déjà vu');
			* // => 'deja vu'
			*/
			function deburr(string) {
				string = toString(string);
				return string && string.replace(reLatin, deburrLetter).replace(reComboMark, "");
			}
			/**
			* Checks if `string` ends with the given target string.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category String
			* @param {string} [string=''] The string to inspect.
			* @param {string} [target] The string to search for.
			* @param {number} [position=string.length] The position to search up to.
			* @returns {boolean} Returns `true` if `string` ends with `target`,
			*  else `false`.
			* @example
			*
			* _.endsWith('abc', 'c');
			* // => true
			*
			* _.endsWith('abc', 'b');
			* // => false
			*
			* _.endsWith('abc', 'b', 2);
			* // => true
			*/
			function endsWith(string, target, position) {
				string = toString(string);
				target = baseToString(target);
				var length = string.length;
				position = position === undefined ? length : baseClamp(toInteger(position), 0, length);
				var end = position;
				position -= target.length;
				return position >= 0 && string.slice(position, end) == target;
			}
			/**
			* Converts the characters "&", "<", ">", '"', and "'" in `string` to their
			* corresponding HTML entities.
			*
			* **Note:** No other characters are escaped. To escape additional
			* characters use a third-party library like [_he_](https://mths.be/he).
			*
			* Though the ">" character is escaped for symmetry, characters like
			* ">" and "/" don't need escaping in HTML and have no special meaning
			* unless they're part of a tag or unquoted attribute value. See
			* [Mathias Bynens's article](https://mathiasbynens.be/notes/ambiguous-ampersands)
			* (under "semi-related fun fact") for more details.
			*
			* When working with HTML you should always
			* [quote attribute values](http://wonko.com/post/html-escaping) to reduce
			* XSS vectors.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category String
			* @param {string} [string=''] The string to escape.
			* @returns {string} Returns the escaped string.
			* @example
			*
			* _.escape('fred, barney, & pebbles');
			* // => 'fred, barney, &amp; pebbles'
			*/
			function escape(string) {
				string = toString(string);
				return string && reHasUnescapedHtml.test(string) ? string.replace(reUnescapedHtml, escapeHtmlChar) : string;
			}
			/**
			* Escapes the `RegExp` special characters "^", "$", "\", ".", "*", "+",
			* "?", "(", ")", "[", "]", "{", "}", and "|" in `string`.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category String
			* @param {string} [string=''] The string to escape.
			* @returns {string} Returns the escaped string.
			* @example
			*
			* _.escapeRegExp('[lodash](https://lodash.com/)');
			* // => '\[lodash\]\(https://lodash\.com/\)'
			*/
			function escapeRegExp(string) {
				string = toString(string);
				return string && reHasRegExpChar.test(string) ? string.replace(reRegExpChar, "\\$&") : string;
			}
			/**
			* Converts `string` to
			* [kebab case](https://en.wikipedia.org/wiki/Letter_case#Special_case_styles).
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category String
			* @param {string} [string=''] The string to convert.
			* @returns {string} Returns the kebab cased string.
			* @example
			*
			* _.kebabCase('Foo Bar');
			* // => 'foo-bar'
			*
			* _.kebabCase('fooBar');
			* // => 'foo-bar'
			*
			* _.kebabCase('__FOO_BAR__');
			* // => 'foo-bar'
			*/
			var kebabCase = createCompounder(function(result, word, index) {
				return result + (index ? "-" : "") + word.toLowerCase();
			});
			/**
			* Converts `string`, as space separated words, to lower case.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category String
			* @param {string} [string=''] The string to convert.
			* @returns {string} Returns the lower cased string.
			* @example
			*
			* _.lowerCase('--Foo-Bar--');
			* // => 'foo bar'
			*
			* _.lowerCase('fooBar');
			* // => 'foo bar'
			*
			* _.lowerCase('__FOO_BAR__');
			* // => 'foo bar'
			*/
			var lowerCase = createCompounder(function(result, word, index) {
				return result + (index ? " " : "") + word.toLowerCase();
			});
			/**
			* Converts the first character of `string` to lower case.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category String
			* @param {string} [string=''] The string to convert.
			* @returns {string} Returns the converted string.
			* @example
			*
			* _.lowerFirst('Fred');
			* // => 'fred'
			*
			* _.lowerFirst('FRED');
			* // => 'fRED'
			*/
			var lowerFirst = createCaseFirst("toLowerCase");
			/**
			* Pads `string` on the left and right sides if it's shorter than `length`.
			* Padding characters are truncated if they can't be evenly divided by `length`.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category String
			* @param {string} [string=''] The string to pad.
			* @param {number} [length=0] The padding length.
			* @param {string} [chars=' '] The string used as padding.
			* @returns {string} Returns the padded string.
			* @example
			*
			* _.pad('abc', 8);
			* // => '  abc   '
			*
			* _.pad('abc', 8, '_-');
			* // => '_-abc_-_'
			*
			* _.pad('abc', 3);
			* // => 'abc'
			*/
			function pad(string, length, chars) {
				string = toString(string);
				length = toInteger(length);
				var strLength = length ? stringSize(string) : 0;
				if (!length || strLength >= length) return string;
				var mid = (length - strLength) / 2;
				return createPadding(nativeFloor(mid), chars) + string + createPadding(nativeCeil(mid), chars);
			}
			/**
			* Pads `string` on the right side if it's shorter than `length`. Padding
			* characters are truncated if they exceed `length`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category String
			* @param {string} [string=''] The string to pad.
			* @param {number} [length=0] The padding length.
			* @param {string} [chars=' '] The string used as padding.
			* @returns {string} Returns the padded string.
			* @example
			*
			* _.padEnd('abc', 6);
			* // => 'abc   '
			*
			* _.padEnd('abc', 6, '_-');
			* // => 'abc_-_'
			*
			* _.padEnd('abc', 3);
			* // => 'abc'
			*/
			function padEnd(string, length, chars) {
				string = toString(string);
				length = toInteger(length);
				var strLength = length ? stringSize(string) : 0;
				return length && strLength < length ? string + createPadding(length - strLength, chars) : string;
			}
			/**
			* Pads `string` on the left side if it's shorter than `length`. Padding
			* characters are truncated if they exceed `length`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category String
			* @param {string} [string=''] The string to pad.
			* @param {number} [length=0] The padding length.
			* @param {string} [chars=' '] The string used as padding.
			* @returns {string} Returns the padded string.
			* @example
			*
			* _.padStart('abc', 6);
			* // => '   abc'
			*
			* _.padStart('abc', 6, '_-');
			* // => '_-_abc'
			*
			* _.padStart('abc', 3);
			* // => 'abc'
			*/
			function padStart(string, length, chars) {
				string = toString(string);
				length = toInteger(length);
				var strLength = length ? stringSize(string) : 0;
				return length && strLength < length ? createPadding(length - strLength, chars) + string : string;
			}
			/**
			* Converts `string` to an integer of the specified radix. If `radix` is
			* `undefined` or `0`, a `radix` of `10` is used unless `value` is a
			* hexadecimal, in which case a `radix` of `16` is used.
			*
			* **Note:** This method aligns with the
			* [ES5 implementation](https://es5.github.io/#x15.1.2.2) of `parseInt`.
			*
			* @static
			* @memberOf _
			* @since 1.1.0
			* @category String
			* @param {string} string The string to convert.
			* @param {number} [radix=10] The radix to interpret `value` by.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {number} Returns the converted integer.
			* @example
			*
			* _.parseInt('08');
			* // => 8
			*
			* _.map(['6', '08', '10'], _.parseInt);
			* // => [6, 8, 10]
			*/
			function parseInt(string, radix, guard) {
				if (guard || radix == null) radix = 0;
				else if (radix) radix = +radix;
				return nativeParseInt(toString(string).replace(reTrimStart, ""), radix || 0);
			}
			/**
			* Repeats the given string `n` times.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category String
			* @param {string} [string=''] The string to repeat.
			* @param {number} [n=1] The number of times to repeat the string.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {string} Returns the repeated string.
			* @example
			*
			* _.repeat('*', 3);
			* // => '***'
			*
			* _.repeat('abc', 2);
			* // => 'abcabc'
			*
			* _.repeat('abc', 0);
			* // => ''
			*/
			function repeat(string, n, guard) {
				if (guard ? isIterateeCall(string, n, guard) : n === undefined) n = 1;
				else n = toInteger(n);
				return baseRepeat(toString(string), n);
			}
			/**
			* Replaces matches for `pattern` in `string` with `replacement`.
			*
			* **Note:** This method is based on
			* [`String#replace`](https://mdn.io/String/replace).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category String
			* @param {string} [string=''] The string to modify.
			* @param {RegExp|string} pattern The pattern to replace.
			* @param {Function|string} replacement The match replacement.
			* @returns {string} Returns the modified string.
			* @example
			*
			* _.replace('Hi Fred', 'Fred', 'Barney');
			* // => 'Hi Barney'
			*/
			function replace() {
				var args = arguments, string = toString(args[0]);
				return args.length < 3 ? string : string.replace(args[1], args[2]);
			}
			/**
			* Converts `string` to
			* [snake case](https://en.wikipedia.org/wiki/Snake_case).
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category String
			* @param {string} [string=''] The string to convert.
			* @returns {string} Returns the snake cased string.
			* @example
			*
			* _.snakeCase('Foo Bar');
			* // => 'foo_bar'
			*
			* _.snakeCase('fooBar');
			* // => 'foo_bar'
			*
			* _.snakeCase('--FOO-BAR--');
			* // => 'foo_bar'
			*/
			var snakeCase = createCompounder(function(result, word, index) {
				return result + (index ? "_" : "") + word.toLowerCase();
			});
			/**
			* Splits `string` by `separator`.
			*
			* **Note:** This method is based on
			* [`String#split`](https://mdn.io/String/split).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category String
			* @param {string} [string=''] The string to split.
			* @param {RegExp|string} separator The separator pattern to split by.
			* @param {number} [limit] The length to truncate results to.
			* @returns {Array} Returns the string segments.
			* @example
			*
			* _.split('a-b-c', '-', 2);
			* // => ['a', 'b']
			*/
			function split(string, separator, limit) {
				if (limit && typeof limit != "number" && isIterateeCall(string, separator, limit)) separator = limit = undefined;
				limit = limit === undefined ? MAX_ARRAY_LENGTH : limit >>> 0;
				if (!limit) return [];
				string = toString(string);
				if (string && (typeof separator == "string" || separator != null && !isRegExp(separator))) {
					separator = baseToString(separator);
					if (!separator && hasUnicode(string)) return castSlice(stringToArray(string), 0, limit);
				}
				return string.split(separator, limit);
			}
			/**
			* Converts `string` to
			* [start case](https://en.wikipedia.org/wiki/Letter_case#Stylistic_or_specialised_usage).
			*
			* @static
			* @memberOf _
			* @since 3.1.0
			* @category String
			* @param {string} [string=''] The string to convert.
			* @returns {string} Returns the start cased string.
			* @example
			*
			* _.startCase('--foo-bar--');
			* // => 'Foo Bar'
			*
			* _.startCase('fooBar');
			* // => 'Foo Bar'
			*
			* _.startCase('__FOO_BAR__');
			* // => 'FOO BAR'
			*/
			var startCase = createCompounder(function(result, word, index) {
				return result + (index ? " " : "") + upperFirst(word);
			});
			/**
			* Checks if `string` starts with the given target string.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category String
			* @param {string} [string=''] The string to inspect.
			* @param {string} [target] The string to search for.
			* @param {number} [position=0] The position to search from.
			* @returns {boolean} Returns `true` if `string` starts with `target`,
			*  else `false`.
			* @example
			*
			* _.startsWith('abc', 'a');
			* // => true
			*
			* _.startsWith('abc', 'b');
			* // => false
			*
			* _.startsWith('abc', 'b', 1);
			* // => true
			*/
			function startsWith(string, target, position) {
				string = toString(string);
				position = position == null ? 0 : baseClamp(toInteger(position), 0, string.length);
				target = baseToString(target);
				return string.slice(position, position + target.length) == target;
			}
			/**
			* Creates a compiled template function that can interpolate data properties
			* in "interpolate" delimiters, HTML-escape interpolated data properties in
			* "escape" delimiters, and execute JavaScript in "evaluate" delimiters. Data
			* properties may be accessed as free variables in the template. If a setting
			* object is given, it takes precedence over `_.templateSettings` values.
			*
			* **Security:** `_.template` is insecure and should not be used. It will be
			* removed in Lodash v5. Avoid untrusted input. See
			* [threat model](https://github.com/lodash/lodash/blob/main/threat-model.md).
			*
			* **Note:** In the development build `_.template` utilizes
			* [sourceURLs](http://www.html5rocks.com/en/tutorials/developertools/sourcemaps/#toc-sourceurl)
			* for easier debugging.
			*
			* For more information on precompiling templates see
			* [lodash's custom builds documentation](https://lodash.com/custom-builds).
			*
			* For more information on Chrome extension sandboxes see
			* [Chrome's extensions documentation](https://developer.chrome.com/extensions/sandboxingEval).
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category String
			* @param {string} [string=''] The template string.
			* @param {Object} [options={}] The options object.
			* @param {RegExp} [options.escape=_.templateSettings.escape]
			*  The HTML "escape" delimiter.
			* @param {RegExp} [options.evaluate=_.templateSettings.evaluate]
			*  The "evaluate" delimiter.
			* @param {Object} [options.imports=_.templateSettings.imports]
			*  An object to import into the template as free variables.
			* @param {RegExp} [options.interpolate=_.templateSettings.interpolate]
			*  The "interpolate" delimiter.
			* @param {string} [options.sourceURL='lodash.templateSources[n]']
			*  The sourceURL of the compiled template.
			* @param {string} [options.variable='obj']
			*  The data object variable name.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {Function} Returns the compiled template function.
			* @example
			*
			* // Use the "interpolate" delimiter to create a compiled template.
			* var compiled = _.template('hello <%= user %>!');
			* compiled({ 'user': 'fred' });
			* // => 'hello fred!'
			*
			* // Use the HTML "escape" delimiter to escape data property values.
			* var compiled = _.template('<b><%- value %></b>');
			* compiled({ 'value': '<script>' });
			* // => '<b>&lt;script&gt;</b>'
			*
			* // Use the "evaluate" delimiter to execute JavaScript and generate HTML.
			* var compiled = _.template('<% _.forEach(users, function(user) { %><li><%- user %></li><% }); %>');
			* compiled({ 'users': ['fred', 'barney'] });
			* // => '<li>fred</li><li>barney</li>'
			*
			* // Use the internal `print` function in "evaluate" delimiters.
			* var compiled = _.template('<% print("hello " + user); %>!');
			* compiled({ 'user': 'barney' });
			* // => 'hello barney!'
			*
			* // Use the ES template literal delimiter as an "interpolate" delimiter.
			* // Disable support by replacing the "interpolate" delimiter.
			* var compiled = _.template('hello ${ user }!');
			* compiled({ 'user': 'pebbles' });
			* // => 'hello pebbles!'
			*
			* // Use backslashes to treat delimiters as plain text.
			* var compiled = _.template('<%= "\\<%- value %\\>" %>');
			* compiled({ 'value': 'ignored' });
			* // => '<%- value %>'
			*
			* // Use the `imports` option to import `jQuery` as `jq`.
			* var text = '<% jq.each(users, function(user) { %><li><%- user %></li><% }); %>';
			* var compiled = _.template(text, { 'imports': { 'jq': jQuery } });
			* compiled({ 'users': ['fred', 'barney'] });
			* // => '<li>fred</li><li>barney</li>'
			*
			* // Use the `sourceURL` option to specify a custom sourceURL for the template.
			* var compiled = _.template('hello <%= user %>!', { 'sourceURL': '/basic/greeting.jst' });
			* compiled(data);
			* // => Find the source of "greeting.jst" under the Sources tab or Resources panel of the web inspector.
			*
			* // Use the `variable` option to ensure a with-statement isn't used in the compiled template.
			* var compiled = _.template('hi <%= data.user %>!', { 'variable': 'data' });
			* compiled.source;
			* // => function(data) {
			* //   var __t, __p = '';
			* //   __p += 'hi ' + ((__t = ( data.user )) == null ? '' : __t) + '!';
			* //   return __p;
			* // }
			*
			* // Use custom template delimiters.
			* _.templateSettings.interpolate = /{{([\s\S]+?)}}/g;
			* var compiled = _.template('hello {{ user }}!');
			* compiled({ 'user': 'mustache' });
			* // => 'hello mustache!'
			*
			* // Use the `source` property to inline compiled templates for meaningful
			* // line numbers in error messages and stack traces.
			* fs.writeFileSync(path.join(process.cwd(), 'jst.js'), '\
			*   var JST = {\
			*     "main": ' + _.template(mainText).source + '\
			*   };\
			* ');
			*/
			function template(string, options, guard) {
				var settings = lodash.templateSettings;
				if (guard && isIterateeCall(string, options, guard)) options = undefined;
				string = toString(string);
				options = assignWith({}, options, settings, customDefaultsAssignIn);
				var imports = assignWith({}, options.imports, settings.imports, customDefaultsAssignIn), importsKeys = keys(imports), importsValues = baseValues(imports, importsKeys);
				arrayEach(importsKeys, function(key) {
					if (reForbiddenIdentifierChars.test(key)) throw new Error(INVALID_TEMPL_IMPORTS_ERROR_TEXT);
				});
				var isEscaping, isEvaluating, index = 0, interpolate = options.interpolate || reNoMatch, source = "__p += '";
				var reDelimiters = RegExp((options.escape || reNoMatch).source + "|" + interpolate.source + "|" + (interpolate === reInterpolate ? reEsTemplate : reNoMatch).source + "|" + (options.evaluate || reNoMatch).source + "|$", "g");
				var sourceURL = "//# sourceURL=" + (hasOwnProperty.call(options, "sourceURL") ? (options.sourceURL + "").replace(/\s/g, " ") : "lodash.templateSources[" + ++templateCounter + "]") + "\n";
				string.replace(reDelimiters, function(match, escapeValue, interpolateValue, esTemplateValue, evaluateValue, offset) {
					interpolateValue || (interpolateValue = esTemplateValue);
					source += string.slice(index, offset).replace(reUnescapedString, escapeStringChar);
					if (escapeValue) {
						isEscaping = true;
						source += "' +\n__e(" + escapeValue + ") +\n'";
					}
					if (evaluateValue) {
						isEvaluating = true;
						source += "';\n" + evaluateValue + ";\n__p += '";
					}
					if (interpolateValue) source += "' +\n((__t = (" + interpolateValue + ")) == null ? '' : __t) +\n'";
					index = offset + match.length;
					return match;
				});
				source += "';\n";
				var variable = hasOwnProperty.call(options, "variable") && options.variable;
				if (!variable) source = "with (obj) {\n" + source + "\n}\n";
				else if (reForbiddenIdentifierChars.test(variable)) throw new Error(INVALID_TEMPL_VAR_ERROR_TEXT);
				source = (isEvaluating ? source.replace(reEmptyStringLeading, "") : source).replace(reEmptyStringMiddle, "$1").replace(reEmptyStringTrailing, "$1;");
				source = "function(" + (variable || "obj") + ") {\n" + (variable ? "" : "obj || (obj = {});\n") + "var __t, __p = ''" + (isEscaping ? ", __e = _.escape" : "") + (isEvaluating ? ", __j = Array.prototype.join;\nfunction print() { __p += __j.call(arguments, '') }\n" : ";\n") + source + "return __p\n}";
				var result = attempt(function() {
					return Function(importsKeys, sourceURL + "return " + source).apply(undefined, importsValues);
				});
				result.source = source;
				if (isError(result)) throw result;
				return result;
			}
			/**
			* Converts `string`, as a whole, to lower case just like
			* [String#toLowerCase](https://mdn.io/toLowerCase).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category String
			* @param {string} [string=''] The string to convert.
			* @returns {string} Returns the lower cased string.
			* @example
			*
			* _.toLower('--Foo-Bar--');
			* // => '--foo-bar--'
			*
			* _.toLower('fooBar');
			* // => 'foobar'
			*
			* _.toLower('__FOO_BAR__');
			* // => '__foo_bar__'
			*/
			function toLower(value) {
				return toString(value).toLowerCase();
			}
			/**
			* Converts `string`, as a whole, to upper case just like
			* [String#toUpperCase](https://mdn.io/toUpperCase).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category String
			* @param {string} [string=''] The string to convert.
			* @returns {string} Returns the upper cased string.
			* @example
			*
			* _.toUpper('--foo-bar--');
			* // => '--FOO-BAR--'
			*
			* _.toUpper('fooBar');
			* // => 'FOOBAR'
			*
			* _.toUpper('__foo_bar__');
			* // => '__FOO_BAR__'
			*/
			function toUpper(value) {
				return toString(value).toUpperCase();
			}
			/**
			* Removes leading and trailing whitespace or specified characters from `string`.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category String
			* @param {string} [string=''] The string to trim.
			* @param {string} [chars=whitespace] The characters to trim.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {string} Returns the trimmed string.
			* @example
			*
			* _.trim('  abc  ');
			* // => 'abc'
			*
			* _.trim('-_-abc-_-', '_-');
			* // => 'abc'
			*
			* _.map(['  foo  ', '  bar  '], _.trim);
			* // => ['foo', 'bar']
			*/
			function trim(string, chars, guard) {
				string = toString(string);
				if (string && (guard || chars === undefined)) return baseTrim(string);
				if (!string || !(chars = baseToString(chars))) return string;
				var strSymbols = stringToArray(string), chrSymbols = stringToArray(chars);
				return castSlice(strSymbols, charsStartIndex(strSymbols, chrSymbols), charsEndIndex(strSymbols, chrSymbols) + 1).join("");
			}
			/**
			* Removes trailing whitespace or specified characters from `string`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category String
			* @param {string} [string=''] The string to trim.
			* @param {string} [chars=whitespace] The characters to trim.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {string} Returns the trimmed string.
			* @example
			*
			* _.trimEnd('  abc  ');
			* // => '  abc'
			*
			* _.trimEnd('-_-abc-_-', '_-');
			* // => '-_-abc'
			*/
			function trimEnd(string, chars, guard) {
				string = toString(string);
				if (string && (guard || chars === undefined)) return string.slice(0, trimmedEndIndex(string) + 1);
				if (!string || !(chars = baseToString(chars))) return string;
				var strSymbols = stringToArray(string);
				return castSlice(strSymbols, 0, charsEndIndex(strSymbols, stringToArray(chars)) + 1).join("");
			}
			/**
			* Removes leading whitespace or specified characters from `string`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category String
			* @param {string} [string=''] The string to trim.
			* @param {string} [chars=whitespace] The characters to trim.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {string} Returns the trimmed string.
			* @example
			*
			* _.trimStart('  abc  ');
			* // => 'abc  '
			*
			* _.trimStart('-_-abc-_-', '_-');
			* // => 'abc-_-'
			*/
			function trimStart(string, chars, guard) {
				string = toString(string);
				if (string && (guard || chars === undefined)) return string.replace(reTrimStart, "");
				if (!string || !(chars = baseToString(chars))) return string;
				var strSymbols = stringToArray(string);
				return castSlice(strSymbols, charsStartIndex(strSymbols, stringToArray(chars))).join("");
			}
			/**
			* Truncates `string` if it's longer than the given maximum string length.
			* The last characters of the truncated string are replaced with the omission
			* string which defaults to "...".
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category String
			* @param {string} [string=''] The string to truncate.
			* @param {Object} [options={}] The options object.
			* @param {number} [options.length=30] The maximum string length.
			* @param {string} [options.omission='...'] The string to indicate text is omitted.
			* @param {RegExp|string} [options.separator] The separator pattern to truncate to.
			* @returns {string} Returns the truncated string.
			* @example
			*
			* _.truncate('hi-diddly-ho there, neighborino');
			* // => 'hi-diddly-ho there, neighbo...'
			*
			* _.truncate('hi-diddly-ho there, neighborino', {
			*   'length': 24,
			*   'separator': ' '
			* });
			* // => 'hi-diddly-ho there,...'
			*
			* _.truncate('hi-diddly-ho there, neighborino', {
			*   'length': 24,
			*   'separator': /,? +/
			* });
			* // => 'hi-diddly-ho there...'
			*
			* _.truncate('hi-diddly-ho there, neighborino', {
			*   'omission': ' [...]'
			* });
			* // => 'hi-diddly-ho there, neig [...]'
			*/
			function truncate(string, options) {
				var length = DEFAULT_TRUNC_LENGTH, omission = DEFAULT_TRUNC_OMISSION;
				if (isObject(options)) {
					var separator = "separator" in options ? options.separator : separator;
					length = "length" in options ? toInteger(options.length) : length;
					omission = "omission" in options ? baseToString(options.omission) : omission;
				}
				string = toString(string);
				var strLength = string.length;
				if (hasUnicode(string)) {
					var strSymbols = stringToArray(string);
					strLength = strSymbols.length;
				}
				if (length >= strLength) return string;
				var end = length - stringSize(omission);
				if (end < 1) return omission;
				var result = strSymbols ? castSlice(strSymbols, 0, end).join("") : string.slice(0, end);
				if (separator === undefined) return result + omission;
				if (strSymbols) end += result.length - end;
				if (isRegExp(separator)) {
					if (string.slice(end).search(separator)) {
						var match, substring = result;
						if (!separator.global) separator = RegExp(separator.source, toString(reFlags.exec(separator)) + "g");
						separator.lastIndex = 0;
						while (match = separator.exec(substring)) var newEnd = match.index;
						result = result.slice(0, newEnd === undefined ? end : newEnd);
					}
				} else if (string.indexOf(baseToString(separator), end) != end) {
					var index = result.lastIndexOf(separator);
					if (index > -1) result = result.slice(0, index);
				}
				return result + omission;
			}
			/**
			* The inverse of `_.escape`; this method converts the HTML entities
			* `&amp;`, `&lt;`, `&gt;`, `&quot;`, and `&#39;` in `string` to
			* their corresponding characters.
			*
			* **Note:** No other HTML entities are unescaped. To unescape additional
			* HTML entities use a third-party library like [_he_](https://mths.be/he).
			*
			* @static
			* @memberOf _
			* @since 0.6.0
			* @category String
			* @param {string} [string=''] The string to unescape.
			* @returns {string} Returns the unescaped string.
			* @example
			*
			* _.unescape('fred, barney, &amp; pebbles');
			* // => 'fred, barney, & pebbles'
			*/
			function unescape(string) {
				string = toString(string);
				return string && reHasEscapedHtml.test(string) ? string.replace(reEscapedHtml, unescapeHtmlChar) : string;
			}
			/**
			* Converts `string`, as space separated words, to upper case.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category String
			* @param {string} [string=''] The string to convert.
			* @returns {string} Returns the upper cased string.
			* @example
			*
			* _.upperCase('--foo-bar');
			* // => 'FOO BAR'
			*
			* _.upperCase('fooBar');
			* // => 'FOO BAR'
			*
			* _.upperCase('__foo_bar__');
			* // => 'FOO BAR'
			*/
			var upperCase = createCompounder(function(result, word, index) {
				return result + (index ? " " : "") + word.toUpperCase();
			});
			/**
			* Converts the first character of `string` to upper case.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category String
			* @param {string} [string=''] The string to convert.
			* @returns {string} Returns the converted string.
			* @example
			*
			* _.upperFirst('fred');
			* // => 'Fred'
			*
			* _.upperFirst('FRED');
			* // => 'FRED'
			*/
			var upperFirst = createCaseFirst("toUpperCase");
			/**
			* Splits `string` into an array of its words.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category String
			* @param {string} [string=''] The string to inspect.
			* @param {RegExp|string} [pattern] The pattern to match words.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {Array} Returns the words of `string`.
			* @example
			*
			* _.words('fred, barney, & pebbles');
			* // => ['fred', 'barney', 'pebbles']
			*
			* _.words('fred, barney, & pebbles', /[^, ]+/g);
			* // => ['fred', 'barney', '&', 'pebbles']
			*/
			function words(string, pattern, guard) {
				string = toString(string);
				pattern = guard ? undefined : pattern;
				if (pattern === undefined) return hasUnicodeWord(string) ? unicodeWords(string) : asciiWords(string);
				return string.match(pattern) || [];
			}
			/**
			* Attempts to invoke `func`, returning either the result or the caught error
			* object. Any additional arguments are provided to `func` when it's invoked.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Util
			* @param {Function} func The function to attempt.
			* @param {...*} [args] The arguments to invoke `func` with.
			* @returns {*} Returns the `func` result or error object.
			* @example
			*
			* // Avoid throwing errors for invalid selectors.
			* var elements = _.attempt(function(selector) {
			*   return document.querySelectorAll(selector);
			* }, '>_>');
			*
			* if (_.isError(elements)) {
			*   elements = [];
			* }
			*/
			var attempt = baseRest(function(func, args) {
				try {
					return apply(func, undefined, args);
				} catch (e) {
					return isError(e) ? e : new Error(e);
				}
			});
			/**
			* Binds methods of an object to the object itself, overwriting the existing
			* method.
			*
			* **Note:** This method doesn't set the "length" property of bound functions.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Util
			* @param {Object} object The object to bind and assign the bound methods to.
			* @param {...(string|string[])} methodNames The object method names to bind.
			* @returns {Object} Returns `object`.
			* @example
			*
			* var view = {
			*   'label': 'docs',
			*   'click': function() {
			*     console.log('clicked ' + this.label);
			*   }
			* };
			*
			* _.bindAll(view, ['click']);
			* jQuery(element).on('click', view.click);
			* // => Logs 'clicked docs' when clicked.
			*/
			var bindAll = flatRest(function(object, methodNames) {
				arrayEach(methodNames, function(key) {
					key = toKey(key);
					baseAssignValue(object, key, bind(object[key], object));
				});
				return object;
			});
			/**
			* Creates a function that iterates over `pairs` and invokes the corresponding
			* function of the first predicate to return truthy. The predicate-function
			* pairs are invoked with the `this` binding and arguments of the created
			* function.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Util
			* @param {Array} pairs The predicate-function pairs.
			* @returns {Function} Returns the new composite function.
			* @example
			*
			* var func = _.cond([
			*   [_.matches({ 'a': 1 }),           _.constant('matches A')],
			*   [_.conforms({ 'b': _.isNumber }), _.constant('matches B')],
			*   [_.stubTrue,                      _.constant('no match')]
			* ]);
			*
			* func({ 'a': 1, 'b': 2 });
			* // => 'matches A'
			*
			* func({ 'a': 0, 'b': 1 });
			* // => 'matches B'
			*
			* func({ 'a': '1', 'b': '2' });
			* // => 'no match'
			*/
			function cond(pairs) {
				var length = pairs == null ? 0 : pairs.length, toIteratee = getIteratee();
				pairs = !length ? [] : arrayMap(pairs, function(pair) {
					if (typeof pair[1] != "function") throw new TypeError(FUNC_ERROR_TEXT);
					return [toIteratee(pair[0]), pair[1]];
				});
				return baseRest(function(args) {
					var index = -1;
					while (++index < length) {
						var pair = pairs[index];
						if (apply(pair[0], this, args)) return apply(pair[1], this, args);
					}
				});
			}
			/**
			* Creates a function that invokes the predicate properties of `source` with
			* the corresponding property values of a given object, returning `true` if
			* all predicates return truthy, else `false`.
			*
			* **Note:** The created function is equivalent to `_.conformsTo` with
			* `source` partially applied.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Util
			* @param {Object} source The object of property predicates to conform to.
			* @returns {Function} Returns the new spec function.
			* @example
			*
			* var objects = [
			*   { 'a': 2, 'b': 1 },
			*   { 'a': 1, 'b': 2 }
			* ];
			*
			* _.filter(objects, _.conforms({ 'b': function(n) { return n > 1; } }));
			* // => [{ 'a': 1, 'b': 2 }]
			*/
			function conforms(source) {
				return baseConforms(baseClone(source, CLONE_DEEP_FLAG));
			}
			/**
			* Creates a function that returns `value`.
			*
			* @static
			* @memberOf _
			* @since 2.4.0
			* @category Util
			* @param {*} value The value to return from the new function.
			* @returns {Function} Returns the new constant function.
			* @example
			*
			* var objects = _.times(2, _.constant({ 'a': 1 }));
			*
			* console.log(objects);
			* // => [{ 'a': 1 }, { 'a': 1 }]
			*
			* console.log(objects[0] === objects[1]);
			* // => true
			*/
			function constant(value) {
				return function() {
					return value;
				};
			}
			/**
			* Checks `value` to determine whether a default value should be returned in
			* its place. The `defaultValue` is returned if `value` is `NaN`, `null`,
			* or `undefined`.
			*
			* @static
			* @memberOf _
			* @since 4.14.0
			* @category Util
			* @param {*} value The value to check.
			* @param {*} defaultValue The default value.
			* @returns {*} Returns the resolved value.
			* @example
			*
			* _.defaultTo(1, 10);
			* // => 1
			*
			* _.defaultTo(undefined, 10);
			* // => 10
			*/
			function defaultTo(value, defaultValue) {
				return value == null || value !== value ? defaultValue : value;
			}
			/**
			* Creates a function that returns the result of invoking the given functions
			* with the `this` binding of the created function, where each successive
			* invocation is supplied the return value of the previous.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Util
			* @param {...(Function|Function[])} [funcs] The functions to invoke.
			* @returns {Function} Returns the new composite function.
			* @see _.flowRight
			* @example
			*
			* function square(n) {
			*   return n * n;
			* }
			*
			* var addSquare = _.flow([_.add, square]);
			* addSquare(1, 2);
			* // => 9
			*/
			var flow = createFlow();
			/**
			* This method is like `_.flow` except that it creates a function that
			* invokes the given functions from right to left.
			*
			* @static
			* @since 3.0.0
			* @memberOf _
			* @category Util
			* @param {...(Function|Function[])} [funcs] The functions to invoke.
			* @returns {Function} Returns the new composite function.
			* @see _.flow
			* @example
			*
			* function square(n) {
			*   return n * n;
			* }
			*
			* var addSquare = _.flowRight([square, _.add]);
			* addSquare(1, 2);
			* // => 9
			*/
			var flowRight = createFlow(true);
			/**
			* This method returns the first argument it receives.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Util
			* @param {*} value Any value.
			* @returns {*} Returns `value`.
			* @example
			*
			* var object = { 'a': 1 };
			*
			* console.log(_.identity(object) === object);
			* // => true
			*/
			function identity(value) {
				return value;
			}
			/**
			* Creates a function that invokes `func` with the arguments of the created
			* function. If `func` is a property name, the created function returns the
			* property value for a given element. If `func` is an array or object, the
			* created function returns `true` for elements that contain the equivalent
			* source properties, otherwise it returns `false`.
			*
			* @static
			* @since 4.0.0
			* @memberOf _
			* @category Util
			* @param {*} [func=_.identity] The value to convert to a callback.
			* @returns {Function} Returns the callback.
			* @example
			*
			* var users = [
			*   { 'user': 'barney', 'age': 36, 'active': true },
			*   { 'user': 'fred',   'age': 40, 'active': false }
			* ];
			*
			* // The `_.matches` iteratee shorthand.
			* _.filter(users, _.iteratee({ 'user': 'barney', 'active': true }));
			* // => [{ 'user': 'barney', 'age': 36, 'active': true }]
			*
			* // The `_.matchesProperty` iteratee shorthand.
			* _.filter(users, _.iteratee(['user', 'fred']));
			* // => [{ 'user': 'fred', 'age': 40 }]
			*
			* // The `_.property` iteratee shorthand.
			* _.map(users, _.iteratee('user'));
			* // => ['barney', 'fred']
			*
			* // Create custom iteratee shorthands.
			* _.iteratee = _.wrap(_.iteratee, function(iteratee, func) {
			*   return !_.isRegExp(func) ? iteratee(func) : function(string) {
			*     return func.test(string);
			*   };
			* });
			*
			* _.filter(['abc', 'def'], /ef/);
			* // => ['def']
			*/
			function iteratee(func) {
				return baseIteratee(typeof func == "function" ? func : baseClone(func, CLONE_DEEP_FLAG));
			}
			/**
			* Creates a function that performs a partial deep comparison between a given
			* object and `source`, returning `true` if the given object has equivalent
			* property values, else `false`.
			*
			* **Note:** The created function is equivalent to `_.isMatch` with `source`
			* partially applied.
			*
			* Partial comparisons will match empty array and empty object `source`
			* values against any array or object value, respectively. See `_.isEqual`
			* for a list of supported value comparisons.
			*
			* **Note:** Multiple values can be checked by combining several matchers
			* using `_.overSome`
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Util
			* @param {Object} source The object of property values to match.
			* @returns {Function} Returns the new spec function.
			* @example
			*
			* var objects = [
			*   { 'a': 1, 'b': 2, 'c': 3 },
			*   { 'a': 4, 'b': 5, 'c': 6 }
			* ];
			*
			* _.filter(objects, _.matches({ 'a': 4, 'c': 6 }));
			* // => [{ 'a': 4, 'b': 5, 'c': 6 }]
			*
			* // Checking for several possible values
			* _.filter(objects, _.overSome([_.matches({ 'a': 1 }), _.matches({ 'a': 4 })]));
			* // => [{ 'a': 1, 'b': 2, 'c': 3 }, { 'a': 4, 'b': 5, 'c': 6 }]
			*/
			function matches(source) {
				return baseMatches(baseClone(source, CLONE_DEEP_FLAG));
			}
			/**
			* Creates a function that performs a partial deep comparison between the
			* value at `path` of a given object to `srcValue`, returning `true` if the
			* object value is equivalent, else `false`.
			*
			* **Note:** Partial comparisons will match empty array and empty object
			* `srcValue` values against any array or object value, respectively. See
			* `_.isEqual` for a list of supported value comparisons.
			*
			* **Note:** Multiple values can be checked by combining several matchers
			* using `_.overSome`
			*
			* @static
			* @memberOf _
			* @since 3.2.0
			* @category Util
			* @param {Array|string} path The path of the property to get.
			* @param {*} srcValue The value to match.
			* @returns {Function} Returns the new spec function.
			* @example
			*
			* var objects = [
			*   { 'a': 1, 'b': 2, 'c': 3 },
			*   { 'a': 4, 'b': 5, 'c': 6 }
			* ];
			*
			* _.find(objects, _.matchesProperty('a', 4));
			* // => { 'a': 4, 'b': 5, 'c': 6 }
			*
			* // Checking for several possible values
			* _.filter(objects, _.overSome([_.matchesProperty('a', 1), _.matchesProperty('a', 4)]));
			* // => [{ 'a': 1, 'b': 2, 'c': 3 }, { 'a': 4, 'b': 5, 'c': 6 }]
			*/
			function matchesProperty(path, srcValue) {
				return baseMatchesProperty(path, baseClone(srcValue, CLONE_DEEP_FLAG));
			}
			/**
			* Creates a function that invokes the method at `path` of a given object.
			* Any additional arguments are provided to the invoked method.
			*
			* @static
			* @memberOf _
			* @since 3.7.0
			* @category Util
			* @param {Array|string} path The path of the method to invoke.
			* @param {...*} [args] The arguments to invoke the method with.
			* @returns {Function} Returns the new invoker function.
			* @example
			*
			* var objects = [
			*   { 'a': { 'b': _.constant(2) } },
			*   { 'a': { 'b': _.constant(1) } }
			* ];
			*
			* _.map(objects, _.method('a.b'));
			* // => [2, 1]
			*
			* _.map(objects, _.method(['a', 'b']));
			* // => [2, 1]
			*/
			var method = baseRest(function(path, args) {
				return function(object) {
					return baseInvoke(object, path, args);
				};
			});
			/**
			* The opposite of `_.method`; this method creates a function that invokes
			* the method at a given path of `object`. Any additional arguments are
			* provided to the invoked method.
			*
			* @static
			* @memberOf _
			* @since 3.7.0
			* @category Util
			* @param {Object} object The object to query.
			* @param {...*} [args] The arguments to invoke the method with.
			* @returns {Function} Returns the new invoker function.
			* @example
			*
			* var array = _.times(3, _.constant),
			*     object = { 'a': array, 'b': array, 'c': array };
			*
			* _.map(['a[2]', 'c[0]'], _.methodOf(object));
			* // => [2, 0]
			*
			* _.map([['a', '2'], ['c', '0']], _.methodOf(object));
			* // => [2, 0]
			*/
			var methodOf = baseRest(function(object, args) {
				return function(path) {
					return baseInvoke(object, path, args);
				};
			});
			/**
			* Adds all own enumerable string keyed function properties of a source
			* object to the destination object. If `object` is a function, then methods
			* are added to its prototype as well.
			*
			* **Note:** Use `_.runInContext` to create a pristine `lodash` function to
			* avoid conflicts caused by modifying the original.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Util
			* @param {Function|Object} [object=lodash] The destination object.
			* @param {Object} source The object of functions to add.
			* @param {Object} [options={}] The options object.
			* @param {boolean} [options.chain=true] Specify whether mixins are chainable.
			* @returns {Function|Object} Returns `object`.
			* @example
			*
			* function vowels(string) {
			*   return _.filter(string, function(v) {
			*     return /[aeiou]/i.test(v);
			*   });
			* }
			*
			* _.mixin({ 'vowels': vowels });
			* _.vowels('fred');
			* // => ['e']
			*
			* _('fred').vowels().value();
			* // => ['e']
			*
			* _.mixin({ 'vowels': vowels }, { 'chain': false });
			* _('fred').vowels();
			* // => ['e']
			*/
			function mixin(object, source, options) {
				var props = keys(source), methodNames = baseFunctions(source, props);
				if (options == null && !(isObject(source) && (methodNames.length || !props.length))) {
					options = source;
					source = object;
					object = this;
					methodNames = baseFunctions(source, keys(source));
				}
				var chain = !(isObject(options) && "chain" in options) || !!options.chain, isFunc = isFunction(object);
				arrayEach(methodNames, function(methodName) {
					var func = source[methodName];
					object[methodName] = func;
					if (isFunc) object.prototype[methodName] = function() {
						var chainAll = this.__chain__;
						if (chain || chainAll) {
							var result = object(this.__wrapped__);
							(result.__actions__ = copyArray(this.__actions__)).push({
								"func": func,
								"args": arguments,
								"thisArg": object
							});
							result.__chain__ = chainAll;
							return result;
						}
						return func.apply(object, arrayPush([this.value()], arguments));
					};
				});
				return object;
			}
			/**
			* Reverts the `_` variable to its previous value and returns a reference to
			* the `lodash` function.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Util
			* @returns {Function} Returns the `lodash` function.
			* @example
			*
			* var lodash = _.noConflict();
			*/
			function noConflict() {
				if (root._ === this) root._ = oldDash;
				return this;
			}
			/**
			* This method returns `undefined`.
			*
			* @static
			* @memberOf _
			* @since 2.3.0
			* @category Util
			* @example
			*
			* _.times(2, _.noop);
			* // => [undefined, undefined]
			*/
			function noop() {}
			/**
			* Creates a function that gets the argument at index `n`. If `n` is negative,
			* the nth argument from the end is returned.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Util
			* @param {number} [n=0] The index of the argument to return.
			* @returns {Function} Returns the new pass-thru function.
			* @example
			*
			* var func = _.nthArg(1);
			* func('a', 'b', 'c', 'd');
			* // => 'b'
			*
			* var func = _.nthArg(-2);
			* func('a', 'b', 'c', 'd');
			* // => 'c'
			*/
			function nthArg(n) {
				n = toInteger(n);
				return baseRest(function(args) {
					return baseNth(args, n);
				});
			}
			/**
			* Creates a function that invokes `iteratees` with the arguments it receives
			* and returns their results.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Util
			* @param {...(Function|Function[])} [iteratees=[_.identity]]
			*  The iteratees to invoke.
			* @returns {Function} Returns the new function.
			* @example
			*
			* var func = _.over([Math.max, Math.min]);
			*
			* func(1, 2, 3, 4);
			* // => [4, 1]
			*/
			var over = createOver(arrayMap);
			/**
			* Creates a function that checks if **all** of the `predicates` return
			* truthy when invoked with the arguments it receives.
			*
			* Following shorthands are possible for providing predicates.
			* Pass an `Object` and it will be used as an parameter for `_.matches` to create the predicate.
			* Pass an `Array` of parameters for `_.matchesProperty` and the predicate will be created using them.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Util
			* @param {...(Function|Function[])} [predicates=[_.identity]]
			*  The predicates to check.
			* @returns {Function} Returns the new function.
			* @example
			*
			* var func = _.overEvery([Boolean, isFinite]);
			*
			* func('1');
			* // => true
			*
			* func(null);
			* // => false
			*
			* func(NaN);
			* // => false
			*/
			var overEvery = createOver(arrayEvery);
			/**
			* Creates a function that checks if **any** of the `predicates` return
			* truthy when invoked with the arguments it receives.
			*
			* Following shorthands are possible for providing predicates.
			* Pass an `Object` and it will be used as an parameter for `_.matches` to create the predicate.
			* Pass an `Array` of parameters for `_.matchesProperty` and the predicate will be created using them.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Util
			* @param {...(Function|Function[])} [predicates=[_.identity]]
			*  The predicates to check.
			* @returns {Function} Returns the new function.
			* @example
			*
			* var func = _.overSome([Boolean, isFinite]);
			*
			* func('1');
			* // => true
			*
			* func(null);
			* // => true
			*
			* func(NaN);
			* // => false
			*
			* var matchesFunc = _.overSome([{ 'a': 1 }, { 'a': 2 }])
			* var matchesPropertyFunc = _.overSome([['a', 1], ['a', 2]])
			*/
			var overSome = createOver(arraySome);
			/**
			* Creates a function that returns the value at `path` of a given object.
			*
			* @static
			* @memberOf _
			* @since 2.4.0
			* @category Util
			* @param {Array|string} path The path of the property to get.
			* @returns {Function} Returns the new accessor function.
			* @example
			*
			* var objects = [
			*   { 'a': { 'b': 2 } },
			*   { 'a': { 'b': 1 } }
			* ];
			*
			* _.map(objects, _.property('a.b'));
			* // => [2, 1]
			*
			* _.map(_.sortBy(objects, _.property(['a', 'b'])), 'a.b');
			* // => [1, 2]
			*/
			function property(path) {
				return isKey(path) ? baseProperty(toKey(path)) : basePropertyDeep(path);
			}
			/**
			* The opposite of `_.property`; this method creates a function that returns
			* the value at a given path of `object`.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Util
			* @param {Object} object The object to query.
			* @returns {Function} Returns the new accessor function.
			* @example
			*
			* var array = [0, 1, 2],
			*     object = { 'a': array, 'b': array, 'c': array };
			*
			* _.map(['a[2]', 'c[0]'], _.propertyOf(object));
			* // => [2, 0]
			*
			* _.map([['a', '2'], ['c', '0']], _.propertyOf(object));
			* // => [2, 0]
			*/
			function propertyOf(object) {
				return function(path) {
					return object == null ? undefined : baseGet(object, path);
				};
			}
			/**
			* Creates an array of numbers (positive and/or negative) progressing from
			* `start` up to, but not including, `end`. A step of `-1` is used if a negative
			* `start` is specified without an `end` or `step`. If `end` is not specified,
			* it's set to `start` with `start` then set to `0`.
			*
			* **Note:** JavaScript follows the IEEE-754 standard for resolving
			* floating-point values which can produce unexpected results.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Util
			* @param {number} [start=0] The start of the range.
			* @param {number} end The end of the range.
			* @param {number} [step=1] The value to increment or decrement by.
			* @returns {Array} Returns the range of numbers.
			* @see _.inRange, _.rangeRight
			* @example
			*
			* _.range(4);
			* // => [0, 1, 2, 3]
			*
			* _.range(-4);
			* // => [0, -1, -2, -3]
			*
			* _.range(1, 5);
			* // => [1, 2, 3, 4]
			*
			* _.range(0, 20, 5);
			* // => [0, 5, 10, 15]
			*
			* _.range(0, -4, -1);
			* // => [0, -1, -2, -3]
			*
			* _.range(1, 4, 0);
			* // => [1, 1, 1]
			*
			* _.range(0);
			* // => []
			*/
			var range = createRange();
			/**
			* This method is like `_.range` except that it populates values in
			* descending order.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Util
			* @param {number} [start=0] The start of the range.
			* @param {number} end The end of the range.
			* @param {number} [step=1] The value to increment or decrement by.
			* @returns {Array} Returns the range of numbers.
			* @see _.inRange, _.range
			* @example
			*
			* _.rangeRight(4);
			* // => [3, 2, 1, 0]
			*
			* _.rangeRight(-4);
			* // => [-3, -2, -1, 0]
			*
			* _.rangeRight(1, 5);
			* // => [4, 3, 2, 1]
			*
			* _.rangeRight(0, 20, 5);
			* // => [15, 10, 5, 0]
			*
			* _.rangeRight(0, -4, -1);
			* // => [-3, -2, -1, 0]
			*
			* _.rangeRight(1, 4, 0);
			* // => [1, 1, 1]
			*
			* _.rangeRight(0);
			* // => []
			*/
			var rangeRight = createRange(true);
			/**
			* This method returns a new empty array.
			*
			* @static
			* @memberOf _
			* @since 4.13.0
			* @category Util
			* @returns {Array} Returns the new empty array.
			* @example
			*
			* var arrays = _.times(2, _.stubArray);
			*
			* console.log(arrays);
			* // => [[], []]
			*
			* console.log(arrays[0] === arrays[1]);
			* // => false
			*/
			function stubArray() {
				return [];
			}
			/**
			* This method returns `false`.
			*
			* @static
			* @memberOf _
			* @since 4.13.0
			* @category Util
			* @returns {boolean} Returns `false`.
			* @example
			*
			* _.times(2, _.stubFalse);
			* // => [false, false]
			*/
			function stubFalse() {
				return false;
			}
			/**
			* This method returns a new empty object.
			*
			* @static
			* @memberOf _
			* @since 4.13.0
			* @category Util
			* @returns {Object} Returns the new empty object.
			* @example
			*
			* var objects = _.times(2, _.stubObject);
			*
			* console.log(objects);
			* // => [{}, {}]
			*
			* console.log(objects[0] === objects[1]);
			* // => false
			*/
			function stubObject() {
				return {};
			}
			/**
			* This method returns an empty string.
			*
			* @static
			* @memberOf _
			* @since 4.13.0
			* @category Util
			* @returns {string} Returns the empty string.
			* @example
			*
			* _.times(2, _.stubString);
			* // => ['', '']
			*/
			function stubString() {
				return "";
			}
			/**
			* This method returns `true`.
			*
			* @static
			* @memberOf _
			* @since 4.13.0
			* @category Util
			* @returns {boolean} Returns `true`.
			* @example
			*
			* _.times(2, _.stubTrue);
			* // => [true, true]
			*/
			function stubTrue() {
				return true;
			}
			/**
			* Invokes the iteratee `n` times, returning an array of the results of
			* each invocation. The iteratee is invoked with one argument; (index).
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Util
			* @param {number} n The number of times to invoke `iteratee`.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @returns {Array} Returns the array of results.
			* @example
			*
			* _.times(3, String);
			* // => ['0', '1', '2']
			*
			*  _.times(4, _.constant(0));
			* // => [0, 0, 0, 0]
			*/
			function times(n, iteratee) {
				n = toInteger(n);
				if (n < 1 || n > MAX_SAFE_INTEGER) return [];
				var index = MAX_ARRAY_LENGTH, length = nativeMin(n, MAX_ARRAY_LENGTH);
				iteratee = getIteratee(iteratee);
				n -= MAX_ARRAY_LENGTH;
				var result = baseTimes(length, iteratee);
				while (++index < n) iteratee(index);
				return result;
			}
			/**
			* Converts `value` to a property path array.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Util
			* @param {*} value The value to convert.
			* @returns {Array} Returns the new property path array.
			* @example
			*
			* _.toPath('a.b.c');
			* // => ['a', 'b', 'c']
			*
			* _.toPath('a[0].b.c');
			* // => ['a', '0', 'b', 'c']
			*/
			function toPath(value) {
				if (isArray(value)) return arrayMap(value, toKey);
				return isSymbol(value) ? [value] : copyArray(stringToPath(toString(value)));
			}
			/**
			* Generates a unique ID. If `prefix` is given, the ID is appended to it.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Util
			* @param {string} [prefix=''] The value to prefix the ID with.
			* @returns {string} Returns the unique ID.
			* @example
			*
			* _.uniqueId('contact_');
			* // => 'contact_104'
			*
			* _.uniqueId();
			* // => '105'
			*/
			function uniqueId(prefix) {
				var id = ++idCounter;
				return toString(prefix) + id;
			}
			/**
			* Adds two numbers.
			*
			* @static
			* @memberOf _
			* @since 3.4.0
			* @category Math
			* @param {number} augend The first number in an addition.
			* @param {number} addend The second number in an addition.
			* @returns {number} Returns the total.
			* @example
			*
			* _.add(6, 4);
			* // => 10
			*/
			var add = createMathOperation(function(augend, addend) {
				return augend + addend;
			}, 0);
			/**
			* Computes `number` rounded up to `precision`.
			*
			* @static
			* @memberOf _
			* @since 3.10.0
			* @category Math
			* @param {number} number The number to round up.
			* @param {number} [precision=0] The precision to round up to.
			* @returns {number} Returns the rounded up number.
			* @example
			*
			* _.ceil(4.006);
			* // => 5
			*
			* _.ceil(6.004, 2);
			* // => 6.01
			*
			* _.ceil(6040, -2);
			* // => 6100
			*/
			var ceil = createRound("ceil");
			/**
			* Divide two numbers.
			*
			* @static
			* @memberOf _
			* @since 4.7.0
			* @category Math
			* @param {number} dividend The first number in a division.
			* @param {number} divisor The second number in a division.
			* @returns {number} Returns the quotient.
			* @example
			*
			* _.divide(6, 4);
			* // => 1.5
			*/
			var divide = createMathOperation(function(dividend, divisor) {
				return dividend / divisor;
			}, 1);
			/**
			* Computes `number` rounded down to `precision`.
			*
			* @static
			* @memberOf _
			* @since 3.10.0
			* @category Math
			* @param {number} number The number to round down.
			* @param {number} [precision=0] The precision to round down to.
			* @returns {number} Returns the rounded down number.
			* @example
			*
			* _.floor(4.006);
			* // => 4
			*
			* _.floor(0.046, 2);
			* // => 0.04
			*
			* _.floor(4060, -2);
			* // => 4000
			*/
			var floor = createRound("floor");
			/**
			* Computes the maximum value of `array`. If `array` is empty or falsey,
			* `undefined` is returned.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Math
			* @param {Array} array The array to iterate over.
			* @returns {*} Returns the maximum value.
			* @example
			*
			* _.max([4, 2, 8, 6]);
			* // => 8
			*
			* _.max([]);
			* // => undefined
			*/
			function max(array) {
				return array && array.length ? baseExtremum(array, identity, baseGt) : undefined;
			}
			/**
			* This method is like `_.max` except that it accepts `iteratee` which is
			* invoked for each element in `array` to generate the criterion by which
			* the value is ranked. The iteratee is invoked with one argument: (value).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Math
			* @param {Array} array The array to iterate over.
			* @param {Function} [iteratee=_.identity] The iteratee invoked per element.
			* @returns {*} Returns the maximum value.
			* @example
			*
			* var objects = [{ 'n': 1 }, { 'n': 2 }];
			*
			* _.maxBy(objects, function(o) { return o.n; });
			* // => { 'n': 2 }
			*
			* // The `_.property` iteratee shorthand.
			* _.maxBy(objects, 'n');
			* // => { 'n': 2 }
			*/
			function maxBy(array, iteratee) {
				return array && array.length ? baseExtremum(array, getIteratee(iteratee, 2), baseGt) : undefined;
			}
			/**
			* Computes the mean of the values in `array`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Math
			* @param {Array} array The array to iterate over.
			* @returns {number} Returns the mean.
			* @example
			*
			* _.mean([4, 2, 8, 6]);
			* // => 5
			*/
			function mean(array) {
				return baseMean(array, identity);
			}
			/**
			* This method is like `_.mean` except that it accepts `iteratee` which is
			* invoked for each element in `array` to generate the value to be averaged.
			* The iteratee is invoked with one argument: (value).
			*
			* @static
			* @memberOf _
			* @since 4.7.0
			* @category Math
			* @param {Array} array The array to iterate over.
			* @param {Function} [iteratee=_.identity] The iteratee invoked per element.
			* @returns {number} Returns the mean.
			* @example
			*
			* var objects = [{ 'n': 4 }, { 'n': 2 }, { 'n': 8 }, { 'n': 6 }];
			*
			* _.meanBy(objects, function(o) { return o.n; });
			* // => 5
			*
			* // The `_.property` iteratee shorthand.
			* _.meanBy(objects, 'n');
			* // => 5
			*/
			function meanBy(array, iteratee) {
				return baseMean(array, getIteratee(iteratee, 2));
			}
			/**
			* Computes the minimum value of `array`. If `array` is empty or falsey,
			* `undefined` is returned.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Math
			* @param {Array} array The array to iterate over.
			* @returns {*} Returns the minimum value.
			* @example
			*
			* _.min([4, 2, 8, 6]);
			* // => 2
			*
			* _.min([]);
			* // => undefined
			*/
			function min(array) {
				return array && array.length ? baseExtremum(array, identity, baseLt) : undefined;
			}
			/**
			* This method is like `_.min` except that it accepts `iteratee` which is
			* invoked for each element in `array` to generate the criterion by which
			* the value is ranked. The iteratee is invoked with one argument: (value).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Math
			* @param {Array} array The array to iterate over.
			* @param {Function} [iteratee=_.identity] The iteratee invoked per element.
			* @returns {*} Returns the minimum value.
			* @example
			*
			* var objects = [{ 'n': 1 }, { 'n': 2 }];
			*
			* _.minBy(objects, function(o) { return o.n; });
			* // => { 'n': 1 }
			*
			* // The `_.property` iteratee shorthand.
			* _.minBy(objects, 'n');
			* // => { 'n': 1 }
			*/
			function minBy(array, iteratee) {
				return array && array.length ? baseExtremum(array, getIteratee(iteratee, 2), baseLt) : undefined;
			}
			/**
			* Multiply two numbers.
			*
			* @static
			* @memberOf _
			* @since 4.7.0
			* @category Math
			* @param {number} multiplier The first number in a multiplication.
			* @param {number} multiplicand The second number in a multiplication.
			* @returns {number} Returns the product.
			* @example
			*
			* _.multiply(6, 4);
			* // => 24
			*/
			var multiply = createMathOperation(function(multiplier, multiplicand) {
				return multiplier * multiplicand;
			}, 1);
			/**
			* Computes `number` rounded to `precision`.
			*
			* @static
			* @memberOf _
			* @since 3.10.0
			* @category Math
			* @param {number} number The number to round.
			* @param {number} [precision=0] The precision to round to.
			* @returns {number} Returns the rounded number.
			* @example
			*
			* _.round(4.006);
			* // => 4
			*
			* _.round(4.006, 2);
			* // => 4.01
			*
			* _.round(4060, -2);
			* // => 4100
			*/
			var round = createRound("round");
			/**
			* Subtract two numbers.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Math
			* @param {number} minuend The first number in a subtraction.
			* @param {number} subtrahend The second number in a subtraction.
			* @returns {number} Returns the difference.
			* @example
			*
			* _.subtract(6, 4);
			* // => 2
			*/
			var subtract = createMathOperation(function(minuend, subtrahend) {
				return minuend - subtrahend;
			}, 0);
			/**
			* Computes the sum of the values in `array`.
			*
			* @static
			* @memberOf _
			* @since 3.4.0
			* @category Math
			* @param {Array} array The array to iterate over.
			* @returns {number} Returns the sum.
			* @example
			*
			* _.sum([4, 2, 8, 6]);
			* // => 20
			*/
			function sum(array) {
				return array && array.length ? baseSum(array, identity) : 0;
			}
			/**
			* This method is like `_.sum` except that it accepts `iteratee` which is
			* invoked for each element in `array` to generate the value to be summed.
			* The iteratee is invoked with one argument: (value).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Math
			* @param {Array} array The array to iterate over.
			* @param {Function} [iteratee=_.identity] The iteratee invoked per element.
			* @returns {number} Returns the sum.
			* @example
			*
			* var objects = [{ 'n': 4 }, { 'n': 2 }, { 'n': 8 }, { 'n': 6 }];
			*
			* _.sumBy(objects, function(o) { return o.n; });
			* // => 20
			*
			* // The `_.property` iteratee shorthand.
			* _.sumBy(objects, 'n');
			* // => 20
			*/
			function sumBy(array, iteratee) {
				return array && array.length ? baseSum(array, getIteratee(iteratee, 2)) : 0;
			}
			lodash.after = after;
			lodash.ary = ary;
			lodash.assign = assign;
			lodash.assignIn = assignIn;
			lodash.assignInWith = assignInWith;
			lodash.assignWith = assignWith;
			lodash.at = at;
			lodash.before = before;
			lodash.bind = bind;
			lodash.bindAll = bindAll;
			lodash.bindKey = bindKey;
			lodash.castArray = castArray;
			lodash.chain = chain;
			lodash.chunk = chunk;
			lodash.compact = compact;
			lodash.concat = concat;
			lodash.cond = cond;
			lodash.conforms = conforms;
			lodash.constant = constant;
			lodash.countBy = countBy;
			lodash.create = create;
			lodash.curry = curry;
			lodash.curryRight = curryRight;
			lodash.debounce = debounce;
			lodash.defaults = defaults;
			lodash.defaultsDeep = defaultsDeep;
			lodash.defer = defer;
			lodash.delay = delay;
			lodash.difference = difference;
			lodash.differenceBy = differenceBy;
			lodash.differenceWith = differenceWith;
			lodash.drop = drop;
			lodash.dropRight = dropRight;
			lodash.dropRightWhile = dropRightWhile;
			lodash.dropWhile = dropWhile;
			lodash.fill = fill;
			lodash.filter = filter;
			lodash.flatMap = flatMap;
			lodash.flatMapDeep = flatMapDeep;
			lodash.flatMapDepth = flatMapDepth;
			lodash.flatten = flatten;
			lodash.flattenDeep = flattenDeep;
			lodash.flattenDepth = flattenDepth;
			lodash.flip = flip;
			lodash.flow = flow;
			lodash.flowRight = flowRight;
			lodash.fromPairs = fromPairs;
			lodash.functions = functions;
			lodash.functionsIn = functionsIn;
			lodash.groupBy = groupBy;
			lodash.initial = initial;
			lodash.intersection = intersection;
			lodash.intersectionBy = intersectionBy;
			lodash.intersectionWith = intersectionWith;
			lodash.invert = invert;
			lodash.invertBy = invertBy;
			lodash.invokeMap = invokeMap;
			lodash.iteratee = iteratee;
			lodash.keyBy = keyBy;
			lodash.keys = keys;
			lodash.keysIn = keysIn;
			lodash.map = map;
			lodash.mapKeys = mapKeys;
			lodash.mapValues = mapValues;
			lodash.matches = matches;
			lodash.matchesProperty = matchesProperty;
			lodash.memoize = memoize;
			lodash.merge = merge;
			lodash.mergeWith = mergeWith;
			lodash.method = method;
			lodash.methodOf = methodOf;
			lodash.mixin = mixin;
			lodash.negate = negate;
			lodash.nthArg = nthArg;
			lodash.omit = omit;
			lodash.omitBy = omitBy;
			lodash.once = once;
			lodash.orderBy = orderBy;
			lodash.over = over;
			lodash.overArgs = overArgs;
			lodash.overEvery = overEvery;
			lodash.overSome = overSome;
			lodash.partial = partial;
			lodash.partialRight = partialRight;
			lodash.partition = partition;
			lodash.pick = pick;
			lodash.pickBy = pickBy;
			lodash.property = property;
			lodash.propertyOf = propertyOf;
			lodash.pull = pull;
			lodash.pullAll = pullAll;
			lodash.pullAllBy = pullAllBy;
			lodash.pullAllWith = pullAllWith;
			lodash.pullAt = pullAt;
			lodash.range = range;
			lodash.rangeRight = rangeRight;
			lodash.rearg = rearg;
			lodash.reject = reject;
			lodash.remove = remove;
			lodash.rest = rest;
			lodash.reverse = reverse;
			lodash.sampleSize = sampleSize;
			lodash.set = set;
			lodash.setWith = setWith;
			lodash.shuffle = shuffle;
			lodash.slice = slice;
			lodash.sortBy = sortBy;
			lodash.sortedUniq = sortedUniq;
			lodash.sortedUniqBy = sortedUniqBy;
			lodash.split = split;
			lodash.spread = spread;
			lodash.tail = tail;
			lodash.take = take;
			lodash.takeRight = takeRight;
			lodash.takeRightWhile = takeRightWhile;
			lodash.takeWhile = takeWhile;
			lodash.tap = tap;
			lodash.throttle = throttle;
			lodash.thru = thru;
			lodash.toArray = toArray;
			lodash.toPairs = toPairs;
			lodash.toPairsIn = toPairsIn;
			lodash.toPath = toPath;
			lodash.toPlainObject = toPlainObject;
			lodash.transform = transform;
			lodash.unary = unary;
			lodash.union = union;
			lodash.unionBy = unionBy;
			lodash.unionWith = unionWith;
			lodash.uniq = uniq;
			lodash.uniqBy = uniqBy;
			lodash.uniqWith = uniqWith;
			lodash.unset = unset;
			lodash.unzip = unzip;
			lodash.unzipWith = unzipWith;
			lodash.update = update;
			lodash.updateWith = updateWith;
			lodash.values = values;
			lodash.valuesIn = valuesIn;
			lodash.without = without;
			lodash.words = words;
			lodash.wrap = wrap;
			lodash.xor = xor;
			lodash.xorBy = xorBy;
			lodash.xorWith = xorWith;
			lodash.zip = zip;
			lodash.zipObject = zipObject;
			lodash.zipObjectDeep = zipObjectDeep;
			lodash.zipWith = zipWith;
			lodash.entries = toPairs;
			lodash.entriesIn = toPairsIn;
			lodash.extend = assignIn;
			lodash.extendWith = assignInWith;
			mixin(lodash, lodash);
			lodash.add = add;
			lodash.attempt = attempt;
			lodash.camelCase = camelCase;
			lodash.capitalize = capitalize;
			lodash.ceil = ceil;
			lodash.clamp = clamp;
			lodash.clone = clone;
			lodash.cloneDeep = cloneDeep;
			lodash.cloneDeepWith = cloneDeepWith;
			lodash.cloneWith = cloneWith;
			lodash.conformsTo = conformsTo;
			lodash.deburr = deburr;
			lodash.defaultTo = defaultTo;
			lodash.divide = divide;
			lodash.endsWith = endsWith;
			lodash.eq = eq;
			lodash.escape = escape;
			lodash.escapeRegExp = escapeRegExp;
			lodash.every = every;
			lodash.find = find;
			lodash.findIndex = findIndex;
			lodash.findKey = findKey;
			lodash.findLast = findLast;
			lodash.findLastIndex = findLastIndex;
			lodash.findLastKey = findLastKey;
			lodash.floor = floor;
			lodash.forEach = forEach;
			lodash.forEachRight = forEachRight;
			lodash.forIn = forIn;
			lodash.forInRight = forInRight;
			lodash.forOwn = forOwn;
			lodash.forOwnRight = forOwnRight;
			lodash.get = get;
			lodash.gt = gt;
			lodash.gte = gte;
			lodash.has = has;
			lodash.hasIn = hasIn;
			lodash.head = head;
			lodash.identity = identity;
			lodash.includes = includes;
			lodash.indexOf = indexOf;
			lodash.inRange = inRange;
			lodash.invoke = invoke;
			lodash.isArguments = isArguments;
			lodash.isArray = isArray;
			lodash.isArrayBuffer = isArrayBuffer;
			lodash.isArrayLike = isArrayLike;
			lodash.isArrayLikeObject = isArrayLikeObject;
			lodash.isBoolean = isBoolean;
			lodash.isBuffer = isBuffer;
			lodash.isDate = isDate;
			lodash.isElement = isElement;
			lodash.isEmpty = isEmpty;
			lodash.isEqual = isEqual;
			lodash.isEqualWith = isEqualWith;
			lodash.isError = isError;
			lodash.isFinite = isFinite;
			lodash.isFunction = isFunction;
			lodash.isInteger = isInteger;
			lodash.isLength = isLength;
			lodash.isMap = isMap;
			lodash.isMatch = isMatch;
			lodash.isMatchWith = isMatchWith;
			lodash.isNaN = isNaN;
			lodash.isNative = isNative;
			lodash.isNil = isNil;
			lodash.isNull = isNull;
			lodash.isNumber = isNumber;
			lodash.isObject = isObject;
			lodash.isObjectLike = isObjectLike;
			lodash.isPlainObject = isPlainObject;
			lodash.isRegExp = isRegExp;
			lodash.isSafeInteger = isSafeInteger;
			lodash.isSet = isSet;
			lodash.isString = isString;
			lodash.isSymbol = isSymbol;
			lodash.isTypedArray = isTypedArray;
			lodash.isUndefined = isUndefined;
			lodash.isWeakMap = isWeakMap;
			lodash.isWeakSet = isWeakSet;
			lodash.join = join;
			lodash.kebabCase = kebabCase;
			lodash.last = last;
			lodash.lastIndexOf = lastIndexOf;
			lodash.lowerCase = lowerCase;
			lodash.lowerFirst = lowerFirst;
			lodash.lt = lt;
			lodash.lte = lte;
			lodash.max = max;
			lodash.maxBy = maxBy;
			lodash.mean = mean;
			lodash.meanBy = meanBy;
			lodash.min = min;
			lodash.minBy = minBy;
			lodash.stubArray = stubArray;
			lodash.stubFalse = stubFalse;
			lodash.stubObject = stubObject;
			lodash.stubString = stubString;
			lodash.stubTrue = stubTrue;
			lodash.multiply = multiply;
			lodash.nth = nth;
			lodash.noConflict = noConflict;
			lodash.noop = noop;
			lodash.now = now;
			lodash.pad = pad;
			lodash.padEnd = padEnd;
			lodash.padStart = padStart;
			lodash.parseInt = parseInt;
			lodash.random = random;
			lodash.reduce = reduce;
			lodash.reduceRight = reduceRight;
			lodash.repeat = repeat;
			lodash.replace = replace;
			lodash.result = result;
			lodash.round = round;
			lodash.runInContext = runInContext;
			lodash.sample = sample;
			lodash.size = size;
			lodash.snakeCase = snakeCase;
			lodash.some = some;
			lodash.sortedIndex = sortedIndex;
			lodash.sortedIndexBy = sortedIndexBy;
			lodash.sortedIndexOf = sortedIndexOf;
			lodash.sortedLastIndex = sortedLastIndex;
			lodash.sortedLastIndexBy = sortedLastIndexBy;
			lodash.sortedLastIndexOf = sortedLastIndexOf;
			lodash.startCase = startCase;
			lodash.startsWith = startsWith;
			lodash.subtract = subtract;
			lodash.sum = sum;
			lodash.sumBy = sumBy;
			lodash.template = template;
			lodash.times = times;
			lodash.toFinite = toFinite;
			lodash.toInteger = toInteger;
			lodash.toLength = toLength;
			lodash.toLower = toLower;
			lodash.toNumber = toNumber;
			lodash.toSafeInteger = toSafeInteger;
			lodash.toString = toString;
			lodash.toUpper = toUpper;
			lodash.trim = trim;
			lodash.trimEnd = trimEnd;
			lodash.trimStart = trimStart;
			lodash.truncate = truncate;
			lodash.unescape = unescape;
			lodash.uniqueId = uniqueId;
			lodash.upperCase = upperCase;
			lodash.upperFirst = upperFirst;
			lodash.each = forEach;
			lodash.eachRight = forEachRight;
			lodash.first = head;
			mixin(lodash, function() {
				var source = {};
				baseForOwn(lodash, function(func, methodName) {
					if (!hasOwnProperty.call(lodash.prototype, methodName)) source[methodName] = func;
				});
				return source;
			}(), { "chain": false });
			/**
			* The semantic version number.
			*
			* @static
			* @memberOf _
			* @type {string}
			*/
			lodash.VERSION = VERSION;
			arrayEach([
				"bind",
				"bindKey",
				"curry",
				"curryRight",
				"partial",
				"partialRight"
			], function(methodName) {
				lodash[methodName].placeholder = lodash;
			});
			arrayEach(["drop", "take"], function(methodName, index) {
				LazyWrapper.prototype[methodName] = function(n) {
					n = n === undefined ? 1 : nativeMax(toInteger(n), 0);
					var result = this.__filtered__ && !index ? new LazyWrapper(this) : this.clone();
					if (result.__filtered__) result.__takeCount__ = nativeMin(n, result.__takeCount__);
					else result.__views__.push({
						"size": nativeMin(n, MAX_ARRAY_LENGTH),
						"type": methodName + (result.__dir__ < 0 ? "Right" : "")
					});
					return result;
				};
				LazyWrapper.prototype[methodName + "Right"] = function(n) {
					return this.reverse()[methodName](n).reverse();
				};
			});
			arrayEach([
				"filter",
				"map",
				"takeWhile"
			], function(methodName, index) {
				var type = index + 1, isFilter = type == LAZY_FILTER_FLAG || type == LAZY_WHILE_FLAG;
				LazyWrapper.prototype[methodName] = function(iteratee) {
					var result = this.clone();
					result.__iteratees__.push({
						"iteratee": getIteratee(iteratee, 3),
						"type": type
					});
					result.__filtered__ = result.__filtered__ || isFilter;
					return result;
				};
			});
			arrayEach(["head", "last"], function(methodName, index) {
				var takeName = "take" + (index ? "Right" : "");
				LazyWrapper.prototype[methodName] = function() {
					return this[takeName](1).value()[0];
				};
			});
			arrayEach(["initial", "tail"], function(methodName, index) {
				var dropName = "drop" + (index ? "" : "Right");
				LazyWrapper.prototype[methodName] = function() {
					return this.__filtered__ ? new LazyWrapper(this) : this[dropName](1);
				};
			});
			LazyWrapper.prototype.compact = function() {
				return this.filter(identity);
			};
			LazyWrapper.prototype.find = function(predicate) {
				return this.filter(predicate).head();
			};
			LazyWrapper.prototype.findLast = function(predicate) {
				return this.reverse().find(predicate);
			};
			LazyWrapper.prototype.invokeMap = baseRest(function(path, args) {
				if (typeof path == "function") return new LazyWrapper(this);
				return this.map(function(value) {
					return baseInvoke(value, path, args);
				});
			});
			LazyWrapper.prototype.reject = function(predicate) {
				return this.filter(negate(getIteratee(predicate)));
			};
			LazyWrapper.prototype.slice = function(start, end) {
				start = toInteger(start);
				var result = this;
				if (result.__filtered__ && (start > 0 || end < 0)) return new LazyWrapper(result);
				if (start < 0) result = result.takeRight(-start);
				else if (start) result = result.drop(start);
				if (end !== undefined) {
					end = toInteger(end);
					result = end < 0 ? result.dropRight(-end) : result.take(end - start);
				}
				return result;
			};
			LazyWrapper.prototype.takeRightWhile = function(predicate) {
				return this.reverse().takeWhile(predicate).reverse();
			};
			LazyWrapper.prototype.toArray = function() {
				return this.take(MAX_ARRAY_LENGTH);
			};
			baseForOwn(LazyWrapper.prototype, function(func, methodName) {
				var checkIteratee = /^(?:filter|find|map|reject)|While$/.test(methodName), isTaker = /^(?:head|last)$/.test(methodName), lodashFunc = lodash[isTaker ? "take" + (methodName == "last" ? "Right" : "") : methodName], retUnwrapped = isTaker || /^find/.test(methodName);
				if (!lodashFunc) return;
				lodash.prototype[methodName] = function() {
					var value = this.__wrapped__, args = isTaker ? [1] : arguments, isLazy = value instanceof LazyWrapper, iteratee = args[0], useLazy = isLazy || isArray(value);
					var interceptor = function(value) {
						var result = lodashFunc.apply(lodash, arrayPush([value], args));
						return isTaker && chainAll ? result[0] : result;
					};
					if (useLazy && checkIteratee && typeof iteratee == "function" && iteratee.length != 1) isLazy = useLazy = false;
					var chainAll = this.__chain__, isHybrid = !!this.__actions__.length, isUnwrapped = retUnwrapped && !chainAll, onlyLazy = isLazy && !isHybrid;
					if (!retUnwrapped && useLazy) {
						value = onlyLazy ? value : new LazyWrapper(this);
						var result = func.apply(value, args);
						result.__actions__.push({
							"func": thru,
							"args": [interceptor],
							"thisArg": undefined
						});
						return new LodashWrapper(result, chainAll);
					}
					if (isUnwrapped && onlyLazy) return func.apply(this, args);
					result = this.thru(interceptor);
					return isUnwrapped ? isTaker ? result.value()[0] : result.value() : result;
				};
			});
			arrayEach([
				"pop",
				"push",
				"shift",
				"sort",
				"splice",
				"unshift"
			], function(methodName) {
				var func = arrayProto[methodName], chainName = /^(?:push|sort|unshift)$/.test(methodName) ? "tap" : "thru", retUnwrapped = /^(?:pop|shift)$/.test(methodName);
				lodash.prototype[methodName] = function() {
					var args = arguments;
					if (retUnwrapped && !this.__chain__) {
						var value = this.value();
						return func.apply(isArray(value) ? value : [], args);
					}
					return this[chainName](function(value) {
						return func.apply(isArray(value) ? value : [], args);
					});
				};
			});
			baseForOwn(LazyWrapper.prototype, function(func, methodName) {
				var lodashFunc = lodash[methodName];
				if (lodashFunc) {
					var key = lodashFunc.name + "";
					if (!hasOwnProperty.call(realNames, key)) realNames[key] = [];
					realNames[key].push({
						"name": methodName,
						"func": lodashFunc
					});
				}
			});
			realNames[createHybrid(undefined, WRAP_BIND_KEY_FLAG).name] = [{
				"name": "wrapper",
				"func": undefined
			}];
			LazyWrapper.prototype.clone = lazyClone;
			LazyWrapper.prototype.reverse = lazyReverse;
			LazyWrapper.prototype.value = lazyValue;
			lodash.prototype.at = wrapperAt;
			lodash.prototype.chain = wrapperChain;
			lodash.prototype.commit = wrapperCommit;
			lodash.prototype.next = wrapperNext;
			lodash.prototype.plant = wrapperPlant;
			lodash.prototype.reverse = wrapperReverse;
			lodash.prototype.toJSON = lodash.prototype.valueOf = lodash.prototype.value = wrapperValue;
			lodash.prototype.first = lodash.prototype.head;
			if (symIterator) lodash.prototype[symIterator] = wrapperToIterator;
			return lodash;
		})();
		if (typeof define == "function" && typeof define.amd == "object" && define.amd) {
			root._ = _;
			define(function() {
				return _;
			});
		} else if (freeModule) {
			(freeModule.exports = _)._ = _;
			freeExports._ = _;
		} else root._ = _;
	}).call(exports);
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/collector/content.js
function _inherits$8(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function");
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		writable: true,
		configurable: true
	} });
	if (superClass) _set_prototype_of$8(subClass, superClass);
}
function _set_prototype_of$8(o, p) {
	_set_prototype_of$8 = Object.setPrototypeOf || function setPrototypeOf(o, p) {
		o.__proto__ = p;
		return o;
	};
	return _set_prototype_of$8(o, p);
}
var import_main$2, SYS_TAGS_MIN_RENDER_WIDTH, ContentCollector;
var init_content = __esmMin((() => {
	init_event();
	import_main$2 = require_main();
	init_es();
	init_es$1();
	init_field_collector();
	init_lib();
	init_pen();
	init_resources();
	init_style();
	init_config$2();
	init_interface$6();
	init_color();
	init_avatar_time_utils();
	init_bottom_collectors();
	init_group_key_config();
	init_group_value_rich();
	init_placeholder_record();
	init_wb_cell();
	init_wb_config();
	SYS_TAGS_MIN_RENDER_WIDTH = 30;
	ContentCollector = /* @__PURE__ */ function(Disposable) {
		"use strict";
		_inherits$8(ContentCollector, Disposable);
		function ContentCollector(dataUtil, state, size, rows, range) {
			var _this = Disposable.call(this) || this;
			_this.dataUtil = dataUtil;
			_this.state = state;
			_this.size = size;
			_this.rows = rows;
			_this.range = range;
			/** 已收集的 recordId → RecordRenderInfo */ _this.recordInfos = /* @__PURE__ */ new Map();
			/** GroupHead path key → GroupHeadRenderInfo */ _this.groupInfos = /* @__PURE__ */ new Map();
			/**
			* GroupHead 渲染信息**增量缓存**（性能关键 —— 大分组量场景避免全量重算）。
			*
			* 大表场景（如 2000+ 分组）下，每次 patch 都全量 `collectAllHeads` 会：
			* - 每个 head 走 `fieldCollector.collect` / `resolveGroupKeyConf` / `resolveGroupHeadTitle`
			*   / 多次 `measureTextWidth`（Canvas measureText 极慢）；
			* - 结果导致折叠某一个分组 / 修改一条 record 都要花上百毫秒重算所有 head。
			*
			* 策略：以 `pathKey` 为键，缓存 `{ structKey, info, cachedY }`。当 head 的"结构 key"
			* 未变（fold/count/groupValue 引用/level/isBatchMode/isAllSelected/rect 尺寸/x 等），
			* 直接从缓存复用 `GroupHeadRenderInfo`，仅将所有 config 与 rect 的 `y` 平移到新位置，
			* 跳过所有重量计算（富渲染、measureText、path 查表等）。
			*
			* 失效条件：
			* - `size` 引用变化（响应式 resize 后所有几何常量都变）→ 全清；
			* - `groupFields` 引用变化（分组字段本身变更，keyConf/富渲染规则可能变）→ 全清；
			* - 单个 head 的 structKey 变化 → 该 pathKey 条目失效，走完整路径重收；
			* - path 从整个视图消失（`collectAllHeads` 末尾清 groupInfos）→ 同步清 cache。
			*/ _this.groupHeadCache = /* @__PURE__ */ new Map();
			/**
			* `pathKey → groupIndex` 索引，`collectAllHeads` 每次开头一次性构建。
			*
			* 消除 `findGroupIndexByPath` 原本的 O(N²) 问题（每次 head 收集都走
			* `flatten.findIndex(g => g.path.join('::') === path.join('::'))`，
			* 大表 2000 分组 → 400 万次字符串比较）。
			*/ _this.groupIndexByPath = /* @__PURE__ */ new Map();
			/**
			* `groupValue` 对象 → 自增指纹 id，用于把「引用身份」编入结构 key（字符串）。
			*
			* 二级查找：
			* 1. **引用命中（WeakMap）**：同一 groupValue 对象 → O(1) 复用 id；引用释放后条目自动 GC。
			* 2. **内容命中（contentHash → id）**：core 层某些路径每次 collect 都会重造 groupValue
			*    对象但内容不变（例如 groupFlatten 重建），若只按引用比对将导致 struct key 每次
			*    都变化，缓存 100% miss，实测 2000+ head 一次 collect 会全部走完整重算路径。
			*    因此引用 miss 时算一次 `JSON.stringify(groupValue)` 作为内容哈希，若命中则复用
			*    原 id 并把**新引用**也回填 WeakMap（下次同引用可直连 O(1)）。
			*
			* 何时新分配 id：内容 hash 也没见过 → 说明分组值真的变了（改名 / 成员头像换 /
			* 单元格值编辑），此时才推进 seq。struct key 变化 → 缓存自然失效。
			*
			* 内存：WeakMap 随对象 GC 释放；`contentHashToId` 用 Map 常驻，key 是 JSON 字符串
			* （通常 <100B），条目数上限 = 分组值 distinct 数（几百量级），无需清理。
			*/ _this.groupValueFingerprints = /* @__PURE__ */ new WeakMap();
			_this.groupValueFingerprintSeq = 0;
			_this.groupValueContentHashToId = /* @__PURE__ */ new Map();
			/**
			* **单次 `collectAllHeads` 调用内**的 `isGroupAllSelected(path)` 结果缓存。
			*
			* 背景：`state.isGroupAllSelected` 内部要遍历 `groupFlatten` 挑出 path 前缀命中的所有
			* 叶子分组，再把它们的 `recordIds` 打平后每个都 `selected.has(id)` 校验一遍，
			* 单次调用 O(F + R)（F=flatten 长度、R=前缀下 record 总数）。而在一次 collect 内，
			* 同一个 path 的 head 会经历 `tryReuseGroupHead → computeStructKey`（1 次）
			* → 完整路径 `collectHeadRight`（1 次）→ 写缓存前 `computeStructKey`（1 次）
			* 共**三次**调用，且值在一次 collect 内不会变（选中集合快照稳定）。
			*
			* 在 batch 模式下、大分组表（几千 record）里，checkbox 一次点击会触发
			* `collectVisibleWithHeads`，若不缓存，就是 O(N × 3 × (F + R)) 的开销，
			* 是导致 checkbox 卡死的直接根因。
			*
			* 生命周期：`collectAllHeads` 开头 clear、结束不清（内存占用可忽略，下一次 collect
			* 开头会重置）。key 使用 `groupPathKey(path)`。
			*/ _this.groupAllSelectedCache = /* @__PURE__ */ new Map();
			_this.onContentChangeEmitter = _this._register(new Emitter());
			/** 复用同一份 collectConfig，避免每次 patch 都重新建对象 */ _this.collectConfig = getDefaultContentCollectConfig();
			/**
			* 不同列类型的垂直 padding 覆盖配置；未配置的列类型回退到 size.recordCellPaddingY。
			* 用于解决部分字段（如带圆角徽标/标签的 SingleSelect、MultiSelect 等）在默认 padding 下视觉偏移的问题。
			*/ _this.fieldPaddingYMap = {
				[FieldType.SINGLE_SELECT]: 6,
				[FieldType.MULTIPLE_SELECT]: 6,
				[FieldType.USER_C]: 6
			};
			_this.onContentChange = _this.onContentChangeEmitter.event;
			return _this;
		}
		var _proto = ContentCollector.prototype;
		_proto.collect = function collect() {
			this.collectAllHeads();
			this.collectVisibleRecords();
			this.onContentChangeEmitter.fire();
		};
		_proto.patch = function patch() {
			this.collectAllHeads();
			this.collectVisibleRecords();
			this.onContentChangeEmitter.fire();
		};
		/**
		* 滚动 / 单选切换调用：只重收集可见区域 Record。
		*
		* 设计要点：**GroupHead 不参与本方法**。
		* - GroupHead 的渲染数据（fold/title/decoration/right/...）与 scrollTop 无关，
		*   仅在「结构变化（collect/patch）」「批量模式切换」「全选切换」时变；
		* - 因此本方法在滚动高频路径上对 groupInfos 完全只读，配合 sticky 在 head layer
		*   常驻使用 groupInfos[L0.path]，从根本上避免「滚动一帧重收集所有祖先 head」的 CPU 开销，
		*   也修复了多层分组下 sticky L0 head 因 visible 区间外而消失的问题。
		*/ _proto.collectVisible = function collectVisible() {
			this.collectVisibleRecords();
			this.onContentChangeEmitter.fire();
		};
		/**
		* 批量模式切换 / 全选切换调用：GroupHead 的右侧文案（全选/取消全选）会变，
		* 需要在重收集可见 Record 的同时同步刷新所有 GroupHead 缓存。
		*/ _proto.collectVisibleWithHeads = function collectVisibleWithHeads() {
			this.collectAllHeads();
			this.collectVisibleRecords();
			this.onContentChangeEmitter.fire();
		};
		_proto.getRecordRenderInfo = function getRecordRenderInfo(recordId) {
			return this.recordInfos.get(recordId);
		};
		_proto.getGroupRenderInfo = function getGroupRenderInfo(path) {
			return this.groupInfos.get(this.groupPathKey(path));
		};
		/**
		* 全量重收集**所有** GroupHead（含 L0 / 嵌套层）到 `groupInfos` 持久缓存。
		*
		* 调用时机：仅在「结构层面」发生变化时调用——
		* - collect / patch（数据变更、resize、折叠态变化导致 rows.patch）；
		* - collectVisibleWithHeads（批量模式 / 全选态切换，head 右侧文案变化）。
		*
		* 不在滚动路径上调用：head 渲染数据与 scrollTop 无关，无需随滚动重算。
		*
		* GroupHeadRenderInfo 通常只有十几个字段、分组数量级远小于 Record，
		* 全量常驻缓存内存占用可接受；换来的收益是：
		* - 滚动时零 head 计算；
		* - sticky L0 head 不再受可见区间约束，永远可取（修复 sticky L0 消失问题）。
		*/ _proto.collectAllHeads = function collectAllHeads() {
			var currentGroupFields = this.dataUtil.getGroupFields();
			if (this.lastSizeRef !== this.size || !this.sameGroupFields(this.lastGroupFieldsRef, currentGroupFields)) {
				this.groupHeadCache.clear();
				this.lastSizeRef = this.size;
				this.lastGroupFieldsRef = currentGroupFields;
			}
			this.groupIndexByPath.clear();
			var flatten = this.dataUtil.getGroupFlatten();
			for (var i = 0; i < flatten.length; i++) this.groupIndexByPath.set(this.groupPathKey(flatten[i].path), i);
			this.state.beginGroupPathIndex();
			try {
				this.groupAllSelectedCache.clear();
				var nextKeys = /* @__PURE__ */ new Set();
				this.rows.forEachRowInfo((info) => {
					if (info.type !== RowType.GroupHead || info.height === 0) return;
					this.collectGroupHead(info);
					nextKeys.add(this.groupPathKey(info.path));
				});
				for (var key of [...this.groupInfos.keys()]) if (!nextKeys.has(key)) this.groupInfos.delete(key);
				for (var key1 of [...this.groupHeadCache.keys()]) if (!nextKeys.has(key1)) this.groupHeadCache.delete(key1);
			} finally {
				this.state.endGroupPathIndex();
			}
		};
		/**
		* `getGroupFields()` 在无分组时每次返回新 `[]`，直接引用比较会把 head 缓存每帧清空。
		* 用长度 + 逐项 `===` 做值级比对：正常字段实例引用是稳定的，长度也稳定，命中即认为无变化。
		*/ _proto.sameGroupFields = function sameGroupFields(a, b) {
			if (a === b) return true;
			if (!a || a.length !== b.length) return false;
			for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
			return true;
		};
		/**
		* 重收集当前可见区间内的 Record DrawConfig，**不触碰 groupInfos**。
		* 注意：本方法依赖 RowCollector 已经 collect 完成；调用方负责 fire onContentChange。
		*/ _proto.collectVisibleRecords = function collectVisibleRecords() {
			var { start, end } = this.range.getRowRange();
			if (end < start) {
				this.recordInfos.clear();
				return;
			}
			var visibleRecordIds = /* @__PURE__ */ new Set();
			this.rows.forEachRowInfo((info) => {
				if (info.height === 0 || info.index > end) return;
				if (info.type !== RowType.RecordRange) return;
				var rangeStart = info.index;
				if (info.index + info.recordIds.length - 1 < start || rangeStart > end) return;
				var firstOffset = Math.max(0, start - rangeStart);
				var lastOffset = Math.min(info.recordIds.length - 1, end - rangeStart);
				for (var offset = firstOffset; offset <= lastOffset; offset++) {
					var recordId = info.recordIds[offset];
					var recordY = info.y + offset * this.size.recordHeight;
					var prevSelected = offset > 0 && this.state.isRecordSelected(info.recordIds[offset - 1]);
					var nextSelected = offset < info.recordIds.length - 1 && this.state.isRecordSelected(info.recordIds[offset + 1]);
					this.collectRecord(recordId, recordY, prevSelected, nextSelected);
					visibleRecordIds.add(recordId);
				}
			});
			for (var recordId of [...this.recordInfos.keys()]) if (!visibleRecordIds.has(recordId)) this.recordInfos.delete(recordId);
		};
		/**
		* 收集一个 GroupHead 的 DrawConfig。
		*
		* 按 level 分支：
		* - `level === 0`（最外层）：保持原渲染——带圆角灰色背景 + foldIcon + (可选装饰段) + groupValue + count
		*   + 右侧 addIcon 或 selectAll；sticky 候选；
		* - `level >= 1`（嵌套二三层）：无背景；foldIcon + groupValue + count，随后一条横向直线一直延伸到
		*   右侧按钮（addIcon / selectAll）左侧；视觉上与 Record 行齐高，不参与 sticky。
		*
		* 公共部分（fold/addIcon/selectAll 命中矩形与 DrawConfig）由 `collectHeadCommon` 抽出，
		* event-handler / hover feature 直接复用 GroupHeadRenderInfo 的 foldIconRect / addIconRect / selectAllRect
		* 做命中，二三层 head 也天然支持「折叠按钮 + 加号」两个交互点，与需求 4 一致。
		*/ _proto.collectGroupHead = function collectGroupHead(rowInfo) {
			var _a;
			if (this.tryReuseGroupHead(rowInfo)) return;
			if (((_a = rowInfo.level) !== null && _a !== void 0 ? _a : 0) >= 1) this.collectNestedGroupHead(rowInfo);
			else this.collectTopGroupHead(rowInfo);
			var pathKey = this.groupPathKey(rowInfo.path);
			var info = this.groupInfos.get(pathKey);
			if (info) this.groupHeadCache.set(pathKey, {
				structKey: this.computeGroupHeadStructKey(rowInfo),
				info,
				cachedY: rowInfo.y
			});
		};
		/**
		* 尝试从 head 缓存复用。命中条件：pathKey 存在且 structKey 与当前完全一致。
		*
		* 命中时：clone cached `GroupHeadRenderInfo`，把所有 config / rect 的 `y` 平移
		* `deltaY = rowInfo.y - cachedY`，写入 `groupInfos` 后返回 true。
		*
		* 未命中：返回 false，由外层继续走完整收集路径。
		*/ _proto.tryReuseGroupHead = function tryReuseGroupHead(rowInfo) {
			var pathKey = this.groupPathKey(rowInfo.path);
			var cached = this.groupHeadCache.get(pathKey);
			if (!cached) return false;
			if (this.computeGroupHeadStructKey(rowInfo) !== cached.structKey) return false;
			var deltaY = rowInfo.y - cached.cachedY;
			var nextInfo = this.cloneAndTranslateGroupHead(cached.info, deltaY);
			nextInfo.groupIndex = this.findGroupIndexByPath(rowInfo.path);
			this.groupInfos.set(pathKey, nextInfo);
			cached.info = nextInfo;
			cached.cachedY = rowInfo.y;
			return true;
		};
		/**
		* 计算 GroupHead 的"结构 key"。key 相同则认为 head 的**内容**（富渲染 / 文本 / 图标类型
		* / 按钮种类）可完全复用，只有位置（y）可能变化。
		*
		* 纳入 key 的字段（任一变化都必须重算）：
		* - `level`：top / nested 走不同渲染分支；
		* - `fold`：折叠图标（chevron-right vs chevron-down）不同；
		* - `count`：countText 内容不同；
		* - `groupValueFingerprint`：groupValue 对象的引用指纹（见 `getGroupValueFingerprint`），
		*   分组值编辑 / 换引用时指纹变化 → 富渲染需重算；
		* - `path.length`：决定 currentGroupField 的位置；
		* - `x` / `height` / `rowWidth`：所有几何 config 的输入；
		* - `isBatchMode` / `isAllSelected`：右侧按钮种类 / 文案不同。
		*
		* 未纳入 key 的字段（有意为之）：
		* - `y`：位置变化通过 cachedY → deltaY 平移解决，是缓存的核心收益；
		* - `groupIndex`：flatten 序号变化不影响 head 渲染内容，命中缓存后单独同步。
		*/ _proto.computeGroupHeadStructKey = function computeGroupHeadStructKey(rowInfo) {
			var _a;
			var level = (_a = rowInfo.level) !== null && _a !== void 0 ? _a : 0;
			var isBatchMode = this.state.isBatchSelectMode();
			var isAllSelected = isBatchMode ? this.getGroupAllSelectedMemo(rowInfo.path) : false;
			return [
				level,
				rowInfo.fold ? 1 : 0,
				rowInfo.count,
				rowInfo.path.length,
				rowInfo.x,
				rowInfo.height,
				this.size.rowWidth,
				isBatchMode ? 1 : 0,
				isAllSelected ? 1 : 0,
				this.getGroupValueFingerprint(rowInfo.groupValue)
			].join("|");
		};
		/**
		* 获取 `groupValue` 对象的稳定内容指纹（自增 id）。
		*
		* 同一引用 → O(1) 命中 WeakMap。
		* 引用不同但**内容相同** → 命中 contentHash 表，复用旧 id 并把新引用回填 WeakMap
		*   （下次同引用直连快路径）。这是 head 缓存命中的关键：core 每次 collect 可能重建
		*   groupValue 对象，只要内容不变，指纹稳定，struct key 就稳定，head 缓存才能真正生效。
		* 引用与内容都没见过 → 分配新 id，struct key 变化 → 缓存失效（正确性所需）。
		*
		* null / undefined / 非对象 → 固定返回 0。
		*/ _proto.getGroupValueFingerprint = function getGroupValueFingerprint(groupValue) {
			if (groupValue === null || groupValue === void 0 || typeof groupValue !== "object") return 0;
			var asObj = groupValue;
			var byRef = this.groupValueFingerprints.get(asObj);
			if (byRef !== void 0) return byRef;
			var contentHash;
			try {
				contentHash = JSON.stringify(groupValue);
			} catch (_a) {
				this.groupValueFingerprintSeq += 1;
				var fresh = this.groupValueFingerprintSeq;
				this.groupValueFingerprints.set(asObj, fresh);
				return fresh;
			}
			var byContent = this.groupValueContentHashToId.get(contentHash);
			if (byContent !== void 0) {
				this.groupValueFingerprints.set(asObj, byContent);
				return byContent;
			}
			this.groupValueFingerprintSeq += 1;
			var next = this.groupValueFingerprintSeq;
			this.groupValueFingerprints.set(asObj, next);
			this.groupValueContentHashToId.set(contentHash, next);
			return next;
		};
		/**
		* 单次 collect 内的 `state.isGroupAllSelected(path)` 结果缓存读取。
		*
		* 见 `groupAllSelectedCache` 字段注释：一次 collect 内多次调用只算一次，
		* 消除 checkbox 点击场景下 O(N × 3 × F) 的重复遍历。
		*
		* 供 struct key（tryReuse + 写缓存两次）与 `collectHeadRight` 共用。
		*/ _proto.getGroupAllSelectedMemo = function getGroupAllSelectedMemo(path) {
			var key = this.groupPathKey(path);
			var cached = this.groupAllSelectedCache.get(key);
			if (cached !== void 0) return cached;
			var value = this.state.isGroupAllSelected(path);
			this.groupAllSelectedCache.set(key, value);
			return value;
		};
		/**
		* 深 clone 一份 `GroupHeadRenderInfo` 并把所有含 `y` 字段的 rect / config 平移 `deltaY`。
		*
		* 平移目标：
		* - 顶层 rect / background；
		* - foldIcon / foldIconRect；
		* - decorationConfigs 数组每一项；
		* - groupValueText / groupValueConfigs 数组每一项（富渲染产物均 extends Rect）；
		* - countText；
		* - addIcon / addIconRect / selectAllText / selectAllRect（可选字段）。
		*
		* config 都是普通对象（`pen.config.*` 产物），浅拷贝后改 `y` 即可。
		*
		* 特殊情况：LineConfig 的 `points` 数组按 `[x1, y1, x2, y2, ...]` 存**绝对**坐标
		* （见 `collectNestedTreeLines`：`pen.config.line({ x: 0, y: 0, points, ... })`），
		* 因此除了 y 之外还必须平移 points 里所有奇数索引项。数组本身要新建，避免共享引用被
		* renderer 意外修改。
		*/ _proto.cloneAndTranslateGroupHead = function cloneAndTranslateGroupHead(info, deltaY) {
			var shiftDraw = (c) => {
				var next = Object.assign(Object.assign({}, c), { y: c.y + deltaY });
				if (Array.isArray(c.points)) {
					var nextPoints = c.points.slice();
					for (var i = 1; i < nextPoints.length; i += 2) nextPoints[i] += deltaY;
					next.points = nextPoints;
				}
				return next;
			};
			var shiftArr = (arr) => arr.map(shiftDraw);
			return Object.assign(Object.assign({}, info), {
				rect: shiftDraw(info.rect),
				background: shiftDraw(info.background),
				foldIcon: shiftDraw(info.foldIcon),
				foldIconRect: shiftDraw(info.foldIconRect),
				decorationConfigs: shiftArr(info.decorationConfigs),
				groupValueText: shiftDraw(info.groupValueText),
				groupValueConfigs: info.groupValueConfigs ? shiftArr(info.groupValueConfigs) : info.groupValueConfigs,
				countText: info.countText ? shiftDraw(info.countText) : info.countText,
				addIcon: info.addIcon ? shiftDraw(info.addIcon) : info.addIcon,
				addIconRect: info.addIconRect ? shiftDraw(info.addIconRect) : info.addIconRect,
				selectAllText: info.selectAllText ? shiftDraw(info.selectAllText) : info.selectAllText,
				selectAllRect: info.selectAllRect ? shiftDraw(info.selectAllRect) : info.selectAllRect
			});
		};
		_proto.collectTopGroupHead = function collectTopGroupHead(rowInfo) {
			var _a;
			var { size } = this;
			var rect = {
				x: rowInfo.x,
				y: rowInfo.y,
				width: size.rowWidth,
				height: rowInfo.height
			};
			var currentGroupField = this.dataUtil.getGroupFields()[rowInfo.path.length - 1];
			var groupValueText = applyGroupTextMap(currentGroupField, getGroupValueText(rowInfo.groupValue));
			var keyConf = resolveGroupKeyConf(currentGroupField, groupValueText);
			var background = pen.config.rect(Object.assign(Object.assign({}, rect), {
				background: style.color.normalBackground,
				borderRadius: size.headBgRadius
			}));
			var { foldIcon, foldIconRect } = this.collectHeadFoldIcon(rect, rowInfo.fold);
			var decorationConfigs = [];
			var decorationWidth = 0;
			if (keyConf) {
				var decoration = collectGroupKeyDecoration({
					keyConf,
					startX: foldIconRect.x + size.foldIconSize + size.foldIconGap,
					centerY: rect.y + rect.height / 2,
					iconSize: size.headKeyIconSize,
					dotSize: size.headKeyDotSize,
					trailingGap: size.headKeyTitleGap
				});
				decorationConfigs = decoration.configs;
				decorationWidth = decoration.width;
			}
			var { text: emptyOrRawTitle, isEmpty: isEmptyGroup } = resolveGroupHeadTitle(currentGroupField, groupValueText);
			var titleText = (_a = keyConf === null || keyConf === void 0 ? void 0 : keyConf.title) !== null && _a !== void 0 ? _a : emptyOrRawTitle;
			var groupValueX = size.groupValueStartX + decorationWidth;
			var richValue = this.tryCollectRichGroupValue(rowInfo, currentGroupField, keyConf, rect, groupValueX);
			var { groupValueText: groupValueDraw, countText } = this.collectHeadTitle(rect, titleText, groupValueX, String(rowInfo.count), richValue === null || richValue === void 0 ? void 0 : richValue.width, isEmptyGroup);
			var groupIndex = this.findGroupIndexByPath(rowInfo.path);
			var rawGroupText = getGroupValueText(rowInfo.groupValue);
			var headRight = this.collectHeadRight(rect, rowInfo.path, currentGroupField, rawGroupText);
			this.groupInfos.set(this.groupPathKey(rowInfo.path), Object.assign(Object.assign({
				rect,
				background,
				foldIcon,
				foldIconRect,
				decorationConfigs,
				groupValueText: groupValueDraw,
				groupValueConfigs: richValue === null || richValue === void 0 ? void 0 : richValue.configs,
				countText
			}, headRight), {
				groupIndex,
				path: rowInfo.path
			}));
		};
		/**
		* 二三层（level >= 1）GroupHead 渲染：
		* - 无背景 rect；
		* - foldIcon → groupValue + count → 中段一条横向直线 → 右侧 addIcon / selectAll；
		* - 直线颜色取 `style.color.normalBorderColor`，竖直居中、1px；
		* - 不收集 decoration（嵌套层用户无 keyConf 需求）。
		*
		* 复用：fold / right / title helper 与 top 层完全相同；只缺背景与直线。
		*/ _proto.collectNestedGroupHead = function collectNestedGroupHead(rowInfo) {
			var _a, _b, _c, _d;
			var { size } = this;
			var rect = {
				x: rowInfo.x,
				y: rowInfo.y,
				width: size.rowWidth,
				height: rowInfo.height
			};
			var background = pen.config.rect(Object.assign(Object.assign({}, rect), {
				background: "transparent",
				borderRadius: 0
			}));
			var currentGroupField = this.dataUtil.getGroupFields()[rowInfo.path.length - 1];
			var groupValueText = applyGroupTextMap(currentGroupField, getGroupValueText(rowInfo.groupValue));
			var { foldIcon, foldIconRect } = this.collectHeadFoldIcon(rect, rowInfo.fold);
			var groupValueX = size.groupValueStartX;
			var richValue = this.tryCollectRichGroupValue(rowInfo, currentGroupField, void 0, rect, groupValueX);
			var { text: titleText, isEmpty: isEmptyGroup } = resolveGroupHeadTitle(currentGroupField, groupValueText);
			var { groupValueText: groupValueDraw, countText, titleEndX } = this.collectHeadTitle(rect, titleText, groupValueX, String(rowInfo.count), richValue === null || richValue === void 0 ? void 0 : richValue.width, isEmptyGroup);
			var groupIndex = this.findGroupIndexByPath(rowInfo.path);
			var rawGroupText = getGroupValueText(rowInfo.groupValue);
			var headRight = this.collectHeadRight(rect, rowInfo.path, currentGroupField, rawGroupText);
			var lineLeftX = titleEndX + size.nestedHeadLineSideGap;
			var lineRightX = ((_d = (_b = (_a = headRight.addIconRect) === null || _a === void 0 ? void 0 : _a.x) !== null && _b !== void 0 ? _b : (_c = headRight.selectAllRect) === null || _c === void 0 ? void 0 : _c.x) !== null && _d !== void 0 ? _d : rect.x + rect.width - size.headPaddingX) - size.nestedHeadLineSideGap;
			var decorationConfigs = [];
			if (lineRightX > lineLeftX) decorationConfigs = [pen.config.rect({
				x: lineLeftX,
				y: rect.y + rect.height / 2 - .5,
				width: lineRightX - lineLeftX,
				height: 1,
				background: style.color.lightBorderColor
			})];
			this.groupInfos.set(this.groupPathKey(rowInfo.path), Object.assign(Object.assign({
				rect,
				background,
				foldIcon,
				foldIconRect,
				decorationConfigs,
				groupValueText: groupValueDraw,
				groupValueConfigs: richValue === null || richValue === void 0 ? void 0 : richValue.configs,
				countText
			}, headRight), {
				groupIndex,
				path: rowInfo.path
			}));
		};
		/**
		* 尝试为分组值走「富渲染」（tag pill / 头像 / 单选圆点 / 图片等，与 content 单元格视觉一致）。
		*
		* 命中条件（全部满足）：
		* 1) 未命中 WbSharedConfig 特殊配置（keyConf）—— 命中时已由 keyConf.title + decorationConfigs
		*    组合出视觉，走原文本路径即可；
		* 2) `groupValue` 是**单 cell**（IStandardCell），非数组、非空；数组形态（移动端拍平结构）
		*    grid-list 视图当前不支持，直接回落纯文本兜底；
		* 3) `data.length > 0`——空分组值仍走原「未分组」纯文本；
		* 4) fieldCollector 能给出可绘产物（`configs.length > 0`）。
		*
		* 内容矩形几何：
		* - x = titleStartX；
		* - y = rect.y +（rect.height - 内容高度）/2，与 grid 视图 util-group-value 同源
		*   （tagHeight + borderWidth * 2，垂直居中）；
		* - width = 到右侧按钮左沿的剩余空间；富渲染宽度上限 = 该矩形宽度。
		*
		* 未命中任一条件时返回 undefined，调用方回落原纯文本路径（groupValueText）。
		*/ _proto.tryCollectRichGroupValue = function tryCollectRichGroupValue(rowInfo, groupField, keyConf, rect, titleStartX) {
			var _a;
			if (keyConf || !groupField) return;
			var { groupValue } = rowInfo;
			if (!groupValue || Array.isArray(groupValue)) return;
			if (!((_a = groupValue.data) === null || _a === void 0 ? void 0 : _a.length)) return;
			var { size } = this;
			var maxRight = rect.x + rect.width - size.headPaddingX - size.headAddBtnSize;
			var availableWidth = Math.max(0, maxRight - titleStartX);
			if (availableWidth <= 0) return;
			var contentHeight = style.size.tagLarge + style.size.borderWidth * 2;
			var { configs, width } = collectRichGroupValue(groupValue, groupField, {
				x: titleStartX,
				y: rect.y + (rect.height - contentHeight) / 2,
				width: availableWidth,
				height: contentHeight
			}, ViewType.LIST);
			if (!configs.length) return;
			return {
				configs,
				width
			};
		};
		/** 折叠按钮 DrawConfig + 命中矩形（top / nested 共用） */ _proto.collectHeadFoldIcon = function collectHeadFoldIcon(rect, fold) {
			var { size } = this;
			var foldIconAlias = fold ? NormalIconAlias.CHEVRON_RIGHT : NormalIconAlias.CHEVRON_DOWN;
			var foldIconRect = {
				x: rect.x + size.headPaddingX,
				y: rect.y + (rect.height - size.foldIconSize) / 2,
				width: size.foldIconSize,
				height: size.foldIconSize
			};
			return {
				foldIcon: pen.config.icon(foldIconAlias, Object.assign({}, foldIconRect)),
				foldIconRect
			};
		};
		/**
		* 分组标题（groupValue 文本 + count 文本）DrawConfig（top / nested 共用）。
		*
		* @param titleStartX 文本起点 x（top 层 = groupValueStartX + decorationWidth，nested = groupValueStartX）
		* @param richValueWidth 若分组值走了「富渲染」（tag pill / 头像 / 单选圆点等），传入其
		*   实际占用宽度；count 会紧跟富内容右沿，同时 groupValueText 兜底文本占位宽度收敛为 0
		*   避免与富渲染重叠。未走富渲染时传 undefined，退化到旧的「文本占宽 = 文本 measure」路径。
		* @param isEmpty 是否为「空分组」兜底文案（"{列名}: 空"）。为 true 时切成不加粗 +
		*   `lightUltraFontColor` 浅色，与 grid 视图 util-group-value 的 `isEmptyGroupValue` 分支
		*   同源。默认 false（走原加粗 + normalFontColor 分支）。
		* @returns groupValueText / countText DrawConfig + 内容右沿 X（供 nested 层画直线用）
		*/ _proto.collectHeadTitle = function collectHeadTitle(rect, titleText, titleStartX, countTextValue, richValueWidth, isEmpty = false) {
			var { size } = this;
			var maxTitleRight = rect.x + rect.width - size.headPaddingX - size.headAddBtnSize;
			var titleWidthBudget = richValueWidth !== void 0 ? 0 : Math.max(0, maxTitleRight - titleStartX);
			var titleFontSize = isEmpty ? size.headEmptyTitleFontSize : size.headTitleFontSize;
			var groupValueText = pen.config.text({
				text: titleText,
				x: titleStartX,
				y: rect.y,
				width: titleWidthBudget,
				height: rect.height,
				fontSize: titleFontSize,
				fontStyle: isEmpty ? "" : "500",
				color: isEmpty ? style.color.lightUltraFontColor : style.color.normalFontColor,
				verticalAlign: "middle",
				wrap: "none",
				ellipsis: true
			});
			var usedTitleWidth = richValueWidth !== void 0 ? richValueWidth : Math.min(pen.util.measureTextWidth(titleText, titleFontSize), groupValueText.width);
			var countWidth = pen.util.measureTextWidth(countTextValue, size.headCountFontSize);
			var countX = titleStartX + usedTitleWidth + size.headCountGap;
			return {
				groupValueText,
				countText: pen.config.text({
					text: countTextValue,
					x: countX,
					y: rect.y,
					width: countWidth + 4,
					height: rect.height,
					fontSize: size.headCountFontSize,
					color: style.color.lightUltraFontColor,
					verticalAlign: "middle",
					wrap: "none",
					ellipsis: true
				}),
				titleEndX: countX + countWidth
			};
		};
		/**
		* 右侧按钮区域（top / nested 共用）：
		* - 批量模式下产出 `selectAllText` + `selectAllRect` + `isAllSelected`，无 addIcon；
		* - 非批量模式下按 `shouldShowGroupAddButton(groupField, rawGroupText)` 决定是否产出
		*   `addIcon` + `addIconRect`；业务规则：按 `sys_source` 分组时只有 'manual'（人工手动创建）
		*   分组允许新增，其它来源不画 addIcon（返回空对象），nested 层中段直线会自动延伸到
		*   最右侧 padding 处，视觉上无缝退化。
		*
		* 入参 `path` 用于按"路径前缀"查询该分组（含子孙）的全选状态——多层分组下，
		* 外层 GroupHead 的 `path` 不会出现在 `getGroupFlatten` 里（flatten 只含叶子），
		* 因此全选/取消全选必须用 `path` 走前缀聚合而非 flatten 中的 groupIndex。
		*/ _proto.collectHeadRight = function collectHeadRight(rect, path, groupField, rawGroupText) {
			var { size } = this;
			if (this.state.isBatchSelectMode()) {
				var isAllSelected = this.getGroupAllSelectedMemo(path);
				var selectAllStr = isAllSelected ? i18n.t("取消全选") : i18n.t("全选");
				var fontSize = size.headSelectAllFontSize;
				var btnWidth = pen.util.measureTextWidth(selectAllStr, fontSize) + 4;
				var selectAllRect = {
					x: rect.x + rect.width - size.headPaddingX - btnWidth,
					y: rect.y,
					width: btnWidth,
					height: rect.height
				};
				return {
					selectAllText: pen.config.text(Object.assign(Object.assign({ text: selectAllStr }, selectAllRect), {
						fontSize,
						fontStyle: "500",
						color: wbColors.cardActiveBorder,
						verticalAlign: "middle",
						wrap: "none",
						ellipsis: true,
						align: "right"
					})),
					selectAllRect,
					isAllSelected
				};
			}
			if (!shouldShowGroupAddButton(groupField, rawGroupText)) return {};
			var addIconRect = {
				x: rect.x + rect.width - size.headPaddingX - size.headAddBtnSize,
				y: rect.y + (rect.height - size.headAddBtnSize) / 2,
				width: size.headAddBtnSize,
				height: size.headAddBtnSize
			};
			return {
				addIcon: pen.config.icon(NormalIconAlias.ADD, Object.assign({}, addIconRect)),
				addIconRect
			};
		};
		_proto.collectRecord = function collectRecord(recordId, y, prevSelected, nextSelected) {
			var _a;
			if (isPlaceholderRecordId(recordId)) {
				this.collectPlaceholderRecord(recordId, y);
				return;
			}
			var { size } = this;
			var rowRect = {
				x: size.rowStartX,
				y,
				width: size.rowWidth,
				height: size.recordHeight
			};
			var isSelected = this.state.isRecordSelected(recordId);
			var isBatchMode = this.state.isBatchSelectMode();
			var selectedBg;
			var selectedCheckbox;
			if (isSelected) {
				var r = size.recordBgRadius;
				var topMerged = prevSelected;
				var bottomMerged = nextSelected;
				var borderRadius;
				if (topMerged && bottomMerged) borderRadius = 0;
				else if (topMerged) borderRadius = [
					0,
					0,
					r,
					r
				];
				else if (bottomMerged) borderRadius = [
					r,
					r,
					0,
					0
				];
				else borderRadius = r;
				selectedBg = pen.config.rect(Object.assign(Object.assign({}, rowRect), {
					background: style.color.selectionBackground,
					borderRadius,
					level: Level.L0
				}));
			}
			if (isSelected || isBatchMode) {
				var cbX = rowRect.x + size.checkboxPaddingLeft;
				var cbY = rowRect.y + (rowRect.height - size.checkboxSize) / 2;
				var cbAlias = isSelected ? NormalIconAlias.CHECKBOX_CHECK_GREEN : getCheckboxIconAlias(false);
				selectedCheckbox = pen.config.icon(cbAlias, {
					x: cbX,
					y: cbY,
					width: size.checkboxSize,
					height: size.checkboxSize
				});
			}
			var activeBg;
			if (!isSelected && recordId === this.state.getActiveRecordId()) activeBg = pen.config.rect(Object.assign(Object.assign({}, rowRect), {
				background: style.color.selectionBackground,
				borderRadius: size.recordBgRadius,
				level: Level.L0
			}));
			var rightFieldIds = this.dataUtil.getRightFieldIds();
			var rightContentHeight = rowRect.height;
			var rightConfigs = [];
			var rightTotalWidth = 0;
			var rightCells = [];
			for (var fieldId of rightFieldIds) {
				if (!this.state.isFieldVisible(fieldId)) continue;
				var field = this.dataUtil.getFieldByFieldId(fieldId);
				if (!field) continue;
				var cell = this.dataUtil.getStandardCell(fieldId, recordId);
				rightCells.push({
					field,
					cell,
					fieldId
				});
			}
			var cursorRightX = rowRect.x + rowRect.width - size.globalPaddingRight;
			var ownerAvatarRect;
			var ownerAvatarFieldId;
			var ownerAvatarConfigs;
			var ownerAvatarSlots;
			var dateRect;
			var dateTooltipLabel;
			for (var i = rightCells.length - 1; i >= 0; i--) {
				var { field: field1, cell: cell1, fieldId: fieldId1 } = rightCells[i];
				var special = this.tryCollectSpecialRight(fieldId1, recordId, rowRect, cursorRightX);
				if (special) {
					if (special.configs.length === 0) continue;
					if (special.avatarRect) {
						ownerAvatarRect = special.avatarRect;
						ownerAvatarFieldId = fieldId1;
						ownerAvatarConfigs = special.configs;
						ownerAvatarSlots = special.avatarSlots;
					} else {
						for (var j = special.configs.length - 1; j >= 0; j--) rightConfigs.unshift(special.configs[j]);
						if (special.dateRect) {
							dateRect = special.dateRect;
							dateTooltipLabel = special.dateTooltipLabel;
						}
					}
					cursorRightX -= special.width + size.rightFieldGap;
					rightTotalWidth += special.width + size.rightFieldGap;
					continue;
				}
				var paddingY = this.getFieldPaddingY(field1);
				var measureRect = {
					x: 0,
					y: rowRect.y + paddingY,
					width: 1e4,
					height: rightContentHeight - paddingY
				};
				var fieldConfigs = [];
				var cellWidth = 0;
				if (cell1) {
					fieldConfigs = fieldCollector.collect(measureRect, this.collectConfig, cell1, field1);
					cellWidth = fieldCollector.measureWidth(field1, fieldConfigs);
				}
				if (!cell1 || fieldConfigs.length === 0 || cellWidth === 0) {
					cellWidth = size.placeholderDotSize;
					var dotX = cursorRightX - cellWidth;
					var dotY = rowRect.y + (rowRect.height - size.placeholderDotSize) / 2;
					rightConfigs.unshift(this.createPlaceholderDot({
						x: dotX,
						y: dotY
					}));
				} else {
					var startX = cursorRightX - cellWidth;
					var shiftedConfigs = this.shiftConfigsX(fieldConfigs, startX);
					for (var j1 = shiftedConfigs.length - 1; j1 >= 0; j1--) rightConfigs.unshift(shiftedConfigs[j1]);
				}
				cursorRightX -= cellWidth + size.rightFieldGap;
				rightTotalWidth += cellWidth + size.rightFieldGap;
			}
			rightTotalWidth = Math.max(0, rightTotalWidth - size.rightFieldGap);
			var leftFieldIds = this.state.getVisibleLeftFieldIds();
			var primaryFieldId = this.dataUtil.getPrimaryFieldId();
			var bottomStatusFieldId = this.state.getBottomStatusFieldId();
			var subTreeMeta = this.dataUtil.getSubTreeRowMeta(recordId);
			var subTreeIndent = ((_a = subTreeMeta === null || subTreeMeta === void 0 ? void 0 : subTreeMeta.level) !== null && _a !== void 0 ? _a : 0) * size.subIndentWidth;
			var leftStartX = (this.dataUtil.hasGroup() ? size.groupedRecordStartX : size.groupValueStartX) + 2 + subTreeIndent;
			var leftMaxRightX = rowRect.x + rowRect.width - size.globalPaddingRight - rightTotalWidth - size.leftToRightMinGap;
			var leftMaxWidth = Math.max(0, leftMaxRightX - leftStartX);
			var perCellMaxWidth = Math.max(0, Math.floor(size.rootWidth / 2));
			var leftConfigs = [];
			var leftCursorX = leftStartX;
			var consumedWidth = 0;
			var statusKeyConf = this.state.isBottomStatusFieldVisible() ? this.state.getBottomStatusKeyConf(recordId) : void 0;
			var statusIconRect;
			var bodyTagPillRects;
			for (var fieldId2 of leftFieldIds) {
				var field2 = this.dataUtil.getFieldByFieldId(fieldId2);
				if (!field2) continue;
				var remaining = leftMaxWidth - consumedWidth;
				if (remaining <= 0) break;
				var cellBudget = Math.min(remaining, perCellMaxWidth);
				if (cellBudget <= 0) break;
				if (bottomStatusFieldId && fieldId2 === bottomStatusFieldId) {
					var statusText = this.state.getBottomStatusText(recordId);
					if (!statusText) continue;
					var { configs: statusConfigs, width: statusWidth } = collectStatusText({
						text: statusText,
						startX: leftCursorX,
						y: rowRect.y,
						rowHeight: rowRect.height,
						fontSize: size.bottomStatusFontSize,
						maxWidth: cellBudget
					});
					if (statusConfigs.length === 0 || statusWidth === 0) continue;
					slicePush(leftConfigs, statusConfigs);
					consumedWidth += statusWidth + size.leftFieldGap;
					leftCursorX += statusWidth + size.leftFieldGap;
					continue;
				}
				var cell2 = this.dataUtil.getStandardCell(fieldId2, recordId);
				if (!cell2 || cell2.data.length === 0) continue;
				var isPrimary = fieldId2 === primaryFieldId;
				if (isPrimary && statusKeyConf) {
					if (leftMaxWidth - consumedWidth > 0) {
						var iconStartX = leftCursorX;
						var iconCenterY = rowRect.y + rowRect.height / 2;
						var statusIconDecoration = collectGroupKeyDecoration({
							keyConf: statusKeyConf,
							startX: iconStartX,
							centerY: iconCenterY,
							iconSize: size.headKeyIconSize,
							dotSize: size.headKeyDotSize,
							trailingGap: size.primaryToStatusIconGap
						});
						if (statusIconDecoration.width > 0) {
							slicePush(leftConfigs, statusIconDecoration.configs);
							consumedWidth += statusIconDecoration.width;
							leftCursorX += statusIconDecoration.width;
							var drawnWidth = statusIconDecoration.width - size.primaryToStatusIconGap;
							var drawnSize = Boolean(statusKeyConf.icon) ? size.headKeyIconSize : size.headKeyDotSize;
							statusIconRect = {
								x: iconStartX,
								y: iconCenterY - drawnSize / 2,
								width: Math.max(0, drawnWidth),
								height: drawnSize
							};
						}
					}
				}
				var isText = this.isTextLikeField(field2.getType());
				var paddingY1 = this.getFieldPaddingY(field2);
				var adjustedBudget = Math.min(leftMaxWidth - consumedWidth, perCellMaxWidth);
				if (adjustedBudget <= 0) break;
				var fieldRect = {
					x: leftCursorX,
					y: rowRect.y + paddingY1,
					width: isText ? adjustedBudget : 1e4,
					height: rowRect.height - paddingY1
				};
				var originalFontStyle = this.collectConfig.textConfig.fontStyle;
				if (isPrimary) this.collectConfig.textConfig.fontStyle = "500";
				var fieldConfigsRaw = void 0;
				var wbMeasureFieldType = void 0;
				if (domainConfig.getIsWb()) {
					var fieldTitle = field2.getTitle();
					if (isWbSpecialField(fieldTitle, ViewType.LIST)) {
						fieldConfigsRaw = collectWbSpecialCell({
							fieldTitle,
							viewScope: ViewType.LIST,
							rect: fieldRect,
							collectConfig: this.collectConfig,
							standardCell: cell2,
							field: field2
						});
						if (fieldConfigsRaw) wbMeasureFieldType = getWbSpecialMeasureFieldType(fieldTitle, ViewType.LIST);
					}
				}
				if (!fieldConfigsRaw) fieldConfigsRaw = fieldCollector.collect(fieldRect, this.collectConfig, cell2, field2);
				if (isPrimary) this.collectConfig.textConfig.fontStyle = originalFontStyle;
				if (fieldConfigsRaw.length === 0) continue;
				var used = wbMeasureFieldType ? fieldCollector.measureWidth(wbMeasureFieldType, fieldConfigsRaw) : fieldCollector.measureWidth(field2, fieldConfigsRaw);
				if (used > adjustedBudget) used = adjustedBudget;
				slicePush(leftConfigs, fieldConfigsRaw);
				var trailingGap = size.leftFieldGap;
				consumedWidth += used + trailingGap;
				leftCursorX += used + trailingGap;
				if (isPrimary) {
					var tagFieldIds = this.state.getVisibleBodyTagFieldIds(recordId);
					if (tagFieldIds.length > 0) {
						consumedWidth -= trailingGap;
						leftCursorX -= trailingGap;
						consumedWidth += size.primaryToTagRowGap;
						leftCursorX += size.primaryToTagRowGap;
						var tagRemaining = leftMaxWidth - consumedWidth;
						if (tagRemaining > 0) {
							var tagY = rowRect.y + (rowRect.height - BODY_TAG_PILL_GEOMETRY.itemHeight) / 2;
							var { configs: tagConfigs, width: tagWidth, pillRects: tagPillRects } = collectBodyTag({
								fieldIds: tagFieldIds,
								recordId,
								getField: (id) => this.dataUtil.getFieldByFieldId(id),
								getStandardCell: (id, rid) => this.dataUtil.getStandardCell(id, rid),
								startX: leftCursorX,
								y: tagY,
								itemGap: size.leftFieldGap
							});
							if (tagWidth > 0 && tagWidth <= tagRemaining) {
								slicePush(leftConfigs, tagConfigs);
								consumedWidth += tagWidth + size.leftFieldGap;
								leftCursorX += tagWidth + size.leftFieldGap;
								if (tagPillRects.length > 0) bodyTagPillRects = tagPillRects;
							} else {
								consumedWidth -= size.primaryToTagRowGap;
								leftCursorX -= size.primaryToTagRowGap;
								consumedWidth += trailingGap;
								leftCursorX += trailingGap;
							}
						}
					}
					if (this.state.isSysTagsFieldVisible()) {
						var sysTagsItems = resolveTagsCellItems(this.state.getSysTagsCell(recordId));
						if (sysTagsItems.length > 0) {
							var sysTagsRemaining = leftMaxWidth - consumedWidth;
							if (sysTagsRemaining >= SYS_TAGS_MIN_RENDER_WIDTH) {
								var sysTagsY = rowRect.y + (rowRect.height - BODY_TAG_PILL_GEOMETRY.itemHeight) / 2;
								var { configs: sysTagsConfigs, width: sysTagsWidth, pillRects: sysTagsPillRects } = collectTagsPillsInRect({
									x: leftCursorX,
									y: sysTagsY,
									width: sysTagsRemaining,
									height: BODY_TAG_PILL_GEOMETRY.itemHeight
								}, sysTagsItems, this.state.getSysTagsFieldId(), false, SYS_TAGS_FIELD_TITLE);
								if (sysTagsWidth > 0) {
									slicePush(leftConfigs, sysTagsConfigs);
									consumedWidth += sysTagsWidth + size.leftFieldGap;
									leftCursorX += sysTagsWidth + size.leftFieldGap;
									if (sysTagsPillRects.length > 0) bodyTagPillRects = bodyTagPillRects ? [...bodyTagPillRects, ...sysTagsPillRects] : sysTagsPillRects;
								}
							}
						}
					}
				}
			}
			var subTreeConfigs = subTreeMeta ? this.collectSubTreeLines(subTreeMeta, rowRect, leftStartX) : [];
			if (this.dataUtil.hasGroup()) for (var cfg of this.collectGroupLine(rowRect)) subTreeConfigs.push(cfg);
			this.recordInfos.set(recordId, {
				rowRect,
				selectedBg,
				activeBg,
				subTreeConfigs,
				leftConfigs,
				rightConfigs,
				selectedCheckbox,
				recordId,
				statusIconRect,
				statusIconFieldId: statusIconRect ? bottomStatusFieldId : void 0,
				statusIconTooltipLabel: statusIconRect && (statusKeyConf === null || statusKeyConf === void 0 ? void 0 : statusKeyConf.title) ? formatFieldTooltipLabel(SYS_STATUS_FIELD_TITLE, statusKeyConf.title) : void 0,
				ownerAvatarRect,
				ownerAvatarFieldId,
				ownerAvatarConfigs,
				ownerAvatarSlots,
				dateRect,
				dateTooltipLabel,
				bodyTagPillRects
			});
		};
		/**
		* 收集虚拟 placeholder record 的 DrawConfig。
		*
		* 视觉契约（与真实 record 布局对齐）：
		* - 无选中态背景 / 无选中 checkbox / 无父子记录连线 / 无 tag 组；
		* - 左侧：优先级「低」themed icon（灰色）+ 灰色文案「输入待办标题」；
		* - 右侧：默认空头像占位（复用 `collectAvatarGroup(users:[], drawEmptyPlaceholder:true)`），
		*   与真实行 owner 空数据视觉完全一致；
		* - 分组竖线：与真实 record 保持一致，仍然绘制左侧贯穿的分组竖线（虚拟行也是分组内的一条视觉行）。
		*
		* 该行不参与选中 / 批量 / 单元格 hit rect / hover cell 反馈，
		* 但整行响应 hover + click（由 hover feature 独立处理）。
		*/ _proto.collectPlaceholderRecord = function collectPlaceholderRecord(recordId, y) {
			var { size } = this;
			var rowRect = {
				x: size.rowStartX,
				y,
				width: size.rowWidth,
				height: size.recordHeight
			};
			var leftConfigs = [];
			var leftCursorX = (this.dataUtil.hasGroup() ? size.groupedRecordStartX : size.groupValueStartX) + 2;
			var centerY = rowRect.y + rowRect.height / 2;
			var rightSlotWidth = size.avatarSize + size.globalPaddingRight + size.leftToRightMinGap;
			var textMaxRight = rowRect.x + rowRect.width - rightSlotWidth;
			var textMaxWidth = Math.max(0, textMaxRight - leftCursorX);
			if (textMaxWidth > 0) leftConfigs.push(pen.config.text({
				text: i18n.t("输入待办标题"),
				x: leftCursorX,
				y: rowRect.y,
				width: textMaxWidth,
				height: rowRect.height,
				fontSize: size.headTitleFontSize,
				color: style.color.lightUltraFontColor,
				verticalAlign: "middle",
				wrap: "none",
				ellipsis: true
			}));
			var rightConfigs = [];
			var ownerAvatarRect;
			var ownerAvatarConfigs;
			if (this.state.isOwnerFieldVisible()) {
				var cursorRightX = rowRect.x + rowRect.width - size.globalPaddingRight;
				var { configs: avatarConfigs, width: avatarWidth } = collectAvatarGroup({
					users: [],
					startX: cursorRightX - size.avatarSize,
					centerY,
					avatarSize: size.avatarSize,
					textFontSize: size.avatarTextFontSize,
					drawEmptyPlaceholder: true
				});
				if (avatarWidth > 0) {
					ownerAvatarRect = {
						x: cursorRightX - avatarWidth,
						y: centerY - size.avatarSize / 2,
						width: avatarWidth,
						height: size.avatarSize
					};
					ownerAvatarConfigs = avatarConfigs;
				}
			}
			var subTreeConfigs = this.dataUtil.hasGroup() ? this.collectGroupLine(rowRect) : [];
			this.recordInfos.set(recordId, {
				rowRect,
				subTreeConfigs,
				leftConfigs,
				rightConfigs,
				recordId,
				ownerAvatarRect,
				ownerAvatarConfigs
			});
		};
		/**
		* 收集分组竖线 DrawConfig：在 record 左侧绘制一条贯穿整行高度的垂直实线。
		* 多条 record 的竖线段视觉上拼接成一条从 GroupHead 下方到最后一条 record 的连续线。
		*/ _proto.collectGroupLine = function collectGroupLine(rowRect) {
			var { size } = this;
			var lineX = size.groupLineCenterX - size.groupLineWidth / 2;
			return [pen.config.rect({
				x: lineX,
				y: rowRect.y - size.lineTopExtend,
				width: size.groupLineWidth,
				height: rowRect.height,
				background: wbColors.treeIndicatorLine
			})];
		};
		/**
		* 收集父子记录的关联线 DrawConfig 列表。
		*
		* @param meta SubTreeRowMeta —— 由 DataUtil.buildSubTreeMeta() 一次性算好，render 阶段不再计算。
		* @param rowRect Record 行的全局矩形（含 globalPadding）。
		* @param leftStartX 当前行主列文本的起点 X（已经包含 level * subIndentWidth 偏移）。
		*
		* 几何契约（每一级缩进 = `size.subIndentWidth` 像素）：
		* - 第 k 个缩进列（k 从 0 起，距 N 越远 k 越大）占据 X ∈ [colLeftX(k), colLeftX(k) + indent)；
		*   其中 colLeftX(k) = leftStartX - (k + 1) * indent。
		* - 每一列的竖线 X = 该列中点 = colLeftX(k) + indent / 2。
		*
		* 绘制规则（与需求 q1 / q4 严格对应）：
		* - 自身列（k=0）：使用 `pen.config.line` 画折线，在转角处带 `subLineSlope` 大小的 45° 斜段；
		*   · `isLastChild` → (vx, top) → (vx, midY - slope) → (vx + slope, midY) → (rightX, midY)；
		*   · 非末位 → 主竖线 (vx, top) → (vx, bottom) 整段贯穿，另起一条同款斜拐角横向分叉线；
		* - 祖先列（k>=1）：
		*   · `pipeAncestors[k] === true` → 画从 row.top 到 row.bottom 的整段竖线（跨层连线）；
		*   · 否则留空。
		*/ _proto.collectSubTreeLines = function collectSubTreeLines(meta, rowRect, leftStartX) {
			var { size } = this;
			var configs = [];
			var { level } = meta;
			if (level === 0) return configs;
			var indent = size.subIndentWidth;
			var lineColor = wbColors.treeIndicatorLine;
			var lineW = size.subLineWidth;
			var rowTop = rowRect.y - size.lineTopExtend;
			var rowBottom = rowRect.y + rowRect.height;
			var rowMidY = rowRect.y + rowRect.height / 2;
			var vertLineCenterX = (k) => leftStartX - indent * (k + 1) + indent / 2 + size.subLineCenterOffsetX;
			for (var k = 1; k < level; k++) {
				if (!meta.pipeAncestors[k]) continue;
				configs.push(pen.config.rect({
					x: vertLineCenterX(k) - lineW / 2,
					y: rowTop,
					width: lineW,
					height: rowBottom - rowTop,
					background: lineColor
				}));
			}
			var selfVertX = vertLineCenterX(0);
			var horizRightX = leftStartX - size.subLineGapToText;
			var slope = Math.min(size.subLineSlope, rowRect.height / 2);
			var slopeStartY = rowMidY - slope;
			var slopeEndX = selfVertX + slope;
			if (meta.isLastChild) {
				var points = [
					selfVertX,
					rowTop,
					selfVertX,
					slopeStartY,
					slopeEndX,
					rowMidY,
					Math.max(horizRightX, slopeEndX),
					rowMidY
				];
				configs.push(pen.config.line({
					x: 0,
					y: 0,
					points,
					borderWidth: lineW,
					borderColor: lineColor
				}));
			} else {
				configs.push(pen.config.rect({
					x: selfVertX - lineW / 2,
					y: rowTop,
					width: lineW,
					height: rowBottom - rowTop,
					background: lineColor
				}));
				if (horizRightX > slopeEndX) {
					var branch = [
						selfVertX,
						slopeStartY,
						slopeEndX,
						rowMidY,
						horizRightX,
						rowMidY
					];
					configs.push(pen.config.line({
						x: 0,
						y: 0,
						points: branch,
						borderWidth: lineW,
						borderColor: lineColor
					}));
				}
			}
			return configs;
		};
		/** 根据字段类型取垂直 padding；未在 fieldPaddingYMap 中配置则回退到 size.recordCellPaddingY */ _proto.getFieldPaddingY = function getFieldPaddingY(field) {
			var override = this.fieldPaddingYMap[this.getEffectiveFieldType(field)];
			return override !== null && override !== void 0 ? override : this.size.recordCellPaddingY;
		};
		/**
		* 取字段「实际渲染用」的 FieldType：
		* - 对查找引用列（LOOKUP）/ 公式列（FORMULA），最终渲染由 result 字段决定，需要拿其 resultFieldAttributes 的 type；
		* - resultFieldAttributes 不存在（未配置 / 错误态）时回退原始 type。
		*/ _proto.getEffectiveFieldType = function getEffectiveFieldType(field) {
			var _a;
			var type = field.getType();
			if (type === FieldType.LOOKUP || type === FieldType.FORMULA) {
				var resultType = (_a = field.getResultFieldAttributes()) === null || _a === void 0 ? void 0 : _a.getType();
				if (resultType) return resultType;
			}
			return type;
		};
		_proto.isTextLikeField = function isTextLikeField(type) {
			return type === FieldType.TEXT || type === FieldType.PHONE || type === FieldType.EMAIL || type === FieldType.NUMBER || type === FieldType.PERCENT || type === FieldType.CURRENCY || type === FieldType.AUTO_NUMBER;
		};
		/** 把 DrawConfig 列表按 x 偏移整体平移（measure 阶段用 x=0，真实位置后再平移） */ _proto.shiftConfigsX = function shiftConfigsX(configs, deltaX) {
			if (deltaX === 0) return configs;
			return configs.map((c) => {
				var next = Object.assign({}, c);
				if (typeof next.x === "number") next.x = c.x + deltaX;
				return next;
			});
		};
		_proto.createPlaceholderDot = function createPlaceholderDot(rect) {
			var { size } = this;
			return pen.config.rect({
				x: rect.x,
				y: rect.y,
				width: size.placeholderDotSize,
				height: size.placeholderDotSize,
				background: style.color.lightUltraFontColor,
				borderRadius: size.placeholderDotSize / 2,
				opacity: .3
			});
		};
		/**
		* 行右侧字段命中 owner / date 列时，返回 shared collector 产出的 DrawConfig + 占用宽度；
		* 不命中（不是 owner/date，或对应列不可见）时返回 null，调用方退回到普通 fieldCollector 路径。
		*
		* 视觉与几何与 kanban-todo 卡片底部完全等价：
		* - owner 列：重叠头像组（{@link collectAvatarGroup}），垂直居中行内；
		* - date 列：相对时间（{@link formatRelativeTime} + {@link collectRelativeTimeText}），左对齐
		*   ——本视图右侧整体是反向布局，cursorRightX 推进已经把"贴右边"做好了，文本本身用 align='left'
		*   即可，无需再像 kanban-todo 那样做 row 右边强制对齐。
		*
		* 反向布局适配：调用方只需保证 `cursorRightX` 是「该单元格的右边界」；本函数返回 `width` 后，
		* 调用方按 `cursorRightX - width` 取得 startX 自行渲染。
		*
		* 空数据约定：返回 `{ configs: [], width: 0 }` 表示「命中但无数据」，
		* 调用方据此跳过本字段（不渲染、不占位、不推进 cursor）；返回 null 表示「未命中专用渲染」，
		* 调用方应退回到普通 fieldCollector 路径（普通字段空数据走占位灰圆兜底）。
		*/ _proto.tryCollectSpecialRight = function tryCollectSpecialRight(fieldId, recordId, rowRect, cursorRightX) {
			var { size, state } = this;
			if (state.isOwnerFieldVisible() && fieldId === state.getOwnerFieldId()) {
				var users = state.getOwnerUsers(recordId);
				var probe = collectAvatarGroup({
					users,
					startX: 0,
					centerY: 0,
					avatarSize: size.avatarSize,
					textFontSize: size.avatarTextFontSize,
					drawEmptyPlaceholder: true
				});
				if (probe.width === 0) return {
					configs: [],
					width: 0
				};
				var startX = cursorRightX - probe.width;
				var centerY = rowRect.y + rowRect.height / 2;
				var { configs, width, slots } = collectAvatarGroup({
					users,
					startX,
					centerY,
					avatarSize: size.avatarSize,
					textFontSize: size.avatarTextFontSize,
					drawEmptyPlaceholder: true
				});
				var avatarRect = {
					x: startX,
					y: centerY - size.avatarSize / 2,
					width,
					height: size.avatarSize
				};
				applyAvatarSlotsFieldTitlePrefix(slots, WbSharedConfig.card.bottom.ownerFieldTitle);
				return {
					configs,
					width,
					avatarRect,
					avatarSlots: slots
				};
			}
			if (state.isDateFieldVisible() && fieldId === state.getDateFieldId()) {
				var ts = state.getDateTimestamp(recordId);
				if (!ts) return {
					configs: [],
					width: 0
				};
				var text = formatRelativeTime(ts);
				if (!text) return {
					configs: [],
					width: 0
				};
				var slotWidth = size.relativeDateSlotWidth;
				var startX1 = cursorRightX - slotWidth;
				var { configs: configs1 } = collectRelativeTimeText({
					text,
					startX: startX1,
					y: rowRect.y,
					rowHeight: rowRect.height,
					fontSize: size.relativeDateFontSize,
					align: "right",
					slotWidth
				});
				var dateFullText = state.getDateFullText(recordId);
				return {
					configs: configs1,
					width: slotWidth,
					dateRect: {
						x: startX1,
						y: rowRect.y,
						width: slotWidth,
						height: rowRect.height
					},
					dateTooltipLabel: dateFullText ? formatFieldTooltipLabel(WbSharedConfig.card.bottom.dateFieldTitle, dateFullText) : void 0
				};
			}
			return null;
		};
		/**
		* 通过分组 path 找到 groupIndex（在 dataUtil.getGroupFlatten 中的序号）。
		*
		* 优先走 `collectAllHeads` 开头构建的 `groupIndexByPath` 索引 Map（O(1)）；
		* Map 未命中时（例如从 `collectAllHeads` 之外的路径调用）回落到原来的 flatten.findIndex。
		*/ _proto.findGroupIndexByPath = function findGroupIndexByPath(path) {
			var key = this.groupPathKey(path);
			var cached = this.groupIndexByPath.get(key);
			if (cached !== void 0) return cached;
			return this.dataUtil.getGroupFlatten().findIndex((g) => this.groupPathKey(g.path) === key);
		};
		_proto.groupPathKey = function groupPathKey(path) {
			return path.join("::");
		};
		return ContentCollector;
	}(import_main$2.Disposable);
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/config.js
var ListConfig;
var init_config = __esmMin((() => {
	init_wb_config();
	ListConfig = {
		recordLeftShowFieldTitles: [...WbSharedConfig.card.body.showFieldTitles],
		recordRightShowFieldTitles: [WbSharedConfig.card.bottom.ownerFieldTitle, WbSharedConfig.card.bottom.dateFieldTitle]
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/collector/data-util.js
function _inherits$7(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function");
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		writable: true,
		configurable: true
	} });
	if (superClass) _set_prototype_of$7(subClass, superClass);
}
function _set_prototype_of$7(o, p) {
	_set_prototype_of$7 = Object.setPrototypeOf || function setPrototypeOf(o, p) {
		o.__proto__ = p;
		return o;
	};
	return _set_prototype_of$7(o, p);
}
function makePlaceholderGroupKey(matchValue) {
	return `${PLACEHOLDER_GROUP_PREFIX}${matchValue}`;
}
function isPlaceholderGroupKey(groupKey) {
	return typeof groupKey === "string" && groupKey.startsWith(PLACEHOLDER_GROUP_PREFIX);
}
/**
* 从顶层分组节点的 value 中取文本，用于匹配 groupKeys[].matchValue。
* IFormattedTree.value 是单元格；取 `data[0].text`。
*/ function getTopGroupTitleText(value) {
	var _a, _b;
	if (!value) return "";
	var first = (_a = value.data) === null || _a === void 0 ? void 0 : _a[0];
	return (_b = first === null || first === void 0 ? void 0 : first.text) !== null && _b !== void 0 ? _b : "";
}
/**
* 构造一个虚拟顶层分组节点：
* - `field` 复用真实的顶层分组 field（供 head 反查 keyConf）；
* - `value` 塞一个只有 `text = matchValue` 的兜底 cell；
* - `children`：
*   - `withPlaceholderChild=true`（默认，head.groupBys 特殊配置场景）：塞一条 placeholder recordId，
*     让下游 rows / range / content 走「有一行」的路径，用户可点击占位行创建新任务；
*   - `withPlaceholderChild=false`（sys_source 白名单场景）：留空 `[]`，只渲染分组头，不产生
*     任何行级 UI 与事件响应（对应"转交 0"这类固定占位的空分组）；
* - `count = 0`：与 kanban-todo 补齐分组一致（count 用于分组头右侧显示数量）；
* - `path`：优先使用调用方反查到的 **真实 GroupKey**（SELECT 的 optionId / LINK_RECORD 的 recordId），
*   这样 `moveRecord.delta.groupPath` 下发给 core 时能命中真正的字段维度值，正常写入分组字段；
*   反查不到才落回 `makePlaceholderGroupKey(matchValue)`（`__list_group_placeholder__:xxx`），
*   record-move 侧对这种 placeholder key 会拿到 null override，不会污染 cellvalue。
*/ function buildVirtualTopNode(matchValue, topGroupField, realGroupKey, withPlaceholderChild = true) {
	var value = {
		sourceType: topGroupField.getType(),
		data: [{ text: matchValue }]
	};
	var pathKey = realGroupKey !== null && realGroupKey !== void 0 ? realGroupKey : makePlaceholderGroupKey(matchValue);
	return {
		level: 0,
		field: topGroupField,
		value,
		children: withPlaceholderChild ? [makePlaceholderRecordId(matchValue)] : [],
		count: 0,
		path: [pathKey]
	};
}
var PLACEHOLDER_GROUP_PREFIX, DataUtil;
var init_data_util = __esmMin((() => {
	init_es();
	init_es$1();
	init_data_util$1();
	init_sub_tree();
	init_config();
	init_placeholder_record();
	init_wb_config();
	PLACEHOLDER_GROUP_PREFIX = "__list_group_placeholder__:";
	DataUtil = /* @__PURE__ */ function(BaseCollectorDataUtil) {
		"use strict";
		_inherits$7(DataUtil, BaseCollectorDataUtil);
		function DataUtil(context) {
			var _this = BaseCollectorDataUtil.call(this, context) || this;
			_this.context = context;
			/** 左侧字段 fieldId（按 config 顺序，丢弃找不到的 title） */ _this.leftFieldIds = [];
			/** 右侧字段 fieldId（按 config 顺序，丢弃找不到的 title） */ _this.rightFieldIds = [];
			/**
			* 父子记录扁平 meta；视图未启用父子记录时为空 Map（render 阶段命中 undefined → 走普通分支）。
			* 在 buildSubTreeMeta() 中重建。
			*/ _this.subTreeMeta = /* @__PURE__ */ new Map();
			/**
			* 命中 `WbSharedConfig.head.groupBys[fieldTitle]` 时的规范化 groupTree 副本；
			* 未命中或无分组时为 null，`getGroupTree()` 走 super 原始数据。
			*
			* 副本策略：
			* - 不修改 core 层 `getFormattedTree()` 的返回对象（下游可能有别处直接引用 core 树）；
			* - 顶层节点按 `groupKeys` 顺序重排；
			* - 配置中存在但数据缺失的分组，追加 placeholder 节点；
			* - 任意分组的 record 数为 0 时，塞一条 placeholder recordId 供 collector 渲染虚拟行；
			* - 配置外的顶层分组保留在末尾（避免误删数据）。
			*/ _this.normalizedGroupTree = null;
			/**
			* 当前 `normalizedGroupTree` 是否包含虚拟分组或 placeholder record。
			* 主要用于 renderer 侧决定「recordCount === 0 时是否绕过空态提示」。
			*/ _this.wbVirtualGroupsFlag = false;
			/**
			* 规范化过程中「真实 GroupKey 但对应分组为空」的顶层 GroupKey 集合。
			*
			* 触发场景（`buildNormalizedTopNodes` 内维护）：
			* 1. 已存在于 core formattedTree 里、但 `children` 为空的顶层分组 → path[0] 就是真实 GroupKey；
			* 2. core formattedTree 里完全没有、但 `lookupRealGroupKeyByMatchValue` 反查到真实 GroupKey 的分组；
			*
			* 两者共同点：目标分组在 **core formattedTree 里没有对应节点**（或只有一条 placeholder record），
			* 直接把 `groupPath` 交给 core 的 `MoveRecordRequest.setRecordByGroupPath` 时，
			* `getStandardValueMapByPath` 会因为找不到节点返回 `{}`，导致**分组字段不会被写入**，
			* 记录只挪 rank 不改字段值，UI 上就表现为「拖入空分组失败、跳回原分组」。
			*
			* `record-move` 检测到目标 GroupKey 命中本集合时，会调用 {@link buildGroupFieldOverrideForTopGroupKey}
			* 自行合成分组字段的 cell delta 塞进 `moveRecord.delta.records`，绕开 `setRecordByGroupPath` 的
			* formattedTree 依赖 —— 语义与 kanban 的 `MOVE_GROUP_RECORD` 一致：直接把 groupKey 作为分组字段值写入。
			*/ _this.emptyRealGroupKeys = /* @__PURE__ */ new Set();
			/** 顶层分组字段（缓存，避免每次调用重新遍历 view.getGroupFields()） */ _this.topGroupFieldCache = null;
			return _this;
		}
		var _proto = DataUtil.prototype;
		_proto.getCurrentView = function getCurrentView() {
			return this.context.getCurrentView();
		};
		/** 顶层分组的扁平结构，与 grid DataUtil 同名同义 */ _proto.getGroupFlatten = function getGroupFlatten() {
			var _a;
			return ((_a = this.getCurrentView()) === null || _a === void 0 ? void 0 : _a.getGroupLayoutInfos()) || [];
		};
		/**
		* 嵌套分组树（多层），与 grid DataUtil 同名同义。
		* - 每个节点形如 `{ field, value, count, path, children, level? }`；
		* - children 为下一层分组列表，叶子层的 children 为 recordId 字符串数组；
		* - 无分组时返回空数组。
		* 用于 runGroupTree 递归布局多层 GroupHead / RecordRange。
		*
		* 类型说明：分组叶子层的 children 在启用「父子记录」时可能混入 ISubNode（与
		* IFormattedTree.children 类型一致），消费方（runGroupTree / walkGroupTreeForSubRoots）
		* 通过 isFormattedTreeNode 谓词区分中间层与叶子。
		*/ _proto.getGroupTree = function getGroupTree() {
			var _a;
			if (this.normalizedGroupTree) return this.normalizedGroupTree;
			return ((_a = this.getCurrentView()) === null || _a === void 0 ? void 0 : _a.getFormattedTree()) || [];
		};
		/**
		* 是否存在由 `WbSharedConfig.head.groupBys` 补齐出的虚拟分组或 placeholder record。
		*
		* 供 renderer 使用：命中时即使 `rows.recordCount === 0` 也不应该绘制「空态提示」，
		* 而是让虚拟分组头与 placeholder record 正常绘制。
		*/ _proto.hasWbVirtualGroups = function hasWbVirtualGroups() {
			return this.wbVirtualGroupsFlag;
		};
		/**
		* 判断给定 GroupKey 是否为「真实但空」的顶层分组 key。
		*
		* 命中场景（详见 `emptyRealGroupKeys` 字段注释）：
		* - core formattedTree 里存在该 GroupKey 但 `children` 为空；
		* - core formattedTree 里完全没有，但通过字段维度反查到了真实 GroupKey（optionId / userId / recordId）。
		*
		* 两种场景下，core 的 `MoveRecordRequest.setRecordByGroupPath` 都无法从 formattedTree 反查到有效的
		* `standardValueMap` → 分组字段不会被写入。`record-move` 侧应在派发 moveRecord 前调用
		* {@link buildGroupFieldOverrideForTopGroupKey} 合成分组字段的 cell delta 塞进 `records`。
		*/ _proto.isEmptyRealGroupKey = function isEmptyRealGroupKey(groupKey) {
			return this.emptyRealGroupKeys.has(groupKey);
		};
		/**
		* 为「拖入空分组」场景合成顶层分组字段的 cell delta。
		*
		* @param topGroupKey 目标顶层分组的**真实** GroupKey（不是 placeholder）。语义按字段类型解释：
		*   - `SINGLE_SELECT / MULTIPLE_SELECT` → option.id
		*   - `USER / USER_C` → user.id
		*   - `LINK_RECORDS / TWO_WAY_LINK_RECORDS` → 关联表 recordId
		* @returns `{ fieldId, cellValue }` —— cellValue 是可直接写入 `ISetRecordRequestDelta[fieldId].value`
		*   的合法结构；无法合成（字段类型不支持 / 顶层分组字段不存在）时返回 null。
		*
		* 语义参考 core `generateRecordDeltaByGroupRecordPatch`（kanban 独占）：把 groupKey 直接翻译为
		* 「该字段允许的最小合法 cellValue」，等价于把该 record 的分组字段值改成"落到目标分组所需要的值"。
		*
		* 单值 vs 多值字段的取舍：目前 grid-list 场景（sys_status 单选、sys_owner 单人）只落单值。
		* MULTI 场景理论上应该走"合并 removes/adds"（参考 kanban 的 patch 逻辑），但当前 `WbSharedConfig.head.groupBys`
		* 只覆盖单值分组的用例，因此这里对多值字段也按"覆盖为单值"处理；后续如接入多选分组，
		* 需要在此扩展成合并 patch。
		*/ _proto.buildGroupFieldOverrideForTopGroupKey = function buildGroupFieldOverrideForTopGroupKey(topGroupKey) {
			var _a, _b;
			if (isPlaceholderGroupKey(topGroupKey)) return null;
			var field = (_b = (_a = this.topGroupFieldCache) !== null && _a !== void 0 ? _a : this.getGroupFields()[0]) !== null && _b !== void 0 ? _b : null;
			if (!field) return null;
			var fieldId = field.getId();
			var fieldType = field.getType();
			var cellValue = this.buildCellValueForTopGroupKey(field, fieldType, topGroupKey);
			if (cellValue === void 0) return null;
			return {
				fieldId,
				cellValue
			};
		};
		/**
		* 按 `WbSharedConfig.head.groupBys[fieldTitle]` 规范化 GroupTree：
		* - 命中特殊配置时构造 `normalizedGroupTree` 副本，重排顺序 + 补齐缺失分组 + 空分组塞 placeholder record；
		* - 分组依据为 `sys_source` 时按 `WB_SOURCE_DEFAULT_VISIBLE_VALUES` 白名单固定补齐 manual / handoff 两个
		*   分组置顶展示，白名单外的空分组（关联表 / 全集枚举带来的 count=0 的分组）**直接过滤掉**，
		*   避免 UI 上出现一堆无数据的空块；
		* - 未命中时清空缓存，`getGroupTree()` 回落到 super 数据。
		*
		* 应在 `handleCollect / handlePatch` 顶部（`buildSubTreeMeta` 之前）调用，
		* 后续所有下游（rows / range / content / renderer / event-handler）读到的均为规范化后的数据。
		*/ _proto.normalizeGroupTreeByWbConfig = function normalizeGroupTreeByWbConfig() {
			var _a;
			this.normalizedGroupTree = null;
			this.wbVirtualGroupsFlag = false;
			this.emptyRealGroupKeys = /* @__PURE__ */ new Set();
			this.topGroupFieldCache = null;
			var groupFields = this.getGroupFields();
			if (groupFields.length === 0) return;
			var topGroupField = groupFields[0];
			this.topGroupFieldCache = topGroupField;
			var fieldTitle = topGroupField.getTitle();
			var groupByConfig = WbSharedConfig.head.groupBys[fieldTitle];
			var hitConfig = !!groupByConfig && groupByConfig.groupKeys.length > 0;
			var hitSource = fieldTitle === WB_SOURCE_FIELD_TITLE;
			if (!hitConfig && !hitSource) return;
			var originalTree = ((_a = this.getCurrentView()) === null || _a === void 0 ? void 0 : _a.getFormattedTree()) || [];
			var topNodes = [];
			for (var node of originalTree) {
				if (typeof node === "string" || !isFormattedTreeNode(node)) return;
				topNodes.push(node);
			}
			var matchValues = hitConfig ? groupByConfig.groupKeys.map((keyConf) => keyConf.matchValue) : WB_SOURCE_DEFAULT_VISIBLE_VALUES;
			var filterEmptyOutsiders = hitSource;
			var { normalized, hasVirtual, emptyRealGroupKeys } = this.buildNormalizedTopNodes(topNodes, matchValues, topGroupField, filterEmptyOutsiders);
			this.normalizedGroupTree = normalized;
			this.wbVirtualGroupsFlag = hasVirtual;
			this.emptyRealGroupKeys = emptyRealGroupKeys;
		};
		/**
		* 获取父子（树形）记录嵌套结构；视图未启用「父子记录」时返回 null。
		*
		* 纯透传 core 层 `getFormattedSub`，不在 view 层做视图类型卡口——
		* 哪些视图支持父子能力由 core 层「ViewModel 是否挂 ViewSubTreePartial」决定，
		* 且 core 层在 `subTreeFieldId` 未配置 / 字段失效 / 关联非本表 时已会返回 null。
		*/ _proto.getFormattedSub = function getFormattedSub() {
			var _a, _b;
			return (_b = (_a = this.getCurrentView()) === null || _a === void 0 ? void 0 : _a.getFormattedSub()) !== null && _b !== void 0 ? _b : null;
		};
		/**
		* 获取「无分组」场景下用于逐行渲染的 recordId 顺序。
		*
		* - 未启用父子记录（`getFormattedSub()` 返回 null）：直接透传 `getDisplayedRecordIds()`
		*   的扁平顺序，与原行为完全一致；
		* - 启用父子记录：`getDisplayedRecordIds()` 只是「祖先链注入后的集合」，其相对顺序**不保证**
		*   父在前、子紧随（sort/group processor 只保证集合完整，不保证 DFS 拓扑序）。若直接按它逐行
		*   渲染，会出现「某条子记录的 level 正确、但排在了错误的行位置」——表现为嵌套关联线断裂、
		*   父子不连续。这里改用 `getFormattedSub()` 的完整 ISubNode 树、按 DFS（父在前、子紧随、
		*   兄弟按已排序顺序）打平，得到与「分组叶子层」`normalizeLeafChildrenToRecordIds` 完全一致
		*   的连续顺序，保证有/无分组两条路径的父子渲染顺序统一。
		*
		* 复用 core `normalizeLeafChildrenToRecordIds`（分组叶子层同款打平工具），避免重复实现 DFS。
		*/ _proto.getSubTreeOrderedRecordIds = function getSubTreeOrderedRecordIds() {
			var sub = this.getFormattedSub();
			if (!sub) return [...this.getDisplayedRecordIds()];
			return normalizeLeafChildrenToRecordIds(sub);
		};
		/** 分组字段列表 */ _proto.getGroupFields = function getGroupFields() {
			var _a;
			return ((_a = this.getCurrentView()) === null || _a === void 0 ? void 0 : _a.getGroupFields()) || [];
		};
		/** 是否存在分组 */ _proto.hasGroup = function hasGroup() {
			return this.getGroupFields().length > 0;
		};
		/**
		* runGroupFlatten 需要这个 hook；list 视图永远不展示列统计，固定返回 false。
		*/ _proto.isFieldStatEnabled = function isFieldStatEnabled() {
			return false;
		};
		/**
		* 按 ListConfig.recordLeftShowFieldTitles / recordRightShowFieldTitles 反查 fieldId，缓存到 leftFieldIds / rightFieldIds。
		* 在 collect / patch 阶段调用，render 阶段直接读缓存即可。
		*/ _proto.buildShowFieldIds = function buildShowFieldIds() {
			this.leftFieldIds = this.resolveFieldIdsByTitles(ListConfig.recordLeftShowFieldTitles, "left");
			this.rightFieldIds = this.resolveFieldIdsByTitles(ListConfig.recordRightShowFieldTitles, "right");
		};
		_proto.getLeftFieldIds = function getLeftFieldIds() {
			return this.leftFieldIds;
		};
		_proto.getRightFieldIds = function getRightFieldIds() {
			return this.rightFieldIds;
		};
		/**
		* 构建 / 重建父子记录扁平 meta 映射。
		*
		* 来源（二选一，互斥；无分组优先）：
		* - 无分组：`getFormattedSub()` 直接拿到顶层 ISubNode 数组；
		* - 有分组：遍历 `getGroupTree()` 找到所有"叶子层"（children 全是 RecordId 字符串或 ISubNode），
		*   把其中所有 ISubNode 元素并入 roots 数组；纯 RecordId 字符串元素跳过（非父子树成员，
		*   不需要 meta，渲染时走普通分支）。
		*
		* 在 collect/patch 流程的 dataUtil 预处理阶段调用一次，配合 buildShowFieldIds。
		*/ _proto.buildSubTreeMeta = function buildSubTreeMeta() {
			var roots = this.collectSubTreeRoots();
			if (roots.length === 0) {
				if (this.subTreeMeta.size > 0) this.subTreeMeta = /* @__PURE__ */ new Map();
				return;
			}
			this.subTreeMeta = flattenSubTree(roots);
		};
		/**
		* 查询某条 record 的父子树 meta；未启用父子记录、或该 record 不在树里时返回 undefined。
		* render 阶段单次 Map 命中，零字符串匹配。
		*/ _proto.getSubTreeRowMeta = function getSubTreeRowMeta(recordId) {
			return this.subTreeMeta.get(recordId);
		};
		/**
		* 依据「被折叠父记录 id 集合」过滤 recordIds：任一祖先 ∈ foldedIds 的 record 被剔除，
		* 父记录自身即使被折叠也保留（需要展示折叠按钮）。
		*
		* 与 grid 的 `DataUtil.filterFoldedSubTreeRecordIds` 同源，共用 `views/shared/sub-tree`
		* 的纯函数实现。runGroupTree 在叶子层会调用此方法，参数错位曾导致 `trees.forEach is not
		* a function`（详见修复注释）。
		*/ _proto.filterFoldedSubTreeRecordIds = function filterFoldedSubTreeRecordIds1(recordIds, foldedIds) {
			return filterFoldedSubTreeRecordIds(recordIds, foldedIds, this.subTreeMeta);
		};
		/**
		* 按字段类型分支构造顶层分组字段的 cellValue；不支持时返回 undefined。
		*
		* - SELECT：cellValue 就是 `[optionId]`；
		* - USER：需要从 field.getGroups 反查出 IUser（含 name 等 meta），构造 `IUser[]`；
		* - LINK_RECORDS：cellValue = `[linkRecordId]`；
		* - 其他类型：不支持（当前 grid-list 分组仅覆盖上述三类）。
		*/ _proto.buildCellValueForTopGroupKey = function buildCellValueForTopGroupKey(field, fieldType, topGroupKey) {
			var _a, _b, _c;
			if (fieldType === FieldType.SINGLE_SELECT || fieldType === FieldType.MULTIPLE_SELECT) return [topGroupKey];
			if (isLinkField(field)) return [topGroupKey];
			if (fieldType === FieldType.USER || fieldType === FieldType.USER_C) {
				var supportGroups = field;
				if (typeof supportGroups.getGroups !== "function" || typeof supportGroups.getGroupValues !== "function") return;
				var cell = supportGroups.getGroupValues([topGroupKey]).get(topGroupKey);
				var userData = (_a = cell === null || cell === void 0 ? void 0 : cell.data) === null || _a === void 0 ? void 0 : _a[0];
				if (!(userData === null || userData === void 0 ? void 0 : userData.id)) return void 0;
				return [{
					id: userData.id,
					name: (_c = (_b = userData.name) !== null && _b !== void 0 ? _b : userData.text) !== null && _c !== void 0 ? _c : ""
				}];
			}
		};
		/**
		* 按 matchValue 在分组列对应数据源中反查真实 GroupKey；找不到返回 undefined。
		*
		* 用途：`buildNormalizedTopNodes` 遇到「配置里列了但 core 层 formattedTree 完全没有该分组」时，
		* 优先用字段维度的真实 GroupKey（SELECT 的 optionId / 关联表的 recordId）填补，保证下游
		* `moveRecord.delta.groupPath` 拿到的就是 core 认识的 GroupKey，能正常写入分组字段值。
		*
		* 反查策略（按分组列类型分支，因为不同类型的 GroupKey 语义不同）：
		* - LINK_RECORD：GroupKey === 关联表 recordId。从关联表的 primary 字段按 cell.text === matchValue
		*   反查 recordId（关联表全部 record 是候选，无论当前表是否 link 到它）。
		* - 其他可分组字段（SELECT / USER / ...）：GroupKey === 字段维度 id（option.id / user.id）。
		*   通过 `field.getGroups([]).groupIds` 拿字段维度的**全集** id 列表：
		*     1) 优先按 id 直接匹配 matchValue（业务侧约定：sys_status_id 这类列 option.id 就是
		*        `'pending' / 'running'` 英文枚举，groupBys 里 matchValue 写英文枚举 → 直接命中）；
		*     2) 兜底走 `field.getGroupValues([...])` 里 cell.data[0].text 匹配（SELECT option.text
		*        与 matchValue 对齐；kanban-todo 现有实现走的也是这条路径）。
		*   命中即返回 GroupKey === id。
		*/ _proto.lookupRealGroupKeyByMatchValue = function lookupRealGroupKeyByMatchValue(matchValue, topGroupField) {
			var _a, _b, _c, _d, _e, _f;
			if (isLinkField(topGroupField)) {
				var linkTable = topGroupField.getLinkTableModel();
				if (!linkTable) return;
				var primaryFieldId = linkTable.getPrimaryFieldId();
				var primaryField = linkTable.getFieldByFieldId(primaryFieldId);
				if (!primaryField) return;
				for (var recordId of linkTable.getRecordIdList()) if (((_d = (_c = (_b = (_a = primaryField.getStandardCell(recordId)) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.text) !== null && _d !== void 0 ? _d : "") === matchValue) return recordId;
				return;
			}
			var supportGroups = topGroupField;
			if (typeof supportGroups.getGroups !== "function") return;
			var groupIds;
			try {
				groupIds = supportGroups.getGroups([]).groupIds;
			} catch (_g) {
				return;
			}
			for (var id of groupIds) if (id === matchValue) return id;
			if (typeof supportGroups.getGroupValues !== "function") return;
			var groupValues = supportGroups.getGroupValues(groupIds);
			for (var id1 of groupIds) {
				if (id1 === null) continue;
				var cell = groupValues.get(id1);
				var first = (_e = cell === null || cell === void 0 ? void 0 : cell.data) === null || _e === void 0 ? void 0 : _e[0];
				if (((_f = first === null || first === void 0 ? void 0 : first.text) !== null && _f !== void 0 ? _f : "") === matchValue) return id1;
			}
		};
		/**
		* 按 matchValues 顺序生成新的顶层节点列表，缺失分组补空节点，
		* 任意分组 record 为 0 时塞一条 placeholder recordId。
		*
		* 同时记录**真实但空**的顶层 GroupKey 到 `emptyRealGroupKeys` 供 record-move 侧读取，
		* 用来在派发 moveRecord 前合成分组字段的 cell override（绕开 core 对 formattedTree 的依赖）。
		*
		* @param matchValues 期望**固定按此顺序展示**的 rawText 列表。既可来自
		*   `WbGroupByConfig.groupKeys[].matchValue`（命中 head.groupBys 特殊配置），
		*   也可来自 `WB_SOURCE_DEFAULT_VISIBLE_VALUES`（sys_source 白名单）。
		* @param filterEmptyOutsiders 白名单外的分组处理策略：
		*   - `false`（默认）：全部保留在末尾，避免数据丢失 —— 用于 head.groupBys 场景，
		*     配置里没列出的分组只要在数据里存在（即便为空）也照常展示；
		*   - `true`：仅保留 children 非空的分组（有数据），过滤掉全部空分组 —— 用于 sys_source，
		*     避免关联表 / SELECT 全集枚举把一堆无数据的其它来源塞进 UI。
		*/ _proto.buildNormalizedTopNodes = function buildNormalizedTopNodes(topNodes, matchValues, topGroupField, filterEmptyOutsiders) {
			var _a;
			var matchValueToNode = /* @__PURE__ */ new Map();
			for (var node of topNodes) {
				var text = getTopGroupTitleText(node.value);
				if (text && !matchValueToNode.has(text)) matchValueToNode.set(text, node);
			}
			var ordered = [];
			var used = /* @__PURE__ */ new Set();
			var emptyRealGroupKeys = /* @__PURE__ */ new Set();
			var hasVirtual = false;
			var emptyGroupHasPlaceholder = !filterEmptyOutsiders;
			for (var matchValue of matchValues) {
				var existed = matchValueToNode.get(matchValue);
				if (existed) {
					used.add(existed);
					if (existed.children.length === 0) {
						ordered.push(Object.assign(Object.assign({}, existed), { children: emptyGroupHasPlaceholder ? [makePlaceholderRecordId(matchValue)] : [] }));
						var realKey = (_a = existed.path) === null || _a === void 0 ? void 0 : _a[0];
						if (realKey !== void 0 && !isPlaceholderGroupKey(realKey)) emptyRealGroupKeys.add(realKey);
						hasVirtual = true;
					} else ordered.push(existed);
					continue;
				}
				var realGroupKey = this.lookupRealGroupKeyByMatchValue(matchValue, topGroupField);
				ordered.push(buildVirtualTopNode(matchValue, topGroupField, realGroupKey, emptyGroupHasPlaceholder));
				if (realGroupKey !== void 0) emptyRealGroupKeys.add(realGroupKey);
				hasVirtual = true;
			}
			for (var node1 of topNodes) {
				if (used.has(node1)) continue;
				if (filterEmptyOutsiders && node1.children.length === 0) continue;
				ordered.push(node1);
			}
			return {
				normalized: ordered,
				hasVirtual,
				emptyRealGroupKeys
			};
		};
		/**
		* 收集所有需要参与父子平铺的 ISubNode 根。
		*
		* - 视图未启用父子记录：getFormattedSub() 返回 null，整体返回 []，调用方据此清空缓存；
		* - 启用 + 无分组：getFormattedSub() 即顶层 ISubNode 数组；
		* - 启用 + 有分组：遍历 getGroupTree() 找到所有叶子层中的 ISubNode 元素（按出现顺序追加），
		*   把每个 ISubNode 当作独立根传入 flattenSubTree。同一记录在多分组叶子层不会重复出现（由 core
		*   的 buildSubTreeForRecordIds 保证 scoped 隔离）。
		*/ _proto.collectSubTreeRoots = function collectSubTreeRoots() {
			var sub = this.getFormattedSub();
			if (!sub) return [];
			if (!this.hasGroup()) return sub;
			var groupTree = this.getGroupTree();
			if (groupTree.length === 0) return [];
			var roots = [];
			this.walkGroupTreeForSubRoots(groupTree, roots);
			return roots;
		};
		/**
		* DFS 遍历 GroupTree，找出叶子层（children 元素均非 IFormattedTree）中的 ISubNode 节点。
		* 字符串 RecordId 元素跳过 —— 它们是"非父子树成员的普通 record"，渲染层走普通分支即可。
		*/ _proto.walkGroupTreeForSubRoots = function walkGroupTreeForSubRoots(trees, out) {
			for (var node of trees) {
				if (typeof node === "string") continue;
				if (!isFormattedTreeNode(node)) {
					out.push(node);
					continue;
				}
				var { children } = node;
				if (children.every((c) => typeof c === "string" || !isFormattedTreeNode(c))) {
					for (var child of children) {
						if (typeof child === "string") continue;
						if (!isFormattedTreeNode(child)) out.push(child);
					}
					continue;
				}
				this.walkGroupTreeForSubRoots(children, out);
			}
		};
		/**
		* 按 title 列表顺序解析出 fieldId，找不到的 title 会被 warn 一次并丢弃。
		* 同一个 title 出现重复时取第一个匹配字段，避免 widthAdjuster 之类的下游因重复 fieldId 而出错。
		*/ _proto.resolveFieldIdsByTitles = function resolveFieldIdsByTitles(titles, side) {
			if (titles.length === 0) return [];
			var titleSet = new Set(titles);
			var titleToFieldId = /* @__PURE__ */ new Map();
			for (var fieldId of this.getAllFieldIds()) {
				var field = this.getFieldByFieldId(fieldId);
				if (!field) continue;
				var title = field.getTitle();
				if (titleSet.has(title) && !titleToFieldId.has(title)) titleToFieldId.set(title, fieldId);
			}
			var result = [];
			for (var title1 of titles) {
				var fieldId1 = titleToFieldId.get(title1);
				if (fieldId1) result.push(fieldId1);
				else logger.warn("grid-list", `[${side}] field not found by title: ${title1}`);
			}
			return result;
		};
		return DataUtil;
	}(BaseCollectorDataUtil);
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/collector/range.js
function _defineProperties$1(target, props) {
	for (var i = 0; i < props.length; i++) {
		var descriptor = props[i];
		descriptor.enumerable = descriptor.enumerable || false;
		descriptor.configurable = true;
		if ("value" in descriptor) descriptor.writable = true;
		Object.defineProperty(target, descriptor.key, descriptor);
	}
}
function _create_class$1(Constructor, protoProps, staticProps) {
	if (protoProps) _defineProperties$1(Constructor.prototype, protoProps);
	if (staticProps) _defineProperties$1(Constructor, staticProps);
	return Constructor;
}
function _inherits$6(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function");
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		writable: true,
		configurable: true
	} });
	if (superClass) _set_prototype_of$6(subClass, superClass);
}
function _set_prototype_of$6(o, p) {
	_set_prototype_of$6 = Object.setPrototypeOf || function setPrototypeOf(o, p) {
		o.__proto__ = p;
		return o;
	};
	return _set_prototype_of$6(o, p);
}
var import_main$1, RangeCollector;
var init_range = __esmMin((() => {
	init_event();
	import_main$1 = require_main();
	init_interface$6();
	RangeCollector = /* @__PURE__ */ function(Disposable) {
		"use strict";
		_inherits$6(RangeCollector, Disposable);
		function RangeCollector(size, rows) {
			var _this = Disposable.call(this) || this;
			_this.size = size;
			_this.rows = rows;
			_this.scrollTop = 0;
			_this.rowRange = {
				start: 0,
				end: -1
			};
			_this.onScrollEmitter = _this._register(new Emitter());
			_this.onScroll = _this.onScrollEmitter.event;
			return _this;
		}
		var _proto = RangeCollector.prototype;
		_proto.collect = function collect() {
			this.scrollTop = this.clampScrollTop(this.scrollTop);
			this.updateRowRange();
		};
		_proto.patch = function patch(_mutations) {
			this.collect();
		};
		_proto.getRowRange = function getRowRange() {
			return this.rowRange;
		};
		_proto.scrollByDelta = function scrollByDelta(deltaY) {
			if (deltaY === 0) return;
			this.scrollToY(this.scrollTop + deltaY);
		};
		_proto.scrollToY = function scrollToY(scrollTop) {
			var next = this.clampScrollTop(scrollTop);
			if (next === this.scrollTop) return;
			this.scrollTop = next;
			this.updateRowRange();
			this.onScrollEmitter.fire();
		};
		_proto.clampScrollTop = function clampScrollTop(value) {
			return Math.max(0, Math.min(value, this.maxScrollTop));
		};
		/**
		* 按 scrollTop + bodyHeight 找出当前可见的 row index 区间。
		* RecordRange 内部用线性 offset，外层 GroupHead/Spacing 行整体计入。
		*/ _proto.updateRowRange = function updateRowRange() {
			var viewTop = this.scrollTop;
			var viewBottom = this.scrollTop + this.size.rootHeight;
			var start = -1;
			var end = -1;
			var { rowCount } = this.rows;
			if (rowCount === 0) {
				this.rowRange = {
					start: 0,
					end: -1
				};
				return;
			}
			this.rows.forEachRowInfo((info) => {
				if (info.height === 0) return;
				if (info.type === RowType.RecordRange) {
					var range = info;
					var { recordHeight } = this.size;
					var recordCount = range.recordIds.length;
					var rangeTop = range.y;
					if (range.y + range.height < viewTop || rangeTop > viewBottom) return;
					var firstRelative = Math.max(0, viewTop - rangeTop);
					var lastRelative = Math.max(0, viewBottom - rangeTop);
					var firstOffset = Math.max(0, Math.floor(firstRelative / recordHeight) - 1);
					var lastOffset = Math.min(recordCount - 1, Math.floor(lastRelative / recordHeight));
					var firstIndex = range.index + firstOffset;
					var lastIndex = range.index + lastOffset;
					start = start === -1 ? firstIndex : Math.min(start, firstIndex);
					end = Math.max(end, lastIndex);
					return;
				}
				if (info.y + info.height < viewTop || info.y > viewBottom) return;
				start = start === -1 ? info.index : Math.min(start, info.index);
				end = Math.max(end, info.index);
			});
			this.rowRange = {
				start: Math.max(0, start),
				end: Math.min(rowCount - 1, end)
			};
		};
		_create_class$1(RangeCollector, [{
			key: "maxScrollTop",
			get: function() {
				return Math.max(0, this.rows.scrollHeight - this.size.rootHeight);
			}
		}]);
		return RangeCollector;
	}(import_main$1.Disposable);
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/collector/row.js
function _inherits$5(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function");
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		writable: true,
		configurable: true
	} });
	if (superClass) _set_prototype_of$5(subClass, superClass);
}
function _set_prototype_of$5(o, p) {
	_set_prototype_of$5 = Object.setPrototypeOf || function setPrototypeOf(o, p) {
		o.__proto__ = p;
		return o;
	};
	return _set_prototype_of$5(o, p);
}
var import_main, RowCollector;
var init_row = __esmMin((() => {
	import_main = require_main();
	init_interface$6();
	init_run_group();
	init_placeholder_record();
	RowCollector = /* @__PURE__ */ function(Disposable) {
		"use strict";
		_inherits$5(RowCollector, Disposable);
		function RowCollector(dataUtil, size, state) {
			var _this = Disposable.call(this) || this;
			_this.dataUtil = dataUtil;
			_this.size = size;
			_this.state = state;
			_this.rowCount = 0;
			_this.recordCount = 0;
			/** 当前所有行的总高度（含 Spacing），用于计算 maxScrollTop */ _this.scrollHeight = 0;
			_this.rowInfos = /* @__PURE__ */ new Map();
			/** 按 index 升序的所有 key，用于 RecordRange 内查找某个具体 record 的辅助索引 */ _this.indexKeys = [];
			/** 当前累加排版游标 Y，仅在 collect 期间使用 */ _this.cursorY = 0;
			/**
			* runGroupTree 的 handler 回调：根据 RowType 创建对应 RowInfo 并更新游标 Y。
			*
			* 收集策略：
			*   - GroupHead / RecordRange：进 rowInfos，rowCount 推进，cursorY 按真实高度推进；
			*   - Spacing：
			*       · parent === -1（顶层兄弟分组之间）→ cursorY += headRecordGap（5px 视觉间距）；
			*       · parent >= 0（嵌套分组之间 / 末位 GroupAdd 之前）→ 完全忽略（二三层视觉上紧贴）；
			*   - 其它（GroupFoot / RecordAdd / Stat / GroupAdd 等）→ 完全忽略，返回 -1。
			*
			* GroupHead 后的 gap（与下方第一行的间距）：
			*   - level === 0 非折叠 → cursorY += headRecordGap，与圆角背景的视觉分隔需求一致；
			*   - level >= 1 → 不补 gap，紧贴下一行（无论是子分组 head 还是 record）；
			*   - 折叠态一律不补 gap（折叠组只占自身高度，下一段 Spacing/兄弟分组自身已承担间隔）。
			*
			* 返回值是新行的 row index；对于不收集的类型返回 -1。
			* runGroupTree 中 setGroupHeadStickyEnd 在 endIndex < 0 时会安全跳过，
			* list 视图也不依赖 stickyEndIndex（sticky 由 scroller feature 自算），所以 -1 是安全的。
			*/ _this.createRowInfo = (type, parent, param) => {
				if (type === RowType.Spacing) {
					if (parent === -1) _this.cursorY += _this.size.headRecordGap;
					return -1;
				}
				var rowInfo;
				var index = _this.rowCount;
				if (type === RowType.GroupHead) {
					rowInfo = _this.createGroupHeadRowInfo(index, parent, param);
					_this.rowCount += 1;
				} else if (type === RowType.RecordRange) {
					rowInfo = _this.createRecordRangeRowInfo(index, parent, param);
					_this.rowCount += rowInfo.recordIds.length;
					_this.recordCount += rowInfo.recordIds.length;
				} else return -1;
				if (_this.isHiddenByFoldParent(parent)) rowInfo.height = 0;
				_this.rowInfos.set(index, rowInfo);
				_this.cursorY += rowInfo.height;
				if (rowInfo.type === RowType.GroupHead && !rowInfo.fold && rowInfo.level === 0) _this.cursorY += _this.size.headRecordGap;
				return index;
			};
			return _this;
		}
		var _proto = RowCollector.prototype;
		_proto.getTypeRows = function getTypeRows(rowType) {
			return Array.from(this.rowInfos.values()).filter((info) => info.type === rowType);
		};
		_proto.forEachRowInfo = function forEachRowInfo(callback) {
			this.rowInfos.forEach(callback);
		};
		_proto.getRecordSize = function getRecordSize() {
			return this.size.recordHeight;
		};
		/** 取出指定 index 对应的行（如果落在 RecordRange 内部，则展开为单条 Record） */ _proto.getInfo = function getInfo(index) {
			if (index < 0 || index >= this.rowCount) return;
			var rowInfo = this.rowInfos.get(index);
			if (rowInfo) {
				if (rowInfo.type === RowType.RecordRange) return this.expandRecordFromRange(rowInfo, index);
				return rowInfo;
			}
			var closest = this.getClosestRecordRangeIndex(index);
			var rangeInfo = closest >= 0 ? this.rowInfos.get(closest) : void 0;
			if ((rangeInfo === null || rangeInfo === void 0 ? void 0 : rangeInfo.type) === RowType.RecordRange) return this.expandRecordFromRange(rangeInfo, index);
		};
		/** 通过 recordId 反查行信息 */ _proto.getInfoByRecordId = function getInfoByRecordId(recordId) {
			if (!recordId) return;
			var ranges = this.getTypeRows(RowType.RecordRange);
			var range;
			for (var item of ranges) if (item.recordIds.includes(recordId)) {
				range = item;
				break;
			}
			if (!range) return;
			var offset = range.recordIds.indexOf(recordId);
			return this.expandRecordFromRange(range, range.index + offset);
		};
		/**
		* Returns the recordId sequence eligible for "range selection", following the record collection
		* order (RecordRanges flattened across groups, in ascending index order — i.e. top-to-bottom on
		* screen).
		*
		* - Iterates all RecordRanges by ascending index and concatenates their recordIds, yielding a
		*   linear sequence consistent with the on-screen / collection order and spanning across groups;
		* - Skips RecordRanges under a folded group (`height === 0`, rows invisible, must not join the
		*   shift range-selection);
		* - Skips placeholder virtual records (empty-group placeholder rows: not real data, not selectable).
		*
		* Used by the hover feature's checkbox "shift + click" continuous selection/deselection
		* (`getShiftSelectionChange`) to reason about ranges across groups.
		*/ _proto.getOrderedRecordIds = function getOrderedRecordIds() {
			var ranges = this.getTypeRows(RowType.RecordRange).slice().sort((a, b) => a.index - b.index);
			var ids = [];
			for (var range of ranges) {
				if (range.height === 0) continue;
				for (var id of range.recordIds) {
					if (isPlaceholderRecordId(id)) continue;
					ids.push(id);
				}
			}
			return ids;
		};
		/**
		* Computes the record set + action for a checkbox "shift + click", anchored at `anchorId` while
		* clicking `targetId`, following the record collection order (cross-group). The anchor itself is
		* never moved by this operation; the behaviour depends on whether the target is currently selected
		* (via the injected `isSelected` predicate — selection state lives in StateCenter, order lives here):
		*
		* - Target NOT selected → **extend**: select the whole `[anchor, target]` segment (order-independent).
		* - Target already selected → **shrink**: keep `[anchor, target]` selected and deselect the
		*   contiguous run of already-selected records immediately beyond the target, in the direction
		*   *away from the anchor*. (e.g. anchor=10, currently 10..20 selected, click 15 → deselect 16..20.)
		*
		* Returns `null` when either endpoint is missing from the ordered sequence (anchor's group folded,
		* record deleted, or degenerate anchor === target), so the caller can fall back to a plain toggle.
		* The shrink "nothing to peel off" case returns `{ recordIds: [], select: false }` (a valid no-op
		* shift action), so the caller does NOT degrade to a plain toggle (which would flip the target and
		* move the anchor).
		*/ _proto.getShiftSelectionChange = function getShiftSelectionChange(anchorId, targetId, isSelected) {
			if (!anchorId || !targetId) return null;
			var ordered = this.getOrderedRecordIds();
			var anchorIdx = ordered.indexOf(anchorId);
			var targetIdx = ordered.indexOf(targetId);
			if (anchorIdx === -1 || targetIdx === -1 || anchorIdx === targetIdx) return null;
			if (!isSelected(targetId)) {
				var [start, end] = anchorIdx <= targetIdx ? [anchorIdx, targetIdx] : [targetIdx, anchorIdx];
				return {
					recordIds: ordered.slice(start, end + 1),
					select: true
				};
			}
			var step = targetIdx > anchorIdx ? 1 : -1;
			var recordIds = [];
			for (var i = targetIdx + step; i >= 0 && i < ordered.length; i += step) {
				if (!isSelected(ordered[i])) break;
				recordIds.push(ordered[i]);
			}
			return {
				recordIds,
				select: false
			};
		};
		_proto.collect = function collect() {
			this.beforeCollect();
			this.collectRows();
			this.afterCollect();
		};
		_proto.patch = function patch(_mutations) {
			this.collect();
		};
		_proto.beforeCollect = function beforeCollect() {
			this.rowCount = 0;
			this.recordCount = 0;
			this.rowInfos.clear();
			this.indexKeys = [];
			this.cursorY = this.size.globalPaddingTop;
			this.scrollHeight = 0;
		};
		_proto.afterCollect = function afterCollect() {
			this.indexKeys = Array.from(this.rowInfos.keys()).sort((a, b) => a - b);
			this.scrollHeight = this.cursorY + this.size.globalPaddingBottom;
		};
		_proto.collectRows = function collectRows() {
			var groupTree = this.dataUtil.getGroupTree();
			if (groupTree.length > 0) {
				var stubStatus = { getShouldHideGroupInsert: () => true };
				var gridDataUtil = this.dataUtil;
				runGroupTree(stubStatus, this.state, gridDataUtil, this.rowInfos, this.createRowInfo, groupTree, 0);
				return;
			}
			var recordIds = this.dataUtil.getSubTreeOrderedRecordIds();
			if (recordIds.length > 0) this.createRowInfo(RowType.RecordRange, -1, { recordIds });
		};
		_proto.createGroupHeadRowInfo = function createGroupHeadRowInfo(index, parent, param) {
			var _a;
			var headInfo = param === null || param === void 0 ? void 0 : param.headInfo;
			var level = (_a = param === null || param === void 0 ? void 0 : param.level) !== null && _a !== void 0 ? _a : 0;
			var height = level >= 1 ? this.size.nestedGroupHeadHeight : this.size.groupHeadHeight;
			return {
				type: RowType.GroupHead,
				level,
				index,
				parent,
				x: this.size.rowStartX,
				y: this.cursorY,
				height,
				fold: (headInfo === null || headInfo === void 0 ? void 0 : headInfo.fold) || false,
				count: (headInfo === null || headInfo === void 0 ? void 0 : headInfo.count) || 0,
				path: (headInfo === null || headInfo === void 0 ? void 0 : headInfo.path) || [],
				groupValue: (headInfo === null || headInfo === void 0 ? void 0 : headInfo.groupValue) || null
			};
		};
		_proto.createRecordRangeRowInfo = function createRecordRangeRowInfo(index, parent, param) {
			var _a, _b;
			var recordIds = (param === null || param === void 0 ? void 0 : param.recordIds) || [];
			var { recordHeight } = this.size;
			return {
				type: RowType.RecordRange,
				level: (_b = (_a = this.rowInfos.get(parent)) === null || _a === void 0 ? void 0 : _a.level) !== null && _b !== void 0 ? _b : 0,
				index,
				parent,
				x: this.size.rowStartX,
				y: this.cursorY,
				height: recordHeight * recordIds.length,
				recordIds,
				recordCountBefore: this.recordCount
			};
		};
		/** 将某条 record 从所属 RecordRange 展开成一个真实 Record 行 */ _proto.expandRecordFromRange = function expandRecordFromRange(range, rowIndex) {
			var offset = rowIndex - range.index;
			var recordHeight = range.height === 0 ? 0 : this.size.recordHeight;
			var y = range.y + offset * recordHeight;
			return {
				type: RowType.Record,
				level: range.level,
				index: rowIndex,
				parent: range.parent,
				x: range.x,
				y,
				height: recordHeight,
				recordId: range.recordIds[offset],
				recordIndex: range.recordCountBefore + offset
			};
		};
		/** 向上递归判断是否处在折叠分组下（含本身） */ _proto.isHiddenByFoldParent = function isHiddenByFoldParent(parentIndex) {
			var cursor = parentIndex;
			while (cursor >= 0) {
				var row = this.rowInfos.get(cursor);
				if (!row) return false;
				if (row.type === RowType.GroupHead && row.fold) return true;
				cursor = row.parent;
			}
			return false;
		};
		/** 在 indexKeys 中二分查找小于 rowIndex 的最大 key */ _proto.getClosestRecordRangeIndex = function getClosestRecordRangeIndex(rowIndex) {
			if (this.indexKeys.length === 0) return -1;
			var left = 0;
			var right = this.indexKeys.length - 1;
			var result = -1;
			while (left <= right) {
				var mid = left + right >> 1;
				if (this.indexKeys[mid] < rowIndex) {
					result = this.indexKeys[mid];
					left = mid + 1;
				} else right = mid - 1;
			}
			return result;
		};
		return RowCollector;
	}(import_main.Disposable);
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/collector/size.js
function _defineProperties(target, props) {
	for (var i = 0; i < props.length; i++) {
		var descriptor = props[i];
		descriptor.enumerable = descriptor.enumerable || false;
		descriptor.configurable = true;
		if ("value" in descriptor) descriptor.writable = true;
		Object.defineProperty(target, descriptor.key, descriptor);
	}
}
function _create_class(Constructor, protoProps, staticProps) {
	if (protoProps) _defineProperties(Constructor.prototype, protoProps);
	if (staticProps) _defineProperties(Constructor, staticProps);
	return Constructor;
}
function _inherits$4(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function");
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		writable: true,
		configurable: true
	} });
	if (superClass) _set_prototype_of$4(subClass, superClass);
}
function _set_prototype_of$4(o, p) {
	_set_prototype_of$4 = Object.setPrototypeOf || function setPrototypeOf(o, p) {
		o.__proto__ = p;
		return o;
	};
	return _set_prototype_of$4(o, p);
}
var SizeCollector;
var init_size = __esmMin((() => {
	init_size$1();
	init_bottom_collectors();
	SizeCollector = /* @__PURE__ */ function(BaseSizeCollector) {
		"use strict";
		_inherits$4(SizeCollector, BaseSizeCollector);
		function SizeCollector(dataUtil) {
			var _this = BaseSizeCollector.call(this, dataUtil) || this;
			_this.dataUtil = dataUtil;
			/** 容器左右内边距 */ _this.globalPaddingX = 16;
			/** 容器上下内边距 */ _this.globalPaddingY = 0;
			/** 最外层（level === 0，参与 sticky）分组头总高度 */ _this.groupHeadHeight = 36;
			/** 嵌套层（level >= 1，视觉等同 record）分组头总高度，比 L0 略矮以更贴近 record 行高 */ _this.nestedGroupHeadHeight = 36;
			/** 分组头左右内边距（与全局 paddingX 叠加用） */ _this.headPaddingX = 12;
			/** 折叠按钮尺寸 */ _this.foldIconSize = 16;
			/** 折叠按钮与分组值的间距 */ _this.foldIconGap = 6;
			/**
			* 命中特殊配置时左侧装饰图标尺寸。
			*
			* 状态列 svg viewBox 为 24×24，此处取 24 与视觉稿齐平（1:1 不缩放，减少小尺寸下描边模糊）。
			* 与 kanban-todo 卡片 body iconOnly 状态 pill 直径、`kanban-todo/collector/head.ts` 分组头
			* 装饰 icon 尺寸三处对齐；如需整体缩放请同步这三处。
			*/ _this.headKeyIconSize = 22;
			/** 命中特殊配置但无 icon 时绘制的圆点直径（与 kanban-todo headDotSize 对齐） */ _this.headKeyDotSize = 10;
			/** 装饰段（icon/dot）与标题之间的间距（与 kanban-todo headTitleGap 对齐） */ _this.headKeyTitleGap = 8;
			/** 分组值字号（与 kanban-todo headTitleFontSize 对齐） */ _this.headTitleFontSize = 14;
			/**
			* 空分组标题字号（\"{列名}: 空\" 兜底文案专用，与 kanban-todo headEmptyTitleFontSize 对齐）。
			* 视觉上比正常分组标题小一号，配合 `lightUltraFontColor` 呈弱化态。
			*/ _this.headEmptyTitleFontSize = 14;
			/** 分组值与数量的间距（与 kanban-todo headCountGap 对齐） */ _this.headCountGap = 15;
			/** 分组数量字号（与 kanban-todo headCountFontSize 对齐） */ _this.headCountFontSize = 12;
			/** 分组头右侧加号按钮尺寸 */ _this.headAddBtnSize = 20;
			/** 分组头「全选/取消全选」文字字号（与 kanban-todo headSelectAllFontSize 对齐） */ _this.headSelectAllFontSize = 12;
			/** 分组背景圆角 */ _this.headBgRadius = 8;
			/**
			* 嵌套层（level >= 1）GroupHead 中段直线两端留白：
			* 直线左端 = title/count 右沿 + 该值；直线右端 = 右侧按钮左沿 - 该值。
			*/ _this.nestedHeadLineSideGap = 8;
			/**
			* 存在分组时，Record 内容相对于 GroupHead 分组值起始位置的额外缩进（px）。
			* 竖线绘制在 groupValueStartX + groupIndentLineOffsetX 处，Record 内容从竖线右侧 + gap 开始。
			*/ _this.groupIndentWidth = 25;
			/** 分组竖线相对于 rowStartX 的 X 偏移（线中心 X = rowStartX + groupLineOffsetX） */ _this.groupLineOffsetX = 44;
			/** 分组竖线线宽 */ _this.groupLineWidth = 1;
			/** 竖线向上延伸的额外长度（穿透到上一条 record 的间隙区域，视觉上形成连续线） */ _this.lineTopExtend = 5;
			/** Record 行高 */ _this.recordHeight = 38;
			/** 分组之间 Spacing 行的高度（即相邻分组之间留白；用户要求 5px） */ _this.headRecordGap = 5;
			/** Record 行的圆角（hover / selected 背景） */ _this.recordBgRadius = 8;
			/** Record 内容上下 padding */ _this.recordCellPaddingY = 10;
			/** 左侧字段单元格之间的间距 */ _this.leftFieldGap = 20;
			/**
			* 主列（primaryTitle）→ 行 status icon 的间距。
			*
			* 该 icon 紧贴在主列文本之后，与"字段之间"的语义不同（视觉上是主列文本的装饰附属），
			* 故采用比 `leftFieldGap` 更紧凑的留白，强化与主列的从属关系。
			* icon 自身的尾部间距继续复用 `leftFieldGap`，保证 icon → 下一左侧字段与"字段之间"一致。
			*/ _this.primaryToStatusIconGap = 8;
			/** 右侧字段单元格之间的间距 */ _this.rightFieldGap = 20;
			/** 左侧字段与中间剩余空间 / 右侧字段的最小留白 */ _this.leftToRightMinGap = 15;
			/** 右侧无数据时的灰色占位圆直径 */ _this.placeholderDotSize = 18;
			/** 字段内容字号 */ _this.contentFontSize = 13;
			/**
			* 左侧 status 列文案字号（与 kanban-todo `SizeCollector.bottomStatusFontSize` 对齐）。
			* `ListConfig.recordLeftShowFieldTitles` 末尾追加了 `card.bottom.statusFieldTitle`，
			* 命中该列时 content collector 会短路通用 fieldCollector，
			* 直接调用 `shared/bottom-collectors.collectStatusText` 走与卡片底部 1:1 视觉。
			*/ _this.bottomStatusFontSize = 12;
			/** 同一行内相邻 pill 之间的横向间距 */ _this.tagItemGap = 8;
			/**
			* primary 段（含 statusIcon 装饰）之后、tag pill 段之前的横向间距。
			* 与 `primaryToStatusIconGap` 同语义层（紧贴主列附属内容），区别于
			* `leftFieldGap`（左侧字段之间的视觉等距间距）。
			*/ _this.primaryToTagRowGap = 20;
			/** owner 列重叠头像组：单个头像直径（与 kanban-todo SizeCollector.avatarSize 一致；外环含 1px 描边 + 1px 留白，内层视觉 = 22px） */ _this.avatarSize = 26;
			/** 默认头像（无图）首字母字号 */ _this.avatarTextFontSize = 12;
			/** 相对时间文本字号 */ _this.relativeDateFontSize = 12;
			/**
			* 空态文案字号；与 kanban-todo 空分组提示「暂无事项」保持同一视觉层级（轻量灰字）。
			*/ _this.emptyTipFontSize = 13;
			/**
			* 空态文案行高（用于 pen.config.text 的 height）；20px 内单行居中绘制即可，
			* 不需要预留多行空间——文案是一句简短引导语。
			*/ _this.emptyTipHeight = 20;
			/**
			* 空态文案距 body 顶部的内边距（视觉上不贴顶，给一点呼吸空间）。
			*/ _this.emptyTipPaddingTop = 80;
			/** Record hover 状态下左侧 checkbox 尺寸 */ _this.checkboxSize = 20;
			/** checkbox 距离 Record 行左边的留白 */ _this.checkboxPaddingLeft = 10;
			/** checkbox 与后续字段内容的间距 */ _this.checkboxGap = 6;
			/**
			* 每一层父子缩进的宽度（px）。
			*
			* 渲染时主列文本起点 X = `groupValueStartX + 2 + level * subIndentWidth`，
			* 左侧其他字段整体随之右移；右侧字段不受影响。
			* 顶层 record（level=0）退化为无缩进，与未启用父子记录时视觉一致。
			*/ _this.subIndentWidth = 28;
			/** 父子关联线线宽（px），实线 1px 与嵌套分组头中段直线一致 */ _this.subLineWidth = 1;
			/** 关联线横段右端到主列文本起点之间留白（px） */ _this.subLineGapToText = 6;
			/**
			* 父子关联线在转角处的斜段尺寸（px）—— 取 45°，水平投影 == 垂直投影。
			* 竖线到 (midY - subLineSlope) 处开始向右下倾斜，到 (vx + subLineSlope, midY) 结束，再水平延伸。
			*/ _this.subLineSlope = 8;
			/**
			* 父子关联线竖线相对"缩进列中点"的水平微调偏移（px，正右负左）。
			*
			* 默认竖线 X = 缩进列中点 = `leftStartX - indent * (k + 1) + indent / 2`。
			* 由于 `subIndentWidth` 大于父行主列前置图标（priority icon）的宽度，
			* 竖线中点会略偏离父行图标视觉中心；用此偏移把竖线拉回到与父行图标垂直居中对齐。
			*/ _this.subLineCenterOffsetX = -3;
			return _this;
		}
		_create_class(SizeCollector, [
			{
				key: "relativeDateSlotWidth",
				get: function() {
					return measureRelativeTimeSlotWidth(this.relativeDateFontSize);
				}
			},
			{
				key: "rootWidth",
				get: function() {
					return Math.ceil(this.globalOriginRootWidth / this.scale);
				}
			},
			{
				key: "rootHeight",
				get: function() {
					return Math.ceil(this.globalOriginRootHeight / this.scale);
				}
			},
			{
				key: "globalPaddingLeft",
				get: function() {
					return this.globalPaddingX;
				}
			},
			{
				key: "globalPaddingRight",
				get: function() {
					return this.globalPaddingX;
				}
			},
			{
				key: "globalPaddingTop",
				get: function() {
					return this.globalPaddingY;
				}
			},
			{
				key: "globalPaddingBottom",
				get: function() {
					return this.globalPaddingY;
				}
			},
			{
				key: "globalWidth",
				get: function() {
					return this.rootWidth;
				}
			},
			{
				key: "globalRect",
				get: function() {
					return {
						x: 0,
						y: 0,
						width: this.rootWidth,
						height: this.rootHeight
					};
				}
			},
			{
				key: "rowWidth",
				get: function() {
					return this.rootWidth - this.globalPaddingLeft - this.globalPaddingRight;
				}
			},
			{
				key: "rowStartX",
				get: function() {
					return this.globalPaddingLeft;
				}
			},
			{
				key: "groupValueStartX",
				get: function() {
					return this.rowStartX + this.headPaddingX + this.foldIconSize + this.foldIconGap;
				}
			},
			{
				key: "groupLineCenterX",
				get: function() {
					return this.rowStartX + this.groupLineOffsetX;
				}
			},
			{
				key: "groupedRecordStartX",
				get: function() {
					return this.groupValueStartX + this.groupIndentWidth;
				}
			}
		]);
		return SizeCollector;
	}(BaseSizeCollector);
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/utils/storage-key.js
var GridListStorageType;
var init_storage_key = __esmMin((() => {
	(function(GridListStorageType) {
		/** 分组折叠态：value 为 `{ signature: string; paths: string[] }` 的 JSON 字符串 */ GridListStorageType["FoldGroup"] = "WbListFoldGroups";
	})(GridListStorageType || (GridListStorageType = {}));
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/collector/state.js
function _inherits$3(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function");
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		writable: true,
		configurable: true
	} });
	if (superClass) _set_prototype_of$3(subClass, superClass);
}
function _set_prototype_of$3(o, p) {
	_set_prototype_of$3 = Object.setPrototypeOf || function setPrototypeOf(o, p) {
		o.__proto__ = p;
		return o;
	};
	return _set_prototype_of$3(o, p);
}
/** 保守判断 storage value 是否符合期望结构，防御 JSON 损坏 / 旧版本纯数组 payload / 手动改坏。 */ function isFoldStoragePayload(value) {
	if (!value || typeof value !== "object") return false;
	var record = value;
	return typeof record.signature === "string" && Array.isArray(record.paths) && record.paths.every((item) => typeof item === "string");
}
var StateCenter;
var init_state = __esmMin((() => {
	init_es();
	init_es$1();
	init_string_group_path();
	init_state$1();
	init_storage_sync$1();
	init_storage_key();
	init_avatar_time_utils();
	init_batch_selection();
	init_group_key_config();
	init_source_field();
	init_wb_cell();
	init_wb_config();
	StateCenter = /* @__PURE__ */ function(BaseStateCollector) {
		"use strict";
		_inherits$3(StateCenter, BaseStateCollector);
		function StateCenter(dataUtil) {
			var _this = BaseStateCollector.call(this) || this;
			_this.dataUtil = dataUtil;
			/** 折叠分组路径序列化后的 key 集合（与 grid/utils/string-group-path 共享算法） */ _this.foldGroups = /* @__PURE__ */ new Set();
			/**
			* 本地存储恢复门闩：`buildIndex` 每次 collect/patch 都会跑，但折叠态本地恢复
			* 只应在首个 `buildIndex` 里执行一次 —— 之后再跑就会把用户运行时的折叠改动覆盖掉。
			*
			* 这里选择在 `buildIndex` 里恢复（而不是构造函数）：构造时 `dataUtil.getCurrentView()`
			* 未必已就绪（`getGroupFields()` 依赖 view），且我们需要利用当时的 groupFlatten 做
			* 「分组数据不存在」的失效清洗；`buildIndex` 阶段两个前置条件都已满足。
			*/ _this.foldStateLoaded = false;
			/** 跨视图共享的批量选择容器（mode + selected ids + emitter） */ _this.batch = _this._register(new BatchSelection());
			/**
			* shift 连续选中的「锚点」recordId：记录最近一次非 shift 的 checkbox 点选。
			* shift + 点选时以此为起点、到当前 record 之间按 record 收集顺序（跨分组）整体置选。
			* 空串表示当前无锚点（尚未点选过 / 选中集已被清空 / 已退出批量模式）。
			*/ _this.selectAnchorRecordId = "";
			/**
			* 「active 态」记录 id（外部主动高亮某条记录，如从详情面板/其他视图联动定位）。
			* 空串表示当前无 active。与「选中（selected）」是两套独立状态：
			* - selected：用户勾选的批量集合（BatchSelection 维护，带 checkbox）；
			* - active：单条高亮，仅用于视觉定位，不带 checkbox。
			* 二者可以同时命中同一行，绘制时 selected 优先（见 content.collectRecord）。
			*/ _this.activeRecordId = "";
			_this.ownerFieldId = "";
			_this.dateFieldId = "";
			_this.bottomStatusFieldId = "";
			_this.hasOwnerField = false;
			_this.hasDateField = false;
			_this.hasBottomStatusField = false;
			/**
			* sys_tags 字段专用索引：与其它 tag 字段（`bodyTagFieldIds`）解耦。
			*
			* 语义：`sys_tags` 是一个多值 tag 列，在 grid-list 中以「独立段」渲染
			* ——紧跟在主列附属的 `body tag row` 段（sys_source 等 pill）之后，
			* 使用 `collectTagsPillsInRect` 收集，实现"尽量摆下所有 tag，装不下时尾部合成 +N"的
			* 折叠行为，与 kanban-todo 卡片的独立 sys_tags 行同源。
			*
			* 因此需要从常规 `bodyTagFieldIds` 中剔除 sys_tags，避免被 collectBodyTag 重复渲染。
			*/ _this.sysTagsFieldId = "";
			_this.hasSysTagsField = false;
			/**
			* sys_priority 字段专用索引：仅供 `getVisibleBodyTagFieldIds(recordId)` 逐 record
			* 判定「优先级为无（rawText 为空）时不展示」使用（grid-list 特有业务约定；
			* 其他视图仍展示「无」pill —— 见 `wb-cell.resolveBodyTagItem` 的 sys_priority 分支）。
			*
			* sys_priority 本身仍属于 `bodyTagFieldIds` 常规成员（视觉上是 body tag row 一环），
			* 这里只是为过滤逻辑单独持有一个 fieldId 引用，避免逐次遍历 bodyTagFieldIds 反查 title。
			*/ _this.priorityFieldId = "";
			_this.hasPriorityField = false;
			/**
			* sys_source（来源）字段专用索引：来源列同样以 body tag pill 形式渲染在 body tag row 中，
			* 但它是**只读**列（不支持修改 / 编辑）。此处单独持有其 fieldId，供 hover feature 判定
			* 「命中的 pill 是否为来源列」——命中来源 pill 时 cursor 保持 DEFAULT，不升级为 POINTER。
			*/ _this.sourceFieldId = "";
			_this.hasSourceField = false;
			/**
			* 行内「标签组」字段的 fieldId 列表（按 `WbSharedConfig.card.body.tagFieldTitles` 顺序解析）。
			*
			* 与 `dataUtil.getLeftFieldIds()` 解耦：tagFieldTitles 不写在 `ListConfig.recordLeftShowFieldTitles`
			* 中，因此不会进入 leftFieldIds 的 flex 布局循环；而是由 content collector 在主列
			* 渲染（含 statusIcon 装饰）之后，作为独立段调用 `collectBodyTag` 联合产出 pill 行。
			*
			* 注意：`sys_tags` 走独立段渲染（`collectTagsPillsInRect`），不在此列表中；
			* 由 `sysTagsFieldId` / `hasSysTagsField` 单独持有。
			*/ _this.bodyTagFieldIds = [];
			/** 当前 visible 字段集合的缓存（来自 dataUtil.getVisibleFieldIds()），用于 O(1) 的 visible 判断 */ _this.visibleFieldIdSet = /* @__PURE__ */ new Set();
			_this.onSelectedRecordIdsChange = _this.batch.onChange;
			ensureRelativeTimePlugin();
			return _this;
		}
		var _proto = StateCenter.prototype;
		/** runGroupFlatten 直接调用此方法判断 GroupHead 初始 fold */ _proto.isGroupFold = function isGroupFold(groupPath) {
			return this.foldGroups.has(stringifyGroupPath(groupPath));
		};
		/**
		* runGroupTree（叶子层）与 grid 侧父子记录折叠功能共享的鸭子接口：返回被折叠的父记录 id 集合。
		*
		* list 视图当前未接入父子记录折叠交互，恒返回 `EMPTY_FOLD_SUB_TREE_IDS`（同一个空 Set 单例）。
		* runGroupTree 内部的 `filterFoldedSubTreeRecordIds` 在 `foldedIds.size === 0` 时会走零开销
		* 早退分支，因此对 list 性能无任何影响。
		*/ _proto.getFoldSubTreeRecordIds = function getFoldSubTreeRecordIds() {
			return StateCenter.EMPTY_FOLD_SUB_TREE_IDS;
		};
		_proto.setGroupFoldState = function setGroupFoldState(groupPath, fold) {
			var key = stringifyGroupPath(groupPath);
			if (fold) this.foldGroups.add(key);
			else this.foldGroups.delete(key);
			this.saveState();
		};
		/**
		* 是否所有顶层分组都处于折叠态。
		*
		* 语义：顶层分组全部折叠即视为「全部折叠」——顶层折叠后其所有子分组 / 记录都不可见，
		* 无需再判断更深层级。当前无分组时返回 false。
		*
		* 顶层分组从规范化分组树 `getGroupTree()` 的根节点取（含记录数为 0 的空分组），
		* 与折叠 key 的产生源一致，避免空分组被漏判。
		*/ _proto.isAllGroupFold = function isAllGroupFold() {
			var _a;
			var hasTopGroup = false;
			for (var node of this.dataUtil.getGroupTree()) {
				if (typeof node === "string" || !isFormattedTreeNode(node)) continue;
				hasTopGroup = true;
				if (!((_a = node.path) === null || _a === void 0 ? void 0 : _a.length) || !this.isGroupFold(node.path)) return false;
			}
			return hasTopGroup;
		};
		/** 切换某分组的折叠态，返回切换后的新状态 */ _proto.toggleGroupFold = function toggleGroupFold(groupPath) {
			var next = !this.isGroupFold(groupPath);
			this.setGroupFoldState(groupPath, next);
			return next;
		};
		/**
		* 清空所有折叠态。
		*
		* 用于「批量设置全部分组折叠 / 展开」这类场景（renderer-model 的 setGroupFold 未指定
		* groupKeys 时先清空、再统一按新 fold 写入），语义与 grid 视图 StateCenter.clearGroupFold 对齐。
		* 内部立即落盘一次，与 setGroupFoldState 保持一致的持久化时机。
		*/ _proto.clearGroupFold = function clearGroupFold() {
			if (this.foldGroups.size === 0) return;
			this.foldGroups.clear();
			this.saveState();
		};
		/**
		* 把当前 `foldGroups` 快照写入 localStorage。
		*
		* value 结构：`{ signature, paths }`
		* - `signature`：当前分组签名（`getGroupFields()` 的 title 有序拼接），
		*   下次 load 时比对；签名不一致 → 分组依据已变，整条缓存作废（详见 `loadFoldStateIfNeeded`）。
		* - `paths`：已折叠分组的 `stringifyGroupPath` 序列化 key 数组。
		*
		* 由 `setGroupFoldState` 主动调用（每次点击）+ `GridListStorageSync` feature 的
		* beforeunload / visibilitychange / 点击画布外时机调用。同一个 storage key、同一份序列化，
		* 多次写只是覆盖，无一致性问题。
		*/ _proto.saveState = function saveState() {
			var payload = {
				signature: this.computeGroupSignature(),
				paths: Array.from(this.foldGroups)
			};
			setStorageValue(this.dataUtil.getContext(), GridListStorageType.FoldGroup, JSON.stringify(payload));
		};
		_proto.isRecordSelected = function isRecordSelected(recordId) {
			return this.batch.isSelected(recordId);
		};
		_proto.getSelectedRecordIds = function getSelectedRecordIds() {
			return this.batch.getSelectedIds();
		};
		/** 切换某条 record 的选中状态，fire 选中集合变化 */ _proto.toggleRecordSelected = function toggleRecordSelected(recordId) {
			this.batch.toggle(recordId);
		};
		/**
		* 批量设置一组 record 的选中态（供 shift 连续选中把区间整体置选使用）。
		* recordIds 为空时不触发事件（由底层 `BatchSelection.setIdsSelected` 保证）。
		*/ _proto.setRecordsSelected = function setRecordsSelected(recordIds, select) {
			this.batch.setIdsSelected(recordIds, select);
		};
		/** shift 连续选中的锚点 recordId（''=当前无锚点） */ _proto.getSelectAnchorRecordId = function getSelectAnchorRecordId() {
			return this.selectAnchorRecordId;
		};
		/** 更新 shift 连续选中的锚点（通常在非 shift 的 checkbox 点选后调用） */ _proto.setSelectAnchorRecordId = function setSelectAnchorRecordId(recordId) {
			this.selectAnchorRecordId = recordId;
		};
		/** 清空选中集合 */ _proto.clearSelected = function clearSelected() {
			this.batch.clear();
			this.selectAnchorRecordId = "";
		};
		/** 当前是否处于批量选择模式 */ _proto.isBatchSelectMode = function isBatchSelectMode() {
			return this.batch.isMode();
		};
		/**
		* 进入 / 退出批量选择模式。
		* 退出时自动清空已选集合并 fire 一次空数组事件（与 kanban-todo 行为一致），同时重置连续选中锚点。
		*/ _proto.setBatchSelectMode = function setBatchSelectMode(enable) {
			this.batch.setMode(enable);
			if (!enable) this.selectAnchorRecordId = "";
		};
		/** 当前 active 态记录 id（''=无） */ _proto.getActiveRecordId = function getActiveRecordId() {
			return this.activeRecordId;
		};
		/**
		* 设置 active 态记录：
		* - 传入有效 recordId：将该行置为 active；
		* - 传入 ''：清除 active 态。
		*
		* 仅更新内部字段，是否重绘由调用方（ListView.setActiveRecord）决定。
		* 与 selected 相互独立：同一行可同时 active + selected，绘制时 selected 优先。
		*/ _proto.setActiveRecordId = function setActiveRecordId(recordId) {
			this.activeRecordId = recordId;
		};
		/**
		* 全选 / 取消全选某个分组内的所有 record（支持多层分组）。
		*
		* 入参 `path` 可以是任意层级（最外层 / 中间层 / 叶子层）的分组路径：
		* - `dataUtil.getGroupFlatten` 只返回叶子分组（最内层），其 `recordIds` 是该叶子分组直接持有的 records；
		* - 对非叶子层级，会把所有「以 `path` 为前缀」的叶子分组的 recordIds 全部收集起来，
		*   语义上等价于"该层下所有子孙叶子分组的 record 并集"。
		*/ _proto.selectAllInGroup = function selectAllInGroup(path, select) {
			var recordIds = this.collectRecordIdsByPathPrefix(path);
			this.batch.setIdsSelected(recordIds, select);
		};
		/**
		* 某分组是否全选（语义同 `selectAllInGroup`，按 path 前缀聚合所有子孙叶子分组的 records）。
		*
		* 性能路径（见 `beginGroupPathIndex` / `endGroupPathIndex`）：
		*
		* - 已选集合为空 → 直接返回 false（最常见态，进入批量模式但没勾选 / 只勾一行时高频命中）。
		* - `groupPathRecordCountCache` 已由外层 `beginGroupPathIndex` 预扫构建：
		*     此时如果**总 record 数 > 已选数**，一定不可能全选，直接 O(1) 返回 false；
		*     否则再走一次 `collectRecordIdsByPathPrefix` + `areAllSelected`，走详细校验。
		* - 未预扫（普通调用路径）：走原始 O(F) 前缀扫描。
		*
		* 之所以要这层间接：checkbox 点击后 collect 阶段会为**每个 head** 调一次；
		* 无预扫时 N head × O(F 前缀扫描) 会退化到 O(N²)，实测 2240 head 一次 collect 卡 14s+。
		* 预扫一次 flatten O(F × depth) 即可把每次查询降到 O(1) 判断。
		*/ _proto.isGroupAllSelected = function isGroupAllSelected(path) {
			var _a, _b;
			var selectedSize = this.batch.getSelectedSize();
			if (selectedSize === 0) return false;
			if (this.groupPathRecordCountCache) {
				var key = path.join("::");
				var total = (_a = this.groupPathRecordCountCache.get(key)) !== null && _a !== void 0 ? _a : 0;
				if (total === 0 || total > selectedSize) return false;
				var cachedIds = (_b = this.groupPathRecordIdsCache) === null || _b === void 0 ? void 0 : _b.get(key);
				if (cachedIds) return this.batch.areAllSelected(cachedIds);
			}
			var recordIds = this.collectRecordIdsByPathPrefix(path);
			return this.batch.areAllSelected(recordIds);
		};
		/**
		* 在一次 collect 开始前构建"path 前缀 → recordIds"反向索引，将 `isGroupAllSelected`
		* 从 O(F) 降到 O(1)。调用方需成对调用 `endGroupPathIndex()`。
		*/ _proto.beginGroupPathIndex = function beginGroupPathIndex() {
			var _a;
			var flatten = this.dataUtil.getGroupFlatten();
			var idsMap = /* @__PURE__ */ new Map();
			var countMap = /* @__PURE__ */ new Map();
			for (var g of flatten) {
				var recordIds = g.recordIds;
				if (!recordIds || recordIds.length === 0) continue;
				var path = g.path;
				var prefixKey = "";
				for (var i = 0; i < path.length; i++) {
					prefixKey = i === 0 ? String(path[0]) : `${prefixKey}::${path[i]}`;
					var bucket = idsMap.get(prefixKey);
					if (!bucket) {
						bucket = [];
						idsMap.set(prefixKey, bucket);
					}
					for (var j = 0; j < recordIds.length; j++) bucket.push(recordIds[j]);
					countMap.set(prefixKey, ((_a = countMap.get(prefixKey)) !== null && _a !== void 0 ? _a : 0) + recordIds.length);
				}
			}
			this.groupPathRecordIdsCache = idsMap;
			this.groupPathRecordCountCache = countMap;
		};
		_proto.endGroupPathIndex = function endGroupPathIndex() {
			this.groupPathRecordIdsCache = void 0;
			this.groupPathRecordCountCache = void 0;
		};
		/**
		* 在 collect / patch 阶段被 ListCollector 调用，重建以下索引：
		*
		* 1) owner / date / bottomStatus 三列：按 `WbSharedConfig.card.bottom.*` 反查 fieldId（同时校验列类型）；
		* 2) visible 字段集合（来自 `dataUtil.getVisibleFieldIds()`）：上层 `isOwnerFieldVisible` /
		*    `isDateFieldVisible` 等基于此做"必须可见才走特殊渲染"的过滤。
		*
		* title 与 kanban-todo 共用 `WbSharedConfig`：保证同一份配置控制两个视图，
		* 后续若想按视图独立配置，可在 `wb_views/grid-list/config.ts` 加 ListConfig.bottomFieldTitles 并在此读取。
		*/ _proto.buildIndex = function buildIndex() {
			var _a;
			this.loadFoldStateIfNeeded();
			var ownerTitle = WbSharedConfig.card.bottom.ownerFieldTitle;
			var dateTitle = WbSharedConfig.card.bottom.dateFieldTitle;
			var bottomStatusTitle = WbSharedConfig.card.bottom.statusFieldTitle;
			var tagFieldTitles = (_a = WbSharedConfig.card.body.tagFieldTitles) !== null && _a !== void 0 ? _a : [];
			this.ownerFieldId = "";
			this.dateFieldId = "";
			this.bottomStatusFieldId = "";
			this.hasOwnerField = false;
			this.hasDateField = false;
			this.hasBottomStatusField = false;
			this.sysTagsFieldId = "";
			this.hasSysTagsField = false;
			this.priorityFieldId = "";
			this.hasPriorityField = false;
			this.sourceFieldId = "";
			this.hasSourceField = false;
			this.bodyTagFieldIds = [];
			this.visibleFieldIdSet = new Set(this.dataUtil.getVisibleFieldIds());
			if (!ownerTitle && !dateTitle && !bottomStatusTitle && tagFieldTitles.length === 0) return;
			var tagTitleToFieldId = /* @__PURE__ */ new Map();
			for (var fieldId of this.dataUtil.getAllFieldIds()) {
				var field = this.dataUtil.getFieldByFieldId(fieldId);
				if (!field) continue;
				var title = field.getTitle();
				if (ownerTitle && !this.hasOwnerField && title === ownerTitle && isUserField(field.getType())) {
					this.ownerFieldId = fieldId;
					this.hasOwnerField = true;
				}
				if (dateTitle && !this.hasDateField && title === dateTitle && this.isDateLikeField(field)) {
					this.dateFieldId = fieldId;
					this.hasDateField = true;
				}
				if (bottomStatusTitle && !this.hasBottomStatusField && title === bottomStatusTitle) {
					this.bottomStatusFieldId = fieldId;
					this.hasBottomStatusField = true;
				}
				if (tagFieldTitles.length > 0 && tagFieldTitles.includes(title) && !tagTitleToFieldId.has(title)) tagTitleToFieldId.set(title, fieldId);
			}
			this.bodyTagFieldIds = tagFieldTitles.filter((title) => title !== SYS_TAGS_FIELD_TITLE).map((title) => tagTitleToFieldId.get(title)).filter((id) => Boolean(id));
			if (tagFieldTitles.includes("sys_tags")) {
				var sysTagsId = tagTitleToFieldId.get(SYS_TAGS_FIELD_TITLE);
				if (sysTagsId) {
					this.sysTagsFieldId = sysTagsId;
					this.hasSysTagsField = true;
				}
			}
			if (tagFieldTitles.includes("sys_priority")) {
				var priorityId = tagTitleToFieldId.get(SYS_PRIORITY_FIELD_TITLE);
				if (priorityId) {
					this.priorityFieldId = priorityId;
					this.hasPriorityField = true;
				}
			}
			if (tagFieldTitles.includes("sys_source")) {
				var sourceId = tagTitleToFieldId.get(WB_SOURCE_FIELD_TITLE);
				if (sourceId) {
					this.sourceFieldId = sourceId;
					this.hasSourceField = true;
				}
			}
			if (ownerTitle && !this.hasOwnerField) logger.warn("grid-list", `owner field not found by title: ${ownerTitle}`);
			if (dateTitle && !this.hasDateField) logger.warn("grid-list", `date field not found by title: ${dateTitle}`);
			if (bottomStatusTitle && !this.hasBottomStatusField) logger.warn("grid-list", `bottom status field not found by title: ${bottomStatusTitle}`);
			tagFieldTitles.forEach((title) => {
				if (!tagTitleToFieldId.has(title)) logger.warn("grid-list", `body tag field not found by title: ${title}`);
			});
			this.pruneSelectedRecordIds();
		};
		/** owner 列 fieldId（''=未命中） */ _proto.getOwnerFieldId = function getOwnerFieldId() {
			return this.ownerFieldId;
		};
		/** date 列 fieldId（''=未命中） */ _proto.getDateFieldId = function getDateFieldId() {
			return this.dateFieldId;
		};
		/** 指定 fieldId 当前是否在 visible 集合中（fieldId 为空时返回 false） */ _proto.isFieldVisible = function isFieldVisible(fieldId) {
			if (!fieldId) return false;
			return this.visibleFieldIdSet.has(fieldId);
		};
		/** owner 列是否同时命中且在 visible 集合中 */ _proto.isOwnerFieldVisible = function isOwnerFieldVisible() {
			return this.hasOwnerField && this.visibleFieldIdSet.has(this.ownerFieldId);
		};
		/** date 列是否同时命中且在 visible 集合中 */ _proto.isDateFieldVisible = function isDateFieldVisible() {
			return this.hasDateField && this.visibleFieldIdSet.has(this.dateFieldId);
		};
		/** 底部状态文案字段是否在 visible 集合中（grid-list 当前未在 UI 中使用，但保留与 kanban-todo 同源同义） */ _proto.isBottomStatusFieldVisible = function isBottomStatusFieldVisible() {
			return this.hasBottomStatusField && this.isFieldVisible(this.bottomStatusFieldId);
		};
		/** 底部状态文案 fieldId（''=未命中），用于 content collector 在 left 循环中识别 status 列并走专用渲染 */ _proto.getBottomStatusFieldId = function getBottomStatusFieldId() {
			return this.bottomStatusFieldId;
		};
		/**
		* 行内中段「配置序 ∩ visible」的字段列表：
		* - 主列（`dataUtil.getPrimaryFieldId()`）始终作为第一项强制出现，对齐 kanban-todo
		*   `collectPrimaryTitle` 把主列写死置顶的语义（业务约定主列在第一列默认必显示）；
		* - 其后追加 `dataUtil.getLeftFieldIds()`（已按 `ListConfig.recordLeftShowFieldTitles`
		*   顺序解析），并去掉与主列重复的项；
		* - 最后整体与 `dataUtil.getVisibleFieldIds()` 缓存（`visibleFieldIdSet`）取交集。
		*
		* 注：kanban-todo 的 `collectCellContents` 在内部把 primaryFieldId 跳过、由 `collectPrimaryTitle`
		* 单独渲染；grid-list 单行从左到右只有一段中段，无对应「primary 行」概念，所以采取
		* 「把主列塞到 visible 列表第一项」的方式由统一的左侧 flex 布局负责绘制，逻辑更收敛。
		*/ _proto.getVisibleLeftFieldIds = function getVisibleLeftFieldIds() {
			var primaryId = this.dataUtil.getPrimaryFieldId();
			var ordered = [];
			if (primaryId) ordered.push(primaryId);
			for (var id of this.dataUtil.getLeftFieldIds()) if (id !== primaryId) ordered.push(id);
			return ordered.filter((id) => this.visibleFieldIdSet.has(id));
		};
		/**
		* 行内「标签组」字段的 fieldId 列表，按 `tagFieldTitles` 声明顺序，
		* 并已与 `dataUtil.getVisibleFieldIds()` 取交集。`collectBodyTag` 应使用此结果。
		*
		* 与 `getVisibleLeftFieldIds()` 解耦：tagFieldTitles 不参与左侧 flex 布局循环，
		* 专供 content collector 在主列渲染（含 statusIcon 装饰）之后作为独立段插入。
		*
		* @param recordId 可选；传入时在结果末尾会额外剔除「当前 record 优先级为无（rawText 为空）」
		*   的 sys_priority fieldId —— 这是 grid-list 特有业务约定「优先级为无则不展示」；
		*   不传时则按列可见性给出完整列表（用于列级布局判断等无关 record 的场景）。
		*/ _proto.getVisibleBodyTagFieldIds = function getVisibleBodyTagFieldIds(recordId) {
			var excludeIds = /* @__PURE__ */ new Set();
			if (this.hasBottomStatusField) excludeIds.add(this.bottomStatusFieldId);
			if (recordId !== void 0 && this.hasPriorityField && this.isPriorityEmptyForRecord(recordId)) excludeIds.add(this.priorityFieldId);
			return this.bodyTagFieldIds.filter((id) => this.visibleFieldIdSet.has(id) && !excludeIds.has(id));
		};
		/**
		* sys_tags 字段是否配置且在 visible 集合中。
		*
		* content collector 据此判断当前行是否需要追加「独立 sys_tags 段」——
		* 命中且数据非空时，在主列附属的 body tag row 段之后再插入 `collectTagsPillsInRect` 收集的 pill 段；
		* 未命中 / 不可见 / 数据为空时整段跳过、不占位。
		*/ _proto.isSysTagsFieldVisible = function isSysTagsFieldVisible() {
			return this.hasSysTagsField && this.visibleFieldIdSet.has(this.sysTagsFieldId);
		};
		/** sys_tags 字段 fieldId（''=未命中） */ _proto.getSysTagsFieldId = function getSysTagsFieldId() {
			return this.sysTagsFieldId;
		};
		/**
		* 判定 `fieldId` 是否为来源列（sys_source）。来源列只读，hover 命中其 body tag pill 时
		* cursor 应保持 DEFAULT（不支持修改 / 编辑）。未命中来源字段时恒为 false。
		*/ _proto.isSourceFieldId = function isSourceFieldId(fieldId) {
			return this.hasSourceField && fieldId === this.sourceFieldId;
		};
		/**
		* 取 sys_tags 单元格（用于喂给 `resolveTagsCellItems` 解析出 BodyTagItem[]）。
		* 未命中 sys_tags 字段时返回 undefined，调用方按"无数据"分支处理（不渲染独立段）。
		*/ _proto.getSysTagsCell = function getSysTagsCell(recordId) {
			if (!this.hasSysTagsField) return;
			return this.dataUtil.getStandardCell(this.sysTagsFieldId, recordId);
		};
		/**
		* 取得人员列单元格中的用户列表，未命中 / cell 空时返回 []。
		* 与 kanban-todo state 等价。
		*/ _proto.getOwnerUsers = function getOwnerUsers(recordId) {
			var _a;
			if (!this.hasOwnerField) return [];
			var cell = this.dataUtil.getStandardCell(this.ownerFieldId, recordId);
			return (_a = cell === null || cell === void 0 ? void 0 : cell.data) !== null && _a !== void 0 ? _a : [];
		};
		/**
		* 取得日期列时间戳，未命中 / cell 空 / 时间戳非正时返回 undefined。
		* 与 kanban-todo state 等价。
		*/ _proto.getDateTimestamp = function getDateTimestamp(recordId) {
			var _a;
			if (!this.hasDateField) return;
			var cell = this.dataUtil.getStandardCell(this.dateFieldId, recordId);
			var first = (_a = cell === null || cell === void 0 ? void 0 : cell.data) === null || _a === void 0 ? void 0 : _a[0];
			if (!first) return;
			if (typeof first.timestamp === "number" && first.timestamp > 0) return first.timestamp;
		};
		/**
		* 取 date 列单元格「完整时间展示文本」（field.format 已格式化好的绝对时间，如 `2026-06-25 19:53`）。
		*
		* 用于 hover-tooltip：卡片底部/行右侧渲染的是"5 分钟前 / 刚刚"这类相对时间，hover 时需要
		* 展开为「完整时间」以帮用户核对。与 `wb-cell.ts` 的绝对时间收集路径同源
		* （都读 `standardCell.data[0].text`），保证 tooltip 展示与列原生 DateTime 渲染视觉一致。
		*
		* 未命中 date 列 / cell 空 / text 空时返回 ''。
		*/ _proto.getDateFullText = function getDateFullText(recordId) {
			if (!this.hasDateField) return "";
			return getDateCellFullText(this.dataUtil.getStandardCell(this.dateFieldId, recordId));
		};
		/**
		* 底部状态列单元格的展示文本：先读 `cell.data[0].text` 拿到 matchValue（如 `pending/running/...`），
		* 再经 `mapGroupValueToDisplayTitle` 映射为 head 分组头同款展示 title（如「待开始」「进行中」），
		* 与 kanban-todo 卡片底部 status 文案完全同源。
		*
		* 未配置 / 找不到列 / 单元格为空时返回 ''；未命中 keyConf.matchValue 也无 groupTextMap 命中时
		* 回落到原始文本。
		*/ _proto.getBottomStatusText = function getBottomStatusText(recordId) {
			if (!this.hasBottomStatusField) return "";
			var rawText = readCellText(this.dataUtil, this.bottomStatusFieldId, recordId);
			if (!rawText) return "";
			return mapGroupValueToDisplayTitle(this.dataUtil.getFieldByFieldId(this.bottomStatusFieldId), rawText);
		};
		/**
		* 行级 status 列对应的 keyConf（用于在行最左渲染状态装饰 icon / dot）。
		*
		* 与 head 分组头 `resolveGroupKeyConf` 走同一条链路：rawText → applyGroupTextMap → resolveGroupKeyConf，
		* 保证「行内 status icon」与「分组头同语义 group icon」颜色 / 图标完全一致。
		*
		* 未配置 status 列 / 行 rawText 为空 / 未命中 keyConf 时返回 undefined，调用方按"无 icon"分支处理。
		*/ _proto.getBottomStatusKeyConf = function getBottomStatusKeyConf(recordId) {
			if (!this.hasBottomStatusField) return;
			var rawText = readCellText(this.dataUtil, this.bottomStatusFieldId, recordId);
			if (!rawText) return;
			var field = this.dataUtil.getFieldByFieldId(this.bottomStatusFieldId);
			return resolveGroupKeyConf(field, applyGroupTextMap(field, rawText));
		};
		_proto.isDateLikeField = function isDateLikeField(field) {
			var type = field.getType();
			return type === FieldType.DATE_TIME || type === FieldType.CREATED_TIME || type === FieldType.MODIFIED_TIME;
		};
		/**
		* 把任意层级的分组 path 解析为"该层下所有子孙叶子分组的 record 并集"。
		*
		* `getGroupFlatten` 只产出叶子分组（最内层），其 path 长度等于分组层级总数。
		* 对外层 / 中间层 path，按"叶子.path 以 `path` 为前缀（同长度也算）"的规则聚合。
		* 越界 / 找不到时返回 []。
		*
		* 关于去重：同一个 recordId 不会出现在多个叶子分组里（叶子分组是「分组键值组合」的最细划分，
		* 每条 record 唯一归属一个叶子），所以这里直接 concat 即可，无需 Set。
		*/ _proto.collectRecordIdsByPathPrefix = function collectRecordIdsByPathPrefix(path) {
			var flatten = this.dataUtil.getGroupFlatten();
			if (path.length === 0) return flatten.flatMap((g) => {
				var _a;
				return (_a = g.recordIds) !== null && _a !== void 0 ? _a : [];
			});
			var ids = [];
			for (var g of flatten) if (this.isPathPrefix(path, g.path)) {
				var sub = g.recordIds;
				if (sub && sub.length) for (var j = 0; j < sub.length; j++) ids.push(sub[j]);
			}
			return ids;
		};
		/** `prefix` 是否是 `full` 的前缀（同长度也算）；逐项 `===` 比较。 */ _proto.isPathPrefix = function isPathPrefix(prefix, full) {
			if (prefix.length > full.length) return false;
			for (var i = 0; i < prefix.length; i++) if (prefix[i] !== full[i]) return false;
			return true;
		};
		/**
		* 从 localStorage 恢复折叠态；仅在首次 `buildIndex` 时执行一次（`foldStateLoaded` 门闩）。
		*
		* 三层失效校验（任一命中即视缓存无效、不恢复任何折叠态并清空存储 key）：
		*
		* 1) JSON 解析失败 / 结构不符（旧版本纯数组 payload、手动改坏等）：直接放弃。
		* 2) 分组签名不一致（用户改了「分组依据」字段）：旧 key 天然对不上，硬套会误折叠新分组，
		*    直接整条作废。
		* 3) 分组数据当前不存在（`stringifyGroupPath` 后对不上任何叶子/前缀）：说明对应分组值已被
		*    删除 / 隐藏 —— 与合法 path 集合取交集，剔除死 key。清洗后剩余非空的部分才进入内存。
		*
		* 清洗完成后立刻回写一次 storage，避免死 key 永久滞留（用户不再触发 save 也能收敛）。
		*/ _proto.loadFoldStateIfNeeded = function loadFoldStateIfNeeded() {
			if (this.foldStateLoaded) return;
			this.foldStateLoaded = true;
			var raw = getStorageValue(this.dataUtil.getContext(), GridListStorageType.FoldGroup);
			if (!raw) return;
			var payload;
			try {
				var parsed = JSON.parse(raw);
				if (isFoldStoragePayload(parsed)) payload = parsed;
			} catch (_e) {}
			if (!payload) {
				setStorageValue(this.dataUtil.getContext(), GridListStorageType.FoldGroup, "");
				return;
			}
			var currentSignature = this.computeGroupSignature();
			if (payload.signature !== currentSignature) {
				setStorageValue(this.dataUtil.getContext(), GridListStorageType.FoldGroup, "");
				return;
			}
			var validPathKeys = this.collectAllValidPathKeys();
			var changed = false;
			for (var key of payload.paths) if (validPathKeys.has(key)) this.foldGroups.add(key);
			else changed = true;
			if (changed) this.saveState();
		};
		/**
		* 当前「分组签名」：把 `dataUtil.getGroupFields()` 里每个字段的 title 按顺序用 `|` 拼接。
		*
		* 使用 title 而非某个内部 id：
		* - core 的 IField 稳定对外暴露的是 `getTitle()`；
		* - 分组维度换列 / 换顺序（真正的"分组依据变化"）必然导致 title 序列变化 → 缓存失效；
		* - 用户罕见的重命名场景下，改名后视为分组维度语义变化、缓存作废，也是可接受兜底
		*   （比自作聪明地在多种情况下坚持恢复更安全，避免"名字都变了还按老 key 折叠"的诡异体验）。
		*
		* 无分组时返回空串，其对应的 foldGroups 也天然是空，语义自洽。
		*/ _proto.computeGroupSignature = function computeGroupSignature() {
			return this.dataUtil.getGroupFields().map((f) => f.getTitle()).join("|");
		};
		/**
		* 枚举「当前分组树下所有可能被折叠的路径 key」集合，供 load 时做交集清洗。
		*
		* 必须遍历规范化分组树 `getGroupTree()` 而非 `getGroupFlatten()`：
		* - `getGroupFlatten()` 走 core 原始 `getGroupLayoutInfos()`，**不含记录数为 0 的空分组**
		*   （由 `WbSharedConfig.head.groupBys` 补齐出的虚拟分组 / placeholder 只存在于 normalizedGroupTree）；
		*   若沿用它清洗，空分组（如「已暂停 0」）的折叠 key 会被当成死 key 剔除，导致空分组折叠态
		*   无法本地记忆（刷新后又展开）。
		* - `getGroupTree()` 是渲染 GroupHead 时实际消费的规范化树，含空分组，与折叠 key 的产生源一致。
		*
		* 用户可以折叠任意层级（非叶子 GroupHead 也能点折叠按钮），所以对每个分组节点，
		* 把它 path 的所有非空前缀都算进去。
		*
		* 例：某节点 path = `['A', 'B', 'C']`，则合法 key 集合应包含 `stringify(['A'])`、
		* `stringify(['A','B'])`、`stringify(['A','B','C'])`。
		*
		* 无分组时返回空 Set。
		*/ _proto.collectAllValidPathKeys = function collectAllValidPathKeys() {
			var keys = /* @__PURE__ */ new Set();
			var walk = (nodes) => {
				for (var node of nodes) {
					if (typeof node === "string" || !isFormattedTreeNode(node)) continue;
					var { path, children } = node;
					if (path === null || path === void 0 ? void 0 : path.length) for (var i = 1; i <= path.length; i++) keys.add(stringifyGroupPath(path.slice(0, i)));
					walk(children);
				}
			};
			walk(this.dataUtil.getGroupTree());
			return keys;
		};
		/**
		* 当前 record 的 sys_priority 是否为空（rawText 空 / 数据缺失）。
		*
		* 用于 `getVisibleBodyTagFieldIds(recordId)` 的 grid-list 特有过滤，
		* 判定语义与 `wb-cell.resolveBodyTagItem` 的 sys_priority 空数据分支完全同源
		* （都是判定 `standardCell.data[0].text` 是否为空）。
		*/ _proto.isPriorityEmptyForRecord = function isPriorityEmptyForRecord(recordId) {
			if (!this.hasPriorityField) return true;
			return !readCellText(this.dataUtil, this.priorityFieldId, recordId);
		};
		/**
		* 用 `dataUtil.getAllRecordIds()` 剪裁 `batch` 中已不存在的 recordId。
		*
		* - 不会因删除某一条选中而影响其余仍存在的选中项；
		* - 有变化时会通过 `batch` 内的 emitter fire 一次最新选中数组，
		*   让外部订阅者（例如 SDK 底部工具栏「已选 N 项」显示）自然更新；
		* - 无 phantom 时静默返回，不搅动外部订阅者。
		*
		* 调用点：`buildIndex()` 末尾。collect / patch 完成后 view 层的 record 全集
		* 已反映最新状态（含批量删除结果），此时剪裁一次最经济且无遗漏。
		*/ _proto.pruneSelectedRecordIds = function pruneSelectedRecordIds() {
			var existing = new Set(this.dataUtil.getAllRecordIds());
			this.batch.pruneByExistingIds(existing);
		};
		return StateCenter;
	}(BaseStateCollector);
	/**
	* 「被折叠的父记录 id 集合」空 Set 单例。
	*
	* runGroupTree（grid 侧共享工具）在叶子层会调用 `state.getFoldSubTreeRecordIds()` 拿到
	* 折叠父记录集合、再用 `dataUtil.filterFoldedSubTreeRecordIds` 剔除被祖先折叠的子记录。
	*
	* list 视图目前**未接入**父子记录折叠交互（不像 grid 有折叠三角与本地存储），此处返回
	* 一个空 Set 作为鸭子接口占位，让 runGroupTree 在 list 场景下走「过滤集合为空→原样返回」
	* 的零开销分支。未来 list 若接入父子折叠，把它替换为真实可变集合并新增 setter / toggle 即可。
	*
	* 曾经缺失此方法 + `row.ts` 调用 runGroupTree 时漏传 dataUtil 参数错位，导致
	* `trees.forEach is not a function`（详见 row.ts 修复注释）。
	*/ StateCenter.EMPTY_FOLD_SUB_TREE_IDS = /* @__PURE__ */ new Set();
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/collector/index.js
function _inherits$2(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function");
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		writable: true,
		configurable: true
	} });
	if (superClass) _set_prototype_of$2(subClass, superClass);
}
function _set_prototype_of$2(o, p) {
	_set_prototype_of$2 = Object.setPrototypeOf || function setPrototypeOf(o, p) {
		o.__proto__ = p;
		return o;
	};
	return _set_prototype_of$2(o, p);
}
var ListCollector;
var init_collector = __esmMin((() => {
	init_collector$1();
	init_content();
	init_data_util();
	init_range();
	init_row();
	init_size();
	init_state();
	ListCollector = /* @__PURE__ */ function(BaseCollector) {
		"use strict";
		_inherits$2(ListCollector, BaseCollector);
		function ListCollector(context) {
			var _this = BaseCollector.call(this, context) || this;
			_this.context = context;
			_this.dataUtil = _this._register(new DataUtil(_this.context));
			_this.state = _this._register(new StateCenter(_this.dataUtil));
			_this.size = _this._register(new SizeCollector(_this.dataUtil));
			_this.rows = _this._register(new RowCollector(_this.dataUtil, _this.size, _this.state));
			_this.range = _this._register(new RangeCollector(_this.size, _this.rows));
			_this.content = _this._register(new ContentCollector(_this.dataUtil, _this.state, _this.size, _this.rows, _this.range));
			return _this;
		}
		var _proto = ListCollector.prototype;
		_proto.handleCollect = function handleCollect() {
			this.dataUtil.buildShowFieldIds();
			this.dataUtil.normalizeGroupTreeByWbConfig();
			this.dataUtil.buildSubTreeMeta();
			this.state.buildIndex();
			this.size.collect();
			this.rows.collect();
			this.range.collect();
			this.content.collect();
		};
		_proto.handlePatch = function handlePatch(_mutations) {
			this.dataUtil.buildShowFieldIds();
			this.dataUtil.normalizeGroupTreeByWbConfig();
			this.dataUtil.buildSubTreeMeta();
			this.state.buildIndex();
			this.size.patch();
			this.rows.patch();
			this.range.patch();
			this.content.patch();
		};
		_proto.handleResize = function handleResize(scale) {
			this.size.setScale(scale);
			this.size.patch();
			this.rows.patch();
			this.range.patch();
			this.content.patch();
		};
		return ListCollector;
	}(BaseCollector);
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/renderer-model/index.js
function _inherits$1(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function");
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		writable: true,
		configurable: true
	} });
	if (superClass) _set_prototype_of$1(subClass, superClass);
}
function _set_prototype_of$1(o, p) {
	_set_prototype_of$1 = Object.setPrototypeOf || function setPrototypeOf(o, p) {
		o.__proto__ = p;
		return o;
	};
	return _set_prototype_of$1(o, p);
}
var import_lodash, ListRendererModel;
var init_renderer_model = __esmMin((() => {
	init_event();
	import_lodash = require_lodash();
	init_interface$6();
	init_collector();
	init_base_renderer_model();
	ListRendererModel = /* @__PURE__ */ function(BaseRendererModel) {
		"use strict";
		_inherits$1(ListRendererModel, BaseRendererModel);
		function ListRendererModel(context) {
			var _this = BaseRendererModel.call(this, context) || this;
			_this.context = context;
			_this.onRenderModelChangeEmitter = _this._register(new Emitter());
			_this.collector = _this._register(new ListCollector(_this.context));
			_this.onRenderModelChange = _this.onRenderModelChangeEmitter.event;
			_this.collector.collect();
			_this._register(_this.collector.content.onContentChange(() => {
				_this.onRenderModelChangeEmitter.fire();
			}));
			_this._register(_this.collector.range.onScroll(() => {
				_this.collector.content.collectVisible();
				_this.onRenderModelChangeEmitter.fire();
			}));
			return _this;
		}
		var _proto = ListRendererModel.prototype;
		_proto.scrollToY = function scrollToY(scrollTop) {
			this.collector.range.scrollToY(scrollTop);
		};
		_proto.scrollByDelta = function scrollByDelta(deltaY) {
			this.collector.range.scrollByDelta(deltaY);
		};
		/**
		* 批量设置分组折叠态。
		*
		* 与 grid 视图 `GridRendererModel.setGroupFold` 语义对齐：
		* - 不带 `groupKeys` 时视为「操作所有分组」，先 clearGroupFold 清空当前折叠集合，
		*   再遍历所有 GroupHead 按 `fold` 统一写入；避免残留旧 key 造成状态漂移；
		* - 带 `groupKeys` 时只对匹配的 GroupHead path 执行 setGroupFoldState；
		* - 折叠状态变化会改变行高，与 hover feature 里点击折叠按钮的路径保持一致：
		*   rows/range/content 全量 patch，然后统一 fire 一次 render 事件。
		*
		* list 视图没有 grid 的选区 / ActivePoint 概念，因此不需要 grid 里
		* `resetSelectionIfActivePointInFoldGroups` 的前置处理。
		*/ _proto.setGroupFold = function setGroupFold(option) {
			if (!this.collector.dataUtil.hasGroup()) return;
			var { rows, state, range, content } = this.collector;
			var { fold, groupKeys } = option;
			var groupHeads = rows.getTypeRows(RowType.GroupHead);
			if (!groupKeys) {
				state.clearGroupFold();
				groupHeads.forEach((rowInfo) => {
					if (rowInfo.path) state.setGroupFoldState(rowInfo.path, fold);
				});
			} else groupHeads.forEach((rowInfo) => {
				if (rowInfo.path && groupKeys.some((keys) => (0, import_lodash.isEqual)(keys, rowInfo.path))) state.setGroupFoldState(rowInfo.path, fold);
			});
			rows.patch();
			range.patch();
			content.patch();
			this.onRenderModelChangeEmitter.fire();
		};
		_proto.handleModelChange = function handleModelChange(mutations) {
			this.collector.patch(mutations);
			this.onRenderModelChangeEmitter.fire();
		};
		return ListRendererModel;
	}(BaseRendererModel);
}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/wb_views/grid-list/index.js
function _inherits(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function");
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		writable: true,
		configurable: true
	} });
	if (superClass) _set_prototype_of(subClass, superClass);
}
function _set_prototype_of(o, p) {
	_set_prototype_of = Object.setPrototypeOf || function setPrototypeOf(o, p) {
		o.__proto__ = p;
		return o;
	};
	return _set_prototype_of(o, p);
}
var ListView;
var init_grid_list = __esmMin((() => {
	init_esm();
	init_es$1();
	init_canvas_view();
	init_entries();
	init_renderer();
	init_renderer_model();
	ListView = /* @__PURE__ */ function(BaseCanvasView) {
		"use strict";
		_inherits(ListView, BaseCanvasView);
		function ListView(context) {
			var _this = BaseCanvasView.call(this, context) || this;
			_this.initFeatures();
			return _this;
		}
		var _proto = ListView.prototype;
		_proto.getType = function getType() {
			return ViewType.LIST;
		};
		_proto.initFeatures = function initFeatures() {
			if (!ua.isPC) return;
			getPcFeatures().forEach((featureOption) => this.installFeature(featureOption));
		};
		_proto.render = function render() {
			this.renderer.render();
		};
		_proto.getFeatureLayer = function getFeatureLayer() {
			return this.renderer.getFeatureLayer();
		};
		_proto.setStickyHead = function setStickyHead(index, offsetY) {
			this.renderer.setStickyHead(index, offsetY);
		};
		_proto.getStickyHead = function getStickyHead() {
			return this.renderer.getStickyHead();
		};
		_proto.scrollToY = function scrollToY(scrollTop) {
			this.rendererModel.scrollToY(scrollTop);
		};
		_proto.isGroupFolded = function isGroupFolded(groupKey) {
			return this.collector.state.isGroupFold(groupKey);
		};
		/**
		* 是否所有（顶层）分组都处于折叠态。
		* 供外层判断「全部折叠 / 全部展开」按钮的当前态；无分组时返回 false。
		*/ _proto.isAllGroupFold = function isAllGroupFold() {
			return this.collector.state.isAllGroupFold();
		};
		_proto.setGroupFold = function setGroupFold(option) {
			return this.rendererModel.setGroupFold(option);
		};
		/**
		* 读取当前批量选中的 recordId 列表（拷贝，外部改动不影响内部集合）。
		*
		* 供外部 SDK 读取「当前 grid-list 选中了哪些 record」；实际数据来自
		* `collector.state`（内部由 shared `BatchSelection` 维护），顺序为插入序、不保证与视觉行序一致。
		*/ _proto.getSelectedRecordIds = function getSelectedRecordIds() {
			return this.collector.state.getSelectedRecordIds();
		};
		/**
		* 进入 / 退出批量选择模式。与 kanban-todo `setBatchSelectMode` 行为对齐：
		*
		* - 进入（enable=true）：Record 行左侧无论是否 hover 都常驻 checkbox 占位；
		*   该状态由 content collector 在 `collectRecord` 中绘制 `getCheckboxIconAlias(false)`（未选）或
		*   `CHECKBOX_CHECK_GREEN`（已选），同时把中段字段整体右移 `checkboxSize + checkboxGap`；
		* - 退出（enable=false）：清空已选集合，回退到 hover-only 的 checkbox 行为。
		*
		* 方法内部会触发一次 collectVisible + render，调用方无需再手动刷新。
		*/ _proto.setBatchSelectMode = function setBatchSelectMode(enable) {
			this.collector.state.setBatchSelectMode(enable);
			this.collector.content.collectVisibleWithHeads();
			this.render();
		};
		/**
		* 设置 active 态记录（外部主动高亮某条记录，如详情面板/其他视图联动定位）。
		* - 传入有效 recordId：将该行置为 active（复用 selected 背景色、独立圆角、无 checkbox）；
		* - 传入 ''：清除 active 态。
		*
		* 覆盖 BaseCanvasView 的默认实现（默认走 activedRecordChanged 事件）：grid-list 自己维护
		* 一套独立的 active 视觉状态（与 selected 互斥、selected 优先），因此改为写入 state 后
		* 重新收集 records（仅影响 record 段，不涉及 heads）并 render，调用方无需再手动刷新。
		*/ _proto.setActiveRecord = function setActiveRecord(recordId) {
			this.collector.state.setActiveRecordId(recordId);
			this.collector.content.collectVisible();
			this.render();
		};
		/**
		* BaseCanvasView 抽象方法：命中 hit-test，直接转发到 renderer。
		* 在签名层面父类要求返回多种 Target 联合类型；list 返回 ListTarget，做一次结构转换以满足类型。
		*/ _proto.getTarget = function getTarget(x, y) {
			return this.renderer.getTarget(x, y);
		};
		_proto.createRendererModel = function createRendererModel() {
			return new ListRendererModel(this.context);
		};
		_proto.createRenderer = function createRenderer() {
			return new ListRenderer(this.rendererModel, this.context.getRenderRoot());
		};
		/**
		* BaseCanvasView 抽象方法：滚动 delta。
		* list 视图只关心 deltaY，deltaX 永远忽略（无横向滚动）。
		*/ _proto.scrollByDelta = function scrollByDelta(scrollInfo) {
			var { deltaY } = scrollInfo;
			if (!deltaY) return;
			this.rendererModel.scrollByDelta(deltaY);
		};
		return ListView;
	}(BaseCanvasView);
}));
//#endregion
export { init_grid_list as n, ListView as t };
