/**
 * 托管运行时的**开关状态与清单**：全仓唯一的读点（spec: add-managed-runtimes 阶段 3 / 5）。
 *
 * 为什么要有这个模块（而不是各处各判一遍）：
 *   - 设置页要显示「哪几个运行时、什么状态、版本、被谁关掉」；
 *   - 会话注入（session-host 的 `python_env` 段）要按同一份状态告诉模型能用什么、
 *     被禁用的是哪一个；
 *   - 「关闭」必须真的不注入路径，而「打开」必须立即生效（无需重启）。
 * 三件事共用 readRuntimeSwitch() / collectRuntimeInventory() 这一份判据，于是「已禁用」
 * 不可能出现「界面说禁用、模型那边说找不到」的分叉。
 *
 * ── 两档状态的深度（有意为之，理由如下）──
 *   - **清单状态（本模块的 classify）**：只看磁盘事实（`descriptor.resolve()` 的落点
 *     来源 + 落盘失败日志），**不 spawn**。它同时供设置页那一行与模型注入使用 ——
 *     模型注入在每次 run 开始组装，把几百毫秒的探测放进去不可接受；
 *   - **诊断报告（core/runtimes/diagnostics.ts）**：按需 spawn 的深度四态
 *     （含「版本不符 / 缺依赖」这类只有真跑一次才知道的结论），只在用户点「诊断」、
 *     或在设置页看报告时发生。
 * 这也解释了为什么别的地方**不得**再写一份「运行时能不能用」的判据：浅判据只有
 * classify 一处，深判据只有 diagnostics 一处，两者都在这里接线。
 *
 * 禁用 ⇒ 不注入路径（spec Scenario: 关闭某个运行时）：entryOf 在禁用时**不给**
 * activeDir / executable 两格，渲染层也就写不出路径 —— 靠形状保证，不靠渲染时记得判。
 *
 * 依赖方向：core → shared / core（AGENTS.md §1）。本模块不 import pi、不碰 documents。
 */

import type {
	RuntimeDiagnosticsText,
	RuntimeInstallProgress,
	RuntimeInventory,
	RuntimeInventoryEntry,
	RuntimeStatus,
} from "../shared/runtimes.ts";
import { readPreferences, writePreferences, type RuntimePrefs } from "./preferences.ts";
import {
	CANCELLED_PHASE,
	RUNTIME_REGISTRY,
	installRuntime,
	resetRuntime,
	type RuntimeDescriptor,
	type RuntimeOptions,
} from "./runtimes/registry.ts";
import { defaultPythonRuntimeOptions, pythonExecutable } from "./runtimes/python.ts";
import { planRuntimeInjection, type RuntimeInjectionPlan } from "./runtimes/injection.ts";
import {
	collectRuntimeDiagnostics,
	readLastRuntimeFailure,
	renderRuntimeDiagnostics,
} from "./runtimes/diagnostics.ts";
import type { SpawnFn } from "../documents/docx-env.ts";

/** 开关状态：总开关 + 逐项（缺省全开 —— 用户显式关掉某项才留 `false` 标记）。 */
export interface RuntimeSwitchState {
	readonly master: boolean;
	/** 逐项开关的**显式标记**：`false` = 用户关掉了它（缺键 = 从没关过）。 */
	readonly items: Readonly<Record<string, boolean>>;
}

/** 开关状态的唯一读点。 */
export function readRuntimeSwitch(): RuntimeSwitchState {
	const prefs = readPreferences().runtimes;
	return { master: prefs?.enabled ?? true, items: prefs?.items ?? {} };
}

/** 某个运行时**当前是否生效**（总开关 × 逐项）。注入层与模型侧都问这一句。 */
export function isRuntimeEnabled(id: string): boolean {
	const state = readRuntimeSwitch();
	return state.master && state.items[id] !== false;
}

/**
 * 写开关（总开关）。**显式写布尔值**（关闭写 false、打开写 true）：
 * 「用户开启过」与「从没设置过」在文件里必须能区分 —— 前者是用户的显式决定，
 * 后者是内置缺省，将来改缺省值不该悄悄推翻用户的选择。
 */
export function writeRuntimeMaster(enabled: boolean): void {
	writeRuntimeSwitch({ ...readPreferences().runtimes, enabled });
}

/** 写逐项开关（同上：false 就是「已禁用」标记的持久化落点）。 */
export function writeRuntimeEnabled(id: string, enabled: boolean): void {
	const current = readPreferences().runtimes;
	writeRuntimeSwitch({ ...current, items: { ...current?.items, [id]: enabled } });
}

