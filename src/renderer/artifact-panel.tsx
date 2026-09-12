/**
 * 产物预览面板（右侧栏，对标 WorkBuddy 的 DetailPanel，07-artifact-preview.md §3）。
 *
 * 结构对齐其 DetailPanel：顶部 tab 条 = 视图切换器 + 文件/变更 tab + 外部打开。
 * - 视图切换器：概览 / 工作空间文件 / 变更 三平级视图（fix-panel-view-hierarchy：
 *   三者平级，产物只是概览视图内的一组，不再共用一个内嵌三组的下拉）。
 *   主体双态（列表 / 预览）由 panel-view.ts 状态机管：点条目进预览，
 *   切视图回列表（tabs 留 tab 条可点回），关最后一个 tab 回列表。
 * - 文件 tab：HTML 走静态服务的活页面（iframe，能跑 JS）；代码走 Monaco 只读高亮
 *   （code-preview.tsx）；纯文本 <pre>；图片 <img>；
 *   Markdown 富文本；PDF 走 react-pdf（pdf-preview.tsx）；Office 三格式走
 *   office-preview.tsx（docx/xlsx/pptx 各一个懒加载 chunk）；视频/音频走原生
 *   媒体标签（不可播给下载引导）；超大（≥10MB）与不支持的格式走占位 + 外部打开/下载。
 * - 变更 tab：该文件的 unified diff（write/edit 执行前的旧内容 vs 新内容，
 *   变更数据来自工具卡片的 change，按路径收拢见 shared/artifacts.ts collectChanges）。
 *
 * 安全边界在 daemon（preview-server 防穿越、readArtifact 限工作区），
 * 本组件只管渲染，不做路径判断 —— 判断放两边必然漂移。
 */

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ARTIFACT_PREVIEW_MAX_BYTES, type ArtifactRef, type ChangeRef } from "@shared/artifacts.ts";
import { formatSize } from "@shared/format-size.ts";
import { codeLanguageOf, isCodePreviewExt } from "./code-languages.ts";
import { FileTypeIcon } from "./file-type-icon.tsx";
import { PdfPreview } from "./pdf-preview.tsx";
import { OfficePreview, type OfficeFormat } from "./office-preview.tsx";
import { Markdown } from "./markdown.tsx";
import {
	IconCheck,
	IconChevronDown,
	IconClose,
	IconDoc,
	IconEdit,
	IconExpand,
	IconFile,
	IconFolder,
	IconOpenExternal,
	IconShrink,
	IconWorkspace,
} from "./icons.tsx";
import {
	closeLastTab,
	closeTab,
	initialPanelViewState,
	openPreview,
	selectView,
	type PanelView,
	type PanelViewState,
} from "./panel-view.ts";
import {
	collapseFolder,
	createLazyTreeState,
	expandFolder,
	finishLoad,
	flattenTree,
	type FileTreeNode,
	type LazyTreeState,
} from "./workspace-file-tree.ts";

/**
 * 预览对象：文件本身，或某文件的变更 diff。
 * isPreview = VSCode 式「单击预览」暂态 tab（斜体标题）：全局唯一，
 * 下一个单击原位替换它；双击（openFile）转正为固定 tab。
 * 类型是 renderer 内部模型（不走 IPC），不进 shared。
 */
export type PreviewSelection =
	| { readonly kind: "file"; readonly path: string; readonly isPreview?: boolean }
	| { readonly kind: "change"; readonly path: string; readonly isPreview?: boolean };

export function sameSelection(a: PreviewSelection, b: PreviewSelection): boolean {
	return a.kind === b.kind && a.path === b.path;
}

/**
 * 裸 <pre> 文本预览的扩展名（无扩展名也按文本试，daemon 用 NUL 判断二进制兜底）。
 * 代码扩展名不在这里——它们走 Monaco 高亮（code-languages.ts 的映射表是唯一口径，
 * 两边各列一份必然漂移）。
 */
const TEXT_EXTS = new Set([".txt", ".log"]);
/** markdown 单独成类：富文本渲染（图片走 preview-server），不混进裸 <pre> 文本。 */
const MARKDOWN_EXTS = new Set([".md", ".markdown"]);
const HTML_EXTS = new Set([".html", ".htm"]);
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);
const PDF_EXTS = new Set([".pdf"]);
/**
 * Office 预览的扩展名 → 渲染格式。旧二进制 .xls 与纯文本 .csv 在渲染链里
 * 先经 SheetJS 换皮成 xlsx（office-xlsx.tsx），所以归同一 format；
 * .doc/.ppt 没有纯 JS 解析链，落 unsupported 走「暂不支持预览」占位。
 */
