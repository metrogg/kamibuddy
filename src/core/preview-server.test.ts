import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PreviewServer } from "./preview-server.ts";

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
