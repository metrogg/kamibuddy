/**
 * 提示词切换：pi 扩展，在每次 agent run 开始前注入组合好的 systemPrompt，
 * 并把「逐 run 会变的事实」作为**持久快照消息**交给 pi。
 *
 * **系统提示词必须字节稳定**（本扩展最重要的一条纪律，spec: stabilize-prompt-prefix）：
 * 系统提示词位于整段对话历史之前，是 provider 前缀缓存里最长公共前缀的头部 ——
 * 它内部任何一个字节的变化，都会让它**之后的一切（含整段历史）**在缓存里失配，
 * 代价随会话长度放大。所以**逐轮 / 逐 run 会变的事实一律不许进系统提示词**
 * （时间、记忆内容、个性化、工作区文件内容），它们只能走 append-only 的注入，
 * 落在对话历史之后。唯一仍留在提示词里的工作区文件内容是 pi 的 `contextFiles`
 * （AGENTS.md 类项目指令文件）：forced 整串替换让 pi 不再自动附加它，只能由
 * `formatPiContextBlock` 拼回 pi-context 段；pi 在会话建立时装载、会话内不重读，
 * 不属逐轮事实（判据见 prompt-composer.ts 文件头）。
 *
 * 为什么是「字节稳定」而不是 pi 的分段 diff + patch：发布依赖
 * @earendil-works/pi-coding-agent@0.85.1 的 BuildSystemPromptOptions 没有
 * sections / forceSystemPrompt，emitBeforeAgentStart 只认 handler 返回的
 * systemPrompt 字符串（agent-session.js 把它整串写进 agent.state.systemPrompt）
 * —— 根本没有消息级 patch 可走（spec.md 末尾「探针结论（实测）」①）。实测也
 * 证实这条路线有效：提示词字节一字未变的那一轮首调缓存命中 93%，变更一处即
 * 掉到 62%（②）。将来若升级到带 sections 的版本再评估改成声明式分段 ——
 * 届时要先复核 dsh 记录的那条模型契约（「中段 system 被当作完整系统提示词」）
 * 在我们这条 OpenAI 兼容端点上是否复现（③）。
 *
 * 为什么用 before_agent_start：pi 官方的「每轮替换系统提示词」路径
 * （BeforeAgentStartEventResult.systemPrompt），run 结束自动清空 ——
 * 场景/模式切换不需要任何状态同步，权威状态始终在宿主侧。
 *
 * 关键代价（勿忘）：这个覆盖是**整体替换**，pi 默认会自动附加的技能清单、
 * 工作目录、上下文文件全部失效 —— 技能清单与上下文文件由 compose 自己拼回
 * （formatSkillsSection / formatPiContextBlock），工作目录则由 session-host 的
 * hidden context `workspace_context` 每 run 提供（pi 内置的那行 `cwd` 随整串替换
 * 一起没了，所以骨架里也不能再手写一行）。
 *
 * ## 逐 run 会变的事实怎么投递（四条快照通道，spec: persist-context-snapshots / add-supersede-note-and-time-split / inject-team-output-snapshot）
 *
 * 投递方式是「**落盘的持久消息 + 只在内容真变时追加**」，三个判据按序：
 *   (a) 绝不改动系统提示词：provider 的前缀缓存比的是最长公共前缀，而系统
 *       提示词在整段对话历史之前，它的任何字节变化都会让**其后的一切（含
 *       整段历史）**失配；
 *   (b) 落进会话文件、位置固定：`before_agent_start` 返回的 `message` 会被 pi
 *       写进会话（agent-session.js → sessionManager.appendCustomMessageEntry），
 *       落位在**本轮用户消息之后**、成为历史的正常一员 ⇒ 它自身的内容变化只影响
 *       它自己那一段，且下一轮它**还在原位**（不是一条每轮重算的新尾巴）。
 *       早先的形态是 `context` 事件每请求现算的尾部注入、**返回值不落会话文件**：
 *       当时的论证是「不落盘 ⇒ 不按序列重复付」，2026-09-18 实测证明那条是错的 ——
 *       正因为不落盘，它每轮都是一条新的尾部消息、位置每轮后移，每轮都 miss
 *       （实测 24 次调用注入 24 次、白付 58,094 token，占会话未命中 28.8%；
 *       详见 shared/hidden-context.ts 文件头）。
 *   (c) 按需追加 ⇒ 不无界增长会话日志：只在「渲染结果与活分支上最后一条同类型
 *       快照逐字节不同」时才追加一条（dsh 的「只在变化时记录」纪律，
 *       shared/hidden-context.ts 的 shouldAppendSnapshot）。判据 (c) 早先正是
 *       「不落盘」的辩护理由，现在由去重来满足 —— 落盘与不膨胀不再互斥。
 *   (d) 每条快照正文以取代声明开头（shared/hidden-context.ts 的
 *       SNAPSHOT_SUPERSEDE_NOTE）：追加是 append-only 的，同一通道会并存多份
 *       （时间每分钟一条），必须告诉模型冲突时以最新那条为准。**例外是
 *       team-output 通道**：它是增量（旧产出并不被新快照取代，且它们是不同
 *       内容），故正文不含取代声明 —— 声明在哪条通道写由各自的 composer 决定。
 *
 * 四条通道**各自独立去重、各自追加**（不拼成一条消息）：
 *   - runtime context（记忆内容 + 个性化）—— 变化罕见（记忆被写才变）；
 *   - hidden context（工作目录 / python_env / 记忆指针）—— 环境事实，几乎不变；
 *   - run time（当前时间）—— 按分钟变，但只在跨分钟时追加一条时间块；实测该块
 *     150 字符 / 61 estTokens，其中真新信息只有时间戳 26 字符 ≈11 est，其余是取代声明
 *     （≈26 est）与容器/标签（≈25 est）（构成与口径见 shared/hidden-context.ts 的契约段）。
 *   - team-output（成员状态行 + 尚未注入过的成员产出）—— 只在「有还没进过领导
 *     上下文的产出」或状态行变了时才追加；「已注入过」的判据是产出指纹在不在
 *     上一条同通道快照里（本文件 team-output handler 把它读出来交给 composer）。
 * 合并成一条会让稳定那部分跟着时间每 run 重发（spec: persist-context-snapshots
 * 否决方案 ④）；而「时间与环境块共处一条」的形态（上一版）会让 1,046 字符里
 * 真正变的那 20 字符把整条带上 —— 按新证据改掉（spec:
 * add-supersede-note-and-time-split）。
 *
 * 时间只在 run time 通道里：它由 session-host 在 run 开始冻结（`current_time`，
 * 单独一个读口），同一类事实只有一个来源 —— 两边都注入还会让两份时间的值漂移。
 *
 * 错误语义（写在这里免得后人误以为异常会响亮）：pi 对 before_agent_start handler
 * 的异常是**吞掉并记扩展错误日志**（runner.js 的 emitBeforeAgentStart try/catch，
 * 与 transformContext 的 "must not throw" 同纪律）。所以 composeRuntimeContext
 * 采用读侧既有的降级口径（记忆读不出当没有、偏好读不出当未配置），读会话失败也
 * 按「没有基线 ⇒ 追加」处理，都不在这里抛错。
 *
 * 本文件是薄胶水：只 import core 的类型（PromptContextOptions，编译期擦除），
 * 运行时仍只依赖注入的回调，同 permission-gate 的做法，便于脱离宿主测试。
 *
 * ── 模型体验契约（scripts/check-model-experience.ts 机械校验；改行为必须同步改这里）──
 * What the model sees: 五个 `before_agent_start` handler —— ① 返回**整串 systemPrompt**（pi 把它写成
 * leading system 消息 = 请求的 message 0，位于整段对话历史之前）；② / ③ / ④ / ⑤ 四条**持久快照消息**：
 * 逐 run 可变事实（记忆内容 / 个性化）、hidden context 环境块（工作目录 / python_env / 记忆指针）、
 * 当前时间（`kamibuddy-run-time`）、团队产出增量（成员状态行 + 尚未注入过的成员产出，
 * `kamibuddy-team-output`），都是 role:"custom" + 具名 customType + display:false，落在**本轮用户消息
 * 之后**、写进会话文件，内容与上一条**同 customType** 快照逐字节相同时**不追加**（注册顺序固定 ⇒ 消息
 * 在请求体里的相对顺序跨调用稳定）。前三条正文以取代声明开头；team-output 语义是**增量**、
 * 旧产出不被新快照取代，故正文**不含**取代声明（取代声明由各通道的 composer 自己决定）。
 * Token effect: 系统提示词每请求全量付（常驻在请求头部，与历史长度无关）；每条快照每个 run 最多付一次，
 * 内容没变则一次都不付（不追加）—— team-output 同理：没有新产出、状态行也逐字节没变时一个字节都不付；
 * 时间跨分钟时只有时间块重付（实测 150 字符 / 61 estTokens，
 * 其中真新信息只有时间戳 26 字符 ≈11 est），环境块不重付；沉积进历史后
 * 按普通消息参与后续每轮前缀（命中价）。
 * KV Cache effect: 系统提示词是缓存前缀的**头部** —— 它内部一个字节变化就让其后的一切（含整段历史）
 * 失配（实测：字节不变 93.2% / 变更一行 62.0%，见 docs/可观测性清单.md CACHE8）；快照落点固定
 * （本轮用户消息之后、历史的正常一员）且按需追加 ⇒ 前缀不被它截断，也不再每轮重付。
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { shouldAppendSnapshot } from "../shared/hidden-context.ts";
import {
	HIDDEN_CONTEXT_CUSTOM_TYPE,
	RUN_TIME_CUSTOM_TYPE,
	RUNTIME_CONTEXT_CUSTOM_TYPE,
	TEAM_OUTPUT_CUSTOM_TYPE,
} from "../shared/observability.ts";
import type { PromptContextOptions } from "../core/prompt-composer.ts";

/*
 * 四条快照通道的自定义类型（pi 的 CustomMessage.customType）住在
 * shared/observability.ts（`RUNTIME_CONTEXT_CUSTOM_TYPE` /
 * `HIDDEN_CONTEXT_CUSTOM_TYPE` / `RUN_TIME_CUSTOM_TYPE` /
 * `TEAM_OUTPUT_CUSTOM_TYPE`）：消费点不止本扩展
 * （会话导出 / 翻译过滤 / request_snapshot 都按它认条目），而 core 不许 import
 * extensions（AGENTS.md §1）—— 常量放 shared 才是唯一实现处，这里 import 用。
 */

