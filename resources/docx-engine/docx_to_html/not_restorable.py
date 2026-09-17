"""not_restorable.py — 「已知不可复原项」的如实检测。

为什么必须逐项检测、而不是每份文档都吐同一串名字：固定清单会让用户以为
「每份文档都丢了页眉和图表」——那是骗人。这里的规矩是：

* ``CATALOG`` 只是**词表**，只有 docx 里**确实存在**对应内容才报
  （真的有非空 ``header*.xml`` 才报页眉页脚；页眉页脚里真的带 PAGE 域才报页码）；
* 词表之外若还发现别的丢内容（脚注/尾注、批注、修订痕迹），作为补充项报出。

检测口径写得很保守：「有内容」= 有非空文字或图片/图形对象；纯格式空壳不算。
"""
from __future__ import annotations

import xml.etree.ElementTree as ET
from typing import TYPE_CHECKING, Iterator

if TYPE_CHECKING:
    from docx.document import Document as DocxDocument

    from .context import RenderContext
    from .package import DocxPackage

CATALOG: tuple[str, ...] = (
    "页码",
    "页眉页脚",
    "分节",
    "浮动对象（文本框、形状）",
    "域代码",
    "图表",
)

SUPPLEMENTARY: tuple[str, ...] = ("脚注/尾注", "批注", "修订痕迹")

_FLOATING_OBJECT_TAGS = frozenset({"pict", "txbxContent", "txbx", "anchor", "framePr"})
_FIELD_TAGS = frozenset({"fldChar", "instrText", "fldSimple"})
_REVISION_TAGS = frozenset({"ins", "del"})
_NOTE_TAGS = frozenset({"footnote", "endnote"})
_NON_CONTENT_NOTE_TYPES = frozenset({"separator", "continuationSeparator", "continuationNotice"})
_OBJECT_TAGS = frozenset({"drawing", "pict"})

FOOTNOTES_ENTRY = "word/footnotes.xml"
ENDNOTES_ENTRY = "word/endnotes.xml"
COMMENTS_ENTRY = "word/comments.xml"


def detect(
    package: "DocxPackage", document: "DocxDocument", ctx: "RenderContext"
) -> list[str]:
    """返回本文档实际命中的不可复原项（按 CATALOG → SUPPLEMENTARY 顺序）。"""
    document_names = _tag_names(document.element)
    header_footer_trees = [
        tree
        for entry in package.header_footer_entries()
        if (tree := _parse_part(package, entry, ctx)) is not None
    ]

    found: dict[str, bool] = {
        "页码": any(_has_page_field(tree) for tree in header_footer_trees),
        "页眉页脚": any(_has_visible_content(tree) for tree in header_footer_trees),
        "分节": _count_tag(document.element, "sectPr") > 1,
        "浮动对象（文本框、形状）": bool(document_names & _FLOATING_OBJECT_TAGS),
        "域代码": bool(document_names & _FIELD_TAGS),
        "图表": package.has_chart_entries() or "chart" in document_names,
        "脚注/尾注": _note_parts_have_content(package, ctx),
        "批注": _part_has_content(package, COMMENTS_ENTRY, ctx),
        "修订痕迹": bool(document_names & _REVISION_TAGS),
    }
    return [name for name in (*CATALOG, *SUPPLEMENTARY) if found[name]]


# ── XML 读取 ────────────────────────────────────────────────────────

def _parse_part(package: "DocxPackage", entry: str, ctx: "RenderContext") -> ET.Element | None:
    try:
        return ET.fromstring(package.read(entry))
    except ET.ParseError as exc:
        ctx.warn(f"无法解析 {entry}（{exc}），该部分内容可能未被完整检测")
        return None


def _note_parts_have_content(package: "DocxPackage", ctx: "RenderContext") -> bool:
    for entry in (FOOTNOTES_ENTRY, ENDNOTES_ENTRY):
        if not package.has(entry):
            continue
        tree = _parse_part(package, entry, ctx)
        if tree is None:
            continue
        for note in tree.iter():
            if _local_name(note.tag) not in _NOTE_TAGS:
                continue
            if _attribute(note, "type") in _NON_CONTENT_NOTE_TYPES:
                continue
            if _has_visible_content(note):
                return True
    return False


def _part_has_content(package: "DocxPackage", entry: str, ctx: "RenderContext") -> bool:
    if not package.has(entry):
        return False
    tree = _parse_part(package, entry, ctx)
    return tree is not None and _has_visible_content(tree)


# ── 元素级判定 ──────────────────────────────────────────────────────

def _local_name(tag: object) -> str:
    if not isinstance(tag, str):
        return ""
    return tag.rsplit("}", 1)[-1]


def _tag_names(element: ET.Element) -> set[str]:
    return {_local_name(child.tag) for child in element.iter()}


def _count_tag(element: ET.Element, name: str) -> int:
    return sum(1 for child in element.iter() if _local_name(child.tag) == name)


def _attribute(element: ET.Element, name: str) -> str | None:
    for key, value in element.attrib.items():
        if _local_name(key) == name:
            return value
    return None


def _iter_texts(element: ET.Element) -> Iterator[str]:
    for child in element.iter():
        if _local_name(child.tag) == "t" and child.text:
            yield child.text


def _has_visible_content(element: ET.Element) -> bool:
    """有非空文字，或有图片/图形对象 —— 纯空壳（只有格式、没有内容）不算。"""
    if any(text.strip() for text in _iter_texts(element)):
        return True
    return any(_local_name(child.tag) in _OBJECT_TAGS for child in element.iter())


def _has_page_field(element: ET.Element) -> bool:
    """是否有 PAGE 域（页码）。只看域指令的第一个词，避免把 PAGEREF 误判成页码。"""
    for child in element.iter():
        name = _local_name(child.tag)
        if name == "instrText" and child.text is not None:
            if _is_page_instruction(child.text):
                return True
        elif name == "fldSimple":
            instruction = _attribute(child, "instr")
            if instruction is not None and _is_page_instruction(instruction):
                return True
    return False


def _is_page_instruction(instruction: str) -> bool:
    tokens = instruction.strip().split()
    return bool(tokens) and tokens[0].upper() == "PAGE"
