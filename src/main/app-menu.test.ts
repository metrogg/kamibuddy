/**
 * 应用菜单模板的回归断言。
 *
 * 这两条不是"测中文文案好看不好看"，而是钉住两件会静默失效的事：
 *   1. 菜单必须是**我们自己**的 —— 之前用的是 Electron 默认菜单（英文，
 *      且带着 Reload / Toggle DevTools 这类开发项），没人会发现"它又回来了"。
 *   2. 「编辑」里的 copy / paste role **不能删** —— macOS 上 Cmd+C/V 由菜单 role
 *      提供，剪掉这一项不会报错、只会让用户按不出复制粘贴（§4.32 决定 3）。
 */

import { describe, expect, it, vi } from "vitest";
import type { MenuItemConstructorOptions } from "electron";
import { MENUBAR_HEIGHT, appMenuTemplate } from "./app-menu.ts";

/** 取某个顶级菜单的子项（模板里的 submenu 一定是数组，这里窄化掉 Menu 那个分支）。 */
function itemsOf(
	template: MenuItemConstructorOptions[],
	index: number,
): MenuItemConstructorOptions[] {
	const submenu = template[index]?.submenu;
	if (!Array.isArray(submenu)) throw new Error(`顶级菜单 ${index} 的子项不是数组`);
	return submenu;
}

describe("appMenuTemplate", () => {
	it("三项中文顶级菜单（关于 / 编辑 / 窗口）", () => {
		const labels = appMenuTemplate(false, () => undefined).map((item) => item.label);
		expect(labels).toEqual(["关于(&A)", "编辑(&E)", "窗口(&W)"]);
	});

	it("macOS 不拼 mnemonic（那边菜单不显示括号字母）", () => {
		const labels = appMenuTemplate(true, () => undefined).map((item) => item.label);
		expect(labels).toEqual(["关于", "编辑", "窗口"]);
	});

	it("「编辑」必须含 copy / paste role —— macOS 的 Cmd+C/V 靠它，删了就是静默失效", () => {
		const roles = itemsOf(appMenuTemplate(false, () => undefined), 1).map((item) => item.role);
		expect(roles).toContain("copy");
		expect(roles).toContain("paste");
		expect(roles).toContain("cut");
	});

	it("「窗口」含最小化与关闭", () => {
		const roles = itemsOf(appMenuTemplate(false, () => undefined), 2).map((item) => item.role);
		expect(roles).toContain("minimize");
		expect(roles).toContain("close");
	});

	it("「关于」点的是注入进来的回调（模板自身不碰 electron）", () => {
		const onAbout = vi.fn();
		const about = itemsOf(appMenuTemplate(false, onAbout), 0)[0];
		expect(about?.label).toBe("关于 嘉立创Work");
		about?.click?.({} as never, undefined, {} as never);
		expect(onAbout).toHaveBeenCalledTimes(1);
	});

	it("菜单条高度就是 WB 原值 30（与 titleBarOverlay.height 同源）", () => {
		expect(MENUBAR_HEIGHT).toBe(30);
	});
});
