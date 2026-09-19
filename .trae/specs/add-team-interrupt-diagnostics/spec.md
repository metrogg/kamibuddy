# add-team-interrupt-diagnostics Spec

> 起因：2026-09-19 实测 `research-ai-agent-pcb-eda`（gpt-researcher-team 建的队）
> 时出现「Phase 3.1 之后没人接了」。
>
> **2026-09-19 02:05 第二次复现**（`research-ai-eda`），现场比第一次干净得多，
> 并推翻了下面两处旧结论 —— 见「第二次复现：纠错」段，**先读那段**。
>
> **2026-09-19 02:38 第三次复现**（`research-ai-agent-enterprise`），**又是一个全新
> 根因**，且这次 daemon 全程存活、进程没死 —— 见「第三次复现：纠错」段。
> 三次复现的三个根因各不相同，**不要用一个解释套三次**。

> ## ✅ 本 spec 的批次 ③ 已被取代（2026-09-19，spec `add-team-pull-model` 批次 ④）
>
> 三次复现三个根因、逐个修都没修住 ⇒ **根因在问题形状，不在某个环节**：
> 推模式要求「把产出送进领导上下文」这一步成功，而 pi 的 `followUp()` 是
> **入队即 resolve**，链上**根本不存在「投递成功」这个事实**，于是任何留痕 /
> 销账协议都是在给不可观测的事件记账。
>
> **本 spec 批次 ③ 引入的整套推模式协议已全部删除**：`pendingDelivery` /
> `pendingDeliveryTurns`、`markPendingDelivery`、`markDeliveryPending`、
> `confirmDelivery`、`clearPendingDelivery`、`deliveryAwaiting` 清单、
> `queue_changed` 销账钩子、成员 `onComplete` 里的回投与 `onFailed` 的失败通知。
> 产出改为**领导用 `team_read` 从成员会话 JSONL 主动取回**（拉模式，对齐 WorkBuddy ——
> 它的 `followUp`/`steering`/`deliverSessionMessage` 命中数实测为 0，
> 状态一律从子会话文件派生）。
>
> **本 spec 仍然有效、未被取代的部分**：批次 ①（中断态落盘与呈现）、
> 批次 ②（领导侧等待可见性 `waitingSince`）、以及三次复现的**现场记录与通用纪律**
> —— 那些是证据，不是被推翻的方案。
>
> 新的权威方案见 `.trae/specs/add-team-pull-model/spec.md`；
> 架构决策记录见 `docs/ARCHITECTURE.md` §4.19。

## ⚠️ 第三次复现：纠错（2026-09-19 02:38）

第三次复现（团队 `research-ai-agent-enterprise`，领导
`2026-09-18T18-34-51-731Z_01a0b5cc...jsonl`）。用户截图显示：领导正文停在
「Phase 2 规划大纲 — 进行中 | 季要纲正在规划 3 章结构」，而底部 6 名成员 chip
**全是 `✓`**。症状与第一、二次一致（「依旧直接没了」），但**根因完全不同**。

### 纠错三：这次**不是进程崩溃** —— daemon 全程存活

事件日志 `events-2026-09-18.jsonl` 在回投时刻之后**仍在持续写入**
（`18:37:52.898` 还有记录），`logs/` 下当日文件完整、无断点。
`markStatus` / `emitTeamProgress` 都正常落盘。**「进程死在 ② 与 ③ 之间」这个
第二次的结论，套不到这次。**

### 纠错四：真凶是「`await` 了一个语义上不承诺送达的调用」

完整时间线：

| 时刻 | 事实 |
|---|---|
| `18:37:34.849` | 谭溯源回投 Phase 1 摘要（**回投成功**，领导正文可见） |
| `18:37:43.783` | 领导 `team_send` 派 Phase 2 给季要纲（投递成功） |
| `18:37:47.715` | 领导开始流式输出进度通报 —— **会话最后一条**，`stopReason:"stop"` |
| `18:37:52.899` | 季要纲跑完第 2 轮，会话第 10 行是**完整 3 章大纲 JSON**，`onComplete` 触发回投 |
| ↑ | 领导**此刻仍在流式输出** → 走 `session-host.prompt` 的 `isStreaming` 分支 |
| ↑ | `await this.session.followUp(text)` —— **入队即 resolve** |
| ↑ | `await` 立刻返回 → `finally` 里的 `clearPendingDelivery()` **抹掉留痕** |
| 之后 | 那条回投只躺在 pi 的 `_followUpMessages` 队列里，**从未被消费** |
| — | 领导会话再无写入（`[来自会话` 仅早期 6 次就位确认） |

