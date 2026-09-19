# KamiBuddy 项目长期笔记

## 判断进度的正确方式

- **`.trae/specs/<feature>/{spec.md,tasks.md,checklist.md}` 的勾选状态不可信。**
  多会话并行开发留下大量「代码已提交但 checkbox 未回勾」的项（约 20 个 spec）。
  判断某能力是否落地，**看 `src/` 里有没有对应文件**，不要信勾选。
- **README 会落后于代码**（例：README 说 docx 未开工，实际已落地）。
  以 `docs/ARCHITECTURE.md` 的决策记录 + 代码为准。
- 命名并存：界面显示名「嘉立创Work」/ 仓库名与代号「KamiBuddy」。

## 可观测性（2026-09-14 盘点，09-16 补展示层分工）

- 三层结构：记录层（`logs/runs/<sessionId>.jsonl` 台账 + `logs/events-*.jsonl` 事件日志
  + pi 会话 JSONL）→ 投影层（`ObservabilitySnapshot`，daemon 算）→ 展示层。
- **展示层三页各管一个粒度，别再互相塞**（2026-09-15 重排）：
  统计页 = 跨会话宏观（热力图 / 排行 / 费用）；诊断页 = 机器级环境自检（热键 / venv /
  观测健康）；**任务诊断面板 = 单任务微观**（右侧栏第三态，`task-diagnostics-panel.tsx`，
  跟随会话、切会话不关）。重排前这三件事挤在同一个「诊断」页里。
- **不双写纪律**：消息正文只在会话 JSONL 落一份，台账只记 pi 不记的
  （计时 / TTFT / 重试 / 快照 / 队列）。改动记录层前先读 `core/run-ledger.ts` 文件头纪律。
- 两套计时口径并存且**不许混**：台账工具计时 = 执行期；流式卡片 = 生成期上屏。
- 两个 token 口径并存且**不许混**：`getContextUsage()` 是精确值（圆环用）；
  分类拆分是字符数估算（必须标「估算」、数字前加 `~`）。
- **「上下文」在界面里也出现两次且不许混**：面板 ② = **现在**（实时 used/total +
  分类估算）；面板 ④ = **当时**（`request_snapshot` 的冻结快照）。两处文案各带标注。
- 专项清单：`docs/可观测性清单.md`（84 条，八段：LOG/CTX/CACHE/PERF/TOOL/AGG/VIEW/OPS）。
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
- **`npx` 在本会话不可靠**（`npx vitest` 会牵扯被安全策略拦的 `wsl.exe`，输出乱码）。
  一律直呼本地入口：vitest → `node node_modules/vitest/vitest.mjs run [file]`、
  tsc → `node node_modules/typescript/lib/tsc.js --noEmit`、
  tsx → `node node_modules/tsx/dist/cli.mjs <script>`、
  electron-vite → `node node_modules/electron-vite/bin/electron-vite.js build`。
- **逆向 WorkBuddy 大包（22MB `codebuddy.js`）不要用 grep**：minified 长行会被
  Grep 工具整个吞成 `[Omitted long matching line]`。写个临时 node 脚本
  `indexOf` + `slice` 打印上下文，查完删掉。

## 运行时的「两套数据源」（2026-09-14 定）

同一个会话有两份可读记录，**按用途选，别混**：

- **会话 JSONL**（`~/.kamibuddy/sessions/*.jsonl`）：消息正文 + 按条的
  `model` / `usage` / `timestamp`。**跨会话的历史事实看这里**（覆盖全历史，
  含早于台账存在的旧会话）。检索、使用统计都读它。
- **运行台账**（`logs/runs/<sessionId>.jsonl`）：只有 pi 不记的
  （计时 / TTFT / 重试 / 请求快照 / 队列 / run 边界），**没有**按条的 model 与 usage。
