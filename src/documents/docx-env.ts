/**
 * docx 引擎托管环境：~/.venv-html-to-docx 的探测与幂等 ensure。
 *
 * 机制照抄 WorkBuddy 的 setup-html-to-docx.sh
 * （证据：插件 scripts/wb/local/setup-html-to-docx.sh，逆向笔记 docs/workbuddy分析/）。
 * bash 脚本在 Windows 不能裸跑，所以**机制照抄、实现走 TS spawn uv**：
 *
 *   uv 探测（PATH → ~/.local/bin，都没有则报错引导，不像 WB 那样 curl|sh 装 uv ——
 *     Windows 目标用户没有 bash，且 curl 下载执行与我们的危险命令防线相悖；
 *     私有化环境按 WB 同款约定预置 uv 到 ~/.local/bin 即可）
 *   → uv python find 3.12（失败则 uv python install 3.12，拉独立发行版，
 *     固化 3.12 是绕开 lxml 在新 Python 上无 wheel 需源码编译的坑 —— WB 脚本头注释）
 *   → venv 缺失或版本不符就重建（WB 是 rm -rf + uv venv，我们用 uv venv --clear，
 *     已实测该标志存在）
 *   → 依赖冒烟（docx/html4docx/bs4/lxml/httpx/PIL/click，任一缺失即装 ——
 *     WB 清单里的 `htmldocx` 是笔误，真实模块名 html4docx，见 DEPS_PROBE 注释），
 *     装的时候 --only-binary=:all: 强制只用 wheel（同一个 lxml 坑）
 *   → 引擎包 import 冒烟（PYTHONPATH=resources/docx-engine）
 *
 * 为什么状态机是纯函数 + spawn 注入：documents/ 不许 import pi/electron
 * （AGENTS.md §1），这一层是我们最重的模块，测试是 AI 写它时唯一的护栏 ——
 * 全部迁移都能用 fake spawn 在单测里跑完，不需要真装 Python。
 *
 * 与 agent shell 能力的关系：ensure/convert 都是 daemon 进程内受控 spawn
 * （命令与参数全部写死在本文件，模型只能给 HTML 输入与产物路径），
 * 不等于把 shell 暴露给 agent —— 模型经 powershell 自由 shell 调 python/uv
 * 是明确禁止的（spec Requirement: 转换调用受控）。
 */

import { spawn } from "node:child_process";
import { join } from "node:path";
import type { DocxEnvStatus } from "../shared/ipc.ts";

/* ── spawn 抽象（测试注入点） ─────────────────────────────────────── */

export interface SpawnRequest {
	readonly command: string;
	readonly args: readonly string[];
	/** 追加进子进程的环境变量（与 process.env 合并）。 */
	readonly env?: Record<string, string>;
	readonly cwd?: string;
}

export interface SpawnOutcome {
	/** 进程退出码；null = 进程没能启动（ENOENT 等，error 带原因）。 */
	readonly code: number | null;
	readonly stdout: string;
	readonly stderr: string;
	readonly error?: string;
}

export type SpawnFn = (req: SpawnRequest) => Promise<SpawnOutcome>;

/**
 * 生产 spawn：静默执行（不弹控制台窗口、不过 cmd）。
 *
 * error 事件（命令不存在等）不归 reject 而归 code:null 的正常 outcome ——
 * 状态机把「命令不存在」当普通分支处理（uv 探测就是靠这个逐个试候选的），
 * reject 会把控制流搞成两套。
 */
