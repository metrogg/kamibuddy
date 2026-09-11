# Tasks

- [x] Task 1: web_search 结构化 results
  - [x] SubTask 1.1: `src/extensions/web-tools.ts`：web_search 的 details 从 `{ count }`
        扩充为 `{ count, results }`（title/url/description/publishedAt?，与文本同源）
  - [x] SubTask 1.2: web-tools 测试同步（details 形状断言）
- [x] Task 2: ToolCard.sources + 两路径填充 + 安全校验
  - [x] SubTask 2.1: `shared/session-events.ts`：导出 `SourceRef`，ToolCard 加可选 `sources`
  - [x] SubTask 2.2: 新增 `src/core/source-parse.ts` 纯函数：从 unknown details 提取
        SourceRef[]（公网 http(s) 校验：禁凭据/localhost/内网 IP；脏项剔除；site 缺省按
        host 去 www. 推导）
  - [x] SubTask 2.3: `session-host.ts`：web_search 的 tool_execution_end 填 sources
        （result.details 可携带——pi types.ts 实证）；`session-rebuild.ts` 恢复路径同逻辑
  - [x] SubTask 2.4: source-parse 单测 + session-host/rebuild 补例
- [x] Task 3: renderer 聚合纯函数
  - [x] SubTask 3.1: `src/renderer/collect-sources.ts`：扫描 entries 的 web_search 卡，
        URL 去重保序聚合；无来源返回空数组
  - [x] SubTask 3.2: `collect-sources.test.ts`：去重、保序、跨卡聚合、空会话
- [x] Task 4: 来源按钮 + SourcesPanel + 互斥接线
  - [x] SubTask 4.1: chat-view 操作行加「来源」按钮（头像组 ≤3 站点去重 + Globe 兜底 +
        计数 tooltip；无来源不渲染；操作行出现条件扩展为产物/变更/来源任一非空）
  - [x] SubTask 4.2: 新增 `sources-panel.tsx`：头「引用来源 (N)」+ 关闭；列表项
        favicon+site+标题1行截断+摘要2行截断；点击 window.open 外部打开
  - [x] SubTask 4.3: App 接线：sourcesOpen 状态（会话切换清空）、与 ArtifactPanel
        同位互斥渲染（打开时强制 panelOpen）
  - [x] SubTask 4.4: `index.css`：按钮头像组负 margin 叠放、面板头 56px、
        列表项圆角 hover、摘要 2 行 clamp（对齐 WorkBuddy 浅色主题与既有 token）
- [x] Task 5: 收尾验证
  - [x] SubTask 5.1: `npm run typecheck && npm run check:deps && npm test` 全绿
  - [x] SubTask 5.2: 对齐清单加 L26 行并更新顶部计数

# Task Dependencies

- Task 2 依赖 Task 1（details 结构来源）
- Task 3 依赖 Task 2（消费 ToolCard.sources）
- Task 4 依赖 Task 3（按钮与面板渲染聚合结果）
- Task 5 依赖全部
