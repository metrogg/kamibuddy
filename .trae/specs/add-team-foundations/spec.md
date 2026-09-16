# Team Foundations（团队协作地基第一批）Spec

## Why

决策更新（2026-09-16 用户拍板）：**Teams 要做**，add-subagent-task-tool spec 里
"明确不做 Teams/SendMessage"是过时决策。WorkBuddy Agent Teams 机制已完成逆向
（`docs/workbuddy分析/12-expert-teams.md`），我方现状审计见
`docs/团队协作根基盘点.md`：底座（多桶并发、审批归属、防线、agents model 字段）
可复用，但会话间通信、通用子会话投影、共享任务存储三块为从零项，且存在
"listSessions 不过滤子代理会话"的现行 bug 与 LRU 逐出误杀成员的隐患。

本 spec 覆盖**地基第一批**（盘点施工顺序 ①②）：修现行 bug、打通"专家声明 →
工具面联动"（WorkBuddy expertType 模式的等价落点）、补配置最小落点。
批 3-6（Mailbox 通信原语、通用 child-agents 投影层、共享任务存储、成员生命周期）
在第一批落地后各自细化追加。

## What Changes（第四批：批 5 = 团队 v1 垂直切片）

6. **团队运行时与 team 工具**（批 5 的实际范围比原计划收窄——共享任务列表
   挪到 v1.1，理由见下）：
   - `src/daemon/team-runtime.ts`（纯逻辑）：团队注册表状态机。按领导
     sessionId 挂团队；**单会话单团队**（对齐 WorkBuddy）；成员名唯一、
     1-8 人（对齐并行上限）；成员状态机 spawning → running → idle/failed/closed。
   - `src/daemon/member-runner.ts`：成员会话执行器（仿 subagent-runner 的
     装配，差异三点）：**长会话**（无 10 分钟超时——成员跑完一轮自然收尾，
     后续靠消息唤醒）；**fire-and-forget**（spawn ack ≠ 完成，领导 run 不等
     成员，对齐 WorkBuddy）；**完成回投**——成员一轮结束后把最终输出经
     批 3 的 deliverSessionMessage 投回领导（`[来自会话「成员名」的消息]`），
     失败投诊断。这是 v1 的团队闭环：没有它成员产出无处可去。
   - `src/extensions/team-tools.ts`：四个工具（factory + 注入 deps，脱离宿主
     可单测，同 task-tool 取向）：
     - `team_create {name, members: [{name, agent, task}]}`——建团 + 逐成员
       spawn（agent 必须在 agents 库中，人格与工具面来自该定义）；spawn 消耗
       主会话 spawn 预算；details 走批 4 通道（kind:"team" 投影）。
     - `team_send {to: name|"@all", text}`——@name 定向 / @all 广播；对成员
       host 直接 `prompt(带来源标注的合成文本, "followUp")`（idle 唤醒 /
       running 排队，WorkBuddy「已完成成员收消息自动重启」语义）。
     - `team_status {}`——成员状态汇总（状态/轮数/最近动作），写给模型看。
     - `team_delete {}`——解散：abort + dispose 全部成员，清注册。
   - **深度锁**：成员扩展不注册 team 三件套与 task（成员不许再委派/建团）；
     会话文件写 `team_member` 溯源标记；listSessions 过滤扩展为同时排除它。
   - **接线与生命周期**：团队工具注册 gated by `agentTeamsEnabled` 偏好
     （缺省 false，未开启时工厂不注册，白名单名字静默忽略——docx_convert
     先例）；craft.md 白名单加四名；**领导桶被 LRU 逐出或被删除时解散团队**
     （abort+dispose 成员）——批 6 的「豁免 or 重建」显式决策为 v1 先逐出
     即解散（防幽灵、防白烧钱），WorkBuddy 的无恢复语义同款。
   - craft 模式专属：ask/plan 不加白名单。
   - **明确不做（本批）**：共享任务列表（认领/依赖）挪 v1.1——v1 用
     「spawn 时给明确任务 + 完成回投 + team_send 追加指示」协调，等成员
     生命周期与持久化决策（批 6）落地后任务数据才有可靠的存放层；
     成员实时进度上主会话消息流（批 7 UI，走批 4 通道加事件）；worktree
     per-member（批 6）；信箱落盘（批 6）；AskUserQuestion / plan 审批类
     消息类型（远期）。

## What Changes（第三批：批 4）

