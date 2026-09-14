# Tasks

## 波一 · 并行（core 台账 与 renderer 预备，文件零交集）

- [ ] Task 1: 台账记录层 + 翻译层补齐（core/shared/daemon）
  - [ ] 1.1 `src/core/run-ledger.ts`（新）：每会话 NDJSON（~/.kamibuddy/logs/runs/
    <sessionId>.jsonl）；append(seq 单调自增 + at + kind + data JSON 校验，写入失败
    响亮记 event-log 不炸 run——台账是观测不是业务）+ 启动时 `sealOrphans()` 对未
    闭合 run 补合成结束标记（dsh：中断闭合优于截断）；条目种类：llm_call / retry /
    tool_call / compaction / queue / request_snapshot（shared/observability.ts 集中类型）
  - [ ] 1.2 session-host.ts 翻译补齐：auto_retry_start/end → 台账 retry + 转发新事件
    `run_retry`（renderer 状态行用）；queue_update → 台账 queue + 转发 `queue_changed`；
    turn_start/end → 台账 llm_call 边界（内部记账，UI 仍不呈现「轮」）；message_end
    usage 全字段透传（shared TokenUsage 加 reasoning/cacheWrite1h/cost 分项——可选字段
    向后兼容）；TTFT = 首个 text/thinking delta 时刻 − llm_call start
  - [ ] 1.3 请求快照：挂 pi transformContext 钩子（session-host createAgentSession
    配置），每轮记 request_snapshot：system 分段 provenance（复用 compose 返回的
    segments—— composeSystemPrompt 已返回带 source 的分段）+ 消息分类条数与字符数
    （user/assistant/toolResult 分类）；不记正文（会话 JSONL 已有，注释口径）
  - [ ] 1.4 会话损坏降级：daemon resume 从抛错改为降级打开 + session_state 带
    skippedLines 提示（pi parseSessionEntries 跳过坏行——找到 pi 的跳过计数暴露口
    或自己预扫计数）
  - [ ] 1.5 验证：`npm run typecheck && npx vitest run src/core src/daemon src/shared`

- [ ] Task 2: 运行中重试/排队状态行（renderer，依赖 Task 1 的事件契约——契约在
  本文件 1.2 已写明，可并行开工）
  - [ ] 2.1 reducer 消费 run_retry / queue_changed（shared/conversation.ts——两端
    共用同一份，daemon 折叠不炸）
  - [ ] 2.2 chat-view 等待区：重试状态行（「响应失败，N 秒后第 X/Y 次重试」倒计时
    递减，与欢迎语/tips 位序协调）+ 排队徽标（N 条消息排队中）
  - [ ] 2.3 验证：`npm run typecheck && npx vitest run src/renderer src/shared`

## 波二 · 依赖台账格式

- [x] Task 3: 投影持久化（core/observability.ts 重构）
  - [x] 3.1 ObservabilityStore 改为「台账 fold 投影」：启动回放 logs/runs/*.jsonl
    重建聚合（重启不清零、去掉 50 条上限——改为时间窗/条数合理上限并注释）；
    增量 fold（新事件到账即投影，与现状 record() 同路径）
  - [x] 3.2 会话级统计：statsSnapshot 增会话级卡片数据（pi getSessionStats 口径——
    含被压缩历史；标注与 run 级聚合的口径差异）
  - [x] 3.3 缓存浪费归因：借鉴 pi cache-stats 算法（5 分钟 TTL 空闲/换模失效），
    台账数据 fold 出 CacheMiss 记录入快照
  - [x] 3.4 验证：`npm run typecheck && npx vitest run src/core src/daemon`

- [ ] Task 4: 诊断页升级「运行观测」（renderer，依赖 Task 3 快照形态——契约可先对齐）
  - [ ] 4.1 会话时间线泳道：llm 调用（耗时/TTFT/token 五字段/cost/缓存命中量）+
    工具 + 重试标记 + 压缩标记嵌套；会话选择器（多会话台账）
  - [ ] 4.2 上下文组成真实拆分：request_snapshot 分类计数渲染（分段 provenance +
    占比）；无快照的会话降级为现有估算条（标注）
  - [ ] 4.3 缓存命中 run 级命中率 + 浪费归因卡片；会话级统计卡片
  - [ ] 4.4 验证：`npm run typecheck && npx vitest run src/renderer`

## 收尾

- [x] Task 5: 全量验证 + 文档
  - [x] 5.1 `npm run typecheck`（本 spec 文件零错误，存量错误全在并行会话在途文件）+
    `npm run check:deps` 通过 + `npm test` 1404 过（8 挂全在并行会话在途文件：
    custom-providers/preferences/preview-server）
  - [x] 5.2 对齐清单 L16 更新（✅ 观测体系反超）；AGENTS.md 被并行会话重写
    （原「已知差距/目录」节已不存在），观测体系文档以本 spec 与代码注释为准

# Task Dependencies

- Task 2 依赖 Task 1 的事件契约（已写明可并行）；Task 3 依赖 Task 1 台账格式；
  Task 4 依赖 Task 3 快照形态；Task 5 依赖全部前置
