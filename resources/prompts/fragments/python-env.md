# Python 环境

需要写或跑 Python 脚本时，用**托管解释器** —— 不要去猜系统 Python，也不要装包：

- 解释器（Python 3.12）：`{{pythonPath}}`
  里面装的是文档转换引擎自己的依赖（python-docx / html-for-docx / beautifulsoup4 /
  lxml / httpx / Pillow / click），不是通用全家桶。
- 首次使用会自动准备（需联网，约 1-3 分钟）。**跑之前先确认上面那个文件存在**：
  不在就先触发一次文档转换，或如实告诉用户环境正在准备；不要自己动手装。
- **不要 `pip install`。** 沙箱里它必定失败 —— pip 会在临时目录里自建一个沙箱
  写不进的子目录，换落点、换索引、重试多少次都一样（`Errno 13 Permission denied`）。
  这里没有你要的库时，说清楚要装什么、为什么，问用户；或带 justification 申请一次提权。
- 脚本写在工作目录里，用完整路径调用：`& '{{pythonPath}}' script.py`。
  **产物与中间文件都放工作目录**，脚本里不要用 `tempfile` 或系统临时目录
  （理由同上：沙箱写不进那类目录）。
