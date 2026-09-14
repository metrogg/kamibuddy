/**
 * 规则引擎的行为测试（spec: add-permission-rules-engine）。
 *
 * 每条用例对应一个真实的判定语义，不是覆盖率练习。最关键的防线：
 * 「允许了 git status 不能把 git status && rm -rf 放过去」（拆分最严获胜）。
 */

import { join, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import {
	evaluateCommand,
	evaluatePathRules,
	firstTokenPrefix,
	matchesPrefix,
	parseRulesFile,
	rememberRuleFromApproval,
	splitCommand,
	type PermissionRule,
} from "./permission-rules.ts";

const GIT_ALLOW: PermissionRule = { tool: "powershell", prefix: "git", action: "allow" };
const RM_DENY: PermissionRule = { tool: "powershell", prefix: "Remove-Item", action: "deny" };

describe("splitCommand", () => {
	it("按未加引号的 && / || / ; 切段并 trim", () => {
		expect(splitCommand("git status && dir|| echo hi ;pwd")).toEqual([
			"git status",
			"dir",
			"echo hi",
			"pwd",
		]);
	});

	it("引号内的分隔符不切（单双引号一视同仁）", () => {
		// PowerShell 里 '...' 是字面量、"..." 内 $ 会展开，但拆分只关心
		// 「分隔符是否在字符串里」—— echo "a && b" 是一条命令，不是两条。
		expect(splitCommand('echo "a && b" ; dir')).toEqual(['echo "a && b"', "dir"]);
		expect(splitCommand("echo 'a ; b' && dir")).toEqual(["echo 'a ; b'", "dir"]);
	});

	it("单 | 不切：PowerShell 管道是单条数据流，切了会碎掉正常命令", () => {
		expect(splitCommand("Get-ChildItem | Select-Object Name")).toEqual([
			"Get-ChildItem | Select-Object Name",
		]);
	});

	it("单 & 不切：PowerShell 的调用运算符，不是命令链", () => {
		expect(splitCommand('& "C:\\tools\\x.exe" arg')).toEqual(['& "C:\\tools\\x.exe" arg']);
	});

	it("空段丢弃（连续的或多余的分隔符不产出空命令）", () => {
		expect(splitCommand("git status && ; dir")).toEqual(["git status", "dir"]);
		expect(splitCommand("   ")).toEqual([]);
	});

	it("引号未闭合时剩余部分算一段（不崩，错误方向是多切 → 回落询问）", () => {
		expect(splitCommand('echo "a && dir')).toEqual(['echo "a && dir']);
	});
});

describe("matchesPrefix", () => {
	it("git 命中 git status 与 git 本身", () => {
		expect(matchesPrefix("git status", "git")).toBe(true);
		expect(matchesPrefix("git", "git")).toBe(true);
	});

	it("git 不命中 gitx / gitignore（前缀后必须是空白或结尾）", () => {
		expect(matchesPrefix("gitx status", "git")).toBe(false);
		expect(matchesPrefix("gitignore", "git")).toBe(false);
	});

	it("多词前缀 git log 命中，且 segment 的连续空白折叠后仍能命中", () => {
		expect(matchesPrefix("git log --oneline", "git log")).toBe(true);
		expect(matchesPrefix("git   log   --oneline", "git log")).toBe(true);
		expect(matchesPrefix("git logx", "git log")).toBe(false);
	});

	it("大小写敏感：规则按写回/手写的原文记（v1 保持字面前缀语义）", () => {
		expect(matchesPrefix("Git status", "git")).toBe(false);
	});
});

describe("evaluateCommand（三态与最严获胜）", () => {
	it("全部段命中 allow → allow", () => {
		expect(evaluateCommand("git status && git diff", "powershell", [GIT_ALLOW])).toEqual({ kind: "allow" });
	});

	it("单段命中 allow → allow", () => {
		expect(evaluateCommand("git status --short", "powershell", [GIT_ALLOW])).toEqual({ kind: "allow" });
	});

	it("任一段命中 deny → 整体 deny，reason 指明哪段哪条规则", () => {
		const verdict = evaluateCommand("git status && Remove-Item ./a", "powershell", [GIT_ALLOW, RM_DENY]);
		expect(verdict.kind).toBe("deny");
		if (verdict.kind !== "deny") throw new Error("应为 deny");
		expect(verdict.reason).toContain("Remove-Item ./a");
		expect(verdict.reason).toContain("powershell: Remove-Item");
	});

	it("最严获胜：一段 allow 一段无命中 → unmatched（git 规则不能放行 && 后面的任何东西）", () => {
		expect(evaluateCommand("git status && rm -rf ./dist", "powershell", [GIT_ALLOW]).kind).toBe("unmatched");
	});

	it("同段 allow 与 deny 都命中时 deny 获胜（无歧义的最严）", () => {
		const rules: PermissionRule[] = [GIT_ALLOW, { tool: "powershell", prefix: "git", action: "deny" }];
		expect(evaluateCommand("git status", "powershell", rules).kind).toBe("deny");
	});

	it("无命中 → unmatched（规则不表态，调用方维持原判定）", () => {
		expect(evaluateCommand("Get-Date", "powershell", [GIT_ALLOW]).kind).toBe("unmatched");
		expect(evaluateCommand("Get-Date", "powershell", []).kind).toBe("unmatched");
	});

	it("只认本工具的规则：bash 调用不匹配 powershell 规则", () => {
		// bash 没有危险命令检查器，规则面先不覆盖它 —— 否则一条
		// powershell 的 allow 规则会顺带变成 bash 的放行通道。
		expect(evaluateCommand("git status", "bash", [GIT_ALLOW]).kind).toBe("unmatched");
	});

	it("空命令 → unmatched", () => {
		expect(evaluateCommand("   ", "powershell", [GIT_ALLOW]).kind).toBe("unmatched");
	});
});

describe("evaluatePathRules（路径前缀规则，spec: extend-permission-rules-to-paths）", () => {
	// 用 resolve 构造平台正确的绝对路径，避免在 Windows 上写死盘符而失真。
	const BASE = resolve(sep, "data", "docs");
	const ALLOW_DOCS: PermissionRule = { tool: "read", prefix: BASE, action: "allow" };
	const DENY_SECRETS: PermissionRule = { tool: "read", prefix: join(BASE, "secrets"), action: "deny" };

	it("子孙路径命中 → allow", () => {
		expect(evaluatePathRules(join(BASE, "sub", "file.txt"), [ALLOW_DOCS])).toEqual({ kind: "allow" });
	});

	it("等于 prefix 自身命中（归属语义含目录本身 —— ls 那个目录也该命中）", () => {
		expect(evaluatePathRules(BASE, [ALLOW_DOCS])).toEqual({ kind: "allow" });
	});

	it("target 内部先 resolve：带 .. 的等价路径同样命中（函数独立可用）", () => {
		expect(evaluatePathRules(join(BASE, "sub", "..", "file.txt"), [ALLOW_DOCS])).toEqual({ kind: "allow" });
	});

	it("同名前缀的平级目录不误命中（foobar 不是 foo）", () => {
		const rule: PermissionRule = { tool: "read", prefix: join(resolve(sep, "a"), "foo"), action: "allow" };
		expect(evaluatePathRules(join(resolve(sep, "a"), "foobar", "x.txt"), [rule]).kind).toBe("unmatched");
	});

	it("Windows 大小写不敏感：小写 prefix 命中大写 target", () => {
		// 若判定对大小写敏感，换个大小写就是一条现成的绕过路径。
		const rule: PermissionRule = { tool: "read", prefix: join(resolve(sep, "users"), "someone"), action: "allow" };
		const upperTarget = join(resolve(sep, "USERS"), "SOMEONE", "x.txt");
		// 仅在 win32 上断言：POSIX 下大小写本就是不同路径，不命中是正确行为。
		if (process.platform === "win32") {
			expect(evaluatePathRules(upperTarget, [rule]).kind).toBe("allow");
		}
	});

	it("deny 与 allow 同命中时 deny 获胜（最严，无歧义）", () => {
		const verdict = evaluatePathRules(join(BASE, "secrets", "key.txt"), [ALLOW_DOCS, DENY_SECRETS]);
		expect(verdict.kind).toBe("deny");
		if (verdict.kind !== "deny") throw new Error("应为 deny");
		expect(verdict.reason).toContain(join(BASE, "secrets", "key.txt"));
		expect(verdict.reason).toContain(`read: ${DENY_SECRETS.prefix}`);
	});

	it("非绝对路径 prefix 忽略不生效（规则文件是用户数据，与 parseRulesFile 降级口径一致）", () => {
		const rule: PermissionRule = { tool: "read", prefix: "docs", action: "allow" };
		expect(evaluatePathRules(join(BASE, "x.txt"), [rule]).kind).toBe("unmatched");
	});

	it("tool !== \"read\" 的规则不参与（powershell 的命令规则管不了路径）", () => {
		const rule: PermissionRule = { tool: "powershell", prefix: BASE, action: "allow" };
		expect(evaluatePathRules(join(BASE, "x.txt"), [rule]).kind).toBe("unmatched");
	});

	it("无命中 → unmatched（规则不表态，调用方维持原判定）", () => {
		expect(evaluatePathRules(join(resolve(sep, "elsewhere"), "x.txt"), [ALLOW_DOCS]).kind).toBe("unmatched");
		expect(evaluatePathRules(join(BASE, "x.txt"), []).kind).toBe("unmatched");
	});
});

describe("parseRulesFile（降级口径：坏文件/坏行 = 该行不存在，不抛错）", () => {
	it("坏 JSON → []", () => {
		expect(parseRulesFile("{not json")).toEqual([]);
	});

	it("rules 不是数组 / 顶层不是对象 → []", () => {
		expect(parseRulesFile('{"version":1,"rules":"yes"}')).toEqual([]);
		expect(parseRulesFile('"just a string"')).toEqual([]);
	});

	it("坏行跳过：缺字段 / 空前缀 / action 非法 / 非对象行", () => {
		const json = JSON.stringify({
			version: 1,
			rules: [
				{ tool: "powershell", prefix: "git", action: "allow" },
				{ tool: "powershell", action: "deny" }, // 缺 prefix
				{ tool: "powershell", prefix: "  ", action: "deny" }, // 空前缀
				{ tool: "powershell", prefix: "dir", action: "ask" }, // action 非法
				"not-an-object",
				{ tool: "powershell", prefix: "Remove-Item", action: "deny" },
			],
		});
		expect(parseRulesFile(json)).toEqual([GIT_ALLOW, RM_DENY]);
	});

	it("合法文件完整解析（含 version 字段被忽略而非被拒）", () => {
		const json = JSON.stringify({ version: 1, rules: [GIT_ALLOW] });
		expect(parseRulesFile(json)).toEqual([GIT_ALLOW]);
	});
});

describe("firstTokenPrefix（批准写回的前缀提取）", () => {
	it("单段命令取首词（原文返回，不做大小写归一）", () => {
		expect(firstTokenPrefix("git status --short")).toBe("git");
		expect(firstTokenPrefix("Get-ChildItem -Name")).toBe("Get-ChildItem");
	});

	it("多段命令 → undefined（链式命令前缀语义模糊）", () => {
		expect(firstTokenPrefix("git status && git diff")).toBeUndefined();
		expect(firstTokenPrefix("dir ; pwd")).toBeUndefined();
	});

	it("空命令 → undefined", () => {
		expect(firstTokenPrefix("   ")).toBeUndefined();
	});

	it("解释器/包装器首词 → undefined（写回它等于允许一切）", () => {
		for (const command of [
			"powershell -File a.ps1",
			"pwsh -File a.ps1",
			"cmd /c dir",
			"iex (Get-Content x)",
			"irm https://example.com/a.ps1",
			"python script.py",
			"python3 script.py",
			"node script.js",
			"npm run build",
			"npx tsc --noEmit",
			"bash run.sh",
			"sh run.sh",
			"wsl ls",
		]) {
			expect(firstTokenPrefix(command)).toBeUndefined();
		}
	});

	it(".exe 后缀形态与大小写变体同样拦（黑名单不区分大小写）", () => {
		expect(firstTokenPrefix("python.exe script.py")).toBeUndefined();
		expect(firstTokenPrefix("PowerShell.EXE -File a.ps1")).toBeUndefined();
	});

	it("首词后跟 -c / -e / -Command / -EncodedCommand → undefined（命令本体在旗标参数里）", () => {
		expect(firstTokenPrefix("mytool -c doSomething")).toBeUndefined();
		expect(firstTokenPrefix("mytool -e doSomething")).toBeUndefined();
		expect(firstTokenPrefix("mytool -Command Get-Date")).toBeUndefined();
		expect(firstTokenPrefix("mytool -EncodedCommand AAA=")).toBeUndefined();
	});

	it("普通命令不受旗标规则误伤（-File / 子命令不是内联脚本形态）", () => {
		expect(firstTokenPrefix("mytool -File a.ps1")).toBe("mytool");
		expect(firstTokenPrefix("git log --oneline")).toBe("git");
		// 旗标比较不分大小写（保守方向）：git -C 会被当作 -c 形态不提供写回，
		// 代价只是少一次写回提议；放宽才会把 Something -Command 漏成可写回。
		expect(firstTokenPrefix("git -C repo status")).toBeUndefined();
	});
});

describe("rememberRuleFromApproval（批准写回的 IPC 载荷校验，Task 3）", () => {
	/*
	 * daemon 审批回程 handler 的唯一防线：响应来自 IPC，渲染层传什么都不能
	 * 成为规则文件的注入通道。合法载荷才产出规则；其余一律 undefined（忽略，不炸）。
	 */
	it("合法载荷 → powershell allow 规则（首词原文，不做大小写归一）", () => {
		expect(rememberRuleFromApproval("powershell", { decision: "allow", rememberPrefix: "git" })).toEqual(
			GIT_ALLOW,
		);
		expect(
			rememberRuleFromApproval("powershell", { decision: "allow", rememberPrefix: "Get-ChildItem" }),
		).toEqual({ tool: "powershell", prefix: "Get-ChildItem", action: "allow" });
	});

	it("拒绝决定不写回 —— deny 上附着的 prefix 不该变成 allow 规则", () => {
		expect(
			rememberRuleFromApproval("powershell", { decision: "deny", rememberPrefix: "git" }),
		).toBeUndefined();
	});

	it("覆盖面之外的工具（write / bash）上附着的 prefix 不写回", () => {
		expect(rememberRuleFromApproval("write", { decision: "allow", rememberPrefix: "git" })).toBeUndefined();
		expect(rememberRuleFromApproval("bash", { decision: "allow", rememberPrefix: "git" })).toBeUndefined();
	});

	it("解释器/包装器前缀被忽略（写回它等于允许一切）", () => {
		for (const prefix of ["python", "IEX", "PowerShell.EXE", "node", "wsl", "npm"]) {
			expect(
				rememberRuleFromApproval("powershell", { decision: "allow", rememberPrefix: prefix }),
			).toBeUndefined();
		}
	});

	it("含分隔符或空白的载荷被忽略 —— 写回单位是首词，不是任意字符串", () => {
		for (const prefix of ["git && rm", "git;rm", "git || rm", "git status", " git", "git "]) {
			expect(
				rememberRuleFromApproval("powershell", { decision: "allow", rememberPrefix: prefix }),
			).toBeUndefined();
		}
	});

	it("空白 / 缺失 / 非字符串载荷被忽略，不炸", () => {
		expect(rememberRuleFromApproval("powershell", { decision: "allow", rememberPrefix: "   " })).toBeUndefined();
		expect(rememberRuleFromApproval("powershell", { decision: "allow", rememberPrefix: "" })).toBeUndefined();
		expect(rememberRuleFromApproval("powershell", { decision: "allow" })).toBeUndefined();
		// IPC 对端可以发任何 JSON，类型声明挡不住运行时载荷 —— typeof 兜底必须生效。
		expect(
			rememberRuleFromApproval("powershell", {
				decision: "allow",
				rememberPrefix: 42 as unknown as string,
			}),
		).toBeUndefined();
	});
});

describe("rememberRuleFromApproval 的 read 家族分支（路径写回，spec: extend-permission-rules-to-paths Task 2）", () => {
	/*
	 * 与 powershell 分支同一道防线（响应来自 IPC，不信任对端），只是校验维度
	 * 从「命令首词」换成「路径归属」：绝对路径 + 不在凭据/配置目录内才写回。
	 * 用 resolve 构造平台正确的绝对路径，避免在 Windows 上写死盘符而失真。
	 */
	const HOME = resolve(sep, "users", "someone");
	const GUARD_DIRS = [join(HOME, ".kamibuddy"), join(HOME, ".ssh")];
	const TRUSTED = join(HOME, "KamiBuddy");

	it("合法绝对路径 → tool:read 的 allow 规则；家族五个工具同样受理", () => {
		for (const tool of ["read", "read_document", "find", "grep", "ls"]) {
			expect(rememberRuleFromApproval(tool, { decision: "allow", rememberPrefix: TRUSTED }, GUARD_DIRS)).toEqual(
				{ tool: "read", prefix: resolve(TRUSTED), action: "allow" },
			);
		}
	});

	it("prefix 记 resolve 后的规范形（与 evaluatePathRules 判定 target 的解析口径一致）", () => {
		expect(
			rememberRuleFromApproval(
				"read",
				{ decision: "allow", rememberPrefix: join(TRUSTED, "sub", "..") },
				GUARD_DIRS,
			),
		).toEqual({ tool: "read", prefix: resolve(TRUSTED), action: "allow" });
	});

	it("相对路径不写回 —— 规则匹配按绝对路径做归属判定，写回去也匹配不到", () => {
		expect(
			rememberRuleFromApproval("read", { decision: "allow", rememberPrefix: "docs" }, GUARD_DIRS),
		).toBeUndefined();
		expect(
			rememberRuleFromApproval("ls", { decision: "allow", rememberPrefix: join("..", "隔壁") }, GUARD_DIRS),
		).toBeUndefined();
	});

	it("guardDirs 内的路径不写回（含子孙、含等于）—— 那种规则是死规则，阶段 1 永远先拒", () => {
		expect(
			rememberRuleFromApproval("read", { decision: "allow", rememberPrefix: join(HOME, ".ssh") }, GUARD_DIRS),
		).toBeUndefined();
		expect(
			rememberRuleFromApproval(
				"grep",
				{ decision: "allow", rememberPrefix: join(HOME, ".ssh", "id_rsa") },
				GUARD_DIRS,
			),
		).toBeUndefined();
		expect(
			rememberRuleFromApproval(
				"read",
				{ decision: "allow", rememberPrefix: join(HOME, ".kamibuddy", "auth.json") },
				GUARD_DIRS,
			),
		).toBeUndefined();
	});

	it("guardDirs 未传时不写回 —— 没有禁区知识就不写路径规则（保守方向）", () => {
		expect(rememberRuleFromApproval("read", { decision: "allow", rememberPrefix: TRUSTED })).toBeUndefined();
	});

	it("拒绝决定不写回 —— deny 上附着的路径不该变成 allow 规则", () => {
		expect(
			rememberRuleFromApproval("read", { decision: "deny", rememberPrefix: TRUSTED }, GUARD_DIRS),
		).toBeUndefined();
	});

	it("read 家族之外的工具附着路径不写回（write / bash / 未知工具）", () => {
		expect(
			rememberRuleFromApproval("write", { decision: "allow", rememberPrefix: TRUSTED }, GUARD_DIRS),
		).toBeUndefined();
		expect(
			rememberRuleFromApproval("bash", { decision: "allow", rememberPrefix: TRUSTED }, GUARD_DIRS),
		).toBeUndefined();
		expect(
			rememberRuleFromApproval("mcp__fs__read", { decision: "allow", rememberPrefix: TRUSTED }, GUARD_DIRS),
		).toBeUndefined();
	});

	it("缺失 / 空 / 非字符串载荷被忽略，不炸", () => {
		expect(rememberRuleFromApproval("read", { decision: "allow" }, GUARD_DIRS)).toBeUndefined();
		expect(
			rememberRuleFromApproval("read", { decision: "allow", rememberPrefix: "" }, GUARD_DIRS),
		).toBeUndefined();
		expect(
			rememberRuleFromApproval(
				"read",
				{ decision: "allow", rememberPrefix: 42 as unknown as string },
				GUARD_DIRS,
			),
		).toBeUndefined();
	});

	it("powershell 分支不受 guardDirs 影响（命令前缀校验口径不变）", () => {
		expect(
			rememberRuleFromApproval("powershell", { decision: "allow", rememberPrefix: "git" }, GUARD_DIRS),
		).toEqual(GIT_ALLOW);
	});
});
