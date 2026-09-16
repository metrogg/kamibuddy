/**
 * 会话间消息信箱（纯逻辑）：批 3 的通信原语（spec: add-team-foundations）。
 *
 * 本模块刻意不 import pi / core —— 收件、消费、销毁是纯数据逻辑，抽出来
 * 才能脱离 Electron 与 pi 单测（index.ts 只做接线，同 session-registry 的取向）。
 *
 * 形状对齐 WorkBuddy 的 inbox（`teams/{name}/inboxes/{member}.json`）的**语义**：
 * 按收件方分箱、消息带来源、消费方取走自己箱内的全部。差异两点，都有意为之：
 *   - 键是 sessionId 而不是成员名 —— 成员命名（@name）与身份路由属批 5，
 *     原语层不引入还没有消费者的概念；
 *   - 内存态 v1，不落盘 —— 本批的唯一通路是「投递即唤醒」（daemon 的
 *     deliverSessionMessage：投递后排目标桶互斥链，drain 合成一条 followUp
 *     prompt），消息在投递与消费之间只存活于互斥链等待期；跨重启留存随
 *     批 6 成员生命周期一起决策（到时把存储位置换成本模块的构造参数）。
 *
 * 消费语义是 **drain（取走全部并清空）**：信箱不是公告板，消息被目标会话
 * 读到即算送达，没有「已读回执」层面的状态。多消息由消费方合成一条
 * prompt（daemon 接线负责格式），箱内不攒已消费的历史。
 */

import { randomUUID } from "node:crypto";

/** 一条投递到目标会话的信箱消息。 */
export interface MailboxMessage {
	readonly id: string;
	/** 来源会话。信箱不解释它 —— 批 5 的路由层决定它是不是「领导/成员」。 */
	readonly fromSessionId: string;
	/**
	 * 来源显示名（可选）。合成 prompt 的标注行用它；缺省由消费方回落
	 * fromSessionId。显示名是投递方的知识（成员名 / 会话标题），信箱只存不查。
	 */
	readonly fromLabel?: string;
	readonly text: string;
	readonly createdAt: number;
}

/** 时钟与 id 生成的注入点（单测确定性：固定时间、可预测的 id 序列）。 */
export interface MailboxClock {
	readonly now: () => number;
	readonly generateId: () => string;
}

const defaultClock: MailboxClock = { now: () => Date.now(), generateId: () => randomUUID() };

export class SessionMailbox {
	private readonly queues = new Map<string, MailboxMessage[]>();
	private readonly clock: MailboxClock;

	constructor(clock: MailboxClock = defaultClock) {
		this.clock = clock;
	}

	/**
	 * 定向投递一条消息。返回该收件箱投递后的待消费条数（投递方不必用，
	 * 断言与日志顺手）。空来源或空正文是调用方 bug，响亮抛错 —— 静默吞掉
	 * 会让「消息为什么没到」变成无从排查的悬案（AGENTS.md §7）。
	 */
	deliver(toSessionId: string, fromSessionId: string, text: string, fromLabel?: string): number {
		if (toSessionId === "") throw new Error("信箱投递缺少目标会话 id");
		if (fromSessionId === "") throw new Error("信箱投递缺少来源会话 id");
		if (text === "") throw new Error("信箱投递的正文不能为空");
		const queue = this.queues.get(toSessionId) ?? [];
		queue.push({
			id: this.clock.generateId(),
			fromSessionId,
			...(fromLabel === undefined || fromLabel === "" ? {} : { fromLabel }),
			text,
			createdAt: this.clock.now(),
		});
		this.queues.set(toSessionId, queue);
		return queue.length;
	}

	/**
	 * 多路投递同一条消息（@all 广播的原语形态）。返回成功入箱的总条数；
	 * 目标列表里的空串条目是调用方 bug，照 deliver 同款响亮抛错。
	 */
	broadcast(fromSessionId: string, text: string, toSessionIds: readonly string[], fromLabel?: string): number {
		let count = 0;
		for (const to of toSessionIds) {
			this.deliver(to, fromSessionId, text, fromLabel);
			count += 1;
		}
		return count;
	}

	/** 取走某收件箱的全部消息（读后清空）。没有箱或箱空 → 空数组。 */
	drain(toSessionId: string): readonly MailboxMessage[] {
		const queue = this.queues.get(toSessionId);
		if (queue === undefined) return [];
		this.queues.delete(toSessionId);
		return queue;
	}

	/** 待消费条数（接线方打日志 / 断言用，消费方不走这里）。 */
	pendingCount(toSessionId: string): number {
		return this.queues.get(toSessionId)?.length ?? 0;
	}

	/** 销毁某收件箱（会话删除时接线方调用；未投出的消息随会话一起消失）。 */
	clear(toSessionId: string): void {
		this.queues.delete(toSessionId);
	}
}
