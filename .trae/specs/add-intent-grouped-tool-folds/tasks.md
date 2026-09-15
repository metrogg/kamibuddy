# Tasks

- [x] Task 1: 意图标题 —— 把计数摘要换成 `{动词}：{主题}`（`src/shared/metafold.ts`）
  - [x] SubTask 1.1: **topic 抽取**：从工具入参的对象字段（`pattern` / `path` / `file_path` / `query` / `command` 等）
        取主题。**与 `src/core/session-host.ts` 的 `summarizeArgs` 保持同源口径**（同一份字段优先级），
        避免两处各写一套。含压缩：路径取 basename、超长截断（中文按字数、英文按词数）
        > 实测结论：**没有抽公共表，也不需要** —— `ToolCard.summary` 本身就是 `summarizeArgs(args)` 的输出
        > （`session-host.ts:1318`），字段优先级只有那一份真源；metafold 直接拿 `card.summary` 当主题再压缩。
  - [x] SubTask 1.2: **标题决策**：单工具 `{动作} {主题}`（「查看 README.md」）/
        同类别多工具 `{类别动词} {主题}`（「定位 *.py 相关代码」）/
        跨类别多工具 `{动词1}、{动词2}：{主题}`（「定位代码、运行校验：x」）。
        类别先只做**读取 / 搜索 / 命令 / 写入**四类，其余归入"其它"降级
  - [x] SubTask 1.3: **无主题降级**：取不到主题时只留动词，不留悬空冒号或分隔符
  - [x] SubTask 1.4: 运行中的组加「正在」前缀
  - [x] SubTask 1.5: 单测覆盖：三种标题形态 + 无主题降级 + 主题压缩 + 单工具/多工具

- [x] Task 2: 分组前移 + 折叠时机（`src/renderer/fold-view.ts`、`src/renderer/chat-view.tsx`）
  - [x] SubTask 2.1: **折叠时机**：`shouldFold = 其后出现过正文 || 整轮已结束`（从后往前判定）；
        **正在执行的尾批（其后还没正文、轮未结束）SHALL 不进折叠容器**，保持平铺
        > 实现：`streamingItems` 内 `blocks.findLastIndex(e => classify(e) === "text")` + 与组末条目下标比较。
  - [x] SubTask 2.2: **分组前移**：把 `groupToolBatches` 从"只在 `renderSegmentEntries` 内"扩展到
        **顶层渲染路径也生效**（进行中的轮同样成组）。**不要新建折叠层**，复用既有 `SegmentFold` 外壳
  - [x] SubTask 2.3: 手动展开态在该组生命周期内不被流式刷新重置；进入新轮重置为默认收起
        > 实现：组 id = `batch-${首卡 toolCallId}`（无下标）；新轮 id 天然全新 ⇒ 默认收起，
        > 故**没有**加显式的"新轮清空"（加了反而会被 steer 追加的 user 消息误伤）。
  - [x] SubTask 2.4: 单测覆盖：连续调用成组 / 正文断组 / 单个调用不成组 / 执行中尾批平铺 /
        手动展开不被重置
  - [x] SubTask 2.5: 确认**轮折叠（`turn-folded` / `process-fold`）语义未变**，且两层共存不打架
        > 依据：`tool-group` 只在 streaming 出现、`turn-folded`/`process-fold` 只在 finished/error 出现
        > ⇒ 同一时刻二者不同时在场；finished 分支代码未改。

- [x] Task 3: 展开时释放吸底跟随（`src/renderer/chat-view.tsx`）
  - [x] SubTask 3.1: 点击组头展开时通知宿主释放贴底跟随（展开内容向下增长，组头位置稳定）
        > 实现：新增 `releaseFollowForExpand()`，在 `toggleFold` / `toggleTurn` 的**展开方向**调用。
  - [x] SubTask 3.2: 确认不误伤既有折叠（轮折叠头、过程消息段）的同类行为
        > 实现：三个 `SegmentFold` 用途共用同一个 `toggleFold` ⇒ 不存在"有的头释放、有的不释放"。

- [x] Task 4: 校验与文档
  - [x] SubTask 4.1: `npm run check`（typecheck + check:deps + check:tokens，真违例 0）
  - [x] SubTask 4.2: `npm test`（基线 95 文件 / 1717 用例，加本 spec 新增用例）
        > ⚠️ 两点如实记录：① 基线数字已过时（HEAD 上就有更多测试文件），本 spec 增量 **+21 用例**；
        > ② 全量跑有 **1 个环境性失败** `src/sandbox/confinement.win.test.ts`
        > （`process launch failed; code=2147483653` + `TRAE Sandbox Error` —— **IDE 沙箱拦了子进程**，
        > 已独立核实 `src/sandbox/` 与本次改动**导入图零交集**）。需真机复跑确认。
  - [x] SubTask 4.3: 在 `add-turn-fold-and-anchor` 的 spec 里追加订正注（分组调用点与摘要语义已扩展；
        **保留原文 + 追加带日期订正注**，2026-09-15 惯例）
  - [x] SubTask 4.4: 在 `docs/workbuddy对齐清单.md` 对应条目（实际是 F14 / L2 两行）追加说明

