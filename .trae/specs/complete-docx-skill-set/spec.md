# 文档能力补齐（待填合同 + docx→HTML 提取）Spec

## Why

把 `resources/skills/docx/` 与 WorkBuddy 的 `tencent-docx` 插件逐项对齐后（现场枚举，非快照），
**文档这块只差两件**：

1. **`generate-fillable-contract-html`**（待填合同 / 报价单 / 授权委托书 HTML）—— 我们缺。
   它是**纯契约提示词**：待填字段用 `data-docx-field`（稳定英文键）+ `data-docx-bookmark`（唯一中文书签名），
   正文用连续下划线、表格用 `&nbsp;`。
   **能不能直搬的判据已核实**：我们的 `resources/docx-engine/html_to_docx/bookmarks.py` 正好实现同一契约 ——
   `find_all(attrs={"data-docx-field": True})` 读两个属性、书签名正则 `^[A-Za-z\u4e00-\u9fff]…` 放行中文、
   `element.get_text() or "________________"` 取可见范围（`&nbsp;` 也取得到）、
   重名书签**响亮告警并回落自动名**（`Duplicate docx bookmark name`）而不是静默改动。
   所以搬过来即可用，且技能的「唯一中文书签名」要求与引擎的告警互为护栏。
2. **`format-extract`**（把用户给的 .docx 转成语义化 HTML + 抽图片）—— 我们缺。
   用途是「**照这份文档的版式来**」。我们现在做不到：`read_document` 只给文本，
   而编排器的「整篇美化/重排」子路径也正是「读原文内容 → 自行重排」，拿不到原文档的版式。
   **不能直搬**：WB 那份依赖它自带的预构建 `dist/cli.cjs`（几 MB node 产物），
   与 AGENTS.md「文档流水线走我们的 Python 引擎」相悖，也不该引入不可维护的二进制。
   **但自研成本低**：我们的托管 venv 里 `python-docx` / `lxml` / `Pillow` **已经装好**
   （正向 html→docx 就在用），反向读 docx 不需要任何新依赖（图片用 stdlib `zipfile` 读 `word/media/`）。

顺带更正一条我们自己的错误记录：`add-skill-management/tasks.md` 里写的「pi 的技能发现只有一层」
不准确 —— 三家实现的规则已核实（见 Impact 的 §记录更正）。

## What Changes

- **搬 `generate-fillable-contract-html`**：原样搬入 `resources/skills/docx/generate-fillable-contract-html/SKILL.md`，
  只改两处 —— 触发语法与本项目工具名（`html-to-docx` → `docx_convert`）；frontmatter 补 `version`；
  文件头与目录来源标注写清出处（AGENTS.md §6）。接进编排：合同体裁 + 「待填/空白」诉求时，
  由 doc-formatter 走它产出 HTML（而非 typeset 的 legal-contract 模板）。
- **新增 docx→HTML 提取能力（自研，分层照既有 docx 链路）**：
  - Python：`resources/docx-engine/docx_to_html/`（与 `html_to_docx/` 平级、同一 PYTHONPATH），
    CLI `python -m docx_to_html extract <docx> -o <html> [--assets-dir <dir>]`，
    stdout 单行 JSON、exit 0/1 契约与正向**同形**。
  - TS：`src/documents/docx-extract.ts`（纯函数层：CLI 契约、错误分类，可单测）+ 复用
    `src/documents/docx-env.ts` 的幂等 ensure + `src/extensions/docx-extract-tool.ts` 注册工具 `docx_extract`。
  - 权限与工具面：登记为 **MUTATING** 档（它写 HTML + 图片到工作区），写侧判定锚定 `outputPath`
    （与 `docx_convert` 同一手法）；进 craft 白名单；用户会话 / 子代理 / 定时 run 三处扩展集都注册；
    工具卡词汇补 running/done 两条。
  - 技能：`resources/skills/docx/format-extract/SKILL.md`（内部技能，照 WB 与既有内部技能口径：
    `user-invocable: false` + `disable-model-invocation: true`），写清职责边界、调用契约、
    输出 HTML 的形状，以及**已知不可复原项**（页码 / 页眉页脚 / 分节 / 浮动对象 / 域代码）——
    不许让模型以为能 1:1 还原。
- **编排接线**：orchestrator 的「编辑就地处理 → 整篇美化/重排」子路径升级为
  「先 `docx_extract` 拿到原文 + 版式 → 再按 design-token / typeset 重排」；
  `docx/SKILL.md` 的目录地图补两条。
