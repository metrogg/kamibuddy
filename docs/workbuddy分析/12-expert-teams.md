# 12 · WorkBuddy 专家团（Agent Teams）机制深挖

> 调研日期：2026-09-16。证据源三个版本，均已注明：
> - **CLI 官方文档**（5.5.6，`app.asar.unpacked` 直读）：
>   `cli/dist/web-ui/docs/cn/cli/agent-teams.md`（CLI 自带的中文文档，全文可读——
>   **这是最高价值的证据，比逆向 minified 可靠**）
> - **CLI 实现**（5.5.6 unpacked）：`cli/dist/codebuddy.js`（21.9MB minified）
> - **Desktop 包**（5.4.7 extracted）：`docs/WorkBuddy-reference/extracted/main/{server.js,tar.js,cli-prewarm-pool.js}`、
>   `renderer/assets/lib-chat-ui-*.js`
>
> 之前 `docs/workbuddy分析/` 里没有专家团专题笔记；03-plugins-skills.md 只有一行
> skill 推荐提及。本笔记是第一份。

## 0. 一句话总览

WorkBuddy 的"专家团"是**两条独立的线**：

1. **本地 Agent Teams**（agent-cli 的实验特性）：专家包 `expertType: "team"` 的专家
   被召唤后，该会话通过 env 开关打开 **Agent / TeamCreate / TeamDelete / SendMessage**
   四件套团队工具，主会话当 team-lead，成员是独立 CodeBuddy Code 实例（进程内），
   共享任务列表 + 信箱通信；
2. **云端 orchestrator**（CloudAssistant）：网关下发的 `teamsEnabled` 权限 +
   "当前用户唯一助理团队"初始化，成员状态含 `waiting_team_members`——云端编排的
   助理团队，与本地 Agent Teams 是两套机制。

## 1. 专家 → 专家团的定义：`expertType` 四值

`workbuddy-server/src/expert/runtime/expert-summon-service.ts`（server.js）：

```js
var EXPERT_TYPE_VALUES = [ "skill", "agent", "plugin", "team" ];
function toExpertType(value) {
  return EXPERT_TYPE_VALUES.includes(value) ? value : "agent";
}
```

- 专家包 manifest 声明 `expertType`，缺省 `"agent"`；`"team"` 即专家团。
- 召唤链（`ExpertSummonService.summon`）：resolve expert → `ensurePackageReady`
  下载/物化包 → `switchExpertPluginForSession(sessionId, …, agentName, …)` 激活
  → **把 `manifest.expertType` 记到会话上**（`onBeforePrompt` →
  `resolveExpertLocation`，见 §2）。
- 也就是说：**专家团不是一个新运行时，而是"一个普通专家 + 会话级工具面放大"**——
  包里还是 manifest + agent 定义，团队协作能力来自 env 开关打开的团队工具。

## 2. 会话级开关链（这是"专家团为什么只在专家团会话里有团队工具"的答案）

`workbuddy-server/src/agent/agent-teams-env.ts`（cli-prewarm-pool.js，**原文注释**）：

```js
var ENABLED = "1"; var DISABLED = "0"; var TEAM_EXPERT_TYPE = "team";
/**
 * 计算 CODEBUDDY_CODE_EXPERIMENTAL_AGENT_TEAMS 的值。
 * 设计要点：
 * - 专家团覆盖优先于全局开关；这是 PRD 的硬要求
 *   （"用户选专家团进行会话时，要开启这些工具"）。
 * - 未提供 disableAgentTeams 时按 true 处理（默认禁用）。
 */
function resolveAgentTeamsEnv(input = {}) {
  if (input.expertType === TEAM_EXPERT_TYPE) return ENABLED;
  return input.disableAgentTeams ?? true ? DISABLED : ENABLED;
}
var AGENT_TEAMS_ENV_KEY = "CODEBUDDY_CODE_EXPERIMENTAL_AGENT_TEAMS";
```

数据流（`agent-teams-env-resolver.ts`，server.js 原文注释摘要）：

1. Renderer 切专家 → `onBeforePrompt` → `resolveExpertLocation` 拿到
   `manifest.expertType` → `recordSessionExpertType(sessionId, expertType)` 缓存；
2. 会话 backend `initialize`/restart 时 `resolveForSession` 算 env，**env 变化
   触发 sidecar 重启**（`reconfigure: agent-teams env drift → restart_required`）；
3. 会话销毁 `clearSession`。

