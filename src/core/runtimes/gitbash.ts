/**
 * gitbash 运行时：托管根下的一个实例（**纯按需联网下载**，2026-09-18 变更）。
 * 提供 bash 与常用 unix 工具。
 *
 * 本文件只放 **gitbash 私有知识**（发行物形态、来源与校验、解包手段、必备文件、
 * bash 入口、版本串解析、落点判据），内核里没有一行特化代码。
 *
 * ── 为什么只能是 PortableGit（spec 阶段 0 的结论，这里复述关键一条）──
 * Git for Windows 的三种官方发行物里，**MinGit 不含 `bash.exe`**（官方称它是
 * "non-interactive" 分发，shell 只以 `/bin/sh` 形式存在；busybox 变体的 shell 是
 * busybox 的 `ash` 且官方标为 experimental）。要让这个运行时名副其实，只有
 * **PortableGit**（完整 Git for Windows）。详见 `docs/运行时来源与许可.md`。
 *
 * ── `.7z.exe`（7z 自解压）在**用户机器上**怎么解（本轮的核心取舍）──
 * 仓库现有 jszip 解不了 7z；把 7-Zip 当运行期依赖随包分发被阶段 0 否掉
 * （LGPL + unRAR 限制：unRAR 那条与我们完全无关却要一起背）。三条路：
 *   1. 找官方 zip 形态的等价发行物 —— **不存在**：官方只有 `.7z.exe`（自解压）与
 *      `.tar.bz2`（117 MB，node 的 zlib 没有 bzip2 解压器，同样要引依赖）；
 *   2. 构建期解包后再分发的 zip —— 那就等于把 389 MB 重新塞回安装包，
 *      正好推翻「安装包不能臃肿」这个前提（用户 2026-09-18 的决定）；
 *   3. **调用发行物自带的 SFX 解包器**（`<artifact> -y -o<dir>`）—— 选它。
 *      阶段 2 在本机实测过这条命令（9584 文件 / 33 s 解完），运行期不再需要任何
 *      第三方的 7z 可执行文件：解包能力就在我们**刚校验过 sha256 的那个发行物**里。
 * 取舍要点（为什么 3 是可接受的）：解包动作发生在「发行物整包 sha256 已通过」之后 ——
 * 被执行的是与官方 release asset 逐字节相同的那一份文件，信任级别与安装官方安装器相同；
 * 代价是解包期间不可取消（SpawnFn 没有 kill 原语），但下载阶段可取消，
 * 且中断留下的暂存目录由下次安装的 clearLeftovers 清掉。
 *
 * ── 来源与校验（docs/运行时来源与许可.md 的定稿）──
 *   来源：`https://github.com/git-for-windows/git/releases/download/v2.55.0.windows.5/PortableGit-2.55.0.5-64-bit.7z.exe`
 *   （镜像 npmmirror 只是传输通道；企业内网可用 `KAMIBUDDY_GITBASH_URL` 显式覆盖）。
 *   **sha256 唯一信任源**：`5aa8a20f…4ae290`（与 GitHub Release 的 asset digest 逐字一致）。
 *   解包后必备文件：`usr/bin/bash.exe` + 根 `LICENSE.txt` + `CORRESPONDING-SOURCE.md`
 *   —— 三者缺一不许进位（后两个是 GPLv2 义务的载体，见下）。
 *
 * ── 许可文本随实例一起就位（GPLv2 义务的机械化断言）──
 *   PortableGit 解包后**自带**根 `LICENSE.txt`（GPL 全文 + 上游说明）与
 *   `mingw64/share/licenses/**`（MSYS2 的逐组件许可树，本版本实测 39 个文件）；
 *   整树解包 ⇒ 这些文件原样保留，「不得删」由 `requiredFiles` 变成每次安装都会过的断言。
 *   另一条义务是「提供 Corresponding Source 的获取方式」（GPLv2 §3）：载体是我们自己写的
 *   [`resources/runtimes/gitbash/CORRESPONDING-SOURCE.md`](../../../resources/runtimes/gitbash/CORRESPONDING-SOURCE.md)，
 *   解包后由本文件从 resources 拷进实例根 —— **义务因此始终与二进制在一起**
 *   （不靠产品界面记得展示）。义务清单见 `resources/runtimes/README.md`。
 *
 * ── 探针 = `bash.exe -c "git --version"`（一句话同时验三件事）──
 *   1. bash 起得来（这个运行时的存在意义）；
 *   2. 实例里的 git 起得来；
 *   3. **注入的 PATH 布局是对的** —— 探针自带注入层同一份布局（injection.ts 的
 *      `RUNTIME_ENV_LAYOUT.gitbash`）。实测教训：不注入时 `bash -c "git --version"`
 *      读到的是机器上另一个 git（2.53.0.windows.2，而实例里是 2.55.0.windows.5），
 *      也就是说**不做注入的探针验的是机器环境，不是我们装的那一份**。
 *
 * ── 商标义务 ──
 * 上游「Git」名称与 logo 不得当我们的品牌用（只在许可清单/致谢出现），所以显示名取
 * 中性描述；id 仍是 `gitbash`（与 spec/代码一致）。
 */

