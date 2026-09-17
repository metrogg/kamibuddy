# Checklist

> 两处随路线作废的条目已订正：探针实测「发布版 pi 0.85.1 没有 sections/forceSystemPrompt 声明式分段路径」，
> 因此路线是**保持 forced 替换 + 保证系统提示词在同一会话内逐轮字节稳定**；原文「不再返回 systemPrompt」「断言不返回 systemPrompt」
> 两条钉子按此反向（改为「必须返回」），理由见 `tasks.md` Task 4.1。
>
> 2026-09-17 独立验证：**16 项全部 PASS**（验证者实跑 typecheck / check:deps / npm test、实跑探针复现读数、
> 并对两条核心钉子做了「改坏 → 变红 → 还原」实测）。

- [x] 系统提示词里不再出现分钟级的运行时间块（证据：`core/prompt-composer.ts:194-243` 无 time 字段；钉子 `prompt-composer.test.ts:181-193、210-224` 与 `prompt-switch.test.ts:383-384`）
- [x] 系统提示词里不再出现三层记忆内容段（证据：`daemon/index.ts:669-674` 的 `buildRuntimeContext` 是唯一消费点；`composeSystemPrompt` 只拿 `memorySystemBody` 行为纪律）
- [x] 系统提示词里不再出现个性化段（证据：`daemon/index.ts:646-654` → `buildRuntimeContext`，未传入 `composeSystemPrompt`）
- [x] 时间 / 记忆 / 个性化三段内容仍能送达模型（证据：`prompt-switch.ts:126-142` 追加在消息数组末尾；pi 侧 `messages.js:89-96` 把 `role:"custom"` 转成 user 消息进入请求；子代理路径有意为空并已注明）
- [x] 场景骨架里不再有 `当前工作目录：{{cwd}}` 行；用户会话的 cwd 只由 hidden context 的 `workspace_context` 提供（证据：`ComposePromptInput` 已无 cwd 入参；正侧 `session-host.test.ts:1754`、负侧 `prompt-switch.test.ts:379-380`）
- [x] 骨架若仍含 `{{cwd}}` 则组装响亮抛错（证据：`prompt-composer.ts:474-491` 槽位表只剩 interaction/skills；钉子 `prompt-composer.test.ts:63-70`）
- [x] `prompt-switch` 的 handler 仍返回 `systemPrompt`，存在单测断言它**必须**返回 —— 实测改坏会让它红（证据：`prompt-switch.ts:119-121`；钉子 `prompt-switch.test.ts:89-112`；改坏实测 8 failed，已还原）
- [x] 存在单测断言「同一会话连续两轮的系统提示词字节严格相等」，且人为改坏会让它红（证据：`prompt-switch.test.ts:305-387`，work/code × craft/ask/plan 共 6 例，第 371 行 `toBe`；改坏实测精确命中该断言）
- [x] 时间只有一个来源（hidden context 的 `current_time`），注入块内不含任何时间格式（证据：`formatRunTime` 仅 `hidden-context.ts:68` 定义、`session-host.ts:1747` 调用；钉子 `prompt-composer.test.ts:154-193`）
- [x] 设置页提示词预览与真实组装一致（证据：`prompt-preview.ts:96-106` 与 `index.ts:741-752` 同一 `composePromptWithMeta` 输入集；钉子 `prompt-preview.test.ts:94-110`。**弱证据**：门控是手工镜像、缺逐字节相等断言，已登记为漂移点）
- [x] 台账 `request_snapshot.systemSegments` 的分段口径已同步，不再出现长度随工作区变化的 skeleton 残段（证据：`prompt-composer.ts:272-280` 已删三个来源；`shared/ipc.ts:850-859` 镜像同步；`session-host.test.ts:1518-1521`）
- [x] `scripts/probe-prompt-cache.ts` 可复跑（`npm run probe:prompt-cache`），输出含每轮每步 prompt / cacheRead / hit%（验证者实跑 exit 0，输出 `轮 N 步 M: prompt=4728 cacheRead=2944 hit=62.3%`）
- [x] 探针读数已记录：提示词字节未变时命中 93.2%（复跑 94.1%），变更一处掉到 62.0%（基线 16% 来自更早断点的会话台账，原因已在 spec 结论④说明）
- [x] 「sections patch 在 DeepSeek 上语义是否成立」有明确结论（发布版 pi 无该路径；手写 delta 实测模型把中段 system 当增量），且路线选择与结论一致
- [x] `npm run typecheck && npm run check:deps && npm test` 全绿（唯一例外为既有基线 `src/sandbox/confinement.win.test.ts`，环境性、与本次改动无关）
- [x] `docs/` 已记录本次基线数据与「哪些内容禁止进系统提示词」的纪律（证据：`docs/可观测性清单.md:110` 新增 `CACHE8 | 提示词前缀稳定性`，`112-124` 记录基线与复跑口径）
