# MVP开发专家团（mvp-dev-expert-team）—— 来源与搬用说明

## 来源（本机真实专家市场包，非重建）

- 源包：`C:\Users\wzd\.workbuddy\plugins\marketplaces\experts\plugins\mvp-dev-expert-team`
  （v2.1.1，`expertType: "team"`，author: weiyou）
- 搬入日期：2026-09-18
- 主理人：`mvp-dev-expert-team-team-lead`（大湾区靓仔 · 项目总监）→ 本目录 `expert.md`
- 成员 7 位（源 `agents/*.md` **正文原样**，逐字节保留）：
  `mvp-dev-expert-team-pm`（许清楚）、`-designer`（颜好看）、`-architect`（高见远）、
  `-frontend`（贾思敏）、`-backend`（贝洛奇）、`-qa`（严过关）、`-devops`（卜宕机）
- 展示字段取自源 `plugin.json` 的 `zh` 值
- 知识库 24 篇（源 `references/` 原样搬入，含工程纪律标准、架构模式、设计系统、成本模型等）

## 本地化改动（不改就跑不起来）

1. **工具语义**：源的 `TeamCreate` / `SendMessage` / `subagent_type` 已改为本运行的
   `team_create` / `team_send` / `team_status` / `team_delete`；成员产出改为**自动回投**。
2. **成员 name 语义相反**：源要求 `name` = Agent ID 且禁止中文名（那是为了它的 UI
   用 `members[].id` 匹配 `displayName`）；我们反过来——`name` 是 `@寻址` 键，用**花名**，
   `agent` 用 Agent ID。原「✅/❌ 示例」段已替换为我们的「成员调度（CRITICAL）」段。
3. **知识库可达性（关键）**：源包的「知识库调度规则」让成员去读 `references/…`，
   但**成员的工作目录是用户项目，看不到专家包**。已把该段改写为「主理人读哪一篇、
   摘什么要点写进成员的任务说明」；同时在每个成员正文开头写明包内路径对其不可达，
   不要去找文件。
4. **`maxTurns` 无对应开关**：源 frontmatter 的 maxTurns 已剥离，轮次只作软预期；
   我们的成员是长会话（跑完一轮自然收尾，可用 `team_send` 唤醒）。
5. 源成员 frontmatter 的 `displayName` / `profession` / `maxTurns` 已剥离，
   并按我们的 agent 契约补齐 **`tools` 白名单**（源包没有这个字段）。

## 工具面分配（按角色，本地补齐）

| 成员 | tools |
|---|---|
| pm / architect | read、read_document、find、grep、ls、web_search、web_fetch、write |
| designer | read、find、grep、ls、web_search、web_fetch、write |
| frontend / backend / devops | read、write、edit、find、grep、ls、powershell |
| qa | read、write、edit、find、grep、ls、powershell、web_search |

一律不含 `task`（深度锁：成员不许再委派）、`questionnaire`（成员没有用户在场）、
`automation_*`（定时任务由主会话统一管理）。

## 验证

- `npm run check:expert-assets`：team 专家自带成员、正文引用的 ID 都存在、无禁止串残留。
- `src/core/experts.test.ts` 真实目录回归：钉住本包的 expertType 与 7 名成员。

## 合规说明

按 AGENTS.md §6（2026-09-10 用户决策）：内部使用阶段允许直接搬用 WorkBuddy 资产，
正式上线前由专人做风险置换。本包人设属该阶段的直接搬用资产。
