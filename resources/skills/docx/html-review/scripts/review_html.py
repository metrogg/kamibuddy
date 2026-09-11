#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""html-review 确定性质量门禁检测脚本。

纯 Python 3 标准库实现（html.parser + re + json + argparse），零第三方依赖，
任意 python3 解释器均可直接运行，无需 venv / pip。

一次性输出完整 HtmlReviewReport（JSON，stdout），html-review skill 据此实现
0 次 LLM 往返的确定性质量门禁。6 个维度的检测项与评分标准严格对齐
references/ 目录下的规则文件。

用法：
    python3 review_html.py --html <path> [--genre <genre>]
    cat page.html | python3 review_html.py --stdin --genre government-doc

退出码：
    0  检测通过（passed=true）
    1  检测不通过（passed=false）
    2  运行错误（输入缺失 / 解析失败）
"""

import argparse
import html as htmlmod
import json
import re
import sys
from html.parser import HTMLParser

VOID_TAGS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
}
HEADING_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6"}
CONTENT_TAGS = {"p", "table", "ul", "ol", "img", "figure", "blockquote", "pre", "dl"}
FONT_HOSTS = {"fonts.googleapis.com", "fonts.gstatic.com", "fonts.bunny.net"}


# --------------------------------------------------------------------------- #
# 轻量 DOM 树
# --------------------------------------------------------------------------- #
class Node:
    __slots__ = ("tag", "attrs", "children", "parent", "text_parts")

    def __init__(self, tag, attrs=None, parent=None):
        self.tag = tag
        self.attrs = dict(attrs or [])
        self.children = []
        self.parent = parent
        self.text_parts = []

    def raw_text(self):
        """本节点及所有后代拼接的原始文本（含实体占位）。"""
        buf = list(self.text_parts)
        for c in self.children:
            buf.append(c.raw_text())
        return "".join(buf)

    def text(self):
        """解码实体后的纯文本。"""
        return htmlmod.unescape(self.raw_text())

    def classes(self):
        return set((self.attrs.get("class") or "").split())

    def descendants(self):
        for c in self.children:
            yield c
            for d in c.descendants():
                yield d


class TreeBuilder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.root = Node("#root")
        self.stack = [self.root]
        self.style_blocks = []
        self._in_style = False
        self._style_buf = []
        self.has_script = False

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, self.stack[-1])
        self.stack[-1].children.append(node)
        if tag == "script":
            self.has_script = True
        if tag == "style":
            self._in_style = True
            self._style_buf = []
        if tag not in VOID_TAGS:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        node = Node(tag, attrs, self.stack[-1])
        self.stack[-1].children.append(node)
        if tag == "script":
            self.has_script = True

    def handle_endtag(self, tag):
        if tag == "style" and self._in_style:
            self._in_style = False
            self.style_blocks.append("".join(self._style_buf))
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        if self._in_style:
            self._style_buf.append(data)
        else:
            self.stack[-1].text_parts.append(data)

    def handle_entityref(self, name):
        if not self._in_style:
            self.stack[-1].text_parts.append("&%s;" % name)

    def handle_charref(self, name):
        if not self._in_style:
            self.stack[-1].text_parts.append("&#%s;" % name)


# --------------------------------------------------------------------------- #
# 工具
# --------------------------------------------------------------------------- #
_VAR_RE = re.compile(r"var\([^()]*\)")
_DECL_RE = re.compile(r"([\w-]+)\s*:\s*([^;{}]+)")
_COLOR_RE = re.compile(r"(#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\()")
_UNIT_RE = re.compile(r"\d+(\.\d+)?\s*(px|pt|em|rem|%|vh|vw|ch)")


def strip_vars(text):
    prev = None
    while prev != text:
        prev = text
        text = _VAR_RE.sub("", text)
    return text


def collect_style_text(root, style_blocks):
    # 每段以 ";" 终止，避免无分号的 inline style 与相邻声明串味
    parts = [b if b.rstrip().endswith(("}", ";")) else b + ";" for b in style_blocks]
    for n in root.descendants():
        s = n.attrs.get("style")
        if s:
            parts.append(s if s.rstrip().endswith(";") else s + ";")
    return "\n".join(parts)


def is_empty_text(node):
    t = node.text().replace("\xa0", "").strip()
    return t == ""


# --------------------------------------------------------------------------- #
# 维度 1：design-token 合规性（权重 25%）
# --------------------------------------------------------------------------- #
def check_design_token(root, style_blocks):
    issues = []
    combined = collect_style_text(root, style_blocks)
    scannable = strip_vars(combined)

    violations = 0
    for m in _DECL_RE.finditer(scannable):
        prop = m.group(1).strip().lower()
        value = m.group(2).strip()
        if not value:
            continue
        # 跳过 CSS 自定义属性定义（--x: 字面量），token 定义处本就应为字面量
        if prop.startswith("--"):
            continue
        if _COLOR_RE.search(value):
            violations += 1
            issues.append(
                '[DT-01] style 中 %s 使用了裸色值 "%s"，请替换为 var(--color-*)'
                % (prop, value[:40])
            )
            continue
        if prop == "font-size" and _UNIT_RE.search(value):
            violations += 1
            issues.append(
                '[DT-02] style 中 font-size 使用了裸字号 "%s"，请替换为 var(--fs-*)'
                % value[:40]
            )
            continue
        if (prop == "margin" or prop == "padding"
                or prop.startswith("margin-") or prop.startswith("padding-")):
            if _UNIT_RE.search(value):
                violations += 1
                issues.append(
                    '[DT-03] style 中 %s 使用了裸间距 "%s"，请替换为 var(--spacing-*)'
                    % (prop, value[:40])
                )
                continue
        if prop == "font-family" and value:
            violations += 1
            issues.append(
                '[DT-04] style 中 font-family 直接指定字体族 "%s"，请替换为 var(--ff-*)'
                % value[:40]
            )
            continue

    # DT-05：:root 变量块
    root_missing = False
    root_block = ""
    m = re.search(r":root\s*\{([^}]*)\}", combined)
    if m:
        root_block = m.group(1)
    else:
        root_missing = True
    if not root_missing:
        for req in ("--fs-body", "--color-text", "--ff-body"):
            if req not in root_block:
                root_missing = True
                issues.append("[DT-05] :root 变量块缺少必需变量 %s，请补充" % req)
    else:
        issues.append("[DT-05] HTML 缺少 :root 变量声明块，请在 <style> 内补充")

    if violations == 0:
        score = 100
    elif violations <= 2:
        score = 80
    elif violations <= 5:
        score = 60
    elif violations <= 10:
        score = 40
    else:
        score = 20

    passed = (not root_missing) and score >= 80
    return {"passed": passed, "score": score, "issues": issues}


# --------------------------------------------------------------------------- #
# 维度 2：结构完整性（权重 25%）
# --------------------------------------------------------------------------- #
def check_structural_integrity(root, style_blocks=None):
    issues = []
    penalty = 0
    preorder = list(root.descendants())
    style_blocks_ref = style_blocks or []

    # SI-01 标题跳级
    prev_level = 0
    for n in preorder:
        if n.tag in HEADING_TAGS:
            lvl = int(n.tag[1])
            if prev_level and lvl > prev_level + 1:
                penalty += 15
                issues.append(
                    "[SI-01] <h%d> 后直接出现 <h%d>，标题层级跳级，请补充中间层级"
                    % (prev_level, lvl)
                )
            prev_level = lvl

    # SI-02 表格结构
    tables = [n for n in preorder if n.tag == "table"]
    for idx, tb in enumerate(tables, 1):
        desc_tags = {d.tag for d in tb.descendants()}
        if "thead" not in desc_tags or "tbody" not in desc_tags:
            penalty += 20
            issues.append(
                "[SI-02] 第 %d 个 <table> 缺少 <thead>/<tbody>，请补全表格结构" % idx
            )
        else:
            thead = next((d for d in tb.descendants() if d.tag == "thead"), None)
            if thead and any(c.tag == "td" for c in thead.descendants()) \
                    and not any(c.tag == "th" for c in thead.descendants()):
                penalty += 20
                issues.append(
                    "[SI-02] 第 %d 个 <table> 的 <thead> 使用 <td> 而非 <th>，请改为 <th>"
                    % idx
                )

    # SI-03 列表非法子元素
    for n in preorder:
        if n.tag in ("ul", "ol"):
            bad = [c.tag for c in n.children if c.tag not in ("li", "#root")]
            if bad:
                penalty += 10
                issues.append(
                    "[SI-03] <%s> 直接包含非 <li> 元素 %s，请仅保留 <li>"
                    % (n.tag, ",".join(sorted(set(bad))))
                )

    # SI-04 非法块级嵌套
    block = {"div", "table", "ul", "ol", "section"} | HEADING_TAGS
    for n in preorder:
        if n.tag == "p":
            if any(d.tag in block for d in n.descendants()):
                penalty += 15
                issues.append("[SI-04] <p> 内嵌套了块级元素，请将块级内容移出 <p>")

    # SI-05 img alt
    for n in preorder:
        if n.tag == "img":
            alt = n.attrs.get("alt")
            if alt is None or alt.strip() == "":
                penalty += 5
                issues.append(
                    '[SI-05] <img src="%s"> 缺少非空 alt 属性，请补充图片说明'
                    % (n.attrs.get("src", "")[:40])
                )

    # SI-06 空链接
    for n in preorder:
        if n.tag == "a":
            href = n.attrs.get("href")
            if href is None:
                continue
            h = href.strip()
            if h == "" or h == "#":
                penalty += 5
                issues.append(
                    '[SI-06] <a href="%s"> 为空/占位链接，请补充有效 href 或改为文档内锚点'
                    % href
                )

    # SI-07 不可还原 inline badge（span + background + padding/border-radius/inline-block）
    _bg_re = re.compile(r"background(?:-color)?\s*:\s*(?!(?:transparent|none|inherit)\b)", re.I)
    _pad_re = re.compile(r"padding\s*:", re.I)
    _radius_re = re.compile(r"border-radius\s*:", re.I)
    _inline_block_re = re.compile(r"display\s*:\s*inline-block", re.I)

    # 预解析 <style> 块中的 class→样式映射（简单解析 .className { ... } 模式）
    _class_style_map = {}
    for block in style_blocks_ref:
        for cm in re.finditer(r"\.([\w-]+)\s*\{([^}]*)\}", block):
            _class_style_map[cm.group(1)] = cm.group(2)

    for n in preorder:
        if n.tag != "span":
            continue
        # 合并 inline style + class 对应的 style 块
        style = n.attrs.get("style") or ""
        for cls_name in (n.attrs.get("class") or "").split():
            cls_style = _class_style_map.get(cls_name)
            if cls_style:
                style = style + ";" + cls_style
        if not style:
            continue
        has_bg = bool(_bg_re.search(style))
        if not has_bg:
            continue
        has_pad = bool(_pad_re.search(style))
        has_radius = bool(_radius_re.search(style))
        has_ib = bool(_inline_block_re.search(style))
        if has_pad or has_radius or has_ib:
            penalty += 20
            cls_str = n.attrs.get("class", "")
            label = '<span class="%s">' % cls_str if cls_str else "<span>"
            issues.append(
                "[SI-07] %s 使用 background+%s 模拟 badge，docx 中不可还原。"
                "请改为 <p> 仅用 color/font-size/font-weight 表达；"
                "如需底纹效果，改用单行 <table> 单元格承载"
                % (label, "/".join(
                    x for x, f in [("padding", has_pad), ("border-radius", has_radius), ("inline-block", has_ib)] if f
                ))
            )

    # SI-08 table-in-table 嵌套
    # html-to-docx 的表格样式后处理依赖 document.tables，该 API 只返回顶层
    # 表格，嵌套在单元格里的内层表格无法应用边框/对齐/底纹，导致渲染偏差。
    # abstract-card 单列表格按 doc-typeset SKILL.md §(d) 只承载 <p> 富文本。
    for idx, tb in enumerate(tables, 1):
        nested = next((d for d in tb.descendants() if d.tag == "table"), None)
        if nested is not None:
            penalty += 20
            outer_cls = tb.attrs.get("class", "")
            inner_cls = nested.attrs.get("class", "")
            issues.append(
                "[SI-08] 第 %d 个 <table%s> 内嵌套了 <table%s>，"
                "docx 不支持嵌套表格样式应用。请将内层表格移出作为顶层独立表格；"
                "若为 abstract-card 容器，内部只保留 <p> 段落"
                % (
                    idx,
                    (' class="%s"' % outer_cls) if outer_cls else "",
                    (' class="%s"' % inner_cls) if inner_cls else "",
                )
            )

    score = max(0, 100 - penalty)
    return {"passed": score >= 75, "score": score, "issues": issues}


# --------------------------------------------------------------------------- #
# 维度 3：排版合理性（权重 20%）
# --------------------------------------------------------------------------- #
def check_typographic_quality(root):
    issues = []
    penalty = 0
    preorder = list(root.descendants())

    # TQ-01 段落长度
    for i, n in enumerate(preorder, 1):
        if n.tag == "p":
            length = len(n.text().strip())
            if length > 500:
                penalty += 10
                issues.append(
                    "[TQ-01] 存在 <p> 含 %d 字符，超出 500 字上限，请断段" % length
                )

    # TQ-02 连续空段落
    run = 0
    flagged = False
    for n in preorder:
        if n.tag == "p":
            if is_empty_text(n) and not list(n.descendants()):
                run += 1
                if run >= 3 and not flagged:
                    penalty += 15
                    flagged = True
                    issues.append(
                        "[TQ-02] 出现连续 3 个及以上空 <p>，请删除多余空段用 margin 控制间距"
                    )
            else:
                run = 0
                flagged = False

    # TQ-03 相邻标题无正文
    last_h = None
    seen_content = False
    for n in preorder:
        if n.tag in HEADING_TAGS:
            lvl = int(n.tag[1])
            if last_h is not None and not seen_content:
                if not (last_h == 1 and lvl == 2):
                    penalty += 10
                    issues.append(
                        "[TQ-03] <h%d> 后直接出现 <h%d>，中间无正文，请补充章节导语"
                        % (last_h, lvl)
                    )
            last_h = lvl
            seen_content = False
        elif n.tag in CONTENT_TAGS:
            if n.tag == "p":
                if not is_empty_text(n):
                    seen_content = True
            else:
                seen_content = True

    # TQ-04 / TQ-05 h1 / h2 数量
    h1 = sum(1 for n in preorder if n.tag == "h1")
    h2 = sum(1 for n in preorder if n.tag == "h2")
    if h1 > 1:
        penalty += 20
        issues.append("[TQ-04] 文档出现 %d 个 <h1>，每个文档只应有 1 个主标题" % h1)
    if h2 > 10:
        issues.append("[TQ-05] 文档出现 %d 个 <h2>（WARNING），建议检查是否过于碎片化" % h2)

    # TQ-06 正文字号一致性
    fs_tokens = set()
    for n in preorder:
        if n.tag == "p" and not (n.classes() & {"summary", "note", "caption", "footnote"}):
            s = n.attrs.get("style", "")
            for m in re.finditer(r"font-size\s*:\s*var\((--[\w-]+)\)", s):
                fs_tokens.add(m.group(1))
    if len(fs_tokens) > 1:
        penalty += 10
        issues.append(
            "[TQ-06] 正文 <p> 使用了多个不同字号 token %s，请统一为 var(--fs-body)"
            % ",".join(sorted(fs_tokens))
        )

    # TQ-07 caption 位置
    for n in preorder:
        if n.tag == "table":
            cap = next((c for c in n.children if c.tag == "caption"), None)
            if cap is not None and n.children[0] is not cap:
                penalty += 5
                issues.append("[TQ-07] <table> 的 <caption> 不是首个子元素，请前置")

    # TQ-08 封面块级元素必须显式声明 text-align（否则被 p{justify} 兜底导致字距撑开）
    cover_marker_classes = {"cover", "cover-page"}
    cover_child_marker_classes = {"subtitle", "report-tag", "report-title"}
    covers = [n for n in preorder if n.classes() & cover_marker_classes]
    for cover in covers:
        for d in cover.descendants():
            if d.tag not in ({"h1"} | {"div", "p"}):
                continue
            cls = d.classes()
            is_cover_block = (
                d.tag == "h1"
                or bool(cls & cover_child_marker_classes)
                or any(c.startswith("cover-") for c in cls)
            )
            if not is_cover_block:
                continue
            style = d.attrs.get("style", "") or ""
            if not re.search(r"\btext-align\s*:", style):
                penalty += 10
                label = "<%s%s>" % (
                    d.tag,
                    (" class=\"%s\"" % d.attrs["class"]) if d.attrs.get("class") else "",
                )
                issues.append(
                    "[TQ-08] 封面 %s 未显式声明 text-align，可能被 p{text-align:justify} 兜底导致字距撑开，请补 style=\"... text-align: center;\""
                    % label
                )

    score = max(0, 100 - penalty)
    return {"passed": score >= 75, "score": score, "issues": issues}


# --------------------------------------------------------------------------- #
# 维度 4：文体契合度（权重 20%）
# --------------------------------------------------------------------------- #
def check_genre_fit(root, genre):
    genre = (genre or "general").strip().lower()
    if genre in ("general", "", "unknown"):
        return {"passed": True, "score": 100, "issues": []}

    all_classes = set()
    all_ids = set()
    data_comp = []
    for n in root.descendants():
        all_classes |= n.classes()
        if n.attrs.get("id"):
            all_ids.add(n.attrs["id"])
        dc = n.attrs.get("data-component")
        if dc:
            data_comp.append((dc, n))
    full_text = root.text()

    missing = []
    critical = False

    def has_class(*names):
        return any(c in all_classes for c in names)

    if genre == "government-doc":
        if not (has_class("doc-number") or ("〔" in full_text and "〕" in full_text and "号" in full_text)):
            missing.append("[GF-01] 缺少发文字号区（.doc-number 或 〔〕号 结构）")
        if not has_class("doc-issuer", "gov-doc-header"):
            missing.append("[GF-02] 缺少红头标题（.doc-issuer / .gov-doc-header）")
        if not has_class("doc-footer-sign", "issuer-sign"):
            missing.append("[GF-03] 缺少落款区（.doc-footer-sign / .issuer-sign）")

    elif genre == "legal-contract":
        if not has_class("party-info"):
            missing.append("[LC-01] 缺少当事人信息区（.party-info）")
        if not (re.search(r"第[\s\S]{0,6}?条", full_text) or re.search(r"第[\s\S]{0,6}?章", full_text)):
            missing.append("[LC-02] 缺少条款编号结构（第X条 / 第X章）")
        if not (has_class("signature-block") and has_class("signature-party")):
            missing.append("[LC-03] 缺少签章区（.signature-block + .signature-party）")

    elif genre == "academic-paper":
        if not has_class("abstract"):
            missing.append("[AP-01] 缺少摘要区（.abstract）")
        if not has_class("references"):
            missing.append("[AP-02] 缺少参考文献区（.references）")

    elif genre == "stock-research":
        if not has_class("abstract-box", "research-abstract"):
            missing.append("[SR-01] 缺少摘要框（.abstract-box / .research-abstract）")
        risk_ok = any(
            dc == "callout"
            and n.attrs.get("data-variant") == "warning"
            and "风险" in n.text()
            for dc, n in data_comp
        )
        if not risk_ok:
            missing.append("[SR-02] 缺少风险提示区（callout warning + “风险”），研报必须包含")
            critical = True
        if not has_class("disclaimer"):
            missing.append("[SR-03] 缺少免责声明区（.disclaimer）")

    elif genre == "business-report":
        if not has_class("executive-summary"):
            missing.append("[BR-01] 缺少执行摘要区（.executive-summary）")
        has_table = any(n.tag == "table" for n in root.descendants())
        has_card = any(dc == "data-card" for dc, _ in data_comp)
        if not (has_table or has_card):
            missing.append("[BR-02] 缺少数据表格（<table> 或 data-card）")

    elif genre == "meeting-minutes":
        if not (has_class("attendee-table") or ("姓名" in full_text and "部门" in full_text)):
            missing.append("[MM-01] 缺少出席人列表（.attendee-table 或 姓名/部门 表头）")
        if not has_class("agenda-list", "agenda-item"):
            missing.append("[MM-02] 缺少议题列表（.agenda-list / .agenda-item）")
        if not (has_class("resolution-list", "resolution-item") or "决议" in full_text):
            missing.append("[MM-03] 缺少决议区（.resolution-list / .resolution-item / “决议”）")
    else:
        return {"passed": True, "score": 100, "issues": []}

    if critical:
        return {"passed": False, "score": 0, "issues": missing}
    if not missing:
        return {"passed": True, "score": 100, "issues": []}
    if len(missing) == 1:
        return {"passed": False, "score": 70, "issues": missing}
    return {"passed": False, "score": 50, "issues": missing}


# --------------------------------------------------------------------------- #
# 维度 5：装饰使用合理性（权重 10%）
# --------------------------------------------------------------------------- #
def check_decoration_usage(root):
    issues = []
    penalty = 0
    preorder = list(root.descendants())

    comp = {"callout": [], "data-card": [], "section-marker": [], "divider": []}
    for n in preorder:
        dc = n.attrs.get("data-component")
        if dc in comp:
            comp[dc].append(n)

    # DU-01 callout 频率
    n_callout = len(comp["callout"])
    if n_callout > 5:
        over = n_callout - 5
        penalty += 10 * over
        issues.append("[DU-01] 文档含 %d 个 callout，超出上限 5 个，请合并或改为正文" % n_callout)

    # DU-02 data-card 空内容
    for i, n in enumerate(comp["data-card"], 1):
        cls = set()
        for d in n.descendants():
            cls |= d.classes()
        if not (cls & {"card-value", "card-kv-list"}):
            penalty += 15
            issues.append("[DU-02] 第 %d 个 data-card 无实际内容，请填充数据或删除" % i)

    # DU-03 danger 语义匹配
    danger_kw = ("禁止", "严禁", "不得", "危险")
    for i, n in enumerate(comp["callout"], 1):
        if n.attrs.get("data-variant") == "danger":
            if not any(k in n.text() for k in danger_kw):
                penalty += 15
                issues.append(
                    "[DU-03] 第 %d 个 callout 使用 danger 变体但内容为普通提示，请改为 info/warning" % i
                )

    # DU-04 连续 divider
    prev_divider = False
    for n in preorder:
        dc = n.attrs.get("data-component")
        if dc == "divider":
            if prev_divider:
                penalty += 10
                issues.append("[DU-04] 出现连续 divider，请删除其中一个或在其间补充内容")
            prev_divider = True
        elif dc in ("callout", "data-card", "section-marker") or n.tag in CONTENT_TAGS or n.tag in HEADING_TAGS:
            if n.tag == "p" and is_empty_text(n):
                continue
            prev_divider = False

    # DU-05 section-marker 层级对齐
    for i, n in enumerate(preorder):
        if n.attrs.get("data-component") == "section-marker":
            level = n.attrs.get("data-level")
            nxt_h = None
            for m in preorder[i + 1:]:
                if m.tag in HEADING_TAGS:
                    nxt_h = m.tag
                    break
            if level and nxt_h and level != nxt_h:
                penalty += 10
                issues.append(
                    "[DU-05] section-marker data-level=%s 与紧邻标题 <%s> 层级不一致，请对齐"
                    % (level, nxt_h)
                )

    # DU-06 装饰密度（WARNING）
    n_p = sum(1 for n in preorder if n.tag == "p")
    numerator = n_callout + len(comp["data-card"]) + len(comp["section-marker"])
    if n_p > 0 and numerator / n_p > 0.5:
        issues.append(
            "[DU-06] 装饰密度 %.2f > 0.5（WARNING），装饰组件偏多，建议精简"
            % (numerator / n_p)
        )

    score = max(0, 100 - penalty)
    return {"passed": score >= 70, "score": score, "issues": issues}


# --------------------------------------------------------------------------- #
# 维度 6：安全性审查（XSS 防护，一票否决）
# --------------------------------------------------------------------------- #
def _host_of(url):
    m = re.match(r"\s*(?:https?:)?//([^/]+)", url)
    return m.group(1).lower() if m else None


def check_security(root, style_text, raw_html, builder):
    issues = []
    fail = False
    preorder = list(root.descendants())

    # SC-01 <script>
    if builder.has_script:
        fail = True
        issues.append("[SC-01] 文档存在 <script> 标签，请完全删除")

    # SC-02 内联事件处理器
    for n in preorder:
        on_attrs = [k for k in n.attrs if re.match(r"on\w+$", k)]
        if on_attrs:
            fail = True
            issues.append(
                "[SC-02] <%s> 含内联事件属性 %s，请删除" % (n.tag, ",".join(on_attrs))
            )

    # SC-03 javascript: 伪协议
    for n in preorder:
        for a in ("href", "src", "action"):
            v = n.attrs.get(a)
            if v and v.strip().lower().startswith("javascript:"):
                fail = True
                issues.append(
                    '[SC-03] <%s %s="%s"> 使用 javascript: 伪协议，请改为安全写法'
                    % (n.tag, a, v[:40])
                )

    # SC-04 危险嵌入标签
    for n in preorder:
        if n.tag in ("iframe", "object", "embed", "applet", "base"):
            fail = True
            issues.append("[SC-04] 文档存在 <%s> 危险嵌入标签，请删除" % n.tag)

    # SC-05 CSS 危险表达式
    low = style_text.lower()
    for pat, name in (
        (r"expression\s*\(", "expression()"),
        (r"url\(\s*['\"]?\s*javascript:", "url(javascript:)"),
        (r"-moz-binding", "-moz-binding"),
    ):
        if re.search(pat, low):
            fail = True
            issues.append("[SC-05] <style> 含危险表达式 %s，请删除" % name)

    # SC-06 外部资源引用
    for n in preorder:
        for a in ("src", "href", "action"):
            v = n.attrs.get(a)
            if not v:
                continue
            vs = v.strip()
            if vs.startswith("data:") or vs.startswith("#") or vs.startswith("mailto:"):
                continue
            host = _host_of(vs)
            if host is None:
                continue  # 相对路径，允许
            if host in FONT_HOSTS:
                issues.append(
                    "[SC-06] <%s> 引用外部字体服务 %s（WARNING），建议内联" % (n.tag, host)
                )
            else:
                fail = True
                issues.append(
                    '[SC-06] <%s %s="%s"> 引用外部资源，存在注入风险，请改为内联或删除'
                    % (n.tag, a, vs[:50])
                )

    return {"passed": not fail, "score": 0 if fail else 100, "issues": issues}


# --------------------------------------------------------------------------- #
# 主流程
# --------------------------------------------------------------------------- #
def review(html_str, genre=None):
    builder = TreeBuilder()
    builder.feed(html_str)
    builder.close()
    root = builder.root
    style_text = collect_style_text(root, builder.style_blocks)

    dt = check_design_token(root, builder.style_blocks)
    si = check_structural_integrity(root, builder.style_blocks)
    tq = check_typographic_quality(root)
    gf = check_genre_fit(root, genre)
    du = check_decoration_usage(root)
    sc = check_security(root, style_text, html_str, builder)

    composite = (
        dt["score"] * 0.25
        + si["score"] * 0.25
        + tq["score"] * 0.20
        + gf["score"] * 0.20
        + du["score"] * 0.10
    )
    score = round(composite)

    all_dims_passed = all(d["passed"] for d in (dt, si, tq, gf, du))
    passed = bool(sc["passed"] and all_dims_passed and score >= 80)

    # actionable_feedback：安全 > 文体关键 > DT > SI > TQ > 装饰
    feedback = []
    for d in (sc, gf, dt, si, tq, du):
        feedback.extend(d["issues"])

    return {
        "passed": passed,
        "score": score,
        "dimensions": {
            "design_token_compliance": dt,
            "structural_integrity": si,
            "typographic_quality": tq,
            "genre_fit": gf,
            "decoration_usage": du,
            "security": sc,
        },
        "actionable_feedback": feedback,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description="html-review 确定性质量门禁检测")
    src = parser.add_mutually_exclusive_group(required=True)
    src.add_argument("--html", help="待检测 HTML 文件路径")
    src.add_argument("--stdin", action="store_true", help="从标准输入读取 HTML")
    parser.add_argument("--genre", default="general", help="文档类型（government-doc 等）")
    args = parser.parse_args(argv)

    try:
        if args.stdin:
            html_str = sys.stdin.read()
        else:
            with open(args.html, "r", encoding="utf-8") as f:
                html_str = f.read()
    except OSError as e:
        sys.stderr.write("无法读取 HTML 输入: %s\n" % e)
        return 2

    if not html_str.strip():
        sys.stderr.write("HTML 输入为空\n")
        return 2

    report = review(html_str, args.genre)
    sys.stdout.write(json.dumps(report, ensure_ascii=False, indent=2))
    sys.stdout.write("\n")
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
