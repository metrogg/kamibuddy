# Checklist

> 判定来自一次**独立验证**（未参与实现的验证者逐条自查 + 3 组「改坏 → 变红 → 还原」自跑 + `--replay` 只读复算）。
> 凡「表述与事实不符」的条目已按验证结论订正，订正处写明原因；未通过 / 有前提的条目标 `[ ]` 并注明缺什么。

## 取代声明（A）
- [x] `SNAPSHOT_SUPERSEDE_NOTE` 是**单点常量**，全库 grep 只在 `src/shared/hidden-context.ts:89` 命中一处字面量；三处消费点（`hidden-context.ts:128` / `prompt-composer.ts:266`）都从它取
- [x] 三条通道正文都以该声明开头（容器内第一行 / 正文第一行）：会话文件 **8/8 条**命中（验证者自己解析会话文件读出）
- [x] 声明是常量 ⇒ 同内容逐字节相同仍**不追加**：实证 5 个 run 只落 4 条 `run-time`（两次 run 同分钟去重）、`runtime-context` 5 run 只落 2 条
- [x] `hidden-context` 的容器契约未变：`git diff -U0` 显示 `HIDDEN_CONTEXT_MARKER` 与 `wrapHiddenContextXml` 都是**上下文行**（未改动）；既有格式断言仍在钉

## 时间通道拆分（B）
- [x] `kamibuddy-hidden-context` 正文**不再含** `<current_time>`（会话文件两条环境块 971 / 1083 字符，验证者逐条确认）
- [x] 新增 `kamibuddy-run-time` 条目，正文含取代声明 + `<current_time>`（4 条，各 150 字符，`display:false`）
- [x] 单测：环境未变、仅跨分钟 ⇒ **只追加 run-time 一条**，环境块不追加
      —— **牙齿来自 `prompt-switch-session.test.ts` 7.1，它打在会话文件的原始 JSONL 行（`raw` + `index`）上**。
      **附注（验证者的负向发现）**：纯 handler 层的 `prompt-switch.test.ts`（23 例）在这次回退下**全绿** ⇒ 它只是形态钉子、**没有牙齿**，别把它当主证据
- [x] 单测：目录变了、时间未变 ⇒ 只追加环境块一条（`prompt-switch-session.test.ts` 7.2 + `session-host.test.ts` 对拆分后两份的断言）
- [x] 单测：三条通道互不触发（`prompt-switch.test.ts` 三条交错基线 + 7.3 三次 run 各只变一条：`[1,1,1]→[2,1,1]→[2,2,1]`）
- [x] 三个 handler 注册顺序固定、请求体里相对顺序跨调用**逐位不变**（钉在模型端点收到的原始请求体上）

## 门禁自证（验证者**自己**改坏，非引用他人记录）
- [x] 把时间拼回环境块 → 5 red，报错原文与 `tasks.md` Task 3.1 引用**逐字一致** → 还原后全绿
- [x] 去掉取代声明 → 5 red（含期望/实际正文对照）→ 还原后全绿
- [x] 三个 handler 串台 → 10 red（`runtime 通道读到了别人的基线`）→ 还原后全绿
- [x] 还原证明：三文件 SHA256 与 `git status --short` 与改前**逐项一致**，`typecheck` exit 0
- [x] （订正）`tasks.md` 里「还原后 128 例全绿」「6 failed / 172 passed」两个**计数验证者复现不出来**（他按改坏波及集跑出 117 / 94 / 44 例）；**红点与报错文本可逐字复现**。已在 `tasks.md` 追加事实性订正（原记录不删、结论不动）
- [x] `npm run typecheck && npm run check:deps && npm run check` 通过（实跑：`扫描 379 个文件。依赖方向校验通过。`；model-experience 21 个模块、invariants 25 个在范围模块全过）
- [x] `npm test` 全绿（实跑：`Test Files 147 passed (147)` / `Tests 2657 passed | 1 skipped (2658)`）

## 文档与口径
- [x] 三处「模型体验契约」段按三通道改写且 `check:model-experience` 通过
      —— **附注**：该校验是**纯结构门禁**（只查三段标签存在/顺序/非空），**不校验内容真伪**；所以「契约段与真实形态一致」在机械门禁里**没有牙齿**，只能靠人读
- [x] 「约 40 字符」这处**陈旧数字已订正为实测口径**（共 7 处：`hidden-context.ts` ×2、`prompt-switch.ts` ×2、`session-host.ts` ×1、`可观测性清单.md` ×1、`prompt-switch.test.ts` 注释 ×1）。
      实测构成：150 字符 / 61 estTokens = 时间戳 26 字符 ≈11 est + 取代声明 26 字符 ≈26 est（A 的代价）+ 容器与 `<current_time>` 标签 98 字符 ≈**25** est
      （验证者报的 ≈35 est 经实现者复测修正为 25；11+26+25=62 ≈ 61 取整自洽）
