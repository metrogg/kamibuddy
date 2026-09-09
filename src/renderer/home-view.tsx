/**
 * 首页（新建任务页），布局对标 WorkBuddy 首屏：
 * 大标题 → 模式页签 → 能力入口 → 输入卡 → 工作空间/权限 → 最佳实践案例。
 *
 * 文案是独立撰写的（AGENTS.md §6：机制可学，文字必须自己写）。
 * 案例封面用 CSS 渐变 + 内联图标，不引入位图 —— CSP 的 img-src 不放外部源，
 * 远程封面图会被拦掉，渐变方案零依赖也够看。
 */

import { useRef, useState } from "react";
import type { ImagePart } from "@shared/image.ts";
import type { ModeDescriptor } from "@shared/session-events.ts";
import { Composer } from "./composer.tsx";
import type { ComposerHandle } from "./composer.tsx";
import { ModelMenu } from "./model-menu.tsx";
import { PermissionMenu } from "./permission-menu.tsx";
import { PlusMenu } from "./plus-menu.tsx";
import { WorkspacePicker } from "./workspace-picker.tsx";
import {
	IconChart,
	IconClose,
	IconDoc,
	IconMic,
	IconRefresh,
	IconResearch,
	IconSlide,
	IconWeb,
	IconWorkspace,
} from "./icons.tsx";

interface HomeViewProps {
	/** daemon 未就绪时输入禁用，避免消息发出去才报错。 */
	readonly ready: boolean;
	/**
	 * 场景轴选项，由 daemon 下发（对标 WorkBuddy 的 welcomemode/{work,code,design}）。
	 * 不在此处硬编码：加场景应当只改 daemon 的资源目录，UI 零改动（AGENTS.md §3）。
	 */
	readonly scenes: readonly ModeDescriptor[];
	readonly sceneId: string;
	/** 当前模型标识（`provider/model`）。未选时显示「选择模型」。 */
	readonly modelId: string | undefined;
	/** 当前工作空间目录（session_state.cwd）。undefined 仅是会话尚未建立的初始瞬态。 */
	readonly cwd: string | undefined;
	/** 交互轴选项（「+」菜单的模式子菜单数据源），与对话页头部 ModeSwitch 同源。 */
	readonly interactions: readonly ModeDescriptor[];
	readonly interactionId: string;
	readonly onInteractionChange: (interactionId: string) => void;
	readonly onSceneChange: (sceneId: string) => void;
	readonly onOpenSettings: () => void;
	/** 主页就地操作（切模型等）失败时的提示出口。 */
	readonly onError: (message: string) => void;
	/**
	 * 提交（文本 + 可选图片附件）。resolve 表示 daemon 已接收；
	 * 附件据此决定去留（失败保留在输入区，见 submit）。
	 */
	readonly onSubmit: (text: string, images?: readonly ImagePart[]) => Promise<void>;
	/** 工作空间切换成功后调用：daemon 已重置会话，App 重拉快照。 */
	readonly onWorkspaceChanged: () => void;
	readonly onTodo: (feature: string) => void;
}

/* ── 能力入口 ────────────────────────────────────────────────────── */

const CAPABILITIES = [
	{ icon: IconDoc, label: "文档处理" },
	{ icon: IconChart, label: "数据分析可视化" },
	{ icon: IconSlide, label: "幻灯片" },
	{ icon: IconResearch, label: "深度研究" },
	{ icon: IconWeb, label: "网页开发" },
	{ icon: IconWorkspace, label: "个人工作台" },
] as const;

/* ── 案例卡片 ────────────────────────────────────────────────────── */

interface PracticeCase {
	readonly title: string;
	readonly prompt: string;
	/** 封面渐变，对应 CSS 类 case-cover-N。 */
	readonly cover: number;
}

const PRACTICE_CASES: readonly PracticeCase[] = [
	{ title: "一周工作周报速成", prompt: "帮我把本周的工作内容整理成一份结构清晰的周报", cover: 0 },
	{ title: "行业调研报告", prompt: "调研一个行业的近况，输出一份带图表的调研报告", cover: 1 },
	{ title: "销售数据看板", prompt: "把一份销售数据做成可视化看板，突出同比与环比", cover: 2 },
	{ title: "发布会幻灯片大纲", prompt: "为一场产品发布会做一份 10 页的幻灯片大纲", cover: 3 },
	{ title: "会议纪要整理", prompt: "把会议记录整理成纪要，并提取出待办事项", cover: 4 },
	{ title: "岗位简历诊断", prompt: "分析一份简历，针对目标岗位给出修改建议", cover: 5 },
];

const PAGE_SIZE = 4;

/** 首页右侧的吉祥物。原创 SVG（WorkBuddy 的机器人形象不能拿，§6）。 */
function Mascot(): React.JSX.Element {
	return (
		<svg className="mascot" viewBox="0 0 96 96" fill="none" aria-hidden="true">
			<rect x="20" y="26" width="56" height="48" rx="16" fill="#23262b" />
			<rect x="30" y="40" width="12" height="14" rx="6" fill="#7ef0c4" />
			<rect x="54" y="40" width="12" height="14" rx="6" fill="#7ef0c4" />
			<path d="M40 62h16" stroke="#7ef0c4" strokeWidth="3" strokeLinecap="round" />
			<path d="M48 26v-8" stroke="#23262b" strokeWidth="4" strokeLinecap="round" />
			<circle cx="48" cy="14" r="4" fill="#7ef0c4" />
			<rect x="10" y="40" width="8" height="18" rx="4" fill="#23262b" />
			<rect x="78" y="40" width="8" height="18" rx="4" fill="#23262b" />
		</svg>
	);
}

