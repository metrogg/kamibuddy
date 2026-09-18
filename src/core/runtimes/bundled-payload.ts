/**
 * 随包载荷型运行时的安装机（`node` / `gitbash` 共用）。
 *
 * 「随包载荷」= 构建期由 `scripts/fetch-*.mjs` 拉取（并按校验和核对）后落在
 * `resources/runtimes/payload/<id>/<version>/`、随安装包分发的目录树。
 * 安装 = 把载荷复制进托管根的一个版本实例，再在**最终路径**上跑一次探针。
 *
 * ── 为什么这两个运行时是「随包复制」而不是「运行期下载」（与 python 的分歧点）──
 *   1. `gitbash` 的发行物是 `PortableGit-*.7z.exe`（7z 自解压），仓库现有 jszip 解不了 7z。
 *      要运行期解包就得往产物里塞一个 7z 解压器，而 7-Zip 是 **LGPL + unRAR 限制**，
 *      随产物分发会把限制带进我们的分发物。**构建期解包 + 随包分发解包结果**把这个
 *      问题整个绕开：7-Zip（或 SFX 自带的那个解包器）只在构建机上出现一次，不进产物。
 *      —— 这是 spec 阶段 2 点名要写清的取舍。
 *   2. `node` 跟着走同一条路，是为了三个运行时**离线可用**、首次使用不等下载
 *      （spec：随包分发 Node/Python/Git Bash）。代价是安装包与托管根各占一份体积
 *      （实测值见 resources/runtimes/README.md）。
 *   3. python 仍由 uv 运行期下载：它的通道本来就是 http（uv + PyPI wheel），
 *      改成随包等于把 wheel 也一起背进去，且既有链路**必须**联网。
 *   ⇒ 「载荷缺席」不降级、不改走联网：**响亮失败并给出构建命令**（见 fetchHint）。
 *
 * ── 安装形状（两个运行时同形，所以抽象成一份，避免两处走样）──
 *   **先探针** → 不通过才复制（复制前**懒校验**载荷）→ 复制后再探针 → 交回内核
 *   （进位 → 只读复验 → manifest → **最后**写 current，顺序见 runtime-store.ts）。
 * 为什么是「先探针」而不是「先复制」：
 *   1. 内核有三条 ensure 路径，其中「托管实例已就位」那条会**就地**推进状态机
 *      （`registry.ts` 的 ensureInPlace）。先复制的话，每次幂等 ensure 都会把
 *      389 MB 载荷再拷一遍 —— 而它挂在模型每次调用前的准备路径上，等于灾难；
 *   2. 反过来先探针，已就位的健康实例第一步就结束（零复制、零 fs 检查），
 *      而**文件被删坏的实例**会因为探针失败走一次复制 → 自动就地修复（与 venv 同语义）；
 *   3. 「载荷缺席 / 不完整」是**懒校验**：只有当探针失败、真的要复制时才去判载荷
 *      （校验与它给出的失败文案见 `validatePayload`）。这样「实例好好的、只是随包
 *      载荷被删了」不会被误报成未就绪。
 *
 * ── 复制为什么用 robocopy（绝对路径调起）──
 * gitbash 载荷实测 9584 个文件 / 389 MB，PowerShell 的递归复制在这个量级上慢一个数量级；
 * robocopy 是 Windows 自带、无第三方依赖、退出码可判。用绝对路径（`%SystemRoot%\System32`）
 * 而不是按 PATH 查找：这一步是我们自己发起的高权限操作，PATH 上的同名程序不可信
 * （同 spec 阶段 0 否决「复用系统已装同名工具」的第 4 条理由）。
 * 它的退出码是**位掩码**（0=无变化、1=复制了文件、2=目标有额外文件、3=1|2、4~7=不一致位），
 * ≥8 才是失败 —— 按「≤7 即成功」判，不做「必须等于 0」的误判。
 *
 * ── 探针为什么必须自带 PATH 注入（实测教训，gitbash 侧）──
 * 不注入 PATH 时 `bash -c "git --version"` 读到的是**机器上另一个 git**（本机实测
 * 2.53.0.windows.2，而随包载荷里是 2.55.0.windows.5）—— 不做注入的探针验的是机器环境，
 * 不是随包载荷。所以探针用与注入层**同一份** PATH 布局（injection.ts），
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
export const PAYLOAD_MISSING_PHASE = "payload-missing";
export const PAYLOAD_INCOMPLETE_PHASE = "payload-incomplete";
export const COPY_PHASE = "copy-payload";
export const PROBE_PHASE = "probe-executable";

/** 载荷根的覆盖口（与 `getResourcesDir()` 的同名覆盖口同意同义，测试与私有化预置用）。 */
export const RESOURCES_DIR_ENV = "KAMIBUDDY_RESOURCES_DIR";

