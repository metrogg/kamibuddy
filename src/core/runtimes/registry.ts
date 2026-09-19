/**
 * 运行时注册表与通用安装驱动（托管运行时内核）。
 *
 * 「加一个运行时只是加一份注册描述，不改内核」的落点：
 *   - 内核（本文件 + machine.ts + runtime-store.ts）只见 `RuntimeDescriptor` 的七个动作；
 *   - 描述放在各自的文件里（首个实例：runtimes/python.ts），登记进下面的
 *     `RUNTIME_REGISTRY` 一行即可 —— 泛型不外泄，因此加运行时不会传染出 `any`
 *     或一串 `if (id === ...)` 分支。
 *
 * ── 安装的原子性协议（顺序不可换，理由见 runtime-store.ts 文件头）──
 *   暂存目录 → 取件（下载+校验+解包）→ 状态机校验 → 改名进位 → **进位后只读复验**
 *   → 写 manifest → **最后**写 current
 * 「进位后只读复验」这一条是本内核加的：venv / 解包目录里可能带绝对路径，
 * 「在暂存路径上校验通过」不等于「在最终路径上可用」。不复验就会出现「current
 * 已写、转换却失败」的假就绪 —— 那正是本阶段要消灭的状态。
 * 「manifest 在复验之后」也是刻意的：于是「有 manifest」≡「已在最终路径上验过」，
 * 完成标记不会替一份没验过的实例背书。
 *
 * ── 2026-09-18 设计变更：取件从「复制随包载荷」改成「按需联网下载」──
 *   - `installRuntime`（= 用户点「安装 / 重置」）里的取件环节现在调 `descriptor.acquire`
 *     （下载 → 校验 → 解包，见 runtimes/artifact.ts）；python 没有这一格，
 *     它的取件由 uv 在状态机里做（那条链路本来就是 http）；
 *   - `ensureRuntime`（= 工具层「转换前准备好环境」）**退化成只探不装**：
 *     没装就如实返回 not-installed，让用户去设置页点安装。
 *     为什么连「顺手装一下」都不做了：安装包不能臃肿（随包载荷实测 ≈484 MB），
 *     用户的决定是「默认不下载、不安装，用户自己点才联网」——任何形式的静默自动下载
 *     都会把这个决定偷偷推翻。**门在这里，不在调用方**：谁调 ensure 都不可能触发下载。
 *   - 唯一保留的「零成本自愈」是「已完整进位、只差 current 指针」时补写指针
 *     （纯文件操作、不 spawn、不下载），崩溃续跑因此仍然不用用户手删目录。
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
import type { AcquiredArtifact, AcquireContext, RuntimeProgressListener } from "./artifact.ts";
import { DownloadCancelledError, type HttpOpener } from "./download.ts";
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

/**
 * 安装相位的固定取值（非 venv 自己的相位）。
 * `not-installed` 是 **ensure 的结论**（还没装，且**不会**自动装）；
 * `not-ready` 是「装了但当前不可用」（让用户点重置）。
 * 两者都不许写成「自动补装」，那属于 `installRuntime`。
 */
export const NOT_INSTALLED_PHASE = "not-installed";
export const NOT_READY_PHASE = "not-ready";
/** 取件（下载/校验/解包）失败。 */
export const ACQUIRE_PHASE = "acquire-artifact";
/** 用户在下载/安装过程中取消。 */
export const CANCELLED_PHASE = "cancelled";

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
	/**
	 * 取件：把发行物下载、校验、解包到 `envDir`（**只在 install / reset 里被调用**）。
	 * 缺省 = 无需取件（python 的 uv 状态机自己联网取）。
	 */
	acquire?(envDir: string, context: AcquireContext): Promise<AcquiredArtifact>;
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

/**
 * 显式安装的上下文（进度上报 / 取消 / HTTP 注入）。
 * 生产由 daemon 组装（run: `runtimes:install`），测试注入假 opener 与假 spawn。
 */
export interface InstallContext {
	/** 用户点「取消」的落点：下载层按它中断（`.part` 留作续传点）。 */
	readonly signal?: AbortSignal;
	/** 进度上报：用户点的这一次安装要如实告诉他在下什么、下到哪了。 */
	readonly onProgress?: RuntimeProgressListener;
	/** 测试注入点：HTTP 打开器（生产用 stdlib 实现）。 */
	readonly opener?: HttpOpener;
}

function manifestFor(descriptor: RuntimeDescriptor, acquired?: AcquiredArtifact): RuntimeManifest {
	return {
		id: descriptor.id,
		version: descriptor.version,
		source: descriptor.source,
		// 发行物 sha256 随实例走：诊断能回答「这一份到底是哪个字节流装出来的」。
		...(acquired === undefined ? {} : { checksum: acquired.sha256 }),
		installedAt: new Date().toISOString(),
		status: "installed",
	};
}

