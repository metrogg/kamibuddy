/**
 * 当前交互模式 chip（composer 底栏，「+」按钮右侧，WorkBuddy mode-chip 同款）：
 * 首页与对话页共用同一展示 —— 两处都从 session_state.interactionId 映射出模式。
 *
 * **只在非默认档（问答 / 计划）出现**。默认档（craft）也是常态，返回 null ——
 * 常驻一个 chip 只会变成噪音，而它要传达的恰恰是「现在不是常态」。
 *
 * 为什么必须留这个展示（2026-09-17 试用反馈）：头部原来那个三档开关去掉了 ——
 * 它与输入框「＋ → 模式」同一份数据源、同一个动作，是重复入口，还常驻占着标题
 * 右侧。去掉后「我现在在什么模式」不能没有着落：模式是**会话级持久**状态，
 * 进了 plan/ask（都是只读白名单）而界面不显示，用户会以为工具集丢了
 * （典型症状：在 plan 模式里让模型写文件，它只能拒绝）。
 *
 * WorkBuddy 可证的做法（docs/WorkBuddy-reference/extracted/renderer/assets/
 * wb-status-chips-COi3mYhq.js）：三档只留在 wb-input-add 的子菜单里，头部没有
 * 开关；当前模式另有一个 ModeChip 挂在输入框状态行，`currentMode === "craft"`
 * 时直接返回 null。
 *
 * × 常驻可见（与同排的 ExpertChip 的 hover 才现不同）：模式是限制能力的状态，
 * 「怎么退出」是 chip 存在的主要理由，藏起来就白留这个入口。两态切换无状态，
 * 点击直接回到默认档 —— 模式之间互斥，「切到另一个」走「＋ → 模式」。
 */

import type { ModeDescriptor } from "@shared/session-events.ts";

/**
 * 默认交互模式 id。与 shared/conversation.ts 的
 * initialConversation.state.interactionId、resources/modes/craft.md 同名
 * —— 三处对齐的是「craft 是默认档」这一约定。
 */
const DEFAULT_INTERACTION_ID = "craft";

export function ModeChip({
	interactions,
	currentId,
	onChange,
}: {
	readonly interactions: readonly ModeDescriptor[];
	readonly currentId: string;
	readonly onChange: (id: string) => void;
}): React.JSX.Element | null {
	const current = interactions.find((m) => m.id === currentId);
	/*
	 * 三种不渲染：清单还没回来（快照前的空数组）、就是默认档、id 找不到。
	 * 与 ExpertChip 同口径 —— chip 只是展示映射，权威值在 session_state。
	 */
	if (current === undefined || current.id === DEFAULT_INTERACTION_ID) return null;
	return (
		<span className="mode-chip" role="status" title={current.description}>
			<span className="mode-chip-label">{current.label}</span>
			<button
				type="button"
				className="mode-chip-clear"
				aria-label={`退出${current.label}模式`}
				title="退出该模式"
				onClick={() => onChange(DEFAULT_INTERACTION_ID)}
			>
				×
			</button>
		</span>
	);
}
