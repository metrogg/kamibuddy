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
import { appendFileSync, mkdirSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, extname, join } from "node:path";
import {
	BrowserWindow,
	app,
	dialog,
	globalShortcut,
	ipcMain,
	session,
	shell,
	utilityProcess,
	type UtilityProcess,
} from "electron";
import type { DaemonOutbound, DaemonRequest } from "../shared/daemon-protocol.ts";
import { OFFICE_EXTENSIONS, PDF_EXTENSION, docKindOf } from "../shared/doc-formats.ts";
import { MAX_IMAGE_BYTES, type ImagePart } from "../shared/image.ts";
import {
	INVOKE,
	PUSH,
	type DaemonStatus,
	type DocumentReference,
	type GlobalShortcutStatus,
	type SaveArtifactRequest,
} from "../shared/ipc.ts";
import { GlobalToggleShortcutController } from "./global-shortcut.ts";

/** main 自己处理、不转发给 daemon 的通道（需要 Electron API 或 main 独有状态）。 */
const MAIN_HANDLED: readonly string[] = [
	INVOKE.daemonStatus,
	INVOKE.globalShortcutStatus,
	INVOKE.openArtifact,
	INVOKE.saveArtifactAs,
	INVOKE.pickWorkspaceDirectory,
	INVOKE.pickSkillDirectory,
	INVOKE.pickInputFiles,
	INVOKE.importProfile,
	INVOKE.workspaceReveal,
];

let window: BrowserWindow | undefined;
let daemon: UtilityProcess | undefined;
/**
 * daemon 存活状态。只有 main 知道子进程的真实状况，因此由它持有，
 * 并通过 INVOKE.daemonStatus 供渲染进程主动查询（消除 ready 推送的竞态）。
 */
let daemonStatus: DaemonStatus = { kind: "starting" };
/**
 * 全局唤起热键的注册状态。与 daemonStatus 同理：globalShortcut.register 的
 * 返回值只有 main 知道，由它持有并经 INVOKE.globalShortcutStatus 供查询。
 * undefined = whenReady 流程尚未跑到注册（渲染进程此时还不可能挂载）。
 */
let globalShortcutStatus: GlobalShortcutStatus | undefined;
/** 模块级持有以便 will-quit 时 dispose。 */
let toggleShortcut: GlobalToggleShortcutController | undefined;
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
	// connect-src 放行 127.0.0.1:*：PDF 预览的 pdf.js 用 fetch 从 preview-server
	// 拉文件（img/frame 只是嵌资源，fetch 受 connect-src 管）。
	// img-src 放行 https:（spec: add-source-favicons）：来源 favicon 与 markdown
	// 外部图片依赖它——此前不含 https: 是 favicon 全部回退 Globe 的根因。
	// 权衡：img-src 只放行图片加载（不可执行），风险是追踪像素/IP 暴露，
	// 对桌面 agent 是可接受口径（WorkBuddy 同）；script-src/connect-src 不受影响。
	const policy = isDev
		? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
		"img-src 'self' data: blob: https: http://127.0.0.1:*; " +
		"connect-src 'self' ws://localhost:* http://localhost:* http://127.0.0.1:*; " +
		"frame-src http://127.0.0.1:*"
		: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
		"img-src 'self' data: blob: https: http://127.0.0.1:*; connect-src 'self' http://127.0.0.1:*; " +
		"frame-src http://127.0.0.1:*";

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
		title: "嘉立创Work",
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

/* ── 全局唤起热键 ───────────────────────────────────────────────── */

/**
 * main 侧的事件日志落盘（最小实现）。
 *
 * 为什么不复用 core/event-log.ts：依赖规则里 main 只允许 import shared
 * （scripts/check-dependency-rules.ts 机械执行），EventLog 在 core 够不着；
 * 也不为这一条日志穿透 daemon。这里是与 EventLog 同格式（NDJSON、ts 打点、
 * 按日期分文件）、同目录（<配置根>/logs）的最小重复 —— WorkBuddy 把
 * 「跨进程打点到同一泳道 jsonl」列为 P0，排障时 main 与 daemon 的记录
 * 在同一个文件里按时间交织可查。
 * 路径推导与 core/config-paths.ts 的 getConfigDir() 保持一致，
 * 那边改了这里必须同步（这是允许重复的代价，写在这里提醒）。
 */
