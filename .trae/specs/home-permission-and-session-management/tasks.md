# Tasks

## 批一 · 权限快捷切换（独立，可与批二并行）

- [x] Task 1: 首页权限预设弹层
  - [x] 1.1 新建 `src/renderer/permission-menu.tsx`：仿 model-menu.tsx 弹层模式；展开时拉 `getPermissions`；列出 PERMISSION_PRESETS（label + description + 当前选中勾）；选自定义时无选中项；底部「打开设置」入口
  - [x] 1.2 home-view.tsx 的「默认权限」chip 接入 PermissionMenu（替换 onTodo("权限策略")）；chip 文案 = 当前预设 label（custom → 「自定义」）；选中后调 setPermissions 并更新本地状态，失败 toast 且不回写
  - [x] 1.3 index.css 补弹层样式（复用 model-menu 的视觉语言）

## 批二 · 会话管理（核心）

- [x] Task 2: 契约层（shared/ipc.ts + preload 白名单）
  - [x] 2.1 `SessionSummary` 类型（id / path / title / name? / cwd / isPlayground / createdAt / modifiedAt / messageCount / current）
  - [x] 2.2 四个通道：session:list / session:resume / session:rename / session:delete（payload 契约集中在 ipc.ts，preload 同步白名单）

- [x] Task 3: 视图重建纯函数（core/session-rebuild.ts）
  - [x] 3.1 pi SessionEntry[]（buildContextEntries 的输出）→ ConversationEntry[]：user/assistant（text + thinking 拼接、usage）、toolCall 与后续 toolResult 配对成 ToolCard（outcome = isError ? error : ok，detail 截断）、图片块占位「[图片]」；compaction / model_change / label / session_info / custom / bashExecution 跳过；id 用 entry.id，at 用 Date.parse(entry.timestamp)
  - [x] 3.2 resume 路径守卫纯函数：目标必须在 getSessionsDir() 内且扩展名 .jsonl（防 ../ 穿越与任意文件打开）
  - [x] 3.3 vitest：消息映射、工具卡配对（ok/error/孤儿 toolCall）、跳过条目类型、图片占位、路径守卫边界 → ≥10 用例

- [x] Task 4: daemon 四个 handler + resume 编排
  - [x] 4.1 session-host.ts：SessionHostOptions 增加 sessionManager 注入点（默认 SessionManager.create，恢复时传 SessionManager.open 的结果；create/open 是否 async 以 dist 类型为准核对）；暴露 rename（当前会话 appendSessionInfo）与 sessionFile/sessionId 访问器
  - [x] 4.2 session:list：SessionManager.listAll(getSessionsDir()) → SessionSummary[]（current 比对活动 host；playground cwd === join(configDir,"playground") 判定在 daemon 侧完成）
  - [x] 4.3 session:resume：守卫（非流式 + 3.2 路径校验）→ dispose 旧 host → open + 重建 SessionHost（复用 createHost 全部组装：扩展、工具集、两轴、权限门）→ 从 header 恢复 workspaceDir/isPlayground（playground 占位目录 → playground 语义；否则过 validateWorkspacePath 后恢复，目录不存在则 mkdirSync 与 create 一致）→ previewServer.setRoot 同步 → 用 Task 3 纯函数重建 conversation → 发 session_state（renderer 随后 resyncSnapshot）
  - [x] 4.4 session:rename：当前会话走活实例 appendSessionInfo；非当前会话临时 SessionManager.open + appendSessionInfo（不持有，避免双写者）
  - [x] 4.5 session:delete：当前会话拒删（提示先新建任务）；目标文件 renameSync 到 ~/.kamibuddy/trash/（同名加时间戳前缀，目录递归创建）

- [x] Task 5: renderer 侧栏任务列表与交互
  - [x] 5.1 App.tsx 持有 taskList state + refresh（session:list）；触发点：activate 后、newTask.then、resume.then、onSessionEvent 收到 run_finished
  - [x] 5.2 sidebar.tsx「任务」区渲染列表：标题（name ?? firstMessage 截断）、智能时间戳（shared/message-time.ts）、空间标识（playground「不使用工作空间」/目录末段）、current 高亮
  - [x] 5.3 点击行 → session:resume → resyncSnapshot + setView("chat")；失败 toast 且留在原视图
  - [x] 5.4 行内重命名（点击进入编辑态，Enter 提交 / Esc 取消）与删除（点击后该行进确认态「确认删除？」，再点确认执行）；index.css 补样式

- [x] Task 6: 验证与文档
  - [x] 6.1 `npm run check && npm test` 全绿；`npm run smoke:session` 13/13 不回退
  - [x] 6.2 手动验收（checklist.md 全部勾完）后更新 docs/STATUS.md（T4 落地说明 + 权限入口修正）与 docs/ROADMAP.md（T4 勾选）

- [x] Task 7: resume 失败原子性（验收风险项修复）
  - [x] 7.1 daemon/index.ts 的 sessionResume：把 `SessionManager.open` + header 校验 + validateWorkspacePath 全部前移到 dispose 旧 host 之前（open 是同步的、不依赖旧宿主销毁）；任何校验失败时旧会话原样保留
  - [x] 7.2 重跑 `npm run check && npm test && npm run smoke:session` 全绿

# Task Dependencies

- Task 1 独立，与 Task 2-5 可并行
- Task 3 依赖 Task 2（契约类型）
- Task 4 依赖 Task 2、Task 3
- Task 5 依赖 Task 2、Task 4（通道与 handler 就绪）
- Task 6 依赖全部

# 实现注意事项（写代码前必读）

- pi 的事实（已核对 dist 类型与官方 docs/session-format.md）：
  `SessionManager.listAll(sessionDir?) → SessionInfo[]`（path/id/cwd/name?/created/modified/messageCount/firstMessage）；
  `SessionManager.open(path, sessionDir?)`；`appendSessionInfo(name)`；
  `buildContextEntries()` 输出带稳定 8-char id 与 ISO timestamp 的 SessionEntry[]；
  视图重建用它而不是 `session.messages`（后者无稳定 id，UI 流式定位靠 id）。
- 恢复会话**不改模型选择与权限设置**（spec 决策，别顺手"改进"）。
- 工具卡片 label：重建时优先查扩展注册的工具 label（web_search/web_fetch/present_files 有中文 label），查不到用 toolName 原样——不要在重建函数里另写一份映射表。
- 遵守 AGENTS.md：daemon 不许 import electron；core 之外的层不许碰 pi 类型（SessionEntry 只在 core/session-rebuild.ts 与 session-host.ts 出现）。
- 权限门 / STATUS.md 的坑：改完必须 `npm run check && npm test`。
