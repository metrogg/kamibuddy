/**
 * 定时任务管理页（侧栏「自动化」入口）。骨架复用 .settings
 * （同 diagnostics-view 的做法）：返回钮 + 标题 + 右上「新建任务」。
 *
 * 列表数据的唯一来源是 daemon（automationList），本页不做调度计算 ——
 * 下次运行时间直接显示 daemon 算好的 nextRunAt；调度摘要用 shared 的
 * scheduleSummary（与对话内工具回复同一句话，见 shared/automation.ts）。
 *
 * 刷新策略：挂载拉一次 + 订阅 automationEvent（changed / runFinished 都重拉）。
 * 订阅放本页而不是 App：只有本页需要任务列表的最新态，
 * App 层只关心 runFinished 的 toast 与侧栏未读。
 *
 * 本页只 import @shared（AGENTS.md §1.3）。
 */

import { useCallback, useEffect, useState } from "react";
import type { AutomationTask, Schedule } from "@shared/automation.ts";
import { scheduleSummary, validateSchedule } from "@shared/automation.ts";
import { AUTOMATION_TEMPLATES, type AutomationTemplate } from "@shared/automation-templates.ts";
import type { AutomationSaveInput } from "@shared/ipc.ts";
import { formatMessageTime } from "@shared/message-time.ts";
import { IconBack, IconChevronDown, IconClose, IconPlus } from "./icons.tsx";
import { EmptyState, ErrorState, LoadingState } from "./state-views.tsx";
import type { ToastType } from "./toast.tsx";
import { useModalFocus } from "./use-modal-focus.ts";

interface AutomationsViewProps {
	/** 当前工作空间（新建表单 cwd 的默认值）。瞬态未就绪时为 undefined。 */
	readonly cwd: string | undefined;
	readonly onClose: () => void;
	/** 点击运行记录：按 sessionId 定位并恢复对应会话（App 侧既有 resume 链路）。 */
	readonly onResumeSession: (sessionId: string) => void;
	readonly onToast: (text: string, type?: ToastType) => void;
}

function errorText(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}

/* ── 表单草稿 ────────────────────────────────────────────────── */

/**
 * 表单草稿：四种调度的参数位并存，保存时按 scheduleType 取一份组装。
 * 比「切换类型就丢参数」宽容 —— 用户点错类型再切回来，已填的值还在。
 */
interface FormDraft {
	readonly id?: string;
	name: string;
	prompt: string;
	scheduleType: Schedule["type"];
	/** datetime-local 的本地值（YYYY-MM-DDTHH:mm）。 */
	onceAt: string;
	intervalMinutes: string;
	dailyTime: string;
	weeklyTime: string;
	weekdays: readonly number[];
	cwd: string;
}

/** 星期 toggle 组：周一开头（中文语境惯例周序，与 scheduleSummary 的展示序一致）。 */
const WEEKDAY_TOGGLES = [
	{ day: 1, label: "一" },
	{ day: 2, label: "二" },
	{ day: 3, label: "三" },
	{ day: 4, label: "四" },
	{ day: 5, label: "五" },
	{ day: 6, label: "六" },
	{ day: 0, label: "日" },
] as const;

const SCHEDULE_TYPES = [
	{ type: "once", label: "一次性" },
	{ type: "interval", label: "按间隔" },
	{ type: "daily", label: "每天" },
	{ type: "weekly", label: "每周" },
] as const;

