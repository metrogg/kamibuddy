/**
 * powershell 工具的沙箱执行器装配（spec: add-windows-acl-sandbox）。
 *
 * 这一层回答两个**策略**问题，所以它住在 daemon 而不是 extensions：
 *   1. 哪个权限档该进沙箱（read-only / workspace-write 进，danger-full-access 不进）；
 *   2. 沙箱装不起来时怎么办——**拒绝执行，绝不无约束重跑**（对齐 dsh 的
 *      SandboxUnavailableError：read-only/workspace-write 档下探测、授权、
 *      令牌、spawn 任何一环失败都 fail-closed，官方出路是切
 *      danger-full-access。不存在「降级到无约束跑」——那会让写约束静默消失）。
 *
 * 探测在**执行时**现场做（dsh 的 confine 同构：能力是执行时事实）；
 * 会话建立时的 warmUp 只是性能优化（提前传播 ACE）与设置页诊断，
 * 不是执行判据。
 *
 * 工具本体只管跑命令与格式化结果（见 extensions/powershell-tool.ts 的 runner 注释）。
 */

import type {
	CommandBlocked,
	CommandEscalationRequest,
	CommandOutcome,
	CommandRunner,
} from "../extensions/powershell-tool.ts";
import { clipAuditDetail, type AuditSink } from "../shared/audit.ts";
import {
	classifyFailure,
	probeSandbox,
	runSandboxed,
	type SandboxAvailability,
	type SandboxPrepareResult,
} from "../sandbox/index.ts";
import {
	canEscalate,
	isSandboxMode,
	willAskUser,
	type PermissionSettings,
	type SandboxMode,
	type SandboxUnavailableReason,
} from "../shared/permissions.ts";
import {
	prepareSandboxInWorker,
	type PrepareRequest,
} from "./sandbox-prepare-client.ts";

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

/* ── 拒写识别（让「被策略拒了」对模型可见） ────────────────────── */

/**
 * 沙箱拒写的签名。**必须与语言无关**，这一条是实测结论，不是偏好。
 *
 * 2026-09-16 用 `scripts/probe-denial-text.ts` 走真实沙箱取到的原文
 * （中文 Windows 11、Windows PowerShell 5.1）：
 *
 *   PowerShell 按控制台代码页（中文机器是 936/GBK）输出 stderr，而
 *   `runSandboxed` 按 **UTF-8** 解码 —— 于是本地化的那句「对路径…的访问被拒绝」
 *   到我们手里是**乱码**（`��·����…���ķ��ʱ��ܾ���`）。
 *
 * 所以两条直觉做法都不可行：照搬 dsh 的英文方言
 * （`access is denied` / `access to the path` / `permission denied`，
 * 见 `sandbox-local/src/index.ts:211`）在中文机器上永不命中；
 * 改匹配中文文案则匹配的是乱码前的文本，同样永不命中。
 *
 * 可靠的信号是乱码里**活下来的 ASCII**：.NET 异常类型名与 PowerShell 的
 * 错误类别。GBK 与 UTF-8 对 ASCII 字节完全一致，所以它们穿过编码错乱后原样可见
 * （实测同一段输出里 `PermissionDenied:` 与 `UnauthorizedAccessException` 完好）。
 * 这比本地化文案更强：中文版、英文版、任何语言版都一样命中。
 *
 * 仍然保留 dsh 的三条英文签名：英文版 Windows 上没有编码错乱，
 * 且 node（EACCES）与部分 cmdlet 只给出那种措辞。
 *
 * **已知漏网**（写在明处，不假装全覆盖）：cmd.exe 的重定向失败给的是
 * 「文件名、目录名或卷标语法不正确」，一个 ASCII 标记都没有 —— 那条识别不了。
 * 影响很小：本层只跑 `powershell.exe`，cmd 只在模型自己从 PowerShell 里调起时出现；
 * 且漏报的后果仅仅是少一句提示，不影响任何约束。
 */
