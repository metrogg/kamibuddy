/**
 * node 运行时的装配链路测试（2026-09-18：取件从「随包载荷复制」改成**按需联网下载**）。
 *
 * 走**生产的组装入口**：`ensureRuntime` / `installRuntime` / `resetRuntime` /
 * `inspectRuntime` / `collectRuntimeDiagnostics`（即转换前探测与设置页「安装/诊断/重置」
 * 用的同一批入口）配 `createNodeRuntime`；托管根与 resources 根都落在临时目录，
 * **HTTP 打开器是注入的假件（不联网）**，spawn 是形态匹配的假件。
 *
 * 本文件钉五条不可退让的性质：
 *   1. **未安装时 ensure 不下载、不安装**（零 spawn、零 HTTP、缓存目录都不出现）——
 *      这是「纯按需、没有静默自动下载」这条用户决定的门；
 *   2. **校验不过不进位**（sha256 / 体积不符 ⇒ 暂存清掉、无 manifest、无 current）；
 *   3. **取消不留半成品**（暂存清掉，但 `.part` 保留作续传点）；
 *   4. **解包后的 node.exe 再验一次 sha256**（第三道门）与 zip 顶层目录剥离；
 *   5. **合规义务被机械钉住**（许可文本在必备文件里，缺了不许进位）。
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import JSZip from "jszip";
import type { SpawnFn, SpawnOutcome, SpawnRequest } from "../../documents/docx-env.ts";
import {
	downloadCacheDir,
	instanceDir,
	listStaging,
	promoteStaging,
	readCurrent,
	readManifest,
	stagingDir,
	writeCurrent,
	writeManifest,
} from "../runtime-store.ts";
import {
	ensureRuntime,
	installRuntime,
	inspectRuntime,
	resetRuntime,
	ACQUIRE_PHASE,
	CANCELLED_PHASE,
	NOT_INSTALLED_PHASE,
	type RuntimeEnsureOutcome,
} from "./registry.ts";
import { partFileFor, type HttpOpener, type HttpResponse } from "./download.ts";
import { collectRuntimeDiagnostics } from "./diagnostics.ts";
import { defaultPythonRuntimeOptions } from "./python.ts";
import {
	createNodeRuntime,
	extractNodeZip,
	nodeArtifactUrls,
	parseNodeVersion,
	NODE_ARTIFACT,
	NODE_ARTIFACT_SHA256,
	NODE_REQUIRED_FILES,
	NODE_RUNTIME_ID,
	NODE_RUNTIME_VERSION,
} from "./node.ts";

const TMP = mkdtempSync(join(tmpdir(), "kami-node-runtime-"));
afterAll(() => {
	rmSync(TMP, { recursive: true, force: true });
});

let seq = 0;
/** 每个用例一套独立的资源根 + 托管根 + 家目录（不靠执行顺序、不互相污染）。 */
function optionsFor(name: string) {
	seq += 1;
	const base = join(TMP, `${name}-${seq}`);
	const resources = join(base, "resources");
	mkdirSync(join(base, "home"), { recursive: true });
	return defaultPythonRuntimeOptions({
		root: join(base, "config", "runtimes"),
		homeDir: join(base, "home"),
		platform: "win32",
		engineDir: join(resources, "docx-engine"),
		env: { KAMIBUDDY_RESOURCES_DIR: resources },
	});
}

type Options = ReturnType<typeof optionsFor>;
const INSTANCE = (options: Options): string => instanceDir(options.root, NODE_RUNTIME_ID, NODE_RUNTIME_VERSION);
const CACHE = (options: Options): string => downloadCacheDir(options.root, NODE_RUNTIME_ID, NODE_RUNTIME_VERSION);
const ARTIFACT = (options: Options): string => join(CACHE(options), NODE_ARTIFACT);

/* ── 假 spawn（探针按真实磁盘事实回答；本路径不再有复制动作）────────── */

function probeSpawn(
	answer: (req: SpawnRequest) => SpawnOutcome = (req) =>
		existsSync(req.command) ? { code: 0, stdout: `v${NODE_RUNTIME_VERSION}\n`, stderr: "" } : { code: 1, stdout: "", stderr: "not found" },
): { calls: SpawnRequest[]; spawn: SpawnFn } {
	const calls: SpawnRequest[] = [];
	const spawn: SpawnFn = (req) => {
		calls.push(req);
		return Promise.resolve(answer(req));
	};
	return { calls, spawn };
}

