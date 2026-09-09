/**
 * 预览面板「工作区文件」目录树：树结构 + 懒加载状态机（纯逻辑，无 React 依赖）。
 *
 * 为什么放 renderer 侧纯函数：数据源是 completions 通道一次性给全的平铺 posix
 * 相对路径（shared/ipc.ts CompletionData.files，file-index 的产物），建树、展开、
 * 折叠都是同步纯逻辑，可直接跑 vitest（同 session-groups / ime-guard 的惯例）；
 * React 组件只渲染 flattenTree 的结果（UI 在下一个任务落地）。
 *
 * 与 WorkBuddy 机制的对应（docs/workbuddy分析/07-artifact-preview.md）：
 * WorkBuddy 的文件树是真分页——首屏拉 depth=2，展开文件夹再拉 depth=1 子层。
 * KamiBuddy 的索引一次性给全（file-index maxEntries 上限 2000），这里的「懒加载」
 * 因而是状态机上的渐进展开而非数据拉取：loadedPaths / loadingPaths 保留
 * 「已加载 / 加载中」语义。将来条目数突破索引上限需要真分页时，只换 finishLoad
 * 背后的数据获取，状态机与「转圈 → 展开」的交互不变。
 *
 * 异步接线（本文件刻意不写 setTimeout，保持纯逻辑可测）：UI 层在 expandFolder
 * 之后用 setTimeout / Promise 调 finishLoad——数据其实已在 fullTree 里即刻可得，
 * 保留 loading 态既对齐 WorkBuddy「加载中转圈」的交互语义，也为真分页留口。
 * 异步节奏归 UI 管，状态机只做状态迁移。
 *
 * 渲染接线：flattenTree 只认 collapsedPaths。「未加载即折叠」由 UI 负责——
 * 把 collapsedPaths 与「不在 loadedPaths 中的文件夹」求并集传入，首屏即呈现
 * depth=2（depth 0/1 展开、depth 2 的文件夹收起待加载）。
 */

/**
 * 任一层路径段命中即整条隐藏的目录名。
 * 与 src/core/file-index.ts 的 SKIP_DIRS 同源——它扫描时已不进入这些目录，
 * 正常数据里根本不会出现，这里是给第二数据源 / 测试夹带的脏路径兜底。
 * renderer 不许 import core（AGENTS.md §一），集合只能复制，SKIP_DIRS 变更时
 * 这里要同步。.astro 不在 SKIP_DIRS 里，但和 .next 一样是框架构建产物目录
 * （Astro），一并隐藏。
 */
const HIDDEN_DIRS: ReadonlySet<string> = new Set([
	"node_modules",
	".git",
	".hg",
	".svn",
	"out",
	"dist",
	"build",
	".next",
	".cache",
	"coverage",
	".astro",
]);

export interface FileTreeNode {
	/** 相对路径（posix 分隔符）。文件夹与文件同构，靠 kind 区分。 */
	readonly path: string;
	/** 节点名（路径末段）。 */
	readonly name: string;
	readonly kind: "folder" | "file";
	/** 文件夹才有：子节点（未加载时为 undefined，表示需要懒加载）。 */
	readonly children?: readonly FileTreeNode[];
}

export interface FlatNode {
	readonly node: FileTreeNode;
	readonly depth: number; // 0 = 根层，缩进 = depth * 12px（WorkBuddy 同款）
}

/**
 * 构建期的可变中间结构。对外只暴露 freezeLevel 定型后的 FileTreeNode：
 * 子节点在构建期用 Map 按名去重，定型时才排序——避免每插一条路径就重排一次。
 */
type MutableNode =
	| { path: string; name: string; kind: "folder"; children: Map<string, MutableNode> }
	| { path: string; name: string; kind: "file" };

/**
 * 平铺 posix 相对路径 → 目录树的根层节点数组。
 * 按 `/` 切分重建层级，中间路径自动补文件夹节点；每层文件夹优先、
 * 同类按名称字典序（码元序——不用 localeCompare，排序结果不随运行
 * 环境语言漂移，测试可断言）。
 */
export function buildTree(paths: readonly string[]): FileTreeNode[] {
	const roots = new Map<string, MutableNode>();
	for (const filePath of paths) {
		const segments = filePath.split("/");
		if (segments.some((seg) => HIDDEN_DIRS.has(seg))) continue;
		let level = roots;
		let prefix = "";
		for (const [index, name] of segments.entries()) {
			prefix = prefix === "" ? name : `${prefix}/${name}`;
			const last = index === segments.length - 1;
			let node = level.get(name);
			if (!node) {
				node = last
					? { path: prefix, name, kind: "file" }
					: { path: prefix, name, kind: "folder", children: new Map() };
				level.set(name, node);
			}
			if (last) continue;
			// 同一段既是文件又是文件夹，只可能来自损坏的输入（file-index 只产出
			// 真实存在的文件，磁盘上二者互斥）——按 AGENTS.md §7 响亮报错，
			// 不静默吞掉其中一条。
			if (node.kind !== "folder") {
				throw new Error(`buildTree: 路径冲突，"${prefix}" 既是文件又是文件夹`);
			}
			level = node.children;
		}
	}
	return freezeLevel(roots);
}

