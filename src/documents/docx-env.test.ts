/**
 * docx 托管环境状态机（九相位）的纯函数测试。
 *
 * 机制照抄 WB setup-html-to-docx.sh，测试即「逐步对照」的护栏：
 * 每个用例对应脚本里的一段（uv 探测 → python 3.12 → venv → 依赖冒烟补装 → 引擎冒烟）。
 * spawn 全部 fake，不真装 Python —— documents/ 不许 import pi/electron 的理由
 * 就是这一层要能脱离宿主单测（AGENTS.md §1）。
 *
 * 驱动说明：本文件用下面的 `drivePhases` 直接跑 `nextStep` / `reduce`（纯函数逐相位），
 * 所以 venv 路径可以钉成确定值、逐条断言「这一步会 spawn 什么」。**生产驱动**是
 * core/runtimes/machine.ts 的 driveRuntimeMachine（由 core/runtimes/registry.ts 调用），
 * 端到端（真实入口 + 托管根 + 假 spawn）的覆盖在 core/runtimes/python.test.ts ——
 * 两处分工：这里管「相位表对不对」，那边管「装配链路通不通」。
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	createEnvContext,
	initialEnvState,
	inspectVenv,
	looksLikeEngineVenv,
	nextStep,
	parsePythonVersion,
	reduce,
	uvCandidates,
	venvPython,
	venvPythonPath,
	type EnvContext,
	type EnvState,
	type SpawnFn,
	type SpawnOutcome,
	type SpawnRequest,
} from "./docx-env.ts";

const HOME = resolve(sep, "users", "foo");
const ENGINE = resolve(sep, "app", "resources", "docx-engine");
/** 注入的 venv 落点（生产由 core/runtimes/python.ts 的 resolvePythonVenv 给出）。 */
const VENV = resolve(sep, "config", "runtimes", "python", "3.12", "venv");
/** 平台注入 win32：Windows 布局（Scripts/python.exe）是目标平台，钉死它。 */
const CTX: EnvContext = createEnvContext(ENGINE, HOME, "win32", VENV);

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

/** 逐相位跑完状态机（纯函数驱动；生产驱动见文件头说明）。 */
async function drivePhases(ctx: EnvContext, spawnFn: SpawnFn): Promise<EnvState> {
	let state: EnvState = initialEnvState();
	for (let step = 0; step < 40; step += 1) {
		const request = nextStep(state, ctx);
		if (request === null) break;
		state = reduce(state, await spawnFn(request), ctx);
	}
	return state;
}

