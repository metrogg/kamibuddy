"""style_mapper.py — CSS inline style → python-docx property mapping.

Handles the 14 CSS properties required by FR-003/FR-004:
  font-size, color, background-color, font-family, font-weight, font-style,
  text-decoration, text-align, line-height, margin-top, margin-bottom,
  text-indent, width/height (for images).

Also handles eastern-Asia (CJK) font family via rFonts.eastAsia (FR-004).
"""
from __future__ import annotations

import re
import warnings
from typing import TYPE_CHECKING

from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

from ._ooxml_borders import (
    BORDER_STYLE_MAP,
    build_border_element,
    parse_border_shorthand,
    parse_color as _parse_color_hex,
)

if TYPE_CHECKING:
    from docx.text.paragraph import Paragraph
    from docx.text.run import Run


# ---------------------------------------------------------------------------
# Unit conversion helpers
# ---------------------------------------------------------------------------

def _parse_size_to_pt(value: str, em_base_pt: float | None = None) -> float | None:
    """Convert a CSS size string to points. Returns None if unparseable.

    ``em`` is resolved against ``em_base_pt`` (the element's absolute font-size
    in pt). When ``em_base_pt`` is None it falls back to 12.0 (legacy behavior,
    regression-safe — see FR-001 / D-R4).
    """
    value = value.strip().lower()
    m = re.match(r"^([\d.]+)(px|pt|rem|em|cm|mm)?$", value)
    if not m:
        return None
    num = float(m.group(1))
    unit = m.group(2) or "pt"
    em_factor = em_base_pt if em_base_pt is not None else 12.0
    conversions = {
        "pt":  num,
        "px":  num * 0.75,          # 1px ≈ 0.75pt at 96dpi
        "rem": num * 12,            # assume 1rem = 16px = 12pt
        "em":  num * em_factor,
        "cm":  num * 28.3465,
        "mm":  num * 2.83465,
    }
    return conversions.get(unit, num)


def _parse_size_to_cm(value: str, em_base_pt: float | None = None) -> float | None:
    """Convert a CSS size string to centimetres. Returns None if unparseable.

    ``em`` is resolved against ``em_base_pt`` (element font-size in pt) via the
    pt→cm bridge, keeping em semantics consistent with ``_parse_size_to_pt``.
    Falls back to 12.0pt when ``em_base_pt`` is None (legacy-safe).
    """
    value = value.strip().lower()
    m = re.match(r"^([\d.]+)(px|pt|rem|em|cm|mm)?$", value)
    if not m:
        return None
    num = float(m.group(1))
    unit = m.group(2) or "px"
    em_factor = em_base_pt if em_base_pt is not None else 12.0
    conversions = {
        "cm":  num,
        "mm":  num / 10,
        "pt":  num / 28.3465,
        "px":  num / 37.7953,       # 1px ≈ 1/96 inch ≈ 0.02646 cm
        "rem": num * 16 / 37.7953,
        "em":  (num * em_factor) / 28.3465,   # em → pt → cm (consistent base)
    }
    return conversions.get(unit, num / 37.7953)


