/**
 * 首页（新建任务页），布局对标 WorkBuddy 首屏：
 * 大标题 → 模式页签 → 能力胶囊 → 输入卡 → 工作空间/权限 → 最佳实践案例。
 *
 * 能力胶囊与案例卡片**不在本文件里写死**：数据在 `resources/welcome/{chips,cases}.json`，
 * daemon 读盘后随快照下发（AGENTS.md §3：加一个胶囊/案例只改数据）。
 * 素材照搬自 WorkBuddy（其公开 CDN 的 playbook 与场景接口），来源与置换说明见
 * `resources/welcome/README.md`；封面图直接引它的 CDN 地址（CSP 的 img-src 已放行
 * https:），加载失败回落图标底 —— WorkBuddy 自己也是「回源失败走占位图」。
 */

import { useEffect, useRef, useState } from "react";
import type { ImagePart } from "@shared/image.ts";
import type { ExpertListItem } from "@shared/ipc.ts";
import type { ModeDescriptor, ThinkingLevel } from "@shared/session-events.ts";
import type { WelcomeChip, WelcomePresets } from "@shared/welcome.ts";
import { Composer } from "./composer.tsx";
import type { ComposerHandle } from "./composer.tsx";
import { ExpertChip } from "./expert-chip.tsx";
import { casesForChip, casesForScene, chipsForScene, itemsForChip, page } from "./home-presets.ts";
import { ModelMenu } from "./model-menu.tsx";
import { ModeChip } from "./mode-chip.tsx";
import { PermissionMenu } from "./permission-menu.tsx";
import { PlusMenu } from "./plus-menu.tsx";
import { EmptyState, LoadingState } from "./state-views.tsx";
import { WorkspacePicker } from "./workspace-picker.tsx";
import { WorktreeChip } from "./worktree-chip.tsx";
import {
	IconChart,
	IconClose,
	IconCode,
	IconDoc,
	IconRefresh,
	IconResearch,
	IconSlide,
	IconTerminal,
	IconWeb,
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
	/**
	 * 首页预设（能力胶囊 + 最佳实践案例），daemon 随快照下发（数据源见
	 * `resources/welcome/README.md`）。undefined = 这份快照没带（事件流拼出的桶种子），
	 * 按「没有预设」处理：两块都不渲染，而不是渲染空壳。
	 */
	readonly welcome?: WelcomePresets;
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
	/** 交互轴选项（「+」菜单的模式子菜单与模式 chip 的数据源），与对话页同源。 */
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
	/** 「+」菜单的「技能」入口：跳技能页技能页签（缺省回落 onTodo 占位，见 plus-menu）。 */
	readonly onOpenSkills?: () => void;
	/** 「+」菜单的「连接器」入口：跳技能页连接器页签。 */
	readonly onOpenConnectors?: () => void;
	readonly onTodo: (feature: string) => void;
}

/* ── 能力胶囊 / 最佳实践案例 ──────────────────────────────────────── */

/**
 * 图标键 → 组件。数据里只放键（chips.json 的 `icon`），组件映射留在渲染层 ——
 * 「能力是数据，代码只负责读取」的分工。未知键回落 IconDoc：数据写错由
 * core/resources.ts 的加载校验拦（那里才认识合法键），这里只保证渲染不崩。
 */
const CHIP_ICONS: Readonly<Record<string, typeof IconDoc>> = {
	doc: IconDoc,
	chart: IconChart,
	slide: IconSlide,
	research: IconResearch,
	code: IconCode,
	web: IconWeb,
	terminal: IconTerminal,
};

/** 案例卡一屏四张（WorkBuddy 首页 4 列）。 */
const PAGE_SIZE = 4;

/**
 * 案例封面：远程图 + 图标底兜底。
 *
 * 为什么不做本地缓存：WorkBuddy 为它单独写了主进程 `wb-cover://` 协议（COS 响应
 * 不带 Cache-Control，断网必裂图）。我们先用最简单的一层 —— 失败回落图标底，
 * 断网时看到的是图标而不是裂图；真要离线可用再照它的方案做缓存。
 */
function CaseCover({
	cover,
	icon: Icon,
}: {
	readonly cover: string;
	readonly icon: typeof IconDoc;
}): React.JSX.Element {
	const [failed, setFailed] = useState(false);
	return (
		<span className="case-cover">
			{failed ? (
				<span className="case-cover-fallback">
					<Icon size={28} />
				</span>
			) : (
				<img src={cover} alt="" loading="lazy" onError={() => setFailed(true)} />
			)}
		</span>
	);
}

