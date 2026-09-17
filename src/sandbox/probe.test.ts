/**
 * 探测（probeSandbox）的**判别分支**与自检失败分类。
 *
 * 为什么要有这一层：`probeSandbox` 是「要不要在沙箱里跑命令」的唯一依据，
 * 而它的每条分支在开发机上都很难走到 —— 工作区不在 exFAT 上、FFI 装得上、
 * 自检过得去。于是「不可用」的几种原因此前只有一条集成用例覆盖，且那条用例
 * 要求**真的起得来受限子进程**：本机 IDE 终端里受限子进程会被外部沙箱拦成
 * `0x80000005`，结论随环境浮动。所以这里把整条链上的外部依赖
 * （ffi / token / acl / spawn）全部换成可控桩，只钉住**我们代码在失败路径上的
 * 判定**：走哪条分支、报什么原因码、是否 fail-closed。
 *
 * 与 dsh `tests/probe.spec.ts` 的取向一致（真进程探测走集成测试，判别逻辑走桩），
 * 但多一层：这里还守 `classifyFailure` 的原因码判别 —— 「授权失败」被说成
 * 「令牌创建失败」会把排查方向整条指歪（见 index.ts 的 SandboxPrepareFailure 注释）。
 */

import { tmpdir } from "node:os";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Win32Bindings } from "./ffi.ts";

/** 自检哨兵退出码。**必须与 index.ts 的 SELF_CHECK_EXIT_CODE 一致**（那里没有导出）。 */
const SELF_CHECK_EXIT_CODE = 7;

interface Harness {
	api: Win32Bindings;
	/** loadWin32 抛出的错误（undefined = 正常返回 api）。 */
	loadError: Error | undefined;
	/** getVolumeInformationW 被调用的次数 —— 文件系统结论缓存粒度的观测量。 */
	volumeQueries: number;
	/** 卷查询是否失败（路径还不存在的情形，不该据此否掉沙箱）。 */
	volumeQueryFails: boolean;
	/** 卷的文件系统名。 */
	fileSystem: string;
	/** 桩 spawnConfined 被调用的次数 —— 自检真跑了几次。 */
	spawnCalls: number;
	/** 自检子进程的等待结果（决定自检结论）。 */
	outcome: { exitCode: number | undefined; timedOut: boolean; aborted: boolean };
	/** 非空时让授权阶段抛错（模拟 ACL/令牌失败），用来验 fail-closed。 */
	prepareError: Error | undefined;
}

const harness = vi.hoisted(() => ({ current: undefined as unknown as Harness }));

vi.mock("./ffi.ts", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./ffi.ts")>();
	return {
		...actual,
		// 真 koffi 一律不加载：本文件不碰真 Win32，任何平台都能跑。
		loadWin32: async () => {
			const state = harness.current;
			if (state.loadError !== undefined) throw state.loadError;
			return state.api;
		},
		// 桩令牌句柄不是 koffi 内存，真释放会崩。
		freeNative: () => {},
	};
});

vi.mock("./token.ts", () => ({
	// 令牌管线整体打桩：这里关心的是「它失败时探测怎么判别」，
	// 而不是它内部怎么派生（那条链路的失败路径在 token-failure.test.ts 里逐条覆盖）。
	sidFromString: () => {
		const state = harness.current;
		if (state.prepareError !== undefined) throw state.prepareError;
		return 5n;
	},
	createRestrictedToken: () => 6n,
	findLogonSid: () => 7n,
	makeWellKnownSid: () => 8n,
	openCurrentProcessToken: () => 9n,
	setTokenDefaultDaclGrant: () => {},
}));

vi.mock("./acl.ts", () => ({ grantWrite: () => true }));

vi.mock("./spawn.ts", () => ({
	spawnConfined: () => {
		harness.current.spawnCalls += 1;
		return { pid: 1234, process: 11n, job: 12n, stdoutRead: 13n, stderrRead: 14n };
	},
	drainPipe: async () => Buffer.alloc(0),
	waitForChild: async () => harness.current.outcome,
}));

import { FfiUnavailableError, Win32Error } from "./ffi.ts";
import {
	classifyFailure,
	probeSandbox,
	resetSandboxProbeForTest,
	SandboxPrepareFailure,
} from "./index.ts";

