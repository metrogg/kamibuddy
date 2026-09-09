/**
 * PDF 预览：react-pdf（pdf.js 的 React 封装）分页渲染。
 *
 * worker 方案（为什么不走 CDN）：办公场景可能离线，worker 必须打进本地 chunk。
 * 用 vite 的 `?worker` 导入，构建期产出独立 worker chunk，零网络依赖。
 *
 * 版本红线：react-pdf 10.5.0 钉死 pdfjs-dist 5.4.296，而仓库根依赖是
 * pdfjs-dist 6.3.289（core/doc-extract 在用，不能动）——npm 把 5.4.296 嵌套在
 * react-pdf/node_modules 下。pdf.js 启动时校验 API 与 worker 版本严格一致，
 * 所以 worker 必须从嵌套的 5.4.296 导入，用根依赖的 6.x worker 会直接抛
 * "API version does not match the Worker version"。
 *
 * 已知限制：未配置 cMapUrl/standardFontDataUrl——CID-keyed 的中文 PDF 画布渲染
 * 正常（字形内嵌），但文本层选区/复制可能失真。把整包 cmaps 打进资源留待后续。
 */

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import PdfWorker from "react-pdf/node_modules/pdfjs-dist/build/pdf.worker.min.mjs?worker";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import {
	IconChevronLeft,
	IconChevronRight,
	IconMinus,
	IconPlus,
} from "./icons.tsx";

/**
 * 懒启动 worker：模块加载即 `new PdfWorker()` 会让 worker 线程常驻，
 * 而 PDF 预览可能整场会话都用不到。首次渲染 PdfPreview 时才启动，
 * 且必须发生在 Document 挂载前（react-pdf 读 GlobalWorkerOptions 的时机），
 * 所以放在组件体顶部而不是 useEffect 里。
 */
let workerStarted = false;
function ensureWorker(): void {
	if (workerStarted) return;
	workerStarted = true;
	pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker();
}

/** 缩放模式：适应宽度（默认，办公文档第一诉求是读全行）或固定倍率。 */
type ZoomMode = { readonly kind: "fit" } | { readonly kind: "scale"; readonly value: number };

const MIN_SCALE = 0.4;
const MAX_SCALE = 3;
/** 页面两侧留边（px），fit 宽度要扣掉它。 */
const PAGE_MARGIN = 32;

function clampScale(value: number): number {
	return Math.min(Math.max(value, MIN_SCALE), MAX_SCALE);
}

export function PdfPreview({ url }: { readonly url: string }): React.JSX.Element {
	ensureWorker();

	const [numPages, setNumPages] = useState<number | undefined>(undefined);
	const [pageNumber, setPageNumber] = useState(1);
	const [mode, setMode] = useState<ZoomMode>({ kind: "fit" });
	/** 页面 1.0 倍率下的原始宽度（pt），fit 模式下换算当前有效倍率用。 */
	const [pageBaseWidth, setPageBaseWidth] = useState<number | undefined>(undefined);
	const bodyRef = useRef<HTMLDivElement | null>(null);
	const [bodyWidth, setBodyWidth] = useState(0);

	// 换文件回到第一页；缩放偏好保留（连续读同类文档不用反复调）。
	useEffect(() => {
		setPageNumber(1);
		setNumPages(undefined);
		setPageBaseWidth(undefined);
	}, [url]);

	// 适应宽度要量容器：ResizeObserver 跟随面板拖拽调宽/全屏。
	useEffect(() => {
		const el = bodyRef.current;
		if (el === null) return;
		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (entry !== undefined) setBodyWidth(entry.contentRect.width);
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	const fitWidth = Math.max(bodyWidth - PAGE_MARGIN, 0);
	const effectiveScale =
		mode.kind === "scale"
			? mode.value
			: pageBaseWidth !== undefined && fitWidth > 0
				? fitWidth / pageBaseWidth
				: 1;

	const zoomBy = (delta: number): void => {
		setMode({ kind: "scale", value: clampScale(Math.round((effectiveScale + delta) * 10) / 10) });
	};

	const goToPage = (value: number): void => {
		setPageNumber(Math.min(Math.max(value, 1), numPages ?? 1));
	};

	return (
		<div className="preview-pdf">
			<div className="preview-pdf-toolbar">
				<button
					type="button"
					className="bar-btn"
					title="上一页"
					aria-label="上一页"
					disabled={pageNumber <= 1}
					onClick={() => goToPage(pageNumber - 1)}
				>
					<IconChevronLeft size={14} />
				</button>
				<span className="preview-pdf-pages">
					<input
						className="preview-pdf-page-input"
						type="number"
						min={1}
						max={numPages ?? 1}
						value={pageNumber}
						aria-label="页码"
						onChange={(event) => {
							const value = Number.parseInt(event.target.value, 10);
							if (Number.isFinite(value)) goToPage(value);
						}}
					/>
					{" / "}
					{numPages ?? "–"}
				</span>
				<button
					type="button"
					className="bar-btn"
					title="下一页"
					aria-label="下一页"
					disabled={numPages === undefined || pageNumber >= numPages}
					onClick={() => goToPage(pageNumber + 1)}
				>
					<IconChevronRight size={14} />
				</button>
				<span className="preview-pdf-sep" />
				<button
					type="button"
					className="bar-btn"
					title="缩小"
					aria-label="缩小"
					disabled={mode.kind === "scale" && mode.value <= MIN_SCALE}
					onClick={() => zoomBy(-0.2)}
				>
					<IconMinus size={14} />
				</button>
				<span className="preview-pdf-zoom">
					{mode.kind === "fit" ? "适应宽度" : `${Math.round(mode.value * 100)}%`}
				</span>
				<button
					type="button"
					className="bar-btn"
					title="放大"
					aria-label="放大"
					disabled={mode.kind === "scale" && mode.value >= MAX_SCALE}
					onClick={() => zoomBy(0.2)}
				>
					<IconPlus size={14} />
				</button>
				<button
					type="button"
					className="bar-btn bar-btn-text"
					title="适应宽度"
					disabled={mode.kind === "fit"}
					onClick={() => setMode({ kind: "fit" })}
				>
					适应宽度
				</button>
			</div>
			<div className="preview-pdf-body" ref={bodyRef}>
				<Document
					file={url}
					loading={<div className="preview-fallback">加载中…</div>}
					error={<div className="preview-fallback">PDF 加载失败，请外部打开查看</div>}
					onLoadSuccess={(pdf) => setNumPages(pdf.numPages)}
				>
					{/* fit 模式下宽度未量到之前不渲染 Page：scale=1 先铺一页再
					    跳变会造成明显的二次布局闪烁。 */}
					{(mode.kind === "scale" || fitWidth > 0) && (
						<Page
							pageNumber={pageNumber}
							{...(mode.kind === "fit" ? { width: fitWidth } : { scale: mode.value })}
							renderTextLayer={true}
							onLoadSuccess={(page) => {
								const base = page.getViewport({ scale: 1 }).width;
								setPageBaseWidth((prev) => (prev === base ? prev : base));
							}}
						/>
					)}
				</Document>
			</div>
		</div>
	);
}
