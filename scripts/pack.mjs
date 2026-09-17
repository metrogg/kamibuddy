/**
 * 打包编排：镜像 env → electron-vite build → electron-builder。
 *
 * 为什么不直接 `npm run build && electron-builder`：
 *   - 镜像 env 要「缺省才注入」（ELECTRON_MIRROR / ELECTRON_BUILDER_BINARIES_MIRROR
 *     首次打包要下载 electron zip 与 NSIS 工具链，内网慢是实测风险；已手工配置的
 *     值必须尊重，不覆盖）；
 *   - resources/bin/uv.exe 缺失要在打包前 fail-fast（否则出的是「docx 永远转不了」
 *     的哑包，根因被推迟到同事机器上才暴露）。
 *
 * 产物：
 *   node scripts/pack.mjs --dir   → release/win-unpacked/（免安装目录，快速冒烟）
 *   node scripts/pack.mjs         → release/JLC-Work-Setup-<ver>.exe（NSIS，配置见 electron-builder.yml）
 *
 * bin 直调 node 文件而非 .cmd 包装（同 run-electron.mjs 的理由：绕开 shell
 * 寻找与参数转义）；build 不启动 Electron，无需剔除 IDE 注入的 ELECTRON_* 变量。
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const log = (m) => console.log(`[pack] ${m}`);

/* ── ① 镜像 env：缺省才注入（npmmirror；已设值尊重用户自己的配置）────── */

const MIRRORS = {
	ELECTRON_MIRROR: "https://npmmirror.com/mirrors/electron/",
	ELECTRON_BUILDER_BINARIES_MIRROR: "https://npmmirror.com/mirrors/electron-builder-binaries/",
};
for (const [key, value] of Object.entries(MIRRORS)) {
	if (process.env[key] === undefined || process.env[key] === "") {
		process.env[key] = value;
		log(`${key} = ${value}（缺省注入）`);
	} else {
		log(`${key} = ${process.env[key]}（已有配置，不覆盖）`);
	}
}

/* ── ② uv 前置检查（--skip-uv 可跳，仅调试打包链用）──────────────────── */

const uvPath = join(root, "resources", "bin", "uv.exe");
if (process.argv.includes("--skip-uv")) {
	log("跳过 uv 检查（--skip-uv）");
} else if (!existsSync(uvPath)) {
	log(`缺少 ${uvPath}`);
	log("  npm run fetch:uv        （联网拉取）");
	log("  或手工放置 uv.exe 到该路径（内网；uv 的 windows x86_64 构建）");
	process.exit(1);
} else {
	log(`uv 就绪：${uvPath}`);
}

/* ── ③④ 依次构建 ─────────────────────────────────────────────────────── */

/** node 直调 bin 文件，inherit 输出；非 0 退出即终止整条链。 */
function run(label, binPath, args) {
	return new Promise((resolveStep, rejectStep) => {
		log(`${label}：${args.join(" ") || "(无参数)"}`);
		const child = spawn(process.execPath, [binPath, ...args], {
			cwd: root,
			stdio: "inherit",
		});
		child.on("exit", (code) => {
			if (code === 0) resolveStep();
			else rejectStep(new Error(`${label} 退出码 ${code}`));
		});
		child.on("error", rejectStep);
	});
}

const steps = [
	["electron-vite build", join(root, "node_modules", "electron-vite", "bin", "electron-vite.js"), ["build"], 0],
	[
		"electron-builder",
		join(root, "node_modules", "electron-builder", "cli.js"),
		process.argv.includes("--dir") ? ["--dir", "--publish", "never"] : ["--publish", "never"],
		// 终态 rename（win-unpacked.tmp → win-unpacked）会被 AV 实时扫描的瞬时句柄
		// 顶成 EPERM（2026-09-17 本机实测，约半数构建命中）——自动重试两次。
		2,
	],
];

for (const [label, binPath, args, retries] of steps) {
	let lastError;
	for (let attempt = 0; attempt <= retries; attempt++) {
		if (attempt > 0) {
			log(`${label} 第 ${attempt} 次重试（此前失败：${lastError instanceof Error ? lastError.message : String(lastError)}）`);
			await new Promise((done) => setTimeout(done, 5_000));
		}
		try {
			await run(label, binPath, args);
			lastError = undefined;
			break;
		} catch (error) {
			lastError = error;
		}
	}
	if (lastError !== undefined) {
		log(`失败：${lastError instanceof Error ? lastError.message : String(lastError)}`);
		process.exit(1);
	}
}
log("打包完成");
