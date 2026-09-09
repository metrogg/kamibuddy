/**
 * 输入区图片附件（chat-view 与 home-view 共用）。
 *
 * 三个入口汇到同一份状态：粘贴（剪贴板图片项）、拖拽（文件）、工具栏 +
 * 按钮走系统文件选择框（window.kami.pickImageFiles，main 侧读文件并
 * 编码成 ImagePart）。粘贴/拖拽拿到的是原始 File，格式/大小守门在
 * renderer 做；dialog 入口的大小守门在 main 的 readImageFile 做（同一
 * 上限 shared/image.ts 的 MAX_IMAGE_BYTES），超限经 invoke reject 落到
 * pickFromDialog 的 catch → onError toast——三入口报错口径一致。
 *
 * 为什么抽成一份：粘贴/拖拽/选择三入口的过滤与报错口径必须一致，
 * 两个视图各写一份必然漂移（ime-guard 的教训，AGENTS.md §4 防重复）。
 */

import { useCallback, useState } from "react";
import { MAX_IMAGE_BYTES, type ImagePart } from "@shared/image.ts";

/** 接受的图片格式。svg 故意不收：以图片身份进入会话的 SVG 可携带脚本。 */
const ACCEPTED_MIME_TYPES: ReadonlySet<string> = new Set([
	"image/png",
	"image/jpeg",
	"image/gif",
	"image/webp",
]);

/** 粘贴/拖入的 File 可能没有文件名（截图项），报错文案给个兜底称呼。 */
function fileLabel(file: File): string {
	return file.name === "" ? "剪贴板图片" : file.name;
}

/** 拒绝原因；合格返回 undefined。 */
function rejectReason(file: File): string | undefined {
	if (!ACCEPTED_MIME_TYPES.has(file.type)) {
		return `「${fileLabel(file)}」不支持的图片格式（仅 PNG/JPEG/GIF/WebP）`;
	}
	if (file.size > MAX_IMAGE_BYTES) {
		return `「${fileLabel(file)}」超过 5MB 上限`;
	}
	return undefined;
}

/** 读成 base64 ImagePart（去 data: 前缀，shared/image.ts 的口径）。 */
function readAsImagePart(file: File): Promise<ImagePart> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const url = reader.result;
			if (typeof url !== "string" || !url.includes(",")) {
				reject(new TypeError("readAsDataURL 产出了意外的结果"));
				return;
			}
			resolve({ type: "image", data: url.slice(url.indexOf(",") + 1), mimeType: file.type });
		};
		reader.onerror = () => reject(reader.error ?? new Error("图片读取失败"));
		reader.readAsDataURL(file);
	});
}

export interface ImageAttachments {
	/** 当前待发送的图片（提交时随文本一起走）。 */
	readonly attachments: readonly ImagePart[];
	/** 拖拽悬停高亮（视图把它拼进输入卡容器 的 class）。 */
	readonly dragOver: boolean;
	/**
	 * textarea 的粘贴接线：剪贴板含图片项时拦截默认行为并入附件，
	 * 纯文本粘贴不拦截（返回 false 不 preventDefault）。
	 */
	readonly bind: {
		readonly onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
		readonly onDrop: (e: React.DragEvent<HTMLElement>) => void;
		readonly onDragOver: (e: React.DragEvent<HTMLElement>) => void;
		readonly onDragLeave: (e: React.DragEvent<HTMLElement>) => void;
	};
	/** 拖拽/粘贴入口：FileList 或 File[]（同步触发读取，拒绝项 toast 报原因）。 */
	readonly addFromFiles: (files: FileList | File[]) => Promise<void>;
	/** 系统文件选择框（+ 按钮）。取消静默返回。 */
	readonly pickFromDialog: () => Promise<void>;
	readonly removeAt: (index: number) => void;
	readonly clear: () => void;
}

