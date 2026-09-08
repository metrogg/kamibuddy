/**
 * 权限词汇表的测试。
 *
 * 这里测的都是纯函数，但它们承载两个容易在改动中被破坏的契约：
 *   1. **预设 ↔ 旋钮的双向一致**：预设是 UI 糖，旋钮是真相。
 *      若 presetIdFor 与预设表脱节，界面会显示成用户没选过的那一档。
 *   2. **审批策略 never = 拒绝**，不是放行。这条方向搞反就是个静默的后门。
 */

import { describe, expect, it } from "vitest";
import {
	APPROVAL_POLICIES,
	CUSTOM_PRESET,
	DEFAULT_PERMISSIONS,
	PERMISSION_PRESETS,
	SANDBOX_MODES,
	canEscalate,
	findPreset,
	isApprovalPolicy,
	isSandboxMode,
	presetIdFor,
	resolveAsk,
	WIDER_MODES,
	type SandboxMode,
} from "./permissions.ts";

describe("词汇表", () => {
	it("沙箱模式取值与 codex / dsh 逐字一致", () => {
		// 两个独立项目收敛到同一套词汇（codex protocol/src/config_types.rs:104、
		// dsh packages/sandbox/sandbox/src/index.ts）。改这里等于造方言，
		// 以后对照源码要多一层翻译。
		expect(SANDBOX_MODES).toEqual(["read-only", "workspace-write", "danger-full-access"]);
	});

	it("审批策略取值与 dsh 一致", () => {
		expect(APPROVAL_POLICIES).toEqual(["ask", "never"]);
	});

	it("类型守卫拒绝未知值", () => {
		expect(isSandboxMode("read-only")).toBe(true);
		expect(isSandboxMode("readonly")).toBe(false);
		expect(isSandboxMode("yolo")).toBe(false);
		expect(isApprovalPolicy("never")).toBe(true);
		expect(isApprovalPolicy("on-failure")).toBe(false);
	});
});

describe("预设与旋钮的一致性", () => {
	it("每个预设都能被自己的旋钮反查回来", () => {
		// 这条防的是"加了新预设但与已有预设旋钮重复"——那样 presetIdFor
		// 会返回先命中的那个，界面显示的档位就跟用户点的不是同一个。
		for (const preset of PERMISSION_PRESETS) {
			expect(presetIdFor(preset.sandbox, preset.approval)).toBe(preset.id);
		}
	});

	it("预设 id 不重复", () => {
		const ids = PERMISSION_PRESETS.map((p) => p.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("旋钮组合不重复 —— 否则反查必然歧义", () => {
		const combos = PERMISSION_PRESETS.map((p) => `${p.sandbox}/${p.approval}`);
		expect(new Set(combos).size).toBe(combos.length);
	});

	it("无匹配组合返回 custom", () => {
		// read-only + never：能构造但没有对应预设（只读还不问，没有实际意义）。
		expect(presetIdFor("read-only", "never")).toBe(CUSTOM_PRESET);
	});

	it("findPreset 认得所有预设、不认得 custom", () => {
		for (const preset of PERMISSION_PRESETS) {
			expect(findPreset(preset.id)?.sandbox).toBe(preset.sandbox);
		}
		expect(findPreset(CUSTOM_PRESET)).toBeUndefined();
		expect(findPreset("不存在")).toBeUndefined();
	});

	it("默认设置 = 引入模式之前的行为（workspace-write + ask）", () => {
		// 这条钉住向后兼容：默认值一变，所有既有用户的权限就悄悄变了。
		expect(DEFAULT_PERMISSIONS.sandbox).toBe("workspace-write");
		expect(DEFAULT_PERMISSIONS.approval).toBe("ask");
		expect(DEFAULT_PERMISSIONS.presetId).toBe(presetIdFor("workspace-write", "ask"));
	});

	it("三档预设覆盖「只读 / 默认 / 完全访问」这条产品语义", () => {
		const byId = new Map(PERMISSION_PRESETS.map((p) => [p.id, p]));
		expect(byId.get("readonly")?.sandbox).toBe("read-only");
		expect(byId.get("default")?.sandbox).toBe("workspace-write");
		expect(byId.get("full")?.sandbox).toBe("danger-full-access");
		// 「完全访问」必须同时关掉逐次询问，否则它跟默认档的体感差别不大。
		expect(byId.get("full")?.approval).toBe("never");
	});

	it("每档都有面向用户的说明文案", () => {
		for (const preset of PERMISSION_PRESETS) {
			expect(preset.label.length).toBeGreaterThan(0);
			expect(preset.description.length).toBeGreaterThan(10);
		}
	});
});

describe("审批策略的语义", () => {
	it("ask → 询问", () => {
		expect(resolveAsk("ask")).toBe("ask");
	});

	it("never → 拒绝（**不是**放行）", () => {
		// 方向搞反就是个静默后门：无人值守时"不问"必须等于"不做"。
		expect(resolveAsk("never")).toBe("deny");
	});
});

describe("提权阶梯（严格变宽）", () => {
	/*
	 * ⚠️ 这些函数目前**没有生产调用点**：提权流程（模型经工具入参请求变宽 →
	 * fail-closed 审批 → 执行）还没建，本轮只落了词汇与约束。
	 * 保留它是因为"只能往宽走"这条约束值得先钉住 —— 等流程落地时
	 * 直接复用，不必重新推导；测试保证它在此期间不腐坏。
	 */
	it("只能往更宽的模式提权", () => {
		expect(canEscalate("read-only", "workspace-write")).toBe(true);
		expect(canEscalate("read-only", "danger-full-access")).toBe(true);
		expect(canEscalate("workspace-write", "danger-full-access")).toBe(true);
	});

	it("不能往更严的模式「提权」", () => {
		// 防的是模型把 danger-full-access 会话"降级"成 read-only 再声称受限，
		// 或在阶梯上反复横跳绕过审批记录。
		expect(canEscalate("workspace-write", "read-only")).toBe(false);
		expect(canEscalate("danger-full-access", "read-only")).toBe(false);
		expect(canEscalate("danger-full-access", "workspace-write")).toBe(false);
	});

	it("不能提权到自身（空操作不该消耗一次审批）", () => {
		for (const mode of SANDBOX_MODES) {
			expect(canEscalate(mode, mode)).toBe(false);
		}
	});

	it("最宽的模式无处可提", () => {
		expect(WIDER_MODES["danger-full-access"]).toEqual([]);
	});

	it("阶梯表覆盖所有模式 —— 漏一个就会在运行时取到 undefined", () => {
		for (const mode of SANDBOX_MODES) {
			expect(Array.isArray(WIDER_MODES[mode as SandboxMode])).toBe(true);
		}
	});
});
