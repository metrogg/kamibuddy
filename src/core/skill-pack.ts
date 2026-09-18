/**
 * 技能打包：把一个技能目录打成可分发的 zip。
 *
 * 对齐 WorkBuddy 的 `package_skill.py`（skill-creator 的标准收尾步骤：建完给用户
 * 一份 zip 做分享 / 备份），布局也照它：**zip 里带技能目录名作根**
 * （`hu-yan-luan-yu/SKILL.md`），而不是把文件平铺在根上 —— 前者解包出来直接就是
 * 一个能放进技能目录的文件夹，后者用户还得自己建一层目录。
 *
 * 用 jszip（仓库既有依赖，node 运行时的解包走同一份）而不是自写 zip 写入器。
 * 纯函数：只读技能目录、只写目标文件，不动技能目录本身。
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import JSZip from "jszip";

/**
 * 安装台账（`_installed.json`，见 core/skill-install.ts）**不进包**：
 * 它记的是本机安装事实（含模型工作区的绝对路径），跟着 zip 分享出去既没用又漏本机路径。
 * WorkBuddy 的打包脚本不过滤它的 sidecar，这条是我们有意偏离。
 */
const EXCLUDED = new Set(["_installed.json"]);

/** 递归列出目录下的全部文件（zips 只需要文件，空目录不必保留）。 */
function listFiles(dir: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) files.push(...listFiles(full));
		else if (entry.isFile()) files.push(full);
	}
	return files;
}

/**
 * 打包技能目录，返回 zip 的字节数。
 *
 * 覆盖已存在的目标文件：目标是我们自己在工作区定的产物路径（`<技能名>.zip`），
 * 同一技能反复打包就该拿到最新那份，留一堆带时间戳的 zip 反而是垃圾。
 */
export async function packSkillDir(skillDir: string, outFile: string): Promise<number> {
	if (!statSync(skillDir).isDirectory()) throw new Error(`打包对象不是目录：${skillDir}`);

	const root = basename(skillDir);
	const zip = new JSZip();
	let packed = 0;
	for (const file of listFiles(skillDir)) {
		const rel = relative(skillDir, file);
		if (EXCLUDED.has(rel)) continue;
		// zip 内一律用 `/` 分隔（ZIP 规范），Windows 的 `\` 会让解包工具建出怪名字。
		zip.file(`${root}/${rel.split(sep).join("/")}`, readFileSync(file));
		packed += 1;
	}
	if (packed === 0) throw new Error(`技能目录里没有可打包的文件：${skillDir}`);

	const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
	writeFileSync(outFile, buffer);
	return buffer.byteLength;
}
