/**
 * node 运行时：托管根下的一个实例（**纯按需联网下载**，2026-09-18 变更）。
 *
 * 本文件只放 **node 私有知识**（版本固化、官方来源与校验、解包形态、必备文件、
 * 探针与版本串解析、落点判据），内核（runtime-store / machine / registry /
 * artifact / download / payload-probe）里没有一行 node 特化代码。
 *
 * ── 版本为什么钉 22.23.2 ──
 * `package.json` 的 `engines` 是 `>=22.19.0`，用户机器上的 Node（若有）版本不可控；
 * 托管这一份是**唯一**被注入给模型与脚本的 node（spec 阶段 0 否决「复用系统已装」
 * 的第 2/4 条理由）。版本号同时是托管根 `<id>/<version>/` 的版本段、发行物文件名
 * 与校验值所对应的版本，三者必须一致（改版本＝改这几个常量 + 对一遍官方 SHASUMS256.txt）。
 *
 * ── 来源与校验（docs/运行时来源与许可.md 的定稿）──
 *   来源：`https://nodejs.org/dist/v22.23.2/node-v22.23.2-win-x64.zip`（镜像
 *   `registry.npmmirror.com/-/binary/node/v<ver>/<asset>` 只是传输通道；企业内网可用
 *   `KAMIBUDDY_NODE_URL` 显式覆盖）。
 *   校验三处，缺一不可：
 *     1. **发行物整包 sha256**（download.ts 的下载层，钉死在下面）；
 *     2. **官方 `SHASUMS256.txt` 交叉核对**（取不到只记 warning；取到却不一致即中止）；
 *     3. **解包后的 `node.exe` sha256**（官方校验文件里单独给了 `win-x64/node.exe` 一条，
 *        比只核整包更抗「打包器换了个 zip 容器」这类差异）。
 *   三处任一处不符都**不许进位**：半个包 / 错版本的包一旦进位，用户看到的是
 *   「装好了、一跑就崩」，比装不上更难归因。
 *
 * ── 解包形态（实测 2026-09-17 的官方 zip）──
 *   zip 内是单一顶层目录 `node-v22.23.2-win-x64/`，**解包时剥掉这一层**
 *   （与 uv 的 zip 不同：uv 的 zip 根就是 uv.exe），于是实例根就是 `node.exe` 所在层；
 *   实测根层有 `node.exe`、`npm` / `npm.cmd` / `npm.ps1`、`npx*`、`corepack*`、
 *   `node_modules/npm/`、`LICENSE`、`README.md`、`install_tools.bat`（2032 文件 / 94.9 MB）。
 *   用 jszip 就地解（仓库既有依赖，已随本变更从 devDependencies 提到 dependencies：
 *   运行期要用；7z 只出现在 gitbash 那一路，见 gitbash.ts）。
 *   注意：这一版 zip 里**没有** `node.lib`，别把它写进必备文件。
 *
 * ── 为什么必备文件里有 `LICENSE` ──
 * Node 本体 MIT，随包分发/按需分发都必须附许可文本。把它写进 `requiredFiles` 就把
 * 「不得删许可文本」变成**每次安装都会过的机械断言**（缺了即相位 payload-incomplete
 * 响亮失败），而不是一句只能靠人记住的义务。
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import JSZip from "jszip";
import { downloadCacheDir, instanceDir, isCompleteInstance, readCurrent } from "../runtime-store.ts";
import type { SpawnOutcome, SpawnRequest } from "../../documents/docx-env.ts";
import { acquireArtifact, type AcquiredArtifact, type AcquireContext, type RuntimeArtifactSpec } from "./artifact.ts";
import { DownloadError, sha256File } from "./download.ts";
import { bindPayloadProbeRunner, inspectPayload, type PayloadProbeSpec } from "./payload-probe.ts";
import type { RuntimeDescriptor, RuntimeOptions, RuntimeResolution } from "./registry.ts";

export const NODE_RUNTIME_ID = "node";
/** 固化的 Node 版本（`engines` 要求 ≥22.19，取定稿当日的 v22.x 最新稳定版）。 */
export const NODE_RUNTIME_VERSION = "22.23.2";
/** 显示名：中性描述，不把上游品牌名当我们的产品名。 */
export const NODE_LABEL = "Node（脚本运行时）";
/** 官方发行物文件名（URL 与校验值都由它定位）。 */
export const NODE_ARTIFACT = `node-v${NODE_RUNTIME_VERSION}-win-x64.zip`;
/** 官方 dist 目录（`SHASUMS256.txt` 与发行物同在它下面）。 */
export const NODE_DIST_DIR = `https://nodejs.org/dist/v${NODE_RUNTIME_VERSION}`;
/** 镜像只是传输通道（校验和才是信任源；对不上就换候选）。 */
export const NODE_MIRROR_DIR = `https://registry.npmmirror.com/-/binary/node/v${NODE_RUNTIME_VERSION}`;
/** 企业内网/离线预置的显式覆盖口（完整 zip URL）。 */
export const NODE_URL_ENV = "KAMIBUDDY_NODE_URL";
/** 官方 `SHASUMS256.txt` 实测值（2026-09-17 核对，见 resources/runtimes/README.md）。 */
export const NODE_ARTIFACT_SHA256 = "1177b4137ba5adaa56354ae40f1080c7450e8ae09cecb47da459d1c52ac99f97";
export const NODE_EXE_SHA256 = "0d0f5e39f9f3d9587bc19f73eab3c2c9c4903fd02d6dbf9c853dd81b3d95fad4";
/** 体积下限（实测 35,683,585 B；留余量挡「下到错误页」，不是信任源）。 */
export const NODE_MIN_BYTES = 30 * 1024 * 1024;
/** 体积提示（进度与错误文案都带上）。 */
export const NODE_SIZE_HINT = "约 34 MiB";
/** 实例根的必备文件：可执行本体 + 许可文本（后者是合规义务的机械化断言）。 */
export const NODE_REQUIRED_FILES: readonly string[] = ["node.exe", "LICENSE"];

