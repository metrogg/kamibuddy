/**
 * 权限词汇表：沙箱模式 × 审批策略 + 预设表。
 *
 * **词汇直接采用 codex 与 dsh 已收敛的那一套，不自创方言。**
 * 两个独立项目（codex `protocol/src/config_types.rs:104`、
 * dsh `packages/sandbox/sandbox/src/index.ts`）的沙箱模式取值逐字相同，
 * 说明这是业界答案；自造名字只会让日后对照源码时多一层翻译。
 *
 * 放 shared/ 是因为三处都要用同一份：daemon 落盘校验、权限门判定、设置页渲染。
 * 分析与证据见 docs/workbuddy分析/09-sandbox-and-permissions.md。
 */

/* ── 两个独立旋钮 ────────────────────────────────────────────────── */

/**
 * 文件效果的作用范围。
 *
 * - `read-only`：只读。任何写/改/删都拒（**codex 的默认值**，最小权限起步）。
 * - `workspace-write`：工作区内可写，区外询问。
 * - `danger-full-access`：不做范围约束。**注意仍受"受保护路径"约束** ——
 *   凭据目录在任何模式下都不可碰（WorkBuddy 同样把配置写保护做成独立一层，
 *   即使 bypassPermissions 也拦）。
 */
export type SandboxMode = "read-only" | "workspace-write" | "danger-full-access";

export const SANDBOX_MODES: readonly SandboxMode[] = [
	"read-only",
	"workspace-write",
	"danger-full-access",
] as const;

/**
 * 需要审批时怎么办。
 *
 * - `ask`：弹窗询问用户。
 * - `never`：**确定性拒绝**，不弹窗（照 dsh 的语义：
 *   "every ask resolves 'rejected' deterministically"）。
 *   注意不是"静默放行" —— 那是相反的语义，会让无人值守场景变成完全敞开。
 *
 * codex 还有一档 `Granular`（按审批来源分别开关：shell 提权 / 规则 / 技能 /
 * MCP elicitation），表达力更强。第一版不做，但类型是联合类型，
 * 加一个成员即可扩展，不必重构。
 */
export type ApprovalPolicy = "ask" | "never";

export const APPROVAL_POLICIES: readonly ApprovalPolicy[] = ["ask", "never"] as const;

/**
 * 强制力的诚实上报。
 *
 * `partial` 表示"不能保证所有承诺的文件效果" —— 需要绝对边界的调用方
 * **不得把它当作 full**（照 dsh 的 SandboxEnforcement 语义）。
 *
 * 我们当前**全平台都是 partial**：没有 OS 级沙箱，`read-only` 靠权限门拦住
 * 已知的写工具，但拦不住"模型让某个自定义工具去写文件"这类间接路径。
 * 界面必须如实说明 —— pi 的 security.md 明确警告过"半个沙箱是错误的安全感"。
 */
export type SandboxEnforcement = "full" | "partial";

/**
 * 沙箱不可用的原因（spec: add-windows-acl-sandbox）。
 *
 * 照 WorkBuddy 的「二值 + reason code」而不是假装分级：产品面只回答
 * 「生效了没有」+「为什么没生效」，不发明 `full`/`partial` 之外的中间态。
 *
 * 注意即使沙箱**完全正常生效**，`enforcement` 仍然是 `partial` ——
 * `WRITE_RESTRICTED` 机制上只约束写，读与网络不受任何约束（已实测：
 * 受限子进程仍能读工作区外文件）。所以本枚举回答的是「写约束在不在」，
 * 不是「隔离完不完整」。
 */
export type SandboxUnavailableReason =
	/** 非 Windows 平台。受限令牌是 Windows 特有机制。 */
	| "not-windows"
	/** koffi 加载失败（缺预编译产物，或运行环境不兼容）。 */
	| "ffi-load-failed"
	/** 受限令牌派生失败。 */
	| "token-creation-failed"
	/** ACL 授权失败（目录不归当前用户所有，或权限被组策略限制）。 */
	| "acl-grant-failed"
	/** 工作区所在卷不支持 ACL（FAT/exFAT）——沙箱会静默无效，必须报出来。 */
	| "unsupported-filesystem"
	/**
	 * 受限令牌下**进程起不来**（自检未通过）。
	 *
	 * 2026-09-15 的真实故障就是这一类：PowerShell 死在 DLL 早期初始化
	 * （退出码 `0xC0000142`），命令一行都没执行，而这个失败被当成「命令执行
	 * 失败」原样报给了模型 —— 等于沙箱静默废掉了每一条命令。
	 *
	 * 加这一档的意义：把「沙箱让所有命令都失败」与「这条命令自己失败」分开。
	 * 前者必须降级并说明，后者必须如实回传（详见 sandbox/index.ts 的
	 * selfCheckSandbox：为什么自检只能放在探测期而不是每条命令）。
	 */
	| "process-start-failed"
	/** 被设置显式关闭。 */
	| "disabled-by-setting";

