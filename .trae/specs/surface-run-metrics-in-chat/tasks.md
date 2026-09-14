# Tasks

## 波一 · 可并行（文件零交集）

- [x] Task 1: 回合指标 fold 纯函数（renderer）
  - [x] 1.1 新建 `src/renderer/turn-metrics.ts`：`foldTurnMetrics(entries, turn)` →
        返回 `{ elapsedMs, inputTokens?, outputTokens?, cacheReadTokens?, hitRate? }`；
        按回合边界（该轮 user 条目之后）聚合 `AssistantMessage.usage`
  - [x] 1.2 边界口径：任一 usage 字段缺失时该字段返回 undefined（不填 0）；
        流式中 `turn.endedAt` 缺失时用传入的 now 计算耗时；多 assistant 条目求和
  - [x] 1.3 单测：单轮单条、单轮多条求和、无 usage 降级、命中率算法复用
        `shared/observability.ts` 的 `cacheHitRate`、token 格式化复用
        `shared/context-usage.ts` 的 `formatTokenCount`（不重写）
  - [x] 1.4 验证：`npm run typecheck && npx vitest run src/renderer`

- [x] Task 2: 回合计时持久化（reducer）
  - [x] 2.1 `src/shared/conversation.ts`：新增按回合 id 的计时映射
        （`turnTimings: Record<turnId, TurnTiming>`），在 `run_started` /
        `run_finished` / `run_error` 折叠时写入；上限裁剪并注释口径
  - [x] 2.2 保持既有 `turn`（当前回合）字段不变 —— 已有消费点（回合头部、
        等待区判定）不接受行为变更
  - [x] 2.3 单测：连续两轮后两轮计时都在；中断/取消轮记 cancelled；
        历史会话恢复（`session_state` 重推）不丢当前映射
  - [x] 2.4 验证：`npm run typecheck && npx vitest run src/shared`

## 波二 · 串行（与 Task 2 改同一文件）

- [x] Task 3: 压缩过程事件透传（契约 + 翻译层 + reducer）
  - [x] 3.1 `src/shared/session-events.ts`：新增压缩状态事件
        （started 带 reason: manual|threshold|overflow；finished 带 aborted/error）
  - [x] 3.2 `src/core/session-host.ts`：`compaction_start` / `compaction_end`
        由「仅写台账」扩为「台账 + 转发事件」（现状见 session-host.ts 的 compaction 分支，
        run 内压缩不上屏）；空闲手动压缩的既有处理不回归
  - [x] 3.3 `src/shared/conversation.ts`：折叠成 `state.compacting`
        （`{ reason, startedAt }`），结束/失败清空
  - [x] 3.4 单测：reducer 折叠（starts→finished 清空、error 清空）；
        session-host 转发（若现有测试框架可覆盖，否则在 3.4 注明以 reducer 测试为准）
  - [x] 3.5 验证：`npm run typecheck && npx vitest run src/core src/shared`

## 波三 · 依赖前三项

- [x] Task 4: 会话页 UI 接线
  - [x] 4.1 输入区下方新增指标条：`renderer/chat-view.tsx` 的 `.chat-composer`
        内（`Composer` 之后）挂载，作为 `.chat-composer > *` 子元素自动同宽居中；
        展示「用时 · ↑输入 ↓输出 · 命中率」，流式期间 500ms 刷新用时
  - [x] 4.2 样式加在 `renderer/index.css`：复用 `--text-dim` / `--text-secondary`、
        `tabular-nums`（数字跳动防抖，同 `.turn-duration`）、紧凑 chip 视觉；
        禁用原生组件、不用 title 兜底
  - [x] 4.3 回合头部：历史轮显示真实用时（改 `TurnHeader` 取 Task 2 的计时映射，
        保持既有折叠交互不变）
  - [x] 4.4 压缩状态行：`streamTail` 内 `state.compacting` 存在时显示
        「正在压缩上下文…」，与既有等待行/排队徽标的位序协调（不叠加两条状态行）
  - [x] 4.5 验证：`npm run typecheck && npx vitest run src/renderer`

## 收尾

- [x] Task 5: 全量验证 + 文档
  - [x] 5.1 `npm run typecheck && npm run check:deps && npm test` 全绿
  - [x] 5.2 对齐清单更新：可见性行写明会话页指标条；「不做」清单里的数据缺口
        （子代理台账、审批等待计时、seq gap 检测）记入状态列备注，避免日后误判为已完成

# Task Dependencies

- Task 1 / Task 2 可并行（不同文件）
- Task 3 依赖 Task 2（同改 `shared/conversation.ts`，串行避免互相覆盖）
- Task 4 依赖 Task 1 / 2 / 3
- Task 5 依赖全部
