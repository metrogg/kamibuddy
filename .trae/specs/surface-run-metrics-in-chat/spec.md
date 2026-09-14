# 会话页运行指标可见性 Spec

## Why

`add-observability-ledger` 把台账、投影与诊断页建成了，但**会话页——用户 99% 时间
所在的界面——几乎看不到运行数据**：唯一常驻读数是输入区左组的上下文占用圆环；
本轮耗时只出现在回合头部（且历史轮一律显示「已完成」）；本轮 token、缓存命中、
压缩过程在会话页完全没有展示。诊断页是「要主动去查」的页面，解决不了「运行中无感」。

### 数据可靠性核查结论（本次一并核实）

**可靠的**
- `llm_call` 有完整区间计时（startedAt/endedAt/ttftMs）+ usage 全字段
  （input/output/cacheRead/cacheWrite/reasoning/cacheWrite1h）+ cost 分项 + stopReason
  （`shared/observability.ts:253-266`）
- `tool_call` 有执行期区间计时（`shared/observability.ts:290-299`）
- seq 单调无空洞：只有写盘成功才消耗序号（`core/run-ledger.ts:238-252`，测试钉住）
- 崩溃后 `sealOrphans` 补合成闭合 + 读侧容忍坏行/半行（`core/run-ledger.ts:281-309`、`:54-74`）
- 投影双源按时间域切分，实测无双计（`core/observability.ts:9-27`、`:340-343`）

**缺口（明确列出，避免日后误以为「全都有」）**
- 8 类台账条目里**只有 2 类有区间计时**；其余 6 类（run_start/run_end/retry/
  compaction/queue/request_snapshot）只有单点信封 `at`
- 「用户发消息 → LLM 调用开始」的等待段（含同会话互斥链排队）无计时；
  `queue` 条目只记队列内容、不记等待时长
- 重试退避只记**计划值** `delayMs`，无实测耗时；审批/问卷等待用户作答的
  时间完全不进台账（只在 event-log 里留两个单点）
- compaction 无区间计时；run 级/会话级无 duration 字段（靠 run_start/run_end 的 `at` 推导）
- **子代理与定时任务会话不接台账**（`daemon/subagent-runner.ts:168`、
  `daemon/automation-runner.ts:108` 未传 `createLedger`），其用量在台账里零记录
- `core/run-ledger.ts:11` 宣称「回放方可靠 seq 检出丢行」，但代码里没有 gap 检测
  ——目前是设计意图，未实现
- 崩溃发生在调用中途时，该次 llm_call/tool_call **整条丢失**（只在结束时写一次）

对本次目标的影响：上述缺口里**只有「回合计时不持久」直接卡住可见性**
（renderer 侧的 `turn` 只保留当前回合，`renderer/chat-view.tsx:914-919`），
其余不阻塞本次改动，故不在本 spec 补齐（列入「不做」并写明理由）。

## What Changes

- **会话页常驻指标条**：输入区下方新增一条指标条，展示**本轮**（流式期间实时更新，
  结束后保留最近一轮）用时、输入/输出 token、缓存命中率。数据由 renderer 从
  `entries[].usage` 按回合边界 fold 得出 —— **不新增 IPC、不新增事件**
  （诊断页的拉取式快照不适合常驻消费）。
- **历史回合真实时长**：`shared/conversation.ts` 维护按回合的计时映射，回合头部
  对历史轮显示真实用时，而非现在的「已完成」。
- **压缩过程可见**：新增会话事件透传 pi 的 `compaction_start` / `compaction_end`
  （现在只写台账、不上屏），会话流尾部在压缩期间显示状态行。
- **不做**：TTFT 上屏（需新事件、价值未验证）；子代理/定时任务接台账；
  审批与问卷等待计时；seq gap 检测；cost 展示（模型定价可能缺失，显示空值反而
  降低可信度）；诊断页改造。

## Impact

- Affected specs：`add-observability-ledger`（可见性延伸）、`add-turn-fold-and-anchor`
  （回合头部时长文案）
- Affected code：
  - `src/renderer/turn-metrics.ts`（新：回合指标 fold 纯函数）+ 测试
  - `src/renderer/chat-view.tsx`（指标条挂点、压缩状态行、回合头部时长）
  - `src/renderer/index.css`（指标条样式）
  - `src/shared/conversation.ts`（回合计时映射、压缩状态 fold）+ 测试
  - `src/shared/session-events.ts`（压缩事件契约）
  - `src/core/session-host.ts`（压缩事件转发）

## ADDED Requirements

### Requirement: 会话页本轮指标条

系统 SHALL 在会话输入区下方常驻一条指标条，展示当前会话**最近一轮**的：
用时、输入 token、输出 token、缓存命中率。流式期间用时每 500ms 刷新；
token 与命中率随 `assistant_done` 更新。切换会话时显示该会话最近一轮的指标。

指标条的每一项 SHALL 有数据可依时才显示：该轮没有任何 usage 字段时只显示用时，
不显示 0 值（避免把「上游没给」误读成「真的没用 token」）。

#### Scenario: 生成中实时可见

- **WHEN** 模型正在生成回复
- **THEN** 指标条显示「已处理 12s · ↑3.2K ↓1.1K · 命中 92%」，用时持续递增

#### Scenario: 无用量数据时降级

- **WHEN** 当前轮的任何 assistant 消息都不带 usage
- **THEN** 指标条只显示用时，不出现 token 与命中率

### Requirement: 压缩过程可见

系统 SHALL 在上下文压缩进行期间于会话流尾部显示状态行，压缩结束或失败后消失。
状态行文案 SHALL 区分触发原因（手动 / 阈值 / 溢出）。

#### Scenario: 压缩不再静默

- **WHEN** 上下文达到阈值触发自动压缩
- **THEN** 会话流尾部出现「正在压缩上下文…」状态行，压缩结束后消失

### Requirement: 回合计时可用于历史轮

`shared/conversation.ts` SHALL 为每个回合记录起止时间，使任意历史回合的时长
都可展示（现状只保留当前回合）。

#### Scenario: 回看历史回合

- **WHEN** 用户回看更早的回合
- **THEN** 该回合头部显示其真实用时，而非统一的「已完成」

## MODIFIED Requirements

### Requirement: 回合头部时长

原行为：仅当前回合显示「已处理 Ns」，历史回合一律显示「已完成」
（`renderer/chat-view.tsx:914-919`，因 reducer 只保留当前回合计时）。

改为：任意回合按自身计时显示用时；取消的回合显示「已取消 Ns」；
确实没有计时的回合才回落到「已完成」。

## REMOVED Requirements

无。