/** 装了桩绑定表的探测环境；默认一切正常（NTFS + 自检通过）。 */
function makeHarness(): Harness {
	const state: Harness = {
		api: undefined as unknown as Win32Bindings,
		loadError: undefined,
		volumeQueries: 0,
		volumeQueryFails: false,
		fileSystem: "NTFS",
		spawnCalls: 0,
		outcome: { exitCode: SELF_CHECK_EXIT_CODE, timedOut: false, aborted: false },
		prepareError: undefined,
	};
	/** 类型写成 Partial<Win32Bindings>，箭头参数才有上下文类型。 */
	const api: Partial<Win32Bindings> = {
		// 私有 temp / 自检脚手架目录都落在真实系统 temp 下（其余调用全是桩）。
		getTempPathW: (_length, buffer) => {
			const temp = tmpdir();
			buffer.write(temp, "utf16le");
			return temp.length;
		},
		getVolumePathNameW: (_fileName, buffer) => {
			if (state.volumeQueryFails) return 0;
			buffer.write("C:\\", "utf16le");
			return 3;
		},
		getVolumeInformationW: (_root, _name, _nameSize, _serial, _maxComponent, _flags, nameBuffer) => {
			state.volumeQueries += 1;
			nameBuffer.write(state.fileSystem, "utf16le");
			return 1;
		},
		closeHandle: () => 1,
		getLastError: () => 5,
		formatMessageW: () => 0,
	};
	state.api = api as Win32Bindings;
	return state;
}

beforeEach(() => {
	harness.current = makeHarness();
	resetSandboxProbeForTest();
});

describe("probeSandbox 判别分支", () => {
	it("非 Windows 平台报 not-windows 而不是抛错", async () => {
		// 这条分支在 Windows 开发机上永远走不到（confinement 里的同名用例被整组 skip），
		// 于是把 platform 临时改成别的看一眼。
		const original = process.platform;
		Object.defineProperty(process, "platform", { value: "linux", configurable: true });
		const probe = probeSandbox(tmpdir());
		Object.defineProperty(process, "platform", { value: original, configurable: true });
		await expect(probe).resolves.toMatchObject({ available: false, reason: "not-windows" });
	});

	it("FFI 加载失败报 ffi-load-failed，原因原样带上", async () => {
		harness.current.loadError = new FfiUnavailableError("koffi 模块形状异常");
		const probe = await probeSandbox("C:\\ws");
		expect(probe.available).toBe(false);
		if (!probe.available) {
			expect(probe.reason).toBe("ffi-load-failed");
			expect(probe.detail).toContain("koffi 模块形状异常");
		}
	});

	it("未预期的加载失败也归到 ffi-load-failed，但标注出来（别把归因说得比证据更确定）", async () => {
		harness.current.loadError = new Error("koffi 内部炸了");
		const probe = await probeSandbox("C:\\ws");
		expect(probe.available).toBe(false);
		if (!probe.available) {
			expect(probe.reason).toBe("ffi-load-failed");
			expect(probe.detail).toContain("未预期的加载失败：koffi 内部炸了");
		}
	});

	it("工作区在 exFAT 上 → unsupported-filesystem，且**连自检都不跑**（不许显示成可用）", async () => {
		// FAT/exFAT 上授权会「成功」但毫无效果 —— 这是最该报出来的假边界。
		harness.current.fileSystem = "exFAT";
		const probe = await probeSandbox("C:\\usb\\ws");
		expect(probe.available).toBe(false);
		if (!probe.available) {
			expect(probe.reason).toBe("unsupported-filesystem");
			expect(probe.detail).toContain("exFAT");
		}
		expect(harness.current.spawnCalls, "不支持的文件系统上不该再付自检的钱").toBe(0);
	});

	it("先探到 NTFS 工作区，也不会让后面的 exFAT 工作区跟着报可用（假可用是最坏的方向）", async () => {
		/*
		 * 旧实现把整个探测结论存在进程级单值里，而 daemon 的每个会话桶都用自己的
		 * cwd 调用本函数。假可用方向（exFAT 工作区被判成「有写约束」）正是
		 * 审批放松时要拿它当依据的那个值 —— 等于在毫无约束的目录里免审批执行命令。
		 */
		const onDisk = await probeSandbox("C:\\disk\\ws");
		expect(onDisk.available).toBe(true);

		harness.current.fileSystem = "exFAT";
		const onUsb = await probeSandbox("C:\\usb\\ws");
		expect(onUsb.available).toBe(false);
		if (!onUsb.available) expect(onUsb.reason).toBe("unsupported-filesystem");
	});

	it("先探到 exFAT 工作区，也不会把别的 NTFS 工作区连坐成永久不可用", async () => {
		harness.current.fileSystem = "exFAT";
		expect((await probeSandbox("C:\\usb\\ws")).available).toBe(false);

		harness.current.fileSystem = "NTFS";
		expect((await probeSandbox("C:\\disk\\ws")).available).toBe(true);
	});

	it("同一路径的不同大小写拼法共用缓存（Windows 路径大小写不敏感）", async () => {
		harness.current.fileSystem = "exFAT";
		await probeSandbox("C:\\Usb\\WS");
		await probeSandbox("c:\\usb\\ws");
		expect(harness.current.volumeQueries).toBe(1);
	});

	it("卷查询失败不当作「不支持的文件系统」（路径还不存在不该否掉沙箱）", async () => {
		harness.current.volumeQueryFails = true;
		// 判据是「不报 unsupported-filesystem」：真正的失败会在授权阶段响亮报出来。
		const probe = await probeSandbox("C:\\not-yet-created");
		expect(probe.available).toBe(true);
		expect(harness.current.volumeQueries).toBe(0);
	});

	it("自检通过 → 可用；且自检是**进程级**的，不为每个工作区重跑（首响延迟靠这条）", async () => {
		expect((await probeSandbox("C:\\a")).available).toBe(true);
		expect((await probeSandbox("C:\\b")).available).toBe(true);
		expect(harness.current.spawnCalls).toBe(1);
		// 文件系统判断按工作区各算一次（很便宜），启动自检只跑一次（很贵）。
		expect(harness.current.volumeQueries).toBe(2);
	});

	it("自检退出码不符 → process-start-failed，十六进制退出码原样写进 detail", async () => {
		// 0xC0000142 = STATUS_DLL_INIT_FAILED：2026-09-15 那次「沙箱让每条命令都失败」
		// 的真实现象。它必须报成「进程起不来」而不是「命令执行失败」。
		harness.current.outcome = { exitCode: 0xc0000142, timedOut: false, aborted: false };
		const probe = await probeSandbox("C:\\ws");
		expect(probe.available).toBe(false);
		if (!probe.available) {
			expect(probe.reason).toBe("process-start-failed");
			expect(probe.detail).toContain("0xC0000142");
			expect(probe.detail).toContain("STATUS_DLL_INIT_FAILED");
		}
	});

	it("自检超时 → 也是 process-start-failed（不许沉默地放行）", async () => {
		harness.current.outcome = { exitCode: undefined, timedOut: true, aborted: false };
		const probe = await probeSandbox("C:\\ws");
		expect(probe.available).toBe(false);
		if (!probe.available) {
			expect(probe.reason).toBe("process-start-failed");
			expect(probe.detail).toContain("未结束");
		}
	});

	it("自检阶段 ACL 授权失败 → acl-grant-failed，**绝不返回可用**（fail-closed）", async () => {
		harness.current.prepareError = new Win32Error("SetNamedSecurityInfoW", 5);
		const probe = await probeSandbox("C:\\ws");
		expect(probe.available, "授权失败却报可用 = 在没有写约束的目录里免审批执行命令").toBe(false);
		if (!probe.available) {
			expect(probe.reason).toBe("acl-grant-failed");
			expect(probe.detail).toContain("SetNamedSecurityInfoW");
		}
	});

	it("自检阶段令牌派生失败 → token-creation-failed（与授权失败分开，排查方向不同）", async () => {
		harness.current.prepareError = new Win32Error("CreateRestrictedToken", 5);
		const probe = await probeSandbox("C:\\ws");
		expect(probe.available).toBe(false);
		if (!probe.available) expect(probe.reason).toBe("token-creation-failed");
	});

	it("resetSandboxProbeForTest 把两级缓存都清掉（自检与文件系统结论都要重算）", async () => {
		await probeSandbox("C:\\ws");
		expect(harness.current.spawnCalls).toBe(1);

		resetSandboxProbeForTest();
		await probeSandbox("C:\\ws");
		expect(harness.current.spawnCalls).toBe(2);
		expect(harness.current.volumeQueries).toBe(2);
	});
});

