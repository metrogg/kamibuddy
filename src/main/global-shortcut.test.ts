import { describe, expect, it, vi } from "vitest";
import type { GlobalShortcutStatus } from "../shared/ipc.ts";
import {
	GlobalToggleShortcutController,
	decideToggleAction,
	type ShortcutRegistrar,
	type ToggleWindowOperations,
} from "./global-shortcut.ts";

describe("decideToggleAction", () => {
	it("窗口聚焦且可见 → minimize", () => {
		expect(decideToggleAction({ focused: true, visible: true, minimized: false })).toBe("minimize");
	});

	it("窗口被最小化 → restore-focus", () => {
		expect(decideToggleAction({ focused: false, visible: true, minimized: true })).toBe("restore-focus");
	});

	it("窗口不可见且未聚焦 → restore-focus", () => {
		expect(decideToggleAction({ focused: false, visible: false, minimized: false })).toBe("restore-focus");
	});
});

function makeWindowOps(state: { focused: boolean; visible: boolean; minimized: boolean }) {
	return {
		minimize: vi.fn(),
		restore: vi.fn(),
		show: vi.fn(),
		focus: vi.fn(),
		isFocused: () => state.focused,
		isVisible: () => state.visible,
		isMinimized: () => state.minimized,
	} satisfies ToggleWindowOperations;
}

function makeController(opts: {
	windowState?: { focused: boolean; visible: boolean; minimized: boolean };
	registerResult?: boolean;
}) {
	const window = makeWindowOps(
		opts.windowState ?? { focused: true, visible: true, minimized: false },
	);
	const reported: GlobalShortcutStatus[] = [];
	const shortcuts: ShortcutRegistrar = {
		register: vi.fn(() => opts.registerResult ?? true),
		unregisterAll: vi.fn(),
	};
	const controller = new GlobalToggleShortcutController(
		window,
		(status) => reported.push(status),
		shortcuts,
	);
	return { controller, window, shortcuts, reported };
}

describe("GlobalToggleShortcutController", () => {
	it("注册成功：返回 true，状态为 registered 并上报", () => {
		const { controller, reported } = makeController({ registerResult: true });

		expect(controller.register("Shift+Alt+W")).toBe(true);
		expect(controller.status).toEqual({ kind: "registered", accelerator: "Shift+Alt+W" });
		expect(reported).toEqual([{ kind: "registered", accelerator: "Shift+Alt+W" }]);
	});

	it("注册失败（热键被占用）：不抛错，返回 false，状态为 failed 并上报", () => {
		const { controller, reported } = makeController({ registerResult: false });

		expect(controller.register("Shift+Alt+W")).toBe(false);
		expect(controller.status).toEqual({ kind: "failed", accelerator: "Shift+Alt+W" });
		expect(reported).toEqual([{ kind: "failed", accelerator: "Shift+Alt+W" }]);
	});

	it("注册调用抛异常：同样降级为 failed，不外抛", () => {
		const window = makeWindowOps({ focused: true, visible: true, minimized: false });
		const reported: GlobalShortcutStatus[] = [];
		const controller = new GlobalToggleShortcutController(
			window,
			(status) => reported.push(status),
			{
				register: () => {
					throw new Error("invalid accelerator");
				},
				unregisterAll: vi.fn(),
			},
		);

		expect(controller.register("not-a-key")).toBe(false);
		expect(controller.status).toEqual({ kind: "failed", accelerator: "not-a-key" });
	});

	it("toggle：聚焦且可见时最小化", () => {
		const { controller, window } = makeController({
			windowState: { focused: true, visible: true, minimized: false },
		});

		controller.toggle();

		expect(window.minimize).toHaveBeenCalledOnce();
		expect(window.restore).not.toHaveBeenCalled();
		expect(window.show).not.toHaveBeenCalled();
		expect(window.focus).not.toHaveBeenCalled();
	});

	it("toggle：最小化时按 restore → focus 顺序唤起（可见故跳过 show）", () => {
		const { controller, window } = makeController({
			windowState: { focused: false, visible: true, minimized: true },
		});

		controller.toggle();

		expect(window.minimize).not.toHaveBeenCalled();
		expect(window.restore).toHaveBeenCalledOnce();
		expect(window.show).not.toHaveBeenCalled();
		expect(window.focus).toHaveBeenCalledOnce();
	});

	it("toggle：不可见未聚焦时按 show → focus 顺序唤起（未最小化故跳过 restore）", () => {
		const { controller, window } = makeController({
			windowState: { focused: false, visible: false, minimized: false },
		});

		controller.toggle();

		expect(window.restore).not.toHaveBeenCalled();
		expect(window.show).toHaveBeenCalledOnce();
		expect(window.focus).toHaveBeenCalledOnce();
	});

	it("dispose 调 unregisterAll 释放热键", () => {
		const { controller, shortcuts } = makeController({});

		controller.dispose();

		expect(shortcuts.unregisterAll).toHaveBeenCalledOnce();
	});
});
