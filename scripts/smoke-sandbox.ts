/**
 * 沙箱冒烟：在**真实 Electron utilityProcess** 里跑生产沙箱代码。
 *
 * 为什么必须有这一条（2026-09-15 的教训）：`src/sandbox/` 的单测与集成测试都在
 * vitest 里跑，而 vitest 是终端进程 —— **有控制台**。daemon 跑在 utilityProcess
 * 里（GUI 子系统，无控制台），受限令牌下的行为可能不同。那次
 * `0xC0000142`（PowerShell 死在 DLL 初始化）在终端里 10/10 全过、在应用里
 * 每条命令都失败，就是这个差异造成的。dsh README 把「console isolation 不可用」
 * 列为已知边界，正是同一现象的另一面。
 *
 * 所以这条冒烟的价值不在断言多严，而在**进程类型与生产一致**。
 *
 * 用法：
 *   npm run smoke:sandbox                    # 用临时目录当工作区
 *   npm run smoke:sandbox -- "<工作区路径>"   # 用真实工作区（只读它的 ACL，不删它）
 *
 * 非 Windows 上直接跳过并退出 0（受限令牌是 Windows 特有机制）。
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

/*
 * --diagnose 换成诊断子进程：跑变量矩阵（档位 × lpDesktop × 默认 DACL）
 * 并打印窗口站/桌面/控制台等环境事实。
 *
 * 存在的理由：`0xC0000142` 只在某些启动环境下出现 —— 同一台机器、同一份代码，
 * 从 VS Code 派生的 shell 跑 9/9 通过，从独立 PowerShell 跑则失败。
 * 在**故障不出现的环境**里做对照什么都证明不了（本轮已因此误判过两次根因），
 * 所以把矩阵搬到能复现的那台机器上跑。
 */
const DIAGNOSE = process.argv.includes("--diagnose");
/** 传给子进程的参数：滤掉自己的开关，剩下的（如工作区路径）转发。 */
const CHILD_ARGS = process.argv.slice(2).filter((arg) => arg !== "--diagnose");
/*
 * 产物必须落在**项目树内**（这里放 node_modules/.cache/）。
 *
 * 不能放系统 temp：koffi 是 external，打包后的 bundle 在运行时执行
 * `import("koffi")`，Node 会从**该文件所在位置**向上找 node_modules ——
 * 从 temp 目录找不到，报 `Cannot find package 'koffi'`（踩过）。
 * 放 node_modules 下则解析必然成功，且天然被 .gitignore 忽略。
 */
const WORK_DIR = join(ROOT, "node_modules", ".cache", `kamibuddy-smoke-sandbox-${process.pid}`);
const CHILD_TS = join(
	ROOT,
	"scripts",
	DIAGNOSE ? "sandbox-diagnose-child.ts" : "sandbox-smoke-child.ts",
);
const CHILD_BUNDLE = join(WORK_DIR, "child.mjs");
const HOST_JS = join(WORK_DIR, "host.mjs");

if (process.platform !== "win32") {
	console.log(`跳过：受限令牌沙箱是 Windows 特有机制（当前 ${process.platform}）`);
	process.exit(0);
}

/*
 * 宿主脚本必须是运行期生成的独立文件：electron 要一个入口路径，
 * 而它得能 fork 子 bundle。内容很短，就地写出比多留一个源文件清楚。
 */