/**
 * 官方 `SHASUMS256.txt` 的实测内容（**字面量**，不是从常量拼出来的：这样改错常量时
 * 「官方值 vs 固定值」这条交叉核对会红，而不是两边一起被改对）。
 */
const OFFICIAL_SHASUMS = [
	"1177b4137ba5adaa56354ae40f1080c7450e8ae09cecb47da459d1c52ac99f97  node-v22.23.2-win-x64.zip",
	"0d0f5e39f9f3d9587bc19f73eab3c2c9c4903fd02d6dbf9c853dd81b3d95fad4  win-x64/node.exe",
	"",
].join("\n");

function textResponse(text: string): HttpResponse {
	return {
		status: 200,
		contentLength: Buffer.byteLength(text),
		body: {
			async *[Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
				yield Buffer.from(text, "utf8");
			},
		},
	};
}

/**
 * 假 HTTP：`SHASUMS256.txt` 回官方校验文件，其余 URL 吐一段字节
 * （内容与官方发行物无关，sha256 必然对不上 —— 正好用来验「校验不过不进位」）。
 */
function nodeOpener(
	body: Uint8Array,
	options: { readonly onChunk?: (index: number) => void; readonly chunkSize?: number } = {},
	shasums: string = OFFICIAL_SHASUMS,
): HttpOpener {
	const chunkSize = options.chunkSize ?? Math.max(1, body.length);
	return async (request): Promise<HttpResponse> => {
		if (request.url.endsWith("SHASUMS256.txt")) return textResponse(shasums);
		const from = request.rangeStart;
		const self = {
			async *[Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
				let index = 0;
				for (let offset = from; offset < body.length; offset += chunkSize) {
					if (request.signal?.aborted === true) throw new Error("模拟的请求被取消");
					options.onChunk?.(index);
					index += 1;
					yield body.subarray(offset, Math.min(offset + chunkSize, body.length));
				}
			},
		};
		return { status: from > 0 ? 206 : 200, contentLength: body.length - from, body: self };
	};
}

function ready(outcome: RuntimeEnsureOutcome): Extract<RuntimeEnsureOutcome, { status: "ready" }> {
	if (outcome.status !== "ready") throw new Error(`期望就绪，实际失败于 ${outcome.phase}：${outcome.error}`);
	return outcome;
}

/** 手工造一份「已进位」的实例（诊断/探测这类只读路径用它当输入）。 */
function makeCompleteInstance(options: Options): string {
	const dir = INSTANCE(options);
	mkdirSync(dir, { recursive: true });
	for (const file of NODE_REQUIRED_FILES) writeFileSync(join(dir, file), file);
	writeManifest(dir, {
		id: NODE_RUNTIME_ID,
		version: NODE_RUNTIME_VERSION,
		source: "测试来源",
		installedAt: "2026-09-18T00:00:00.000Z",
		status: "installed",
	});
	return dir;
}

