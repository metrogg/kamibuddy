/**
 * 用户消息开头的技能块 → 胶囊数据（spec: rework-skill-ux-workbuddy）。
 *
 * 形状来源：pi 的 `_expandSkillCommand`
 * （node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js:983-1007）
 * 把 `/skill:<name> [args]` 展开成
 *
 *   <skill name="X" location="C:\…\SKILL.md">
 *   References are relative to <baseDir>.
 *
 *   <SKILL.md 正文，已去 frontmatter>
 *   </skill>
 *
 * 有补充文本时再接 `\n\n<args>`。展开结果被**当作 user message 的 content**
 * 交给 pi 的事件流 —— 于是 message_start 原样翻译后，整篇 SKILL.md 与用户机器的
 * 绝对路径就进了用户气泡（现象：气泡里摊开一屏 XML 与内部路径）。
 *
 * 为什么在这里剥、而不是塞进渲染层：
 *   - 渲染层只该负责把事件画出来。剥块是对话语义（技能名是结构化数据），放渲染层
 *     意味着 daemon 侧的事件流、上下文用量估算、复制/重试等其它消费方看到的仍是
 *     带正文的文本，多处口径各自漂移；
 *   - 活会话（session-host 的 message_start）与历史重建（session-rebuild 的
 *     userView）是同一份 UserMessage 的两条产出路径，解析必须同源 —— 否则会出现
 *     「在线是胶囊、刷新又变回一屏正文」，这个坑在 summarizeArgs 上已经踩过一次。
 *
 * 放在 shared/ 而不是 core/ 的第二个理由：本模块同时是**写**（`skillInvocationText`）
 * 的归属地 —— 拆与拼必须共用同一套语法，而渲染层（重试、复制）只许 import shared/
 * （AGENTS.md §1）。拆在 core、拼在渲染层，等于把 `/skill:` 语法抄成两份。
 *
 * 纯函数、零 IO、不 import electron / pi 运行时，可脱离宿主单测。
 */

export interface SkillBlockSplit {
	/** 剥出的技能名，按出现顺序。无技能块时为空数组。 */
	readonly skillNames: readonly string[];
	/** 用户气泡要展示的文本：技能块与其后的分隔空白已去掉并 trim。无块时原样返回。 */
	readonly text: string;
}

/**
 * 技能命令的命名空间前缀：pi 认的语法是 `/skill:<name>`（agent-session.js:984
 * 的 `text.startsWith("/skill:")`），补全列表里的技能项也用 `skill:<name>` 这个名字
 * 与提示词模板 / 内置命令区分（shared/ipc.ts 的 CommandItem）。
 *
 * 三个消费方（补全项构造、技能 chip 的裸名、拼回发送文本）必须用同一个字面量 ——
 * 各写各的 `"skill:"` 就是三份会漂移的语法（AGENTS.md §4）。
 */
export const SKILL_COMMAND_PREFIX = "skill:";

/**
 * 补全项的 `skill:<name>` 名 → 裸技能名（chip 上显示、拼回发送文本都用它）。
 *
 * 放在语法模块里而不是渲染层切字符串：名字形状由契约（shared/ipc.ts 的 CommandItem）
 * 与 pi 的前缀共同决定，切法只该有一份实现。名字不是技能形态时原样返回 ——
 * 调用方只在 `source === "skill"` 上用，这条只是防御性兜底（返回原值可见，不会静默吞掉）。
 */
export function bareSkillName(commandName: string): string {
	return commandName.startsWith(SKILL_COMMAND_PREFIX)
		? commandName.slice(SKILL_COMMAND_PREFIX.length)
		: commandName;
}

/** 起始位置的技能开标签。要求 `<skill` 紧贴文本开头：正文中部出现的一律不算调用。 */
const OPEN_TAG = /^<skill(?:\s[^>]*)?>/;
/** 开标签里的属性。`[^"]*` 容得下 Windows 反斜杠、中文与空格路径。 */
const ATTRIBUTE = /([A-Za-z][\w-]*)\s*=\s*"([^"]*)"/g;
const CLOSE_TAG = "</skill>";

/** 从开标签原文里读属性值。属性顺序无关（pi 写的是 name 在前，但不把它当契约）。 */
function readAttribute(tag: string, key: string): string | undefined {
	for (const match of tag.matchAll(ATTRIBUTE)) {
		if (match[1] === key && match[2] !== "") return match[2];
	}
	return undefined;
}

/**
 * 剥掉文本**开头**的连续 `<skill …>…</skill>` 块，返回技能名与剩余文本。
 *
 * 连续多块是支持的：一条用户消息的 content 可能是多个 text 块拼起来的，
 * 拼接处正好能让两个展开块相邻。
 */
export function splitSkillBlocks(text: string): SkillBlockSplit {
	if (!text.startsWith("<skill")) return { skillNames: [], text };

	const skillNames: string[] = [];
	let cursor = 0;

	while (cursor < text.length) {
		const open = OPEN_TAG.exec(text.slice(cursor));
		// 形状不对（`<skills>`、属性缺 name、属性没引号）就不再往下剥：
		// 宁可原样显示，也不能把用户自己的文字当技能块吃掉。
		if (open === null) break;
		const name = readAttribute(open[0], "name");
		if (name === undefined) break;

		const close = text.indexOf(CLOSE_TAG, cursor + open[0].length);
		// 没有闭合标签 = 不是 pi 写出的完整块，不剥。
		if (close === -1) break;

		skillNames.push(name);
		cursor = close + CLOSE_TAG.length;
		// 归一 `</skill>` 与其后内容之间的分隔空白（pi 写的是 `\n\n`；
		// 相邻块之间同理）。跳过空白后如果是下一个块，循环继续。
		while (cursor < text.length && /\s/.test(text[cursor] ?? "")) cursor += 1;
	}

	if (skillNames.length === 0) return { skillNames: [], text };
	return { skillNames, text: text.slice(cursor).trim() };
}

/**
 * `splitSkillBlocks` 的逆运算：把「技能名 + 补充文本」拼回用户实际打过的
 * `/skill:<name> <补充文本>`。
 *
 * 谁需要它：**重试与复制**。这两件事的语义是「再发一次 / 复制用户说过的话」，
 * 不是「再发一次模型当时看到的文本」——
 *   - 不拼回去，重试会把技能丢掉：只重发补充文本，技能不再加载；
 *   - 只有技能、没有补充文本时，复制会得到一个空串。
 *
 * 分隔符必须是**空格**，不能是 `\n\n`：pi 的展开按第一个空格切名字与参数
 * （agent-session.js:986-988 `text.indexOf(" ")`），用换行拼出来的
 * `/skill:docx\n\n写周报` 会被当成名字叫「docx\n\n写周报」的技能，查不到即原样透传。
 *
 * 多个技能名时只有第一个会被 pi 展开（它只认文本开头的 `/skill:`）——
 * 而一条消息带多个技能本来就只可能来自拼接的 content 块，属边角；这里按顺序拼出
 * 全部名字，不假装能表达 pi 不支持的东西。
 */
export function skillInvocationText(skillNames: readonly string[], text: string): string {
	if (skillNames.length === 0) return text;
	const parts = skillNames.map((name) => `/${SKILL_COMMAND_PREFIX}${name}`);
	if (text !== "") parts.push(text);
	return parts.join(" ");
}
