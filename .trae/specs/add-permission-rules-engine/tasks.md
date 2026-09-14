# Tasks

- [x] Task 1: 规则引擎纯函数（permission-rules.ts + 测试）
  - [x] SubTask 1.1: 类型与解析：`PermissionRule { tool, prefix, action }`、
        `parseRulesFile(json: string)`（坏 JSON/坏行降级忽略、version 校验）
  - [x] SubTask 1.2: `splitCommand(command)`：未加引号的 `&&`/`||`/`;` 切段
        （单双引号内不切；不切 `|`）；`matchesPrefix(segment, prefix)`
        （prefix 后须空白或结尾）
  - [x] SubTask 1.3: `evaluateCommand(command, tool, rules)` →
        `"allow" | "deny" | "unmatched"`（最严获胜 + deny 原因）；
        `firstTokenPrefix(command)`（写回用：单段才返回首词，解释器/包装器
        前缀返回 undefined——powershell/pwsh/cmd/iex/python/node/bash/sh/wsl
        及 -c/-e/EncodedCommand 形态）
  - [x] SubTask 1.4: 单测覆盖：拆分（引号内分号/管道不切）、前缀边界（git≠gitx）、
        最严获胜、解析降级、写回前缀白名单/黑名单
- [x] Task 2: 规则存储 + 判定链接线
  - [x] SubTask 2.1: `src/core/permission-rules-store.ts`：load（坏文件降级空集+
        daemon 日志）/ append（去重：同 tool+prefix+action 不重复写）/ 测试
  - [x] SubTask 2.2: `permission-policy.ts`：powershell 在阶段 3 之后插入规则阶段
        （decidePermission 入参加 rules，保持纯函数）；unmatched 维持原高风险询问；
        注释写明与危险命令检查器的分工
  - [x] SubTask 2.3: `permission-gate.ts` + `daemon/index.ts`：store 启动加载、
        规则透传进门；policy/gate 测试补例（allow 免弹窗、deny 直拒、拆分最严、
        read-only 仍拒、坏文件降级）
- [x] Task 3: 批准写回（弹窗 → 规则落盘）
  - [x] SubTask 3.1: `shared/ipc.ts` 审批响应载荷加可选 `rememberPrefix?: string`；
        daemon 收到后 append 规则并更新内存规则集（下次判定即生效）
  - [x] SubTask 3.2: `permission-dialog.tsx`：powershell 单段命令显示
        「以后都允许「{首词}」开头的命令」选项（firstTokenPrefix 返回 undefined
        或多段命令不显示）；选择后随允许一并提交
  - [x] SubTask 3.3: 端到端测试（daemon 或 gate 层）：写回 → 落盘 → 后续同类免弹窗
- [x] Task 4: 收尾验证
  - [x] SubTask 4.1: `npm run typecheck && npm run check:deps && npm test` 全绿
  - [x] SubTask 4.2: 对齐清单 H3 行更新（规则语法落地范围写清）

# Task Dependencies

- Task 2 依赖 Task 1（消费纯函数）
- Task 3 依赖 Task 1（firstTokenPrefix）与 Task 2（store append）
- Task 4 依赖全部