/**
 * `node --version` 输出 → 版本号。形如 `v22.23.2`（整行只有它）；解析不出即 undefined
 * （起不来 / 输出被别的横幅污染都算「这一份不可用」，交给上层判 missing）。
 */
export function parseNodeVersion(outcome: SpawnOutcome): string | undefined {
	const match = /^v(\d+\.\d+\.\d+)$/.exec(outcome.stdout.trim());
	return match?.[1];
}

/**
 * node 落点判据（只读 fs，不探测、不安装）。
 *
 * 只有两级：托管根 `current` 指向的实例（完整）→ managed；否则 pending（由本次安装占位）。
 * `current` 指向坏实例时**忽略该指针**并如实上报（与 python 同一条规则：不禁着手改坏的指针，
 * 否则一次手改会造出一个版本名是垃圾的新实例）。
 */
export function resolveNodeRuntime(options: RuntimeOptions): RuntimeResolution {
	const instance = instanceDir(options.root, NODE_RUNTIME_ID, NODE_RUNTIME_VERSION);
	const current = readCurrent(options.root, NODE_RUNTIME_ID);
	if (current !== undefined) {
		const dir = instanceDir(options.root, NODE_RUNTIME_ID, current);
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
			version: NODE_RUNTIME_VERSION,
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
		version: NODE_RUNTIME_VERSION,
		activeDir: instance,
		source: "pending",
		detail: `尚无可用托管实例，将由本次安装落位到 ${instance}`,
		managed: true,
	};
}

/** 候选下载地址（覆盖口在前）。空串/未设的候选项被过滤掉。 */
export function nodeArtifactUrls(options: RuntimeOptions): readonly string[] {
	const override = options.env?.[NODE_URL_ENV];
	return [override, `${NODE_DIST_DIR}/${NODE_ARTIFACT}`, `${NODE_MIRROR_DIR}/${NODE_ARTIFACT}`].filter(
		(url): url is string => typeof url === "string" && url.trim() !== "",
	);
}

/**
 * 把官方 zip 解到 `envDir`，剥掉顶层目录，并对 `node.exe` 单独再断言一次 sha256。
 *
 * `expectedExeSha256` 只在**解包单测**里被显式传（造小体积假件才能断言「顶层目录被剥掉」这类
 * 形状）；生产入口（`nodeArtifactSpec` 的 extract）不传，缺省就是官方固定值 ——
 * 门始终在，测试不会把它绕开。
 */
