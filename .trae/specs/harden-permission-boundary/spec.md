# 权限边界加固（区外读询问 + 应用目录写保护 + 端到端验证 + chat 权限入口）Spec

## Why

**事故经过**（2026-09-09 真实会话，事件日志为证）：用户在默认工作区（`C:\Users\wzd\KamiBuddy`）
开「默认权限」让 KamiBuddy 优化前端。工作区是空的，模型经提示词里的内置技能路径发现
项目目录 `D:\DongProject\kamibuddy`，随后自由读取了项目源码与 `docs/workbuddy分析/`
（合规敏感素材），并开始对 `src/renderer/` 两个文件发起 edit——用户中断后报警。

**根因调查结论**（逐条有证据）：

1. **文件实际未被改**（run 在参数流式生成阶段被中断，git status 干净），但恢复视图里
   两张被取消的 edit 卡显示「已修改」——`restoredToolLabel` 恒用完成态词汇，UI 误导。
2. **写拦截链路设计存在且形状正确**（源码核对：pi `beforeToolCall` → `runner.emitToolCall`
   → gate → `{block:true}` 阻止执行），但**从未端到端验证**：两天事件日志中
   `permission:request` 出现次数为零，弹窗链路是否真通无人知道。
3. **真正的设计缺口在读侧**：`read/ls/find/grep` 出工作区一律放行，模型可以漫游到
   磁盘任何位置「先跑出去」。codex 的 workspace-write 同样不限读——但 codex 沙箱默认
   **禁网**；我们有 `web_fetch` 外发通道（任意文件可读 + 任意 URL 可抓 = 数据外带路径），
   威胁模型不同，不能照抄。
4. chat 页没有权限切换入口（首页有，对话中没有），用户无法在事发时切档。

## What Changes

- **区外读改为询问**（**行为变化**）：默认权限档下 `read/ls/find/grep` 目标在工作区外 →
  低风险询问（summary「读取工作目录之外的文件或目录」），可「本次会话记住」（按目录）。
  只读档同样询问（读的边界就是它的全部语义）；允许完全访问档不受限（语义一致）。
  凭据目录/配置目录禁读不变。web_search/web_fetch/present_files 不变（无本地路径）。
- **写应用目录升为高风险**：write/edit 目标在应用目录（dev 为项目根，打包后为安装目录）
  内 → 高风险询问；只读档拒（既有语义）；完全访问档放行（既有语义）。
- **高风险操作不支持「记住」**：risk=high 的审批（shell、写应用目录）弹窗不显示
  「本次会话记住」选项，每次都问。
- **权限门端到端构造验证**：新增 `scripts/smoke-permission-gate.ts`——真实
  `SessionHost.create` 建会话（假 provider 指 127.0.0.1:9，同 smoke:session），
  经 `session.agent.beforeToolCall`（pi 公开字段）触发真实拦截链，断言：
  区外 edit → requestApproval 被调 + deny 后 `{block:true}`；区内 edit → 放行；
  区外 read → requestApproval 被调；读 .ssh → 不经审批直接 block。`npm run smoke:permission`。
- **chat 页权限入口**：PermissionMenu 复用进 chat-view composer-bar（与首页同一组件、
  同一数据源）。
- **审批可审计**：daemon 的 requestApproval/应答落事件日志（通道名 + risk + 用户选择，
  不含路径细节外的敏感参数——路径本来就会进会话工具卡日志）。
- **恢复视图 label 修正**：`restoredToolLabel` 增加 outcome 参数，未完成（aborted/error）
  的工具卡不用完成态词汇（edit aborted → 「修改（未完成）」等），消除「已修改」误导。

## Impact

- Affected specs: 权限模型（读侧边界收紧 + 应用目录写保护 + 审计）、会话恢复视图
- Affected code:
  - `src/extensions/permission-policy.ts`（PolicyPaths 加 appDir、判定链加区外读询问与应用目录写高风险）
  - `src/extensions/permission-policy.test.ts`（翻转用例 + 新增，按项目惯例留翻转记录）
  - `src/extensions/permission-gate.ts`（高风险不记住：ask 流程与 remembered 的互动）
  - `src/renderer/permission-dialog.tsx`（risk=high 隐藏「记住」选项）
  - `src/daemon/index.ts`（requestApproval/应答落 eventLog；gate 组装传 appDir）
  - `scripts/smoke-permission-gate.ts`（**新**）、`package.json`（smoke:permission 脚本）
  - `src/renderer/chat-view.tsx`（composer-bar 接入 PermissionMenu）
  - `src/core/session-host.ts`（restoredToolLabel 加 outcome 参数）
  - `src/core/session-rebuild.ts` + 测试（label 按 outcome 分派）
  - `docs/ARCHITECTURE.md` §4.57 判定链表更新、`docs/STATUS.md`

## ADDED Requirements

### Requirement: 区外读询问

