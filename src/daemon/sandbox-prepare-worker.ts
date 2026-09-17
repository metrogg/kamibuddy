/**
 * 沙箱授权的 worker 出口（配对：`sandbox-prepare-client.ts`）。
 *
 * 这个文件只该被当 **worker 脚本**加载（构建产物 `out/main/sandbox-prepare-worker.mjs`，
 * 入口登记在 `electron.vite.config.ts`）。它故意不 import 任何 daemon 侧状态：
 * worker 是另一个线程、另一份模块实例，读 daemon 的模块级变量只会读到残影 ——
 * 所以整个协议就是「一个请求进、一条结果出」（见 protocol 文件头）。
 */

import { parentPort, type MessagePort } from "node:worker_threads";

import { classifyFailure, prepareSandbox } from "../sandbox/index.ts";
import {
	countTreeEntries,
	type PrepareWorkerMessage,
	type PrepareWorkerRequest,
} from "./sandbox-prepare-protocol.ts";

/**
 * 被 import 进主线程说明接线错了（客户端只该 import type）。响亮地塌在这里，
 * 而不是留一个「授权永远不返回」的静默死锁 —— 那个形状极难查。
 */
const port: MessagePort = requirePort(parentPort);

port.on("message", (request: PrepareWorkerRequest) => {
	void run(request);
});

function requirePort(candidate: MessagePort | null): MessagePort {
	if (candidate === null) {
		throw new Error("sandbox-prepare-worker：必须在 worker_thread 里运行");
	}
	return candidate;
}

async function run(request: PrepareWorkerRequest): Promise<void> {
	/*
	 * 先量规模再授权，两者在同一个 worker 里串行做：
	 * 授权那 19.3 秒是同步的，量规模必须**在它之前**在这个线程上完成，
	 * 否则主线程等 done 的时候什么信息都拿不到。
	 */
	const scan = countTreeEntries(request.workspaceDir);
	try {
		const result = await prepareSandbox({
			workspaceDir: request.workspaceDir,
			writableDirs: [...request.writableDirs],
		});
		post({
			kind: "done",
			fastPath: result.fastPath,
			elapsedMs: result.elapsedMs,
			entries: scan.entries,
			capped: scan.capped,
		});
	} catch (error) {
		// 原因在这里分类：真实异常只存在于本线程，回主线程只剩字符串
		//（classifyFailure 靠异常类型与 API 名判定，跨线程后就认不出来了）。
		post({
			kind: "failed",
			reason: classifyFailure(error),
			detail: error instanceof Error ? error.message : String(error),
		});
	}
}

function post(message: PrepareWorkerMessage): void {
	port.postMessage(message);
}
