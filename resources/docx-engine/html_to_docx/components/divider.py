"""Divider component renderer.

Renders ``data-component="divider"`` as an empty paragraph with a
bottom border (visual horizontal rule).
"""
from __future__ import annotations

from docx.document import Document as DocxDocument
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.text.paragraph import Paragraph
from bs4 import Tag

from . import register
from ..style_mapper import apply_paragraph_styles


@register("divider")
def render_divider(element: Tag, document: DocxDocument, anchor: Paragraph | None) -> None:
    """Render a divider component into *document*."""
    para = document.add_paragraph()
    pPr = para._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "6")
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), "AAAAAA")
    pBdr.append(bottom)
    pPr.append(pBdr)

    # Apply inline style from element
    style_attr = element.get("style", "")
    if style_attr:
        apply_paragraph_styles(para, style_attr)

    if not anchor is None:
        para._element.getparent().remove(para._element)
        anchor._element.addprevious(para._element)
    
