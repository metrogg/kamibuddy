/**
 * session-rebuild 的单元测试。
 *
 * 覆盖恢复视图的三条主线：
 * 1. 消息映射（user 文本/图片附件、assistant 的 text+thinking+usage、id/at 取自条目）；
 * 2. 工具卡配对（ok / isError→error / 孤儿→aborted / detail 截断 / 摘要与标签）；
 * 3. 跳过项（非 message 条目逐类型、toolResult 等特殊 role、混入的 session 头不炸）。
 * 外加 resume 路径守卫的边界。
 *
 * 条目全是对象字面量（buildContextEntries 的输出形状），不碰 pi 运行时实例。
 */

import { describe, expect, it } from "vitest";
import { join, resolve } from "node:path";
import type { SessionEntry, SessionMessageEntry } from "@earendil-works/pi-coding-agent";
import type {
	AssistantMessage,
	ConversationEntry,
	ToolCard,
	UserMessage,
} from "../shared/session-events.ts";
import {
	buildConversationEntries,
	validateSessionFilePath,
} from "./session-rebuild.ts";
import { restoredToolLabel } from "./session-host.ts";

const TS = "2026-09-01T08:00:00.000Z";
const AT = Date.parse(TS);

type PiAssistantMessage = Extract<SessionMessageEntry["message"], { role: "assistant" }>;
type AssistantContent = PiAssistantMessage["content"];

const USAGE = {
	input: 10,
	output: 5,
	cacheRead: 2,
	cacheWrite: 1,
	totalTokens: 18,
	cost: { input: 0.001, output: 0.002, cacheRead: 0, cacheWrite: 0, total: 0.003 },
};

function userEntry(
	id: string,
	content: string | Extract<SessionMessageEntry["message"], { role: "user" }>["content"],
): SessionEntry {
	return {
		type: "message",
		id,
		parentId: null,
		timestamp: TS,
		message: { role: "user", content, timestamp: AT },
	};
}

function assistantEntry(
	id: string,
	content: AssistantContent,
	opts?: { usage?: PiAssistantMessage["usage"]; timestamp?: string },
): SessionEntry {
	return {
		type: "message",
		id,
		parentId: null,
		timestamp: opts?.timestamp ?? TS,
		message: {
			role: "assistant",
			content,
			api: "anthropic-messages",
			provider: "anthropic",
			model: "claude-test",
			usage: opts?.usage ?? USAGE,
			stopReason: "stop",
			timestamp: AT,
		},
	};
}

function toolResultEntry(
	id: string,
	toolCallId: string,
	text: string,
	isError = false,
): SessionEntry {
	return {
		type: "message",
		id,
		parentId: null,
		timestamp: TS,
		message: {
			role: "toolResult",
			toolCallId,
			toolName: "read",
			content: [{ type: "text", text }],
			isError,
			timestamp: AT,
		},
	};
}

function asUser(entry: ConversationEntry): UserMessage {
	if (entry.role !== "user") throw new Error(`expected user, got ${entry.role}`);
	return entry;
}

function asAssistant(entry: ConversationEntry): AssistantMessage {
	if (entry.role !== "assistant") throw new Error(`expected assistant, got ${entry.role}`);
	return entry;
}

function asTool(entry: ConversationEntry): ToolCard {
	if (entry.role !== "tool") throw new Error(`expected tool, got ${entry.role}`);
	return entry;
}

