import { describe, expect, it } from "vitest";
import { rewriteChartCdn } from "./widget-view.tsx";

describe("rewriteChartCdn（Chart.js CDN → 内联 UMD）", () => {
	it("白名单 CDN 的 chart.umd script src 被整体替换为内联 UMD", () => {
		const hosts = [
			"https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js",
			"https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js",
			"https://unpkg.com/chart.js@4.4.0/dist/chart.umd.min.js",
		];
		for (const host of hosts) {
			const html = `<div><script src="${host}"></script><script>new Chart();</script></div>`;
			const out = rewriteChartCdn(html);
			// 外链没了，UMD 源码内联进来了（Chart.js UMD 的 UMD工厂特征串）
			expect(out).not.toContain(host);
			expect(out).toContain('!function(t,e){"object"==typeof exports');
			// 其余 script 原样保留（内联 Chart 在前、依赖它的内联在后，文档序即执行序）
			expect(out).toContain("new Chart();");
		}
	});

	it("幂等：重写后的输出不再被二次改写", () => {
		const once = rewriteChartCdn(
			'<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js"></script>',
		);
		const twice = rewriteChartCdn(once);
		expect(twice).toBe(once);
	});

	it("非 chart.umd 的 CDN 脚本与普通内容不动", () => {
		const html =
			'<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.0.0/react.min.js"></script><p>正文</p>';
		expect(rewriteChartCdn(html)).toBe(html);
	});

	it("esm.sh 是 ESM 语义，不内联 UMD（不误伤）", () => {
		const html = '<script src="https://esm.sh/chart.js@4.4.0/dist/chart.umd.js"></script>';
		expect(rewriteChartCdn(html)).toBe(html);
	});
});
