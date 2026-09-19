# 修复上下文用量只在每轮（run）刷新 Spec

## Why

2026-09-19 用户反馈：输入区左组的上下文占用圆环「每一轮才更新一次，不是每一步」。

**根因**（事件日志实证，非推测）：圆环的唯一数据源是
`SessionState.contextUsage → session_state 事件 → daemon 派生 context_usage`
（[daemon/index.ts:1257](file:///d:/DongProject/kamibuddy/src/daemon/index.ts)）；
而 `SessionHost.emitState()` 此前只挂在 `agent_start` / `agent_end` 与各 setter 上，
**助手 `message_end`（每一步模型调用）不推**（[session-host.ts:1270](file:///d:/DongProject/kamibuddy/src/core/session-host.ts)）。

实证（`~/.kamibuddy/logs/events-2026-09-19.jsonl`，按会话分组计数）：

| 会话 | assistant_done（步） | context_usage（圆环刷新） |
|---|---|---|
| 01a0b87c | 40 | 4 |
| 01a0b9b5 | 43 | 2 |
| 01a0b837 | 42 | 4 |
| 01a0b968 | 47 | 8（含 3 次 run 边界与压缩） |

对照：同一批会话里 `session_stats`（底部指标条）与 `assistant_done` 数量同阶 ——
指标条本来就是按步走的，**只有圆环**冻在 `agent_start` 的读数上直到 run 结束。
这与该组件自称的口径矛盾：「它展示的是「现在」：used/total 是最近一次请求后的实时值」
（[context-usage.tsx:56](file:///d:/DonProject/kamibuddy/src/renderer/context-usage.tsx)）。

## What Changes

- `src/core/session-host.ts`：助手 `message_end` 分支在 `settleLlmCall(message)` 之后
  调一次 `this.emitState()` —— 圆环因此按**步**刷新。
- 该位置取到的是**最新可用**读数：pi 的 `getContextUsage()` 读 agent state 里最近一条
  assistant 的 usage（`agent-session.ts:955/3210`），而 agent-core 在 emit `message_end`
  之前已把终态消息放进 state（同文件 `:711` 注释）。再晚也没有更新的值 —— 工具执行期间
  它是「刚发出那次请求」的口径，属测量事实，不是滞后。
- 契约注释同步：`shared/session-events.ts` 的 `session_state` / `context_usage` 两处
  写明「token 用量来源是每步的」；`daemon/index.ts` 撤掉「session_state 每天只有几十条」
  的旧口径（该分支现在每步多推一条 `session_stats`，与台账 fold 钩子那条内容重复）。
- 回归测试：`src/core/session-host.test.ts` 新增「上下文用量按步刷新」——
  用一个「每步给新读数」的假会话断言 `session_state` 的取值序列随步推进。

不改 renderer、不改 IPC 通道、不新增事件类型。

## 否决方案

1. **给 `assistant_done` 加一个 `contextUsage` 字段，由 daemon 在收到它时派生明细。**
   否掉：同一个事实（used/total）就有了两个载体（`session_state.contextUsage` 与
   `assistant_done.contextUsage`），两处必然漂移；而且 daemon 若从该步 message 的
   `usage` 自己算 context tokens，等于把 pi 的 `estimateContextTokens`（含尾部消息估算）
   重新实现一遍。
2. **daemon 在台账 `llm_call` 钩子里读 `bucket.hostPromise` 拿宿主状态再派生。**
   否掉：宿主句柄是 Promise，只能异步取，`context_usage` 的到达顺序会落到其后若干事件
   之后（不确定性进事件序），且把「状态何时变了」的判断从状态持有者挪到了 daemon。
3. **新增一个专用轻量事件（如 `context_usage_refresh`）承载 used/total。**
   否掉：同样是给同一个事实开第二个载体/第二条派生路径，收益只是少一条 `session_state`
   的体积；`session_state` 的契约本就写了「token 用量」，每步重推在语义内，不需要新事件。
4. **把 `tool_call` 台账也纳入统计推送（顺带解决「工具跑完的步不刷新」）。**
   否掉：与本次无关（`session_stats` 已按步更新），且 `daemon/index.ts:2489` 明确排除过
   它（一个 run 几十条，只影响工具耗时）。

## Impact

- Affected code：`src/core/session-host.ts`（1 处调用 + 注释）、
  `src/shared/session-events.ts`（契约注释）、`src/daemon/index.ts`（注释）、
  `src/core/session-host.test.ts`（回归测试）。
- 不触碰 `documents/`、`renderer/`；界面无视觉/样式改动（不涉及 DESIGN.md）。
- 代价：每步多一条 `session_state`（约 0.4 KB）与一条重复的 `session_stats`，
  与已有的 `assistant_done` 同阶；事件日志体积主因仍是 `tool_stream_progress`（LOG18）。

## MODIFIED Requirements

### Requirement: 上下文用量圆环的刷新粒度

原行为：只在 run 边界（`agent_start` / `agent_end`）、压缩结束与若干 setter 上刷新 ——
一次多步 run 里圆环长时间停在开跑读数。

改为：每次助手 `message_end`（每一步模型调用）重推一次 `session_state`，圆环随步刷新；
run 边界的既有推送不变（仍会推，作为收尾口径）。

#### Scenario: 多步 run 进行中

- **WHEN** 一个 run 连续发生多次模型调用（每步之间跑工具）
- **THEN** 圆环的占用读数随每一步推进（`context_usage` 条数与步数同阶），
  而不是等 run 结束才跳一次

#### Scenario: 压缩后空窗

- **WHEN** 刚压缩完、pi 的 `getContextUsage()` 返回 `tokens: null`
- **THEN** 与现状一致：该次 `session_state` 不携带 `contextUsage`，圆环隐藏而非显示旧值
  （reducer 的清理语义不变，[conversation.ts:664](file:///d:/DongProject/kamibuddy/src/shared/conversation.ts)）

## 验证

- 反证：把 `this.emitState()` 注释掉后跑新测试 → 红（`expected [100] to deeply equal [100, 140, 190]`），
  正是「每 run 一次」的形态；恢复后绿。
- `tsc --noEmit` 通过；`scripts/check-dependency-rules.ts` 通过（408 文件）；
  `vitest run` 全绿（161 文件 / 2985 用例通过、1 跳过）。
- 手测（用户执行）：长任务跑起来后观察圆环是否随步变化。
