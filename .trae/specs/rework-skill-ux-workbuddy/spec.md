# 技能机制的封装与调用链路重做 Spec

## Why

用户实测：输入 `/` 选中技能并发送后，**用户气泡里直接摊开一整屏 `<skill name="..." location="D:\...\SKILL.md">`
加整篇 SKILL.md 正文**（纯文本、无 markdown、无折叠），既泄露内部绝对路径，又把对话流压垮。

对照 WorkBuddy 三条实证（见下），我们在技能这条链路上有三个环节是缺的：

1. **用户消息没有封装**。WorkBuddy 里技能是一个 `displayAsPhrase: true / displayAsContext: false`
   的内联胶囊（图标 + 技能名），随用户文本一起渲染，**技能正文只进上下文、不进 UI**
   （`main/tar.js` 的 `<manually_attached_skills>` 段 + `lib-chat-ui` 的 `InputContextTag`
   `skillTag` 样式类）。我们是把 pi 展开后的全文当用户原文展示。
2. **agent 加载技能没有显式步骤**。WorkBuddy 有 `use_skill` 工具
   （工具目录 `canonical: "use_skill"`、`actionKey: metaFold.summary.action.skill` = 「加载技能」、
   运行中「正在加载技能 xxx」、`SkillRenderer` 的紧凑版式 `[SkillIcon] [技能名] [状态]`），
   模型显式调用技能，界面上是一条「加载技能 xxx」的卡片。我们这里 pi 的约定是
   **模型用 `read` 去读 SKILL.md**（`docs/skills.md` L69），界面上只显示成一堆「读取文件」。
3. **`/` 菜单没有分组、没有图标、没有可见性治理**。WorkBuddy 的 `/` 面板固定两组
   「技能 / 指令」（`GROUP_TITLE_KEYS`），技能项带图标 + 置顶 + 来源标签；
   `user-invocable: false` 的技能从 `/` 菜单隐藏、`disable-model-invocation` 的技能从模型侧隐藏。
   我们是三类（技能 / 提示词模板 / 内置命令）混排的扁平列表，且
   `resources/skills/docx/{typeset,design-token,html-review}` 三个内部技能
   **既出现在 `/` 菜单里、又出现在模型技能清单里** —— 两个可见性字段全链路无人消费。

顺带确认的两处链路缺口（同一批修）：
- `composeSystemPrompt` 把技能降维成三字段时**丢掉了 `disableModelInvocation`**
  （`src/daemon/index.ts:469-473`），pi 的 `formatSkillsForPrompt` 靠它过滤，
  字段丢失 = 过滤失效，声明了 `disable-model-invocation: true` 的技能仍会进提示词。
- `src/shared/settings.ts` 里 `SkillsSnapshot` 同一个接口写了两遍（71-83 行）。

## What Changes

- **用户消息里的技能调用封装成胶囊**：新增纯函数把用户消息**开头**的
  `<skill name="…" location="…">…</skill>` 块剥出来，只留技能名 + 用户真正打的补充文本；
  剥出的技能名随 `user_message` 事件结构化下发；渲染层在气泡内渲染
  `[IconSkill] 技能名` 胶囊 + 剩余文本，技能正文彻底不进 UI。活会话（`session-host`）
  与历史重建（`session-rebuild`）两条路径走同一个解析出口。
- **新增 `use_skill` 只读工具**（对标 WorkBuddy）：模型命中技能时调用它加载 SKILL.md 全文，
  返回与 pi `/skill:` 展开**同形**的 `<skill name location>` 块；未知技能响亮报错并列出可用技能名；
  声明 `disable-model-invocation: true` 的技能拒绝调用。工具卡词汇「加载技能 → 已加载」。
- **技能清单段与 `use_skill` 对齐**：清单段补一句「命中技能优先用 `use_skill` 加载」；
  门控（`skillsSectionForMode`）从「有 `read`/`bash`」扩到「有 `read`/`bash`/`use_skill`」；
  `disableModelInvocation` 不再被 compose 丢掉。
- **`/` 菜单分两组**：「技能」（`IconSkill` + 技能名）在前，「指令」（提示词模板 + 内置命令）在后；
  `user-invocable: false` 的技能不出现在技能组（补 `listSkills` 的 frontmatter 解析与
  `SkillInfo.userInvocable` 字段）。
- **技能页卡片补 `IconSkill`**，与菜单同一套图标（用户决策：统一用现有 `IconSkill`，不引入自定义图标）。
- **输入框里选中的技能变成 chip**（实施后按用户反馈补入）：`/` 菜单里选中技能不再往 textarea
  插 `/skill:<name>` 这段命令语法，而是转成输入卡上的一枚 chip（`IconSkill` + 裸技能名 + 移除按钮）；
  发送那一刻才拼回 `/skill:<name>`（pi 只认这个语法）。与文档引用 chip 同一条路子。
