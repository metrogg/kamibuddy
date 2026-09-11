"""style_injector.py — CSS selector parsing + class inlining + tag style extraction.

Phase 0b preprocessor (runs after css_resolver, before special region extraction).

Responsibilities:
  1. Parse <style> blocks: extract tag selectors (body, p, h1-h6) and class selectors (.xxx)
  2. Inline class selectors into matching elements' style attributes
  3. Return tag_styles dict for later application to docx built-in styles

Phase 2b: apply_tag_styles_to_document() writes tag selector rules into docx
built-in styles (Normal, Heading 1-6).

Covers: FR-024 ~ FR-025c
"""
from __future__ import annotations

import re
from typing import TYPE_CHECKING

from bs4 import BeautifulSoup

if TYPE_CHECKING:
    from docx.document import Document as DocxDocument

# ---------------------------------------------------------------------------
# CSS rule parsing — supports tag, .class, [attr], [attr="val"], combos
# ---------------------------------------------------------------------------

# Matches: selector(s) { declarations }
# Captures the full selector string (may contain commas) and the declarations block.
_RULE_BLOCK_RE = re.compile(
    r"""
    ([^{}@/]+?)       # selector(s) — everything before the brace that isn't @rule or comment
    \s*\{             # opening brace
    ([^}]*)           # declarations block
    \}                # closing brace
    """,
    re.VERBOSE | re.DOTALL,
)

# Tags that map to docx built-in styles
_TAG_STYLE_MAP: dict[str, str] = {
    "body": "Normal",
    "p": "Normal",
    "h1": "Heading 1",
    "h2": "Heading 2",
    "h3": "Heading 3",
    "h4": "Heading 4",
    "h5": "Heading 5",
    "h6": "Heading 6",
}

# Simple tag selector pattern (exact match: just a tag name like "body", "p", "h1")
_SIMPLE_TAG_RE = re.compile(r"^[a-z][a-z0-9]*$")

# CSS properties that html4docx cannot handle and will raise on when they end
# up inlined into element style attributes (e.g. `border-radius: 50%` throws
# `KeyError: 'radius'` inside html4docx, aborting the whole conversion mid-table
# and silently truncating downstream content). Word has no representation for
# these anyway, so we strip them at the injection layer — they never reach
# html4docx nor our own docx style appliers.
#
# Match is prefix-based (case-insensitive): any property starting with one of
# these strings is dropped. This covers longhand variants automatically:
#   border-radius / border-top-left-radius / ...
_UNSUPPORTED_PROP_PREFIXES: tuple[str, ...] = (
    "border-radius",
    "border-top-left-radius",
    "border-top-right-radius",
    "border-bottom-left-radius",
    "border-bottom-right-radius",
)


def _is_unsupported_prop(key: str) -> bool:
    """Return True if *key* is a CSS property html4docx / docx cannot handle."""
    return any(key.startswith(p) for p in _UNSUPPORTED_PROP_PREFIXES)


def _parse_declarations(decl_block: str) -> dict[str, str]:
    """Parse a CSS declarations block into a property→value dict.

    Drops properties listed in :data:`_UNSUPPORTED_PROP_PREFIXES` — these
    would either crash html4docx (e.g. ``border-radius``) or be silently
    ignored by our docx appliers, so filtering here keeps both paths clean.
    """
    props: dict[str, str] = {}
    for decl in decl_block.split(";"):
        decl = decl.strip()
        if ":" in decl:
            key, _, val = decl.partition(":")
            key = key.strip().lower()
            val = val.strip()
            if key and val and not _is_unsupported_prop(key):
                props[key] = val
    return props


def _declarations_to_str(props: dict[str, str]) -> str:
    """Convert a property dict back to a CSS inline style string."""
    return "; ".join(f"{k}: {v}" for k, v in props.items())


def _merge_styles(existing_inline: str, new_styles: dict[str, str]) -> str:
    """Merge new styles into an existing inline style string.

    Priority: existing inline properties win (new only fills missing props).
    """
    existing_props = _parse_declarations(existing_inline)
    merged = dict(new_styles)  # start with new
    merged.update(existing_props)  # existing wins
    return _declarations_to_str(merged)


