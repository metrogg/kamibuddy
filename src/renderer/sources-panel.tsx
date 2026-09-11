/**
 * 引用来源面板（spec: add-search-sources-panel）：右侧栏列出本会话聚合的
 * 网页来源（favicon + 站点 + 标题 + 摘要），调研类任务的可信度入口——
 * 用户能逐条核实模型的信息来源。
 *
 * 与 ArtifactPanel 同位互斥（App 层二选一渲染），容器复用 preview-panel /
 * preview-head 骨架与同一宽度（不做 sash 调宽与全屏）。
 *
 * 点击列表项经 window.open 交给主进程：setWindowOpenHandler 统一 deny +
 * shell.openExternal（与 Markdown 链接同一通道，应用内不导航，
 * 见 main/index.ts 与 markdown.tsx 头注）。
 */

import { useState } from "react";
import type { SourceRef } from "@shared/session-events.ts";
import { sourceUrlMeta } from "./collect-sources.ts";
import { IconClose, IconWeb } from "./icons.tsx";

/**
 * 站点 favicon（默认 16px 圆形）：直连 `${origin}/favicon.ico`，加载失败
 * 回退 Globe 图标（WorkBuddy 内联卡同款回退；无本地缓存，spec「不做」清单）。
 * 操作行头像组与面板列表项共用，失败语义两端一致。
 */
export function SourceFavicon({
	url,
	size = 16,
}: {
	readonly url: string;
	readonly size?: number;
}): React.JSX.Element {
	const [failed, setFailed] = useState(false);
	if (failed) {
		return (
			<span className="source-favicon source-favicon-fallback" style={{ width: size, height: size }}>
				<IconWeb size={size - 4} />
			</span>
		);
	}
	return (
		<img
			className="source-favicon"
			src={url}
			width={size}
			height={size}
			alt=""
			draggable={false}
			onError={() => setFailed(true)}
		/>
	);
}

export function SourcesPanel({
	sources,
	width,
	onClose,
}: {
	readonly sources: readonly SourceRef[];
	/** 面板宽度（px）：与 ArtifactPanel 同一份 panelWidth。 */
	readonly width: number;
	readonly onClose: () => void;
}): React.JSX.Element {
	return (
		<aside className="preview-panel sources-panel" style={{ width: `${width}px` }}>
			<header className="preview-head">
				<span className="sources-title">引用来源 ({sources.length})</span>
				<button
					type="button"
					className="bar-btn"
					title="关闭"
					aria-label="关闭引用来源面板"
					onClick={onClose}
				>
					<IconClose size={14} />
				</button>
			</header>
			<div className="preview-view sources-list">
				{sources.map((source) => {
					const meta = sourceUrlMeta(source.url);
					// 空/非法 URL 项不渲染（daemon 侧已过安全校验，这里是渲染层兜底）。
					if (meta === undefined) return null;
					return (
						<button
							key={source.url}
							type="button"
							className="source-item"
							title={`${source.title}\n${source.url}（外部打开）`}
							onClick={() => window.open(source.url)}
						>
							<span className="source-item-meta">
								<SourceFavicon url={meta.favicon} />
								<span className="source-item-site">{source.site ?? meta.host}</span>
							</span>
							<span className="source-item-title">{source.title}</span>
							{/* 摘要两行截断，有才渲染（site/snippet 均为可选载荷）。 */}
							{source.snippet !== undefined && source.snippet !== "" && (
								<span className="source-item-snippet">{source.snippet}</span>
							)}
						</button>
					);
				})}
			</div>
		</aside>
	);
}
