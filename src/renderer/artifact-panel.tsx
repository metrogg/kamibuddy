/**
 * 产物预览面板（右侧栏，对标 WorkBuddy 的 DetailPanel，07-artifact-preview.md §3）。
 *
 * 结构对齐其 DetailPanel：顶部 tab 条 = 概览下拉 + 文件/变更 tab + 外部打开。
 * - 概览下拉：产物 / 变更 / 工作区文件 三组导航（其「概览」+ 用户要的文件可见性）。
 * - 文件 tab：HTML 走静态服务的活页面（iframe，能跑 JS）；文本只读；图片 <img>；其余外部打开。
 * - 变更 tab：该文件的 unified diff（write/edit 执行前的旧内容 vs 新内容，
 *   变更数据来自工具卡片的 change，按路径收拢见 shared/artifacts.ts collectChanges）。
 *
 * 安全边界在 daemon（preview-server 防穿越、readArtifact 限工作区），
 * 本组件只管渲染，不做路径判断 —— 判断放两边必然漂移。
 */

import { useEffect, useState } from "react";
import type { ArtifactRef, ChangeRef } from "@shared/artifacts.ts";
import { IconChevronDown, IconClose, IconDoc, IconOpenExternal } from "./icons.tsx";

/** 预览对象：文件本身，或某文件的变更 diff。 */
export type PreviewSelection =
	| { readonly kind: "file"; readonly path: string }
	| { readonly kind: "change"; readonly path: string };

export function sameSelection(a: PreviewSelection, b: PreviewSelection): boolean {
	return a.kind === b.kind && a.path === b.path;
}

/** 可按文本预览的扩展名（无扩展名也按文本试，daemon 用 NUL 判断二进制兜底）。 */
const TEXT_EXTS = new Set([
	".txt", ".md", ".markdown", ".js", ".mjs", ".ts", ".tsx", ".jsx", ".json",
	".css", ".py", ".yaml", ".yml", ".xml", ".csv", ".log", ".sh", ".toml", ".ini",
]);
const HTML_EXTS = new Set([".html", ".htm"]);
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);

function extOf(path: string): string {
	const base = path.split(/[\\/]/).pop() ?? path;
	const dot = base.lastIndexOf(".");
	return dot === -1 ? "" : base.slice(dot).toLowerCase();
}

function baseName(path: string): string {
	return path.split(/[\\/]/).pop() ?? path;
}

/** 模型写的路径可能是绝对路径或相对路径，统一折成工作区相对路径（posix 分隔）。 */
function toRelative(path: string, cwd: string | undefined): string {
	if (cwd !== undefined) {
		const normCwd = cwd.replace(/\\/g, "/").replace(/\/+$/, "");
		const normPath = path.replace(/\\/g, "/");
		if (normPath.startsWith(`${normCwd}/`)) return normPath.slice(normCwd.length + 1);
	}
	// 不是 cwd 前缀的绝对路径（如 /tmp/x 或 C:/x）无法经静态服务暴露，原样返回，
	// 由 daemon 的边界判断拒绝（预览不了 → 走外部打开）。
	return path.replace(/\\/g, "/");
}

function previewUrl(baseUrl: string, rel: string): string {
	return `${baseUrl}/${rel.split("/").map(encodeURIComponent).join("/")}`;
}

type PreviewKind = "html" | "text" | "image" | "unsupported";

function kindOf(path: string): PreviewKind {
	const ext = extOf(path);
	if (HTML_EXTS.has(ext)) return "html";
	if (IMAGE_EXTS.has(ext)) return "image";
	if (TEXT_EXTS.has(ext) || ext === "") return "text";
	return "unsupported";
}

/** 文件大小格式化（与对话页产物卡同口径）。 */
function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const kb = bytes / 1024;
	return kb < 100 ? `${kb.toFixed(1)} KB` : `${Math.round(kb)} KB`;
}

interface ArtifactPanelProps {
	/** 本会话已交付的产物（present_files）。 */
	readonly artifacts: readonly ArtifactRef[];
	/** 本会话的文件变更（按路径收拢）。 */
	readonly changes: readonly ChangeRef[];
	/** 当前工作区目录。playground 为 undefined。 */
	readonly cwd: string | undefined;
	/** 静态服务 baseUrl。playground / 服务未起为 undefined。 */
	readonly previewBaseUrl: string | undefined;
	/** 已打开的 tab（顺序即显示顺序）。 */
	readonly tabs: readonly PreviewSelection[];
	/** 当前激活的 tab。 */
	readonly active: PreviewSelection;
	/** 打开/激活一个预览对象（不在 tabs 里会自动补 tab）。 */
	readonly onOpen: (sel: PreviewSelection) => void;
	readonly onCloseTab: (sel: PreviewSelection) => void;
	readonly onOpenExternal: (path: string) => void;
	readonly onError: (message: string) => void;
}

