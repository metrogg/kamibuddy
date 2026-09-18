/**
 * 内联 SVG 图标集。
 *
 * 不引第三方图标库的原因：renderer 跑在严格 CSP 下（main/index.ts installCsp），
 * 内联 SVG 零网络、零字体依赖。
 *
 * 【2026-09-18 订正】此处原写「WorkBuddy 的图标素材我们不能直接拿（AGENTS.md §6）」——
 * **与 §6 相反**：§6 明写「内部使用阶段允许直接搬用 WorkBuddy 资产……正式上线前由专人
 * 做风险置换」。所以搬用是允许的；本文件里移植的字形都逐条标注了出处与原始视窗。
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

export const IconArrowRight = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		{/* IconBack 的水平镜像：「前进/下一题」语义（问卷浮层 footer）。 */}
		<path d="M5 12h14M12 5l7 7-7 7" />
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

/**
 * 任务诊断入口：活动脉冲（心电图）。
 *
 * 不复用 IconChart —— 那是侧栏「统计」入口的图标，两处同名会让「统计」与
 * 「这个任务的诊断」在视觉上分不开。语义上诊断看的是「这一轮跑得顺不顺」，
 * 脉冲比柱状图贴切。
 */
export const IconActivity = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		<path d="M2 12h4l3-7 4 14 3-7h6" />
	</Svg>
);

/** 统计页入口：四格网格（沿用 WorkBuddy 用量热力图的方格语义）。 */
export const IconStats = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		<rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
		<rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
		<rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
		<rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
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

export const IconGraduationCap = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		{/* 学士帽：「我的专家」空态图标（自创专家 = 传授知识）。 */}
		<path d="m12 4 10 5-10 5L2 9z" />
		<path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" />
		<path d="M22 9v5" />
	</Svg>
);

export const IconUser = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		{/* 人头 + 肩：「我的」语义（我的专家入口）。 */}
		<circle cx="12" cy="8" r="4" />
		<path d="M4 21c0-3.5 3.6-6 8-6s8 2.5 8 6" />
	</Svg>
);

export const IconChevronLeft = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		<path d="m15 18-6-6 6-6" />
	</Svg>
);

export const IconChevronRight = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		<path d="m9 18 6-6-6-6" />
	</Svg>
);

export const IconMinus = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		<path d="M5 12h14" />
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

export const IconCode = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		{/* 双尖括号：代码文件的通用隐喻（</> 去斜杠，线性套里斜杠易与路径混淆）。 */}
		<path d="m8 6-6 6 6 6M16 6l6 6-6 6" />
	</Svg>
);

export const IconBranch = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		{/* 两节点一汇流的线性分叉：git 分支的通用隐喻（不用 git logo —— 那是外部品牌）。 */}
		<circle cx="7" cy="5" r="2" />
		<circle cx="7" cy="19" r="2" />
		<circle cx="17" cy="9" r="2" />
		<path d="M7 7v10" />
		<path d="M17 11c0 3.5-3 4.5-6.5 4.5" />
	</Svg>
);

export const IconImage = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		{/* 相框 + 太阳 + 山脊：位图/矢量图共用。 */}
		<rect x="3" y="4" width="18" height="16" rx="2" />
		<circle cx="9" cy="9.5" r="1.6" />
		<path d="m21 16-4.8-4.8L7 20" />
	</Svg>
);

export const IconMedia = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		{/* 圆内播放三角：音/视频不细分（预览面板对二者同样走外部打开）。 */}
		<circle cx="12" cy="12" r="9" />
		<path d="M10 8.5v7l6-3.5z" />
	</Svg>
);

export const IconFile = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		{/* 纯文档轮廓（无文字行）：未知类型的兜底，与 IconDoc（已知文本类）区分。 */}
		<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
		<path d="M14 3v5h5" />
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

export const IconDownload = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		{/* 托盘 + 向下落入的箭头：「下载到本地」（与 IconExport 的向上导出方向相反）。 */}
		<path d="M12 3v12M7 10l5 5 5-5" />
		<path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
	</Svg>
);

/* ── 工具类型图标（tool-icon-registry 用） ───────────────────────── */

export const IconEye = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		{/* 眼轮廓 + 瞳：读取/预览/交付类工具（「看见内容」）。 */}
		<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
		<circle cx="12" cy="12" r="3" />
	</Svg>
);

export const IconTerminal = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		{/* 提示符 >_ ：命令执行类工具。与 IconCode（</>，代码文件）分工：终端是会话。 */}
		<path d="m4 17 6-6-6-6M12 19h8" />
	</Svg>
);

export const IconClipboard = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		{/* 夹板 + 横线：计划/待办/定时任务类工具。 */}
		<rect x="5" y="5" width="14" height="16" rx="2" />
		<path d="M9 5V4a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 4v1M9 11h6M9 15h4" />
	</Svg>
);

