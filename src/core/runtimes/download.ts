/**
 * 托管运行时的**下载层**（2026-09-18 设计变更：运行时改为**纯按需联网下载**）。
 *
 * ── 为什么改成按需（用户决定，见 resources/runtimes/README.md §6）──
 *   随包载荷实测 ≈484 MB（node 94.9 MB + gitbash 389.1 MB 解包后），而这两个运行时
 *   多数用户压根不用；安装包不能臃肿。于是默认**不下载、不安装**：用户在
 *   「设置 → 内置运行时」点「安装」才走到本文件。
 *   **任何形式的静默自动下载/自动安装都不允许** —— 门在 registry.ts 的 `ensureRuntime`
 *   （它已退化成只探不装），不在本层：本层只会被显式安装动作调用。
 *
 * ── 校验不过**不许进位**（本层存在的意义）──
 *   sha256 钉在代码里（定稿见 docs/运行时来源与许可.md），镜像与重定向只是**传输通道**，
 *   不是信任源：字节对不上就丢掉暂存并响亮报错，绝不把可疑产物交给解包与进位。
 *   半个包 / 错版本的包一旦解包进位，用户看到的是「装好了、一跑就崩」——比装不上更难归因。
 *
 * ── 为什么用 node:http(s) 而不是 fetch ──
 *   构建期实测 undici 的 fetch 对 nodejs.org **长时间挂住**（不是报错、是没响应，
 *   见 scripts/fetch-node.mjs 的注释），当时靠回落 curl 绕开；运行期不能假设用户机器上
 *   有 curl，所以这里用 stdlib 的 http/https + 手动跟随重定向（GitHub release 的 asset
 *   会 302 到 release-assets.githubusercontent.com），超时与取消都握在自己手里。
 *
 * ── 中断可续、失败可重试、可取消 ──
 *   字节先写 `<发行物>.part`，**校验通过后**才改名为发行物。中断（进程被杀 / 取消 /
 *   网络断）留下的 `.part` 就是下次的续传点：带 Range 请求，服务端回 206 就接着写、
 *   回 200 就从头写。于是「续传点可不可信」这个问题不需要回答 —— 最终 sha256 才是
 *   唯一通过判据：续传结果对不上就丢掉重下一次（重试照样校验，不是「重试即放行」，
 *   见 downloadArtifact 的第二次尝试），仍对不上才响亮失败。
 */

import { createHash, type Hash } from "node:crypto";
import {
	createReadStream,
	createWriteStream,
	existsSync,
	mkdirSync,
	renameSync,
	rmSync,
	statSync,
	type WriteStream,
} from "node:fs";
import { get as httpGet, type IncomingMessage } from "node:http";
import { get as httpsGet } from "node:https";
import { dirname } from "node:path";

/** 续传文件后缀（诊断与测试都直接读它）。 */
export const PART_SUFFIX = ".part";

/** 发行物的续传/暂存路径：`<发行物>.part`。 */
export function partFileFor(file: string): string {
	return `${file}${PART_SUFFIX}`;
}

/**
 * 错误分类。`sha256` 与 `size` 是**校验类**失败（调用方据此判断「不许进位」），
 * `http` / `io` 是传输类失败（可重试），`extract` / `incomplete` 是解包类失败。
 */
export type DownloadErrorKind = "http" | "io" | "size" | "sha256" | "extract" | "incomplete";

export class DownloadError extends Error {
	constructor(
		readonly kind: DownloadErrorKind,
		message: string,
	) {
		super(message);
		this.name = "DownloadError";
	}
}

/** 用户主动取消。单独一个类：取消**不是**失败，不许被当成「环境坏了」上报。 */
export class DownloadCancelledError extends Error {
	constructor(readonly url: string) {
		super(`已取消下载：${url}`);
		this.name = "DownloadCancelledError";
	}
}

export interface HttpRequest {
	readonly url: string;
	/**
	 * 续传起点（字节）。服务端不支持 Range 时会回 200（而不是 206），
	 * 调用方必须**从头重写**（见 downloadArtifact）。
	 */
	readonly rangeStart: number;
	readonly signal?: AbortSignal;
}

export interface HttpResponse {
	/** 只接受 200 / 206（其余在 openHttp 里就响亮报错）。 */
	readonly status: number;
	/** 响应体长度（206 时是**剩余**长度）。取不到时缺省。 */
	readonly contentLength?: number;
	readonly body: AsyncIterable<Uint8Array>;
}

/** HTTP 打开器（单测注入点：假实现直接吐字节，**不联网**）。 */
export type HttpOpener = (request: HttpRequest) => Promise<HttpResponse>;

const MAX_REDIRECTS = 5;
const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);