describe("纯按需的门：未安装时 ensure 不下载、不安装", () => {
	it("落点 pending ⇒ 返回 not-installed；零 spawn、零 HTTP、缓存目录都不出现", async () => {
		const options = optionsFor("ensure-no-download");
		const { calls, spawn } = probeSpawn();

		const outcome = await ensureRuntime(createNodeRuntime(options), spawn);

		expect(outcome.status).toBe("failed");
		if (outcome.status !== "failed") throw new Error("unreachable");
		expect(outcome.phase).toBe(NOT_INSTALLED_PHASE);
		// 文案必须可执行：告诉用户去哪儿点安装，并明说不会自动下载。
		expect(outcome.error).toContain("设置");
		expect(outcome.error).toContain("不会");
		// 零副作用：没探针、没下载、托管根里连缓存目录都没建。
		expect(calls).toEqual([]);
		expect(existsSync(CACHE(options))).toBe(false);
		expect(readCurrent(options.root, NODE_RUNTIME_ID)).toBeUndefined();
	});

	it("「未安装」不写失败日志 ⇒ 清单状态是 missing（未安装）而不是 failed（安装失败）", async () => {
		const options = optionsFor("ensure-no-log");
		await ensureRuntime(createNodeRuntime(options), probeSpawn().spawn);

		const report = await collectRuntimeDiagnostics(createNodeRuntime(options), probeSpawn().spawn);
		expect(report.lastFailure).toBeUndefined();
	});

	it("已完整进位、只差 current ⇒ 零成本补指针（不 spawn、不下载）", async () => {
		const options = optionsFor("resume-pointer");
		const staging = stagingDir(options.root, NODE_RUNTIME_ID, NODE_RUNTIME_VERSION, "boom");
		mkdirSync(staging, { recursive: true });
		const promoted = promoteStaging(options.root, NODE_RUNTIME_ID, NODE_RUNTIME_VERSION, staging);
		writeManifest(promoted, {
			id: NODE_RUNTIME_ID,
			version: NODE_RUNTIME_VERSION,
			source: "测试来源",
			installedAt: "2026-09-18T00:00:00.000Z",
			status: "installed",
		});
		expect(readCurrent(options.root, NODE_RUNTIME_ID)).toBeUndefined();

		const { calls, spawn } = probeSpawn();
		const outcome = ready(await ensureRuntime(createNodeRuntime(options), spawn));

		expect(outcome.activeDir).toBe(INSTANCE(options));
		expect(calls).toEqual([]);
		expect(readCurrent(options.root, NODE_RUNTIME_ID)).toBe(NODE_RUNTIME_VERSION);
		expect(existsSync(CACHE(options))).toBe(false);
	});
});

describe("校验不过不许进位", () => {
	it("体积异常（小字节）⇒ 相位 acquire-artifact，暂存/实例/current 都不留", async () => {
		const options = optionsFor("too-small");
		const outcome = await installRuntime(createNodeRuntime(options), probeSpawn().spawn, {
			opener: nodeOpener(Buffer.alloc(1024, 1)),
		});

		expect(outcome.status).toBe("failed");
		if (outcome.status !== "failed") throw new Error("unreachable");
		expect(outcome.phase).toBe(ACQUIRE_PHASE);
		expect(outcome.error).toContain("下限");
		assertNothingPromoted(options);
	});

	it("官方校验文件与代码内固定值不一致 ⇒ 立刻中止（不下载可疑产物）", async () => {
		const options = optionsFor("shasums-mismatch");
		let downloaded = false;
		const opener: HttpOpener = async (request) => {
			if (request.url.endsWith("SHASUMS256.txt")) {
				return textResponse("0000000000000000000000000000000000000000000000000000000000000000  node-v22.23.2-win-x64.zip\n");
			}
			downloaded = true;
			return nodeOpener(Buffer.alloc(1024, 1))(request);
		};

		const outcome = await installRuntime(createNodeRuntime(options), probeSpawn().spawn, { opener });

		expect(outcome.status).toBe("failed");
		if (outcome.status !== "failed") throw new Error("unreachable");
		expect(outcome.error).toContain("与代码内固定值不一致");
		expect(downloaded).toBe(false);
		assertNothingPromoted(options);
	});

	it("sha256 不符 ⇒ 响亮报错、暂存清掉、`.part` 也删掉（不留半成品）", async () => {
		const options = optionsFor("sha-mismatch");
		// 体积过门（≥ 30 MiB 下限）但内容与官方发行物无关 ⇒ 只可能栽在 sha256 上。
		const outcome = await installRuntime(createNodeRuntime(options), probeSpawn().spawn, {
			opener: nodeOpener(Buffer.alloc(31 * 1024 * 1024, 5), { chunkSize: 4 * 1024 * 1024 }),
		});

		expect(outcome.status).toBe("failed");
		if (outcome.status !== "failed") throw new Error("unreachable");
		expect(outcome.phase).toBe(ACQUIRE_PHASE);
		expect(outcome.error).toContain("SHA256");
		expect(outcome.error).toContain("未**解包");
		assertNothingPromoted(options);
		expect(existsSync(partFileFor(ARTIFACT(options)))).toBe(false);
	});

	it("下载中途断网 ⇒ 暂存清掉、`.part` 保留（用户再点一次就从同一个源接着下）", async () => {
		const options = optionsFor("io-error");
		const outcome = await installRuntime(createNodeRuntime(options), probeSpawn().spawn, {
			// 每个候选都在第一块之后断掉：最后一轮失败时不该把续传点也清掉。
			opener: nodeOpener(Buffer.alloc(1024, 9), {
				chunkSize: 256,
				onChunk: (index) => {
					if (index === 1) throw new Error("模拟的连接中断");
				},
			}),
		});

		expect(outcome.status).toBe("failed");
		if (outcome.status !== "failed") throw new Error("unreachable");
		expect(outcome.phase).toBe(ACQUIRE_PHASE);
		assertNothingPromoted(options);
		expect(statSync(partFileFor(ARTIFACT(options))).size).toBe(256);
	});

	it("取消（下载中途）⇒ 相位 cancelled、暂存清掉，但 `.part` 留作续传点", async () => {
		const options = optionsFor("cancel");
		const controller = new AbortController();
		const outcome = await installRuntime(createNodeRuntime(options), probeSpawn().spawn, {
			signal: controller.signal,
			opener: nodeOpener(Buffer.alloc(31 * 1024 * 1024, 7), {
				chunkSize: 1024 * 1024,
				onChunk: (index) => (index === 1 ? controller.abort() : undefined),
			}),
		});

		expect(outcome.status).toBe("failed");
		if (outcome.status !== "failed") throw new Error("unreachable");
		expect(outcome.phase).toBe(CANCELLED_PHASE);
		assertNothingPromoted(options);
		// 续传点：已收到的字节留着（用户再点一次安装就不必从头下）。
		expect(existsSync(partFileFor(ARTIFACT(options)))).toBe(true);
	});
});

