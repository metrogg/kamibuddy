/**
 * 工具终态判定的测试。
 *
 * 这条判定的分量在于**它决定用户看不看得出「这条命令没跑」**：
 * 被检查器/沙箱拦下的结果是 `details.blocked: true` 且**不是 isError**
 * （原因要回给模型改写，标成 isError 会诱导它原样重试）。只看 isError 的话，
 * 一条被拦的命令会显示成「已执行成功」—— 2026-09-19 那条 `--shutdown`
 * 被拦后用户事后才发现，根因就在这（§4.30）。
 */

import { describe, expect, it } from "vitest";
import { toolOutcomeFrom } from "./session-events.ts";

describe("toolOutcomeFrom", () => {
	it("正常结果 → ok", () => {
		expect(toolOutcomeFrom(false, { stdout: "hi" })).toBe("ok");
	});

	it("isError → error", () => {
		expect(toolOutcomeFrom(true, undefined)).toBe("error");
	});

	it("details.blocked 为 true → blocked（拦下不是失败，也不是成功）", () => {
		expect(toolOutcomeFrom(false, { blocked: true, category: "system-damage" })).toBe("blocked");
		expect(toolOutcomeFrom(false, { blocked: true, category: "escalation-denied" })).toBe("blocked");
	});

	it("blocked 只认严格的 true：非布尔值/缺席都当正常结果", () => {
		// 授权判定上「读不懂就是不给」；这里反过来 —— 读不懂就不声称被拦，
		// 免得把一张正常卡片标成「已拦截」。
		for (const details of [
			undefined,
			null,
			"blocked",
			{},
			{ blocked: false },
			{ blocked: "true" },
			{ category: "system-damage" },
			[],
		]) {
			expect(toolOutcomeFrom(false, details), JSON.stringify(details)).toBe("ok");
		}
	});

	it("isError 优先于 blocked（真抛错的结果不该被说成「已拦截」）", () => {
		expect(toolOutcomeFrom(true, { blocked: true, category: "x" })).toBe("error");
	});
});
