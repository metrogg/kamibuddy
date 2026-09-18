/**
 * gitbash 运行时（随包载荷型）：托管根下的一个实例。提供 bash 与常用 unix 工具。
 *
 * 第三个「加一个运行时 = 加一份描述」的实例：本文件只放 **gitbash 私有知识**
 * （发行物形态、载荷必备文件、bash 入口、版本串解析、落点判据），内核里没有一行特化代码。
 *
 * ── 为什么只能是 PortableGit（spec 阶段 0 的结论，这里复述关键一条）──
 * Git for Windows 的三种官方发行物里，**MinGit 不含 `bash.exe`**（官方称它是
 * "non-interactive" 分发，shell 只以 `/bin/sh` 形式存在；busybox 变体的 shell 是
 * busybox 的 `ash` 且官方标为 experimental）。要让这个运行时名副其实，只有
 * **PortableGit**（完整 Git for Windows）。详见 `docs/运行时来源与许可.md`。
 *
 * ── `PortableGit-*.7z.exe` 是 7z 自解压，所以解包只能放构建期 ──
 * 仓库现有 jszip 解不了 7z。要运行期解包就得把 7z 解压器塞进产物，而 7-Zip 是
 * **LGPL + unRAR 限制**，随产物分发即把限制带进我们的分发物。于是取
 * 「**构建期**解包 → 随包分发解包结果」（scripts/fetch-gitbash.mjs；解包器用
 * SFX 自身或构建机上的 7-Zip CLI，**两者都只在构建期出现一次、不进产物**）。
 * 运行期只做「复制 + 探针」，没有任何 7z 依赖 —— 代价是安装包变大（实测值见
 * `resources/runtimes/README.md`），换来的是离线可用且首次使用不等下载。
 * 载荷缺席时**响亮失败**并给出构建命令，绝不改走联网自取。
 *
 * ── 随包载荷的实测形态（2026-09-17，官方 7z 自解压包在本机解包后的实测值）──
 *   - 发行物：`PortableGit-2.55.0.5-64-bit.7z.exe`，58,960,208 B（≈56 MiB），
 *     sha256 `5aa8a20f…4ae290`（与 GitHub Release 的 asset digest 逐字一致）；
 *   - 解包后：9584 个文件 / **389.1 MB**；根层是 `bin/ cmd/ dev/ etc/ mingw64/
 *     tmp/ usr/ git-bash.exe git-cmd.exe LICENSE.txt README.portable`；
 *   - bash 入口：`usr/bin/bash.exe`（另有 `bin/bash.exe`，MSYS 的别名位）；
 *   - git：`cmd/git.exe`（包装器）与 `mingw64/bin/git.exe`（真身）；
 *   - **许可文本随包自带**：根 `LICENSE.txt`（GPLv2 文本 + 上游说明），另有
 *     `mingw64/share/licenses/**` 下 39 个逐组件许可文件（MSYS2 的分发方式）。
 *     这两处**不得删**，`requiredFiles` 把根 `LICENSE.txt` 变成每次安装都会过的
 *     机械断言（合规义务清单见 `resources/runtimes/README.md`）。
 *
 * ── 探针 = `bash.exe -c "git --version"`（一句话同时验三件事）──
 *   1. bash 起得来（这个运行时的存在意义）；
 *   2. 载荷里的 git 起得来；
 *   3. **注入的 PATH 布局是对的** —— 探针自带注入层同一份布局（injection.ts 的
 *      `RUNTIME_ENV_LAYOUT.gitbash`）。实测教训：不注入时 `bash -c "git --version"`
 *      读到的是机器上另一个 git（2.53.0.windows.2，而载荷里是 2.55.0.windows.5），
 *      也就是说**不做注入的探针验的是机器环境，不是随包载荷**。
 *
 * ── 商标义务 ──
 * 上游「Git」名称与 logo 不得当我们的品牌用（只在许可清单/致谢出现），所以显示名取
 * 中性描述；id 仍是 `gitbash`（与 spec/代码一致）。
 */

import { join } from "node:path";
import { instanceDir, isCompleteInstance, readCurrent } from "../runtime-store.ts";
import type { SpawnOutcome, SpawnRequest } from "../../documents/docx-env.ts";
import {
	bindBundledPayloadRunner,
	inspectBundledPayload,
	runtimePayloadDir,
	type BundledPayloadSpec,
} from "./bundled-payload.ts";
import { RUNTIME_ENV_LAYOUT, pathKeyOf, prependPath } from "./injection.ts";
import type { RuntimeDescriptor, RuntimeOptions, RuntimeResolution } from "./registry.ts";

