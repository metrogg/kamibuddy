/**
 * 审计记录：**三类来源共用的唯一结构**（命令安全 / 沙箱 / 运行时）+ 审计管理动作。
 *
 * 为什么三类必须同构（spec: add-managed-runtimes 阶段 4）：
 * 它们的来源在进程里分得很开 —— 命令安全在 extensions/command-guard（工具执行前），
 * 沙箱在 daemon/sandbox-runner（执行器装配层），运行时在 core/runtimes 的安装/探测
 * （三个阶段、三种失败形态）。若各写各的记录（各有各的字段名、各有各的「结论」取值），
 * 面板要为每一类写一套渲染、导出要写一套格式化、将来加第四类（如权限门拒绝）时
 * 又要再写两套 —— 而这四处（写、读、渲染、导出）一旦分叉，症状是「导出里少了某类」
 * 或「面板显示的结论与导出不一致」，且没有任何测试会变红。所以：**只有这一份结构**，
 * 三类都往里填，渲染与导出都从这里取标签（`auditLine` / `renderAuditRecords`）。
 *
 * 为什么是「时间 + 类别 + 结论 + 详情」四字段：正好回答审计的唯一问题
 * 「什么时候、哪个防线、放行还是拦下、具体是什么」。不再加字段 —— 加字段就等于
 * 允许某类带私货，私货一多，渲染与导出又回到「每类各一套」的老路。
 *
 * 放 shared 而不是 core：IPC payload 类型必须能被 renderer 引用（AGENTS.md §1.3
 * 的 renderer → shared）。这里的纯函数只有格式化，零 IO、零 Node 依赖。
 */

/** 记录来源。audit 一类是**审计自身的动作**（清空），见 core/audit-log.ts 的 clearAuditRecords。 */
export type AuditCategory = "command" | "sandbox" | "runtime" | "audit";

/**
 * 结论（闭集）。取值按「对这次动作而言最重要的事实」定，不做同义词细分：
 *   blocked  拦下（命令被检查器拦、沙箱拒绝执行、提权被拒）
 *   allowed  放行（用户批准提权 —— 唯一会「放宽约束」的放行）
 *   failed   失败（运行时装不上/不可用）
 *   disabled 被用户显式关闭（区别于 failed：不是坏了，是用户不要）
 *   cleared  审计记录被清空（清空动作本身留痕）
 * 细粒度原因（是哪类拦截、失败在哪个相位）进 detail，不进枚举 ——
 * 枚举一旦按来源细分，就又要为每类维护一套取值。
 */
export type AuditOutcome = "blocked" | "allowed" | "failed" | "disabled" | "cleared";

/** 一条审计记录。三类来源与审计管理动作写进同一个形状（见文件头）。 */
export interface AuditRecord {
	/** epoch ms。由写入方统一打点（core/audit-log.ts），调用方不各自取时间。 */
	readonly ts: number;
	readonly category: AuditCategory;
	readonly outcome: AuditOutcome;
	/** 具体是什么：命令原文（截断）/ 沙箱不可用原因 / 运行时失败相位与错误。 */
	readonly detail: string;
}

/** 写入方的入参：时间由写入点统一打，调用方给不了（也就不会各写各的时间语义）。 */
export type AuditRecordInput = Omit<AuditRecord, "ts">;

/** 写入通道。daemon 注入它到工具/执行器（缺省不写，见各 options 的注释）。 */
export type AuditSink = (input: AuditRecordInput) => void;

/**
 * audit:list / audit:clear 的返回：面板的数据源（daemon 已按过滤与上限整理好）。
 *
 * records 是**时间正序**（旧 → 新）的最近 `limit` 条；total 是过滤后的总数。
 * 面板倒序展示（最新的在最上面）并据此如实说明「只显示了最近 N 条」——
 * 排序与截断的真相都在 daemon，renderer 不自己重排（重排一次就会出现
 * 「面板的最近 N 条」与「导出的前 N 条」不是同一批这类对不上）。
 */
export interface AuditQueryResult {
	readonly records: readonly AuditRecord[];
	readonly total: number;
	readonly limit: number;
}

/** audit:export 的返回：导出文件绝对路径 + 写进去的条数。 */
export interface AuditExportResult {
	readonly path: string;
	readonly count: number;
}

