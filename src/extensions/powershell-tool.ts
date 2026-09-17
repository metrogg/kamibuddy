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
import type { ChildProcess } from "node:child_process";
import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { ESCALATION_TARGETS, validateEscalationArgs } from "../shared/permissions.ts";
import { checkCommand } from "./command-guard.ts";

export interface PowershellToolOptions {
	/**
	 * 无人值守模式（定时任务 run 会话）：工具直接返回不可用文案。
	 * run 会话的权限门审批策略是「不问等于不做」，shell 在后台没有任何
	 * 人在场终审，无论权限档一律关掉（questionnaire 的 unattended 同款语义）。
	 */
	readonly unattended?: boolean;
	/**
	 * 命令执行器。缺省是直接 spawn（今天的行为）；daemon 注入的版本会把命令
	 * 放进受限令牌里跑（spec: add-windows-acl-sandbox）。
	 *
	 * 注入而非在本文件里判档位，是因为「哪个权限档该进沙箱」是**策略**，
	 * 属于 daemon 装配层 —— 工具只负责跑命令与格式化结果。
	 * 注入形态同时让整条路径能用假执行器单测（照 documents/docx-env.ts 的约定）。
	 */
	readonly runner?: CommandRunner;
}

/**
 * 命令执行器。
 *
 * `note` 是执行环境的附带说明（如「沙箱未生效」），会被追加到给模型的文本里。
 * 放在执行器的返回值而不是让工具去问沙箱状态：谁执行谁最清楚实际的约束情况。
 */
export type CommandRunner = (
	command: string,
	timeoutSeconds: number,
	/**
	 * 执行前的等待提示（可选）。执行器只在**确实要让用户等**时调用一次 ——
	 * 目前唯一的用途是首次 ACL 授权超过 1 秒（大工作区可能几秒到几十秒）。
	 *
	 * 文本经 pi 的 onUpdate → tool_progress 追加到工具卡，终态会整卡替换，
	 * 所以它是瞬时的：命令跑完就消失，不会污染最终结果。
	 */
	onProgress?: (text: string) => void,
	/**
	 * 模型对**这一次调用**申请的提权（可选）。工具只做透传，不做判断 ——
	 * 「能不能提、要不要问人」是策略，住 daemon/sandbox-runner.ts。
	 */
	escalation?: CommandEscalationRequest,
	/**
	 * 中断信号（可选）。pi 在用户按「停止」时 abort 它 —— 执行器**必须**据此
	 * 把进程树收掉，不能只是放弃等待：放弃等待 = 卡片永远停在「执行中」、
	 * 进程在后台继续跑（2026-09-17 的 pip 现场，详见 sandbox/spawn.ts 的 waitForChild）。
	 */
	signal?: AbortSignal,
) => Promise<CommandRunResult>;

/** 一次提权申请。两个字段成对出现（校验在 shared/permissions.ts）。 */
export interface CommandEscalationRequest {
	/** 申请的目标档位，必须严格宽于本次调用的有效档位。 */
	readonly toMode: string;
	/** 模型给的一句话理由，**原样**展示在审批弹窗里。 */
	readonly justification: string;
}

/**
 * 执行器的返回：**要么真跑了一次，要么明确没跑**。
 *
 * 为什么要这个联合而不是塞进 CommandOutcome：提权被拒时命令**一行都没执行**，
 * 若拿一个合成的「退出码 1」去表示，那是在谎报「命令跑了并失败了」——
 * 模型会去调试自己的命令，而真正的原因是用户没批准。
 * 形状与工具已有的 `blocked` / `category` 对齐（危险命令检查器就是这么报的）。
 */
export type CommandRunResult = (CommandOutcome & { readonly note?: string }) | CommandBlocked;

/** 命令未执行。reason 直接回给模型，让它知道下一步该怎么走。 */
export interface CommandBlocked {
	readonly blocked: true;
	/** 拦截类别，进 details 供界面与日志区分。 */
	readonly category: string;
	readonly reason: string;
}

