# 证券研报专家 —— 私有技能来源说明

## 来源

本目录 `skills/` 下的技能**原样搬用**自 WorkBuddy 内置专家包 `equity-research`：

- 原始路径：`plugins/marketplaces/experts/plugins/equity-research/skills/`
- 搬入日期：2026-09-14
- 搬入方式：逐字节原样复制，未改动任何内容（文件名、目录层级、正文均与源一致）

## 含哪三个技能

| 技能 | 一句话说明 |
|------|-----------|
| `comps-valuation` | 可比公司（Comps）相对估值：选同业组合、算 P/E · EV/EBITDA 等倍数、推导估值区间与隐含涨跌。 |
| `dcf-model-builder` | DCF 现金流折现与三表联动财务建模：收入驱动 → 三表 → WACC → DCF / 终值 → 敏感性与情景分析。 |
| `initiating-coverage` | 个股首次覆盖研报的 5 步流程：公司研究 → 财务建模 → 估值 → 图表生成 → 报告组装（投行体例 30–50 页）。 |

## 已知差异 / 待定制（不阻塞本轮）

搬入内容为 WorkBuddy 原文，与本项目的中文 / A 股语境存在偏差，**待后续定制替换**：

- `initiating-coverage` 为**英文**原文，且面向**美股语境**：数据源引 SEC EDGAR（10-K / 10-Q / DEF 14A / 8-K）、
  研报体例对标 JPMorgan / Goldman Sachs / Morgan Stanley。需改为中文并替换为 A 股信息披露渠道
  （交易所公告、巨潮资讯、招股说明书等）。
- `comps-valuation` / `dcf-model-builder` 为中文，但其中仍带国际准则语境（IFRS / GAAP / 中国准则对照、
  美元符号示例），后续按 A 股实务与人民币口径对齐。
- 三者均未与现有 `resources/skills/` 全局技能（`docx` / `typeset` 等）做过交集裁剪，后续定制时留意。

## 合规说明

按 AGENTS.md §6（2026-09-10 用户决策）：内部使用阶段允许直接搬用 WorkBuddy 资产，
正式上线前由专人做风险置换。本目录技能属于该阶段的直接搬用资产。
