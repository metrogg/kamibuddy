/**
 * session-file 的单元测试。
 *
 * 用真实 `SessionManager` 造 fixture（同 scripts/probe-session-branch.ts 的手法）：
 * 本模块的契约就是「写出来的文件 pi 能原样打开、叶子落在分叉点」，用假 JSON 断言
 * 会漏掉这条。临时目录经 KAMIBUDDY_CONFIG_DIR 隔离（同 preferences.test.ts 范式），
 * 因为路径守卫认的就是 getSessionsDir()。
 *
 * 覆盖：坏行容忍、前缀切分（含 id 不存在）、原子写回后 pi 可打开且叶子正确、
 * parentSession 只动 header 行、仅 header 的空会话、写失败不留半文件、路径守卫。
 */

import {
	appendFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SessionManager, type SessionMessageEntry } from "@earendil-works/pi-coding-agent";
import { getSessionsDir } from "./config-paths.ts";
import {
	createEmptySessionFile,
	createSessionFileFromPrefix,
	readSessionFileLines,
	readSessionHeader,
	sessionPrefixLines,
	setSessionName,
	setSessionParentSession,
	truncateSessionTo,
	writeSessionFileLines,
} from "./session-file.ts";

type PiMessage = SessionMessageEntry["message"];
type PiUserMessage = Extract<PiMessage, { role: "user" }>;
type PiAssistantMessage = Extract<PiMessage, { role: "assistant" }>;

const T0 = Date.UTC(2026, 0, 1, 0, 0, 0);

function userMsg(text: string, at: number): PiUserMessage {
	return { role: "user", content: text, timestamp: at };
}

function assistantMsg(text: string, at: number): PiAssistantMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		api: "openai-completions",
		provider: "session-file-test",
		model: "test-model",
		usage: {
			input: 1,
			output: 1,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 2,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop",
		timestamp: at,
	};
}

interface LinearSession {
	readonly file: string;
	readonly u1: string;
	readonly a1: string;
	readonly u2: string;
	readonly a2: string;
}

/**
 * 造一条线性会话文件：u1 → a1 → u2 → a2。
 * 每条都要有 assistant 才会真落盘（pi 的 _persist 守卫：首个 assistant 到达才写文件）。
 */
function buildLinearSession(): LinearSession {
	const manager = SessionManager.create(cwd, sessionsDir);
	const u1 = manager.appendMessage(userMsg("第一轮问题", T0));
	const a1 = manager.appendMessage(assistantMsg("第一轮回答", T0 + 1000));
	const u2 = manager.appendMessage(userMsg("第二轮问题", T0 + 2000));
	const a2 = manager.appendMessage(assistantMsg("第二轮回答", T0 + 3000));
	const file = manager.getSessionFile();
	if (file === undefined) throw new Error("fixture 未落盘：getSessionFile() 返回 undefined");
	return { file, u1, a1, u2, a2 };
}

/** 文件里的原始行（剔除以 \n 结尾产生的那个空串，与实际内容一一对应）。 */
function rawLines(file: string): string[] {
	const lines = readFileSync(file, "utf8").split("\n");
	if (lines[lines.length - 1] === "") lines.pop();
	return lines;
}

let base: string;
let sessionsDir: string;
let cwd: string;

beforeEach(() => {
	base = mkdtempSync(join(tmpdir(), "kami-session-file-"));
	process.env["KAMIBUDDY_CONFIG_DIR"] = join(base, "config");
	sessionsDir = getSessionsDir();
	cwd = join(base, "workspace");
	mkdirSync(sessionsDir, { recursive: true });
	mkdirSync(cwd, { recursive: true });
});

