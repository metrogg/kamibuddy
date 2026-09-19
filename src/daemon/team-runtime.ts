/**
 * 团队注册表（纯逻辑）：团队的成员与状态机，不碰 pi / SessionHost。
 *
 * 形状对齐 WorkBuddy 的 TeamRegistry（单会话单团队、成员名寻址、状态机），
 * 差异有意为之：键是领导 sessionId（我们的成员寄生于 daemon 进程内的
 * SessionHost，没有 Thread 树）；没有 provisional/rekey —— 成员身份在
 * spawn ack 时一次定格（成员名是调用方校验过唯一的），不存在跨进程
 * 事件路由的幽灵问题，那套防线（WorkBuddy child-agent-projection）在我们
 * 的架构里没有对应的问题面。
 *
 * 成员状态机：spawning（已受理，宿主在建）→ running（spawn ack，一轮在跑）
 * → idle（一轮收尾，等待消息唤醒）/ failed / closed（解散或中止）。
 * 「已完成成员收消息自动重启」在模型层：idle 成员收到 team_send 重新
 * prompt，状态翻回 running（markRunning）。
 *
 * 宿主（SessionHost）不进本模块：注册表只管身份与状态，宿主的生命周期
 * 在 daemon 接线层（Map<memberSessionId, host>）。
 */

/*
 * 只导入类型（`import type`）：`member-transcript` 读文件、依赖 core 的
 * config-paths / session-rebuild，而本模块是**纯逻辑**（便于单测直接构造）。
 * 运行时依赖留成注入参数（`restoreTeam` 的 `deriveStatus`），
 * 这样测试不需要落盘任何文件。
 */
import type { MemberTranscriptStatus } from "./member-transcript.ts";

/**
 * 成员状态（对 WorkBuddy member status 的裁剪版）。
 *
 * `closing` 是 spec: add-team-collaboration-parity 批次 ② 加的：主理人发了
 * 收尾请求、成员正在把手上工作整理成报告（**不是** abort —— 优雅关闭的全部
 * 价值就是「让它把东西交出来再走」）。成员回投完成信号后翻 `closed`。
 *
 * `interrupted` 是 spec: add-team-interrupt-diagnostics 批次 ① 加的：**进程被杀
 * 时该成员正在跑一轮**，重启后从落盘恢复时落到这一态。它与 `failed` 的区别是
 * 责任方 —— failed 是成员这一轮自己出了问题（模型报错/被中止），interrupted
 * 是宿主消失、它那一轮**很可能已经跑完但产出没来得及回投**（2026-09-19 实测：
 * 草稿 18,575 字写完、`stopReason: "stop"`，但 `.then()` 随进程一起没了）。
 * 这个区别对用户是「要不要去会话文件里捞产出」的行动指引，所以必须分开。
 */
export type TeamMemberStatus =
	| "spawning"
	| "running"
	| "idle"
	| "failed"
	| "closing"
	| "closed"
	| "interrupted";

/**
 * 落盘时会被记成「中断候选」的状态（spec: add-team-interrupt-diagnostics 批次 ①）。
 *
 * 判据是**「它当时手里有活」**：spawning（刚受理还没起跑）、running（一轮在跑）、
 * closing（在整理收尾报告）三者都满足。idle 不算 —— 它已经交完一轮在等消息，
 * 进程被杀不损失任何未回投的产出。closed / failed 是终态，同理不算。
 */
const INTERRUPT_CANDIDATE_STATUSES: ReadonlySet<TeamMemberStatus> = new Set([
	"spawning",
	"running",
	"closing",
]);

/**
 * 这个落盘状态是否意味着「杀进程时它手里有活」（落盘/恢复两侧共用的判据）。
 *
 * 导出给 `core/team-store.ts` 用会违反依赖方向（core 不许 import daemon），
 * 所以那边落盘时**原样记 status 字符串**，判据只在恢复侧（本模块）执行。
 * 这个导出留给 daemon 接线层做「落盘那一刻值不值得写」的判断。
 */
export function isInterruptCandidate(status: TeamMemberStatus): boolean {
	return INTERRUPT_CANDIDATE_STATUSES.has(status);
}