const OFFICE_FORMATS: ReadonlyMap<string, OfficeFormat> = new Map<string, OfficeFormat>([
	[".docx", "docx"],
	[".xlsx", "xlsx"],
	[".xls", "xlsx"],
	[".csv", "xlsx"],
	[".pptx", "pptx"],
]);
/**
 * .ogg 容器音视频两栖，归视频侧：<video> 放纯音频 ogg 仍有声音，
 * 反过来塞进 <audio> 就永远看不到画面 —— 判错方向的代价不对称。
 */
const VIDEO_EXTS = new Set([".mp4", ".webm", ".ogg"]);
const AUDIO_EXTS = new Set([".mp3", ".wav"]);

/** 媒体扩展名 → MIME（canPlayType 探测用；服务端 Content-Type 是 preview-server 自己的表）。 */
const MEDIA_MIME: Record<string, string> = {
	".mp4": "video/mp4",
	".webm": "video/webm",
	".ogg": "video/ogg",
	".mp3": "audio/mpeg",
	".wav": "audio/wav",
};

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

/**
 * 「下载」链接的 URL。renderer 与静态服务不同源（127.0.0.1:随机端口），
 * <a download> 属性跨源被 Chromium 忽略、会把整窗导航走 —— 强制落盘靠
 * preview-server 的 ?download 约定（Content-Disposition: attachment）。
 */
function downloadUrl(baseUrl: string, rel: string): string {
	return `${previewUrl(baseUrl, rel)}?download`;
}

type PreviewKind =
	| "html"
	| "markdown"
	| "code"
	| "text"
	| "image"
	| "pdf"
	| "video"
	| "audio"
	| OfficeFormat
	| "unsupported";

function kindOf(path: string): PreviewKind {
	const ext = extOf(path);
	if (HTML_EXTS.has(ext)) return "html";
	if (MARKDOWN_EXTS.has(ext)) return "markdown";
	if (IMAGE_EXTS.has(ext)) return "image";
	if (PDF_EXTS.has(ext)) return "pdf";
	const officeFormat = OFFICE_FORMATS.get(ext);
	if (officeFormat !== undefined) return officeFormat;
	if (VIDEO_EXTS.has(ext)) return "video";
	if (AUDIO_EXTS.has(ext)) return "audio";
	if (isCodePreviewExt(ext)) return "code";
	if (TEXT_EXTS.has(ext) || ext === "") return "text";
	return "unsupported";
}

interface ArtifactPanelProps {
	/** 本会话已交付的产物（present_files）。 */
	readonly artifacts: readonly ArtifactRef[];
	/** 本会话的文件变更（按路径收拢）。 */
	readonly changes: readonly ChangeRef[];
	/** 当前工作区目录。undefined 仅是会话尚未建立的初始瞬态。 */
	readonly cwd: string | undefined;
	/** 静态服务 baseUrl。服务未起为 undefined。 */
	readonly previewBaseUrl: string | undefined;
	/** 已打开的 tab（顺序即显示顺序）。 */
	readonly tabs: readonly PreviewSelection[];
	/** 当前激活的 tab。undefined 表示常态展开但无激活文件（空态）。 */
	readonly active: PreviewSelection | undefined;
	/** 面板宽度（px）。 */
	readonly width: number;
	/** 全屏态。 */
	readonly fullscreen: boolean;
	/** 拖拽调宽回调。 */
	readonly onWidthChange: (width: number) => void;
	/** 全屏切换回调。 */
	readonly onToggleFullscreen: () => void;
	/** 单击打开/激活一个预览对象（预览语义：不在 tabs 里会补 isPreview tab）。 */
	readonly onOpen: (sel: PreviewSelection) => void;
	/** 双击固定：同 path tab 转正（isPreview=false），没有则新建固定 tab。 */
	readonly onPin: (sel: PreviewSelection) => void;
	readonly onCloseTab: (sel: PreviewSelection) => void;
	readonly onOpenExternal: (path: string) => void;
	readonly onError: (message: string) => void;
}

/**
 * readArtifact 拉文本（随 path 变化重载）：加载中 / 超大 / 失败 / 文本四态，
 * TextPreview 与 MarkdownPreview 共用。
 *
 * 超大阈值只在整读进内存的文本类分支强制执行：图/视/音/PDF 经静态服务
 * 流式加载（浏览器或 pdf.js 用 range 请求自己扛大文件），不为它们多付
 * 一次 readArtifact IPC 往返。
 */
