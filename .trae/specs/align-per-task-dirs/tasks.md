# Tasks

## 波一 · 可并行（文件零交集）

- [x] Task 1: 自动目录命名与判定（shared 层，两端共用）
  - [x] 1.1 新建 `src/shared/workspace.ts`：`autoSessionDirName(now)` → `YYYY-MM-DD-HH-mm-ss`
        （本地时间，补零；与 WorkBuddy `formatDefaultCwdTimestamp` 同格式）；
        `isAutoSessionDirName(name)` → 匹配 `^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$`
  - [x] 1.2 放 shared/ 的理由写进注释：daemon（分配）与 renderer（分组）
        都要用同一份判定，renderer 不许 import core/（AGENTS.md §1）
  - [x] 1.3 单测：格式正确（含补零边界 00:00:05）、正则命中/不命中
        （`2026-9-1-1-1-1` 不命中、`automation-2026-…` 不命中、`临时任务` 不命中）
  - [x] 1.4 验证：`npm run typecheck && npx vitest run src/shared`

- [x] Task 2: 导出与技能资源改用生效根（同族口径修正）
  - [x] 2.1 `src/core/session-export.ts`：`getWorkspaceDir()` → 生效根
        （`getEffectiveWorkspaceRoot()`；注意 core 内部 import，确认无循环依赖）
  - [x] 2.2 `src/daemon/index.ts` 里技能资源加载等仍用内置默认根的点一并核正
        （搜 `getWorkspaceDir()` 的全部调用点，逐个判断该用哪个口径并注释理由）
  - [x] 2.3 验证：`npm run typecheck && npx vitest run src/core src/daemon`

## 波二 · 依赖 Task 1

- [x] Task 3: 自动目录创建（core 层）
  - [x] 3.1 `src/core/workspace.ts` 新增 `createSessionDir(root, now?)`：
        `mkdir -p root` → 按 `autoSessionDirName` 建目录 → 已存在则**按秒递增**重试
        （上限 100 次，照 WorkBuddy），返回最终路径
  - [x] 3.2 单测：正常创建、已存在时递增重试（预建同名目录）、上限耗尽时报错、
        root 不存在时自动创建
  - [x] 3.3 验证：`npm run typecheck && npx vitest run src/core`

- [x] Task 4: 分组与任务行入口（renderer 层）
  - [x] 4.1 `src/renderer/session-groups.ts`：`isTempTask` 的判定口径对齐新模型
        （若字段由 daemon 提供则只消费；若需 renderer 兜底判定，用 shared 的
        `isAutoSessionDirName`），保持「任务区扁平 / 空间区按 cwd 分组」不变
  - [x] 4.2 `src/renderer/sidebar.tsx`：任务行菜单加「打开文件夹」
        （复用 `onRevealWorkspace` 通道，传该会话 cwd）
  - [x] 4.3 `src/renderer/chat-view.tsx`：「保存到工作空间」的弹窗文案/成功提示
        适配「目录会被重命名」（提示产物会随目录迁移；失败提示关闭占用程序后重试）
  - [x] 4.4 验证：`npm run typecheck && npx vitest run src/renderer src/shared`

## 波三 · 依赖前两项（daemon 层，集中一个改动域避免同文件冲突）

- [x] Task 5: daemon 侧接线
  - [x] 5.1 **分配时机**：新建任务时 cwd 记为「待分配」（不建目录）；
        首次真正建会话宿主时用 `createSessionDir(getEffectiveWorkspaceRoot())`
        分配目录并作为会话 cwd（`applyWorkspace("")` 的「临时任务」映射同步退役）
  - [x] 5.2 **归属判定**：`isTempCwd` 改为形态判定（basename 命中
        `isAutoSessionDirName` / 等于历史共享临时目录 / 等于生效根本身 /
        旧 playground 占位目录），不再比对「当前生效根」；有显示名覆盖的走空间区
  - [x] 5.3 **转正改 rename**：`saveToWorkspace` 由「新建命名目录 + 切 cwd」改为
        「同根下 rename 该任务的自动目录 → 成功后 rewrite header cwd → 重建宿主」；
        名称校验沿用现有 `validateDisplayName`（siblings 含根下现有子目录名）；
        rename 失败（占用/权限）响亮报错且不改动任何状态
  - [x] 5.4 **reveal 校验放宽**：`workspaceReveal` 从「必须是已知工作空间」放宽为
        「已知工作空间 或 任一已知会话的 cwd」（否则任务区的时间戳目录打不开）
  - [x] 5.5 单测：分配（首次执行分配、未执行不建目录、切了工作空间则不分配）、
        判定（各形态命中 + 显示名覆盖走空间区）、转正（成功 rename、失败不动、
        同名冲突拒绝）、reveal（任务 cwd 通过、未知路径仍拒）
  - [x] 5.6 验证：`npm run typecheck && npx vitest run src/daemon`

## 收尾

- [x] Task 6: 全量验证 + 文档
  - [x] 6.1 `npm run typecheck && npm run check:deps && npm test` 全绿
  - [x] 6.2 `docs/workbuddy对齐清单.md` 更新（任务目录模型一栏写明已对齐；
        同时更正旧 spec 遗留的「临时任务 = 共享 Claw 目录」表述）
  - [x] 6.3 `.trae/specs/align-temp-task-workspace-model/spec.md` 顶部加一行更正说明，
        指向本 spec（避免后人再被旧结论误导）

- [x] Task 7: 选择器副作用收口（实施中发现，验收前补）
  - [x] 7.1 工作空间选择器的候选列表不得把「每个任务的自动目录」当成可切换的工作空间：
        `workspaceSnapshot` 过滤掉目录名命中 `isAutoSessionDirName` 的项与历史共享
        `<根>/临时任务`（WorkBuddy 同款：picker 用 `isManualWorkspaceCwd` 过滤掉
        `SESSION_DEFAULT` 形态的目录）
  - [x] 7.2 chip 显示：cwd 为自动目录时仍显示「临时任务」（自动目录的语义就是
        「没选工作空间」），不要退化成一串时间戳；tooltip 仍给全路径
  - [x] 7.3 `workspace-picker.tsx` 里「临时任务的 cwd 是 `<根>/临时任务`」的过时
        注释同步更新
  - [x] 7.4 单测：快照过滤（自动目录不进候选、转正后的命名目录仍进）；
        验证 `npm run typecheck && npx vitest run src/daemon src/renderer`

## 实施中额外发现并修复（属 5.1 引入的连带回归，验收前收口）

- [x] 空 cwd（待分配）被当相对路径误解析：`readMcpConfig("")` / `listPromptTemplates("")` /
      记忆段 / 产物读取与 stat 都会落到 daemon 进程 cwd（应用目录）。已抽
      `src/daemon/session-cwd-reads.ts` 收口：读产物时响亮报错（「还没有工作目录」），
      其余返回空语义；并保留用户级 MCP 配置与全局补全模板（空 cwd 只表示「无项目级」）

# Task Dependencies

- Task 1 与 Task 2 可并行（不同文件）
- Task 3 / Task 4 依赖 Task 1（同一份命名与判定契约），彼此文件不重叠可并行
- Task 5 依赖 Task 1 / 3（分配要用到创建函数与判定），且集中改 `daemon/index.ts`
- Task 6 / Task 7 依赖全部
