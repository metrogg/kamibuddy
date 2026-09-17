# Tasks

> 参考实现：`开源项目/deepseek-harness`（`packages/core/system-prompt`、`packages/core/agent-loop/src/runtime-context.ts`、
> `.agents/notes/implemented/feature/2026-09-02-in-history-system-prompt-replacement.md`）。
> 验证统一用 `npm run typecheck && npm run check:deps && npm test`（本改动不涉及 `documents/`）。

- [x] Task 1: 写真实 API 探针，回答「sections patch 在 DeepSeek 上语义是否成立」
  - [x] SubTask 1.1: 新增 `scripts/probe-prompt-cache.ts`（`npm run probe:prompt-cache`），同一会话连发多轮，
        每轮打印 `轮 N 步 M: prompt=<billedInput> cacheRead=<n> hit=<p>%`（口径复用 `billedInputTokens` / `cacheHitRate`）
  - [x] SubTask 1.2: dump 每次请求的实际消息结构与 payload（role 序列、system 消息条数、`replace` / `sections` 键）
  - [x] SubTask 1.3: 语义正确性断言（只改一个 section，验证模型不丢未变化的段）
  - [x] SubTask 1.4: 读数与结论写进 `spec.md` 的「探针结论（实测）」段
  - **实测结论（改变了原路线）**：**发布版 `@earendil-works/pi-coding-agent@0.85.1` 根本没有 sections / forceSystemPrompt / diffSystemPromptSections**
    （那套只在 `开源项目/pi` 克隆里，它比 v0.85.1 新 85 个提交），`emitBeforeAgentStart` 只认返回的 `systemPrompt` 字符串。
    因此「改 `systemPromptOptions` 走分段 patch」**在当前依赖上不存在**。
    可用的路线是「保持 forced 替换 + 保证系统提示词在同一会话内逐轮字节稳定」：实测提示词**字节未变**时 pi 不发新 system 消息、
    缓存命中 **93.2%**（同日对照：变更一行 → **62.0%**；A 组三轮 system 消息条数恒为 1，无 patch、无重放数组）。

- [x] Task 2: 把逐轮会变的事实移出系统提示词（两条路线的共同必需项）
  - [x] SubTask 2.1–2.3: 运行时间块 / 记忆内容段 / 个性化段移出系统提示词
  - [x] SubTask 2.4: 空内容不注入（零 token 口径不变）；注入内容不经残留槽位检查（用户数据性质保持）
  - [x] SubTask 2.5: `PromptSegmentSource` 删除 `time` / `memory` / `personalization`，`composePromptWithMeta` 不再推入这三段
  - **实现方式**（比 spec 原设想更优，理由已写进 `prompt-switch.ts` 文件头）：走 pi 的 **`context` 事件**（`transformContext`，
    每次模型调用前触发）注入，消息追加在**消息数组末尾**（= 历史之后），`role:"custom"` + `customType:"kamibuddy-runtime-context"`，
    **每请求现算、不落会话文件** —— 同时满足「绝不改系统提示词 / 落在历史之后 / 不无界增长日志」三条判据，
    优于 `before_agent_start` 的 `message`（后者会持久化进会话、需自行维护变化检测）。

- [x] Task 3: 工作目录收敛到单一来源
  - [x] SubTask 3.1: 删 `resources/scenes/work/prompt.md` 与 `code/prompt.md` 的 `当前工作目录：{{cwd}}` 行
  - [x] SubTask 3.2: `prompt-composer` 去掉 `cwd` 槽位（`{{cwd}}` 现在响亮抛错，护栏未放松）；`{{model}}` 全库无使用者，一并移除
  - [x] SubTask 3.3: `prompt-preview.ts` 与 `request_snapshot.systemSegments` 口径同步（不再产出该 skeleton 残段）
  - [x] SubTask 3.4: `resources.test.ts` / `prompt-composer.test.ts` / `prompt-preview.test.ts` 的骨架断言更新
  - **实测结论（与 spec 原假设不同，节录如实记录）**：pi 内置的 cwd 行**不会**替我们保住 ——
    发布版 `dist/core/agent-session` 在 handler 返回 `systemPrompt` 时整串覆盖，pi 版本的 cwd 行一起没了。
    cwd 的实际唯一来源是 `session-host.composeRunHiddenContext` 的 `workspace_context`（注入在 user 轮 = 历史之后），
    **比原方案更好**（cwd 不再位于缓存前缀里）。子代理路径例外：`composeSubagentPrompt` 仍在代码里写 `当前工作目录：<cwd>`
    （非场景骨架、会话内定值，不破坏字节稳定），已在两处注释中如实标注。

