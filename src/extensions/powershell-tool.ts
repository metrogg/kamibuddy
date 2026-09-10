/**
 * powershell 工具：执行单条 PowerShell 命令（AGENTS.md §2 决策 A 已启用，
 * 前置条件「危险命令检查器」即同目录 command-guard.ts）。
 *
 * 安全模型（与 permission-policy 的 SHELL 分支是同一份分工）：
 *   - 权限门管「要不要问人」：read-only 拒、balanced 高风险逐次询问、
 *     danger-full-access 放行；
 *   - 检查器管「这条命令能不能跑」：任何权限档都先过 checkCommand，
 *     命中即拒（结果形式返回原因，不 throw —— 这不是执行失败，
 *     模型要拿着原因改写命令，isError 反而诱导原样重试）；
 *   - 无人值守（定时任务 run 会话）一律不可用：后台跑 shell 等于
 *     无人审批的执行权，什么权限档都不放开。
 *
 * 执行形态：spawn 直拉 powershell.exe（shell:false，不经 cmd 转一道），
 * -NoProfile 避免用户 profile 脚本污染环境，-NonInteractive 让需要输入的
 * 命令直接失败而不是挂住。stdout/stderr 以 utf8 收集拼接（标清来源），
 * 非零退出码在结果里点名（响亮，不静默吞掉）。
 *
 * 输出截断沿用项目 24k 字符约定（web-fetch 的 DEFAULT_MAX_CHARS、
 * doc-extract 的 MAX_CHARS 同口径），截断标注格式也与 web-fetch 一致。
 */

import { spawn } from "node:child_process";
import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { checkCommand } from "./command-guard.ts";

export interface PowershellToolOptions {
	/**
	 * 无人值守模式（定时任务 run 会话）：工具直接返回不可用文案。
	 * run 会话的权限门审批策略是「不问等于不做」，shell 在后台没有任何
	 * 人在场终审，无论权限档一律关掉（questionnaire 的 unattended 同款语义）。
	 */
	readonly unattended?: boolean;
}

/** 单次返回给模型的输出上限（字符），与 web-fetch / doc-extract 的 24k 同口径。 */
const MAX_OUTPUT_CHARS = 24_000;

const DEFAULT_TIMEOUT_SECONDS = 120;
const MAX_TIMEOUT_SECONDS = 600;

/**
 * 无人值守时的返回文案。写给模型看：为什么不可用 + 下一步怎么走 ——
 * 换工具完成，或在结果里如实说明，不要反复重试本工具。
 */
const UNATTENDED_TEXT =
	"当前是无人值守运行（定时任务），没有人在场审批，PowerShell 一律不可用。" +
	"请改用其他可用工具完成任务；确实需要 shell 的步骤，在最终结果中如实说明，由用户手动执行。";

/**
 * 工具结果 details 的固定形状。四个分支都返回全量字段（缺省用 undefined），
 * 避免 pi 的 AgentToolResult<TDetails> 按分支联合推断时形状漂移。
 */
interface PowershellToolDetails {
	/** 是否被拦截而未执行（检查器命中或无人值守）。 */
	readonly blocked: boolean;
	/** 拦截类别（command-guard 的 category；unattended 为 "unattended"）。 */
	readonly category: string | undefined;
	/** 进程退出码；被拦截或超时为 undefined。 */
	readonly exitCode: number | null | undefined;
	/** 输出是否因超 24k 被截断。 */
	readonly truncated: boolean;
}

interface CommandOutcome {
	readonly stdout: string;
	readonly stderr: string;
	/** null 表示被信号杀掉（超时路径）。 */
	readonly exitCode: number | null;
	readonly timedOut: boolean;
}

/**
 * 拉起 powershell.exe 跑一条命令。spawn 失败（非 Windows 没有 powershell.exe）
 * 走 error 事件 → reject，响亮报错；同步 throw 只发生在参数非法时，一并兜住。
 */
function runCommand(command: string, timeoutSeconds: number): Promise<CommandOutcome> {
	return new Promise((resolve, reject) => {
		let child;
		try {
			child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
				shell: false,
				windowsHide: true,
			});
		} catch (error) {
			reject(
				new Error(
					`无法启动 powershell.exe：${error instanceof Error ? error.message : String(error)}。` +
						"本工具依赖 Windows 自带的 PowerShell，当前环境不可用。",
				),
			);
			return;
		}
		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk: string) => {
			stdout += chunk;
		});
		child.stderr.on("data", (chunk: string) => {
			stderr += chunk;
		});
		let timedOut = false;
		const timer = setTimeout(() => {
			timedOut = true;
			child.kill();
		}, timeoutSeconds * 1000);
		child.on("error", (error) => {
			clearTimeout(timer);
			reject(
				new Error(
					`无法启动 powershell.exe：${error.message}。` +
						"本工具依赖 Windows 自带的 PowerShell，当前环境不可用。",
				),
			);
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			resolve({ stdout, stderr, exitCode: code, timedOut });
		});
	});
}

