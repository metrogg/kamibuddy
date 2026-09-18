# 搬入 WorkBuddy 真团队专家包（import-workbuddy-team-experts）Spec

> 与 `fix-team-expert-assets` 相邻但独立：那份修的是「资产与运行时错配」的机制与门禁，
> 这份是**往库里加两个真团队专家**（资产搬入 + 本地化）。

## Why

`fix-team-expert-assets` 完成时库里只有两个团队专家，且都是**照搬后本地重写成员人设**的
（成员人格是我们按源包职责写的，不是源的原文）。用户要「完整搬一两个真团队团来测效果」。

找包的过程本身是个教训：**项目内的解包副本（`docs/WorkBuddy/**`）只有内置单体专家，
没有团队包**；真包在用户级目录——

- `C:\Users\wzd\.workbuddy\plugins\marketplaces\experts\plugins\{gpt-researcher-team, mvp-dev-expert-team, stock-partner-team, software-company, fbsir-super-partner, a-share-analysis, …}`
- `C:\Users\wzd\.codebuddy\plugins\marketplaces\cb_teams_marketplace\plugins\{trading-agent, ai-hedge-fund, product-management, investment-banking, …}`
- 用户实际跑过的团队会话：`C:\Users\wzd\.workbuddy\teams\{research-ai-coding-tools, software-agenthub, stock-partner-roundtable}`
  （`teams/*/inboxes/*.json` 是 WorkBuddy 成员信箱落盘，可用来对照真实协作轨迹）

本批搬入 **`stock-partner-team`**（用户跑过 `stock-partner-roundtable`，效果可对照）与
**`mvp-dev-expert-team`**（7 成员 + 24 篇知识库，流程最完整）。

## What Changes

1. `resources/experts/stock-partner-team/`：主理人 `expert.md` + `agents/` 6 员 + `skills/` 3 个
   （`westock-data` / `westock-tool` / `md-to-html`）+ `README.md`。
2. `resources/experts/mvp-dev-expert-team/`：主理人 `expert.md` + `agents/` 7 员 +
   `references/` 24 篇 + `README.md`。
3. 展示字段（`displayName` / `profession` / `displayDescription` / `tags` / `quickPrompts`）
   全部取自源 `plugin.json` 的 `zh` 值——不再由我们编。
4. 成员人设：源 `agents/*.md` **正文逐字节保留**，只补/改 frontmatter。
5. 本地化（不改就跑不起来，逐条记在两个包的 README）：
   - 工具语义：`TeamCreate`→`team_create`；`SendMessage`→「产出自动回投」；
     `subagent_type`→`members[].agent`；补 `team_send` / `team_status` / `team_delete` 的用法。
   - **成员 `name` 语义相反**：源要求 `name` = Agent ID、禁止中文名（它的 UI 用
     `members[].id` 匹配 `displayName`）；我们的 `name` 是 `@寻址` 键，必须用**花名**
     （花名取自源成员 frontmatter 的 `displayName.zh`），`agent` 才是 Agent ID。
   - **成员看不到专家包**：成员 cwd 是用户项目，`references/…` 对成员不可达。
     MVP 包的「知识库调度规则」改写为「主理人读哪篇、摘什么要点进成员的任务说明」；
     每个成员正文开头加了一段本地化说明（含这条）。
   - **行情依赖降级**：stock 包的取数技能走 westock MCP，而我们的成员工具面不含
     `use_skill`、用户也未必连了该数据源——每个成员正文加了降级：改用
     `web_search` / `web_fetch` 取公开行情与财报并注明来源与时间。
   - 源成员 frontmatter 的 `displayName` / `profession` / `maxTurns` **剥离**
     （见否决方案），并按我们的 agent 契约补齐 **`tools` 白名单**（源包没有这个字段）。

## 否决方案

- **从公开 COS 市场下载包**：否。`acc-1258344699.cos.accelerate.myqcloud.com/workbuddy/expert-marketplace`
  全路径 404（需签名/前缀已变），本机已有真包，不必依赖外网。
- **搬 `software-company`（4 员，用户跑过 `software-agenthub`）**：否（本批）。
  它只有 4 员、人设较短（主理人 11KB），信息密度低于另两个；先搬两个规模与流程更完整的，
  验证链路通了再补。留作下一批。
- **保留源成员 frontmatter 的 `displayName` / `profession` / `maxTurns`**：否。
  它们是 YAML 缩进块，我们的极简 frontmatter 解析器对「值为空 + 缩进内容」**抛错**
  （这是刻意的：静默当空串会让工具白名单这类关键字段悄悄丢失）；且 `maxTurns`
  在本运行没有对应开关（成员是长会话）。剥离而非兼容，是为了不往解析器里加半成品 YAML。
- **保留源的「name 用 Agent ID」语义**：否。我们的 `name` 同时是用户在输入框 `@` 的寻址键
  与 UI 展示名，用 Agent ID 会让 `@industry-strategist` 这种英文串出现在中文界面里，
  而 WorkBuddy 自己的 team-spec 也规定 name 要用花名、禁止拿 Agent ID 当 name。
- **把 `references/` 删掉、让成员只靠正文纪律**：否。24 篇知识库是这个包的主要价值
  （工程纪律/架构模式/设计系统/成本模型），删了等于把专家降成通用流水线。
  改为「主理人摘要点进任务说明」——成员拿不到文件，但内容不丢。
- **给成员加 `use_skill` 工具让它自己调行情技能**：否（本批）。成员工具面改动牵动
  深度锁与权限门（子代理工具面是既有决策），且技能依赖的 westock MCP 未必已连接；
  先用降级路径把链路跑通，技能可见性另开议题。

## Impact

- 新增：`resources/experts/{stock-partner-team,mvp-dev-expert-team}/`（含 agents/、skills/ 或 references/、README.md）
- 改：`src/core/experts.test.ts` 的真实目录回归（14 员 → 16 员；钉住两个新包的
  `expertType`、成员名单、私有技能数量；displayName/profession 映射补两项）
- 不改：加载器、门禁脚本、运行时（本批纯资产）

## 验证

- `npm run check:expert-assets`：4 个团队专家 / 22 名成员，成员与正文引用全部对得上，
  无 `TeamCreate` / `subagent_type` / `Agent(` 残留。
- `src/core/experts.test.ts` + `src/core/agents.test.ts`：73 passed。
- 全量 vitest：2698 passed / 1 failed —— 失败项
  `src/sandbox/confinement.win.test.ts「超时杀掉整棵进程树」`是既有的并发压力 flaky
  （单独复跑 9 passed），与本次改动无交集。
- 真机（待用户）：开「智能体团队（实验）」→ 选「腾讯自选股股票投研专家团」→
  问一个多头对比问题，看是否起 6 名成员、圆桌报告是否回投。
