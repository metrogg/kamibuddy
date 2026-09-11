/**
 * 工具名 → 图标组件 注册表（机制对齐 WorkBuddy 的 tool-icon-registry）。
 *
 * 解析顺序：归一化（小写 + 去 `_-`）→ 精确表 → 前缀表（长的先匹配）→ 兜底扳手。
 * 归一化让 "WebFetch" / "web_fetch" / "web-fetch" 落同一格，大小写风格
 * 不同的工具源（pi 下划线系 / ClaudeCode 帕斯卡系）不需要各写一遍。
 *
 * 映射表是数据不是代码（§3）：加一个工具类型 = 在对应 entry 的 toolNames
 * 里加一个名字，不新增分支。图标组件复用 icons.tsx 现有资产，不为同一
 * 图形起第二个名字（§4）。
 */

import { createElement } from "react";
import type { ReactElement } from "react";
import {
	IconAlert,
	IconCheck,
	IconClipboard,
	IconCloud,
	IconDatabase,
	IconDebug,
	IconEdit,
	IconEye,
	IconFolder,
	IconImage,
	IconLocation,
	IconResearch,
	IconSend,
	IconSkill,
	IconTerminal,
	IconTrash,
	IconWeb,
	IconWorkspace,
	IconWrench,
} from "./icons.tsx";

/** 工具图标的公共 props 形状（icons.tsx 全体线性图标都满足）。 */
export interface ToolIconProps {
	readonly size?: number;
	readonly className?: string;
}

export type ToolIconComponent = (props: ToolIconProps) => React.JSX.Element;

interface ToolIconEntry {
	readonly icon: ToolIconComponent;
	readonly toolNames: readonly string[];
	readonly prefixes?: readonly string[];
}

/** 归一化：小写 + 去下划线/连字符。"ToolSearch"/"tool_search" → "toolsearch"。 */
function normalizeName(name: string): string {
	return name.toLowerCase().replace(/[_-]/g, "");
}

/**
 * 精确表先写本项目实际会到的工具名（pi 下划线系 + read_document），
 * 再列 WorkBuddy 表里的常见异名 —— 模型侧工具面扩充时大概率撞得上。
 */
const TOOL_ICON_ENTRIES: readonly ToolIconEntry[] = [
	{
		icon: IconEye,
		toolNames: ["read", "read_file", "read_document", "read_me", "preview_url", "present_files", "NotebookRead"],
	},
	{
		icon: IconEdit,
		toolNames: ["write", "edit", "MultiEdit", "write_to_file", "replace_in_file", "append_to_file"],
	},
	{
		icon: IconTerminal,
		toolNames: ["bash", "powershell", "execute_command", "run_terminal_cmd", "KillShell", "BashOutput"],
	},
	{
		icon: IconResearch,
		toolNames: ["grep", "find", "Glob", "search_files", "codebase_search", "RAG_search"],
	},
	{
		icon: IconFolder,
		toolNames: ["ls", "list_files", "list_dir"],
	},
	{
		icon: IconWeb,
		toolNames: ["web_fetch", "web_search"],
	},
	{
		icon: IconTrash,
		toolNames: ["DeleteFiles", "delete_file", "CronDelete"],
	},
	{
		icon: IconSkill,
		toolNames: ["Skill", "use_skill", "SlashCommand"],
	},
	{
		icon: IconCheck,
		toolNames: ["completion", "finish_task"],
	},
	{
		icon: IconClipboard,
		toolNames: ["plan_task", "TaskCreate", "TodoWrite", "CronCreate", "PlanCreate", "PlanUpdate", "TaskUpdate", "TaskList"],
	},
	{
		icon: IconSend,
		toolNames: ["Agent", "SendMessage", "AskUserQuestion", "dispatch_specialist"],
	},
	{
		icon: IconImage,
		toolNames: ["image_gen", "image_edit", "video_gen"],
	},
	{
		icon: IconWorkspace,
		toolNames: ["ShowWidget"],
	},
	{
		icon: IconDatabase,
		toolNames: [],
		prefixes: ["Supabase"],
	},
	{
		icon: IconCloud,
		toolNames: ["connect_cloud_service"],
		prefixes: ["CloudStudio"],
	},
	{
		icon: IconDebug,
		toolNames: [],
		prefixes: ["Debug"],
	},
	{
		icon: IconLocation,
		toolNames: ["poi_query", "get_location", "pick_location"],
	},
	{
		icon: IconWrench,
		toolNames: ["mcp_call_tool", "call_integration"],
		prefixes: ["mcp__"],
	},
];

const FALLBACK_ICON: ToolIconComponent = IconWrench;

const exactMatchMap = new Map<string, ToolIconComponent>();
const prefixEntries: { readonly prefix: string; readonly icon: ToolIconComponent }[] = [];
for (const entry of TOOL_ICON_ENTRIES) {
	for (const name of entry.toolNames) exactMatchMap.set(normalizeName(name), entry.icon);
	for (const prefix of entry.prefixes ?? []) prefixEntries.push({ prefix: normalizeName(prefix), icon: entry.icon });
}
// 长前缀先匹配："cloudstudio" 先于 "debug"，避免短前缀误吞长前缀的工具族。
prefixEntries.sort((a, b) => b.prefix.length - a.prefix.length);

/** 工具名 → 图标组件（精确 → 前缀 → 兜底，永不落空）。 */
export function toolIconOf(toolName: string): ToolIconComponent {
	const normalized = normalizeName(toolName);
	const exact = exactMatchMap.get(normalized);
	if (exact !== undefined) return exact;
	for (const { prefix, icon } of prefixEntries) {
		if (normalized.startsWith(prefix)) return icon;
	}
	return FALLBACK_ICON;
}

/**
 * 同 toolName + 同 svg 属性 → 稳定同一 ReactElement 引用（WorkBuddy 同款缓存）。
 *
 * 长任务几十张工具卡同屏、流式期间每 token 重渲染消息流，缓存让图标
 * 元素引用稳定，下游 memo/diff 不会因每次新建元素而失效。
 */
const iconElementCache = new Map<string, ReactElement>();

export function toolIconElement(toolName: string, props?: ToolIconProps): ReactElement {
	const key = `${toolName}|${props?.size ?? ""}|${props?.className ?? ""}`;
	const cached = iconElementCache.get(key);
	if (cached !== undefined) return cached;
	const element = createElement(toolIconOf(toolName), props);
	iconElementCache.set(key, element);
	return element;
}

/** 失败状态图标：属于状态而非工具类型，不进映射表（WorkBuddy 同样把 status-icon 拆开注册）。 */
export const FAILED_ICON: ToolIconComponent = IconAlert;
