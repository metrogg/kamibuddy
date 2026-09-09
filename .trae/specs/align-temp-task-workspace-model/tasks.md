# Tasks

## 批一 · 基础层（契约 + 路径 + 偏好）

- [ ] Task 1: 路径与偏好基础
  - [ ] 1.1 `src/core/config-paths.ts`：加 `getTempTasksDir(root)`（join(root,"临时任务")）与 `getDefaultWorkspaceRoot()`（内置默认 ~/KamiBuddy，保留 KAMIBUDDY_WORKSPACE_DIR env override）；加注释：分层 = env > preferences.defaultWorkspacePath > 内置默认（WorkBuddy 同款，其 defaultWorkspacePath 设置项取证）
  - [ ] 1.2 `src/core/preferences.ts`：Preferences 加 `defaultWorkspacePath?: string`（读改写不丢其他键）；加 `getEffectiveWorkspaceRoot()`（env > 设置项 > 内置默认；设置项路径非法时回退内置默认并注释——WorkBuddy 同款回退）；测试 ≥6 用例（分层优先级、非法回退、读写不丢键、临时目录拼接）
- [ ] Task 2: 契约改名与通道（依赖 Task 1 的类型）
  - [ ] 2.1 `src/shared/session-events.ts`：SessionState.isPlayground → isTempTask（注释修正：删除「WorkBuddy cwd=\"\" 同语义」错误背书，改写临时任务语义与取证来源）；`src/shared/conversation.ts` 的 initialConversation 同步
  - [ ] 2.2 `src/shared/ipc.ts`：SessionSummary.isPlayground → isTempTask；INVOKE 加 `saveToWorkspace "session:save-to-workspace"`（args: [name: string], result: void）、`getDefaultWorkspacePath "settings:get-default-workspace-path"`（result: { effective: string; custom: string | undefined; isDefault: boolean }）、`setDefaultWorkspacePath "settings:set-default-workspace-path"`（args: [path: string]（空串=还原默认）, result: { effective: string }）；InvokeMap 同步；bridge.ts + preload 同步

## 批二 · 核心语义切换（依赖批一）

- [ ] Task 3: session-host 与 daemon 语义切换
  - [ ] 3.1 session-host.ts：PLAYGROUND_TOOLS 与 configDir/playground 占位目录逻辑删除；`isPlayground` options 字段退役——临时任务就是普通 cwd 会话（调用方直接传临时目录）；技术 cwd 推导简化
  - [ ] 3.2 daemon createHost：playground 分支删除——不再有不装权限门的会话（权限门全量装）；playground 时不注册文件工具的分支删除
  - [ ] 3.3 daemon applyWorkspace：空串语义从「playground」改为「临时任务」（cwd=getTempTasksDir(getEffectiveWorkspaceRoot())，递归创建）；picker 默认态对齐
  - [ ] 3.4 daemon resumeSession：playground 判定改临时判定（header.cwd === configDir/playground 占位目录 → 映射到临时目录；header.cwd === getTempTasksDir 或默认根本身 → 临时任务）；previewServer.setRoot 临时目录也起服务（不再是 undefined）
  - [ ] 3.5 daemon listSessions：isTempTask 判定（cwd === 临时目录 || cwd === 默认根本身 || cwd === configDir/playground 旧占位）；workspaces 组排除临时目录与根本身（它们归任务区不成组）
  - [ ] 3.6 daemon 设置项 handler：get/set defaultWorkspacePath（set 时空串=清除回退；修改后 listWorkspaces/新任务即刻用新根——getter 读取不缓存）
- [ ] Task 4: 保存到工作空间（依赖 Task 1-3）
  - [ ] 4.1 daemon saveToWorkspace handler：守卫（当前会话必须是临时任务，否则抛「只有临时任务可以保存到工作空间」；流式拒）→ 名称校验（复用 workspace-registry 的 validateDisplayName，siblings=根下现有子目录名+外部空间组名——这是对真实目录命名，注释说明与显示名校验复用的理由）→ mkdir `<根>/<名称>/` → 复用 resume 同套流程以新 cwd 重建会话（dispose+createHost+视图重建）→ workspaceDir 切到新目录、previewServer.setRoot 同步
  - [ ] 4.2 已生成文件留在临时目录（注释写明：共享临时目录无法干净归属单个任务的文件——WorkBuddy 同为共享目录）

## 批三 · 界面（依赖批二）

- [ ] Task 5: renderer 语义切换
  - [ ] 5.1 workspace-picker.tsx：移除「不使用工作空间」选项；默认态显示「临时任务」（chip 文案）；picker 列表数据源改用 getEffectiveWorkspaceRoot
  - [ ] 5.2 sidebar.tsx / session-groups.ts：isPlayground → isTempTask（分桶键与类型同步改名，测试同步）
  - [ ] 5.3 home-view.tsx：工作空间 chip 默认态文案「临时任务」（不再「不使用工作空间」）
  - [ ] 5.4 chat-view.tsx：当前会话 isTempTask 时头部显示「保存到工作空间」按钮 → 命名 dialog（输入+校验错误透出）→ saveToWorkspace → resyncSnapshot + refreshTasks
  - [ ] 5.5 settings-view.tsx：新增「默认存储路径」区块（当前生效根 + 修改（pickWorkspaceDirectory 复用）+ 还原默认 + 「修改不影响已有数据」说明文案——自己写，不抄 locale 原文）

## 批四 · 收尾

- [ ] Task 6: 验证与文档
  - [ ] 6.1 `npm run check && npm test` 全绿；`npm run smoke:session` / `npm run smoke:permission` 不回退（playground 相关断言需同步——smoke-session 里有 playground 构造路径）
  - [ ] 6.2 docs/STATUS.md：「临时任务模型对齐 WorkBuddy（2026-09-09）」小节（含错误背书更正记录）；「会话隔离 + playground」旧节目标记已废弃并指向新节；ARCHITECTURE.md 涉及 playground 的描述同步；「等你验证」更新

# Task Dependencies

- Task 2 依赖 Task 1；Task 3 依赖 Task 1、2；Task 4 依赖 Task 1-3；Task 5 依赖 Task 2、3
- Task 1 与 Task 2 的 2.1 可并行；Task 6 依赖全部

# 实现注意事项（写代码前必读）

- **WorkBuddy 取证原文（勿篡改）**：「所有生成 "Claw" 临时任务 / 工作空间子目录的点都应使用
  resolveDefaultWorkspaceRoot()……兜底策略：`~/{getWorkbuddyAppName()}`」（main/server.js）；
  临时任务共享单一 Claw 目录；locale `workspaceStorage.description`「修改后不影响已有数据」。
- **错误背书必须修**：session-events.ts 的「WorkBuddy cwd=\"\" 同语义」查无实据，随字段改名删除。
- 契约改名是 BREAKING：同仓库同构建，全仓搜 isPlayground 一处不漏（含测试与 smoke 脚本），不留兼容 shim。
- 临时任务 = 普通 cwd 会话：权限门、文件工具、预览服务全部按正式空间同待遇（这是本次的核心语义）。
- 保存到工作空间只切 cwd 不搬文件（spec 决策）；名称校验复用 validateDisplayName。
- 判定「临时」用当前生效根（WorkBuddy 的 isClawRuntimeCwd 同款局限：改根后旧临时会话归空间区），注释写明。
