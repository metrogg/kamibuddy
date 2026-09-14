# KamiBuddy 项目长期笔记

## 判断进度的正确方式

- **`.trae/specs/<feature>/{spec.md,tasks.md,checklist.md}` 的勾选状态不可信。**
  多会话并行开发留下大量「代码已提交但 checkbox 未回勾」的项（约 20 个 spec）。
  判断某能力是否落地，**看 `src/` 里有没有对应文件**，不要信勾选。
- **README 会落后于代码**（例：README 说 docx 未开工，实际已落地）。
  以 `docs/ARCHITECTURE.md` 的决策记录 + 代码为准。
- 命名并存：界面显示名「嘉立创Work」/ 仓库名与代号「KamiBuddy」。

## 可观测性（2026-09-14 盘点）

- 三层结构：记录层（`logs/runs/<sessionId>.jsonl` 台账 + `logs/events-*.jsonl` 事件日志
  + pi 会话 JSONL）→ 投影层（`ObservabilitySnapshot`，daemon 算）→ 展示层（诊断页 /
  时间线 / 聊天指标条）。
- **不双写纪律**：消息正文只在会话 JSONL 落一份，台账只记 pi 不记的
  （计时 / TTFT / 重试 / 快照 / 队列）。改动记录层前先读 `core/run-ledger.ts` 文件头纪律。
- 两套计时口径并存且**不许混**：台账工具计时 = 执行期；流式卡片 = 生成期上屏。
- 两个 token 口径并存且**不许混**：`getContextUsage()` 是精确值（圆环用）；
  分类拆分是字符数估算（必须标「估算」、数字前加 `~`）。
- 专项清单：`docs/可观测性清单.md`（82 条，八段：LOG/CTX/CACHE/PERF/TOOL/AGG/VIEW/OPS）。
- 已知最大结构性缺口：**缺消息逐条稳定标识**，导致上下文增量 diff 与缓存命中
  前缀边界都算不出来。

## 环境坑（会浪费时间的）

- 本机 Git Bash 的 shim 环境**缺 coreutils**：`grep`/`sed`/`head`/`wc`/`ls`/`cat`/`cut`
  全部 `command not found`，`dirname` 也缺。**`git` 与 `node` 正常。**
  → 查文件列表用 Glob，查内容用 Grep 工具，跑脚本用 node，别指望 shell 管道。
- ⚠️ **致命陷阱：别把 `git` 输出接管道。** `git status --short | head -40` 因 `head`
  不存在而**静默返回空输出**，加上 `2>/dev/null` 后连错误一起吞掉、退出码还是 0，
  会让人误判成「工作区干净」（2026-09-14 实际踩过，当时有 50+ 文件未提交）。
  → `git status --porcelain`、`git log` 一律**裸跑**，不接任何管道。
- PowerShell 工具在本会话**不回传 stdout**，别用它取输出。
- 跑 Electron 必须用 `npm run dev` / `npm start`（包装脚本会剔除
  `ELECTRON_RUN_AS_NODE`），不要 `npx electron .`。

## 完成后必跑

`npm run typecheck && npm run check:deps && npm test`；改 `documents/` 必须跑 `npm test`。
