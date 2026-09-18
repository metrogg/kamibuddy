/**
 * 下载层（`download.ts`）的单测：**不联网**，HTTP 打开器是注入的假件。
 *
 * 这里钉住四条性质（都是「校验不过不许进位」的组成部分，改动它们等于改动安全边界）：
 *   1. **校验不过就丢掉**：sha256 / 体积不符 ⇒ 目标文件不出现、`.part` 被删；
 *   2. **取消 ≠ 失败**：抛 `DownloadCancelledError`，且 `.part` **保留**（那是续传点）；
 *   3. **中断可续**：`.part` 在 + 服务端接受 Range ⇒ 只下剩下的；服务端忽略 Range ⇒ 从头写；
 *   4. **续传点不被信任**：续出来的结果 sha 不符 ⇒ 丢掉重下一次，第二次照样全量校验。
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
	DownloadCancelledError,
	DownloadError,
	downloadArtifact,
	fetchText,
	partFileFor,
	type HttpOpener,
	type HttpRequest,
	type HttpResponse,
} from "./download.ts";

const TMP = mkdtempSync(join(tmpdir(), "kami-download-"));
afterAll(() => {
	rmSync(TMP, { recursive: true, force: true });
});

let seq = 0;
function workDir(name: string): string {
	seq += 1;
	const dir = join(TMP, `${name}-${seq}`);
	mkdirSync(dir, { recursive: true });
	return dir;
}

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/** 造一段可复现的字节（内容无所谓，我们用它的 sha256 当期望值）。 */
function bytesOf(size: number): Buffer {
	const buffer = Buffer.alloc(size);
	for (let index = 0; index < size; index += 1) buffer[index] = (index * 31 + 7) % 256;
	return buffer;
}

async function* chunksOf(body: Uint8Array, from: number, chunkSize: number): AsyncIterable<Uint8Array> {
	for (let offset = from; offset < body.length; offset += chunkSize) {
		yield body.subarray(offset, Math.min(offset + chunkSize, body.length));
	}
}

interface FakeOptions {
	readonly chunkSize?: number;
	/** 是否支持 Range（不支持时回 200，调用方必须从头写）。 */
	readonly range?: boolean;
	/** 每吐完一块回调一次（取消测试据此在中途 abort）。 */
	readonly onChunk?: (index: number) => void;
	/** 每次打开请求时回调（断言「有没有真的发请求」与「带没带 Range」）。 */
	readonly onRequest?: (request: HttpRequest) => void;
	/** 吐到第 n 块后直接抛错（模拟网络断）。 */
	readonly failAfterChunk?: number;
}

/** 假 HTTP 打开器：把一段字节按块吐出来（支持 Range / 忽略 Range / 中途报错）。 */
function fakeOpener(body: Uint8Array, options: FakeOptions = {}): HttpOpener {
	const chunkSize = options.chunkSize ?? 8;
	return async (request: HttpRequest): Promise<HttpResponse> => {
		options.onRequest?.(request);
		const acceptRange = options.range !== false;
		const from = acceptRange ? request.rangeStart : 0;
		const status = acceptRange && request.rangeStart > 0 ? 206 : 200;
		const self = {
			async *[Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
				let index = 0;
				for await (const chunk of chunksOf(body, from, chunkSize)) {
					// 取消要能真的打断：假件也按 signal 停（真实现里是 abort 掉 HTTP 请求）。
					if (request.signal?.aborted === true) throw new Error("模拟的请求被取消");
					options.onChunk?.(index);
					if (options.failAfterChunk !== undefined && index === options.failAfterChunk) {
						throw new Error("模拟的连接中断");
					}
					index += 1;
					yield chunk;
				}
			},
		};
		return {
			status,
			contentLength: body.length - from,
			body: self,
		};
	};
}

