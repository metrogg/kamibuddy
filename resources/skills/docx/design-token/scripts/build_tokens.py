#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""design-token 预编译构建脚本。

把 tokens/themes/*.json（W3C DTCG 主题）预编译为「按 genre 直接查表」的完整
DesignTokenOutput 产物，输出到 tokens/compiled/<genre>.json。

预编译后 design-token skill 运行时只需按 genre 读取对应 compiled JSON 即可，
无需任何 LLM 推理或 CSS 变量转换往返（0 次 LLM）。

CSS 变量命名 = token 路径扁平化（与 doc-typeset 模板的 token 注入层一致）：
    typography.fontSize.h1  -> --typography-fontSize-h1
    typography.fontFamily.body -> --typography-fontFamily-body
    color.primary           -> --color-primary
    spacing.paragraph       -> --spacing-paragraph
    layout.marginTop        -> --layout-marginTop

用法：
    python3 build_tokens.py            # 全量重建 compiled/
"""

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL_DIR = os.path.dirname(HERE)
# KamiBuddy 布局：tokens 数据上移一层，与 design-token/ 平级（<docx_root>/tokens/）
TOKENS_DIR = os.path.join(os.path.dirname(SKILL_DIR), "tokens")
THEMES_DIR = os.path.join(TOKENS_DIR, "themes")
RULES_DIR = os.path.join(TOKENS_DIR, "rules")
OUT_DIR = os.path.join(TOKENS_DIR, "compiled")

# genre -> (theme 文件名, rules 文件名 or None)  —— 与 SKILL.md §3 映射表一致
GENRE_MAP = {
    "government-doc": ("formal-government.json", "gb-t-9704-government.md"),
    "academic-paper": ("academic-paper.json", "gb-t-7713-academic.md"),
    "business-report": ("business-modern.json", None),
    "marketing-doc": ("creative-marketing.json", None),
    "general": ("modern-minimal.json", None),
}


def flatten(node, path, out):
    """递归扁平化 DTCG token 树为 { "--a-b-c": "value" }。"""
    if isinstance(node, dict):
        if "$value" in node:
            name = "--" + "-".join(path)
            out[name] = _stringify(node["$value"])
            return
        for k, v in node.items():
            if k.startswith("$"):
                continue
            flatten(v, path + [k], out)


def _stringify(value):
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, float):
        # 去掉多余的 .0，保持 1.5 / 1.7 这类行距原样
        return ("%g" % value)
    return str(value)


def build_one(genre, theme_file, rules_file):
    with open(os.path.join(THEMES_DIR, theme_file), "r", encoding="utf-8") as f:
        theme = json.load(f)

    css_variables = {}
    for category in ("typography", "color", "spacing", "layout"):
        if category in theme:
            flatten(theme[category], [category], css_variables)

    rules_path = None
    if rules_file and os.path.exists(os.path.join(RULES_DIR, rules_file)):
        rules_path = "../tokens/rules/%s" % rules_file

    return {
        "genre": genre,
        "theme_name": theme.get("$name", os.path.splitext(theme_file)[0]),
        "theme_file": "../tokens/themes/%s" % theme_file,
        "tokens": theme,
        "typography_rules": rules_path,
        "css_variables": css_variables,
    }


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    index = {}
    for genre, (theme_file, rules_file) in GENRE_MAP.items():
        output = build_one(genre, theme_file, rules_file)
        out_path = os.path.join(OUT_DIR, "%s.json" % genre)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
            f.write("\n")
        index[genre] = "../tokens/compiled/%s.json" % genre
        print("built %-18s -> %s (%d css vars)"
              % (genre, out_path, len(output["css_variables"])))

    # 写一个 genre -> compiled 文件的查表索引，兜底 general
    index["_fallback"] = "general"
    with open(os.path.join(OUT_DIR, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("built index -> %s" % os.path.join(OUT_DIR, "index.json"))


if __name__ == "__main__":
    main()