import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { downloadCacheDir, instanceDir, isCompleteInstance, readCurrent } from "../runtime-store.ts";
import type { SpawnOutcome, SpawnRequest } from "../../documents/docx-env.ts";
import { acquireArtifact, type AcquiredArtifact, type AcquireContext, type RuntimeArtifactSpec } from "./artifact.ts";
import { DownloadError } from "./download.ts";
import { RUNTIME_ENV_LAYOUT, pathKeyOf, prependPath } from "./injection.ts";
import {
	bindPayloadProbeRunner,
	describeProbeOutcome,
	inspectPayload,
	runtimeResourcesDir,
	type PayloadProbeSpec,
} from "./payload-probe.ts";
import type { RuntimeDescriptor, RuntimeOptions, RuntimeResolution } from "./registry.ts";

export const GITBASH_RUNTIME_ID = "gitbash";
/** 固化的发行版版本（Git for Windows 的 release tag 形态：`2.55.0.windows.5` ↔ 本值 `2.55.0.5`）。 */
export const GITBASH_RUNTIME_VERSION = "2.55.0.5";
/** 发行物文件名（URL 与缓存文件名都由它定位）。 */
export const GITBASH_ARTIFACT = `PortableGit-${GITBASH_RUNTIME_VERSION}-64-bit.7z.exe`;
/** 官方 release tag。 */
export const GITBASH_RELEASE_TAG = "v2.55.0.windows.5";
export const GITBASH_OFFICIAL_DIR = `https://github.com/git-for-windows/git/releases/download/${GITBASH_RELEASE_TAG}`;
export const GITBASH_MIRROR_DIR = `https://registry.npmmirror.com/-/binary/git-for-windows/${GITBASH_RELEASE_TAG}`;
/** 企业内网/离线预置的显式覆盖口（完整发行物 URL）。 */
export const GITBASH_URL_ENV = "KAMIBUDDY_GITBASH_URL";
/** 官方 sha256（与 GitHub Release asset digest 逐字一致，2026-09-17 实测）。 */
export const GITBASH_ARTIFACT_SHA256 = "5aa8a20f6e9abb2c755f0e73c91c687701a46b309ad84a0ca6509380fa4ae290";
/** 体积下限（实测 58,960,208 B；留余量挡「下到错误页」，不是信任源）。 */
export const GITBASH_MIN_BYTES = 50 * 1024 * 1024;
/** 体积提示（进度与错误文案都带上）。 */
export const GITBASH_SIZE_HINT = "约 56 MiB";
/** 显示名：中性描述（商标义务见文件头）。 */
export const GITBASH_LABEL = "Bash 与 unix 工具（托管运行时）";
/**
 * bash 入口（相对实例根）。实测 `usr/bin/bash.exe` 存在；若将来发行物形态变化，
 * **只改这一处**（探针与必备文件都从它派生）。
 * 用 `join` 生成而不是写 `"usr/bin/bash.exe"` 字面量：Windows 上拼绝对路径时不会出现
 * 混合分隔符（实测踩过），且缺文件时诊断报出的路径形态与磁盘一致。
 */
export const GITBASH_BASH_RELATIVE = join("usr", "bin", "bash.exe");
/** GPLv2 §3 的对应源码获取方式（我们自己的书面说明），解包后拷进实例根。 */
export const GITBASH_SOURCE_OFFER_RELATIVE = join("runtimes", "gitbash", "CORRESPONDING-SOURCE.md");
/** 实例根的必备文件：bash 本体 + 根许可文本 + 对应源码获取方式（后两者是合规义务）。 */
export const GITBASH_REQUIRED_FILES: readonly string[] = [
	GITBASH_BASH_RELATIVE,
	"LICENSE.txt",
	"CORRESPONDING-SOURCE.md",
];

