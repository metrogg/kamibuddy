# 技能管理面（元数据 / 启停 / 成本可见 / 脚手架）Spec

## Why

上一轮（`rework-skill-ux-workbuddy`）把「技能**怎么用**」这一层补齐了：`/` 菜单分组、chip、`use_skill`、
两个可见性字段。但「技能**怎么管**」还是空的 —— 技能页只能「看」和「导入」：

1. **没有包元数据**。卡片上只有 name / origin / description / filePath。用户的技能是从哪来的、
   什么版本、什么时候装的，一概没有；内置技能里 `version:` / `category:` / `tags:` 写了也没人读
   （`resources/skills/docx/*/SKILL.md` 里的 frontmatter 就是现成的证据）。
2. **没有启停**。`importSkill` 一旦装进来就永久生效（「已存在就先手动删除旧的」，连覆盖都不给）；
   一个不合适的技能只能一直占着 `/` 菜单与每轮常驻的提示词段。
3. **成本不可见**。技能清单段是**每轮常驻上下文**的一段（`composeSystemPrompt` 的 `{{skills}}` 槽位，
   `skillsTokens` 已经算出来了但只喂给诊断页），技能页完全看不到「我启用的这些技能值多少 token」。
4. **没有造技能的闭环**。用户想让 agent 帮忙写一个技能时，模型手上没有任何关于「我们的 SKILL.md
   怎么写」的知识 —— 而我们已经有了 `importSkill` 的校验（name 规则、description 必填），
   差的只是把约定告诉模型 + 把校验失败原样报回。

WorkBuddy 的对应能力：市场条目里的 `_skillhub_meta.json`（version / installedAt / source / iconSource）、
`skillOverrides` 四态（桌面端收敛成「自动触发 on/off」开关）、技能数量告警（80 个）、
`skill-creator` 脚手架（init/package/validate）。本轮只做**机制**，不做内容移植（用户决策：
「本轮不移植，只做机制」）——所以第 4 点自研一个最小版，不搬 WB 的文件。

## What Changes

- **技能元数据**：`SkillInfo` 增 `version` / `installedAt` / `sourcePath`；内置技能从 SKILL.md
  frontmatter 读（复用 `listSkills` 里已有的那次 frontmatter 读取，零额外 IO），
  自装技能由 `importSkill` 写一份 sidecar `_installed.json`（WB `_skillhub_meta.json` 的同款落点与形状）；
  技能卡片展示「版本 · 来源 · 导入时间」。
- **启用 / 停用**：`preferences.json` 新增 `skillOverrides?: Record<string, "on" | "off">`（缺省 `on`，
  名字与语义对齐 WB 的 skillOverrides，未来加 `name-only` 等态零迁移）；新增写通道
  `skills:set-enabled`；被停用的技能从**三处**一起消失：`/` 菜单（completions）、
  模型技能清单段（`composeSystemPrompt`）、`use_skill` 的可加载集合；`use_skill` 对停用的技能
  **响亮拒绝**（说明「已在技能页停用」）而不是静默返回空；技能页给开关，停用的技能仍留在列表里
  可再启用。
- **技能成本可见**：`skills:snapshot` 带出「已启用技能数 + 技能清单段 token 估算」，
  技能页顶部常显一行；token 超过阈值（**4000**，理由见下）时给一条提示，指向「停用不常用的」。
  写通道返回新快照，订阅者一个来回就能看到数字变化。
- **技能脚手架**：新增内置技能 `resources/skills/skill-creator/`（**自研最小版**，不搬 WB 文件），
  内容 = 我们的 SKILL.md 约定（name/description 怎么写、三级渐进披露、scripts/references/assets 分工、
  两个可见性字段、目录与路径纪律）+ 造完即导入的闭环 + 「导入校验失败要把错误原样报给用户」的硬约束。
- **BREAKING**：无。`SkillInfo` / `SkillsSnapshot` 只增字段，`preferences.json` 只增键；
  现有两个 frontmatter 可见性字段语义不变。

## Impact

- Affected specs: `rework-skill-ux-workbuddy`（可见性两字段与 `/` 菜单、`use_skill`）、
  `rework-expert-orthogonal-and-skills`（专家私有技能走同一条 `listSkills` 出口）、
  `rework-settings-layout`（设置写通道 `settings:set-*` 的范式）、`apply-design-tokens-foundation`（开关视觉）
- Affected code:
  - `src/shared/settings.ts`（`SkillInfo` / `SkillsSnapshot` 扩字段）
  - `src/shared/ipc.ts`（`skills:set-enabled` 通道 + 返回类型）
  - `src/core/skill-install.ts`（写 sidecar + 返回新字段）
  - `src/core/preferences.ts`（`skillOverrides` 键 + 读写校验）
  - `src/daemon/index.ts`（`listSkills` 读 version/installedAt、启用集合的单一出口、completions 过滤、
    `skills:snapshot` 带成本、`skills:set-enabled` 写通道、`use_skill` 注入过滤后的集合）
  - `src/core/prompt-composer.ts`（若有需要：清单段的描述符带上 enabled，或在 daemon 侧过滤 —— 二选一）
  - `src/renderer/skills-view.tsx`（卡片元数据行 + 开关 + 顶部成本行）
  - `src/renderer/index.css`（开关复用既有声明，不新造视觉值）
  - 新增 `resources/skills/skill-creator/SKILL.md`

## ADDED Requirements

### Requirement: 技能包元数据

技能 SHALL 暴露三个元数据字段：`version`（技能声明版本）、`installedAt`（自装技能的导入时刻）、
`sourcePath`（自装技能的来源路径）。内置技能的 `version` SHALL 取自其 SKILL.md 的 frontmatter；
自装技能 SHALL 在导入时把这三个字段写进技能目录内的 `_installed.json`。元数据缺失时
SHALL 如实呈现为「未知」，SHALL NOT 编造默认值。

