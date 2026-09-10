/**
 * 问卷弹层：questionnaire 工具发起的结构化提问（机制见 shared/ipc.ts 的
 * QuestionnaireRequest 头注释）。
 *
 * 与 PermissionDialog 同族的**阻塞式**弹层：daemon 侧的工具执行正 await
 * 在这条链路上，不答就一直挂着。所以遮罩不可点关闭，出口是逐题作答、
 * 逐题跳过与整卡跳过（头部 X）。
 *
 * 交互对齐 WorkBuddy 分步答题 v3（lib-chat-ui 的 QuestionFloating）：
 *   - 一次一题（分页），头部 ‹ n/N › 分页器可自由翻页回看/改答；
 *   - 点选项 120ms 后自动进下一题；最后一题点选项立即整体提交
 *     （v3 与产品确认的口径：不设独立「提交」按钮）；
 *   - 每题固定「其他…」自由补充出口，输入与选项互斥，回车 = 前进/提交；
 *   - 逐题可跳过（跳过的题按「未回答」结算，工具侧补标，模型知情）。
 */

import { useEffect, useRef, useState } from "react";
import type {
	QuestionnaireAnswer,
	QuestionnaireRequest,
} from "@shared/ipc.ts";
import { useImeGuard } from "./ime-guard.ts";

interface QuestionnaireDialogProps {
	readonly request: QuestionnaireRequest;
	readonly onSubmit: (answers: readonly QuestionnaireAnswer[]) => void;
	readonly onSkip: () => void;
}

/** 单题作答态：选中项下标、或 OTHER 加自由输入。undefined = 未作答。 */
interface Selection {
	readonly selected: number | typeof OTHER | undefined;
	readonly otherText: string;
}

const OTHER = "other" as const;

/** 点选项到自动前进的视觉反馈延迟（WorkBuddy v3 同值）。 */
const AUTO_ADVANCE_MS = 120;

export function QuestionnaireDialog({
	request,
	onSubmit,
	onSkip,
}: QuestionnaireDialogProps): React.JSX.Element {
	const total = request.questions.length;
	const [currentIndex, setCurrentIndex] = useState(0);
	// 与 questions 平行的作答数组。App 按 request.id 挂 key，新问卷即新挂载，
	// 不需要 PermissionDialog 那样的 id 变化重置。
	const [selections, setSelections] = useState<readonly Selection[]>(() =>
		request.questions.map(() => ({ selected: undefined, otherText: "" })),
	);
	// 「其他…」输入框的 Enter = 前进/提交：中文选词的 Enter 只是确认候选，
	// 不拦就会误提交半张卡（守卫的坑见 ime-guard.ts 头注释）。
	const ime = useImeGuard();
	// 自动前进/提交的延迟计时器：任何手动操作（改选、翻页、跳过）都取消它。
	const advanceTimer = useRef<number>(0);
	// 末题点选项即提交：防 120ms 窗口内连点/翻页造成重复提交。
	const submittedRef = useRef(false);

	useEffect(() => () => window.clearTimeout(advanceTimer.current), []);

	const isLast = currentIndex === total - 1;
	const question = request.questions[currentIndex];
	const selection = selections[currentIndex];

	/** 逐题结算成问答对：未作答（没选、或「其他…」空输入）的题不进答案。 */
	const buildAnswers = (source: readonly Selection[]): readonly QuestionnaireAnswer[] =>
		source.flatMap((s, qi) => {
			const q = request.questions[qi];
			if (q === undefined || s.selected === undefined) return [];
			if (s.selected === OTHER) {
				const text = s.otherText.trim();
				return text === "" ? [] : [{ question: q.question, answer: text }];
			}
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

	const select = (selected: number | typeof OTHER): void => {
		if (submittedRef.current) return;
		const next = selections.map((s, i) =>
			i === currentIndex ? { ...s, selected } : s,
		);
		setSelections(next);
		// 「其他…」只选中不前进：答案在输入框里，等回车或「下一题/提交」按钮。
		if (selected !== OTHER) scheduleAdvance(next);
	};

	const setOtherText = (otherText: string): void => {
		setSelections((prev) =>
			prev.map((s, i) => (i === currentIndex ? { ...s, otherText } : s)),
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

	// 「其他…」已填文字时 footer 给明确的前进/提交出口（不等回车的人也能走）。
	const otherTextReady =
		selection?.selected === OTHER && selection.otherText.trim() !== "";
	const advanceByButton = (): void => {
		if (submittedRef.current) return;
		if (isLast) submit(selections);
		else goTo(currentIndex + 1);
	};

	if (question === undefined || selection === undefined) {
		// 题数与 selections 同步生成，正常不可达；真到达说明契约变了，响亮暴露。
		throw new Error(`问卷题目下标越界：${currentIndex} / ${total}`);
	}

	return (
		<div className="modal-backdrop">
			<div className="questionnaire-card" role="alertdialog" aria-modal="true">
				<div className="questionnaire-header">
					<div>
						<p className="questionnaire-title">向用户提问</p>
						<p className="questionnaire-desc">
							模型在继续之前想先和你确认；可逐题跳过，不想回答点右上角 X 整张跳过。
						</p>
					</div>
					<div className="questionnaire-header-controls">
						{total > 1 && (
							<span className="questionnaire-pager">
								<button
									type="button"
									className="questionnaire-pager-btn"
									aria-label="上一题"
									disabled={currentIndex === 0}
									onClick={() => goTo(currentIndex - 1)}
								>
									‹
								</button>
								<span className="questionnaire-pager-text">
									{currentIndex + 1}/{total}
								</span>
								<button
									type="button"
									className="questionnaire-pager-btn"
									aria-label="下一题"
									disabled={isLast}
									onClick={() => goTo(currentIndex + 1)}
								>
									›
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
							✕
						</button>
					</div>
				</div>

				<div className="questionnaire-question">
					<p className="questionnaire-question-text">{question.question}</p>
					<div className="questionnaire-options" role="radiogroup" aria-label={question.question}>
						{question.options.map((option, oi) => (
							<button
								key={oi}
								type="button"
								role="radio"
								aria-checked={selection.selected === oi}
								className={
									selection.selected === oi
										? "questionnaire-option selected"
										: "questionnaire-option"
								}
								onClick={() => select(oi)}
							>
								{option}
							</button>
						))}
						{/* 固定最后一项：选项覆盖不全时的自由补充出口。 */}
						<button
							type="button"
							role="radio"
							aria-checked={selection.selected === OTHER}
							className={
								selection.selected === OTHER
									? "questionnaire-option selected"
									: "questionnaire-option"
							}
							onClick={() => select(OTHER)}
						>
							其他…
						</button>
					</div>
					{/* 选中「其他…」才出现输入框；挂载即聚焦（同 sidebar 重命名输入的约定）。 */}
					{selection.selected === OTHER && (
						<input
							className="questionnaire-other-input"
							placeholder="补充你的答案，回车确认"
							autoFocus
							value={selection.otherText}
							{...ime.bind}
							onChange={(e) => setOtherText(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !ime.shouldSwallowNow() && otherTextReady) {
									advanceByButton();
								}
							}}
						/>
					)}
				</div>

				<div className="questionnaire-actions">
					<button type="button" className="mini-btn" onClick={skipCurrent}>
						跳过本题
					</button>
					{/* 点选项自动前进/提交，这个按钮主要服务「其他…」自由输入的确认出口。 */}
					{otherTextReady && (
						<button type="button" className="primary-btn" onClick={advanceByButton}>
							{isLast ? "提交" : "下一题"}
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