/**
 * robocopy 的绝对路径。`SystemRoot` 在 Windows 上恒有；缺席时给 `C:\Windows`
 * 只是为了让这一行不必写成 `string | undefined`（Windows 装在别处且没设 SystemRoot 的机器不存在）。
 */
const ROBOCOPY = join(process.env["SystemRoot"] ?? "C:\\Windows", "System32", "Robocopy.exe");

/** robocopy 成功码上界（位掩码语义见文件头）。 */
const ROBOCOPY_OK_MAX = 7;

/** 状态机的步数上界：复制 + 探针 + 收尾，4 步足够（超出即响亮报错，见 machine.ts）。 */
const MAX_STEPS = 4;

export interface BundledPayloadSpec {
	/** 显示名（错误文案与诊断用）。 */
	readonly label: string;
	readonly version: string;
	/** 随包载荷目录（`<resources>/runtimes/payload/<id>/<version>`）。 */
	readonly payloadDir: string;
	/** 载荷缺席/不完整时写给用户的下一步（含构建命令）—— 拼进错误文本，不静默跳过。 */
	readonly fetchHint: string;
	/** 载荷根必备文件（相对路径）。缺任一即「载荷不完整」：**许可文本也在这一列**里。 */
	readonly requiredFiles: readonly string[];
	/** 探针：跑什么、带什么环境。`envDir` 是本次落点（首次安装时是暂存目录）。 */
	probe(envDir: string): SpawnRequest;
	/** 从探针输出读出版本号；读不出（起不来 / 输出看不懂）即 undefined。 */
	parseVersion(outcome: SpawnOutcome): string | undefined;
}

/** 载荷目录：`<resources>/runtimes/payload/<id>/<version>/`（`resources/runtimes/README.md` 有约定）。 */
export function runtimePayloadDir(options: RuntimeOptions, id: string, version: string): string {
	const resources = options.env?.[RESOURCES_DIR_ENV] ?? getResourcesDir();
	return join(resources, "runtimes", "payload", id, version);
}

/** 载荷根里第一个缺失的必备文件（都齐则 undefined）。 */
function firstMissingFile(dir: string, required: readonly string[]): string | undefined {
	return required.find((relative) => !existsSync(join(dir, relative)));
}

/** 探针输出的一句话摘述（失败文案要可行动，所以带上 stderr 的首行）。 */
function describeOutcome(outcome: SpawnOutcome): string {
	const detail = (outcome.stderr.trim() || outcome.stdout.trim() || outcome.error || "").split("\n")[0]?.trim() ?? "";
	const code = outcome.code === null ? "进程没起来" : `退出码 ${outcome.code}`;
	return detail === "" ? code : `${code}：${detail}`;
}

interface PayloadState {
	readonly phase: string;
	/** 已复制过一次：第二次探针再不过就没有第三次机会（防「探针失败 → 复制 → 失败 → 复制…」的死循环）。 */
	readonly copied: boolean;
	readonly failure?: RuntimeFailure;
}

interface PayloadContext {
	readonly envDir: string;
}

function failed(phase: string, error: string, copied = false): PayloadState {
	return { phase, copied, failure: { phase, error } };
}

