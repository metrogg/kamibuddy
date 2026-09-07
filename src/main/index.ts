/**
 * Electron 主进程。
 *
 * 职责边界（ARCHITECTURE.md §3）：只做 Electron 才能做的事 ——
 * 窗口、生命周期、utilityProcess 托管、文件对话框。
 * **不解释任何业务 payload**：renderer 的 invoke 一律包成 DaemonRequest 转发给 daemon，
 * daemon 的 push 一律原样 send 给 renderer。
 *
 * 收益：新增业务通道只改 shared/ipc.ts 与 daemon，本文件一行不动。
 */

import { randomUUID } from "node:crypto";
import { join } from "node:path";
import {
	BrowserWindow,
	app,
	dialog,
	ipcMain,
	session,
	shell,
	utilityProcess,
	type UtilityProcess,
} from "electron";
import type { DaemonOutbound, DaemonRequest } from "../shared/daemon-protocol.ts";
import { INVOKE, PUSH, type DaemonStatus, type SaveArtifactRequest } from "../shared/ipc.ts";

/** main 自己处理、不转发给 daemon 的通道（需要 Electron API 或 main 独有状态）。 */
const MAIN_HANDLED: readonly string[] = [
	INVOKE.daemonStatus,
	INVOKE.openArtifact,
	INVOKE.saveArtifactAs,
	INVOKE.pickWorkspaceDirectory,
];

let window: BrowserWindow | undefined;
let daemon: UtilityProcess | undefined;
/**
 * daemon 存活状态。只有 main 知道子进程的真实状况，因此由它持有，
 * 并通过 INVOKE.daemonStatus 供渲染进程主动查询（消除 ready 推送的竞态）。
 */
let daemonStatus: DaemonStatus = { kind: "starting" };
/** 未完成的请求。daemon 崩溃时要全部 reject，否则 renderer 永久挂起。 */
const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function send<T>(channel: string, payload: T): void {
	if (window?.isDestroyed() === false) window.webContents.send(channel, payload);
}

/* ── daemon 生命周期 ──────────────────────────────────────────────── */

function startDaemon(): void {
	// daemon 是独立构建入口（electron.vite.config.ts 的 main.rollupOptions.input.daemon）。
	// 用 import.meta.dirname 而非 __dirname：package.json 有 "type": "module"，
	// electron-vite 因此产出 ESM，ESM 里没有 __dirname。
	const entry = join(import.meta.dirname, "daemon.mjs");
	const child = utilityProcess.fork(entry, [], {
		// pi 会读 stdout/stderr 之外的诊断，转给父进程便于排障。
		stdio: "pipe",
		serviceName: "kamibuddy-daemon",
	});
	daemon = child;

	child.stdout?.on("data", (chunk: Buffer) => process.stdout.write(`[daemon] ${chunk}`));
	child.stderr?.on("data", (chunk: Buffer) => process.stderr.write(`[daemon] ${chunk}`));

	child.on("message", (frame: DaemonOutbound) => {
		switch (frame.kind) {
			case "ready":
				// 先记状态再推送：渲染进程可能正好在此刻查询，状态必须已经是最新的。
				daemonStatus = { kind: "ready" };
				send(PUSH.daemonReady, undefined);
				return;
			case "push":
				send(frame.channel, frame.payload);
				return;
			case "response": {
				const slot = pending.get(frame.id);
				if (slot === undefined) return; // 已超时或 daemon 重启过，丢弃
				pending.delete(frame.id);
				if (frame.ok) slot.resolve(frame.value);
				else slot.reject(new Error(frame.error));
				return;
			}
		}
	});

	child.on("exit", (code) => {
		daemon = undefined;
		const reason = `daemon 退出（code ${code}）`;
		daemonStatus = { kind: "down", reason };
		// 先清空在途请求，否则 renderer 端的 await 永远不返回。
		for (const [, slot] of pending) slot.reject(new Error(reason));
		pending.clear();
		// 不自动重启：试用阶段静默重连会掩盖真问题（AGENTS.md §7 让它响亮地失败）。
		send(PUSH.daemonDown, { reason });
	});
}

