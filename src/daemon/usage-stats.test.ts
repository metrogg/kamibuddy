import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	aggregateUsageStats,
	calculateStreaks,
	parseSessionFile,
	readUsageStats,
	resetUsageStatsCache,
} from "./usage-stats.ts";

/* ── 会话文件构造小工具（本地时刻，避免时区把日期挪走） ──────────────── */

function at(month: number, day: number, hour: number, minute = 0): number {
	return new Date(2026, month - 1, day, hour, minute, 0, 0).getTime();
}

function header(id: string): string {
	return `${JSON.stringify({ type: "session", id, timestamp: "2026-09-01T00:00:00.000Z" })}\n`;
}

function subagentMarker(): string {
	return `${JSON.stringify({ type: "custom", customType: "subagent_run", data: { agent: "researcher" } })}\n`;
}

function userMessage(t: number): string {
	return `${JSON.stringify({
		type: "message",
		id: `u${t}`,
		timestamp: new Date(t).toISOString(),
		message: { role: "user", content: [{ type: "text", text: "hi" }], timestamp: t },
	})}\n`;
}

interface UsageSpec {
	readonly input: number;
	readonly output: number;
	readonly cacheRead?: number;
	readonly cacheWrite?: number;
	readonly cost?: number;
}

function assistantMessage(
	t: number,
	model: string,
	usage: UsageSpec,
	toolCalls: readonly { readonly id: string; readonly name: string }[] = [],
): string {
	const cacheRead = usage.cacheRead ?? 0;
	const cacheWrite = usage.cacheWrite ?? 0;
	return `${JSON.stringify({
		type: "message",
		id: `a${t}`,
		timestamp: new Date(t).toISOString(),
		message: {
			role: "assistant",
			model,
			usage: {
				input: usage.input,
				output: usage.output,
				cacheRead,
				cacheWrite,
				totalTokens: usage.input + usage.output + cacheRead + cacheWrite,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: usage.cost ?? 0 },
			},
			content: toolCalls.map((call) => ({
				type: "toolCall",
				id: call.id,
				name: call.name,
				arguments: {},
			})),
			stopReason: "stop",
			timestamp: t,
		},
	})}\n`;
}

function toolResultMessage(toolCallId: string, isError: boolean): string {
	return `${JSON.stringify({
		type: "message",
		id: `r${toolCallId}`,
		timestamp: new Date(at(9, 14, 9, 15)).toISOString(),
		message: {
			role: "toolResult",
			toolCallId,
			toolName: "Read",
			content: [],
			isError,
			timestamp: at(9, 14, 9, 15),
		},
	})}\n`;
}

/** 主会话：跨 09-13 / 09-14 两天，一条成功的 Read 与一条失败的 Bash。 */
function mainSession(): string {
	return (
		header("s-main") +
		userMessage(at(9, 13, 10, 0)) +
		assistantMessage(at(9, 13, 10, 5), "model-a", { input: 100, output: 50, cacheRead: 1000, cost: 0.01 }, [
			{ id: "t1", name: "Read" },
		]) +
		toolResultMessage("t1", false) +
		userMessage(at(9, 14, 9, 0)) +
		assistantMessage(at(9, 14, 9, 10), "model-b", { input: 200, output: 80, cacheRead: 2000, cost: 0.02 }, [
			{ id: "t2", name: "Bash" },
		]) +
		toolResultMessage("t2", true)
	);
}

/** 子代理会话：会话维度不计，但 token 与费用要计。 */
function subagentSession(): string {
	return (
		header("s-sub") +
		subagentMarker() +
		userMessage(at(9, 15, 8, 0)) +
		assistantMessage(at(9, 15, 8, 1), "model-sub", { input: 400, output: 100, cost: 0.5 }, [
			{ id: "t9", name: "Grep" },
		]) +
		toolResultMessage("t9", false)
	);
}

/** legacy 会话：assistant 全是 unknown 模型 —— 整体跳过。 */
function legacySession(): string {
	return (
		header("s-legacy") +
		userMessage(at(9, 15, 9, 0)) +
		assistantMessage(at(9, 15, 9, 1), "unknown", { input: 999, output: 999, cost: 9.9 })
	);
}

function parsed(content: string) {
	const result = parseSessionFile(content);
	if (result === null) throw new Error("会话文件解析失败");
	return result;
}

