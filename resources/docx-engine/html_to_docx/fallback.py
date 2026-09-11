"""fallback.py — HTML→Markdown degradation for conversion failures.

Provides:
  html_to_markdown(html: str) -> str   — extract readable Markdown from HTML

Used by Converter when the full pipeline fails: returns a plain-text
representation so the caller is never left with nothing.
"""
from __future__ import annotations

import re

from bs4 import BeautifulSoup


def html_to_markdown(html: str) -> str:
    """Convert *html* to a plain-text Markdown approximation.

    Preserves: headings, paragraphs, lists, links, bold/italic, code, hr.
    Tables are rendered as pipe tables (best-effort).
    """
    soup = BeautifulSoup(html, "lxml")
    return _node_to_md(soup.find("body") or soup).strip()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _node_to_md(node) -> str:
    parts: list[str] = []
    for child in node.children:
        if isinstance(child, str):
            parts.append(child)
            continue
        tag = child.name
        if tag is None:
            continue

        if tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            level = int(tag[1])
            parts.append(f"\n{'#' * level} {child.get_text(strip=True)}\n")
        elif tag == "p":
            parts.append(f"\n{_inline(child)}\n")
        elif tag in ("ul", "ol"):
            parts.append(_list_to_md(child, tag, depth=0))
        elif tag in ("strong", "b"):
            parts.append(f"**{child.get_text()}**")
        elif tag in ("em", "i"):
            parts.append(f"*{child.get_text()}*")
        elif tag == "code":
            parts.append(f"`{child.get_text()}`")
        elif tag == "pre":
            code = child.get_text()
            parts.append(f"\n```\n{code}\n```\n")
        elif tag == "a":
            href = child.get("href", "#")
            text = child.get_text(strip=True)
            parts.append(f"[{text}]({href})")
        elif tag == "hr":
            parts.append("\n---\n")
        elif tag == "blockquote":
            quoted = _node_to_md(child).strip()
            parts.append("\n" + "\n".join(f"> {line}" for line in quoted.splitlines()) + "\n")
        elif tag == "table":
            parts.append(_table_to_md(child))
        elif tag in ("div", "section", "article", "main", "header", "footer", "nav"):
            parts.append(_node_to_md(child))
        elif tag == "br":
            parts.append("\n")
        else:
            # Fallback: recurse
            inner = _node_to_md(child)
            if inner.strip():
                parts.append(inner)

    return "".join(parts)


def _inline(node) -> str:
    """Convert inline content of a node to Markdown."""
    parts: list[str] = []
    for child in node.children:
        if isinstance(child, str):
            parts.append(child)
        elif child.name in ("strong", "b"):
            parts.append(f"**{child.get_text()}**")
        elif child.name in ("em", "i"):
            parts.append(f"*{child.get_text()}*")
        elif child.name == "code":
            parts.append(f"`{child.get_text()}`")
        elif child.name == "a":
            href = child.get("href", "#")
            parts.append(f"[{child.get_text()}]({href})")
        elif child.name in ("sup", "sub"):
            parts.append(child.get_text())
        else:
            parts.append(child.get_text() if hasattr(child, "get_text") else str(child))
    return "".join(parts)


def _list_to_md(list_el, tag: str, depth: int) -> str:
    prefix = "  " * depth
    lines: list[str] = ["\n"]
    for i, li in enumerate(list_el.find_all("li", recursive=False)):
        bullet = f"{i + 1}." if tag == "ol" else "-"
        # Li direct text (excluding nested lists)
        text_parts = []
        for child in li.children:
            if child.name in ("ul", "ol"):
                continue
            if hasattr(child, "get_text"):
                text_parts.append(child.get_text(strip=True))
            elif isinstance(child, str):
                text_parts.append(child.strip())
        text = " ".join(p for p in text_parts if p)
        lines.append(f"{prefix}{bullet} {text}")
        # Nested lists
        nested = li.find(["ul", "ol"])
        if nested:
            lines.append(_list_to_md(nested, nested.name, depth + 1))
    lines.append("")
    return "\n".join(lines)


def _table_to_md(table_el) -> str:
    rows = table_el.find_all("tr")
    if not rows:
        return ""
    md_rows: list[list[str]] = []
    for tr in rows:
        cells = tr.find_all(["th", "td"])
        md_rows.append([cell.get_text(separator=" ", strip=True) for cell in cells])

    if not md_rows:
        return ""

    # Normalise column count
    max_cols = max(len(r) for r in md_rows)
    for row in md_rows:
        while len(row) < max_cols:
            row.append("")

    # Build Markdown table
    lines = ["\n"]
    # Header row (first row)
    lines.append("| " + " | ".join(md_rows[0]) + " |")
    lines.append("| " + " | ".join(["---"] * max_cols) + " |")
    for row in md_rows[1:]:
        lines.append("| " + " | ".join(row) + " |")
    lines.append("")
    return "\n".join(lines)
