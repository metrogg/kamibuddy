/**
 * pptx 预览：pptx-preview（HTML 渲染，图表走内嵌 echarts）。
 *
 * 库按固定基准宽度渲染（wrapper 宽 = options.width，缺省会变成 "undefinedpx"，必传），
 * 取 WorkBuddy 同口径的 960px。面板比 960 窄时用 CSS zoom 整体缩放——改基准宽度
 * 会让每页重新排版，zoom 只是视觉缩放，排版不动（WorkBuddy 同机制）。
 *
 * mode 缺省为列表模式（全部页面纵向铺开滚动）；库另有的 slide 单页模式
 * 带翻页按钮，预览面板里滚动比翻页顺手，不用。
 */

import { useEffect, useRef, useState } from "react";
import { init } from "pptx-preview";

/** 渲染基准宽度（px），与 WorkBuddy 的 PPTX_BASE_WIDTH 同值。 */
const BASE_WIDTH = 960;

export default function PptxPreview({ url }: { readonly url: string }): React.JSX.Element {
	const scrollRef = useRef<HTMLDivElement>(null);
	const hostRef = useRef<HTMLDivElement>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | undefined>(undefined);

	useEffect(() => {
		const host = hostRef.current;
		if (host === null) return;
		let disposed = false;
		setLoading(true);
		setError(undefined);
		host.replaceChildren();
		const previewer = init(host, { width: BASE_WIDTH });

		(async () => {
			const response = await fetch(url);
			if (!response.ok) throw new Error(`读取文件失败（HTTP ${response.status}）`);
			const buffer = await response.arrayBuffer();
			if (disposed) return;
			await previewer.preview(buffer);
			if (disposed) return;
			// 损坏的文件也可能“解析成功”但一页没有，响亮报错比白屏好排查。
			if (previewer.slideCount === 0) throw new Error("没有可渲染的页面");
			setLoading(false);
		})().catch((cause: unknown) => {
			if (!disposed) {
				setLoading(false);
				setError(cause instanceof Error ? cause.message : String(cause));
			}
		});

		return () => {
			disposed = true;
			previewer.destroy();
			host.replaceChildren();
		};
	}, [url]);

	// 面板窄于基准宽度时等比缩小；拖宽面板、全屏切换都要重算。
	useEffect(() => {
		const scroll = scrollRef.current;
		const host = hostRef.current;
		if (scroll === null || host === null) return;
		const updateZoom = (): void => {
			const width = scroll.clientWidth;
			host.style.zoom = width > 0 && width < BASE_WIDTH ? String(width / BASE_WIDTH) : "";
		};
		updateZoom();
		const observer = new ResizeObserver(updateZoom);
		observer.observe(scroll);
		return () => observer.disconnect();
	}, []);

	return (
		<div className="preview-office-content office-pptx-wrap">
			<div ref={scrollRef} className="office-pptx-scroll">
				{/* 加载中也保持可见：幻灯片里的图表是 echarts canvas，display:none 下
				   初始化会量到 0×0 画成空白——加载/错误态用绝对定位浮层盖住（WorkBuddy 同机制）。 */}
				<div ref={hostRef} className="office-pptx" />
			</div>
			{loading && <div className="office-overlay">解析演示文稿中…</div>}
			{error !== undefined && <div className="office-overlay">演示文稿解析失败：{error}</div>}
		</div>
	);
}
