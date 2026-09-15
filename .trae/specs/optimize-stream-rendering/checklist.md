# Checklist

> 检查时按 spec「明确不做」表：**列出的豁免项不应被改动**，改错了同样是缺陷。
> 本期为 `feat/ui-design-system` 分支第 3 期（承接 token 地基与动效纪律）。
>
> **校验日期 2026-09-14**：`npm run check`（typecheck + check:deps + check:tokens）通过、
> `npm test` **95 文件 / 1717 用例**全绿（串行跑两次稳定）、`check:tokens` 真违例 **0**、
> `npm run build` 成功。
> **唯一未勾选项为「实测性能对比」**——障碍不是起不来窗口（沙箱内有实例在跑），
> 而是 agent 无法向运行中的窗口注入输入、也读不到它的 DevTools Console，
> 而"≥200 轮含代码块的真实流式会话"必须真人驱动。待人工清单见 `docs/design-tokens-migration.md` §8.6。

## 流式 delta 合批（核心）

- [x] `session-host.ts` 的 `text_delta` / `thinking_delta` 不再**逐条直接 emit**
- [x] 实现了时间窗缓冲（`DELTA_FLUSH_MS = 16`），且**只合并连续同类型**的 delta
- [x] **flush 时机齐全**（实际落点 **6 处**，比要求的 4 类更密）：① 定时到期 ② 类型切换
      （含 messageId 变化）③ `message_end` 首句 ④ `turn_end` 首句 ⑤ `agent_end` 首句 ⑥ `abort()` 内
- [x] **不丢内容**：合批拼接结果与「逐个 emit」**逐字一致**（单测对拍：7 个混合 delta → 4 次 emit）
- [x] **不串序**：thinking 与 text 的到达顺序与内容边界不变（类型切换即 flush，单测固化）
- [x] **中断不丢半句**：`abort()` 显式 flush + `message_end/turn_end/agent_end` 三重兜底，且有测试
- [x] 定时器有清理路径：`dispose()` 里 `clearTimeout` 并置 undefined；
      **故意不 flush**（会话已作废，补发只会把残句推到废弃会话）；无泄漏、无"已结束会话仍在 emit"
- [x] **契约未变**：事件类型与字段名同以前，`shared/` 与 reducer / UI **零改动**
- [x] 缓冲/flush 逻辑**有单元测试**，且**未抽出新文件**——`session-host.ts` 本就可被 vitest 直接 import
      （已有 `session-host.test.ts`），就地测试，零结构改动
- [x] 测试覆盖：连续合并+窗口到期 / 类型切换先 flush / `message_end` 强制 flush /
      中断路径 flush / `agent_end` 强制 flush / **对拍等价**
- [x] 附带：TTFT 的 `turnFirstDeltaAt` 记录**保持在缓冲之前**（它量的是 pi 事件到达时刻，不是 flush 时刻）

## 收起态跳过渲染

- [x] `.metafold-body-inner`、`.tool-detail-box`、`.tool-source-list` 的收起态有
      `content-visibility: hidden`，展开态恢复（5 条声明；复用 `.tool-detail-box` 的
      `.todo-list-box` / `.task-agent-box` 亦自动受益）
- [x] **`scrollHeight` 未受影响**：Electron 44 探针 A/B 实测**改前改后完全相等（2106 = 2106）**，
      三个元素自身盒高恒为 0
- [x] 与既有 `visibility: hidden` / `opacity: 0` 组合无冲突（语义正交，实测计算值同时生效）；
      折叠态本就 `visibility: hidden`，**不引入可访问性回归**
- [x] 展开/收起、贴底跟随、拖刻度轨的行为与改造前一致
- [x] 未引入新的硬编码视觉值（`check:tokens` 真违例仍为 0；时长取既有 token）
- [x] **额外发现并修复一个会摧毁第 2 期成果的坑**：`content-visibility` 是**离散属性**，
      直接加会让收起瞬间把内容高度算成 0 → 收起动画从「767.5px → 0」退化成「0 → 0」（瞬间消失）。
      已加 `transition-behavior: allow-discrete`（**只写在收起态那一条**——实测展开态若也加，
      反而晚一帧翻转、轨迹偏离更大）

## 热点 memo 化（5 处）

- [x] `widget-view.tsx` 的 `parseWidgetResult(card.detail)` 已 `useMemo`（依赖 `[card.detail]`，
      与同文件 `partial` 的写法一致）