#### Scenario: 内置技能显示版本

- **WHEN** 打开技能页，某内置技能的 SKILL.md 声明了 `version: 1.2.0`
- **THEN** 卡片上显示该版本号

#### Scenario: 自装技能显示导入时间与来源

- **WHEN** 用户导入一个技能后打开技能页
- **THEN** 卡片显示导入时间与来源路径（来自该技能目录下的 `_installed.json`）

#### Scenario: 元数据缺失

- **WHEN** 技能既没声明 `version`，也不是经导入安装的（用户手工放进技能目录）
- **THEN** 卡片对缺失项不显示伪造值（版本留白 / 来源标为「手工放置」）

#### Scenario: sidecar 不污染技能内容

- **WHEN** 技能目录里存在 `_installed.json`
- **THEN** 它不被当作技能内容（pi 只读 SKILL.md），也不出现在 `/` 菜单或技能清单段里

### Requirement: 技能启用 / 停用

系统 SHALL 支持按技能名持久化的启停开关（`skillOverrides`，缺省启用）。
被停用的技能 SHALL NOT 出现在 `/` 菜单、SHALL NOT 进入模型技能清单段、
SHALL NOT 能被 `use_skill` 加载（调用时报错并说明已在技能页停用）。
启停 SHALL 是用户级覆盖，SHALL NOT 修改技能自身的 SKILL.md。

#### Scenario: 停用后三处同时生效

- **WHEN** 用户在技能页把某技能关掉
- **THEN** 该技能从 `/` 菜单消失、下一轮起不在系统提示词的技能清单段里、
  `use_skill` 加载它时报错说明它已被停用

#### Scenario: 停用是覆盖不是删除

- **WHEN** 某技能被停用
- **THEN** 它仍出现在技能页（标为已停用）且可重新启用；SKILL.md 与 `_installed.json` 不被改写

#### Scenario: 未声明的技能缺省启用

- **WHEN** `skillOverrides` 里没有某技能的条目
- **THEN** 该技能按启用处理（与既有技能行为完全一致，老用户升级后行为不变）

#### Scenario: 停用优先于其它可见性字段

- **WHEN** 一个技能声明了 `user-invocable: false` 但用户在技能页把它打开
- **THEN** 它仍不进 `/` 菜单（frontmatter 是作者声明、override 是用户级开关，两者各自生效，
  互不覆盖）

### Requirement: 技能成本可见

技能页 SHALL 常显「已启用技能数」与「技能清单段在系统提示词里的常驻 token 估算」。
估算值 SHALL 由与真实注入同一份组装逻辑产出（`formatSkillsSection` + `estimateTokens`），
SHALL NOT 在渲染层另算一套。token 超过阈值时 SHALL 给出一条指向「停用不常用技能」的提示。

#### Scenario: 顶部常显成本

- **WHEN** 打开技能页
- **THEN** 顶部显示「已启用 N / 共 M 个技能 · 技能清单约 X token」

#### Scenario: 数字随开关即时更新

- **WHEN** 用户关掉一个技能
- **THEN** 同一次请求返回的快照里 N 与 X 都已更新（不需要手动刷新页面）

#### Scenario: 超过阈值提示

- **WHEN** 已启用技能的清单段估算超过 4000 token
- **THEN** 页面出现一条提示（说明超了多少、建议停用不常用的），且不阻塞任何操作

### Requirement: 技能脚手架技能

系统 SHALL 内置一个 `skill-creator` 技能，供用户与模型在「要造一个新技能」时加载。
它 SHALL 说明本项目的 SKILL.md 约定（frontmatter 必填字段与命名规则、description 的写法、
三级渐进披露、scripts/references/assets 的分工、两个可见性字段的语义、技能目录不得写死绝对路径），
并 SHALL 给出「造完用技能页导入」的闭环。

#### Scenario: 用户要求造技能

- **WHEN** 用户说「帮我做一个 XX 技能」
- **THEN** 模型加载 `skill-creator`，按约定产出含 SKILL.md 的技能目录，并提示用户用技能页导入

#### Scenario: 导入校验失败要如实报出

- **WHEN** 产出的技能被导入且校验失败（名字不合法、缺 description 等）
- **THEN** 模型把 `importSkill` 的原始错误原样转述给用户并指出要改哪一处，
  SHALL NOT 只说「导入失败了」

#### Scenario: 脚手架自身可被手动调用

- **WHEN** 用户手动 `/skill:skill-creator`
- **THEN** 该技能照旧展开（它默认对用户可见、也对模型可见）

## MODIFIED Requirements

### Requirement: 技能清单来源单一出口

原「`sessionSkills(expertId)` 只按专家私有技能目录扩展」改为「同一出口额外过一层启用过滤」：
提示词技能段、`use_skill` 的可加载集合、`/` 菜单三处 SHALL 都只看到**已启用**的技能；
技能页与 `skills:snapshot` SHALL 看到全量（否则开关没有落点）。

#### Scenario: 三处一致

- **WHEN** 某技能被停用
- **THEN** 三处（菜单 / 清单段 / use_skill）的可见集合完全一致，不存在「菜单里有但加载不了」

### Requirement: 技能快照契约

`SkillsSnapshot` SHALL 增加：每个技能的启用标记、已启用技能数、技能清单段 token 估算、
以及可选的超阈值提示文案。技能页 SHALL 只用这一个快照渲染（不额外拉第二份数据）。

#### Scenario: 一次拉取渲染全页

- **WHEN** 技能页加载
- **THEN** 列表、开关状态、成本数字都来自同一次 `skills:snapshot` 响应

## REMOVED Requirements

无。
