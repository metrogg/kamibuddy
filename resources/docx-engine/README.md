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
  html_to_docx/        # 引擎包（顶层 23 个 .py + components/ 子包 6 个 .py）
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

## 托管环境（Windows 布局注意）

- venv 固定为 `~/.venv-html-to-docx`（即 `%USERPROFILE%\.venv-html-to-docx`），
  Windows 下解释器路径是 **`Scripts/python.exe`**（不是 POSIX 的 `bin/python`）。
- 依赖安装：`uv pip install --python <venv python> --only-binary=:all: -r requirements.txt`
  （`--only-binary=:all:` 绕开 lxml 无 libxml2/libxslt 时源码编译失败的坑）。
- 环境搭建/预热的幂等状态机在 `src/documents/docx-env.ts`（Task 2），本目录不含环境脚本。
