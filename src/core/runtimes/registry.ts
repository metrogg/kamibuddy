/**
 * 运行时注册表与通用安装驱动（托管运行时内核）。
 *
 * 「加一个运行时只是加一份注册描述，不改内核」的落点：
 *   - 内核（本文件 + machine.ts + runtime-store.ts）只见 `RuntimeDescriptor` 的六个动作；
 *   - 描述放在各自的文件里（首个实例：runtimes/python.ts），登记进下面的
 *     `RUNTIME_REGISTRY` 一行即可 —— 泛型不外泄，因此加运行时不会传染出 `any`
 *     或一串 `if (id === ...)` 分支。
 *
 * 安装的原子性协议（顺序不可换，理由见 runtime-store.ts 文件头）：
 *   暂存目录 → 状态机校验 → 改名进位 → **进位后只读复验** → 写 manifest → **最后**写 current
 * 「进位后只读复验」这一条是本内核加的：venv / 解包目录里可能带绝对路径，
 * 「在暂存路径上校验通过」不等于「在最终路径上可用」。不复验就会出现「current
 * 已写、转换却失败」的假就绪 —— 那正是本阶段要消灭的状态。
 * 「manifest 在复验之后」也是刻意的：于是「有 manifest」≡「已在最终路径上验过」，
 * 完成标记不会替一份没验过的实例背书。
 *
 * ensure 的三条路径（优先级与「唯一真源」的判据在 runtimes/python.ts 的 resolve）：
 *   - 覆盖口 / 复用旧路径（不受托管根管辖）：**就地** ensure，绝不改用户的目录结构；
 *   - 托管实例已就位：**就地** 修复（venv 坏了就地重建就是原行为），修好后补齐
 *     manifest 与 current（指针自愈）；
 *   - 尚无托管实例：走上面的原子安装链路。
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
	instanceDir,
	isCompleteInstance,
	listStaging,
	promoteStaging,
	publishCurrent,
	removeDir,
	runtimeHome,
	stagingDir,
	writeCurrent,
	writeManifest,
	type RuntimeManifest,
} from "../runtime-store.ts";
import { appendRuntimeEvent } from "./diagnostics.ts";
import { driveRuntimeMachine, type RuntimeRunner } from "./machine.ts";
import { createGitbashRuntime } from "./gitbash.ts";
import { createNodeRuntime } from "./node.ts";
import { createPythonRuntime } from "./python.ts";
import type { SpawnFn } from "../../documents/docx-env.ts";

/** 已接入的托管运行时。加一个运行时 = 加一份描述 + 这里与 RUNTIME_REGISTRY 各一行（内核不改）。 */
export type RuntimeId = "python" | "node" | "gitbash";

/** 生效落点的来源。诊断必须如实说明走了哪一条。 */
export type RuntimeSource =
	/** 由用户/运维显式指定的环境变量（覆盖口），跳过托管根。 */
	| "override"
	/** 托管根 `current` 指向的实例（正常路径）。 */
	| "managed"
	/** 复用托管根之外的既有环境（迁移期的旧路径，不静默丢弃）。 */
	| "legacy"
	/** 尚无托管实例，将由本次安装占位。 */
	| "pending";

export interface RuntimeOptions {
	/** 托管根（`<configDir>/runtimes`）。 */
	readonly root: string;
	readonly homeDir: string;
	/** process.platform；注入是为了让 Windows 布局在测试里可断言。 */
	readonly platform: string;
	/** 引擎目录（resources/docx-engine）：python 运行时的随包依赖。 */
	readonly engineDir: string;
	/** 读环境的注入点（测试用；生产是 process.env）。 */
	readonly env?: Readonly<Record<string, string | undefined>>;
}

/** 运行时的四态探测结果（只读，绝不安装）。与 shared/ipc.ts 的 `DocxEnvStatus` 同形。 */
export type RuntimeInspectResult =
	| { readonly kind: "missing" }
	| { readonly kind: "wrong-version"; readonly version: string }
	| { readonly kind: "deps-missing"; readonly module: string }
	| { readonly kind: "ready" };

/** 「这一轮该用哪个目录」的结论。install / ensure / 诊断都以此为唯一输入。 */
export interface RuntimeResolution {
	/** 这一版的托管实例目录：`<root>/<id>/<version>`。 */
	readonly instanceDir: string;
	/** 本次实例的版本段。 */
	readonly version: string;
	/** 生效的环境目录（python 是 venv 根）。覆盖口 / 复用旧路径时它不在托管根下。 */
	readonly activeDir: string;
	readonly source: RuntimeSource;
	/** 诊断用：这一条结论是怎么定下来的（照抄进报告，不许另写一套说法）。 */
	readonly detail: string;
	/** 是否受托管根管辖。false ⇒ 就地 ensure，不写 current、不进位。 */
	readonly managed: boolean;
}

