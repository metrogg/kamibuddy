# dsh 对照记录（机制 / 纪律 / 文档）

> 素材：`开源项目/deepseek-harness/`（下称 dsh，MIT）的 `README.md`、`docs/architecture.md`、
> `packages/README.md`、`docs/subsystems/`、`docs/cookbook/adding-a-package.md`、`.agents/notes/README.md`。
> 采集日期 2026-09-17。**本文件只落结论，不抄原文**；每条都带 dsh 侧来源路径与我们的对应物路径。
> 服务对象：`.trae/specs/adopt-dsh-disciplines/`（采纳清单见 §3）。未确认项见 §5——**先读那节**。

## 0. dsh 的规模：实测值（顺手订正了三处口头数字）

| 项 | 实测 | 怎么数的 | 与既有说法的差 |
|---|---|---|---|
| `packages/` 下的 `package.json` | **291** | 递归计数（`-Filter package.json`） | spec 的「≥200 个包」是**下界**，成立；291 也不等于发布包数 |
| `packages/` 一级分组 | **52** | 一级目录计数（对应 `packages/README.md` 的分组表） | — |
| `docs/subsystems/` 子系统页 | **57** 页（英文，不含 README；含中文共 116 个 md） | 文件名计数 | 口头说的「65 页」偏高，**以 57 为准** |
| `scripts/verify-*.ts` 门禁脚本 | **37** 个非 `.spec.ts`（`verify-*` 文件共 59 个） | 文件名计数 | 口头说的「约 45 个」偏高，**以 37 为准** |
| `packages/sandbox/sandbox-windows-acl` 的测试 | **13** 个 `*.spec.ts` 文件 | 文件名计数 | 口头说的「单包 17 个 spec」偏高，**以 13 为准**（也可能是用例数，未核，见 §5.2） |

## 1. 差距类型三分法（本文件只用这三个词）

- **机制**：dsh 有、我们**没有**对应物，且办公场景真有收益。
- **纪律**：我们有这个功能，但**没把纪律机械 enforce**（可以悄悄退化而不报警）。
- **文档**：功能对等，只是我们这边没写清或写错了。

## 2. 子系统 × 我们的对应物 × 差距

### 2.1 采纳（本 spec 处理）

| dsh 子系统（来源） | 我们的对应物 | 差距 | 结论 |
|---|---|---|---|
| `spill/`（`packages/spill/`、`docs/subsystems/spill.md`）：超限工具结果落盘 + `SpillLocator` | 无；截断散在 `src/extensions/powershell-tool.ts`（24k）、`src/core/web-fetch.ts`、`src/extensions/doc-read-tool.ts`、`src/core/doc-extract.ts` | **机制** | 抄落盘 + 取回指引；不抄 branded locator（本地单机，见 spec 否决方案③）。Task 2.1 |
| `compaction/`（`packages/compaction/`、`docs/subsystems/compaction.md`）：`compaction/start→summary→end` 锁，`shadowedRange`/`shadowedSeqs`/`shadowedTokenCount`，锁最后释放 → 崩溃留孤儿锁 | `src/core/session-host.ts` 的 `session.compact()`；记账在 `src/core/run-ledger.ts`、`src/core/event-log.ts` | **机制** | 抄锁语义 + 遮蔽范围记账（含崩溃可检测）。Task 2.2 |
| `approval/`（`packages/interaction/user-approval`、`docs/subsystems/approval.md`）：`ApprovalOutcome` 闭集 + fail-closed + `asked`/`decided` 审计对 | `src/extensions/permission-gate.ts`、`permission-policy.ts`、`src/shared/permissions.ts` | **纪律** | 收敛成常量闭集；「应答者缺失/抛错/不合规 ⇒ unavailable ⇒ 调用方必须拒」。Task 2.3 |
| `sandbox/sandbox-windows-acl`（`packages/sandbox/`、`docs/subsystems/sandbox.md`）：单包 13 个 spec 文件的测试维度（acl / acl-failure-paths / grant / grant-failure-paths / token-failure-paths / index-failure-paths / path-boundary / ffi / probe / runner / control / provider-chain / workspace-sid） | `src/sandbox/**`（4 个测试文件）+ `src/daemon/sandbox-runner.ts` | **纪律** | 只加测试、照抄测试**维度**（不是抄实现）。Task 2.4 |
| `Model Experience` 契约（`packages/README.md` §Package README contracts、`docs/cookbook/adding-a-package.md` §4、`scripts/verify-package-readme-model-experience.ts`）：可能改变模型所见的模块必须答 What the model sees / Token effect / KV Cache effect，豁免也要写理由 | 落点：21 个工具模块 + `src/core/system-prompt-composer.ts` + `src/shared/hidden-context.ts` + `src/extensions/prompt-switch.ts`；纪律在 `AGENTS.md §3` | **纪律** | 抄判据与三段式；不抄它的 README-only 落点（我们用文件头注释也可）。Task 1.1 |
| `invariants`（`packages/runtime-diagnostics/invariants`、`docs/subsystems/invariants.md`、`packages/AGENTS.md` 末条）：每包 `./invariant` 伴随插件，空伴随必须写「No runtime invariant: …」并说明 | 无 | **纪律** | 抄判据（有没有可独立分叉观测的关系？没有就写理由），**不抄形态**（`./invariant` 伴随插件绑死插件树）。Task 1.3 |
| Agent Notes（`.agents/notes/README.md`、`scripts/verify-agent-note-format.ts`、`scripts/verify-archived-agent-notes.ts`）：`## Alternatives considered` 强制段 + 归档后**永久冻结** | `docs/` 里的「决策 N」小节、`ARCHITECTURE.md` 决策段、`.trae/specs/*/spec.md` | **纪律** | 加 `## 否决方案` 强制段 + 「写完即冻结、只改状态不改结论」。Task 1.2 |
| 证据纪律（根 `AGENTS.md` §Run relevant checks locally、`packages/AGENTS.md`：「Product-visible plugins require a non-unit REAL-composition test」） | `AGENTS.md §8`（原本只有一句「声称完成前跑 check」） | **纪律** | 三条：真入口路径测试、断言未触碰文件逐字节不变、改坏→看红→回滚。Task 1.4 |

