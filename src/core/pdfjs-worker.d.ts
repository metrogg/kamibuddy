/**
 * pdfjs 的 worker 模块没有随包提供类型声明（pdfjs-dist 只为 build/pdf.mjs 出了 d.mts）。
 *
 * 我们只用它一个用途：挂到 `globalThis.pdfjsWorker` 让 pdf.js 走主线程 worker
 * 装配（见 doc-extract.ts 的 ensurePdfWorker）。这里按「有 WorkerMessageHandler
 * 字段的对象」声明，够用且不假装知道它的完整形状。
 */
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
	const worker: { readonly WorkerMessageHandler: unknown };
	export default worker;
	export const WorkerMessageHandler: unknown;
}
