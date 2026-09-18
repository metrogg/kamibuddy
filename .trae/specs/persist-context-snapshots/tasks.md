# Tasks

> 参考实现：`开源项目/deepseek-harness`（`packages/core/agent-loop/src/runtime-context.ts` 的 `project()`、
> `packages/core/system-prompt/src/index.ts` 的 `PromptContext`、`docs/subsystems/system-prompt.md`）。
> 验证统一用 `npm run typecheck && npm run check:deps && npm test`（本改动不涉及 `documents/`）。
> 证据基线：`~/.kamibuddy/logs/runs/01a0b2b3-2c58-73d3-86d8-fa46a81ca9d2.jsonl`（24 次调用、gap 恒定 2,423–2,615）。

- [x] Task 1: 契约与纯函数层（无接线，先钉住形态与判据）
  - [x] SubTask 1.1: 在 `src/shared/hidden-context.ts` 保留两块渲染字节**逐字节不变**（`composeHiddenContext` /
        `wrapHiddenContextXml` / `HIDDEN_CONTEXT_MARKER` 的输出零改动），删掉只服务「尾部不断追加」的
        `appendHiddenContext` 与其单测；文件头「为什么是尾部独立消息」整段重写为「为什么落盘 + 按需追加」
        （含实测数据：run 内 10/14 次逐字节相同、gap 2,423–2,615、占比 28.8%）
  - [x] SubTask 1.2: `customType` 常量集中处（现 `src/shared/observability.ts` 的 `TRANSIENT_INJECTION_CUSTOM_TYPES`）
        改为「上下文快照」语义的常量集（两个 customType 保留同名取值，改名后同步全部引用点），
        **删除** `MessageRef.transient` 字段与其写入分支（`session-host.buildMessageRefs`）
  - [x] SubTask 1.3: 新增纯函数判据 `shouldAppendSnapshot(previous: string | undefined, current: string): boolean`
        （判据 = 逐字节不等；`previous === undefined` ⇒ 追加），放在零运行时依赖的 shared 层，附单测
  - **验证**：`npm test` 中 hidden-context / observability 相关用例全绿；渲染字节的既有断言未被修改过
  - **依赖**：无
  - **实测落点**：`hidden-context.ts`（该文件已零 import）；`observability.ts` 的 `TRANSIENT_INJECTION_CUSTOM_TYPES` → `CONTEXT_SNAPSHOT_CUSTOM_TYPES`（两个 customType 取值不变），`MessageRef.transient` 已删
  - **[后续订正 2026-09-18]**：`CONTEXT_SNAPSHOT_CUSTOM_TYPES` 经独立核查确认**全库零消费者**（唯一提及是 `session-host.ts` 的一条注释），已按 YAGNI 删除；两个**单独**的 customType 常量 `RUNTIME_CONTEXT_CUSTOM_TYPE` / `HIDDEN_CONTEXT_CUSTOM_TYPE` 保留（`prompt-switch.ts` 在用），见 spec 的 `## REMOVED Requirements`。

- [x] Task 2: 注入通道迁移到 `before_agent_start` 的持久 message
  - [x] SubTask 2.1: `src/extensions/prompt-switch.ts` 的 `before_agent_start` handler 返回
        `{ systemPrompt, message }`；`message` 用 `composeRuntimeContext()` 的产物
        （`customType = kamibuddy-runtime-context`、`display:false`）；**删除** `pi.on("context")` 整段
  - [x] SubTask 2.2: 同一扩展注册**两个** `before_agent_start` handler（机制已核：pi 的 `runner.js` 遍历
        handler 数组、`loader.js` 注释原文 "A single extension may register multiple handlers for the same event"），
        第二条走新增入参 `composeHiddenContext: () => string | undefined`；两 handler 各自去重、各自返回自己那条
  - [x] SubTask 2.3: 去重基线取「会话活分支上最后一条同 `customType` 的快照正文」——
        用 `ctx.sessionManager.buildContextEntries()`（compaction-aware）从后往前找，**无进程内缓存**
  - [x] SubTask 2.4: `src/core/session-host.ts` 删除 `installHiddenContext` 与其调用点；
        保留 `freezeHiddenContext`（在 `session.prompt()` 之前完成 ⇒ `before_agent_start` 时已冻结）与
        `lastHiddenContext` / `peekHiddenContext`（daemon 读口）
  - [x] SubTask 2.5: daemon 三处接线（`index.ts` / `automation-runner.ts` / `subagent-runner.ts`（member 经 `buildSubagentExtensions` 覆盖））；
        `composeHiddenContext` 为**必填** ⇒ 漏接在**装配期（编译期）**即报错（无静默空注入）。
        **运行期不是响亮失败、而是读侧降级**：`automation-runner` / `subagent-runner` 的
        `getHost()?.peekHiddenContext()` 用**可选链**，缺 host 时静默得 `undefined` ⇒ 该 run 不注入；
        `prompt-switch` 读会话失败的 `catch { previous = undefined }` 静默转「追加」（多一条幂等噪声）。
        两处都是注释写明的读侧降级，与「必填」所保证的**装配期**响亮不矛盾 —— 不要把它读成「运行期也响亮」。
  - **验证**：`npm run typecheck` / `check:deps` / `check` 全绿；4 个相关测试文件 134 例通过；`npm test` 146 文件 / 2640 例全绿

