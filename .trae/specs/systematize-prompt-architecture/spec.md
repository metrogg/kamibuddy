# 提示词体系系统化（F1 组合式模板 + F3 场景矩阵 + F8 风格 + 可视化预览）Spec

## Why

我们的提示词组装目前是「骨架 + 四槽位替换」的单层结构（清单 F1 🟡、F3 🟡、F8 ❌）：
场景只有 work 一个、共享纪律文案无法复用、没有风格系统、且没有人能看见
「最终发给模型的提示词到底长什么样、每一段从哪来」。
WorkBuddy 的答案：组合式 fragments（F1）× 场景×模式双轴（F3）× 7 风格（F8）——
按用户决策（AGENTS.md §六）内容直接搬用、机制照抄、适当适配。

## What Changes

- **F1 片段引擎**：composer 支持 `{{> fragment-name}}` include 指令（递归展开、
  环检测、缺失即抛错——与现有「残留槽位抛错」同款响亮失败哲学）；
  共享纪律/身份/交付文案抽到 `resources/prompts/fragments/`，场景骨架引用
- **来源追踪（provenance）**：组装不再只产一个字符串——同时产出
  `segments[]`（每段标注来源：skeleton / fragment:xx / mode / style / skills /
  pi-context / time / expert），这是可视化的数据源；`composePrompt` 保留字符串
  返回（薄封装，现有调用点不破）
- **F3 场景矩阵**：新增 `resources/scenes/code/`（搬用 WorkBuddy welcomemode/code
  的 prompt.tpl 并适配我们的工具名与身份），首页「代码开发」页签开通；
  「设计创意」维持占位（依赖 ardot 设计技能体系，E2 范畴，清单备注）
- **F8 风格系统**：`resources/styles/` 搬用 7 个风格文件（专业/亲和/高效/创意/
  毒舌/苏格拉底/直白，同构四小节 + 「style affects HOW, not WHAT」元规则）；
  设置页新增「回复风格」选择（默认专业，可切换可关闭）；composer 在交互段之后
  注入风格段；子代理提示词**不注入**（子代理身份由 agent 定义自声明，不套产品风格）
- **可视化预览**：设置页新增「提示词预览」——场景/模式/风格三个选择器 +
  分段视图（每段：来源标签 + 颜色 + 字数 + 可折叠）+ 完整文本视图；
  daemon 新增 `prompt:preview` IPC（不需要活会话，按选择现场组装）
- 内容合规：按 §六 搬用，目录 README 注明来源

## Impact

- Affected code：`src/core/prompt-composer.ts`（片段引擎 + provenance + 风格注入）、
  `src/core/resources.ts`（styles 加载）、`src/core/preferences.ts`（styleId）、
  `src/core/session-host.ts`（组装调用点）、`src/daemon/index.ts`（preview IPC）、
  `src/renderer/settings-view.tsx`（风格选择器 + 预览页）、
  `resources/prompts/fragments/`（新）、`resources/styles/`（新）、
  `resources/scenes/code/`（新）、`resources/scenes/work/prompt.md`（重构为引用片段）
- Affected specs：无冲突（add-expert-mode 已落地的 expert 轴不动，
  expert 场景联动仍按该 spec 声明不做）

## ADDED Requirements

### Requirement: 片段组合引擎
The system SHALL support `{{> fragment-name}}` include 指令：组装前递归展开
`resources/prompts/fragments/<name>.md`，片段内可继续 include 与使用槽位；
片段缺失/成环/超深即抛错（不静默上线带空洞的提示词）。

#### Scenario: 骨架引用共享片段
- **WHEN** 场景骨架含 `{{> delivery-rules}}`
- **THEN** 最终提示词中该位置展开为 fragments/delivery-rules.md 的内容；
  片段缺失时组装抛错（响亮失败）

### Requirement: 组装来源追踪
The system SHALL 在组装时产出分段来源信息：最终提示词的每一段可追溯到
skeleton / fragment:<名> / mode:<名> / style:<名> / skills / pi-context / time /
expert 之一，供预览页与调试使用。

#### Scenario: 分段可溯源
- **WHEN** 以「work 场景 + craft 模式 + 专业风格」组装
- **THEN** 返回的 segments 按序标注来源，拼接后与原字符串组装结果字节一致

### Requirement: 回复风格系统
The system SHALL 提供 7 种回复风格（resources/styles/，设置页可选，默认专业，
可关闭）；选定风格的全文注入主会话系统提示词（交互段之后），
并带「风格只影响表达方式、不改变事实与内容」元规则；子代理不注入。

#### Scenario: 切换风格生效
- **WHEN** 用户在设置页把风格切到「苏格拉底」
- **THEN** 之后的新 run 系统提示词包含 socratic 风格段（provenance 标 style:socratic）

### Requirement: 代码开发场景
The system SHALL 新增 code 场景（骨架搬用 WorkBuddy welcomemode/code 并适配），
首页「代码开发」页签可选中生效；「设计创意」维持占位反馈。

#### Scenario: 切到代码开发
- **WHEN** 用户在首页点「代码开发」页签并发任务
- **THEN** 系统提示词使用 code 场景骨架组装（provenance 标 skeleton:code）

### Requirement: 提示词预览页
The system SHALL 在设置页提供「提示词预览」：选择场景/模式/风格后展示
分段视图（来源标签 + 字数 + 折叠）与完整文本，无需活会话。

#### Scenario: 查看组装结果
- **WHEN** 用户在预览页选「work + craft + 毒舌」
- **THEN** 看到分段列表（每段来源/字数/内容可展开）与拼接后的完整提示词
