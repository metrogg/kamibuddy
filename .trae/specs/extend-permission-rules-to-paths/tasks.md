# Tasks

- [x] Task 1: 路径规则引擎 + 判定链接线
  - [x] SubTask 1.1: `permission-rules.ts` 加 `evaluatePathRules(target, rules)` 纯函数
        （isInside 语义匹配 tool:"read" 规则；deny/allow/unmatched 三态 + 原因）+ 单测
        （子孙命中、平级目录不误命中、Windows 大小写、最严获胜、非绝对路径规则忽略）
  - [x] SubTask 1.2: `permission-policy.ts` 阶段 2：deny 规则先于工作区放行；
        allow 规则在区外询问前；注释写明「凭据禁区仍在阶段 1，规则无法越过」+ 测试
- [x] Task 2: 弹窗写回（read 家族）
  - [x] SubTask 2.1: daemon 写回校验按工具分流：powershell 走首词校验（现状）、
        read 走「绝对路径且非凭据/配置目录」校验；落盘复用 appendRule
  - [x] SubTask 2.2: `permission-dialog.tsx`：区外读弹窗显示
        「以后都允许读取此路径（及子目录）」checkbox（目标在凭据/配置目录内不显示），
        勾选随允许提交 rememberPrefix=目标路径
  - [x] SubTask 2.3: 端到端测试：写回 → 落盘 → 后续读该目录树免弹窗；
        凭据目录载荷被忽略
- [x] Task 3: 收尾验证
  - [x] SubTask 3.1: `npm run typecheck && npm run check:deps && npm test` 全绿
  - [x] SubTask 3.2: 对齐清单 H3 行更新（path 规则落地范围写清）

# Task Dependencies

- Task 2 依赖 Task 1（evaluatePathRules 与 policy 接线先行）
- Task 3 依赖全部