- [x] `docs/可观测性清单.md`（CACHE8 行 + 「时间拆成独立通道」段 + CACHE6 的 customType 清单 + 头部注记）已同步，并写明 `hiddenContextChars` **只算环境块、不含时间块**
- [x] `docs/提示词前缀缓存契约.md` §2/§7/对照结论表/文末互链与 `docs/workbuddy对齐清单.md` F5 已同步
- [x] `.trae/specs/persist-context-snapshots/`（已冻结旧记录）按 `AGENTS.md §8` **只补状态与事实性路径 + 互链**，结论未动（上限 2 → 3、环境块不再含时间）
- [x] 陈旧注释 `pendingRunTime` 已清（`session-host.test.ts` 改为事实描述；全库 grep `pendingRunTime` 0 命中）
- [x] `spec.md` 的 `## 复跑实测` 段里「容器与标签 ≈35 est」一处未订正（它不在修正清单内，且属冻结决策记录的实测段）—— **留给用户裁量是否单独补一句**

## 真实复跑
- [x] 会话级加权命中率 **98.07%**（Σprompt=977,739 / ΣcacheRead=958,848），基线 **97.43%**（+0.64pp）。
      **口径提醒**：这是**方向证据**，不是硬指标 —— 两次会话的调用数（26 vs 24）、轮次数、冷启动基数（2,509 vs 4,124）都不同
- [x] 逐对 `gap = prompt_{N-1} − cacheRead_N`：**25/25 通过**（全部 min −5,334 / **max 124** / 超 128 者 **0**；run 内 21 对 max 124、跨 run 4 对全为负）。验证者 `--replay` 只读复算与 spec 表格**逐格一致**
- [x] 会话文件新增条目数与预期一致：`run-time`×4（16:30/16:31/16:32/16:33，两次同分钟 run 去重掉一条）、环境块×2、`runtime-context`×2
      —— 环境块第 2 条**已定位为真实环境事实变化**（run 1 里 agent 写了记忆 ⇒ `memoryReminder` 多出「项目记忆目录：…」一行，验证者逐行 diff 确认只差这一行），**不是分钟抖动重发**；同一次变化也让 `runtime-context` 追加（多出「### 近期日志（按需读取）」段）
- [x] **B 的收益实测落地**：每（跨分钟）run 的快照新增内容 **513 → 61 estTokens（−452，−88.1%）**，口径是仓库的 `estimateTokens` **字符估算、非 provider 真 token**。
      原记「省 ~510 token/run」是改动前**重复内容量的估计**，不是落地收益，已订正为 452
- [x] 读数写进 `spec.md` 的 `## 复跑实测` 段，含「未达预期」小节（61 而非预估 20，差额来自 A 的声明与容器 —— 原预估漏算，非实现缺陷）
- [x] 真实复跑由**主流程**完成（探针实跑 5 run / 26 次调用，真实凭据与网络，成本量级 $0.01）；**独立验证者**按禁令未发真实请求，其职责是**只读复算** —— 台账存在且 `--replay` fold 与 spec 逐格一致。两侧职责已分工，无未覆盖项（真实 API 会花钱，不宜由验证者重复发）

## 压缩路径的额外覆盖（独立验证后追加）
- [x] `prompt-switch-session.test.ts` 6.1 新增断言：`compact()` 期间**每个**模型请求里 `<current_time>` 出现次数 ≤ 压缩前最后一次 run 的次数；且三条通道条数在压缩前后不变、压缩后文件末行必须是 `compaction`
- [x] **口径订正（实现者复测后发现字面断言与事实矛盾）**：压缩请求里**恒有 1 条** `<current_time>` —— 那是**历史里被摘要的那一条**（run 1 落的），不是新注入。且本夹具下 `compact()` 产生 **2 个**模型请求（split turn：历史摘要 + 回合前缀摘要，块数 1 / 0）。故判据用「不多于历史里的条数」、并遍历每个请求
- [x] **改坏自证（4 组，含原始报错）**：
      A「`snapshotMessage` 无条件返回 message」→ 红在既有去重断言（`to have a length of 1 but got 3`）；
      B「把时间注入挪进 `context` 事件」→ 红在新夹具守卫（`应当有且只有 1 条时间快照: expected 1 to be 2`，同时实测证明压缩请求仍是 1/0）；
      C「往 `preparation.messagesToSummarize` 推一条」→ 新断言①精确变红（`expected 2 to be less than or equal to 1`）；
      D「在 `session_before_compact` 里 `appendCustomMessageEntry`」→ 新断言②精确变红（`expected 2 to be 1`）
- [x] **结论（如实登记，防止后人误解这条断言的保护范围）**：「压缩路径不注入」是**结构性**的 —— pi 0.85.1 里压缩只与 run 共享**会话历史**一条通道（`compaction.js` 自己 `convertToLlm` 后直调 `streamFn`；实测 `compact()` 期间 `before_agent_start` handler 触发 **0** 次、`context` 事件也没发生）。
      所以 A、B 这类**普通回退改不红它**，只有人为在压缩路径上挂一个注入（C/D）才能变红。该说明已写进新断言注释
