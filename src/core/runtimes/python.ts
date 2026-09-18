/**
 * Python 运行时（docx 引擎的解释器）：托管根下的一个实例。
 *
 * 这是「加一个运行时 = 加一份注册描述」的首个实例：本文件只放**python 私有知识**
 * （版本固化、venv 布局、旧路径名、覆盖口环境变量、九相位的绑定），内核
 * （runtime-store / machine / registry）里没有一行 python 特化代码。
 *
 * ── 唯一真源：venv 落点怎么定（优先级从高到低） ──
 *   1. `HTML_TO_DOCX_VENV`（非空）—— 用户/运维的显式覆盖口。保留它是兼容既有用户的
 *      显式指定（私有化预置 venv），所以它压过托管根；托管侧的 install/进位/回滚
 *      都不碰它（目录所有权不在我们）。
 *   2. 托管根 `current` 指向的实例（`<configDir>/runtimes/python/<version>/venv`）。
 *      **两条路径并存时唯一真源就是它** —— 旧路径只要不再被 current 指向就被忽略，
 *      不再有「谁生效」的第二套判据（测试见 python.test.ts）。
 *   3. 既有 `~/.venv-html-to-docx` —— 迁移期**复用**（就地 ensure/修复，与迁入前的
 *      行为逐字相同），**不静默丢弃**：诊断会明确说「当前复用的就是它、它不在托管根下」，
 *      并给出「点重置即可迁入托管根」的下一步。
 *   4. 都没有 —— 由本次安装占位（走托管根的原子安装链路）。
 *
 * 为什么复用而不是自动搬目录：搬一个 venv 要跨目录改名（可能跨卷），失败就是
 * 「用户本来能用、被我们搬坏了」。复用 + 明确告知 + 一键迁入（重置）风险小得多，
 * 且 spec 对旧路径的措辞是「复用**或**显式迁移」—— 我们选了前者，后者由用户点重置触发。
 */

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getResourcesDir } from "../config-paths.ts";
import { instanceDir, isCompleteInstance, readCurrent, runtimesRoot } from "../runtime-store.ts";
import {
	createEnvContext,
	initialEnvState,
	inspectVenv,
	nextStep,
	reduce,
	venvPythonPath,
	type EnsureResult,
	type EnvContext,
	type EnvState,
	type SpawnFn,
} from "../../documents/docx-env.ts";
import { bindRuntimeMachine, type RuntimeMachine } from "./machine.ts";
import { collectRuntimeDiagnostics } from "./diagnostics.ts";
import {
	ensureRuntime,
	inspectRuntime,
	resetRuntime,
	rollbackRuntime,
	type RuntimeDescriptor,
	type RuntimeOptions,
	type RuntimeResolution,
} from "./registry.ts";

export const PYTHON_RUNTIME_ID = "python";
/** 固化 3.12：新 Python 上 lxml 无 wheel，源码编译会失败（WB 脚本踩坑记录）。 */
export const PYTHON_RUNTIME_VERSION = "3.12";
/** 托管实例里的 venv 子目录名（实例目录 = `<root>/<id>/<version>`）。 */
export const PYTHON_VENV_DIRNAME = "venv";
/** 退役的平级隐式路径（迁移期的复用来源）。 */
export const LEGACY_DOCX_VENV_DIRNAME = ".venv-html-to-docx";
/** 覆盖口环境变量（WB 脚本同款，私有化预置环境用）。 */
export const VENV_OVERRIDE_ENV = "HTML_TO_DOCX_VENV";

/** 供调用方标注装配参数的类型（daemon 与工具层只 import 本文件，不必认识 registry）。 */
export type { RuntimeOptions };

export interface PythonRuntimeOptionOverrides {
	readonly root?: string;
	readonly homeDir?: string;
	readonly platform?: string;
	readonly engineDir?: string;
	readonly env?: Readonly<Record<string, string | undefined>>;
}

