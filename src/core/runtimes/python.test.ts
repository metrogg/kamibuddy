/**
 * Python 运行时（托管根下的实例）的装配链路测试。
 *
 * 这是「真入口 + 真磁盘」那一档：走生产的 `installPythonRuntime` / `resetPythonRuntime` /
 * `ensurePythonRuntime` / `pythonRuntimeDiagnostics`（即设置页「安装/重置/诊断」与
 * 转换前探测用的同一批入口），托管根与家目录都落在临时目录里，spawn 用形态匹配的假实现
 * （不真装 Python）。相位表本身的覆盖在 documents/docx-env.test.ts。
 *
 * 2026-09-18 变更（三运行时纯按需）后 `ensurePythonRuntime` **只探不装**，
 * 所以「装」这件事在用例里一律走 `installPythonRuntime`；本文件的重点是四条不可退让的性质：
 *   1. **纯按需**：未安装时 ensure 零 spawn（不下载、不安装）；
 *   2. **原子性**：安装落在 `.staging-*` 里，进位之后才写 manifest，**最后**写 current；
 *      任何中途状态读侧都不判就绪（用例直接手工制造三个崩溃点）。
 *   3. **唯一真源**：override > managed > legacy 的优先级只有一处判据，两条路径并存时
 *      以 managed 为准（迁移期最容易分叉的地方）。
 *   4. **既有语义不变**：四态分类与 env-not-ready 的归因、文案一律照旧。
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { classifyEnsureError } from "../../documents/docx-convert.ts";
import type { DocxEnvStatus } from "../../shared/ipc.ts";
import type { EnsureResult, SpawnFn, SpawnOutcome, SpawnRequest } from "../../documents/docx-env.ts";
import {
	instanceDir,
	listStaging,
	promoteStaging,
	readCurrent,
	readManifest,
	stagingDir,
	writeCurrent,
	writeManifest,
} from "../runtime-store.ts";
import { appendRuntimeEvent, renderRuntimeDiagnostics } from "./diagnostics.ts";
import {
	createPythonRuntime,
	defaultPythonRuntimeOptions,
	ensurePythonRuntime,
	installPythonRuntime,
	inspectPythonRuntime,
	pythonRuntimeDiagnostics,
	resetPythonRuntime,
	resolvePythonVenv,
	rollbackPythonRuntime,
	PYTHON_RUNTIME_ID,
	PYTHON_RUNTIME_VERSION,
	VENV_OVERRIDE_ENV,
	type PythonRuntimeOptionOverrides,
} from "./python.ts";

const TMP = mkdtempSync(join(tmpdir(), "kami-python-runtime-"));
afterAll(() => {
	rmSync(TMP, { recursive: true, force: true });
});

let seq = 0;
/** 每个用例一套独立的托管根 + 家目录：不靠执行顺序、不互相污染（家目录空 ⇒ 无旧路径）。 */
function optionsFor(name: string, overrides: PythonRuntimeOptionOverrides = {}) {
	seq += 1;
	const base = join(TMP, `${name}-${seq}`);
	const options = defaultPythonRuntimeOptions({
		root: join(base, "config", "runtimes"),
		homeDir: join(base, "home"),
		platform: "win32",
		engineDir: join(base, "resources", "docx-engine"),
		// env 注入空表：不读 process.env 的 HTML_TO_DOCX_VENV（测试可复现）。
		env: {},
		...overrides,
	});
	mkdirSync(options.homeDir, { recursive: true });
	return options;
}

/* ── 假 spawn（按请求形态匹配，路径无关：暂存目录名不可预测） ─────── */

const isPythonExe = (command: string): boolean =>
	command.endsWith("python.exe") || command.endsWith(join("bin", "python"));
const isUvVersion = (req: SpawnRequest): boolean =>
	req.args.length === 1 && req.args[0] === "--version" && !isPythonExe(req.command);
const isPythonFind = (req: SpawnRequest): boolean => req.args[0] === "python" && req.args[1] === "find";
const isCreateVenv = (req: SpawnRequest): boolean => req.args[0] === "venv";
const isInstallDeps = (req: SpawnRequest): boolean => req.args[0] === "pip";
const isVenvVersion = (req: SpawnRequest): boolean =>
	isPythonExe(req.command) && req.args.length === 1 && req.args[0] === "--version";
