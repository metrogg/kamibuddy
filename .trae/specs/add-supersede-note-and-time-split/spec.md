# 快照「取代」措辞 + 时间通道拆分 Spec

## Why

上一改动（`.trae/specs/persist-context-snapshots/`）把两个上下文快照从「每请求现算的尾巴」改成「落盘 + 按内容去重追加」后，主机制与 dsh 对齐了。真实台账读出来还剩两处不对称：

**A. 没有「后者取代前者」的措辞（模型可能拿旧快照当现行）。**
去重的设计是 append-only：内容变了就**追加**一条新的、旧的原样留着。真实探针会话里同一通道落了 3 条（`current_time` 分钟变了 3 次）：

```
行 6   hidden-context  14:12
行 20  hidden-context  14:13
行 33  hidden-context  14:14
```

模型现在能读到 3 份时间、将来还能读到多份用户画像（画像里写着「最后更新：2026-09-18」「截至 2026-09-16」这类**会过期**的事实），而**没有任何一句话告诉它以最新那条为准**。dsh 每条快照都自带：

> `Current runtime context. This snapshot supersedes earlier runtime-context snapshots.`

上下文清空时 dsh 还会追加 `none. Earlier runtime-context snapshots no longer apply.`，防止模型以为旧快照仍生效。

**B. `current_time` 与稳定内容挤在同一条消息里（分钟一变整块重发）。**
实测探针会话：`hidden-context` 每条 1,066 字符，其中只有 `<current_time>` 那 20 字符是真的新信息，其余（工作目录 / 运行时清单 / 记忆指针）逐字节没变却跟着重发。

```
hidden-context（1,066 字符）
├─ <workspace_context>      ≈ 100 字符   ← 不变
├─ <python_env>             ≈ 850 字符   ← 不变
├─ <memory_and_skills_...>  ≈ 100 字符   ← 不变
└─ <current_time>           ≈  20 字符   ← 每分钟变
```

按分钟变化 ⇒ 每 run 重发 1,066 字符（≈530 token），其中 ~510 token 是重复内容。

## What Changes

- **A：给每条快照加一句「取代」措辞。** 新增单点常量 `SNAPSHOT_SUPERSEDE_NOTE`（`src/shared/hidden-context.ts`），拼进**每一条**快照的开头：
  - `kamibuddy-hidden-context`（环境块）：容器内第一行；
  - `kamibuddy-run-time`（时间块，见 B）：容器内第一行；
  - `kamibuddy-runtime-context`（画像/个性化）：正文第一行（它本来就没有 XML 容器，顺带补一句最省事且不动既有容器契约）。
- **B：把 `additional-data`（当前时间）拆成独立的第三条通道。** `composeHiddenContext` 从「一次返回拼接好的整串」改为「按 role 一次产出一个块」；`session-host.composeRunHiddenContext` 产出**两个**值（环境块 / 时间块），各自独立去重、各自追加。新增 customType `kamibuddy-run-time`。
  - 附带收益：`data-role` 语义（`user-context` 常态保留 / `additional-data` 压缩时可整体剥离）从「同一条消息里的两个块」变成「两条消息」，将来的剥离策略可以整体删一条消息，比在一条消息里抠块更干净。
- **不动的东西**：两个既有通道的 `customType` 取值、去重判据（逐字节）、基线来源（`buildContextEntries()` 活条目）、append-only 语义、落位（本轮用户消息之后）全部不变。

**BREAKING（模型可见）**：三条快照的正文都变了（A 加了一行、B 拆了块）。已有会话的旧快照格式与新格式并存，**不需要迁移**（去重比的是同 `customType` 的最后一条，格式一变自然追加一条新的，旧的原样留档）。
**BREAKING（数据层）**：会话 JSONL 从此可能包含 `customType = kamibuddy-run-time` 的条目。

## Impact