describe("路径布局（Windows）", () => {
	it("venv 解释器是 Scripts/python.exe（不是 posix 的 bin/python）", () => {
		expect(VENV_PY).toBe(join(VENV, "Scripts", "python.exe"));
	});

	it("posix 布局是 bin/python", () => {
		expect(venvPythonPath(VENV, "linux")).toBe(join(VENV, "bin", "python"));
	});

	it("venv 落点是注入值：本层不再读 HTML_TO_DOCX_VENV（判据已收归托管运行时）", () => {
		const previous = process.env["HTML_TO_DOCX_VENV"];
		process.env["HTML_TO_DOCX_VENV"] = resolve(sep, "elsewhere", "venv");
		try {
			// 环境变量再怎么设，本层的取值都只来自 ctx.venvDir（唯一真源在 core/runtimes/python.ts）。
			expect(venvPython(createEnvContext(ENGINE, HOME, "win32", VENV))).toBe(
				join(VENV, "Scripts", "python.exe"),
			);
		} finally {
			if (previous === undefined) delete process.env["HTML_TO_DOCX_VENV"];
			else process.env["HTML_TO_DOCX_VENV"] = previous;
		}
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

describe("ensure 状态机迁移（九相位）", () => {
	it("全部就绪：5 次探测秒退，不触发任何安装", async () => {
		const { calls, spawn } = allReady();
		const state = await drivePhases(CTX, spawn);

		expect(state.phase).toBe("ready");
		expect(calls).toHaveLength(5);
		expect(calls.every((c) => !isPythonInstall(c) && !isCreateVenv(c) && !isInstallDeps(c))).toBe(true);
	});

	it("PATH 与 ~/.local/bin 都没有 uv → failed，错误带安装引导", async () => {
		const { calls, spawn } = scripted([[isUvVersion, notFound()]]);
		const state = await drivePhases(CTX, spawn);

		expect(state.phase).toBe("failed");
		expect(state.failedAt).toBe("probe-uv");
		expect(state.error).toContain("uv");
		expect(state.error).toContain(".local");
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
		const state = await drivePhases(CTX, spawn);

		expect(state.phase).toBe("ready");
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
		const state = await drivePhases(CTX, spawn);

		expect(state.phase).toBe("ready");
		const install = calls.find(isPythonInstall);
		expect(install?.args).toEqual(["python", "install", "3.12"]);
	});

	it("Python 安装失败 → failed，错误带 UV_PYTHON_INSTALL_MIRROR 引导", async () => {
		const { spawn } = scripted([
			[isUvVersion, ok()],
			[isPythonFind, { code: 1, stdout: "", stderr: "" }],
			[isPythonInstall, { code: 1, stdout: "", stderr: "network unreachable" }],
		]);
		const state = await drivePhases(CTX, spawn);

		expect(state.phase).toBe("failed");
		expect(state.failedAt).toBe("install-python");
		expect(state.error).toContain("UV_PYTHON_INSTALL_MIRROR");
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
		const state = await drivePhases(CTX, spawn);

		expect(state.phase).toBe("ready");
		const create = calls.find(isCreateVenv);
		expect(create?.args).toEqual(["venv", "--python", "3.12", "--clear", VENV]);
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
		const state = await drivePhases(CTX, spawn);

		expect(state.phase).toBe("ready");
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
		const state = await drivePhases(CTX, spawn);

		expect(state.phase).toBe("ready");
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
		const state = await drivePhases(CTX, spawn);

		expect(state.phase).toBe("failed");
		expect(state.failedAt).toBe("smoke-deps");
		expect(state.error).toContain("PIL");
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
		const state = await drivePhases(CTX, spawn);

		expect(state.phase).toBe("failed");
		expect(state.failedAt).toBe("install-deps");
		expect(state.error).toContain("UV_INDEX_URL");
	});

	it("引擎冒烟：PYTHONPATH 指向引擎目录；失败 → failed 归因 smoke-engine", async () => {
		const failing = scripted([
			[isUvVersion, ok()],
			[isPythonFind, ok()],
			[isVenvVersion, ok({ stdout: "Python 3.12.4" })],
			[isDepsProbe, ok({ stdout: '{"missing": null}' })],
			[isEngineSmoke, { code: 1, stdout: "", stderr: "ModuleNotFoundError: html_to_docx" }],
		]);
		const state = await drivePhases(CTX, failing.spawn);

		expect(state.phase).toBe("failed");
		expect(state.failedAt).toBe("smoke-engine");
		expect(state.error).toContain("html_to_docx");

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

/**
 * 浅判据（只读 fs、不 spawn）：它挡的是「空壳 venv 被当成可复用的旧环境」——
 * 2026-09-19 实测的现场就是 `~/.venv-html-to-docx` 里只有 `_virtualenv.py`，
 * 而落点解析只判「目录存在」，于是「没装」被说成「已安装但缺 docx」。
 * 钉两条边界：**空壳必须被否决**、**有一项依赖就不许越权否决**（交深度探测）。
 */
describe("looksLikeEngineVenv（浅判据：只做一票否决）", () => {
	let root = "";
	beforeAll(() => {
		root = mkdtempSync(join(tmpdir(), "kami-docx-venv-"));
	});
	afterAll(() => {
		rmSync(root, { recursive: true, force: true });
	});

	/** 造一份 venv 骨架 + 指定名字的顶层模块（目录形态或单文件形态）。 */
	function venvWith(name: string, layout: "win32" | "posix", form: "dir" | "file"): string {
		const venv = join(root, `${name}-${layout}-${form}`);
		const sitePackages =
			layout === "win32"
				? join(venv, "Lib", "site-packages")
				: join(venv, "lib", "python3.12", "site-packages");
		mkdirSync(sitePackages, { recursive: true });
		if (name !== "") {
			if (form === "dir") mkdirSync(join(sitePackages, name), { recursive: true });
			else writeFileSync(join(sitePackages, `${name}.py`), "", "utf8");
		}
		return venv;
	}

	it("空壳 venv（uv 建过、依赖一个没装成）→ 不像：这就是「未安装」而不是「就绪」", () => {
		expect(looksLikeEngineVenv(venvWith("", "win32", "dir"), "win32")).toBe(false);
	});

	it("一个引擎依赖都没装的 site-packages → 不像", () => {
		// 别人的 venv：有第三方包，但没有一个是我们的引擎依赖。
		const venv = venvWith("numpy", "win32", "dir");
		expect(looksLikeEngineVenv(venv, "win32")).toBe(false);
	});

	it("装了任一引擎依赖 → 像（放行给深度探测，浅判据不替它背书）", () => {
		expect(looksLikeEngineVenv(venvWith("docx", "win32", "dir"), "win32")).toBe(true);
		// 单文件形态的模块也算（不为打包形态误杀，否则会错杀一份能用的旧 venv）。
		expect(looksLikeEngineVenv(venvWith("bs4", "win32", "file"), "win32")).toBe(true);
	});

	it("posix 布局（lib/python3.12/site-packages）同样认", () => {
		expect(looksLikeEngineVenv(venvWith("lxml", "posix", "dir"), "posix")).toBe(true);
	});

	it("目录根本不存在 → 不像（不做任何写入）", () => {
		expect(looksLikeEngineVenv(join(root, "nope"), "win32")).toBe(false);
	});
});