const DENIAL_SIGNATURES: readonly string[] = [
	// 与语言无关（ASCII，编码错乱也能活）—— 中文机器上唯一可命中的一组。
	"unauthorizedaccessexception",
	"permissiondenied",
	// dsh 的英文方言：英文版 Windows、node EACCES、部分 cmdlet。
	"access is denied",
	"access to the path",
	"permission denied",
];

/**
 * 这次执行看起来是被写约束拒了吗？只看 stderr。
 *
 * **安全支点，别改成「据此自动放宽」**（与 sandbox/index.ts 决策 9 同一条理由）：
 * stderr 完全由子进程控制，模型可以随便打印
 * `[Console]::Error.WriteLine('UnauthorizedAccessException')` 来伪造这个信号。
 * 这里安全的**唯一原因**是命中它只会**追加一段文字** —— 伪造的全部收益就是
 * 拿到一句本来也会给的提示，而真正的加宽必须经用户点头（requestEscalation）。
 * 谁若将来让它自动降级重跑，就是在重造一期修掉的那个逃逸：
 * 「写被拒 → 伪造信号 → 判定沙箱坏了 → 不受约束地重跑同一条命令」。
 *
 * 不用退出码把关（dsh 的 runner 规则会 gate 在特定退出码上）：那是为它的
 * 独立 runner 进程设计的（runner 自己的失败码与被包命令的退出码要分开），
 * 我们在进程内直接 spawn，没有这层歧义；而 PowerShell 的非终止错误退出码并不
 * 稳定，gate 上去只会漏报。
 */
function looksDenied(stderr: string): boolean {
	const haystack = stderr.toLowerCase();
	return DENIAL_SIGNATURES.some((signature) => haystack.includes(signature));
}

/**
 * 拒写时追加给模型的说明：**认得出是策略拒绝** + 有一条正规出路。
 *
 * 为什么两句都要有（照 dsh 把 denial marker 与 escalation hint 放在同一处的理由）：
 * 只说「被拒了」，模型会去反复改写命令（它以为是自己写错了）；
 * 只给出路而不点明原因，它又不知道何时该用。提示放在**决策点**上，
 * 不依赖模型回想工具描述里的某一行。
 */
const DENIAL_MARKER =
	"提示：上面的失败看起来是**沙箱写约束**拒绝了写入（不是命令语法问题）——" +
	"当前档位只允许写工作目录内的文件。若目标本应在工作目录内，请检查路径。";

/**
 * 提权提示。**只在真的能提权时才附上** —— 这是与 dsh 一致的取舍
 * （它也只在「composition advertises the escalation fields」时给这个 hint）。
 *
 * 理由：没有审批通道、或审批策略是「不询问」时，让模型去申请提权是**骗它**——
 * 那条申请必然被拒，白烧一轮，还让模型以为自己找到了出路。
 */
const ESCALATION_HINT =
	"若确实需要写到工作目录之外，可以带 sandbox_permissions + justification 重试**同一条命令**一次，" +
	"由用户决定是否批准。";

/**
 * 按**提权前的档位**给 denial 文案。read-only 沙箱连工作区内都写不了，
 * workspace-write 版的「只允许写工作目录内」会误导模型去重写一个区内路径。
 */
function denialNoteFor(mode: SandboxMode, canAsk: boolean): string {
	const marker =
		mode === "read-only"
			? "提示：上面的失败看起来是**只读沙箱**拒绝了写入（不是命令语法问题）——" +
				"当前档位不允许写入任何位置。"
			: DENIAL_MARKER;
	return canAsk ? `${marker}${ESCALATION_HINT}` : marker;
}

/** 用户批准提权后追加的说明。让模型知道这一次的约束确实放宽了，别再申请一遍。 */
const ESCALATED_NOTE =
	"注意：用户已批准本次提权，这条命令**未受操作系统级写入约束**。" +
	"批准只对本次调用有效，后续命令仍回到原档位。";

/* ── 提权判定 ────────────────────────────────────────────────────── */