describe("buildConversationEntries · 消息映射", () => {
	it("user 的 string content 直接成为 UserMessage（无 images 键），id/at 取自条目", () => {
		const out = buildConversationEntries([userEntry("u1", "帮我写个周报")]);
		expect(out).toHaveLength(1);
		const msg = asUser(out[0]!);
		expect(msg).toEqual({ id: "u1", role: "user", text: "帮我写个周报", at: AT });
		// toEqual 已保证形状，这里显式断言键缺席：无图时带空数组会让 UI 渲染一行空缩略图。
		expect("images" in msg).toBe(false);
	});

	it("user 的 blocks：text 只拼 text 块（无占位混入），image 块映射进 images 字段", () => {
		const out = buildConversationEntries([
			userEntry("u2", [
				{ type: "text", text: "看图：" },
				{ type: "image", data: "base64...", mimeType: "image/png" },
				{ type: "text", text: "说话" },
			]),
		]);
		const msg = asUser(out[0]!);
		expect(msg.text).toBe("看图：说话");
		expect(msg.text).not.toContain("[图片]");
		expect(msg.images).toEqual([{ type: "image", data: "base64...", mimeType: "image/png" }]);
	});

	it("user 的 blocks：多张图片按出现顺序收进 images，text 与图片互不混入", () => {
		const out = buildConversationEntries([
			userEntry("u3", [
				{ type: "image", data: "img1", mimeType: "image/png" },
				{ type: "text", text: "对比这两张" },
				{ type: "image", data: "img2", mimeType: "image/jpeg" },
			]),
		]);
		const msg = asUser(out[0]!);
		expect(msg.text).toBe("对比这两张");
		expect(msg.images).toEqual([
			{ type: "image", data: "img1", mimeType: "image/png" },
			{ type: "image", data: "img2", mimeType: "image/jpeg" },
		]);
	});

	it("assistant：text/thinking 多块拼接，usage 翻译成 TokenUsage（cost 取 total）", () => {
		const out = buildConversationEntries([
			assistantEntry("a1", [
				{ type: "thinking", thinking: "先想" },
				{ type: "text", text: "第一句" },
				{ type: "thinking", thinking: "再想" },
				{ type: "text", text: "第二句" },
			]),
		]);
		expect(out).toHaveLength(1);
		expect(asAssistant(out[0]!)).toEqual({
			id: "a1",
			role: "assistant",
			text: "第一句第二句",
			thinking: "先想再想",
			usage: { input: 10, output: 5, cacheRead: 2, cacheWrite: 1, totalTokens: 18, cost: 0.003 },
			at: AT,
		});
	});

	it("assistant 无 thinking 块时 thinking 键为 undefined，不是空串", () => {
		const out = buildConversationEntries([assistantEntry("a2", [{ type: "text", text: "hi" }])]);
		const msg = asAssistant(out[0]!);
		expect(msg.thinking).toBeUndefined();
		expect("thinking" in msg).toBe(false);
	});

	it("落盘数据缺 usage（旧版本/中断写入）时不下发 usage 键", () => {
		const broken = assistantEntry("a3", [{ type: "text", text: "半截" }]);
		if (broken.type !== "message") throw new Error("unreachable");
		// pi 类型上 usage 必填，用运行时删除模拟旧 JSONL 的实际形状。
		delete (broken.message as unknown as Record<string, unknown>)["usage"];
		const out = buildConversationEntries([broken]);
		expect(asAssistant(out[0]!).usage).toBeUndefined();
	});

	it("at 来自 entry.timestamp 的 Date.parse，而非消息内的时间戳", () => {
		const out = buildConversationEntries([
			assistantEntry("a4", [{ type: "text", text: "x" }], { timestamp: "2026-09-05T12:30:00.000Z" }),
		]);
		expect(asAssistant(out[0]!).at).toBe(Date.parse("2026-09-05T12:30:00.000Z"));
	});
});

