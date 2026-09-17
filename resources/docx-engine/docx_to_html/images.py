"""images.py — 图片引用登记与落盘。

为什么延后到渲染结束后才写盘：HTML 渲染可能在任何一步失败，产物目录里不该留
半套图片（spec：坏输入不许产出半成品）。同时「HTML 里写什么引用」与「文件叫什么名」
必须一致 —— 这两件事都在这里定，别处不许拼路径。

图片统一落 ``<assets-dir>/images/``，HTML 里的引用是**相对 HTML 文件所在目录**的
相对路径（用 POSIX 分隔符）。为什么基准是 HTML 目录而不是 assets_dir：下游
（预览、以及正向引擎 ``html_to_docx``）拿到的只有 HTML 文件，它就是按「输入 HTML
所在目录」解析相对路径的；写成 ``images/xxx.png``（相对 assets_dir）在
``<html 目录>/<stem>_assets`` 这个缺省布局下必然指错地方。
"""
from __future__ import annotations

import os
import re
from pathlib import Path, PurePosixPath
from typing import TYPE_CHECKING

from .types import ImageAsset

if TYPE_CHECKING:
    from docx.text.run import Run

    from .context import RenderContext
    from .package import DocxPackage

IMAGES_SUBDIR = "images"

# 浏览器/预览不能直接显示的格式：仍然原样复制（包内资产不能丢），但要如实告警。
_BROWSER_UNFRIENDLY_SUFFIXES = {".emf", ".wmf", ".tiff", ".tif"}

_UNSAFE_FILENAME_CHARS = re.compile(r"[^A-Za-z0-9._-]")


class ImageAssets:
    """收集本文档引用的媒体条目，统一命名并落盘。"""

    def __init__(self, package: "DocxPackage", html_dir: Path, assets_dir: Path) -> None:
        self._package = package
        # 引用的基准是 HTML 文件所在目录（见模块头注释），两个路径都在这里定一次。
        self._html_dir = html_dir
        self._assets_dir = assets_dir
        self._by_filename: dict[str, str] = {}
        self._blobs: dict[str, bytes] = {}
        self._src_by_entry: dict[str, str] = {}
        self._src_by_filename: dict[str, str] = {}

    # ── 引用登记 ────────────────────────────────────────────────────

    def reference(self, entry: str, ctx: "RenderContext") -> str | None:
        """登记包内媒体条目，返回 HTML 里的相对引用；找不到条目返回 None。"""
        known = self._src_by_entry.get(entry)
        if known is not None:
            return known
        if entry not in self._package.names:
            ctx.warn(f"图片在包内找不到对应条目，已跳过：{entry}")
            return None
        filename = self._unique_filename(PurePosixPath(entry).name)
        self._by_filename[filename] = entry
        self._blobs[entry] = self._package.read(entry)
        src = _relative_to_html(self._assets_dir / IMAGES_SUBDIR / filename, self._html_dir)
        self._src_by_entry[entry] = src
        self._src_by_filename[filename] = src
        suffix = PurePosixPath(filename).suffix.lower()
        if suffix in _BROWSER_UNFRIENDLY_SUFFIXES:
            ctx.warn(
                f"图片格式 {suffix} 浏览器不能直接显示（已原样复制，"
                "需要时请自行转成 png/jpg）"
            )
        return src

    def _unique_filename(self, raw_name: str) -> str:
        """包内条目名 → 安全的落盘文件名（防目录穿越 + 重名去重）。"""
        stem = PurePosixPath(raw_name).stem
        suffix = PurePosixPath(raw_name).suffix
        safe_stem = _UNSAFE_FILENAME_CHARS.sub("_", stem) or "image"
        candidate = f"{safe_stem}{suffix}"
        index = 2
        while candidate in self._by_filename:
            candidate = f"{safe_stem}-{index}{suffix}"
            index += 1
        return candidate

    # ── 落盘 ────────────────────────────────────────────────────────

    def write(self) -> list[ImageAsset]:
        """把引用过的图片写到 ``<assets-dir>/images/``，返回清单（按文档出现顺序）。"""
        target_dir = self._assets_dir / IMAGES_SUBDIR
        target_dir.mkdir(parents=True, exist_ok=True)
        written: list[ImageAsset] = []
        for filename, entry in self._by_filename.items():
            path = target_dir / filename
            path.write_bytes(self._blobs[entry])
            written.append(
                ImageAsset(
                    # 与 HTML 里写的引用同一份（reference 时已算好），不许两处各拼一遍。
                    src=self._src_by_filename[filename],
                    file=str(path.resolve()),
                    source=entry,
                )
            )
        return written


def _relative_to_html(target: Path, html_dir: Path) -> str:
    """``target`` 相对 HTML 目录的引用，统一 POSIX 分隔符。

    relpath 而不是「assets_dir 是什么就写什么」：调用方给任意 ``--assets-dir``
    （可能在 HTML 旁边、也可能在别处）时，引用都得从 HTML 出发才算得对。
    """
    return os.path.relpath(target.resolve(), html_dir.resolve()).replace(os.sep, "/")


def image_src_for_embed(
    run: "Run", rel_id: str, images: ImageAssets, ctx: "RenderContext"
) -> str | None:
    """``a:blip/@r:embed`` 关系 id → HTML 图片引用。"""
    rel = run.part.rels.get(rel_id)
    if rel is None:
        ctx.warn(f"图片关系缺失（rId={rel_id}），已跳过该图片")
        return None
    if rel.is_external:
        ctx.warn(f"外链图片未下载，按原 URL 引用：{rel.target_ref}")
        return str(rel.target_ref)
    partname = str(rel.target_part.partname).lstrip("/")
    return images.reference(partname, ctx)
