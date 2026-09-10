import { useEffect, useLayoutEffect, useState } from "react";
import type { ConversationEntry } from "@shared/session-events.ts";
import { computeTicks, nearestActiveTick } from "./turn-rail.ts";
import type { Tick, TickMeasurement } from "./turn-rail.ts";

/**
 * 消息导航刻度轨（Codex 风）：会话流左缘的竖向 minimap，每条 user 消息
 * 一个刻度，纵向位置 = 该消息顶端在 scrollHeight 中的比例；点击平滑跳转，
 * 视口顶之上最近的刻度高亮（跟随滚动，rAF 节流）。
 *
 * 定位基准：组件挂在 .stream-wrap 里（chat-view 的挂载点如此），absolute
 * 相对视口钉住。不能放 .stream 内 —— 那里 absolute 子元素会随滚动内容
 * 一起滚走（与「回到底部」按钮同一理由，见 chat-view stream-wrap 注释）。
 *
 * 只标 user 消息：需求就是「回找自己说过的话」；assistant/工具条目不标
 * （spec「明确不做」）。用户消息少于 2 条时没有导航需求，不渲染。
 */
export function TurnRail({
	entries,
	scrollRef,
}: {
	readonly entries: readonly ConversationEntry[];
	readonly scrollRef: React.RefObject<HTMLDivElement | null>;
}): React.JSX.Element | null {
	const [ticks, setTicks] = useState<readonly Tick[]>([]);
	const [activeId, setActiveId] = useState<string | undefined>(undefined);

	/*
		测量：getBoundingClientRect 差值 + scrollTop 换算出「滚动内容坐标」，
		不用 offsetTop —— offsetTop 相对 offsetParent，而 .entry 自带
		position:relative，中间任何一层再引入定位都会让 offsetTop 静默换
		基准；rect 差值与定位上下文完全无关，是可靠口径。
		重算时机：entries 变化（流式增高自然覆盖）+ 容器尺寸变化
		（ResizeObserver）。内容不变高但布局重排（窗口缩放）由后者兜住。
	*/
	useLayoutEffect(() => {
		const node = scrollRef.current;
		if (node === null) return;
		const measure = (): void => {
			const containerTop = node.getBoundingClientRect().top;
			const measurements: TickMeasurement[] = [];
			for (const entry of entries) {
				if (entry.role !== "user") continue;
				const el = node.querySelector(`[data-entry-id="${CSS.escape(entry.id)}"]`);
				if (el === null) continue;
				measurements.push({
					id: entry.id,
					top: el.getBoundingClientRect().top - containerTop + node.scrollTop,
				});
			}
			setTicks(computeTicks(measurements, node.scrollHeight));
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(node);
		return () => observer.disconnect();
	}, [entries, scrollRef]);

	/*
		高亮跟随：自挂 scroll 监听（rAF 节流），与 chat-view 的
		handleStreamScroll 互不干扰 —— 那边管「回到底部」跟随，这边只管
		刻度激活态，两个监听读同一地面真值（scrollTop）各算各的。
		ticks 变化时 effect 重跑、立即重算一次，流式推高内容后高亮不漂移。
	*/
	useEffect(() => {
		const node = scrollRef.current;
		if (node === null) return;
		let rafId = 0;
		const update = (): void => {
			rafId = 0;
			setActiveId(nearestActiveTick(ticks, node.scrollTop / node.scrollHeight));
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
	}, [ticks, scrollRef]);

	const userCount = entries.reduce((n, e) => (e.role === "user" ? n + 1 : n), 0);
	if (userCount < 2) return null;

	const jumpTo = (id: string): void => {
		const el = scrollRef.current?.querySelector(`[data-entry-id="${CSS.escape(id)}"]`);
		el?.scrollIntoView({ behavior: "smooth", block: "start" });
	};

	return (
		<div className="turn-rail" role="navigation" aria-label="消息导航">
			{ticks.map((tick, index) => (
				<button
					key={tick.id}
					type="button"
					className={tick.id === activeId ? "turn-rail-tick active" : "turn-rail-tick"}
					style={{ top: `${tick.ratio * 100}%` }}
					aria-label={`跳到第 ${index + 1} 条你的消息`}
					title={`跳到第 ${index + 1} 条你的消息`}
					onClick={() => jumpTo(tick.id)}
				/>
			))}
		</div>
	);
}
