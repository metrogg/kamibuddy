/**
 * 拉取并**构建期解包** gitbash 运行时载荷到
 * `resources/runtimes/payload/gitbash/<version>/`，随安装包分发。
 *
 * ── 为什么解包只能在构建期做（这是本脚本存在的理由，也是本轮最要紧的取舍）──
 * 上游发行物 `PortableGit-<ver>-64-bit.7z.exe` 是 **7z 自解压**，而仓库现有 jszip 解不了 7z。
 * 三条路各自的代价：
 *   1. 运行期解包 ⇒ 得把 7z 解压器塞进产物。7-Zip 是 **LGPL + unRAR 限制**，
 *      随产物分发即把限制带进我们的分发物（unRAR 那条还与我们无关却要一起背）。
 *   2. 换发行物（MinGit 是 zip）⇒ **MinGit 不含 bash.exe**（官方称 non-interactive 分发），
 *      拿它当 gitbash 运行时就是名不副实。详见 docs/运行时来源与许可.md。
 *   3. **构建期解包、随包分发解包结果**（本脚本）⇒ 7-Zip 只在构建机上出现一次、
 *      **不进产物**；产物里只有解包后的普通文件树，运行期只做「复制 + 探针」。
 * 选 3。代价是安装包变大（解包后实测 9584 文件 / 389.1 MB），换来的是离线可用、
 * 首次使用不等下载、以及 7-Zip 的许可不落到我们的分发物上。
 *
 * 解包器两条路，都不进产物：优先 `KAMIBUDDY_7Z` 指定的 / PATH 上的 7z 家族 CLI，
 * 退回**发行物自带的 SFX 解包器**（`<artifact> -y -o<dir>`，本机实测可用，33s 解完）。
 *
 * 校验：发行物 sha256 与脚本内固定值比对，并尽量与 GitHub Release API 的 asset `digest`
 * 交叉核对；解包后断言必备文件（`usr/bin/bash.exe` 与根 `LICENSE.txt`）与文件数下限，
 * 最后按「暂存目录 → 改名进位」写入载荷目录（半成品不会以载荷目录的形态留下）。
 *
 * 合规：解包结果里**不得删任何许可文本**（根 `LICENSE.txt` + `mingw64/share/licenses/**`）；
 * 本脚本额外把 `resources/runtimes/gitbash/CORRESPONDING-SOURCE.md`（GPLv2 §3 的源码获取
 * 方式，我们自己写的书面说明）拷进载荷根，让义务**随二进制一起走**（安装时整树复制，
 * 于是托管根里那份也带着它）。
 *
 * 用法：npm run fetch:gitbash [-- --force]
 */

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, copyFileSync, statSync, writeFileSync } from "node:fs";
import { readFile, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** 钉死的发行版：与描述符（src/core/runtimes/gitbash.ts）里的 GITBASH_RUNTIME_VERSION 一致。 */
const VERSION = "2.55.0.5";
const TAG = "v2.55.0.windows.5";
const ASSET = `PortableGit-${VERSION}-64-bit.7z.exe`;
const OFFICIAL_URL = `https://github.com/git-for-windows/git/releases/download/${TAG}/${ASSET}`;
const MIRROR_URL = `https://registry.npmmirror.com/-/binary/git-for-windows/${TAG}/${ASSET}`;
const API_URL = `https://api.github.com/repos/git-for-windows/git/releases/tags/${TAG}`;
/** GitHub Release asset digest 实测值（2026-09-17 核对）。 */
const ASSET_SHA256 = "5aa8a20f6e9abb2c755f0e73c91c687701a46b309ad84a0ca6509380fa4ae290";
/** 载荷根的必备文件：bash 入口 + 根许可文本（与描述符的 GITBASH_REQUIRED_FILES 同义）。 */
const REQUIRED = [join("usr", "bin", "bash.exe"), "LICENSE.txt"];
/** 文件数下限：解包半途中断/被截断时远低于此（实测 9584），用来把「解了个空壳」变响亮。 */
const MIN_FILES = 5000;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeDir = join(root, "resources", "runtimes");
const payloadDir = join(runtimeDir, "payload", "gitbash", VERSION);
const cacheDir = join(runtimeDir, ".cache");
const artifact = join(cacheDir, ASSET);
const sourceOffer = join(runtimeDir, "gitbash", "CORRESPONDING-SOURCE.md");

const log = (m) => console.log(`[fetch-gitbash] ${m}`);
const fail = (m) => {
	console.error(`[fetch-gitbash] ${m}`);
	process.exit(1);
};

const complete = () => REQUIRED.every((file) => existsSync(join(payloadDir, file)));
const force = process.argv.includes("--force");
if (complete() && !force) {
	log(`载荷已就绪，跳过：${payloadDir}（--force 可重拉；运维手工放置该目录即等价成功）`);
	process.exit(0);
}
if (!existsSync(sourceOffer)) {
	fail(`缺少 ${sourceOffer}（GPLv2 §3 的对应源码获取方式必须随包，不许省）`);
}

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex").toLowerCase();

/**
 * 下载并返回 Buffer。先 node fetch，失败回落 curl（Windows 10+ 自带）。
 * 同 `scripts/fetch-node.mjs`：fetch 必须带超时（实测 undici 在本机对部分站点会**挂住**
 * 而不是报错），否则构建会无限等；超时后如约回落 curl。
 */
async function getBytes(url) {
	try {
		const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(600_000) });
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		return Buffer.from(await response.arrayBuffer());
	} catch (error) {
		log(`fetch 失败（${error instanceof Error ? error.message : String(error)}），回落 curl`);
		return await new Promise((resolve, reject) => {
			execFile(
				"curl",
				["-sL", "--max-time", "900", url],
				{ encoding: "buffer", maxBuffer: 256 * 1024 * 1024 },
				(error2, stdout) => {
					if (error2 !== undefined) reject(error2);
					else resolve(stdout);
				},
			);
		});
	}
}

