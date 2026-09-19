/**
 * 当前专家 chip（composer 底栏「+」按钮右侧，WorkBuddy cr-chip 同款）：
 * 首页与对话页共用同一展示 —— 两处都从 session_state.expertId 映射出专家，
 * 未选中 / 列表里找不到时不渲染（chip 只是展示映射，勾选以 expertId 为准）。
 *
 * 从 chat-view 抽出：首页经由「+」菜单选中专家后同样要显示 chip，两页共用。
 * 静态不可点（role=status，不挂点击）；hover/focus-within 时头像原位换成 ×，
 * 点击取消选中 —— onClear 走 setExpert(undefined)，只清专家、不动交互模式。
 * 两态切换纯 CSS 实现（见 index.css .expert-chip），这里没有状态。
 */

import type { ExpertListItem } from "@shared/ipc.ts";
import { ExpertAvatar } from "./expert-avatar.tsx";
import { IconClose } from "./icons.tsx";

export function ExpertChip({
	expert,
	onClear,
}: {
	readonly expert: ExpertListItem;
	readonly onClear: () => void;
}): React.JSX.Element {
	return (
		<span className="expert-chip" role="status" title={`当前专家：${expert.displayName}`}>
			<ExpertAvatar displayName={expert.displayName} />
			<button
				type="button"
				className="expert-chip-close"
				aria-label={`取消选中专家 ${expert.displayName}`}
				title="取消选中"
				onClick={onClear}
			>
				<IconClose size={12} />
			</button>
			<span className="expert-chip-name">{expert.displayName}</span>
		</span>
	);
}