export interface PromptSwitchOptions {
	/**
	 * 当前两轴 + 专家绑定。权威状态在宿主（SessionHost / daemon 的
	 * conversation 折叠），经此读取。expertId 与交互模式**正交**：只反映
	 * 是否绑定了专家，与 interactionId 无关（spec: rework-expert-orthogonal-and-skills）；
	 * 子代理 / run 会话不起专家，省略即可。
	 */
	readonly getCurrent: () => {
		readonly sceneId: string;
		readonly interactionId: string;
		readonly expertId?: string;
	};
	/** 组装最终提示词。抛错会沿 pi 的事件链向上传播，让这次 run 响亮失败。 */
	readonly compose: (
		sceneId: string,
		interactionId: string,
		expertId: string | undefined,
		piContext: PromptContextOptions,
	) => Promise<string>;
	/**
	 * 第一条快照通道：本次请求的逐 run 可变事实（记忆内容 / 个性化，
	 * core/prompt-composer.ts 的 formatRuntimeContext 是它的纯函数实现）。
	 *
	 * **每个 run 现读一次**（before_agent_start 只在 run 开始时触发）：run 中途
	 * 记忆被改，本 run 看不到，下一个 run 生效 —— 本项目没有 run 内的记忆写入口
	 * （spec: persist-context-snapshots 的「已知代价」）。
	 *
	 * 运行时间不在这里：session-host 的 hidden context `current_time` 是它唯一的
	 * 来源（run 冻结、同落一条快照），两边都注入就是同一事实两个来源。
	 *
	 * 返回空串 = 不注入（零 token 口径；调用方对空段的既有处理）。
	 */
	readonly composeRuntimeContext: () => string;
	/**
	 * 第二条快照通道：hidden context **环境块**（工作目录 / 托管运行时 / 记忆指针）。
	 * 内容由宿主在 run 开始冻结，daemon 经
	 * `SessionHost.peekHiddenContext()` 接进来（时序见那个方法的注释）。
	 *
	 * **必填**：这个口子漏接 = 模型看不到工作目录与运行时路径（且不会响亮失败），
	 * 所以由类型强制每个宿主都给出取法（子代理 / run 会话同样有 hidden context）。
	 *
	 * 时间**不在**这里（上一版在这里，spec: add-supersede-note-and-time-split 拆掉了）：
	 * 它按分钟变、环境块几乎不变，共处一条会让分钟一变整条重发。
	 *
	 * 返回 undefined / 空白 = 本 run 不注入。
	 */
	readonly composeHiddenContext: () => string | undefined;
	/**
	 * 第三条快照通道：hidden context **时间块**（当前时间，`kamibuddy-run-time`）。
	 * 与 `composeHiddenContext` 同源同一次冻结，只是另一个读口
	 * （`SessionHost.peekRunTime()`）。
	 *
	 * **必填**：漏接 = 模型看不到「现在几点」（系统提示词里已不含时间，这是唯一来源），
	 * 且同样不会响亮失败。
	 *
	 * 返回 undefined / 空白 = 本 run 不注入。
	 */
	readonly composeRunTime: () => string | undefined;
	/**
	 * 第四条快照通道：团队产出增量（成员状态行 + 尚未注入过的成员产出正文）。
	 *
	 * 与另外三条的差别：**它需要上一条同通道快照的正文**（`previous`）——
	 * 「哪些成员产出已经注入过」的判据是产出指纹有没有出现在上一条同通道快照里，
	 * 所以基线必须由调用方（本文件的 handler）读出来传进去。
	 */
	readonly composeTeamOutput: (previous: string | undefined) => string | undefined;
}

