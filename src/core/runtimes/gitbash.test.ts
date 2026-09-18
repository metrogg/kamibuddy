/**
 * gitbash 运行时的装配链路、**探针自带注入**与**运行期解包**测试。
 *
 * 与 node.test.ts 同一档（生产入口 + 真磁盘 + 假 HTTP + 形态匹配的假 spawn），
 * 本文件额外钉住这个运行时独有的四件事：
 *   1. **运行期解包用发行物自带的 SFX 解包器**（`<artifact> -y -o<dir>`）——
 *      不引入 7-Zip 依赖，且解包动作发生在整包 sha256 通过之后；解包后把
 *      GPLv2 §3 的对应源码获取方式拷进实例根（义务随二进制走）；
 *   2. **探针必须自带 PATH 注入**：实测教训是「不注入时 `bash -c "git --version"`
 *      读到的是机器上另一个 git」，所以断言探针请求的环境里带着注入层的三目录、
 *      且 `mingw64/bin` 在最前（顺序错就会被机器上已有的 git 抢先）；
 *   3. **版本归一化**：上游输出是 `git version 2.55.0.windows.5`，我们钉的是 `2.55.0.5`；
 *   4. **GPLv2 的署名义务被机械钉住**：根 `LICENSE.txt` 与 `CORRESPONDING-SOURCE.md`
 *      都在必备文件里（缺了即失败、且不会进位发布）。
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { SpawnFn, SpawnOutcome, SpawnRequest } from "../../documents/docx-env.ts";
import { downloadCacheDir, instanceDir, listStaging, readCurrent, writeCurrent, writeManifest } from "../runtime-store.ts";
import {
	ensureRuntime,
	installRuntime,
	inspectRuntime,
	ACQUIRE_PHASE,
	NOT_INSTALLED_PHASE,
} from "./registry.ts";
import type { HttpOpener } from "./download.ts";
import { defaultPythonRuntimeOptions } from "./python.ts";
import { RUNTIME_ENV_LAYOUT, pathKeyOf } from "./injection.ts";
import {
	createGitbashRuntime,
	extractPortableGit,
	gitbashArtifactUrls,
	gitbashBashPath,
	gitbashSourceOfferPath,
	parseGitVersion,
	GITBASH_ARTIFACT_SHA256,
	GITBASH_REQUIRED_FILES,
	GITBASH_RUNTIME_ID,
	GITBASH_RUNTIME_VERSION,
	GITBASH_SOURCE_OFFER_RELATIVE,
} from "./gitbash.ts";

const TMP = mkdtempSync(join(tmpdir(), "kami-gitbash-runtime-"));
afterAll(() => {
	rmSync(TMP, { recursive: true, force: true });
});

let seq = 0;
function optionsFor(name: string, env: Record<string, string> = {}) {
	seq += 1;
	const base = join(TMP, `${name}-${seq}`);
	const resources = join(base, "resources");
	mkdirSync(join(base, "home"), { recursive: true });
	return defaultPythonRuntimeOptions({
		root: join(base, "config", "runtimes"),
		homeDir: join(base, "home"),
		platform: "win32",
		engineDir: join(resources, "docx-engine"),
		env: { KAMIBUDDY_RESOURCES_DIR: resources, ...env },
	});
}

type Options = ReturnType<typeof optionsFor>;
const INSTANCE = (options: Options): string =>
	instanceDir(options.root, GITBASH_RUNTIME_ID, GITBASH_RUNTIME_VERSION);
const CACHE = (options: Options): string =>
	downloadCacheDir(options.root, GITBASH_RUNTIME_ID, GITBASH_RUNTIME_VERSION);

/** 上游的真实输出形态（本机实测）。 */
const GIT_VERSION_LINE = "git version 2.55.0.windows.5\n";

const ok = (outcome: Partial<SpawnOutcome> = {}): SpawnOutcome => ({ code: 0, stdout: "", stderr: "", ...outcome });
const notFound = (): SpawnOutcome => ({ code: null, stdout: "", stderr: "", error: "spawn ENOENT" });

function probeSpawn(
	answer: (req: SpawnRequest) => SpawnOutcome = (req) =>
		existsSync(req.command) ? ok({ stdout: GIT_VERSION_LINE }) : notFound(),
): { calls: SpawnRequest[]; spawn: SpawnFn } {
	const calls: SpawnRequest[] = [];
	const spawn: SpawnFn = (req) => {
		calls.push(req);
		return Promise.resolve(answer(req));
	};
	return { calls, spawn };
}

/** 假 HTTP：吐一段字节（内容与官方发行物无关，sha256 必然对不上）。 */
const smallOpener: HttpOpener = () =>
	Promise.resolve({
		status: 200,
		contentLength: 1024,
		body: {
			async *[Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
				yield Buffer.alloc(1024, 1);
			},
		},
	});

