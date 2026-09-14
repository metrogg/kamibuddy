# 使用统计页（对标 WorkBuddy `/stats`）Spec

## Why

诊断页只覆盖「当前会话 / 本进程」的可观测性（`ObservabilitySnapshot`）。
**跨会话的长期使用画像没有任何视图**：一共用了多少个会话、哪几天在干活、
连续用了多少天、哪个模型吃掉最多 token、花了多少钱 —— 现在都答不出来。
对齐清单里 `VIEW9`（用量热力图 / 日历）、`CACHE7`（命中率趋势）为空行，
`docs/可观测性清单.md` 记为 ❌。

### WorkBuddy 是怎么做的（逆向事实，2026-09-14 核对）

结论先行：**`/stats` 是 CLI 侧的 TUI 面板 + HTTP API，桌面渲染层没有它的界面。**

| 事实 | 证据位置 |
|---|---|
| `GET /api/v1/stats`：「历史使用统计**（跨所有项目）**」，返回 `StatsResult`；无任何查询参数（即**全历史、无时间范围切换**） | `docs/WorkBuddy/resources/app.asar.unpacked/cli/dist/codebuddy.js` @10,642,710，OpenAPI 定义 |
| `GET /api/v1/stats/session`：「当前会话实时统计」，返回 `SessionStatsResult`（apiDuration / runDuration / tokenUsage 含 cacheRead+cacheCreation / fileChanges / cost） | 同上 @10,642,906 |
| 聚合实现在 `StatsServiceImpl.calculateStats()`：遍历 `sessionStore.getAllAcrossProjects()` 的全部会话历史，逐条消息按 **timestamp 归日**、按 **providerData.model** 归模型、按 **toolCall 名** 归工具 | 同上 @11,606,577 —— `StatsServiceImpl`（模块 `68375`） |
| **子代理会话从「会话维度」排除**：`totalSessions` 与 dailyActivity / messageCount / toolUsage 全部 `filter(s => !SessionUtils.isSubAgent(s))` | 同上 |
| **但子代理的 token 用量照算**：模型用量累加那段在 `if (!isSubAgent)` 守卫**之外** —— 子代理烧的 token 是真金白银，排除掉会漏账 | 同上（`calculateStats` 的消息循环里，usage 累加不在 `!eC` 分支内） |
| 无法识别模型的「legacy 会话」整体跳过（`isLegacySession`：全部 assistant 消息都没有 model 或为 `"unknown"`） | 同上 |
| 内部模型远大于公开契约：`{totalSessions, totalMessages, totalDays, activeDays, streaks{current,longest,currentStart,longestStart,longestEnd}, dailyActivity[{date,messageCount,sessionCount,toolCallCount}], dailyModelTokens[{date,tokensByModel}], toolUsage[{toolName,count}], longestSession, averageSessionDuration, modelUsage{model:{inputTokens,outputTokens,cacheReadInputTokens,cacheCreationInputTokens,webSearchRequests,costUSD,contextWindow,displayName}}, firstSessionDate, lastSessionDate, peakActivityDay, peakActivityHour}` | 同上 @11,606,577（`calculateStats` 返回值 + `getEmptyStatsResult`） |
| 公开契约 `StatsResult` **只是内部模型的子集**：`{totalSessions, totalMessages, totalTokens{input,output}, totalCost, streakDays, heatmap[{date,count}], modelUsage[{model,count,tokens}], toolUsage[{tool,count}]}` | 同上 @10,670,357 |
| 热力图构造 `generateHeatmapData(activity, width=56)`：`weeks = clamp(width-8, 10, 52)`，7 行（周日起）× N 列（周），首列 = 今天所在周的周日往前推 `(weeks-1)*7` 天；月度标签在「周日且月份变了」那一列 | 同上 @13,008,xxx（模块 `13408`） |
| 热力等级 `getActivityLevel(count, max)`：`0→0`；`ratio≤.25→1`、`≤.5→2`、`≤.75→3`、`else→4`（`count/max`，max = 全部天里最大 messageCount） | 同上 |
| 颜色只有 4 级 + 空：图例字面量 `"Less ░ ▒ ▓ █ More"` | 同上 `renderHeatmap` |
| 面板是 tabbed：`StatsTabbedPanel` → `StatsOverviewPanel`（概览）+ `StatsModelsPanel`（模型明细，条形图） | 同上 @13,018,074 导出表 |
| 概览行文案：Favorite model / Total tokens / Sessions / Longest session / Current streak / Longest streak / Active days / Peak hour / 「Stats from the last N days」 | 同上 @13,165,330 |
| token 趋势用 ASCII 折线 `renderLineChart(series, labels, width=60, height=8)`，输入是 `aggregateDailyTokens(dailyModelTokens)`（逐日把各模型 token 求和） | 同上 |
| `calculateStreaks(activeDates)`：当前连续从**今天**往回数（今天没活动则为 0），最长连续按日期升序扫相邻差 1 天 | 同上 @11,606,206 |
| 彩蛋 `generateFunFact`：把总 token 对比名著 token 量、把最长会话时长对比 TED 演讲 / 半马等 | 同上 |
| `SessionStatsResult`（会话实时）我们**已有等价物**：`SessionStatCard` + `contextUsage` | `src/shared/observability.ts` |

