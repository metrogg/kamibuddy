# Tasks

## 批一 · 数据层（有依赖顺序）

- [x] Task 1: 空间注册表（core/workspace-registry.ts + 测试）
  - [x] 1.1 `workspaces.json`（configDir 下）读写：`readDisplayNames(): Record<path, displayName>`、`setDisplayName(path, name)`、`removeDisplayName(path)`（读改写，参照 preferences.ts 的模式；文件不存在/坏 JSON 按空表处理并注释理由）
  - [x] 1.2 显示名校验纯函数 `validateDisplayName(name, siblings: readonly string[]): string | undefined`（undefined=合法，否则错误串——与 validateWorkspacePath 同风格）：trim 后非空、不含 `\\/:*?"<>|`、≤255、不与 siblings 重名、非保留名（CON/PRN/AUX/NUL/COM1-9/LPT1-9，大小写不敏感）
  - [x] 1.3 vitest ≥8 用例（各校验分支 + 读写往返 + 坏文件兜底）
- [x] Task 2: 契约层（依赖 Task 1 的类型）
  - [x] 2.1 `src/shared/ipc.ts`：`WorkspaceGroupMeta { cwd: string; displayName?: string }`；INVOKE 加 `workspaceGroups "workspace:groups"`（result: WorkspaceGroupMeta[]）、`workspaceRename "workspace:rename"`（args: [cwd, name]）、`workspaceRemove "workspace:remove"`（args: [cwd]）、`workspaceReveal "workspace:reveal"`（args: [cwd]）
  - [x] 2.2 bridge.ts + preload 同步四个方法
- [x] Task 3: daemon 四个 handler（依赖 Task 1、2）
  - [x] 3.1 `workspaceGroups`：从 listSessions 取全部非 playground 会话的 cwd 去重 → 每组给 {cwd, displayName?}（读注册表）
  - [x] 3.2 `workspaceRename`：validateDisplayName（siblings = 其他组的显示名 ?? basename）→ setDisplayName
  - [x] 3.3 `workspaceRemove`：守卫（含当前会话属于该 cwd 时先拒：「这是当前任务所在空间，请先新建任务再移除」）→ 该 cwd 全部会话文件移 trash（复用 sessionDelete 的 trash 移动：时间戳前缀 + 目录递归创建；用 listAll 找到该 cwd 的文件）→ removeDisplayName
  - [x] 3.4 `workspaceReveal`：校验 cwd 在 3.1 的组集合内（防任意路径）→ 经 main 转发 shell.openPath（main 侧加对应 handler，参照现有 openArtifact 的 main/daemon 分工——先读 main/index.ts 与 daemon 的现有转发模式照做；openArtifact 的已知问题不顺手修）

## 批二 · 展示层（依赖批一）

- [x] Task 4: 分组纯逻辑（renderer/session-groups.ts + 测试）
  - [x] 4.1 `groupSessions(summaries, metas)` → `{ tasks: SessionSummary[]; spaces: SpaceGroup[] }`；SpaceGroup {cwd, name, sessions, latestAt}：playground 进 tasks（modifiedAt 倒序）；其余按 cwd 分桶（name = meta.displayName ?? basename(cwd)，Windows 分隔符都处理）；组内倒序；组间按 latestAt 倒序
  - [x] 4.2 vitest ≥8 用例（分桶、显示名覆盖、basename 提取（含尾分隔符/盘符根）、组间排序、空输入）
- [x] Task 5: sidebar 两区重构（依赖 Task 4）
  - [x] 5.1 任务区：仅渲染 groups.tasks；>5 条时前 5 条 +「查看更多 (N)」按钮展开全部（展开态会话内存）
  - [x] 5.2 空间区：渲染 groups.spaces；组头 = 折叠箭头 + 名称 + 计数 + hover 显示「+」（新建）与「⋯」（菜单）；组内任务行复用现有 task-item（含恢复/导出/重命名/删除/状态点）
  - [x] 5.3 「⋯」菜单（参照 permission-menu 弹层模式）：打开文件夹 / 重命名（行内编辑态，复用任务重命名的交互）/ 从列表移除（行内确认态，复用删除确认模式）；三个动作经 App 回调调对应通道，成功后刷新（refreshTasks + 重新拉 groups）
  - [x] 5.4 「+」：调 App 回调 → setWorkspace(cwd) 成功后 newTask()（复用现有原语与错误 toast）
  - [x] 5.5 任务状态指示：行是当前会话且 isStreaming → spinner 元素（CSS 旋转动画）；unread 集合（App 下发的 Set<string>）含该行 path → 绿点
- [x] Task 6: App.tsx 状态接线（依赖 Task 2、5）
  - [x] 6.1 workspaceGroups 数据：随 refreshTasks 一起拉（合并进同一 state 或独立 state，注释取舍）
  - [x] 6.2 unread 集合：onSessionEvent 收到 run_finished 时，若 view!=="chat" 或当前会话不是列表 current（极端竞态，注释说明）→ 把 current path 加入 unread；resumeTask/点击行时从 unread 删除该 path；传给 Sidebar
  - [x] 6.3 空间操作回调：renameWorkspace / removeWorkspace / revealWorkspace / newTaskInSpace(cwd)（setWorkspace.then(newTask)，失败 toast 不新建）

## 批三 · 收尾

- [x] Task 7: 验证与文档
  - [x] 7.1 `npm run check && npm test` 全绿；`npm run smoke:session` / `npm run smoke:permission` 不回退
  - [x] 7.2 docs/STATUS.md 补「侧栏任务×空间重构（2026-09-09）」小节（WorkBuddy 机制取证要点 + 有意差异）与「等你验证」条目

# Task Dependencies

- Task 2 依赖 Task 1；Task 3 依赖 Task 1、2；Task 5 依赖 Task 4；Task 6 依赖 Task 2、5
- Task 1 与 Task 4 可并行（都是纯函数新文件）；Task 2 也可与它们并行（不同文件，类型先约定）
- Task 7 依赖全部

# 实现注意事项（写代码前必读）

- **WorkBuddy 取证结论（勿篡改）**：重命名仅改显示名不动目录（locale 原文）；移除空间会删除其任务
  （我们用 trash 替代真删）；它临时任务落默认存储路径（我们 playground 语义不变）。
- 空间组**由会话文件派生**（磁盘真相）：没有会话的目录不形成组；移除后若该目录再做任务会自然重现。
- 「从列表移除」的守卫：当前会话属于该 cwd 时先拒（先新建任务），错误文案照此写。
- 单 daemon 单会话：执行中转圈只可能出现在当前会话行，注释写明这一架构事实。
- unread 是 renderer 内存态（重启清零）——spec 决策，持久化留后续。
- 遵守 AGENTS.md：renderer 只 import @shared/同目录；daemon 不 import electron；注释写「为什么」。