const isDepsProbe = (req: SpawnRequest): boolean =>
	isPythonExe(req.command) && req.args[0] === "-c" && String(req.args[1]).includes("importlib");
const isEngineSmoke = (req: SpawnRequest): boolean =>
	isPythonExe(req.command) && req.args[0] === "-c" && String(req.args[1]).includes("html_to_docx");

function ok(outcome: Partial<SpawnOutcome> = {}): SpawnOutcome {
	return { code: 0, stdout: "", stderr: "", ...outcome };
}
function notFound(): SpawnOutcome {
	return { code: null, stdout: "", stderr: "", error: "spawn ENOENT" };
}

function scripted(
	branches: ReadonlyArray<
		readonly [(req: SpawnRequest) => boolean, SpawnOutcome | ((req: SpawnRequest) => SpawnOutcome)]
	>,
): { calls: SpawnRequest[]; spawn: SpawnFn } {
	const calls: SpawnRequest[] = [];
	const spawn: SpawnFn = (req) => {
		calls.push(req);
		for (const [when, outcome] of branches) {
			if (when(req)) return Promise.resolve(typeof outcome === "function" ? outcome(req) : outcome);
		}
		return Promise.reject(new Error(`未编排的 spawn: ${req.command} ${req.args.join(" ")}`));
	};
	return { calls, spawn };
}

/** 「全部就绪」：uv 在 → python 3.12 在 → venv 3.12 → 依赖齐 → 引擎包能导入。 */
function readyScenario(): { calls: SpawnRequest[]; spawn: SpawnFn } {
	return scripted([
		[isUvVersion, ok({ stdout: "uv 0.11.28" })],
		[isPythonFind, ok({ stdout: "python 3.12.4" })],
		[isVenvVersion, ok({ stdout: "Python 3.12.4" })],
		[isDepsProbe, ok({ stdout: '{"missing": null}' })],
		[isEngineSmoke, ok()],
	]);
}

/**
 * 「venv 还不存在」：先探测落空 → 真的走一次 `uv venv … --clear <落点>` → 之后探测通过。
 * 用状态量而不是纯形态匹配，才能既覆盖「创建」这一步、又不让进位后的复验落空。
 */
function freshInstallScenario(): { calls: SpawnRequest[]; spawn: SpawnFn } {
	let created = false;
	return scripted([
		[isUvVersion, ok({ stdout: "uv 0.11.28" })],
		[isPythonFind, ok({ stdout: "python 3.12.4" })],
		[isVenvVersion, () => (created ? ok({ stdout: "Python 3.12.4" }) : notFound())],
		[isCreateVenv, () => {
			created = true;
			return ok();
		}],
		[isDepsProbe, ok({ stdout: '{"missing": null}' })],
		[isEngineSmoke, ok()],
	]);
}

/** 断言「就绪」并窄化类型（失败时把归因一起抛出来，别只丢一句断言失败）。 */
function ready(outcome: EnsureResult): Extract<EnsureResult, { status: "ready" }> {
	if (outcome.status !== "ready") {
		throw new Error(`期望环境就绪，实际失败于 ${outcome.phase}：${outcome.error}`);
	}
	return outcome;
}

const INSTANCE = (options: ReturnType<typeof optionsFor>): string =>
	instanceDir(options.root, PYTHON_RUNTIME_ID, PYTHON_RUNTIME_VERSION);
const VENV = (options: ReturnType<typeof optionsFor>): string => join(INSTANCE(options), "venv");
const PYTHON = (options: ReturnType<typeof optionsFor>): string =>
	join(VENV(options), "Scripts", "python.exe");

function fakeManifest(version = PYTHON_RUNTIME_VERSION) {
	return {
		id: PYTHON_RUNTIME_ID,
		version,
		source: "测试来源",
		installedAt: "2026-09-17T00:00:00.000Z",
		status: "installed" as const,
	};
}

