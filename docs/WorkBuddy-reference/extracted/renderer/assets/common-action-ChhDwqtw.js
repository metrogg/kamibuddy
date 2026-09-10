import { n as __esmMin, s as __toESM } from "./rolldown-runtime-D5a2oYpF.js";
import { Cn as require_main } from "./dist-C0RQhKFs.js";
import { Dl as FieldType, _d as i18n, au as openLocationPage, dd as require_Snackbar, sd as domainConfig, tu as init_es } from "./registry-C3gPA5CG.js";
import { a as init_es$1 } from "./render-app-config-NYjyHqfI.js";
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/views/shared/utils/binary-search.js
function binarySearch(currentOffset, minIndex, maxIndex, getOffset) {
	var low = minIndex;
	var high = maxIndex;
	var middle = 0;
	var middleOffset = 0;
	while (low <= high) {
		middle = low + Math.floor((high - low) / 2);
		middleOffset = getOffset(middle);
		if (middleOffset === currentOffset) return middle;
		if (middleOffset < currentOffset) low = middle + 1;
		else if (middleOffset > currentOffset) high = middle - 1;
	}
	return low > 0 ? low - 1 : 0;
}
var init_binary_search = __esmMin((() => {}));
//#endregion
//#region ../../node_modules/.pnpm/@tencent+xtable-view@1.1007_648076c24e236ffb5e3afc27bb88d605/node_modules/@tencent/xtable-view/es/views/shared/abstract/renderer/common-action.js
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
var import_main, import_Snackbar, CommonAction;
var init_common_action = __esmMin((() => {
	import_main = require_main();
	import_Snackbar = /* @__PURE__ */ __toESM(require_Snackbar());
	init_es();
	init_es$1();
	CommonAction = /* @__PURE__ */ function(Disposable) {
		"use strict";
		_inherits(CommonAction, Disposable);
		function CommonAction(context, dataUtil) {
			var _this = Disposable.call(this) || this;
			_this.context = context;
			_this.dataUtil = dataUtil;
			return _this;
		}
		var _proto = CommonAction.prototype;
		/**
		* 点击单元格复选框
		*/ _proto.toggleCellCheckbox = function toggleCellCheckbox(fieldId, recordId) {
			var field = this.dataUtil.getFieldByFieldId(fieldId);
			if ((field === null || field === void 0 ? void 0 : field.type) === FieldType.FORMULA) {
				import_Snackbar.Snackbar.show({
					type: "info",
					duration: 3e3,
					message: `${i18n.t("公式计算结果不可直接编辑")}`
				});
				return;
			}
			var currentTable = this.dataUtil.getCurrentTable();
			var currentView = this.dataUtil.getCurrentView();
			var standardCell = this.dataUtil.getStandardCell(fieldId, recordId);
			if (this.context.customConfig || !currentTable || !currentView || !standardCell) return;
			var { checked } = standardCell.data[0];
			var delta = {};
			delta[fieldId] = { value: !checked };
			if (!this.dataUtil.getContext().getCore().permissionService.getPermissionStatus("canEditCell", {
				tableId: currentTable.id,
				viewId: currentView.id,
				recordId,
				fieldId
			})) return;
			this.context.getBehaviorApi().setRecord({
				recordId,
				delta,
				tableId: currentTable.id,
				viewId: currentView.id
			});
		};
		/**
		* 打开单元格链接
		*/ _proto.openCellLink = function openCellLink(fieldId, recordId) {
			var _a;
			var standardCell = this.dataUtil.getStandardCell(fieldId, recordId);
			if (!standardCell) return;
			var field = this.dataUtil.getFieldByFieldId(fieldId);
			if ((field === null || field === void 0 ? void 0 : field.type) === FieldType.LOCATION) {
				var locationInfo = standardCell.data[0].location;
				openLocationPage(locationInfo);
				return;
			}
			var url = (_a = standardCell.data[0].link) !== null && _a !== void 0 ? _a : "";
			if (url) domainConfig.openUrl(url);
		};
		/**
		* 在指定位置显示 tooltip
		*/ _proto.showToolTip = function showToolTip(title, rect, config) {
			if (!title) return;
			var scale = (config === null || config === void 0 ? void 0 : config.stopAutoScale) ? 1 : this.getScale();
			var defaultProps = {
				title,
				visible: true,
				placement: "top",
				containerOffsetX: rect.x * scale,
				containerOffsetY: rect.y * scale
			};
			var param = Object.assign(Object.assign({}, config), { props: Object.assign(Object.assign({}, defaultProps), config === null || config === void 0 ? void 0 : config.props) });
			if (rect.height && rect.width) param.size = {
				width: rect.width * scale,
				height: rect.height * scale
			};
			this.context.emitter.service.tooltip.fire(param);
		};
		/**
		* 隐藏 tooltip
		*/ _proto.hideToolTip = function hideToolTip() {
			this.context.emitter.service.tooltip.fire({ hide: true });
		};
		/**
		* 打开展开行
		*
		* wb 宿主下不走内置的展开浮层（`service.expandRow`），改为通知外部 `wbService.onRecordClick`，
		* 由 wb 侧自行决定如何响应（一般是打开 wb 的 record 详情面板）。这样所有触发「展开行」的入口
		* （行展开按钮、键盘快捷键、菜单等）都能统一切换到 wb 通道，调用方无需各自判断 `getIsWb()`。
		*/ _proto.expandRow = function expandRow(recordId, options) {
			if (domainConfig.getIsWb()) {
				this.context.emitter.wbService.onRecordClick.fire({ recordId });
				return;
			}
			this.context.emitter.service.expandRow.fire(Object.assign({ recordId }, options));
		};
		/**
		* 隐藏展开行
		*/ _proto.hideExpandRow = function hideExpandRow() {
			this.context.emitter.service.expandHideRow.fire({});
		};
		return CommonAction;
	}(import_main.Disposable);
}));
//#endregion
export { init_binary_search as i, init_common_action as n, binarySearch as r, CommonAction as t };