/** 文本预览：readArtifact 拉取，随 path 变化重载。 */
function TextPreview({ path, onError }: { readonly path: string; readonly onError: (m: string) => void }) {
	const [text, setText] = useState<string | undefined>(undefined);
	const [failed, setFailed] = useState<string | undefined>(undefined);

	useEffect(() => {
		let disposed = false;
		setText(undefined);
		setFailed(undefined);
		window.kami
			.readArtifact(path)
			.then((content) => {
				if (disposed) return;
				if (content.text === undefined) setFailed("该文件不是文本或超过 512KB，请外部打开查看");
				else setText(content.text);
			})
			.catch((error: unknown) => {
				if (!disposed) {
					const message = error instanceof Error ? error.message : String(error);
					setFailed(message);
					onError(message);
				}
			});
		return () => {
			disposed = true;
		};
	}, [path, onError]);

	if (failed !== undefined) return <div className="preview-fallback">{failed}</div>;
	if (text === undefined) return <div className="preview-fallback">加载中…</div>;
	return <pre className="preview-text">{text}</pre>;
}

/** 变更预览：unified diff 按前缀着色（+ 增 / - 删 / @@ hunk 头）。 */
function DiffView({ diff }: { readonly diff: string }) {
	return (
		<pre className="preview-diff">
			{diff.split("\n").map((line, i) => (
				<div
					key={i}
					className={
						line.startsWith("+")
							? "diff-add"
							: line.startsWith("-")
								? "diff-del"
								: line.startsWith("@@")
									? "diff-hunk"
									: undefined
					}
				>
					{line}
				</div>
			))}
		</pre>
	);
}

/** 概览下拉：产物 / 变更 / 工作区文件 三组导航。 */
function OverviewMenu({
	artifacts,
	changes,
	cwd,
	onOpen,
	onOpenExternal,
}: {
	readonly artifacts: readonly ArtifactRef[];
	readonly changes: readonly ChangeRef[];
	readonly cwd: string | undefined;
	readonly onOpen: (sel: PreviewSelection) => void;
	readonly onOpenExternal: (path: string) => void;
}): React.JSX.Element {
	const [open, setOpen] = useState(false);
	const [files, setFiles] = useState<readonly string[] | undefined>(undefined);

	// 工作区文件组：打开下拉时拉一次（复用补全通道的索引，两份扫描必然漂移）。
	useEffect(() => {
		if (!open || cwd === undefined) return;
		let disposed = false;
		window.kami
			.completions()
			.then((d) => {
				if (!disposed) setFiles(d.files);
			})
			.catch(() => {
				if (!disposed) setFiles([]);
			});
		return () => {
			disposed = true;
		};
	}, [open, cwd]);

	const pick = (sel: PreviewSelection): void => {
		setOpen(false);
		onOpen(sel);
	};

	return (
		<div className="preview-overview">
			<button type="button" className="bar-btn bar-btn-text" onClick={() => setOpen((v) => !v)}>
				概览
				<IconChevronDown size={13} />
			</button>
			{open && (
				<div className="preview-menu">
					<div className="preview-menu-group">
						<header className="preview-menu-title">产物（{artifacts.length}）</header>
						{artifacts.length === 0 && <div className="preview-menu-empty">本会话还没有产物</div>}
						{artifacts.map((a) => {
							const isUrl = /^https?:\/\//i.test(a.path);
							return (
								<button
									key={a.path}
									type="button"
									className="preview-item"
									title={isUrl ? `${a.path}（外部打开）` : a.path}
									onClick={() => {
										if (isUrl) {
											setOpen(false);
											onOpenExternal(a.path);
										} else {
											pick({ kind: "file", path: a.path });
										}
									}}
								>
									<IconDoc size={14} />
									<span className="preview-item-name">{baseName(a.path)}</span>
									{a.size > 0 && <span className="preview-item-meta">{formatSize(a.size)}</span>}
								</button>
							);
						})}
					</div>
					<div className="preview-menu-group">
						<header className="preview-menu-title">变更（{changes.length}）</header>
						{changes.length === 0 && <div className="preview-menu-empty">本会话还没有变更</div>}
						{changes.map((c) => (
							<button
								key={c.path}
								type="button"
								className="preview-item"
								title={c.path}
								onClick={() => pick({ kind: "change", path: c.path })}
							>
								<IconDoc size={14} />
								<span className="preview-item-name">{baseName(c.path)}</span>
								<span className="preview-item-meta">
									<span className="added">+{c.added}</span>
									<span className="removed">-{c.removed}</span>
								</span>
							</button>
						))}
					</div>
					<div className="preview-menu-group">
						<header className="preview-menu-title">工作区文件</header>
						{cwd === undefined ? (
							<div className="preview-menu-empty">playground 没有工作区文件</div>
						) : files === undefined ? (
							<div className="preview-menu-empty">加载中…</div>
						) : (
							files.map((f) => (
								<button
									key={f}
									type="button"
									className="preview-item"
									title={f}
									onClick={() => pick({ kind: "file", path: f })}
								>
									<IconDoc size={14} />
									<span className="preview-item-name">{f}</span>
								</button>
							))
						)}
					</div>
				</div>
			)}
		</div>
	);
}

