# Tasks

> **并行度说明（本期比前两期好）**：Task 1 / 3 / 4 改的是**互不重叠的文件**
> （新建文件 + `main.tsx` / `index.css` / 5 个 tsx），可**并行执行**；
> Task 2（合批）是核心改动、须单独一轮以便充分验证；Task 5 收尾依赖全部完成。
>
> **基线（本期开始前）**：`npm run check` 通过、`npm test` 95 文件 / 1711 用例全绿、
> `check:tokens` 真违例 0。
> **当前状态（2026-09-14）**：Task 1–4 全部完成，`npm test` **95 文件 / 1717 用例**
> （1711 + Task 2 新增 6 个）、`npm run check` 通过（含 `check:tokens` 真违例 0）。

- [x] Task 1: 性能观测工具（先装尺子）
  - [x] SubTask 1.1: 新建 `src/renderer/perf-overlay.tsx`：FPS 采样（每秒统计，低于 55 告警）
    + 主线程 longtask 采集（`PerformanceObserver({ entryTypes: ["longtask"] })`，记录 >50ms 的项与时长）
  - [x] SubTask 1.2: 采集结果以**开发期浮层**呈现（右下角小卡片：当前 FPS、最近 longtask 条数与最长时长），
    并在控制台打印 longtask 明细（含 `duration` / `name` / `startTime`）
  - [x] SubTask 1.3: **默认不影响生产**：仅在 `import.meta.env.DEV` 为真、或显式开关
    （如 `localStorage.kbPerf = "1"`）时启用；生产构建不加载浮层（用动态 import 或条件渲染）
  - [x] SubTask 1.4: 挂载点放 `src/renderer/main.tsx`（**不要放 `App.tsx`** —— 那个文件本轮由 Task 4 改，避免冲突）
  - [x] SubTask 1.5: 验证：`npm run typecheck` + `npm test` 通过；说明浮层如何开启与关闭
  - **实测结果**：FPS 按 1s 档统计；低 FPS 告警**同时带上同窗口 longtask 明细**（只有一个数字定位不到元凶）；
    窗口切走造成的"空窗"按 `elapsed >= 2000ms` 丢弃，避免误报；longtask 做能力检测 + try/catch，
    不支持则静默跳过。浮层是**独立 React root**（不塞进 App 树 → App 每轮重渲染不带上它，也不动 `App.tsx`）；
    样式全内联 + CSS 变量，**零 CSS 文件改动**。`main.tsx` +16 行用**动态 `import()`**
    （生产构建时 `import.meta.env.DEV` 被替换为 `false` → 分支成死代码，模块不进包）。
    开关：单一 key `kbPerf`（`"1"` 强开 / `"0"` 关；未设置时 DEV 开、生产关）。
    **〔2026-09-15 订正〕** 上述默认策略已作废：现为**只有 `"1"` 才开**，未设置 / `"0"` 都不开（**DEV 下亦然**）。
    改因：浮层是**主动取证**才需要的工具（改渲染性能时才量一次），DEV 下默认常驻会遮挡右下角界面、
    打扰正常开发，故不再默认打扰。SubTask 1.3 的口径（本行上方「`import.meta.env.DEV` 为真…即启用」）同此订正。
  - **待 Task 5 验证**：生产构建确实不含该模块（跑 `npm run build` 后检查产物无 `longtask` 字样）

