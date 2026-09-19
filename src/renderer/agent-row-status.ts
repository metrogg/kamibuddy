/**
 * 代理行的状态词表：状态符 / 短词 / 长句。
 *
 * 这三张表是「一行里怎么描述状态」的唯一定义：团队状态栏的成员行与消息流里的子代理行
 * 都必须从这儿取，任何一处再抄一份都会让同一个状态在两处长得不一样。
 *
 * **为什么单独一个文件而不是放在 `agent-row.tsx` 里**：`@vitejs/plugin-react` 要求
 * 一个 `.tsx` 只导出 React 组件，混着导出常量/函数会让该文件的热更失效、退化成整页
 * 重载（dev 控制台报 `Could not Fast Refresh ("x" export is incompatible)`）。
 * 组件留在 `.tsx`，纯数据与纯函数挪到 `.ts`。
 */

import type { SubagentStatus } from "@shared/session-events.ts";

/**
 * 状态符（列行表用）。
 *
 * 注意：投影有 queued/running/done/failed/**interrupted** 五态。
 * interrupted 是团队投影独有的（spec: add-team-interrupt-diagnostics 批次 ①）——
 * 进程被杀时该成员正在跑一轮，重启后从落盘恢复成这一态。它既不是 done（活没交
 * 回来）也不是 failed（成员自己没出错），用 `!` 与「已中断」把区别写在脸上。
 */
export const STATUS_MARK: Record<SubagentStatus["status"], string> = {
	queued: "…",
	running: "●",
	done: "✓",
	failed: "✗",
	interrupted: "!",
};

/** 状态长句（title / 读屏用；含「产出还在…可去取回」这类行动指引，不适合进一行）。 */
export const STATUS_TEXT: Record<SubagentStatus["status"], string> = {
	queued: "启动中",
	running: "运行中",
	done: "已完成",
	failed: "失败",
	interrupted: "已中断（那一轮没有回音）",
};

/** 行内短状态词（列行表用；长句留给 STATUS_TEXT 给 title / 读屏）。 */
export const STATUS_SHORT: Record<SubagentStatus["status"], string> = {
	queued: "启动中",
	running: "运行中",
	done: "已完成",
	failed: "失败",
	interrupted: "已中断",
};
