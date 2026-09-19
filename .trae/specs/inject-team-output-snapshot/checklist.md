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

## 真机（本 change 的最终产出）
- [ ] 领导**未调 `team_read`** 的情况下，其会话出现 team-output 快照，且下一轮引用了成员产出内容
- [ ] 注入代价已量出：条数 / 字符总量 / 输入 token 与缓存命中变化
- [ ] 结论已落档：`team_read` / `team_status` 能否撤（留待后续 change），或本通路需要调整上限

> 上面三条**只能由真机团队会话产出**：改动落地后还没有团队会话跑过（本机对 `kamibuddy-team-output` 的检索当前 0 命中）。
> 检查流水线本身已用既有两条通道验证可用（能正确报出条数与字符总量），**不得以旁路代替真机**。
