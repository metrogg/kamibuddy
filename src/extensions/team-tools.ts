/**
 * 团队工具四件套（spec: add-team-foundations 批 5）：team_create / team_send /
 * team_status / team_delete。
 *
 * 与 task-tool 同取向：编排与回传格式在本文件，执行本体（成员 spawn、路由、
 * 注册表）由 daemon 装配时注入 —— 脱离宿主可单测。
 *
 * 语义要点（对齐 WorkBuddy Agent Teams，裁剪见 spec）：
 *   - **单会话单团队**：已有团队时 team_create 响亮报错（注册表层校验，
 *     工具层转述）；
 *   - **fire-and-forget**：team_create 返回时成员已 spawn ack（会话 id 已定、
 *     初始任务已开跑），不等成员完成；成员产出经完成回投（deliverSessionMessage）
 *     自动回到领导会话；
 *   - **@寻址**：team_send 的 to 是成员名或 "@all"（大小写不敏感，WorkBuddy
 *     同款），未知成员名响亮报错；
 *   - **深度锁**：成员装配不注册本组工具（member-runner 复用的
 *     buildSubagentExtensions 不含 team 工厂）——成员不许建团/再委派；
 *   - **开关**：isEnabled 为 false 时工厂不注册任何工具 —— craft 白名单里的
 *     名字对 pi 静默忽略（docx_convert 先例）。
 *
 * 投影：team_create 的 details 走批 4 通道（shared/child-agents 的契约键），
 * kind 盖 "team" —— 主会话活动卡按团队成员分组呈现，渲染层零改动。
 *
 * ── 模型体验契约（scripts/check-model-experience.ts 机械校验；改行为必须同步改这里）──
 * What the model sees: 四个工具（team_create / team_send / team_status / team_delete）的名称、
 * description 与参数 schema；返回的成员 spawn 计划、成员名单与状态摘要、以及错误文案
 * （未知成员名 / 已有团队 / 成员不许再委派）。成员产出经完成回投作为新消息回到领导会话。
 * Token effect: 定义常驻（**四条**定义，比单工具多三份）；返回是团队规模与状态的摘要文本。
 * KV Cache effect: 定义字面量会话内恒定；但 `isEnabled` 为 false 时四个工具**根本不注册** ——
 * 工具集本身就是前缀的一部分，开关在会话间翻转会让改动点之后的整段前缀（含历史）失配
 * （判据同 mcp-client）。结果追加在历史之后，不动既有前缀。
 */

import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { AgentDefinition } from "../core/agents.ts";
import { ChildAgentsProjection, CHILD_AGENTS_DETAILS_KEY } from "../shared/child-agents.ts";
import { declareReadOnlyTools } from "./permission-policy.ts";

/** 一个成员的 spawn 计划行（agent 名已由装配层校验存在于 agents 库）。 */
export interface TeamMemberPlan {
	readonly name: string;
	readonly agentName: string;
	readonly task: string;
}

export interface TeamStartPlan {
	readonly name: string;
	readonly members: readonly TeamMemberPlan[];
}

/** 成员状态行（写给模型的 team_status 数据源）。 */
export interface TeamMemberState {
	readonly name: string;
	readonly agentName: string;
	readonly status: string;
	readonly turns: number;
	readonly lastActivity: string;
}

export interface MemberSpawnHooks {
	readonly onProgress: (memberName: string, text: string) => void;
	readonly onComplete: (memberName: string, output: string, turns: number) => void;
	readonly onFailed: (memberName: string, message: string) => void;
}