def _is_simple_tag_selector(selector: str) -> bool:
    """Check if selector is a simple tag name (no class, no attr, no combinator)."""
    return bool(_SIMPLE_TAG_RE.match(selector.strip()))


def _selector_can_select(selector: str) -> bool:
    """Check if a selector is safe to use with bs4 select() (skip pseudo-elements etc)."""
    # Skip pseudo-elements/pseudo-classes and * selector
    if "::" in selector or ":before" in selector or ":after" in selector:
        return False
    if ":hover" in selector or ":focus" in selector or ":active" in selector:
        return False
    if selector.strip() == "*":
        return False
    return True


# ---------------------------------------------------------------------------
# Public API: inject_styles (Phase 0b)
# ---------------------------------------------------------------------------

def inject_styles(html: str) -> tuple[str, dict[str, dict[str, str]]]:
    """Parse CSS selectors, inline matching styles, extract tag styles.

    Supports: tag selectors, .class selectors, [attr] selectors,
    [attr="value"] selectors, and combinations thereof.

    Uses bs4's select() for matching — any valid CSS selector that bs4
    supports will work.

    Args:
        html: HTML string (CSS variables already resolved).

    Returns:
        (processed_html, tag_styles) where:
        - processed_html: HTML with selector styles inlined into matching elements
        - tag_styles: dict mapping tag name → CSS property dict
    """
    soup = BeautifulSoup(html, "lxml")

    tag_styles: dict[str, dict[str, str]] = {}
    # List of (selector_str, props_dict) for element matching
    element_rules: list[tuple[str, dict[str, str]]] = []

    # Step 1: Extract rules from <style> tags
    for style_tag in soup.find_all("style"):
        css_text = style_tag.string or ""
        # Remove comments
        css_text = re.sub(r"/\*.*?\*/", "", css_text, flags=re.DOTALL)
        # Remove @media blocks (not supported)
        css_text = re.sub(r"@media[^{]*\{[^}]*(\{[^}]*\}[^}]*)*\}", "", css_text, flags=re.DOTALL)
        # Remove :root blocks (already handled by css_resolver)
        css_text = re.sub(r":root\s*\{[^}]*\}", "", css_text, flags=re.DOTALL)

        for match in _RULE_BLOCK_RE.finditer(css_text):
            selectors_str = match.group(1).strip()
            declarations = match.group(2)
            props = _parse_declarations(declarations)
            if not props:
                continue

            # Handle comma-separated selectors
            for selector in selectors_str.split(","):
                selector = selector.strip()
                if not selector:
                    continue

                # Simple tag selector in _TAG_STYLE_MAP → goes to tag_styles for docx built-in style
                if _is_simple_tag_selector(selector) and selector.lower() in _TAG_STYLE_MAP:
                    tag = selector.lower()
                    if tag in tag_styles:
                        tag_styles[tag].update(props)
                    else:
                        tag_styles[tag] = dict(props)
                else:
                    # All other selectors (including tag selectors like table/td/th
                    # not in _TAG_STYLE_MAP) → will be matched against elements
                    if _is_simple_tag_selector(selector) or _selector_can_select(selector):
                        element_rules.append((selector, dict(props)))

    # Step 2: For each element, collect all matching rules in order,
    # merge them (later rules override earlier), then merge with original
    # inline style (original inline wins over everything).
    
    # First, save original inline styles before any injection
    original_styles: dict[int, str] = {}
    for el in soup.find_all(style=True):
        original_styles[id(el)] = el["style"]

    # Apply rules in order: later rules override earlier for same property
    for selector, props in element_rules:
        try:
            matched = soup.select(selector)
        except Exception:  # noqa: BLE001 — invalid selector, skip
            continue
        for el in matched:
            # Get currently accumulated injected styles (not original)
            current = el.get("style", "")
            # Merge: new rule props override previously injected props
            current_props = _parse_declarations(current)
            current_props.update(props)  # later rule wins
            el["style"] = _declarations_to_str(current_props)

    # Finally, restore original inline style priority (original wins over injected)
    for el in soup.find_all(style=True):
        original = original_styles.get(id(el), "")
        if original:
            current = el.get("style", "")
            # Re-merge: original inline properties override injected
            el["style"] = _merge_styles(original, _parse_declarations(current))

    return str(soup), tag_styles