/** 执行结果 → 模型可读文本：状态行（含退出码）+ 分来源的输出 + 截断标注。 */
function formatOutcome(outcome: CommandOutcome, timeoutSeconds: number): {
	readonly text: string;
	readonly truncated: boolean;
} {
	const sections: string[] = [];
	if (outcome.timedOut) {
		sections.push(`命令超过 ${timeoutSeconds} 秒未结束，已强制终止。`);
	} else if (outcome.exitCode !== 0) {
		// 非零退出码必须点名：命令失败是结果的一部分，不许静默成「执行完成」。
		sections.push(`命令执行失败，退出码 ${outcome.exitCode ?? "未知"}。`);
	} else {
		sections.push("命令执行完成，退出码 0。");
	}
	const stdout = outcome.stdout.trimEnd();
	const stderr = outcome.stderr.trimEnd();
	if (stdout !== "") sections.push(`【标准输出】\n${stdout}`);
	if (stderr !== "") sections.push(`【标准错误】\n${stderr}`);
	if (stdout === "" && stderr === "") sections.push("（无输出）");
	const text = sections.join("\n");
	if (text.length <= MAX_OUTPUT_CHARS) return { text, truncated: false };
	return {
		text: `${text.slice(0, MAX_OUTPUT_CHARS)}\n\n（内容过长，已截断）`,
		truncated: true,
	};
}

export function powershellExtensionFactory(options?: PowershellToolOptions): ExtensionFactory {
	return (pi: ExtensionAPI): void => {
		pi.registerTool({
			name: "powershell",
			label: "执行 PowerShell 命令",
			description:
				"在 Windows 上执行一条 PowerShell 命令，返回标准输出与标准错误。" +
				"适合环境检查（看版本、列目录、查进程）、构建与测试（npm run build/test）、文档格式转换等本地操作。" +
				"安全约束：命令先过危险命令检查器——动态执行、下载执行、递归强制删除、读取凭据目录、破坏系统这五类会被直接拒绝；" +
				"权限预设可能要求每次执行都经用户批准。" +
				"使用建议：一次只执行一条命令；不要用交互式命令（会话没有 stdin，会挂到超时被终止）；默认 120 秒超时。",
			promptSnippet:
				"powershell: 执行单条 PowerShell 命令（环境检查、构建、格式转换等）；危险命令会被检查器拦截，交互式命令不要用",
			promptGuidelines: [
				"一次一条命令；多步操作分多次调用，不要拿 ; 或 && 串成一长串。",
				"不要用交互式命令（等待输入、打开窗口的）——会话没有 stdin，进程会挂起到超时被杀。",
				"输出超过 24k 字符会被截断；预期大输出时重定向到文件，再用 read 工具分段读取。",
				"被检查器拦截时按返回的改法重写命令；编码、拆字符串、起别名都绕不过检查器，反而浪费轮次。",
			],
			parameters: Type.Object({
				command: Type.String({
					minLength: 1,
					description: "要执行的 PowerShell 命令，一条。",
				}),
				timeoutSeconds: Type.Optional(
					Type.Integer({
						minimum: 1,
						maximum: MAX_TIMEOUT_SECONDS,
						description: `超时秒数，默认 ${DEFAULT_TIMEOUT_SECONDS}，最大 ${MAX_TIMEOUT_SECONDS}。`,
					}),
				),
			}),
			async execute(_toolCallId, params): Promise<{
				content: Array<{ type: "text"; text: string }>;
				details: PowershellToolDetails;
			}> {
				if (options?.unattended === true) {
					return {
						content: [{ type: "text", text: UNATTENDED_TEXT }],
						details: {
							blocked: true,
							category: "unattended",
							exitCode: undefined,
							truncated: false,
						},
					};
				}
				const verdict = checkCommand(params.command);
				if (verdict !== undefined) {
					return {
						content: [
							{
								type: "text",
								text:
									`命令未执行：危险命令检查器拦截（${verdict.category}）。\n` +
									verdict.reason,
							},
						],
						details: {
							blocked: true,
							category: verdict.category,
							exitCode: undefined,
							truncated: false,
						},
					};
				}
				const timeoutSeconds = params.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS;
				const outcome = await runCommand(params.command, timeoutSeconds);
				const { text, truncated } = formatOutcome(outcome, timeoutSeconds);
				return {
					content: [{ type: "text", text }],
					details: {
						blocked: false,
						category: undefined,
						exitCode: outcome.timedOut ? undefined : outcome.exitCode,
						truncated,
					},
				};
			},
		});
	};
}
