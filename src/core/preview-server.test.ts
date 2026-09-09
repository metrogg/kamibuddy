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
