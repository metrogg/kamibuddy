# Checklist

## 记录层（台账）

- [x] 每会话 NDJSON 台账存在（logs/runs/<sessionId>.jsonl），seq 单调 + at + kind
  （run-ledger.ts:11/238：写盘成功才消耗 seq 无空洞）
- [x] llm_call 条目：边界/TTFT/usage 全字段（reasoning/cacheWrite1h/costBreakdown
  可选细分，shared/observability.ts）/stopReason
- [x] retry 条目：auto_retry 全程（attempt/maxAttempts/delayMs/errorMessage，
  start 归刚失败尝试/end(success) 归新 run）——此前三处全黑已点亮
- [x] queue 条目 + compaction 条目 + tool_call 统一执行期口径（口径差异注释钉住）
- [x] request_snapshot：transformContext 钩子记录（分段 provenance + 消息分类计数，
  不记正文，原样透传不改写）
- [x] 未闭合 run 重启后合成闭合（sealOrphans run-ledger.ts:209/281，含崩溃半行修复）；
  台账写入失败进 event-log 不炸业务

## 投影与统计

- [x] 聚合从台账 fold 重建，daemon 重启不清零（启动 replayLedgerDir 全量回放 +
  onAppended 增量 fold 同一 foldLedgerEntry 双源防双计；observability.test.ts 22 绿）
- [x] 会话级统计近 pi getSessionStats 口径（snapshot.sessions：turns/llmMs/toolMs/
  usage/命中率，含被压缩历史，口径差异注释）
- [x] 缓存浪费归因（snapshot.cacheWaste：idle_ttl/model_change/other，pi cache-stats
  算法移植，6 场景测试）

## 可视化

- [x] 诊断页会话时间线：llm（耗时/TTFT/token/cost/缓存命中/stopReason）/工具/重试
  琥珀标记/压缩 tick/终态标记 + 会话选择器（run-timeline.ts fold 11 测试绿）
- [x] 上下文组成真实拆分（request_snapshot 分段占比 + 消息四类；无快照会话降级
  估算条并标注）
- [x] run 级缓存命中率 + 会话级统计卡片 + 浪费归因卡片（真实接线非占位）
- [x] 运行中重试状态行（「响应失败，N 秒后第 X/Y 次重试」倒计时）+ 排队徽标
  （run_retry/queue_changed 经 reducer 两端共用，441 测试绿）

## 恢复与工程

- [x] 会话损坏降级打开 + 跳过行数提示（countSkippedLines 预扫 → session_state
  带 skippedLines；头部损坏仍拒绝打开有注释口径）
- [x] `npm run typecheck`（本 spec 文件零错）+ `check:deps` 通过 + `npm test`
  1404 过（8 挂全在并行会话在途文件，非本 spec）
- [x] 对齐清单 L16 已更新（✅ 观测体系反超）；AGENTS.md 被并行会话重写，
  文档以本 spec 为准
