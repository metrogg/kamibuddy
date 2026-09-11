/**
 * 问卷浮层：questionnaire 工具发起的结构化提问（机制见 shared/ipc.ts 的
 * QuestionnaireRequest 头注释）。
 *
 * WorkBuddy 分步答题 v3（QuestionFloating）形态：**内联浮层而非全局模态** ——
 * 当前会话有待答问卷时，本卡片渲染在 chat-view 的 composer 位置、替换输入区
 * （CBChat 的 hasQuestionFloating 语义：答题期间输入区让位），不再是
 * modal-backdrop 遮罩。阻塞语义不变：daemon 侧的工具执行正 await 在这条
 * 链路上，出口是逐题作答、逐题跳过与整卡跳过（头部 X）。
 *
 * 交互对齐 v3（lib-chat-ui 的 QuestionFloating）：
 *   - 一次一题（分页），头部 ‹ n/N › 分页器可自由翻页回看/改答；
 *   - 点选项 120ms 后自动进下一题；最后一题点选项立即整体提交
 *     （v3 与产品确认的口径：不设独立「提交」按钮）；
 *   - 「其他补充…」是恒定可见的输入行（不是选中后展开输入框的 radio 形态）：
 *     输入与选项互斥（有文字时清空已选、选项行禁用半透明），回车 = 前进/提交；
 *   - 逐题可跳过（跳过的题按「未回答」结算，工具侧补标，模型知情）。
 */

import { useEffect, useRef, useState } from "react";
import type {
	QuestionnaireAnswer,
	QuestionnaireRequest,
} from "@shared/ipc.ts";
import {
	IconArrowRight,
	IconChevronLeft,
	IconChevronRight,
	IconClose,
	IconEdit,
	IconSend,
} from "./icons.tsx";
import { useImeGuard } from "./ime-guard.ts";

interface QuestionnaireDialogProps {
	readonly request: QuestionnaireRequest;
	readonly onSubmit: (answers: readonly QuestionnaireAnswer[]) => void;
	readonly onSkip: () => void;
}

/** 单题作答态：选中项下标、或「其他补充…」自由输入（二者互斥）。 */
interface Selection {
	readonly selected: number | undefined;
	readonly otherText: string;
}

/** 点选项到自动前进的视觉反馈延迟（WorkBuddy v3 同值）。 */
const AUTO_ADVANCE_MS = 120;