- [x] Task 3: 快照对用户不可见（display:false 贯通）
  - [x] SubTask 3.1: `session-host.translate` —— 机制已核（`message_start` 只认 user/assistant、`message_end` 非 assistant 早退）
        ⇒ 快照一个事件都不产生。已用**真实 pi 事件序 + 真实 `translate`** 钉住：有/无快照的事件流逐条相等；
        折叠后只有 user + assistant，`turnTimings` 键、`lastUserEntryIndex`、`currentRunStartIndex` 全部不变
  - [x] SubTask 3.2: 导出正文安全（pi 模板对 `custom_message` 有 `display` 门槛）；重建链路
        `session-rebuild.ts` 的 `custom_message` 跳过已拆成独立一条并加断言（产出与不含快照时逐条相等）。
        **`session-export.ts` 无落点**：该文件只构造导出路径，HTML 完全由 pi 生成
  - [x] SubTask 3.3: conversation 折叠 / 轮切分：快照不产生任何 `SessionEvent` ⇒ reducer 结构上收不到它，
        加过滤会是死代码；已用 3.1 的第二个用例间接钉住三个派生量
  - **验证**：`check` 全绿；`npm test` 146 文件 / 2644 例全绿；两组「改坏 → 变红 → 还原」实测通过
  - **未达成（如实登记）**：pi 导出 HTML 的**侧边会话树**对 `custom_message` 无 `display` 门槛，
    会把快照正文前 100 字符印成树标签。修它只能对 pi 生成的 HTML 做 base64 解包 + 条目剔除 + 重写，
    依赖 pi 模板内部标记、pi 一改格式整条导出链路变脆（违反本项目「不写防御性兜底」与「能借力不自研」）⇒ **不做**，
    作为已知偏离交给用户裁决（见 spec 的「已知偏离」段）。
  - **依赖**：Task 2

- [x] Task 4: 台账与缓存断点归因退役「瞬态」概念
  - [x] SubTask 4.1: `cache-prefix.ts` 的 `dropTransient`、两个调用点、旧台账启发式分支全部删除；
        文件头新增「剔除史（留档）」如实纠正原文「假差异」的判断；`previousReal`/`currentReal` 移除，
        归因回到**全量名册**；`cache-prefix.test.ts` 的 `tailGhost` 与旧 describe 删除，
        换成 3 例「不得再掩盖尾部失配」的反向钉子
  - [x] SubTask 4.2: `RequestSnapshotData.hiddenContextChars` 注释按新事实订正（快照是 pi 落盘的持久普通条目、
        进 `messageList` 且不得再被剔除）；`snapshot-breakdown.tsx` 括注同步
        （并写明「用户可见条目数不变，只有 `other` 计数包含它」）
  - [x] SubTask 4.3: 新增 3 例断言断点落在快照条目时如实报出（不再 `all_hit`）
  - **验证**：复刻旧 `dropTransient` 改坏 → 2 例精确变红（其中 1 例正是复现盲区：hitCount 3→2）→ 还原；
        `check` 全绿；`npm test` 146 文件 / 2641 例全绿
  - **依赖**：Task 2

