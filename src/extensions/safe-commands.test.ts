/**
 * 内置安全命令名单的测试。
 *
 * 这里的每一条都对应一个**放行判断**：判错的后果不是功能不好用，而是模型在
 * 无人审批的情况下执行了它不该执行的东西。所以注入向量要逐条钉死，
 * 而不是抽样几个。
 *
 * 纯函数，任何平台可跑。
 */

import { describe, expect, it } from "vitest";
import {
	classifySafeCommand,
	commandTouchesConfigAsCode,
	hasCleanStructure,
} from "./safe-commands.ts";

describe("第一层：只读自省（无条件免审批）", () => {
	it("git 的只读子命令", () => {
		for (const command of [
			"git status",
			"git status --short",
			"git diff",
			"git diff HEAD~1",
			"git log --oneline -20",
			"git show HEAD",
			"git rev-parse --abbrev-ref HEAD",
		]) {
			expect(classifySafeCommand(command), command).toBe("always");
		}
	});

	it("版本查询与当前目录", () => {
		for (const command of ["node --version", "node -v", "npm --version", "git --version", "pwd", "Get-Location"]) {
			expect(classifySafeCommand(command), command).toBe("always");
		}
	});

	it("大小写不敏感（PowerShell 本身不区分，不该因大写多一次弹窗）", () => {
		for (const command of ["GIT STATUS", "Git Status --short", "Node --Version"]) {
			expect(classifySafeCommand(command), command).toBe("always");
		}
	});

	it("空白容错（多空格、首尾空白）", () => {
		expect(classifySafeCommand("  git   status  ")).toBe("always");
	});
});

describe("第二层：构建类（需要沙箱生效）", () => {
	it("跑项目自己的脚本", () => {
		for (const command of ["npm run build", "npm test", "npm run lint -- --fix", "npx tsc", "tsc --noEmit"]) {
			expect(classifySafeCommand(command), command).toBe("sandboxed");
		}
	});

	it("大小写不敏感", () => {
		expect(classifySafeCommand("Npm Run Build")).toBe("sandboxed");
	});
});

describe("有意排除的命令（列进名单会是错的）", () => {
	it("**npm install / npm ci 不在名单**（执行依赖包的 install 脚本 = 供应链入口）", () => {
		for (const command of ["npm install", "npm ci", "npm i", "npm install lodash", "npm install --save-dev x"]) {
			expect(classifySafeCommand(command), command).toBe("unlisted");
		}
	});

	it("**git branch 不在名单**（git branch -D 是写操作，前缀分不出来）", () => {
		expect(classifySafeCommand("git branch")).toBe("unlisted");
		expect(classifySafeCommand("git branch -D feature")).toBe("unlisted");
	});

	it("写类 git 子命令一律不在名单", () => {
		for (const command of ["git commit -m x", "git push", "git checkout main", "git reset --hard", "git clean -fd"]) {
			expect(classifySafeCommand(command), command).toBe("unlisted");
		}
	});

	it("只写程序名不算（那等于放行任意脚本）", () => {
		for (const command of ["node", "node evil.js", "python evil.py", "npm"]) {
			expect(classifySafeCommand(command), command).toBe("unlisted");
		}
	});

	it("前缀边界：git statusx 不算 git status", () => {
		expect(classifySafeCommand("git statusx")).toBe("unlisted");
		expect(classifySafeCommand("git statuses")).toBe("unlisted");
	});

	it("未登记的普通命令维持询问", () => {
		for (const command of ["Remove-Item x", "curl https://example.com", "Get-Content secret.txt"]) {
			expect(classifySafeCommand(command), command).toBe("unlisted");
		}
	});
});

