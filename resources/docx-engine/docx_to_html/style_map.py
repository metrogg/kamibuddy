"""style_map.py — docx 样式 → HTML/CSS 的映射**数据表**。

为什么单列一个文件、且写成表：样式映射是「版式知识」，会随兼容性不断增补；
集中成表后新增一类映射只是加一行数据，渲染逻辑（段落 / 表格 / 内联）不用动，
也不会退化成「一长串 if-else」把映射和流程搅在一起。
"""
from __future__ import annotations

from docx.enum.text import WD_ALIGN_PARAGRAPH

# ── 标题层级 ────────────────────────────────────────────────────────
# 键的归一化规则见 normalize_style_key：小写 + 去空格 + 去连字符，
# 这样样式名 "Heading 1" 与样式 id "Heading1" 落到同一个键上。
# "Title"（Word 的「标题」样式）按文档大标题处理 → h1。
HEADING_STYLE_LEVELS: dict[str, int] = {
    "title": 1,
    "heading1": 1,
    "heading2": 2,
    "heading3": 3,
    "heading4": 4,
    "heading5": 5,
    "heading6": 6,
    # 中文 Word 里自定义/本地化的标题样式名
    "标题1": 1,
    "标题2": 2,
    "标题3": 3,
    "标题4": 4,
    "标题5": 5,
    "标题6": 6,
}

# 段落没有标题样式、但带大纲级别（w:pPr/w:outlineLvl）时的兜底：
# Word 的「大纲级别 1」起始值为 0，CSS 侧映射到 h1..h6。
OUTLINE_LEVEL_TO_HEADING: dict[int, int] = {0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6}

# ── 对齐 ────────────────────────────────────────────────────────────
# 键是 python-docx 的枚举成员（int 枚举，可哈希）；CSS 侧只认四个方向。
ALIGNMENT_TO_CSS: dict[WD_ALIGN_PARAGRAPH, str] = {
    WD_ALIGN_PARAGRAPH.LEFT: "left",
    WD_ALIGN_PARAGRAPH.CENTER: "center",
    WD_ALIGN_PARAGRAPH.RIGHT: "right",
    WD_ALIGN_PARAGRAPH.JUSTIFY: "justify",
    WD_ALIGN_PARAGRAPH.DISTRIBUTE: "justify",
    WD_ALIGN_PARAGRAPH.JUSTIFY_MED: "justify",
    WD_ALIGN_PARAGRAPH.JUSTIFY_HI: "justify",
    WD_ALIGN_PARAGRAPH.JUSTIFY_LOW: "justify",
    WD_ALIGN_PARAGRAPH.THAI_JUSTIFY: "justify",
}

# ── 字号 ────────────────────────────────────────────────────────────
# Word 字号阶梯（后台是半磅整数，这些是它的界面档位）→ CSS font-size。
# 表里没有的字号（用户手填）按原值输出：版式保真优先于「归一到档位」。
FONT_SIZE_PT_TO_CSS: dict[float, str] = {
    5.0: "5pt",
    5.5: "5.5pt",
    6.5: "6.5pt",
    7.5: "7.5pt",
    8.0: "8pt",
    9.0: "9pt",
    10.0: "10pt",
    10.5: "10.5pt",
    11.0: "11pt",
    12.0: "12pt",
    14.0: "14pt",
    15.0: "15pt",
    16.0: "16pt",
    18.0: "18pt",
    20.0: "20pt",
    22.0: "22pt",
    24.0: "24pt",
    26.0: "26pt",
    28.0: "28pt",
    36.0: "36pt",
    48.0: "48pt",
    72.0: "72pt",
}

# ── 颜色 ────────────────────────────────────────────────────────────
# 主题色的兜底映射。键按 OOXML 的 w:themeColor 值归一化（accent1 / text1 / …），
# 也接受 python-docx 枚举名（ACCENT_1）—— theme_color_css 会归一化后再查。
# 取的是 Office 默认主题色板：**近似值**，自定义主题的文档色值可能与原稿不同
# （精确解析要读 word/theme/theme1.xml，本模块 v1 不做，见 README 已知限制）。
COLOR_TO_CSS: dict[str, str] = {
    "accent1": "#4472C4",
    "accent2": "#ED7D31",
    "accent3": "#A5A5A5",
    "accent4": "#FFC000",
    "accent5": "#5B9BD5",
    "accent6": "#70AD47",
    "text1": "#000000",
    "text2": "#44546A",
    "dark1": "#000000",
    "dark2": "#44546A",
    "light1": "#FFFFFF",
    "light2": "#E7E6E6",
    "background1": "#FFFFFF",
    "background2": "#E7E6E6",
    "hyperlink": "#0563C1",
    "followedhyperlink": "#954F72",
}

# 边框：Word 的 w:sz 是「1/8 磅」，CSS 用 px（96dpi 下 1px = 0.75pt）。
_BORDER_PT_PER_SZ_UNIT = 1.0 / 8.0
_PT_PER_CSS_PX = 0.75


def normalize_style_key(name: str) -> str:
    """样式名/样式 id 归一化成表键。"""
    return name.strip().lower().replace(" ", "").replace("-", "")


def heading_level(style_name: str | None, style_id: str | None) -> int | None:
    """按样式名或样式 id 找出标题层级；不是标题样式返回 None。"""
    for key in (style_id, style_name):
        if not key:
            continue
        level = HEADING_STYLE_LEVELS.get(normalize_style_key(key))
        if level is not None:
            return level
    return None


def outline_heading_level(outline_level: int) -> int | None:
    return OUTLINE_LEVEL_TO_HEADING.get(outline_level)


def alignment_css(alignment: WD_ALIGN_PARAGRAPH | None) -> str | None:
    if alignment is None:
        return None
    return ALIGNMENT_TO_CSS.get(alignment)


def font_size_css(points: float) -> str:
    known = FONT_SIZE_PT_TO_CSS.get(points)
    return known if known is not None else f"{points:g}pt"


def theme_color_css(theme_name: str | None) -> str | None:
    """主题色名 → 色值。兼容 OOXML 的 ``accent1`` 与 python-docx 的 ``ACCENT_1``。"""
    if theme_name is None:
        return None
    key = theme_name.strip().lower().replace("_", "")
    if not key or key == "notthemecolor":
        return None
    return COLOR_TO_CSS.get(key)


def border_width_px(size_eighths_of_point: int | None) -> int:
    """w:sz（1/8 磅）→ CSS px，最小 1px（0.5 磅的细线也要看得见）。"""
    if not size_eighths_of_point or size_eighths_of_point <= 0:
        return 1
    return max(1, round(size_eighths_of_point * _BORDER_PT_PER_SZ_UNIT / _PT_PER_CSS_PX))
