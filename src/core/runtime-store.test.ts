/**
 * 托管根存储（布局 + manifest + current 指针 + 进位/回滚）的测试。
 *
 * 用**真临时目录**而不是注入 fs：本文件要证的正是「磁盘上的字节与读侧结论一致」，
 * 注入一层假 fs 只会证明我自己的 mock 自洽。
 *
 * 重点用例是三个崩溃点 —— 安装顺序是
 *   暂存 → 校验 → 改名进位 → 复验 → 写 manifest → 写 current
 * 每断言一次「断电停在这里时读侧判定未就绪」，就把「先写 current 也差不多」
 * 这条捷径堵死一次。
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
	currentPointer,
	instanceDir,
	isCompleteInstance,
	instanceExists,
	listInstances,
	listStaging,
	manifestFile,
	promoteStaging,
	publishCurrent,
	readCurrent,
	readManifest,
	removeDir,
	runtimeHome,
	runtimesRoot,
	stagingDir,
	writeCurrent,
	writeManifest,
	type RuntimeManifest,
} from "./runtime-store.ts";

const TMP = mkdtempSync(join(tmpdir(), "kami-runtime-store-"));
afterAll(() => {
	rmSync(TMP, { recursive: true, force: true });
});

let seq = 0;
/** 每个用例一个独立托管根，互不干扰（也避免测试间靠执行顺序）。 */
function freshRoot(): string {
	seq += 1;
	return join(TMP, `root-${seq}`, "runtimes");
}

const ID = "demo";
const VERSION = "1.0";

function manifest(overrides: Partial<RuntimeManifest> = {}): RuntimeManifest {
	return {
		id: ID,
		version: VERSION,
		source: "测试来源",
		installedAt: "2026-09-17T00:00:00.000Z",
		status: "installed",
		...overrides,
	};
}

describe("路径布局", () => {
	it("托管根是 <configDir>/runtimes，实例是 <root>/<id>/<version>", () => {
		expect(runtimesRoot(join(TMP, "cfg"))).toBe(join(TMP, "cfg", "runtimes"));
		const root = freshRoot();
		expect(runtimeHome(root, ID)).toBe(join(root, ID));
		expect(instanceDir(root, ID, VERSION)).toBe(join(root, ID, VERSION));
		expect(currentPointer(root, ID)).toBe(join(root, ID, "current"));
		expect(manifestFile(instanceDir(root, ID, VERSION))).toBe(join(root, ID, VERSION, "manifest.json"));
		// 暂存目录在同一父目录下（同卷改名才快且原子），且名字带 .staging- 前缀便于识别。
		expect(stagingDir(root, ID, VERSION, "n1")).toBe(join(root, ID, `.staging-${VERSION}-n1`));
	});
});

describe("manifest 与实例完整性", () => {
	it("写读往返；缺文件 / 坏 JSON / 字段不成形都算「不完整」而不是抛错", () => {
		const root = freshRoot();
		const dir = instanceDir(root, ID, VERSION);
		expect(readManifest(dir)).toBeUndefined();
		expect(isCompleteInstance(dir)).toBe(false);

		writeManifest(dir, manifest({ checksum: "abc" }));
		expect(readManifest(dir)).toEqual(manifest({ checksum: "abc" }));
		expect(isCompleteInstance(dir)).toBe(true);

		writeFileSync(manifestFile(dir), "{ 不是 JSON", "utf8");
		expect(readManifest(dir)).toBeUndefined();

		writeFileSync(manifestFile(dir), JSON.stringify({ id: ID, version: VERSION }), "utf8");
		expect(readManifest(dir)).toBeUndefined();
	});

	it("列表把「已进位」与「半成品」分开，且忽略文件（如 current）", () => {
		const root = freshRoot();
		writeManifest(instanceDir(root, ID, "1.0"), manifest({ version: "1.0" }));
		writeManifest(instanceDir(root, ID, "2.0"), manifest({ version: "2.0" }));
		mkdirSync(stagingDir(root, ID, "3.0", "x"), { recursive: true });
		writeCurrent(root, ID, "1.0");

		expect(listInstances(root, ID).map((instance) => instance.version)).toEqual(["1.0", "2.0"]);
		expect(listInstances(root, ID).every((instance) => instance.complete)).toBe(true);
		expect(listStaging(root, ID)).toEqual([".staging-3.0-x"]);
		expect(instanceExists(root, ID, "3.0")).toBe(false);
	});
});

describe("current 指针", () => {
	it("没写过 → undefined；空文件也算没写（空指针不等于「有实例」）", () => {
		const root = freshRoot();
		expect(readCurrent(root, ID)).toBeUndefined();
		writeCurrent(root, ID, VERSION);
		expect(readCurrent(root, ID)).toBe(VERSION);
		writeFileSync(currentPointer(root, ID), "\n", "utf8");
		expect(readCurrent(root, ID)).toBeUndefined();
	});

	it("覆盖写是原子的（先写 .tmp 再改名，不留 .tmp）", () => {
		const root = freshRoot();
		writeCurrent(root, ID, "1.0");
		writeCurrent(root, ID, "2.0");
		expect(readCurrent(root, ID)).toBe("2.0");
		expect(existsSync(`${currentPointer(root, ID)}.tmp`)).toBe(false);
	});
});

