"""图片导出：媒体落盘 + HTML 相对引用 + JSON 清单 + 缺省 assets 目录规则。"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


def _make_png(path: Path, size: tuple[int, int] = (60, 40)) -> Path:
    Image.new("RGB", size, (30, 90, 200)).save(path)
    return path


def test_image_is_copied_to_assets_and_referenced_relatively(
    make_docx, extract_docx, tmp_path, read_html
):
    png = _make_png(tmp_path / "chart.png")

    def build(document):
        document.add_paragraph("图前")
        document.add_picture(str(png))
        document.add_paragraph("图后")

    docx_path = make_docx(build)
    assets_dir = tmp_path / "assets"
    html_path = tmp_path / "out.html"
    result = extract_docx(docx_path, html_path, "--assets-dir", str(assets_dir))
    html = read_html(html_path)

    # 文件真的落到 <assets-dir>/images/ 下
    exported = assets_dir / "images"
    files = sorted(path.name for path in exported.iterdir())
    assert files, "图片没有落盘"
    assert exported.joinpath(files[0]).read_bytes() == Path(png).read_bytes()

    # 引用是**相对 HTML 文件所在目录**的相对路径（用 HTML 的目录当 base_dir 必须能解析到）
    # 这里 html 在 tmp_path/out.html、图在 tmp_path/assets/images/ → src = "assets/images/<name>"
    expected_src = f"assets/images/{files[0]}"
    assert f'<img src="{expected_src}"' in html
    assert (html_path.parent / expected_src).resolve() == exported.joinpath(files[0]).resolve()
    assert len(result["images"]) == 1
    assert result["images"][0]["src"] == expected_src
    assert result["images"][0]["file"] == str(exported.joinpath(files[0]).resolve())
    assert result["images"][0]["source"].startswith("word/media/")

    # 尺寸来自 wp:extent（EMU → px）
    assert "width=" in html and "height=" in html
    assert html.index("图前") < html.index("<img") < html.index("图后")


def test_default_assets_dir_is_next_to_html(make_docx, extract_docx, tmp_path, read_html):
    png = _make_png(tmp_path / "logo.png")

    def build(document):
        document.add_picture(str(png))

    docx_path = make_docx(build)
    html_path = tmp_path / "out" / "doc.html"
    result = extract_docx(docx_path, html_path)
    html = read_html(html_path)

    # 缺省规则：<html 所在目录>/<html 文件名去扩展名>_assets
    expected = tmp_path / "out" / "doc_assets"
    assert Path(result["assets_dir"]) == expected.resolve()
    assert (expected / "images").is_dir()
    assert result["html_path"] == str(html_path.resolve())

    # 缺省布局下引用是 "doc_assets/images/<name>"（相对 out/），且能从 HTML 目录解析到真实文件
    name = Path(result["images"][0]["file"]).name
    assert result["images"][0]["src"] == f"doc_assets/images/{name}"
    assert f'<img src="doc_assets/images/{name}"' in html
    assert (html_path.parent / result["images"][0]["src"]).resolve() == Path(
        result["images"][0]["file"]
    ).resolve()


def test_same_media_referenced_twice_is_not_duplicated(
    make_docx, extract_docx, tmp_path, read_html
):
    png = _make_png(tmp_path / "same.png")

    def build(document):
        document.add_picture(str(png))
        document.add_picture(str(png))

    docx_path = make_docx(build)
    result = extract_docx(docx_path, tmp_path / "out.html")
    html = read_html(tmp_path / "out.html")

    assert len(result["images"]) == 1
    assert html.count("<img") == 2


def test_bad_assets_dir_does_not_leave_half_product(make_docx, cli, tmp_path):
    """图片目录写不进去时：exit 1 + 不产出 HTML（不许半成品）。"""

    def build(document):
        document.add_picture(str(_make_png(tmp_path / "p.png")))

    docx_path = make_docx(build)
    # 用一个「父路径是文件」的目录，mkdir 必然失败
    blocker = tmp_path / "blocker"
    blocker.write_text("not a directory", encoding="utf-8")
    html_path = tmp_path / "out.html"

    result = cli("extract", str(docx_path), "-o", str(html_path), "--assets-dir", str(blocker))
    assert result.returncode == 1
    payload = json.loads(result.stderr)
    assert payload["success"] is False
    assert payload["error"]
    assert not html_path.exists()