export function defaultSpawn(req: SpawnRequest): Promise<SpawnOutcome> {
	return new Promise((resolvePromise) => {
		const child = spawn(req.command, [...req.args], {
			cwd: req.cwd,
			env: req.env === undefined ? process.env : { ...process.env, ...req.env },
			// daemon 是不可见后台进程，子进程弹控制台窗口会吓到用户。
			windowsHide: true,
			shell: false,
		});
		let stdout = "";
		let stderr = "";
		let settled = false;
		const settle = (outcome: SpawnOutcome): void => {
			if (settled) return; // error 与 close 可能都触发（ENOENT 时先 error 后 close）
			settled = true;
			resolvePromise(outcome);
		};
		child.stdout.setEncoding("utf8").on("data", (d: string) => {
			stdout += d;
		});
		child.stderr.setEncoding("utf8").on("data", (d: string) => {
			stderr += d;
		});
		child.on("error", (err) => {
			settle({ code: null, stdout, stderr, error: err.message });
		});
		child.on("close", (code) => {
			settle({ code, stdout, stderr });
		});
	});
}

/* ── 路径与候选（Windows 布局：Scripts/python.exe） ─────────────────── */

export interface EnvContext {
	/** 引擎目录（resources/docx-engine）：html_to_docx 包与 requirements.txt 所在处。 */
	readonly engineDir: string;
	readonly homeDir: string;
	/** process.platform；注入是为了让 Windows 布局在测试里可断言。 */
	readonly platform: string;
}

export function createEnvContext(
	engineDir: string,
	homeDir: string,
	platform: string,
): EnvContext {
	return { engineDir, homeDir, platform };
}

/** venv 根。可用 HTML_TO_DOCX_VENV 覆盖（WB 脚本同款 env，私有化预置环境用）。 */
export function venvDir(ctx: EnvContext): string {
	const override = process.env["HTML_TO_DOCX_VENV"];
	return override !== undefined && override !== ""
		? override
		: join(ctx.homeDir, ".venv-html-to-docx");
}

/** venv 解释器。Windows 布局是 Scripts/python.exe，posix 是 bin/python。 */
export function venvPython(ctx: EnvContext): string {
	return ctx.platform === "win32"
		? join(venvDir(ctx), "Scripts", "python.exe")
		: join(venvDir(ctx), "bin", "python");
}

/**
 * uv 候选，按 WB 脚本同款顺序试：PATH（直接以 "uv" spawn）→ ~/.local/bin。
 * 都没有就报错引导 —— 不像 WB 那样 curl|sh 现装（Windows 无 bash，
 * 且下载执行与我们的危险命令防线相悖；私有化环境按 WB 约定预置到 ~/.local/bin）。
 */
export function uvCandidates(ctx: EnvContext): readonly string[] {
	return [
		"uv",
		join(ctx.homeDir, ".local", "bin", ctx.platform === "win32" ? "uv.exe" : "uv"),
	];
}

/* ── 依赖冒烟探针 ─────────────────────────────────────────────────── */

/**
 * 逐个 import 冒烟，输出第一个缺失模块的 JSON（{"missing": "lxml"} 或 {"missing": null}）。
 *
 * WB 脚本是 shell 循环逐个试、7 次进程启动；我们用一条 python -c 完成同样的
 * 逐个判定 —— ensure 在每次转换前都会幂等重跑，省 6 次进程启动是实打实的等待。
 *
 * 【对 WB 脚本的一处修正】WB 冒烟清单写的是 `htmldocx`，但 html-for-docx
 * （requirements.txt 钉的 >=1.1）的真实模块名是 `html4docx`
 * （引擎 converter.py:30 `from html4docx import HtmlToDocx`，site-packages
 * 目录实测也是 html4docx/）。`import htmldocx` 永远失败 —— 所以 WB 脚本每次
 * 运行都在白白重装依赖。这里按真实模块名探测，冒烟才有「已就绪秒退」的语义。
 */
const DEPS_PROBE = `import importlib, json
missing = None
for m in ("docx", "html4docx", "bs4", "lxml", "httpx", "PIL", "click"):
    try:
        importlib.import_module(m)
    except Exception:
        missing = m
        break
print(json.dumps({"missing": missing}))`;

