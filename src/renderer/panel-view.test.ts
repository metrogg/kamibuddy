import { describe, expect, it } from "vitest";
import {
	closeLastTab,
	closeTab,
	initialPanelViewState,
	openPreview,
	selectView,
	type PanelViewState,
} from "./panel-view.ts";

const listOverview: PanelViewState = { view: "overview", mode: "list" };
const listWorkspace: PanelViewState = { view: "workspace", mode: "list" };
const previewOverview: PanelViewState = { view: "overview", mode: "preview" };
const previewChanges: PanelViewState = { view: "changes", mode: "preview" };

describe("初始态", () => {
	it("默认 = 概览列表态（spec：列表态即默认主体）", () => {
		expect(initialPanelViewState).toEqual({ view: "overview", mode: "list" });
	});
});

describe("selectView：切换器选视图", () => {
	it("列表态切到另一视图 → 列表态新视图", () => {
		expect(selectView(listOverview, "changes")).toEqual({ view: "changes", mode: "list" });
	});

	it("预览态切视图 → 回列表态（tabs 保留语义：只翻主体，不动 tab 集合）", () => {
		expect(selectView(previewOverview, "workspace")).toEqual({ view: "workspace", mode: "list" });
	});

	it("列表态选当前视图 → 仍是该视图列表态", () => {
		expect(selectView(listWorkspace, "workspace")).toEqual({ view: "workspace", mode: "list" });
	});
});

describe("openPreview：点条目进预览", () => {
	it("列表态 → 预览态，view 不变", () => {
		expect(openPreview(listWorkspace)).toEqual({ view: "workspace", mode: "preview" });
	});

	it("预览态再进预览 → 幂等", () => {
		expect(openPreview(previewChanges)).toEqual({ view: "changes", mode: "preview" });
	});
});

describe("closeLastTab：关最后一个 tab", () => {
	it("预览态 → 列表态，view 不变（保持切换器当前所选视图）", () => {
		expect(closeLastTab(previewChanges)).toEqual({ view: "changes", mode: "list" });
	});

	it("列表态 → 幂等", () => {
		expect(closeLastTab(listOverview)).toEqual({ view: "overview", mode: "list" });
	});
});

describe("closeTab：关 tab 但还有剩余", () => {
	it("预览态 → 预览态不变", () => {
		expect(closeTab(previewOverview)).toBe(previewOverview);
	});

	it("列表态 → 列表态不变（列表态关 tab 不被拽回预览）", () => {
		expect(closeTab(listWorkspace)).toBe(listWorkspace);
	});
});

describe("组合路径", () => {
	it("点条目 → 切视图 → 点 tab 回预览 → 关全部 tab 回列表", () => {
		let s = initialPanelViewState;
		s = openPreview(s); // 概览点产物
		expect(s).toEqual({ view: "overview", mode: "preview" });
		s = selectView(s, "workspace"); // 预览态切工作空间文件
		expect(s).toEqual({ view: "workspace", mode: "list" });
		s = openPreview(s); // 点 tab 条上的 tab 回预览
		expect(s).toEqual({ view: "workspace", mode: "preview" });
		s = closeLastTab(s); // 关最后一个 tab
		expect(s).toEqual({ view: "workspace", mode: "list" });
	});
});
