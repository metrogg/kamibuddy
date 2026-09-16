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

/** 成员状态（对 WorkBuddy member status 的裁剪版）。 */
export type TeamMemberStatus = "spawning" | "running" | "idle" | "failed" | "closed";

export interface TeamMember {
	/** 成员名（team_send 的 @寻址键，团队内唯一）。 */
	readonly name: string;
	/** 成员会话 id（spawn ack 后回填；spawning 阶段为 undefined）。 */
	sessionId: string | undefined;
	/** 人格来源（agents 库的定义名）。 */
	readonly agentName: string;
	/** spawn 时给定的初始任务（追溯用）。 */
	readonly task: string;
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
				status: "spawning",
				turns: 0,
				lastActivity: "",
				toolCalls: 0,
				tokens: 0,
				cost: 0,
			});
		}
		this.teamsByLeader.set(leaderSessionId, team);
		return team;
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

	/** 按成员名列表解析会话 id（team_send 的 @寻址）。任一未知 → 响亮抛错。 */
	resolveMemberSessions(leaderSessionId: string, memberNames: readonly string[]): readonly string[] {
		return memberNames.map((name) => {
			const member = this.requireMember(leaderSessionId, name);
			if (member.sessionId === undefined) {
				throw new Error(`成员「${name}」还在启动中，稍后再发消息`);
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