function appendMainEventLog(record: { readonly kind: string; readonly [key: string]: unknown }): void {
	const override = process.env["KAMIBUDDY_CONFIG_DIR"];
	const configDir = override !== undefined && override !== "" ? override : join(homedir(), ".kamibuddy");
	const logDir = join(configDir, "logs");
	const day = new Date().toISOString().slice(0, 10);
	try {
		mkdirSync(logDir, { recursive: true });
		appendFileSync(join(logDir, `events-${day}.jsonl`), `${JSON.stringify({ ts: Date.now(), ...record })}\n`, "utf8");
	} catch (error) {
		// 日志落盘失败（磁盘满/权限）不该炸主流程，但必须响亮地留痕（AGENTS.md §7）。
		console.error("[main] 事件日志落盘失败:", error);
	}
}

/**
 * 注册全局唤起热键（窗口创建后调用一次，机制见 main/global-shortcut.ts 文件头）。
 *
 * 注册只此一次，不随窗口重建重复注册：macOS 上窗口全关后 activate 会重建窗口，
 * 重复注册同一 accelerator 会被自己占用而失败。因此窗口操作回调不闭包捕获
 * 某个 BrowserWindow 实例，而是动态读模块级 window —— 窗口销毁重建后
 * 热键依然指向当前窗口；window 为 undefined 的瞬态读作「不可见未聚焦」，
 * 落到唤起分支，show/focus 是空操作，不会炸。
 */