**关键机制：pi 的 `followUp()` 是「入队即 resolve」。** `agent-session.js` 的
`_queueFollowUp(text, images)` 全程同步 —— `this._followUpMessages.push(text)`
+ `_emitQueueUpdate()` + `this.agent.followUp(...)`，**不 await 任何东西**。
它自己的 d.ts 注释原文：

```
Queue a follow-up message to be processed after the agent finishes.
Delivered only when agent has no more tool calls or steering messages.
```

「queued」和「delivered」是**两件事**，中间隔着「等当前这轮跑完」。于是：

1. `await host.prompt(composed, "followUp")` **resolve 只代表入队成功**；
2. `finally` 里 `clearPendingDelivery()` 就此认定「送达了」，抹掉 `pendingDelivery` 标记；
3. 那条消息在队列里待着 —— 如果这一轮正常跑完，pi 会消费它（`_handleAgentEvent`
   里 `message_start` + `role === "user"` 时从 `_followUpMessages` 里 `splice` 掉）；
   但**一旦这轮异常、或队列被 `clearQueue()` 丢弃、或消费时机错过**，
   它就永久滞留；
4. 而界面已显示成员「已完成 N 轮」+ 无待捞标记 —— 产出**既没送达、也没留下痕迹**。

**这是三次复现里最隐蔽的一次**：前两次至少留下了痕迹（第一次无痕因为进程死、
第二次停在 `emitTeamProgress` 后），这次是**主动把痕迹擦掉了**。

### 修复（批次 ③.3）：入队 ≠ 送达，改成两拍销账

- **`session-host.prompt` 返回 `{ queued: boolean }`**：`isStreaming` 分支
  `return { queued: true }`（只是入队）；另两个分支 `return { queued: false }`
  （真起了一轮、直接进上下文，等同送达）。
- **新增 `session-host.getFollowUpQueue()`**：透传 `session.getFollowUpMessages()`，
  让上层能看到「此刻队列里有哪些待消费正文」。这补上了**「入队事件早于登记」的竞态**
  （登记发生时消息可能已入队，需要拿队列现状作为 `seen` 的初值）。
- **`team-runtime` 新增 `deliveryAwaiting` 待确认清单 + 两拍判据**：
  `markDeliveryPending(leaderId, name, text, alreadyQueued)` 登记（`seen` 初值取
  `alreadyQueued`）；`confirmDelivery(leaderId, queued)` 在每次 `queue_changed` 时调：
  - 队列里**还有**这条 → `record.seen = true`，不动它；
  - 队列里**没有了** 且 `seen` 为真 → 销账，`confirmed.push(name)`；
  - 队列里**没有了** 但 `seen` 为假 → **不动**（从没进过队列，可能是被 `clearQueue()`
    丢掉、或队列里是别的消息）—— **这是关键守卫**，单测里专门有一条覆盖它。
- **销账信号用 `queue_changed` 而非 `run_started`**：pi 在消费 followUp 的**同刻**
  splice 掉并 emit `queue_update`（`session-host.ts` 折成 `queue_changed`）。
  「待确认的正文不在队列里了」= 已送达，**与消费同刻**，比等下一轮开始更早更准。
- **`deliverSessionMessage` 返回值透传 `{queued}`**（两个分支都要），
  `onComplete` 按 `result.queued` 分流：`true` → 登记待确认；`false` → 直接清标记。

### 由此得到的通用纪律

1. **`await` 一个「入队即返回」的函数，拿不到送达事实。** 凡是要确认「对方真收到了」
   的地方，都必须找一个**与消费同刻**的观测信号，不能拿 `await` 的 resolve 当送达回执。
