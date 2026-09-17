# docx 技能包 —— 资产来源与归属

> AGENTS.md §6 要求搬用资产的来源可追溯。本文件集中标注 `resources/skills/docx/`
> 下每个条目的来历，分「搬用自 WorkBuddy」与「自研」两块 —— 逐个核对过，
> 不是凭印象分类（对照物：WorkBuddy `tencent-docx` 插件，
> 路径 `…\WorkBuddy\resources\app.asar.unpacked\resources\plugins\workbuddy-builtin\builtin-plugins\tencent-docx\`）。
>
> **搬用口径**：内部阶段原样搬用，正式上线前由专人做风险置换（风险兜底不是开发者的任务）。
>
> **搬入日期**：首轮 2026-09-11（commit `d20c83f`「feat(docx): 集成docx生成与专家模式支持」）；
> 本轮补搬 `generate-fillable-contract-html/` 于 2026-09-17。
>
> 判定方式：本轮逐文件比对了 MD5。下面「逐字一致」= 与 WB 对应文件字节相同；
> 标「已改写」的与 WB 不同，改写点写在说明列。

## 一、搬用自 WorkBuddy

| 本目录条目 | 对应 WB 路径 | 搬用情况 |
|---|---|---|
| `typeset/`（SKILL.md + 8 模板 + 8 提示词 + 4 组件） | `skills/doc-typeset/` | **逐字一致**（SKILL.md、templates/ 8、prompts/ 8、components/ 4 全部 MD5 相同） |
| `html-review/`（SKILL.md + scripts/review_html.py + 6 篇 references） | `skills/html-review/` | **逐字一致**（含 6 篇 references 与脚本） |
| `engines/`（critic-generator、deep-research 各 `README.md` + `engine.md`） | `core/engines/` | **逐字一致** |
| `tokens/themes/`（5 套主题） | `skills/design-token/tokens/themes/` | **逐字一致** |
| `tokens/rules/`（GB/T 7713、7714、9704 三份） | `skills/design-token/tokens/rules/` | **逐字一致** |
| `experts/`（9 个文体专家及各自 references/assets/scripts） | `experts/` | 6 个 SKILL.md 与全部 references / assets / scripts 的 README **逐字一致**；`general-writer`、`legal-contract-expert`、`stock-research-report-expert` 三个 SKILL.md **各改 2 行** —— 把引擎路径 `<plugin_root>/core/engines/…` 改指本项目的 `<docx_root>/engines/…`（其余正文原样） |
| `generate-fillable-contract-html/SKILL.md` | `skills/generate-fillable-contract-html/` | 本轮搬入（2026-09-17）。正文逐字保留，仅三处适配：① frontmatter 补 `version: "1.0.0"`；② 指向 WB 工具名的 `html-to-docx` 改为本项目的 `docx_convert` 工具；③ 文件头加来源注释 |

## 二、自研（含在 WB 机制上改写）

| 本目录条目 | 说明 |
|---|---|
| `SKILL.md`（根守门） | **自研**。定「何时进本技能 / 何时退出」与「必须走 orchestrator」的强制规则；WB 的同名文件只作机制参考，文字是重写的 |
| `orchestrator/SKILL.md` + `references/pipeline-state-protocol.md`、`references/log-schema.md` | **自研**（机制照学 WB `skills/tdoc-orchestrator/`）。Stage 0 路由、S1/S2/S3 契约、pipeline-state 协议、待填合同出口判据都按本项目重写 |
| `agents/`（doc-writer / doc-formatter / doc-converter） | **已改写**：以 WB 同名角色为底本，按本项目契约改写（工具名 `docx_convert`、HTML 唯一中间态、html-review 门禁、S1→S2→S3 衔接字段、编辑意图不进流水线等）。三个文件与 WB 的差异都不小（doc-formatter 152 行、doc-converter 127 行、doc-writer 92 行），按「自研文字、机制照学」对待 |
| `brief-compose/SKILL.md` | **自研**。短篇（<1000 字）快速通道；WB 有同名技能，正文按本项目流程重写 |
| `design-token/SKILL.md` + `scripts/build_tokens.py` | **已改写**。查表协议与编译脚本按本项目 token 结构实现（`tokens/compiled/` 的运行时读取契约在这里定） |
| `tokens/compiled/`（general / business-report / academic-paper / government-doc / marketing-doc / index） | **自研编译产物**：由 `tokens/themes/` + `tokens/rules/` 经 `design-token/scripts/build_tokens.py` 生成；与 WB 的同名文件内容不同（是重新编译，不是复制）。改主题或国标规则后必须重跑编译脚本 |
| `format-extract/SKILL.md` | **自研**（本轮 2026-09-17）。只写职责边界、调用契约与不可复原项；能力本体是 `resources/docx-engine/docx_to_html/`。**不搬 WB 的 `dist/cli.cjs`**（理由见下） |

## 三、本轮新增项与 WB 的对照（核实记录）

- **`format-extract` 不直搬的原因**：WB 的 `skills/format-extract/` 通过同目录预构建的
  `dist/cli.cjs`（Node 产物）执行 `convert` / `assess`，并要求目标机器 Node ≥ 18
  （证据：WB `format-extract/SKILL.md` 的 P1/P2 前提、`run.py:108-126`）。这与 AGENTS.md
  「文档流水线走我们的 Python 引擎」相悖，也会引入不可维护的预构建二进制。
  我们改用自研的 `docx_to_html`（python-docx + stdlib `zipfile`，零新增依赖，与正向
  `html_to_docx` 共用同一托管 venv）。
- **`assess`（HTML 转换质量 5 项评估）不搬**：本项目的 `html-review` 已承担 HTML 静态门禁，
  职责重叠，不新造第二套。
