/**
 * team-output-snapshot 的单元测试（spec: inject-team-output-snapshot，Task 2）。
 *
 * 本模块是「成员产出自动送达」的判据层。它最容易错的不是拼串，而是**幂等** ——
 * 同一份产出被反复注入的代价是每个 run 白付一段输入 token（正是 WorkBuddy
 * 「每请求现算尾巴注入」被证伪的那个坑）。所以这里把「注入一次后不再注入」钉成
 * 回归用例，并顺带钉住状态行口径（与 team_status 一致）与「不写取代声明」。
 */

import { describe, expect, it } from "vitest";
import {
	collectTeamOutputMembers,
	composeTeamOutputSnapshot,
	outputFingerprint,
	TEAM_OUTPUT_MAX_CHARS,
	type TeamOutputMemberInput,
} from "./team-output-snapshot.ts";

/** 造一个成员输入；只需覆盖关心的字段。 */
function member(overrides: Partial<TeamOutputMemberInput> & { name: string }): TeamOutputMemberInput {
	return { agentName: "researcher", status: "idle", turns: 1, ...overrides };
}

/** 造一个注册表视图（`collectTeamOutputMembers` 的入参形状）。 */
type RegistryMemberView = {
	readonly name: string;
	readonly agentName: string;
	readonly status: string;
	readonly turns: number;
	readonly sessionId: string | undefined;
};

function teamOf(members: readonly RegistryMemberView[]): {
	readonly members: ReadonlyMap<string, RegistryMemberView>;
} {
	return { members: new Map(members.map((m, i) => [`key-${i}`, m])) };
}

describe("outputFingerprint · 稳定指纹", () => {
	it("同一产出（前后空白不同）指纹相同", () => {
		expect(outputFingerprint("产出正文")).toBe(outputFingerprint("  产出正文\n\n"));
	});

	it("不同产出指纹不同", () => {
		expect(outputFingerprint("产出甲")).not.toBe(outputFingerprint("产出乙"));
	});

	it("[Agent ID: x] 装饰被剥离后指纹相同", () => {
		const bare = outputFingerprint("调研结论：共 3 条。");
		const decorated = outputFingerprint("[Agent ID: 7f3a]\n调研结论：共 3 条。\n[Agent ID: 7f3a]");
		expect(decorated).toBe(bare);
	});

	it("长度恒为 8 且是小写十六进制", () => {
		expect(outputFingerprint("任意内容")).toMatch(/^[0-9a-f]{8}$/);
		expect(outputFingerprint("")).toMatch(/^[0-9a-f]{8}$/);
	});
});

describe("composeTeamOutputSnapshot · 幂等", () => {
	it("三连跑稳定：run1 注入产出 → run2 只剩状态行 → run3 与 run2 逐字节相同 ⇒ undefined", () => {
		const output = "已调研完 12 个信源。";
		const fingerprint = outputFingerprint(output);
		const members = [
			member({ name: "谭溯源", agentName: "topic-researcher", status: "idle", turns: 53, output }),
		];

		// run1：还没有 previous ⇒ 状态行（带 fp）+ 产出块。
		const run1 = composeTeamOutputSnapshot({ teamName: "研究队", members, previous: undefined });
		expect(run1).toBeDefined();
		expect(run1).toContain("<member_output");
		expect(run1).toContain(output);
		expect(run1).toContain(`- 谭溯源（topic-researcher）：idle，已完成 53 轮 [fp ${fingerprint}]`);

		// run2：指纹已被 previous 记录 ⇒ 不出产出块，只剩带同一个 fp 的状态行。
		const run2 = composeTeamOutputSnapshot({ teamName: "研究队", members, previous: run1 });
		expect(run2).toBeDefined();
		expect(run2).not.toContain("<member_output");
		expect(run2).toContain(`[fp ${fingerprint}]`);
		expect(run2).not.toBe(run1);

		// run3：previous 里仍记着同一个 fp ⇒ 候选与 run2 逐字节相同 ⇒ 不再追加（不交替）。
		const run3 = composeTeamOutputSnapshot({ teamName: "研究队", members, previous: run2 });
		expect(run3).toBeUndefined();
	});

	it("成员产出没变但状态变了 → 仍会追加（状态变化要让领导知道）", () => {
		const output = "同一份产出";
		const first = composeTeamOutputSnapshot({
			teamName: "研究队",
			members: [member({ name: "谭溯源", status: "running", turns: 2, output })],
			previous: undefined,
		});
		const second = composeTeamOutputSnapshot({
			teamName: "研究队",
			members: [member({ name: "谭溯源", status: "idle", turns: 3, output })],
			previous: first,
		});
		expect(second).toBeDefined();
		expect(second).not.toContain("<member_output");
		expect(second).toContain("已完成 3 轮");
	});

	it("成员产出更新（指纹变了）⇒ 产出块重新注入一次", () => {
		const base = { name: "谭溯源", agentName: "topic-researcher", status: "idle", turns: 53 };
		const run1 = composeTeamOutputSnapshot({
			teamName: "研究队",
			members: [member({ ...base, output: "第一版产出" })],
			previous: undefined,
		});
		const run2 = composeTeamOutputSnapshot({
			teamName: "研究队",
			members: [member({ ...base, output: "第一版产出" })],
			previous: run1,
		});
		expect(run2).not.toContain("<member_output");

		const run3 = composeTeamOutputSnapshot({
			teamName: "研究队",
			members: [member({ ...base, output: "第二版产出" })],
			previous: run2,
		});
		expect(run3).toBeDefined();
		expect(run3).toContain("<member_output");
		expect(run3).toContain("第二版产出");
	});

	it("previous 是旧形态（状态行不带 fp）⇒ 产出块重新注入一次", () => {
		const legacy = `<team_output team="研究队">\n- 谭溯源（topic-researcher）：idle，已完成 53 轮\n</team_output>`;
		const snapshot = composeTeamOutputSnapshot({
			teamName: "研究队",
			members: [
				member({ name: "谭溯源", agentName: "topic-researcher", status: "idle", turns: 53, output: "产出" }),
			],
			previous: legacy,
		});
		expect(snapshot).toBeDefined();
		expect(snapshot).toContain("<member_output");
		expect(snapshot).toContain("产出");
	});
});

