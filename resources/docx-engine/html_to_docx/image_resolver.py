"""image_resolver.py — Phase 0a: Resolve relative image paths to absolute.

Scans all <img src="..."> in the HTML. For any src that is:
  - NOT a data: URI (base64 inline)
  - NOT an http:// or https:// URL
  - A relative path (e.g. "images/chart.png")

Resolves it to an absolute path by joining with base_dir.

This ensures html4docx and downstream image handlers can locate
local image files regardless of the current working directory.
"""
from __future__ import annotations

import os

from bs4 import BeautifulSoup


def resolve_image_paths(html: str, base_dir: str) -> str:
    """Resolve relative <img src> paths to absolute paths based on base_dir.

    Args:
        html: HTML string to process.
        base_dir: Directory to use as base for resolving relative paths.
                  Typically dirname(input_html_file).

    Returns:
        Modified HTML string with relative img src paths replaced by absolute paths.
    """
    soup = BeautifulSoup(html, "lxml")
    modified = False

    for img in soup.find_all("img"):
        src = img.get("src", "")
        if not src:
            continue

        # Skip data URIs and remote URLs
        if src.startswith("data:") or src.startswith("http://") or src.startswith("https://"):
            continue

        # Skip already-absolute paths
        if os.path.isabs(src):
            continue

        # Resolve relative path against base_dir
        abs_path = os.path.normpath(os.path.join(base_dir, src))
        img["src"] = abs_path
        modified = True

    return str(soup) if modified else html