- **事件日志**（`logs/events-YYYY-MM-DD.jsonl`）：daemon 的全量 SessionEvent 落盘，
  `sanitizeForLog` 把 delta 类字段收成长度。**体积是已知风险**：单日 5.3 万条 / 38 MB，
  主因是 `tool_stream_progress`（参数生成期逐 delta 进度）的**条数**而非单条大小 ——
  收掉累积 `rawArgs` 后仍约 22 MB/日。无轮转、无清理、界面也不显示它
  （清单 LOG18 已从 ⛔ 改判 ❌、OPS1 严重度上调，2026-09-15）。

## 使用统计（spec add-usage-stats，2026-09-14）

- 统计页 `renderer/stats-view.tsx` ← `daemon/usage-stats.ts` ← 会话 JSONL；
  契约与热力图网格纯函数在 `shared/usage-stats.ts`（网格必须单源，两端不许各算一份）。
- 对标对象 WorkBuddy 的 `/stats` 是 **CLI TUI 面板 + HTTP API**，**桌面端没有这个界面**；
  逆向证据表在 `.trae/specs/add-usage-stats/spec.md`（别再重查一遍）。
- 会计口径的关键不对称：子代理会话从会话维度排除，但**它的 token/费用照算**。

## 设置页与配置层（2026-09-14 调研）

- 现状：6 分区（通用/个性化/记忆与进化/模型/提示词预览/关于）约 20 键，
  存 `~/.kamibuddy/preferences.json`（`core/preferences.ts`）。
- **加一个配置键的成本 = 6 处文件 + 2 个 IPC 通道**：每个键手写一对专用通道
  （`getStyle/setStyle` 等，`shared/ipc.ts` 里已 20+ 个），加键要动
  preferences.ts → ipc.ts → preload → bridge → daemon handler → UI。
  **AGENTS.md §5 承诺的 `config.get(key)` 单一入口未落地** —— 任何「批量加配置项」
  的前置都是先补它（配置注册表 + `config:snapshot`/`config:patch`）。
- WorkBuddy 桌面设置 = 4 组 15 项（通用:设置/账户/订阅用量/外观/快捷键 ｜
  功能:个性化/记忆/扩展/模型/Claw ｜ 数据与安全:数据管理/安全中心/系统权限/软件配置 ｜ 关于）。
  实现在 `ui-docs-viewer-*.js` 的 `SettingsNavigation`，`filteredNavItems` 按
  feature flag 过滤显隐。CLI 侧 `settings.json` 约 40 键，官方文档在同名 `settings.md`。
- **pi 已有整套配置白放着**：`settings-manager.ts` 的 `compaction{reserveTokens 16384,
  keepRecentTokens 20000}`、`retry{maxRetries 3, baseDelayMs 2000}`、
  `showCacheMissNotices`、`hideThinkingBlock`、`images.blockImages`、`steeringMode`…
  `session-host.ts:525` 已 `SettingsManager.create()`，只是没接到 UI。
- **完全没有**：网络代理、会话保留期批清理、手动主题切换、快捷键、子代理模型映射。

## 界面约定与截图核对（2026-09-16）

- **用户贴的截图要先定性是哪个应用**，别靠肉眼看品牌字：
  四个我们仓库里**不存在**的串只在真 WorkBuddy 里出现 —— `发现应用`、`Buddy加油站`、
  `5.5.6`、品牌名 `WorkBuddy`。我们的是 `嘉立创Work` / `V0.1.0`
  （`src/renderer/index.html` 的 `<title>` 是权威处）。
- **界面语言跟自家，不跟 WorkBuddy**（用户认可抄机制，不是抄像素）：本项目所有菜单
  （model / permission / plus / space / 任务行 ⋯）都是**纯文字条目 + 右侧对勾**，
  WorkBuddy 那套带前置图标 —— 遇分歧以自家语言为准。
