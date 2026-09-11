# Tasks

- [x] Task 1: 搬用 Python 引擎（`resources/docx-engine/`）
  - [x] SubTask 1.1: 从 `%TEMP%\wb-asar-554\resources\plugins\workbuddy-builtin\
        builtin-plugins\tencent-docx\skills\html-to-docx\scripts\` 整体复制
        html_to_docx 包（24 模块）+ requirements.txt + pyproject.toml 到
        `resources/docx-engine/`；写 README 注明来源（WorkBuddy 5.5.4 搬用、
        内部使用、上线前置换）与目录布局调整（Windows `Scripts/python.exe`）
  - [x] SubTask 1.2: 本机建 venv 验证引擎可用：uv + Python 3.12 + `--only-binary`
        装依赖 → 跑 `python -m html_to_docx convert` 转一份样例 HTML →
        python-docx 读回校验；产出样例 examples/report-sample.html

- [x] Task 2: 托管环境与工具面（`src/documents/` + 扩展工具 + daemon 预热）
  - [x] SubTask 2.1: `src/documents/docx-env.ts` 纯函数状态机
  - [x] SubTask 2.2: `src/documents/docx-convert.ts`：CLI 调用 + JSON 契约 + 错误分类
  - [x] SubTask 2.3: `docx_convert` pi 扩展工具注册；权限档位；craft 白名单
  - [x] SubTask 2.4: daemon 启动后台预热；诊断页 venv 状态行
  - [x] SubTask 2.5: TS 单测 43 例（状态机/契约/错误分类/Windows 路径/权限）

- [x] Task 3: 搬用技能体系并适配 pi（`resources/skills/docx/` 97 文件）
  - [x] SubTask 3.1: doc-typeset / design-token / html-review 搬用落位
  - [x] SubTask 3.2: 9 专家 + 2 引擎落位
  - [x] SubTask 3.3: 编排层适配（裁剪腾讯生态 + 工具名映射 + 路径适配）
  - [x] SubTask 3.4: 根守门 SKILL.md；pi 技能发现验证（docx 可达）

- [x] Task 4: 冒烟与收尾
  - [x] SubTask 4.1: `scripts/smoke-docx.ts`：ensure venv → 转换样例 → 读回校验；
        挂 `smoke:docx` npm script（3/3 通过）
  - [ ] SubTask 4.2: 端到端用户验证：「帮我写本周周报」→ 追问素材 → 流水线 →
        docx → 预览面板打开；长篇（>1000 字走 full pipeline）与短篇各试一次
        **（留给用户重启后验证）**
  - [x] SubTask 4.3: AGENTS.md 新增 §六（WorkBuddy 资产使用决策记录——原 §6 合规节
        已被并行会话移除，决策以新节落档）；对齐清单 D1 行 ❌→🟡 + 表头统计

# Task Dependencies

- Task 1 与 Task 3 可并行（引擎与技能内容无依赖）
- Task 2 依赖 Task 1 的引擎落位（CLI 契约已知，可桩并行，2.2 联调收尾）
- Task 4.1 依赖 Task 1+2；Task 4.2 依赖 Task 1+2+3；Task 4.3 最后
