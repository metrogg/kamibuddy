# 采纳 dsh 的机制与纪律 Spec

## Why

对 `开源项目/deepseek-harness`（下称 dsh）做了一次全貌调研：它 **≥200 个包**、`docs/subsystems/` 65 页子系统参考、约 45 个 `verify-*.ts` 门禁 + 三套治理体系（Agent Notes / Skills / 门禁脚本），且每个子系统都是「测试密度 + 生成式目录 + 至少一条决策记录」三件齐备。

调研结论分三类，本 spec 只处理**值得且能落地**的那一类：

| 类别 | 代表 | 处置 |
|---|---|---|
| **机制缺口**（我们没有），且办公场景真收益 | `spill`（超限输出落盘 + 模型可见 locator）、compaction 的锁与 shadowed 范围 | 本 spec 采纳 |
| **纪律缺口**（我们有功能但没把纪律机械 enforce） | Model Experience 契约、包不变量伴随、approval 的 fail-closed 闭集、证据纪律 | 本 spec 采纳 |
| **抄不了 / 不该抄** | Cordis 插件树、42 个 client 包 + slots、session-format 多代迁移链、`subagent-acp/codex`、`workflow/ptc-runtime`（模型写脚本执行）、`browser-use/computer-use`、ssh 系列、otel、以及 **in-history system prompt 机制**（我们已实测其模型契约在本端点未复现，见 `docs/提示词前缀缓存契约.md`） | 明确排除，理由见下 |

另有一条**必须顺手修正的事实**：`AGENTS.md §2` 写「powershell 尚未实现，工具面里也还没有 powershell」，但代码里 `src/extensions/powershell-tool.ts`、`src/extensions/command-guard.ts` 都在，`src/core/agents.test.ts:174` 断言工具面含 `"powershell"`，`src/daemon/automation-runner.ts:243-249` 在无人值守变体里注册它。文档与代码不符会让后续所有安全判断建立在错前提上。

## What Changes

- **新增 `spill`**：工具结果超过 `maxInlineBytes` 时落盘，模型只看到「省略 N 字节 + 完整结果在 <路径> + 用 read 分段读或 grep 搜」（现在一律 24k 截断**丢信息**）。
- **补 compaction 记账**：压缩的锁语义、被遮蔽范围（`shadowedRange`/`shadowedSeqs`/`shadowedTokenCount`）、崩溃遗留孤儿锁的可检测性——现在只 `await session.compact()` + 台账一条 `compaction`。
- **新增 `§Model Experience` 文档契约**：可能改变「模型所见」的模块（21 个工具 + 系统提示词组装 + 注入通道）必须在 README/文件头回答 `What the model sees` / `Token effect` / `KV Cache effect` 三段，并由脚本机械校验（豁免必须写理由）。
- **新增「否决方案」记录位**：决策记录必须含 `## Alternatives considered`，并在归档后冻结。
- **新增模块不变量登记**：每个模块回答「有没有可独立分叉观测的关系」，没有就写理由（缩小版，不照搬 Cordis 的 `./invariant` 伴随插件形态）。
- **approval 收敛成 fail-closed 闭集**：`ApprovalOutcome` 常量集合 + 「应答者缺失/抛错/不合规 ⇒ unavailable ⇒ 调用方必须拒」的显式语义 + `asked/decided` 审计对。
- **补 sandbox 的失败路径测试矩阵**：照抄 dsh `sandbox-windows-acl` 单包 17 个 spec 的**测试维度**（我们只有 4 个测试文件）。
- **证据纪律写进 `AGENTS.md`**：真入口路径测试、断言「未被触碰的文件逐字节不变」、改坏 → 看它变红 → 再回滚。
- **修正 `AGENTS.md §2` 关于 powershell 的过时表述**（是事实订正，不是功能变更）。
- 明确 **不引入** 的清单见下 `REMOVED Requirements` 之外的「明确不做」。

## Impact

