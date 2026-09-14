# 工作台搭建师（workspace-builder）—— 来源与搬用说明

## 来源

本专家**原样搬用**自 WorkBuddy 专家市场包 `workspace-builder`：

- 原始路径：`plugins/marketplaces/experts/plugins/workspace-builder/`
- 搬入日期：2026-09-14
- 人设：`agents/workspace-builder.md` 的**正文原样**（源 frontmatter 中的 `name` /
  `description` / `displayName` / `profession` / `maxTurns` 随 frontmatter 一并剥离；
  本目录 `expert.md` 的 frontmatter 为本项目按加载器契约新写）。
- frontmatter 取值：`displayName` / `profession` / `displayDescription` / `tags` /
  `quickPrompts` 均取自源包 `plugin.json` 的 `zh` 字段。
- 无私有技能（源包没有 `skills/`），故本目录**不含 `skills/`**。

## 已知差异 / 待定制（不阻塞本轮）

- **强依赖 WorkBuddy 内置插件 `skill-library`（资料库）**：人设正文的「前置动作」要求先加载
  资料库 skill，用其「在线 page / 网页发布 + 数据表 + 网盘」三项能力完成搭建、云端存储与
  部署；失败才降级为单文件 HTML + localStorage。本仓库当前**没有**这一内置插件，
  该前置动作与「交付在线链接」的路径不可直接复用。
- 正文提及的 `present_files` 交付方式亦为 WorkBuddy 平台能力，本仓库交付方式不同。
- 待定制方向：把「资料库优先」替换为本仓库的本地工作空间交付路径，保留 localStorage 兜底
  与 10 项铁律（全内联、移动适配、调用链无环、生成后冒烟自检等）。
- 正文为中文，未与现有 `resources/skills/` 全局技能做过交集裁剪。

## 合规说明

按 AGENTS.md §6（2026-09-10 用户决策）：内部使用阶段允许直接搬用 WorkBuddy 资产，
正式上线前由专人做风险置换。本目录人设属该阶段的直接搬用资产。
