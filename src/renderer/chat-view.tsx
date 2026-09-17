/**
 * 任务对话页：消息流 + 底部输入。
 *
 * 视觉延续首页的输入卡，保证「首页发一句话 → 进入对话页」过渡不突兀。
 * 消息渲染基于 shared/conversation.ts 折叠出的 entries 视图。
 */

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { collectChanges } from "@shared/artifacts.ts";
import type { ConversationView } from "@shared/conversation.ts";
import { lastUserEntryIndex, removeQueuedMessage, insertQueuedNow } from "@shared/conversation.ts";
import { formatTokenCount } from "@shared/context-usage.ts";
import { formatSize } from "@shared/format-size.ts";
import type { ImagePart } from "@shared/image.ts";
import type { ExpertListItem, QuestionnaireAnswer, QuestionnaireRequest } from "@shared/ipc.ts";
import { formatMessageTime } from "@shared/message-time.ts";
import { leadToolName } from "@shared/metafold.ts";
import type { CompactionReason, ConversationEntry, ModeDescriptor, QueuedMessages, RunId, RunRetryState, SourceRef, TodoItem, ToolCard, TurnTiming } from "@shared/session-events.ts";
import { skillInvocationText } from "@shared/skill-block.ts";
import { WAITING_SOOTHED_TEXT, WAITING_TIPS, WELCOME_GREETINGS } from "@shared/waiting-tips.ts";
import {
	IconAlert,
	IconBack,
	IconBranch,
	IconCheck,
	IconChevronDown,
	IconClipboard,
	IconCode,
	IconCopy,
	IconDoc,
	IconEdit,
	IconFolder,
	IconRefresh,
	IconResearch,
	IconSkill,
	IconAssistant,
	IconWeb,
	IconSend,
	IconTrash,
} from "./icons.tsx";
import { branchTargetsOf, type BranchTarget } from "./branch-target.ts";
import { collectSources, sourceUrlMeta } from "./collect-sources.ts";
import { Composer } from "./composer.tsx";
import { ExpertChip } from "./expert-chip.tsx";
import type { ComposerHandle } from "./composer.tsx";
import { ContextUsageRing } from "./context-usage.tsx";
import { useCopyWithTick } from "./copy-tick.ts";
import { groupToolBatches } from "./fold-view.ts";
import type { FoldPlanItem } from "./fold-view.ts";
import { imageDataUrl } from "./image-attachments.tsx";
import { useImeGuard } from "./ime-guard.ts";
import { useModalFocus } from "./use-modal-focus.ts";
import { ModelMenu, shortModelName } from "./model-menu.tsx";
import { PermissionMenu } from "./permission-menu.tsx";
import { PlusMenu } from "./plus-menu.tsx";
import { QuestionnaireDialog } from "./questionnaire-dialog.tsx";
import { Markdown } from "./markdown.tsx";
import { EmptyState, ErrorState, LoadingState, Spinner } from "./state-views.tsx";
import { activePendingAlign, decideScrollAction } from "./send-anchor.ts";
import { computeChatContentWidth } from "./chat-content-width.ts";
import type { PendingSentAlign } from "./send-anchor.ts";
import { SourceFavicon } from "./sources-panel.tsx";
import { TaskAgentCard } from "./task-agent-card.tsx";
import { latestTeamMembers } from "@shared/child-agents.ts";
import { thinkingOpen, toggleThinking } from "./thinking-fold.ts";
import { projectTodoList, windowTodos } from "./todo-projection.ts";
import {
	EMPTY_TURN_FOLDS,
	buildTurnViews,
	collapseAllTurnFolds,
	toggleTurnFold,
	turnFoldExpanded,
} from "./turn-fold.ts";
import type { TurnFoldMap, TurnView } from "./turn-fold.ts";
import { SessionStatsLine } from "./session-stats-line.tsx";
import { foldTurnMetrics } from "./turn-metrics.ts";
import { TurnRail } from "./turn-rail.tsx";
import type { ThinkingFoldOverride } from "./thinking-fold.ts";
import { FAILED_ICON, toolIconOf } from "./tool-icon-registry.ts";
import { WidgetView } from "./widget-view.tsx";

interface ChatViewProps {
	readonly conversation: ConversationView;
	readonly ready: boolean;
	/** 提交失败的原因（如未选模型），显示在消息流末尾。 */
	readonly lastError: string | undefined;
	readonly title: string;
	readonly onBack: () => void;
	/**
	 * 提交（文本 + 可选图片附件）。resolve 表示 daemon 已接收；
	 * 附件据此决定去留（失败保留在输入区，见 submit）。
	 * `whileStreaming` 由 Composer 给出：回车排队（缺省）。插队走队列条的 ↑
	 *（onQueueRewrite 路径）；"steer" 分支保留但已无输入框旁的按钮入口（2026-09-17）。
	 */
	readonly onSubmit: (
		text: string,
		images?: readonly ImagePart[],
		whileStreaming?: "steer" | "followUp",
	) => Promise<void>;
	readonly onAbort: () => void;
	/**
	 * 重排 steer / followUp 等待队列（排队 chips 的删除/编辑底层动作）。
	 * 传入的是**重排后**的完整队列；daemon 清空后按序重入队（session:queue-rewrite）。
	 */
	readonly onQueueRewrite: (queued: QueuedMessages) => void;
	readonly onInteractionChange: (interactionId: string) => void;
	/**
	 * 专家列表（「+」菜单专家子菜单与 composer-bar 当前专家 chip 的数据源，App 层统一下发）。
	 * undefined = 还没拉回来（未就绪），与「拉回来但库里是空的」分开 —— 子菜单据此区分
	 * 「正在读取专家…」与「还没有可用专家」（DESIGN.md §4）。
	 */
	readonly experts: readonly ExpertListItem[] | undefined;
	/** 选择专家；传 undefined = 取消选中（daemon setExpert 只清 expertId，不动交互模式）。 */
	readonly onSelectExpert: (expertId: string | undefined) => void;
	/** 「+」菜单专家子菜单底部的「更多专家…」入口：跳专家页（App 层路由）。 */
	readonly onOpenExperts: () => void;
	/** 「+」菜单的「技能」入口：跳技能页技能页签（缺省回落 onTodo 占位，见 plus-menu）。 */
	readonly onOpenSkills?: () => void;
	/** 「+」菜单的「连接器」入口：跳技能页连接器页签。 */
	readonly onOpenConnectors?: () => void;
	/**
	 * 预填文本（专家市场页 quickPrompt 路径）：App 跳入对话页时带入，
	 * 进输入框后即经 onPrefillConsumed 消费（留在 App state 会重复填充）。
	 */
	readonly prefill?: string;
	readonly onPrefillConsumed: () => void;
	/** 点击产物卡片：在右侧面板预览（面板里有外部打开入口）。 */
	readonly onPreviewArtifact: (path: string) => void;
	/** 点击正文行内 code 的路径徽章：App 决定面板预览还是外部打开。 */
	readonly onPathClick: (path: string, kind: "file" | "directory") => void;
	/** 产物/变更聚合入口：打开预览面板并展开概览菜单对应分组。 */
	readonly onOpenPanelGroup: (group: "artifacts" | "changes") => void;
	/** 「来源」入口：在右侧面板位打开引用来源面板（与产物面板同位互斥，App 层切换）。 */
	readonly onOpenSources: () => void;
	/** 打开设置页（权限弹层的「打开设置…」入口，与 home-view 同语义）。 */
	readonly onOpenSettings: () => void;
	/** 就地轻提示（附件格式/大小被拒等），与 home-view 的 onError 同语义。 */
	readonly onError: (message: string) => void;
	/**
	 * 临时任务转正（保存到工作空间）。resolve = 转正完成（成功 toast 由 App 给）；
	 * reject 的 message 是 daemon 的校验原因，命名弹层原位透出。
	 */
	readonly onSaveToWorkspace: (name: string) => Promise<void>;
	/**
	 * 当前会话是否具备分支条件：daemon 已注册宿主、会话文件已在盘
	 * （App 从任务列表的 current 行判定；「会话尚未落盘」时 daemon 连锚点都解析不了）。
	 * false 时用户气泡的两个分支入口与助手侧「重试」一律不渲染（spec 的
	 * 「会话尚未落盘」场景：界面不出现分支入口；重试同样要先回退，没有文件就没得退）。
	 */
	readonly branchAvailable: boolean;
	/**
	 * 「重新开始」：回退到该用户消息（userIndex 为 0 基用户消息序号）**之前**，
	 * 被放弃的后续由 daemon 抽成分支会话。refillText 给出时 App 会在成功后把它
	 * 填回输入框（不自动发送）；不传 = 不回填（重试路径要立刻重发，填了会占住输入框）。
	 * opts.saveBranch = false 时不抽枝（重试路径：旧回答就地丢弃，重新生成与分支
	 * 是两个功能，2026-09-17 用户实测反馈后与 TRAE/ChatGPT 对齐）。
	 * 返回值 = daemon 是否成功（失败文案由 App 统一提示）。
	 */
	readonly onRestartFrom: (
		userIndex: number,
		refillText?: string,
		opts?: { saveBranch?: boolean },
	) => Promise<boolean>;
	/**
	 * 「分支出新会话」：从该用户消息之前派生新会话并**已由 daemon 切过去**，
	 * App 跟随切换完成后把原文填回输入框（同样不发送）。
	 */
	readonly onBranchFrom: (userIndex: number, refillText: string) => Promise<boolean>;
	readonly onTodo: (feature: string) => void;
	/**
	 * 当前会话的待答问卷（App 按 sessionId 路由后下发；undefined = 无）。
	 * WorkBuddy CBChat 的 hasQuestionFloating 语义：答题期间输入区让位，
	 * 问卷浮层渲染在 composer 位置。可选 —— App 侧接线落地前不传入，
	 * 维持只渲染 composer 的现状。
	 */
	readonly pendingQuestionnaire?: QuestionnaireRequest;
	readonly onQuestionnaireSubmit?: (answers: readonly QuestionnaireAnswer[]) => void;
	readonly onQuestionnaireSkip?: () => void;
	/**
	 * 轮折叠开合的多桶缓存（Map<sessionId, TurnFoldMap>）：App 持有（ChatView
	 * 往返首页会卸载，状态不能死在组件里），本组件挂载/切会话按桶存取。
	 * 会话视图态，不落盘（spec: add-turn-fold-and-anchor）。
	 */
	readonly turnFoldCache: { readonly current: Map<string, TurnFoldMap> };
	/**
	 * 成员聚焦视图（spec: add-team-foundations 批 8）：定义时可见会话是某
	 * 团队成员，顶部显示聚焦横幅（返回主会话走 onBackToLeader）。
	 */
	readonly memberView?: { readonly name: string };
	/** 点击团队卡成员行的「查看」：App 切换可见视图到该成员的实时对话。 */
	readonly onFocusMember?: (memberSessionId: string, memberName: string) => void;
	/** 从成员聚焦横幅返回聚焦前的会话（App 层路由）。 */
	readonly onBackToLeader?: () => void;
}

/* ── 思考块 ────────────────────────────────────────────────────── */

/**
 * 思考内容块。对标 WorkBuddy 的「深度思考」形态：
 * 流式期间默认展开（标题扫光，chevron 隐藏），该条消息完成后自动收起
 * 成一行标题（停扫光、chevron 出现）；用户手动开合优先于自动行为。
 * 折叠状态机在 thinking-fold.ts（纯函数，可单测），这里只持有用户偏好。
 */
function ThinkingBlock({
	text,
	streaming,
}: {
	readonly text: string;
	/** 本条助手消息是否还在流式（assistant_done 后为 false）。 */
	readonly streaming: boolean;
}): React.JSX.Element {
	const [override, setOverride] = useState<ThinkingFoldOverride>(undefined);
	const open = thinkingOpen(streaming, override);
	/*
		思考体限高 200px、自带内部滚动条（见 index.css .thinking-body）。它是
		独立滚动容器，主消息流的贴底跟随管不到它 —— 不主动贴底的话，新吐的字
		全落在线下，可视区永远停在开头（表现为「思考一直卡在顶上不动」）。
		跟随判定与主滚动同一口径（handleStreamScroll）：只看**测量到的位置**
		（距底 < 阈值），用户上翻即解除跟随。不用「程序滚动中」标记位，是因为
		流式增量下标记的维护时序极易漏拍、把跟随误关掉。
	*/
	const bodyRef = useRef<HTMLPreElement>(null);
	const followRef = useRef(true);
	useEffect(() => {
		if (!open) {
			// 收起即复位：重新展开的是一块从头呈现的正文，跟随从「贴底」重新开始。
			followRef.current = true;
			return;
		}
		const node = bodyRef.current;
		if (node === null || !followRef.current) return;
		node.scrollTop = node.scrollHeight;
	}, [text, open]);

	return (
		<div className="thinking-block">
			<button
				type="button"
				className="thinking-head"
				onClick={() => setOverride((v) => toggleThinking(streaming, v))}
			>
				{/* WorkBuddy：进行中标题扫光，完成后 chevron 才出现 —— 扫光与 chevron 互斥。 */}
				{!streaming && (
					<IconChevronDown size={11} className={open ? "thinking-caret open" : "thinking-caret"} />
				)}
				<span className={streaming ? "text-shimmer" : ""}>深度思考</span>
			</button>
			{open && (
				<pre
					className="thinking-body"
					ref={bodyRef}
					onScroll={() => {
						const node = bodyRef.current;
						if (node === null) return;
						followRef.current =
							node.scrollHeight - node.scrollTop - node.clientHeight < BOTTOM_THRESHOLD_PX;
					}}
				>
					{text}
				</pre>
			)}
		</div>
	);
}

/* ── 用户消息气泡 ────────────────────────────────────────────────── */

/**
 * 用户消息气泡（对标 WorkBuddy）：右侧浅色气泡，hover 时下方浮现工具条
 * （时间戳 + 复制 + 分支两个入口）。工具条常驻占位、只切透明度 —— 若 hover 才插入 DOM，
 * 每次划过都会推动下方消息流抖动，长对话里非常刺眼。
 */