- **记录更正**：更正 `add-skill-management/tasks.md` 里关于技能发现规则的措辞（附三家证据路径）。
- **BREAKING**：无。新工具、新技能、新 Python 模块都是增量；既有 `docx_convert` 行为不变。

## Impact

- Affected specs: `add-docx-generation`（引擎与环境机制）、`add-skill-management`（技能页元数据：新技能要带 version）、
  `rework-skill-ux-workbuddy`（内部技能的可见性口径）、`add-skill-management`（同一 `listSkills` 出口）
- Affected code:
  - 新增 `resources/skills/docx/generate-fillable-contract-html/SKILL.md`（搬用）
  - 新增 `resources/skills/docx/format-extract/SKILL.md`（自研）
  - 新增 `resources/docx-engine/docx_to_html/`（`__main__.py` + 核心模块 + `README`/来源说明随引擎 README 一并更新）
  - 新增 `src/documents/docx-extract.ts`（+ 测试）、`src/extensions/docx-extract-tool.ts`（+ 测试）
  - `src/extensions/permission-policy.ts`（MUTATING 登记）、`src/extensions/permission-gate.ts`（如路径锚定需补）
  - `resources/modes/craft.md`（白名单加 `docx_extract`）
  - `src/core/session-host.ts`（`TOOL_RUNNING_LABELS` / `TOOL_DONE_LABELS` 加 `docx_extract`）
  - `src/daemon/index.ts`（用户会话扩展集）、`src/daemon/subagent-runner.ts`、`src/daemon/automation-runner.ts`
  - `resources/skills/docx/SKILL.md`（目录地图）、`resources/skills/docx/orchestrator/SKILL.md`（编辑就地处理子路径）
  - `scripts/smoke-docx.ts`（或同目录脚本：加一条反向往返的端到端冒烟）

### 记录更正（本轮附带）

`.trae/specs/add-skill-management/tasks.md` 的「实施中发现」第 1 条现写着「pi 的技能发现只有一层」。
已核实的三家规则（写更正时必须附上）：

- **pi**：**递归下探，但目录自带 SKILL.md 即停止**（root 优先于 nested）——
  `开源项目/pi/packages/coding-agent/test/skills.test.ts:97-115`。
- **codex**：插件 `skills/` 只取一层，**嵌套显式排除** ——
  `开源项目/codex/codex-rs/app-server/tests/suite/v2/plugin_read.rs:1364-1423`（测试名
  `plugin_read_agent_plugin_excludes_nested_skills`）。
- **opencode**：固定一层 `<config>/skills/<name>/SKILL.md`，且 name 必须等于目录名 ——
  `开源项目/opencode/packages/web/src/content/docs/zh-cn/skills.mdx`。
- **WorkBuddy**：`plugin.json` 显式声明 `skills: "./skills"`，未声明的子树（`experts/`）不算技能。

结论：`docx/SKILL.md` 是「技能边界」，边界内的 `typeset` / `experts/*` 是**按需加载资源**而非技能 ——
这是四家共同设计，不是缺陷；只有当某个子能力需要被用户/模型**直接选中**时才需要动结构。

## ADDED Requirements

### Requirement: 待填业务文档（合同 / 报价单 / 授权委托书）

系统 SHALL 内置一份「待填业务文档 HTML」技能，规定：每个待填字段同时带稳定英文
`data-docx-field` 与唯一中文 `data-docx-bookmark`；正文待填范围用连续下划线、表格待填范围用 `&nbsp;`；
不得使用提示性占位文案（`请输入`/`待填写`）、英文书签名或表格下划线书签。
产出的 HTML SHALL 能经 `docx_convert` 转出**带 Word 书签**的 .docx。

#### Scenario: 生成一份待填合同

- **WHEN** 用户要一份「待填的采购合同 Word」
- **THEN** 走本技能产出 HTML（字段带 `data-docx-field` + 中文 `data-docx-bookmark`），
  经 `docx_convert` 得到的 .docx 里每个字段都是可跳转/可填的 Word 书签

#### Scenario: 书签名重复时不静默

- **WHEN** 产出的 HTML 里出现重复的中文书签名（同一份文档内）
- **THEN** 转换照常完成，但引擎给出 `Duplicate docx bookmark name` 告警并在结果里如实上抛
  （不静默改名掩盖问题）

#### Scenario: 不被误触发

