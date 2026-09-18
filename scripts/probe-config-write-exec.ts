/**
 * 探针：工作区内的「配置即代码」文件能不能被免审批写入？
 *
 * 为什么写这个（2026-09-16，三期审批放松的**前提检验**）：
 * 三期的计划把 `git status` 列进「第一层：无条件放行 —— 不写文件、不跑用户代码，
 * 沙箱在不在都一样安全」。这个前提**是错的**，实测（git 2.55.0）：
 *
 *   `.git/config` 里写 `core.fsmonitor = "<任意命令>"` → `git status` 与
 *   `git diff` 都会执行它；`[alias] st = !<任意命令>` → `git st` 执行它
 *   （内建名如 status 不可被 alias 劫持，但自定义名可以）。
 *   `core.pager` 在 stdout 非 TTY 时不触发（我们捕获输出，所以这条无效）。
 *
 * 同理 `npm run` 执行的是 `package.json` 里的 scripts。
 *
 * 于是问题变成：模型能不能**免审批**写这些文件？若能，任何基于命令名的白名单
 * 都不成立 —— 因为命令的行为不由它的名字决定，而由工作区内一个模型可以随手
 * 改写的文件决定。链条是：
 *
 *   静默改写 .git/config / package.json（工作区内，免审批）
 *     → 跑一条「名单内的安全命令」（免审批）
 *     → 任意代码执行，全程零人工介入
 *     → 沙箱只约束**写**，读与网络不受约束 → 读密钥 + 外发
 *
 * 本探针只调用 `decide()`，不改任何判定代码，回答那一问。
 *
 * 用法：npx tsx scripts/probe-config-write-exec.ts
 */

import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decide, type PolicyPaths } from "../src/extensions/permission-policy.ts";

export {};

const root = mkdtempSync(join(tmpdir(), "kami-cfgwrite-"));
const workspace = join(root, "workspace");
mkdirSync(workspace, { recursive: true });
// .git 要真实存在，否则归一化走的是「最深存在祖先」而非真实目录。
mkdirSync(join(workspace, ".git"), { recursive: true });

const paths: PolicyPaths = {
	workspaceDir: workspace,
	configDir: join(root, "config"),
	protectedDirs: [join(root, "fake-ssh")],
};

/*
 * 「配置即代码」的文件：内容会变成被执行的行为。
 *
 * 注意（2026-09-18）：技能根 `.pi/skills/**`、`.agents/skills/**` **不算**配置即代码了
 * —— 技能正文是纯文本、加载时不执行，写入回归普通工作区文件（放行）。
 * 完整决策见 `docs/workbuddy分析/03-plugins-skills.md` 的「决策 B」。
 */
const CONFIG_AS_CODE: ReadonlyArray<{ readonly path: string; readonly why: string }> = [
	/*
	 * 最严重的一个：pi 从工作目录加载 `.pi/extensions`，那是**以本进程权限
	 * 执行任意代码**的 TypeScript 模块（project-trust.ts 的文件头写明了），
	 * 而项目信任对**我们自己的工作区自动信任、不问用户**。
	 * 它甚至不需要模型再跑任何命令 —— 下次会话建立时加载即执行。
	 */
	{ path: join(workspace, ".pi", "extensions", "evil.ts"), why: "pi 项目级扩展：会话建立时**加载即执行**，权限门在它之后" },
	{ path: join(workspace, ".pi", "settings.json"), why: "pi 项目级设置：可改变加载行为" },
	{ path: join(workspace, ".pi", "SYSTEM.md"), why: "项目级系统提示词：提示注入的持久落点" },
	{ path: join(workspace, ".vscode", "tasks.json"), why: "编辑器按它执行 tasks（与 .pi/skills 不同，它真的会被执行）" },
	{ path: join(workspace, ".git", "config"), why: "core.fsmonitor / alias → git status、git diff 执行任意命令（已实测）" },
	{ path: join(workspace, ".git", "hooks", "pre-commit"), why: "git 钩子，**用户自己**下次提交时执行（逃出我们进程的持久化）" },
	{ path: join(workspace, "package.json"), why: "scripts → npm run / npm test 执行任意命令" },
	{ path: join(workspace, ".npmrc"), why: "可指向自定义 registry / 改变安装行为" },
];

const results: { name: string; gap: boolean; detail: string }[] = [];

try {
	for (const { path, why } of CONFIG_AS_CODE) {
		for (const toolName of ["write", "edit"]) {
			const verdict = decide({ toolName, path, command: undefined }, paths, workspace);
			results.push({
				name: `${toolName} ${path.slice(workspace.length + 1)}`,
				gap: verdict.kind === "allow",
				detail: `判定 = ${verdict.kind}${verdict.kind === "allow" ? "（免审批！）" : ""} — ${why}`,
			});
		}
	}

	/*
	 * 对照组：工作区内的普通文件本就该免审批（那是「目录内不打扰」的产品语义，
	 * 不是缺陷）。它证明上面的 allow 不是因为布景搭错导致的假结论。
	 */
	const normal = decide(
		{ toolName: "write", path: join(workspace, "报告.md"), command: undefined },
		paths,
		workspace,
	);
	results.push({
		name: "对照组：write 工作区内的普通文件",
		gap: normal.kind !== "allow",
		detail: `判定 = ${normal.kind}（应为 allow —— 这是产品语义，不是缺陷）`,
	});
} finally {
	rmSync(root, { recursive: true, force: true });
}

console.log("\n=== 「配置即代码」写入判定探针 ===\n");
for (const row of results) {
	console.log(`${row.gap ? "GAP   " : "OK    "}  ${row.name}\n          ${row.detail}\n`);
}

const gaps = results.filter((r) => r.gap).length;
console.log(
	gaps === 0
		? "结论：配置类文件的写入都需要审批 —— 基于命令名的白名单前提成立。"
		: `结论：${gaps} 项可免审批写入 —— **基于命令名的白名单前提不成立**：\n` +
			"        命令的行为不由名字决定，而由工作区内一个模型能随手改写的文件决定。",
);