describe("解包：zip 顶层目录剥离 + node.exe 单独复验", () => {
	async function writeZip(file: string, entries: Record<string, string>): Promise<void> {
		const zip = new JSZip();
		for (const [name, content] of Object.entries(entries)) zip.file(name, content);
		writeFileSync(file, await zip.generateAsync({ type: "nodebuffer" }));
	}

	it("缺 <顶层目录>/node.exe ⇒ 响亮报错（不像官方包）", async () => {
		const dir = join(TMP, "zip-no-exe");
		mkdirSync(dir, { recursive: true });
		const zipFile = join(dir, "bad.zip");
		await writeZip(zipFile, { "node-v22.23.2-win-x64/README.md": "x" });

		await expect(extractNodeZip(zipFile, join(dir, "out"))).rejects.toThrow(/不像官方 node 发行包/);
	});

	it("剥离顶层目录后文件落在实例根；node.exe 的 sha256 由第三道门把关", async () => {
		const dir = join(TMP, "zip-extract");
		mkdirSync(dir, { recursive: true });
		const zipFile = join(dir, "fake.zip");
		await writeZip(zipFile, {
			"node-v22.23.2-win-x64/node.exe": "fake-node",
			"node-v22.23.2-win-x64/LICENSE": "MIT",
			"node-v22.23.2-win-x64/npm.cmd": "@echo off",
		});
		const out = join(dir, "out");

		// 真入口（第二参数缺省 = 官方固定 sha256）必须响亮失败：这不是官方那份 node.exe。
		await expect(extractNodeZip(zipFile, out)).rejects.toThrow(/node\.exe sha256 不符/);

		// 顶层目录确实被剥掉（否则这三条路径都不存在）——用假件的 sha 断言剥离行为本身。
		const fakeSha = createHash("sha256").update(Buffer.from("fake-node")).digest("hex");
		const out2 = join(dir, "out2");
		await extractNodeZip(zipFile, out2, fakeSha);
		expect(readFileSync(join(out2, "node.exe"), "utf8")).toBe("fake-node");
		expect(readFileSync(join(out2, "LICENSE"), "utf8")).toBe("MIT");
		expect(existsSync(join(out2, "npm.cmd"))).toBe(true);
		expect(existsSync(join(out2, "node-v22.23.2-win-x64"))).toBe(false);
	});
});

