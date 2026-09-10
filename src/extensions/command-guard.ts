/**
 * 危险命令检查器：powershell 工具执行前的静态文本检查（纯函数，可单测）。
 *
 * 【边界，必读】这是 **best-effort 的静态分析，不是沙箱**。
 * 绕过它并不难——base64 换个编码方式、把命令拆进变量再拼接、写个脚本文件
 * 再执行，文本匹配都看不见。它存在的意义是挡住**常见形态**的危险命令
 * （模型按惯用写法生成的那批），并把「为什么不行、怎么改」回给模型。
 * 真正的防线在权限门（permission-policy）：powershell 在 balanced 档是
 * 高风险逐次询问，命令全文摆给用户看；检查器是询问之外的第二道护栏，
 * 管「这条命令能不能跑」，门管「要不要问人」。所以没有 OS 沙箱之前，
 * 检查器漏过的奇技淫巧由人来终审 —— 这也决定了这里的策略是
 * 「宁可误伤常见危险写法，不为减少误报而收窄」。
 *
 * 拦截类别（AGENTS.md §2 点名的前置条件）：
 *   dynamic-execution       动态执行：iex / Invoke-Expression / Add-Type /
 *                           -EncodedCommand 族（含 -e -ec -enc 等缩写）/
 *                           远程 Invoke-Command
 *   download-execute        下载执行：DownloadString/DownloadFile，
 *                           或 curl/wget/iwr 的结果管道进 iex/powershell
 *   credential-access       凭据目录访问：与权限门凭据清单同源
 *                           （defaultProtectedDirs 派生，不另写一份）+ .kamibuddy/auth.json
 *   recursive-force-delete  递归强制删除：Remove-Item -Recurse -Force 及
 *                           rd /s /q、del /s 等同款语义
 *   system-damage           系统破坏：shutdown / Restart-Computer / format /
 *                           diskpart / reg delete / Set-ExecutionPolicy /
 *                           bcdedit / net user 增删 / takeown+icacls 夺权
 *
 * 命中即拒，返回类别 + 写给模型看的可读原因（含改法指引）；未命中放行。
 * 匹配全部大小写不敏感——PowerShell 本身不区分大小写，检查也不该区分。
 */

import { relative } from "node:path";
import { defaultProtectedDirs } from "./permission-policy.ts";

export type CommandBlockCategory =
	| "dynamic-execution"
	| "download-execute"
	| "credential-access"
	| "recursive-force-delete"
	| "system-damage";

export interface CommandBlock {
	readonly blocked: true;
	readonly category: CommandBlockCategory;
	/** 写给模型看的原因与改法（中文，可行动）。 */
	readonly reason: string;
}

/**
 * 凭据路径片段：从权限门的 defaultProtectedDirs 派生（单一来源，
 * permission-policy.ts 里有选取标准），转成与分隔符无关的文本模式。
 * 哨兵家目录只用于取相对段（".ssh"、".pi/agent" …），不匹配任何真实路径。
 */
const SENTINEL_HOME = "command-guard-home";
const credentialSegments: readonly string[] = defaultProtectedDirs(SENTINEL_HOME).map((dir) =>
	relative(SENTINEL_HOME, dir),
);

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 片段 → 路径组件匹配：前面不能紧跟名字字符（`foo.ssh` 不算），
 * 后面不能延续名字（`.sshd` 不算）；`.pi/agent` 这类多级段允许 \ 或 /。
 * Windows 路径大小写不敏感，一律 i。
 */
function segmentPattern(segment: string): RegExp {
	const parts = segment.split(/[\\/]+/).map(escapeRegExp);
	return new RegExp(`(?<![\\w.-])${parts.join("[\\\\/]+")}(?![\\w-])`, "i");
}

const CREDENTIAL_PATTERNS: ReadonlyArray<{ readonly label: string; readonly pattern: RegExp }> = [
	...credentialSegments.map((segment) => ({
		label: segment.replace(/[\\/]+/g, "/"),
		pattern: segmentPattern(segment),
	})),
	// 配置目录与其中的登录态：权限门按绝对路径拦（configDir 禁读禁写），
	// 命令文本里只能按名字拦，保守处理——sessions 等非凭据内容模型本不该
	// 用 shell 去读（有 read 工具与正常工作目录）。
	{ label: ".kamibuddy", pattern: segmentPattern(".kamibuddy") },
	{ label: "auth.json", pattern: segmentPattern("auth.json") },
];

/**
 * 抽出命令里的单破折号参数名（小写）。双破折号（--version）不算——
 * PowerShell 参数是单破折号，双破折号是别的程序的惯例。
 * 用于识别参数缩写：PowerShell 允许把参数名缩写成任意无歧义前缀
 * （-EncodedCommand 可以写成 -ec、-enc …），所以按「前缀族」判。
 */
function paramTokens(command: string): readonly string[] {
	const tokens: string[] = [];
	const re = /(?<![\w-])-([A-Za-z]+)\b/g;
	for (let match = re.exec(command); match !== null; match = re.exec(command)) {
		const name = match[1];
		if (name !== undefined) tokens.push(name.toLowerCase());
	}
	return tokens;
}

