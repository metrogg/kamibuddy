/**
 * resources/ 目录的加载器：场景骨架 + 交互模式 → 结构化资源。
 *
 * 这是「能力即数据」的入口（AGENTS.md §3）：加一个场景 = scenes/ 下加一个目录，
 * 加一个交互模式 = modes/ 下加一个 .md 文件，零行代码改动。
 *
 * 校验从紧（坏文件抛错而非忽略）：
 *   - frontmatter 的 id 必须与目录名/文件名一致（防改名字漏改引用）
 *   - ready 缺省为 false（漏写 = 不可选，比漏写 = 可选安全）
 *   - 目录为空或缺失直接抛错 —— 没有提示词的产品是错的，静默回落到 pi 默认
 *     提示词等于把「coding assistant」身份带回来
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ModeDescriptor } from "../shared/session-events.ts";
import { optionalBoolean, parseFrontmatter, requireString, requireStringArray } from "./frontmatter.ts";

/** 一个场景：骨架正文含 {{interaction}} / {{skills}} / {{cwd}} 槽位。 */
export interface SceneResource {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly ready: boolean;
	readonly body: string;
}

/** 一个交互模式：tools 是工具白名单（含禁用未列出工具的语义）。 */
export interface ModeResource {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly ready: boolean;
	readonly tools: readonly string[];
	readonly body: string;
}

export interface LoadedResources {
	readonly scenes: readonly SceneResource[];
	readonly modes: readonly ModeResource[];
}

/** 供 daemon 下发 UI 的描述符列表（工具白名单不下发——UI 不需要知道）。 */
export function toDescriptors(
	resources: LoadedResources,
): { scenes: ModeDescriptor[]; modes: ModeDescriptor[] } {
	const toDescriptor = <T extends { id: string; label: string; description: string; ready: boolean }>(r: T): ModeDescriptor => ({
		id: r.id,
		label: r.label,
		description: r.description,
		ready: r.ready,
	});
	return {
		scenes: resources.scenes.map(toDescriptor),
		modes: resources.modes.map(toDescriptor),
	};
}

export function loadResources(resourcesDir: string): LoadedResources {
	const scenesDir = join(resourcesDir, "scenes");
	const modesDir = join(resourcesDir, "modes");
	if (!existsSync(scenesDir) || !existsSync(modesDir)) {
		throw new Error(
			`资源目录不完整：需要 ${scenesDir} 与 ${modesDir}。` +
				`若设置了 KAMIBUDDY_RESOURCES_DIR，请检查其指向。`,
		);
	}

	const scenes = readdirSync(scenesDir)
		.filter((name) => !name.startsWith("."))
		.sort()
		.flatMap((name): SceneResource[] => {
			const dir = join(scenesDir, name);
			if (!statSync(dir).isDirectory()) return [];
			const file = join(dir, "prompt.md");
			if (!existsSync(file)) throw new Error(`场景「${name}」缺少 prompt.md（${dir}）`);
			const doc = parseFrontmatter(readFileSync(file, "utf8"), file);
			const id = requireString(doc, "id", file);
			if (id !== name) throw new Error(`${file}: frontmatter id「${id}」与目录名「${name}」不一致`);
			return [
				{
					id,
					label: requireString(doc, "label", file),
					description: requireString(doc, "description", file),
					ready: optionalBoolean(doc, "ready", false),
					body: doc.body,
				},
			];
		});
	if (scenes.length === 0) throw new Error(`scenes/ 下没有任何场景（${scenesDir}）`);

	const modes = readdirSync(modesDir)
		.filter((name) => name.endsWith(".md") && !name.startsWith("."))
		.sort()
		.map((name): ModeResource => {
			const file = join(modesDir, name);
			const doc = parseFrontmatter(readFileSync(file, "utf8"), file);
			const id = requireString(doc, "id", file);
			if (id !== name.replace(/\.md$/, "")) throw new Error(`${file}: frontmatter id「${id}」与文件名不一致`);
			return {
				id,
				label: requireString(doc, "label", file),
				description: requireString(doc, "description", file),
				ready: optionalBoolean(doc, "ready", false),
				tools: requireStringArray(doc, "tools", file),
				body: doc.body,
			};
		});
	if (modes.length === 0) throw new Error(`modes/ 下没有任何交互模式（${modesDir}）`);

	return { scenes, modes };
}
