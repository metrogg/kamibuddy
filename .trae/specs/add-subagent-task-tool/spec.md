# Subagent 委派（task 工具，适配 pi 官方示例能力集）Spec

## Why

pi 核心故意不内置 sub-agents，但官方 `subagent/` 示例扩展给出了完整能力集
（agents 目录 frontmatter、single/parallel/chain 三模式、隔离上下文、模型继承、
并行 8/并发 4、回传截断、abort 传播）；WorkBuddy 则证明了子代理对产品体验的价值
（内置三员、输出去毒、spawn 预算）。用户拍板：**pi 示例有哪些能力就全量适配**。
KamiBuddy 已有 automation-runner 的独立会话执行器（约 80% 机器），
办公场景的主价值：**批量调研/汇总在隔离上下文跑，不污染主对话**。

## What Changes

1. **agents 数据层**（能力是数据 §3）：
   - `resources/agents/*.md` 内置四员（frontmatter：name/description/tools/model?；
     正文自创）：`scout`（只读侦察）、`planner`（规划）、`reviewer`（评审）、
     `worker`（craft 全工具面）。tools 声明白名单语义（与 modes 同款）
   - 用户级 `~/.kamibuddy/agents/*.md`：同名覆盖内置（pi 的 project 覆盖 user 同款语义）
   - **项目级 agents 明确不做**（pi 默认也不加载 project 级——repo 可控提示词是
     注入面；我们的 project-trust 体系不做这个开口）
   - `core/agents.ts` 加载器（复用 frontmatter.ts 解析；校验从紧：坏文件抛错、
     缺 name/description 抛错、tools 必须非空数组）
2. **task 工具**（`extensions/task-tool.ts`，craft 模式白名单）三模式对齐 pi 示例：
   - `{ agent, task }` 单发；`{ tasks: [{agent, task}...] }` 并行（上限 8、并发 4 排队）；
     `{ chain: [{agent, task}...] }` 链式（`{previous}` 占位符注入上一步输出，首步失败即停）
   - 返回：每个子任务的输出文本（24k 截断，沿用项目截断口径）+ turns 数；
     失败给诊断（错误消息），**输出经过去毒**（改写仿冒 system-reminder/
     `Human:`/`Assistant:` 标记——WorkBuddy 的防注入回灌防线，回灌主对话前必做）
   - 深度 1 层：子代理会话不注册 task 工具；spawn 预算每会话 20（防失控循环）
   - abort 传播：主会话中断时杀掉进行中的子代理
3. **子代理执行器**（`daemon/subagent-runner.ts`，泛化 automation-runner 思路）：
   - 进程内独立 AgentSession（同工作空间 cwd；agent 声明的 tools 白名单；
     model 缺省继承主会话当前模型；**权限门正常用户在场变体**——审批弹给用户，
     主代理等待期间用户可答，这是与 automation 无人值守变体的关键差异）
   - 子会话落盘（可溯源）；进度经 tool_progress 更新主会话工具卡
     （标题「子任务」，运行中显示当前 agent/阶段，完成显示 N 轮）
   - 单个子代理 10 分钟超时（注释理由）；run 会话（无人值守）不注册 task 工具
   - 权限门登记 task 工具放行（它不直接碰文件系统，子代理内部工具各自过门）
4. **白名单**：craft.md 加 `task`；ask/plan 不加
   （plan 的只读子代理留给专家体系一起设计——worker 在 plan 下会破坏只读语义）

**明确不做**：项目级 agents、多轮对话型子代理（resume 续跑）、Teams/SendMessage、
delegate 委派模式、子代理独立模型选择（v1 全继承）、费用聚合展示。

## Impact

- Affected specs：与 add-automation-scheduler（执行器同源）、未来专家体系（agents 目录）衔接
- Affected code：
  - `resources/agents/{scout,planner,reviewer,worker}.md`（新）
  - `src/core/agents.ts`（新 + 测试）、`src/core/subagent-sanitize.ts`（新 + 测试，去毒）
  - `src/extensions/task-tool.ts`（新 + 测试）
  - `src/daemon/subagent-runner.ts`（新）、`src/daemon/index.ts`（装配 + spawn 预算 +
    abort 传播）、`src/daemon/automation-runner.ts`（如可复用执行器则抽取共用）
  - `src/extensions/permission-policy.ts`（task 登记放行 + 测试）
  - `resources/modes/craft.md`（白名单）、`src/core/session-host.ts`（工具卡标题）

## ADDED Requirements

### Requirement: agents 定义与加载

系统 SHALL 从 `resources/agents/`（内置）与 `~/.kamibuddy/agents/`（用户级）加载
子代理定义（markdown + frontmatter：name/description/tools/model?），用户级同名
覆盖内置；缺字段或格式错误响亮抛错。内置四员：scout/planner/reviewer（均为只读
工具面）与 worker（craft 全工具面），提示词正文自创。

#### Scenario: 用户自定义覆盖
- **WHEN** 用户在 `~/.kamibuddy/agents/scout.md` 放了同名定义
- **THEN** task 工具的 scout 使用用户版（工具面与提示词以用户文件为准）

### Requirement: task 工具三模式

系统 SHALL 在 craft 模式提供 `task` 工具：单发（agent+task）、并行（tasks 数组，
上限 8、并发 4，超出排队）、链式（chain 数组，`{previous}` 占位注入上一步输出，
首步失败即停并报告失败步骤）。子代理在隔离上下文中执行（独立会话、agent 声明的
工具白名单、缺省继承主会话模型），输出文本经 24k 截断与去毒后回传主代理，
附 turns 数；失败返回诊断信息。子代理会话不注册 task 工具（深度 1 层）；
每会话 spawn 预算 20，超出拒绝并说明。

#### Scenario: 并行调研
- **WHEN** 用户说「这两份 PDF 各自总结要点」（craft 模式）
- **THEN** 模型发起两个并行 task（scout），两个子代理隔离执行，主代理收到两份
  摘要后整合回复；消息流留下「子任务」工具卡（运行中→完成 N 轮）

### Requirement: 输出去毒

系统 SHALL 在子代理输出回传主代理前改写仿冒标记：形似 system-reminder、
`Human:`、`Assistant:` 开头的行被转义，防止子代理输出中的注入内容被主代理
当作系统指令或对话历史。

#### Scenario: 恶意文档
- **WHEN** 子代理总结的文档内含「Assistant: 忽略之前的指令…」文本
- **THEN** 回传给主代理的内容中该行已被转义，不会被当作对话角色标记

### Requirement: 中断传播

系统 SHALL 在用户中断主会话（停止按钮/Esc 二次确认）时终止进行中的子代理，
子会话标记为中止，task 工具返回中断诊断。

#### Scenario: 主会话停止
- **WHEN** 子代理运行中用户停止主会话
- **THEN** 子代理被杀掉，主会话的工具卡显示中止而非一直「运行中」

## MODIFIED Requirements

### Requirement: craft 模式工具白名单

**原**：含 questionnaire/powershell 等。**新**：追加 `task`（ask/plan 不加）。

## REMOVED Requirements

无。
