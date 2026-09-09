import { describe, expect, it } from "vitest";
import {
	buildTree,
	collapseFolder,
	createLazyTreeState,
	expandFolder,
	finishLoad,
	flattenTree,
	initLoaded,
	type FileTreeNode,
	type FlatNode,
} from "./workspace-file-tree.ts";

/** 拍平成 "depth:path" 串数组，一条断言看全层级与顺序。 */
function flat(nodes: readonly FlatNode[]): string[] {
	return nodes.map((n) => `${n.depth}:${n.node.path}`);
}

function childNames(node: FileTreeNode | undefined): string[] {
	return (node?.children ?? []).map((c) => c.name);
}

function sorted(set: ReadonlySet<string>): string[] {
	return [...set].sort();
}

describe("buildTree：结构重建", () => {
	it("按 / 切分重建嵌套层级，中间路径自动补文件夹节点", () => {
		const tree = buildTree(["src/main/index.ts", "src/shared/ipc.ts", "docs/ARCHITECTURE.md"]);

		expect(tree.map((n) => n.name)).toEqual(["docs", "src"]);
		const src = tree[1];
		expect(src?.kind).toBe("folder");
		expect(src?.path).toBe("src");
		expect(childNames(src)).toEqual(["main", "shared"]);
		const main = src?.children?.[0];
		expect(main).toMatchObject({ path: "src/main", name: "main", kind: "folder" });
		const indexTs = main?.children?.[0];
		expect(indexTs).toMatchObject({ path: "src/main/index.ts", name: "index.ts", kind: "file" });
		expect(indexTs?.children).toBeUndefined();
	});

	it("深链自动补全单链文件夹", () => {
		const tree = buildTree(["a/b/c/d.ts"]);

		expect(tree[0]?.path).toBe("a");
		expect(tree[0]?.children?.[0]?.path).toBe("a/b");
		expect(tree[0]?.children?.[0]?.children?.[0]?.path).toBe("a/b/c");
		const d = tree[0]?.children?.[0]?.children?.[0]?.children?.[0];
		expect(d).toMatchObject({ path: "a/b/c/d.ts", name: "d.ts", kind: "file" });
	});

	it("文件夹优先排序，同类按名称字典序（与输入顺序无关）", () => {
		const tree = buildTree(["b.ts", "z/x.ts", "a.ts", "c/y.ts"]);
		expect(tree.map((n) => `${n.kind}:${n.name}`)).toEqual([
			"folder:c",
			"folder:z",
			"file:a.ts",
			"file:b.ts",
		]);

		// 子层同样适用。
		const nested = buildTree(["f/b.ts", "f/sub/g.ts", "f/a.ts"]);
		expect(childNames(nested[0])).toEqual(["sub", "a.ts", "b.ts"]);
	});

	it("重复路径幂等（索引去重前的脏数据不放大）", () => {
		expect(childNames(buildTree(["a/x.ts", "a/x.ts"])[0])).toEqual(["x.ts"]);
	});

	it("同一路径段既是文件又是文件夹时响亮报错（AGENTS.md §7，不静默吞数据）", () => {
		expect(() => buildTree(["a", "a/b.ts"])).toThrow(/路径冲突/);
	});
});

describe("buildTree：隐藏目录", () => {
	it("node_modules / .git 等任一层路径段命中即整条过滤", () => {
		const tree = buildTree([
			"keep/index.ts",
			"node_modules/pkg/index.js",
			"src/node_modules/evil.js",
			".git/config",
			"sub/.git/HEAD",
			".next/server.js",
			".astro/types.d.ts",
			".cache/tmp.json",
			"coverage/lcov.info",
			"dist/bundle.js",
			"src/dist/x.js",
			"build/app.js",
			"out/main.js",
			".hg/store",
			".svn/entries",
		]);

		expect(tree.map((n) => n.name)).toEqual(["keep"]);
		expect(childNames(tree[0])).toEqual(["index.ts"]);
	});

	it("空输入 → 空树", () => {
		expect(buildTree([])).toEqual([]);
	});
});

describe("flattenTree", () => {
	// docs/  src/{main,shared}/  README.md
	const tree = buildTree(["src/main/index.ts", "src/shared/ipc.ts", "docs/ARCHITECTURE.md", "README.md"]);

	it("无折叠时深度优先全展开，根层 depth=0", () => {
		expect(flat(flattenTree(tree, new Set()))).toEqual([
			"0:docs",
			"1:docs/ARCHITECTURE.md",
			"0:src",
			"1:src/main",
			"2:src/main/index.ts",
			"1:src/shared",
			"2:src/shared/ipc.ts",
			"0:README.md",
		]);
	});

	it("折叠的文件夹自身仍在列表里，子层不递归", () => {
		expect(flat(flattenTree(tree, new Set(["src"])))).toEqual([
			"0:docs",
			"1:docs/ARCHITECTURE.md",
			"0:src",
			"0:README.md",
		]);
	});

	it("嵌套折叠只影响命中的那一层", () => {
		expect(flat(flattenTree(tree, new Set(["src/main"])))).toEqual([
			"0:docs",
			"1:docs/ARCHITECTURE.md",
			"0:src",
			"1:src/main",
			"1:src/shared",
			"2:src/shared/ipc.ts",
			"0:README.md",
		]);
	});

	it("空树 → 空列表", () => {
		expect(flattenTree([], new Set())).toEqual([]);
	});
});

