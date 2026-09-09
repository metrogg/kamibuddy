/**
 * 右侧面板「视图 × 主体」状态机（spec fix-panel-view-hierarchy）。
 *
 * 视图三平级（概览 / 工作空间文件 / 变更），主体双态：列表 / 预览。
 * 为什么是双态而不是「三视图 + 预览」四态平级：预览是工作区、列表是
 * 导航 —— WorkBuddy DetailPanel 同构：切视图回列表，但 tabs 留在
 * tab 条上可点回预览。若预览是第四个平级视图，切换器菜单就得有
 * 「预览」项，而预览内容由 tabs 决定、无法从菜单构造，语义不通。
 *
 * tabs 与激活项由 App 侧持有（openPreview/openFile/closePreviewTab），
 * 本状态机只管面板自己的视图与主体双态 —— 纯函数、零依赖，便于单测。
 * renderer 内部模型，不走 IPC，不进 shared。
 */

export type PanelView = "overview" | "workspace" | "changes";

export type BodyMode = "list" | "preview";

export interface PanelViewState {
	readonly view: PanelView;
	readonly mode: BodyMode;
}

/** 默认态：概览列表（spec：列表态即默认主体，不再是「选择文件以预览」占位）。 */
export const initialPanelViewState: PanelViewState = { view: "overview", mode: "list" };

/** 切换器选视图：任何态 → 该视图的列表态（tabs 不动，点 tab 可回预览）。 */
export function selectView(state: PanelViewState, view: PanelView): PanelViewState {
	return { view, mode: "list" };
}

/** 点条目 / 点 tab / 外部打开 → 预览态，view 不变（再切视图后回列表仍是原视图）。 */
export function openPreview(state: PanelViewState): PanelViewState {
	return { ...state, mode: "preview" };
}

/** 关掉最后一个 tab → 列表态，view 不变（spec：保持切换器当前所选视图）。 */
export function closeLastTab(state: PanelViewState): PanelViewState {
	return { ...state, mode: "list" };
}

/** 关 tab 但还有剩余：主体态不变 —— 预览态留预览，列表态也不该被拽回预览。 */
export function closeTab(state: PanelViewState): PanelViewState {
	return state;
}