- [x] Task 4: 按 Task 1 判据走「字节稳定」路线（**原 4.2/4.3「换成声明式分段」按 4.1 的判据跳过**）
  - [x] SubTask 4.1: 判据 = Task 1 实测（patch 路径在发布版依赖上不存在）→ **走字节稳定路线**，本处即记录
  - [x] SubTask 4.2（替换内容）: **收敛「时间」到单一来源** —— 删掉新注入块里的时间，
        保留既有 hidden context 的 `current_time`（既有机制、位于历史之后、其 `additional-data` 被压缩链路按一次性语义处理）；
        删掉零引用的 `formatRuntimeTime` 及其专属用例
  - [x] SubTask 4.3（替换内容）: 复核「cwd 单一来源」成立（用户会话：hidden context 的 `workspace_context`）
  - [x] SubTask 4.4: 组装失败响亮抛错的既有护栏全部保留（片段缺失/成环/超深/残留槽位/未支持槽位）
  - [x] SubTask 4.5: 把「字节稳定 = 缓存不变量」与「0.85.1 无 sections 路径」的路线判据写进
        `prompt-composer.ts` 与 `prompt-switch.ts` 文件头（并删除旧注释里「环境块放末尾有利缓存」那类**错误推理**：
        末尾仍在整段历史之前，放末尾并不保护历史）

- [x] Task 5: 回归门禁
  - [x] SubTask 5.1: 反向钉子 —— 断言 handler **必须返回** `systemPrompt`（被关掉会漏出 pi 默认 coding 提示词），
        注释写明路线判据（原文「断言不返回 systemPrompt」随路线作废，理由见 Task 4.1）
  - [x] SubTask 5.2: 同会话提示词**字节稳定**单测（真实 `loadResources`，work×code × craft/ask/plan 共 6 例，
        时钟从 09:59:59 推到次日 11:01，断言两轮 `systemPrompt` 严格相等）+ 时钟确实推进/内容非空/piContext 已拼回的防假绿守卫
  - [x] 附加钉子: 注入块不含任何时间格式且对不同时刻字节相等；注入只追加在消息末尾且历史逐条引用不变；系统提示词不含会话 cwd
  - **门禁自证**（人为改坏三次，均精确变红后改回）：① 往提示词塞时间 → 6 例红；② handler 改为 `return {}` → 1 例红；
    ③ 往注入块塞时间 → 3 例红

- [x] Task 6: 文档同步
  - [x] SubTask 6.1: `docs/可观测性清单.md` 新增 `CACHE8 | 提示词前缀稳定性` 表行（结构性前提 + 复跑入口 `npm run probe:prompt-cache`）
  - [x] SubTask 6.2: 复核并补齐 `prompt-composer.ts` / `prompt-switch.ts` 文件头纪律；发现并修正两处不准确表述 ——
        ① 「cwd 唯一来源」对子代理不成立 → 限定为「用户会话」并注明例外；② 「工作区文件内容禁入提示词」与
        `formatPiContextBlock` 仍拼 `contextFiles` 冲突 → 精确表述为「唯一留在提示词里的工作区文件内容、
        会话建立时装载、会话内不重读，属受限例外」
  - [x] SubTask 6.3: 基线数据与复跑口径追加进 `docs/可观测性清单.md`（**未新建文档文件**）：
        6 会话首调 1,408–2,816 tokens / prompt 12K–22K、断点在原 cwd 行、单轮 92.4% = 该情形上限、
        探针 93.2% vs 62.0%、最终纪律清单（时间 / 记忆内容 / 个性化 / 工作区文件内容 / cwd）