# ---------------------------------------------------------------------------
# Public API: apply_tag_styles_to_document (Phase 2b)
# ---------------------------------------------------------------------------

def apply_tag_styles_to_document(document: "DocxDocument", tag_styles: dict[str, dict[str, str]]) -> None:
    """Apply tag selector CSS rules to docx built-in styles.

    Modifies the document's style definitions (Normal, Heading 1-6) so that
    all paragraphs/headings inherit the correct defaults.
    """
    from .style_mapper import (
        _parse_size_to_pt,
        _parse_color,
        apply_font_family,
    )
    from docx.shared import Pt, Cm
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement

    for tag, props in tag_styles.items():
        style_name = _TAG_STYLE_MAP.get(tag)
        if not style_name:
            continue

        # Get or skip style (some documents may not have all heading styles)
        try:
            style = document.styles[style_name]
        except KeyError:
            continue

        # --- Font / Run-level properties ---
        font = style.font

        if "font-size" in props:
            pt = _parse_size_to_pt(props["font-size"])
            if pt is not None:
                font.size = Pt(pt)

        if "color" in props:
            color = _parse_color(props["color"])
            if color is not None:
                font.color.rgb = color

        if "font-family" in props:
            # Set font name + eastAsia via style's font object
            fonts = [f.strip().strip("'\"") for f in props["font-family"].split(",")]
            primary = fonts[0] if fonts else props["font-family"].strip().strip("'\"")
            font.name = primary
            # Set eastAsia via XML on the style's rPr
            rPr = style.element.get_or_add_rPr()
            rFonts = rPr.find(qn("w:rFonts"))
            if rFonts is None:
                rFonts = OxmlElement("w:rFonts")
                rPr.insert(0, rFonts)
            rFonts.set(qn("w:ascii"), primary)
            rFonts.set(qn("w:hAnsi"), primary)
            rFonts.set(qn("w:eastAsia"), primary)
            # Remove theme references — Word prioritizes theme over explicit font name
            for theme_attr in ("w:asciiTheme", "w:hAnsiTheme", "w:eastAsiaTheme", "w:cstheme"):
                if rFonts.get(qn(theme_attr)) is not None:
                    del rFonts.attrib[qn(theme_attr)]

        fw = props.get("font-weight", "")
        if fw in ("bold", "700", "800", "900"):
            font.bold = True
        elif fw in ("normal", "400"):
            font.bold = False

        fs = props.get("font-style", "")
        if fs in ("italic", "oblique"):
            font.italic = True

        # --- Paragraph-level properties ---
        para_fmt = style.paragraph_format

        if "line-height" in props:
            lh = props["line-height"].strip()
            if lh != "normal":
                # Check if it's a unitless multiplier (e.g. "1.7") or has units (e.g. "20pt")
                try:
                    # Unitless → proportional line spacing (e.g. 1.7 = 1.7x)
                    multiplier = float(lh)
                    # OOXML 中的行距定义与 CSS 的 line-height 定义不同，在 line-height 实际设为倍数时
                    # 其准确的倍数对应关系为：line_spacing = line_height - 1 + char.ascent / (char.ascent + char.descent)
                    # 由于这个本地运行没有测字工具，以中文比较常见的 0.85 为字体比例 = line_height * 0.85
                    para_fmt.line_spacing = multiplier * 0.85
                except ValueError:
                    # Has units → fixed line spacing
                    pt = _parse_size_to_pt(lh)
                    if pt is not None:
                        para_fmt.line_spacing = Pt(pt)

        if "margin-top" in props:
            pt = _parse_size_to_pt(props["margin-top"])
            if pt is not None:
                para_fmt.space_before = Pt(pt)

        if "margin-bottom" in props:
            pt = _parse_size_to_pt(props["margin-bottom"])
            if pt is not None:
                para_fmt.space_after = Pt(pt)

        if "text-indent" in props:
            from .style_mapper import _parse_size_to_cm
            cm = _parse_size_to_cm(props["text-indent"])
            if cm is not None:
                para_fmt.first_line_indent = Cm(cm)

        if "text-align" in props:
            from docx.enum.text import WD_ALIGN_PARAGRAPH
            align_map = {
                "left": WD_ALIGN_PARAGRAPH.LEFT,
                "center": WD_ALIGN_PARAGRAPH.CENTER,
                "right": WD_ALIGN_PARAGRAPH.RIGHT,
                "justify": WD_ALIGN_PARAGRAPH.JUSTIFY,
            }
            alignment = align_map.get(props["text-align"].lower())
            if alignment is not None:
                para_fmt.alignment = alignment