/** 提权判定的结果：要么给出本次生效的档位，要么拦下（命令一行都不跑）。 */
type EscalationVerdict =
	| { readonly kind: "granted"; readonly mode: SandboxMode }
	| { readonly kind: "blocked"; readonly blocked: CommandBlocked };

function blocked(reason: string): EscalationVerdict {
	return { kind: "blocked", blocked: { blocked: true, category: "escalation-denied", reason } };
}

/**
 * 判定一次提权申请。**有序的 fail-closed 序列**（照 dsh 的 approveEscalation）：
 * 先查严格变宽 → 再查审批通道 → 再查审批策略 → 最后才问用户。
 *
 * 顺序本身就是语义：不合法的申请**不该惊动用户**（否则模型可以靠刷弹窗
 * 来骚扰用户，直到对方随手点了允许）。
 */
async function resolveEscalation(
	request: CommandEscalationRequest,
	command: string,
	settings: PermissionSettings,
	ask: SandboxRunnerOptions["requestEscalation"],
): Promise<EscalationVerdict> {
	const { toMode, justification } = request;
	// schema 已把取值钉死，这里再验一遍：入参来自模型，运行期不信任声明类型。
	if (!isSandboxMode(toMode)) {
		return blocked(`「${toMode}」不是有效的权限档位。`);
	}
	/*
	 * 严格变宽：在**执行期**对本次调用的有效档位校验，不烧进 schema
	 * （schema 是注册期全局的，有效模式是每次调用的真相 ——
	 * shared/permissions.ts 的 WIDER_MODES 注释）。
	 * 不变宽的申请直接拦，**不弹窗**。
	 */
	if (!canEscalate(settings.sandbox, toMode)) {
		return blocked(
			`不能从当前档位「${settings.sandbox}」提权到「${toMode}」——提权必须严格变宽。` +
				(settings.sandbox === "danger-full-access"
					? "当前档位本来就没有文件范围约束，这条命令不需要提权。"
					: ""),
		);
	}
	if (ask === undefined) {
		// 没有审批通道时「批准」不能凭空发生（子代理与无人值守都可能落到这里）。
		return blocked("当前会话没有可用的审批通道，无法申请提权。");
	}
	/*
	 * 生效审批策略为「不问人」时一律拒，**不弹窗** —— 判据走 shared/permissions
	 * 的 willAskUser（设置旋钮 × 无人值守合成在一处）：不问必须等于不做，
	 * 否则这个开关就成了完全敞开的后门。
	 */
	if (!willAskUser(settings)) {
		return blocked(
			"当前审批策略为「不询问」，需要用户批准的提权会被直接拒绝。请改用工作目录内的路径完成。",
		);
	}
	const approved = await ask({ toMode, justification, command });
	if (!approved) return blocked(`用户拒绝了本次提权申请（${toMode}）。`);
	return { kind: "granted", mode: toMode };
}

/** 上报给 daemon 的一次性诊断（用于设置页与日志）。 */
export interface SandboxDiagnostics {
	readonly available: boolean;
	readonly reason?: SandboxUnavailableReason;
	readonly detail?: string;
	/**
	 * 最近一次授权（prepare）的实测成本。**幂等命中也会报**（elapsedMs ≈ 1ms），
	 * 于是设置页能同时说清「第一次多少钱」与「之后多少钱」。
	 *
	 * 只上报不参与任何判定：可用性判定仍走 probe（执行时现场探测）。
	 */
	readonly prepare?: SandboxPrepareReport;
}

/**
 * 一次授权的成本读数。
 *
 * `elapsedMs` 是 `prepareSandbox` 已经算出来的值（此前被本层丢弃），
 * `entries`/`capped` 来自 worker 侧的有界扫描 —— 两个一起才回答得了用户的
 * 「为什么这次等这么久」（4 万条目 → 19 秒），单给耗时是答不完整的。
 */
