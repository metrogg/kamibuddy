/**
 * 应用菜单（纯数据 + 纯模板，**不 import electron 的运行时**）。
 *
 * 为什么有这个文件：此前我们从没设过菜单，Electron 于是给出一份**英文默认菜单**
 * —— 里面还带着 Reload / Toggle DevTools 这类开发项，等于把开发菜单发给了用户。
 * 现在照 WorkBuddy 的做法显式接管（`docs/WorkBuddy-reference/extracted/main/menu-builder.js`
 * 用 `Menu.setApplicationMenu` 建原生中文菜单）。
 *
 * 只做三项（关于 / 编辑 / 窗口）而不是 WorkBuddy 的四项：它有一项「帮助」，
 * 而我们没有帮助内容可放 —— 不发明空壳菜单（AGENTS.md §9 YAGNI）。
 *
 * 「编辑」不是装饰：**macOS 上复制粘贴的快捷键由菜单 role 提供**，没有它就按不出
 * Cmd+C/V（Windows 由 Chromium 自己处理，所以那边删菜单不会坏）。将来上 mac 时
 * 这两项是硬依赖，不能顺手剪掉 —— 回归断言在 app-menu.test.ts。
 *
 * Electron 的绑定留在 main/index.ts（同 global-shortcut.ts 的分工：需要单测的
 * 主进程逻辑不 import electron，否则 vitest 里连模块都加载不了）。
 */

import type { MenuItemConstructorOptions } from "electron";

/**
 * 菜单条高度（px）。
 *
 * **必须与 index.ts 的 `titleBarOverlay.height` 用同一个常量**，否则窗口控件
 * 与菜单条错位（那条带子既是菜单栏、也是窗口控件的覆盖层）。
 *
 * 30 是 WorkBuddy 原值（`extracted/main/index.js:21609` 的 `MENUBAR_HEIGHT = 30`），
 * 不是我们自己的档位：它属于「窗口外壳尺寸」，DESIGN.md §2 的间距档不适用
 * （那些档是内容留白，这是系统 chrome 的高度）。登记在 DESIGN.md §3.7。
 */
export const MENUBAR_HEIGHT = 30;

/**
 * 菜单模板。
 *
 * Windows 的 mnemonic 让标签渲染成「关于(A)」（WorkBuddy 截图里就是那样），
 * macOS 的菜单不显示 mnemonic，所以那边给纯标签。
 *
 * `onAbout` 由调用方注入（index.ts 里接 `app.showAboutPanel()`），
 * 这样本函数保持纯粹、可单测。
 */
export function appMenuTemplate(
	isMac: boolean,
	onAbout: () => void,
): MenuItemConstructorOptions[] {
	const label = (text: string, mnemonic: string): string =>
		isMac ? text : `${text}(&${mnemonic})`;
	return [
		{
			label: label("关于", "A"),
			submenu: [
				{ label: "关于 嘉立创Work", click: onAbout },
				{ type: "separator" },
				isMac ? { role: "hide", label: "隐藏" } : { role: "quit", label: "退出" },
			],
		},
		{
			label: label("编辑", "E"),
			submenu: [
				{ role: "undo", label: "撤销" },
				{ role: "redo", label: "重做" },
				{ type: "separator" },
				{ role: "cut", label: "剪切" },
				{ role: "copy", label: "复制" },
				{ role: "paste", label: "粘贴" },
				{ role: "selectAll", label: "全选" },
			],
		},
		{
			label: label("窗口", "W"),
			submenu: [
				{ role: "minimize", label: "最小化" },
				// zoom 只有 macOS 有意义（Windows 的最大化走窗口控件）。
				...(isMac ? [{ role: "zoom" as const, label: "缩放" }] : []),
				{ role: "close", label: "关闭" },
			],
		},
	];
}
