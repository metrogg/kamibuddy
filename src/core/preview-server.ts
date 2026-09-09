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
		res.writeHead(200, headers);
		createReadStream(path).pipe(res);
	}
}
