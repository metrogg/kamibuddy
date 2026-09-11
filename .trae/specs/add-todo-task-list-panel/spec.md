# 任务清单面板（L6，todo_write 工具 + 清单卡）Spec

## Why

WorkBuddy 的 L6「任务清单面板」：模型用 TodoWrite 维护待办清单，UI 在消息流里渲染成一张
始终反映最新全量的任务清单卡（进行中 spinner、完成删除线、待定空心圆，最多窗口化 5 条）。
我们当前完全没有这套机制（对齐清单 C9/L6 均 ❌）——长任务（调研、多文件改造）的进度
对用户不可见，模型自己也缺少任务跟踪的锚点。

## What Changes

- 新增 `todo_write` 扩展工具（`src/extensions/todo-tool.ts`）：全量替换语义，
  每项 `{ content, activeForm?, status: pending|in_progress|completed }`；
  工具无副作用，返回确认文本；promptSnippet/promptGuidelines 对齐 WorkBuddy
  （<3 步不要用、恰好一个 in_progress、完成立即标记、收尾清空）。
- `ToolCard` 新增可选结构化字段 `todos`（`shared/session-events.ts`）：
  session-host 在参数完整时解析 args 填入；历史恢复重建卡片时同样解析，
  清单随会话恢复天然还原（靠消息回放，不新增持久化状态）。
- `todo_write` 加入「参数生成期即上屏」名单（session-host）：生成期显示
  「接收中…」占位（不解析半截 JSON），终态渲染完整清单。
- renderer 新增聚合投影纯函数（`todo-projection.ts`）：把消息流里多次
  todo_write 卡折叠成**一张合成卡**——全量替换语义下最新一次即全量，
  位置钉在第一次出现处，旧卡移除（WorkBuddy projectTaskList 同语义）。
- chat-view 新增 `TodoListCard` 渲染：状态 glyph（✓/spinner/空心圆）、
  in_progress 显示 activeForm 且加粗、completed 删除线+灰化、窗口化最多 5 条
  以 in_progress 为锚、卡片头「任务列表」+ 展开箭头、是最新内容时默认展开。
- craft / expert 模式白名单加 `todo_write`；plan 模式不加（保持只读语义）。
- **不做**（对齐 WorkBuddy 现状或明确 YAGNI）：TaskCreate/Get/List/Update 系列、
  任务依赖/阻塞、任务行点击交互（WorkBuddy 点击只 setActiveTask，无 UI 消费）、
  merge 增量模式、子代理工具面加 todo_write（子代理中间过程不可见，无意义）。

## Impact

- Affected specs: 对齐清单 C9（TodoWrite 部分）、L6
- Affected code:
  - 新增 `src/extensions/todo-tool.ts`（+ 测试）、`src/renderer/todo-projection.ts`（+ 测试）
  - `src/shared/session-events.ts`（ToolCard.todos）
  - `src/core/session-host.ts`（生成期上屏名单、终态/重建时解析 todos）
  - `src/daemon/index.ts`（装配 todo 扩展）
  - `src/renderer/chat-view.tsx`（投影应用 + TodoListCard）、`src/renderer/index.css`
  - `resources/modes/craft.md`、`resources/modes/expert.md`（白名单）

## ADDED Requirements

### Requirement: todo_write 工具契约

系统 SHALL 提供 `todo_write` 工具，参数为
`{ todos: Array<{ content: string, activeForm?: string, status: "pending"|"in_progress"|"completed" }> }`，
语义为**全量替换**当前会话的待办清单；工具无副作用，返回简短确认文本。

工具描述与守则 SHALL 对齐 WorkBuddy：少于 3 步的简单任务不要用；
任何时刻恰好一项 in_progress；完成的任务立即标记 completed；
全部完成时以 `todos: []` 收尾。

#### Scenario: 模型维护清单

- **WHEN** 模型用 5 项 todos（第 2 项 in_progress）调用 todo_write
- **THEN** 工具返回确认文本，消息流出现清单卡显示 5 项及对应状态

#### Scenario: 误用引导

- **WHEN** 模型对「查一下时间」这类单步任务调用 todo_write
- **THEN** 守则已在提示中劝阻（<3 步不用）；工具本身不报错（清单仍被记录）

### Requirement: 清单卡渲染（界面对齐 WorkBuddy）

清单卡 SHALL 渲染在消息流工具卡位置，结构对齐 WorkBuddy `cr-tool-plan-task`：

- 卡片头：剪贴板图标 + 「任务列表」文案 + 展开箭头；该卡是消息流最新内容时默认展开，否则折叠
- 每行：状态 glyph + 文字
  - completed：对勾（灰）+ 文字删除线 + 灰化（rgba(0,0,0,0.3)）
  - in_progress：绿色 spinner（#0cbf5b，旋转）+ 文字加粗；有 activeForm 时显示 activeForm
  - pending：12px 空心圆环 + 普通文字
- 超过 5 条时窗口化裁剪：以 in_progress 项为锚居中显示 5 条；无 in_progress 以最后一个 completed 为锚
- 展开内容盒：max-height 300px 内部滚动、圆角、灰底（#f2f2f2 token）

#### Scenario: 三态同屏

- **WHEN** 清单含 completed×2、in_progress×1、pending×2
- **THEN** 各行按上述三态渲染，in_progress 行显示 activeForm 且加粗

#### Scenario: 超长清单窗口化

- **WHEN** 清单有 9 项且第 6 项 in_progress
- **THEN** 只显示以第 6 项为锚的 5 条窗口

### Requirement: 聚合投影（一张最新全量卡）

渲染层 SHALL 在渲染前对 entries 做投影：所有 todo_write 卡折叠为一张合成卡，
内容取最新一次调用的全量清单，位置保持在第一张 todo_write 卡出现处；
其余 todo_write 卡从消息流移除。投影为纯函数，可单测。

#### Scenario: 连续更新

- **WHEN** 模型先后 3 次调用 todo_write（5 项 → 推进 → 4 项）
- **THEN** 消息流只有一张清单卡，显示最新 4 项，位置在首次出现处

#### Scenario: 历史恢复

- **WHEN** 切换到含 todo_write 调用的历史会话
- **THEN** 清单卡按最新消息重建并正常渲染（不依赖任何额外持久化）

### Requirement: 参数生成期上屏

`todo_write` SHALL 在参数生成期即上屏工具卡（与 web_search/write 同机制），
生成期卡片显示「任务列表」头 + 「接收中…」占位，不解析半截 JSON。

#### Scenario: 流式生成

- **WHEN** 模型正在流式输出 todo_write 参数
- **THEN** 工具卡已上屏显示「接收中…」，参数完整后替换为清单

### Requirement: 模式白名单

craft 与 expert 模式的 tools 白名单 SHALL 包含 `todo_write`；
plan 模式 SHALL NOT 包含（保持只读语义）；子代理（worker 等）白名单不包含。

#### Scenario: craft 可用

- **WHEN** craft 模式下模型发起 todo_write
- **THEN** 工具正常执行并渲染清单卡

## MODIFIED Requirements

### Requirement: craft 模式工具面

craft 白名单在原 19 个工具基础上新增 `todo_write`（全 20 个）；
expert 模式跟随（craft 全工具面 + task 的口径不变）。

## REMOVED Requirements

无。