/** tokens 里是否存在 fullName 的前缀缩写（含全名本身）。 */
function hasParamOf(tokens: readonly string[], fullName: string): boolean {
	return tokens.some((token) => fullName.startsWith(token));
}

/** cmd 风格开关（/s、/q）：独立成词，后面可以跟另一个开关。 */
function hasSlashFlag(command: string, flag: string): boolean {
	return new RegExp(`(?:^|\\s)/${flag}(?=[\\s/]|$)`, "i").test(command);
}

interface CategoryHit {
	readonly detail: string;
	readonly reason: string;
}

type CategoryMatcher = (command: string, tokens: readonly string[]) => CategoryHit | undefined;

const matchDynamicExecution: CategoryMatcher = (command, tokens) => {
	let detail: string | undefined;
	if (/\biex\b/i.test(command)) detail = "iex";
	else if (/\bInvoke-Expression\b/i.test(command)) detail = "Invoke-Expression";
	else if (/\bAdd-Type\b/i.test(command)) detail = "Add-Type";
	// EncodedCommand 族：前缀缩写（-e/-en/-enc…）+ -ec —— -ec 不是
	// "encodedcommand" 的字面前缀，是 powershell.exe 参数表里的无歧义缩写
	// （没有第二个 ec 开头的参数），前缀匹配抓不到，单列。
	else if (tokens.some((t) => t === "ec" || "encodedcommand".startsWith(t))) {
		detail = "-EncodedCommand 族参数";
	}
	else if (/\bInvoke-Command\b/i.test(command) && hasParamOf(tokens, "computername")) {
		detail = "远程 Invoke-Command";
	}
	if (detail === undefined) return undefined;
	return {
		detail,
		reason:
			`命令包含动态执行手段（${detail}）。把字符串/编码内容当代码跑，既是混淆恶意命令的典型形态，` +
			"也让检查器与审批人都看不到真正要执行的东西，一律不放行。" +
			"改法：把要执行的命令直接、完整地写出来再调用本工具；确需编译加载 C#（Add-Type）" +
			"或在远程机器上执行的场景，把命令交给用户，由用户自己运行。",
	};
};

const matchDownloadExecute: CategoryMatcher = (command) => {
	if (/\bDownload(String|File)\b/i.test(command)) {
		return {
			detail: "WebClient.DownloadString/DownloadFile",
			reason:
				"命令用 WebClient 直接下载脚本或程序（DownloadString/DownloadFile）。" +
				"下载即执行的路径一旦源被劫持就是远程代码执行，一律不放行。" +
				"改法：先用 web_fetch 查看该地址的内容并审查，确认可信后把内容落盘成文件再执行；" +
				"或把下载安装命令交给用户手动运行。",
		};
	}
	const downloads =
		/\b(Invoke-WebRequest|Invoke-RestMethod|iwr|irm|curl|curl\.exe|wget|wget\.exe|Start-BitsTransfer)\b/i.test(
			command,
		);
	const pipedToShell = /\|\s*(iex|Invoke-Expression|powershell(\.exe)?|pwsh(\.exe)?)\b/i.test(command);
	if (downloads && pipedToShell) {
		return {
			detail: "下载结果管道进解释器",
			reason:
				"命令把网络下载的内容直接管道进 iex/powershell 执行。这是「下载执行」的典型形态，" +
				"源被劫持即远程代码执行，一律不放行。" +
				"改法：先用 web_fetch 查看脚本内容并审查，确认可信后落盘成文件再执行；" +
				"或请用户自己运行该安装命令。",
		};
	}
	return undefined;
};

const matchCredentialAccess: CategoryMatcher = (command) => {
	for (const { label, pattern } of CREDENTIAL_PATTERNS) {
		if (pattern.test(command)) {
			return {
				detail: label,
				reason:
					`命令访问了凭据位置（${label}）。这里存的是私钥、API Key、登录态，` +
					"泄露即是账号级损失——权限门对这类路径是任何模式都不放行的禁读禁写，" +
					"命令通道同理。改法：不要把凭据读出来或写进命令；部署、登录等确需用到凭据的步骤，" +
					"请用户自己在终端完成。",
			};
		}
	}
	return undefined;
};

