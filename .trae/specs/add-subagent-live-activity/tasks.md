# Tasks

## 波一 · 契约层（先行，后续两波都依赖它）

- [x] Task 1: shared 契约 + reducer
  - [x] 1.1 `src/shared/session-events.ts`：`SubagentStatus` 类型
    （agent 名 / task 摘要 / status: queued|running|done|failed / activity 最新动作行
    / turns / output?（终态成功输出或失败诊断））；`SessionEvent` 加
    `subagent_progress`（`{ id: ToolCallId, agents: readonly SubagentStatus[] }`，
    整体投影替换语义）；`ToolCard` 加可选 `subagents` 字段
  - [x] 1.2 `src/shared/conversation.ts` + 测试：reducer 新增 `subagent_progress`
    分支——按 id 原位替换卡片 `subagents`（实时与 JSONL 重放同一条路径，
    重放时自然还原终态）
  - [x] 1.3 验证：`npm run typecheck && npx vitest run src/shared`

## 波二 · daemon 管道（依赖 Task 1 契约）

- [x] Task 2: task 工具结构化投影 + session-host 事件桥
  - [x] 2.1 `src/extensions/task-tool.ts` + 测试：维护每代理状态表
    （runOne 开始置 running、onProgress 更新 activity、resolve 置 done/failed
    带 turns 与 output/诊断；排队态由 runner 的排队回调自然体现）；
    `onUpdate` 的部分结果 `details` 携带完整 `subagents` 投影，
    content 文本置空（停发文本进度——detail 不再累积进度行）
  - [x] 2.2 `src/core/session-host.ts`：`tool_execution_update` 识别
    `partialResult.details.subagents` → 发 `subagent_progress`（不再发
    tool_progress 文本 delta）；`tool_execution_end` 从 `details.results`
    组装终态 `subagents` 落到 finished 卡片
  - [x] 2.3 `src/daemon/subagent-runner.ts`：确认无需改动（onProgress 文本
    口径不变，task 工具层负责归组）；若排队回调需带 agent 维度信息则微调
  - [x] 2.4 验证：`npm run typecheck && npx vitest run src/extensions src/core`

## 波三 · 渲染层（依赖 Task 1 契约，可与波二并行）

- [x] Task 3: TaskAgentCard 组件 + 样式
  - [x] 3.1 `src/renderer/chat-view.tsx`：toolName === "task" 特化为
    TaskAgentCard（参照 TodoListCard 特化先例）：卡头沿用工具卡语言
    （状态点 + 「子任务」+ 摘要 + 折叠箭头）；卡体按代理分组——状态 glyph
    （排队空心环/运行中 spinner+扫光/成功勾/失败叉）、agent 名、task 摘要、
    最新动作行（运行中实时更新）；失败组显示诊断；成功组输出可展开
  - [x] 3.2 默认展开规则：运行中（outcome 未落定）默认展开，终态默认折叠；
    用户手动开合优先于默认规则（TodoListCard 同款语义）
  - [x] 3.3 无 `subagents` 的旧会话 task 卡回退到普通 ToolEntry 渲染
    （向后兼容）
  - [x] 3.4 `src/renderer/index.css`：分组行、状态 glyph、动作行样式，
    复用既有工具卡/todo 卡的视觉语言与 CSS 变量
  - [x] 3.5 验证：`npm run typecheck && npx vitest run src/renderer`

## 收尾

- [x] Task 4: 全量验证 + 文档
  - [x] 4.1 `npm run check && npm test` 全绿 —— `npm test` 1509 全绿；
    `npm run check` 被工作区无关在途改动阻塞（本任务文件零错误），见 4.4
  - [x] 4.2 `docs/workbuddy对齐清单.md` 状态列记录本项；
    架构决策（结构化投影替代文本 delta 的理由：并行交错 + 折叠不可见）
    记入 `docs/ARCHITECTURE.md` §4（4.10）
  - [ ] 4.3 手动冒烟：单发/并行/链式各跑一次 task，确认运行中分组实时更新、
    完成收敛、切换会话回看终态正常（留给用户验证）
  - [x] 4.4 待工作区无关在途改动（permission-rules-engine / memory /
    personalization / experts 重构）收尾后，重跑 `npm run check` 确认全绿
    —— 2026-09-14 查明并非在途改动而是共享文件被旧版本意外覆盖（纯删除），
    已恢复 HEAD 并回补权限规则引擎新增，check + test 全绿

# Task Dependencies

- Task 2 依赖 Task 1（SubagentStatus 与事件契约）
- Task 3 依赖 Task 1（同一契约，可与 Task 2 并行）
- Task 4 依赖 Task 1、2、3
