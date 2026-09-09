/**
 * 图片附件类型。独立成文件而非放进 ipc.ts：ipc.ts 已 import
 * session-events.ts（SessionEvent/SessionSnapshot），而 UserMessage 也要
 * 引用图片类型——定义在任一侧都会形成 ipc ↔ session-events 的 import 环。
 * 零依赖叶子，两处都能安全引用。
 */

/**
 * 与 pi 的 ImageContent（packages/ai types.ts）结构对齐的图片附件。
 * shared 层不许 import pi 类型（AGENTS.md §一），所以这里平行定义——
 * 两者字段必须保持同步，pi 升级时要核对。
 */
export interface ImagePart {
	readonly type: "image";
	/** base64 编码，不含 data: 前缀。 */
	readonly data: string;
	/** 如 image/png。 */
	readonly mimeType: string;
}

/**
 * 单张图片体积上限（字节）。放 shared 而非 renderer：粘贴/拖拽入口的
 * File 在 renderer 校验，dialog 入口的文件字节只在 main 可见，两处
 * 必须用同一道门，各写一份魔法数字必然漂移（AGENTS.md §4 防重复）。
 */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
