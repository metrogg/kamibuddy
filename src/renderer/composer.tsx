/**
 * 统一输入卡（home-view 与 chat-view 共用）。
 *
 * 为什么必须抽成一份：首页与对话页的输入卡曾是两份手写重复代码
 * （拖放、附件/chip 条、IME 守卫、autocomplete、keydown 链、submit
 * 各约 150 行），「改一处漏一处」是必然事件（首页「+」菜单漏改即实例）。
 * 此后新增输入区能力（新附件类型、新快捷键）只改这一个文件。
 *
 * 差异全部经 props/children 注入：placeholder、rows、cwd（补全刷新键）、
 * modelId（VisionHint）、ready、草稿 key、输入历史开关、流式停止、
 * bar 左组按钮组合；右组固定为字数余量 + 发送/停止按钮。
 */

import { useEffect, useImperativeHandle, useRef, useState } from "react";
import type { ImagePart } from "@shared/image.ts";
import { useAutocomplete } from "./autocomplete.tsx";
import { IconSend, IconStop } from "./icons.tsx";
import { AttachmentStrip, DocumentRefStrip, foldDocumentRefsIntoText, useImageAttachments } from "./image-attachments.tsx";
import { useImeGuard } from "./ime-guard.ts";
import { loadDraft, navigateHistory, recordSent, saveDraft, sentHistory } from "./input-history.ts";
import type { HistoryNavState } from "./input-history.ts";
import { charCountState } from "./input-limit.ts";
import { stopConfirmExpired, stopConfirmIdle, triggerStop } from "./stop-confirm.ts";
import type { StopConfirmState } from "./stop-confirm.ts";
import { useModelSupportsVision, VisionHint } from "./vision-hint.tsx";

/**
 * 给父组件的命令式句柄（ref 取得）。
 *
 * 为什么需要它：「+」菜单的「添加文件」由父组件渲染在 children 里，
 * 而附件状态（useImageAttachments）在本组件内部 —— 父组件经句柄打开
 * 选择框，图片/文档才能进同一份附件状态。拆成两份 hook 会出现
 * 「选的文件不进输入卡」的劈叉。
 */
export interface ComposerHandle {
	/** 打开系统文件选择框添加附件（与粘贴/拖拽同汇入内部附件状态）。 */
	readonly pickFiles: () => Promise<void>;
	/**
	 * 替换输入框文本（首页案例卡片点击填充提示词用）。
	 * 草稿在组件内部，父组件只能经句柄写入 —— 否则案例卡片点了没反应。
	 */
	readonly setText: (text: string) => void;
	/**
	 * 填入文本并聚焦输入框（对话页专家起手 chips：点 chip 文本进框待发送，
	 * 不直接发送 —— 用户可能还要补两句）。与 setText 的差别只在聚焦：
	 * 案例卡片在首页视觉焦点已在输入区，chips 在按钮上，不聚焦用户
	 * 得再点一下输入框才能接着打字。
	 */
	readonly fillText: (text: string) => void;
}

interface ComposerProps {
	/** daemon 未就绪时输入禁用、发送键置灰。 */
	readonly ready: boolean;
	readonly placeholder: string;
	readonly rows: number;
	/** 补全数据源刷新键：工作空间切换后文件列表必须重拉（见 autocomplete.tsx）。 */
	readonly cwd: string | undefined;
	/** 当前模型标识（`provider/model`）：VisionHint 判定视觉能力的依据。 */
	readonly modelId: string | undefined;
	/**
	 * 提交（文本 + 可选图片附件）。resolve 表示 daemon 已接收；
	 * 附件据此决定去留（失败保留在输入区，见 submit）。
	 */
	readonly onSubmit: (text: string, images?: readonly ImagePart[]) => Promise<void>;
	/** 就地轻提示（附件格式/大小被拒等）。 */
	readonly onError: (message: string) => void;
	/**
	 * 按 key 持久草稿（input-history 模块级 Map）：提供时输入即存，
	 * 挂载与值变化时还原并复位历史导航态。chat 传 sessionId，home 不传。
	 */
	readonly draftKey?: string;
	/** Alt+↑/↓ 翻已发送历史（仅发送成功的记录）。home 不开：发送即跳对话页。 */
	readonly enableHistory?: boolean;
	/** 流式中：发送键变停止键（二次确认），Esc 与按钮同一入口。 */
	readonly streaming?: boolean;
	/** 停止二次确认成立时调用（streaming 时必传）。 */
	readonly onAbort?: () => void;
	/** composer-bar 左组按钮（渲染在 spacer 之前）；右组固定为字数余量 + 发送/停止。 */
	readonly children: React.ReactNode;
	/**
	 * composer-bar 右组按钮（渲染在 spacer 之后、发送键之前）。
	 * WorkBuddy 首页底行布局是「左 + 按钮，右 模型 chip/麦克风/发送」，
	 * 对话页保持全左组（各页自己的对齐口径），故此槽位只有首页传。
	 */
	readonly trailing?: React.ReactNode;
	/** 见 ComposerHandle：父组件拿它触发「添加文件」选择框。 */
	readonly ref?: React.Ref<ComposerHandle>;
}

