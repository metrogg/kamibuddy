/**
 * member-runner 的可测判据。
 *
 * `spawnMember` 本体要真宿主（`SessionHost.create` 起 pi），不适合单测；但**出过事的
 * 那一处**判据已经被抽成纯函数 `turnsDeltaForEvent`，在这里钉住它 ——
 * 它曾经被写错（接线层恒传 0），后果是长 run 期间团队注册表的 `turns` 停在 0，
 * 而同一条 `team_status` 的「最近」写着「已完成 57 轮」（2026-09-19 实测）。
 */

import { describe, expect, it } from "vitest";
import type { SessionEvent } from "../shared/session-events.ts";
import { roundFinishFor, turnsDeltaForEvent } from "./member-runner.ts";

/**
 * 造一个只带判别键的事件。
 *
 * 判据只读 `type`，其余字段与它无关；这里刻意不构造完整事件 —— 那会让测试跟着
 * `SessionEvent` 的形状漂移（要钉的是**判别**，不是那个联合类型的形状）。
 */
function eventOfType(type: SessionEvent["type"]): SessionEvent {
	return { type } as unknown as SessionEvent;
}

describe("turnsDeltaForEvent · 哪个事件算一轮", () => {
	it("assistant_done → 1（一轮真正收尾）", () => {
		expect(turnsDeltaForEvent(eventOfType("assistant_done"))).toBe(1);
	});

	it("工具类事件 → 0（在干活，不等于又完成一轮）", () => {
		for (const type of ["tool_started", "tool_finished", "tool_progress"] as const) {
			expect(turnsDeltaForEvent(eventOfType(type))).toBe(0);
		}
	});

	it("run 终态 / 状态类事件 → 0（轮数只由 assistant_done 记账）", () => {
		for (const type of ["run_finished", "run_error", "session_state"] as const) {
			expect(turnsDeltaForEvent(eventOfType(type))).toBe(0);
		}
	});
});

describe("roundFinishFor · 投递之后该不该收尾（§4.33）", () => {
	/*
	 * 现场：三个成员被 `team_send` 唤醒、都跑完了（会话文件里是完整的收尾报告，
	 * 带 stopReason / usage），界面却一直显示「运行中 · 已等 N 分钟」。
	 * 根因是收尾只挂在首轮上，唤醒那一轮没有 —— 于是 `wakeMember` 投递时翻成的
	 * `running` 再无东西翻回 `idle`。下面两条钉住这条判据。
	 */

	it("未入队（这次真等了一轮）→ 必须收尾 complete", () => {
		expect(roundFinishFor({ queued: false, runError: undefined, cancelled: false })).toEqual({
			kind: "complete",
		});
	});

	it("入队（成员正在跑）→ **不**收尾：那一轮的收尾由先前那次 await 兜住", () => {
		// 少了这条，唤醒轮跑完会重复收尾（轮数与状态说两遍）；
		// 写反成 complete 就是这次的真机 bug。
		expect(roundFinishFor({ queued: true, runError: undefined, cancelled: false })).toEqual({
			kind: "none",
		});
	});

	it("入队优先于失败判定：排队中的投递不该顺手宣告成员失败", () => {
		// runError 是**跨轮累积**的（emit 只在第一次 run_error 时赋值），
		// 所以入队那次调用里可能带着上一轮的旧错 —— 那不是这一轮的结果。
		expect(roundFinishFor({ queued: true, runError: "上一轮的错", cancelled: false })).toEqual({
			kind: "none",
		});
	});

	it("run_error / 被取消 → failed（与首轮的既有口径一致）", () => {
		expect(roundFinishFor({ queued: false, runError: "boom", cancelled: false })).toEqual({
			kind: "failed",
			message: "boom",
		});
		expect(roundFinishFor({ queued: false, runError: undefined, cancelled: true })).toEqual({
			kind: "failed",
			message: "已被中止",
		});
	});
});