5. **通用 child-agents 投影层**（盘点 2.4）：
   - 新增 `src/shared/child-agents.ts`（shared = 类型 + 纯逻辑，零运行时依赖）：
     **details 契约键常量**、**识别守卫**（从 session-host 的 subagentsOf 迁入）、
     **投影累加器**（从 task-tool 迁入：初始化骨架 / 状态迁移 / 动作行时间线
     封顶与省略标记 / 快照拷贝）。
   - `SubagentStatus` 加可选 `kind: "subagent" | "team"`——**缺省 = subagent**
     （task 工具不写、旧格式会话没有，读方按 subagent 解释），零测试扰动；
     批 5 的成员投影写 `"team"`。
   - task-tool 与 session-host 改为消费共享模块：session-host 认 `details` 的
     契约键与形状、不认具体工具（team 工具将来发同形状 details 即走同一通道）。
   - 事件名沿用 `subagent_progress`（改名的重放迁移成本没有消费者收益；
     kind 在投影数据里，需要时读得出来）。渲染层零改动。

## What Changes（第二批：批 3）

4. **会话间消息信箱（Mailbox 通信原语）**：
   - 新增 `src/daemon/mailbox.ts`（纯逻辑模块，不 import pi / core，与
     session-registry 同款可单测取向）：按 sessionId 收件箱，`deliver` 定向投递、
     `broadcast` 多路投递、`drain` 取走全部（读后清空）、`clear` 销毁。
     消息带 id / fromSessionId / 可选 fromLabel / text / createdAt；时钟与 id
     生成可注入（单测确定性）。空 fromSessionId / 空 text 响亮抛错。
   - **内存态 v1，不落盘**：批 3 的原语服务"投递即唤醒"通路（投递后排进目标桶
     互斥链、drain 合成一条消息走 `host.prompt(text, "followUp")`）——箱内消息
     在投递与消费之间只存活于互斥链等待期。跨重启留存随批 6 成员生命周期
     （WorkBuddy 落盘 `teams/*/inboxes/` 的决策一起做）。
   - daemon 接线 `deliverSessionMessage(fromSessionId, toSessionId, text, fromLabel?)`：
     目标桶必须已注册且有宿主（响亮报错）；投递 → enqueue → drain → 合成
     （每条 `[来自会话「label」的消息]` 头 + 正文，多消息 `\n\n---\n\n` 分隔）
     → `host.prompt(composed, "followUp")`（与"缺省排队"的产品决策同口径）。
     会话删除时清空其信箱（sessionDelete 的出注册表点）。
   - **本批无 IPC 通道、无调用方**：原语先行，消费方是批 5 的 send_message
     工具与成员路由。避免为不存在的 UI 加死通道。
   - 明确不做：@name 寻址（成员命名属批 5）、shutdown/plan-approval 等消息类型
     （WorkBuddy 的 mailbox 类型家族，随各自能力引入）、跨进程投递。

**明确不做（批 1-3 仍不做）**：child-agents 通用投影（批 4）、共享任务存储
（批 5）、成员生命周期（批 6）、UI（后续 spec）。

## What Changes（第一批）

1. **侧栏会话列表过滤子代理会话**（修盘点 2.3）：
   - `listSessions` 排除带 `subagent_run` 溯源标记的会话——它们是 task 工具的
     隔离子会话，混进侧栏是 bug；溯源条目目前唯一消费方是 usage-stats。
   - 过滤发生在列表读取层（daemon），侧栏 UI 无感。
2. **专家 extraTools 联动**（盘点 2.1 的最小路径）：
   - `ExpertDefinition` 加可选 `extraTools?: string[]`（frontmatter 解析，缺省
     不抛错）；内置专家不声明，行为不变。
   - daemon 装配会话时把当前专家的 extraTools 与 `mode.tools` 合并，走**现有
     toolsOverride 通道**传入 SessionHost。
   - `setExpert` 切专家时重新应用合并后的工具集（宿主经注入的解析回调拿
     extraTools，宿主按约定不读专家库，照 getExpertLabel 模式）。
   - 语义为**白名单追加**：专家只能增不能删模式给的工具。
3. **配置最小落点**（盘点 2.9，不补 config.get 全账）：
   - preferences 新增 `agentTeamsEnabled`（默认 false，仿 memoryEnabled 范式）
     ——批 3 的团队工具开关用，本批只落键与读取。
   - spawn 预算与子代理超时从编译期常量改为读偏好（带现值缺省），装配点注入，
     行为缺省不变。

**明确不做（本批）**：Mailbox/成员消息、child-agents 通用投影、共享任务存储、
成员生命周期（LRU 豁免/重建决策）、worktree per-member、UI（状态栏/@补全/
焦点导航/任务面板）——分别属批 3-6 与后续 UI spec。

## Impact

- Affected code：
  - `src/daemon/index.ts`（listSessions 过滤；createHost 合并 extraTools；
    装配注入预算/超时）
  - `src/core/experts.ts`（extraTools 解析 + 测试）
  - `src/core/session-host.ts`（setExpert 重新应用工具集；构造参数加解析回调）
  - `src/core/preferences.ts`（agentTeamsEnabled + spawnBudget/subagentTimeoutMs 键）
  - `src/daemon/session-registry.ts`（预算初值改注入）
  - `src/daemon/subagent-runner.ts`（超时改注入）