/* ── 预设：旋钮的捆绑包 ──────────────────────────────────────────── */

/**
 * 一个预设 = 两个旋钮的取值 + 展示信息。
 *
 * 照 dsh 的分工（`packages/interaction/permission-presets`）：
 * **旋钮是真相，预设只是 UI 糖**。执行只读旋钮值；预设仅用于
 * 记录"用户当时选的是哪一档"这个意图 —— 两个预设碰巧同捆绑时，
 * 界面才不会把用户选的显示成另一个。
 */
export interface PermissionPreset {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly sandbox: SandboxMode;
	readonly approval: ApprovalPolicy;
}

/**
 * 预设表。对标 WorkBuddy 设置里的「默认权限 / 允许完全访问」那组选项。
 *
 * `default` 的取值 = 我们今天已有的行为（工作区内放行、区外询问、凭据拒），
 * 所以引入预设**不改变任何现有行为**，只是把它显式化、可切换。
 */
export const PERMISSION_PRESETS: readonly PermissionPreset[] = [
	{
		id: "readonly",
		label: "只读",
		description:
			"只看不改：可以读取与搜索；命令可在只读沙箱中执行（无法写入任何位置）。任何写入、修改、删除都会被拒绝。",
		sandbox: "read-only",
		approval: "ask",
	},
	{
		id: "default",
		label: "默认权限",
		description: "工作空间内自由读写；要动工作空间之外的文件时询问你。",
		sandbox: "workspace-write",
		approval: "ask",
	},
	{
		id: "full",
		label: "允许完全访问",
		description: "不限制文件范围，且不再逐次询问。凭据目录仍然受保护。",
		sandbox: "danger-full-access",
		approval: "never",
	},
] as const;

/** 旋钮组合不匹配任何预设时的显示值（照 dsh 的 CUSTOM_PRESET）。 */
export const CUSTOM_PRESET = "custom";

/** 当前生效的权限设置。旋钮是权威，presetId 只是意图记录。 */
export interface PermissionSettings {
	readonly sandbox: SandboxMode;
	readonly approval: ApprovalPolicy;
	/** 用户选的预设 id；旋钮被单独改动后为 undefined（界面显示「自定义」）。 */
	readonly presetId?: string;
}

/** 默认设置 = 今天的行为。 */
export const DEFAULT_PERMISSIONS: PermissionSettings = {
	sandbox: "workspace-write",
	approval: "ask",
	presetId: "default",
};

/**
 * 设置页读回的权限状态。
 *
 * 带上 enforcement 与说明文案，是为了**不让界面假装有沙箱**：
 * 我们当前没有 OS 级隔离，`read-only` 靠权限门拦已知写工具实现，
 * 界面必须如实说明这一点（pi security.md 警告过"半个沙箱是错误的安全感"）。
 * 文案由 daemon 给而不是 UI 里写死 —— 将来真接上 OS 沙箱时只改一处。
 */
export interface PermissionInfo {
	readonly settings: PermissionSettings;
	readonly enforcement: SandboxEnforcement;
	/**
	 * 一句话说明强制力边界，直接展示给用户。
	 *
	 * 沙箱状态（生效与否、未生效的原因）也**并进这段文案**，而不是另开
	 * 结构化字段：设置页只把它整段渲染出来，多加字段就是没有读取方的死代码。
	 * 需要机器可读的诊断时看事件日志的 `sandbox_status`（那里有原因枚举与细节）。
	 */
	readonly enforcementNote: string;
}

/** 由旋钮反查预设 id；无匹配返回 `custom`。 */
export function presetIdFor(sandbox: SandboxMode, approval: ApprovalPolicy): string {
	const hit = PERMISSION_PRESETS.find((p) => p.sandbox === sandbox && p.approval === approval);
	return hit?.id ?? CUSTOM_PRESET;
}

export function findPreset(id: string): PermissionPreset | undefined {
	return PERMISSION_PRESETS.find((p) => p.id === id);
}