### 2.2 对等（我们已有，无需动）

| dsh 子系统（来源） | 我们的对应物 | 差距 |
|---|---|---|
| `skills.md` / `skill/`（发现优先级、会话前缀目录、模型侧 `skill` 加载） | `resources/skills/`（pi 原生 Agent Skills）、`src/core/skill-install.ts`、`skill-status.ts`、`src/extensions/use-skill-tool.ts` | 无 |
| `filesystem.md` / `fs/`（seam + 本地 provider + 模型侧文件工具） | pi 内置 read/write/edit/find/grep/ls + `src/core/path-containment.ts`（归属判定） | 无（归属判定我们更强，见 `docs/sandbox.md` 决策 12） |
| `settings.md`（defaults → composition base → user 分层） | `config.get(key)` 单一入口（`AGENTS.md §5`） | 无 |
| `todo.md` | `src/extensions/todo-tool.ts`、`src/core/todo-parse.ts`、`src/renderer/todo-projection.ts` | 无 |
| `mcp.md` | `src/extensions/mcp-client.ts`、`src/core/mcp-config.ts`、`docs/mcp-connector.md` | 无 |
| `shell.md`（shell seam；read-only 语义「命令能跑，文件动不了」） | `src/extensions/powershell-tool.ts`、`command-guard.ts`、`src/daemon/sandbox-runner.ts` | 无（四期已对齐 read-only 语义） |
| `agent-team.md` + `subagent.md` | `src/daemon/team-runtime.ts`、`mailbox.ts`、`member-runner.ts`、`subagent-runner.ts`、`src/extensions/{team,task}-tools.ts` | 文档（我们的语义散在 spec 里，dsh 有逐子系统页） |
| `context/`（workspace instructions / time / references） | `src/shared/hidden-context.ts`、`src/core/system-prompt-composer.ts` | 文档（归入 §2.1 的 Model Experience 契约） |
| `attachment.md` | `src/shared/image.ts`、`src/extensions/present-files.ts` | 无 |
| `plan.md` | `resources/modes/plan.md`（能力是数据） | 无 |
| `web.md` | `src/core/web-search.ts`、`web-fetch.ts`、`src/extensions/web-tools.ts` | 无 |
| `credentials.md`（引用而非值、按操作解析） | `src/extensions/permission-policy.ts` 的 `defaultProtectedDirs` 凭据禁读禁写 + `~/.kamibuddy` 配置目录 | 纪律（我们没有「凭据引用」类型，只有路径级保护；本批不做） |
| `session-telemetry.md`（边界公理 + redact waterfall） | `src/shared/observability.ts`、`src/core/event-log.ts`（本地台账） | 只抄边界公理；不做上报（内部阶段无端点） |
| `interaction/`（命令注册表 + 用户提问 seam） | `src/extensions/questionnaire-tool.ts`、`src/shared/builtin-commands.ts` | 无 |
| `session-query.md`（逻辑语料 + 有界读 + FTS） | `src/daemon/conversation-search.ts`、`src/core/session-archive.ts` | 机制（FTS 索引留下一批） |
| `testing.md`（spec 并发执行、owner 化的端口/路径/子进程、真组合测试政策） | `npm test`（node:test）+ `scripts/smoke-*.ts` / `probe-*.ts` | 纪律（只在任务 1.4 抄了证据纪律的一部分） |

