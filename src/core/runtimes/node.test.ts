/**
 * node 运行时（随包载荷型）的装配链路测试。
 *
 * 走**生产的组装入口**：内核的 `ensureRuntime` / `resetRuntime` / `inspectRuntime` /
 * `collectRuntimeDiagnostics`（即 daemon 首次使用与设置页「诊断/重置」用的同一批入口）
 * 配 `createNodeRuntime`，托管根与 resources 根都落在临时目录，spawn 是**形态匹配的假件**
 * —— 但假件的 robocopy 支做真实的目录复制、探针支按真实磁盘事实回答，于是
 * 「复制 → 进位 → 复验」这条链在真磁盘上被完整跑过（不另搭测试旁路）。
 *
 * 本文件钉四条不可退让的性质：
 *   1. **原子性与顺序**：安装落在 `.staging-*`，进位后复验，manifest 在复验之后，
 *      current 最后写；任何中途失败都不发布（崩溃续跑零成本）。
 *   2. **幂等**：已就位的实例再 ensure 只探针一次 —— 绝不重新复制 95 MB 载荷
 *      （它挂在模型每次调用前的准备路径上）。
 *   3. **就位即修复**：实例文件被删坏时，一次 ensure 就地修好（与 venv 同语义）。
 *   4. **合规义务被机械钉住**：许可文本是载荷必备文件，缺了即响亮失败（不得删）。
 */

import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { SpawnFn, SpawnOutcome, SpawnRequest } from "../../documents/docx-env.ts";
import {
	instanceDir,
	listStaging,
	readCurrent,
	readManifest,
	stagingDir,
	promoteStaging,
	writeManifest,
} from "../runtime-store.ts";
import {
	ensureRuntime,
	inspectRuntime,
	resetRuntime,
	type RuntimeEnsureOutcome,
} from "./registry.ts";
import { collectRuntimeDiagnostics } from "./diagnostics.ts";
import { defaultPythonRuntimeOptions } from "./python.ts";
import { createGitbashRuntime } from "./gitbash.ts";
import {
	createNodeRuntime,
	nodePayloadDir,
	parseNodeVersion,
	NODE_REQUIRED_FILES,
	NODE_RUNTIME_ID,
	NODE_RUNTIME_VERSION,
} from "./node.ts";

const TMP = mkdtempSync(join(tmpdir(), "kami-node-runtime-"));
afterAll(() => {
	rmSync(TMP, { recursive: true, force: true });
});

let seq = 0;
/**
 * 每个用例一套独立的资源根 + 托管根 + 家目录。
 *
 * 装配参数借既有那一处拼法 `defaultPythonRuntimeOptions`：形状是内核契约
 * （root / homeDir / platform / engineDir），三个运行时同形，名字带 python 是历史。
 * 随包载荷的根经 `KAMIBUDDY_RESOURCES_DIR` 指到临时目录（与 `getResourcesDir()` 的
 * 同名覆盖口同意同义）。
 */
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

/** 造一份「构建期已就绪」的 node 随包载荷（真磁盘，内容物只有文件存在性是有意义的）。 */
function makeNodePayload(options: ReturnType<typeof optionsFor>): string {
	const dir = nodePayloadDir(options);
	mkdirSync(dir, { recursive: true });
	for (const file of NODE_REQUIRED_FILES) writeFileSync(join(dir, file), file);
	return dir;
}

/* ── 假 spawn：robocopy 真复制、探针按真实磁盘事实回答 ─────────────── */

const isRobocopy = (req: SpawnRequest): boolean => req.command.endsWith("Robocopy.exe");
const ok = (outcome: Partial<SpawnOutcome> = {}): SpawnOutcome => ({ code: 0, stdout: "", stderr: "", ...outcome });
const notFound = (): SpawnOutcome => ({ code: null, stdout: "", stderr: "", error: "spawn ENOENT" });