export function isSandboxMode(value: string): value is SandboxMode {
	return SANDBOX_MODES.includes(value as SandboxMode);
}

export function isApprovalPolicy(value: string): value is ApprovalPolicy {
	return APPROVAL_POLICIES.includes(value as ApprovalPolicy);
}

/* ── 提权阶梯 ────────────────────────────────────────────────────── */

/**
 * 「严格变宽」表：某个模式下的调用**只能**提权到这些模式（照 dsh 的 WIDER_MODES）。
 *
 * 为什么必须是严格变宽：否则模型可以把 `danger-full-access` 的会话"提权"到
 * `read-only` 再声称受限，或在阶梯上反复横跳绕过审批记录。
 *
 * 注意 dsh 的一条设计说明值得照做：**检查发生在执行期，而不是烧进工具 schema** ——
 * schema 是注册期全局的，而有效模式是每次调用的真相。
 */
export const WIDER_MODES: Readonly<Record<SandboxMode, readonly SandboxMode[]>> = {
	"read-only": ["workspace-write", "danger-full-access"],
	"workspace-write": ["danger-full-access"],
	"danger-full-access": [],
};

/** 从 `from` 提权到 `to` 是否合法（必须严格变宽）。 */
export function canEscalate(from: SandboxMode, to: SandboxMode): boolean {
	return WIDER_MODES[from].includes(to);
}

/**
 * 可申请的提权目标（工具 schema 用）。
 *
 * `read-only` 是地板，没有东西会提权**到**它 —— 照 dsh 的 ESCALATION_TARGETS。
 * schema 常驻广告这一整套取值，**不按当前档位裁剪**：schema 是注册期全局的，
 * 而有效模式是每次调用的真相（WIDER_MODES 注释里的同一条理由）。
 * 裁剪会让「当前档位之下的会话」看到一个空 enum，等于没有提权杠杆。
 */
export const ESCALATION_TARGETS: readonly SandboxMode[] = ["workspace-write", "danger-full-access"];

/**
 * 校验提权入参的成对关系（schema 表达不了的那部分，照 dsh 的 validateEscalationArgs）。
 *
 * 返回错误原因字符串；合法时返回 undefined。**不抛异常**是有意的，与
 * 危险命令检查器同一条约定（powershell-tool.ts）：这不是执行失败，
 * 模型要拿着原因改写调用，`isError` 反而诱导它原样重试。
 *
 * 三条规则：申请提权必须带理由（没理由的审批弹窗是让用户盲签）；
 * 理由不能孤立出现（那是驱动不了任何东西的噪音）；理由不能是空白。
 */
export function validateEscalationArgs(
	sandboxPermissions: string | undefined,
	justification: string | undefined,
): string | undefined {
	if (sandboxPermissions !== undefined && justification === undefined) {
		return "申请提权（sandbox_permissions）必须同时给出 justification —— 审批弹窗要把理由原样展示给用户。";
	}
	if (justification !== undefined && sandboxPermissions === undefined) {
		return "justification 只能与 sandbox_permissions 一起使用。";
	}
	if (justification !== undefined && justification.trim() === "") {
		return "justification 不能为空，请用一句话说明为什么这条命令需要更宽的权限。";
	}
	return undefined;
}

/* ── 审批策略的应用 ──────────────────────────────────────────────── */

/**
 * 把审批策略作用在一个"需要询问"的判定上。
 *
 * 分离的理由：`decide()` 只管沙箱模式下的路径归属（纯函数、易测），
 * 审批策略是另一个旋钮，在这里合成。
 *
 * `never` → 拒绝而非放行（**fail-closed**）。这条是安全语义的核心：
 * 无人值守时"不问"必须等于"不做"，而不是"随便做"。
 */
export function resolveAsk(policy: ApprovalPolicy): "ask" | "deny" {
	return policy === "ask" ? "ask" : "deny";
}

/* ── 持久前缀规则（permissions.rules.json） ────────────────────── */

/**
 * 一条持久的前缀规则（spec: add-permission-rules-engine）。
 *
 * 为什么住 shared/ 而不是 extensions/permission-rules.ts：
 * 依赖方向是机械校验的（scripts/check-dependency-rules.ts）——
 * core/ 不许 import extensions/，而规则文件的读写 store 在
 * core/permission-rules-store.ts；批准写回（Task 3）的 IPC 载荷与审批弹窗
 * 又要经过 renderer（只许 import shared/）。三处都要用的契约只能放这里。
 *
 * 没有 "ask" 态：无命中本来就是询问，写一条 ask 规则等于没写。
 */