export const IconDatabase = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		{/* 圆柱体：数据库服务的通用隐喻。 */}
		<ellipse cx="12" cy="5.5" rx="7.5" ry="2.5" />
		<path d="M4.5 5.5v13c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-13" />
		<path d="M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5" />
	</Svg>
);

export const IconCloud = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		<path d="M18 10h-1.3A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
	</Svg>
);

export const IconDebug = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		{/* 甲虫：调试类工具（bug 的双关）。 */}
		<rect x="8" y="7" width="8" height="12" rx="4" />
		<path d="M9 7a3 3 0 0 1 6 0M4 13h4M16 13h4M6 6l2.5 2.5M18 6l-2.5 2.5M6 20l2.5-2.5M18 20l-2.5-2.5" />
	</Svg>
);

export const IconLocation = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		{/* 地图钉：位置/POI 查询类工具。 */}
		<path d="M12 21s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11z" />
		<circle cx="12" cy="10" r="2.5" />
	</Svg>
);

export const IconWrench = (p: IconProps): React.JSX.Element => (
	<Svg {...p}>
		{/* 扳手：未识别工具与 MCP 工具的兜底（「反正是某种工具」）。 */}
		<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-8 8l-6.9 7a2.1 2.1 0 0 1-3-3l7-7a6 6 0 0 1 7.9-8l-3.8 3.8z" />
	</Svg>
);

/**
 * 权限盾形图标（成对）：**实心字形**，逐字移植自 WorkBuddy 的原字形
 * —— `ShieldSecuredIcon` / `ShieldDangerIcon`，出处
 * `docs/WorkBuddy-reference/extracted/renderer/assets/ui-docs-viewer-C2jT2eXi.js:289534-289561`。
 *
 * 破了本文件「24 视窗 + stroke 1.8 线性」的约定，理由：
 *   1. 这两个是 WB 权限按钮**成对切换**的状态字形（受保护盾带勾 / 危险盾带感叹号），
 *      实心才读得出「当前是哪一档」；改画成线性就丢掉了那个对比，移植也就没意义了；
 *   2. WB 的组件把「图标字形」与「危险态配色」绑在同一个 `isFullAccess` 分支里
 *      （同文件 :289620 与 :289607），照搬字形才配得上那一档的语义。
 * 视窗沿用各自的原始值（17 / 16），`d` 与 `transform` 逐字保留，不做重绘 ——
 * 重绘过的形状就不再是「对齐 WB」而是「我觉得像」。
 * 搬用依据：AGENTS.md §6（内部使用阶段允许直接搬用 WorkBuddy 资产）。
 */
function SvgFilled({
	size = 16,
	className,
	viewBox,
	children,
}: IconProps & { readonly viewBox: string; readonly children: React.ReactNode }): React.JSX.Element {
	return (
		<svg
			width={size}
			height={size}
			viewBox={viewBox}
			fill="none"
			className={className}
			aria-hidden="true"
		>
			{children}
		</svg>
	);
}

/** 受保护盾（带勾）：只读 / 默认权限两档共用的字形。 */
export const IconShieldSecured = (p: IconProps): React.JSX.Element => (
	<SvgFilled {...p} viewBox="0 0 17 17">
		<path
			fill="currentColor"
			fillRule="evenodd"
			transform="matrix(1 0 0 1 1.48734 0.602844)"
			d="M7.0124 0C7.9669 0 9.2318 0.3672 10.3639 0.8353C11.5007 1.3054 12.6247 1.9276 13.2826 2.5172C14.0636 3.2173 14.0245 4.1714 14.0245 4.7854L14.0245 8.9597C14.0243 12.923 10.4538 15.4415 7.0124 15.4416C5.7716 15.4414 4.0449 14.7875 2.64 13.7078C1.2257 12.6207 0.0005 10.9927 0.0003 8.9597L0.0003 4.7854C0.0003 4.1715 -0.0384 3.2172 0.7422 2.5172C0.8962 2.3792 1.0763 2.2393 1.2755 2.1001L1.2755 4.7325C1.2755 4.7498 1.2745 4.7676 1.2745 4.7854L1.2745 8.9597C1.2746 10.4471 2.1744 11.7426 3.4161 12.6971C4.667 13.6586 6.1283 14.1662 7.0124 14.1663L7.2874 14.1601C10.1186 14.0321 12.7501 11.9412 12.7503 8.9597L12.7503 4.7854C12.7503 4.0588 12.7235 3.7281 12.4317 3.4666C11.9301 3.017 10.959 2.4614 9.8772 2.014C8.7907 1.5647 7.7127 1.2742 7.0124 1.2742C6.312 1.2743 5.234 1.5647 4.1476 2.014C3.5637 2.2555 3.0127 2.5296 2.5497 2.8005L2.5497 1.3478C2.9077 1.165 3.2835 0.9914 3.6609 0.8353C4.7929 0.3672 6.0579 0.0001 7.0124 0ZM10.6502 5.6912L7.1525 9.19C6.9882 9.3543 6.8197 9.5239 6.6617 9.6445C6.489 9.7762 6.2552 9.908 5.9499 9.908C5.6446 9.9079 5.4108 9.7762 5.2381 9.6445C5.0801 9.5239 4.9116 9.3543 4.7473 9.19L3.3746 7.8162L4.2752 6.9156L5.649 8.2883C5.7391 8.3785 5.8114 8.4507 5.8742 8.5104C5.9026 8.5374 5.9288 8.5581 5.9499 8.5768C5.971 8.5581 5.9972 8.5374 6.0256 8.5104C6.0884 8.4507 6.1607 8.3785 6.2508 8.2883L9.7495 4.7906L10.6502 5.6912Z"
		/>
	</SvgFilled>
);

