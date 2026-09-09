# Tasks

- [x] Task 1: 视图状态机纯函数（panel-view.ts）
  - [x] 1.1 新 `src/renderer/panel-view.ts`：`PanelView = "overview" | "workspace" | "changes"`；`BodyMode = "list" | "preview"`；状态 `{ view, mode }` 与迁移函数——`selectView(state, view)`（任何态 → 列表态该视图）、`openPreview(state)`（→ 预览态，view 不变）、`closeLastTab(state)`（→ 列表态，view 不变）、`closeTab(state)`（还有剩余 tab → 预览态不变）
  - [x] 1.2 `panel-view.test.ts`：全部迁移分支（含预览态切视图 tabs 保留语义、关最后一个 tab 回列表态）

- [x] Task 2: artifact-panel.tsx 重构
  - [x] 2.1 头部：概览下拉按钮改为视图切换器（当前视图名 + chevron；菜单三平级项 + 当前 ✓）
  - [x] 2.2 三视图内容组件：概览（产物折叠组，条目行为沿用现 OverviewMenu 的 pick/pin/外部打开/大小显示）、变更（汇总头「文件变更 +N -M」合计 + 列表 +/- 徽章）、工作空间文件（现懒加载树原样搬入，打开视图时拉取——现「打开下拉时拉一次」改为「切到该视图时拉一次」）
  - [x] 2.3 主体双态接线：列表态 ↔ 预览态按 1.1 状态机；点条目进预览（沿用 sameSelection/pick/pin）；关最后一个 tab 回列表态；删除旧 OverviewMenu 三组内嵌结构（无残留）
  - [x] 2.4 空态：概览无产物显示「暂无内容」；变更无内容显示「本会话还没有变更」；工作区未就绪占位沿用

- [x] Task 3: 样式（index.css）
  - [x] 3.1 切换器菜单（三平级项 + ✓ 对齐 WorkBuddy 截图 2 的菜单形态）
  - [x] 3.2 变更汇总头（「文件变更 +N -M」，+ 绿 - 红沿用工具卡口径）与三视图内容区布局

- [x] Task 4: 回归验证
  - [x] 4.1 `npm run typecheck && npm run check:deps && npm test` 全绿（653 个测试，独立复跑确认）
  - [ ] 4.2 冒烟（用户重启后）：切换器三视图切换、概览产物组、变更汇总头计数、工作区树、点条目进预览、切视图回列表 tabs 保留、关 tab 回列表

# Task Dependencies

- Task 2 依赖 Task 1（状态机先行）；Task 3 与 Task 2 文件交集小但同视图区域，建议同一 agent 顺序完成 2+3
- Task 4 依赖 Task 1-3 全部完成
