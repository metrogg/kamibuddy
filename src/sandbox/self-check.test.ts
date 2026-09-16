/**
 * 自检失败文案的测试。
 *
 * 为什么这段文本值得单测：2026-09-15 的故障里，「沙箱让每条命令都失败」被当成
 * 「命令执行失败」原样报给了模型，我们**没有任何线索**能定位根因 —— 事后只能靠
 * 猜。自检失败文案是唯一会落进事件日志的诊断信息，退出码若被丢掉或归一化，
 * 自检就只剩「不可用」三个字，等于白做。
 *
 * 纯函数，不触发 koffi 加载（ffi.ts 的 koffi 是动态 import），任何平台都能跑。
 */

import { describe, expect, it } from "vitest";
import { describeSelfCheckFailure, isAclCapableFileSystem } from "./index.ts";

/** 造一个自检结果。缺省是「非预期退出码」这条最常见的失败形态。 */
function outcome(patch: {
	readonly exitCode?: number | null;
	readonly stdout?: string;
	readonly stderr?: string;
	readonly timedOut?: boolean;
}): Parameters<typeof describeSelfCheckFailure>[0] {
	return {
		stdout: "",
		stderr: "",
		exitCode: 1,
		timedOut: false,
		...patch,
	};
}

describe("describeSelfCheckFailure", () => {
	it("保留十进制与十六进制退出码", () => {
		const text = describeSelfCheckFailure(outcome({ exitCode: 1 }));
		expect(text).toContain("1");
		expect(text).toContain("0x00000001");
		// 期望值也要在文本里，否则读者不知道「1」为什么算失败
		expect(text).toContain("7");
	});

	it("认得 0xC0000142 并点名（这就是那次故障的退出码）", () => {
		const text = describeSelfCheckFailure(outcome({ exitCode: 0xc0000142 }));
		expect(text).toContain("0xC0000142");
		expect(text).toContain("STATUS_DLL_INIT_FAILED");
		expect(text).toContain("DLL 初始化");
	});

	it("**带符号视图的同一个码也认得**", () => {
		/*
		 * PowerShell 的 $LASTEXITCODE 与 cmd 显示的是带符号视图
		 * （0xC0000142 → -1073741502）。不做符号归一就会漏掉名称标注，
		 * 而那正是最有价值的那半条线索。
		 */
		const text = describeSelfCheckFailure(outcome({ exitCode: -1073741502 }));
		expect(text).toContain("0xC0000142");
		expect(text).toContain("STATUS_DLL_INIT_FAILED");
	});

	it("未知退出码给出十六进制但不硬套名称", () => {
		const text = describeSelfCheckFailure(outcome({ exitCode: 0xe0434352 }));
		expect(text).toContain("0xE0434352");
		expect(text).not.toContain("STATUS_DLL_INIT_FAILED");
	});

	it("超时单独成一类（没有退出码可报）", () => {
		const text = describeSelfCheckFailure(outcome({ timedOut: true, exitCode: null }));
		expect(text).toContain("未结束");
		expect(text).not.toContain("0x");
	});

	it("被杀（exitCode 为 null 且非超时）如实说明", () => {
		const text = describeSelfCheckFailure(outcome({ exitCode: null }));
		expect(text).toContain("没有退出码");
	});

	it("带上进程输出——有时那才是唯一的线索", () => {
		const text = describeSelfCheckFailure(
			outcome({ exitCode: 1, stderr: "拒绝访问。" }),
		);
		expect(text).toContain("拒绝访问");
	});

	it("输出过长时截断，不让日志被一条记录撑爆", () => {
		const text = describeSelfCheckFailure(outcome({ exitCode: 1, stdout: "A".repeat(5_000) }));
		expect(text.length).toBeLessThan(600);
	});
});

/**
 * 文件系统判据。
 *
 * 为什么这几行值得单测：它守的是**假边界** —— exFAT 上授权会「成功」但毫无效果，
 * 判错的后果是界面显示沙箱生效而实际什么都没约束住。而三期的审批放松要拿
 * 「沙箱可用」当依据，那时判错就等于「在没有写约束的地方免审批执行命令」。
 */
describe("isAclCapableFileSystem", () => {
	it("NTFS 与 ReFS 支持 ACL", () => {
		expect(isAclCapableFileSystem("NTFS")).toBe(true);
		expect(isAclCapableFileSystem("ReFS")).toBe(true);
	});

	it("FAT 家族一律不支持（授权会静默无效）", () => {
		for (const name of ["FAT32", "exFAT", "FAT"]) {
			expect(isAclCapableFileSystem(name), name).toBe(false);
		}
	});

	it("**大小写不敏感** —— 这是这个判据的失效点", () => {
		/*
		 * 名单是全大写的，而 GetVolumeInformationW 回什么形态不由我们决定。
		 * 漏一次归一化就把 NTFS 判成「不支持」（沙箱在正常卷上永久不可用），
		 * 而把归一化写反则会把 exfat 判成「支持」（假边界，更糟）。
		 */
		expect(isAclCapableFileSystem("ntfs")).toBe(true);
		expect(isAclCapableFileSystem("NtFs")).toBe(true);
		expect(isAclCapableFileSystem("exfat")).toBe(false);
		expect(isAclCapableFileSystem("EXFAT")).toBe(false);
	});

	it("未知文件系统按不支持处理（fail-closed）", () => {
		// 网络盘的某些实现、以及将来出现的新文件系统：不认识就不假装能约束。
		expect(isAclCapableFileSystem("NFS")).toBe(false);
		expect(isAclCapableFileSystem("")).toBe(false);
	});
});
