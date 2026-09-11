/**
 * docx 托管环境状态机的测试。
 *
 * 机制照抄 WB setup-html-to-docx.sh，测试即「逐步对照」的护栏：
 * 每个用例对应脚本里的一段（uv 探测 → python 3.12 → venv → 依赖冒烟补装 → 引擎冒烟）。
 * spawn 全部 fake，不真装 Python —— documents/ 不许 import pi/electron 的理由
 * 就是这一层要能脱离宿主单测（AGENTS.md §1）。
 */

import { join, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import {
	createEnvContext,
	ensureDocxEnv,
	initialEnvState,
	inspectVenv,
	nextStep,
	parsePythonVersion,
	reduce,
	uvCandidates,
	venvPython,
	type EnvContext,
	type SpawnFn,
	type SpawnOutcome,
	type SpawnRequest,
} from "./docx-env.ts";

const HOME = resolve(sep, "users", "foo");
const ENGINE = resolve(sep, "app", "resources", "docx-engine");
/** 平台注入 win32：Windows 布局（Scripts/python.exe）是目标平台，钉死它。 */
const CTX: EnvContext = createEnvContext(ENGINE, HOME, "win32");

const VENV_PY = venvPython(CTX);
const UV_LOCAL = join(HOME, ".local", "bin", "uv.exe");

function ok(outcome: Partial<SpawnOutcome> = {}): SpawnOutcome {
	return { code: 0, stdout: "", stderr: "", ...outcome };
}

function notFound(): SpawnOutcome {
	return { code: null, stdout: "", stderr: "", error: "spawn ENOENT" };
}

/** 编排式 fake spawn：按请求特征匹配分支；未编排的请求直接炸（状态机走偏会立刻暴露）。 */
function scripted(
	branches: ReadonlyArray<
		readonly [(req: SpawnRequest) => boolean, SpawnOutcome | ((req: SpawnRequest) => SpawnOutcome)]
	>,
): { calls: SpawnRequest[]; spawn: SpawnFn } {
	const calls: SpawnRequest[] = [];
	const spawn: SpawnFn = (req) => {
		calls.push(req);
		for (const [when, outcome] of branches) {
			if (when(req)) {
				return Promise.resolve(typeof outcome === "function" ? outcome(req) : outcome);
			}
		}
		return Promise.reject(new Error(`未编排的 spawn: ${req.command} ${req.args.join(" ")}`));
	};
	return { calls, spawn };
}

/* ── 请求特征匹配器（按状态机各相位的 spawn 形状） ────────────────── */

const isUvVersion = (req: SpawnRequest): boolean =>
	req.args.length === 1 && req.args[0] === "--version" && req.command !== VENV_PY;
const isPythonFind = (req: SpawnRequest): boolean =>
	req.args[0] === "python" && req.args[1] === "find";
const isPythonInstall = (req: SpawnRequest): boolean =>
	req.args[0] === "python" && req.args[1] === "install";
const isVenvVersion = (req: SpawnRequest): boolean =>
	req.command === VENV_PY && req.args.length === 1 && req.args[0] === "--version";
const isDepsProbe = (req: SpawnRequest): boolean =>
	req.command === VENV_PY && req.args[0] === "-c" && String(req.args[1]).includes("importlib");
const isEngineSmoke = (req: SpawnRequest): boolean =>
	req.command === VENV_PY && req.args[0] === "-c" && String(req.args[1]).includes("html_to_docx");
const isCreateVenv = (req: SpawnRequest): boolean => req.args[0] === "venv";
const isInstallDeps = (req: SpawnRequest): boolean => req.args[0] === "pip";

/** 「全部就绪」编排：5 次探测即 ready（幂等 ensure 秒退路径）。 */
function allReady(): ReturnType<typeof scripted> {
	return scripted([
		[isUvVersion, ok({ stdout: "uv 0.11.28" })],
		[isPythonFind, ok({ stdout: String(join(HOME, "py", "3.12", "python.exe")) })],
		[isVenvVersion, ok({ stdout: "Python 3.12.4" })],
		[isDepsProbe, ok({ stdout: '{"missing": null}\n' })],
		[isEngineSmoke, ok()],
	]);
}

describe("路径布局（Windows）", () => {
	it("venv 解释器是 Scripts/python.exe（不是 posix 的 bin/python）", () => {
		expect(VENV_PY).toBe(join(HOME, ".venv-html-to-docx", "Scripts", "python.exe"));
	});

	it("posix 布局是 bin/python", () => {
		const posix = venvPython(createEnvContext(ENGINE, HOME, "linux"));
		expect(posix).toBe(join(HOME, ".venv-html-to-docx", "bin", "python"));
	});

	it("uv 候选顺序：PATH（裸 uv）→ ~/.local/bin/uv.exe", () => {
		expect(uvCandidates(CTX)).toEqual(["uv", UV_LOCAL]);
	});
});

describe("parsePythonVersion", () => {
	it("解析 stdout / stderr 两种来源", () => {
		expect(parsePythonVersion("Python 3.12.4")).toBe("3.12.4");
		expect(parsePythonVersion("Python 3.11.9\n")).toBe("3.11.9");
		expect(parsePythonVersion("不是版本输出")).toBeUndefined();
	});
});

describe("ensure 状态机迁移", () => {
	it("全部就绪：5 次探测秒退，不触发任何安装", async () => {
		const { calls, spawn } = allReady();
		const result = await ensureDocxEnv(CTX, spawn);

		expect(result).toEqual({
			status: "ready",
			python: VENV_PY,
			venvDir: join(HOME, ".venv-html-to-docx"),
		});
		expect(calls).toHaveLength(5);
		expect(calls.every((c) => !isPythonInstall(c) && !isCreateVenv(c) && !isInstallDeps(c))).toBe(true);
	});

	it("PATH 与 ~/.local/bin 都没有 uv → failed，错误带安装引导", async () => {
		const { calls, spawn } = scripted([[isUvVersion, notFound()]]);
		const result = await ensureDocxEnv(CTX, spawn);

		expect(result.status).toBe("failed");
		if (result.status !== "failed") throw new Error("unreachable");
		expect(result.phase).toBe("probe-uv");
		expect(result.error).toContain("uv");
		expect(result.error).toContain(".local");
		// 两个候选各试一次，不多不少。
		expect(calls).toHaveLength(2);
	});

	it("uv 只在 ~/.local/bin：第二个候选命中，后续 uv 命令全用它", async () => {
		const { calls, spawn } = scripted([
			[(req) => isUvVersion(req) && req.command === "uv", notFound()],
			[(req) => isUvVersion(req) && req.command === UV_LOCAL, ok()],
			[isPythonFind, ok()],
			[isVenvVersion, ok({ stdout: "Python 3.12.4" })],
			[isDepsProbe, ok({ stdout: '{"missing": null}' })],
			[isEngineSmoke, ok()],
		]);
		const result = await ensureDocxEnv(CTX, spawn);

		expect(result.status).toBe("ready");
		const uvCalls = calls.filter((c) => isPythonFind(c) || isCreateVenv(c) || isInstallDeps(c));
		expect(uvCalls.length).toBeGreaterThan(0);
		expect(uvCalls.every((c) => c.command === UV_LOCAL)).toBe(true);
	});

	it("缺 Python 3.12：find 失败 → uv python install 3.12 → 继续", async () => {
		const { calls, spawn } = scripted([
			[isUvVersion, ok()],
			[isPythonFind, { code: 1, stdout: "", stderr: "no interpreter found" }],
			[isPythonInstall, ok()],
			[isVenvVersion, ok({ stdout: "Python 3.12.4" })],
			[isDepsProbe, ok({ stdout: '{"missing": null}' })],
			[isEngineSmoke, ok()],
		]);
		const result = await ensureDocxEnv(CTX, spawn);

		expect(result.status).toBe("ready");
		const install = calls.find(isPythonInstall);
		expect(install?.args).toEqual(["python", "install", "3.12"]);
	});

	it("Python 安装失败 → failed，错误带 UV_PYTHON_INSTALL_MIRROR 引导", async () => {
		const { spawn } = scripted([
			[isUvVersion, ok()],
			[isPythonFind, { code: 1, stdout: "", stderr: "" }],
			[isPythonInstall, { code: 1, stdout: "", stderr: "network unreachable" }],
		]);
		const result = await ensureDocxEnv(CTX, spawn);

		expect(result.status).toBe("failed");
		if (result.status !== "failed") throw new Error("unreachable");
		expect(result.phase).toBe("install-python");
		expect(result.error).toContain("UV_PYTHON_INSTALL_MIRROR");
	});

	it("venv 不存在（解释器起不来）→ --clear 重建", async () => {
		const { calls, spawn } = scripted([
			[isUvVersion, ok()],
			[isPythonFind, ok()],
			[isVenvVersion, notFound()],
			[isCreateVenv, ok()],
			[isDepsProbe, ok({ stdout: '{"missing": null}' })],
			[isEngineSmoke, ok()],
		]);
		const result = await ensureDocxEnv(CTX, spawn);

		expect(result.status).toBe("ready");
		const create = calls.find(isCreateVenv);
		expect(create?.args).toEqual([
			"venv",
			"--python",
			"3.12",
			"--clear",
			join(HOME, ".venv-html-to-docx"),
		]);
	});

	it("venv 版本不符（3.11）→ 重建（WB 的 rm -rf + uv venv 对应 --clear）", async () => {
		const { calls, spawn } = scripted([
			[isUvVersion, ok()],
			[isPythonFind, ok()],
			[isVenvVersion, ok({ stdout: "Python 3.11.9" })],
			[isCreateVenv, ok()],
			[isDepsProbe, ok({ stdout: '{"missing": null}' })],
			[isEngineSmoke, ok()],
		]);
		const result = await ensureDocxEnv(CTX, spawn);

		expect(result.status).toBe("ready");
		expect(calls.some(isCreateVenv)).toBe(true);
	});

	it("缺依赖：逐个冒烟命中缺失 → --only-binary 补装 → 复烟 → ready", async () => {
		let probeCount = 0;
		const { calls, spawn } = scripted([
			[isUvVersion, ok()],
			[isPythonFind, ok()],
			[isVenvVersion, ok({ stdout: "Python 3.12.4" })],
			[
				isDepsProbe,
				// 第一次缺 lxml，补装后复烟通过。
				() => {
					probeCount += 1;
					return probeCount === 1
						? ok({ stdout: '{"missing": "lxml"}' })
						: ok({ stdout: '{"missing": null}' });
				},
			],
			[isInstallDeps, ok()],
			[isEngineSmoke, ok()],
		]);
		const result = await ensureDocxEnv(CTX, spawn);

		expect(result.status).toBe("ready");
		expect(probeCount).toBe(2);
		const install = calls.find(isInstallDeps);
		// 固化 --only-binary=:all: 的理由：lxml 无 wheel 时源码编译必败（WB 踩坑）。
		expect(install?.args).toEqual([
			"pip",
			"install",
			"--python",
			VENV_PY,
			"--only-binary=:all:",
			"-r",
			join(ENGINE, "requirements.txt"),
		]);
	});

	it("装完一轮仍缺依赖 → failed（不死循环）", async () => {
		const { calls, spawn } = scripted([
			[isUvVersion, ok()],
			[isPythonFind, ok()],
			[isVenvVersion, ok({ stdout: "Python 3.12.4" })],
			[isDepsProbe, ok({ stdout: '{"missing": "PIL"}' })],
			[isInstallDeps, ok()],
			[isEngineSmoke, ok()],
		]);
		const result = await ensureDocxEnv(CTX, spawn);

		expect(result.status).toBe("failed");
		if (result.status !== "failed") throw new Error("unreachable");
		expect(result.phase).toBe("smoke-deps");
		expect(result.error).toContain("PIL");
		// 只装一轮：install-deps 恰好出现一次。
		expect(calls.filter(isInstallDeps)).toHaveLength(1);
	});

	it("依赖安装失败 → failed，错误带 UV_INDEX_URL 镜像引导", async () => {
		const { spawn } = scripted([
			[isUvVersion, ok()],
			[isPythonFind, ok()],
			[isVenvVersion, ok({ stdout: "Python 3.12.4" })],
			[isDepsProbe, ok({ stdout: '{"missing": "httpx"}' })],
			[isInstallDeps, { code: 1, stdout: "", stderr: "connection refused" }],
		]);
		const result = await ensureDocxEnv(CTX, spawn);

		expect(result.status).toBe("failed");
		if (result.status !== "failed") throw new Error("unreachable");
		expect(result.phase).toBe("install-deps");
		expect(result.error).toContain("UV_INDEX_URL");
	});

	it("引擎冒烟：PYTHONPATH 指向引擎目录；失败 → failed 归因 smoke-engine", async () => {
		const failing = scripted([
			[isUvVersion, ok()],
			[isPythonFind, ok()],
			[isVenvVersion, ok({ stdout: "Python 3.12.4" })],
			[isDepsProbe, ok({ stdout: '{"missing": null}' })],
			[isEngineSmoke, { code: 1, stdout: "", stderr: "ModuleNotFoundError: html_to_docx" }],
		]);
		const result = await ensureDocxEnv(CTX, failing.spawn);

		expect(result.status).toBe("failed");
		if (result.status !== "failed") throw new Error("unreachable");
		expect(result.phase).toBe("smoke-engine");
		expect(result.error).toContain("html_to_docx");

		const smoke = failing.calls.find(isEngineSmoke);
		expect(smoke?.env?.["PYTHONPATH"]).toBe(ENGINE);
	});

	it("终态不再产生动作：ready / failed 的 nextStep 都是 null", () => {
		expect(nextStep({ phase: "ready" }, CTX)).toBeNull();
		expect(nextStep({ phase: "failed", error: "x" }, CTX)).toBeNull();
		// 初始态第一步是 uv 探测。
		const first = nextStep(initialEnvState(), CTX);
		expect(first).toEqual({ command: "uv", args: ["--version"] });
	});

	it("reduce 幂等保护：终态喂结果原地不动", () => {
		const ready = reduce({ phase: "ready" }, ok(), CTX);
		expect(ready.phase).toBe("ready");
	});
});

describe("inspectVenv 四态（只探测）", () => {
	it("解释器起不来 → missing", async () => {
		const { spawn } = scripted([[isVenvVersion, notFound()]]);
		await expect(inspectVenv(CTX, spawn)).resolves.toEqual({ kind: "missing" });
	});

	it("非 3.12 → wrong-version（带当前版本）", async () => {
		const { spawn } = scripted([[isVenvVersion, ok({ stdout: "Python 3.11.9" })]]);
		await expect(inspectVenv(CTX, spawn)).resolves.toEqual({
			kind: "wrong-version",
			version: "3.11.9",
		});
	});

	it("缺依赖 → deps-missing（带第一个缺失模块）", async () => {
		const { spawn } = scripted([
			[isVenvVersion, ok({ stdout: "Python 3.12.4" })],
			[isDepsProbe, ok({ stdout: '{"missing": "bs4"}' })],
		]);
		await expect(inspectVenv(CTX, spawn)).resolves.toEqual({
			kind: "deps-missing",
			module: "bs4",
		});
	});

	it("全部正常 → ready", async () => {
		const { spawn } = scripted([
			[isVenvVersion, ok({ stdout: "Python 3.12.4" })],
			[isDepsProbe, ok({ stdout: '{"missing": null}' })],
		]);
		await expect(inspectVenv(CTX, spawn)).resolves.toEqual({ kind: "ready" });
	});
});