def _parse_color(value: str) -> RGBColor | None:
    """Parse a CSS color (#hex or rgb(...)) into an RGBColor."""
    value = value.strip()
    # #rrggbb or #rgb
    hex_m = re.match(r"^#([0-9a-fA-F]{3,6})$", value)
    if hex_m:
        h = hex_m.group(1)
        if len(h) == 3:
            h = h[0]*2 + h[1]*2 + h[2]*2
        try:
            return RGBColor(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
        except ValueError:
            return None
    # rgb(r, g, b)
    rgb_m = re.match(r"^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$", value, re.I)
    if rgb_m:
        return RGBColor(int(rgb_m.group(1)), int(rgb_m.group(2)), int(rgb_m.group(3)))
    return None


def _parse_style(style_attr: str) -> dict[str, str]:
    """Parse a CSS inline style string into a property→value dict."""
    props: dict[str, str] = {}
    for decl in style_attr.split(";"):
        decl = decl.strip()
        if ":" in decl:
            k, _, v = decl.partition(":")
            props[k.strip().lower()] = v.strip()
    return props


def _margin_shorthand_vertical(value: str) -> tuple[str | None, str | None]:
    """Extract (top, bottom) values from a CSS ``margin`` shorthand.

    Follows CSS 1–4 value rules:
      - 1 value  → all sides (top == bottom == value)
      - 2 values → top/bottom = v1, left/right = v2
      - 3 values → top = v1, left/right = v2, bottom = v3
      - 4 values → top, right, bottom, left
    Returns ``(top, bottom)`` as raw strings (each may be None if absent).
    """
    parts = value.split()
    if not parts:
        return None, None
    if len(parts) == 1:
        return parts[0], parts[0]
    if len(parts) == 2:
        return parts[0], parts[0]
    if len(parts) == 3:
        return parts[0], parts[2]
    return parts[0], parts[2]


# ---------------------------------------------------------------------------
# Run-level style application
# ---------------------------------------------------------------------------

def apply_run_styles(run: "Run", style_attr: str) -> None:
    """Apply CSS inline style properties to a python-docx Run."""
    props = _parse_style(style_attr)

    # font-size
    if "font-size" in props:
        pt = _parse_size_to_pt(props["font-size"])
        if pt is not None:
            run.font.size = Pt(pt)

    # color
    if "color" in props:
        color = _parse_color(props["color"])
        if color is not None:
            run.font.color.rgb = color

    # font-family (with CJK support)
    if "font-family" in props:
        apply_font_family(run, props["font-family"])

    # font-weight
    fw = props.get("font-weight", "")
    if fw in ("bold", "700", "800", "900"):
        run.font.bold = True
    elif fw in ("normal", "400"):
        run.font.bold = False

    # font-style
    fs = props.get("font-style", "")
    if fs == "italic" or fs == "oblique":
        run.font.italic = True

    # text-decoration
    td = props.get("text-decoration", "")
    if "underline" in td:
        run.font.underline = True
    if "line-through" in td:
        run.font.strike = True


# ---------------------------------------------------------------------------
# Paragraph-level style application
# ---------------------------------------------------------------------------

def apply_paragraph_styles(paragraph: "Paragraph", style_attr: str) -> None:
    """Apply CSS inline style properties to a python-docx Paragraph."""
    props = _parse_style(style_attr)
    fmt = paragraph.paragraph_format

    # Resolve the element's own font-size as the em base (FR-001 / D-R4).
    # Absent font-size → None → em falls back to 12pt (legacy-safe).
    em_base_pt: float | None = None
    if "font-size" in props:
        em_base_pt = _parse_size_to_pt(props["font-size"])

    # text-align
    align_map = {
        "left":    WD_ALIGN_PARAGRAPH.LEFT,
        "center":  WD_ALIGN_PARAGRAPH.CENTER,
        "right":   WD_ALIGN_PARAGRAPH.RIGHT,
        "justify": WD_ALIGN_PARAGRAPH.JUSTIFY,
    }
    if "text-align" in props:
        para_align = align_map.get(props["text-align"].lower())
        if para_align is not None:
            paragraph.alignment = para_align

    # text-indent (em resolved against element font-size)
    if "text-indent" in props:
        cm = _parse_size_to_cm(props["text-indent"], em_base_pt=em_base_pt)
        if cm is not None:
            fmt.first_line_indent = Cm(cm)

    # line-height
    if "line-height" in props:
        lh = props["line-height"].strip()
        if lh != "normal":
            # Unitless → proportional (e.g. "1.7" = 1.7x)
            try:
                fmt.line_spacing = float(lh)
            except ValueError:
                # Has units → fixed spacing (e.g. "20pt" / "1.5em")
                pt = _parse_size_to_pt(lh, em_base_pt=em_base_pt)
                if pt is not None:
                    from docx.shared import Pt as _Pt
                    fmt.line_spacing = _Pt(pt)

    # margin shorthand → space_before / space_after (vertical components only).
    # Per-side margin-top/margin-bottom below override the shorthand.
    if "margin" in props:
        top_v, bottom_v = _margin_shorthand_vertical(props["margin"])
        if top_v is not None:
            pt = _parse_size_to_pt(top_v, em_base_pt=em_base_pt)
            if pt is not None:
                fmt.space_before = Pt(pt)
        if bottom_v is not None:
            pt = _parse_size_to_pt(bottom_v, em_base_pt=em_base_pt)
            if pt is not None:
                fmt.space_after = Pt(pt)

    # margin-top / margin-bottom → space_before / space_after
    # (em resolved against element font-size; absent → 12pt fallback)
    if "margin-top" in props:
        pt = _parse_size_to_pt(props["margin-top"], em_base_pt=em_base_pt)
        if pt is not None:
            fmt.space_before = Pt(pt)

    if "margin-bottom" in props:
        pt = _parse_size_to_pt(props["margin-bottom"], em_base_pt=em_base_pt)
        if pt is not None:
            fmt.space_after = Pt(pt)

    # border / border-{side} → pPr/pBdr/{side}  (FR-002)
    _apply_paragraph_borders(paragraph, props)

    # background[-color] (solid) → pPr/shd@w:fill  (FR-003)
    _apply_paragraph_shading(paragraph, props)


# Known CSS border-style keywords (recognized → mapped; others → warn+single).
_KNOWN_BORDER_STYLE_TOKENS = set(BORDER_STYLE_MAP.keys())
_BORDER_SIDES_PARA = ("top", "bottom", "left", "right")


def _warn_unknown_border_style(value: str) -> None:
    """Emit a warning if a border shorthand contains an unrecognized style."""
    for part in value.split():
        p = part.strip().lower()
        if re.match(r"^[\d.]+(px|pt|cm|mm|em|rem)?$", p):
            continue  # width
        if p.startswith("#") or p.startswith("rgb"):
            continue  # color
        if p in _KNOWN_BORDER_STYLE_TOKENS:
            continue  # known style
        # Unrecognized token (e.g. groove/ridge/inset) → fall back to single.
        warnings.warn(
            f"Unknown border-style {part!r}; falling back to 'single'.",
            UserWarning,
            stacklevel=3,
        )


def _apply_paragraph_borders(paragraph: "Paragraph", props: dict[str, str]) -> None:
    """Map border / border-{side} CSS to pPr/pBdr/{side} (FR-002).

    Reuses the shared border parsing/construction (C-CON-002). Missing color →
    'auto'; unknown style → 'single' + warning. Width encoded in eighths of pt.
    """
    border_info: dict[str, dict[str, str]] = {}

    # border shorthand → all four sides
    if "border" in props:
        _warn_unknown_border_style(props["border"])
        parsed = parse_border_shorthand(props["border"])
        for side in _BORDER_SIDES_PARA:
            border_info[side] = dict(parsed)

    # per-side overrides
    for side in _BORDER_SIDES_PARA:
        side_key = f"border-{side}"
        if side_key in props:
            _warn_unknown_border_style(props[side_key])
            parsed = parse_border_shorthand(props[side_key])
            border_info.setdefault(side, {}).update(parsed)
        color_key = f"border-{side}-color"
        if color_key in props:
            border_info.setdefault(side, {})["color"] = props[color_key]
        style_key = f"border-{side}-style"
        if style_key in props:
            _warn_unknown_border_style(props[style_key])
            border_info.setdefault(side, {})["style"] = props[style_key].strip().lower()

    if not border_info:
        return

    pPr = paragraph._p.get_or_add_pPr()
    pBdr = pPr.find(qn("w:pBdr"))
    if pBdr is None:
        pBdr = OxmlElement("w:pBdr")
        pPr.append(pBdr)

    # Resolve em_base for padding → pt conversion (same logic as indent).
    em_base_pt: float | None = None
    fs_raw = props.get("font-size")
    if fs_raw:
        em_base_pt = _parse_size_to_pt(fs_raw)

    for side in _BORDER_SIDES_PARA:
        info = border_info.get(side)
        if not info:
            continue
        # Derive w:space from CSS padding-{side} (border-to-text distance).
        space_pt = 0.0
        pad_raw = props.get(f"padding-{side}")
        if pad_raw:
            parsed = _parse_size_to_pt(pad_raw, em_base_pt)
            if parsed and parsed > 0:
                space_pt = parsed
        # Paragraph borders use 'auto' as the missing-color default (FR-002).
        elem = build_border_element(side, info, default_color="auto", space_pt=space_pt)
        existing = pBdr.find(qn(f"w:{side}"))
        if existing is not None:
            pBdr.remove(existing)
        pBdr.append(elem)


def _apply_paragraph_shading(paragraph: "Paragraph", props: dict[str, str]) -> None:
    """Map background[-color] (solid) to pPr/shd@w:fill (FR-003).

    Gradient / url(...) / non-hex keyword backgrounds are ignored with a
    warning (no exception). ``background`` shorthand uses only its color token.
    """
    raw = props.get("background-color")
    if raw is None:
        raw = props.get("background")
    if raw is None:
        return

    raw = raw.strip()

    # Reject gradients / images explicitly with a warning.
    low = raw.lower()
    if "gradient" in low or "url(" in low:
        warnings.warn(
            f"Unsupported background {raw!r}; gradient/image ignored.",
            UserWarning,
            stacklevel=2,
        )
        return

    # Extract a parseable color token (handles 'background' shorthand).
    fill = _parse_color_hex(raw)
    if fill is None:
        for tok in raw.split():
            c = _parse_color_hex(tok.strip())
            if c is not None:
                fill = c
                break

    if fill is None:
        warnings.warn(
            f"Unsupported/keyword background {raw!r}; ignored.",
            UserWarning,
            stacklevel=2,
        )
        return

    pPr = paragraph._p.get_or_add_pPr()
    shd = pPr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        pPr.append(shd)
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)


