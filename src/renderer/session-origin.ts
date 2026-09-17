/**
 * 侧栏分支会话的「来源」解析（纯展示逻辑）。
 *
 * 为什么单独成模块：来源解析是渲染前的数据推导，埋在 JSX 里就只能靠人眼验收；
 * 抽成纯函数可直接跑 vitest（同 session-groups / send-anchor 的惯例），
 * 「母会话已被删除时仍显示标记、且不出现 undefined 字面量」才有可断言的口径。
 *
 * 匹配口径：SessionSummary.parentSession 是母会话**文件绝对路径**（daemon 取自
 * 会话文件 header），与 SessionSummary.path 同源同形，故按字符串全等匹配，
 * 不做大小写 / 分隔符归一 —— 同上位模块 session-groups.ts 头注释的理由
 * （归一化反而会与 daemon 依赖的精确路径键错位）。
 *
 * 「不在当前列表」有三种成因，对界面是同一件事：母会话被删除、被归档
 * （归档会话不进侧栏）、或还没出现在本次推送里 —— 都没有可展示的来源标题，
 * 此时只保留分支标记（spec：不提供跳转、不报错）。
 */

import type { SessionSummary } from "@shared/ipc.ts";

/** 分支行的来源：只有 title 参与渲染；缺省即「母会话不在当前列表」。 */
export interface SessionOrigin {
	/**
	 * 母会话标题（已 trim）。母会话不在当前列表、或标题为空白时是 undefined
	 * —— 返回 undefined 而不是空串，调用点不必再判一次「空 = 没有」。
	 */
	readonly title: string | undefined;
}

/**
 * 解析某条会话的来源。
 *
 * 非分支会话返回 undefined（调用点据此决定画不画标记）；
 * 分支会话一律返回对象，哪怕标题解析不到（标记仍要显示）。
 */
export function resolveSessionOrigin(
	summaries: readonly SessionSummary[],
	session: Pick<SessionSummary, "parentSession">,
): SessionOrigin | undefined {
	const parentPath = session.parentSession;
	if (parentPath === undefined) return undefined;
	// 用户把母会话改名成空白时，宁可说「来源已不在列表」也不给一行空提示。
	const title = summaries.find((candidate) => candidate.path === parentPath)?.title.trim();
	return { title: title === undefined || title === "" ? undefined : title };
}

/**
 * 会话行的原生 hover 提示。
 *
 * 分支行在标题下追加一行来源说明：标记只是 12px 的小图标，来源信息要能在整行
 * 任意位置 hover 读到（spec：「该行有分支标记，hover 显示来源会话标题」）。
 * 非分支行原样返回原标题，不额外加字。
 */
export function sessionRowTitle(
	session: Pick<SessionSummary, "title">,
	origin: SessionOrigin | undefined,
): string {
	if (origin === undefined) return session.title;
	return `${session.title}\n${originHint(origin)}`;
}

/** 来源提示文案。缺失时说明事实（已不在列表），不写 undefined / 空串这类字面量。 */
function originHint(origin: SessionOrigin): string {
	return origin.title === undefined ? "来源会话已不在列表" : `来源会话：${origin.title}`;
}
