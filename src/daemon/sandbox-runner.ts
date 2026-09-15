/**
 * powershell 工具的沙箱执行器装配（spec: add-windows-acl-sandbox）。
 *
 * 这一层回答两个**策略**问题，所以它住在 daemon 而不是 extensions：
 *   1. 哪个权限档该进沙箱；
 *   2. 沙箱不可用时怎么降级、怎么如实告知。
 * 工具本体只管跑命令与格式化结果（见 extensions/powershell-tool.ts 的 runner 注释）。
 *
 * 档位映射：
 *   read-only          → 不进沙箱。权限门阶段 3 已把 shell 全拒，走不到这里；
 *                        真走到了也不该假装受限（那会掩盖门的漏洞）。
 *   workspace-write    → **进沙箱**。本期主战场。
 *   danger-full-access → 不进沙箱。该预设的文案写的是「不限制文件范围」，
 *                        加了沙箱就是文案说谎 —— 诚实优先于「顺手更安全」。
 *
 * 降级纪律：探测失败或授权失败 → 退回直接 spawn（今天的行为），
 * 但在给模型的文本里**明确说明沙箱未生效**。这不是 fail-open：今天本来就
 * 没有沙箱，且权限门对 shell 逐次询问 —— 沙箱是新增的纵深防御，
 * 降级等于「没有改善」，不等于「打开了一个洞」。
 *
 * **下一期放松审批时这条判据必须翻转成 fail-closed**：放松的依据就是沙箱存在，
 * 所以那时探测不可用必须继续逐次询问，不得放松。
 */

import type { CommandOutcome, CommandRunner } from "../extensions/powershell-tool.ts";
import {
	classifyFailure,
	prepareSandbox,
	probeSandbox,
	runSandboxed,
	type SandboxAvailability,
} from "../sandbox/index.ts";
import type { PermissionSettings, SandboxUnavailableReason } from "../shared/permissions.ts";

/**
 * 授权超过这个时长才提示。
 *
 * 门槛存在的理由：绝大多数情况下授权是 1ms 的幂等命中（ACE 常驻），
 * 无条件提示等于每条命令都闪一行噪音。只有真让人等的时候才出声。
 */
const PREPARE_NOTICE_DELAY_MS = 1_000;

/**
 * 等待提示的文本。三件事都要说到：**在做什么**、**为什么慢**、**会不会一直这样**——
 * 只说「请稍候」会让用户以为卡死了。
 */
const PREPARE_NOTICE =
	"正在为工作目录配置写入约束（首次较慢，与目录内文件数量有关；之后每次都会很快）……";

/** 沙箱未生效时追加给模型的说明。 */
const DEGRADED_NOTE =
	"注意：本次执行未受操作系统级写入约束（沙箱不可用）。" +
	"写入范围仅由 KamiBuddy 的权限判定把关，请严格只写工作目录内的文件。";

/** 上报给 daemon 的一次性诊断（用于设置页与日志）。 */
export interface SandboxDiagnostics {
	readonly available: boolean;
	readonly reason?: SandboxUnavailableReason;
	readonly detail?: string;
}

export interface SandboxRunnerOptions {
	/** 当前权限设置。getter 而非快照：用户改档后下一次调用即生效。 */
	readonly getSettings: () => PermissionSettings;
	/**
	 * 会话的工作目录。**快照即可，不需要 getter** —— 与权限门同一口径
	 * （createPermissionGate 也是拿 `const cwd = bucket.cwd` 的快照）。
	 *
	 * 依据的不变式：`bucket.cwd` 的每次改动要么发生在宿主建立之前
	 * （applyWorkspace 与 newTask 都用 `hostPromise === undefined` 把守，
	 * 只改 pristine 桶），要么先 dispose 宿主再重建（saveToWorkspace）。
	 * 所以活着的宿主看到的 cwd 不会在脚下变。
	 *
	 * 反过来说：这里若用 getter 读 bucket.cwd，反而会与权限门的快照可能不一致 ——
	 * 两处对「哪儿是工作区」的答案分歧，是比僵化更难查的 bug。
	 */
	readonly workspaceDir: string;
	/** 直接 spawn 的执行器（工具的缺省实现），降级时用它。 */
	readonly fallback: CommandRunner;
	/** 诊断变化时回调（探测结论、降级原因）。同一结论只报一次。 */
	readonly onDiagnostics?: (diagnostics: SandboxDiagnostics) => void;
	/**
	 * 沙箱门面。缺省是真实实现；**注入是为了让降级逻辑能被平台无关地测试**。
	 *
	 * 与 `fallback` 同一范式（也照 documents/docx-env.ts 的注入 spawn）：
	 * 这一层决定的是「什么时候在没有 OS 写入约束的情况下执行命令」——
	 * 那是本期最该被测到的判断，不能只在非 Windows 机器上才走得到
	 * （真实探测在 Windows 上会成功，于是开发机上永远测不到降级分支）。
	 */
	readonly sandbox?: SandboxFacade;
}

