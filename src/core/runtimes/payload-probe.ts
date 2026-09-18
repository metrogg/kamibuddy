/**
 * 下载型运行时的**探测层**（node / gitbash 共用）：必备文件 + 探针 + 四态。
 *
 * 与旧 `bundled-payload.ts` 的分工变化（2026-09-18 设计变更）：
 *   - 旧的「复制随包载荷」整个删掉 —— 载荷不再随包，取件改成按需下载
 *     （`artifact.ts` + `download.ts`），**先探针省一次复制**那套优化随之失效
 *     （不再有可省的大动作：安装只在用户点「安装」时发生一次）；
 *   - 本文件只剩「怎么判断这一份到底能不能用」：必备文件（含许可文本）+ 探针。
 *     安装链路 = registry 建暂存目录 → `acquireArtifact`（下载/校验/解包）→
 *     这里的探针（暂存路径）→ registry 改名进位 → **进位后只读复验**（本文件的
 *     `inspectPayload`）→ manifest → 最后 current。
 *
 * ── 探针为什么必须自带 PATH 注入（实测教训，gitbash 侧）──
 * 不注入 PATH 时 `bash -c "git --version"` 读到的是**机器上另一个 git**（本机实测
 * 2.53.0.windows.2，而发行物里是 2.55.0.windows.5）—— 不做注入的探针验的是机器环境，
 * 不是我们装的那一份。所以探针用与注入层**同一份** PATH 布局（injection.ts），
 * 顺带把「注入真的能让 bash 里跑起 git」变成安装期就验过的事实。
 *
 * 依赖方向：core → core / documents（AGENTS.md §1），不碰 pi、不碰 electron。
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { getResourcesDir } from "../config-paths.ts";
import type { SpawnOutcome, SpawnRequest } from "../../documents/docx-env.ts";
import { bindRuntimeMachine, type RuntimeFailure, type RuntimeRunner } from "./machine.ts";
import type { RuntimeInspectResult, RuntimeOptions } from "./registry.ts";

/** 相位名（归因与诊断共用一份字面量，不许在别处另写字面量）。 */
export const PROBE_PHASE = "probe-executable";
export const REQUIRED_FILES_PHASE = "payload-incomplete";

/** resources 根的覆盖口（与 `getResourcesDir()` 的同名覆盖口同意同义，测试与私有化预置用）。 */
export const RESOURCES_DIR_ENV = "KAMIBUDDY_RESOURCES_DIR";

/**
 * resources 根：uv.exe 与 docx 引擎仍从这里取（随包的那两份没变），
 * 而 node / gitbash 的许可义务载体（gitbash 的 CORRESPONDING-SOURCE.md）也在这一层。
 */
export function runtimeResourcesDir(options: RuntimeOptions): string {
	return options.env?.[RESOURCES_DIR_ENV] ?? getResourcesDir();
}

export interface PayloadProbeSpec {
	/** 显示名（错误文案与诊断用）。 */
	readonly label: string;
	readonly version: string;
	/** 实例根的必备文件（相对路径）。缺任一即「不完整」：**许可文本也在这一列**里。 */
	readonly requiredFiles: readonly string[];
	/** 探针：跑什么、带什么环境。`envDir` 是本次落点（首次安装时是暂存目录）。 */
	probe(envDir: string): SpawnRequest;
	/** 从探针输出读出版本号；读不出（起不来 / 输出看不懂）即 undefined。 */
	parseVersion(outcome: SpawnOutcome): string | undefined;
}

/** 实例根里第一个缺失的必备文件（都齐则 undefined）。 */
export function firstMissingPayloadFile(dir: string, required: readonly string[]): string | undefined {
	return required.find((relative) => !existsSync(join(dir, relative)));
}

/** 探针输出的一句话摘述（失败文案要可行动，所以带上 stderr/stdout 的首行）。 */
export function describeProbeOutcome(outcome: SpawnOutcome): string {
	const detail = (outcome.stderr.trim() || outcome.stdout.trim() || outcome.error || "").split("\n")[0]?.trim() ?? "";
	const code = outcome.code === null ? "进程没起来" : `退出码 ${outcome.code}`;
	return detail === "" ? code : `${code}：${detail}`;
}

interface ProbeState {
	readonly phase: string;
	readonly failure?: RuntimeFailure;
}

/**
 * 绑一条「必备文件 + 单次探针」的推进器（安装链路里跑在**暂存目录**上）。
 * 必备文件在 `initial()` 里判（那是工厂、可以碰磁盘）：缺文件时既不 spawn 也不假装成功。
 */
export function bindPayloadProbeRunner(spec: PayloadProbeSpec, envDir: string): RuntimeRunner {
	const machine = {
		label: spec.label,
		// 只有一步（探针）——重复推进即 bug，上界给 2 让「不收敛」也能响亮报出来。
		maxSteps: 2,
		initial: (): ProbeState => {
			const missing = firstMissingPayloadFile(envDir, spec.requiredFiles);
			if (missing === undefined) return { phase: PROBE_PHASE };
			return {
				phase: REQUIRED_FILES_PHASE,
				failure: {
					phase: REQUIRED_FILES_PHASE,
					error:
						`${spec.label}的安装结果不完整（缺 ${missing}）：${envDir}。` +
						"必备文件里含许可文本，缺了不许进位；重试安装即可。",
				},
			};
		},
		nextStep: (state: ProbeState): SpawnRequest | null =>
			state.phase === PROBE_PHASE ? spec.probe(envDir) : null,
		reduce: (state: ProbeState, outcome: SpawnOutcome): ProbeState => {
			if (state.phase !== PROBE_PHASE) return state;
			const version = spec.parseVersion(outcome);
			if (version === spec.version) return { phase: "ready" };
			if (version === undefined) {
				return {
					phase: PROBE_PHASE,
					failure: { phase: PROBE_PHASE, error: `${spec.label}探针没跑通（${describeProbeOutcome(outcome)}）。` },
				};
			}
			return {
				phase: PROBE_PHASE,
				failure: {
					phase: PROBE_PHASE,
					error:
						`${spec.label}版本不符：期望 ${spec.version}，实际 ${version} —— ` +
						"发行物与描述符钉的版本对不上（多半是上游换了产物、或我们钉错了版本）。",
				},
			};
		},
		phaseOf: (state: ProbeState): string => state.phase,
		ready: (state: ProbeState): boolean => state.phase === "ready",
		failure: (state: ProbeState): RuntimeFailure | undefined => state.failure,
	};
	return bindRuntimeMachine(machine, { envDir });
}

/**
 * 四态只读探测（**绝不安装、绝不下载**）。
 *
 * 与 venv 的四态同形共用（`DocxEnvStatus`）：`deps-missing` 的取值口在这里是
 * 「缺失的必备文件」（含许可文本），`missing` 含「探针起不来」（与 inspectVenv 同语义）。
 */
export async function inspectPayload(
	spec: PayloadProbeSpec,
	envDir: string,
	spawn: (request: SpawnRequest) => Promise<SpawnOutcome>,
): Promise<RuntimeInspectResult> {
	const missing = firstMissingPayloadFile(envDir, spec.requiredFiles);
	if (missing !== undefined) return { kind: "deps-missing", module: missing };
	const outcome = await spawn(spec.probe(envDir));
	if (outcome.code === null || outcome.code !== 0) return { kind: "missing" };
	const version = spec.parseVersion(outcome);
	if (version === undefined) return { kind: "missing" };
	if (version !== spec.version) return { kind: "wrong-version", version };
	return { kind: "ready" };
}