describe("下载 + 校验", () => {
	it("字节正确：写出目标文件、无 .part 残留、进度单调", async () => {
		const dir = workDir("ok");
		const body = bytesOf(64);
		const target = join(dir, "artifact.bin");
		const percents: number[] = [];
		const result = await downloadArtifact({
			url: "https://example.test/artifact.bin",
			targetFile: target,
			sha256: sha256(body),
			minBytes: 8,
			opener: fakeOpener(body),
			onProgress: ({ receivedBytes, totalBytes }) => {
				if (totalBytes !== undefined) percents.push(receivedBytes / totalBytes);
			},
		});

		expect(result.bytes).toBe(64);
		expect(result.reusedBytes).toBe(0);
		expect(readFileSync(target)).toEqual(body);
		expect(existsSync(partFileFor(target))).toBe(false);
		// 进度到过 100%，且不倒退（界面据此画进度条）。
		expect(percents[percents.length - 1]).toBe(1);
		expect([...percents].sort((left, right) => left - right)).toEqual(percents);
	});

	it("缓存命中：已下好且 sha 对得上就不再发请求（幂等，重装不重下）", async () => {
		const dir = workDir("cache");
		const body = bytesOf(32);
		const target = join(dir, "artifact.bin");
		writeFileSync(target, body);
		const opener: HttpOpener = () => Promise.reject(new Error("不该发请求"));

		const result = await downloadArtifact({
			url: "https://example.test/artifact.bin",
			targetFile: target,
			sha256: sha256(body),
			minBytes: 8,
			opener,
		});
		expect(result.reusedBytes).toBe(32);
		expect(result.bytes).toBe(32);
	});

	it("**校验失败不许进位**：sha256 不符 ⇒ 抛错、目标文件不出现、.part 被删", async () => {
		const dir = workDir("sha-mismatch");
		const body = bytesOf(64);
		const target = join(dir, "artifact.bin");

		const failure = await downloadArtifact({
			url: "https://example.test/artifact.bin",
			targetFile: target,
			sha256: sha256(bytesOf(65)), // 故意给错
			minBytes: 8,
			opener: fakeOpener(body),
		}).catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(DownloadError);
		if (!(failure instanceof DownloadError)) throw new Error("unreachable");
		expect(failure.kind).toBe("sha256");
		expect(failure.message).toContain("未**解包");
		expect(existsSync(target)).toBe(false);
		expect(existsSync(partFileFor(target))).toBe(false);
	});

	it("体积下限：只下到一小半 ⇒ 抛 size 错并丢掉（不是「短包当成功」）", async () => {
		const dir = workDir("too-small");
		const body = bytesOf(32);
		const target = join(dir, "artifact.bin");

		const failure = await downloadArtifact({
			url: "https://example.test/artifact.bin",
			targetFile: target,
			sha256: sha256(body),
			minBytes: 4096,
			opener: fakeOpener(body),
		}).catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(DownloadError);
		if (!(failure instanceof DownloadError)) throw new Error("unreachable");
		expect(failure.kind).toBe("size");
		expect(existsSync(target)).toBe(false);
		expect(existsSync(partFileFor(target))).toBe(false);
	});
});