export interface PermissionRule {
	/** 规则作用的工具名。v1 只有 "powershell"（bash 无检查器，规则面先不覆盖）。 */
	readonly tool: string;
	/**
	 * 命令段前缀：段以它开头、且其后紧跟空白或正好结尾才算命中
	 * （git 命中 git status 与 git，不命中 gitx）。
	 */
	readonly prefix: string;
	readonly action: "allow" | "deny";
}

/**
 * 有本地路径概念的只读工具家族（spec: extend-permission-rules-to-paths）。
 *
 * 这五个工具读的都是本地文件系统，权限语义完全相同（工作区内放行、区外
 * 低风险询问、凭据目录禁读）：路径规则用一条 `tool: "read"` 统一命中整个
 * 家族，不逐工具名区分 —— 用户批了「这个目录以后别问」，不该因为模型下次
 * 换 grep 而不是 read 就再问一遍。
 *
 * 住 shared/ 而不在 permission-policy.ts：policy 已 import 规则引擎模块
 * （permission-rules.ts），反向 import 会构成循环依赖（与本文件收留
 * firstTokenPrefix 同一条理由）；而批准写回校验（permission-rules.ts）、
 * 权限门（permission-gate.ts）、判定链（permission-policy.ts）三方都要
 * 这份名单，shared/ 是唯一各方都能到的位置。
 */
export const LOCAL_READ_TOOLS: ReadonlySet<string> = new Set([
	"read",
	"read_document",
	"find",
	"grep",
	"ls",
]);

/**
 * 解析 permissions.rules.json 的正文，返回合法规则行。
 *
 * 全程降级不抛错（与 memory.ts 同口径）：规则文件是用户数据 —— 手改、
 * 同步冲突、写一半断电都可能碰坏它。一行坏不该让整个权限判定炸掉，
 * 也不该文件一坏就静默全放行；坏文件/坏行 = 该行不存在，判定自然回落到
 * 「无命中 → 询问」这个 fail-closed 默认。
 *
 * version 字段不校验：v1 只有 1，将来加版本时老读法忽略新字段即可，
 * 现在写死校验等于给未来的自己留一颗拒读的雷。
 */
export function parseRulesFile(json: string): readonly PermissionRule[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return [];
	}
	if (typeof parsed !== "object" || parsed === null) return [];
	const rules = (parsed as { readonly rules?: unknown }).rules;
	if (!Array.isArray(rules)) return [];
	const out: PermissionRule[] = [];
	for (const row of rules as unknown[]) {
		if (typeof row !== "object" || row === null) continue;
		const record = row as Record<string, unknown>;
		const tool = record["tool"];
		const prefix = record["prefix"];
		const action = record["action"];
		if (typeof tool !== "string" || tool === "") continue;
		if (typeof prefix !== "string" || prefix.trim() === "") continue;
		if (action !== "allow" && action !== "deny") continue;
		out.push({ tool, prefix, action });
	}
	return out;
}

/* ── 命令拆分与写回前缀提取 ────────────────────────────────────── */

/*
 * 这两个函数与 PermissionRule 同住 shared/ 的理由和 parseRulesFile 一样：
 * 批准写回（spec: add-permission-rules-engine Task 3）的弹窗在 renderer
 * （只许 import shared/）要用 firstTokenPrefix 决定给不给「以后都允许
 * 「{首词}」开头的命令」选项，daemon 又要用同款校验守住 IPC 载荷 ——
 * 而 firstTokenPrefix 依赖 splitCommand，两个只能一起搬。
 * extensions/permission-rules.ts 保留 re-export，规则引擎的 API 面不断。
 */

/**
 * 按**未加引号**的 `&&`、`||`、`;` 把命令切成段；trim、空段丢弃。
 *
 * 不切单 `|`：PowerShell 管道是单条数据流，`Get-ChildItem | Select-Object Name`
 * 是日常写法，切了会把正常命令碎成「两段命令」而被规则误判。
 * 代价（有意的注入面，写清而不是假装不存在）：
 * `git status | Remove-Item x` 整段以 git 开头，会命中 git 的 allow 规则被放行 ——
 * 管道后段藏在段内，规则看不到它。v1 接受这个缺口，因为兜底在工具层：
 * 危险命令检查器（command-guard）对破坏类命令独立拦截，与规则互不相干
 * （「门管要不要问人，检查器管能不能跑」）。
 *
 * 引号不区分单双：PowerShell 里 '...' 是字面量、"..." 内 $ 会展开，语义不同，
 * 但拆分只关心「分隔符是否在字符串里」，两种引号内的分隔符都不切。
 *
 * 不解释转义（反引号、`""`）：看错的后果是引号状态提前结束、命令被多切 ——
 * 多出的段无命中 → 回落询问，错误方向是 fail-closed 的，所以不为它堆复杂度。
 */