/** 暂存目录名后缀：同一次安装内唯一即可（目录名带版本，诊断能一眼看出是半成品）。 */
function stagingNonce(): string {
	return `${process.pid.toString(36)}-${Date.now().toString(36)}`;
}

/** 「还没装」的统一文案：说清要用户做什么，并明说不会自动下载。 */
function notInstalledMessage(descriptor: RuntimeDescriptor): string {
	return (
		`${descriptor.label} 尚未安装（${descriptor.version}）。` +
		"为控制安装包体积，运行时不随包分发、也**不会**自动下载 —— " +
		"请在「设置 → 内置运行时」点「安装」（需联网）。"
	);
}

/**
 * 「装了但当前不可用」的统一文案 —— **措辞跟着落点来源走**。
 *
 * 为什么必须分写（2026-09-19 修）：「已安装」这句话只对托管实例成立（有 manifest
 * 与进位复验背书）。复用的旧路径与覆盖口都不是我们装的，用同一句「已安装」会把用户
 * 引到错误的排查方向（去找那个目录，而不是去装我们这一份）；实测现场正是
 * 「空壳旧 venv 被说成已安装」。三者该做的事也不同：托管实例=重置这一版；
 * 覆盖口=按你指定的目录就地重建；旧路径=装进托管根（旧目录一个字节都不动）。
 * `pending` 那条不可达（上面已按 not-installed 返回），写全只为让 switch 穷尽。
 */
function notReadyMessage(
	descriptor: RuntimeDescriptor,
	resolution: RuntimeResolution,
	detail: string,
): string {
	const tail = "运行时不随包分发、也不会自动下载。";
	switch (resolution.source) {
		case "managed":
			return (
				`${descriptor.label} 已安装但当前不可用（${detail}）。` +
				`请到「设置 → 内置运行时」点「重置并重新安装」——${tail}`
			);
		case "legacy":
			return (
				`${descriptor.label} 当前复用的既有目录里这份环境不可用（${detail}）：${resolution.activeDir}。` +
				"它不在托管根下（可能是别的工具留下的环境），请到「设置 → 内置运行时」点" +
				`「重置并重新安装」把运行时装进托管根 —— 该旧目录不会被删除。${tail}`
			);
		case "override":
			return (
				`${descriptor.label} 由覆盖口（环境变量）指定的目录不可用（${detail}）：${resolution.activeDir}。` +
				"请检查那个环境变量指向的环境，或在「设置 → 内置运行时」点「重置并重新安装」" +
				`就地把这份环境重建——${tail}`
			);
		case "pending":
			return `${descriptor.label} 尚无可用实例（${detail}）。${tail}`;
	}
}

/**
 * 清掉上次中断留下的残留：暂存目录 + 未进位的版本目录。
 *
 * 为什么是「清掉重来」而不是「续装」：venv / 解包目录都不存在「半成品可用」的续装点
 * （可续的是**下载**那一层：发行物的 `.part` 在缓存目录里，不在这里），
 * 硬续只会把一个不完整的环境当完整用。清掉 + 重跑是幂等的，用户视角就是「再点一次安装」。
 */
function clearLeftovers(descriptor: RuntimeDescriptor): void {
	const { root } = descriptor.options;
	for (const name of listStaging(root, descriptor.id)) {
		removeDir(join(runtimeHome(root, descriptor.id), name));
	}
	const target = instanceDir(root, descriptor.id, descriptor.version);
	if (!isCompleteInstance(target)) removeDir(target);
}

/**
 * 就地安装（**只用于覆盖口**：`HTML_TO_DOCX_VENV` 这类用户/运维显式指定的目录）。
 * 那个目录的所有权不在我们（不是托管根下的实例），所以不进位、不写 current；
 * 至于「复用托管根之外的既有旧路径」，安装/重置的语义是**装进托管根**（见 installRuntime），
 * 不是就地改造用户的旧目录。
 */
async function installAtOverride(
	descriptor: RuntimeDescriptor,
	resolution: RuntimeResolution,
	spawn: SpawnFn,
	context: InstallContext,
): Promise<RuntimeEnsureOutcome> {
	context.onProgress?.({ message: `正在安装 ${descriptor.label} ${descriptor.version}…` });
	const machine = await driveRuntimeMachine(descriptor.createRunner(resolution.activeDir), spawn);
	if (!machine.ready) return { status: "failed", phase: machine.phase, error: machine.error };
	return { status: "ready", activeDir: resolution.activeDir };
}

