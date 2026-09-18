/**
 * 步行 token 读数的构成（2026-09-18 起含「新增」）。
 *
 * 钉住的是**构成**而不是格式串本身：读数里必须同时出现
 *   ① 上下文总量（prompt 侧三桶之和 = 已缓存 + 新增 + 缓存写入）
 *   ② **新增**（未命中输入 = 这一步真正新加进上下文的内容）
 *   ③ 模型输出
 *
 * 少掉 ② 就是这条改动要修的那个毛病：面板原来只给 ① 与 ③，而"新增"里有一半是
 * **工具返回的正文** —— 它既不在 ① 里（① 是总量）、也不在 ③ 里（③ 只是模型输出），
 * 于是缓存命中一掉（比如 94%）看起来像"缓存漏了 6%"，其实只是这一步读进来的新东西多。
 * 期望值取自真实会话（台账 01a0b4c4 的第 32、35 步）。
 */

import { describe, expect, it } from "vitest";
import { emptyUsage } from "@shared/observability.ts";
import { stepTokenReading } from "./task-diagnostics-panel.tsx";

describe("stepTokenReading", () => {
	it("三个数各就各位：上下文总量 / 新增 / 输出", () => {
		// 22:04:31 那一步的真实读数：194.4K 的上下文里有 11.0K 是新加进来的，
		// 所以面板上的「缓存 94%」= 183.4K ÷ 194.4K —— 那一行自解释。
		expect(
			stepTokenReading({ ...emptyUsage(), input: 11_000, cacheRead: 183_400, output: 1_500 }),
		).toBe("↑194.4K 新增 11.0K ↓1.5K");
	});

	it("几乎全命中的一步也如实写出「新增」的小值（不省略成 0 或整项省掉）", () => {
		// 22:05:49 那一步：200.2K 里只有 0.4K 是新的 —— 读数要能读出
		// 「这一步几乎没读新东西」，那正是它命中 99.8% 的原因。
		expect(
			stepTokenReading({ ...emptyUsage(), input: 400, cacheRead: 199_800, output: 300 }),
		).toBe("↑200.2K 新增 400 ↓300");
	});

	it("缓存写入也算进上下文总量（三桶口径，与 ↑ 的既有实现同一处）", () => {
		expect(
			stepTokenReading({
				...emptyUsage(),
				input: 100,
				cacheRead: 900,
				cacheWrite: 200,
				output: 5,
			}),
		).toBe("↑1.2K 新增 100 ↓5");
	});
});