function writeRuntimeSwitch(next: RuntimePrefs): void {
	writePreferences({ ...readPreferences(), runtimes: next });
}

/**
 * 逐运行时的**产品文案**与可执行文件取值口。
 *
 * 内核描述符只给 id / label / version / source（安装与落点知识），而「用途」与
 * 「该跑哪个文件」是产品文案与运行时的私有知识：不加进 `RuntimeDescriptor`
 * 是为了不往内核塞展示层概念（也避免与并行在改内核的工作冲突）。未登记的 id
 * 照实显示「（用途未登记）」且**不给可执行文件那一行** —— 不猜文件名，
 * 猜错会让模型去跑一个不存在的路径（比不说更糟）。
 */
interface RuntimePresentation {
	readonly purpose: string;
	/** 「按需安装」要下载的量级（阶段 7）。数值全部来自 `resources/runtimes/README.md` 的实测。 */
	readonly downloadSizeHint: string;
	readonly executableLabel?: string;
	readonly executableOf?: (activeDir: string, platform: string) => string;
}

const RUNTIME_PRESENTATION: Readonly<Record<string, RuntimePresentation>> = {
	python: {
		purpose: "文档转换（docx 引擎的解释器）",
		// uv.exe（≈17 MB）+ CPython 独立发行版（≈22 MB）+ wheel 依赖（数十 MB，未实测）。
		downloadSizeHint: "下载约 40–100 MB，解压后约 100 MB",
		executableLabel: "Python 解释器",
		executableOf: (activeDir, platform) => pythonExecutable(activeDir, platform),
	},
	node: {
		purpose: "运行 JavaScript / Node 脚本与前端构建工具",
		downloadSizeHint: "下载约 34 MB，解压后约 95 MB",
	},
	gitbash: {
		purpose: "提供 bash 与常用 unix 命令行工具",
		downloadSizeHint: "下载约 56 MB，解压后约 389 MB",
	},
};

/**
 * 装配参数覆盖（测试用临时托管根 / 假家目录 / 假平台；生产调用不传）。
 * 形状就是内核的 `RuntimeOptions`，与描述符拿到的是同一份。
 */
export type RuntimeInventoryOverrides = Partial<RuntimeOptions>;

/**
 * 注册表里的全部描述符（装配参数共用既有的那一处拼法 defaultPythonRuntimeOptions：
 * `RuntimeOptions` 的 root / homeDir / platform / engineDir 四元组对三个运行时同形，
 * 各运行时再自己去解释这几格 —— 本模块不另拼一份，免得路径推导漂成两份）。
 */
function runtimeDescriptors(overrides: RuntimeInventoryOverrides): readonly RuntimeDescriptor[] {
	const options = defaultPythonRuntimeOptions(overrides);
	return Object.entries(RUNTIME_REGISTRY).map(([, create]) => create(options));
}

/** 按 id 取描述符。未知 id **响亮报错**（诊断/重置的入参来自 UI，不该静默变成空操作）。 */
export function runtimeDescriptorOf(
	id: string,
	overrides: RuntimeInventoryOverrides = {},
): RuntimeDescriptor {
	const descriptor = runtimeDescriptors(overrides).find((candidate) => candidate.id === id);
	if (descriptor === undefined) throw new Error(`未知的托管运行时 id：${id}`);
	return descriptor;
}

/**
 * 浅判据：只看磁盘事实 + 落盘日志（不 spawn）。
 *   - 关掉了 → disabled（这就是「显式已禁用标记」的读取侧）；
 *   - resolve 的落点来源不是 pending（托管实例 / 覆盖口 / 复用的旧路径）→ ready；
 *   - 尚无落点：有落盘失败记录 → failed（detail 写清相位与原因），否则 missing。
 * 阶段 7 起没有任何静默自动下载，所以 missing 对用户就是「未安装」（文案见 shared/runtimes.ts），
 * 界面据此给「安装」入口 —— 这里只判事实，不触发任何下载。
 * missing **不带 detail**：落点已经由清单的「目录」一行给出，再补一句「尚无可用实例」
 * 只是把同一件事说两遍（状态文本会因此出现两层括号）。
 */