/**
 * 计划裁决状态（spec: add-team-collaboration-parity 批次 ④）。
 *
 * 与 WorkBuddy 的 plan_approval 消息类型不同：它的成员在会话内**阻塞等待**审批，
 * 我们的成员是 fire-and-forget 长会话 —— 交完一轮就结束（状态 idle），
 * 不存在「阻塞等批」这个状态。于是「提交计划」= 它这一轮的产出（自动回投给领导），
 * 「批准/驳回」= 领导裁决后 team_send 唤醒它继续。本字段记录的是**裁决本身**，
 * 让 `team_status` 能回答「谁的计划批了、谁被打回几次」。
 */
export type TeamPlanStatus = "none" | "awaiting" | "approved" | "rejected";

/**
 * 裁决**动作**（入参）与上面裁决**状态**（记录）刻意分成两个类型：
 * 动作是命令式（approve / reject），状态是结果式（approved / rejected）。
 * 合成一个类型会让 `reviewPlan(..., "approved")` 这种"结果当命令"的调用
 * 编译期合法、运行期莫名其妙 —— 实测（2026-09-18）就是类型检查先抓到的。
 */
export type TeamPlanDecision = "awaiting" | "approve" | "reject";

/**
 * 把落盘里读回的裸字符串窄化成本类型（core 的 team-store 不能 import 本文件 ——
 * 依赖方向 daemon → core 单向，所以那边的 planStatus 只能是 string）。
 * 不认识的值按 `none` 处理：落盘文件是我们自己写的，出现异值说明有人在手改，
 * 回退到「未涉及计划审批」比抛错更合理（团队本身还能用）。
 */
function toPlanStatus(value: string | undefined): TeamPlanStatus {
	return value === "awaiting" || value === "approved" || value === "rejected" ? value : "none";
}

export interface TeamMember {
	/** 成员名（team_send 的 @寻址键，团队内唯一）。 */
	readonly name: string;
	/** 成员会话 id（spawn ack 后回填；spawning 阶段为 undefined）。 */
	sessionId: string | undefined;
	/** 人格来源（agents 库的定义名）。 */
	readonly agentName: string;
	/** spawn 时给定的初始任务（追溯用）。 */
	readonly task: string;
	/**
	 * 该成员实际使用的模型（`providerId/modelId`，spec: add-team-collaboration-parity
	 * 批次 ⑥）。spawn 时由接线层从执行器回填最终解析结果（成员显式 → agent 定义 →
	 * 领导模型），空串 = 尚未回填。
	 */
	model: string;
	status: TeamMemberStatus;
	/** 已完成的 agent 轮数（接线层从成员事件计数回填）。 */
	turns: number;
	/** 最近一条动作行（进度/诊断，展示用）。 */
	lastActivity: string;
	/** 累计工具调用次数（批 8：成员事件流计数回填）。 */
	toolCalls: number;
	/** 累计 token 用量（各轮 totalTokens 之和）。 */
	tokens: number;
	/** 累计费用（美元）。 */
	cost: number;
	/** 计划裁决状态（批次 ④）：none 未涉及 / awaiting 已交计划待审 / approved / rejected。 */
	planStatus: TeamPlanStatus;
	/** 驳回反馈（重交计划前读它）；无反馈时为空串。 */
	planFeedback: string;
	/**
	 * 「领导正在等这名成员」的起点时戳（epoch ms；spec:
	 * add-team-interrupt-diagnostics 批次 ②）。**0 = 不在等待中**。
	 *
	 * 为什么需要它：成员是 fire-and-forget，领导派活后只能干等 —— 而
	 * 2026-09-19 实测的中断场景里，领导看到的是永久静默，用户看到的是
	 * 「没人接了」。有了这个时戳，界面就能回答「在等谁、等了多久」，
	 * 而不是让用户猜自己是断了还是在等。
	 *
	 * 由注册表在状态翻 running 时刷新（`markStatus`/`markSpawned`），
	 * 在收尾/失败/中断时清零。
	 */
	waitingSince: number;
}

export interface Team {
	/** 团队名（展示/日志用，寻址走成员名）。 */
	readonly name: string;
	/** 成员，按名字索引（建团时校验唯一后定格）。 */
	readonly members: Map<string, TeamMember>;
}

