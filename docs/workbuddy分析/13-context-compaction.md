# WorkBuddy 上下文压缩（Compaction）机制逆向笔记

调研日期：2026-09-16 ｜ 版本：5.5.6 解包产物
证据：`app.asar.unpacked/cli/dist/codebuddy.js`（22MB CLI 大包，unpacked 可直接读）
+ 官方文档 `cli/dist/web-ui/docs/cn/cli/{costs,env-vars,cli-reference,slash-commands,best-practices}.md`

## 一句话结论

**自动 + 手动都有，自动还分三档**。压缩类型枚举（codebuddy.js @7870505 原文）：

```js
!function(eA){eA.USER_COMMAND="user-command",
eA.PRE_MESSAGE_AUTO="pre-message-auto",
eA.EMERGENCY_AUTO="emergency-auto"}(eu||(eu={}))
```

- `USER_COMMAND`：手动 `/compact [自定义指令]`（slash-commands.md：「/compact ✅ 压缩上下文」）
- `PRE_MESSAGE_AUTO`：用户发消息**前**预检压缩
- `EMERGENCY_AUTO`：请求前发现塞不下时的紧急压缩

## 1. 触发档位（checkAutoCompact，codebuddy.js @7233595）

每轮后检查 `shouldCompact()`：

- **blocking**（input + max_tokens 会超出窗口）→ **同步** `compactAndSummarize({force, type: EMERGENCY_AUTO})`，压完才发请求；
- 非阻塞 → `setImmediate(async () => compactAndSummarize(...EMERGENCY_AUTO))` —— **后台异步**，不挡当前回答（文档 costs.md「异步压缩策略：后台执行、无缝衔接」）。

## 2. Pre-message 压缩（@7086414，最有特色的一档）

处理用户新消息**之前**：取最近 usage 的 inputTokens，与 triggerAt 比较，超了就先压缩（`PRE_MESSAGE_AUTO, skipContinue:!0`）。

- 阈值解析链（原文）：`per-session meta preMessageCompactPct → env CODEBUDDY_PRE_MESSAGE_COMPACT_PCT → 产品配置 tokenUsageThresholds.inputTokens.preMessage ?? .8`（代码缺省 **0.8**；env-vars.md 写「默认 10%」与代码不符，以代码为准，文档疑似写错或指另一口径）；`0 === ed` 显式关闭。
- **防退化摘要守卫**（原文注释）：`Skipping: no meaningful new content since last compact (would produce a degenerate summary, see issue #34798)` —— 距上次压缩没有实质新内容就跳过，不产空摘要。
- 失败降级：`compactAndSummarize returned false; forwarding original input to normal model request` —— 压缩失败照常发原请求（后面还有 PTL fallback 兜底）。
- 用户中途 abort：不转发 LLM，把失败 surfacing 出来。

## 3. 预算与阈值计算（@7869316-7869721）

- 有效预算 `resolveEffectiveContextBudget`：per-session `overrideContextWindow` → 模型 `contextWindow.defaultLength` → `supportedLengths[0]` → `maxInputTokens`（都要在 supportedLengths 白名单内）。
- 触发点 `resolveCompactTriggerAt(budget, pct, autoCompactWindow)` = `min(autoCompactWindow, budget) × pct`；autocompact window clamp 到 **[100k, 1M]**（`--autocompact 400k`、settings `autoCompactWindow`、env `CODEBUDDY_AUTO_COMPACT_WINDOW`，env > settings）。
- autocompact 百分比缺省 **0.7**（模块常量 `eE=.7`；env `CODEBUDDY_AUTOCOMPACT_PCT_OVERRIDE` 1-100）。`eC=.5` 为另一常量（用途未定，疑与工程压缩相关）。
- 工程压缩充分比 `CODEBUDDY_ENGINEERING_COMPACT_SUFFICIENCY_PCT` 缺省 0.15。
- `/context` 展示里有 `⛶ Free space` 与 `⛝ Autocompact buffer: N tokens (P%)`（costs.md 配图同款）。

## 4. 异步衔接与身份

- 会话 meta 键：`compactType` / `compactExpectsContinue` / `compactContinueInProgress` / `preMessageCompactEnded`；消息 meta：`codebuddy.ai/compact-cancelled`、`codebuddy.ai/compact-limit-reached`、`codebuddy.ai/isCompactInternal`。
- **compact generation**（`withCompactGeneration`）：消息 id 追加 `-c${n}` 代数后缀 —— 压缩后继续的流式 chunk 归到新一代消息，UI 不串代。
- ACP 转发层把 `isCompactInternal` 的内部 user 消息吞掉不转发（`compactInProgress / sub-agent / postCompactContinue` 三种跳过原因）—— 压缩摘要请求对用户不可见，不算用户轮次。
- 压缩完成后的「继续」：`compactExpectsContinue` + `postCompactContinue` —— 异步压完后会话自动续跑。

## 5. 自定义保留内容（手动控制粒度）

- `/compact <指令>`：`/compact Focus on code samples and API usage`（best-practices.md）。
- `CODEBUDDY.md` 里写 `# Compact instructions` 段，全局生效。
- 保留内容（costs.md）：代码变更记录、重要决策点、用户明确的偏好和指示、当前任务关键上下文。
- Hook：`PreCompact`（hooks-guide.md）——压缩前可注入。

## 6. 桌面端入口

- preload 暴露 `compact` bridge 方法（`{ key: "compact", mode: "async", bridgeAuto: true }`）—— 桌面 UI 有手动压缩调用路径；
- `ConversationEvent.TimelineEvent` 承载「compact / session boundary 等非 Request 时间线事实」—— 压缩在时间线里作为一等事件展示。
- env `CODEBUDDY_PRE_MESSAGE_COMPACT` 强制开关（true/false/0/1，优先级最高）。

## 7. 与我们（pi 基座 / KamiBuddy）的对照

pi 的压缩是**单档被动式**：`compaction{reserveTokens 16384, keepRecentTokens 20000}` —— 下一轮塞不下才压，无 pre-message 预检、无紧急/后台分档、无压缩代数。WorkBuddy 比 pi 多出的核心思想：

1. **三档触发**（手动 / 消息前预检 / 紧急阻塞），阈值全部可配置且有缺省链；
2. **后台异步 + 压缩后代数**：压缩不挡回答，靠 `-cN` 消息代数保证流式不串；
3. **防退化守卫**：距上次压缩无新实质内容就跳过（否则会产出空洞摘要反而丢信息）；
4. **失败不致命**：压缩失败降级为原样转发，另有 PTL fallback。

值得抄的最小集：pre-message 预检 + 防退化守卫 + 「压缩失败不致命」；压缩代数在我们没有异步压缩时暂不需要。