- Affected specs: 新 spec；影响 `stabilize-prompt-prefix`（Model Experience 契约与其 CACHE8/CACHE6 台账同源）、`add-windows-acl-sandbox`（补测试维度）、`harden-permission-boundary`（approval 闭集）、`add-observability-ledger`（spill 的落盘副本口径）
- Affected code:
  - 工具结果写回层：`src/extensions/**`（21 个工具）与按 `AGENTS.md §4` 应抽出的 toolkit
  - 压缩：`src/core/session-host.ts`（`await this.session.compact(...)` 一带）、`src/core/run-ledger.ts`
  - 提示词/注入：`src/core/system-prompt-composer.ts`、`src/shared/hidden-context.ts`、`src/extensions/prompt-switch.ts`
  - 权限：`src/extensions/permission-gate.ts`、`permission-policy.ts`、`src/core/permission-rules-store.ts`
  - 门禁脚本：`scripts/`（新增 model-experience 与 invariants 两个检查，挂进 `npm run check`）
  - 沙箱测试：`src/sandbox/**`（只加测试）
  - 文档/流程：`AGENTS.md`、spec 模板、`docs/`

## ADDED Requirements

### Requirement: 超限工具结果落盘并以可读句柄回给模型
系统 SHALL 在工具结果超过阈值时保留完整内容于磁盘，并返回「省略了多少 + 完整结果位置 + 取回方式」的提示，而 SHALL NOT 静默截断丢内容。

#### Scenario: 超长工具输出
- **WHEN** 某工具单次输出超过 `maxInlineBytes`
- **THEN** 模型收到省略提示与落盘路径（含 `read offset/limit` 与 `grep` 的用法），完整内容可在该路径取回

#### Scenario: 阈值内输出
- **WHEN** 输出未超阈值
- **THEN** 行为与现在完全一致（原样内联，无多余提示、无落盘）

### Requirement: 零安装可用的「模型体验契约」门禁
系统 SHALL 提供机械校验：凡「可能改变模型所见」的模块，必须回答模型所见内容、token 影响、以及前缀缓存影响；豁免 SHALL 必须写明理由。

#### Scenario: 新增一个工具模块
- **WHEN** 在 `src/extensions/` 新增工具且未写模型体验段
- **THEN** `npm run check` 失败并指名该文件

#### Scenario: 模型无关的纯工具模块
- **WHEN** 该模块确实与模型所见无关
- **THEN** 可以豁免，但必须在该文件里写明一句话理由，否则仍失败

### Requirement: 决策记录必须留下被否决的方案
系统 SHALL 在决策记录模板中要求 `## Alternatives considered` 段，且 SHALL 提供「已归档不可改」的处置方式。

#### Scenario: 记录一个选择
- **WHEN** 落地一个非平凡改动
- **THEN** 决策记录含被否决方案与否决理由，避免同一决定被反复推翻

### Requirement: 压缩过程可审计且崩溃可检测
系统 SHALL 记录压缩的遮蔽范围与锁状态，使「哪段历史被压缩遮蔽了」与「上次压缩异常中断」都能被检测。

#### Scenario: 正常压缩
- **WHEN** 触发一次压缩
- **THEN** 台账/事件里能查到被遮蔽的范围与 token 量

#### Scenario: 压缩中途进程被杀
- **WHEN** 压缩未完成即退出
- **THEN** 下次启动能识别出遗留状态，而不是把它当成正常历史

### Requirement: 审批结果 fail-closed
系统 SHALL 把审批结果收敛为闭集，且**任何异常或缺失都必须归为「不可用」，调用方必须拒绝**。

#### Scenario: 审批应答者异常
- **WHEN** 审批通道抛错或返回不符合契约的应答
- **THEN** 判定为不可用并**拒绝执行**，SHALL NOT 放行

## MODIFIED Requirements

### Requirement: 授权边界（powershell 的文档表述）
`AGENTS.md §2` 关于「powershell 尚未实现」的表述 SHALL 与代码事实一致（工具已实现且有危险命令检查器），并把「前置条件已满足/未满足」写清 —— 这是文档订正，不改变任何运行时行为。

## REMOVED Requirements

无。本 spec 不删除既有能力。

## 明确不做（含理由）

