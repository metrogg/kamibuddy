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

	return (
		<div className="preview-office-content office-docx-scroll">
			{loading && <div className="preview-fallback">解析文档中…</div>}
			{error !== undefined && <div className="preview-fallback">文档解析失败：{error}</div>}
			<div ref={containerRef} className="office-docx" hidden={loading || error !== undefined} />
		</div>
	);
}