/**
 * 生产装配：托管根 / 家目录 / 平台 / 引擎目录四元组只在这里拼一次
 * （daemon、工具层与冒烟脚本共用，谁都不自己拼一份 —— AGENTS.md §4 防重复）。
 */
export function defaultPythonRuntimeOptions(overrides: PythonRuntimeOptionOverrides = {}): RuntimeOptions {
	return {
		root: overrides.root ?? runtimesRoot(),
		homeDir: overrides.homeDir ?? homedir(),
		platform: overrides.platform ?? process.platform,
		engineDir: overrides.engineDir ?? join(getResourcesDir(), "docx-engine"),
		...(overrides.env === undefined ? {} : { env: overrides.env }),
	};
}

/**
 * venv 落点判据（优先级见文件头）。**纯函数 + 只读 fs**：不探测、不安装、不改磁盘。
 */
export function resolvePythonVenv(options: RuntimeOptions): RuntimeResolution {
	const env = options.env ?? process.env;
	const override = env[VENV_OVERRIDE_ENV];
	const instance = instanceDir(options.root, PYTHON_RUNTIME_ID, PYTHON_RUNTIME_VERSION);
	/** 被忽略的坏指针说明（拼进后续分支的 detail，诊断因此能说清「为什么没用它」）。 */
	let brokenCurrent = "";
	if (override !== undefined && override !== "") {
		return {
			instanceDir: instance,
			version: PYTHON_RUNTIME_VERSION,
			activeDir: override,
			source: "override",
			detail: `由环境变量 ${VENV_OVERRIDE_ENV} 显式指定（优先级最高，托管根被跳过）`,
			managed: false,
		};
	}
	const current = readCurrent(options.root, PYTHON_RUNTIME_ID);
	if (current !== undefined) {
		const dir = instanceDir(options.root, PYTHON_RUNTIME_ID, current);
		if (isCompleteInstance(dir)) {
			return {
				instanceDir: dir,
				version: current,
				activeDir: join(dir, PYTHON_VENV_DIRNAME),
				source: "managed",
				detail: `托管根 current 指向 ${current}（已进位、manifest 齐）`,
				managed: true,
			};
		}
		/*
		 * current 指向的实例不完整（用户手删/手改，或断电正好卡在极窄的窗口）：
		 * **忽略这个指针**往下走，而不是就地修到那个版本名下 —— 否则一次手改会
		 * 造出一个版本名是垃圾的新实例。诊断仍会如实报出「current 指向谁、为什么被忽略」。
		 */
		brokenCurrent = `托管根 current 指向 ${current}，但该实例没有 manifest（未进位完成或已损坏）—— 该指针已被忽略`;
	}
	const legacy = join(options.homeDir, LEGACY_DOCX_VENV_DIRNAME);
	if (existsSync(legacy)) {
		return {
			instanceDir: instance,
			version: PYTHON_RUNTIME_VERSION,
			activeDir: legacy,
			source: "legacy",
			detail:
				`复用托管根之外的既有目录 ${legacy}（未迁入托管根；点「重置并重新安装」可迁入，旧目录不会被删除）` +
				brokenCurrent,
			managed: false,
		};
	}
	return {
		instanceDir: instance,
		version: PYTHON_RUNTIME_VERSION,
		activeDir: join(instance, PYTHON_VENV_DIRNAME),
		source: "pending",
		detail: `尚无可用托管实例，将由本次安装落位到 ${instance}${brokenCurrent}`,
		managed: true,
	};
}

/**
 * 九相位状态机 → 通用机型的绑定。
 * 纯函数原样转交（逐相位语义一字不改），只补三个终态判定 —— 驱动器的结论因此与
 * 旧 ensureDocxEnv 的循环逐字一致（含失败归因 failedAt / error 的取值）。
 */
const PYTHON_MACHINE: RuntimeMachine<EnvState, EnvContext> = {
	label: "docx 引擎 Python 环境",
	// 上界与旧 ensure 的 for(step < 40) 相同：防 reduce 改出循环 bug 把 daemon 挂死。
	maxSteps: 40,
	initial: initialEnvState,
	nextStep,
	reduce,
	phaseOf: (state) => state.phase,
	ready: (state) => state.phase === "ready",
	failure: (state) =>
		state.phase === "failed"
			? { phase: state.failedAt ?? "failed", error: state.error ?? "未知失败" }
			: undefined,
};