CLI 侧消费（codebuddy.js）：`isEnabled() { return "0" !== process.env.CODEBUDDY_CODE_EXPERIMENTAL_AGENT_TEAMS }`。

## 3. 团队工具面（agent-cli）

- 工具四件套：**Agent**（spawn 成员，fire-and-forget）、**TeamCreate**
  （args 含 `team_name`/`teamName`/`name`）、**TeamDelete**、**SendMessage**
  （`@成员名` 寻址，`normalizeMemberRecipient` 剥 `@`）。
- **委派模式**（Delegate Mode）把领导限制为只能用协调工具：
  `Agent / TaskStop / SendMessage / AskUserQuestion / StructuredOutput`——
  不许自己读文件/写代码，所有实际工作经成员完成。
- Claw 工作区整体禁用（`claw/constants.ts`，server.js 原文）：
  ```js
  var CLAW_DISABLED_TOOLS = [
    "Agent", "TeamCreate", "TeamDelete", "SendMessage", "ImageGen", "AskUserQuestion"
  ];
  ```
  （注释：team collaboration tools do not fit the Claw workspace。）
- 子代理边界识别（conversation 记录层）：`isChildBoundaryRecord` = function_call
  名为 **SendMessage / Agent / TeamCreate** 之一。

## 4. 运行时机制（agent-teams.md 官方文档 + codebuddy.js 交叉验证）

### 4.1 架构

| 组件 | 作用 |
|---|---|
| Team Lead | 创建团队、生成成员、协调的主会话（角色固定，不可转让） |
| Teammates | 独立 CodeBuddy Code 实例（**进程内 in-process**），各自独立上下文 |
| Task List | 共享任务列表：pending/in_progress/completed + 依赖关系（上游完成自动解锁下游） |
| Mailbox | 成员间通信：`message` / `broadcast` / `shutdown_request` / `shutdown_response` / `plan_approval_response` |

- 成员加载与普通会话相同的项目上下文（CODEBUDDY.md、MCP、技能），**不继承领导对话**；
- 已完成成员收到新消息**自动重启**（对应投影层的 reactivation，见 §5）；
- `@all` 广播（成员数 >1 时出现在补全列表最前）；`@main` 路由回领导；
- 成员可提交计划等领导审批（plan_approval_response），拒绝则留在计划模式改了重交。

### 4.2 存储布局（本机验证过目录存在性，用户未装团队故无实例）

```
~/.codebuddy/teams/{team-name}/config.json     团队配置
~/.codebuddy/teams/{team-name}/inboxes/{member}.json   成员信箱
~/.codebuddy/tasks/{team-name}/                共享任务列表
```

codebuddy.js 的 `team_manager`：`sessionCreatedTeams` Set、`createTeam` 前检查
`Already in a team`（**单会话单团队**）、`isAutoTeam()`/`isInTeam()`。
Hook 事件带 `teammate_name`/`team_name`（TASK_CREATED / TASK_COMPLETED / TEAMMATE_IDLE）。

### 4.3 权限（五级优先级）

1. Agent 工具 `mode` 参数（单成员指定，如 `bypassPermissions`）
2. CLI `--subagent-permission-mode`
3. env `CODEBUDDY_SUBAGENT_PERMISSION_MODE`
4. Settings `permissions.subagentPermissionMode`
5. 继承领导权限模式（**委派模式例外**：成员用 `default` 全工具，委派限制只约束领导）

成员的权限请求**汇集到领导/主界面**，UI 出拦截卡（§6）。

### 4.4 模型

成员与子代理同一套模型解析：显式指定 → `CODEBUDDY_CODE_SUBAGENT_MODEL` 统一覆盖
→ 项目/用户级按 subagent 设置 → 内置声明 → 继承领导主模型。支持"每个成员用 lite 模型"。

### 4.5 已知限制（文档自认，实验特性）

无会话恢复（/resume 不恢复成员）、任务状态可能滞后、关闭较慢、**单会话单团队**、
**不支持嵌套团队**、领导角色固定、权限在生成时确定。

## 5. Desktop 侧投影：`ChildAgentProjection`（最值得抄的一层）

`workbuddy-core/src/conversations/common/core/model/child-agents/child-agent-projection.ts`
（server.js @855623 起，约 3 万字符）。要点（均有原文依据）：

- **双 kind 统一投影**：`subagent`（Task 工具子 turn）与 `team` 成员共用一套
  runtime（assembler/store/state），`getSubAgents()` / `getAgentTeams()` 分开出。
