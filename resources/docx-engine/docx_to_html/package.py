"""package.py — .docx（OPC zip 容器）的打开与校验。

为什么不用 python-docx 打开就完事：
1. 坏输入要**响亮失败且给出可读原因**（不是 .docx / 不是 zip / 缺
   word/document.xml），python-docx 只会抛 PackageNotFoundError 这类笼统异常，
   说不出「哪类问题」；
2. 图片（``word/media/*``）与不可复原项的检测（``word/header*.xml`` /
   ``footer*.xml`` / ``word/charts/``）需要的条目只能从 zip 目录里拿到。
所以这里只管「打开 + 校验 + 按条目读字节」，不解析语义。
"""
from __future__ import annotations

import zipfile
from pathlib import Path
from typing import Iterator

from .errors import DocxExtractError

MAIN_DOCUMENT_ENTRY = "word/document.xml"
CONTENT_TYPES_ENTRY = "[Content_Types].xml"
MEDIA_PREFIX = "word/media/"
CHART_PREFIX = "word/charts/"

_SUFFIX = ".docx"


class DocxPackage:
    """已校验的 .docx 包（上下文管理器，持有一个打开的 ZipFile）。"""

    def __init__(self, path: str) -> None:
        self.path = Path(path)
        if not self.path.exists():
            raise DocxExtractError(f"输入路径不存在：{self.path}")
        if not self.path.is_file():
            raise DocxExtractError(f"输入路径不是文件：{self.path}")
        if self.path.suffix.lower() != _SUFFIX:
            got = self.path.suffix or "无扩展名"
            raise DocxExtractError(f"输入不是 .docx（扩展名：{got}）：{self.path}")
        try:
            self._zip = zipfile.ZipFile(self.path)
        except zipfile.BadZipFile as exc:
            raise DocxExtractError(
                f"不是有效的 .docx：{self.path} 不是 zip 容器（旧版 .doc 或文件损坏）：{exc}"
            ) from exc
        except OSError as exc:
            raise DocxExtractError(f"无法读取 {self.path}：{exc}") from exc

        self._names = tuple(self._zip.namelist())
        if CONTENT_TYPES_ENTRY not in self._names:
            self.close()
            raise DocxExtractError(
                f"不是有效的 .docx：{self.path} 是 zip 但没有 {CONTENT_TYPES_ENTRY}"
                "（可能是普通压缩包改了扩展名）"
            )
        if MAIN_DOCUMENT_ENTRY not in self._names:
            self.close()
            raise DocxExtractError(
                f"不是有效的 .docx：{self.path} 缺少 {MAIN_DOCUMENT_ENTRY}（主文档不存在）"
            )

    # ── 生命周期 ────────────────────────────────────────────────────

    def close(self) -> None:
        self._zip.close()

    def __enter__(self) -> "DocxPackage":
        return self

    def __exit__(self, *exc_info: object) -> None:
        self.close()

    # ── 条目访问 ────────────────────────────────────────────────────

    @property
    def names(self) -> tuple[str, ...]:
        return self._names

    def has(self, entry: str) -> bool:
        return entry in self._names

    def read(self, entry: str) -> bytes:
        return self._zip.read(entry)

    def entries_under(self, prefix: str, suffix: str = "") -> Iterator[str]:
        """列出某前缀下的**文件**条目（zip 里目录条目以 ``/`` 结尾，过滤掉）。"""
        for name in self._names:
            if name.startswith(prefix) and not name.endswith("/") and name.endswith(suffix):
                yield name

    def media_entries(self) -> tuple[str, ...]:
        return tuple(self.entries_under(MEDIA_PREFIX))

    def header_footer_entries(self) -> tuple[str, ...]:
        found: list[str] = []
        for name in self._names:
            if name.startswith(("word/header", "word/footer")) and name.endswith(".xml"):
                found.append(name)
        return tuple(found)

    def has_chart_entries(self) -> bool:
        return any(True for _ in self.entries_under(CHART_PREFIX))
