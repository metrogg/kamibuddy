"""types.py — 反向提取的数据结构（与正向包的 types.py 同层对应）。

为什么单独一个文件：CLI 的 JSON 契约、TS 侧消费的字段、内部各渲染器共享的
对象都以此为唯一真源，避免「字段在三个地方各写一遍」。
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class ImageAsset:
    """一张落盘图片：HTML 引用 + 真实落点 + docx 包内来源。"""

    src: str
    """HTML 里的引用路径，**相对 HTML 文件所在目录**，形如 ``doc_assets/images/image1.png``。"""
    file: str
    """落盘绝对路径。"""
    source: str
    """docx 包内条目名，例如 ``word/media/image1.png``。"""


@dataclass
class ExtractOptions:
    """一次提取的输入。"""

    docx_path: str
    output_path: str | None = None
    """产出的 HTML 路径。缺省时由调用方保证非空（CLI 层会响亮报错）。"""
    assets_dir: str | None = None
    """图片目录。缺省为 ``<html 所在目录>/<html 名去扩展名>_assets``。"""


@dataclass
class ExtractResult:
    """提取结果。成功给路径与清单，失败只给 error（不产出半成品）。"""

    success: bool
    html_path: str | None = None
    assets_dir: str | None = None
    images: list[ImageAsset] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    not_restorable: list[str] = field(default_factory=list)
    error: str | None = None
