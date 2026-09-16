# Trae 多 Agent 协作逆向笔记

> 来源：`D:\Program Files (x86)\Trae CN\resources\app\out\vs\workbench\workbench.desktop.main.js`
> （17.8MB minified bundle，关键词探针法）。调研日期：2026-09-16。
> 目的：对照 Trae 的实际实现，审视 KamiBuddy 子代理链路（add-subagent-task-tool）的差距。

## 1. 核心机制：`runSubagent` 内置工具

Trae 的子代理能力是 **workbench 内置的一个工具**（`Iis="runSubagent"`），挂在 VSCode
chat 基建上，不是独立扩展。工具描述原文（要点）：

> Launch a new agent to handle complex, multi-step tasks autonomously... Agents do
> not run async or in the background, you will wait for the agent's result. When the
> agent is done, it will return a single message back to you. The result returned by
> the agent is not visible to the user.

入参 schema：`{ prompt, description }`，当 `chat.customAgentInSubagent.enabled`
打开时追加可选 `agentName`。**没有 parallel / chain 参数**——并行与编排完全靠模型
自己多次调用工具。

### 1.1 子代理 = 同会话嵌套调用，不是独立会话

```js
const m = {
  sessionResource: e.context.sessionResource,   // 与父会话同一个 session
  requestId: e.callId ?? `subagent-${Date.now()}`,
  agentId: l.id,
  message: r.prompt,                            // 只带 prompt，不带父对话历史
  location: Fi.Chat,
  isSubagent: true,                             // 标记子代理调用
  userSelectedModelId: c,                       // 可与主会话不同的模型！
  userSelectedTools: d,                         // 可与主会话不同的工具面
  modeInstructions: u,                          // 可与主会话不同的指令
};
const v = await this.chatAgentService.invokeAgent(l.id, m, f, [], n);
```

关键点：

- **只带 prompt 不带历史**——上下文隔离与我们的设计一致；
- 但它跑在**同一个 chat session** 里（`isSubagent: true` 区分），不落独立会话；
- 模型、工具面、指令三样都可以按 agent 定义**逐项覆盖**（见 1.3）。

### 1.2 过程回流：`fromSubagent` 标记

子代理的事件通过回调 `f` **实时转发进父会话的消息流**，每个 part 打
`fromSubagent: true` 标记：