| 项 | 理由 |
|---|---|
| Cordis / 插件树 / profile-bundle | 我们是 pi harness + Electron 双进程；`AGENTS.md §9` 已定不做插件加载器 |
| 42 个 client 包 + slots 体系 | 服务「一后端多壳」形态，我们是单窗口 Electron，收益低成本极高 |
| session-format 多代迁移链 | 会话 JSONL 由 pi 写，我们**没有迁移权**（见 `src/core/session-file.ts`） |
| `subagent-acp` / `subagent-codex` / `subagent-claude-code` | 依赖外部 CLI 真实安装，与「零安装成本」冲突 |
| `workflow` / `ptc-runtime` / `tool-ralph` | 模型写任意脚本在沙箱执行，风险面最大；我们的 powershell 沙箱化还在早期，先开这个口子会作废权限门保护 |
| `browser-use` / `computer-use` | 外部驱动原生依赖；我们已有 Playwright/Puppeteer MCP 通道 |
| `ssh*` 系列 | 办公场景暂不需要，会把「执行世界」复杂度提前引入 |
| `session-telemetry-otel` | 内部阶段无上报端点（只抄其边界公理与 redact 思路） |
| **in-history system prompt replacement** | 依赖的模型契约我们已实测**在本端点未复现**；我们已用「提示词字节稳定 + 尾部注入通道」等价替代 |
| 全量双语配对门禁 / doc-budgets / 200 包级 doc-sync | 为 200+ 包 × 双语 × 生成式目录的规模设计，我们 30 个模块全抄会变维护负担 |
| 「不要省着用真 API」的 with-key 政策 | 其前提是 dsh 自己是模型提供方；我们的成本是**用户自己的 key** |

## 否决方案

> 按本 spec 的 Task 1.2 立的新规矩补记：决策记录必须留下被否掉的路（照 dsh 的
> `## Alternatives considered`）；写完即冻结，只改状态、不改结论。
> 上面「明确不做」表是**整体排除项**，本节记的是**认真考虑过又否掉的路线**及其代价。

**① 照搬 Cordis 插件树 / profile-bundle / 42 个 client 包 + slots —— 否。**
理由：我们是 pi harness + Electron 双进程、单窗口形态；`AGENTS.md §9` 已定不做插件加载器。
代价承认：将来若真要「一后端多壳」，这份架构红利得另付一次学费，本节记录就是为了那时
知道当初为什么没拿。

**② 直接搬 in-history system prompt replacement（对话中段注入完整系统提示词）—— 否。**
理由：它依赖的模型契约（最新 system 覆盖 leading）在 `deepseek-flash` 的 OpenAI 兼容端点
**实测未复现**（`docs/提示词前缀缓存契约.md`；`stabilize-prompt-prefix` 的探针结论③）。
我们改用「提示词字节稳定 + 尾部 append-only 注入」等价替代。
代价承认：这是等价替代而非同构方案，若换端点/换模型需重跑探针。

**③ 连 `spill` 的 branded locator（不可伪造的句柄）一起抄 —— 否，只抄一半。**
理由：branded locator 的价值在跨进程/远端取回；我们是本地单机，路径直接渲染即可。
保留的一半是**超限结果落盘 + 模型可见的取回指引**（真正解痛的那半）。

**④ 采纳 Cordis 的 `./invariant` 伴随插件形态 —— 否。**
理由：那个形态绑死「每个包都有插件入口 + 可动态挂卸」，我们没有插件树。
只抄它的判据：「有没有可独立分叉观测的关系？没有就写理由」（Task 1.3 的缩小版）。

**⑤ 全量照抄 dsh 的文档门禁（双语配对 / doc-budgets / 包级 doc-sync）—— 否。**
理由：为 200+ 包 × 双语的规模设计，我们 30 个模块全抄是纯维护负担。
只抄与「模型所见」「不变量」直接相关的两条门禁（Task 1.1 / Task 1.3）。

**⑥ 照抄 with-key 测试政策（"不要省着用真 API"）—— 否。**
理由：其前提是 dsh 自己是模型提供方；我们的成本是**用户自己的 key**。
我们保留的部分是它的**证据纪律**（真入口路径、逐字节不变、改坏→看红→回滚，Task 1.4），
而不是它的预算政策。
