/**
 * 授权 worker 客户端的行为测试（注入假 worker，不需要真线程、不需要特权）。
 *
 * 这里钉的是**跨线程边界的失败语义** —— 它是这次改动的真正风险所在：
 * 授权以前在进程内直调，异常就是异常；搬进 worker 之后，「worker 崩了」、
 * 「worker 没给结果就退出」、「结果来晚了」都成了新的失败形状，
 * 而它们全都必须落成**带原因枚举的拒绝**，否则沙箱会静默失去写约束
 * （fail-closed 的前提是每一环的失败都能被如实分类，见 sandbox-runner.ts 文件头）。
 *
 * 真线程能不能跑（koffi 在 worker 里加载、主线程不被堵）不在单测范围：
 * 那是 `scripts/probe-sandbox-worker.mts` 的活。
 */

import { describe, expect, it } from "vitest";

import { classifyFailure, SandboxPrepareFailure } from "../sandbox/index.ts";
import {
	prepareSandboxInWorker,
	type PrepareWorkerLike,
} from "./sandbox-prepare-client.ts";

interface FakeWorkerHandle {
	readonly worker: PrepareWorkerLike;
	emitMessage(message: unknown): void;
	emitError(error: Error): void;
	emitExit(code: number): void;
	readonly posted: unknown[];
	terminateCalls(): number;
}

function fakeWorker(): FakeWorkerHandle {
	const messageListeners: ((message: unknown) => void)[] = [];
	const errorListeners: ((error: Error) => void)[] = [];
	const exitListeners: ((code: number) => void)[] = [];
	const posted: unknown[] = [];
	let terminates = 0;

	const worker = {
		on(event: string, listener: (payload: never) => void): void {
			if (event === "message") messageListeners.push(listener as (m: unknown) => void);
			else if (event === "error") errorListeners.push(listener as (e: Error) => void);
			else exitListeners.push(listener as (c: number) => void);
		},
		postMessage(message: unknown): void {
			posted.push(message);
		},
		terminate(): void {
			terminates += 1;
		},
	} as PrepareWorkerLike;

	return {
		worker,
		emitMessage: (message) => {
			for (const listener of messageListeners) listener(message);
		},
		emitError: (error) => {
			for (const listener of errorListeners) listener(error);
		},
		emitExit: (code) => {
			for (const listener of exitListeners) listener(code);
		},
		posted,
		terminateCalls: () => terminates,
	};
}

const REQUEST = { workspaceDir: "C:\\w", writableDirs: ["C:\\w"] };

describe("prepareSandboxInWorker", () => {
	it("把请求发给 worker，并把 done 翻成授权结果（含规模读数）", async () => {
		const fake = fakeWorker();
		const pending = prepareSandboxInWorker(REQUEST, { spawn: () => fake.worker });
		expect(fake.posted[0]).toEqual(REQUEST);

		fake.emitMessage({ kind: "done", fastPath: false, elapsedMs: 19_300, entries: 43_723, capped: false });

		await expect(pending).resolves.toEqual({
			fastPath: false,
			elapsedMs: 19_300,
			entries: 43_723,
			capped: false,
		});
		// 一次性 worker：拿到结果就关掉，不留线程。
		expect(fake.terminateCalls()).toBe(1);
	});

	it("failed 消息带着 worker 侧分类好的原因，且 classifyFailure 认它", async () => {
		const fake = fakeWorker();
		const pending = prepareSandboxInWorker(REQUEST, { spawn: () => fake.worker });
		fake.emitMessage({
			kind: "failed",
			reason: "acl-grant-failed",
			detail: "SetNamedSecurityInfoW 失败：拒绝访问",
		});

		const error = await pending.catch((e: unknown) => e);
		expect(error).toBeInstanceOf(SandboxPrepareFailure);
		// 关键：原因必须原样活着回到调用方 —— 退化成兜底值会把设置页的
		// 「工作目录授权失败」说成「受限令牌创建失败」，指错排查方向。
		expect(classifyFailure(error)).toBe("acl-grant-failed");
		expect((error as Error).message).toContain("SetNamedSecurityInfoW");
	});

	it("worker 自身报错 → prepare-worker-failed（不是「授权被拒」）", async () => {
		const fake = fakeWorker();
		const pending = prepareSandboxInWorker(REQUEST, { spawn: () => fake.worker });
		fake.emitError(new Error("Cannot find module sandbox-prepare-worker.mjs"));

		const error = await pending.catch((e: unknown) => e);
		expect(classifyFailure(error)).toBe("prepare-worker-failed");
		expect(fake.terminateCalls()).toBe(1);
	});

	it("worker 没给结果就退出 → prepare-worker-failed（不能永远挂着）", async () => {
		const fake = fakeWorker();
		const pending = prepareSandboxInWorker(REQUEST, { spawn: () => fake.worker });
		fake.emitExit(1);

		const error = await pending.catch((e: unknown) => e);
		expect(classifyFailure(error)).toBe("prepare-worker-failed");
		expect((error as Error).message).toContain("exit 1");
	});

	it("worker 起不来（spawn 抛）→ prepare-worker-failed", async () => {
		const pending = prepareSandboxInWorker(REQUEST, {
			spawn: () => {
				throw new Error("worker 线程起不来");
			},
		});
		const error = await pending.catch((e: unknown) => e);
		expect(classifyFailure(error)).toBe("prepare-worker-failed");
	});

	it("结果先到、随后 terminate 触发的 exit 不会把成功翻成失败", async () => {
		const fake = fakeWorker();
		const pending = prepareSandboxInWorker(REQUEST, { spawn: () => fake.worker });
		fake.emitMessage({ kind: "done", fastPath: true, elapsedMs: 1, entries: 0, capped: false });
		fake.emitExit(0);

		await expect(pending).resolves.toMatchObject({ fastPath: true, elapsedMs: 1 });
		expect(fake.terminateCalls()).toBe(1);
	});
});
