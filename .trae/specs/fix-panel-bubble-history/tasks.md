# Tasks

- [x] Task 1: 右侧面板常态可展开（无文件也能开）
  - [x] 1.1 App.tsx：面板渲染条件从 `previewActive !== undefined && panelOpen` 改为 `panelOpen`；`artifacts_presented` 事件里 `panelOpen` 置 true（有交付自动展开）
  - [x] 1.2 artifact-panel.tsx：无激活项时的空态渲染（概览菜单可点开、主体区"选择文件以预览"占位；产物/变更分组无内容时显示"暂无"）
  - [x] 1.3 index.css：空态占位样式（三级灰居中）

- [x] Task 2: 用户气泡最大宽度对齐
  - [x] 2.1 index.css：`.user-bubble` 的 `max-width` 从 `calc(100% - 32px)` 改为 `70%`

- [x] Task 3: 历史会话产物恢复
  - [x] 3.1 session-host.ts：`artifacts_presented` 事件触发时，用 `session.sessionManager.appendCustomEntry("artifacts_presented", { files, focusFile })` 持久化产物清单
  - [x] 3.2 session-rebuild.ts：`buildConversationEntries` 处理 `type === "custom"` 且 `customType === "artifacts_presented"` 的条目，翻译成 `artifacts_presented` 事件进 out（reducer 折叠后即恢复产物清单）
  - [x] 3.3 补 vitest：custom 条目翻译成 artifacts_presented（session-rebuild.test.ts 缺失，并入 5.3）、多次交付去重（conversation.test.ts:379 已有）

- [x] Task 5: 恢复链路 artifacts 折叠修复（验证发现的断链：resume 后产物卡仍不显示）
  - [x] 5.1 shared/conversation.ts：新增导出纯函数 `artifactsFromEntries(entries)`——把 entries 中 `artifacts_presented` 条目按序 fold 进 `mergePresentedArtifacts`（at 用条目自带时间）；conversation.test.ts 补用例（无产物 → []、单条、多条同路径去重且后交付排末尾）
  - [x] 5.2 daemon/index.ts resume 路径（约 798-805 行）：`artifacts: []` 改为 `artifacts: artifactsFromEntries(rebuilt)`，并更新过时注释（"artifacts 属于旧会话，清空" → 产物清单从落盘 custom 条目恢复）
  - [x] 5.3 session-rebuild.test.ts：补 custom(artifacts_presented) 翻译用例（正常翻译 files/focusFile/at；data 缺 files 跳过；其他 customType 跳过——跳过侧已有覆盖可只补正向）

- [ ] Task 4: 回归验证
  - [x] 4.1 `npm run typecheck && npm run check:deps && npm test` 通过（455 个测试全绿）
  - [ ] 4.2 冒烟：无文件时面板可展开（空态）、用户气泡 70% 宽、历史会话回看产物卡还在（用户选择自行重启验证）

# Task Dependencies

- Task 1 的 1.2 依赖 1.1（渲染条件先行）；与 Task 2 文件交集小（App/artifact-panel vs index.css），可并行
- Task 3 的 3.2 依赖 3.1（持久化格式先行）；与 Task 1/2 文件交集小（core vs renderer），可并行
- Task 5 依赖 Task 3（持久化与翻译先行）；5.2 依赖 5.1（helper 先行）
- Task 4 依赖 Task 1-3、5 全部完成
