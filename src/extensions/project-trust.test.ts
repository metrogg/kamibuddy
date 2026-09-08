/**
 * 项目信任的行为测试。
 *
 * 这道闸的位置很特殊：它在**工具层之前**——`.pi/extensions` 是 TypeScript 模块，
 * 加载即以本进程权限执行，权限门拦不到（那不是工具调用）。
 * 所以每条用例对应一个真实的攻击面或一个"防线会被用户习惯性绕过"的场景。
 */

import { join, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createProjectTrust } from "./project-trust.ts";

const HOME = resolve(sep, "users", "someone");
const OWN = join(HOME, "KamiBuddy");

/** pi 传给 project_trust 处理器的最小事件/上下文形状。 */
type Handler = (
	event: { readonly cwd: string },
	ctx: {
		readonly hasUI: boolean;
		readonly ui: {
			confirm: (title: string, message: string) => Promise<boolean>;
			notify: (message: string) => void;
		};
	},
) => Promise<{ trusted: string; remember?: boolean }>;

/**
 * 装好扩展，返回捕获到的处理器与被问过的问题。
 *
 * answer 为 undefined 表示"不该被问到"——若真被问了，测试会因抛错而失败，
 * 这比事后断言 asked.length===0 更直接。
 */
function mount(options: { readonly answer?: boolean } = {}): {
	readonly call: Handler;
	readonly asked: string[];
} {
	const asked: string[] = [];
	let captured: Handler | undefined;

	const fakePi = {
		on: (event: string, handler: unknown) => {
			if (event === "project_trust") captured = handler as Handler;
		},
	} as unknown as ExtensionAPI;

	createProjectTrust({
		isOwnWorkspace: (dir) => dir === OWN || dir.startsWith(OWN + sep),
	})(fakePi);

	if (captured === undefined) throw new Error("扩展没有注册 project_trust 处理器");

	const call: Handler = (event, ctx) =>
		captured!(event, {
			...ctx,
			ui: {
				confirm: async (title, message) => {
					asked.push(`${title}\n${message}`);
					if (options.answer === undefined) throw new Error("本用例不应弹出信任询问");
					return options.answer;
				},
				notify: () => undefined,
			},
		});

	return { call, asked };
}

const WITH_UI = { hasUI: true, ui: { confirm: async () => false, notify: () => undefined } };
const NO_UI = { hasUI: false, ui: { confirm: async () => false, notify: () => undefined } };

describe("自家工作空间", () => {
	it("直接信任，不打扰用户", async () => {
		const { call, asked } = mount();
		const result = await call({ cwd: OWN }, WITH_UI);

		expect(result).toEqual({ trusted: "yes" });
		expect(asked).toHaveLength(0);
	});

	it("子目录同样直接信任 —— 每次新建任务都弹框会让人条件反射点同意", async () => {
		const { call, asked } = mount();
		const result = await call({ cwd: join(OWN, "项目A") }, WITH_UI);

		expect(result).toEqual({ trusted: "yes" });
		expect(asked).toHaveLength(0);
	});

	it("不记住自家目录的信任 —— 无需落盘，判定本身就是常量", async () => {
		const { call } = mount();
		const result = await call({ cwd: OWN }, WITH_UI);
		expect(result.remember).toBeUndefined();
	});
});

describe("陌生目录", () => {
	it("用户同意 → 信任并记住", async () => {
		const { call, asked } = mount({ answer: true });
		const result = await call({ cwd: join(HOME, "别人发来的文件夹") }, WITH_UI);

		expect(result).toEqual({ trusted: "yes", remember: true });
		expect(asked).toHaveLength(1);
	});

	it("用户拒绝 → 不信任，且**不记住**", async () => {
		// 不记住 no 是有意的：我们还没有「信任管理」界面，
		// 一旦写进 trust.json 用户就没地方改回来；不记住的代价只是下次再问一次。
		const { call } = mount({ answer: false });
		const result = await call({ cwd: join(HOME, "别人发来的文件夹") }, WITH_UI);

		expect(result).toEqual({ trusted: "no" });
		expect(result.remember).toBeUndefined();
	});

	it("询问文案要给出目录、说明代码会被执行、并指出判断依据", async () => {
		// 用户看不懂风险就只会随手点同意，文案是这道防线的实际强度。
		const target = join(HOME, "下载", "someone-else-repo");
		const { call, asked } = mount({ answer: true });
		await call({ cwd: target }, WITH_UI);

		const text = asked[0] ?? "";
		expect(text).toContain(target); // 到底是哪个目录
		expect(text).toContain("运行代码"); // 风险是什么
		expect(text).toContain("不是你自己创建的"); // 怎么判断
		expect(text).toContain("不受影响"); // 拒绝的代价（避免因怕坏而乱点同意）
	});

	it("同名前缀的兄弟目录不算自家（KamiBuddy-backup 要问）", async () => {
		// 若判定只用字符串前缀，`~/KamiBuddy-backup` 会被误当成自家目录直接信任。
		const { call, asked } = mount({ answer: true });
		const result = await call({ cwd: `${OWN}-backup` }, WITH_UI);

		expect(result).toEqual({ trusted: "yes", remember: true });
		expect(asked).toHaveLength(1); // 被问过 = 没有被误判为自家
	});
});

describe("无 UI（headless / RPC 无应答方）", () => {
	it("返回 undecided 交回 pi 的默认值（其默认 ask 在无 UI 时跳过资源 = fail-closed）", async () => {
		const { call } = mount();
		const result = await call({ cwd: join(HOME, "陌生目录") }, NO_UI);

		expect(result).toEqual({ trusted: "undecided" });
	});

	it("自家目录在无 UI 时仍然信任 —— 判定不依赖询问", async () => {
		const { call } = mount();
		const result = await call({ cwd: OWN }, NO_UI);

		expect(result).toEqual({ trusted: "yes" });
	});
});
