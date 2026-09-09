# 预览面板交互升级 + 产物卡网格 + 消息流细节对标 WorkBuddy Spec

## Why

对比 WorkBuddy 同任务截图，KamiBuddy 在三个交互层面存在可见差距：① 右侧预览面板固定 42% 宽，不可拖拽调宽、不可全屏——WorkBuddy 支持 sash 拖拽（340-800px）+ 一键全屏，产物预览的可用性差距直接可见；② 产物卡是单列列表、无聚合入口——WorkBuddy 是两列网格 + 「查看所有产物(N)/变更(N)」文字按钮；③ 用户气泡/assistant 消息的排版细节（padding、字号、行高）与 WorkBuddy 有出入。用户已确认本次覆盖这三项（不做全套 design token 对标）。

## What Changes

**A. 预览面板可拖拽调宽 + 全屏**（对齐 WorkBuddy `colleague-artifact-provider` 的实现口径）
- 面板宽度从固定 `flex: 0 0 42%` 改为状态驱动的 px 宽度（默认 440px），左缘加 4px 拖拽手柄（sash）
- 拖拽调宽：mousedown 记录起点与起始宽，mousemove 更新宽度，clamp 到 [340, 800]px；拖拽时 body cursor=col-resize、user-select=none
- 全屏切换：面板头部加全屏按钮（与外部打开并列），点击后面板宽度撑满主内容区（absolute 定位覆盖，z-index 高于消息流）；再次点击/ Esc 退回默认宽
- 宽度过渡：width 240ms ease（WorkBuddy 同参数），prefers-reduced-motion 时禁用
- 展开/收起保留（现有逻辑），新增全屏态

**B. 产物卡网格 + 聚合入口**
- 产物卡区改两列网格（`grid-template-columns: 1fr 1fr`，单产物时独占一行）；卡内：文件图标 + 文件名 + 大小，HTML 卡右上角加 🌐 预览按钮（点击在面板打开，不触发整卡点击）
- 卡区下方加「查看所有产物 (N)」「查看所有变更 (N)」两个文字按钮（三级灰、右箭头），点击打开预览面板并展开概览菜单对应分组
- 产物卡样式对齐 WorkBuddy：圆角 8px、hover 背景、字号 13px

**C. 消息流细节对齐**
- 用户气泡：padding 8px 12px（现 10px 14px）、字号 13px / 行高 19px（现继承 body 14px）、max-width `calc(100% - 32px)` 保持、气泡背景 `--bg-raised` 保持
- assistant 消息确认无气泡（已是无气泡纯文本流，本次仅确认不改动）
- 用户气泡 hover 工具条位置微调（气泡下方 4px，现实现已接近，细节对齐）

## Impact

- Affected specs：产物预览面板交互、产物卡呈现、消息流排版
- Affected code：
  - `src/renderer/App.tsx`（面板宽度状态、全屏状态、sash 拖拽逻辑）
  - `src/renderer/artifact-panel.tsx`（全屏按钮、概览菜单默认展开分组）
  - `src/renderer/chat-view.tsx`（产物卡网格、聚合入口、🌐按钮）
  - `src/renderer/index.css`（面板宽度/拖拽手柄/全屏覆盖/产物卡网格/用户气泡字号行高）
- 不改契约、不改 daemon、不改 shared——纯渲染层。

## ADDED Requirements

### Requirement: 预览面板可拖拽调宽

系统 SHALL 在预览面板左缘提供 4px 拖拽手柄：mousedown 开始拖拽，mousemove 实时更新面板宽度，clamp 到 [340, 800]px，mouseup 结束。拖拽过程中 body cursor 为 col-resize、user-select 为 none。

#### Scenario: 拖拽调宽
- **WHEN** 用户在预览面板左缘按下并向左拖动 100px
- **THEN** 面板宽度从 440px 变为 540px；松手后保持

#### Scenario: 拖拽到边界
- **WHEN** 用户把面板拖到最窄
- **THEN** 宽度不小于 340px；拖到最宽不大于 800px

### Requirement: 预览面板全屏切换

系统 SHALL 在预览面板头部提供全屏按钮：点击后面板以 absolute 定位覆盖主内容区（宽度=父容器宽），z-index 高于消息流；再次点击或按 Esc 退出全屏回到拖拽后的宽度。全屏切换有 240ms ease 宽度过渡（prefers-reduced-motion 时禁用）。

#### Scenario: 进入全屏
- **WHEN** 用户点击全屏按钮
- **THEN** 面板宽度动画撑满主内容区，消息流被覆盖；全屏按钮变为退出全屏图标

#### Scenario: Esc 退出全屏
- **WHEN** 面板全屏时用户按 Esc
- **THEN** 面板动画退回全屏前的宽度

### Requirement: 产物卡两列网格

系统 SHALL 将产物卡区渲染为两列网格；单个产物时独占一行。HTML 产物卡右上角提供预览按钮（🌐 图标），点击在预览面板打开该文件且不触发整卡点击。

#### Scenario: 两个产物
- **WHEN** 会话产出 2 个文件
- **THEN** 两张卡并排一行显示

#### Scenario: HTML 卡预览按钮
- **WHEN** 用户点击 HTML 产物卡的 🌐 按钮
- **THEN** 预览面板打开该文件，但不触发整卡的点击行为（不重复打开）

### Requirement: 产物/变更聚合入口

系统 SHALL 在产物卡区下方提供「查看所有产物 (N)」「查看所有变更 (N)」两个文字按钮（三级灰 12px、右箭头、N 为实际数量）；点击打开预览面板并展开概览菜单的对应分组。

#### Scenario: 点击查看所有产物
- **WHEN** 用户点击「查看所有产物 (3)」
- **THEN** 预览面板打开，概览菜单展开「产物」分组

### Requirement: 用户气泡排版对齐

系统 SHALL 将用户消息气泡的排版参数对齐 WorkBuddy：padding 8px 12px、字号 13px、行高 19px、max-width calc(100% - 32px)。assistant 消息保持无气泡纯文本流（现状确认，不改动）。

## MODIFIED Requirements

### Requirement: 预览面板宽度

**原**：固定 `flex: 0 0 42%`，min-width 320px。
**新**：状态驱动 px 宽度（默认 440px），sash 拖拽 [340, 800]px，全屏时撑满主内容区。

### Requirement: 产物卡布局

**原**：单列列表（width 100%）。
**新**：两列网格（单产物独占一行），HTML 卡带 🌐 预览按钮。

## REMOVED Requirements

无。