- [x] Task 5: 门禁 —— 把不变量钉成会变红的断言
  - [x] SubTask 5.1: **形态级**钉子（`src/extensions/prompt-switch-session.test.ts`）：走**真实 `createAgentSession`**
        （真 `DefaultResourceLoader` + 真 `SettingsManager` + 真 `SessionManager`（临时目录、真落盘）+ 真 `createPromptSwitch`），
        **唯一打桩处是模型端点**（本地 HTTP 假 OpenAI 兼容 SSE，同 `scripts/probe-structured-output.ts` 手法，不联网）。
        断言：一个 run 内 2 次模型调用 ⇒ 两通道各**恰好 1** 条快照、`display:false`、正文逐字节；
        文件行序实测 `session → model_change → thinking_level_change → message:user →
        custom_message:kamibuddy-runtime-context → custom_message:kamibuddy-hidden-context →
        message:assistant → message:toolResult → message:assistant`（快照确实落在用户消息**之后**）；
        第 1 / 第 2 次调用的**请求体**里该快照的下标逐位不变、且不在末尾（是历史，不是尾巴）
  - [x] SubTask 5.2: **跨 run** 钉子：同内容连跑两个 run 不新增条目；内容变了追加一条且既有那条的
        **原始 JSON 行 + 行号逐字节不变**（append-only）；再回到「与末条相同、与首条不同」的内容仍不追加
        —— 这一形态专门钉「基线取末条」（从前往后取的实现会在这里多追一条）
  - [x] SubTask 5.3: **resume** 钉子：`SessionManager.open` 读回同一会话文件重建会话；先证去重基线在
        `buildContextEntries()`（compaction-aware）里读得到，再证同内容不重复追加
  - [x] SubTask 5.4: **反向自证**（原始报错见交付汇报）：① 去掉去重判定 → 5.2 / 5.3 精确变红
        （`expected [ …, … ] to have a length of 1 but got 2`）；② 改回 `context` 事件尾部注入 →
        5.1 / 5.2 / 5.3 **全红**（`expected [] to have a length of 1 but got +0` —— 一条都没落盘）；
        ③ 基线从前往后取 → **只** 5.2 红（run 4 多追一条）。三处均已还原
  - **验证**：`npm run typecheck` / `check:deps` / `check` 全绿；`npm test` 147 文件 / 2647 通过 + 1 跳过
  - **[已补 2026-09-18]** 验证者实测：把基线改成 `getBranch()` 或 `getEntries()` **都不会变红**
        —— 二者只在**发生压缩后**才分叉，本套件原本不产生压缩。因此另补了 Task 9 的压缩夹具
        （6.1 用例），它内置前提守卫显式断言两条读法**确实分叉**，并已被反向自证（改基线 → 精确变红）。
        原 5.4 ③ 的「从前往后取」测的是**末条 vs 首条**，与「活分支 vs 非活分支」是两件事，不能互相顶替 ——
        保留它，但不再声称它覆盖了后者。
  - **已知偏差（不在本任务范围）**：`scripts/check-module-invariants.ts` 里
        `src/extensions/prompt-switch.ts` 的 `relationship` 仍写着退役的旧实现
        （「context 注入只在消息数组末尾追加」），是 Task 2 变更后遗留的陈旧登记 ——
        属 Task 6 的文档订正范围
  - **依赖**：Task 2、Task 3

- [x] Task 6: 文档订正（用户已授权修改此前由他人写下的文档）
  - [x] SubTask 6.1: `docs/提示词前缀缓存契约.md` —— §7 与 §2 的旧结论按 `AGENTS.md §8` 标 **[作废]** +
        保留原文引用 + 反例（不落盘 ⇒ 每轮新尾巴 ⇒ 每轮 miss，58,094 token / 28.8%）+ 互链；
        「对照结论」表同步；文末新增「四、本次改动的权威结论（互链）」，头部同步加互链
  - [x] SubTask 6.2: 两处文件头复核（Task 1/2 已改到位，无残留）；**额外**订正了 4 处同源陈旧事实：
        `src/core/session-host.ts`（L634/L2097）、`src/renderer/task-diagnostics-panel.tsx`（L272-277/L288/L330-333）、
        `scripts/check-module-invariants.ts`（L127 的 `relationship`）、`src/shared/runtimes.ts`（L24-38 的模型体验契约段）
  - [x] SubTask 6.3: `docs/可观测性清单.md`（CACHE8 行 + 新增基线小节 + CACHE6 前提 + 纪律清单）与
        `docs/workbuddy对齐清单.md` F5（偏离理由换代：缓存已不成立，改为读序不同）；
        另同步 `docs/workbuddy分析/11-hidden-context.md` 的落地状态
  - [x] 额外：`spec.md` 新增 `## 已知偏离` 段（导出侧边树 / 搜索索引泄漏快照正文，见 Task 8）
  - **验证**：`typecheck` / `check:deps` / `check:model-experience` / `check:invariants` / `check:tokens` 全绿；
        `npm test` 147 文件 / 2647 通过 + 1 跳过
  - **依赖**：Task 2