function classify(descriptor: RuntimeDescriptor, enabled: boolean): RuntimeStatus {
	if (!enabled) return { kind: "disabled" };
	const resolution = descriptor.resolve();
	if (resolution.source !== "pending") return { kind: "ready" };
	const failure = readLastRuntimeFailure(descriptor);
	if (failure !== undefined) {
		return { kind: "failed", detail: `相位 ${failure.phase}：${failure.error}` };
	}
	return { kind: "missing" };
}

function entryOf(descriptor: RuntimeDescriptor, state: RuntimeSwitchState): RuntimeInventoryEntry {
	const presentation: RuntimePresentation | undefined = RUNTIME_PRESENTATION[descriptor.id];
	const enabled = state.items[descriptor.id] !== false;
	const base = {
		id: descriptor.id,
		label: descriptor.label,
		purpose: presentation?.purpose ?? "（用途未登记）",
		version: descriptor.version,
		enabled,
		status: classify(descriptor, state.master && enabled),
		downloadSizeHint: presentation?.downloadSizeHint ?? "体积未登记",
	};
	// 禁用 ⇒ 路径不注入（形状上就没有这两格，渲染层写不出来）。
	if (!(state.master && enabled)) return base;
	const { activeDir } = descriptor.resolve();
	return {
		...base,
		activeDir,
		...(presentation?.executableOf === undefined
			? {}
			: {
					executable: presentation.executableOf(activeDir, descriptor.options.platform),
					executableLabel: presentation.executableLabel ?? "可执行文件",
				}),
	};
}

/**
 * 采集清单（**不 spawn**，可安全地放在每次 run 的组装路径上）。
 * 设置页的状态行与模型侧的 `python_env` 段都读它 —— 同一份判据。
 */
export function collectRuntimeInventory(overrides: RuntimeInventoryOverrides = {}): RuntimeInventory {
	const state = readRuntimeSwitch();
	return {
		master: state.master,
		items: runtimeDescriptors(overrides).map((descriptor) => entryOf(descriptor, state)),
	};
}

/**
 * 注入计划的装配参数（测试用临时托管根 / 假家目录 / 假基线环境；生产只传 env 的缺省值）。
 */
export interface RuntimeShellInjectionOptions {
	/** 基线环境（生产 = `process.env`）；注入目录**前置**在它现有 PATH 之前。 */
	readonly env?: Readonly<Record<string, string | undefined>>;
	/** 与 `collectRuntimeInventory` 同一份覆盖（形状 = 内核的 `RuntimeOptions`）。 */
	readonly overrides?: RuntimeInventoryOverrides;
}

/**
 * 「启用 ⇒ 把运行时路径注入模型 shell」的**生产判据**（SubTask 2.1.3）。
 *
 * 为什么接在这里：注入层（`runtimes/injection.ts`）是纯函数，它要的两样输入 ——
 * 「开关是否生效」与「各运行时的落点」—— 正是本模块已经持有的那两处唯一读点
 * （`readRuntimeSwitch` 与描述符 `resolve()`）。在这里组装，就不可能出现
 * 「设置页说禁用、注入层还在注入」这类分叉（换任何别处装，都得把判据再写一遍）。
 *
 * 产出的是**子进程环境的补丁**，由调用方在 spawn 那一刻应用（daemon 的主会话与
 * 子代理各自交给执行器）：不回写本进程的 `process.env`、不设 `SHELL`
 * ——理由见 `runtimes/injection.ts` 文件头。
 */
export function planRuntimeShellInjection(
	options: RuntimeShellInjectionOptions = {},
): RuntimeInjectionPlan {
	const overrides = options.overrides ?? {};
	const state = readRuntimeSwitch();
	return planRuntimeInjection(
		runtimeDescriptors(overrides).map((descriptor) => ({
			id: descriptor.id,
			// 逐项开关的生效值（与 entryOf 同一处判法：只有显式 `false` 才算被禁用）。
			enabled: state.items[descriptor.id] !== false,
			resolution: descriptor.resolve(),
		})),
		{
			master: state.master,
			root: defaultPythonRuntimeOptions(overrides).root,
			env: options.env ?? process.env,
		},
	);
}

/** 诊断报告的文本 + 日志路径（设置页「诊断」按钮的内容）。按需 spawn。 */
export async function collectRuntimeDiagnosticsText(
	id: string,
	spawn: SpawnFn,
	overrides: RuntimeInventoryOverrides = {},
): Promise<RuntimeDiagnosticsText> {
	const descriptor = runtimeDescriptorOf(id, overrides);
	const report = await collectRuntimeDiagnostics(descriptor, spawn);
	return {
		id,
		label: descriptor.label,
		text: renderRuntimeDiagnostics(report),
		logPath: report.logPath,
	};
}

