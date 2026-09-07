/**
 * main ↔ daemon 的帧协议（MessagePort 之上）。
 *
 * 与 ipc.ts 的分工：ipc.ts 定义 renderer↔main 的**语义**通道（含 payload 类型），
 * 本文件只定义 main↔daemon 的**传输**帧。main 是哑转发器，
 * 它把 renderer 的 invoke 包成 DaemonRequest 丢过去，把 DaemonPush 原样 send 给 renderer，
 * 全程不解释 payload —— 业务判断只在 daemon 里发生（ARCHITECTURE.md §3）。
 *
 * 这样做的收益：新增一个业务通道只改 ipc.ts + daemon，main 一行不动。
 */

/** main → daemon：一次请求。channel 取自 ipc.ts 的 INVOKE。 */
export interface DaemonRequest {
	readonly kind: "request";
	/** 关联 id，daemon 必须在响应里原样回填。 */
	readonly id: string;
	readonly channel: string;
	readonly args: readonly unknown[];
}

/** daemon → main：请求的响应。 */
export type DaemonResponse = {
	readonly kind: "response";
	readonly id: string;
} & (
	| { readonly ok: true; readonly value: unknown }
	/**
	 * 失败只回一句给用户看的话。
	 * stack 留在 daemon 侧日志里，不跨进程 —— 免得泄到 UI 上（AGENTS.md §7）。
	 */
	| { readonly ok: false; readonly error: string }
);

/** daemon → main → renderer：单向推送。channel 取自 ipc.ts 的 PUSH。 */
export interface DaemonPush {
	readonly kind: "push";
	readonly channel: string;
	readonly payload: unknown;
}

/**
 * daemon 启动完成。main 收到后才把窗口从 loading 态放出来。
 * 单独一种帧而不是复用 push：main 需要自己消费它（管生命周期），不只是转发。
 */
export interface DaemonReady {
	readonly kind: "ready";
}

/** daemon → main 的全部帧。 */
export type DaemonOutbound = DaemonResponse | DaemonPush | DaemonReady;

/** main → daemon 的全部帧。 */
export type DaemonInbound = DaemonRequest;

/** 类型收窄辅助。daemon 与 main 两侧共用，避免各写一遍 kind 判断。 */
export function isDaemonRequest(frame: unknown): frame is DaemonRequest {
	return typeof frame === "object" && frame !== null && (frame as { kind?: unknown }).kind === "request";
}