- [x] Task 7: 真实会话复跑验收（需要真实凭据；本任务以实测读数收口）
  - [x] SubTask 7.1: 新增真实 API 探针 `scripts/probe-context-snapshot.ts`（`npm run probe:context-snapshot`，含
        `--replay=<台账>` 只跑 fold 的对照组入口）：走 `SessionHost.create()` + 真实 `createPromptSwitch`
        （两条通道接真实记忆/个性化读取与宿主真实 `peekHiddenContext()`）+ 真实 provider + 真实台账；
        会话 **5 个 run / 24 次模型调用**，临时 cwd、真实 `~/.kamibuddy` 配置目录
        （会话 `01a0b325-7548-7588-b0d8-4e1eabb968b4`，题目同基线：人工智能发展历程 HTML 幻灯片）
  - [x] SubTask 7.2: 逐对校验 `prompt_{N-1} − cacheRead_N ≤ 128`：**23/23 对通过**
        （run 内 19 对 min −7,414 / max 56；跨 run 首调 4 对 min −497 / max −403；残差 ≤ 56 = 块粒度，
        无块级常量偏移）。会话级加权命中率 **97.43%**（基线 90.88%，目标 ≥95% 达成）；
        未命中拆解 冷启动 4,124 + 新增 34,147 − 续写命中 18,773 = 19,498（恒等式自洽）
  - [x] SubTask 7.3: 读数与结论回写 spec 的 `## 复跑实测` 段（含探针命令、模型、run/调用数、gap 区间与分布、
        加权命中率、基线对照、基线复算、会话文件里的持久/去重/落位实证、以及 4 条未达成/需注意）
  - **验证**：`npm run typecheck` / `check:deps` 全绿；`npm test` 147 文件 / 2647 通过 + 1 跳过
  - **实测落点**：探针 + `package.json` 一条 script（未改任何生产行为）
  - **未达成（如实登记）**：① 探针工具面小于真实 app 会话（只有 pi 内置 ∩ craft 白名单），命中率绝对值不可与基线直接相减
        ——同口径对照见 spec 的「未达成 / 需注意」①；② 单次会话读数，非统计样本；③ 压缩路径仍未实测
  - **依赖**：Task 2…Task 5

- [ ] Task 8（**延后，需用户裁决**）：导出 HTML 的侧边树与搜索索引泄漏快照正文
  - **现象（已核 pi 源码）**：导出模板对 `custom_message` 只在**正文**上尊重 `display`
    （`dist/core/export-html/template.js:1309` 的 `&& entry.display`），而**侧边树标签**（`:691-693`）
    与**搜索索引**（`:344-347`，`parts.push` 全文、不截断）都不看 `display` ⇒ 快照正文
    （含用户长期记忆 / 个人画像 / 工作目录 / 解释器路径）会进入导出文件。
  - **为什么本次没做**：`SessionHost.exportHtml` → pi 的 `exportToHtml(outputPath, {themeName})` **没有条目过滤参数**。
    两条可行路都不干净 ——（a）对 pi 生成的 HTML 解 base64、剔条目、重写：依赖模板内部标记，
    pi 一改格式整条导出链路变脆；（b）改走公开的 `exportFromFile(filteredJsonl)`：会**丢掉扩展工具卡的
    自定义渲染**（`toolRenderer` 是 pi 内部件），属功能倒退。按 `AGENTS.md`「不写防御性兜底、能借力不自研」，两条都不是现在该做的。
  - **留给用户裁决**：① 接受现状（导出是用户自己触发的本地产物，正文面已干净）；
    ② 认领 (a) 或 (b) 的代价；③ 上游提 issue 让 `display:false` 在树与搜索里也生效（最干净，但要等）。
  - 记录见 `spec.md` 的 `## 已知偏离`。