- **WHEN** 用户只是要「一份合同」（没有「待填 / 空白 / 模板 / 书签」这类诉求）
- **THEN** 走常规 typeset 的 legal-contract 通道，不走本技能

### Requirement: docx→HTML 版式提取

系统 SHALL 提供 `docx_extract` 工具，把 .docx 转成**语义化 HTML + 图片目录**，
供「参考既有文档版式重排」的场景使用。工具 SHALL 走与正向转换同一套托管 Python 环境
（幂等 ensure，不要求用户自备 Python），SHALL NOT 依赖任何新依赖项。
产出 SHALL 在结果里如实列出**已知不可复原项**（页码 / 页眉页脚 / 分节 / 浮动对象 / 域代码）。

#### Scenario: 提取版式与图片

- **WHEN** 用户给一份 .docx 说「照这个版式写一份新的」
- **THEN** 先 `docx_extract` 得到 HTML（标题层级 / 段落缩进 / 字体与字号 / 表格 / 列表 / 图片都在），
  再据此重排新内容，最后经 `docx_convert` 交付 .docx

#### Scenario: 环境未就绪

- **WHEN** 托管环境还没准备好（首次冷启动）
- **THEN** 工具按 `docx-env` 的幂等 ensure 先准备（耗时如实告知），失败时**响亮报错**并给出可执行建议，
  不静默返回空 HTML

#### Scenario: 输入不是 docx

- **WHEN** 传入的路径不是 .docx（或文件不存在 / 不是 zip 容器）
- **THEN** 工具响亮报错并说明原因，不产出半成品 HTML

#### Scenario: 权限与工具面

- **WHEN** 查看模式白名单与工具面
- **THEN** `docx_extract` 在 craft 白名单内；ask / plan 的只读模式**不含**它；
  用户会话 / 子代理 / 定时 run 三处扩展集都注册；工具卡显示「提取文档版式 / 已提取」

### Requirement: 提取能力的技能说明

系统 SHALL 在 `docx` 技能包内提供 `format-extract` 子技能，说明：何时用（调用方决定，
它自己不做触发判断）、调用契约（工具名与参数）、产物形状（`article.docx-content` + `images/` 相对引用）、
以及**已知不可复原项**。它 SHALL NOT 自行判断「该不该触发」，也 SHALL NOT 猜产物落点。

#### Scenario: 调用方显式传产物目录

- **WHEN** doc-formatter 在重排流程里调用它
- **THEN** 产物落在调用方指定的目录下（`output/<任务>/…`），不由技能自己决定

#### Scenario: 边界如实告知

- **WHEN** 用户问「能不能 1:1 还原我这份文档的版式」
- **THEN** 回答里明确列出可复原项与不可复原项，不承诺做不到的还原度

## MODIFIED Requirements

### Requirement: 编辑就地处理（整篇美化 / 重排子路径）

原「用 `read_document` / `read` 读取原文内容 → 自行重排」改为「已有 .docx 且诉求是版式相关时，
先 `docx_extract` 取得原文 + 版式特征，再重排；纯文本/Markdown 文档仍走原路径」。

#### Scenario: 有 .docx 的重排

- **WHEN** 用户上传 .docx 说「换个更好看的版式，内容不动」
- **THEN** 走 `docx_extract` → 重排 → `docx_convert`，且不启动 S1（不重写内容）

### Requirement: docx 技能包的目录地图

`resources/skills/docx/SKILL.md` 的目录地图 SHALL 补入 `format-extract/` 与
`generate-fillable-contract-html/` 两条，与其它子能力同一格式。

#### Scenario: 地图与实际一致

- **WHEN** 比对目录地图与 `resources/skills/docx/` 实际内容
- **THEN** 无遗漏、无幽灵条目

## REMOVED Requirements

无。

## 明确不做（本轮）

- **`format-extract` 的 `assess`（HTML 转换质量 5 项评估）**：我们已有 `html-review` 技能做 HTML 静态门禁，
  职责重叠；需要评估时由 html-review 承接，不新造第二套。
- **页眉页脚 / 页码 / 分节 / 浮动对象 / 域代码的反向提取**：v1 明确列为「不可复原」，
  在技能里如实写明（要做得先评估 python-docx 的表达能力边界）。
- **搬 WB 的 `dist/cli.cjs`**：不引入不可维护的预构建二进制。
- **搬 WB 的其余内置技能**（用户决策：本轮只补文档这块）。
