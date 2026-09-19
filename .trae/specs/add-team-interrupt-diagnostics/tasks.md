# add-team-interrupt-diagnostics Tasks

> 前置：先读 `spec.md` 的「复盘结论」与「实施修正」两段。
> 本任务全程围绕一个目标：**让「进程被杀导致的中断」在界面上可辨识**，
> 而不是伪装成正常完成或静默等待。

## 批次 ① · 中断态落盘与呈现

| # | 任务 | 落点 | 状态 |
|---|---|---|---|
| 1.1 | `TeamMemberStatus` 加 `interrupted` 第七态 | `src/daemon/team-runtime.ts` | ✅ |
| 1.2 | 中断候选判据 `INTERRUPT_CANDIDATE_STATUSES` + 导出 `isInterruptCandidate` | 同上 | ✅ |
| 1.3 | `restoreTeam` 按落盘 status 分流：候选→`interrupted`，终态→`closed` | 同上 | ✅ |
| 1.4 | `resolveMemberSessions` 加 `interrupted` 分支（说清会话已失效 + 产出可在会话记录找回） | 同上 | ✅ |
| 1.5 | `SubagentStatus.status` 加第五态 `"interrupted"` | `src/shared/session-events.ts` | ✅ |
| 1.6 | `emitTeamProgress` 的 `statusMap` 直通 `interrupted` | `src/daemon/index.ts` | ✅ |
| 1.7 | `MARKS` 加 `!` / `STATUS_TEXT` 加「已中断（产出未回投）」 | `src/renderer/team-status-bar.tsx` | ✅ |
| 1.8 | `teamBarRows` 摘要行优先级：中断 > 工作中 > 平静 | 同上 | ✅ |
| 1.9 | `AgentGlyph` 中断分支 + `deriveAgentRow` 的 `case "interrupted"` | `src/renderer/task-agent-card.tsx` | ✅ |
| 1.10 | CSS 四规则（全用 `--warning` 琥珀，非新造 `--warn`） | `src/renderer/index.css` | ✅ |
| 1.11 | 单测：`team-runtime.test.ts` 中断恢复 6 例 | 测试 | ✅ |

**1.3 的分流表（写死在这儿，改前先对一遍）：**

| 落盘 status | 恢复为 | 理由 |
|---|---|---|
| `spawning` | `interrupted` | 手里有活（还没跑起来，但用户以为它在跑） |
| `running` | `interrupted` | **本次实测的主场景** |
| `closing` | `interrupted` | 收尾途中被杀，产出同样可能没回投 |
| `idle` | `closed` | 已是终态，没有丢产出 |
| `closed` | `closed` | 同上 |
| `failed` | `closed` | 同上（失败本身已经是它自己的终态） |
| 缺失 / 未知 | `closed` | 保守：不确定就不报中断，避免噪声 |

## 批次 ② · 领导侧等待可见性

| # | 任务 | 落点 | 状态 |
|---|---|---|---|
| 2.1 | `TeamMember.waitingSince`（epoch ms，**0 = 不在等待中**） | `src/daemon/team-runtime.ts` | ✅ |
| 2.2 | `markSpawned` 起算 / `markStatus` 刷新与清零 | 同上 | ✅ |
| 2.3 | `createTeam` 初始化 `waitingSince: 0` | 同上 | ✅ |
| 2.4 | `SubagentStatus.waitingSince?` 可选字段 | `src/shared/session-events.ts` | ✅ |
| 2.5 | 投影条件展开（`> 0` 才带） | `src/daemon/index.ts` | ✅ |
| 2.6 | `getTeamState` 算 `waitedMinutes` | 同上 | ✅ |
| 2.7 | `WAITING_ALERT_MS`（5 分钟）+ `formatWaiting` 纯函数 | `src/renderer/team-status-bar.tsx` | ✅ |
| 2.8 | `TeamBarRow` 加 `waiting` / `waitingAlert`；chip 超阈值转琥珀 | 同上 | ✅ |
| 2.9 | `TeamMemberState.waitedMinutes?` + `team_status` 超 5 分钟显式劝告 | `src/extensions/team-tools.ts` | ✅ |
| 2.10 | 单测：等待计时 5 例 + `formatWaiting` 边界 5 例 | 测试 | ✅ |

**2.2 的计时规则（三个分支，别漏）：**

- `status === "running"` → `waitingSince = now`（**刷新起点**：跑了新一轮就是新一轮的等待）
- `status === "closing"` 或 `"spawning"` → **保持原值**（还在等，别清零）
- 其余（`idle` / `closed` / `failed` / `interrupted`）→ `waitingSince = 0`（终态，不在等了）

**2.5 为什么不落盘：** `persistTeam` 用 `persistedFingerprint` 做「没变就不写」，
若把 `waitingSince` 序列化进去，每次状态刷新都会让指纹变 → 磁盘每次状态变动都写一遍。
重启后全员归 0 也是对的（本来就不在等）。