- 受影响能力：上下文注入（三个通道的形状）、模型可见的快照措辞、每 run 的缓存成本、`request_snapshot` 的逐条清单与面板口径。
- 受影响代码：
  - `src/shared/hidden-context.ts`（`composeHiddenContext` → 按 role 产出；新增 `SNAPSHOT_SUPERSEDE_NOTE`）
  - `src/shared/observability.ts`（新增 `RUN_TIME_CUSTOM_TYPE`）
  - `src/core/prompt-composer.ts`（`formatRuntimeContext` 前置取代措辞）
  - `src/core/session-host.ts`（`composeRunHiddenContext` / `freezeHiddenContext` 产出与展示口拆成两份）
  - `src/extensions/prompt-switch.ts`（第三个 `before_agent_start` handler + 新入参 `composeRunTime`）
  - `src/daemon/index.ts`、`src/daemon/automation-runner.ts`、`src/daemon/subagent-runner.ts`（接线）
- 参考实现：`开源项目/deepseek-harness/packages/core/system-prompt/src/index.ts` 的 `joinContextSections`（取代措辞）、`packages/core/agent-loop/src/runtime-context.ts` 的 `CLEARED` 常量（清空标记）、`packages/core/agent-loop/src/runtime-context.ts:29-56`（构造时从会话日志恢复基线，与我们读 `buildContextEntries()` 语义一致）

## ADDED Requirements

### Requirement: 每条快照声明自己取代此前的同类快照

每条上下文快照的**正文** SHALL 以一句明确的取代声明开头，说明「本条取代此前所有同类快照、冲突时以本条为准」。该声明 SHALL 来自单点常量（不得在各通道各写一遍）。

#### Scenario: 模型读到多份快照时能判断哪条有效
- **WHEN** 同一通道在同一会话里落过多条快照（如 `current_time` 每 run 变化）
- **THEN** 每一条的正文都含取代声明；模型据以认定最后一条有效

#### Scenario: 取代声明不破坏去重
- **WHEN** 同一通道连续两次渲染出的内容逐字节相同
- **THEN** 仍然不追加（声明是常量，不引入新差异）

### Requirement: 当前时间独立成条，与环境块各自去重

`additional-data`（当前时间）SHALL 作为**独立的一条快照消息**（`customType = kamibuddy-run-time`）投递，SHALL NOT 与环境块（`kamibuddy-hidden-context`）共处同一条消息。

#### Scenario: 只有时间变化时只追加时间那一条
- **WHEN** 相邻两个 run 的环境事实（工作目录 / 运行时清单 / 记忆指针）逐字节未变，仅 `current_time` 跨了分钟
- **THEN** 只追加一条 `kamibuddy-run-time`；`kamibuddy-hidden-context` **不追加**（旧那条的字节与位置不变）

#### Scenario: 环境事实变化时只追加环境那一条
- **WHEN** 工作目录变了但时间未跨分钟
- **THEN** 只追加一条 `kamibuddy-hidden-context`；时间块不追加

#### Scenario: 三条通道互不干扰
- **WHEN** 三条快照各自的基线与变化情况不同
- **THEN** 每条只按自己的 `customType` 的末条基线判定，互不触发

## MODIFIED Requirements

### Requirement: 逐轮可变事实的投递形态（原 `persist-context-snapshots`）

通道数从 2 变成 3：`kamibuddy-runtime-context`（记忆 + 个性化）、`kamibuddy-hidden-context`（环境，**不再含时间**）、`kamibuddy-run-time`（当前时间）。其余纪律（落盘、逐字节去重、基线取活分支、append-only、落位用户消息之后、`display:false`）全部不变。

上一版把「时间与环境块同一条消息」当取舍（为减少通道数）；本次实测证明这个取舍的代价是每 run 重发 ~510 token 的重复内容，且 `data-role` 的压缩语义也无法整体作用到时间块上 —— 按新证据**改掉**。

## 否决方案

> 按 `AGENTS.md §8`：被否掉的路与理由留档。

