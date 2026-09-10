import { a as getDesktopHost } from "./host-CgmrRMPt.js";
//#region ../../packages/workbuddy-app/src/desktop/clipboard.ts
async function readClipboardText(fallback) {
	const readText = getDesktopHost()?.clipboard?.readText;
	if (typeof readText === "function") return readText();
	if (fallback) return fallback();
	return "";
}
async function writeClipboardText(text, fallback) {
	const writeText = getDesktopHost()?.clipboard?.writeText;
	if (typeof writeText === "function") {
		await writeText(text);
		return;
	}
	if (fallback) await fallback(text);
}
async function writeClipboardImage(dataUrl, fallback) {
	const writeImage = getDesktopHost()?.clipboard?.writeImage;
	if (typeof writeImage === "function") {
		await writeImage(dataUrl);
		return;
	}
	if (fallback) await fallback(dataUrl);
}
//#endregion
export { writeClipboardImage as n, writeClipboardText as r, readClipboardText as t };
