import { describe, expect, it } from "vitest";
import { loadDraft, navigateHistory, recordSent, saveDraft, sentHistory } from "./input-history.ts";

describe("recordSent（模块级历史）", () => {
	it("记录已发送文本；与最后一条相同则不记", () => {
		recordSent("第一条");
		recordSent("第一条");
		recordSent("第二条");
		expect(sentHistory()).toEqual(["第一条", "第二条"]);
	});
});

describe("navigateHistory（Alt+↑/↓ 导航）", () => {
	const history = ["甲", "乙", "丙"];

	it("空历史首次上翻：原地不动", () => {
		expect(navigateHistory(undefined, [], "up", "草稿")).toEqual({ state: undefined, text: "草稿" });
	});

	it("未导航时下翻：无意义，原地不动", () => {
		expect(navigateHistory(undefined, history, "down", "草稿")).toEqual({ state: undefined, text: "草稿" });
	});

	it("首次上翻：暂存当前草稿，定位到最近一条", () => {
		expect(navigateHistory(undefined, history, "up", "半截草稿")).toEqual({
			state: { index: 2, stash: "半截草稿" },
			text: "丙",
		});
	});

	it("上翻到顶（第 0 条）停住", () => {
		expect(navigateHistory({ index: 0, stash: "s" }, history, "up", "甲")).toEqual({
			state: { index: 0, stash: "s" },
			text: "甲",
		});
	});

	it("翻过最新一条后退出导航，恢复暂存的草稿", () => {
		expect(navigateHistory({ index: 2, stash: "半截草稿" }, history, "down", "丙")).toEqual({
			state: undefined,
			text: "半截草稿",
		});
	});

	it("完整来回：上翻两次再一路下翻到底，草稿还原", () => {
		let nav = navigateHistory(undefined, history, "up", "写到一半");
		expect(nav.text).toBe("丙");
		nav = navigateHistory(nav.state, history, "up", nav.text);
		expect(nav.text).toBe("乙");
		nav = navigateHistory(nav.state, history, "down", nav.text);
		expect(nav.text).toBe("丙");
		nav = navigateHistory(nav.state, history, "down", nav.text);
		expect(nav.state).toBeUndefined();
		expect(nav.text).toBe("写到一半");
	});

	it("导航中发送新消息不中断导航：继续下翻经过新条目后退出", () => {
		const growing = ["甲", "乙"];
		let nav = navigateHistory(undefined, growing, "up", "");
		expect(nav.text).toBe("乙");
		growing.push("丙"); // recordSent 追加到末尾
		nav = navigateHistory(nav.state, growing, "down", nav.text);
		expect(nav.text).toBe("丙");
		nav = navigateHistory(nav.state, growing, "down", nav.text);
		expect(nav.state).toBeUndefined();
		expect(nav.text).toBe("");
	});
});

describe("saveDraft / loadDraft（按会话草稿）", () => {
	it("按 sessionId 存取；未知会话返回 undefined", () => {
		saveDraft("s-1", "会话一的草稿");
		saveDraft("s-2", "会话二的草稿");
		expect(loadDraft("s-1")).toBe("会话一的草稿");
		expect(loadDraft("s-2")).toBe("会话二的草稿");
		expect(loadDraft("s-3")).toBeUndefined();
	});

	it("空串也是有效草稿（用户清空了输入框）", () => {
		saveDraft("s-empty", "");
		expect(loadDraft("s-empty")).toBe("");
	});
});