## 批次 ③ · 回投不许游离（第二次复现的真正修复）

> 批次 ①② 是「让中断可见」；批次 ③ 是「别让回投丢」。**后者才是治本的。**
> 起因见 `spec.md` 顶部的「第二次复现：纠错」段。

| # | 任务 | 落点 | 状态 |
|---|---|---|---|
| 3.1 | `TeamMember.pendingDelivery` / `pendingDeliveryTurns` 字段 | `src/daemon/team-runtime.ts` | ✅ |
| 3.2 | `markPendingDelivery` / `clearPendingDelivery` 方法 | 同上 | ✅ |
| 3.3 | `restoreTeam` 识别落盘 `pendingDelivery`，文案优先说「跑完了、产出没送达」 | 同上 | ✅ |
| 3.4 | `resolveMemberSessions` 对「带待回投产出」的成员说清去哪捞 | 同上 | ✅ |
| 3.5 | `recordCompletion`（轮数**赋值**而非累加）+ 修 `turns` 恒定 0 | 同上 | ✅ |
| 3.6 | `MemberHooks.onComplete`/`onFailed` 返回 `void \| Promise<void>` | `src/daemon/member-runner.ts` | ✅ |
| 3.7 | `.then()` 回调改 `async` 并 **await** 回调；`.catch` 加 try 兜住 | 同上 | ✅ |
| 3.8 | 接线层 `onComplete` 改 `async`：**先留痕再投递**，`await` 回投 | `src/daemon/index.ts` | ✅ |
| 3.9 | 回投失败时补发一条失败通知（别让领导继续静默） | 同上 | ✅ |
| 3.10 | `persistTeam` 落盘 `pendingDelivery`（条件展开，不写正文） | 同上 | ✅ |
| 3.11 | `StoredTeamMember` 加两个可选字段 | `src/core/team-store.ts` | ✅ |
| 3.12 | `SubagentStatus` 加 `pendingDelivery?` / `pendingDeliveryTurns?` | `src/shared/session-events.ts` | ✅ |
| 3.13 | `teamBarRows` 透传 + `statusText` 说「去会话记录里可捞回」 | `src/renderer/team-status-bar.tsx` | ✅ |
| 3.14 | 摘要行优先级：**产出待捞 > 中断 > 工作中 > 平静** | 同上 | ✅ |
| 3.15 | `deriveAgentRow` 的 pendingDelivery 分支（优先于 interrupted） | `src/renderer/task-agent-card.tsx` | ✅ |
| 3.16 | CSS `.team-bar-chip.recoverable`（琥珀描边） | `src/renderer/index.css` | ✅ |
| 3.17 | 单测 25 条（四个文件合计 86 passed） | 测试 | ✅ |
| 3.18 | `TeamMemberState` 加 `pendingDelivery?` / `pendingDeliveryTurns?`，`team_status` 行里明说「跑完了、产出没送达你、可去捞回、不必重跑」 | `src/extensions/team-tools.ts` | ✅ |
| 3.19 | `getTeamState` 透传 `pendingDelivery`（并压制 `waitedMinutes`：跑完了就不是在等） | `src/daemon/index.ts` | ✅ |

### 批次 ③.3 · 入队 ≠ 送达（2026-09-19 第三次复现的真凶）

> 前两批修的是「异步被 `void`」；这一批修的是**「`await` 了一个语义上不承诺
> 送达的调用」** —— 更隐蔽，因为代码看起来完全正确。

| # | 任务 | 落点 | 状态 |
|---|---|---|---|
| 3.20 | `session-host.prompt` 返回 `{ queued: boolean }`：告诉调用方这一发是**只入了 followUp 队列**还是已进上下文 | `src/core/session-host.ts` | ✅ |
| 3.21 | 新增 `getFollowUpQueue()`（现读队列，补「入队事件早于登记」的竞态） | 同上 | ✅ |
| 3.22 | `TeamRegistry.deliveryAwaiting` + `markDeliveryPending(leader, member, text, alreadyQueued)` | `src/daemon/team-runtime.ts` | ✅ |
| 3.23 | `confirmDelivery(leader, queued)`：**先见过、再消失**才销账（两拍判据） | 同上 | ✅ |
| 3.24 | `onComplete`：按返回值分流 —— `queued` 则登记待确认，否则才清留痕 | `src/daemon/index.ts` | ✅ |
| 3.25 | `emitSessionEvent` 盯 `queue_changed` 销账（不是 `run_started`，见下） | 同上 | ✅ |
| 3.26 | `memberHandlesBySession.prompt` 丢弃返回值（成员侧无留痕要确认） | `src/daemon/member-runner.ts` | ✅ |
| 3.27 | 单测 7 条（含「队列里是别的消息不许误认领」「从没入队不许误销账」两条反例） | 测试 | ✅ |

**3.23 为什么必须两拍（这是最容易写错的地方）：**

