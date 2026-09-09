/**
 * 复制 + 对勾反馈（用户气泡 / 错误卡 / 助手操作条 / 代码块卡片共用同一节奏）。
 *
 * 从 chat-view.tsx 上移：多处需要同一反馈节奏，AGENTS.md §4 防重复。
 * 对勾还原定时器走 ref：连续点击时清掉上一个重计，不需要为重渲染进 state。
 */

import { useEffect, useRef, useState } from "react";

/** 复制成功后对勾停留时长（对标 WorkBuddy 的反馈节奏）。 */
const COPY_TICK_MS = 2_000;

export function useCopyWithTick(): {
	readonly copied: boolean;
	readonly copy: (text: string) => Promise<void>;
} {
	const [copied, setCopied] = useState(false);
	const timerRef = useRef<number | undefined>(undefined);
	useEffect(() => () => window.clearTimeout(timerRef.current), []);

	const copy = async (text: string): Promise<void> => {
		await navigator.clipboard.writeText(text);
		setCopied(true);
		window.clearTimeout(timerRef.current);
		timerRef.current = window.setTimeout(() => setCopied(false), COPY_TICK_MS);
	};
	return { copied, copy };
}