/** 从 `python --version` 输出（stdout 或 stderr）解析 "3.12.4" 这样的版本串。 */
export function parsePythonVersion(output: string): string | undefined {
	const match = /Python (\d+\.\d+\.\d+)/.exec(output);
	return match?.[1];
}

/* ── 状态机（纯函数） ─────────────────────────────────────────────── */

export type EnvPhase =
	| "probe-uv"
	| "probe-python"
	| "install-python"
	| "probe-venv"
	| "create-venv"
	| "smoke-deps"
	| "install-deps"
	| "smoke-engine"
	| "ready"
	| "failed";

export interface EnvState {
	readonly phase: EnvPhase;
	/** 探测成功的 uv 可执行文件（probe-uv 之后必有）。 */
	readonly uv?: string;
	/** 正在试的 uv 候选下标。 */
	readonly uvIndex?: number;
	/** 依赖已装过一轮（防 install-deps → smoke-deps 死循环：装完还缺即失败）。 */
	readonly depsInstallAttempted?: boolean;
	/** 失败发生时的相位（phase === "failed" 时必有；失败归因，排障按它找步骤）。 */
	readonly failedAt?: EnvPhase;
	/** 失败原因（phase === "failed" 时必有）。 */
	readonly error?: string;
}

export function initialEnvState(): EnvState {
	return { phase: "probe-uv", uvIndex: 0 };
}

/**
 * 当前状态要做的下一件事。返回 null 表示到达终态（ready / failed）。
 * 纯函数：同样的 (state, ctx) 必得同样的 SpawnRequest。
 */
export function nextStep(state: EnvState, ctx: EnvContext): SpawnRequest | null {
	switch (state.phase) {
		case "probe-uv": {
			const candidate = uvCandidates(ctx)[state.uvIndex ?? 0];
			if (candidate === undefined) return null; // 不可达：越界前已转 failed，防御编译器
			return { command: candidate, args: ["--version"] };
		}
		case "probe-python":
			return { command: uvOf(state), args: ["python", "find", "3.12"] };
		case "install-python":
			return { command: uvOf(state), args: ["python", "install", "3.12"] };
		case "probe-venv":
			return { command: venvPython(ctx), args: ["--version"] };
		case "create-venv":
			// --clear 对应 WB 的 rm -rf 后重建（版本不符/损坏的 venv 直接清掉重来）。
			return { command: uvOf(state), args: ["venv", "--python", "3.12", "--clear", venvDir(ctx)] };
		case "smoke-deps":
			return { command: venvPython(ctx), args: ["-c", DEPS_PROBE] };
		case "install-deps":
			return {
				command: uvOf(state),
				args: [
					"pip",
					"install",
					"--python",
					venvPython(ctx),
					// 强制只用 wheel：lxml 在无 libxml2/libxslt 的机器上源码编译必败（WB 踩坑记录）。
					"--only-binary=:all:",
					"-r",
					join(ctx.engineDir, "requirements.txt"),
				],
			};
		case "smoke-engine":
			// PYTHONPATH 指向引擎目录：引擎包不 pip 安装，随应用分发（resources/docx-engine）。
			return {
				command: venvPython(ctx),
				args: ["-c", "import html_to_docx"],
				env: { PYTHONPATH: ctx.engineDir },
			};
		case "ready":
		case "failed":
			return null;
	}
}

function uvOf(state: EnvState): string {
	// probe-uv 成功后 uv 必有值；走到后续相位而没有 uv 是状态机 bug，让它响。
	if (state.uv === undefined) throw new Error(`状态机缺 uv（phase=${state.phase}）`);
	return state.uv;
}

