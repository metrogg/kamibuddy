# 股票研究专家（equity-research）—— 来源与搬用说明

## 来源

本专家**原样搬用**自 WorkBuddy 专家市场包 `equity-research`：

- 原始路径：`plugins/marketplaces/experts/plugins/equity-research/`
- 搬入日期：2026-09-14
- 人设：`agents/equity-research-expert.md` 的**正文原样**（源 frontmatter 已剥离，
  本目录 `expert.md` 的 frontmatter 为本项目按加载器契约新写）。
- `skills/`：逐字节原样复制，未改动文件名、目录层级与正文。

## 含哪 15 个技能

| 技能 | 一句话说明 |
|------|-----------|
| `initiating-coverage` | 投行级首次覆盖研报 5 步流程：公司研究 → 财务建模 → 估值 → 图表生成 → 报告组装（Task 1/2 可并行）。 |
| `earnings-analysis` | 盈利分析，含「财报前瞻」与「财报深度」两种模式（原 `earnings-preview` 已并入此技能）。 |
| `dcf-model-builder` | DCF 现金流折现 + 利润表/资产负债表/现金流量表三表联动建模。 |
| `comps-valuation` | 可比公司（Comps）相对估值：选同业组合、算关键倍数、推导估值区间。 |
| `long-short-pitch` | 结构化多头/空头投资推介：论点框架、催化路径、估值支撑、风险与仓位。 |
| `memo-builder` | 投资备忘录撰写：把投资逻辑与分析组织成供投委会/团队讨论的结构化备忘。 |
| `model-update` | 模型更新：财报/指引/宏观或假设变化后调估算、重算估值、标记重大变动。 |
| `company-tearsheet` | 公司一页纸速览（Tearsheet）：业务描述、关键财务、估值、股东结构、近期催化。 |
| `sector-overview` | 行业/板块综述：市场动态、竞争格局、关键玩家、主题趋势。 |
| `event-scenario-analyzer` | 事件驱动与情景敏感性分析：拆解事件（业绩/政策/并购/监管）对股价的影响并做多情景定量。 |
| `catalyst-calendar` | 催化剂日历：跟踪财报日、会议、产品发布、监管决定与宏观事件。 |
| `thesis-tracker` | 投资逻辑跟踪：维护持仓/观察名单的论点、数据点、催化与里程碑。 |
| `idea-generation` | 系统化选股与想法筛选：量化筛选 + 主题研究 + 形态识别。 |
| `portfolio-risk` | 组合风险管理：把论点转成仓位大小、对冲策略、暴露管理与监控规则。 |
| `morning-note` | 晨会纪要：隔夜动态、交易想法、覆盖标的的关键事件，7 点晨会体例。 |

## 已知差异 / 待定制（不阻塞本轮）

- 技能多为**英文**且面向**美股语境**：数据源引 SEC EDGAR（10-K/10-Q/DEF 14A/8-K），
  研报体例对标 JPMorgan/Goldman/Morgan Stanley；`catalyst-calendar`、`model-update`、
  `thesis-tracker`、`morning-note`、`idea-generation`、`sector-overview` 描述全文为英文。
  需改为中文并替换为 A 股信息披露渠道（交易所公告、巨潮资讯、招股说明书等）。
- `comps-valuation` / `dcf-model-builder` / `long-short-pitch` / `memo-builder` /
  `portfolio-risk` / `event-scenario-analyzer` / `company-tearsheet` / `earnings-analysis`
  为中文，但仍带国际准则语境（IFRS/GAAP 对照、美元示例），待按 A 股实务与人民币口径对齐。
- **未搬 `earnings-preview`**：源包 `skills/` 下实际存在第 16 个目录 `earnings-preview`，
  但其 `SKILL.md` 自标 `[DEPRECATED] Merged into earnings-analysis skill` 且 `disable: true`，
  源包 `plugin.json` 的 `skills` 清单亦未声明它，人设正文的 15 项职责表同样把它并入
  `earnings-analysis`。故本轮只搬 `plugin.json` 声明的 15 个。
- 15 个技能均未与现有 `resources/skills/` 全局技能做过交集裁剪（当前无重名），后续定制时留意。

## 合规说明

按 AGENTS.md §6（2026-09-10 用户决策）：内部使用阶段允许直接搬用 WorkBuddy 资产，
正式上线前由专人做风险置换。本目录人设与技能均属该阶段的直接搬用资产。
