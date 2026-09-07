/**
 * 内置斜杠命令：由 daemon 拦截处理、不经 pi 展开的命令。
 *
 * 与技能（/skill:name）和提示词模板（/模板名）的区别：后两者发出去后
 * pi 在 prompt() 里展开成文本（agent-session.js:853），而内置命令是**操作**
 * （新建任务、压缩上下文），发给模型没有意义，必须在 daemon 侧拦下来执行。
 *
 * 补全列表（daemon 的 completions 通道）与此处是一体两面：
 * 列表里 source=builtin 的命令，这里必须能识别 —— 否则补全出来发给模型就是骗用户。
 */

export interface BuiltinCommand {
	readonly name: "new" | "compact";
	/** 命令后的参数文本（已 trim）。/compact 的参数作为 pi 的 customInstructions。 */
	readonly args: string;
}

export function parseBuiltinCommand(text: string): BuiltinCommand | undefined {
	if (!text.startsWith("/")) return undefined;
	const space = text.indexOf(" ");
	const name = space === -1 ? text.slice(1) : text.slice(1, space);
	const args = space === -1 ? "" : text.slice(space + 1).trim();

	// /new 只接受精确匹配：带参数的 "/new 做个周报" 更像用户想发文本，
	// 静默吞掉转成新建任务比发给模型更糟。
	if (name === "new" && args === "") return { name: "new", args };
	if (name === "compact") return { name: "compact", args };
	return undefined;
}
