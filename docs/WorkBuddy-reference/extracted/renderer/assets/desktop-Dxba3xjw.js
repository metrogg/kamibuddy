import { OI as init_wb } from "./ui-docs-viewer-C2jT2eXi.js";
import { a as getDesktopHost } from "./host-CgmrRMPt.js";
import "./runtime-Bka2LG4x.js";
//#region ../../packages/workbuddy-app/src/desktop/opener.ts
var ALLOWED_EXTERNAL_URL_PROTOCOLS = new Set([
	"http:",
	"https:",
	"x-apple.systempreferences:",
	"ms-settings:"
]);
async function openExternalUrl(url) {
	if (isFileUrl(url)) {
		const localPath = fileUrlToLocalPath(url);
		const localFileOpen = getDesktopHost()?.localFile?.open;
		if (typeof localFileOpen === "function") {
			await localFileOpen({
				path: localPath,
				mode: "open"
			});
			return;
		}
		const openerUrl = getDesktopHost()?.opener?.openUrl;
		if (typeof openerUrl === "function") {
			await openerUrl(url);
			return;
		}
		if (typeof window !== "undefined" && typeof window.open === "function") {
			window.open(url, "_blank", "noopener,noreferrer");
			return;
		}
		throw new Error("Desktop localFile host is unavailable");
	}
	const target = readExternalUrl(url);
	const openUrl = getDesktopHost()?.opener?.openUrl;
	if (typeof openUrl === "function") {
		await openUrl(target);
		return;
	}
	if (isElectronRenderer()) throw new Error("Desktop opener host is unavailable");
	if (typeof window !== "undefined" && typeof window.open === "function") {
		window.open(target, "_blank", "noopener,noreferrer");
		return;
	}
	throw new Error("No opener is available in this runtime");
}
async function openDesktopLocalFile(path) {
	await openLocalFile(path, "open");
}
async function revealDesktopLocalFile(path) {
	await openLocalFile(path, "reveal");
}
async function openLocalFile(path, mode) {
	const open = getDesktopHost()?.localFile?.open;
	if (typeof open === "function") {
		await open({
			path,
			mode
		});
		return;
	}
	throw new Error("Desktop localFile host is unavailable");
}
function readExternalUrl(value) {
	try {
		const parsed = new URL(value);
		if (ALLOWED_EXTERNAL_URL_PROTOCOLS.has(parsed.protocol)) return value;
	} catch {}
	throw new Error("Unsupported external URL");
}
function isElectronRenderer() {
	return typeof navigator !== "undefined" && /\bElectron\//i.test(navigator.userAgent);
}
function isFileUrl(url) {
	try {
		return new URL(url).protocol === "file:";
	} catch {
		return false;
	}
}
/**
* Convert a file:// URL to a local filesystem path.
* Uses the URL API to correctly handle percent-encoded characters
* (e.g. %E5%94%AE → 售) across platforms, including Windows drive
* letter paths (file:///C:/... → C:\...).
*/
function fileUrlToLocalPath(url) {
	try {
		const parsed = new URL(url);
		let pathname = decodeURIComponent(parsed.pathname);
		if (/^\/[A-Za-z]:/.test(pathname)) pathname = pathname.slice(1);
		return pathname;
	} catch {
		const stripped = url.replace(/^file:\/+/, "");
		return decodeURIComponent(stripped);
	}
}
//#endregion
//#region ../../packages/workbuddy-app/src/desktop/daemon/mcp-apps-wb-api.ts
init_wb();
//#endregion
export { openExternalUrl as n, revealDesktopLocalFile as r, openDesktopLocalFile as t };
