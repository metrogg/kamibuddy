# Checklist

- [x] 「待送达」判据已改为账本（`Set<string>`）入参，`collectFingerprintsIn` 对会话正文的扫描已删除
- [x] 账本首用时从领导会话文件种子化（重启后判定仍正确）
- [x] 新扩展 `team-output-hook.ts` 挂在 `tool_result` 事件上，且**只在主/领导会话注册**
- [x] 没有待送达产出时工具结果**逐字节不变**（handler 返回 `undefined`）
- [x] 有待送达产出时只追加 `content`，`details` / `isError` 原样不动
- [x] 同一份产出（同一指纹）只送达一次；已写入的工具结果此后逐字节不变
- [x] `team-tools.ts` 里的 `team_*` 工具结果包装层已删除，且无第二挂载点残留
- [x] run 起点快照通道与工具结果挂载点**共用同一个注入函数**，两处给出的待送达集合一致
- [x] 单测覆盖：三连跑收敛 / 同名成员不误杀 / 无产出零改动 / 账本命中去重 / handler 的 content 追加形态
- [x] `check-model-experience` 契约已同步"改写工具结果"的扩展并跑通
- [x] 决策记录已写（含 `## 否决方案`：改用 `context` 每请求拼接、保留双挂载点、不引入账本三条，逐条带理由与出处）
- [x] `inject-team-output-snapshot/spec.md` 与 `ARCHITECTURE.md §4.22` 已标注"挂载点部分被取代"并互相链接
- [x] 全量门禁与测试实跑通过（typecheck / check:deps / check:tokens / check:model-experience / check:module-invariants / vitest）
- [ ] 真机复验：领导的**非 team 工具**结果里出现产出块，且 `team_read` 调用为 0、缓存命中率无明显劣化
      —— **待用户执行**（本环境无法复现真机团队会话；代码/门禁/单测部分已由独立子代理逐条验证通过）
