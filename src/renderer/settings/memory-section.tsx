/**
 * 设置「记忆与进化」分组：记忆分区（自原平铺页原样搬入）
 * + 长期记忆记录（MEMORY.md 查看/编辑，spec: rework-settings-layout Task 4）。
 */

import { useEffect, useState } from "react";
import { BUILTIN_MEMORY_TASK_ID } from "@shared/automation.ts";
import { EmptyState, ErrorState, LoadingState } from "../state-views.tsx";

/* ── 记忆 ──────────────────────────────────────────────────── */

/**
 * 记忆分区（spec: add-memory-system）。
 *
 * 两块数据源都自己管理、不借 settingsSnapshot（快照里没有这些键，
 * 与 WebSearchSection 不借快照的理由相同）：
 * - 「生成对话记忆」toggle = preferences.memoryEnabled，内置「记忆整理」
 *   任务的启停权威（daemon 侧写偏好时同步对齐任务状态）。
 * - 用户画像块直编 PROFILE.md：画像每晚由内置任务从对话整理，
 *   用户可在这里查看与修正（保存/重置/导入）。
 */
function MemorySection({ busy }: { readonly busy: boolean }): React.JSX.Element {
	const [enabled, setEnabled] = useState<boolean | undefined>(undefined);
	/** textarea 当前值与保存基线：「保存」只在内容变化后可点。 */
	const [profile, setProfile] = useState("");
	const [savedProfile, setSavedProfile] = useState("");
	const [loaded, setLoaded] = useState(false);
	const [error, setError] = useState<string | undefined>(undefined);
	/** 「重置」的窗内确认态：第一次点击进入确认，第二次才执行 —— 清空不可逆，防误点。 */
	const [confirmReset, setConfirmReset] = useState(false);
	/** 「立即整理」运行中：蒸馏是异步模型调用（约几十秒），不能按 IPC 返回就算完。 */
	const [distilling, setDistilling] = useState(false);

	useEffect(() => {
		Promise.all([window.kami.getMemoryEnabled(), window.kami.getProfile()])
			.then(([memory, result]) => {
				setEnabled(memory.enabled);
				setProfile(result.content);
				setSavedProfile(result.content);
				setLoaded(true);
			})
			.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
	}, []);

	// 蒸馏完成的精确信号是 runFinished（taskId 匹配内置任务）：成功后重拉画像。
	useEffect(() => {
		if (!distilling) return;
		return window.kami.onAutomationEvent((event) => {
			if (event.kind !== "runFinished" || event.taskId !== BUILTIN_MEMORY_TASK_ID) return;
			setDistilling(false);
			if (!event.success) {
				setError("记忆整理运行失败，可到「自动化」页查看运行记录");
				return;
			}
			void window.kami
				.getProfile()
				.then((result) => {
					setProfile(result.content);
					setSavedProfile(result.content);
				})
				.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
		});
	}, [distilling]);

	const distillNow = (): void => {
		setDistilling(true);
		void window.kami.runAutomationNow(BUILTIN_MEMORY_TASK_ID).catch((e: unknown) => {
			setDistilling(false);
			setError(e instanceof Error ? e.message : String(e));
		});
	};

	const toggle = (next: boolean): void => {
		const prev = enabled;
		setEnabled(next);
		void window.kami.setMemoryEnabled(next).catch((e: unknown) => {
			// 失败回滚显示值：开关是受控的，不回滚会让用户以为已经存上。
			setEnabled(prev);
			setError(e instanceof Error ? e.message : String(e));
		});
	};

	const save = (): void => {
		void window.kami
			.setProfile(profile)
			.then(() => setSavedProfile(profile))
			.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
	};

	const reset = (): void => {
		if (!confirmReset) {
			setConfirmReset(true);
			return;
		}
		setConfirmReset(false);
		void window.kami
			.resetProfile()
			.then(() => {
				setProfile("");
				setSavedProfile("");
			})
			.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
	};

	/** 导入两段组合：main 选文件读内容 → daemon 的 setProfile 写入。取消静默收回。 */
	const importMd = (): void => {
		void window.kami
			.importProfile()
			.then(async (picked) => {
				if (picked === undefined) return;
				await window.kami.setProfile(picked.content);
				setProfile(picked.content);
				setSavedProfile(picked.content);
			})
			.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
	};

	return (
		<section className="settings-section">
			<header className="settings-section-head">
				<h2>记忆</h2>
			</header>

			{error !== undefined && <ErrorState message={error} />}

			{enabled === undefined || !loaded ? (
				<LoadingState text="正在读取记忆设置…" />
			) : (
				<>
					<div className="provider-row">
						<div className="provider-main">
							<span className="provider-name">生成对话记忆</span>
							<span className="provider-meta">每晚自动整理对话要点</span>
							<span className="bar-spacer" />
							{/* 不等每晚的定时点：手动触发同一条蒸馏任务（run-now 进同一
							    串行队列）。停用态禁点——任务已暂停，跑了也没有意义。 */}
							<button
								type="button"
								className="mini-btn"
								disabled={busy || !enabled || distilling}
								title={enabled ? "现在就从最近的对话整理画像" : "先开启「生成对话记忆」"}
								onClick={distillNow}
							>
								{distilling ? "整理中…" : "立即整理"}
							</button>
							{/* 开关复用连接器页的 mcp-switch 档位（同一个开关控件，不另造类）。 */}
							<label className="mcp-switch" title={enabled ? "点击停用" : "点击启用"}>
								<input
									type="checkbox"
									checked={enabled}
									disabled={busy}
									aria-label="生成对话记忆"
									onChange={(e) => toggle(e.currentTarget.checked)}
								/>
								<span className="mcp-switch-track">
									<span className="mcp-switch-thumb" />
								</span>
							</label>
						</div>
					</div>
					<p className="settings-foot">
						开启后，内置任务「记忆整理」每晚从你的对话中整理背景信息写入下面的画像；停用即暂停该任务。
					</p>

					<div className="profile-block">
						<div className="profile-block-head">
							<span className="field-label">用户画像</span>
							<span className="bar-spacer" />
							<button
								type="button"
								className="mini-btn"
								disabled={busy || profile === savedProfile}
								title={profile === savedProfile ? "内容没有变化" : undefined}
								onClick={save}
							>
								保存
							</button>
							<button
								type="button"
								className={`mini-btn${confirmReset ? " danger" : ""}`}
								disabled={busy}
								onClick={reset}
							>
								{confirmReset ? "确认清空" : "重置"}
							</button>
							<button type="button" className="mini-btn" disabled={busy} onClick={importMd}>
								导入…
							</button>
						</div>
						<textarea
							className="profile-textarea"
							value={profile}
							disabled={busy}
							placeholder="还没有画像。开启「生成对话记忆」后会自动整理，也可以直接在这里填写。"
							onChange={(e) => {
								setProfile(e.currentTarget.value);
								// 编辑动作说明注意力在画像内容本身，挂着的清空确认就此作废。
								setConfirmReset(false);
							}}
						/>
						<p className="settings-foot">
							画像随每轮对话提供给助手，用来记住你的背景与偏好；可直接修改，保存后下一轮对话生效。
						</p>
					</div>
				</>
			)}
		</section>
	);
}

