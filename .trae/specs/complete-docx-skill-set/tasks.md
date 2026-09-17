# Tasks

- [x] Task 0: 更正记录（本轮附带，先把会误导后人的那条改掉）
  - [x] SubTask 0.1: 改 `.trae/specs/add-skill-management/tasks.md` 的「实施中发现」第 1 条：
        表述改为「pi 是**递归下探，但目录自带 SKILL.md 即停止**（root 优先于 nested）」，
        并附四家证据（pi `test/skills.test.ts:97-118`（精确到两个用例行号）、codex
        `plugin_read.rs:1364-1423` 的 `excludes_nested_skills`、opencode `docs/zh-cn/skills.mdx`、
        WB `plugin.json` 的 `"skills": "./skills"`）；结论改为「`docx/SKILL.md` 是技能边界，
        边界内是按需资源 —— 四家共同设计，不是缺陷」
  - [x] SubTask 0.2: 「空过」改写为「**真空成立（pass for the wrong reason）** —— 那三个子技能本就不被加载，
        断言不是被实现出来的」，并顺手改掉原文的数字错误（13 → **14**：docx 根下 5 + experts/ 9）

- [x] Task 1: 搬 `generate-fillable-contract-html`
  - [x] SubTask 1.1: 从 WorkBuddy 原样搬入 → `resources/skills/docx/generate-fillable-contract-html/SKILL.md`
        （正文逐字保留）
  - [x] SubTask 1.2: 三处适配：frontmatter 补 `version: "1.0.0"`；正文「交给 `html-to-docx` 转换」
        → 「交给 `docx_convert` 工具转换」；来源注释（放在 frontmatter 之后 —— frontmatter 必须在首行，
        与仓内 `frontend-design/SKILL.md` 的既有做法一致）
  - [x] SubTask 1.3: 契约兼容性**真跑**验证（venv 已就绪）：5 个字段全部 `created`，
        `w:bookmarkStart` 5 个与 `bookmarkEnd` **一一配对**、`w:name` 就是中文书签名
        （甲方名称/乙方名称/签订日期/软件名称/合同金额）；表格 `&nbsp;` 被正确取为可见范围；
        故意写重复中文书签名 → 转换照常完成 + `warnings: ["Duplicate docx bookmark name: '甲方名称'"]`
        （告警 + 该字段回落自动名 `fld_buyer_contact`，不是静默改名）。自检脚本与产物已删（临时目录）
  - [x] SubTask 1.4: `resources/skills/docx/orchestrator/SKILL.md` 新增一节「待填业务文档的 HTML 出口
        （S2 创作链与就地重排共用）」：合同/报价单/授权委托书 + 明确要求待填/空白/可填空 → 由本技能产出 HTML，
        不走 typeset 的 legal-contract 模板；只说「来份合同」仍走原通道。S1/S2/S3 契约未动
  - [x] SubTask 1.5: `docx/SKILL.md` 目录地图补两行（由 Task 4.3 一并完成）