export async function extractNodeZip(
	artifactPath: string,
	envDir: string,
	expectedExeSha256: string = NODE_EXE_SHA256,
): Promise<void> {
	const zip = await JSZip.loadAsync(readFileSync(artifactPath));
	const names = Object.keys(zip.files);
	const top = names[0]?.split("/")[0];
	if (top === undefined || !names.includes(`${top}/node.exe`)) {
		throw new DownloadError(
			"extract",
			`${artifactPath} 里没有 <顶层目录>/node.exe（内容物前几项：${names.slice(0, 5).join(", ")}）` +
				"—— 不像官方 node 发行包，已中止安装。",
		);
	}
	for (const [name, entry] of Object.entries(zip.files)) {
		if (!name.startsWith(`${top}/`)) continue;
		const relative = name.slice(top.length + 1);
		if (relative === "") continue;
		const target = join(envDir, relative);
		if (entry.dir) {
			mkdirSync(target, { recursive: true });
			continue;
		}
		mkdirSync(dirname(target), { recursive: true });
		writeFileSync(target, await entry.async("nodebuffer"));
	}
	const actual = await sha256File(join(envDir, "node.exe"));
	if (actual !== expectedExeSha256) {
		throw new DownloadError(
			"sha256",
			`解包后的 node.exe sha256 不符（期望 ${expectedExeSha256}，实际 ${actual}）—— ` +
				"本次解包结果已丢弃、未进位；请重试安装。",
		);
	}
}

function nodeArtifactSpec(options: RuntimeOptions): RuntimeArtifactSpec {
	return {
		id: NODE_RUNTIME_ID,
		label: NODE_LABEL,
		version: NODE_RUNTIME_VERSION,
		artifactName: NODE_ARTIFACT,
		urls: nodeArtifactUrls(options),
		sha256: NODE_ARTIFACT_SHA256,
		minBytes: NODE_MIN_BYTES,
		sizeHint: NODE_SIZE_HINT,
		shasums: {
			url: `${NODE_DIST_DIR}/SHASUMS256.txt`,
			entries: [
				{ name: NODE_ARTIFACT, sha256: NODE_ARTIFACT_SHA256 },
				{ name: "win-x64/node.exe", sha256: NODE_EXE_SHA256 },
			],
		},
		requiredFiles: NODE_REQUIRED_FILES,
		// 解包不需要 spawn（zip 就地解），也不需要注入 PATH（探针是实例根下的绝对路径）。
		extract: (artifactPath, envDir) => extractNodeZip(artifactPath, envDir),
	};
}

function nodeProbeSpec(envDir: string): PayloadProbeSpec {
	return {
		label: NODE_LABEL,
		version: NODE_RUNTIME_VERSION,
		requiredFiles: NODE_REQUIRED_FILES,
		probe: (): SpawnRequest => ({ command: join(envDir, "node.exe"), args: ["--version"] }),
		parseVersion: parseNodeVersion,
	};
}

export function createNodeRuntime(options: RuntimeOptions): RuntimeDescriptor {
	return {
		id: NODE_RUNTIME_ID,
		label: NODE_LABEL,
		version: NODE_RUNTIME_VERSION,
		source:
			`nodejs.org 官方发行版 ${NODE_ARTIFACT}（运行期按需下载；` +
			"整包 sha256 + 官方 SHASUMS256.txt 交叉核对 + 解包后 node.exe sha256 三处校验，校验不过不进位）",
		options,
		resolve: () => resolveNodeRuntime(options),
		// 解包根自己就是环境目录：`node.exe` 就在实例根上，没有 venv 那样的子目录。
		envDirOf: (instance) => instance,
		acquire: (envDir, context: AcquireContext): Promise<AcquiredArtifact> =>
			acquireArtifact(
				nodeArtifactSpec(options),
				downloadCacheDir(options.root, NODE_RUNTIME_ID, NODE_RUNTIME_VERSION),
				envDir,
				context,
			),
		createRunner: (envDir) => bindPayloadProbeRunner(nodeProbeSpec(envDir), envDir),
		inspect: (envDir, spawn) => inspectPayload(nodeProbeSpec(envDir), envDir, spawn),
	};
}