- **让位内边距一律四值分写**（`top right bottom left`）：写简写 `padding: X 84px` 会把
  左侧也抬到 84，行首控件凭空右移（2026-09-16 在 `.chat-header` 上踩过一次）。
  算让位时顺手 grep 同类名，把「跟着控件宽度走的算式」一起改。

## 专家团（agent-team）：产出走「拉」，不走「推」（2026-09-19 架构调整，§4.19）

**现状（不要再按推模式理解团队产出）**：成员产出**永远只存在**于
`~/.kamibuddy/sessions/<文件时间戳>_<memberSessionId>.jsonl`（**pi 的文件名带时间戳前缀**，
不是 `<id>.jsonl` —— 2026-09-19 修正，按裸 id 拼路径会让整条拉模式静默失效），
领导用 **`team_read`** 主动取回。
**没有任何回投/推送机制** —— 整套推模式协议（2026-09-19 批次 ④）已删除：
`pendingDelivery` / `markPendingDelivery` / `markDeliveryPending` / `confirmDelivery` /
`clearPendingDelivery` / `deliveryAwaiting` / `queue_changed` 销账钩子。

- 「有没有产出」= **从文件派生**的 `outputAvailable`（`readMemberTranscriptView`），
  **不是**注册表标记。派生函数单源，`getTeamState` 与 `emitTeamProgress` 都调它，不许各算一份。
- 成员状态**派生优先**（`restoreTeam` 注入 `deriveStatus`）：completed → closed /
  killed → interrupted / failed → failed；派生不出才回落到落盘 status 字面量。
- `settleRunningMembers` 三条不变量（抄自 WorkBuddy `settleAllRunning`）：
  只动 running；**运行时 idle 不触发**（领导跑完一轮 ≠ 成员停了）；
  父 `{terminated,error,failed}` 才强制收敛。接线在 `run_error` 与
  「被取消的 `run_finished`」上。
- 权威来源：`.trae/specs/add-team-pull-model/spec.md` + `docs/ARCHITECTURE.md` §4.19。
  旧 spec `add-team-interrupt-diagnostics` 的**批次 ③ 已被取代**（其余仍有效）。

**为什么改（别走回头路）**：三次复现「团队没人接了」三个根因，逐个修都没修住 ⇒
根因在问题形状 —— 推模式要求「送进领导上下文」成功，而 pi 的 `followUp()` 是
**入队即 resolve**，链上**不存在「投递成功」这个事实**。给不可观测的事件设计记账
协议怎么设计都是猜。WorkBuddy 实测 `followUp`/`deliverSessionMessage` 命中数 **0**，
它压根没有回投。

## 专家团（agent-team）生命周期纪律（2026-09-19，两次现网复现后定）

症状一句话：**团队成员跑完了、状态也更新了，但领导收不到产出，整个团从此「所有人都没动静」。**

- **根因是「同步的先落盘、异步的最后丢」。**
  `hooks.onComplete` 里的顺序是 ①`markStatus` ②`emitTeamProgress` ③`deliverSessionMessage`。
  ①② 同步 → 已落盘（所以重启后能看到 `已完成 N 轮`）；③ 是**异步**且历史上被 `void` 掉
  （`enqueue` → `host.prompt` → 写会话文件，不参与生命周期）→ 进程一死就**静默丢失**。
  两次复现的事件日志都停在 ② 与 ③ 之间。
- **铁律：生命周期敏感路径上的异步操作不许 `void`。** 团队回投（`deliverSessionMessage`）
  必须是被 `await` 的、且在 `hooks.onComplete`/`onFailed` 的签名里被允许返回 Promise
  （`=> void | Promise<void>`，`member-runner.ts` 的 `.then()` 相应改 `async` 回调）。
  同理 `onComplete` 自身也是 `async`。
- **先留痕，再投递。** `markPendingDelivery()` 必须在 `deliverSessionMessage()` **之前**调用，
  `finally` 里 `clearPendingDelivery()`。这样「产出还没送达」这个事实先于投递落盘：
  进程死在投递中就留下痕迹（可去会话 JSONL 捞回），投递成功才抹掉。
