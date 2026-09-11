# Tasks

- [x] Task 1: todo_write 扩展工具（纯编排，可脱离宿主单测）
  - [x] SubTask 1.1: 新建 `src/extensions/todo-tool.ts`：参数 schema
        `{ todos: [{ content, activeForm?, status: pending|in_progress|completed }] }`（1-50 项，
        恰好一个 in_progress 由守则引导、不硬校验）；返回确认文本
        （如「清单已更新：2 已完成 / 5 共」），details 携带解析后的 todos
  - [x] SubTask 1.2: 工具描述/promptSnippet/promptGuidelines 对齐 WorkBuddy 语义
        （<3 步不用、恰好一个 in_progress、完成立即标记、收尾 todos:[]、全量替换）
  - [x] SubTask 1.3: `todo-tool.test.ts`：契约解析、确认文本、空清单收尾、details 形状
- [x] Task 2: ToolCard.todos 结构化 + session-host 接线
  - [x] SubTask 2.1: `shared/session-events.ts`：ToolCard 增加可选 `todos`
        （`readonly TodoItem[]`，TodoItem = { content, activeForm?, status }，导出类型）
  - [x] SubTask 2.2: `core/session-host.ts`：todo_write 加入「参数生成期即上屏」名单
        （标签「任务列表」）；tool_execution_end/卡片落成时解析 args 填 todos
  - [x] SubTask 2.3: 历史恢复重建路径同样解析 todos（restoredToolLabel 所在重建分支），
        保证切会话/重启后清单卡仍可渲染
  - [x] SubTask 2.4: session-host 测试补例：生成期上屏、终态 todos 解析、恢复重建
- [x] Task 3: renderer 聚合投影纯函数
  - [x] SubTask 3.1: 新建 `src/renderer/todo-projection.ts`：输入 entries，输出折叠后的
        entries——所有 todo_write 卡合成一张（内容=最新全量，位置=首次出现处），其余移除
  - [x] SubTask 3.2: `todo-projection.test.ts`：单次调用原样、多次折叠、位置保持、
        无 todo 卡时零开销原样返回
- [x] Task 4: TodoListCard 组件 + 样式（界面对齐 WorkBuddy）
  - [x] SubTask 4.1: `chat-view.tsx` 接入投影（groupTurnBlocks 之后/之内应用），
        todo_write 卡改由 TodoListCard 渲染：三态 glyph、activeForm、加粗/删除线、
        窗口化 5 条锚定 in_progress、最新内容默认展开
  - [x] SubTask 4.2: 生成期占位「接收中…」渲染
  - [x] SubTask 4.3: `index.css`：对齐 cr-tool-plan-task 浅色主题（删除线 rgba(0,0,0,0.3)、
        spinner #0cbf5b 旋转、12px 空心圆、展开盒 max-height 300px 灰底圆角细滚动条）
- [x] Task 5: 白名单与资源
  - [x] SubTask 5.1: `resources/modes/craft.md`、`resources/modes/expert.md` 的 tools 加 todo_write
  - [x] SubTask 5.2: 若 agents.test.ts 等存在白名单断言，同步更新
- [x] Task 6: 收尾验证
  - [x] SubTask 6.1: `npm run typecheck && npm run check:deps && npm test` 全绿
  - [x] SubTask 6.2: 更新 `docs/workbuddy对齐清单.md` L6 行与顶部计数

# Task Dependencies

- Task 2 依赖 Task 1（todos 结构来自工具契约）
- Task 3 依赖 Task 2（投影消费 ToolCard.todos）
- Task 4 依赖 Task 3（组件渲染投影结果）
- Task 5 与 Task 1-4 无依赖，可并行
- Task 6 依赖全部
