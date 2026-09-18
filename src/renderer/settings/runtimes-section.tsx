/**
 * 设置「内置运行时」一级分区（spec: add-managed-runtimes Task 3.1 / 阶段 7）。
 *
 * 形态照 WorkBuddy 的 RuntimeToolsCard（security-center-panel__runtime-card）：
 * 分区头一行总开关，下面逐运行时一行（名称 / 版本 / 状态 / 用途）+ 行内开关 +
 * 「诊断」与一个随状态而变的主动作。**总开关关闭 ⇒ 子项整行压暗且开关不可点**，
 * 但逐项开关的**原值保留**（重新打开总开关后回到用户上次的选择）——
 * WorkBuddy 的 effectiveEnabled = 总开关 && 子开关 就是这个语义。
 *
 * ── 阶段 7：三个运行时改成「纯按需下载」（没有任何静默自动下载）──
 * 每项默认态是**未安装**（不是「正在准备 / 将会自动准备」），主动作随之而变：
 *   - 未安装（missing）→ 「安装」：标题与 meta 行先摆出**体积量级 + 需联网**，
 *     用户点之前就知道要下多少；
 *   - 安装失败（failed）→ 「重试安装」；
 *   - 就绪（ready）→ 「重置并重新安装」（保留，= 重新下载安装；带一次确认）。
 * 安装期间这一行换成「转圈 + 进度文案 + 取消」；失败原因由**清单的 status.detail**
 * （内核落盘的失败相位 + 底层错误）与错误条共同给出，都是可执行的。
 *
 * 数据只有一个来源：daemon 的 runtimesSnapshot（core/runtime-inventory.ts 的
 * collectRuntimeInventory）。本页不做任何二次判断 —— 状态文案经
 * shared/runtimes.ts 的 runtimeStatusText 渲染（**带 status.detail**：失败相位与底层
 * 错误原文，例如下载 URL，这是用户排查要看的），而模型侧的 `python_env` 段只用
 * RUNTIME_STATUS_LABELS 的**标签**、不带 detail（细节归界面，人话归模型；
 * 见 renderRuntimeEnvSection 的注释与 ARCHITECTURE §4.16）。
 * 两侧共用同一份判据（classify），所以「已被用户禁用」不可能在这边显示成「找不到」，
 * 未安装也不可能显示成「自动准备」—— 变的只是细节的详略，不是判定。
 *
 * 本页只 import @shared（AGENTS.md §1.3），一个 pi 概念都不认识。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { RuntimeDiagnosticsText, RuntimeInstallProgress, RuntimeInventory } from "@shared/runtimes.ts";
import { runtimeStatusText } from "@shared/runtimes.ts";
import { useCopyWithTick } from "../copy-tick.ts";
import { IconCheck, IconCopy, IconFolder } from "../icons.tsx";
import { ErrorState, LoadingState, Spinner } from "../state-views.tsx";

function errorText(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}

/** 复制按钮必须是独立组件（用 useCopyWithTick，写进箭头函数会违反 hooks 规则）。 */
function ReportCopyButton({ text }: { readonly text: string }): React.JSX.Element {
	const { copied, copy } = useCopyWithTick();
	return (
		<button
			type="button"
			className="mini-btn"
			aria-label={copied ? "已复制诊断报告" : "复制诊断报告"}
			onClick={() => void copy(text)}
		>
			{copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
			{copied ? "已复制" : "复制报告"}
		</button>
	);
}

interface RuntimesSectionProps {
	/** 全设置卡的写操作忙态（与本分区自己的忙态取或）。 */
	readonly busy: boolean;
}

export function RuntimesSection({ busy }: RuntimesSectionProps): React.JSX.Element {
	const [inventory, setInventory] = useState<RuntimeInventory | undefined>(undefined);
	const [error, setError] = useState<string | undefined>(undefined);
	/**
	 * 本分区自己的忙态：安装 / 重置要「联网下载 → 校验 → 安装」，可能几分钟。
	 * 不把这几分钟塞进全卡的 busy（那会让用户以为整张设置卡都卡住了）。
	 */
	const [localBusy, setLocalBusy] = useState(false);
	/** 当前展开的诊断报告（undefined = 没有展开项）。 */
	const [report, setReport] = useState<RuntimeDiagnosticsText | undefined>(undefined);
	/** 正在取诊断的运行时的 id（取报告要 spawn 深度探测，给按钮一个转圈态）。 */
	const [diagnosingId, setDiagnosingId] = useState<string | undefined>(undefined);
	/** 行内二次确认重置的运行时 id（重置耗时且会重建环境，值得一次显式确认）。 */
	const [confirmingResetId, setConfirmingResetId] = useState<string | undefined>(undefined);
	/** 正在重置的运行时 id（重置要联网，可能几分钟 —— 必须给一句显式进度文案）。 */
	const [resettingId, setResettingId] = useState<string | undefined>(undefined);
	/**
	 * 安装进度（推送驱动，所以用户切走设置页再切回来仍能看到「正在安装」；
	 * 同一时刻只可能有一个安装：按钮在忙态下禁用，daemon 也按 id 拒绝重入）。
	 */
	const [installProgress, setInstallProgress] = useState<RuntimeInstallProgress | undefined>(undefined);
	/**
	 * 已点过「取消」的 id：安装的 invoke 会以 AbortError reject —— 那是用户自己的动作，
	 * 不是失败，不能弹成错误。
	 */
	const cancelRequested = useRef<Record<string, boolean>>({});

	const load = useCallback(async (): Promise<void> => {
		try {
			setInventory(await window.kami.runtimesSnapshot());
			setError(undefined);
		} catch (e) {
			setError(errorText(e));
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	// 进度推送：running 更新这一行的进度文案；终态（done/failed/cancelled）后
	// 回读清单 —— 状态与失败原因是磁盘事实，不靠这条推送自己拼。
	useEffect(
		() =>
			window.kami.onRuntimeInstallProgress((update) => {
				setInstallProgress(update);
				if (update.kind !== "running") void load();
			}),
		[load],
	);

	const disabled = busy || localBusy;
	const installingId = installProgress?.kind === "running" ? installProgress.id : undefined;

	/** 三个写操作的共同包装：忙态 → 调用 → 用返回值替换清单（daemon 已重采集）。 */
	const run = useCallback((action: () => Promise<RuntimeInventory>): void => {
		setLocalBusy(true);
		setError(undefined);
		action()
			.then(setInventory)
			.catch((e: unknown) => setError(errorText(e)))
			.finally(() => setLocalBusy(false));
	}, []);

	/**
	 * 安装单独一条链路（不走 run）：它要几分钟，期间必须在行内留下显式进度文案，
	 * 否则只剩一堆禁用控件，用户分不清「在装」还是「卡死了」。
	 */
	const install = (id: string): void => {
		setReport(undefined);
		setError(undefined);
		setInstallProgress({ id, kind: "running", message: "正在下载并安装…需联网。" });
		setLocalBusy(true);
		window.kami
			.runtimeInstall(id)
			.then(setInventory)
			.catch((e: unknown) => {
				// 用户主动取消 ⇒ AbortError 不是失败；状态由清单回读（仍是「未安装」）。
				if (cancelRequested.current[id] === true) return;
				setError(errorText(e));
			})
			.finally(() => {
				delete cancelRequested.current[id];
				setInstallProgress(undefined);
				setLocalBusy(false);
				void load();
			});
	};

	const cancelInstall = (id: string): void => {
		cancelRequested.current[id] = true;
		window.kami
			.runtimeCancelInstall(id)
			.catch((e: unknown) => setError(errorText(e)));
	};

	const diagnose = (id: string): void => {
		setDiagnosingId(id);
		setError(undefined);
		window.kami
			.runtimeDiagnostics(id)
			.then(setReport)
			.catch((e: unknown) => setError(errorText(e)))
			.finally(() => setDiagnosingId(undefined));
	};

	/**
	 * 重置单独一条链路（不走 run）：它要几分钟，期间必须在行内留下显式进度文案，
	 * 否则只剩一堆禁用控件，用户分不清「在装」还是「卡死了」。
	 */
	const reset = (id: string): void => {
		setConfirmingResetId(undefined);
		setReport(undefined);
		setResettingId(id);
		setLocalBusy(true);
		setError(undefined);
		window.kami
			.runtimeReset(id)
			.then(setInventory)
			.catch((e: unknown) => setError(errorText(e)))
			.finally(() => {
				setResettingId(undefined);
				setLocalBusy(false);
			});
	};

	return (
		<section className="settings-section">
			<header className="settings-section-head">
				<h2>内置运行时</h2>
				{inventory !== undefined && (
					<label
						className="mcp-switch"
						title={inventory.master ? "点击关闭：三个运行时都不再注入" : "点击开启"}
					>
						<input
							type="checkbox"
							checked={inventory.master}
							disabled={disabled}
							aria-label="内置运行时总开关"
							onChange={(e) => run(() => window.kami.setRuntimeMaster(e.currentTarget.checked))}
						/>
						<span className="mcp-switch-track">
							<span className="mcp-switch-thumb" />
						</span>
					</label>
				)}
			</header>

			{/* 三态互斥（DESIGN.md §4）：未就绪时失败只渲染错误态 + 重试，不与加载态同框。 */}
			{inventory === undefined ? (
				error !== undefined ? (
					<ErrorState message={error} onRetry={() => void load()} />
				) : (
					<LoadingState text="正在读取运行时状态…" />
				)
			) : (
				<>
					{/* 写操作失败的透出位：数据已就绪，只与内容并存。 */}
					{error !== undefined && <ErrorState message={error} />}

					<div>
						{inventory.items.map((item) => {
							// 总开关关 ⇒ 整行压暗、开关不可点；逐项原值保留（见文件头）。
							const rowOff = !inventory.master;
							const confirming = confirmingResetId === item.id;
							// 「未安装 / 安装失败」都在点之前先告诉用户要下多少（体积量级 + 需联网）。
							const needsInstall =
								item.status.kind === "missing" || item.status.kind === "failed";
							return (
								<div key={item.id} className={`provider-row${rowOff ? " runtime-row-off" : ""}`}>
									<div className="provider-main">
										<span className={`provider-dot${item.status.kind === "ready" ? " on" : ""}`} />
										<span className="provider-name">{item.label}</span>
										<span className="provider-tag">{item.version}</span>
										<span className="bar-spacer" />
										{installingId === item.id ? (
											<>
												<Spinner />
												<span className="stat-hint">
													{installProgress?.message ?? "正在安装…"}
												</span>
												<button
													type="button"
													className="mini-btn"
													onClick={() => cancelInstall(item.id)}
												>
													取消
												</button>
											</>
										) : resettingId === item.id ? (
											<span className="stat-hint">重置中…需联网下载。</span>
										) : confirming ? (
											<>
												<span className="stat-hint">
													确认重置并重新下载？需联网，{item.downloadSizeHint}。
												</span>
												<button
													type="button"
													className="mini-btn danger"
													disabled={disabled}
													onClick={() => reset(item.id)}
												>
													重置
												</button>
												<button
													type="button"
													className="mini-btn"
													disabled={disabled}
													onClick={() => setConfirmingResetId(undefined)}
												>
													取消
												</button>
											</>
										) : (
											<>
												{/* 总开关关闭时整行压暗 ⇒ 操作也必须跟着不可点：只灰不锁会让人
												    以为「点了没反应是 bug」。要修环境先打开总开关（对齐 WorkBuddy
												    的 RuntimeToolsCard：总开关关掉后子项一律不可交互）。 */}
												<button
													type="button"
													className="mini-btn"
													disabled={disabled || rowOff || diagnosingId !== undefined}
													title="生成可复制的诊断报告（含版本 / 路径 / 缺失项 / 最近失败 / 下一步）"
													onClick={() => diagnose(item.id)}
												>
													{diagnosingId === item.id ? "诊断中…" : "诊断"}
												</button>
												{item.status.kind === "missing" ? (
													<button
														type="button"
														className="mini-btn"
														disabled={disabled || rowOff}
														title={`按需安装，需要联网下载：${item.downloadSizeHint}`}
														onClick={() => install(item.id)}
													>
														安装
													</button>
												) : item.status.kind === "failed" ? (
													<button
														type="button"
														className="mini-btn"
														disabled={disabled || rowOff}
														title={`重试安装，需要联网下载：${item.downloadSizeHint}`}
														onClick={() => install(item.id)}
													>
														重试安装
													</button>
												) : (
													<button
														type="button"
														className="mini-btn"
														disabled={disabled || rowOff}
														title="清掉这一版并重新下载安装（下载 → 校验 → 安装 → 重载）"
														onClick={() => setConfirmingResetId(item.id)}
													>
														重置并重新安装
													</button>
												)}
											</>
										)}
										<label
											className="mcp-switch"
											title={rowOff ? "先打开总开关" : item.enabled ? "点击关闭" : "点击开启"}
										>
											<input
												type="checkbox"
												checked={inventory.master && item.enabled}
												disabled={disabled || rowOff}
												aria-label={`${item.label} 开关`}
												onChange={(e) =>
													run(() => window.kami.setRuntimeEnabled(item.id, e.currentTarget.checked))
												}
											/>
											<span className="mcp-switch-track">
												<span className="mcp-switch-thumb" />
											</span>
										</label>
									</div>
									<p className="runtime-meta">
										{runtimeStatusText(item.status)} · {item.purpose}
										{needsInstall ? ` · 安装需联网：${item.downloadSizeHint}` : ""}
									</p>
								</div>
							);
						})}
					</div>

					{report !== undefined && (
						<div className="code-block runtime-report">
							<div className="code-block-head">
								<span className="code-block-lang">{report.label} 诊断报告</span>
								<span className="bar-spacer" />
								<button
									type="button"
									className="mini-btn"
									title={report.logPath}
									onClick={() => {
										window.kami.openArtifact(report.logPath).catch((e: unknown) => setError(errorText(e)));
									}}
								>
									<IconFolder size={13} />
									打开日志目录
								</button>
								<ReportCopyButton text={report.text} />
								<button type="button" className="mini-btn" onClick={() => setReport(undefined)}>
									收起
								</button>
							</div>
							<pre>{report.text}</pre>
						</div>
					)}

					<p className="settings-foot">
						关掉某项后，它的路径不再注入模型可见上下文（模型会被告知「已被用户禁用」而不是「找不到」）。
						三个运行时都是「纯按需」：不会自动下载，只有你点「安装」才会联网 —— 文档生成等内置功能
						在需要时会明确告诉你去安装，不会静默联网。开关立即生效，无需重启。
					</p>
				</>
			)}
		</section>
	);
}
