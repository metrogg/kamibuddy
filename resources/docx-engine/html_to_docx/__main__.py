"""__main__.py — CLI entry point for html_to_docx.

Usage:
    python -m html_to_docx convert input.html [-o output.docx] [options]

Options:
    --output / -o       Output .docx path (default: auto-generated temp file)
    --page-size         A4 | Letter | A3 (default: A4)
    --orientation       portrait | landscape (default: portrait)
    --margin-top        Top margin in cm (default: 2.54)
    --margin-bottom     Bottom margin in cm (default: 2.54)
    --margin-left       Left margin in cm (default: 3.17)
    --margin-right      Right margin in cm (default: 3.17)

Exit codes:
    0  — success; JSON ConvertResult printed to stdout
    1  — failure; JSON error info printed to stderr
"""
from __future__ import annotations

import json
import sys

import click

from .converter import Converter
from .types import ConvertOptions


@click.group()
def cli() -> None:
    """html_to_docx — Convert HTML to Microsoft Word (.docx)."""


@cli.command()
@click.argument("input_path", type=click.Path(exists=True, readable=True))
@click.option("--output", "-o", default=None, help="Output .docx file path")
@click.option("--page-size", default="A4", show_default=True,
              type=click.Choice(["A4", "Letter", "A3"], case_sensitive=False),
              help="Page size")
@click.option("--orientation", default="portrait", show_default=True,
              type=click.Choice(["portrait", "landscape"], case_sensitive=False),
              help="Page orientation")
@click.option("--margin-top", default=2.54, show_default=True, type=float,
              help="Top margin in cm")
@click.option("--margin-bottom", default=2.54, show_default=True, type=float,
              help="Bottom margin in cm")
@click.option("--margin-left", default=3.17, show_default=True, type=float,
              help="Left margin in cm")
@click.option("--margin-right", default=3.17, show_default=True, type=float,
              help="Right margin in cm")
def convert(
    input_path: str,
    output: str | None,
    page_size: str,
    orientation: str,
    margin_top: float,
    margin_bottom: float,
    margin_left: float,
    margin_right: float,
) -> None:
    """Convert INPUT_PATH (HTML file) to a .docx document."""
    import os

    with open(input_path, encoding="utf-8", errors="replace") as fh:
        html = fh.read()

    # Auto-resolve base_dir from input file's directory for relative image paths
    base_dir = os.path.dirname(os.path.abspath(input_path))

    options = ConvertOptions(
        page_size=page_size,
        orientation=orientation,
        margin_top=margin_top,
        margin_bottom=margin_bottom,
        margin_left=margin_left,
        margin_right=margin_right,
        output_path=output,
        base_dir=base_dir,
    )

    result = Converter(options).convert(html)

    if result.success:
        click.echo(
            json.dumps(
                {
                    "success": True,
                    "docx_path": result.docx_path,
                    "warnings": result.warnings,
                    "fields": [
                        {
                            "key": field.key,
                            "bookmark_name": field.bookmark_name,
                            "display_text": field.display_text,
                            "source": field.source,
                            "label": field.label,
                            "status": field.status,
                        }
                        for field in result.fields
                    ],
                }
            )
        )
        sys.exit(0)
    else:
        click.echo(
            json.dumps(
                {
                    "success": False,
                    "error": result.error,
                    "markdown_fallback": result.markdown_fallback,
                    "warnings": result.warnings,
                }
            ),
            err=True,
        )
        sys.exit(1)


if __name__ == "__main__":
    cli()
