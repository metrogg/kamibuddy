/**
 * 内联 SVG 图标集。
 *
 * 不引第三方图标库的原因：renderer 跑在严格 CSP 下（main/index.ts installCsp），
 * 内联 SVG 零网络、零字体依赖；且 WorkBuddy 的图标素材我们不能直接拿（AGENTS.md §6），
 * 自己画一套风格相近的线性图标最干净。
 */

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