/* ── 全新机器：原子安装 ───────────────────────────────────────────── */

describe("全新机器：装进托管根", () => {
	it("装到 .staging-* → 进位 → 写 manifest → 最后写 current；落在托管根的版本目录", async () => {
		const options = optionsFor("fresh");
		const { calls, spawn } = freshInstallScenario();
		const ensured = await installPythonRuntime(options, spawn);

		expect(ensured).toEqual({
			status: "ready",
			python: PYTHON(options),
			venvDir: VENV(options),
		});
		expect(readCurrent(options.root, PYTHON_RUNTIME_ID)).toBe(PYTHON_RUNTIME_VERSION);
		expect(listStaging(options.root, PYTHON_RUNTIME_ID)).toEqual([]);
		expect(readManifest(INSTANCE(options))?.version).toBe(PYTHON_RUNTIME_VERSION);

		// 「安装到临时目录」的实证：建 venv 那一步的落点名字里带 .staging-。
		const create = calls.find(isCreateVenv);
		expect(create?.args.slice(0, 4)).toEqual(["venv", "--python", "3.12", "--clear"]);
		expect(create?.args[4]).toContain(".staging-");
		// 进位后复验真的发生了：探针在**最终路径**上又跑过一次。
		expect(calls.some((call) => call.command === PYTHON(options))).toBe(true);
	});

	it("进位后复验不过 → 不发布（current 不写、完成标记不写），如实报 verify-promoted", async () => {
		const options = optionsFor("verify-fail");
		let created = false;
		// 暂存里一切正常；只在**最终路径**上让依赖冒烟失败（模拟「改名后环境不可用」）。
		const { spawn } = scripted([
			[isUvVersion, ok({ stdout: "uv 0.11.28" })],
			[isPythonFind, ok({ stdout: "python 3.12.4" })],
			[isVenvVersion, () => (created ? ok({ stdout: "Python 3.12.4" }) : notFound())],
			[isCreateVenv, () => {
				created = true;
				return ok();
			}],
			[
				isDepsProbe,
				(req: SpawnRequest) =>
					req.command.includes(".staging-")
						? ok({ stdout: '{"missing": null}' })
						: ok({ stdout: '{"missing": "lxml"}' }),
			],
			[isEngineSmoke, ok()],
		]);
		const ensured = await installPythonRuntime(options, spawn);

		expect(ensured.status).toBe("failed");
		if (ensured.status !== "failed") throw new Error("unreachable");
		expect(ensured.phase).toBe("verify-promoted");
		expect(ensured.error).toContain("复验不通过");
		expect(ensured.error).toContain("lxml");
		// 顺序铁律：复验没过 ⇒ 既不写 current、也不写完成标记（实例已在位但不算数）。
		expect(readCurrent(options.root, PYTHON_RUNTIME_ID)).toBeUndefined();
		expect(existsSync(INSTANCE(options))).toBe(true);
		expect(readManifest(INSTANCE(options))).toBeUndefined();
	});

	it("幂等：已发布且就绪时再 ensure 只做探测（不重建、不重装、不联网）", async () => {
		const options = optionsFor("idempotent");
		const first = readyScenario();
		await installPythonRuntime(options, first.spawn);
		const second = readyScenario();
		const again = await ensurePythonRuntime(options, second.spawn);

		expect(again.status).toBe("ready");
		// 安装动作一个都不许出现（uv 都不该被问：ensure 是只读探测）。
		expect(second.calls.some(isCreateVenv)).toBe(false);
		expect(second.calls.some(isInstallDeps)).toBe(false);
		expect(second.calls.some(isUvVersion)).toBe(false);
		expect(ready(again).venvDir).toBe(VENV(options));
	});

	it("**纯按需**：未安装时 ensure 零 spawn（不下载、不安装），相位 not-installed", async () => {
		const options = optionsFor("not-installed");
		const { calls, spawn } = readyScenario();

		const failed = await ensurePythonRuntime(options, spawn);

		expect(failed.status).toBe("failed");
		if (failed.status !== "failed") throw new Error("unreachable");
		expect(failed.phase).toBe("not-installed");
		expect(failed.error).toContain("设置");
		expect(calls).toEqual([]);
		expect(readCurrent(options.root, PYTHON_RUNTIME_ID)).toBeUndefined();
	});
});