### 2.3 明确不抄（抄不了 / 不该抄）

| dsh 子系统（来源） | 不抄的理由 | 对应 spec 条目 |
|---|---|---|
| Cordis / 插件树 / profile-bundle（`docs/architecture.md` §Cordis/§Profiles、`vendor/cordis/`） | 我们是 pi harness + Electron 双进程；`AGENTS.md §9` 已定不做插件加载器 | 明确不做行 1 |
| `client/` 42 包 + slots + sidebar（`docs/subsystems/{client-*,slots,sidebar-right}.md`） | 服务「一后端多壳」，我们单窗口 Electron，收益低成本极高 | 明确不做行 2 |
| session-format 多代迁移链（`docs/subsystems/persistence.md`、`session-format-status.md`） | 会话 JSONL 由 pi 写，我们**没有迁移权**（`src/core/session-file.ts`） | 明确不做行 3 |
| `subagent-acp` / `subagent-codex` / `subagent-claude-code` | 依赖外部 CLI 真实安装，与「零安装成本」冲突 | 明确不做行 4 |
| `workflow/` / `ptc-runtime/` / `tool-ralph` | 模型写任意脚本在沙箱执行；我们的 shell 沙箱化还在早期，先开口子会作废权限门保护 | 明确不做行 5 |
| `browser-use/` / `computer-use/` | 外部驱动原生依赖；我们已有 Playwright/Puppeteer MCP 通道 | 明确不做行 6 |
| `ssh*` / `ssh/fs-ssh` | 办公场景暂不需要，会把「执行世界」复杂度提前引入 | 明确不做行 7 |
| `session-telemetry-otel` | 内部阶段无上报端点 | 明确不做行 8 |
| in-history system prompt replacement（`.agents/notes/implemented/feature/2026-09-02-in-history-system-prompt-replacement.md`） | 依赖的模型契约在本端点**实测未复现**（`docs/提示词前缀缓存契约.md`、`stabilize-prompt-prefix` 探针结论③） | 明确不做行 9 |
| 双语配对 / doc-budgets / 200 包级 doc-sync 门禁（`scripts/verify-translation-pairing.ts`、`verify-doc-budgets.ts`） | 为 200+ 包 × 双语规模设计，我们 30 个模块全抄是纯维护负担 | 明确不做行 10 |
| with-key 测试政策（「不要省着用真 API」） | 其前提是 dsh 自己是模型提供方；我们的成本是用户自己的 key | 明确不做行 11 |
| `goal/` / `jobs/` 持久化域、`schedule/`、`session-projection`、`guard/`（loop hygiene）、`hooks/`、`extensions/`（模型自改插件）、`storage/`、`feedback/`、`identity/`、`lsp/`、`terminal/`、`webhook/`、`acp/`、`sdk/`、`api/` + `host/`（Web 载体） | 与我们的形态无对应或本批无收益（`goal`/`jobs`/`session-projection`/`session-query` FTS 留下一批） | tasks.md「本批不做」 |

## 3. 本 spec 的采纳清单（Task ↔ dsh 出处）