- [x] Task 2: 流式 delta 合批（**核心改动**，单独一轮）
  - [x] SubTask 2.1: 在 `src/core/session-host.ts` 的 delta 处理处（约 1128–1140 行，
    现在 `text_delta` / `thinking_delta` 各自直接 `emit`）引入**时间窗缓冲**（窗口约 16ms）：
    维护 `pendingKind`（`"text"` / `"thinking"`）+ `pendingDelta`（字符串），
    新 delta 若与 `pendingKind` 相同则**追加**，否则**先 flush 再开始新的**
  - [x] SubTask 2.2: **flush 时机（缺一不可）**：① 定时器到期（16ms）；② 类型切换；
    ③ `message_end`（约 1146 行，必须在此前 flush）；④ turn 结束/中断/abort 路径。
    flush 即按原事件类型 `emit` 一条，`delta` 为拼接结果
  - [x] SubTask 2.3: **清理与生命周期**：host 销毁 / 会话切换时清掉定时器（避免定时器泄漏与
    "已结束会话仍在 emit"）。若该文件已有 `dispose`/`destroy` 之类收尾路径，把清理挂进去；
    没有就在本文件内加一个最小的私有清理方法，**不要扩大改动面**
  - [x] SubTask 2.4: **不改契约**：事件类型（`assistant_text_delta` / `assistant_thinking_delta`）、
    字段名与语义保持不变 → **`shared/` 与 reducer / UI 零改动**。若实现中发现必须改契约，**停下来报告**
  - [x] SubTask 2.5: 验证（必须充分）：
    - `npm run typecheck` + `npm test`（95/1711）+ `npm run check`
    - **不丢内容**：写一个针对缓冲逻辑的单元测试（若 `session-host.ts` 不可直接测，
      把「缓冲/flush」抽成 `core/` 内的**纯函数或小类**再测——这是本任务唯一允许的额外结构改动）；
      测试至少覆盖：连续同类型合并、类型切换 flush、定时 flush、`message_end` 强制 flush、
      拼接结果与逐个 emit 逐字一致
    - **abort 不丢半句**：确认中断路径也走 flush（代码层复核 + 测试）
  - **实测结果**：常量 `DELTA_FLUSH_MS = 16`；状态用**单个对象**
    `pendingDeltas = { kind, messageId, text, timer }`（避免四个字段互相漂移）。
    **额外存 `messageId`**：`agent_end` 路径会先清 `currentAssistantId`，flush 时不能现读。
    `bufferDelta()` 负责追加/切换，`flushDeltas()` 负责 emit。
    **flush 落点共 6 处**（比 spec 要求的 4 类更密）：定时器到期、类型切换（含 messageId 变化）、
    `message_end` 首句、`turn_end` 首句、`agent_end` 首句、`abort()` 内。
    `dispose()` 里 `clearTimeout` 并置 undefined、**故意不 flush**（会话已作废，补发只会把残句推到废弃会话）。
    **TTFT 的 `turnFirstDeltaAt` 记录保持在缓冲之前**（它量的是 pi 事件到达时刻）。
    **未抽新文件**——`session-host.ts` 本就可被 vitest 直接 import（仓库已有 `session-host.test.ts`），
    缓冲逻辑就地测试，零结构改动。
  - **测试**：新增 6 例（`describe("流式 delta 合批（16ms 窗口）")`，用 `vi.useFakeTimers()` 且每例还原）：
    连续合并+窗口到期、类型切换先 flush、`message_end` 强制 flush、中断路径 flush、`agent_end` 强制 flush、
    **对拍**（7 个混合 delta → 参照实现逐字拼接 vs 合批结果 `toEqual` 一致，事件数 7 → 4）。
    `session-host.test.ts` 由 47 → 53 通过。
  - 备注：`abort()` 里那行 `flushDeltas()` 对常规时序是幂等 no-op（`message_end/turn_end/agent_end`
    已先 flush），加它是为了"停止键返回即送达、不依赖 pi 收尾时序"；删掉也不丢内容。

- [x] Task 3: 收起态跳过渲染（`index.css`，纯 CSS）
  - [x] SubTask 3.1: 给折叠体加 `content-visibility`：收起态 `content-visibility: hidden`、
    展开态（`.open`）恢复（`visible`）。目标选择器：
    `.metafold-body-inner`（轮折叠内层）、`.tool-detail-box`（工具详情，第 2 期改造后是单个 `<pre>`）、
    `.tool-source-list`（来源列表）
  - [x] SubTask 3.2: **确认不影响布局**：这些元素在收起态高度本就为 0
    （`grid-template-rows: 0fr` / `height: 0`），加该属性 **SHALL NOT** 改变
    `scrollHeight`（否则会干扰吸底跟随 `scrollTop = scrollHeight` 与刻度轨的比例计算）
  - [x] SubTask 3.3: 顺带确认 `content-visibility: hidden` 与既有 `visibility: hidden` /
    `opacity: 0` 的组合无冲突（三者语义不同：前者跳过渲染，后者只影响可见性）
  - [x] SubTask 3.4: 验证：`npm run check`（**含 `check:tokens`，不得引入新硬编码**）；
    `npm test`；代码层复核收起/展开两态的选择器覆盖正确
  - **实测结果**：5 条声明落地。轮折叠用 `.metafold-body:not(.open) .metafold-body-inner`
    （`.open` 在外层，内层没有，只能用祖先表达收起态；展开态不显式声明，选择器不匹配即回落 `visible`）；
    两个工具盒写在基类（基类即收起态）+ `.open` 显式恢复，与该文件既有的「基类=退出态」写法一致。
    复用 `.tool-detail-box` 的 `.todo-list-box` / `.task-agent-box` **自动一并受益**。
  - **⚠️ 发现一个会摧毁第 2 期成果的坑**：`content-visibility` 是**离散属性**，直接加会让收起瞬间
    把内容高度算成 0 → 收起动画从「767.5px → 0」退化成「0 → 0」（瞬间消失）。
    **修复：每条都加 `transition-behavior: allow-discrete`**（时长取既有 token，零硬编码），
    且**只写在收起态那一条**——实测若展开态也加，反而晚一帧翻转、轨迹偏离更大。
  - **实测证据**（Electron 44 / Chromium 152 探针 A/B）：收起态 `scrollHeight` 改前改后**完全相等
    （2106 = 2106）**；三个元素自身盒高恒为 0；展开态 `content-visibility` 计算值为 `visible`、
    高度正常（300/300/895.63）。与 `visibility`/`opacity` 语义正交可共存；
    因折叠态本就 `visibility: hidden`，不引入可访问性回归。
  - 附注：`content-visibility: hidden` 下 `innerText` 会返回空串（`textContent` 仍完整）——
    当前代码库无 `innerText` 调用（已 grep 确认），仅作提示。