describe("classifyFailure 原因码判别", () => {
	it("SandboxPrepareFailure 自带的原因优先于 message 里的 API 名", () => {
		/*
		 * 授权跑在 worker_thread 里，异常跨不了线程 —— worker 侧先分类、主线程用
		 * SandboxPrepareFailure 还原。若这里被 message 的字符串匹配抢先命中，
		 * 「授权组件起不来」就会被说成「受限令牌创建失败」，把排查方向指歪。
		 */
		const error = new SandboxPrepareFailure(
			"acl-grant-failed",
			"SetEntriesInAclW 失败（这条文案里还提到 CreateRestrictedToken）",
		);
		expect(classifyFailure(error)).toBe("acl-grant-failed");
	});

	it("FFI 加载失败 → ffi-load-failed", () => {
		expect(classifyFailure(new FfiUnavailableError("x"))).toBe("ffi-load-failed");
	});

	it.each([["CreateRestrictedToken"], ["OpenProcessToken"], ["SetTokenInformation"]])(
		"令牌类 API（%s）→ token-creation-failed",
		(api) => {
			expect(classifyFailure(new Win32Error(api, 5))).toBe("token-creation-failed");
		},
	);

	it.each([["SetNamedSecurityInfoW"], ["SetEntriesInAclW"], ["GetNamedSecurityInfoW"]])(
		"ACL 类 API（%s）→ acl-grant-failed",
		(api) => {
			expect(classifyFailure(new Win32Error(api, 5))).toBe("acl-grant-failed");
		},
	);

	it("不认识的异常兜底成 token-creation-failed（宁可指错也不给空原因）", () => {
		expect(classifyFailure(new Error("完全看不懂的失败"))).toBe("token-creation-failed");
		expect(classifyFailure("字符串异常")).toBe("token-creation-failed");
		expect(classifyFailure(undefined)).toBe("token-creation-failed");
	});
});