export interface RuntimeDescriptor {
	readonly id: RuntimeId;
	readonly label: string;
	/** 期望版本，同时是 `<id>/<version>/` 的版本段。 */
	readonly version: string;
	/** 来源与校验方式（spec SubTask 0.1 的书面结论落到这里，诊断如实列出）。 */
	readonly source: string;
	readonly options: RuntimeOptions;
	resolve(): RuntimeResolution;
	/** 实例目录 → 环境目录（python：`<实例>/venv`；解包型运行时可以是恒等）。 */
	envDirOf(instanceDir: string): string;
	/** 用「本轮落点」开一条状态机推进器（首次安装时落点是暂存目录）。 */
	createRunner(envDir: string): RuntimeRunner;
	/** 四态只读探测。 */
	inspect(envDir: string, spawn: SpawnFn): Promise<RuntimeInspectResult>;
}

export type RuntimeDescriptorFactory = (options: RuntimeOptions) => RuntimeDescriptor;

/** 注册表：加运行时 = 加一份描述工厂 + 这里一行。`Record<RuntimeId, ...>` 保证不漏。 */
export const RUNTIME_REGISTRY: Readonly<Record<RuntimeId, RuntimeDescriptorFactory>> = {
	python: createPythonRuntime,
	node: createNodeRuntime,
	gitbash: createGitbashRuntime,
};

export type RuntimeEnsureOutcome =
	| { readonly status: "ready"; readonly activeDir: string }
	| { readonly status: "failed"; readonly phase: string; readonly error: string };

/** 只可能成功的产出（回滚 / 发布）：调用方不必再判 status。 */
export interface RuntimePublishedOutcome {
	readonly status: "ready";
	readonly activeDir: string;
}

function manifestFor(descriptor: RuntimeDescriptor): RuntimeManifest {
	return {
		id: descriptor.id,
		version: descriptor.version,
		source: descriptor.source,
		installedAt: new Date().toISOString(),
		status: "installed",
	};
}

/** 暂存目录名后缀：同一次安装内唯一即可（目录名带版本，诊断能一眼看出是半成品）。 */
function stagingNonce(): string {
	return `${process.pid.toString(36)}-${Date.now().toString(36)}`;
}

/**
 * 清掉上次中断留下的残留：暂存目录 + 未进位的版本目录。
 *
 * 为什么是「清掉重来」而不是「续装」：venv / 解包目录都不存在「半成品可用」的续装点，
 * 硬续只会把一个不完整的环境当完整用。清掉 + 重跑是幂等的，用户视角就是「再点一次重置」。
 */
function clearLeftovers(descriptor: RuntimeDescriptor): void {
	const { root } = descriptor.options;
	for (const name of listStaging(root, descriptor.id)) {
		removeDir(join(runtimeHome(root, descriptor.id), name));
	}
	const target = instanceDir(root, descriptor.id, descriptor.version);
	if (!isCompleteInstance(target)) removeDir(target);
}

/** 就地 ensure（覆盖口 / 复用旧路径 / 已有托管实例的自愈）。 */
async function ensureInPlace(
	descriptor: RuntimeDescriptor,
	resolution: RuntimeResolution,
	spawn: SpawnFn,
): Promise<RuntimeEnsureOutcome> {
	const machine = await driveRuntimeMachine(descriptor.createRunner(resolution.activeDir), spawn);
	if (!machine.ready) return { status: "failed", phase: machine.phase, error: machine.error };
	if (resolution.managed) {
		/*
		 * 就地修好的实例没有经过暂存进位，所以在这里补齐「完整」与「当前」两个标记。
		 * 顺序仍旧是完成标记在前、current 最后（理由见 runtime-store.ts 文件头）。
		 */
		if (!isCompleteInstance(resolution.instanceDir)) writeManifest(resolution.instanceDir, manifestFor(descriptor));
		publishCurrent(descriptor.options.root, descriptor.id, resolution.version);
	}
	return { status: "ready", activeDir: resolution.activeDir };
}

/**
 * 原子安装到托管根：幂等（已完整进位则只补指针）、可续跑（残留先清）。
 * 「重置并重新安装」直接复用它 —— 重置就是「清干净 + 走这条路」。
 */