- [x] Task 2: `docx_to_html` Python 模块（自研，正向引擎的反向）
  - [x] SubTask 2.1: 新建 `resources/docx-engine/docx_to_html/`，CLI `python -m docx_to_html extract
        <docx> -o <html> [--assets-dir <dir>]`；exit 0 → stdout 单行 JSON（`success/html_path/assets_dir/
        images/warnings/not_restorable`），exit 1 → stderr 单行 JSON（`success:false/error/warnings`）。
        模块按职责拆分（style_map / inline_style / lists / paragraphs / tables / images /
        not_restorable / document / extractor / package / errors / context / types）
  - [x] SubTask 2.2: 提取范围严格限定六项（标题 h1..h6 / 段落含缩进·对齐·字号·字体·粗斜体·颜色 inline style /
        列表含层级 / 表格 / 图片 / 空段落保结构），根内容元素 `<article class="docx-content">`
  - [x] SubTask 2.3: **零新增依赖**（python-docx + stdlib `zipfile`），未改 `requirements.txt`；
        样式映射是数据表（`style_map.py`）
  - [x] SubTask 2.4: `not_restorable` = 固定词表 + **检测命中**（干净文档返回 `[]`；
        空壳页眉不报、`PAGEREF` 不算页码、脚注/批注/修订痕迹按实测补充）
  - [x] SubTask 2.5: pytest 测试 `docx_to_html/tests/`（6 个文件）**35 passed**；含正向↔反向往返用例
  - [x] SubTask 2.6: `resources/docx-engine/README.md` 追加「反向模块」小节（目录 / CLI 契约 / 共用 venv /
        自研声明与不搬 `dist/cli.cjs`、不提供 `assess` 的理由），顶部既有来源声明原文未动
  - [x] SubTask 2.7（实施中补入，由 Task 2 暴露的契约缺陷）: 图片 `src` 原为**相对 assets_dir** 的 `images/x.png`，
        与「HTML 同级的缺省 assets 目录」不自洽（下游拿 HTML 目录当 base_dir 时找不到图）。
        已改为**相对 HTML 文件所在目录**（`os.path.relpath` + POSIX 分隔符），并补断言；
        缺省 `--assets-dir` 规则不变。README 里被当特性写的 4 处描述一并改对

- [x] Task 3: TS 接线（工具 + 权限 + 工具面）
  - [x] SubTask 3.1: 新建 `src/documents/docx-extract.ts`（纯函数层）：`ExtractRequest` /
        `buildExtractArgs` / `extractDocxToHtml` / `classifyEnsureError` / `DocxExtractError`
        （`env-not-ready` / `input-invalid` / `extract-failed` / `timeout` / `output-too-large`），
        复用 `docx-convert.ts` 的 `RunFn` / `defaultRun`
  - [x] SubTask 3.2: 新建 `src/extensions/docx-extract-tool.ts`：`docx_extract` / label「提取文档版式」/
        参数 `docxPath`（必填）+ `outputPath`（必填）+ `assetsDir`（可选）；
        描述写清与 `read_document` 的区别；promptGuidelines 含「不承诺 1:1 还原」与「失败不要反复重试」；
        `warnings` 与 `not_restorable` 都进返回文本
  - [x] SubTask 3.3: `permission-policy.ts` 的 MUTATING 表加 `docx_extract`；
        `permission-gate.ts` 的 `extractFacts` 对 `outputPath` **已通用**（只改注释）；
        补 `permission-gate.test.ts`（2 例）+ `permission-policy.test.ts`（3 例）
  - [x] SubTask 3.4: `resources/modes/craft.md` 白名单加 `docx_extract`（ask / plan 未加）；
        `session-host.ts` 的 running「提取文档版式」/ done「已提取」各加一条，
        并在 `STREAM_CARD_TOOLS` 处写明不进表的理由
  - [x] SubTask 3.5: 三处扩展集注册（`daemon/index.ts` 用户会话 / `subagent-runner.ts` / `automation-runner.ts`），
        注释写明「与 docx_convert 同档：受控 spawn、不经 powershell」
  - [x] SubTask 3.6: 测试 `src/documents/docx-extract.test.ts` + `src/extensions/docx-extract-tool.test.ts`
        （工具在场、参数必填形状、错误上抛、warnings/not_restorable 进文本）

- [x] Task 4: `format-extract` 技能与编排接线
  - [x] SubTask 4.1: 新建 `resources/skills/docx/format-extract/SKILL.md`（自研文字）：
        `name` / 触发导向 description / `version: "1.0.0"` / `user-invocable: false` +
        `disable-model-invocation: true`（内部技能口径）
  - [x] SubTask 4.2: 正文含：职责边界三条（不自行判断触发 / 不猜落点 / 不做质量评估与重排）、
        调用契约表、产物形状、已知不可复原项（9 项固定词表 + 4 条必发降级：合并单元格展开、
        嵌套表格、超链接 URL 丢失、浮动图片按行内提取）、失败处理三类
  - [x] SubTask 4.3: `docx/SKILL.md` 目录地图补两条（现 11 条，与目录实际 11 个子目录一一对应）
  - [x] SubTask 4.4: orchestrator：深度工作流 reference 表补 P1 行（需要复用既有 .docx 版式 → format-extract）；
        「编辑就地处理」读取原文一条升级为「.docx 且诉求涉及版式 → 先 `docx_extract` 拿原文+版式」，
        纯文本/Markdown 路径不变
  - [x] SubTask 4.5: 新增 `resources/skills/docx/README.md` 集中标注来源：
        逐文件比对 MD5 后分「搬用自 WorkBuddy」（typeset / html-review / engines / tokens 的
        themes·rules 逐字一致；9 个专家里 6 个逐字一致、3 个各改 2 行路径）与
        「自研 / 在 WB 机制上改写」（根 SKILL、orchestrator、brief-compose、design-token、
        compiled tokens、**三个 agents 与 WB 差异 92-152 行故归为已改写**、format-extract）

