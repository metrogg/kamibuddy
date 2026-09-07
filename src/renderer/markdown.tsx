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

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ text }: { readonly text: string }): React.JSX.Element {
	return (
		<div className="markdown">
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				components={{
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
				}}
			>
				{text}
			</ReactMarkdown>
		</div>
	);
}
