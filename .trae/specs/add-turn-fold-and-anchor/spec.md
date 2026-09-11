# 完成态轮折叠 + 终答锚点（对标 WorkBuddy MetaFold）Spec

## Why

WorkBuddy 任务完成后：过程（思考/工具行/过程文本）全部折进「已完成 Xs」头部，
页面只留一段自足的终答——信息密度高、历史干净。我们目前所有块全程平铺，
长任务后一屏全是工具行，终答被淹没。（调研实证：WorkBuddy 线上为旧 MetaFold
链路，轮折叠 + 段折叠 + 锚点规则，证据见调研记录。）

## WorkBuddy 机制要点（复刻依据）

- **块分类**：thinking/tool → 可折叠；assistant 正文 → 永不进段折叠，参与锚点选举；
  产物卡/交互卡 → 在折叠作用域外（整轮豁免，防关键卡被折进去点不到）
- **段折叠**：连续 ≥2 个工具块，其后一旦出现正文（流式中）或轮结束，收成一条
  摘要折叠（主要工具名 + 次数）
- **轮折叠**：权威终态信号触发（非流式停顿）；首锚点之前全部内容折进
  「已完成 {时长}」头；锚点间内容包「过程消息」折叠；sticky finished 防追问闪回
- **锚点规则**（无 isFinal 标记）：`锚点 = trim 后最长的所有正文 ∪ 最后一条正文`
- **折叠状态 = 会话视图态，不落盘**；历史 turn 一律默认折叠；耗时用
  finishTime（createTime 会严重偏短）
- **F14 配套**：提示词明示过程会被折叠、终答必须自足（50-70 行上限）

## What Changes

- **新增 `src/renderer/fold-view.ts` 纯函数层**：输入 turn 块流 + 终态，
  输出渲染计划（哪些块进轮折叠区 / 哪些块是锚点常显 / 哪些连续工具批收成
  段折叠 / 产物·错误·问卷卡豁免）；锚点选举与段折叠分组全部纯函数可测
- **chat-view 渲染**：TurnHeader 可点击展开/收起（已完成 turn 默认折叠过程区）；
  段折叠组件（工具批摘要条，可单独展开）；折叠状态为会话视图态（不落盘，
  按 turn id 记忆展开/收起）；追问/新 run 时上一轮立即折叠（sticky）
- **F14 提示词配套**：`resources/prompts/fragments/delivery-rules.md` 补
  「过程在界面会被折叠，最终回复必须自足（复述关键结果与产物摘要，
  50-70 行内）」（WorkBuddy final_answer_instructions 同款，§六 搬用适配）
- **范围外（v1 不做，备注）**：展开预算（WB 15 块/24KB 分批）、展开动画、
  段折叠在流式中的即时触发（v1 只在轮结束时一并处理）

## Impact

- Affected code：`src/renderer/fold-view.ts`（新）、`src/renderer/conversation.ts`
  （块流输入）、`src/renderer/chat-view.tsx`（渲染与状态）、
  `src/renderer/index.css`（段折叠样式）、
  `resources/prompts/fragments/delivery-rules.md`（一句配套）
- Affected specs：无冲突（L2 对话页已有基础，这是增强）

## ADDED Requirements

### Requirement: 轮折叠
The system SHALL 在 run 结束（run_finished 权威终态）后，把该轮首个锚点之前的
全部过程块（thinking/工具行/过程正文）折叠进「已完成 {时长}」头部；
点击头部展开完整过程（段折叠视图）；折叠状态按 turn id 记忆、不落盘；
历史轮一律默认折叠。

#### Scenario: 任务完成后页面只剩终答
- **WHEN** 一个含多次工具调用的调研任务完成
- **THEN** 过程区折进「已完成 Xs」头，页面只显示锚点正文 + 产物卡；
  点击头部可展开全过程

### Requirement: 终答锚点选举
The system SHALL 按规则 `trim 后最长的正文 ∪ 最后一条正文` 选举锚点（纯函数）；
锚点正文永不折叠；锚点之间的其余内容在轮折叠时包「过程消息」折叠。

#### Scenario: 过程文本比终答长
- **WHEN** 某轮中间的过程说明比最终回复更长
- **THEN** 该过程说明与最终回复都作为锚点常显，两者之间内容包「过程消息」折叠

### Requirement: 段折叠
The system SHALL 把连续 ≥2 个工具块的批次收成一条摘要折叠
（主要工具名 + 调用次数，可单独展开）；单个孤立工具块不折。

#### Scenario: 连续 3 次搜索
- **WHEN** 模型连续调用 3 次 web_search 后输出正文
- **THEN** 3 次调用收成一条「搜索网页 ×3」摘要折叠（轮内展开过程时可见）

### Requirement: 豁免与边界
The system SHALL 保证：产物卡/错误卡/问卷卡永不进入折叠区；streaming 中
不触发轮折叠；追问发出后上一轮立即折叠且不因状态抖动闪回展开（sticky）。

#### Scenario: 错误卡可见
- **WHEN** run 以 run_error 结束
- **THEN** 错误卡常显在折叠区外，过程仍折叠

### Requirement: F14 终答自足配套
The system SHALL 在交付纪律片段中明示「过程会被折叠、终答必须自足（含产物
文字摘要）、50-70 行内」。

#### Scenario: 长任务终答自足
- **WHEN** 模型结束一个多步骤任务
- **THEN** 最终回复自身包含关键结果复述与产物摘要，不依赖被折叠的过程内容