describe("composeTeamOutputSnapshot · 截断", () => {
	it("超长正文被截到 maxChars 且带「全文用 team_read 取回」标注", () => {
		const output = "甲".repeat(TEAM_OUTPUT_MAX_CHARS + 500);
		const snapshot = composeTeamOutputSnapshot({
			teamName: "研究队",
			members: [member({ name: "谭溯源", output })],
			previous: undefined,
		});
		expect(snapshot).toBeDefined();
		expect(snapshot).toContain("甲".repeat(TEAM_OUTPUT_MAX_CHARS));
		expect(snapshot).not.toContain("甲".repeat(TEAM_OUTPUT_MAX_CHARS + 1));
		expect(snapshot).toContain("（已截断，全文用 team_read 取回）");
	});

	it("未超长时没有截断标注", () => {
		const snapshot = composeTeamOutputSnapshot({
			teamName: "研究队",
			members: [member({ name: "谭溯源", output: "短产出" })],
			previous: undefined,
		});
		expect(snapshot).toContain("短产出");
		expect(snapshot).not.toContain("（已截断，全文用 team_read 取回）");
	});

	it("maxChars 可覆盖（按字符切）", () => {
		const snapshot = composeTeamOutputSnapshot({
			teamName: "研究队",
			members: [member({ name: "谭溯源", output: "一二三四五" })],
			previous: undefined,
			maxChars: 3,
		});
		expect(snapshot).toContain("一二三");
		expect(snapshot).not.toContain("一二三四");
		expect(snapshot).toContain("（已截断，全文用 team_read 取回）");
	});
});

describe("composeTeamOutputSnapshot · 形状与口径", () => {
	it("状态行与 team_status 同款：`- 名字（角色）：状态，已完成 N 轮`", () => {
		const snapshot = composeTeamOutputSnapshot({
			teamName: "研究队",
			members: [
				member({ name: "谭溯源", agentName: "topic-researcher", status: "idle", turns: 53 }),
				member({ name: "程文成", agentName: "report-writer", status: "running", turns: 2 }),
			],
			previous: undefined,
		});
		expect(snapshot).toContain('<team_output team="研究队">');
		expect(snapshot).toContain("- 谭溯源（topic-researcher）：idle，已完成 53 轮");
		expect(snapshot).toContain("- 程文成（report-writer）：running，已完成 2 轮");
		expect(snapshot).toContain("</team_output>");
	});

	it("状态行：有产出的成员带 ` [fp 8位]`，没产出的成员不带", () => {
		const snapshot = composeTeamOutputSnapshot({
			teamName: "研究队",
			members: [
				member({ name: "谭溯源", agentName: "topic-researcher", status: "idle", turns: 53, output: "产出正文" }),
				member({ name: "程文成", agentName: "report-writer", status: "running", turns: 2 }),
			],
			previous: undefined,
		});
		expect(snapshot).toContain(
			`- 谭溯源（topic-researcher）：idle，已完成 53 轮 [fp ${outputFingerprint("产出正文")}]`,
		);
		const cheng = snapshot?.split("\n").find((line) => line.startsWith("- 程文成"));
		expect(cheng).toBeDefined();
		expect(cheng).not.toContain("[fp ");
	});

	it("产出块带 member 属性，正文包在块里", () => {
		const snapshot = composeTeamOutputSnapshot({
			teamName: "研究队",
			members: [member({ name: "谭溯源", output: "产出正文" })],
			previous: undefined,
		});
		expect(snapshot).toContain('<member_output member="谭溯源">');
		expect(snapshot).toContain("</member_output>");
	});

	it("说明句是逐字节稳定的常量（去重的前提）", () => {
		const first = composeTeamOutputSnapshot({
			teamName: "研究队",
			members: [member({ name: "谭溯源", output: "产出正文" })],
			previous: undefined,
		});
		const second = composeTeamOutputSnapshot({
			teamName: "研究队",
			members: [member({ name: "谭溯源", agentName: "researcher", status: "idle", turns: 99 })],
			previous: undefined,
		});
		const note = (text: string | undefined): string | undefined => text?.split("\n")[1];
		expect(note(first)).toBe(note(second));
	});

	it("不含取代声明（本通道是增量语义）", () => {
		const snapshot = composeTeamOutputSnapshot({
			teamName: "研究队",
			members: [member({ name: "谭溯源", output: "产出正文" })],
			previous: undefined,
		});
		expect(snapshot).not.toContain("本条快照取代此前所有同类快照");
	});
});

