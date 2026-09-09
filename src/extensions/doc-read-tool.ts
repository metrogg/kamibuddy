/**
 * 文档读取工具扩展：read_document。
 *
 * 与 web-tools.ts 同一套两层结构：core/doc-extract.ts 是纯函数层（pdfjs /
 * officeparser 的调用姿势全在那边，可单测），本文件只做三件事 —— 注册工具、
 * 把提取结果排成模型能读的文本、把 DocExtractError 转成模型可读的 Error
 * （pi 约定 execute 抛错 = 工具失败，错误文案回给模型能自我纠正，同 web 工具）。
 *
 * 与 read 的分工写在工具描述里：read 读纯文本 / 代码 / 图片，
 * read_document 读 PDF / Office 二进制文档 —— 模型用 read 读 PDF 只会拿到乱码，
 * 分工必须在描述里讲清，否则模型会挑错工具。
 *
 * 为什么不加「不可信输入」标记（web_fetch 在正文前加的那行）：web_fetch 的内容
 * 来自外部站点，可能含提示注入；read_document 读的是用户自己的本地文件，
 * 且区外路径已过权限门询问 —— 风险等级与 read 相同，read 不加，这里也不加。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { DocExtractError, extractDocument } from "../core/doc-extract.ts";

export interface DocReadToolOptions {
	/** 测试注入。缺省走 core 的真实实现。 */
	readonly extract?: typeof extractDocument;
}

export function createDocReadTool(options: DocReadToolOptions = {}) {
	return (pi: ExtensionAPI): void => {
		pi.registerTool({
			name: "read_document",
			label: "阅读文档",
			description:
				"Read a PDF or Office document (pdf, docx, xlsx, pptx, odt, odp, ods) and extract its text. " +
				"Use this tool for those document formats; use `read` for plain text, code, and images instead. " +
				"PDFs are extracted page by page: offset/limit are page numbers (1-indexed) and reading starts at page 1 by default. " +
				"Office documents are extracted as one text stream: offset/limit are character positions (1-indexed). " +
				"Long documents are truncated and the result ends with a continuation hint — call again with the suggested offset to keep reading. " +
				"Scanned PDFs without a text layer, legacy .doc/.xls/.ppt files, and encrypted documents cannot be read; the error message says what to do instead.",
			promptSnippet: "PDF / Word / Excel / PPT / ODF 文档用 read_document 提取正文；纯文本、代码、图片仍用 read。",
			promptGuidelines: [
				"长文档按返回末尾的续读提示（offset=N）继续读；不要凭已读部分编造未读内容。",
				"扫描件 PDF、老格式 .doc/.xls/.ppt、加密文件读不了，按错误文案引导用户转换后再读，不要反复重试。",
			],
			parameters: Type.Object({
				path: Type.String({ description: "Path to the document (relative or absolute)." }),
				offset: Type.Optional(
					Type.Number({
						description: "PDF: page number to start from (1-indexed, default 1). Office: character position to start from (1-indexed, default 1).",
					}),
				),
				limit: Type.Optional(
					Type.Number({
						description: "PDF: maximum number of pages to read. Office: maximum number of characters to read. Output is capped either way.",
					}),
				),
			}),
			async execute(_toolCallId, params) {
				const extract = options.extract ?? extractDocument;
				try {
					const result = await extract(params.path, params.offset, params.limit);
					return {
						// 空文档（新建没写内容）是合法形态：给一句明确的说明，
						// 空串会让模型以为提取失败而反复重试。
						content: [
							{
								type: "text",
								text: result.text === "" ? "（该文档没有可提取的文本内容）" : result.text,
							},
						],
						details: {
							truncated: result.truncated,
							nextOffset: result.nextOffset,
							totalPages: result.totalPages,
						},
					};
				} catch (err) {
					// DocExtractError 的 message 就是写给模型的可行动文案（core 层契约），
					// 转成普通 Error 抛出 —— pi 标记 isError 并把文案回给模型。
					// 其余异常（环境故障等）原样上抛，不包装、不吞。
					if (err instanceof DocExtractError) throw new Error(err.message);
					throw err;
				}
			},
		});
	};
}
