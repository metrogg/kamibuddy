/**
 * Office 预览统一入口：按 format 分发到 docx / xlsx / pptx 三个子组件。
 *
 * 三个渲染库都很大（fortune-sheet 全功能表格、pptx-preview 内嵌 echarts），
 * 全部首屏加载会把主 chunk 撑爆。React.lazy 的动态 import 以**文件**为边界
 * 拆 chunk，所以三个子组件各自独立成文件（office-docx/xlsx/pptx.tsx）——
 * 打开哪种格式才下载哪个库（WorkBuddy 的 docx-preview/xlsx/pptx-preview
 * 分 chunk 是同一件事）。
 *
 * 结构：工具栏（下载 / 外部打开）+ 内容区（滚动由各自组件管）。
 * 下载 URL 由调用方按 preview-server 的 ?download 约定拼好传入
 * （Content-Disposition: attachment；面板与静态服务不同源，<a download>
 * 属性会被 Chromium 忽略，preview-server.ts 头注释）。
 */

import { Suspense, lazy } from "react";
import { IconDownload, IconOpenExternal } from "./icons.tsx";

const DocxPreview = lazy(() => import("./office-docx.tsx"));
const XlsxPreview = lazy(() => import("./office-xlsx.tsx"));
const PptxPreview = lazy(() => import("./office-pptx.tsx"));

export type OfficeFormat = "docx" | "xlsx" | "pptx";

export function OfficePreview({
	url,
	downloadHref,
	name,
	format,
	onOpenExternal,
}: {
	/** preview-server 的文件 URL。 */
	readonly url: string;
	/** 强制落盘的下载 URL（?download 约定）。 */
	readonly downloadHref: string;
	/** 文件名（工具栏显示 + title）。 */
	readonly name: string;
	readonly format: OfficeFormat;
	readonly onOpenExternal: () => void;
}): React.JSX.Element {
	return (
		<div className="preview-office">
			<div className="preview-office-bar">
				<span className="preview-office-name" title={name}>
					{name}
				</span>
				<a className="bar-btn" title="下载" aria-label={`下载 ${name}`} href={downloadHref}>
					<IconDownload size={14} />
				</a>
				<button
					type="button"
					className="bar-btn"
					title="外部打开"
					aria-label="外部打开"
					onClick={onOpenExternal}
				>
					<IconOpenExternal size={14} />
				</button>
			</div>
			{/* chunk 加载中的兜底；文件解析中的加载态由子组件自己渲染。 */}
			<Suspense fallback={<div className="preview-fallback">加载渲染器…</div>}>
				{format === "docx" && <DocxPreview url={url} />}
				{format === "xlsx" && <XlsxPreview url={url} />}
				{format === "pptx" && <PptxPreview url={url} />}
			</Suspense>
		</div>
	);
}