describe("重置与诊断", () => {
	it("重置：清掉旧实例、重新下载安装、发布 current", async () => {
		const options = optionsFor("reset");
		makeCompleteInstance(options);
		writeCurrent(options.root, NODE_RUNTIME_ID, NODE_RUNTIME_VERSION);
		mkdirSync(stagingDir(options.root, NODE_RUNTIME_ID, NODE_RUNTIME_VERSION, "stale"), { recursive: true });

		// 重置会真的重新取件：假 HTTP 的字节校验不过 ⇒ 响亮失败、且不留半成品。
		const outcome = await resetRuntime(createNodeRuntime(options), probeSpawn().spawn, {
			opener: nodeOpener(Buffer.alloc(1024, 3)),
		});
		expect(outcome.status).toBe("failed");
		expect(listStaging(options.root, NODE_RUNTIME_ID)).toEqual([]);
		// 旧实例已被清掉（重置的语义就是「清干净 + 重装」）。
		expect(readManifest(INSTANCE(options))).toBeUndefined();
	});

	it("四态：就绪 / 缺文件指名到具体文件 / 版本不符带实际版本", async () => {
		const options = optionsFor("inspect");
		makeCompleteInstance(options);
		writeCurrent(options.root, NODE_RUNTIME_ID, NODE_RUNTIME_VERSION);
		const descriptor = createNodeRuntime(options);

		expect(await inspectRuntime(descriptor, probeSpawn().spawn)).toEqual({ kind: "ready" });
		expect(
			await inspectRuntime(
				descriptor,
				probeSpawn(() => ({ code: 0, stdout: "v22.19.0\n", stderr: "" })).spawn,
			),
		).toEqual({ kind: "wrong-version", version: "22.19.0" });

		rmSync(join(INSTANCE(options), "LICENSE"), { force: true });
		expect(await inspectRuntime(descriptor, probeSpawn().spawn)).toEqual({
			kind: "deps-missing",
			module: "LICENSE",
		});
	});

	it("诊断报告写清来源与落点，日志落在该运行时的目录下", async () => {
		const options = optionsFor("diagnostics");
		const report = await collectRuntimeDiagnostics(createNodeRuntime(options), probeSpawn().spawn);
		expect(report.id).toBe(NODE_RUNTIME_ID);
		expect(report.version).toBe(NODE_RUNTIME_VERSION);
		expect(report.source).toContain("nodejs.org");
		expect(report.logPath).toContain(NODE_RUNTIME_ID);
	});
});

describe("来源与版本的机械断言", () => {
	it("候选地址：环境变量覆盖口在前，其次官方源，最后镜像", () => {
		const options = optionsFor("urls");
		const override = { ...options, env: { ...options.env, KAMIBUDDY_NODE_URL: "https://intranet.test/node.zip" } };
		const urls = nodeArtifactUrls(override);
		expect(urls[0]).toBe("https://intranet.test/node.zip");
		expect(urls[1]).toContain("nodejs.org");
		expect(urls[2]).toContain("npmmirror");
		expect(nodeArtifactUrls(options)).toHaveLength(2);
	});

	it("合规义务被钉住：许可文本在必备文件里（删掉它这条断言就红）", () => {
		expect(NODE_REQUIRED_FILES).toContain("LICENSE");
		expect(NODE_REQUIRED_FILES).toContain("node.exe");
	});

	it("钉死的发行物 sha256 是 64 位十六进制（防手抄错）", () => {
		expect(NODE_ARTIFACT_SHA256).toMatch(/^[0-9a-f]{64}$/);
	});

	it("版本串解析（探针的事实来源）", () => {
		expect(parseNodeVersion({ code: 0, stdout: "v22.23.2\n", stderr: "" })).toBe("22.23.2");
		expect(parseNodeVersion({ code: 0, stdout: "22.23.2", stderr: "" })).toBeUndefined();
		expect(parseNodeVersion({ code: 0, stdout: "v22.23", stderr: "" })).toBeUndefined();
		expect(parseNodeVersion({ code: null, stdout: "", stderr: "", error: "ENOENT" })).toBeUndefined();
	});
});

/** 断言「什么都没进位」：没有暂存残留、没有实例、没有完成标记、没有 current。 */
function assertNothingPromoted(options: Options): void {
	expect(listStaging(options.root, NODE_RUNTIME_ID)).toEqual([]);
	expect(existsSync(INSTANCE(options))).toBe(false);
	expect(readCurrent(options.root, NODE_RUNTIME_ID)).toBeUndefined();
}