function payloadSpawn(
	answer: (req: SpawnRequest) => SpawnOutcome = (req) =>
		existsSync(req.command) ? ok({ stdout: `v${NODE_RUNTIME_VERSION}\n` }) : notFound(),
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
	instanceDir(options.root, NODE_RUNTIME_ID, NODE_RUNTIME_VERSION);

describe("全新机器：装进托管根", () => {
	it("先探针（落空）→ 复制进 .staging-* → 进位 → 复验 → manifest → 最后 current", async () => {
		const options = optionsFor("fresh");
		makeNodePayload(options);
		const { calls, spawn } = payloadSpawn();
		const outcome = ready(await ensureRuntime(createNodeRuntime(options), spawn));

		expect(outcome.activeDir).toBe(INSTANCE(options));
		expect(readCurrent(options.root, NODE_RUNTIME_ID)).toBe(NODE_RUNTIME_VERSION);
		expect(listStaging(options.root, NODE_RUNTIME_ID)).toEqual([]);
		expect(readManifest(INSTANCE(options))?.version).toBe(NODE_RUNTIME_VERSION);

		// 复制落在暂存目录里（改名进位前的实证）。
		expect(calls.find(isRobocopy)?.args[1]).toContain(".staging-");
		// 进位后复验真的发生了：探针在**最终路径**上又跑过一次。
		expect(calls.filter((call) => call.command === join(INSTANCE(options), "node.exe"))).not.toHaveLength(0);
		// 许可文本随实例一起就位（合规义务：随包分发必须附许可文本，且不得删）。
		expect(existsSync(join(INSTANCE(options), "LICENSE"))).toBe(true);
	});

	it("载荷缺席：响亮失败，点名路径与构建命令，不写 current（不改走联网下载）", async () => {
		const options = optionsFor("no-payload");
		const { calls, spawn } = payloadSpawn();
		const outcome = await ensureRuntime(createNodeRuntime(options), spawn);

		expect(outcome.status).toBe("failed");
		if (outcome.status !== "failed") throw new Error("unreachable");
		expect(outcome.phase).toBe("payload-missing");
		expect(outcome.error).toContain(nodePayloadDir(options));
		expect(outcome.error).toContain("npm run fetch:node");
		expect(calls.some(isRobocopy)).toBe(false); // 缺载荷时不做无意义的复制尝试
		expect(readCurrent(options.root, NODE_RUNTIME_ID)).toBeUndefined();
	});

	it("载荷不完整（缺许可文本）：相位指名到缺的那一个文件", async () => {
		const options = optionsFor("incomplete");
		mkdirSync(nodePayloadDir(options), { recursive: true });
		writeFileSync(join(nodePayloadDir(options), "node.exe"), "node.exe"); // 只有可执行本体

		const outcome = await ensureRuntime(createNodeRuntime(options), payloadSpawn().spawn);
		expect(outcome.status).toBe("failed");
		if (outcome.status !== "failed") throw new Error("unreachable");
		expect(outcome.phase).toBe("payload-incomplete");
		expect(outcome.error).toContain("LICENSE");
	});

	it("幂等：已就位时再 ensure 只探针一次（不复制、不重装）", async () => {
		const options = optionsFor("idempotent");
		makeNodePayload(options);
		await ensureRuntime(createNodeRuntime(options), payloadSpawn().spawn);

		const second = payloadSpawn();
		const again = await ensureRuntime(createNodeRuntime(options), second.spawn);
		expect(again.status).toBe("ready");
		expect(second.calls.some(isRobocopy)).toBe(false);
		expect(second.calls).toHaveLength(1); // 只有一次探针
	});

	it("就位即修复：实例文件被删坏时，一次 ensure 就地修好（不重新下载、不换落点）", async () => {
		const options = optionsFor("repair");
		makeNodePayload(options);
		await ensureRuntime(createNodeRuntime(options), payloadSpawn().spawn);
		rmSync(join(INSTANCE(options), "node.exe"), { force: true });

		const repaired = payloadSpawn();
		const outcome = ready(await ensureRuntime(createNodeRuntime(options), repaired.spawn));
		expect(outcome.activeDir).toBe(INSTANCE(options));
		expect(existsSync(join(INSTANCE(options), "node.exe"))).toBe(true);
		// 就地修复：复制目标是**实例目录本身**，不是暂存目录（托管实例不换位）。
		expect(repaired.calls.find(isRobocopy)?.args[1]).toBe(INSTANCE(options));
	});
});

describe("失败与崩溃点：不会留下「看起来就绪」的状态", () => {
	it("进位后复验不过（版本不符）→ 不发布：current 与 manifest 都不写", async () => {
		const options = optionsFor("verify-fail");
		makeNodePayload(options);
		// 暂存里探针报对版本；**进位后的最终路径**上报另一个版本（模拟改包后不可用）。
		const { spawn } = payloadSpawn((req) => {
			if (!existsSync(req.command)) return notFound();
			return req.command.includes(".staging-")
				? ok({ stdout: `v${NODE_RUNTIME_VERSION}\n` })
				: ok({ stdout: "v22.19.0\n" });
		});
		const outcome = await ensureRuntime(createNodeRuntime(options), spawn);

		expect(outcome.status).toBe("failed");
		if (outcome.status !== "failed") throw new Error("unreachable");
		expect(outcome.phase).toBe("verify-promoted");
		expect(outcome.error).toContain("复验不通过");
		// 顺序铁律：复验没过 ⇒ 既不写 current、也不写完成标记（实例已在位但不算数）。
		expect(readCurrent(options.root, NODE_RUNTIME_ID)).toBeUndefined();
		expect(readManifest(INSTANCE(options))).toBeUndefined();

		// 「已进位但未发布」的现场仍可诊断，且能指名到具体事实（版本不符带实际版本）。
		const report = await collectRuntimeDiagnostics(
			createNodeRuntime(options),
			payloadSpawn((req) => (existsSync(req.command) ? ok({ stdout: "v22.19.0\n" }) : notFound())).spawn,
		);
		expect(report.status).toEqual({ kind: "wrong-version", version: "22.19.0" });
		expect(report.currentVersion).toBeUndefined();
	});

	it("崩在写 current 之前（已进位、已有 manifest）→ 未就绪，但下次 ensure 零成本续跑", async () => {
		const options = optionsFor("crash-current");
		const staging = stagingDir(options.root, NODE_RUNTIME_ID, NODE_RUNTIME_VERSION, "boom");
		mkdirSync(staging, { recursive: true });
		const promoted = promoteStaging(options.root, NODE_RUNTIME_ID, NODE_RUNTIME_VERSION, staging);
		writeManifest(promoted, {
			id: NODE_RUNTIME_ID,
			version: NODE_RUNTIME_VERSION,
			source: "测试来源",
			installedAt: "2026-09-17T00:00:00.000Z",
			status: "installed",
		});

		expect(readCurrent(options.root, NODE_RUNTIME_ID)).toBeUndefined();
		const report = await collectRuntimeDiagnostics(createNodeRuntime(options), payloadSpawn().spawn);
		expect(report.nextSteps.join("\n")).toContain("没发布");

		const resume = payloadSpawn();
		const outcome = ready(await ensureRuntime(createNodeRuntime(options), resume.spawn));
		expect(outcome.activeDir).toBe(INSTANCE(options));
		expect(resume.calls).toEqual([]); // 一次 spawn 都不需要
		expect(readCurrent(options.root, NODE_RUNTIME_ID)).toBe(NODE_RUNTIME_VERSION);
	});

	it("半成品残留（.staging-*）能被诊断指名，且重置会清掉", async () => {
		const options = optionsFor("stale-staging");
		makeNodePayload(options);
		mkdirSync(stagingDir(options.root, NODE_RUNTIME_ID, NODE_RUNTIME_VERSION, "stale"), { recursive: true });

		const report = await collectRuntimeDiagnostics(createNodeRuntime(options), payloadSpawn().spawn);
		expect(report.staging).toEqual([`.staging-${NODE_RUNTIME_VERSION}-stale`]);
		expect(report.nextSteps.join("\n")).toContain("半成品");

		await resetRuntime(createNodeRuntime(options), payloadSpawn().spawn);
		expect(listStaging(options.root, NODE_RUNTIME_ID)).toEqual([]);
		expect(readCurrent(options.root, NODE_RUNTIME_ID)).toBe(NODE_RUNTIME_VERSION);
	});
});

describe("重置与诊断", () => {
	it("重置仅凭一个动作修好环境（清掉旧实例 + 重新装 + 发布）", async () => {
		const options = optionsFor("reset");
		makeNodePayload(options);
		await ensureRuntime(createNodeRuntime(options), payloadSpawn().spawn);
		rmSync(join(INSTANCE(options), "node.exe"), { force: true }); // 坏掉：探针会落空

		const reset = ready(await resetRuntime(createNodeRuntime(options), payloadSpawn().spawn));
		expect(reset.activeDir).toBe(INSTANCE(options));
		expect(readCurrent(options.root, NODE_RUNTIME_ID)).toBe(NODE_RUNTIME_VERSION);
		expect(existsSync(join(INSTANCE(options), "node.exe"))).toBe(true);
	});

	it("四态：就绪 / 缺文件指名 / 版本不符带实际版本", async () => {
		const options = optionsFor("inspect");
		makeNodePayload(options);
		await ensureRuntime(createNodeRuntime(options), payloadSpawn().spawn);
		const descriptor = createNodeRuntime(options);
		expect(await inspectRuntime(descriptor, payloadSpawn().spawn)).toEqual({ kind: "ready" });

		rmSync(join(INSTANCE(options), "LICENSE"), { force: true });
		expect(await inspectRuntime(descriptor, payloadSpawn().spawn)).toEqual({
			kind: "deps-missing",
			module: "LICENSE",
		});
	});

	it("诊断报告写清来源与落点，日志落在该运行时的目录下", async () => {
		const options = optionsFor("diagnostics");
		makeNodePayload(options);
		const report = await collectRuntimeDiagnostics(createNodeRuntime(options), payloadSpawn().spawn);
		expect(report.id).toBe(NODE_RUNTIME_ID);
		expect(report.version).toBe(NODE_RUNTIME_VERSION);
		expect(report.source).toContain("nodejs.org");
		expect(report.logPath).toContain(NODE_RUNTIME_ID);
	});
});

describe("三个运行时互不影响", () => {
	it("gitbash 载荷缺席时 node 照样装好（各写各的 manifest 与 current）", async () => {
		const options = optionsFor("isolation");
		makeNodePayload(options); // gitbash 的载荷故意不造

		const nodeOutcome = await ensureRuntime(createNodeRuntime(options), payloadSpawn().spawn);
		expect(nodeOutcome.status).toBe("ready");

		const gitbashOutcome = await ensureRuntime(createGitbashRuntime(options), payloadSpawn().spawn);
		expect(gitbashOutcome.status).toBe("failed");
		if (gitbashOutcome.status !== "failed") throw new Error("unreachable");
		expect(gitbashOutcome.phase).toBe("payload-missing");

		expect(readCurrent(options.root, NODE_RUNTIME_ID)).toBe(NODE_RUNTIME_VERSION);
		expect(readCurrent(options.root, "gitbash")).toBeUndefined();
	});
});

describe("版本串解析（探针的事实来源）", () => {
	it("接受官方形态 v<major>.<minor>.<patch>（含行尾换行），其余一律 undefined", () => {
		expect(parseNodeVersion(ok({ stdout: "v22.23.2\n" }))).toBe("22.23.2");
		expect(parseNodeVersion(ok({ stdout: "22.23.2" }))).toBeUndefined();
		expect(parseNodeVersion(ok({ stdout: "v22.23" }))).toBeUndefined();
		expect(parseNodeVersion(ok({ stdout: "" }))).toBeUndefined();
	});
});

describe("合规义务被钉住", () => {
	it("许可文本在必备文件清单里 —— 删掉它这条断言就红（义务不许退化成注释）", () => {
		expect(NODE_REQUIRED_FILES).toContain("LICENSE");
		expect(NODE_REQUIRED_FILES).toContain("node.exe");
	});
});