- **技能胶囊视觉对齐 WorkBuddy**（实施后按用户反馈补入）：气泡里与输入卡里的技能胶囊统一为
  WB `skillTag` 规格（23px 高 / 全圆角 / 13px / 图标 14 / 静态底色 `--bg-chip`），
  且在气泡里**内联在正文流**（`[图标] 技能名  正文` 同一行）—— 不再复用 32px 的控件 chip
  `.context-chip`（那个高度放进消息流会把正文行顶出一档）。为此新增表面色一档 `--bg-chip`
  并更新 DESIGN.md（§2.2 / §3.6 / §10.3）。
- **清理**：删掉 `src/shared/settings.ts` 里重复定义的 `SkillsSnapshot`。
- 图标一律复用 `icons.tsx` 的 `IconSkill`；不新增图标资产、不引入技能自定义图标字段
  （WorkBuddy 那套「本地 `_icon.*` 缓存 + 远端 iconSource + 首字母兜底」明确不做，理由见 §明确不做）。
- **BREAKING**：无对外契约破坏。`UserMessage` 只增可选字段；`SkillInfo` 只增字段；
  `/skill:name` 的手动触发语法与 pi 侧展开行为不变。

## Impact

- Affected specs: `rework-expert-orthogonal-and-skills`（技能清单与专家私有技能加载路径不变）、
  `align-chat-ui-workbuddy`（用户气泡形态）、`add-intent-grouped-tool-folds`（工具卡词汇表）
- 改动面（Task 9，实施后按用户反馈补入）
  - `src/shared/skill-block.ts`（`SKILL_COMMAND_PREFIX` 常量 + `bareSkillName`）
  - `src/shared/autocomplete.ts`（`CompletionItem.skill`）、`src/renderer/autocomplete.tsx`（`onPickSkill`）
  - `src/renderer/composer.tsx`（`SkillStrip` + 提交拼回 + 只带技能可发）
  - `src/renderer/index.css`（技能 chip 与文档引用 chip 共用同一组声明）
  - `src/daemon/index.ts`（completions 的技能名前缀改用共享常量）
- 改动面（Task 10，实施后按用户反馈补入）
  - `src/styles/tokens.css`（新增 `--bg-chip`）、`DESIGN.md`（§2.2 / §3.6 / §10.3）
  - `src/renderer/index.css`（`.skill-chip` 胶囊）、`src/renderer/chat-view.tsx`（气泡内联胶囊）+
    `src/renderer/composer.tsx`（图标 14）
- Affected code:
  - 新增 `src/shared/skill-block.ts`（+ `.test.ts`）、`src/extensions/use-skill-tool.ts`（+ `.test.ts`）
  - `src/shared/session-events.ts`（`UserMessage.skillNames`）、`src/shared/settings.ts`（`SkillInfo.userInvocable` + 去重）
  - `src/shared/ipc.ts`（`CommandItem` 注释：分组口径）
  - `src/core/session-host.ts`（用户消息翻译、`use_skill` 卡片词汇）
  - `src/core/session-rebuild.ts`（历史路径同一解析出口）
  - `src/core/prompt-composer.ts`（技能段文案 + 门控 + 不再丢 `disableModelInvocation`）+ 测试
  - `src/daemon/index.ts`（`listSkills` 补 `userInvocable`、completions 过滤、注册 `use_skill` 扩展、compose 透传字段）
  - `src/daemon/automation-runner.ts`（定时会话注册 `use_skill`）
  - `src/daemon/prompt-preview.ts`（门控镜像）
  - `resources/modes/{ask,craft,plan}.md`（工具白名单加 `use_skill`）
  - `src/renderer/chat-view.tsx`（`UserBubble` 胶囊行）、`src/renderer/autocomplete.tsx`（菜单分组）、
    `src/renderer/skills-view.tsx`（卡片图标）、`src/renderer/index.css`（只加布局容器类，不新造 chip 视觉值）

## ADDED Requirements

### Requirement: 用户消息里的技能调用封装成胶囊

系统 SHALL 把用户消息**开头**的 `<skill name="X" location="Y">…</skill>` 块从展示文本里剥离，
把其中声明的技能名作为结构化字段（`UserMessage.skillNames`）随 `user_message` 事件下发；
技能正文 SHALL NOT 出现在用户气泡里。活会话与历史重建两条路径 SHALL 走同一个解析出口。

#### Scenario: 手动 `/skill:name` 带补充文本

- **WHEN** 用户在输入框输入 `/skill:docx 帮我做一份周报` 并发送
- **THEN** 用户气泡显示为「`[IconSkill] docx` 帮我做一份周报」——技能胶囊 + 用户自己的文本，
  不出现 `<skill …>` 标签、不出现 SKILL.md 正文、不出现本机绝对路径