const HOST_SOURCE = `
import { app, utilityProcess } from "electron";

app.whenReady().then(() => {
	const child = utilityProcess.fork(${JSON.stringify(CHILD_BUNDLE)}, process.argv.slice(2), {
		stdio: "pipe",
		serviceName: "kamibuddy-smoke-sandbox",
	});
	let settled = false;
	const finish = (code) => {
		if (settled) return;
		settled = true;
		app.exit(code);
	};
	// 自检会真跑 PowerShell（冷启动约 0.7 秒），加上首次 ACL 授权，给足余量。
	const timer = setTimeout(() => {
		console.log("FAIL  子进程 120 秒内没有返回结果");
		finish(1);
	}, 120_000);
	child.stdout?.on("data", (d) => process.stdout.write(String(d)));
	child.stderr?.on("data", (d) => process.stderr.write(String(d)));
	child.on("message", (msg) => {
		clearTimeout(timer);
		let failed = 0;
		for (const r of msg?.results ?? []) {
			console.log(\`\${r.ok ? "PASS" : "FAIL"}  \${r.name}\`);
			console.log(\`      \${String(r.detail).split("\\n").join("\\n      ")}\`);
			if (!r.ok) failed += 1;
		}
		const total = (msg?.results ?? []).length;
		console.log("");
		console.log(failed === 0 ? \`\${total}/\${total} 通过\` : \`\${total - failed}/\${total} 通过，\${failed} 项失败\`);
		finish(failed === 0 ? 0 : 1);
	});
	child.on("exit", (code) => {
		if (settled) return;
		clearTimeout(timer);
		console.log(\`FAIL  子进程提前退出，code \${code}\`);
		finish(1);
	});
});
`;

/** 跑一个命令，继承 stdio；返回退出码。 */
function run(command: string, args: readonly string[], env?: Record<string, string>): Promise<number> {
	return new Promise((resolveCode, reject) => {
		const child = spawn(command, [...args], {
			cwd: ROOT,
			stdio: "inherit",
			shell: false,
			...(env === undefined ? {} : { env }),
		});
		child.on("error", reject);
		child.on("close", (code) => resolveCode(code ?? 1));
	});
}

async function main(): Promise<number> {
	if (!existsSync(CHILD_TS)) {
		console.error(`找不到子进程源码：${CHILD_TS}`);
		return 1;
	}
	mkdirSync(WORK_DIR, { recursive: true });
	writeFileSync(HOST_JS, HOST_SOURCE, "utf8");

	/*
	 * koffi 保持 external：原生模块不能打进 bundle（打进去运行期加载会失败）。
	 *
	 * 直接用 node 跑 esbuild 的 bin 脚本，不走 .bin/esbuild.cmd ——
	 * 新版 Node 拒绝以 shell:false spawn `.cmd`（EINVAL）。
	 * 同 scripts/run-electron.mjs 绕开 .cmd 的做法。
	 */
	const esbuildBin = join(ROOT, "node_modules", "esbuild", "bin", "esbuild");
	if (!existsSync(esbuildBin)) {
		console.error(`找不到 esbuild：${esbuildBin}（先跑 npm install）`);
		return 1;
	}
	const bundled = await run(process.execPath, [
		esbuildBin,
		CHILD_TS,
		"--bundle",
		"--platform=node",
		"--format=esm",
		"--external:koffi",
		`--outfile=${CHILD_BUNDLE}`,
		"--log-level=warning",
	]);
	if (bundled !== 0) {
		console.error("打包子进程失败");
		return bundled;
	}

	/*
	 * 剔除 IDE 注入的变量（同 scripts/run-electron.mjs 的理由）：
	 * ELECTRON_RUN_AS_NODE=1 会让 electron 退化成普通 Node，
	 * 于是 utilityProcess 根本不存在 —— 而报错极具误导性。
	 */
	const env: Record<string, string> = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (value === undefined) continue;
		if (
			key === "ELECTRON_RUN_AS_NODE" ||
			key === "ELECTRON_FORCE_IS_PACKAGED" ||
			key === "VSCODE_RUN_IN_ELECTRON" ||
			key === "NODE_OPTIONS"
		) {
			continue;
		}
		env[key] = value;
	}

	const electron = join(ROOT, "node_modules", "electron", "dist", "electron.exe");
	if (!existsSync(electron)) {
		console.error(`找不到 electron：${electron}（先跑 npm install）`);
		return 1;
	}
	console.log("在真实 Electron utilityProcess 里运行沙箱冒烟……\n");
	// 用滤过的 CHILD_ARGS：--diagnose 是本脚本的开关，转发下去会被子进程
	// 当成工作区路径。
	return run(electron, [HOST_JS, ...CHILD_ARGS], env);
}

main()
	.then((code) => {
		rmSync(WORK_DIR, { recursive: true, force: true });
		process.exit(code);
	})
	.catch((error: unknown) => {
		rmSync(WORK_DIR, { recursive: true, force: true });
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	});
