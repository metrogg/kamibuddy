/**
 * 输入区附件（chat-view 与 home-view 共用）：图片与文档两族。
 *
 * 三个入口汇到同一套分类：粘贴（剪贴板文件）、拖拽（文件）、工具栏 +
 * 按钮走系统文件选择框（window.kami.pickInputFiles）。
 *
 * 两族附件走两条路：
 * - 图片：读内容进缩略图条（粘贴/拖拽在 renderer 读，dialog 在 main 读，
 *   大小守门共用 shared/image.ts 的 MAX_IMAGE_BYTES；dialog 入口超限经
 *   invoke reject 落到 pickFromDialog 的 catch → onError toast）。
 * - 文档（pdf/docx/xlsx/pptx/odt/odp/ods）：不读内容，只取绝对路径进
 *   documentRefs，渲染为 chip 条（DocumentRefStrip）。textarea 里不放
 *   `@<path>` 文本——路径是给模型读的（read_document 按路径自取，有截断
 *   与续读；区外文件权限门会问，符合预期），chip 是给人看的；发送时才由
 *   foldDocumentRefsIntoText 把引用折回文本末尾。不预读的理由：预读会把
 *   整份大文档一次性挤进首条消息。
 *
 * 为什么抽成一份：粘贴/拖拽/选择三入口的过滤与报错口径必须一致，
 * 两个视图各写一份必然漂移（ime-guard 的教训，AGENTS.md §4 防重复）。
 */

import { useCallback, useState } from "react";
import { docBadgeOf, docKindOf } from "@shared/doc-formats.ts";
import { MAX_IMAGE_BYTES, type ImagePart } from "@shared/image.ts";
import type { DocumentReference } from "@shared/ipc.ts";
import { IconDoc, IconDocFile } from "./icons.tsx";

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

/** 分类结果：图片走内容读取，文档走路径引用，其余给拒因。 */
export type AttachmentClass =
	| { readonly kind: "image" }
	| { readonly kind: "document" }
	| { readonly kind: "reject"; readonly reason: string };

/**
 * 粘贴/拖入文件的分类。纯函数（不碰 window.kami），addFromFiles 与单测共用。
 *
 * 先看 MIME 再看扩展名：截图位图 name 为空但 MIME 是 image/*，必须进图片流，
 * 不会被误判成「无扩展名的不支持文件」。
 */