/* ── parseSessionFile ─────────────────────────────────────────────── */

describe("parseSessionFile", () => {
	it("首行不是会话头就返回 null", () => {
		expect(parseSessionFile("not json\n")).toBeNull();
		expect(parseSessionFile(`${JSON.stringify({ type: "message" })}\n`)).toBeNull();
	});

	it("坏行跳过，好行照常解析", () => {
		const content = `${header("s1")}\n{"half": \n${userMessage(at(9, 14, 10, 0))}`;
		const result = parsed(content);
		expect(result.sessionId).toBe("s1");
		expect(result.messages).toHaveLength(1);
	});

	it("识别子代理标记", () => {
		expect(parsed(subagentSession()).isSubagent).toBe(true);
		expect(parsed(mainSession()).isSubagent).toBe(false);
	});

	it("toolResult 不计入消息，但失败会按 toolCallId 记下来", () => {
		const session = parsed(mainSession());
		expect(session.messages).toHaveLength(4); // 2 user + 2 assistant
		expect(session.toolCalls).toEqual([
			{ toolCallId: "t1", toolName: "Read" },
			{ toolCallId: "t2", toolName: "Bash" },
		]);
		expect([...session.toolErrorIds]).toEqual(["t2"]);
	});

	it("拿不到时刻的消息被丢弃，不用 now() 编造", () => {
		const noTime = `${JSON.stringify({ type: "message", message: { role: "user", content: [] } })}\n`;
		expect(parsed(header("s2") + noTime).messages).toHaveLength(0);
	});
});

/* ── aggregateUsageStats ──────────────────────────────────────────── */

describe("aggregateUsageStats", () => {
	const now = new Date(2026, 8, 15, 12, 0);

	it("会话维度排除子代理，但 token 与费用照算", () => {
		const stats = aggregateUsageStats(
			[parsed(mainSession()), parsed(subagentSession())],
			{ now },
		);
		expect(stats.totalSessions).toBe(1);
		expect(stats.totalMessages).toBe(4);
		// 子代理的 Grep 不进工具排行，Read / Bash 是主会话的
		expect(stats.toolUsage.map((t) => t.tool).sort()).toEqual(["Bash", "Read"]);
		// 但 model-sub 的 token 与费用在账上
		const models = stats.modelUsage.map((m) => m.model).sort();
		expect(models).toEqual(["model-a", "model-b", "model-sub"]);
		expect(stats.totalTokens.total).toBe(
			100 + 50 + 1000 + (200 + 80 + 2000) + (400 + 100),
		);
		expect(stats.totalCost).toBeCloseTo(0.53, 6);
	});

	it("legacy 会话（模型全 unknown）整体跳过", () => {
		const stats = aggregateUsageStats([parsed(mainSession()), parsed(legacySession())], { now });
		expect(stats.totalSessions).toBe(1);
		expect(stats.totalCost).toBeCloseTo(0.03, 6);
		expect(stats.modelUsage.some((m) => m.model === "unknown")).toBe(false);
	});

	it("每日活动只算人开的会话（子代理独占的日子不进热力图）", () => {
		const stats = aggregateUsageStats(
			[parsed(mainSession()), parsed(subagentSession())],
			{ now },
		);
		expect(stats.heatmap).toEqual([
			{ date: "2026-09-13", count: 2 },
			{ date: "2026-09-14", count: 2 },
		]);
		// 09-15 只有子代理在跑：不发话，但 token 仍进每日趋势
		expect(stats.dailyTokens.map((d) => d.date)).toContain("2026-09-15");
		expect(stats.activeDays).toBe(2);
		expect(stats.totalDays).toBe(2);
	});

	it("工具失败数按 toolCallId 配对", () => {
		const stats = aggregateUsageStats([parsed(mainSession())], { now });
		expect(stats.toolUsage).toEqual([
			{ tool: "Bash", count: 1, errors: 1 },
			{ tool: "Read", count: 1, errors: 0 },
		]);
	});

	it("模型明细含缓存读写，token 合计与总量一致", () => {
		const stats = aggregateUsageStats([parsed(mainSession())], { now });
		const modelA = stats.modelUsage.find((m) => m.model === "model-a");
		expect(modelA).toEqual({ model: "model-a", count: 1, tokens: 1150, cost: 0.01 });
		const sum = stats.modelUsage.reduce((acc, m) => acc + m.tokens, 0);
		expect(sum).toBe(stats.totalTokens.total);
	});

	it("峰值时段取消息最密的小时，平手取更早的小时", () => {
		const stats = aggregateUsageStats([parsed(mainSession())], { now });
		// 10 点两条、09 点两条 → 平手取 09
		expect(stats.peakHour).toBe(9);
	});

	it("最长与平均会话时长按首末消息之差", () => {
		const stats = aggregateUsageStats([parsed(mainSession())], { now });
		expect(stats.longestSessionMs).toBe(at(9, 14, 9, 10) - at(9, 13, 10, 0));
		expect(stats.averageSessionMs).toBe(stats.longestSessionMs);
		expect(stats.firstSessionAt).toBe(at(9, 13, 10, 0));
		expect(stats.lastSessionAt).toBe(at(9, 14, 9, 10));
	});

	it("没有任何会话时返回空统计", () => {
		const stats = aggregateUsageStats([], { now });
		expect(stats.totalSessions).toBe(0);
		expect(stats.totalTokens.total).toBe(0);
		expect(stats.heatmap).toEqual([]);
		expect(stats.modelUsage).toEqual([]);
	});
});

