# 深度研究团队（gpt-researcher-team）—— 来源与搬用说明

## 来源

本专家搬用自 WorkBuddy 专家市场包 `gpt-researcher-team`：

- 原始路径：`plugins/marketplaces/experts/plugins/gpt-researcher-team/`
- 搬入日期：2026-09-14
- 人设：主理人 `agents/research-chief-editor.md` 的**正文原样**（源 frontmatter 中的
  `name` / `description` / `maxTurns` / `color` 随 frontmatter 一并剥离；本目录 `expert.md`
  的 frontmatter 为本项目按加载器契约新写）。
- frontmatter 取值：`description` 据源包 `plugin.json` 描述翻译；`displayName` /
  `profession` / `displayDescription` / `tags` / `quickPrompts` 取源包 `plugin.json`
  对应值（`zh`；`displayName` / `profession` 按本轮要求指定为「深度研究团队」/
  「多源深度研究报告工坊」）。
- 无私有技能（源包没有 `skills/`），故本目录**不含 `skills/`**。

## 与源包的形态差异

**源包为专家团（team 型，主理人 + 6 位成员，源包自带 `agents/`）。**
2026-09-14 搬入时多代理团队能力未落地，故按单人设拍平；**2026-09-18 已按源包结构补齐成员**
（spec: fix-team-expert-assets）：

- 成员人格：6 位成员落到本目录 `agents/`——`research-planner`、`topic-researcher`、
  `draft-reviewer`、`draft-reviser`、`report-writer`、`report-publisher`（Agent ID 即文件名）。
  人设按源包成员职责 + 本专家各 Phase 的下发任务**重写**，不是逐字节搬用。
- 调度语义：源包正文指挥 `TeamCreate` + `Agent(name, subagent_type)`，本产品没有这两个工具，
  照搬会导致建团必然失败（工具不存在、成员人格也不在 agents 库）。已改写为
  `team_create`（`name` 填花名、`agent` 填 Agent ID）/ `team_send` / `team_status` /
  `team_delete`，并写明产出留在成员会话、主理人用 `team_read` 取回、并行副本必须唯一 `name`。
- 成员超时表改为「软预期」注脚：本运行的成员是长会话，没有硬性 maxTurns 开关。
- frontmatter 加 `expertType: team`（专家市场「专家团」页按它筛选）。
- **未改**：5 阶段 Workflow A/B/C、研究参数卡、6 维审稿标准、质量规则、铁律与禁止行为。
- **头像资产补齐**（2026-09-19）：源 `avatars/` 8 张 png（7 位成员 + `team.png`）复制到本目录
  `avatars/`。源包有 7 位成员，本包 6 位（主理人人格写在 `expert.md`，无独立 agent 文件）。

## 核查结论（2026-09-19 全面体检）

- **工具名本地化已完整**：`agents/*.md` 6 个成员的 `frontmatter.name` 与文件名一致，
  `tools` 均已声明；正文无 `TeamCreate` / `subagent_type` / `Agent(` / `TaskStop` 残留
  （README 里提到这些串是**说明性引用**，不是给模型的指令）。
- **悬空引用为 0**：`expert.md` 中的正文链接与包内路径引用全部可解析。
- **`URL1` / `URL2` / `URL` 不是脏数据**：它们是「研究参数卡」与「引用格式」两段的
  **模板占位示例**，用于告诉模型该填什么，属正常模板。
- **本包不含 `init_task`**：源包没有 `bin/`，正文也没有对该命令的调用
  （唯一带该命令的是 `stock-partner-team`）。

## 待定制项

- 并行加速（多副本）依赖成员名唯一，副本命名规则已写进正文；若后续支持成员级模型选择，
  可给 `topic-researcher` 单独配便宜模型（它跑的轮次最多）。
- 正文为中文，未与现有 `resources/skills/` 全局技能做过交集裁剪。

## 合规说明

按 AGENTS.md §6（2026-09-10 用户决策）：内部使用阶段允许直接搬用 WorkBuddy 资产，
正式上线前由专人做风险置换。本目录人设属该阶段的直接搬用资产。
