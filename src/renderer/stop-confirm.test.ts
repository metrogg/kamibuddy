import { describe, expect, it } from "vitest";
import { STOP_CONFIRM_WINDOW_MS, stopConfirmExpired, stopConfirmIdle, triggerStop } from "./stop-confirm.ts";

describe("triggerStop", () => {
	it("idle 首次触发：武装为 pending，不确认", () => {
		const r = triggerStop(stopConfirmIdle, 1000);
		expect(r.confirmed).toBe(false);
		expect(r.state).toEqual({ phase: "pending", deadline: 1000 + STOP_CONFIRM_WINDOW_MS });
	});

	it("pending 窗口内再次触发：确认中断并回 idle", () => {
		const armed = triggerStop(stopConfirmIdle, 1000).state;
		const r = triggerStop(armed, 1000 + STOP_CONFIRM_WINDOW_MS - 1);
		expect(r.confirmed).toBe(true);
		expect(r.state).toEqual(stopConfirmIdle);
	});

	it("pending 超时后触发：视同 idle 重新武装（不依赖 UI 定时器先收状态）", () => {
		const armed = triggerStop(stopConfirmIdle, 1000).state;
		const r = triggerStop(armed, 1000 + STOP_CONFIRM_WINDOW_MS);
		expect(r.confirmed).toBe(false);
		expect(r.state).toEqual({ phase: "pending", deadline: 1000 + STOP_CONFIRM_WINDOW_MS * 2 });
	});
});

describe("stopConfirmExpired", () => {
	it("idle 恒为未过期", () => {
		expect(stopConfirmExpired(stopConfirmIdle, Number.MAX_SAFE_INTEGER)).toBe(false);
	});

	it("pending 到截止时刻才过期，之前不过期", () => {
		const armed = triggerStop(stopConfirmIdle, 1000).state;
		expect(stopConfirmExpired(armed, 1000 + STOP_CONFIRM_WINDOW_MS - 1)).toBe(false);
		expect(stopConfirmExpired(armed, 1000 + STOP_CONFIRM_WINDOW_MS)).toBe(true);
	});
});
