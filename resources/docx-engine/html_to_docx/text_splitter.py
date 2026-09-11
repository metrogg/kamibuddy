"""text_splitter.py — Split mixed CJK/Latin text nodes into separate <span> elements.

Phase 0c preprocessor (runs after style_injector, before special region extraction).

Problem: html4docx puts an entire paragraph's text into a single <w:r>.
Word cannot apply correct kerning/justification to mixed CJK+Latin in one run,
causing abnormally stretched spaces in justified paragraphs.

Solution: Split bare text nodes inside block elements (<p>, <li>, <td>, etc.)
into multiple <span> elements by character type boundary:
  - CJK characters → one span
  - Latin characters + digits → one span
  - Whitespace + punctuation → grouped with adjacent Latin (or standalone)

After splitting, html4docx naturally creates one <w:r> per <span>, and each
run can have its own rFonts setting for correct rendering.
"""
from __future__ import annotations

import re
import unicodedata
from typing import TYPE_CHECKING

from bs4 import BeautifulSoup, NavigableString, Tag

if TYPE_CHECKING:
    pass

# Block-level elements whose direct text children should be split
_BLOCK_ELEMENTS = frozenset([
    "p", "li", "td", "th", "dt", "dd", "blockquote", "figcaption", "caption",
])

# Characters considered CJK (Chinese/Japanese/Korean)
_CJK_RANGES = (
    (0x4E00, 0x9FFF),    # CJK Unified Ideographs
    (0x3400, 0x4DBF),    # CJK Unified Ideographs Extension A
    (0x20000, 0x2A6DF),  # CJK Unified Ideographs Extension B
    (0x2A700, 0x2B73F),  # Extension C
    (0x2B740, 0x2B81F),  # Extension D
    (0x2B820, 0x2CEAF),  # Extension E
    (0xF900, 0xFAFF),    # CJK Compatibility Ideographs
    (0x3000, 0x303F),    # CJK Symbols and Punctuation
    (0xFF00, 0xFFEF),    # Fullwidth Forms
    (0x2E80, 0x2EFF),    # CJK Radicals Supplement
    (0x3100, 0x312F),    # Bopomofo
    (0x31A0, 0x31BF),    # Bopomofo Extended
    (0xFE30, 0xFE4F),    # CJK Compatibility Forms
)


def _is_cjk(ch: str) -> bool:
    """Check if a character is CJK."""
    cp = ord(ch)
    for start, end in _CJK_RANGES:
        if start <= cp <= end:
            return True
    return False


def _char_type(ch: str) -> str:
    """Classify a character into 'cjk', 'latin', or 'space'.

    Space category includes whitespace and common punctuation that should
    stay attached to adjacent Latin text.
    """
    if ch in (' ', '\t', '\n', '\r'):
        return 'space'
    if _is_cjk(ch):
        return 'cjk'
    return 'latin'


def _split_text(text: str) -> list[tuple[str, str]]:
    """Split text into segments by character type boundary.

    Returns list of (segment_text, segment_type) where type is 'cjk', 'latin', or 'space'.
    Adjacent same-type characters are grouped together.
    Spaces between Latin characters are merged into the Latin segment.
    """
    if not text:
        return []

    segments: list[tuple[str, str]] = []
    current_chars: list[str] = []
    current_type: str | None = None

    for ch in text:
        ct = _char_type(ch)
        if ct == current_type:
            current_chars.append(ch)
        else:
            if current_chars:
                segments.append(("".join(current_chars), current_type))  # type: ignore
            current_chars = [ch]
            current_type = ct

    if current_chars:
        segments.append(("".join(current_chars), current_type))  # type: ignore

    # Post-process: merge space segments into adjacent Latin segments
    # "hello world" should be one Latin segment, not latin+space+latin
    merged: list[tuple[str, str]] = []
    for seg_text, seg_type in segments:
        if not merged:
            merged.append((seg_text, seg_type))
            continue

        prev_text, prev_type = merged[-1]

        # Merge space into preceding Latin
        if seg_type == 'space' and prev_type == 'latin':
            merged[-1] = (prev_text + seg_text, 'latin')
        # Merge Latin into preceding space-that-was-merged-into-Latin
        elif seg_type == 'latin' and prev_type == 'latin':
            merged[-1] = (prev_text + seg_text, 'latin')
        else:
            merged.append((seg_text, seg_type))

    # Second pass: merge standalone space into following Latin
    final: list[tuple[str, str]] = []
    i = 0
    while i < len(merged):
        seg_text, seg_type = merged[i]
        if seg_type == 'space' and i + 1 < len(merged) and merged[i + 1][1] == 'latin':
            # Prepend space to next Latin segment
            next_text, next_type = merged[i + 1]
            final.append((seg_text + next_text, 'latin'))
            i += 2
        else:
            final.append((seg_text, seg_type))
            i += 1

    return final


def _needs_splitting(text: str) -> bool:
    """Check if text contains both CJK and non-CJK characters (worth splitting)."""
    has_cjk = False
    has_latin = False
    for ch in text:
        if _is_cjk(ch):
            has_cjk = True
        elif ch not in (' ', '\t', '\n', '\r'):
            has_latin = True
        if has_cjk and has_latin:
            return True
    return False


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

# CJK / Latin 字符需要拆分为不同的run, 支持混排
def split_cjk_latin(html: str) -> str:
    """Split mixed CJK/Latin text nodes in block elements into separate <span> tags.

    Only splits bare text nodes (NavigableString) that are direct children of
    block elements. Does NOT touch text inside existing inline elements
    (<span>, <strong>, <em>, <a>, <code>, etc.) — those are already separate runs.

    Args:
        html: HTML string (CSS variables resolved, styles injected).

    Returns:
        Processed HTML string with text nodes split into <span> elements.
    """
    soup = BeautifulSoup(html, "lxml")

    for block in soup.find_all(_BLOCK_ELEMENTS):
        # Collect text nodes to process (can't modify while iterating)
        text_nodes: list[NavigableString] = []
        for child in list(block.children):
            if isinstance(child, NavigableString) and not isinstance(child, Tag):
                if child.strip() and _needs_splitting(str(child)):
                    text_nodes.append(child)

        # Replace each qualifying text node with split spans
        for text_node in text_nodes:
            text = str(text_node)
            segments = _split_text(text)

            if len(segments) <= 1:
                continue  # No split needed

            # Build replacement spans
            new_elements = []
            for seg_text, seg_type in segments:
                span = soup.new_tag("span")
                span.string = seg_text
                if seg_type == 'cjk':
                    span["data-text-type"] = "cjk"
                else:
                    span["data-text-type"] = "latin"
                new_elements.append(span)

            # Replace text node with spans
            if new_elements:
                parent = text_node.parent
                for elem in reversed(new_elements):
                    text_node.insert_after(elem)
                text_node.extract()

    return str(soup)
