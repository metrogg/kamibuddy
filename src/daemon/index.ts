/**
 * Daemon：跑在 Electron utilityProcess 里的业务进程。
 *
 * 本文件只做两件事：帧循环（收 DaemonRequest → 派发 → 回 DaemonResponse）
 * 和进程级诊断。会话编排在 core/ 里，pi 的类型止步于那一层（AGENTS.md §1.2）。
 *
 * 为什么不 import electron：daemon 跑在 utilityProcess 里，用不到多数 Electron API，
 * 而与父进程通信只需要 process.parentPort 这个全局。保持零 electron 依赖后，
 * 这一层可以脱离 Electron 单独跑（比如将来做 CLI 形态或集成测试）。
 */

import type { DaemonOutbound, DaemonRequest } from "../shared/daemon-protocol.ts";
import { isDaemonRequest } from "../shared/daemon-protocol.ts";
import { INVOKE } from "../shared/ipc.ts";
import type { SessionSnapshot } from "../shared/session-events.ts";

/* ── 与父进程的通道 ───────────────────────────────────────────────── */

/**
 * process.parentPort 是 Electron 注入的全局，类型来自 electron 包。
 * 这里手写最小结构以避免 import electron（见文件头注释）。
 */
interface ParentPort {
	on(event: "message", listener: (message: { data: unknown }) => void): void;
	postMessage(message: unknown): void;
}

/**
 * 取父进程端口。写成函数而不是「const + if 抛错」，是因为后者的类型窄化
 * 不会穿透到 post() 这类函数声明里（函数声明会提升，TS 保守处理）。
 * 这里直接返回非可选类型，调用方无需再窄化。
 */
function requireParentPort(): ParentPort {
	const port = (process as unknown as { parentPort?: ParentPort }).parentPort;
	if (port === undefined) {
		// 直接用 node 跑本文件会走到这里。不静默降级——这属于用错了入口。
		throw new Error("daemon 必须在 Electron utilityProcess 中启动（process.parentPort 不存在）");
	}
	return port;
}

const parentPort = requireParentPort();

function post(frame: DaemonOutbound): void {
	parentPort.postMessage(frame);
}

/* ── 原生模块探针（ARCHITECTURE.md §4.1 的待验证项）────────────────── */

/**
 * 在 import pi 之前挂钩子，观测 .node 加载。
 *
 * 背景：pi 依赖树里有三个原生模块，其中 clipboard 在 import 期即加载。
 * 三者全部基于 Node-API（ABI 稳定），预期在 Electron 里可直接用，
 * 但 Electron 的 Node 是自带的、版本与标准 Node 不同，必须实测。
 * scripts/smoke-pi-sdk.ts 已在标准 Node 下建立基线（3/3 通过），
 * 这里输出同类信息用于对比。
 */
const nativeLoads: string[] = [];
const originalDlopen = process.dlopen.bind(process);
process.dlopen = (module: object, filename: string, flags?: number): void => {
	nativeLoads.push(filename);
	if (flags === undefined) originalDlopen(module, filename);
	else originalDlopen(module, filename, flags);
};

/* ── 会话状态 ─────────────────────────────────────────────────────── */

/**
 * 初始快照：尚未建立会话时的诚实状态。
 * D3 起由 core/ 的会话宿主接管，届时本常量退化为 fallback。
 */
const initialSnapshot: SessionSnapshot = {
	state: {
		sessionId: "",
		cwd: process.cwd(),
		modeId: "craft",
		modelId: undefined,
		isStreaming: false,
	},
	entries: [],
	availableModes: [
		{ id: "ask", label: "问答", description: "只读，不改文件不跑命令" },
		{ id: "craft", label: "创作", description: "完整工具集，可读写与执行" },
		{ id: "plan", label: "规划", description: "先出方案，确认后再动手" },
	],
};

/* ── 请求派发 ─────────────────────────────────────────────────────── */

type Handler = (args: readonly unknown[]) => Promise<unknown>;

const handlers: Record<string, Handler> = {
	[INVOKE.snapshot]: async () => initialSnapshot,

	// 以下通道的实现随 D3（权限弹窗 + 会话接入）落地。
	// 现在明确报错而不是静默成功——静默会让 UI 看起来正常、实际什么都没发生。
	[INVOKE.prompt]: async () => {
		throw new Error("会话尚未接入（D3）");
	},
	[INVOKE.abort]: async () => {
		throw new Error("会话尚未接入（D3）");
	},
	[INVOKE.setMode]: async () => {
		throw new Error("会话尚未接入（D3）");
	},
	[INVOKE.setModel]: async () => {
		throw new Error("会话尚未接入（D3）");
	},
	[INVOKE.uiResponse]: async () => {
		throw new Error("会话尚未接入（D3）");
	},
	[INVOKE.permissionResponse]: async () => {
		throw new Error("会话尚未接入（D3）");
	},
};

async function dispatch(request: DaemonRequest): Promise<void> {
	// 每个请求记一行。daemon 没有界面，出问题时这是唯一的现场证据
	// （WorkBuddy 把「启动即可观测」列为 P0，同一个考虑）。
	console.log(`← ${request.channel}`);

	const handler = handlers[request.channel];
	if (handler === undefined) {
		post({ kind: "response", id: request.id, ok: false, error: `未知通道：${request.channel}` });
		return;
	}
	try {
		const value = await handler(request.args);
		post({ kind: "response", id: request.id, ok: true, value });
	} catch (error) {
		// 只回一句给用户看的话；stack 留在 daemon 侧日志里（shared/daemon-protocol.ts 的约定）。
		if (error instanceof Error && error.stack !== undefined) console.error(error.stack);
		post({
			kind: "response",
			id: request.id,
			ok: false,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

parentPort.on("message", (message) => {
	const frame = message.data;
	if (!isDaemonRequest(frame)) {
		console.error(`收到无法识别的帧：${JSON.stringify(frame)}`);
		return;
	}
	void dispatch(frame);
});

/* ── 启动 ─────────────────────────────────────────────────────────── */

async function start(): Promise<void> {
	console.log(`daemon 启动：node ${process.version} on ${process.platform}-${process.arch}`);

	// 这一行是 §4.1 的实测：Electron 的 Node 能不能加载 pi 的 Node-API 模块。
	await import("@earendil-works/pi-coding-agent");

	console.log(`pi SDK 已加载，原生模块 ${nativeLoads.length} 个：`);
	for (const path of nativeLoads) console.log(`  ${path}`);

	post({ kind: "ready" });
}

start().catch((error: unknown) => {
	// 启动失败不能静默：父进程会一直等 ready，UI 停在 loading。
	console.error("daemon 启动失败");
	console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
	process.exit(1);
});