/**
 * 原子安装到托管根：幂等（已完整进位则只补指针）、可重跑（残留先清）、可取消（下载层）。
 * 「安装」与「重置并重新安装」共用它 —— 重置就是「清干净 + 走这条路」。
 *
 * 覆盖口是唯一例外（目录不是我们的，就地装）；**旧路径不走例外**：装进托管根才是
 * 「显式迁入」这个动作的语义（旧目录仍不删，见 resetRuntime 的注释）。
 */
export async function installRuntime(
	descriptor: RuntimeDescriptor,
	spawn: SpawnFn,
	context: InstallContext = {},
): Promise<RuntimeEnsureOutcome> {
	const { root } = descriptor.options;
	const resolution = descriptor.resolve();
	if (resolution.source === "override") return installAtOverride(descriptor, resolution, spawn, context);
	const target = instanceDir(root, descriptor.id, descriptor.version);
	if (isCompleteInstance(target)) {
		// 幂等：这一版已完整进位过 —— 只补指针，**不重新下载**（要重装走「重置」）。
		writeCurrent(root, descriptor.id, descriptor.version);
		context.onProgress?.({ message: `${descriptor.label} ${descriptor.version} 已安装，无需重新下载。` });
		return { status: "ready", activeDir: descriptor.envDirOf(target) };
	}
	clearLeftovers(descriptor);
	const staging = stagingDir(root, descriptor.id, descriptor.version, stagingNonce());
	mkdirSync(staging, { recursive: true });
	const envDir = descriptor.envDirOf(staging);

	let acquired: AcquiredArtifact | undefined;
	try {
		acquired = await descriptor.acquire?.(envDir, {
			spawn,
			...(context.signal === undefined ? {} : { signal: context.signal }),
			...(context.onProgress === undefined ? {} : { onProgress: context.onProgress }),
			...(context.opener === undefined ? {} : { opener: context.opener }),
		});
	} catch (error) {
		// 取件失败（校验不过 / 离线 / 取消）：暂存目录整份丢掉 —— 校验不过的产物**不许**进位。
		removeDir(staging);
		const message = error instanceof Error ? error.message : String(error);
		/*
		 * 取消 ≠ 失败（download.test.ts 把这条当设计原则钉着）。两种取消形态都要认：
		 *   - `DownloadCancelledError`：下载中途取消（download.ts 抛的）；
		 *   - `AbortError`：进下载**之前**就已被取消 —— 调用方（runtime-inventory 的
		 *     guardSpawn）抛的就是它，name 是它唯一的标记，所以这里按 name 认。
		 * 认出来之后落盘写 `cancelled`：写 `failed` 会让「用户取消过」在下次采集清单时
		 * 变成「安装失败」，模型据此催用户重试他自己的决定（2026-09-18 修）。
		 */
		const cancelled =
			error instanceof DownloadCancelledError ||
			(error instanceof Error && error.name === "AbortError");
		const phase = cancelled ? CANCELLED_PHASE : ACQUIRE_PHASE;
		appendRuntimeEvent(descriptor, {
			kind: "runtime_install",
			outcome: cancelled ? "cancelled" : "failed",
			phase,
			error: message,
		});
		return { status: "failed", phase, error: message };
	}
	/*
	 * 非致命的实情（如「官方校验文件没取到」）记 warning **而不是 failed**：
	 * 诊断的「最近一次失败」只认 failed —— 把一条提醒记成失败，会让一次成功的安装
	 * 在界面上显示成「安装失败」。同时把它推给用户（不静默吞掉）。
	 */
	for (const warning of acquired?.warnings ?? []) {
		appendRuntimeEvent(descriptor, { kind: "runtime_install", outcome: "warning", phase: "shasums-metadata", error: warning });
		context.onProgress?.({ message: warning });
	}

	context.onProgress?.({ message: `正在安装 ${descriptor.label} ${descriptor.version}…` });
	const staged = await driveRuntimeMachine(descriptor.createRunner(envDir), spawn);
	if (!staged.ready) {
		removeDir(staging);
		appendRuntimeEvent(descriptor, { kind: "runtime_install", outcome: "failed", phase: staged.phase, error: staged.error });
		return { status: "failed", phase: staged.phase, error: staged.error };
	}
	try {
		context.onProgress?.({ message: "正在进位并复验…" });
		const promoted = promoteStaging(root, descriptor.id, descriptor.version, staging);
		/*
		 * 进位后**只读复验**：解包目录里可能带绝对路径，「在暂存路径上校验通过」
		 * 不等于「在最终路径上可用」。不过这一验，就会出现「current 已写、一跑就崩」
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
		writeManifest(promoted, manifestFor(descriptor, acquired));
		// 最后一步：写 current。此行之前断电，盘上都不会出现「看起来就绪」的状态。
		writeCurrent(root, descriptor.id, descriptor.version);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const failure = { phase: "publish", error: `发布托管实例失败：${message}` };
		appendRuntimeEvent(descriptor, { kind: "runtime_install", outcome: "failed", ...failure });
		return { status: "failed", ...failure };
	}
	appendRuntimeEvent(descriptor, { kind: "runtime_install", outcome: "installed", version: descriptor.version });
	context.onProgress?.({ message: `${descriptor.label} 安装完成。` });
	return { status: "ready", activeDir: descriptor.envDirOf(target) };
}

/**
 * 幂等确保运行时可用（**转换前调用的入口**）。2026-09-18 起它**只探不装**：
 *
 * ── 为什么不在这里装上（这是本函数最要紧的一条）──
 *   用户的决定是「默认都不下载、不安装；用户自己点安装才联网」。而本条路径挂在
 *   「每次转换前 / 每次会话开始」这种自动路径上 —— 一旦它能装，就会变成静默自动下载：
 *   安装包大了 484 MB 的问题解决了，却在用户不知情时下几百 MB，比随包更糟
 *   （流量、失败、半成品都发生在用户没点任何按钮的时候）。
 *   所以未安装时**如实返回 not-installed**，并给出唯一该走的那一步（去设置页点安装）。
 *
 * 保留的「零成本自愈」：已完整进位、只差 current 指针 ⇒ 补写指针（纯文件操作，
 * 不 spawn、不下载）。崩在最后一步的安装因此仍然零成本续跑，用户不必手删目录。
 * 已装但当前不可用（探针不过）⇒ not-ready + 「点重置」。**不就地修复**：修复要重建环境，
 * 那就是一次安装（要联网），必须由用户点。
 */
export async function ensureRuntime(
	descriptor: RuntimeDescriptor,
	spawn: SpawnFn,
): Promise<RuntimeEnsureOutcome> {
	const resolution = descriptor.resolve();
	if (resolution.source === "pending") {
		if (isCompleteInstance(resolution.instanceDir)) {
			publishCurrent(descriptor.options.root, descriptor.id, resolution.version);
			return { status: "ready", activeDir: resolution.activeDir };
		}
		// 注意：这里**不写** runtime_ensure 失败事件 —— 清单的 `failed`（安装失败）
		// 与 `missing`（未安装）是两句不同的话，把「没装过」记成失败会让界面误导用户。
		return { status: "failed", phase: NOT_INSTALLED_PHASE, error: notInstalledMessage(descriptor) };
	}
	const inspected = await descriptor.inspect(resolution.activeDir, spawn);
	if (inspected.kind === "ready") return { status: "ready", activeDir: resolution.activeDir };
	const detail =
		inspected.kind === "deps-missing"
			? `缺 ${inspected.module}`
			: inspected.kind === "wrong-version"
				? `版本不符（当前 ${inspected.version}，需要 ${descriptor.version}）`
				: "可执行环境不存在";
	const error = notReadyMessage(descriptor, resolution, detail);
	appendRuntimeEvent(descriptor, {
		kind: "runtime_ensure",
		outcome: "failed",
		phase: NOT_READY_PHASE,
		error,
		source: resolution.source,
	});
	return { status: "failed", phase: NOT_READY_PHASE, error };
}

/**
 * 重置并重新安装（设置页「重置并重新安装」按钮）：清掉托管根下的这一版
 * （完整品与半成品一起清）→ 走原子安装链路（下载 → 校验 → 进位 → 复验 → 发布）。
 * 仅凭这一个动作就能修好环境（spec Scenario: 环境损坏），无需用户手删目录。
 *
 * 覆盖口例外：目录的所有权不在我们（运维预置的 venv），只就地重建，不删。
 * 旧路径（~/.venv-html-to-docx）不在这里删 —— 不静默丢用户的目录；装好托管实例后
 * current 生效，旧目录被忽略，诊断会如实说「它还在、现在没在用」。
 */
export async function resetRuntime(
	descriptor: RuntimeDescriptor,
	spawn: SpawnFn,
	context: InstallContext = {},
): Promise<RuntimeEnsureOutcome> {
	const resolution = descriptor.resolve();
	appendRuntimeEvent(descriptor, { kind: "runtime_reset", outcome: "started", source: resolution.source });
	if (resolution.source === "override") return installAtOverride(descriptor, resolution, spawn, context);
	clearLeftovers(descriptor);
	removeDir(instanceDir(descriptor.options.root, descriptor.id, descriptor.version));
	return installRuntime(descriptor, spawn, context);
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