export function ArtifactPanel({
	artifacts,
	changes,
	cwd,
	previewBaseUrl,
	tabs,
	active,
	onOpen,
	onCloseTab,
	onOpenExternal,
	onError,
}: ArtifactPanelProps): React.JSX.Element {
	const servable = previewBaseUrl !== undefined && cwd !== undefined;
	const activeChange =
		active.kind === "change" ? changes.find((c) => c.path === active.path) : undefined;

	const rel = toRelative(active.path, cwd);
	const kind = kindOf(rel);

	return (
		<aside className="preview-panel">
			<header className="preview-head">
				<OverviewMenu artifacts={artifacts} changes={changes} cwd={cwd} onOpen={onOpen} onOpenExternal={onOpenExternal} />
				<div className="preview-tabs-strip">
					{tabs.map((sel) => (
						<span
							key={`${sel.kind}:${sel.path}`}
							className={`preview-tab-item${sameSelection(sel, active) ? " active" : ""}`}
						>
							<button
								type="button"
								className="preview-tab-label"
								title={sel.kind === "change" ? `${sel.path}（变更）` : sel.path}
								onClick={() => onOpen(sel)}
							>
								{baseName(sel.path)}
								{sel.kind === "change" && "（变更）"}
							</button>
							<button
								type="button"
								className="preview-tab-close"
								title="关闭"
								aria-label={`关闭 ${baseName(sel.path)}`}
								onClick={() => onCloseTab(sel)}
							>
								<IconClose size={11} />
							</button>
						</span>
					))}
				</div>
				<button
					type="button"
					className="bar-btn"
					title="外部打开"
					aria-label="外部打开"
					onClick={() => onOpenExternal(active.path)}
				>
					<IconOpenExternal size={14} />
				</button>
			</header>

			<div className="preview-body">
				{active.kind === "change" && (
					activeChange?.diff !== undefined ? (
						<DiffView diff={activeChange.diff} />
					) : (
						<div className="preview-fallback">
							{activeChange === undefined
								? "该变更记录已不存在"
								: activeChange.changeType === "created"
									? "新创建的文件，改动为全文新增"
									: "文件过大，只统计了增删行数"}
							{activeChange !== undefined && (
								<>
									{"，"}
									<button
										type="button"
										className="preview-link"
										onClick={() => onOpen({ kind: "file", path: activeChange.path })}
									>
										查看文件本身
									</button>
								</>
							)}
						</div>
					)
				)}
				{active.kind === "file" && !servable && (
					<div className="preview-fallback">选择工作空间后可预览文件</div>
				)}
				{active.kind === "file" && servable && kind === "html" && (
					<iframe
						className="preview-frame"
						title={baseName(rel)}
						src={previewUrl(previewBaseUrl, rel)}
						// 与宿主不同源（127.0.0.1:端口），allow-same-origin 只给它自己
						// 源的 localStorage（游戏存档类需要），够不着我们的状态。
						sandbox="allow-scripts allow-same-origin allow-forms"
					/>
				)}
				{active.kind === "file" && servable && kind === "image" && (
					<img className="preview-image" src={previewUrl(previewBaseUrl, rel)} alt={baseName(rel)} />
				)}
				{active.kind === "file" && servable && kind === "text" && (
					<TextPreview path={rel} onError={onError} />
				)}
				{active.kind === "file" && servable && kind === "unsupported" && (
					<div className="preview-fallback">
						暂不支持预览此类型，<button type="button" className="preview-link" onClick={() => onOpenExternal(active.path)}>外部打开</button>
					</div>
				)}
			</div>
		</aside>
	);
}