/** 手工造一份「已进位并发布」的实例（探测类只读路径的输入）。 */
function makeCompleteInstance(options: Options): string {
	const dir = INSTANCE(options);
	for (const file of GITBASH_REQUIRED_FILES) {
		mkdirSync(dirname(join(dir, file)), { recursive: true });
		writeFileSync(join(dir, file), file);
	}
	writeManifest(dir, {
		id: GITBASH_RUNTIME_ID,
		version: GITBASH_RUNTIME_VERSION,
		source: "测试来源",
		installedAt: "2026-09-18T00:00:00.000Z",
		status: "installed",
	});
	writeCurrent(options.root, GITBASH_RUNTIME_ID, GITBASH_RUNTIME_VERSION);
	return dir;
}

/** 造一份 resources 下的对应源码声明（生产里随应用分发，测试里自己摆）。 */
function makeSourceOffer(options: Options): string {
	const file = gitbashSourceOfferPath(options);
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, "# 对应源码获取方式（测试）\n");
	return file;
}

describe("纯按需的门与来源", () => {
	it("未安装时 ensure 只探不装：零 spawn、缓存目录不出现、相位 not-installed", async () => {
		const options = optionsFor("ensure-no-download");
		const { calls, spawn } = probeSpawn();

		const outcome = await ensureRuntime(createGitbashRuntime(options), spawn);

		expect(outcome.status).toBe("failed");
		if (outcome.status !== "failed") throw new Error("unreachable");
		expect(outcome.phase).toBe(NOT_INSTALLED_PHASE);
		expect(outcome.error).toContain("不会");
		expect(calls).toEqual([]);
		expect(existsSync(CACHE(options))).toBe(false);
		expect(readCurrent(options.root, GITBASH_RUNTIME_ID)).toBeUndefined();
	});

	it("下载校验不过 ⇒ 不进位（暂存/实例/current 都不留）", async () => {
		const options = optionsFor("sha-fail");
		const outcome = await installRuntime(createGitbashRuntime(options), probeSpawn().spawn, {
			opener: smallOpener,
		});

		expect(outcome.status).toBe("failed");
		if (outcome.status !== "failed") throw new Error("unreachable");
		expect(outcome.phase).toBe(ACQUIRE_PHASE);
		expect(outcome.error).toContain("下限");
		expect(listStaging(options.root, GITBASH_RUNTIME_ID)).toEqual([]);
		expect(existsSync(INSTANCE(options))).toBe(false);
		expect(readCurrent(options.root, GITBASH_RUNTIME_ID)).toBeUndefined();
	});

	it("候选地址：覆盖口在前，其次官方 release，最后镜像；sha256 是 64 位十六进制", () => {
		const options = optionsFor("urls", { KAMIBUDDY_GITBASH_URL: "https://intranet.test/pg.7z.exe" });
		const urls = gitbashArtifactUrls(options);
		expect(urls[0]).toBe("https://intranet.test/pg.7z.exe");
		expect(urls[1]).toContain("github.com/git-for-windows");
		expect(urls[2]).toContain("npmmirror");
		expect(GITBASH_ARTIFACT_SHA256).toMatch(/^[0-9a-f]{64}$/);
	});
});

describe("运行期解包（发行物自带的 SFX 解包器）", () => {
	it("调用 `<artifact> -y -o<dir>`，并把对应源码获取方式拷进实例根", async () => {
		const options = optionsFor("extract");
		const sourceOffer = makeSourceOffer(options);
		const envDir = join(TMP, "extract-instance");
		mkdirSync(envDir, { recursive: true });
		const calls: SpawnRequest[] = [];
		const spawn: SpawnFn = (req) => {
			calls.push(req);
			// 假 SFX：把解包结果物化出来（形态与实测一致：bash 在 usr/bin，许可文本在根）。
			mkdirSync(join(envDir, "usr", "bin"), { recursive: true });
			writeFileSync(join(envDir, "usr", "bin", "bash.exe"), "bash");
			writeFileSync(join(envDir, "LICENSE.txt"), "GPLv2");
			return Promise.resolve(ok());
		};

		await extractPortableGit("C:\\cache\\PortableGit.7z.exe", envDir, { spawn, sourceOffer });

		expect(calls).toEqual([
			{ command: "C:\\cache\\PortableGit.7z.exe", args: ["-y", `-o${envDir}`] },
		]);
		// GPLv2 §3 的义务载体随二进制一起落位（内容就是随应用分发的那份）。
		expect(readFileSync(join(envDir, "CORRESPONDING-SOURCE.md"), "utf8")).toBe(
			readFileSync(sourceOffer, "utf8"),
		);
	});

	it("自解压失败（非 0 退出码）⇒ 响亮报错，文案可执行", async () => {
		const options = optionsFor("extract-fail");
		const sourceOffer = makeSourceOffer(options);
		const envDir = join(TMP, "extract-fail-instance");
		const failure = await extractPortableGit("C:\\cache\\PortableGit.7z.exe", envDir, {
			spawn: () => Promise.resolve(ok({ code: 2, stderr: "cannot write to output directory" })),
			sourceOffer,
		}).catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(Error);
		if (!(failure instanceof Error)) throw new Error("unreachable");
		expect(failure.message).toContain("自解压失败");
		expect(failure.message).toContain("磁盘");
	});

	it("对应源码声明缺失 ⇒ 立刻失败（义务不许缺）", async () => {
		const options = optionsFor("extract-no-offer");
		const envDir = join(TMP, "extract-no-offer-instance");
		const failure = await extractPortableGit("C:\\cache\\PortableGit.7z.exe", envDir, {
			spawn: () => Promise.resolve(ok()),
			sourceOffer: gitbashSourceOfferPath(options), // 故意不创建
		}).catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(Error);
		if (!(failure instanceof Error)) throw new Error("unreachable");
		expect(failure.message).toContain(GITBASH_SOURCE_OFFER_RELATIVE);
	});
});