| Task | dsh 出处 | 类型 |
|---|---|---|
| 1.1 模型体验契约门禁 | `packages/README.md` §Package README contracts、`docs/cookbook/adding-a-package.md` §4、`scripts/verify-package-readme-model-experience.ts` | 纪律 |
| 1.2 决策记录加「否决方案」 | `.agents/notes/README.md` §Alternatives considered — mandatory、§Archiving and deletion | 纪律 |
| 1.3 模块不变量登记 | `docs/subsystems/invariants.md` §The companion contract、`packages/AGENTS.md` 末条 | 纪律 |
| 1.4 证据纪律 | 根 `AGENTS.md` §Run relevant checks locally、`packages/AGENTS.md`（REAL-composition test） | 纪律 |
| 2.1 `spill` | `docs/subsystems/spill.md`、`packages/spill/` | 机制 |
| 2.2 压缩可审计 | `docs/subsystems/compaction.md` §The `compaction/*` session events | 机制 |
| 2.3 审批 fail-closed | `docs/subsystems/approval.md` §Identity and outcome / §Per-session policy | 纪律 |
| 2.4 沙箱测试矩阵 | `packages/sandbox/sandbox-windows-acl/`（实测 13 个 `*.spec.ts` 的维度，见 §0 与 §5.2） | 纪律 |
| 0.1 powershell 文档订正 | （与 dsh 无关，是本地文档与代码不符的事实订正） | 文档 |

## 4. 从 dsh 学到、但**本批不做**的

- **`guard/`（loop hygiene）**：重复调用提醒 + `tools/execute` deadline。我们有权限门与超时（`powershell-tool.ts` 的 120s），但**没有「模型在原地打转」的观测**。未评估，本批不做。
- **`token-meter.md` 的不可变标量/位置化重放测量**：比我们 `src/shared/context-usage.ts` 的估算更严格，与 `stabilize-prompt-prefix` 的台账口径相关，留待合并评估。
- **`session-title.md` / `session-reference.md`**：结构化跨会话引用（我们有 `conversation_search` 工具，形态更弱）。
- **`packages/AGENTS.md` 里可机械校验的若干条**（`src/types.ts` 只放类型、测试放 `tests/`、导出 JSDoc 必须齐、传播状态只在提交点）：`verify-export-jsdoc` 这类门禁我们一条都没有，但优先级低于本 spec 的两条。

## 5. 未确认项（引用本文件结论前必须知道）

1. **包总数是下界**：291 个 `package.json` 是**文件计数**，含 `packages/experimental/`、`test-support/`、
   `util/` 等非产品包，也不排除有示例包自带 `package.json`。**发布包精确数未核**。
2. **`docs/subsystems/` 只读了索引与少数几页**：本次实际读到内容的是
   `README.md`、`spill.md`、`compaction.md`、`approval.md`、`invariants.md`；
   其余约 52 页**未逐页读**，§2 各行的结论来自索引表的「Owns」列 + 该页路径，
   **可能漏掉页面内部的机制细节**（尤其是 `sandbox.md`、`session.md`、`tools.md` 三个大页）。
   同一性质的问题：`sandbox-windows-acl` 实测 **13 个 spec 文件**（不是 17），
   差数可能是**用例数而非文件数**——除非 Task 2.4 真去数它的 `it`，否则别引用「17」。
3. **pi 是否有第二套 `SessionManager` 实现未证实**：`AGENTS.md §9` 写「`SessionManager` 已给两种实现」，
   本次**没有去 `开源项目/pi/` 核对**。tasks.md「本批不做」里提到的核实项仍未完成，
   在核实前不要把这句话当事实引用。
4. **dsh 的 Model Experience 判据只读到契约骨架**：`adding-a-package.md` §4 给了三段式与
   `Verbatim text` 块的形状；`verify-package-readme-model-experience.ts` 的**实际判定与豁免
   allowlist 未逐行读**，所以 Task 1.1 的落点是「照判据自研」，不是逐字复刻。
5. **各包内是否有自有门禁未统计**：37 个 `verify-*.ts` 只统计了顶层 `scripts/`；
   `packages/**/scripts/` 或包内 `tests/` 里可能另有门禁，未统计。
6. **`docs/testing.md` 的测试政策只读到摘要**：根 `AGENTS.md` 引用它的两处
   （真组合测试、spec 并发执行的所有权）已读，细则未读——Task 1.4 的三条是摘要级采纳。
7. **dsh 结论的时效**：其 README 明写 developer preview、「THERE WILL BE COMPATIBILITY-BREAKING CHANGES」。
   本文件记的是 2026-09-17 快照；引用前先对照 `docs/subsystems/` 现状。