/**
 * 面板一次拉取的展示上限。
 *
 * 上限而不是分页：审计记录是低频事件（拦一条命令、沙箱拒一次、运行时失败一次），
 * 单日量级在个位数到几十条；分页要有游标协议与翻页 UI，而用户真正要的是
 * 「最近发生了什么」+「导出全文看历史」。上限由 shared 定义、daemon 与面板共用
 * 同一个数，避免「面板显示 200、daemon 只给 50」这类对不上的组合。
 */
export const AUDIT_PANEL_LIMIT = 200;

export const AUDIT_CATEGORY_LABELS: Readonly<Record<AuditCategory, string>> = {
	command: "命令安全",
	sandbox: "沙箱",
	runtime: "运行时",
	audit: "审计管理",
};

export const AUDIT_OUTCOME_LABELS: Readonly<Record<AuditOutcome, string>> = {
	blocked: "已拦截",
	allowed: "已放行",
	failed: "失败",
	disabled: "已禁用",
	cleared: "已清空",
};

/** 面板的类别过滤项（含「全部」，用 undefined 表示）。 */
export const AUDIT_CATEGORIES: readonly AuditCategory[] = ["command", "sandbox", "runtime", "audit"];

/**
 * 校验来自 IPC 的类别过滤值。过滤值来自渲染进程（半可信），非法值必须响亮拒绝 ——
 * 静默当成「不过滤」会让用户以为筛过了，看到的是全量。
 */
export function isAuditCategory(value: unknown): value is AuditCategory {
	return typeof value === "string" && (AUDIT_CATEGORIES as readonly string[]).includes(value);
}

/**
 * 详情长度上限。三类来源共用同一个上限（写入前过 `clipAuditDetail`）：
 * 命令原文可能是多行脚本、运行时错误可能带整段堆栈，不设限就等于把审计文件
 * 变成日志垃圾桶（面板一行也读不下）。
 */
export const AUDIT_DETAIL_MAX = 240;

/**
 * 详情归一化：压成单行 + 截断。
 *
 * 压单行是**格式契约**的一部分：审计「一行一条」（NDJSON 与导出文本都是），
 * 内嵌换行会让一条记录在导出里占多行、在对账时看起来像多条。
 */
export function clipAuditDetail(text: string): string {
	const oneLine = text.replace(/\s+/g, " ").trim();
	return oneLine.length <= AUDIT_DETAIL_MAX ? oneLine : `${oneLine.slice(0, AUDIT_DETAIL_MAX)}…`;
}

function pad2(n: number): string {
	return n < 10 ? `0${n}` : `${n}`;
}

/**
 * 审计时间戳（本地时区，精确到秒）。
 *
 * 用固定格式而不是 `toLocaleString`：面板与导出用的是**同一个**函数，
 * 而 audit 的对账场景要精确到秒（同一天里三次沙箱拒绝靠时分秒才排得清），
 * 相对时间（「昨天」）在审计里没有意义。
 */
export function formatAuditTime(ts: number): string {
	const at = new Date(ts);
	return (
		`${pad2(at.getMonth() + 1)}-${pad2(at.getDate())} ` +
		`${pad2(at.getHours())}:${pad2(at.getMinutes())}:${pad2(at.getSeconds())}`
	);
}

/** 面板一行的文本化形态。导出也用它 —— 面板与导出看到的是同一句话。 */
export function auditLine(record: AuditRecord): string {
	return `[${AUDIT_CATEGORY_LABELS[record.category]}] ${AUDIT_OUTCOME_LABELS[record.outcome]} · ${record.detail}`;
}

/**
 * 导出全文（面板「导出日志」的产物内容）。
 *
 * 与面板**同源**：同一条 core/audit-log.ts 查询（readAuditRecords）+ 同一个
 * auditLine 渲染。差别只有一处，且是有意的：导出不设条数上限（面板为了首屏
 * 有上限 AUDIT_PANEL_LIMIT），否则「导出」反而看不全历史 —— 这一点在文件头
 * 声明出来，不许悄悄改。
 */
export function renderAuditRecords(records: readonly AuditRecord[], exportedAt: number): string {
	const lines = [
		"KamiBuddy 审计日志",
		`导出时间：${new Date(exportedAt).toLocaleString()}`,
		`记录数：${records.length}（按时间正序；面板只显示最近 ${AUDIT_PANEL_LIMIT} 条）`,
		"",
	];
	if (records.length === 0) {
		lines.push("（无记录）");
		return lines.join("\n");
	}
	for (const record of records) lines.push(`${formatAuditTime(record.ts)}  ${auditLine(record)}`);
	return lines.join("\n");
}