function requireNonEmpty(value: string, label: string): string {
	if (value === "") throw new Error(`${label}不能为空`);
	return value;
}

export class TeamRegistry {
	private readonly teamsByLeader = new Map<string, Team>();
	/** 成员会话 id → 领导 id（成员回投/按会话查团队的反向索引）。 */
	private readonly leaderByMemberSession = new Map<string, string>();

	/**
	 * 建团。单会话单团队（重复 → 报错并报告现有团队名，对齐 WorkBuddy 的
	 * 「Already in a team」）；成员名唯一；1-8 人（对齐并行派发上限）。
	 * 成员以 spawning 起步，sessionId 由接线层 spawn ack 后回填。
	 */
	createTeam(
		leaderSessionId: string,
		name: string,
		members: ReadonlyArray<{ name: string; agentName: string; task: string }>,
	): Team {
		requireNonEmpty(leaderSessionId, "领导会话 id");
		requireNonEmpty(name, "团队名");
		if (members.length === 0) throw new Error("团队至少需要一名成员");
		if (members.length > 8) throw new Error(`团队成员最多 8 名，当前 ${members.length} 名`);
		const existing = this.teamsByLeader.get(leaderSessionId);
		if (existing !== undefined) {
			throw new Error(`本会话已存在团队「${existing.name}」，先解散（team_delete）才能再建`);
		}
		const team: Team = { name, members: new Map() };
		for (const spec of members) {
			const memberName = requireNonEmpty(spec.name, "成员名");
			if (team.members.has(memberName)) {
				throw new Error(`成员名「${memberName}」重复：成员名是 @寻址的唯一键`);
			}
			team.members.set(memberName, {
				name: memberName,
				sessionId: undefined,
				agentName: requireNonEmpty(spec.agentName, `成员「${memberName}」的 agent 名`),
				task: requireNonEmpty(spec.task, `成员「${memberName}」的初始任务`),
				model: "",
				status: "spawning",
				turns: 0,
				lastActivity: "",
				toolCalls: 0,
				tokens: 0,
				cost: 0,
				planStatus: "none",
				planFeedback: "",
				waitingSince: 0,
			});
		}
		this.teamsByLeader.set(leaderSessionId, team);
		return team;
	}

