/**
 * docx 预览：docx-preview 纯 JS 渲染（fetch → arrayBuffer → renderAsync 到容器）。
 *
 * 独立成文件是 React.lazy 拆 chunk 的需要（见 office-preview.tsx 头注释）。
 * 库把每个页面渲染成 <section class="docx">，页面宽度取自文档设置，
 * 面板比纸宽窄时内容区横向滚动（.preview-office-content 的 overflow:auto）。
 */

import { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";

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
			{loading && <div className="preview-fallback">解析文档中…</div>}
			{error !== undefined && <div className="preview-fallback">文档解析失败：{error}</div>}
			<div ref={containerRef} className="office-docx" hidden={loading || error !== undefined} />
		</div>
	);
}