默认权限档与只读档下，`read/ls/find/grep` 目标解析后在工作区之外 →
低风险询问（summary 明确「读取工作目录之外的文件或目录」，details 为解析后的绝对路径）；
允许完全访问档不受限；凭据目录与配置目录仍直接拒（阶段 1 不变）。
「本次会话记住」按工具+目录记忆，与区外写同一机制。

#### Scenario: 模型漫游被看见
- **WHEN** 工作区为 `~/KamiBuddy`、默认权限档，模型 `ls D:\DongProject\kamibuddy`
- **THEN** 弹出审批「读取工作目录之外的文件或目录」，用户拒绝则工具被 block 且 reason 回给模型

#### Scenario: 记住后同目录不再问
- **WHEN** 用户对 `D:\SomeDocs` 的读取批准并勾选「本次会话记住」
- **THEN** 本会话内对该目录的后续读取直接放行；新会话重新询问

### Requirement: 应用目录写保护

write/edit 目标在应用目录内 → 高风险询问（summary 指明「修改 KamiBuddy 自身目录下的文件」）；
弹窗不显示「本次会话记住」。只读档拒绝；完全访问档放行。

#### Scenario: 改项目源码必被拦下问一次
- **WHEN** 默认权限档，模型 edit `<appDir>/src/renderer/home-view.tsx`
- **THEN** 弹高风险审批；无「记住」选项；拒绝则 block

### Requirement: 权限门端到端构造验证

系统 SHALL 提供 `npm run smoke:permission`：在真实 pi 运行时里建会话并触发
`beforeToolCall` 真实链路（不消耗模型额度），断言上述放行/询问/拒绝/高风险各分支
的 handler 行为与 block 语义。CI 式可重复，作为权限门「真通」的机械证据。

#### Scenario: 拦截链被证明
- **WHEN** 开发者运行 `npm run smoke:permission`
- **THEN** 全部断言通过：区外 edit 触发审批、deny 后 block；区内 edit 放行；
  区外 read 触发审批；凭据目录不经审批直接 block

### Requirement: chat 页权限切换

chat-view composer-bar SHALL 提供与首页相同的 PermissionMenu 入口
（同一组件、同一 getPermissions/setPermissions 数据源），用户在对话中可随时切档，
下一次工具调用生效。

#### Scenario: 对话中切档
- **WHEN** 用户在对话页 composer 区点权限 chip 切到「只读」
- **THEN** chip 显示「只读」，随后写操作被拒；首页 chip 与设置页显示一致

### Requirement: 审批可审计

daemon SHALL 把每次审批请求（工具、风险、summary）与应答（允许/拒绝、是否记住）
写入事件日志（ sanitize 规则同现有：不记工具入参全文，路径可记——它本就在工具卡日志里）。

#### Scenario: 事后可追溯
- **WHEN** 用户质疑「什么时候批准过这个操作」
- **THEN** 事件日志中能查到该次请求与应答记录

### Requirement: 未完成工具卡不使用完成态词汇

恢复视图与生成中止的工具卡，outcome 为 aborted/error 时 label SHALL 不用
「已修改/已生成」等完成态词汇（标注未完成语义），live 路径（tool_finished）不受影响。

#### Scenario: 取消不再误导
- **WHEN** 生成中的 edit 被中断，恢复该会话后查看该工具卡
- **THEN** 卡片不显示「已修改」，而是未完成语义（如「修改（未完成）」）+ aborted 状态

## MODIFIED Requirements

### Requirement: 只读工具的边界

原行为：`read/ls/find/grep` 在任何非凭据路径一律放行（「不改变任何状态 → 放行」）。
新行为：工作区内放行不变；**工作区外询问**（默认档与只读档；完全访问档不受限）。
**理由**：本次事故证明「先跑出去读」是写越界的必经入口；且存在 web_fetch 外发通道时，
「读任意文件 + 抓任意 URL」是数据外带路径（与凭据禁读同一推理链，见 permission-policy.ts
头注释 2026-09-08 条目）。codex 不限读是因为它沙箱默认禁网，我们没有禁网这个前提。
**迁移**：行为收紧属有意变化；既有测试用例按项目惯例标注翻转（留翻转记录注释）。

## REMOVED Requirements

无（不删除任何既有能力；区外读从「静默放行」改为「询问」已在上节声明为行为变化）。

## 明确不做（本变更范围外）

- **OS 级沙箱**：维持 ARCHITECTURE §4.4b 的搁置决策（受限令牌 + ACL 是 Windows 正解，
  成本与排期问题；`SandboxEnforcement` 继续如实报 `partial`）。
- **网络域隔离**（codex 式默认禁网）：联网是产品核心价值，不禁；用读取边界补。
- **区外读一律硬拒**：会让「整理我的文档」类正常诉求不可用；询问 + 按目录记住是平衡点。
- **应用目录读特殊化**：走通用区外读询问，不另立规则。
- **路径逃逸的深度防御**（realpath/符号链接）：维持现状词法判定，已知面记录在案。