describe("结构闸门（本模块最要紧的一处）", () => {
	it("**管道**：splitCommand 刻意不切单个 |，所以必须在这里堵", () => {
		/*
		 * 这是最容易漏的一条：`git status | node -e "<任意代码>"` 整体以
		 * `git status` 开头，前缀匹配会放过它，而危险命令检查器也拦不住
		 * （它只认 iex / 下载执行那几类）。
		 */
		for (const command of [
			'git status | node -e "require(\'child_process\').exec(\'evil\')"',
			"git log | Out-File x.txt",
			"npm run build | Invoke-Expression",
		]) {
			expect(classifySafeCommand(command), command).toBe("unlisted");
		}
	});

	it("**重定向**：会把「只读命令」变成写文件", () => {
		for (const command of ["git log > out.ps1", "git status >> log.txt", "git diff < in.txt"]) {
			expect(classifySafeCommand(command), command).toBe("unlisted");
		}
	});

	it("**链式命令**：整体语义不等于各段之和", () => {
		for (const command of [
			"git status && Remove-Item -Recurse x",
			"git status; curl evil.com",
			"git status || npm install",
		]) {
			expect(classifySafeCommand(command), command).toBe("unlisted");
		}
	});

	it("**子表达式与调用运算符**", () => {
		for (const command of [
			"git status $(evil)",
			"git log @(evil)",
			"git status & C:\\evil.exe",
			"git status `evil`",
			"npm run ${evil}",
		]) {
			expect(classifySafeCommand(command), command).toBe("unlisted");
		}
	});
});

describe("旗标注入（让「只读命令」跑起任意程序）", () => {
	it("**git -c 临时配置注入**（等同于改 .git/config，那条路已要审批）", () => {
		for (const command of [
			"git -c core.fsmonitor=evil status",
			"git -c core.pager=evil log",
			'git -c alias.x="!evil" status',
			"git --config-env=core.pager=X status",
		]) {
			expect(classifySafeCommand(command), command).toBe("unlisted");
		}
	});

	it("git 的外部程序驱动旗标", () => {
		for (const command of [
			"git diff --ext-diff",
			"git log --pager=evil",
			"git status --exec-path=C:\\evil",
			"git diff --editor=evil",
		]) {
			expect(classifySafeCommand(command), command).toBe("unlisted");
		}
	});

	it("git 改变仓库位置的旗标（配合恶意 .git 目录）", () => {
		expect(classifySafeCommand("git --git-dir=C:\\evil\\.git status")).toBe("unlisted");
		expect(classifySafeCommand("git --work-tree=C:\\ status")).toBe("unlisted");
	});

	it("node/npm 的求值与注入旗标", () => {
		for (const command of [
			"node --require ./evil.js --version",
			"node -e 'evil()'",
			"npm run build --node-options=--require=./evil.js",
			"npm run build --prefix C:\\evil",
		]) {
			expect(classifySafeCommand(command), command).toBe("unlisted");
		}
	});

	it("写文件旗标（第一层的前提是不写）", () => {
		expect(classifySafeCommand("git log -o out.txt")).toBe("unlisted");
		expect(classifySafeCommand("git log --output=out.txt")).toBe("unlisted");
	});

	it("`--output=x` 与 `--output x` 同样拦（比较时去掉 = 之后的部分）", () => {
		expect(classifySafeCommand("git log --output=x")).toBe("unlisted");
		expect(classifySafeCommand("git log --output x")).toBe("unlisted");
	});

	it("旗标匹配是**精确**的，不误伤同前缀的正常旗标", () => {
		// --oneline 不该因为以 -o 开头而被拦；--reverse 不该撞上 -r。
		expect(classifySafeCommand("git log --oneline")).toBe("always");
		expect(classifySafeCommand("git log --reverse")).toBe("always");
		expect(classifySafeCommand("git diff --stat")).toBe("always");
	});

	it("大小写不敏感的旗标匹配（换大写不该绕过）", () => {
		expect(classifySafeCommand("git -C core.fsmonitor=evil status")).toBe("unlisted");
		expect(classifySafeCommand("git log --OUTPUT=x")).toBe("unlisted");
	});
});


