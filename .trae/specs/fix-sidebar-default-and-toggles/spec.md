# 侧边栏默认态与开关图标位置修复 Spec

## Why

三个侧边栏相关的 UI bug（对标 WorkBuddy 的行为）：

1. **左侧边栏在首页（新建任务页）默认打开**：`sidebarOpen` 初始值是 `true`（App.tsx:278）且渲染条件只看 `sidebarOpen` 不看视图（App.tsx:594）。首页本应是一个干净的引导页——WorkBuddy 的新建任务页没有侧边栏，侧边栏属于对话任务场景。
2. **左右开关图标位置与 WorkBuddy 不对齐**：两个开关按钮目前并排挤在 chat 顶栏（`.chat-header`）的行尾（chat-view.tsx:877-894，被 `.chat-title` 的 flex:1 推到最右）。WorkBuddy 的布局是：左栏开关在窗口左上角（返回/标题之前），右面板开关在窗口右上角（与搜索/历史等图标同一行）。
3. **点击右面板开关后图标跟着面板跑**：开关按钮在 `.chat-header` 行尾，属于主区（`.chat` 是 flex:1）；面板挂载时主区宽度被压缩，按钮随之水平滑移（`.preview-panel` 有 0.24s width transition，观感是「跟着面板过来」）。开关应当常驻窗口右上角原位。附带问题：面板全屏态（z-index:30 absolute 覆盖全窗）会盖住按钮导致无法点击退出全屏——常驻定位一并解决。

## What Changes

- **App.tsx**：
  - 侧边栏渲染条件加视图约束：只在 `view === "chat"` 且 `sidebarOpen` 时渲染 Sidebar（首页/设置/诊断等视图不渲染）
  - `sidebarOpen` 初始值改为 `false`（默认关闭）
  - 右面板开关按钮移到 App 层布局：absolute 钉窗口右上角，`z-index` 高于面板全屏态（>30），无论面板开合按钮位置不动
- **chat-view.tsx**：从 `.chat-header` 移除两个开关按钮；左栏开关挪到 chat-header 首位（返回按钮之前，窗口左上角）
- **index.css**：新增右上角常驻开关的定位样式；调整 chat-header 相关样式

**不改**：`panelOpen` 默认值（保持 true——近期会话刚定的「panelOpen 即渲染，无文件时空态」决策，本 spec 不翻案）；Sidebar / ArtifactPanel 组件内部结构；会话/面板的业务逻辑。

注：行号为调研快照，App.tsx 近期有并行改动（isTempTask 重构），实现时按语义定位。

## Impact

- Affected code:
  - [App.tsx](file:///d:/DongProject/kamibuddy/src/renderer/App.tsx)（sidebarOpen 初始值与渲染条件、右开关移入 App 层）
  - [chat-view.tsx](file:///d:/DongProject/kamibuddy/src/renderer/chat-view.tsx)（header 两个开关按钮的挪出/挪位）
  - [index.css](file:///d:/DongProject/kamibuddy/src/renderer/index.css)（定位样式）
- 不触碰 shared 契约、core、daemon、documents（纯 renderer 布局调整）

## ADDED Requirements

### Requirement: 左侧边栏仅在对话视图中可开合

左侧边栏 SHALL 只在对话视图（view === "chat"）渲染；默认状态为关闭。首页（新建任务页）不渲染侧边栏，也无其开关入口。

#### Scenario: 启动进入首页
- **WHEN** 应用启动（view = home）
- **THEN** 左侧边栏不显示，页面为全宽引导页

#### Scenario: 新建任务回到首页
- **WHEN** 用户在对话中点「新建任务」回到首页
- **THEN** 左侧边栏随视图切换消失

#### Scenario: 进入对话视图
- **WHEN** 用户从首页发送消息或恢复历史会话（view = chat）
- **THEN** 侧边栏默认关闭，可通过左上角开关展开；用户手动展开后本次会话期间保持该偏好（现有 state 语义不变）

### Requirement: 开关图标位置对齐 WorkBuddy

左栏开关 SHALL 位于窗口左上角（chat 顶栏首位，返回按钮之前）；右面板开关 SHALL 常驻窗口右上角，位置固定。

#### Scenario: 左上角开关
- **WHEN** 用户在对话视图查看顶栏
- **THEN** 左栏开关是顶栏第一个图标（在返回按钮之前），点击开合左侧边栏

#### Scenario: 右上角常驻开关
- **WHEN** 用户在对话视图开合右侧预览面板
- **THEN** 右面板开关钉在窗口右上角原位不动（面板展开/收起/拖拽都不推移它），点击开合面板

#### Scenario: 面板全屏态
- **WHEN** 预览面板进入全屏覆盖态
- **THEN** 右上角开关仍可见可点（z-index 高于全屏面板），可点击退出全屏（附带的可用性修复）