export async function installRuntime(
	descriptor: RuntimeDescriptor,
	spawn: SpawnFn,
): Promise<RuntimeEnsureOutcome> {
	const { root } = descriptor.options;
	const target = instanceDir(root, descriptor.id, descriptor.version);
	if (isCompleteInstance(target)) {
		// 幂等：这一版已经完整进位过，只把指针补正，不重新下载/重建。
		writeCurrent(root, descriptor.id, descriptor.version);
		return { status: "ready", activeDir: descriptor.envDirOf(target) };
	}
	clearLeftovers(descriptor);
	const staging = stagingDir(root, descriptor.id, descriptor.version, stagingNonce());
	mkdirSync(staging, { recursive: true });
	const staged = await driveRuntimeMachine(descriptor.createRunner(descriptor.envDirOf(staging)), spawn);
	if (!staged.ready) {
		removeDir(staging);
		appendRuntimeEvent(descriptor, { kind: "runtime_install", outcome: "failed", phase: staged.phase, error: staged.error });
		return { status: "failed", phase: staged.phase, error: staged.error };
	}
	try {
		const promoted = promoteStaging(root, descriptor.id, descriptor.version, staging);
		/*
		 * 进位后**只读复验**：venv / 解包目录里可能带绝对路径，「在暂存路径上校验通过」
		 * 不等于「在最终路径上可用」。不过这一验，就会出现「current 已写、转换却失败」
		 * 的假就绪 —— 那正是本阶段要消灭的状态。复验用 inspect（只读四态），不重新安装。
		 */
		const verified = await descriptor.inspect(descriptor.envDirOf(promoted), spawn);
		if (verified.kind !== "ready") {
			const detail = verified.kind === "deps-missing" ? `缺依赖 ${verified.module}` : verified.kind;
			const error =
				`安装后在最终路径上复验不通过（${detail}）—— 已进位但**未**发布，环境按未就绪处理。` +
				`请点「重置并重新安装」重来一次；若反复出现，请把诊断报告发给我们。`;
			appendRuntimeEvent(descriptor, { kind: "runtime_install", outcome: "failed", phase: "verify-promoted", error });
			return { status: "failed", phase: "verify-promoted", error };
		}
		// 完成标记写在复验之后：于是「有 manifest」≡「已在最终路径上验过」。
		writeManifest(promoted, manifestFor(descriptor));
		// 最后一步：写 current。此行之前断电，盘上都不会出现「看起来就绪」的状态。
		writeCurrent(root, descriptor.id, descriptor.version);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const failure = { phase: "publish", error: `发布托管实例失败：${message}` };
		appendRuntimeEvent(descriptor, { kind: "runtime_install", outcome: "failed", ...failure });
		return { status: "failed", ...failure };
	}
	appendRuntimeEvent(descriptor, { kind: "runtime_install", outcome: "installed", version: descriptor.version });
	return { status: "ready", activeDir: descriptor.envDirOf(target) };
}

/** 幂等确保运行时可用。**每次转换前的调用入口**（就绪时几次快速探测秒退）。 */
export async function ensureRuntime(
	descriptor: RuntimeDescriptor,
	spawn: SpawnFn,
): Promise<RuntimeEnsureOutcome> {
	const resolution = descriptor.resolve();
	const outcome =
		resolution.managed && resolution.source === "pending"
			? await installRuntime(descriptor, spawn)
			: await ensureInPlace(descriptor, resolution, spawn);
	if (outcome.status === "failed") {
		appendRuntimeEvent(descriptor, {
			kind: "runtime_ensure",
			outcome: "failed",
			phase: outcome.phase,
			error: outcome.error,
			source: resolution.source,
		});
	}
	return outcome;
}

/**
 * 重置并重新安装：清掉托管根下的这一版（完整品与半成品一起清）→ 走原子安装链路。
 * 仅凭这一个动作就能修好环境（spec Scenario: 环境损坏），无需用户手删目录。
 *
 * 覆盖口例外：目录的所有权不在我们（运维预置的 venv），只就地重建，不删。
 * 旧路径（~/.venv-html-to-docx）不在这里删 —— 不静默丢用户的目录；装好托管实例后
 * current 生效，旧目录被忽略，诊断会如实说「它还在、现在没在用」。
 */
export async function resetRuntime(
	descriptor: RuntimeDescriptor,
	spawn: SpawnFn,
): Promise<RuntimeEnsureOutcome> {
	const resolution = descriptor.resolve();
	appendRuntimeEvent(descriptor, { kind: "runtime_reset", outcome: "started", source: resolution.source });
	if (resolution.source === "override") return ensureInPlace(descriptor, resolution, spawn);
	clearLeftovers(descriptor);
	removeDir(instanceDir(descriptor.options.root, descriptor.id, descriptor.version));
	return installRuntime(descriptor, spawn);
}

/** 回滚：只切 current 指针，不重新下载（目标实例必须已完整进位，否则响亮报错）。 */
export function rollbackRuntime(descriptor: RuntimeDescriptor, version: string): RuntimePublishedOutcome {
	publishCurrent(descriptor.options.root, descriptor.id, version);
	appendRuntimeEvent(descriptor, { kind: "runtime_rollback", outcome: "published", version });
	return {
		status: "ready",
		activeDir: descriptor.envDirOf(instanceDir(descriptor.options.root, descriptor.id, version)),
	};
}

/** 只读探测生效落点的四态（不动磁盘）。 */
export async function inspectRuntime(
	descriptor: RuntimeDescriptor,
	spawn: SpawnFn,
): Promise<RuntimeInspectResult> {
	return descriptor.inspect(descriptor.resolve().activeDir, spawn);
}
