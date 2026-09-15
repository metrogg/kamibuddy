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
import { LoadingState } from "./state-views.tsx";

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
			{/* chunk 加载中的兜底；文件解析中的加载态由子组件自己渲染。
			    这一处**故意不用骨架**（本期骨架屏的另一半在子组件里）：等的不是文档内容的形状，
			    而是渲染器 chunk 本身，而"纸多宽、格子多高"这些几何常量正属于被等待的那个 chunk。
			    要在 eager 的这一层画出同形骨架，就得把 docx/xlsx 各自的尺寸再抄一份到这里
			    —— 两份几何必然漂移（同 AGENTS.md §4 防重复），且 pptx 的解析期本来就是文字浮层
			    （DESIGN.md §4 豁免 ①），同一组件在三种 format 下会出现三种等待语言。
			    文案也承载信息：「加载渲染器…」与子组件的「解析文档中…」是两种可区分的等待，
			    前者指向"渲染器没下下来"这个可排查的失败面。 */}
			<Suspense fallback={<LoadingState text="加载渲染器…" />}>
				{format === "docx" && <DocxPreview url={url} />}
				{format === "xlsx" && <XlsxPreview url={url} />}
				{format === "pptx" && <PptxPreview url={url} />}
			</Suspense>
		</div>
	);
}
