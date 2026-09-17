/**
 * 拉取 uv.exe（docx 引擎的 Python 管理器）到 resources/bin/，随安装包分发。
 *
 * 为什么随包带 uv：docx-env 的 uv 探测只认 PATH 与 ~/.local/bin（src/documents/
 * docx-env.ts uvCandidates），同事机器不会有 uv——main 起 daemon 时把
 * resources/bin 前置进 PATH（src/main/index.ts daemonEnv），裸 "uv" 候选即命中。
 *
 * 内网三条路（按序）：
 *   1. resources/bin/uv.exe 已存在 → 幂等跳过。**运维手工放置该文件即等价成功**，
 *      本脚本与整条 dist 链不必联网；
 *   2. KAMIBUDDY_UV_URL 指向内网 HTTP 的完整 zip URL；
 *   3. GitHub release（实测本机可达；npmmirror 无 uv 二进制镜像，
 *      /-/binary/uv 返回 NOT_FOUND，别再往镜像上猜）。
 *
 * 校验：同时拉官方 .sha256 对照（内网覆盖 URL 没有 .sha256 时降级为警告不阻断）。
 *
 * 用法：npm run fetch:uv [-- --force]
 */

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { writeFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const UV_VERSION = "0.12.15"; // 实现时钉死的稳定版（GitHub latest 实测）；升级改这里
const ASSET = "uv-x86_64-pc-windows-msvc.zip";
const GITHUB_URL = `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/${ASSET}`;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const binDir = join(root, "resources", "bin");
const target = join(binDir, "uv.exe");

const log = (m) => console.log(`[fetch-uv] ${m}`);

if (process.argv.includes("--force")) {
	await rm(target, { force: true });
}

if (existsSync(target)) {
	log(`已存在，跳过：${target}（--force 可重拉；内网也可直接手工放置该文件）`);
	process.exit(0);
}

const candidates = [process.env.KAMIBUDDY_UV_URL, GITHUB_URL].filter(Boolean);

/**
 * 下载并返回 Buffer；带大小下限防「错误页存成了 zip」。
 * 先 node fetch，失败回落 curl（Windows 10+ 自带；实测部分内网对 undici 的
 * TLS 握手不通而 curl 可达，见 2026-09-17 本机实测）。
 */
async function getBytes(url) {
	try {
		const response = await fetch(url, { redirect: "follow" });
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		return Buffer.from(await response.arrayBuffer());
	} catch (error) {
		log(`fetch 失败（${error instanceof Error ? error.message : String(error)}），回落 curl`);
		return await new Promise((resolve, reject) => {
			execFile("curl", ["-sL", "--max-time", "540", url], { encoding: "buffer", maxBuffer: 128 * 1024 * 1024 }, (error2, stdout) => {
				if (error2 !== undefined) reject(error2);
				else resolve(stdout);
			});
		});
	}
}

async function download(url) {
	log(`尝试 ${url}`);
	const buffer = await getBytes(url);
	if (buffer.length < 1_000_000) throw new Error(`体积异常（${buffer.length}B），不像 ${ASSET}`);
	return buffer;
}

async function sha256OfUrl(base) {
	try {
		const text = (await getBytes(`${base}.sha256`)).toString("utf8").trim().split(/\s+/)[0];
		return /^[0-9a-f]{64}$/i.test(text) ? text.toLowerCase() : undefined;
	} catch {
		return undefined;
	}
}

let zipBuffer;
let usedUrl;
let shaExpected;
let shaChecked = false;
for (const url of candidates) {
	try {
		zipBuffer = await download(url);
		usedUrl = url;
		shaExpected = await sha256OfUrl(url);
		if (shaExpected !== undefined) {
			const actual = createHash("sha256").update(zipBuffer).digest("hex").toLowerCase();
			if (actual !== shaExpected) throw new Error(`sha256 不符（期望 ${shaExpected}，实际 ${actual}）`);
			shaChecked = true;
		}
		break;
	} catch (error) {
		log(`失败：${error instanceof Error ? error.message : String(error)}`);
	}
}

if (zipBuffer === undefined) {
	log("全部候选失败。两条出路：");
	log(`  1. 配 KAMIBUDDY_UV_URL 指向内网 HTTP 的 ${ASSET} 后重跑；`);
	log(`  2. 手工把 uv.exe（uv ${UV_VERSION} 的 windows x86_64 构建）放到 ${target}`);
	process.exit(1);
}

const zip = await JSZip.loadAsync(zipBuffer);
const exeEntry = zip.file("uv.exe");
if (exeEntry === null) {
	log(`zip 里没有 uv.exe（内容物：${Object.keys(zip.files).join(", ")}）`);
	process.exit(1);
}
mkdirSync(binDir, { recursive: true });
await writeFile(target, await exeEntry.async("nodebuffer"));
await rm(join(binDir, "uvx.exe"), { force: true }); // 上一版脚本若解过 uvx，清掉（不需要）
writeFileSync(
	join(binDir, "README.md"),
	`uv.exe ${UV_VERSION}（${ASSET}）\n来源：${usedUrl}\n由 scripts/fetch-uv.mjs 拉取${shaChecked ? "，sha256 已校验" : "，sha256 未校验（来源未提供）"}。\n随安装包分发；重拉：npm run fetch:uv -- --force。\n`,
);
log(`完成：${target}（uv ${UV_VERSION}${shaChecked ? "，sha256 已校验" : ""}）`);
