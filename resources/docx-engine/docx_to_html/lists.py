"""lists.py — 编号解析（有序/无序 + 层级）与嵌套 ``ul``/``ol`` 组装。

为什么编号要费这个劲：docx 里没有「列表」这个对象，列表项只是带 ``w:numPr``
的普通段落。两处来源都必须看，否则列表会整体丢失：
  1. 段落本级的 ``w:pPr/w:numPr``（Word 界面上创建的列表走这条）；
  2. 段落**样式**里的 ``w:pPr/w:numPr``（python-docx 及部分导出器把列表做成
     "List Bullet" / "List Number" 样式，段落本级是空的）。
而「有序还是无序」不在段落上，在 numbering.xml 的抽象编号里（``w:numFmt``）：
段落只带 numId/ilvl，得顺着 numId → abstractNumId → lvl[numFmt] 查一遍。
层级读不出（ilvl 缺失）就退化到第 0 层，不硬编多级。
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from docx.oxml.ns import qn

from .inline_style import style_chain

if TYPE_CHECKING:
    from docx.document import Document as DocxDocument
    from docx.text.paragraph import Paragraph

    from .context import RenderContext

# numbering.xml 里表示「无序」的 w:numFmt；其余（decimal / lowerLetter / …）都算有序。
UNORDERED_NUM_FORMATS = frozenset({"bullet"})
# numFmt=none 的段落根本不显示编号，不是列表项。
NO_NUMBERING_NUM_FORMAT = "none"
# 段落本级 numId=0 表示「此段取消编号」（OOXML 约定）。
NO_NUMBERING_NUM_ID = "0"
# 样式继承链的爬行上限（防畸形文档里的 basedOn 环）。
MAX_STYLE_CLIMB = 12


@dataclass(frozen=True)
class ListItemInfo:
    """一个列表项：有序/无序 + 层级（0 起）。"""

    ordered: bool
    level: int


def _read_num_pr(num_pr) -> tuple[str | None, str | None]:
    if num_pr is None:
        return None, None
    num_id_el = num_pr.find(qn("w:numId"))
    ilvl_el = num_pr.find(qn("w:ilvl"))
    num_id = num_id_el.get(qn("w:val")) if num_id_el is not None else None
    ilvl = ilvl_el.get(qn("w:val")) if ilvl_el is not None else None
    return num_id, ilvl


def _to_int(value: str | None, fallback: int) -> int:
    if value is None:
        return fallback
    try:
        return int(value)
    except ValueError:
        return fallback


class NumberingResolver:
    """numId + ilvl → 列表项信息（有序/无序 + 层级）。

    构造时只解析、不打警告（此时还没有渲染上下文）；「读不出来」的告警在
    ``item_info`` 里上报，那里有 ``ctx``（警告汇总是渲染期状态）。
    """

    def __init__(self, document: "DocxDocument") -> None:
        self._num_to_abstract: dict[str, str] = {}
        self._abstract_formats: dict[tuple[str, str], str] = {}
        self._load_error: str | None = None
        self._load(document)

    def _load(self, document: "DocxDocument") -> None:
        try:
            numbering = document.part.numbering_part.element
        except Exception as exc:  # NotImplementedError / KeyError：没有编号部件
            self._load_error = f"文档没有可读的编号定义（numbering.xml：{type(exc).__name__}）"
            return
        for num in numbering.findall(qn("w:num")):
            num_id = num.get(qn("w:numId"))
            abstract_el = num.find(qn("w:abstractNumId"))
            if num_id is None or abstract_el is None:
                continue
            self._num_to_abstract[num_id] = abstract_el.get(qn("w:val")) or ""
        for abstract in numbering.findall(qn("w:abstractNum")):
            abstract_id = abstract.get(qn("w:abstractNumId")) or ""
            for lvl in abstract.findall(qn("w:lvl")):
                ilvl = lvl.get(qn("w:ilvl")) or "0"
                num_fmt_el = lvl.find(qn("w:numFmt"))
                num_fmt = num_fmt_el.get(qn("w:val")) if num_fmt_el is not None else None
                self._abstract_formats[(abstract_id, ilvl)] = num_fmt or ""

    # ── 对外 ────────────────────────────────────────────────────────

    def item_info(self, paragraph: "Paragraph", ctx: "RenderContext") -> ListItemInfo | None:
        """是列表项就给信息，不是（或编号被取消）给 None。"""
        num_id, ilvl = self._num_pr(paragraph)
        if num_id is None or num_id == NO_NUMBERING_NUM_ID:
            return None
        if self._load_error is not None:
            ctx.warn(f"{self._load_error}，列表一律按无序列表处理")
        level = max(0, _to_int(ilvl, 0))
        num_fmt = self._num_format(num_id, level)
        if num_fmt == NO_NUMBERING_NUM_FORMAT:
            return None
        if not num_fmt:
            ctx.warn(
                f"编号定义缺失，该处列表按无序列表处理（numId={num_id}，层级={level}）"
            )
            return ListItemInfo(ordered=False, level=level)
        return ListItemInfo(ordered=num_fmt not in UNORDERED_NUM_FORMATS, level=level)

    # ── 内部 ────────────────────────────────────────────────────────

    def _num_pr(self, paragraph: "Paragraph") -> tuple[str | None, str | None]:
        p_pr = paragraph._p.pPr
        direct = _read_num_pr(p_pr.find(qn("w:numPr")) if p_pr is not None else None)
        if direct[0] is not None:
            return direct
        for index, current in enumerate(style_chain(paragraph.style)):
            if index >= MAX_STYLE_CLIMB:
                break
            style_p_pr = current.element.find(qn("w:pPr"))
            if style_p_pr is None:
                continue
            inherited = _read_num_pr(style_p_pr.find(qn("w:numPr")))
            if inherited[0] is not None:
                return inherited
        return None, None

    def _num_format(self, num_id: str, level: int) -> str | None:
        abstract_id = self._num_to_abstract.get(num_id)
        if abstract_id is None:
            return None
        exact = self._abstract_formats.get((abstract_id, str(level)))
        if exact:
            return exact
        # 层级超出抽象编号定义的档数：退到第 0 档的格式（同一种列表类型）。
        return self._abstract_formats.get((abstract_id, "0"))


class ListBuilder:
    """把**连续的**列表段落攒成嵌套 ``<ul>``/``<ol>``。

    为什么要攒着一起出：HTML 的 ``<li>`` 必须包在 ``<ul>``/``<ol>`` 里，
    而 docx 的列表项是散落的普通段落 —— 只有连着看才知道哪几段属于同一个列表。
    """

    def __init__(self) -> None:
        self._items: list[tuple[ListItemInfo, str, str]] = []

    def add(self, info: ListItemInfo, content_html: str, style: str = "") -> None:
        self._items.append((info, content_html, style))

    def __bool__(self) -> bool:
        return bool(self._items)

    def drain(self) -> str:
        """取出 HTML 并清空：一个列表只能渲染一次（否则后面的块会重复吐出它）。"""
        html = self.render()
        self._items.clear()
        return html

    def render(self) -> str:
        if not self._items:
            return ""
        parts: list[str] = []
        # 打开的列表栈：每层 (层级, 标签)，栈顶是当前最深层。
        open_lists: list[tuple[int, str]] = []

        def close_top_list() -> None:
            _, tag = open_lists.pop()
            parts.append(f"</li></{tag}>")

        for info, content, style in self._items:
            tag = "ol" if info.ordered else "ul"
            while open_lists and open_lists[-1][0] > info.level:
                close_top_list()
            if open_lists and open_lists[-1][0] == info.level:
                if open_lists[-1][1] != tag:
                    # 同一层级换了列表类型（ul ↔ ol）：整层关掉重开。
                    close_top_list()
                else:
                    parts.append("</li>")
            while not open_lists or open_lists[-1][0] < info.level:
                level = 0 if not open_lists else open_lists[-1][0] + 1
                parts.append(f"<{tag}>")
                open_lists.append((level, tag))
            style_attr_html = f' style="{style}"' if style else ""
            parts.append(f"<li{style_attr_html}>{content or '&nbsp;'}")
        while open_lists:
            close_top_list()
        return "".join(parts)
