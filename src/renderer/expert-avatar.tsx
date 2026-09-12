/**
 * 专家首字符圆形彩色头像（WorkBuddy 专家头像缺失时的首字符 fallback 同款机制）：
 * 8 色板按名称 hash 取色 —— 同一专家恒同色，不引入图片资产也不靠随机。
 *
 * 从 chat-view 抽出：composer-bar 的当前专家 chip（16px）与专家市场页卡片
 * （36px）/详情弹窗（72px）共用同一取色与首字符逻辑，尺寸差异由调用方
 * 经 className 下发（CSS 管尺寸，这里只内联背景色）。
 */

const EXPERT_AVATAR_COLORS = [
	"#5b8ff9",
	"#61ddaa",
	"#65789b",
	"#f6bd16",
	"#7262fd",
	"#78d3f8",
	"#9661bc",
	"#f6903d",
] as const;

export function ExpertAvatar({
	displayName,
	className,
}: {
	readonly displayName: string;
	/** 尺寸变体类（如 ex-card-avatar）；缺省为 chip 内 16px 的基础样式。 */
	readonly className?: string;
}): React.JSX.Element {
	let hash = 0;
	// for..of 按码点遍历：displayName 是中文名，不会被 UTF-16 代理对拆散。
	for (const ch of displayName) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) | 0;
	const color = EXPERT_AVATAR_COLORS[Math.abs(hash) % EXPERT_AVATAR_COLORS.length] ?? EXPERT_AVATAR_COLORS[0];
	return (
		<span
			className={`expert-avatar${className === undefined ? "" : ` ${className}`}`}
			style={{ background: color }}
			aria-hidden="true"
		>
			{[...displayName][0] ?? ""}
		</span>
	);
}
