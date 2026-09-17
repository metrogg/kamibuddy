# 稳定提示词前缀（修缓存命中）Spec

## Why

Provider 的前缀缓存比的是「最长公共前缀」。我们每轮把**整个系统提示词**重写一遍（`before_agent_start` 返回 `systemPrompt` = pi 的 forced/leading 替换），而系统提示词里塞着**逐轮会变的事实**（分钟级时间、模型自己会写的记忆内容、可被用户改的个性化）。任何一处字节变化都会让**它之后的一切**——含整段对话历史——在缓存里全部失配。

实测（`~/.kamibuddy/logs/runs/`，6 个会话）：每个新会话**首次调用只命中 1,408–2,816 tokens**，而提示词有 12K–22K；断点恰好落在 `resources/scenes/work/prompt.md` 的 `当前工作目录：{{cwd}}` 这一行（台账里对应 `skeleton=47/49/52` 这段，是全文第一处结构性可变内容）。单个 16 步单轮会话里 92.4% 已经是该情形的上限（未命中 44,950 ≈ 全轮新增内容总量，即零重复未命中），**问题不在算法，在结构**。

dsh 的纪律正相反（`docs/subsystems/system-prompt.md`、`.agents/notes/implemented/feature/2026-09-02-in-history-system-prompt-replacement.md`）：

> **Every system prompt change costs the whole provider prefix cache.** … the request's message 0 changes and the DeepSeek context cache misses from the first token. … **moving a changing fact out of the prompt was the only way to keep the prefix stable.**
> A deployment whose prompt changes on most steps is better served by **moving that fact into runtime context**.

pi 0.85.1 本身给了两条路（`docs/extensions.md:566`、`test/system-prompt-updates.test.ts`）：

- **分段 diff + patch**（改 `event.systemPromptOptions` 的 sections / promptGuidelines）：pi 只把**变了的那一段**追加成 patch，接受对话中 system 消息的模型**保持缓存前缀**；
- **forced 整体替换**（返回 `systemPrompt`）：pi 落一条 `replace: true` 的 system 消息并**作为 leading prompt 送**——「a cache miss when it changes」。

**我们现在走的是后者。** 这是本次要修的东西。

## What Changes

- `src/extensions/prompt-switch.ts` 不再返回 `systemPrompt`（forced 替换），改为通过 `event.systemPromptOptions` 声明式供给内容，让 pi 走分段 diff + patch。
- 逐轮会变的事实**移出系统提示词**，改走 `before_agent_start` 的 `message` 注入（append-only，落在历史之后）：运行时间块、记忆内容段、个性化段。
- 删除 `resources/scenes/*/prompt.md` 里手写的 `当前工作目录：{{cwd}}` 行 —— pi 有内置 `cwd` section（`buildSystemPromptSections` 的 `["preamble","tools","rules","docs","cwd"]`），我们这行是重复且位置最毒的。
- `prompt-composer` 的分段口径随之调整（`pi-context` 段的手工重拼可以退役：那件事存在只是因为选了 forced 替换）。
- 新增真实 API 探针 `scripts/probe-prompt-cache.ts`：两轮对话，打印每轮每步的 `cacheRead` / prompt 总量，作为本改动的验收与将来回归的证据。
- 新增单测钉住「不再返回 `systemPrompt`」，防止后人改回去。
- 同步 `docs/可观测性清单.md` 的 CACHE 条与 `src/daemon/prompt-preview.ts` 的预览口径。

**BREAKING**：系统提示词的最终字节会变（分段结构、cwd 行移除、时间块改位置），会话历史里已落盘的 system 消息不再是同一种形态。无数据迁移需求（提示词不入会话文件语义）。

## Impact

- 受影响能力：提示词组装（`core/prompt-composer.ts`）、pi 接线（`extensions/prompt-switch.ts`）、会话宿主（`core/session-host.ts` 的组装与分段上报）、设置页提示词预览（`daemon/prompt-preview.ts`）、台账分段（`request_snapshot.systemSegments`）。
- 受影响代码：
  - `src/extensions/prompt-switch.ts`（核心）
  - `src/core/prompt-composer.ts`、`src/core/resources.ts`（骨架槽位）
  - `resources/scenes/work/prompt.md`、`resources/scenes/code/prompt.md`
  - `src/daemon/index.ts`（`composeSystemPrompt` 与其调用点）
  - `src/daemon/prompt-preview.ts`
  - 新增 `scripts/probe-prompt-cache.ts`
- 参考实现：`开源项目/deepseek-harness`（`packages/core/system-prompt`、`packages/core/agent-loop/src/runtime-context.ts`、`.agents/notes/implemented/feature/2026-09-02-in-history-system-prompt-replacement.md`）

