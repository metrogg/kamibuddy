"""page_setup.py — DOCX page-level defaults resolver (D-R5 single-writer).

Reads document-level defaults from:
1. <meta name="docx-page-size" content="A4|Letter|A3">
2. <meta name="docx-orientation" content="portrait|landscape">
3. <meta name="docx-margin-top/bottom/left/right" content="<cm>">
4. ConvertOptions (takes precedence over meta tags)

D-R5 single-writer architecture (S-26060126E): this module **only produces**
``PageDefaults`` and no longer writes ``document.sections``. The sole writer of
``<w:sectPr>`` is ``section_model.apply_sections``, which uses ``PageDefaults``
as the merge base.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional

from bs4 import BeautifulSoup

# Page size dimensions in cm (width, height) in portrait orientation
_PAGE_SIZES: dict = {
    "A4":     (21.0,  29.7),
    "LETTER": (21.59, 27.94),
    "A3":     (29.7,  42.0),
}


@dataclass
class PageDefaults:
    """Document-level page defaults (data-model.md #6).

    ``width_cm`` / ``height_cm`` are the portrait-basis dimensions; landscape
    swapping is performed by ``apply_sections`` per section.
    """

    page_size: str
    width_cm: float
    height_cm: float
    orientation: Literal["portrait", "landscape"]
    margin_top: float       # cm, default 2.54
    margin_bottom: float    # cm, default 2.54
    margin_left: float      # cm, default 3.17
    margin_right: float     # cm, default 3.17


def resolve_page_defaults(html: str, options=None) -> PageDefaults:
    """Read ``<meta docx-*>`` and ConvertOptions, produce document defaults.

    Priority: options > meta > defaults (A4, portrait, 2.54/3.17 cm).
    Does **not** write ``document.sections`` — produces data only (D-R5).
    """
    # --- collect from <meta> tags -----------------------------------------
    soup = BeautifulSoup(html, "lxml")
    meta: dict = {}
    for tag in soup.find_all("meta", attrs={"name": True, "content": True}):
        name = tag["name"].lower()
        if name.startswith("docx-"):
            meta[name[5:]] = tag["content"]  # strip "docx-" prefix

    # --- resolve final values (options > meta > default) ------------------
    def _get(key: str, default: str) -> str:
        if options is not None:
            attr = key.replace("-", "_")
            val = getattr(options, attr, None)
            if val is not None:
                return str(val)
        return meta.get(key, default)

    page_size = _get("page-size", "A4").upper()
    orientation = _get("orientation", "portrait").lower()
    if orientation not in ("portrait", "landscape"):
        orientation = "portrait"

    def _get_float(key: str, default: float) -> float:
        try:
            return float(_get(key, str(default)))
        except (ValueError, TypeError):
            return default

    margin_top = _get_float("margin-top", 2.54)
    margin_bottom = _get_float("margin-bottom", 2.54)
    margin_left = _get_float("margin-left", 3.17)
    margin_right = _get_float("margin-right", 3.17)

    if page_size not in _PAGE_SIZES:
        page_size = "A4"
    width_cm, height_cm = _PAGE_SIZES[page_size]

    return PageDefaults(
        page_size=page_size,
        width_cm=width_cm,
        height_cm=height_cm,
        orientation=orientation,  # type: ignore[arg-type]
        margin_top=margin_top,
        margin_bottom=margin_bottom,
        margin_left=margin_left,
        margin_right=margin_right,
    )