function setupGlobalShortcut(): void {
	toggleShortcut = new GlobalToggleShortcutController(
		{
			minimize: () => window?.minimize(),
			restore: () => window?.restore(),
			show: () => window?.show(),
			focus: () => window?.focus(),
			isFocused: () => window?.isFocused() ?? false,
			isVisible: () => window?.isVisible() ?? false,
			isMinimized: () => window?.isMinimized() ?? false,
		},
		(status) => {
			globalShortcutStatus = status;
			if (status.kind === "failed") {
				// 注册失败（绝大多数是被别的程序占用）不炸启动，但现场必须可查：
				// 事件日志落一条，诊断页经 INVOKE.globalShortcutStatus 可见。
				console.warn(`[main] 全局唤起热键 "${status.accelerator}" 注册失败，可能被其他程序占用`);
				appendMainEventLog({ kind: "global_shortcut", event: "register_failed", accelerator: status.accelerator });
			}
		},
		{
			register: (accelerator, callback) => globalShortcut.register(accelerator, callback),
			unregisterAll: () => globalShortcut.unregisterAll(),
		},
	);
	toggleShortcut.register();
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

	// 同理：globalShortcut 的注册结果只有 main 知道（诊断页的热键状态行）。
	ipcMain.handle(INVOKE.globalShortcutStatus, () => globalShortcutStatus);

	ipcMain.handle(INVOKE.openArtifact, async (_event, path: string) => {
		const error = await shell.openPath(path);
		if (error !== "") throw new Error(error);
	});

	/*
	 * 「打开空间目录」与 openArtifact 的关键差别：路径必须先过 daemon 校验。
	 * 「是否已知工作空间」的知识只在 daemon（组由会话文件派生），main 不知道；
	 * renderer 是半可信环境，若像 openArtifact 那样「传什么开什么」，
	 * 任意网页/XSS 都能让 main 对任意路径 shell.openPath（弹 ~\.ssh、系统目录）。
	 * 所以先转发 daemon 校验（不通过则 reject，openPath 不会执行），通过后才开。
	 * shell 是 Electron API，daemon 不 import electron，执行只能在这里。
	 */
	ipcMain.handle(INVOKE.workspaceReveal, async (_event, cwd: string) => {
		await callDaemon(INVOKE.workspaceReveal, [cwd]);
		const error = await shell.openPath(cwd);
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

	// 技能导入的选目录。createDirectory 没必要开：导入的是已有技能文件夹。
	ipcMain.handle(INVOKE.pickSkillDirectory, async () => {
		if (window === undefined) return undefined;
		const { canceled, filePaths } = await dialog.showOpenDialog(window, {
			title: "选择技能文件夹（需包含 SKILL.md）",
			properties: ["openDirectory"],
		});
		return canceled || filePaths.length === 0 ? undefined : filePaths[0];
	});

	/*
	 * 画像导入的选文件 + 读内容（spec: add-memory-system）。
	 * 只「选 + 读」不写：PROFILE.md 的唯一写点是 daemon 的 setProfile
	 * （业务写一律在 daemon，main 不解释 payload 的边界不破），
	 * renderer 拿到内容后自行调 setProfile 完成导入。
	 */
	ipcMain.handle(INVOKE.importProfile, async () => {
		if (window === undefined) return undefined;
		const { canceled, filePaths } = await dialog.showOpenDialog(window, {
			title: "选择画像文件（Markdown）",
			properties: ["openFile"],
			filters: [{ name: "Markdown", extensions: ["md"] }],
		});
		if (canceled || filePaths.length === 0) return undefined;
		// noUncheckedIndexedAccess：length 守门后下标仍是 string | undefined，再窄化一次。
		const path = filePaths[0];
		if (path === undefined) return undefined;
		const content = await readFile(path, "utf8");
		return { content };
	});

	/*
	 * 图片 + 文档合并的多选框。读文件必须在 main 做：渲染进程是沙箱 web 环境，
	 * 拿不到任意路径的字节；与其开两条通道不如在 dialog 应答里一并完成。
	 * 选中后按扩展名分流：图片读成 ImagePart（大小守门在 readImageFile）；
	 * 文档不读内容、只回路径——内容读取是 read_document 工具的职责
	 * （模型按需读、有截断与续读；在这里预读会把整份大文档一次性挤进首条消息，
	 * 且区外文件的权限门也就此被绕过）。
	 */
	ipcMain.handle(INVOKE.pickInputFiles, async () => {
		if (window === undefined) return undefined;
		const imageExts = ["png", "jpg", "jpeg", "gif", "webp"];
		// dialog 的 extensions 不带点，从 shared 集合剥出（文档扩展名只许有一份真相）。
		const docExts = [PDF_EXTENSION, ...OFFICE_EXTENSIONS].map((ext) => ext.slice(1));
		const { canceled, filePaths } = await dialog.showOpenDialog(window, {
			title: "选择图片或文档",
			properties: ["openFile", "multiSelections"],
			filters: [
				{ name: "所有支持的文件", extensions: [...imageExts, ...docExts] },
				{ name: "图片", extensions: imageExts },
				{ name: "文档", extensions: docExts },
			],
		});
		if (canceled || filePaths.length === 0) return undefined;
		const images: ImagePart[] = [];
		const documents: DocumentReference[] = [];
		for (const path of filePaths) {
			const kind = docKindOf(path);
			if (kind === "pdf" || kind === "office") {
				documents.push({ path, name: basename(path) });
			} else {
				// filters 已限定可选类型；filter 被绕过时 readImageFile 会响亮报错，
				// 不在这里猜类型发出去。
				images.push(await readImageFile(path));
			}
		}
		return { images, documents };
	});
}

/**
 * 扩展名 → MIME。dialog 的 filters 已限定可选类型，落到未知扩展名
 * 说明环境异常（filter 被绕过），响亮失败而不是猜一个类型发出去。
 */
function imageMimeTypeOf(path: string): string {
	switch (extname(path).toLowerCase()) {
		case ".png":
			return "image/png";
		case ".jpg":
		case ".jpeg":
			return "image/jpeg";
		case ".gif":
			return "image/gif";
		case ".webp":
			return "image/webp";
		default:
			throw new Error(`不支持的图片格式：${path}`);
	}
}

/** 读图片文件并编码成 ImagePart（base64 无 data: 前缀，shared 契约）。 */
async function readImageFile(path: string): Promise<ImagePart> {
	// 体积守门与粘贴/拖拽入口（image-attachments.tsx 的 rejectReason）同上限：
	// dialog 选中的文件字节只在 main 可见，这道门必须在 readFile 之前补上，
	// 否则超限图会带着 base64 放大后的负载直接进入会话。
	const { size } = await stat(path);
	if (size > MAX_IMAGE_BYTES) {
		// 抛错经 invoke reject 回到 renderer 的 toast，文案口径与 rejectReason 一致。
		throw new Error(`「${basename(path)}」超过 5MB 上限`);
	}
	const data = await readFile(path);
	return { type: "image", data: data.toString("base64"), mimeType: imageMimeTypeOf(path) };
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
		setupGlobalShortcut();

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

	// globalShortcut 是进程级注册，退出时必须显式释放，
	// 否则热键会残留占用到进程句柄回收。
	app.on("will-quit", () => {
		toggleShortcut?.dispose();
	});
}