/** 复制请求。robocopy 的参数刻意压到最少：/E 含空目录，/NFL /NDL /NJH /NJS /NP 降噪，/R:1 /W:1 不挂死。 */
export function copyPayloadRequest(from: string, to: string): SpawnRequest {
	return {
		command: ROBOCOPY,
		args: [from, to, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/NP", "/R:1", "/W:1"],
	};
}

/**
 * 复制前**懒校验**载荷：目录在不在、必备文件（含许可文本）齐不齐。
 * 返回「该转入的失败状态」，载荷可用则 undefined。
 *
 * 为什么懒校验而不是一开始就判：已就位的实例根本不需要载荷（先探针，一过就结束），
 * 此时把「随包载荷被删了」报成环境未就绪就是误报。只有真的要复制时才判它。
 */
function validatePayload(spec: BundledPayloadSpec): PayloadState | undefined {
	if (!existsSync(spec.payloadDir)) {
		return failed(PAYLOAD_MISSING_PHASE, `${spec.label}的随包载荷不存在：${spec.payloadDir}。${spec.fetchHint}`);
	}
	const missing = firstMissingFile(spec.payloadDir, spec.requiredFiles);
	if (missing !== undefined) {
		return failed(
			PAYLOAD_INCOMPLETE_PHASE,
			`${spec.label}的随包载荷不完整（缺 ${missing}）：${spec.payloadDir}。${spec.fetchHint}`,
		);
	}
	return undefined;
}

/**
 * 绑一条「探针 → （不过则）校验载荷 → 复制 → 再探针」的推进器。
 * 相位与顺序的理由见文件头；载荷的两种坏状态由 `validatePayload` 判定并给出可行动的文案。
 */
export function bindBundledPayloadRunner(spec: BundledPayloadSpec, envDir: string): RuntimeRunner {
	const machine = {
		label: spec.label,
		maxSteps: MAX_STEPS,
		initial: (): PayloadState => ({ phase: PROBE_PHASE, copied: false }),
		nextStep: (state: PayloadState, ctx: PayloadContext): SpawnRequest | null => {
			if (state.phase === PROBE_PHASE) return spec.probe(ctx.envDir);
			if (state.phase === COPY_PHASE) return copyPayloadRequest(spec.payloadDir, ctx.envDir);
			return null;
		},
		reduce: (state: PayloadState, outcome: SpawnOutcome, ctx: PayloadContext): PayloadState => {
			if (state.phase === COPY_PHASE) {
				if (outcome.code === null || outcome.code > ROBOCOPY_OK_MAX) {
					return failed(
						COPY_PHASE,
						`把随包载荷复制到 ${ctx.envDir} 失败（${describeOutcome(outcome)}）。` +
							`载荷目录：${spec.payloadDir}；目标目录可能被占用或磁盘已满。${spec.fetchHint}`,
					);
				}
				return { phase: PROBE_PHASE, copied: true };
			}
			const version = spec.parseVersion(outcome);
			if (version === spec.version) return { phase: "ready", copied: state.copied };
			// 探针不过：要么环境是空的/坏的（复制一次即可修），要么这套载荷本身就装不出可用的
			// 环境（复制过仍不过 ⇒ 响亮失败，不无限重试）。
			if (!state.copied) {
				const problem = validatePayload(spec);
				if (problem !== undefined) return problem;
				return { phase: COPY_PHASE, copied: false };
			}
			if (version === undefined) {
				return failed(PROBE_PHASE, `${spec.label}探针没跑通（${describeOutcome(outcome)}）。`, true);
			}
			return failed(
				PROBE_PHASE,
				`${spec.label}版本不符：期望 ${spec.version}，实际 ${version} —— ` +
					"随包载荷与描述符钉的版本对不上（多半是构建期拉错了产物）。",
				true,
			);
		},
		phaseOf: (state: PayloadState): string => state.phase,
		ready: (state: PayloadState): boolean => state.phase === "ready",
		failure: (state: PayloadState): RuntimeFailure | undefined => state.failure,
	};
	return bindRuntimeMachine(machine, { envDir });
}

/**
 * 四态只读探测（**绝不安装**）。
 *
 * 与 venv 的四态同形共用（`DocxEnvStatus`）：`deps-missing` 的取值口在随包型运行时里
 * 是「缺失的必备文件」（含许可文本），`missing` 含「探针起不来」（与 inspectVenv 同语义）。
 */
export async function inspectBundledPayload(
	spec: BundledPayloadSpec,
	envDir: string,
	spawn: (request: SpawnRequest) => Promise<SpawnOutcome>,
): Promise<RuntimeInspectResult> {
	const missing = firstMissingFile(envDir, spec.requiredFiles);
	if (missing !== undefined) return { kind: "deps-missing", module: missing };
	const outcome = await spawn(spec.probe(envDir));
	if (outcome.code === null || outcome.code !== 0) return { kind: "missing" };
	const version = spec.parseVersion(outcome);
	if (version === undefined) return { kind: "missing" };
	if (version !== spec.version) return { kind: "wrong-version", version };
	return { kind: "ready" };
}
