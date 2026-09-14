# 专家正交化 + 技能预加载 Spec

## Why

对照 WorkBuddy 专家体系实证（`equity-research` 真实专家包、`expert-manager` 四份 spec、
`tar.js` 的 `selectTemplateKind` / `ExpertPromptSlotCollector`、`server.js` 的
`resolveInteractionModeForPrompt` / `keepSummonedExpertPlugins`），我们的专家体系有两处结构性偏差：

1. **专家被做成了「第 4 个交互模式」，而不是与交互模式正交的会话绑定。**
   WorkBuddy 里 `expertId` 是会话独立字段（sessions 表 `expert_id` / `expert_marketplace` /
   `expert_runtime_identity` 三列），与 `mode`（ask/craft/plan）正交：
   `selectTemplateKind` 明确注释「**Scene mode wins over expertId**」，`plugin-json-spec.md`
   的 `tools` 一栏写着「禁止声明——所有工具权限由系统统一分配」。我们用
   `resources/modes/expert.md` 把专家做成了模式（`applyInteraction` 里「选专家 = 切 expert 模式」，
   且「切到 craft/ask/plan 一律清空 expertId」），结果是「计划 + 专家」「问答 + 专家」
   这两条组合**不可达**，取消专家还会把用户选的模式一起改掉。

2. **专家只有人设，没有技能。** WorkBuddy 的专家是一个插件包，`plugin.json` 声明
   `skills: ["./skills/x"]`（如 `equity-research` 带 15 个技能），随专家绑定经
   `enabledPlugins` 进 `<available_skills>`；`keepSummonedExpertPlugins` 还会把未召唤的
   专家包显式关掉，避免新旧技能互抢。我们的 `ExpertDefinition` 只有人格正文，
   专家的专业方法（估值、建模、研报流程）无处安放。

## What Changes

- **专家正交化**：删除 `resources/modes/expert.md`；`expertId` 成为与 `interactionId`
  平行的独立会话状态。选/取消专家不再改交互模式，切交互模式不再清 `expertId`。
  人格注入条件从「`interactionId === "expert"`」改为「`expertId !== undefined`」。
- **专家目录化**：`resources/experts/<name>.md` → `resources/experts/<name>/expert.md`
  加可选的 `skills/` 子目录（对齐 WorkBuddy 专家包 `agents/ + skills/` 的形状）。
- **技能预加载**：绑定专家时把该专家 `skills/` 目录追加进会话技能加载路径
  （pi `loadSkills` 的 `skillPaths`），专家的专业技能因此只在选中该专家时可见。
- **搬入 3 个真实专家技能**：从 WorkBuddy `equity-research` 专家包原样搬
  `comps-valuation` / `dcf-model-builder` / `initiating-coverage` 给「证券研报」专家
  （用户 2026-09-14 决策：内部阶段直接完整搬用；AGENTS.md §6，目录 README 注明来源）。
- **渲染层与预览适配**：模式切换器不再需要过滤 `expert`；提示词预览增加专家选择器
  （否则预览页无法看到人格段）。
- **BREAKING**：`resources/modes/expert.md` 删除、`resources/experts/*.md` 改为目录、
  `INVOKE.setInteraction` 语义收窄为「只切模式」。

## Impact

- Affected specs: 对齐清单 E5（专家体系）、F3（场景 × 模式矩阵 2×4 → 2×3 + 专家绑定）
- Affected code:
  - `resources/modes/expert.md`（删除）、`resources/experts/**`（9 员目录化 + 3 个搬用技能）
  - `src/core/experts.ts`（目录加载 + 私有技能收集 + 重名校验）+ 测试
  - `src/core/prompt-composer.ts`（人格注入条件） + 测试
  - `src/daemon/index.ts`（`applyInteraction` / `setExpert` / `composeSystemPrompt` /
    `listSkills` / `/plan` 回程记忆 / `freshConversation` 注释）
  - `src/shared/ipc.ts`、`src/shared/session-events.ts`（语义注释与类型说明）
  - `src/renderer/chat-view.tsx`、`src/renderer/App.tsx`、`src/renderer/home-view.tsx`
  - `src/daemon/prompt-preview.ts`（增加专家选择）+ 测试
  - `src/daemon/subagent-runner.ts`、`src/daemon/automation-runner.ts`（核对 compose 签名，
    子代理/定时会话不继承专家人格与私有技能 —— 现状即如此，仅需核对注释与断言）

## ADDED Requirements

### Requirement: 专家与交互模式正交

