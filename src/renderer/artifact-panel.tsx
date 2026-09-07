/**
 * 产物预览面板（右侧栏，对标 WorkBuddy 的 DetailPanel，07-artifact-preview.md §3）。
 *
 * 三类内容一个面板：
 *   1. 「产物」页 —— 本会话 write 成功的文件（collectArtifacts 推导）；
 *   2. 「文件」页 —— 当前工作区的全部文件（回答「项目文件夹里有什么」）；
 *   3. 预览区 —— HTML 走静态服务的活页面（iframe，能跑 JS）；
 *      文本类走 readArtifact 只读；图片经静态服务 <img>；其余给外部打开。
 *
 * 安全边界在 daemon（preview-server 防穿越、readArtifact 限工作区），
 * 本组件只管渲染，不做路径判断 —— 判断放两边必然漂移。
 */

import { useEffect, useState } from "react";
import type { ArtifactRef } from "@shared/artifacts.ts";
import { IconClose, IconDoc, IconOpenExternal } from "./icons.tsx";

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

interface ArtifactPanelProps {
	/** 本会话产物（可能为空）。 */
	readonly artifacts: readonly ArtifactRef[];
	/** 当前工作区目录。playground 为 undefined。 */
	readonly cwd: string | undefined;
	/** 静态服务 baseUrl。playground / 服务未起为 undefined。 */
	readonly previewBaseUrl: string | undefined;
	/** 当前预览的文件路径（与产物/文件列表里的一致）。 */
	readonly path: string;
	readonly onSelect: (path: string) => void;
	readonly onClose: () => void;
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

export function ArtifactPanel({
	artifacts,
	cwd,
	previewBaseUrl,
	path,
	onSelect,
	onClose,
	onOpenExternal,
	onError,
}: ArtifactPanelProps): React.JSX.Element {
	const [tab, setTab] = useState<"artifacts" | "files">("artifacts");
	const [workspaceFiles, setWorkspaceFiles] = useState<readonly string[] | undefined>(undefined);

	// 文件页的数据：复用补全通道的文件索引（同一来源，两份扫描必然漂移）。
	// cwd 变化时重拉（面板常驻，工作区切换不该看到旧目录）。
	useEffect(() => {
		if (tab !== "files" || cwd === undefined) return;
		let disposed = false;
		window.kami
			.completions()
			.then((d) => {
				if (!disposed) setWorkspaceFiles(d.files);
			})
			.catch(() => {
				if (!disposed) setWorkspaceFiles([]);
			});
		return () => {
			disposed = true;
		};
	}, [tab, cwd]);

	const rel = toRelative(path, cwd);
	const kind = kindOf(rel);
	const servable = previewBaseUrl !== undefined && cwd !== undefined;
	const fileName = rel.split("/").pop() ?? rel;

	return (
		<aside className="preview-panel">
			<header className="preview-head">
				<span className="preview-title" title={path}>
					{fileName}
				</span>
				<button
					type="button"
					className="bar-btn"
					title="外部打开"
					aria-label="外部打开"
					onClick={() => onOpenExternal(path)}
				>
					<IconOpenExternal size={14} />
				</button>
				<button type="button" className="bar-btn" title="关闭面板" aria-label="关闭面板" onClick={onClose}>
					<IconClose size={14} />
				</button>
			</header>

			<div className="preview-tabs">
				<button
					type="button"
					className={`preview-tab${tab === "artifacts" ? " active" : ""}`}
					onClick={() => setTab("artifacts")}
				>
					产物（{artifacts.length}）
				</button>
				<button
					type="button"
					className={`preview-tab${tab === "files" ? " active" : ""}`}
					onClick={() => setTab("files")}
				>
					文件
				</button>
			</div>

			<div className="preview-list">
				{tab === "artifacts" &&
					(artifacts.length === 0 ? (
						<div className="preview-empty">本会话还没有产物</div>
					) : (
						artifacts.map((a) => (
							<button
								key={a.path}
								type="button"
								className={`preview-item${a.path === path ? " active" : ""}`}
								title={a.path}
								onClick={() => onSelect(a.path)}
							>
								<IconDoc size={14} />
								<span className="preview-item-name">{a.path.split(/[\\/]/).pop()}</span>
							</button>
						))
					))}
				{tab === "files" &&
					(cwd === undefined ? (
						<div className="preview-empty">playground 没有工作区文件</div>
					) : workspaceFiles === undefined ? (
						<div className="preview-empty">加载中…</div>
					) : (
						workspaceFiles.map((f) => (
							<button
								key={f}
								type="button"
								className={`preview-item${f === rel ? " active" : ""}`}
								title={f}
								onClick={() => onSelect(f)}
							>
								<IconDoc size={14} />
								<span className="preview-item-name">{f}</span>
							</button>
						))
					))}
			</div>

			<div className="preview-body">
				{!servable && <div className="preview-fallback">选择工作空间后可预览文件</div>}
				{servable && kind === "html" && (
					<iframe
						className="preview-frame"
						title={fileName}
						src={previewUrl(previewBaseUrl, rel)}
						// 与宿主不同源（127.0.0.1:端口），allow-same-origin 只给它自己
						// 源的 localStorage（游戏存档类需要），够不着我们的状态。
						sandbox="allow-scripts allow-same-origin allow-forms"
					/>
				)}
				{servable && kind === "image" && (
					<img className="preview-image" src={previewUrl(previewBaseUrl, rel)} alt={fileName} />
				)}
				{servable && kind === "text" && <TextPreview path={rel} onError={onError} />}
				{servable && kind === "unsupported" && (
					<div className="preview-fallback">
						暂不支持预览此类型，<button type="button" className="preview-link" onClick={() => onOpenExternal(path)}>外部打开</button>
					</div>
				)}
			</div>
		</aside>
	);
}
