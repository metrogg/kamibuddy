"""_ooxml_borders.py — Shared OOXML border / shading construction utilities.

Single source of truth for CSS border / color parsing and ``w:{side}`` border
element construction, shared by both table cell/table borders
(``w:tcBorders`` / ``w:tblBorders`` in ``table_style_applier``) and paragraph
borders (``w:pBdr`` in ``style_mapper``). See C-CON-002 / D-R3: no dual-track.

Exports:
  - ``parse_border_shorthand(value) -> dict[str, str]``
  - ``BORDER_STYLE_MAP: dict[str, str]``
  - ``parse_color(value) -> str | None``    (6-hex without '#', or None)
  - ``build_border_element(side, info) -> OxmlElement``  (w:{side} for pBdr/tcBorders)
"""
from __future__ import annotations

import re

from docx.oxml import OxmlElement
from docx.oxml.ns import qn


# Maps CSS border-style to OOXML w:val values.
BORDER_STYLE_MAP: dict[str, str] = {
    "solid": "single",
    "dashed": "dashed",
    "dotted": "dotted",
    "double": "double",
    "none": "none",
    "hidden": "none",
}


def parse_color(value: str) -> str | None:
    """Parse a CSS color to a 6-digit hex string (without '#').

    Supports ``#rrggbb`` / ``#rgb`` / ``rgb(r,g,b)``. Returns None if
    unparseable (e.g. named colors / gradients).
    """
    value = value.strip()
    # #rrggbb or #rgb
    hex_m = re.match(r"^#([0-9a-fA-F]{3,6})$", value)
    if hex_m:
        h = hex_m.group(1)
        if len(h) == 3:
            h = h[0] * 2 + h[1] * 2 + h[2] * 2
        return h.upper()
    # rgb(r, g, b)
    rgb_m = re.match(r"^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$", value, re.I)
    if rgb_m:
        r, g, b = int(rgb_m.group(1)), int(rgb_m.group(2)), int(rgb_m.group(3))
        return f"{r:02X}{g:02X}{b:02X}"
    return None


def _parse_size_to_pt(value: str) -> float | None:
    """Convert a CSS size string to points (border width context)."""
    value = value.strip().lower()
    m = re.match(r"^([\d.]+)(px|pt|rem|em|cm|mm)?$", value)
    if not m:
        return None
    num = float(m.group(1))
    unit = m.group(2) or "pt"
    conversions = {"pt": num, "px": num * 0.75, "rem": num * 12, "em": num * 12,
                   "cm": num * 28.3465, "mm": num * 2.83465}
    return conversions.get(unit, num)


def parse_border_shorthand(value: str) -> dict[str, str]:
    """Parse a CSS border shorthand (e.g. '1px solid #333') into components.

    Returns a dict that may contain ``width`` / ``style`` / ``color`` keys.
    Unrecognized tokens are ignored.
    """
    parts = value.split()
    result: dict[str, str] = {}
    for part in parts:
        part = part.strip()
        if re.match(r"^[\d.]+(px|pt|cm|mm|em|rem)?$", part):
            result["width"] = part
        elif part.lower() in BORDER_STYLE_MAP:
            result["style"] = part.lower()
        elif part.startswith("#") or part.startswith("rgb"):
            result["color"] = part
    return result


def build_border_element(
    side: str, info: dict[str, str], default_color: str = "auto", space_pt: float = 0.0
) -> OxmlElement:
    """Build a ``w:{side}`` border element shared by pBdr / tcBorders / tblBorders.

    Width is encoded in eighths of a point (``w:sz`` = pt * 8); the default is
    4 (0.5pt) when width is absent/unparseable. Style maps via BORDER_STYLE_MAP
    (unknown → 'single'). When color is absent/unparseable, ``default_color`` is
    used — paragraphs pass 'auto' (per FR-002), tables pass '000000' to preserve
    the legacy table-border behavior (zero regression).

    ``space_pt`` maps to ``w:space`` (border-to-text distance in pt, rounded to
    int). Paragraph borders derive it from CSS ``padding-{side}`` so a left
    accent bar does not hug the text (html4docx drops padding entirely).
    """
    elem = OxmlElement(f"w:{side}")

    style = BORDER_STYLE_MAP.get(info.get("style", "solid"), "single")
    elem.set(qn("w:val"), style)

    width_pt = _parse_size_to_pt(info.get("width", "1px"))
    if width_pt:
        elem.set(qn("w:sz"), str(int(width_pt * 8)))
    else:
        elem.set(qn("w:sz"), "4")  # default 0.5pt

    elem.set(qn("w:space"), str(max(0, int(round(space_pt)))))

    raw_color = info.get("color")
    color_val = parse_color(raw_color) if raw_color else None
    elem.set(qn("w:color"), color_val or default_color)

    return elem