- 不改：todo 契约、subagent_progress 契约、IPC 通道集。

## ADDED Requirements

### Requirement: 会话列表排除子代理会话

系统 SHALL 在 listSessions 中排除带 subagent_run 溯源标记的会话；usage-stats
的会计口径（排除会话维度、token 照算）不变。

#### Scenario: 子代理会话不进侧栏

- **WHEN** 主会话经 task 工具委派产生子代理会话后刷新会话列表
- **THEN** 该子会话不出现在 listSessions 结果中，主会话正常出现

### Requirement: 专家 extraTools 白名单追加

专家定义 SHALL 支持可选 `extraTools`（frontmatter 字符串数组）；会话装配与
setExpert 切换时，生效工具集 SHALL 为 mode.tools ∪ extraTools；内置四专家
不声明时行为与现状完全一致。

#### Scenario: 专家追加工具

- **WHEN** 用户级专家声明 extraTools: [task] 并被会话绑定
- **THEN** 该会话模型可见工具集在模式白名单之外多出 task

#### Scenario: 缺省行为不变

- **WHEN** 专家未声明 extraTools
- **THEN** 工具集与 mode.tools 完全一致（回归保障）

### Requirement: 防线参数化

spawn 预算与子代理超时 SHALL 从偏好读取（缺省 = 现值 20 / 600000ms）；
装配点注入，既有测试口径不变。

#### Scenario: 缺省不变

- **WHEN** 偏好未配置相关键
- **THEN** 预算与超时行为与改动前逐字节一致

### Requirement: 会话间消息信箱（批 3）

系统 SHALL 提供按 sessionId 的进程内信箱原语：定向投递、多路投递、取走全部
（读后清空）、销毁；消息含 id / 来源会话 / 可选来源显示名 / 正文 / 时间戳；
空来源或空正文响亮抛错。daemon SHALL 提供 deliverSessionMessage 接线：
投递后排入目标桶互斥链，箱内消息合成为一条 followUp prompt 投给目标会话；
目标会话不存在或无宿主响亮报错；会话删除时清空其信箱。

#### Scenario: 投递即排队唤醒

- **WHEN** 会话 A 向已存在且有宿主的会话 B deliverSessionMessage
- **THEN** 消息经 B 桶互斥链合成一条 followUp prompt 进入 B 的对话，
  正文带来源标注；B 正在 run 中时按 followUp 语义排队（不打断）

#### Scenario: 目标不可达响亮失败

- **WHEN** 目标 sessionId 不在注册表，或目标桶从未建过宿主
- **THEN** deliverSessionMessage 抛出可读错误，不静默丢消息

### Requirement: 通用 child-agents 投影契约（批 4）

系统 SHALL 提供共享的子代理/成员投影契约模块：details 契约键、details 识别守卫
（非对象/键缺席/非数组 → undefined，数组项不逐字段校验）、投影累加器
（初始化全 queued 骨架、状态迁移、动作行时间线封顶 12 条真实行并补省略标记、
快照深拷贝）。task 工具与 session-host SHALL 消费该模块而不再各自持有；
`SubagentStatus.kind` 为可选字段，缺省按 "subagent" 解释。

#### Scenario: 多工具共用同一通道

- **WHEN** 任意工具在部分结果的 details 里携带契约键的投影数组
- **THEN** session-host 桥接为 subagent_progress 事件（整体替换语义），
  渲染层照常呈现——工具无需新事件类型

#### Scenario: task 工具行为不变

- **WHEN** task 工具改为消费共享累加器后执行单发/并行/链式
- **THEN** 既有投影测试逐字节通过（timeline 封顶、activity 同步、model 徽标）

### Requirement: 团队注册表（批 5）

系统 SHALL 提供按领导 sessionId 的团队注册表（纯逻辑）：单会话单团队（重复
建团报错）、成员名唯一、1-8 人、成员状态机 spawning/running/idle/failed/closed、
按成员名与会话 id 双向可查、解散即整队清除。

#### Scenario: 重复建团拒绝

- **WHEN** 领导已有团队时再次 team_create
- **THEN** 响亮报错并报告现有团队名（对齐 WorkBuddy「Already in a team」）

### Requirement: 成员会话执行器（批 5）

成员 SHALL 以独立长会话运行（复用子代理装配：用户在场权限门、agent 定义
工具面与人格、同领导 cwd），无执行超时；一轮结束把最终输出（24k 截断 +
去毒）作为信箱消息投回领导会话，失败投诊断；会话文件写 team_member 溯源
标记并被会话列表过滤。