function contentLengthOf(header: string | readonly string[] | undefined): number | undefined {
	const value = Array.isArray(header) ? header[0] : header;
	if (typeof value !== "string") return undefined;
	const parsed = Number.parseInt(value, 10);
	return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

/** 单跳请求（不跟随重定向）。 */
function requestOnce(url: string, rangeStart: number, signal: AbortSignal | undefined): Promise<IncomingMessage> {
	return new Promise((resolve, reject) => {
		const send = new URL(url).protocol === "http:" ? httpGet : httpsGet;
		const headers: Record<string, string> = { "user-agent": "KamiBuddy-runtime-installer" };
		if (rangeStart > 0) headers["range"] = `bytes=${rangeStart}-`;
		const request = send(url, { headers }, (response) => resolve(response));
		request.on("error", reject);
		if (signal === undefined) return;
		if (signal.aborted) {
			request.destroy(new DownloadCancelledError(url));
			return;
		}
		signal.addEventListener("abort", () => request.destroy(new DownloadCancelledError(url)), { once: true });
	});
}

/** 生产 HTTP 打开器：stdlib + 手动跟随重定向。 */
export async function openHttp(request: HttpRequest, redirectsLeft = MAX_REDIRECTS): Promise<HttpResponse> {
	const response = await requestOnce(request.url, request.rangeStart, request.signal);
	const status = response.statusCode ?? 0;
	const location = response.headers.location;
	if (REDIRECT_STATUS.has(status) && location !== undefined) {
		// 重定向响应体必须排空，否则 socket 不释放（长跑会攒住句柄）。
		response.resume();
		if (redirectsLeft <= 0) throw new DownloadError("http", `重定向次数过多：${request.url}`);
		return openHttp({ ...request, url: new URL(location, request.url).toString() }, redirectsLeft - 1);
	}
	if (status !== 200 && status !== 206) {
		response.resume();
		throw new DownloadError("http", `${request.url} 返回 HTTP ${status}（期望 200/206）`);
	}
	const contentLength = contentLengthOf(response.headers["content-length"]);
	const body: AsyncIterable<Uint8Array> = response;
	return { status, ...(contentLength === undefined ? {} : { contentLength }), body };
}

export interface DownloadProgress {
	/** 已落盘字节（含续传下来的部分）。 */
	readonly receivedBytes: number;
	/** 发行物总字节；服务端没给 content-length 时缺省。 */
	readonly totalBytes?: number;
}

export interface DownloadRequest {
	readonly url: string;
	/** 最终落点。完成后这个文件就是**已校验**的成品（缓存里的发行物）。 */
	readonly targetFile: string;
	/** 钉死的 SHA256（小写十六进制）。唯一信任源。 */
	readonly sha256: string;
	/** 体积下限：挡「下到错误页/半截包」这类成功响应（不是信任源，sha256 才是）。 */
	readonly minBytes: number;
	readonly opener?: HttpOpener;
	readonly signal?: AbortSignal;
	readonly onProgress?: (progress: DownloadProgress) => void;
}

export interface DownloadResult {
	readonly path: string;
	readonly bytes: number;
	readonly sha256: string;
	/** 本次没有重新下载的字节数（缓存命中 = 全部；续传 = 已有部分）。 */
	readonly reusedBytes: number;
}

/** 把整个文件喂进哈希（续传时已有字节也要进 —— sha256 覆盖整个发行物）。 */
async function feedFile(hash: Hash, file: string): Promise<number> {
	const source: AsyncIterable<Uint8Array> = createReadStream(file);
	let bytes = 0;
	for await (const chunk of source) {
		hash.update(chunk);
		bytes += chunk.length;
	}
	return bytes;
}

function writeChunk(stream: WriteStream, chunk: Uint8Array): Promise<void> {
	return new Promise((resolve, reject) => {
		stream.write(chunk, (error) => (error === null || error === undefined ? resolve() : reject(error)));
	});
}

function closeStream(stream: WriteStream): Promise<void> {
	return new Promise((resolve, reject) => {
		stream.on("close", () => resolve());
		stream.on("error", reject);
		stream.end();
	});
}

/**
 * 下载一个发行物并**校验后**落到 `targetFile`。
 *
 * 幂等：`targetFile` 已在且 sha256 对得上 → 直接返回（重装同一版本不会重下）。
 * 缓存对不上（被换过 / 上次写坏）→ 删掉重下，绝不拿去解包。
 */
export async function downloadArtifact(request: DownloadRequest): Promise<DownloadResult> {
	const expected = request.sha256.toLowerCase();
	const opener = request.opener ?? openHttp;
	mkdirSync(dirname(request.targetFile), { recursive: true });

	if (existsSync(request.targetFile)) {
		const cached = await hashFile(request.targetFile);
		if (cached.sha256 === expected) {
			return { path: request.targetFile, bytes: cached.bytes, sha256: cached.sha256, reusedBytes: cached.bytes };
		}
		rmSync(request.targetFile, { force: true });
	}

	const part = partFileFor(request.targetFile);
	const resumableBytes = existsSync(part) ? statSync(part).size : 0;

	const runOnce = async (resume: boolean): Promise<DownloadResult> => {
		const start = resume ? resumableBytes : 0;
		const response = await opener({
			url: request.url,
			rangeStart: start,
			...(request.signal === undefined ? {} : { signal: request.signal }),
		});
		// 206 = 服务端接受了续传；200 = 它忽略了 Range，只能从头写（否则拼出半个坏包）。
		const append = start > 0 && response.status === 206;
		if (start > 0 && !append) rmSync(part, { force: true });
		const base = append ? start : 0;
		const hash = createHash("sha256");
		// 续传时已有字节也要进哈希：sha256 覆盖的是**整个发行物**，不是本次新增的字节。
		if (base > 0 && (await feedFile(hash, part)) !== base) {
			rmSync(part, { force: true });
			throw new DownloadError("io", `续传点读出的字节数与文件大小不符：${part}（已丢弃，请重试）`);
		}
		const totalBytes =
			response.contentLength === undefined ? undefined : base + response.contentLength;
		const stream = createWriteStream(part, { flags: append ? "a" : "w" });
		let written = base;
		request.onProgress?.({ receivedBytes: written, ...(totalBytes === undefined ? {} : { totalBytes }) });
		try {
			for await (const chunk of response.body) {
				hash.update(chunk);
				await writeChunk(stream, chunk);
				written += chunk.length;
				request.onProgress?.({
					receivedBytes: written,
					...(totalBytes === undefined ? {} : { totalBytes }),
				});
			}
			await closeStream(stream);
		} catch (error) {
			stream.destroy();
			// 取消/中断：`.part` 留在盘上就是下次的续传点，这里不清。
			if (request.signal?.aborted === true) throw new DownloadCancelledError(request.url);
			if (error instanceof DownloadError || error instanceof DownloadCancelledError) throw error;
			throw new DownloadError(
				"io",
				`下载中断（${error instanceof Error ? error.message : String(error)}）：${request.url}。` +
					"已保留续传点，重试即可接着下。",
			);
		}
		if (written < request.minBytes) {
			rmSync(part, { force: true });
			throw new DownloadError(
				"size",
				`${request.url} 只下到 ${written} 字节（下限 ${request.minBytes}）—— 不像目标发行物（可能是错误页或半截包），已丢弃。`,
			);
		}
		const actual = hash.digest("hex").toLowerCase();
		if (actual !== expected) {
			rmSync(part, { force: true });
			throw new DownloadError(
				"sha256",
				`${request.url} 的 SHA256 不符（期望 ${expected}，实际 ${actual}）—— 产物已丢弃，**未**解包、**未**进位。`,
			);
		}
		renameSync(part, request.targetFile);
		return { path: request.targetFile, bytes: written, sha256: actual, reusedBytes: base };
	};

	try {
		return await runOnce(true);
	} catch (error) {
		if (error instanceof DownloadError && error.kind === "sha256" && resumableBytes > 0) {
			// 续传点可能来自另一次中断或另一个镜像：丢掉重下一次。第二次照样全量校验 ——
			// 重试只是「重新取一份」，不是「跳过校验」。
			rmSync(part, { force: true });
			return await runOnce(false);
		}
		throw error;
	}
}

/** 读一个文件并返回 sha256 与字节数（缓存命中的幂等判据）。 */
export async function hashFile(file: string): Promise<{ sha256: string; bytes: number }> {
	const hash = createHash("sha256");
	const bytes = await feedFile(hash, file);
	return { sha256: hash.digest("hex").toLowerCase(), bytes };
}

/** 单文件 sha256（解包后对可执行本体再断言一次时用）。 */
export async function sha256File(file: string): Promise<string> {
	return (await hashFile(file)).sha256;
}

/**
 * 取一段小文本（官方校验文件 `SHASUMS256.txt` 这类）。
 * 上限默认 1 MiB：校验文件是几 KB 量级，超了说明取到的不是它 —— 响亮失败比截断好。
 * 状态码在这里也判一次（**不能只靠 openHttp**：测试注入的打开器绕过它，
 * 而「把 404 页面当校验文件解析」会静默变成「取到了、但没有那一条」）。
 */
export async function fetchText(
	url: string,
	options: { readonly opener?: HttpOpener; readonly signal?: AbortSignal; readonly maxBytes?: number } = {},
): Promise<string> {
	const opener = options.opener ?? openHttp;
	const maxBytes = options.maxBytes ?? 1024 * 1024;
	const response = await opener({
		url,
		rangeStart: 0,
		...(options.signal === undefined ? {} : { signal: options.signal }),
	});
	if (response.status !== 200 && response.status !== 206) {
		throw new DownloadError("http", `${url} 返回 HTTP ${response.status}（期望 200/206）`);
	}
	const decoder = new TextDecoder();
	let text = "";
	for await (const chunk of response.body) {
		text += decoder.decode(chunk, { stream: true });
		if (text.length > maxBytes) throw new DownloadError("size", `${url} 的内容超过 ${maxBytes} 字节，不像校验文件`);
	}
	return text + decoder.decode();
}

/** 供上层构造错误文案时用（把字节数说成用户看得懂的 MB）。 */
export function formatBytes(bytes: number): string {
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
