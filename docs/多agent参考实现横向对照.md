# 多 Agent 协作：开源参考实现横向对照

> 调研日期：2026-09-16。五个参照物：Trae（逆向见 `docs/trae分析/多agent协作逆向.md`）、
> pi（subagent 示例扩展）、opencode、codex（multi_agent v1/v2）、deepseek-harness（dsh）。
> 对照对象：KamiBuddy 的 task 工具 + subagent-runner（spec: add-subagent-task-tool）。

## 1. 五家实现一句话画像

| 项目 | 形态 | 隔离方式 | 编排原语 |
|---|---|---|---|
| **pi** | 官方示例扩展（非内置） | **独立子进程**（`--mode json -p --no-session`），stdout JSONL 回流 | single / parallel(8) / chain({previous}) |
| **opencode** | 内置 Task 工具 | **独立子 session**（`parentID` 链），`task_id` 可续聊 | 多 tool-use 并行 + 实验 `background:true` |
| **codex** | 内置工具族（v1/v2，feature flag） | **独立 Thread**（AgentRegistry 树） | spawn/wait/send/interrupt/close/resume/followup 全套通信工具 |
| **dsh** | 插件包（Cordis 微内核） | 进程内全新子 Agent；`fork` 继承父对话；另有跨进程 Provider | 前台/`run_in_background`/`continuable`（常驻+续聊）三路 |
| **Trae** | workbench 内置 runSubagent | **同会话嵌套 invoke**（isSubagent 标记，fromSubagent 回流） | 无（靠模型多轮调用）；委派走 Agent Sessions（异步） |
| **KamiBuddy** | task 工具 + SessionHost | 进程内独立会话（落盘溯源） | single / parallel(8)/并发闸4 / chain |

## 2. 五家共识（我们没做或做得不一样的）

### 2.1 逐 agent 独立模型 —— 五家全有，唯独我们没有 ⭐ 最大共识

- pi：frontmatter `model` → 子进程 `--model`
- opencode：`model = agent.model ?? 父消息模型`
- codex：spawn 参数 `model`（最多暴露 5 个可覆盖模型 `MAX_SPAWN_AGENT_MODEL_OVERRIDES=5`）
- dsh：`agentOptions{provider, model, maxTokens}`
- Trae：mode.model → `userSelectedModelId`

我们的 agents frontmatter spec 里预留了 `model?` 但 v1 没实现（全继承主会话）。
**这是本次横评唯一"五家都有、我们独缺"的核心字段，优先落地。**

### 2.2 逐 agent 工具白名单 —— 五家全有，我们已有 ✓（agents.ts tools 字段）

### 2.3 深度锁 —— 五家全有，实现各异

- 我们：装配层不注册 task 工具（深度 1，最简单最硬）
- opencode：沿 parentID 数深度，`subagent_depth ?? 1`
- codex：`next_thread_spawn_depth` 限制
- dsh：`maxDepth` 默认 3，**深度记账持久化在会话头且单调不减**（防恢复后绕过——
  我们没这个问题，因为我们根本没做 resume）
- pi：无显式锁，靠 `--no-session`；README 自认子代理可再装扩展（防不住）

### 2.4 只带 prompt 不带父历史 —— 五家全有 ✓（dsh 的 `fork` 是显式可选的例外）

## 3. 各家独有的好东西

### 3.1 dsh：失败/中断时保留部分输出回传父模型 ⭐ 便宜且高价值

`SubagentResult{output, stopReason}`，异常终止不丢 output。我们的 runOne 超时/
run_error/取消时直接 throw，`lastText` 白collect了——把已有文本折进错误诊断
回传，主代理就知道子代理死前查到哪了。改动极小（subagent-runner catch 分支）。

### 3.2 pi：链式工作流预设提示词（`prompts/implement.md`：scout→planner→worker）