function UserBubble({
	entryId,
	text,
	at,
	images,
	skillNames,
	target,
	branchable,
	onRestart,
	onBranch,
}: {
	/** 刻度轨（TurnRail）的测量锚点：data-entry-id 落在根 div 上。 */
	readonly entryId: string;
	readonly text: string;
	readonly at: number;
	/** 本条消息携带的图片附件（仅 UI 展示；进模型的翻译在 daemon 侧）。 */
	readonly images?: readonly ImagePart[];
	/**
	 * 本条消息调用的技能名（`/skill:<name>` 被 pi 展开后剥出的结果，见 shared/skill-block.ts）。
	 * 与 WorkBuddy 的 userMessage 侧同口径：徽标只读展示，不带删除按钮 ——
	 * 消息已发出，撤技能等于改历史。
	 */
	readonly skillNames?: readonly string[];
	/**
	 * 本条消息的分支锚点（用户消息序号 + 可回填的原文，见 branch-target.ts）。
	 * undefined = 锚点表里没有它（表由同源 entries 构造，正常不会缺席）—— 此时不渲染入口。
	 */
	readonly target: BranchTarget | undefined;
	/**
	 * 分支入口是否可用：流式中 / 会话尚未落盘时为 false（spec 的「分支操作的前置条件」）。
	 * 与助手侧「重试」在流式期直接不渲染同口径 —— 不给按下去只会被 daemon 拒掉的死按钮。
	 */
	readonly branchable: boolean;
	readonly onRestart: (target: BranchTarget) => void;
	readonly onBranch: (target: BranchTarget) => void;
}): React.JSX.Element {
	const { copied, copy } = useCopyWithTick();
	// 点击放大的那张图；undefined = 预览关闭。MVP 不做轮播/缩放（YAGNI）。
	const [preview, setPreview] = useState<ImagePart | undefined>(undefined);

	/*
	 * 浮层的焦点归还：关掉预览后焦点回到那张缩略图按钮（否则掉到 body）。
	 * 这里只接「移入 + 归还」—— 浮层里除大图外没有可聚焦元素，陷阱退化成「Tab 不动」
	 * （焦点原地留在缩略图上，不会跑到背景），符合 hook 的既有口径。
	 */
	const previewRef = useModalFocus();

	// Esc 关闭大图预览：遮罩是不可聚焦的容器，键盘用户没有其它关闭路径。
	useEffect(() => {
		if (preview === undefined) return;
		const onKey = (event: KeyboardEvent): void => {
			if (event.key === "Escape") setPreview(undefined);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [preview]);

	return (
		<div className="entry user" data-entry-id={entryId}>
			<div className="user-bubble">
				{/*
					技能胶囊**内联在正文流里**（WB 同款：`[图标] 技能名  正文` 同一行），
					不是先占一行的块 —— 块级排法会让气泡凭空高出一档（胶囊 23 高 vs 正文行 24，
					再加一道间隙就是几十像素的空行）。间距靠 .user-bubble 下的 margin-right
					（内联元素吃不到 flex 的 gap）。
					key 用下标与 user-bubble-images 同口径：列表项无本地状态，
					且同一条消息可以两次调用同一个技能（名字不是唯一键）。
				*/}
				{skillNames?.map((name, index) => (
					<span key={index} className="skill-chip">
						<IconSkill size={14} className="skill-chip-icon" />
						{/* 名字走 .skill-chip-name（nowrap + 省略号）：胶囊是固定 23 高，
						    名字折行会顶破胶囊。与输入卡那枚的技能名同一个类。 */}
						<span className="skill-chip-name">{name}</span>
					</span>
				))}
				{text}
				{images !== undefined && images.length > 0 && (
					// key 用下标与 AttachmentStrip 同口径：列表项无本地状态，src 是同步解码的 data URL。
					<div className="user-bubble-images">
						{images.map((part, index) => (
							<button
								key={index}
								type="button"
								className="user-bubble-thumb"
								aria-label="查看大图"
								onClick={() => setPreview(part)}
							>
								{/* width/height 与 CSS 的固定框同值（index.css 的 .user-bubble-images img
								    为 160×200 定高）：解码前后盒子尺寸不变，横图不会把气泡压矮一次。 */}
								<img src={imageDataUrl(part)} alt="" draggable={false} width={160} height={200} />
							</button>
						))}
					</div>
				)}
			</div>
			<div className="entry-toolbar entry-toolbar-right">
				<span className="user-time">{formatMessageTime(at, Date.now())}</span>
				{/*
					分支入口（spec: add-session-branching）：与「复制」同处一个工具条、
					同一档按钮（.entry-icon-btn —— 这是用户气泡工具条的既有档位，
					见 index.css 该类的注释）。两个动作说的是「从这一条消息之前」，
					而这条消息本身就是入口的落点，所以贴在它自己的工具条上。
				*/}
				{target !== undefined && branchable && (
					<>
						<button
							type="button"
							className="entry-icon-btn"
							aria-label="重新开始"
							title="重新开始（回到这条消息之前）"
							onClick={() => onRestart(target)}
						>
							{/* 沿用重试的「回退」图形：语义相近（退回并重来），不另造图标。 */}
							<IconRefresh size={13} />
						</button>
						<button
							type="button"
							className="entry-icon-btn"
							aria-label="分支出新会话"
							title="分支出新会话（从这条消息之前另起一条）"
							onClick={() => onBranch(target)}
						>
							<IconBranch size={13} />
						</button>
					</>
				)}
				<button
					type="button"
					className="entry-icon-btn"
					aria-label="复制消息内容"
					title={copied ? "已复制" : "复制"}
					// 复制的是用户打过的话（技能消息拼回 `/skill:<name> …`）：技能名在气泡里
					// 是胶囊、不在 text 里，直接复制 text 在「只调技能、没写正文」时是空串。
					onClick={() => void copy(skillInvocationText(skillNames ?? [], text))}
				>
					{copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
				</button>
			</div>
			{preview !== undefined && (
				// 全屏遮罩显示大图，点击任意处（含大图本身）关闭；Esc 关闭在上面的 effect。
				<div
					className="image-preview-overlay"
					role="dialog"
					aria-label="图片预览"
					ref={previewRef}
					onClick={() => setPreview(undefined)}
				>
					<img src={imageDataUrl(preview)} alt="" draggable={false} />
				</div>
			)}
		</div>
	);
}

/* ── 助手消息操作条 ──────────────────────────────────────────────── */

/**
 * 助手回答底部的操作条（对标 WorkBuddy 的 assistant 消息操作条 _assistantFeedback）。
 *
 * **常驻，不 hover**（WB 是 display:flex + visibility:visible）：操作条是这条回答的
 * 「完成凭据」——复制、重试、本轮读数藏进 hover 里就等于没有。用户气泡工具条仍是
 * hover 浮现（时间戳/复制不该常显），两者的分叉写在 CSS 的 .entry-toolbar-right /
 * .entry-toolbar-left 上，基类只留行内布局。
 *
 * **但它一轮只有一条**：只挂在「该轮已结束」的那条**末条 assistant 消息**上
 * （挂点由 turn-fold 的 TurnView.actionsAnchorId 判定，调用点见 actionsAnchorIds）。
 * 「常驻」是显隐口径，不是挂载粒度 —— 曾经每条 assistant 条目都挂一个，是 hover 时代
 * 留下的粒度：entry 很细，一个「深度思考」段、一段过程说明各自就是一条 assistant 条目，
 * 那时按钮要 hover 才现、不显眼；改成常驻后就成了每段过程下面都露出一个孤零零的复制
 * 图标，一轮里重复多次。WorkBuddy 的 assistant-feedback 同口径（只有 request 末条
 * assistant 消息才有），这里照它做：复制/重试/指标说的是**一条回答**，过程条目不该有
 * 「回答级」的操作条。
 *
 * 按钮走 DESIGN.md §3.1 的「图标按钮」档（.bar-btn：无底无边、16px 图标、hover 只落
 * 一层 --bg-hover），**不用**用户侧气泡那套 .entry-icon-btn 白圆钮 —— 后者是「浮在气泡
 * 上、hover 一闪」的形态；本操作条常驻、每轮一行，白底 + 边框 + 卡片阴影会把「一行轻量
 * 元信息」压成「一行控件」。WorkBuddy 的消息操作钮同口径：透明底、无边框、无阴影、图标 16
 * （lib-chat-ui-Co_VI_pZ.css:20906 `_actionButton_jnle9_7` / :20969 `_copyButton_1ncbp_1`）。
 *
 * 「执行计划」是 plan→craft 的衔接入口：plan 模式产出的计划只在末条
 * assistant 消息上给这个按钮（历史消息不给，否则满屏按钮）。
 *
 * 重试 / 指标 / 模型名都只挂在「本轮最后一条 assistant 消息」上
 * （调用点的 metricsAnchorId，与 WB 的 credit 挂 isLastMessageOfRequest 同口径）：
 * 它们说的是**本轮**，挂到历史消息上就是错的（重试会把会话回退到本轮的起点重发）。
 * 操作条本体（复制）则每一轮的末条 assistant 都有 —— 那是**那条回答**的操作条。
 */
function AssistantActions({
	text,
	modelId,
	showExecutePlan,
	onExecutePlan,
	showBranch,
	onBranch,
	showRetry,
	onRetry,
	metrics,
}: {
	readonly text: string;
	/** 本轮所用模型；不是本轮的挂点消息时传 undefined（尾部的模型名整段不渲染）。 */
	readonly modelId: string | undefined;
	/** 是否显示「执行计划」（父组件按 plan 模式 + 非流式 + 末条判定）。 */
	readonly showExecutePlan: boolean;
	readonly onExecutePlan: () => void;
	/**
	 * 是否显示「分支出新会话」：与重试同一挂点判定（本轮末条 assistant + 分支可用 +
	 * 有锚点）。分支入口原来只在用户气泡的 hover 工具条里，实测没人找得到（2026-09-17
	 * 用户反馈）—— 对齐 TRAE 把它放进回答的常驻操作条：复制 → 分支 → 重试。
	 */
	readonly showBranch: boolean;
	readonly onBranch: () => void;
	/** 是否显示「重试」（父组件按「本轮末条 assistant + 分支入口可用 + 有可重发的用户消息」判定）。 */
	readonly showRetry: boolean;
	readonly onRetry: () => void;
	/** 本轮指标读数；不是本轮的挂点消息时传 undefined（整段不渲染，不给空壳）。 */
	readonly metrics?: { readonly entries: readonly ConversationEntry[]; readonly turn: TurnTiming };
}): React.JSX.Element | null {
	const { copied, copy } = useCopyWithTick();
	// 复制的前提是这条回答有正文：纯思考的挂点（异常收尾、还没吐正文的轮）复制出来是空串，
	// 不如不给一个按下去什么也拿不到的按钮。
	const copyable = text.trim() !== "";
	// 读数项在这里算（读数条只负责画）：空态守卫要问「读数到底有没有东西」，
	// 只判 metrics 这个 prop 在不在会漏掉「挂了 metrics 但本轮没有 usage」的路径。
	const items = metrics === undefined ? [] : metricItems(metrics.entries, metrics.turn);
	/*
		空态守卫：操作条是这条回答的「完成凭据」，一项都没得显示时整条不渲染。
		挂点存在但无内容的情形是真的（上面那个纯思考挂点、无 usage 且无可重发消息的收尾），
		留一个空白容器比不渲染更糟 —— 读起来像「这里本来有东西没加载出来」。
	*/
	if (
		!showExecutePlan &&
		!copyable &&
		!showBranch &&
		!showRetry &&
		items.length === 0 &&
		modelId === undefined
	) {
		return null;
	}

	// 位序对齐 TRAE 的回答操作条：复制 → 分支 → 重试（→ 指标 | 模型名）。
	// WorkBuddy 的赞踩是云端上报项、分享需后端，均 descope。
	return (
		<div className="entry-toolbar entry-toolbar-left">
			{/* 文字按钮而非图标：这个动作没有不言自明的图标（同 .bar-btn 档的文字变体）。 */}
			{showExecutePlan && (
				<button type="button" className="bar-btn bar-btn-text" onClick={onExecutePlan}>
					执行计划
				</button>
			)}
			{copyable && (
				<button
					type="button"
					className="bar-btn"
					aria-label="复制回答"
					title={copied ? "已复制" : "复制回答"}
					onClick={() => void copy(text)}
				>
					{copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
				</button>
			)}
			{showBranch && (
				<button
					type="button"
					className="bar-btn"
					aria-label="分支出新会话"
					title="分支出新会话（从这一轮之前另起一条，母会话不动）"
					onClick={onBranch}
				>
					<IconBranch size={16} />
				</button>
			)}
			{showRetry && (
				<button
					type="button"
					className="bar-btn"
					aria-label="重试"
					title="重试（回到这一轮之前重新生成）"
					onClick={onRetry}
				>
					<IconRefresh size={16} />
				</button>
			)}
			{items.length > 0 && <RunMetricsBar items={items} />}
			{modelId !== undefined && <span className="assistant-model">{shortModelName(modelId)}</span>}
		</div>
	);
}

/* ── 「来源」按钮 ──────────────────────────────────────────────── */

/**
 * favicon 头像组的取数口径（WorkBuddy 同款）：按站点去重取前 3。
 * 来源按钮与 web_search 工具卡卡头共用，两处不会出现口径漂移。
 * URL 构造失败的项不进头像组（脏 URL 不上屏，与 collect-sources 同口径）。
 */
function pickSiteFavicons(sources: readonly SourceRef[]): { readonly key: string; readonly favicon: string }[] {
	const seen = new Set<string>();
	const picked: { readonly key: string; readonly favicon: string }[] = [];
	for (const source of sources) {
		const meta = sourceUrlMeta(source.url);
		if (meta === undefined) continue;
		const site = source.site ?? meta.host;
		if (seen.has(site)) continue;
		seen.add(site);
		picked.push({ key: site, favicon: meta.favicon });
		if (picked.length === 3) break;
	}
	return picked;
}

/**
 * 操作行「来源」入口（WorkBuddy 同款，spec: add-search-sources-panel）：
 * favicon 头像组（按站点去重取前 3、负 margin 叠放，加载失败回退 Globe）
 * + 「来源」文案。头像组只是入口暗示与计数提示，全量清单在 SourcesPanel。
 * 无来源时父级不渲染本按钮。
 */
function SourcesButton({
	sources,
	onClick,
}: {
	readonly sources: readonly SourceRef[];
	readonly onClick: () => void;
}): React.JSX.Element {
	const avatars = useMemo(() => pickSiteFavicons(sources), [sources]);

	return (
		<button
			type="button"
			className="sources-btn"
			title={`引用来源（${sources.length}）`}
			aria-label={`引用来源（${sources.length}）`}
			onClick={onClick}
		>
			{/* 头像组是纯装饰：计数与语义都在 aria-label 上。 */}
			<span className="sources-avatars" aria-hidden="true">
				{avatars.map((avatar) => (
					<SourceFavicon key={avatar.key} url={avatar.favicon} />
				))}
			</span>
			来源
		</button>
	);
}

/* ── 错误卡 ────────────────────────────────────────────────────── */

/**
 * 结构化错误报告（复制内容）：排障时需要的一组字段一次带走，
 * 比让用户逐行手抄 runId 可靠。runId / 模型缺省时整行略去，
 * 时间缺省（提交失败未落库）时取复制当下。
 */
function buildErrorReport(message: string, runId: RunId | undefined, at: number, modelId: string | undefined): string {
	const lines = [`错误信息: ${message}`];
	if (runId !== undefined) lines.push(`runId: ${runId}`);
	lines.push(`时间: ${new Date(at).toISOString()}`);
	if (modelId !== undefined) lines.push(`模型: ${modelId}`);
	return lines.join("\n");
}

/**
 * 内嵌错误卡（机制对标 WorkBuddy）：run 异常结束或提交失败时落在消息流里，
 * 错误图标 + 可折行的标题 + runId 区（复制结构化报告）+ 重试实心按钮。
 * 重试 = 回退到最后一条 user 消息之前并重发（与操作条同一个实现）；
 * 没有可重发的消息时按钮隐藏。
 * 卡片是历史的一部分：新回合开始后留在原位（ErrorEntry 不挪位）。
 */
function ErrorCard({
	message,
	runId,
	at,
	modelId,
	retryText,
	onRetry,
}: {
	readonly message: string;
	/** 出错的 run；提交失败（未进入 run）时没有，runId 区整块不渲染。 */
	readonly runId?: RunId;
	/** 错误落库时间；缺省时报告取复制当下的时间。 */
	readonly at?: number;
	readonly modelId: string | undefined;
	/** 最后一条 user 消息的原文（含技能回拼）；undefined 时隐藏重试按钮。 */
	readonly retryText: string | undefined;
	readonly onRetry: () => void;
}): React.JSX.Element {
	const { copied, copy } = useCopyWithTick();

	return (
		<div className="error-card">
			<div className="error-card-head">
				<IconAlert size={16} className="error-card-icon" />
				<span className="error-card-title">{message}</span>
			</div>
			{runId !== undefined && (
				<div className="error-card-meta">
					<span className="error-card-runid">runId: {runId}</span>
					<button
						type="button"
						className="error-card-copy"
						aria-label="复制错误报告"
						title={copied ? "已复制" : "复制错误报告"}
						onClick={() => void copy(buildErrorReport(message, runId, at ?? Date.now(), modelId))}
					>
						{copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
					</button>
				</div>
			)}
			{retryText !== undefined && (
				<button type="button" className="error-card-retry" onClick={onRetry}>
					重试
				</button>
			)}
		</div>
	);
}

/* ── 工具卡片 ────────────────────────────────────────────────────── */

/** 执行状态 → 状态点样式类。undefined 表示还在跑。 */
function outcomeClass(outcome: ToolCard["outcome"]): string {
	if (outcome === undefined) return "running";
	return outcome === "ok" ? "ok" : "bad";
}

/**
 * 单张工具卡片，折叠态只显示一行摘要。
 *
 * 默认折叠：一次任务可能调十几次工具，全展开会把助手的结论冲掉，
 * 而用户真正要看的是结论。WorkBuddy 的主提示词里也明确写了
 * 「中间过程在 UI 被折叠」，是同一个考虑。
 */
function ToolEntry({ card, showChangeDetails }: { readonly card: ToolCard; readonly showChangeDetails: boolean }): React.JSX.Element {
	const [open, setOpen] = useState(false);
	// web_search 特化（spec: add-source-favicons）：卡带 sources 时卡头加
	// favicon 头像组 + 计数，展开区在 detail 前渲染逐条来源行（WorkBuddy
	// cr-tool-web-search__item 同构）。其他工具卡不受影响。
	const webSources =
		card.toolName === "web_search" && card.sources !== undefined && card.sources.length > 0
			? card.sources
			: undefined;
	const avatars = useMemo(() => (webSources === undefined ? [] : pickSiteFavicons(webSources)), [webSources]);
	const hasDetail = card.detail !== undefined && card.detail !== "";
	// summaryTitle 也要求可展开：卡头被模型自描述顶替后，真命令只在这条提示里
	// （hover 要悬停才看得见，审计「到底跑了什么」得有个能常驻的位置）。
	const hasCommandLine = card.summaryTitle !== undefined;
	// sources 也是可展开内容：detail 缺席（旧会话/提取失败）时来源行列表仍要够得着。
	const expandable = hasDetail || hasCommandLine || webSources !== undefined;
	// 执行中（outcome 未落定）或生成中（write 参数还在流式输出）→ 状态字扫光；
	// 完成后摘类回归静态 —— 扫光是全局唯一「进行中」语言（对标 WorkBuddy）。
	const running = card.outcome === undefined || card.generating === true;
	// 失败与 tool-dot.bad 同口径（outcome 落定且非 ok，含被拦/被取消）：
	// 换成失败状态图标，不再显示工具类型图标（状态图标与类型图标分属两套，WorkBuddy 同构）。
	const failed = card.outcome !== undefined && card.outcome !== "ok";
	const ToolIcon = failed ? FAILED_ICON : toolIconOf(card.toolName);

	return (
		<div className="entry tool">
			<button
				type="button"
				className="tool-head"
				disabled={!expandable}
				title={expandable ? (open ? "收起" : "展开详情") : undefined}
				onClick={() => setOpen((v) => !v)}
			>
				<span className={`tool-dot ${outcomeClass(card.outcome)}`} />
				{/* 工具类型图标按 toolName 从 registry 解析；执行中隐藏 ——
				    进行中状态全靠呼吸点 + 扫光状态字表达（WorkBuddy 同款）。 */}
				{!running && <ToolIcon size={14} className={failed ? "tool-icon failed" : "tool-icon"} />}
				{/* 标签是状态词（生成中/已生成/读取中/已读取…），由适配层按
				    WorkBuddy 词汇表给出，UI 不做映射（契约见 session-events.ts）。 */}
				<span className={running ? "tool-label text-shimmer" : "tool-label"}>{card.label}</span>
				{/* 摘要被 hover 提示时是「卡头显示的是描述、真命令行藏在提示里」
				    的分工（WorkBuddy primaryTitle 同款，见 core/session-rebuild.ts 的
				    summarizeArgs —— live 与历史重建共用同一份表）；
				    ToolCard 不填 summaryTitle 时属性缺席，行为与之前一致。 */}
				<span className="tool-summary" title={card.summaryTitle}>{card.summary}</span>
				{/* web_search 卡头来源区：头像组是纯装饰（语义在计数文本上）；
				    计数取 sources 总数 —— 它是不去重的结果数，与 SourcesPanel 标题同口径。 */}
				{webSources !== undefined && (
					<span className="tool-sources">
						<span className="sources-avatars" aria-hidden="true">
							{avatars.map((avatar) => (
								<SourceFavicon key={avatar.key} url={avatar.favicon} />
							))}
						</span>
						{webSources.length} 个来源
					</span>
				)}
				{/* write/edit 的增删行徽章（对标 WorkBuddy 的「+276 -0」）。
			    生成中是流式实时计数，执行成功后是终值，同一个字段两个口径。
			    个性化「展示文件变更过程详情」只藏生成中的过程计数（off 时），
			    完成态终值不受影响 —— 终值是结果信息不是过程详情。 */}
				{card.change !== undefined && (showChangeDetails || card.generating !== true) && (
					<span className="tool-change">
						<span className="added">+{card.change.added}</span>
						<span className="removed">-{card.change.removed}</span>
					</span>
				)}
				{expandable && <IconChevronDown size={12} className={open ? "tool-caret open" : "tool-caret"} />}
			</button>
			{/* 来源行列表与详情盒均常驻 DOM、open 类切换：条件挂载下元素挂载即终态，
			    CSS 过渡无从起跳，折叠展开动画必须有一个始终在树的元素。 */}
			{webSources !== undefined && (
				<div className={open ? "tool-source-list open" : "tool-source-list"}>
					{webSources.map((source, index) => {
						const meta = sourceUrlMeta(source.url);
						// 空/非法 URL 项不渲染（daemon 侧已过安全校验，这里是渲染层兜底）。
						if (meta === undefined) return null;
						return (
							<button
								// 卡内 sources 是未去重的原始结果清单，同 URL 可出现多次，
								// 键带序号（面板侧用纯 url 是因为已按 URL 去重）。
								key={`${source.url}#${index}`}
								type="button"
								className="tool-source-item"
								title={`${source.title}\n${source.url}（外部打开）`}
								onClick={() => window.open(source.url)}
							>
								<SourceFavicon url={meta.favicon} />
								{/* 无标题显 host：标题是可选载荷，host 恒可推导。 */}
								<span className="tool-source-title">{source.title !== "" ? source.title : meta.host}</span>
							</button>
						);
					})}
				</div>
			)}
			{(hasDetail || hasCommandLine) && (
				<pre className={open ? "tool-detail-box open" : "tool-detail-box"}>
					{/* 展开区第一行放真命令（WorkBuddy 的 tool-exec__command 同分工）：
					    卡头被模型自描述顶替后，命令不能只活在 hover 提示里 —— 提示要悬停
					    才看得到，用户核对「刚才到底跑了什么」得有个能选中、能复制的常驻位置。
					    独占一行而不进 detail：detail 是工具结果原文，混进去会污染既有语义。 */}
					{card.summaryTitle === undefined ? "" : `${card.summaryTitle}\n\n`}
					{card.detail}
				</pre>
			)}
		</div>
	);
}

/* ── 任务清单卡（todo_write） ────────────────────────────────────── */

/**
 * 清单行：状态 glyph + 文字（WorkBuddy cr-tool-plan-task__row 同构）。
 * in_progress 显示 activeForm（进行态措辞）替代 content 且加粗；
 * completed 删除线灰化；pending 空心圆环。
 */
function TodoRow({ todo }: { readonly todo: TodoItem }): React.JSX.Element {
	if (todo.status === "completed") {
		return (
			<div className="todo-row">
				<span className="todo-glyph">
					<IconCheck size={14} className="todo-check" />
				</span>
				<span className="todo-text done">{todo.content}</span>
			</div>
		);
	}
	if (todo.status === "in_progress") {
		return (
			<div className="todo-row running">
				<span className="todo-glyph">
					<Spinner size={14} />
				</span>
				<span className="todo-text">{todo.activeForm ?? todo.content}</span>
			</div>
		);
	}
	return (
		<div className="todo-row">
			<span className="todo-glyph">
				<span className="todo-ring" />
			</span>
			<span className="todo-text">{todo.content}</span>
		</div>
	);
}

/**
 * todo_write 的任务清单卡（WorkBuddy cr-tool-plan-task 同构）。
 *
 * 与 ToolEntry 的定位差异：普通工具卡是「过程记录」，默认折叠成一行摘要；
 * 清单卡是「活的状态面板」—— 投影（todo-projection.ts）保证它恒为最新
 * 全量，所以它是消息流最新内容时默认展开、落在历史位置时默认折叠；
 * 用户手动开合优先于默认规则（点过一次就不再跟随 defaultOpen）。
 */
function TodoListCard({
	card,
	defaultOpen,
}: {
	readonly card: ToolCard;
	/** 该卡是消息流最后一条 entry 时默认展开（进度面板紧跟当前进展）。 */
	readonly defaultOpen: boolean;
}): React.JSX.Element {
	const [override, setOverride] = useState<boolean | undefined>(undefined);
	const open = override ?? defaultOpen;
	// 接收中 = 参数还在流式输出、todos 尚未解析出（投影保留 generating 的
	// 语义见 todo-projection.ts）：展开体只有一行占位，不解析半截 JSON。
	const receiving = card.generating === true && card.todos === undefined;
	const todos = card.todos;

	return (
		<div className="entry tool">
			<button
				type="button"
				className="tool-head"
				title={open ? "收起" : "展开"}
				onClick={() => setOverride((v) => !(v ?? defaultOpen))}
			>
				<IconClipboard size={14} className="tool-icon" />
				<span className={receiving ? "tool-label text-shimmer" : "tool-label"}>{card.label}</span>
				<IconChevronDown size={12} className={open ? "tool-caret open" : "tool-caret"} />
			</button>
			{/* 展开盒复用 tool-detail-box 的开合机制（常驻 DOM + 类切换，理由见
			    ToolEntry 注释）；todo-list-box 只覆盖排版与底色（清单是文本行，
			    不是等宽输出）。 */}
			<div className={open ? "tool-detail-box todo-list-box open" : "tool-detail-box todo-list-box"}>
				{receiving ? (
					<LoadingState text="接收中…" />
				) : todos === undefined || todos.length === 0 ? (
					// 收尾清空（todos: []）也是有效全量：灰字一行交代，不留空盒。
					<EmptyState title="清单已清空" />
				) : (
					<div className="todo-list">
						{windowTodos(todos).map((todo, index) => <TodoRow key={index} todo={todo} />)}
					</div>
				)}
			</div>
		</div>
	);
}

/* ── 段折叠（工具批 / 过程消息） ───────────────────────────────── */

/**
 * 折叠行行首主导图标的工具名 → 图标映射。fold plan 给出的 leadName 在
 * shared/renderer 纯函数层只是工具名 —— 图标是渲染资产，不能逆流进
 * 纯函数层（§1）。bash/powershell 在此汇合为同一终端图标（metafold 侧
 * 二者拆开计数，视觉仍一致）。未知工具（如 MCP 工具）与无工具段兜底
 * IconSkill。
 */
const FOLD_LEAD_ICONS: Readonly<Record<string, typeof IconDoc>> = {
	read: IconDoc,
	write: IconEdit,
	edit: IconEdit,
	ls: IconFolder,
	grep: IconResearch,
	find: IconResearch,
	bash: IconCode,
	powershell: IconCode,
	web_search: IconWeb,
	web_fetch: IconWeb,
	present_files: IconDoc,
};

/**
 * 段折叠条（机制对标 WorkBuddy）：一行摘要（主导图标 + 文案 + chevron），
 * 点击展开段内内容原位展示。三个用途共用同一外壳（别造两套折叠 UI）：
 *   - 顶层工具组：fold-view 计划里的 tool-group 项（进行中轮的 ≥2 连续工具批，
 *     其后已出现正文才收进来），文案是 metafold 词汇表的摘要；
 *   - 折叠段内的工具批摘要条：groupToolBatches 的 ≥2 连续工具批，
 *     批内夹着的思考块随批展开；
 *   - 「过程消息」折叠条：锚点之间（或末锚点之后）的过程段，文案恒定
 *     「过程消息」，图标取段内主导工具（无工具段用兜底图标）。
 *
 * 展开状态由父组件按段 id 记住（Map）—— 折叠计划每次渲染由纯函数重算，
 * 组件若自持状态会随计划重建丢失。
 */
function SegmentFold({
	leadName,
	label,
	open,
	onToggle,
	children,
}: {
	/** 段内主导工具名；无工具的过程段传 undefined（兜底图标）。 */
	readonly leadName: string | undefined;
	readonly label: string;
	readonly open: boolean;
	readonly onToggle: () => void;
	readonly children: React.ReactNode;
}): React.JSX.Element {
	const LeadIcon = (leadName !== undefined ? FOLD_LEAD_ICONS[leadName] : undefined) ?? IconSkill;
	return (
		<div className="metafold">
			<button
				type="button"
				className={open ? "metafold-row open" : "metafold-row"}
				title={open ? "收起过程" : "展开过程"}
				onClick={onToggle}
			>
				<LeadIcon size={16} className="metafold-lead" />
				<span className="metafold-summary">{label}</span>
				<IconChevronDown size={12} className="metafold-caret" />
			</button>
			{/* 折叠体常驻 DOM（理由同 ToolEntry 详情盒）。高度动画走
			    grid-template-rows 0fr↔1fr：卡片数不定、内层工具详情还会
			    再展开，max-height 的固定上限方案在这里必然裁内容。 */}
			<div className={open ? "metafold-body open" : "metafold-body"}>
				<div className="metafold-body-inner">{children}</div>
			</div>
		</div>
	);
}

/* ── 流式状态行 ──────────────────────────────────────────────────── */

/**
 * 流式期间底部状态行的文案（WorkBuddy 的 progress.phase 同位置）。
 *
 * 它的阶段机：model_requesting（等待模型响应）→ model_streaming（生成回复中，
 * 写文件时是 正在写入文件/正在编辑文件）→ tool_executing.<Tool>（正在读取文件…）。
 * 我们从 entries 末尾反推同样的阶段：最近一张未完成的工具卡决定工具阶段，
 * 否则按消息流位置区分「等响应」与「生成中」。
 */
function pendingText(entries: readonly ConversationEntry[]): string {
	for (let i = entries.length - 1; i >= 0; i -= 1) {
		const entry = entries[i];
		if (entry === undefined) break;
		if (entry.role === "tool") {
			if (entry.outcome !== undefined) return "生成回复中";
			// 未完成：生成阶段（generating）与执行阶段同文案（WorkBuddy 两边都是「正在写入文件」）。
			switch (entry.toolName) {
				case "write":
					return entry.summary === "" ? "正在写入文件…" : `正在写入文件 ${entry.summary}…`;
				case "edit":
					return entry.summary === "" ? "正在编辑文件…" : `正在编辑文件 ${entry.summary}…`;
				case "read":
					return "正在读取文件…";
				case "ls":
					return "正在列出目录…";
				case "grep":
					return "正在搜索内容…";
				case "find":
					return "正在查找文件…";
				case "bash":
				case "powershell":
					return "正在执行命令…";
				default:
					return "正在处理…";
			}
		}
		if (entry.role === "assistant") return "生成回复中";
		if (entry.role === "user") return "等待模型响应…";
	}
	return "等待模型响应…";
}

/**
 * 重试状态行（auto_retry 全程可见，spec: add-observability-ledger）：
 * 「响应失败，N 秒后第 X/Y 次重试」。琥珀（--warning）表「出错但在自愈」，
 * --danger 留给终态错误卡。倒计时以 retryAt 为准（reducer 打点，两端共用
 * 折叠不受 IPC 延迟影响），500ms tick、clamp 到 0。
 */
function RetryPendingLine({ retry }: { readonly retry: RunRetryState }): React.JSX.Element {
	const [remainMs, setRemainMs] = useState(() => Math.max(0, retry.retryAt - Date.now()));
	useEffect(() => {
		const timer = window.setInterval(() => {
			setRemainMs(Math.max(0, retry.retryAt - Date.now()));
		}, 500);
		return () => window.clearInterval(timer);
	}, [retry.retryAt]);
	const seconds = Math.ceil(remainMs / 1000);
	return (
		<div className="stream-retry" role="status">
			<span>
				响应失败，{seconds > 0 ? `${seconds} 秒后` : "即将"}第 {retry.attempt}/{retry.maxAttempts} 次重试
			</span>
			{retry.errorMessage !== undefined && (
				<span className="stream-retry-reason" title={retry.errorMessage}>
					{retry.errorMessage}
				</span>
			)}
		</div>
	);
}

/**
 * 压缩状态行（spec: surface-run-metrics-in-chat Task 4.4）。
 *
 * 压缩要调模型写摘要，耗时与一轮对话相当；这段窗口若不给反馈，用户会以为卡死
 * （与等待首响应同理）。compaction_finished（含中断/失败）到达即随状态清空。
 * 原因后缀让用户知道该做什么：阈值/溢出是系统自愈，手动是用户发起。
 */
const COMPACTION_REASON_LABEL: Record<CompactionReason, string> = {
	threshold: "阈值触发",
	overflow: "上下文溢出",
	manual: "手动压缩",
};

function CompactionPendingLine({ reason }: { readonly reason: CompactionReason }): React.JSX.Element {
	return (
		<div className="stream-pending">
			<span className="text-shimmer">正在压缩上下文…</span>
			{/* 原因后缀走 .stream-pending 继承的 --text-secondary，不抢扫光主文案的注意力。 */}
			<span>{COMPACTION_REASON_LABEL[reason]}</span>
		</div>
	);
}

/* ── 等待首响应：安抚文案 + tips 轮播 ────────────────────────────── */

/** 等待 4s 后出现首条 tip；等待 8s 主文案切换安抚文案；tip 每 10s 轮换。 */
const TIP_SHOW_DELAY_MS = 4_000;
/*
 * 加载欢迎语（个性化开关）：等待 1s 后把主文案换成一句问候 —— 同位替换
 * 而非上方加行（零布局抖动），与 tips 轮播共存互不干扰。
 */
const GREETING_DELAY_MS = 1_000;
const SOOTHE_DELAY_MS = 8_000;
const TIP_ROTATE_MS = 10_000;

/**
 * 随机取下一条 tip 的下标，保证不与当前条重复（机制对齐 WorkBuddy）。
 * 在 size-1 个候选里均匀取偏移量再绕环，比「抽到重复就重抽」干净。
 */
function nextTipIndex(size: number, current: number | undefined): number {
	if (size <= 1 || current === undefined) return Math.floor(Math.random() * size);
	return (current + 1 + Math.floor(Math.random() * (size - 1))) % size;
}

/**
 * 等待模型首响应阶段的状态行（最后一条 entry 是 user 时才有意义）。
 *
 * 机制对齐 WorkBuddy：主文案扫光；4s 后右侧出现「| + 一条随机 tip」，
 * 每 10s 换一条（不重复），hover/focus 暂停轮换，× 关闭后本次会话不再出现；
 * 等待超过 8s 主文案切换安抚文案。模型开始响应后整条随状态行一起消失 ——
 * 本组件只在等待阶段挂载，无残留。
 *
 * dismissed 由父组件持有：同一回合内阶段切换（等待→生成→工具→等待）会
 * 重挂本组件，而「关闭后本次会话不再出现」是会话级承诺，不能随重挂复位。
 */
function WaitingPendingLine({
	dismissed,
	onDismiss,
	welcomeGreeting,
}: {
	readonly dismissed: boolean;
	readonly onDismiss: () => void;
	readonly welcomeGreeting: boolean;
}): React.JSX.Element {
	const [tipShown, setTipShown] = useState(false);
	const [soothed, setSoothed] = useState(false);
	const [greeting, setGreeting] = useState<string | undefined>(undefined);
	const [tipIndex, setTipIndex] = useState(() => nextTipIndex(WAITING_TIPS.length, undefined));
	const [paused, setPaused] = useState(false);

	// 一次性计时：1s 换问候、4s 出首条 tip、8s 切安抚文案。只在等待阶段计时（组件随阶段挂载）。
	useEffect(() => {
		const greetingTimer = window.setTimeout(() => {
			// 一次等待内只取一条不换：轮换问候会把用户的注意力从「还在跑」拉走。
			setGreeting(WELCOME_GREETINGS[Math.floor(Math.random() * WELCOME_GREETINGS.length)]);
		}, GREETING_DELAY_MS);
		const tipTimer = window.setTimeout(() => setTipShown(true), TIP_SHOW_DELAY_MS);
		const sootheTimer = window.setTimeout(() => setSoothed(true), SOOTHE_DELAY_MS);
		return () => {
			window.clearTimeout(greetingTimer);
			window.clearTimeout(tipTimer);
			window.clearTimeout(sootheTimer);
		};
	}, []);

	// 轮换：恢复（hover 结束）后重新计满 10s，比补剩余时间简单且观感一致。
	useEffect(() => {
		if (!tipShown || dismissed || paused) return;
		const timer = window.setInterval(() => {
			setTipIndex((current) => nextTipIndex(WAITING_TIPS.length, current));
		}, TIP_ROTATE_MS);
		return () => window.clearInterval(timer);
	}, [tipShown, dismissed, paused]);

	const showTip = tipShown && !dismissed;
	return (
		<div className="stream-pending">
			<span className="text-shimmer">
				{soothed ? WAITING_SOOTHED_TEXT : welcomeGreeting && greeting !== undefined ? greeting : "等待模型响应…"}
			</span>
			{showTip && (
				<span
					className="pending-tip"
					onMouseEnter={() => setPaused(true)}
					onMouseLeave={() => setPaused(false)}
				>
					<span className="pending-tip-sep" aria-hidden="true">
						|
					</span>
					{WAITING_TIPS[tipIndex]}
					{/*
						focus 暂停挂在 × 按钮上、不挂外面的 .pending-tip：那个 span 不可聚焦，
						React 的 onFocus 走 focusin（冒泡）所以此前也只在「× 获焦」时触发 ——
						行为一样，但读起来像死代码、一旦有人给 span 加 tabIndex 还会变味。
						挂在实际可聚焦的元素上，「暂停」的可达路径就一目了然。
					*/}
					<button
						type="button"
						className="pending-tip-close"
						aria-label="不再显示提示"
						title="不再显示提示"
						onFocus={() => setPaused(true)}
						onBlur={() => setPaused(false)}
						onClick={onDismiss}
					>
						×
					</button>
				</span>
			)}
		</div>
	);
}

/* ── 回合头部（已处理时长） ──────────────────────────────────────── */

/** 时长格式化：WorkBuddy「已处理 *m*s」口径（41s / 2m3s）。 */
function formatDuration(ms: number): string {
	const totalSec = Math.max(0, Math.floor(ms / 1000));
	const m = Math.floor(totalSec / 60);
	const s = totalSec % 60;
	return m === 0 ? `${s}s` : `${m}m${s}s`;
}

/**
 * 回合头部：agent 名 + 计时（WorkBuddy 同位置：名字下挂「已处理 41s」/「已完成 41s」）。
 *
 * 进行中每 500ms 走表（与 WorkBuddy 的刷新精度一致）；计时起点是用户消息
 * 落库时间，不是首个 token —— 排队/检索的时间也计入，与其口径一致。
 *
 * turn 由调用点按轮解析（spec: surface-run-metrics-in-chat Task 4.3）：活动轮
 * 传实时计时（已处理 Ns，走表）；历史/已结束轮传从 ConversationView.turnTimings
 * 按 turnId 查到的真实计时（已完成 Ns，取消轮 已取消 Ns）。查不到计时才回落
 * 「已完成」—— 中断是用户主动动作，UI 上必须看得出（机制对标 WorkBuddy 取消终态）。
 * 终态措辞取 WorkBuddy 的 metaFold.turnCompletedWithDuration（「已完成 {duration}」）：
 * 「用时」是旁观者视角的测量词，「已完成」才是回合的终态陈述 —— 与轮折叠开关
 * （点它收起本轮过程）说的是同一件事。
 *
 * 轮折叠开关（spec: add-turn-fold-and-anchor）：fold plan 判定本轮有折叠区
 * （hasTurnFold）时整头可点，时长行尾带 chevron，点击切换过程区显隐；
 * 无折叠内容的轮不给假交互（不可点、无 chevron）；进行中的轮
 * （hasTurnFold 恒 false）行为与原来完全一致。
 */
function TurnHeader({
	active,
	turn,
	collapsible,
	expanded,
	onToggle,
}: {
	readonly active: boolean;
	readonly turn: TurnTiming | undefined;
	/** 本轮是否存在「已完成 Xs」轮折叠区（fold plan 的 hasTurnFold）。 */
	readonly collapsible: boolean;
	readonly expanded: boolean;
	readonly onToggle: () => void;
}): React.JSX.Element {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!active) return;
		const timer = window.setInterval(() => setNow(Date.now()), 500);
		return () => window.clearInterval(timer);
	}, [active]);

	let duration = "已完成";
	if (active && turn?.startedAt !== undefined) {
		duration = `已处理 ${formatDuration(now - turn.startedAt)}`;
	} else if (turn !== undefined && turn.endedAt !== undefined) {
		duration =
			turn.cancelled === true
				? `已取消 ${formatDuration(turn.endedAt - turn.startedAt)}`
				: `已完成 ${formatDuration(turn.endedAt - turn.startedAt)}`;
	}

	// 容器用 span 不用 div：可点击时它们要落在 <button> 里，
	// button 只允许 phrasing content（display 已由 CSS 接管，语义不变）。
	const body = (
		<>
			<span className="turn-avatar" aria-hidden="true">
				<IconAssistant size={16} />
			</span>
			<span className="turn-meta">
				<span className="turn-agent">嘉立创Work</span>
				<span className="turn-duration">
					{duration}
					{collapsible && (
						<IconChevronDown size={12} className={expanded ? "turn-caret open" : "turn-caret"} />
					)}
				</span>
			</span>
		</>
	);

	if (!collapsible) return <div className="turn-header">{body}</div>;
	return (
		<button
			type="button"
			className="turn-header clickable"
			aria-expanded={expanded}
			title={expanded ? "收起过程" : "展开过程"}
			onClick={onToggle}
		>
			{body}
		</button>
	);
}

/* ── 本轮指标读数（token / 缓存命中） ─────────────────────────────── */

/**
 * 本轮指标读数（spec: surface-run-metrics-in-chat Task 4.1）。渲染在助手消息的
 * 操作条内、与复制/重试同排 —— 对齐 WorkBuddy 把 credit/model 放在回答尾部读数的位置；
 * 原先贴在输入卡下方，观感是「系统状态/调试读数」，与本轮的归属关系看不出来。
 *
 * 数据全部由 UI 层折叠（turn-metrics.ts 的 foldTurnMetrics），不新增 IPC / 事件。
 * token 与命中率「有数据才显示」—— 缺字段整项省略，不填 0：上游没上报与真的没用
 * 是两回事，显示 0 会把前者误导成后者。同理**一项都没有时整条不渲染**（本轮没有任何
 * usage 字段的轮）：空读数条只是操作条尾部的一段无内容间距，读起来像「这里本来有东西
 * 没加载出来」。判据在 metricItems，与操作条自身的空态守卫同源（见 AssistantActions）。
 * 语义克制：纯读数，不可点、无弹层（详情浮层不在本次范围）。
 *
 * **不再显示「用时」**（2026-09-15 订正）：它与回合头的「已完成 Ns」同源同值，同一轮的
 * 时长在头尾各出现一次是纯噪音；WorkBuddy 的操作条里也没有时长（只有成本 + 模型名）。
 * spec: surface-run-metrics-in-chat 的「用时必显」随之作废，见该 spec 的订正注。
 * 连带去掉每 500ms 的走表 —— 那个 interval 的唯一用途就是刷新这个用时读数，摘掉读数后
 * 它只会让整条操作条白重渲染。
 *
 * 读数段**常驻**，不跟 WorkBuddy 走 hover：WB 应用层确实把成本段藏到 hover 才现
 * （lib-chat-ui-Co_VI_pZ.css:1828 的 `.group-messages:has(.cb-assistant-message:hover)
 * .cb-credit-usage-text--feedback { opacity: 1 }`，与同处的 .cb-message-time-tip 同款；
 * 而复制/赞踩/重试那排按钮是常驻的）。不跟的理由是两者的「行数」不同：WB 的成本段
 * 挂在**每一个** request 的末条消息上，长会话里就是每轮一行，藏起来才合理；我们的
 * 数据源只 fold **当前轮**（turn-metrics.ts 口径），全程只可能出现一处，藏起来等于
 * 把「指标归位」又抹掉。
 * （2026-09-15：原先「它的值随本轮各步 assistant_done 递增，不是 WB 那种事后定值」
 * 这条理由随渲染时机收口而作废 —— 操作条只在轮结束后挂上，读数到那时就是终值。）
 * 若仍要逐字对齐 WB，改动量是两条 CSS（读数段 opacity: 0 + .entry:hover 复原）。
 */

/**
 * 指标条的显示项（WorkBuddy 三个读数的排法：↑输入 · ↓输出 · 命中率）。
 *
 * 单独提出来是为了让「有没有东西可显示」只有一份判据：读数条自己按项为空不渲染，
 * 操作条的空态守卫也要问同一个问题 —— 只按 metrics 这个 prop 在不在判，会漏掉
 * 「挂了 metrics 但本轮一个 usage 字段都没上报」那条路径，那一下就空出一条白盒。
 * foldTurnMetrics 的签名仍要 now（它同时算 elapsedMs），传渲染时刻即可：剩下的读数与 now 无关。
 *
 * `↑` 取的是 **prompt 侧三桶之和**（billedInputTokens，含缓存读/写），不是「未缓存输入」
 * —— 与命中率同分母、与诊断面板单步行/底栏会话条同口径（理由钉在 turn-metrics.ts
 * 的 TurnMetrics.billedInputTokens 注释里，别改回去）。
 */
function metricItems(entries: readonly ConversationEntry[], turn: TurnTiming): readonly string[] {
	const metrics = foldTurnMetrics(entries, turn, Date.now());
	const items: string[] = [];
	if (metrics.billedInputTokens !== undefined)
		items.push(`↑${formatTokenCount(metrics.billedInputTokens)}`);
	if (metrics.outputTokens !== undefined) items.push(`↓${formatTokenCount(metrics.outputTokens)}`);
	if (metrics.hitRate !== undefined) items.push(`命中 ${Math.round(metrics.hitRate * 100)}%`);
	return items;
}

function RunMetricsBar({ items }: { readonly items: readonly string[] }): React.JSX.Element {
	return (
		<div className="run-metrics">
			{items.map((text, index) => (
				// 分隔符是纯装饰（aria-hidden），随项插入 —— 首项前不出中点。
				<Fragment key={index}>
					{index > 0 && (
						<span className="run-metrics-sep" aria-hidden="true">
							·
						</span>
					)}
					<span>{text}</span>
				</Fragment>
			))}
		</div>
	);
}

/* ── 专家起手 chips（quickPrompts） ──────────────────────────────── */

/**
 * 选中专家后输入区上方的 3 个起手问题 chips（spec: 专家体系对齐 Task 3.2，
 * 机制对标 WorkBuddy 专家会话的引导问题条）。
 *
 * 显隐口径：父组件只在「有专家命中 + 本会话还没有任何 user 消息」时挂载本组件；
 * 本组件自持「点过即隐藏」（dismissed）。切换专家重显靠父组件以 expert name
 * 作 key 重挂载 —— dismissed 随旧专家卸载，新专家从干净状态开始。
 */
function QuickPromptChips({
	prompts,
	onPick,
}: {
	readonly prompts: readonly string[];
	/** 点击 chip：文本进输入框（不发送），chips 随即隐藏。 */
	readonly onPick: (text: string) => void;
}): React.JSX.Element | null {
	const [dismissed, setDismissed] = useState(false);
	if (dismissed) return null;
	return (
		<div className="quick-prompts">
			{prompts.map((prompt) => (
				<button
					key={prompt}
					type="button"
					className="quick-prompt-chip"
					title={prompt}
					onClick={() => {
						setDismissed(true);
						onPick(prompt);
					}}
				>
					{prompt}
				</button>
			))}
		</div>
	);
}

/* ── 交互模式切换 ────────────────────────────────────────────────── */

interface ModeSwitchProps {
	readonly interactions: readonly ModeDescriptor[];
	readonly currentId: string;
	readonly onChange: (id: string) => void;
	readonly onTodo: (feature: string) => void;
}

/** 交互轴切换（ask / craft / plan），对标 WorkBuddy 的 interactionmode。 */
function ModeSwitch({
	interactions,
	currentId,
	onChange,
	onTodo,
}: ModeSwitchProps): React.JSX.Element {
	const [open, setOpen] = useState(false);
	const current = interactions.find((m) => m.id === currentId);

	// Esc 关闭弹层：菜单以 mousedown 外无键盘焦点管理，Esc 是键盘用户唯一的关闭路径
	//（与 PlusMenu 的 backdrop 互补：一个管指针，一个管键盘）。
	useEffect(() => {
		if (!open) return;
		const onKey = (event: KeyboardEvent): void => {
			if (event.key === "Escape") setOpen(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open]);

	// 交互模式切换器只有 ask / craft / plan 三档（专家已不是交互模式，而是与
	// 模式正交的会话绑定，spec: rework-expert-orthogonal-and-skills）——
	// 直接平铺 availableModes；专家选择入口统一为「+」菜单专家子菜单与专家页
	//（spec: rework-expert-center-and-chip，头部不再有专家入口）。
	return (
		<div className="menu-zone">
			<button
				type="button"
				className="bar-btn bar-btn-text"
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={() => setOpen((v) => !v)}
			>
				{/* 模式清单未到位（availableModes 仍是快照前存的空数组）时不给裸 id：
				    `craft` 是内部标识，用户既看不懂，它也不是「当前模式」的名字。
				    行内转圈与其它行内加载位同款，等清单到位后自然换成 label。 */}
				{current === undefined ? <Spinner size={11} /> : current.label}
				<IconChevronDown size={13} />
			</button>
			{open && (
				<>
					{/* 透明 backdrop：点菜单外任意处关闭，与 PlusMenu/PermissionMenu 一致。 */}
					<button type="button" className="ws-backdrop" aria-label="关闭" onClick={() => setOpen(false)} />
					<div className="pop-menu mode-menu" role="menu">
						{interactions.map((mode) => (
							<button
								key={mode.id}
								type="button"
								className={`mode-menu-item${mode.id === currentId ? " active" : ""}`}
								role="menuitem"
								onClick={() => {
									setOpen(false);
									// 未实现的模式仍然列出（对齐 WorkBuddy 的能力面），
									// 但点击给 toast 反馈，而不是发出去让 daemon 报错。
									if (mode.ready) onChange(mode.id);
									else onTodo(`「${mode.label}」模式`);
								}}
							>
								<span className="mode-menu-label">
									{mode.label}
									{!mode.ready && <span className="mode-menu-tag">待做</span>}
								</span>
								<span className="mode-menu-desc">{mode.description}</span>
							</button>
						))}
					</div>
				</>
			)}
		</div>
	);
}

/* ── 保存到工作空间（命名弹层） ──────────────────────────────────── */

/**
 * 临时任务转正的命名弹层。
 *
 * 命名即把该任务的自动目录**重命名**为空间名（daemon 在同根下 rename，产物与
 * `.kamibuddy/` 记忆随目录一起过去），所以名称校验的权威在 daemon（兄弟目录/空间组
 * 的知识只在那边）——renderer 不另写一份规则，两份必漂移（AGENTS.md §4）。
 * 错误串原位透出（含 rename 被占用等失败原因，daemon 给什么显示什么，不另建提示链路）。
 * 中文名选词确认的 Enter 不能误提交，IME 守卫与输入框同一份接线（ime-guard.ts）。
 */
function SaveToWorkspaceDialog({
	onSave,
	onClose,
}: {
	/** resolve = 转正完成（弹层随之关闭）；reject 的 message 原位透出。 */
	readonly onSave: (name: string) => Promise<void>;
	/** 取消与成功共用同一个关法：成功后弹层没有留着的意义。 */
	readonly onClose: () => void;
}): React.JSX.Element {
	const [name, setName] = useState("");
	const [error, setError] = useState<string | undefined>(undefined);
	const [submitting, setSubmitting] = useState(false);
	const ime = useImeGuard();

	/*
	 * 焦点陷阱 / 归还 / 背景 inert 由共享 hook 负责。
	 * 输入框的「自动聚焦」不再用 autoFocus：React 的 ref 与 autoFocus 都在 layout 阶段按
	 * **子先父后**的次序提交，autoFocus 会赶在卡片的 callback ref 之前把焦点拿走，于是 hook
	 * 记下的「打开它的元素」变成了这个输入框本身 —— 关弹层时它已被摘掉，焦点归还就失效。
	 * hook 的默认落点（容器内首个可聚焦元素）正是这个输入框，用户看到的效果不变。
	 */
	const cardRef = useModalFocus();

	const submit = (): void => {
		const trimmed = name.trim();
		if (trimmed === "" || submitting) return;
		setSubmitting(true);
		setError(undefined);
		onSave(trimmed).then(
			() => onClose(),
			(saveError: unknown) => {
				setError(saveError instanceof Error ? saveError.message : String(saveError));
				setSubmitting(false);
			},
		);
	};

	// Esc 关闭（提交中不关：daemon 正在切换会话，弹层关了用户无从知道结果）。
	useEffect(() => {
		const onKey = (event: KeyboardEvent): void => {
			if (event.key === "Escape" && !submitting) onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose, submitting]);

	return (
		<div className="modal-backdrop">
			<div className="save-space-card" role="dialog" aria-modal="true" aria-label="保存到工作空间" ref={cardRef}>
				<p className="save-space-title">保存到工作空间</p>
				<p className="save-space-desc">
					会把当前任务的目录重命名为这个空间名，目录里的产物与记忆一起跟过去；
					之后的对话也归到这个空间，随时可以从侧栏回来。
				</p>
				<input
					className="save-space-input"
					value={name}
					// 弹层里唯一的输入框，自动聚焦即预期（同侧栏重命名行）；
					// 由 useModalFocus 的默认落点承接，故这里不再写 autoFocus（理由见上方注释）。
					placeholder="空间名称"
					aria-label="空间名称"
					disabled={submitting}
					onChange={(e) => {
						setName(e.target.value);
						// 输入变了旧的错误就失效：留着会让用户以为新名字也有同样问题。
						setError(undefined);
					}}
					onCompositionStart={ime.bind.onCompositionStart}
					onCompositionEnd={ime.bind.onCompositionEnd}
					onKeyDown={(e) => {
						if (e.key !== "Enter" || e.defaultPrevented) return;
						e.preventDefault();
						if (ime.shouldSwallowNow()) return;
						submit();
					}}
				/>
				{error !== undefined && <ErrorState message={error} />}
				<div className="save-space-actions">
					<button type="button" className="mini-btn" disabled={submitting} onClick={onClose}>
						取消
					</button>
					<button
						type="button"
						className="primary-btn"
						disabled={submitting || name.trim() === ""}
						onClick={submit}
					>
						保存
					</button>
				</div>
			</div>
		</div>
	);
}

/* ── 主体 ────────────────────────────────────────────────────────── */

/** 距底多少像素内算「在底部」：覆盖子像素与平滑滚动的末段抖动。 */
const BOTTOM_THRESHOLD_PX = 40;

export function ChatView({
	conversation,
	ready,
	lastError,
	title,
	onBack,
	onSubmit,
	onAbort,
	onQueueRewrite,
	onInteractionChange,
	experts,
	onSelectExpert,
	onOpenExperts,
	onOpenSkills,
	onOpenConnectors,
	prefill,
	onPrefillConsumed,
	onPreviewArtifact,
	onPathClick,
	onOpenPanelGroup,
	onOpenSources,
	onOpenSettings,
	onError,
	onSaveToWorkspace,
	branchAvailable,
	onRestartFrom,
	onBranchFrom,
	onTodo,
	pendingQuestionnaire,
	onQuestionnaireSubmit,
	onQuestionnaireSkip,
	turnFoldCache,
	memberView,
	onFocusMember,
	onBackToLeader,
}: ChatViewProps): React.JSX.Element {
	// 等待 tips 的「× 关闭」：会话级（本组件存活期内）承诺，跨回合不复活。
	const [tipsDismissed, setTipsDismissed] = useState(false);
	// 「保存到工作空间」命名弹层的开合；输入态由弹层组件自持（关掉即重置）。
	const [saveOpen, setSaveOpen] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	// 「+」菜单的「添加文件」要打开 Composer 内部附件状态的选择框（命令式动作，经 ref 句柄触发）。
	const composerRef = useRef<ComposerHandle>(null);
	/*
	 * 预填消费（专家市场页 quickPrompt：点「专家帮你做」= 带该问题启用）。
	 * 文本进输入框待发送、不直接发送（与起手 chips 同口径：用户可能还要补两句），
	 * 填入后立即通知 App 清空 —— 留在 App state 里的话，往返首页再回来会再填一遍。
	 */
	useEffect(() => {
		if (prefill === undefined) return;
		composerRef.current?.fillText(prefill);
		onPrefillConsumed();
	}, [prefill, onPrefillConsumed]);
	/*
	 * 个性化两个 UI 开关（加载欢迎语 / 展示变更过程详情）：组件内 effect 直读
	 * 一次（与 vision-hint / model-menu 同路径 —— 这两个键不在 settingsSnapshot、
	 * App 层无下发）。读取失败静默按契约缺省 true：问候与详情都是增强，读不到
	 * 偏好不该把等待行/工具卡搞坏。disposed 守卫防 StrictMode 双跑回写。
	 */
	const [personalization, setPersonalization] = useState<{ welcomeGreeting: boolean; showChangeDetails: boolean }>({
		welcomeGreeting: true,
		showChangeDetails: true,
	});
	useEffect(() => {
		let disposed = false;
		window.kami
			.getPersonalization()
			.then((info) => {
				if (!disposed) {
					setPersonalization({
						welcomeGreeting: info.welcomeGreeting,
						showChangeDetails: info.showChangeDetails,
					});
				}
			})
			.catch(() => {
				/* 缺省 true 兜底，见上注释 */
			});
		return () => {
			disposed = true;
		};
	}, []);
	/*
	 * 内容列宽随容器动态计算（WorkBuddy use-dynamic-chat-content-width 同款）：
	 * 固定 832 在宽屏两侧留白过多。ResizeObserver 挂一次（空依赖），
	 * 列宽经 CSS 变量传给 .stream / .chat-composer 的 max-width。
	 */
	const chatRef = useRef<HTMLElement>(null);
	const [contentWidth, setContentWidth] = useState(832);
	useEffect(() => {
		const el = chatRef.current;
		if (el === null) return;
		const update = (width: number): void => {
			const next = Math.round(computeChatContentWidth(width));
			setContentWidth((cur) => (cur === next ? cur : next));
		};
		update(el.getBoundingClientRect().width);
		const observer = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width;
			if (typeof width === "number") update(width);
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, []);
	const streaming = conversation.state.isStreaming;
	const sessionId = conversation.state.sessionId;
	/**
	 * 排队 chips 的行数据：steering 在前（先被消费）、followUp 在后。
	 * `rest` 是摘掉本条后的剩余队列 —— 删除/编辑都走它（session:queue-rewrite）。
	 * `kind` 决定「立即插入」是否出现：steering 的条目本来就在插，不重复给入口。
	 * 在这里先窄化 `queued`，回调里就不用 `!`（窄化穿不过 useCallback 闭包）。
	 */
	const queued = conversation.queued;
	// 最近一张 team 卡的成员（spec: add-team-foundations 批 8）：
	// @补全候选与成员聚焦导航的共用数据源。旧格式会话 / 无团队 → 空。
	const teamMembers = useMemo(
		() => latestTeamMembers(conversation.entries) ?? [],
		[conversation.entries],
	);
	const memberItems = useMemo(
		() =>
			teamMembers
				.filter((m) => m.sessionId !== undefined)
				.map((m) => ({
					label: `@${m.agent}`,
					insert: `@${m.agent} `,
					hint: `团队成员 · ${m.status === "running" ? "工作中" : m.status === "queued" ? "启动中" : m.status === "done" ? "已完成" : m.status === "failed" ? "失败" : "就绪"}`,
				})),
		[teamMembers],
	);
	const queuedItems = useMemo(
		() =>
			queued === undefined
				? []
				: [
					...queued.steering.map((text) => ({ text, kind: "steering" as const })),
					...queued.followUp.map((text) => ({ text, kind: "followUp" as const })),
				].map(({ text, kind }) => ({
					text,
					kind,
					rest: removeQueuedMessage(queued, text),
					insertNow: insertQueuedNow(queued, text),
				})),
		[queued],
	);
	// 当前专家（绑定专家才有值，与交互模式正交）：composer-bar chip、起手 chips
	// 与「+」菜单勾选共用这份查找。expertId 是 session_state 的权威值，列表只是
	// 展示映射；列表尚未拉回（undefined）/专家被删时 chip 与起手 chips 不渲染
	//（菜单勾选仍以 expertId 为准）。
	const expertId = conversation.state.expertId;
	const currentExpert = expertId === undefined ? undefined : experts?.find((e) => e.name === expertId);
	// 产物清单：present_files 交付折叠而来（唯一来源，不再从 write 推导）。
	const artifacts = conversation.artifacts;
	// 段/组折叠条（顶层工具组、「过程消息」段、折叠段内的工具批）的展开状态：按
	// 段 id 记忆。折叠计划每次渲染由纯函数重算（fold-view.ts），状态必须留在组件层，
	// 否则随计划重建丢失。id 由条目 id 派生（toolCallId 全局唯一，不含下标），流式
	// 增量只改批次内容不改 id —— 手点展开态因此不被刷新重置；新轮的 id 全新，
	// 天然回到默认收起。跨会话残留只是死键，无害。
	const [foldOpen, setFoldOpen] = useState<ReadonlyMap<string, boolean>>(new Map());
	// 渲染轮视图：先过 todo_write 聚合投影（todo-projection.ts）：多次调用
	// 折叠成一张合成清单卡（最新全量、钉在首次出现处）。渲染侧一切消费方
	// （轮视图/刻度轨/状态行/滚动跟随）统一看投影后的视图 —— 刻度轨只测量
	// user 消息，投影从不动 user 条目（同引用同序），测量口径不受影响。
	// 无 todo 卡时投影返回同一引用；useMemo 让无关重渲染（如折叠开合）
	// 不产出新数组，滚动 effect 的依赖语义与直连 conversation.entries 等价。
	const entries = useMemo(() => projectTodoList(conversation.entries), [conversation.entries]);
	// 引用来源聚合（collect-sources.ts 纯函数）：「来源」按钮的数据源。
	// 与消息流同看投影后的 entries —— todo 投影从不动 web_search 卡，
	// 聚合口径与 App 侧 SourcesPanel（直连 conversation.entries）一致。
	const sources = useMemo(() => collectSources(entries), [entries]);
	// 变更数：操作行出现条件「产物/变更/来源任一非空」的变更一臂
	// （与面板共用 shared/artifacts.ts 的 collectChanges，不各写一份口径）。
	const changeCount = useMemo(() => collectChanges(entries).length, [entries]);
	// 轮视图 = 切轮 + 轮终态推导 + 逐轮 fold plan（turn-fold.ts / fold-view.ts
	// 纯函数，线性轻量）；useMemo 让折叠开合等无关重渲染不重算计划。
	const turnViews = useMemo(
		() => buildTurnViews(entries, { streaming, cancelledTurns: conversation.cancelledTurns }),
		[entries, streaming, conversation.cancelledTurns],
	);
	// 最后一个 user 消息：当前回合的分界（回合头部走表的唯一依据）。
	// 边界取自 shared 的唯一实现处（shared/conversation.ts 的 lastUserEntryIndex），
	// 不在本文件再写一遍 findLast —— 页脚 fold 与回合切分必须同边界（AGENTS.md §4）。
	// 反查要扫到「最后一个 user」为止（长会话末尾常是一串工具卡），按 [entries] memo，
	// 与消息流无关的重渲染（折叠开合、面板交互）不再重扫。
	const lastUserEntry = useMemo(() => {
		const index = lastUserEntryIndex(entries);
		return index === -1 ? undefined : entries[index];
	}, [entries]);
	const lastUserId = lastUserEntry?.id;
	/*
		用户消息锚点表（序号 + 可回填/可重发的原文，见 branch-target.ts 纯函数）：
		用户气泡的两个分支入口与「重试」共用这一份 —— 序号口径与技能回拼都只写一次
		（AGENTS.md §4）。按 [entries] memo：流式期间每个 delta 都会重渲染，
		若让每条气泡各自扫一遍 entries 数序号，就是 O(n²)。
	*/
	const branchTargets = useMemo(() => branchTargetsOf(entries), [entries]);
	/*
		分支入口的可用性（spec: add-session-branching「分支操作的前置条件」）：
		流式期间 daemon 会以 busy 拒绝（run 在互斥链上占整段，排进去等于静默吞掉这次点击），
		会话尚未落盘时连锚点都解析不了 —— 两种情况都不给入口。
		用户气泡的两个入口与助手侧「重试」合流到这一个判定（重试同样要先回退）。
	*/
	const branchReady = branchAvailable && !streaming;
	/*
		重试要重发的是**用户打过的话**，不是气泡里那块展示文本。
		技能消息的 text 只剩补充文本（技能块已在翻译层剥掉，见 shared/skill-block.ts），
		直接拿 text 重发会把技能丢掉 —— 用户看到的「重试」结果和上一条不是同一个请求。
		回拼 `/skill:<name> …` 的活儿收在 branch-target.ts（与两个分支入口同一份口径），
		这里只取「最后一条用户消息」的锚点。
	*/
	const retryTarget = lastUserId === undefined ? undefined : branchTargets.get(lastUserId);
	const retryText = retryTarget?.text;
	// 起手 chips「发送一条后消失」的判定：entries 里有无 user 消息（权威口径，
	// 恢复历史会话也正确 —— 有历史的会话 chips 本就不该再出现）。
	const hasUserMessage = lastUserEntry !== undefined;
	/*
		指标条数据源（spec: surface-run-metrics-in-chat Task 4.1）：按最后一条 user
		消息 id 查回合计时映射，得到该轮完整计时。切会话自然跟着换。查不到就不渲染
		（不给空壳）—— 只读读数宁可缺席，也不该显示没有依据的 0。
		不再有「流式中读 conversation.turn（实时计时）」的分支：操作条只在轮结束后
		渲染（见下面的 actionsAnchorIds），流式期的在跑计时没有消费方；run_finished /
		run_error 会把停表结果写进映射，所以轮一结束就查得到（2026-09-15 收口）。
	*/
	const metricsTurn = lastUserId === undefined ? undefined : conversation.turnTimings?.[lastUserId];
	/*
		操作条尾部读数（指标 / 模型名）与「重试」的挂点：**当前回合的最后一条
		assistant 消息**（最后一条 user 之后那一段里的最后一条 assistant），与
		WorkBuddy 把 credit 挂在 isLastMessageOfRequest 上同口径。

		为什么按「最后一条 user 之后」而不是「最后一条 assistant」：等待首响应时
		本轮还没有 assistant，直接取 findLast(assistant) 会挂到**上一轮**的回答上，
		却显示本轮的计时 —— 错位比缺席更糟。三条读数共享同一挂点，不会出现
		「指标在 A 条、模型名在 B 条」的错配。
	*/
	const metricsAnchorId = useMemo(() => {
		const lastUserIndex = lastUserEntryIndex(entries);
		const lastAssistantIndex = entries.findLastIndex((e) => e.role === "assistant");
		if (lastAssistantIndex <= lastUserIndex) return undefined;
		return entries[lastAssistantIndex]?.id;
	}, [entries]);
	/*
		操作条本体的挂点：**每一轮**的末条 assistant 消息，且该轮已结束
		（per-turn 判定在 turn-fold 的 buildTurnViews，WorkBuddy 的 assistant-feedback
		同口径 —— 只有 request 末条 assistant 消息才有这根条）。

		为什么不再每条 assistant 条目都挂：entry 粒度很细，一个「深度思考」段、一段
		过程说明、一张工具卡各自就是一条条目。操作条原本挂在每一条 assistant 条目上
		（那时 hover 才显，不显眼），上一轮把它改成常驻（对齐 WorkBuddy）之后，每段
		过程下面就都露出一个孤零零的复制图标，一轮里重复出现多次 —— 常驻是显隐口径，
		不该顺带把挂载粒度也放大。

		中间条目**完全不挂**，不保留 hover 版：hover 版要常驻 DOM 才不抖布局
		（用户气泡那套绝对定位），藏在每条过程消息里等于把观感问题原样留着 ——
		划过时照旧闪出一个复制钮，只是平时看不见；而过程内容本身可选中复制，
		回答级的操作条一轮一条才读得懂（WorkBuddy 也是直接不渲染，而非藏起来）。

		这里的值与 metricsAnchorId 同一挂点：当前轮结束时的 actionsAnchorId 就是
		metricsAnchorId（末条 user 之后的那条末条 assistant），所以操作条与指标条／
		模型名／重试永远在同一行出现；历史轮只带复制（指标与重试说的是本轮，
		挂到历史轮上就是错值）。
	*/
	const actionsAnchorIds = useMemo(
		() => new Set(turnViews.flatMap((view) => (view.actionsAnchorId === undefined ? [] : [view.actionsAnchorId]))),
		[turnViews],
	);

	/*
		轮折叠开合状态：Map<turnId, expanded>，**缺省 = 折叠** —— run 结束
								（含错误/取消）与历史轮一律默认折叠，不需要任何「折叠写入」；Map 里
								只可能存在手点记录。写路径只有两条（状态机见 turn-fold.ts）：
								手点 toggleTurn；新 run 开始时 collapseAllTurnFolds 全部收回（sticky：
								收回后没有任何自动展开路径，状态抖动不会闪回展开）。
								状态按会话隔离：App 持有的多桶缓存按 sessionId 存取（viewCacheRef
								同款机制），不落盘。
								*/
	const [turnFolds, setTurnFolds] = useState<TurnFoldMap>(
		() => turnFoldCache.current.get(sessionId) ?? EMPTY_TURN_FOLDS,
	);
	const writeTurnFolds = (next: TurnFoldMap): void => {
		turnFoldCache.current.set(sessionId, next);
		setTurnFolds(next);
	};
	/*
		渲染期状态迁移（React「随 props 调整状态」官方模式：同帧重渲染、
		提交前完成，无闪烁，也不需要 effect + ref 镜像）：
		- 切会话 → 换上目标会话的桶（不做折叠迁移，历史轮靠缺省折叠）；
		- 同会话出现新 user 消息（新 run / steer 追问）→ 上一轮连同所有
		  手点展开立即折回。
	*/
	const [foldMigrationKey, setFoldMigrationKey] = useState({ sessionId, lastUserId });
	if (foldMigrationKey.sessionId !== sessionId) {
		setFoldMigrationKey({ sessionId, lastUserId });
		setTurnFolds(turnFoldCache.current.get(sessionId) ?? EMPTY_TURN_FOLDS);
	} else if (lastUserId !== undefined && foldMigrationKey.lastUserId !== lastUserId) {
		setFoldMigrationKey({ sessionId, lastUserId });
		writeTurnFolds(collapseAllTurnFolds(turnFolds));
	}
	// 等待首响应阶段：与 pendingText 返回「等待模型响应…」同口径（末尾是 user 或流为空）。
	// tips 轮播与 8s 安抚文案只在这个阶段计时，「正在写入文件…」等阶段不出现。
	const lastEntry = entries[entries.length - 1];
	const awaitingFirstResponse = streaming && (lastEntry === undefined || lastEntry.role === "user");
	// 等待行文案（pendingText 纯函数，从末尾反查阶段）。按 [entries] memo：流式期间
	// entries 每个 delta 都换引用、仍会重算（这是语义要求），省下的是折叠开合等
	// 无关重渲染；纯函数本身很轻，这处收益有限，列在此处只为口径一致。
	const pendingLabel = useMemo(() => pendingText(entries), [entries]);

	/*
		.stream 的整列 reveal（index.css 的 stream-reveal）只在「从空到有内容」这一次播：
		空会话里第一条消息上屏才算「首次揭示」；带历史返回对话页时 entries 挂载即非空，
		整列 opacity 0→1 + translateY 对一份上万像素的历史是可见的整列上滑，还会为整棵
		子树建合成层（与第 3 期 content-visibility 的性能取向相反）。
		用 render 期比对（而不是 effect 置位）：effect 晚一个 commit，首条消息会先以
		opacity:1 画一帧、再从 0 重播，反而闪一下。口径与上面 foldMigrationKey 的
		「render 期派生」写法一致。
		重置规则：entries 归零（新建/切换会话）时撤回标记，下次从空到有内容时自然会重播。
	*/
	const revealRef = useRef({ count: entries.length, reveal: false });
	if (revealRef.current.count !== entries.length) {
		revealRef.current = { count: entries.length, reveal: revealRef.current.count === 0 && entries.length > 0 };
	}
	const streamReveal = revealRef.current.reveal;

	// 滚动跟随（对标 WorkBuddy）：在底部时新内容自动贴底；用户上滚离开底部
	// 即停止跟随，浮现「回到底部」按钮；回到底部后恢复跟随。
	// 跟随状态走 ref（scroll/effect 里同步读），按钮可见性走 state（要触发渲染）。
	const followRef = useRef(true);
	const [showJumpToBottom, setShowJumpToBottom] = useState(false);
	// 「本会话内新发送」的待吸顶记录（WorkBuddy useFirstMessageAlign 的
	// firstUserMessageAlignPendingRef 同款，机制与出处见 send-anchor.ts 头注）。
	// 走 state 不走 ref：anchor-space 的 min-height 要靠它参与渲染。
	const [pendingAlign, setPendingAlign] = useState<PendingSentAlign | undefined>(undefined);

	/*
		跟随判定只看「测量到的位置」（距底 < 阈值），不看事件来源（wheel/touch/程序）。
									为什么不用「程序滚动中」标记区分：跟随贴底本身就是程序滚动，标记方案要在
									每次程序写 scrollTop 前后维护时序，流式增量下极易漏一拍把跟随误关掉。
									位置是地面真值 —— 程序贴底后测量结果恒为「在底部」，天然不会误判；
									用户上滚离开底部（不管用什么输入设备）测量结果恒为「不在底部」。
									*/
	const handleStreamScroll = (): void => {
		const node = scrollRef.current;
		if (node === null) return;
		const atBottom = node.scrollHeight - node.scrollTop - node.clientHeight < BOTTOM_THRESHOLD_PX;
		followRef.current = atBottom;
		setShowJumpToBottom(!atBottom);
	};

	/*
		用户主动展开折叠头 → 释放贴底跟随（机制对标 WorkBuddy 的
		useNotifyUserExpandToggle → notifyUserExpandToggle，取证见
		docs/WorkBuddy-reference/extracted/renderer/assets/lib-chat-ui-ChIVprRk.js：
		该 hook 由 CollapseRenderer / ToolHeader 在点击 toggle 时调用，宿主侧
		useUserExpandSuppression 把它转成「暂停保持贴底」）。

		为什么必须释放：展开内容是**向下**增长的，而贴底跟随会把下一个流式增量
		重新贴到底 —— 用户刚点开的折叠头会被顶出视口顶（看不到自己点开的东西）。
		释放后视口不动，内容在头的下方长出来（展开体本身有 grid-template-rows
		过渡，观感是「向下顶」而不是「向上推」）。

		只在「展开」方向释放：收起是内容变矮，贴底不会把任何东西顶出去，
		没必要打断用户正在进行的跟随。

		为什么不照 WorkBuddy 再补一个抑制窗口（useUserExpandSuppression 的
		USER_EXPAND_SUPPRESS_MS = 800，配合 shouldResumeBottomFollow 的
		`!isUserExpanding` 挡住「布局增长把跟随重开」）：我们的 followRef
		**没有自动重开闸** —— 只有用户滚到底（handleStreamScroll）、点「回到底部」、
		新发送三处置真 —— 不存在那条路，窗口没有要守的东西。

		按钮可见性按「此刻内容是否真的可滚」判定，而不是无条件显示：内容不足
		一屏时贴底本就是空操作，「回到底部」与底部渐隐层（.stream-fade）在这时
		出现都是假交互。
	*/
	const releaseFollowForExpand = (): void => {
		followRef.current = false;
		const node = scrollRef.current;
		setShowJumpToBottom(node !== null && node.scrollHeight - node.clientHeight > 0);
	};

	/*
		每次 entries 变化的滚动动作由 decideScrollAction 纯函数决定（决策表见
		send-anchor.ts）：本会话新发送的回显上屏 → 吸顶；否则跟随中贴底 /
		上翻中不动（既有语义）。贴底用 scrollHeight 而非 scrollIntoView，
		避免流式增量时抖动；吸顶用 scrollIntoView block:"start"（与 TurnRail
		跳转同口径）。anchor-space 的 min-height 让吸顶位置与贴底位置在内容
		不足一屏时收敛 —— 吸顶后跟随接管不会二次跳动（WorkBuddy 同款数学，
		见 send-anchor.ts 头注）。
		调度时机用 useLayoutEffect 而非 useEffect：这里写 scrollTop 是「补偿布局」，
		必须在内容变高的那一帧**绘制之前**落地。IPC 推来的流式 delta 走的不是离散输入
		事件，被动效果可能排在绘制之后冲刷 —— 那一帧「内容已长高、scrollTop 还是旧值」，
		底部会先空出一截、下一帧再跳回来。同仓 turn-rail.tsx 的测量也是这个口径。
		（只改调度时机：判据与三个分支逻辑一字未动。）
	*/
	useLayoutEffect(() => {
		const node = scrollRef.current;
		if (node === null) return;
		const action = decideScrollAction({
			pending: pendingAlign,
			sessionId,
			lastUserEntryId: lastUserId,
			isFollowing: followRef.current,
		});
		if (action.kind === "align-top") {
			const el = node.querySelector(`[data-entry-id="${CSS.escape(action.entryId)}"]`);
			el?.scrollIntoView({ block: "start" });
			// 吸顶只发一次（WorkBuddy：scrollToIndex 发出后清 pending 标记）。
			// 记录本身保留到 streaming 接管锚定空间（见下方交接 effect）。
			setPendingAlign((current) => (current === undefined ? current : { ...current, aligned: true }));
			return;
		}
		if (action.kind === "stick-bottom") node.scrollTop = node.scrollHeight;
	}, [entries, pendingAlign, sessionId, lastUserId]);

	/*
		锚定空间交接：吸顶发出后，等 streaming 真正开始（或回合已终结）才清掉
		待吸顶记录。记录一清，anchor-space 的 min-height 就只剩 streaming 撑着；
		在「回显已到、run_started 未到」的间隙提前清掉，min-height 掉落会让
		浏览器 clamp 把刚吸顶的位置拉回底部。turn.endedAt 兜住「回合太快、
		streaming:true 没被渲染出来就过去了」的边角。
	*/
	useEffect(() => {
		if (pendingAlign?.aligned !== true) return;
		if (streaming || conversation.turn?.endedAt !== undefined) setPendingAlign(undefined);
	}, [pendingAlign, streaming, conversation.turn]);

	// 切会话后旧的待吸顶作废（decideScrollAction 内部也按 sessionId 忽略它，
	// 这里把状态清掉，anchor-space 不致残留到别的会话）。
	useEffect(() => {
		if (pendingAlign !== undefined && pendingAlign.sessionId !== sessionId) {
			setPendingAlign(undefined);
		}
	}, [pendingAlign, sessionId]);

	// 点「回到底部」：立即恢复跟随 + 平滑滚到底。跟随必须先于滚动恢复 ——
	// 否则平滑动画没走完时新内容到达，底部被推远，动画终点已不在底部。
	const jumpToBottom = (): void => {
		const node = scrollRef.current;
		if (node === null) return;
		followRef.current = true;
		setShowJumpToBottom(false);
		node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
	};

	/**
	 * 会话内新发送的统一入口（Composer 提交 / 错误卡重试 / 执行计划共用）：
	 * 恢复跟随 + 登记待吸顶 —— 新 user 消息回显上屏后由滚动 effect 吸顶，
	 * 回复 streaming 开始后自然转入既有吸底跟随。
	 * 提交被 daemon 拒绝（未选模型等，消息不会上屏）时撤销登记：锚定空间
	 * 不能为一条不存在的消息留着。catch 用对象同一性比对，不清掉后一次
	 * 发送的新登记。
	 */
	const submitWithAnchor = (submit: () => Promise<void>): Promise<void> => {
		followRef.current = true;
		setShowJumpToBottom(false);
		const mine: PendingSentAlign = { sessionId, baselineUserId: lastUserId, aligned: false };
		setPendingAlign(mine);
		const result = submit();
		result.catch(() => {
			setPendingAlign((current) => (current === mine ? undefined : current));
		});
		return result;
	};

	const handleComposerSubmit = (
		text: string,
		images?: readonly ImagePart[],
		whileStreaming?: "steer" | "followUp",
	): Promise<void> => {
		return submitWithAnchor(() => onSubmit(text, images, whileStreaming));
	};

	/**
	 * 用户气泡的「重新开始」：回退到这条消息之前，被放弃的后续由 daemon 抽成分支会话。
	 * 回填输入框在 App 侧完成（成功后原文经 prefill 通道填回，不自动发送）——
	 * 与「分支出新会话」共用一个交接口，两边行为不会各走一路。
	 */
	const restartFrom = (target: BranchTarget): void => {
		void onRestartFrom(target.userIndex, target.text);
	};

	/** 「分支出新会话」：daemon 派生新会话并已切过去，App 跟随切换后把原文填回输入框。 */
	const forkFrom = (target: BranchTarget): void => {
		void onBranchFrom(target.userIndex, target.text);
	};

	/**
	 * 重试 = 就地回退重发（spec 修订 2026-09-17）：先让 daemon 把当前会话回退到最后一条
	 * 用户消息**之前**，成功后再把该原文发一次。**不抽枝**（saveBranch:false）——
	 * 重新生成与分支是两个功能，竞品（TRAE/ChatGPT）的重试都不产生新会话；旧回答
	 * 就地丢弃，想保留就走用户气泡上的「分支出新会话」。
	 *
	 * 原实现是纯重发，历史里留下两条完全相同的用户消息 —— 模型读到的是「用户又问了一遍」，
	 * 语义错误且污染上下文。
	 *
	 * **失败时不发送**：daemon 的拒绝（busy / no-file / write-failed…）意味着会话没动，
	 * 这时再发一次就等于把纯重发那条老路重走一遍。文案由 App 统一提示。
	 * 操作条与错误卡共用本函数（spec：同一个实现，不写第二条分支逻辑）。
	 */
	const retrySubmit = (target: BranchTarget): void => {
		void onRestartFrom(target.userIndex, undefined, { saveBranch: false }).then((ok) => {
			if (!ok) return;
			submitWithAnchor(() => onSubmit(target.text)).catch(() => { });
		});
	};

	/**
	 * 「执行计划」：切回创作模式后以用户消息名义发起执行。
	 *
	 * 切换必须 await 落地后再发：setInteraction 与 prompt 走同一条 INVOKE
	 * 通道但不保证工具面即时生效，不先落地的话执行请求会撞上 plan 的
	 * 只读白名单（写工具调用被 daemon 拒掉）。
	 * 为什么不走 onInteractionChange：它是 fire-and-forget（内部 catch），
	 * 拿不到「切换已生效」的时机。
	 */
	const executePlan = (): void => {
		void window.kami.setInteraction("craft").then(
			() => {
				// 提交失败的原因 App 会落进错误卡（lastError），与手动发送同口径，不重复提示。
				submitWithAnchor(() => onSubmit("计划没问题，就按上面的计划开始执行吧。")).catch(() => { });
			},
			(error: unknown) => onError(error instanceof Error ? error.message : String(error)),
		);
	};

	/*
		段/组折叠头的开合：三个 SegmentFold 用途（顶层工具组、折叠段内的工具批、
		「过程消息」段）共用这一个入口，所以展开时释放贴底跟随也只有一处 ——
		既有折叠头与新组头行为一致，不会出现「有的头释放、有的头不释放」。
	*/
	const toggleFold = (id: string): void => {
		const opening = !(foldOpen.get(id) ?? false);
		if (opening) releaseFollowForExpand();
		setFoldOpen((current) => {
			const next = new Map(current);
			next.set(id, !(current.get(id) ?? false));
			return next;
		});
	};

	/*
		渲染按轮视图（buildTurnViews，WorkBuddy groupedMessages 同构）：
		「本会话新发送的待吸顶」或 streaming 期间，由 user 开启的最后一组挂
		anchor-space 的 min-height —— 内容不足一屏时用户消息才够得到视口顶，
		且吸顶位置与吸底跟随收敛到同一 scrollTop（机制与出处见
		send-anchor.ts 头注）。组边界稳定：老回合的组永不重排，新回合只
		追加新组，卡片展开态等组件内部状态不随分组重建丢失。
	*/
	const anchorSpace = streaming || activePendingAlign(pendingAlign, sessionId) !== undefined;

	/*
		轮折叠头（「已完成 Xs」）同样只在展开方向释放跟随：它把整段过程插在
		自己下方，与组头展开是同一件事（展开内容向下顶）。收起走 writeTurnFolds
		的自动收回路径（新 run 时不经过这里），所以只有手点会触发释放。
	*/
	const toggleTurn = (turnId: string): void => {
		if (!turnFoldExpanded(turnFolds, turnId)) releaseFollowForExpand();
		writeTurnFolds(toggleTurnFold(turnFolds, turnId));
	};

	/*
		单条目渲染：fold plan 的 visible / exempt / anchor 项与折叠段展开体
		共用一个出口（锚点正文与普通正文的渲染毫无区别，差别只在折叠计划
		里的归属）。错误卡/产物卡/内联产物/清单卡只会从豁免路径走到这里
		（fold plan 保证它们不进折叠段），渲染顺序与条目序一致。
	*/
	const renderEntry = (entry: ConversationEntry): React.JSX.Element | null => {
		if (entry.role === "tool") {
			// show_widget 不走通用工具卡：渲染为内联可视化块
			// （sandbox iframe，见 widget-view.tsx）。其余卡片不变。
			if (entry.toolName === "show_widget") {
				return <WidgetView key={entry.id} card={entry} />;
			}
			// todo_write 走清单卡：投影已把多次调用合成一张（todo-projection.ts），
			// 是消息流最新内容时默认展开（活面板），历史位置默认折叠。
			if (entry.toolName === "todo_write") {
				return <TodoListCard key={entry.id} card={entry} defaultOpen={entry.id === lastEntry?.id} />;
			}
			// task / team_create 带子代理投影时走分组活动卡（spec:
			// add-subagent-live-activity + add-team-foundations 批 7/8）；
			// team_create 缺席这里会把活卡降级成普通工具行 —— 成员分组、
			// 实时计数与「查看」入口全部不可见（2026-09-16 用户实测回归）。
			// 无投影的旧会话卡回退普通工具卡（向后兼容）。
			if ((entry.toolName === "task" || entry.toolName === "team_create") && entry.subagents !== undefined) {
				return <TaskAgentCard key={entry.id} card={entry} onFocusMember={onFocusMember} />;
			}
			return <ToolEntry key={entry.id} card={entry} showChangeDetails={personalization.showChangeDetails} />;
		}
		// 用户消息走气泡（at 由 daemon 打点，UI 不自己取时间）。
		if (entry.role === "user") {
			return (
				<UserBubble
					key={entry.id}
					entryId={entry.id}
					text={entry.text}
					at={entry.at}
					images={entry.images}
					skillNames={entry.skillNames}
					target={branchTargets.get(entry.id)}
					branchable={branchReady}
					onRestart={restartFrom}
					onBranch={forkFrom}
				/>
			);
		}
		// artifacts_presented 条目不直接渲染（产物清单已由 reducer 折叠进
		// conversation.artifacts，产物卡在消息流底部统一展示）。
		if (entry.role === "artifacts_presented") {
			return null;
		}
		if (entry.role === "error") {
			return (
				<ErrorCard
					key={entry.id}
					message={entry.message}
					runId={entry.runId}
					at={entry.at}
					modelId={conversation.state.modelId}
					retryText={retryText}
					onRetry={() => {
						if (retryTarget === undefined) return;
						// 重试后旧错误卡保留为历史；先回退到最后一条用户消息之前再重发。
						retrySubmit(retryTarget);
					}}
				/>
			);
		}
		return (
			<div key={entry.id} data-entry-id={entry.id} className={`entry ${entry.role}`}>
				{/*
					thinking 的流式判定：该条是 entries 末尾的助手消息且会话在流式。
					assistant_done 后它不再是末尾（后续工具卡/新消息接上来）或
					isStreaming 翻 false，扫光与自动展开同时停止。
				*/}
				{entry.thinking !== undefined && (
					<ThinkingBlock
						text={entry.thinking}
						streaming={streaming && entry.id === lastEntry?.id}
					/>
				)}
				{/* 走到这里的只剩助手消息（user/tool/error 在上面已分流），走 Markdown 渲染。 */}
				<Markdown
					text={entry.text}
					cwd={conversation.state.cwd}
					onPathClick={onPathClick}
				/>
				{/*
					操作条只挂在本轮的挂点消息上（actionsAnchorIds）—— 一轮一条，且
					该轮必须已结束。过程条目（思考段、过程说明）不挂：每条都挂就是
					「每段过程下面一个孤立的复制图标」，理由见 actionsAnchorIds 的注释。
					「执行计划」只钉在 plan 模式、非流式的末条 assistant 消息上：
					流式中计划可能还没写完，历史消息上的计划已被后续对话淹没。
					分支/重试/指标/模型名再收紧一层，只在本轮挂点（metricsAnchorId）上：
					分支与重试回退的都是本轮的起点（最后一条用户消息），挂到历史轮就是
					错的；指标只 fold 当前轮、模型名也只在本轮成立，散到每条消息上就是
					同一串读数重复或干脆是错值。
				*/}
				{actionsAnchorIds.has(entry.id) && (
					<AssistantActions
						text={entry.text}
						modelId={entry.id === metricsAnchorId ? conversation.state.modelId : undefined}
						showExecutePlan={conversation.state.interactionId === "plan" && !streaming && entry.id === lastEntry?.id}
						onExecutePlan={executePlan}
						showBranch={branchReady && entry.id === metricsAnchorId && retryTarget !== undefined}
						onBranch={() => {
							if (retryTarget === undefined) return;
							forkFrom(retryTarget);
						}}
						showRetry={branchReady && entry.id === metricsAnchorId && retryTarget !== undefined}
						onRetry={() => {
							if (retryTarget === undefined) return;
							retrySubmit(retryTarget);
						}}
						metrics={
							entry.id === metricsAnchorId && metricsTurn !== undefined
								? { entries, turn: metricsTurn }
								: undefined
						}
					/>
				)}
			</div>
		);
	};

	/*
		折叠段的展开体：段内再过一遍 groupToolBatches —— 连续 ≥2 的工具批收
		成摘要条（夹在批内的思考块随批展开），孤立单卡与过程文本原位平铺。
		批条的开合状态按段 id 记在 foldOpen（折叠计划是纯函数重算，状态不能
		挂在会重建的组件上）。
	*/
	const renderSegmentEntries = (segmentEntries: readonly ConversationEntry[]): (React.JSX.Element | null)[] =>
		groupToolBatches(segmentEntries).map((item) =>
			item.kind === "batch" ? (
				<SegmentFold
					key={item.id}
					leadName={item.leadName}
					label={item.summary}
					open={foldOpen.get(item.id) ?? false}
					onToggle={() => toggleFold(item.id)}
				>
					{item.entries.map(renderEntry)}
				</SegmentFold>
			) : (
				renderEntry(item.entry)
			),
		);

	/*
		fold plan 单项渲染：
		- anchor / visible / exempt → renderEntry 原位（锚点常显；豁免的产物/
		  错误/内联卡位置不动）；
		- tool-group → 进行中轮的顶层工具组：它已经是 batch 的内容（groupToolBatches
		  产出），直接铺开条目，**不再过 renderSegmentEntries**（那会再套一层组头）；
		- turn-folded → 「已完成 Xs」轮折叠区：头部展开时才渲染（前缀轮没有
		  头部可点，内容直接铺开，段内工具批仍是摘要条）；
		- process-fold → 锚点之间/之后的过程段，恒渲染为「过程消息」折叠条。
	*/
	const renderPlanItem = (view: TurnView, item: FoldPlanItem): React.JSX.Element | null => {
		switch (item.kind) {
			case "visible":
			case "exempt":
			case "anchor":
				return renderEntry(item.entry);
			case "tool-group":
				/*
					复用同一张 SegmentFold 外壳与同一份 foldOpen 状态（不新建折叠层）。
					open 缺省即收起：组里只可能存「用户手点展开」的记录，组 id 由首卡 id
					派生（流式增量不改 id），所以手点展开在组的生命周期内不会被刷新重置；
					轮结束转 folded 计划后同一批仍是同一 id，展开态随之延续。展开体里
					条目原位渲染——批内夹着的思考块随组展开。
				*/
				return (
					<SegmentFold
						key={item.id}
						leadName={item.leadName}
						label={item.summary}
						open={foldOpen.get(item.id) ?? false}
						onToggle={() => toggleFold(item.id)}
					>
						{item.entries.map(renderEntry)}
					</SegmentFold>
				);
			case "turn-folded": {
				const open = view.turnId === undefined ? true : turnFoldExpanded(turnFolds, view.turnId);
				if (!open) return null;
				return <Fragment key={item.id}>{renderSegmentEntries(item.entries)}</Fragment>;
			}
			case "process-fold": {
				const cards = item.entries.filter((e): e is ToolCard => e.role === "tool");
				return (
					<SegmentFold
						key={item.id}
						leadName={cards.length > 0 ? leadToolName(cards) : undefined}
						label="过程消息"
						open={foldOpen.get(item.id) ?? false}
						onToggle={() => toggleFold(item.id)}
					>
						{renderSegmentEntries(item.entries)}
					</SegmentFold>
				);
			}
		}
	};

	/*
		消息流尾部（流式状态行 / 产物区 / 提交错误卡）：渲染在最后一组之内 ——
		与 WorkBuddy 的组内 footer 同位。锚定空间生效期间，回显的用户消息与
		等待状态行在同一组里，吸顶后「等待模型响应…」就出现在消息下方视野内。
	*/
	const streamTail = (
		<>
			{/*
				重试行位序在等待行之上：它是进行中最具体的信息（第几次、何时再来、
				为什么），欢迎语/tips 是泛化的陪伴。重试清态后自然回落正常等待行。
			*/}
			{streaming && conversation.retry !== undefined && <RetryPendingLine retry={conversation.retry} />}
			{/*
				压缩行位序（spec: surface-run-metrics-in-chat Task 4.4）：重试行（异常态，
				信息最具体）> 压缩行（当前的进行中动作）> 等待/通用进行中行。三者互斥只出
				一条，不叠加。压缩期间模型在写摘要、不在「等待响应」，所以压制下面的等待
				行；重试是异常自愈，优先级更高。压缩行不 gate 在 streaming 上 —— 空闲手动
				压缩（streaming 为 false）也要可见。
			*/}
			{conversation.compacting !== undefined && !(streaming && conversation.retry !== undefined) && (
				<CompactionPendingLine reason={conversation.compacting.reason} />
			)}
			{/*
				状态行只在流式期间存在，主文案恒定扫光（全局唯一「进行中」语言）。
				等待首响应阶段（最后一条 entry 是 user）升级为 WaitingPendingLine：
				4s 出 tips、8s 切安抚文案；其余阶段维持单行扫光。
			*/}
			{streaming &&
				conversation.retry === undefined &&
				conversation.compacting === undefined &&
				(awaitingFirstResponse ? (
					<WaitingPendingLine dismissed={tipsDismissed} onDismiss={() => setTipsDismissed(true)} welcomeGreeting={personalization.welcomeGreeting} />
				) : (
					<div className="stream-pending">
						<span className="text-shimmer">{pendingLabel}</span>
					</div>
				))}
			{/* 排队消息的可见反馈移到了输入卡上方（排队 chips，见 footer）——
			    消息离输入行为越近，用户越容易确认「发出去的东西在哪」。 */}
			{/*
			产物卡片区：present_files 交付的文件（文件名 + 大小，对齐
			WorkBuddy 的 snake.html 7.3 KB 卡片）。流式期间不显示 ——
			交付一般发生在收尾，且流式中面板已被自动打开。
			底部操作行的出现条件是「产物/变更/来源任一非空」
			（spec: add-search-sources-panel）：调研类任务常只有来源、
			没有任何交付文件，行不能随产物缺席而整体消失。
		*/}
			{!streaming && (artifacts.length > 0 || changeCount > 0 || sources.length > 0) && (
				<section className="artifacts">
					{artifacts.length > 0 && (
						<>
							<header className="artifacts-header">产物（{artifacts.length}）</header>
							<div className="artifacts-grid">
								{artifacts.map((a) => {
									const isUrl = /^https?:\/\//i.test(a.path);
									const isHtml = /\.html?$/i.test(a.path);
									return (
										<div key={a.path} className="artifact-card-wrap">
											<button
												type="button"
												className="artifact-card"
												title={isUrl ? `${a.path}（外部打开）` : `${a.path}（点击预览）`}
												onClick={() => onPreviewArtifact(a.path)}
											>
												<IconDoc size={16} />
												<span className="artifact-name">{a.path.split(/[\\/]/).pop()}</span>
												{a.size > 0 && <span className="artifact-size">{formatSize(a.size)}</span>}
											</button>
											{isHtml && !isUrl && (
												// button 里不许再嵌 button（非法嵌套交互）：独立成卡片兄弟节点，
												// CSS 绝对定位回右上角原位，视觉与嵌套时一致。
												<button
													type="button"
													className="artifact-preview-btn"
													aria-label="在预览面板打开"
													title="在预览面板打开"
													onClick={() => onPreviewArtifact(a.path)}
												>
													🌐
												</button>
											)}
										</div>
									);
								})}
							</div>
						</>
					)}
					{/* 各按钮以各自数据非空为显隐口径（计数不为 0 才给入口）。 */}
					<div className="artifacts-footer">
						{artifacts.length > 0 && (
							<button type="button" className="artifacts-more" onClick={() => onOpenPanelGroup("artifacts")}>
								查看所有产物 ({artifacts.length}) ›
							</button>
						)}
						{changeCount > 0 && (
							<button type="button" className="artifacts-more" onClick={() => onOpenPanelGroup("changes")}>
								查看所有变更 ›
							</button>
						)}
						{sources.length > 0 && <SourcesButton sources={sources} onClick={onOpenSources} />}
					</div>
				</section>
			)}
			{lastError !== undefined && (
				<ErrorCard
					message={lastError}
					modelId={conversation.state.modelId}
					retryText={retryText}
					onRetry={() => {
						if (retryTarget === undefined) return;
						retrySubmit(retryTarget);
					}}
				/>
			)}
		</>
	);

	return (
		<main
			className="chat"
			ref={chatRef}
			style={{ "--chat-content-width": `${contentWidth}px` } as React.CSSProperties}
		>
			<header className="chat-header">
				<button type="button" className="bar-btn" aria-label="返回首页" onClick={onBack}>
					<IconBack size={17} />
				</button>
				<span className="chat-title" title={title}>
					{title}
				</span>
				{/*
				临时任务的转正入口（对标 WorkBuddy 头部「保存到工作空间」）。
				只有临时任务显示：命名空间的会话不需要再转一次。
				流式中禁用 —— daemon 也会拒，但按钮置灰比弹层里报错直观。
			*/}
				{conversation.state.isTempTask === true && (
					<button
						type="button"
						className="bar-btn bar-btn-text"
						disabled={!ready || streaming}
						title={streaming ? "任务进行中，停止后可保存" : "保存到工作空间"}
						onClick={() => setSaveOpen(true)}
					>
						保存到工作空间
					</button>
				)}
				<ModeSwitch
					interactions={conversation.availableModes}
					currentId={conversation.state.interactionId}
					onChange={onInteractionChange}
					onTodo={onTodo}
				/>
			</header>

			{/* 成员聚焦横幅（spec 批 8）：可见会话是团队成员时标注，提供返回主会话。
			    控制类操作（模型/专家/模式）此刻仍作用于主会话 —— 横幅文案提醒。 */}
			{memberView !== undefined && onBackToLeader !== undefined && (
				<div className="member-focus-bar" role="status">
					<span className="member-focus-text">
						正在查看成员「{memberView.name}」的实时会话
					</span>
					<span className="bar-spacer" />
					<span className="member-focus-note">发送将直达该成员</span>
					<button type="button" className="mini-btn" onClick={onBackToLeader}>
						返回主会话
					</button>
				</div>
			)}

			{/*
				stream-wrap 只提供定位基准：「回到底部」按钮要钉在滚动视口底部，
				若直接放 .stream 里会随内容一起滚走（absolute 相对的是滚动内容盒）。
				滚动容器仍是 .stream 本身，监听器不挂在 wrap 上 —— 挂错元素收不到
				滚动事件，跟随判定会静默失效。
			*/}
			<div className="stream-wrap">
				<div className="stream" data-reveal={streamReveal} ref={scrollRef} onScroll={handleStreamScroll}>
					{/*
						轮视图渲染：每轮一个 .turn-group 容器，依次是 user 气泡、
						回合头部（可点的轮折叠开关）、fold plan 各项、取消指示行；
						「由 user 开启的最后一组」在 anchorSpace 期间加 anchor-space
						（min-height）—— 发送吸顶的滚动空间由它提供（WorkBuddy
						group min-height 同款，出处见 send-anchor.ts 头注）。尾部
						（状态行/产物/错误卡）随最后一组走，没有组（全新会话还没有
						消息）时平铺，与历史行为一致。
					*/}
					{turnViews.map((view, index) => {
						const isLast = index === turnViews.length - 1;
						const anchored = isLast && anchorSpace && view.startsWithUser;
						const turnId = view.turnId;
						const userEntry = view.userEntry;
						return (
							<div key={view.key} className={anchored ? "turn-group anchor-space" : "turn-group"}>
								{userEntry !== undefined && (
									<UserBubble
										entryId={userEntry.id}
										text={userEntry.text}
										at={userEntry.at}
										images={userEntry.images}
										skillNames={userEntry.skillNames}
										target={branchTargets.get(userEntry.id)}
										branchable={branchReady}
										onRestart={restartFrom}
										onBranch={forkFrom}
									/>
								)}
								{/*
									回合头部紧跟 user 气泡之后（与原块流同位）；进行中的轮
									hasTurnFold 恒 false，头部不可点、无 chevron，行为不变。
								*/}
								{turnId !== undefined && (
									<TurnHeader
										active={streaming && turnId === lastUserId}
										// 活动轮用实时计时（走表）；历史/已结束轮从回合计时映射
										// 按 turnId 取真实计时（Task 4.3，查不到即回落「已完成」）。
										turn={
											streaming && turnId === lastUserId
												? conversation.turn
												: conversation.turnTimings?.[turnId]
										}
										collapsible={view.plan.hasTurnFold}
										expanded={turnFoldExpanded(turnFolds, turnId)}
										onToggle={() => toggleTurn(turnId)}
									/>
								)}
								{view.plan.items.map((item) => renderPlanItem(view, item))}
								{/* 取消指示行在轮末、折叠区外（中断痕迹必须常显）。 */}
								{view.cancelled && <div className="user-cancelled">用户已取消</div>}
								{isLast && streamTail}
							</div>
						);
					})}
					{turnViews.length === 0 && streamTail}
				</div>
				{/*
				消息导航刻度轨：钉在 stream-wrap 视口左缘（与 stream-fade /
				jump-to-bottom 同一定位基准）。不能放 .stream 内 —— 滚动容器里
				absolute 子元素随内容滚走，且 .stream 挂载动画的 transform 期间
				会让它变成后代包含块，刻度轨会短暂错位。scrollRef 与 entries
				都是现成的，零新状态源。
			*/}
				<TurnRail entries={entries} scrollRef={scrollRef} />
				{/*
				底部渐隐（对标 WorkBuddy __bottom-mask）：渐变叠加层钉在
				stream-wrap 视口底部，不随内容滚动。与「回到底部」共用同一可见
				条件（不在底部才需要软收边）；常驻 DOM 只切 opacity，往返都有过渡。
			*/}
				<div className="stream-fade" data-visible={showJumpToBottom} />
				{/* 不在底部时浮现（跟随已停）；点击平滑回底并恢复跟随。 */}
				{showJumpToBottom && (
					<button
						type="button"
						className="jump-to-bottom"
						aria-label="回到底部"
						title="回到底部"
						onClick={jumpToBottom}
					>
						<IconChevronDown size={16} />
					</button>
				)}
			</div>

			<footer className="chat-composer">
				{/*
				排队 chips（WorkBuddy 同位同语义）：steer/followUp 发出去之后、
				被 pi 消费之前的「已发出、待生效」消息就挂在这里 —— 文本可读、
				可编辑（填回草稿并从队列摘除）、可删除。数据是 queue_changed 事件
				携带的队列内容（pi _steeringMessages / _followUpMessages 的快照），
				消息被消费时 pi 自己出队并推新快照，chips 随之消失。
			*/}
				{queuedItems.map(({ text, kind, rest, insertNow }) => (
					<div key={text} className="queued-chip">
						<span className="queued-chip-label">{kind === "steering" ? "将插入" : "排队中"}</span>
						<span className="queued-chip-text" title={text}>
							{text}
						</span>
						{kind === "followUp" && (
							<button
								type="button"
								className="queued-chip-btn"
								aria-label="立即插入当前任务"
								title="不等排队，立刻插进当前这轮"
								onClick={() => {
									// 挪进 steering 队列：重排的底层（清空 + 重入队）会让它走 steer 通道。
									if (insertNow !== queued) onQueueRewrite(insertNow);
								}}
							>
								<IconSend size={13} />
							</button>
						)}
						<button
							type="button"
							className="queued-chip-btn"
							aria-label="编辑这条排队消息"
							title="编辑"
							onClick={() => {
								// 摘出后填回草稿：改完由用户自己重新发送（仍是 steer 语义）。
								composerRef.current?.fillText(text);
								if (rest !== queued) onQueueRewrite(rest);
							}}
						>
							<IconEdit size={13} />
						</button>
						<button
							type="button"
							className="queued-chip-btn"
							aria-label="删除这条排队消息"
							title="删除"
							onClick={() => {
								if (rest !== queued) onQueueRewrite(rest);
							}}
						>
							<IconTrash size={13} />
						</button>
					</div>
				))}
				{pendingQuestionnaire !== undefined ? (
					/*
					问卷浮层替换输入区（WorkBuddy CBChat 的 hasQuestionFloating 语义：
					答题期间 composer 让位，答完/跳过后 composer 恢复）。key 按请求 id
					挂，新问卷即新挂载（作答状态随之重置，与全局弹层期同口径）。
				*/
					<QuestionnaireDialog
						key={pendingQuestionnaire.id}
						request={pendingQuestionnaire}
						onSubmit={(answers) => onQuestionnaireSubmit?.(answers)}
						onSkip={() => onQuestionnaireSkip?.()}
					/>
				) : (
					/*
					输入卡机制（拖放/附件/IME/补全/历史/草稿/字数闸/停止确认）
					全部在 Composer 内部；这里只注入 chat 的差异面。
					流式期间仍可输入：发出去会作为 steer 插进当前这轮（SessionHost.prompt）。
				*/
					<>
						{/*
					专家起手 chips：问卷浮层分支替代整个输入区，chips 只在 Composer
					分支内出现。key 挂专家名 —— 切换专家重挂载，「点过即隐藏」随之复位。
					列表未拉回/专家找不到（currentExpert undefined）时不渲染。
				*/}
						{currentExpert !== undefined && !hasUserMessage && (
							<QuickPromptChips
								key={currentExpert.name}
								prompts={currentExpert.quickPrompts}
								onPick={(text) => composerRef.current?.fillText(text)}
							/>
						)}
						<Composer
							ref={composerRef}
							ready={ready}
							placeholder={
								ready
									? streaming
										? "回车排队等待；想立刻插进当前这轮，点队列条上的 ↑"
										: memberView !== undefined
											? `发送给成员「${memberView.name}」…`
											: "继续追问…"
									: "正在准备…"
							}
							rows={2}
							cwd={conversation.state.cwd}
							modelId={conversation.state.modelId}
							memberItems={memberItems}
							onSubmit={handleComposerSubmit}
							onError={onError}
							draftKey={sessionId}
							enableHistory
							streaming={streaming}
							onAbort={onAbort}
						>
							{/*
				「+」菜单：添加文件（原图片/文档选择流程挪进菜单项，经 composerRef
				触发 Composer 内部的附件选择框）+ 模式/专家子菜单（专家选择的
				唯一入口，底部「更多专家…」跳专家页）+ 技能/连接器占位。
				弹层向上、左对齐，与下方 PermissionMenu 同一约定。
			*/}
							<PlusMenu
								modes={conversation.availableModes}
								currentId={conversation.state.interactionId}
								onInteractionChange={onInteractionChange}
								experts={experts}
								expertId={expertId}
								onSelectExpert={onSelectExpert}
								onOpenExperts={onOpenExperts}
								onPickFiles={() => void composerRef.current?.pickFiles()}
								onOpenSkills={onOpenSkills}
								onOpenConnectors={onOpenConnectors}
								onTodo={onTodo}
							/>
							{/*
				权限预设就地快切（与首页同一组件、同一数据源）：对话中撞权限
				时不必退回首页换档。弹层左对齐向上展开（300px），
				贴右放会溢出窗口右缘被裁掉。
			*/}
							<PermissionMenu onOpenSettings={onOpenSettings} onError={onError} />
							{/*
				当前专家 chip（WorkBuddy 底栏左区、默认权限旁的同款位置）：静态展示，
				hover/focus-within 头像原位变 ×，点击取消选中（setExpert(undefined)
				只清专家、不动交互模式）。列表里找不到（未拉回/已删除）时不渲染 —— chip
				只是展示映射，菜单勾选仍以 session_state 的 expertId 为准。
			*/}
							{currentExpert !== undefined && (
								<ExpertChip expert={currentExpert} onClear={() => onSelectExpert(undefined)} />
							)}
							{/*
					模型快捷切换：与首页同一组件、同一数据源（setModel 后 daemon
					推 session_state 单向刷新，无本地回写）。紧跟 PermissionMenu ——
					两者都是切换器。弹层方向在 CSS 按 composer-bar 场景覆写为
					向上、左对齐（与 PermissionMenu 同一理由：贴右放溢出窗口右缘）。
				*/}
							<ModelMenu
								modelId={conversation.state.modelId}
								thinkingLevel={conversation.state.thinkingLevel}
								availableThinkingLevels={conversation.state.availableThinkingLevels}
								onOpenSettings={onOpenSettings}
								onError={onError}
							/>
							{/*
					语音输入按钮已移除（2026-09-17 试用前自查）：可见按钮点了只
					toast「待做」，宣讲演示里观感比没有更差。能力落地时再放回
					（.bar-btn + IconMic 的原实现见 git 历史）。
				*/}
							{/* 上下文饱和度常驻指示（used/total 精确值），点击看分类估算。 */}
							{conversation.usageDetail !== undefined && <ContextUsageRing detail={conversation.usageDetail} />}
						</Composer>
						{/*
							会话指标条：常驻输入卡下方（对齐 dsh 把 StatsLine 挂在
							composer.dock 的做法）。与消息行内那条单轮读数分工不同 ——
							那条答「这一轮用了多少」，这条答「整个会话跑了多少、多快」。
							数据来自 daemon 的 session_stats 事件（台账全历史口径），
							没有台账时组件自己整行不渲染；问卷浮层分支里不出现（与输入卡同条件）。
						*/}
						<SessionStatsLine stats={conversation.sessionStats} />
					</>
				)}
			</footer>
			{saveOpen && (
				<SaveToWorkspaceDialog
					onSave={onSaveToWorkspace}
					onClose={() => setSaveOpen(false)}
				/>
			)}
		</main>
	);
}