describe("buildConversationEntries · 工具卡配对", () => {
	const call = (id: string, name = "read", args: Record<string, unknown> = {}): AssistantContent[number] => ({
		type: "toolCall",
		id,
		name,
		arguments: args,
	});

	it("toolResult 配对成功（isError=false）→ outcome ok，detail 为结果正文", () => {
		const out = buildConversationEntries([
			assistantEntry("a1", [{ type: "text", text: "读一下" }, call("c1", "read", { path: "a.md" })]),
			toolResultEntry("r1", "c1", "文件内容"),
		]);
		expect(out.map((e) => e.role)).toEqual(["assistant", "tool"]);
		const card = asTool(out[1]!);
		expect(card).toMatchObject({
			id: "c1",
			toolName: "read",
			summary: "a.md",
			outcome: "ok",
			detail: "文件内容",
			at: AT,
		});
	});

	it("isError=true → outcome error", () => {
		const out = buildConversationEntries([
			assistantEntry("a1", [call("c1")]),
			toolResultEntry("r1", "c1", "permission denied", true),
		]);
		expect(asTool(out[1]!).outcome).toBe("error");
		expect(asTool(out[1]!).detail).toBe("permission denied");
	});

	it("孤儿 toolCall（结果从未落盘）→ outcome aborted，detail undefined", () => {
		const out = buildConversationEntries([assistantEntry("a1", [call("c1")])]);
		const card = asTool(out[1]!);
		expect(card.outcome).toBe("aborted");
		expect(card.detail).toBeUndefined();
	});

	it("detail 超过 4000 字符截断并标注「（已截断）」，恰好 4000 不截", () => {
		const long = buildConversationEntries([
			assistantEntry("a1", [call("c1")]),
			toolResultEntry("r1", "c1", "x".repeat(5000)),
		]);
		const detail = asTool(long[1]!).detail;
		expect(detail).toBe("x".repeat(4000) + "（已截断）");

		const exact = buildConversationEntries([
			assistantEntry("a1", [call("c1")]),
			toolResultEntry("r1", "c1", "y".repeat(4000)),
		]);
		expect(asTool(exact[1]!).detail).toBe("y".repeat(4000));
	});

	it("空正文结果 → detail undefined（与 session-host 的空串不上屏口径一致）", () => {
		const out = buildConversationEntries([
			assistantEntry("a1", [call("c1")]),
			toolResultEntry("r1", "c1", ""),
		]);
		expect(asTool(out[1]!).detail).toBeUndefined();
	});

	it("summary：path 优先，filePath 次之，都没有退回工具名", () => {
		const out = buildConversationEntries([
			assistantEntry("a1", [
				call("c1", "read", { path: "p.md", filePath: "fp.md" }),
				call("c2", "edit", { filePath: "fp.md" }),
				call("c3", "web_search", { query: "q" }),
			]),
		]);
		expect(asTool(out[1]!).summary).toBe("p.md");
		expect(asTool(out[2]!).summary).toBe("fp.md");
		expect(asTool(out[3]!).summary).toBe("web_search");
	});

	it("label：resolveToolLabel 收到工具名与 outcome，没有则回落工具名", () => {
		const entries = [assistantEntry("a1", [call("c1", "web_search")])];
		const seen: Array<[string, string]> = [];
		const withResolver = buildConversationEntries(entries, (name, outcome) => {
			seen.push([name, outcome]);
			return "已搜索";
		});
		expect(asTool(withResolver[1]!).label).toBe("已搜索");
		// 孤儿 toolCall 的 outcome 是 aborted —— 解析器必须拿到它才能避开完成态词汇。
		expect(seen).toEqual([["web_search", "aborted"]]);
		const without = buildConversationEntries(entries);
		expect(asTool(without[1]!).label).toBe("web_search");
	});

	/*
	 * 2026-09-09 事故的回归护栏：两个区外 edit 在参数生成阶段被中断（从未执行），
	 * 恢复视图却显示「已修改」，用户以为文件已被改。恢复路径的 label 必须按
	 * outcome 分派 —— 非 ok 的卡一律不许出现完成态词汇。
	 */
	it("restoredToolLabel：孤儿（aborted）edit 卡 label 含「未完成」、不含「已修改」", () => {
		const out = buildConversationEntries(
			[assistantEntry("a1", [call("c1", "edit", { path: "D:\\work\\home-view.tsx" })])],
			restoredToolLabel,
		);
		const card = asTool(out[1]!);
		expect(card.outcome).toBe("aborted");
		expect(card.label).toContain("未完成");
		expect(card.label).not.toContain("已修改");
	});

	it("restoredToolLabel：孤儿（aborted）write 卡 label 为「生成（未完成）」", () => {
		const out = buildConversationEntries(
			[assistantEntry("a1", [call("c1", "write", { path: "report.html" })])],
			restoredToolLabel,
		);
		expect(asTool(out[1]!).label).toBe("生成（未完成）");
	});

	it("restoredToolLabel：ok 的 edit / write 卡仍是完成态词汇（已修改 / 已生成）", () => {
		const out = buildConversationEntries(
			[
				assistantEntry("a1", [call("c1", "edit", { path: "a.md" }), call("c2", "write", { path: "b.md" })]),
				toolResultEntry("r1", "c1", "ok"),
				toolResultEntry("r2", "c2", "ok"),
			],
			restoredToolLabel,
		);
		expect(asTool(out[1]!).label).toBe("已修改");
		expect(asTool(out[2]!).label).toBe("已生成");
	});

	it("restoredToolLabel：error 的 read 卡 label 走 doneLabel 的非 ok 形态（失败），不是「已读取」", () => {
		const out = buildConversationEntries(
			[assistantEntry("a1", [call("c1", "read", { path: "a.md" })]), toolResultEntry("r1", "c1", "permission denied", true)],
			restoredToolLabel,
		);
		const card = asTool(out[1]!);
		expect(card.outcome).toBe("error");
		expect(card.label).toBe("失败");
		expect(card.label).not.toContain("已读取");
	});

	it("一条 assistant 先产出消息本体，再按 toolCall 出现顺序产出其工具卡", () => {
		const out = buildConversationEntries([
			assistantEntry("a1", [call("c1"), { type: "text", text: "中间" }, call("c2")]),
			toolResultEntry("r1", "c2", "后执行的先落盘也行"),
			toolResultEntry("r2", "c1", "ok"),
		]);
		expect(out.map((e) => (e.role === "tool" ? e.id : e.role))).toEqual(["assistant", "c1", "c2"]);
		expect(asTool(out[1]!).outcome).toBe("ok");
		expect(asTool(out[2]!).outcome).toBe("ok");
	});

	it("todo_write 卡从落盘 args 重建 todos（与 live 路径同一解析函数），恢复标签「任务列表」", () => {
		const out = buildConversationEntries(
			[
				assistantEntry("a1", [
					call("c1", "todo_write", {
						todos: [
							{ content: "整理数据", status: "completed" },
							{ content: "写报告", activeForm: "正在写报告", status: "in_progress" },
							// 落盘数据可能脏（旧版/手滑）：脏项剔除，卡片照常重建。
							{ content: "状态非法", status: "doing" },
						],
					}),
				]),
				toolResultEntry("r1", "c1", "待办清单已更新。"),
			],
			restoredToolLabel,
		);
		const card = asTool(out[1]!);
		expect(card.label).toBe("任务列表");
		expect(card.todos).toEqual([
			{ content: "整理数据", status: "completed" },
			{ content: "写报告", activeForm: "正在写报告", status: "in_progress" },
		]);
	});
});