describe("composeTeamOutputSnapshot · 边界", () => {
	it("members 为空 → undefined", () => {
		expect(
			composeTeamOutputSnapshot({ teamName: "研究队", members: [], previous: undefined }),
		).toBeUndefined();
	});

	it("output 为空白 → 视同没有产出", () => {
		const snapshot = composeTeamOutputSnapshot({
			teamName: "研究队",
			members: [member({ name: "谭溯源", output: "   \n  " })],
			previous: undefined,
		});
		expect(snapshot).toBeDefined();
		expect(snapshot).not.toContain("<member_output");
		// 状态行本身不带去重标记（说明句里的 `[fp xxxxxxxx]` 是常量示例，不算）。
		const status = snapshot?.split("\n").find((line) => line.startsWith("- 谭溯源"));
		expect(status).toBe("- 谭溯源（researcher）：idle，已完成 1 轮");
	});

	it("output 缺省 → 视同没有产出", () => {
		const snapshot = composeTeamOutputSnapshot({
			teamName: "研究队",
			members: [member({ name: "谭溯源" })],
			previous: undefined,
		});
		expect(snapshot).not.toContain("<member_output");
	});

	it("previous 与候选逐字节相同 → undefined", () => {
		// 用「没有产出」的成员：候选 = 纯状态行，不存在任何指纹跳过带来的差异，
		// 于是第二次调用拼出的候选与 previous 逐字节相同（连跑多久都不会变）。
		const members = [member({ name: "谭溯源", status: "idle", turns: 53 })];
		const snapshot = composeTeamOutputSnapshot({ teamName: "研究队", members, previous: undefined });
		expect(snapshot).toBeDefined();
		expect(
			composeTeamOutputSnapshot({ teamName: "研究队", members, previous: snapshot }),
		).toBeUndefined();
	});
});

describe("collectTeamOutputMembers · 取数接缝", () => {
	it("team 为 undefined → undefined，且一次都不读（无团队不该读文件）", () => {
		let calls = 0;
		const result = collectTeamOutputMembers(undefined, (sessionId) => {
			calls += 1;
			return `output-${sessionId}`;
		});
		expect(result).toBeUndefined();
		expect(calls).toBe(0);
	});

	it("成员无 sessionId → 不调 readOutput，该成员 output 缺省", () => {
		let calls = 0;
		const result = collectTeamOutputMembers(
			teamOf([{ name: "谭溯源", agentName: "topic-researcher", status: "idle", turns: 1, sessionId: undefined }]),
			(sessionId) => {
				calls += 1;
				return `output-${sessionId}`;
			},
		);
		expect(calls).toBe(0);
		expect(result).toEqual([
			{ name: "谭溯源", agentName: "topic-researcher", status: "idle", turns: 1 },
		]);
	});

	it("成员有 sessionId → 用其返回值", () => {
		const seen: string[] = [];
		const result = collectTeamOutputMembers(
			teamOf([
				{ name: "谭溯源", agentName: "topic-researcher", status: "idle", turns: 53, sessionId: "s-1" },
				{ name: "程文成", agentName: "report-writer", status: "running", turns: 2, sessionId: "s-2" },
			]),
			(sessionId) => {
				seen.push(sessionId);
				return `产出@${sessionId}`;
			},
		);
		expect(seen).toEqual(["s-1", "s-2"]);
		expect(result).toEqual([
			{ name: "谭溯源", agentName: "topic-researcher", status: "idle", turns: 53, output: "产出@s-1" },
			{ name: "程文成", agentName: "report-writer", status: "running", turns: 2, output: "产出@s-2" },
		]);
	});

	it("读到的产出为 undefined 或空白 → 该成员 output 缺省", () => {
		const result = collectTeamOutputMembers(
			teamOf([
				{ name: "谭溯源", agentName: "topic-researcher", status: "idle", turns: 1, sessionId: "s-1" },
				{ name: "程文成", agentName: "report-writer", status: "idle", turns: 1, sessionId: "s-2" },
			]),
			(sessionId) => (sessionId === "s-1" ? undefined : "   \n "),
		);
		expect(result?.[0]?.output).toBeUndefined();
		expect(result?.[1]?.output).toBeUndefined();
	});
});