```
第一拍：queue_changed 里**出现**这条正文  → record.seen = true
第二拍：queue_changed 里**没有**这条正文  → 被 pi splice 走了 = 已送达 → 销账
```

只判「现在不在队列里」是**错的**：队列里是**用户自己排的别的消息**时，第一次
`queue_changed` 就看不到我们的正文，会当场误判成「已送达」并错误销账 —— 而
产出其实还躺在队列里没被消费。这个反例已被单测钉住。

**3.25 为什么盯 `queue_changed` 而不是 `run_started`：** pi 的 `followUp` 语义是
「本轮工具调用跑完、下一次 LLM 调用前投递」—— **不出 run 边界**，所以「起了
新一轮」既漏（同 run 内消费）又晚。而 pi 在 `_handleAgentEvent` 的 `message_start`
（role=user）里会把真正进上下文的那条从 `_followUpMessages` splice 掉并 emit
`queue_update` —— 与消费同刻，精确。

**3.18/3.19 为什么必须做（最后一公里）：** 批次 ③ 让**界面**能看见「产出待捞」，
但**领导（模型）看不见** —— 它只能通过 `team_status` 了解团队，而那行输出里
原先没有这个信息。重启后的领导会以为「这成员白干了」，然后**重派一名成员重跑一遍**，
既费钱又可能拿到不一致的结果。视觉与工具两条通道必须同时透传。

**3.19 的互斥规则**：`pendingDelivery` 为真时**不输出**「你已等 N 分钟」。
它已经跑完了，说「还在等」是自相矛盾 —— 会让领导继续干等而不去捞产出。

**3.8 的顺序（写死在这儿，改前先对一遍）：**

```
① markStatus(idle/closed)        —— 同步，落盘
② markPendingDelivery            —— 同步，**先留痕再投递**（治本点 1）
③ emitTeamProgress               —— 同步，界面看到「已完成」
④ await 回投                     —— 异步，**只保证入队**（治本点 2 见 3.3）
⑤ queued ? markDeliveryPending : clearPendingDelivery
   —— 入队则登记待确认；已进上下文才清留痕
…（此后）queue_changed 收窄 → confirmDelivery 销账
```

**2026-09-19 前两次实测都死在 ③ 与 ④ 之间**（事件日志最后一条恰是 ③ 写的
`team_member_progress`）。上一版 ④ 是 `void deliverSessionMessage(...)` ——
游离 Promise 不参与生命周期，进程一死就静默丢消息。**这是第一次/第二次复现的直接成因。**

**第三次复现（同日 18:37:52）换了形态**：④ 已经 `await` 了，但领导当时正在流式，
投递走 `followUp` 旁路 ——**入队即 resolve**，`await` 返回 ≠ 送达。当时代码在
`finally` 里立刻 `clearPendingDelivery()`，把留痕在消息还躺在队列里时抹掉，
随后那条消息没被消费，产出**既没送达、也没留下待捞标记**。修法见 3.20–3.27。

**3.5 为什么是「赋值」而不是「累加」**：`turns` 是「这个成员共跑完几轮」的
绝对值，`onComplete` 带着成员执行器自己数的真值回来。累加（`recordProgress`
的旧语义）会让重复回调把数字顶飞；而接线层原先在 `onProgress` 里传死 `0`，
导致 `turns` 恒为 0 —— 这个恒 0 字段还被误当成「一轮没收尾」的判据，
推错过一次方向（见 spec 的纠错一）。

## 已知未处理（不在本 spec 范围，但记着）

- **`ask` / `plan` 模式的团队工具白名单为 0**：只有 craft 模式拿得到团队工具。
  与本次中断诊断无关，是另一条独立隐患。
- **`doc-extract.test.ts` 全量跑时的超时抖动**：单跑过、全量并发下会超时。
  与本改动无关，需要单独给那条 pdf 装配用例加 timeout 或降并发。
- **`confinement.win.test.ts` 里的「超时杀掉整棵进程树（含孙进程）」全量跑时同样抖动**
  （2026-09-19 实测：全量挂、单跑 7.2s 通过）。该用例要起真实进程树并计时 5 秒，
  156 个文件并发抢沙箱时必被挤超时。**同样与本改动无关**（未动 `src/sandbox/`）。

## 收尾必跑

```
node node_modules/typescript/lib/tsc.js --noEmit
node node_modules/tsx/dist/cli.mjs scripts/check-dependency-rules.ts
node node_modules/tsx/dist/cli.mjs scripts/check-design-tokens.ts
node node_modules/tsx/dist/cli.mjs scripts/check-model-experience.ts
node node_modules/tsx/dist/cli.mjs scripts/check-module-invariants.ts
node node_modules/tsx/dist/cli.mjs scripts/check-expert-assets.ts
node node_modules/vitest/vitest.mjs run
```

（`npm run` 在本机被 wsl.exe 黑名单拦，一律直呼 node 入口。）