export function createPythonRuntime(options: RuntimeOptions): RuntimeDescriptor {
	const envContext = (venvDir: string): EnvContext =>
		createEnvContext(options.engineDir, options.homeDir, options.platform, venvDir);
	return {
		id: PYTHON_RUNTIME_ID,
		label: "Python（docx 引擎）",
		version: PYTHON_RUNTIME_VERSION,
		source:
			"uv 管理的独立 CPython 3.12（astral-sh/python-build-standalone）+ 引擎依赖走 PyPI wheel（--only-binary=:all:）",
		options,
		resolve: () => resolvePythonVenv(options),
		envDirOf: (instance) => join(instance, PYTHON_VENV_DIRNAME),
		createRunner: (venvDir) => bindRuntimeMachine(PYTHON_MACHINE, envContext(venvDir)),
		inspect: (venvDir, spawn) => inspectVenv(envContext(venvDir), spawn),
	};
}

/** venv 里的解释器绝对路径（模型侧 python_env 段与转换调用共用这一个取值）。 */
export function pythonExecutable(venvDir: string, platform: string): string {
	return venvPythonPath(venvDir, platform);
}

/**
 * 幂等 ensure（转换前调用 / 启动预热调用）。产出与迁入前逐字同形（EnsureResult）：
 * 工具层的错误分类（classifyEnsureError）与 daemon 的事件日志都不用改。
 */
export async function ensurePythonRuntime(options: RuntimeOptions, spawn: SpawnFn): Promise<EnsureResult> {
	const outcome = await ensureRuntime(createPythonRuntime(options), spawn);
	if (outcome.status === "failed") return { status: "failed", phase: outcome.phase, error: outcome.error };
	return {
		status: "ready",
		python: pythonExecutable(outcome.activeDir, options.platform),
		venvDir: outcome.activeDir,
	};
}

/**
 * 重置并重新安装（「诊断」旁边的那个按钮）。
 * = 清掉托管根下的这一版 → 走「安装（uv/网络）→ 校验（九相位冒烟）→ 进位 → 发布 current」。
 * 「重载工具」这一步不需要额外动作：docx_convert / docx_extract 每次转换前都幂等 ensure，
 * 本函数返回即代表下一次转换会用上新环境（见 tools 的文件头）。
 */
export async function resetPythonRuntime(options: RuntimeOptions, spawn: SpawnFn): Promise<EnsureResult> {
	const outcome = await resetRuntime(createPythonRuntime(options), spawn);
	if (outcome.status === "failed") return { status: "failed", phase: outcome.phase, error: outcome.error };
	return {
		status: "ready",
		python: pythonExecutable(outcome.activeDir, options.platform),
		venvDir: outcome.activeDir,
	};
}

/** 回滚到某一版（只切 current 指针，不重新下载）。版本未完整进位会响亮报错。 */
export function rollbackPythonRuntime(options: RuntimeOptions, version: string): EnsureResult {
	const descriptor = createPythonRuntime(options);
	const outcome = rollbackRuntime(descriptor, version);
	return {
		status: "ready",
		python: pythonExecutable(outcome.activeDir, options.platform),
		venvDir: outcome.activeDir,
	};
}

/** 四态只读探测（诊断页状态行；与 ensure 不同，绝不安装）。 */
export function inspectPythonRuntime(options: RuntimeOptions, spawn: SpawnFn) {
	return inspectRuntime(createPythonRuntime(options), spawn);
}

/** 可复制诊断报告 + 落盘日志的采集入口（面板「诊断」按钮的内容）。 */
export function pythonRuntimeDiagnostics(options: RuntimeOptions, spawn: SpawnFn) {
	return collectRuntimeDiagnostics(createPythonRuntime(options), spawn);
}
