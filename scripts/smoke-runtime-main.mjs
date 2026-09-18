/**
 * 真运行时冒烟 · Electron 主进程侧：起一个 utilityProcess 跑 smoke-runtime-child。
 *
 * 为什么是 utilityProcess 而不是主进程：daemon 就跑在 utilityProcess 里，两者是
 * **不同环境**（process.type 一个 "utility" 一个 "browser"），而这正是出事故的那
 * 一层差异。在主进程里跑这份冒烟等于白跑（见 child 文件头注释）。
 *
 * 子进程用 `execArgv: ["--import", "tsx"]` 挂上 tsx，才能直接 import 仓库里的 .ts
 * 源码（与 dev 走同一份代码，不必先 build）。
 *
 * 用法：由 scripts/smoke-runtime.mjs 拉起（它负责剔除 IDE 注入的环境变量）。
 */

import { fork } from "node:child_process";
import { app, utilityProcess } from "electron";

const childEntry = new URL("./smoke-runtime-child.mjs", import.meta.url).pathname;

app.whenReady().then(() => {
	const child = utilityProcess.fork(decodeURIComponent(childEntry).replace(/^\//, ""), [], {
		execArgv: ["--import", "tsx"],
		stdio: "pipe",
		serviceName: "kamibuddy-smoke-runtime",
	});

	child.stdout?.on("data", (chunk) => process.stdout.write(String(chunk)));
	child.stderr?.on("data", (chunk) => process.stderr.write(String(chunk)));

	let failed = 1;
	child.on("message", (frame) => {
		if (typeof frame === "object" && frame !== null && "failed" in frame) {
			failed = Number(frame.failed) || 0;
		}
	});
	child.on("exit", (code) => {
		// 子进程的退出码是权威结论；消息只是冗余信号（避免任何一侧静默）。
		app.exit(code === 0 && failed === 0 ? 0 : 1);
	});
});