## ADDED Requirements

### Requirement: 变更事实不得进入缓存前缀
系统提示词（模型请求里的 leading system 消息）在**同一会话的连续轮次之间**必须字节稳定；任何逐轮可能变化的事实（运行时间、记忆内容、个性化设置、工作区文件内容）SHALL 通过 append-only 的消息注入送达模型，而不是写进系统提示词。

#### Scenario: 同会话第二轮不再整体失配
- **WHEN** 用户在同一会话里连问两轮，两轮之间跨过分钟边界
- **THEN** 第二轮的首次模型调用读到的缓存 token 数不低于第一轮提示词总量的一定比例（具体阈值见 tasks 的探针），不得出现「只命中系统提示词头部」的整体失配

#### Scenario: 变化的事实仍对模型可见
- **WHEN** 时间块/记忆段/个性化段改为消息注入
- **THEN** 模型在本轮仍能读到当下时间、三层记忆内容与用户个性化设置（内容不缺失、不静默丢弃）

### Requirement: 接线路线以「字节稳定」为准，且被测试反向钉住
（**本条已按探针实测改写**：原文要求「handler 不返回 `systemPrompt`、改走声明式分段 patch」——该机制在发布版依赖上不存在，见「探针结论①」。）
`before_agent_start` handler SHALL 继续返回 `systemPrompt`（forced 整体替换是当前唯一可行的接线：发布版 pi 0.85.1 的 `BuildSystemPromptOptions` 无 `sections`/`forceSystemPrompt`，`emitBeforeAgentStart` 只认返回的字符串）。缓存不变量由「系统提示词在同一会话内逐轮字节稳定」承担，不由投递机制承担。

#### Scenario: 接线方式被测试反向钉住
- **WHEN** 运行 `npm test`
- **THEN** 存在断言 `prompt-switch` 的 handler **必须**返回 `systemPrompt` 的用例（被关掉会漏出 pi 默认 coding 提示词，该用例会红），且注释写明路线判据

#### Scenario: 将来升级 pi 时的复核入口
- **WHEN** 依赖升级到带 `sections` / 分段 diff 的 pi 版本
- **THEN** 依据探针结论③（手写 delta 实测模型把中段 system 当增量）重新评估是否改用声明式分段，并把结论回写本文件

### Requirement: 工作目录只有一个来源
（**本条已按实测改写**：原文假定「由 pi 内置 `cwd` section 提供」——在 forced 整体替换下 pi 自产的那行会一起被覆盖掉，见「探针结论①」与 `tasks.md` Task 3 的实测结论。）
场景骨架 SHALL NOT 再手写 `当前工作目录：` 行；**用户会话**的工作目录 SHALL 只由 hidden context 的 `workspace_context` 提供（注入在 user 轮 = 历史之后，因此它不在缓存前缀里）。子代理/成员会话的提示词由 `composeSubagentPrompt` 在代码里自带工作目录，属明示例外（会话内定值，不破坏字节稳定）。

#### Scenario: 系统提示词里不再有 cwd
- **WHEN** 用户会话组装系统提示词
- **THEN** 输出不含 `当前工作目录：` 也不含会话 cwd 字符串；骨架里若出现 `{{cwd}}` 槽位则组装响亮抛错

#### Scenario: cwd 仍能送达模型
- **WHEN** 任何会话（用户 / 子代理 / 定时任务 run）发出请求
- **THEN** 模型能读到工作目录（用户会话经 hidden context 的 `workspace_context`，子代理经其提示词自带行）

### Requirement: 缓存效果可复跑验证
仓库 SHALL 提供一个真实 API 探针脚本，按既有 `scripts/probe-*.ts` 约定运行，输出足以判定「提示词前缀是否被破坏」的读数（每轮每步的 prompt 总量与 cacheRead）。

#### Scenario: 探针给出可对照读数
- **WHEN** 执行探针
- **THEN** 输出形如 `轮 N 步 M: prompt=<n> cacheRead=<n> hit=<p>%`，且第二轮首步的 hit 明显高于改动前（改动前实测约 16%）

## MODIFIED Requirements

### Requirement: 系统提示词组装（原 `systematize-prompt-architecture`）
组装器 SHALL 保留「能力是数据、分段可溯源」的既有约定（骨架 + 片段 + 模式 + 风格 + 技能），并显式区分**会话内不变**与**逐轮可变**两类内容：前者进系统提示词分段，后者走 append-only 消息注入（落在历史之后）。产出形态仍是**一份供 forced 替换的字符串**（发布版 pi 无声明式分段路径，见「探针结论①」）。

