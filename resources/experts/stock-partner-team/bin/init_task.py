#!/usr/bin/env python3
"""本地任务标记（no-op）。

源专家包的同名脚本是一个遥测上报器：它会生成设备 UUID 落盘到
`~/.westock-stock-partner/dev_id`，向上游 InLong 端点 POST
`task_start` / `task_complete` 事件（含耗时、成败、设备标识，以及由工作区
`.git` 路径推出的会话键）。本仓库**移除了全部网络上报**，只保留本地标记。

保留该命令的理由：`expert.md` 与 `skills/md-to-html/SKILL.md` 里有多处
`init_task start|complete` 调用，保留命令可以让那些正文一字不改地跑通，
不产生「模型调用不存在的命令」这类噪声失败。

行为：
  start     —— 记一个开始时间戳到 ~/.kamibuddy/expert-task.json（本地）
  complete  —— 删除该时间戳；**不做任何上报**
  local-id  —— 打印一个每次运行都不同的本地随机串（不落盘、不联网）
              （源脚本此处为 `dev-id`，会持久化设备标识用于归因；本实现改了名，
               以明确它不承担任何身份或归因职能）

任何异常都不抛出、永不以非零码退出：与源脚本一致，这个命令不该影响主流程。
"""
from __future__ import annotations

import json
import os
import sys
import time
import uuid
from pathlib import Path

STATE_DIR = Path.home() / ".kamibuddy"
STATE_FILE = STATE_DIR / "expert-task.json"


def _write(payload: dict) -> None:
	tmp = STATE_FILE.with_name(f"{STATE_FILE.name}.{os.getpid()}.tmp")
	tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
	os.replace(str(tmp), str(STATE_FILE))


def cmd_start() -> None:
	STATE_DIR.mkdir(parents=True, exist_ok=True)
	_write({"start_ts": int(time.time() * 1000)})


def cmd_complete() -> None:
	# 不读内容、不算耗时、不上报——只清掉标记。
	try:
		STATE_FILE.unlink()
	except OSError:
		pass


def cmd_local_id() -> None:
	print(f"local-{uuid.uuid4()}")


def main() -> None:
	mode = sys.argv[1] if len(sys.argv) > 1 else "local-id"
	if mode == "start":
		cmd_start()
	elif mode == "complete":
		cmd_complete()
	elif mode == "local-id":
		cmd_local_id()
	else:
		print("用法: init_task [start|complete|local-id]", file=sys.stderr)
		raise SystemExit(2)


if __name__ == "__main__":
	try:
		main()
	except Exception:
		# 静默：本命令永不阻塞调用方。
		pass
