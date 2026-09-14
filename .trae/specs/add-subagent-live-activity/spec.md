# 子代理运行过程实时可视 Spec

## Why

子代理执行期间主对话只有一张默认折叠的「子任务」卡：进度文本经 `tool_progress` delta
追加到卡片 `detail`，折叠态下完全不可见，且并行模式多代理的进度行交错混在同一段
文本里。用户在子代理工作的几分钟内完全感知不到它在干什么，只能事后从左侧栏翻
子会话记录。对标 Trae 的内联子代理卡：运行中实时展开、按代理分组展示状态与动作。

## What Changes

- task 工具卡升级为「子代理活动卡」：运行中默认展开，按子代理分组实时显示
  状态（排队/运行中/完成/失败）与最新动作行（正在执行的工具 + 摘要、已完成轮数）
- 新增结构化进度事件 `subagent_progress`（整体投影替换语义），替代现有
  「文本 delta 追加 detail」的进度通道——解决并行多代理文本行交错问题
- 完成后卡片收敛为每代理结果摘要（成功/失败 + 轮数，失败显诊断，成功输出可展开）
- 历史会话重放同样呈现终态摘要（事件入会话 JSONL，走既有重放管道）
- **不改子代理执行语义**：隔离上下文、权限门用户在场、并发 4、spawn 预算 20、
  10 分钟超时均不动；保持「子会话事件不直接转发主会话事件流」的隔离设计——
  活动信息经 task 工具部分结果的 `details` 结构化投影，渲染层不出现子会话的
  独立工具卡

## Impact

- Affected specs: add-subagent-task-tool（进度展示口径变更）
- Affected code:
  - `src/shared/session-events.ts`（SubagentStatus 类型、`subagent_progress` 事件、ToolCard.subagents）
  - `src/shared/conversation.ts`（reducer 新分支，实时与重放共用）
  - `src/extensions/task-tool.ts`（每代理状态表 + 结构化投影，停发文本进度）
  - `src/core/session-host.ts`（tool_execution_update 识别 details.subagents；tool_execution_end 落终态）
  - `src/renderer/chat-view.tsx`（TaskAgentCard 特化组件，参照 TodoListCard 特化先例）
  - `src/renderer/index.css`（活动卡样式）

## ADDED Requirements

### Requirement: 子代理运行状态实时可见

系统 SHALL 在主对话的 task 工具卡内实时展示每个子代理的执行状态与最新动作，
运行中卡片默认展开。

#### Scenario: 单发执行中

- **WHEN** 主代理调用 task 委派一个子代理
- **THEN** 工具卡默认展开，显示子代理名、任务描述摘要、当前状态
  （排队/运行中）与最新动作行（如「正在 web_search <query>」「已完成 N 轮」），
  随执行实时更新

#### Scenario: 并行执行中

- **WHEN** task 以并行模式委派多个子代理
- **THEN** 卡片按子代理分组，每组独立显示状态与最新动作行，互不交错

#### Scenario: 链式执行中

- **WHEN** task 以链式模式顺序执行多步
- **THEN** 已完成步显示完成态，当前步显示运行态与动作行，未开始步显示等待态

### Requirement: 完成后结果摘要

系统 SHALL 在全部子代理结束后把卡片收敛为分组结果摘要。

#### Scenario: 全部完成

- **WHEN** task 工具执行结束
- **THEN** 每组显示终态（成功/失败状态点 + 轮数）；失败组显示诊断文本；
  成功组的输出可展开查看；卡片可整体折叠为一行摘要

#### Scenario: 部分失败

- **WHEN** 并行/链式中部分子代理失败
- **THEN** 失败组以失败态呈现诊断，成功组正常呈现，卡片整体标失败态

### Requirement: 历史会话回看

- **WHEN** 切换回包含子代理执行的历史会话
- **THEN** 子任务卡以终态分组摘要呈现（与实时完成态一致），不出现运行中假象

### Requirement: 隔离设计保持不变

系统 SHALL 维持子会话事件不直接转发主会话事件流的设计。

#### Scenario: 活动中不冒子会话工具卡

- **WHEN** 子代理执行其内部工具（read/web_search 等）
- **THEN** 主消息流不插入子会话的独立工具卡；子代理活动仅以 task 卡内
  分组动作行的形式呈现

## MODIFIED Requirements

### Requirement: 子任务工具卡进度展示（原 add-subagent-task-tool）

原口径：子代理进度经 `onProgress` 一句话 → `tool_progress` 文本 delta 追加到
卡片 `detail`（折叠不可见，并行交错）。

新口径：task 工具不再发送文本进度 delta；改为在部分结果 `details` 中携带
`subagents` 结构化投影（每代理：名称/任务/状态/最新动作/轮数），session-host
翻成 `subagent_progress` 事件（整体替换语义），渲染层按投影渲染分组活动卡。
卡片 `detail` 不再累积进度行。