分包规则随之调整：`time` / `memory`（内容段）/ `personalization` 移出提示词，改走 `context` 事件注入；`pi-context` 的手工重拼**保留** —— forced 替换让 pi 不再自动附加 tools/rules/docs，必须由我们自己拼全，这是该路线的必然代价，不是遗留缺陷。

## REMOVED Requirements

### Requirement: `{{cwd}}` 槽位
**Reason**：与 hidden context 的 `workspace_context` 重复（pi 自产的那行 cwd 在 forced 替换下会一起被覆盖，不构成第二个来源），且原先位于提示词约 **25% 字符深度**处、**在对话历史之前** —— 换工作区即在此断前缀，其实测后果是 6 个会话首调只命中 1,408–2,816 tokens，其后约 3/4 的提示词与整段历史一并作废。

**Migration**：骨架删掉该槽位与 `当前工作目录：` 行；`composePrompt` 的 `cwd` 槽位支持、`ComposePromptInput.cwd` 入参与零引用的 `formatRuntimeTime` 一并清理；设置页预览与台账分段不再产出该段。工作目录改由 hidden context 的 `workspace_context` 唯一提供。

## 未决风险（已由探针回答，结论见下方「探针结论」段）

pi 0.85.1 的 sections patch 依赖「模型把对话中段的 system 消息当作**增量补丁**」这一解释。而 dsh 对 DeepSeek 记录的是另一种模型事实（`.agents/notes/implemented/feature/2026-09-02-in-history-system-prompt-replacement.md:11`）：

> it accepts a `system` message at any position of the conversation and **treats the latest one as the complete effective system prompt, replacing the leading one**

且 dsh 明确否决过补丁方案（同文档 `Send only the changed sections as a delta` —— 「a delta would silently drop every unchanged section. **Rejected on the model contract.**」）。

两条事实若同时成立，pi 的 patch 路径在 DeepSeek 上会**丢掉未变化的段**。因此：

- 若探针显示 patch 路径语义正确（模型仍遵守原系统提示词，且缓存保住）→ 走 Task 2 的 sections 路线；
- 若显示语义错误 → **放弃 patch 路线**，改为「保持 forced 替换但保证字节逐轮稳定」：只做「变迁事实移出提示词 + 删重复 cwd 行」，使系统提示词在同一会话内逐轮字节不变，从而 pi 判定「文本未变」而不产生任何替换（`diffSystemPromptSections(previous, previous) === undefined`）。

### 探针结论（实测，2026-09-17）

探针：`scripts/probe-prompt-cache.ts`（复跑 `npm run probe:prompt-cache`，或 `npx tsx scripts/probe-prompt-cache.ts [--model=provider/model]`）。
环境：`deepseek/deepseek-flash`（api = `openai-completions`，端点 `api.deepseek.com`），真实凭据（`~/.kamibuddy`）、临时 cwd、内存会话。
读数口径：`src/shared/observability.ts` 的 `billedInputTokens` / `cacheHitRate`（未另写公式）。

**① 先决事实：我们依赖的 pi 里根本没有 sections patch 路径。**

发布版 `node_modules/@earendil-works/pi-coding-agent@0.85.1`：

- `dist/core/system-prompt.d.ts` 的 `BuildSystemPromptOptions` **没有** `sections` / `forceSystemPrompt` / `toolGuidelines`，也没有 `buildSystemPromptSections` / `diffSystemPromptSections`；
- 运行时抓到的 `before_agent_start.systemPromptOptions` 键恒为 `cwd, skills, contextFiles, customPrompt, appendSystemPrompt, selectedTools, toolSnippets, promptGuidelines`（A 组首轮实测）；
- `dist/core/extensions/runner.js` 的 `emitBeforeAgentStart` 只认 handler 返回的 `systemPrompt` 字符串（chained override），`agent-session.js` 把它整串写进 `agent.state.systemPrompt` —— **没有消息级 patch，也没有重放数组**：A 组三轮请求里 system 消息条数恒为 `1/1/1`（只有 leading），transcript 里连 system 消息都没有。

`开源项目/pi` 那份源码才带 sections / `replace: true` / 分段 diff，它 `git describe` = `v0.85.1-85-ge4c75a732`（比 v0.85.1 标签新 85 个提交，最新一条正是 2026-09-16 的 *fix(coding-agent): replace the system prompt when a handler forces it*）。**spec 与 tasks 上文引用的「pi 0.85.1 的两条路」来自这份未发布的源码，不是我们实际依赖的运行时。**

**② 两组读数（首步；括号内是同日首次跑的取值，用于看账号缓存带来的浮动）**