# Task Dependencies

- Task 4 依赖 Task 1 的判据（已按「patch 路径不存在」走到字节稳定路线）
- Task 2、Task 3 与 Task 1 无依赖（已并行完成）
- Task 5、Task 6 依赖 Task 2/3/4（已完成）

# 遗留（不在本次范围，如实登记）

- `docs/可观测性清单.md` 的 `LOG13`（缺消息逐条稳定标识）仍未解决 → `CACHE6`（反推命中前缀边界）仍算不出来，
  本次只能靠探针与 `request_snapshot.systemSegments` 间接判定，**指不出具体断点**。
- `daemon/index.ts` 的 `composeSystemPrompt` 未导出，门禁用的是「同款输入的镜像」；若有人只在 daemon 那份里
  拼入逐轮可变事实，现有测试不会红（Task 5 报告的第 1 条风险）。
- 子代理提示词（`composeSubagentPrompt`）仍带 `当前工作目录：<cwd>` 与 pi-context，未纳入本次纪律（非场景骨架、会话内定值）。
- **探针的提示词形态与生产形态已脱节**（独立验证者发现）：`scripts/probe-prompt-cache.ts` 里的 `buildShapedPrompt`
  仍做 `replace("{{cwd}}", cwd)` 并自行拼 `Current time: …`，即它模拟的是**改造前**的提示词形态。
  因此它的读数证明的是「字节稳定性这一机制成立」，**不是**出货提示词的真实形态。结论不受影响；
  若将来要把探针当严格回归证据，应先让它改用 `composePromptWithMeta` 的真实产物。
- 独立验证者另发现并已修正的一处过时注释：`src/core/resources.ts` 的场景接口注释仍写着骨架含 `{{cwd}}` 槽位（已同步）。

# 独立验证结论（2026-09-17）

16 项检查点**全部 PASS**，无 FAIL。验证者实跑 `typecheck` / `check:deps` / `npm test`（唯一失败为环境性基线
`confinement.win.test.ts`）、实跑探针复现读数（62.0% / 94.1%）、并对两条核心钉子做了「改坏 → 变红 → 还原」实测。
验证者提出的两处非功能性问题（spec 的 Requirements 段未随实测回写、探针形态漂移）已在本轮处理：前者已回写订正，
后者登记在上方遗留。

# 后续修复（2026-09-17，按重要级，已全部完成）

- [x] 后续-A（最高）：**堵住门禁缺口** —— 抽出可测的生产组装入口，让门禁直接钉生产那份
  - 新增 `src/core/system-prompt-composer.ts`：`assembleSystemPrompt`（字节来源：段序 + 技能段门控 + `composePromptWithMeta`）、
    `createSystemPromptComposer(deps)`（依赖注入）、`createSystemPromptComposerFromDefaults(options)`（生产入口）
  - `src/daemon/index.ts` 删掉私有 `composeSystemPrompt`，三个调用点改用生产入口（薄适配）
  - `src/daemon/prompt-preview.ts` 改为复用 `assembleSystemPrompt` → **手抄的技能段门控镜像消失**（消掉验证者标记的弱证据⑩）
  - 门禁测试改为透过生产入口断言；新增「产物不含任何时间/日期形态」用例
  - **纯重构举证**：对 2 场景 × 3 模式 × 3 种 piContext × 4 种 styleId × 2 种 expertId = **144 组输入**，
    与重构前逐字节比对 **prompt / systemTokens / skillsTokens / segments 全部一致**
  - 新钉子自证：往 `assembleSystemPrompt` 塞 `new Date().toISOString()` → 7 例红（字节稳定 6 例 + 新钉子 1 例）→ 还原后 15 例全绿

