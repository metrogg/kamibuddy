# Checklist

## 通道路径
- [x] 新增通道常量 `kamibuddy-team-output` 落在 `src/shared/observability.ts`（与既有三条同处），消费点（导出过滤 / 翻译过滤 / request_snapshot）已列出
- [x] `prompt-switch.ts` 第四条 handler 的注册顺序固定在既有三条之后（消息在请求体里的相对顺序跨调用稳定）
- [x] 该通道正文**不含**取代声明（`SNAPSHOT_SUPERSEDE_NOTE`）—— 取代声明由各通道 composer 写在正文里，本通道的 composer 不写；读码后确认 `snapshotMessage` 从不接触它，故无需给它加开关（SubTask 1.2 据此作废）
- [x] 该通道消息为 `role: "custom"` + 具名 `customType` + `display: false`，落位在本轮用户消息之后、写进会话文件（`prompt-switch.test.ts` 的新用例逐项断言）
- [x] 既有三条通道的行为与字节**逐字节未变**（`prompt-switch.test.ts` 27 例全绿，其中既有三条的期望值一个字未改）

## 幂等与真源
- [x] 同一份成员产出只注入一次（指纹判据），第二次 run 不再出现 —— 「三连跑稳定」用例钉死：run1 带产出块 → run2 只剩状态行 → **run3 返回 `undefined`**
- [x] 判据完全取自会话内容（无进程内「已注入清单」这类第二真源）：指纹写进状态行、从上一条同通道快照解析
- [x] 产出仍以成员会话 JSONL 为唯一真源：快照是**派生物**；`previous` 缺记录（旧形态 / 首次 / 被压缩遮蔽）⇒ 重注一次（fail-open，宁可重注不可漏注）
- [x] 之前快照被压缩遮蔽时，下一次 run 重新追加（基线取自 `buildContextEntries()` 活分支，沿用既有通道语义）

## 成本与门控
- [x] 无团队 / `agentTeamsEnabled` 关闭时：不产生该通道任何消息，且**不读**成员会话文件（门控顺序 = 开关 → 桶空 → 无团队 → 才读；`collectTeamOutputMembers` 的注入式接缝断言 `team===undefined` 时 `readOutput` 调用 0 次）
- [x] 单成员产出按 `TEAM_OUTPUT_MAX_CHARS`（4,000）截断，并标注「（已截断，全文用 `team_read`）」
- [x] 桶未 adopt（`bucket.sessionId === ""`）/ 成员无 sessionId 时返回 `undefined` 而不是抛错（刻意不用 `adoptedSessionId` —— 那是响亮断言，用在这里会让读侧通道把 run 打炸）
- [x] 注入落点在历史尾部（不是系统提示词），内容不变则不追加 ⇒ 不截断前缀缓存

## 证据纪律
- [x] 单测覆盖：指纹幂等 / 截断与标注 / 状态行口径 / 空团队零成本（`team-output-snapshot.test.ts` 24 例）
- [x] 新增护栏按纪律验证过「会变红」：把判据 `===` 人为改成 `!==` ⇒ 24 例里 **8 例失败**（含三连跑稳定性），已改回
- [x] `docs/ARCHITECTURE.md` §4.22 含 `## 否决方案`（6 条），且点名「否决每请求现算的尾巴注入」并给出 2026-09-18 的实测数字（58,094 token / 28.8%）
- [x] 门禁实跑：`typecheck` 0 错误 / `check:deps` / `check:tokens` / `check:model-experience`（22 个模块）/ `check:module-invariants`（25 个模块）/ `check:expert-assets`（4 个团队专家）/ 全量 `vitest` 159 文件 2930 例通过（1 skipped）

## 触发点改判后的新通路（(b) 挂 team 工具结果）
- [x] 纯函数层：`collectFingerprintsIn`（扫正文里的 `[fp …]`，含拼在长文本中间的情形）+ `composePendingTeamOutput`（无待送达 ⇒ `undefined`）；41 例全绿，含**闭环用例**（第一次返回文本喂回 ⇒ 第二次 `undefined`）
- [x] 两块**逐字节同形**：`composePendingTeamOutput(delivered=∅)` 与 `composeTeamOutputSnapshot(previous=undefined)` 相等（强断言钉住，避免 `[fp …]` 解析口径漂移）
- [x] 单点包装：八个注册点统一走 `register()`；追加只动 `content`、**`details` 与不接该 dep 时逐字节一致**；`readPendingOutputs` 返回 `undefined` 时结果一字不加
- [x] 覆盖证明是单点包装而非只挂一个工具：`team_status` 与 `team_delete` 各一例
- [x] **一条判据、两个触发点**：run 起点快照与工具结果共用 daemon 的局部 `pendingTeamOutput()`，**没有**任何"已送达清单"这类第二真源
- [x] `prompt-switch` 的 `composeTeamOutput` 收敛为**零参**（`previous` 无消费者），handler 不再手动读基线
- [x] 契约三段同步（`team-tools.ts` 的 What the model sees / Token effect / KV Cache effect）；`check:model-experience` 22 个模块通过
- [x] 护栏验红：纯函数层把 `delivered.has` 短路 ⇒ 红 3 例；工具层把包装短路 ⇒ 红 2 例（均已回滚）
- [x] 裁决与理由落档：`docs/ARCHITECTURE.md` §4.22「否决方案（触发点）」第 7~9 条（(a) 被真机否、(c) 因瞬态+42 次/run 重付被否）
- [x] 门禁实跑：`typecheck` 0 错误 / `check:deps` / `check:tokens` / `check:model-experience` / `check:module-invariants` / `check:expert-assets` / 全量 `vitest` **159 文件 2951 例通过（1 skipped）**

## 真机（本 change 的最终产出）
- [x] 真机跑过一次（13:50 `research-llm-2027`）并把两件事都暴露出来：注入 **0 条**（run 起点的触发点错位）、`team_read` **未登记白名单**（`Tool team_read not found`）
- [x] 白名单 bug 已修 + 机械护栏（`team-tools.test.ts` 的「craft 白名单覆盖」，验红过）
- [x] 触发点已改判并实施（(b) 挂团队工具结果；见上节）
- [ ] **复验待做**：重跑一次团队任务，确认领导**不调 `team_read`** 也能在 `team_status`/`team_send` 的结果里看到成员产出，并量出这次真实代价（块数 / 字符量 / 输入 token 与缓存命中变化）—— 见 tasks.md Task 9
- [ ] 结论已落档：`team_read` / `team_status` 能否撤（留待后续 change）—— 需先有复验数字

> 真机一次就把两件事同时暴露出来了：①通路本身**触发点错位**；②`team_read` **漏登记 craft 白名单**。
> 两者都已处理；触发点那条是**用户在两条候选之间拍板**后改的（per-request 因瞬态与 42 次/run 的重付代价被否）。
