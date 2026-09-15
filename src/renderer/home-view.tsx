/**
 * 首页（新建任务页），布局对标 WorkBuddy 首屏：
 * 大标题 → 模式页签 → 能力入口 → 输入卡 → 工作空间/权限 → 最佳实践案例。
 *
 * 文案是独立撰写的（AGENTS.md §6：机制可学，文字必须自己写）。
 * 案例封面用 CSS 渐变 + 内联图标，不引入位图 —— CSP 的 img-src 不放外部源，
 * 远程封面图会被拦掉，渐变方案零依赖也够看。
 */

import { useEffect, useRef, useState } from "react";
import type { ImagePart } from "@shared/image.ts";
import type { ExpertListItem } from "@shared/ipc.ts";
import type { ModeDescriptor, ThinkingLevel } from "@shared/session-events.ts";
import { Composer } from "./composer.tsx";
import type { ComposerHandle } from "./composer.tsx";
import { ExpertChip } from "./expert-chip.tsx";
import { ModelMenu } from "./model-menu.tsx";
import { PermissionMenu } from "./permission-menu.tsx";
import { PlusMenu } from "./plus-menu.tsx";
import { EmptyState, LoadingState } from "./state-views.tsx";
import { WorkspacePicker } from "./workspace-picker.tsx";
import {
	IconChart,
	IconClipboard,
	IconClose,
	IconDoc,
	IconMic,
	IconRefresh,
	IconResearch,
	IconSlide,
	IconUser,
	IconWeb,
	IconWorkspace,
} from "./icons.tsx";

interface HomeViewProps {
	/** daemon 未就绪时输入禁用，避免消息发出去才报错。 */
	readonly ready: boolean;
	/**
	 * 场景轴选项，由 daemon 下发（对标 WorkBuddy 的 welcomemode/{work,code,design}）。
	 * 不在此处硬编码：加场景应当只改 daemon 的资源目录，UI 零改动（AGENTS.md §3）。
	 *
	 * 快照落地前它是空数组（`shared/conversation.ts` 的初值），**不等于「没有场景」** ——
	 * 两者由下面的 `snapshotLanded` 分开（DESIGN.md §4）。
	 */
	readonly scenes: readonly ModeDescriptor[];
	readonly sceneId: string;
	/** 当前模型标识（`provider/model`）。未选时显示「选择模型」。 */
	readonly modelId: string | undefined;
	/**
	 * 当前推理档位与当前模型的可用档位（session_state 直传，与 modelId 同一数据源）。
	 * pristine 桶（首页未建宿主）两者都可能 undefined —— ModelMenu 此时给全量七档入口，
	 * 选档经 daemon 记入 pristine state、建宿主时带入。
	 */
	readonly thinkingLevel?: ThinkingLevel;
	readonly availableThinkingLevels?: readonly ThinkingLevel[];
	/** 当前工作空间目录（session_state.cwd）。undefined 仅是会话尚未建立的初始瞬态。 */
	readonly cwd: string | undefined;
	/** 交互轴选项（「+」菜单的模式子菜单数据源），与对话页头部 ModeSwitch 同源。 */
	readonly interactions: readonly ModeDescriptor[];
	readonly interactionId: string;
	readonly onInteractionChange: (interactionId: string) => void;
	/**
	 * 专家列表与当前专家（「+」菜单的专家子菜单数据源），与对话页同源（App 层统一下发）。
	 * undefined = 还没拉回来（未就绪），与「拉回来但库里是空的」分开 ——
	 * 子菜单据此区分「正在读取专家…」与「还没有可用专家」（DESIGN.md §4）。
	 */
	readonly experts: readonly ExpertListItem[] | undefined;
	readonly expertId: string | undefined;
	/** 取消选中专家传 undefined（与对话页同一 selectExpert 路径）。 */
	readonly onSelectExpert: (expertId: string | undefined) => void;
	/**
	 * 预填文本（创建专家引导语）：App 跳回主页时带入，进输入框后即经
	 * onPrefillConsumed 消费（留在 App state 会重复填充）。
	 */
	readonly prefill?: string;
	readonly onPrefillConsumed: () => void;
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
	/**
	 * 封面图标（体裁语义）：颜色不编码信息（6 组随机 pastel 渐变是全站唯一的
	 * AI slop 特征，已废弃），内容类型改由图标编码，底色统一 --bg-raised。
	 */
	readonly icon: typeof IconDoc;
}

