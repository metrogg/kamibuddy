/**
 * 提示词切换：pi 扩展，在每次 agent run 开始前注入组合好的 systemPrompt，
 * 并在每次模型调用前把「逐轮会变的事实」作为消息注入。
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
 * hidden context `workspace_context` 每轮提供（pi 内置的那行 `cwd` 随整串替换
 * 一起没了，所以骨架里也不能再手写一行）。
 *
 * 逐轮会变的事实为什么不进系统提示词，而走 `context` 事件
 * （spec: stabilize-prompt-prefix）——三条判据按序：
 *   (a) 绝不改动系统提示词：provider 的前缀缓存比的是最长公共前缀，而系统
 *       提示词在整段对话历史之前，它的任何字节变化都会让**其后的一切（含
 *       整段历史）**失配；
 *   (b) 落在对话历史之后：`context` 事件的返回值只在本次 provider 请求生效
 *       （pi 0.85.1 把它接在 agent-loop 的 transformContext 上，
 *       dist/core/sdk.js 的 transformContext → extensions/runner.js 的
 *       emitContext），把注入消息**追加在消息数组末尾**即位于历史之后 ——
 *       它自己的任何变化都不可能让此前的前缀失配；
 *   (c) 不无界增长会话日志：`context` 的返回值不落会话文件。备选方案
 *       before_agent_start 的 `message` 会被持久化进会话（每轮一条），而
 *       这里的事实逐轮都可能变（记忆会被模型自己写、个性化会被用户改），
 *       走那条路要么每轮写一条、要么自己维护「上次注入的内容」做变化检测
 *       （dsh 的「只在变化时记录」纪律）；`context` 每请求现算现送，
 *       两条负担都不存在。
 * 因此选 `context`。它只管**记忆内容与个性化**：时间由 session-host 的 hidden
 * context `current_time` 提供（run 开始冻结）—— 同一类事实只有一个来源，
 * 两边都注入还会让两份时间的值漂移。
 *
 * 错误语义的差异（写在这里免得后人误以为异常会响亮）：pi 对 `context` handler
 * 的异常是**吞掉并记扩展错误日志**（runner.js 的 emitContext try/catch，
 * agent-loop 的 transformContext 契约就是 "must not throw"）。所以 composeRuntimeContext
 * 采用读侧既有的降级口径（记忆读不出当没有、偏好读不出当未配置），不在这里抛错。
 *
 * 本文件是薄胶水：只 import core 的类型（PromptContextOptions，编译期擦除），
 * 运行时仍只依赖注入的回调，同 permission-gate 的做法，便于脱离宿主测试。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { PromptContextOptions } from "../core/prompt-composer.ts";

/**
 * 注入消息的自定义类型（pi 的 CustomMessage.customType）。它有实际作用而非装饰：
 * 消息数组里一眼能认出这条不是用户输入、不进面板展示，将来排查「模型为什么在
 * 这一轮看到这份记忆/个性化」时也能按它检索。（时间不走这条消息：它由 hidden
 * context 的 `current_time` 送达。）
 */
export const RUNTIME_CONTEXT_CUSTOM_TYPE = "kamibuddy-runtime-context";

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
	 * 组装本次请求的逐轮可变事实注入块：记忆内容 / 个性化
	 * （core/prompt-composer.ts 的 formatRuntimeContext 是它的纯函数实现）。
	 * **每个模型调用前现读**（不是每 run 一次）：长 run 里记忆会被模型自己写、
	 * 个性化会被用户改，现读才与「此刻的事实」一致。
	 *
	 * 运行时间不在这里：session-host 的 hidden context `current_time` 是它唯一的
	 * 来源（run 冻结、落在对话历史之后），两边都注入就是同一事实两个来源。
	 *
	 * 返回空串 = 不注入（零 token 口径；调用方对空段的既有处理）。
	 */
	readonly composeRuntimeContext: () => string;
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

		// 逐轮可变事实的注入点（判据见文件头）。追加在末尾 = 落在对话历史之后：
		// 注入块自身变化时，前缀（系统提示词 + 历史）照常命中缓存。
		pi.on("context", (event) => {
			const text = options.composeRuntimeContext();
			if (text.trim() === "") return;
			return {
				messages: [
					...event.messages,
					{
						role: "custom" as const,
						customType: RUNTIME_CONTEXT_CUSTOM_TYPE,
						content: text,
						// 不上界面：注入块是实现细节不是会话内容（它也不落会话文件）。
						display: false,
						timestamp: Date.now(),
					},
				],
			};
		});
	};
}
