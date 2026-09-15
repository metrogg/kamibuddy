/**
 * docx 预览：docx-preview 纯 JS 渲染（fetch → arrayBuffer → renderAsync 到容器）。
 *
 * 独立成文件是 React.lazy 拆 chunk 的需要（见 office-preview.tsx 头注释）。
 * 库把每个页面渲染成 <section class="docx">，页面宽度取自文档设置，
 * 面板比纸宽窄时内容区横向滚动（.preview-office-content 的 overflow:auto）。
 */

import { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import { ErrorState, Skeleton } from "./state-views.tsx";

/**
 * 解析期纸张骨架的尺寸来源（与真实渲染逐条对齐，不要凭手感改）：
 *  - `SKELETON_PAD` 16px = `.office-docx .docx-wrapper` 的 `padding: var(--space-5)`；
 *  - 纸宽上限 794px = A4 纸宽（210mm ≈ 794px，与本文件头注释同一来源）。真实 section 的
 *    宽度取自文档设置，解析完成前无从得知，未知时按 A4 假设；面板更窄时另有
 *    `container.style.zoom` 等比缩放，故这里给 `width: 100%`（先占住同一宽度）；
 *  - 纸高按 A4 比例 210:297 —— 比例是必须对齐的一项：纸矮了，第一页以下的内容
 *    在解析完成时会整体下移。
 */
const PAPER_WIDTH = 794;

/** 骨架外层：与 `.docx-wrapper` 同位（16px 内边距，纸在其中居中）。
    `flex-shrink: 0`：它是 `.office-docx-scroll`（flex 列）的 flex 项，默认可被压到容器高度，
    纸会比外层还高、滚动区高度就由被压扁的外层决定 —— 干脆不许压，让滚动区按纸的真实高度算。 */
const SKELETON_PAD_STYLE: React.CSSProperties = {
	padding: "var(--space-5)",
	flexShrink: 0,
};

/** 白纸：与 `section.docx` 同宽同比例（该 section 是纯白 + 纸张影，骨架不画影：影子出现
    时不会有任何位移，而把它抄成内联字面值会与 `.docx-wrapper>section.docx` 的原值两处漂移）。 */
const PAPER_STYLE: React.CSSProperties = {
	width: "100%",
	maxWidth: PAPER_WIDTH,
	margin: "0 auto",
	aspectRatio: "210 / 297",
	background: "var(--bg)",
	padding: "var(--space-6)",
	display: "flex",
	flexDirection: "column",
	/* 12px 行距 + 10px 条 ≈ 正文 22.4px 的行距（14px 正文 × 1.6），看起来才像「一页文字」。 */
	gap: "var(--space-4)",
};

export default function DocxPreview({ url }: { readonly url: string }): React.JSX.Element {
	const scrollRef = useRef<HTMLDivElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | undefined>(undefined);

	useEffect(() => {
		const container = containerRef.current;
		if (container === null) return;
		let disposed = false;
		setLoading(true);
		setError(undefined);

		(async () => {
			const response = await fetch(url);
			if (!response.ok) throw new Error(`读取文件失败（HTTP ${response.status}）`);
			const buffer = await response.arrayBuffer();
			if (disposed) return;
			// StrictMode 双跑与切换文件都会重进 effect：先清空，否则渲染结果叠加。
			container.replaceChildren();
			await renderAsync(buffer, container);
			if (!disposed) setLoading(false);
		})().catch((cause: unknown) => {
			if (!disposed) {
				setLoading(false);
				setError(cause instanceof Error ? cause.message : String(cause));
			}
		});

		return () => {
			disposed = true;
		};
	}, [url]);

	// 面板窄于纸宽时等比缩小（zoom 视觉缩放，排版不动——与 pptx 同机制）。
	// docx-preview 的 section 宽度取自文档设置（A4 纸宽 210mm ≈ 794px），
	// 面板窄时横向滚动不如适应宽度顺手（PDF 预览有同款 ResizeObserver 跟随调宽）。
	useEffect(() => {
		const scroll = scrollRef.current;
		const container = containerRef.current;
		if (scroll === null || container === null) return;
		const updateZoom = (): void => {
			const firstSection = container.querySelector<HTMLElement>("section.docx");
			if (firstSection === null) return;
			const paperWidth = firstSection.offsetWidth;
			const panelWidth = scroll.clientWidth;
			container.style.zoom =
				paperWidth > 0 && panelWidth > 0 && panelWidth < paperWidth
					? String(panelWidth / paperWidth)
					: "";
		};
		// 渲染完成后首次计算（renderAsync 是异步的，section 可能还没挂上）。
		const timer = setTimeout(updateZoom, 100);
		const observer = new ResizeObserver(updateZoom);
		observer.observe(scroll);
		return () => {
			clearTimeout(timer);
			observer.disconnect();
		};
	}, [loading]);

	return (
		<div ref={scrollRef} className="preview-office-content office-docx-scroll">
			{loading && (
				/* 纸张骨架而非居中转圈：docx 的形状完全可预知（灰底 + 居中白纸），
				   骨架连"白纸多大、出现在哪"一起说清楚，解析完成时是同尺寸替换。 */
				<div style={SKELETON_PAD_STYLE} role="status" aria-label="正在解析文档">
					<div style={PAPER_STYLE}>
						<Skeleton width="34%" height={16} />
						<Skeleton width="96%" height={10} />
						<Skeleton width="92%" height={10} />
						<Skeleton width="97%" height={10} />
						<Skeleton width="78%" height={10} />
						<Skeleton width="94%" height={10} />
						<Skeleton width="88%" height={10} />
						<Skeleton width="52%" height={10} />
					</div>
				</div>
			)}
			{error !== undefined && <ErrorState message={`文档解析失败：${error}`} />}
			<div ref={containerRef} className="office-docx" hidden={loading || error !== undefined} />
		</div>
	);
}
