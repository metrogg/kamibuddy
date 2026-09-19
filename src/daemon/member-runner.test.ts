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
import { turnsDeltaForEvent } from "./member-runner.ts";

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