- [x] Task 5: 端到端冒烟与全量校验
  - [x] SubTask 5.1: 新增 `scripts/smoke-docx-roundtrip.ts` + `npm run smoke:docx-roundtrip`：
        正向（复用 `docx-convert.ts`）→ 反向（`docx-extract.ts`）→ 断言标题 h1/h2 文案、表格 `<th>`/单元格、
        3 个中英混排关键串、`not_restorable` 是数组；**11/11 通过（1 SKIP：样张无图片）**，
        环境缺失时 FAIL + 准备引导 + 非零退出（实测过该路径）
  - [x] SubTask 5.2: `npm run typecheck`（exit 0）+ `npm run check:deps`（exit 0，321 文件）
  - [x] SubTask 5.3: `npm test` —— `Tests 2206 passed | 10 skipped`；唯一失败是既有的环境性
        sandbox 探测用例（`0x80000005`，与本改动无关）
  - [x] SubTask 5.4: `npm run check:tokens` —— 真违例 0 处
  - [x] SubTask 5.5: `npm run smoke:session` —— 14/14 通过；技能发现仍是 5 个顶层技能
        （新增的两个 docx 子能力**未**进入技能清单，边界未破）
  - [ ] SubTask 5.6: **真实界面**人工确认（待用户执行）：给一份 .docx 说「照这个版式写一份新的」
        → 模型先调 `docx_extract` 再重排；要「待填合同」→ 产出可在 Word 里按书签填写的 .docx

# Task Dependencies

- Task 0 独立（纯文档更正），最先做
- Task 1 独立于 Task 2/3
- Task 3 依赖 Task 2（CLI 就绪后联调）；Task 4.1/4.2 依赖 Task 3.2 的参数名
- Task 4.3 与 Task 1.5 同文件（`docx/SKILL.md`）→ 由 Task 4 一并改，避免冲突
- Task 5 依赖 Task 1–4 全部完成（5.6 需用户在真实界面执行）

# 实施中的偏差与遗留（如实记录）

- **反向冒烟的图片断言本次是 SKIP**：`examples/report-sample.html` 里没有 `<img>`，
  按「不许为凑断言改示例」的口径降级为 SKIP 并单列一行；图片导出由 Python 侧测试覆盖。
  要真覆盖这条得另造带图 fixture（未做）。
- **冒烟脚本设了 `PYTHONDONTWRITEBYTECODE=1`**：因为 `resources/docx-engine/html_to_docx/__pycache__/*.pyc`
  **是被 git 跟踪的文件**（历史遗留，`.gitignore` 也没有 `__pycache__` 规则），不关字节码缓存的话
  每次跑冒烟都会在仓里新增未跟踪的 `__pycache__/`。这是脚本里唯一超出「纯断言」的一行。
- **`resources/docx-engine/README.md` 顶部「本目录内容整体搬用自 WorkBuddy」在新包落地后措辞略含混**：
  按要求未改原文，已在新小节里明确反向模块为自研。
- **待用户决定的两个仓库卫生问题**（本轮不动）：① 已入库的 `html_to_docx/__pycache__/*.pyc`
  应当 `git rm -r --cached` 并从磁盘删除；② `.gitignore` 应补 `__pycache__/` 规则。
