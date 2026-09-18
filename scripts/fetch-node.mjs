/**
 * 拉取 node 运行时载荷到 `resources/runtimes/payload/node/<version>/`，随安装包分发。
 *
 * 为什么随包（而不是让用户机器首次使用时下载）：spec 的「随包分发三个运行时」；
 * 载荷在构建期就核过校验和，用户侧离线可用、首次使用不等下载。
 * 代价是安装包变大（解包后 ≈95 MB，实测值见 resources/runtimes/README.md）。
 *
 * 幂等与内网四条路（照 `scripts/fetch-uv.mjs` 的既有形态）：
 *   1. 载荷目录已完整（`node.exe` + `LICENSE` 都在）→ 幂等跳过；
 *      **运维手工放置解包好的目录即等价成功**，本脚本与整条 dist 链不必联网；
 *   2. `KAMIBUDDY_NODE_URL` 指向内网 HTTP 的完整 zip URL；
 *   3. nodejs.org 官方 dist（`https://nodejs.org/dist/v<ver>/<asset>`）；
 *   4. npmmirror 的 node 镜像（国内网络实测可用；**校验和照样按下面的固定值核**，
 *      镜像不是信任源，只是传输通道 —— 对不上就换下一个候选）。
 *
 * 校验（三处，都按 sha256）：
 *   - zip 整包：与脚本内固定值比对；若同时取到官方 `SHASUMS256.txt`，两者**必须一致**
 *     （固定值过期/写错时立刻红，而不是拿着错的期望值去比对下载物）；
 *   - 解包后的 `node.exe`：官方 SHASUMS256.txt 里单独给了 `win-x64/node.exe` 的 sha256，
 *     用它再断言一次 —— 比只核整包更抗「打包器换了个 zip 容器」这类差异；
 *   - 解包产物先落暂存目录，验完再改名进位（半成品不会以载荷目录的形态留在仓库里）。
 *
 * 用法：npm run fetch:node [-- --force]
 */

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { readFile, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

/** 钉死的版本：描述符（src/core/runtimes/node.ts）里是同一个值，改版本要同时改两处。 */
const VERSION = "22.23.2";
const ASSET = `node-v${VERSION}-win-x64.zip`;
const OFFICIAL_URL = `https://nodejs.org/dist/v${VERSION}/${ASSET}`;
const SHASUMS_URL = `https://nodejs.org/dist/v${VERSION}/SHASUMS256.txt`;
const MIRROR_URL = `https://registry.npmmirror.com/-/binary/node/v${VERSION}/${ASSET}`;
/** 官方 `SHASUMS256.txt` 实测值（2026-09-17 核对）。 */
const ZIP_SHA256 = "1177b4137ba5adaa56354ae40f1080c7450e8ae09cecb47da459d1c52ac99f97";
const NODE_EXE_SHA256 = "0d0f5e39f9f3d9587bc19f73eab3c2c9c4903fd02d6dbf9c853dd81b3d95fad4";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeDir = join(root, "resources", "runtimes");
const payloadDir = join(runtimeDir, "payload", "node", VERSION);
/** 载荷根的必备文件：与描述符的 NODE_REQUIRED_FILES 同一份语义（`LICENSE` 是合规义务）。 */
const REQUIRED = ["node.exe", "LICENSE"];

const log = (m) => console.log(`[fetch-node] ${m}`);
const fail = (m) => {
	console.error(`[fetch-node] ${m}`);
	process.exit(1);
};

function complete() {
	return REQUIRED.every((file) => existsSync(join(payloadDir, file)));
}

const force = process.argv.includes("--force");
if (complete() && !force) {
	log(`载荷已就绪，跳过：${payloadDir}（--force 可重拉；运维手工放置该目录即等价成功）`);
	process.exit(0);
}

/**
 * 下载并返回 Buffer。先 node fetch，失败回落 curl（Windows 10+ 自带）。
 *
 * **必须超时**：实测（2026-09-17）undici 的 fetch 在本机对 nodejs.org **长时间无响应**
 * （不是报错、是挂住），没有超时的话构建会无限等下去；加了超时它就会如约回落 curl，
 * 而 curl 同一条 URL 是通的。curl 侧另给 --max-time 兜住。
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

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex").toLowerCase();

/** 官方校验文件的辅助核对（拿不到不算失败，但拿到了就必须与固定值一致）。 */
async function crossCheckOfficial() {
	let text;
	try {
		text = (await getBytes(SHASUMS_URL)).toString("utf8");
	} catch (error) {
		log(`未取到官方 SHASUMS256.txt（${error instanceof Error ? error.message : String(error)}）—— 仅按脚本内固定值校验`);
		return;
	}
	const line = (name) => text.split("\n").find((row) => row.trim().endsWith(` ${name}`))?.split(/\s+/)[0];
	if (line(ASSET) !== ZIP_SHA256) {
		fail(`官方 SHASUMS256.txt 里的 ${ASSET} sha256 与脚本内固定值不一致（官方 ${line(ASSET) ?? "缺"} / 固定 ${ZIP_SHA256}）`);
	}
	if (line(`win-x64/node.exe`) !== NODE_EXE_SHA256) {
		fail(`官方 SHASUMS256.txt 里的 win-x64/node.exe sha256 与脚本内固定值不一致（官方 ${line("win-x64/node.exe") ?? "缺"} / 固定 ${NODE_EXE_SHA256}）`);
	}
	log("官方 SHASUMS256.txt 与脚本内固定值一致（整包 + node.exe 两条）");
}

const candidates = [process.env.KAMIBUDDY_NODE_URL, OFFICIAL_URL, MIRROR_URL].filter(Boolean);
let zipBuffer;
let usedUrl;
for (const url of candidates) {
	try {
		log(`尝试 ${url}`);
		const buffer = await getBytes(url);
		if (buffer.length < 20 * 1024 * 1024) throw new Error(`体积异常（${buffer.length}B），不像 ${ASSET}`);
		const actual = sha256(buffer);
		if (actual !== ZIP_SHA256) throw new Error(`sha256 不符（期望 ${ZIP_SHA256}，实际 ${actual}）`);
		zipBuffer = buffer;
		usedUrl = url;
		break;
	} catch (error) {
		log(`失败：${error instanceof Error ? error.message : String(error)}`);
	}
}
if (zipBuffer === undefined) {
	log("全部候选失败。三条出路：");
	log(`  1. 配 KAMIBUDDY_NODE_URL 指向内网 HTTP 的 ${ASSET} 后重跑；`);
	log(`  2. 手工把解包好的 node ${VERSION}（windows x64）目录放到 ${payloadDir}`);
	log("  3. 换一个能到 nodejs.org / npmmirror 的网络后重跑");
	process.exit(1);
}
await crossCheckOfficial();

// 解包到暂存目录：验完再改名进位（与托管运行时的安装同一纪律：崩在中途不留半成品）。
rmSync(payloadDir, { recursive: true, force: true });
const staging = join(runtimeDir, ".cache", `staging-node-${process.pid.toString(36)}`);
rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });

