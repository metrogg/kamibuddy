"""真实往返：正向引擎（html→docx）产出 → 反向模块（docx→html）读回。

为什么放在测试里而不是一次性脚本：这条链路是「照既有文档版式重排」的地基，
升级任一侧引擎都可能悄悄改坏它。产物全部落 pytest 的 tmp_path（仓里不留二进制）。
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

pytest.importorskip("html_to_docx", reason="正向引擎依赖未安装（用托管 venv 的 python 跑测试）")


def test_forward_then_reverse_keeps_structure(engine_dir: Path, engine_cli, tmp_path: Path):
    sample = engine_dir / "examples" / "report-sample.html"
    docx_path = tmp_path / "report.docx"
    html_path = tmp_path / "report-back.html"

    forward = engine_cli("html_to_docx", "convert", str(sample), "-o", str(docx_path))
    assert forward.returncode == 0, forward.stderr
    assert docx_path.exists()

    reverse = engine_cli(
        "docx_to_html",
        "extract",
        str(docx_path),
        "-o",
        str(html_path),
        "--assets-dir",
        str(tmp_path / "report_assets"),
    )
    assert reverse.returncode == 0, reverse.stderr
    payload = json.loads(reverse.stdout)
    assert payload["success"] is True

    html = html_path.read_text(encoding="utf-8")

    # 标题层级
    assert "<h1" in html and "一、本周工作进展" in html
    assert "<h2" in html and "1.1 文档生成能力" in html
    assert "<h1" in html and "三、下周计划" in html
    # 表格（表头 + 单元格文本）
    assert "<table" in html
    assert "<th" in html and "指标" in html and "环比" in html
    assert "转换成功率" in html and "98.5%" in html
    # 列表
    assert "<ul><li>" in html and "搭建托管" in html
    # 正文关键串（中英混排不能丢字）
    assert "WorkBuddy" in html and "python-docx" in html

    # 这份样张没有页眉页脚/分节/域代码/图表 → 必须报空（诚实性）
    print(f"not_restorable: {payload['not_restorable']}")
    assert payload["not_restorable"] == []
    print(f"warnings: {payload['warnings']}")