/** 类型收窄：区分「跑过了」与「被拦下」。 */
function isBlocked(result: CommandRunResult): result is CommandBlocked {
	return "blocked" in result;
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

/**
 * 一次命令执行的结果。导出供 daemon 装配沙箱执行器用 ——
 * `src/sandbox` 的 `SandboxRunOutcome` 与这个形状**逐字段对应**（含 exitCode
 * 用 null 表示被杀），所以那边的结果可以直接充当这里的返回值，不需要转换层。
 */
export interface CommandOutcome {
	readonly stdout: string;
	readonly stderr: string;
	/** null 表示被信号杀掉（超时或中断路径）。 */
	readonly exitCode: number | null;
	readonly timedOut: boolean;
	/** 被中断（用户按「停止」）而杀树；与超时分开是因为给模型的解释不同。 */
	readonly aborted: boolean;
}

/**
 * 杀掉整棵进程树（降级路径专用）。
 *
 * `child.kill()` 只杀直接子进程：`pip install` 拉起的 python 会变孤儿继续跑。
 * 沙箱路径靠 Job 句柄（kill-on-close，见 sandbox/spawn.ts），降级路径没有 Job，
 * 只能用 taskkill /T 按 PID 收整棵树 —— 所以**先 taskkill、失败再 kill**：
 * 反过来先杀掉父进程，taskkill 就找不到它的子孙了。
 */
function killTree(child: ChildProcess): void {
	const pid = child.pid;
	if (pid === undefined) {
		child.kill();
		return;
	}
	try {
		const killer = spawn("taskkill.exe", ["/pid", String(pid), "/T", "/F"], {
			stdio: "ignore",
			windowsHide: true,
		});
		killer.on("error", () => child.kill());
	} catch {
		child.kill();
	}
}

/**
 * 拉起 powershell.exe 跑一条命令。spawn 失败（非 Windows 没有 powershell.exe）
 * 走 error 事件 → reject，响亮报错；同步 throw 只发生在参数非法时，一并兜住。
 *
 * 导出是给 daemon 的沙箱执行器当**降级路径**用（daemon/sandbox-runner.ts）：
 * 沙箱不可用时退回这条今天就在跑的路径，而不是自己再写一遍 spawn。
 */
export function runCommand(
	command: string,
	timeoutSeconds: number,
	// 这条路径没有沙箱可提权，也没有授权预热等待，所以前两个可选参数接了就丢
	//（调用点的注释说明了这一点，见 execute 里的 CommandRunner 装配）。
	_onProgress?: (text: string) => void,
	_escalation?: CommandEscalationRequest,
	signal?: AbortSignal,
): Promise<CommandOutcome> {
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
		let aborted = false;
		const timer = setTimeout(() => {
			timedOut = true;
			killTree(child);
		}, timeoutSeconds * 1000);
		// 中断与超时同样要收掉整棵树：只是放弃等待的话，进程会在后台继续跑。
		const onAbort = (): void => {
			aborted = true;
			killTree(child);
		};
		if (signal?.aborted === true) onAbort();
		else signal?.addEventListener("abort", onAbort, { once: true });
		child.on("error", (error) => {
			clearTimeout(timer);
			signal?.removeEventListener("abort", onAbort);
			reject(
				new Error(
					`无法启动 powershell.exe：${error.message}。` +
						"本工具依赖 Windows 自带的 PowerShell，当前环境不可用。",
				),
			);
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			signal?.removeEventListener("abort", onAbort);
			resolve({ stdout, stderr, exitCode: code, timedOut, aborted });
		});
	});
}

/**
 * 执行结果 → 模型可读文本：状态行（含退出码）+ 环境说明 + 分来源的输出 + 截断标注。
 *
 * `note` 紧跟状态行、排在输出之前是有意的：输出可能长到被截断，
 * 而「沙箱未生效」这类说明不能因为命令话多就丢掉。
 */