export interface SandboxPrepareReport {
	readonly elapsedMs: number;
	/** 幂等快路径命中：ACE 已存在，这次没触发传播。 */
	readonly fastPath: boolean;
	/** 目录条目数（文件 + 子目录）；进程内直调路径没有这一项。 */
	readonly entries?: number;
	/** `entries` 达到扫描上限 → 它是下界。 */
	readonly capped?: boolean;
	/** 这次授权发生的时刻。 */
	readonly at: number;
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
	 * 只改 pristine 桶），要么先 dispose 宿主再重建（restartSession）。
	 * 所以活着的宿主看到的 cwd 不会在脚下变。
	 *
	 * 反过来说：这里若用 getter 读 bucket.cwd，反而会与权限门的快照可能不一致 ——
	 * 两处对「哪儿是工作区」的答案分歧，是比僵化更难查的 bug。
	 */
	readonly workspaceDir: string;
	/**
	 * 直接 spawn 的执行器（工具的缺省实现 `runCommand`），降级时用它。
	 *
	 * 类型故意**窄于** `CommandRunner`：它只回执行结果，回不了「被拦下」——
	 * 因为这条路没有策略层（就是拉起 powershell.exe 跑），没有任何东西可以
	 * 在这一层拒绝命令。让类型承载这个不变式，而不是靠注释约定：
	 * 否则 degrade 里 spread 它的返回值就可能悄悄合成出一个既 blocked
	 * 又带 stdout 的畸形结果。
	 *
	 * 位置参数**与 `CommandRunner` 逐一对齐**：这样 `runCommand` 能直接接上来
	 * （它把前四个里用不上的接了就丢），本层也不必为「谁来接信号」写适配层。
	 * 参数顺序一旦分叉，唯一的调用点就会静默传错位置。
	 * 第 6 位是**运行时注入补丁**（见 `runtimeEnv`）：本层现算后原样交给它，
	 * 于是降级直连 spawn 与沙箱路径拿到的是同一份环境。
	 */
	readonly fallback: (
		command: string,
		timeoutSeconds: number,
		onProgress?: (text: string) => void,
		escalation?: CommandEscalationRequest,
		signal?: AbortSignal,
		env?: Readonly<Record<string, string>>,
	) => Promise<CommandOutcome>;
	/**
	 * 运行时注入补丁的来源（SubTask 2.1.3）—— 生产是
	 * `core/runtime-inventory.ts` 的 `planRuntimeShellInjection().env`（核心侧读配置，
	 * 本层不碰配置目录：与 `getSettings` 同一取向）。
	 *
	 * **getter 而非快照**：用户在设置页改开关后，下一次执行的命令即生效（无需重启会话）。
	 * 缺省不带 = 不注入（环境块与接线之前逐字节相同）。
	 *
	 * 只作用于**子进程**环境：沙箱路径经 `SandboxRunRequest.env`，降级直连经
	 * `fallback` 的第 6 参 —— 都不回写 daemon 的 `process.env`
	 * （理由与边界见 core/runtimes/injection.ts 文件头）。
	 */
	readonly runtimeEnv?: () => Readonly<Record<string, string>>;
	/** 诊断变化时回调（探测结论、降级原因）。同一结论只报一次。 */
	readonly onDiagnostics?: (diagnostics: SandboxDiagnostics) => void;
	/**
	 * 审计写入通道 —— 沙箱一类的**唯一写入点**（spec: add-managed-runtimes 阶段 4）：
	 * 拒绝执行、准备失败与提权决定都在本层产生，所以留痕也放在本层，
	 * 三个调用点（主会话 / 子代理 / 无人值守）不必各记一遍。
	 *
	 * 缺省不写：本文件的单测会在拒绝与提权两条分支上跑，直接写盘会污染真实
	 * 配置目录；「这次会话要不要留痕」是 daemon 装配层的决定。
	 */
	readonly onAudit?: AuditSink;
	/**
	 * 发起一次提权审批。**省略 = 没有审批通道**，于是任何提权申请都被拒
	 * （fail-closed：没人能批准的时候「批准」不能凭空发生）。
	 *
	 * 结构化回调而不是审批服务类型（照 dsh 的 EscalationApprover）：
	 * 本层因此不必认识 IPC 或会话桶，也保住了现有的可注入测试范式 ——
	 * 「用户批准后确实不进沙箱」这条判断必须能在任何平台上被测到。
	 *
	 * resolve `true` = 用户批准了**这一次**。
	 */
	readonly requestEscalation?: (request: {
		/** 申请的目标档位。 */
		readonly toMode: SandboxMode;
		/** 模型给的理由，原样展示给用户。 */
		readonly justification: string;
		/** 要执行的命令原文 —— 用户要看见自己在给什么放行。 */
		readonly command: string;
	}) => Promise<boolean>;
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
	readonly prepare: (request: PrepareRequest) => Promise<SandboxPrepareResult>;
	readonly run: typeof runSandboxed;
}

