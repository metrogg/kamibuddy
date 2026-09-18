# 修复团队专家资产与运行时错配（fix-team-expert-assets）Spec

## Why

2026-09-18 的专家团对比分析（结论记在 `.workbuddy/memory/2026-09-18.md`）
查出**资产层错配**：`resources/experts/` 下的两个团队型专家是照搬 WorkBuddy
`expert-manager/references/team-spec.md` 的产物，人设正文指挥的是**另一套运行时**，
而我们自己的团队运行时（`add-team-foundations` 批 5）根本不吃这套指令：

1. **工具名不存在**：两个专家的「协作铁律」要求调 `TeamCreate` 建团、
   `Agent(name, subagent_type)` 调度成员（`gpt-researcher-team/expert.md:26`、
   `openspec-doc-team/expert.md:26`、`:40`）。我们的工具面里是
   `team_create / team_send / team_status / team_delete`
   （`src/extensions/team-tools.ts:124-264`）与 `task`（`task-tool.ts:129`），
   **没有 `TeamCreate`、没有 `Agent`、没有 `subagent_type` 参数**。
2. **成员人格不存在**：正文点名的 9 个 Agent ID（research-planner / topic-researcher /
   draft-reviewer / draft-reviser / report-writer / report-publisher、doc-researcher /
   doc-generator / doc-auditor）**不在 `resources/agents/`**（只有 planner / reviewer /
   scout / worker 四个通用角色）。而 `startTeam` 对每个成员做
   `agents.find((a) => a.name === member.agentName)`，找不到就抛错并**整队解散**
   （`src/daemon/index.ts:2556-2559`、`:2626-2628`）。
3. **UI 无处可去**：专家定义没有类型字段，两个 team 专家只能在「专家」页里混入，
   「专家团」子 tab 至今是 `EmptyState` 占位（`src/renderer/experts-view.tsx:212-213`）。

后果：绑定这两个专家后，模型要么撞不存在的工具，要么退回到人设里明令禁止的
「自己模拟成员发言」——**专家团在这个界面上名存实亡**。本 spec 修的就是这一段，
不动团队运行时本身（批 5/批 8 已验证通过，机制层不在本批范围）。

## What Changes

1. **专家包新增 `agents/` 目录（成员人格）**：
   - `<expert>/agents/<agent-id>.md`，格式与 `resources/agents/*.md` **完全一致**
     （frontmatter `name`/`description`/`tools`，可选 `model`；正文是提示片段）——
     复用 `core/agents.ts` 的解析，不另写一套。
   - `ExpertDefinition` 加 `agentsDir?: string`（与既有 `skillsDir` 同款，
     没有 `agents/` 时为 undefined）。
   - 加载器校验（**从紧，坏文件抛错**）：`agents/` 存在但为空 → 抛错；
     成员文件缺 `name`/`description`/`tools` 或 `tools` 为空 → 抛错（沿用
     `loadAgentFile`）；成员名与**全局 agents 库**重名 → 抛错（理由见否决方案）；
     专家之间同名 → **允许**（自包含纪律，与私有技能同规则，
     `core/experts.ts:287-295`）。
2. **成员人格与全局库按当前专家动态合并**：
   - `core/agents.ts` 导出 `loadAgentsDir(dir)` 与纯函数
     `mergeAgentPools(globalAgents, expertAgents)`（后者可单测）。
   - daemon 装配把「agents 清单」从**常量**改为**按当前专家解析的函数**
     （`src/daemon/index.ts:2073` 附近），task 与 team 工具的 `listAgents`
     以及 `startTeam` 里的 `agents.find` 都走它。
   - **必须动态**：用户在对话中 `setExpert` 切到团队专家是常态路径，
     装配期一次性合并会让「切完专家仍无成员人格」，等于没修。
     `bucket.conversation.state.expertId` 是会话状态，闭包读它即实时生效，
     不需要改 `toolsOverride` / 工具面重应用链路。
