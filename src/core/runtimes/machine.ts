/**
 * 运行时状态机抽象（托管运行时内核）。
 *
 * 为什么要有这一层：把「怎么把一个运行时装到就绪」从**某一个运行时**里抽出来。
 * 抽之前它只长在 documents/docx-env.ts 里（九相位 + 纯函数 reduce），
 * 于是「相位推进、终态判定、步数上界」这些与运行时无关的东西被 venv 细节裹住，
 * 想再加一个运行时（node / gitbash）只能复制一遍。
 *
 * 分成两半，各自有理由：
 *   - `RuntimeMachine<S, C>`：**纯函数**形态（与 docx-env 的既有九相位同形）——
 *     同样的 (state, ctx) 必得同样的下一步指令，所以全部分支能用假 spawn 单测；
 *   - `RuntimeRunner`：把私有状态类型 `S` 装在闭包里，登记表与驱动器只见
 *     `phase / nextStep / accept / ready / failure`。**加一个运行时不必让内核
 *     认识它的状态形状**（否则登记表会被泛型传染成 `any` 或一串特化分支）。
 *
 * spawn 原语（SpawnRequest / SpawnOutcome / SpawnFn）的家在 documents/docx-env.ts：
 * 它是首个运行时实例的 spawn 契约，core → documents 是允许的依赖方向
 * （AGENTS.md §1）；把它挪进内核要动所有工具调用点却没有行为收益。
 */

import type { SpawnFn, SpawnOutcome, SpawnRequest } from "../../documents/docx-env.ts";

/** 失败归因：相位 + 写给用户/模型的原因（状态机的既有语义，一字不改）。 */
export interface RuntimeFailure {
	readonly phase: string;
	readonly error: string;
}

/** 纯函数状态机。`ready`/`failure` 是终态判定，驱动器的结论必须与之一致。 */
export interface RuntimeMachine<S, C> {
	readonly label: string;
	/** 步数上界：防 reduce 改出循环时把 daemon 挂死（撞线即响亮报错，不是静默兜底）。 */
	readonly maxSteps: number;
	initial(): S;
	nextStep(state: S, ctx: C): SpawnRequest | null;
	reduce(state: S, outcome: SpawnOutcome, ctx: C): S;
	phaseOf(state: S): string;
	ready(state: S): boolean;
	failure(state: S): RuntimeFailure | undefined;
}

/** 绑定了私有状态的推进器：内核与登记表只见这几个动作。 */
export interface RuntimeRunner {
	readonly label: string;
	readonly maxSteps: number;
	phase(): string;
	nextStep(): SpawnRequest | null;
	accept(outcome: SpawnOutcome): void;
	ready(): boolean;
	failure(): RuntimeFailure | undefined;
}

/** 把纯函数状态机 + 上下文绑成一个推进器（状态只在闭包里，不外泄）。 */
export function bindRuntimeMachine<S, C>(machine: RuntimeMachine<S, C>, ctx: C): RuntimeRunner {
	let state = machine.initial();
	return {
		label: machine.label,
		maxSteps: machine.maxSteps,
		phase: () => machine.phaseOf(state),
		nextStep: () => machine.nextStep(state, ctx),
		accept: (outcome) => {
			state = machine.reduce(state, outcome, ctx);
		},
		ready: () => machine.ready(state),
		failure: () => machine.failure(state),
	};
}

export type MachineOutcome =
	| { readonly ready: true }
	| { readonly ready: false; readonly phase: string; readonly error: string };

/**
 * 驱动一次「装到就绪」：反复取下一步 → spawn → 喂回状态机，直到终态或步数用尽。
 * 驱动器不解释相位，也不碰磁盘 —— 磁盘上「算不算就绪」由 runtime-store 的
 * current + manifest 决定，两者是不同的问题（这里管「这一轮跑完了吗」）。
 */
export async function driveRuntimeMachine(runner: RuntimeRunner, spawn: SpawnFn): Promise<MachineOutcome> {
	for (let step = 0; step < runner.maxSteps; step += 1) {
		const request = runner.nextStep();
		if (request === null) break;
		runner.accept(await spawn(request));
	}
	if (runner.ready()) return { ready: true };
	const failure = runner.failure();
	if (failure !== undefined) return { ready: false, phase: failure.phase, error: failure.error };
	// 没到终态、也没报失败 = 状态机不收敛（撞步数上界）。
	return {
		ready: false,
		phase: runner.phase(),
		error: `${runner.label}状态机步数超限（未能收敛，停在 ${runner.phase()}）`,
	};
}