/* ── 崩溃点：读侧一律不判就绪 ───────────────────────────────────── */

describe("崩溃点：不会留下「看起来就绪」的状态", () => {
	it("崩在改名之前（只剩半成品）→ 未就绪；重跑清残留并装好（可续跑）", async () => {
		const options = optionsFor("crash-staging");
		mkdirSync(stagingDir(options.root, PYTHON_RUNTIME_ID, PYTHON_RUNTIME_VERSION, "boom"), {
			recursive: true,
		});

		expect(readCurrent(options.root, PYTHON_RUNTIME_ID)).toBeUndefined();
		const crashed = await pythonRuntimeDiagnostics(options, scripted([[() => true, notFound()]]).spawn);
		expect(crashed.status).toEqual({ kind: "missing" });
		expect(crashed.staging).toEqual([`.staging-${PYTHON_RUNTIME_VERSION}-boom`]);
		expect(crashed.nextSteps.join("\n")).toContain("半成品");

		// 续跑：不需要用户手删目录，再点一次安装（或走安装链路）即可。
		const retry = readyScenario();
		const ensured = await installPythonRuntime(options, retry.spawn);
		expect(ensured.status).toBe("ready");
		expect(listStaging(options.root, PYTHON_RUNTIME_ID)).toEqual([]);
		expect(readCurrent(options.root, PYTHON_RUNTIME_ID)).toBe(PYTHON_RUNTIME_VERSION);
	});

	it("崩在改名之后、写 manifest 之前 → 目录在但未就绪", async () => {
		const options = optionsFor("crash-promoted");
		const staging = stagingDir(options.root, PYTHON_RUNTIME_ID, PYTHON_RUNTIME_VERSION, "boom");
		mkdirSync(staging, { recursive: true });
		promoteStaging(options.root, PYTHON_RUNTIME_ID, PYTHON_RUNTIME_VERSION, staging);

		expect(existsSync(INSTANCE(options))).toBe(true);
		expect(readManifest(INSTANCE(options))).toBeUndefined();
		expect(readCurrent(options.root, PYTHON_RUNTIME_ID)).toBeUndefined();
		// 指针缺席 ⇒ 唯一真源落到「待安装」，不会被一个没验过的目录骗成 managed。
		expect(resolvePythonVenv(options).source).toBe("pending");
	});

	it("崩在写 manifest 之后、写 current 之前 → 未就绪，但下次 ensure 零成本续跑（不重新下载）", async () => {
		const options = optionsFor("crash-current");
		const staging = stagingDir(options.root, PYTHON_RUNTIME_ID, PYTHON_RUNTIME_VERSION, "boom");
		mkdirSync(staging, { recursive: true });
		const promoted = promoteStaging(options.root, PYTHON_RUNTIME_ID, PYTHON_RUNTIME_VERSION, staging);
		writeManifest(promoted, fakeManifest());

		// 读侧：实例完整，但没有 current ⇒ 不算就绪。
		expect(readCurrent(options.root, PYTHON_RUNTIME_ID)).toBeUndefined();
		expect(resolvePythonVenv(options).source).toBe("pending");
		expect(await inspectPythonRuntime(options, scripted([[() => true, notFound()]]).spawn)).toEqual({
			kind: "missing",
		});

		const report = await pythonRuntimeDiagnostics(options, readyScenario().spawn);
		expect(report.instances).toEqual([{ version: PYTHON_RUNTIME_VERSION, complete: true }]);
		expect(report.currentVersion).toBeUndefined();
		expect(report.nextSteps.join("\n")).toContain("没发布");

		// 续跑：只补指针，一次 spawn 都不需要。
		const resume = readyScenario();
		const ensured = await ensurePythonRuntime(options, resume.spawn);
		expect(ensured.status).toBe("ready");
		expect(resume.calls).toEqual([]);
		expect(readCurrent(options.root, PYTHON_RUNTIME_ID)).toBe(PYTHON_RUNTIME_VERSION);
	});
});

