/**
 * 探针：权限门的**词法**包含判定能不能被 NTFS junction 绕过？
 *
 * 为什么先写探针而不是直接改（照 docs/sandbox.md 「踩过的坑」第 6 条的手法：
 * 先证明问题在不在我们的边界之内）：`permission-policy.ts` 的 `isInside` 只做
 * `resolve()`，不解析链接 —— 这在代码上看是个洞，但「看起来是洞」和「真的是洞」
 * 之间隔着一层：pi 的 fs 工具可能在更下游自己做了归一化，那样权限门的判定就
 * 不是最后一道，改它等于白改。151 个权限测试用的都是磁盘上不存在的假路径，
 * 谁也没验证过真实链接下的行为。
 *
 * 本探针只**调用** decide()，不改一行判定代码。它回答一个问题：
 *   工作区内建一个指向区外的 junction，写它算不算「工作区内」？
 *
 * 断言方向是**反的**：期望当前返回 allow / allow —— 即期望洞存在。
 * 修完之后重跑，它应当从 GAP 翻成 CLOSED，于是同一个脚本既是「缺口证据」
 * 又是「修复验收」。
 *
 * junction 而不是 symlink 是有意的：**创建 junction 不需要管理员权限**
 * （symlink 需要，除非开了开发者模式）—— 所以这条路径模型真的走得通，
 * 不是理论上的威胁。Node 的 symlinkSync(..., "junction") 直接建 junction，
 * 不必 spawn `mklink /J`。
 *
 * 用法：npx tsx scripts/probe-junction-containment.ts
 */

import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decide, type PolicyPaths } from "../src/extensions/permission-policy.ts";

export {};

if (process.platform !== "win32") {
	console.log("SKIP  junction 是 Windows 机制，当前平台无法验证这条路径。");
	process.exit(0);
}

/* ── 布景：真实存在于磁盘的工作区 / 区外目录 / 假凭据目录 ──────────── */

const root = mkdtempSync(join(tmpdir(), "kami-junction-probe-"));
const workspaceDir = join(root, "workspace");
const outsideDir = join(root, "outside");
/*
 * 假凭据目录：不碰用户真实的 ~/.ssh（探针不该读真密钥，也不该依赖它存在）。
 * 它经 protectedDirs 传进判定，对 decide() 来说与真的 ~/.ssh 完全等价。
 */
const secretsDir = join(root, "fake-ssh");

const junctions: string[] = [];

function cleanup(): void {
	/*
	 * 先逐个拆 junction，再删目录树。顺序要紧：递归删一个含 junction 的目录
	 * 若实现上跟随了链接，就会连**区外的真实目录**一起删掉 —— 在探针里是
	 * 临时目录无所谓，但这个手法会被复制到别处，所以从一开始就写对。
	 */
	for (const link of junctions) {
		try {
			unlinkSync(link);
		} catch {
			// 已经不在了就算了，清理失败不该盖掉探针结论。
		}
	}
	try {
		rmSync(root, { recursive: true, force: true });
	} catch {
		// 同上。
	}
}

const results: { name: string; gap: boolean; detail: string }[] = [];

try {
	mkdirSync(workspaceDir, { recursive: true });
	mkdirSync(outsideDir, { recursive: true });
	mkdirSync(secretsDir, { recursive: true });
	writeFileSync(join(secretsDir, "id_rsa"), "FAKE-KEY-NOT-A-REAL-SECRET\n");

	// 工作区内的两个 junction：一个指向普通区外目录，一个指向「凭据目录」。
	const escapeLink = join(workspaceDir, "escape");
	symlinkSync(outsideDir, escapeLink, "junction");
	junctions.push(escapeLink);
	const secretLink = join(workspaceDir, "keys");
	symlinkSync(secretsDir, secretLink, "junction");
	junctions.push(secretLink);

	if (!existsSync(escapeLink) || !existsSync(secretLink)) {
		throw new Error("junction 创建后不可见，探针无法继续");
	}

	const paths: PolicyPaths = {
		workspaceDir,
		configDir: join(root, "config"),
		protectedDirs: [secretsDir],
	};

	/* ── 判定 1：经 junction 写到工作区之外 ─────────────────────────── */

	const escapeTarget = join(escapeLink, "x.txt");
	const writeVerdict = decide(
		{ toolName: "write", path: escapeTarget, command: undefined },
		paths,
		workspaceDir,
	);
	results.push({
		name: "write 经 junction 落到工作区之外",
		gap: writeVerdict.kind === "allow",
		detail:
			`目标 ${escapeTarget}\n      真实位置 ${join(outsideDir, "x.txt")}\n      ` +
			`判定 = ${writeVerdict.kind}` +
			(writeVerdict.kind === "allow"
				? "（免打扰放行 → 文件会落在工作区外，用户不会被问）"
				: `（未放行，这条链走不通）`),
	});

	/* ── 判定 2：经 junction 读凭据目录 ─────────────────────────────── */

	const secretTarget = join(secretLink, "id_rsa");
	const readVerdict = decide(
		{ toolName: "read", path: secretTarget, command: undefined },
		paths,
		workspaceDir,
	);
	results.push({
		name: "read 经 junction 读到凭据目录",
		gap: readVerdict.kind !== "deny",
		detail:
			`目标 ${secretTarget}\n      真实位置 ${join(secretsDir, "id_rsa")}\n      ` +
			`判定 = ${readVerdict.kind}` +
			(readVerdict.kind === "deny" ? "（凭据禁区拦住了）" : "（凭据禁区被绕过）"),
	});

	/* ── 对照组：不经 junction 的直路必须仍按老样子判 ───────────────── */

	const directOutside = join(outsideDir, "x.txt");
	const directVerdict = decide(
		{ toolName: "write", path: directOutside, command: undefined },
		paths,
		workspaceDir,
	);
	const directSecret = decide(
		{ toolName: "read", path: join(secretsDir, "id_rsa"), command: undefined },
		paths,
		workspaceDir,
	);
	/*
	 * 对照组存在的理由：万一布景搭错（工作区传错、protectedDirs 没生效），
	 * 上面两条会「碰巧」通过而给出假的缺口结论。直路必须分别是 ask 与 deny。
	 */
	const controlOk = directVerdict.kind === "ask" && directSecret.kind === "deny";
	results.push({
		name: "对照组：直写区外 = ask，直读凭据 = deny",
		gap: !controlOk,
		detail:
			`直写区外 = ${directVerdict.kind}，直读凭据 = ${directSecret.kind}` +
			(controlOk ? "（布景正确，上面的结论可信）" : "（布景有问题，上面的结论不可信！）"),
	});
} finally {
	cleanup();
}

console.log("\n=== junction 包含判定探针 ===\n");
for (const row of results) {
	console.log(`${row.gap ? "GAP   " : "CLOSED"}  ${row.name}\n      ${row.detail}\n`);
}

const gaps = results.filter((r) => r.gap).length;
console.log(
	gaps === 0
		? "结论：三项全部收敛 —— junction 绕不过权限门。"
		: `结论：${gaps} 项存在缺口 —— 词法包含判定可被 junction 绕过。`,
);
