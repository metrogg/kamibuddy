/**
 * 托管运行时的**环境注入层**（spec: add-managed-runtimes 阶段 2 的 SubTask 2.1.3）。
 *
 * 本文件只做一件事：把「哪些运行时生效 + 各自落在哪」翻译成**一组环境变量**。
 * 它是纯函数（不 spawn、不碰 fs、不读配置），于是「禁用 ⇒ 不注入」这条语义
 * 可以被逐条断言；读开关与采集落点分别由 `core/runtime-inventory.ts`
 * （`isRuntimeEnabled` / `collectRuntimeInventory`）与各运行时的 `resolve()` 负责 ——
 * 那两处是唯一读点，本层不另立第三份判据（否则会出现「界面说禁用、注入层还在注入」）。
 *
 * ── 注入判据（三条，按序短路）──
 *   1. **总开关关闭** ⇒ 三个运行时全都不注入。这一条在**这里**兜住，不依赖调用方
 *      记得先把逐项都关掉（总开关是产品语义，不是调用方的算法）；
 *   2. **该运行时被用户关掉** ⇒ 不注入，并留一条 `disabled` 决定（文案与模型侧
 *      「已被用户禁用」同一句口径）——「禁用」必须与「找不到」可区分；
 *   3. **尚无可用实例**（`resolve().source === "pending"`）⇒ 不注入，留一条 `not-ready`
 *      （带上 resolve 给的落点说明，不另写说法）。就绪与否则不看深度四态：那是
 *      「诊断」按需 spawn 的活（理由见 core/runtime-inventory.ts 的两档状态）。
 *
 * ── 落点：模型驱动的 shell 子进程的环境，不是 daemon 自己的 process.env ──
 * 注入的目的是「模型能看到有哪些运行时、能直接用」。若回写 daemon 的 process.env，
 * 会连带改掉我们自己的受控转换链路（docx 引擎、工具层 spawn）的环境 —— 那是一次
 * 无意的副作用，不是本层要的语义。所以本层只**算出**那份 env 补丁，由调用方在
 * 「模型 shell 的环境」这一点上应用。
 * 还有一条更具体的理由：pi 的 `getShellConfig()` 读的是**daemon 自己的** `process.env`
 * 与 `where bash`，若把补丁回写到 daemon 环境，它就会在 PATH 上解析到随包 bash ——
 * 等于替「是否把 bash 开放成模型的自由 shell 工具」那个另行决策**顺手开了前置**。
 * 只作用于子进程环境则不会：工具面仍由模式白名单决定。
 *
 * **生产接线**（SubTask 2.1.3）：判据由 `core/runtime-inventory.ts` 的
 * `planRuntimeShellInjection` 组装（那里已有开关与落点的唯一读点），daemon 的主会话
 * 与子代理各把它交给 `createSandboxedRunner` 的 `runtimeEnv`；执行器在 spawn 那一刻
 * 应用 —— 沙箱路径走 `SandboxRunRequest.env`、降级直连走 `runCommand` 的 env 参数。
 * 没有这一环，「启用 ⇒ 模型 shell 里找得到 node/git」就只是本文件的一厢情愿。
 *
 * ── 刻意不设 `SHELL` ──
 * `SHELL` 是 pi 解析 bash 的入口之一（`utils/shell.ts` 的 `getShellConfig`），
 * 设它等于替「是否把 bash 开放成模型的自由 shell 工具」那个**另行决策**先做了决定。
 * 本层只把运行时的可执行文件变成「路径上找得到」，工具面（模式白名单）不在本层管辖。
 *
 * ── 模型体验契约（scripts/check-model-experience.ts 的三段；改行为必须同步改这里）──
 * What the model sees: 模型驱动的 shell 子进程环境里多出注入的 PATH 前缀与
 * `KAMIBUDDY_RUNTIMES_DIR` / `KAMIBUDDY_NODE_HOME` / `KAMIBUDDY_GITBASH_HOME`
 * （就绪且启用才出现）；被禁用的运行时不出现任何变量与路径，模型侧另经
 * hidden context 的运行时清单被告知「已被用户禁用」。
 * Token effect: 无 —— 环境变量不进请求正文（清单正文的 token 账在 shared/runtimes.ts）。
 * KV Cache effect: 无 —— 不改写任何消息；工具结果里环境变量的取值会随开关变化，
 * 但那属于工具结果自身的内容（与本层无关，前缀不受影响）。
 *
 * 依赖方向：core → core（AGENTS.md §1）；registry 只以 `import type` 出现，运行时擦除，
 * 因此不存在 registry ↔ injection 的运行时循环。
 */