def ensure_paragraph_styles(document: DocxDocument) -> None:
    """Ensure all paragraphs without an explicit pStyle get Normal assigned.

    html4docx generates paragraphs without <w:pStyle> in their pPr. While Word
    treats them as Normal implicitly, explicit assignment ensures the Normal
    style properties (font, spacing, alignment) are properly applied — fixing
    issues like over-stretched spaces in justified text.
    """
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement

    # Get the Normal style's styleId (may differ by locale, e.g. "a1" in Chinese templates)
    try:
        normal_style = document.styles["Normal"]
        normal_id = normal_style.style_id
    except KeyError:
        return

    for para in document.paragraphs:
        pPr = para._p.find(qn("w:pPr"))
        if pPr is None:
            pPr = OxmlElement("w:pPr")
            para._p.insert(0, pPr)

        pStyle = pPr.find(qn("w:pStyle"))
        if pStyle is None:
            pStyle = OxmlElement("w:pStyle")
            pStyle.set(qn("w:val"), normal_id)
            pPr.insert(0, pStyle)


# ---------------------------------------------------------------------------
# Public API: apply_cjk_run_properties (Phase 2c)
# ---------------------------------------------------------------------------

def _contains_cjk(text: str) -> bool:
    """Check if text contains any CJK characters."""
    for ch in text:
        cp = ord(ch)
        if (0x4E00 <= cp <= 0x9FFF or 0x3400 <= cp <= 0x4DBF or
            0x20000 <= cp <= 0x2A6DF or 0x3000 <= cp <= 0x303F or
            0xFF00 <= cp <= 0xFFEF or 0xF900 <= cp <= 0xFAFF):
            return True
    return False


# 中英混排需要指明混排按照哪种字体，作为字属性注入
def apply_cjk_run_properties(document: DocxDocument, tag_styles: dict[str, dict[str, str]]) -> None:
    """Set eastAsia font properties on runs containing CJK characters.

    When the document's body font-family is a CJK font, this ensures Word
    correctly identifies runs as East Asian text for proper justification
    and kerning behavior.

    Sets on each CJK-containing run:
      <w:rFonts w:ascii="{font}" w:eastAsia="{font}" w:hAnsi="{font}" w:cs="{font}" w:hint="eastAsia"/>
      <w:lang w:eastAsia="zh-CN"/>
    """
    from .style_mapper import _is_cjk_font
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement

    body_styles = tag_styles.get("body", {})
    font_family = body_styles.get("font-family", "")

    # Scan font-family list to find the first CJK font
    fonts = [f.strip().strip("'\"") for f in font_family.split(",")]
    cjk_font: str | None = None
    for f in fonts:
        if _is_cjk_font(f):
            cjk_font = f
            break

    if not cjk_font:
        return

    for para in document.paragraphs:
        for run in para.runs:
            if not run.text or not _contains_cjk(run.text):
                continue

            rPr = run._r.get_or_add_rPr()

            # Set rFonts with all four attributes + hint
            rFonts = rPr.find(qn("w:rFonts"))
            if rFonts is None:
                rFonts = OxmlElement("w:rFonts")
                rPr.insert(0, rFonts)
            rFonts.set(qn("w:ascii"), cjk_font)
            rFonts.set(qn("w:eastAsia"), cjk_font)
            rFonts.set(qn("w:hAnsi"), cjk_font)
            rFonts.set(qn("w:cs"), cjk_font)
            rFonts.set(qn("w:hint"), "eastAsia")
            # Remove theme references if present
            for theme_attr in ("w:asciiTheme", "w:hAnsiTheme", "w:eastAsiaTheme", "w:cstheme"):
                if rFonts.get(qn(theme_attr)) is not None:
                    del rFonts.attrib[qn(theme_attr)]

            # Set lang eastAsia
            lang = rPr.find(qn("w:lang"))
            if lang is None:
                lang = OxmlElement("w:lang")
                rPr.append(lang)
            lang.set(qn("w:eastAsia"), "zh-CN")