`expertId` SHALL 作为与 `interactionId` 平行的独立会话状态；任何交互模式切换
SHALL NOT 改变 `expertId`，专家的选择与取消 SHALL NOT 改变 `interactionId`。
系统 SHALL 支持 `{ask, craft, plan} × {无专家, 任意专家}` 的 6 种组合。

#### Scenario: 计划 + 专家

- **WHEN** 会话当前为 plan 模式，用户选择一个专家
- **THEN** `interactionId` 保持 `plan`，`expertId` 落为该专家；随后发消息时
  系统提示词同时含 plan 模式行为段与专家人格段

#### Scenario: 切模式不清专家

- **WHEN** 会话已绑定专家，用户切到 ask
- **THEN** `expertId` 不变，人格段仍在提示词中，工具面收窄为 ask 的白名单

#### Scenario: 取消专家不改模式

- **WHEN** 会话为 plan + 专家，用户取消专家选中
- **THEN** `interactionId` 仍为 `plan`，仅 `expertId` 被清空

#### Scenario: 不存在裸 expert 模式

- **WHEN** 加载 `resources/modes/`
- **THEN** 只有 ask / craft / plan 三个模式，不再有 `expert`

### Requirement: 专家私有技能预加载

专家目录 SHALL 支持可选的 `skills/` 子目录。会话绑定的专家有私有技能时，
系统 SHALL 把这些技能加入该会话的可用技能清单（`<available_skills>` 段），
且该专家未绑定时 SHALL NOT 出现。

#### Scenario: 绑定后技能可见

- **WHEN** 会话绑定带 `skills/` 的「证券研报」专家
- **THEN** 系统提示词的技能清单段含该专家的私有技能名，且模型可用 read 读取其 SKILL.md

#### Scenario: 未绑定不可见

- **WHEN** 会话未绑定该专家
- **THEN** 技能清单段不含其私有技能

#### Scenario: 模式无读取工具时不注入

- **WHEN** 会话绑定专家的同时处于工具白名单无 `read` 的模式
- **THEN** 技能清单段不注入（与现有 `hasSkillReader` 门控一致）

### Requirement: 专家技能重名防护

专家私有技能名 SHALL NOT 与全局技能（`resources/skills/`）或其它已绑定专家的
技能重名；加载时命中重名 SHALL 响亮报错并指明冲突文件。

#### Scenario: 重名报错

- **WHEN** 某专家 `skills/` 下的技能名与全局技能同名
- **THEN** 加载抛错，错误信息含两边文件路径

### Requirement: 搬用技能的来源标注

从 WorkBuddy 原样搬入的技能 SHALL 在所在专家目录的 README 注明来源、搬入日期
与「待定制」状态（AGENTS.md §6）。

#### Scenario: 来源可追溯

- **WHEN** 查看 `resources/experts/stock-research-report/README.md`
- **THEN** 可见来源为 WorkBuddy `equity-research` 专家包、搬入日期、含哪三个技能

## MODIFIED Requirements

### Requirement: 专家人格注入条件

原「`interactionId === "expert"` 时解析并注入人格」改为「`expertId !== undefined`
时解析并注入」，与交互模式解耦。人格注入位置（前部槽位带 Role Override 声明 +
末尾 `<current-expert>` 钉子段）与风格让位语义保持不变
（spec: align-expert-system-workbuddy 已落地，本次不动）。

### Requirement: 专家资源加载

原「`resources/experts/<name>.md` 单文件」改为「`resources/experts/<name>/expert.md`
目录」；`frontmatter.name` SHALL 等于**目录名**（原为文件名）。加载器额外收集
`<dir>/skills/` 下的技能目录路径并随 `ExpertDefinition` 对外暴露。

### Requirement: 会话技能加载入口

`listSkills` 由无参改为接受可选的专家技能目录；daemon 组装会话时按当前绑定的
专家传入。全局技能与用户/项目技能的现有加载行为不变。

## REMOVED Requirements

### Requirement: expert 交互模式

**Reason**: 专家与交互模式正交（WorkBuddy 实证），把专家做成模式会让
「计划/问答 + 专家」不可达，并使取消专家副作用到用户的模式选择。

**Migration**: `resources/modes/expert.md` 删除；`applyInteraction` 的 `expertId`
第三参删除；`INVOKE.setExpert` 改为只读写 `expertId`。历史会话若
`interactionId` 存的是 `"expert"`，resume 时 SHALL 归一为 `craft`（并保留
`expertId`），保证旧会话可用。
