"""toc_renderer.py — 把 ``<nav class="doc-toc">`` 渲染为 DOCX 目录。

渲染约定（见 specs/002-fix-toc-numbering/contracts/toc-component-contract.md）：
  ``<ol>`` / ``<li>``  → 普通段落，**不带自动编号**，层级用左缩进表达
  ``<a href="#x">``    → ``w:hyperlink w:anchor``，指向正文中同名规范化书签
  锚点无法解析         → 降级为纯文本，不生成死链
  ``data-page``        → 文本后追加 " ... N"

不走 ``html4docx`` 的通用列表逻辑，因此不会产生 ``ListNumber`` 样式与 ``numPr``
自动编号域——这正是目录出现 "1. 2. 3." 及嵌套编号错乱的根因。

缩进映射：1 级无缩进，2 级 0.5 cm，3 级及以上 1.0 cm。
"""
from __future__ import annotations

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm
from docx.text.paragraph import Paragraph

from .style_mapper import apply_paragraph_styles, apply_run_styles
from .toc_bookmarks import normalize_bookmark_name

_INDENT_MAP = {1: None, 2: Cm(0.5), 3: Cm(1.0)}
_MAX_LEVEL = 3

# 目录标题可能出现的标签（各模板写法不一，按位置 + 标签识别）。
_HEADING_TAGS = ("p", "h1", "h2", "h3", "h4", "h5", "h6", "div")


def render_toc(
    soup_nav,
    document: Document,
    anchor: Paragraph | None = None,
    resolved_anchors: set[str] | None = None,
) -> None:
    """把目录 nav 渲染为 *document* 中的段落。

    Args:
        soup_nav: ``<nav class="doc-toc">`` 元素。
        document: 目标文档。
        anchor: 占位段落；给出时目录被移动到该段落之前，保持原 HTML 位置。
        resolved_anchors: 已成功注入书签的 HTML ``id`` 集合；不在集合内的锚点
            降级为纯文本，避免生成指向不存在书签的死链。传 ``None`` 表示不做
            跳转渲染，全部输出纯文本。
    """
    if soup_nav is None:
        return
    root_list = soup_nav.find(["ol", "ul"])
    if root_list is None:
        return

    created: list[Paragraph] = []
    _render_headings(soup_nav, root_list, document, created)
    _render_list(root_list, document, level=1, resolved=resolved_anchors or set(), created=created)

    if anchor is not None:
        _move_before(created, anchor)


def _render_headings(
    soup_nav, root_list, document: Document, created: list[Paragraph]
) -> None:
    """渲染列表之前的标题块（如 ``<p class="toc-title">目录</p>``）。

    整个 nav 被抽为特殊区域，标题不再经由 html4docx，需在此补渲染，否则「目录」
    二字会丢失。各模板的标题写法不一（``toc-title`` / ``toc-heading`` / 仅内联样式），
    因此按位置识别：列表之前的块级元素即为标题区。
    """
    for el in root_list.find_previous_siblings():
        if getattr(el, "name", None) not in _HEADING_TAGS:
            continue
        text = el.get_text(strip=True)
        if not text:
            continue
        para = document.add_paragraph()
        run = para.add_run(text)
        style_attr = el.get("style", "")
        if style_attr:
            apply_paragraph_styles(para, style_attr)
            apply_run_styles(run, style_attr)
        # find_previous_siblings 是逆序，插到已渲染标题之前以还原原始顺序。
        created.insert(0, para)


def _render_list(
    list_el,
    document: Document,
    level: int,
    resolved: set[str],
    created: list[Paragraph],
) -> None:
    indent = _INDENT_MAP.get(level, Cm(1.0))

    for li in list_el.find_all("li", recursive=False):
        text, html_id = _extract_entry(li)

        page = li.get("data-page", "")
        if page:
            text = f"{text} ... {page}"

        para = document.add_paragraph()
        if indent is not None:
            para.paragraph_format.left_indent = indent

        if html_id and html_id in resolved:
            para._p.append(_build_hyperlink(normalize_bookmark_name(html_id), text))
        else:
            para.add_run(text)

        created.append(para)

        nested = li.find(["ol", "ul"])
        if nested and level < _MAX_LEVEL:
            _render_list(nested, document, level + 1, resolved, created)


def _extract_entry(li) -> tuple[str, str | None]:
    """从 ``<li>`` 取出显示文本与锚点 ``id``（不含 ``#``）。"""
    a_tag = li.find("a")
    if a_tag is not None:
        href = str(a_tag.get("href") or "")
        html_id = href[1:] if href.startswith("#") else None
        return a_tag.get_text(strip=True), html_id

    # 无链接：取直接文本，遇到嵌套列表即停，避免把子项文本并进来。
    parts: list[str] = []
    for child in li.children:
        if getattr(child, "name", None) in ("ol", "ul"):
            break
        if hasattr(child, "get_text"):
            parts.append(child.get_text(strip=True))
        elif isinstance(child, str):
            parts.append(child.strip())
    return " ".join(p for p in parts if p), None


def _build_hyperlink(bookmark_name: str, text: str):
    """构造指向文档内书签的超链接元素。

    Word 的 ``Hyperlink`` 字符样式只在 run 未携带直接格式时生效，因此在 run 上
    显式写入黑色字体色与 ``w:u val="none"``，覆盖默认的蓝色下划线外观。
    """
    hyperlink = OxmlElement("w:hyperlink")
    hyperlink.set(qn("w:anchor"), bookmark_name)

    run = OxmlElement("w:r")
    rPr = OxmlElement("w:rPr")

    fonts = OxmlElement("w:rFonts")
    fonts.set(qn("w:hint"), "eastAsia")
    rPr.append(fonts)

    color = OxmlElement("w:color")
    color.set(qn("w:val"), "000000")
    rPr.append(color)

    underline = OxmlElement("w:u")
    underline.set(qn("w:val"), "none")
    rPr.append(underline)

    run.append(rPr)

    text_node = OxmlElement("w:t")
    text_node.set(qn("xml:space"), "preserve")
    text_node.text = text
    run.append(text_node)

    hyperlink.append(run)
    return hyperlink


def _move_before(paragraphs: list[Paragraph], anchor: Paragraph) -> None:
    """把新建段落从文档末尾移到 *anchor* 之前，保持目录原有位置与顺序。"""
    for para in paragraphs:
        element = para._element
        parent = element.getparent()
        if parent is not None:
            parent.remove(element)
        anchor._element.addprevious(element)
