/**
 * 真运行时冒烟：在 Electron utilityProcess（= daemon 的真实运行时）里跑关键库链路。
 *
 * 与其它 smoke 的根本区别：那些跑在纯 Node（tsx），本脚本跑在**交付环境**里。
 * 「测试环境 ≠ 运行环境」这一类问题（pdfjs 的 Electron 嗅探事故，2026-09-17）
 * 只有这一层能拦住。
 *
 * 用法：npm run smoke:runtime
 */

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/** IDE 注入、会干扰 Electron 正常启动的变量（同 run-electron.mjs，理由见该文件头注）。 */
const POISONED = [
	"ELECTRON_RUN_AS_NODE",
	"ELECTRON_FORCE_IS_PACKAGED",
	"VSCODE_RUN_IN_ELECTRON",
	"NODE_OPTIONS",
];

const env = { ...process.env };
const removed = POISONED.filter((key) => key in env);
for (const key of removed) delete env[key];
if (removed.length > 0) {
	console.log(`[smoke:runtime] 已剔除 IDE 注入的环境变量：${removed.join(", ")}`);
}

// electron 包的入口导出的就是二进制路径字符串（getElectronPath 的既有约定）。
const require = createRequire(import.meta.url);
const electronBinary = require("electron");
if (typeof electronBinary !== "string" || !existsSync(electronBinary)) {
	console.error("[smoke:runtime] 找不到 electron 二进制，请先 npm install。");
	process.exit(1);
}

const mainEntry = resolve(import.meta.dirname, "smoke-runtime-main.mjs");
const child = spawn(electronBinary, [mainEntry], { env, stdio: "inherit" });

child.on("exit", (code) => {
	process.exit(code ?? 1);
});
child.on("error", (error) => {
	console.error(`[smoke:runtime] 启动 Electron 失败：${error.message}`);
	process.exit(1);
});
