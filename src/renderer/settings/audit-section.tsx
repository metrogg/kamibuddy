/**
 * 设置「审计中心」分区（spec: add-managed-runtimes 阶段 4）。
 *
 * 只做三件事：列出来（时间 / 类别 / 结论 / 详情）、导出、清空（二次确认）。
 * 数据源是 daemon 的同一条查询（`audit:list`）—— 类别过滤与展示上限都在那边做，
 * 本页不自己筛一遍：两处各筛一次就会出现「面板少了、导出多了」这类对不上，
 * 而审计的全部价值就是「看到的就是全部事实」。
 *
 * 导出同样由 daemon 写盘（`audit:export` 返回文件路径）：内容与面板同一条查询 +
 * 同一份渲染（shared/audit.ts），面板只负责把路径摆出来并给一个「打开」出口。
 * 在 renderer 里自己拼导出文本就会多出第二份渲染 —— 那正是 spec 禁止的「各查一遍」。
 *
 * 本页只 import @shared（AGENTS.md §1.3）。
 */

import { useCallback, useEffect, useState } from "react";
import {
	AUDIT_CATEGORIES,
	AUDIT_CATEGORY_LABELS,
	AUDIT_OUTCOME_LABELS,
	auditLine,
	formatAuditTime,
	type AuditCategory,
	type AuditQueryResult,
} from "@shared/audit.ts";
import { EmptyState, ErrorState, LoadingState } from "../state-views.tsx";

/** 过滤项：undefined = 全部（与 IPC 的参数语义一致，不另造一个 "all" 哨兵）。 */
type Filter = AuditCategory | undefined;

function errorText(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}