import { delimiter, join } from "node:path";
import type { RuntimeId, RuntimeResolution } from "./registry.ts";

/** 托管根的环境变量名（诊断、模型脚本、运维排障都读它）。 */
export const MANAGED_ROOT_ENV = "KAMIBUDDY_RUNTIMES_DIR";

export interface RuntimeEnvLayout {
	/** 前置于 PATH 的目录（按注入顺序给出，相对生效落点）。 */
	pathDirs(activeDir: string): readonly string[];
	/** 该运行时专属的路径环境变量（名字是 KamiBuddy 命名空间，不占用上游的习惯名）。 */
	vars(activeDir: string): Readonly<Record<string, string>>;
}

/**
 * 每个运行时的环境布局 —— 这是**唯一一份**「哪个目录进 PATH」的声明：
 * 安装期的探针也从这里取（gitbash 的探针必须自带同一份注入，理由见
 * payload-probe.ts 文件头），于是「探针验的」与「实际注入的」不可能分叉。
 *
 * `Record<RuntimeId, ...>` 是全覆盖的：加一个运行时**必须**在这里表态（哪怕表态
 * 是「不注入」，像 python 那样），不允许因为漏登记而静默地什么都不注入。
 */
export const RUNTIME_ENV_LAYOUT: Readonly<Record<RuntimeId, RuntimeEnvLayout>> = {
	/**
	 * python 不做环境注入：解释器路径经 hidden context 的 `python_env` 段交给模型
	 * （spec 阶段 5，`resources/prompts/fragments/python-env.md`），往 PATH 里塞
	 * venv 的 Scripts 目录会与那条既有链路口径重叠（同一件事两个说法）。
	 */
	python: { pathDirs: () => [], vars: () => ({}) },
	/**
	 * node：载荷根直接进 PATH（`node.exe` / `npm.cmd` 就在根上）。
	 * 注意 Node 的补丁版本由我们钉死（描述符的 version），所以注入的是**随包那一份**，
	 * 不是机器上可能存在的同名 node —— 与 spec 阶段 0 否决「复用系统已装」同因。
	 */
	node: {
		pathDirs: (activeDir) => [activeDir],
		vars: (activeDir) => ({ KAMIBUDDY_NODE_HOME: activeDir }),
	},
	/**
	 * gitbash：三目录顺序与 Git for Windows 的 `git-bash.exe` 同序（实测：这样 bash 里
	 * `git --version`、coreutils、`uname` 都能用）。`mingw64/bin` 必须在前 —— 排在后面
	 * 会让机器上已有的 git 先被找到（实测过：不注入时读到的是别的 git 版本）。
	 */
	gitbash: {
		pathDirs: (activeDir) => [
			join(activeDir, "mingw64", "bin"),
			join(activeDir, "usr", "bin"),
			join(activeDir, "cmd"),
		],
		vars: (activeDir) => ({ KAMIBUDDY_GITBASH_HOME: activeDir }),
	},
};

/** 取 PATH 键名：Windows 的 `Path` / `PATH` 大小写不敏感，回写必须用**原有的那个键名**。 */
export function pathKeyOf(env: Readonly<Record<string, string | undefined>>): string {
	return Object.keys(env).find((key) => key.toUpperCase() === "PATH") ?? "Path";
}

/**
 * 把若干目录前置到 baseEnv 的 PATH 上，返回新的 PATH 值。
 *
 * 安装期探针与运行期注入共用这一份拼法：探针若自带另一份 PATH，就会出现
 * 「探针验过、注入后却不是同一回事」的分叉（gitbash 的探针正是靠它才验到**我们装的那份** git，
 * 见 payload-probe.ts 文件头）。
 */
