# Tasks

> 上游改动：`.trae/specs/persist-context-snapshots/`（快照落盘 + 按内容去重追加，已完成并验收）。
> 验证统一用 `npm run typecheck && npm run check:deps && npm run check && npm test`（不涉及 `documents/`）。
> 基线读数：探针会话 `01a0b325-7548-7588-b0d8-4e1eabb968b4`（5 run / 24 次调用 / 加权命中率 97.43% / gap ≤ 128）。

- [x] Task 1: 契约层 —— 取代声明常量 + 按 role 产出块
  - [x] SubTask 1.1: `src/shared/hidden-context.ts` 新增单点常量 `SNAPSHOT_SUPERSEDE_NOTE`
        （「本条快照取代此前所有同类快照；内容冲突时以本条为准。」），三条通道共用
  - [x] SubTask 1.2: `composeHiddenContext(sections)` → `composeHiddenBlock(sections, role)`，按 role 一次只产一个块；
        `wrapHiddenContextXml` 与 `HIDDEN_CONTEXT_MARKER` 一字未动（容器契约不变）
  - [x] SubTask 1.3: 取代声明拼进每个块的**容器内第一行**
  - **验证**：`hidden-context.test.ts` 更新到新契约（role 分离两例）；结构断言（tag / data-role / 空块跳过）未放宽
  - **依赖**：无

- [x] Task 2: 三条通道的形状与接线
  - [x] SubTask 2.1: `src/shared/observability.ts` 新增 `RUN_TIME_CUSTOM_TYPE = "kamibuddy-run-time"`
  - [x] SubTask 2.2: `src/core/prompt-composer.ts` 的 `formatRuntimeContext` 正文第一行前置取代声明
        （常量从 shared 取，core 里无第二份字面量；无内容时仍返回 `""`）
  - [x] SubTask 2.3: `src/core/session-host.ts`：`composeRunHiddenContext` 返回 `{hidden, runTime}`（`current_time` 从环境块移出）；
        `freezeHiddenContext` 一次冻两份；读口 `peekHiddenContext` / `peekRunTime`
  - [x] SubTask 2.4: `src/extensions/prompt-switch.ts` 注册**第四个** `before_agent_start` handler
        （`customType = kamibuddy-run-time`），新增必填入参 `composeRunTime`；复用 `snapshotMessage` 按各自 customType 去重。
        **注册顺序固定**：`systemPrompt` → `runtime-context` → `hidden-context` → `run-time`
  - [x] SubTask 2.5: daemon 三处接线补 `composeRunTime`（`index.ts` / `automation-runner.ts` / `subagent-runner.ts`）；
        展示口 `INVOKE.hiddenContext` 把两份正文按注入顺序 `join` 回一屏（IPC 形状不变）
  - **验证**：`prompt-switch.test.ts` 新增 4 例（首次三通道各一条 / 互不触发 / 只变一条时另两条不追加 / 仅时间跨分钟只追加 run-time）；
        `prompt-switch-session.test.ts` 新增 7.1–7.4（真实 pi 会话）
  - **依赖**：Task 1

- [x] Task 3: 门禁自证（改坏 → 变红 → 还原）
  - [x] SubTask 3.1: 把时间重新拼回环境块 → 「仅跨分钟只追加 run-time」断言精确变红
        （`expected [ { index: 5, …(3) }, …(1) ] to have a length of 1 but got 2`；同批另 4 红）→ 还原后 128 例全绿
  - [x] SubTask 3.2: 去掉取代声明 → 声明断言精确变红（6 failed / 172 passed）→ 还原后全绿
  - [x] SubTask 3.3: 三条 handler 共用同一基线（串台）→ 互不触发断言精确变红
        （`runtime 通道读到了别人的基线: expected { message: … } to be undefined`；9 failed）→ 还原后全绿
  - **计数订正（2026-09-18，独立验证者复核后按 `AGENTS.md §8` 补记；原记录不删、结论不动）**：
    3.1 的「还原后 128 例全绿」与 3.2 的「6 failed / 172 passed」是**实现者当时所跑文件集**得出的计数；
    独立验证者按改坏波及的文件集复跑（4 文件 117 例 / 3 文件 94 例 / 3 文件 44 例）**无法复现该计数**，
    但**红的方向与报错文本可逐字复现** —— 差异只在「跑了哪些文件」（受影响用例数），不在结论
    （改坏 → 精确变红 → 还原后全绿）。
  - **依赖**：Task 2