export function QuestionnaireDialog({
	request,
	onSubmit,
	onSkip,
}: QuestionnaireDialogProps): React.JSX.Element {
	const total = request.questions.length;
	const [currentIndex, setCurrentIndex] = useState(0);
	// 与 questions 平行的作答数组。宿主按 request.id 挂 key，新问卷即新挂载，
	// 不需要 PermissionDialog 那样的 id 变化重置。
	const [selections, setSelections] = useState<readonly Selection[]>(() =>
		request.questions.map(() => ({ selected: undefined, otherText: "" })),
	);
	// 「其他补充…」输入框的 Enter = 前进/提交：中文选词的 Enter 只是确认候选，
	// 不拦就会误提交半张卡（守卫的坑见 ime-guard.ts 头注释）。
	const ime = useImeGuard();
	// 自动前进/提交的延迟计时器：任何手动操作（改选、翻页、跳过）都取消它。
	const advanceTimer = useRef<number>(0);
	// 末题点选项即提交：防 120ms 窗口内连点/翻页造成重复提交。
	const submittedRef = useRef(false);
	// 「其他补充…」行整行是输入热区（WorkBuddy v3：点行聚焦输入框）。
	const otherInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => () => window.clearTimeout(advanceTimer.current), []);

	const isLast = currentIndex === total - 1;
	const question = request.questions[currentIndex];
	const selection = selections[currentIndex];

	/** 逐题结算成问答对：未作答（没选、且「其他补充…」空输入）的题不进答案。 */
	const buildAnswers = (source: readonly Selection[]): readonly QuestionnaireAnswer[] =>
		source.flatMap((s, qi) => {
			const q = request.questions[qi];
			if (q === undefined) return [];
			// 自由输入优先：输入与选项互斥（见 setOtherText），有文字时答案取文字。
			const text = s.otherText.trim();
			if (text !== "") return [{ question: q.question, answer: text }];
			if (s.selected === undefined) return [];
			const option = q.options[s.selected];
			return option === undefined ? [] : [{ question: q.question, answer: option }];
		});

	const submit = (source: readonly Selection[]): void => {
		if (submittedRef.current) return;
		submittedRef.current = true;
		window.clearTimeout(advanceTimer.current);
		onSubmit(buildAnswers(source));
	};

	/** 选中后的前进路径：中间题延迟自动翻页，末题立即提交（WorkBuddy v3 口径）。 */
	const scheduleAdvance = (next: readonly Selection[]): void => {
		window.clearTimeout(advanceTimer.current);
		if (isLast) {
			submit(next);
			return;
		}
		advanceTimer.current = window.setTimeout(() => {
			setCurrentIndex((i) => Math.min(i + 1, total - 1));
		}, AUTO_ADVANCE_MS);
	};

	const select = (selected: number): void => {
		if (submittedRef.current) return;
		// 点选项即与「其他补充…」互斥：清空本题自由输入（v3 单选同口径）。
		const next = selections.map((s, i) =>
			i === currentIndex ? { selected, otherText: "" } : s,
		);
		setSelections(next);
		scheduleAdvance(next);
	};

	const setOtherText = (otherText: string): void => {
		// 输入与选项互斥：有文字时清空本题已选（v3 同口径），
		// 选项行随之禁用半透明；删空后恢复可选。
		setSelections((prev) =>
			prev.map((s, i) =>
				i === currentIndex
					? { selected: otherText.trim() === "" ? s.selected : undefined, otherText }
					: s,
			),
		);
	};

	const goTo = (index: number): void => {
		window.clearTimeout(advanceTimer.current);
		setCurrentIndex(index);
	};

	/** 逐题跳过：清掉本题作答；中间题翻页，末题以本题未答结算提交。 */
	const skipCurrent = (): void => {
		if (submittedRef.current) return;
		window.clearTimeout(advanceTimer.current);
		const next = selections.map((s, i) =>
			i === currentIndex ? { selected: undefined, otherText: "" } : s,
		);
		setSelections(next);
		if (isLast) submit(next);
		else setCurrentIndex((i) => Math.min(i + 1, total - 1));
	};

	// 点选项自动前进/提交，footer 圆形按钮主要服务「其他补充…」输入的确认出口
	// （v3 同口径）：中间题仅自由输入有文字时激活；末题当前题已答时激活。
	const otherTextReady = selection !== undefined && selection.otherText.trim() !== "";
	const currentAnswered =
		selection !== undefined && (selection.selected !== undefined || otherTextReady);
	const advanceActive = isLast ? currentAnswered : otherTextReady;
	const advanceByButton = (): void => {
		if (submittedRef.current || !advanceActive) return;
		if (isLast) submit(selections);
		else goTo(currentIndex + 1);
	};

	if (question === undefined || selection === undefined) {
		// 题数与 selections 同步生成，正常不可达；真到达说明契约变了，响亮暴露。
		throw new Error(`问卷题目下标越界：${currentIndex} / ${total}`);
	}

	return (
		<div className="questionnaire-card">
			<div className="questionnaire-header">
				{/* v3：header 左侧就是当前题文本，不再有「向用户提问」的固定标题。 */}
				<p className="questionnaire-title">{question.question}</p>
				<div className="questionnaire-header-right">
					{total > 1 && (
						<span className="questionnaire-pager">
							<button
								type="button"
								className="questionnaire-pager-btn"
								aria-label="上一题"
								disabled={currentIndex === 0}
								onClick={() => goTo(currentIndex - 1)}
							>
								<IconChevronLeft size={16} />
							</button>
							<span className="questionnaire-pager-info">
								{currentIndex + 1}/{total}
							</span>
							<button
								type="button"
								className="questionnaire-pager-btn"
								aria-label="下一题"
								disabled={isLast}
								onClick={() => goTo(currentIndex + 1)}
							>
								<IconChevronRight size={16} />
							</button>
						</span>
					)}
					<button
						type="button"
						className="questionnaire-skip-all"
						aria-label="全部跳过"
						title="全部跳过"
						onClick={onSkip}
					>
						<IconClose size={16} />
					</button>
				</div>
			</div>

			<div className="questionnaire-content">
				<div className="questionnaire-options" role="radiogroup" aria-label={question.question}>
					{question.options.map((option, oi) => (
						<button
							key={oi}
							type="button"
							role="radio"
							aria-checked={selection.selected === oi}
							// 「其他补充…」有文字时选项行禁用半透明（互斥，v3 同口径）。
							disabled={otherTextReady}
							className={
								selection.selected === oi
									? "questionnaire-option selected"
									: "questionnaire-option"
							}
							onClick={() => select(oi)}
						>
							<span className="questionnaire-option-number">{oi + 1}</span>
							<span className="questionnaire-option-text">{option}</span>
							<IconChevronRight size={16} className="questionnaire-option-arrow" />
						</button>
					))}
					{/* 固定末行：选项覆盖不全时的自由补充出口。v3 是恒定可见的输入行
					    （不再是选中后才展开输入框的 radio 形态）；输入即与选项互斥，
					    回车 = 前进/提交。 */}
					<div
						className={otherTextReady ? "questionnaire-other-row ready" : "questionnaire-other-row"}
						onClick={() => otherInputRef.current?.focus()}
					>
						<span className="questionnaire-other-icon">
							<IconEdit size={12} />
						</span>
						<input
							ref={otherInputRef}
							className="questionnaire-other-input"
							placeholder="其他补充…"
							aria-label="其他补充"
							value={selection.otherText}
							{...ime.bind}
							onChange={(e) => setOtherText(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !ime.shouldSwallowNow() && otherTextReady) {
									advanceByButton();
								}
							}}
						/>
					</div>
				</div>
			</div>

			<div className="questionnaire-footer">
				<button type="button" className="questionnaire-skip-btn" onClick={skipCurrent}>
					跳过
				</button>
				{/* v3 单选点选项会自动前进/提交，这个按钮主要服务「其他补充…」
				    输入的确认出口：中间题 = 前进箭头（仅自由输入有文字时激活），
				    末题 = 发送图标（当前题已答时激活）。 */}
				<button
					type="button"
					className={advanceActive ? "questionnaire-icon-btn active" : "questionnaire-icon-btn"}
					disabled={!advanceActive}
					aria-label={isLast ? "提交" : "下一题"}
					title={isLast ? "提交" : "下一题"}
					onClick={advanceByButton}
				>
					{isLast ? <IconSend size={16} /> : <IconArrowRight size={16} />}
				</button>
			</div>
		</div>
	);
}
