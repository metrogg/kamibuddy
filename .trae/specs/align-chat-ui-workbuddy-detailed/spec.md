# 对话界面整体对齐 WorkBuddy Spec

## Why

用户反馈对话界面「做的仍然不是很好」：工具调用显示会被挤没（bug）、大矩形框一堆、间距乱、动效缺失、图标不细腻。WorkBuddy 的消息流层级细腻（工具调用是小圆角卡片嵌在消息流里，不是通栏大矩形）、间距有节奏（用户消息上下 32px 呼吸感 + 回合内紧凑排列）、动效完整（扫光/折叠展开/消息进入）。本次升级对齐 WorkBuddy 的对话界面。

## What Changes

### P0：工具调用「挤没」bug 修复

**根因**：`.stream` 是 `display: flex; flex-direction: column` 的定高滚动容器，`.entry.tool` 带 `overflow: hidden` 且无 `flex-shrink: 0`——flex 子项默认 `flex-shrink: 1`，`min-height: auto` 对 `overflow: hidden` 的元素计算为 0，内容被压到 0px 裁掉。WorkBuddy 的滚动容器是普通块流（非 flex 纵向），天然无此问题。

**修复**：
- `.entry.tool` 加 `flex-shrink: 0`（或给 `.stream > *` 统一加）
- 更彻底：`.stream` 从 flex 纵向改成普通块流容器（间距改用 margin），根除此类挤压（当前布局下任何新增的 `overflow` 非 visible 直接子项都会复发）

### P1：大矩形框 → 小圆角卡片/单行文本行

- **工具调用卡片**：去掉通栏背景/左边框/圆角（当前是 ≤832px 大矩形），改为 WorkBuddy 的 `.cr-tool-head` 形态——无背景、无边框、纯文本单行：14px/1.75 三级灰 + 14px 工具类型图标 + 状态字（执行中扫光）+ 摘要省略；chevron 平时 opacity 0、hover/展开才现。展开后的内容区独立小圆角盒（radius 16px、max-height 300px、上下小 margin）。
- **MetaFold 折叠行**：去背景/边框/`width:100%`，改 `width: fit-content` 纯文字行（15px/1.75、三级灰、摘要 520px 省略、箭头 hover 浮现），加段首主导工具图标。
- **用户气泡**：padding `32px 16px` → `8px 12px`（32px 是外层消息行的呼吸间距，不是气泡内边距——WorkBuddy 的 `._userMessage` 外层行 32px、气泡自身 8px 12px）。

### P2：间距节奏

- 打破统一 `gap: 12px`：WorkBuddy 的节奏是「用户消息上下 32px 大行距 + 回合内工具行/文本紧凑排列」
- 按块类型给不同外间距：user 前后大、turn 内小；去掉 turn-header 的 `-4px` 反吃 hack

### P3：动效

- **折叠展开动画**：工具详情/折叠单元的高度+透明度+translateY(-6px) 组合过渡（0.28s cubic-bezier(0.33,1,0.68,1)）
- **消息进入**：整列 hydration reveal（opacity 0 → 1 + transform 0.32s 带回弹）
- **底部渐隐 mask**：消息流底部渐隐
- **reduced-motion 覆盖**：tool-pulse/border-ping/task-spin 纳入 `prefers-reduced-motion`
- **执行中指示简化**：去掉整卡 2px outline 脉冲（border-ping），状态全靠扫光表达（WorkBuddy 同款）

### P4：图标体系

- **工具类型图标**：引入 WorkBuddy 的 `tool-icon-registry` 机制——按工具名映射图标（Read→EyeIcon、Write/Edit→PencilIcon、Bash→TerminalIcon、Glob/Grep→SearchIcon、WebFetch/WebSearch→GlobeIcon、DeleteFiles→TrashIcon、Skill→SparkleIcon 等）
- **状态图标**：失败 → FailedIcon 替换工具图标位；执行中隐藏工具图标（状态全靠扫光文字）
- **图标尺寸**：14px（工具行）、16px（折叠头）

### P5：工具调用生成期上屏

- session-host.ts:938 只给 write/edit 发 `tool_stream_started`；扩到 web_search/web_fetch 等长耗时工具，消除执行前的空白窗

### 明确不做（YAGNI）

- **checkpoint 级变更模型**（Revert/Resume/Keep/Discard）：需扩 session-host 的 diff 计算，单独 spec
- **意图摘要**（从工具 args/result 提取对象拼 `{verb} {object}`）：WorkBuddy 的复杂机制，KamiBuddy 现有 `summarizeToolRun` 已够用
- **不可折叠工具谓词**（`unfoldableToolCall`）：业务卡片硬编码不可折叠，KamiBuddy 暂无此类卡片