- [x] Task 4: 文档与口径同步
  - [x] SubTask 4.1: `hidden-context.ts` / `prompt-switch.ts` / `runtimes.ts` / `cache-prefix.ts` 的契约段按三通道同步
        （去重判据由「同 role」精确为「同 customType」、补 role↔通道映射、快照清单补第三条）；
        `check:model-experience` 21 个模块全部符合
  - [x] SubTask 4.2: `docs/可观测性清单.md`（CACHE8 行 + 新增「时间拆成独立通道」段 + CACHE6 的 customType 清单 + 头部注记）；
        **写明 `hiddenContextChars` 只算环境块、不含时间块**
  - [x] SubTask 4.3: `docs/提示词前缀缓存契约.md` §2/§7/对照结论表/文末互链；`docs/workbuddy对齐清单.md` F5；
        `.trae/specs/persist-context-snapshots/tasks.md` 的「已知代价」按 `AGENTS.md §8` **只补状态与事实性路径 + 互链**（结论不动）
  - [x] 顺带：面板文案区分「环境块 / 时间块」（`task-diagnostics-panel.tsx` / `snapshot-breakdown.tsx`），
        与 daemon 展示口的 `join` 拼法口径一致；`check:tokens` 通过（未引入硬编码视觉值）
  - **依赖**：Task 2

- [x] Task 5: 真实读数复跑（判定 B 的收益是否真的落地）
  - [x] SubTask 5.1: `npm run probe:context-snapshot` 实跑（真实凭据）：会话 `01a0b3a3-9270-75bc-b0a2-f660c6372caf`，
        **5 run / 26 次调用**。逐对 `gap`：全部 25 对 **min −5,334 / max 124 / 超 128 者 0 个**
        （run 内 21 对 max 124；跨 run 4 对全为负）。会话级加权命中率 **98.07%**（基线 97.43%，+0.64pp）；
        未命中 18,891（n 口径拆解恒等式自洽）
  - [x] SubTask 5.2: 会话文件逐条核对（8 条 `custom_message`）：`run-time` **4 条**（16:30/16:31/16:32/16:33，
        两次同分钟 run 按内容去重只落一条）；环境块正文**已不含** `<current_time>`；每条正文都含取代声明；
        落位 `message:user → runtime-context → hidden-context → run-time`；`display=false`
  - [x] SubTask 5.3: 读数写进本 spec 的 `## 复跑实测` 段（含未达预期之处）
  - **B 的收益实测**：每（跨分钟）run 的快照新增内容 **513 → 61 estTokens（−452，−88.1%）**。
        **未达预估的 ≈20**：150 字符里真新信息只有时间戳 26 字符（≈11 est），其余是取代声明（≈26 est，
        即 A 的代价）+ 容器与 `<current_time>` 标签（≈35 est）。原预估「时间块 ≈40 字符 / ≈20 token」
        **漏算了 A 的声明与容器** —— 属预估口径偏窄，非实现缺陷。消掉残值只能走「时间与环境同条」或
        「去掉取代声明」两条**已被否决**的路。
  - [x] 附带实测（如实登记，非缺陷）：`hidden-context` 本次落了 **2 条**（预期 1 条）—— 第 2 条多出「项目记忆目录」行，
        是 run 1 里 agent 写了记忆导致 `memoryReminder` 指针出现，属**真实环境事实变化**，不是分钟抖动重发；
        同一次变化也让 `runtime-context` 追加（3,363 → 3,515，多出「### 近期日志（按需读取）」段）
  - **依赖**：Task 2…Task 4

# Task Dependencies

- Task 2 依赖 Task 1（块形状先定）
- Task 3 依赖 Task 2
- Task 4 依赖 Task 2（措辞要按实现后的真实形态写）
- Task 5 依赖 Task 2…Task 4
- Task 1 无依赖，可先行

# 预期收益与实际（对照）

| 项 | 预期 | 实测 |
| --- | --- | --- |
| 环境块重发 | 从「每跨分钟一次」变成「只在环境事实变时」 | ✅ 2 条 / 5 run，且第 2 条由真实事实变化触发 |
| 时间块 | 每跨分钟 run 一条 | ✅ 4 条 / 5 run（同分钟的 run 去重掉了） |
| 每 run 快照新增内容 | ≈530 → ≈20 token | 513 → **61** estTokens（−88.1%）；差额来自 A 的声明与容器，预估漏算 |
| 会话级加权命中率 | 小幅上升 | 97.43% → **98.07%** |
