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
		description: "只看不改：可以读取与搜索，任何写入、修改、删除都会被拒绝。",
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
	/** 一句话说明强制力边界，直接展示给用户。 */
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
