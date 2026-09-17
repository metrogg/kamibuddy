"""inline_style.py — run / 段落 → inline CSS 声明。

为什么走 inline style 而不外链 CSS：下游（typeset / design-token / 预览）要直接读
这份 HTML，外链样式表还得再解析一遍；正向引擎（html_to_docx）也优先吃 inline style。

分层规则（避免噪声，同时不丢信息）：
  - 文档级：Normal（正文）样式的字体写到 ``<article class="docx-content">`` 上，作为整篇基准；
  - 段落级：``style`` 属性 = 段落格式（对齐 / 缩进）+ **该段落自己样式链**的字体
    （Normal 那一层跳过，否则每个段落都重复一遍基准字体）；
  - run 级：只有 run 自身 rPr **显式设置**了属性时才包 ``<span style>``，
    没设置就继承段落级 —— 于是「样式给的字号」只出现一次。
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Iterator

from docx.oxml.ns import qn

from .style_map import alignment_css, font_size_css, theme_color_css

if TYPE_CHECKING:
    from docx.document import Document as DocxDocument
    from docx.style import BaseStyle
    from docx.text.paragraph import Paragraph
    from docx.text.run import Run

    from .context import RenderContext

_NORMAL_STYLE_ID = "Normal"

# 声明输出顺序固定：同样的版式每次生成同样的字符串（便于 diff 与快照测试）。
DECLARATION_ORDER: tuple[str, ...] = (
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "color",
    "text-align",
    "text-indent",
    "margin-left",
)


@dataclass(frozen=True)
class FontInfo:
    """字体信息（None = 这一层没有定义，交给下一层兜底）。"""

    size_pt: float | None = None
    family: str | None = None
    bold: bool | None = None
    italic: bool | None = None
    color: str | None = None

    def overridden_by(self, higher: "FontInfo") -> "FontInfo":
        """更高优先级的层（run）覆盖本层：逐字段取更高层非 None 的值。"""
        return FontInfo(
            size_pt=higher.size_pt if higher.size_pt is not None else self.size_pt,
            family=higher.family if higher.family is not None else self.family,
            bold=higher.bold if higher.bold is not None else self.bold,
            italic=higher.italic if higher.italic is not None else self.italic,
            color=higher.color if higher.color is not None else self.color,
        )


# ── 样式链 ──────────────────────────────────────────────────────────

def style_chain(style: "BaseStyle | None") -> Iterator["BaseStyle"]:
    """从样式自身往基样式走（Word 的继承链），带环保护。"""
    seen: set[str] = set()
    current = style
    while current is not None:
        style_id = getattr(current, "style_id", None) or str(id(current))
        if style_id in seen:
            return
        seen.add(style_id)
        yield current
        current = current.base_style


def _color_css(r_pr) -> str | None:
    """``w:rPr/w:color`` → CSS 颜色。

    优先用显式的 ``w:val``（Word 同时写了主题色与字面色，字面色才是它实际渲染的
    结果）；只有主题色、没有字面值时查主题色板（近似值，见 style_map.COLOR_TO_CSS）。
    不走 python-docx 的 ``font.color.rgb``：主题色场景它会给出一个假的 000000。
    """
    if r_pr is None:
        return None
    color = r_pr.find(qn("w:color"))
    if color is None:
        return None
    value = color.get(qn("w:val"))
    if value and value.lower() not in ("auto", "none"):
        return f"#{value.upper()}"
    return theme_color_css(color.get(qn("w:themeColor")))


def _r_pr_family(r_pr) -> str | None:
    """``w:rPr/w:rFonts`` 的西文/东亚字体名。"""
    if r_pr is None or r_pr.rFonts is None:
        return None
    return r_pr.rFonts.get(qn("w:ascii")) or r_pr.rFonts.get(qn("w:eastAsia"))


def _style_font(style: "BaseStyle") -> FontInfo:
    """样式定义里的字体（只看样式自己这一层，不爬继承链）。"""
    font = getattr(style, "font", None)
    if font is None:
        return FontInfo()
    r_pr = style.element.rPr
    family = font.name or _r_pr_family(r_pr)
    size = font.size
    return FontInfo(
        size_pt=size.pt if size is not None else None,
        family=family,
        bold=font.bold,
        italic=font.italic,
        color=_color_css(r_pr),
    )


def _merge_chain(style: "BaseStyle | None", stop_at_normal: bool) -> FontInfo:
    merged = FontInfo()
    for current in style_chain(style):
        if stop_at_normal and getattr(current, "style_id", None) == _NORMAL_STYLE_ID:
            break
        merged = merged.overridden_by(_style_font(current))
    return merged


def document_base_font(document: "DocxDocument") -> FontInfo:
    """文档基准字体（Normal / 正文样式及其继承链）→ 写到 ``<article>`` 上。"""
    try:
        style = document.styles[_NORMAL_STYLE_ID]
    except KeyError:
        return FontInfo()
    return _merge_chain(style, stop_at_normal=False)


# ── run / 段落 → 字体 ───────────────────────────────────────────────

def run_font(run: "Run") -> FontInfo:
    """run 自身 rPr 显式设置的字体（None = 没设置，继承样式）。"""
    font = run.font
    r_pr = run._r.rPr
    size = font.size
    return FontInfo(
        size_pt=size.pt if size is not None else None,
        family=font.name or _r_pr_family(r_pr),
        bold=font.bold,
        italic=font.italic,
        color=_color_css(r_pr),
    )


def paragraph_font(paragraph: "Paragraph", ctx: "RenderContext") -> FontInfo:
    """段落样式链给的字体（跳过 Normal 层：那是整篇基准，已写在 <article> 上）。"""
    return _merge_chain(paragraph.style, stop_at_normal=True)


def effective_font(run: "Run", paragraph: "Paragraph", ctx: "RenderContext") -> FontInfo:
    """run 实际生效的字体（run → 段落样式链），表格/列表等复用处使用。"""
    return paragraph_font(paragraph, ctx).overridden_by(run_font(run))


# ── 字体 → CSS 声明 ────────────────────────────────────────────────

def font_declarations(font: FontInfo) -> dict[str, str]:
    declarations: dict[str, str] = {}
    if font.family:
        # 字体名里的引号会把 style="..." 属性截断：一律剥掉。
        family = font.family.replace("'", "").replace('"', "")
        declarations["font-family"] = f"'{family}'"
    if font.size_pt is not None:
        declarations["font-size"] = font_size_css(font.size_pt)
    if font.bold is True:
        declarations["font-weight"] = "bold"
    elif font.bold is False:
        declarations["font-weight"] = "normal"
    if font.italic is True:
        declarations["font-style"] = "italic"
    if font.color:
        declarations["color"] = font.color
    return declarations


def _cm(value_cm: float) -> str | None:
    if abs(value_cm) < 0.005:
        return None
    return f"{value_cm:.2f}cm"


def paragraph_declarations(paragraph: "Paragraph", ctx: "RenderContext") -> dict[str, str]:
    """段落格式 + 段落样式字体 → 声明表（顺序由 DECLARATION_ORDER 归一）。"""
    declarations: dict[str, str] = dict(font_declarations(paragraph_font(paragraph, ctx)))

    align = alignment_css(paragraph.alignment)
    if align is not None and align != "left":
        # HTML 默认就是左对齐，不重复声明（左对齐是绝大多数段落的实际状态）。
        declarations["text-align"] = align

    fmt = paragraph.paragraph_format
    if fmt.first_line_indent is not None:
        indent = _cm(fmt.first_line_indent.cm)
        if indent is not None:
            declarations["text-indent"] = indent
    if fmt.left_indent is not None:
        margin = _cm(fmt.left_indent.cm)
        if margin is not None:
            declarations["margin-left"] = margin
    return declarations


def run_declarations(run: "Run") -> dict[str, str]:
    """run 显式设置的字体 → 声明表（空表表示这个 run 没有自己的格式）。

    正文段落用这个：段落级已经承载了样式字体，run 只补自己显式改过的部分。
    """
    return font_declarations(run_font(run))


def effective_run_declarations(
    run: "Run", paragraph: "Paragraph", ctx: "RenderContext"
) -> dict[str, str]:
    """run 生效字体（含样式链）→ 声明表。

    表格单元格用这个：``<td>`` 上只挂得了单元格首段的字体，单元格内每个 run
    都得把自己生效的字体带全，否则单元格文本会掉成浏览器的默认字体。
    """
    return font_declarations(effective_font(run, paragraph, ctx))


def style_attr(declarations: dict[str, str]) -> str:
    """声明表 → ``style`` 属性值（空表给空串，调用方据此决定要不要写 style）。"""
    ordered = [f"{name}: {declarations[name]}" for name in DECLARATION_ORDER if name in declarations]
    ordered.extend(
        f"{name}: {value}" for name, value in declarations.items() if name not in DECLARATION_ORDER
    )
    return "; ".join(ordered)
