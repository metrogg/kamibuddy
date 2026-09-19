#!/usr/bin/env python3
"""就地内嵌圆桌报告 HTML 中的头像（`src="avatars/*.png"` → base64 data URI）。

本仓库改动（2026-09-19）：**Pillow 不再是硬依赖**。

源脚本在缺 Pillow 时直接 `SystemExit(1)`，导致整条渲染链失败、头像留成相对路径
（而 `expert.md` 铁律 #8 明确要求「HTML 里头像不能是 `avatars/*.png` 相对路径」）。
本实现改为：有 Pillow 就压成 128px WebP（体积小），没有就退回**原样内嵌 PNG**——
体积大一些，但交付物正确、不阻塞流程，也不再需要用户额外装依赖。
"""
from __future__ import annotations

import argparse
import base64
import io
import re
import sys
from pathlib import Path

try:
	from PIL import Image
except ImportError:
	Image = None


def build_data_uri(png_path: Path, max_size: int = 128, quality: int = 85) -> str:
	raw = png_path.read_bytes()
	if Image is None:
		# 降级：不压缩，直接内嵌原 PNG。
		return "data:image/png;base64," + base64.b64encode(raw).decode("ascii")
	img = Image.open(png_path).convert("RGBA")
	img.thumbnail((max_size, max_size), Image.LANCZOS)
	buf = io.BytesIO()
	img.save(buf, format="WEBP", quality=quality, method=6)
	return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def embed(html_path: Path, avatars_dir: Path) -> None:
	if not html_path.is_file():
		print(f"[embed_avatars] HTML 文件不存在: {html_path}", file=sys.stderr)
		raise SystemExit(2)
	if not avatars_dir.is_dir():
		print(f"[embed_avatars] avatars 目录不存在: {avatars_dir}", file=sys.stderr)
		raise SystemExit(2)

	html = html_path.read_text(encoding="utf-8")
	pattern = re.compile('src="avatars/([^"/]+\\.png)"')
	names = sorted(set(pattern.findall(html)))
	if not names:
		print('[embed_avatars] 未发现 src="avatars/*.png" 的引用，无需处理。')
		return

	uris: dict[str, str] = {}
	missing: list[str] = []
	for name in names:
		path = avatars_dir / name
		if not path.is_file():
			missing.append(name)
			continue
		uris[name] = build_data_uri(path)

	replaced = 0

	def substitute(match: re.Match[str]) -> str:
		nonlocal replaced
		name = match.group(1)
		if name in uris:
			replaced += 1
			return f'src="{uris[name]}"'
		return match.group(0)

	out = pattern.sub(substitute, html)
	html_path.write_text(out, encoding="utf-8")
	size_kb = html_path.stat().st_size // 1024
	mode = "WebP 压缩" if Image is not None else "原始 PNG（未装 Pillow，已降级）"
	print(f"[embed_avatars] 已内嵌 {len(uris)} 张头像（{mode}），替换 {replaced} 处引用 → {html_path} ({size_kb} KB)")
	if missing:
		print(f"[embed_avatars] 警告: 以下头像文件缺失，保留相对路径不变: {missing}", file=sys.stderr)


def main() -> None:
	parser = argparse.ArgumentParser(description="就地内嵌圆桌报告 HTML 中的头像")
	parser.add_argument("html_file", help="目标 HTML 文件路径")
	parser.add_argument(
		"avatars_dir",
		nargs="?",
		default=None,
		help="头像目录（默认: 脚本相对的 ../../../avatars）",
	)
	args = parser.parse_args()
	if args.avatars_dir:
		avatars_dir = Path(args.avatars_dir).resolve()
	else:
		avatars_dir = (Path(__file__).resolve().parent / "../../../avatars").resolve()
	embed(Path(args.html_file).resolve(), avatars_dir)


if __name__ == "__main__":
	main()