export function Composer({
	ready,
	placeholder,
	rows,
	cwd,
	modelId,
	onSubmit,
	onError,
	draftKey,
	enableHistory,
	streaming,
	onAbort,
	children,
	trailing,
	ref,
}: ComposerProps): React.JSX.Element {
	// 草稿按 draftKey 存进模块级 Map（input-history.ts）：视图切换卸载组件后
	// 切回仍能还原。挂载时先还原一次，之后 key 变化由下方 effect 接续。
	const [draft, setDraft] = useState(() => (draftKey === undefined ? "" : (loadDraft(draftKey) ?? "")));
	// 停止的二次确认状态（stop-confirm.ts 状态机）：idle → 首次触发武装 pending
	// → 窗口内再触发才 confirmed 调 onAbort。只持状态，计时与判定都在纯函数里。
	const [stopConfirm, setStopConfirm] = useState<StopConfirmState>(stopConfirmIdle);
	// Alt+↑/↓ 历史导航状态：undefined = 不在导航中（输入框是用户自己的草稿）。
	const [historyNav, setHistoryNav] = useState<HistoryNavState | undefined>(undefined);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	// IME 守卫（useImeGuard 一份接线）：选词确认的 Enter 不发送。
	const ime = useImeGuard();
	// 非视觉模型提示的数据源（模型目录 join，见 vision-hint.tsx）；未知不提示。
	const visionSupported = useModelSupportsVision(modelId);
	// 图片/文档附件（粘贴/拖拽/选择三入口，同一份 hook）。
	// 文档进 chip 条（documentRefs），提交时才折回文本，textarea 保持纯人写文本。
	const img = useImageAttachments(onError);
	// 输入长度余量（input-limit.ts 纯函数判定）：接近上限才显示，超限禁发。
	const chars = charCountState(draft.length);
	// @ / 补全：触发与选中逻辑全在 hook 里，这里只接管 ref 与值；cwd 变化时重拉数据源。
	const ac = useAutocomplete(draft, setDraft, textareaRef, cwd);

	useImperativeHandle(
		ref,
		() => ({
			pickFiles: img.pickFromDialog,
			setText: (text) => {
				setDraft(text);
				// 与 onChange 同口径：draftKey 在时同步进草稿 Map。
				if (draftKey !== undefined) saveDraft(draftKey, text);
			},
			fillText: (text) => {
				setDraft(text);
				if (draftKey !== undefined) saveDraft(draftKey, text);
				textareaRef.current?.focus();
			},
		}),
		[img.pickFromDialog, draftKey],
	);

	// draftKey 变化（含挂载后 key 才就位）时还原该 key 的草稿；
	// 历史导航态一并复位 —— 旧 key 翻到的位置对新 key 没有意义。
	useEffect(() => {
		if (draftKey === undefined) return;
		setDraft(loadDraft(draftKey) ?? "");
		setHistoryNav(undefined);
	}, [draftKey]);

	/** 停止按钮与 Esc 共用的二次确认入口：只有 confirmed 那次才真正中断。 */
	const requestStop = (): void => {
		const result = triggerStop(stopConfirm, Date.now());
		setStopConfirm(result.state);
		if (result.confirmed) onAbort?.();
	};

	// 待确认窗口截止自动复原。定时器到点再用 stopConfirmExpired 复核：
	// 用户在旧定时器到期前重新武装过时，新 pending 尚未过期，不能被旧定时器误清。
	useEffect(() => {
		if (stopConfirm.phase !== "pending") return;
		const timer = window.setTimeout(
			() => {
				setStopConfirm((current) => (stopConfirmExpired(current, Date.now()) ? stopConfirmIdle : current));
			},
			Math.max(0, stopConfirm.deadline - Date.now()),
		);
		return () => window.clearTimeout(timer);
	}, [stopConfirm]);

	// 流式结束（完成/已中断）时若还挂着待确认，直接复原 —— 停止键随流式态消失，
	// 状态不收回去会卡在下一次流式开始时的按钮上。
	useEffect(() => {
		if (streaming !== true) setStopConfirm((current) => (current.phase === "pending" ? stopConfirmIdle : current));
	}, [streaming]);

	const submit = (): void => {
		const text = draft.trim();
		// 超限双闸之一：发送按钮已 disabled，这里拦快捷键（Enter）路径。
		if (charCountState(draft.length).over) return;
		if (text === "" || !ready) return;
		const images = img.attachments;
		setDraft("");
		// 发送即清掉该 key 的暂存草稿（已发出不再是草稿），并退出历史导航态。
		if (draftKey !== undefined) saveDraft(draftKey, "");
		setHistoryNav(undefined);
		// 附件等 daemon 接收成功再清：失败时错误卡已落进消息流，图留在
		// 输入区（文本可从错误卡重试），补一句话重发即可，不必重挑文件。
		// 文档引用在提交这一刻折回文本末尾（recordSent 只记用户原文，
		// 历史翻页还原的是人写的部分）。
		void onSubmit(foldDocumentRefsIntoText(text, img.documentRefs), images.length > 0 ? images : undefined).then(
			() => {
				img.clear();
				// 历史只记发送成功的：失败的文本留在错误卡里可重试，不该进翻页序列。
				if (enableHistory === true) recordSent(text);
			},
			() => { },
		);
	};

	/**
	 * 输入框按键。ac 先行：补全打开时 Enter=选中、Esc=关闭补全（均 preventDefault），
	 * 之后的守卫一律不插手它的消费（e.defaultPrevented 直接 return）。
	 * IME 守卫：选词确认的 Enter 发送与换行（含 Shift+Enter）都吞。
	 */
	const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
		ac.bind.onKeyDown(e);
		if (e.defaultPrevented) return;
		// Esc 停止只在流式期间生效，且走二次确认（误碰一次不中断长任务）；
		// 非流式 Esc 无任何效果。
		if (e.key === "Escape") {
			if (streaming === true) {
				e.preventDefault();
				requestStop();
			}
			return;
		}
		if (e.key !== "Enter" && !(e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown"))) return;
		// IME 选词期间 Enter 是确认候选、方向键是移动候选条，都归输入法，守卫一律吞。
		if (ime.shouldSwallowNow()) {
			e.preventDefault();
			return;
		}
		if (enableHistory === true && e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
			e.preventDefault();
			const nav = navigateHistory(historyNav, sentHistory(), e.key === "ArrowUp" ? "up" : "down", draft);
			setHistoryNav(nav.state);
			setDraft(nav.text);
			// 导航结果同步进草稿 Map：导航中切走再切回，还原的就是离开前框里的内容。
			if (draftKey !== undefined) saveDraft(draftKey, nav.text);
			return;
		}
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			submit();
		}
	};

	/*
		拖放三件套（onDragOver/onDragLeave/onDrop）挂在输入卡而非 textarea 上：
		整个卡片（含按钮行）都是放置目标，命中区大得多。悬停高亮由
		img.dragOver 驱动（进 drag-over 类），拖文本片段不亮（见 hook 注释）。
	*/
	return (
		<div
			className={`composer-card${img.dragOver ? " drag-over" : ""}`}
			onDrop={img.bind.onDrop}
			onDragOver={img.bind.onDragOver}
			onDragLeave={img.bind.onDragLeave}
		>
			{/* 文档 chip 条在图片缩略图条之前。 */}
			<DocumentRefStrip refs={img.documentRefs} onRemove={img.removeDocumentRefAt} />
			<AttachmentStrip attachments={img.attachments} onRemove={img.removeAt} />
			<VisionHint visible={visionSupported === false && img.attachments.length > 0} />
			<div className="composer-input">
				{ac.menu}
				<textarea
				ref={textareaRef}
				value={draft}
				aria-label="消息输入框"
					onChange={(e) => {
						ac.bind.onChange(e);
						if (draftKey !== undefined) saveDraft(draftKey, e.target.value);
					}}
					onSelect={ac.bind.onSelect}
					onBlur={ac.bind.onBlur}
					onPaste={img.bind.onPaste}
					onCompositionStart={ime.bind.onCompositionStart}
					onCompositionEnd={ime.bind.onCompositionEnd}
					onKeyDown={handleComposerKeyDown}
					placeholder={placeholder}
					disabled={!ready}
					rows={rows}
				/>
			</div>
			<div className="composer-bar">
				{/* 左组按钮由调用方注入：home 与 chat 的组合不同。 */}
				{children}
				<span className="bar-spacer" />
				{/* 右组（仅首页传）：模型 chip / 麦克风，贴在发送键左侧（WB 首页底行布局）。 */}
				{trailing}
				{/* 输入余量：接近上限才出现（等宽数字），超限变红。 */}
				{chars.show && (
					<span
						className={chars.over ? "char-remaining over" : "char-remaining"}
						title={chars.over ? "已超出输入长度上限" : "剩余可输入字符数"}
					>
						{chars.remaining}
					</span>
				)}
				{/*
					流式期间发送键变中断键。
					没有中断入口时，模型跑偏或长任务只能干等，甚至杀进程 —— 这是必须有的逃生门。
				*/}
				{streaming === true ? (
					// 二次确认：首次点击武装 3s 窗口（按钮内容换 Esc 徽章），
					// 窗口内再点（或再按 Esc）才真正中断，超时自动复原。
					<button
						type="button"
						className="send-btn stop"
						aria-label="停止"
						title={stopConfirm.phase === "pending" ? "再按一次确认停止" : "停止生成"}
						onClick={requestStop}
					>
						{stopConfirm.phase === "pending" ? <kbd className="stop-confirm-kbd">Esc</kbd> : <IconStop size={14} />}
					</button>
				) : (
					<button
						type="button"
						className="send-btn"
						aria-label="发送"
						onClick={submit}
						disabled={!ready || draft.trim() === "" || chars.over}
					>
						<IconSend size={16} />
					</button>
				)}
			</div>
		</div>
	);
}
