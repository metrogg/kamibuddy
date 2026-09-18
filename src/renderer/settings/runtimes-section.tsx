/**
 * 设置「内置运行时」一级分区（spec: add-managed-runtimes Task 3.1）。
 *
 * 形态照 WorkBuddy 的 RuntimeToolsCard（security-center-panel__runtime-card）：
 * 分区头一行总开关，下面逐运行时一行（名称 / 版本 / 状态 / 用途）+ 行内开关 +
 * 「诊断」「重置并重新安装」。**总开关关闭 ⇒ 子项整行压暗且开关不可点**，
 * 但逐项开关的**原值保留**（重新打开总开关后回到用户上次的选择）——
 * WorkBuddy 的 effectiveEnabled = 总开关 && 子开关 就是这个语义。
 *
 * 数据只有一个来源：daemon 的 runtimesSnapshot（core/runtime-inventory.ts 的
 * collectRuntimeInventory）。本页不做任何二次判断 —— 状态文案经
 * shared/runtimes.ts 的 runtimeStatusText 渲染，与模型侧 `python_env` 段同一句
 * （「已被用户禁用」不可能在这里显示成「找不到」）。
 *
 * 本页只 import @shared（AGENTS.md §1.3），一个 pi 概念都不认识。
 */

import { useCallback, useEffect, useState } from "react";
import type { RuntimeDiagnosticsText, RuntimeInventory } from "@shared/runtimes.ts";
import { runtimeStatusText } from "@shared/runtimes.ts";
import { useCopyWithTick } from "../copy-tick.ts";
import { IconCheck, IconCopy, IconFolder } from "../icons.tsx";
import { ErrorState, LoadingState } from "../state-views.tsx";

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
	 * 本分区自己的忙态：重置要「清残留 → 联网下载 → 校验 → 进位」，可能几分钟。
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

	const disabled = busy || localBusy;

	/** 三个写操作的共同包装：忙态 → 调用 → 用返回值替换清单（daemon 已重采集）。 */
	const run = useCallback((action: () => Promise<RuntimeInventory>): void => {
		setLocalBusy(true);
		setError(undefined);
		action()
			.then(setInventory)
			.catch((e: unknown) => setError(errorText(e)))
			.finally(() => setLocalBusy(false));
	}, []);

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
							return (
								<div key={item.id} className={`provider-row${rowOff ? " runtime-row-off" : ""}`}>
									<div className="provider-main">
										<span className={`provider-dot${item.status.kind === "ready" ? " on" : ""}`} />
										<span className="provider-name">{item.label}</span>
										<span className="provider-tag">{item.version}</span>
										<span className="bar-spacer" />
										{resettingId === item.id ? (
											<span className="stat-hint">重置中…需联网，约 1-3 分钟。</span>
										) : confirming ? (
											<>
												<span className="stat-hint">确认重置？需联网，约 1-3 分钟。</span>
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
												<button
													type="button"
													className="mini-btn"
													disabled={disabled || rowOff}
													title="清掉这一版并重新安装（下载 → 校验 → 安装 → 重载）"
													onClick={() => setConfirmingResetId(item.id)}
												>
													重置并重新安装
												</button>
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
						关掉某项后，它的路径不再注入模型可见上下文（模型会被告知「已被用户禁用」而不是「找不到」），
						启动时也不再替你准备它；文档生成等内置功能在首次使用时仍会按需准备自己需要的运行时。
						开关立即生效，无需重启。
					</p>
				</>
			)}
		</section>
	);
}