/**
 * 会话活分支上最后一条同 `customType` 快照的正文 —— 去重基线。
 *
 * 读的是 `buildContextEntries()`（**compaction-aware** 的活条目列表）：被压缩遮蔽
 * 掉的快照不算数，下一次 run 会按需重新追加一条（spec 的期望行为）。**不许做
 * 进程内缓存** —— resume / 新进程必须靠会话文件本身判定。
 *
 * 末条同类型条目的内容不是字符串（不是本通道写的形态）时按「没有基线」处理：
 * 追加一条是幂等噪声，漏追加会让模型这一轮读到旧的环境事实。
 */
function lastSnapshotContent(
	entries: readonly unknown[],
	customType: string,
): string | undefined {
	for (let i = entries.length - 1; i >= 0; i -= 1) {
		const entry = entries[i] as { type?: unknown; customType?: unknown; content?: unknown };
		if (entry.type !== "custom_message" || entry.customType !== customType) continue;
		return typeof entry.content === "string" ? entry.content : undefined;
	}
	return undefined;
}

/**
 * 一个快照通道的 handler 体：内容与基线逐字节相同时不返回 message
 * （pi 拿不到 message 就不会追加条目）。
 *
 * 读会话失败按读侧降级口径处理（当没有基线 ⇒ 追加）：多追加一条只是幂等噪声，
 * 而漏追加会让模型的这一轮少了环境事实。must not throw —— pi 会吞掉 handler
 * 异常并只记扩展错误日志，那条通道这一轮就静默消失了。
 */
