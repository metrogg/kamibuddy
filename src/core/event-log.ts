/**
 * 事件日志：daemon 的结构化日志落盘。
 *
 * 为什么存在：daemon 没有界面，console.log 只打到终端，终端一关现场就没了。
 * WorkBuddy 把「启动即可观测」列为 P0（跨进程打点到同一泳道 jsonl），
 * 这里是同一思路的最小实现：一行一个 JSON（NDJSON），按日期分文件。
 *
 * 为什么同步写：单条写入换来「崩溃前最后一条也在盘上」的保证；异步写遇到
 * uncaughtException 会丢缓冲里没 flush 的部分——那往往正是最需要的那几条。
 *
 * **事件量（2026-09-15 实测，别再按「每 run 几十条」估算）**：单日 5.3 万条 /
 * 38 MB，几乎全部是 `tool_stream_progress` —— 工具参数生成期的逐 delta 进度，
 * 一次 write 就能出几千条。`sanitizeForLog` 收掉累积的 `rawArgs` 后仍约
 * 22 MB/日，**体积的主因是条数，不是单条大小**。
 *
 * 待办：采样 / 按时间窗合并中间态（对齐清单 LOG18 —— 该条已从 ⛔ 改判为 ❌，
 * 原来的 YAGNI 理由「事件量小」不成立）。
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/** 一条日志记录。kind 区分来源，其余字段随 kind 自由扩展。 */
export interface LogRecord {
	readonly kind: string;
	readonly [key: string]: unknown;
}

export class EventLog {
	/** 注入时钟便于测试断言文件名；生产用 Date.now。 */
	constructor(
		private readonly logDir: string,
		private readonly now: () => number = Date.now,
	) {
		mkdirSync(logDir, { recursive: true });
	}

	get dir(): string {
		return this.logDir;
	}

	/** 追加一条记录。ts 由这里统一打点，调用方不各自取时间。 */
	append(record: LogRecord): void {
		const ts = this.now();
		const line = `${JSON.stringify({ ts, ...record })}\n`;
		appendFileSync(this.fileFor(ts), line, "utf8");
	}

	/** 按日期分文件：events-2026-09-07.jsonl。天然轮转，查问题按天翻。 */
	private fileFor(ts: number): string {
		const day = new Date(ts).toISOString().slice(0, 10);
		return join(this.logDir, `events-${day}.jsonl`);
	}
}
