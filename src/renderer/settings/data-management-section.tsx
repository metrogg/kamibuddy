/**
 * 设置「数据管理」分组（L28/L29）：已归档任务的查看与恢复。
 *
 * 归档 = archive.json 索引标记（core/session-archive.ts），会话文件原地不动 ——
 * 所以这里的「取消归档」就是删一行索引，「删除」走既有 sessionDelete 通道
 * （实为移入回收目录，可人工找回）。列表来源是 listSessions 全量（daemon 已
 * 标注 archived），本页只做过滤展示，不自己维护第二份状态。
 *
 * 本页只 import @shared（AGENTS.md §1.3）。
 */

import { useCallback, useEffect, useState } from "react";
import type { SessionSummary } from "@shared/ipc.ts";
import { formatMessageTime } from "@shared/message-time.ts";
import { ErrorState, LoadingState } from "../state-views.tsx";

function errorText(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}

export function DataManagementSection(): React.JSX.Element {
	const [sessions, setSessions] = useState<readonly SessionSummary[] | undefined>(undefined);
	const [error, setError] = useState<string | undefined>(undefined);
	/** 行内确认删除的 path（删除不可逆地移入回收目录，值得一次显式确认）。 */
	const [confirmingPath, setConfirmingPath] = useState<string | undefined>(undefined);
	const [busy, setBusy] = useState(false);

	const load = useCallback(async (): Promise<void> => {
		try {
			setSessions(await window.kami.listSessions());
			setError(undefined);
		} catch (e) {
			setError(errorText(e));
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const archived = (sessions ?? []).filter((s) => s.archived);
	const now = Date.now();

	const unarchive = useCallback(
		(path: string): void => {
			setBusy(true);
			window.kami
				.archiveSession(path, false)
				.then(load)
				.catch((e: unknown) => setError(errorText(e)))
				.finally(() => setBusy(false));
		},
		[load],
	);

	const remove = useCallback(
		(path: string): void => {
			setBusy(true);
			window.kami
				.deleteSession(path)
				.then(load)
				.catch((e: unknown) => setError(errorText(e)))
				.finally(() => setBusy(false));
		},
		[load],
	);

	return (
		<section className="settings-section">
			<header className="settings-section-head">
				<h2>数据管理</h2>
				{sessions !== undefined && (
					<span className="provider-meta">{archived.length} 个已归档任务</span>
				)}
			</header>

			<p className="settings-foot">
				归档的任务不占用侧栏列表，但完整保留：可以在这里恢复，也可以删除。
			</p>

			{error !== undefined ? (
				<ErrorState message={error} onRetry={() => void load()} />
			) : sessions === undefined ? (
				<LoadingState text="正在读取会话…" />
			) : archived.length === 0 ? (
				<p className="settings-foot">没有已归档的任务。在任务行的 ⋯ 菜单里选择「归档」即可收进这里。</p>
			) : (
				<div className="preview-segments">
					{archived.map((task) => (
						<div key={task.path} className="seg-card">
							{confirmingPath === task.path ? (
								<div className="seg-head">
									<span className="stat-hint">确认删除？文件将移入回收目录。</span>
									<span className="bar-spacer" />
									<button
										type="button"
										className="mini-btn danger"
										disabled={busy}
										onClick={() => {
											setConfirmingPath(undefined);
											remove(task.path);
										}}
									>
										删除
									</button>
									<button
										type="button"
										className="mini-btn"
										disabled={busy}
										onClick={() => setConfirmingPath(undefined)}
									>
										取消
									</button>
								</div>
							) : (
								<div className="seg-head">
									<span className="seg-tag seg-skeleton">{task.title}</span>
									<span className="seg-chars">
										{formatMessageTime(task.modifiedAt, now)}
									</span>
									<span className="bar-spacer" />
									<button
										type="button"
										className="mini-btn"
										disabled={busy}
										title="恢复到侧栏列表"
										onClick={() => unarchive(task.path)}
									>
										取消归档
									</button>
									<button
										type="button"
										className="mini-btn danger"
										disabled={busy}
										onClick={() => setConfirmingPath(task.path)}
									>
										删除
									</button>
								</div>
							)}
						</div>
					))}
				</div>
			)}
		</section>
	);
}