/* ── 1. 取发行物（缓存优先，其次按候选顺序下载并核 sha256）────────── */

mkdirSync(cacheDir, { recursive: true });
let artifactPresent = existsSync(artifact);
if (artifactPresent) {
	const actual = sha256(await readFile(artifact));
	if (actual === ASSET_SHA256) {
		log(`复用缓存：${artifact}（sha256 已核对）`);
	} else {
		log(`缓存 sha256 不符（${actual}），重新下载`);
		rmSync(artifact, { force: true });
		artifactPresent = false;
	}
}

async function crossCheckApi() {
	try {
		const release = JSON.parse((await getBytes(API_URL)).toString("utf8"));
		const assetInfo = release.assets?.find((item) => item.name === ASSET);
		const digest = assetInfo?.digest;
		if (digest === undefined) {
			log("GitHub API 未给该 asset 的 digest 字段 —— 仅按脚本内固定值校验");
			return;
		}
		if (digest !== `sha256:${ASSET_SHA256}`) {
			fail(`GitHub API 的 asset digest 与脚本内固定值不一致（API ${digest} / 固定 sha256:${ASSET_SHA256}）`);
		}
		log("GitHub API 的 asset digest 与脚本内固定值一致");
	} catch (error) {
		log(`未取到 GitHub API 的 digest（${error instanceof Error ? error.message : String(error)}）—— 仅按脚本内固定值校验`);
	}
}

if (!artifactPresent) {
	await crossCheckApi();
	const candidates = [process.env.KAMIBUDDY_GITBASH_URL, OFFICIAL_URL, MIRROR_URL].filter(Boolean);
	for (const url of candidates) {
		try {
			log(`尝试 ${url}`);
			const buffer = await getBytes(url);
			if (buffer.length < 40 * 1024 * 1024) throw new Error(`体积异常（${buffer.length}B），不像 ${ASSET}`);
			const actual = sha256(buffer);
			if (actual !== ASSET_SHA256) throw new Error(`sha256 不符（期望 ${ASSET_SHA256}，实际 ${actual}）`);
			writeFileSync(artifact, buffer);
			artifactPresent = true;
			log(`已缓存发行物：${artifact}`);
			break;
		} catch (error) {
			log(`失败：${error instanceof Error ? error.message : String(error)}`);
		}
	}
}
if (!artifactPresent) {
	log("全部候选失败。三条出路：");
	log(`  1. 配 KAMIBUDDY_GITBASH_URL 指向内网 HTTP 的 ${ASSET} 后重跑；`);
	log(`  2. 手工把发行物放到 ${artifact}（sha256 必须等于 ${ASSET_SHA256}）后重跑；`);
	log(`  3. 手工把解包好的目录放到 ${payloadDir}（必备文件：${REQUIRED.join(" / ")}）`);
	process.exit(1);
}

