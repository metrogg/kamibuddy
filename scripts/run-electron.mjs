/**
 * electron-vite 的启动包装器。
 *
 * 为什么需要它：Electron 系的 IDE（Trae CN、VS Code、Cursor…）本身就是 Electron 应用，
 * 它们会给集成终端注入 `ELECTRON_RUN_AS_NODE=1`。这个变量一旦存在，
 * Electron 二进制就退化成普通 Node —— 没有 app、没有 BrowserWindow，
 * 症状是启动即报：
 *
 *   SyntaxError: The requested module 'electron' does not provide an export named 'BrowserWindow'
 *
 * 这个报错极具误导性，看起来像 ESM/CJS 互操作问题或构建配置错误，
 * 实际与代码无关。判据：`npx electron --version` 打印 Node 版本（如 v24.20.0）
 * 而不是 Electron 版本（如 v44.2.0），就是中招了。
 *
 * 所以所有会真正拉起 Electron 的命令（dev / preview）都走这里，
 * 在子进程环境里剔除这些变量。build 不启动 Electron，无需包装。
 *
 * 用法：node scripts/run-electron.mjs <dev|preview> [...args]
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/** IDE 注入、会干扰 Electron 正常启动的变量。 */
const POISONED = [
	"ELECTRON_RUN_AS_NODE",
	// 让 app.isPackaged 恒为 true，会走错资源路径。
	"ELECTRON_FORCE_IS_PACKAGED",
	"VSCODE_RUN_IN_ELECTRON",
	// VS Code 系注入的 Node 选项可能与 Electron 的 Node 不兼容。
	"NODE_OPTIONS",
];

const env = { ...process.env };
const removed = POISONED.filter((key) => key in env);
for (const key of removed) delete env[key];

if (removed.length > 0) {
	console.log(`[run-electron] 已剔除 IDE 注入的环境变量：${removed.join(", ")}`);
}

// 直接用 node 跑 electron-vite 的 bin 脚本，绕开 shell 引号与 .cmd 包装的差异。
//
// 不用 require.resolve("electron-vite/bin/electron-vite.js")：该包的 exports 字段
// 未暴露 bin 子路径，会报 ERR_PACKAGE_PATH_NOT_EXPORTED。走文件路径最直接。
const binPath = resolve(import.meta.dirname, "..", "node_modules", "electron-vite", "bin", "electron-vite.js");
if (!existsSync(binPath)) {
	console.error(`[run-electron] 找不到 electron-vite 的入口：${binPath}`);
	console.error("[run-electron] 请先运行 npm install。");
	process.exit(1);
}

const child = spawn(process.execPath, [binPath, ...process.argv.slice(2)], {
	env,
	stdio: "inherit",
});

child.on("exit", (code, signal) => {
	// 被信号终止时 code 为 null，用非零退出码表达失败。
	process.exit(signal !== null ? 1 : (code ?? 0));
});
