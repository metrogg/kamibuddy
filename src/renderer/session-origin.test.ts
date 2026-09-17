import { describe, expect, it } from "vitest";
import type { SessionSummary } from "@shared/ipc.ts";
import { resolveSessionOrigin, sessionRowTitle } from "./session-origin.ts";

function summary(overrides: Partial<SessionSummary> & Pick<SessionSummary, "id" | "cwd">): SessionSummary {
	return {
		path: `C:\\sessions\\${overrides.id}.jsonl`,
		title: overrides.id,
		isTempTask: false,
		createdAt: 0,
		modifiedAt: 0,
		messageCount: 1,
		current: false,
		running: false,
		archived: false,
		...overrides,
	};
}

describe("resolveSessionOrigin：分支判定", () => {
	it("非分支会话（无 parentSession）返回 undefined", () => {
		const plain = summary({ id: "plain", cwd: "D:\\ws\\a" });

		expect(resolveSessionOrigin([plain], plain)).toBeUndefined();
	});

	it("母会话在列表里时解析出标题", () => {
		const parent = summary({ id: "parent", cwd: "D:\\ws\\a", title: "营收汇总" });
		const child = summary({
			id: "child",
			cwd: "D:\\ws\\a",
			title: "营收汇总 · 分支",
			parentSession: parent.path,
		});

		expect(resolveSessionOrigin([parent, child], child)).toEqual({ title: "营收汇总" });
	});

	it("母会话已删除（不在列表）时标题为 undefined，但仍是分支", () => {
		const child = summary({
			id: "child",
			cwd: "D:\\ws\\a",
			parentSession: "C:\\sessions\\gone.jsonl",
		});

		expect(resolveSessionOrigin([child], child)).toEqual({ title: undefined });
	});

	it("母标题为空白（改名成空格）时按无来源处理", () => {
		const parent = summary({ id: "parent", cwd: "D:\\ws\\a", title: "   " });
		const child = summary({ id: "child", cwd: "D:\\ws\\a", parentSession: parent.path });

		expect(resolveSessionOrigin([parent, child], child)).toEqual({ title: undefined });
	});

	it("母标题首尾空白会 trim 后使用", () => {
		const parent = summary({ id: "parent", cwd: "D:\\ws\\a", title: "  营收汇总  " });
		const child = summary({ id: "child", cwd: "D:\\ws\\a", parentSession: parent.path });

		expect(resolveSessionOrigin([parent, child], child)).toEqual({ title: "营收汇总" });
	});

	it("path 精确全等匹配：大小写 / 分隔符不同都算不在列表", () => {
		const parent = summary({ id: "parent", cwd: "D:\\ws\\a", title: "营收汇总" });
		const upper = summary({
			id: "upper",
			cwd: "D:\\ws\\a",
			parentSession: parent.path.toUpperCase(),
		});
		const slashed = summary({
			id: "slashed",
			cwd: "D:\\ws\\a",
			parentSession: parent.path.split("\\").join("/"),
		});

		expect(resolveSessionOrigin([parent, upper], upper)).toEqual({ title: undefined });
		expect(resolveSessionOrigin([parent, slashed], slashed)).toEqual({ title: undefined });
	});
});

describe("sessionRowTitle：hover 提示", () => {
	it("非分支行原样返回标题", () => {
		const plain = summary({ id: "plain", cwd: "D:\\ws\\a", title: "营收汇总" });

		expect(sessionRowTitle(plain, resolveSessionOrigin([plain], plain))).toBe("营收汇总");
	});

	it("分支行追加一行来源标题（母标题换行后可见）", () => {
		const parent = summary({ id: "parent", cwd: "D:\\ws\\a", title: "营收汇总" });
		const child = summary({
			id: "child",
			cwd: "D:\\ws\\a",
			title: "营收汇总 · 分支",
			parentSession: parent.path,
		});

		expect(sessionRowTitle(child, resolveSessionOrigin([parent, child], child))).toBe(
			"营收汇总 · 分支\n来源会话：营收汇总",
		);
	});

	it("来源缺失时说明事实，且不出现 undefined 字面量", () => {
		const child = summary({
			id: "child",
			cwd: "D:\\ws\\a",
			title: "营收汇总 · 分支",
			parentSession: "C:\\sessions\\gone.jsonl",
		});

		const title = sessionRowTitle(child, resolveSessionOrigin([child], child));

		expect(title).toBe("营收汇总 · 分支\n来源会话已不在列表");
		expect(title).not.toContain("undefined");
	});
});
