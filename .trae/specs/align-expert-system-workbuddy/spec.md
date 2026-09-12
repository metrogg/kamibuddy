# 专家体系对齐 WorkBuddy（人格注入改造 + 预设扩充 + 起手引导）Spec

## Why

对照 WorkBuddy 专家体系逆向（tar.js ExpertPromptSlotCollector /
CurrentExpertReminderSection / expert-manager references 实证），我们的 expert 模式
存在三个实质问题：① 专家人格注入在系统提示词**末尾**的 `<current-expert>` 段——
WorkBuddy 是进系统提示词**顶部槽位**并带 Role Override 前缀（人格压过通用身份），
末尾段只是不含人格的「钉子」，我们的位置与角色都错了，通用身份（办公助手）会稀释
专家人格；② WorkBuddy 选专家后用户自定义风格/身份**让位**于专家人格，我们与通用
身份/风格段并存，人格冲突；③ 专家预设只有 6 员（WorkBuddy 文体专家 9 员），且定义
缺展示与起手引导字段（displayDescription / quickPrompts），菜单只有一行名字。

## What Changes

- **人格注入改造**（`prompt-composer.ts` expert 分支）：人格从末尾 `<current-expert>`
  段改为注入系统提示词前部槽位（骨架之后、模式段之前），前缀一段 Role Override
  语义声明（自己写：以下专家身份优先于此前的通用身份描述，冲突时以本段为准）；
  人格正文剥 frontmatter 注入（加载器已解析，注入器只取 body）；末尾
  `<current-expert>` 段精简为钉子（只留专家名 + 「以其角色与工作流为准」，不重复人格）。
- **身份让位**：expert 分支不注入风格段（style）与通用身份中与人格冲突的部分
  （对照 WorkBuddy user-context-expert-identity 的精简语义）。
- **预设扩充**：`resources/experts/` 补 3 员——stock-research-report（证券/行业研报）、
  science-writing（科普写作）、poetry-prose（诗歌散文），从 WorkBuddy tencent-docx
  对应 SKILL.md 提取方法论自己写（与首批 6 员同法、同格式，合规红线：不抄原文）。
- **字段增强**：专家 frontmatter 增加 `displayDescription`（一句话能力描述，
  菜单副行）与 `quickPrompts`（恰好 3 个起手问题）；加载器校验同步（缺字段抛错，
  quickPrompts 必须恰好 3 个）；首批 6 员补齐这两个字段。
- **UI**：专家子菜单项显示 displayDescription 副行（profession 保留）；
  选中专家后，对话页输入区上方显示该专家的 3 个 quickPrompts 为可点 chip
  （点击填入输入框，发起新对话/切换专家时出现，发送一条后消失）。
- **明确不做**（本轮）：Team 型专家团（C11 前提，成本高）、expert-manager 创建/校验/
  注册生命周期、recommend-experts 推荐卡（无云端专家市场，E6 前提不存在）、
  avatar（无图像生成能力）、categoryId/tags（无专家中心 UI 消费）。

## Impact

- Affected specs: 对齐清单 E5（专家体系）
- Affected code:
  - `src/core/prompt-composer.ts`（expert 分支注入位置与让位）+ 测试
  - `resources/experts/`（9 员：6 员补字段 + 3 员新增）、`src/core/experts.ts`（字段校验）+ 测试
  - `src/renderer/plus-menu.tsx`（或专家子菜单所在组件）displayDescription 副行
  - `src/renderer/chat-view.tsx`（quickPrompts chips）、`src/renderer/index.css`
  - `src/shared/ipc.ts` / bridge / preload（listExperts 返回字段透传，如已有则免）

## ADDED Requirements

### Requirement: 人格顶部槽位注入

expert 模式下，系统 SHALL 将当前专家的人格正文（剥 frontmatter）注入系统提示词
前部槽位（场景骨架之后、模式行为段之前），并在人格前加 Role Override 语义声明；
原末尾 `<current-expert>` 段 SHALL 精简为不含人格的钉子（专家名 + 遵循其角色与工作流）。

#### Scenario: 人格压过通用身份

- **WHEN** 会话绑定 work-report 专家后发消息
- **THEN** 组装的系统提示词中，专家人格全文位于前部槽位且带 override 声明；
  `<current-expert>` 段只含名字不含人格正文；通用「办公助手」身份描述被人格覆盖

#### Scenario: 风格让位

- **WHEN** 组装 expert 模式的系统提示词
- **THEN** 输出不含风格段（style），与 craft 模式对照可证

### Requirement: 预设扩充到 9 员

`resources/experts/` SHALL 含 9 个专家定义，新增 stock-research-report /
science-writing / poetry-prose，格式与首批一致（name/description/displayName/
profession/displayDescription/quickPrompts + 正文 角色/核心能力/工作流程/输出规范/
注意事项），正文自己撰写。

#### Scenario: 加载 9 员

- **WHEN** 加载内置专家
- **THEN** 返回 9 个定义，新 3 员可被选择与注入

### Requirement: 展示与起手引导字段

每个专家定义 SHALL 含 displayDescription（一句话）与 quickPrompts（恰好 3 个）；
加载器对缺字段/数量不符抛错。专家子菜单项 SHALL 显示 displayDescription 副行。

#### Scenario: 校验收紧

- **WHEN** 某专家缺 quickPrompts 或数量不为 3
- **THEN** 加载抛错指明文件与原因

#### Scenario: 菜单副行

- **WHEN** 打开专家子菜单
- **THEN** 每项显示 displayName + displayDescription

### Requirement: quickPrompts 起手 chips

选中专家后，对话页输入区上方 SHALL 显示该专家 3 个 quickPrompts 为可点 chip；
点击把该问题填入输入框（不直接发送）；用户发送任意一条消息后 chips 消失；
切换专家按新专家重显。

#### Scenario: 点击起手问题

- **WHEN** 选中「工作周报」专家后点击「帮我写本周周报」chip
- **THEN** 输入框填入该文本待发送，chips 消失

## MODIFIED Requirements

### Requirement: expert 模式人格注入位置

原「人格随 `<current-expert>` 段落系统提示词末尾」改为「人格前部槽位 +
末尾钉子段」两段式（对齐 WorkBuddy PluginAgentPrompt 槽位 + CurrentExpertReminder 语义）。

## REMOVED Requirements

无。
