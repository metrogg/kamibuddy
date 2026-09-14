# 长文档写作与改稿专家（福帮手）—— 来源说明

## 人设来源

本目录 `expert.md` 的人设正文为**自撰**：

- 该专家的源专家包**未下载到本地**（`docs/WorkBuddy/` 下没有对应的包目录），
  无法像其它专家那样原样搬用正文。
- 撰写依据是 WorkBuddy 专家市场清单中的 metadata：展示名「福帮手」、职业头衔
  「长文档写作与改稿专家」、能力定位、tags 与 3 个起手问题（`quickPrompts` 原样采用）。
- 人设结构对齐仓库既有专家（角色定义 / 核心能力 / 工作流程 / 输出规范 / 注意事项），
  正文为新写，非从别处复制。

## 私有技能来源

`skills/` 下的 9 个技能**逐字节原样搬用**自 WorkBuddy `tencent-docx` 插件的内部
**文体写作技能**目录：

- 原始路径：`docs/WorkBuddy/resources/app.asar.unpacked/resources/plugins/workbuddy-builtin/builtin-plugins/tencent-docx/experts/`
- 搬入日期：2026-09-14
- 搬入方式：逐字节原样复制（含 `SKILL.md` 与各自的 `references/`、`assets/`、`scripts/`
  子目录），未改动任何内容——文件名、目录层级、正文与源一致。

> 说明：这 9 个目录在源包里是 `tencent-docx` 插件内部的**文体写作技能**（并非市场专家），
> 之前被错误地取为 9 个顶层专家（`resources/experts/<name>/expert.md`）。本轮把它们
> 降级为技能，统一挂到「长文档写作与改稿专家」之下，并删除了那 9 个旧专家目录。

| 技能目录 | 技能名（frontmatter `name`） | 文件数 | 字节数 |
|----------|------------------------------|-------|-------|
| `academic-paper-expert` | `academic-paper-expert` | 1 | 3,152 |
| `business-copy-expert` | `business-copy-expert` | 12 | 30,554 |
| `general-writer` | `general-writer` | 5 | 15,276 |
| `legal-contract-expert` | `legal-contract-expert` | 5 | 19,686 |
| `poetry-prose-expert` | `poetry-prose-expert` | 1 | 2,925 |
| `science-writing-expert` | `science-writing-expert` | 1 | 2,873 |
| `stock-research-report-expert` | `stock-research-report-expert` | 2 | 16,694 |
| `tech-blog-expert` | `tech-blog-expert` | 11 | 35,123 |
| `work-report-expert` | `work-report-expert` | 1 | 2,961 |

9 个技能共 39 个文件 / 129,244 字节。技能名两两不重名，且与全局技能
（`resources/skills/`：`docx` / `frontend-design` / `meeting-notes` / `web-interface-guidelines`）
均不重名。

## 已知差异 / 待定制（不阻塞本轮）

- `general-writer` 的 frontmatter description 自称「L1 通用写作兜底专家……当 L0 路由未命中
  任何 L2 专家时作为兜底触发」。这是**源包内部的路由层级用语**：在 `tencent-docx` 里它是
  被路由兜底调用的技能，搬成专家私有技能后，这个「兜底」语义只在「用户未指定文体 / 没有
  专门规范」的场合成立，不再是自动路由的一环——由专家人设显式判断后调用。按 AGENTS.md §6
  的逐字节保留要求，本轮**未改文件内容**，留待后续定制。
- 9 个技能正文均来自 WorkBuddy 原文，与本项目语境可能存在偏差，后续按需定制。

## 合规说明

按 AGENTS.md §6（2026-09-10 用户决策）：内部使用阶段允许直接搬用 WorkBuddy 资产，
正式上线前由专人做风险置换。本目录 `skills/` 下的技能属于该阶段的直接搬用资产；
人设为自撰内容，不涉及第三方资产。