function freezeLevel(level: Map<string, MutableNode>): FileTreeNode[] {
	return [...level.values()].sort(compareNodes).map((node): FileTreeNode =>
		node.kind === "folder"
			? { path: node.path, name: node.name, kind: "folder", children: freezeLevel(node.children) }
			: { path: node.path, name: node.name, kind: "file" },
	);
}

function compareNodes(a: MutableNode, b: MutableNode): number {
	if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
	return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

/**
 * 深度优先拍平成渲染行，根层 depth=0。collapsedPaths 命中的文件夹自身仍在
 * 列表里（UI 画成折叠态），但不递归其子层。children 为 undefined 的文件夹
 * （将来真分页的未加载节点）视为无子层可展开。
 */
export function flattenTree(nodes: readonly FileTreeNode[], collapsedPaths: ReadonlySet<string>): FlatNode[] {
	const out: FlatNode[] = [];
	const walk = (level: readonly FileTreeNode[], depth: number): void => {
		for (const node of level) {
			out.push({ node, depth });
			if (node.kind === "folder" && node.children && !collapsedPaths.has(node.path)) {
				walk(node.children, depth + 1);
			}
		}
	};
	walk(nodes, 0);
	return out;
}

export interface LazyTreeState {
	/** 完整树（buildTree 的结果，一次性算好）。 */
	readonly fullTree: readonly FileTreeNode[];
	/** 当前已加载到第几层的路径集合（懒加载的「已加载」语义）。 */
	readonly loadedPaths: ReadonlySet<string>;
	/** 用户折叠的文件夹路径集合。 */
	readonly collapsedPaths: ReadonlySet<string>;
	/** 正在加载中的文件夹路径集合（UI 显示转圈）。 */
	readonly loadingPaths: ReadonlySet<string>;
}

/**
 * 从平铺路径列表创建懒加载状态。出生即首屏可用：loadedPaths 直接是
 * initLoaded 的结果，UI 不需要记「创建后还要再调一次初始化」的隐式时序。
 */
export function createLazyTreeState(paths: readonly string[]): LazyTreeState {
	return initLoaded({
		fullTree: buildTree(paths),
		loadedPaths: new Set(),
		collapsedPaths: new Set(),
		loadingPaths: new Set(),
	});
}

/** 初始 loadedPaths = 根层 + depth=1 的文件夹（即首屏可见 depth=2 的层级）。幂等。 */
export function initLoaded(state: LazyTreeState): LazyTreeState {
	const loadedPaths = new Set(state.loadedPaths);
	for (const root of state.fullTree) {
		if (root.kind !== "folder") continue;
		loadedPaths.add(root.path);
		for (const child of root.children ?? []) {
			if (child.kind === "folder") loadedPaths.add(child.path);
		}
	}
	return { ...state, loadedPaths };
}

/**
 * 展开文件夹。已加载：仅移除折叠标记（即刻展开，不进 loading）；
 * 未加载：加入 loadingPaths（UI 显示转圈，并触发「异步加载」——
 * 见文件头接线说明），由 finishLoad 收尾。
 */
export function expandFolder(state: LazyTreeState, path: string): LazyTreeState {
	if (state.loadedPaths.has(path)) {
		if (!state.collapsedPaths.has(path)) return state;
		const collapsedPaths = new Set(state.collapsedPaths);
		collapsedPaths.delete(path);
		return { ...state, collapsedPaths };
	}
	if (state.loadingPaths.has(path)) return state;
	const loadingPaths = new Set(state.loadingPaths);
	loadingPaths.add(path);
	return { ...state, loadingPaths };
}

/** 「异步加载」完成：移出 loadingPaths、加入 loadedPaths、清除折叠标记（展开）。 */
export function finishLoad(state: LazyTreeState, path: string): LazyTreeState {
	const loadingPaths = new Set(state.loadingPaths);
	loadingPaths.delete(path);
	const loadedPaths = new Set(state.loadedPaths);
	loadedPaths.add(path);
	const collapsedPaths = new Set(state.collapsedPaths);
	collapsedPaths.delete(path);
	return { ...state, loadingPaths, loadedPaths, collapsedPaths };
}

/** 折叠文件夹。loadedPaths 保留——WorkBuddy 语义：折叠不卸载已加载子层，重新展开是即时的。 */
export function collapseFolder(state: LazyTreeState, path: string): LazyTreeState {
	if (state.collapsedPaths.has(path)) return state;
	const collapsedPaths = new Set(state.collapsedPaths);
	collapsedPaths.add(path);
	return { ...state, collapsedPaths };
}
