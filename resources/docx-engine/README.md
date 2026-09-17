# docx-engine — HTML → DOCX 转换引擎（WorkBuddy 搬用）

## 来源与使用声明

本目录内容**整体搬用自 WorkBuddy 5.5.4** 解包产物中的
`tencent-docx/skills/html-to-docx/scripts/`（`html_to_docx` Python 包 +
`requirements.txt` + `pyproject.toml`），未做代码改动。

- **使用范围**：公司内部使用阶段。
- **风险置换**：正式上线前由专人负责对该资产做风险置换/重写。
- 决策记录：用户决策，2026-09-10（见 `.trae/specs/add-docx-generation/spec.md`）。

引擎底层为开源 `html-for-docx` + `python-docx`，其上叠加 WorkBuddy 的补丁层
（CSS 变量展开、style 拍平内联、CJK rFonts.eastAsia、表格/段落样式后处理、
图片限宽、分节/@page/页眉页脚/TOC/组件注册表、Markdown 降级）。

## 目录布局

```
resources/docx-engine/
  html_to_docx/        # 引擎包（搬用资产；顶层 23 个 .py + components/ 子包 6 个 .py）
  docx_to_html/        # 反向包（自研；docx → HTML + 图片，见下文「反向模块」）
  requirements.txt     # 运行依赖（含 pytest，WB 原样）
  pyproject.toml       # 包元数据（安装入口 html-to-docx = __main__:cli）
  examples/            # 本地验证样例（report-sample.html）
```

## 调用契约

```bash
python -m html_to_docx convert input.html -o out.docx \
  [--page-size A4|Letter|A3] [--orientation portrait|landscape] \
  [--margin-top N] [--margin-bottom N] [--margin-left N] [--margin-right N]
```

- **exit 0**：stdout 打印单行 JSON `{"success": true, "docx_path", "warnings", "fields"}`
- **exit 1**：stderr 打印单行 JSON `{"success": false, "error", "markdown_fallback", "warnings"}`
  —— `markdown_fallback` 为降级后的 Markdown 文本，调用方如实上抛，不静默掩盖。
- 输入 HTML 按 UTF-8 读取；相对路径图片以输入文件所在目录为 base_dir 解析。
- 引擎**不经 pip install 使用**：把本目录加进 `PYTHONPATH`（或作为 cwd）后用
  venv 的 Python 直接 `python -m html_to_docx ...`。

## 反向模块 `docx_to_html`（docx → HTML + 图片，**自研**）

把 .docx 提取成语义化 HTML + 图片目录，供「照这份文档的版式来」的场景使用
（`read_document` 只给纯文本，拿不到版式）。**本模块是我们自己写的**，不是 WorkBuddy 资产：
对照 WB `tencent-docx` 的 `format-extract`，我们**没有搬**它自带的预构建 `dist/cli.cjs`
（几 MB node 产物，与「文档流水线走我们的 Python 引擎」相悖），改用 `python-docx` 自研；
也**不提供**它的 `assess`（HTML 转换质量 5 项评估）——那部分由 `html-review` 技能承接。

### 目录布局（一个职责一个文件）

```
resources/docx-engine/docx_to_html/
  __main__.py        # CLI（click）：extract 子命令 + 单行 JSON 契约
  __init__.py        # 公开 API：extract(ExtractOptions) → ExtractResult
  types.py           # ExtractOptions / ExtractResult / ImageAsset
  errors.py          # DocxExtractError（输入类失败，消息给人看）
  package.py         # .docx（OPC zip）打开与校验 + 条目读取（stdlib zipfile）
  context.py         # 渲染期共享状态（文档 + 编号解析 + 图片收集 + 警告去重）
  style_map.py       # 样式映射**数据表**（标题/对齐/字号/颜色 + 边框换算）
  inline_style.py    # run / 段落 → inline CSS 声明（分层继承规则见文件头）
  lists.py           # 编号解析（numId/ilvl → 有序/无序 + 层级）+ 嵌套 ul/ol 组装
  paragraphs.py      # 段落 → 标题/正文/空段落；run 遍历（含超链接/内容控件里的 run）
  tables.py          # 表格 → thead/th + 单元格 + 基础边框
  images.py          # 图片引用登记与落盘（<assets-dir>/images/）
  not_restorable.py  # 「已知不可复原项」的检测（命中才报）
  document.py        # body 顺序遍历 + HTML5 文档组装
  extractor.py       # 顶层编排：校验 → 渲染 → 原子落盘
  tests/             # pytest（现造 fixture，仓里不留二进制）
```

### 调用契约（与正向**同形**）

```bash
python -m docx_to_html extract input.docx -o out.html [--assets-dir DIR]
```

- **exit 0** → stdout 单行 JSON：
  `{"success": true, "html_path", "assets_dir", "images": [{"src","file","source"}], "warnings", "not_restorable"}`
- **exit 1** → stderr 单行 JSON：`{"success": false, "error", "warnings"}`。
  坏输入（路径不存在 / 不是 .docx / 不是 zip / 缺 `word/document.xml`）一律走这条，
  **不产出半成品 HTML**（整份 HTML 先在内存里生成完，最后一步临时文件 + 原子替换）。
