# Tasks

- [x] Task 1: prompt-composer 环境块注入
  - [x] 1.1 `src/core/prompt-composer.ts`：`ComposePromptInput` 加 `now?: Date`（默认 `new Date()`）；新格式化函数（Intl 实现：本地时间分钟级 + 星期 + timeZone + GMT 偏移，文字自创）；组装结果末尾追加运行时环境块（在 appendPiContext 的 sections 之后或作为其一个 section，选对 prompt 缓存最稳的位置——末尾）；分钟级精度的缓存取舍写注释
  - [x] 1.2 `prompt-composer.test.ts`：固定 `now` 断言环境块文本（含日期/星期/时区/GMT 偏移）、now 缺省时用当前时间、残留槽位抛错与空技能压平等既有行为不破
- [x] Task 2: 调用链确认与回归
  - [x] 2.1 读 session-host.ts 的 compose 调用链：确认每轮 before_agent_start 都会走到 composePrompt（新 run 新时间）；若调用处需显式传 now 则接上（结论：composePrompt 唯一生产调用在 daemon composeSystemPrompt，before_agent_start 每轮现调，无缓存——零改动成立）
  - [x] 2.2 `npm run typecheck && npm run check:deps && npm test` 全绿（739 个测试）
  - [ ] 2.3 冒烟（用户重启后）：新建任务问「现在几点了」，模型答出当前日期/星期/时分/时区

# Task Dependencies

- Task 2 依赖 Task 1（composer 先行）