- [x] Task 9（独立验证后追加）：压缩路径夹具 —— 让「被遮蔽的快照会被重新追加」变成会变红的断言
  - `src/extensions/prompt-switch-session.test.ts` 新增 describe + 用例 6.1，走**真实 `AgentSession.compact()`**
    （真实 `prepareCompaction()` 切点算法 → 真实 `appendCompaction` 落盘 → 真实 `buildContextEntries()` 遮蔽语义）；
    唯一打桩处仍是本地 SSE 端点（压缩摘要那次调用也打到它，回一段固定摘要，**不开真实网络**）。
    夹具把 `compaction.keepRecentTokens` 设为 `1`（经真实 `SettingsManager` 读设置），使 run 1 落的快照被切进摘要区。
  - **内置前提守卫**（缺一条夹具就是装饰）：`activeHidden` 长度必须为 0、`branchHidden` ≥ 1
    （证明 `buildContextEntries()` 与 `getBranch()` **真的分叉**）、会话里必须真有 `compaction` 条目。
  - **反向自证**：把基线改成 `getBranch()` → 6.1 精确变红
    （`expected [ { index: 5, …(3) } ] to have a length of 2 but got 1`）；改成 `getEntries()` 同样红；
    5.1–5.3 三例仍全绿（证明这是此前不存在的覆盖）。已精确还原（`git diff` 中 `getBranch()`/`getEntries()` 出现 0 次）。
  - **验证**：`typecheck` / `check:deps` 全绿；`npm test` 147 文件 / 2648 通过 + 1 跳过
  - **仍未做**：真实 app 会话（daemon / SessionHost 路径）里触发一次压缩的端到端读数（探针不触发压缩）

- [ ] Task 10（**人工项，不可自动化，待用户确认**）：模型阅读顺序变化是否造成行为退化
  - 事实：注入块在**同一 run 内**的阅读位置从「整段历史的最后」变成「本轮用户消息之后」（`user → 快照 → assistant → 工具结果…`）。
  - 现有**自动**证据只到**落位**层：会话文件行序 `message:user → custom:runtime → custom:hidden`、
    请求体里快照下标 >0 且跨调用逐位不变、不在末尾；基线台账回放显示旧形态在末尾（`other@[…59,60]/61`）。
  - **「未造成行为退化」不可由现有测试推出** —— 仓库里没有 eval / 同题产物对照 / 人工记录。
    需要用户跑一道真实题并与基线台账的同题产物对照后确认（或在真实 app 里抽查模型对工作目录 / 时间 / 场景的引用是否变差）。

# Task Dependencies

- Task 2 依赖 Task 1（判据纯函数先就位）
- Task 3、Task 4 依赖 Task 2（通道迁完才知道要过滤什么）
- Task 5 依赖 Task 2、Task 3
- Task 6 依赖 Task 2（结论要按实现后的真实形态写）
- Task 7 依赖 Task 2…Task 5
- Task 8 是**延后项**（需用户裁决），不阻塞任何任务
- Task 9 依赖 Task 5（补的是 Task 5 未能覆盖的压缩形态）
- Task 10 是**人工项**（不可自动化），待用户确认
- Task 1 与其它任务无依赖，可先行

# 已知代价（本改动承认，不掩盖）

- **粒度放宽**：注入内容从「每 step 现算」变为「每 run 一次」。run 中途记忆被改，本 run 看不到，下一 run 生效。
  本项目当前没有 run 内的记忆写入口（记忆由每晚蒸馏任务维护），判定为可接受；若将来加了 run 内记忆写工具，需重新评估。
- **会话文件变大**：每个 run 最多追加 2 条（`runtime-context` 仅在记忆/个性化变化时追加）。长会话（50 run）粗估
  增加 200–400KB 量级；写入路径与 dsh 相同，未做额外压缩。
- **旧台账的归因会变**：`transient` 标记退役后，历史 run 的面板可能从「历史全命中」变为「断在尾部」——
  对那些 run 而言这是事实（当时确实每轮断在尾部）。