	/**
	 * 从落盘快照恢复团队（spec: add-team-collaboration-parity 批次 ⑤）。
	 *
	 * **宿主不可恢复**（理由见 core/team-store.ts 文件头），所以恢复态只能是
	 * 「需重建」的终态。但**两种终态要分开**（spec: add-team-interrupt-diagnostics
	 * 批次 ①，2026-09-19 实测驱动）：
	 *
	 * - 落盘时该成员 `idle`/`closed`/`failed` → 恢复为 `closed`，附「需重建」。
	 *   它上一次已经是终态，进程被杀不损失任何未回投的产出。
	 * - 落盘时该成员 `spawning`/`running`/`closing` → 恢复为 **`interrupted`**，
	 *   附「上次运行在「X」时中断，该轮产出未回投」。
	 *
	 * 区分这两者的全部价值是**诊断**：前一种用户可以放心重开，后一种意味着
	 * 「有一轮很可能跑完了但产出没回来」，用户该去会话文件里捞。一律折成 closed
	 * 会把这个信号抹掉 —— 那正是本次实测里最误导人的地方。
	 */
	/**
	 * 从落盘快照恢复团队（spec: add-team-collaboration-parity 批次 ⑤；
	 * spec: add-team-pull-model 批次 ② 改为**派生优先**）。
	 *
	 * **宿主不可恢复**（理由见 core/team-store.ts 文件头），所以恢复态只能是
	 * 「需重建」的终态。判据对齐 WorkBuddy 的 `deriveChildState` ——
	 * **先读成员会话文件派生，派生不出才回落到落盘的 status 字面量**：
	 *
	 * | 派生结果（`deriveMemberStatus`） | 恢复为 | 含义 |
	 * |---|---|---|
	 * | `completed` | `closed` | 跑完了、产出在会话文件里，可去读 |
	 * | `killed` | `interrupted` | 被中止，那一轮没跑完 |
	 * | `failed` | `failed` | 那一轮失败了 |
	 * | `undefined`（派生不出） | 见下 | 回落到落盘 status 判据 |
	 *
	 * 为什么派生优先（WorkBuddy 的原话：「终态事件走 ACP 实时通道、**进程重启就丢**」）：
	 * 落盘 status 是**运行时状态**，它记录的是「杀进程那一刻它在干什么」，
	 * 而不是「它最终跑成什么样」。若成员其实已经跑完（产出完整写进 JSONL），
	 * 只是没来得及把 status 翻成 idle 就死了，落盘会说 `running` → 被误判成
	 * `interrupted`（用户以为要重跑）。而**读文件能拿到确切答案**。
	 *
	 * 回落分支（派生出 `undefined`）沿用原判据：
	 * - 落盘 `spawning`/`running`/`closing` → `interrupted`
	 * - 落盘 `idle`/`closed`/`failed` → `closed`
	 *
	 * @param deriveStatus 派生器（注入以便测试；缺省用会话文件派生）。
	 *   接 `(sessionId) => MemberTranscriptStatus`，`undefined` = 派生不出。
	 */
	restoreTeam(
		leaderSessionId: string,
		name: string,
		members: ReadonlyArray<{
			name: string;
			agentName: string;
			task: string;
			sessionId?: string;
			status?: string;
			turns: number;
			toolCalls: number;
			tokens: number;
			cost: number;
			planStatus?: string;
			planFeedback?: string;
		}>,
		deriveStatus?: (sessionId: string) => MemberTranscriptStatus,
	): void {
		requireNonEmpty(leaderSessionId, "领导会话 id");
		if (this.teamsByLeader.has(leaderSessionId)) return; // 已有团队 → 不覆盖运行态
		const team: Team = { name, members: new Map() };
		for (const stored of members) {
			// ① 派生优先：读成员会话文件，让「文件事实」压过「落盘运行态」。
			// 派生器抛错按「派生不出」处理 —— 读文件失败（权限/占用）不该炸掉整个启动链。
			let derived: MemberTranscriptStatus;
			if (stored.sessionId !== undefined && deriveStatus !== undefined) {
				try {
					derived = deriveStatus(stored.sessionId);
				} catch {
					derived = undefined;
				}
			} else {
				derived = undefined;
			}
			/*
			 * 落盘的 status 是裸字符串（core 侧不 import 本模块的类型）——
			 * 认不出的值按「不是中断候选」处理，宁可显示成 closed 也不要
			 * 凭空报「你有一轮活丢了」。
			 */
			const wasWorking = INTERRUPT_CANDIDATE_STATUSES.has(stored.status as TeamMemberStatus);

			let status: TeamMemberStatus;
			let activity: string;
			if (derived === "completed") {
				status = "closed";
				activity = "上次运行已完成，产出在它的会话记录里（可用 team_read 取回）";
			} else if (derived === "killed") {
				status = "interrupted";
				activity = "上次运行被中止，那一轮没有跑完";
			} else if (derived === "failed") {
				status = "failed";
				activity = "上次运行失败，看它的会话记录可了解原因";
			} else if (wasWorking) {
				status = "interrupted";
				activity = `上次运行在「${
					stored.status === "closing" ? "收尾" : "任务执行"
				}」时中断（会话记录里读不到完整产出）`;
			} else {
				status = "closed";
				activity = "进程重启后成员需重建";
			}

			/*
			 * 拉模式（spec: add-team-pull-model 批次④）删掉了 `pendingDelivery`
			 * 旧字段：推模式里「产出有没有送达」是个需要额外记账的问题，
			 * 拉模式里它不再存在 —— 产出永远在 `sessions/<id>.jsonl` 里，
			 * 上面派生出的 `completed` 就是「有产出可读」的结论。
			 * 旧落盘文件多出来的键会被这里忽略（不读、不报错）。
			 */
			team.members.set(stored.name, {
				name: stored.name,
				sessionId: undefined, // 旧 sessionId 不可达，不恢复（恢复它只会指向一个死宿主）
				agentName: stored.agentName,
				task: stored.task,
				status,
				model: "",
				turns: stored.turns,
				lastActivity: activity,
				toolCalls: stored.toolCalls,
				tokens: stored.tokens,
				cost: stored.cost,
				planStatus: toPlanStatus(stored.planStatus),
				planFeedback: stored.planFeedback ?? "",
				waitingSince: 0,
			});
		}
		this.teamsByLeader.set(leaderSessionId, team);
	}

