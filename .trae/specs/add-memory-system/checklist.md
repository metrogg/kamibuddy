# Checklist

## 三层记忆与注入

- [x] `~/.kamibuddy/MEMORY.md`（L2）、`<cwd>/.kamibuddy/memory/`（L3 日志+笔记）、
  `~/.kamibuddy/PROFILE.md`（画像）三层路径生效（memory.ts:24/29/34）
- [x] 系统提示词含记忆系统说明段（写入纪律+检索策略，自创文案——与 WorkBuddy
  原文比对无复制痕迹）
- [x] compose 注入 L2 全文 + 画像全文 + L3 笔记全文 + 近 3 天日志清单；全空零 token
  （prompt-composer.ts:217-225，50 用例）
- [x] 权限门：记忆文件白名单可写（阶段 0 isMemoryPath，只限文件工具、shell 不借道），
  应用目录其余文件仍禁写；凭据硬 deny 不变（98 用例）

## 内置蒸馏任务

- [x] 内置任务「记忆整理」存在（daily 03:00、固定 id、builtin 标记）；
  delete builtin 被拒（automation-store.ts:113）
- [x] memoryEnabled toggle 控制内置任务启停（默认 true，ensure 只对齐 status）
- [x] builtin 任务 run 完成不 toast、会话不标未读（App.tsx:316）；管理页可见
  （「内置」徽标 + 禁编辑/禁删除）

## 画像管理

- [x] 设置页「记忆」分区：toggle + 画像查看/编辑/重置/导入可用（settings-view.tsx:507）
- [x] 编辑/导入/重置经 IPC 落 PROFILE.md，下一轮对话生效
  （importProfile 由 main 本地应答，写走 daemon——main 不解释 payload 边界不破）

## conversation_search

- [x] 四模式白名单含 conversation_search；权限门放行（三档）
- [x] 关键词检索历史会话返回标题/日期/片段（AND 分词、mtime 倒序截 200、
  每会话 1 条、排除当前会话）；无命中给改法提示（20 用例）
- [x] run 会话不注册

## 工程验证

- [x] `npm run typecheck && npm run check:deps && npm test` 全绿（1336 用例 + smoke:permission 10/10）
- [x] `docs/workbuddy对齐清单.md`（J1-J6/C14/F9）与 `docs/ARCHITECTURE.md`（§4.9）已更新
