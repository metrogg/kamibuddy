/**
 * 会话分支的纯逻辑（spec: add-session-branching，Task 3）：
 * 锚点解析、抽枝判定、分支标题、结果形状。
 *
 * 为什么单独成模块而不写进 daemon/index.ts：
 *  - 这几个判断都是「输入 → 输出」的纯函数，脱离 fs 与 pi 运行时就能单测；
 *    daemon/index.ts 一被 import 就会拖起整个 pi SDK；
 *  - Task 5 的接线只负责顺序与副作用（抽枝、截断母文件、重建宿主），
 *    决策集中在这里，不在 handler 里散落 if。
 *
 * 锚点是**用户消息序号（0 基）**，不是条目 id —— 实测结论（spec「实测修订」）：
 * 在线路径下渲染层的 user 消息 id 由 session-host 的 nextId("user") 造，
 * 与落盘条目 id 不一致。调用方先用 AgentSession.getUserMessagesForForking()
 * 拿到 `[{ entryId, text }]`，再用本模块 resolveAnchorForIndex 按序号取真实 entryId。
 */

import type { SessionBranchFailReason, SessionBranchResult } from "../shared/ipc.ts";

/** 一次分支操作的入参（daemon 内部；IPC 侧的 mode 由通道决定，不来自 renderer）。 */
export interface SessionBranchRequest {
	/** 目标会话文件绝对路径。 */
	readonly path: string;
	/** 锚点用户消息的序号（0 基，与 renderer 侧的用户消息列表同序）。 */
	readonly userIndex: number;
	/** restart = 母会话就地回退 + 抽枝；fork = 派生新会话、母会话不动。 */
	readonly mode: "restart" | "fork";
}

/**
 * 一个锚点：某条用户消息的落盘条目 id 与原文。
 * 形状即 `AgentSession.getUserMessagesForForking()` 的元素 —— 这里自己声明最小结构，
 * 不 import pi 类型，否则本模块的单测得先构造 pi 运行时。
 */
export interface ForkAnchor {
	readonly entryId: string;
	readonly text: string;
}

/**
 * 按用户消息序号解析锚点。越界（含负数、非整数）返回 undefined，
 * 由调用方转成 `no-such-entry` —— 这里的 undefined 是「没有这条消息」，
 * 不是异常：renderer 的序号可能来自一份已过期的历史。
 */
export function resolveAnchorForIndex(
	anchors: readonly ForkAnchor[],
	userIndex: number,
): ForkAnchor | undefined {
	if (!Number.isInteger(userIndex) || userIndex < 0) return undefined;
	return anchors[userIndex];
}

/**
 * 会话条目的最小形状：判定抽枝只需要树指针。
 * 同样不 import pi（daemon 单测不该被迫构造 AgentSession）。
 *
 * role 只有 message 类条目才有（非消息条目——model_change 等——为 undefined）：
 * endOfTurn 靠它认出「下一条用户消息 = 下一轮开始了」。
 */
export interface BranchEntry {
	readonly id: string;
	readonly parentId: string | null;
	readonly role?: string;
}

/**
 * 锚点那一轮**末尾**的条目 id（「复制到这条回答为止」的分支用它当叶子）。
 *
 * 一轮 = 该用户消息之后、下一条用户消息之前的所有条目。沿子链一路走到
 * 「下一个孩子是用户消息」或「没有孩子」为止，返回最后一条非用户条目。
 *
 * 线性会话是常态（母文件在分支时被物理截断，见 restartSession），多个孩子
 * 时取第一个 —— 坏数据不该让分支操作抛错，取哪支由调用方的心智模型决定
 *（用户点的是「这一轮的回答」，链上第一条就是它）。
 * 锚点自己就是末尾（还没答）时返回锚点本身：调用方决定要不要拦。
 */
export function endOfTurn(entries: readonly BranchEntry[], anchorEntryId: string): string {
	const children = new Map<string, BranchEntry[]>();
	for (const entry of entries) {
		if (entry.parentId === null) continue;
		const siblings = children.get(entry.parentId);
		if (siblings === undefined) children.set(entry.parentId, [entry]);
		else siblings.push(entry);
	}

	let current = anchorEntryId;
	const seen = new Set<string>([anchorEntryId]); // 坏数据（id 成环）不当机
	for (;;) {
		const next = (children.get(current) ?? []).find((entry) => !seen.has(entry.id));
		if (next === undefined || next.role === "user") return current;
		seen.add(next.id);
		current = next.id;
	}
}

