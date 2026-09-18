/**
 * 运行时状态机驱动器（内核）的测试。
 *
 * 用合成状态机（不牵扯 python/venv）：本文件只该回答「驱动器把纯函数状态机
 * 推到位了吗」—— 相位语义由各运行时自己的测试负责（docx-env.test.ts 九相位、
 * runtimes/python.test.ts 装配链路）。
 */

import { describe, expect, it } from "vitest";
import type { SpawnOutcome, SpawnRequest } from "../../documents/docx-env.ts";
import { bindRuntimeMachine, driveRuntimeMachine, type RuntimeMachine } from "./machine.ts";

interface TestState {
	readonly phase: string;
	readonly attempts: number;
	readonly failedAt?: string;
}

/** a → b → ready 两步收敛；非零码即 failed（归因记在 failedAt）。 */
const MACHINE: RuntimeMachine<TestState, undefined> = {
	label: "测试运行时",
	maxSteps: 6,
	initial: () => ({ phase: "a", attempts: 0 }),
	nextStep: (state) =>
		state.phase === "ready" || state.phase === "failed" ? null : { command: "sh", args: [state.phase] },
	reduce: (state, outcome) => {
		if (outcome.code !== 0) {
			return { phase: "failed", attempts: state.attempts + 1, failedAt: state.phase };
		}
		if (state.phase === "a") return { phase: "b", attempts: state.attempts + 1 };
		return { phase: "ready", attempts: state.attempts + 1 };
	},
	phaseOf: (state) => state.phase,
	ready: (state) => state.phase === "ready",
	failure: (state) =>
		state.phase === "failed" ? { phase: state.failedAt ?? "unknown", error: "编排的失败" } : undefined,
};

/** 永不收敛：nextStep 一直给指令，状态原样不动。 */
const STUCK: RuntimeMachine<TestState, undefined> = {
	...MACHINE,
	reduce: (state) => state,
};

function ok(): SpawnOutcome {
	return { code: 0, stdout: "", stderr: "" };
}
function bad(): SpawnOutcome {
	return { code: 1, stdout: "", stderr: "boom" };
}

function recorder(outcome: SpawnOutcome): { calls: SpawnRequest[]; spawn: (req: SpawnRequest) => Promise<SpawnOutcome> } {
	const calls: SpawnRequest[] = [];
	return {
		calls,
		spawn: (req) => {
			calls.push(req);
			return Promise.resolve(outcome);
		},
	};
}

describe("bindRuntimeMachine", () => {
	it("转交 label / maxSteps，并把状态推进关在闭包里", () => {
		const runner = bindRuntimeMachine(MACHINE, undefined);
		expect(runner.label).toBe("测试运行时");
		expect(runner.maxSteps).toBe(6);
		expect(runner.phase()).toBe("a");
		expect(runner.ready()).toBe(false);

		runner.accept(ok());
		expect(runner.phase()).toBe("b");
		expect(runner.nextStep()).toEqual({ command: "sh", args: ["b"] });
		runner.accept(ok());
		expect(runner.ready()).toBe(true);
		expect(runner.nextStep()).toBeNull();
		expect(runner.failure()).toBeUndefined();
	});
});

describe("driveRuntimeMachine", () => {
	it("收敛：结论 ready，且与直接问状态机的结论一致", async () => {
		const runner = bindRuntimeMachine(MACHINE, undefined);
		const { calls, spawn } = recorder(ok());
		const outcome = await driveRuntimeMachine(runner, spawn);

		expect(outcome).toEqual({ ready: true });
		expect(calls.map((call) => call.args[0])).toEqual(["a", "b"]);
		// 驱动器不自造结论：ready 必须就是状态机自己的判定。
		expect(runner.ready()).toBe(outcome.ready);
	});

	it("失败：归因取自状态机（相位 + 原因），不是驱动器猜的", async () => {
		const runner = bindRuntimeMachine(MACHINE, undefined);
		const { spawn } = recorder(bad());
		const outcome = await driveRuntimeMachine(runner, spawn);

		expect(outcome).toEqual({ ready: false, phase: "a", error: "编排的失败" });
		expect(runner.ready()).toBe(false);
	});

	it("不收敛：撞步数上界即响亮报错（带 label 与停在哪个相位），不静默返回 ready", async () => {
		const runner = bindRuntimeMachine(STUCK, undefined);
		const { calls, spawn } = recorder(ok());
		const outcome = await driveRuntimeMachine(runner, spawn);

		expect(calls).toHaveLength(STUCK.maxSteps);
		expect(outcome.ready).toBe(false);
		if (outcome.ready) throw new Error("unreachable");
		expect(outcome.phase).toBe("a");
		expect(outcome.error).toContain("测试运行时");
		expect(outcome.error).toContain("步数超限");
	});
});
