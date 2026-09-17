import { describe, expect, it } from "vitest";
import type { AssistantMessage, ConversationEntry, UserMessage } from "@shared/session-events.ts";
import { branchTargetsOf } from "./branch-target.ts";

function user(id: string, text: string, skillNames?: readonly string[]): UserMessage {
	return { id, role: "user", text, at: 0, ...(skillNames === undefined ? {} : { skillNames }) };
}

function assistant(id: string, text: string): AssistantMessage {
	return { id, role: "assistant", text, at: 0 };
}

describe("branchTargetsOf：用户消息序号与原文", () => {
	it("序号只数用户消息，非用户条目一律不计", () => {
		const entries: readonly ConversationEntry[] = [
			user("u1", "第一问"),
			assistant("a1", "第一答"),
			user("u2", "第二问"),
			assistant("a2", "第二答"),
		];

		const targets = branchTargetsOf(entries);

		expect(targets.get("u1")).toEqual({ userIndex: 0, text: "第一问" });
		expect(targets.get("u2")).toEqual({ userIndex: 1, text: "第二问" });
	});

	it("助手 / 错误条目不在表里（入口只挂在用户消息上）", () => {
		const entries: readonly ConversationEntry[] = [
			user("u1", "问"),
			assistant("a1", "答"),
			{ id: "e1", role: "error", message: "炸了", runId: "r1", at: 0 },
		];

		const targets = branchTargetsOf(entries);

		expect([...targets.keys()]).toEqual(["u1"]);
	});

	it("技能消息按 `/skill:<name> ` 回拼（只调技能、无正文时也不例外）", () => {
		const entries: readonly ConversationEntry[] = [user("u1", "写周报", ["docx"]), user("u2", "", ["pptx"])];

		const targets = branchTargetsOf(entries);

		expect(targets.get("u1")?.text).toBe("/skill:docx 写周报");
		expect(targets.get("u2")?.text).toBe("/skill:pptx");
	});

	it("空会话返回空表", () => {
		expect(branchTargetsOf([]).size).toBe(0);
	});
});