/**
 * 分叉点之后是否确有内容 = 是否存在以 anchorEntryId 为祖先的条目。
 *
 * 只有 true 才抽枝：用户对末轮刚答完的消息点「重新开始」时没有需要保存的未来，
 * 抽出一条只含前缀的会话只是往侧栏塞噪声（spec 的「分叉点之后没有内容」场景）。
 */
export function decideExtract(
	entries: readonly BranchEntry[],
	anchorEntryId: string,
): boolean {
	const children = new Map<string, string[]>();
	for (const entry of entries) {
		if (entry.parentId === null) continue;
		const siblings = children.get(entry.parentId);
		if (siblings === undefined) children.set(entry.parentId, [entry.id]);
		else siblings.push(entry.id);
	}

	// 向下遍历找后代。seen 兼作环上防护：坏数据（id 成环）不该把 daemon 卡死。
	const seen = new Set<string>([anchorEntryId]);
	const stack = [...(children.get(anchorEntryId) ?? [])];
	while (stack.length > 0) {
		const id = stack.pop();
		if (id === undefined || seen.has(id)) continue;
		seen.add(id);
		const grand = children.get(id);
		if (grand !== undefined) stack.push(...grand);
	}
	return seen.size > 1;
}

/**
 * 空会话标题的占位。与 conversation-search.ts 的 deriveSessionTitle 同一口径 ——
 * 这里不 import 那个模块：它是 fs 侧的实现（import 了 node:fs/promises），
 * 会把 fs 拖进本模块的依赖图，纯逻辑单测的边界就没了。
 */
const EMPTY_TITLE_PLACEHOLDER = "（空会话）";

/** 分支标题后缀；重名时在它后面追加递增序号。 */
const BRANCH_SUFFIX = " · 分支";

/**
 * 分支会话标题：`母标题 · 分支`，与现有会话标题重名时递增到 `· 分支 2`、`· 分支 3`…
 *
 * 母标题为空（或只有空白）时取会话列表的同一占位文案，不留一个残缺的「· 分支」。
 * existingTitles 用集合语义（顺序无关），由调用方从当前会话列表取。
 */
export function buildBranchTitle(
	parentTitle: string,
	existingTitles: readonly string[],
): string {
	const trimmed = parentTitle.trim();
	const base = trimmed === "" ? EMPTY_TITLE_PLACEHOLDER : trimmed;
	const taken = new Set(existingTitles);

	const first = `${base}${BRANCH_SUFFIX}`;
	if (!taken.has(first)) return first;
	for (let n = 2; ; n++) {
		const candidate = `${first} ${n}`;
		if (!taken.has(candidate)) return candidate;
	}
}

/**
 * 成功结果。branchPath / branchTitle 只在**确实抽枝产生了分支会话**时给：
 * 「重新开始」在分叉点之后没有内容时不产生分支会话，此时二者缺席，
 * 调用方据此只提示「已回到这一轮之前」（与 shared/ipc.ts 的类型注释一致）。
 */
export function branchOk(branch?: {
	readonly path: string;
	readonly title: string;
}): SessionBranchResult {
	if (branch === undefined) return { ok: true };
	return { ok: true, branchPath: branch.path, branchTitle: branch.title };
}

/**
 * 失败原因对应的用户可见文案。默认即最终文案（renderer 直接展示），
 * 只有需要补充细节时才在调用处覆盖第二条参数。
 */
const FAIL_MESSAGES: Record<SessionBranchFailReason, string> = {
	busy: "正在生成，稍后再试",
	"no-file": "这个任务还没有会话记录，无法从这里重新开始",
	"no-such-entry": "找不到这条消息，可能历史已变化，请刷新后重试",
	"write-failed": "保存分支失败，当前会话未改动",
};

/**
 * 失败结果。失败是可预期的业务拒绝（界面按 reason 分支给文案），
 * 所以走返回值而不是 reject（见 shared/ipc.ts 的 SessionBranchResult 注释）。
 */
export function branchFail(
	reason: SessionBranchFailReason,
	message: string = FAIL_MESSAGES[reason],
): SessionBranchResult {
	return { ok: false, reason, message };
}
