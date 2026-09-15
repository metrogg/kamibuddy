/**
 * workspace-picker 的 chip 文案纯函数测试。
 *
 * renderer 无组件测试基建（只有纯函数测试先例，见 task-agent-card.test.ts），
 * 故把「chip 显示什么」抽成 pickerLabel 直接钉住，不渲染组件。
 *
 * 要防两类回归：
 *   1. 未选态必须显示提示语「选择工作空间」（对齐 WorkBuddy 的
 *      `chatInput.workspacePicker.label` 兜底），不能拿某个空间名当占位；
 *   2. 每任务独立目录落地后，未选工作空间的新任务 cwd 变成
 *      `<生效根>/YYYY-MM-DD-HH-mm-ss`（spec: align-per-task-dirs），若直接 baseName，
 *      chip 会退化成一串时间戳，用户会以为自己选了个叫时间戳的空间。
 */

import { describe, expect, it } from "vitest";
import { pickerLabel } from "./workspace-picker.tsx";

describe("pickerLabel（chip 显示的工作空间名）", () => {
	it("未选 / 待分配（空串、undefined）显示提示语「选择工作空间」", () => {
		expect(pickerLabel("")).toBe("选择工作空间");
		expect(pickerLabel(undefined)).toBe("选择工作空间");
	});

	it("自动分配目录（时间戳）语义上仍是未选工作空间，显示「临时任务」（有意偏离 WorkBuddy 的 basename）", () => {
		expect(pickerLabel("C:\\Users\\wzd\\KamiBuddy\\2026-09-14-17-30-45")).toBe("临时任务");
		expect(pickerLabel("/home/u/KamiBuddy/2026-09-14-17-30-45")).toBe("临时任务");
	});

	it("历史共享临时目录（basename 天然是「临时任务」）", () => {
		expect(pickerLabel("C:\\Users\\wzd\\KamiBuddy\\临时任务")).toBe("临时任务");
	});

	it("命名工作空间显示目录名", () => {
		expect(pickerLabel("C:\\Users\\wzd\\KamiBuddy\\季度汇报")).toBe("季度汇报");
		expect(pickerLabel("/home/u/KamiBuddy/proj")).toBe("proj");
	});

	it("仅在「像」自动目录时兜底：非严格格式的目录名照常显示", () => {
		expect(pickerLabel("C:\\Users\\wzd\\KamiBuddy\\automation-2026-09-14-17-30-45")).toBe(
			"automation-2026-09-14-17-30-45",
		);
		expect(pickerLabel("C:\\Users\\wzd\\KamiBuddy\\2026-9-1-1-1-1")).toBe("2026-9-1-1-1-1");
	});
});