const matchRecursiveForceDelete: CategoryMatcher = (command, tokens) => {
	// PowerShell 系：Remove-Item 及其别名（ri/rm/del/erase）同时带递归与强制。
	// 递归按任意前缀缩写认（-r、-re、-recurse）；强制要求两位以上前缀（-fo 起），
	// 一位的 -f 与 -Filter 撞车，PowerShell 自身也会因歧义拒绝，故不认。
	const rfCombo = tokens.includes("rf") || tokens.includes("fr");
	const hasRecurse = hasParamOf(tokens, "recurse") || rfCombo;
	const hasForce =
		tokens.some((token) => token.length >= 2 && "force".startsWith(token)) || rfCombo;
	// cmd 系：rd/rmdir /s /q 与 del /s 是同款语义（静默递归删除）。
	const cmdStyle =
		(/\b(rd|rmdir)\b/i.test(command) && hasSlashFlag(command, "s") && hasSlashFlag(command, "q")) ||
		(/\bdel\b/i.test(command) && hasSlashFlag(command, "s"));
	const psStyle = /\b(Remove-Item|ri|rm|del|erase)\b/i.test(command) && hasRecurse && hasForce;
	if (!psStyle && !cmdStyle) return undefined;
	// 目标直指盘符根或家目录本身（而非其子路径）时，后果是整盘/整户的数据损失，
	// 在原因里点名，模型才知道为什么这次连「收窄路径」的常规改法都不够。
	const targetsRoot =
		/(?:^|["'\s])[A-Za-z]:\\(?:["'\s]|$)/.test(command) ||
		/(?:^|["'\s])(~|\$HOME|\$env:USERPROFILE)(?:["'\s]|$)/i.test(command);
	return {
		detail: psStyle ? "Remove-Item -Recurse -Force 族" : "rd /s /q、del /s 族",
		reason:
			"命令是递归强制删除。这种删法不进回收站、无法回退，路径稍有偏差就是不可逆的数据损失" +
			(targetsRoot ? "；且目标直指盘符根或家目录本身，后果是整盘/整用户的数据" : "") +
			"。改法：把删除范围收窄到具体文件逐个删；范围大就先列出清单给用户确认，" +
			"由用户自己执行删除。",
	};
};

/** 系统破坏类：每条子规则带一个点名标签，原因里要告诉模型撞的是哪条。 */
const SYSTEM_DAMAGE_RULES: ReadonlyArray<{ readonly label: string; readonly pattern: RegExp }> = [
	{ label: "shutdown", pattern: /\bshutdown(\.exe)?\b/i },
	{ label: "Restart-Computer/Stop-Computer", pattern: /\b(Restart|Stop)-Computer\b/i },
	{ label: "format 盘符", pattern: /\bformat(\.exe)?\s+[A-Za-z]:/i },
	{ label: "Format-Volume", pattern: /\bFormat-Volume\b/i },
	{ label: "diskpart", pattern: /\bdiskpart(\.exe)?\b/i },
	{ label: "reg delete", pattern: /\breg(\.exe)?\s+delete\b/i },
	{ label: "Set-ExecutionPolicy", pattern: /\bSet-ExecutionPolicy\b/i },
	{ label: "bcdedit", pattern: /\bbcdedit(\.exe)?\b/i },
	{ label: "net user 增删账户", pattern: /\bnet(\.exe)?\s+user\b[^|]*\/(add|delete)\b/i },
];

const matchSystemDamage: CategoryMatcher = (command) => {
	// takeown + icacls 组合 = 夺取文件所有权后改 ACL，单看都不至于拦，组合即夺权。
	if (/\btakeown(\.exe)?\b/i.test(command) && /\bicacls(\.exe)?\b/i.test(command)) {
		return {
			detail: "takeown + icacls 夺权组合",
			reason:
				"命令组合使用 takeown 与 icacls——先夺文件所有权再改访问控制，是绕过权限体系的夺权操作。" +
				"改法：不要代用户修改系统/他人文件的权限；确有需要把命令交给用户，" +
				"由用户在管理员终端自行执行。",
		};
	}
	for (const { label, pattern } of SYSTEM_DAMAGE_RULES) {
		if (pattern.test(command)) {
			return {
				detail: label,
				reason:
					`命令会改变系统级状态或破坏系统（${label}）。这类操作影响面远超当前任务，` +
					"多数不可逆（关机、格盘、改启动项、动注册表、放开脚本执行策略、增删账户）。" +
					"改法：不要代用户做系统配置；确有需要时说明理由，把命令交给用户在管理员终端自己执行。",
			};
		}
	}
	return undefined;
};

/**
 * 判定顺序即优先级：更具体、后果更明确的类别先判，模型拿到的原因更准确。
 * （凭据访问先于递归删除：`Remove-Item -Recurse -Force ~/.ssh` 的要害是凭据；
 *   下载执行先于动态执行：`iex (iwr …)` 的要害是下载即执行。）
 */
const MATCHERS: ReadonlyArray<{
	readonly category: CommandBlockCategory;
	readonly match: CategoryMatcher;
}> = [
	{ category: "credential-access", match: matchCredentialAccess },
	{ category: "download-execute", match: matchDownloadExecute },
	{ category: "dynamic-execution", match: matchDynamicExecution },
	{ category: "recursive-force-delete", match: matchRecursiveForceDelete },
	{ category: "system-damage", match: matchSystemDamage },
];

/**
 * 静态检查一条待执行的 PowerShell 命令。
 * 命中拦截类别返回 { blocked: true, category, reason }；未命中返回 undefined（放行）。
 */
export function checkCommand(command: string): CommandBlock | undefined {
	const tokens = paramTokens(command);
	for (const { category, match } of MATCHERS) {
		const hit = match(command, tokens);
		if (hit !== undefined) {
			return { blocked: true, category, reason: hit.reason };
		}
	}
	return undefined;
}