**① 只加取代措辞，不拆时间通道 —— 否。**
A 能治「模型拿旧快照当现行」，治不了「分钟一变重发 1,066 字符」。两者根因不同（一个是措辞缺失，一个是块粒度），不互相替代。

**② 把 `current_time` 从快照里删掉（对齐 dsh 默认：不注入时间）—— 否。**
dsh 默认确实不注入时间（`context/time-context` 是 opt-in，且它开起来是**每 step** 追加一条 —— 那正是我们刚修掉的形态）。但我们的产品明确需要「现在几点」（系统提示词里已不含时间，`current_time` 是唯一来源），删掉是功能倒退。

**③ 把 `current_time` 的精度从分钟降到天 —— 否（不解决且丢能力）。**
降到天只是把「每 run 追加」变成「每天追加」，代价从 ~510 token/run 降到 ~0，但模型再也答不出「现在几点」。用拆通道能同时保住分钟精度与成本。

**④ 把时间并进系统提示词 —— 否。**
系统提示词是请求第一个 token 的位置，它一变**其后一切**（工具 + 整段历史）作废；而时间每 run 必变 ⇒ 每 run 全废。既有实测：只改 system → 首步 `cacheRead` 0（0.0%）。

**⑤ 引入 dsh 的 `CLEARED` 清空标记（上下文变成空时追加一条「此前的快照不再适用」）—— 本次不做，留档备查。**
dsh 那条的用途是：它的快照可能真的变空（沙箱策略等都可缺席），不标记的话模型会以为旧快照仍生效。我们的环境块理论上也可能缺席（`getRuntimeInventory` 未配置时 `python_env` 整段不在），但**用户会话恒有 `workspace_context`、恒有 `current_time`**，实测没有「整块变空」的路径。按 `AGENTS.md §9 YAGNI` 不预先实现；若将来出现「快照可整块消失」的场景，这条是现成的参考。

**⑥ 合并回一条消息、改用「内容里只放变化的那一段」的 delta 形式 —— 否。**
模型看到的是消息序列，delta 会让它误以为「只有这一段是当前的上下文」，而丢掉未变部分。dsh 对同一问题有明确否决记录（`Send only the changed sections as a delta` ——「a delta would silently drop every unchanged section. **Rejected on the model contract.**」）。

## 复跑实测

> 命令：`npm run probe:context-snapshot`（真实 `SessionHost.create()` + 真实 `createPromptSwitch` + 真实凭据与网络；读数由台账 fold 得出，非探针自计数）。
> 会话：`01a0b3a3-9270-75bc-b0a2-f660c6372caf`，台账 `~/.kamibuddy/logs/runs/01a0b3a3-….jsonl`，会话文件 `~/.kamibuddy/sessions/2026-09-18T08-30-36-657Z_01a0b3a3-….jsonl`。
> 模型：`deepseek/deepseek-v4-flash-vision-exp`（`api=openai-completions`，端点 `https://api.deepseek.com`）。
> 规模：**5 run / 26 次调用**。对照基线 `01a0b325-…` 用 `--replay` 同一套 fold 复算，逐项复现（24 次调用 / 97.43% / gap.min=−7,414 gap.max=56 / over128=0），口径未分家。

| 读数 | 基线 `01a0b325-…`（改动前） | 本次 `01a0b3a3-…`（改动后） |
| --- | --- | --- |
| 调用 / run | 24 / 5 | 26 / 5 |
| gap（run 内相邻 step） | n=19 min=−7,414 max=56 | n=21 min=−5,334 max=124 |
| gap（跨 run 首调） | n=4 min=−497 max=−403 | n=4 min=−643 max=−369 |
| gap 分布 | ≤0: 21　(0,128]: 2　>128: 0 | ≤0: 21　(0,128]: 4　>128: 0 |
| Σprompt / ΣcacheRead / 未命中 | 758,826 / 739,328 / 19,498 | 977,739 / 958,848 / 18,891 |
| 加权命中率 `ΣcacheRead/Σprompt` | **97.43%** | **98.07%** |
| 未命中拆解（冷启动 + 本轮新增 + Σgap） | 4,124 + 34,147 − 18,773 = 19,498（恒等式一致） | 2,509 + 41,943 − 25,561 = 18,891（恒等式一致） |
| 系统提示词分段形态 | 1 种（会话内逐字节稳定） | 1 种（会话内逐字节稳定） |

