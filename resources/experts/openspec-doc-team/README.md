# 专业文档生成团队（Professional Document Generation Team / 专业文档生成团队）—— 来源与搬用说明

## 来源

- 专家市场：`https://acc-1258344699.cos.accelerate.myqcloud.com/workbuddy/expert-marketplace`（公开 COS，WorkBuddy 专家中心）
- 市场条目 id：`OpenSpecDocTeam`（专业文档生成团队 / Professional Document Generation Team）
- 人设正文：`/plugins/openspec-doc-team/agents/doc-team-lead.md` 的正文**原样**（源 frontmatter 已剥离，本目录 expert.md 的 frontmatter 按本项目加载器契约新写），14923 字节
- 抓取时间：2026-09

## 技能

源包未声明技能（纯人设专家）。

## 成员人格与本地化（2026-09-18，spec: fix-team-expert-assets）

源包为 team 型专家团（主理人 + 3 位成员，源包自带 `agents/`）；搬入时只取了主理人人设。
本轮按源包结构补齐并本地化：

- 成员人格落到本目录 `agents/`：`doc-researcher`（苏寻源）、`doc-generator`（支笔生）、
  `doc-auditor`（严审之）——Agent ID 即文件名，人设按源包成员职责 + 本专家各 Phase 的
  下发任务**重写**，不是逐字节搬用。
- 调度语义：源包正文指挥 `TeamCreate` + `Agent(name, subagent_type)`，本产品没有这两个工具，
  照搬会让建团必然失败。已改写为 `team_create`（`name` 填花名、`agent` 填 Agent ID）/
  `team_send` / `team_status` / `team_delete`，并写明产出自动回投、并行副本必须唯一 `name`。
- frontmatter 加 `expertType: team`（专家市场「专家团」页按它筛选）。
- **未改**：Workflow A–F、项目参数卡、6 维审核标准、退回规则、铁律与禁止行为。

## 合规说明

按 AGENTS.md §6（2026-09-10 用户决策）：内部使用阶段允许直接搬用 WorkBuddy 资产，
正式上线前由专人做风险置换。成员人设为本轮重写，不属照搬资产。
