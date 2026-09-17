# Checklist

## 事实对齐

- [x] `AGENTS.md §2` 关于 powershell 的表述与代码事实一致（工具存在、危险命令检查器存在、开关状态写清），且 `docs/` 里的相关表述已同步
- [x] `docs/` 里有 dsh 对照记录，每条结论带 dsh 侧路径与我们的对应物路径，且**未确认项被显式标注**（包总数下界、约 30 页子系统页未逐页读、pi 第二套 `SessionManager` 未证实）

## 纪律门禁

- [x] 「模型体验契约」脚本存在且挂进 `npm run check`；对已覆盖模块，缺失段落会失败；豁免**必须写理由**，无理由的豁免也失败
- [x] 该门禁做过「人为改坏 → 观察到失败 → 还原 → 全绿」的实证
- [x] 决策记录含 `## 否决方案` 段；已归档记录不可修改（只能改状态）
- [x] 模块不变量登记表存在，覆盖 `shared/`、`core/`、`daemon/` 的首轮清单；缺登记且无理由会失败
  - 复验（2026-09-17）：`npm run check:invariants` exit 0 → 「11 个在范围模块（不变量 10 / 豁免 1）」（daemon 两条：`src/daemon/usage-stats.ts`〔台账口径〕、`src/daemon/prompt-preview.ts`〔提示词字节稳定〕，各带 `observation`）；删掉 daemon 那条登记 → exit 1 报「缺登记且无理由」→ 还原全绿。**PASS**（原缺 daemon 域，已由 Fix 1 补上）
- [x] `AGENTS.md` 新增三条证据纪律（真入口路径测试、未触碰文件字节不变、改坏→看红→回滚），与既有 §8 无重复表述

## spill

- [x] 工具结果写回的公共路径已抽进 toolkit，`powershell-tool.ts` / `web-fetch.ts` / `doc-read-tool.ts` 等不再各自实现截断
- [x] 超阈输出会落盘，模型收到「省略字节数 + 完整结果路径 + 取回方式」；落盘文件**确实存在**且能被 `read` 取回（有测试断言）
- [x] 阈值内输出的行为与改动前**完全一致**（有回归断言）
- [x] 提示是响亮告知而非静默降级；注释里写明了「不引入 branded locator」的取舍理由

## 压缩审计

- [x] 压缩有锁语义且最后释放；模拟中途中断后能被检测出来（有测试）
- [x] 台账/事件里能查到被遮蔽范围与 token 量（有断言）
- [x] 未改动或未依赖 pi 的压缩内部行为（压缩期间不发 assistant 事件这条既有事实仍成立）

## 审批

- [x] 审批结果是常量闭集；「应答者缺失/抛错/不合规 ⇒ unavailable ⇒ 拒绝执行」有测试断言
- [x] `asked`/`decided` 审计对可在日志/台账里查到
- [x] 既有权限相关测试全绿，且新增用例覆盖「应答者异常不放行」

## 沙箱测试矩阵

- [x] 差距维度清单（对照 dsh `sandbox-windows-acl` 的 17 个 spec）已列出并留档
- [x] 新增测试覆盖：令牌创建失败、ACL 授予失败、路径边界、probe 判别分支
  - 复验（2026-09-17）：`token-failure.test.ts`（31 例）、`acl-failure.test.ts`（26 例）、`probe.test.ts`（23 例）已有；路径边界维度的等价用例本轮补在 `src/sandbox/path-boundary.test.ts`（6 例，`npx vitest run` 6 passed），两份改坏实证见 tasks.md Fix 2（派生根 → 3 failed；两套盐合一 → 1 failed）。**PASS，但有一处如实收窄**：dsh `path-boundary.spec.ts` 的第 1 例（temp root 不得等于/低于工作区）在我们这侧**没有对应实现**（`privateTempDir` 只做确定性派生、无 `containsDirectory` 守卫），因此那一条**无法被测试断言** —— 未改实现，残余已记进 tasks.md Fix 2 并归属后续任务
- [x] 每条新测试都做过「改坏→看红→还原」
  - 复验（2026-09-17）：本轮复跑三条并留档于 tasks.md Fix 3 —— `token.ts:63` 删返回值检查 → `token-failure.test.ts` 1 failed | 30 passed；`acl.ts:192` 判定改 false → `acl-failure.test.ts` 1 failed | 25 passed；`index.ts:169` 去掉缓存键小写归一 → `probe.test.ts` 1 failed | 22 passed；path-boundary 两份记在 Fix 2。全部还原后 `npx vitest run src/sandbox` → 8 文件 129 passed | 1 skipped，且 `git diff -- src/sandbox/{acl,index,token,workspace-sid}.ts` 无输出（实现逐字节还原）。**PASS**

## 全局

- [x] `npm run typecheck` / `npm run check:deps` / `npm run check:tokens` 全绿
- [x] `npm test` 全绿（已知环境性例外：`src/sandbox/confinement.win.test.ts` 随 IDE 沙箱状态浮动，若红须归因）
- [x] 未触碰任何并行工作流的在途文件；未回滚任何人的改动
- [x] 所有临时探针/临时文件已删除，无残留进程，`git status` 只有本 spec 的真实改动