2. **「不在队列里」≠「已送达」。** 也可能是「从没进过队列 / 被清空 / 队列里是别的消息」。
   必须**先见过、再看它消失**（两拍），单拍判据会误销账 —— 这是单测跑出来才发现
   的实现缺陷，不是设计时想到的。
3. **失败路径上不要急着擦痕迹。** `finally { clearPendingDelivery() }` 这种写法在
   「操作本身不承诺结果」时是有害的：它把「可能没送达」粉饰成「已送达」。
   痕迹该由**确凿的成功信号**来擦，不由**流程走完**来擦。

## ⚠️ 第二次复现：纠错（2026-09-19 02:05）

同一 bug 第二次复现（团队 `research-ai-eda`，领导 `01a0b5ae-465f`）。这次证据更完整，
**推翻了两条旧结论**：

### 纠错一：`turns: 0` **不是**「一轮没收尾」的信号 —— 它是个恒定失效的计数器

`daemon/index.ts:2731` 的 `onProgress` 接线把轮数增量**写死成 0**：

```ts
onProgress: (name, text) => {
	teamRegistry.recordProgress(leaderId, name, 0, text);  // ← 第三参恒为 0
```

而 `team-runtime.ts:334` 是 `member.turns += turnsDelta`。**于是注册表的 `turns`
永远是 0**，无论成员跑了几轮。第二次复现的现场直接证死了这一点：

```
18:04:07.444  谭溯源|done|turns=0|toolCalls=56|activity=已完成 14 轮
18:04:07.444  季要纲|done|turns=0|toolCalls= 0|activity=已完成  2 轮
```

`activity` 与 `turns` 同源（都来自 `member-runner.ts` 的局部 `turns`）却对不上 ——
前者是真值，后者恒 0。

**后果**：第一次复现时我把 `turns: 0` 当成「`onComplete` 没跑」的铁证，
**推错了方向**。真正该看的是 `activity`（`已完成 N 轮`）。本 spec 的批次 ① 因此
仍然成立（中断态该有），但它**不能靠 `turns` 来判定**。

### 纠错二：第二次复现**不是** `.then()` 没跑，而是**死在回投前的一瞬**

第二次的完整时间线（领导会话 + 成员会话 + 事件日志三方对账）：

| 时刻 | 事实 |
|---|---|
| `18:03:52.130` | 领导调 `team_send` 派 Phase 2 给季要纲 |
| `18:03:52.134` | `team_send` 返回成功：「已投递给：季要纲」 |
| `18:04:07.446` | 季要纲产出 **4,840 字完整 JSON 大纲**，`stopReason: "stop"` |
| `18:04:07.444/.445` | 两条 `team_member_progress` 落盘，`activity=已完成 2 轮` |
| `18:04:07.445` 之后 | **事件日志彻底停止**，再无任何写入 |
| — | **没有 `daemon_start`**：`logs/` 下没有 `events-2026-09-19.jsonl` |

关键：`onComplete`（`index.ts:2735-2765`）的执行顺序是

```ts
teamRegistry.markStatus(idle)       // ① 跑完了
emitTeamProgress(leaderId)          // ② 跑完了 ← 事件日志停在这一步之后
                                    //     （18:04:07.444/.445 就是它写的）
void deliverSessionMessage(...)     // ③ 从未执行
```

**进程死在 ② 与 ③ 之间。** 上一轮「`.then()` 没跑」的表述是错的 ——
`.then()` 跑了，`onComplete` 也跑了（`activity=已完成 2 轮` 是它写的），
**死的是它内部那个用 `void` 游离出去的 `deliverSessionMessage`**。

### 由此暴露的真实缺陷（本次要修的）

**回投是成员交活的唯一送达通道，却被 `void` 掉了。** `void deliverSessionMessage(...)`
意味着：

1. 没人 await 它 → 它是个游离 Promise，**不参与任何生命周期**；
2. `onComplete` 是个同步回调，返回即代表「这轮结束」→ 宿主可以在回投的异步链
   （`enqueue` → `host.prompt` → 写会话文件）跑完之前就退出；
3. 一旦发生，**回投静默丢失**，界面上成员显示「已完成 2 轮」，领导永远等不到。

