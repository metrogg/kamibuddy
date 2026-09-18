/**
 * hidden context（对齐清单 F5）的契约与纯函数层。
 *
 * 程序把一段用户看不见的隐藏说明交给模型——模型每轮都能看到，但不出现在界面上、
 * 不需要用户打字。逆向依据：docs/workbuddy分析/11-hidden-context.md（WorkBuddy 的
 * WorkbuddyUserPromptService + prompt-context-xml 全套机制）。
 *
 * **容器契约就是 data-role 属性本身**（压缩协议挂在它上面）：
 *   - `user-context`      常态化内容（工作目录/场景/专家/记忆指针）——压缩时保留
 *   - `additional-data`   本轮触发的一次性内容（当前时间）——压缩时可整体剥离
 *
 * 剥离本身是尚未动工的「第二批」（对齐清单 F5：压缩时按 data-role 剥离
 * additional-data）；**本仓库现在没有消费这份协议的实现** —— 读它的只有本文件、
 * `core/session-host.ts` 的组装与诊断面板的展示，所以下面这次投递方式的变化
 * 不牵动任何压缩逻辑。
 *
 * 与 WorkBuddy 的另一处有意差异：它把 additional_data 作为子块插在唯一一个
 * user-context 块内的「原顺序位置」（占位法）；我们直接输出**两个独立块** ——
 * 压缩按 data-role 整体剥离时，两个块各自剥离比保序拼接更简单。
 *
 * ## 为什么落盘 + 只在内容真变时追加（本条是有意偏离 WorkBuddy 的阅读顺序）
 *
 * 早先的形态是「每请求现算、追加在消息数组末尾的瞬态注入」：注入经 pi 的
 * transformContext / `context` 事件生效、**返回值不落会话文件**。当时的论证是
 * 「不落盘 ⇒ 不沉积成历史节点 ⇒ 不按序列重复付」。2026-09-18 实测证明那条**是错的**
 * （spec: persist-context-snapshots），根因是投递方式而不是内容：
 *
 *   台账 01a0b2b3-….jsonl（24 次模型调用）里，两块注入在每个 run 内**逐字节完全相同**
 *   （run 1 的 10 次调用指纹全同、run 2 的 14 次全同），却被注入了 24 次。
 *   `cacheRead_N` 恒等于 `prompt_{N-1} − 2,423…2,615`，23 轮合计 **58,094 token**
 *   —— 占全会话未命中（201,908）的 **28.8%**；注入还钉在续写点（上一轮请求的最后
 *   一个 token 位置）上，provider 的前缀缓存只能覆盖到它之前（同题 dsh 拿到 19,915
 *   token 续写命中，我们全程 0）。
 *
 * 不落盘的尾巴每轮都是一条**新的**尾部消息、位置每轮后移 ⇒ 每轮都是一次 miss。
 * 修法对齐 dsh 的 `RuntimeContextProjection.project()`（其 README：cache-safe
 * counterpart）：把注入**落进会话文件**（pi 的 before_agent_start 返回的持久
 * `message`，落位在本轮用户消息之后），并且**只在内容逐字节变化时才追加一条** ——
 * 位置固定 ⇒ 它成为缓存前缀的一部分；内容没变 ⇒ 一个字节都不重付。判据就是本文件的
 * `shouldAppendSnapshot`（纯函数，零运行时依赖）。
 *
 * 阅读顺序的代价（承认，不掩盖）：WorkBuddy 把隐藏块前置在用户消息**正文之前**
 * （模型先读环境说明再读用户正文），我们的注入落在用户消息**之后**（由 pi 保证）。
 * 与上一轮 spec 的一致偏离，换来的是不再每轮重付上一轮整段。
 *
 * 依赖方向：本文件零运行时依赖（消息按结构匹配，不 import pi 类型、也不 import
 * 同层其它模块），core 与 shared 的测试都能直接跑。
 *
 * ── 模型体验契约（scripts/check-model-experience.ts 机械校验；改行为必须同步改这里）──
 * What the model sees: 每个 run 开始、用户消息之后追加一条
 * `<system-reminder data-role="user-context|additional-data">` 文本（工作目录 / 托管 Python 路径 /
 * 记忆与技能提醒 / 当前时间）作为**落进会话文件的持久消息**；模型每轮都读到它（它是历史的一员，
 * 不是尾巴），界面上不显示（display:false），也不进会话导出。
 * Token effect: 每个 run 最多付**一次**，且与上一条同类型快照逐字节相同时**连一次都不付**
 * （不追加）；沉积进历史后按普通消息参与后续每轮的前缀（命中价），不重复全价。
 * KV Cache effect: 落点固定（本轮用户消息之后、历史的正常一员），内容不变就不追加 ⇒ 前缀不被它
 * 截断。反例（2026-09-18 实测）：早先「每请求现算、不落盘」的尾巴形态下
 * `cacheRead_N = prompt_{N-1} − 2,423…2,615`，23 轮白付 58,094 token（占会话未命中 28.8%）。
 */