/** stderr/stdout 摘要进错误消息：截断防一次失败糊掉整条日志。 */
function excerpt(text: string, max = 400): string {
	const trimmed = text.trim();
	return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`;
}

function succeeded(outcome: SpawnOutcome): boolean {
	return outcome.code === 0;
}

function fail(phase: EnvPhase, error: string): EnvState {
	return { phase: "failed", failedAt: phase, error };
}

/**
 * 状态迁移：喂入 nextStep 那次 spawn 的结果，得到下一个状态。
 * 纯函数；全部分支在 docx-env.test.ts 里有 fake spawn 覆盖。
 */
export function reduce(state: EnvState, outcome: SpawnOutcome, ctx: EnvContext): EnvState {
	switch (state.phase) {
		case "probe-uv": {
			const index = state.uvIndex ?? 0;
			if (succeeded(outcome)) {
				const uv = uvCandidates(ctx)[index];
				if (uv === undefined) return fail("probe-uv", "uv 候选下标越界（状态机 bug）");
				return { phase: "probe-python", uv };
			}
			// 逐个试候选（PATH → ~/.local/bin），都失败才报错引导。
			if (index + 1 < uvCandidates(ctx).length) return { phase: "probe-uv", uvIndex: index + 1 };
			return fail(
				"probe-uv",
				"未找到 uv（已尝试 PATH 与 ~/.local/bin）。" +
					"请先安装 uv（https://docs.astral.sh/uv/），或把 uv 可执行文件放到 ~/.local/bin/；" +
					"私有化环境请预置 uv 并配置 UV_INDEX_URL / UV_PYTHON_INSTALL_MIRROR 指向内网镜像。",
			);
		}
		case "probe-python":
			return succeeded(outcome) ? { ...state, phase: "probe-venv" } : { ...state, phase: "install-python" };
		case "install-python":
			return succeeded(outcome)
				? { ...state, phase: "probe-venv" }
				: fail(
						"install-python",
						`Python 3.12 安装失败：${excerpt(outcome.stderr)}。` +
							"首次安装需要外网（astral-sh/python-build-standalone）；私有化环境请配置 UV_PYTHON_INSTALL_MIRROR。",
					);
		case "probe-venv": {
			// 版本输出有的 Python 打到 stderr（历史行为），两边拼起来解析。
			const version = succeeded(outcome)
				? parsePythonVersion(`${outcome.stdout}\n${outcome.stderr}`)
				: undefined;
			// 不存在（起不来）/ 解析不出 / 不是 3.12 → 重建，WB 同款处置。
			if (version !== undefined && version.startsWith("3.12.")) {
				return { ...state, phase: "smoke-deps" };
			}
			return { ...state, phase: "create-venv" };
		}
		case "create-venv":
			return succeeded(outcome)
				? { ...state, phase: "smoke-deps" }
				: fail("create-venv", `创建 venv 失败：${excerpt(outcome.stderr)}`);
		case "smoke-deps": {
			if (!succeeded(outcome)) {
				// 探针脚本本身没跑起来（venv 损坏等）：装一轮依赖救不回来，但重建 venv 可以 ——
				// 归因成缺依赖会误导，直接按失败处理并附上 stderr。
				if (state.depsInstallAttempted === true) {
					return fail("smoke-deps", `依赖冒烟脚本未能运行：${excerpt(outcome.stderr)}`);
				}
				return { ...state, phase: "install-deps", depsInstallAttempted: true };
			}
			const missing = parseMissingModule(outcome.stdout);
			if (missing === null) return { ...state, phase: "smoke-engine" };
			if (state.depsInstallAttempted === true) {
				return fail("smoke-deps", `依赖安装一轮后仍缺 ${missing}（venv 可能损坏，可删除 ${venvDir(ctx)} 后重试）`);
			}
			return { ...state, phase: "install-deps", depsInstallAttempted: true };
		}
		case "install-deps":
			return succeeded(outcome)
				? { ...state, phase: "smoke-deps" }
				: fail(
						"install-deps",
						`依赖安装失败（uv pip install --only-binary=:all:）：${excerpt(outcome.stderr)}。` +
							"首次安装需要外网（PyPI）；私有化环境请配置 UV_INDEX_URL 指向内网镜像，或由运维预置离线 wheel。",
					);
		case "smoke-engine":
			return succeeded(outcome)
				? { ...state, phase: "ready" }
				: fail(
						"smoke-engine",
						`引擎包 html_to_docx 无法导入（PYTHONPATH=${ctx.engineDir}），` +
							`resources/docx-engine 可能缺失或损坏：${excerpt(outcome.stderr)}`,
					);
		case "ready":
		case "failed":
			return state;
	}
}

/** 探针输出 {"missing": "lxml"|null}；非 JSON 按「不知道缺啥」处理（触发装依赖兜底）。 */
function parseMissingModule(stdout: string): string | null {
	try {
		const parsed: unknown = JSON.parse(stdout.trim());
		if (typeof parsed === "object" && parsed !== null && "missing" in parsed) {
			const missing = (parsed as { missing: unknown }).missing;
			return typeof missing === "string" ? missing : null;
		}
	} catch {
		// fallthrough
	}
	return "unknown";
}

/* ── 驱动：幂等 ensure ────────────────────────────────────────────── */

export type EnsureResult =
	| { readonly status: "ready"; readonly python: string; readonly venvDir: string }
	| { readonly status: "failed"; readonly phase: EnvPhase; readonly error: string };

/**
 * 幂等确保 venv 就绪。已就绪时只做探测（约 5 次快速 spawn）秒退；
 * 缺啥装啥。对应 WB「每次转换前重跑 setup 脚本 + SessionStart 预热」的调用语义。
 */
export async function ensureDocxEnv(ctx: EnvContext, spawnFn: SpawnFn): Promise<EnsureResult> {
	let state: EnvState = initialEnvState();
	/*
	 * 迁移步数上界：状态机构造上有限（uvIndex/moduleIndex 有界、depsInstallAttempted
	 * 只翻转一次、其余相位单调前进），这里是防 reduce 改出循环 bug 时把 daemon 挂死 ——
	 * 撞线即响亮报错，不是静默兜底。
	 */
	for (let step = 0; step < 40; step += 1) {
		const req = nextStep(state, ctx);
		if (req === null) break;
		const outcome = await spawnFn(req);
		state = reduce(state, outcome, ctx);
	}
	if (state.phase === "ready") {
		return { status: "ready", python: venvPython(ctx), venvDir: venvDir(ctx) };
	}
	if (state.phase === "failed") {
		return {
			status: "failed",
			phase: state.failedAt ?? "failed",
			error: state.error ?? "未知失败",
		};
	}
	return {
		status: "failed",
		phase: state.phase,
		error: `ensure 步数超限（状态机未能收敛，停在 ${state.phase}）`,
	};
}

/* ── 诊断：四态探测（只读，绝不变更环境） ──────────────────────────── */

/**
 * venv 状态探测：不存在 / 非 3.12 / 依赖缺 / 就绪 四态。
 * 诊断页状态行用 —— 与 ensure 不同，本函数**绝不安装或重建**，只探测。
 */
export async function inspectVenv(ctx: EnvContext, spawnFn: SpawnFn): Promise<DocxEnvStatus> {
	const py = venvPython(ctx);
	const versionOutcome = await spawnFn({ command: py, args: ["--version"] });
	if (!succeeded(versionOutcome)) return { kind: "missing" };
	const version = parsePythonVersion(`${versionOutcome.stdout}\n${versionOutcome.stderr}`);
	if (version === undefined || !version.startsWith("3.12.")) {
		return { kind: "wrong-version", version: version ?? "unknown" };
	}
	const probe = await spawnFn({ command: py, args: ["-c", DEPS_PROBE] });
	if (!succeeded(probe)) return { kind: "deps-missing", module: "（冒烟脚本未能运行）" };
	const missing = parseMissingModule(probe.stdout);
	if (missing !== null) return { kind: "deps-missing", module: missing };
	return { kind: "ready" };
}
