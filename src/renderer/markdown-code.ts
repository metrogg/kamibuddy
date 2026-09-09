/**
 * 围栏代码块卡片化的纯函数部分：语言名提取 + 代码文本提取。
 *
 * 抽成纯函数的原因：pre 覆盖组件里要同时喂头部（语言名）和复制按钮（文本），
 * react-markdown 传进来的 children 形态不止 string 一种（数组、嵌套节点），
 * 这层归一化逻辑独立出来才能脱离 React 单测（AGENTS.md：测试是护栏）。
 */

/** 无语言标注时的显示名 —— 不是「plain」这种实现词，给用户看的是「纯文本」。 */
const FALLBACK_LANGUAGE = "text";

/**
 * 从 code 节点的 className 提取语言显示名。
 * react-markdown（hast）给围栏块的 className 形如 `language-ts`，
 * 高亮插件可能追加修饰类（`language-js foo`），只取第一个 language-* 段。
 */
export function codeLanguage(className: string | undefined): string {
	if (className === undefined) return FALLBACK_LANGUAGE;
	for (const part of className.split(/\s+/)) {
		if (part.startsWith("language-")) {
			const lang = part.slice("language-".length);
			return lang === "" ? FALLBACK_LANGUAGE : lang;
		}
	}
	return FALLBACK_LANGUAGE;
}

/**
 * 从 code 节点的 children 提取纯文本。
 * hast 的 text 节点在 react-markdown 下展开为 string 或 string 数组；
 * 末尾单个 \n 是围栏块的语法收尾、不是代码内容，复制时不该带上。
 */
export function codeText(children: unknown): string {
	let text: string;
	if (typeof children === "string") {
		text = children;
	} else if (Array.isArray(children)) {
		text = children
			.map((part: unknown) => codeText(part))
			.join("");
	} else {
		// 元素节点（如高亮 span）：递归取其 children；取不到就当没有。
		text = "";
		if (typeof children === "object" && children !== null && "props" in children) {
			const props = (children as { props?: unknown }).props;
			if (typeof props === "object" && props !== null && "children" in props) {
				text = codeText((props as { children?: unknown }).children);
			}
		}
	}
	return text.endsWith("\n") ? text.slice(0, -1) : text;
}