export function HomeView({
	ready,
	scenes,
	sceneId,
	modelId,
	cwd,
	interactions,
	interactionId,
	onInteractionChange,
	onSceneChange,
	onOpenSettings,
	onError,
	onSubmit,
	onWorkspaceChanged,
	onTodo,
}: HomeViewProps): React.JSX.Element {
	// 「+」菜单的「添加文件」要打开 Composer 内部附件状态的选择框（命令式动作，经 ref 句柄触发）；
	// 案例卡片点击填充提示词也经句柄（setText）—— 草稿状态已内化进 Composer。
	const composerRef = useRef<ComposerHandle>(null);
	/** 案例分页起点。「换一批」整体平移一页，实现简单且不会重复抽到刚看过的。 */
	const [caseOffset, setCaseOffset] = useState(0);
	const [casesVisible, setCasesVisible] = useState(true);

	const visibleCases = Array.from(
		{ length: Math.min(PAGE_SIZE, PRACTICE_CASES.length) },
		(_, i) => PRACTICE_CASES[(caseOffset + i) % PRACTICE_CASES.length],
		// noUncheckedIndexedAccess 下取模索引仍返回 T|undefined，filter 收窄。
	).filter((c): c is PracticeCase => c !== undefined);

	return (
		<main className="home">
			<div className="home-inner">
				<h1 className="home-title">KamiBuddy，开工吧</h1>

				<div className="mode-tabs">
					{scenes.map((scene) => (
						<button
							key={scene.id}
							type="button"
							className={`mode-tab${scene.id === sceneId ? " active" : ""}`}
							title={scene.description}
							// 未实现的场景仍然显示（对齐 WorkBuddy 的能力面），
							// 点击给明确反馈而不是静默切过去。
							onClick={() => (scene.ready ? onSceneChange(scene.id) : onTodo(`「${scene.label}」场景`))}
						>
							{scene.label}
						</button>
					))}
				</div>

				<div className="capability-row">
					{CAPABILITIES.map(({ icon: Icon, label }) => (
						<button key={label} type="button" className="capability-chip" onClick={() => onTodo(label)}>
							<Icon size={15} />
							{label}
						</button>
					))}
				</div>

				<div className="composer-zone">
					{/*
					输入卡机制（拖放/附件/IME/补全/字数闸）全部在 Composer 内部，
					与对话页同一份实现 —— 此前两份手写重复，「+」菜单漏改即实例。
					首页语义差异：不开输入历史、不开草稿持久（发送即跳对话页），
					故不传 draftKey / enableHistory / streaming。
				*/}
					<Composer
						ref={composerRef}
						ready={ready}
						placeholder={ready ? "今天想做点什么？@ 引用文件，/ 调用技能与指令" : "引擎启动中…"}
						rows={3}
						cwd={cwd}
						modelId={modelId}
						onSubmit={onSubmit}
						onError={onError}
					>
						{/*
						「+」菜单与对话页同一个 PlusMenu：添加文件（经 composerRef 触发
						Composer 内部的附件选择框）+ 模式子菜单 + 专家/技能/连接器占位。
					*/}
						<PlusMenu
							modes={interactions}
							currentId={interactionId}
							onInteractionChange={onInteractionChange}
							onPickFiles={() => void composerRef.current?.pickFiles()}
							onTodo={onTodo}
						/>
						{/* 就地快捷切换；管理与填 Key 在设置页（菜单底部有入口）。 */}
						<ModelMenu modelId={modelId} onOpenSettings={onOpenSettings} onError={onError} />
						<button type="button" className="bar-btn" aria-label="语音输入" onClick={() => onTodo("语音输入")}>
							<IconMic size={16} />
						</button>
					</Composer>
					<Mascot />
				</div>

				<div className="context-row">
					<WorkspacePicker cwd={cwd} onChanged={onWorkspaceChanged} />
					{/* 权限预设就地快切；两个独立旋钮与完整说明在设置页（菜单底部有入口）。 */}
					<PermissionMenu onOpenSettings={onOpenSettings} onError={onError} />
				</div>

				{casesVisible && (
					<section className="cases">
						<header className="cases-header">
							<span>不知道做什么，试试这些</span>
							<button type="button" className="cases-action" onClick={() => setCaseOffset((o) => o + PAGE_SIZE)}>
								<IconRefresh size={13} />
								换一批
							</button>
							<button type="button" className="cases-action" aria-label="关闭" onClick={() => setCasesVisible(false)}>
								<IconClose size={14} />
							</button>
						</header>
						<div className="case-grid">
							{visibleCases.map((c) => (
								<button key={c.title} type="button" className="case-card" onClick={() => composerRef.current?.setText(c.prompt)}>
									<span className={`case-cover case-cover-${c.cover}`} />
									<span className="case-title">{c.title}</span>
								</button>
							))}
						</div>
					</section>
				)}
			</div>
		</main>
	);
}
