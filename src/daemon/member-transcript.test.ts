/**
 * member-transcript 的单元测试（spec: add-team-pull-model 批次①）。
 *
 * 本模块是「拉模式」的地基：成员状态与产出都从会话 JSONL 派生。
 * 测试分两层：
 *   - **纯函数层**（`deriveMemberStatus` / `normalizeMemberOutput` /
 *     `hasEquivalentMemberOutput`）：直接喂数组，覆盖畸形输入与顺序语义。
 *     这层的用例形状刻意对齐 WorkBuddy 的 `derivePersistedTranscriptStatus`
 *     —— 那条链在我们这儿出过三次丢失事故，判据必须有测试钉住。
 *   - **读文件层**（`readMemberTranscript` / `readMemberTranscriptView`）：
 *     用临时目录 + KAMIBUDDY_CONFIG_DIR 隔离（同 session-file.test.ts 范式），
 *     造真实 JSONL 文件验证解析与容错。
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	deriveMemberStatus,
	extractMemberOutput,
	hasEquivalentMemberOutput,
	memberSessionPath,
	normalizeMemberOutput,
	readMemberTranscript,
	readMemberTranscriptView,
	type MemberTranscriptRecord,
} from "./member-transcript.ts";

/** 造一条判定用记录（只关心 role / text / stopReason）。 */
function rec(
	role: string,
	text: string,
	stopReason?: string,
): MemberTranscriptRecord {
	return { role, text, stopReason };
}

/** 造一条 pi 会话文件里的 message 行。 */
function messageLine(role: string, text: string, stopReason?: string): string {
	const message: Record<string, unknown> = {
		role,
		content: [{ type: "text", text }],
		timestamp: Date.UTC(2026, 8, 19),
	};
	if (stopReason !== undefined) message["stopReason"] = stopReason;
	return JSON.stringify({
		type: "message",
		id: Math.random().toString(16).slice(2, 10),
		parentId: null,
		timestamp: "2026-09-19T00:00:00.000Z",
		message,
	});
}

function assistantDone(text: string): string {
	return messageLine("assistant", text, "stop");
}

describe("deriveMemberStatus · 纯函数判定", () => {
	it("有正文的 assistant + stop → completed", () => {
		expect(deriveMemberStatus([rec("assistant", "产出正文", "stop")])).toBe("completed");
	});

	it("aborted → killed", () => {
		expect(deriveMemberStatus([rec("assistant", "跑一半", "aborted")])).toBe("killed");
	});

	it("error → failed", () => {
		expect(deriveMemberStatus([rec("assistant", "炸了", "error")])).toBe("failed");
	});

	it("length（被截断）→ failed", () => {
		expect(deriveMemberStatus([rec("assistant", "被截断", "length")])).toBe("failed");
	});

	it("空正文的 assistant 不算完成", () => {
		expect(deriveMemberStatus([rec("assistant", "   ", "stop")])).toBeUndefined();
	});

	it("user 记录不参与判定", () => {
		expect(deriveMemberStatus([rec("user", "任务描述")])).toBeUndefined();
	});

	it("空序列 → undefined（派生不出，不是「在跑」）", () => {
		expect(deriveMemberStatus([])).toBeUndefined();
	});

	it("中间态 toolUse 会把之前的完成判定清掉（WorkBuddy 的「清掉」语义）", () => {
		// 先答了一轮完整正文（会被判 completed），之后又继续调工具 —— 那不是最终产出。
		const records = [
			rec("assistant", "先说一句", "stop"),
			rec("assistant", "", "toolUse"),
		];
		expect(deriveMemberStatus(records)).toBeUndefined();
	});

	it("中间态之后正常收尾 → completed", () => {
		const records = [
			rec("assistant", "先说一句", "stop"),
			rec("assistant", "", "toolUse"),
			rec("assistant", "最终产出", "stop"),
		];
		expect(deriveMemberStatus(records)).toBe("completed");
	});

	it("中间态之后那轮被 abort → killed（后面覆盖前面）", () => {
		const records = [
			rec("assistant", "早先的产出", "stop"),
			rec("assistant", "", "toolUse"),
			rec("assistant", "跑一半", "aborted"),
		];
		expect(deriveMemberStatus(records)).toBe("killed");
	});

	it("失败优先于完成（同一轮里先完成的旧记录不掩盖新失败）", () => {
		const records = [
			rec("assistant", "旧的产出", "stop"),
			rec("assistant", "炸了", "error"),
		];
		expect(deriveMemberStatus(records)).toBe("failed");
	});
});