export interface TeamToolDeps {
	/** 团队开关（preferences.agentTeamsEnabled）。false 时工厂不注册任何工具。 */
	readonly isEnabled: () => boolean;
	/** agents 库（成员人格与 model 徽标数据源；成员存在性由 startTeam 实现校验）。 */
	readonly listAgents: () => readonly AgentDefinition[];
	/**
	 * 建团 + 逐成员 spawn（fire-and-forget）。实现应先过注册表校验（单团队/
	 * 重名/预算），再逐成员 spawn；返回时全部成员已 spawn ack。
	 * 任一成员 spawn 失败 → throw（工具把诊断回给模型；已 ack 的成员由
	 * 实现层决定去留，v1 口径：抛错前先解散，不留半支队伍）。
	 */
	readonly startTeam: (
		plan: TeamStartPlan,
		hooks: MemberSpawnHooks,
	) => Promise<readonly { name: string; sessionId: string }[]>;
	/**
	 * 消息投递：to 为成员名或 "@all"。实现负责解析与合成来源标注，走
	 * followUp 通路（idle 唤醒 / running 排队）。未知成员名 → throw。
	 * 返回实际投递到的成员名（写入回传文本）。
	 */
	readonly sendToMembers: (to: string, text: string) => Promise<readonly string[]>;
	/** 当前团队状态；无团队 → undefined。 */
	readonly getTeamState: () => { name: string; members: readonly TeamMemberState[] } | undefined;
	/** 解散：中止 + 清理全部成员与注册表。无团队 → no-op。 */
	readonly closeTeam: () => Promise<void>;
}

const TeamMemberItem = Type.Object({
	name: Type.String({ minLength: 1, description: "成员名（@寻址键，团队内唯一）。" }),
	agent: Type.String({ minLength: 1, description: "agents 库里的定义名（人格与工具面来源）。" }),
	task: Type.String({ minLength: 1, description: "初始任务（自包含：背景、文件路径、验收要求）。" }),
});

/** 投影 details 的形状（契约键即 shared/child-agents 的 CHILD_AGENTS_DETAILS_KEY）。 */
interface TeamToolDetails {
	readonly teamName: string;
	readonly [CHILD_AGENTS_DETAILS_KEY]: ReturnType<ChildAgentsProjection["snapshot"]>;
}

interface ToolResult {
	// pi 的 AgentToolResult.content 是可变数组（TextContent | ImageContent）——
	// 与 task-tool 同款用 Array 标注，readonly 会挂 execute 签名。
	readonly content: Array<{ type: "text"; text: string }>;
	readonly details: TeamToolDetails;
}

const emptyDetails: TeamToolDetails = { teamName: "", [CHILD_AGENTS_DETAILS_KEY]: [] };