- [x] Task 4: 热点 memo 化（5 处 tsx）
  - [x] SubTask 4.1: `src/renderer/widget-view.tsx:436` —— `parseWidgetResult(card.detail)`
    用 `useMemo` 包住（依赖 `[card.detail]`）。注意同文件 437 行的 `partial` 已 memo，照它的写法
  - [x] SubTask 4.2: `src/renderer/markdown.tsx` —— 给 `Markdown` 组件加 `React.memo`
    （流式中 text 每次变仍会重解析，但**已完成消息**不再随父级重渲染而重解析——这是长会话的主要收益）
  - [x] SubTask 4.3: `src/renderer/App.tsx:1186/1193` —— `collectSources(conversation.entries)` 与
    `collectChanges(conversation.entries)` 从 JSX 内联调用改为 `useMemo`（依赖 `[conversation.entries]`）
  - [x] SubTask 4.4: `src/renderer/chat-view.tsx` —— `pendingText(entries)`（约 1801 行附近）与
    `entries.findLast(...)`（约 1415 行附近）加 `useMemo` / 改用已 memo 的派生值
  - [x] SubTask 4.5: `src/renderer/turn-rail.tsx` —— 测量 `useLayoutEffect` 依赖 `[entries]`
    （**每个 delta 都会强制同步布局**）：改为只在「轮数/条目数变化」时测量，
    或用 rAF 尾沿节流。**不要改动它的测量算法与 `RATIO_EPSILON` 容差**（那是既有防抖设计）
  - [x] SubTask 4.6: 验证：`npm run typecheck` + `npm test`；逐处说明「改前每 delta 会重算什么、
    改后为什么不会」
  - **实测结果**：5 处落地，**另有 1 处必要支撑改动**——`App.tsx` 传给 `ChatView` 的 `onPathClick`
    原是 JSX 内联箭头，只加 `React.memo` 会被这个不稳定 prop **击穿**（历史消息照样重解析），
    故提成 `useCallback`（依赖 `[conversation.state.cwd, openArtifact, openPreview]`，函数体逐行照搬）。
    **未写自定义比较函数**（默认浅比较已够；若放过函数型 prop 会引入"旧闭包 + 新 cwd"的隐式耦合）。
  - `turn-rail` 采用 **rAF 尾沿**而非"条数门控"：后者会让整轮刻度停在旧比例上
    （`scrollHeight` 在流式期持续增长而刻度内容坐标不变），属**准确性退化**；
    rAF 仍在每帧按当帧 `scrollHeight` 重算，最坏只晚一帧。测量算法与 `RATIO_EPSILON` 容差未动。
  - **诚实标注（重要）**：SubTask 4.3 / 4.4 两处在**流式期间收益为 0** ——
    `conversation.entries` 每个 delta 都换引用（`replaceEntry` 走 `map`），memo 仍会重算。
    它们真正省下的是「与消息流无关的重渲染」（折叠开合、面板交互、toast、审批弹窗）。
    已在代码注释写明，避免被误读为"流式不再重算"。
  - `typecheck` / `test` 95-1711 / `check:deps` 全过（未跑 `check:tokens`：无视觉值改动，
    且当时 `index.css` 正被并行改，结论无法归因）

