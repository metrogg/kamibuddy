"""paragraphs.py — 段落 → HTML（标题 / 正文 / 空段落 / 列表项与单元格的内联内容）。

两个「为什么」：

1. **run 自己遍历 XML，不用 ``paragraph.runs``**：python-docx 的 ``runs`` 只给
   ``w:r`` 直接子元素，超链接（``w:hyperlink``）、内容控件（``w:sdt``）、
   修订插入（``w:ins``）里的 run 全都拿不到 —— 那些文字会整段丢。
   这里按文档顺序走，且**明确不下钻** ``w:drawing`` / ``w:txbxContent``：
   文本框里的文字属于「浮动对象」，不能混进正文流（见 not_restorable）。
2. **空段落不吞**：``<p>&nbsp;</p>`` 保留占位，段落顺序与原文一致 ——
   版式复用场景里丢一个空行就是版式变了。
"""
from __future__ import annotations

from html import escape
from typing import TYPE_CHECKING, Iterator

from docx.oxml.ns import qn
from docx.text.run import Run

from .images import image_src_for_embed
from .inline_style import (
    effective_run_declarations,
    paragraph_declarations,
    run_declarations,
    style_attr,
)
from .style_map import heading_level, outline_heading_level

if TYPE_CHECKING:
    from docx.text.paragraph import Paragraph

    from .context import RenderContext

# 这些容器只做「包一层」，里面的 run 仍是正文的一部分，要下钻。
# 白名单式下钻：没列进来的元素（drawing / pict / txbxContent…）一律不进。
_RUN_WRAPPERS = frozenset(
    qn(tag) for tag in ("w:hyperlink", "w:sdt", "w:sdtContent", "w:ins", "w:smartTag")
)

_EMU_PER_CSS_PX = 9525


def collect_runs(paragraph: "Paragraph") -> list[Run]:
    """按文档顺序收集段落里的 run（含超链接/内容控件/修订里的）。"""
    return [Run(element, paragraph) for element in _iter_run_elements(paragraph._p)]


def _iter_run_elements(element) -> Iterator:
    for child in element.iterchildren():
        if child.tag == qn("w:r"):
            yield child
        elif child.tag in _RUN_WRAPPERS:
            yield from _iter_run_elements(child)


def has_visual_content(paragraph: "Paragraph", runs: list[Run]) -> bool:
    """段落里有没有看得见的东西（文本或图片）；全空 = 空段落。"""
    if any(run.text.strip() for run in runs):
        return True
    return any(run._r.find(qn("w:drawing")) is not None for run in runs)


def render_block(paragraph: "Paragraph", ctx: "RenderContext") -> str:
    """块级渲染：标题 → ``h1..h6``，其余 → ``p``（空段落也保留）。"""
    runs = collect_runs(paragraph)
    style = style_attr(paragraph_declarations(paragraph, ctx))
    style_attr_html = f' style="{style}"' if style else ""
    level = _heading_level(paragraph)
    content = _runs_html(paragraph, runs, ctx, effective_fonts=False)
    if level is not None:
        return f"<h{level}{style_attr_html}>{content or '&nbsp;'}</h{level}>"
    if not has_visual_content(paragraph, runs):
        return f"<p{style_attr_html}>&nbsp;</p>"
    return f"<p{style_attr_html}>{content}</p>"


def render_inline_content(
    paragraph: "Paragraph", ctx: "RenderContext", *, effective_fonts: bool
) -> str:
    """只出内联内容（列表项 / 表格单元格复用）。

    ``effective_fonts=True``：run 带上「含样式链」的字体 —— 表格单元格用，
    因为 ``<td>`` 只挂得了首段字体，run 不自己带就会掉成浏览器默认字体。
    """
    return _runs_html(paragraph, collect_runs(paragraph), ctx, effective_fonts=effective_fonts)


def _heading_level(paragraph: "Paragraph") -> int | None:
    style = paragraph.style
    level = heading_level(
        getattr(style, "name", None), getattr(style, "style_id", None)
    )
    if level is not None:
        return level
    # 没套标题样式、但带大纲级别（自定义标题样式常这样）→ 按大纲级别兜底。
    p_pr = paragraph._p.pPr
    outline = p_pr.find(qn("w:outlineLvl")) if p_pr is not None else None
    if outline is None:
        return None
    raw = outline.get(qn("w:val"))
    try:
        return outline_heading_level(int(raw)) if raw is not None else None
    except ValueError:
        return None


def _runs_html(
    paragraph: "Paragraph", runs: list[Run], ctx: "RenderContext", *, effective_fonts: bool
) -> str:
    if paragraph._p.find(qn("w:hyperlink")) is not None:
        ctx.warn("超链接按纯文本提取（链接地址未保留）")
    pieces: list[str] = []
    for run in runs:
        pieces.append(_run_html(run, paragraph, ctx, effective_fonts=effective_fonts))
    return "".join(pieces)


def _run_html(
    run: Run, paragraph: "Paragraph", ctx: "RenderContext", *, effective_fonts: bool
) -> str:
    pieces: list[str] = []
    text = run.text
    if text:
        declarations = (
            effective_run_declarations(run, paragraph, ctx)
            if effective_fonts
            else run_declarations(run)
        )
        # w:br / w:cr 在 python-docx 里是 "\n"：转成 <br> 才能保住换行。
        body = escape(text, quote=False).replace("\n", "<br>")
        style = style_attr(declarations)
        pieces.append(f'<span style="{style}">{body}</span>' if style else body)
    for drawing in _iter_drawings(run):
        if drawing.find(qn("wp:anchor")) is not None:
            ctx.warn("浮动图片（w:anchor）按行内图片提取，原始位置与环绕方式未复原")
        pieces.append(_drawing_html(run, drawing, ctx))
    return "".join(pieces)


def _iter_drawings(run: Run) -> Iterator:
    yield from run._r.findall(qn("w:drawing"))


def _drawing_html(run: Run, drawing, ctx: "RenderContext") -> str:
    """``w:drawing`` → ``<img>``（尺寸取 wp:extent，EMU → px）。"""
    src: str | None = None
    for blip in drawing.iter(qn("a:blip")):
        rel_id = blip.get(qn("r:embed"))
        if rel_id is not None:
            src = image_src_for_embed(run, rel_id, ctx.images, ctx)
            if src is not None:
                break
            continue
        link_id = blip.get(qn("r:link"))
        if link_id is not None:
            src = image_src_for_embed(run, link_id, ctx.images, ctx)
            if src is not None:
                break
    if src is None:
        return ""
    image = f'<img src="{escape(src, quote=True)}"'
    extent = drawing.find(".//" + qn("wp:extent"))
    if extent is not None:
        width = _emu_to_px(extent.get("cx"))
        height = _emu_to_px(extent.get("cy"))
        if width:
            image += f' width="{width}"'
        if height:
            image += f' height="{height}"'
    return image + ">"


def _emu_to_px(raw: str | None) -> int | None:
    if raw is None:
        return None
    try:
        return max(1, round(int(raw) / _EMU_PER_CSS_PX))
    except ValueError:
        return None
