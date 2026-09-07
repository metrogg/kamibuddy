/**
 * 权限门的胶水层测试。
 *
 * permission-policy.test.ts 已经钉住了判定规则本身，这里测的是**接缝**：
 *   - 从 pi 的工具入参里取出路径（含 file_path 之类的别名）
 *   - allow / deny / ask 三条路各自返回什么给 pi
 *   - 「本次会话记住」是否真的不再询问，以及作用域是否隔离
 *
 * 这一层不需要模型也不需要 Electron —— 用一个假的 ExtensionAPI 捕获处理器即可。
 * 它正是「已测的策略」与「未测的真实运行」之间唯一的胶水，所以值得单独测。
 */

import { join, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { PermissionRequest, PermissionResponse } from "../shared/ipc.ts";
import { createPermissionGate } from "./permission-gate.ts";

const HOME = resolve(sep, "users", "someone");
const WORKSPACE = join(HOME, "KamiBuddy");
const CONFIG = join(HOME, ".kamibuddy");

/** pi 传给 tool_call 处理器的最小事件形状。 */
interface FakeToolCallEvent {
	readonly toolName: string;
	readonly input: Record<string, unknown>;
}

type Handler = (event: FakeToolCallEvent) => Promise<{ block?: boolean; reason?: string } | undefined>;

/**
 * 装好权限门，返回捕获到的 tool_call 处理器与审批调用记录。
 *
 * approve 决定每次审批的答复；undefined 表示拒绝。
 */
function mount(options: {
	readonly approve?: (request: Omit<PermissionRequest, "id">) => PermissionResponse;
}): {
	readonly call: Handler;
	readonly asked: Array<Omit<PermissionRequest, "id">>;
} {
	const asked: Array<Omit<PermissionRequest, "id">> = [];
	let captured: Handler | undefined;

	const fakePi = {
		on: (event: string, handler: unknown) => {
			if (event === "tool_call") captured = handler as Handler;
		},
	} as unknown as ExtensionAPI;

	createPermissionGate({
		paths: { workspaceDir: WORKSPACE, configDir: CONFIG },
		cwd: WORKSPACE,
		requestApproval: async (request) => {
			asked.push(request);
			return options.approve?.(request) ?? { id: "x", decision: "deny" };
		},
	})(fakePi);

	if (captured === undefined) throw new Error("权限门没有注册 tool_call 处理器");
	return { call: captured, asked };
}

describe("放行路径", () => {
	it("只读工具不询问，返回 undefined（不拦）", async () => {
		const { call, asked } = mount({});
		const result = await call({ toolName: "read", input: { path: join(HOME, "任意.txt") } });

		expect(result).toBeUndefined();
		expect(asked).toHaveLength(0);
	});

	it("写工作目录内不询问", async () => {
		const { call, asked } = mount({});
		const result = await call({ toolName: "write", input: { path: join(WORKSPACE, "周报.html") } });

		expect(result).toBeUndefined();
		expect(asked).toHaveLength(0);
	});
});

describe("拒绝路径", () => {
	it("写配置目录直接拦下，且不发起询问", async () => {
		// 关键：配置目录是 deny 而非 ask —— 连「允许」的机会都不给，
		// 因为 auth.json 存着 API Key，提示注入可能骗用户点允许。
		const { call, asked } = mount({ approve: () => ({ id: "x", decision: "allow" }) });
		const result = await call({ toolName: "write", input: { path: join(CONFIG, "auth.json") } });

		expect(result?.block).toBe(true);
		expect(asked).toHaveLength(0);
	});

	it("拦下时把原因回给模型，让它别重试同一件事", async () => {
		const { call } = mount({});
		const result = await call({ toolName: "write", input: { path: join(CONFIG, "auth.json") } });

		expect(result?.reason).toContain("配置");
	});

	it("用户拒绝时也拦下并附原因", async () => {
		const { call, asked } = mount({ approve: () => ({ id: "x", decision: "deny" }) });
		const result = await call({ toolName: "write", input: { path: join(HOME, "Desktop", "x.txt") } });

		expect(asked).toHaveLength(1);
		expect(result?.block).toBe(true);
		expect(result?.reason).toContain("拒绝");
	});
});

describe("询问路径", () => {
	it("用户允许后不拦", async () => {
		const { call, asked } = mount({ approve: () => ({ id: "x", decision: "allow" }) });
		const result = await call({ toolName: "write", input: { path: join(HOME, "Desktop", "x.txt") } });

		expect(asked).toHaveLength(1);
		expect(result).toBeUndefined();
	});

	it("询问内容带工具名、摘要、风险与解析后的绝对路径", async () => {
		const { call, asked } = mount({ approve: () => ({ id: "x", decision: "allow" }) });
		await call({ toolName: "write", input: { path: "../隔壁/x.txt" } });

		expect(asked[0]).toMatchObject({
			toolName: "write",
			risk: "medium",
			// 给用户看「../x.txt」没有意义，必须显示它实际指向哪。
			details: resolve(HOME, "隔壁", "x.txt"),
		});
		expect(asked[0]?.summary).not.toBe("");
	});

	it("shell 命令按高风险询问，并把完整命令给用户看", async () => {
		const { call, asked } = mount({ approve: () => ({ id: "x", decision: "allow" }) });
		await call({ toolName: "bash", input: { command: "git push --force" } });

		expect(asked[0]).toMatchObject({ risk: "high", details: "git push --force" });
	});
});

describe("入参别名", () => {
	// pi 内置工具用 path，自定义工具常用 file_path / filePath。
	// 取不到路径会让判定退化成「未知工具」，从而对本该放行的写入也弹窗。
	it("识别 file_path", async () => {
		const { call, asked } = mount({});
		const result = await call({ toolName: "write", input: { file_path: join(WORKSPACE, "a.md") } });

		expect(result).toBeUndefined();
		expect(asked).toHaveLength(0);
	});

	it("识别 filePath", async () => {
		const { call, asked } = mount({});
		const result = await call({ toolName: "write", input: { filePath: join(WORKSPACE, "a.md") } });

		expect(result).toBeUndefined();
		expect(asked).toHaveLength(0);
	});

	it("路径缺失时拒绝，而不是放行", async () => {
		const { call } = mount({});
		const result = await call({ toolName: "write", input: {} });

		expect(result?.block).toBe(true);
	});
});

describe("本次会话记住", () => {
	it("勾选后同目录不再询问", async () => {
		const { call, asked } = mount({ approve: () => ({ id: "x", decision: "allow", remember: true }) });

		await call({ toolName: "write", input: { path: join(HOME, "Desktop", "a.txt") } });
		const second = await call({ toolName: "write", input: { path: join(HOME, "Desktop", "b.txt") } });

		expect(asked).toHaveLength(1);
		expect(second).toBeUndefined();
	});

	it("不勾选则每次都问", async () => {
		const { call, asked } = mount({ approve: () => ({ id: "x", decision: "allow" }) });

		await call({ toolName: "write", input: { path: join(HOME, "Desktop", "a.txt") } });
		await call({ toolName: "write", input: { path: join(HOME, "Desktop", "b.txt") } });

		expect(asked).toHaveLength(2);
	});

	it("记住的作用域不跨目录 —— 批准写桌面不等于批准写系统目录", async () => {
		const { call, asked } = mount({ approve: () => ({ id: "x", decision: "allow", remember: true }) });

		await call({ toolName: "write", input: { path: join(HOME, "Desktop", "a.txt") } });
		await call({ toolName: "write", input: { path: resolve(sep, "Windows", "evil.dll") } });

		expect(asked).toHaveLength(2);
	});

	it("记住的作用域不跨工具 —— 批准 write 不等于批准 bash", async () => {
		const { call, asked } = mount({ approve: () => ({ id: "x", decision: "allow", remember: true }) });
		const target = join(HOME, "Desktop", "a.txt");

		await call({ toolName: "write", input: { path: target } });
		await call({ toolName: "edit", input: { path: target } });

		expect(asked).toHaveLength(2);
	});

	it("记住不会绕过配置目录的硬性拒绝", async () => {
		// 即便用户对某目录点过「记住」，配置目录仍然走 deny 分支 ——
		// 顺序上 decide() 先于 remembered 检查。
		const { call } = mount({ approve: () => ({ id: "x", decision: "allow", remember: true }) });

		await call({ toolName: "write", input: { path: join(HOME, "Desktop", "a.txt") } });
		const result = await call({ toolName: "write", input: { path: join(CONFIG, "auth.json") } });

		expect(result?.block).toBe(true);
	});
});
