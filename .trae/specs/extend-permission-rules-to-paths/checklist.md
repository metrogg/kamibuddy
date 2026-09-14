# Checklist

- [ ] `tool:"read"` 规则对 read/read_document/find/grep/ls 生效；prefix 目录下的子孙路径命中，平级目录不误命中（isInside 语义）
- [ ] allow 规则使区外读免弹窗；deny 规则先于工作区放行（工作区内也拒）
- [ ] 规则不越过阶段 1 凭据禁区（.ssh 写 allow 也放不进）
- [ ] 非绝对路径的规则前缀忽略不生效（不炸）
- [ ] 区外读弹窗显示「以后都允许读取此路径（及子目录）」；目标在凭据/配置目录内不显示
- [ ] 写回后规则落盘且即刻生效；凭据/配置目录的写回载荷被 daemon 忽略
- [ ] 既有「本次会话内不再询问」与 powershell 写回行为不变
- [ ] `npm run typecheck && npm run check:deps && npm test` 全绿
- [ ] 对齐清单 H3 行更新
