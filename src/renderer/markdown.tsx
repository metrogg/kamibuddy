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

import React, { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useCopyWithTick } from "./copy-tick.ts";
import { FileTypeIcon } from "./file-type-icon.tsx";
import { IconCheck, IconCopy, IconFolder } from "./icons.tsx";
import { codeLanguage, codeText } from "./markdown-code.ts";
import { detectPath, truncatePathDisplay, type PathKind } from "./markdown-path.ts";

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
	let className: string | undefined;
	let rawChildren: React.ReactNode;
	if (React.isValidElement(children)) {
		const props = children.props as { className?: unknown; children?: unknown };
		className = typeof props.className === "string" ? props.className : undefined;
		language = codeLanguage(className);
		text = codeText(props.children);
		rawChildren = props.children as React.ReactNode;
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
			{/* 直接渲染原生 code，不经过 components.code 映射 —— 否则行内路径
			    徽章逻辑也会作用于围栏块内的代码（块内整段不是单个路径）。 */}
			<pre>
				<code className={className}>{rawChildren}</code>
			</pre>
		</div>
	);
}

/**
 * 行内 code 的路径徽章（对标 WorkBuddy MarkdownInlineCode）：
 * 形态判定（detectPath）+ 存在性探测（artifact:stat）两步都过才渲染成徽章，
 * 否则保持普通 code。探测结果按绝对路径模块级缓存 —— 流式期间组件随
 * 每次 delta 重挂载，缓存保证已解析的徽章首帧就是徽章、不闪回普通 code。
 */
const statCache = new Map<string, PathKind | "missing">();

/** 相对路径按会话 cwd 拼绝对（WorkBuddy resolveConversationFilePath 同口径）；cwd 未定时不探测。 */
function toAbsolutePath(purePath: string, cwd: string | undefined): string | undefined {
	if (/^(?:[a-zA-Z]:[\\/]|[\\/])/.test(purePath)) return purePath;
	if (cwd === undefined) return undefined;
	return `${cwd.replace(/[\\/]+$/, "")}/${purePath}`;
}

function InlineCode({
	cwd,
	onPathClick,
	children,
}: {
	readonly cwd: string | undefined;
	readonly onPathClick: ((path: string, kind: PathKind) => void) | undefined;
	readonly children?: React.ReactNode;
}): React.JSX.Element {
	const text = codeText(children);
	const detection = useMemo(
		() => (onPathClick === undefined ? undefined : detectPath(text)),
		[text, onPathClick],
	);
	const abs = detection?.isPath === true ? toAbsolutePath(detection.purePath, cwd) : undefined;

	// 初始值先读缓存：重挂载（流式 delta、视图切换）时首帧即终态。
	const cached = abs === undefined ? undefined : statCache.get(abs);
	const [kind, setKind] = useState<PathKind | undefined>(
		cached === undefined || cached === "missing" ? undefined : cached,
	);

	useEffect(() => {
		if (abs === undefined || statCache.has(abs)) return;
		let disposed = false;
		window.kami
			.statPath(abs)
			.then((stat) => {
				statCache.set(abs, stat.kind);
				if (!disposed && stat.kind !== "missing") setKind(stat.kind);
			})
			.catch(() => {
				// 探测失败（daemon 掉线等）按 missing 记账：保持普通 code，不骚扰用户。
				statCache.set(abs, "missing");
			});
		return () => {
			disposed = true;
		};
	}, [abs]);

	if (detection === undefined || !detection.isPath || abs === undefined || kind === undefined) {
		return <code>{children}</code>;
	}

	// 行号范围（#L10-L20）v1 只用于识别，打开时跳到整文件 —— 面板预览暂无行定位。
	return (
		<code
			className={`clickable-path clickable-path-${kind}`}
			title={`${abs}（点击${kind === "directory" ? "打开文件夹" : "打开文件"}）`}
			onClick={() => onPathClick?.(abs, kind)}
		>
			<span className="clickable-path-icon">
				{kind === "directory" ? (
					<IconFolder size={12} />
				) : (
					<FileTypeIcon name={detection.purePath.split(/[\\/]/).pop() ?? text} size={12} />
				)}
			</span>
			{truncatePathDisplay(text)}
		</code>
	);
}

export function Markdown({
	text,
	resolveImageSrc,
	cwd,
	onPathClick,
}: {
	readonly text: string;
	/**
	 * 图片 src 重写（预览面板把 markdown 里的相对路径转 preview-server URL）。
	 * 对话里的模型输出没有可信的本地基准目录，不传则图片走默认渲染。
	 */
	readonly resolveImageSrc?: (src: string) => string;
	/** 当前会话工作目录：行内 code 里的相对路径按它拼绝对后探测。 */
	readonly cwd?: string;
	/**
	 * 路径徽章点击（打开右侧面板/外部打开，由调用方决定）。
	 * 不传则行内 code 一律普通渲染（预览面板里的 markdown 不挂这套逻辑）。
	 */
	readonly onPathClick?: (path: string, kind: PathKind) => void;
}): React.JSX.Element {
	// code 覆盖做成稳定引用：每次 render 新建箭头会让所有行内 code 重挂载，
	// 流式 delta 期间徽章随之一遍遍闪。
	const renderCode = useMemo(
		() =>
			({ children }: { readonly children?: React.ReactNode }) => (
				<InlineCode cwd={cwd} onPathClick={onPathClick}>
					{children}
				</InlineCode>
			),
		[cwd, onPathClick],
	);

	return (
		<div className="markdown">
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				components={{
					// 只覆盖 pre（围栏块）成行卡片；行内 code 走下面的 code 覆盖。
					pre: CodeBlockCard,
					code: renderCode,
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
