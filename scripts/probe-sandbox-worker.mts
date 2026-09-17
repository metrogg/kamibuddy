/**
 * 授权 worker 探针：证明「给工作区授写不再堵住 daemon 的主线程」。
 *
 * **为什么需要它**：2026-09-17 从事件日志定位到，首次在真实工作目录发消息时
 * `session:prompt` → `run_started` 之间空了 19,657 ms（空临时目录只有 45–423 ms），
 * 原因是那条同步的 `SetNamedSecurityInfoW` 在整棵子树上传播继承 ACE，
 * 而 daemon 是单线程 —— 这 19.6 秒里它发不出任何事件，用户看到「发送后一片白」。
 * 修法是把授权搬进 worker_thread（见 src/daemon/sandbox-prepare-protocol.ts 的文件头）。
 *
 * 单元测试只能证明协议对不对（注入假 worker），**证明不了「主线程真的没被堵」**——
 * 那要真起线程、真调 Win32。这个探针就是那一步，测三件事：
 *
 *   1. 主线程的事件循环在授权期间保持通畅（最大滞后远小于授权耗时）；
 *   2. 首次授权真的触发了传播（fastPath=false 且耗时随文件数增长）；
 *   3. 幂等快路径仍然生效（同一目录第二次是 fastPath=true，毫秒级）。
 *
 * 需要先构建（worker 是独立入口，跑的是构建产物）：
 *
 *   npm run build
 *   npx tsx scripts/probe-sandbox-worker.mts [文件数，默认 6000]
 *
 * 不碰用户目录：工作区在系统 temp 下 mkdtemp，用完删掉（ACE 随目录一起消失）。
 */

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

const { prepareSandboxInWorker } = await import("../src/daemon/sandbox-prepare-client.ts");

const FILE_COUNT = Number(process.argv[2] ?? 6000);
const WORKER_PATH = resolve("out/main/sandbox-prepare-worker.mjs");
const EXPECTED_WORKER_NAME = "sandbox-prepare-worker.mjs";

if (!existsSync(WORKER_PATH)) {
	console.error(`缺少构建产物：${WORKER_PATH}\n请先跑 npm run build`);
	process.exit(1);
}

/** 造一棵够大的树：授权耗时随条目数增长，太小了看不出「主线程被堵」。 */
function makeWorkspace(files: number): string {
	const root = mkdtempSync(join(tmpdir(), "kami-probe-acl-"));
	const DIRS = 20;
	for (let d = 0; d < DIRS; d += 1) {
		const dir = join(root, `d${d}`);
		mkdirSync(dir, { recursive: true });
	}
	for (let i = 0; i < files; i += 1) {
		writeFileSync(join(root, `d${i % DIRS}`, `f${i}.txt`), "x");
	}
	return root;
}

/**
 * 主线程事件循环的滞后监视器：每 10ms 一个节拍，记下最大偏差。
 * 授权若还在主线程上跑，这个值会跳到授权耗时那个量级。
 */
function startLagMonitor(): { stop: () => number } {
	const TICK_MS = 10;
	let last = Date.now();
	let maxLag = 0;
	const timer = setInterval(() => {
		const now = Date.now();
		maxLag = Math.max(maxLag, now - last - TICK_MS);
		last = now;
	}, TICK_MS);
	return {
		stop: () => {
			clearInterval(timer);
			return maxLag;
		},
	};
}

const workspace = makeWorkspace(FILE_COUNT);
console.log(`工作区：${workspace}（${FILE_COUNT} 个文件 + ${20} 个子目录）`);
console.log(`worker 产物：${WORKER_PATH}\n`);

/** 客户端算出来的 URL 必须是 daemon 的同目录同文件名 —— 命名契约崩了这里就要红。 */
const seenUrls: string[] = [];
const spawn = (url: URL): Worker => {
	seenUrls.push(url.href);
	const wanted = basename(fileURLToPath(url));
	if (wanted !== EXPECTED_WORKER_NAME) {
		throw new Error(`worker 命名契约不符：客户端找 ${wanted}，产物是 ${EXPECTED_WORKER_NAME}`);
	}
	return new Worker(WORKER_PATH);
};

let failed = false;

async function run(label: string): Promise<{ elapsedMs: number; fastPath: boolean; maxLag: number; entries?: number }> {
	const monitor = startLagMonitor();
	const wall = Date.now();
	const result = await prepareSandboxInWorker(
		{ workspaceDir: workspace, writableDirs: [workspace] },
		{ spawn },
	);
	const wallMs = Date.now() - wall;
	const maxLag = monitor.stop();
	console.log(
		`${label}：授权 ${result.elapsedMs} ms（fastPath=${String(result.fastPath)}，` +
			`扫描到 ${result.entries ?? "?"} 个条目）· 墙钟 ${wallMs} ms · 主线程最大滞后 ${maxLag} ms`,
	);
	return { elapsedMs: result.elapsedMs, fastPath: result.fastPath, maxLag, entries: result.entries };
}

const first = await run("第 1 次（首次，会真传播）");
const second = await run("第 2 次（幂等命中）");

console.log("\n===== 断言 =====");
if (first.fastPath) {
	console.error("✗ 首次授权就走了快路径：说明这棵树此前已被授权（换台机器/换目录再跑）");
	failed = true;
}
if (first.elapsedMs < 500) {
	console.error(`✗ 首次授权只花了 ${first.elapsedMs} ms，看不出「传播」这件事，把文件数调大再跑`);
	failed = true;
}
/*
 * 核心断言：主线程滞后必须与授权耗时脱钩。给一个宽松但有判别力的门槛 ——
 * 授权若仍在主线程上跑，滞后必然接近授权耗时（那正是 19.6 秒的来源）。
 */
if (first.maxLag > first.elapsedMs / 4) {
	console.error(
		`✗ 主线程滞后 ${first.maxLag} ms 与授权耗时 ${first.elapsedMs} ms 同量级：授权仍在主线程上`,
	);
	failed = true;
}
if (!second.fastPath) {
	console.error("✗ 第二次授权没有命中幂等快路径：ACE 复用失效了");
	failed = true;
}
if (second.elapsedMs > 200) {
	console.error(`✗ 幂等命中的第二次耗时 ${second.elapsedMs} ms，应当接近 1ms`);
	failed = true;
}

rmSync(workspace, { recursive: true, force: true });

if (failed) {
	console.error("\n探针失败");
	process.exit(1);
}
console.log(
	`\n✓ 通过：首次 ${first.elapsedMs} ms（主线程滞后仅 ${first.maxLag} ms）｜` +
		`幂等 ${second.elapsedMs} ms｜授权期间 daemon 事件循环未被打断`,
);
process.exit(0);
