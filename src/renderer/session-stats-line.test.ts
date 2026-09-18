/**
 * 会话指标条的行为测试（分组与门控对齐 dsh 的 StatsLine）。
 *
 * 钉住四件事：
 *   1. 格式化档位（秒/分、tok/s 的小数位）
 *   2. 分组门控 —— 没有数据的组**整组消失**，绝不显示 0
 *   3. 整行为空的判定（一组都没有时返回空数组，组件据此不渲染；
 *      空读数条看起来像「这里本该有东西没加载出来」）
 *   4. 缓存浪费组（2026-09-18 加）—— 它是**告警**读数，所以健康时显示 0
 *      而不是整组消失；服务商从不上报缓存活动时两组一起消失（0 在那里
 *      会被读成「没有浪费」，实际是「无从得知」）
 *
 * 第 3 个 describe 里的期望值直接取自 dsh 真实会话的一行读数，
 * 全字段与截图逐字对齐（1 轮 · 27 步 / LLM 1m8s · 工具调用 1m10s /
 * 首 token 平均 1.1s · 241 tok/s / 缓存命中 95.0% / 输入 1.5M tok · 输出 8.9K tok）。
 * 缓存浪费组是本项目在 dsh 之外的追加（dsh 没有 miss 归因）。
 */

import { describe, expect, it } from "vitest";
import { emptyUsage, type SessionStatCard } from "@shared/observability.ts";
import { formatSpan, formatThroughput } from "./reading-format.ts";
import { sessionStatsGroups } from "./session-stats-line.tsx";

function card(overrides: Partial<SessionStatCard> = {}): SessionStatCard {
	return {
		sessionId: "s1",
		runs: 0,
		turns: 0,
		llmMs: 0,
		toolMs: 0,
		ttftMs: 0,
		ttftCalls: 0,
		decodeMs: 0,
		decodeTokens: 0,
		usage: emptyUsage(),
		cacheHitRate: undefined,
		cacheReported: true,
		cacheMissedTokens: 0,
		cacheMissCount: 0,
		lastActiveAt: 0,
		...overrides,
	};
}

describe("formatSpan", () => {
	it("不足一分钟用秒（保留一位小数）", () => {
		expect(formatSpan(45_200)).toBe("45.2s");
		expect(formatSpan(1_000)).toBe("1s");
	});

	it("满一分钟切到 m/s 档", () => {
		expect(formatSpan(68_000)).toBe("1m8s");
		expect(formatSpan(162_000)).toBe("2m42s");
	});
});

describe("formatThroughput", () => {
	it("两位数以上取整", () => {
		expect(formatThroughput(241.4)).toBe("241");
	});

	it("个位数保留一位（慢速时那一位小数才有意义）", () => {
		expect(formatThroughput(4.26)).toBe("4.3");
	});

	it("负数按 0 处理（不显示负速度）", () => {
		expect(formatThroughput(-1)).toBe("0");
	});
});

describe("sessionStatsGroups", () => {
	it("全空卡不产出任何组（组件据此整行不渲染）", () => {
		expect(sessionStatsGroups(card())).toEqual([]);
	});

	it("有步但无用量时只出轮/步组", () => {
		expect(sessionStatsGroups(card({ runs: 1, turns: 27 }))).toEqual(["1 轮 · 27 步"]);
	});

	it("完整卡按 dsh 的顺序产出六组（缓存浪费紧随命中率之后）", () => {
		const groups = sessionStatsGroups(
			card({
				runs: 1,
				turns: 27,
				llmMs: 68_000,
				toolMs: 70_000,
				ttftMs: 2_200,
				ttftCalls: 2,
				decodeMs: 4_000,
				decodeTokens: 964,
				usage: {
					...emptyUsage(),
					input: 500_000,
					cacheRead: 1_000_000,
					output: 8_900,
				},
				cacheHitRate: 0.95,
			}),
		);
		expect(groups).toEqual([
			"1 轮 · 27 步",
			"LLM 1m8s · 工具调用 1m10s",
			"首 token 平均 1.1s · 241 tok/s",
			"缓存命中 95.0%",
			"缓存浪费 0 tok · 0 次",
			"输入 1.5M tok · 输出 8.9K tok",
		]);
	});

	it("没有 TTFT 样本时不产出「首 token 平均」，但仍产出 tok/s", () => {
		const groups = sessionStatsGroups(
			card({ runs: 1, turns: 1, decodeMs: 1_000, decodeTokens: 100 }),
		);
		expect(groups).toContain("100 tok/s");
		expect(groups.some((group) => group.includes("首 token"))).toBe(false);
	});

	it("全部失败（无计费）的会话：看得到轮/步，但没有一排 0 token", () => {
		expect(sessionStatsGroups(card({ runs: 1, turns: 2 }))).toEqual(["1 轮 · 2 步"]);
	});

	it("有输出但输入为 0 时仍产出用量组（门控是「有任一计费」）", () => {
		const groups = sessionStatsGroups(
			card({ runs: 1, turns: 1, usage: { ...emptyUsage(), output: 10 } }),
		);
		expect(groups).toContain("输入 0 tok · 输出 10 tok");
	});

	it("缓存浪费非零时如实报出（这是唯一能涨得动的缓存告警）", () => {
		const groups = sessionStatsGroups(
			card({
				runs: 1,
				turns: 30,
				usage: { ...emptyUsage(), input: 180_767, cacheRead: 2_755_712 },
				cacheHitRate: 0.938,
				cacheMissedTokens: 20_480,
				cacheMissCount: 3,
			}),
		);
		expect(groups).toContain("缓存浪费 20.5K tok · 3 次");
	});

	it("健康会话显示「0 tok · 0 次」，不整组消失", () => {
		// 与上面「没有数据的组整组消失」不冲突：那条管的是**没有数据**。
		// 告警读数在正常时隐藏，就分不出「一切正常」与「这项没接上」。
		const groups = sessionStatsGroups(
			card({
				runs: 1,
				turns: 30,
				usage: { ...emptyUsage(), input: 180_767, cacheRead: 2_755_712 },
				cacheHitRate: 0.938,
			}),
		);
		expect(groups).toContain("缓存浪费 0 tok · 0 次");
	});

	it("服务商从不上报缓存活动时，命中率与缓存浪费两组一起消失", () => {
		// 这个数在没有缓存上报的服务商那里恒为 0，而 0 会被读成「没有浪费」，
		// 实际是「无从得知」—— 同命中率留空而不是显示 0% 的既有判定。
		const groups = sessionStatsGroups(
			card({
				runs: 1,
				turns: 4,
				usage: { ...emptyUsage(), input: 50_000, output: 800 },
				cacheHitRate: undefined,
				cacheReported: false,
			}),
		);
		expect(groups.some((group) => group.includes("缓存"))).toBe(false);
	});
});
