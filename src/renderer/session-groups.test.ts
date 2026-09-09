import { describe, expect, it } from "vitest";
import type { SessionSummary, WorkspaceGroupMeta } from "@shared/ipc.ts";
import { groupSessions } from "./session-groups.ts";

function summary(overrides: Partial<SessionSummary> & Pick<SessionSummary, "id" | "cwd">): SessionSummary {
	return {
		path: `C:\\sessions\\${overrides.id}.jsonl`,
		title: overrides.id,
		isTempTask: false,
		createdAt: 0,
		modifiedAt: 0,
		messageCount: 1,
		current: false,
		...overrides,
	};
}

function names(groups: readonly { readonly name: string }[]): string[] {
	return groups.map((g) => g.name);
}

describe("groupSessions：分桶", () => {
	it("临时任务进 tasks，工作空间会话按 cwd 分桶进 spaces", () => {
		const tempTask = summary({ id: "tmp", cwd: "C:\\KamiBuddy\\临时任务", isTempTask: true, modifiedAt: 1 });
		const a1 = summary({ id: "a1", cwd: "D:\\ws\\a", modifiedAt: 2 });
		const a2 = summary({ id: "a2", cwd: "D:\\ws\\a", modifiedAt: 3 });
		const b1 = summary({ id: "b1", cwd: "D:\\ws\\b", modifiedAt: 4 });

		const groups = groupSessions([tempTask, a1, a2, b1], []);

		expect(groups.tasks.map((s) => s.id)).toEqual(["tmp"]);
		expect(groups.spaces).toHaveLength(2);
		const groupA = groups.spaces.find((g) => g.cwd === "D:\\ws\\a");
		expect(groupA?.sessions.map((s) => s.id)).toEqual(["a2", "a1"]);
	});

	it("空输入 → 两区都为空", () => {
		expect(groupSessions([], [])).toEqual({ tasks: [], spaces: [] });
	});

	it("current 标记不影响分组归属", () => {
		const currentTempTask = summary({
			id: "tmp",
			cwd: "C:\\KamiBuddy\\临时任务",
			isTempTask: true,
			current: true,
			modifiedAt: 1,
		});
		const currentSpace = summary({ id: "ws", cwd: "D:\\ws\\a", modifiedAt: 2 });

		const groups = groupSessions([currentTempTask, currentSpace], []);

		expect(groups.tasks.map((s) => s.id)).toEqual(["tmp"]);
		expect(groups.spaces).toHaveLength(1);
		expect(groups.spaces[0]?.sessions.map((s) => s.id)).toEqual(["ws"]);
	});
});

describe("groupSessions：排序", () => {
	it("tasks 内按 modifiedAt 倒序", () => {
		const older = summary({ id: "old", cwd: "C:\\KamiBuddy\\临时任务", isTempTask: true, modifiedAt: 10 });
		const newer = summary({ id: "new", cwd: "C:\\KamiBuddy\\临时任务", isTempTask: true, modifiedAt: 20 });

		const groups = groupSessions([older, newer], []);

		expect(groups.tasks.map((s) => s.id)).toEqual(["new", "old"]);
	});

	it("组内会话按 modifiedAt 倒序", () => {
		const s1 = summary({ id: "s1", cwd: "D:\\ws\\a", modifiedAt: 10 });
		const s2 = summary({ id: "s2", cwd: "D:\\ws\\a", modifiedAt: 30 });
		const s3 = summary({ id: "s3", cwd: "D:\\ws\\a", modifiedAt: 20 });

		const groups = groupSessions([s1, s2, s3], []);

		expect(groups.spaces[0]?.sessions.map((s) => s.id)).toEqual(["s2", "s3", "s1"]);
	});

	it("组间按 latestAt（组内最近 modifiedAt）倒序", () => {
		// a 组最新一条是 100，b 组最新一条是 50 → a 在前。
		const aOld = summary({ id: "a-old", cwd: "D:\\ws\\a", modifiedAt: 10 });
		const bNew = summary({ id: "b-new", cwd: "D:\\ws\\b", modifiedAt: 50 });
		const aNew = summary({ id: "a-new", cwd: "D:\\ws\\a", modifiedAt: 100 });

		const groups = groupSessions([aOld, bNew, aNew], []);

		expect(groups.spaces.map((g) => g.cwd)).toEqual(["D:\\ws\\a", "D:\\ws\\b"]);
		expect(groups.spaces[0]?.latestAt).toBe(100);
		expect(groups.spaces[1]?.latestAt).toBe(50);
	});
});

describe("groupSessions：组名", () => {
	it("displayName 覆盖 basename；无对应组的 meta 被忽略", () => {
		const s = summary({ id: "s", cwd: "D:\\ws\\alpha", modifiedAt: 1 });
		const metas: WorkspaceGroupMeta[] = [
			{ cwd: "D:\\ws\\alpha", displayName: "营收空间" },
			{ cwd: "D:\\ws\\ghost", displayName: "不存在的组" },
		];

		const groups = groupSessions([s], metas);

		expect(names(groups.spaces)).toEqual(["营收空间"]);
	});

	it("displayName 为空白（含纯空格）时回退 basename", () => {
		const blank = summary({ id: "blank", cwd: "D:\\ws\\alpha", modifiedAt: 1 });
		const spacesOnly = summary({ id: "spaces", cwd: "D:\\ws\\beta", modifiedAt: 2 });
		const metas: WorkspaceGroupMeta[] = [
			{ cwd: "D:\\ws\\alpha", displayName: "" },
			{ cwd: "D:\\ws\\beta", displayName: "   " },
		];

		const groups = groupSessions([blank, spacesOnly], metas);

		expect(names(groups.spaces)).toEqual(["beta", "alpha"]);
	});

	it("displayName 首尾空白会 trim 后使用", () => {
		const s = summary({ id: "s", cwd: "D:\\ws\\alpha", modifiedAt: 1 });

		const groups = groupSessions([s], [{ cwd: "D:\\ws\\alpha", displayName: "  营收空间  " }]);

		expect(names(groups.spaces)).toEqual(["营收空间"]);
	});

	it("basename 处理正斜杠路径", () => {
		const s = summary({ id: "s", cwd: "/home/u/proj", modifiedAt: 1 });

		expect(names(groupSessions([s], []).spaces)).toEqual(["proj"]);
	});

	it("basename 先去掉尾部分隔符", () => {
		const backslash = summary({ id: "bs", cwd: "D:\\a\\b\\", modifiedAt: 1 });
		const slash = summary({ id: "fs", cwd: "/a/b/", modifiedAt: 2 });

		expect(names(groupSessions([backslash, slash], []).spaces)).toEqual(["b", "b"]);
	});

	it("盘符根原样返回（D:\\ 没有可取的 basename）", () => {
		const s = summary({ id: "s", cwd: "D:\\", modifiedAt: 1 });

		expect(names(groupSessions([s], []).spaces)).toEqual(["D:\\"]);
	});

	it("空串 cwd 原样返回", () => {
		const s = summary({ id: "s", cwd: "", modifiedAt: 1 });

		expect(names(groupSessions([s], []).spaces)).toEqual([""]);
	});
});
