/**
 * 沙箱授权 worker 的协议与目录规模扫描。
 *
 * **为什么要有这条 worker 通道**：给工作区授写最终落在一条**同步**的
 * `SetNamedSecurityInfoW` 上 —— Windows 会在这一次调用里把继承 ACE 传播到
 * 整棵子树（`sandbox/acl.ts` 的 `hasExactGrant` 注释里写着这个成本模型）。
 * 实测 43,723 个条目的目录要 19.3 秒，而 daemon 是**单线程** JS：
 * 这 19.3 秒里它连「你的消息已收到」都发不出去。
 *
 * 2026-09-17 从事件日志定到的现场（`~/.kamibuddy/logs/events-*.jsonl`，
 * `session:prompt` → `run_started` 的间隔）：
 *
 *   空临时任务目录 45 / 94 / 154 / 423 ms  ← 目录是空的，授权瞬时
 *   真实项目目录   19,657 ms               ← 就是这一条，用户看到「发送后一片白」
 *
 * 所以授权搬进 worker_thread：主线程只等 promise，同步 FFI 落在 worker 里。
 * 这与 codex 的做法同源 —— 它对**读根**的 ACL 就是这么做的（后台 helper +
 * 单飞互斥），写根留在了 spawn 路径上（`windows-sandbox-rs` 的
 * `spawn_read_acl_helper` / `read_acl_mutex`）。
 *
 * 协议是**一问一答**：主线程发一个请求，worker 回一条 done 或 failed，
 * 然后客户端把 worker 关掉。不做进度消息 —— 授权期间没有任何人在等它
 *（这正是这次修改要达到的效果），规模读数搭在 done 上一起回来就够了。
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";

import type { SandboxUnavailableReason } from "../shared/permissions.ts";

/**
 * 扫描上限：条目数。
 *
 * 上限本身是设计的一部分，不是防御性兜底：这个数字只用来回答
 *「为什么会慢」，精度到「几万」就够，而**数完 4 万条目自己也要十几秒**
 *（本机实测 43,723 个条目扫一遍 11.9 秒）—— 在一次授权里再付一遍这个钱
 * 是不能接受的。所以超限就收工，把数字诚实地退化成一个下界（`capped: true`）。
 *
 * 同款取舍见 codex 的 `audit.rs`（`AUDIT_TIME_LIMIT_SECS = 2` /
 * `MAX_CHECKED_LIMIT = 50000`）：它扫 world-writable 也是限时限量。
 */
export const ENTRY_SCAN_LIMIT = 50_000;

/** 扫描上限：耗时（毫秒）。与条目上限谁先到谁生效。 */
export const ENTRY_SCAN_TIME_LIMIT_MS = 2_000;

/** 主线程 → worker：一次授权请求。 */
export interface PrepareWorkerRequest {
	readonly workspaceDir: string;
	readonly writableDirs: readonly string[];
}

/** worker → 主线程：授权完成。规模读数与耗时一起回来。 */
export interface PrepareWorkerDone {
	readonly kind: "done";
	/** 幂等快路径命中（ACE 已存在，没触发传播）。 */
	readonly fastPath: boolean;
	readonly elapsedMs: number;
	readonly entries: number;
	/** 达到扫描上限，`entries` 是下界而不是全量。 */
	readonly capped: boolean;
}

/** worker → 主线程：授权失败。原因在 worker 侧就已分类（`classifyFailure`）。 */
export interface PrepareWorkerFailed {
	readonly kind: "failed";
	readonly reason: SandboxUnavailableReason;
	readonly detail: string;
}

export type PrepareWorkerMessage = PrepareWorkerDone | PrepareWorkerFailed;

export interface TreeScanResult {
	readonly entries: number;
	readonly capped: boolean;
}

export interface TreeScanOptions {
	/** 条目上限，缺省 `ENTRY_SCAN_LIMIT`。 */
	readonly limit?: number;
	/** 耗时上限（毫秒），缺省 `ENTRY_SCAN_TIME_LIMIT_MS`。 */
	readonly timeLimitMs?: number;
	/** 时钟注入点（测试用）。 */
	readonly now?: () => number;
}

/**
 * 数一遍目录树（文件 + 子目录都算一个条目）。
 *
 * 不跟符号链接与 junction：既防环，也不把别的卷算进来（沙箱授权也一样不跟，
 * 见 `sandbox/acl.ts` 只对目标目录本身挂 ACE —— 这里跟着数会高估规模）。
 * 读不到的目录**跳过而不是抛出**：一个不可读子目录不该让规模读数失败，
 * 而真正的授权失败会在 prepare 阶段自己响亮报出来。
 */
export function countTreeEntries(root: string, options: TreeScanOptions = {}): TreeScanResult {
	const limit = options.limit ?? ENTRY_SCAN_LIMIT;
	const timeLimitMs = options.timeLimitMs ?? ENTRY_SCAN_TIME_LIMIT_MS;
	const now = options.now ?? Date.now;
	const deadline = now() + timeLimitMs;

	let entries = 0;
	const pending: string[] = [root];
	while (pending.length > 0) {
		const dir = pending.pop();
		if (dir === undefined) break;
		let children;
		try {
			children = readdirSync(dir, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const child of children) {
			entries += 1;
			if (entries >= limit) return { entries, capped: true };
			if (child.isDirectory() && !child.isSymbolicLink()) {
				pending.push(join(dir, child.name));
			}
		}
		if (now() >= deadline) return { entries, capped: true };
	}
	return { entries, capped: false };
}