/* ── 回滚 ─────────────────────────────────────────────────────────── */

describe("回滚：只切 current 指针", () => {
	it("两版并存时可切回上一版，实例内容一个字节不动", async () => {
		const options = optionsFor("rollback");
		writeManifest(instanceDir(options.root, PYTHON_RUNTIME_ID, "3.11"), fakeManifest("3.11"));
		writeManifest(INSTANCE(options), fakeManifest());
		writeCurrent(options.root, PYTHON_RUNTIME_ID, PYTHON_RUNTIME_VERSION);
		const before = readFileSync(join(INSTANCE(options), "manifest.json"), "utf8");

		const rolled = rollbackPythonRuntime(options, "3.11");
		expect(rolled.status).toBe("ready");
		expect(ready(rolled).venvDir).toBe(join(instanceDir(options.root, PYTHON_RUNTIME_ID, "3.11"), "venv"));
		expect(readCurrent(options.root, PYTHON_RUNTIME_ID)).toBe("3.11");

		const resolution = resolvePythonVenv(options);
		expect(resolution.source).toBe("managed");
		expect(resolution.version).toBe("3.11");
		expect(readFileSync(join(INSTANCE(options), "manifest.json"), "utf8")).toBe(before);
	});

	it("目标版本没装过 → 响亮报错，不把指针切到不存在的版本", () => {
		const options = optionsFor("rollback-missing");
		expect(() => rollbackPythonRuntime(options, "3.11")).toThrow(/不完整/);
		expect(readCurrent(options.root, PYTHON_RUNTIME_ID)).toBeUndefined();
	});
});

/* ── 唯一真源：override > managed > legacy ──────────────────────── */

describe("落点优先级（唯一真源）", () => {
	it("只有旧路径 → 探测就地作用于它（不迁入、不删、不写 current）；安装才装进托管根", async () => {
		const options = optionsFor("legacy-only");
		const legacy = join(options.homeDir, ".venv-html-to-docx");
		mkdirSync(legacy, { recursive: true });

		const resolution = resolvePythonVenv(options);
		expect(resolution.source).toBe("legacy");
		expect(resolution.activeDir).toBe(legacy);
		expect(resolution.detail).toContain("未迁入托管根");

		// 探测（转换前的 ensure）：就地探，不动用户的目录、不写指针。
		const probed = await ensurePythonRuntime(options, readyScenario().spawn);
		expect(probed.status).toBe("ready");
		expect(ready(probed).venvDir).toBe(legacy);
		expect(readCurrent(options.root, PYTHON_RUNTIME_ID)).toBeUndefined();

		// 安装：装进托管根（「显式迁入」的语义），旧目录原样保留。
		const installed = await installPythonRuntime(options, readyScenario().spawn);
		expect(installed.status).toBe("ready");
		expect(ready(installed).venvDir).toBe(VENV(options));
		expect(existsSync(legacy)).toBe(true);
		expect(readCurrent(options.root, PYTHON_RUNTIME_ID)).toBe(PYTHON_RUNTIME_VERSION);
	});

	it("旧路径与托管实例并存 → 以托管根 current 为准（唯一真源）", () => {
		const options = optionsFor("both");
		mkdirSync(join(options.homeDir, ".venv-html-to-docx"), { recursive: true });
		writeManifest(INSTANCE(options), fakeManifest());
		writeCurrent(options.root, PYTHON_RUNTIME_ID, PYTHON_RUNTIME_VERSION);

		const resolution = resolvePythonVenv(options);
		expect(resolution.source).toBe("managed");
		expect(resolution.activeDir).toBe(VENV(options));
		// 旧目录还在盘上（我们不删用户的目录），只是不再生效。
		expect(existsSync(join(options.homeDir, ".venv-html-to-docx"))).toBe(true);
	});

	it("HTML_TO_DOCX_VENV 覆盖口压过托管根（兼容既有用户的显式指定）", () => {
		const opsVenv = join(TMP, "ops", "venv");
		const options = optionsFor("override", { env: { [VENV_OVERRIDE_ENV]: opsVenv } });
		writeManifest(INSTANCE(options), fakeManifest());
		writeCurrent(options.root, PYTHON_RUNTIME_ID, PYTHON_RUNTIME_VERSION);

		const resolution = resolvePythonVenv(options);
		expect(resolution.source).toBe("override");
		expect(resolution.activeDir).toBe(opsVenv);
		expect(resolution.managed).toBe(false);
	});

	it("覆盖口生效时，安装就地作用于它、托管根完全不参与", async () => {
		const opsVenv = join(TMP, "ops-ensure", "venv");
		const options = optionsFor("override-ensure", { env: { [VENV_OVERRIDE_ENV]: opsVenv } });
		const { spawn } = readyScenario();
		const ensured = await installPythonRuntime(options, spawn);

		expect(ensured.status).toBe("ready");
		expect(ready(ensured).venvDir).toBe(opsVenv);
		expect(readCurrent(options.root, PYTHON_RUNTIME_ID)).toBeUndefined();
		expect(listStaging(options.root, PYTHON_RUNTIME_ID)).toEqual([]);
	});

	it("current 指向不存在的版本 → 指针被忽略（不照着垃圾版本名建实例）", async () => {
		const options = optionsFor("broken-pointer");
		writeCurrent(options.root, PYTHON_RUNTIME_ID, "9.9");

		const resolution = resolvePythonVenv(options);
		expect(resolution.source).toBe("pending");
		expect(resolution.instanceDir).toBe(INSTANCE(options));
		expect(resolution.detail).toContain("9.9");
		expect(resolution.detail).toContain("已被忽略");

		const report = await pythonRuntimeDiagnostics(options, readyScenario().spawn);
		expect(report.currentVersion).toBe("9.9");
		expect(report.nextSteps.join("\n")).toContain("指针已被忽略");
	});
});