const PRACTICE_CASES: readonly PracticeCase[] = [
	{ title: "一周工作周报速成", prompt: "帮我把本周的工作内容整理成一份结构清晰的周报", icon: IconDoc },
	{ title: "行业调研报告", prompt: "调研一个行业的近况，输出一份带图表的调研报告", icon: IconResearch },
	{ title: "销售数据看板", prompt: "把一份销售数据做成可视化看板，突出同比与环比", icon: IconChart },
	{ title: "发布会幻灯片大纲", prompt: "为一场产品发布会做一份 10 页的幻灯片大纲", icon: IconSlide },
	{ title: "会议纪要整理", prompt: "把会议记录整理成纪要，并提取出待办事项", icon: IconClipboard },
	{ title: "岗位简历诊断", prompt: "分析一份简历，针对目标岗位给出修改建议", icon: IconUser },
];

const PAGE_SIZE = 4;

export function HomeView({
	ready,
	scenes,
	sceneId,
	modelId,
	thinkingLevel,
	availableThinkingLevels,
	cwd,
	interactions,
	interactionId,
	onInteractionChange,
	experts,
	expertId,
	onSelectExpert,
	prefill,
	onPrefillConsumed,
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
	/*
	 * 当前专家 chip 的展示映射：expertId 在列表里找不到（专家库未拉回 / 已删除）就不渲染，
	 * 与对话页 currentExpert 同一口径 —— chip 只做展示，菜单勾选仍以 session_state 为准。
	 * 列表未拉回时 `experts` 是 undefined（不是空数组），这里按「找不到」处理。
	 */
	const currentExpert = expertId === undefined ? undefined : experts?.find((e) => e.name === expertId);
	/*
	 * 快照是否已落地。`cwd` 的 undefined 依契约**只**存在于「会话尚未建立」的初始瞬态
	 * （SessionState 注释），而 `scenes` / `cwd` 由同一次 snapshot dispatch 一起写入，
	 * 不会漂移 —— 所以它比 `scenes.length === 0` 更准确：后者把「还没到」与「确实没有」
	 * 混成一个判断，正是本期要消除的写法（DESIGN.md §4）。
	 */
	const snapshotLanded = cwd !== undefined;
	/*
	 * 预填消费（创建专家：引导语进输入框待编辑发送，WorkBuddy
	 * buildCreateExpertModeBlocks 的 jump home + fill input draft 语义）。
	 * 填入后立即通知 App 清空 —— 留在 App state 里的话，下次回主页会再填一遍。
	 */
	useEffect(() => {
		if (prefill === undefined) return;
		composerRef.current?.fillText(prefill);
		onPrefillConsumed();
	}, [prefill, onPrefillConsumed]);
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
				{/*
				英雄区垂直居中（案例槽预留 220px），案例卡 absolute 钉底部——
				WorkBuddy .wb-home-page 的机制，不是顶对齐流式布局。
			*/}
				<div className="home-main">
					<h1 className="home-title">嘉立创Work，开工吧</h1>

					{/*
						模式页签三态互斥（DESIGN.md §4）：快照落地前 `scenes` 是空数组，
						整行会渲染成**空行** —— 既不是空态也不是加载态。未就绪走加载态，
						快照落地后才判空（真为空是资源目录没装配出场景，不是用户可处置的空，
						故比加载态更需要说出来）。
					*/}
					{!snapshotLanded ? (
						<div className="mode-tabs">
							<LoadingState text="正在读取场景…" />
						</div>
					) : scenes.length === 0 ? (
						/* 空态不进 .mode-tabs：那个容器是固定 36px 高的胶囊，块级空态会被压扁溢出。 */
						<EmptyState title="暂无可用场景" />
					) : (
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
					)}

					<div className="capability-row">
						{CAPABILITIES.map(({ icon: Icon, label }) => (
							<button key={label} type="button" className="capability-chip" onClick={() => onTodo(label)}>
								<Icon size={16} />
								{label}
							</button>
						))}
					</div>

					<div className="composer-zone">
						{/*
						渐变槽（composer-slot）是首页专属：白卡 + 工作空间/权限 chips 都
						坐在上面（WorkBuddy input-slot 机制），对话页输入卡没有槽。
					*/}
						<div className="composer-slot">
							{/*
						输入卡机制（拖放/附件/IME/补全/字数闸）全部在 Composer 内部，
						与对话页同一份实现 —— 此前两份手写重复，「+」菜单漏改即实例。
						首页语义差异：不开输入历史、不开草稿持久（发送即跳对话页），
						故不传 draftKey / enableHistory / streaming。
					*/}
							<Composer
								ref={composerRef}
								ready={ready}
								placeholder={ready ? "今天想做点什么？@ 引用文件，/ 调用技能与指令…" : "正在准备…"}
								rows={3}
								cwd={cwd}
								modelId={modelId}
								onSubmit={onSubmit}
								onError={onError}
								trailing={
									<>
										{/* 右组：模型 chip / 麦克风（WorkBuddy 首页底行「左 + 右 模型·麦克风·发送」）。 */}
										<ModelMenu
											modelId={modelId}
											thinkingLevel={thinkingLevel}
											availableThinkingLevels={availableThinkingLevels}
											onOpenSettings={onOpenSettings}
											onError={onError}
										/>
										<button type="button" className="bar-btn" aria-label="语音输入" onClick={() => onTodo("语音输入")}>
											<IconMic size={16} />
										</button>
									</>
								}
							>
								{/*
							「+」菜单与对话页同一个 PlusMenu：添加文件（经 composerRef 触发
							Composer 内部的附件选择框）+ 模式/专家子菜单 + 技能/连接器占位。
						*/}
								<PlusMenu
									modes={interactions}
									currentId={interactionId}
									onInteractionChange={onInteractionChange}
									experts={experts}
									expertId={expertId}
									onSelectExpert={onSelectExpert}
									onPickFiles={() => void composerRef.current?.pickFiles()}
									onTodo={onTodo}
								/>
								{/*
							当前专家 chip：与「+」按钮同一行、紧随其后（WorkBuddy 底栏
							同位置），选中专家后首页即可见。列表里找不到时不渲染 —— 见
							currentExpert 的展示映射口径。
						*/}
								{currentExpert !== undefined && (
									<ExpertChip expert={currentExpert} onClear={() => onSelectExpert(undefined)} />
								)}
							</Composer>
							{/* 工作空间/权限 chips：WorkBuddy wb-input-footer 同位置（白卡正下方、槽内）。 */}
							<div className="context-row">
								<WorkspacePicker cwd={cwd} onChanged={onWorkspaceChanged} />
								{/* 权限预设就地快切；两个独立旋钮与完整说明在设置页（菜单底部有入口）。 */}
								<PermissionMenu onOpenSettings={onOpenSettings} onError={onError} />
							</div>
						</div>
					</div>
				</div>

				{casesVisible && (
					<section className="cases">
						<header className="cases-header">
							<span>不知道做什么，试试这些</span>
							<button type="button" className="cases-action" onClick={() => setCaseOffset((o) => o + PAGE_SIZE)}>
								<IconRefresh size={14} />
								换一批
							</button>
							<button type="button" className="cases-action" aria-label="关闭" onClick={() => setCasesVisible(false)}>
								<IconClose size={14} />
							</button>
						</header>
						<div className="case-grid">
							{visibleCases.map((c) => (
								<button key={c.title} type="button" className="case-card" onClick={() => composerRef.current?.setText(c.prompt)}>
									<span className="case-cover"><c.icon size={28} /></span>
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