export function teamExtensionFactory(deps: TeamToolDeps): ExtensionFactory {
	// 权限档自声明（permission-policy 批注：编排类、无本地路径、无副作用）——
	// 声明在注册处，写工具的人顺手登记，不再有中心清单要记得更新。
	declareReadOnlyTools(["team_create", "team_send", "team_status", "team_delete"]);
	return (pi: ExtensionAPI): void => {
		// 开关关闭时不注册：craft 白名单里的名字对 pi 静默忽略（docx_convert 先例），
		// 模型看不到团队能力，成本为零。
		if (!deps.isEnabled()) return;

		pi.registerTool({
			name: "team_create",
			label: "建团队",
			description:
				"创建团队并启动成员：每个成员是一个独立长会话，带各自人格（agents 库定义）与初始任务。" +
				"成员在后台独立执行（本工具不等它们完成），完成或失败时结果会自动回投到本会话。" +
				"每个会话同时只能有一个团队。成员 1-8 名，成员名是 @寻址的唯一键。" +
				"需要追加指示用 team_send，查进度用 team_status，解散用 team_delete。",
			promptSnippet:
				"team_create: 建团队并行攻坚——成员独立长会话后台跑，产出自动回投；适合可分片的并行任务",
			promptGuidelines: [
				"任务拆分要自包含：成员看不到本会话历史，初始任务里写全背景与验收要求。",
				"先想清楚分工再建团：成员数就是并行度，1-8 人；琐碎任务直接自己做。",
			],
			parameters: Type.Object({
				name: Type.String({ minLength: 1, description: "团队名（展示用）。" }),
				members: Type.Array(TeamMemberItem, {
					minItems: 1,
					maxItems: 8,
					description: "1-8 名成员，名字唯一。",
				}),
			}),
			async execute(_toolCallId, params, _signal, onUpdate): Promise<ToolResult> {
				const plan: TeamStartPlan = {
					name: params.name,
					members: params.members.map((m) => ({ name: m.name, agentName: m.agent, task: m.task })),
				};
				const agents = deps.listAgents();
				const projection = new ChildAgentsProjection(
					plan.members.map((m) => ({
						agent: m.name,
						task: m.task,
						model: agents.find((a) => a.name === m.agentName)?.model,
					})),
					"team",
				);
				// 批 4 通道：host 认 details 键不认工具。content 文本恒空，
				// 进度全走 details 投影（整体替换语义，同 task 工具）。
				const emitProjection = (): void => {
					onUpdate?.({
						content: [{ type: "text" as const, text: "" }],
						details: { teamName: plan.name, [CHILD_AGENTS_DETAILS_KEY]: projection.snapshot() },
					});
				};
				emitProjection();
				const indexOf = (memberName: string): number =>
					plan.members.findIndex((m) => m.name === memberName);
				const acks = await deps.startTeam(plan, {
					onProgress: (memberName, text) => {
						projection.pushActivity(indexOf(memberName), text);
						emitProjection();
					},
					onComplete: () => {},
					onFailed: (memberName, message) => {
						projection.patch(indexOf(memberName), { status: "failed", output: message });
						emitProjection();
					},
				});
				for (const ack of acks) {
					projection.patch(indexOf(ack.name), { status: "running", activity: "已启动" });
				}
				emitProjection();
				const names = acks.map((a) => a.name).join("、");
				return {
					content: [
						{
							type: "text" as const,
							text:
								`团队「${plan.name}」已建立（${acks.length} 名成员）：${names}。\n` +
								"成员已在后台独立执行各自任务，本会话将在它们完成时收到回投消息。" +
								"追加指示用 team_send，查进度用 team_status，解散用 team_delete。",
						},
					],
					details: { teamName: plan.name, [CHILD_AGENTS_DETAILS_KEY]: projection.snapshot() },
				};
			},
		});

		pi.registerTool({
			name: "team_send",
			label: "发成员消息",
			description:
				"向团队成员发消息：to 填成员名或 \"@all\"（全员广播）。正在工作的成员会排队收到，" +
				"已完成的成员会被唤醒继续。消息要自包含——成员不共享你的对话历史。",
			promptSnippet: "team_send: 给团队成员追加指示或提问（@name 定向 / @all 广播），唤醒 idle 成员继续工作",
			parameters: Type.Object({
				to: Type.String({ minLength: 1, description: "成员名或 \"@all\"。" }),
				text: Type.String({ minLength: 1, description: "消息正文（自包含）。" }),
			}),
			async execute(_toolCallId, params): Promise<ToolResult> {
				const delivered = await deps.sendToMembers(params.to, params.text);
				return {
					content: [
						{
							type: "text" as const,
							text: `已投递给：${delivered.join("、")}。成员将按 followUp 语义消费（工作中排队、已完成则唤醒）。`,
						},
					],
					details: emptyDetails,
				};
			},
		});

		pi.registerTool({
			name: "team_status",
			label: "团队状态",
			description: "查看团队成员的当前状态（工作/空闲/失败）、已完成轮数与最近动作。",
			promptSnippet: "team_status: 查团队成员状态，决定等待、追加指示还是汇总",
			parameters: Type.Object({}),
			async execute(_toolCallId, _params): Promise<ToolResult> {
				const state = deps.getTeamState();
				if (state === undefined) {
					return {
						content: [{ type: "text" as const, text: "当前会话没有团队。先用 team_create 建团。" }],
						details: emptyDetails,
					};
				}
				const lines = state.members.map(
					(m) => `- ${m.name}（${m.agentName}）：${m.status}，已完成 ${m.turns} 轮${m.lastActivity === "" ? "" : `，最近：${m.lastActivity}`}`,
				);
				return {
					content: [{ type: "text" as const, text: `团队「${state.name}」：\n${lines.join("\n")}` }],
					details: emptyDetails,
				};
			},
		});

		pi.registerTool({
			name: "team_delete",
			label: "解散团队",
			description: "解散当前团队：中止全部成员并清理。成员未完成的任务会丢失，解散前确认产出已回投或不再需要。",
			promptSnippet: "team_delete: 中止并清理全部团队成员",
			parameters: Type.Object({}),
			async execute(_toolCallId, _params): Promise<ToolResult> {
				await deps.closeTeam();
				return {
					content: [{ type: "text" as const, text: "团队已解散，成员已中止。" }],
					details: emptyDetails,
				};
			},
		});
	};
}
