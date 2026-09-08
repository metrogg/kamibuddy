/**
 * present_files：产物显式交付工具（对齐 WorkBuddy 的同名内置工具，
 * 实现证据见 08-builtin-tools-reference.md §1）。
 *
 * 为什么是一等工具而不是 UI 聚合：交付是模型的**意图**，不是写盘的副作用 ——
 * 草稿与中间产物不该出现在产物清单里。系统提示词教模型在任务完成、
 * 已有可用成果时调用本工具（resources/scenes 的「交付」段）。
 *
 * 分类与安全边界：
 * - 只读工具：stat 文件大小 + 发出交付事件，不改任何状态（权限门直接放行）。
 * - 文件大小只在工作区内 stat —— 模型给出的区外绝对路径不探测
 *   （存在性/大小也是信息，区外一滴不漏）。
 * - URL（http/https）只进交付列表，不自动打开（X-Frame-Options 不可控，
 *   且我们的预览面板只服务本地文件）。
 */

import { statSync } from "node:fs";
import { resolve, sep } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
	classifyPresentedFiles,
	type PresentedFile,
} from "../shared/artifacts.ts";

export interface PresentFilesOptions {
	/** 当前工作区（playground 为 undefined）。 */
	readonly getWorkspaceDir: () => string | undefined;
	/** 交付出口：daemon 把它接成 artifacts_presented 会话事件。 */
	readonly onPresent: (payload: {
		files: readonly PresentedFile[];
		focusFile: string | undefined;
	}) => void;
}

export function createPresentFiles(options: PresentFilesOptions) {
	return (pi: ExtensionAPI): void => {
		pi.registerTool({
			name: "present_files",
			label: "交付产物",
			description:
				"把本轮任务产出的成果文件交付给用户。files 必须全部是绝对路径或 http(s) URL，" +
				"顺序即推荐观看顺序，第一个本地文件会在预览面板自动打开。" +
				"任务完成、已经产出可用文件时调用一次；草稿与中间产物不要交付。",
			promptSnippet: "present_files: 任务完成时把成果文件（绝对路径）交付给用户并在预览面板打开",
			parameters: Type.Object({
				files: Type.Array(Type.String(), {
					description: "绝对路径或 http(s) URL，顺序即推荐观看顺序",
					minItems: 1,
				}),
				explanation: Type.Optional(
					Type.String({ description: "一句话说明交付内容" }),
				),
			}),
			execute: async (_toolCallId, params) => {
				const workspaceDir = options.getWorkspaceDir();

				// 文件大小只在工作区内 stat：区外路径的存在性/大小也是信息，不探测。
				const sizeOf = (absPath: string): number | undefined => {
					if (workspaceDir === undefined) return undefined;
					const ws = resolve(workspaceDir);
					const target = resolve(absPath);
					if (target !== ws && !target.startsWith(ws + sep)) return undefined;
					try {
						return statSync(target).size;
					} catch {
						// 模型报了个不存在的路径：大小按 0 落，警告进结果（不整单失败，
						// 其余有效文件仍交付 —— 模型能从警告里知道哪个路径写错了）。
						return undefined;
					}
				};

				const { files, focusFile, invalid } = classifyPresentedFiles(params.files, sizeOf);
				if (invalid.length > 0) {
					// WorkBuddy 同口径：非绝对路径整单报错，不交付任何一项。
					throw new Error(
						`present_files 的 files 必须全部是绝对路径或 http(s) URL。无效项：${invalid.join("、")}`,
					);
				}

				options.onPresent({ files, focusFile });

				const missing = files
					.filter((f) => !/^https?:\/\//i.test(f.path) && f.size === 0)
					.map((f) => f.path);
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({
								type: "present_files_result",
								files: files.map((f) => f.path),
								previewed: focusFile === undefined ? [] : [focusFile],
								explanation: params.explanation,
								message: "已交付，首个文件已在预览面板打开",
								...(missing.length > 0
									? { warnings: [`以下路径不存在或不可读，请核对：${missing.join("、")}`] }
									: {}),
							}),
						},
					],
					details: {},
				};
			},
		});
	};
}