/** 本层用到的沙箱能力面。抽出来是为了可注入（见 SandboxRunnerOptions.sandbox）。 */
export interface SandboxFacade {
	readonly probe: typeof probeSandbox;
	readonly prepare: typeof prepareSandbox;
	readonly run: typeof runSandboxed;
}

const REAL_SANDBOX: SandboxFacade = {
	probe: probeSandbox,
	prepare: prepareSandbox,
	run: runSandboxed,
};

/**
 * 按目录记忆的授权 promise。
 *
 * 为什么按目录而不是每会话一个：ACE 是常驻的、`grantWrite` 幂等且命中后只要
 * 1ms，所以「这个目录准备好了吗」是**进程级**的事实，与会话无关。多个会话
 * 共用同一工作区时也只授权一次。
 *
 * 存 promise 而不是布尔：并发的第一批调用会 await 同一个在途授权，
 * 不会各自触发一遍传播。
 */
const prepareByDir = new Map<string, Promise<void>>();

/** 仅供测试：清掉按目录的授权记忆。 */
export function resetSandboxRunnerForTest(): void {
	prepareByDir.clear();
}

/**
 * 确保某个目录已授权。失败会**记住失败**（不重试）——
 * 授权失败通常是结构性的（目录不归当前用户、卷不支持 ACL），
 * 每条命令重试一遍只是让每次执行都多等一次失败。
 */
function ensurePrepared(workspaceDir: string, prepare: SandboxFacade["prepare"]): Promise<void> {
	const existing = prepareByDir.get(workspaceDir);
	if (existing !== undefined) return existing;
	const started = prepare({ workspaceDir, writableDirs: [workspaceDir] }).then(() => undefined);
	prepareByDir.set(workspaceDir, started);
	return started;
}

/**
 * 预热：在会话建立时启动授权，**不阻塞会话创建**。
 *
 * 为什么是预热而不是同步等待：实测首次授权随文件数略超线性增长
 * （5000 文件 3134ms，外推几万文件即几十秒）。同步等待会让新建会话卡住；
 * 而完全懒加载又会让模型第一条命令莫名挂几十秒。折中是此刻**开始**，
 * 让第一次调用 await 剩余部分 —— 模型思考与流式输出的时间通常足够它跑完。
 *
 * 返回 promise 只为让调用方能在需要时观察结果（如打日志），不要求 await。
 * 异常在这里吞掉：真正的失败会在 runner 里被分类并如实上报，
 * 预热阶段抛错只会无谓打断会话创建。
 */
export function warmUpSandbox(options: {
	readonly workspaceDir: string;
	readonly mode: PermissionSettings["sandbox"];
	readonly onDiagnostics?: (diagnostics: SandboxDiagnostics) => void;
	/** 注入沙箱门面（测试用），缺省是真实实现。 */
	readonly sandbox?: SandboxFacade;
}): Promise<void> {
	const { workspaceDir, mode, onDiagnostics } = options;
	const sandbox = options.sandbox ?? REAL_SANDBOX;
	// 只有会进沙箱的档位才值得预热；其余档位授权是纯浪费（还会留下 ACE）。
	if (mode !== "workspace-write") return Promise.resolve();
	/*
	 * 预热顺带上报诊断，是为了让**设置页在首次执行命令之前**就能如实显示状态。
	 * 否则用户打开设置只能看到「尚未探测」这种既不真也不假的中间态 ——
	 * 而探测本身很便宜（FFI 加载 + 一次卷查询，且结果有缓存）。
	 */
	return sandbox
		.probe(workspaceDir)
		.then(async (probe) => {
			if (!probe.available) {
				onDiagnostics?.({ available: false, reason: probe.reason, detail: probe.detail });
				return;
			}
			try {
				await ensurePrepared(workspaceDir, sandbox.prepare);
				onDiagnostics?.({ available: true });
			} catch (error) {
				// 授权失败也是「沙箱用不了」，与探测失败同口径上报。
				onDiagnostics?.({
					available: false,
					reason: classifyFailure(error),
					detail: errorDetail(error),
				});
			}
		})
		.catch((error: unknown) => {
			onDiagnostics?.({ available: false, reason: "ffi-load-failed", detail: errorDetail(error) });
		});
}