- 工具调用卡、textEdit、notebookEdit 直接进主消息流（UI 知道这是子代理干的）；
- 子代理的代码块自动补 ``` fence（在父消息流里正常渲染）；
- 只有 markdownContent 文本被收集进返回值（`g.join("")`）回传给调用方模型——
  **过程给用户看，结论给模型用**，两条通道分开；
- UI 侧 `shouldPinPart` 对 `fromSubAgent` / `toolId==="runSubagent"` 的 part 不走
  常规 pin 逻辑（收起分组，避免刷屏）。

### 1.3 自定义 agent = chat mode 文件（agent、mode、子代理配置三位一体）

`agentName` 的解析走 `chatModeService.findModeByName`——**Trae 的"自定义 agent"
就是 chat mode 文件**（VSCode 标准格式：`.chatmode.md` / `.agent.md`，目录
`.github/chatmodes/`、`.github/agents/`；另有 `.prompt.md` / `.instructions.md`）。
来源分三级（`IPromptsService`）：`local / user / extension`。

命中 mode 后覆盖子代理三件套：

| 覆盖项 | mode 字段 | 效果 |
|---|---|---|
| 模型 | `model` | scout 类调研子代理可用便宜/快的模型 |
| 工具面 | `customTools` | 按定义重建 enablement map |
| 指令 | `modeInstructions` | agent 人格/职责 |

另外支持嵌套 AGENTS.md（`chat.useNestedAgentMd`），instructions 按 glob 匹配
文件路径生效。

### 1.4 防线

- **深度锁**：子代理的 enablement map 里 `runSubagent` 与 `MJi`（另一委派类工具）
  显式置 `false`——与我们"深度锁 1 层"同款；
- 没看到 spawn 预算 / 单独超时 / 输出去毒（VSCode 基建里未发现对应物）；
  我们在这三样上比它严。

## 2. 第二形态：Agent Sessions（异步委派）

这是与我们的同步阻塞委派**完全不同**的形态，也是 Trae 多 agent 体验的最大差异化：

- **Chat session contribution 机制**：扩展可贡献一种"会话类型"
  （`type/name/displayName/description/canDelegate` schema），内置两类：
  **Background**（后台代理）与 **Cloud**（云端代理）；
- `canDelegate: true` 的会话类型会注册成 agent（`@名字` 可引用）+ 命令 + 菜单；
- 本地对话里可以把任务**委派给一个异步跑的独立会话**（后台/云端继续跑，
  本地不等它）；
- `chat.exitAfterDelegation`（默认 true，preview）：委派的对象会话完成后，
  本地父面板**清空并归档父会话**——"委派出去就交出去了"；
- `chat.viewSessions` / agent sessions view：所有 agent 会话统一列表管理。

### 2.1 handoff（第三形态）

`chat.handoffClicked` 遥测对应的机制：用户在面板里**切换当前 agent**（`@名字`），
当前 prompt 自动携带到新 agent 继续发送——对话延续、执行者换人。这是用户主动的
接力，不是子代理。

## 3. 对照审视 KamiBuddy

| 维度 | Trae | KamiBuddy 现状 | 评估 |
|---|---|---|---|
| 子代理调用 | 单工具 `{prompt, description, agentName?}` | task 工具单发/并行/链式三模式 | 并行/链式原语是我们更强（Trae 靠模型多轮调用）；但三模式也让工具描述更长 |
| 隔离方式 | 同会话嵌套 invoke（isSubagent 标记） | 进程内独立会话（可落盘溯源） | 我们更干净、可回放；Trae 省资源但 UI 依赖 fromSubagent 过滤 |
| 模型分层 | mode.model 逐 agent 覆盖 | v1 全继承主会话模型（spec 预留了 model? 没实现） | **最大差距**。Trae 的 agent 文件天然带 model 字段 |
| 过程可见性 | 子代理工具事件实时回流主消息流（fromSubagent） | 活动卡只显示一行最新动作 | Trae 透明度更高；我们可折中：活动卡展开显示工具时间线 |
| 回传内容 | 收集全部 markdown 文本拼接 | 只取最后一条 assistant 文本 | 各有取舍；Trae 连中间叙述也回传 |
| 防线 | 仅深度锁 | 深度锁+预算 20+10 分钟超时+24k 截断+去毒+abort 传播 | 我们工程防线更全 |
| 异步委派 | Agent Sessions（Background/Cloud，canDelegate，exitAfterDelegation） | 无（automation 是另一条无人值守线） | 产品形态级差距，远期方向 |
| agent 定义 | chat mode 文件（local/user/extension 三级） | resources/agents + ~/.kamibuddy/agents 两级 | 机制同构，我们少 extension 级（可不做） |
| 编排统一性 | agent=mode=子代理配置三位一体，一套基建覆盖同步/异步/云三形态 | agents / experts / modes / automation 四条平行线 | 结构性反思：数据模型该收拢 |

## 4. 值得做的（按性价比排序）

1. **agent frontmatter 落地 `model` 字段**（spec 本来就预留 `model?`）：
   子代理独立选模型。scout/reviewer/planner 默认给快模型，worker 跟主会话。
   改动集中在 agents.ts（读字段）+ subagent-runner（getModelKey 优先 agent 定义）。
2. **活动卡加工具时间线**：SubagentStatus 增加 timeline 数组（tool_started/ended
   摘要），活动卡展开可看子代理做过什么——缓解"回传只有最后文本"的纠错盲区，
   不用上 Trae 那套全事件回流。
3. **回传收尾文本 + 关键中间结论**：参考 Trae 收集全部文本的方式，可把子代理
   最后 1-2 条 assistant 文本都回传，主代理有更多依据判断是否重试。
4. **远期：异步委派形态**（对齐 Agent Sessions）：任务委派后不阻塞主对话，
   完成后通知——可评估与 automation-runner 收拢成一套执行器。
5. **反思数据模型**：agents（子代理）、experts（专家）、modes（交互模式）三套
   frontmatter 文件结构高度相似。Trae 证明了"一份 agent 文件 = 人格+模型+工具面+
   指令"可以同时服务主对话切换与子代理委派两个场景。专家体系设计时（spec 里
   plan 只读子代理也挂着）优先考虑收拢。
