/**
 * 产物预览静态服务：把当前工作区经 127.0.0.1 的 HTTP 暴露给预览 iframe。
 *
 * 为什么走本地静态服务而不是 file:// 或自定义 protocol（WorkBuddy 同款思路，
 * 07-artifact-preview.md §3）：
 *   - renderer 在 dev 下是 http://localhost:5173，file:// 的 iframe 被浏览器拦；
 *   - 产物 HTML 常带相对路径资源（同目录的 js/css），静态服务的目录语义天然支持；
 *   - 与 renderer 不同源（127.0.0.1:随机端口），配合 iframe sandbox 拿不到宿主状态。
 *
 * 安全红线：
 *   - 只绑 127.0.0.1，外网与局域网都摸不到；
 *   - 根目录固定为当前工作区，resolve 后必须在根内（防 ../ 穿越）；
 *   - 无工作区时不起服务 —— 没有目录就没有可预览的东西。
 *     （临时任务模型下工作区恒存在，这只覆盖启动前的瞬态。）
 */

import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { resolve, sep } from "node:path";

/** 最小 MIME 表：预览只需要认得这几类，其余一律 octet-stream（浏览器会下载或纯文本兜底）。 */
const MIME: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".htm": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".pdf": "application/pdf",
	".mp3": "audio/mpeg",
	".mp4": "video/mp4",
	".webm": "video/webm",
	// .ogg 容器音视频两栖，内容未知时 RFC 5334 推荐 application/ogg（媒体元素会嗅探）。
	".ogg": "application/ogg",
	".wav": "audio/wav",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".txt": "text/plain; charset=utf-8",
	".md": "text/plain; charset=utf-8",
};

function mimeOf(path: string): string {
	const dot = path.lastIndexOf(".");
	if (dot === -1) return "application/octet-stream";
	return MIME[path.slice(dot).toLowerCase()] ?? "application/octet-stream";
}

export class PreviewServer {
	private server: Server | undefined;
	private root: string | undefined;
	private port: number | undefined;

	get baseUrl(): string | undefined {
		if (this.server === undefined || this.port === undefined) return undefined;
		return `http://127.0.0.1:${this.port}`;
	}

	/** 当前服务的根目录（调试用）。 */
	get rootDir(): string | undefined {
		return this.root;
	}

	/**
	 * 切换服务根目录。undefined 表示停止服务（当前无可预览目录）。
	 * 同根重复调用是 no-op —— 不重启服务，正在预览的页面不掉线。
	 */
	async setRoot(dir: string | undefined): Promise<void> {
		if (dir === this.root) return;
		await this.close();
		if (dir === undefined) return;

		this.root = dir;
		this.server = createServer((req, res) => this.handle(req.url ?? "/", res));
		await new Promise<void>((resolveListen, rejectListen) => {
			this.server?.once("error", rejectListen);
			// 端口 0 = 系统分配，避免与任何固定端口撞车。
			this.server?.listen(0, "127.0.0.1", () => {
				const address = this.server?.address();
				if (typeof address === "object" && address !== null) this.port = address.port;
				resolveListen();
			});
		});
	}

	async close(): Promise<void> {
		const server = this.server;
		this.server = undefined;
		this.root = undefined;
		this.port = undefined;
		if (server !== undefined) {
			await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
		}
	}

	/**
	 * URL 路径 → 根内绝对路径。越界返回 undefined。
	 * 先 decode 再 resolve：%2e%2e%2f 与 ../ 同等处理，不存在绕过通道。
	 */
	resolveWithinRoot(urlPath: string): string | undefined {
		if (this.root === undefined) return undefined;
		let decoded: string;
		try {
			decoded = decodeURIComponent(urlPath);
		} catch {
			return undefined;
		}
		const abs = resolve(this.root, decoded.replace(/^[/\\]+/, ""));
		return abs === this.root || abs.startsWith(this.root + sep) ? abs : undefined;
	}

