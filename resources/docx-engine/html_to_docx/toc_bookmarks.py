"""toc_bookmarks.py — 为目录锚点在正文中注入配对的 Word 书签。

`html4docx` 只为带 ``id`` 的标题元素生成书签，挂在 ``<div id="...">`` 这类容器上的
锚点没有配对书签，目录条目点击无反应；且其生成的书签名沿用 HTML ``id``（含连字符），
不符合 Word 书签命名规范。

本模块负责：
  1. 把 HTML ``id`` 规范化为 Word 合法书签名（目录侧与正文侧共用同一函数，保证配对）。
  2. 在正文对应段落插入 ``w:bookmarkStart`` / ``w:bookmarkEnd``。

锚点目标常是不产生 Word 段落的容器（如 ``<div>``），因此定位键取该元素内第一段可见
文本，按文档顺序对 ``document.paragraphs`` 做顺序双指针匹配——沿用
``body_paragraph_styler`` 已验证的范式。
"""
from __future__ import annotations

import hashlib
import re
from typing import TYPE_CHECKING

from bs4 import BeautifulSoup, Tag
from docx.oxml.ns import qn

from .bookmarks import _bookmark_end, _bookmark_start, _next_bookmark_id

if TYPE_CHECKING:
    from docx.document import Document as DocxDocument
    from docx.text.paragraph import Paragraph

# Word 书签名上限 40 字符；`_Toc` 前缀与 Word 自身的目录书签命名保持一致。
_BOOKMARK_PREFIX = "_Toc_"
_BOOKMARK_MAX_LEN = 40
_ILLEGAL_CHARS_RE = re.compile(r"[^A-Za-z0-9_]")

# converter.py 用于标记特殊区域占位段落的前缀。
_PLACEHOLDER_PREFIX = "\u200b__SPECIAL_REGION__:"

# section_model 注入的不可见 boundary marker，归一化时剔除。
_ZERO_WIDTH = "\u200b\u200c\u200d\ufeff"

# 会另起段落的块级标签，用于判断锚点目标内首个产生段落的元素。
_BLOCK_TAGS = ("p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "td", "th")


def normalize_bookmark_name(html_id: str) -> str:
    """把 HTML ``id`` 转为 Word 合法书签名。

    Word 书签名只允许字母、数字、下划线，须以字母或下划线开头，长度上限 40。
    目录侧的 ``w:anchor`` 与正文侧的 ``w:bookmarkStart`` 必须调用本函数，确保两端一致。
    """
    normalized = _ILLEGAL_CHARS_RE.sub("_", html_id)
    candidate = f"{_BOOKMARK_PREFIX}{normalized}"
    if len(candidate) > _BOOKMARK_MAX_LEN:
        digest = hashlib.sha256(html_id.encode("utf-8")).hexdigest()[:32]
        candidate = f"{_BOOKMARK_PREFIX}{digest}"
    return candidate


def normalize_text(text: str) -> str:
    """归一化文本用于顺序匹配：剔除零宽字符与所有空白。"""
    if not text:
        return ""
    for ch in _ZERO_WIDTH:
        text = text.replace(ch, "")
    return re.sub(r"\s+", "", text)


def collect_toc_anchors(nav: Tag) -> list[str]:
    """按文档顺序收集目录中引用的 HTML ``id``（去重、保序）。"""
    anchors: list[str] = []
    seen: set[str] = set()
    for a_tag in nav.find_all("a"):
        href = str(a_tag.get("href") or "")
        if not href.startswith("#"):
            continue
        html_id = href[1:]
        if not html_id or html_id in seen:
            continue
        seen.add(html_id)
        anchors.append(html_id)
    return anchors


def _first_visible_text(element: Tag) -> str:
    """取元素内第一个产生 Word 段落的可见文本。

    锚点目标若是 ``<div id="x"><h2>引言</h2>...</div>``，``<div>`` 本身不产生段落，
    书签应落在 ``<h2>`` 对应的段落上。
    """
    for child in element.find_all(_BLOCK_TAGS):
        text = normalize_text(child.get_text())
        if text:
            return text
    return normalize_text(element.get_text())


def _existing_bookmark_names(document: DocxDocument) -> set[str]:
    return {
        name
        for element in document.element.iter(qn("w:bookmarkStart"))
        if (name := element.get(qn("w:name")))
    }


def _iter_body_paragraphs(document: DocxDocument):
    for para in document.paragraphs:
        if para.text.startswith(_PLACEHOLDER_PREFIX):
            continue
        yield para


def _wrap_paragraph_with_bookmark(
    paragraph: Paragraph, bookmark_name: str, bookmark_id: int
) -> None:
    """在段落首尾插入配对的书签标记。"""
    p_element = paragraph._p
    p_element.insert(0, _bookmark_start(bookmark_id, bookmark_name))
    p_element.append(_bookmark_end(bookmark_id))


def inject_toc_bookmarks(
    document: DocxDocument, clean_html: str, anchors: list[str]
) -> tuple[set[str], list[str]]:
    """为 *anchors* 中的 HTML ``id`` 在正文对应段落注入书签。

    Args:
        document: 已完成占位替换的 docx 文档。
        clean_html: style_injector 内联后、placeholder 替换前的 HTML 快照。
        anchors: 目录引用的 HTML ``id`` 列表（文档顺序）。

    Returns:
        ``(resolved_ids, warnings)``：成功注入书签的 ``id`` 集合，以及未能定位的警告。
        未解析的 ``id`` 由目录渲染侧降级为纯文本，避免生成死链。
    """
    if not anchors:
        return set(), []

    soup = BeautifulSoup(clean_html, "lxml")

    # 按元素在文档中出现的顺序排列锚点目标，保证顺序双指针匹配的前提成立。
    targets: list[tuple[str, str]] = []
    warnings: list[str] = []
    for html_id in anchors:
        element = soup.find(id=html_id)
        if element is None:
            warnings.append(f"TOC anchor target not found in HTML: id={html_id!r}")
            continue
        locator = _first_visible_text(element)
        if not locator:
            warnings.append(f"TOC anchor target has no visible text: id={html_id!r}")
            continue
        targets.append((html_id, locator))

    if not targets:
        return set(), warnings

    ordered_ids = [el.get("id") for el in soup.find_all(id=True)]
    order_index = {html_id: idx for idx, html_id in enumerate(ordered_ids)}
    targets.sort(key=lambda item: order_index.get(item[0], len(order_index)))

    paragraphs: list[Paragraph] = list(_iter_body_paragraphs(document))
    if not paragraphs:
        return set(), warnings

    used_names = _existing_bookmark_names(document)
    next_id = _next_bookmark_id(document)
    resolved: set[str] = set()

    para_idx = 0
    for html_id, locator in targets:
        match_idx = -1
        for i in range(para_idx, len(paragraphs)):
            ptext = normalize_text(paragraphs[i].text)
            if ptext and (ptext == locator or locator in ptext or ptext in locator):
                match_idx = i
                break
        if match_idx == -1:
            warnings.append(
                f"TOC anchor could not be located in docx: id={html_id!r}"
            )
            continue

        name = normalize_bookmark_name(html_id)
        if name in used_names:
            warnings.append(f"Duplicate TOC bookmark name skipped: {name!r}")
            continue

        _wrap_paragraph_with_bookmark(paragraphs[match_idx], name, next_id)
        used_names.add(name)
        resolved.add(html_id)
        next_id += 1
        para_idx = match_idx + 1

    return resolved, warnings
