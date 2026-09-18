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

/**
 * 成员状态（对 WorkBuddy member status 的裁剪版）。
 *
 * `closing` 是 spec: add-team-collaboration-parity 批次 ② 加的：主理人发了
 * 收尾请求、成员正在把手上工作整理成报告（**不是** abort —— 优雅关闭的全部
 * 价值就是「让它把东西交出来再走」）。成员回投完成信号后翻 `closed`。
 */
export type TeamMemberStatus = "spawning" | "running" | "idle" | "failed" | "closing" | "closed";

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
			});
		}
		this.teamsByLeader.set(leaderSessionId, team);
		return team;
	}

	/**
	 * 从落盘快照恢复团队（spec: add-team-collaboration-parity 批次 ⑤）。
	 *
	 * **成员一律按 `closed` 恢复**：宿主不可恢复（理由见 core/team-store.ts 文件头），
	 * 留着 running/idle 会让 `team_status` 撒谎「成员还在干活」。恢复后主理人看到的
	 * 是「这支队需要重建成员」，团队名与任务板原样可用。
	 */
	restoreTeam(
		leaderSessionId: string,
		name: string,
		members: ReadonlyArray<{
			name: string;
			agentName: string;
			task: string;
			sessionId?: string;
			turns: number;
			toolCalls: number;
			tokens: number;
			cost: number;
			planStatus?: string;
			planFeedback?: string;
		}>,
	): void {
		requireNonEmpty(leaderSessionId, "领导会话 id");
		if (this.teamsByLeader.has(leaderSessionId)) return; // 已有团队 → 不覆盖运行态
		const team: Team = { name, members: new Map() };
		for (const stored of members) {
			team.members.set(stored.name, {
				name: stored.name,
				sessionId: undefined, // 旧 sessionId 不可达，不恢复（恢复它只会指向一个死宿主）
				agentName: stored.agentName,
				task: stored.task,
				status: "closed",
				model: "",
				turns: stored.turns,
				lastActivity: "进程重启后成员需重建",
				toolCalls: stored.toolCalls,
				tokens: stored.tokens,
				cost: stored.cost,
				planStatus: toPlanStatus(stored.planStatus),
				planFeedback: stored.planFeedback ?? "",
			});
		}
		this.teamsByLeader.set(leaderSessionId, team);
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

	markStatus(leaderSessionId: string, memberName: string, status: TeamMemberStatus, activity?: string): void {
		const member = this.requireMember(leaderSessionId, memberName);
		member.status = status;
		if (activity !== undefined) member.lastActivity = activity;
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
	 * 已关闭的成员**响亮拒绝**（spec: add-team-collaboration-parity 批次 ②）：
	 * 它的宿主已经 dispose，再投消息会撞一个不可预期的内部错误；这里明确告诉
	 * 主理人「这个人已经走了」，而不是让它去猜。
	 */
	resolveMemberSessions(leaderSessionId: string, memberNames: readonly string[]): readonly string[] {
		return memberNames.map((name) => {
			const member = this.requireMember(leaderSessionId, name);
			if (member.sessionId === undefined) {
				throw new Error(`成员「${name}」还在启动中，稍后再发消息`);
			}
			if (member.status === "closed") {
				throw new Error(`成员「${name}」已关闭、不再接收消息（要它继续工作就另派一名成员）`);
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