- [x] 后续-B：**探针改用真实组装产物**（成为出货形态的回归证据）
  - `scripts/probe-prompt-cache.ts` 整篇重写：删除 `buildShapedPrompt`（含失效的 `replace("{{cwd}}")` 与自拼 `Current time:`），
    改用 `createSystemPromptComposerFromDefaults`；A 组=同一真实产物三轮、B 组=真实产物+首行追加一处；去掉时钟冻结
  - 实测（`deepseek/deepseek-flash`，work×craft，真实产物 9395 字符）：
    A 组 51.6% → **93.6% / 93.4%**（产物字节未变）；B 组 96.1% → **0.0%**（首行改一处 = 断点在第 0 字符）
  - 自断言：A 组三轮产物逐字一致、B 组只差一处、B 轮 1 与 A 组产物逐字节相同；请求结构 dump 显示 system 条数恒 `1/1/1`（无 patch）

- [x] 后续-C：**LOG13 消息稳定标识 → CACHE6 命中前缀边界反推**
  - 稳定 id：`toolResult:<toolCallId>` / `<rawRole>:<timestamp>`（同角色同毫秒按出现序加 `#n`），**只取身份不取内容**；
    内容改写 → id 不变、指纹（FNV-1a）变；位置变化 → id 不变、下标变
  - 台账：`RequestSnapshotData.messageList?: readonly MessageRef[]`（id/role/chars/tokens/fp，**不落正文**），可选字段向后兼容（旧台账返回 unknown）
  - 纯函数 `src/shared/cache-prefix.ts` 的 `inferCachePrefixBreak`：先用「上一轮 prompt 总量 − 上一轮消息估算总量」定标前缀，
    再按前缀累加与 `cacheRead` 对齐；超界时收敛到与上一轮的首个差异点并标 uncertain
  - 面板：④ 单步详情加**一行**（复用既有 `task-diag-note` 类，零 CSS、零新组件）
  - 文档：`docs/可观测性清单.md` 的 `LOG13` / `CACHE6` 两行由 ❌ 改 ✅，表头汇总同步（✅ 56 / ❌ 15）
  - 自证：改坏 `fp` 与差异点收敛判定 → 2 例红 → 还原后 82 例全绿
  - 如实登记的局限：系统提示词**内部**断在哪一段仍指不出来；token 是字符估算而非真 tokenizer；图片附件 token 未计

# 合并态最终验收（2026-09-17）

`npm run check` → exit 0（typecheck + check:deps + check:tokens 全过）；`npm test` → **126 文件全绿**。
本机 `confinement.win.test.ts`（受限令牌被外部沙箱拦截）在最终一轮通过 —— 该用例的结果随 IDE 沙箱状态浮动，与本改动无关。

# 第三轮：分段指纹归因 + dsh 契约文档 + 底部指标条验收（2026-09-17）

- [x] ① 把「系统提示词的哪一段变了」变成确证（不再只报「断在消息列表之前」）
  - 指纹抽到唯一处：`src/shared/observability.ts` 的 `contentFingerprint`（FNV-1a），
    `session-host.buildMessageRefs` 与 `system-prompt-composer` 的分段产出共用（原 `session-host` 里那份已删）
  - `SystemSegmentStat.fp?: number`（可选、不可逆、仍不落正文）；扩展 `inferCachePrefixBreak` 的 `before_messages` 分支，
    输出 `segment_changed` / `segment_appended` / `segment_removed` / `unchanged`（断在提示词之前）/ `undetermined`（旧台账无 fp）
  - **瞬态注入项不再误报**：`MessageRef.transient` 标记 `kamibuddy-runtime-context`（每请求现算、不落盘），
    归因时剔除 —— 否则每轮都在尾部造一个假差异（旧台账退到「role 为 other 的尾部条目」判据）
  - 面板文案（实拍）：`缓存断点：系统提示词的 skills 段变了（前 2 段命中，1200 → 1180 字符），其后的消息全部失效。`
  - 自证：改坏指纹 → 2 例红；改坏 `dropTransient` → 2 例红；均还原后全绿
  - `npm run check` exit 0；`npm test` 126 文件全绿（2292 passed）