- [x] Task 5: 补齐主题来源的中间一级 —— 「相邻正文关键词」`（src/shared/metafold.ts` + `src/renderer/fold-view.ts`）
  > **起因**：checklist 核验发现 spec 写的三级降级链只实现了头尾两级。
  > Task 1 的 `summarizeToolRun(cards)` 签名收不到正文上下文，故"入参取不到主题"时直接退化成只留动词。
  - [x] SubTask 5.1: `summarizeToolRun` 增加**可选**的相邻正文参数（**旧调用方行为必须不变**）
    > 实现：`summarizeToolRun(cards, adjacentText?)`。`adjacentText` 只在 `card.summary` 全部
    > 取不到主题时兜底（WorkBuddy `deriveTopic` 同序，绝不覆盖入参主题）；不传即与扩展前逐字一致
    > （既有 22 条 metafold 用例未改动、全绿）。
  - [x] SubTask 5.2: 在分组侧（`fold-view.ts` 的 `streamingItems` 与段内分组）传入该组前/后的相邻正文
    > 实现：落在 `groupToolBatches` 单遍扫描内（`streamingItems` 顶层与 chat-view
    > `renderSegmentEntries` 段内**共用这一遍**，故两处一起生效）。取值同 WorkBuddy
    > `buildSegments`：**批后正文优先 → 回退批前正文**，用游标顺手记下，零回扫。
    > **【2026-09-15 订正】** 上一句已作废，现为**批前优先、批后兜底**
    > （`fold-view.ts` 的 `groupToolBatches`：`beforeText ?? afterText`）。理由：批间那句正文是
    > **过渡句** —— 对上一批它是「结果/解释」，对**下一批**才是「引子/意图」，
    > 只有批前那句贴合本 spec 要的**意图标题**；取批后取到的是上一批的结果句。
    > 这里是**有意偏离** WorkBuddy（它取批后优先，证据
    > `docs/WorkBuddy-reference/extracted/renderer/assets/lib-chat-ui-ChIVprRk.js:227346`
    > —— `segmentBodyText(segments[i + 1]) ?? segmentBodyText(segments[i - 1])`；疑似**实现便利**：
    > 它的 flush 由非折叠单元（正文）触发（同文件 :227332-227333 的 `else { flush(); }`），
    > 手边正好是刚遇到的那段正文。
    > 同文件 :227006-227009 的 `deriveTopic` 是「入参对象 → 相邻正文」两级降级序，与前后侧选择无关）。
    > 轮首批次前面没有正文时仍退回批后正文，不丢唯一线索。
  - [x] SubTask 5.3: 关键词抽取（**克制版**）：取相邻正文首句 → 剥离常见填充词 → 截断。
        **不追求 WorkBuddy 的完整抑制逻辑**（话题黑名单 / 重叠比），差异写进注释
    > 词表基线 = WorkBuddy `LEADING_FILLERS` + 本仓库提示词实际语序（「先…再…」）补入裸「先」「我」；
    > 截断复用既有 16 字 / 6 词阈值（**未**采用 WB 相邻正文专用的 10 字阈值）。
    > 刻意不做：话题黑名单、重叠比 0.7 抑制、句尾修饰词剥离；另有一处刻意偏离（不按空白切关键词）。
  - [x] SubTask 5.4: 单测：有相邻正文时提升为关键词 / **入参有主题时不得被覆盖** / 无正文退回动词 /
        关键词剥离与截断正确
    > 实现：metafold.test.ts +8 用例、fold-view.test.ts +7 用例；全量 103 文件 / 1889 用例通过
    > （唯一失败仍是既有环境问题 `src/sandbox/confinement.win.test.ts`，导入图与本改动零交集）。

# Task Dependencies

- **Task 1 与 Task 2 可并行**（主要落点分别是 `metafold.ts` 与 `fold-view.ts`/`chat-view.tsx`）。
- **Task 3 依赖 Task 2**（要先有顶层组头的点击行为）。
- **Task 4 依赖 Task 1–3 全部完成**。
- **Task 5 依赖 Task 1**（扩展其签名）。完成后需**重新核验** checklist 的「主题来源优先级」一项。

# 风险与注意

- `groupToolBatches` 的断批规则已存在（正文 / 豁免卡 / user 断批），与 WorkBuddy 的"正文断组"一致，
  **优先复用而不是重写**；本 spec 主要改的是**调用点**与**组头文案**。
- 改动落在对话主渲染路径上，**性能是要点**（`optimize-stream-rendering` 曾优化过流式开销）：
  计划函数在 `useMemo`（`chat-view.tsx:1502-1505`）内，已确认无新增每帧重建。
- `foldOpen` 是既有段级展开态（`Map<string, boolean>`）；组 id 用首卡 toolCallId，**不含易变下标**。

# 已知未做（descope，非疏漏）

- **工具卡详情盒 / 思考块展开未接吸底释放**：WorkBuddy 的 `ToolHeader` / `ToolDisplayList` 也接了同一个通知器。
  我们的 `ToolEntry` 自持 `open` 状态、拿不到 `followRef`，接入需给它加回调 prop。
  属**既有行为**（非本次引入的回归），未扩大范围。
- **`≥2` 的口径微差**：我们是「工具卡数 ≥2」，WorkBuddy 是「连续 ≥2 个可折叠单元（工具 + 纯思考）」，
  故「1 工具 + 1 思考」不成组。按"复用现有骨架、不动既有语义与测试"保留现状。
- **批次收起时的瞬时收缩**：平铺 → 收起是组件类型切换、无动画可搭（与 WorkBuddy 同款）。
  贴底跟随时 `useLayoutEffect` 在绘制前复位 `scrollTop`，**阅读位置不跳**；不跟随时靠浏览器默认
  scroll anchoring 兜底。
