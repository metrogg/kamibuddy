/**
 * 注入层（SubTask 2.1.3）的判据测试。
 *
 * 这一层是纯函数，所以能逐条钉住「启用时注入什么 / 禁用时**明确不注入**」：
 *   - 总开关关闭 ⇒ 三个运行时都不注入（哪怕逐项还是 true）；
 *   - 逐项关闭 ⇒ 该运行时既不进 PATH 也不给变量，且决定里写明「已被用户禁用」
 *     （模型侧的「被禁用」与「找不到」可区分，源头就在这一条）；
 *   - 未就绪（resolve 的落点来源是 pending）⇒ 不注入，理由带 resolve 的说法；
 *   - 就绪 ⇒ 注入该运行时的 PATH 目录 + 专属变量 + 托管根变量，且**前置**在基线 PATH 之前。
 *
 * 例子里刻意用 resolve 的真实产出（拿真描述符 + 空托管根），不手搓 RuntimeResolution，
 * 免得测试通过与生产判据脱节。
 */

import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { instanceDir, writeManifest, writeCurrent } from "../runtime-store.ts";
import { defaultPythonRuntimeOptions } from "./python.ts";
import { createNodeRuntime, NODE_RUNTIME_ID, NODE_RUNTIME_VERSION } from "./node.ts";
import { createGitbashRuntime, GITBASH_RUNTIME_ID, GITBASH_RUNTIME_VERSION } from "./gitbash.ts";
import {
	MANAGED_ROOT_ENV,
	planRuntimeInjection,
	prependPath,
	pathKeyOf,
	type RuntimeInjectionInput,
} from "./injection.ts";

const TMP = mkdtempSync(join(tmpdir(), "kami-runtime-injection-"));
afterAll(() => {
	rmSync(TMP, { recursive: true, force: true });
});

let seq = 0;
function optionsFor(name: string) {
	seq += 1;
	const base = join(TMP, `${name}-${seq}`);
	mkdirSync(join(base, "home"), { recursive: true });
	return defaultPythonRuntimeOptions({
		root: join(base, "config", "runtimes"),
		homeDir: join(base, "home"),
		platform: "win32",
		engineDir: join(base, "resources", "docx-engine"),
		env: { KAMIBUDDY_RESOURCES_DIR: join(base, "resources") },
	});
}

/** 把某个运行时标成「已就位」：写一份完整实例 + current 指针（就绪判据的最小事实）。 */
function publish(options: ReturnType<typeof optionsFor>, id: string, version: string): void {
	const instance = instanceDir(options.root, id, version);
	mkdirSync(instance, { recursive: true });
	writeManifest(instance, {
		id,
		version,
		source: "测试来源",
		installedAt: "2026-09-17T00:00:00.000Z",
		status: "installed",
	});
	writeCurrent(options.root, id, version);
}

const BASE_ENV = { Path: "C:\\Windows\\System32" } as const;

