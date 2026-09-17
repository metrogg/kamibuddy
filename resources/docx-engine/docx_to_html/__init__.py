"""docx_to_html — 反向模块：把 .docx 提取成语义化 HTML + 图片目录。

为什么存在：编排里「照这份文档的版式来」需要拿到**原文档的版式**
（标题层级 / 段落缩进与字体 / 表格 / 列表 / 图片），而 ``read_document`` 只给纯文本。
正向包 ``html_to_docx`` 是 WorkBuddy 搬用资产（见 ``../README.md``），本包为**自研**，
与它平级、共用同一托管 venv 与同一份「单行 JSON + exit 0/1」CLI 契约。

Quickstart:
    from docx_to_html import ExtractOptions, extract

    result = extract(ExtractOptions(docx_path="in.docx", output_path="out.html"))
    if result.success:
        print(result.html_path, result.not_restorable)
    else:
        print(result.error)
"""
from __future__ import annotations

from .extractor import extract
from .types import ExtractOptions, ExtractResult, ImageAsset

__all__ = ["extract", "ExtractOptions", "ExtractResult", "ImageAsset"]