export function splitCommand(command: string): readonly string[] {
	const segments: string[] = [];
	let current = "";
	let quote: string | undefined;
	const flush = (): void => {
		const trimmed = current.trim();
		if (trimmed !== "") segments.push(trimmed);
		current = "";
	};
	let i = 0;
	while (i < command.length) {
		const ch = command.charAt(i);
		if (quote !== undefined) {
			if (ch === quote) quote = undefined;
			current += ch;
			i += 1;
			continue;
		}
		if (ch === "'" || ch === '"') {
			quote = ch;
			current += ch;
			i += 1;
			continue;
		}
		if (ch === ";") {
			flush();
			i += 1;
			continue;
		}
		if ((ch === "&" && command.charAt(i + 1) === "&") || (ch === "|" && command.charAt(i + 1) === "|")) {
			flush();
			i += 2;
			continue;
		}
		// 单个 &（调用运算符）与单个 |（管道）都不是分隔符，原样保留。
		current += ch;
		i += 1;
	}
	flush();
	return segments;
}

/**
 * 解释器/包装器首词黑名单（批准写回用）。
 *
 * 「允许 python 开头的所有命令」等于允许一切 —— `python -c` 什么都能跑，
 * 前缀根本代表不了这类命令的真实行为。写回这种规则等于把门钥匙交出去，
 * 所以弹窗对这些首词不提供写回选项。
 */
const INTERPRETER_TOKENS: ReadonlySet<string> = new Set([
	"powershell",
	"pwsh",
	"cmd",
	"iex",
	"irm",
	"python",
	"python3",
	"node",
	"npm",
	"npx",
	"bash",
	"sh",
	"wsl",
]);

/**
 * 内联脚本旗标（小写比较）：首词后跟这些旗标时，命令本体在旗标参数里，
 * 首词同样代表不了命令 —— 与解释器黑名单同一条理由。
 * 精确匹配第二词；PowerShell 的参数缩写（-enc 之类）v1 不展开，
 * 漏掉的后果只是不提供写回选项（保守方向），不为它堆参数解析器。
 */
const INLINE_SCRIPT_FLAGS: ReadonlySet<string> = new Set(["-c", "-e", "-command", "-encodedcommand"]);

/**
 * 取批准写回用的前缀（命令首词）；不适合写回时返回 undefined。
 *
 * 三种不写回：
 *   1. 多段命令（`a && b`）—— 链式命令的「首词」语义模糊，
 *      写回 `a` 的前缀会让 `a && anything` 里的 anything 也被顺带覆盖判定；
 *   2. 首词是解释器/包装器（含 .exe 后缀形态，比较不分大小写）；
 *   3. 首词后跟 -c / -e / -Command / -EncodedCommand 的内联脚本形态。
 *
 * 返回首词原文（不做大小写归一）—— 规则按原文记，与 matchesPrefix 的
 * 大小写敏感语义一致。
 */
export function firstTokenPrefix(command: string): string | undefined {
	const segments = splitCommand(command);
	if (segments.length !== 1) return undefined;
	const segment = segments[0];
	if (segment === undefined) return undefined;
	const spaceAt = segment.search(/\s/);
	const first = spaceAt === -1 ? segment : segment.slice(0, spaceAt);
	if (first === "") return undefined;
	// 黑名单比较不分大小写：PowerShell 命令不区分大小写，
	// 黑名单若区分就成了「换个大小写就能写回 IEX」的放行缝。
	const bare = first.toLowerCase().replace(/\.exe$/, "");
	if (INTERPRETER_TOKENS.has(bare)) return undefined;
	const rest = spaceAt === -1 ? "" : segment.slice(spaceAt).trimStart();
	const second = rest.split(/\s/, 1)[0]?.toLowerCase() ?? "";
	if (INLINE_SCRIPT_FLAGS.has(second)) return undefined;
	return first;
}
