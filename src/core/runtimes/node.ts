/**
 * node 运行时（随包载荷型）：托管根下的一个实例。
 *
 * 第二个「加一个运行时 = 加一份描述」的实例：本文件只放 **node 私有知识**
 * （版本固化、随包载荷的必备文件、探针与版本串解析、落点判据），内核
 * （runtime-store / machine / registry / bundled-payload）里没有一行 node 特化代码。
 *
 * ── 版本为什么钉 22.23.2 ──
 * `package.json` 的 `engines` 是 `>=22.19.0`，用户机器上的 Node（若有）版本不可控；
 * 随包这一份是**唯一**被注入给模型与脚本的 node（spec 阶段 0 否决「复用系统已装」
 * 的第 2/4 条理由）。版本号同时是托管根 `<id>/<version>/` 的版本段与随包载荷目录名，
 * 三者必须一致（改版本＝改这一个常量 + 重跑 `npm run fetch:node`）。
 *
 * ── 随包载荷的实测形态（2026-09-17，官方 zip 解包后的实测值）──
 *   - 官方 zip 内是单一顶层目录 `node-v22.23.2-win-x64/`，**构建期脚本会剥掉这一层**
 *     （与 fetch-uv 不同：uv 的 zip 根就是 uv.exe），于是载荷根就是 `node.exe` 所在层；
 *   - 载荷根实测有：`node.exe`（82.97 MB）、`npm` / `npm.cmd` / `npm.ps1`、`npx*`、
 *     `corepack*`、`node_modules/npm/`、`LICENSE`、`README.md`、`install_tools.bat`；
 *     2032 个文件 / 94.9 MB（zip 36 MB）；
 *   - 探针：`node.exe --version` → `v22.23.2`（解析见 parseNodeVersion）。
 *
 * ── 为什么必备文件里有 `LICENSE` ──
 * Node 本体 MIT（`LICENSE` 首段即"Node.js is licensed for use as follows…"），
 * 随包分发必须附许可文本。把它写进 `requiredFiles` 就把「不得删许可文本」变成
 * **每次安装都会过的机械断言**（缺了即相位 payload-incomplete 响亮失败），
 * 而不是一句只能靠人记住的义务。
 *
 * ── 为什么没有 `HTML_TO_DOCX_VENV` 那样的覆盖口 ──
 * python 的覆盖口是兼容既有用户/私有化预置的历史包袱；node 是新增运行时，
 * 没有需要兼容的旧路径。运维预置走**构建期**：把解包好的目录放到
 * `resources/runtimes/payload/node/<version>/`，`npm run fetch:node` 幂等跳过
 * （与 fetch-uv「手工放置即等价成功」同款，见 scripts/fetch-node.mjs）。
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
import type { RuntimeDescriptor, RuntimeOptions, RuntimeResolution } from "./registry.ts";

export const NODE_RUNTIME_ID = "node";
/** 固化的 Node 版本（`engines` 要求 ≥22.19，取当日的 v22.x 最新稳定版）。 */
export const NODE_RUNTIME_VERSION = "22.23.2";
/** 显示名：中性描述，不把上游品牌名当我们的产品名（商标义务见 resources/runtimes/README.md）。 */
export const NODE_LABEL = "Node（脚本运行时）";
/** 载荷根的必备文件：可执行本体 + 许可文本（后者是合规义务的机械化断言）。 */
export const NODE_REQUIRED_FILES: readonly string[] = ["node.exe", "LICENSE"];
export const NODE_FETCH_HINT =
	"构建期应执行 `npm run fetch:node`（或由运维把解包好的 node 目录放到该路径）——" +
	"本机不带载荷时装不了，且**不会**改走联网下载。";

/** 随包载荷目录（`<resources>/runtimes/payload/node/<version>`）。 */
export function nodePayloadDir(options: RuntimeOptions): string {
	return runtimePayloadDir(options, NODE_RUNTIME_ID, NODE_RUNTIME_VERSION);
}

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

function nodeSpec(options: RuntimeOptions, envDir: string): BundledPayloadSpec {
	return {
		label: NODE_LABEL,
		version: NODE_RUNTIME_VERSION,
		payloadDir: nodePayloadDir(options),
		fetchHint: NODE_FETCH_HINT,
		requiredFiles: NODE_REQUIRED_FILES,
		// 探针不需要注入 PATH：它是载荷根下的绝对路径（与 gitbash 不同，见 bundled-payload.ts 文件头）。
		probe: (): SpawnRequest => ({ command: join(envDir, "node.exe"), args: ["--version"] }),
		parseVersion: parseNodeVersion,
	};
}

export function createNodeRuntime(options: RuntimeOptions): RuntimeDescriptor {
	return {
		id: NODE_RUNTIME_ID,
		label: NODE_LABEL,
		version: NODE_RUNTIME_VERSION,
		source: `nodejs.org 官方发行版 node-v${NODE_RUNTIME_VERSION}-win-x64.zip（构建期拉取并用官方 SHASUMS256.txt 校验 SHA256，随包分发；载荷解包后的形态见本文件头）`,
		options,
		resolve: () => resolveNodeRuntime(options),
		// 载荷根自己就是环境目录：`node.exe` 就在实例根上，没有 venv 那样的子目录。
		envDirOf: (instance) => instance,
		createRunner: (envDir) => bindBundledPayloadRunner(nodeSpec(options, envDir), envDir),
		inspect: (envDir, spawn) => inspectBundledPayload(nodeSpec(options, envDir), envDir, spawn),
	};
}