3. **改写两个团队专家的人设正文**（`gpt-researcher-team/expert.md`、
   `openspec-doc-team/expert.md`）：
   - 工具语义换成 `team_create {name, members:[{name, agent, task}]}`、
     `team_send {to, text}`、`team_status`、`team_delete`；删掉 `subagent_type`
     与 `TeamCreate`/`Agent` 字样。
   - 成员表保留（它是模型知道该 spawn 谁的唯一来源），每格写清
     `成员名`（中文花名，`@寻址` 与 team_create 的 `name` 参数用）与
     `agent`（= 私有 `agents/` 下的文件名，即 Agent ID）。
     命名守 WorkBuddy `team-spec.md` 的规范：**name 是花名、不许拿 Agent ID 当 name、
     不许中文名之外的自创名**——这也正好是 `team_create` 的 `name` 参数语义
     （`@寻址` 唯一键，用户在输入框 @ 补全就是它）。
   - 「消息中转」「成员结论为准」「禁止自模拟」等铁律**保留不改**（那是价值所在）。
4. **专家定义加 `expertType`（缺省 `"expert"`），点亮专家团 tab**：
   - frontmatter 可选键，值域 `expert | team`；两个团队专家声明 `team`，
     其余 12 个内置专家不声明（行为逐字节不变）。
   - `ExpertListItem`（`src/shared/ipc.ts:739`）加该字段，`listExperts` 映射补上
     （`src/daemon/index.ts:4240-4250`），renderer「专家团」tab 按它过滤，
     无 team 专家时才回落 `EmptyState`。
5. **护栏脚本 `scripts/check-expert-assets.ts`（`npm run check:expert-assets`，
   接入 `check` 链）**——防止同款错配再次发生：
   - 声明 `expertType: team` 的专家必须有非空 `agents/`；
   - 正文里 `agent: "xxx"` 形式的每个 ID 必须存在于该专家的 `agents/`；
   - 正文不得出现 `TeamCreate` / `subagent_type` / `Agent(` 三个禁止串；
   - 专家私有 agent 名不得与全局 `resources/agents/` 重名。
   护栏上线前先人为破坏一次，确认它真会红（AGENTS.md §8）。

**明确不做（本批）**：团队运行时与工具面本身（批 5/批 8 产物不动）；
共享任务列表、单成员 shutdown、委派模式、plan 审批、团队落盘（P1/P2，各自 spec）；
专家市场/安装/创建链路；把 team 工具可见性改成「只有 team 专家可见」（见否决方案）；
`expertType` 的另两个 WorkBuddy 取值（skill/plugin）。

## 否决方案

- **把 9 个成员人格塞进全局 `resources/agents/`（扁平）**：否。①语义污染——
  这些是「某团队的角色」，全局库是给 `task` 工具单派用的通用人格，混进去后
  任何会话都能派发 `topic-researcher`，且聚合进全局清单会稀释模型注意力；
  ②名字与用户级 `~/.kamibuddy/agents/` 冲突面变大；③专家不再自包含
  （AGENTS.md §3 与 `experts.ts:287-295` 对私有技能已定的纪律）。
- **不改人格，把 prompt 改成复用现有 planner/scout/reviewer/worker 四角色**：否。
  团队专家的全部价值就是专业分工（课题研究员 / 审稿人 / 估值建模…），
  换成四个通用角色等于把专家团退化成一条通用流水线，不如直接删掉这两个专家。
- **专家包内 `agents/`，但只在建会话时合并一次（不做动态解析）**：否。
  用户切专家（`setExpert`）是主路径，静态合并下切完仍然
  「没有名为「topic-researcher」的子代理定义」，修了等于没修。
- **让 `team_create` 直接接受成员人设文本（人设写在工具参数里）**：否。
  ①人设要能被 prompt 引用、可复用、可被护栏校验，写进工具参数三者皆失；
  ②每次调用都把长人设带进请求，token 与 KV 缓存前缀都要付出代价
  （`team-tools.ts` 文件头的模型体验契约要求定义常驻、字面量恒定）；
  ③违反 AGENTS.md §3「能力是数据不是代码」。
- **`expertType` 照搬 WorkBuddy 四值（skill/agent/plugin/team）**：否。
  我们只有「人格」一种专家形态，另两值没有对应运行时，加了就是死字段
  （AGENTS.md §9 YAGNI）。取 `expert | team` 两值，需要时再扩。
- **字段名用 `type` 而不是 `expertType`**：否。`type` 与 TS 关键字/常见字段名撞，
  且 WorkBuddy 的词汇就是 `expertType`，对齐它便于日后对照（AGENTS.md：
  机制类词汇优先对齐参照实现）。
