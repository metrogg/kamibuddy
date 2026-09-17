/**
 * 沙箱授权 worker 的客户端：起一个**一次性** worker、发一个请求、
 * 收一条结果、把它关掉。
 *
 * 为什么必须走 worker（而不是在 daemon 里直接调 `prepareSandbox`）：
 * 授权最后是一条同步的 `SetNamedSecurityInfoW`，Windows 会在这一次调用里
 * 把继承 ACE 传播到整棵子树。43,723 个条目的目录要 19.3 秒，而 daemon 是
 * **单线程** JS —— 这 19.3 秒里它发不出任何事件，用户看到的是「发送后一片白」。
 * 现场与数据见 `sandbox-prepare-protocol.ts` 的文件头。
 *
 * 为什么一次性而不是常驻：授权是**每个工作区一辈子一次**的事（ACE 常驻 +
 * 幂等命中 1ms），常驻 worker 要额外管生命周期（daemon 退出、宿主 dispose、
 * 崩溃重启），买不到任何东西。起一个 worker 的开销是几十毫秒，与它省下的
 * 那几十秒不在一个量级。
 */

import { Worker } from "node:worker_threads";

import {
	SandboxPrepareFailure,
	type SandboxPrepareResult,
} from "../sandbox/index.ts";
import type { PrepareWorkerMessage } from "./sandbox-prepare-protocol.ts";

/**
 * worker 脚本的文件名。与 daemon 产物**同目录**：构建时它是
 * `out/main/sandbox-prepare-worker.mjs`（入口表在 electron.vite.config.ts），
 * 运行时的 `import.meta.url` 就是 `out/main/daemon.mjs`。
 *
 * 名字写在常量里而不是内联进 `new URL(...)`：写成字面量会被打包器当成
 * 「静态可分析的 worker 入口」去做 worker 打包与路径改写，而我们的出口
 * 已经在 rollup 入口表里了 —— 两条路同时生效会得到两份产物。
 */
const WORKER_FILE = "sandbox-prepare-worker.mjs";

/** 客户端用到的 worker 能力面。**故意窄于 `Worker`**：测试要能注入一个假的。 */
export interface PrepareWorkerLike {
	on(event: "message", listener: (message: unknown) => void): void;
	on(event: "error", listener: (error: Error) => void): void;
	on(event: "exit", listener: (code: number) => void): void;
	postMessage(message: unknown): void;
	terminate(): void;
}

export interface PrepareWorkerClientOptions {
	/** worker 工厂注入点（测试用）。缺省起一个真实 Worker 跑构建产物。 */
	readonly spawn?: (url: URL) => PrepareWorkerLike;
}

/** 授权请求：与 `prepareSandbox` 的入参同形（worker 里就是调它）。 */
export interface PrepareRequest {
	readonly workspaceDir: string;
	readonly writableDirs: readonly string[];
}

/**
 * 在 worker 里完成一次工作区授权。
 *
 * 失败语义与进程内直调**完全一致**（调用方一行都不用改）：抛出的异常经
 * `SandboxPrepareFailure` 带上 worker 侧已分类好的原因，于是
 * `classifyFailure` / 设置页拿到的是准确原因，而不是兜底值。
 */
export function prepareSandboxInWorker(
	request: PrepareRequest,
	options: PrepareWorkerClientOptions = {},
): Promise<SandboxPrepareResult> {
	return new Promise<SandboxPrepareResult>((resolve, reject) => {
		// `.mjs` 后缀本身就是 ESM 标志（Worker 没有浏览器的 `type` 选项）。
		const spawn =
			options.spawn ?? ((url: URL) => new Worker(url) as PrepareWorkerLike);
		let worker: PrepareWorkerLike;
		try {
			worker = spawn(new URL(`./${WORKER_FILE}`, import.meta.url));
		} catch (error) {
			reject(new SandboxPrepareFailure("prepare-worker-failed", detailOf(error)));
			return;
		}

		/**
		 * 一次性收敛：先到的那条结果说了算，其余（含 terminate 触发的 exit）
		 * 全部忽略。没有这道闸，正常完成后的 exit 会把已经 resolve 的 promise
		 * 变成「worker 提前退出」的假失败。
		 */
		let settled = false;
		const settle = (finish: () => void): void => {
			if (settled) return;
			settled = true;
			worker.terminate();
			finish();
		};

		worker.on("message", (raw) => {
			// 跨线程的载荷在类型上只能是 unknown；形状由协议保证（worker 是我们的代码）。
			const message = raw as PrepareWorkerMessage;
			if (message.kind === "done") {
				settle(() =>
					resolve({
						fastPath: message.fastPath,
						elapsedMs: message.elapsedMs,
						entries: message.entries,
						capped: message.capped,
					}),
				);
				return;
			}
			if (message.kind === "failed") {
				settle(() => reject(new SandboxPrepareFailure(message.reason, message.detail)));
			}
		});
		// worker 自身崩了（脚本抛在模块顶层、FFI 加载失败到进程级）
		worker.on("error", (error) => {
			settle(() => reject(new SandboxPrepareFailure("prepare-worker-failed", detailOf(error))));
		});
		// 没有结果就退出（被系统杀掉、脚本自己 process.exit）——不接会永远挂着，
		// 而挂住比报错难查得多。
		worker.on("exit", (code) => {
			settle(() =>
				reject(
					new SandboxPrepareFailure(
						"prepare-worker-failed",
						`授权 worker 未给出结果就退出（exit ${code}）`,
					),
				),
			);
		});
		// 消息会排队，worker 还没 online 也不丢。
		worker.postMessage(request);
	});
}

function detailOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
