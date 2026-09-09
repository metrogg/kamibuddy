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

	it("label：有 resolveToolLabel 用其返回值，没有回落工具名", () => {
		const entries = [assistantEntry("a1", [call("c1", "web_search")])];
		const withResolver = buildConversationEntries(entries, () => "已搜索");
		expect(asTool(withResolver[1]!).label).toBe("已搜索");
		const without = buildConversationEntries(entries);
		expect(asTool(without[1]!).label).toBe("web_search");
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