/** 实例里的 bash 绝对路径（探针唯一取值口）。 */
export function gitbashBashPath(activeDir: string): string {
	return join(activeDir, GITBASH_BASH_RELATIVE);
}

/** 对应源码获取方式的随包位置（resources 下）。 */
export function gitbashSourceOfferPath(options: RuntimeOptions): string {
	return join(runtimeResourcesDir(options), GITBASH_SOURCE_OFFER_RELATIVE);
}

/**
 * `bash -c "git --version"` 输出 → 版本号（归一化成 `<major>.<minor>.<patch>.<build>`）。
 *
 * 实测输出：`git version 2.55.0.windows.5`（版本段里多了 `windows` 这个词）→ `2.55.0.5`。
 * 解析不出即 undefined：**不做宽松匹配**（不写「前缀对上就算」）—— 版本断言是「装的这一份
 * 与我们钉的版本对得上」的唯一机械证据，格式异动就该响亮失败（发行物是我们校验后解的，
 * 格式异动只可能是上游换了产物，此时失败文案会把原始输出带出来）。
 */
export function parseGitVersion(outcome: SpawnOutcome): string | undefined {
	const text = `${outcome.stdout}\n${outcome.stderr}`;
	const match = /git version (\d+)\.(\d+)\.(\d+)\.windows\.(\d+)/.exec(text);
	if (match === null) return undefined;
	return `${match[1]}.${match[2]}.${match[3]}.${match[4]}`;
}

/**
 * gitbash 落点判据（只读 fs，不探测、不安装）。只有两级：
 * 托管根 `current` 指向的完整实例 → managed；否则 pending（由本次安装占位）。
 * 坏指针忽略并如实上报 —— 与 python / node 同一条规则（唯一真源只有一处判据）。
 */
export function resolveGitbashRuntime(options: RuntimeOptions): RuntimeResolution {
	const instance = instanceDir(options.root, GITBASH_RUNTIME_ID, GITBASH_RUNTIME_VERSION);
	const current = readCurrent(options.root, GITBASH_RUNTIME_ID);
	if (current !== undefined) {
		const dir = instanceDir(options.root, GITBASH_RUNTIME_ID, current);
		if (isCompleteInstance(dir)) {
			return {
				instanceDir: dir,
				version: current,
				activeDir: dir,
				source: "managed",
				detail: `托管根 current 指向 ${current}（已进位、manifest 齐）`,
				managed: true,
			};
		}
		return {
			instanceDir: instance,
			version: GITBASH_RUNTIME_VERSION,
			activeDir: instance,
			source: "pending",
			detail:
				`托管根 current 指向 ${current}，但该实例没有 manifest（未进位完成或已损坏）—— ` +
				`该指针已被忽略，将由本次安装落位到 ${instance}`,
			managed: true,
		};
	}
	return {
		instanceDir: instance,
		version: GITBASH_RUNTIME_VERSION,
		activeDir: instance,
		source: "pending",
		detail: `尚无可用托管实例，将由本次安装落位到 ${instance}`,
		managed: true,
	};
}

/** 候选下载地址（覆盖口在前）。空串/未设的候选项被过滤掉。 */
export function gitbashArtifactUrls(options: RuntimeOptions): readonly string[] {
	const override = options.env?.[GITBASH_URL_ENV];
	return [override, `${GITBASH_OFFICIAL_DIR}/${GITBASH_ARTIFACT}`, `${GITBASH_MIRROR_DIR}/${GITBASH_ARTIFACT}`].filter(
		(url): url is string => typeof url === "string" && url.trim() !== "",
	);
}

/**
 * 运行期解包：调用**发行物自带的 SFX 解包器**（`-y` 静默、`-o<dir>` 指定落点，本机实测可用），
 * 再把 Corresponding Source 的获取方式拷进实例根（GPLv2 §3 的义务载体，必须随二进制走）。
 */