describe("buildConversationEntries · 跳过项", () => {
	it("非 message 条目逐类型跳过：compaction / model_change / thinking_level_change / label / session_info / custom / custom_message", () => {
		const base = { parentId: null, timestamp: TS };
		const entries: SessionEntry[] = [
			{ ...base, type: "compaction", id: "e1", summary: "s", firstKeptEntryId: "x", tokensBefore: 1 },
			{ ...base, type: "model_change", id: "e2", provider: "p", modelId: "m" },
			{ ...base, type: "thinking_level_change", id: "e3", thinkingLevel: "high" },
			{ ...base, type: "label", id: "e4", targetId: "x", label: "l" },
			{ ...base, type: "session_info", id: "e5", name: "n" },
			{ ...base, type: "custom", id: "e6", customType: "t", data: {} },
			{ ...base, type: "custom_message", id: "e7", customType: "t", content: "c", display: true },
			userEntry("u1", "只有这条该出现"),
		];
		const out = buildConversationEntries(entries);
		expect(out).toHaveLength(1);
		expect(asUser(out[0]!).text).toBe("只有这条该出现");
	});

	it("toolResult / bashExecution / custom / branchSummary / compactionSummary 的 message 条目不产出", () => {
		const base = { parentId: null, timestamp: TS };
		const entries: SessionEntry[] = [
			toolResultEntry("r1", "nobody", "孤儿结果也不上屏"),
			{
				...base, type: "message", id: "m1",
				message: { role: "bashExecution", command: "ls", output: "o", exitCode: 0, cancelled: false, truncated: false, timestamp: AT },
			},
			{
				...base, type: "message", id: "m2",
				message: { role: "custom", customType: "t", content: "c", display: true, timestamp: AT },
			},
			{
				...base, type: "message", id: "m3",
				message: { role: "branchSummary", summary: "s", fromId: null, timestamp: AT },
			},
			{
				...base, type: "message", id: "m4",
				message: { role: "compactionSummary", summary: "s", tokensBefore: 1, timestamp: AT },
			},
		];
		expect(buildConversationEntries(entries)).toEqual([]);
	});

	it("混入的 session 头（FileEntry 形状）不导致崩溃，按非 message 条目跳过", () => {
		const header = {
			type: "session",
			version: 3,
			id: "s1",
			timestamp: TS,
			cwd: "C:\\work",
		} as unknown as SessionEntry;
		const out = buildConversationEntries([header, userEntry("u1", "hi")]);
		expect(out).toHaveLength(1);
	});
});