	private handle(url: string, res: import("node:http").ServerResponse): void {
		const q = url.indexOf("?");
		const path = this.resolveWithinRoot(q === -1 ? url : url.slice(0, q));
		// 越界与不存在一个口径（404）：不对外透露目录结构。
		if (path === undefined || !existsSync(path) || !statSync(path).isFile()) {
			res.writeHead(404).end("not found");
			return;
		}
		const headers: Record<string, string> = { "content-type": mimeOf(path) };
		// ?download = 强制落盘：预览面板与本服务不同源（127.0.0.1:随机端口），
		// <a download> 属性跨源被 Chromium 忽略、会变成整窗导航，
		// 只有 Content-Disposition: attachment 可靠（filename* 兜非 ASCII 文件名，RFC 5987）。
		if (q !== -1 && url.slice(q + 1).split("&").includes("download")) {
			const name = path.slice(path.lastIndexOf(sep) + 1);
			headers["content-disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(name)}`;
		}
		// CORS：预览面板（dev localhost:5173 / prod file://）与本服务（127.0.0.1:随机端口）
		// 不同源，PDF/Office 预览用 fetch 读字节会被浏览器 CORS 拦截——
		// 而嵌入式加载（img/video/audio/iframe）不受 CORS 约束所以正常。
		// 服务只绑 127.0.0.1、只读、根限工作区，风险可控，故放行所有源。
		// PNA（Private Network Access）：Electron 44 对 file://（非 local 地址空间）访问
		// 127.0.0.1（local 空间）会触发 PNA 预检，缺此头会被拦。
		headers["access-control-allow-origin"] = "*";
	headers["access-control-allow-private-network"] = "true";
	res.writeHead(200, headers);
	createReadStream(path).pipe(res);
}
}

/**
 * 多根预览服务池：每个 cwd 一个 PreviewServer（各占一个系统分配端口），懒建。
 *
 * 多任务并发后不同会话的工作目录不同，单根换服务模式（setRoot 先关旧服务）
 * 会让切走会话的预览立刻断线；改为按 cwd 各起一个实例后互不影响
 * （spec：support-concurrent-tasks E）。
 *
 * 不做实例回收：cwd 的数量被工作空间数天然约束（用户手动经营的目录，
 * 量级是个位到几十），每个空闲服务只占一个 loopback 端口与极小的
 * Server 对象，引入 LRU 只会换来「预览偶发重连」的复杂度，不值得。
 */
export class PreviewServers {
	private readonly servers = new Map<string, PreviewServer>();
	/** 同 cwd 的并发 ensure 共享同一个启动 promise，不会起出两个服务。 */
	private readonly starting = new Map<string, Promise<string | undefined>>();

	/** 查询某 cwd 的服务地址；该 cwd 的服务未启动时返回 undefined（契约口径，不视为错误）。 */
	baseUrlFor(cwd: string): string | undefined {
		return this.servers.get(cwd)?.baseUrl;
	}

	/**
	 * 确保某 cwd 的服务已启动，返回 baseUrl。
	 * 启动失败时清掉半成品实例并抛错 —— 调用方决定响亮失败（工作区切换）
	 * 还是记日志降级（启动预热），本层不静默吞。
	 */
	async ensure(cwd: string): Promise<string | undefined> {
		const running = this.servers.get(cwd);
		if (running !== undefined) return running.baseUrl;
		const pending = this.starting.get(cwd);
		if (pending !== undefined) return pending;

		const attempt = (async (): Promise<string | undefined> => {
			const server = new PreviewServer();
			try {
				await server.setRoot(cwd);
			} catch (error) {
				await server.close();
				throw error;
			}
			this.servers.set(cwd, server);
			return server.baseUrl;
		})();
		this.starting.set(cwd, attempt);
		try {
			return await attempt;
		} finally {
			this.starting.delete(cwd);
		}
	}

	/** 进程退出前收尾。daemon 随 utilityProcess 被杀时操作系统会回收端口，这里主要服务测试。 */
	async closeAll(): Promise<void> {
		const servers = [...this.servers.values()];
		this.servers.clear();
		await Promise.all(servers.map((server) => server.close()));
	}
}