describe("懒加载状态机", () => {
	// 文件夹层级：a(d0) > b(d1) > c(d2) > deep.ts(d3)
	const paths = ["a/b/c/deep.ts", "a/b/sibling.ts", "a/top.ts", "root.ts"];

	it("createLazyTreeState 出生即首屏：loadedPaths = 根层 + depth=1 文件夹", () => {
		const state = createLazyTreeState(paths);

		expect(sorted(state.loadedPaths)).toEqual(["a", "a/b"]);
		expect(state.collapsedPaths.size).toBe(0);
		expect(state.loadingPaths.size).toBe(0);
		// depth=2 的文件夹与文件都不进 loadedPaths。
		expect(state.loadedPaths.has("a/b/c")).toBe(false);
		expect(state.loadedPaths.has("root.ts")).toBe(false);
	});

	it("initLoaded 幂等：重复调用不改变已加载集合", () => {
		expect(sorted(initLoaded(createLazyTreeState(paths)).loadedPaths)).toEqual(["a", "a/b"]);
	});

	it("expandFolder 已加载分支：只移除折叠标记，不进 loading", () => {
		const state = collapseFolder(createLazyTreeState(paths), "a/b");

		const expanded = expandFolder(state, "a/b");

		expect(expanded.collapsedPaths.size).toBe(0);
		expect(expanded.loadingPaths.size).toBe(0);
		expect(sorted(expanded.loadedPaths)).toEqual(["a", "a/b"]);
	});

	it("expandFolder 未加载分支：加入 loadingPaths，loadedPaths 不变", () => {
		const expanding = expandFolder(createLazyTreeState(paths), "a/b/c");

		expect(sorted(expanding.loadingPaths)).toEqual(["a/b/c"]);
		expect(sorted(expanding.loadedPaths)).toEqual(["a", "a/b"]);
		expect(expanding.collapsedPaths.size).toBe(0);
	});

	it("finishLoad：移出 loading、加入 loaded、清除折叠标记", () => {
		const state = expandFolder(createLazyTreeState(paths), "a/b/c");

		const loaded = finishLoad(state, "a/b/c");

		expect(loaded.loadingPaths.size).toBe(0);
		expect(sorted(loaded.loadedPaths)).toEqual(["a", "a/b", "a/b/c"]);
		expect(loaded.collapsedPaths.size).toBe(0);
	});

	it("finishLoad 同时清除加载前已有的折叠标记（转圈结束必须呈现展开）", () => {
		const state = expandFolder(collapseFolder(createLazyTreeState(paths), "a/b/c"), "a/b/c");
		expect(state.collapsedPaths.has("a/b/c")).toBe(true);
		expect(state.loadingPaths.has("a/b/c")).toBe(true);

		const loaded = finishLoad(state, "a/b/c");

		expect(loaded.collapsedPaths.size).toBe(0);
		expect(loaded.loadedPaths.has("a/b/c")).toBe(true);
	});

	it("collapseFolder 折叠不卸载 loadedPaths（WorkBuddy 语义：重展开是即时的）", () => {
		const loaded = finishLoad(expandFolder(createLazyTreeState(paths), "a/b/c"), "a/b/c");

		const collapsed = collapseFolder(loaded, "a/b/c");
		expect(sorted(collapsed.collapsedPaths)).toEqual(["a/b/c"]);
		expect(sorted(collapsed.loadedPaths)).toEqual(["a", "a/b", "a/b/c"]);

		// 已加载的文件夹重展开走快分支：不进 loading，没有转圈。
		const reopened = expandFolder(collapsed, "a/b/c");
		expect(reopened.collapsedPaths.size).toBe(0);
		expect(reopened.loadingPaths.size).toBe(0);
	});

	it("状态不可变：每个操作返回新 state，原 state 的集合不被改动", () => {
		const state = createLazyTreeState(paths);
		const loadedBefore = sorted(state.loadedPaths);

		expandFolder(state, "a/b/c");
		finishLoad(state, "a/b/c");
		collapseFolder(state, "a/b");

		expect(sorted(state.loadedPaths)).toEqual(loadedBefore);
		expect(state.loadingPaths.size).toBe(0);
		expect(state.collapsedPaths.size).toBe(0);
	});
});

describe("边界", () => {
	it("空路径列表：空树、无已加载层", () => {
		const state = createLazyTreeState([]);

		expect(state.fullTree).toEqual([]);
		expect(state.loadedPaths.size).toBe(0);
		expect(flattenTree(state.fullTree, state.collapsedPaths)).toEqual([]);
	});

	it("单文件根：无文件夹可加载，flatten 只有一行", () => {
		const state = createLazyTreeState(["solo.ts"]);

		expect(state.fullTree).toHaveLength(1);
		expect(state.fullTree[0]?.kind).toBe("file");
		expect(state.loadedPaths.size).toBe(0);
		expect(flat(flattenTree(state.fullTree, state.collapsedPaths))).toEqual(["0:solo.ts"]);
	});

	it("深嵌套（depth>2）逐层渐进展开", () => {
		let state = createLazyTreeState(["w/x/y/z/file.ts"]);
		expect(sorted(state.loadedPaths)).toEqual(["w", "w/x"]);

		// depth=2 的文件夹未加载：展开要走 loading → finishLoad 一圈。
		state = expandFolder(state, "w/x/y");
		expect(sorted(state.loadingPaths)).toEqual(["w/x/y"]);
		state = finishLoad(state, "w/x/y");
		expect(sorted(state.loadedPaths)).toEqual(["w", "w/x", "w/x/y"]);

		// depth=3 同理。
		state = expandFolder(state, "w/x/y/z");
		state = finishLoad(state, "w/x/y/z");
		expect(sorted(state.loadedPaths)).toEqual(["w", "w/x", "w/x/y", "w/x/y/z"]);

		// 全部加载且无折叠后，整棵树可见。
		expect(flat(flattenTree(state.fullTree, state.collapsedPaths))).toEqual([
			"0:w",
			"1:w/x",
			"2:w/x/y",
			"3:w/x/y/z",
			"4:w/x/y/z/file.ts",
		]);
	});
});
