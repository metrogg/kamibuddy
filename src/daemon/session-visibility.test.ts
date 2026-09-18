/**
 * session-visibility：内部会话判定（头部扫描）的单测。
 *
 * 为什么值得钉：这条判定决定「一条会话在侧栏出不出得来」。判错的两种后果
 * 都不好看 —— 漏判 = 内部会话混进用户的空间区（`.kamibuddy` 假工作空间就是这么
 * 长出来的）；误判 = 用户的会话凭空消失（比混入更难排查）。所以两组都要有。
 *
 * 每个用例用**独立临时文件**（而非同一路径反复写）：判定结果按
 * (path, mtimeMs, size) 记忆化，同 ms 内同长度的两次写入会撞上缓存，
 * 那样的测试验的是缓存而不是逻辑。
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { isInternalSessionFile, readSessionHeadMarkers } from "./session-visibility.ts";

const roots: string[] = [];

/** 建一个带内容的独立会话文件，返回路径。 */
function sessionFile(lines: readonly unknown[]): string {
	const root = mkdtempSync(join(tmpdir(), "kami-sessvis-"));
	roots.push(root);
	const path = join(root, "session.jsonl");
	writeFileSync(path, lines.map((line) => JSON.stringify(line)).join("\n") + "\n", "utf8");
	return path;
}

/** 会话文件头（真实形态，取自实际落盘文件）。 */
const HEADER = { type: "session", version: 1, id: "abc", timestamp: "2026-09-18T00:00:00.000Z", cwd: "C:\\x" };
/** 首条用户消息（真实形态）。 */
const USER_MESSAGE = { type: "message", id: "m1", message: { role: "user", content: "hi" } };

afterAll(() => {
	for (const root of roots) rmSync(root, { recursive: true, force: true });
});

const NO_BUILTIN: ReadonlySet<string> = new Set();
const MEMORY_BUILTIN: ReadonlySet<string> = new Set(["builtin-memory-distill"]);

describe("readSessionHeadMarkers", () => {
	it("普通会话没有任何标记", () => {
		const path = sessionFile([HEADER, USER_MESSAGE]);
		expect(readSessionHeadMarkers(path)).toEqual({ childSession: false, automationTaskId: undefined });
	});

	it("子代理溯源条目 → childSession", () => {
		const path = sessionFile([
			HEADER,
			{ type: "custom", customType: "subagent_run", data: { agentId: "a" }, id: "c1" },
			USER_MESSAGE,
		]);
		expect(readSessionHeadMarkers(path).childSession).toBe(true);
	});

	it("团队成员溯源条目 → childSession", () => {
		const path = sessionFile([
			HEADER,
			{ type: "custom", customType: "team_member", data: {}, id: "c1" },
			USER_MESSAGE,
		]);
		expect(readSessionHeadMarkers(path).childSession).toBe(true);
	});

	it("automation_run 条目取到 taskId（真实形态：data.taskId）", () => {
		const path = sessionFile([
			HEADER,
			{ type: "custom", customType: "automation_run", data: { taskId: "builtin-memory-distill" }, id: "c1" },
			USER_MESSAGE,
		]);
		expect(readSessionHeadMarkers(path).automationTaskId).toBe("builtin-memory-distill");
	});

	it("无关的 custom 条目（如 artifacts_presented）不判定", () => {
		const path = sessionFile([
			HEADER,
			{ type: "custom", customType: "artifacts_presented", data: {}, id: "c1" },
			USER_MESSAGE,
		]);
		expect(readSessionHeadMarkers(path)).toEqual({ childSession: false, automationTaskId: undefined });
	});

	it("automation_run 缺 taskId 时不产生标记（不误判成内部会话）", () => {
		const path = sessionFile([
			HEADER,
			{ type: "custom", customType: "automation_run", data: {}, id: "c1" },
			USER_MESSAGE,
		]);
		expect(readSessionHeadMarkers(path).automationTaskId).toBeUndefined();
	});

	it("坏行 / 半行跳过，不影响后续判定", () => {
		const root = mkdtempSync(join(tmpdir(), "kami-sessvis-"));
		roots.push(root);
		const path = join(root, "session.jsonl");
		writeFileSync(
			path,
			[
				JSON.stringify(HEADER),
				'{"type":"custom","customType":"automation_run","data":{"taskId":"t1"', // 半行
				"not json at all",
				JSON.stringify({ type: "custom", customType: "automation_run", data: { taskId: "t1" }, id: "c1" }),
				JSON.stringify(USER_MESSAGE),
			].join("\n") + "\n",
			"utf8",
		);
		expect(readSessionHeadMarkers(path).automationTaskId).toBe("t1");
	});

	it("文件不存在 → 无标记（判定失败不许让会话从列表消失）", () => {
		const missing = join(tmpdir(), `kami-sessvis-missing-${Date.now()}.jsonl`);
		expect(readSessionHeadMarkers(missing)).toEqual({ childSession: false, automationTaskId: undefined });
	});
});

describe("isInternalSessionFile", () => {
	it("内置任务的运行会话 → 内部（不进侧栏）", () => {
		const path = sessionFile([
			HEADER,
			{ type: "custom", customType: "automation_run", data: { taskId: "builtin-memory-distill" }, id: "c1" },
			USER_MESSAGE,
		]);
		expect(isInternalSessionFile(path, MEMORY_BUILTIN)).toBe(true);
	});

	it("同一个文件在 builtin 集合为空时不算内部 —— 集合变了判定跟着变", () => {
		// 这条钉住「缓存原始标记、不缓存最终布尔值」：若把布尔值按 (path,mtime,size)
		// 记忆化，同一文件的第二次判定会拿到旧结论，用户在设置里删掉内置任务后
		// 该会话仍被隐藏。用同一个 path 连判两次即是这条的回归断言。
		const path = sessionFile([
			HEADER,
			{ type: "custom", customType: "automation_run", data: { taskId: "user-task-1" }, id: "c1" },
			USER_MESSAGE,
		]);
		expect(isInternalSessionFile(path, new Set(["user-task-1"]))).toBe(true);
		expect(isInternalSessionFile(path, NO_BUILTIN)).toBe(false);
		expect(isInternalSessionFile(path, new Set(["user-task-1"]))).toBe(true);
	});

	it("用户自建自动化任务的运行会话**照常可见**（只隐藏内置的）", () => {
		const path = sessionFile([
			HEADER,
			{ type: "custom", customType: "automation_run", data: { taskId: "my-daily-report" }, id: "c1" },
			USER_MESSAGE,
		]);
		expect(isInternalSessionFile(path, MEMORY_BUILTIN)).toBe(false);
	});

	it("子代理会话在 builtin 集合为空时**仍然**内部", () => {
		const path = sessionFile([
			HEADER,
			{ type: "custom", customType: "subagent_run", data: {}, id: "c1" },
			USER_MESSAGE,
		]);
		expect(isInternalSessionFile(path, NO_BUILTIN)).toBe(true);
	});

	it("普通用户会话（有 message、无标记）可见", () => {
		const path = sessionFile([HEADER, USER_MESSAGE]);
		expect(isInternalSessionFile(path, MEMORY_BUILTIN)).toBe(false);
	});

	it("文件不存在 → 可见（宁可多显示一条，也不让用户的会话消失）", () => {
		const missing = join(tmpdir(), `kami-sessvis-missing2-${Date.now()}.jsonl`);
		expect(isInternalSessionFile(missing, MEMORY_BUILTIN)).toBe(false);
	});
});
