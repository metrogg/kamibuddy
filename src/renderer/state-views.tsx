/**
 * 共享状态组件：空 / 加载 / 骨架 / 错误 / 转圈（DESIGN.md §4 状态矩阵）。
 *
 * 为什么抽：此前空态有 13 种类名（`settings-*` / `skills-*` / `ex-*` / `ws-*` 那一批，
 * 按前缀各写一份）、转圈有 5 套各自一份 CSS 与局部 reduced-motion patch、
 * 加载文案 10+ 种变体 —— 同一语义写出多份实现，改一处要改十几处，观感还各不相同。
 * DESIGN.md §6 明确禁止「新造 spinner / 空态 / 错误态类名」，这里就是那个唯一出口。
 *
 * 使用范围（spec §B 分级表）：只套给**数据驱动视图**与**异步控件**；
 * 无异步的交互控件、纯展示组件不套 —— 那是过度设计。
 * 三方内容（iframe / 画布）只对我们的外层容器负责，内层不套。
 *
 * 加载与空必须分开：数据 `undefined` = 加载中，`[]` = 真的为空（DESIGN.md §6）。
 */

import type { ReactNode } from "react";

/**
 * 转圈。只有一个类 `.spinner`，各处的尺寸差异由调用点传值表达
 * （徽章 9 / 列表行 11 / toast 12 / 清单 14）。
 *
 * 尺寸走内联 style 而不是档位：直径不在 DESIGN.md §2 的任何档位表里
 * （圆角 4 档 / 字号 5 档都不含它），它是各容器既有的排版尺寸，
 * 硬塞进档位只会破坏徽章与清单行的对齐。
 */
export function Spinner({ size = 12 }: { readonly size?: number }): React.JSX.Element {
	// aria-hidden：转圈是「进行中」的装饰，语义由相邻文字承担（DESIGN.md §7.6）。
	return <span className="spinner" style={{ width: size, height: size }} aria-hidden="true" />;
}

/**
 * 骨架条。给**结构可预知**的等待占位（文档预览的"白纸"、侧栏任务列表）——
 * 转圈只说「在忙」，骨架还告诉用户「东西马上出现在这里、多大一块」。
 *
 * 为什么没有扫光/脉冲动画：全站唯一的扫光 `.text-shimmer` 语义是「内容正在被生成」
 * （流式打字）。骨架也扫光，两种完全不同的等待（等数据到达 vs 等模型输出）就长得一样了。
 * 不带动画另外换来两件事：`prefers-reduced-motion` 下零损失（不需要为此再写兜底），
 * 以及列表里 10 条骨架不会变成 10 个常驻动画。
 *
 * 底色不用 `--bg-raised`：它在侧栏底（`--bg-sidebar` #f2f2f2）上几乎不可见（两者只差
 * 5 个灰阶），骨架等于没画。取 `--text` 的 8% 半透明叠加 —— 在 `--bg`(#fff) /
 * `--bg-raised`(#f7f7f7) / `--bg-sidebar`(#f2f2f2) 三种底上都读作「占位灰」；
 * 与 `--bg-hover`（5% 黑）同族、只重一档（它是静态底色，没有 hover 语义要区分）。
 *
 * 尺寸由调用点给：骨架必须与真实内容同尺寸，否则内容到达时会跳动；而尺寸是各容器
 * 既有的排版量（不在 DESIGN.md §2 的任何档位表里），硬塞进档位只会破坏对齐
 * —— 与上面 Spinner 的取向一致。
 */
export function Skeleton({
	width = "100%",
	height = 12,
	radius = "var(--radius-sm)",
}: {
	readonly width?: number | string;
	readonly height?: number | string;
	readonly radius?: number | string;
}): React.JSX.Element {
	// span + display:block 而不是 div：骨架要能塞进行内元素里（如 `.task-item-title` 这个 span）。
	// aria-hidden：骨架是「还没到」的装饰，语义由外层容器的 role="status" / 相邻文字承担。
	return (
		<span
			aria-hidden="true"
			style={{
				display: "block",
				width,
				height,
				borderRadius: radius,
				background: "color-mix(in srgb, var(--text) 8%, transparent)",
			}}
		/>
	);
}

/** 空态。`action` 是可选的「引导下一步」槽位（无出口的空态等于死路）。 */
export function EmptyState({
	icon,
	title,
	description,
	action,
}: {
	readonly icon?: ReactNode;
	readonly title: string;
	readonly description?: string;
	readonly action?: ReactNode;
}): React.JSX.Element {
	return (
		<div className="state-empty">
			{icon !== undefined && <span className="state-empty-icon">{icon}</span>}
			<p className="state-empty-title">{title}</p>
			{description !== undefined && <p className="state-empty-desc">{description}</p>}
			{action !== undefined && <div className="state-empty-action">{action}</div>}
		</div>
	);
}

/** 加载态。文案默认「正在读取…」，各处可在保留自己措辞的前提下传 text 覆盖。 */
export function LoadingState({ text = "正在读取…" }: { readonly text?: string }): React.JSX.Element {
	return (
		<div className="state-loading">
			<Spinner />
			<span>{text}</span>
		</div>
	);
}

/** 错误态：就地呈现，带重试出口（toast 只承载「无需重试」的瞬态反馈，DESIGN.md §6）。 */
export function ErrorState({
	message,
	onRetry,
}: {
	readonly message: string;
	readonly onRetry?: () => void;
}): React.JSX.Element {
	return (
		<div className="state-error">
			<span className="state-error-text">{message}</span>
			{onRetry !== undefined && (
				<button type="button" className="mini-btn" onClick={onRetry}>
					重试
				</button>
			)}
		</div>
	);
}
