/**
 * 团队工具八件套（spec: add-team-foundations 批 5；team_shutdown / team_delegate_mode /
 * team_plan_review 见 spec: add-team-collaboration-parity 批次 ②③④；
 * team_read 见 spec: add-team-pull-model 批次③）：
 * team_create / team_send / team_status / team_read / team_shutdown / team_plan_review /
 * team_delegate_mode / team_delete。
 *
 * 与 task-tool 同取向：编排与回传格式在本文件，执行本体（成员 spawn、路由、
 * 注册表）由 daemon 装配时注入 —— 脱离宿主可单测。
 *
 * 语义要点（对齐 WorkBuddy Agent Teams，裁剪见 spec）：
 *   - **单会话单团队**：已有团队时 team_create 响亮报错（注册表层校验，
 *     工具层转述）；
 *   - **fire-and-forget + 拉模式取产出**（spec: add-team-pull-model）：team_create
 *     返回时成员已 spawn ack（会话 id 已定、初始任务已开跑），不等成员完成；
 *     成员产出写在**成员自己的会话记录**里，领导用 **team_read 主动取回** ——
 *     不自动回投。这是对齐 WorkBuddy 的核心手法的落点（它的领导靠
 *     `readTranscript` 读子会话，`derivePersistedTranscriptStatus` 从文件派生状态）；
 *     拉模式同时消灭了「投递可能失败」这个历史事故源（2026-09-19 三次复现）；
 *   - **单成员可优雅关闭**：team_shutdown 只针对一个成员（发收尾请求 → 它交回
 *     报告后关闭；force 走 abort）。整队中止仍然只有 team_delete；
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
 * What the model sees: 八个工具（team_create / team_send / team_status / team_read /
 * team_shutdown / team_plan_review / team_delegate_mode / team_delete）的名称、
 * description 与参数 schema；
 * 返回的成员 spawn 计划、成员名单与状态摘要、以及错误文案（未知成员名 / 已有团队 /
 * 成员不许再委派 / 已关闭成员不再收消息）。成员产出仍由 team_read 取回（team_status 会
 * 标注「有产出可读」）；**本文件不再往工具结果里附加「待送达的成员产出」块** —— 那层
 * 包装已被本 change 删除，「待送达」块统一由 `extensions/team-output-hook.ts` 挂在
 * **任意**工具结果上（含 team_*，见该文件的契约段）。
 * **凡回执都不许出现「完成时会收到回投/产出会送过来」这类推模式措辞**：2026-09-19
 * 真机现场里，team_create 的旧回执正是这么写的，领导据此干等而从不调 team_read。
 * Token effect: 定义常驻（**八条**定义）；返回是团队规模与状态的摘要文本，
 * team_read 返回产出正文（可能很长，这是它的用途）；「待送达的成员产出」块的开销记在
 * team-output-hook 的契约里（全局每份产出只付一次）。
 * KV Cache effect: 定义字面量会话内恒定；但 `isEnabled` 为 false 时八个工具**根本不注册** ——
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
	/**
	 * 成员级模型覆盖（spec: add-team-collaboration-parity 批次 ⑥）：
	 * `providerId/modelId`。缺省 = 用 agent 定义的 model，再缺省 = 领导当前模型。
	 */
	readonly model?: string;
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
	/**
	 * 计划裁决状态（spec: add-team-collaboration-parity 批次 ④）：
	 * `none` 未涉及 / `awaiting` 已交计划待审 / `approved` / `rejected`。
	 */
	readonly planStatus?: string;
	/** 该成员实际使用的模型（`providerId/modelId`）；未记录时缺省。 */
	readonly model?: string;
	/**
	 * 领导已经等了多久（分钟；spec: add-team-interrupt-diagnostics 批次 ②）。
	 * **0 / 缺省 = 不在等待中**（成员已交回产出、失败了、或从未起跑）。
	 *
	 * 把它写进 team_status 是给**模型**看的：领导自己不知道时间流逝，
	 * 没有这个数字它就不会想到「等太久了，该 team_send 问一句或者收尾了」——
	 * 2026-09-19 实测里领导就是在一次进度通报之后永久静默了。
	 */
	readonly waitedMinutes?: number;
	/**
	 * 该成员的会话记录里**有没有可读的产出**（spec: add-team-pull-model 批次③）。
	 *
	 * 与 `status` 正交，且**从文件派生**（不是注册表标记）：只要成员会话里有一条
	 * 带正文的 assistant 消息就是 true。领导据此决定要不要 `team_read` 取回。
	 *
	 * 为什么不做成「注册表里记一个布尔」：那又是一份可能与文件不一致的副本 ——
	 * 拉模式的全部意义就是**文件是唯一真源**（对齐 WorkBuddy 的
	 * `derivePersistedTranscriptStatus`：状态从文件算，不从上一次的结论继承）。
	 */
	readonly outputAvailable?: boolean;
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
	/**
	 * 读取成员的产出正文（spec: add-team-pull-model 批次③）—— **拉模式的核心落点**。
	 *
	 * 对齐 WorkBuddy 的做法：领导拿产出不靠「成员把产出推给我」，而是**自己去读**
	 * 成员的会话记录（它的 `readTranscript` 读 `<taskId>.jsonl`）。产出写进成员
	 * 会话的那一刻就算交付 —— 没有「投递」这个可能失败的环节，也就没有丢的可能。
	 *
	 * 实现层（daemon）读 `~/.kamibuddy/sessions/<memberSessionId>.jsonl`，取最近
	 * 一条有正文的 assistant 消息。成员被解散/会话文件不存在 → 返回 undefined
	 * （工具据此报「读不到」，而不是抛错 —— 读不到是常态，不是异常）。
	 *
	 * @param to 成员名（@寻址键）。未知成员 → throw（那是调用方错误）。
	 */
	readonly readMemberOutput: (to: string) => Promise<{ member: string; output: string | undefined; status: string | undefined } | undefined>;
	/**
	 * 单成员优雅关闭（spec: add-team-collaboration-parity 批次 ②）：
	 * force=false → 投收尾请求（成员交回报告后关闭）；force=true → 直接中止。
	 * 未知成员名 / 未启动 / 已关闭 → throw；返回给模型看的回执文案。
	 */
	readonly shutdownMember: (to: string, reason: string | undefined, force: boolean) => Promise<string>;
	/**
	 * 开关委派模式（spec: add-team-collaboration-parity 批次 ③）：开启后领导工具面
	 * 收窄为协调类。返回给模型看的回执（说明从下一轮起生效）。
	 */
	readonly setDelegateMode: (enabled: boolean) => Promise<string>;
	/**
	 * 记录计划裁决并唤醒成员（spec: add-team-collaboration-parity 批次 ④）：
	 * `awaiting` 只记状态；`approve` / `reject` 记状态后**自动 team_send**
	 * （批准 → 「按计划开工」；驳回 → 带上 feedback 让它改）。返回给模型看的回执。
	 */
	readonly reviewPlan: (
		member: string,
		decision: "awaiting" | "approve" | "reject",
		feedback: string | undefined,
	) => Promise<string>;
	/** 解散：中止 + 清理全部成员与注册表。无团队 → no-op。 */
	readonly closeTeam: () => Promise<void>;
}

