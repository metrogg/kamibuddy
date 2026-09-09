# Tasks

- [x] Task 1: 左侧边栏视图约束与默认值
  - [x] 1.1 App.tsx：`sidebarOpen` 初始值 `true` → `false`（注释写为什么：首页是引导页，WorkBuddy 的侧边栏属于对话任务场景）
  - [x] 1.2 App.tsx：Sidebar 渲染条件加 `view === "chat"`（`{view === "chat" && sidebarOpen && ...}`）；确认 home/skills/settings/diagnostics 视图都不受影响
- [x] Task 2: 开关图标挪位（chat-view.tsx + App.tsx，一次改动完成避免冲突）
  - [x] 2.1 chat-view.tsx：从 chat-header 移除 IconPanelRight 按钮（原行尾）与 IconPanelLeft 的原位置；左栏开关（IconPanelLeft + onToggleSidebar）挪到 chat-header 首位（返回按钮之前），作为窗口左上角图标
  - [x] 2.2 App.tsx：右面板开关（IconPanelRight + onTogglePanel）移到 App 层 JSX——作为 `.app` 内常驻元素 absolute 钉窗口右上角；z-index 高于面板全屏态（>30）；确认 panelOpen 任何状态下按钮位置不动
  - [x] 2.3 index.css：新增右上角开关定位样式（含 hover 态）；chat-header 左侧新首位图标样式对齐现有 header 按钮风格
  - [x] 2.4 边界核对：面板关闭时按钮可打开面板（不在 ArtifactPanel 内部——组件卸载后按钮不能消失）；侧边栏关闭时左开关仍可见（不在 Sidebar 内部）；home 视图下右上角开关显示（与 panelOpen 现有渲染范围一致，按钮无条件渲染，JSX 注释说明取舍）
- [x] Task 3: 验证
  - [x] 3.1 `npm run typecheck && npm run check:deps && npm test` 全绿（39 文件 / 557 用例；验证子代理 10/10 代码级检查项通过）
  - [ ] 3.2 手测（用户执行）：启动首页无侧栏全宽 → 发消息进 chat，侧栏默认关 → 左上角开关展开侧栏 → 右上角开关开合面板且图标原位不动 → 面板全屏态开关仍可点

# Task Dependencies
- Task 2 与 Task 1 都碰 App.tsx，建议同一子代理串行完成
- Task 3 最后执行
