import { describe, expect, it } from "vitest";
import { IME_ENTER_GRACE_MS, shouldSwallowEnter } from "./ime-guard.ts";

describe("shouldSwallowEnter", () => {
	it("composition 期间一律吞（选词中的 Enter 是确认候选）", () => {
		expect(shouldSwallowEnter({ composing: true, lastCompositionEndAt: 0, now: 100_000 })).toBe(true);
		// 哪怕距上次 compositionend 已很久，正在 composition 就吞。
		expect(shouldSwallowEnter({ composing: true, lastCompositionEndAt: 1_000, now: 100_000 })).toBe(true);
	});

	it("compositionend 后的宽限期内吞（React 里 compositionend 先于携带的 keydown）", () => {
		expect(shouldSwallowEnter({ composing: false, lastCompositionEndAt: 1_000, now: 1_000 })).toBe(true);
		expect(shouldSwallowEnter({ composing: false, lastCompositionEndAt: 1_000, now: 1_050 })).toBe(true);
		expect(
			shouldSwallowEnter({ composing: false, lastCompositionEndAt: 1_000, now: 1_000 + IME_ENTER_GRACE_MS - 1 }),
		).toBe(true);
	});

	it("宽限期边界（恰好 100ms）放行", () => {
		expect(
			shouldSwallowEnter({ composing: false, lastCompositionEndAt: 1_000, now: 1_000 + IME_ENTER_GRACE_MS }),
		).toBe(false);
	});

	it("宽限期过后放行（正常发送/换行不受影响）", () => {
		expect(shouldSwallowEnter({ composing: false, lastCompositionEndAt: 1_000, now: 1_200 })).toBe(false);
	});

	it("从未发生过 composition 时放行（lastCompositionEndAt = 0，now 为真实 epoch）", () => {
		expect(shouldSwallowEnter({ composing: false, lastCompositionEndAt: 0, now: Date.now() })).toBe(false);
	});
});
