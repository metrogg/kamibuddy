# Plan 模式（pi 官方机制）+ 加号菜单 Spec

## Why

pi 官方示例扩展 `plan-mode/` 提供了经过验证的 plan 模式机制（只读硬约束 + 计划先行 + 确认后执行），
而 KamiBuddy 目前只有 ask/craft 两个交互模式。同时对话页加号按钮功能单一（仅图片附件），
对齐 WorkBuddy 的加号菜单（添加文件/模式/专家/技能/连接器）可以一并解决模式入口问题：
菜单选模式、或 `/plan` 直接启用。

## What Changes

1. **plan 交互模式落地**：新增 `resources/modes/plan.md`——frontmatter 声明只读工具白名单
   （read / read_document / find / grep / ls / web_search / web_fetch，**不含** write/edit/present_files），
   正文为自创的计划行为提示词（只读调研 → 输出编号计划 → 不动手实施）。
   机制对齐 pi 官方 plan-mode 示例的「工具面硬约束」层：白名单经既有
   `setInteraction → setActiveToolsByName` 链路生效，零新增机制代码。
2. **「执行计划」衔接**（官方 plan→execute 流的轻量版）：plan 模式下、非流式、
   最后一条是 assistant 消息时，该消息操作条追加「执行计划」按钮；
   点击 = 切回 craft + 自动发送执行引导语（自创文案）。
   **明确不做**官方实现里的：`[DONE:n]` 进度跟踪、todo widget、bash 命令白名单
   （我们没有 bash 工具）、`--plan` 启动 flag、Ctrl+Alt+P 快捷键、跨会话状态持久化。
3. **加号菜单重构**（对话页 composer）：「+」从直接弹图片选择改为展开菜单——
   添加文件（现有图片选择流程）/ 模式 ▸（子菜单单选：创作/计划/问答，当前项打勾，
   数据源与 ModeSwitch 同源）/ 专家 / 技能 / 连接器（后三项占位，点击走既有 onTodo toast）。
4. **`/plan` 内置命令**：`shared/builtin-commands.ts` 增加 `plan`（仅精确匹配、不接受参数，
   理由与 /new 相同）；daemon 拦截后切换交互模式——进入 plan，或在 plan 中退出回到
   上一个非 plan 模式（daemon 内存记录，默认 craft）；completions 列表同步加条目。

## Impact

- Affected specs：无前置 spec 依赖；与在途的 add-document-reading 无文件交集
  （plan.md 白名单引用 `read_document`，与 ask/craft 既有写法一致）
- Affected code：
  - `resources/modes/plan.md`（新增，数据不是代码——AGENTS.md §3）
  - `src/shared/builtin-commands.ts`（plan 命令解析）+ 对应测试
  - `src/daemon/index.ts`（/plan 拦截与模式切换、completions 加条目）
  - `src/renderer/plus-menu.tsx`（新增组件，与 model-menu/permission-menu 同文件约定）
  - `src/renderer/chat-view.tsx`（加号菜单接线、AssistantActions 追加「执行计划」）
  - `src/renderer/index.css`（菜单样式）
- 不改契约结构（INVOKE 通道复用既有 setInteraction/prompt）、不动 core/session-host。

## ADDED Requirements

### Requirement: plan 交互模式

系统 SHALL 提供第三个交互模式「计划」（id: plan，ready: true）：工具白名单为只读集合
（read、read_document、find、grep、ls、web_search、web_fetch），write/edit/present_files
在该模式下不可用。模式提示词（自创文案）SHALL 要求模型：先用只读工具充分调研，
再以「计划：」标题输出编号步骤列表，不实施任何改动，并在结尾告知用户可切回「创作」
模式执行（按钮文案见此文件「执行计划」需求）。

#### Scenario: 只读硬约束
- **WHEN** 用户在 plan 模式下让模型「直接改文件」
- **THEN** 模型的工具面里没有 write/edit（setActiveToolsByName 白名单），只能给出计划文本

#### Scenario: 模式出现在切换器
- **WHEN** 用户打开头部 ModeSwitch 或加号菜单的「模式」子菜单
- **THEN** 列表中出现「计划」条目（ready，无「待做」标），描述为自创文案

### Requirement: 执行计划按钮

系统 SHALL 在同时满足三个条件时，于最后一条 assistant 消息的操作条追加「执行计划」按钮：
当前交互模式为 plan、会话非流式、该消息是 entries 末条。点击后系统 SHALL：
先切换交互模式到 craft（await 完成，避免执行请求撞上旧的只读工具面），
再自动发送一条自创的执行引导语（语义：按上面的计划开始执行）。
其余 assistant 消息不显示该按钮（只出现在最新一条，避免满屏按钮）。

#### Scenario: 计划生成后一键执行
- **WHEN** plan 模式下模型输出了计划，用户点击该消息下的「执行计划」
- **THEN** 模式切到创作（写工具恢复），并以用户消息名义自动发起执行

#### Scenario: 流式中不显示
- **WHEN** plan 模式正在生成计划
- **THEN** 任何消息下都不出现「执行计划」按钮

### Requirement: 加号菜单

系统 SHALL 将对话页 composer 的「+」按钮改为展开菜单，菜单项依次为：
添加文件（触发既有图片选择流程）、模式（悬停/点击展开子菜单，单选当前交互模式）、
专家、技能、连接器。后三项为占位：点击调既有 onTodo 给出「待做」toast。
菜单向上展开、左对齐（与 composer 区 PermissionMenu/ModelMenu 同一约定：
300px 弹层贴右放会溢出窗口右缘）。首页 composer 的「+」本批不改。

#### Scenario: 从菜单切换到 plan
- **WHEN** 用户点「+」→「模式」→「计划」
- **THEN** 交互模式切到 plan（既有 setInteraction 链路），菜单关闭，头部 ModeSwitch 同步显示

#### Scenario: 占位项反馈
- **WHEN** 用户点击「专家」「技能」或「连接器」
- **THEN** 出现待做 toast，菜单关闭，不触发任何其他行为

### Requirement: /plan 内置命令

系统 SHALL 支持 `/plan`（精确匹配、无参数）作为内置命令：daemon 拦截、不发给模型；
当前非 plan 模式时切换到 plan，当前为 plan 时切回上一个非 plan 模式
（daemon 内存记录最近一次非 plan 模式，缺省 craft）。输入框 `/` 补全列表 SHALL
出现该命令及自创描述文案。带参数的 `/plan xxx` 不识别为命令、按普通文本发送
（与 /new 同一理由：静默吞掉用户文本比发给模型更糟）。

#### Scenario: 命令启用与退出
- **WHEN** 用户发送 `/plan`
- **THEN** 模式切到 plan（session_state 推送，UI 各处同步）；在 plan 中再发 `/plan` 则回到之前的模式

#### Scenario: 带参数不拦截
- **WHEN** 用户发送 `/plan 帮我规划周报`
- **THEN** 该文本作为普通消息发给模型，模式不变

## MODIFIED Requirements

### Requirement: 内置命令集

**原**：`BuiltinCommand.name` 仅 `"new" | "compact"`。
**新**：增加 `"plan"`；parseBuiltinCommand、daemon 拦截、completions 列表三处同步
（三处一体两面的既有约定不变：补全出来的命令必须能识别）。

### Requirement: 加号按钮行为

**原**：对话页「+」点击直接弹系统图片选择框。
**新**：「+」点击展开菜单；图片选择移入「添加文件」菜单项，行为不变。

## REMOVED Requirements

无。
