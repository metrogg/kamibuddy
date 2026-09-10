const require_chunk = require("./chunk.js");
const require_workbuddy_paths = require("./workbuddy-paths.js");
const require_app_instance = require("./app-instance.js");
const require_logger = require("./logger2.js");
const require_settings_store = require("./settings-store.js");
let node_child_process = require("node:child_process");
let node_fs = require("node:fs");
node_fs = require_chunk.__toESM(node_fs);
let node_path = require("node:path");
node_path = require_chunk.__toESM(node_path);
let node_os = require("node:os");
node_os = require_chunk.__toESM(node_os);
let node_util = require("node:util");
//#region src/main/system/platform/dock-recent-apps-repair.ts
/**
* Dock recent-apps 一次性自愈（issue #100044）。
*
* 5.4.3 版本因 `spawn(process.execPath, ['xxx.js'])` 拉起 Node 子进程时被 macOS
* LaunchServices 短暂登记为 activation event，主 bundle 在 Dock recent-apps 里
* 累积成多份条目（同一 `com.tencent.workbuddy.mac` 出现 2-3 条），用户看到 Dock
* 上有多个 WorkBuddy 图标。
*
* 5.4.4 通过在 Info.plist 里加 `LSMultipleInstancesProhibited=true` 阻止未来重复
* 登记，但已装 5.4.3 的用户升级后 Dock plist 里的历史脏条目不会自动消失，需要
* 主动清理。本模块负责：
*
*   1. 检测 dock plist 中 `com.tencent.workbuddy.mac` 的重复条目数
*   2. 若 >1，用 `plutil` 生成新数组（保留首条 workbuddy，去掉其余重复项，其他
*      App 条目原样保留），写回 dock plist
*   3. `killall Dock` 让改动即时生效（Dock 会由 launchd 秒起，用户感知一次
*      短暂闪烁，然后多余图标消失）
*   4. 在 workbuddy settings.json 落一次性 marker，之后所有启动短路跳过
*
* 失败降级：任何一步失败都静默记 warn 并落 marker，避免每次启动重试打扰用户。
* 用户可通过删除 marker key 手动重试。
*/
require_app_instance.init_app_instance();
/** 生成一个用于清理 Dock plist 的临时文件路径。放在 workbuddy 配置目录下的
* .tmp 子目录，避免依赖 os.tmpdir() —— tmpdir 会因 process.platform 变化而缓存
* 不一致的结果（影响测试稳定性），且我们本来就有一个可控的 workbuddy 配置目录。 */
function makeDockRepairTempPath() {
	const tempDir = node_path.join(require_workbuddy_paths.getWorkbuddyConfigDir(), ".tmp");
	node_fs.mkdirSync(tempDir, { recursive: true });
	return node_path.join(tempDir, `dock-repair-${Date.now()}-${process.pid}.plist`);
}
var DOCK_RECENT_APPS_REPAIRED_AT_KEY = "dockRecentAppsRepairedAt";
var WORKBUDDY_BUNDLE_ID = "com.tencent.workbuddy.mac";
var DOCK_PLIST_RELATIVE = "Library/Preferences/com.apple.dock.plist";
/**
* 测试用 override：允许把 dock plist 路径重定向到临时目录。
* 生产运行时永远不会设置这个 env。
*/
var DOCK_PLIST_PATH_OVERRIDE_ENV = "WORKBUDDY_DOCK_PLIST_PATH_OVERRIDE";
var execFileAsync = (0, node_util.promisify)(node_child_process.execFile);
function getDockPlistPath() {
	const override = process.env[DOCK_PLIST_PATH_OVERRIDE_ENV];
	if (override) return override;
	return node_path.join(node_os.homedir(), DOCK_PLIST_RELATIVE);
}
/**
* 一次性修复 Dock recent-apps 中的重复 WorkBuddy 条目。
* 非 darwin 直接跳过；已修复过（marker 存在）跳过。
*/
async function repairDockRecentAppsOnce() {
	if (process.platform !== "darwin") return;
	if (await hasDockRecentAppsBeenRepaired()) return;
	try {
		await markDockRecentAppsRepaired();
	} catch (error) {
		require_logger.mainLog.warn("[DockRepair] failed to persist repaired marker; aborting to avoid retry loop:", String(error));
		return;
	}
	try {
		const dockPlistPath = getDockPlistPath();
		if (!node_fs.existsSync(dockPlistPath)) {
			require_logger.mainLog.info("[DockRepair] dock plist not found; nothing to do", { dockPlistPath });
			return;
		}
		const duplicateCount = await countWorkBuddyRecentAppsEntries(dockPlistPath);
		if (duplicateCount <= 1) {
			require_logger.mainLog.info("[DockRepair] recent-apps is clean; skipping", { duplicateCount });
			return;
		}
		require_logger.mainLog.info("[DockRepair] found duplicate recent-apps entries; cleaning", { duplicateCount });
		await removeDuplicateWorkBuddyRecentApps(dockPlistPath);
		await execFileAsync("killall", ["Dock"], { timeout: 5e3 });
		require_logger.mainLog.info("[DockRepair] recent-apps cleaned and Dock restarted");
	} catch (error) {
		require_logger.mainLog.warn("[DockRepair] failed to clean recent-apps:", String(error));
	}
}
/**
* 统计 Dock plist 中 recent-apps 数组里 bundle-identifier == workbuddy 的条目数。
* plutil 转 XML 后用简单文本匹配即可，避免引入 plist 解析依赖。
*/
async function countWorkBuddyRecentAppsEntries(dockPlistPath) {
	const recentApps = extractRecentAppsBlock(await plutilConvertToXml(dockPlistPath));
	if (recentApps === void 0) return 0;
	const pattern = new RegExp(`<string>${escapeRegExp(WORKBUDDY_BUNDLE_ID)}</string>`, "g");
	return (recentApps.match(pattern) ?? []).length;
}
/**
* 从 Dock plist 移除多余的 WorkBuddy recent-apps 条目，只保留第一条。
* 其他 App 的 recent-apps 条目、Dock persistent-apps、Dock 其余设置均不动。
*
* 实现：读整个 plist XML → 定位 recent-apps 数组 → 遍历 <dict> 块，命中 workbuddy
* bundle-id 且不是首条的丢弃 → 拼回 XML → 写回并转 binary1。
*/
async function removeDuplicateWorkBuddyRecentApps(dockPlistPath) {
	const originalXml = await plutilConvertToXml(dockPlistPath);
	const cleanedXml = filterOutDuplicateWorkBuddyTiles(originalXml);
	if (cleanedXml === originalXml) return;
	const tempPath = makeDockRepairTempPath();
	try {
		node_fs.writeFileSync(tempPath, cleanedXml, "utf8");
		await execFileAsync("plutil", [
			"-convert",
			"binary1",
			tempPath
		], { timeout: 5e3 });
		node_fs.copyFileSync(tempPath, dockPlistPath);
	} finally {
		try {
			node_fs.unlinkSync(tempPath);
		} catch {}
	}
}
/** plutil -convert xml1 -o - <plist>：把 binary plist 转成 XML 字符串（stdin/stdout 管道）。 */
async function plutilConvertToXml(dockPlistPath) {
	const { stdout } = await execFileAsync("plutil", [
		"-convert",
		"xml1",
		"-o",
		"-",
		dockPlistPath
	], {
		timeout: 5e3,
		maxBuffer: 4 * 1024 * 1024
	});
	return String(stdout ?? "");
}
/**
* 从 Dock plist XML 中截取 recent-apps `<array>...</array>` 内容，供计数使用。
* 返回 undefined 表示没有 recent-apps 键（旧 macOS 或用户已关闭 show-recents）。
*/
function extractRecentAppsBlock(xml) {
	const keyIdx = xml.indexOf("<key>recent-apps</key>");
	if (keyIdx < 0) return;
	const arrayStart = xml.indexOf("<array>", keyIdx);
	const arrayEnd = xml.indexOf("</array>", arrayStart);
	if (arrayStart < 0 || arrayEnd < 0) return;
	return xml.slice(arrayStart + 7, arrayEnd);
}
/**
* 从 XML 中过滤掉 recent-apps 里多余的 WorkBuddy tile，只保留第一条。
* 通过精确匹配"完整 <dict>...</dict> 单个 tile"来做增删，避免破坏 XML 结构。
*/
function filterOutDuplicateWorkBuddyTiles(xml) {
	const keyIdx = xml.indexOf("<key>recent-apps</key>");
	if (keyIdx < 0) return xml;
	const arrayStart = xml.indexOf("<array>", keyIdx);
	const arrayEnd = xml.indexOf("</array>", arrayStart);
	if (arrayStart < 0 || arrayEnd < 0) return xml;
	const before = xml.slice(0, arrayStart + 7);
	const inner = xml.slice(arrayStart + 7, arrayEnd);
	const after = xml.slice(arrayEnd);
	const tiles = splitTopLevelDicts(inner);
	let keptWorkBuddy = false;
	const filtered = [];
	for (const tile of tiles) if (tileIsWorkBuddy(tile)) {
		if (!keptWorkBuddy) {
			filtered.push(tile);
			keptWorkBuddy = true;
		}
	} else filtered.push(tile);
	return before + filtered.join("") + after;
}
/**
* 把一段 XML 里的顶层 `<dict>...</dict>` 元素分离成数组。仅处理顶层深度，
* 嵌套 dict 不视为 boundary。用简单 tag 计数即可，因为 plutil 输出的 XML
* 是规范化格式，不会有属性 / 注释干扰。
*/
function splitTopLevelDicts(inner) {
	const openTag = "<dict>";
	const closeTag = "</dict>";
	const result = [];
	let depth = 0;
	let currentStart = -1;
	let i = 0;
	while (i < inner.length) {
		if (inner.startsWith(openTag, i)) {
			if (depth === 0) currentStart = i;
			depth++;
			i += 6;
			continue;
		}
		if (inner.startsWith(closeTag, i)) {
			depth--;
			i += 7;
			if (depth === 0 && currentStart >= 0) {
				let sliceStart = currentStart;
				while (sliceStart > 0 && /\s/.test(inner[sliceStart - 1] ?? "")) sliceStart--;
				result.push(inner.slice(sliceStart, i));
				currentStart = -1;
			}
			continue;
		}
		i++;
	}
	return result;
}
/** 判断一个 tile <dict> 块是否 bundle-identifier == workbuddy 主 bundle。 */
function tileIsWorkBuddy(tile) {
	return tile.includes(`<string>${WORKBUDDY_BUNDLE_ID}</string>`);
}
function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
async function hasDockRecentAppsBeenRepaired() {
	return typeof (await readWorkBuddySettings())?.[DOCK_RECENT_APPS_REPAIRED_AT_KEY] === "string";
}
async function markDockRecentAppsRepaired() {
	await createDockRepairSettingsStore().update((current) => {
		if (current === null) throw new Error("settings.json must contain an object");
		return {
			...current,
			[DOCK_RECENT_APPS_REPAIRED_AT_KEY]: (/* @__PURE__ */ new Date()).toISOString()
		};
	});
}
async function readWorkBuddySettings() {
	return await createDockRepairSettingsStore().read() ?? void 0;
}
function createDockRepairSettingsStore() {
	return require_settings_store.createSettingsStore({
		settingsPath: node_path.join(require_workbuddy_paths.getWorkbuddyConfigDir(), "settings.json"),
		logger: require_logger.mainLog
	});
}
//#endregion
exports.repairDockRecentAppsOnce = repairDockRecentAppsOnce;
