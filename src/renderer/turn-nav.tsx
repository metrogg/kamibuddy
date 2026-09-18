import { memo, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { TurnView } from "./turn-fold.ts";
import {
	FADE_PX,
	RAIL_AT_REST,
	activeIndex,
	buildTurnNavItems,
	indexAtPointer,
	markTop,
	naturalRailHeight,
	railScrollState,
	readingTop,
	sameRailScrollState,
} from "./turn-nav.ts";
import type { RailScrollState } from "./turn-nav.ts";

/**
 * 消息刻度轨（dsh TurnNavigator 的移植，MIT；与 dsh 的差异清单见 turn-nav.ts 头注）。
 *
 * 形态：会话右缘一条**固定间距**的刻度梯，每轮一格。与「按内容比例定位的
 * minimap」（本组件的前身 turn-rail）的根本区别是：比例定位下，一轮内容越长
 * 刻度拉得越开、短轮挤成一团，扫读时看不出「哪几轮长、哪几轮短」；固定间距让
 * 每一轮占**同等视觉权重**，梯子高过可用高度时轨道内部自己滚动 + 两端渐隐，
 * 而不是把整条梯子压扁到看不出间距。
 *
 * 交互（dsh 同款）：
 *   - 悬停 / 键盘聚焦某一格 → 卡片预览该轮的提问与回答末段；
 *   - 点击 → 平滑滚动到该轮顶端；
 *   - 当前轮跟随阅读位置自动高亮，并**自己滚进轨道的可视区** —— 否则长会话里
 *     高亮会停在轨道视口之外，用户看到的是「梯子不动」。
 *
 * 定位基准：挂在 .stream-wrap 里（chat-view 的挂载点如此），absolute 相对视口
 * 钉住。不能放 .stream 内 —— 那里 absolute 子元素会随滚动内容一起滚走
 *（与「回到底部」按钮同一理由，见 chat-view stream-wrap 注释）。
 *
 * 只标轮（user 消息开启的段），不标逐条消息：需求是「回找自己说过的话」，
 * assistant/工具条目按条列出来只会让梯子爆掉（spec「明确不做」）。少于 2 轮时
 * 没有导航需求，整块不渲染。
 */
function TurnNavRail({
	views,
	scrollRef,
}: {
	readonly views: readonly TurnView[];
	readonly scrollRef: React.RefObject<HTMLDivElement | null>;
}): React.JSX.Element | null {
	const items = buildTurnNavItems(views);
	const [tops, setTops] = useState<readonly number[]>([]);
	const [active, setActive] = useState(0);
	const [previewIndex, setPreviewIndex] = useState(-1);
	const [scrollState, setScrollState] = useState<RailScrollState>(RAIL_AT_REST);
	const scrollerRef = useRef<HTMLDivElement | null>(null);
	/** 指针压在轨道上时，自动居中不许把轨道从手底下挪走。 */
	const pointerInsideRef = useRef(false);
	const previewId = useId();

	/*
		测量：每轮容器（.turn-group[data-turn-key]）顶端在**滚动内容坐标**里的位置。
		用 getBoundingClientRect 差值 + scrollTop，不用 offsetTop —— offsetTop 相对
		offsetParent，而 .entry 自带 position:relative，中间任何一层再引入定位都会让
		offsetTop 静默换基准；rect 差值与定位上下文完全无关，是可靠口径。

		降频到 rAF 尾沿：每个流式 delta 都会让轮视图换引用，同步测量等于每个 delta
		强制一次布局。测量本身必须跟着每次变化走（不能只在轮数变化时测）：轮顶端会
		随上方轮次增高而整体下移，只按轮数缓存会让高亮基准线整体漂移。
	*/
	useLayoutEffect(() => {
		const node = scrollRef.current;
		if (node === null) return;
		const measure = (): void => {
			const containerTop = node.getBoundingClientRect().top;
			// 走 buildTurnNavItems 而不是 views：两侧必须是**同一张被过滤过的清单**，
			// 否则 tops 的下标与刻度项的下标差一格（前缀轮）。
			const next: number[] = [];
			for (const item of buildTurnNavItems(views)) {
				const el = node.querySelector(`[data-turn-key="${CSS.escape(item.key)}"]`);
				if (el === null) continue;
				next.push(el.getBoundingClientRect().top - containerTop + node.scrollTop);
			}
			setTops((prev) => (sameTops(prev, next) ? prev : next));
			setActive(activeIndex(next, readingTop(node.scrollTop, node.clientHeight)));
		};
		const rafId = requestAnimationFrame(measure);
		return () => cancelAnimationFrame(rafId);
	}, [views, scrollRef]);

	/*
		高亮跟随：自挂 scroll 监听（rAF 节流），与 chat-view 的 handleStreamScroll
		互不干扰 —— 那边管「回到底部」跟随，这边只管刻度激活态，两个监听读同一份
		地面真值（scrollTop）各算各的。tops 变化时 effect 重跑并立即重算一次。
	*/
	useEffect(() => {
		const node = scrollRef.current;
		if (node === null) return;
		let rafId = 0;
		const update = (): void => {
			rafId = 0;
			setActive(activeIndex(tops, readingTop(node.scrollTop, node.clientHeight)));
		};
		const onScroll = (): void => {
			if (rafId === 0) rafId = requestAnimationFrame(update);
		};
		update();
		node.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			node.removeEventListener("scroll", onScroll);
			if (rafId !== 0) cancelAnimationFrame(rafId);
		};
	}, [tops, scrollRef]);

	/** 轨道自身滚动状态（决定两端渐隐）。 */
	const syncScrollState = (): void => {
		const scroller = scrollerRef.current;
		if (scroller === null) return;
		const next = railScrollState(scroller.scrollTop, scroller.scrollHeight, scroller.clientHeight);
		setScrollState((current) => (sameRailScrollState(current, next) ? current : next));
	};

	// 容器尺寸变化（窗口缩放、右侧面板开合）移动溢出边界但不发 scroll 事件；
	// 刻度条数变化同样改内容高度 —— 两者都要重算。
	useEffect(() => {
		const scroller = scrollerRef.current;
		if (scroller === null || typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(syncScrollState);
		observer.observe(scroller);
		return () => observer.disconnect();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(syncScrollState, [items.length]);

	/*
		当前刻度自己滚进可视区。留 FADE_PX 的死区：贴着边界时每动一格就触发滚动
		会让轨道在边界附近来回抖。
	*/
	useEffect(() => {
		const scroller = scrollerRef.current;
		if (scroller === null || active < 0 || pointerInsideRef.current) return;
		const viewHeight = scroller.clientHeight;
		if (viewHeight <= 0) return;
		const mark = markTop(active);
		const viewTop = scroller.scrollTop;
		if (mark >= viewTop + FADE_PX && mark <= viewTop + viewHeight - FADE_PX) return;
		const target = Math.max(0, mark - viewHeight / 2);
		const reduced =
			typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (typeof scroller.scrollTo === "function") {
			scroller.scrollTo({ top: target, behavior: reduced ? "auto" : "smooth" });
		} else {
			scroller.scrollTop = target;
		}
		syncScrollState();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [active, items.length]);

	if (items.length < 2) return null;

	const pointerIndex = (clientY: number, rectTop: number): number => {
		const scroller = scrollerRef.current;
		return indexAtPointer(clientY, rectTop, scroller?.scrollTop ?? 0, items.length);
	};

	const preview = previewIndex >= 0 ? items[previewIndex] : undefined;
	const fadeClasses = ["turn-nav-scroller"];
	if (scrollState.canScrollUp) fadeClasses.push("fade-top");
	if (scrollState.canScrollDown) fadeClasses.push("fade-bottom");

	return (
		<div
			className="turn-nav"
			style={
				{
					"--turn-nav-natural": `${naturalRailHeight(items.length)}px`,
					"--turn-nav-scroll-top": `${scrollState.top}px`,
				} as CSSProperties
			}
			onPointerEnter={() => {
				pointerInsideRef.current = true;
			}}
			onPointerLeave={() => {
				pointerInsideRef.current = false;
				setPreviewIndex(-1);
			}}
			onPointerMove={(event) => {
				setPreviewIndex(pointerIndex(event.clientY, event.currentTarget.getBoundingClientRect().top));
			}}
			onClick={(event) => {
				// 键盘触发（detail === 0）没有指针坐标，此时用当前预览项 —— 焦点落到
				// 哪一格就是哪一格，语义与鼠标一致。
				const index =
					event.detail === 0
						? previewIndex
						: pointerIndex(event.clientY, event.currentTarget.getBoundingClientRect().top);
				const item = index >= 0 ? items[index] : undefined;
				if (item !== undefined) {
					const el = scrollRef.current?.querySelector(`[data-turn-key="${CSS.escape(item.key)}"]`);
					el?.scrollIntoView({ behavior: "smooth", block: "start" });
				}
			}}
		>
			<div ref={scrollerRef} className={fadeClasses.join(" ")} onScroll={syncScrollState}>
				<div className="turn-nav-marks">
					{items.map((item, index) => (
						<div
							key={item.key}
							className="turn-nav-mark-pos"
							// 刻度 y 只有 markTop 一个来源（含首端留白），CSS 不再二次加留白 ——
							// 两边各加一次的话刻度会整体偏下 6px。
							style={{ "--turn-nav-position": `${markTop(index)}px` } as CSSProperties}
						>
							<button
								type="button"
								className={`turn-nav-mark${index === active ? " active" : ""}${
									index === previewIndex ? " preview" : ""
								}`}
								aria-label={`跳到第 ${item.ordinal} 轮对话`}
								aria-current={index === active ? "true" : undefined}
								aria-describedby={index === previewIndex ? previewId : undefined}
								onFocus={() => setPreviewIndex(index)}
								onBlur={() => setPreviewIndex(-1)}
							/>
						</div>
					))}
				</div>
			</div>
			{/*
				预览卡挂在**轨道**层（scroller 之外）：它要相对轨道定位，而不是跟着
				刻度梯一起滚走。位置由 CSS 用 position - scrollTop 再钳到轨道内。
			*/}
			{preview !== undefined && (
				<div
					id={previewId}
					role="tooltip"
					className="turn-nav-preview"
					style={{ "--turn-nav-preview-at": `${markTop(previewIndex)}px` } as CSSProperties}
				>
					<div className="turn-nav-preview-prompt">
						{preview.prompt === "" ? `第 ${preview.ordinal} 轮` : preview.prompt}
					</div>
					{preview.response !== "" && (
						<div className="turn-nav-preview-response">{preview.response}</div>
					)}
				</div>
			)}
		</div>
	);
}

/** 测量结果浅比较：长度与逐项值都相同则保留旧数组引用，避免无谓重渲染。 */
function sameTops(prev: readonly number[], next: readonly number[]): boolean {
	return prev.length === next.length && prev.every((value, index) => value === next[index]);
}

/**
 * memo：本组件在流式期间每个 delta 都会被父层重渲染，而刻度梯只在「轮数变化 /
 * 当前轮切换 / 预览项变化」时才有可见变化。父层必须以**稳定引用**传 views，
 * 否则这层 memo 打不中。
 */
export const TurnNav = memo(TurnNavRail);
