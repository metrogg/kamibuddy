/**
 * 内联 SVG 图标集。
 *
 * 不引第三方图标库的原因：renderer 跑在严格 CSP 下（main/index.ts installCsp），
 * 内联 SVG 零网络、零字体依赖；且 WorkBuddy 的图标素材我们不能直接拿（AGENTS.md §6），
 * 自己画一套风格相近的线性图标最干净。
 */

import type { DocBadge } from "@shared/doc-formats.ts";

interface IconProps {
	readonly size?: number;
	readonly className?: string;
}

/** 统一 stroke 风格的 24 视窗图标。fill:none + 圆角端点是整套图标的视觉约定。 */
function Svg({ size = 16, className, children }: IconProps & { readonly children: React.ReactNode }): React.JSX.Element {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			{children}
		</svg>
	);
}

export const IconPlus = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		<path d="M12 5v14M5 12h14" />
	</Svg>
);

export const IconAssistant = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		<rect x="4" y="8" width="16" height="12" rx="3" />
		<path d="M12 8V4M8 13h.01M16 13h.01M9 17h6" />
	</Svg>
);

export const IconProject = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
	</Svg>
);

export const IconSkill = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		<path d="M12 3l1.9 4.6L18.5 9l-4.6 1.4L12 15l-1.9-4.6L5.5 9l4.6-1.4z" />
		<path d="M18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z" />
	</Svg>
);

export const IconAutomation = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		<path d="M13 2 4 14h6l-1 8 9-12h-6z" />
	</Svg>
);

export const IconLibrary = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5z" />
		<path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
	</Svg>
);

export const IconMore = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		<circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
		<circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
		<circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none" />
	</Svg>
);

export const IconSend = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		<path d="M12 19V5M5 12l7-7 7 7" />
	</Svg>
);

export const IconMic = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		<rect x="9" y="3" width="6" height="11" rx="3" />
		<path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
	</Svg>
);

export const IconBack = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		<path d="M19 12H5M12 19l-7-7 7-7" />
	</Svg>
);

export const IconRefresh = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		<path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" />
	</Svg>
);

export const IconClose = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		<path d="M18 6 6 18M6 6l12 12" />
	</Svg>
);

export const IconDoc = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
		<path d="M14 3v5h5M9 13h6M9 17h6" />
	</Svg>
);

/**
 * 文档附件 chip 的格式图标：文档轮廓 + 右下角格式小字标（PDF/DOC/XLS/PPT/ODF）。
 * badge（分色族 + 字标）来自 shared/doc-formats.ts 的 docBadgeOf——扩展名到
 * 族/字标的映射只在那一份，这里不另写（§4）；颜色由 CSS 按 doc-file-<族> 类
 * 经 currentColor 分色（pdf 红 / word 蓝 / excel 绿 / ppt 橙）。
 */
export const IconDocFile = ({
	badge,
	size = 16,
}: {
	readonly badge: DocBadge;
	readonly size?: number;
}): React.JSX.Element => (
	<Svg size={size} className={`doc-file-icon doc-file-${badge.family}`}>
		<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
		<path d="M14 3v5h5" />
		{/* 字标用 fill 而非 stroke：6px 字描边会糊成一团。 */}
		<text x="17" y="18.5" textAnchor="end" fontSize="6" fontWeight="bold" fill="currentColor" stroke="none">
			{badge.label}
		</text>
	</Svg>
);

export const IconChart = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		<path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
	</Svg>
);

export const IconSlide = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		<rect x="3" y="4" width="18" height="12" rx="2" />
		<path d="M12 16v4M8 20h8" />
	</Svg>
);

export const IconResearch = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		<circle cx="11" cy="11" r="7" />
		<path d="m21 21-4.3-4.3" />
	</Svg>
);

export const IconWorkspace = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		<rect x="3" y="4" width="7" height="7" rx="1.5" />
		<rect x="14" y="4" width="7" height="7" rx="1.5" />
		<rect x="3" y="15" width="7" height="5" rx="1.5" />
		<rect x="14" y="15" width="7" height="5" rx="1.5" />
	</Svg>
);

export const IconWeb = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		<circle cx="12" cy="12" r="9" />
		<path d="M3 12h18M12 3a13.5 13.5 0 0 1 0 18M12 3a13.5 13.5 0 0 0 0 18" />
	</Svg>
);

export const IconChevronDown = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		<path d="m6 9 6 6 6-6" />
	</Svg>
);

export const IconSettings = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		<circle cx="12" cy="12" r="3" />
		<path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
	</Svg>
);

export const IconKey = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		<circle cx="7.5" cy="15.5" r="4.5" />
		<path d="m10.7 12.3 8.3-8.3M16 4l4 4M14 6l4 4" />
	</Svg>
);

export const IconTrash = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		<path d="M4 7h16M10 11v6M14 11v6" />
		<path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
	</Svg>
);

export const IconCheck = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		<path d="m4 12.5 5 5L20 6.5" />
	</Svg>
);

export const IconCopy = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		{/* 双矩形错位：「复制」的通用隐喻，与整套线性风格一致。 */}
		<rect x="9" y="9" width="11" height="11" rx="2" />
		<path d="M5 15V6a2 2 0 0 1 2-2h9" />
	</Svg>
);

export const IconEdit = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		<path d="M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16v4z" />
		<path d="m13.5 6.5 4 4" />
	</Svg>
);

export const IconAlert = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		{/* 圆圈 + 叹号：错误卡的唯一红元素，与线性套保持同一视窗与端点风格。 */}
		<circle cx="12" cy="12" r="9" />
		<path d="M12 7.5v6M12 16.8h.01" />
	</Svg>
);

export const IconStop = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		{/* 实心方块：停止是「立即生效」的动作，实心比线框更笃定。 */}
		<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />
	</Svg>
);

export const IconFolder = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		<path d="M4 5a1 1 0 0 1 1-1h4l2 2h8a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
		<path d="M4 9h16" />
	</Svg>
);

export const IconOpenExternal = (p: IconProps): React.JSX.Element => (
<Svg {...p}>
	{/* 方框 + 右上箭头：系统外部打开（浏览器/关联程序）。 */}
	<path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />
	<path d="M14 4h6v6" />
	<path d="M20 4 11 13" />
</Svg>
);

export const IconExpand = (p: IconProps): React.JSX.Element => (
<Svg {...p}>
	{/* 四角外扩箭头：全屏。 */}
	<path d="M8 3H5a2 2 0 0 0-2 2v3" />
	<path d="M16 3h3a2 2 0 0 1 2 2v3" />
	<path d="M8 21H5a2 2 0 0 1-2-2v-3" />
	<path d="M16 21h3a2 2 0 0 0 2-2v-3" />
</Svg>
);

export const IconShrink = (p: IconProps): React.JSX.Element => (
<Svg {...p}>
	{/* 四角内收箭头：退出全屏。 */}
	<path d="M8 3v3a2 2 0 0 1-2 2H3" />
	<path d="M16 3v3a2 2 0 0 0 2 2h3" />
	<path d="M8 21v-3a2 2 0 0 0-2-2H3" />
	<path d="M16 21v-3a2 2 0 0 1 2-2h3" />
</Svg>
);

export const IconExport = (p: IconProps): React.JSX.Element => (
<Svg {...p}>
	{/* 托盘 + 向上出去的箭头：「导出为文件」的通用隐喻（与 IconOpenExternal 的「在外部程序里打开」区分）。 */}
	<path d="M12 15V3M7 8l5-5 5 5" />
	<path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
</Svg>
);
