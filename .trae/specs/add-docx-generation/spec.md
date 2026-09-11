# D1 本地 docx 生成（第一阶段：搬用 tencent-docx 打通端到端）Spec

## Why

对齐清单 D1 是「产品价值主菜」。WorkBuddy tencent-docx 插件已充分调研（5.5.4 解包
实证），用户已明确：**内部使用阶段直接搬用 WorkBuddy 资产**（Python 引擎/模板/
tokens/专家文案），上线前由专人做风险置换，合规红线解除。

市面开源（html-for-docx 裸用 / python-docx 自写映射 / pandoc）均达不到 WB 补丁层
保真度，直接搬用是最优路线。

## WorkBuddy 机制调研结论（复刻依据）

- **三段流水线**：S1 doc-writer（专家路由→Markdown 门禁→critic 审查）→
  S2 doc-formatter（design-token 查表→模板排版→html-review 静态门禁）→
  S3 doc-converter（venv Python 转换→present_files 强制打开预览）；
  另有 <1000 字短篇快速通道 brief-compose。
- **引擎**：开源 `html-for-docx`+`python-docx` 打底 + 24 模块补丁层
  （CSS 变量展开、style 拍平内联剥 border-radius、CJK rFonts.eastAsia、表格/段落
  样式后处理、图片限宽、分节/@page/页眉页脚/TOC/组件注册表、markdown 降级）；
  CLI 契约 = exit 0 stdout JSON / exit 1 stderr JSON 含 markdown_fallback。
- **环境**：uv + 独立 Python 3.12 + `~/.venv-html-to-docx` + `--only-binary=:all:`；
  SessionStart 后台不阻塞预热 + 每次转换前幂等重跑。
- **质量闸**：design-token 预编译查表 0 次 LLM；html-review 纯 stdlib 脚本
  6 维静态门禁（打回一次不循环）；critic-generator 对抗审查（work-report=once，
  但 WB 自身有断链：work-report-expert 无 critic_config）。

## What Changes（搬用路线）

- **引擎整体搬用**：`tencent-docx/skills/html-to-docx/scripts/`（html_to_docx 包
  24 模块 + requirements.txt + pyproject.toml）原样进 `resources/docx-engine/`；
  来源与内部使用声明写进目录 README
- **技能/模板/资产搬用并适配 pi 格式**：
  - `skills/doc-typeset/`（8 模板 + 4 组件 + 8 prompts 原样）
  - `skills/design-token/`（compiled tokens JSON 原样 + 查表脚本）
  - `skills/html-review/`（review_html.py 纯 stdlib 原样 + references）
  - `experts/` 9 个文体专家（原样，重点 work-report + general-writer）
  - `core/engines/critic-generator` + `deep-research`（原样）
  - `agents/` doc-writer/doc-formatter/doc-converter + `skills/tdoc-orchestrator`
    （适配裁剪：删掉 tencent-docs-routing 转交、beautify_only、format-extract、
    合同填空的引用；工具名映射到我们的 read/write/powershell 例外通道/docx_convert/
    present_files）
- **转换调用受控**（平台约束，非合规约束）：WB 链路里模型直接 bash 调 venv python；
  我们走专用工具 `docx_convert`（daemon spawn），不经 powershell 自由 shell
- **托管环境**：`src/documents/docx-env.ts` 状态机实现 setup-html-to-docx.sh 同款
  机制（bash 脚本在 Windows 不能裸跑，机制照抄、实现走 TS spawn uv）；
  daemon 启动后台预热（对标 SessionStart hook）
- **AGENTS.md §6 合规节改写**：内部阶段允许搬用 WorkBuddy 资产，上线前风险置换
  由专人负责（用户决策记录）
- **范围外（本阶段不做）**：format-extract 反向提取（其 bundled Node CLI 在解包里
  缺失，本来就是残的）、tencent-docs-routing 编辑链、generate-fillable-contract-html、
  sheetagent/pptx（D2/D3 各自的事）

## Impact

- Affected code：`resources/docx-engine/`（新，搬用）、`resources/skills/`（新增
  docx 相关技能）、`resources/agents/`（新增 3 个）、`resources/tokens/`（新）、
  `src/documents/`（新，TS 侧）、`src/extensions/`（docx_convert 工具）、
  `src/daemon/`（预热接线）、`AGENTS.md` §6、`docs/workbuddy对齐清单.md` D1 行
- 环境副作用：首次使用装 uv + Python 3.12 + `~/.venv-html-to-docx`（无外网降级
  Markdown 交付并明示）

## ADDED Requirements

### Requirement: docx 转换引擎（搬用）
The system SHALL vendor WorkBuddy tencent-docx 的 html_to_docx Python 包到
`resources/docx-engine/`，经 CLI（`convert input.html -o out.docx`）转换，
exit 0 stdout JSON / exit 1 stderr JSON 含 markdown_fallback。

#### Scenario: 转换成功与降级
- **WHEN** 对符合子集的 HTML 调用引擎
- **THEN** 生成 .docx（标题/表格/图片/CJK 字体正确），stdout JSON 含输出路径；
  失败时 stderr JSON 含 markdown_fallback，工具层如实上抛不静默

### Requirement: 托管 Python 环境
The system SHALL manage `~/.venv-html-to-docx`（uv + 独立 Python 3.12 +
`--only-binary=:all:`）：daemon 启动后台不阻塞预热；每次转换前幂等确保；
无外网/安装失败时返回明确降级（Markdown 交付 + 告知原因）。

#### Scenario: 首次使用自动建环境
- **WHEN** 首次触发 docx_convert 且 venv 不存在
- **THEN** 自动装 uv→Python 3.12→venv→依赖，状态对用户可见

### Requirement: 文档流水线技能（搬用适配）
The system SHALL将 tencent-docx 的编排（orchestrator + 3 agents + 专家路由 +
design-token 查表 + doc-typeset 模板 + html-review 门禁）适配为 pi 技能/代理，
裁剪掉腾讯生态引用；模型按流水线产 HTML → docx_convert → present_files 交付。

#### Scenario: 周报端到端
- **WHEN** 用户说「帮我写本周周报」
- **THEN** 命中 work-report-expert 路由，经流水线产出 .docx 并 present_files
  打开预览；中间态 md/html 不交付

### Requirement: 转换调用受控
The system SHALL经专用工具 `docx_convert` 调用引擎（daemon spawn venv Python），
不允许模型经 powershell 自由 shell 直接执行 Python/uv。

#### Scenario: 工具白名单
- **WHEN** 模型发起文档转换
- **THEN** 只经 docx_convert；权限策略按「写工作区产物文件」档位判定