	/**
	 * 把仍是 `running` 的成员强制收敛到终态 —— 对齐 WorkBuddy 的
	 * `settleAllRunning`（spec: add-team-pull-model 批次②）。
	 *
	 * ═══════════════════════════════════════════════════════════════════════
	 *  从 WorkBuddy 抄来的三条不变量（改这个函数前先读那三条注释）
	 * ═══════════════════════════════════════════════════════════════════════
	 *
	 * 1. **只动 `status === "running"`**：已终态的成员有自己的证据链，不能被
	 *    父状态覆盖。WorkBuddy 原文：「`settleAllRunning` 只动
	 *    `state === 'running'`：已终态的子有自己的证据链（子 transcript 里的
	 *    SendMessage / cancel record），不能被父状态覆盖。」
	 *
	 * 2. **父 `idle` 只在冷启动 hydrate 完成后才 settle**：运行时 idle 不触发。
	 *    WorkBuddy 原文：「运行时 idle（setState listener 里的 idle）：**不触发**
	 *    settle。主 agent end_turn 不代表 subagent 已经结束（fire-and-forget），
	 *    硬 settle 会引入『子在跑却说 completed/cancelled』的假态。」
	 *    我们这边对应：领导跑完一轮（idle）**不代表**成员也停了 —— 成员是
	 *    独立长会话，可能正跑在后台。
	 *
	 * 3. **父进入 `{terminated, error, failed}` → 强制收敛**：这类是「父真的结束了」，
	 *    子不可能再有回音。
	 *
	 * @param reason 父的终态。`terminated`/`idle` → 成员标 `interrupted`；
	 *   `error`/`failed` → 成员标 `failed`。与 WorkBuddy 的映射一致
	 *   （它那边是 cancelled / error，我们用 `interrupted` 表达「被中止」）。
	 * @returns 实际被收敛的成员名（调用方据此决定要不要刷投影）。
	 */
	settleRunningMembers(leaderSessionId: string, reason: "terminated" | "error" | "failed" | "idle"): readonly string[] {
		const team = this.teamsByLeader.get(leaderSessionId);
		if (team === undefined) return [];
		const target: TeamMemberStatus =
			reason === "terminated" || reason === "idle" ? "interrupted" : "failed";
		const settled: string[] = [];
		for (const member of team.members.values()) {
			if (member.status !== "running") continue; // 不变量 1
			member.status = target;
			member.waitingSince = 0;
			member.lastActivity =
				target === "interrupted"
					? "会话已停，这一轮没有回音（产出看它的会话记录）"
					: "会话失败中止，这一轮没有回音";
			settled.push(member.name);
		}
		return settled;
	}

	/** 领导的团队；没有 → undefined。 */
	getTeam(leaderSessionId: string): Team | undefined {
		return this.teamsByLeader.get(leaderSessionId);
	}

	/** 按成员会话 id 反查所属团队（成员回投路由用）；找不到 → undefined。 */
	getTeamByMemberSession(memberSessionId: string): Team | undefined {
		const leader = this.leaderByMemberSession.get(memberSessionId);
		return leader === undefined ? undefined : this.teamsByLeader.get(leader);
	}

	/** spawn ack：成员会话 id 回填 + 状态翻 running。未知成员/团队 → 响亮抛错。 */
	markSpawned(leaderSessionId: string, memberName: string, memberSessionId: string): void {
		const member = this.requireMember(leaderSessionId, memberName);
		if (member.sessionId !== undefined) {
			throw new Error(`成员「${memberName}」已绑定会话，spawn ack 重复`);
		}
		member.sessionId = memberSessionId;
		member.status = "running";
		member.lastActivity = "";
		// spawn ack = 首轮任务已起跑，领导从此开始等（批次 ②）。
		member.waitingSince = Date.now();
		this.leaderByMemberSession.set(memberSessionId, leaderSessionId);
	}