export const GITBASH_RUNTIME_ID = "gitbash";
/** 固化的发行版版本（Git for Windows 的 release tag 形态：`2.55.0.windows.5` ↔ 本值 `2.55.0.5`）。 */
export const GITBASH_RUNTIME_VERSION = "2.55.0.5";
/** 发行物文件名（构建期脚本按它拼 URL，也是诊断里可核对的事实）。 */
export const GITBASH_ARTIFACT = `PortableGit-${GITBASH_RUNTIME_VERSION}-64-bit.7z.exe`;
/** 显示名：中性描述（商标义务见文件头）。 */
export const GITBASH_LABEL = "Bash 与 unix 工具（随包托管）";
/**
 * bash 入口（相对载荷根）。实测 `usr/bin/bash.exe` 存在；若将来载荷形态变化，
 * **只改这一处**（探针与必备文件都从它派生）。
 * 用 `join` 生成而不是写 `"usr/bin/bash.exe"` 字面量：Windows 上拼绝对路径时不会出现
 * 混合分隔符（实测踩过），且缺文件时诊断报出的路径形态与磁盘一致。
 */
export const GITBASH_BASH_RELATIVE = join("usr", "bin", "bash.exe");
/** 载荷根的必备文件：bash 本体 + 根许可文本（后者是 GPLv2 署名义务的机械化断言）。 */
export const GITBASH_REQUIRED_FILES: readonly string[] = [GITBASH_BASH_RELATIVE, "LICENSE.txt"];
export const GITBASH_FETCH_HINT =
	"构建期应执行 `npm run fetch:gitbash`（需联网拉发行物；解包用 SFX 自身或构建机上的 7-Zip，" +
	"或由运维把解包好的目录放到该路径）——本机不带载荷时装不了，且**不会**改走联网下载。";

/** 随包载荷目录（`<resources>/runtimes/payload/gitbash/<version>`）。 */
export function gitbashPayloadDir(options: RuntimeOptions): string {
	return runtimePayloadDir(options, GITBASH_RUNTIME_ID, GITBASH_RUNTIME_VERSION);
}

/** 载荷里的 bash 绝对路径（探针唯一取值口）。 */
export function gitbashBashPath(activeDir: string): string {
	return join(activeDir, GITBASH_BASH_RELATIVE);
}

/**
 * `bash -c "git --version"` 输出 → 版本号（归一化成 `<major>.<minor>.<patch>.<build>`）。
 *
 * 实测输出：`git version 2.55.0.windows.5`（版本段里多了 `windows` 这个词）→ `2.55.0.5`。
 * 解析不出即 undefined：**不做宽松匹配**（不写「前缀对上就算」）—— 版本断言是「随包载荷
 * 与我们钉的版本对得上」的唯一机械证据，格式异动就该响亮失败（载荷是我们自己构建期拉的，
 * 格式异动只可能是拉错了产物，此时失败文案会把原始输出带出来，改一行即可修正）。
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

function gitbashSpec(options: RuntimeOptions, envDir: string): BundledPayloadSpec {
	// 基线环境：生产是 process.env；测试经 options.env 注入空表（探针的 PATH 因此可断言）。
	const baseEnv = options.env ?? process.env;
	const pathKey = pathKeyOf(baseEnv);
	return {
		label: GITBASH_LABEL,
		version: GITBASH_RUNTIME_VERSION,
		payloadDir: gitbashPayloadDir(options),
		fetchHint: GITBASH_FETCH_HINT,
		requiredFiles: GITBASH_REQUIRED_FILES,
		probe: (dir): SpawnRequest => ({
			command: gitbashBashPath(dir),
			args: ["-c", "git --version"],
			// 自带注入：验的是**载荷里那份** git，不是机器上碰巧存在的（见文件头实测）。
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
		source: `Git for Windows PortableGit ${GITBASH_RUNTIME_VERSION}（${GITBASH_ARTIFACT}，构建期拉取并核对 sha256、解包后随包分发；解包器只在构建期使用）`,
		options,
		resolve: () => resolveGitbashRuntime(options),
		// 载荷根自己就是环境目录：bash 在 `usr/bin` 下，但 PATH 需要的是三个子目录（见注入层布局）。
		envDirOf: (instance) => instance,
		createRunner: (envDir) => bindBundledPayloadRunner(gitbashSpec(options, envDir), envDir),
		inspect: (envDir, spawn) => inspectBundledPayload(gitbashSpec(options, envDir), envDir, spawn),
	};
}