/* ── 重置并重新安装 ──────────────────────────────────────────────── */

describe("重置并重新安装", () => {
	it("环境损坏时仅凭重置修好（清掉半成品 + 重新安装 + 发布）", async () => {
		const options = optionsFor("reset");
		writeManifest(INSTANCE(options), fakeManifest());
		writeCurrent(options.root, PYTHON_RUNTIME_ID, PYTHON_RUNTIME_VERSION);
		mkdirSync(stagingDir(options.root, PYTHON_RUNTIME_ID, PYTHON_RUNTIME_VERSION, "stale"), {
			recursive: true,
		});

		const { calls, spawn } = freshInstallScenario();
		const reset = await resetPythonRuntime(options, spawn);

		expect(reset).toEqual({ status: "ready", python: PYTHON(options), venvDir: VENV(options) });
		// 真的重建了一次，且重建落在新的暂存目录里（不是原地复用坏实例）。
		const create = calls.find(isCreateVenv);
		expect(create?.args[4]).toContain(".staging-");
		expect(listStaging(options.root, PYTHON_RUNTIME_ID)).toEqual([]);
		expect(readCurrent(options.root, PYTHON_RUNTIME_ID)).toBe(PYTHON_RUNTIME_VERSION);
	});

	it("旧 venv 的显式迁入：重置把实例装进托管根，旧目录保留（不静默丢弃）", async () => {
		const options = optionsFor("migrate");
		const legacy = join(options.homeDir, ".venv-html-to-docx");
		mkdirSync(legacy, { recursive: true });

		const reset = await resetPythonRuntime(options, readyScenario().spawn);
		expect(reset.status).toBe("ready");
		expect(ready(reset).venvDir).toBe(VENV(options));
		expect(readCurrent(options.root, PYTHON_RUNTIME_ID)).toBe(PYTHON_RUNTIME_VERSION);
		expect(existsSync(legacy)).toBe(true);
		expect(resolvePythonVenv(options).source).toBe("managed");
	});

	it("覆盖口下重置只就地重建，不往托管根写任何东西", async () => {
		const opsVenv = join(TMP, "ops-reset", "venv");
		const options = optionsFor("override-reset", { env: { [VENV_OVERRIDE_ENV]: opsVenv } });
		const { calls, spawn } = readyScenario();
		const reset = await resetPythonRuntime(options, spawn);

		expect(reset.status).toBe("ready");
		expect(ready(reset).venvDir).toBe(opsVenv);
		expect(readCurrent(options.root, PYTHON_RUNTIME_ID)).toBeUndefined();
		// 覆盖口下就地重建：没有任何一步落到托管根的暂存目录。
		expect(calls.some((call) => call.args.join("\n").includes(".staging-"))).toBe(false);
	});
});

