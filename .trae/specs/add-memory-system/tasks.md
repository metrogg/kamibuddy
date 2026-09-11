# Tasks

## 波一 · 记忆文件层 + 注入 + 权限白名单（单代理：core/extensions/resources）

- [x] Task 1: 三层文件约定 + memory.ts + compose 注入 + 权限白名单
  - [x] 1.1 `src/core/memory.ts` + 测试（9 例）：三层路径函数 + `buildMemorySection(cwd)`
    （L2 全文 + 画像全文 + L3 笔记全文 + 近 3 个日志文件名清单；单份失败降级、
    全空 undefined）
  - [x] 1.2 `resources/prompts/memory-system.md`（自创）：三层说明 + 写入纪律 +
    检索策略 + 边界（不存密钥/不替代交付）
  - [x] 1.3 `prompt-composer.ts`：记忆说明段（固定）+ 内容段（空则零 token），
    位序骨架后人格段前；记忆段在残留槽位检查后注入（用户 MEMORY.md 里的 {{...}}
    不炸组装）；daemon 与 prompt:preview 同源
  - [x] 1.4 `permission-policy.ts`：阶段 0 记忆白名单（isMemoryPath：MEMORY.md/
    PROFILE.md/`<cwd>/.kamibuddy/memory/**`，只限文件工具、shell 不借道）+ 7 用例
  - [x] 1.5 验证：`npm run typecheck && npm run check:deps && npx vitest run src/core src/extensions`

## 波二 · 并行（契约已锁定，文件零交集）

- [x] Task 2: conversation_search 工具（extensions/daemon）
  - [x] 2.1 `src/extensions/conversation-search-tool.ts` + 8 用例：query/limit schema、
    无命中引导文案、结果格式（ConversationSearchHit 放 shared/session-events.ts）
  - [x] 2.2 `src/daemon/conversation-search.ts`：自实现扫描（不走 SessionManager.listAll
    ——它无上限且丢条目边界；readdir+mtime 倒序截最近 200 个）、AND 分词、
    每会话 1 条取最早命中、片段前后 ~200 字符、排除当前会话；deriveSessionTitle
    抽取共用（消除 index.ts 重复实现）；run 会话不注册（独立扩展列表天然不含）
  - [x] 2.3 四模式白名单加 conversation_search；权限门 READ_ONLY 放行（三档测试）；
    工具卡「检索中/已检索」
  - [x] 2.4 验证：`npm run typecheck && npx vitest run src/extensions src/daemon src/shared`

- [x] Task 3: 内置蒸馏任务 + preferences toggle（daemon/core）
  - [x] 3.1 `src/core/automation-store.ts`：AutomationTask 加 `builtin?: boolean`
    （旧文件兼容）；remove 拒 builtin（响亮报错）+ 3 用例
  - [x] 3.2 `src/core/builtin-memory-task.ts`（新 + 6 用例）：固定 id
    `builtin-memory-distill`、daily 03:00、cwd=configDir、自创蒸馏 prompt；
    ensure 只对齐 status 不覆盖用户改动；daemon 启动 ensure（scheduler.start 前）；
    preferences.memoryEnabled（默认 true）+ get/setMemoryEnabled IPC；
    `AutomationEvent.runFinished` 带可选 builtin 标记（renderer 抑制留给 Task 4）；
    权限门阶段 1 加 sessions/ 只读例外（写仍拒，SessionManager 唯一写者）
  - [x] 3.3 验证：`npm run typecheck && npx vitest run src/core src/daemon src/shared`

## 波三 · 设置页（依赖波二的 toggle 与画像 IPC 契约）

- [x] Task 4: 设置页「记忆」分区 + 画像 IPC（renderer + shared）
  - [x] 4.1 `src/shared/ipc.ts`：getProfile/setProfile/resetProfile/importProfile
    四通道；importProfile 由 **main 本地应答**（daemon 不 import electron 弹不了
    对话框；写入仍走 daemon setProfile——main「不解释 payload」边界不破）
  - [x] 4.2 `settings-view.tsx` MemorySection：toggle（乐观更新+失败回滚）+
    画像 textarea（变化才可保存）+ 重置（二次确认）+ 导入（取消静默）
  - [x] 4.3 内置收口：App.tsx runFinished 的 builtin===true 跳过 toast/未读；
    automations-view「内置」徽标 + 编辑/删除禁用（启停可用）
  - [x] 4.4 验证：`npm run typecheck && npm run check:deps && npx vitest run src/renderer src/shared`

## 收尾

- [x] Task 5: 全量验证 + 文档
  - [x] 5.1 `npm run typecheck && npm run check:deps && npm test` 全绿（1336 用例 + smoke 10/10）
  - [x] 5.2 `docs/workbuddy对齐清单.md` J1-J6/C14/F9 行更新状态；`docs/ARCHITECTURE.md`
    §4.9 决策记录（三层记忆 + 本地画像蒸馏 + 权限白名单边界）

# Task Dependencies

- Task 2/3 依赖 Task 1（路径约定与权限白名单语义），互不冲突可并行
- Task 4 依赖 Task 3（memoryEnabled 与画像 IPC）
- Task 5 依赖全部前置任务
