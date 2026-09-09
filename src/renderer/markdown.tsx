/**
 * 模型回复的 Markdown 渲染组件。
 *
 * 为什么要它：对话页之前是纯文本 pre-wrap，模型输出的 `**加粗**`、`# 标题`、
 * 表格这些直接裸着显示 —— 三张截图对比的就是这个问题（WorkBuddy 是渲染过的）。
 *
 * 两条安全边界（模型产出的内容是不可信输入，AGENTS.md 主进程注释同理）：
 *   1. **不渲染原始 HTML** —— react-markdown 默认跳过内嵌 HTML（skipHtml 语义），
 *      我们特意不引 rehype-raw，模型即使输出 <script> 也只会显示成文本。
 *   2. **链接经 window.open 交给主进程** —— 主进程的 setWindowOpenHandler 统一
 *      deny + shell.openExternal（防钓鱼页伪装应用界面），不本地导航。
 *
 * GFM（remark-gfm）：表格、删除线、任务列表 —— 办公报告里表格出现率很高。
 */

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useCopyWithTick } from "./copy-tick.ts";
import { IconCheck, IconCopy } from "./icons.tsx";
import { codeLanguage, codeText } from "./markdown-code.ts";

/**
 * 围栏代码块的卡片形态：头部（语言名 + 复制按钮）+ 限高可滚动的代码体。
 *
 * 必须是独立函数组件而不是 components 字面量里的就地箭头 —— 复制反馈用
 * useCopyWithTick hook，写进字面量属性里就违反 hooks 规则。
 * pre 的 children 就是那个 code 元素：className 给语言名，children 给复制文本。
 */
function CodeBlockCard({ children }: { readonly children?: React.ReactNode }): React.JSX.Element {
	const { copied, copy } = useCopyWithTick();

	let language = "text";
	let text = "";
	if (React.isValidElement(children)) {
		const props = children.props as { className?: unknown; children?: unknown };
		language = codeLanguage(typeof props.className === "string" ? props.className : undefined);
		text = codeText(props.children);
	}

	return (
		<div className="code-block">
			<div className="code-block-head">
				<span className="code-block-lang">{language}</span>
				<button
					type="button"
					className="code-block-copy"
					aria-label={copied ? "已复制" : "复制代码"}
					title={copied ? "已复制" : "复制代码"}
					onClick={() => void copy(text)}
				>
					{copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
				</button>
			</div>
			<pre>{children}</pre>
		</div>
	);
}

export function Markdown({
	text,
	resolveImageSrc,
}: {
	readonly text: string;
	/**
	 * 图片 src 重写（预览面板把 markdown 里的相对路径转 preview-server URL）。
	 * 对话里的模型输出没有可信的本地基准目录，不传则图片走默认渲染。
	 */
	readonly resolveImageSrc?: (src: string) => string;
}): React.JSX.Element {
	return (
		<div className="markdown">
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				components={{
					// 只覆盖 pre（围栏块）成行卡片；行内 code 走默认渲染，样式不动。
					pre: CodeBlockCard,
					// 链接一律交给主进程白名单（window.open → openWindowHandler → openExternal）。
					a: ({ href, children }) => (
						<a
							href={href}
							onClick={(e) => {
								e.preventDefault();
								// 主进程会 deny 默认开窗并转系统浏览器，应用内不导航。
								if (href !== undefined) window.open(href);
							}}
						>
							{children}
						</a>
					),
					// resolver 存在才覆盖 img：对话页不传时保持默认渲染，一个组件两种场景。
					...(resolveImageSrc === undefined
						? {}
						: {
								img: ({ src, alt }) => (
									<img src={typeof src === "string" ? resolveImageSrc(src) : src} alt={alt ?? ""} />
								),
							}),
				}}
			>
				{text}
			</ReactMarkdown>
		</div>
	);
}
