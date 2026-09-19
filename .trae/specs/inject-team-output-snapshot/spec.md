# 把成员产出注入领导上下文（甲案）Spec

【**状态：本 change 的「挂载点」部分已被取代（2026-09-19 同日，spec: unify-team-output-delivery）**
—— 挂载点从「`team_*` 工具结果」扩到「任意工具结果」，判据从「扫领导会话正文」改为「内存账本
+ 首次从会话文件种子化」，裁决见 `docs/ARCHITECTURE.md` §4.23。本 change 的其余结论
（「照抄 WorkBuddy 语义、不照抄载体」，以及「否决 per-request 注入」）**不变**。
本文档其余部分是冻结记录，只改状态与事实性路径。】

> 结论先行：本 change **只建通路、不删工具**。目的是量出「领导不调 `team_read` 也能自然看见成员产出」是否成立，
> 以及它的 token 代价；工具面能不能从 8 件收敛到 WorkBuddy 的四件，由本 change 的实测结果决定（下一个 change）。

## Why

拉模式落地后，成员产出只在成员会话文件里，领导必须**主动调 `team_read`** 才拿得到。2026-09-19 真机现场里领导不调，
于是判定「团队通道坏了」、降级改用子代理（其余成员因此从未被派活）。

WorkBuddy 只有四件套团队工具（`Agent` / `TeamCreate` / `TeamDelete` / `SendMessage`），却能工作，原因是它把
**子会话窗口拼进了父的请求上下文**（`docs/WorkBuddy-reference/extracted/main/server.js:52180-52222` 的
`historyRef: { storeId, afterId, lastId }` + `sliceInvocationWindow`），领导天然看得见产出，不需要读工具。
我们缺的正是这一条通路。本 change 把它补上（甲案），并且用**我们已经被证伪过的那条路之外的形态**实现。

## What Changes

- 新增第四条快照通道 `kamibuddy-team-output`：领导每次 run 开始时，在既有三条快照之后追加一条**团队产出快照**
  （仅当内容变了），内容 = ①成员状态行（名字 / 角色 / 状态 / 已完成轮数，口径与 `team_status` 一致）
  + ②**尚未注入过**的成员产出正文（每成员截断至 `TEAM_OUTPUT_MAX_CHARS`，超出部分标注「已截断，全文用 team_read」）。
- 「尚未注入过」的判据：产出正文的**稳定指纹**未出现在**上一条同通道快照**里
  （指纹 = `normalizeMemberOutput(产出全文)` 的 sha256 前 8 位十六进制）。幂等、可从文件重放、不引入第二真源。
- 门控：`preferences.agentTeamsEnabled` 为真 **且** 本会话有团队；否则零成本返回（不读任何成员会话文件）。
- 该通道**不写「取代声明」**（语义是增量，不是「以最新为准」的事实）。
- 只挂**用户会话**（领导）；成员会话 / 子代理 / 定时任务 run 会话装配处不接。
- **BREAKING**：无。

## Impact

- 影响能力：团队协作（成员 → 领导的信息流）
- 影响代码：
  - `src/shared/observability.ts`（新增通道常量）
  - `src/extensions/prompt-switch.ts`（第四条 handler；该通道不写取代声明的开关；模型体验契约三段同步）
  - `src/daemon/team-output-snapshot.ts`（新增：指纹与快照拼装的纯函数层 + 单测）
  - `src/daemon/index.ts`（`createPromptSwitch` 装配处接线，仅用户会话）
- 已知成本（本 change 要量出来的就是它）：领导每轮请求多带一段成员产出 —— 输入 token 上升、前缀变长。
  这是「自动送达」相对「按需 `team_read`」必然要付的价。

## ADDED Requirements

### Requirement: 成员产出增量注入

系统 SHALL 在领导会话每次 run 开始时，把「尚未注入过」的成员产出与团队成员状态，作为一条隐藏快照消息追加进领导会话历史；
内容与上一条**同通道**快照逐字节相同时 SHALL NOT 追加。

#### Scenario: 成员跑完一轮后领导下一轮自然看到产出
- **WHEN** 团队成员完成一轮产出，领导开始新的一轮 run
- **THEN** 领导会话文件出现一条 `customType: "kamibuddy-team-output"`、`display: false` 的消息，
  含该成员名与其产出正文（或截断正文 + 「全文用 team_read」提示）