describe("normalizeMemberOutput · 归一化", () => {
	it("剥掉开头的 [Agent ID: ...]", () => {
		expect(normalizeMemberOutput("[Agent ID: abc123] 正文")).toBe("正文");
	});

	it("剥掉结尾的 [Agent ID: ...]", () => {
		expect(normalizeMemberOutput("正文 [Agent ID: abc123]")).toBe("正文");
	});

	it("大小写不敏感", () => {
		expect(normalizeMemberOutput("[agent id: x] 正文")).toBe("正文");
	});

	it("无装饰时只 trim", () => {
		expect(normalizeMemberOutput("  正文  ")).toBe("正文");
	});
});

describe("hasEquivalentMemberOutput · 幂等去重", () => {
	const records = [rec("assistant", "[Agent ID: z9] 三章大纲内容", "stop")];

	it("同一份产出（带装饰差异）判为已存在", () => {
		expect(hasEquivalentMemberOutput(records, "三章大纲内容")).toBe(true);
	});

	it("内容不同判为不存在", () => {
		expect(hasEquivalentMemberOutput(records, "别的内容")).toBe(false);
	});

	it("空产出一律判为不存在（防空串误命中）", () => {
		expect(hasEquivalentMemberOutput(records, "   ")).toBe(false);
	});

	it("user 记录不算数（只看 assistant）", () => {
		expect(hasEquivalentMemberOutput([rec("user", "三章大纲内容")], "三章大纲内容")).toBe(
			false,
		);
	});
});

describe("extractMemberOutput · 取最近一轮产出", () => {
	it("取最后一条有正文的 assistant", () => {
		const out = extractMemberOutput([rec("assistant", "旧产出"), rec("assistant", "新产出")]);
		expect(out).toBe("新产出");
	});

	it("跳过收尾的空记录", () => {
		const out = extractMemberOutput([rec("assistant", "真正的产出"), rec("assistant", "  ")]);
		expect(out).toBe("真正的产出");
	});

	it("没有 assistant 正文 → undefined", () => {
		expect(extractMemberOutput([rec("user", "任务")])).toBeUndefined();
	});
});