对比 `markStatus` 与 `emitTeamProgress` 都是**同步完成**的 —— 所以它们落盘了，
而唯一异步的一步丢了。**「同样的窗口，同步的先落，异步的最后丢」** 是这个 bug 的形态。

## 复盘结论（第一次复现，保留但已部分修正）

**是进程级中断 + 中断后不可见。**（第二次复现修正为：**中断点精确在回投调用前**，
不是「`.then()` 没跑」。）

完整证据链（会话文件 + 事件日志 + 团队注册表三方对账）：

| 环节 | 事实 |
|---|---|
| 领导派活 | `16:54:39` `deliverSessionMessage` 成功，领导会话留有回执 |
| 成员产出 | `16:56:03` 草稿 **18,575 字完整写完**，`stopReason: "stop"` |
| 回投 | **没发生** —— `member-runner.ts:201` 的 `.then()` 没跑 |
| 事件日志 | 最后一条 `ts = 16:56:03.466`，之后 daemon 全静默 |
| 注册表 | `turns: 0` 而 `toolCalls: 77`（`turns` 只在 `assistant_done` +1） |

`host.prompt()` 的 promise 随宿主进程一起消失 → `.then()` 永不执行 →
`onComplete` 不触发 → `deliverSessionMessage` 不发 → 领导永久静默等待。

**两个真实缺陷，都不是「回投坏了」：**

1. **中断被伪装成正常。** 重启后 `restoreTeam` 把成员一律恢复成 `closed`
   + 「进程重启后成员需重建」。用户分不清「我主动关的」和「进程被杀时
   它正在干活」—— 后者意味着**有一轮的活白跑了，而且产出没回投**。
   这是本次实测最该修的东西：**诊断价值**。
2. **领导侧等待不可见。** 领导派活后在等成员，界面上没有任何「在等谁、
   等了多久」的指示。用户看到的是「没人接了」，实际是「在等，但等不到」。

## 批次

### 批次 ① · 中断态落盘与呈现（诊断优先）

- 1.1 `TeamMemberStatus` 加 `interrupted`（进程被杀时一轮在跑的成员）
- 1.2 `team-store.ts`：StoredTeamMember 加 `status`（已在结构里）+ 新增
  `interruptedAt` 时戳；落盘时记 `running`/`spawning` 为「中断候选」
- 1.3 `restoreTeam`：落盘里 `running`/`spawning`/`closing` → 恢复为 `interrupted`
  （**不是** `closed`），`lastActivity` 写明「上次运行在「X」时中断，该轮产出未回投」
- 1.4 投影映射：`interrupted` → 新增 `SubagentStatus` 态（见 ①.5）
- 1.5 `SubagentStatus.status` 加 `"interrupted"`；`team-status-bar.tsx`
  MARKS/STATUS_TEXT 同步（`!` 符号 + 「已中断」）
- 1.6 `task-agent-card.tsx` 的成员行渲染 `interrupted`（与 failed 同族但措辞不同）
- 1.7 单测：`team-runtime.test.ts` 恢复态 + `team-store.test.ts` 往返回归 +
  `team-status-bar` 的 `teamBarRows` 纯函数断言

### 批次 ② · 领导侧等待可见性

- 2.1 注册表记 `dispatchedAt`（每次 `markStatus` → running 时刷新；
  成员回投/失败/中断时清）
- 2.2 `TeamMember` 暴露 `waitingSince`（毫秒时戳，0 = 不在等）
- 2.3 投影携带 `waitingSince`（`SubagentStatus` 加可选字段，仅 team 填）
- 2.4 `teamBarRows` 生成「等待 Xm」计数（纯函数，可单测）；超阈值（5 分钟）
  换告警色，文案「已等待 Xm（可能已中断）」
- 2.5 单测：纯函数边界（0/1 分钟/5 分钟/59 分钟/超 1 小时）

### 批次 ③ · 回投不许游离（第二次复现的真正修复）

> 批次 ①② 是「让中断可见」；批次 ③ 是「别让回投丢」。**后者才是治本的。**

