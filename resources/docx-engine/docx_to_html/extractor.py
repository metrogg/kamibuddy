"""extractor.py — 顶层编排：校验 → 渲染 → 落盘（原子写 HTML）。

为什么把「渲染」和「落盘」严格分开、且 HTML 最后写：
1. spec 要求坏输入**响亮失败且不产出半成品 HTML** —— 整份 HTML 先在内存里生成完，
   最后一步才用临时文件 + ``os.replace`` 原子替换；
2. 图片先写、HTML 后写：任何一步抛错都不会留下「HTML 指向不存在的图片」的产物。

失败一律返回 ``ExtractResult(success=False, error=...)``（不往上抛异常），
这样 CLI 永远能输出契约里的一行 JSON —— 与正向引擎的 ``ConvertResult`` 同形。
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import TYPE_CHECKING

from docx import Document

from .context import RenderContext
from .document import build_html, default_title_for
from .errors import DocxExtractError
from .images import ImageAssets
from .lists import NumberingResolver
from .not_restorable import detect
from .package import DocxPackage
from .types import ExtractOptions, ExtractResult

if TYPE_CHECKING:
    from .types import ImageAsset

ASSETS_DIR_SUFFIX = "_assets"


def extract(options: ExtractOptions) -> ExtractResult:
    """把 ``options.docx_path`` 提取成 HTML（+ 图片目录）。"""
    warnings: list[str] = []
    try:
        output_path = _resolve_output(options)
        assets_dir = _resolve_assets_dir(options, output_path)
    except DocxExtractError as exc:
        return ExtractResult(success=False, error=str(exc))
    try:
        return _run(options, output_path, assets_dir, warnings)
    except DocxExtractError as exc:
        return ExtractResult(success=False, error=str(exc), warnings=warnings)
    except OSError as exc:
        return ExtractResult(
            success=False, error=f"写入产物失败：{exc}", warnings=warnings
        )
    except Exception as exc:  # noqa: BLE001 — 契约要求任何失败都变成一行 JSON
        return ExtractResult(
            success=False,
            error=f"提取失败（{type(exc).__name__}）：{exc}",
            warnings=warnings,
        )


def _run(
    options: ExtractOptions, output_path: Path, assets_dir: Path, warnings: list[str]
) -> ExtractResult:
    with DocxPackage(options.docx_path) as package:
        document = _open_document(package, options.docx_path)
        ctx = RenderContext(
            document=document,
            numbering=NumberingResolver(document),
            images=ImageAssets(package, html_dir=output_path.parent, assets_dir=assets_dir),
            warnings=warnings,
        )
        html = build_html(document, ctx, default_title_for(str(package.path)))
        not_restorable = detect(package, document, ctx)
        images: list["ImageAsset"] = ctx.images.write()
        _write_html_atomic(output_path, html)
    return ExtractResult(
        success=True,
        html_path=str(output_path.resolve()),
        assets_dir=str(assets_dir.resolve()),
        images=images,
        warnings=warnings,
        not_restorable=not_restorable,
    )


def _open_document(package: DocxPackage, docx_path: str):
    try:
        return Document(str(package.path))
    except Exception as exc:
        raise DocxExtractError(
            f"无法解析 {Path(docx_path).name}：{type(exc).__name__}：{exc}"
        ) from exc


# ── 路径解析 ────────────────────────────────────────────────────────

def _resolve_output(options: ExtractOptions) -> Path:
    if options.output_path is None or not str(options.output_path).strip():
        raise DocxExtractError(
            "缺少输出 HTML 路径：请用 -o/--output 指定（本模块不猜产物落点）"
        )
    return Path(options.output_path)


def _resolve_assets_dir(options: ExtractOptions, output_path: Path) -> Path:
    """图片目录缺省规则：``<html 所在目录>/<html 文件名去扩展名>_assets``。

    HTML 里的图片引用按「相对 HTML 文件所在目录」写成（见 images.py 模块头注释），
    所以 ``--assets-dir`` 指到哪儿都行 —— 引用会跟着算成相对 HTML 的路径。
    """
    if options.assets_dir is not None and str(options.assets_dir).strip():
        return Path(options.assets_dir)
    return output_path.parent / f"{output_path.stem}{ASSETS_DIR_SUFFIX}"


def _write_html_atomic(path: Path, html: str) -> None:
    """先写临时文件再替换：失败时不留半成品 HTML。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_name(f"{path.name}.tmp-{os.getpid()}")
    try:
        temp_path.write_text(html, encoding="utf-8", newline="\n")
        os.replace(temp_path, path)
    finally:
        if temp_path.exists():
            temp_path.unlink()
