# 对话页 6 项细节对齐 WorkBuddy Spec

## Why

`fix-panel-bubble-history` 验收时用户确认对话页仍有 6 项细节与 WorkBuddy 未对齐
（2026-09-09 用户逐条确认清单，① 明确「只用复制」，清单明确「还是那六点」）。
其中 4 项与 `align-chat-ui-workbuddy` 批三/批四未完成任务同源（其 Task 10/11/12/14），
本次作为独立聚焦批次落地，并在收尾时同步勾选旧 spec 的对应任务框。

## What Changes

1. **助手回答底部操作条（仅复制）**：助手消息正文下方 hover 浮现操作条，只有一个复制按钮
   （复制 Markdown 源文，成功变对勾 2s）。点赞/点踩/更多不做——点赞点踩是云端上报项
   （`align-chat-ui-workbuddy` 早已排除），其余动作用户明确不要。
2. **对话页输入区模型快捷切换**：把首页已有的 `ModelMenu` 落到对话页 composer-bar
   左侧（PermissionMenu 旁），同一组件同一数据源，零新逻辑。
3. **代码块卡片化**：Markdown 代码块渲染为圆角卡片——头部（语言名 + 复制按钮）+
   body 60vh 限高内部滚动；行内 code 不变。
4. **停止二次确认接入**：`stop-confirm.ts` 状态机早已写好但从未接线——首次点停止/按 Esc
   进入 3s 待确认态（按钮变 Esc 徽章），窗口内再次触发才真正中断，超时复原。
5. **输入历史 + 草稿**：Alt+↑/↓ 翻本进程内已发送消息（纯文本），首次上翻暂存当前草稿、
   翻回最新后再按 Alt+↓ 恢复草稿；输入草稿按 sessionId 保存，视图切换后还原。
6. **字数限制与余量**：输入上限 10 万字符；剩余 <1000 时 composer-bar 右侧显示余量
   （等宽数字），超限变红且禁发（按钮 disabled + submit 双闸）。

**明确不做**（用户确认「还是那六点」，以下旧 spec 剩余项不在本批）：
非默认模式 chip（旧 Task 13）、用户消息编辑重发（旧 Task 15）、压缩分隔线（旧 Task 17）、
toast 体系升级（旧 Task 18）、消息流底部免责声明（旧 Task 19）。

## Impact

- Affected specs：`align-chat-ui-workbuddy`（本批落地后同步勾选其 tasks.md 的 Task 10/11/12/14）
- Affected code（**全部在 renderer，零契约/daemon/shared 变更**）：
  - `src/renderer/chat-view.tsx`（①④⑤⑥ 的落点 + ②的接线）
  - `src/renderer/markdown.tsx`（③ 代码块卡片化）
  - `src/renderer/index.css`（①③ 的新样式 + ②⑥ 的 composer 区样式）
  - `src/renderer/stop-confirm.ts`（④ 已有纯函数，仅接线 + 补测试）
  - 新增 `src/renderer/input-history.ts`（⑤ 历史导航纯函数）与对应测试
- 依赖方向：纯渲染层改动，天然满足 AGENTS.md §1（renderer 只 import shared）。

## ADDED Requirements

### Requirement: 助手回答底部操作条（复制）

系统 SHALL 在每条助手消息正文下方渲染操作条：常驻 DOM 占位、hover 时切透明度浮现
（与 UserBubble 工具条同一模式——hover 才插入 DOM 会引发布局抖动，见 UserBubble 注释）。
操作条只含一个复制按钮：点击把该条消息的 Markdown 源文写入剪贴板，成功图标变对勾 2 秒
（复用现有 useCopyWithTick 节奏）。

#### Scenario: 复制助手回答
- **WHEN** 用户 hover 一条助手消息并点击操作条的复制按钮
- **THEN** 该消息的 Markdown 源文进入剪贴板，图标变对勾 2 秒后复原

#### Scenario: 不打扰阅读
- **WHEN** 用户未 hover 助手消息
- **THEN** 操作条不可见但占位存在（透明度 0），消息间距不随 hover 跳动