const REAL_SANDBOX: SandboxFacade = {
	probe: probeSandbox,
	/*
	 * prepare 走 worker：它是唯一会**同步**堵住 daemon 的一步
	 *（SetNamedSecurityInfoW 在整棵子树上传播继承 ACE）。probe 与 run 都不换 ——
	 * 前者只是几次 Win32 调用（有缓存），后者本来就是起子进程等结果。
	 * 现场与数据见 sandbox-prepare-protocol.ts 的文件头。
	 */
	prepare: prepareSandboxInWorker,
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
 * 不会各自触发一遍传播。**存结果而不只是存「好了」**：授权耗时与目录规模
 * 是设置页要用的成本读数，丢掉就再也拿不回来（此前确实被丢掉了）。
 */
const prepareByDir = new Map<string, Promise<SandboxPrepareResult>>();

/** 仅供测试：清掉按目录的授权记忆。 */
export function resetSandboxRunnerForTest(): void {
	prepareByDir.clear();
}

/**
 * 确保某个目录已授权。失败会**记住失败**（不重试）——
 * 授权失败通常是结构性的（目录不归当前用户、卷不支持 ACL），
 * 每条命令重试一遍只是让每次执行都多等一次失败。
 */
function ensurePrepared(
	workspaceDir: string,
	prepare: SandboxFacade["prepare"],
): Promise<SandboxPrepareResult> {
	const existing = prepareByDir.get(workspaceDir);
	if (existing !== undefined) return existing;
	const started = prepare({ workspaceDir, writableDirs: [workspaceDir] });
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
				const outcome = await ensurePrepared(workspaceDir, sandbox.prepare);
				// 成本读数随诊断一起上报：设置页据此说清「这次为什么慢、之后还慢不慢」。
				onDiagnostics?.({ available: true, prepare: prepareReportOf(outcome) });
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

	/**
	 * 沙箱不可用 → **拒绝执行**，绝不无约束重跑。
	 *
	 * 对齐 dsh 的 `SandboxUnavailableError`（"refusing to run the command
	 * unconfined"）：read-only / workspace-write 档下，探测失败、授权失败、
	 * 令牌派生失败、spawn 失败——任何「沙箱装不起来」的情形都拒，把原因
	 * 回给模型。不存在「降级到无约束跑」这条路：那会让写约束静默消失。
	 * 官方出路与 dsh 相同：切 danger-full-access（用户明示的无约束档）。
	 */
	function refuse(reason: SandboxUnavailableReason, detail: string): CommandBlocked {
		report({ available: false, reason, detail });
		/*
		 * 审计留痕：这是「沙箱拒绝执行」的唯一出口（探测失败 / 授权失败 /
		 * 令牌与 spawn 失败都收敛到这里），所以沙箱一类的三类形态在这里一次记全。
		 * 理由取与给模型同一句 describeReason —— 审计与模型看到的原因不许出现两套说法。
		 */
		options.onAudit?.({
			category: "sandbox",
			outcome: "blocked",
			detail: clipAuditDetail(
				`沙箱不可用，命令未执行（${describeReason(reason)}${detail === "" ? "" : `：${detail}`}）`,
			),
		});
		return {
			blocked: true,
			category: "sandbox-unavailable",
			reason:
				"命令未执行：本机的命令沙箱不可用" +
				`（${describeReason(reason)}${detail === "" ? "" : `：${detail}`}）。` +
				"为避免在没有操作系统写入约束的情况下执行命令，已拒绝本次执行。" +
				"请改用文件工具完成任务；确实需要 shell 时，可在设置中切换到「允许完全访问」" +
				"（无沙箱约束，用户明示授权）后重试。",
		};
	}

	return async (command, timeoutSeconds, onProgress, escalation, signal) => {
		const settings = options.getSettings();
		/*
		 * 运行时注入补丁**每次执行现算**（getter）：设置页改开关后下一次命令即生效。
		 * 算出来的这一份同时喂给两条 spawn 路径（沙箱 / 降级直连），口径因此只有一份。
		 */
		const injectedEnv = options.runtimeEnv?.();
		// 没有补丁时**不带** `env` 字段：请求形状与接线之前逐字节相同。
		const sandboxEnv = injectedEnv === undefined ? {} : { env: injectedEnv };

		/*
		 * 提权申请先判定，且**先于任何执行** —— 被拒时命令一行都不跑。
		 * 判定本身不执行命令，只决定「这一次按哪个档位跑」。
		 */
		let mode: SandboxMode = settings.sandbox;
		let escalated = false;
		if (escalation !== undefined) {
			const verdict = await resolveEscalation(
				escalation,
				command,
				settings,
				options.requestEscalation,
			);
			if (verdict.kind === "blocked") {
				// 提权被拒 = 命令一行都没跑（fail-closed）。审计要的是这个事实 +
				// 为什么拒（理由与弹窗、工具结果同源，不另写一句）。
				options.onAudit?.({
					category: "sandbox",
					outcome: "blocked",
					detail: clipAuditDetail(`提权申请被拒，命令未执行：${verdict.blocked.reason}`),
				});
				return verdict.blocked;
			}
			/*
			 * 批准提权是全系统唯一会「放宽写约束」的动作，属审计要管的放行：
			 * 单列一条 allowed（不是 blocked 的反面凑数）——它是事后回答
			 * 「谁在什么时候把约束放开了」的唯一凭据。
			 */
			options.onAudit?.({
				category: "sandbox",
				outcome: "allowed",
				detail: clipAuditDetail(`用户批准本次提权到「${verdict.mode}」（仅本次调用有效）：${command}`),
			});
			mode = verdict.mode;
			escalated = true;
		}

		/*
		 * danger-full-access（用户选择或一次性提权获批）是唯一不经沙箱的档：
		 * 「没有写入约束」就是该档的语义（dsh 同义：consumer 不调 confine）。
		 * 用户自己选的不加说明（说了是撒谎）；提权获批的加 ESCALATED_NOTE
		 * （让模型知道放宽了、且只此一次）。
		 */
		if (mode === "danger-full-access") {
			/*
			 * 提权申请在这一支已经判定完了（要么是用户自己选的档，要么已获批），
			 * 不再往下传：这条路没有策略层能消费它。
			 * 信号仍然要传 —— 直连 spawn 的 powershell 同样得能被「停止」收掉
			 * （否则它和沙箱里的进程一样会挂到用户以为已经停掉之后）。
			 */
			const outcome = await options.fallback(
				command,
				timeoutSeconds,
				onProgress,
				undefined,
				signal,
				injectedEnv,
			);
			return escalated ? { ...outcome, note: ESCALATED_NOTE } : outcome;
		}

		const { workspaceDir } = options;
		let probe: SandboxAvailability;
		try {
			// 执行时现场探测（dsh 的 confine 同构：能力是执行时事实，
			// 不依赖预热缓存——预热只是提前做了同一件事）。
			probe = await sandbox.probe(workspaceDir);
		} catch (error) {
			return refuse("ffi-load-failed", errorDetail(error));
		}
		if (!probe.available) {
			return refuse(probe.reason, probe.detail);
		}

		/*
		 * read-only：不 prepare（只读沙箱不需要任何 ACE），直接以无写能力的
		 * 受限令牌跑。命令写**任何位置**都会被 OS 拒（含工作区内），
		 * denial note 用只读版文案。
		 */
		if (mode === "read-only") {
			try {
				const outcome = await sandbox.run({
					command: "powershell.exe",
					args: ["-NoProfile", "-NonInteractive", "-Command", command],
					cwd: workspaceDir,
					workspaceDir,
					writableDirs: [],
					timeoutMs: timeoutSeconds * 1000,
					mode: "read-only",
					signal,
					...sandboxEnv,
				});
				report({ available: true });
				if (looksDenied(outcome.stderr)) {
					const canAsk = options.requestEscalation !== undefined && willAskUser(settings);
					return {
						...outcome,
						note: denialNoteFor(mode, canAsk),
					};
				}
				return outcome;
			} catch (error) {
				return refuse(classifyFailure(error), errorDetail(error));
			}
		}

		let prepared: SandboxPrepareResult;
		try {
			prepared = await awaitWithNotice(ensurePrepared(workspaceDir, sandbox.prepare), onProgress);
		} catch (error) {
			// 授权失败 = 沙箱装不起来 → 拒绝（未授权的沙箱会把区内写入也拒掉，
			// 无约束跑则写约束静默消失——两条路都不如拒）。
			return refuse(classifyFailure(error), errorDetail(error));
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
				signal,
				...sandboxEnv,
			});
			report({ available: true, prepare: prepareReportOf(prepared) });
			/*
			 * 沙箱**是好的**，命令自己被拒了 —— 如实回传结果（不重跑），
			 * 只追加一段让模型看得懂的说明。
			 *
			 * 这里绝不能改成「据此自动放宽后重跑」：stderr 由子进程控制，
			 * 模型可以伪造这个信号（详见 looksDenied 的注释）。
			 */
			if (looksDenied(outcome.stderr)) {
				/*
				 * 提权提示只在**真的能提权**时附上：没有审批通道、或生效策略是
				 * 「不问人」时，让模型去申请等于骗它白烧一轮（那条申请必然被
				 * resolveEscalation 拒掉）。两处用的是**同一个判据**
				 * （willAskUser —— 生效策略的唯一出处），不会分歧。
				 */
				const canAsk =
					options.requestEscalation !== undefined &&
					willAskUser(settings) &&
					canEscalate(mode, "danger-full-access");
				return { ...outcome, note: denialNoteFor(mode, canAsk) };
			}
			return outcome;
		} catch (error) {
			// 装配失败（令牌派生、spawn）同口径拒绝。
			return refuse(classifyFailure(error), errorDetail(error));
		}
	};
}