describe("退化输入", () => {
	it("空命令与纯空白不放行", () => {
		for (const command of ["", "   ", "\t"]) {
			expect(classifySafeCommand(command), JSON.stringify(command)).toBe("unlisted");
		}
	});
});

describe("配置文本闸（commandTouchesConfigAsCode，四期先跑后问的闸门）", () => {
	it("命令写到配置路径 → 命中", () => {
		for (const command of [
			'Set-Content .git\\config "[core]"',
			"Set-Content .git/config x",
			'Out-File -FilePath package.json',
			"Remove-Item C:\\repo\\.git\\hooks\\pre-commit",
			"New-Item .pi\\extensions\\x.ts",
			"Copy-Item evil.ts .agents\\skills\\x\\SKILL.md",
			"git log > .git\\hooks\\x",
		]) {
			expect(commandTouchesConfigAsCode(command), command).toBe(true);
		}
	});

	it("大小写与正反斜杠同判（Windows 语义）", () => {
		expect(commandTouchesConfigAsCode('Set-Content .GIT\\CONFIG x')).toBe(true);
		expect(commandTouchesConfigAsCode("Set-Content PACKAGE.JSON x")).toBe(true);
	});

	it("普通命令不命中（先跑后问的主力人群）", () => {
		for (const command of [
			"Get-ChildItem",
			"Get-Content report.md",
			"npm run build",
			"Copy-Item a.txt b.txt",
			"Remove-Item ./dist -Recurse",
			"git log --oneline",
		]) {
			expect(commandTouchesConfigAsCode(command), command).toBe(false);
		}
	});

	it("子串不误伤：gitignore、github.io 不算 .git", () => {
		/*
		 * 切分按路径分隔符与 shell 元字符进行，`.git` 必须独立成段才命中 ——
		 * `.gitignore` 是一个 token、不含 `.git` 段。
		 */
		expect(commandTouchesConfigAsCode("Write-Host see gitignore docs")).toBe(false);
		expect(commandTouchesConfigAsCode("git log .gitignore")).toBe(false);
	});

	it("只提到目录本身不算（mkdir 语义）", () => {
		expect(commandTouchesConfigAsCode("New-Item -ItemType Directory .git")).toBe(false);
	});

	it("拆散的拼接穿得过文本闸（**如实钉住残留风险**）", () => {
		/*
		 * 这条不是 bug 是边界。探针实测（四期实现时）：
		 *   `Join-Path ".git" "config"` —— **抓得到**！`.git`、`config` 作为
		 *     两个引号字符串在文本里相邻出现，正好命中段序列；
		 *   `".git" + "\config"` —— 同样抓得到（".git" 独立成段）。
		 * 真正穿过的是把名单段本身拆开的形态（`.git` 拆成 "." + "git"）——
		 * 此时文本里不存在任何名单段。文本闸防字面量、防拆散拼接不住；
		 * 语义级解析（tree-sitter）是下一期方向。残留方向仍安全：
		 * 穿过的命令跑在沙箱内，写范围受 OS 约束。
		 */
		expect(commandTouchesConfigAsCode('$p = Join-Path ".git" "config"; Set-Content $p x')).toBe(true);
		expect(commandTouchesConfigAsCode('$d = "." + "git" + "' + String.fromCharCode(92) + 'config"; Set-Content $d x')).toBe(false);
	});
});

describe("结构干净判定（hasCleanStructure，先跑后问的放行前提）", () => {
	it("单段普通命令干净", () => {
		expect(hasCleanStructure("Get-ChildItem")).toBe(true);
		expect(hasCleanStructure("npm run build")).toBe(true);
	});

	it("管道/链式/重定向/注入旗标不干净 —— 绝不能进先跑后问", () => {
		for (const command of [
			'git status | node -e "evil()"',
			"git status && Remove-Item x",
			"git log > out.txt",
			"git -c core.fsmonitor=evil status",
		]) {
			expect(hasCleanStructure(command), command).toBe(false);
		}
	});
});
