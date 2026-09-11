/**
 * conversation-search（daemon 侧检索实现）的测试。
 *
 * 用真实临时目录写真 JSONL（pi 的落盘格式：首行 session 头 + 逐条 message），
 * 钉住：AND 分词匹配、每会话取最早命中条目、片段截取（前后约 200 字符）、
 * 标题口径（session_info 命名优先于首条用户消息）、mtime 倒序与 limit、
 * 当前会话排除、坏文件跳过、thinking / toolResult 不参与匹配。
 */

import { mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deriveSessionTitle, searchSessionFiles } from "./conversation-search.ts";

let dir: string;

beforeEach(() => {
	dir = join(tmpdir(), `kbconvsearch-test-${process.pid}-${Date.now()}`);
	mkdirSync(dir, { recursive: true });
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

interface MessageSpec {
	readonly role: "user" | "assistant";
	readonly text: string;
}

/** 写一个最小会话文件：session 头 + 若干 user/assistant 消息（+ 可选命名）。 */
function writeSession(
	fileName: string,
	sessionId: string,
	messages: readonly MessageSpec[],
	options: { readonly name?: string; readonly mtime?: Date } = {},
): string {
	const entries: unknown[] = [
		{ type: "session", version: 3, id: sessionId, timestamp: "2026-09-01T00:00:00.000Z", cwd: "C:\\ws" },
	];
	if (options.name !== undefined) {
		entries.push({ type: "session_info", id: "i0", parentId: null, timestamp: "2026-09-01T00:00:01.000Z", name: options.name });
	}
	messages.forEach((m, i) => {
		const content =
			m.role === "user"
				? m.text
				: [{ type: "text", text: m.text }];
		entries.push({
			type: "message",
			id: `m${i}`,
			parentId: null,
			timestamp: `2026-09-01T00:0${i}:00.000Z`,
			message: { role: m.role, content },
		});
	});
	const path = join(dir, fileName);
	writeFileSync(path, entries.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
	if (options.mtime !== undefined) utimesSync(path, options.mtime, options.mtime);
	return path;
}

describe("匹配与片段", () => {
	it("AND 分词：全部关键词命中同一条目才算命中", async () => {
		writeSession("a.jsonl", "s-a", [
			{ role: "user", text: "我们讨论一下季度汇报的模板" },
			{ role: "assistant", text: "模板用三段式：结论先行、数据对比、下一步计划" },
		]);
		writeSession("b.jsonl", "s-b", [
			{ role: "user", text: "只有季度这个词，没有另一个关键词" },
		]);

		const hits = await searchSessionFiles("季度 模板", 20, { sessionsDir: dir });
		expect(hits.map((h) => h.sessionId)).toEqual(["s-a"]);
		expect(hits[0]?.snippet).toContain("季度汇报");
	});

	it("大小写不敏感（英文关键词）", async () => {
		writeSession("a.jsonl", "s-a", [{ role: "user", text: "上次说的 OKR 评审流程" }]);
		const hits = await searchSessionFiles("okr 评审", 20, { sessionsDir: dir });
		expect(hits).toHaveLength(1);
	});

	it("每会话取最早命中的条目，片段含命中处前后文（长文截断带省略号）", async () => {
		const pad = "长".repeat(300);
		writeSession("a.jsonl", "s-a", [
			{ role: "user", text: `${pad}第一次提到报销流程${pad}` },
			{ role: "assistant", text: "后来又一次提到报销流程的补充说明" },
		]);
		const hits = await searchSessionFiles("报销流程", 20, { sessionsDir: dir });
		expect(hits).toHaveLength(1);
		// 命中在 300 字符之后：片段头部应有省略号，且命中词本体在片段里。
		expect(hits[0]?.snippet.startsWith("…")).toBe(true);
		expect(hits[0]?.snippet).toContain("第一次提到报销流程");
		expect(hits[0]?.snippet).not.toContain("补充说明");
	});

	it("thinking 与 toolResult 不参与匹配", async () => {
		const path = join(dir, "a.jsonl");
		writeFileSync(
			path,
			[
				JSON.stringify({ type: "session", version: 3, id: "s-a", timestamp: "2026-09-01T00:00:00.000Z", cwd: "C:\\ws" }),
				JSON.stringify({
					type: "message", id: "m0", parentId: null, timestamp: "2026-09-01T00:00:00.000Z",
					message: { role: "assistant", content: [{ type: "thinking", thinking: "秘密关键词" }] },
				}),
				JSON.stringify({
					type: "message", id: "m1", parentId: null, timestamp: "2026-09-01T00:01:00.000Z",
					message: { role: "toolResult", toolCallId: "t1", content: [{ type: "text", text: "秘密关键词" }] },
				}),
			].join("\n") + "\n",
			"utf8",
		);
		const hits = await searchSessionFiles("秘密关键词", 20, { sessionsDir: dir });
		expect(hits).toEqual([]);
	});
});

describe("标题口径", () => {
	it("session_info 命名优先，否则首条用户消息截断", async () => {
		writeSession("named.jsonl", "s-named", [{ role: "user", text: "汇报相关的讨论内容很长随便写点" }], { name: "季度汇报专题" });
		writeSession("unnamed.jsonl", "s-unnamed", [{ role: "user", text: "汇报相关的另一条会话" }]);

		const hits = await searchSessionFiles("汇报", 20, { sessionsDir: dir });
		const byId = new Map(hits.map((h) => [h.sessionId, h.title]));
		expect(byId.get("s-named")).toBe("季度汇报专题");
		expect(byId.get("s-unnamed")).toBe("汇报相关的另一条会话");
	});

	it("deriveSessionTitle：超长首条消息压单行截 40 字符加省略号，空消息占位", () => {
		expect(deriveSessionTitle(undefined, "a".repeat(50))).toBe(`${"a".repeat(40)}…`);
		expect(deriveSessionTitle(undefined, "  ")).toBe("（空会话）");
		expect(deriveSessionTitle("命名", "随便")).toBe("命名");
	});
});

describe("扫描顺序与上限", () => {
	it("按文件 mtime 倒序返回，limit 截断", async () => {
		writeSession("old.jsonl", "s-old", [{ role: "user", text: "都命中这个词" }], { mtime: new Date("2026-09-01T00:00:00Z") });
		writeSession("new.jsonl", "s-new", [{ role: "user", text: "也命中这个词" }], { mtime: new Date("2026-09-09T00:00:00Z") });

		const hits = await searchSessionFiles("命中", 20, { sessionsDir: dir });
		expect(hits.map((h) => h.sessionId)).toEqual(["s-new", "s-old"]);

		const one = await searchSessionFiles("命中", 1, { sessionsDir: dir });
		expect(one.map((h) => h.sessionId)).toEqual(["s-new"]);
	});

	it("排除当前会话（excludeSessionId）", async () => {
		writeSession("cur.jsonl", "s-current", [{ role: "user", text: "命中词在当前会话里" }]);
		writeSession("other.jsonl", "s-other", [{ role: "user", text: "命中词在别的会话里" }]);

		const hits = await searchSessionFiles("命中词", 20, {
			sessionsDir: dir,
			excludeSessionId: "s-current",
		});
		expect(hits.map((h) => h.sessionId)).toEqual(["s-other"]);
	});
});

describe("异常输入与坏文件", () => {
	it("目录不存在 → 空结果（首次使用）", async () => {
		const hits = await searchSessionFiles("x", 20, { sessionsDir: join(dir, "nope") });
		expect(hits).toEqual([]);
	});

	it("空白 query 与 limit 0 → 空结果", async () => {
		writeSession("a.jsonl", "s-a", [{ role: "user", text: "内容" }]);
		expect(await searchSessionFiles("   ", 20, { sessionsDir: dir })).toEqual([]);
		expect(await searchSessionFiles("内容", 0, { sessionsDir: dir })).toEqual([]);
	});

	it("坏文件（非会话 JSONL / 半截行）跳过不炸", async () => {
		writeFileSync(join(dir, "broken.jsonl"), "这不是 JSON\n{\"type\":\n", "utf8");
		writeFileSync(join(dir, "good.jsonl"), "半截 JSON 行\n" +
			JSON.stringify({ type: "session", version: 3, id: "s-good", timestamp: "2026-09-01T00:00:00.000Z", cwd: "C:\\ws" }) + "\n" +
			JSON.stringify({ type: "message", id: "m0", parentId: null, timestamp: "2026-09-01T00:00:00.000Z", message: { role: "user", content: "正常命中的内容" } }) + "\n",
			"utf8");

		const hits = await searchSessionFiles("命中", 20, { sessionsDir: dir });
		expect(hits.map((h) => h.sessionId)).toEqual(["s-good"]);
	});

	it("非 jsonl 文件不扫描", async () => {
		writeFileSync(join(dir, "notes.txt"), "命中词", "utf8");
		const hits = await searchSessionFiles("命中词", 20, { sessionsDir: dir });
		expect(hits).toEqual([]);
	});
});
