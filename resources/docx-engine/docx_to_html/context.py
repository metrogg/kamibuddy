"""context.py — 渲染期共享状态（文档句柄 + 编号解析 + 图片收集 + 警告汇总）。

为什么要有它：段落 / 列表 / 表格 / 图片四个渲染器都要读同一份文档级资源，
并且都要把「读不出来的东西」上报成 warnings。集中一处，避免把 warnings 列表
和解析器层层穿参；警告还在这里去重 —— 长文档里同一个问题会命中上百次，
不去重的话清单没法看。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from docx.document import Document as DocxDocument

    from .images import ImageAssets
    from .lists import NumberingResolver


@dataclass
class RenderContext:
    document: "DocxDocument"
    numbering: "NumberingResolver"
    images: "ImageAssets"
    warnings: list[str] = field(default_factory=list)
    _seen: set[str] = field(default_factory=set)

    def warn(self, message: str) -> None:
        """上报一条警告（同一条只留一次）。"""
        if message in self._seen:
            return
        self._seen.add(message)
        self.warnings.append(message)