const zip = await JSZip.loadAsync(zipBuffer);
const names = Object.keys(zip.files);
const top = names[0]?.split("/")[0];
if (top === undefined || !names.includes(`${top}/node.exe`)) {
	fail(`zip 里没有 ${top ?? "?"}/node.exe（内容物前几项：${names.slice(0, 5).join(", ")}）`);
}
log(`解包 ${top}/ → ${staging}`);
for (const [name, entry] of Object.entries(zip.files)) {
	if (!name.startsWith(`${top}/`)) continue;
	const relative = name.slice(top.length + 1);
	if (relative === "") continue;
	const target = join(staging, relative);
	if (entry.dir) {
		mkdirSync(target, { recursive: true });
		continue;
	}
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, await entry.async("nodebuffer"));
}

const exeBytes = await readFile(join(staging, "node.exe"));
const exeSha = sha256(exeBytes);
if (exeSha !== NODE_EXE_SHA256) {
	rmSync(staging, { recursive: true, force: true });
	fail(`解包后的 node.exe sha256 不符（期望 ${NODE_EXE_SHA256}，实际 ${exeSha}）—— 载荷已丢弃，请重跑`);
}
for (const file of REQUIRED) {
	if (!existsSync(join(staging, file))) {
		rmSync(staging, { recursive: true, force: true });
		fail(`解包结果缺 ${file} —— 载荷已丢弃（许可文本是随包分发的硬义务，不许缺）`);
	}
}

writeFileSync(
	join(staging, "payload.json"),
	`${JSON.stringify(
		{
			id: "node",
			version: VERSION,
			artifact: ASSET,
			source: usedUrl,
			sha256: ZIP_SHA256,
			fetchedAt: new Date().toISOString(),
			fetchedBy: "scripts/fetch-node.mjs",
		},
		null,
		"\t",
	)}\n`,
);
mkdirSync(dirname(payloadDir), { recursive: true });
rmSync(payloadDir, { recursive: true, force: true });
await rename(staging, payloadDir);
log(`完成：${payloadDir}（node ${VERSION}，zip sha256 与 node.exe sha256 均已校验）`);