export async function extractPortableGit(
	artifactPath: string,
	envDir: string,
	context: { readonly spawn: (request: SpawnRequest) => Promise<SpawnOutcome>; readonly sourceOffer: string },
): Promise<void> {
	if (!existsSync(context.sourceOffer)) {
		throw new DownloadError(
			"incomplete",
			`缺少 ${context.sourceOffer}（GPLv2 §3 的对应源码获取方式必须与二进制同行）—— ` +
				"安装已中止；这是随应用分发的文字资产缺失，请重装应用。",
		);
	}
	const outcome = await context.spawn({ command: artifactPath, args: ["-y", `-o${envDir}`] });
	if (outcome.code !== 0) {
		throw new DownloadError(
			"extract",
			`PortableGit 自解压失败（${describeProbeOutcome(outcome)}）—— 解包器就是刚校验过 sha256 的发行物自身；` +
				`判断 ${envDir} 是否可写、磁盘是否够（解包后约 389 MB），重试安装即可。`,
		);
	}
	copyFileSync(context.sourceOffer, join(envDir, "CORRESPONDING-SOURCE.md"));
}

function gitbashArtifactSpec(options: RuntimeOptions): RuntimeArtifactSpec {
	return {
		id: GITBASH_RUNTIME_ID,
		label: GITBASH_LABEL,
		version: GITBASH_RUNTIME_VERSION,
		artifactName: GITBASH_ARTIFACT,
		urls: gitbashArtifactUrls(options),
		sha256: GITBASH_ARTIFACT_SHA256,
		minBytes: GITBASH_MIN_BYTES,
		sizeHint: GITBASH_SIZE_HINT,
		// 没有官方集中校验文件（GitHub release 只在 API 里给 asset digest，且那条要联网查 API）：
		// 发行物 sha256 已与 digest 逐字核对过并钉在代码里，这里不再多一跳网络。
		requiredFiles: GITBASH_REQUIRED_FILES,
		extract: (artifactPath, envDir, ctx) =>
			extractPortableGit(artifactPath, envDir, { spawn: ctx.spawn, sourceOffer: gitbashSourceOfferPath(options) }),
	};
}

function gitbashProbeSpec(options: RuntimeOptions, envDir: string): PayloadProbeSpec {
	// 基线环境：生产是 process.env；测试经 options.env 注入空表（探针的 PATH 因此可断言）。
	const baseEnv = options.env ?? process.env;
	const pathKey = pathKeyOf(baseEnv);
	return {
		label: GITBASH_LABEL,
		version: GITBASH_RUNTIME_VERSION,
		requiredFiles: GITBASH_REQUIRED_FILES,
		probe: (dir): SpawnRequest => ({
			command: gitbashBashPath(dir),
			args: ["-c", "git --version"],
			// 自带注入：验的是**实例里那份** git，不是机器上碰巧存在的（见文件头实测）。
			env: { [pathKey]: prependPath(baseEnv, RUNTIME_ENV_LAYOUT.gitbash.pathDirs(dir)) },
		}),
		parseVersion: parseGitVersion,
	};
}

export function createGitbashRuntime(options: RuntimeOptions): RuntimeDescriptor {
	return {
		id: GITBASH_RUNTIME_ID,
		label: GITBASH_LABEL,
		version: GITBASH_RUNTIME_VERSION,
		source:
			`Git for Windows PortableGit ${GITBASH_RUNTIME_VERSION}（${GITBASH_ARTIFACT}，运行期按需下载；` +
			"发行物 sha256 与官方 release asset digest 一致；解包用发行物自带的 SFX 解包器，不引入 7-Zip 依赖）",
		options,
		resolve: () => resolveGitbashRuntime(options),
		// 解包根自己就是环境目录：bash 在 `usr/bin` 下，但 PATH 需要的是三个子目录（见注入层布局）。
		envDirOf: (instance) => instance,
		acquire: (envDir, context: AcquireContext): Promise<AcquiredArtifact> =>
			acquireArtifact(
				gitbashArtifactSpec(options),
				downloadCacheDir(options.root, GITBASH_RUNTIME_ID, GITBASH_RUNTIME_VERSION),
				envDir,
				context,
			),
		createRunner: (envDir) => bindPayloadProbeRunner(gitbashProbeSpec(options, envDir), envDir),
		inspect: (envDir, spawn) => inspectPayload(gitbashProbeSpec(options, envDir), envDir, spawn),
	};
}