export type HiddenContextRole = "user-context" | "additional-data";

/**
 * 隐藏块的标记前缀：判定一段文本里有没有隐藏块（会话导出过滤、测试钉子的共同依据）。
 * 片段本身由 `composeHiddenContext` 产出，这里只钉前缀，避免两处各写一遍。
 */
export const HIDDEN_CONTEXT_MARKER = `<system-reminder data-role="`;

/** 一个隐藏说明段：渲染成 `<tag>\nbody\n</tag>`，body 为空串则整段跳过。 */
export interface HiddenSection {
	readonly tag: string;
	readonly role: HiddenContextRole;
	readonly body: string;
}

/**
 * 把隐藏块包成 system-reminder。格式照抄 WorkBuddy 的 wrapHiddenContextXml：
 * `<system-reminder data-role="user-context">\n…\n</system-reminder>`。
 */
export function wrapHiddenContextXml(xml: string, role: HiddenContextRole = "user-context"): string {
	return `<system-reminder data-role="${role}">\n${xml}\n</system-reminder>`;
}

/**
 * 组装一次注入的完整文本：按 role 分两桶（user-context 在前、additional-data
 * 在后），桶内保持传入顺序；两桶全空返回 undefined（调用方零成本跳过注入）。
 */
export function composeHiddenContext(sections: readonly HiddenSection[]): string | undefined {
	const render = (role: HiddenContextRole): string =>
		sections
			.filter((s) => s.role === role && s.body.trim() !== "")
			.map((s) => `<${s.tag}>\n${s.body.trim()}\n</${s.tag}>`)
			.join("\n");

	const userContext = render("user-context");
	const additionalData = render("additional-data");
	const blocks: string[] = [];
	if (userContext !== "") blocks.push(wrapHiddenContextXml(userContext, "user-context"));
	if (additionalData !== "") blocks.push(wrapHiddenContextXml(additionalData, "additional-data"));
	return blocks.length === 0 ? undefined : blocks.join("\n");
}

/**
 * 运行时刻的稳定文本：`2026-09-16 10:35（周三，GMT+8）`。
 *
 * 手工拼接而不用 toLocaleString：注入内容要可单测、跨机器逐字节一致
 * （locale 数据随机器变）。分钟级精度就够——注入内容按 run 冻结
 * （session-host 的缓存纪律），秒在冻结语义下是假精确。
 */
export function formatRunTime(date: Date): string {
	const pad = (n: number): string => String(n).padStart(2, "0");
	const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] as const;
	const offsetMinutes = -date.getTimezoneOffset();
	const sign = offsetMinutes >= 0 ? "+" : "-";
	const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
	const offsetRest = Math.abs(offsetMinutes) % 60;
	const zone = `GMT${sign}${offsetHours}${offsetRest === 0 ? "" : `:${pad(offsetRest)}`}`;
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}（${weekdays[date.getDay()]}，${zone}）`;
}

/**
 * 该不该追加一条新快照：内容与基线**逐字节**相同时不追加（append-only 去重）。
 *
 * 判据只有一条 —— `previous === undefined`（会话活分支上还没有同类型的快照：
 * 新会话，或被压缩遮蔽了）⇒ 追加；否则逐字节不等才追加。不做归一化、不比字符数、
 * 不看时间戳：provider 的前缀缓存比的就是字节，任何「看起来差不多」的宽松判据都会
 * 让内容其实变了的快照被吞掉 —— 那会让模型这一轮读到旧的环境事实，且**无声**。
 *
 * 为什么必须有这条判据：追加是 append-only 的（既有那条的字节与位置不变），
 * 没有去重的话每次 run 都会多一条快照（hidden context 的 `current_time` 每 run 必变，
 * runtime context 却往往不变）—— 会话文件无界增长，且新追加的每一条都在下一轮
 * 变成一次真实的全价新增。
 *
 * 调用方（extensions/prompt-switch.ts）的基线取自 `sessionManager.buildContextEntries()`
 * 的**活分支**，不许做进程内缓存：resume / 新进程必须靠会话文件本身判定。
 */
export function shouldAppendSnapshot(previous: string | undefined, current: string): boolean {
	return previous === undefined || previous !== current;
}