describe("buildConversationEntries · 产物恢复", () => {
	// 形状与「跳过项」里的 custom 条目一致：appendCustomEntry 落盘的 { customType, data }。
	function artifactsEntry(id: string, data: unknown): SessionEntry {
		return { type: "custom", id, parentId: null, timestamp: TS, customType: "artifacts_presented", data };
	}

	const files = [
		{ path: "E:/w/a.html", size: 100, html: true, kind: "local" as const },
		{ path: "E:/w/b.md", size: 50, html: false, kind: "local" as const },
	];

	it("artifacts_presented custom 条目翻译成产物条目：files/focusFile 取自 data，at 为条目时间戳", () => {
		const out = buildConversationEntries([
			artifactsEntry("p1", { files, focusFile: "E:/w/a.html" }),
		]);
		expect(out).toHaveLength(1);
		expect(out[0]).toEqual({
			id: "p1",
			role: "artifacts_presented",
			files,
			focusFile: "E:/w/a.html",
			at: AT,
		});
	});

	it("data 缺 files 键的 artifacts_presented 条目跳过不产出", () => {
		const out = buildConversationEntries([artifactsEntry("p1", { focusFile: "E:/w/a.html" })]);
		expect(out).toEqual([]);
	});

	it("产物条目单独扫尾追加，出现在消息条目之后（与落盘位置无关）", () => {
		const out = buildConversationEntries([
			artifactsEntry("p1", { files, focusFile: "E:/w/a.html" }),
			userEntry("u1", "hi"),
		]);
		expect(out.map((e) => e.role)).toEqual(["user", "artifacts_presented"]);
	});
});

describe("validateSessionFilePath", () => {
	const DIR = resolve("fake-sessions");

	it("会话目录内的 .jsonl → 合法（undefined）", () => {
		expect(validateSessionFilePath(join(DIR, "abc.jsonl"), DIR)).toBeUndefined();
	});

	it("会话目录的子目录内也合法", () => {
		expect(validateSessionFilePath(join(DIR, "sub", "abc.jsonl"), DIR)).toBeUndefined();
	});

	it("../ 穿越出会话目录 → 拒绝", () => {
		expect(validateSessionFilePath(join(DIR, "..", "evil.jsonl"), DIR)).toContain("会话目录");
	});

	it("前缀撞名（sessions-evil）不算在目录内", () => {
		expect(validateSessionFilePath(join(DIR + "-evil", "x.jsonl"), DIR)).toContain("会话目录");
	});

	it("非 .jsonl 扩展名 → 拒绝", () => {
		expect(validateSessionFilePath(join(DIR, "x.txt"), DIR)).toContain(".jsonl");
	});

	it("相对路径 → 拒绝", () => {
		expect(validateSessionFilePath(join("relative", "x.jsonl"), DIR)).toContain("绝对路径");
	});
});