/* ── 诊断与既有语义 ──────────────────────────────────────────────── */

describe("诊断报告", () => {
	it("缺依赖能指名到具体模块，最近一次失败来自落盘日志，且给出可执行下一步", async () => {
		const options = optionsFor("diagnostics");
		appendRuntimeEvent(createPythonRuntime(options), {
			kind: "runtime_install",
			outcome: "failed",
			phase: "install-deps",
			error: "依赖安装失败：连接被拒绝",
		});

		const { spawn } = scripted([
			[isVenvVersion, ok({ stdout: "Python 3.12.4" })],
			[isDepsProbe, ok({ stdout: '{"missing": "lxml"}' })],
		]);
		const report = await pythonRuntimeDiagnostics(options, spawn);

		expect(report.status).toEqual({ kind: "deps-missing", module: "lxml" });
		expect(report.lastFailure).toEqual({ phase: "install-deps", error: "依赖安装失败：连接被拒绝" });

		const text = renderRuntimeDiagnostics(report);
		expect(text).toContain("lxml"); // 缺失项
		expect(text).toContain(PYTHON_RUNTIME_VERSION); // 版本
		expect(text).toContain(VENV(options)); // 路径
		expect(text).toContain("install-deps"); // 最近一次失败
		expect(text).toContain("可执行的下一步");
		expect(text).toContain("UV_INDEX_URL"); // 无外网/私有化的兜底引导
		expect(report.logPath).toContain(PYTHON_RUNTIME_ID); // 落盘日志的位置
		expect(existsSync(report.logPath)).toBe(true);
	});

	it("版本不符也能指名（wrong-version 带当前版本）", async () => {
		const options = optionsFor("diagnostics-version");
		const { spawn } = scripted([[isVenvVersion, ok({ stdout: "Python 3.11.9" })]]);
		const report = await pythonRuntimeDiagnostics(options, spawn);

		expect(report.status).toEqual({ kind: "wrong-version", version: "3.11.9" });
		expect(renderRuntimeDiagnostics(report)).toContain("3.11.9");
	});
});

describe("既有语义保留（迁移不得改行为）", () => {
	it("四态类型与 IPC payload（DocxEnvStatus）同形", async () => {
		const options = optionsFor("ipc-shape");
		const { spawn } = scripted([
			[isVenvVersion, ok({ stdout: "Python 3.12.4" })],
			[isDepsProbe, ok({ stdout: '{"missing": "bs4"}' })],
		]);
		// 结构兼容：inspectPythonRuntime 的产出可直接当 IPC payload 用（不需要转换层）。
		const status: DocxEnvStatus = await inspectPythonRuntime(options, spawn);
		expect(status).toEqual({ kind: "deps-missing", module: "bs4" });
	});

	it("uv 缺失仍是 env-not-ready + probe-uv 归因（错误分类一字不改）", async () => {
		const options = optionsFor("uv-missing");
		const { spawn } = scripted([[isUvVersion, notFound()]]);
		// 装的时候才会碰到 uv（ensure 只探不装，不会再走到这里）。
		const failed = await installPythonRuntime(options, spawn);

		expect(failed.status).toBe("failed");
		if (failed.status !== "failed") throw new Error("unreachable");
		expect(failed.phase).toBe("probe-uv");
		expect(failed.error).toContain("uv");

		const classified = classifyEnsureError(failed);
		expect(classified.kind).toBe("env-not-ready");
		expect(classified.message).toContain("Markdown");
		expect(readCurrent(options.root, PYTHON_RUNTIME_ID)).toBeUndefined();
	});
});
