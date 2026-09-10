import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PreviewServer, PreviewServers } from "./preview-server.ts";

let base: string;
let server: PreviewServer;

beforeEach(() => {
	base = mkdtempSync(join(tmpdir(), "kami-preview-"));
	mkdirSync(join(base, "sub"), { recursive: true });
	writeFileSync(join(base, "snake.html"), "<html><body>game</body></html>");
	writeFileSync(join(base, "sub", "app.js"), "console.log(1)");
	server = new PreviewServer();
});

afterEach(async () => {
	await server.close();
	rmSync(base, { recursive: true, force: true });
});

async function fetchText(url: string): Promise<{ status: number; body: string; contentType: string }> {
	const r = await fetch(url);
	return {
		status: r.status,
		body: await r.text(),
		contentType: r.headers.get("content-type") ?? "",
	};
}

describe("PreviewServer", () => {
	it("启动后能按相对路径取到文件，MIME 按扩展名", async () => {
		await server.setRoot(base);
		const html = await fetchText(`${server.baseUrl}/snake.html`);
		expect(html.status).toBe(200);
		expect(html.body).toContain("game");
		expect(html.contentType).toContain("text/html");

		const js = await fetchText(`${server.baseUrl}/sub/app.js`);
		expect(js.status).toBe(200);
		expect(js.contentType).toContain("javascript");
	});

	it("路径穿越（../、..%2F）一律 403", async () => {
		await server.setRoot(base);
		for (const p of ["/../etc/passwd", "/..%2F..%2Fsecret", "/sub/../../out"]) {
			const r = await fetch(`${server.baseUrl}${p}`);
			expect([403, 404]).toContain(r.status);
		}
	});

	it("不存在的文件 404", async () => {
		await server.setRoot(base);
		const r = await fetch(`${server.baseUrl}/nope.txt`);
		expect(r.status).toBe(404);
	});

	it("音/视频扩展名按 MIME 表回 Content-Type", async () => {
		writeFileSync(join(base, "a.webm"), "x");
		writeFileSync(join(base, "a.wav"), "x");
		writeFileSync(join(base, "a.ogg"), "x");
		await server.setRoot(base);
		expect((await fetch(`${server.baseUrl}/a.webm`)).headers.get("content-type")).toBe("video/webm");
		expect((await fetch(`${server.baseUrl}/a.wav`)).headers.get("content-type")).toBe("audio/wav");
		// .ogg 内容未知，按 RFC 5334 回 application/ogg（媒体元素自行嗅探）。
		expect((await fetch(`${server.baseUrl}/a.ogg`)).headers.get("content-type")).toBe("application/ogg");
	});

	it("?download 回 Content-Disposition: attachment（跨源 <a download> 不生效，靠它落盘）", async () => {
		writeFileSync(join(base, "报告 第一章.txt"), "x");
		await server.setRoot(base);
		const plain = await fetch(`${server.baseUrl}/snake.html`);
		expect(plain.headers.get("content-disposition")).toBeNull();

		const r = await fetch(`${server.baseUrl}/snake.html?download`);
		expect(r.status).toBe(200);
		expect(r.headers.get("content-disposition")).toBe(`attachment; filename*=UTF-8''${encodeURIComponent("snake.html")}`);

		// 非 ASCII 文件名走 RFC 5987 filename* 百分号编码。
		const zh = await fetch(`${server.baseUrl}/${encodeURIComponent("报告 第一章.txt")}?download`);
		expect(zh.headers.get("content-disposition")).toBe(
			`attachment; filename*=UTF-8''${encodeURIComponent("报告 第一章.txt")}`,
		);
	});

	it("setRoot(undefined) 停止服务（无可预览目录）", async () => {
		await server.setRoot(base);
		const url = server.baseUrl;
		expect(url).toBeDefined();
		await server.setRoot(undefined);
		expect(server.baseUrl).toBeUndefined();
		await expect(fetch(`${url}/snake.html`)).rejects.toThrow();
	});

	it("换根后服务新目录，旧路径不再可用", async () => {
		await server.setRoot(base);
		const other = mkdtempSync(join(tmpdir(), "kami-preview-b-"));
		writeFileSync(join(other, "b.html"), "<html>b</html>");
		await server.setRoot(other);
		const r = await fetch(`${server.baseUrl}/b.html`);
		expect(r.status).toBe(200);
		const old = await fetch(`${server.baseUrl}/snake.html`);
		expect(old.status).toBe(404);
		rmSync(other, { recursive: true, force: true });
	});
});

describe("PreviewServers（多根池）", () => {
	let pool: PreviewServers;
	let other: string;

	beforeEach(() => {
		pool = new PreviewServers();
		other = mkdtempSync(join(tmpdir(), "kami-preview-pool-"));
		writeFileSync(join(other, "b.html"), "<html>b</html>");
	});

	afterEach(async () => {
		await pool.closeAll();
		rmSync(other, { recursive: true, force: true });
	});

	it("每个 cwd 一个独立端口，互不影响", async () => {
		const urlA = await pool.ensure(base);
		const urlB = await pool.ensure(other);
		expect(urlA).toBeDefined();
		expect(urlB).toBeDefined();
		expect(urlA).not.toBe(urlB);
		// 两个根同时在线：A 的文件在 B 上 404，反之亦然。
		expect((await fetch(`${urlA}/snake.html`)).status).toBe(200);
		expect((await fetch(`${urlB}/b.html`)).status).toBe(200);
		expect((await fetch(`${urlA}/b.html`)).status).toBe(404);
		expect((await fetch(`${urlB}/snake.html`)).status).toBe(404);
	});

	it("ensure 幂等：同 cwd 重复调用复用同一实例（端口不变）", async () => {
		const url1 = await pool.ensure(base);
		const url2 = await pool.ensure(base);
		expect(url2).toBe(url1);
		// 并发 ensure 也共享同一个启动 promise，不会起出两个服务。
		const [url3, url4] = await Promise.all([pool.ensure(other), pool.ensure(other)]);
		expect(url4).toBe(url3);
	});

	it("baseUrlFor：未启动的 cwd 返回 undefined（契约口径，不视为错误）", async () => {
		expect(pool.baseUrlFor(base)).toBeUndefined();
		await pool.ensure(base);
		expect(pool.baseUrlFor(base)).toBeDefined();
	});

	it("closeAll 后所有实例下线", async () => {
		const urlA = await pool.ensure(base);
		await pool.closeAll();
		expect(pool.baseUrlFor(base)).toBeUndefined();
		await expect(fetch(`${urlA}/snake.html`)).rejects.toThrow();
	});
});
