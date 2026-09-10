/**
 * 问卷弹层：questionnaire 工具发起的结构化提问（机制见 shared/ipc.ts 的
 * QuestionnaireRequest 头注释）。
 *
 * 与 PermissionDialog 同族的**阻塞式**弹层：daemon 侧的工具执行正 await
 * 在这条链路上，不答就一直挂着。所以遮罩不可点关闭，出口只有「提交」与
 * 「整卡跳过」两个按钮。
 *
 * 每题单选一个选项，或选固定的最后一项「其他…」自由补充；选项与「其他…」
 * 互斥（radio 语义，button 实现——选项是整行可点的卡片，原生 radio 的
 * 小圆点承载不了这种点击面）。
 */

import { useState } from "react";
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

export function QuestionnaireDialog({
	request,
	onSubmit,
	onSkip,
}: QuestionnaireDialogProps): React.JSX.Element {
	// 与 questions 平行的作答数组。App 按 request.id 挂 key，新问卷即新挂载，
	// 不需要 PermissionDialog 那样的 id 变化重置。
	const [selections, setSelections] = useState<readonly Selection[]>(() =>
		request.questions.map(() => ({ selected: undefined, otherText: "" })),
	);
	// 「其他…」输入框的 Enter = 提交：中文选词的 Enter 只是确认候选，
	// 不拦就会误提交半张卡（守卫的坑见 ime-guard.ts 头注释）。
	const ime = useImeGuard();

	const select = (qi: number, selected: number | typeof OTHER): void => {
		setSelections((prev) =>
			prev.map((s, i) => (i === qi ? { ...s, selected } : s)),
		);
	};

	const setOtherText = (qi: number, otherText: string): void => {
		setSelections((prev) =>
			prev.map((s, i) => (i === qi ? { ...s, otherText } : s)),
		);
	};

	// 逐题结算成问答对：未作答（没选、或「其他…」空输入）结算为 undefined。
	const entries: readonly (QuestionnaireAnswer | undefined)[] =
		request.questions.map((q, qi) => {
			const s = selections[qi];
			if (s === undefined || s.selected === undefined) return undefined;
			if (s.selected === OTHER) {
				const text = s.otherText.trim();
				return text === "" ? undefined : { question: q.question, answer: text };
			}
			const option = q.options[s.selected];
			return option === undefined ? undefined : { question: q.question, answer: option };
		});
	const allAnswered = entries.every((e) => e !== undefined);

	const submit = (): void => {
		if (!allAnswered) return;
		// every 已排除 undefined；flatMap 只是替类型系统再过滤一次，不改内容。
		onSubmit(entries.flatMap((e) => (e === undefined ? [] : [e])));
	};

	return (
		<div className="modal-backdrop">
			<div className="questionnaire-card" role="alertdialog" aria-modal="true">
				<p className="questionnaire-title">向用户提问</p>
				<p className="questionnaire-desc">
					模型在继续之前想先和你确认下面的选择；不想回答可以整张跳过。
				</p>

				{request.questions.map((q, qi) => (
					<div className="questionnaire-question" key={qi}>
						<p className="questionnaire-question-text">{q.question}</p>
						<div className="questionnaire-options" role="radiogroup" aria-label={q.question}>
							{q.options.map((option, oi) => (
								<button
									key={oi}
									type="button"
									role="radio"
									aria-checked={selections[qi]?.selected === oi}
									className={
										selections[qi]?.selected === oi
											? "questionnaire-option selected"
											: "questionnaire-option"
									}
									onClick={() => select(qi, oi)}
								>
									{option}
								</button>
							))}
							{/* 固定最后一项：选项覆盖不全时的自由补充出口。 */}
							<button
								type="button"
								role="radio"
								aria-checked={selections[qi]?.selected === OTHER}
								className={
									selections[qi]?.selected === OTHER
										? "questionnaire-option selected"
										: "questionnaire-option"
								}
								onClick={() => select(qi, OTHER)}
							>
								其他…
							</button>
						</div>
						{/* 选中「其他…」才出现输入框；挂载即聚焦（同 sidebar 重命名输入的约定）。 */}
						{selections[qi]?.selected === OTHER && (
							<input
								className="questionnaire-other-input"
								placeholder="补充你的答案"
								autoFocus
								value={selections[qi]?.otherText ?? ""}
								{...ime.bind}
								onChange={(e) => setOtherText(qi, e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && !ime.shouldSwallowNow()) submit();
								}}
							/>
						)}
					</div>
				))}

				<div className="questionnaire-actions">
					<button type="button" className="mini-btn" onClick={onSkip}>
						跳过
					</button>
					<button
						type="button"
						className="primary-btn"
						disabled={!allAnswered}
						onClick={submit}
					>
						提交
					</button>
				</div>
			</div>
		</div>
	);
}