describe("取消与续传", () => {
	it("取消：抛 DownloadCancelledError（不是失败），且 .part 留作续传点", async () => {
		const dir = workDir("cancel");
		const body = bytesOf(64);
		const target = join(dir, "artifact.bin");
		const controller = new AbortController();

		const failure = await downloadArtifact({
			url: "https://example.test/artifact.bin",
			targetFile: target,
			sha256: sha256(body),
			minBytes: 8,
			signal: controller.signal,
			opener: fakeOpener(body, { chunkSize: 8, onChunk: (index) => (index === 1 ? controller.abort() : undefined) }),
		}).catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(DownloadCancelledError);
		expect(existsSync(target)).toBe(false);
		// 续传点：已收到的那些字节留着（下一次从这里接着下）。
		expect(existsSync(partFileFor(target))).toBe(true);
		expect(statSync(partFileFor(target)).size).toBeGreaterThan(0);
	});

	it("中断可续：已有 .part ⇒ 带 Range 只下剩下的，且旧字节进 sha256", async () => {
		const dir = workDir("resume");
		const body = bytesOf(64);
		const target = join(dir, "artifact.bin");
		const already = 24;
		writeFileSync(partFileFor(target), body.subarray(0, already));

		const requests: HttpRequest[] = [];
		const result = await downloadArtifact({
			url: "https://example.test/artifact.bin",
			targetFile: target,
			sha256: sha256(body),
			minBytes: 8,
			opener: fakeOpener(body, { onRequest: (request) => requests.push(request) }),
		});

		expect(requests[0]?.rangeStart).toBe(already);
		expect(result.reusedBytes).toBe(already);
		expect(result.bytes).toBe(64);
		expect(readFileSync(target)).toEqual(body);
	});

	it("服务端忽略 Range（回 200）⇒ 从头写，不拼出半个坏包", async () => {
		const dir = workDir("no-range");
		const body = bytesOf(64);
		const target = join(dir, "artifact.bin");
		writeFileSync(partFileFor(target), bytesOf(20)); // 与正文不同源：必须被丢掉

		const result = await downloadArtifact({
			url: "https://example.test/artifact.bin",
			targetFile: target,
			sha256: sha256(body),
			minBytes: 8,
			opener: fakeOpener(body, { range: false }),
		});

		expect(result.reusedBytes).toBe(0);
		expect(readFileSync(target)).toEqual(body);
	});

	it("续传结果 sha 不符 ⇒ 丢掉重下一次（重试只是重取，不放行校验）", async () => {
		const dir = workDir("resume-bad");
		const body = bytesOf(64);
		const target = join(dir, "artifact.bin");
		// 续传点来自别的来源：同样的长度、不同的字节 —— 续出来的整包 sha 必然不符。
		writeFileSync(partFileFor(target), Buffer.alloc(20, 9));

		const requests: HttpRequest[] = [];
		const result = await downloadArtifact({
			url: "https://example.test/artifact.bin",
			targetFile: target,
			sha256: sha256(body),
			minBytes: 8,
			opener: fakeOpener(body, { onRequest: (request) => requests.push(request) }),
		});

		// 第一次带 Range（续传）→ 校验不过 → 第二次从 0 开始。
		expect(requests.map((request) => request.rangeStart)).toEqual([20, 0]);
		expect(result.reusedBytes).toBe(0);
		expect(readFileSync(target)).toEqual(body);
	});

	it("网络中途断掉：.part 保留（下次接着下），错误文案说明可重试", async () => {
		const dir = workDir("io-error");
		const body = bytesOf(64);
		const target = join(dir, "artifact.bin");

		const failure = await downloadArtifact({
			url: "https://example.test/artifact.bin",
			targetFile: target,
			sha256: sha256(body),
			minBytes: 8,
			opener: fakeOpener(body, { failAfterChunk: 1 }),
		}).catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(DownloadError);
		if (!(failure instanceof DownloadError)) throw new Error("unreachable");
		expect(failure.kind).toBe("io");
		expect(failure.message).toContain("续传点");
		expect(existsSync(partFileFor(target))).toBe(true);
	});
});

describe("小文本取件（官方校验文件）", () => {
	it("正常取回文本", async () => {
		const text = "abc  file.txt\n";
		await expect(
			fetchText("https://example.test/SHASUMS256.txt", {
				opener: fakeOpener(Buffer.from(text, "utf8"), { chunkSize: 4 }),
			}),
		).resolves.toBe(text);
	});

	it("超过上限 ⇒ 响亮失败（不像校验文件）", async () => {
		const failure = await fetchText("https://example.test/big.txt", {
			opener: fakeOpener(bytesOf(4096)),
			maxBytes: 128,
		}).catch((error: unknown) => error);
		expect(failure).toBeInstanceOf(DownloadError);
		if (!(failure instanceof DownloadError)) throw new Error("unreachable");
		expect(failure.kind).toBe("size");
	});

	it("HTTP 非 200/206 ⇒ 响亮失败（不把错误页当正文）", async () => {
		const opener: HttpOpener = () =>
			Promise.resolve({ status: 404, body: chunksOf(bytesOf(8), 0, 8) });
		const failure = await fetchText("https://example.test/missing", { opener }).catch(
			(error: unknown) => error,
		);
		expect(failure).toBeInstanceOf(DownloadError);
		if (!(failure instanceof DownloadError)) throw new Error("unreachable");
		expect(failure.kind).toBe("http");
	});
});
