"""conftest.py — 测试公共夹具。

两个约定：

1. 引擎不 pip 安装、随应用分发，所以测试自己把 ``resources/docx-engine``
   塞进 ``sys.path``（这样从任意 cwd 跑 pytest 都能 import docx_to_html）。
2. 测试**一律用子进程跑 CLI**：要测的就是真实契约（单行 JSON + exit 0/1 +
   stderr 不混 stdout），而不是内部函数；顺带覆盖 cli 解析与路径处理。
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Callable, Sequence

import pytest
from docx import Document

ENGINE_DIR = Path(__file__).resolve().parents[2]
if str(ENGINE_DIR) not in sys.path:
    sys.path.insert(0, str(ENGINE_DIR))

BuildDoc = Callable[[Document], None]


def run_engine_cli(engine_dir: Path, module: str, args: Sequence[str]) -> subprocess.CompletedProcess:
    env = {**os.environ, "PYTHONPATH": str(engine_dir)}
    return subprocess.run(
        [sys.executable, "-m", module, *args],
        cwd=str(engine_dir),
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )


@pytest.fixture(scope="session")
def engine_dir() -> Path:
    return ENGINE_DIR


@pytest.fixture
def engine_cli(engine_dir: Path) -> Callable[..., subprocess.CompletedProcess]:
    def _run(module: str, *args: str) -> subprocess.CompletedProcess:
        return run_engine_cli(engine_dir, module, args)

    return _run


@pytest.fixture
def cli(engine_cli: Callable[..., subprocess.CompletedProcess]) -> Callable[..., subprocess.CompletedProcess]:
    """跑 docx_to_html 的 CLI。"""

    def _run(*args: str) -> subprocess.CompletedProcess:
        return engine_cli("docx_to_html", *args)

    return _run


@pytest.fixture
def extract_docx(cli: Callable[..., subprocess.CompletedProcess]) -> Callable[..., dict]:
    """提取并断言成功，返回解析后的 JSON（失败的用例直接自己调 cli）。"""

    def _run(docx_path: Path, html_path: Path, *extra: str) -> dict:
        result = cli("extract", str(docx_path), "-o", str(html_path), *extra)
        assert result.returncode == 0, f"提取失败：{result.stderr}"
        return json.loads(result.stdout)

    return _run


@pytest.fixture
def make_docx(tmp_path: Path) -> Callable[..., Path]:
    """现造一个 .docx（fixture 不进仓：二进制素材一律临时生成）。"""

    def _make(build: BuildDoc, name: str = "input.docx") -> Path:
        document = Document()
        build(document)
        path = tmp_path / name
        document.save(str(path))
        return path

    return _make


@pytest.fixture
def read_html() -> Callable[[Path], str]:
    def _read(path: Path) -> str:
        assert path.exists(), f"HTML 未产出：{path}"
        return path.read_text(encoding="utf-8")

    return _read
