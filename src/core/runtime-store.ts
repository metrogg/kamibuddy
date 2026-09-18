/**
 * 托管运行时存储：`<configDir>/runtimes/<id>/<version>/` + `current` 指针。
 *
 * 本文件是纯路径 + 磁盘协议层（不含任何运行时的 private 知识），所以能被任何
 * 运行时复用、也能用真临时目录单测。
 *
 * ── 为什么用「版本化托管根」而不是平级隐式路径（如 ~/.venv-html-to-docx） ──
 *  1. 回滚要有东西可回：平级路径只有一个位子，新版本一装，旧版本就被 `--clear` 抹了；
 *  2. 重装要能「只凭重置这一个动作修好」：得能区分盘上哪些目录是半成品、哪些是完成品，
 *    平级目录名既不带版本也不带完成标记，只能靠人猜；
 *  3. 诊断要说清「你现在用哪一版、盘上还有哪几版」：没有版本维度就说不出来。
 *
 * ── 为什么 `current` 必须**最后**写（写入顺序不可换） ──
 * 安装顺序固定为：暂存目录 → 校验 → 改名进位 → 进位后复验 → 写 manifest → **写 current**。
 * 读侧只认「current 指向的实例，且该实例有 manifest」，于是任意时刻断电都停在
 * 一个**可识别**的状态上：
 *   - 崩在改名之前：盘上只剩 `.staging-*` 半成品、没有 current ⇒ 读侧判定「未就绪」；
 *   - 崩在改名之后、写 manifest 之前：版本目录在但没完成标记 ⇒ 读侧判定「未就绪」
 *     （下次安装把它当残留清掉重来）；
 *   - 崩在写 manifest 之后、写 current 之前：实例完整却没发布 ⇒ 读侧仍判定「未就绪」
 *     （诊断列成「已进位未发布」；下次 ensure 只补指针，**零成本续跑**）。
 * 反过来先写 current 的话，上面三种中间态都会「看起来就绪」—— 转换时才炸，
 * 而且炸在用户面前。这就是「安装期间任何时刻断电都不会出现看似就绪的状态」。
 * 崩溃模拟的实证在 runtime-store.test.ts 与 runtimes/python.test.ts。
 *
 * ── 为什么 manifest 与 current 是两份 ──
 * manifest 描述**这一份实例**（版本 / 来源 / 校验和 / 装的时间），随实例走（改名时
 * 跟着进位）；current 只回答**现在用哪一份**，是可变指针。合成一份意味着「切指针
 * 要重写实例内容」—— 回滚就又变成动磁盘实体了（而回滚的要求是「只切指针、不重新下载」）。
 */

import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { getRuntimesDir } from "./config-paths.ts";

/** 半成品目录前缀。诊断靠它把「上次中断留下的东西」指名出来。 */
export const STAGING_PREFIX = ".staging-";

/** 版本指针文件名（内容是一行版本号）。 */
export const CURRENT_POINTER_NAME = "current";

/** 实例完成标记文件名。 */
export const MANIFEST_NAME = "manifest.json";

/**
 * 一份已进位实例的自述。字段对应 spec SubTask 1.1.2。
 * `status` 只有 "installed"：manifest 在**进位并复验通过之后**才写，所以
 * 「manifest 在」本身就等价于「这一份完整且验过」，不需要第二套状态机。
 */
export interface RuntimeManifest {
	readonly id: string;
	readonly version: string;
	/** 来源（下载型运行时记 URL / 发行物，python 记 uv 与发行通道）。诊断如实列出。 */
	readonly source: string;
	/** 校验和（下载型运行时是发行包 SHA256；venv 型运行时无下载物，可缺省）。 */
	readonly checksum?: string;
	/** 安装时刻（ISO 串）。 */
	readonly installedAt: string;
	readonly status: "installed";
}

/** 托管根：`<configDir>/runtimes/`。configDir 可注入（测试用临时根，不动全局状态）。 */
export function runtimesRoot(configDir?: string): string {
	return configDir === undefined ? getRuntimesDir() : join(configDir, "runtimes");
}

/** 某个运行时的家目录：`<root>/<id>/`。 */
export function runtimeHome(root: string, id: string): string {
	return join(root, id);
}

/** 某一版实例的目录：`<root>/<id>/<version>/`。 */
export function instanceDir(root: string, id: string, version: string): string {
	return join(runtimeHome(root, id), version);
}

/** 安装暂存目录：`<root>/<id>/.staging-<version>-<nonce>/`（同卷改名才快且原子）。 */
export function stagingDir(root: string, id: string, version: string, nonce: string): string {
	return join(runtimeHome(root, id), `${STAGING_PREFIX}${version}-${nonce}`);
}

/**
 * 下载缓存目录：`<root>/.cache/<id>/<version>/`（纯按需下载的发行物与 `.part` 落在这里）。
 *
 * 为什么不放在 `<root>/<id>/` 下：`listInstances` 把 `<root>/<id>/` 的每个子目录都当成
 * 一个版本实例，缓存塞进去就会让诊断里多出一个叫 `.cache` 的「版本」。放在托管根的
 * 另一棵子树下，实例列举与诊断口径一个字都不用改。
 */
export function downloadCacheDir(root: string, id: string, version: string): string {
	return join(root, ".cache", id, version);
}

/** 版本指针文件：`<root>/<id>/current`。 */
export function currentPointer(root: string, id: string): string {
	return join(runtimeHome(root, id), CURRENT_POINTER_NAME);
}

