"""坏输入：响亮失败（exit 1 + stderr 一行 JSON）+ 不产出半成品 HTML。"""
from __future__ import annotations

import json
import zipfile
from pathlib import Path


def _assert_failure(result, html_path: Path, *expected_fragments: str) -> dict:
    assert result.returncode == 1
    assert result.stdout.strip() == ""  # 失败信息只走 stderr，不污染 stdout
    payload = json.loads(result.stderr)
    assert payload["success"] is False
    assert payload["error"]
    assert "warnings" in payload
    for fragment in expected_fragments:
        assert fragment in payload["error"], payload["error"]
    assert not html_path.exists(), "失败时不许产出半成品 HTML"
    return payload


def test_missing_path(cli, tmp_path):
    html_path = tmp_path / "out.html"
    result = cli("extract", str(tmp_path / "nope.docx"), "-o", str(html_path))
    payload = _assert_failure(result, html_path, "nope.docx", "不存在")
    assert payload["error"]


def test_not_a_docx_extension(cli, tmp_path):
    text = tmp_path / "note.txt"
    text.write_text("hello", encoding="utf-8")
    html_path = tmp_path / "out.html"
    result = cli("extract", str(text), "-o", str(html_path))
    _assert_failure(result, html_path, "note.txt", ".docx")


def test_plain_zip_renamed_to_docx(cli, tmp_path):
    fake = tmp_path / "fake.docx"
    with zipfile.ZipFile(fake, "w") as archive:
        archive.writestr("hello.txt", "hi")
    html_path = tmp_path / "out.html"
    result = cli("extract", str(fake), "-o", str(html_path))
    _assert_failure(result, html_path, "fake.docx", "Content_Types")


def test_zip_without_main_document(cli, tmp_path):
    half = tmp_path / "half.docx"
    with zipfile.ZipFile(half, "w") as archive:
        archive.writestr("[Content_Types].xml", "<Types/>")
    html_path = tmp_path / "out.html"
    result = cli("extract", str(half), "-o", str(html_path))
    _assert_failure(result, html_path, "half.docx", "word/document.xml")


def test_broken_zip_container(cli, tmp_path):
    broken = tmp_path / "broken.docx"
    broken.write_bytes(b"PK\x03\x04 not really a zip")
    html_path = tmp_path / "out.html"
    result = cli("extract", str(broken), "-o", str(html_path))
    _assert_failure(result, html_path, "broken.docx", "zip")


def test_missing_output_option(cli, tmp_path, make_docx):
    def build(document):
        document.add_paragraph("正文")

    docx_path = make_docx(build)
    result = cli("extract", str(docx_path))
    assert result.returncode == 1
    payload = json.loads(result.stderr)
    assert "缺少输出 HTML 路径" in payload["error"]


def test_no_images_is_not_a_failure(make_docx, cli, tmp_path):
    """没有图片时缺省 assets 目录只是空目录，不报错。"""

    def build(document):
        document.add_paragraph("纯文字")

    docx_path = make_docx(build)
    html_path = tmp_path / "out.html"
    result = cli("extract", str(docx_path), "-o", str(html_path))
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)["images"] == []
    assert html_path.exists()