/**
 * 「重置并重新安装」= 内核的幂等链路（清残留 → 安装 → 校验 → 进位 → 发布）。
 * 失败**响亮抛出**（相位 + 原因）：这是用户主动点的一次修复，静默失败等于让他
 * 以为已经修好了。
 */
export async function resetManagedRuntime(
	id: string,
	spawn: SpawnFn,
	overrides: RuntimeInventoryOverrides = {},
): Promise<RuntimeInventory> {
	const descriptor = runtimeDescriptorOf(id, overrides);
	const outcome = await resetRuntime(descriptor, spawn);
	if (outcome.status === "failed") {
		throw new Error(`重置「${descriptor.label}」失败（相位 ${outcome.phase}）：${outcome.error}`);
	}
	return collectRuntimeInventory(overrides);
}

/**
 * 「按需安装」= 内核的原子安装链路（暂存 → 取件（下载+校验+解包）→ 进位 → 复验 → manifest → current）。
 *
 * 与「重置并重新安装」的分工：重置是**用户显式点的一次修复**，会先删掉既有实例
 * （`resetRuntime`）；安装只用在**尚未安装**时（落点已是 pending），走到
 * `installRuntime` 就够 —— 它本身就幂等（已完整进位则只补指针，不重新下载）。
 *
 * `signal` 是用户点「取消」的落点：**下载阶段会被真正中断**（HTTP 请求 abort，
 * 已下字节留在 `.part` 里做续传点），并抛 `AbortError`；推进到 spawn 之后（uv 装配 /
 * 7z 自解压）的相变只在下一次推进前被拦下 —— 诚实边界：`SpawnFn` 没有 kill 原语，
 * 正在跑的那条子进程不会被中途杀掉。中断留下的半成品由下次安装的 `clearLeftovers`
 * 清掉（内核已保证），`.part` 则省掉下次重下。
 *
 * `onProgress` 是进度出口（daemon 接成 `PUSH.runtimeInstallProgress`）：
 * 只报 running 档，终态（done / failed / cancelled）由调用方下结论 ——
 * 内核不该替调用方判断「这次算不算成功」。
 */
export async function installManagedRuntime(
	id: string,
	spawn: SpawnFn,
	signal?: AbortSignal,
	overrides: RuntimeInventoryOverrides = {},
	onProgress?: (progress: RuntimeInstallProgress) => void,
): Promise<RuntimeInventory> {
	const descriptor = runtimeDescriptorOf(id, overrides);
	// 已有可用落点（覆盖口 / 复用旧路径 / 已进位实例）就没有要装的东西 ——
	// 尤其不能对「覆盖口」动手（那个目录不是我们的，同 resetRuntime 的例外）。
	if (descriptor.resolve().source !== "pending") return collectRuntimeInventory(overrides);
	const guarded: SpawnFn =
		signal === undefined
			? spawn
			: async (request) => {
					if (signal.aborted) throw runtimeInstallAbort(descriptor.label);
					return spawn(request);
				};
	const outcome = await installRuntime(descriptor, guarded, {
		...(signal === undefined ? {} : { signal }),
		...(onProgress === undefined
			? {}
			: {
					onProgress: (update) =>
						onProgress({
							id,
							kind: "running",
							message: update.message,
							...(update.percent === undefined ? {} : { percent: update.percent }),
						}),
				}),
	});
	if (outcome.status === "failed") {
		/*
		 * 相位是 cancelled ⇒ 用户自己取消了这次安装，**不是失败**：抛 AbortError 让调用方
		 * 按「错在用户而不是环境」处理（不写审计）——与进下载之前就被取消的那条路同一口径。
		 * 原先这里一律抛普通 Error，于是上面那句「daemon 据此分开上报」在下载中途取消时
		 * 并不成立：调用方只看到一句「安装失败」（2026-09-18 修）。
		 */
		if (outcome.phase === CANCELLED_PHASE) throw runtimeInstallAbort(descriptor.label);
		throw new Error(`安装「${descriptor.label}」失败（相位 ${outcome.phase}）：${outcome.error}`);
	}
	return collectRuntimeInventory(overrides);
}

/** 取消信号：错在用户而不是环境，daemon 据此把它与安装失败分开上报（不写审计）。 */
function runtimeInstallAbort(label: string): Error {
	const error = new Error(`已取消「${label}」的安装`);
	error.name = "AbortError";
	return error;
}