- [x] ② dsh 必要文档消化落地（不整篇抄，避免漂移与合规风险）
  - 新建 `docs/提示词前缀缓存契约.md`：11 条契约要点（每条含「dsh 来源路径 / 我们的对应物 / 差距」）+
    「已对齐 4 条 / 仍未对齐 8 条」对照 + 「升级 pi 时的复核入口」；文件头声明「本文件是消化稿，不是替代，以克隆为准」
  - `src/core/system-prompt-composer.ts` 文件头加指针（避免死文档）
  - 关键结论：dsh 的 **delta 方案被它自己依模型契约否决**，而我们的探针实测显示该契约在本端点未复现 ——
    所以升级 pi 时**不能照搬整条路线**，必须先复跑 `npm run probe:prompt-cache`

- [x] ③ 底部指标条验收（重点：缓存命中）—— 独立验收者结论
  - **口径与显示路径 PASS**：分子 `ΣcacheRead`、分母 `Σ(input+cacheRead+cacheWrite)`（**含 cacheWrite**）；
    pi 的 `input` 是「未缓存输入」（openai-completions 路径实测 `input = prompt_tokens − cached − cache_write`）；
    `cacheReported` 门控单点判定、会话级粘性；一位小数只由 daemon 的卡驱动，renderer 不二次计算
  - **回归基线 PASS**：用**生产 fold** 复算真实台账 `01a0adb2-…`（旧台账、无 fp、无 messageList）得到
    `cacheHitRate = 0.9244169427115737` → 显示 **92.4%**，`ΣbilledInputTokens = 594,710` → 显示 **594.7K**，
    与界面一致。**注意**：610,943 是 `totalTokens`（含 output），不是「输入」那个数
  - **端到端 PASS**：4 次真实模型会话，卡里的值与 provider usage 明文逐项相等；台账 usage 与进程内 usage 逐条相等
  - **改动未污染读数 PASS**：注入块在 payload 里恰好出现 1 次、不落会话文件、台账里恰好 1 条 `transient`；
    `messageList` 与 `fp`/`transient` 不参与指标条口径（fold 对 `request_snapshot` 直接跳过）
  - **降级路径 PASS**：`cacheReported=false` → 「缓存命中」整项消失（不是 0%）；无数据 → 整行不渲染
  - **发现一个会压低这个数的真问题（未修，待决策）**：见下方「待决策」

# 待决策：hidden context 的插入位置让「上一轮整段」每轮重付

独立验收者用 `before_provider_request` 逐条 diff payload 得到：**缓存断点固定在「上一轮那条 user 消息」处** ——
hidden context 是 `prependHiddenContext` 贴进**最后一条 user 消息的内容**（`src/shared/hidden-context.ts` +
`core/session-host.ts` 的 `composeRunHiddenContext`），而 transformContext 的改写**不落会话**，下一轮该条恢复原文、
hidden 改贴到新的最后一条 user。

后果（本次修复的同类缺陷，只是位置从系统提示词挪到了消息里）：断点落在上一轮 user 消息上 ⇒
**上一轮整段（user + 助手回复 + 全部工具结果）在下一轮被重新计费**。

机制已由 payload diff 确证；**幅度尚未实测**（验收者的 3 轮样本每轮输出极小，看不出来；用户那次 16 步会话只有 1 轮）。

两个方向（都需要用户拍板，因为都会动到模型可见布局或既有压缩语义）：
1. 把 hidden context 从「贴进最后一条 user 消息」改为「作为**尾部独立消息**追加」（与 `context` 事件的注入同位）——
   按前缀匹配推算，跨轮断点会从「上一轮 user 之前」后移到「上一轮最后一条工具结果之后」，
   即**回收上一轮整段的重计费**。风险：`data-role="user-context" / "additional-data"` 的压缩语义
   （user-context 整块保留、additional-data 可整体剥离）是按「挂在 user 消息里」设计的，要一并核对。
2. 接受现状，只在 UI 上把口径说清（明示「缓存命中 = 本轮 prompt 的三桶之比，跨轮会有一次尾部重计费」）。

先补一次测量再决定：跑一个 **10+ 轮、带工具调用**的长会话，用同一套 fold 看命中率随轮次的走势。

# 第四轮：三个已知问题逐一修复（2026-09-17）

