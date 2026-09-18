/**
 * gitbash 运行时（随包载荷型）的装配链路与**探针自带注入**测试。
 *
 * 与 node.test.ts 同一档（生产入口 + 真磁盘 + 形态匹配的假 spawn），本文件额外钉住
 * 这个运行时独有的三件事：
 *   1. **探针必须自带 PATH 注入**：实测教训是「不注入时 `bash -c "git --version"`
 *      读到的是机器上另一个 git」，所以断言探针请求的环境里带着注入层的三目录、
 *      且 `mingw64/bin` 在最前（顺序错就会被机器上已有的 git 抢先）；
 *   2. **版本归一化**：上游输出是 `git version 2.55.0.windows.5`，我们钉的是 `2.55.0.5`；
 *   3. **GPLv2 的署名义务被机械钉住**：根 `LICENSE.txt` 是载荷必备文件（缺了即失败、
 *      且不会进位发布），`mingw64/share/licenses/**` 的逐组件许可文本由「整树复制」保住。
 */

import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { SpawnFn, SpawnOutcome, SpawnRequest } from "../../documents/docx-env.ts";
import { instanceDir, readCurrent, readManifest } from "../runtime-store.ts";
import { ensureRuntime, inspectRuntime, type RuntimeEnsureOutcome } from "./registry.ts";
import { defaultPythonRuntimeOptions } from "./python.ts";
import { RUNTIME_ENV_LAYOUT, pathKeyOf } from "./injection.ts";
import {
	createGitbashRuntime,
	gitbashBashPath,
	gitbashPayloadDir,
	parseGitVersion,
	GITBASH_REQUIRED_FILES,
	GITBASH_RUNTIME_ID,
	GITBASH_RUNTIME_VERSION,
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

/** 造一份「构建期已就绪」的 gitbash 随包载荷（含 bash 入口与根许可文本）。 */
function makeGitbashPayload(options: ReturnType<typeof optionsFor>): string {
	const dir = gitbashPayloadDir(options);
	for (const file of GITBASH_REQUIRED_FILES) {
		mkdirSync(join(dir, file, ".."), { recursive: true });
		writeFileSync(join(dir, file), file);
	}
	return dir;
}

const isRobocopy = (req: SpawnRequest): boolean => req.command.endsWith("Robocopy.exe");
const ok = (outcome: Partial<SpawnOutcome> = {}): SpawnOutcome => ({ code: 0, stdout: "", stderr: "", ...outcome });
const notFound = (): SpawnOutcome => ({ code: null, stdout: "", stderr: "", error: "spawn ENOENT" });
/** 上游的真实输出形态（本机实测）。 */
const GIT_VERSION_LINE = "git version 2.55.0.windows.5\n";

function payloadSpawn(
	answer: (req: SpawnRequest) => SpawnOutcome = (req) =>
		existsSync(req.command) ? ok({ stdout: GIT_VERSION_LINE }) : notFound(),
): { calls: SpawnRequest[]; spawn: SpawnFn } {
	const calls: SpawnRequest[] = [];
	const spawn: SpawnFn = (req) => {
		calls.push(req);
		if (isRobocopy(req)) {
			const [from, to] = req.args;
			if (from === undefined || to === undefined) throw new Error("robocopy 请求缺路径");
			cpSync(from, to, { recursive: true });
			return Promise.resolve(ok());
		}
		return Promise.resolve(answer(req));
	};
	return { calls, spawn };
}

function ready(outcome: RuntimeEnsureOutcome): Extract<RuntimeEnsureOutcome, { status: "ready" }> {
	if (outcome.status !== "ready") throw new Error(`期望就绪，实际失败于 ${outcome.phase}：${outcome.error}`);
	return outcome;
}

const INSTANCE = (options: ReturnType<typeof optionsFor>): string =>
	instanceDir(options.root, GITBASH_RUNTIME_ID, GITBASH_RUNTIME_VERSION);

/** 探针请求（非 robocopy 的那个）。 */
const probeOf = (calls: readonly SpawnRequest[]): SpawnRequest => {
	const probe = calls.find((call) => !isRobocopy(call));
	if (probe === undefined) throw new Error("没有探针请求");
	return probe;
};

describe("安装链路（与 node 同一内核、同一形状）", () => {
	it("先探针落空 → 复制进 .staging-* → 进位 → 复验 → 最后 current", async () => {
		const options = optionsFor("fresh");
		makeGitbashPayload(options);
		const { calls, spawn } = payloadSpawn();
		const outcome = ready(await ensureRuntime(createGitbashRuntime(options), spawn));

		expect(outcome.activeDir).toBe(INSTANCE(options));
		expect(readCurrent(options.root, GITBASH_RUNTIME_ID)).toBe(GITBASH_RUNTIME_VERSION);
		expect(readManifest(INSTANCE(options))?.version).toBe(GITBASH_RUNTIME_VERSION);
		expect(calls.find(isRobocopy)?.args[1]).toContain(".staging-");
		// bash 入口与根许可文本都随实例就位（后者是 GPLv2 署名义务的载体）。
		expect(existsSync(gitbashBashPath(INSTANCE(options)))).toBe(true);
		expect(existsSync(join(INSTANCE(options), "LICENSE.txt"))).toBe(true);
	});

	it("载荷缺席：响亮失败并点名构建期命令（运行期不联网自取、不找 7z 解包）", async () => {
		const options = optionsFor("no-payload");
		const outcome = await ensureRuntime(createGitbashRuntime(options), payloadSpawn().spawn);

		expect(outcome.status).toBe("failed");
		if (outcome.status !== "failed") throw new Error("unreachable");
		expect(outcome.phase).toBe("payload-missing");
		expect(outcome.error).toContain("npm run fetch:gitbash");
		expect(outcome.error).toContain(gitbashPayloadDir(options));
		expect(readCurrent(options.root, GITBASH_RUNTIME_ID)).toBeUndefined();
	});

	it("载荷缺根许可文本：载荷不完整，不许进位发布（合规义务不许静默放行）", async () => {
		const options = optionsFor("no-license");
		mkdirSync(join(gitbashPayloadDir(options), "usr", "bin"), { recursive: true });
		writeFileSync(join(gitbashPayloadDir(options), "usr", "bin", "bash.exe"), "bash");

		const outcome = await ensureRuntime(createGitbashRuntime(options), payloadSpawn().spawn);
		expect(outcome.status).toBe("failed");
		if (outcome.status !== "failed") throw new Error("unreachable");
		expect(outcome.phase).toBe("payload-incomplete");
		expect(outcome.error).toContain("LICENSE.txt");
		expect(readCurrent(options.root, GITBASH_RUNTIME_ID)).toBeUndefined();
	});
});

describe("探针自带注入（实测教训：不注入验的是机器环境）", () => {
	it("探针请求带上注入层的三目录，且 mingw64/bin 在最前、基线 PATH 保留在后", async () => {
		const options = optionsFor("probe-env", { Path: "C:\\Windows\\System32" });
		makeGitbashPayload(options);
		const { calls, spawn } = payloadSpawn();
		await ensureRuntime(createGitbashRuntime(options), spawn);

		const probe = probeOf(calls);
		const env = probe.env ?? {};
		// 键名必须与基线一致（Windows 的 Path/PATH 大小写不敏感，写错键名会变成两份 PATH）。
		expect(pathKeyOf(env)).toBe("Path");
		const parts = (env["Path"] ?? "").split(delimiter);
		// 落点由探针命令反推（`<实例>/usr/bin/bash.exe`）—— 探针与注入必须同基准。
		const landing = dirname(dirname(dirname(probe.command)));
		// 与前缀注入层**同一份**布局（单一真源：这个相等断言就是它的机械证据）。
		expect(parts.slice(0, 3)).toEqual(RUNTIME_ENV_LAYOUT.gitbash.pathDirs(landing));
		expect(parts[0]?.endsWith(join("mingw64", "bin"))).toBe(true);
		expect(parts[1]?.endsWith(join("usr", "bin"))).toBe(true);
		// 基线 PATH 保留在注入目录之后（不丢弃用户/系统既有 PATH）。
		expect(parts).toContain("C:\\Windows\\System32");
		// 探针是 bash，且用 `-c` 跑 git（三件事一起验：bash 起得来、git 起得来、注入对）。
		expect(probe.command.endsWith(join("usr", "bin", "bash.exe"))).toBe(true);
		expect(probe.args).toEqual(["-c", "git --version"]);
	});

	it("探针的注入基准落在被验的那个落点上（暂存 → 最终路径各一次）", async () => {
		const options = optionsFor("probe-bases");
		makeGitbashPayload(options);
		const { calls, spawn } = payloadSpawn();
		await ensureRuntime(createGitbashRuntime(options), spawn);

		const bases = calls
			.filter((call) => !isRobocopy(call))
			.map((call) => (call.env?.[pathKeyOf(call.env)] ?? "").split(delimiter)[0] ?? "");
		expect(bases[0]).toContain(".staging-");
		expect(bases[bases.length - 1]).toBe(join(INSTANCE(options), "mingw64", "bin"));
	});
});

describe("四态探测", () => {
	it("就绪 / bash 起不来 → missing / 版本不符带实际版本", async () => {
		const options = optionsFor("inspect");
		makeGitbashPayload(options);
		const descriptor = createGitbashRuntime(options);
		await ensureRuntime(descriptor, payloadSpawn().spawn);
		expect(await inspectRuntime(descriptor, payloadSpawn().spawn)).toEqual({ kind: "ready" });

		expect(await inspectRuntime(descriptor, payloadSpawn(() => ok({ code: 1, stderr: "boom" })).spawn)).toEqual({
			kind: "missing",
		});
		expect(
			await inspectRuntime(descriptor, payloadSpawn(() => ok({ stdout: "git version 2.53.0.windows.2\n" })).spawn),
		).toEqual({ kind: "wrong-version", version: "2.53.0.2" });
	});

	it("bash 入口不存在（文件缺失）→ deps-missing 指名到路径", async () => {
		const options = optionsFor("inspect-missing-file");
		makeGitbashPayload(options);
		const descriptor = createGitbashRuntime(options);
		await ensureRuntime(descriptor, payloadSpawn().spawn);

		rmSync(gitbashBashPath(INSTANCE(options)), { force: true });
		expect(await inspectRuntime(descriptor, payloadSpawn().spawn)).toEqual({
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
	it("根许可文本与 bash 入口都在必备文件清单里（删掉它这条断言就红）", () => {
		expect(GITBASH_REQUIRED_FILES).toContain("LICENSE.txt");
		expect(GITBASH_REQUIRED_FILES).toContain(join("usr", "bin", "bash.exe"));
	});
});