describe("注入判据", () => {
	it("就绪且启用：注入 PATH 前置目录、专属变量与托管根变量", () => {
		const options = optionsFor("injected");
		publish(options, NODE_RUNTIME_ID, NODE_RUNTIME_VERSION);
		publish(options, GITBASH_RUNTIME_ID, GITBASH_RUNTIME_VERSION);
		const inputs: RuntimeInjectionInput[] = [
			{ id: NODE_RUNTIME_ID, enabled: true, resolution: createNodeRuntime(options).resolve() },
			{ id: GITBASH_RUNTIME_ID, enabled: true, resolution: createGitbashRuntime(options).resolve() },
		];

		const plan = planRuntimeInjection(inputs, { master: true, root: options.root, env: BASE_ENV });
		const nodeDir = instanceDir(options.root, NODE_RUNTIME_ID, NODE_RUNTIME_VERSION);
		const gitbashDir = instanceDir(options.root, GITBASH_RUNTIME_ID, GITBASH_RUNTIME_VERSION);

		expect(plan.pathEntries).toEqual([
			nodeDir,
			join(gitbashDir, "mingw64", "bin"),
			join(gitbashDir, "usr", "bin"),
			join(gitbashDir, "cmd"),
		]);
		expect(plan.env[MANAGED_ROOT_ENV]).toBe(options.root);
		expect(plan.env["KAMIBUDDY_NODE_HOME"]).toBe(nodeDir);
		expect(plan.env["KAMIBUDDY_GITBASH_HOME"]).toBe(gitbashDir);
		// 基线 PATH 保留在后（不丢弃用户/系统既有 PATH），键名沿用基线的那个。
		expect(plan.env[pathKeyOf(BASE_ENV)]).toBe(`${plan.pathEntries.join(delimiter)}${delimiter}C:\\Windows\\System32`);
		expect(plan.decisions.every((decision) => decision.kind === "injected")).toBe(true);
	});

	it("逐项禁用：既不进 PATH 也不给变量，理由写明「已被用户禁用」", () => {
		const options = optionsFor("per-item-off");
		publish(options, NODE_RUNTIME_ID, NODE_RUNTIME_VERSION);
		const inputs: RuntimeInjectionInput[] = [
			{ id: NODE_RUNTIME_ID, enabled: false, resolution: createNodeRuntime(options).resolve() },
		];

		const plan = planRuntimeInjection(inputs, { master: true, root: options.root, env: BASE_ENV });
		expect(plan).toEqual({
			env: {},
			pathEntries: [],
			decisions: [
				{
					id: NODE_RUNTIME_ID,
					kind: "disabled",
					reason: "已被用户在设置里禁用（显式已禁用标记）：路径与环境变量都不注入",
				},
			],
		});
	});

	it("总开关关闭：三个运行时全都不注入（逐项仍为启用也照关）", () => {
		const options = optionsFor("master-off");
		publish(options, NODE_RUNTIME_ID, NODE_RUNTIME_VERSION);
		publish(options, GITBASH_RUNTIME_ID, GITBASH_RUNTIME_VERSION);
		const inputs: RuntimeInjectionInput[] = [
			{ id: NODE_RUNTIME_ID, enabled: true, resolution: createNodeRuntime(options).resolve() },
			{ id: GITBASH_RUNTIME_ID, enabled: true, resolution: createGitbashRuntime(options).resolve() },
		];

		const plan = planRuntimeInjection(inputs, { master: false, root: options.root, env: BASE_ENV });
		expect(plan.env).toEqual({});
		expect(plan.pathEntries).toEqual([]);
		expect(plan.decisions.map((decision) => decision.kind)).toEqual(["disabled", "disabled"]);
		expect(plan.decisions.every((decision) => decision.reason.includes("总开关"))).toBe(true);
	});

	it("未就绪（尚无实例）：不注入，理由带 resolve 的落点说明（不另写一套说法）", () => {
		const options = optionsFor("not-ready");
		const resolution = createNodeRuntime(options).resolve();
		const plan = planRuntimeInjection([{ id: NODE_RUNTIME_ID, enabled: true, resolution }], {
			master: true,
			root: options.root,
			env: BASE_ENV,
		});

		expect(plan.env).toEqual({});
		expect(plan.decisions).toEqual([
			expect.objectContaining({
				id: NODE_RUNTIME_ID,
				kind: "not-ready",
				reason: expect.stringContaining(resolution.detail),
			}),
		]);
	});

	it("python 有意不注入路径（解释器路径经 hidden context 的 python_env 段）", () => {
		const options = optionsFor("python-no-path");
		publish(options, "python", "3.12");
		const plan = planRuntimeInjection(
			[{ id: "python", enabled: true, resolution: createPythonResolution(options) }],
			{ master: true, root: options.root, env: BASE_ENV },
		);

		expect(plan.pathEntries).toEqual([]);
		// 一个都没注入时不写托管根变量（单独一个「目录在哪」只是噪音）。
		expect(plan.env).toEqual({});
		expect(plan.decisions[0]?.kind).toBe("injected");
	});

	it("多个运行时混合：只有生效的那些进 env（顺序 = 入参顺序，可复现）", () => {
		const options = optionsFor("mixed");
		publish(options, GITBASH_RUNTIME_ID, GITBASH_RUNTIME_VERSION);
		const inputs: RuntimeInjectionInput[] = [
			{ id: NODE_RUNTIME_ID, enabled: true, resolution: createNodeRuntime(options).resolve() },
			{ id: GITBASH_RUNTIME_ID, enabled: true, resolution: createGitbashRuntime(options).resolve() },
		];

		const plan = planRuntimeInjection(inputs, { master: true, root: options.root, env: BASE_ENV });
		expect(plan.decisions.map((decision) => decision.kind)).toEqual(["not-ready", "injected"]);
		expect(plan.pathEntries).toHaveLength(3);
		expect(plan.env["KAMIBUDDY_NODE_HOME"]).toBeUndefined();
		expect(plan.env["KAMIBUDDY_GITBASH_HOME"]).toBeDefined();
	});
});

describe("PATH 拼法", () => {
	it("prependPath 前置注入目录、保留基线、沿用基线键名、空基线不留分隔符", () => {
		expect(prependPath({ Path: "C:\\a" }, ["D:\\x", "D:\\y"])).toBe(`D:\\x${delimiter}D:\\y${delimiter}C:\\a`);
		expect(prependPath({}, ["D:\\x"])).toBe("D:\\x");
		expect(prependPath({ PATH: "C:\\a" }, ["D:\\x"])).toBe(`D:\\x${delimiter}C:\\a`);
		expect(pathKeyOf({ PATH: "C:\\a" })).toBe("PATH");
		expect(pathKeyOf({})).toBe("Path");
	});
});

/** python 的落点结论由它的描述符给（本用例只关心注入层对它的态度）。 */
function createPythonResolution(options: ReturnType<typeof optionsFor>) {
	const instance = instanceDir(options.root, "python", "3.12");
	return {
		instanceDir: instance,
		version: "3.12",
		activeDir: instance,
		source: "managed" as const,
		detail: "测试用",
		managed: true,
	};
}