export function useImageAttachments(onError: (message: string) => void): ImageAttachments {
	const [attachments, setAttachments] = useState<readonly ImagePart[]>([]);
	const [dragOver, setDragOver] = useState(false);

	const addFromFiles = useCallback(
		async (files: FileList | File[]): Promise<void> => {
			const accepted: ImagePart[] = [];
			const rejected: string[] = [];
			for (const file of Array.from(files)) {
				const reason = rejectReason(file);
				if (reason !== undefined) {
					rejected.push(reason);
					continue;
				}
				try {
					accepted.push(await readAsImagePart(file));
				} catch (error) {
					// 读取失败（拖入后源文件被移走等）与格式拒绝同口径：说清楚哪张、为什么。
					rejected.push(`「${fileLabel(file)}」读取失败（${error instanceof Error ? error.message : String(error)}）`);
				}
			}
			// 多张混入被拒项时合并成一条 toast（toast 是单槽，逐条弹会互相顶掉）。
			if (rejected.length > 0) onError(`未添加：${rejected.join("；")}`);
			if (accepted.length > 0) {
				setAttachments((current) => [...current, ...accepted]);
			}
		},
		[onError],
	);

	/** 剪贴板含图片项时入附件并返回 true（调用方据此 preventDefault）。 */
	const addFromClipboard = useCallback(
		(clipboardData: DataTransfer): boolean => {
			// 走 items 而非 files：截图工具常只把位图放在 items（kind=file）里。
			// getAsFile 必须在事件处理器同步段调完——DataTransfer 的寿命止于事件。
			const files: File[] = [];
			for (const item of Array.from(clipboardData.items)) {
				if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
				const file = item.getAsFile();
				if (file !== null) files.push(file);
			}
			if (files.length === 0) return false;
			void addFromFiles(files);
			return true;
		},
		[addFromFiles],
	);

	const pickFromDialog = useCallback(async (): Promise<void> => {
		try {
			const picked = await window.kami.pickImageFiles();
			if (picked === undefined || picked.length === 0) return;
			setAttachments((current) => [...current, ...picked]);
		} catch (error) {
			onError(error instanceof Error ? error.message : String(error));
		}
	}, [onError]);

	const removeAt = useCallback((index: number): void => {
		setAttachments((current) => current.filter((_, i) => i !== index));
	}, []);

	const clear = useCallback((): void => {
		setAttachments([]);
	}, []);

	/*
		拖放接线的三个坑（一次写对，两个视图共用）：
		1. onDragOver 必须 preventDefault，否则浏览器把 drop 当导航，
		   整个应用被文件页顶掉；
		2. 拖文本片段（files 为空）不拦——textarea 默认会插入文本，
		   拦掉就悄悄丢了用户的拖放；
		3. dragleave 会随「进入子元素」反复冒泡（leave 父边界 = enter 子边界），
		   只有 relatedTarget 真离开容器才熄高亮，否则随鼠标划过内部元素闪烁。
	*/
	const bind = {
		onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>): void => {
			if (addFromClipboard(e.clipboardData)) e.preventDefault();
		},
		onDrop: (e: React.DragEvent<HTMLElement>): void => {
			setDragOver(false);
			if (e.dataTransfer.files.length === 0) return;
			e.preventDefault();
			void addFromFiles(e.dataTransfer.files);
		},
		onDragOver: (e: React.DragEvent<HTMLElement>): void => {
			e.preventDefault();
			if (e.dataTransfer.types.includes("Files")) setDragOver(true);
		},
		onDragLeave: (e: React.DragEvent<HTMLElement>): void => {
			const to = e.relatedTarget;
			if (to instanceof Node && e.currentTarget.contains(to)) return;
			setDragOver(false);
		},
	};

	return {
		attachments,
		dragOver,
		bind,
		addFromFiles,
		pickFromDialog,
		removeAt,
		clear,
	};
}

/* ── 缩略图条 ─────────────────────────────────────────────────── */

/** 缩略图 data URL。base64 无前缀（shared 口径），渲染时补回 data:。 */
export function imageDataUrl(part: ImagePart): string {
	return `data:${part.mimeType};base64,${part.data}`;
}

/**
 * 附件缩略图条：输入卡内排在 textarea 上方。
 * key 用下标是安全的：列表项无本地状态，缩略图 src 是 data URL（同步解码），
 * 中途删除时复用元素换 src 不会闪空白。
 */
export function AttachmentStrip({
	attachments,
	onRemove,
}: {
	readonly attachments: readonly ImagePart[];
	readonly onRemove: (index: number) => void;
}): React.JSX.Element | null {
	if (attachments.length === 0) return null;
	return (
		<div className="attachment-strip">
			{attachments.map((part, index) => (
				<div className="attachment-thumb" key={index}>
					<img src={imageDataUrl(part)} alt="" draggable={false} />
					<button
						type="button"
						className="attachment-remove"
						aria-label="移除图片"
						title="移除图片"
						onClick={() => onRemove(index)}
					>
						×
					</button>
				</div>
			))}
		</div>
	);
}
