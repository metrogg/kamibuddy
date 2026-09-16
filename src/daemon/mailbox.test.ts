/**
 * mailbox 纯逻辑测试：投递/消费/销毁/校验全路径（spec: add-team-foundations 批 3）。
 * 时钟与 id 注入固定值，断言可预测。
 */

import { describe, expect, it } from "vitest";
import { SessionMailbox } from "./mailbox.ts";

/** 固定时钟：now 逐次 +1000，id 按 seq 生成 —— 消息字段全部可断言。 */
function fixedClock() {
	let now = 1000;
	let seq = 0;
	return {
		now: () => (now += 1000),
		generateId: () => `id-${(seq += 1)}`,
	};
}

function makeMailbox() {
	return new SessionMailbox(fixedClock());
}

describe("deliver / drain（定向投递与取走清空）", () => {
	it("投递后 drain 取走全部，字段完整（id/来源/显示名/正文/时间）", () => {
		const mailbox = makeMailbox();
		mailbox.deliver("b", "a", "你好", "会话甲");

		const messages = mailbox.drain("b");
		expect(messages).toHaveLength(1);
		expect(messages[0]).toEqual({
			id: "id-1",
			fromSessionId: "a",
			fromLabel: "会话甲",
			text: "你好",
			createdAt: 2000,
		});
	});

	it("fromLabel 缺省或空串 → 键缺席（不是空壳字段）", () => {
		const mailbox = makeMailbox();
		mailbox.deliver("b", "a", "甲");
		mailbox.deliver("b", "a", "乙", "");
		const messages = mailbox.drain("b");
		expect("fromLabel" in (messages[0] ?? {})).toBe(false);
		expect("fromLabel" in (messages[1] ?? {})).toBe(false);
	});

	it("drain 是读后清空：第二次 drain 为空，pendingCount 归零", () => {
		const mailbox = makeMailbox();
		mailbox.deliver("b", "a", "一");
		mailbox.deliver("b", "a", "二");
		expect(mailbox.pendingCount("b")).toBe(2);

		const first = mailbox.drain("b");
		expect(first.map((m) => m.text)).toEqual(["一", "二"]);
		expect(mailbox.drain("b")).toEqual([]);
		expect(mailbox.pendingCount("b")).toBe(0);
	});

	it("跨收件箱隔离：投给 b 的消息不出现在 c 的箱里", () => {
		const mailbox = makeMailbox();
		mailbox.deliver("b", "a", "给B");
		mailbox.deliver("c", "a", "给C");

		expect(mailbox.drain("b").map((m) => m.text)).toEqual(["给B"]);
		expect(mailbox.drain("c").map((m) => m.text)).toEqual(["给C"]);
	});

	it("投递顺序保持 FIFO（drain 按到达序返回）", () => {
		const mailbox = makeMailbox();
		for (let i = 1; i <= 5; i += 1) mailbox.deliver("b", "a", `消息${i}`);
		expect(mailbox.drain("b").map((m) => m.text)).toEqual([
			"消息1",
			"消息2",
			"消息3",
			"消息4",
			"消息5",
		]);
	});
});

describe("broadcast（多路投递）", () => {
	it("同一条消息进每个目标箱，来源一致", () => {
		const mailbox = makeMailbox();
		const count = mailbox.broadcast("lead", "开会了", ["b", "c", "d"], "领导");
		expect(count).toBe(3);
		for (const id of ["b", "c", "d"]) {
			const messages = mailbox.drain(id);
			expect(messages).toHaveLength(1);
			expect(messages[0]).toMatchObject({ fromSessionId: "lead", fromLabel: "领导", text: "开会了" });
		}
	});

	it("目标含空串 → 响亮抛错（与 deliver 同一口径，不静默跳过）", () => {
		const mailbox = makeMailbox();
		expect(() => mailbox.broadcast("lead", "开会了", ["b", ""])).toThrow("目标会话 id");
	});
});

describe("校验（空参数响亮抛错，AGENTS.md §7）", () => {
	it.each([
		["目标会话 id", () => new SessionMailbox(fixedClock()).deliver("", "a", "x")],
		["来源会话 id", () => new SessionMailbox(fixedClock()).deliver("b", "", "x")],
		["正文", () => new SessionMailbox(fixedClock()).deliver("b", "a", "")],
	])("%s 为空 → 抛错", (_label, fn) => {
		expect(fn).toThrow();
	});
});

describe("clear（销毁收件箱）", () => {
	it("clear 后未消费的消息消失（会话删除的清理语义）", () => {
		const mailbox = makeMailbox();
		mailbox.deliver("b", "a", "未送达");
		mailbox.clear("b");
		expect(mailbox.drain("b")).toEqual([]);
		expect(mailbox.pendingCount("b")).toBe(0);
	});

	it("clear 不存在的箱是空操作", () => {
		const mailbox = makeMailbox();
		expect(() => mailbox.clear("ghost")).not.toThrow();
	});
});