/**
 * 构造 powershell 的执行器。
 *
 * **fail-closed 的边界在哪**：沙箱**内**执行失败（命令本身出错、超时）如实回传，
 * 不重试、不降级 —— 那是真实的执行结果。只有「沙箱本身用不了」
 * （探测失败、令牌派生失败、授权失败）才降级，且必须带说明。
 * 混淆这两者会让「命令被操作系统拒绝」悄悄变成「不受约束地重跑一遍」。
 */
export function createSandboxedRunner(options: SandboxRunnerOptions): CommandRunner {
	const sandbox = options.sandbox ?? REAL_SANDBOX;
	let lastReported: string | undefined;
	const report = (diagnostics: SandboxDiagnostics): void => {
		// 同一结论只报一次：每条命令都推一遍相同的诊断会把日志刷爆。
		const key = `${String(diagnostics.available)}:${diagnostics.reason ?? ""}`;
		if (key === lastReported) return;
		lastReported = key;
		options.onDiagnostics?.(diagnostics);
	};

	/** 降级执行：跑 fallback，并把「沙箱未生效」追加进结果。 */
	const degrade = async (
		command: string,
		timeoutSeconds: number,
		reason: SandboxUnavailableReason,
		detail: string,
	): Promise<CommandOutcome & { readonly note?: string }> => {
		report({ available: false, reason, detail });
		const outcome = await options.fallback(command, timeoutSeconds);
		return { ...outcome, note: DEGRADED_NOTE };
	};

	return async (command, timeoutSeconds, onProgress) => {
		const settings = options.getSettings();
		// 不该进沙箱的档位：直接跑，且**不加降级说明** ——
		// danger-full-access 下「没有写入约束」是用户选的语义，不是故障。
		if (settings.sandbox !== "workspace-write") {
			return options.fallback(command, timeoutSeconds);
		}

		const { workspaceDir } = options;
		let probe: SandboxAvailability;
		try {
			probe = await sandbox.probe(workspaceDir);
		} catch (error) {
			return degrade(command, timeoutSeconds, "ffi-load-failed", errorDetail(error));
		}
		if (!probe.available) {
			return degrade(command, timeoutSeconds, probe.reason, probe.detail);
		}

		try {
			await awaitWithNotice(ensurePrepared(workspaceDir, sandbox.prepare), onProgress);
		} catch (error) {
			// 授权失败 = 沙箱用不了，降级（而不是拿未授权的沙箱去跑 ——
			// 那会让工作区内的正常写入也被拒，比不进沙箱更糟）。
			return degrade(command, timeoutSeconds, classifyFailure(error), errorDetail(error));
		}

		try {
			const outcome = await sandbox.run({
				command: "powershell.exe",
				args: ["-NoProfile", "-NonInteractive", "-Command", command],
				cwd: workspaceDir,
				// 与 prepare 锚定同一个目录：私有 temp 按它派生，两处不一致
				// 会让运行时用的 temp 从未被授权（潜伏 bug，已在集成测试里守住）。
				workspaceDir,
				writableDirs: [workspaceDir],
				timeoutMs: timeoutSeconds * 1000,
				mode: "workspace-write",
			});
			report({ available: true });
			return outcome;
		} catch (error) {
			/*
			 * 走到这里说明沙箱**装配**失败（令牌派生、spawn 本身），
			 * 不是命令执行失败 —— 后者会以 outcome 形式正常返回。
			 * 装配失败降级并说明，与探测失败同口径。
			 */
			return degrade(command, timeoutSeconds, classifyFailure(error), errorDetail(error));
		}
	};
}

/**
 * 等一个操作，只在它**超过门槛**时才发一次提示。
 *
 * 为什么要门槛而不是无条件提示：授权在绝大多数情况下是 1ms 的幂等命中
 * （ACE 常驻），每条命令都闪一行「正在配置」纯属噪音，还会让用户以为
 * 每次都在做重活。只有真让人等的那一次值得出声。
 *
 * 定时器在 finally 里清掉，成功与失败两条路都不留悬挂定时器；
 * 已触发的定时器再 clear 是无害的 no-op。onProgress 缺省时连定时器都不建。
 */
async function awaitWithNotice<T>(
	work: Promise<T>,
	onProgress: ((text: string) => void) | undefined,
): Promise<T> {
	if (onProgress === undefined) return work;
	const timer = setTimeout(() => onProgress(PREPARE_NOTICE), PREPARE_NOTICE_DELAY_MS);
	try {
		return await work;
	} finally {
		clearTimeout(timer);
	}
}

function errorDetail(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