| 组 / 轮 | 变更 | prompt | cacheRead | hit |
| --- | --- | --- | --- | --- |
| A 轮 1 | 无（新会话首调） | 4727 | 2944 | 62.3%（首次跑 35.2%） |
| A 轮 2 | 变更块 +1 行（变动点在提示词 84.8% 字符深度处） | 4749 | 2944 | 62.0%（首次跑 56.6%） |
| A 轮 3 | 无变化（提示词字节完全一致） | 4808 | 4480 | **93.2%**（首次跑 93.9%） |
| B 轮 1 | 完整提示词（控制轮） | 4810 | 3072 | 63.9% |
| B 轮 2 | 手写 delta（对话中段 1 条 44 字符的 system） | 5100 | 4480 | 87.8% |

**③ 路线判据**

1. **patch 路线在当前依赖上不存在** —— Task 4 的「写 `event.systemPromptOptions.sections`」无处落脚（运行时字段都没有）。判定：**Task 4 走「字节稳定」路线**（即不做声明式分段改造）；想走真 patch 必须先升级 pi 到带 sections 的版本。
2. **字节稳定路线成立**：A 轮 3 提示词一字未变，请求里没有新增任何 system 消息，首步 hit 92–94%（未命中的只是本轮新增的几条消息）。所以「逐轮会变的事实移出提示词」（Task 2）+「删重复的 cwd 行」（Task 3）在当前接线方式下**直接**换来缓存命中，不需要换投递机制。
3. **模型契约（手写 delta 实测，用于判断将来升级 pi 是否安全）**：把变化的那一段作为**对话中段的 system 消息**发出、leading 提示词保持原样时，`deepseek-flash` **仍然遵守 leading 里的稳定段**（稳定段要求「每条回复以【KB】开头且正文用中文」，两轮都用诱导向法语的提问；B 轮 1 与轮 2 的回复分别是 `【KB】Bonjour。` / `【KB】Merci。`；稳定段里明写「不要复述本条约定」，排除了从对话历史里继承规矩的可能）。即 **dsh 记录的「latest system = 完整系统提示词」这条契约在这条 OpenAI 兼容端点上没有复现** —— 模型把中段 system 当增量。dsh 的结论可能只适用于它自己的接入形态，不能直接搬到「pi + DeepSeek OpenAI 兼容接口」上。（保留意见：本探针的 delta 是手写的一条普通 system 消息，与 pi 未来真实 patch 的渲染形态可能不同。）
4. **口径提醒（别拿绝对数字跨次比较）**：命中率绝对值由「变更点之前的内容占整个请求的比例」与**账号级缓存**状态共同决定。台账里 6 个会话首调只命中 1408–2816 / 12K–22K，是同一机制在更早断点处的取值（cwd 行，约 25% 字符深度，其后还有约 20K 字符的 pi-context 全部作废）；本探针的提示词更短（7.5K 字符）、变更点在 84.8% 深度，所以读数明显偏高（A 轮 2 = 56.6–62.0%，不是台账那种 16%）。两次跑的 A 轮 1 分别是 35.2% / 62.3%，差异同样来自账号缓存是否还热。**可比的是同一条轮次序列里「变更轮 vs 无变化轮」的差（本探针 62% → 93%）**。

## 否决方案

> 按 `AGENTS.md §8` 补记（决策记录必须留下被否掉的路；记录写完即冻结，只改状态、不改结论）。

**① 声明式 sections patch（handler 只返回变化的分段，让 pi 做消息级补丁）—— 否，且是实测否决。**
这是原计划的路线（原 Task 2/Task 4）。两条否决理由：发布版依赖 `pi-coding-agent@0.85.1`
里**没有** sections / `forceSystemPrompt` / 分段 diff 这条路径（探针结论①，运行时字段都不存在）；
模型侧契约也对不上——手写 delta 实测 `deepseek-flash` 把中段 system 当**增量**而非整体替换
（探针结论③），dsh 记录的「latest system = 完整系统提示词」在本端点未复现。
代价承认：将来若升级 pi 到带 sections 的版本，这条路要重新评估，本记录不预设它一定更差。

**② 先升级 pi 到带 sections 的版本，再走 ①—— 否（推迟，非技术否决）。**
`开源项目/pi` 那份源码（`v0.85.1-85-ge4c75a732`）确有该能力，但它不是我们依赖的运行时；
升级 pi 是独立决策（0.85.x 破坏性变更几乎必然发生），不该由本 spec 顺手做掉。

**③ 维持现状：逐轮会变的事实留在系统提示词里—— 否。**
理由即本 spec 的动机：变更点之后的前缀全部作废（台账里 6 个会话首调只命中
12K–22K 中的 1408–2816，约 12–16%）。