**数据源结论（重要）**：WorkBuddy 读的是「会话存储里的全部消息历史」。
我们的同构物是 **pi 会话 JSONL**（`getSessionsDir()`），不是运行台账 ——
台账文件头明文写着「消息内容与 usage 明细在会话 JSONL 已有，不双写」，
台账里没有按条的模型与用量。pi 的 `AssistantMessage` 带
`provider` / `model` / `usage` / `timestamp`（`开源项目/pi/packages/ai/src/types.ts:415`），
足够算出上表全部字段，且**覆盖全历史**（早于台账存在的旧会话也在内）。

## What Changes

- **新增跨会话聚合** `src/daemon/usage-stats.ts`：扫 `getSessionsDir()` 的全部会话
  JSONL，产出 `UsageStats`。纯函数 `aggregateUsageStats(sessions)` 与 IO 分离，
  前者可单测（照 `conversation-search.ts` 的先例：daemon 读自己的数据，不经权限门；
  单文件损坏跳过不抛）。
- **新增契约** `src/shared/usage-stats.ts`：`UsageStats` 类型 + 热力图网格纯函数
  `buildHeatmapWeeks()`。网格放 shared 而不是 renderer —— 一处实现，两端不会漂移
  （与 `cacheHitRate()` 同例；诊断页「不做二次计算」的纪律指的是聚合，布局派生
  允许，但必须单源）。
- **新 IPC 通道** `stats:usage`（`INVOKE.usageStats`）：拉式，无参数，全历史。
  刷新策略与诊断页一致：挂载拉一次 + 会话事件增量重拉（复用同一信号，不另开推送）。
- **新增统计页** `src/renderer/stats-view.tsx`：左侧栏「统计」入口，页面结构按
  WorkBuddy 面板还原 —— 概览数字条 → 用量热力图（周 × 日网格 + 少/多图例）
  → 每日 token 趋势折线 → 模型明细表 → 工具排行表。
- **明确不做**：彩蛋 `generateFunFact`（对比名著那种文案，中文语境下价值低、
  易失真）；`contextWindow` / `webSearchRequests` 两个 WorkBuddy 有但我们不采集的
  字段不假装有；不做时间范围切换（WorkBuddy 的接口本身就没有范围参数，加了是我们
  自己发明需求）；不做埋点上报 —— 全本地。

### 与 WorkBuddy 的有意差异（都要在代码注释里写明）

1. **token 口径更细**：WorkBuddy 公开契约的 `totalTokens` 只有 `input`/`output`；
   我们另有 `cacheRead`/`cacheWrite`，且沿用 `TokenUsage` 全字段（含 `reasoning`、
   `costBreakdown`），因为它们已经在盘上，藏起来没有理由。
2. **工具统计多一个 `errors`**：WorkBuddy 的 `toolUsage` 只有 `{tool, count}`。
   我们的 `ToolStat`（诊断页）已有失败数，跨会话聚合里补上同一维度，成本只是
   一次 toolCallId 配对。**不加**耗时 —— 会话 JSONL 没有工具执行的起止时刻
   （那在台账里），不为凑字段去读第二份数据源。
3. **不做 `dailyActivity.sessionCount / toolCallCount` 的完整搬运**：
   热力图只按 messageCount 着色（与 WorkBuddy 的 `getActivityLevel` 同口径），
   其余两列不采集，不留下永不渲染的字段。

## Impact

- Affected specs: 对齐清单 `VIEW9`（用量热力图 / 日历）、`CACHE7`（命中率趋势的
  时间维度）；本文档不实现 CACHE7 的折线本身（命中率趋势需要每轮的 cacheRead，
  会话 JSONL 有，但归日聚合后与 WorkBuddy 的 token 折线是两条不同的线，留作后续）