**核查结论（改法的前提）**
- `data-role="user-context" / "additional-data"` 这份「压缩协议」**在我们仓库里没有任何消费方**（全库只有
  `hidden-context.ts`、`session-host`、诊断面板 IPC 读它；subagent-sanitize 的 `system-reminder` 是入站防伪造转义，与位置无关），
  且 hidden 不落会话文件 → pi 自己的压缩也看不到它 ⇒ **改注入位置不破坏任何已实现的压缩逻辑**。
- 进一步推导：只把「消息内前置」改成「消息内后置」**不够**（差异仍在同一条消息内，上一轮照样全废）；
  必须改成**尾部独立消息**，差异点才会落到「上一轮最后一条已落盘消息之后」。

- [x] 修复 1（最重要）：hidden context 改为**尾部独立消息**
  - `prependHiddenContext` → `appendHiddenContext`（`shared/hidden-context.ts`），调用点 `core/session-host.ts`
  - 形态与 `prompt-switch` 的 `context` 注入同构：`role:"custom"` + `customType:"kamibuddy-hidden-context"` + `display:false`
  - **注入正文渲染字节一行未改**（仍是 `<system-reminder data-role="…">…</system-reminder>` 两块）
  - 瞬态常量集中到 `shared/observability.ts`（`TRANSIENT_INJECTION_CUSTOM_TYPES`），归因侧认整组，不再每轮误报
  - 台账计数随之自然变化：hidden 从 `user` 迁到 `other`（诊断面板 `snapshot-breakdown.tsx` 的括注已同步订正）
  - 新增**跨轮缓存不变量**钉子（形态级 + 走真实 `transformContext` 的端到端），断言的是「上一轮已落盘消息在下一轮逐字节不变」；
    改坏回旧形态实测 **9 例红**、还原后 127 例全绿
  - 文档同步：`docs/提示词前缀缓存契约.md`（两通道现在同侧）、`docs/workbuddy对齐清单.md` F5（标注**有意偏离 WB** + 实测数字）
- [x] 修复 2：页脚 `↑` 统一为 billedInput（`renderer/turn-metrics.ts`），与底栏「输入」、诊断面板 `↑` 同口径
  - 真实台账复算：第 3 轮 `↑1.3M × 命中 94% = cacheRead 1,202,560` **分毫不差**；`↑×(1−命中) = 75,493 = Σinput`
  - 消费方核实：只有 `chat-view.tsx` 一处；改坏实测 8 例红
- [x] 修复 3：面板收束行加范围限定（`成功 本轮 共 1m48s 734.4K tok 缓存 92%`），不再与底栏会话级读数读成矛盾
  - 顺带核实并修掉同屏一处**真不一致**：面板「会话总览 · 缓存命中」原本取整（会显示 95%），而底栏同屏显示 94.6% → 统一为一位小数；
    轮/步级仍取整（另一范围的量）
  - 「模型 #N」= **run 内**步号（已核实；本会话未触发台账截尾）
- [x] 修复 4（顺手）：`src/renderer/snapshot-breakdown.tsx` 的过时括注改为「计入下面的 other 计数」

**合并态验收**：`npm run typecheck` / `check:deps`（331 文件）/ `check:tokens`（真违例 0）**全绿**；`npm test` **126 文件全绿**。
（过程中 Agent 报告过 `widget-view.test.ts` 的依赖违例与 `widget-view.tsx` 的视觉值违例 —— 经查是**另一条并行工作流改到一半的瞬时状态**，
未回滚任何人的改动，复查时已自愈。）

**仍未验证（如实）**：
1. **真实多轮会话的命中率是否升到 ~97%** —— 本次只有形态级与端到端单测证据；复跑入口：`npm run probe:prompt-cache`，
   或跑一个带工具调用的 3+ 轮会话，再用同一 fold 看轮边界首步是否从 21.5% / 65.6% 升到 90%+。
2. **模型侧读序变化**：环境说明现在排在用户正文**之后**（有意偏离 WorkBuddy），模型对工作目录/时间/场景的引用是否变差，单测看不出来。
