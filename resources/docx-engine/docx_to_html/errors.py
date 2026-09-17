"""errors.py — 可预期的失败（输入类问题）的专用异常。

为什么要单独一个异常类型：这类问题的 message 是要**直接给人看**的
（路径不存在 / 不是 .docx / 不是 zip / 缺 word/document.xml），会原样进 CLI 的
error 字段；而 python-docx 抛出的解析异常属于「这份文件比我们预想的怪」，
两者在调用方（工具层）的处置不同，不该混成一个字符串。
"""
from __future__ import annotations


class DocxExtractError(Exception):
    """输入类失败：消息含文件名与原因，直接作为 ``error`` 上抛。"""
