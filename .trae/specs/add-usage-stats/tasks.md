# Tasks

- [x] Task 1: 契约与热力图网格（shared）
  - [x] SubTask 1.1: `src/shared/usage-stats.ts`：`UsageStats` 与全部子结构类型
        （含 `emptyUsageStats()`），字段注释写清口径（子代理排除、legacy 跳过、
        token 含缓存、工具多一个 errors）
  - [x] SubTask 1.2: `buildHeatmapWeeks(daily, options)` 纯函数：周 × 日网格、
        `weeks = clamp(width-8, 10, 52)`、首列对齐、未来格留空、
        4 档等级（`getActivityLevel` 同口径）+ 月度标签 + 日期矩阵（悬停提示用）
  - [x] SubTask 1.3: `usage-stats.test.ts`：等级边界（0 / .25 / .5 / .75 / 1）、
        未来日期不着色、网格尺寸与首列对齐、月度标签落在正确列、日期矩阵同形
- [x] Task 2: 跨会话聚合（daemon）
  - [x] SubTask 2.1: `src/daemon/usage-stats.ts`：`parseSessionFile(content)` 逐行解析
        （坏行跳过）→ `ParsedSession`（会话 id / 是否子代理 / 消息时刻与 model /
        usage / 工具名与失败）
  - [x] SubTask 2.2: `aggregateUsageStats(sessions, {now})` 纯函数：按日归集、按模型归集、
        按工具归集、连续天数、峰值时段、最长/平均会话、首末时刻
  - [x] SubTask 2.3: `readUsageStats(sessionsDir, report?, options)`：列目录 → 限并发读文件
        （mtime 缓存只重解析改动过的）→ 聚合；目录不存在返回空统计（正常态）；
        单文件失败跳过并上报
  - [x] SubTask 2.4: `usage-stats.test.ts`：子代理口径（会话维度排除、token 照算）、
        legacy 会话跳过、坏文件/非 JSONL 跳过、连续天数（今天断 = 0）、峰值时段、
        工具失败配对、模型归集与用量合计、空目录、mtime 缓存
- [x] Task 3: 接线（IPC）
  - [x] SubTask 3.1: `shared/ipc.ts`：`INVOKE.usageStats = "stats:usage"` + 调用签名表一行
  - [x] SubTask 3.2: `preload/index.ts` + `shared/bridge.ts`：暴露 `usageStats()`
  - [x] SubTask 3.3: `daemon/index.ts`：handler 走 `readUsageStats(getSessionsDir(), report)`
        （上报接 `eventLog.append({kind:"usage_stats_error"})`）
- [x] Task 4: 统计页（renderer）
  - [x] SubTask 4.1: `renderer/stats-view.tsx`：页面骨架（`settings` / `settings-head`
        / `IconBack`），概览数字条复用 `stat-grid` / `stat-card`
  - [x] SubTask 4.2: 热力图区块（网格 + 「少 → 多」图例 + 月度标签 + 悬停显示当天条数，
        用 shared 的网格函数）
  - [x] SubTask 4.3: 每日 token 趋势（SVG 折线，无第三方图表库）+ 模型明细表 +
        工具排行表；空态文案
  - [x] SubTask 4.4: `App.tsx` 的 `View` 联合加 `"stats"`、路由与返回栈；
        `sidebar.tsx` 加入口 + `icons.tsx` 加 `IconStats`
  - [x] SubTask 4.5: `index.css`：热力图格子与图例样式（`color-mix` 从 `--accent` 派生，
        带十六进制兜底）
- [x] Task 5: 收尾验证
  - [x] SubTask 5.1: `npm run typecheck && npm run check:deps && npm test` 全绿
        （91 文件 / 1646 测试通过，含新增 31 条）；`electron-vite build` 通过
  - [ ] SubTask 5.2: `npm run dev` 手验：统计页出数、热力图与图例正常、空态正常
        —— **待用户手验**（本环境起不了 Electron 界面）
  - [x] SubTask 5.3: 对齐清单 L16 行与 `docs/可观测性清单.md` VIEW9 行更新为已落地

# Task Dependencies

- Task 2 依赖 Task 1（契约与网格先行）
- Task 3 依赖 Task 2（handler 要聚合函数）
- Task 4 依赖 Task 1 + Task 3（网格函数与通道都在了）
- Task 5 依赖全部