function snapshotMessage(
	ctx: ExtensionContext,
	customType: string,
	text: string | undefined,
): { readonly message: { customType: string; content: string; display: false } } | undefined {
	if (text === undefined || text.trim() === "") return undefined;
	let previous: string | undefined;
	try {
		previous = lastSnapshotContent(ctx.sessionManager.buildContextEntries(), customType);
	} catch {
		previous = undefined;
	}
	if (!shouldAppendSnapshot(previous, text)) return undefined;
	return { message: { customType, content: text, display: false } };
}

export function createPromptSwitch(options: PromptSwitchOptions) {
	return (pi: ExtensionAPI): void => {
		pi.on("before_agent_start", async (event) => {
			const { sceneId, interactionId, expertId } = options.getCurrent();
			// pi 在事件里已经给好它加载到的上下文文件与工具提示，这里透传，
			// 不再让宿主重复发现资源（BeforeAgentStartEvent.systemPromptOptions）。
			const piContext: PromptContextOptions = {
				contextFiles: event.systemPromptOptions.contextFiles,
				toolSnippets: event.systemPromptOptions.toolSnippets,
				promptGuidelines: event.systemPromptOptions.promptGuidelines,
			};
			return {
				systemPrompt: await options.compose(sceneId, interactionId, expertId, piContext),
			};
		});

		/*
		 * 四条快照通道各注册一个 handler。pi 的单次 before_agent_start 里每个
		 * handler 只能返回**一条** message，而 runner 会遍历同一扩展注册的**全部**
		 * before_agent_start handler、把它们各自的 message 依次收进 messages 数组
		 * （dist/core/extensions/runner.js 的 emitBeforeAgentStart：
		 * `for (const handler of handlers) … messages.push(result.message)`；
		 * loader.js 的 `on` 也是 push 进数组而非覆盖）。所以「四个 handler」就是
		 * 「四条独立快照」——不必把几块正文拼成一条（合并的代价见文件头）。
		 *
		 * **注册顺序固定**（systemPrompt → runtime-context → hidden-context →
		 * run-time → team-output）：handler 的返回按注册序收进 messages 数组，于是
		 * 四条快照在请求体与会话文件里的**相对顺序跨调用稳定** —— 顺序一变就是位置
		 * 变化，缓存前缀在那里断掉。调整顺序等于改模型可见的形态，须同步本文件头的
		 * 契约段。
		 *
		 * 四条通道各自去重、各自追加：各自读自己的 customType 基线，互不影响。
		 */
		pi.on("before_agent_start", (_event, ctx) =>
			snapshotMessage(ctx, RUNTIME_CONTEXT_CUSTOM_TYPE, options.composeRuntimeContext()),
		);
		pi.on("before_agent_start", (_event, ctx) =>
			snapshotMessage(ctx, HIDDEN_CONTEXT_CUSTOM_TYPE, options.composeHiddenContext()),
		);
		pi.on("before_agent_start", (_event, ctx) =>
			snapshotMessage(ctx, RUN_TIME_CUSTOM_TYPE, options.composeRunTime()),
		);
		/*
		 * team-output 比前三条多一步：先读出**上一条同通道快照的正文**交给 composer
		 * —— 「哪些成员产出已经注入过」的判据是产出指纹在不在那条快照里，而这个基线
		 * 只有 handler 手里的 ctx 读得出来（见 PromptSwitchOptions.composeTeamOutput）。
		 * 读会话失败按「没有基线」降级（try/catch 的理由同 snapshotMessage 的注释）。
		 */
		pi.on("before_agent_start", (_event, ctx) => {
			let previous: string | undefined;
			try {
				previous = lastSnapshotContent(
					ctx.sessionManager.buildContextEntries(),
					TEAM_OUTPUT_CUSTOM_TYPE,
				);
			} catch {
				previous = undefined;
			}
			return snapshotMessage(ctx, TEAM_OUTPUT_CUSTOM_TYPE, options.composeTeamOutput(previous));
		});
	};
}
