/**
 * 团队落盘测试（spec: add-team-collaboration-parity 批次 ⑤）。
 *
 * 重点：往返完整（成员与任务板一字不差）、路径穿越必须拦下（团队名是用户输入）、
 * 版本不符要响亮报错（静默当同版本 = 用旧结构喂新代码）。
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TeamTask } from "./team-tasks.ts";
import { readTeams, removeTeam, TEAM_STORE_VERSION, teamDir, writeTeam, type StoredTeam } from "./team-store.ts";

let configDir: string;

beforeEach(() => {
	configDir = mkdtempSync(join(tmpdir(), "kami-team-store-"));
});

afterEach(() => {
	rmSync(configDir, { recursive: true, force: true });
});

const TASK: TeamTask = {
	id: "t1",
	title: "调研",
	detail: "查 5 个来源",
	owner: "谭溯源",
	blockedBy: [],
	status: "completed",
	result: "完成",
	createdAt: 1,
	updatedAt: 2,
};

function sampleTeam(name = "stock-partner-roundtable"): StoredTeam {
	return {
		version: TEAM_STORE_VERSION,
		name,
		leaderSessionId: "sess-1",
		updatedAt: 123,
		members: [
			{
				name: "谭溯源",
				agentName: "topic-researcher",
				task: "调研 AI Agent",
				sessionId: "sid-a",
				status: "idle",
				turns: 3,
				toolCalls: 12,
				tokens: 3400,
				cost: 0.02,
				planStatus: "approved",
				planFeedback: "",
			},
		],
		tasks: [TASK],
	};
}

describe("往返", () => {
	it("写进去再读回来：成员与任务板一字不差", () => {
		writeTeam(configDir, sampleTeam());
		const [restored] = readTeams(configDir);
		expect(restored).toEqual(sampleTeam());
	});

	it("多个团队各占一个目录，都能读回", () => {
		writeTeam(configDir, sampleTeam("team-a"));
		writeTeam(configDir, sampleTeam("team-b"));
		expect(readTeams(configDir).map((team) => team.name).sort()).toEqual(["team-a", "team-b"]);
	});

	it("重复写同一团队 = 覆盖（不产生第二份）", () => {
		writeTeam(configDir, sampleTeam());
		writeTeam(configDir, { ...sampleTeam(), updatedAt: 999 });
		const teams = readTeams(configDir);
		expect(teams).toHaveLength(1);
		expect(teams[0]?.updatedAt).toBe(999);
	});

	it("目录不存在 → 空（首次启动的常态，不是错误）", () => {
		expect(readTeams(join(configDir, "从来没有过"))).toEqual([]);
	});

	it("removeTeam 之后不再出现在读回结果里", () => {
		writeTeam(configDir, sampleTeam());
		removeTeam(configDir, "stock-partner-roundtable");
		expect(readTeams(configDir)).toEqual([]);
	});
});

describe("路径安全（团队名是用户输入）", () => {
	it("含 ../ 的名字被拦下（否则能写到配置目录外）", () => {
		expect(() => teamDir(configDir, "../../evil")).toThrow(/不能用于落盘/);
		expect(() => writeTeam(configDir, sampleTeam("a/b"))).toThrow(/不能用于落盘/);
		expect(() => writeTeam(configDir, sampleTeam(".."))).toThrow(/不能用于落盘/);
		expect(() => writeTeam(configDir, sampleTeam("C:evil"))).toThrow(/不能用于落盘/);
	});

	it("正常名字（字母数字与 -_.）放行", () => {
		expect(() => writeTeam(configDir, sampleTeam("research-ai-v2.1_rc"))).not.toThrow();
	});
});

describe("版本与坏文件", () => {
	it("版本不认识 → 响亮报错（静默当同版本 = 用旧结构喂新代码）", () => {
		writeTeam(configDir, sampleTeam());
		const file = join(teamDir(configDir, "stock-partner-roundtable"), "config.json");
		writeFileSync(file, JSON.stringify({ ...sampleTeam(), version: 99 }), "utf8");
		expect(() => readTeams(configDir)).toThrow(/版本不认识/);
	});

	it("JSON 坏掉 → 抛错（文件只由我们写；daemon 侧会捕获并记日志继续启动）", () => {
		writeTeam(configDir, sampleTeam());
		writeFileSync(join(teamDir(configDir, "stock-partner-roundtable"), "config.json"), "{ 不是 json", "utf8");
		expect(() => readTeams(configDir)).toThrow();
	});
});
