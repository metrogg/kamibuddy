from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ConvertOptions:
    """Options for HTML to DOCX conversion."""
    page_size: str = "A4"           # A4 / Letter / A3
    orientation: str = "portrait"   # portrait / landscape
    margin_top: float = 2.54        # cm
    margin_bottom: float = 2.54     # cm
    margin_left: float = 3.17       # cm
    margin_right: float = 3.17      # cm
    output_path: Optional[str] = None
    base_dir: Optional[str] = None  # Base directory for resolving relative image paths


@dataclass(frozen=True)
class FieldBinding:
    """A source field that was safely materialized as a DOCX bookmark."""

    key: str
    bookmark_name: str
    display_text: str
    source: str = "explicit"
    label: str | None = None
    status: str = "created"


@dataclass
class ConvertResult:
    """Result of HTML to DOCX conversion."""
    success: bool
    docx_path: Optional[str] = None
    error: Optional[str] = None
    markdown_fallback: Optional[str] = None
    warnings: list[str] = field(default_factory=list)
    fields: list[FieldBinding] = field(default_factory=list)