const TeamMemberItem = Type.Object({
	name: Type.String({ minLength: 1, description: "成员名（@寻址键，团队内唯一）。" }),
	agent: Type.String({ minLength: 1, description: "agents 库里的定义名（人格与工具面来源）。" }),
	task: Type.String({ minLength: 1, description: "初始任务（自包含：背景、文件路径、验收要求）。" }),
	model: Type.Optional(
		Type.String({ description: "该成员用的模型（providerId/modelId）；缺省跟随你当前的模型。" }),
	),
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
	declareReadOnlyTools(["team_create", "team_send", "team_status", "team_read", "team_delete"]);
	return (pi: ExtensionAPI): void => {
		// 开关关闭时不注册：craft 白名单里的名字对 pi 静默忽略（docx_convert 先例），
		// 模型看不到团队能力，成本为零。
		if (!deps.isEnabled()) return;

		pi.registerTool({
			name: "team_create",
			label: "建团队",
			description:
				"创建团队并启动成员：每个成员是一个独立长会话，带各自人格（agents 库定义）与初始任务。" +
				"成员在后台独立执行（本工具不等它们完成），它们的产出**存在各自的会话记录里**。" +
				"取产出用 team_read（不会自动送到你这里）；查进度用 team_status，追加指示用 team_send，解散用 team_delete。" +
				"每个会话同时只能有一个团队。成员 1-8 名，成员名是 @寻址的唯一键。",
			promptSnippet:
				"team_create: 建团队并行攻坚——成员独立长会话后台跑，产出用 team_read 取回；适合可分片的并行任务",
			promptGuidelines: [
				"任务拆分要自包含：成员看不到本会话历史，初始任务里写全背景与验收要求。",
				"先想清楚分工再建团：成员数就是并行度，1-8 人；琐碎任务直接自己做。",
				"成员跑完后用 team_read 取回产出再汇总 —— 产出不会自动出现。",
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
					members: params.members.map((m) => ({
						name: m.name,
						agentName: m.agent,
						task: m.task,
						...(m.model === undefined ? {} : { model: m.model }),
					})),
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
								"成员已在后台独立执行各自任务。**它们完成后产出不会自动送到你这里** —— " +
								"先 team_status 看谁「有产出可读」，再用 team_read 取回正文。" +
								"追加指示用 team_send，解散用 team_delete。",
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
			description:
				"查看团队成员的当前状态（工作/空闲/失败/已中断）、已完成轮数、最近动作，以及你等它多久了。" +
				"某成员标注「有产出可读」时，用 team_read 取回它的产出正文（产出存在它的会话记录里，不会自动送到你这里）。",
			promptSnippet: "team_status: 查团队成员状态，决定等待、追加指示还是 team_read 取产出",
			parameters: Type.Object({}),
			async execute(_toolCallId, _params): Promise<ToolResult> {
				const state = deps.getTeamState();
				if (state === undefined) {
					return {
						content: [{ type: "text" as const, text: "当前会话没有团队。先用 team_create 建团。" }],
						details: emptyDetails,
					};
				}
				const lines = state.members.map((m) => {
					const plan = m.planStatus === undefined || m.planStatus === "none" ? "" : `，计划：${m.planStatus}`;
					const model = m.model === undefined || m.model === "" ? "" : `，模型：${m.model}`;
					const recent = m.lastActivity === "" ? "" : `，最近：${m.lastActivity}`;
					// 产出可读（批次③，拉模式）：这是领导该去 team_read 的信号。
					const readable =
						m.outputAvailable === true ? "，**有产出可读（team_read 可取回）**" : "";
					// 等待时长（批次 ②）：只在真的在等时附加。超过 5 分钟显式提示
					// 「可能已中断」，让领导有机会主动处置而不是无限期静默。
					const waited =
						m.waitedMinutes === undefined || m.waitedMinutes <= 0
							? ""
							: m.waitedMinutes < 5
								? `，你已等 ${m.waitedMinutes} 分钟`
								: `，你已等 ${m.waitedMinutes} 分钟（**偏久，考虑 team_send 问一句或 team_shutdown 收尾**）`;
					return `- ${m.name}（${m.agentName}）：${m.status}，已完成 ${m.turns} 轮${plan}${model}${recent}${readable}${waited}`;
				});
				return {
					content: [{ type: "text" as const, text: `团队「${state.name}」：\n${lines.join("\n")}` }],
					details: emptyDetails,
				};
			},
		});

		pi.registerTool({
			name: "team_read",
			label: "读成员产出",
			description:
				"读取某个成员的产出正文（它最近一轮交出的完整内容）。" +
				"成员的产出**存在它自己的会话记录里**，完成时不会自动推到你这里 —— 你要用本工具主动取回。" +
				"典型用法：team_status 看到某成员「有产出可读」或「已完成 N 轮」后调 team_read 取回内容，再决定下一步。" +
				"同一份产出可以反复读，内容不变（不会重复、不会丢失）。",
			promptSnippet: "team_read: 取回某个成员的产出正文（产出在它的会话记录里，要用这个读）",
			promptGuidelines: [
				"成员跑完一轮后主动 team_read 取它的产出，不要干等它「自动送过来」—— 产出不会自动送达。",
				"汇总多名成员的产出时逐个 team_read，再自己整合；不要假定内容已在你的上下文里。",
			],
			parameters: Type.Object({
				to: Type.String({ minLength: 1, description: "成员名（@寻址键）。" }),
			}),
			async execute(_toolCallId, params): Promise<ToolResult> {
				const result = await deps.readMemberOutput(params.to);
				if (result === undefined) {
					return {
						content: [{ type: "text" as const, text: "当前会话没有团队。" }],
						details: emptyDetails,
					};
				}
				if (result.output === undefined) {
					const why =
						result.status === "running"
							? "它还在跑，产出还没落盘"
							: result.status === "interrupted"
								? "它上次运行被中断，没有完整产出"
								: result.status === "failed"
									? "它上次运行失败了，没有产出"
									: "它的会话记录里还没有产出";
					return {
						content: [
							{
								type: "text" as const,
								text: `成员「${result.member}」暂无产出可读（${why}）。可以 team_status 看它的状态，或用 team_send 问一句。`,
							},
						],
						details: emptyDetails,
					};
				}
				return {
					content: [
						{
							type: "text" as const,
							text: `成员「${result.member}」的产出：\n\n${result.output}`,
						},
					],
					details: emptyDetails,
				};
			},
		});

		pi.registerTool({
			name: "team_plan_review",
			label: "审计划",
			description:
				"裁决成员交回的计划：`awaiting` 只把状态记为待审（你读了它的计划但还没决定）；" +
				"`approve` 批准并自动让它开工；`reject` 驳回并自动把 feedback 发给它改计划（**驳回必须给反馈**）。" +
				"用法：在初始任务里要求成员「先交计划再动手」，它把计划作为一轮产出自带回投，" +
				"你审阅后用本工具裁决。计划状态可在 team_status 里看到。",
			promptSnippet: "team_plan_review: 裁决成员交回的计划（批准即开工 / 驳回必带反馈）",
			promptGuidelines: [
				"只在初始任务里明确要求过「先交计划」时才走这条链路——小任务交计划纯属多一轮往返。",
				"驳回要写清楚改哪一点（缺什么证据、范围该收在哪），不要只说「再想想」。",
			],
			parameters: Type.Object({
				member: Type.String({ minLength: 1, description: "成员名。" }),
				decision: Type.Union([Type.Literal("awaiting"), Type.Literal("approve"), Type.Literal("reject")]),
				feedback: Type.Optional(Type.String({ description: "驳回时必须给的修改要求（批准时可留一句批注）。" })),
			}),
			async execute(_toolCallId, params): Promise<ToolResult> {
				const text = await deps.reviewPlan(params.member, params.decision, params.feedback);
				return { content: [{ type: "text" as const, text }], details: emptyDetails };
			},
		});

		pi.registerTool({
			name: "team_delegate_mode",
			label: "委派模式",
			description:
				"开关委派模式：开启后你（领导）**只协调不下场**——保留团队、任务、提问与交付工具，" +
				"失去读写文件、执行命令、检索与再委派的能力，所有实际工作必须由成员完成。" +
				"适合「这次我只做编排与裁决」的任务；想自己下场就先关掉它。只影响本会话（不写设置）。",
			promptSnippet: "team_delegate_mode: 开启后领导工具面收窄为团队/任务/交付类，只协调不下场",
			parameters: Type.Object({
				enabled: Type.Boolean({ description: "true 开、false 关。" }),
				reason: Type.Optional(Type.String({ description: "开启/关闭理由（写进回执，便于用户理解这次策略）。" })),
			}),
			async execute(_toolCallId, params): Promise<ToolResult> {
				const text = await deps.setDelegateMode(params.enabled);
				return { content: [{ type: "text" as const, text }], details: emptyDetails };
			},
		});

		pi.registerTool({
			name: "team_shutdown",
			label: "收尾成员",
			description:
				"让**单个**成员收尾退出：它会把手上的工作整理成最终报告（写在它的会话记录里，用 team_read 取回），然后结束。" +
				"适合收掉跑偏的成员、或某个维度已经问完不再需要它。与 team_delete 的区别：" +
				"后者中止**整个**团队。成员交完报告后状态变 closed，不能再给它发消息；" +
				"若它长时间不收尾，可用 force 强制中止（当前轮产出会丢弃）。",
			promptSnippet: "team_shutdown: 让单个成员收尾退出（交回报告后关闭），区别于整队 team_delete",
			parameters: Type.Object({
				to: Type.String({ minLength: 1, description: "成员名（单成员语义，不支持 \"@all\"；整队请用 team_delete）。" }),
				reason: Type.Optional(
					Type.String({ description: "收尾原因（写进给成员的消息里，让它知道该收在哪）。" }),
				),
				force: Type.Optional(Type.Boolean({ description: "true = 直接中止，不等它交报告。" })),
			}),
			async execute(_toolCallId, params): Promise<ToolResult> {
				const text = await deps.shutdownMember(params.to, params.reason, params.force === true);
				return { content: [{ type: "text" as const, text }], details: emptyDetails };
			},
		});

		pi.registerTool({
			name: "team_delete",
			label: "解散团队",
			description: "解散当前团队：中止全部成员并清理。成员未完成的任务会丢失；解散前先用 team_read 取回还需要保留的产出。",
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