/** 原因枚举 → 拒绝文案里的一句话。 */
function describeReason(reason: SandboxUnavailableReason): string {
	switch (reason) {
		case "not-windows":
			return "当前系统不是 Windows";
		case "ffi-load-failed":
			return "系统调用组件加载失败";
		case "token-creation-failed":
			return "受限令牌创建失败";
		case "acl-grant-failed":
			return "工作目录授权失败";
		case "unsupported-filesystem":
			return "工作目录所在磁盘不支持权限控制";
		case "process-start-failed":
			return "命令执行环境的启动自检未通过";
		case "prepare-worker-failed":
			return "授权组件未能启动";
		case "disabled-by-setting":
			return "已被设置关闭";
		default:
			return "原因未知";
	}
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

/**
 * 授权结果 → 上报用的成本读数。
 *
 * 时刻取「上报这一刻」而不是 `prepareSandbox` 内部的起点：本函数只服务于
 * 「最近一次授权是什么时候」，精度到秒就够，为一个展示字段去改 prepare 的
 * 返回形状不划算。
 */
function prepareReportOf(outcome: SandboxPrepareResult): SandboxPrepareReport {
	return {
		elapsedMs: outcome.elapsedMs,
		fastPath: outcome.fastPath,
		...(outcome.entries === undefined ? {} : { entries: outcome.entries }),
		...(outcome.capped === undefined ? {} : { capped: outcome.capped }),
		at: Date.now(),
	};
}