- 日志/进度不污染 stdout；JSON 用 `ensure_ascii=True`（非 ASCII 转 `\uXXXX`），与正向一致。
- **`--assets-dir` 缺省**：`<html 所在目录>/<html 文件名去扩展名>_assets`
  （如 `out/doc.html` → `out/doc_assets`）。HTML 里的图片引用一律写成
  **相对 HTML 文件所在目录**的路径（如缺省布局下 `doc_assets/images/image1.png`），
  所以把 HTML 的目录当 base_dir 就能解析到图 —— 与正向引擎
  （相对路径以输入 HTML 所在目录为 base_dir）同一套约定。
- 与正向**共用同一托管 venv**：同一 PYTHONPATH 约定（引擎目录）、同一
  `~/.venv-html-to-docx`，不新增任何依赖（只用 python-docx + stdlib zipfile/html）。

### 提取范围（六项，刻意不做更多）

| 项 | 规则 |
| --- | --- |
| 标题层级 | `Heading 1..6` → `h1..h6`；`Title`（文档大标题）→ `h1`；中文样式名 `标题1..6` 同样认；没有标题样式但带 `w:outlineLvl`（大纲级别 1..6 → h1..h6）也按标题出 |
| 段落 | 文本 + 对齐 + 首行缩进/左缩进 + 字号 + 字体 + 加粗/斜体/颜色 → **inline style**（不外链 CSS）；空段落保留为 `<p>&nbsp;</p>`，段落顺序与原文一致 |
| 列表 | 有序/无序 + 层级 → 嵌套 `ul`/`ol`/`li`；段落本级 `w:numPr` 与**样式上**的 `w:numPr` 都认（python-docx 生成的列表在样式上）；层级读不出来就退化为一层 |
| 表格 | 首行 → `thead/th`，其余 → `tbody/td`；单元格文本（多段用 `<br>` 连接）；基础边框（表级 `w:tblBorders` → 表样式 → 单元格 `w:tcBorders`，取第一处有值的） |
| 图片 | `word/media/*` 复制到 `<assets-dir>/images/`，HTML 里用**相对 HTML 目录**的路径引用（缺省布局下形如 `doc_assets/images/image1.png`），尺寸取 `wp:extent`（EMU→px） |
| 结构保真 | 空段落/分隔不吞、段落与表格按 body 真实顺序输出 |

样式映射都在 `style_map.py` 里是**数据表**（标题层级 / 对齐 / 字号 / 主题色各一张 dict），
新增映射只加一行数据，渲染逻辑不动。

### `not_restorable`（诚实性要求）

清单是**词表**，只有 docx 里**确实存在**对应内容才报，绝不无论什么输入都吐同一串名字：

- 页码（页眉页脚里真的有 `PAGE` 域；只看域指令第一个词，`PAGEREF` 不算）
- 页眉页脚（`word/header*.xml` / `footer*.xml` 里有非空文字或图片）
- 分节（body 里 `w:sectPr` 多于一个）
- 浮动对象（`w:pict` / `w:txbxContent` / `wp:anchor`）
- 域代码（`w:fldChar` / `w:instrText` / `w:fldSimple`）
- 图表（包里有 `word/charts/` 或 body 里有 `w:chart`）
- 补充项（词表之外、实际检测到才报）：脚注/尾注、批注、修订痕迹

### 已知限制（v1）

- **主题色取近似值**：run/样式只给 `w:themeColor` 而无字面 `w:val` 时，按 Office 默认
  主题色板映射（`COLOR_TO_CSS`）；自定义主题的文档色值可能与原稿不同。
- **合并单元格不还原**：按展开后的矩形输出（`gridSpan` / `vMerge` 命中时给 warnings）。
- **嵌套表格不提取**（单元格只保留文本，给 warnings）。
- **超链接地址不保留**（文字保留，给 warnings）；浮动图片按行内图片提取（位置/环绕丢失，给 warnings）。
- 页眉页脚 / 页码 / 分节 / 浮动对象 / 域代码 / 图表本身不反向提取（只在 `not_restorable` 里如实列出）。

### 测试

```bash
# 在 resources/docx-engine 下（或仓根 + 目录参数），必须用托管 venv 的 python
%USERPROFILE%\.venv-html-to-docx\Scripts\python.exe -m pytest docx_to_html/tests -q
```

覆盖：标题层级 / 段落样式映射 / 列表（含层级与退化）/ 表格（表头、边框、合并告警）/
图片导出 / 坏输入六类 / `not_restorable` 命中与不命中 / **真实往返**
（正向引擎产 docx → 反向读回，断言标题、表格、列表、关键串仍在，并打印 `not_restorable`）。
测试 fixture 一律现造（python-docx 临时生成 + Pillow 临时造图），仓里不留二进制。

## 托管环境（Windows 布局注意）

- venv 固定为 `~/.venv-html-to-docx`（即 `%USERPROFILE%\.venv-html-to-docx`），
  Windows 下解释器路径是 **`Scripts/python.exe`**（不是 POSIX 的 `bin/python`）。
- 依赖安装：`uv pip install --python <venv python> --only-binary=:all: -r requirements.txt`
  （`--only-binary=:all:` 绕开 lxml 无 libxml2/libxslt 时源码编译失败的坑）。
- 环境搭建/预热的幂等状态机在 `src/documents/docx-env.ts`（Task 2），本目录不含环境脚本。