export function AuditSection(): React.JSX.Element {
	const [category, setCategory] = useState<Filter>(undefined);
	/** undefined = 在途（DESIGN.md §4：加载与空必须分开，初值不预置成空数组）。 */
	const [data, setData] = useState<AuditQueryResult | undefined>(undefined);
	const [error, setError] = useState<string | undefined>(undefined);
	const [busy, setBusy] = useState(false);
	/** 清空的二次确认态：置真才显示确认行，「清空」按钮本身不直接执行。 */
	const [confirming, setConfirming] = useState(false);
	const [exported, setExported] = useState<{ readonly path: string; readonly count: number } | undefined>(
		undefined,
	);

	const load = useCallback(async (next: Filter): Promise<void> => {
		try {
			setData(await window.kami.auditList(next));
			setError(undefined);
		} catch (e) {
			setError(errorText(e));
		}
	}, []);

	useEffect(() => {
		void load(category);
	}, [load, category]);

	/** 切过滤：先回到在途态（undefined），否则旧列表会在新条件下多显示一拍。 */
	const select = useCallback((next: Filter): void => {
		setData(undefined);
		setCategory(next);
	}, []);

	const exportLog = useCallback((): void => {
		setBusy(true);
		window.kami
			.auditExport()
			.then((result) => {
				setExported(result);
				setError(undefined);
			})
			.catch((e: unknown) => setError(errorText(e)))
			.finally(() => setBusy(false));
	}, []);

	const clear = useCallback((): void => {
		setBusy(true);
		window.kami
			.auditClear()
			// 清空后 daemon 直接回新状态（含「已清空」那条留痕），不再多拉一次。
			.then((result) => {
				setData(result);
				setConfirming(false);
				setError(undefined);
			})
			.catch((e: unknown) => setError(errorText(e)))
			.finally(() => setBusy(false));
	}, []);

	/*
	 * 记录按时间**倒序**展示（最新的在最上面）：审计的读法永远是「刚才发生了什么」。
	 * 查询返回的是正序（旧→新，导出要的就是它），倒序只是这一处的展示选择。
	 */
	const rows = data === undefined ? [] : [...data.records].reverse();

	return (
		<section className="settings-section">
			<header className="settings-section-head">
				<h2>审计中心</h2>
				{data !== undefined && <span className="provider-meta">共 {data.total} 条</span>}
			</header>

			{/* 工具栏：过滤（左）与两个动作（右）；行容器与列表行复用同一套 flex 档位。 */}
			<div className="provider-main">
				<button
					type="button"
					className={`mini-btn${category === undefined ? " active" : ""}`}
					onClick={() => select(undefined)}
				>
					全部
				</button>
				{AUDIT_CATEGORIES.map((item) => (
					<button
						key={item}
						type="button"
						className={`mini-btn${category === item ? " active" : ""}`}
						onClick={() => select(item)}
					>
						{AUDIT_CATEGORY_LABELS[item]}
					</button>
				))}
				<span className="bar-spacer" />
				<button
					type="button"
					className="mini-btn"
					disabled={busy || data === undefined}
					onClick={exportLog}
				>
					导出日志
				</button>
				{/* 危险动作：只进入确认态，不直接执行（清空不可逆）。 */}
				<button
					type="button"
					className="mini-btn danger"
					disabled={busy || data === undefined}
					onClick={() => setConfirming(true)}
				>
					清空记录
				</button>
			</div>

			{confirming && data !== undefined && (
				<div className="provider-main">
					<span className="stat-hint">
						确认清空全部 {data.total} 条审计记录？该动作不可撤销，清空动作本身会留一条记录。
					</span>
					<span className="bar-spacer" />
					<button type="button" className="mini-btn danger" disabled={busy} onClick={clear}>
						确认清空
					</button>
					<button type="button" className="mini-btn" disabled={busy} onClick={() => setConfirming(false)}>
						取消
					</button>
				</div>
			)}

			{exported !== undefined && (
				<div className="provider-main">
					<span className="provider-meta">
						已导出 {exported.count} 条到 {exported.path}
					</span>
					<span className="bar-spacer" />
					<button
						type="button"
						className="mini-btn"
						onClick={() => void window.kami.openArtifact(exported.path)}
					>
						打开
					</button>
				</div>
			)}

			{/* 三态互斥（照 skills-view.tsx 的标尺）：在途 / 失败 / 空 / 内容只走一条。 */}
			{data === undefined ? (
				error !== undefined ? (
					<ErrorState message={error} onRetry={() => void load(category)} />
				) : (
					<LoadingState text="正在读取审计记录…" />
				)
			) : rows.length === 0 ? (
				<EmptyState
					title={category === undefined ? "还没有审计记录" : "这一类还没有记录"}
					description="命令被危险命令检查器拦下、沙箱拒绝执行或提权被拒、运行时装不上时，会在这里留痕。"
				/>
			) : (
				<>
					{error !== undefined && <ErrorState message={error} />}
					{/* 长列表只展示查询上限内的最近若干条，超出时如实说明（不假装那是全部）。 */}
					{data.total > rows.length && (
						<p className="settings-foot">
							仅显示最近 {data.limit} 条（共 {data.total} 条）；完整历史请用「导出日志」。
						</p>
					)}
					<div className="provider-list">
						{rows.map((record, index) => (
							// key 用「时间 + 序号」：同一毫秒可能有多条（ts 会撞），序号保证唯一。
							<div className="provider-row" key={`${record.ts}-${index}`}>
								{/* title 用 auditLine（与导出同一份渲染）：详情在行内被截断，悬停读全文。 */}
								<div className="provider-main" title={auditLine(record)}>
									<span className="provider-tag">
										{AUDIT_CATEGORY_LABELS[record.category]} · {AUDIT_OUTCOME_LABELS[record.outcome]}
									</span>
									<span className="audit-detail">{record.detail}</span>
									<span className="bar-spacer" />
									<span className="provider-meta">{formatAuditTime(record.ts)}</span>
								</div>
							</div>
						))}
					</div>
				</>
			)}
		</section>
	);
}
