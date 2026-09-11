"""html_to_docx — Public API.

Convert HTML strings or files to Microsoft Word (.docx) documents.

Quickstart:
    from html_to_docx import convert, ConvertOptions
    result = convert("<h1>Hello</h1><p>World</p>")
    if result.success:
        print(result.docx_path)
"""
from __future__ import annotations

from .types import ConvertOptions, ConvertResult, FieldBinding


def convert(
    html: str,
    output_path: str | None = None,
    options: ConvertOptions | None = None,
) -> ConvertResult:
    """Convert an HTML string to a .docx file.

    Args:
        html:        Raw HTML string to convert.
        output_path: Optional path for the output .docx file.
                     If *None*, a temporary file is created.
        options:     :class:`ConvertOptions` instance for page size, margins, etc.
                     ``output_path`` is applied on top of ``options.output_path``.

    Returns:
        :class:`ConvertResult` with ``success=True`` and ``docx_path`` set on
        success, or ``success=False`` + ``error`` + ``markdown_fallback`` on
        failure.
    """
    from .converter import Converter  # noqa: PLC0415 — lazy import

    if options is None:
        options = ConvertOptions()
    if output_path is not None:
        options = ConvertOptions(
            page_size=options.page_size,
            orientation=options.orientation,
            margin_top=options.margin_top,
            margin_bottom=options.margin_bottom,
            margin_left=options.margin_left,
            margin_right=options.margin_right,
            output_path=output_path,
        )

    return Converter(options).convert(html)


__all__ = ["convert", "ConvertOptions", "ConvertResult", "FieldBinding"]
