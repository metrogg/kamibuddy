# 对话界面对齐 WorkBuddy Spec

## Why

KamiBuddy 的对话界面已具备核心链路（消息流、工具卡、产物预览、@ / 补全），但与 WorkBuddy 相比，在「进行中的视觉语言、消息流结构、输入区细节、状态反馈」四个层面存在系统性差距。目标（用户已确认）：WorkBuddy 本地可实现的机制全部对齐，云端依赖项（积分、排队、点赞上报、语音、云端 @ 源）不做。

调研依据：WorkBuddy 解包代码（`C:\Program Files\WorkBuddy\_analysis\extracted\renderer\`，CSS 未压缩带中文注释，JS 以中文 i18n 文案为锚点），三路调研报告已产出（消息流 / 输入区 / 状态反馈）。

合规红线（AGENTS.md §6）：机制、数值、结构照搬；**所有面向用户的文案（tips、占位符、按钮、提示语）必须自己撰写**，不得复制 WorkBuddy 原文。

## What Changes

按四批推进（用户已批准此顺序）：

**批一 · 视觉语言统一**
- 扫光动画（shining text，2.2s 线性无限）作为全局唯一「进行中」语言：深度思考标题、工具卡状态字、底部状态行三处统一
- 深度思考块升级：流式默认展开（标题扫光）→ 完成自动收起；内容 200px 限高内部滚动 + 上深下淡渐隐 + 左侧竖条
- 等待加载升级：等待模型响应超时后切换安抚文案；4s 后出现 tips 轮播（10s 轮换、可关闭当条；**文案池自创**）
- 中断终态可见：消息流插入「用户已取消」指示行；轮次计时定格为「已取消 Ns」
- IME 中文输入守卫：composition 期间及 compositionend 后 100ms 宽限期内吞掉 Enter（防选词误发送）

**批二 · 消息流结构**
- MetaFold 过程折叠：已完成回合的工具卡序列折叠成一行摘要（动作词归类 + chevron），点击展开；无摘要时兜底「N 个工具调用」
- 用户消息气泡化：右侧气泡（圆角 16/16/0/16），hover 浮现工具条（时间戳 + 复制）
- 回到底部按钮：不在底部时浮现；用户上滚停止自动跟随，回底自动恢复
- 错误展示升级：run 错误渲染为消息流内嵌错误卡（标题 + runId + 复制结构化报告 + 重试按钮）；重试 = 重发最后一条用户消息

**批三 · 输入区补齐**
- 停止二次确认：首次点击/按 Esc 进入 3s 待确认态（按钮显示 Esc 徽章），再次确认才真正中断
- 输入历史：Alt+↑/↓ 翻本进程内历史，回到最新后再按 Alt+↓ 恢复草稿
- 草稿保存：按 sessionId 存草稿，视图切换/热重载后还原
- 字数限制：10 万字符上限；剩余 <1000 时显示余量，超限变红禁发
- 非默认交互模式显示 chip（模式名 + hover 变 × 点击回落默认 craft）

**批四 · 增强**
- 代码块卡片化：圆角容器 + 头部（语言名 + 复制按钮）+ body 60vh 限高滚动
- 用户消息编辑重发：气泡原位编辑，保存后「从此处重新开始对话」（截断其后条目重新发起）；需先核查 pi 的会话截断能力，不支持则降级为「文本回填输入框 + 开新任务」
- 产物卡两列网格 + HTML 卡 🌐 预览按钮 + 卡区下方「查看所有产物(N)」「查看所有变更(N)」文字按钮（打开预览面板对应 tab）
- 压缩分隔线：/compact 完成后消息流显示「上下文已压缩」分隔条目（需 daemon 发事件、ConversationEntry 增加 divider 种类）
- toast 体系升级：顶部居中堆叠（上限 10 驱逐最旧）、5s 默认、success/info/warning/error/loading 五型、dedupKey 去重
- 消息流底部免责声明（自创文案，同语义）

## Impact

- Affected specs: 会话事件契约（divider 条目、中断语义）、渲染层交互
- Affected code:
  - `src/renderer/chat-view.tsx`（消息流主体，四批的主战场）
  - `src/renderer/index.css`（扫光动画、气泡、MetaFold、错误卡、toast 等全部样式）
  - `src/renderer/markdown.tsx`（代码块卡片化）
  - `src/renderer/toast.tsx`（体系升级）
  - `src/renderer/autocomplete.tsx`（IME 守卫落点之一）
  - `src/renderer/App.tsx`（toast 调用方、产物卡打开面板 tab）
  - `src/shared/session-events.ts`（**契约变更**：ConversationEntry 增 divider 种类；run 结束事件携带取消语义）
  - `src/shared/conversation.ts`（reducer 折叠新事件）
  - `src/core/session-host.ts`（abort 时发取消语义、/compact 完成发分隔事件）
  - `src/daemon/index.ts`（编辑重发的 IPC，若批四核查可行）

## ADDED Requirements

### Requirement: 扫光动画统一「进行中」语言

系统 SHALL 提供唯一的「进行中」视觉：110° 线性渐变扫光文字（background-clip: text），2.2s linear infinite，应用于深度思考标题（流式中）、工具卡状态字（执行中/生成中）、底部状态行三处。完成态全部回归静态灰字。

#### Scenario: 流式生成中
- **WHEN** 模型正在输出思考/工具参数/正文
- **THEN** 对应区域的进行中文本显示扫光动画，三处视觉一致

#### Scenario: 完成
- **WHEN** 对应阶段完成
- **THEN** 扫光停止，文字回归静态三级灰色

### Requirement: 深度思考折叠

系统 SHALL 将思考块渲染为：流式期间默认展开且标题带扫光；该条助手消息完成后自动收起为单行标题「深度思考 + chevron」；展开态内容限高 200px 内部滚动，左侧 4px 竖条，文字上深下淡渐隐（background-attachment: local 跟随滚动）。用户手动展开/收起优先于自动行为（同一条消息内记住用户选择）。

#### Scenario: 流式到完成的自动收起
- **WHEN** 一条带 thinking 的助手消息从流式变为完成（assistant_done）
- **THEN** 若用户未手动干预，思考块自动收起，标题扫光停止

#### Scenario: 用户手动干预
- **WHEN** 用户在流式中手动收起思考块
- **THEN** 完成后不再自动展开，保持用户选择

### Requirement: 等待 tips 轮播

系统 SHALL 在等待模型首响应阶段：先显示「等待模型响应…」扫光文案；4 秒后追加一条随机 tip（自创文案池 ≥20 条，实用提示为主），之后每 10 秒换一条（不与上一条重复），hover 暂停轮换，每条可 × 关闭（当次会话内不再出现）。

#### Scenario: 短等待
- **WHEN** 模型 4 秒内开始响应
- **THEN** tips 不出现，无任何残留状态

### Requirement: 中断终态可见

系统 SHALL 在用户中断后：消息流插入一行三级灰「用户已取消」；当前轮次计时定格为「已取消 Ns」（而非「已完成」）。daemon SHALL 区分「正常结束」与「用户取消」并随 run 结束事件下发（契约新增字段）。

#### Scenario: 用户中断
- **WHEN** 用户在流式中触发停止并确认
- **THEN** 消息流出现取消指示行，轮次头部定格「已取消 Ns」，后续新回合正常开始

### Requirement: IME Enter 守卫

系统 SHALL 在输入法 composition 期间（compositionstart→compositionend）及 compositionend 后 100ms 内，忽略 Enter 键的发送语义（换行也不插入）。

#### Scenario: 中文选词
- **WHEN** 用户用拼音输入法按 Enter 确认候选词
- **THEN** 消息不发送，候选词正常上屏

### Requirement: MetaFold 过程折叠

系统 SHALL 在回合结束后（run 完成/取消），将该回合内连续的工具卡序列折叠为一行摘要：摘要由工具序列归类生成（动作词 + 主题，如「读取 3 个文件、写入 2 个文件」），右侧 chevron；点击展开完整序列，再点击收起。进行中的回合不折叠。折叠状态按回合记住。

#### Scenario: 长任务收尾
- **WHEN** 一次任务调用 10+ 次工具后完成
- **THEN** 工具卡折叠为一行摘要，助手的最终回答紧邻摘要行可见

### Requirement: 用户消息气泡与 hover 工具条

系统 SHALL 将用户消息渲染为右侧气泡（圆角 16/16/0/16、fit-content、max-width 限制、超高内部滚动）；hover 气泡时下方浮现工具条：时间戳（智能格式：当天 HH:mm / 昨天 HH:mm / 当年 M月D日 / 跨年全格式）+ 复制按钮（成功变对勾 2s）。

#### Scenario: 复制
- **WHEN** 用户点击气泡工具条的复制
- **THEN** 消息全文入剪贴板，图标变对勾 2 秒

### Requirement: 回到底部与滚动跟随

系统 SHALL 实现：新内容到达时若在底部则自动跟随；用户上滚（wheel）即停止跟随；不在底部时浮现圆形「回到底部」按钮（底部居中、阴影、入场动画）；点击或用户滚回底部后恢复跟随。

#### Scenario: 查看历史时新内容到达
- **WHEN** 用户上滚阅读历史，模型继续输出
- **THEN** 不强制贴底，「回到底部」按钮保持可见

### Requirement: 错误卡与重试

系统 SHALL 将 run_error 渲染为消息流内嵌错误卡：错误图标 + 标题（message）+ runId 区（带复制按钮，复制内容为结构化文本：message / runId / 时间 / 模型）+ 重试实心按钮。重试 = 重发最后一条用户消息（无用户消息时重试按钮隐藏）。

#### Scenario: 模型报错后重试
- **WHEN** 用户点击错误卡的重试
- **THEN** 最后一条用户消息重新发起，错误卡保留在历史中

### Requirement: 停止二次确认

系统 SHALL 在用户首次触发停止（点击停止按钮或按 Esc）时进入 3 秒待确认态：按钮内容变为 Esc 徽章、tooltip 提示再次确认；3 秒内再次触发才真正中断，超时自动复原。

#### Scenario: 误触保护
- **WHEN** 用户单击停止后未再确认
- **THEN** 3 秒后按钮复原，生成继续不受影响

### Requirement: 输入历史与草稿

系统 SHALL 支持 Alt+↑/↓ 翻阅本进程内已发送消息（仅文本）；首次上翻时暂存当前草稿，回到最新位置后再按 Alt+↓ 恢复草稿。系统 SHALL 按 sessionId 保存输入草稿，视图切换（chat↔home↔settings）后还原。

#### Scenario: 翻历史后恢复
- **WHEN** 用户 Alt+↑ 翻出旧消息，再 Alt+↓ 到底
- **THEN** 再按一次 Alt+↓ 恢复翻历史前的草稿

### Requirement: 字数限制与余量

系统 SHALL 限制输入 10 万字符；剩余 <1000 字符时在工具栏右侧显示余量（等宽数字），超限时数字变红且禁发。

### Requirement: 非默认模式 chip

系统 SHALL 在当前交互模式非默认（非 craft）时，于输入区工具栏显示模式 chip（模式名）；hover 时图标变为 ×，点击回落默认模式。

### Requirement: 代码块卡片化

系统 SHALL 将 Markdown 代码块渲染为：圆角容器 + 头部（语言名 + 复制按钮）+ body 限高 60vh 内部滚动。复制成功按钮变对勾 2s。行内 code 样式不变。

### Requirement: 用户消息编辑重发

系统 SHALL 支持用户消息原位编辑（气泡变编辑器，Esc 取消 / Ctrl+Enter 保存）；保存后截断该消息之后的会话条目并重新发起。实现前 SHALL 先核查 pi（SessionManager/AgentSession）是否支持历史截断：支持则走 daemon 新 IPC；不支持则降级为「编辑文本回填输入框」，并在 spec 记录决策。

#### Scenario: 编辑历史消息
- **WHEN** 用户编辑第 2 条用户消息并保存
- **THEN** 该消息之后的条目被截断，编辑后的文本作为新回合发起（降级路径：文本回填输入框由用户自行发送）

### Requirement: 产物卡网格与聚合入口

系统 SHALL 将产物卡区改为两列网格（单产物独占一行）；HTML 产物卡右上角提供 🌐 按钮（点击在预览面板打开，不触发整卡点击）；卡区下方提供「查看所有产物(N)」「查看所有变更(N)」文字按钮，点击打开预览面板并聚焦概览菜单对应分组。

### Requirement: 压缩分隔线

系统 SHALL 在 /compact 完成后于消息流插入「上下文已压缩」分隔条目（视觉：细线 + 居中文字）。daemon SHALL 在压缩完成时下发事件；ConversationEntry 增加 divider 种类（kind: "compact"），reducer、快照、日志链路同步支持。

### Requirement: toast 体系

系统 SHALL 将 toast 升级为：顶部居中堆叠（上限 10 条，超出驱逐最旧）；默认 5s 自动关闭（duration≤0 常驻）；success/info/warning/error/loading 五型（各带图标与标准色）；同 dedupKey 重复触发重置计时而非新增。

### Requirement: 免责声明

系统 SHALL 在对话页消息流底部（非流式时）显示一行自创的 AI 生成内容免责提示（12px 三级灰居中）。

## MODIFIED Requirements

### Requirement: 会话事件契约

`SessionEvent` 的 run 结束事件 SHALL 携带结束方式（completed / cancelled）；`ConversationEntry` SHALL 新增 divider 条目种类。渲染端 reducer 与 daemon 端折叠共用 `shared/conversation.ts` 单实现的原则不变（AGENTS.md §4）。

### Requirement: 底部状态行文案

保留现有「正在写入文件 xx…」阶段机，追加：等待首响应超时（阈值 8s）后切换为安抚文案（自创）。文案样式切换为扫光动画（见「扫光动画统一」）。

## REMOVED Requirements

无。现有刻意差异保留：@ 引用纯文本插入（用户已确认）；消息走 react-markdown 无 typewriter 效果（与 WorkBuddy 一致——它也没有打字机）。