- [x] `markdown.tsx` 的 `Markdown` 已 `React.memo`（已完成消息不再随父级重渲染而重解析）
- [x] `App.tsx` 的 `collectSources` / `collectChanges` 已从 JSX 内联调用改为 `useMemo`
- [x] `chat-view.tsx` 的 `pendingText(entries)` 与 `entries.findLast(...)` 已 memo 化
- [x] `turn-rail.tsx` 的测量不再每个 delta 都强制同步布局（改为 **rAF 尾沿**）
- [x] `turn-rail` 的**测量算法与 `RATIO_EPSILON` 容差未被改动**；未采用"条数门控"
      （那会让整轮刻度停在旧比例上——`scrollHeight` 流式期持续增长，属准确性退化）
- [x] 逐处能说明「改前每 delta 重算什么、改后为什么不会」
- [x] **另有 1 处必要支撑改动**（已记录）：`App.tsx` 的 `onPathClick` 原是 JSX 内联箭头，
      只加 `React.memo` 会被这个不稳定 prop **击穿**，故提成 `useCallback`
- [x] **诚实标注**：`App.tsx` 两处与 `chat-view` 两处在**流式期间收益为 0**
      （`conversation.entries` 每 delta 换引用），只对"与消息流无关的重渲染"有效；已写入代码注释与成果文档

## 性能观测工具

- [x] 有 FPS 采样（低于 55 告警）与 longtask（>50ms）采集；低 FPS 告警**同时带上同窗口 longtask 明细**
- [x] 有可视呈现（右下角浮层：FPS / longtask 条数 / 最长时长）+ 控制台逐条明细（含 `duration`/`name`/`startTime`）
- [x] **默认不影响生产**（默认不执行）：仅 `localStorage.kbPerf === "1"` 或 DEV 下且 `kbPerf !== "0"` 才执行
      ——**但需说明**：生产构建**仍会包含**该模块（4.9 kB 独立 chunk + 入口 import 存根），
      因守卫 `perfFlag === "1" || (import.meta.env.DEV && perfFlag !== "0")` 在生产折成
      `perfFlag === "1" || false` 后仍取决于运行时 localStorage，rollup 判不了该死分支。
      **这是有意的取舍**（保留生产强开取证能力）；"彻底剔除"的写法已写入代码注释。
      原先"不进生产包"的注释**不实，已订正**（Task 5.8）
- [x] 挂载点在 `main.tsx`（且用**独立 React root**，未占用 `App.tsx`、不随 App 重渲染）
- [x] 说明了如何开启/关闭（单一 key `kbPerf`：`"1"` 强开 / `"0"` 关）

## 豁免项未被误改

- [x] **未引入完整虚拟滚动**（会牵动吸顶/吸底/折叠/刻度轨四套机制）
- [x] **未对未折叠条目用 `content-visibility: auto`**（scrollHeight 漂移会导致滚动条跳动）
- [x] **未把 Markdown 解析移入 Worker**
- [x] 未改滚动跟随 / 刻度轨的既有算法
- [x] 未改三方内容（widget iframe 内）
- [x] 未改任何视觉值（本期只加 `content-visibility` 与 `transition-behavior`，非视觉值）

## 无回归与文档

- [x] `npm run typecheck` 通过
- [x] `npm run check:deps` 通过（扫描 257 文件）
- [x] `npm run check:tokens` 通过（真违例 **0**，未新增白名单；豁免 105 → 107 均非新违例）
- [x] `npm test` 全绿（**95 文件 / 1717 用例**；先前 `doc-extract` 偶发超时未复现，未改测试、未塞 skip）
- [x] `DESIGN.md` 已补 **§11「性能约束（硬约束）」**四条：流式必须合批 / 收起态必须跳过渲染
      （含 `allow-discrete` 要求）/ 完成条目必须 memo（含函数型 prop 须 `useCallback`）/
      未折叠条目**禁用** `content-visibility: auto`
- [x] 成果文档已记（`docs/design-tokens-migration.md` §8，含**代码层证据**：合批 7→4 的事件数对拍、
      折叠探针 `scrollHeight` 2106=2106、5 处 memo 清单、浮层开关与取证方式）
- [ ] **实测性能对比（需人工）**：真机上用浮层跑长会话（≥200 轮含代码块）记录 FPS 与 longtask
  - **未完成**：沙箱内有本应用实例在运行，但 agent **无法向窗口注入输入、也读不到 DevTools Console**，
    而真实长会话必须真人驱动。已以代码层证据代替，并把待人工清单写入文档 §8.6
  - 待人工确认的三项：① 折叠动画**不是「瞬间消失」**（`allow-discrete` 的验收点）；
    ② 贴底与刻度轨行为不变；③ 历史消息 Markdown 只在流式那条上重解析
- [x] 已明确报告**本期未做**的三项（完整虚拟滚动 / `content-visibility: auto` / Markdown 移 Worker）与理由