/* ── 长期记忆记录 ──────────────────────────────────────────────── */

/**
 * 长期记忆记录（MEMORY.md，spec: rework-settings-layout Task 4）。
 *
 * 交互：查看态（空显占位文案）→ 点「编辑」变 textarea → 保存/取消。
 * 有意不配重置/导入：画像有内置蒸馏任务每晚重建，清空了能长回来，
 * 所以给它兜底按钮；MEMORY.md 是用户与模型共写的白名单文件、没有
 * 重建来源，只给查看/编辑，要删进编辑态自己删。
 */
function LongTermMemorySection({ busy }: { readonly busy: boolean }): React.JSX.Element {
	/** textarea 当前值与保存基线：「保存」只在内容变化后可点（同画像口径）。 */
	const [content, setContent] = useState("");
	const [savedContent, setSavedContent] = useState("");
	const [loaded, setLoaded] = useState(false);
	const [editing, setEditing] = useState(false);
	const [error, setError] = useState<string | undefined>(undefined);

	useEffect(() => {
		window.kami
			.getMemory()
			.then((result) => {
				setContent(result.content);
				setSavedContent(result.content);
				setLoaded(true);
			})
			.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
	}, []);

	const save = (): void => {
		void window.kami
			.setMemory(content)
			.then(() => {
				setSavedContent(content);
				setEditing(false);
			})
			.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
	};

	/** 取消只回滚到保存基线：未保存的编辑本来就没落盘，不必再读文件。 */
	const cancel = (): void => {
		setContent(savedContent);
		setEditing(false);
	};

	return (
		<section className="settings-section">
			<header className="settings-section-head">
				<h2>长期记忆记录</h2>
			</header>

			{error !== undefined && <ErrorState message={error} />}

			{!loaded ? (
				<LoadingState text="正在读取长期记忆…" />
			) : (
				<div className="profile-block">
					<div className="profile-block-head">
						<span className="field-label">MEMORY.md</span>
						<span className="bar-spacer" />
						{editing ? (
							<>
								<button
									type="button"
									className="mini-btn"
									disabled={busy || content === savedContent}
									title={content === savedContent ? "内容没有变化" : undefined}
									onClick={save}
								>
									保存
								</button>
								<button type="button" className="mini-btn" disabled={busy} onClick={cancel}>
									取消
								</button>
							</>
						) : (
							<button
								type="button"
								className="mini-btn"
								disabled={busy}
								onClick={() => setEditing(true)}
							>
								编辑
							</button>
						)}
					</div>
					{editing ? (
						<textarea
							className="profile-textarea"
							value={content}
							disabled={busy}
							placeholder="一行一条，写下希望 AI 长期记住的偏好与决定。"
							onChange={(e) => setContent(e.currentTarget.value)}
						/>
					) : (
						/* 查看态复用画像文本框档位：div 挂同一 class，只补 pre-wrap（见 index.css）。 */
						<div className="profile-textarea profile-view">
							{savedContent === "" ? (
								<EmptyState title="暂无内容，点击编辑添加" />
							) : (
								savedContent
							)}
						</div>
					)}
					<p className="settings-foot">AI 主动记下的偏好与决定，可随时修改；保存后下一轮对话生效。</p>
				</div>
			)}
		</section>
	);
}

/* ── 分组出口 ────────────────────────────────────────────────────── */

export function MemoryEvolutionSection({ busy }: { readonly busy: boolean }): React.JSX.Element {
	return (
		<>
			<MemorySection busy={busy} />
			<LongTermMemorySection busy={busy} />
		</>
	);
}