#### Scenario: 同一份产出不重复注入（幂等）
- **WHEN** 成员没有产生新产出，领导再次开始 run（状态行也没变）
- **THEN** 不追加新的同通道快照（快照文本逐字节相同）

#### Scenario: 非团队会话零成本
- **WHEN** 会话没有团队，或 `agentTeamsEnabled` 关闭
- **THEN** 不产生该通道的任何消息，且不读取任何成员会话文件

#### Scenario: 压缩遮蔽后重新注入
- **WHEN** 之前的同通道快照被上下文压缩遮蔽（基线取自活分支）
- **THEN** 下一次 run 重新追加一条（沿用既有三条通道的既定语义）

#### Scenario: 产出正文不进界面
- **WHEN** 快照被写入会话文件
- **THEN** 它 `display: false`（界面上不显示），与会话导出过滤口径一致

## MODIFIED Requirements

### Requirement: hidden context 快照通道

原三条通道（`kamibuddy-runtime-context` / `kamibuddy-hidden-context` / `kamibuddy-run-time`）的正文
一律以取代声明（`SNAPSHOT_SUPERSEDE_NOTE`）开头。
现 SHALL 支持**不写取代声明**的通道：新增的 `kamibuddy-team-output` 正文以自己的语义开头
（说明「以下是还没有进过你上下文的成员产出增量」），不写「本条快照取代此前所有同类快照」。

#### Scenario: 通道声明各按语义
- **WHEN** 模型读到 team-output 快照
- **THEN** 它不含取代声明（旧产出不被新快照取代 —— 它们是不同内容，且旧产出仍然有效）

## 否决方案

1. **否决：照 WorkBuddy 做「每请求现算、不落盘的尾巴注入」。**
   2026-09-18 实测已证伪：台账 `01a0b2b3-…` 里两块注入每个 run 内逐字节完全相同却被注入 24 次，
   `cacheRead_N = prompt_{N−1} − 2,423…2,615`，23 轮白付 58,094 token（占会话未命中 28.8%）——
   见 `src/shared/hidden-context.ts` 文件头。它的语义（请求组装时拼入子窗口）我们照抄，
   但载体必须落到「追加持久快照 + 内容变了才追加」，否则复刻的是它的形状、不是它的效果。
2. **否决：写进系统提示词。** 系统提示词位于整段历史之前，任何字节变化都会让其后的**一切（含全部历史）**失配
   （`prompt-switch.ts` 的 (a) 条纪律）。
3. **否决：在 daemon 里维护「已注入清单」（进程内 Map/Set）。** 那是第二真源：resume / 新进程后与文件不一致，
   且被压缩遮蔽时无法感知。判据一律取自会话内容。
4. **否决：注入全文（不截断）。** 7 名成员 × 24k 字符会一次灌进 40k+ tokens；截断 + 指向 `team_read`
   既保留「要全文」的能力，也把自动注入的成本限制在可测范围内。
5. **否决：本 change 顺手删掉 `team_read` / `team_status`。** 甲案的目的就是用证据决定它们能不能撤；
   先删就没有对照组，且会立刻丢能力面（取全文、查等待时长）。
6. **否决：连忙闲事件通道（`team_busy` / `team_idle`）一起照抄。** 成员状态已随快照的状态行注入，
   满足本阶段需求；事件通道是 WorkBuddy 的 ACP 分层产物，为它新造一条事件协议属于超范围。
7. **否决：为它新增一个偏好开关。** 本 change 是验证性改动，验证结论出来后再决定它是留、是改、是撤；
   现在加开关要动偏好模型 + 设置页 UI，成本高于收益。门控复用既有的 `agentTeamsEnabled`。

## 验证（本 change 的产出是「证据」，不是「功能」）

- v.1 单测：指纹幂等 / 无团队零成本 / 截断与标注 / 状态行口径 / 不写取代声明
- v.2 真机：建队 → 成员跑完 → **领导不调 `team_read`**，其会话文件出现 team-output 快照，且领导下一轮能引用成员产出
- v.3 真机代价实测：一次团队会话的注入条数、注入字符总量、该会话输入 token 与缓存命中率的变化
- v.4 门禁：`typecheck` / `check:deps` / `check:model-experience` / `check:invariants` / 全量 vitest
