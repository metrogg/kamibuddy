# 侧边栏布局重新对齐 WorkBuddy Spec

## Why

上一版修复（`fix-sidebar-default-and-toggles`）把左侧边栏错误地约束为「只在 chat 视图渲染」，导致用户在首页看不到左侧栏、也找不到展开按钮。WorkBuddy 的真实布局是：**左侧边栏常驻**（首页和对话页都有，含任务列表、空间分组、用户区），**右侧预览面板只在对话任务里才有**。上一版同时让右侧面板在首页也渲染了（`panelOpen` 无视图条件），首页因此右侧凭空多出一块空面板。

## What Changes

- **App.tsx**：
  - Sidebar 渲染条件回退为 `sidebarOpen`（不再约束 view）——左侧边栏在首页和对话页都常驻
  - `sidebarOpen` 初始值回退为 `true`（默认展开，WorkBuddy 同款）
  - ArtifactPanel 渲染条件加 `view === "chat"`——右侧预览面板只在对话任务里出现
  - 右面板开关按钮渲染条件同步加 `view === "chat"`（面板只在 chat 有，开关也只在 chat 显示）
- **chat-view.tsx**：左栏开关从 chat-header 首位移除，挪到 App 层左上角（sidebar 收起时可见可点）——WorkBuddy 的左侧栏开关是常驻窗口左上角的，不属于 chat 顶栏
- **home-view.tsx**：首页不需要任何侧边栏相关改动（左侧栏由 App 层渲染）
- **index.css**：左上角左开关定位样式（absolute 钉窗口左上角）；chat-header 恢复原有结构（无左开关首位占位）

**关键决策**：左侧栏开关放 App 层而非 Sidebar 组件内部——Sidebar 收起时组件卸载，按钮会消失。WorkBuddy 的做法是按钮常驻窗口左上角（独立于 sidebar 开合状态）。

## Impact

- Affected code: [App.tsx](file:///d:/DongProject/kamibuddy/src/renderer/App.tsx)、[chat-view.tsx](file:///d:/DongProject/kamibuddy/src/renderer/chat-view.tsx)、[index.css](file:///d:/DongProject/kamibuddy/src/renderer/index.css)
- 不触碰 shared 契约、core、daemon、documents

## ADDED Requirements

### Requirement: 左侧边栏常驻

左侧边栏 SHALL 在首页和对话页都渲染，默认状态为展开。用户可在任意视图通过左上角开关收起/展开。

#### Scenario: 启动进入首页
- **WHEN** 应用启动（view = home）
- **THEN** 左侧边栏显示（任务列表、空间分组、用户区），左侧为主内容区

#### Scenario: 进入对话视图
- **WHEN** 用户发送消息或恢复历史会话
- **THEN** 左侧边栏保持显示（开合状态跨视图保留）

#### Scenario: 收起/展开左侧栏
- **WHEN** 用户点击左上角左侧栏开关
- **THEN** 左侧栏收起（宽度收窄为图标栏）或展开；开关按钮在 sidebar 收起时仍可见可点

### Requirement: 右侧预览面板仅在对话视图

右侧预览面板 SHALL 只在对话视图（view === "chat"）渲染；首页不渲染右侧面板，也无其开关入口。

#### Scenario: 首页无右侧面板
- **WHEN** 用户在首页
- **THEN** 右侧无预览面板，主内容区全宽

#### Scenario: 对话视图右侧面板
- **WHEN** 用户在对话视图
- **THEN** 右侧面板存在（默认展开），右上角开关可开合；面板全屏态开关仍可点

## MODIFIED Requirements

（覆盖 `fix-sidebar-default-and-toggles` spec 中的以下两项）

### Requirement: 左侧边栏仅在对话视图中可开合 → 左侧边栏常驻
原实现：`view === "chat" && sidebarOpen`（首页无侧栏）。
修正为：`sidebarOpen`（视图无关，常驻），初始值 true。

### Requirement: 开关图标位置对齐 WorkBuddy → 左开关常驻左上角
原实现：左开关在 chat-header 首位。
修正为：左开关在 App 层窗口左上角（常驻，sidebar 收起时仍可见）。