#### Scenario: 只有技能、没有补充文本

- **WHEN** 用户只发 `/skill:docx`
- **THEN** 气泡只有技能胶囊一行（不渲染空文本行、不塌成空气泡）

#### Scenario: 历史会话与活会话同形

- **WHEN** 刷新或重开历史会话，从 pi 会话文件重建这条消息
- **THEN** 重建出的 `UserMessage.skillNames` 与文本切分结果与在线时一致
  （不出现「活的时候是胶囊、刷新后变回一屏正文」）

#### Scenario: 正文里恰好出现 `<skill` 字样

- **WHEN** 用户自己的文本以普通文字开始，正文中部含 `<skill …>` 字样
- **THEN** 不剥离、不误解为技能调用，整条按普通文本展示

### Requirement: `use_skill` 技能加载工具

系统 SHALL 注册一个名为 `use_skill` 的**只读**工具，供模型在任务命中某技能时加载其 SKILL.md 全文。
工具 SHALL 以技能名（不含参数的短名）为唯一入参，返回与 pi `/skill:name` 展开同形的
`<skill name="…" location="…">…</skill>` 块（含「相对路径以技能目录为基准」的提示行），
使模型在自动调用与手动 `/skill:` 两条路径上看到同一形状。

#### Scenario: 命中技能

- **WHEN** 模型调用 `use_skill({ command: "docx" })`，且该技能在当前会话可见
- **THEN** 返回该技能 SKILL.md 去掉 frontmatter 的正文（包在 `<skill name location>` 块内），
  卡片标题显示「加载技能 docx」

#### Scenario: 未命中技能

- **WHEN** 模型调用了不存在的技能名
- **THEN** 工具响亮报错，错误信息里列出当前会话可用技能名，供模型自我纠正；不静默返回空正文

#### Scenario: 模型不可见的技能被拒

- **WHEN** 模型对声明 `disable-model-invocation: true` 的技能调用 `use_skill`
- **THEN** 拒绝并说明该技能仅供手动 `/skill:name` 或其它技能按路径引用

#### Scenario: 三种交互模式都可用

- **WHEN** `resources/modes/{ask,craft,plan}.md` 被加载
- **THEN** 三个模式的白名单都含 `use_skill`（它是只读工具，与 `read` 同档）

#### Scenario: 子代理不获得该工具

- **WHEN** 子代理会话组装扩展
- **THEN** 不注册 `use_skill`（子代理提示词本就不注入技能清单段，注册等于给它一个用不上的工具）

### Requirement: `/` 菜单按「技能 / 指令」分组

斜杠补全菜单 SHALL 分两组呈现：**技能**组在前（技能项带 `IconSkill` 图标），
**指令**组在后（提示词模板与内置命令）。技能项的插入文本 SHALL 仍是 pi 认得的
`/skill:<name>`；分组依据 SHALL 来自契约里的 `CommandItem.source`，不在渲染层重新推断。

#### Scenario: 打开 `/` 菜单

- **WHEN** 用户在输入框敲 `/`
- **THEN** 菜单出现「技能」「指令」两个分组标题；技能项显示图标 + `/skill:<name>` + 描述，
  指令项显示 `/name` + 描述

#### Scenario: 插入文本仍是 pi 语法

- **WHEN** 用户选中技能组里的一项
- **THEN** 输入框插入 `/skill:<name> `（分组只改呈现，不改语法）

### Requirement: 技能可见性两个字段各自生效

`user-invocable: false` 的技能 SHALL NOT 出现在 `/` 菜单（仍可被模型或其它技能按路径引用）；
`disable-model-invocation: true` 的技能 SHALL NOT 出现在模型技能清单段
（仍可被用户以 `/skill:name` 手动触发）。两者都命中 = 纯内部技能。

#### Scenario: 内部技能从菜单消失

- **WHEN** 打开 `/` 菜单
- **THEN** `resources/skills/docx/{typeset,design-token,html-review}`（声明 `user-invocable: false`）
  不出现在技能组

#### Scenario: 内部技能从模型清单消失

- **WHEN** 组装系统提示词的技能清单段
- **THEN** 上述三个声明了 `disable-model-invocation: true` 的技能不在 `<available_skills>` 里

#### Scenario: 手动触发仍可用

- **WHEN** 用户手动输入 `/skill:typeset`
- **THEN** pi 照旧展开（可见性只影响菜单与提示词，不拦手动调用）

### Requirement: 输入框里选中的技能是 chip，不是命令文本

用户从 `/` 菜单选中技能时，系统 SHALL NOT 把 `/skill:<name>` 插进输入框文本，
SHALL 转成输入卡上的一枚 chip（技能图标 + 裸技能名 + 移除按钮）；发送时 SHALL 把技能名
拼回 `/skill:<name>` 前缀（空格分隔，pi 只认这个语法）。用户手动敲 `/skill:<name>`
发送的旧路径 SHALL 保持可用。同一时刻 SHALL 只保留一枚 chip（pi 的前置 `/skill:` 语法
只支持一个技能，再选即替换；更多技能由模型自己用 `use_skill` 加载）。

