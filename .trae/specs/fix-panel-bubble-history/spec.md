# 右侧面板常态可展开 + 用户气泡宽度对齐 + 历史会话产物恢复 Spec

## Why

对比 WorkBuddy 截图与用户实测，KamiBuddy 在三个交互/数据层面存在差距：① **右侧面板不能常态展开**——现在只有 `previewActive` 有值（点过产物/有交付）才渲染，WorkBuddy 没文件也能展开（显示"暂无内容"）；② **用户气泡太短**——`max-width: calc(100% - 32px)` 让长消息几乎占满宽，WorkBuddy 的用户气泡明显更短（约 70% 宽）；③ **历史会话回看时交付的产物卡消失**——`artifacts_presented` 是运行时事件不落盘，恢复会话时 reducer 清空 `artifacts`，导致之前交付的文件在历史里看不到。

## What Changes

**A. 右侧面板常态可展开（无文件也能开）**
- 面板渲染条件从 `previewActive !== undefined && panelOpen` 改为 `panelOpen`——只要用户点开就渲染，无激活项时显示空态（概览菜单 + "暂无内容"占位，WorkBuddy 同款）
- 空态内容：概览菜单可点开（产物/变更/工作区文件三组，无内容的分组显示"暂无"），主体区显示"选择文件以预览"占位文案
- 头部面板开关保持常态可见；有产物交付时自动展开面板（`artifacts_presented` 事件里 `panelOpen` 置 true）

**B. 用户气泡最大宽度对齐 WorkBuddy**
- `max-width: calc(100% - 32px)` 改为 `max-width: 70%`（WorkBuddy `_userMessageWrapper` 的实际呈现口径：气泡明显短于消息流宽，长消息折行而非占满）
- padding/font-size/line-height 保持现值（已对齐 8/12、13px、19px）

**C. 历史会话产物恢复（回看时产物卡还在）**
- `artifacts_presented` 事件持久化：daemon 在 `artifacts_presented` 事件触发时把产物清单写入会话文件（pi SessionManager 的 custom 条目或独立字段），恢复会话时重建进 reducer 的 `artifacts`
- 恢复路径：`session-rebuild.ts` 的 `buildConversationEntries` 产出 `artifacts_presented` 条目（或 daemon 恢复时单独读取持久化的产物清单合并进初始 view），保证历史会话回看时产物卡与交付时的状态一致

## Impact

- Affected specs：产物预览面板交互、用户消息气泡、会话恢复
- Affected code：
  - `src/renderer/App.tsx`（面板渲染条件、`artifacts_presented` 时自动展开）
  - `src/renderer/artifact-panel.tsx`（空态渲染）
  - `src/renderer/index.css`（用户气泡 max-width）
  - `src/core/session-host.ts`（artifacts_presented 持久化）
  - `src/core/session-rebuild.ts`（恢复时重建 artifacts）
  - `src/shared/session-events.ts`（如恢复用条目类型有变化）
- **C 涉及会话文件持久化格式**：需确认 pi SessionManager 是否支持自定义条目（custom entry）写产物清单；不支持则降级为"恢复时不显示历史产物卡"并在 spec 记录决策。

## ADDED Requirements

### Requirement: 右侧面板常态可展开

系统 SHALL 让右侧预览面板在用户点击头部开关时即展开，无论当前是否有激活的预览文件；无文件时显示空态（概览菜单可交互、主体区"选择文件以预览"占位）。

#### Scenario: 无文件时展开面板
- **WHEN** 会话尚无产物，用户点击头部产物面板开关
- **THEN** 右侧面板展开，显示概览菜单（产物/变更/工作区文件三组，产物与变更显示"暂无"）与"选择文件以预览"占位

#### Scenario: 有产物交付时自动展开
- **WHEN** 模型调用 present_files 交付产物
- **THEN** 面板自动展开（`panelOpen` 置 true），首个本地文件在预览面板打开

### Requirement: 用户气泡最大宽度

系统 SHALL 将用户消息气泡的最大宽度限制为消息流宽的 70%，长消息折行而非占满宽。

#### Scenario: 长消息气泡
- **WHEN** 用户发送一条超过 70% 宽的长消息
- **THEN** 气泡宽度为消息流宽的 70%，内容折行显示

### Requirement: 历史会话产物恢复

系统 SHALL 在恢复历史会话时还原该会话已交付的产物清单（产物卡可见、可点击预览）；若 pi 的会话文件不支持持久化产物清单，则降级为"恢复时不显示历史产物卡"并在 spec/tasks 记录决策。

#### Scenario: 回看历史会话
- **WHEN** 用户打开一个之前交付过产物的历史会话
- **THEN** 产物卡正常显示，点击可在右侧面板预览（与交付时状态一致）

## MODIFIED Requirements

### Requirement: 面板渲染条件

**原**：`previewActive !== undefined && panelOpen`（无激活文件时面板不渲染）。
**新**：`panelOpen`（有/无激活文件都渲染，无文件时显示空态）。

### Requirement: 用户气泡宽度

**原**：`max-width: calc(100% - 32px)`（长消息几乎占满宽）。
**新**：`max-width: 70%`（WorkBuddy 口径，长消息折行）。

## REMOVED Requirements

无。