/** epoch ms → datetime-local input 的本地值（input 只认本地墙上时钟，不做 UTC 转换）。 */
function toLocalInputValue(ms: number): string {
	const d = new Date(ms);
	const p = (n: number): string => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function emptyDraft(cwd: string): FormDraft {
	return {
		name: "",
		prompt: "",
		scheduleType: "daily",
		onceAt: "",
		intervalMinutes: "30",
		dailyTime: "09:00",
		weeklyTime: "09:00",
		weekdays: [1, 2, 3, 4, 5],
		cwd,
	};
}

function draftFromTask(task: AutomationTask): FormDraft {
	const s = task.schedule;
	return {
		id: task.id,
		name: task.name,
		prompt: task.prompt,
		scheduleType: s.type,
		onceAt: s.type === "once" ? toLocalInputValue(s.at) : "",
		intervalMinutes: s.type === "interval" ? String(s.everyMinutes) : "30",
		dailyTime: s.type === "daily" ? s.time : "09:00",
		weeklyTime: s.type === "weekly" ? s.time : "09:00",
		weekdays: s.type === "weekly" ? [...s.weekdays] : [1, 2, 3, 4, 5],
		cwd: task.cwd,
	};
}

/** 模板 → 表单草稿：名称 / 内容 / 调度全部预填，用户改完保存（cwd 用当前工作空间）。 */
function draftFromTemplate(template: AutomationTemplate, cwd: string): FormDraft {
	const s = template.schedule;
	return {
		name: template.name,
		prompt: template.prompt,
		scheduleType: s.type,
		onceAt: s.type === "once" ? toLocalInputValue(s.at) : "",
		intervalMinutes: s.type === "interval" ? String(s.everyMinutes) : "30",
		dailyTime: s.type === "daily" ? s.time : "09:00",
		weeklyTime: s.type === "weekly" ? s.time : "09:00",
		weekdays: s.type === "weekly" ? [...s.weekdays] : [1, 2, 3, 4, 5],
		cwd,
	};
}

/**
 * 草稿 → Schedule。先过 shared 的 validateSchedule（与 daemon 双闸，
 * 错误文案同源），返回给用户看的错误；合法返回 schedule。
 */
function buildSchedule(draft: FormDraft): { schedule: Schedule } | { error: string } {
	let schedule: Schedule;
	switch (draft.scheduleType) {
		case "once": {
			if (draft.onceAt === "") return { error: "请选择运行时刻" };
			const at = new Date(draft.onceAt).getTime();
			if (Number.isNaN(at)) return { error: "运行时刻无法识别" };
			schedule = { type: "once", at };
			break;
		}
		case "interval":
			schedule = { type: "interval", everyMinutes: Number(draft.intervalMinutes) };
			break;
		case "daily":
			schedule = { type: "daily", time: draft.dailyTime };
			break;
		case "weekly":
			schedule = { type: "weekly", time: draft.weeklyTime, weekdays: draft.weekdays };
			break;
	}
	const invalid = validateSchedule(schedule);
	return invalid === undefined ? { schedule } : { error: invalid };
}

/* ── 页面 ────────────────────────────────────────────────────── */

export function AutomationsView({
	cwd,
	onClose,
	onResumeSession,
	onToast,
}: AutomationsViewProps): React.JSX.Element {
	const [tasks, setTasks] = useState<readonly AutomationTask[] | undefined>(undefined);
	const [error, setError] = useState<string | undefined>(undefined);
	/** 行操作（启停/删除）在途：全局禁用行按钮，避免连点发出重复请求。 */
	const [busy, setBusy] = useState(false);
	/** 点了「立即运行」且尚未收到 runFinished 的任务 id（运行中禁用再点）。 */
	const [runningIds, setRunningIds] = useState<ReadonlySet<string>>(new Set());
	/** 展开运行记录的任务 id：同一时刻至多展开一行，避免列表越拉越长。 */
	const [expandedId, setExpandedId] = useState<string | undefined>(undefined);
	/** 表单弹层草稿：undefined = 关闭；无 id = 新建，有 id = 编辑。 */
	const [draft, setDraft] = useState<FormDraft | undefined>(undefined);
	/** 模板选择浮层（L36）：选中后预填表单草稿。 */
	const [tplOpen, setTplOpen] = useState(false);
	const [formError, setFormError] = useState<string | undefined>(undefined);
	const [saving, setSaving] = useState(false);

	const load = useCallback(async (): Promise<void> => {
		try {
			setTasks(await window.kami.listAutomations());
			setError(undefined);
		} catch (e) {
			setError(errorText(e));
		}
	}, []);

	useEffect(() => {
		void load();
		const off = window.kami.onAutomationEvent((event) => {
			if (event.kind === "runFinished") {
				setRunningIds((prev) => {
					if (!prev.has(event.taskId)) return prev;
					const next = new Set(prev);
					next.delete(event.taskId);
					return next;
				});
			}
			// changed 与 runFinished（追加运行记录）都让列表过期，一律重拉。
			void load();
		});
		return off;
	}, [load]);

	/** 行操作统一出口：失败透出 toast（如 daemon 拒删运行中任务），成功重拉列表。 */
	const runRowAction = useCallback(
		(action: () => Promise<unknown>): void => {
			setBusy(true);
			void action()
				.then(load)
				.catch((e: unknown) => onToast(errorText(e), "error"))
				.finally(() => setBusy(false));
		},
		[load, onToast],
	);

	const runNow = useCallback(
		(task: AutomationTask): void => {
			setBusy(true);
			window.kami
				.runAutomationNow(task.id)
				.then(() => {
					setRunningIds((prev) => new Set(prev).add(task.id));
					onToast(`任务「${task.name}」已加入运行队列`);
				})
				.catch((e: unknown) => onToast(errorText(e), "error"))
				.finally(() => setBusy(false));
		},
		[onToast],
	);

	const openCreate = useCallback((): void => {
		setFormError(undefined);
		setDraft(emptyDraft(cwd ?? ""));
	}, [cwd]);

	const openTemplate = useCallback((template: AutomationTemplate): void => {
		setTplOpen(false);
		setFormError(undefined);
		setDraft(draftFromTemplate(template, cwd ?? ""));
	}, [cwd]);

	const openEdit = useCallback((task: AutomationTask): void => {
		setFormError(undefined);
		setDraft(draftFromTask(task));
	}, []);

	const save = useCallback((): void => {
		if (draft === undefined || saving) return;
		const name = draft.name.trim();
		if (name === "") {
			setFormError("请填写任务名称");
			return;
		}
		if (draft.prompt.trim() === "") {
			setFormError("请填写任务内容");
			return;
		}
		const taskCwd = draft.cwd.trim();
		if (taskCwd === "") {
			setFormError("请填写工作目录");
			return;
		}
		const built = buildSchedule(draft);
		if ("error" in built) {
			setFormError(built.error);
			return;
		}
		// AutomationSaveInput 的 id 可选：新建不带 id 字段，与编辑的 payload 区分开。
		const base = { name, prompt: draft.prompt, schedule: built.schedule, cwd: taskCwd };
		const input: AutomationSaveInput =
			draft.id === undefined ? base : { id: draft.id, ...base };
		setSaving(true);
		setFormError(undefined);
		window.kami
			.saveAutomation(input)
			.then(() => {
				setDraft(undefined);
				void load();
			})
			// daemon 的校验是第二道闸：错误在表单内原位显示，改完直接重试。
			.catch((e: unknown) => setFormError(errorText(e)))
			.finally(() => setSaving(false));
	}, [draft, saving, load]);

	const now = Date.now();

	return (
		<main className="settings">
			<header className="settings-head">
				<button type="button" className="bar-btn" aria-label="返回" onClick={onClose}>
					<IconBack size={17} />
				</button>
				<h1>定时任务</h1>
				<span className="bar-spacer" />
				<button type="button" className="mini-btn" onClick={() => setTplOpen(true)}>
					从模板
				</button>
				<button type="button" className="mini-btn" onClick={openCreate}>
					<IconPlus size={13} />
					新建任务
				</button>
			</header>

			<div className="settings-body">
				{/*
				 * 三态互斥（照 skills-view.tsx 的标尺）：失败 → 就地错误卡 + 重试；未就绪 →
				 * 加载态；数据回来且为空 → 空态。原来错误条与「正在读取…」并存 —— 拉取失败时
				 * tasks 永远停在 undefined，页面永久卡在加载态，且没有任何恢复出口
				 *（DESIGN.md §4：失败就地呈现 + 重试动作）。
				 */}
				{error !== undefined ? (
					<ErrorState message={error} onRetry={() => void load()} />
				) : tasks === undefined ? (
					<LoadingState />
				) : tasks.length === 0 ? (
					<EmptyState
						title="还没有定时任务。"
						description="新建一个任务，让它按调度在对应工作空间里自动运行。"
						action={
							<button type="button" className="primary-btn" onClick={openCreate}>
								新建任务
							</button>
						}
					/>
				) : (
					<div className="auto-list">
						{tasks.map((task) => (
							<AutomationRow
								key={task.id}
								task={task}
								now={now}
								busy={busy}
								running={runningIds.has(task.id)}
								expanded={expandedId === task.id}
								onToggleExpand={() =>
									setExpandedId((prev) => (prev === task.id ? undefined : task.id))
								}
								onToggle={() =>
									runRowAction(() => window.kami.toggleAutomation(task.id))
								}
								onRunNow={() => runNow(task)}
								onEdit={() => openEdit(task)}
								onDelete={() =>
									runRowAction(() => window.kami.deleteAutomation(task.id))
								}
								onOpenRun={onResumeSession}
							/>
						))}
					</div>
				)}
			</div>

			{draft !== undefined && (
				<AutomationForm
					draft={draft}
					error={formError}
					saving={saving}
					onChange={setDraft}
					onSave={save}
					onCancel={() => setDraft(undefined)}
				/>
			)}

			{tplOpen && (
				<TemplatePicker
					onSelect={openTemplate}
					onCancel={() => setTplOpen(false)}
				/>
			)}
		</main>
	);
}

/* ── 模板选择浮层（L36） ─────────────────────────────────────── */

function TemplatePicker({
	onSelect,
	onCancel,
}: {
	readonly onSelect: (template: AutomationTemplate) => void;
	readonly onCancel: () => void;
}): React.JSX.Element {
	const cardRef = useModalFocus();

	// Esc 关闭：与表单卡同口径（只读列表无输入态，无需放行）。
	useEffect(() => {
		const onKey = (event: KeyboardEvent): void => {
			if (event.key === "Escape") onCancel();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onCancel]);

	return (
		<div
			className="modal-backdrop"
			onMouseDown={(e) => {
				if (e.target === e.currentTarget) onCancel();
			}}
		>
			<div
				className="auto-form-card auto-tpl-card"
				role="dialog"
				aria-modal="true"
				aria-label="从模板添加定时任务"
				ref={cardRef}
			>
				<button type="button" className="bar-btn auto-tpl-close" aria-label="关闭" onClick={onCancel}>
					<IconClose size={15} />
				</button>
				<h2 className="save-space-title">从模板添加</h2>
				<div className="auto-tpl-list">
					{AUTOMATION_TEMPLATES.map((template) => (
						<button
							key={template.id}
							type="button"
							className="auto-tpl-item"
							title={template.prompt}
							onClick={() => onSelect(template)}
						>
							<span className="auto-tpl-name">{template.name}</span>
							<span className="auto-tpl-desc">{template.description}</span>
							<span className="auto-tpl-schedule">{scheduleSummary(template.schedule)}</span>
						</button>
					))}
				</div>
				<p className="field-hint">选中后进入编辑表单，名称、内容与调度都可以改。</p>
			</div>
		</div>
	);
}

/* ── 任务行 ──────────────────────────────────────────────────── */

function AutomationRow({
	task,
	now,
	busy,
	running,
	expanded,
	onToggleExpand,
	onToggle,
	onRunNow,
	onEdit,
	onDelete,
	onOpenRun,
}: {
	readonly task: AutomationTask;
	readonly now: number;
	readonly busy: boolean;
	readonly running: boolean;
	readonly expanded: boolean;
	readonly onToggleExpand: () => void;
	readonly onToggle: () => void;
	readonly onRunNow: () => void;
	readonly onEdit: () => void;
	readonly onDelete: () => void;
	readonly onOpenRun: (sessionId: string) => void;
}): React.JSX.Element {
	// 运行记录新→旧倒序展示（存储侧是追加序，展示语义是「最近运行」）。
	const runs = [...task.runs].sort((a, b) => b.startedAt - a.startedAt);
	return (
		<div className="auto-row">
			<div className="auto-row-main">
				<button
					type="button"
					className="auto-row-expand"
					aria-label={expanded ? "收起运行记录" : "展开运行记录"}
					aria-expanded={expanded}
					onClick={onToggleExpand}
				>
					<IconChevronDown
						size={13}
						className={expanded ? "auto-chevron open" : "auto-chevron"}
					/>
				</button>
				<div className="auto-row-text">
					<div className="auto-row-title">
						<span className="auto-row-name" title={task.prompt}>
							{task.name}
						</span>
						{task.builtin === true && (
							<span className="auto-badge" title="系统内置任务，由设置页的记忆开关管辖">
								内置
							</span>
						)}
						{task.status === "paused" && <span className="auto-badge">已暂停</span>}
						{task.status === "missed" && (
							<span className="auto-badge auto-badge-missed">已错过</span>
						)}
					</div>
					<div className="auto-row-meta">
						{scheduleSummary(task.schedule)}
						{" · 下次运行 "}
						{task.nextRunAt === undefined
							? "—"
							: formatMessageTime(task.nextRunAt, now)}
					</div>
				</div>
				<div className="auto-row-ops">
					<button type="button" className="mini-btn" disabled={busy} onClick={onToggle}>
						{task.status === "active" ? "暂停" : "启用"}
					</button>
					<button
						type="button"
						className="mini-btn"
						disabled={busy || running}
						title={running ? "正在运行" : undefined}
						onClick={onRunNow}
					>
						{running ? "运行中…" : "立即运行"}
					</button>
					<button
						type="button"
						className="mini-btn"
						disabled={busy || task.builtin === true}
						title={task.builtin === true ? "内置任务由系统维护，不可编辑" : undefined}
						onClick={onEdit}
					>
						编辑
					</button>
					<button
						type="button"
						className="mini-btn danger"
						disabled={busy || task.builtin === true}
						title={task.builtin === true ? "内置任务不可删除，可在设置里停用" : undefined}
						onClick={onDelete}
					>
						删除
					</button>
				</div>
			</div>
			{expanded && (
				<div className="auto-runs">
					{runs.length === 0 ? (
						<EmptyState title="还没有运行记录。" />
					) : (
						runs.map((run) =>
							run.sessionId === "" ? (
								// 装配失败的运行没有会话可跳，只留记录不可点击。
								<div key={run.startedAt} className="auto-run-row auto-run-static">
									<span className="auto-run-time">
										{formatMessageTime(run.startedAt, now)}
									</span>
									<span className="auto-run-badge bad">失败</span>
									{run.error !== undefined && (
										<span className="auto-run-error">{run.error}</span>
									)}
								</div>
							) : (
								<button
									key={run.startedAt}
									type="button"
									className="auto-run-row"
									title="打开本次运行的会话"
									onClick={() => onOpenRun(run.sessionId)}
								>
									<span className="auto-run-time">
										{formatMessageTime(run.startedAt, now)}
									</span>
									<span
										className={
											run.success ? "auto-run-badge ok" : "auto-run-badge bad"
										}
									>
										{run.success ? "成功" : "失败"}
									</span>
									{run.error !== undefined && (
										<span className="auto-run-error">{run.error}</span>
									)}
								</button>
							),
						)
					)}
				</div>
			)}
		</div>
	);
}

/* ── 新建 / 编辑表单弹层 ─────────────────────────────────────── */

function AutomationForm({
	draft,
	error,
	saving,
	onChange,
	onSave,
	onCancel,
}: {
	readonly draft: FormDraft;
	readonly error: string | undefined;
	readonly saving: boolean;
	readonly onChange: (draft: FormDraft) => void;
	readonly onSave: () => void;
	readonly onCancel: () => void;
}): React.JSX.Element {
	const patch = (part: Partial<FormDraft>): void => onChange({ ...draft, ...part });

	// 焦点陷阱 / 归还 / 背景 inert 交给共享 hook；落点用默认值（首个可聚焦元素 = 「名称」输入框）。
	const cardRef = useModalFocus();

	// Esc 关闭：遮罩不响应点击是防误触（表单内容多，误触一次全丢），
	// 但键盘用户需要一个非指针的退出路径，语义与「取消」按钮一致。
	// 保存中不关：与「取消」按钮 disabled 同口径，避免请求在途时弹层消失。
	useEffect(() => {
		const onKey = (event: KeyboardEvent): void => {
			if (event.key === "Escape" && !saving) onCancel();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [saving, onCancel]);

	return (
		// 遮罩不响应点击关闭：表单内容多，误触一次全丢，只能从按钮退出
		// （与权限弹窗「不许悬空」的考虑一致）。
		<div className="modal-backdrop">
			<div className="auto-form-card" role="dialog" aria-modal="true" aria-labelledby="auto-form-title" ref={cardRef}>
				<h2 className="save-space-title" id="auto-form-title">
					{draft.id === undefined ? "新建定时任务" : "编辑定时任务"}
				</h2>

				<div className="field">
					<label className="field-label" htmlFor="auto-name">
						名称
					</label>
					<input
						id="auto-name"
						type="text"
						value={draft.name}
						placeholder="例如：每日工作日报"
						onChange={(e) => patch({ name: e.currentTarget.value })}
					/>
				</div>

				<div className="field">
					<label className="field-label" htmlFor="auto-prompt">
						任务内容
					</label>
					<textarea
						id="auto-prompt"
						value={draft.prompt}
						placeholder="运行时要执行的内容。任务在未来独立运行，请把时间、路径、对象写全。"
						onChange={(e) => patch({ prompt: e.currentTarget.value })}
					/>
					<span className="field-hint">
						每次运行都是一条全新会话，看不到当前对话的上下文。
					</span>
				</div>

				<div className="field">
					<span className="field-label">调度</span>
					<div className="auto-toggle-row">
						{SCHEDULE_TYPES.map(({ type, label }) => (
							<button
								key={type}
								type="button"
								className={
									draft.scheduleType === type ? "mini-btn active" : "mini-btn"
								}
								aria-pressed={draft.scheduleType === type}
								onClick={() => patch({ scheduleType: type })}
							>
								{label}
							</button>
						))}
					</div>
				</div>

				{draft.scheduleType === "once" && (
					<div className="field">
						<label className="field-label" htmlFor="auto-once">
							运行时刻
						</label>
						<input
							id="auto-once"
							type="datetime-local"
							value={draft.onceAt}
							onChange={(e) => patch({ onceAt: e.currentTarget.value })}
						/>
					</div>
				)}

				{draft.scheduleType === "interval" && (
					<div className="field">
						<label className="field-label" htmlFor="auto-interval">
							间隔分钟数
						</label>
						<input
							id="auto-interval"
							type="number"
							min={1}
							step={1}
							value={draft.intervalMinutes}
							onChange={(e) => patch({ intervalMinutes: e.currentTarget.value })}
						/>
					</div>
				)}

				{draft.scheduleType === "daily" && (
					<div className="field">
						<label className="field-label" htmlFor="auto-daily">
							时间
						</label>
						<input
							id="auto-daily"
							type="time"
							value={draft.dailyTime}
							onChange={(e) => patch({ dailyTime: e.currentTarget.value })}
						/>
					</div>
				)}

				{draft.scheduleType === "weekly" && (
					<>
						<div className="field">
							<label className="field-label" htmlFor="auto-weekly">
								时间
							</label>
							<input
								id="auto-weekly"
								type="time"
								value={draft.weeklyTime}
								onChange={(e) => patch({ weeklyTime: e.currentTarget.value })}
							/>
						</div>
						<div className="field">
							<span className="field-label">星期</span>
							<div className="auto-toggle-row">
								{WEEKDAY_TOGGLES.map(({ day, label }) => {
									const selected = draft.weekdays.includes(day);
									return (
										<button
											key={day}
											type="button"
											className={selected ? "mini-btn active" : "mini-btn"}
											aria-pressed={selected}
											onClick={() =>
												patch({
													weekdays: selected
														? draft.weekdays.filter((d) => d !== day)
														: [...draft.weekdays, day],
												})
											}
										>
											{label}
										</button>
									);
								})}
							</div>
						</div>
					</>
				)}

				<div className="field">
					<label className="field-label" htmlFor="auto-cwd">
						工作目录
					</label>
					<input
						id="auto-cwd"
						type="text"
						value={draft.cwd}
						onChange={(e) => patch({ cwd: e.currentTarget.value })}
					/>
					<span className="field-hint">任务运行时所在的工作空间目录。</span>
				</div>

				{error !== undefined && <ErrorState message={error} />}

				<div className="save-space-actions">
					<button type="button" className="mini-btn" disabled={saving} onClick={onCancel}>
						取消
					</button>
					<button type="button" className="primary-btn" disabled={saving} onClick={onSave}>
						{saving ? "保存中…" : "保存"}
					</button>
				</div>
			</div>
		</div>
	);
}