#### Scenario: 从菜单选中技能

- **WHEN** 用户在输入框敲 `/` 选中「frontend-design」并回车
- **THEN** 输入框里不留 `/skill:frontend-design` 这串文本，而是出现一枚「`IconSkill` frontend-design」
  chip；触发片段（用户敲的那些字母）一并从框里清掉

#### Scenario: 只有技能也能发送

- **WHEN** 用户只选了一个技能、没有写正文就点发送
- **THEN** 发送按钮可用，发出去的内容是 `/skill:<name>`（模型照该技能做事）

#### Scenario: 技能与正文一起发

- **WHEN** 用户选了技能并写了「写一份周报」后发送
- **THEN** 实际发给模型的是 `/skill:<name> 写一份周报`（技能在前，空格分隔）

#### Scenario: 撤掉技能

- **WHEN** 用户点 chip 上的移除按钮
- **THEN** 该技能从待发内容里去掉，正文不受影响

#### Scenario: 再选一个技能

- **WHEN** 已有技能 chip 时用户又从 `/` 菜单选了一个技能
- **THEN** chip 替换为新技能（不叠加）—— pi 只有一个前置 `/skill:`，叠两个会让第二个
  变成第一个技能的参数

#### Scenario: 手动敲语法仍然可用

- **WHEN** 用户手动输入 `/skill:docx 写周报` 并发送（不经菜单）
- **THEN** 照旧由 pi 展开并加载该技能，气泡按既有口径渲染成胶囊

### Requirement: 技能页卡片带图标

技能管理页的每个技能卡片 SHALL 与 `/` 菜单使用同一个 `IconSkill` 图标，两处视觉一致。

#### Scenario: 技能页与菜单同源

- **WHEN** 打开技能页
- **THEN** 每张卡片名称前有 `IconSkill`（尺寸/颜色走既有 token，不新增视觉值）

## MODIFIED Requirements

### Requirement: 技能清单段文案与门控

原「清单段完全委托 pi 的 `formatSkillsForPrompt`，正文只说『用 read 加载技能文件』」改为
「保留 pi 的 XML 形状与 `<location>`，另补一句本会话的技能调用约定：命中技能优先用
`use_skill` 工具加载；无该工具时仍用 `read` 按 location 读」。门控从
「模式白名单含 `read` 或 `bash`」扩为「含 `read`、`bash` 或 `use_skill`」。
`composeSystemPrompt` 构造 `SkillDescriptor` 时 SHALL 保留 `disableModelInvocation`，
由 pi 的格式化器按它过滤。

#### Scenario: 清单段指引

- **WHEN** 会话处于 craft 模式且有可用技能
- **THEN** 清单段含 `<available_skills>` 与技能调用约定一句，且模型据此走 `use_skill`

#### Scenario: 无读取工具时不注入

- **WHEN** 模式白名单既无 `read` 也无 `use_skill`
- **THEN** 清单段为空串（零 token），与既有口径一致

### Requirement: 会话技能来源单一出口

`use_skill` 工具解析技能时 SHALL 与技能清单段走**同一个出口**（daemon 的 `listSkills`，
并同样按当前绑定的专家追加其私有技能目录），SHALL NOT 另起一份技能来源
（`SessionHost` 自持的 `resourceLoader.getSkills()` 与提示词用的不是同一份，用它等于
制造第三个来源；该 getter 保持无消费方）。

#### Scenario: 工具与提示词同源

- **WHEN** 会话绑定了带私有技能的专家
- **THEN** `use_skill` 能加载这些私有技能，且清单段与工具看到的技能集合一致

#### Scenario: 未绑定专家

- **WHEN** 会话未绑定专家
- **THEN** 工具可加载的技能集合与全局技能清单段完全一致

### Requirement: `/` 菜单技能来源

`session:completions` 聚合技能时 SHALL 过滤掉 `user-invocable: false` 的技能；
其余（提示词模板、内置命令）来源与排序不变。

#### Scenario: 过滤只作用于技能

- **WHEN** 拉取补全数据
- **THEN** `source === "skill"` 的项已剔除仅内部技能，`template` / `builtin` 项不受影响

## REMOVED Requirements

### Requirement: `src/shared/settings.ts` 中重复的 `SkillsSnapshot`

**Reason**: 同一接口在同一文件里写了两遍（71-83 行），字段与注释近乎重复，
读的人无法判断哪份是准。
**Migration**: 保留一份（含 `userSkillsDir` 的完整注释），删除另一份；
消费方（`skills-view.tsx`、daemon）不改。