describe("readMemberTranscript · 读真实会话文件", () => {
	let configDir: string;

	beforeEach(() => {
		configDir = mkdtempSync(join(tmpdir(), "kamibuddy-transcript-"));
		process.env["KAMIBUDDY_CONFIG_DIR"] = configDir;
		mkdirSync(join(configDir, "sessions"), { recursive: true });
	});

	afterEach(() => {
		delete process.env["KAMIBUDDY_CONFIG_DIR"];
		rmSync(configDir, { recursive: true, force: true });
	});

	/**
	 * 造一个**真实命名**的会话文件：pi 写的是 `<时间戳>_<sessionId>.jsonl`
	 * （`开源项目/pi/.../session-manager.ts:953`）。
	 *
	 * 这里坚持用真实命名而不是 `memberSessionPath()` 自己算出来的路径：
	 * 后者是自洽循环 —— 按 `<id>.jsonl` 造、再按 `<id>.jsonl` 读，永远绿，
	 * 而线上一个成员都读不到（2026-09-19 现场）。
	 */
	const FILE_TIMESTAMP = "2026-09-19T04-27-31-602Z";

	function writeSessionFile(fileName: string, lines: readonly string[]): void {
		writeFileSync(join(configDir, "sessions", fileName), `${lines.join("\n")}\n`, "utf8");
	}

	function writeSession(sessionId: string, lines: readonly string[]): void {
		writeSessionFile(`${FILE_TIMESTAMP}_${sessionId}.jsonl`, lines);
	}

	it("按 pi 的真实命名（<时间戳>_<id>.jsonl）能读到（2026-09-19 回归）", () => {
		writeSession("s-real", [
			messageLine("user", "去画三章大纲"),
			assistantDone("真实命名下的产出"),
		]);
		expect(memberSessionPath("s-real")).toBe(
			join(configDir, "sessions", `${FILE_TIMESTAMP}_s-real.jsonl`),
		);
		const view = readMemberTranscriptView("s-real");
		expect(view.status).toBe("completed");
		expect(view.output).toBe("真实命名下的产出");
	});

	it("直命名 <id>.jsonl 仍可读（旧形态兼容）", () => {
		writeSessionFile("s-direct.jsonl", [assistantDone("直命名产出")]);
		expect(readMemberTranscript("s-direct")[0]?.text).toBe("直命名产出");
	});

	it("超长会话只读尾部：早期记录不进窗口，最近产出照常取回", () => {
		// 真机会话里单个成员文件已到 1 MB；emitTeamProgress 在每次成员工具调用后
		// 都要读一遍，整文件解析会拖住 daemon 主线程（见 TRANSCRIPT_TAIL_BYTES）。
		const filler = messageLine("assistant", "旧".repeat(20_000), "stop"); // 单行约 60 KB
		writeSession("s-long", [...Array.from({ length: 20 }, () => filler), assistantDone("最新的产出")]);
		const view = readMemberTranscriptView("s-long");
		expect(view.output).toBe("最新的产出");
		expect(view.status).toBe("completed");
		// 20 条早期记录 + 1 条尾部记录，窗口只装得下一部分 ⇒ 数量必然少于 21。
		expect(view.messages.length).toBeLessThan(21);
		expect(view.messages.length).toBeGreaterThan(0);
	});

	it("解析 message 条目并跳过非消息条目", () => {
		writeSession("s-1", [
			JSON.stringify({ type: "session", version: 3, id: "s-1" }),
			JSON.stringify({ type: "model_change", id: "m1", parentId: null }),
			messageLine("user", "任务描述"),
			assistantDone("产出正文"),
		]);
		const messages = readMemberTranscript("s-1");
		expect(messages).toHaveLength(2);
		expect(messages[0]?.role).toBe("user");
		expect(messages[1]?.role).toBe("assistant");
		expect(messages[1]?.text).toBe("产出正文");
		expect(messages[1]?.stopReason).toBe("stop");
	});

	it("只拼 text block，忽略 thinking / tool_use", () => {
		const line = JSON.stringify({
			type: "message",
			id: "x1",
			parentId: null,
			message: {
				role: "assistant",
				content: [
					{ type: "thinking", text: "内心活动不该混进正文" },
					{ type: "text", text: "正文" },
					{ type: "tool_use", text: "工具参数" },
				],
				stopReason: "stop",
			},
		});
		writeSession("s-2", [line]);
		expect(readMemberTranscript("s-2")[0]?.text).toBe("正文");
	});

	it("坏行跳过不抛错", () => {
		writeSession("s-3", ["{ 这不是 JSON", assistantDone("好行")]);
		expect(readMemberTranscript("s-3")).toHaveLength(1);
	});

	it("文件不存在 → 空数组，不抛", () => {
		expect(readMemberTranscript("no-such-session")).toEqual([]);
	});

	it("空文件 → 空数组", () => {
		writeSession("s-4", []);
		expect(readMemberTranscript("s-4")).toEqual([]);
	});

	it("读文件层与判定层合起来能派生终态与产出", () => {
		writeSession("s-5", [
			messageLine("user", "去画三章大纲"),
			assistantDone("# 第一章\n内容…"),
		]);
		const view = readMemberTranscriptView("s-5");
		expect(view.status).toBe("completed");
		expect(view.output).toContain("第一章");
	});

	it("被 abort 的会话派生出 killed", () => {
		writeSession("s-6", [
			messageLine("user", "任务"),
			messageLine("assistant", "跑一半就断了", "aborted"),
		]);
		const view = readMemberTranscriptView("s-6");
		expect(view.status).toBe("killed");
		// 中断的那一轮也可能有部分正文 —— 取产出时照样能拿到，由上层决定要不要用。
		expect(view.output).toBe("跑一半就断了");
	});

	it("路径穿越的 sessionId 被守卫拦下（返回空而不是读别的文件）", () => {
		expect(readMemberTranscript("../../../etc/passwd")).toEqual([]);
	});
});
