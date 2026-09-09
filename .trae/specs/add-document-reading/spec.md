# 文档读取能力（PDF/Office → Markdown）Spec

## Why

模型现在读不了 PDF/Office：pi 的 `read` 只支持文本+图片，PDF 按 utf-8 读出乱码。
调研已定论（2026-09-09）：模型原生派（document block）在 pi 与国内模型下走不通；
本地抽取派（纯 JS → Markdown）被 Cline/Roo Code 与 Cherry Studio（33k stars，
同 Electron 架构、同中国办公用户）量产验证；WorkBuddy 的 PDF 反而很弱，
做成即反超。本 spec 落地这条已验证路线。

## What Changes

**A. 提取纯函数层（新）**
- `core/doc-extract.ts`：按扩展名分流——PDF 走 `pdfjs-dist`（按页提取，页级分页）；
  docx/xlsx/pptx/odt/odp/ods 走 `officeparser@^4`（Cherry Studio 同款 v4 稳定线，
  不碰 v7 大改版）→ 输出文本/Markdown
- 统一错误协议（可读、可行动，不写防御性兜底）：
  扫描件 PDF（无文本层）→「该 PDF 没有文本层（可能是扫描件），暂无法读取」；
  老格式 .doc/.xls/.ppt →「请另存为 .docx/.xlsx/.pptx 后重试」；
  加密/损坏 → 明示原因；不支持扩展名 → 列出支持清单
- 大文档截断续读：单次上限对齐 web_fetch 的 24k 字符，附「继续读 offset=N」
  引导（对齐 pi read 的续读语义）

**B. 新自定义工具 `read_document`**
- 已核实 pi 包根**不导出** `createReadTool`（exports 仅 4 个子路径），
  包装 read 不可行 → 新增自定义工具，仿 web_search/web_fetch 两层结构：
  `core/doc-extract.ts`（纯逻辑）+ `extensions/` 注册（pi 类型止步于此）
- 参数 `path` / `offset?` / `limit?`（PDF=页，Office=字符段），工具描述写明
  与 `read` 的分工（read=文本/图片，read_document=PDF/Office），
  防模型用 read 读 PDF 拿到乱码

**C. 权限门登记**
- `permission-policy.ts`：`read_document` 同时进 `READ_ONLY` 与 `LOCAL_READ`——
  与 read 完全同语义（工作区内放行、区外低风险询问、凭据目录禁读）

**D. 工具面与提示词**
- craft / ask 两个模式 frontmatter 白名单 + **建会话时的工具集**同源加入
  （STATUS.md 已知坑：两处不同源会导致模型自称没能力）
- 场景提示词能力边界补「可读取 PDF/Office 文档」
- 工具卡 label 中文映射（阅读文档 / 已阅读，live 与 restored 两处）

**E. 依赖**
- 新增 `pdfjs-dist`（钉版本）+ `officeparser@^4`；**均为纯 JS，零原生依赖**
  （安装后用 `npm ls` 验证无 `.node` 引入）

## Impact

- Affected specs：工具面（read_document）、权限门只读工具集、模式白名单、场景提示词
- Affected code：
  - 新增 `src/core/doc-extract.ts`、`src/core/doc-extract.test.ts`、`src/extensions/doc-read-tool.ts`
  - 新增测试 fixtures（小体积中文 pdf/docx/xlsx/pptx/odt + 无文本层 PDF + 老格式 doc）
  - 改 `src/extensions/permission-policy.ts`（+测试）、`src/core/session-host.ts`
    （建会话工具集 + label 映射）、`resources/modes/{craft,ask}.md`、
    `resources/scenes/work/prompt.md`、`package.json`

## 范围外（明确不做）

- **playground 文档问答**：playground 安全模型是「工具集为空 + 不装权限门」，
  开放 read_document 需变更该模型（装权限门扩展），属独立决策，本 spec 不动
- 扫描件 OCR / 无文本层 PDF 读取（将来 MinerU/docling 服务化是另一个 spec）
- 老格式 .doc/.xls/.ppt 解析（明确报错引导另存新格式）
- 知识库 / RAG（MinerU 级解析质量）
- Office 文档「保格式编辑」（WorkBuddy editor_sdk 路线，与本 spec 无关）

## ADDED Requirements

### Requirement: 文档读取

系统 SHALL 提供 `read_document` 工具：输入文件路径，PDF 逐页提取文本
（pdfjs-dist，CMap/standard_fonts 路径必须配置正确——中文乱码的根因），
docx/xlsx/pptx/odt/odp/ods 提取为文本/Markdown（officeparser v4）。
提取结果中文不得乱码。

#### Scenario: 读取 PDF
- **WHEN** 模型对工作区内一份文字型中文 PDF 调用 `read_document`
- **THEN** 返回逐页文本（中文无乱码），含页数信息；权限门直接放行不询问

#### Scenario: 读取 Office 文档
- **WHEN** 模型对 docx/xlsx/pptx/odt 调用 `read_document`
- **THEN** 返回结构化文本（标题/段落/表格内容可读），中文无乱码

#### Scenario: 区外读取
- **WHEN** 模型对工作区外的文档调用 `read_document`
- **THEN** 权限门弹低风险询问（与 read 同语义）；凭据目录内文档直接拒绝

### Requirement: 大文档分页与截断

系统 SHALL 对超长提取结果截断：单次输出 ≤24k 字符，附续读引导
（「已显示第 X-Y 页/段，继续读 offset=N」）。PDF 的 offset/limit 以页为单位。

#### Scenario: 长 PDF 分页
- **WHEN** 对 100 页 PDF 调用 `read_document`（无参数）
- **THEN** 返回前若干页（受 24k 截断），末尾标注总页数与续读 offset

### Requirement: 可读性错误协议

系统 SHALL 对不可读文档返回明确可行动的错误文案：
无文本层 PDF → 提示扫描件；老格式 → 引导另存新格式；加密/损坏 → 明示原因；
不支持扩展名 → 列出支持清单。

#### Scenario: 扫描件 PDF
- **WHEN** 对一份纯图片型 PDF 调用 `read_document`
- **THEN** 返回「该 PDF 没有文本层（可能是扫描件），暂无法读取」，不返回空串

#### Scenario: 老格式 .doc
- **WHEN** 对 .doc 文件调用 `read_document`
- **THEN** 返回「请另存为 .docx 后重试」类明确引导

## MODIFIED Requirements

### Requirement: 权限门只读工具集

**原**：`READ_ONLY` = read/find/grep/ls/web_search/web_fetch/present_files；
`LOCAL_READ` = read/find/grep/ls。
**新**：两个集合各加 `read_document`，语义与 read 完全一致
（区内放行、区外低风险询问、凭据目录禁读；测试钉住三个分支）。

### Requirement: 模式工具白名单

**原**：craft / ask 白名单含 read/write/edit/web_search/web_fetch/present_files 等。
**新**：两个模式 frontmatter 与建会话工具集同源加入 `read_document`；
场景提示词能力边界声明「可读取 PDF/Office 文档」。

## REMOVED Requirements

无。