我们对短板"模型不会编排"的正解不是加代码，而是**给预设的委派工作流提示词**——
pi 已经给了样例。这直接回应上次审视的第 6 条（没有编排引导）。

### 3.3 opencode：`task_id` 续聊同一子会话（多轮子代理）

我们 spec 明确不做 resume；opencode 证明了"子代理可续聊"是真实需求形态。
远期候选，不急。另：它的 explore agent 建议在输出超限时"委派 explore 代查"，
提示词层把截断变成委派信号，巧。

### 3.4 codex：子代理是长期协作者而非一次性调用

spawn 之后 `wait_agent`（30s 超时轮询）/`send_message`/`interrupt`/`close`/
`followup_task`/`resume_agent` 全套——与我们"一次性 prompt"形态代差最大，
但整套基建投入也最大（guardian 审查、授权、hooks）。dsh 的 `continuable`
（常驻子会话+结算通知+send_message 续聊）是同一方向的轻量版。**远期方向。**

### 3.5 Trae：过程透明（fromSubagent 事件回流）+ Agent Sessions 异步委派

见 trae分析文档。dsh 的 `run_in_background` + jobs（job_output/job_kill）证明
后台子代理在开源侧也是成熟形态。

### 3.6 安全侧差异

- pi：**project 级 agent 定义需 UI 确认**（防 repo 投毒）——我们干脆不做
  project 级（更严，维持）
- codex：guardian 审查 + user_authorization + subagent-start/stop hooks
- dsh：Provider 能力契约（depthLimit/toolFilter/persona）挂载期 fail-loud 校验
  ——与我们"坏文件抛错"同风格 ✓

## 4. 行动清单（合并上轮 Trae 结论，重排序）

1. **agent frontmatter 落地 `model` 字段**（五家共识，spec 已预留 `model?`）。
   agents.ts 读取 + subagent-runner 的 getModelKey 优先取 agent 定义。
2. **失败/超时保留部分输出**（dsh 启发，改动最小的体验提升）：
   runOne 的 catch/timeout/cancelled 分支把 lastText 折进诊断文本回传。
3. **编排预设提示词**（pi 启发）：resources/prompts 加一份委派工作流片段
   （调研类 scout 并行、实施类 scout→planner→worker 链式），挂进 craft 提示词。
4. 活动卡工具时间线（Trae 透明性的折中实现，上轮已列）。
5. 回传多带中间文本（Trae 收集式回传的启发）。
6. 远期：后台/可续聊子代理（opencode background / dsh continuable / Trae
   Agent Sessions 同一方向），与 automation-runner 收拢评估。
7. 专家体系设计时收拢 agents/experts/modes 数据模型（Trae 的 agent=mode=子代理
   配置三位一体 + dsh 的 agent preset YAML 是两个参照）。

## 5. 来源索引

- pi：`开源项目/pi/packages/coding-agent/examples/extensions/subagent/`
  （index.ts 三模式/并发/截断、agents.ts frontmatter、agents/*.md、
  prompts/implement.md 链式预设、README 安全模型）
- opencode：`packages/opencode/src/agent/agent.ts`、`tool/task.ts`、
  `agent/subagent-permissions.ts`、`core/src/v1/config/agent.ts`（frontmatter schema）、
  `cli/cmd/run/subagent-data.ts`（实时 UI）
- codex：`codex-rs/core/src/tools/handlers/multi_agents_v2/`（spawn/wait/send）、
  `core/src/agent/registry.rs`、`templates/agents/orchestrator.md`、
  `features/src/lib.rs`（flags）、`core/src/context/inter_agent_message.rs`
- dsh：`packages/subagent/tool-subagent/src/index.ts`、
  `packages/subagent/subagent/src/{types.ts,depth.ts}`、
  `packages/subagent/subagent-spawn-in-process/src/index.ts`、
  `apps/cli/config/agent-presets/code/agent.cordis.yml`
- Trae：`docs/trae分析/多agent协作逆向.md`
