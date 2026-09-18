/**
 * 预装服务商（开箱即用）：让同事机器一装上就有公司中转，不必自己填
 * 标识 / 接口地址 / 接口协议 / 认证头 —— 那四项一次填对很难，而填错的报错
 * 发生在真正请求时（`baseUrl` 少一层 `/api`、协议选成 OpenAI 兼容、
 * 忘了勾 Bearer），排查成本与「少填四个框」完全不成比例。
 *
 * 为什么放 core 而不是 daemon/index.ts：入口文件顶层要 `process.parentPort()`，
 * 脱离 Electron 无法加载，逻辑沉在这里才能单测（同 builtin-memory-task.ts）。
 *
 * 为什么是代码常量而不是 resources/ 下的文件：与内置「记忆整理」任务同一判据 ——
 * 它是**单条内置数据**，不是一类可扩展能力（体裁 / 模式 / 技能那种）。
 * 为一条 provider 预设单开一类资源目录 + 加载器 + 校验是 YAGNI；
 * 预设超过两条、或需要运维在不发版的情况下改它时，再迁去 `resources/`。
 *
 * ## 三条硬规则
 *
 * 1. **只写「不存在」的条目**，已存在一律原样不动 —— 无论它带不带归属标记。
 *    用户可能手编过同 id 条目（实测本机就有一条手写的 `jlc-glm`：baseUrl 带尾斜杠、
 *    已配好 2 个模型），动它等于覆盖用户数据；而 `upsertCustomProvider` 自己也会对
 *    **无标记**的同 id 条目抛错（「请换一个 id 以免覆盖它」），所以绝不能无脑 upsert。
 * 2. **不写 apiKey。** 密钥走 `auth.json`（0600），预装**不含任何凭据** ——
 *    源码与安装包里都不出现密钥，由用户首次填入。所以「预装」省下的是
 *    协议 / 地址 / 认证头这三项，**API Key 仍要填**（一机一次）。
 *    要连密钥一起发，等于把公司网关凭据放进可分发产物，须单独立决策。
 * 3. **models 留空。** 模型 id 由用户自己填（2026-09-18 用户决策）：中转的可用
 *    模型清单会变，写死一份很快过期；而猜错的能力位（reasoning / vision）
 *    比没有更糟 —— 会让请求带上端点不认的参数。实测确认 pi 接受 `models: []`
 *    （服务商进快照、贡献 0 个模型、整体目录不受影响）。
 */

import { readModelsJson, upsertCustomProvider } from "./custom-providers.ts";
import type { CustomApi } from "../shared/settings.ts";

/** 一条预装服务商的定义。字段刻意只留「用户不该自己填的那些」。 */
export interface BuiltinProviderPreset {
	/** 唯一 id（kebab-case，pi 的 auth.json 键与模型前缀都用它）。 */
	readonly id: string;
	/** 显示名称。大写与下划线在这里是允许的 —— 只有 id 受 kebab-case 约束。 */
	readonly displayName: string;
	/** 完整基址。anthropic 系填到端点根：SDK 自己拼 `/v1/messages`。 */
	readonly baseUrl: string;
	readonly api: CustomApi;
	/**
	 * 认证头形态。Claude Code 系中转按 `ANTHROPIC_AUTH_TOKEN` 语义校验
	 * `Authorization: Bearer`，官方 key 才是 `x-api-key`。
	 */
	readonly authHeader?: boolean;
}

/**
 * 公司中转（Claude-Relay 平台）。
 *
 * 事实来源：`claude.jlcops.com/api` 那张模型表（模型 ID / 支持「Claude Code」/
 * 访问 URL）。「支持编程工具 = Claude Code」即 anthropic-messages 系中转，
 * 故认证走 Bearer。模型清单**不预置** —— 见文件头规则 3。
 */
export const BUILTIN_PROVIDERS: readonly BuiltinProviderPreset[] = [
	{
		id: "jlc-glm",
		displayName: "JLC_GLM",
		baseUrl: "https://claude.jlcops.com/api",
		api: "anthropic-messages",
		authHeader: true,
	},
];

/**
 * 确保预装服务商存在（幂等）。返回是否发生了落盘变更，调用方据此决定要不要
 * 推 `settings` 快照让界面立刻看到。
 *
 * `presets` 可注入仅为单测方便（不传走 BUILTIN_PROVIDERS）。
 * 文件损坏时抛错 —— 与 readModelsJson 同一口径，由调用方决定怎么呈现。
 */
export function ensureBuiltinProviders(
	path: string,
	presets: readonly BuiltinProviderPreset[] = BUILTIN_PROVIDERS,
): boolean {
	// 一次性读原始存在性：判据是「预装**之前**有没有」，而不是逐轮重读
	//（逐轮重读会把本轮刚写进去的条目当成「已存在」，逻辑上没错但语义绕）。
	const existing = readModelsJson(path).providers;

	let changed = false;
	for (const preset of presets) {
		if (existing[preset.id] !== undefined) continue;
		upsertCustomProvider(path, {
			id: preset.id,
			name: preset.displayName,
			baseUrl: preset.baseUrl,
			api: preset.api,
			...(preset.authHeader === true ? { authHeader: true as const } : {}),
			// 模型留给用户填（规则 3）。空数组走 upsertCustomProvider 是合法的：
			// 它不做表单那套「至少填一个模型」的校验（那是表单的输入约束，不是落盘约束）。
			models: [],
		});
		changed = true;
	}
	return changed;
}
