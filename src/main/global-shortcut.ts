/**
 * 全局唤起热键控制器 —— WorkBuddy 5.5.4 GlobalToggleShortcutController 的同款机制
 * （参考 docs/WorkBuddy-reference/extracted/main/index.js:21420 控制器与
 * 23612 toggleVisibility 的判定语义）。
 *
 * 与 WorkBuddy 的两点刻意差异：
 *
 * 1. 「隐藏」改「最小化」。WorkBuddy 有托盘，hide 之后能从托盘图标找回窗口；
 *    我们没有托盘，hide 之后用户没有任何入口把窗口叫回来
 *    （spec: .trae/specs/implement-l23-ui-detail-switches）。最小化在任务栏
 *    始终可见可点，是等效体验里最安全的退场方式。
 *
 * 2. 注册调用（globalShortcut.register / unregisterAll）也注入。
 *    本文件被 vitest 直接 import，纯 Node 环境下 electron 的 globalShortcut
 *    是 undefined；把注册调用抽成注入接口后测试不需要 mock electron 模块。
 *    副作用：本文件完全不 import electron，BrowserWindow 的适配在
 *    main/index.ts 接线处完成。
 */

import {
	DEFAULT_GLOBAL_SHORTCUT,
	type GlobalShortcutStatus,
} from "../shared/ipc.ts";

/** 按下热键那一刻的窗口状态快照（判定纯函数的输入）。 */
export interface WindowStateSnapshot {
	readonly focused: boolean;
	readonly visible: boolean;
	readonly minimized: boolean;
}

/** 判定结果。minimize = 最小化退场；restore-focus = 还原 + 显示 + 聚焦唤起。 */
export type ToggleAction = "minimize" | "restore-focus";

/**
 * toggle 判定，语义对齐 WorkBuddy toggleVisibility（index.js:23618）：
 * 可见且聚焦 → 退场（WorkBuddy 是 hide，我们是最小化，理由见文件头）；
 * 其余一律唤起 —— 最小化、未聚焦、不可见都落到 restore-focus。
 */
export function decideToggleAction(state: WindowStateSnapshot): ToggleAction {
	return state.visible && state.focused ? "minimize" : "restore-focus";
}

/**
 * 窗口操作接口：控制器只认这组回调，不持有 BrowserWindow。
 * 依赖注入让控制器的全部行为可以在无 Electron 环境下单测。
 */
export interface ToggleWindowOperations {
	readonly minimize: () => void;
	readonly restore: () => void;
	readonly show: () => void;
	readonly focus: () => void;
	readonly isFocused: () => boolean;
	readonly isVisible: () => boolean;
	readonly isMinimized: () => boolean;
}

/** globalShortcut 的适配面。生产实现是对 electron globalShortcut 的薄包装。 */
export interface ShortcutRegistrar {
	readonly register: (accelerator: string, callback: () => void) => boolean;
	readonly unregisterAll: () => void;
}

export class GlobalToggleShortcutController {
	#status: GlobalShortcutStatus | undefined;

	constructor(
		private readonly window: ToggleWindowOperations,
		/** 状态上报：注册结果出来时调一次（成功与失败都报），由接线方决定落哪。 */
		private readonly report: (status: GlobalShortcutStatus) => void,
		private readonly shortcuts: ShortcutRegistrar,
	) {}

	get status(): GlobalShortcutStatus | undefined {
		return this.#status;
	}

	/**
	 * 注册全局热键。返回 false（热键被占用）不抛错 —— 经 report 记录 failed
	 * 状态，应用照常启动（WorkBuddy 同款：index.js:21451-21459，连注册异常
	 * 也降级成 failed 上报而不是让启动炸掉；热键是便利功能，不配炸启动）。
	 */
	register(accelerator: string = DEFAULT_GLOBAL_SHORTCUT): boolean {
		let ok = false;
		try {
			ok = this.shortcuts.register(accelerator, () => this.toggle());
		} catch {
			ok = false;
		}
		this.#status = ok
			? { kind: "registered", accelerator }
			: { kind: "failed", accelerator };
		this.report(this.#status);
		return ok;
	}

	/** 热键按下：可见且聚焦 → 最小化；否则唤起（还原 + 显示 + 聚焦）。 */
	toggle(): void {
		const state: WindowStateSnapshot = {
			focused: this.window.isFocused(),
			visible: this.window.isVisible(),
			minimized: this.window.isMinimized(),
		};
		if (decideToggleAction(state) === "minimize") {
			this.window.minimize();
			return;
		}
		// 调用顺序对齐 WorkBuddy（index.js:23620-23622）：先 restore 再 show
		// 最后 focus。focus 必须在窗口可见之后，否则系统可能拒绝置前。
		if (state.minimized) this.window.restore();
		if (!state.visible) this.window.show();
		this.window.focus();
	}

	/** 进程退出时释放（will-quit）。 */
	dispose(): void {
		this.shortcuts.unregisterAll();
	}
}