### Requirement: 对话页输入区模型快捷切换

系统 SHALL 在对话页 composer-bar 左侧（PermissionMenu 旁）渲染与首页同一个 `ModelMenu`
组件：显示当前模型短名，点击展开可用模型弹层（每次展开重拉 settingsSnapshot），
选中即调 `setModel`（daemon 推 session_state 单向刷新，无本地回写）。弹层向上展开、
左对齐（与 PermissionMenu 同理由：300px 弹层贴右放会溢出窗口右缘）。

#### Scenario: 对话中换模型
- **WHEN** 用户在对话页输入区点击模型名并选中另一个可用模型
- **THEN** 下一条消息起使用新模型，按钮文案经 session_state 推送自动刷新

### Requirement: 代码块卡片化

系统 SHALL 将 Markdown 围栏代码块渲染为卡片：圆角容器 + 头部（左侧语言名，
取自 `language-xxx` className，无语言时显示「text」；右侧复制按钮）+ body 限高 60vh
内部滚动。复制内容为代码块纯文本（不含行号/语言标记），成功变对勾 2s。行内 code 样式不变。

#### Scenario: 长代码块
- **WHEN** 模型输出一个 200 行的代码块
- **THEN** 卡片 body 内部滚动，消息流不被撑长；点头部复制按钮带走完整代码

### Requirement: 停止二次确认

系统 SHALL 将 `stop-confirm.ts` 状态机接入对话页：流式期间首次点击停止按钮或按 Esc
进入 3 秒待确认态（按钮内容变 Esc 徽章，tooltip 提示再次确认）；窗口内再次触发才调
`onAbort`，超时自动复原。Esc 接线在 autocomplete 之后（`defaultPrevented` 则不插手），
且仅在流式期间生效。

#### Scenario: 误触保护
- **WHEN** 流式期间用户单击停止后未再确认
- **THEN** 3 秒后按钮复原，生成继续不受影响

#### Scenario: 确认中断
- **WHEN** 待确认态 3 秒内用户再次点击停止（或再按 Esc）
- **THEN** 调 onAbort 中断当前 run，状态回到 idle

### Requirement: 输入历史与草稿

系统 SHALL 支持 Alt+↑/↓ 翻阅本进程内已发送消息（仅文本，发送成功时记录；
模块级存储，视图切换不丢）：首次上翻时暂存当前草稿，翻到最新位置后再按一次 Alt+↓
恢复暂存的草稿。系统 SHALL 按 sessionId 保存输入草稿（模块级 Map，onChange 写入），
ChatView 重新挂载（视图切换 chat↔home↔settings）后按当前 sessionId 还原。
历史导航纯函数化（不依赖 React）并配单测；与 autocomplete 的按键顺序：
ac 先行消费，`defaultPrevented` 时历史导航不插手。

#### Scenario: 翻历史后恢复草稿
- **WHEN** 用户输入半截草稿后 Alt+↑ 翻出旧消息，再 Alt+↓ 一路到底
- **THEN** 再按一次 Alt+↓ 恢复翻历史前的半截草稿

#### Scenario: 视图切换还原草稿
- **WHEN** 用户在对话页输入半截文字，切到设置页再切回
- **THEN** 输入框仍显示之前的半截文字（按当时会话的 sessionId 还原）

### Requirement: 字数限制与余量

系统 SHALL 限制输入 10 万字符：剩余 <1000 字符时在 composer-bar 右侧显示余量
（等宽数字）；超限时数字变红、发送按钮禁用且 `submit()` 内再拦一道（双闸）。
显示判定纯函数化并配单测。

#### Scenario: 接近上限
- **WHEN** 用户输入超过 99000 字符
- **THEN** composer-bar 右侧出现剩余字数；超过 10 万后数字变红且消息发不出去

## MODIFIED Requirements

无。（composer-bar 布局与 assistant 消息区为新增元素，不改既有行为。）

## REMOVED Requirements

无。