afterEach(() => {
	delete process.env["KAMIBUDDY_CONFIG_DIR"];
	rmSync(base, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});

describe("readSessionFileLines", () => {
	it("坏行与空行跳过并计数，条目行按文件顺序给出", () => {
		const session = buildLinearSession();
		const before = rawLines(session.file);
		// 坏 JSON 1 行、空行 1 行、能解析但没有 id 的 JSON 1 行
		appendFileSync(session.file, `{ 这不是 JSON\n\n{"type":"message","id":""}\n`, "utf8");

		const read = readSessionFileLines(session.file);
		expect(read.headerLine).toBe(before[0]);
		expect(read.entryLines).toEqual(before.slice(1));
		expect(read.skippedLines).toBe(2);
	});
});

describe("sessionPrefixLines", () => {
	it("按 parentId 链取 root→目标条目的原始行；id 不存在返回 undefined", () => {
		const session = buildLinearSession();
		const lines = rawLines(session.file);

		const prefix = sessionPrefixLines(session.file, session.u2);
		if (prefix === undefined) throw new Error("应能取到 u2 的前缀");
		expect(prefix.headerLine).toBe(lines[0]);
		expect(prefix.entryLines).toEqual([lines[1], lines[2], lines[3]]);

		// 根条目：前缀只有它自己
		expect(sessionPrefixLines(session.file, session.u1)?.entryLines).toEqual([lines[1]]);

		// 调用方传错锚点：返回 undefined，不写任何东西，也不抛错
		expect(sessionPrefixLines(session.file, "no-such-entry")).toBeUndefined();
	});
});

describe("truncateSessionTo", () => {
	it("写回后 pi 能打开，叶子 = 前缀末条，且不留 tmp", () => {
		const session = buildLinearSession();
		expect(truncateSessionTo(session.file, session.a1)).toBe(true);

		const reopened = SessionManager.open(session.file, sessionsDir);
		expect(reopened.getLeafId()).toBe(session.a1);
		expect(reopened.getEntries().map((entry) => entry.id)).toEqual([session.u1, session.a1]);
		expect(rawLines(session.file).length).toBe(3);
		expect(existsSync(`${session.file}.tmp`)).toBe(false);
	});

	it("全量前缀 = 逐字回写（原始行没有被反序列化再序列化）", () => {
		const session = buildLinearSession();
		const before = readFileSync(session.file, "utf8");
		expect(truncateSessionTo(session.file, session.a2)).toBe(true);
		expect(readFileSync(session.file, "utf8")).toBe(before);
	});

	it("id 不存在时返回 false 且文件一个字节都没动", () => {
		const session = buildLinearSession();
		const before = readFileSync(session.file, "utf8");
		expect(truncateSessionTo(session.file, "no-such-entry")).toBe(false);
		expect(readFileSync(session.file, "utf8")).toBe(before);
	});
});

describe("setSessionParentSession", () => {
	it("只改 header 行：其余行逐字节不变，其余字段也不变", () => {
		const mother = buildLinearSession();
		const session = buildLinearSession();
		const before = rawLines(session.file);

		setSessionParentSession(session.file, mother.file);

		const after = rawLines(session.file);
		expect(after.length).toBe(before.length);
		expect(after[0]).not.toBe(before[0]);
		expect(after.slice(1)).toEqual(before.slice(1));

		expect(readSessionHeader(session.file)?.parentSession).toBe(resolve(mother.file));
		const afterHeader = JSON.parse(after[0] ?? "{}") as Record<string, unknown>;
		const beforeHeader = JSON.parse(before[0] ?? "{}") as Record<string, unknown>;
		delete afterHeader["parentSession"];
		expect(afterHeader).toEqual(beforeHeader);
	});
});

describe("createEmptySessionFile", () => {
	it("立刻写出「只有 header 行」的文件，pi 能打开且来源正确", () => {
		const mother = buildLinearSession();
		const path = createEmptySessionFile(cwd, mother.file);

		expect(existsSync(path)).toBe(true);
		expect(rawLines(path).length).toBe(1);

		const opened = SessionManager.open(path, sessionsDir);
		const header = opened.getHeader();
		expect(header?.type).toBe("session");
		expect(header?.parentSession).toBe(resolve(mother.file));
		expect(header?.cwd).toBe(resolve(cwd));
		expect(typeof header?.id).toBe("string");
		expect(Number.isInteger(header?.version)).toBe(true);
		expect(Number.isFinite(Date.parse(header?.timestamp ?? ""))).toBe(true);
		// 空历史：叶子为空、没有条目
		expect(opened.getLeafId()).toBeNull();
		expect(opened.getEntries()).toEqual([]);
	});
});

describe("setSessionName", () => {
	it("走 pi 的 appendSessionInfo；已是目标名则不重复追加", () => {
		const mother = buildLinearSession();
		const path = createEmptySessionFile(cwd, mother.file);

		setSessionName(path, "母会话 · 分支");
		expect(SessionManager.open(path, sessionsDir).getSessionName()).toBe("母会话 · 分支");
		expect(readSessionFileLines(path).entryLines.length).toBe(1);

		setSessionName(path, "母会话 · 分支");
		expect(readSessionFileLines(path).entryLines.length).toBe(1);
	});
});

describe("createSessionFileFromPrefix", () => {
	it("母文件字节不变；新文件可打开且叶子 = 前缀末条", () => {
		const session = buildLinearSession();
		const before = readFileSync(session.file, "utf8");

		const path = createSessionFileFromPrefix(session.file, session.a1);
		if (path === undefined) throw new Error("前缀会话未写出");

		expect(readFileSync(session.file, "utf8")).toBe(before);
		const opened = SessionManager.open(path, sessionsDir);
		expect(opened.getHeader()?.parentSession).toBe(resolve(session.file));
		expect(opened.getLeafId()).toBe(session.a1);
		expect(opened.getEntries().map((entry) => entry.id)).toEqual([session.u1, session.a1]);

		expect(createSessionFileFromPrefix(session.file, "no-such-entry")).toBeUndefined();
	});
});

describe("writeSessionFileLines", () => {
	it("写失败不留半文件：目标不可替换时抛错，目标与 tmp 都不残留", () => {
		// 用同名目标占成目录：rename(file → dir) 各平台都必然失败，是不依赖文件锁的可复现
		// 构造方式（Node 打开的文件在 Windows 上默认允许被 rename 覆盖，锁不住）。
		const blocked = join(sessionsDir, "blocked.jsonl");
		mkdirSync(blocked, { recursive: true });
		writeFileSync(join(blocked, "keep.txt"), "keep", "utf8");

		expect(() => writeSessionFileLines(blocked, ["{}"])).toThrow();
		expect(statSync(blocked).isDirectory()).toBe(true);
		expect(existsSync(join(blocked, "keep.txt"))).toBe(true);
		expect(existsSync(`${blocked}.tmp`)).toBe(false);
	});
});

describe("路径守卫", () => {
	it("会话目录之外、非 .jsonl 一律拒绝（写操作是物理覆盖）", () => {
		const session = buildLinearSession();
		expect(() => readSessionFileLines(join(base, "outside.jsonl"))).toThrow();
		expect(() => truncateSessionTo(join(base, "outside.jsonl"), session.a1)).toThrow();
		expect(() => writeSessionFileLines(join(sessionsDir, "note.txt"), ["{}"])).toThrow();
	});
});