- **gap 判据**：`prompt_{N-1} − cacheRead_N ≤ 128` 全对通过（超 128 的相邻对 0 个，最大 124）。跨 run 首调 4 对**全为负**（−643…−369）—— 每 run 新追加的快照没有在 run 边界制造正 gap。
- **加权命中率 97.43% → 98.07%（+0.64pp）**；绝对未命中 19,498 → 18,891（−607），而 Σprompt 反多 21.9 万（多 2 次调用）。跨会话对照有噪声（调用数 / 轮次 / 冷启动基数不同），**不作为硬指标**，只作方向证据。

### B 的收益实测（会话文件逐条 + 仓库同一估算口径 `estimateTokens`）

| 通道 | 条目 | 字符 | estTokens | 含取代声明 | 含 `current_time` |
| --- | --- | --- | --- | --- | --- |
| 基线（改动前旧会话文件，同口径复算） | `hidden-context` ×3 | 各 1,066 | 各 **513** | ✗ | ✓ |
| 本次 | `runtime-context` ×2 | 3,363 / 3,515 | 2,196 / 2,262 | ✓ | ✗ |
| 本次 | `hidden-context` ×2 | 971 / 1,083 | 505 / 543 | ✓ | ✗ |
| 本次 | `run-time` ×4 | 各 150 | 各 **61** | ✓ | ✓ |

- **每「跨分钟 run」追加的快照内容：513 → 61 estTokens/run（−452，−88.1%）** —— B 的收益落地。这是用仓库的字符估算口径（CJK 1 token/字、其余 4 字符/token）在同一份旧/新会话文件上复算的对比，`--replay` 无法给 token，故此处只用估算口径。
- **每条快照正文都含取代声明**（8/8 条 `custom_message` 命中）；环境块正文**不含** `<current_time>`；时间块含 `2026-09-18 16:30（周五，GMT+8）` 形式的 `current_time`。
- **`run-time` 4 条 / 5 run**：两次 run 落在同一分钟，按内容去重只追加一条 —— 逐字节去重成立。
- **`hidden-context` 本次 2 条（不是预期的 1 条）**：第 1 条 971 字符**没有**「项目记忆目录」行，第 2 条 1,083 字符有 —— run 1 里 agent 写了记忆，`memoryReminder` 的指针随真实环境事实出现。同一次变化也让 `runtime-context` 追加了一条（3,363→3,515，内容差异确认为「### 近期日志（按需读取）」段出现），**不是分钟抖动带出来的重发**，符合 Scenario「环境事实变化时只追加环境那一条」。

### 未达预期 / 已知残值（如实登记）

- **每 run 快照新增 token 未达「≈20」**：实测 **61 estTokens/run**（513 → 61）。150 字符的时间块里只有时间戳 26 字符（≈11 est，且跨分钟只动其中 4–5 字符）是真新信息，其余为取代声明（26 字符 ≈ 26 est）+ 容器与 `<current_time>` 标签（≈35 est）。规格里「时间块 ≈40 字符 / ≈20 token」的预估口径偏窄（漏算了声明与容器），**属预估口径问题、非实现缺陷**；要消掉这 43 est 只能回到「时间与环境同条」或「去掉声明」，两条都已被否决，故**不改结论、不另列实现任务**，作为已知残值留档。
- 探针与真实 app 会话的差异（工具面更小、无权限门 / 沙箱、不绑专家）见 `scripts/probe-context-snapshot.ts` 文件头；这些差异改变加权命中率的绝对值（分母里的常量项），**不改变本节的 before/after 结论**（两轮探针的差异项相同）。
