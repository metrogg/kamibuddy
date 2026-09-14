# Checklist

- [ ] 规则从 `~/.kamibuddy/permissions.rules.json` 加载；坏文件/坏行降级为空规则集不阻断判定
- [ ] 命令按未加引号的 `&&`/`||`/`;` 切段；单双引号内的分隔符不切；`|` 不切
- [ ] 前缀匹配要求 prefix 后紧跟空白或结尾（git 命中 git status，不命中 gitx）
- [ ] allow 规则使命中命令在默认档免弹窗；deny 规则直接拒绝不弹窗并回原因
- [ ] 拆分后最严获胜：`git status && rm -rf ./x` 不被 git allow 放行
- [ ] 规则不越过：阶段 1 凭据禁区、read-only 档、danger-full-access 原行为；危险命令检查器独立不受影响
- [ ] 弹窗对 powershell 单段命令提供「以后都允许「{首词}」开头的命令」；解释器/包装器前缀（python -c、iex 等）与多段命令不提供
- [ ] 写回后规则落盘且即刻生效（后续同类命令免弹窗）；同 tool+prefix+action 不重复写
- [ ] 既有「本次会话记住」（低/中风险）与「高风险不记住」双保险行为不变
- [ ] `npm run typecheck && npm run check:deps && npm test` 全绿
- [ ] 对齐清单 H3 行更新