- 3.1 **回投前先落盘**（治本的核心）：`onComplete` 在调 `deliverSessionMessage`
  之前，**同步**把「有一份产出待回投」写进注册表 + 落盘。这样即使进程在
  下一微秒死掉，重启后 `restoreTeam` 也能看见「成员 X 有一份产出没送达」，
  而不是只看到 `interrupted` 这个模糊态。
- 3.2 **`onComplete` 里的回投不许 `void`**：改成 `await`，让这一轮的收尾
  成为「有归属的异步操作」。`member-runner.ts` 的 `.then()` 回调改成
  `async` 并 `await hooks.onComplete(...)`。
- 3.3 **`onComplete` 签名改成可返回 Promise**：`MemberHooks.onComplete`
  现在返回 `void`，接线层那个 `void deliverSessionMessage(...)` 才有机会
  游离。改成 `() => void | Promise<void>`，接线层返回它。
- 3.4 **修 `turns` 恒定 0**（纠错一的直接修复）：`onProgress` 的
  `recordProgress(leaderId, name, 0, text)` 第三参写死 0 —— 要么让
  `onProgress` 带上真实轮数，要么把 `turns` 改成只在 `onComplete` 时写。
  取后者更简单：`onComplete` 里把 `turns` 一并写进注册表。
- **3.5 单测**：`onComplete` 返回的 Promise 被 await（用一个会延迟的假 hooks
  验证 `onComplete` 未 resolve 前 `.then()` 链不继续）。

### 批次 ③.3 · 入队 ≠ 送达（第三次复现的真正修复）

> 3.1–3.5 治的是「回投被 `void` 掉」；第三次复现证明那不够 ——
> **即使 `await` 了，`followUp()` 也只是入队**。治本点在「拿消费信号当送达回执」。

- 3.20 `session-host.prompt` 返回 `{ queued: boolean }`（`isStreaming` 分支 true）
- 3.21 `session-host.getFollowUpQueue()` 透传 pi 的 `_followUpMessages`
- 3.22 `team-runtime` 加 `deliveryAwaiting` 待确认清单
- 3.23 `markDeliveryPending(…, alreadyQueued)` / `confirmDelivery(…)` 两拍判据
- 3.24 `deliverSessionMessage` 返回值改 `{ queued }` 并两分支透传
- 3.25 `emitSessionEvent` 挂 `queue_changed` → `confirmDelivery` → 有销账才刷投影
- 3.26 `member-runner.prompt` 显式丢弃返回值（防 TS 收窄破坏接口）
- 3.27 单测 7 例：`team-runtime.test.ts` 的「送达确认」describe

**3.1 为什么是治本的**：进程被杀这件事无法阻止，但「被杀之后能知道丢了什么」
可以。当前注册表只知道「它当时在跑」（→ 批次 ① 的 `interrupted`），
**不知道「它已经跑完了、产出就在会话文件里、只是没送达」**。前者要用户重新
建团，后者用户可以直接去会话记录里把产出捞回来 —— 这是完全不同的处置。

## 明确不做

- **不加重试/自动重投**：进程被杀是宿主级事件，成员产出已随会话 JSONL 落盘
  （`sessions/*.jsonl`），用户能自己找回。自动重投会引入「到底跑了几遍」的
  歧义，收益 < 复杂度。
- **不做心跳协议**：成员是 fire-and-forget 长会话，心跳要双向保活通道，
  与现有架构（无跨进程通信）冲突。用 `dispatchedAt` 做单侧计时足够。

## 实施修正（落地时与初稿的差异，别按初稿找代码）

- **1.1 `team-store.ts` 不用动。** `StoredTeamMember.status` 早已在结构里，
  落盘的是当时的内存态（`running`/`spawning`/`closing` 自然就落下来了），
  不需要新增 `interruptedAt` 时戳 —— 中断候选判据直接读落盘的 `status` 字面量。
- **2.1 用 `waitingSince` 计时点，不叫 `dispatchedAt`。** 语义是「领导正在等
  它的起点」，故改名 `waitingSince`（0 = 不在等待中）；且**不落盘**（
  `members` 序列化刻意不含它，否则每次状态刷新都触发 `persistedFingerprint`
  变化、磁盘每次都写）。重启后所有成员 `waitingSince = 0`（本来也不在等）。