function useArtifactText(
	path: string,
	onError: (m: string) => void,
): { readonly text: string | undefined; readonly failed: string | undefined; readonly oversized: boolean } {
	const [text, setText] = useState<string | undefined>(undefined);
	const [failed, setFailed] = useState<string | undefined>(undefined);
	const [oversized, setOversized] = useState(false);

	useEffect(() => {
		let disposed = false;
		setText(undefined);
		setFailed(undefined);
		setOversized(false);
		window.kami
			.readArtifact(path)
			.then((content) => {
				if (disposed) return;
				if (content.size >= ARTIFACT_PREVIEW_MAX_BYTES) setOversized(true);
				else if (content.text === undefined) setFailed("该文件不是文本或超过 512KB，请外部打开查看");
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

	return { text, failed, oversized };
}

/** 预览占位：图标 + 文案 + 操作按钮组（不支持 / 超大 / 不可播共用同一布局，类名区分语义）。 */
function PreviewPlaceholder({
	className,
	message,
	children,
}: {
	readonly className: string;
	readonly message: string;
	readonly children?: React.ReactNode;
}): React.JSX.Element {
	return (
		<div className={className}>
			<IconFile size={36} />
			<p className="preview-placeholder-message">{message}</p>
			{children !== undefined && <div className="preview-actions">{children}</div>}
		</div>
	);
}

/** 超大文件占位：不预览，引导「打开所在文件夹」或下载后本地看。 */
function OversizedView({
	folderPath,
	downloadHref,
	onOpenExternal,
}: {
	/** 文件所在目录的绝对路径（shell.openPath 打开目录）。 */
	readonly folderPath: string;
	readonly downloadHref: string;
	readonly onOpenExternal: (path: string) => void;
}): React.JSX.Element {
	return (
		<PreviewPlaceholder className="preview-oversized" message="文件过大，无法预览">
			<button type="button" className="preview-action" onClick={() => onOpenExternal(folderPath)}>
				打开所在文件夹
			</button>
			<a className="preview-action" href={downloadHref} download>
				下载
			</a>
		</PreviewPlaceholder>
	);
}

/** 文本预览：readArtifact 拉取，随 path 变化重载。 */
function TextPreview({
	path,
	folderPath,
	downloadHref,
	onOpenExternal,
	onError,
}: {
	readonly path: string;
	readonly folderPath: string;
	readonly downloadHref: string;
	readonly onOpenExternal: (path: string) => void;
	readonly onError: (m: string) => void;
}) {
	const { text, failed, oversized } = useArtifactText(path, onError);

	if (oversized) {
		return <OversizedView folderPath={folderPath} downloadHref={downloadHref} onOpenExternal={onOpenExternal} />;
	}
	if (failed !== undefined) return <div className="preview-fallback">{failed}</div>;
	if (text === undefined) return <div className="preview-fallback">加载中…</div>;
	return <pre className="preview-text">{text}</pre>;
}

// Monaco 体积以 MB 计，React.lazy 拆成 async chunk——首开代码文件才加载，
// 不拖慢应用启动（每个会话未必预览代码）。
const CodePreview = lazy(() => import("./code-preview.tsx").then((m) => ({ default: m.CodePreview })));

/** 代码预览：Monaco 只读高亮。取数与 TextPreview 同通道（useArtifactText）。 */
function CodeFilePreview({
	path,
	folderPath,
	downloadHref,
	onOpenExternal,
	onError,
}: {
	readonly path: string;
	readonly folderPath: string;
	readonly downloadHref: string;
	readonly onOpenExternal: (path: string) => void;
	readonly onError: (m: string) => void;
}) {
	const { text, failed, oversized } = useArtifactText(path, onError);

	if (oversized) {
		return <OversizedView folderPath={folderPath} downloadHref={downloadHref} onOpenExternal={onOpenExternal} />;
	}
	if (failed !== undefined) return <div className="preview-fallback">{failed}</div>;
	if (text === undefined) return <div className="preview-fallback">加载中…</div>;
	return (
		<Suspense fallback={<div className="preview-fallback">加载中…</div>}>
			<CodePreview content={text} language={codeLanguageOf(extOf(path))} />
		</Suspense>
	);
}

/**
 * markdown 图片 src → preview-server URL。
 * 绝对 URL（含协议相对 //、data: 等带 scheme 的）不动；根相对按工作区根、
 * 其余按 md 文件所在目录 resolve（posix 纯字符串运算）。`..` 越过工作区根时
 * 钳到根，越权与否由 daemon 边界兜底拒绝，渲染侧不做安全判断（头注释的约定）。
 */
function resolveImageUrl(mdPath: string, baseUrl: string, src: string): string {
	if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(src)) return src;
	const dir = mdPath.split("/").slice(0, -1).join("/");
	const joined = src.startsWith("/") ? src : dir === "" ? src : `${dir}/${src}`;
	const parts: string[] = [];
	for (const seg of joined.split("/")) {
		if (seg === "" || seg === ".") continue;
		else if (seg === "..") parts.pop();
		else parts.push(seg);
	}
	return previewUrl(baseUrl, parts.join("/"));
}

/** Markdown 预览：富文本渲染。链接经 Markdown 组件交主进程外部打开。 */
function MarkdownPreview({
	path,
	previewBaseUrl,
	folderPath,
	downloadHref,
	onOpenExternal,
	onError,
}: {
	readonly path: string;
	readonly previewBaseUrl: string;
	readonly folderPath: string;
	readonly downloadHref: string;
	readonly onOpenExternal: (path: string) => void;
	readonly onError: (m: string) => void;
}) {
	const { text, failed, oversized } = useArtifactText(path, onError);

	// 图片相对路径走方案 A：渲染时在 components.img 里 resolve 到 preview-server URL。
	// 不选预处理文本（方案 B）—— 文本替换分不清正文与代码块，会把示例代码里的
	// ./ 路径也改写。渲染期 resolve 只作用于真正的 <img> 节点。
	const resolveImageSrc = useCallback(
		(src: string): string => resolveImageUrl(path, previewBaseUrl, src),
		[path, previewBaseUrl],
	);

	if (oversized) {
		return <OversizedView folderPath={folderPath} downloadHref={downloadHref} onOpenExternal={onOpenExternal} />;
	}
	if (failed !== undefined) return <div className="preview-fallback">{failed}</div>;
	if (text === undefined) return <div className="preview-fallback">加载中…</div>;
	return (
		<div className="preview-markdown">
			<Markdown text={text} resolveImageSrc={resolveImageSrc} />
		</div>
	);
}

/**
 * 视频预览：先过 Chromium 可播性探测（容器支持 ≠ 编码支持，
 * 如 H.265 的 mp4 在 Chromium 里就放不出），不可播给下载引导。
 */
function VideoPreview({
	url,
	mime,
	downloadHref,
}: {
	readonly url: string;
	readonly mime: string;
	readonly downloadHref: string;
}): React.JSX.Element {
	// canPlayType 返回 "probably"/"maybe"/""，空串 = 确定不可播。同步 DOM API，随渲染直取。
	const playable = document.createElement("video").canPlayType(mime) !== "";
	if (!playable) {
		return (
			<PreviewPlaceholder className="preview-unsupported" message="当前环境无法播放此格式，可下载后用本地播放器查看">
				<a className="preview-action" href={downloadHref} download>
					下载
				</a>
			</PreviewPlaceholder>
		);
	}
	return <video className="preview-video" controls src={url} />;
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

/**
 * flattenTree 只认 collapsedPaths，「未加载即折叠」由 UI 求并集
 *（workspace-file-tree.ts 头注释的渲染接线）：不把未加载文件夹并入
 * 折叠集，首屏就会整树全展开，depth=2 的首屏语义就没了。
 */
function visibleCollapsed(state: LazyTreeState): ReadonlySet<string> {
	const collapsed = new Set(state.collapsedPaths);
	const walk = (nodes: readonly FileTreeNode[]): void => {
		for (const node of nodes) {
			if (node.kind !== "folder") continue;
			if (!state.loadedPaths.has(node.path)) collapsed.add(node.path);
			if (node.children !== undefined) walk(node.children);
		}
	};
	walk(state.fullTree);
	return collapsed;
}

/** 三平级视图的显示名（切换器按钮与菜单项共用一份，两处各写必然漂移）。 */
const VIEW_LABELS: Record<PanelView, string> = {
	overview: "概览",
	workspace: "工作空间文件",
	changes: "变更",
};

/** 菜单顺序固定：概览 / 工作空间文件 / 变更（WorkBuddy 截图同款）。 */
const VIEW_ORDER: readonly PanelView[] = ["overview", "workspace", "changes"];

function viewIcon(view: PanelView): React.JSX.Element {
	switch (view) {
		case "overview":
			return <IconDoc size={14} />;
		case "workspace":
			return <IconWorkspace size={14} />;
		case "changes":
			return <IconEdit size={14} />;
	}
}

/**
 * 视图切换器：按钮 = 当前视图名 + chevron；菜单 = 三个平级视图项，
 * 当前项带 ✓，菜单里不内嵌任何文件列表（层级修正的核心：
 * 变更/工作空间文件不再是概览的子级分组）。
 */
function ViewSwitcher({
	view,
	onSelect,
}: {
	readonly view: PanelView;
	readonly onSelect: (view: PanelView) => void;
}): React.JSX.Element {
	const [open, setOpen] = useState(false);
	return (
		<div className="view-switcher">
			<button
				type="button"
				className="bar-btn bar-btn-text"
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={() => setOpen((v) => !v)}
			>
				{VIEW_LABELS[view]}
				<IconChevronDown size={13} />
			</button>
			{open && (
				<div className="preview-menu view-switcher-menu" role="menu">
					{VIEW_ORDER.map((v) => (
						<button
							key={v}
							type="button"
							className="preview-item"
							role="menuitemradio"
							aria-checked={v === view}
							onClick={() => {
								setOpen(false);
								onSelect(v);
							}}
						>
							{viewIcon(v)}
							<span className="preview-item-name">{VIEW_LABELS[v]}</span>
							{v === view && (
								<span className="preview-item-meta view-switcher-check">
									<IconCheck size={13} />
								</span>
							)}
						</button>
					))}
				</div>
			)}
		</div>
	);
}

/** 概览视图：产物组（计数 + 条目 + 空态）。条目行为：单击预览 / 双击转正 / URL 外部打开。 */
function OverviewView({
	artifacts,
	onPick,
	onPin,
	onOpenExternal,
}: {
	readonly artifacts: readonly ArtifactRef[];
	readonly onPick: (sel: PreviewSelection) => void;
	readonly onPin: (sel: PreviewSelection) => void;
	readonly onOpenExternal: (path: string) => void;
}): React.JSX.Element {
	return (
		<div className="preview-view">
			<header className="preview-group-title">产物（{artifacts.length}）</header>
			{artifacts.length === 0 && <div className="preview-group-empty">暂无内容</div>}
			{artifacts.map((a) => {
				const isUrl = /^https?:\/\//i.test(a.path);
				return (
					<button
						key={a.path}
						type="button"
						className="preview-item"
						title={isUrl ? `${a.path}（外部打开）` : a.path}
						onClick={() => {
							if (isUrl) onOpenExternal(a.path);
							else onPick({ kind: "file", path: a.path });
						}}
						onDoubleClick={() => {
							if (!isUrl) onPin({ kind: "file", path: a.path });
						}}
					>
						<IconDoc size={14} />
						<span className="preview-item-name">{baseName(a.path)}</span>
						{a.size > 0 && <span className="preview-item-meta">{formatSize(a.size)}</span>}
					</button>
				);
			})}
		</div>
	);
}

/** 变更视图：顶部汇总头「文件变更 +N -M」（全变更增删行合计）+ 变更列表（+/- 徽章）。 */
function ChangesView({
	changes,
	onPick,
	onPin,
}: {
	readonly changes: readonly ChangeRef[];
	readonly onPick: (sel: PreviewSelection) => void;
	readonly onPin: (sel: PreviewSelection) => void;
}): React.JSX.Element {
	// 汇总头是合计值（WorkBuddy 截图同款），逐条徽章在下方列表里，两处口径不同不混用。
	const totalAdded = changes.reduce((sum, c) => sum + c.added, 0);
	const totalRemoved = changes.reduce((sum, c) => sum + c.removed, 0);
	return (
		<div className="preview-view">
			{changes.length === 0 ? (
				<div className="preview-group-empty">本会话还没有变更</div>
			) : (
				<>
					<header className="changes-summary">
						<span className="changes-summary-label">文件变更</span>
						<span className="added">+{totalAdded}</span>
						<span className="removed">-{totalRemoved}</span>
					</header>
					{changes.map((c) => (
						<button
							key={c.path}
							type="button"
							className="preview-item"
							title={c.path}
							onClick={() => onPick({ kind: "change", path: c.path })}
							onDoubleClick={() => onPin({ kind: "change", path: c.path })}
						>
							<IconDoc size={14} />
							<span className="preview-item-name">{baseName(c.path)}</span>
							<span className="preview-item-meta">
								<span className="added">+{c.added}</span>
								<span className="removed">-{c.removed}</span>
							</span>
						</button>
					))}
				</>
			)}
		</div>
	);
}

/** 工作空间文件视图：懒加载目录树（状态机原样复用 workspace-file-tree.ts）。 */
function WorkspaceView({
	cwd,
	active,
	onPick,
	onPin,
}: {
	readonly cwd: string | undefined;
	/** 当前激活的预览对象（目录树里高亮对应文件行）。 */
	readonly active: PreviewSelection | undefined;
	readonly onPick: (sel: PreviewSelection) => void;
	readonly onPin: (sel: PreviewSelection) => void;
}): React.JSX.Element {
	const [tree, setTree] = useState<LazyTreeState | undefined>(undefined);

	// 切入该视图（组件挂载）时拉一次（复用补全通道的索引，两份扫描必然漂移）。
	// 数据一次性全量（file-index maxEntries 2000 上限），目录树的「懒加载」
	// 是状态机上的渐进展开而非数据拉取——为将来条目超限后的真分页留口
	//（workspace-file-tree.ts 头注释）。切走即卸载、回来重拉，与旧
	// 「打开下拉时拉一次」同口径，顺带拿到最新索引。
	useEffect(() => {
		if (cwd === undefined) return;
		let disposed = false;
		window.kami
			.completions()
			.then((d) => {
				if (!disposed) setTree(createLazyTreeState(d.files));
			})
			.catch(() => {
				if (!disposed) setTree(createLazyTreeState([]));
			});
		return () => {
			disposed = true;
		};
	}, [cwd]);

	/** 文件夹行点击：已加载的折叠 → 即刻展开；展开态 → 折叠；未加载 → 转圈后展开。 */
	const toggleFolder = (path: string): void => {
		if (tree === undefined) return;
		if (tree.loadedPaths.has(path)) {
			setTree(tree.collapsedPaths.has(path) ? expandFolder(tree, path) : collapseFolder(tree, path));
			return;
		}
		// 未加载：数据其实已在 fullTree 即刻可得，setTimeout 只是对齐
		// WorkBuddy「加载中转圈 → 展开」的交互语义，并为真分页留口
		//（异步节奏归 UI 管，状态机只做状态迁移——其头注释的接线约定）。
		setTree(expandFolder(tree, path));
		setTimeout(() => {
			setTree((cur) => (cur === undefined ? cur : finishLoad(cur, path)));
		}, 200);
	};

	return (
		<div className="preview-view">
			{cwd === undefined ? (
				<div className="preview-group-empty">工作区尚未就绪</div>
			) : tree === undefined ? (
				<div className="preview-group-empty">加载中…</div>
			) : (
				<div className="file-tree">
					{flattenTree(tree.fullTree, visibleCollapsed(tree)).map(({ node, depth }) =>
						node.kind === "folder" ? (
							<button
								key={node.path}
								type="button"
								className="file-tree-row file-tree-folder"
								style={{ paddingLeft: `${8 + depth * 12}px` }}
								title={node.path}
								onClick={() => toggleFolder(node.path)}
							>
								<IconChevronDown
									size={12}
									className={`file-tree-chevron${tree.loadedPaths.has(node.path) && !tree.collapsedPaths.has(node.path)
											? " expanded"
											: ""
										}`}
								/>
								<IconFolder size={14} />
								<span className="file-tree-name">{node.name}</span>
								{tree.loadingPaths.has(node.path) && <span className="file-tree-spinner" />}
							</button>
						) : (
							<button
								key={node.path}
								type="button"
								className={`file-tree-row file-tree-file${active?.kind === "file" && active.path === node.path ? " selected" : ""
									}`}
								/* 文件行没有 chevron：补 18px（12 chevron + 6 gap）让图标与文件夹行对齐。 */
								style={{ paddingLeft: `${8 + depth * 12 + 18}px` }}
								title={node.path}
								onClick={() => onPick({ kind: "file", path: node.path })}
								onDoubleClick={() => onPin({ kind: "file", path: node.path })}
							>
								<FileTypeIcon name={node.name} size={14} />
								<span className="file-tree-name">{node.name}</span>
							</button>
						),
					)}
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
	width,
	fullscreen,
	onWidthChange,
	onToggleFullscreen,
	onOpen,
	onPin,
	onCloseTab,
	onOpenExternal,
	onError,
}: ArtifactPanelProps): React.JSX.Element {
	// 主体双态（列表 / 预览）× 当前视图，迁移语义见 panel-view.ts 头注释。
	const [panelState, setPanelState] = useState<PanelViewState>(initialPanelViewState);
	const { view, mode } = panelState;

	/** 单击条目/点 tab：App 侧 openPreview 落（或激活）tab，面板侧翻预览态。 */
	const pick = (sel: PreviewSelection): void => {
		onOpen(sel);
		setPanelState((s) => openPreview(s));
	};

	/** 双击转正：同上，转正在 App 侧完成。 */
	const pin = (sel: PreviewSelection): void => {
		onPin(sel);
		setPanelState((s) => openPreview(s));
	};

	/**
	 * 外部打开（产物卡 / focusFile / present_files 首开）不经面板内部回调，
	 * 直接改 previewActive —— 不同步的话外部点了卡片面板还停在列表态。
	 * 唯一例外：关 tab 让 App 把 active 回退到剩余 tab（handleCloseTab 记下
	 * 回退目标），列表态关 tab 不该被这个同步拽回预览。
	 */
	const closedActiveRef = useRef<PreviewSelection | undefined>(undefined);
	useEffect(() => {
		if (active === undefined) {
			// 外部清空（如会话切换 closePreviewPanel）→ 回列表态，
			// 保住「预览态必有激活项」的不变量。
			setPanelState((s) => (s.mode === "preview" ? closeLastTab(s) : s));
			return;
		}
		const fallback = closedActiveRef.current;
		closedActiveRef.current = undefined;
		if (fallback !== undefined && sameSelection(fallback, active)) return;
		setPanelState((s) => (s.mode === "preview" ? s : openPreview(s)));
	}, [active]);

	const handleCloseTab = (sel: PreviewSelection): void => {
		const remaining = tabs.filter((t) => !sameSelection(t, sel));
		if (active !== undefined && sameSelection(active, sel) && remaining.length > 0) {
			// 与 App closePreviewTab 的回退口径一致：active 落到最后一个剩余 tab。
			closedActiveRef.current = remaining[remaining.length - 1];
		}
		onCloseTab(sel);
		setPanelState((s) => (remaining.length === 0 ? closeLastTab(s) : closeTab(s)));
	};

	const servable = previewBaseUrl !== undefined && cwd !== undefined;
	const activeChange =
		active?.kind === "change" ? changes.find((c) => c.path === active.path) : undefined;

	const rel = active === undefined ? "" : toRelative(active.path, cwd);
	const kind = active === undefined ? "unsupported" : kindOf(rel);
	// 文件所在目录的绝对路径：超大占位的「打开所在文件夹」用（shell.openPath 开目录）。
	// cwd 可能是反斜杠（Windows），拼正斜杠的混合分隔 shell.openPath 照常识别。
	const dirRel = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
	const folderPath = cwd === undefined ? "" : dirRel === "" ? cwd : `${cwd}/${dirRel}`;

	// sash 拖拽调宽（WorkBuddy colleague-artifact-provider 同口径：
	// mousedown 记起点与起始宽，mousemove clamp [340, 800]，拖拽时 body cursor/user-select）。
	const handleSashMouseDown = (event: React.MouseEvent): void => {
		event.preventDefault();
		const startX = event.clientX;
		const startWidth = width;
		const onMouseMove = (moveEvent: MouseEvent): void => {
			const delta = startX - moveEvent.clientX;
			onWidthChange(Math.min(Math.max(startWidth + delta, 340), 800));
		};
		const onMouseUp = (): void => {
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("mouseup", onMouseUp);
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
		};
		document.addEventListener("mousemove", onMouseMove);
		document.addEventListener("mouseup", onMouseUp);
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";
	};

	// sash 键盘调宽：与鼠标拖拽同一个 setter、同一份 [340, 800] clamp。
	// 方向口径与拖拽一致 —— 分隔条向左移面板变宽（delta = startX - clientX），
	// 所以 ArrowLeft 加宽、ArrowRight 收窄（WAI-ARIA window splitter 同约定）。
	const handleSashKeyDown = (event: React.KeyboardEvent): void => {
		if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
		event.preventDefault();
		const delta = event.key === "ArrowLeft" ? 10 : -10;
		onWidthChange(Math.min(Math.max(width + delta, 340), 800));
	};

	// Esc 退出全屏（监听挂在全屏态上，非全屏不注册）。
	useEffect(() => {
		if (!fullscreen) return;
		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.key === "Escape") onToggleFullscreen();
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [fullscreen, onToggleFullscreen]);

	return (
		<aside
			className={`preview-panel${fullscreen ? " fullscreen" : ""}`}
			style={fullscreen ? undefined : { width: `${width}px` }}
		>
			{/* 拖拽手柄：仅非全屏时可用（全屏宽由容器撑满，拖拽无意义）。 */}
			{!fullscreen && (
				<div
					className="preview-sash"
					role="separator"
					aria-orientation="vertical"
					aria-label="拖拽调整面板宽度"
					tabIndex={0}
					onMouseDown={handleSashMouseDown}
					onKeyDown={handleSashKeyDown}
				/>
			)}
			<header className="preview-head">
				<ViewSwitcher view={view} onSelect={(v) => setPanelState((s) => selectView(s, v))} />
				<div className="preview-tabs-strip">
					{tabs.map((sel) => (
						<span
							key={`${sel.kind}:${sel.path}`}
							/* 列表态 tabs 仍显示但不高亮：激活语义只在预览态成立。 */
							className={`preview-tab-item${mode === "preview" && active !== undefined && sameSelection(sel, active) ? " active" : ""}${sel.isPreview === true ? " preview" : ""}`}
						>
							<button
								type="button"
								className="preview-tab-label"
								title={sel.kind === "change" ? `${sel.path}（变更）` : sel.path}
								onClick={() => pick(sel)}
							>
								{baseName(sel.path)}
								{sel.kind === "change" && "（变更）"}
							</button>
							<button
								type="button"
								className="preview-tab-close"
								title="关闭"
								aria-label={`关闭 ${baseName(sel.path)}`}
								onClick={() => handleCloseTab(sel)}
							>
								<IconClose size={11} />
							</button>
						</span>
					))}
				</div>
				<button
					type="button"
					className="bar-btn"
					title={fullscreen ? "退出全屏" : "全屏"}
					aria-label={fullscreen ? "退出全屏" : "全屏"}
					onClick={onToggleFullscreen}
				>
					{fullscreen ? <IconShrink size={14} /> : <IconExpand size={14} />}
				</button>
				<button
					type="button"
					className="bar-btn"
					title="外部打开"
					aria-label="外部打开"
					disabled={active === undefined}
					onClick={() => {
						if (active !== undefined) onOpenExternal(active.path);
					}}
				>
					<IconOpenExternal size={14} />
				</button>
			</header>

			<div className="preview-body">
				{/* 列表态 = 默认主体（不再是「选择文件以预览」占位）。
				    active===undefined 的预览态是同步间隙的瞬态（pick 与 App 落 active
				    之间的帧），也落列表渲染兜底，不闪占位。 */}
				{mode === "list" || active === undefined ? (
					view === "overview" ? (
						<OverviewView
							artifacts={artifacts}
							onPick={pick}
							onPin={pin}
							onOpenExternal={onOpenExternal}
						/>
					) : view === "changes" ? (
						<ChangesView changes={changes} onPick={pick} onPin={pin} />
					) : (
						<WorkspaceView cwd={cwd} active={active} onPick={pick} onPin={pin} />
					)
				) : (
					<>
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
						{active.kind === "file" && servable && kind === "markdown" && (
							<MarkdownPreview
								path={rel}
								previewBaseUrl={previewBaseUrl}
								folderPath={folderPath}
								downloadHref={downloadUrl(previewBaseUrl, rel)}
								onOpenExternal={onOpenExternal}
								onError={onError}
							/>
						)}
						{active.kind === "file" && servable && kind === "code" && (
							<CodeFilePreview
								path={rel}
								folderPath={folderPath}
								downloadHref={downloadUrl(previewBaseUrl, rel)}
								onOpenExternal={onOpenExternal}
								onError={onError}
							/>
						)}
						{active.kind === "file" && servable && kind === "text" && (
							<TextPreview
								path={rel}
								folderPath={folderPath}
								downloadHref={downloadUrl(previewBaseUrl, rel)}
								onOpenExternal={onOpenExternal}
								onError={onError}
							/>
						)}
						{active.kind === "file" && servable && kind === "pdf" && (
							<PdfPreview url={previewUrl(previewBaseUrl, rel)} />
						)}
						{active.kind === "file" && servable && (kind === "docx" || kind === "xlsx" || kind === "pptx") && (
							<OfficePreview
								url={previewUrl(previewBaseUrl, rel)}
								downloadHref={downloadUrl(previewBaseUrl, rel)}
								name={baseName(rel)}
								format={kind}
								onOpenExternal={() => onOpenExternal(active.path)}
							/>
						)}
						{active.kind === "file" && servable && kind === "video" && (
							<VideoPreview
								url={previewUrl(previewBaseUrl, rel)}
								mime={MEDIA_MIME[extOf(rel)] ?? ""}
								downloadHref={downloadUrl(previewBaseUrl, rel)}
							/>
						)}
						{active.kind === "file" && servable && kind === "audio" && (
							<audio className="preview-audio" controls src={previewUrl(previewBaseUrl, rel)} />
						)}
						{active.kind === "file" && servable && kind === "unsupported" && (
							<PreviewPlaceholder className="preview-unsupported" message="暂不支持预览">
								<button type="button" className="preview-action" onClick={() => onOpenExternal(active.path)}>
									外部打开
								</button>
								<a className="preview-action" href={downloadUrl(previewBaseUrl, rel)} download>
									下载
								</a>
							</PreviewPlaceholder>
						)}
					</>
				)}
			</div>
		</aside>
	);
}
