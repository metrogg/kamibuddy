/**
 * 工具结果 spill：输出超阈值时落盘，模型只看到「头部 + 省略提示 + 落盘路径」。
 *
 * 为什么要有这一层（spec: adopt-dsh-disciplines Task 2.1，机制照 dsh 的 spill-policy）：
 * 原本是各工具自己 `slice(0, 24k)`，超限部分**直接丢掉** —— 模型既不知道丢了
 * 多少，也没有任何办法把丢掉的部分取回来（powershell 的长输出、超长网页正文、
 * MCP 工具吐回的 JSON 都这样）。落盘 + 提示把「丢信息」换成「换个地方存，
 * 需要时按路径回读」。
 *
 * 阈值沿用项目既有的 **24k 字符**口径（改造前 powershell / web-fetch /
 * doc-extract 三处各写了一份 24_000）。两个决定都要留着理由：
 *
 *   1. 单位是**字符**（UTF-16 code unit，即 `String.length`）而不是字节。
 *      既有三处判定都是 `.length`；改成按 UTF-8 字节算，一份 20k 字符但
 *      含中文的正文会从「内联」变成「落盘」——而本任务的硬要求是
 *      「阈值内行为与改动前完全一致」。dsh 按字节是因为它的上限是配置项、
 *      一开始就按 UTF-8 计，没有历史口径要保。
 *   2. 数值只此一份：调用点 import `SPILL_MAX_CHARS`，不再各写一个字面量。
 *
 * 落盘目录由调用方给（daemon 传 config-paths.getSpillsDir(cwd)）。**不放配置
 * 目录**：配置目录对文件工具是禁读的（permission-policy 阶段 1，凭据禁读
 * 不可越过），提示里让模型 read/grep 回读会直接撞墙 —— 落盘等于白落。
 * 见 getSpillsDir 的注释。
 *
 * 不做 branded locator（dsh 的 `spill://` 一类句柄协议）：我们是本地单机，
 * 落盘位置就是本机真实路径，模型直接用 read 就能取；多一层句柄只让模型多学
 * 一种方言，能力上不多一分。
 *
 * 写入用同步 IO：与 event-log / run-ledger 同一理由 —— 要在返回前确保文件
 * 已在盘上，否则提示里的路径可能指向一个还不存在的文件（异步写在崩溃时更糟）。
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** 单次回给模型的字符上限（单位与理由见文件头）。 */
export const SPILL_MAX_CHARS = 24_000;

/** 落盘失败的上报通道（daemon 接到 event-log）。只进不出，绝不回抛。 */
export type SpillReport = (message: string) => void;

export interface SpillOptions {
	/** 落盘目录（绝对路径，daemon 传 getSpillsDir(cwd)）。 */
	readonly dir: string;
	/** 文件名前缀：工具名。MCP 工具名来自外部清单，所以落盘前会做安全化。 */
	readonly name: string;
	/** 阈值覆盖（测试用：造 24k 文本太笨重）。生产恒为 SPILL_MAX_CHARS。 */
	readonly maxChars?: number;
	readonly report?: SpillReport;
}

export interface SpillResult {
	/** 回给模型的文本：阈值内是原文，超限是「头部 + 提示」。 */
	readonly text: string;
	/** 是否真的落了盘（false 时 text 要么是原文，要么是「落盘失败」的截断）。 */
	readonly spilled: boolean;
	readonly spillPath: string | undefined;
}

/** 同进程内序号：同一毫秒两次落盘靠它区分（文件名带时间戳，跨进程也撞不上）。 */
let seq = 0;

/**
 * 超阈值文本 → 落盘 + 截断结果；阈值内原样返回（逐字节不变）。
 *
 * 超限时头部与改动前**逐字节一致**（都是 `slice(0, maxChars)`），只有尾部
 * 提示不同：这样「阈值内不变」之外，超限时的前缀也不变，回归对照与提示词
 * 缓存对照都只盯尾部。提示因此会略微超出阈值（改造前的「（内容过长，已截断）」
 * 同样如此），不为此预留预算 —— 预留会让头部长度随提示文案漂移。
 */
export function spillOversizedText(text: string, options: SpillOptions): SpillResult {
	const maxChars = options.maxChars ?? SPILL_MAX_CHARS;
	if (text.length <= maxChars) return { text, spilled: false, spillPath: undefined };

	const head = text.slice(0, maxChars);
	const omitted = text.length - head.length;
	const path = join(options.dir, `${safeName(options.name)}-${Date.now()}-${seq++}.txt`);
	try {
		mkdirSync(options.dir, { recursive: true });
		writeFileSync(path, text, "utf8");
	} catch (error) {
		/*
		 * 落盘失败**不改变调用的成败**（工具本身确实跑成功了，把一次成功变成
		 * 报错是谎报），但必须响亮：模型要能分辨「省略是因为内容长（能回读）」
		 * 与「省略是因为存不下去（回读不了）」——这两者对下一步的含义完全不同
		 * （AGENTS.md §7：不许静默降级掩盖失败）。
		 */
		const reason = error instanceof Error ? error.message : String(error);
		options.report?.(`工具结果落盘失败（${path}）：${reason}`);
		return {
			text: `${head}\n\n（内容过长：已省略 ${omitted} 个字符，且完整结果落盘失败：${reason}）`,
			spilled: false,
			spillPath: undefined,
		};
	}
	return {
		text:
			`${head}\n\n（内容过长：已省略 ${omitted} 个字符。` +
			`完整结果已存到 ${path}，可用 read 工具带 offset/limit 分段读取，或用 grep 在该文件内搜索。）`,
		spilled: true,
		spillPath: path,
	};
}

/**
 * 工具名 → 文件名安全化。
 *
 * 工具名不可全信：MCP 工具名来自外部 server 的清单（mcp-client 会把它拼进来），
 * 一个带 `..` 或路径分隔符的名字会让落盘写到别处。把非 [A-Za-z0-9_-] 一律压成
 * 下划线，从根上断掉目录穿越 —— 与 run-ledger 的 ledgerFileName 同一条理由
 * （那边的注释写得更细）。
 */
function safeName(name: string): string {
	const safe = name.replace(/[^a-zA-Z0-9_-]/g, "_");
	return safe === "" ? "tool" : safe;
}