## Impact

- Affected code:
  - [chat-view.tsx](file:///d:/DongProject/kamibuddy/src/renderer/chat-view.tsx)（工具卡/折叠行/气泡/消息流结构）
  - [index.css](file:///d:/DongProject/kamibuddy/src/renderer/index.css)（工具卡/折叠行/气泡/间距/动效样式）
  - [metafold.ts](file:///d:/DongProject/kamibuddy/src/shared/metafold.ts)（折叠逻辑微调——折叠时机、摘要格式）
  - [icons.tsx](file:///d:/DongProject/kamibuddy/src/renderer/icons.tsx)（工具类型图标新增）
  - [session-host.ts](file:///d:/DongProject/kamibuddy/src/core/session-host.ts)（生成期卡片覆盖面扩展）
  - [conversation.ts](file:///d:/DongProject/kamibuddy/src/shared/conversation.ts)（如折叠状态需要 reducer 配合）
- 不触碰 shared 契约（IPC 通道）、daemon handler、core 业务逻辑（session-host 只改事件翻译）

## ADDED Requirements

### Requirement: 工具调用卡片形态

系统 SHALL 将工具调用从通栏大矩形改为单行文本行（执行中扫光）+ 展开后小圆角内容盒。

#### Scenario: 执行中
- **WHEN** 工具调用执行中
- **THEN** 显示单行：14px 工具图标 + 状态字（扫光）+ 摘要省略；无背景、无边框；chevron hover 浮现

#### Scenario: 完成后
- **WHEN** 工具调用完成
- **THEN** 保持单行（状态字停止扫光）；点击展开后显示小圆角内容盒（radius 16px、max-height 300px）

### Requirement: MetaFold 折叠行形态

系统 SHALL 将 MetaFold 折叠行从通栏矩形改为 fit-content 纯文字行。

#### Scenario: 折叠态
- **WHEN** 回合完成、工具段折叠
- **THEN** 显示：主导工具图标 + 摘要（520px 省略）+ 箭头 hover 浮现；无背景、无边框

### Requirement: 用户气泡紧凑排版

系统 SHALL 将用户气泡 padding 从 `32px 16px` 改为 `8px 12px`，32px 呼吸感挪到外层消息行。

#### Scenario: 用户消息
- **WHEN** 用户发送消息
- **THEN** 气泡自身紧凑（8px 12px）；外层消息行上下 32px 间距

### Requirement: 折叠展开动画

系统 SHALL 为工具详情/折叠单元的高度展开添加过渡动画（0.28s cubic-bezier + opacity + translateY）。

#### Scenario: 展开工具详情
- **WHEN** 用户点击展开工具详情
- **THEN** 内容区从 0 高度展开到目标高度，带 opacity + translateY(-6px)→0 过渡

### Requirement: 工具类型图标

系统 SHALL 按工具名映射图标（Read→Eye、Write→Pencil、Bash→Terminal、Search→Search、Web→Globe 等）。

#### Scenario: 工具调用显示
- **WHEN** 工具调用渲染
- **THEN** 显示对应类型图标（14px）；执行中隐藏图标（状态靠扫光文字）；失败显示 FailedIcon

### Requirement: 生成期卡片上屏

系统 SHALL 为 web_search/web_fetch 等长耗时工具在参数生成期即上屏卡片（消除执行前空白窗）。

#### Scenario: 长耗时工具
- **WHEN** 模型开始生成 web_search 参数
- **THEN** 卡片立即上屏（显示「生成中」状态），不等到 tool_execution_start

## MODIFIED Requirements

### Requirement: 消息流布局
原实现：`.stream` flex 纵向容器 + 统一 `gap: 12px`。
修改为：普通块流容器（margin 间距）+ 按块类型不同外间距（user 前后 32px、turn 内紧凑）。

### Requirement: 工具调用折叠口径
原实现：进行中平铺、完成折叠（metafold.ts 的 inProgress 判断）。
修改为：保持口径，但折叠时机对齐 WorkBuddy——**只有当其之后出现了正文文本（或整轮结束），该段才收起**（正在执行/刚执行的工具始终展开可见）。

## REMOVED Requirements

### Requirement: 整卡 outline 脉冲（border-ping）
**Reason**：WorkBuddy 无此重量级整框脉冲，状态全靠扫光文字表达；整框脉冲加重「大矩形框」观感。
**Migration**：去掉 `.entry.tool` 的 border-ping 动画，执行中指示简化为扫光文字 + 6px 状态点呼吸。
