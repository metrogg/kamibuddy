# Tasks

- [x] Task 1: 纯函数层：把「已送达」判据从"扫会话正文"改成"账本入参"
  - [x] SubTask 1.1: `daemon/team-output-snapshot.ts` 改造：`composePendingTeamOutput` 的入参从
        `{ previous: string }`（会话正文全文）改为 `{ delivered: ReadonlySet<string> }`；
        返回 `{ text, fingerprints }`（本次写入的指纹，供调用方登记进账本）。
        **实施说明**：`delivered` 入参在 HEAD 上其实已存在，实际落地的是**返回类型加 `fingerprints`**
        与抽取函数改名收敛。
  - [x] SubTask 1.2: 删除 `collectFingerprintsIn`（会话正文扫描）与其单测；
        把「种子化」抽成独立纯函数 `collectFingerprintsFromSession(内容) → Set`（仍供
        daemon 首用时读文件），并保留它自己的单测。
  - [x] SubTask 1.3: 单测：三连跑收敛（第一次带产出 → 之后 `undefined`；**注意口径修正**：
        "无待送达产出 ⇒ 返回 undefined"是既有 pin 用例与 spec ADDED Requirement 的共同要求，
        "第二次只剩状态行"只发生在 run 起点快照通道 `composeTeamOutputSnapshot` 上，不在本函数）、
        同名成员不互相误杀、无产出时返回 undefined、账本已含指纹时不重复。
- [x] Task 2: 新增 `src/extensions/team-output-hook.ts`（任意工具结果的挂载点）
  - [x] SubTask 2.1: `pi.on("tool_result", (event, ctx) => …)`：调注入函数取块；
        无块 ⇒ 返回 `undefined`（零改动）；有块 ⇒ 只追加一个 text block 到 `event.content`
        末尾，`details`/`isError` 不碰。
  - [x] SubTask 2.2: 注入函数由外部注入（同 `prompt-switch` 的薄胶水做法），
        便于脱离宿主测；`event.toolName` 不设白名单（任意工具都要挂）。
  - [x] SubTask 2.3: 单测：无块 ⇒ `undefined`；有块 ⇒ 原 content 逐条不变 + 末尾多一条；
        `details` 与 `isError` 原样。
- [x] Task 3: daemon 侧接线（内存账本）
  - [x] SubTask 3.1: 新增内存账本 `deliveredTeamFingerprints: Map<leaderSessionId, Set<string>>`；
        首次使用时从领导会话文件种子化（走既有 `member-transcript` 的尾部读，≤512KB）。
        **复核修正**：种子只认 `type:"message"` ⇒ 只经快照通道送达的指纹重启后会**再送一次**
        （多送不会漏送）；已把两处过度声明改成带 caveat 的事实陈述。
  - [x] SubTask 3.2: 把「取待送达块」收敛成**唯一一个** daemon 局部函数，
        两个触发点（`tool_result` handler、run 起点快照）都调它；注入后登记指纹。
  - [x] SubTask 3.3: 删除 `team-tools.ts` 里的 `team_*` 工具结果包装层（`register()` 包装）
        与其相关测试；确认没有第二个挂载点残留。
  - [x] SubTask 3.4: run 起点通道的 `composeTeamOutput` 改为读账本（不再扫会话正文）。
- [x] Task 4: 装配与门禁
  - [x] SubTask 4.1: 在会话装配处注册 `team-output-hook`（**仅主/领导会话**；
        子代理、成员、定时任务会话不注册），注册顺序放在 `spill-hook` **之后**
        （避免产出块被算进超大输出判定）。顺序由一条源码序断言钉住，已验红。
  - [x] SubTask 4.2: `scripts/check-model-experience.ts` 契约同步：新增"改写工具结果"的扩展描述
        （现在会有一个以上扩展改写工具结果），并跑通门禁。
- [x] Task 5: 决策记录
  - [x] SubTask 5.1: 在 `ARCHITECTURE.md` 追加决策段（含 `## 否决方案`：①改用 `context` 每请求拼接
        —— 附 2026-09-18 实测 58,094 token / 28.8% 的证据；②保留 team_* 包装两处并存；
        ③不引入账本、继续每次扫会话正文，逐条写否掉理由）。→ 落为 §4.23
  - [x] SubTask 5.2: 在 `inject-team-output-snapshot/spec.md` 与 `§4.22` 标注"挂载点部分被取代"
        并互相链接（记录写完即冻结，只改状态与路径）。**实施说明**：该 spec 里没有"实施后修正"
        小节，标注落在文档顶部（标题之后）这一文档级位置。

# Task Dependencies

- Task 2 / Task 3 依赖 Task 1（注入函数的入参形态）
- Task 4 依赖 Task 2、Task 3
- Task 5 可与 Task 1~4 并行（只写文档）

# 验证（每个 Task 完成后跑，全量在最后）

```
node node_modules/typescript/bin/tsc --noEmit
node node_modules/tsx/dist/cli.mjs scripts/check-dependency-rules.ts
node node_modules/tsx/dist/cli.mjs scripts/check-design-tokens.ts
node node_modules/tsx/dist/cli.mjs scripts/check-model-experience.ts
node node_modules/tsx/dist/cli.mjs scripts/check-module-invariants.ts
node node_modules/vitest/vitest.mjs run
```

真机复验（由用户执行，本 change 的最终验收）：跑一次团队任务、**不要主动 `team_read`**，
然后确认 ① `team_read` 调用次数为 0；② 领导的**非 team 工具**结果里也出现了产出块；
③ 底部指标条的输入 token 与缓存命中率没有明显劣化。