/* ── calculateStreaks ─────────────────────────────────────────────── */

describe("calculateStreaks", () => {
	const now = new Date(2026, 8, 14, 12, 0);

	it("今天有活动才算当前连续", () => {
		expect(calculateStreaks(["2026-09-13", "2026-09-14"], now)).toEqual({
			current: 2,
			longest: 2,
		});
	});

	it("今天断则当前连续为 0，最长连续照算", () => {
		expect(calculateStreaks(["2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13"], now)).toEqual({
			current: 0,
			longest: 4,
		});
	});

	it("乱序与重复不影响结果", () => {
		expect(calculateStreaks(["2026-09-12", "2026-09-14", "2026-09-13", "2026-09-12"], now)).toEqual({
			current: 3,
			longest: 3,
		});
	});

	it("空集合是 0/0", () => {
		expect(calculateStreaks([], now)).toEqual({ current: 0, longest: 0 });
	});
});

/* ── readUsageStats ───────────────────────────────────────────────── */

describe("readUsageStats", () => {
	let dir: string;

	beforeEach(async () => {
		resetUsageStatsCache();
		dir = await mkdtemp(join(tmpdir(), "kami-stats-"));
	});

	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	it("目录不存在返回空统计（不是错误）", async () => {
		const stats = await readUsageStats(join(dir, "nope"));
		expect(stats.totalSessions).toBe(0);
	});

	it("坏文件跳过并留痕，好文件照常出数", async () => {
		await writeFile(join(dir, "good.jsonl"), mainSession(), "utf8");
		await writeFile(join(dir, "junk.jsonl"), "not a session file\n", "utf8");
		await writeFile(join(dir, "broken.jsonl"), `${header("s3")}\n{"half":`, "utf8");
		await writeFile(join(dir, "notes.txt"), "ignore me", "utf8");

		const reported: string[] = [];
		const stats = await readUsageStats(dir, (message) => reported.push(message));
		expect(stats.totalSessions).toBe(1);
		expect(reported.some((m) => m.includes("junk.jsonl"))).toBe(true);
		// broken.jsonl 是「头合法但内容截断」，条目丢光但仍是一个合法空会话文件
		expect(reported.some((m) => m.includes("broken.jsonl"))).toBe(false);
	});

	it("第二次读取走缓存但结果一致；文件改动后重新解析", async () => {
		const path = join(dir, "s.jsonl");
		await writeFile(path, mainSession(), "utf8");
		const first = await readUsageStats(dir);
		const second = await readUsageStats(dir);
		expect(second).toEqual(first);

		await writeFile(
			path,
			header("s-main") + userMessage(at(9, 20, 10, 0)) + assistantMessage(at(9, 20, 10, 1), "model-c", { input: 1, output: 1 }),
			"utf8",
		);
		// 强制 mtime 变化（同秒内写入 mtimeMs 可能相同，这里显式改回未来）
		const { utimes } = await import("node:fs/promises");
		await utimes(path, new Date(), new Date(Date.now() + 5000));
		const third = await readUsageStats(dir);
		expect(third.modelUsage.map((m) => m.model)).toEqual(["model-c"]);
	});
});