function callDaemon(channel: string, args: readonly unknown[]): Promise<unknown> {
	const child = daemon;
	if (child === undefined) return Promise.reject(new Error("daemon 未运行"));
	const id = randomUUID();
	const request: DaemonRequest = { kind: "request", id, channel, args };
	return new Promise<unknown>((resolve, reject) => {
		pending.set(id, { resolve, reject });
		child.postMessage(request);
	});
}

/* ── CSP ──────────────────────────────────────────────────────────── */

/**
 * 按环境下发 CSP，而不是写在 index.html 的 meta 里。
 *
 * 原因：dev 模式下 @vitejs/plugin-react 注入内联的 react-refresh preamble，
 * 静态 meta CSP 一收紧 script-src 就会把它拦掉、页面白屏。
 * 生产环境没有这个包袱，收到最紧。
 */
function installCsp(isDev: boolean): void {
	const policy = isDev
		? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
			"img-src 'self' data: blob:; connect-src 'self' ws://localhost:* http://localhost:*"
		: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
			"img-src 'self' data: blob:; connect-src 'self'";

	session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
		callback({
			responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": [policy] },
		});
	});
}

/* ── 窗口 ─────────────────────────────────────────────────────────── */

function createWindow(): void {
	window = new BrowserWindow({
		width: 1280,
		height: 860,
		minWidth: 900,
		minHeight: 600,
		show: false,
		title: "KamiBuddy",
		webPreferences: {
			preload: join(import.meta.dirname, "../preload/index.mjs"),
			// renderer 跑的是不可信内容（模型产出的 HTML 会在预览面板里渲染），
			// 三道开关都不能松：能力只能经 preload 的白名单桥暴露。
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false, // preload 需要 require 走 IPC；不开 nodeIntegration 已足够
		},
	});

	window.once("ready-to-show", () => window?.show());

	// 外链走系统浏览器，不在应用内开窗（防钓鱼页伪装成应用界面）。
	window.webContents.setWindowOpenHandler(({ url }) => {
		void shell.openExternal(url);
		return { action: "deny" };
	});

	const devServer = process.env["ELECTRON_RENDERER_URL"];
	if (devServer !== undefined) void window.loadURL(devServer);
	else void window.loadFile(join(__dirname, "../renderer/index.html"));
}

/* ── IPC 注册 ─────────────────────────────────────────────────────── */

function registerIpc(): void {
	// 转发型通道：main 不看内容。
	for (const channel of Object.values(INVOKE)) {
		if (MAIN_HANDLED.includes(channel)) continue;
		ipcMain.handle(channel, (_event, ...args: unknown[]) => callDaemon(channel, args));
	}

	// 由 main 本地应答：只有它知道子进程的真实状况。
	ipcMain.handle(INVOKE.daemonStatus, () => daemonStatus);

	ipcMain.handle(INVOKE.openArtifact, async (_event, path: string) => {
		const error = await shell.openPath(path);
		if (error !== "") throw new Error(error);
	});

	ipcMain.handle(INVOKE.saveArtifactAs, async (_event, request: SaveArtifactRequest) => {
		if (window === undefined) return undefined;
		const { canceled, filePath } = await dialog.showSaveDialog(window, {
			defaultPath: request.suggestedName,
		});
		return canceled ? undefined : filePath;
	});

	ipcMain.handle(INVOKE.pickWorkspaceDirectory, async () => {
		if (window === undefined) return undefined;
		const { canceled, filePaths } = await dialog.showOpenDialog(window, {
			title: "选择工作空间目录",
			properties: ["openDirectory", "createDirectory"],
		});
		return canceled ? undefined : filePaths[0];
	});
}

/* ── 启动 ─────────────────────────────────────────────────────────── */

// 单实例：第二次启动聚焦已有窗口。多实例会争抢同一份会话文件。
if (!app.requestSingleInstanceLock()) {
	app.quit();
} else {
	app.on("second-instance", () => {
		if (window === undefined) return;
		if (window.isMinimized()) window.restore();
		window.focus();
	});

	void app.whenReady().then(() => {
		installCsp(process.env["ELECTRON_RENDERER_URL"] !== undefined);
		registerIpc();
		startDaemon();
		createWindow();

		app.on("activate", () => {
			if (BrowserWindow.getAllWindows().length === 0) createWindow();
		});
	});

	app.on("window-all-closed", () => {
		if (process.platform !== "darwin") app.quit();
	});

	app.on("before-quit", () => {
		daemon?.kill();
	});
}
