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

## 与源包的形态差异（重要）

**源包为专家团（team 型，7 agents），本轮按单人设拍平，只取主理人 `research-chief-editor`；
多 agent 协作待 C11 多代理团队能力落地。**

- 未搬的 6 位成员：`research-planner`、`topic-researcher`、`draft-reviewer`、
  `draft-reviser`、`report-writer`、`report-publisher`。
- 人设正文仍保留完整的团队协作机制（TeamCreate、按 Agent ID 调度 6 位成员、5 阶段
  Workflow A/B/C、研究参数卡、成员超时降级表等）。在本仓库多代理团队能力落地前，
  这些内容只能作单人设参考，无法真正执行跨成员调度。
- 拍平阶段 frontmatter 不含源包的 `teamInfo` / `members` 字段。

## 待定制项

- 待 C11 多代理团队能力落地后，按源包 7 agents 结构恢复成员，或把人设正文中的团队协作
  机制改写到与 pi 子代理/团队能力匹配。
- 正文为中文，未与现有 `resources/skills/` 全局技能做过交集裁剪。

## 合规说明

按 AGENTS.md §6（2026-09-10 用户决策）：内部使用阶段允许直接搬用 WorkBuddy 资产，
正式上线前由专人做风险置换。本目录人设属该阶段的直接搬用资产。