- **`pendingDelivery` ≠ `interrupted`，别混**：`interrupted` 说「它当时在跑」（要重跑）；
  `pendingDelivery` 说「它跑完了、产出在会话 JSONL 里、只是没送达」（可去捞）。
  状态仍是 `closed`/`interrupted`，但 UI 文案与摘要行优先级要**产出待捞 > 中断 > 工作中 > 平静**。
- **只存标记不存正文**（遵守不双写纪律）：`pendingDelivery: boolean` + `pendingDeliveryTurns`，
  **不要**把产出正文塞进注册表/落盘文件。
- ⚠️ **`TeamMember.turns` 字段长期恒为 0，是假信号。** 接线层 `recordProgress(leaderId, name, 0, text)`
  第三参写死 0，而注册表是 `+=` → 永远 0。判断成员真跑了几轮，**看 `activity`（`已完成 N 轮`）**。
  轮数的权威来源已改为 `onComplete` 里的 `recordCompletion()`（**赋值**，绝对值，不是累加）。
  → 教训：**别用「字段为 0/为空」反推「某回调没跑」**，先去读那个字段是谁写的。
- 落盘/投影新增字段时，成员序列化（`persistTeam`）与投影（`emitTeamProgress`）**都要加**，
  且用条件展开（`...(x ? {x} : {})`），否则会搅动 `persistedFingerprint` 让「没变就不写」失效。

## 回投送达确认：`followUp()` 入队 ≠ 送达（2026-09-19 第三次复现后定）

**三次复现三个根因，别用一个解释套三次**（① `void` 掉回投 → ② 进程死在 ②/③ 之间 →
③ `await` 了入队即返回的 `followUp()`）。

- **pi 的 `followUp()` 是「入队即 resolve」**：`agent-session.js` 的 `_queueFollowUp`
  全程同步（`push` + `_emitQueueUpdate` + `agent.followUp`），不 await 任何东西。
  d.ts 注释：`Delivered only when agent has no more tool calls or steering messages.`
  → **`await host.prompt(·, "followUp")` 的 resolve 只代表入队成功，不是送达回执。**
- **`session-host.prompt` 返回 `{ queued: boolean }`**：`isStreaming` → `true`（只入队）；
  另两分支 → `false`（真起一轮、进上下文 = 已送达）。新增 `getFollowUpQueue()`
  透传 pi 的 `_followUpMessages`（补「入队早于登记」的竞态）。
- **消费时机 = `queue_changed`**：pi 在 `_handleAgentEvent` 里遇到
  `message_start` + `role === "user"` 时从 `_followUpMessages` `splice` 掉并 emit
  `queue_update`（`session-host.ts` 折成 `queue_changed`）。**「不在队列里了」与消费同刻。**
- **两拍判据（必须）**：`team-runtime` 的 `deliveryAwaiting` + `markDeliveryPending` /
  `confirmDelivery` —— **① 见过它在队列里（`seen`）② 然后它消失** 才销账。
  「不在队列里」≠「已送达」：也可能是从没进过队列 / 被 `clearQueue()` 丢掉 /
  队列里是别的消息（`clearQueue()` 是另一条丢失路径）。
- **教训：失败路径上不要急着擦痕迹。** `finally { clearPendingDelivery() }` 在
  「操作本身不承诺结果」时是有害的 —— 它把「可能没送达」粉饰成「已送达」。
  痕迹该由**确凿的成功信号**擦，不由**流程走完**擦。

## 完成后必跑

`npm run typecheck && npm run check:deps && npm test`；改 `documents/` 必须跑 `npm test`。
另有门禁：`check:tokens`（设计令牌）、`check:model-experience`、`check:invariants`（模块不变量）、
`check:expert-assets`。全量 vitest 偶发 `src/core/doc-extract.test.ts` 超时抖动，与本类改动无关。