/** 危险盾（带感叹号）：仅「允许完全访问」档。字形与红字同属一个 isFullAccess 分支。 */
export const IconShieldDanger = (p: IconProps): React.JSX.Element => (
	<SvgFilled {...p} viewBox="0 0 16 16">
		<path
			fill="currentColor"
			fillRule="evenodd"
			transform="matrix(1 0 0 1 1.39631 0.567376)"
			d="M6.6037 0C7.502 0 8.6925 0.3456 9.758 0.7861C10.8279 1.2286 11.8858 1.8142 12.505 2.3691C13.2074 2.9987 13.2051 3.8466 13.2035 4.4249C13.2034 4.4518 13.2033 4.4782 13.2033 4.5039L13.2033 8.4326C13.2031 12.1628 9.8426 14.5332 6.6037 14.5332C5.4358 14.5331 3.8108 13.9176 2.4884 12.9014C1.1574 11.8783 0.0042 10.3461 0.0041 8.4326L0.0041 4.5039C0.0041 4.4784 0.004 4.4524 0.0039 4.4257C0.0023 3.8475 0 2.9989 0.7023 2.3691C0.8472 2.2392 1.0167 2.1076 1.2043 1.9766L1.2043 4.4541C1.2042 4.462 1.204 4.47 1.2038 4.4781C1.2035 4.4867 1.2033 4.4953 1.2033 4.5039L1.2033 8.4326C1.2034 9.8325 2.0502 11.0518 3.2189 11.9502C4.3962 12.8551 5.7716 13.3329 6.6037 13.333L6.8625 13.3271C9.5271 13.2067 12.0038 11.2388 12.004 8.4326L12.004 4.5039C12.004 3.8201 11.9788 3.5088 11.7042 3.2627C11.2321 2.8395 10.3181 2.3166 9.2999 1.8955C8.2774 1.4726 7.2628 1.1992 6.6037 1.1992C5.9445 1.1993 4.9298 1.4727 3.9074 1.8955C3.3578 2.1228 2.8392 2.3808 2.4035 2.6357L2.4035 1.2686C2.7405 1.0964 3.0941 0.9331 3.4494 0.7861C4.5148 0.3456 5.7053 0.0001 6.6037 0ZM7.2022 8.9326L7.2022 3.4326L6.0022 3.4326L6.0022 8.9326L7.2022 8.9326ZM6.0022 11.4325L6.0022 10.2325L7.2022 10.2325L7.2022 11.4325L6.0022 11.4325Z"
		/>
	</SvgFilled>
);

/**
 * 应用品牌徽标：彩色渐变圆角方块 + 白色星形（对标 WorkBuddy 侧栏底部的彩色标识）。
 *
 * 整套图标唯一的填充/渐变式——它承担「品牌标识」而不是「操作提示」，
 * 用 currentColor 线性风格画不出「彩色」，所以单开一档；其余图标不跟。
 * 渐变 id 全局唯一，本图标在应用里只渲染一处（侧栏底部）。
 */
export const IconBrand = ({ size = 22, className }: IconProps): React.JSX.Element => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		className={className}
		aria-hidden="true"
	>
		<defs>
			<linearGradient id="kami-brand-mark" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0%" stopColor="#3ecf8e" />
				<stop offset="100%" stopColor="#0ea5a4" />
			</linearGradient>
		</defs>
		<rect x="1" y="1" width="22" height="22" rx="7" fill="url(#kami-brand-mark)" />
		<path
			d="M12 6.4l1.5 3.6 3.6 1.5-3.6 1.5L12 16.6l-1.5-3.6L6.9 11.5l3.6-1.5z"
			fill="#ffffff"
		/>
	</svg>
);