	/**
	 * 回填成员实际使用的模型（spec: add-team-collaboration-parity 批次 ⑥）。
	 *
	 * 解析链（成员显式 → agent 定义 → 领导模型）在成员执行器里算 —— 那里才知道
	 * 目录里哪些模型可用。接线层拿到 handle 后回填这里，`team_status` 才有真值可显示。
	 */
	recordMemberModel(leaderSessionId: string, memberName: string, modelKey: string): void {
		const member = this.requireMember(leaderSessionId, memberName);
		member.model = modelKey;
	}

	/**
	 * 状态迁移（批次 ② 起同时维护 `waitingSince`）。
	 *
	 * 等待计时只在 `running` 期间有意义 —— 领导派了活、成员还没交回来。
	 * 所以：
	 * - 翻到 `running` → **刷新**起点（新的一轮派活，上一次的等待作废）
	 * - 翻到 `idle`/`closed`/`failed` → **清零**（活交回来了 / 不用等了）
	 * - `interrupted` → 清零（不再等待，它是终态）
	 * - `closing` → 保持原值（收尾也是「领导在等它交报告」）
	 *
	 * @param at 测试注入用的「现在」（缺省 Date.now()）；生产调用不传。
	 */
	markStatus(
		leaderSessionId: string,
		memberName: string,
		status: TeamMemberStatus,
		activity?: string,
		at?: number,
	): void {
		const member = this.requireMember(leaderSessionId, memberName);
		member.status = status;
		if (activity !== undefined) member.lastActivity = activity;
		if (status === "running") {
			member.waitingSince = at ?? Date.now();
		} else if (status !== "closing" && status !== "spawning") {
			member.waitingSince = 0;
		}
	}

	/**
	 * 回填一轮的收尾结果（spec: add-team-interrupt-diagnostics 批次 ③.4）。
	 *
	 * 存在的理由：`recordProgress` 的 `turnsDelta` 由接线层传，而接线层
	 * 在 `onProgress` 里**只能拿到一句文本**（`已完成 N 轮`），拿不到轮数 ——
	 * 2026-09-19 之前那里写死传 0，导致注册表的 `turns` 永远是 0（实测反例：
	 * `activity = 已完成 2 轮` 而 `turns = 0`）。那个恒 0 的字段还被误当成
	 * 「一轮没收尾」的判据，推错过一次方向。
	 *
	 * 现在轮数从两个来源收敛到一处：`onComplete` 带着权威轮数回来（成员执行器
	 * 自己数的），这里**直接赋值**而不是累加 —— 它本来就是「这个成员共跑完几轮」
	 * 的绝对值，累加会让重复回调把数字顶飞。
	 */
	recordCompletion(leaderSessionId: string, memberName: string, turns: number, activity: string): void {
		const member = this.requireMember(leaderSessionId, memberName);
		member.turns = turns;
		if (activity !== "") member.lastActivity = activity;
	}

	/** 追加轮数与动作行（接线层从成员事件计数回填）。 */
	recordProgress(leaderSessionId: string, memberName: string, turnsDelta: number, activity: string): void {
		const member = this.requireMember(leaderSessionId, memberName);
		member.turns += turnsDelta;
		if (activity !== "") member.lastActivity = activity;
	}

	/**
	 * 按成员会话 id 回填计数增量（spec: add-team-foundations 批 8）：
	 * 成员执行器的 onEvent 只知道自己的 sessionId，用反向索引找归属成员累加。
	 * 返回领导 id（调用方据此发 team_member_progress）；成员未归属（spawn
	 * ack 前的零星事件）→ undefined，调用方跳过。
	 */
	recordCountersBySession(
		memberSessionId: string,
		deltas: { toolCalls: number; tokens: number; cost: number },
	): string | undefined {
		const leaderId = this.leaderByMemberSession.get(memberSessionId);
		const team = leaderId === undefined ? undefined : this.teamsByLeader.get(leaderId);
		if (team === undefined || leaderId === undefined) return undefined;
		let member: TeamMember | undefined;
		for (const candidate of team.members.values()) {
			if (candidate.sessionId === memberSessionId) {
				member = candidate;
				break;
			}
		}
		if (member === undefined) return undefined;
		member.toolCalls += deltas.toolCalls;
		member.tokens += deltas.tokens;
		member.cost += deltas.cost;
		return leaderId;
	}