- Affected code:
  - `src/shared/usage-stats.ts`（新增：契约 + 热力图网格纯函数）+ `usage-stats.test.ts`
  - `src/daemon/usage-stats.ts`（新增：逐会话解析 + 聚合）+ `usage-stats.test.ts`
  - `src/shared/ipc.ts`（`INVOKE.usageStats` + 调用签名表）
  - `src/preload/index.ts`、`src/shared/bridge.ts`（桥接）
  - `src/daemon/index.ts`（handler）
  - `src/renderer/stats-view.tsx`（新增）、`App.tsx`（`View` 联合 + 路由）、
    `sidebar.tsx`（入口）、`index.css`（热力图网格样式）
- 数据源只读：不写任何会话文件，不动台账，不动 `documents/`

## ADDED Requirements

### Requirement: 跨会话使用统计聚合

系统 SHALL 从会话 JSONL 全历史聚合出使用统计：总会话数 / 总消息数 / 总用量
（input、output、cacheRead、cacheWrite、cost）/ 活跃天数与跨度 / 当前与最长连续
活跃天数 / 每日活动 / 每日 token / 模型用量 / 工具用量 / 峰值时段 / 最长会话
与平均会话时长 / 首末会话时刻。

**子代理会话 SHALL 从「会话维度」统计中排除**（判定：会话文件含 `custom` 条目且
`customType === "subagent_run"`，见 `subagent-runner.ts` 的溯源写入）——不计入
会话数 / 消息数 / 活动热力图 / 工具用量 / 连续天数。**但它的 token 用量与费用
SHALL 照常计入**模型明细与总量（WorkBuddy 同口径：真实花费不能漏账，
只是不该被算成「一次用户会话」）。
**没有任何 assistant 消息带模型的会话 SHALL 被整体跳过**（WorkBuddy 的
`isLegacySession` 同口径）：这种会话的发布产物无法归到任何模型上，
把它计进总数只会让模型明细与总量对不上。

#### Scenario: 子代理会话的会计口径

- **WHEN** 会话库里有 3 个主会话 + 1 个子代理会话（文件里有 `subagent_run` custom 条目），
  子代理会话走了 50 条消息、烧了 12k token
- **THEN** `totalSessions === 3`，那 50 条不计入 `totalMessages`、不出现在 `heatmap`
  与 `toolUsage` 里；但那 12k token 进入 `totalTokens` 与对应模型的 `modelUsage`

#### Scenario: 坏文件不拖垮整页

- **WHEN** 会话目录里有一个被截断的半行 JSON 文件、一个非 JSONL 文件
- **THEN** 聚合照常返回其余会话的结果，坏文件被跳过并记 event-log，不抛出

#### Scenario: 连续活跃天数口径

- **WHEN** 活跃日期集合为 `{前天, 昨天}`，今天是第 3 天且今天没有活动
- **THEN** `streakDays === 0`（当前连续从今天往回数，今天断就是 0），
  而 `longestStreakDays === 2`

### Requirement: 用量热力图网格

系统 SHALL 提供把「每日活动」铺成「周 × 日」网格的纯函数：7 行（周日起）、
N 列（周），列数 `clamp(width − 8, 10, 52)`；首列是今天所在周的周日往前推
`(weeks − 1) × 7` 天；未来日期不参与着色；着色等级按 `count / 全局最大 count`
分 4 档（`≤.25 / ≤.5 / ≤.75 / else`），0 活动为「空」档。

#### Scenario: 未来日期不误着色

- **WHEN** 今天周三，网格末列含周四到周六
- **THEN** 这些未来格子的等级为「空」，且不计入任何统计

#### Scenario: 等级是相对量

- **WHEN** 全局最大单日消息数是 80，某天是 20
- **THEN** 该天等级为 1（`20/80 = .25`）；同一天若全局最大是 200 则为 1
  （`.1 ≤ .25`）—— 等级只表达「相对自己最忙的一天」

### Requirement: 统计页

系统 SHALL 提供统计页：概览数字（会话数 / 消息数 / 活跃天数 / 总 token / 总费用 /
当前连续 / 最长连续 / 峰值时段 / 最长会话）、用量热力图（含「少 → 多」图例）、
每日 token 趋势、模型明细（请求数 / token / 费用）、工具排行（调用数 / 失败数）。
空历史 SHALL 显示空态文案而不是渲染空白网格。

#### Scenario: 零历史

- **WHEN** 一次会话都没有
- **THEN** 页面显示空态提示，热力图与排行不渲染

#### Scenario: 与诊断页同一信号刷新

- **WHEN** 当前会话跑完一轮（产生 `assistant_done`）
- **THEN** 统计页跟随会话事件重拉数据（delta 类事件不触发，避免空转）