/** manifest 文件路径（给定实例目录）。 */
export function manifestFile(dir: string): string {
	return join(dir, MANIFEST_NAME);
}

/** 读版本指针。文件不存在 / 空 → undefined（「没有可用实例」与「指针指向空」同义）。 */
export function readCurrent(root: string, id: string): string | undefined {
	const file = currentPointer(root, id);
	if (!existsSync(file)) return undefined;
	const value = readFileSync(file, "utf8").trim();
	return value === "" ? undefined : value;
}

/**
 * 写版本指针（原子的：先写 .tmp 再改名覆盖）。
 * 直接 writeFileSync 覆盖会在断电时留下空文件 —— 空文件读出来是 undefined，
 * 也就是「指针被抹掉」，那会把一次成功的安装变成一次「没装过」。改名是原子的替换。
 */
export function writeCurrent(root: string, id: string, version: string): void {
	const home = runtimeHome(root, id);
	mkdirSync(home, { recursive: true });
	const tmp = `${currentPointer(root, id)}.tmp`;
	writeFileSync(tmp, `${version}\n`, "utf8");
	renameSync(tmp, currentPointer(root, id));
}

/**
 * 读实例自述。文件缺失 / JSON 不可解析 / 字段不成形 → undefined（= 这一份不完整）。
 *
 * 为什么这里不抛：这是**诊断路径**的输入，用户手改坏一个 manifest 是完全可能的
 * 现实状态，诊断的职责是把它指名成「manifest 缺失或损坏」，而不是自己炸掉
 * —— 报告出不来，用户就只剩「手动删目录」这条路了。
 */
export function readManifest(dir: string): RuntimeManifest | undefined {
	const file = manifestFile(dir);
	if (!existsSync(file)) return undefined;
	try {
		const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
		if (typeof parsed !== "object" || parsed === null) return undefined;
		const record = parsed as Record<string, unknown>;
		if (
			typeof record["id"] !== "string" ||
			typeof record["version"] !== "string" ||
			typeof record["source"] !== "string" ||
			typeof record["installedAt"] !== "string" ||
			record["status"] !== "installed"
		) {
			return undefined;
		}
		return {
			id: record["id"],
			version: record["version"],
			source: record["source"],
			...(typeof record["checksum"] === "string" ? { checksum: record["checksum"] } : {}),
			installedAt: record["installedAt"],
			status: "installed",
		};
	} catch {
		return undefined;
	}
}

/** 写实例自述（覆盖写；调用方保证目录已是本次安装的落点）。 */
export function writeManifest(dir: string, manifest: RuntimeManifest): void {
	mkdirSync(dir, { recursive: true });
	writeFileSync(manifestFile(dir), `${JSON.stringify(manifest, null, "\t")}\n`, "utf8");
}

/** 这一份实例是否完整（有可解析的 manifest）。读侧判定就绪的第一半。 */
export function isCompleteInstance(dir: string): boolean {
	return readManifest(dir) !== undefined;
}

/** 改名进位：`.staging-*` → `<version>/`。同卷改名，一步原子；目标已存在会响亮失败。 */
export function promoteStaging(root: string, id: string, version: string, staging: string): string {
	const target = instanceDir(root, id, version);
	renameSync(staging, target);
	return target;
}

/** 删目录（幂等：force 让「本来就没有」不算错 —— 清理残留要能反复跑）。 */
export function removeDir(dir: string): void {
	rmSync(dir, { recursive: true, force: true });
}

function listDirs(dir: string): string[] {
	if (!existsSync(dir)) return [];
	return readdirSync(dir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name);
}

/** 已进位的实例（按版本名排序，报告可复现）。`complete` 指 manifest 是否齐。 */
export function listInstances(root: string, id: string): readonly {
	readonly version: string;
	readonly dir: string;
	readonly manifest?: RuntimeManifest;
	readonly complete: boolean;
}[] {
	return listDirs(runtimeHome(root, id))
		.filter((name) => !name.startsWith(STAGING_PREFIX))
		.sort()
		.map((version) => {
			const dir = instanceDir(root, id, version);
			const manifest = readManifest(dir);
			return { version, dir, ...(manifest === undefined ? {} : { manifest }), complete: manifest !== undefined };
		});
}

/** 上次中断留下的半成品目录名（诊断要指名，重置要清掉）。 */
export function listStaging(root: string, id: string): readonly string[] {
	return listDirs(runtimeHome(root, id))
		.filter((name) => name.startsWith(STAGING_PREFIX))
		.sort();
}

/**
 * 回滚 / 发布：把 current 切到某一版。
 *
 * 只切指针、不重新下载（spec Scenario: 版本回滚）—— 所以这里要求目标实例**已经完整**，
 * 否则响亮报错：把 current 指向一个不存在的版本，等于让「就绪」与磁盘事实分叉。
 */
export function publishCurrent(root: string, id: string, version: string): void {
	const dir = instanceDir(root, id, version);
	if (!isCompleteInstance(dir)) {
		throw new Error(
			`实例 ${dir} 不完整（缺 ${MANIFEST_NAME}），拒绝把 current 切过去 —— ` +
				"current 指向不存在的版本会让「就绪」与磁盘事实分叉。",
		);
	}
	writeCurrent(root, id, version);
}

/** 实例目录是否存在（诊断要把「已进位未发布」与「压根没装」分开说）。 */
export function instanceExists(root: string, id: string, version: string): boolean {
	const dir = instanceDir(root, id, version);
	return existsSync(dir) && statSync(dir).isDirectory();
}
