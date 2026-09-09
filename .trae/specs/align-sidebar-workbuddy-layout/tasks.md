# Tasks

- [x] Task 1: 左侧边栏常驻 + 左开关挪 App 层左上角
  - [x] 1.1 App.tsx：Sidebar 渲染条件 `{view === "chat" && sidebarOpen && ...}` → `{sidebarOpen && ...}`（视图无关，常驻）；`sidebarOpen` 初始值 `false` → `true`（默认展开）
  - [x] 1.2 chat-view.tsx：从 chat-header 首位移除左栏开关（恢复原结构，行尾开关已在上版移除）
  - [x] 1.3 App.tsx：左栏开关（IconPanelLeft + onToggleSidebar）在 App 层 JSX 渲染——absolute 钉窗口左上角，sidebar 收起时仍可见可点（不放进 Sidebar 组件内部）；样式对齐现有按钮语言
  - [x] 1.4 index.css：左上角开关定位样式；chat-header 如有多余让位样式则清理
- [x] Task 2: 右侧预览面板仅对话视图
  - [x] 2.1 App.tsx：ArtifactPanel 渲染条件加 `view === "chat"`（`{view === "chat" && panelOpen && ...}`）；右面板开关按钮同步加 `view === "chat"` 条件
  - [x] 2.2 确认 home 视图下右上角无右面板开关、无空面板
- [x] Task 3: 验证
  - [x] 3.1 `npm run typecheck && npm run check:deps && npm test` 全绿（42 文件 / 582 用例；验证子代理逐项通过）
  - [ ] 3.2 手测（用户执行）：首页左侧栏常驻 + 无右面板 → 左上角开关收起/展开左侧栏 → 进 chat 后右侧有面板 + 右上角开关原位开合 → 全屏态开关可点

# Task Dependencies
- Task 1 与 Task 2 都碰 App.tsx，同一子代理串行完成
- Task 3 最后执行