export function classifyAttachment(file: File): AttachmentClass {
	if (ACCEPTED_MIME_TYPES.has(file.type)) {
		if (file.size > MAX_IMAGE_BYTES) {
			return { kind: "reject", reason: `「${fileLabel(file)}」超过 5MB 上限` };
		}
		return { kind: "image" };
	}
	switch (docKindOf(file.name)) {
		case "pdf":
		case "office":
			return { kind: "document" };
		case "legacy":
			// 与 read_document 的老格式文案同口径（那边由 doc-extract 给出）。
			return { kind: "reject", reason: `「${fileLabel(file)}」请另存为 .docx/.xlsx/.pptx 后重试` };
		default:
			return {
				kind: "reject",
				reason: `「${fileLabel(file)}」不支持的文件格式（支持图片 PNG/JPEG/GIF/WebP 与文档 PDF/DOCX/XLSX/PPTX/ODF）`,
			};
	}
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

/**
 * 发送时把文档引用折回文本：refs 非空则在用户文本后追加换行分隔的
 * `@<path>` 行（read_document 按路径自取的约定不变）；text 为空时不出
 * 前导换行。折叠只发生在提交这一刻——输入过程中 textarea 始终保持
 * 「人写的文本」，路径不混入（见文件头注释）。
 */
export function foldDocumentRefsIntoText(text: string, refs: readonly DocumentReference[]): string {
	if (refs.length === 0) return text;
	const lines = refs.map((r) => `@${r.path}`).join("\n");
	return text === "" ? lines : `${text}\n${lines}`;
}

export interface ImageAttachments {
	/** 当前待发送的图片（提交时随文本一起走）。 */
	readonly attachments: readonly ImagePart[];
	/**
	 * 当前待发送的文档引用（chip 条）。提交时经 foldDocumentRefsIntoText
	 * 折进文本，不随 images 走——它只是路径，不是内容。
	 */
	readonly documentRefs: readonly DocumentReference[];
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
	readonly removeDocumentRefAt: (index: number) => void;
	readonly clear: () => void;
}

export function useImageAttachments(onError: (message: string) => void): ImageAttachments {
	const [attachments, setAttachments] = useState<readonly ImagePart[]>([]);
	// 已知限制：documentRefs 与图片附件同为组件态，视图切换/刷新即弃
	// （chat-view 按 sessionId 落盘的草稿只保文本）。旧实现把 @路径 插进
	// textarea 能随草稿还原，chip 化后与图片附件拉齐；要把 refs 也按
	// sessionId 存（input-history）需改动共享 hook 的接口，等有实际诉求再做。
	const [documentRefs, setDocumentRefs] = useState<readonly DocumentReference[]>([]);
	const [dragOver, setDragOver] = useState(false);

	// 同 path 去重：同一份文件加两次没有意义（模型读两遍同一路径），
	// chip 条上也不该出现两个一样的条目。
	const addDocumentRefs = useCallback((docs: readonly DocumentReference[]): void => {
		if (docs.length === 0) return;
		setDocumentRefs((current) => {
			const next = [...current];
			for (const doc of docs) {
				if (!next.some((r) => r.path === doc.path)) next.push(doc);
			}
			return next;
		});
	}, []);

	const addFromFiles = useCallback(
		async (files: FileList | File[]): Promise<void> => {
			const accepted: ImagePart[] = [];
			const docs: DocumentReference[] = [];
			const rejected: string[] = [];
			for (const file of Array.from(files)) {
				const cls = classifyAttachment(file);
				if (cls.kind === "reject") {
					rejected.push(cls.reason);
					continue;
				}
				if (cls.kind === "document") {
					// 路径只能在 preload 侧取（Electron ≥32 起 renderer 的 File 无 .path）。
					const path = window.kami.getFilePath(file);
					if (path === "") {
						// 无磁盘来源的 File（罕见，如某些拖放源）拿不到路径，响亮报错。
						rejected.push(`「${fileLabel(file)}」无法取得文件路径，请改用 + 按钮选择`);
						continue;
					}
					docs.push({ path, name: file.name });
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
			addDocumentRefs(docs);
		},
		[onError, addDocumentRefs],
	);

	/** 剪贴板含文件（图片或文档）时处理并返回 true（调用方据此 preventDefault）。 */
	const addFromClipboard = useCallback(
		(clipboardData: DataTransfer): boolean => {
			// files 与 items(kind=file) 在 Chromium 里同源（截图位图也在这里，
			// name 为空、MIME 是 image/*，分类自然进图片流）。
			// File 引用必须在事件处理器同步段取完——DataTransfer 的寿命止于事件。
			const files = Array.from(clipboardData.files);
			if (files.length === 0) return false; // 纯文本粘贴不拦截
			// 全是不支持的文件也拦截：拒因 toast 由 addFromFiles 给出，
			// 放行走默认行为则用户什么都看不到。
			void addFromFiles(files);
			return true;
		},
		[addFromFiles],
	);

	const pickFromDialog = useCallback(async (): Promise<void> => {
		try {
			const picked = await window.kami.pickInputFiles();
			if (picked === undefined) return;
			if (picked.images.length > 0) {
				setAttachments((current) => [...current, ...picked.images]);
			}
			addDocumentRefs(picked.documents);
		} catch (error) {
			onError(error instanceof Error ? error.message : String(error));
		}
	}, [onError, addDocumentRefs]);

	const removeAt = useCallback((index: number): void => {
		setAttachments((current) => current.filter((_, i) => i !== index));
	}, []);

	const removeDocumentRefAt = useCallback((index: number): void => {
		setDocumentRefs((current) => current.filter((_, i) => i !== index));
	}, []);

	// 提交成功后两视图都会调 clear：两族附件一起清，不留半拉状态。
	const clear = useCallback((): void => {
		setAttachments([]);
		setDocumentRefs([]);
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
		documentRefs,
		dragOver,
		bind,
		addFromFiles,
		pickFromDialog,
		removeAt,
		removeDocumentRefAt,
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

/* ── 文档引用 chip 条 ─────────────────────────────────────────────── */

/**
 * 文档引用 chip 条：与缩略图条同区域（textarea 上方），每个文档一个 chip——
 * 格式图标（按族分色）+ 文件名 + ×。key 用 path：入列时已按 path 去重，
 * 天然唯一且稳定（chip 无本地状态，与缩略图条同口径）。
 * chip 只显示文件名，完整路径放 title——路径是机器读的，不必占视觉。
 */
export function DocumentRefStrip({
	refs,
	onRemove,
}: {
	readonly refs: readonly DocumentReference[];
	readonly onRemove: (index: number) => void;
}): React.JSX.Element | null {
	if (refs.length === 0) return null;
	return (
		<div className="document-ref-strip">
			{refs.map((ref, index) => {
				const badge = docBadgeOf(ref.path);
				return (
					<div className="document-ref-chip" key={ref.path} title={ref.path}>
						{/* 到不了 undefined（入口已按 docKindOf 收过一轮），落回通用文档图标。 */}
						{badge !== undefined ? <IconDocFile badge={badge} size={18} /> : <IconDoc size={18} />}
						<span className="document-ref-name">{ref.name}</span>
						<button
							type="button"
							className="document-ref-remove"
							aria-label={`移除文档 ${ref.name}`}
							title="移除文档"
							onClick={() => onRemove(index)}
						>
							×
						</button>
					</div>
				);
			})}
		</div>
	);
}
