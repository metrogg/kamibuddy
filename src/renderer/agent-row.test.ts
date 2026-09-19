/**
 * 共享代理行（`AgentRow`）的状态词表测试。
 *
 * 两处消费同一张表：团队状态栏的成员行、子代理卡的分组行。renderer 没有组件
 * 测试基建（项目先例：只测纯函数），所以把表本身钉在这里 —— 新增状态漏表、
 * 或符号/短词被改歪，都该在这里变红，而不是等真机上看到一个空白状态位。
 */

import { describe, expect, it } from "vitest";
import { STATUS_MARK, STATUS_SHORT, STATUS_TEXT } from "./agent-row-status.ts";

/** `SubagentStatus["status"]` 的五个取值（类型枚举不出来，手工当契约钉住）。 */
const STATUSES = ["queued", "running", "done", "failed", "interrupted"] as const;

describe("代理行的状态词表", () => {
	it("五态在三条表里都有值（漏表 = 行上出现空白状态位）", () => {
		for (const status of STATUSES) {
			expect(STATUS_MARK[status], `${status} 缺符号`).not.toBe("");
			expect(STATUS_SHORT[status], `${status} 缺短词`).not.toBe("");
			expect(STATUS_TEXT[status], `${status} 缺长句`).not.toBe("");
		}
	});

	it("符号与短词逐条对齐既有语义（… 启动中 / ● 运行中 / ✓ 已完成 / ✗ 失败 / ! 已中断）", () => {
		expect(STATUSES.map((status) => STATUS_MARK[status])).toEqual(["…", "●", "✓", "✗", "!"]);
		expect(STATUSES.map((status) => STATUS_SHORT[status])).toEqual([
			"启动中",
			"运行中",
			"已完成",
			"失败",
			"已中断",
		]);
	});

	it("中断与失败必须分开（成员自己没出错，是宿主没了）", () => {
		expect(STATUS_MARK.interrupted).not.toBe(STATUS_MARK.failed);
		expect(STATUS_SHORT.interrupted).not.toBe(STATUS_SHORT.failed);
		expect(STATUS_TEXT.interrupted).toContain("中断");
		expect(STATUS_TEXT.interrupted).not.toContain("失败");
	});
});
