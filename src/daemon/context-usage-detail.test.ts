/**
 * 恢复派生用量明细的行为测试。
 *
 * 背景（2026-09 修复）：resumeSession 曾把 usageDetail 无条件清空，恢复历史
 * 会话后上下文圆环消失，直到下一次模型响应才回来。修复后明细由这里测的
 * 纯函数派生 —— daemon/index.ts 模块副作用重（import 即起 parentPort 校验、
 * 资源加载、EventLog），测不了，这份测试是它唯一的护栏。
 */

import { describe, expect, it } from "vitest";
import { deriveContextUsageDetail } from "./context-usage-detail.ts";
import type { ConversationEntry, ToolCard } from "../shared/session-events.ts";

function toolCard(id: string): ToolCard {
	return {
		id,
		role: "tool",
		toolName: "read",
		label: "已读取",
		summary: "a.ts",
		outcome: "ok",
		detail: undefined,
		at: 3,
	};
}

const entries: readonly ConversationEntry[] = [
	{ id: "u1", role: "user", text: "你好", at: 1 },
	{ id: "a1", role: "assistant", text: "你好", thinking: "想想", at: 2 },
	toolCard("t1"),
];

describe("deriveContextUsageDetail", () => {
	it("contextUsage 存在：used/total 原样透传，成分来自重建 entries", () => {
		// estimateComposition 的口径：user「你好」=2，assistant 文本 2 + 思考 2，
		// 工具卡「a.ts\n」=2；system 100 里拆出 skills 20（buildContextUsage 的钳位）。
		const detail = deriveContextUsageDetail({
			entries,
			contextUsage: { usedTokens: 1234, maxTokens: 128_000 },
			systemPromptTokens: 100,
			skillsTokens: 20,
		});
		expect(detail).toEqual({
			used: 1234,
			total: 128_000,
			byCategory: {
				systemPrompt: 80,
				skills: 20,
				conversation: 6,
				toolResults: 2,
			},
		});
	});

	it("contextUsage 缺失（压缩后无响应的空窗）：返回 undefined，圆环隐藏", () => {
		expect(
			deriveContextUsageDetail({
				entries,
				contextUsage: undefined,
				systemPromptTokens: 100,
				skillsTokens: 20,
			}),
		).toBeUndefined();
	});

	it("没有可估的东西（空会话且无提示词估算）：返回 undefined，不发明细", () => {
		expect(
			deriveContextUsageDetail({
				entries: [],
				contextUsage: { usedTokens: 0, maxTokens: 1000 },
				systemPromptTokens: 0,
				skillsTokens: 0,
			}),
		).toBeUndefined();
	});
});