#### Scenario: 完成回投

- **WHEN** 成员完成 spawn 时给定的任务（agent 循环收尾且无错误）
- **THEN** 领导会话收到一条带成员名标注的 followUp 消息，内容为成员最终输出

### Requirement: team 工具四件套（批 5）

craft 模式 SHALL 在 agentTeamsEnabled 开启时提供 team_create / team_send /
team_status / team_delete；关闭时不注册（白名单名静默忽略）。team_create
逐成员消耗 spawn 预算并以 kind:"team" 投影呈现骨架；team_send 支持 @all；
team_delete 解散团队并中止全部成员。成员会话 SHALL NOT 注册 team/task 工具
（深度锁）。

#### Scenario: 建团即跑

- **WHEN** 模型 team_create 两名成员并各带任务
- **THEN** 两个成员会话启动并各自执行（fire-and-forget），工具卡呈现
  kind:"team" 的分组骨架；领导可继续对话，成员完成时结果自动回投

#### Scenario: 未开启开关时不可见

- **WHEN** agentTeamsEnabled 为 false
- **THEN** 四个工具不注册，模型看不到团队能力

## 与 WorkBuddy 的差距清单（2026-09-16 盘点，v1 闭环真机通过后）

**已对齐**：自然语言建团、fire-and-forget 后台执行、@all 广播、idle 成员收消息
自动唤醒、实时成员状态卡（team_member_progress → 活动卡 live 刷新）、单团队/
禁嵌套/深度锁、团队豁免 LRU、工具面按专家/模式声明、权限门全链路。

**差距（按体验影响排序，后续批次从这里取）**：
- P0 成员可见性：成员焦点导航（查看成员完整对话与实时进度）、输入框 @补全、
  每成员实时 token/工具调用计数 —— 用户现在“看不见”成员在工作。
- P1 协调效率：单成员优雅关闭（shutdown_request/_response，现只有全解散）、
  共享任务列表（三态+依赖+自主认领，即 v1.1）、委派模式（领导只协调不干活）、
  成员计划审批（plan_approval）、成员权限请求带成员归属标注（现在是全局闸）。
- P2 健壮性：团队配置与信箱落盘（重启存活，WorkBuddy 落 teams/*/inboxes/）、
  team_create 暴露每成员模型选择、团队人格专家包（expertType:“team” 等价物）。
- P3 低优：成员 hook 事件、常驻状态栏（活动卡已覆盖主场景）、会话恢复
  （WorkBuddy 自认无恢复，双方不做）。

## 批 8：P0 成员可见性三件套（2026-09-16 立项）

### Requirement: 每成员实时计数

成员投影 SHALL 携带累计 toolCalls / tokens（totalTokens 和）/ cost；成员执行器
从事件流计数（tool_started 计工具、assistant_done.usage 计 token 与费用），
经注册表回填后随 team_member_progress 推送；团队卡成员行展示计数行。
task 卡的 subagents 不写这些键（缺省不渲染）。

#### Scenario: 卡上看到成员消耗

- **WHEN** 成员执行若干轮后
- **THEN** 领导会话的团队卡成员行实时显示「N 轮 · M 次工具 · X tok · 」

### Requirement: @成员补全与直接路由

composer 的 @ 补全 SHALL 在团队成员存在时把成员名并入候选（与文件候选同一
过滤排序）；发送以 @成员名 开头的消息 SHALL 直接投递给该成员（剥离 @提及，
经 followUp 通路），不经过领导模型中转。未知成员名不路由（走正常 prompt）。

#### Scenario: @补全

- **WHEN** 当前会话存在团队且用户输入 @
- **THEN** 下拉同时给出成员名与文件候选，成员项带状态副标题

#### Scenario: 直接路由

- **WHEN** 用户发送「@sc1 再补充一点」且 sc1 是当前团队成员
- **THEN** 「再补充一点」作为 followUp 消息直达 sc1 的会话，领导不消耗轮次

### Requirement: 成员会话查看（焦点导航 v1）

成员的会话事件 SHALL 以成员 sessionId 为信封键转发 renderer（复用后台会话
折叠管线）；点击团队卡成员行的「查看」 SHALL 把可见视图切换到该成员会话
（顶部横幅标注「正在查看成员」+ 返回主会话）；聚焦期间 composer 发送路由
到该成员（同 @路由语义）、停止键中止该成员当前轮。

#### Scenario: 聚焦成员

- **WHEN** 用户点击团队卡成员行的「查看」
- **THEN** 可见视图切换为该成员的完整对话（实时流式），横幅提供返回主会话

#### Scenario: 聚焦期间发送

- **WHEN** 聚焦成员期间在输入框发送消息
- **THEN** 消息直达该成员会话（followUp 语义），不出现在领导对话