describe("探针自带注入（实测教训：不注入验的是机器环境）", () => {
	it("探针请求带上注入层的三目录，且 mingw64/bin 在最前、基线 PATH 保留在后", async () => {
		const options = optionsFor("probe-env", { Path: "C:\\Windows\\System32" });
		makeCompleteInstance(options);
		const { calls, spawn } = probeSpawn();

		expect((await ensureRuntime(createGitbashRuntime(options), spawn)).status).toBe("ready");

		const probe = calls[0];
		expect(probe).toBeDefined();
		if (probe === undefined) throw new Error("unreachable");
		const env = probe.env ?? {};
		// 键名必须与基线一致（Windows 的 Path/PATH 大小写不敏感，写错键名会变成两份 PATH）。
		expect(pathKeyOf(env)).toBe("Path");
		const parts = (env["Path"] ?? "").split(delimiter);
		const landing = dirname(dirname(dirname(probe.command)));
		// 与前缀注入层**同一份**布局（单一真源：这个相等断言就是它的机械证据）。
		expect(parts.slice(0, 3)).toEqual(RUNTIME_ENV_LAYOUT.gitbash.pathDirs(landing));
		expect(parts[0]?.endsWith(join("mingw64", "bin"))).toBe(true);
		expect(parts[1]?.endsWith(join("usr", "bin"))).toBe(true);
		expect(parts).toContain("C:\\Windows\\System32");
		// 探针是 bash，且用 `-c` 跑 git（三件事一起验：bash 起得来、git 起得来、注入对）。
		expect(probe.command.endsWith(join("usr", "bin", "bash.exe"))).toBe(true);
		expect(probe.args).toEqual(["-c", "git --version"]);
	});
});

describe("四态探测", () => {
	it("就绪 / bash 起不来 → missing / 版本不符带实际版本 / 缺文件指名", async () => {
		const options = optionsFor("inspect");
		makeCompleteInstance(options);
		const descriptor = createGitbashRuntime(options);
		expect(await inspectRuntime(descriptor, probeSpawn().spawn)).toEqual({ kind: "ready" });

		expect(await inspectRuntime(descriptor, probeSpawn(() => ok({ code: 1, stderr: "boom" })).spawn)).toEqual({
			kind: "missing",
		});
		expect(
			await inspectRuntime(
				descriptor,
				probeSpawn(() => ok({ stdout: "git version 2.53.0.windows.2\n" })).spawn,
			),
		).toEqual({ kind: "wrong-version", version: "2.53.0.2" });

		rmSync(gitbashBashPath(INSTANCE(options)), { force: true });
		expect(await inspectRuntime(descriptor, probeSpawn().spawn)).toEqual({
			kind: "deps-missing",
			module: join("usr", "bin", "bash.exe"),
		});
	});
});

describe("版本串归一化（上游 `windows.N` ↔ 我们钉的 release 版本）", () => {
	it("实测形态与容错边界", () => {
		expect(parseGitVersion(ok({ stdout: GIT_VERSION_LINE }))).toBe("2.55.0.5");
		// 有的路径下 git 会往 stderr 写（例如包装器警告），所以两股流都读。
		expect(parseGitVersion(ok({ stderr: GIT_VERSION_LINE }))).toBe("2.55.0.5");
		expect(parseGitVersion(ok({ stdout: "git version 2.55.0\n" }))).toBeUndefined();
		expect(parseGitVersion(ok({ stdout: "bash: line 1: git: command not found\n" }))).toBeUndefined();
		expect(parseGitVersion(notFound())).toBeUndefined();
	});
});

describe("合规义务被钉住", () => {
	it("bash 入口、根许可文本与对应源码声明都在必备文件清单里（删掉它这条断言就红）", () => {
		expect(GITBASH_REQUIRED_FILES).toContain("LICENSE.txt");
		expect(GITBASH_REQUIRED_FILES).toContain(join("usr", "bin", "bash.exe"));
		expect(GITBASH_REQUIRED_FILES).toContain("CORRESPONDING-SOURCE.md");
	});
});
