/**
 * docx 引擎托管环境：venv 的**探测与幂等 ensure 状态机**（九相位）。
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
 * 【2026-09-17 迁入托管运行时（spec: add-managed-runtimes 阶段 1，BREAKING）】
 * venv 的**位置**不再由本文件决定：平级隐式路径 `~/.venv-html-to-docx` 已退役为
 * 「复用/迁入来源」，真正的落点由托管根（`<configDir>/runtimes/python/<version>/`
 * + `current` 指针）决定 —— 优先级与判据只在 core/runtimes/python.ts 的
 * `resolvePythonVenv` 一处（唯一真源），本文件通过 `EnvContext.venvDir` 收下结论。
 * 为什么这样切：documents/ 不许 import core（AGENTS.md §1），而「落点在哪」要知道
 * 配置目录、版本指针与旧路径是否存在 —— 那三样都是宿主侧知识。切完之后本文件仍是
 * 「内容 + 环境」的纯函数层：给一个 venv 目录，把环境装到就绪。
 *
 * 为什么状态机是纯函数 + spawn 注入：documents/ 不许 import pi/electron
 * （AGENTS.md §1），这一层是我们最重的模块，测试是 AI 写它时唯一的护栏 ——
 * 全部迁移都能用 fake spawn 在单测里跑完，不需要真装 Python。
 * 相位推进的**驱动**（取下一步 → spawn → 喂回）已抽到 core/runtimes/machine.ts，
 * 本文件只留纯函数（initialEnvState / nextStep / reduce）——「同样输入必得同样指令」
 * 这条性质因此还能被逐相位断言，而多运行时共用同一套驱动。
 *
 * 与 agent shell 能力的关系（2026-09-17 修订，见 spec：转换调用受控）：
 * ensure/convert 都是 daemon 进程内受控 spawn（命令与参数全部写死在本文件，
 * 模型只能给 HTML 输入与产物路径），**转换这条链路**仍然不经 agent 的 shell。
 * 但解释器路径本身会交给模型（隐藏注入而非系统提示词 —— 它随机器变，进提示词
 * 就是「换机即断前缀」，片段 resources/prompts/fragments/python-env.md 只留恒定
 * 纪律文字；实际取值经 daemon 的运行时清单（core/runtime-inventory.ts）进 hidden
 * context 的 python_env 段），模型可以用它跑自己写的脚本 —— 原因是模型缺库时会去
 * `pip install`，而 pip 在写入沙箱里必定失败（Python 的 tempfile 用 0700 建
 * 受保护 DACL，见 AGENTS.md 引的 docs/ARCHITECTURE.md 已知边界第 8 条）。
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
	/**
	 * venv 根 —— **注入值**，本文件不推导它。
	 * 判据与优先级（托管根 current > 既有 ~/.venv-html-to-docx > 待安装）
	 * 只在 core/runtimes/python.ts 的 resolvePythonVenv 一处；`HTML_TO_DOCX_VENV`
	 * 覆盖口的读取也在那边（唯一真源，避免两处各判一遍后分叉）。
	 */
	readonly venvDir: string;
}

export function createEnvContext(
	engineDir: string,
	homeDir: string,
	platform: string,
	venvDir: string,
): EnvContext {
	return { engineDir, homeDir, platform, venvDir };
}

/**
 * venv 解释器路径（纯函数）。
 * Windows 布局是 Scripts/python.exe，posix 是 bin/python。
 */
export function venvPythonPath(venvDir: string, platform: string): string {
	return platform === "win32" ? join(venvDir, "Scripts", "python.exe") : join(venvDir, "bin", "python");
}

/** 当前上下文里的 venv 解释器。 */
export function venvPython(ctx: EnvContext): string {
	return venvPythonPath(ctx.venvDir, ctx.platform);
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
			return { command: uvOf(state), args: ["venv", "--python", "3.12", "--clear", ctx.venvDir] };
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
				return fail("smoke-deps", `依赖安装一轮后仍缺 ${missing}（venv 可能损坏，可删除 ${ctx.venvDir} 后重试）`);
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

/* ── ensure 的产出契约 ────────────────────────────────────────────── */

/**
 * 幂等 ensure 的产出。`phase` 是**归因**（失败时停在哪个相位），工具层据此写给
 * 模型可行动的文案（docx-convert.ts 的 classifyEnsureError）。
 *
 * 为什么 phase 是 string 而不是 EnvPhase：驱动（取下一步 → spawn → 喂回）已挪到
 * core/runtimes/machine.ts 与 registry.ts，托管安装还会多出几个非 venv 相位
 * （暂存进位后复验、发布 current 失败等）。把它们塞进 EnvPhase 只能靠伪造相位，
 * 如实放宽成 string 更好 —— 归因的语义没变，只是不再假装只有九相位。
 */
export type EnsureResult =
	| { readonly status: "ready"; readonly python: string; readonly venvDir: string }
	| { readonly status: "failed"; readonly phase: string; readonly error: string };

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