export function HomeView({
	ready,
	scenes,
	sceneId,
	welcome,
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
	onOpenSkills,
	onOpenConnectors,
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
	/**
	 * 选中的能力胶囊（同时是卡片筛选条件）+ 下钻面板开合。
	 *
	 * WorkBuddy 的胶囊是一物两用：点它既展开它名下的提示词列表，又用它筛下方案例
	 * （`case.scenario === 胶囊名`）。这里保持同一语义 —— 两个状态分开是因为
	 * 「从面板里选了一条提示词」之后要收起面板，但筛选要留着。
	 */
	const [activeChipId, setActiveChipId] = useState<string | undefined>(undefined);
	const [chipPanelOpen, setChipPanelOpen] = useState(false);

	const chips = welcome === undefined ? [] : chipsForScene(welcome.chips, sceneId);
	const chipById = new Map(chips.map((chip) => [chip.id, chip]));
	// 案例跟着它所属的胶囊走：代码场景没有案例，整块不渲染（而不是显示办公场景的案例）。
	const sceneCases = casesForScene(welcome?.cases ?? [], chips);
	const shownCases = casesForChip(sceneCases, activeChipId);
	const visibleCases = page(shownCases, caseOffset, PAGE_SIZE);
	const activeChip = chips.find((chip) => chip.id === activeChipId);
	const chipItems = activeChip === undefined ? [] : itemsForChip(activeChip, sceneCases);
	/** 卡片的图标底取自它所属胶囊（远程封面加载失败时显示它）。 */
	const iconForCase = (chipId: string): typeof IconDoc =>
		CHIP_ICONS[chipById.get(chipId)?.icon ?? ""] ?? IconDoc;

	// 切场景 = 换一横条胶囊：选中态与分页都作废（留着会指向别的场景的胶囊）。
	useEffect(() => {
		setActiveChipId(undefined);
		setChipPanelOpen(false);
		setCaseOffset(0);
	}, [sceneId]);

	// Esc 关闭胶囊面板：面板没有键盘焦点管理，Esc 是键盘用户唯一的关闭路径
	// （与 backdrop 互补，同 permission-menu 约定）。
	useEffect(() => {
		if (!chipPanelOpen) return;
		const onKey = (event: KeyboardEvent): void => {
			if (event.key === "Escape") setChipPanelOpen(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [chipPanelOpen]);

	/** 点胶囊：同一个再点一次 = 取消选择并收起；换一个 = 选中并展开该胶囊的提示词。 */
	const toggleChip = (chip: WelcomeChip): void => {
		if (chip.id === activeChipId) {
			setActiveChipId(undefined);
			setChipPanelOpen(false);
			return;
		}
		setActiveChipId(chip.id);
		setChipPanelOpen(true);
		// 换了筛选条件，分页回到第一页（否则停在越界偏移上会看到同一批）。
		setCaseOffset(0);
	};

	/** 从面板里选一条：填进输入框待编辑（不直接发送），筛选保持。 */
	const pickChipItem = (prompt: string): void => {
		composerRef.current?.setText(prompt);
		setChipPanelOpen(false);
	};

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

					{chips.length > 0 && (
						<div className="capability-zone">
							<div className="capability-row">
								{chips.map((chip) => {
									const Icon = CHIP_ICONS[chip.icon] ?? IconDoc;
									const active = chip.id === activeChipId;
									return (
										<button
											key={chip.id}
											type="button"
											className={`capability-chip${active ? " active" : ""}`}
											title={chip.description}
											aria-haspopup="menu"
											aria-expanded={active && chipPanelOpen}
											onClick={() => toggleChip(chip)}
										>
											<Icon size={16} />
											{chip.label}
										</button>
									);
								})}
							</div>

							{chipPanelOpen && activeChip !== undefined && (
								<>
									{/* 透明 backdrop：点面板外任意处关闭，与同区其它弹层一致。 */}
									<button
										type="button"
										className="ws-backdrop"
										aria-label="关闭"
										onClick={() => setChipPanelOpen(false)}
									/>
									<div className="pop-menu chip-panel" role="menu">
										{chipItems.map((item) => (
											<button
												key={item.key}
												type="button"
												className="chip-panel-item"
												role="menuitem"
												/* 提示词很长，列表只给一行；原文挂 title 备查。 */
												title={item.prompt}
												onClick={() => pickChipItem(item.prompt)}
											>
												{item.title ?? item.prompt}
											</button>
										))}
									</div>
								</>
							)}
						</div>
					)}

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
									onOpenSkills={onOpenSkills}
									onOpenConnectors={onOpenConnectors}
									onTodo={onTodo}
								/>
								{/*
							当前模式 chip：与对话页同款同位置（「+」按钮之后、专家 chip 之前）。
							首页也能经「+ → 模式」换档，换了就得看得见 —— 否则用户带着
							只在问答模式发出去的第一条消息进对话页，才发现工具被限制了。
						*/}
								<ModeChip
									interactions={interactions}
									currentId={interactionId}
									onChange={onInteractionChange}
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
								{/*
									worktree 副本开关：代码场景 + 已选工作目录时出现 ——
									与 WorkBuddy 的门控逐条对齐（`sceneMode === "code" && cwd`，
									见对齐清单 L27）。组件内部再判一次「cwd 是不是 git 仓库」，
									不是则整块不渲染。
								*/}
								{sceneId === "code" && cwd !== undefined && cwd !== "" && (
									<WorktreeChip cwd={cwd} />
								)}
								{/* 权限预设就地快切；两个独立旋钮与完整说明在设置页（菜单底部有入口）。 */}
								<PermissionMenu onOpenSettings={onOpenSettings} onError={onError} />
							</div>
						</div>
					</div>
				</div>

				{casesVisible && visibleCases.length > 0 && (
					<section className="cases">
						<header className="cases-header">
							<span>不知道做什么，试试最佳实践案例</span>
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
								<button key={c.id} type="button" className="case-card" title={c.subtitle} onClick={() => composerRef.current?.setText(c.prompt)}>
									<CaseCover cover={c.cover} icon={iconForCase(c.chipId)} />
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