export function prependPath(
	env: Readonly<Record<string, string | undefined>>,
	dirs: readonly string[],
): string {
	const base = env[pathKeyOf(env)] ?? "";
	return [...dirs, base].filter((part) => part !== "").join(delimiter);
}

export interface RuntimeInjectionInput {
	readonly id: RuntimeId;
	/** 逐项开关的生效值（**唯一读点**：`core/runtime-inventory.ts` 的 `isRuntimeEnabled`）。 */
	readonly enabled: boolean;
	/** 本次落点结论（各运行时 `resolve()` 的产出；唯一真源，不另判路径）。 */
	readonly resolution: RuntimeResolution;
}

export type RuntimeInjectionDecision =
	| {
			readonly id: RuntimeId;
			readonly kind: "injected";
			readonly reason: string;
			readonly pathDirs: readonly string[];
			readonly vars: Readonly<Record<string, string>>;
	  }
	| { readonly id: RuntimeId; readonly kind: "disabled"; readonly reason: string }
	| { readonly id: RuntimeId; readonly kind: "not-ready"; readonly reason: string };

export interface RuntimeInjectionPlan {
	/** 要合并进「模型 shell 环境」的补丁（无注入项时为空对象）。 */
	readonly env: Readonly<Record<string, string>>;
	/** 前置于 PATH 的目录（顺序 = 入参顺序）；诊断与测试直接读这一格。 */
	readonly pathEntries: readonly string[];
	/** 逐运行时的判定与理由 —— 「没注入」必须能被指名，不许只剩一个空 env。 */
	readonly decisions: readonly RuntimeInjectionDecision[];
}

export interface RuntimeInjectionOptions {
	/** 总开关（唯一读点：`core/runtime-inventory.ts` 的 `readRuntimeSwitch()`）。 */
	readonly master: boolean;
	/** 托管根（`<configDir>/runtimes`），注入成 `KAMIBUDDY_RUNTIMES_DIR`。 */
	readonly root: string;
	/** 基线环境（生产是 process.env；注入目录**前置**在它现有 PATH 之前）。 */
	readonly env: Readonly<Record<string, string | undefined>>;
}

/**
 * 算出注入计划。**纯函数**：同样的输入必得同样的输出（可在测试里逐条断言禁用语义）。
 * 顺序即语义：路径按入参顺序前置（注册表顺序稳定 ⇒ 同一台机器上结果可复现）。
 */
export function planRuntimeInjection(
	inputs: readonly RuntimeInjectionInput[],
	options: RuntimeInjectionOptions,
): RuntimeInjectionPlan {
	const decisions: RuntimeInjectionDecision[] = [];
	const pathEntries: string[] = [];
	const vars: Record<string, string> = {};

	for (const input of inputs) {
		if (!options.master) {
			decisions.push({ id: input.id, kind: "disabled", reason: "总开关关闭：任何运行时都不注入" });
			continue;
		}
		if (!input.enabled) {
			decisions.push({
				id: input.id,
				kind: "disabled",
				reason: "已被用户在设置里禁用（显式已禁用标记）：路径与环境变量都不注入",
			});
			continue;
		}
		if (input.resolution.source === "pending") {
			decisions.push({
				id: input.id,
				kind: "not-ready",
				reason: `尚无可用实例，本次不注入：${input.resolution.detail}`,
			});
			continue;
		}
		const layout = RUNTIME_ENV_LAYOUT[input.id];
		const dirs = layout.pathDirs(input.resolution.activeDir);
		const own = layout.vars(input.resolution.activeDir);
		pathEntries.push(...dirs);
		Object.assign(vars, own);
		decisions.push({
			id: input.id,
			kind: "injected",
			reason: `已注入（落点来源 ${input.resolution.source}）：${input.resolution.detail}`,
			pathDirs: dirs,
			vars: own,
		});
	}

	// 一个都没注入时不写托管根变量：单独一个「目录在哪」对环境毫无用处，只是噪音。
	if (pathEntries.length === 0) return { env: {}, pathEntries, decisions };

	const pathKey = pathKeyOf(options.env);
	const env: Record<string, string> = {
		...vars,
		[MANAGED_ROOT_ENV]: options.root,
		[pathKey]: prependPath(options.env, pathEntries),
	};
	return { env, pathEntries, decisions };
}
