"""__main__.py — docx_to_html 的命令行入口。

Usage:
    python -m docx_to_html extract input.docx -o output.html [--assets-dir DIR]

Options:
    --output / -o    产出的 HTML 路径（必填）
    --assets-dir     图片目录；缺省为 ``<html 所在目录>/<html 文件名去扩展名>_assets``

Exit codes:
    0 — 成功；契约 JSON 打印到 **stdout**（单行）
    1 — 失败；契约 JSON 打印到 **stderr**（单行，含 ``success:false`` 与 ``error``）

与正向引擎（html_to_docx）**同形**：单行 JSON、exit 0/1、日志不污染 stdout。
JSON 用默认的 ``ensure_ascii=True``（非 ASCII 转成 ``\\uXXXX``）—— 与正向引擎一致，
这样控制台代码页不同也不会把输出弄坏。
"""
from __future__ import annotations

import json
import sys

import click

from .extractor import extract
from .types import ExtractOptions


@click.group()
def cli() -> None:
    """docx_to_html — 把 .docx 提取为语义化 HTML（+ 图片目录）。"""


@cli.command(name="extract")
@click.argument("docx_path", type=click.Path())
@click.option("--output", "-o", default=None, help="产出的 HTML 路径")
@click.option(
    "--assets-dir",
    default=None,
    help="图片目录（缺省：<html 所在目录>/<html 文件名去扩展名>_assets）",
)
def extract_cmd(docx_path: str, output: str | None, assets_dir: str | None) -> None:
    """Extract DOCX_PATH (.docx) into a semantic HTML file plus an image folder."""
    result = extract(
        ExtractOptions(docx_path=docx_path, output_path=output, assets_dir=assets_dir)
    )

    if result.success:
        click.echo(
            json.dumps(
                {
                    "success": True,
                    "html_path": result.html_path,
                    "assets_dir": result.assets_dir,
                    "images": [
                        {"src": image.src, "file": image.file, "source": image.source}
                        for image in result.images
                    ],
                    "warnings": result.warnings,
                    "not_restorable": result.not_restorable,
                }
            )
        )
        sys.exit(0)

    click.echo(
        json.dumps(
            {
                "success": False,
                "error": result.error,
                "warnings": result.warnings,
            }
        ),
        err=True,
    )
    sys.exit(1)


if __name__ == "__main__":
    cli()