- **本批顺手把 team 工具可见性改成「仅 team 专家可见」（等价 WorkBuddy 的
  expertType 覆盖全局开关）**：否。当前是「全局开关 `agentTeamsEnabled` +
  craft 白名单」，已真机验证；改可见性会同时动工具面与开关语义、牵动 KV 前缀
  稳定性（工具集是前缀的一部分）。范围控制在本批不碰，留作 P2 独立 spec。

## Impact

- Affected code：
  - `src/core/agents.ts`（导出 `loadAgentsDir`；新增 `mergeAgentPools` 纯函数）
  - `src/core/experts.ts`（`agentsDir`、`expertType` 解析与校验；文件头注释同步）
  - `src/daemon/index.ts`（`:2073` 动态 agents 解析；`:2556` find 改走解析函数；
    `:4240` listExperts 补字段）
  - `src/shared/ipc.ts`（`ExpertListItem` 加 `expertType`）
  - `src/renderer/experts-view.tsx`（团队 tab 过滤）
  - `scripts/check-expert-assets.ts`（新）+ `package.json`（`check:expert-assets` 与 `check` 链）
  - `resources/experts/gpt-researcher-team/`、`resources/experts/openspec-doc-team/`
    （正文改写 + 新增 `agents/*.md` 共 9 个）
- 不改：`team-tools.ts` / `team-runtime.ts` / `member-runner.ts` / `mailbox.ts` /
  `child-agents.ts`（运行时与本批无关）；`todo` 契约；IPC 通道集（只加字段不加通道）。

## ADDED Requirements

### Requirement: 专家私有成员人格

专家目录 SHALL 支持可选 `agents/`（每个成员一个 `<id>.md`，格式同全局 agents 库）；
加载后挂在 `ExpertDefinition.agentsDir`。`agents/` 存在但为空、成员文件字段缺失、
或成员名与全局 agents 库重名 SHALL 响亮抛错。

#### Scenario: 团队专家自带成员

- **WHEN** 团队专家声明 `agents/` 且成员文件合法
- **THEN** 绑定该专家的会话里，team 工具的可用成员人格 = 全局库 ∪ 该目录

#### Scenario: 与全局库重名即失败

- **WHEN** 专家私有成员名与 `resources/agents/` 或用户级 agents 同名
- **THEN** 加载抛错并指出两边文件（`team_create` 的 find 会静默取先者，必须拦在加载期）

### Requirement: 成员人格随当前专家动态解析

agents 清单 SHALL 按会话当前绑定的专家动态解析（不是建会话时的一次性快照），
`task` / `team_*` 工具的 `listAgents` 与成员 spawn 解析 SHALL 走同一函数。

#### Scenario: 对话中切到团队专家

- **WHEN** 会话运行中 `setExpert` 切到团队专家
- **THEN** 随后的 `team_create` 能看到该专家的私有成员人格并成功建团

### Requirement: 团队专家人设与运行时一致

团队专家正文 SHALL 只使用我方实际存在的工具名与成员 ID；
SHALL NOT 出现 `TeamCreate` / `subagent_type` / `Agent(`。

#### Scenario: 建团可执行

- **WHEN** 用户绑定团队专家并下达需要协作的任务
- **THEN** 模型用 `team_create` 带正确的成员名与 agent ID 建团，成员成功 spawn，
  不出现「没有名为「X」的子代理定义」

### Requirement: 专家类型与专家团入口

专家定义 SHALL 支持可选 `expertType`（`expert | team`，缺省 `expert`）；
专家市场「专家团」子 tab SHALL 只展示 `expertType: "team"` 的专家，
无此类专家时才显示空态。

#### Scenario: 专家团页有内容

- **WHEN** 打开专家市场并切到「专家团」
- **THEN** 两个团队型专家出现在该页，其余专家不出现

## 验证

- `npm run typecheck`、`npm run check:deps`、`npm run check:tokens`、
  `npm run check:model-experience`、`npm run check:invariants`、
  `npm run check:expert-assets`、`npm test` 全绿，附实跑输出。
- 护栏先破坏后修复：至少人为制造一次「正文引用不存在的 agent ID」确认脚本变红。
- 真机：开启「智能体团队（实验）」开关，绑定「深度研究团队」，观察
  `team_create` 是否带出 6 名成员且无 spawn 报错。
