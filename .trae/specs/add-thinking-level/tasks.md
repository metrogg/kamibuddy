# Tasks

- [x] Task 1: pi 源码核对（只调研，结论写进对应代码注释）：确认 ① 可用档位的权威获取方式（`session.cycleThinkingLevel`/`thinkingLevelMap`/RPC `get_available_thinking_levels` 中哪个适合 host 内使用）；② `createAgentSession` 的 `thinkingLevel` 选项在 0.85.1 的确切签名与缺省行为（未传时是否读 settings）；③ `thinking_level_select` 事件在 AgentSessionEvent 流里的形状（host 适配层要不要翻译，还是靠 emitState 推权威值就够）。
- [x] Task 2: model-catalog 透传 `thinkingLevelMap`：自定义服务商模型定义原样带上 thinkingLevelMap 给 pi（实际落在 custom-providers.ts 的 upsert 白名单 + 按 id 继承——models.json 由 pi 直接读取，我们侧唯一丢失路径是设置页重建）；~~`ModelInfo` 增加模型可用档位列表~~（有意偏离：UI 只列当前模型档位，经 session state 下发，注释已说明）。含单测：声明 map 的模型透传一致、未声明的模型行为不变。
- [x] Task 3: SessionHost 档位桥：`create` 接受 `thinkingLevel` 注入 createAgentSession；新增 `setThinkingLevel(level)`（幂等，pi 内部钳制）；宿主权威 state（emitState）携带 `thinkingLevel` 与 `availableThinkingLevels`（切模型/切档位后重推）。含 session-host 单测。
- [x] Task 4: 契约与桥接：`SessionState` 增加 `thinkingLevel`、`availableThinkingLevels`（可选字段 + shared 的 `THINKING_LEVEL_LABELS`/`isThinkingLevel`）；`shared/ipc.ts` 增加 `INVOKE.setThinkingLevel` 与全局默认两通道 + preferences 的 `thinkingLevel` 键类型；`shared/bridge.ts` 与 `preload/index.ts` 补桥。
- [x] Task 5: daemon 接线：createHost 读 `preferences.thinkingLevel` 注入（仅全新会话；resume 不传保逐会话还原；桶内已选优先于全局默认）；`INVOKE.setThinkingLevel` handler 作用当前桶宿主（pristine 记桶内 state，建宿主带入——与 setScene 语义一致）；全局默认读写通道（不回溯既有会话）；automation-runner 与 subagent-runner 同口径注入（getThinkingLevel getter 模式）。
- [x] Task 6: UI：model-menu.tsx pill 加档位后缀（非推理模型不显示）；弹层加「推理强度」行 + 档位子菜单（宿主在只列可用档位，pristine 列全量七档，选中回写经桥接调 setThinkingLevel）；设置页加「默认推理强度」下拉；首页与对话页同组件同数据源，两处自洽。
- [x] Task 7: 验证与收尾：`npm run check && npm test` 全绿（984 测试）；`smoke:session` 14/14、`smoke:permission` 10/10；STATUS.md 增加推理强度小节（含 pi 语义：逐会话持久化、resume 还原、按模型裁剪）并恢复被并行线误删的 STATUS.md 本体；checklist 12/12 逐项验收通过。

# Task Dependencies

- Task 2/3/4 依赖 Task 1 的调研结论；Task 5 依赖 Task 3/4；Task 6 依赖 Task 4/5；Task 7 最后。
- Task 2 与 Task 3 可并行；Task 4 的 shared 契约可与 Task 2/3 并行起草。
