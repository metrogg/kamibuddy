"""fields.py — Dynamic OOXML field writer (PAGE / NUMPAGES / STYLEREF).

Spec: S-26060126E (FR-014~017)

Tokenizes margin-box ``content`` values and writes Word native fields:
  counter(page)  -> PAGE       (<w:fldSimple>)
  counter(pages) -> NUMPAGES   (<w:fldSimple>, native physical page count, no -1)
  string(name)   -> STYLEREF <styleId>  (three-part fldChar+instrText)

STYLEREF references the style **styleId** (e.g. ``Heading1``, locale-neutral)
rather than the display name, resolved at field-write time from the original
selector string stored in ``StringSetBinding`` (FR-017 / D-SP-08).
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class TokenKind(str, Enum):
    """Kind of a single margin-box ``content`` token (data-model.md #4)."""

    LITERAL = "literal"            # "..." string literal -> w:r/w:t
    COUNTER_PAGE = "counter_page"  # counter(page)  -> PAGE
    COUNTER_PAGES = "counter_pages"  # counter(pages) -> NUMPAGES
    STRING_REF = "string_ref"      # string(<name>) -> STYLEREF <styleId>
    NONE = "none"                  # none -> no content


@dataclass
class PageContentToken:
    """One token parsed from a margin-box ``content`` value.

    ``value`` carries the LITERAL text or the STRING_REF ``name``; it is
    ``None`` for COUNTER_PAGE / COUNTER_PAGES / NONE.
    """

    kind: TokenKind
    value: Optional[str] = None


def _warn(msg: str) -> None:
    import warnings
    warnings.warn(msg, stacklevel=2)


# Tokenizer regex: matches one of
#   "..."  (double-quoted string literal)
#   '...'  (single-quoted string literal)
#   counter(page)
#   counter(pages)
#   string(<ident>)
#   none
import re as _re

_TOKEN_RE = _re.compile(
    r"""
      "(?P<dq>[^"]*)"                      # double-quoted literal
    | '(?P<sq>[^']*)'                      # single-quoted literal
    | counter\(\s*(?P<counter>pages?|page)\s*\)   # counter(page|pages)
    | string\(\s*(?P<string>[A-Za-z_][\w-]*)\s*\) # string(name)
    | (?P<none>\bnone\b)                   # none keyword
    """,
    _re.VERBOSE | _re.IGNORECASE,
)


def tokenize_content(content_value: str) -> "list[PageContentToken]":
    """Split a margin-box ``content`` value into an ordered token list (D-R1 step 3).

    Example::

        'counter(page) " / " counter(pages)' ->
            [COUNTER_PAGE, LITERAL(" / "), COUNTER_PAGES]

    Unrecognized fragments are skipped + warning, never aborting the whole
    content value. Empty string (``content: ""``) yields a single empty LITERAL
    token; the empty-string-as-illegal-value semantics (FR-026) are handled by
    ``page_css`` at the rule level.
    """
    tokens: list = []
    if content_value is None:
        return tokens

    text = content_value.strip()
    if text == "":
        return tokens

    pos = 0
    length = len(text)
    while pos < length:
        m = _TOKEN_RE.match(text, pos)
        if m is None:
            # Skip whitespace silently; warn on other unrecognized chars.
            if text[pos].isspace():
                pos += 1
                continue
            # Advance to next whitespace boundary and warn once for the chunk.
            nxt = pos
            while nxt < length and not text[nxt].isspace():
                nxt += 1
            frag = text[pos:nxt]
            _warn(f"Unrecognized content token {frag!r}; skipping.")
            pos = nxt
            continue

        if m.group("dq") is not None:
            tokens.append(PageContentToken(TokenKind.LITERAL, m.group("dq")))
        elif m.group("sq") is not None:
            tokens.append(PageContentToken(TokenKind.LITERAL, m.group("sq")))
        elif m.group("counter") is not None:
            kind = (TokenKind.COUNTER_PAGES
                    if m.group("counter").lower() == "pages"
                    else TokenKind.COUNTER_PAGE)
            tokens.append(PageContentToken(kind))
        elif m.group("string") is not None:
            tokens.append(PageContentToken(TokenKind.STRING_REF, m.group("string")))
        elif m.group("none") is not None:
            tokens.append(PageContentToken(TokenKind.NONE))
        pos = m.end()

    return tokens


# ---------------------------------------------------------------------------
# STYLEREF style-id resolution (FR-016~017 / D-SP-08)
# ---------------------------------------------------------------------------

# Bare heading tag (h1~h6) only. Compound selectors ('h1.x'), classes ('.x'),
# ids ('#x') and non-heading bare tags are rejected (-> None + warning).
_BARE_HEADING_RE = _re.compile(r"^\s*h([1-6])\s*$", _re.IGNORECASE)


def resolve_styleref_style_id(string_set_name, string_sets):  # type: ignore[no-untyped-def]
    """``string(name)`` -> STYLEREF target style **styleId** (not display name).

    Looks up ``string_set_name`` (the ``name`` in ``string(name)``) among the
    given ``string_sets`` (``StringSetBinding`` list, each carrying the raw
    selector string), then resolves a bare heading tag ``h1``~``h6`` to its
    built-in style id ``Heading1``~``Heading6`` (no space, locale-neutral) at
    field-write time (FR-017 / D-SP-08).

    Returns ``None`` + warning when: the name is not bound, or the bound
    selector is not a bare ``h1``~``h6`` (compound ``h1.x`` / class ``.x`` /
    id ``#x`` / non-heading tag). The caller still writes an empty STYLEREF
    reference field — never aborts (FR-016 / Edge Case).
    """
    if not string_set_name:
        return None
    # Find the binding for this string-set name (last wins if duplicated).
    selector = None
    for sb in string_sets or ():
        if getattr(sb, "name", None) == string_set_name:
            selector = getattr(sb, "selector", None)
    if selector is None:
        _warn(
            f"string-set {string_set_name!r} is not bound by any selector; "
            f"STYLEREF reference left empty."
        )
        return None
    m = _BARE_HEADING_RE.match(str(selector))
    if m is None:
        _warn(
            f"string-set {string_set_name!r} selector {selector!r} is not a bare "
            f"heading tag h1~h6; STYLEREF cannot resolve a styleId (left empty)."
        )
        return None
    return f"Heading{m.group(1)}"


# ---------------------------------------------------------------------------
# OOXML field writing (D-R3)
# ---------------------------------------------------------------------------

def _qn(tag: str) -> str:
    from docx.oxml.ns import qn
    return qn(tag)


def _make_fld_simple(instr: str):  # type: ignore[no-untyped-def]
    """Build a ``<w:fldSimple w:instr="...">`` element with a placeholder run."""
    from docx.oxml import OxmlElement
    fld = OxmlElement("w:fldSimple")
    fld.set(_qn("w:instr"), instr)
    # A child run so Word has something to display before first F9 refresh.
    run = OxmlElement("w:r")
    text = OxmlElement("w:t")
    text.text = ""
    run.append(text)
    fld.append(run)
    return fld


def _make_styleref(style_id):  # type: ignore[no-untyped-def]
    """Build the three-part ``STYLEREF <styleId>`` complex field elements.

    Returns a list of run elements: fldChar(begin), instrText, fldChar(end).
    When *style_id* is ``None`` the instruction is left as a bare ``STYLEREF``
    with an empty reference (Word self-handles at runtime; FR-016).
    """
    from docx.oxml import OxmlElement

    if style_id:
        instr = f' STYLEREF {style_id} \\* MERGEFORMAT '
    else:
        instr = ' STYLEREF  \\* MERGEFORMAT '

    # run 1: fldChar begin
    r_begin = OxmlElement("w:r")
    fc_begin = OxmlElement("w:fldChar")
    fc_begin.set(_qn("w:fldCharType"), "begin")
    r_begin.append(fc_begin)

    # run 2: instrText
    r_instr = OxmlElement("w:r")
    instr_text = OxmlElement("w:instrText")
    instr_text.set(_qn("xml:space"), "preserve")
    instr_text.text = instr
    r_instr.append(instr_text)

    # run 3: fldChar end
    r_end = OxmlElement("w:r")
    fc_end = OxmlElement("w:fldChar")
    fc_end.set(_qn("w:fldCharType"), "end")
    r_end.append(fc_end)

    return [r_begin, r_instr, r_end]


def write_field(paragraph, tokens, styleref_resolver=None):  # type: ignore[no-untyped-def]
    """Write an ordered ``tokens`` list into *paragraph* as runs / fields (D-R3).

    - ``COUNTER_PAGE``  -> ``<w:fldSimple w:instr="PAGE">``
    - ``COUNTER_PAGES`` -> ``<w:fldSimple w:instr="NUMPAGES">`` (native total,
      no -1; D-SP-10)
    - ``STRING_REF``    -> three-part ``fldChar``+``instrText`` STYLEREF
      ``<styleId>`` (references styleId, not display name; D-SP-08 / FR-016)
    - ``LITERAL``       -> plain ``w:r/w:t``
    - ``NONE``          -> nothing

    ``styleref_resolver`` is a callable ``name -> styleId | None`` (typically a
    ``string_sets``-bound ``resolve_styleref_style_id``). When omitted, STRING_REF
    resolves to an empty STYLEREF reference (still written, never aborts).
    """
    p_el = paragraph._p
    for tok in tokens or ():
        kind = tok.kind
        if kind == TokenKind.NONE:
            continue
        if kind == TokenKind.LITERAL:
            run = paragraph.add_run(tok.value or "")
            del run  # appended in-place
            continue
        if kind == TokenKind.COUNTER_PAGE:
            p_el.append(_make_fld_simple("PAGE"))
            continue
        if kind == TokenKind.COUNTER_PAGES:
            p_el.append(_make_fld_simple("NUMPAGES"))
            continue
        if kind == TokenKind.STRING_REF:
            style_id = None
            if styleref_resolver is not None:
                try:
                    style_id = styleref_resolver(tok.value)
                except Exception:  # pragma: no cover - resolver must not abort
                    style_id = None
            for r in _make_styleref(style_id):
                p_el.append(r)
            continue


def enable_update_fields(document) -> None:  # type: ignore[no-untyped-def]
    """Write ``<w:updateFields w:val="true"/>`` into settings.xml (D-R3 / SC-003).

    Guarantees Word refreshes all fields on open / F9. Idempotent: an existing
    ``updateFields`` element is reused.
    """
    from docx.oxml import OxmlElement

    settings = document.settings.element
    existing = settings.find(_qn("w:updateFields"))
    if existing is None:
        existing = OxmlElement("w:updateFields")
        settings.append(existing)
    existing.set(_qn("w:val"), "true")
