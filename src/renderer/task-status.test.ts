import { describe, expect, it } from "vitest";
import type { SessionSummary } from "@shared/ipc.ts";
import { detectFinishedRuns } from "./task-status.ts";

function summary(overrides: Partial<SessionSummary> & Pick<SessionSummary, "id">): SessionSummary {
	return {
		path: `C:\\sessions\\${overrides.id}.jsonl`,
		title: overrides.id,
		cwd: "D:\\ws\\a",
		isTempTask: false,
		createdAt: 0,
		modifiedAt: 0,
		messageCount: 1,
		current: false,
		running: false,
		...overrides,
	};
}

describe("detectFinishedRuns：running 翻转检测", () => {
	it("true→false 翻转移交出（返回新列表中的项）", () => {
		const prev = [summary({ id: "a", running: true }), summary({ id: "b" })];
		const next = [summary({ id: "a" }), summary({ id: "b" })];

		const finished = detectFinishedRuns(prev, next);

		expect(finished.map((s) => s.id)).toEqual(["a"]);
	});

	it("无翻转（false→false / true→true / false→true）不移交", () => {
		const prev = [
			summary({ id: "stay-idle" }),
			summary({ id: "stay-running", running: true }),
			summary({ id: "just-started" }),
		];
		const next = [
			summary({ id: "stay-idle" }),
			summary({ id: "stay-running", running: true }),
			summary({ id: "just-started", running: true }),
		];

		expect(detectFinishedRuns(prev, next)).toEqual([]);
	});

	it("首份推送（prev 为空）不报任何完成 —— 没有「之前在跑」的凭据", () => {
		expect(detectFinishedRuns([], [summary({ id: "a" })])).toEqual([]);
	});

	it("next 为空（会话全被删）不报完成", () => {
		expect(detectFinishedRuns([summary({ id: "a", running: true })], [])).toEqual([]);
	});

	it("仅在 next 出现的项（新会话落库即非 running）不算翻转", () => {
		const prev = [summary({ id: "a", running: true })];
		const next = [summary({ id: "a", running: true }), summary({ id: "b" })];

		expect(detectFinishedRuns(prev, next)).toEqual([]);
	});

	it("prev 有而 next 消失的项被忽略（删除路径不打未读）", () => {
		const prev = [summary({ id: "a", running: true }), summary({ id: "b", running: true })];
		const next = [summary({ id: "a" })];

		const finished = detectFinishedRuns(prev, next);

		expect(finished.map((s) => s.id)).toEqual(["a"]);
	});

	it("多个会话同时翻转移交全部（多任务并发）", () => {
		const prev = [
			summary({ id: "a", running: true }),
			summary({ id: "b", running: true }),
			summary({ id: "c", running: true }),
		];
		const next = [summary({ id: "a" }), summary({ id: "b" }), summary({ id: "c", running: true })];

		const finished = detectFinishedRuns(prev, next);

		expect(finished.map((s) => s.id)).toEqual(["a", "b"]);
	});
});