describe("改名进位", () => {
	it("暂存目录 → <version>/；目标已存在时响亮失败（不悄悄合并两份实例）", () => {
		const root = freshRoot();
		const staging = stagingDir(root, ID, VERSION, "n1");
		mkdirSync(staging, { recursive: true });
		writeFileSync(join(staging, "payload.txt"), "venv 内容占位", "utf8");

		expect(promoteStaging(root, ID, VERSION, staging)).toBe(instanceDir(root, ID, VERSION));
		expect(existsSync(staging)).toBe(false);
		expect(readFileSync(join(instanceDir(root, ID, VERSION), "payload.txt"), "utf8")).toBe("venv 内容占位");

		const again = stagingDir(root, ID, VERSION, "n2");
		mkdirSync(again, { recursive: true });
		expect(() => promoteStaging(root, ID, VERSION, again)).toThrow();
	});
});

describe("崩溃点：任意时刻断电都不会留下「看起来就绪」的状态", () => {
	it("崩在改名之前（只剩半成品目录）→ 没有实例、没有 current ⇒ 未就绪", () => {
		const root = freshRoot();
		mkdirSync(stagingDir(root, ID, VERSION, "boom"), { recursive: true });

		expect(listStaging(root, ID)).toEqual([`.staging-${VERSION}-boom`]);
		expect(listInstances(root, ID)).toEqual([]);
		expect(instanceExists(root, ID, VERSION)).toBe(false);
		expect(readCurrent(root, ID)).toBeUndefined();
	});

	it("崩在改名之后、写 manifest 之前 → 目录在但没完成标记 ⇒ 未就绪", () => {
		const root = freshRoot();
		const staging = stagingDir(root, ID, VERSION, "boom");
		mkdirSync(staging, { recursive: true });
		promoteStaging(root, ID, VERSION, staging);
		// 断电（复验 / 写 manifest 都没发生）

		expect(instanceExists(root, ID, VERSION)).toBe(true);
		expect(isCompleteInstance(instanceDir(root, ID, VERSION))).toBe(false);
		expect(listInstances(root, ID)[0]?.complete).toBe(false);
		expect(readCurrent(root, ID)).toBeUndefined();
	});

	it("崩在写 manifest 之后、写 current 之前 → 实例完整但没发布 ⇒ 未就绪", () => {
		const root = freshRoot();
		const staging = stagingDir(root, ID, VERSION, "boom");
		mkdirSync(staging, { recursive: true });
		const promoted = promoteStaging(root, ID, VERSION, staging);
		writeManifest(promoted, manifest());
		// 断电（current 没写）

		expect(isCompleteInstance(promoted)).toBe(true);
		// 读侧只认 current ⇒ 即便实例完整也不能算就绪。
		expect(readCurrent(root, ID)).toBeUndefined();
	});
});

describe("回滚（只切指针，不重新下载）", () => {
	it("两版并存：切 current 往返，实例内容一个字节不动", () => {
		const root = freshRoot();
		writeManifest(instanceDir(root, ID, "1.0"), manifest({ version: "1.0" }));
		writeManifest(instanceDir(root, ID, "2.0"), manifest({ version: "2.0" }));
		writeCurrent(root, ID, "2.0");
		const before = readFileSync(manifestFile(instanceDir(root, ID, "1.0")), "utf8");

		publishCurrent(root, ID, "1.0");
		expect(readCurrent(root, ID)).toBe("1.0");
		publishCurrent(root, ID, "2.0");
		expect(readCurrent(root, ID)).toBe("2.0");

		expect(readFileSync(manifestFile(instanceDir(root, ID, "1.0")), "utf8")).toBe(before);
	});

	it("目标实例不完整 / 不存在 → 拒绝切指针（就绪不能与磁盘事实分叉）", () => {
		const root = freshRoot();
		mkdirSync(instanceDir(root, ID, "9.9"), { recursive: true });
		expect(() => publishCurrent(root, ID, "9.9")).toThrow(/不完整/);
		expect(() => publishCurrent(root, ID, "8.8")).toThrow(/不完整/);
		expect(readCurrent(root, ID)).toBeUndefined();
	});
});

describe("清理", () => {
	it("removeDir 幂等（残留清理要能反复跑）", () => {
		const root = freshRoot();
		const dir = instanceDir(root, ID, "1.0");
		writeManifest(dir, manifest());
		removeDir(dir);
		removeDir(dir);
		expect(existsSync(dir)).toBe(false);
	});
});