	/**
	 * 记录计划裁决（spec: add-team-collaboration-parity 批次 ④）。
	 *
	 * `decision` 三值：`awaiting`（领导读了回投的计划、先记一笔待审）、
	 * `approve`、`reject`。**驳回必须给反馈**——没有反馈的驳回等于让成员
	 * 重新猜一遍，那还不如不要审批这一环。
	 *
	 * 这里只写状态；唤醒成员（team_send）由接线层做：注册表不碰宿主。
	 */
	reviewPlan(
		leaderSessionId: string,
		memberName: string,
		decision: TeamPlanDecision,
		feedback?: string,
	): TeamMember {
		const member = this.requireMember(leaderSessionId, memberName);
		if (decision === "reject" && (feedback === undefined || feedback.trim() === "")) {
			throw new Error("驳回计划必须给 feedback —— 否则成员只能重猜，等于白跑一轮");
		}
		member.planStatus = decision === "awaiting" ? "awaiting" : decision === "approve" ? "approved" : "rejected";
		member.planFeedback = feedback ?? "";
		return member;
	}

	requireMember(leaderSessionId: string, memberName: string): TeamMember {
		const team = this.getTeam(leaderSessionId);
		const member = team?.members.get(memberName);
		if (team === undefined || member === undefined) {
			throw new Error(
				team === undefined
					? "本会话没有团队，先 team_create 建团"
					: `团队「${team.name}」中没有成员「${memberName}」`,
			);
		}
		return member;
	}

	/**
	 * 按成员名列表解析会话 id（team_send 的 @寻址）。任一未知 → 响亮抛错。
	 *
	 * 已关闭 / 已中断的成员**响亮拒绝**（spec: add-team-collaboration-parity 批次 ②
	 * + add-team-interrupt-diagnostics 批次 ①）：它们的宿主已经 dispose（或随进程
	 * 一起没了），再投消息会撞一个不可预期的内部错误。措辞按死因分开 ——
	 * 用户据此知道该「另派一名成员」还是「去会话文件里捞产出」。
	 */
	resolveMemberSessions(leaderSessionId: string, memberNames: readonly string[]): readonly string[] {
		return memberNames.map((name) => {
			const member = this.requireMember(leaderSessionId, name);
			if (member.sessionId === undefined) {
				throw new Error(`成员「${name}」还在启动中，稍后再发消息`);
			}
			if (member.status === "interrupted" || member.status === "closed") {
				/*
				 * 拉模式下的文案（spec: add-team-pull-model 批次 ④）：不再说「产出没送达」
				 * —— 那是推模式的说法。产出一律用 `team_read` 取回，与成员状态无关
				 * （只要会话 id 还在、文件还在，就能读）。
				 */
				if (member.status === "interrupted") {
					throw new Error(
						`成员「${name}」上次那一轮没有跑完（进程中断），会话已失效。` +
							`它中断前的产出若已落盘，可用 team_read 取回；要它继续工作请重新建团`,
					);
				}
				throw new Error(`成员「${name}」已关闭、不再接收消息（它的产出可用 team_read 取回；要它继续工作就另派一名成员）`);
			}
			return member.sessionId;
		});
	}

	/**
	 * 解散：从注册表摘除团队与全部反向索引，返回成员名列表（接线层据此
	 * abort+dispose 宿主）。
	 */
	disband(leaderSessionId: string): readonly string[] {
		const team = this.teamsByLeader.get(leaderSessionId);
		if (team === undefined) return [];
		this.teamsByLeader.delete(leaderSessionId);
		const names: string[] = [];
		for (const member of team.members.values()) {
			if (member.sessionId !== undefined) this.leaderByMemberSession.delete(member.sessionId);
			names.push(member.name);
		}
		return names;
	}
}
