# 对话界面消息流对齐 WorkBuddy（assistant 无气泡 + 头部面板开关）Spec

## Why

对比 WorkBuddy 同任务截图，KamiBuddy 对话界面在消息流与头部交互上存在系统性差距：① **assistant 消息被包成了气泡**（`index.css:1156-1159` 的 `.entry.assistant { background: var(--bg-raised) }`），而 WorkBuddy 的 assistant 是无气泡纯文本流——这是"agent 说话不需要气泡"的直接根因；② **头部没有常态的侧栏展开/收起按钮**——WorkBuddy 右上角有产物面板开关（收起时面板完全隐藏、消息流占满宽），我们希望左右两侧都支持；③ 用户气泡/assistant 消息的排版与 WorkBuddy 有出入（assistant 无气泡后，padding/max-width/字号需对齐纯文本流口径）。

## What Changes

**A. assistant 消息去气泡（核心修复）**
- 删掉 `.entry.assistant` 的气泡背景与圆角（`background: var(--bg-raised)` 与继承自 `.entry` 的 `border-radius: 12px`）——assistant 回归无气泡纯文本流，与 WorkBuddy 一致
- assistant 消息排版对齐 WorkBuddy 纯文本流口径：padding 0（无气泡后不需要内边距）、字号 14px / 行高 20px（WorkBuddy `_assistantMessageContent` 原参数）、max-width 保持 760px（`.stream > *` 现有限宽保持）
- 用户气泡保持不变（已是右侧气泡，WorkBuddy 同款）

**B. 头部面板开关（常态展开/收起）**
- chat-header 右侧加两个图标按钮：
  - **产物面板开关**（右侧面板）：点击切换预览面板的展开/收起；收起时面板完全隐藏（不是只关 tab），消息流占满宽；面板有激活 tab 时按钮显示"激活"态（WorkBuddy 同款常态按钮）
  - **侧栏开关**（左侧栏）：点击切换左侧栏的展开/收起；收起时左侧栏完全隐藏，消息流左移占满宽
- 两个开关都是**常态按钮**（不只在有产物时才出现），点击即时切换、无动画或 240ms 宽度过渡（与面板拖拽过渡一致）

**C. 消息流细节对齐**
- assistant 消息与 turn-header 的间距：无气泡后 turn-header 贴齐消息正文左缘（现 margin 已是 14px，去气泡后保持）
- 思考块/工具卡/MetaFold 行：assistant 无气泡后这些行内元素保持现有左对齐，不额外加气泡包裹

## Impact

- Affected specs：对话界面消息流、头部交互
- Affected code：
  - `src/renderer/index.css`（assistant 去气泡、排版参数、头部按钮）
  - `src/renderer/chat-view.tsx`（头部加两个面板开关按钮）
  - `src/renderer/App.tsx`（侧栏展开/收起状态、产物面板展开/收起状态与现有 previewActive 的关系）
- 不改契约、不改 daemon、不改 shared——纯渲染层。

## ADDED Requirements

### Requirement: assistant 消息无气泡

系统 SHALL 将 assistant 消息渲染为无气泡纯文本流：无背景色、无圆角、padding 0、字号 14px / 行高 20px。用户消息保持右侧气泡不变。

#### Scenario: assistant 消息呈现
- **WHEN** 模型输出一段回复
- **THEN** 该回复以纯文本流呈现（无气泡背景），左侧与 turn-header 对齐

#### Scenario: 用户消息保持气泡
- **WHEN** 用户发送一条消息
- **THEN** 该消息仍以右侧气泡呈现（圆角 16/16/0/16、背景 --bg-raised）

### Requirement: 产物面板常态开关

系统 SHALL 在 chat-header 右侧提供产物面板开关按钮：点击切换预览面板的展开/收起；收起时面板完全隐藏，消息流占满宽；按钮常态可见（不只产物存在时）。

#### Scenario: 收起产物面板
- **WHEN** 预览面板展开时用户点击产物面板开关
- **THEN** 面板完全隐藏，消息流占满宽；再次点击恢复展开（保持之前的 tab 与激活项）

#### Scenario: 无产物时也可开关
- **WHEN** 会话尚无产物，用户点击产物面板开关
- **THEN** 面板收起（隐藏），消息流占满宽；后续有产物交付时面板保持收起状态，直到用户再点开

### Requirement: 左侧栏常态开关

系统 SHALL 在 chat-header 右侧提供侧栏开关按钮：点击切换左侧栏的展开/收起；收起时左侧栏完全隐藏，消息流左移占满宽；按钮常态可见。

#### Scenario: 收起左侧栏
- **WHEN** 左侧栏展开时用户点击侧栏开关
- **THEN** 左侧栏完全隐藏，消息流左移占满宽；再次点击恢复展开

## MODIFIED Requirements

### Requirement: assistant 消息样式

**原**：`.entry.assistant { background: var(--bg-raised) }`（气泡背景 + 继承的圆角 12px）。
**新**：无背景、无圆角、padding 0、字号 14px / 行高 20px——纯文本流。

## REMOVED Requirements

无。