function formatOutcome(outcome: CommandOutcome, timeoutSeconds: number, note?: string): {
	readonly text: string;
	readonly truncated: boolean;
} {
	const sections: string[] = [];
	if (outcome.aborted) {
		// 与超时分开说：中断是「你点了停止」，不是命令有问题 —— 模型据此决定要不要换个做法重试。
		sections.push("命令已被中断（用户停止），进程树已收掉。");
	} else if (outcome.timedOut) {
		sections.push(`命令超过 ${timeoutSeconds} 秒未结束，已强制终止。`);
	} else if (outcome.exitCode !== 0) {
		// 非零退出码必须点名：命令失败是结果的一部分，不许静默成「执行完成」。
		sections.push(`命令执行失败，退出码 ${outcome.exitCode ?? "未知"}。`);
	} else {
		sections.push("命令执行完成，退出码 0。");
	}
	if (note !== undefined && note !== "") sections.push(note);
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
				"默认档位下命令在**写入沙箱**内执行：只能写当前工作目录，写别处会被操作系统直接拒绝（这类失败重试无用）。" +
				"使用建议：一次只执行一条命令；不要用交互式命令（会话没有 stdin，会挂到超时被终止）；默认 120 秒超时；" +
				"每次调用都填 description 写清这条命令要做什么。",
			promptSnippet:
				"powershell: 执行单条 PowerShell 命令（环境检查、构建、格式转换等）；危险命令会被检查器拦截，交互式命令不要用；默认只能写工作目录，pip install 在这类沙箱里装不进去",
			promptGuidelines: [
				"一次一条命令；多步操作分多次调用，不要拿 ; 或 && 串成一长串。",
				"不要用交互式命令（等待输入、打开窗口的）——会话没有 stdin，进程会挂起到超时被杀。",
				"输出超过 24k 字符会被截断；预期大输出时重定向到文件，再用 read 工具分段读取。",
				"被检查器拦截时按返回的改法重写命令；编码、拆字符串、起别名都绕不过检查器，反而浪费轮次。",
				/*
				 * 下面两条讲**写入沙箱**，是 2026-09-17 那次 3 连试的教训：模型把 pip 的输出
				 * 重定向进日志文件，于是 stderr 为空、sandbox-runner 的 denial 提示没触发，
				 * 它只看到「失败」就一路重试到用户手动停。
				 * 写在这里而不是场景片段：这一处覆盖所有场景（片段是按场景 include 的），
				 * 而且恰好落在模型组命令时的决策点上。
				 */
				"命令只能写当前工作目录（默认档位），写到别处会被操作系统拒绝。这类失败**重试无用**：" +
					"换写法、换路径、加 -Force 都不会通过。确需写到区外时，带 sandbox_permissions + justification " +
					"申请一次（没有审批通道时会被明确告知不可用）。",
				"**不要用 pip install**：它在沙箱里必定失败——pip 会在临时目录里自建一个受保护权限的子目录，" +
					"而沙箱写不进那类目录，换安装位置、重试多少次都一样（`Errno 13 Permission denied`）。" +
					"需要第三方 Python 库时，按上一条申请一次提权，并说清要装什么、为什么。",
				"每次都填 description：一句简短中文说清这条命令要做什么（面向用户，如「核对侧栏的内边距」）。" +
					"界面卡头显示的是这句话，命令原文只在悬浮提示与展开区可见。",
			],
			parameters: Type.Object({
				command: Type.String({
					minLength: 1,
					description: "要执行的 PowerShell 命令，一条。",
				}),
				/*
				 * 工具自描述（对齐 WorkBuddy：其 bash/execute_command 的 description 入参）。
				 * 卡头显示的是这句话，命令原文退到 hover 提示（ToolCard.summaryTitle）
				 * 与展开的输出区 —— 所以它必须是一句「人读得懂的动作」，不是命令的复述。
				 * 字段名与 WorkBuddy 逐字对齐（它的渲染器直接读 args.description，
				 * 见 docs/WorkBuddy-reference/.../ui-docs-viewer-*.js:334679），不新造词。
				 * 不设 maxLength：WorkBuddy 也不限长，卡头超出走省略号 + hover 提示，
				 * 加硬约束只会让模型为凑长度多花轮次。
				 */
				description: Type.Optional(
					Type.String({
						minLength: 1,
						description:
							"一句简短中文，说清这条命令要做什么（面向用户，如「核对侧栏的内边距」）。" +
							"它会替代命令原文显示在界面上；命令原文在悬浮提示与展开区仍可看到。",
					}),
				),
				timeoutSeconds: Type.Optional(
					Type.Integer({
						minimum: 1,
						maximum: MAX_TIMEOUT_SECONDS,
						description: `超时秒数，默认 ${DEFAULT_TIMEOUT_SECONDS}，最大 ${MAX_TIMEOUT_SECONDS}。`,
					}),
				),
				/*
				 * 提权申请（spec: add-windows-acl-sandbox 二阶段）。字段名照 dsh 逐字
				 * （sandbox_permissions + justification），不自创方言。
				 *
				 * **常驻广告，不按当前档位裁剪**：schema 是注册期全局的，有效模式是
				 * 每次调用的真相（shared/permissions.ts 的 WIDER_MODES 注释）。
				 * 严格变宽的校验发生在**执行期**。
				 */
				sandbox_permissions: Type.Optional(
					Type.Union(
						ESCALATION_TARGETS.map((mode) => Type.Literal(mode)),
						{
							description:
								"仅在命令确实被沙箱写约束拦住时使用：为**这一次**执行申请更宽的权限（需用户批准）。" +
								"取最窄的够用档位。必须同时给 justification。",
						},
					),
				),
				justification: Type.Optional(
					Type.String({
						minLength: 1,
						description:
							"一句话说明为什么这条命令需要更宽的权限（会原样展示给用户审批）。只能与 sandbox_permissions 一起给。",
					}),
				),
			}),
			/*
			 * 第 4 参数 onUpdate 是 pi 的执行中进度通道（与 task-tool 同一用法）：
			 * 它经 tool_execution_update → tool_progress 追加到工具卡的 detail，
			 * 而终态 tool_finished 会**整卡替换** —— 所以进度文本是瞬时的，
			 * 命令跑完即消失，不会污染最终结果。
			 * 用它而不是新开 IPC 通道：提示本就该出现在用户正在等的那张卡上。
			 */
			async execute(_toolCallId, params, signal, onUpdate): Promise<{
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
				/*
				 * 提权入参的成对校验（schema 表达不了的那部分）。
				 * 返回原因而不 throw —— 与上面危险命令检查器同一条约定：
				 * 这不是执行失败，模型要拿着原因改写调用。
				 */
				const malformed = validateEscalationArgs(params.sandbox_permissions, params.justification);
				if (malformed !== undefined) {
					return {
						content: [{ type: "text", text: `命令未执行：${malformed}` }],
						details: {
							blocked: true,
							category: "escalation-malformed",
							exitCode: undefined,
							truncated: false,
						},
					};
				}
				const timeoutSeconds = params.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS;
				/*
				 * 缺省执行器 = 直接 spawn（今天的行为）；daemon 会注入沙箱版本。
				 * 显式标注类型而不是让它推成联合：note 是可选字段，所以不带 note 的
				 * runCommand 也满足 CommandRunner —— 这样 CommandOutcome 能保持
				 * 与 sandbox 层 SandboxRunOutcome 逐字段对应的纯净形状。
				 *
				 * 提权申请只做**透传**：能不能提、要不要问人、问谁，全是策略，
				 * 住 daemon/sandbox-runner.ts（那里有权限设置与审批通道）。
				 * 缺省的 runCommand 忽略这个参数 —— 它本来就没有沙箱可提权，
				 * 而 daemon 的两个装配点都注入了沙箱执行器。
				 */
				const run: CommandRunner = options?.runner ?? runCommand;
				const result = await run(
					params.command,
					timeoutSeconds,
					(text) => {
						/*
						 * details 必须给全量字段（与终态同形）：pi 的
						 * AgentToolResult<TDetails> 按分支联合推断，缺字段会让形状漂移。
						 * 这里的取值表示「还在执行中、未被拦截」。
						 */
						onUpdate?.({
							content: [{ type: "text" as const, text }],
							details: {
								blocked: false,
								category: undefined,
								exitCode: undefined,
								truncated: false,
							},
						});
					},
					params.sandbox_permissions === undefined || params.justification === undefined
						? undefined
						: { toMode: params.sandbox_permissions, justification: params.justification },
					// 中断信号必须传到执行器：只有它握着进程（沙箱里是 Job 句柄），
					// 放弃等待而不杀进程 = 卡片卡在「执行中」+ 后台残留进程。
					signal,
				);
				/*
				 * 被拦下（提权未获批准等）：命令**一行都没执行**，如实这么说。
				 * 不合成一个「退出码 1」—— 那是谎报「命令跑了并失败了」，
				 * 模型会去调试自己的命令，而真正的原因是用户没批准。
				 */
				if (isBlocked(result)) {
					return {
						content: [{ type: "text", text: `命令未执行：${result.reason}` }],
						details: {
							blocked: true,
							category: result.category,
							exitCode: undefined,
							truncated: false,
						},
					};
				}
				const outcome = result;
				const { text, truncated } = formatOutcome(outcome, timeoutSeconds, outcome.note);
				return {
					content: [{ type: "text", text }],
					details: {
						blocked: false,
						category: undefined,
						exitCode: outcome.timedOut || outcome.aborted ? undefined : outcome.exitCode,
						truncated,
					},
				};
			},
		});
	};
}
