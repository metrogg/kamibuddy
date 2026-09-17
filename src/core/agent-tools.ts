/**
 * pi 依赖的外部二进制（fd / rg）就位检查 —— 启动时跑一次，幂等。
 *
 * **为什么需要这一步**：pi 的两个内置工具是「外壳」，自己不实现搜索 ——
 * `find` 调 `fd`、`grep` 调 `rg`（`packages/coding-agent/src/core/tools/find.ts`
 * 的 `ensureTool("fd")`）。pi 的兜底是「本机没有就从 GitHub 下」，而这条兜底在
 * 国内网络下有两个问题，都是实测出来的（2026-09-17）：
 *
 *   1. **每次调用都白等 10 秒**：`ensureTool` 没有负缓存，每次都重新走
 *      「解析 latest 版本（10s 超时）→ 放弃」。实测 `ensureTool("fd")` = 10,024 ms → undefined。
 *      用户那轮任务里「工具调用 13.1s」的大头就是它；
 *   2. **失败原因被吞**：那条调用路径没接 pi 的 onStatus，下载失败的具体原因
 *      （DNS/超时/HTTP 码）不进任何日志，界面只剩一句泛泛的
 *      `fd is not available and could not be downloaded`（违反 AGENTS.md §7）。
 *
 * 顺带一提：pi 的 HTTP 代理支持（`EnvHttpProxyAgent`）只在它自己的 CLI/TUI 入口里
 * 装（`main.ts` / `rpc-entry.ts` / `interactive-mode.ts` 调 `configureHttpDispatcher`），
 * 我们走 SDK 这些入口都不跑 —— 所以哪怕机器上有代理（实测这台有 127.0.0.1:7890），
 * pi 的下载照样不通。
 *
 * **目标目录有个坑，必须按 pi 的规则算**（2026-09-17 踩过）：
 * `tools-manager.ts` 在**模块加载时**就把 `TOOLS_DIR = getBinDir()` 算死了 ——
 * 那是 `getAgentDir()/bin`，即 `~/.pi/agent/bin`（可用 `PI_CODING_AGENT_DIR` 覆盖），
 * **与我们传给 `createAgentSession` 的 `agentDir`（`~/.kamibuddy`）无关**。
 * 照我们自己的配置目录去放，pi 永远找不到，又退回「联网下载 + 每次白等 10 秒」。
 * 所以这里用 pi 公开导出的 `getAgentDir()` 去推导，不抄它的字符串常量。
 *
 * 三条纪律：
 *   - **已就位就不动**：不静默覆盖用户/环境里已有的版本（例如这台机器上 pi 自己
 *     下载过 rg 15.2.0，比随包的还新）；
 *   - **缺就照实报**：本函数只回结果，由调用方落日志 —— 缺了就是对应工具不可用；
 *   - **不吞失败**：拷贝失败抛出去（调用方记日志），不留半成品静默可用。
 */

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { getAgentDir } from "@earendil-works/pi-coding-agent";

import { getResourcesDir } from "./config-paths.ts";

/** 随包资产与 pi 期望的文件名都用这套（Windows 上加 .exe）。 */
const BUNDLED_BINARIES: readonly string[] = ["fd", "rg"];

export interface AgentToolsResult {
	/** pi 读的目录（同 pi 的 `getBinDir()`）。 */
	readonly targetDir: string;
	/** 本次真正拷过去的（首次启动，或用户删掉后重启）。 */
	readonly installed: readonly string[];
	/** 目标目录里已就位（含本次拷的）。 */
	readonly present: readonly string[];
	/** 随包资产里没有、目标目录里也没有 —— 对应的工具会不可用。 */
	readonly missing: readonly string[];
	/** 整件事被跳过的原因（非 Windows：随包资产只有 Windows x64）。 */
	readonly skipped?: string;
}

export interface EnsureAgentToolsOptions {
	/** 随包资产目录，缺省 `resources/bin`。 */
	readonly sourceDir?: string;
	/** pi 的 bin 目录，缺省按 pi 的 `getAgentDir()/bin` 推导。 */
	readonly targetDir?: string;
	/** 要确保的二进制名，缺省 fd + rg。 */
	readonly binaries?: readonly string[];
	/** 平台注入点（测试用）。 */
	readonly platform?: NodeJS.Platform;
}

export function ensureAgentTools(options: EnsureAgentToolsOptions = {}): AgentToolsResult {
	const platform = options.platform ?? process.platform;
	const sourceDir = options.sourceDir ?? join(getResourcesDir(), "bin");
	// 与 pi 的 `getBinDir()` 同规则（`config.ts`：join(getAgentDir(), "bin")）。
	// 用它的公开函数而不是自己拼 homedir：`PI_CODING_AGENT_DIR` 覆盖时两边一致。
	const targetDir = options.targetDir ?? join(getAgentDir(), "bin");
	const binaries = options.binaries ?? BUNDLED_BINARIES;

	// 随包资产只有 Windows x64。别的平台不猜、不假装成功：直接说明跳过，
	// 由 pi 那边按它自己的规则找（系统 PATH 或它自己的下载路径）。
	if (platform !== "win32") {
		return {
			targetDir,
			installed: [],
			present: [],
			missing: [],
			skipped: `随包资产只有 Windows x64（当前 ${platform}）`,
		};
	}

	const installed: string[] = [];
	const present: string[] = [];
	const missing: string[] = [];
	for (const name of binaries) {
		const file = `${name}.exe`;
		const target = join(targetDir, file);
		if (existsSync(target)) {
			present.push(name);
			continue;
		}
		const source = join(sourceDir, file);
		if (!existsSync(source)) {
			missing.push(name);
			continue;
		}
		mkdirSync(targetDir, { recursive: true });
		copyFileSync(source, target);
		installed.push(name);
		present.push(name);
	}
	return { targetDir, installed, present, missing };
}