/* ── 2. 构建期解包（7z CLI 优先，退回发行物自带的 SFX）─────────────── */

const staging = join(cacheDir, `staging-gitbash-${process.pid.toString(36)}`);
rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });

function run(command, args) {
	return new Promise((resolve) => {
		execFile(command, args, { maxBuffer: 32 * 1024 * 1024 }, (error) => {
			resolve(error === null ? { ok: true } : { ok: false, message: error.message });
		});
	});
}

const sevenZip = process.env.KAMIBUDDY_7Z ?? "7z";
const extractors = [
	{ label: `7-Zip CLI（${sevenZip}）`, command: sevenZip, args: ["x", artifact, `-o${staging}`, "-y"] },
	{ label: "发行物自带的 SFX 解包器", command: artifact, args: ["-y", `-o${staging}`] },
];
let extracted = false;
for (const extractor of extractors) {
	log(`解包（${extractor.label}）→ ${staging}`);
	const result = await run(extractor.command, extractor.args);
	if (result.ok) {
		extracted = true;
		break;
	}
	log(`失败：${result.message}`);
}
if (!extracted) {
	log("解包器都不可用。两条出路：");
	log("  1. 装 7-Zip 后重跑，或用 KAMIBUDDY_7Z 指向 7z.exe；");
	log("  2. 直接用 7-Zip 手工解包发行物，把结果放到 " + payloadDir);
	process.exit(1);
}

/* ── 3. 解包后断言（必备文件 + 文件数下限）────────────────────────── */

let files = 0;
function countFiles(dir) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.isDirectory()) countFiles(join(dir, entry.name));
		else files += 1;
	}
}
countFiles(staging);
for (const file of REQUIRED) {
	if (!existsSync(join(staging, file))) {
		rmSync(staging, { recursive: true, force: true });
		fail(`解包结果缺 ${file}（实测该版本应含 ${REQUIRED.join(" 与 ")}）—— 载荷已丢弃，请核对发行物版本`);
	}
}
if (files < MIN_FILES) {
	rmSync(staging, { recursive: true, force: true });
	fail(`解包结果只有 ${files} 个文件（少于下限 ${MIN_FILES}）—— 疑似解包中断/被截断，载荷已丢弃`);
}
const licenses = readdirSync(staging).filter((name) => /^license/i.test(name));
if (licenses.length === 0) {
	rmSync(staging, { recursive: true, force: true });
	fail("解包结果根层没有任何 LICENSE* 文件 —— 许可文本是 GPLv2 的随包硬义务，不许缺（载荷已丢弃）");
}
let bytes = 0;
function sumBytes(dir) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const target = join(dir, entry.name);
		if (entry.isDirectory()) sumBytes(target);
		else bytes += statSync(target).size;
	}
}
sumBytes(staging);
log(`解包完成：${files} 个文件 / ${(bytes / 1024 / 1024).toFixed(1)} MB；根层许可文本：${licenses.join("、")}`);

// 义务随二进制走：GPLv2 §3 的源码获取方式与发行物一起分发（安装时整树复制）。
copyFileSync(sourceOffer, join(staging, "CORRESPONDING-SOURCE.md"));
writeFileSync(
	join(staging, "payload.json"),
	`${JSON.stringify(
		{
			id: "gitbash",
			version: VERSION,
			artifact: ASSET,
			source: OFFICIAL_URL,
			sha256: ASSET_SHA256,
			fetchedAt: new Date().toISOString(),
			fetchedBy: "scripts/fetch-gitbash.mjs",
			files,
		},
		null,
		"\t",
	)}\n`,
);

mkdirSync(dirname(payloadDir), { recursive: true });
rmSync(payloadDir, { recursive: true, force: true });
await rename(staging, payloadDir);
log(`完成：${payloadDir}（Git for Windows ${VERSION}，发行物 sha256 已校验、解包产物已断言）`);
log(`发行物仍缓存在 ${artifact}（.cache/ 已被 .gitignore 忽略，可随时删；不发随包分发物）`);
