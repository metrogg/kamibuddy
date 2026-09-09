# Tasks

## 批一 · 判定链与审批流（核心安全）

- [x] Task 1: permission-policy 判定链加固
  - [x] 1.1 `PolicyPaths` 增加 `appDir`（可选，向后兼容：不传则应用目录规则不生效——daemon 必传）
  - [x] 1.2 判定链修改：阶段 2 只读工具拆为「工作区内 → 放行」「工作区外 → 低风险询问（summary「读取工作目录之外的文件或目录」）」；`read-only` 档同样询问（读是它的全部语义）；`danger-full-access` 档不受限；阶段 1（凭据/配置禁读）不变
  - [x] 1.3 MUTATING 分支加：目标在 appDir 内 → 高风险询问（summary 指明「修改 KamiBuddy 自身目录下的文件」），先于 workspaceDir 内放行判定（appDir 也可能是工作区——写自己应用永远要问）；`read-only` 档仍拒；`danger-full-access` 档放行
  - [x] 1.4 测试更新：翻转用例按项目惯例留翻转记录注释（参照文件内 2026-09-08 那条翻转写法）；新增：区外读 ask/记住/完全访问放行、appDir 写高风险/read-only 拒/完全访问放行、appDir 省略时不生效
- [x] Task 2: 高风险不支持「记住」+ 审批审计（依赖 Task 1）
  - [x] 2.1 permission-dialog.tsx：risk==="high" 时不渲染「本次会话记住」选项（shell 既有行为同步变化，注释写明）
  - [x] 2.2 daemon/index.ts：requestApproval 发请求与收应答时落 eventLog（kind: "permission"，含 toolName/risk/summary/用户 decision/remember；不记 details 全文——路径已随工具卡日志落盘）；gate 组装处把 `appDir: process.cwd()` 传入 PolicyPaths
  - [x] 2.3 复核 permission-gate.ts：高风险无「记住」时 remembered 集合不会被污染（response.remember 只在 dialog 提供该选项时才可能为 true——确认链路无漏洞，必要时 gate 侧对 risk==="high" 忽略 remember 双保险）

## 批二 · 端到端证明（依赖批一）

- [x] Task 3: scripts/smoke-permission-gate.ts + `npm run smoke:permission`
  - [x] 3.1 参照 scripts/smoke-session.ts 的构造（假 provider 指 127.0.0.1:9、KAMIBUDDY_CONFIG_DIR 用临时目录、KAMIBUDDY_WORKSPACE_DIR 用临时目录），经 SessionHost.create 建真实会话，注入 createPermissionGate（requestApproval 用记录桩：记录请求、按脚本指令 allow/deny）
  - [x] 3.2 经 `session.agent.beforeToolCall`（pi 公开字段，先核对 dist 类型 AgentSession.agent 与 BeforeToolCallContext 形状）触发真实链断言：区外 edit → 审批桩被调 + deny → {block:true}；区内 edit → undefined（放行）；区外 read（新行为）→ 审批桩被调；读 `$HOME/.ssh/id_rsa` → 不经审批直接 {block:true}；appDir 写 → 审批桩被调且 risk==="high"
  - [x] 3.3 package.json 加 `smoke:permission` 脚本；STATUS.md「怎么跑」一节同步

## 批三 · 体验与误导修正（独立，可与批一并行）

- [x] Task 4: chat 页权限入口
  - [x] 4.1 chat-view.tsx composer-bar 接入 PermissionMenu（同 home-view 用法；onOpenSettings 经 App 传入或新 prop，注意 ChatView props 签名变化同步 App.tsx）；样式与首页 chip 一致
- [x] Task 5: 未完成工具卡 label 修正
  - [x] 5.1 session-host.ts 的 restoredToolLabel 增加 outcome 参数：aborted/error 时返回未完成语义词汇（如 edit→「修改（未完成）」、write→「生成（未完成）」、其他工具 → toolName 原样或 doneLabel 的进行中形态——以 live 词汇表为单一来源，不另起映射）
  - [x] 5.2 session-rebuild.ts 调用处同步传 outcome；补/改测试：aborted 的 edit 卡 label 不含「已修改」

## 批四 · 收尾

- [x] Task 6: 验证与文档
  - [x] 6.1 `npm run check && npm test` 全绿（含翻转后的权限测试）；`npm run smoke:session` 13/13 不回退；`npm run smoke:permission` 全过
  - [x] 6.2 docs/ARCHITECTURE.md §4.57 判定链表格更新（区外读从放行改询问、appDir 写高风险行）；docs/STATUS.md 新增「权限边界加固（2026-09-09）」一节（事故经过、根因、修复、待用户验证项）；「等你验证」更新

# Task Dependencies

- Task 2 依赖 Task 1（判定链的 risk 语义）
- Task 3 依赖 Task 1、Task 2（行为定型后才写断言）
- Task 4、Task 5 独立，与批一可并行
- Task 6 依赖全部

# 实现注意事项（写代码前必读）

- 事故证据链（不要篡改结论）：两天事件日志 `permission:request` 为零（链路从未真实触发）；
  出事的两个 edit 在参数生成阶段被用户 abort（文件未改）；读侧漫游是真实入口。
- pi 的事实（已核对源码）：`agent-session.ts:480-499` beforeToolCall 钩 → `runner.emitToolCall({type:"tool_call",toolName,toolCallId,input:args})`；`{block:true}` 阻止执行；
  handler 异常会重抛变工具错误（fail-closed 方向）。`AgentSession.agent` 是公开 readonly 字段。
- 参考设计口径（写注释/文档时引用要准确）：codex workspace-write 不限读但**沙箱默认禁网**；
  我们不禁网（联网是核心价值）所以必须收读取边界。dsh 的「旋钮是真相，预设是糖」已采用。
- 改权限测试遵守项目惯例：翻转用例**必须**留翻转记录注释（日期 + 旧行为 + 新前提）。
- `npm test` 全绿才算完（权限相关测试是安全边界的唯一护栏，STATUS.md 原话）。