- [x] Task 5: 校验与文档
  - [x] SubTask 5.1: `npm run typecheck && npm run check:deps && npm run check:tokens` 三项通过
    （`check:tokens` 真违例必须仍为 0）
  - [x] SubTask 5.2: `npm test` 全绿（基线 95 文件 / 1711 用例，加上 Task 2 新增的缓冲测试）
  - [x] SubTask 5.3: 在 `DESIGN.md` 补一节「性能约束」（或并入 §5 附近）：流式 delta 必须合批
    （不得每 token 一次 IPC）、收起态跳过渲染、完成条目必须 memo、
    `content-visibility: auto` 对未折叠条目**禁用**（scrollHeight 漂移风险）
  - [x] SubTask 5.4: 更新 `docs/design-tokens-migration.md`（或新建一节）记录本期成果与**代码层证据**
    （如：IPC 次数从 N 降到 N/窗口、折叠内容不再参与 layout/paint、5 处 memo 化清单）
  - [x] SubTask 5.5: **实测性能对比（需人工）**：在真机上用 Task 1 的浮层跑一次长会话
    （建议 ≥200 轮、含代码块），记录改前/改后 FPS 与 longtask；沙箱起不了 GUI 就如实说明，
    以代码层证据代替
  - [x] SubTask 5.6: 明确报告**本期未做**的项（完整虚拟滚动、`content-visibility: auto`、
    Markdown 移 Worker）与各自的理由，避免被当作遗漏
  - [x] SubTask 5.7（Task 1 遗留）: 跑 `npm run build` 并确认产物中**不含** perf-overlay
    （如 `Select-String` 产物 js 无 `longtask` 字样），验证"生产不打包"的机制确实成立
  - **实测结果**：六条命令全绿；`npm test` **95 文件 / 1717 用例**，且**串行跑两次都稳定通过**
    （先前 `doc-extract` 的超时为并行负载偶发，未复现，未改测试、未塞 skip）。
    `npm run build` 成功。
  - **⚠️ 5.7 结论与预期相反（如实记录，未打勾式掩盖）**：生产产物**确实包含**
    `perf-overlay-*.js`（4.90 kB，本次构建新鲜产物），入口有 `__vitePreload(() => import(...))` 存根。
    **根因**：守卫写的是 `perfFlag === "1" || (import.meta.env.DEV && perfFlag !== "0")`，
    生产下 `import.meta.env.DEV` 确实被折成 `false`，但整句剩下 `perfFlag === "1" || false` ——
    仍取决于**运行时 localStorage**，rollup 无法判定该死分支。**实际行为是"默认不执行"
    （未设 `kbPerf` 时为假），代码在包里**。故 Task 1 注释里"模块不进生产包"的声称**不实**，已由 Task 5.8 订正。
  - `DESIGN.md` 新增 **§11「性能约束（硬约束）」**四条（合批 / 收起态跳过渲染 + `allow-discrete` /
    完成条目必须 memo / 未折叠条目禁用 `content-visibility: auto`）。
    位置**追加在文末而非 §5 之后**——§6 起是禁止清单/无障碍/术语/CR/落地范围，
    插队要整体顺延编号，会打断 `AGENTS.md` 与 `.trae/specs/*` 里对 §7/§8/§9 的既有引用（那些是验收依据）；
    已在节首写明该理由。§9 CR 自查加了一条指向 §11；§10.1/§10.2 同步订正。
  - `docs/design-tokens-migration.md` 新增 **§8**（8.1 做了什么 / 8.2 代码层证据 / 8.3 诚实标注 /
    8.4 刻意未做三项 / 8.5 生产打包遗留 / 8.6 待人工实测清单 / 8.7 校验快照）。
    口径变化均非新违例：扫描 tsx 48 → 49（新增 perf-overlay）、豁免 105 → 107，**无新增白名单**。
  - **实测性能未完成**：障碍不是"起不来窗口"（沙箱内检测到已有本应用实例在运行），
    而是 **agent 无法向运行中的窗口注入输入、也读不到它的 DevTools Console**，
    而"≥200 轮含代码块的真实流式会话"必须真人驱动。故以代码层证据代替，
    待人工清单已写入文档 §8.6（含要记的数字与三个对照项）

- [x] Task 5.8（Task 5 发现的问题）: 订正 `main.tsx` 与 `perf-overlay.tsx` 中**不实**的
  "不进生产包"注释，改为准确描述（生产默认不执行、但代码在包内；
  并写明若需彻底剔除应把 `import.meta.env.DEV` 提为唯一编译期闸门——代价是生产无法强开取证）。
  **只改注释，不改逻辑**
  - **取舍记录**：选择**保留**"生产可 `kbPerf=1` 强开"的能力（真机取证需要），
    接受生产多 4.9KB 的代价；spec 原文要求的是"不**加载**"（默认不执行），现状符合
  - 实测：两处注释已订正，逻辑零改动；`npm run typecheck` 通过

# Task Dependencies

- **第一轮（已完成）**：Task 1（`perf-overlay.tsx` + `main.tsx`）、Task 3（`index.css`）、
  Task 4（5 个 tsx）—— 文件互不重叠，并行执行无冲突
- **第二轮（已完成）**：Task 2（`core/session-host.ts`）—— 核心改动，单独一轮，
  已有 6 个单测（含与"逐个 emit"的对拍）
- **第三轮**：Task 5 依赖 Task 1–4 全部完成