- **1.4 投影走 `emitTeamProgress` 的 `statusMap`**（`daemon/index.ts`），
  `interrupted` 直通，不折成 `failed`/`done` —— 折哪个都是误导。
- **2.3 `waitingSince` 用条件展开**（`member.waitingSince > 0` 才带上），
  避免全程携带 `waitingSince: 0` 这种无意义字段。
- **额外做了（初稿没写但顺理成章）**：`team_status` 工具输出行加
  `waitedMinutes`，超 5 分钟显式劝模型「考虑 team_send 问一句或
  team_shutdown 收尾」—— 让模型自己也能察觉「等太久了」，而不是干等。
- **`resolveMemberSessions` 加了 `interrupted` 分支**：对已中断成员喊话时
  明确说「会话已失效，它中断前那轮的产出没回投，可在会话记录里找回；
  要它继续工作请重新建团」，而不是含糊的通用报错。

### 批次 ③ 的实施修正（落地时与初稿的差异）

- **不存产出正文，只存标记 + 轮数**（用户拍板）：正文在成员会话 JSONL 里
  已有一份，存进注册表就是双写（违反 `core/run-ledger.ts` 立的不双写纪律），
  且最长 24k 字符会把团队注册表撑大。诊断要的是「有没有丢、去哪儿找」。
- **3.3 的签名改成 `void | Promise<void>`**：`onComplete`/`onFailed` 都允许返回
  Promise。`member-runner.ts` 的 `.then()` 回调改成 `async` 并 `await`，
  `.catch` 也包了一层 try（回调自身抛错不能再冒泡成游离 rejection）。
- **额外做了**：`emitTeamProgress` 投影加 `pendingDelivery` 两个可选字段；
  `teamBarRows` 的摘要行把「产出待捞」提到**最高优先级**（高于 interrupted）——
  它是四态里唯一「有救」的一条，用户能立刻做对的事；
  chip 加 `.recoverable` 琥珀描边；恢复时 `lastActivity` 优先说「已完成 N 轮，
  产出没送达领导」。

## 验证

- [x] v.1 `npm run typecheck`（裸跑 `tsc --noEmit`，无输出）
- [x] v.2 `check:deps`（396 文件，方向通过）/ `check:tokens`（真违例 0）/
      `check:model-experience`（22/22）/ `check:invariants`（25 模块全登记）/
      `check:expert-assets`（4 团队全对得上）
- [x] v.3 批次①②：`team-runtime.test.ts` 28 / `team-status-bar.test.ts` 19 /
      `task-agent-card.test.ts` 14
- [x] v.3b 批次③：四个文件合计 **86 passed**
      （`team-runtime` + `team-store` + `team-status-bar` + `task-agent-card`）
- [x] v.4 全量 vitest（批次①②时跑的）：**2823 passed / 1 skipped / 1 failed**。
      唯一失败是 `src/core/doc-extract.test.ts`，**与本次改动无关**：单跑该文件
      24/24 通过（2.8s），全量并发下同一用例跑了 35s 才被判超时 —— 是 pdf
      装配用例在高并发下的 CPU 争抢抖动（改动集中在 `src/daemon/`、
      `src/renderer/`、`src/shared/`，未碰 `src/core/`）。
- [x] v.4b 批次③.3 相关 5 文件：**195 passed**（`team-runtime` / `team-store` /
      `team-status-bar` / `task-agent-card` / `session-host`）
- [x] v.4c 批次③.3 门禁：`check:deps`（396 文件）/ `check:tokens`（真违例 0）/
      `check:model-experience`（22/22）/ `check:invariants`（25 模块）全绿
- [ ] v.5 真机：重启后看团队卡是否显示「已中断」/「产出待捞」而非「已完成」
      （待用户实测）
- [ ] v.6 真机：连跑一次专家团，确认**回投不再丢**（批次 ③ 的核心验收）
- [ ] v.7 真机：观察领导**流式输出中**成员回投是否会被正确消费 + 销账
      （批次 ③.3 的核心验收：这正是第三次复现的现场形态）