- **fire-and-forget 语义**（原文注释）："spawn ack 不等于 member 完成"；CLI 在主
  agent 说完话就发 end_turn，但成员还在后台跑。因此：
  - `hasActiveChildAgents()` = 任一 subagent running **或** 任一 team
    `running` / `teamTrulyIdle === false`；
  - 专门给 `onTurnFinished` 用：**主 turn 结束时若还有子在跑，DB 不能立刻标
    completed**，先记 pending，等收敛再落（`settleAllRunning`）。
  - `team_busy` / `team_idle` 通知：CLI 主动上报团队真忙/真闲，父按
    `teamIdleByName` 翻转所有同团队成员的 `teamTrulyIdle`。
- **成员事件路由**（`ensureRoutedTeamMember`）：优先 `sessionId` → `taskId` →
  同团队最新 spawn（`maxBySpawnOrder`）→ 都没有才建 provisional runtime——
  注释明说防"跨团队同名成员产生第三个幽灵成员"。
- **身份键**：`teamIdentity = parentRequestId\0teamName\0memberId\0taskId`、
  spawn/reactivated 各有专用键；`teamName/taskId` 回填后 `rekeyTeamMember`
  重挂索引但 `projectionId` 不变（保消费方缓存）。
- **占位清理**：spawn toolCall 拿不到 sessionId 时 `retireFailedTeamSpawn` 移除
  纯占位 runtime——否则跨进程缓存会把它当新成员，出现空白"执行失败"幽灵卡。
- **重新激活**：后续 Request 经 SendMessage 唤醒既有成员
  （`teamReactivationByToolCall`），为该轮保留独立投影。

## 6. 渲染层（lib-chat-ui bundle）

- **`team-member-intercept-card.tsx`**：成员权限拦截卡，三选
  `allow_once` / `allow_session` / `deny`（i18n `teamMember.intercept*`），
  挂在输入区上方与 sandbox 拦截卡互斥同位。
- **团队创建状态解析**：UI 从 TeamCreate 工具结果的**文本**里正则提取
  `Team "…" created.` / `Lead:` / `Description:` 行 + 结构化字段
  （`value.teamName ?? value.team_name`）拼团队状态。
- 文档描述的交互层：`@` 补全（模糊搜索、颜色标识、✓ 状态）、
  实时状态栏（`● 运行中 / ✓ 完成 / ✗ 失败 / — 取消`，实时 token 与工具调用数）、
  成员焦点导航（空输入框按 ↓，Ctrl+O 回领导）、Ctrl+T 任务列表。

## 7. 云侧 orchestrator（另一条线，勿混）

`cloud-assistant` 包（server.js）：`getEntitlement` 返回
`orchestratorEnabled / teamsEnabled / exclusiveEnabled / installed`；
`initializeOrchestrator` 注释"初始化当前用户唯一助理团队（orchestrator）"。
会话状态机里有 `waiting_team_members` 原始态。这是网关侧编排的助理团队，
与本地 agent-cli 的 Agent Teams 是**两套独立机制**。

## 8. 对 KamiBuddy 的启发（按性价比）

1. **expertType 联动工具面**：WorkBuddy 用"专家包声明类型 → 会话级 env → 工具四件套
   开关"把专业能力做成数据。我们的 experts.ts 可以同构：专家声明
   `toolsExtra`/`expertType`，会话装配时增删工具面——加能力不用改代码。
2. **truly-idle 收敛语义**：我们 task 工具是同步等结果，没有这个问题；但
   automation/未来后台委派会需要"父的终态等子的真闲"——`team_busy/team_idle`
   + `hasActiveChildAgents` 的 pending-落库设计是现成答案。
3. **成员权限拦截卡**：我们子代理审批走"用户在场变体"弹同一审批框；
   WorkBuddy 给 team 成员单独的 intercept 卡（allow_once/allow_session/deny），
   如果以后做团队，权限卡要按成员分组而不是混进主对话。
4. **防幽灵成员三件套**：provisional runtime + rekey + retireFailedTeamSpawn——
   身份不确定时先建占位、身份齐了重挂键、拿不到会话的占位坚决删。我们做
   多会话投影（比如子会话列表）时直接可抄。
5. **提醒**：WorkBuddy 自己也把 Agent Teams 标为实验特性、默认关闭、单会话单团队、
   不支持嵌套。我们 spec 里"明确不做 Teams/SendMessage"与它的现状判断一致，
   不算落后；先把 §8.1 的联动模式抄了最划算。
