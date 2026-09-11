# Checklist

- [x] `resources/docx-engine/` 完整搬用 html_to_docx 包 + requirements，
      README 注明来源与内部使用声明；本机 venv 转换样例成功且可读回
      （29 个 .py 与源 SHA256 抽查一致；smoke:docx 3/3）
- [x] `~/.venv-html-to-docx` 托管：uv + 独立 Python 3.12 + `--only-binary=:all:`；
      daemon 后台不阻塞预热 + 转换前幂等 ensure；无外网明确降级不静默
- [x] `docx_convert` 专用工具受控调用（不经 powershell 自由 shell），
      权限档位正确（MUTATING 锚定 outputPath），craft 白名单可达；
      技能目录 6 处「禁止 powershell 跑 python」纪律条款
- [x] doc-typeset 模板/design-token compiled/html-review 脚本原样可用；
      9 专家 + 2 引擎落位（resources/skills/docx/ 97 文件）
- [x] 编排层（orchestrator + 3 agents）适配 pi 格式，腾讯生态引用裁剪干净
      （grep 六类残留 0 命中），工具名映射正确；pi 技能发现验证 docx 可达
- [ ] 端到端：「帮我写本周周报」→ docx → 预览面板打开（长篇 full pipeline
      与短篇快速通道各验证一次）——**留给用户重启后验证**
- [x] AGENTS.md §六 记录用户决策；对齐清单 D1 行与表头统计更新
- [x] `npm run typecheck && npm run check:deps && npm test` 全绿
      （1145 用例，新增 43：状态机 21 / 契约 11 / 工具 5 / 权限 6）
