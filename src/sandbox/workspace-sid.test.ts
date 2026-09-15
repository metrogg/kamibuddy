/**
 * capability SID 派生的测试。纯函数，任何平台都能跑。
 *
 * 确定性是**性能设计的前提**：同一工作区每次得到同一 SID，上次留下的常驻 ACE
 * 才能命中幂等快路径（实测 1ms，而首次授权在 5000 文件的树上要 3134ms）。
 * 派生一旦不稳定，每次会话都要重新传播 ACE —— 大工作区会卡几十秒。
 */

import { describe, expect, it } from "vitest";
import { tempWriteSid, workspaceWriteSid } from "./workspace-sid.ts";

/** S-1-4-<uint32>-<0..65535>：SECURITY_NON_UNIQUE_AUTHORITY 段，不与真实账号冲突。 */
const SID_SHAPE = /^S-1-4-\d+-\d+$/;

describe("workspaceWriteSid", () => {
	it("形状是 S-1-4-*", () => {
		expect(workspaceWriteSid("C:\\Users\\foo\\KamiBuddy")).toMatch(SID_SHAPE);
	});

	it("同一路径恒定——常驻 ACE 复用靠这条", () => {
		const path = "C:\\Users\\foo\\KamiBuddy";
		expect(workspaceWriteSid(path)).toBe(workspaceWriteSid(path));
	});

	it("不同路径得到不同 SID——否则两个工作区互相授权", () => {
		expect(workspaceWriteSid("C:\\a")).not.toBe(workspaceWriteSid("C:\\b"));
	});

	it("大小写不敏感：Windows 上这是同一个目录", () => {
		// 大小写敏感会让「换个拼法」绕过幂等，每次都重新传播 ACE
		expect(workspaceWriteSid("C:\\Users\\Foo\\KamiBuddy")).toBe(
			workspaceWriteSid("c:\\users\\foo\\kamibuddy"),
		);
	});

	it("子权限值落在 uint32 范围内", () => {
		// 负数或超界会让 ConvertStringSidToSidW 直接失败
		const parts = workspaceWriteSid("C:\\Users\\foo\\KamiBuddy").split("-");
		const high = Number(parts[3]);
		const low = Number(parts[4]);
		expect(Number.isInteger(high)).toBe(true);
		expect(high).toBeGreaterThanOrEqual(0);
		expect(high).toBeLessThanOrEqual(0xffffffff);
		expect(low).toBeGreaterThanOrEqual(0);
		expect(low).toBeLessThanOrEqual(0xffff);
	});

	it("相近路径不碰撞", () => {
		const sids = new Set([
			workspaceWriteSid("C:\\work\\a"),
			workspaceWriteSid("C:\\work\\b"),
			workspaceWriteSid("C:\\work\\a\\b"),
			workspaceWriteSid("C:\\work"),
		]);
		expect(sids.size).toBe(4);
	});
});

describe("tempWriteSid", () => {
	it("形状与确定性同工作区 SID", () => {
		const path = "C:\\Temp\\kamibuddy-sandbox\\abc";
		expect(tempWriteSid(path)).toMatch(SID_SHAPE);
		expect(tempWriteSid(path)).toBe(tempWriteSid(path));
	});

	it("与工作区 SID 分开——两块授权要能独立撤销", () => {
		// 同一路径下两者也必须不同（盐不同）：共用会让撤销工作区顺带影响 temp
		const path = "C:\\Users\\foo\\KamiBuddy";
		expect(tempWriteSid(path)).not.toBe(workspaceWriteSid(path));
	});
});