# ---------------------------------------------------------------------------
# CJK / eastAsia font family (FR-004)
# ---------------------------------------------------------------------------

_CJK_FONT_NAMES = {
    "仿宋", "仿宋_gb2312", "fangsong", "fangsong_gb2312",
    "宋体", "simsun",
    "黑体", "simhei",
    "楷体", "kaiti", "楷体_gb2312",
    "微软雅黑", "microsoft yahei",
    "思源黑体", "source han sans",
    "思源宋体", "source han serif",
    "华文仿宋", "华文楷体", "华文宋体", "华文黑体",
}


def _is_cjk_font(font_name: str) -> bool:
    return font_name.strip().lower() in _CJK_FONT_NAMES


def apply_font_family(run: "Run", font_family_value: str) -> None:
    """Set font name on a run, including eastAsia for CJK fonts.

    Sets w:ascii, w:hAnsi, and w:eastAsia on the run's rFonts element so
    that both Latin and CJK characters render with the intended typeface.
    """
    # Take the first font in the comma-separated list
    fonts = [f.strip().strip("'\"") for f in font_family_value.split(",")]
    primary = fonts[0] if fonts else font_family_value.strip().strip("'\"")

    run.font.name = primary

    # Always set eastAsia for better CJK rendering; for CJK-named fonts also
    # force the rFonts attributes explicitly via XML.
    rPr = run._r.get_or_add_rPr()
    rFonts = rPr.find(qn("w:rFonts"))
    if rFonts is None:
        rFonts = OxmlElement("w:rFonts")
        rPr.insert(0, rFonts)

    rFonts.set(qn("w:ascii"),    primary)
    rFonts.set(qn("w:hAnsi"),    primary)
    rFonts.set(qn("w:eastAsia"), primary)
    if _is_cjk_font(primary):
        rFonts.set(qn("w:hint"), "eastAsia")
