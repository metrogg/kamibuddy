import { describe, expect, it } from "vitest";
import { initialConversation } from "../shared/conversation.ts";
import {
	createBucket,
	enqueue,
	MAX_IDLE_HOSTS,
	pickEvictions,
	type SessionBucket,
} from "./session-registry.ts";

/** 桩宿主：注册表逻辑不碰 pi，只需要一个可 dispose 的最小形状。 */
interface StubHost {
	readonly id: string;
	disposed: boolean;
}

function makeBucket(overrides: Partial<SessionBucket<StubHost>> = {}): SessionBucket<StubHost> {
	return {
		...createBucket<StubHost>({ cwd: "/tmp/x", conversation: initialConversation }),
		...overrides,
	};
}

/** 有宿主的桶（pristine 之外的常态）。 */
function hostedBucket(id: string, overrides: Partial<SessionBucket<StubHost>> = {}): SessionBucket<StubHost> {
	return makeBucket({
		sessionId: id,
		sessionFilePath: `/sessions/${id}.jsonl`,
		hostPromise: Promise.resolve({ id, disposed: false }),
		...overrides,
	});
}

/** 手动闸门：控制异步操作何时放行。 */
function gate() {
	let release!: () => void;
	const promise = new Promise<void>((resolve) => {
		release = resolve;
	});
	return { promise, release };
}

describe("enqueue（同会话互斥链）", () => {
	it("同桶操作严格按到达顺序串行", async () => {
		const bucket = makeBucket();
		const order: string[] = [];
		const first = gate();

		const p1 = enqueue(bucket, async () => {
			await first.promise;
			order.push("op1");
		});
		const p2 = enqueue(bucket, async () => {
			order.push("op2");
		});
		const p3 = enqueue(bucket, async () => {
			order.push("op3");
		});

		// op1 卡住时后续不偷跑
		await Promise.resolve();
		expect(order).toEqual([]);
		first.release();
		await Promise.all([p1, p2, p3]);
		expect(order).toEqual(["op1", "op2", "op3"]);
	});

	it("不同桶互不阻塞", async () => {
		const a = makeBucket();
		const b = makeBucket();
		const order: string[] = [];
		const slowA = gate();

		const pa = enqueue(a, async () => {
			await slowA.promise;
			order.push("a");
		});
		const pb = enqueue(b, async () => {
			order.push("b");
		});

		await pb;
		// b 不等 a
		expect(order).toEqual(["b"]);
		slowA.release();
		await pa;
		expect(order).toEqual(["b", "a"]);
	});

	it("上一棒失败不毒化链，后续操作照常执行", async () => {
		const bucket = makeBucket();
		const order: string[] = [];
		const p1 = enqueue(bucket, async () => {
			throw new Error("boom");
		});
		const p2 = enqueue(bucket, async () => {
			order.push("op2");
		});
		await expect(p1).rejects.toThrow("boom");
		await p2;
		expect(order).toEqual(["op2"]);
	});

	it("链上在途时 pendingOps > 0，结束后归零", async () => {
		const bucket = makeBucket();
		const held = gate();
		const p = enqueue(bucket, async () => {
			await held.promise;
		});
		expect(bucket.pendingOps).toBe(1);
		held.release();
		await p;
		// pendingOps 由 tail 的 finally 维护，等一拍让 finally 跑完
		await bucket.tail;
		expect(bucket.pendingOps).toBe(0);
	});
});

describe("pickEvictions（空闲宿主 LRU 回收）", () => {
	it("空闲桶不超过上限时不回收", () => {
		const current = hostedBucket("current");
		const idle = Array.from({ length: MAX_IDLE_HOSTS }, (_, i) => hostedBucket(`idle-${i}`));
		expect(pickEvictions([current, ...idle], current)).toEqual([]);
	});

	it("超过上限时按 lastUsedAt 最旧优先回收，恰好保到上限", () => {
		const current = hostedBucket("current");
		const base = 1_000_000;
		const idle = Array.from({ length: MAX_IDLE_HOSTS + 2 }, (_, i) =>
			hostedBucket(`idle-${i}`, { lastUsedAt: base + i }),
		);
		const evicted = pickEvictions([current, ...idle], current);
		expect(evicted.map((b) => b.sessionId)).toEqual(["idle-0", "idle-1"]);
	});

	it("running / 审批待答 / 链上有活 / 当前会话 全部豁免，不计入空闲数", () => {
		const current = hostedBucket("current");
		const running = hostedBucket("running", { running: true, lastUsedAt: 1 });
		const approving = hostedBucket("approving", { pendingApprovals: 1, lastUsedAt: 2 });
		const busy = hostedBucket("busy", { pendingOps: 1, lastUsedAt: 3 });
		// 豁免桶的 lastUsedAt 故意设得最旧：若没被豁免它们会先被回收。
		const idle = Array.from({ length: MAX_IDLE_HOSTS + 1 }, (_, i) =>
			hostedBucket(`idle-${i}`, { lastUsedAt: 100 + i }),
		);
		const evicted = pickEvictions([current, running, approving, busy, ...idle], current);
		expect(evicted.map((b) => b.sessionId)).toEqual(["idle-0"]);
	});

	it("pristine 桶（无宿主）不占资源、不参与回收", () => {
		const current = hostedBucket("current");
		const pristine = makeBucket({ lastUsedAt: 1 });
		const idle = Array.from({ length: MAX_IDLE_HOSTS + 1 }, (_, i) =>
			hostedBucket(`idle-${i}`, { lastUsedAt: 100 + i }),
		);
		const evicted = pickEvictions([current, pristine, ...idle], current);
		expect(evicted.map((b) => b.sessionId)).toEqual(["idle-0"]);
		expect(evicted).not.toContain(pristine);
	});

	it("豁免桶顶满上限时不回收任何人", () => {
		const current = hostedBucket("current");
		const running = Array.from({ length: MAX_IDLE_HOSTS + 3 }, (_, i) =>
			hostedBucket(`running-${i}`, { running: true }),
		);
		const idle = [hostedBucket("idle-0", { lastUsedAt: 1 })];
		expect(pickEvictions([current, ...running, ...idle], current)).toEqual([]);
	});
});
