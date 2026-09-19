/**
 * 团队产出送达钩子：把「待送达的成员产出」挂到**任意**工具结果的末尾。
 *
 * 为什么挂在 `tool_result` 而不是 `context`（本文件存在的唯一理由）：
 * 本条送达路径的历史是「领导的 `team_*` 工具结果」——真机里领导的循环是
 * `team_status → powershell(Start-Sleep) → team_read`，于是成员做完后主理人通常
 * 要等自己的 sleep 跑完、且**只有再调一次 team 工具**才拿到产出；sleep 完去调
 * `read`/`write` 就继续等（spec: unify-team-output-delivery 的 Why）。
 *
 * 「改用 pi 的 `context` 事件做每请求尾部注入」（对齐 WorkBuddy 的
 * `sliceInvocationWindow` 形态）这条路本 change 原本要走，核对代码时发现
 * **我们已经试过并实测失败**：`context` 的返回值**不落会话文件** ⇒ 它每轮都是
 * 一条新的尾部消息、位置每轮后移 ⇒ 前缀缓存每轮在那里断掉、每轮重付。
 * 证据：`src/extensions/prompt-switch.ts` 头注释 (b) 段与
 * `src/shared/hidden-context.ts` 文件头——2026-09-18 实测 24 次调用注入 24 次、
 * **白付 58,094 token，占会话未命中 28.8%**。这不是参数没调好，是机制本身与
 * 「append-only 落盘 + 位置固定」这条纪律相冲：WorkBuddy 能这么做，是因为它的
 * 子窗口插在**调用发生的历史位置**（父会话里那个位置是固定的），而 pi 的
 * `context` 返回值没有这个位置。
 *
 * 工具结果恰好满足那两个条件：它是 **append-only 的会话条目、位置固定**，块一旦
 * 注入就此后逐字节不变（写进会话后不再改写旧结果）；同时工具调用是领导循环里
 * 最高频的事件（~40 次/run 量级），sleep 一结束的下一个工具结果（哪怕是 `read`）
 * 就会带上产出 ⇒ 提前送达。
 *
 * 为什么不设工具白名单：任意工具都要挂（`read` / `write` / `powershell` /
 * `team_*` 一律）——「只有 `team_*` 挂」正是被本 change 删掉的旧口径
 * （spec 的 REMOVED Requirement），留白名单就等于把旧口径换个地方复活。
 *
 * 去重/记账**不在这里**：哪些产出还没送达 / 该不该记进账本，判据全在注入函数
 * 那一侧（`composePending` 是唯一判据来源，见 spec 的「已送达判据」Requirement）。
 * 本层只做一件机械的事：有块就追加一个 text block，没块就一个字节都不改。
 *
 * 失败语义：**pi 会吞掉 `tool_result` handler 的异常**（`runner.ts` 的 emitToolResult
 * 对每个 handler 单独 try/catch，记扩展错误日志后继续，该次不追加）——所以本层抛错
 * 不会响亮失败、只会静默少一次送达。因此判据侧（`composePending`）**不许把读侧失败
 * 变成抛错**（按读侧降级口径：读不到当没有）。本层不 try/catch，是为了不掩盖这类
 * 上游错误（AGENTS.md §7）——降级责任在注入方，不在这里补。
 *
 * ── 模型体验契约（scripts/check-model-experience.ts 机械校验；改行为必须同步改这里）──
 * What the model sees: 领导会话里**任意**工具结果（含 `read`/`write`/`powershell`/
 * `team_*`）的 `content` 末尾，在有「待送达成员产出」时多一个 text block（产出正文，
 * 含内容指纹 `[fp …]`）；没有待送达产出时结果逐字节不变（返回 undefined，pi 侧
 * 连 content 重建都省了）。已注入的块此后不再变化（append-only）。
 * Token effect: 每个「尚有待送达产出」的工具结果付一次产出块（内容与成员会话里的
 * 产出一致）；产出送达后不再重复付（判据在注入函数/账本）。没有新增产出时不付。
 * KV Cache effect: 只改**追加在历史之后**的工具结果块，系统提示词与既有前缀不动；
 * 块所在条目是 append-only 的会话条目、位置固定，此后逐字节不变 ⇒ 不产生新的
 * 缓存失配（与 `context` 每请求现算尾部注入的形态相反，见上文实测证据）。
 */

import type { ExtensionAPI, ToolResultEvent } from "@earendil-works/pi-coding-agent";

/**
 * 回给 pi 的结果补丁。**只写 content** —— pi 的 patch 语义是「省略的字段保持原值」，
 * 所以 `details` / `isError` / `usage` 原样不动（本层不改这些，返回对象里也不出现
 * 这些键）。
 *
 * 不 import pi 的 `ToolResultEventResult`：它没从包根导出（0.85.1 实测，同
 * spill-hook.ts），这里按事件形状自取，结构相同即赋得进去。
 */
type TeamOutputPatch = { readonly content: ToolResultEvent["content"] };

export interface TeamOutputHookOptions {
	/**
	 * 取本次要追加的产出块。**唯一判据来源**（该不该送、送哪几份、是否已记进账本
	 * 都由它决定，本层不做去重/记账）。
	 *
	 * 返回 `undefined` / 空串 / 纯空白 = 没有待送达产出（此时一个字节都不许改）。
	 */
	readonly composePending: () => string | undefined;
}

export function createTeamOutputHook(options: TeamOutputHookOptions) {
	return (pi: ExtensionAPI): void => {
		pi.on("tool_result", (event): TeamOutputPatch | undefined => {
			const block = options.composePending();
			// pi 的 undefined = 保持原结果不变（连 content 都不重建），所以「没有待
			// 送达产出」必须走这条返回，而不是返回一个与原 content 等价的数组。
			if (block === undefined || block.trim() === "") return undefined;
			// 新数组 + 展开原条目：原块**逐条原样**（引用同一对象，内容不被读写），
			// 末尾追加一个 text block。**不许 push 到 `event.content`** —— 那是就地
			// 改写宿主的事件对象（原数组被改长），且会让「勾子里改过的事件」泄漏回
			// pi 的其它 handler。
			return { content: [...event.content, { type: "text", text: block }] };
		});
	};
}
